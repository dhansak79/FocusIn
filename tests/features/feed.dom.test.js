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

// Base config: enabled, no keywords
const baseConfig = {
  'feed-keywords': '',
  'main-toggle': true,
}

// ---------------------------------------------------------------------------
// Post processing — keyword matching
// ---------------------------------------------------------------------------

describe('post processing - keyword matching', () => {
  it('hides a post whose text content contains a matched keyword', () => {
    const posts = buildFeedDOM(['Post 1', 'Post 2', 'Post 3', 'synergy post', 'Post 5', 'Post 6'])

    doFeed({ ...baseConfig, 'feed-keywords': 'synergy' })

    const matched = Array.from(posts).find((p) => p.textContent.includes('synergy'))
    expect(matched.classList.contains('hide')).toBe(true)
  })

  it('sets data-hidden=false on posts that do not match any keyword', () => {
    const posts = buildFeedDOM(['Post 1', 'Post 2', 'Post 3', 'synergy post', 'Post 5', 'Post 6'])

    doFeed({ ...baseConfig, 'feed-keywords': 'synergy' })

    Array.from(posts)
      .filter((p) => !p.textContent.includes('synergy'))
      .forEach((p) => expect(p.dataset.hidden).toBe('false'))
  })

  it('removes existing hide classes from posts that no longer match', () => {
    const posts = buildFeedDOM(['Post 1', 'Post 2', 'Post 3', 'Post 4', 'Post 5', 'Post 6'])
    posts[0].classList.add('hide', 'showIcon')

    doFeed({ ...baseConfig, 'feed-keywords': 'synergy' })

    expect(posts[0].classList.contains('hide')).toBe(false)
    expect(posts[0].classList.contains('showIcon')).toBe(false)
    expect(posts[0].dataset.hidden).toBe('false')
  })

  it('hides a post that matches any one keyword when multiple keywords are active', () => {
    const posts = buildFeedDOM([
      'P1', 'P2', 'P3', 'P4',
      'synergy post',
      'leverage your network',
    ])

    doFeed({ ...baseConfig, 'feed-keywords': 'synergy, leverage' })

    const synergy  = Array.from(posts).find((p) => p.textContent.includes('synergy'))
    const leverage = Array.from(posts).find((p) => p.textContent.includes('leverage'))
    expect(synergy.classList.contains('hide')).toBe(true)
    expect(leverage.classList.contains('hide')).toBe(true)
  })

  it('does not process any posts when there are no keywords', () => {
    const posts = buildFeedDOM(['P1', 'P2', 'P3', 'P4', 'P5', 'P6'])

    doFeed(baseConfig)

    posts.forEach((p) => expect(p.dataset.hidden).toBeUndefined())
  })
})

// ---------------------------------------------------------------------------
// main-toggle guard
// ---------------------------------------------------------------------------

describe('main-toggle', () => {
  it('does not process any posts when main-toggle is off', () => {
    const posts = buildFeedDOM(['P1', 'P2', 'P3'])

    doFeed({ ...baseConfig, 'main-toggle': false })

    posts.forEach((p) => expect(p.dataset.hidden).toBeUndefined())
  })
})

// ---------------------------------------------------------------------------
// Keyword change handling — rescan re-evaluates all existing posts
// ---------------------------------------------------------------------------

