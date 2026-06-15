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

// Actor card aria-label: "Name [Premium] Profile Degree" (premium) or "Name  Degree" (non-premium)
const getAuthorFromActorDiv = (post) => {
  const el = post.querySelector(
    '[aria-label*=" Profile"],[aria-label*="st+"],[aria-label*="nd+"],[aria-label*="rd+"]'
  )
  if (!el) return null
  return el.getAttribute('aria-label')
    .replace(/\s+(?:Premium\s+)?(?:Profile\s+)?\d(?:st|nd|rd)\+?\s*$/i, '').trim() || null
}

const getAuthorFromFollowBtn = (post) => {
  const btn = post.querySelector('button[aria-label^="Follow "]')
  return btn ? btn.getAttribute('aria-label').replace(/^Follow /, '').trim() : null
}

const getAuthorFromStrongLinks = (post) => {
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

const extractAuthorName = (post) =>
  getAuthorFromActorDiv(post) ?? getAuthorFromFollowBtn(post) ?? getAuthorFromStrongLinks(post)

// Tracks post text prefixes the user has explicitly revealed, persists for the page lifetime.
// Prevents re-collapsing when LinkedIn replaces the DOM element for an already-revealed post.
const revealedTexts = new Set()

const collapseToTag = (banner, author) => {
  banner.className = 'focusedin-slop-tag'
  while (banner.firstChild) banner.removeChild(banner.firstChild)
  const text = document.createElement('span')
  text.textContent = `🤖 AI post${author ? `  ·  ${author}` : ''}`
  banner.append(text)
}

const addRevealBanner = (post, signals) => {
  if (post.dataset.focusinBanner) return
  if (post.dataset.slopRevealed) return
  const postText = extractPostText(post).trim().slice(0, 150)
  if (revealedTexts.has(postText)) return
  post.dataset.focusinBanner = '1'
  const author = extractAuthorName(post)
  const banner = document.createElement('div')
  banner.className = 'focusedin-slop-collapsed'
  banner.dataset.focusinInjected = '1'

  const headline = document.createElement('div')
  headline.className = 'focusedin-slop-headline'
  headline.textContent = '🤖 AI-generated post'
  banner.append(headline)

  if (signals.length) {
    const signalRow = document.createElement('div')
    signalRow.className = 'focusedin-slop-signals'
    signalRow.textContent = signals.join('  ·  ')
    banner.append(signalRow)
  }

  if (author) {
    const authorEl = document.createElement('div')
    authorEl.className = 'focusedin-slop-author'
    authorEl.textContent = author
    banner.append(authorEl)
  }

  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'focusedin-slop-reveal-btn'
  btn.textContent = 'Show anyway'
  btn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    post.classList.remove('hide', 'focusedin-slop-soft-hide')
    post.dataset.slopRevealed = true
    revealedTexts.add(postText)
    collapseToTag(banner, author)
  })
  banner.append(btn)

  post.before(banner)
}

// ---------------------------------------------------------------------------
// Classification collapse banner
// ---------------------------------------------------------------------------

const CATEGORY_EMOJI = {
  'self-promotion': '📣',
  'hustle culture': '💼',
  'humble brag': '🙈',
  'thought leadership': '💡',
  'inspirational cliché': '✨',
}

export const applyClassificationDecision = (post, { label, score }) => {
  if (post.dataset.classificationBadge) return
  post.dataset.classificationBadge = label
  const emoji = CATEGORY_EMOJI[label] ?? '🏷️'
  const pct = Math.round(score * 100)

  // If a slop banner already precedes this post, append classification info to it
  const prev = post.previousElementSibling
  if (prev?.classList.contains('focusedin-slop-collapsed')) {
    const classRow = document.createElement('div')
    classRow.className = 'focusedin-slop-signals'
    classRow.textContent = `${emoji} ${label} · ${pct}%`
    const revealBtn = prev.querySelector('.focusedin-slop-reveal-btn')
    prev.insertBefore(classRow, revealBtn ?? null)
    return
  }

  post.classList.add('focusedin-slop-soft-hide')
  const banner = document.createElement('div')
  banner.className = 'focusedin-slop-collapsed'
  banner.dataset.focusinInjected = '1'
  const headline = document.createElement('div')
  headline.className = 'focusedin-slop-headline'
  headline.textContent = `${emoji} ${label}`
  banner.append(headline)
  const scoreRow = document.createElement('div')
  scoreRow.className = 'focusedin-slop-signals'
  scoreRow.textContent = `${pct}% confidence`
  banner.append(scoreRow)
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'focusedin-slop-reveal-btn'
  btn.textContent = 'Show anyway'
  btn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    post.classList.remove('focusedin-slop-soft-hide')
    collapseToTag(banner, extractAuthorName(post))
  })
  banner.append(btn)
  post.before(banner)
}

