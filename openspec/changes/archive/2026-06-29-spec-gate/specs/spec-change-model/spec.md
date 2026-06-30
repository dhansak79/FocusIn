## Purpose

Defines the `spec-change` swamp extension model — the core data structure and state machine that owns the full lifecycle of a specification change. This is the replacement for the openspec CLI change directory.

## ADDED Requirements

### Requirement: Model stores specification change as structured data
The `spec-change` model SHALL store each change as structured data with the following fields: `name` (string), `phase` (enum), `proposal_text` (string — why/what), `design_text` (string — technical approach), `scenarios` (array of structured Given/When/Then objects with a `status` field), `tasks` (array of `{id, description, done}` objects), and timestamps for each approval event. Scenario status SHALL be one of `pending`, `pass`, or `fail`.

#### Scenario: New change is created with empty fields
- **GIVEN** a developer starts a new specification change named `semantic-filter`
- **WHEN** the `create` method is called with the change name
- **THEN** the model stores the change in `draft` phase with empty proposal, scenarios, design, and tasks

#### Scenario: Scenario data is queryable by status
- **GIVEN** a change exists with a mix of passing and failing scenarios
- **WHEN** the model data is accessed
- **THEN** scenarios can be filtered by `status: fail` to identify what needs fixing

#### Scenario: Task list is queryable by completion
- **GIVEN** a change has ten tasks, four of which are marked done
- **WHEN** the model data is accessed
- **THEN** incomplete tasks are filterable, and progress is derivable as 4/10

### Requirement: Model enforces a phase state machine with two human gates
The model SHALL enforce the following phase sequence and reject any out-of-order transition:

`draft` → `proposal-pending-approval` → `proposal-approved` → `scenarios-pending-approval` → `approved` → `designing` → `tasking` → `implementing` → `verifying` → `archived`

Gate 1 is `proposal-pending-approval` (human approves the why/what). Gate 2 is `scenarios-pending-approval` (human approves the executable behaviour contract). No phase may be skipped.

#### Scenario: Valid phase transition succeeds
- **GIVEN** a change is in phase `approved`
- **WHEN** the `start-designing` method is called
- **THEN** the phase transitions to `designing`

#### Scenario: Invalid phase transition is rejected
- **GIVEN** a change is in phase `proposal-pending-approval`
- **WHEN** the `archive` method is called directly
- **THEN** the model raises an error and the phase does not change

#### Scenario: Skipping a gate phase is rejected
- **GIVEN** a change is in phase `proposal-approved`
- **WHEN** the `approve-scenarios` method is called without first transitioning to `scenarios-pending-approval`
- **THEN** the model raises an error

### Requirement: Proposal text is set and approved as Gate 1
The `set-proposal` method SHALL store the proposal text and transition from `draft` to `proposal-pending-approval`. The `approve-proposal` method SHALL transition to `proposal-approved` and record an approval timestamp. It SHALL reject if proposal text is empty.

#### Scenario: Proposal is set and awaits approval
- **GIVEN** a change is in `draft` phase
- **WHEN** `set-proposal` is called with non-empty text
- **THEN** the proposal text is stored and the phase moves to `proposal-pending-approval`

#### Scenario: Proposal approval records timestamp
- **GIVEN** a change is in `proposal-pending-approval` with non-empty proposal text
- **WHEN** `approve-proposal` is called
- **THEN** the phase moves to `proposal-approved` and a `proposal_approved_at` timestamp is recorded

#### Scenario: Empty proposal is rejected at approval
- **GIVEN** a change is in `proposal-pending-approval` with empty proposal text
- **WHEN** `approve-proposal` is called
- **THEN** the model raises an error

### Requirement: Scenarios are set and approved as Gate 2
The `set-scenarios` method SHALL store structured scenario data and transition from `proposal-approved` to `scenarios-pending-approval`. The `approve-scenarios` method SHALL transition to `approved` and record an approval timestamp. It SHALL reject if no scenarios exist.

#### Scenario: Scenarios are set and await approval
- **GIVEN** a change is in `proposal-approved` phase
- **WHEN** `set-scenarios` is called with at least one scenario
- **THEN** scenarios are stored with `status: pending` and the phase moves to `scenarios-pending-approval`

#### Scenario: Scenario approval records timestamp
- **GIVEN** a change is in `scenarios-pending-approval` with at least one scenario
- **WHEN** `approve-scenarios` is called
- **THEN** the phase moves to `approved` and a `scenarios_approved_at` timestamp is recorded

