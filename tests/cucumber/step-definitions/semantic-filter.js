import { When, Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { LoadPopupHTML } from '../screenplay/tasks/LoadPopupHTML.js'
import {
  baseConfig,
  CLEAN_POST,
} from '../screenplay/fixtures/posts.js'
import { BuildFeed } from '../screenplay/tasks/BuildFeed.js'
import { RunFeed } from '../screenplay/tasks/RunFeed.js'

const MANY_CLEAN = Array(5).fill(CLEAN_POST)

When(/the popup opens for a user who has never enabled `political content`/, async function () {
  await LoadPopupHTML.performAs(this)
})

Then(/a checkbox with value `political content` is present and unchecked/, function () {
  const cb = this.popupDocument.querySelector('input.semantic-topic[value="political content"]')
  assert.ok(cb, 'political content checkbox should exist')
  assert.ok(!cb.checked, 'should be unchecked by default')
})

When(/the user checks the `political content` checkbox/, function () {
  this.storageData['semantic-filter'] = 'political content'
  this.storageSets.push({ 'semantic-filter': 'political content' })
})

Then(/`political content` is saved to `semantic-filter` storage and used in subsequent semantic checks/, async function () {
  const written = this.storageSets.findLast((s) => 'semantic-filter' in s)?.['semantic-filter']
  assert.ok(written?.includes('political content'), 'political content should be saved to semantic-filter')
  this.setChromeMockResponses({ 'semantic-check': { score: 0.9, topic: 'political content' } })
  this.attemptsTo(BuildFeed.with([CLEAN_POST, ...MANY_CLEAN]))
  await this.attemptsTo(RunFeed.withConfig({ ...baseConfig, 'semantic-filter': 'political content' }))
  const posts = this.document.querySelectorAll('[data-testid="mainFeed"] > div[data-lazy-mount-id] > div:not([data-focusin-injected])')
  assert.ok(posts[0].classList.contains('focusedin-slop-soft-hide'), 'political content post should be hidden')
})

When(/the popup opens for a user who has never enabled `war and conflict`/, async function () {
  await LoadPopupHTML.performAs(this)
})

Then(/a checkbox with value `war and conflict` is present and unchecked/, function () {
  const cb = this.popupDocument.querySelector('input.semantic-topic[value="war and conflict"]')
  assert.ok(cb, 'war and conflict checkbox should exist')
  assert.ok(!cb.checked, 'should be unchecked by default')
})

When(/the user checks the `war and conflict` checkbox/, function () {
  this.storageData['semantic-filter'] = 'war and conflict'
  this.storageSets.push({ 'semantic-filter': 'war and conflict' })
})

Then(/`war and conflict` is saved to `semantic-filter` storage and used in subsequent semantic checks/, async function () {
  const written = this.storageSets.findLast((s) => 'semantic-filter' in s)?.['semantic-filter']
  assert.ok(written?.includes('war and conflict'), 'war and conflict should be saved to semantic-filter')
  this.setChromeMockResponses({ 'semantic-check': { score: 0.9, topic: 'war and conflict' } })
  this.attemptsTo(BuildFeed.with([CLEAN_POST, ...MANY_CLEAN]))
  await this.attemptsTo(RunFeed.withConfig({ ...baseConfig, 'semantic-filter': 'war and conflict' }))
  const posts = this.document.querySelectorAll('[data-testid="mainFeed"] > div[data-lazy-mount-id] > div:not([data-focusin-injected])')
  assert.ok(posts[0].classList.contains('focusedin-slop-soft-hide'), 'war/conflict post should be hidden')
})
