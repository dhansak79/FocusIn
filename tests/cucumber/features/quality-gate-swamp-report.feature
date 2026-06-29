Feature: quality-gate-swamp-report


  Scenario: Report runs on a successful gate
    When `swamp workflow run quality-gate` completes with `status: succeeded`
    Then the report executes and produces a markdown summary and a JSON artifact persisted as `report-quality-gate-summary-json`


  Scenario: Report runs on a failed gate
    When `swamp workflow run quality-gate` completes with `status: failed`
    Then the report still executes and records the failing step name and the metric value that caused the failure


  Scenario: Report shows first attempt
    When no prior `quality-gate` runs exist within the last 4 hours
    Then the markdown output includes "Attempt 1"


  Scenario: Report shows subsequent attempt after a failure
    When one prior `quality-gate` run with `status: failed` exists within the last 4 hours
    Then the markdown output includes "Attempt 2"


  Scenario: All steps produce metric output
    When all quality-gate steps complete and produce data handles
    Then the report table includes a row for each metric with its value and pass/fail status


  Scenario: Step was skipped due to upstream failure
    When a downstream step (e.g. mutation) was skipped because a preceding step failed
    Then the skipped step's row shows "skipped" rather than a metric value


  Scenario: JSON is queryable via swamp data
    When the report completes
    Then `swamp data get focusin-quality-gate report-quality-gate-summary-json --json` returns the structured JSON above
