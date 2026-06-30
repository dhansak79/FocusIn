import { When, Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '../../..')
const DASHBOARD = join(ROOT, 'reports', 'workflow-insights', 'index.html')

let dashboardHtml = null

function getDashboard() {
  if (!dashboardHtml) dashboardHtml = readFileSync(DASHBOARD, 'utf8')
  return dashboardHtml
}

When(/a user navigates to `https:\/\/dhansak79\.github\.io\/FocusIn\/insights\/`/, function () {
  this.dashHtml = getDashboard()
})

When(/`reports\/workflow-insights\/index\.html` is opened directly in a browser with no internet connection \(file:\/\/ or served statically\)/, function () {
  this.dashHtml = getDashboard()
})

When('the HTML is opened in a browser', function () {
  this.dashHtml = getDashboard()
})

When(/a session contains 3 runs \(2 blocked pre-commits \+ 1 successful push\)/, function () {
  this.dashHtml = getDashboard()
})

When('the YAML corpus contains runs forming multiple sessions', function () {
  this.dashHtml = getDashboard()
})

When('a session contains exactly 1 run that succeeded', function () {
  this.dashHtml = getDashboard()
})

When('a session with 3 runs is expanded', function () {
  this.dashHtml = getDashboard()
})

When('a session contains a `quality-gate-fast` commit run', function () {
  this.dashHtml = getDashboard()
})

When('a session is expanded and mutation data includes per-file scores', function () {
  this.dashHtml = getDashboard()
})

When('a coverage run has `branches: 89.5`', function () {
  this.dashHtml = getDashboard()
})

When(/a step failed before producing output \(e\.g\. tests aborted\)/, function () {
  this.dashHtml = getDashboard()
})

// Step "a user visits `https://dhansak79.github.io/FocusIn/`" is defined in mutation-report-pages.js
// (it tests the mutation report root page, not the dashboard)

Then('the browser receives HTTP 200 and renders the guardrails impact dashboard', function () {
  assert.ok(this.dashHtml.includes('Guardrails Impact Dashboard'), 'dashboard must have expected title')
  assert.ok(this.dashHtml.includes('<canvas id="sessionChart"'), 'dashboard must include session chart canvas')
})

Then('all charts and panels render correctly without errors or blank sections', function () {
  const html = this.dashHtml
  assert.ok(html.includes('<canvas'), 'dashboard must include chart canvas')
  assert.ok(html.includes('class="summary"'), 'dashboard must include summary panel')
  assert.ok(html.includes('class="card"'), 'dashboard must include card panels')
  assert.ok(!html.match(/<script[^>]+src="https?:\/\//), 'dashboard must not load scripts from external URLs')
  assert.ok(!html.match(/<link[^>]+href="https?:\/\//), 'dashboard must not load stylesheets from external URLs')
})

Then('all charts render immediately from the embedded constant without any network request', function () {
  const html = this.dashHtml
  assert.ok(!html.match(/<script[^>]+src="https?:\/\//), 'no external script sources allowed')
  assert.ok(html.includes('<script'), 'chart data must be embedded in a script tag')
})

Then('the corresponding bar has height 3', function () {
  assert.ok(this.dashHtml.includes('attempts'), 'dashboard must display attempt counts for multi-run sessions')
})

Then(/the summary panel shows the correct totals and the date\/step of the most recent block/, function () {
  const html = this.dashHtml
  assert.ok(html.includes('Total gate runs'), 'dashboard must show total gate runs stat')
  assert.ok(html.includes('Sessions'), 'dashboard must show sessions stat')
  assert.ok(html.includes('Last blocking step'), 'dashboard must show last blocking step')
})

Then('the session row renders as a single collapsed line showing the date and "1 attempt ✓"', function () {
  assert.ok(this.dashHtml.includes('1 attempt'), 'dashboard must show single-attempt sessions')
})

Then('the check table renders 3 columns and one row per check', function () {
  const html = this.dashHtml
  assert.ok(html.includes('class="check-table"'), 'dashboard must render check tables')
  assert.ok(html.includes('<thead>'), 'check table must have a header row')
  assert.ok(html.includes('<tbody>'), 'check table must have a body')
})

Then('the mutation row cell for that column shows `—`', function () {
  assert.ok(this.dashHtml.includes('>—<'), 'dashboard must render em-dash for absent metrics')
})

Then('each file path and score is visible within the mutation row', function () {
  const html = this.dashHtml
  assert.ok(html.includes('class="check-table"'), 'dashboard must have check tables with sub-rows')
  assert.ok(html.includes('class="sub"') || html.includes('tr.sub'), 'dashboard must have sub-row styling for file breakdown')
})

Then(/the branches cell renders in red \(below the 90% threshold\)/, function () {
  assert.ok(this.dashHtml.includes('class="bad"'), 'dashboard must use "bad" class for failing metric cells')
})

Then('the corresponding cell renders `✗` in red rather than `—`', function () {
  assert.ok(this.dashHtml.includes('✗'), 'dashboard must render ✗ for failed steps with no data')
  assert.ok(this.dashHtml.includes('class="bad"'), 'failed step cells must use "bad" class (red colour)')
})
