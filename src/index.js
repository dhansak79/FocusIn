'use strict'

import applyFeed from './features/feed.js'

const storage = chrome.storage.local

const loadAndApply = async () => {
  try {
    const config = await storage.get()
    applyFeed(config)
  } catch (_) { /* context invalidated */ }
}

const STATS_KEYS = new Set(['focusin-stats', 'focusin-stats-date', 'focusin-slop-reactions'])

// Storage listener — skip if only stats keys changed to avoid re-applying on every stat flush
chrome.storage.onChanged.addListener((changes) => {
  if (Object.keys(changes).every((k) => STATS_KEYS.has(k))) return
  loadAndApply()
})

const onNavigate = (url) => {
  const pathname = new URL(url).pathname
  if (pathname !== '/feed/' && pathname !== '/' && !pathname.includes('/recent-activity/')) return
  loadAndApply()
}

// Initialize on the current page immediately, then listen for subsequent navigations
onNavigate(window.location.href)

if (typeof window.navigation !== 'undefined' && window.navigation !== null) {
  window.navigation.addEventListener('navigate', (e) => {
    if (!e.canIntercept || e.hashChange || e.downloadRequest !== null) return
    onNavigate(e.destination.url)
  })
} else {
  // Fallback for environments where the Navigation API is unavailable
  let lastUrl = window.location.href
  let urlCheckIntervalId = null

  const startUrlCheck = () => {
    if (urlCheckIntervalId !== null) return
    urlCheckIntervalId = setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href
        onNavigate(window.location.href)
      }
    }, 2000)
  }

  const stopUrlCheck = () => {
    if (urlCheckIntervalId !== null) {
      clearInterval(urlCheckIntervalId)
      urlCheckIntervalId = null
    }
  }

  startUrlCheck()

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      stopUrlCheck()
    } else {
      startUrlCheck()
    }
  })
  window.addEventListener('pagehide', stopUrlCheck)
}
