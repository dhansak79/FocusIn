import { Given, When, Then, After } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// These scenarios exercise the spec-change extension model through the real
// `swamp` CLI (the same public interface a human or agent uses), since
// spec_change.ts is a Deno module with no TS loader wired into this
// project's Node-based Cucumber runner. A disposable fixture change is
// created per scenario and cleaned up in the After hook below.

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '../../..')
const TMP_DIR = join(ROOT, '.tmp')
const FIXTURE_NAME = 'spec-gate-verify-loop-fixture'

function runSwamp(args) {
  return execFileSync('swamp', args, { cwd: ROOT, encoding: 'utf-8' })
}

function stateFilePath() {
  return join(ROOT, '.swamp', `spec-change-${FIXTURE_NAME}.json`)
}

function featureFilePath() {
  return join(ROOT, 'tests/cucumber/features', `${FIXTURE_NAME}.feature`)
}

function readFixtureState() {
  return JSON.parse(readFileSync(stateFilePath(), 'utf-8'))
}

function cleanupFixture() {
  const paths = [
    stateFilePath(),
    featureFilePath(),
    join(TMP_DIR, `${FIXTURE_NAME}-scenarios.yaml`),
    join(TMP_DIR, `${FIXTURE_NAME}-report-passed.json`),
    join(TMP_DIR, `${FIXTURE_NAME}-report-failed.json`),
  ]
  for (const path of paths) {
    try {
      rmSync(path)
    } catch {
      // Already gone — fine.
    }
  }
}

function writeCucumberReportFixture(status) {
  mkdirSync(TMP_DIR, { recursive: true })
  const path = join(TMP_DIR, `${FIXTURE_NAME}-report-${status}.json`)
  const report = [
    {
      elements: [
        { name: 'Fixture scenario', steps: [{ result: { status } }] },
      ],
    },
  ]
  writeFileSync(path, JSON.stringify(report))
  return path
}

// Drives the fixture change from scratch through to "verifying" phase, with
// its one scenario recording the given outcome ("passed" or "failed").
function buildFixtureToVerifying(outcome) {
  cleanupFixture()
  runSwamp(['model', 'method', 'run', 'spec-change', 'create', '--input', `name=${FIXTURE_NAME}`])
  runSwamp([
    'model', 'method', 'run', 'spec-change', 'set-proposal',
    '--input', `name=${FIXTURE_NAME}`, '--input', 'text=Fixture proposal for testing the verify loop.',
  ])
  runSwamp(['model', 'method', 'run', 'spec-change', 'approve-proposal', '--input', `name=${FIXTURE_NAME}`])

  mkdirSync(TMP_DIR, { recursive: true })
  const scenariosPath = join(TMP_DIR, `${FIXTURE_NAME}-scenarios.yaml`)
  writeFileSync(
    scenariosPath,
    [
      `name: ${FIXTURE_NAME}`,
      'scenarios:',
      '  - name: Fixture scenario',
      '    given: ["a fixture precondition"]',
      '    when: ["a fixture action"]',
      '    then: ["a fixture outcome"]',
      '',
    ].join('\n'),
  )
  runSwamp(['model', 'method', 'run', 'spec-change', 'set-scenarios', '--input-file', scenariosPath])
  runSwamp(['model', 'method', 'run', 'spec-change', 'approve-scenarios', '--input', `name=${FIXTURE_NAME}`])
  runSwamp([
    'model', 'method', 'run', 'spec-change', 'set-design',
    '--input', `name=${FIXTURE_NAME}`, '--input', 'text=Fixture design.',
  ])
  runSwamp([
    'model', 'method', 'run', 'spec-change', 'set-tasks',
    '--input', `name=${FIXTURE_NAME}`,
    '--input', 'tasks=[{"id":"1","description":"fixture task"}]',
  ])
  runSwamp(['model', 'method', 'run', 'spec-change', 'start-implementing', '--input', `name=${FIXTURE_NAME}`])

  const reportPath = writeCucumberReportFixture(outcome)
  runSwamp([
    'model', 'method', 'run', 'spec-change', 'record-results',
    '--input', `name=${FIXTURE_NAME}`, '--input', `reportPath=${reportPath}`,
  ])
}

After(function () {
  if (this.specGateFixtureActive) {
    cleanupFixture()
    delete this.specGateFixtureActive
  }
})

// ---------------------------------------------------------------------------
// "A passed/failed scenario is not re-tagged @wip on a later regeneration"
// ---------------------------------------------------------------------------

Given(/^a spec-change scenario has already recorded a (passing|failing) result$/, function (outcome) {
  buildFixtureToVerifying(outcome === 'passing' ? 'passed' : 'failed')
  this.specGateFixtureActive = true
})

When('generate-features runs again for that change', function () {
  runSwamp(['model', 'method', 'run', 'spec-change', 'generate-features', '--input', `name=${FIXTURE_NAME}`])
})

Then("the scenario's entry in the generated feature file has no @wip tag", function () {
  const content = readFileSync(featureFilePath(), 'utf-8')
  assert.equal(content.includes('@wip'), false)
  assert.equal(content.includes('Scenario: Fixture scenario'), true)
})

// ---------------------------------------------------------------------------
// "record-results can be re-run after the verifying phase has already been entered"
// ---------------------------------------------------------------------------

Given('a spec-change has already moved to the verifying phase from a prior record-results call', function () {
  buildFixtureToVerifying('passed')
  this.specGateFixtureActive = true
  const state = readFixtureState()
  assert.equal(state.phase, 'verifying')
})

When('record-results is called again with a fresh cucumber report', function () {
  const reportPath = writeCucumberReportFixture('failed')
  this.secondRecordResultsError = null
  try {
    runSwamp([
      'model', 'method', 'run', 'spec-change', 'record-results',
      '--input', `name=${FIXTURE_NAME}`, '--input', `reportPath=${reportPath}`,
    ])
  } catch (err) {
    this.secondRecordResultsError = err
  }
})

Then('it succeeds and updates scenario statuses without requiring a manual phase reset', function () {
  assert.equal(this.secondRecordResultsError, null)
  const state = readFixtureState()
  assert.equal(state.phase, 'verifying')
  assert.equal(state.scenarios[0].status, 'fail')
})
