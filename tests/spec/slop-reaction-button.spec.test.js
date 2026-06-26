// @vitest-environment jsdom
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest'
import { buildFeedDOM, CLEAN_POST } from './_helpers.js'

vi.mock('../../src/lib/transformers.min.js', () => ({
  pipeline: vi.fn(),
  env: { backends: { onnx: { wasm: {} } } },
}))

vi.mock('../../src/features/unfollow.js', () => ({
  unfollowAuthor: vi.fn().mockResolvedValue({}),
}))

const mockTrackSlopCollapsed = vi.fn()
const mockTrackAuthorBlocked = vi.fn()
const mockTrackManualSlopReaction = vi.fn()
vi.mock('../../src/stats.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    trackSlopCollapsed: mockTrackSlopCollapsed,
    trackAuthorBlocked: mockTrackAuthorBlocked,
    trackManualSlopReaction: mockTrackManualSlopReaction,
  }
})

// Minimal action bar matching LinkedIn's structure: Like button + "Open reactions menu" chevron
const REACTIONS_BAR = `
  <div class="action-bar">
    <div class="reaction-group">
      <button type="button" aria-label="Reaction button state: no reaction">👍</button>
      <button type="button" aria-label="Open reactions menu" aria-expanded="false">^</button>
    </div>
    <button type="button" aria-label="Comment">Comment</button>
  </div>
`

const POST_WITH_AUTHOR = `
  <a href="/in/john-doe/"><div aria-label="John Doe Profile 1st">John Doe</div></a>
  ${CLEAN_POST}
  ${REACTIONS_BAR}
`

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  mockTrackSlopCollapsed.mockReset()
  mockTrackAuthorBlocked.mockReset()
  mockTrackManualSlopReaction.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

// ---------------------------------------------------------------------------
// Requirement: AI Slop button is injected into the post action bar
// ---------------------------------------------------------------------------

it('Scenario: Button is injected next to reaction buttons when post is in feed', async () => {
  const { initSlopReaction } = await import('../../src/features/slop-reaction.js')
  const posts = buildFeedDOM([POST_WITH_AUTHOR, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])
  const feedContainer = document.querySelector('[data-testid="mainFeed"]')
  initSlopReaction(feedContainer, () => 'john-doe', () => 'John Doe')
  expect(posts[0].querySelector('.focusedin-slop-reaction-btn')).not.toBeNull()
})

it('Scenario: Button is not duplicated when initSlopReaction is called twice', async () => {
  const { initSlopReaction } = await import('../../src/features/slop-reaction.js')
  const posts = buildFeedDOM([POST_WITH_AUTHOR, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])
  const feedContainer = document.querySelector('[data-testid="mainFeed"]')
  initSlopReaction(feedContainer, () => 'john-doe', () => 'John Doe')
  initSlopReaction(feedContainer, () => 'john-doe', () => 'John Doe')
  expect(posts[0].querySelectorAll('.focusedin-slop-reaction-btn').length).toBe(1)
})

it('Scenario: Button injected via MutationObserver when reactions button added directly', async () => {
  const { initSlopReaction } = await import('../../src/features/slop-reaction.js')
  buildFeedDOM([])
  const feedContainer = document.querySelector('[data-testid="mainFeed"]')
  // Pre-add a group so we can later add the button directly (making the button the addedNode)
  const group = document.createElement('div')
  feedContainer.appendChild(group)
  initSlopReaction(feedContainer, () => 'jane', () => 'Jane')

  const btn = document.createElement('button')
  btn.setAttribute('aria-label', 'Open reactions menu')
  group.appendChild(btn)  // addedNodes=[btn] → node.matches(REACTIONS_BTN) = true (line 58)

  await Promise.resolve()
  // slopBtn is placed after group (group.after(slopBtn)), so it's a sibling in feedContainer
  expect(feedContainer.querySelector('.focusedin-slop-reaction-btn')).not.toBeNull()
})

