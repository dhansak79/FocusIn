const STORAGE_KEY = 'focusin-stats'
const FLUSH_DELAY = 500

const zero = () => ({ postsFiltered: 0, slopCollapsed: 0, slopHidden: 0, signals: {} })

let pending = zero()
let flushTimer = null

const session = () =>
  typeof chrome !== 'undefined' ? chrome.storage?.session : undefined

const flush = () => {
  flushTimer = null
  const s = session()
  if (!s) { pending = zero(); return }
  const delta = pending
  pending = zero()
  s.get([STORAGE_KEY], (res) => {
    const stats = res[STORAGE_KEY] || zero()
    stats.postsFiltered += delta.postsFiltered
    stats.slopCollapsed += delta.slopCollapsed
    stats.slopHidden += delta.slopHidden
    for (const [signal, count] of Object.entries(delta.signals)) {
      stats.signals[signal] = (stats.signals[signal] || 0) + count
    }
    s.set({ [STORAGE_KEY]: stats })
  })
}

const schedule = () => {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(flush, FLUSH_DELAY)
}

const recordSignals = (signals) => {
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

export const trackSlopHidden = (signals) => {
  pending.slopHidden++
  recordSignals(signals)
  schedule()
}

export const readStats = (callback) => {
  const s = session()
  if (!s) { callback(zero()); return }
  s.get([STORAGE_KEY], (res) => callback(res[STORAGE_KEY] || zero()))
}
