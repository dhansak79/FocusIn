Feature: spec-gate-verify-loop-fix

  Scenario: A passed scenario is not re-tagged @wip on a later feature-file regeneration
    Given a spec-change scenario has already recorded a passing result
    When generate-features runs again for that change
    Then the scenario's entry in the generated feature file has no @wip tag

  Scenario: A failed scenario is not re-tagged @wip either
    Given a spec-change scenario has already recorded a failing result
    When generate-features runs again for that change
    Then the scenario's entry in the generated feature file has no @wip tag

  Scenario: record-results can be re-run after the verifying phase has already been entered
    Given a spec-change has already moved to the verifying phase from a prior record-results call
    When record-results is called again with a fresh cucumber report
    Then it succeeds and updates scenario statuses without requiring a manual phase reset
