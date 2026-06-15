import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

const mockGet = vi.fn()
const mockSet = vi.fn()

beforeEach(async () => {
  vi.resetModules()
  vi.useFakeTimers()
  mockGet.mockReset()
  mockSet.mockReset()
  vi.stubGlobal('chrome', { storage: { session: { get: mockGet, set: mockSet } } })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const importStats = () => import('../src/stats.js')

// ---------------------------------------------------------------------------
// trackPostFiltered
// ---------------------------------------------------------------------------

describe('trackPostFiltered', () => {
  it('flushes postsFiltered delta to session storage after debounce', async () => {
    mockGet.mockImplementation((_, cb) => cb({}))
    const { trackPostFiltered } = await importStats()

    trackPostFiltered()
    trackPostFiltered()

    vi.advanceTimersByTime(500)
    await Promise.resolve()

    expect(mockSet).toHaveBeenCalledWith({
      'focusin-stats': expect.objectContaining({ postsFiltered: 2 }),
    })
  })

  it('accumulates onto existing storage value', async () => {
    mockGet.mockImplementation((_, cb) =>
      cb({ 'focusin-stats': { postsFiltered: 10, slopCollapsed: 0, slopHidden: 0, signals: {} } })
    )
    const { trackPostFiltered } = await importStats()

    trackPostFiltered()
    vi.advanceTimersByTime(500)
    await Promise.resolve()

    expect(mockSet).toHaveBeenCalledWith({
      'focusin-stats': expect.objectContaining({ postsFiltered: 11 }),
    })
  })

  it('does not flush before the debounce delay', async () => {
    mockGet.mockImplementation((_, cb) => cb({}))
    const { trackPostFiltered } = await importStats()

    trackPostFiltered()
    vi.advanceTimersByTime(499)

    expect(mockSet).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// trackSlopCollapsed
// ---------------------------------------------------------------------------

describe('trackSlopCollapsed', () => {
  it('increments slopCollapsed and records signals', async () => {
    mockGet.mockImplementation((_, cb) => cb({}))
    const { trackSlopCollapsed } = await importStats()

    trackSlopCollapsed(['"game-changer"', 'em dash'])
    vi.advanceTimersByTime(500)
    await Promise.resolve()

    expect(mockSet).toHaveBeenCalledWith({
      'focusin-stats': expect.objectContaining({
        slopCollapsed: 1,
        signals: { '"game-changer"': 1, 'em dash': 1 },
      }),
    })
  })

  it('accumulates signal counts across multiple posts', async () => {
    mockGet.mockImplementation((_, cb) => cb({}))
    const { trackSlopCollapsed } = await importStats()

    trackSlopCollapsed(['"game-changer"', 'em dash'])
    trackSlopCollapsed(['"game-changer"', 'line stacking'])
    vi.advanceTimersByTime(500)
    await Promise.resolve()

    expect(mockSet).toHaveBeenCalledWith({
      'focusin-stats': expect.objectContaining({
        slopCollapsed: 2,
        signals: { '"game-changer"': 2, 'em dash': 1, 'line stacking': 1 },
      }),
    })
  })
})

// ---------------------------------------------------------------------------
// trackSlopHidden
// ---------------------------------------------------------------------------

describe('trackSlopHidden', () => {
  it('increments slopHidden and records signals', async () => {
    mockGet.mockImplementation((_, cb) => cb({}))
    const { trackSlopHidden } = await importStats()

    trackSlopHidden(['"here\'s the thing"', 'line stacking'])
    vi.advanceTimersByTime(500)
    await Promise.resolve()

    expect(mockSet).toHaveBeenCalledWith({
      'focusin-stats': expect.objectContaining({
        slopHidden: 1,
        signals: { '"here\'s the thing"': 1, 'line stacking': 1 },
      }),
    })
  })
})

// ---------------------------------------------------------------------------
// readStats
// ---------------------------------------------------------------------------

describe('readStats', () => {
  it('returns stored stats via callback', async () => {
    const stored = { postsFiltered: 5, slopCollapsed: 3, slopHidden: 1, signals: { 'em dash': 2 } }
    mockGet.mockImplementation((_, cb) => cb({ 'focusin-stats': stored }))
    const { readStats } = await importStats()

    await new Promise((resolve) => {
      readStats((stats) => {
        expect(stats).toEqual(stored)
        resolve()
      })
    })
  })

  it('returns zero stats when storage is empty', async () => {
    mockGet.mockImplementation((_, cb) => cb({}))
    const { readStats } = await importStats()

    await new Promise((resolve) => {
      readStats((stats) => {
        expect(stats).toEqual({ postsFiltered: 0, slopCollapsed: 0, slopHidden: 0, signals: {} })
        resolve()
      })
    })
  })
})

// ---------------------------------------------------------------------------
// no chrome — does not throw
// ---------------------------------------------------------------------------

describe('without chrome', () => {
  it('track functions do not throw when chrome is unavailable', async () => {
    vi.unstubAllGlobals()
    const { trackPostFiltered, trackSlopCollapsed, trackSlopHidden } = await importStats()

    expect(() => {
      trackPostFiltered()
      trackSlopCollapsed(['em dash'])
      trackSlopHidden(['line stacking'])
      vi.advanceTimersByTime(500)
    }).not.toThrow()
  })

  it('readStats calls back with zeros when chrome is unavailable', async () => {
    vi.unstubAllGlobals()
    const { readStats } = await importStats()

    await new Promise((resolve) => {
      readStats((stats) => {
        expect(stats).toEqual({ postsFiltered: 0, slopCollapsed: 0, slopHidden: 0, signals: {} })
        resolve()
      })
    })
  })
})
