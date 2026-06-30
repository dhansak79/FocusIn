import { When, Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import {
  baseConfig,
  CLEAN_POST,
  SLOP_POST,
  SLOP_WITH_ACTOR,
} from '../screenplay/fixtures/posts.js'
import { BuildFeed } from '../screenplay/tasks/BuildFeed.js'
import { RunFeed } from '../screenplay/tasks/RunFeed.js'

const MANY_CLEAN = Array(5).fill(CLEAN_POST)
const CLEAN_NO_AUTHOR = CLEAN_POST

// ---------------------------------------------------------------------------
// Semantic match banner author
// ---------------------------------------------------------------------------

When('a post with no identifiable author is collapsed with a semantic match banner', async function () {
  this.setChromeMockResponses({ 'semantic-check': { score: 0.9, topic: 'hustle culture' } })
  this.attemptsTo(BuildFeed.with([CLEAN_NO_AUTHOR, ...MANY_CLEAN]))
  await this.attemptsTo(RunFeed.withConfig({ ...baseConfig, 'semantic-filter': 'hustle culture' }))
  this.collapsedPosts = this.document.querySelectorAll('[data-testid="mainFeed"] > div[data-lazy-mount-id] > div:not([data-focusin-injected])')
})

When('the post DOM contains an extractable author name', function () {
  // CLEAN_WITH_ACTOR has <a href="/in/jane-smith/"><div aria-label="Jane Smith Profile 1st">
})

Then(/the banner displays the author name in a `focusedin-slop-author` element below the signal row/, function () {
  const banner = this.collapsedPosts?.[0]?.previousElementSibling
  const authorEl = banner?.querySelector('.focusedin-slop-author')
  assert.ok(authorEl, 'focusedin-slop-author element should exist')
  assert.ok(authorEl?.textContent?.length > 0, 'author name should be displayed')
})

When('the post DOM does not contain an extractable author name', function () {
  // CLEAN_POST has no author link
})

Then('the banner renders without an author element', function () {
  const banner = this.collapsedPosts?.[0]?.previousElementSibling
  assert.ok(!banner?.querySelector('.focusedin-slop-author'), 'focusedin-slop-author should not be present')
})

// ---------------------------------------------------------------------------
// Pattern match banner author
// ---------------------------------------------------------------------------

When('a post with no identifiable author is collapsed with a pattern match banner', async function () {
  this.setChromeMockResponses({ 'slop-archetype-check': { score: 0.85, topic: 'archetype' } })
  this.attemptsTo(BuildFeed.with([CLEAN_NO_AUTHOR, ...MANY_CLEAN]))
  await this.attemptsTo(RunFeed.withConfig({ ...baseConfig, 'slop-archetype': true }))
  this.collapsedPosts = this.document.querySelectorAll('[data-testid="mainFeed"] > div[data-lazy-mount-id] > div:not([data-focusin-injected])')
})

// ---------------------------------------------------------------------------
// Pattern match headline and signal text
// ---------------------------------------------------------------------------

When('a post is collapsed due to structural slop detection', async function () {
  this.setChromeMockResponses({ 'slop-archetype-check': { score: 0.85, topic: 'archetype' } })
  this.attemptsTo(BuildFeed.with([CLEAN_POST, ...MANY_CLEAN]))
  await this.attemptsTo(RunFeed.withConfig({ ...baseConfig, 'slop-archetype': true }))
  this.collapsedPosts = this.document.querySelectorAll('[data-testid="mainFeed"] > div[data-lazy-mount-id] > div:not([data-focusin-injected])')
})

Then(/the banner headline reads "🎯 Pattern match"/, function () {
  const banner = this.collapsedPosts?.[0]?.previousElementSibling
  const headline = banner?.querySelector('.focusedin-slop-headline')?.textContent ?? ''
  assert.ok(headline.includes('🎯 Pattern match'), `expected "🎯 Pattern match" but got "${headline}"`)
})

Then(/the signal row reads "pattern match · N%" where N is the similarity percentage/, function () {
  const banner = this.collapsedPosts?.[0]?.previousElementSibling
  const signalText = banner?.querySelector('.focusedin-slop-signals')?.textContent ?? ''
  assert.match(signalText, /pattern match · \d+%/)
})

// ---------------------------------------------------------------------------
// Vanity name extraction
// ---------------------------------------------------------------------------

When('a post is collapsed into any banner type', async function () {
  this.attemptsTo(BuildFeed.with([SLOP_WITH_ACTOR, ...MANY_CLEAN]))
  await this.attemptsTo(RunFeed.withConfig({ ...baseConfig, 'detect-slop': true }))
  this.collapsedPosts = this.document.querySelectorAll('[data-testid="mainFeed"] > div[data-lazy-mount-id] > div:not([data-focusin-injected])')
})

When(/the post DOM contains a profile href in the form `\/in\/username\/`/, function () {
  // SLOP_WITH_ACTOR has <a href="/in/john-doe/">
})

Then(/the extracted vanity name is available to the banner for constructing the Unfollow request/, function () {
  const banner = this.collapsedPosts?.[0]?.previousElementSibling
  assert.ok(banner?.querySelector('.focusedin-unfollow-btn'), 'Unfollow button should be present (vanity name extracted)')
})

When('a post with no profile link is collapsed into any banner type', async function () {
  this.attemptsTo(BuildFeed.with([SLOP_POST, ...MANY_CLEAN]))
  await this.attemptsTo(RunFeed.withConfig({ ...baseConfig, 'detect-slop': true }))
  this.collapsedPosts = this.document.querySelectorAll('[data-testid="mainFeed"] > div[data-lazy-mount-id] > div:not([data-focusin-injected])')
})

When(/the post DOM does not contain an extractable `\/in\/username\/` href/, function () {
  // SLOP_POST has no profile link
})

Then(/vanity name extraction returns null and no Unfollow button is rendered/, function () {
  const banner = this.collapsedPosts?.[0]?.previousElementSibling
  assert.ok(!banner?.querySelector('.focusedin-unfollow-btn'), 'Unfollow button should not be present')
})

// ---------------------------------------------------------------------------
// Whitelist button
// ---------------------------------------------------------------------------

Then(/the banner displays a "Whitelist" button after the Unfollow button/, function () {
  const banner = this.collapsedPosts?.[0]?.previousElementSibling
  assert.ok(banner?.querySelector('.focusedin-trust-btn'), 'Trust author (whitelist) button should be present')
})

Then('the banner renders without a Whitelist button', function () {
  const banner = this.collapsedPosts?.[0]?.previousElementSibling
  assert.ok(!banner?.querySelector('.focusedin-trust-btn'), 'Trust button should not be present without vanity')
})

When('the user clicks the Whitelist button on a banner', async function () {
  this.attemptsTo(BuildFeed.with([SLOP_WITH_ACTOR, ...MANY_CLEAN]))
  await this.attemptsTo(RunFeed.withConfig({ ...baseConfig, 'detect-slop': true }))
  this.collapsedPosts = this.document.querySelectorAll('[data-testid="mainFeed"] > div[data-lazy-mount-id] > div:not([data-focusin-injected])')
  const banner = this.collapsedPosts[0].previousElementSibling
  banner?.querySelector('.focusedin-trust-btn')?.click()
})

Then(/the author is added to `author-whitelist` in storage/, function () {
  const whitelist = this.storageSets.findLast((s) => 'author-whitelist' in s)?.['author-whitelist'] ?? []
  assert.ok(whitelist.some((e) => e.vanity === 'john-doe'), 'john-doe should be in whitelist')
})

Then(/the collapsed post is revealed \(soft-hide class removed\)/, function () {
  this.clock.tick(700)
  const post = this.collapsedPosts?.[0]
  assert.ok(!post?.classList.contains('focusedin-slop-soft-hide'), 'post should be revealed')
})

Then(/the banner is removed from the DOM/, function () {
  const banner = this.collapsedPosts?.[0]?.previousElementSibling
  assert.ok(!banner?.classList.contains('focusedin-slop-collapsed'), 'banner should be removed')
})

When('the Whitelist button is clicked', async function () {
  this.attemptsTo(BuildFeed.with([SLOP_WITH_ACTOR, ...MANY_CLEAN]))
  await this.attemptsTo(RunFeed.withConfig({ ...baseConfig, 'detect-slop': true }))
  this.collapsedPosts = this.document.querySelectorAll('[data-testid="mainFeed"] > div[data-lazy-mount-id] > div:not([data-focusin-injected])')
  const banner = this.collapsedPosts[0].previousElementSibling
  this.whitelistBanner = banner
  banner?.querySelector('.focusedin-trust-btn')?.click()
})

Then(/the button briefly shows "Whitelisted ✓" before the banner is removed/, function () {
  const btn = this.whitelistBanner?.querySelector('.focusedin-trust-btn')
  assert.equal(btn?.textContent, 'Trusted ✓', 'button should show Trusted ✓ immediately after click')
  this.clock.tick(700)
  assert.ok(!this.whitelistBanner?.isConnected, 'banner should be removed after delay')
})
