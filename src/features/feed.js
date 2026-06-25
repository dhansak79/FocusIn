import {
  ACTIVITY_FEED_SELECTOR,
  FEED_SELECTOR_CANDIDATES,
  MIN_POST_COUNT,
  POST_SELECTOR,
} from '../constants.js'
import {
  findElement,
  hidePost,
  removeHideClasses,
  resetBlockedPosts,
  resetShownPosts,
} from '../utils.js'
import { getSlopSignals, isSlop } from './slop-detector.js'
import { trackAuthorBlocked, trackPostFiltered, trackSlopCollapsed } from '../stats.js'
import { unfollowAuthor } from './unfollow.js'

let feedObserver = null
let scrollTimerId = null

const POST_SELECTOR_STRING = POST_SELECTOR.join(',')

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

const vanityFromHref = (href) => (href ?? '').match(/\/in\/([^/?#]+)/)?.[1] ?? null

const getVanityFromStrongLinks = (post) => {
  for (const strong of post.querySelectorAll('a[href*="/in/"] strong')) {
    const link = strong.closest('a')
    const directText = [...(link?.parentElement?.childNodes ?? [])]
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent)
      .join('')
    if (!SOCIAL_PROOF_RE.test(directText)) return vanityFromHref(link?.getAttribute('href'))
  }
  return null
}

const extractAuthorVanityName = (post) => {
  const actorEl = post.querySelector(
    '[aria-label*=" Profile"],[aria-label*="st+"],[aria-label*="nd+"],[aria-label*="rd+"]'
  )
  const ariaVanity = vanityFromHref(actorEl?.closest('a[href*="/in/"]')?.getAttribute('href'))
  return ariaVanity ?? getVanityFromStrongLinks(post)
}

const SUMMARY_MAX_LENGTH = 120

// Extractive summary: the post's first sentence, or a truncated lead-in for one
// long run-on. Lets a reader judge a collapsed post without expanding it.
export const extractSummary = (text) => {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''
  const sentenceEnd = cleaned.search(/[.!?](?:\s|$)/)
  if (sentenceEnd !== -1 && sentenceEnd < SUMMARY_MAX_LENGTH) {
    return cleaned.slice(0, sentenceEnd + 1)
  }
  return `${cleaned.slice(0, SUMMARY_MAX_LENGTH).trim()}…`
}

// Tracks post text prefixes the user has explicitly revealed, persists for the page lifetime.
// Prevents re-collapsing when LinkedIn replaces the DOM element for an already-revealed post.
const revealedTexts = new Set()

const makeUnfollowButton = (vanityName) => {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'focusedin-unfollow-btn'
  btn.textContent = 'Unfollow'
  btn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    btn.disabled = true
    btn.textContent = 'Unfollowing…'
    unfollowAuthor(vanityName)
      .then(() => {
        btn.textContent = 'Unfollowed'
        btn.classList.add('focusedin-unfollow-done')
      })
      .catch(() => {
        btn.disabled = false
        btn.textContent = 'Unfollow failed'
      })
  })
  return btn
}

