// @vitest-environment jsdom
import { vi, beforeEach, afterEach, it, expect } from 'vitest'
import { buildFeedDOM, baseConfig, SLOP_POST, SLOP_WITH_ACTOR, makeChromeStub } from './_helpers.js'

let doFeed

beforeEach(async () => {
  vi.resetModules()
  vi.useFakeTimers()
  doFeed = (await import('../../src/features/feed.js')).default
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const REWRITTEN_TEXT = "Aye, we shipped somethin' new."

// A chrome stub whose sendMessage does not call back immediately, so a test
// can inspect DOM state between the request being sent and the response
// arriving (the default makeChromeStub responds synchronously, which would
// hide anything that only exists transiently while waiting).
const makeDeferredChromeStub = () => {
  let capturedCallback
  const stub = {
    runtime: {
      lastError: null,
      sendMessage: vi.fn((_msg, cb) => {
        capturedCallback = cb
      }),
    },
    storage: {
      local: {
        get: vi.fn((_, cb) => cb({ 'author-whitelist': [] })),
        set: vi.fn(),
      },
    },
  }
  return { stub, respond: (response) => capturedCallback(response) }
}

it('renders a rewrite card with author and unfollow/trust actions when a flagged post is rewritten', () => {
  vi.stubGlobal('chrome', makeChromeStub({ 'scottish-rewrite': { text: REWRITTEN_TEXT } }))
  const posts = buildFeedDOM([SLOP_WITH_ACTOR])
  doFeed({ ...baseConfig, 'detect-slop': true, 'scottish-mode': true })
  vi.advanceTimersByTime(350)

  const card = posts[0].previousElementSibling
  expect(card.dataset.focusinInjected).toBe('1')
  expect(card.classList.contains('focusedin-scottish-rewrite')).toBe(true)
  expect(card.querySelector('.focusedin-scottish-headline').textContent).toBe('Translated — Scottish mode')
  expect(card.querySelector('.focusedin-scottish-body').textContent).toBe(REWRITTEN_TEXT)
  expect(card.querySelector('.focusedin-slop-author').textContent).toBe('John Doe')

  const actionsRow = card.querySelector('.focusedin-banner-actions')
  expect(actionsRow).toBeTruthy()
  expect(actionsRow.querySelector('.focusedin-unfollow-btn')).toBeTruthy()
  expect(actionsRow.querySelector('.focusedin-trust-btn')).toBeTruthy()

  const btn = card.querySelector('.focusedin-scottish-reveal-btn')
  expect(btn.type).toBe('button')
  expect(btn.textContent).toBe('Show original')

  expect(posts[0].classList.contains('focusedin-slop-soft-hide')).toBe(true)
  expect(posts[0].dataset.scottishRewritten).toBe('1')
})

it('omits the author row and actions when no author is extractable from the post', () => {
  vi.stubGlobal('chrome', makeChromeStub({ 'scottish-rewrite': { text: REWRITTEN_TEXT } }))
  const posts = buildFeedDOM([SLOP_POST])
  doFeed({ ...baseConfig, 'detect-slop': true, 'scottish-mode': true })
  vi.advanceTimersByTime(350)

  const card = posts[0].previousElementSibling
  expect(card.querySelector('.focusedin-slop-author')).toBeNull()
  expect(card.querySelector('.focusedin-banner-actions')).toBeNull()
})

it('reveals the original post on click and can be toggled back to the rewrite', () => {
  vi.stubGlobal('chrome', makeChromeStub({ 'scottish-rewrite': { text: REWRITTEN_TEXT } }))
  const posts = buildFeedDOM([SLOP_WITH_ACTOR])
  doFeed({ ...baseConfig, 'detect-slop': true, 'scottish-mode': true })
  vi.advanceTimersByTime(350)

  const card = posts[0].previousElementSibling
  card.querySelector('.focusedin-scottish-reveal-btn').click()
  expect(posts[0].classList.contains('focusedin-slop-soft-hide')).toBe(false)
  expect(card.classList.contains('focusedin-scottish-tag')).toBe(true)
  expect(card.textContent).toBe('Translated — Scottish mode · showing original')
  expect(card.children.length).toBe(1)

  card.click()
  expect(posts[0].classList.contains('focusedin-slop-soft-hide')).toBe(true)
  expect(card.classList.contains('focusedin-scottish-rewrite')).toBe(true)
  expect(card.querySelectorAll('.focusedin-scottish-body').length).toBe(1)
  expect(card.querySelector('.focusedin-scottish-body').textContent).toBe(REWRITTEN_TEXT)
})

it('ignores a click on the card background while the rewrite (not the collapsed tag) is showing', () => {
  vi.stubGlobal('chrome', makeChromeStub({ 'scottish-rewrite': { text: REWRITTEN_TEXT } }))
  const posts = buildFeedDOM([SLOP_POST])
  doFeed({ ...baseConfig, 'detect-slop': true, 'scottish-mode': true })
  vi.advanceTimersByTime(350)

  const card = posts[0].previousElementSibling
  const bodyBefore = card.querySelector('.focusedin-scottish-body')
  card.click()
  expect(card.classList.contains('focusedin-scottish-rewrite')).toBe(true)
  expect(posts[0].classList.contains('focusedin-slop-soft-hide')).toBe(true)
  // Same DOM node, not torn down and rebuilt by an unwanted re-render.
  expect(card.querySelector('.focusedin-scottish-body')).toBe(bodyBefore)
})

it('shows an immediate loading placeholder before the response arrives, then swaps it for the card', () => {
  const { stub, respond } = makeDeferredChromeStub()
  vi.stubGlobal('chrome', stub)
  const posts = buildFeedDOM([SLOP_POST])
  doFeed({ ...baseConfig, 'detect-slop': true, 'scottish-mode': true })
  vi.advanceTimersByTime(350)

  const placeholder = posts[0].previousElementSibling
  expect(placeholder.classList.contains('focusedin-scottish-loading')).toBe(true)
  expect(placeholder.dataset.focusinInjected).toBe('1')
  expect(placeholder.textContent).toBe('Translating — Scottish mode…')
  expect(posts[0].classList.contains('focusedin-slop-soft-hide')).toBe(true)

  const [message] = chrome.runtime.sendMessage.mock.calls[0]
  expect(message['scottish-rewrite'].post).toContain("thought leadership matters")

  respond({ text: REWRITTEN_TEXT })
  expect(placeholder.isConnected).toBe(false)
  expect(posts[0].previousElementSibling.classList.contains('focusedin-scottish-rewrite')).toBe(true)
})

it('falls back gracefully when the message response is undefined', () => {
  const { stub, respond } = makeDeferredChromeStub()
  vi.stubGlobal('chrome', stub)
  const posts = buildFeedDOM([SLOP_POST])
  doFeed({ ...baseConfig, 'detect-slop': true, 'scottish-mode': true })
  vi.advanceTimersByTime(350)

  expect(() => respond(undefined)).not.toThrow()
  expect(posts[0].previousElementSibling.classList.contains('focusedin-slop-collapsed')).toBe(true)
})

it('falls back to the existing slop banner when the rewrite has no usable text', () => {
  vi.stubGlobal('chrome', makeChromeStub({}))
  const posts = buildFeedDOM([SLOP_POST])
  doFeed({ ...baseConfig, 'detect-slop': true, 'scottish-mode': true })
  vi.advanceTimersByTime(350)

  const banner = posts[0].previousElementSibling
  expect(banner.classList.contains('focusedin-slop-collapsed')).toBe(true)
  expect(banner.classList.contains('focusedin-scottish-rewrite')).toBe(false)
})

it('replaces a pre-existing (non-Scottish) banner instead of stacking a new one', () => {
  vi.stubGlobal('chrome', makeChromeStub({}))
  const posts = buildFeedDOM([SLOP_POST])
  doFeed({ ...baseConfig, 'detect-slop': true, 'scottish-mode': false })
  vi.advanceTimersByTime(350)
  expect(posts[0].previousElementSibling.classList.contains('focusedin-slop-collapsed')).toBe(true)

  vi.stubGlobal('chrome', makeChromeStub({ 'scottish-rewrite': { text: REWRITTEN_TEXT } }))
  doFeed({ ...baseConfig, 'detect-slop': true, 'scottish-mode': true })
  vi.advanceTimersByTime(350)

  expect(posts[0].previousElementSibling.classList.contains('focusedin-scottish-rewrite')).toBe(true)
  expect(document.querySelectorAll('.focusedin-slop-collapsed').length).toBe(0)
})

it('does not re-attempt a rewrite for a post already marked scottishRewritten', () => {
  vi.stubGlobal('chrome', makeChromeStub({ 'scottish-rewrite': { text: REWRITTEN_TEXT } }))
  buildFeedDOM([SLOP_POST])
  doFeed({ ...baseConfig, 'detect-slop': true, 'scottish-mode': true })
  vi.advanceTimersByTime(350)
  const rewriteCallsAfterFirst = chrome.runtime.sendMessage.mock.calls.filter((c) => c[0]['scottish-rewrite']).length

  doFeed({ ...baseConfig, 'detect-slop': true, 'scottish-mode': true })
  vi.advanceTimersByTime(350)
  const rewriteCallsAfterSecond = chrome.runtime.sendMessage.mock.calls.filter((c) => c[0]['scottish-rewrite']).length

  expect(rewriteCallsAfterSecond).toBe(rewriteCallsAfterFirst)
})

it('falls back to the existing treatment when there is no extractable post text', () => {
  vi.stubGlobal('chrome', makeChromeStub({ 'scottish-rewrite': { text: REWRITTEN_TEXT } }))
  const posts = buildFeedDOM(['<p data-testid="expandable-text-box"></p><span>trigger</span>'])
  doFeed({ ...baseConfig, 'feed-keywords': 'trigger', 'scottish-mode': true })
  vi.advanceTimersByTime(350)

  expect(posts[0].classList.contains('hide')).toBe(true)
  expect(chrome.runtime.sendMessage.mock.calls.some((c) => c[0]['scottish-rewrite'])).toBe(false)
})

it('treats whitespace-only extracted text as empty and falls back', () => {
  vi.stubGlobal('chrome', makeChromeStub({ 'scottish-rewrite': { text: REWRITTEN_TEXT } }))
  const posts = buildFeedDOM(['<p data-testid="expandable-text-box">   \n  </p><span>trigger</span>'])
  doFeed({ ...baseConfig, 'feed-keywords': 'trigger', 'scottish-mode': true })
  vi.advanceTimersByTime(350)

  expect(posts[0].classList.contains('hide')).toBe(true)
  expect(chrome.runtime.sendMessage.mock.calls.some((c) => c[0]['scottish-rewrite'])).toBe(false)
})

it('truncates the extracted text to 3000 characters before sending it for rewriting', () => {
  const { stub, respond } = makeDeferredChromeStub()
  vi.stubGlobal('chrome', stub)
  const longPost = (SLOP_POST + ' ').repeat(60)
  buildFeedDOM([longPost])
  doFeed({ ...baseConfig, 'detect-slop': true, 'scottish-mode': true })
  vi.advanceTimersByTime(350)

  const [message] = chrome.runtime.sendMessage.mock.calls[0]
  expect(message['scottish-rewrite'].post.length).toBe(3000)
  respond({ text: REWRITTEN_TEXT })
})