describe('keyword change handling', () => {
  it('keeps shown posts shown when the keyword set does not change', () => {
    const posts = buildFeedDOM(['P1', 'P2', 'P3'])
    posts.forEach((p) => p.setAttribute('data-hidden', 'false'))

    doFeed({ ...baseConfig, 'feed-keywords': 'synergy' })

    posts.forEach((p) => expect(p.dataset.hidden).toBe('false'))
  })

  it('un-hides a previously blocked post when its keyword is removed', () => {
    const posts = buildFeedDOM(['P1', 'P2', 'P3', 'synergy post', 'P5', 'P6'])

    doFeed({ ...baseConfig, 'feed-keywords': 'synergy' })

    const matched = Array.from(posts).find((p) => p.textContent.includes('synergy'))
    expect(matched.classList.contains('hide')).toBe(true)

    doFeed(baseConfig)

    expect(matched.classList.contains('hide')).toBe(false)
  })

  it('hides a previously visible post when a new matching keyword is added', () => {
    const posts = buildFeedDOM(['P1', 'P2', 'P3', 'synergy post', 'P5', 'P6'])

    doFeed(baseConfig)

    const matched = Array.from(posts).find((p) => p.textContent.includes('synergy'))
    expect(matched.classList.contains('hide')).toBe(false)

    doFeed({ ...baseConfig, 'feed-keywords': 'synergy' })

    expect(matched.classList.contains('hide')).toBe(true)
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

    doFeed({ ...baseConfig, 'feed-keywords': 'synergy' })

    const post = document.createElement('div')
    post.textContent = 'synergy post'
    document.querySelector('[data-lazy-mount-id]').appendChild(post)

    await Promise.resolve()

    expect(post.classList.contains('hide')).toBe(true)
  })

  it('hides posts inside an intermediate container added to the feed', async () => {
    document.body.innerHTML = `<div data-testid="mainFeed"></div>`

    doFeed({ ...baseConfig, 'feed-keywords': 'synergy' })

    const wrapper = document.createElement('div')
    wrapper.setAttribute('data-lazy-mount-id', 'b2')
    const post = document.createElement('div')
    post.textContent = 'synergy post'
    wrapper.appendChild(post)
    document.querySelector('[data-testid="mainFeed"]').appendChild(wrapper)

    await Promise.resolve()

    expect(post.classList.contains('hide')).toBe(true)
  })

  it('ignores text nodes added to the feed without throwing', async () => {
    document.body.innerHTML = `<div data-testid="mainFeed"></div>`

    doFeed({ ...baseConfig, 'feed-keywords': 'synergy' })

    document.querySelector('[data-testid="mainFeed"]').appendChild(document.createTextNode('  '))

    await Promise.resolve()

    expect(document.querySelectorAll('[data-hidden]').length).toBe(0)
  })

  it('retries connecting the observer when the feed container is not yet in the DOM', async () => {
    document.body.innerHTML = ''

    doFeed({ ...baseConfig, 'feed-keywords': 'synergy' })

    document.body.innerHTML = `
      <div data-testid="mainFeed">
        <div data-lazy-mount-id="b1" style="display:contents">
          <div>synergy post</div>
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
    const posts = buildLegacyFeedDOM(['Post 1', 'Post 2', 'Post 3', 'synergy post', 'Post 5', 'Post 6'])

    doFeed({ ...baseConfig, 'feed-keywords': 'synergy' })

    const matched = Array.from(posts).find((p) => p.textContent.includes('synergy'))
    expect(matched.classList.contains('hide')).toBe(true)
  })

  it('does not match posts when neither current nor legacy feed container is present', () => {
    document.body.innerHTML = '<div id="not-a-feed"><div><div>synergy post</div></div></div>'

    doFeed(baseConfig)

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

    doFeed({ ...baseConfig, 'feed-keywords': 'synergy' })

    await vi.advanceTimersByTimeAsync(1000)
    expect(spy).not.toHaveBeenCalled()
  })

  it('scrolls once after 1s when no posts are found', async () => {
    document.body.innerHTML = '<div data-testid="mainFeed"></div>'
    const spy = scrollBySpy()

    doFeed({ ...baseConfig, 'feed-keywords': 'synergy' })

    await vi.advanceTimersByTimeAsync(1000)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith({ top: window.innerHeight, behavior: 'smooth' })
  })

  it('scrolls a second time after 2s if posts are still absent', async () => {
    document.body.innerHTML = '<div data-testid="mainFeed"></div>'
    const spy = scrollBySpy()

    doFeed({ ...baseConfig, 'feed-keywords': 'synergy' })

    await vi.advanceTimersByTimeAsync(2000)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('stops scrolling after 2 attempts even if posts never appear', async () => {
    document.body.innerHTML = '<div data-testid="mainFeed"></div>'
    const spy = scrollBySpy()

    doFeed({ ...baseConfig, 'feed-keywords': 'synergy' })

    await vi.advanceTimersByTimeAsync(5000)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('cancels the scroll timer when the observer is disconnected', async () => {
    document.body.innerHTML = '<div data-testid="mainFeed"></div>'
    const spy = scrollBySpy()

    doFeed({ ...baseConfig, 'feed-keywords': 'synergy' })

    doFeed({ ...baseConfig, 'main-toggle': false })

    await vi.advanceTimersByTimeAsync(1000)
    expect(spy).not.toHaveBeenCalled()
  })
})
