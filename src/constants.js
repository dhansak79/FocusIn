// Feed selectors — ordered by DOM stability (data-testid > componentkey)
export const FEED_SELECTOR = '[data-testid="mainFeed"]'
export const FEED_SELECTOR_LEGACY =
  "[componentkey='container-update-list_mainFeed-lazy-container']"
export const FEED_SELECTOR_CANDIDATES = [FEED_SELECTOR, FEED_SELECTOR_LEGACY]

export const MIN_POST_COUNT = 1

export const POST_SELECTOR = [
  `${FEED_SELECTOR} div[role="listitem"]`,
  `${FEED_SELECTOR} > div[data-lazy-mount-id] > div`,
  `${FEED_SELECTOR_LEGACY} > div[data-display-contents="true"] > div`,
]

// Visibility selectors
export const PRISTINE_SELECTOR = ':not([data-hidden])'
export const VISIBLE_SELECTOR = '[data-hidden=false]'
export const BLOCKED_SELECTOR = '[data-hidden=true]'
