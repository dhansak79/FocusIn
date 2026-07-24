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

it('renders a rewrite card with author and unfollow/trust actions when a flagged post is rewritten', () => {
  vi.stubGlobal('chrome', makeChromeStub({ 'scottish-rewrite': { text: REWRITTEN_TEXT } }))
  const posts = buildFeedDOM([SLOP_WITH_ACTOR])
  doFeed({ ...baseConfig, 'detect-slop': true, 'scottish-mode': true })
  vi.advanceTimersByTime(350)

  const card = posts[0].previousElementSibling
  expect(card.classList.contains('focusedin-scottish-rewrite')).toBe(true)
  expect(card.querySelector('.focusedin-scottish-headline').textContent).toMatch(/Translated — Scottish mode/)
  expect(card.querySelector('.focusedin-scottish-body').textContent).toBe(REWRITTEN_TEXT)
  expect(card.querySelector('.focusedin-slop-author').textContent).toBe('John Doe')
  expect(card.querySelector('.focusedin-unfollow-btn')).toBeTruthy()
  expect(card.querySelector('.focusedin-trust-btn')).toBeTruthy()
  expect(posts[0].classList.contains('focusedin-slop-soft-hide')).toBe(true)
  expect(posts[0].dataset.scottishRewritten).toBe('1')
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

  card.click()
  expect(posts[0].classList.contains('focusedin-slop-soft-hide')).toBe(true)
  expect(card.classList.contains('focusedin-scottish-rewrite')).toBe(true)
  expect(card.querySelector('.focusedin-scottish-body').textContent).toBe(REWRITTEN_TEXT)
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

it('ignores a click on the card background while the rewrite (not the collapsed tag) is showing', () => {
  vi.stubGlobal('chrome', makeChromeStub({ 'scottish-rewrite': { text: REWRITTEN_TEXT } }))
  const posts = buildFeedDOM([SLOP_POST])
  doFeed({ ...baseConfig, 'detect-slop': true, 'scottish-mode': true })
  vi.advanceTimersByTime(350)

  const card = posts[0].previousElementSibling
  card.click()
  expect(card.classList.contains('focusedin-scottish-rewrite')).toBe(true)
  expect(posts[0].classList.contains('focusedin-slop-soft-hide')).toBe(true)
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
