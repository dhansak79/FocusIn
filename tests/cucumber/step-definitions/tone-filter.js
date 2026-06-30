import { Given, When, Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import {
  baseConfig,
  CLEAN_POST,
  SLOP_WITH_ACTOR,
  CLEAN_WITH_ACTOR,
} from '../screenplay/fixtures/posts.js'
import { BuildFeed } from '../screenplay/tasks/BuildFeed.js'
import { RunFeed } from '../screenplay/tasks/RunFeed.js'
import { LoadPopupHTML } from '../screenplay/tasks/LoadPopupHTML.js'
import { PostVisibility } from '../screenplay/questions/PostVisibility.js'

const MANY_CLEAN = Array(6).fill(CLEAN_POST)

Given('a user installs the extension for the first time', async function () {
  await LoadPopupHTML.performAs(this)
})

Then(/the `tone-filter` setting is `false` and no tone checking is performed/, function () {
  const cb = this.popupDocument.getElementById('tone-filter')
  assert.ok(cb, 'tone-filter checkbox must exist')
  assert.ok(!cb.checked, 'tone-filter should be unchecked by default')
})

When('the user switches the tone filter toggle on', function () {
  this.storageData['tone-filter'] = true
})

Then(/`tone-filter` is saved as `true` in storage and tone checking begins on the next feed scan/, async function () {
  assert.equal(this.storageData['tone-filter'], true)
  this.setChromeMockResponses({ 'tone-check': { score: 0.9, label: 'NEGATIVE' } })
  this.attemptsTo(BuildFeed.with(MANY_CLEAN))
  await this.attemptsTo(RunFeed.withConfig({ ...baseConfig, 'tone-filter': true, 'tone-threshold': 70 }))
  const { hidden } = this.asksAbout(PostVisibility.of(0))
  assert.ok(hidden, 'post should be collapsed when tone-filter is on')
})

When('the tone filter toggle is on', async function () {
  await LoadPopupHTML.performAs(this)
})

Then(/a sensitivity slider \(0–100\) is visible and its value is persisted to `tone-threshold` in storage/, function () {
  const slider = this.popupDocument.getElementById('tone-threshold')
  assert.ok(slider, 'tone-threshold slider must exist')
  assert.equal(slider.getAttribute('min'), '0')
  assert.equal(slider.getAttribute('max'), '100')
})

When('the tone filter is enabled', function () {
  this.setChromeMockResponses({})
})

When(/a feed post returns a NEGATIVE confidence score ≥ threshold \/ 100/, function () {
  this.setChromeMockResponses({ 'tone-check': { score: 0.82, label: 'NEGATIVE' } })
  this.attemptsTo(BuildFeed.with(MANY_CLEAN))
})

Then(/the post is soft-hidden and a "🌩 Negative tone" collapse banner is inserted before it/, async function () {
  await this.attemptsTo(RunFeed.withConfig({ ...baseConfig, 'tone-filter': true, 'tone-threshold': 70 }))
  const posts = this.document.querySelectorAll('[data-testid="mainFeed"] > div[data-lazy-mount-id] > div:not([data-focusin-injected])')
  assert.equal(posts[0].dataset.hidden, 'true')
  const banner = posts[0].previousElementSibling
  assert.ok(banner?.classList.contains('focusedin-slop-collapsed'), 'banner should have focusedin-slop-collapsed class')
  assert.ok(banner?.textContent?.includes('🌩 Negative tone'), 'banner should include 🌩 Negative tone')
})

When(/a feed post returns a NEGATIVE confidence score < threshold \/ 100/, function () {
  this.setChromeMockResponses({ 'tone-check': { score: 0.5, label: 'NEGATIVE' } })
  this.attemptsTo(BuildFeed.with(MANY_CLEAN))
})

Then('the post is not hidden and no banner is inserted', async function () {
  await this.attemptsTo(RunFeed.withConfig({ ...baseConfig, 'tone-filter': true, 'tone-threshold': 70 }))
  const posts = this.document.querySelectorAll('[data-testid="mainFeed"] > div[data-lazy-mount-id] > div:not([data-focusin-injected])')
  assert.notEqual(posts[0].dataset.hidden, 'true')
  assert.ok(!posts[0].previousElementSibling?.classList.contains('focusedin-slop-collapsed'), 'no banner should be inserted')
})

When(/a post has already been collapsed by the slop, archetype, or semantic detector/, function () {
  this.setChromeMockResponses({ 'tone-check': { score: 0.95, label: 'NEGATIVE' } })
  this.attemptsTo(BuildFeed.with([SLOP_WITH_ACTOR, ...MANY_CLEAN]))
})

Then('no tone-check message is sent for that post', async function () {
  await this.attemptsTo(
    RunFeed.withConfig({ ...baseConfig, 'detect-slop': true, 'tone-filter': true, 'tone-threshold': 70 })
  )
  const posts = this.document.querySelectorAll('[data-testid="mainFeed"] > div[data-lazy-mount-id] > div:not([data-focusin-injected])')
  const banner = posts[0].previousElementSibling
  assert.ok(banner?.classList.contains('focusedin-slop-collapsed'), 'post should be collapsed')
  assert.ok(
    !banner?.querySelector('.focusedin-slop-headline')?.textContent?.includes('🌩 Negative tone'),
    'tone banner should not be shown for slop-collapsed post'
  )
})

When('a post is collapsed by the tone filter', function () {
  this.setChromeMockResponses({ 'tone-check': { score: 0.85, label: 'NEGATIVE' } })
  this.attemptsTo(BuildFeed.with(MANY_CLEAN))
})

Then(/the banner signal line reads `"negative tone · NN%"` where NN is the classifier's NEGATIVE confidence rounded to the nearest integer/, async function () {
  await this.attemptsTo(RunFeed.withConfig({ ...baseConfig, 'tone-filter': true, 'tone-threshold': 70 }))
  const posts = this.document.querySelectorAll('[data-testid="mainFeed"] > div[data-lazy-mount-id] > div:not([data-focusin-injected])')
  const signalText = posts[0].previousElementSibling?.querySelector('.focusedin-slop-signals')?.textContent ?? ''
  assert.match(signalText, /negative tone · \d+%/)
})

