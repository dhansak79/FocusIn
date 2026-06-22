// @vitest-environment jsdom
import { vi, beforeEach, afterEach, it, expect } from 'vitest'
import { buildFeedDOM, baseConfig, CLEAN_POST, SLOP_POST, makeChromeStub } from './_helpers.js'

vi.mock('../../src/lib/transformers.min.js', () => ({
  pipeline: vi.fn(),
  env: { backends: { onnx: { wasm: {} } } },
}))

vi.mock('../../src/features/unfollow.js', () => ({
  unfollowAuthor: vi.fn().mockResolvedValue({}),
}))

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

const POST_WITH_AUTHOR = `<a href="/in/grace-hopper/"><strong>Grace Hopper</strong></a>${CLEAN_POST}`
const POST_WITHOUT_AUTHOR = CLEAN_POST
const SLOP_WITH_AUTHOR = `<a href="/in/john-doe/"><div aria-label="John Doe Profile 2nd">John Doe</div></a><br>${SLOP_POST}`
const SLOP_WITH_DEGREE_ACTOR = `<a href="/in/john-doe/"><div aria-label="John Doe 2nd+">John Doe</div></a><br>${SLOP_POST}`
const SLOP_WITH_PREMIUM_ACTOR = `<a href="/in/grace-hopper/"><div aria-label="Grace Hopper Premium Profile 2nd+">Grace Hopper</div></a><br>${SLOP_POST}`

// ---------------------------------------------------------------------------
// Requirement: Semantic match banner shows author name
// ---------------------------------------------------------------------------

it('Scenario: Author available on semantic match banner', () => {
  vi.stubGlobal('chrome', makeChromeStub({ 'semantic-check': { score: 0.9, topic: 'hustle culture' } }))
  const posts = buildFeedDOM([POST_WITH_AUTHOR])
  doFeed({ ...baseConfig, 'semantic-filter': 'hustle culture' })
  vi.advanceTimersByTime(350)
  const authorEl = posts[0].previousElementSibling?.querySelector('.focusedin-slop-author')
  expect(authorEl).not.toBeNull()
  expect(authorEl?.textContent).toContain('Grace Hopper')
})

it('Scenario: No author available on semantic match banner', () => {
  vi.stubGlobal('chrome', makeChromeStub({ 'semantic-check': { score: 0.9, topic: 'hustle culture' } }))
  const posts = buildFeedDOM([POST_WITHOUT_AUTHOR])
  doFeed({ ...baseConfig, 'semantic-filter': 'hustle culture' })
  vi.advanceTimersByTime(350)
  expect(posts[0].previousElementSibling?.querySelector('.focusedin-slop-author')).toBeNull()
})

// ---------------------------------------------------------------------------
// Requirement: Pattern match banner shows author name
// ---------------------------------------------------------------------------

it('Scenario: Author available on pattern match banner', () => {
  vi.stubGlobal('chrome', makeChromeStub({ 'slop-archetype-check': { score: 0.85, topic: 'archetype' } }))
  const posts = buildFeedDOM([POST_WITH_AUTHOR])
  doFeed({ ...baseConfig, 'slop-archetype': true })
  vi.advanceTimersByTime(350)
  const authorEl = posts[0].previousElementSibling?.querySelector('.focusedin-slop-author')
  expect(authorEl).not.toBeNull()
  expect(authorEl?.textContent).toContain('Grace Hopper')
})

// ---------------------------------------------------------------------------
// Requirement: Pattern match label replaces structural slop label
// ---------------------------------------------------------------------------

it('Scenario: Pattern match headline', () => {
  vi.stubGlobal('chrome', makeChromeStub({ 'slop-archetype-check': { score: 0.85, topic: 'archetype' } }))
  const posts = buildFeedDOM([CLEAN_POST])
  doFeed({ ...baseConfig, 'slop-archetype': true })
  vi.advanceTimersByTime(350)
  const headline = posts[0].previousElementSibling?.querySelector('.focusedin-slop-headline')?.textContent ?? ''
  expect(headline).toMatch(/🎯 Pattern match/)
})

// ---------------------------------------------------------------------------
// Requirement: Author vanity name extracted alongside display name
// ---------------------------------------------------------------------------

