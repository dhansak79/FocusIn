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

const ZERO = { postsFiltered: 0, slopCollapsed: 0, signals: {}, authors: {} }

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
// trackAuthorBlocked
// ---------------------------------------------------------------------------

const flushAndExpectAuthors = async (storageFn, action, expectedAuthors) => {
  storageFn()
  const mod = await importStats()
  await flush(mod, action)
  expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
    'focusin-stats': expect.objectContaining({ authors: expectedAuthors }),
  }))
}

describe('trackAuthorBlocked', () => {
  it('flushes author entry to storage after debounce', async () => {
    await flushAndExpectAuthors(
      () => withStorage({ 'focusin-stats-date': TODAY }),
      ({ trackAuthorBlocked }) => trackAuthorBlocked('grace-hopper', 'Grace Hopper'),
      { 'grace-hopper': { name: 'Grace Hopper', count: 1 } }
    )
  })

  it('accumulates count for the same author across multiple calls', async () => {
    withStorage({ 'focusin-stats-date': TODAY })
    const mod = await importStats()

    await flush(mod, ({ trackAuthorBlocked }) => {
      trackAuthorBlocked('grace-hopper', 'Grace Hopper')
      trackAuthorBlocked('grace-hopper', 'Grace Hopper')
      trackAuthorBlocked('grace-hopper', 'Grace Hopper')
    })

    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
      'focusin-stats': expect.objectContaining({
        authors: { 'grace-hopper': { name: 'Grace Hopper', count: 3 } },
      }),
    }))
  })

  it('merges delta authors with existing stored authors', async () => {
    await flushAndExpectAuthors(
      () => withStorage(storedToday({ ...ZERO, authors: { 'alice': { name: 'Alice', count: 5 } } })),
      ({ trackAuthorBlocked }) => trackAuthorBlocked('alice', 'Alice'),
      { 'alice': { name: 'Alice', count: 6 } }
    )
  })

  it('falls back to display name as key when vanity is null', async () => {
    await flushAndExpectAuthors(
      () => withStorage({ 'focusin-stats-date': TODAY }),
      ({ trackAuthorBlocked }) => trackAuthorBlocked(null, 'No Vanity'),
      { 'No Vanity': { name: 'No Vanity', count: 1 } }
    )
  })

  it('does not write to storage when both vanity and display name are null', async () => {
    withStorage({ 'focusin-stats-date': TODAY })
    const mod = await importStats()

    await flush(mod, ({ trackAuthorBlocked }) => trackAuthorBlocked(null, null))

    expect(mockSet).not.toHaveBeenCalled()
  })

  it('resets author tallies when stored date is yesterday', async () => {
    await flushAndExpectAuthors(
      () => withStorage(storedYesterday({ ...ZERO, authors: { 'old-author': { name: 'Old Author', count: 99 } } })),
      ({ trackAuthorBlocked }) => trackAuthorBlocked('new-author', 'New Author'),
      { 'new-author': { name: 'New Author', count: 1 } }
    )
  })
})

// ---------------------------------------------------------------------------
// readAuthorStats
// ---------------------------------------------------------------------------

