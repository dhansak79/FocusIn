import { When, Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '../../..')
const MUTATION_YML = join(ROOT, '.github', 'workflows', 'mutation.yml')
const INJECT_SCRIPT = join(ROOT, 'scripts', 'inject-dashboard-link.js')

let mutationYml = null
let injectScript = null

function getMutationYml() {
  if (!mutationYml) mutationYml = readFileSync(MUTATION_YML, 'utf8')
  return mutationYml
}

function getInjectScript() {
  if (!injectScript) injectScript = readFileSync(INJECT_SCRIPT, 'utf8')
  return injectScript
}

When('Stryker is updated and its HTML bundle structure changes', function () {
  this.injectScript = getInjectScript()
})

When('the Mutation workflow completes on a push to main', function () {
  this.mutationYml = getMutationYml()
})

Then('the cheerio injection still succeeds by targeting `<body>` rather than a specific string in the bundle', function () {
  const script = this.injectScript
  assert.ok(script.includes('cheerio'), 'inject script must use cheerio for DOM manipulation')
  assert.ok(script.includes('$("body")') || script.includes("$('body')"), 'inject script must target <body> element for resilience')
  assert.ok(!script.includes('innerHTML') && !script.includes('.replace('), 'inject script must not use brittle string replacement')
})

Then('a `mutation-report` artifact is available for download by the Pages workflow', function () {
  const yml = this.mutationYml
  assert.ok(yml.includes('upload-artifact'), 'mutation workflow must upload an artifact')
  assert.ok(yml.includes('mutation-report'), 'artifact must be named mutation-report')
  assert.ok(yml.includes('reports/mutation'), 'artifact must include the mutation report directory')
})