it('Scenario: Vanity name extracted when profile link present', () => {
  vi.stubGlobal('chrome', makeChromeStub())
  // SLOP_WITH_AUTHOR has /in/john-doe/ link — vanity extracted → Unfollow button rendered
  const posts = buildFeedDOM([SLOP_WITH_AUTHOR, SLOP_POST, SLOP_POST, SLOP_POST, SLOP_POST, SLOP_POST])
  doFeed({ ...baseConfig, 'detect-slop': true })
  vi.advanceTimersByTime(350)
  const banner = posts[0].previousElementSibling
  expect(banner?.querySelector('.focusedin-unfollow-btn')).not.toBeNull()
})

it('Scenario: Vanity name absent when no profile link in DOM', () => {
  vi.stubGlobal('chrome', makeChromeStub())
  const posts = buildFeedDOM([SLOP_POST, SLOP_POST, SLOP_POST, SLOP_POST, SLOP_POST, SLOP_POST])
  doFeed({ ...baseConfig, 'detect-slop': true })
  vi.advanceTimersByTime(350)
  const banner = posts[0].previousElementSibling
  expect(banner?.querySelector('.focusedin-unfollow-btn')).toBeNull()
})

// ---------------------------------------------------------------------------
// Requirement: Author name in slop banner stripped of LinkedIn degree suffix
// ---------------------------------------------------------------------------

it('Scenario: Author name stripped of LinkedIn degree suffix', () => {
  vi.stubGlobal('chrome', makeChromeStub())
  const posts = buildFeedDOM([SLOP_WITH_DEGREE_ACTOR, SLOP_POST, SLOP_POST, SLOP_POST, SLOP_POST, SLOP_POST])
  doFeed({ ...baseConfig, 'detect-slop': true })
  vi.advanceTimersByTime(350)
  const authorEl = posts[0].previousElementSibling?.querySelector('.focusedin-slop-author')
  expect(authorEl?.textContent).toBe('John Doe')
})

it('Scenario: Author name stripped of Premium and degree suffix', () => {
  vi.stubGlobal('chrome', makeChromeStub())
  const posts = buildFeedDOM([SLOP_WITH_PREMIUM_ACTOR, SLOP_POST, SLOP_POST, SLOP_POST, SLOP_POST, SLOP_POST])
  doFeed({ ...baseConfig, 'detect-slop': true })
  vi.advanceTimersByTime(350)
  const authorEl = posts[0].previousElementSibling?.querySelector('.focusedin-slop-author')
  expect(authorEl?.textContent).toBe('Grace Hopper')
})

// ---------------------------------------------------------------------------
// Requirement: Slop banner omits author element when no author found
// ---------------------------------------------------------------------------

it('Scenario: No author on slop detection banner when no profile link', () => {
  vi.stubGlobal('chrome', makeChromeStub())
  const posts = buildFeedDOM([SLOP_POST, SLOP_POST, SLOP_POST, SLOP_POST, SLOP_POST, SLOP_POST])
  doFeed({ ...baseConfig, 'detect-slop': true })
  vi.advanceTimersByTime(350)
  expect(posts[0].previousElementSibling?.querySelector('.focusedin-slop-author')).toBeNull()
})

// ---------------------------------------------------------------------------
// Requirement: Already-revealed posts are not re-collapsed
// ---------------------------------------------------------------------------

it('Scenario: Already-revealed post is not re-collapsed', () => {
  vi.stubGlobal('chrome', makeChromeStub())
  const posts = buildFeedDOM([SLOP_POST, SLOP_POST, SLOP_POST, SLOP_POST, SLOP_POST, SLOP_POST])
  posts[0].dataset.slopRevealed = 'true'
  doFeed({ ...baseConfig, 'detect-slop': true })
  vi.advanceTimersByTime(350)
  expect(posts[0].previousElementSibling?.classList.contains('focusedin-slop-collapsed')).toBeFalsy()
})

// ---------------------------------------------------------------------------
// Requirement: Slop post is marked hidden for downstream observers
// ---------------------------------------------------------------------------

it('Scenario: Slop post is marked as hidden', () => {
  vi.stubGlobal('chrome', makeChromeStub())
  const posts = buildFeedDOM([SLOP_POST, SLOP_POST, SLOP_POST, SLOP_POST, SLOP_POST, SLOP_POST])
  doFeed({ ...baseConfig, 'detect-slop': true })
  vi.advanceTimersByTime(350)
  expect(posts[0].dataset.hidden).toBe('true')
})