const sendClassifyRequest = (post, text) => {
  try {
    chrome.runtime.sendMessage({ 'classify-post': text }, (response) => {
      if (chrome.runtime.lastError || !response?.result) return
      applyClassificationDecision(post, response.result)
    })
  } catch {
    // Extension context invalidated after reload — silently discard
  }
}

// ---------------------------------------------------------------------------
// Feed observation and post filtering
// ---------------------------------------------------------------------------

// Returns true if a DOM node is a feed post (not an intermediate container or non-element)
const isPostNode = (node) => {
  if (node.nodeType !== Node.ELEMENT_NODE) return false
  if (node.dataset?.focusinInjected) return false
  const parent = node.parentElement
  return (
    node.matches('[role="listitem"]') ||
    parent?.hasAttribute('data-lazy-mount-id') ||
    parent?.getAttribute('data-display-contents') === 'true'
  )
}

const blockPostsByKeywords = (keywords, mode, detectSlop, hideSlop, classifyPosts) => {
  let postsProcessed = 0

  const countOnce = (post, fn, signals) => {
    if (post.dataset.focusinCounted) return
    signals ? fn(signals) : fn()
    post.dataset.focusinCounted = '1'
  }

  const requestClassification = (post) => {
    if (!classifyPosts || post.dataset.classifiedPost) return
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return
    post.dataset.classifiedPost = '1'
    sendClassifyRequest(post, extractPostText(post))
  }

  const checkSlop = (post) => {
    if (!(detectSlop || hideSlop)) return null
    if (post.dataset.slopRevealed || post.querySelector('[data-slop-revealed]')) return null
    const text = extractPostText(post)
    if (revealedTexts.has(text.trim().slice(0, 150))) return null
    return isSlop(text) ? getSlopSignals(text) : null
  }

  const applySlopDecision = (post, slopSignals) => {
    if (hideSlop) {
      hidePost(post, mode)
      countOnce(post, trackSlopHidden, slopSignals)
    } else {
      post.classList.add('focusedin-slop-soft-hide')
      post.dataset.hidden = true
      addRevealBanner(post, slopSignals)
      countOnce(post, trackSlopCollapsed, slopSignals)
    }
  }

  const applyKeywordToPost = (post) => {
    if (post.dataset.focusinInjected) return
    // LinkedIn nests an outer wrapper (> data-lazy-mount-id > div) AND an inner
    // div[role="listitem"] — both match POST_SELECTOR. Skip if an ancestor has
    // already been processed so we don't double-banner the same post.
    if (post.parentElement?.closest('[data-hidden="true"],[data-focusin-banner],[data-classified-post]')) return
    postsProcessed++
    const isKeywordMatch = keywords.some((keyword) => post.textContent.indexOf(keyword) !== -1)
    const slopSignals = checkSlop(post)
    if (isKeywordMatch) {
      hidePost(post, mode)
      countOnce(post, trackPostFiltered)
    } else if (slopSignals) {
      applySlopDecision(post, slopSignals)
    } else {
      if (!post.dataset.classificationBadge) {
        removeHideClasses(post)
        post.classList.remove('focusedin-slop-soft-hide')
        post.dataset.hidden = false
      }
      requestClassification(post)
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

  if (keywords.length || detectSlop || hideSlop || classifyPosts) connectObserver()
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
    !!config['hide-slop'],
    !!config['classify-posts']
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
