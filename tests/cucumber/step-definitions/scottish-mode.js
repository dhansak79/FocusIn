import { Given, When, Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { baseConfig, CLEAN_POST, SLOP_POST } from '../screenplay/fixtures/posts.js'
import { BuildFeed } from '../screenplay/tasks/BuildFeed.js'
import { RunFeed } from '../screenplay/tasks/RunFeed.js'
import { PostContent } from '../screenplay/questions/PostContent.js'

const MANY_CLEAN = Array(5).fill(CLEAN_POST)
const REWRITTEN_TEXT = "Aye, we shipped somethin' new the day. The team's chuffed wi' the work, nae messin'."

const mergeConfig = (world, overrides) => {
  world.feedConfig = { ...(world.feedConfig ?? baseConfig), ...overrides }
}

const feedPosts = (world) =>
  world.document.querySelectorAll('[data-testid="mainFeed"] > div[data-lazy-mount-id] > div:not([data-focusin-injected])')

// ---------------------------------------------------------------------------
// Given: mode toggles
// ---------------------------------------------------------------------------

Given('scottish-mode is enabled in extension settings', function () {
  mergeConfig(this, { 'scottish-mode': true })
})

Given('scottish-mode is enabled', function () {
  mergeConfig(this, { 'scottish-mode': true })
})

Given(/scottish-mode is disabled \(the default\)/, function () {
  mergeConfig(this, { 'scottish-mode': false })
})

// ---------------------------------------------------------------------------
// Given: post fixtures
// ---------------------------------------------------------------------------

Given('a LinkedIn feed post is flagged as slop by the existing detection signals', function () {
  mergeConfig(this, { 'detect-slop': true })
  this.setChromeMockResponses({ 'scottish-rewrite': { text: REWRITTEN_TEXT } })
  this.attemptsTo(BuildFeed.with([SLOP_POST, ...MANY_CLEAN]))
})

Given(/a post is flagged by the semantic or tone filter \(not the keyword\/slop path\)/, function () {
  mergeConfig(this, { 'tone-filter': true, 'tone-threshold': 70 })
  this.setChromeMockResponses({
    'tone-check': { score: 0.9, label: 'NEGATIVE' },
    'scottish-rewrite': { text: REWRITTEN_TEXT },
  })
  this.attemptsTo(BuildFeed.with(MANY_CLEAN))
})

Given(/a post matches a user's keyword filter \(previously handled by hidePost\(\)\)/, function () {
  mergeConfig(this, { 'feed-keywords': 'shipped' })
  this.setChromeMockResponses({ 'scottish-rewrite': { text: REWRITTEN_TEXT } })
  this.attemptsTo(BuildFeed.with([CLEAN_POST, ...MANY_CLEAN]))
})

Given('a post has been replaced with a Scottish-dialect rewrite', async function () {
  mergeConfig(this, { 'feed-keywords': 'shipped', 'scottish-mode': true })
  this.setChromeMockResponses({ 'scottish-rewrite': { text: REWRITTEN_TEXT } })
  this.attemptsTo(BuildFeed.with([CLEAN_POST, ...MANY_CLEAN]))
  await this.attemptsTo(RunFeed.withConfig(this.feedConfig))
})

Given(/a post is flagged by any existing detection path \(keyword, slop, semantic, tone\)/, function () {
  mergeConfig(this, { 'detect-slop': true })
  this.setChromeMockResponses({ 'scottish-rewrite': { text: REWRITTEN_TEXT } })
  this.attemptsTo(BuildFeed.with([SLOP_POST, ...MANY_CLEAN]))
})

Given('a post does not match any flagging signal', function () {
  this.setChromeMockResponses({ 'scottish-rewrite': { text: REWRITTEN_TEXT } })
  this.attemptsTo(BuildFeed.with(MANY_CLEAN))
})

Given('the local rewrite model has not finished loading or fails to produce output', function () {
  mergeConfig(this, { 'detect-slop': true })
  // No 'scottish-rewrite' key registered — the mock falls through to its
  // default `{ score: 0 }` response, which has no `.text`, simulating a
  // model that hasn't produced usable output.
  this.setChromeMockResponses({})
  this.attemptsTo(BuildFeed.with([SLOP_POST, ...MANY_CLEAN]))
})

Given(/the feed already contains posts collapsed by the existing banner\/hide treatments/, async function () {
  mergeConfig(this, { 'detect-slop': true, 'scottish-mode': false })
  this.setChromeMockResponses({})
  this.attemptsTo(BuildFeed.with([SLOP_POST, ...MANY_CLEAN]))
  await this.attemptsTo(RunFeed.withConfig(this.feedConfig))
  this.originalPostNode = feedPosts(this)[0]
})

// ---------------------------------------------------------------------------
// When
// ---------------------------------------------------------------------------

When('the feed processes that post', async function () {
  await this.attemptsTo(RunFeed.withConfig(this.feedConfig))
})

When('a flagged post is processed', async function () {
  await this.attemptsTo(RunFeed.withConfig(this.feedConfig))
})

When('the user clicks the "Translated — Scottish mode" tag', function () {
  const card = feedPosts(this)[0].previousElementSibling
  const btn = card?.querySelector('.focusedin-scottish-reveal-btn')
  assert.ok(btn, 'Show original button should exist before clicking')
  btn.click()
})

