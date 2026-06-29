import { When, Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { spawnSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import process from 'node:process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '../../..')

const denoCache = {}

function runDenoTests(relPath) {
  if (denoCache[relPath]) return denoCache[relPath]
  const env = { ...process.env, PATH: `${process.env.HOME}/.swamp/deno:${process.env.PATH}` }
  const result = spawnSync('deno', [
    'test', '--allow-read', '--allow-write', '--allow-env', '--node-modules-dir=auto', relPath,
  ], { encoding: 'utf8', cwd: ROOT, env, timeout: 60000 })
  const output = result.stdout + result.stderr
  denoCache[relPath] = output
  return output
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

// ── Lint scenarios ──────────────────────────────────────────────────────────

When('the `focusin-lint.check` method runs and ESLint finds no issues', function () {
  this.denoOutput = runDenoTests('extensions/models/focusin_lint_test.ts')
  this.model = 'lint'
})

When('the `focusin-lint.check` method runs and ESLint reports one or more problems', function () {
  this.denoOutput = runDenoTests('extensions/models/focusin_lint_test.ts')
  this.model = 'lint'
})

When('`focusin-lint.check` runs and lint fails', function () {
  this.denoOutput = runDenoTests('extensions/models/focusin_lint_test.ts')
  this.model = 'lint'
})

Then('the method SHALL write a `lintResult` resource with `passed: true` and `issueCount: 0` and SHALL return successfully', function () {
  assertTestPassed(this.denoOutput, 'model.check.execute: writes lintResult with passed=true on zero issues')
})

Then('the method SHALL write a `lintResult` resource with `passed: false` and `issueCount > 0` and SHALL throw with the ESLint output', function () {
  assertTestPassed(this.denoOutput, 'model.check.execute: writes resource then throws on non-zero issues')
})

Then('the `lintResult` resource SHALL be written before the error is thrown, so the failure is recorded as swamp data', function () {
  // The deno test "writes resource then throws" explicitly checks written.length === 1
  // with message "resource written before throw", proving write-before-throw ordering
  assertTestPassed(this.denoOutput, 'model.check.execute: writes resource then throws on non-zero issues')
})

// ── Knip scenarios ──────────────────────────────────────────────────────────

When('the `focusin-knip.check` method runs and knip finds no issues', function () {
  this.denoOutput = runDenoTests('extensions/models/focusin_knip_test.ts')
  this.model = 'knip'
})

When('the `focusin-knip.check` method runs and knip reports issues', function () {
  this.denoOutput = runDenoTests('extensions/models/focusin_knip_test.ts')
  this.model = 'knip'
})

Then('the method SHALL write a `knipResult` resource with `passed: true` and `issueCount: 0`', function () {
  assertTestPassed(this.denoOutput, 'model.check.execute: writes knipResult with passed=true on zero issues')
})

Then('the method SHALL write a `knipResult` resource with `passed: false` and `issueCount > 0` and SHALL throw', function () {
  assertTestPassed(this.denoOutput, 'model.check.execute: writes resource then throws on non-zero issues')
})

// ── Deno ext tests scenarios ────────────────────────────────────────────────

When('the `focusin-deno-ext-tests.run` method executes and all tests pass', function () {
  this.denoOutput = runDenoTests('extensions/models/focusin_deno_ext_tests_test.ts')
  this.model = 'deno-ext'
})

When('the `focusin-deno-ext-tests.run` method executes and at least one test fails', function () {
  this.denoOutput = runDenoTests('extensions/models/focusin_deno_ext_tests_test.ts')
  this.model = 'deno-ext'
})

When('`focusin-deno-ext-tests.run` completes successfully', function () {
  this.denoOutput = runDenoTests('extensions/models/focusin_deno_ext_tests_test.ts')
  this.model = 'deno-ext'
})

Then(/the method SHALL write a `testResult` resource with `passed: true`, correct `total`\/`passing`\/`failing` counts, and SHALL append deno lcov data to `coverage\/lcov\.info`/, function () {
  assertTestPassed(this.denoOutput, 'model.run.execute: writes testResult with passed=true when all tests pass')
})

Then('the method SHALL write a `testResult` resource with `passed: false`, `failing > 0`, and SHALL throw with the failing test output', function () {
  assertTestPassed(this.denoOutput, 'model.run.execute: writes resource then throws when tests fail')
})

Then(/`coverage\/lcov\.info` SHALL contain the deno extension model coverage entries, enabling `focusin-patch-coverage` to check coverage for `\.ts` files in `extensions\/models\/`/, function () {
  // The test verifies lcov appending: "writes testResult with passed=true" runs lcov append
  assertTestPassed(this.denoOutput, 'model.run.execute: writes testResult with passed=true when all tests pass')
  // Also verify the lcov handling test exists
  assertTestPassed(this.denoOutput, 'model.run.execute: handles lcov command failure gracefully')
})

// ── Patch coverage scenarios ────────────────────────────────────────────────

When('`focusin-patch-coverage.check` runs and every newly added line in staged JS\\/TS source files is hit in the coverage report', function () {
  this.denoOutput = runDenoTests('extensions/models/focusin_patch_coverage_test.ts')
  this.model = 'patch-coverage'
})

When('`focusin-patch-coverage.check` runs and at least one newly added line in a covered file has zero hits', function () {
  this.denoOutput = runDenoTests('extensions/models/focusin_patch_coverage_test.ts')
  this.model = 'patch-coverage'
})

When(/`focusin-patch-coverage\.check` runs and `git diff --cached` returns no added lines \(e\.g\. at push time\)/, function () {
  this.denoOutput = runDenoTests('extensions/models/focusin_patch_coverage_test.ts')
  this.model = 'patch-coverage'
})

When('`focusin-patch-coverage.check` finds uncovered lines', function () {
  this.denoOutput = runDenoTests('extensions/models/focusin_patch_coverage_test.ts')
  this.model = 'patch-coverage'
})

Then('the method SHALL write a `patchCoverageResult` resource with `passed: true` and `uncoveredLines: 0`', function () {
  // Covers both "all staged lines covered" and "no staged changes" scenarios — both produce passed=true
  assertTestPassed(this.denoOutput, 'model.check.execute: passes when all staged lines are covered')
  assertTestPassed(this.denoOutput, 'model.check.execute: vacuous pass when no staged changes')
})

Then('the method SHALL write a `patchCoverageResult` resource with `passed: false`, `uncoveredLines > 0`, and SHALL throw listing the uncovered file:line pairs', function () {
  assertTestPassed(this.denoOutput, 'model.check.execute: writes resource then throws when staged lines uncovered')
})

Then('the `patchCoverageResult` resource SHALL be written before the error is thrown', function () {
  assertTestPassed(this.denoOutput, 'model.check.execute: writes resource then throws when staged lines uncovered')
})
