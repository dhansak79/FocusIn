## Purpose

Defines the requirements for the swamp workflow-scope report that runs after every `quality-gate` execution, producing a per-run summary and structured JSON artifact for downstream dashboard consumption.

## Requirements

### Requirement: Workflow-scope report runs after every quality-gate execution
A swamp report extension SHALL be registered on the `quality-gate` workflow with scope `workflow`. It SHALL execute after every quality-gate run regardless of whether the run succeeded or failed, and SHALL produce both markdown and JSON output.

#### Scenario: Report runs on a successful gate
- **WHEN** `swamp workflow run quality-gate` completes with `status: succeeded`
- **THEN** the report executes and produces a markdown summary and a JSON artifact persisted as `report-quality-gate-summary-json`

#### Scenario: Report runs on a failed gate
- **WHEN** `swamp workflow run quality-gate` completes with `status: failed`
- **THEN** the report still executes and records the failing step name and the metric value that caused the failure

### Requirement: Report displays attempt number within the current session
The report SHALL infer the attempt number for the current run by querying `report-quality-gate-summary-json` history to count how many recent runs of `quality-gate` occurred within a 4-hour window before this run, treating `status: failed` and `status: running` (interrupted) runs as prior attempts.

#### Scenario: Report shows first attempt
- **WHEN** no prior `quality-gate` runs exist within the last 4 hours
- **THEN** the markdown output includes "Attempt 1"

#### Scenario: Report shows subsequent attempt after a failure
- **WHEN** one prior `quality-gate` run with `status: failed` exists within the last 4 hours
- **THEN** the markdown output includes "Attempt 2"

### Requirement: Report markdown includes per-step metric values
The markdown output SHALL include a table of key quality metrics extracted from the current run's step outputs: spec coverage %, test pass/fail, coverage %, patch coverage pass/fail, code health pass/fail, and mutation score where available.

#### Scenario: All steps produce metric output
- **WHEN** all quality-gate steps complete and produce data handles
- **THEN** the report table includes a row for each metric with its value and pass/fail status

#### Scenario: Step was skipped due to upstream failure
- **WHEN** a downstream step (e.g. mutation) was skipped because a preceding step failed
- **THEN** the skipped step's row shows "skipped" rather than a metric value

### Requirement: Report JSON is structured for downstream use
The JSON output SHALL conform to the shape:
```json
{
  "runId": "<workflowRunId>",
  "workflowName": "quality-gate",
  "status": "succeeded|failed|running",
  "startedAt": "<ISO8601>",
  "attemptNumber": 1,
  "sessionStartedAt": "<ISO8601 of first run in session>",
  "blockingStep": "<stepName or null>",
  "metrics": {
    "specCoverage": { "pct": 32.1, "passed": false },
    "tests": { "passed": true, "total": 47, "failing": 0 },
    "coverage": { "lines": 91.3, "passed": true },
    "patchCoverage": { "passed": true },
    "codeHealth": { "passed": true, "failedFiles": 0 },
    "mutation": { "score": 87.4, "passed": true }
  }
}
```

#### Scenario: JSON is queryable via swamp data
- **WHEN** the report completes
- **THEN** `swamp data get focusin-quality-gate report-quality-gate-summary-json --json` returns the structured JSON above