When('the user enables scottish-mode from the popup', async function () {
  mergeConfig(this, { 'scottish-mode': true })
  this.setChromeMockResponses({ 'scottish-rewrite': { text: REWRITTEN_TEXT } })
  await this.attemptsTo(RunFeed.withConfig(this.feedConfig))
})

// ---------------------------------------------------------------------------
// Then
// ---------------------------------------------------------------------------

Then('the post body is replaced in-place with a locally-generated Scottish-dialect rewrite', function () {
  const { text } = PostContent.of(0).answeredBy(this)
  assert.equal(text, REWRITTEN_TEXT)
})

Then('a "Translated — Scottish mode" tag is shown next to the rewritten text', function () {
  const card = feedPosts(this)[0].previousElementSibling
  assert.ok(card?.classList.contains('focusedin-scottish-rewrite'), 'Scottish rewrite card should be present')
  const headline = card.querySelector('.focusedin-scottish-headline')
  assert.match(headline?.textContent ?? '', /Translated — Scottish mode/)
})

Then('no reveal-banner or collapse-banner is shown for that post', function () {
  const banner = feedPosts(this)[0].previousElementSibling
  assert.ok(!banner?.classList.contains('focusedin-slop-collapsed'), 'no slop/semantic banner should exist for this post')
})

Then('the post body is replaced with a Scottish-dialect rewrite in the same DOM position', function () {
  const { text } = PostContent.of(0).answeredBy(this)
  assert.equal(text, REWRITTEN_TEXT)
})

Then(/the semantic\/tone collapse-banner UI is not rendered for that post/, function () {
  const banner = feedPosts(this)[0].previousElementSibling
  assert.ok(!banner?.classList.contains('focusedin-slop-collapsed'), 'no semantic/tone banner should exist for this post')
})

Then('the post body is replaced with a Scottish-dialect rewrite', function () {
  const { text } = PostContent.of(0).answeredBy(this)
  assert.equal(text, REWRITTEN_TEXT)
})

Then('the post is not hidden behind a click-to-reveal placeholder', function () {
  assert.ok(!feedPosts(this)[0].classList.contains('hide'), 'post should not carry the keyword-hide class')
})

Then('the original, unmodified post text is shown', function () {
  const { text, isRewritten } = PostContent.of(0).answeredBy(this)
  assert.equal(text, CLEAN_POST)
  assert.ok(isRewritten, 'post should still be tracked as scottish-rewritten while original is shown')
})

Then('the user can collapse back to the rewritten version', function () {
  const tag = feedPosts(this)[0].previousElementSibling
  assert.ok(tag?.classList.contains('focusedin-scottish-tag'), 'collapsed tag should be present before clicking back')
  tag.click()
  const { text } = PostContent.of(0).answeredBy(this)
  assert.equal(text, REWRITTEN_TEXT)
})

Then('the existing reveal-banner, collapse-banner, or hide behavior is shown exactly as before', function () {
  const banner = feedPosts(this)[0].previousElementSibling
  assert.ok(banner?.classList.contains('focusedin-slop-collapsed'), 'slop banner should still appear when scottish-mode is off')
})

Then('no Scottish-dialect rewrite is generated or displayed', function () {
  assert.ok(!this.document.querySelector('.focusedin-scottish-rewrite, .focusedin-scottish-tag'), 'no scottish card should be rendered')
  const { text } = PostContent.of(0).answeredBy(this)
  assert.notEqual(text, REWRITTEN_TEXT)
})

Then('the post is shown unmodified', function () {
  const { text } = PostContent.of(0).answeredBy(this)
  assert.equal(text, CLEAN_POST)
})

Then('no rewrite, banner, or hide treatment is applied', function () {
  const post = feedPosts(this)[0]
  assert.ok(!post.classList.contains('hide'), 'clean post should not be hidden')
  assert.ok(!post.classList.contains('focusedin-slop-soft-hide'), 'clean post should not be soft-hidden')
  assert.ok(!post.previousElementSibling, 'no banner/tag sibling should be inserted')
})

Then(/the post falls back to its existing \(non-Scottish-mode\) treatment for that flag type/, function () {
  const banner = feedPosts(this)[0].previousElementSibling
  assert.ok(banner?.classList.contains('focusedin-slop-collapsed'), 'fallback slop banner should be shown when the rewrite is unavailable')
})

Then('no broken or empty post body is left in the feed', function () {
  const { text } = PostContent.of(0).answeredBy(this)
  assert.ok(text && text.trim().length > 0, 'post body should not be empty')
})

Then('previously flagged, still-visible collapsed posts are re-rendered as Scottish-dialect rewrites', function () {
  assert.ok(!this.document.querySelector('.focusedin-slop-collapsed'), 'old slop banner should be replaced')
  const { text } = PostContent.of(0).answeredBy(this)
  assert.equal(text, REWRITTEN_TEXT)
})

Then('this re-render does not require a page reload', function () {
  const post = feedPosts(this)[0]
  assert.equal(post, this.originalPostNode, 'the same DOM node should be updated in place, not rebuilt')
})
