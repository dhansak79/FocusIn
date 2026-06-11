import {
  DROPDOWN_TRIGGER_SELECTOR,
  FEED_SELECTOR_CANDIDATES,
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

const handleSortByRecent = async (checkNeedUpdate) => {
  if (!checkNeedUpdate('sort-by-recent', true)) return

  if (!window.location.pathname.startsWith('/feed/')) return

  const dropdownTrigger = await waitForSelector(DROPDOWN_TRIGGER_SELECTOR)

  dropdownTrigger?.click()

  const recentOption = await waitForSelector(RECENT_OPTION_SELECTOR)

  recentOption?.click()
}

const extractPostText = (el) => {
  const clone = el.cloneNode(true)
  clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'))
  return clone.textContent
}

const warnSlop = (post, signals) => {
  const warning = document.createElement('div')
  warning.className = 'linkoff-slop-warning'
  warning.textContent = `🚨 Possible AI slop detected ↓↓↓ — ${signals.join(', ')} — click to dismiss`
  warning.onclick = () => warning.remove()
  post.prepend(warning)
}

const blockPostsByKeywords = (keywords, mode, disablePostCount, detectSlop) => {
  if (oldFeedKeywords.some((kw) => !keywords.includes(kw))) {
    resetShownPosts()
  }

  oldFeedKeywords = keywords

  const applyKeywordToPost = (post) => {
    if (keywords.some((keyword) => post.outerHTML.indexOf(keyword) !== -1)) {
      hidePost(post, mode)
    } else {
      removeHideClasses(post)
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
    if (posts.length > 5 || mode == 'dim') {
      posts.forEach(applyKeywordToPost)
    } else if (keywords.length) {
      promptScrollIfNeeded()
    }
    if (detectSlop) {
      document
        .querySelectorAll(getCustomSelector(POST_SELECTOR, 'all'))
        .forEach((post) => {
          if (post.dataset.slopChecked) return
          post.dataset.slopChecked = true
          const text = extractPostText(post)
          if (isSlop(text)) warnSlop(post, getSlopSignals(text))
        })
    }
  }

  if (keywords.length || detectSlop)
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

const handleFilterFeed = (mode, config) => {
  toggleFeed(true)

  resetBlockedPosts()
  clearInterval(feedInterval)
  blockPostsByKeywords(feedKeywords, mode, config['disable-postcount-prompt'], !!config['detect-slop'])
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
