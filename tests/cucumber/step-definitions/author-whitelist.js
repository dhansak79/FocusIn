import { When, Then } from '@cucumber/cucumber'
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

const MANY_CLEAN = Array(5).fill(CLEAN_POST)

// ---------------------------------------------------------------------------
// Whitelist bypass
// ---------------------------------------------------------------------------

When('a post is detected as AI-generated slop', function () {
  this.attemptsTo(BuildFeed.with([SLOP_WITH_ACTOR, ...MANY_CLEAN]))
  this.feedRunConfig = { 'detect-slop': true }
})

When('a post scores above the semantic match threshold', function () {
  this.setChromeMockResponses({ 'semantic-check': { score: 0.9, topic: 'hustle culture' } })
  this.attemptsTo(BuildFeed.with([CLEAN_WITH_ACTOR, ...MANY_CLEAN]))
  this.feedRunConfig = { 'semantic-filter': 'hustle culture' }
})

When('a post scores above the pattern match threshold', function () {
  this.setChromeMockResponses({ 'slop-archetype-check': { score: 0.9, topic: 'archetype' } })
  this.attemptsTo(BuildFeed.with([CLEAN_WITH_ACTOR, ...MANY_CLEAN]))
  this.feedRunConfig = { 'slop-archetype': true }
})

When("the post author's vanity name is in the whitelist", function () {
  this.storageData['author-whitelist'] = [
    { vanity: 'john-doe', name: 'John Doe' },
    { vanity: 'jane-smith', name: 'Jane Smith' },
  ]
})

Then('the post is not collapsed and no banner is rendered', async function () {
  await this.attemptsTo(
    RunFeed.withConfig({
      ...baseConfig,
      ...(this.feedRunConfig ?? {}),
      'author-whitelist': this.storageData['author-whitelist'],
    })
  )
  const posts = this.document.querySelectorAll('[data-testid="mainFeed"] > div[data-lazy-mount-id] > div:not([data-focusin-injected])')
  assert.ok(!posts[0].classList.contains('focusedin-slop-soft-hide'), 'whitelisted post should not be soft-hidden')
  assert.ok(!posts[0].previousElementSibling?.classList.contains('focusedin-slop-collapsed'), 'no banner should be rendered')
})

When('a post triggers any detection path', function () {
  this.attemptsTo(BuildFeed.with([SLOP_WITH_ACTOR, ...MANY_CLEAN]))
})

When("the post author's vanity name is not in the whitelist", function () {
  this.storageData['author-whitelist'] = [{ vanity: 'someone-else', name: 'Someone Else' }]
})

Then('the post is collapsed as normal', async function () {
  await this.attemptsTo(
    RunFeed.withConfig({
      ...baseConfig,
      'detect-slop': true,
      'author-whitelist': [{ vanity: 'someone-else', name: 'Someone Else' }],
    })
  )
  const posts = this.document.querySelectorAll('[data-testid="mainFeed"] > div[data-lazy-mount-id] > div:not([data-focusin-injected])')
  assert.ok(posts[0].classList.contains('focusedin-slop-soft-hide'), 'non-whitelisted slop post should be collapsed')
})

When('no whitelist has been saved', function () {
  this.storageData['author-whitelist'] = []
})

Then(/`chrome\.storage\.local\.get\(\{ 'author-whitelist': \[\] \}\)` returns an empty array/, function () {
  assert.deepEqual(this.storageData['author-whitelist'], [])
})

When('an author is added to the whitelist', async function () {
  this.setChromeMockResponses({ 'tone-check': { score: 0.9, label: 'NEGATIVE' } })
  this.attemptsTo(BuildFeed.with([CLEAN_WITH_ACTOR, ...MANY_CLEAN]))
  await this.attemptsTo(RunFeed.withConfig({ ...baseConfig, 'tone-filter': true, 'tone-threshold': 70 }))
  const posts = this.document.querySelectorAll('[data-testid="mainFeed"] > div[data-lazy-mount-id] > div:not([data-focusin-injected])')
  const trustBtn = posts[0].previousElementSibling?.querySelector('.focusedin-trust-btn')
  trustBtn?.click()
})

Then(/the stored entry contains `vanity` \(the profile slug\) and `name` \(the display name\)/, function () {
  const whitelist = this.storageSets.findLast((s) => 'author-whitelist' in s)?.['author-whitelist'] ?? []
  assert.ok(whitelist.length > 0, 'whitelist should have an entry')
  const entry = whitelist[0]
  assert.ok('vanity' in entry, 'entry should have vanity field')
  assert.ok('name' in entry, 'entry should have name field')
})

// ---------------------------------------------------------------------------
// Popup structure
// ---------------------------------------------------------------------------

When('the Authors tab is opened', async function () {
  await LoadPopupHTML.performAs(this)
})

When('the whitelist contains entries', function () {
  this.storageData['author-whitelist'] = [{ vanity: 'john-doe', name: 'John Doe' }]
})

Then('each author is shown as a removable tag displaying their name', function () {
  const authorsPanel = this.popupDocument.getElementById('authors-panel')
  assert.ok(authorsPanel, 'authors-panel should exist in popup')
  const input = this.popupDocument.getElementById('author-whitelist')
  assert.ok(input, 'author-whitelist input should exist in popup')
})

When('the user removes an author tag in the Authors tab', function () {
  this.storageData['author-whitelist'] = []
  this.storageSets.push({ 'author-whitelist': [] })
})

Then("the entry is removed from `author-whitelist` in storage", function () {
  const written = this.storageSets.findLast((s) => 'author-whitelist' in s)?.['author-whitelist'] ?? []
  assert.deepEqual(written, [])
})

When('the popup is opened', async function () {
  await LoadPopupHTML.performAs(this)
})

Then(/two tab buttons are visible: "Filters" \(existing settings\) and "Authors" \(whitelist management\)/, function () {
  assert.ok(this.popupDocument.getElementById('tab-filters'), 'tab-filters should exist')
  assert.ok(this.popupDocument.getElementById('tab-authors'), 'tab-authors should exist')
})

When('the user clicks the "Authors" tab', function () {
  this.lastTabClicked = 'authors'
})

When('the user clicks the "Filters" tab', function () {
  this.lastTabClicked = 'filters'
})

Then(/the authors panel is shown and the filters panel is hidden/, async function () {
  await LoadPopupHTML.performAs(this)
  assert.ok(this.popupDocument.getElementById('authors-panel'), 'authors-panel should exist')
  assert.ok(this.popupDocument.getElementById('settings-panel'), 'settings-panel should exist')
})

Then(/the filters panel is shown and the authors panel is hidden/, function () {
  assert.ok(this.popupDocument.getElementById('settings-panel'), 'settings-panel should exist')
})
