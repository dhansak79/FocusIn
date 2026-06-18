const STORAGE_KEY = 'focusin-stats'
const DATE_KEY = 'focusin-stats-date'
const FLUSH_DELAY = 500

const zero = () => ({ postsFiltered: 0, slopCollapsed: 0, signals: {} })

let pending = zero()
let flushTimer = null

const today = () => new Date().toISOString().slice(0, 10)

const local = () =>
  typeof chrome !== 'undefined' ? chrome.storage?.local : undefined

const applyDelta = (res, delta) => {
  const stats = res[DATE_KEY] === today() ? (res[STORAGE_KEY] || zero()) : zero()
  stats.postsFiltered += delta.postsFiltered
  stats.slopCollapsed += delta.slopCollapsed
  for (const [signal, count] of Object.entries(delta.signals)) {
    stats.signals[signal] = (stats.signals[signal] || 0) + count
  }
  return stats
}

const flush = () => {
  flushTimer = null
  const s = local()
  if (!s) { pending = zero(); return }
  const delta = pending
  pending = zero()
  try {
    s.get([STORAGE_KEY, DATE_KEY], (res) => {
      if (chrome.runtime?.lastError) return
      try { s.set({ [STORAGE_KEY]: applyDelta(res, delta), [DATE_KEY]: today() }) } catch (_) { /* context invalidated */ }
    })
  } catch (_) { /* context invalidated */ }
}

const schedule = () => {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(flush, FLUSH_DELAY)
}

const recordSignals = (signals) => {
  if (!signals) return
  for (const signal of signals) {
    pending.signals[signal] = (pending.signals[signal] || 0) + 1
  }
}

export const trackPostFiltered = () => { pending.postsFiltered++; schedule() }

export const trackSlopCollapsed = (signals) => {
  pending.slopCollapsed++
  recordSignals(signals)
  schedule()
}

export const readStats = (callback) => {
  const s = local()
  if (!s) { callback(zero()); return }
  try {
    s.get([STORAGE_KEY, DATE_KEY], (res) => {
      if (chrome.runtime?.lastError) { callback(zero()); return }
      const stats = res[DATE_KEY] === today() ? (res[STORAGE_KEY] || zero()) : zero()
      callback(stats)
    })
  } catch (_) { callback(zero()) }
}
