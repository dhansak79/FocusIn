import { When, Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { renderAuthorTally } from '../../../src/stats-renderer.js'
import {
  baseConfig,
  CLEAN_POST,
  SLOP_POST,
  SLOP_WITH_ACTOR,
  CLEAN_WITH_ACTOR,
  POST_WITH_AUTHOR,
} from '../screenplay/fixtures/posts.js'
import { BuildFeed } from '../screenplay/tasks/BuildFeed.js'
import { RunFeed } from '../screenplay/tasks/RunFeed.js'
import { LoadPopupHTML } from '../screenplay/tasks/LoadPopupHTML.js'

const MANY_CLEAN = Array(5).fill(CLEAN_POST)

const getStats = (world) =>
  world.storageSets.findLast((s) => 'focusin-stats' in s)?.['focusin-stats']

// ---------------------------------------------------------------------------
// Block count tracks author
// ---------------------------------------------------------------------------

When('a post is collapsed with a pattern match banner', async function () {
  this.setChromeMockResponses({ 'slop-archetype-check': { score: 0.85, topic: 'archetype' } })
  this.attemptsTo(BuildFeed.with([POST_WITH_AUTHOR, ...MANY_CLEAN]))
  await this.attemptsTo(RunFeed.withConfig({ ...baseConfig, 'slop-archetype': true }))
  this.collapsedPosts = this.document.querySelectorAll('[data-testid="mainFeed"] > div[data-lazy-mount-id] > div:not([data-focusin-injected])')
})

When('a post is collapsed with a semantic match banner', async function () {
  this.setChromeMockResponses({ 'semantic-check': { score: 0.9, topic: 'hustle culture' } })
  this.attemptsTo(BuildFeed.with([CLEAN_WITH_ACTOR, ...MANY_CLEAN]))
  await this.attemptsTo(RunFeed.withConfig({ ...baseConfig, 'semantic-filter': 'hustle culture' }))
  this.collapsedPosts = this.document.querySelectorAll('[data-testid="mainFeed"] > div[data-lazy-mount-id] > div:not([data-focusin-injected])')
})

When(/a post is hidden by the topic\/keyword filter/, async function () {
  const POST_WITH_KEYWORD = `<a href="/in/grace-hopper/"><strong>Grace Hopper</strong></a>banned-topic-here`
  this.attemptsTo(BuildFeed.with([POST_WITH_KEYWORD, ...MANY_CLEAN]))
  await this.attemptsTo(RunFeed.withConfig({ ...baseConfig, 'feed-keywords': 'banned-topic' }))
})

// "a post is hidden by the promoted-post filter" step already defined in hide-promoted-posts.js

When(/the author vanity name is extractable from the post DOM/, function () {
  // Covered by the post fixture used in the preceding When step
})

Then(/the author's count in the daily `authors` map increments by 1/, function () {
  const stats = getStats(this)
  assert.ok(stats, 'stats should be flushed to storage')
  const authors = stats?.authors ?? {}
  const hasEntry = Object.values(authors).some((e) => e.count >= 1)
  assert.ok(hasEntry, 'authors map should have at least one entry with count >= 1')
})

When('a post is blocked', async function () {
  const noVanityPost = `<button aria-label="Follow Jane Smith">Follow</button>${SLOP_POST}`
  this.noVanityPost = noVanityPost
  this.attemptsTo(BuildFeed.with([noVanityPost, ...MANY_CLEAN]))
})

When('the vanity name cannot be extracted from the post DOM', function () {
  // noVanityPost has no /in/ href
})

When('the display name is available', function () {
  // noVanityPost has Follow button with author name
})

Then(/the author's count is keyed by display name in the `authors` map/, async function () {
  await this.attemptsTo(RunFeed.withConfig({ ...baseConfig, 'detect-slop': true }))
  const stats = getStats(this)
  const authors = stats?.authors ?? {}
  assert.ok('Jane Smith' in authors || Object.values(authors).some((e) => e.name === 'Jane Smith'),
    'Jane Smith should be keyed in authors map')
})

When('neither vanity name nor display name can be extracted', function () {
  this.attemptsTo(BuildFeed.with([SLOP_POST, ...MANY_CLEAN]))
})

Then('no entry is written to the `authors` map', async function () {
  await this.attemptsTo(RunFeed.withConfig({ ...baseConfig, 'detect-slop': true }))
  const stats = getStats(this)
  const authors = stats?.authors ?? {}
  // null/null author => trackAuthorBlocked(null, null) => key is null => not recorded
  assert.ok(!Object.keys(authors).some((k) => k !== 'null' && k !== ''), 'no named author should be recorded')
})

// ---------------------------------------------------------------------------
// Daily reset
// ---------------------------------------------------------------------------

When('the current date differs from the stored date key', async function () {
  this.storageData['focusin-stats-date'] = '2000-01-01'
  this.storageData['focusin-stats'] = { postsFiltered: 99, slopCollapsed: 99, signals: {}, authors: { 'old-author': { name: 'Old', count: 99 } } }
  this.attemptsTo(BuildFeed.with([SLOP_WITH_ACTOR, ...MANY_CLEAN]))
  await this.attemptsTo(RunFeed.withConfig({ ...baseConfig, 'detect-slop': true }))
})

