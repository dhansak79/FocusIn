import { setupDeleteMessagesButton } from './features/message.js'
import applyFeed from './features/feed.js'
import applyMisc, { unfollowAll } from './features/misc.js'
import applyJobs from './features/jobs.js'
import { FOLLOW_PAGE_URL } from './constants.js'

const storage = chrome.storage.local

const applyConfig = (config) => {
  applyFeed(config)
  applyJobs(config)
  applyMisc(config)
}

const loadAndApply = async () => {
  try {
    const config = await storage.get()
    applyConfig(config)
  } catch (_) { /* context invalidated */ }
}

// Storage listener
chrome.storage.onChanged.addListener(loadAndApply)

chrome.runtime.onMessage.addListener(async (req) => {
  if (req['unfollow-all']) {
    if (!window.location.href.includes(FOLLOW_PAGE_URL)) {
      alert(
        'No messages. Are you on the follows page (/mynetwork/network-manager/people-follow)?\n\nIf not, please navigate to following using the LinkedIn navbar and then click the Unfollow All button again.'
      )
      return
    } else {
      await unfollowAll()
    }
  }
})

const AUTHORIZED_URLS = ['/', '/feed/', '/jobs/', '/messaging/']

const onNavigate = (url) => {
  const pathname = new URL(url).pathname
  if (!AUTHORIZED_URLS.includes(pathname)) return

  loadAndApply()

  if (pathname.startsWith('/messaging/')) {
    setupDeleteMessagesButton()
  }
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