it('Scenario: Button injected via MutationObserver when element containing reactions button added', async () => {
  const { initSlopReaction } = await import('../../src/features/slop-reaction.js')
  buildFeedDOM([])
  const feedContainer = document.querySelector('[data-testid="mainFeed"]')
  initSlopReaction(feedContainer, () => 'jane', () => 'Jane')

  const group = document.createElement('div')
  const btn = document.createElement('button')
  btn.setAttribute('aria-label', 'Open reactions menu')
  group.appendChild(btn)
  feedContainer.appendChild(group)  // addedNodes=[group] → else branch querySelectorAll (line 61)

  await Promise.resolve()
  expect(feedContainer.querySelector('.focusedin-slop-reaction-btn')).not.toBeNull()
})

it('Scenario: Button injected even when no post ancestor can be found', async () => {
  const { initSlopReaction } = await import('../../src/features/slop-reaction.js')
  document.body.innerHTML = '<div id="feed"></div>'
  const feedContainer = document.getElementById('feed')
  const group = document.createElement('div')
  const btn = document.createElement('button')
  btn.setAttribute('aria-label', 'Open reactions menu')
  group.appendChild(btn)
  feedContainer.appendChild(group)  // no data-urn / listitem → findPostAncestor returns null
  initSlopReaction(feedContainer, () => null, () => null)
  // slopBtn placed after group (group.after(slopBtn)) → sibling of group inside feedContainer
  const slopBtn = feedContainer.querySelector('.focusedin-slop-reaction-btn')
  expect(slopBtn).not.toBeNull()
  // Click when post is null: covers post ?? findPostAncestor(btn) fallback + if(target) false branch
  slopBtn.click()
  expect(mockTrackSlopCollapsed).toHaveBeenCalledWith(['manual'])
  expect(mockTrackManualSlopReaction).not.toHaveBeenCalled()
})

it('Scenario: No button injected when post has no reaction bar', async () => {
  const { initSlopReaction } = await import('../../src/features/slop-reaction.js')
  const posts = buildFeedDOM([CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])
  const feedContainer = document.querySelector('[data-testid="mainFeed"]')
  initSlopReaction(feedContainer, () => null, () => null)
  posts.forEach((post) => {
    expect(post.querySelector('.focusedin-slop-reaction-btn')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Requirement: Clicking AI Slop hides the post and records the event
// ---------------------------------------------------------------------------

describe('click handler', () => {
  let posts, btn

  beforeEach(async () => {
    const { initSlopReaction } = await import('../../src/features/slop-reaction.js')
    posts = buildFeedDOM([POST_WITH_AUTHOR, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])
    const feedContainer = document.querySelector('[data-testid="mainFeed"]')
    initSlopReaction(feedContainer, () => 'john-doe', () => 'John Doe')
    btn = posts[0].querySelector('.focusedin-slop-reaction-btn')
  })

  it('Scenario: Post is NOT hidden on click', () => {
    btn.click()
    expect(posts[0].classList.contains('hide')).toBe(false)
  })

  it('Scenario: Daily slop collapsed counter increments on click', () => {
    btn.click()
    expect(mockTrackSlopCollapsed).toHaveBeenCalledWith(['manual'])
  })

  it('Scenario: Author all-time count incremented in Hall of Shame store on click', () => {
    btn.click()
    expect(mockTrackManualSlopReaction).toHaveBeenCalledWith('john-doe', 'John Doe')
  })

  it('Scenario: trackAuthorBlocked is NOT called on click', () => {
    btn.click()
    expect(mockTrackAuthorBlocked).not.toHaveBeenCalled()
  })

  it('Scenario: Click on post with no extractable author does not throw', async () => {
    const { initSlopReaction } = await import('../../src/features/slop-reaction.js')
    // Build a second post with reactions bar but null author extractors
    const noAuthorPosts = buildFeedDOM([POST_WITH_AUTHOR])
    const feedContainer = document.querySelector('[data-testid="mainFeed"]')
    initSlopReaction(feedContainer, () => null, () => null)
    const noAuthorBtn = noAuthorPosts[0].querySelector('.focusedin-slop-reaction-btn')
    expect(() => noAuthorBtn?.click()).not.toThrow()
  })
})
