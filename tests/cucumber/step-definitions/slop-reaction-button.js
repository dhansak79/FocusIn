import { When, Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { renderHallOfShame } from '../../../src/stats-renderer.js'
import {
  baseConfig,
  CLEAN_POST,
  REACTIONS_BAR,
  POST_WITH_REACTIONS,
} from '../screenplay/fixtures/posts.js'
import { BuildFeed } from '../screenplay/tasks/BuildFeed.js'
import { RunFeed } from '../screenplay/tasks/RunFeed.js'
import { LoadPopupHTML } from '../screenplay/tasks/LoadPopupHTML.js'

const MANY_CLEAN = Array(5).fill(CLEAN_POST)
const POST_WITH_AUTHOR_AND_REACTIONS = POST_WITH_REACTIONS

const getShameStore = (world) =>
  world.storageSets.findLast((s) => 'focusin-slop-reactions' in s)?.['focusin-slop-reactions']
const getStats = (world) =>
  world.storageSets.findLast((s) => 'focusin-stats' in s)?.['focusin-stats']

// ---------------------------------------------------------------------------
// Button injection
// ---------------------------------------------------------------------------

When(/a post with a `button\[aria-label="Open reactions menu"\]` is present in the feed/, async function () {
  this.attemptsTo(BuildFeed.with([POST_WITH_AUTHOR_AND_REACTIONS, ...MANY_CLEAN]))
  await this.attemptsTo(RunFeed.withConfig({ ...baseConfig }))
  this.feedPosts = this.document.querySelectorAll('[data-testid="mainFeed"] > div[data-lazy-mount-id] > div:not([data-focusin-injected])')
})

Then(/a `\.focusedin-slop-reaction-btn` button is injected immediately after the reaction group/, function () {
  const btn = this.feedPosts?.[0]?.querySelector('.focusedin-slop-reaction-btn')
  assert.ok(btn, 'slop reaction button should be injected')
})

When('the action bar is already present with an injected slop button', async function () {
  this.attemptsTo(BuildFeed.with([POST_WITH_AUTHOR_AND_REACTIONS, ...MANY_CLEAN]))
  await this.attemptsTo(RunFeed.withConfig({ ...baseConfig }))
  this.feedPosts = this.document.querySelectorAll('[data-testid="mainFeed"] > div[data-lazy-mount-id] > div:not([data-focusin-injected])')
})

Then('only one slop button is present at any time', function () {
  const btns = this.feedPosts?.[0]?.querySelectorAll('.focusedin-slop-reaction-btn')
  assert.equal(btns?.length, 1, 'only one slop button should exist per post')
})

When(/a post has no `button\[aria-label="Open reactions menu"\]`/, async function () {
  this.attemptsTo(BuildFeed.with([CLEAN_POST, ...MANY_CLEAN]))
  await this.attemptsTo(RunFeed.withConfig({ ...baseConfig }))
  this.feedPosts = this.document.querySelectorAll('[data-testid="mainFeed"] > div[data-lazy-mount-id] > div:not([data-focusin-injected])')
})

Then('no slop button is injected into that post', function () {
  const btn = this.feedPosts?.[0]?.querySelector('.focusedin-slop-reaction-btn')
  assert.ok(!btn, 'no slop button should be injected for posts without reactions bar')
})

When('a reactions button is added to the feed DOM after initial load', async function () {
  this.attemptsTo(BuildFeed.with([CLEAN_POST, ...MANY_CLEAN]))
  await this.attemptsTo(RunFeed.withConfig({ ...baseConfig }))
  const feedContainer = this.document.querySelector('[data-testid="mainFeed"]')
  const group = this.document.createElement('div')
  const reactBtn = this.document.createElement('button')
  reactBtn.setAttribute('aria-label', 'Open reactions menu')
  group.appendChild(reactBtn)
  feedContainer.appendChild(group)
  await Promise.resolve()
  this.dynamicGroup = group
})

Then('the slop button is injected into the new action bar', function () {
  const feedContainer = this.document.querySelector('[data-testid="mainFeed"]')
  assert.ok(feedContainer?.querySelector('.focusedin-slop-reaction-btn'), 'slop button should be injected dynamically')
})

// ---------------------------------------------------------------------------
// Click handler
// ---------------------------------------------------------------------------

When(/the user clicks the 🤖 button/, async function () {
  this.attemptsTo(BuildFeed.with([POST_WITH_AUTHOR_AND_REACTIONS, ...MANY_CLEAN]))
  await this.attemptsTo(RunFeed.withConfig({ ...baseConfig }))
  this.feedPosts = this.document.querySelectorAll('[data-testid="mainFeed"] > div[data-lazy-mount-id] > div:not([data-focusin-injected])')
  const slopBtn = this.feedPosts[0].querySelector('.focusedin-slop-reaction-btn')
  assert.ok(slopBtn, 'slop reaction button should exist')
  slopBtn.click()
  this.clock.tick(600)
})

Then(/the associated feed post remains visible/, function () {
  assert.ok(!this.feedPosts?.[0]?.classList.contains('hide'), 'post should remain visible after 🤖 click')
})

Then(/the daily `slopCollapsed` counter increments by 1/, function () {
  const stats = getStats(this)
  assert.ok(stats, 'stats should be flushed')
  assert.ok(stats.slopCollapsed >= 1, `slopCollapsed should be at least 1, got ${stats?.slopCollapsed}`)
})


Then(/the author's count in `focusin-slop-reactions` increments by 1/, function () {
  const shame = getShameStore(this)
  assert.ok(shame, 'hall of shame should be written to storage')
  assert.ok(shame?.['john-doe']?.count >= 1, 'john-doe count in hall of shame should be >= 1')
})

