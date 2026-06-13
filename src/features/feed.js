import {
  DROPDOWN_TRIGGER_SELECTOR,
  FEED_SELECTOR_CANDIDATES,
  MIN_POST_COUNT,
  POST_SELECTOR,
  RECENT_OPTION_SELECTOR,
} from '../constants.js'
import {
  findElement,
  getCustomSelector,
  hidePost,
  removeHideClasses,
  resetBlockedPosts,
  resetShownPosts,
  waitForSelector,
} from '../utils.js'
import { getFeedKeywords } from './feed-keywords.js'
import { getSlopSignals, isSlop } from './slop-detector.js'

let runs = 0
let feedInterval
let feedKeywords = []
let oldFeedKeywords = []
let lastAutoScrolledUrl = null

const handleSortByRecent = async (checkNeedUpdate) => {
  if (!checkNeedUpdate('sort-by-recent', true)) return

  if (!window.location.pathname.startsWith('/feed/')) return

  const dropdownTrigger = await waitForSelector(DROPDOWN_TRIGGER_SELECTOR)

  dropdownTrigger?.click()

  const recentOption = await waitForSelector(RECENT_OPTION_SELECTOR)

  recentOption?.click()
}

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
  // Degree is always 1st/2nd/3rd with optional +
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
  // Fallback: Follow button always names the post author
  const followBtn = post.querySelector('button[aria-label^="Follow "]')
  if (followBtn) return followBtn.getAttribute('aria-label').replace(/^Follow /, '').trim()
  // Fallback: <strong> in /in/ link (older LinkedIn HTML and tests)
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
  if (post.previousElementSibling?.classList.contains('linkoff-slop-collapsed')) return
  const author = extractAuthorName(post)
  const banner = document.createElement('div')
  banner.className = 'linkoff-slop-collapsed'
  banner.onclick = () => {
    post.classList.remove('hide', 'dim', 'linkoff-slop-soft-hide')
    post.dataset.slopRevealed = true
    banner.remove()
  }

  const label = document.createElement('div')
  label.textContent = `🤖 AI slop hidden (${signals.join(', ')})`

  banner.append(label)

  if (author) {
    const authorEl = document.createElement('div')
    authorEl.className = 'linkoff-slop-author'
    authorEl.textContent = author
    banner.append(authorEl)
  }

  post.before(banner)
}

const blockPostsByKeywords = (keywords, mode, detectSlop, hideSlop) => {
  if (oldFeedKeywords.some((kw) => !keywords.includes(kw))) {
    resetShownPosts()
  }

  oldFeedKeywords = keywords

  const applyKeywordToPost = (post) => {
    const isKeywordMatch = keywords.some((keyword) => post.outerHTML.indexOf(keyword) !== -1)
    let slopSignals = null
    const shouldCheckSlop = (detectSlop || hideSlop) && !post.dataset.slopRevealed
    if (shouldCheckSlop) {
      const text = extractPostText(post)
      if (isSlop(text)) slopSignals = getSlopSignals(text)
    }
    if (isKeywordMatch) {
      hidePost(post, mode)
    } else if (slopSignals) {
      if (hideSlop) {
        hidePost(post, mode)
      } else {
        post.classList.add('linkoff-slop-soft-hide')
        post.dataset.hidden = true
        addRevealBanner(post, slopSignals)
      }
    } else {
      removeHideClasses(post)
      post.classList.remove('linkoff-slop-soft-hide')
      post.dataset.hidden = false
    }
  }

  const runBlockPosts = () => {
    if (!findElement(FEED_SELECTOR_CANDIDATES)) return
    if (runs % 10 === 0) resetBlockedPosts()
    const posts = document.querySelectorAll(
      getCustomSelector(POST_SELECTOR, 'pristine')
    )
    if (posts.length > MIN_POST_COUNT || mode == 'dim') {
      posts.forEach(applyKeywordToPost)
    }
  }

  if (keywords.length || detectSlop || hideSlop)
    feedInterval = setInterval(() => {
      runBlockPosts()
      runs++
    }, 350)
}

const toggleFeed = async (shown) => {
  if (!window.location.pathname.startsWith('/feed/')) return
  const feed = findElement(FEED_SELECTOR_CANDIDATES)
  if (shown) {
    feed?.classList.remove('hide')
    console.log(`LinkOff: feed enabled`)
  } else {
    feed?.classList.add('hide')
    console.log(`LinkOff: feed disabled`)
  }
}

const handleToggledOff = () => {
  toggleFeed(true)

  clearInterval(feedInterval)
  resetBlockedPosts()
  resetShownPosts()
}

const handleHideWholeFeed = () => {
  toggleFeed(false)
  resetBlockedPosts()
  clearInterval(feedInterval)
}

const autoScrollFeed = () => {
  if (lastAutoScrolledUrl === window.location.href) return
  lastAutoScrolledUrl = window.location.href
  let count = 0
  const id = setInterval(() => {
    window.scrollBy(0, window.innerHeight)
    if (++count >= 10) clearInterval(id)
  }, 400)
}

const handleFilterFeed = (mode, config) => {
  toggleFeed(true)

  resetBlockedPosts()
  clearInterval(feedInterval)
  autoScrollFeed()
  blockPostsByKeywords(feedKeywords, mode, !!config['detect-slop'], !!config['hide-slop'])
}

export default (checkNeedUpdate, enabled, mode, config) => {
  if (checkNeedUpdate('main-toggle', false)) {
    handleToggledOff()

    return
  }

  if (checkNeedUpdate('hide-whole-feed', true)) {
    handleHideWholeFeed()
    return
  }

  if (!enabled) return

  handleSortByRecent(checkNeedUpdate)

  feedKeywords = getFeedKeywords(config)

  if (feedKeywords !== oldFeedKeywords) {
    handleFilterFeed(mode, config)
  }
}
