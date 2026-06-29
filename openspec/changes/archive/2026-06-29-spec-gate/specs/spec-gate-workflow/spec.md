## Purpose

Defines the `spec-gate` swamp workflow — the development-time verification pipeline that generates Gherkin feature files, triggers the project-side runner, and ingests results back into the `spec-change` model. This workflow is invoked by the `/spec verify` skill during development, not by the quality gate. BDD tests enter the quality gate as a standard part of the test suite.

## ADDED Requirements

### Requirement: Spec-gate workflow generates feature files then runs verification
The `spec-gate` swamp workflow SHALL execute in sequence: (1) call `spec-change.generate-features` to write `.feature` files, (2) call the project-side runner model to execute them and produce `cucumber-report.json`, (3) call `spec-change.record-results` to update scenario statuses in the model. The workflow SHALL fail if the runner exits non-zero.

#### Scenario: Workflow runs full verify pipeline
- **GIVEN** a spec-change exists with scenarios in `pending` status
- **WHEN** the `spec-gate` workflow runs
- **THEN** feature files are generated first
- **AND** the project runner executes them
- **AND** scenario statuses are updated from the Cucumber JSON report

#### Scenario: Workflow fails when runner exits non-zero
- **GIVEN** one or more step definitions throw assertion errors
- **WHEN** the project runner executes the feature files
- **THEN** the runner exits non-zero
- **AND** the spec-gate workflow is marked failed

### Requirement: Generated feature files are committed to the repository
Feature files written by `generate-features` SHALL be committed to the repository as part of the implementation. They are a deliverable of the spec workflow, not a throwaway build artifact. Committing them means they are always present for the test suite and spec-coverage without any sequencing dependency.

#### Scenario: Feature files are present after cloning the repository
- **GIVEN** a developer clones the repository
- **WHEN** they look in `tests/cucumber/features/`
- **THEN** the generated feature files are present without needing to run any generation step

#### Scenario: Feature file changes appear in pull request diffs
- **GIVEN** a spec-change has been implemented and feature files generated
- **WHEN** the developer opens a pull request
- **THEN** the feature files are visible in the diff alongside the implementation code

### Requirement: Unimplemented scenarios are tagged @wip and excluded from the test run
Scenarios that have a feature file entry but no step definitions SHALL be tagged `@wip` in the feature file. The Cucumber runner SHALL be configured with `--tags 'not @wip'` so that `@wip` scenarios are excluded from execution. Only scenarios with the `@wip` tag removed must pass. This applies both during migration of existing specs and during active spec-change implementation where scenarios are implemented incrementally.

#### Scenario: @wip scenario is skipped by the runner
- **GIVEN** a feature file contains a scenario tagged `@wip`
- **WHEN** cucumber-js runs with `--tags 'not @wip'`
- **THEN** that scenario is not executed and does not affect the test result

#### Scenario: Implemented scenario without @wip must pass
- **GIVEN** a scenario has its `@wip` tag removed and step definitions written
- **WHEN** cucumber-js runs
- **THEN** the scenario executes and a failing step blocks the test run

#### Scenario: All scenarios begin as @wip when feature files are first generated
- **GIVEN** `generate-features` runs for the first time for a capability
- **WHEN** the feature file is written
- **THEN** every scenario in that file is tagged `@wip`

### Requirement: BDD tests run as part of the standard test suite
Cucumber SHALL be integrated into the project's test command so that BDD scenarios run alongside unit tests on every commit. The `focusin-tests` swamp model SHALL invoke both vitest and cucumber-js as part of its `test` method. A failing BDD scenario blocks the commit gate through the same mechanism as a failing vitest test.

#### Scenario: BDD tests run on every commit
- **GIVEN** a developer commits code
- **WHEN** the pre-commit hook runs `swamp workflow run quality-gate-fast`
- **THEN** the `tests` step runs both vitest and cucumber-js
- **AND** a failing scenario causes the commit to be blocked

#### Scenario: BDD test failure blocks the same way as a unit test failure
- **GIVEN** a scenario step definition throws an assertion error
- **WHEN** the tests step runs in quality-gate-fast
- **THEN** the tests step fails
- **AND** the overall quality-gate-fast fails with a clear message identifying the failing scenario

### Requirement: Spec-gate workflow is not part of the quality gate pipelines
The `spec-gate` workflow SHALL NOT be added as a job to `quality-gate` or `quality-gate-fast`. It is a development-time tool invoked by the `/spec verify` skill. The quality gate runs BDD tests through the standard test step.

#### Scenario: Quality-gate does not include a spec-gate job
- **GIVEN** a developer pushes a branch
- **WHEN** the pre-push hook runs `swamp workflow run quality-gate`
- **THEN** no `spec-gate` workflow job is triggered
- **AND** BDD correctness is already verified by the tests step that ran at commit time
