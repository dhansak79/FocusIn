import { When, Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { spawnSync } from 'child_process'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import process from 'node:process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '../../..')

let csTestOutput = null

function runCsTests() {
  if (csTestOutput) return csTestOutput
  const env = { ...process.env, PATH: `${process.env.HOME}/.swamp/deno:${process.env.PATH}` }
  const result = spawnSync('deno', [
    'test', '--allow-read', '--allow-write', '--allow-env', '--node-modules-dir=auto',
    'extensions/models/focusin_codescene_test.ts',
  ], { encoding: 'utf8', cwd: ROOT, env, timeout: 60000 })
  csTestOutput = result.stdout + result.stderr
  return csTestOutput
}

const ANSI_RE = new RegExp('\x1b' + '\\[[0-9;]*m', 'g')
function stripAnsi(s) {
  return s.replace(ANSI_RE, '')
}

function assertTestPassed(rawOutput, testName) {
  const output = stripAnsi(rawOutput)
  assert.ok(
    output.includes(`${testName} ... ok`),
    `Expected deno test to pass: "${testName}"\nActual output:\n${output.slice(-800)}`
  )
}

When('the `quality-gate` workflow runs and no changed files on the branch have introduced new health findings', function () {
  this.csOutput = runCsTests()
})

When('the `quality-gate` workflow runs and at least one changed file has introduced new health findings vs. `main`', function () {
  this.csOutput = runCsTests()
})

When(/the `quality-gate` workflow runs and `cs delta main` returns an empty array \(no degradations\)/, function () {
  this.csOutput = runCsTests()
})

When('the `quality-gate` workflow runs and the `cs` binary is not available on PATH', function () {
  this.csOutput = runCsTests()
})

When('a file has introduced new health findings during the check', function () {
  this.csOutput = runCsTests()
})

When('`cs delta main` returns an empty array', function () {
  this.csOutput = runCsTests()
})

When('a developer runs `git commit` after Phase 3 cleanup', function () {
  this.preCommitContent = readFileSync(join(ROOT, '.githooks', 'pre-commit'), 'utf8')
})

When('a developer runs `git push`', function () {
  this.prePushContent = readFileSync(join(ROOT, '.githooks', 'pre-push'), 'utf8')
})

Then('the `codescene-health` step SHALL pass and SHALL write a `healthResult` resource with `passed: true` and `failedFiles: 0`', function () {
  assertTestPassed(this.csOutput, 'model.check.execute: no degradations — writes passed result and returns')
})

Then(/the `codescene-health` step SHALL fail and SHALL write a `healthResult` resource with `passed: false`, `failedFiles > 0`, and the failing file\(s\) listed with their `newScore` and `findings`/, function () {
  assertTestPassed(this.csOutput, 'model.check.execute: degraded file — writes result then throws')
})

Then('the `codescene-health` step SHALL pass and SHALL write a `healthResult` resource with `failedFiles: 0` and `passed: true`', function () {
  assertTestPassed(this.csOutput, 'model.check.execute: no degradations — writes passed result and returns')
  assertTestPassed(this.csOutput, 'buildHealthResult: empty files gives passed:true and failedFiles:0')
})

Then('the `codescene-health` step SHALL fail with a human-readable error message indicating that the CodeScene CLI must be installed', function () {
  assertTestPassed(this.csOutput, 'model.check.execute: cs binary not found — throws with install message')
})

Then(/the stored `healthResult` SHALL include that file's `name`, `newScore`, and a non-empty `findings` array containing at least one entry with a `category` field/, function () {
  assertTestPassed(this.csOutput, 'model.check.execute: degraded file — writes result then throws')
  assertTestPassed(this.csOutput, 'parseDeltaOutput: maps kebab-case fields to camelCase')
})

Then('the stored `healthResult` SHALL still be written with `passed: true`, `failedFiles: 0`, and an empty `files` array', function () {
  assertTestPassed(this.csOutput, 'model.check.execute: no degradations — writes passed result and returns')
  assertTestPassed(this.csOutput, 'buildHealthResult: empty files gives passed:true and failedFiles:0')
})

Then('the pre-commit hook SHALL NOT invoke `check-codescene-health.js` or any equivalent CodeScene CLI call', function () {
  assert.ok(!this.preCommitContent.includes('check-codescene-health'), 'pre-commit must not call check-codescene-health.js')
  assert.ok(!this.preCommitContent.includes('cs delta') && !this.preCommitContent.includes('codescene'), 'pre-commit must not call cs CLI directly')
})

Then('the pre-push hook SHALL trigger the `quality-gate` workflow which SHALL include the `codescene-health` step', function () {
  assert.ok(this.prePushContent.includes('quality-gate'), 'pre-push must run quality-gate workflow')
  assert.ok(!this.prePushContent.includes('quality-gate-fast'), 'pre-push must run quality-gate (not fast variant) which includes codescene')
})
