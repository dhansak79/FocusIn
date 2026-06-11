// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

const buildFeedDOM = (postContents) => {
  const postDivs = postContents.map((c) => `<div>${c}</div>`).join('')
  document.body.innerHTML = `
    <div data-testid="mainFeed" componentkey="container-update-list_mainFeed-lazy-container">
      <div data-lazy-mount-id="test-mount" style="display:contents">
        ${postDivs}
      </div>
    </div>`
  return document.querySelectorAll('[data-testid="mainFeed"] > div[data-lazy-mount-id] > div')
}

// Two slop signals: phrases + emoji density.
// Uses <br> for line breaks to match how LinkedIn renders post text in the DOM
// (innerText converts <br> → \n; textContent would collapse everything).
const SLOP_POST = [
  "In today's fast-paced world, thought leadership matters.",
  'Let that sink in.',
  'Game-changer.',
  'Leverage your potential.',
  'Key takeaways below.',
  '🚀 💡 🔥 💪 ⚡ 🎯',
].join('<br>')

const CLEAN_POST = 'We shipped a new feature today. The team is proud of the work done.'

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

const neverTrigger = () => false
const baseConfig = { 'feed-keywords': '', 'hide-by-age': 'disabled' }

describe('slop detection - warning injection', () => {
  it('injects a warning into a sloppy post when detect-slop is enabled', () => {
    const posts = buildFeedDOM([SLOP_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

    doFeed(neverTrigger, true, 'hide', { ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)

    expect(posts[0].querySelector('.linkoff-slop-warning')).not.toBeNull()
  })

  it('does not inject a warning into a clean post', () => {
    const posts = buildFeedDOM([CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

    doFeed(neverTrigger, true, 'hide', { ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)

    posts.forEach((post) => expect(post.querySelector('.linkoff-slop-warning')).toBeNull())
  })

  it('does not inject a warning when detect-slop is disabled', () => {
    const posts = buildFeedDOM([SLOP_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

    doFeed(neverTrigger, true, 'hide', { ...baseConfig, 'detect-slop': false })
    vi.advanceTimersByTime(350)

    expect(posts[0].querySelector('.linkoff-slop-warning')).toBeNull()
  })

  it('injects exactly one warning even when the interval fires multiple times', () => {
    const posts = buildFeedDOM([SLOP_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

    doFeed(neverTrigger, true, 'hide', { ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)
    vi.advanceTimersByTime(350)
    vi.advanceTimersByTime(350)

    expect(posts[0].querySelectorAll('.linkoff-slop-warning').length).toBe(1)
  })

  it('removes the warning when it is clicked', () => {
    const posts = buildFeedDOM([SLOP_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

    doFeed(neverTrigger, true, 'hide', { ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)

    posts[0].querySelector('.linkoff-slop-warning')?.click()

    expect(posts[0].querySelector('.linkoff-slop-warning')).toBeNull()
  })
})

describe('slop detection - interval behaviour', () => {
  it('runs without any keyword filters active', () => {
    const posts = buildFeedDOM([SLOP_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

    // no 'hide-promoted' or other keyword flags — slop detection must start its own interval
    doFeed(neverTrigger, true, 'hide', { ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)

    expect(posts[0].querySelector('.linkoff-slop-warning')).not.toBeNull()
  })

  it('does not show the scroll-down alert when only detect-slop is active with fewer than 6 posts', () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    buildFeedDOM([SLOP_POST, CLEAN_POST])

    // no keyword filters — alert should never fire
    doFeed(neverTrigger, true, 'hide', { ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)

    expect(window.alert).not.toHaveBeenCalled()
  })

  it('still warns on a sloppy post that has already been keyword-hidden', () => {
    const posts = buildFeedDOM([SLOP_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

    doFeed(neverTrigger, true, 'hide', {
      ...baseConfig,
      'hide-promoted': true,
      'detect-slop': true,
    })
    vi.advanceTimersByTime(350)

    // Slop post may or may not match the keyword filter, but the warning must appear
    expect(posts[0].querySelector('.linkoff-slop-warning')).not.toBeNull()
  })
})