#### Scenario: Approval with no scenarios is rejected
- **GIVEN** a change is in `scenarios-pending-approval` with zero scenarios
- **WHEN** `approve-scenarios` is called
- **THEN** the model raises an error explaining scenarios must exist before approval

### Requirement: Design text and tasks are set after approval
The `set-design` method SHALL store design text and transition from `approved` to `designing`. The `set-tasks` method SHALL store a task list and transition from `designing` to `tasking`. Both are agent-generated — no human approval gate applies.

#### Scenario: Design is stored after scenario approval
- **GIVEN** a change is in `approved` phase
- **WHEN** `set-design` is called with non-empty text
- **THEN** the design text is stored and the phase moves to `designing`

#### Scenario: Tasks are stored after design
- **GIVEN** a change is in `designing` phase
- **WHEN** `set-tasks` is called with a list of tasks
- **THEN** all tasks are stored with `done: false` and the phase moves to `tasking`

### Requirement: Tasks are tracked during implementation
The `start-implementing` method SHALL transition from `tasking` to `implementing`. The `complete-task` method SHALL mark a specific task as `done: true` by task ID. Both methods SHALL reject if the change is not in the correct phase.

#### Scenario: Task is marked complete
- **GIVEN** a change is in `implementing` phase with task `1.1` incomplete
- **WHEN** `complete-task` is called with id `1.1`
- **THEN** the task's `done` field is set to `true`

#### Scenario: Completing a task in wrong phase is rejected
- **GIVEN** a change is in `approved` phase
- **WHEN** `complete-task` is called
- **THEN** the model raises an error

### Requirement: Model generates standard Gherkin feature files
The `generate-features` method SHALL read all scenarios from the model and write one `.feature` file per capability to `tests/cucumber/features/`. Each file SHALL contain valid standard Gherkin. The method SHALL warn but not fail for scenarios missing a Given step. This method MAY be called at any phase from `approved` onwards.

#### Scenario: Feature file is generated per capability
- **GIVEN** a change has scenarios for capabilities `semantic-filter` and `tone-filter`
- **WHEN** `generate-features` is called
- **THEN** `tests/cucumber/features/semantic-filter.feature` is written
- **AND** `tests/cucumber/features/tone-filter.feature` is written

#### Scenario: Scenario steps map to Gherkin keywords
- **GIVEN** a scenario has `given`, `when`, and `then` arrays
- **WHEN** `generate-features` writes the feature file
- **THEN** `given` items are prefixed `Given`/`And`, `when` items `When`/`And`, `then` items `Then`/`And`

### Requirement: Model ingests Cucumber JSON and updates scenario statuses
The `record-results` method SHALL read a `cucumber-report.json` file, match each result to a scenario by name, and update the scenario's `status` to `pass` or `fail`. Scenarios not present in the report SHALL remain `pending`. The method SHALL transition the phase from `implementing` to `verifying`.

#### Scenario: Passing scenario is marked pass
- **GIVEN** a Cucumber JSON report has a scenario named `Checkbox exists and is off by default` with all steps passed
- **WHEN** `record-results` is called with the report path
- **THEN** the matching scenario's status is updated to `pass`

#### Scenario: Failing scenario is marked fail
- **GIVEN** a Cucumber JSON report has a scenario with a failed step
- **WHEN** `record-results` is called
- **THEN** the matching scenario's status is updated to `fail`

#### Scenario: Unmatched scenario stays pending
- **GIVEN** a scenario exists in the model with no matching entry in the report
- **WHEN** `record-results` is called
- **THEN** the scenario's status remains `pending`

### Requirement: Archive method is gated by all scenarios passing
The `archive` method SHALL refuse to execute unless every scenario has `status: pass`. If any scenario has `status: fail` or `status: pending` the method SHALL raise a descriptive error listing the non-passing scenarios. The method SHALL only be callable from `verifying` phase.

#### Scenario: Archive succeeds when all scenarios pass
- **GIVEN** a change is in `verifying` phase with every scenario at `status: pass`
- **WHEN** `archive` is called
- **THEN** the phase transitions to `archived` and an archive timestamp is recorded

#### Scenario: Archive blocked by failing scenario
- **GIVEN** a change has one scenario with `status: fail`
- **WHEN** `archive` is called
- **THEN** the model raises an error naming the failing scenario and the phase does not change

#### Scenario: Archive blocked by pending scenario
- **GIVEN** a change has one scenario with `status: pending`
- **WHEN** `archive` is called
- **THEN** the model raises an error naming the pending scenario and the phase does not change
