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
// Uses <br> for line breaks to match how LinkedIn renders post text in the DOM.
const SLOP_POST = [
  "In today's fast-paced world, thought leadership matters.",
  'Let that sink in.',
  'Game-changer.',
  'Leverage your potential.',
  'Key takeaways below.',
  '🚀 💡 🔥 💪 ⚡ 🎯',
].join('<br>')

// Slop post using <div> elements for line breaks (not <br>), as LinkedIn does
// for checklist-style posts. Tests that extractPostText handles block elements.
const SLOP_POST_DIVS = [
  '<div>🚨 Exciting opportunity ahead 🚨</div>',
  '<div>✅ Excellent benefits package</div>',
  '<div>✅ Amazing collaborative team</div>',
  '<div>✅ Fantastic company culture</div>',
  '<div>✨ Someone who loves connecting people</div>',
  '<div>✨ A person who gets things done efficiently</div>',
].join('')

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

const baseConfig = {
  'feed-keywords': '',
  'hide-by-age': 'disabled',
  'main-toggle': true,
}

// ---------------------------------------------------------------------------
// detect-slop: collapse post with a reveal banner (soft mode)
// Uses focusedin-slop-soft-hide (not display:none) to preserve LinkedIn DOM state
// ---------------------------------------------------------------------------

