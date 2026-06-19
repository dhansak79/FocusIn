// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

let mockUnfollowFn = vi.fn().mockResolvedValue({})
vi.mock('../../src/features/unfollow.js', () => ({
  unfollowAuthor: (...args) => mockUnfollowFn(...args),
}))

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
const SIX_CLEAN = [CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST]

const buildNestedFeedDOM = () => {
  document.body.innerHTML = `
    <div data-testid="mainFeed" componentkey="container-update-list_mainFeed-lazy-container">
      <div data-lazy-mount-id="test-mount" style="display:contents">
        <div data-display-contents="true"><div><div role="listitem">${CLEAN_POST}</div></div></div>
        <div>${CLEAN_POST}</div>
        <div>${CLEAN_POST}</div>
        <div>${CLEAN_POST}</div>
        <div>${CLEAN_POST}</div>
        <div>${CLEAN_POST}</div>
      </div>
    </div>`
}

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
  'main-toggle': true,
  'slop-archetype': true,
}

const runClean = (config) => {
  buildFeedDOM(SIX_CLEAN)
  doFeed({ ...baseConfig, ...config })
  vi.advanceTimersByTime(350)
}

const expectNoThrowWithContext = (config) => {
  vi.stubGlobal('chrome', {
    runtime: { lastError: null, sendMessage: vi.fn(() => { throw new Error('Extension context invalidated.') }) },
  })
  buildFeedDOM(SIX_CLEAN)
  expect(() => {
    doFeed({ ...baseConfig, ...config })
    vi.advanceTimersByTime(350)
  }).not.toThrow()
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
    const posts = buildFeedDOM(SIX_CLEAN)

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

  it('does not add a banner to a fresh element with the same content as a revealed post', () => {
    // Simulates LinkedIn replacing the post element with a fresh DOM node (its common
    // lazy-load behaviour after the post becomes visible). The new element has no
    // slopRevealed attribute, but its text prefix matches the revealedTexts Set, so
    // checkSlop returns null and no second banner is added.
    const posts = buildFeedDOM([SLOP_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)
    posts[0].previousElementSibling.querySelector('button').click()

    // LinkedIn removes the old element and inserts a fresh one with identical content
    const feedMount = document.querySelector('[data-lazy-mount-id]')
    const freshPost = document.createElement('div')
    freshPost.innerHTML = SLOP_POST
    feedMount.insertBefore(freshPost, posts[0])
    posts[0].remove()
    vi.advanceTimersByTime(50)

    expect(document.querySelectorAll('.focusedin-slop-collapsed').length).toBe(0)
  })

  it('adds exactly one banner when outer wrapper and inner listitem both match POST_SELECTOR', () => {
    // Matches the real LinkedIn DOM: div[data-display-contents] (outer) is matched by
    // "> data-lazy-mount-id > div", and the nested div[role="listitem"] is matched by
    // "FEED_SELECTOR div[role="listitem"]". Without the ancestor guard, both get banners.
    document.body.innerHTML = `
      <div data-testid="mainFeed" componentkey="container-update-list_mainFeed-lazy-container">
        <div data-lazy-mount-id="test-mount" style="display:contents">
          <div data-display-contents="true"><div><div role="listitem">${SLOP_POST}</div></div></div>
          <div>${CLEAN_POST}</div>
          <div>${CLEAN_POST}</div>
          <div>${CLEAN_POST}</div>
          <div>${CLEAN_POST}</div>
          <div>${CLEAN_POST}</div>
        </div>
      </div>`

    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)

    expect(document.querySelectorAll('.focusedin-slop-collapsed').length).toBe(1)
  })

  it('adds exactly one banner on re-scan after LinkedIn lazily fills the outer wrapper with a listitem', () => {
    // Outer container is in DOM at initial scan (empty content), processed as clean.
    // LinkedIn then injects div[role="listitem"] with slop content. A settings change
    // (second doFeed) re-scans — outer now has content and gets a banner; the inner
    // listitem finds the outer's data-focusin-banner ancestor and is skipped.
    document.body.innerHTML = `
      <div data-testid="mainFeed" componentkey="container-update-list_mainFeed-lazy-container">
        <div data-lazy-mount-id="test-mount" style="display:contents">
          <div data-display-contents="true"><div id="inner-mount"></div></div>
          <div>${CLEAN_POST}</div>
          <div>${CLEAN_POST}</div>
          <div>${CLEAN_POST}</div>
          <div>${CLEAN_POST}</div>
          <div>${CLEAN_POST}</div>
        </div>
      </div>`

    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)

    // LinkedIn lazily injects the actual post content
    const listitem = document.createElement('div')
    listitem.setAttribute('role', 'listitem')
    listitem.innerHTML = SLOP_POST
    document.getElementById('inner-mount').appendChild(listitem)

    // Settings change triggers a re-scan
    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)

    expect(document.querySelectorAll('.focusedin-slop-collapsed').length).toBe(1)
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

    const authorText = posts[0].previousElementSibling?.querySelector('.focusedin-slop-author')?.textContent ?? ''
    expect(authorText).toContain('Real Author')
    expect(authorText).not.toContain('Some Liker')
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
// semantic-filter integration
// ---------------------------------------------------------------------------

describe('semantic-filter integration', () => {
  let sendMessageSpy

  beforeEach(() => {
    sendMessageSpy = vi.fn((msg, cb) => cb({ score: 0.8, topic: 'hustle culture' }))
    vi.stubGlobal('chrome', {
      runtime: { lastError: null, sendMessage: sendMessageSpy },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends a semantic-check message for each clean post when semantic-filter is set', () => {
    runClean({ 'semantic-filter': 'hustle culture' })
    const semanticCalls = sendMessageSpy.mock.calls.filter((c) => c[0]['semantic-check'])
    expect(semanticCalls.length).toBe(6)
    expect(sendMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ 'semantic-check': expect.objectContaining({ queries: ['hustle culture'] }) }),
      expect.any(Function)
    )
  })

  it('hides a post and shows a collapse banner when the similarity score meets the threshold', () => {
    const posts = buildFeedDOM(SIX_CLEAN)
    doFeed({ ...baseConfig, 'semantic-filter': 'hustle culture', 'slop-archetype': false })
    vi.advanceTimersByTime(350)
    expect(posts[0].dataset.hidden).toBe('true')
    expect(posts[0].previousElementSibling?.classList.contains('focusedin-slop-collapsed')).toBe(true)
    expect(posts[0].previousElementSibling?.textContent).toMatch(/🎯 Semantic match/)
  })

  it('shows author on semantic match banner when author is present in DOM', () => {
    const postWithAuthor = `<a href="/in/someone"><strong>Grace Hopper</strong></a>${CLEAN_POST}`
    const posts = buildFeedDOM([postWithAuthor])
    doFeed({ ...baseConfig, 'semantic-filter': 'hustle culture', 'slop-archetype': false })
    vi.advanceTimersByTime(350)
    const authorText = posts[0].previousElementSibling?.querySelector('.focusedin-slop-author')?.textContent ?? ''
    expect(authorText).toContain('Grace Hopper')
  })

  it('omits author row on semantic match banner when no author is present in DOM', () => {
    const posts = buildFeedDOM([CLEAN_POST])
    doFeed({ ...baseConfig, 'semantic-filter': 'hustle culture', 'slop-archetype': false })
    vi.advanceTimersByTime(350)
    expect(posts[0].previousElementSibling?.querySelector('.focusedin-slop-author')).toBeNull()
  })

  it('clicking Show anyway on semantic banner reveals the post', () => {
    const posts = buildFeedDOM([CLEAN_POST])
    doFeed({ ...baseConfig, 'semantic-filter': 'hustle culture' })
    vi.advanceTimersByTime(350)
    const banner = posts[0].previousElementSibling
    banner.querySelector('.focusedin-slop-reveal-btn').click()
    expect(posts[0].classList.contains('focusedin-slop-soft-hide')).toBe(false)
    expect(banner.classList.contains('focusedin-slop-tag')).toBe(true)
  })

  it('does not hide a post when the similarity score is below the threshold', () => {
    sendMessageSpy = vi.fn((msg, cb) => cb({ score: 0.3 }))
    vi.stubGlobal('chrome', { runtime: { lastError: null, sendMessage: sendMessageSpy } })
    const posts = buildFeedDOM(SIX_CLEAN)
    doFeed({ ...baseConfig, 'semantic-filter': 'hustle culture', 'slop-archetype': false })
    vi.advanceTimersByTime(350)
    expect(posts[0].dataset.hidden).not.toBe('true')
  })

  it('does not send semantic-check messages when semantic-filter is empty', () => {
    buildFeedDOM(SIX_CLEAN)
    doFeed({ ...baseConfig, 'semantic-filter': '' })
    vi.advanceTimersByTime(350)
    const semanticCalls = sendMessageSpy.mock.calls.filter((c) => c[0]['semantic-check'])
    expect(semanticCalls.length).toBe(0)
  })

  it('does not semantic-check slop-detected posts', () => {
    buildFeedDOM([SLOP_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])
    doFeed({ ...baseConfig, 'detect-slop': true, 'semantic-filter': 'hustle culture' })
    vi.advanceTimersByTime(350)
    const semanticCheckCalls = sendMessageSpy.mock.calls.filter((c) => c[0]['semantic-check'])
    expect(semanticCheckCalls.length).toBe(5)
  })

  it('does not re-check a post when doFeed re-runs', () => {
    buildFeedDOM(SIX_CLEAN)
    doFeed({ ...baseConfig, 'semantic-filter': 'hustle culture' })
    vi.advanceTimersByTime(350)
    sendMessageSpy.mockClear()
    doFeed({ ...baseConfig, 'semantic-filter': 'hustle culture' })
    vi.advanceTimersByTime(350)
    expect(sendMessageSpy).not.toHaveBeenCalled()
  })

  it('does not throw when sendMessage throws Extension context invalidated', () => {
    expectNoThrowWithContext({ 'semantic-filter': 'hustle culture' })
  })

  it('does not throw when chrome is not available', () => {
    vi.unstubAllGlobals()
    buildFeedDOM(SIX_CLEAN)
    expect(() => {
      doFeed({ ...baseConfig, 'semantic-filter': 'hustle culture' })
      vi.advanceTimersByTime(350)
    }).not.toThrow()
  })

  it('does not hide a post when the response score is null', () => {
    sendMessageSpy = vi.fn((msg, cb) => cb({ score: null }))
    vi.stubGlobal('chrome', { runtime: { lastError: null, sendMessage: sendMessageSpy } })
    const posts = buildFeedDOM(SIX_CLEAN)
    doFeed({ ...baseConfig, 'semantic-filter': 'hustle culture' })
    vi.advanceTimersByTime(350)
    expect(posts[0].dataset.semanticHidden).toBeUndefined()
  })

  it('sends exactly one semantic-check when outer wrapper and inner listitem both match POST_SELECTOR', () => {
    buildNestedFeedDOM()
    doFeed({ ...baseConfig, 'semantic-filter': 'hustle culture' })
    vi.advanceTimersByTime(350)
    const semanticCalls = sendMessageSpy.mock.calls.filter((c) => c[0]['semantic-check'])
    expect(semanticCalls.length).toBe(6)
  })

  it('does not show a second banner when both archetype and topic checks fire above threshold', () => {
    sendMessageSpy = vi.fn((msg, cb) => cb({ score: 0.8, topic: 'hustle culture' }))
    vi.stubGlobal('chrome', { runtime: { lastError: null, sendMessage: sendMessageSpy } })
    buildFeedDOM([CLEAN_POST])
    doFeed({ ...baseConfig, 'detect-slop': true, 'semantic-filter': 'hustle culture' })
    vi.advanceTimersByTime(350)
    expect(document.querySelectorAll('.focusedin-slop-collapsed').length).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// slop-archetype-check integration
// ---------------------------------------------------------------------------

describe('slop-archetype-check integration', () => {
  let sendMessageSpy

  beforeEach(() => {
    sendMessageSpy = vi.fn((msg, cb) => cb({ score: 0.8, topic: 'manufactured courage' }))
    vi.stubGlobal('chrome', {
      runtime: { lastError: null, sendMessage: sendMessageSpy },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends a slop-archetype-check message for each clean post when detect-slop is enabled', () => {
    runClean({ 'detect-slop': true })
    expect(sendMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ 'slop-archetype-check': expect.objectContaining({ post: expect.any(String) }) }),
      expect.any(Function)
    )
  })

  it('collapses a post and shows a Pattern match banner when score meets the threshold', () => {
    const posts = buildFeedDOM([CLEAN_POST])
    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)
    expect(posts[0].dataset.hidden).toBe('true')
    expect(posts[0].previousElementSibling?.classList.contains('focusedin-slop-collapsed')).toBe(true)
    expect(posts[0].previousElementSibling?.textContent).toMatch(/🎯 Pattern match/)
  })

  it('shows pattern match signal text with percentage on the pattern match banner', () => {
    const posts = buildFeedDOM([CLEAN_POST])
    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)
    const signalText = posts[0].previousElementSibling?.querySelector('.focusedin-slop-signals')?.textContent ?? ''
    expect(signalText).toMatch(/pattern match · \d+%/)
  })

  it('shows author on pattern match banner when author is present in DOM', () => {
    const postWithAuthor = `<a href="/in/someone"><strong>Ada Lovelace</strong></a>${CLEAN_POST}`
    const posts = buildFeedDOM([postWithAuthor])
    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)
    const authorText = posts[0].previousElementSibling?.querySelector('.focusedin-slop-author')?.textContent ?? ''
    expect(authorText).toContain('Ada Lovelace')
  })

  it('omits author row on pattern match banner when no author is present in DOM', () => {
    const posts = buildFeedDOM([CLEAN_POST])
    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)
    expect(posts[0].previousElementSibling?.querySelector('.focusedin-slop-author')).toBeNull()
  })

  it('clicking Show anyway on archetype banner reveals the post and collapses banner to tag', () => {
    const posts = buildFeedDOM([CLEAN_POST])
    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)
    const banner = posts[0].previousElementSibling
    banner.querySelector('.focusedin-slop-reveal-btn').click()
    expect(posts[0].classList.contains('focusedin-slop-soft-hide')).toBe(false)
    expect(banner.classList.contains('focusedin-slop-tag')).toBe(true)
  })

  it('does not collapse a post when the archetype score is below the threshold', () => {
    sendMessageSpy = vi.fn((msg, cb) => cb({ score: 0.2 }))
    vi.stubGlobal('chrome', { runtime: { lastError: null, sendMessage: sendMessageSpy } })
    const posts = buildFeedDOM([CLEAN_POST])
    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)
    expect(posts[0].dataset.semanticHidden).toBeUndefined()
  })

  it('does not send archetype-check when slop-archetype is disabled', () => {
    runClean({ 'slop-archetype': false })
    const archetypeCall = sendMessageSpy.mock.calls.find((c) => c[0]['slop-archetype-check'])
    expect(archetypeCall).toBeUndefined()
  })

  it('does not archetype-check a keyword-matched or slop-detected post', () => {
    buildFeedDOM([SLOP_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])
    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)
    const archetypeCalls = sendMessageSpy.mock.calls.filter((c) => c[0]['slop-archetype-check'])
    expect(archetypeCalls.length).toBe(5)
  })

  it('does not re-check a post when doFeed re-runs', () => {
    buildFeedDOM([CLEAN_POST])
    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)
    sendMessageSpy.mockClear()
    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)
    expect(sendMessageSpy).not.toHaveBeenCalled()
  })

  it('does not throw when sendMessage throws Extension context invalidated', () => {
    expectNoThrowWithContext({ 'detect-slop': true })
  })

  it('does not throw when chrome is not available', () => {
    vi.unstubAllGlobals()
    buildFeedDOM([CLEAN_POST])
    expect(() => {
      doFeed({ ...baseConfig, 'detect-slop': true })
      vi.advanceTimersByTime(350)
    }).not.toThrow()
  })

  it('does not send archetype-check for a post with very short text (e.g. the composer widget)', () => {
    buildFeedDOM(['Start a post'])
    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)
    expect(sendMessageSpy).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// extractSummary - direct unit tests
// ---------------------------------------------------------------------------

describe('extractSummary', () => {
  let extractSummary

  beforeEach(async () => {
    ;({ extractSummary } = await import('../../src/features/feed.js'))
  })

  it('returns the first sentence of the text', () => {
    expect(extractSummary('We shipped a new feature today. The team is proud.')).toBe(
      'We shipped a new feature today.'
    )
  })

  it('collapses multi-line text before extracting the first sentence', () => {
    expect(extractSummary('Big news!\nWe just launched.\nMore details below.')).toBe('Big news!')
  })

  it('truncates a long run-on sentence with no early punctuation', () => {
    const longSentence = 'a'.repeat(200)
    const summary = extractSummary(longSentence)
    expect(summary.endsWith('…')).toBe(true)
    expect(summary.length).toBeLessThanOrEqual(121)
  })

  it('returns an empty string for empty input', () => {
    expect(extractSummary('   ')).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Summary row on collapsed-post banners
// ---------------------------------------------------------------------------

describe('summary row on collapse banners', () => {
  it('shows a short summary on the slop reveal banner', () => {
    const posts = buildFeedDOM([SLOP_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)

    const banner = posts[0].previousElementSibling
    const summaryRow = banner.querySelector('.focusedin-slop-summary')
    expect(summaryRow).not.toBeNull()
    expect(summaryRow.textContent).toContain("In today's fast-paced world")
  })

  it('shows a short summary on the semantic match banner', () => {
    const sendMessageSpy = vi.fn((msg, cb) => cb({ score: 0.8, topic: 'hustle culture' }))
    vi.stubGlobal('chrome', { runtime: { lastError: null, sendMessage: sendMessageSpy } })
    const posts = buildFeedDOM(SIX_CLEAN)

    doFeed({ ...baseConfig, 'semantic-filter': 'hustle culture' })
    vi.advanceTimersByTime(350)

    const banner = posts[0].previousElementSibling
    const summaryRow = banner.querySelector('.focusedin-slop-summary')
    expect(summaryRow).not.toBeNull()
    expect(summaryRow.textContent).toContain('We shipped a new feature today.')
  })
})

// ---------------------------------------------------------------------------
// Unfollow button
// ---------------------------------------------------------------------------

// Post with an actor card element inside an /in/ link — makes vanity name extractable
const SLOP_WITH_ACTOR = `<a href="/in/john-doe/"><div aria-label="John Doe Profile 2nd">John Doe</div></a><br>${SLOP_POST}`
const CLEAN_WITH_ACTOR = `<a href="/in/jane-smith/"><div aria-label="Jane Smith Profile 1st">Jane Smith</div></a>${CLEAN_POST}`

describe('Unfollow button', () => {
  beforeEach(() => {
    mockUnfollowFn = vi.fn().mockResolvedValue({})
  })

  it('shows an Unfollow button on the AI post banner when vanity name is extractable', () => {
    const posts = buildFeedDOM([SLOP_WITH_ACTOR, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])
    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)
    expect(posts[0].previousElementSibling.querySelector('.focusedin-unfollow-btn')).not.toBeNull()
  })

  it('does not show an Unfollow button on the AI post banner when vanity name is not extractable', () => {
    const posts = buildFeedDOM([SLOP_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])
    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)
    expect(posts[0].previousElementSibling.querySelector('.focusedin-unfollow-btn')).toBeNull()
  })

  it('shows an Unfollow button on the pattern match banner when vanity name is extractable', () => {
    vi.stubGlobal('chrome', {
      runtime: { lastError: null, sendMessage: vi.fn((msg, cb) => cb({ score: 0.8 })) },
    })
    const posts = buildFeedDOM([CLEAN_WITH_ACTOR])
    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)
    expect(posts[0].previousElementSibling.querySelector('.focusedin-unfollow-btn')).not.toBeNull()
  })

  it('disables the Unfollow button and shows loading text on click', () => {
    mockUnfollowFn = vi.fn().mockReturnValue(new Promise(() => {}))
    const posts = buildFeedDOM([SLOP_WITH_ACTOR, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])
    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)
    const btn = posts[0].previousElementSibling.querySelector('.focusedin-unfollow-btn')
    btn.click()
    expect(btn.disabled).toBe(true)
    expect(btn.textContent).toBe('Unfollowing…')
  })

  it('shows "Unfollowed" and adds done class on success', async () => {
    const posts = buildFeedDOM([SLOP_WITH_ACTOR, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])
    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)
    const btn = posts[0].previousElementSibling.querySelector('.focusedin-unfollow-btn')
    btn.click()
    await vi.runAllTicks()
    expect(btn.textContent).toBe('Unfollowed')
    expect(btn.classList.contains('focusedin-unfollow-done')).toBe(true)
    expect(btn.disabled).toBe(true)
  })

  it('shows "Unfollow failed" and re-enables the button on error', async () => {
    mockUnfollowFn = vi.fn().mockRejectedValue(new Error('fail'))
    const posts = buildFeedDOM([SLOP_WITH_ACTOR, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])
    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)
    const btn = posts[0].previousElementSibling.querySelector('.focusedin-unfollow-btn')
    btn.click()
    // Rejection travels through .then() before reaching .catch() — two microtask ticks needed
    await Promise.resolve()
    await Promise.resolve()
    expect(btn.disabled).toBe(false)
    expect(btn.textContent).toBe('Unfollow failed')
  })

  it('shows an Unfollow button when vanity name is extractable from a strong link (no aria-label)', () => {
    // Mirrors getAuthorFromStrongLinks fallback — a[href*="/in/"] strong without aria-label actor card
    const slopWithStrongLink = `<a href="/in/murad-q/"><strong>Murad Q</strong></a><br>${SLOP_POST}`
    const posts = buildFeedDOM([slopWithStrongLink, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])
    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)
    expect(posts[0].previousElementSibling.querySelector('.focusedin-unfollow-btn')).not.toBeNull()
  })

  it('the Unfollow button is placed after the author element and before Show anyway', () => {
    const posts = buildFeedDOM([SLOP_WITH_ACTOR, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])
    doFeed({ ...baseConfig, 'detect-slop': true })
    vi.advanceTimersByTime(350)
    const banner = posts[0].previousElementSibling
    const children = [...banner.children]
    const authorIdx = children.findIndex((el) => el.classList.contains('focusedin-slop-author'))
    const unfollowIdx = children.findIndex((el) => el.classList.contains('focusedin-unfollow-btn'))
    const revealIdx = children.findIndex((el) => el.classList.contains('focusedin-slop-reveal-btn'))
    expect(authorIdx).toBeLessThan(unfollowIdx)
    expect(unfollowIdx).toBeLessThan(revealIdx)
  })
})
