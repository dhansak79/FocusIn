Feature: quality-gate-fast-workflow


  Scenario: workflow completes with all steps passing
    When `quality-gate-fast` is run on a branch where all checks pass
    Then all five jobs SHALL complete with status `succeeded` and each SHALL write its corresponding swamp data resource


  Scenario: lint failure blocks the workflow
    When `quality-gate-fast` runs and `lint` step fails
    Then the `check` job SHALL fail and the subsequent `coverage`, `deno-ext`, and `patch-coverage` jobs SHALL NOT run


  Scenario: test failure blocks coverage job
    When `quality-gate-fast` runs and the `tests` step in the `check` job fails
    Then the `coverage` job SHALL NOT run (dependsOn: check with condition: succeeded)


  Scenario: coverage job precedes deno-ext job
    When `quality-gate-fast` runs successfully through the `coverage` job
    Then the `deno-ext` job SHALL run next, and SHALL append deno coverage data to `coverage/lcov.info` before `patch-coverage` reads it


  Scenario: quality-gate includes lint, knip, deno-ext, and patch-coverage
    When the `quality-gate` workflow is run
    Then it SHALL execute lint, knip, spec-coverage, vitest tests, CodeScene health, vitest coverage, deno extension tests, and patch-coverage steps, followed by mutation testing


  Scenario: mutation job depends on all preceding jobs
    When any step in `quality-gate` before mutation fails
    Then the `mutation` job SHALL NOT run
