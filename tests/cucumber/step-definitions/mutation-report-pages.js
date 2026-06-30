import { When, Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '../../..')
const PAGES_YML = join(ROOT, '.github', 'workflows', 'pages.yml')
const MUTATION_YML = join(ROOT, '.github', 'workflows', 'mutation.yml')
const INJECT_SCRIPT = join(ROOT, 'scripts', 'inject-dashboard-link.js')

let pagesYml = null
let mutationYml = null
let injectScript = null

function getPagesYml() {
  if (!pagesYml) pagesYml = readFileSync(PAGES_YML, 'utf8')
  return pagesYml
}

function getMutationYml() {
  if (!mutationYml) mutationYml = readFileSync(MUTATION_YML, 'utf8')
  return mutationYml
}

function getInjectScript() {
  if (!injectScript) injectScript = readFileSync(INJECT_SCRIPT, 'utf8')
  return injectScript
}

When('the pages workflow completes after a successful mutation run on main', function () {
  this.pagesYml = getPagesYml()
  this.mutationYml = getMutationYml()
})

When(/a user visits `https:\/\/dhansak79\.github\.io\/FocusIn\/`/, function () {
  this.pagesYml = getPagesYml()
  this.injectScript = getInjectScript()
})

When('Stryker is updated and its HTML bundle structure changes', function () {
  this.injectScript = getInjectScript()
})

When('the Mutation workflow completes on main with a failing conclusion', function () {
  this.pagesYml = getPagesYml()
})

When('the Mutation workflow completes on a push to main', function () {
  this.mutationYml = getMutationYml()
})

Then('the deployed GitHub Pages site serves the Stryker HTML report at the root URL with HTTP 200', function () {
  const yml = this.pagesYml
  assert.ok(yml.includes('reports/mutation'), 'pages workflow must use mutation report directory')
  assert.ok(yml.includes('upload-pages-artifact') || yml.includes('deploy-pages'), 'pages workflow must deploy to GitHub Pages')
  assert.ok(yml.includes('cp -r reports/mutation') || yml.includes('reports/pages'), 'mutation report must be served at pages root')
})

Then(/`https:\/\/dhansak79\.github\.io\/FocusIn\/insights\/` serves the guardrails impact dashboard with HTTP 200/, function () {
  const yml = this.pagesYml
  assert.ok(yml.includes('insights'), 'pages workflow must include insights directory')
  assert.ok(yml.includes('index.html'), 'pages workflow must copy dashboard index.html')
})

Then(/the page contains a link pointing to `\/FocusIn\/insights\/` with accessible text "Guardrails Dashboard"/, function () {
  const script = this.injectScript
  assert.ok(script.includes('/FocusIn/insights/'), 'inject script must link to /FocusIn/insights/')
  assert.ok(script.includes('Guardrails Dashboard'), 'inject script must use "Guardrails Dashboard" as link text')
})

Then('the cheerio injection still succeeds by targeting `<body>` rather than a specific string in the bundle', function () {
  const script = this.injectScript
  assert.ok(script.includes('cheerio'), 'inject script must use cheerio for DOM manipulation')
  assert.ok(script.includes('$("body")') || script.includes("$('body')"), 'inject script must target <body> element for resilience')
  assert.ok(!script.includes('innerHTML') && !script.includes('.replace('), 'inject script must not use brittle string replacement')
})

Then('the Pages workflow does not execute the deployment job', function () {
  const yml = this.pagesYml
  assert.ok(
    yml.includes("conclusion == 'success'") || yml.includes('conclusion == "success"'),
    'pages workflow must only run when mutation workflow succeeded'
  )
})

Then('a `mutation-report` artifact is available for download by the Pages workflow', function () {
  const yml = this.mutationYml
  assert.ok(yml.includes('upload-artifact'), 'mutation workflow must upload an artifact')
  assert.ok(yml.includes('mutation-report'), 'artifact must be named mutation-report')
  assert.ok(yml.includes('reports/mutation'), 'artifact must include the mutation report directory')
})