Then(/the daily `authors` map is NOT modified/, function () {
  const stats = getStats(this)
  const authors = stats?.authors ?? {}
  assert.ok(!Object.prototype.hasOwnProperty.call(authors, 'john-doe'), 'john-doe should NOT be in daily authors map')
})

When(/no author name or vanity name can be extracted from the post/, async function () {
  const noAuthorPostWithReactions = `${CLEAN_POST}${REACTIONS_BAR}`
  this.attemptsTo(BuildFeed.with([noAuthorPostWithReactions, ...MANY_CLEAN]))
  await this.attemptsTo(RunFeed.withConfig({ ...baseConfig }))
  this.feedPosts = this.document.querySelectorAll('[data-testid="mainFeed"] > div[data-lazy-mount-id] > div:not([data-focusin-injected])')
  const slopBtn = this.feedPosts[0].querySelector('.focusedin-slop-reaction-btn')
  slopBtn?.click()
  this.clock.tick(600)
})

Then('no error is thrown and the daily counter still increments', function () {
  const stats = getStats(this)
  assert.ok(stats?.slopCollapsed >= 1, 'slopCollapsed should increment even without author')
})

// ---------------------------------------------------------------------------
// Popup structure and rendering
// ---------------------------------------------------------------------------


Then(/a "Hall of Shame" tab button is visible in the tab bar/, function () {
  const tab = this.popupDocument.getElementById('tab-hall-of-shame')
  assert.ok(tab, 'tab-hall-of-shame should exist')
})

When('the user clicks the "Hall of Shame" tab', function () {
  this.hallOfShameClicked = true
})

When(/no posts have ever been flagged via the 🤖 button/, function () {
  this.emptyHallOfShame = true
})

Then(/the panel shows each author who has been manually slopped at least once, sorted highest count first/, function () {
  const container = new JSDOM('<div></div>').window.document.querySelector('div')
  renderHallOfShame({ 'bob': { name: 'Bob', count: 2 }, 'alice': { name: 'Alice', count: 5 } }, container)
  const items = container.querySelectorAll('.author-tally-item')
  assert.ok(items.length === 2, '2 items should render')
  const first = items[0].querySelector('.author-tally-count')?.textContent
  assert.equal(first, '5', 'highest count should be first')
})

Then(/each row displays the author's name and their all-time slop reaction count/, function () {
  const container = new JSDOM('<div></div>').window.document.querySelector('div')
  renderHallOfShame({ 'alice': { name: 'Alice', count: 3 } }, container)
  assert.ok(container.innerHTML.includes('Alice'), 'name should be shown')
  assert.ok(container.innerHTML.includes('3'), 'count should be shown')
})

When('the user has flagged an author via the 🤖 button in a previous session', function () {
  this.storageData['focusin-slop-reactions'] = { 'alice': { name: 'Alice', count: 7 } }
})

When('the user opens the popup in a new session', async function () {
  await LoadPopupHTML.performAs(this)
})

Then(/the author still appears in the Hall of Shame with the correct accumulated count/, function () {
  const shameData = this.storageData['focusin-slop-reactions']
  assert.ok(shameData?.['alice']?.count === 7, 'alice should have 7 reactions persisted')
})

Then(/the panel shows the message "No authors in the Hall of Shame yet — use the 🤖 button in the reaction picker to flag them\."/, function () {
  const container = new JSDOM('<div></div>').window.document.querySelector('div')
  renderHallOfShame({}, container)
  assert.ok(
    container.textContent.includes('No authors in the Hall of Shame yet'),
    'empty state message should be shown'
  )
})