When('the user clicks "Show anyway" on a negative tone banner', async function () {
  this.setChromeMockResponses({ 'tone-check': { score: 0.82, label: 'NEGATIVE' } })
  this.attemptsTo(BuildFeed.with(MANY_CLEAN))
  await this.attemptsTo(RunFeed.withConfig({ ...baseConfig, 'tone-filter': true, 'tone-threshold': 70 }))
})

Then('the post is revealed and the banner is replaced with a small tag', function () {
  const posts = this.document.querySelectorAll('[data-testid="mainFeed"] > div[data-lazy-mount-id] > div:not([data-focusin-injected])')
  const banner = posts[0].previousElementSibling
  const revealBtn = banner?.querySelector('.focusedin-slop-reveal-btn')
  assert.ok(revealBtn, 'Show anyway button should exist')
  revealBtn.click()
  assert.ok(!posts[0].classList.contains('focusedin-slop-soft-hide'), 'post should be revealed')
  assert.ok(banner?.classList.contains('focusedin-slop-tag'), 'banner should be replaced with tag')
})

When('the user clicks "Trust author" on a negative tone banner', async function () {
  this.setChromeMockResponses({ 'tone-check': { score: 0.82, label: 'NEGATIVE' } })
  this.attemptsTo(BuildFeed.with([CLEAN_WITH_ACTOR, ...MANY_CLEAN]))
  await this.attemptsTo(RunFeed.withConfig({ ...baseConfig, 'tone-filter': true, 'tone-threshold': 70 }))
})

Then('the author is added to the author whitelist and the post is immediately revealed', function () {
  const posts = this.document.querySelectorAll('[data-testid="mainFeed"] > div[data-lazy-mount-id] > div:not([data-focusin-injected])')
  const banner = posts[0].previousElementSibling
  const trustBtn = banner?.querySelector('.focusedin-trust-btn')
  assert.ok(trustBtn, 'Trust author button should exist')
  trustBtn.click()
  const whitelist = this.storageSets.findLast((s) => 'author-whitelist' in s)?.['author-whitelist'] ?? []
  assert.ok(whitelist.some((e) => e.vanity === 'jane-smith'), 'jane-smith should be in whitelist')
  this.clock.tick(700)
  assert.ok(!banner?.isConnected, 'banner should be removed after trust')
  assert.ok(!posts[0].classList.contains('focusedin-slop-soft-hide'), 'post should be revealed')
})
