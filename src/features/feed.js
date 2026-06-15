import {
  DROPDOWN_TRIGGER_SELECTOR,
  FEED_SELECTOR_CANDIDATES,
  LIKED_KEYWORDS,
  MIN_POST_COUNT,
  POST_SELECTOR,
  RECENT_OPTION_SELECTOR,
  SUGGESTED_KEYWORD,
} from '../constants.js'
import {
  findElement,
  hidePost,
  removeHideClasses,
  resetBlockedPosts,
  resetShownPosts,
  waitForSelector,
} from '../utils.js'
import { getSlopSignals, isSlop } from './slop-detector.js'
import { trackPostFiltered, trackSlopCollapsed, trackSlopHidden } from '../stats.js'

let feedObserver = null
let scrollTimerId = null

const POST_SELECTOR_STRING = POST_SELECTOR.join(',')

// ---------------------------------------------------------------------------
// Keyword extraction (exported so tests can use it directly)
// ---------------------------------------------------------------------------

const AGE_UNITS = [
  { name: 'hour',  suffix: 'h •',  from: 2, to: 24 },
  { name: 'day',   suffix: 'd •',  from: 2, to: 30 },
  { name: 'week',  suffix: 'w •',  from: 2, to: 4  },
  { name: 'month', suffix: 'mo •', from: 2, to: 12 },
  { name: 'year',  suffix: 'y •',  from: 2, to: 5  },
]

const KEYWORD_FLAGS = [
  ['hide-liked',     LIKED_KEYWORDS],
  ['hide-suggested', [SUGGESTED_KEYWORD]],
]

export const getFeedKeywords = (config) => {
  const keywords =
    config['feed-keywords'] === '' ? [] : config['feed-keywords'].split(',')

  const startIndex = AGE_UNITS.findIndex((u) => u.name === config['hide-by-age'])
  if (startIndex !== -1) {
    const { suffix, from, to } = AGE_UNITS[startIndex]
    for (let x = from; x <= to; x++) {
      keywords.push(`${x}${suffix}`)
    }
    for (let i = startIndex + 1; i < AGE_UNITS.length; i++) {
      keywords.push(AGE_UNITS[i].suffix)
    }
  }

  for (const [flag, values] of KEYWORD_FLAGS) {
    if (config[flag]) keywords.push(...values)
  }

  console.log('FocusedIn: Current feed keywords are', keywords)
  return keywords
}

// ---------------------------------------------------------------------------
// Sort by recent
// ---------------------------------------------------------------------------

const handleSortByRecent = async (config) => {
  if (!config['sort-by-recent']) return
  if (!window.location.pathname.startsWith('/feed/')) return

  const dropdownTrigger = await waitForSelector(DROPDOWN_TRIGGER_SELECTOR)
  dropdownTrigger?.click()

  const recentOption = await waitForSelector(RECENT_OPTION_SELECTOR)
  recentOption?.click()
}

// ---------------------------------------------------------------------------
// Post text / author extraction (for slop detection)
// ---------------------------------------------------------------------------

const extractPostText = (el) => {
  const textEl =
    el.querySelector('[data-testid="expandable-text-box"]') ??
    el.querySelector('.update-components-text') ??
    el
  const tmp = document.createElement('div')
  tmp.innerHTML = textEl.innerHTML
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6]|blockquote)>/gi, '\n')
  return tmp.textContent
}

const SOCIAL_PROOF_RE = /likes this|celebrates this|commented on|reposted/i

const extractAuthorName = (post) => {
  // Actor card aria-label: "Name [Premium] Profile Degree" (premium) or "Name  Degree" (non-premium)
  const actorDiv = post.querySelector(
    '[aria-label*=" Profile"],[aria-label*="st+"],[aria-label*="nd+"],[aria-label*="rd+"]'
  )
  if (actorDiv) {
    const name = actorDiv
      .getAttribute('aria-label')
      .replace(/\s+(?:Premium\s+)?(?:Profile\s+)?\d(?:st|nd|rd)\+?\s*$/i, '')
      .trim()
    if (name) return name
  }
  const followBtn = post.querySelector('button[aria-label^="Follow "]')
  if (followBtn) return followBtn.getAttribute('aria-label').replace(/^Follow /, '').trim()
  for (const strong of post.querySelectorAll('a[href*="/in/"] strong')) {
    const parent = strong.closest('a')?.parentElement
    const directText = [...(parent?.childNodes ?? [])]
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent)
      .join('')
    if (!SOCIAL_PROOF_RE.test(directText)) return strong.textContent.trim()
  }
  return null
}

const addRevealBanner = (post, signals) => {
  if (post.previousElementSibling?.classList.contains('focusedin-slop-collapsed')) return
  const author = extractAuthorName(post)
  const banner = document.createElement('div')
  banner.className = 'focusedin-slop-collapsed'
  banner.onclick = () => {
    post.classList.remove('hide', 'focusedin-slop-soft-hide')
    post.dataset.slopRevealed = true
    banner.remove()
  }

  const label = document.createElement('div')
  label.textContent = `🤖 AI slop hidden (${signals.join(', ')})`
  banner.append(label)

  if (author) {
    const authorEl = document.createElement('div')
    authorEl.className = 'focusedin-slop-author'
    authorEl.textContent = author
    banner.append(authorEl)
  }

  post.before(banner)
}