describe('readAuthorStats', () => {
  it('returns stored authors map when date matches today', async () => {
    const authors = { 'grace-hopper': { name: 'Grace Hopper', count: 3 } }
    withStorage(storedToday({ ...ZERO, authors }))
    const { readAuthorStats } = await importStats()

    const result = await new Promise((resolve) => readAuthorStats(resolve))
    expect(result).toEqual(authors)
  })

  it('returns empty object when stored date is yesterday', async () => {
    withStorage(storedYesterday({ ...ZERO, authors: { 'grace-hopper': { name: 'Grace Hopper', count: 3 } } }))
    const { readAuthorStats } = await importStats()

    const result = await new Promise((resolve) => readAuthorStats(resolve))
    expect(result).toEqual({})
  })

  it('returns empty object when storage is empty', async () => {
    emptyStorage()
    const { readAuthorStats } = await importStats()

    const result = await new Promise((resolve) => readAuthorStats(resolve))
    expect(result).toEqual({})
  })

  it('calls back with empty object when s.get throws', async () => {
    mockGet.mockImplementation(() => { throw new Error('Extension context invalidated.') })
    const { readAuthorStats } = await importStats()

    const result = await new Promise((resolve) => readAuthorStats(resolve))
    expect(result).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// trackSlopCollapsed
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
// readStats
// ---------------------------------------------------------------------------

describe('readStats', () => {
  it('returns stored stats when date matches today', async () => {
    const stored = { postsFiltered: 5, slopCollapsed: 3, signals: { 'em dash': 2 } }
    withStorage(storedToday(stored))
    const { readStats } = await importStats()

    expect(await awaitStats(readStats)).toEqual(stored)
  })

  it('returns zero stats when stored date is yesterday', async () => {
    withStorage(storedYesterday({ postsFiltered: 99, slopCollapsed: 10, signals: {} }))
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
// trackManualSlopReaction
// ---------------------------------------------------------------------------

describe('trackManualSlopReaction', () => {
  it('writes to focusin-slop-reactions, not focusin-stats', async () => {
    withStorage({})
    const mod = await importStats()

    await flush(mod, ({ trackManualSlopReaction }) => trackManualSlopReaction('john-doe', 'John Doe'))

    const setCall = mockSet.mock.calls[0][0]
    expect(setCall).toHaveProperty('focusin-slop-reactions')
    expect(setCall).not.toHaveProperty('focusin-stats')
  })

  it('increments count for the same author across multiple calls', async () => {
    withStorage({})
    const mod = await importStats()

    await flush(mod, ({ trackManualSlopReaction }) => {
      trackManualSlopReaction('john-doe', 'John Doe')
      trackManualSlopReaction('john-doe', 'John Doe')
    })

    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
      'focusin-slop-reactions': { 'john-doe': { name: 'John Doe', count: 2 } },
    }))
  })

  it('accumulates onto existing stored Hall of Shame data', async () => {
    mockGet.mockImplementation((key, cb) => cb({
      'focusin-slop-reactions': { 'john-doe': { name: 'John Doe', count: 5 } },
    }))
    const mod = await importStats()

    await flush(mod, ({ trackManualSlopReaction }) => trackManualSlopReaction('john-doe', 'John Doe'))

    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
      'focusin-slop-reactions': { 'john-doe': { name: 'John Doe', count: 6 } },
    }))
  })

  it('does nothing when both vanity and display name are null', async () => {
    withStorage({})
    const mod = await importStats()

    await flush(mod, ({ trackManualSlopReaction }) => trackManualSlopReaction(null, null))

    expect(mockSet).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// readHallOfShame
// ---------------------------------------------------------------------------

describe('readHallOfShame', () => {
  it('returns stored Hall of Shame map', async () => {
    const shame = { 'john-doe': { name: 'John Doe', count: 3 } }
    mockGet.mockImplementation((key, cb) => cb({ 'focusin-slop-reactions': shame }))
    const { readHallOfShame } = await importStats()

    const result = await new Promise((resolve) => readHallOfShame(resolve))
    expect(result).toEqual(shame)
  })

  it('returns empty object when no Hall of Shame data stored', async () => {
    withStorage({})
    const { readHallOfShame } = await importStats()

    const result = await new Promise((resolve) => readHallOfShame(resolve))
    expect(result).toEqual({})
  })

  it('returns empty object when chrome is unavailable', async () => {
    vi.unstubAllGlobals()
    const { readHallOfShame } = await importStats()

    const result = await new Promise((resolve) => readHallOfShame(resolve))
    expect(result).toEqual({})
  })

  it('returns empty object when s.get throws', async () => {
    mockGet.mockImplementation(() => { throw new Error('Extension context invalidated.') })
    const { readHallOfShame } = await importStats()

    const result = await new Promise((resolve) => readHallOfShame(resolve))
    expect(result).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// no chrome — does not throw
// ---------------------------------------------------------------------------

describe('without chrome', () => {
  it('track functions do not throw when chrome is unavailable', async () => {
    vi.unstubAllGlobals()
    const { trackPostFiltered, trackSlopCollapsed } = await importStats()

    expect(() => {
      trackPostFiltered()
      trackSlopCollapsed(['em dash'])
      vi.advanceTimersByTime(500)
    }).not.toThrow()
  })

  it('readStats calls back with zeros when chrome is unavailable', async () => {
    vi.unstubAllGlobals()
    const { readStats } = await importStats()

    expect(await awaitStats(readStats)).toEqual(ZERO)
  })
})
