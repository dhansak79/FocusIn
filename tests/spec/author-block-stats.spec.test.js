// @vitest-environment jsdom
import { vi, beforeEach, afterEach, it, expect } from 'vitest'
import { buildFeedDOM, baseConfig, CLEAN_POST, SLOP_POST, SLOP_WITH_ACTOR, makeChromeStub } from './_helpers.js'

vi.mock('../../src/lib/transformers.min.js', () => ({
  pipeline: vi.fn(),
  env: { backends: { onnx: { wasm: {} } } },
}))

vi.mock('../../src/features/unfollow.js', () => ({
  unfollowAuthor: vi.fn().mockResolvedValue({}),
}))

const mockTrackAuthorBlocked = vi.fn()
vi.mock('../../src/stats.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, trackAuthorBlocked: mockTrackAuthorBlocked }
})

let doFeed

beforeEach(async () => {
  vi.resetModules()
  vi.useFakeTimers()
  mockTrackAuthorBlocked.mockReset()
  doFeed = (await import('../../src/features/feed.js')).default
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const POST_WITH_AUTHOR = `<a href="/in/grace-hopper/"><strong>Grace Hopper</strong></a>${CLEAN_POST}`
const SLOP_WITH_NAMED_ACTOR = `<a href="/in/john-doe/"><div aria-label="John Doe Profile 2nd">John Doe</div></a><br>${SLOP_POST}`

// ---------------------------------------------------------------------------
// Requirement: Per-author block count is tracked in daily storage
// ---------------------------------------------------------------------------

it('Scenario: Block count increments on pattern match collapse', () => {
  vi.stubGlobal('chrome', makeChromeStub({ 'slop-archetype-check': { score: 0.85, topic: 'archetype' } }))
  buildFeedDOM([SLOP_WITH_NAMED_ACTOR])
  doFeed({ ...baseConfig, 'slop-archetype': true })
  vi.advanceTimersByTime(350)
  expect(mockTrackAuthorBlocked).toHaveBeenCalledWith('john-doe', 'John Doe')
})

it('Scenario: Block count increments on semantic match collapse', () => {
  vi.stubGlobal('chrome', makeChromeStub({ 'semantic-check': { score: 0.9, topic: 'hustle culture' } }))
  buildFeedDOM([POST_WITH_AUTHOR])
  doFeed({ ...baseConfig, 'semantic-filter': 'hustle culture' })
  vi.advanceTimersByTime(350)
  expect(mockTrackAuthorBlocked).toHaveBeenCalledWith('grace-hopper', 'Grace Hopper')
})

it('Scenario: Block count increments on topic filter (keyword match)', () => {
  vi.stubGlobal('chrome', makeChromeStub())
  buildFeedDOM([`<a href="/in/grace-hopper/"><strong>Grace Hopper</strong></a>banned-word content here`])
  doFeed({ ...baseConfig, 'feed-keywords': 'banned-word' })
  vi.advanceTimersByTime(350)
  expect(mockTrackAuthorBlocked).toHaveBeenCalledWith('grace-hopper', 'Grace Hopper')
})

it('Scenario: Block count falls back to display name as key', () => {
  vi.stubGlobal('chrome', makeChromeStub({ 'slop-archetype-check': { score: 0.85, topic: 'archetype' } }))
  // Post with display name via Follow button but no profile href
  const noVanityPost = `<button aria-label="Follow Jane Smith">Follow</button>${SLOP_POST}`
  buildFeedDOM([noVanityPost])
  doFeed({ ...baseConfig, 'slop-archetype': true })
  vi.advanceTimersByTime(350)
  expect(mockTrackAuthorBlocked).toHaveBeenCalledWith(null, 'Jane Smith')
})

it('Scenario: Silent skip when neither name is available', () => {
  vi.stubGlobal('chrome', makeChromeStub())
  // SLOP_POST has no author identity
  buildFeedDOM([SLOP_POST, SLOP_POST, SLOP_POST, SLOP_POST, SLOP_POST, SLOP_POST])
  doFeed({ ...baseConfig, 'detect-slop': true })
  vi.advanceTimersByTime(350)
  expect(mockTrackAuthorBlocked).toHaveBeenCalledWith(null, null)
})

it('Scenario: Block count increments on promoted-post filter', () => {
  buildFeedDOM([`<a href="/in/grace-hopper/"><div aria-label="Grace Hopper Profile 1st">Grace Hopper</div></a><p><span>Promoted</span></p><p data-testid="expandable-text-box">Ad content</p>`, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST, CLEAN_POST])
  doFeed({ ...baseConfig, 'hide-promoted': true })
  vi.advanceTimersByTime(350)
  expect(mockTrackAuthorBlocked).toHaveBeenCalledWith('grace-hopper', 'Grace Hopper')
})

it('Scenario: Block count increments on slop detection (pattern/keyword)', () => {
  vi.stubGlobal('chrome', makeChromeStub())
  buildFeedDOM([SLOP_WITH_ACTOR, SLOP_POST, SLOP_POST, SLOP_POST, SLOP_POST, SLOP_POST])
  doFeed({ ...baseConfig, 'detect-slop': true })
  vi.advanceTimersByTime(350)
  expect(mockTrackAuthorBlocked).toHaveBeenCalledWith('john-doe', expect.any(String))
})
