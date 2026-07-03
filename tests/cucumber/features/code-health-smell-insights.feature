Feature: code-health-smell-insights

  Scenario: Extracting score from a degraded-file error message
    Given a codescene-health step failed with an error message containing a file path and score like "(9.38/10)"
    When the dashboard parses that step
    Then the parsed result includes that file's score and a gap-to-10 of 0.62

  Scenario: Computing gap-to-10 for multiple degraded files in one run
    Given a codescene-health failure error listing several degraded files with different scores
    When the dashboard parses that step
    Then each file's gap-to-10 is computed independently and every file appears in the parsed result

  Scenario: Counting total guardrail catches across workflows
    Given telemetry containing codescene-health failures from both quality-gate and quality-gate-fast runs
    When the dashboard summary is built
    Then the Code Health Guardrail Catches card shows the total catch count broken out by pre-commit and pre-push

  Scenario: Breaking down catches by file
    Given telemetry where the same file is caught by the codescene-health gate in more than one run
    When the dashboard summary is built
    Then the card lists that file with a catch count reflecting every run it appeared in

  Scenario: Reporting average and worst gap-to-10
    Given telemetry containing multiple codescene-health catches with different scores
    When the dashboard summary is built
    Then the card shows the average gap-to-10 and the single worst largest gap-to-10 across all catches

  Scenario: No guardrail catches recorded
    Given telemetry where every codescene-health run passed
    When the dashboard summary is built
    Then the card reports zero catches instead of an error or blank section

  Scenario: Malformed error message without a parseable score
    Given a codescene-health failure whose error text does not match the (score/10) pattern
    When the dashboard parses that step
    Then the file is still counted as a catch with a null score rather than crashing the parser
