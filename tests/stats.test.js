import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

const mockGet = vi.fn()
const mockSet = vi.fn()

const TODAY = '2026-06-15'

beforeEach(async () => {
  vi.resetModules()
  vi.useFakeTimers()
  vi.setSystemTime(new Date(`${TODAY}T10:00:00Z`))
  mockGet.mockReset()
  mockSet.mockReset()
  vi.stubGlobal('chrome', { storage: { local: { get: mockGet, set: mockSet } } })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const importStats = () => import('../src/stats.js')

const withStorage = (stored) => mockGet.mockImplementation((_, cb) => cb(stored))
const storedToday = (stats) => ({ 'focusin-stats': stats, 'focusin-stats-date': TODAY })
const emptyStorage = () => withStorage({})
const storedYesterday = (stats) => ({ 'focusin-stats': stats, 'focusin-stats-date': '2026-06-14' })

const flush = async (mod, fn) => {
  fn(mod)
  vi.advanceTimersByTime(500)
  await Promise.resolve()
}

const awaitStats = (readStats) =>
  new Promise((resolve) => readStats((stats) => resolve(stats)))

const ZERO = { postsFiltered: 0, slopCollapsed: 0, slopHidden: 0, signals: {} }

// ---------------------------------------------------------------------------
// trackPostFiltered
// ---------------------------------------------------------------------------

describe('trackPostFiltered', () => {
  it('flushes postsFiltered delta to local storage after debounce', async () => {
    withStorage({ 'focusin-stats-date': TODAY })
    const mod = await importStats()

    await flush(mod, ({ trackPostFiltered }) => { trackPostFiltered(); trackPostFiltered() })

    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
      'focusin-stats': expect.objectContaining({ postsFiltered: 2 }),
      'focusin-stats-date': TODAY,
    }))
  })

  it('accumulates onto existing storage value when date matches', async () => {
    withStorage(storedToday({ ...ZERO, postsFiltered: 10 }))
    const mod = await importStats()

    await flush(mod, ({ trackPostFiltered }) => trackPostFiltered())

    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
      'focusin-stats': expect.objectContaining({ postsFiltered: 11 }),
    }))
  })

  it('resets stats when stored date is yesterday', async () => {
    withStorage(storedYesterday({ ...ZERO, postsFiltered: 50 }))
    const mod = await importStats()

    await flush(mod, ({ trackPostFiltered }) => trackPostFiltered())

    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
      'focusin-stats': expect.objectContaining({ postsFiltered: 1 }),
    }))
  })

  it('does not flush before the debounce delay', async () => {
    emptyStorage()
    const { trackPostFiltered } = await importStats()

    trackPostFiltered()
    vi.advanceTimersByTime(499)

    expect(mockSet).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// trackSlopCollapsed / trackSlopHidden — shared helper
// ---------------------------------------------------------------------------

const flushAndExpectStats = async (action, expectedStats) => {
  withStorage({ 'focusin-stats-date': TODAY })
  const mod = await importStats()
  await flush(mod, action)
  expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
    'focusin-stats': expect.objectContaining(expectedStats),
  }))
}

describe('trackSlopCollapsed', () => {
  it('increments slopCollapsed and records signals', async () => {
    await flushAndExpectStats(
      ({ trackSlopCollapsed }) => trackSlopCollapsed(['"game-changer"', 'em dash']),
      { slopCollapsed: 1, signals: { '"game-changer"': 1, 'em dash': 1 } }
    )
  })

  it('accumulates signal counts across multiple posts', async () => {
    await flushAndExpectStats(
      ({ trackSlopCollapsed }) => {
        trackSlopCollapsed(['"game-changer"', 'em dash'])
        trackSlopCollapsed(['"game-changer"', 'line stacking'])
      },
      { slopCollapsed: 2, signals: { '"game-changer"': 2, 'em dash': 1, 'line stacking': 1 } }
    )
  })
})

// ---------------------------------------------------------------------------
// trackSlopHidden
// ---------------------------------------------------------------------------

describe('trackSlopHidden', () => {
  it('increments slopHidden and records signals', async () => {
    await flushAndExpectStats(
      ({ trackSlopHidden }) => trackSlopHidden(['"here\'s the thing"', 'line stacking']),
      { slopHidden: 1, signals: { '"here\'s the thing"': 1, 'line stacking': 1 } }
    )
  })
})

// ---------------------------------------------------------------------------
// readStats
// ---------------------------------------------------------------------------

describe('readStats', () => {
  it('returns stored stats when date matches today', async () => {
    const stored = { postsFiltered: 5, slopCollapsed: 3, slopHidden: 1, signals: { 'em dash': 2 } }
    withStorage(storedToday(stored))
    const { readStats } = await importStats()

    expect(await awaitStats(readStats)).toEqual(stored)
  })

  it('returns zero stats when stored date is yesterday', async () => {
    withStorage(storedYesterday({ postsFiltered: 99, slopCollapsed: 10, slopHidden: 5, signals: {} }))
    const { readStats } = await importStats()

    expect(await awaitStats(readStats)).toEqual(ZERO)
  })

  it('returns zero stats when storage is empty', async () => {
    emptyStorage()
    const { readStats } = await importStats()

    expect(await awaitStats(readStats)).toEqual(ZERO)
  })
})

// ---------------------------------------------------------------------------
// extension context invalidated (storage.get throws synchronously)
// ---------------------------------------------------------------------------

describe('extension context invalidated', () => {
  it('readStats calls back with zeros when s.get throws', async () => {
    mockGet.mockImplementation(() => { throw new Error('Extension context invalidated.') })
    const { readStats } = await importStats()

    expect(await awaitStats(readStats)).toEqual(ZERO)
  })

  it('track functions do not throw when s.get throws', async () => {
    mockGet.mockImplementation(() => { throw new Error('Extension context invalidated.') })
    const mod = await importStats()

    await expect(flush(mod, ({ trackPostFiltered }) => trackPostFiltered())).resolves.not.toThrow()
    expect(mockSet).not.toHaveBeenCalled()
  })

  it('flush skips set when chrome.runtime.lastError is set in get callback', async () => {
    vi.stubGlobal('chrome', {
      storage: { local: { get: mockGet, set: mockSet } },
      runtime: { lastError: new Error('Extension context invalidated.') },
    })
    mockGet.mockImplementation((_, cb) => cb({}))
    const mod = await importStats()

    await flush(mod, ({ trackPostFiltered }) => trackPostFiltered())

    expect(mockSet).not.toHaveBeenCalled()
  })

  it('readStats returns zeros when chrome.runtime.lastError is set in get callback', async () => {
    vi.stubGlobal('chrome', {
      storage: { local: { get: mockGet, set: mockSet } },
      runtime: { lastError: new Error('Extension context invalidated.') },
    })
    mockGet.mockImplementation((_, cb) => cb({}))
    const { readStats } = await importStats()

    expect(await awaitStats(readStats)).toEqual(ZERO)
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

    expect(await awaitStats(readStats)).toEqual(ZERO)
  })
})