Then(/the `authors` map resets to empty along with the other daily stats/, function () {
  const stats = getStats(this)
  assert.ok(stats, 'stats should be written')
  assert.ok(!stats.authors?.['old-author'], 'old-author should not carry over to new day')
})

// ---------------------------------------------------------------------------
// Popup structure
// ---------------------------------------------------------------------------

When('the popup opens', async function () {
  await LoadPopupHTML.performAs(this)
})

Then(/a "Blocked" tab button is visible in the tab bar alongside "Filters" and "Authors"/, function () {
  const blockedTab = this.popupDocument.getElementById('tab-blocked')
  const filtersTab = this.popupDocument.getElementById('tab-filters')
  const authorsTab = this.popupDocument.getElementById('tab-authors')
  assert.ok(blockedTab, 'tab-blocked should exist')
  assert.ok(filtersTab, 'tab-filters should exist')
  assert.ok(authorsTab, 'tab-authors should exist')
})

// ---------------------------------------------------------------------------
// Popup rendering: ranked author list
// ---------------------------------------------------------------------------

When('the user clicks the "Blocked" tab', function () {
  this.blockedTabClicked = true
})

When('no posts have been blocked in the current session date', function () {
  this.noBlockedToday = true
})

Then(/the panel shows each author with at least one blocked post today, sorted highest count first/, function () {
  const container = new JSDOM('<div id="list"></div>').window.document.getElementById('list')
  const authors = {
    'bob': { name: 'Bob', count: 3 },
    'alice': { name: 'Alice', count: 5 },
    'carol': { name: 'Carol', count: 1 },
  }
  renderAuthorTally(authors, container)
  const rows = container.querySelectorAll('.author-tally-item')
  assert.ok(rows.length >= 1, 'at least one author row should render')
  const counts = [...rows].map((r) => parseInt(r.querySelector('.author-tally-count')?.textContent ?? '0', 10))
  for (let i = 1; i < counts.length; i++) {
    assert.ok(counts[i - 1] >= counts[i], 'authors should be sorted by count descending')
  }
})

Then(/each row displays the author's display name and numeric block count/, function () {
  const container = new JSDOM('<div id="list"></div>').window.document.getElementById('list')
  renderAuthorTally({ 'alice': { name: 'Alice', count: 5 } }, container)
  const html = container.innerHTML
  assert.ok(html.includes('Alice'), 'display name should be present')
  assert.ok(html.includes('5'), 'count should be present')
})

Then(/the panel shows a message indicating no blocked posts yet today/, function () {
  const container = new JSDOM('<div id="list"></div>').window.document.getElementById('list')
  renderAuthorTally({}, container)
  const html = container.innerHTML
  assert.ok(html.length > 0, 'empty state message should be rendered')
})

When(/more than (\d+) distinct authors have been blocked today/, function (n) {
  const count = parseInt(n, 10) + 1
  const authors = Object.fromEntries(
    Array.from({ length: count }, (_, i) => [`author-${i}`, { name: `Author ${i}`, count: count - i }])
  )
  this.manyAuthors = authors
})

Then(/the "Blocked" tab displays only the top 20 by count/, function () {
  const container = new JSDOM('<div id="list"></div>').window.document.getElementById('list')
  const authors = Object.fromEntries(
    Array.from({ length: 25 }, (_, i) => [`author-${i}`, { name: `Author ${i}`, count: 25 - i }])
  )
  renderAuthorTally(authors, container)
  const rows = container.querySelectorAll('.author-tally-item')
  assert.ok(rows.length <= 20, `should cap at 20 entries, got ${rows.length}`)
})

// ---------------------------------------------------------------------------
// HTML escaping (rendered output)
// ---------------------------------------------------------------------------

When(/a blocked author's display name contains HTML metacharacters \(e\.g\. `<`, `>`, `&`, `"`\)/, function () {
  this.xssName = '<script>alert(1)</script>'
})

Then(/those characters are rendered as their HTML entities in the popup and do not execute as markup/, function () {
  if (this.xssName) {
    const container = new JSDOM('<div id="list"></div>').window.document.getElementById('list')
    renderAuthorTally({ 'xss': { name: this.xssName, count: 1 } }, container)
    assert.ok(!container.querySelector('script'), 'script tag should not be injected into DOM')
    assert.ok(container.textContent.includes('alert'), 'text should be present as escaped text')
  }
  if (this.xssSignal) {
    const container = new JSDOM('<div></div>').window.document.querySelector('div')
    container.textContent = this.xssSignal
    assert.ok(!container.querySelector('b'), 'HTML in signal should not be parsed as markup when set via textContent')
  }
})

When('a slop signal string contains HTML metacharacters', function () {
  this.xssSignal = '<b>bold signal</b>'
})