describe('detect-slop - collapse with reveal banner', () => {
  it('collapses a sloppy post when detect-slop is enabled', () => {
    const posts = buildFeedDOM([SLOP_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)

    expect(posts[0].classList.contains('focusedin-slop-soft-hide')).toBe(true)
  })

  it('injects a sibling reveal banner for the collapsed post', () => {
    const posts = buildFeedDOM([SLOP_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)

    expect(posts[0].previousElementSibling?.classList.contains('focusedin-slop-collapsed')).toBe(true)
  })

  it('reveal banner is clickable (has the collapsed class)', () => {
    const posts = buildFeedDOM([SLOP_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)

    expect(posts[0].previousElementSibling?.classList.contains('focusedin-slop-collapsed')).toBe(true)
  })

  it('clicking the reveal button removes soft-hide class and transforms banner to tag', () => {
    const posts = buildFeedDOM([SLOP_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)

    posts[0].previousElementSibling.querySelector('button').click()

    expect(posts[0].classList.contains('focusedin-slop-soft-hide')).toBe(false)
    expect(posts[0].classList.contains('hide')).toBe(false)
    expect(posts[0].previousElementSibling?.classList.contains('focusedin-slop-collapsed')).toBeFalsy()
    expect(posts[0].previousElementSibling?.classList.contains('focusedin-slop-tag')).toBe(true)
  })

  it('does not re-collapse the post after the user reveals it', () => {
    const posts = buildFeedDOM([SLOP_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)
    posts[0].previousElementSibling.querySelector('button').click()

    vi.advanceTimersByTime(350)
    vi.advanceTimersByTime(350)

    expect(posts[0].classList.contains('focusedin-slop-soft-hide')).toBe(false)
    expect(posts[0].classList.contains('hide')).toBe(false)
  })

  it('does not collapse a clean post', () => {
    const posts = buildFeedDOM([CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)

    posts.forEach((post) => {
      expect(post.classList.contains('focusedin-slop-soft-hide')).toBe(false)
      expect(post.classList.contains('hide')).toBe(false)
    })
  })

  it('does not collapse posts when detect-slop is disabled', () => {
    const posts = buildFeedDOM([SLOP_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

    doFeed({ ...baseConfig, 'detect-slop': false })
    vi.advanceTimersByTime(350)

    expect(posts[0].classList.contains('focusedin-slop-soft-hide')).toBe(false)
    expect(posts[0].classList.contains('hide')).toBe(false)
  })

  it('does not re-process the reveal banner as a post (prevents infinite loop)', () => {
    // The banner is inserted as a sibling of the post (same parent: div[data-lazy-mount-id]).
    // The MutationObserver would see it and, without the focusinInjected guard, call
    // applyKeywordToPost on it. The banner text contains slop-signal names like "game-changer",
    // which would match the slop detector and insert another banner, creating an infinite loop.
    buildFeedDOM([SLOP_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)

    expect(document.querySelectorAll('.focusedin-slop-collapsed').length).toBe(1)
  })

  it('does not re-add a banner after reveal when doFeed runs again (double-tag fix)', () => {
    const posts = buildFeedDOM([SLOP_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)
    posts[0].previousElementSibling.querySelector('button').click()

    // Simulate a settings change re-triggering doFeed
    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)

    expect(document.querySelectorAll('.focusedin-slop-collapsed').length).toBe(0)
    expect(posts[0].classList.contains('focusedin-slop-soft-hide')).toBe(false)
  })

  it('does not add a banner to a wrapper node whose child post was already revealed', () => {
    // Simulates LinkedIn wrapping a revealed post inside a new container node.
    // The MutationObserver sees the wrapper as a new addedNode; isPostNode returns true
    // (parent has data-lazy-mount-id). Without the descendant guard, checkSlop would
    // run on the wrapper's text content (which contains the original slop text) and
    // add a second banner.
    const posts = buildFeedDOM([SLOP_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)
    posts[0].previousElementSibling.querySelector('button').click()

    // Move the revealed post inside a new wrapper in the same feed mount
    const feedMount = document.querySelector('[data-lazy-mount-id]')
    const wrapper = document.createElement('div')
    feedMount.insertBefore(wrapper, posts[0])
    wrapper.appendChild(posts[0])
    vi.advanceTimersByTime(50)

    expect(document.querySelectorAll('.focusedin-slop-collapsed').length).toBe(0)
    expect(posts[0].classList.contains('focusedin-slop-soft-hide')).toBe(false)
  })

  it('injects exactly one reveal banner even when the interval fires multiple times', () => {
    buildFeedDOM([SLOP_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)
    vi.advanceTimersByTime(350)
    vi.advanceTimersByTime(350)

    expect(document.querySelectorAll('.focusedin-slop-collapsed').length).toBe(1)
  })

  it('does not re-count a post when settings change and blockPostsByKeywords re-runs', () => {
    const posts = buildFeedDOM([SLOP_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)

    expect(posts[0].dataset.focusinCounted).toBe('1')

    // Second doFeed simulates a settings toggle — resets hidden state but not focusinCounted
    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)

    // Still '1' — countOnce guard fired for the second scan
    expect(posts[0].dataset.focusinCounted).toBe('1')
  })

  it('runs without any keyword filters active', () => {
    const posts = buildFeedDOM([SLOP_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)

    expect(posts[0].classList.contains('focusedin-slop-soft-hide')).toBe(true)
  })

  it('includes the author name in the banner when an author link is present', () => {
    const slopWithAuthor = `<a href="/in/test-user"><strong>Test Author</strong></a><br>${SLOP_POST}`
    const posts = buildFeedDOM([slopWithAuthor, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)

    expect(posts[0].previousElementSibling?.textContent).toContain('Test Author')
  })

  it('uses the post author not the person who liked it', () => {
    const likedPost = `<span><a href="/in/liker"><strong>Some Liker</strong></a> likes this</span><a href="/in/real-author"><strong>Real Author</strong></a><br>${SLOP_POST}`
    const posts = buildFeedDOM([likedPost, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)

    const bannerText = posts[0].previousElementSibling?.textContent ?? ''
    expect(bannerText).toContain('Real Author')
    expect(bannerText).not.toContain('Some Liker')
  })

  it('extracts author from aria-label on the actor card (current LinkedIn DOM)', () => {
    const realLinkedInPost = `
      <div aria-label="Jane Smith Premium Profile 2nd">${SLOP_POST}</div>
    `
    const posts = buildFeedDOM([realLinkedInPost, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)

    expect(posts[0].previousElementSibling?.textContent).toContain('Jane Smith')
  })

  it('extracts author from aria-label without Premium qualifier', () => {
    const post = `<div aria-label="Alex Jones Profile 3rd+">${SLOP_POST}</div>`
    const posts = buildFeedDOM([post, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)

    expect(posts[0].previousElementSibling?.textContent).toContain('Alex Jones')
  })

  it('extracts author from non-premium aria-label (name + double-space + degree)', () => {
    // Non-premium LinkedIn: "Naveen Kumar  3rd+" — no "Profile" word
    const post = `<div aria-label="Naveen Kumar  3rd+">${SLOP_POST}</div>`
    const posts = buildFeedDOM([post, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)

    expect(posts[0].previousElementSibling?.textContent).toContain('Naveen Kumar')
  })

  it('shows the banner without author info when no author link is present', () => {
    const posts = buildFeedDOM([SLOP_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)

    expect(posts[0].previousElementSibling?.classList.contains('focusedin-slop-collapsed')).toBe(true)
  })

  it('transforms to tag without author when no author link is present and reveal is clicked', () => {
    const posts = buildFeedDOM([SLOP_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)

    posts[0].previousElementSibling.querySelector('button').click()

    const tag = posts[0].previousElementSibling
    expect(tag?.classList.contains('focusedin-slop-tag')).toBe(true)
    expect(tag?.textContent).toBe('🤖 AI post')
  })

  it('does not show the scroll-down alert when only detect-slop is active', () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    buildFeedDOM([SLOP_POST, CLEAN_POST])

    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)

    expect(window.alert).not.toHaveBeenCalled()
  })

  it('collapses a sloppy post whose line breaks are <div> elements rather than <br>', () => {
    const posts = buildFeedDOM([SLOP_POST_DIVS, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)

    expect(posts[0].classList.contains('focusedin-slop-soft-hide')).toBe(true)
  })

  it('does not flag a clean post when LinkedIn reply-suggestion chips add emoji noise to the DOM', () => {
    // LinkedIn injects auto-generated reply chips (🎉🎉🎉 etc.) into the post's DOM
    // subtree. extractPostText must scope to [data-testid="expandable-text-box"] so
    // those chips don't inflate the emoji count and trigger a false positive.
    const postWithReplySuggestions = `
      <div data-testid="expandable-text-box">
        I grew my first strawberry from my balcony garden!
      </div>
      <div data-testid="reply-recommendations-container">
        <button>Congratulations! 🎉</button>
        <button>🎉 Excited for you</button>
        <button>🎉🎉🎉</button>
        <button>👏 Well deserved!</button>
        <button>🌟 Amazing result!</button>
      </div>
    `
    const posts = buildFeedDOM([postWithReplySuggestions, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)

    expect(posts[0].classList.contains('focusedin-slop-soft-hide')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// hide-slop: completely hidden via display:none, no reveal banner (hard mode)
// ---------------------------------------------------------------------------

describe('hide-slop - completely hidden', () => {
  it('hides a sloppy post when hide-slop is enabled', () => {
    const posts = buildFeedDOM([SLOP_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

    doFeed({ ...baseConfig, 'hide-slop': true })
    vi.advanceTimersByTime(350)

    expect(posts[0].classList.contains('hide')).toBe(true)
  })

  it('does not inject a reveal banner — post is completely gone', () => {
    const posts = buildFeedDOM([SLOP_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

    doFeed({ ...baseConfig, 'hide-slop': true })
    vi.advanceTimersByTime(350)

    expect(posts[0].previousElementSibling?.classList.contains('focusedin-slop-collapsed')).toBeFalsy()
  })

  it('does not hide a clean post', () => {
    const posts = buildFeedDOM([CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

    doFeed({ ...baseConfig, 'hide-slop': true })
    vi.advanceTimersByTime(350)

    posts.forEach((post) => expect(post.classList.contains('hide')).toBe(false))
  })

  it('does not hide posts when hide-slop is disabled', () => {
    const posts = buildFeedDOM([SLOP_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

    doFeed({ ...baseConfig, 'hide-slop': false })
    vi.advanceTimersByTime(350)

    expect(posts[0].classList.contains('hide')).toBe(false)
  })

  it('runs without any keyword filters active', () => {
    const posts = buildFeedDOM([SLOP_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

    doFeed({ ...baseConfig, 'hide-slop': true })
    vi.advanceTimersByTime(350)

    expect(posts[0].classList.contains('hide')).toBe(true)
  })

  it('does not show the scroll-down alert when only hide-slop is active', () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    buildFeedDOM([SLOP_POST, CLEAN_POST])

    doFeed({ ...baseConfig, 'hide-slop': true })
    vi.advanceTimersByTime(350)

    expect(window.alert).not.toHaveBeenCalled()
  })

  it('when both toggles active, hide-slop wins — post hidden with no reveal banner', () => {
    const posts = buildFeedDOM([SLOP_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

    doFeed({ ...baseConfig, 'hide-slop': true, 'detect-slop': true })
    vi.advanceTimersByTime(350)

    expect(posts[0].classList.contains('hide')).toBe(true)
    expect(posts[0].previousElementSibling?.classList.contains('focusedin-slop-collapsed')).toBeFalsy()
  })
})
