## Purpose

Defines the runner interface contract that any project must satisfy to integrate with spec-gate, plus the reference implementation for this project using `@cucumber/cucumber`. The runner is the only project-specific component — the rest of spec-gate is language-agnostic.

## ADDED Requirements

### Requirement: Runner contract defines a standard interface
A spec-gate runner SHALL be a swamp model with a `run` method that: (1) accepts an optional feature file glob pattern, (2) executes the project's BDD tool against `tests/cucumber/features/`, (3) writes results to `cucumber-report.json` at a fixed path, and (4) exits zero only when all scenarios pass. Any language or BDD tool may fulfil this contract.

#### Scenario: Runner produces Cucumber JSON at the expected path
- **GIVEN** the runner's `run` method is called
- **WHEN** BDD execution completes (pass or fail)
- **THEN** a `cucumber-report.json` file exists at the project root
- **AND** the file contains valid Cucumber JSON with feature, scenario, and step results

#### Scenario: Runner exits zero only when all scenarios pass
- **GIVEN** all step definitions pass
- **WHEN** the runner completes
- **THEN** the model method exits with success

#### Scenario: Runner exits non-zero when any scenario fails
- **GIVEN** at least one step throws or is undefined
- **WHEN** the runner completes
- **THEN** the model method exits with failure

### Requirement: Reference implementation uses @cucumber/cucumber for this project
The `focusin-spec-runner` swamp model SHALL run `npx cucumber-js --tags 'not @wip' --format json:cucumber-report.json` against `tests/cucumber/features/**/*.feature`. It SHALL use the World class defined in `tests/cucumber/support/world.js` and load step definitions from `tests/cucumber/step-definitions/`. The `--tags 'not @wip'` filter SHALL also be applied when cucumber runs as part of the standard test suite in quality-gate-fast.

#### Scenario: Runner executes Cucumber with @wip filter and JSON formatter
- **GIVEN** feature files exist in `tests/cucumber/features/`
- **WHEN** `focusin-spec-runner.run` is called
- **THEN** `cucumber-js` runs with `--tags 'not @wip'` and `--format json:cucumber-report.json`
- **AND** all step definition files from `tests/cucumber/step-definitions/` are loaded

### Requirement: Step definitions use a shared World with jsdom context
Step definitions for this project SHALL use a Cucumber `World` class in `tests/cucumber/support/world.js`. The World SHALL provide a fresh jsdom `document` and a `chromeMock` per scenario. Given steps set up document state; When steps invoke src/ code; Then steps assert on document state.

#### Scenario: Each scenario gets a fresh World
- **GIVEN** two scenarios run sequentially
- **WHEN** each scenario begins
- **THEN** each receives a new World instance with a fresh document
- **AND** state from the previous scenario does not leak

#### Scenario: Given step sets up DOM precondition
- **GIVEN** a step definition handles `a LinkedIn feed with {int} posts`
- **WHEN** the step executes
- **THEN** it appends the appropriate DOM structure to `this.document.body`

#### Scenario: Then step asserts on DOM state
- **GIVEN** a When step has invoked feed processing code
- **WHEN** a Then step checks `the post is collapsed`
- **THEN** it queries `this.document` for the collapsed state and throws AssertionError if not found
