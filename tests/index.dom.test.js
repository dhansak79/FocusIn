// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// Module mocks — hoisted before any import
vi.mock('../src/features/feed.js', () => ({ default: vi.fn() }))

const mockGet = vi.fn().mockResolvedValue({})
let capturedOnChanged = null

const stubChrome = () =>
  vi.stubGlobal('chrome', {
    storage: {
      local: { get: mockGet },
      onChanged: { addListener: vi.fn((fn) => { capturedOnChanged = fn }) },
    },
    runtime: {
      onMessage: { addListener: vi.fn() },
    },
  })

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  mockGet.mockClear()
  mockGet.mockResolvedValue({})
  capturedOnChanged = null
  stubChrome()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
// Navigation API path
// ---------------------------------------------------------------------------

describe('Navigation API — when navigation is in window', () => {
  let navigateHandlers

  beforeEach(async () => {
    navigateHandlers = []
    vi.stubGlobal('navigation', {
      addEventListener: vi.fn((event, handler) => {
        if (event === 'navigate') navigateHandlers.push(handler)
      }),
    })
    await import('../src/index.js')
    // Flush and clear the initial handleNavigation call that fires on import
    await Promise.resolve()
    await Promise.resolve()
    mockGet.mockClear()
  })

  it('registers a navigate listener', () => {
    expect(navigateHandlers.length).toBe(1)
  })

  it('calls initialize immediately for the current page on load', async () => {
    vi.resetModules()
    mockGet.mockClear()
    vi.stubGlobal('location', { href: 'https://www.linkedin.com/feed/', pathname: '/feed/' })
    navigateHandlers = []
    vi.stubGlobal('navigation', {
      addEventListener: vi.fn((event, handler) => {
        if (event === 'navigate') navigateHandlers.push(handler)
      }),
    })
    await import('../src/index.js')
    await Promise.resolve()
    expect(mockGet).toHaveBeenCalled()
  })

  it('ignores hash-change navigations', async () => {
    navigateHandlers[0]({ canIntercept: true, hashChange: true, downloadRequest: null, destination: { url: 'https://www.linkedin.com/feed/' } })
    await Promise.resolve()
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('ignores download navigations', async () => {
    navigateHandlers[0]({ canIntercept: true, hashChange: false, downloadRequest: 'file.pdf', destination: { url: 'https://www.linkedin.com/feed/' } })
    await Promise.resolve()
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('ignores non-interceptable navigations', async () => {
    navigateHandlers[0]({ canIntercept: false, hashChange: false, downloadRequest: null, destination: { url: 'https://www.linkedin.com/feed/' } })
    await Promise.resolve()
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('calls initialize for /feed/', async () => {
    navigateHandlers[0]({ canIntercept: true, hashChange: false, downloadRequest: null, destination: { url: 'https://www.linkedin.com/feed/' } })
    await Promise.resolve()
    expect(mockGet).toHaveBeenCalled()
  })

  it('ignores unauthorized URLs', async () => {
    navigateHandlers[0]({ canIntercept: true, hashChange: false, downloadRequest: null, destination: { url: 'https://www.linkedin.com/in/someone/' } })
    await Promise.resolve()
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('calls doFeed on each navigation when config is loaded', async () => {
    const doFeed = (await import('../src/features/feed.js')).default
    mockGet.mockResolvedValue({ 'main-toggle': true })
    navigateHandlers[0]({ canIntercept: true, hashChange: false, downloadRequest: null, destination: { url: 'https://www.linkedin.com/feed/' } })
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(doFeed).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// chrome.storage.onChanged — stats key filter
// ---------------------------------------------------------------------------

describe('chrome.storage.onChanged — stats key filter', () => {
  beforeEach(async () => {
    vi.stubGlobal('navigation', { addEventListener: vi.fn() })
    await import('../src/index.js')
    await Promise.resolve()
    await Promise.resolve()
    mockGet.mockClear()
  })

  it('calls loadAndApply when a non-stats key changes', async () => {
    capturedOnChanged({ 'main-toggle': { newValue: true } })
    await Promise.resolve()
    expect(mockGet).toHaveBeenCalled()
  })

  it('does not call loadAndApply when only focusin-stats changes', async () => {
    capturedOnChanged({ 'focusin-stats': { newValue: {} } })
    await Promise.resolve()
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('does not call loadAndApply when only focusin-stats-date changes', async () => {
    capturedOnChanged({ 'focusin-stats-date': { newValue: '2026-06-15' } })
    await Promise.resolve()
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('does not call loadAndApply when both stats keys change together', async () => {
    capturedOnChanged({ 'focusin-stats': { newValue: {} }, 'focusin-stats-date': { newValue: '2026-06-15' } })
    await Promise.resolve()
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('calls loadAndApply when stats and a settings key change together', async () => {
    capturedOnChanged({ 'focusin-stats': { newValue: {} }, 'detect-slop': { newValue: true } })
    await Promise.resolve()
    expect(mockGet).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// loadAndApply — error handling
// ---------------------------------------------------------------------------

describe('loadAndApply — storage error handling', () => {
  it('does not throw when storage.get rejects (context invalidated)', async () => {
    vi.stubGlobal('navigation', { addEventListener: vi.fn() })
    vi.stubGlobal('location', { href: 'https://www.linkedin.com/feed/', pathname: '/feed/' })
    mockGet.mockRejectedValue(new Error('Extension context invalidated.'))

    await import('../src/index.js')
    await Promise.resolve()
    await Promise.resolve()
    // No unhandled rejection — test passes if we reach here
  })
})

// ---------------------------------------------------------------------------
// Interval fallback path
// ---------------------------------------------------------------------------

describe('Interval fallback — when navigation is not in window', () => {
  beforeEach(async () => {
    vi.stubGlobal('location', { href: 'https://www.linkedin.com/feed/', pathname: '/feed/' })
    await import('../src/index.js')
    await Promise.resolve()
    await Promise.resolve()
    mockGet.mockClear()
  })

  it('detects a URL change and calls initialize', async () => {
    vi.stubGlobal('location', { href: 'https://www.linkedin.com/feed/?new', pathname: '/feed/' })
    await vi.advanceTimersByTimeAsync(2000)
    await Promise.resolve()
    expect(mockGet).toHaveBeenCalled()
  })

  it('does not call initialize when URL has not changed', async () => {
    await vi.advanceTimersByTimeAsync(2000)
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('stops the interval when the tab is hidden', async () => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    vi.stubGlobal('location', { href: 'https://www.linkedin.com/feed/?new', pathname: '/feed/' })
    await vi.advanceTimersByTimeAsync(2000)
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('restarts the interval when the tab becomes visible again', async () => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    vi.stubGlobal('location', { href: 'https://www.linkedin.com/feed/?new', pathname: '/feed/' })
    await vi.advanceTimersByTimeAsync(2000)
    await Promise.resolve()
    expect(mockGet).toHaveBeenCalled()
  })

  it('stops the interval on pagehide', async () => {
    window.dispatchEvent(new Event('pagehide'))

    vi.stubGlobal('location', { href: 'https://www.linkedin.com/feed/?new', pathname: '/feed/' })
    await vi.advanceTimersByTimeAsync(2000)
    expect(mockGet).not.toHaveBeenCalled()
  })
})
