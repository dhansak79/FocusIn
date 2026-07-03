import { Given, When, Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { parseRun, computeGuardrailCatches, renderGuardrailCatchesCard } from '../../../scripts/generate-guardrails-dashboard.js'

const HOUR = 60 * 60 * 1000
const BASE = new Date('2026-06-25T10:00:00Z').getTime()

function makeFailedCodesceneDoc(id, errorText) {
  return {
    id,
    workflowName: 'quality-gate-fast',
    status: 'failed',
    startedAt: new Date(BASE).toISOString(),
    jobs: [{ steps: [{ stepName: 'codescene-health', status: 'failed', error: errorText }] }],
  }
}

function makeRun(offsetMs, overrides = {}) {
  return {
    id: `run-${offsetMs}`,
    workflowName: overrides.workflowName ?? 'quality-gate',
    status: overrides.status ?? 'succeeded',
    startedAt: new Date(BASE + offsetMs).toISOString(),
    completedAt: new Date(BASE + offsetMs + 5 * 60 * 1000).toISOString(),
    blockingStep: overrides.blockingStep ?? null,
    metrics: {
      codescene: 'codescene' in overrides ? overrides.codescene : { passed: true, failedFiles: 0, files: [] },
    },
  }
}

// Scenario: Extracting score from a degraded-file error message
Given(
  /^a codescene-health step failed with an error message containing a file path and score like "\(9\.38\/10\)"$/,
  function () {
    this.doc = makeFailedCodesceneDoc(
      'run-score-extract',
      'CodeScene health gate failed — 1 file(s) introduced degradations:\n  /repo/src/example.js  (9.38/10)'
    )
  }
)

When('the dashboard parses that step', function () {
  this.parsedRun = parseRun(this.doc)
})

Then("the parsed result includes that file's score and a gap-to-10 of 0.62", function () {
  assert.deepEqual(this.parsedRun.metrics.codescene.files[0], {
    path: '/repo/src/example.js',
    score: 9.38,
    gapToTen: 0.62,
  })
})

// Scenario: Computing gap-to-10 for multiple degraded files in one run
Given('a codescene-health failure error listing several degraded files with different scores', function () {
  this.doc = makeFailedCodesceneDoc(
    'run-multi-file',
    'CodeScene health gate failed — 2 file(s) introduced degradations:\n' +
      '  /repo/src/a.js  (9.68/10)\n' +
      '  /repo/src/b.js  (8.41/10)'
  )
})

Then('each file\'s gap-to-10 is computed independently and every file appears in the parsed result', function () {
  const files = this.parsedRun.metrics.codescene.files
  assert.equal(files.length, 2)
  assert.deepEqual(files[0], { path: '/repo/src/a.js', score: 9.68, gapToTen: 0.32 })
  assert.deepEqual(files[1], { path: '/repo/src/b.js', score: 8.41, gapToTen: 1.59 })
})

// Scenario: Counting total guardrail catches across workflows
Given('telemetry containing codescene-health failures from both quality-gate and quality-gate-fast runs', function () {
  this.runs = [
    makeRun(0, {
      workflowName: 'quality-gate',
      codescene: { passed: false, failedFiles: 1, files: [{ path: '/repo/src/a.js', score: 9.0, gapToTen: 1.0 }] },
    }),
    makeRun(HOUR, {
      workflowName: 'quality-gate-fast',
      codescene: { passed: false, failedFiles: 1, files: [{ path: '/repo/src/b.js', score: 8.5, gapToTen: 1.5 }] },
    }),
  ]
})

When('the dashboard summary is built', function () {
  this.catches = computeGuardrailCatches(this.runs)
  this.html = renderGuardrailCatchesCard(this.catches)
})

Then(
  'the Code Health Guardrail Catches card shows the total catch count broken out by pre-commit and pre-push',
  function () {
    assert.equal(this.catches.totalCatches, 2)
    assert.deepEqual(this.catches.byWorkflow, { 'quality-gate': 1, 'quality-gate-fast': 1 })
    assert.ok(this.html.includes('Code Health Guardrail Catches'))
  }
)

// Scenario: Breaking down catches by file
Given('telemetry where the same file is caught by the codescene-health gate in more than one run', function () {
  this.runs = [
    makeRun(0, {
      codescene: { passed: false, failedFiles: 1, files: [{ path: '/repo/src/flaky.js', score: 9.0, gapToTen: 1.0 }] },
    }),
    makeRun(HOUR, {
      codescene: { passed: false, failedFiles: 1, files: [{ path: '/repo/src/flaky.js', score: 8.8, gapToTen: 1.2 }] },
    }),
  ]
})

Then('the card lists that file with a catch count reflecting every run it appeared in', function () {
  const entry = this.catches.byFile.find((f) => f.path === '/repo/src/flaky.js')
  assert.deepEqual(entry, { path: '/repo/src/flaky.js', count: 2 })
  assert.ok(this.html.includes('/repo/src/flaky.js'))
})

// Scenario: Reporting average and worst gap-to-10
Given('telemetry containing multiple codescene-health catches with different scores', function () {
  this.runs = [
    makeRun(0, {
      codescene: { passed: false, failedFiles: 1, files: [{ path: '/repo/src/a.js', score: 9.0, gapToTen: 1.0 }] },
    }),
    makeRun(HOUR, {
      codescene: { passed: false, failedFiles: 1, files: [{ path: '/repo/src/b.js', score: 8.0, gapToTen: 2.0 }] },
    }),
  ]
})

Then('the card shows the average gap-to-10 and the single worst largest gap-to-10 across all catches', function () {
  assert.equal(this.catches.avgGap, 1.5)
  assert.equal(this.catches.worstGap, 2.0)
  assert.ok(this.html.includes('1.50'))
  assert.ok(this.html.includes('2.00'))
})

// Scenario: No guardrail catches recorded
Given('telemetry where every codescene-health run passed', function () {
  this.runs = [makeRun(0), makeRun(HOUR)]
})

Then('the card reports zero catches instead of an error or blank section', function () {
  assert.equal(this.catches.totalCatches, 0)
  assert.ok(this.html.includes('Code Health Guardrail Catches'))
  assert.ok(this.html.includes('>0<'))
})

// Scenario: Malformed error message without a parseable score
Given(
  /^a codescene-health failure whose error text does not match the \(score\/10\) pattern$/,
  function () {
    this.doc = makeFailedCodesceneDoc(
      'run-malformed',
      'CodeScene health gate failed — 1 file(s) introduced degradations:\n  /repo/src/weird.js  score unavailable'
    )
  }
)

Then('the file is still counted as a catch with a null score rather than crashing the parser', function () {
  assert.deepEqual(this.parsedRun.metrics.codescene.files[0], {
    path: '/repo/src/weird.js',
    score: null,
    gapToTen: null,
  })
})
