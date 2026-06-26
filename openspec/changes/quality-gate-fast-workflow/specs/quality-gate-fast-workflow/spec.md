## ADDED Requirements

### Requirement: quality-gate-fast workflow exists and runs all checks except mutation
The system SHALL provide a swamp workflow named `quality-gate-fast` that runs lint, knip, spec-coverage, vitest tests, CodeScene health, vitest coverage, deno extension tests, and patch-coverage — in the order dictated by filesystem coupling — but SHALL NOT include mutation testing.

#### Scenario: workflow completes with all steps passing
- **WHEN** `quality-gate-fast` is run on a branch where all checks pass
- **THEN** all five jobs SHALL complete with status `succeeded` and each SHALL write its corresponding swamp data resource

#### Scenario: lint failure blocks the workflow
- **WHEN** `quality-gate-fast` runs and `lint` step fails
- **THEN** the `check` job SHALL fail and the subsequent `coverage`, `deno-ext`, and `patch-coverage` jobs SHALL NOT run

#### Scenario: test failure blocks coverage job
- **WHEN** `quality-gate-fast` runs and the `tests` step in the `check` job fails
- **THEN** the `coverage` job SHALL NOT run (dependsOn: check with condition: succeeded)

#### Scenario: coverage job precedes deno-ext job
- **WHEN** `quality-gate-fast` runs successfully through the `coverage` job
- **THEN** the `deno-ext` job SHALL run next, and SHALL append deno coverage data to `coverage/lcov.info` before `patch-coverage` reads it

### Requirement: quality-gate workflow includes all quality-gate-fast steps plus mutation
The `quality-gate` workflow (used for pre-push) SHALL include all steps from `quality-gate-fast` in addition to the existing `mutation` job, so that both workflows share the same base set of tracked checks.

#### Scenario: quality-gate includes lint, knip, deno-ext, and patch-coverage
- **WHEN** the `quality-gate` workflow is run
- **THEN** it SHALL execute lint, knip, spec-coverage, vitest tests, CodeScene health, vitest coverage, deno extension tests, and patch-coverage steps, followed by mutation testing

#### Scenario: mutation job depends on all preceding jobs
- **WHEN** any step in `quality-gate` before mutation fails
- **THEN** the `mutation` job SHALL NOT run
