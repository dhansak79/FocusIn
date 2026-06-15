// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// Module mocks — hoisted before any import
vi.mock('../src/features/feed.js', () => ({ default: vi.fn() }))
vi.mock('../src/features/jobs.js', () => ({ default: vi.fn() }))
vi.mock('../src/features/misc.js', () => ({ default: vi.fn(), unfollowAll: vi.fn() }))
vi.mock('../src/features/message.js', () => ({ setupDeleteMessagesButton: vi.fn() }))

const mockGet = vi.fn().mockResolvedValue({})
let capturedOnMessage = null

const stubChrome = () =>
  vi.stubGlobal('chrome', {
    storage: {
      local: { get: mockGet },
      onChanged: { addListener: vi.fn() },
    },
    runtime: {
      onMessage: {
        addListener: vi.fn((fn) => {
          capturedOnMessage = fn
        }),
      },
    },
  })

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  mockGet.mockClear()
  mockGet.mockResolvedValue({})
  capturedOnMessage = null
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
    // Re-import with an authorized URL as the starting location
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

  it('calls initialize for an authorized URL', async () => {
    navigateHandlers[0]({ canIntercept: true, hashChange: false, downloadRequest: null, destination: { url: 'https://www.linkedin.com/feed/' } })
    await Promise.resolve()
    expect(mockGet).toHaveBeenCalled()
  })

  it('ignores unauthorized URLs', async () => {
    navigateHandlers[0]({ canIntercept: true, hashChange: false, downloadRequest: null, destination: { url: 'https://www.linkedin.com/in/someone/' } })
    await Promise.resolve()
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('calls setupDeleteMessagesButton for messaging URL', async () => {
    const { setupDeleteMessagesButton } = await import('../src/features/message.js')
    navigateHandlers[0]({ canIntercept: true, hashChange: false, downloadRequest: null, destination: { url: 'https://www.linkedin.com/messaging/' } })
    await Promise.resolve()
    expect(setupDeleteMessagesButton).toHaveBeenCalled()
  })

  it('calls doFeed on each navigation when config is loaded', async () => {
    const doFeed = (await import('../src/features/feed.js')).default
    mockGet.mockResolvedValue({ 'main-toggle': true })
    navigateHandlers[0]({ canIntercept: true, hashChange: false, downloadRequest: null, destination: { url: 'https://www.linkedin.com/feed/' } })
    await Promise.resolve() // handleNavigation → initialize()
    await Promise.resolve() // storage.get() resolves
    await Promise.resolve() // doIt runs
    expect(doFeed).toHaveBeenCalled()
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
// onMessage handler
// ---------------------------------------------------------------------------

describe('chrome.runtime.onMessage — unfollow-all', () => {
  beforeEach(async () => {
    vi.stubGlobal('navigation', { addEventListener: vi.fn() })
    await import('../src/index.js')
  })

  it('shows an alert when not on the follows page', async () => {
    vi.stubGlobal('location', { href: 'https://www.linkedin.com/feed/', pathname: '/feed/' })
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    await capturedOnMessage({ 'unfollow-all': true })
    expect(alertSpy).toHaveBeenCalled()
  })

  it('calls unfollowAll when on the follows page', async () => {
    const { unfollowAll } = await import('../src/features/misc.js')
    vi.stubGlobal('location', {
      href: 'https://www.linkedin.com/mynetwork/network-manager/people-follow',
      pathname: '/mynetwork/network-manager/people-follow',
    })
    await capturedOnMessage({ 'unfollow-all': true })
    expect(unfollowAll).toHaveBeenCalled()
  })

  it('does nothing when message is not unfollow-all', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    await capturedOnMessage({ other: true })
    expect(alertSpy).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Interval fallback path
// ---------------------------------------------------------------------------

describe('Interval fallback — when navigation is not in window', () => {
  beforeEach(async () => {
    vi.stubGlobal('location', { href: 'https://www.linkedin.com/feed/', pathname: '/feed/' })
    await import('../src/index.js')
    // Flush the initial handleNavigation call that fires synchronously on import
    await Promise.resolve()
    await Promise.resolve()
    mockGet.mockClear()
  })

  it('detects a URL change and calls initialize', async () => {
    vi.stubGlobal('location', { href: 'https://www.linkedin.com/jobs/', pathname: '/jobs/' })
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

    vi.stubGlobal('location', { href: 'https://www.linkedin.com/jobs/', pathname: '/jobs/' })
    await vi.advanceTimersByTimeAsync(2000)
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('restarts the interval when the tab becomes visible again', async () => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    vi.stubGlobal('location', { href: 'https://www.linkedin.com/jobs/', pathname: '/jobs/' })
    await vi.advanceTimersByTimeAsync(2000)
    await Promise.resolve()
    expect(mockGet).toHaveBeenCalled()
  })

  it('stops the interval on pagehide', async () => {
    window.dispatchEvent(new Event('pagehide'))

    vi.stubGlobal('location', { href: 'https://www.linkedin.com/jobs/', pathname: '/jobs/' })
    await vi.advanceTimersByTimeAsync(2000)
    expect(mockGet).not.toHaveBeenCalled()
  })
})
