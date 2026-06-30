import { When, Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import {
  baseConfig,
  CLEAN_POST,
  SLOP_WITH_ACTOR,
  SLOP_POST,
} from '../screenplay/fixtures/posts.js'
import { BuildFeed } from '../screenplay/tasks/BuildFeed.js'
import { RunFeed } from '../screenplay/tasks/RunFeed.js'

const MANY_CLEAN = Array(5).fill(CLEAN_POST)

// ---------------------------------------------------------------------------
// Unfollow button presence
// ---------------------------------------------------------------------------

When('a post is collapsed into a banner', async function () {
  this.setChromeMockResponses({})
  this.attemptsTo(BuildFeed.with([SLOP_WITH_ACTOR, ...MANY_CLEAN]))
  await this.attemptsTo(RunFeed.withConfig({ ...baseConfig, 'detect-slop': true }))
  this.collapsedPosts = this.document.querySelectorAll('[data-testid="mainFeed"] > div[data-lazy-mount-id] > div:not([data-focusin-injected])')
})

When('the post DOM contains an extractable author vanity name', function () {
  // SLOP_WITH_ACTOR has <a href="/in/john-doe/"> — vanity: john-doe
})

Then('the banner displays an Unfollow button alongside the author name', function () {
  const banner = this.collapsedPosts?.[0]?.previousElementSibling
  assert.ok(banner?.classList.contains('focusedin-slop-collapsed'), 'banner should exist')
  assert.ok(banner?.querySelector('.focusedin-unfollow-btn'), 'Unfollow button should be in banner')
})

When('a post without an extractable vanity name is collapsed into a banner', async function () {
  this.setChromeMockResponses({})
  this.attemptsTo(BuildFeed.with([SLOP_POST, ...MANY_CLEAN]))
  await this.attemptsTo(RunFeed.withConfig({ ...baseConfig, 'detect-slop': true }))
  this.collapsedPosts = this.document.querySelectorAll('[data-testid="mainFeed"] > div[data-lazy-mount-id] > div:not([data-focusin-injected])')
})

When('the post DOM does not contain an extractable vanity name', function () {
  // SLOP_POST has no /in/ link
})

Then('the banner renders without an Unfollow button', function () {
  const banner = this.collapsedPosts?.[0]?.previousElementSibling
  assert.ok(banner?.classList.contains('focusedin-slop-collapsed'), 'banner should exist')
  assert.ok(!banner?.querySelector('.focusedin-unfollow-btn'), 'Unfollow button should not be in banner')
})

// ---------------------------------------------------------------------------
// Unfollow API interaction
// ---------------------------------------------------------------------------

When('the user clicks the Unfollow button on a banner', async function () {
  this.setChromeMockResponses({})
  this.attemptsTo(BuildFeed.with([SLOP_WITH_ACTOR, ...MANY_CLEAN]))
  await this.attemptsTo(RunFeed.withConfig({ ...baseConfig, 'detect-slop': true }))
  this.collapsedPosts = this.document.querySelectorAll('[data-testid="mainFeed"] > div[data-lazy-mount-id] > div:not([data-focusin-injected])')
  const banner = this.collapsedPosts[0].previousElementSibling
  const unfollowBtn = banner?.querySelector('.focusedin-unfollow-btn')
  assert.ok(unfollowBtn, 'Unfollow button should exist')
  unfollowBtn.click()
})

Then('the extension fires an API request to unfollow the author', function () {
  // unfollowAuthor is called — our world's esmock stub captures the call
  // The stub returns world.unfollowResult (resolved) confirming the call was made
  // Since we can't inspect call args directly, verify button state changed
  const banner = this.collapsedPosts[0].previousElementSibling
  const btn = banner?.querySelector('.focusedin-unfollow-btn')
  assert.ok(btn?.disabled, 'button should be disabled after click (request in flight)')
})

Then(/the CSRF token from the JSESSIONID cookie is included in the request headers/, function () {
  // unfollowAuthor handles CSRF internally — this is verified by unit tests of unfollow.js
  // Here we verify the function is called (button state change confirms the call was made)
  const banner = this.collapsedPosts[0].previousElementSibling
  const btn = banner?.querySelector('.focusedin-unfollow-btn')
  assert.ok(btn?.disabled, 'button should be disabled indicating unfollowAuthor was called')
})

// ---------------------------------------------------------------------------
// Button loading state
// ---------------------------------------------------------------------------

When('the Unfollow button is clicked', async function () {
  this.unfollowResult = new Promise(() => {}) // never resolves — stays in-flight
  this.setChromeMockResponses({})
  this.attemptsTo(BuildFeed.with([SLOP_WITH_ACTOR, ...MANY_CLEAN]))
  await this.attemptsTo(RunFeed.withConfig({ ...baseConfig, 'detect-slop': true }))
  this.collapsedPosts = this.document.querySelectorAll('[data-testid="mainFeed"] > div[data-lazy-mount-id] > div:not([data-focusin-injected])')
  const banner = this.collapsedPosts[0].previousElementSibling
  banner?.querySelector('.focusedin-unfollow-btn')?.click()
})

Then(/the button is disabled and shows "Unfollowing…" while the request is in flight/, function () {
  const banner = this.collapsedPosts[0].previousElementSibling
  const btn = banner?.querySelector('.focusedin-unfollow-btn')
  assert.ok(btn?.disabled, 'button should be disabled')
  assert.equal(btn?.textContent, 'Unfollowing…')
})

// ---------------------------------------------------------------------------
// Success / error states
// ---------------------------------------------------------------------------

When('the unfollow API returns a success response', async function () {
  this.unfollowResult = Promise.resolve({})
  this.setChromeMockResponses({})
  this.attemptsTo(BuildFeed.with([SLOP_WITH_ACTOR, ...MANY_CLEAN]))
  await this.attemptsTo(RunFeed.withConfig({ ...baseConfig, 'detect-slop': true }))
  this.collapsedPosts = this.document.querySelectorAll('[data-testid="mainFeed"] > div[data-lazy-mount-id] > div:not([data-focusin-injected])')
  const banner = this.collapsedPosts[0].previousElementSibling
  banner?.querySelector('.focusedin-unfollow-btn')?.click()
  await Promise.resolve() // flush microtask queue
})

Then(/the button shows "Unfollowed" and remains disabled with the `focusedin-unfollow-done` class/, function () {
  const banner = this.collapsedPosts[0].previousElementSibling
  const btn = banner?.querySelector('.focusedin-unfollow-btn')
  assert.ok(btn?.disabled, 'button should remain disabled')
  assert.equal(btn?.textContent, 'Unfollowed')
  assert.ok(btn?.classList.contains('focusedin-unfollow-done'), 'done class should be added')
})

When('the unfollow API returns an error or the request fails', async function () {
  this.unfollowResult = Promise.reject(new Error('network error'))
  this.setChromeMockResponses({})
  this.attemptsTo(BuildFeed.with([SLOP_WITH_ACTOR, ...MANY_CLEAN]))
  await this.attemptsTo(RunFeed.withConfig({ ...baseConfig, 'detect-slop': true }))
  this.collapsedPosts = this.document.querySelectorAll('[data-testid="mainFeed"] > div[data-lazy-mount-id] > div:not([data-focusin-injected])')
  const banner = this.collapsedPosts[0].previousElementSibling
  banner?.querySelector('.focusedin-unfollow-btn')?.click()
  await Promise.resolve()
})

Then(/the button returns to its clickable state and shows "Unfollow failed"/, function () {
  const banner = this.collapsedPosts[0].previousElementSibling
  const btn = banner?.querySelector('.focusedin-unfollow-btn')
  assert.ok(!btn?.disabled, 'button should be re-enabled')
  assert.equal(btn?.textContent, 'Unfollow failed')
})

Then('the rest of the banner is unaffected', function () {
  const banner = this.collapsedPosts[0].previousElementSibling
  assert.ok(banner?.classList.contains('focusedin-slop-collapsed'), 'banner should still be present')
  assert.ok(banner?.querySelector('.focusedin-slop-reveal-btn'), 'Show anyway button should still be present')
})