// ---------------------------------------------------------------------------
// Feed observation and post filtering
// ---------------------------------------------------------------------------

// Returns true if a DOM node is a feed post (not an intermediate container or non-element)
const isPostNode = (node) => {
  if (node.nodeType !== Node.ELEMENT_NODE) return false
  const parent = node.parentElement
  return (
    node.matches('[role="listitem"]') ||
    parent?.hasAttribute('data-lazy-mount-id') ||
    parent?.getAttribute('data-display-contents') === 'true'
  )
}

const blockPostsByKeywords = (keywords, mode, detectSlop, hideSlop) => {
  let postsProcessed = 0

  const applyKeywordToPost = (post) => {
    postsProcessed++
    const postText = post.textContent
    const isKeywordMatch = keywords.some((keyword) => postText.indexOf(keyword) !== -1)
    let slopSignals = null
    const shouldCheckSlop = (detectSlop || hideSlop) && !post.dataset.slopRevealed
    if (shouldCheckSlop) {
      const text = extractPostText(post)
      if (isSlop(text)) slopSignals = getSlopSignals(text)
    }
    if (isKeywordMatch) {
      hidePost(post, mode)
      trackPostFiltered()
    } else if (slopSignals) {
      if (hideSlop) {
        hidePost(post, mode)
        trackSlopHidden(slopSignals)
      } else {
        post.classList.add('focusedin-slop-soft-hide')
        post.dataset.hidden = true
        addRevealBanner(post, slopSignals)
        trackSlopCollapsed(slopSignals)
      }
    } else {
      removeHideClasses(post)
      post.classList.remove('focusedin-slop-soft-hide')
      post.dataset.hidden = false
    }
  }

  const processAddedNode = (node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return
    if (isPostNode(node)) {
      applyKeywordToPost(node)
    } else {
      // Intermediate container — check descendants for posts
      node.querySelectorAll(POST_SELECTOR_STRING).forEach(applyKeywordToPost)
    }
  }

  const connectObserver = () => {
    const feedContainer = findElement(FEED_SELECTOR_CANDIDATES)
    if (!feedContainer) {
      requestAnimationFrame(connectObserver)
      return
    }

    postsProcessed = 0

    // Process posts already in the DOM (handles initial load and keyword changes)
    document.querySelectorAll(POST_SELECTOR_STRING).forEach(applyKeywordToPost)

    // Scroll only if LinkedIn hasn't loaded enough posts yet — up to 2 nudges, 1s apart
    const scheduleScroll = (attempt) => {
      if (postsProcessed >= MIN_POST_COUNT || attempt > 2) {
        scrollTimerId = null
        return
      }
      window.scrollBy({ top: window.innerHeight, behavior: 'smooth' })
      scrollTimerId = setTimeout(() => scheduleScroll(attempt + 1), 1000)
    }
    scrollTimerId = setTimeout(() => scheduleScroll(1), 1000)

    feedObserver = new MutationObserver((mutations) => {
      for (const { addedNodes } of mutations) {
        addedNodes.forEach(processAddedNode)
      }
    })

    feedObserver.observe(feedContainer, { childList: true, subtree: true })
  }

  if (keywords.length || detectSlop || hideSlop) connectObserver()
}

const toggleFeed = (shown) => {
  if (!window.location.pathname.startsWith('/feed/')) return
  const feed = findElement(FEED_SELECTOR_CANDIDATES)
  if (shown) {
    feed?.classList.remove('hide')
    console.log('FocusedIn: feed enabled')
  } else {
    feed?.classList.add('hide')
    console.log('FocusedIn: feed disabled')
  }
}

const disconnectObserver = () => {
  feedObserver?.disconnect()
  feedObserver = null
  if (scrollTimerId !== null) {
    clearTimeout(scrollTimerId)
    scrollTimerId = null
  }
}

const handleToggledOff = () => {
  toggleFeed(true)
  disconnectObserver()
  resetBlockedPosts()
  resetShownPosts()
}

const handleHideWholeFeed = () => {
  toggleFeed(false)
  disconnectObserver()
  resetBlockedPosts()
}

const handleFilterFeed = (mode, config) => {
  toggleFeed(true)
  disconnectObserver()
  resetBlockedPosts()
  blockPostsByKeywords(
    getFeedKeywords(config),
    mode,
    !!config['detect-slop'],
    !!config['hide-slop']
  )
}

export default (config) => {
  const enabled = config['main-toggle']
  const mode = 'hide'

  if (!enabled) {
    handleToggledOff()
    return
  }

  if (config['hide-whole-feed']) {
    handleHideWholeFeed()
    return
  }

  handleSortByRecent(config)
  handleFilterFeed(mode, config)
}