const makeWhitelistButton = (vanityName, authorName, post, banner) => {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'focusedin-trust-btn'
  btn.textContent = 'Trust author'
  btn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    chrome.storage.local.get({ 'author-whitelist': [] }, (result) => {
      const list = Array.isArray(result['author-whitelist']) ? result['author-whitelist'] : []
      const filtered = list.filter((entry) => entry.vanity !== vanityName)
      chrome.storage.local.set({ 'author-whitelist': [...filtered, { vanity: vanityName, name: authorName ?? vanityName }] })
    })
    btn.textContent = 'Trusted ✓'
    setTimeout(() => {
      post.classList.remove('focusedin-slop-soft-hide')
      banner.remove()
    }, 600)
  })
  return btn
}

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
  const fullText = extractPostText(post).trim()
  const postText = fullText.slice(0, 150)
  if (revealedTexts.has(postText)) return
  post.dataset.focusinBanner = '1'
  const author = extractAuthorName(post)
  const vanityName = extractAuthorVanityName(post)
  const banner = document.createElement('div')
  banner.className = 'focusedin-slop-collapsed'
  banner.dataset.focusinInjected = '1'

  const headline = document.createElement('div')
  headline.className = 'focusedin-slop-headline'
  headline.textContent = '🤖 AI-generated post'
  banner.append(headline)

  const summary = extractSummary(fullText)
  if (summary) {
    const summaryRow = document.createElement('div')
    summaryRow.className = 'focusedin-slop-summary'
    summaryRow.textContent = summary
    banner.append(summaryRow)
  }

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

  if (vanityName) {
    const actionsRow = document.createElement('div')
    actionsRow.className = 'focusedin-banner-actions'
    actionsRow.append(makeUnfollowButton(vanityName))
    actionsRow.append(makeWhitelistButton(vanityName, author, post, banner))
    banner.append(actionsRow)
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
// Feed observation and post filtering
// ---------------------------------------------------------------------------

const isMainFeedPost = (node) => {
  const parent = node.parentElement
  return (
    node.matches('[role="listitem"]') ||
    parent?.hasAttribute('data-lazy-mount-id') ||
    parent?.getAttribute('data-display-contents') === 'true'
  )
}

const isActivityFeedPost = (node) =>
  node.tagName === 'LI' && !!node.closest(ACTIVITY_FEED_SELECTOR)

// Returns true if a DOM node is a feed post (not an intermediate container or non-element)
const isPostNode = (node) => {
  if (node.nodeType !== Node.ELEMENT_NODE) return false
  if (node.dataset.focusinInjected) return false
  return isMainFeedPost(node) || isActivityFeedPost(node)
}

const SEMANTIC_THRESHOLD = 0.35
const SLOP_ARCHETYPE_THRESHOLD = 0.25

const isPromotedPost = (post) => {
  const textBox = post.querySelector('[data-testid="expandable-text-box"]')
  const candidates = post.querySelectorAll('p, span')
  for (const el of candidates) {
    if (!textBox?.contains(el) && el.textContent.trim() === 'Promoted') return true
  }
  return false
}

const blockPosts = (keywords, mode, detectSlop, semanticQuery, detectSlopArchetype, whitelisted, toneFilterEnabled, toneThreshold, hidePromoted) => {
  let postsProcessed = 0

  const countOnce = (post, fn, signals) => {
    if (post.dataset.focusinCounted) return
    signals ? fn(signals) : fn()
    post.dataset.focusinCounted = '1'
  }

  const semanticTopics = semanticQuery
    ? semanticQuery.split(',').map((q) => q.trim()).filter(Boolean)
    : []

  const buildSemanticCollapseBanner = (post, headlineText, signalText) => {
    post.classList.add('focusedin-slop-soft-hide')
    const banner = document.createElement('div')
    banner.className = 'focusedin-slop-collapsed'
    banner.dataset.focusinInjected = '1'
    const headlineEl = document.createElement('div')
    headlineEl.className = 'focusedin-slop-headline'
    headlineEl.textContent = headlineText
    banner.append(headlineEl)
    const summary = extractSummary(extractPostText(post))
    if (summary) {
      const summaryRow = document.createElement('div')
      summaryRow.className = 'focusedin-slop-summary'
      summaryRow.textContent = summary
      banner.append(summaryRow)
    }
    const scoreRow = document.createElement('div')
    scoreRow.className = 'focusedin-slop-signals'
    scoreRow.textContent = signalText
    banner.append(scoreRow)
    const author = extractAuthorName(post)
    const vanityName = extractAuthorVanityName(post)
    if (author) {
      const authorEl = document.createElement('div')
      authorEl.className = 'focusedin-slop-author'
      authorEl.textContent = author
      banner.append(authorEl)
    }
    if (vanityName) {
      const actionsRow = document.createElement('div')
      actionsRow.className = 'focusedin-banner-actions'
      actionsRow.append(makeUnfollowButton(vanityName))
      actionsRow.append(makeWhitelistButton(vanityName, author, post, banner))
      banner.append(actionsRow)
    }
    trackAuthorBlocked(vanityName, author)
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

  const makeSemanticApplier = (threshold, trackFn, headlineText, signalFn) => (post, response) => {
    if (chrome.runtime.lastError || response?.score == null) return
    if (response.score < threshold) return
    if (post.dataset.semanticHidden) return
    const vanity = extractAuthorVanityName(post)
    if (vanity && whitelisted.has(vanity)) return
    post.dataset.semanticHidden = '1'
    post.dataset.hidden = true
    countOnce(post, trackFn)
    const pct = Math.round(response.score * 100)
    buildSemanticCollapseBanner(post, headlineText, signalFn(response, pct))
  }

  const applySemanticResult = makeSemanticApplier(
    SEMANTIC_THRESHOLD, trackPostFiltered, '🎯 Semantic match',
    (r, pct) => `${r.topic ?? 'topic match'} · ${pct}%`
  )

  const applySemanticSlopResult = makeSemanticApplier(
    SLOP_ARCHETYPE_THRESHOLD, trackSlopCollapsed, '🎯 Pattern match',
    (_r, pct) => `pattern match · ${pct}%`
  )

  const applyToneResult = makeSemanticApplier(
    toneThreshold / 100, trackPostFiltered, '🌩 Negative tone',
    (_r, pct) => `negative tone · ${pct}%`
  )

  const chromeMessagingAvailable = () =>
    typeof chrome !== 'undefined' && !!chrome.runtime?.sendMessage

  const semanticCheckEnabled = (post) =>
    semanticTopics.length > 0 && !post.dataset.semanticChecked && chromeMessagingAvailable()

  const slopArchetypeCheckEnabled = (post) =>
    detectSlopArchetype && !post.dataset.slopArchetypeChecked && chromeMessagingAvailable()

  const toneCheckEnabled = (post) =>
    toneFilterEnabled && !post.dataset.toneChecked && chromeMessagingAvailable()

  const sendSemanticMessage = (msg, callback) => {
    try {
      chrome.runtime.sendMessage(msg, callback)
    } catch {
      // Extension context invalidated after reload
    }
  }

  const requestSemanticChecks = (post) => {
    const text = extractPostText(post).trim()
    if (text.length < 60) return
    if (slopArchetypeCheckEnabled(post)) {
      post.dataset.slopArchetypeChecked = '1'
      sendSemanticMessage(
        { 'slop-archetype-check': { post: text.slice(0, 256) } },
        (r) => applySemanticSlopResult(post, r)
      )
    }
    if (toneCheckEnabled(post)) {
      post.dataset.toneChecked = '1'
      sendSemanticMessage(
        { 'tone-check': { post: text.slice(0, 256) } },
        (r) => applyToneResult(post, r)
      )
    }
    if (semanticCheckEnabled(post)) {
      post.dataset.semanticChecked = '1'
      sendSemanticMessage(
        { 'semantic-check': { queries: semanticTopics, post: text.slice(0, 256) } },
        (r) => applySemanticResult(post, r)
      )
    }
  }

  const checkSlop = (post) => {
    if (!detectSlop) return null
    if (post.dataset.slopRevealed || post.querySelector('[data-slop-revealed]')) return null
    const text = extractPostText(post)
    if (revealedTexts.has(text.trim().slice(0, 150))) return null
    return isSlop(text) ? getSlopSignals(text) : null
  }

  const applySlopDecision = (post, slopSignals) => {
    const vanity = extractAuthorVanityName(post)
    if (vanity && whitelisted.has(vanity)) return
    post.classList.add('focusedin-slop-soft-hide')
    post.dataset.hidden = true
    addRevealBanner(post, slopSignals)
    countOnce(post, trackSlopCollapsed, slopSignals)
    trackAuthorBlocked(vanity, extractAuthorName(post))
  }

  const applyKeywordToPost = (post) => {
    if (post.dataset.focusinInjected) return
    if (post.parentElement?.closest('[data-hidden="true"],[data-focusin-banner],[data-semantic-checked]')) return
    postsProcessed++
    if (isPromotedPost(post)) {
      if (hidePromoted) {
        const vanity = extractAuthorVanityName(post)
        const name = extractAuthorName(post)
        hidePost(post, mode)
        countOnce(post, trackPostFiltered)
        trackAuthorBlocked(vanity, name)
      }
      return
    }
    const isKeywordMatch = keywords.some((keyword) => post.textContent.indexOf(keyword) !== -1)
    const slopSignals = checkSlop(post)
    if (isKeywordMatch) {
      hidePost(post, mode)
      countOnce(post, trackPostFiltered)
      trackAuthorBlocked(extractAuthorVanityName(post), extractAuthorName(post))
    } else if (slopSignals) {
      applySlopDecision(post, slopSignals)
    } else {
      removeHideClasses(post)
      post.classList.remove('focusedin-slop-soft-hide')
      post.dataset.hidden = false
      requestSemanticChecks(post)
    }
  }

  const processAddedNode = (node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return
    if (isPostNode(node)) {
      applyKeywordToPost(node)
    } else {
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

    document.querySelectorAll(POST_SELECTOR_STRING).forEach(applyKeywordToPost)

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

  if (keywords.length || detectSlop || semanticTopics.length || detectSlopArchetype || toneFilterEnabled || hidePromoted) connectObserver()
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
  disconnectObserver()
  resetBlockedPosts()
  resetShownPosts()
}

const handleFilterFeed = (mode, config) => {
  disconnectObserver()
  resetBlockedPosts()
  const rawWhitelist = config['author-whitelist']
  const whitelisted = new Set(
    Array.isArray(rawWhitelist) ? rawWhitelist.map((e) => e?.vanity).filter(Boolean) : []
  )
  blockPosts(
    config['feed-keywords'] ? config['feed-keywords'].split(',').map((k) => k.trim()).filter(Boolean) : [],
    mode,
    !!config['detect-slop'],
    config['semantic-filter'] || '',
    !!config['slop-archetype'],
    whitelisted,
    !!config['tone-filter'],
    config['tone-threshold'] ?? 70,
    !!config['hide-promoted']
  )
}

export default (config) => {
  if (!config['main-toggle']) {
    handleToggledOff()
    return
  }

  handleFilterFeed('hide', config)
}
