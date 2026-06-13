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
let postCountPrompted = false
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

const extractAuthorName = (post) =>
  post.querySelector('a[href*="/in/"] strong')?.textContent?.trim() ?? null

const SLOP_SCORE_COMMENT =
  `This is triggering our "AI created content" algorithm. Do you normally write this way or is this an AI/LinkedIn thing? I am building an extension to detect AI generated and non-human content and it would be great to understand if my test passed or failed. Happy for a direct message for obvious reasons. We will send a list of real human content at the end of our study.`

const addRevealBanner = (post, signals) => {
  if (post.previousElementSibling?.classList.contains('linkoff-slop-collapsed')) return
  const author = extractAuthorName(post)
  const banner = document.createElement('div')
  banner.className = 'linkoff-slop-collapsed'

  const row = document.createElement('div')
  row.className = 'linkoff-slop-row'

  const revealBtn = document.createElement('button')
  revealBtn.className = 'linkoff-slop-reveal'
  revealBtn.textContent = 'Reveal post'
  revealBtn.onclick = () => {
    post.classList.remove('hide', 'dim', 'linkoff-slop-soft-hide')
    post.dataset.slopRevealed = true
    banner.remove()
  }

  const scoreBtn = document.createElement('button')
  scoreBtn.className = 'linkoff-slop-score'
  scoreBtn.textContent = 'SlopScore'
  scoreBtn.onclick = () => {
    post.classList.remove('hide', 'dim', 'linkoff-slop-soft-hide')
    post.dataset.slopRevealed = true
    banner.remove()
    navigator.clipboard.writeText(SLOP_SCORE_COMMENT)
  }

  row.append(document.createTextNode(`🤖 AI slop hidden (${signals.join(', ')})`), revealBtn, scoreBtn)
  banner.append(row)

  if (author) {
    const authorEl = document.createElement('div')
    authorEl.className = 'linkoff-slop-author'
    authorEl.textContent = author
    banner.append(authorEl)
  }

  post.before(banner)
}

const blockPostsByKeywords = (keywords, mode, disablePostCount, detectSlop, hideSlop) => {
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

  const promptScrollIfNeeded = () => {
    if (!postCountPrompted && !disablePostCount) {
      postCountPrompted = true
      alert(
        'Scroll down to start blocking posts (LinkedIn needs at least 10 loaded to load new ones).\n\nTo disable this alert, toggle it under misc in LinkOff settings'
      )
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
    } else if (keywords.length) {
      promptScrollIfNeeded()
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
  blockPostsByKeywords(feedKeywords, mode, config['disable-postcount-prompt'], !!config['detect-slop'], !!config['hide-slop'])
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
