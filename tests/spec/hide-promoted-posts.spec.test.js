// @vitest-environment jsdom
import { vi, beforeEach, afterEach, it, expect } from 'vitest'
import { buildFeedDOM, baseConfig, CLEAN_POST } from './_helpers.js'

vi.mock('../../src/lib/transformers.min.js', () => ({
  pipeline: vi.fn(),
  env: { backends: { onnx: { wasm: {} } } },
}))

vi.mock('../../src/features/unfollow.js', () => ({
  unfollowAuthor: vi.fn().mockResolvedValue({}),
}))

const mockTrackPostFiltered = vi.fn()
const mockTrackAuthorBlocked = vi.fn()
vi.mock('../../src/stats.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, trackPostFiltered: mockTrackPostFiltered, trackAuthorBlocked: mockTrackAuthorBlocked }
})

let doFeed

beforeEach(async () => {
  vi.resetModules()
  vi.useFakeTimers()
  mockTrackPostFiltered.mockReset()
  mockTrackAuthorBlocked.mockReset()
  doFeed = (await import('../../src/features/feed.js')).default
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// A promoted post: "Promoted" appears in a standalone <p> before the text box.
const PROMOTED_POST = `
  <p><span>Promoted</span></p>
  <p data-testid="expandable-text-box">Buy our amazing product now!</p>
`

// A promoted post with no expandable-text-box (image-only / video ad).
const PROMOTED_POST_NO_TEXTBOX = `
  <p><span>Promoted</span></p>
  <img src="ad.jpg" alt="Advertisement">
`

// A promoted post with an extractable author (vanity: grace-hopper).
const PROMOTED_POST_WITH_AUTHOR = `
  <a href="/in/grace-hopper/"><div aria-label="Grace Hopper Profile 1st">Grace Hopper</div></a>
  <p><span>Promoted</span></p>
  <p data-testid="expandable-text-box">Buy our amazing product now!</p>
`

// "Promoted" only appears inside the expandable text box (post body) — not a sponsored post.
const POST_WITH_PROMOTED_IN_BODY = `
  <p data-testid="expandable-text-box">Our campaign was Promoted across all channels this quarter.</p>
`

// ---------------------------------------------------------------------------
// Requirement: Promoted posts are hidden when toggle is on
// ---------------------------------------------------------------------------

it('Scenario: Promoted post is hidden immediately when toggle is on', () => {
  const posts = buildFeedDOM([PROMOTED_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

  doFeed({ ...baseConfig, 'hide-promoted': true })

  expect(posts[0].classList.contains('hide')).toBe(true)
})

it('Scenario: Non-promoted post is not affected by promoted filter', () => {
  const posts = buildFeedDOM([CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

  doFeed({ ...baseConfig, 'hide-promoted': true })

  posts.forEach((p) => expect(p.classList.contains('hide')).toBe(false))
})

it('Scenario: Post with "Promoted" only in body text is not hidden', () => {
  const posts = buildFeedDOM([
    POST_WITH_PROMOTED_IN_BODY,
    CLEAN_POST,
    CLEAN_POST,
    CLEAN_POST,
    CLEAN_POST,
    CLEAN_POST,
  ])

  doFeed({ ...baseConfig, 'hide-promoted': true })

  expect(posts[0].classList.contains('hide')).toBe(false)
})

it('Scenario: Promoted post is not hidden when toggle is off', () => {
  const posts = buildFeedDOM([PROMOTED_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

  doFeed({ ...baseConfig, 'hide-promoted': false })

  expect(posts[0].classList.contains('hide')).toBe(false)
})

// ---------------------------------------------------------------------------
// Requirement: Promoted posts reappear when toggle is turned off
// ---------------------------------------------------------------------------

it('Scenario: Promoted posts reappear when toggle is turned off', () => {
  const posts = buildFeedDOM([PROMOTED_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

  doFeed({ ...baseConfig, 'hide-promoted': true })
  expect(posts[0].classList.contains('hide')).toBe(true)

  doFeed({ ...baseConfig, 'hide-promoted': false })
  expect(posts[0].classList.contains('hide')).toBe(false)
})

// ---------------------------------------------------------------------------
// Requirement: Image-only promoted post is hidden
// ---------------------------------------------------------------------------

it('Scenario: Image-only promoted post is hidden (no expandable-text-box)', () => {
  const posts = buildFeedDOM([PROMOTED_POST_NO_TEXTBOX, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

  doFeed({ ...baseConfig, 'hide-promoted': true })

  expect(posts[0].classList.contains('hide')).toBe(true)
})

// ---------------------------------------------------------------------------
// Requirement: Hidden promoted posts are counted in daily stats
// ---------------------------------------------------------------------------

it('Scenario: Promoted hide increments filtered counter', () => {
  buildFeedDOM([PROMOTED_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

  doFeed({ ...baseConfig, 'hide-promoted': true })

  expect(mockTrackPostFiltered).toHaveBeenCalledTimes(1)
})

it('Scenario: Promoted hide records author in blocked-authors map', () => {
  buildFeedDOM([PROMOTED_POST_WITH_AUTHOR, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])

  doFeed({ ...baseConfig, 'hide-promoted': true })

  expect(mockTrackAuthorBlocked).toHaveBeenCalledWith('grace-hopper', 'Grace Hopper')
})
