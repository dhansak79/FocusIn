// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// Current LinkedIn DOM uses data-testid="mainFeed" + data-lazy-mount-id children.
// Legacy DOM used componentkey + data-display-contents="true" children.
// Tests cover both so we catch regressions on either path.

const buildFeedDOM = (postContents) => {
  const postDivs = postContents.map((c) => `<div>${c}</div>`).join('')
  document.body.innerHTML = `
    <div data-testid="mainFeed" data-component-type="LazyColumn" componentkey="container-update-list_mainFeed-lazy-container">
      <div data-lazy-mount-id="test-mount" style="display:contents">
        ${postDivs}
      </div>
    </div>`
  return document.querySelectorAll('[data-testid="mainFeed"] > div[data-lazy-mount-id] > div')
}

const buildLegacyFeedDOM = (postContents) => {
  const postDivs = postContents.map((c) => `<div>${c}</div>`).join('')
  document.body.innerHTML = `
    <div componentkey="container-update-list_mainFeed-lazy-container">
      <div data-display-contents="true">
        ${postDivs}
      </div>
    </div>`
  return document.querySelectorAll('[componentkey="container-update-list_mainFeed-lazy-container"] > div[data-display-contents="true"] > div')
}

let doFeed

beforeEach(async () => {
  vi.resetModules()
  vi.useFakeTimers()
  doFeed = (await import('../../src/features/feed.js')).default
  vi.spyOn(window, 'alert').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// checkNeedUpdate that never triggers any special-case path
const neverTrigger = () => false
const baseConfig = { 'feed-keywords': '', 'hide-by-age': 'disabled' }

// ---------------------------------------------------------------------------
// Post processing — keyword matching (initial scan is synchronous)
// ---------------------------------------------------------------------------

describe('post processing - keyword matching', () => {
  it('hides a post whose text content contains a matched keyword', () => {
    const posts = buildFeedDOM(['Post 1', 'Post 2', 'Post 3', 'Alice likes this post', 'Post 5', 'Post 6'])

    doFeed(neverTrigger, true, 'hide', { ...baseConfig, 'hide-liked': true })

    const liked = Array.from(posts).find((p) => p.textContent.includes('likes this'))
    expect(liked.classList.contains('hide')).toBe(true)
  })

  it('sets data-hidden=false on posts that do not match any keyword', () => {
    const posts = buildFeedDOM(['Post 1', 'Post 2', 'Post 3', 'Alice likes this post', 'Post 5', 'Post 6'])

    doFeed(neverTrigger, true, 'hide', { ...baseConfig, 'hide-liked': true })

    Array.from(posts)
      .filter((p) => !p.textContent.includes('likes this'))
      .forEach((p) => expect(p.dataset.hidden).toBe('false'))
  })

  it('applies dim class instead of hide when mode is dim', () => {
    const [post] = buildFeedDOM(['Alice likes this post'])

    doFeed(neverTrigger, true, 'dim', { ...baseConfig, 'hide-liked': true })

    expect(post.classList.contains('dim')).toBe(true)
    expect(post.classList.contains('hide')).toBe(false)
  })

  it('removes existing hide classes from posts that no longer match', () => {
    const posts = buildFeedDOM(['Post 1', 'Post 2', 'Post 3', 'Post 4', 'Post 5', 'Post 6'])
    posts[0].classList.add('hide', 'showIcon')

    doFeed(neverTrigger, true, 'hide', { ...baseConfig, 'hide-liked': true })

    expect(posts[0].classList.contains('hide')).toBe(false)
    expect(posts[0].classList.contains('showIcon')).toBe(false)
    expect(posts[0].dataset.hidden).toBe('false')
  })

  it('hides a post that matches any one keyword when multiple keywords are active', () => {
    // Kills the some→every mutation: posts contain only ONE of the two active keywords,
    // so `every` would leave them unblocked while `some` correctly hides them.
    const posts = buildFeedDOM([
      'P1', 'P2', 'P3', 'P4',
      'Alice likes this post', // matches 'likes this' but not 'Suggested'
      'Suggested post',        // matches 'Suggested' but not 'likes this'
    ])

    doFeed(neverTrigger, true, 'hide', {
      ...baseConfig,
      'hide-liked': true,
      'hide-suggested': true,
    })

    const liked     = Array.from(posts).find((p) => p.textContent.includes('likes this'))
    const suggested = Array.from(posts).find((p) => p.textContent.includes('Suggested'))
    expect(liked.classList.contains('hide')).toBe(true)
    expect(suggested.classList.contains('hide')).toBe(true)
  })

  it('does not process any posts when there are no keywords', () => {
    const posts = buildFeedDOM(['P1', 'P2', 'P3', 'P4', 'P5', 'P6'])

    doFeed(neverTrigger, true, 'hide', baseConfig)

    posts.forEach((p) => expect(p.dataset.hidden).toBeUndefined())
  })
})

// ---------------------------------------------------------------------------
// enabled flag
// ---------------------------------------------------------------------------

describe('enabled flag', () => {
  it('does not process any posts when enabled is false', () => {
    const posts = buildFeedDOM(['P1', 'P2', 'P3', 'P4', 'P5', 'P6'])

    doFeed(neverTrigger, false, 'hide', { ...baseConfig, 'hide-promoted': true })

    posts.forEach((p) => expect(p.dataset.hidden).toBeUndefined())
  })
})

// ---------------------------------------------------------------------------
// main-toggle / hide-whole-feed guards
// ---------------------------------------------------------------------------

describe('main-toggle and hide-whole-feed', () => {
  it('does not process any posts when main-toggle triggers handleToggledOff', () => {
    const posts = buildFeedDOM(['P1', 'P2', 'P3'])
    const triggerToggleOff = (field, bool) => field === 'main-toggle' && bool === false

    doFeed(triggerToggleOff, true, 'hide', { ...baseConfig, 'hide-promoted': true })

    posts.forEach((p) => expect(p.dataset.hidden).toBeUndefined())
  })

  it('hides the feed element on /feed/ when hide-whole-feed is triggered', () => {
    document.body.innerHTML = `
      <div data-testid="mainFeed"></div>`
    vi.stubGlobal('location', { pathname: '/feed/' })
    const triggerHideWholeFeed = (field, bool) => field === 'hide-whole-feed' && bool === true

    doFeed(triggerHideWholeFeed, true, 'hide', baseConfig)

    const feed = document.querySelector('[data-testid="mainFeed"]')
    expect(feed.classList.contains('hide')).toBe(true)
  })

  it('shows the feed element on /feed/ when handleFilterFeed runs', () => {
    document.body.innerHTML = `
      <div data-testid="mainFeed" class="hide">
        <div data-lazy-mount-id="x" style="display:contents"></div>
      </div>`
    vi.stubGlobal('location', { pathname: '/feed/' })

    doFeed(neverTrigger, true, 'hide', { ...baseConfig, 'hide-promoted': true })

    const feed = document.querySelector('[data-testid="mainFeed"]')
    expect(feed.classList.contains('hide')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Keyword change handling — rescan re-evaluates all existing posts
// ---------------------------------------------------------------------------

describe('keyword change handling', () => {
  it('keeps shown posts shown when the keyword set does not change', () => {
    // Pre-populate posts as "shown" (data-hidden=false) before first call.
    const posts = buildFeedDOM(['P1', 'P2', 'P3'])
    posts.forEach((p) => p.setAttribute('data-hidden', 'false'))

    doFeed(neverTrigger, true, 'hide', { ...baseConfig, 'hide-liked': true })

    posts.forEach((p) => expect(p.dataset.hidden).toBe('false'))
  })

  it('un-hides a previously blocked post when its keyword is removed', () => {
    const posts = buildFeedDOM(['P1', 'P2', 'P3', 'Alice likes this post', 'P5', 'P6'])

    // First call: both flags active — liked post is blocked
    doFeed(neverTrigger, true, 'hide', { ...baseConfig, 'hide-liked': true, 'hide-suggested': true })

    const liked = Array.from(posts).find((p) => p.textContent.includes('likes this'))
    expect(liked.classList.contains('hide')).toBe(true)

    // Second call: remove hide-liked but keep hide-suggested — rescan un-hides the liked post
    doFeed(neverTrigger, true, 'hide', { ...baseConfig, 'hide-suggested': true })

    expect(liked.classList.contains('hide')).toBe(false)
    expect(liked.dataset.hidden).toBe('false')
  })

  it('hides a previously visible post when a new matching keyword is added', () => {
    const posts = buildFeedDOM(['P1', 'P2', 'P3', 'Alice likes this post', 'P5', 'P6'])

    // First call: no keyword filters — post is shown
    doFeed(neverTrigger, true, 'hide', { ...baseConfig })

    const liked = Array.from(posts).find((p) => p.textContent.includes('likes this'))
    expect(liked.classList.contains('hide')).toBe(false)

    // Second call: add hide-liked — post should now be hidden on rescan
    doFeed(neverTrigger, true, 'hide', { ...baseConfig, 'hide-liked': true })

    expect(liked.classList.contains('hide')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// handleSortByRecent
// ---------------------------------------------------------------------------

describe('handleSortByRecent', () => {
  it('clicks the dropdown trigger and recent option when sort-by-recent is triggered on /feed/', async () => {
    vi.stubGlobal('location', { pathname: '/feed/' })
    document.body.innerHTML = `
      <div data-view-name="feed-nav-feed-sort-toggle"></div>
      <div data-view-name="feed-sort-view-set-recent"></div>`

    const triggerSort = (field, bool) => field === 'sort-by-recent' && bool === true
    const dropdown = document.querySelector('[data-view-name="feed-nav-feed-sort-toggle"]')
    const recent   = document.querySelector('[data-view-name="feed-sort-view-set-recent"]')
    const clickDropdown = vi.spyOn(dropdown, 'click')
    const clickRecent   = vi.spyOn(recent,   'click')

    doFeed(triggerSort, true, 'hide', baseConfig)
    await vi.advanceTimersByTimeAsync(0)

    expect(clickDropdown).toHaveBeenCalled()
    expect(clickRecent).toHaveBeenCalled()
  })

  it('does not click anything when sort-by-recent is triggered but not on /feed/', async () => {
    // pathname defaults to '/' in jsdom — not /feed/
    document.body.innerHTML = `
      <div data-view-name="feed-nav-feed-sort-toggle"></div>
      <div data-view-name="feed-sort-view-set-recent"></div>`

    const triggerSort = (field, bool) => field === 'sort-by-recent' && bool === true
    const dropdown = document.querySelector('[data-view-name="feed-nav-feed-sort-toggle"]')
    const clickDropdown = vi.spyOn(dropdown, 'click')

    doFeed(triggerSort, true, 'hide', baseConfig)
    await vi.advanceTimersByTimeAsync(0)

    expect(clickDropdown).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// MutationObserver — nodes added after initial scan
// ---------------------------------------------------------------------------

describe('MutationObserver — nodes added after initial scan', () => {
  it('hides a post node added directly to the feed wrapper', async () => {
    document.body.innerHTML = `
      <div data-testid="mainFeed">
        <div data-lazy-mount-id="b1" style="display:contents"></div>
      </div>`

    doFeed(neverTrigger, true, 'hide', { ...baseConfig, 'hide-liked': true })

    const post = document.createElement('div')
    post.textContent = 'Alice likes this post'
    document.querySelector('[data-lazy-mount-id]').appendChild(post)

    await Promise.resolve()

    expect(post.classList.contains('hide')).toBe(true)
  })

  it('hides posts inside an intermediate container added to the feed', async () => {
    document.body.innerHTML = `<div data-testid="mainFeed"></div>`

    doFeed(neverTrigger, true, 'hide', { ...baseConfig, 'hide-liked': true })

    const wrapper = document.createElement('div')
    wrapper.setAttribute('data-lazy-mount-id', 'b2')
    const post = document.createElement('div')
    post.textContent = 'Alice likes this post'
    wrapper.appendChild(post)
    document.querySelector('[data-testid="mainFeed"]').appendChild(wrapper)

    await Promise.resolve()

    expect(post.classList.contains('hide')).toBe(true)
  })

  it('ignores text nodes added to the feed without throwing', async () => {
    document.body.innerHTML = `<div data-testid="mainFeed"></div>`

    doFeed(neverTrigger, true, 'hide', { ...baseConfig, 'hide-liked': true })

    document.querySelector('[data-testid="mainFeed"]').appendChild(document.createTextNode('  '))

    await Promise.resolve()

    expect(document.querySelectorAll('[data-hidden]').length).toBe(0)
  })

  it('retries connecting the observer when the feed container is not yet in the DOM', async () => {
    document.body.innerHTML = ''

    doFeed(neverTrigger, true, 'hide', { ...baseConfig, 'hide-liked': true })

    document.body.innerHTML = `
      <div data-testid="mainFeed">
        <div data-lazy-mount-id="b1" style="display:contents">
          <div>Alice likes this post</div>
        </div>
      </div>`

    await vi.advanceTimersByTimeAsync(16)

    const post = document.querySelector('[data-lazy-mount-id] > div')
    expect(post.classList.contains('hide')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Legacy DOM fallback (componentkey + data-display-contents)
// ---------------------------------------------------------------------------

describe('legacy DOM fallback', () => {
  it('hides a post via keyword match on the legacy componentkey + data-display-contents DOM', () => {
    const posts = buildLegacyFeedDOM(['Post 1', 'Post 2', 'Post 3', 'Alice likes this post', 'Post 5', 'Post 6'])

    doFeed(neverTrigger, true, 'hide', { ...baseConfig, 'hide-liked': true })

    const liked = Array.from(posts).find((p) => p.textContent.includes('likes this'))
    expect(liked.classList.contains('hide')).toBe(true)
  })

  it('does not match posts when neither current nor legacy feed container is present', () => {
    document.body.innerHTML = '<div id="not-a-feed"><div><div>Promoted post</div></div></div>'

    doFeed(neverTrigger, true, 'hide', { ...baseConfig, 'hide-promoted': true })

    // No known container — no posts should be processed
    expect(window.alert).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Reactive auto-scroll
// ---------------------------------------------------------------------------

describe('reactive auto-scroll', () => {
  const scrollBySpy = () => vi.spyOn(window, 'scrollBy').mockImplementation(() => {})

  it('does not scroll when posts are already in the DOM', async () => {
    buildFeedDOM(['Post 1', 'Post 2'])
    const spy = scrollBySpy()

    doFeed(neverTrigger, true, 'hide', { ...baseConfig, 'hide-liked': true })

    await vi.advanceTimersByTimeAsync(1000)
    expect(spy).not.toHaveBeenCalled()
  })

  it('scrolls once after 1s when no posts are found', async () => {
    document.body.innerHTML = '<div data-testid="mainFeed"></div>'
    const spy = scrollBySpy()

    doFeed(neverTrigger, true, 'hide', { ...baseConfig, 'hide-liked': true })

    await vi.advanceTimersByTimeAsync(1000)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith({ top: window.innerHeight, behavior: 'smooth' })
  })

  it('scrolls a second time after 2s if posts are still absent', async () => {
    document.body.innerHTML = '<div data-testid="mainFeed"></div>'
    const spy = scrollBySpy()

    doFeed(neverTrigger, true, 'hide', { ...baseConfig, 'hide-liked': true })

    await vi.advanceTimersByTimeAsync(2000)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('stops scrolling after 2 attempts even if posts never appear', async () => {
    document.body.innerHTML = '<div data-testid="mainFeed"></div>'
    const spy = scrollBySpy()

    doFeed(neverTrigger, true, 'hide', { ...baseConfig, 'hide-liked': true })

    await vi.advanceTimersByTimeAsync(5000)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('cancels the scroll timer when the observer is disconnected', async () => {
    document.body.innerHTML = '<div data-testid="mainFeed"></div>'
    const spy = scrollBySpy()

    doFeed(neverTrigger, true, 'hide', { ...baseConfig, 'hide-liked': true })

    // Toggle off before the 1s timer fires — should cancel the scroll
    doFeed(() => true, false, 'hide', { ...baseConfig })

    await vi.advanceTimersByTimeAsync(1000)
    expect(spy).not.toHaveBeenCalled()
  })
})
