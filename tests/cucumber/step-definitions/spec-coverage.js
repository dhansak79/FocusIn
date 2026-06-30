import { Given, When, Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { findFiles, parseScenariosFromFeature } from '../../../scripts/spec-coverage.js'
import { RunScript } from '../screenplay/tasks/RunScript.js'
import { ScriptResult } from '../screenplay/questions/ScriptResult.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '../../..')
const SCRIPT = join(ROOT, 'scripts', 'spec-coverage.js')

const writeTmpFeature = (world, content) => {
  const tmp = join(ROOT, `.tmp-spec-cov-${Date.now()}`)
  mkdirSync(tmp, { recursive: true })
  const file = join(tmp, 'test.feature')
  writeFileSync(file, content)
  world.tmpDir = tmp
  world.tmpFeatureFile = file
}

Given('a feature file containing a Scenario with no @wip tag', function () {
  writeTmpFeature(this, 'Feature: test\n\n  Scenario: Things work\n    Given a thing\n')
})

Given('a feature file containing a Scenario preceded by @wip', function () {
  writeTmpFeature(this, 'Feature: test\n\n  @wip\n  Scenario: Not yet done\n    Given something\n')
})

Given('a feature file with one active scenario and one @wip scenario', function () {
  writeTmpFeature(
    this,
    'Feature: test\n\n  Scenario: Done\n    Given done\n\n  @wip\n  Scenario: Not done\n    Given pending\n'
  )
})

Given('a feature file where @wip precedes one scenario and a second scenario has no tag', function () {
  writeTmpFeature(
    this,
    'Feature: test\n\n  @wip\n  Scenario: Pending\n    Given pending\n\n  Scenario: Active\n    Given active\n'
  )
})

When('parseScenariosFromFeature is called on that file', function () {
  this.parseResult = parseScenariosFromFeature(this.tmpFeatureFile)
  if (this.tmpDir) rmSync(this.tmpDir, { recursive: true, force: true })
})

Then('the scenario is returned with wip: false', function () {
  assert.equal(this.parseResult.length, 1)
  assert.equal(this.parseResult[0].wip, false)
})

Then('the scenario is returned with wip: true', function () {
  assert.equal(this.parseResult.length, 1)
  assert.equal(this.parseResult[0].wip, true)
})

Then('the active scenario has wip: false and the @wip scenario has wip: true', function () {
  assert.equal(this.parseResult.length, 2)
  assert.equal(this.parseResult[0].wip, false)
  assert.equal(this.parseResult[1].wip, true)
})

Then('only the first scenario has wip: true', function () {
  assert.equal(this.parseResult.length, 2)
  assert.equal(this.parseResult[0].wip, true)
  assert.equal(this.parseResult[1].wip, false)
})

Given('a nested directory of files with mixed extensions', function () {
  const tmp = join(ROOT, `.tmp-find-${Date.now()}`)
  mkdirSync(join(tmp, 'sub'), { recursive: true })
  writeFileSync(join(tmp, 'a.feature'), '')
  writeFileSync(join(tmp, 'sub', 'b.feature'), '')
  writeFileSync(join(tmp, 'c.txt'), '')
  this.tmpDir = tmp
  this.findRoot = tmp
})

When('findFiles is called with a .feature predicate', function () {
  this.findResult = findFiles(this.findRoot, (n) => n.endsWith('.feature'))
  if (this.tmpDir) rmSync(this.tmpDir, { recursive: true, force: true })
})

Then('only .feature files from all subdirectories are returned', function () {
  assert.equal(this.findResult.length, 2)
  assert.ok(this.findResult.some((f) => f.endsWith('a.feature')))
  assert.ok(this.findResult.some((f) => f.endsWith('b.feature')))
})

When('the CLI is run with --change and a non-existent change name', function () {
  return this.attemptsTo(RunScript.atPath(SCRIPT, ['--change', 'nonexistent-change-xyz']))
})

Then('it exits with a non-zero code and prints a clear error message', function () {
  assert.notEqual(this.asksAbout(ScriptResult.exitCode()), 0)
  assert.ok(this.asksAbout(ScriptResult.stderr()).includes('feature file not found'))
})

When('the CLI scans the features directory', function () {
  return this.attemptsTo(RunScript.atPath(SCRIPT))
})

Then(/the output ends with a line matching `Summary: N \/ T scenarios covered`/, function () {
  assert.match(this.asksAbout(ScriptResult.stdout()), /Summary: \d+ \/ \d+ scenarios covered/)
})

Given('at least one scenario in the features directory is tagged @wip', function () {
  // Create a temporary @wip feature file so the CLI detects it
  const tmp = join(ROOT, `tests/cucumber/features/.tmp-wip-${Date.now()}.feature`)
  writeFileSync(tmp, 'Feature: temp\n\n  @wip\n  Scenario: Not done\n    Given something pending\n')
  this.tmpWipFeature = tmp
})

When('the CLI runs', function () {
  return this.attemptsTo(RunScript.atPath(SCRIPT))
})

Then('it exits with code 1', function () {
  assert.equal(this.asksAbout(ScriptResult.exitCode()), 1)
})

