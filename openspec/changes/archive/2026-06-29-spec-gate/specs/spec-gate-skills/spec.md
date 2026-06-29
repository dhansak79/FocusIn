## Purpose

Defines the Claude skills that guide all human-in-the-loop and agent phases of the spec-gate workflow. Skills are installed as part of the spec-gate extension and replace the openspec skills entirely. A single `/spec` entry point routes to the correct phase based on model state.

## ADDED Requirements

### Requirement: A single entry skill routes to the correct phase
The `/spec` skill SHALL read the current `spec-change` model to determine which phase is active and route to the appropriate sub-flow. If no active change exists it begins the propose flow. If the change is between phases, it resumes from the current phase. If multiple active changes exist it asks the human to select one.

#### Scenario: No active change triggers propose flow
- **GIVEN** no spec-change exists in an active phase
- **WHEN** the developer invokes `/spec`
- **THEN** the skill asks what change they want to build and begins the propose flow

#### Scenario: Active change resumes from current phase
- **GIVEN** a spec-change exists in phase `implementing`
- **WHEN** the developer invokes `/spec`
- **THEN** the skill announces the active change, shows task progress, and resumes implementation

#### Scenario: Multiple active changes prompt selection
- **GIVEN** two spec-changes exist in active phases
- **WHEN** the developer invokes `/spec`
- **THEN** the skill lists the changes and asks which to work on

### Requirement: Propose flow generates proposal and presents it for Gate 1
The propose flow SHALL call `spec-change.create`, generate proposal text covering why this change is needed and what will change at a high level, call `spec-change.set-proposal`, present the proposal clearly to the human, and wait for approval or change requests before calling `spec-change.approve-proposal`.

#### Scenario: Proposal is presented before approval is called
- **GIVEN** the agent has generated a proposal
- **WHEN** the propose flow presents it
- **THEN** the proposal text is shown in full before the agent asks for human approval
- **AND** `approve-proposal` is NOT called until the human confirms

#### Scenario: Human requests changes to the proposal
- **GIVEN** the proposal has been presented
- **WHEN** the human asks to change the scope or framing
- **THEN** the agent revises the proposal text, calls `set-proposal` again, and re-presents
- **AND** does not call `approve-proposal` until the human explicitly confirms

#### Scenario: Human approves proposal and flow advances
- **GIVEN** the proposal has been presented
- **WHEN** the human confirms approval
- **THEN** the skill calls `spec-change.approve-proposal`
- **AND** immediately continues to the scenarios flow

### Requirement: Scenarios flow generates Given/When/Then scenarios and presents them for Gate 2
The scenarios flow SHALL generate structured Given/When/Then scenarios based on the approved proposal, call `spec-change.set-scenarios`, present each scenario clearly formatted to the human, and wait for approval or change requests before calling `spec-change.approve-scenarios`. All generated scenarios MUST include at least one Given step.

#### Scenario: Scenarios are presented with Given/When/Then clearly visible
- **GIVEN** the agent has generated scenarios
- **WHEN** the scenarios flow presents them
- **THEN** each scenario is shown with its Given, When, and Then steps clearly labelled
- **AND** the agent asks for approval or changes before proceeding

#### Scenario: Human requests a new scenario
- **GIVEN** scenarios have been presented
- **WHEN** the human asks to add a scenario for an edge case
- **THEN** the agent adds the scenario, calls `set-scenarios` with the full updated list, and re-presents
- **AND** does not call `approve-scenarios` until the human confirms the complete set

#### Scenario: Human approves scenarios and flow advances
- **GIVEN** scenarios have been presented
- **WHEN** the human confirms the scenarios look correct
- **THEN** the skill calls `spec-change.approve-scenarios`
- **AND** confirms Gate 2 is complete before continuing

### Requirement: Design flow generates technical design after Gate 2
After scenario approval the design flow SHALL generate a technical design covering approach, key decisions, risks, and migration plan, then call `spec-change.set-design`. No human approval gate applies — design is implementation detail. The flow continues automatically to the tasks flow.

#### Scenario: Design is generated and stored without human gate
- **GIVEN** a change has just passed Gate 2 (scenarios approved)
- **WHEN** the design flow runs
- **THEN** the agent generates design text and calls `spec-change.set-design`
- **AND** proceeds to generate tasks without waiting for human confirmation

#### Scenario: Design references the approved scenarios as acceptance criteria
- **GIVEN** the approved scenarios describe specific behaviour
- **WHEN** the agent generates the design
- **THEN** the design text explicitly references which scenarios each design decision is intended to satisfy

### Requirement: Tasks flow generates an implementation checklist after design
The tasks flow SHALL generate a structured task list based on the design and scenarios, grouped into numbered sections with checkbox items, then call `spec-change.set-tasks`. Tasks SHALL be concrete and completable in one session. The flow transitions automatically to the implement flow.

#### Scenario: Tasks are generated from design and scenarios
- **GIVEN** a design exists and scenarios are approved
- **WHEN** the tasks flow runs
- **THEN** the agent generates tasks that cover: step definitions, application code, and any infrastructure needed to make the scenarios pass
- **AND** calls `spec-change.set-tasks` with the full list

#### Scenario: Each task is small enough to complete in one session
- **GIVEN** the tasks flow has generated a task list
- **WHEN** inspecting individual tasks
- **THEN** each task describes a single concrete action (e.g. "create World class in tests/cucumber/support/world.js")
- **AND** no task requires multiple sessions to complete

### Requirement: Implement flow works through tasks with tracking discipline
The implement flow SHALL read the current task list from the model, show overall progress (N/M tasks complete), work through each pending task in order, call `spec-change.complete-task` immediately after each task is done, and pause if it hits a blocker or ambiguity. The flow SHALL NOT attempt to archive or verify automatically.

#### Scenario: Implement flow shows progress before starting
- **GIVEN** a change has 18 tasks with 4 complete
- **WHEN** the implement flow begins
- **THEN** the skill displays "4/18 tasks complete" and lists remaining tasks before starting work

#### Scenario: Task is marked complete immediately after finishing
- **GIVEN** the implement flow is working on task 1.3
- **WHEN** the task is completed
- **THEN** `spec-change.complete-task("1.3")` is called before moving to task 1.4

#### Scenario: Implement flow pauses on a blocker
- **GIVEN** the implement flow encounters an ambiguity or error
- **WHEN** the flow cannot proceed without guidance
- **THEN** it pauses, explains the blocker, and waits for the human before continuing

#### Scenario: Implement flow does not auto-verify or auto-archive
- **GIVEN** all tasks are complete
- **WHEN** the implement flow finishes the last task
- **THEN** it reports all tasks complete and prompts the human to run `/spec` to proceed to verification
- **AND** does NOT call `generate-features`, `record-results`, or `archive` automatically

### Requirement: Verify flow runs spec-gate and presents results
The verify flow SHALL call `spec-change.generate-features`, trigger `swamp workflow run spec-gate`, read the updated scenario statuses from the model, and present a clear pass/fail summary. For failing scenarios it SHALL distinguish between "code does not match spec" (fix code) and "spec needs updating" (requires human re-approval via the scenarios flow).

#### Scenario: Verify presents a clear pass/fail summary
- **GIVEN** the spec-gate workflow has run and results are recorded
- **WHEN** the verify flow presents results
- **THEN** each scenario is shown as ✓ pass or ✗ fail with the capability it belongs to

#### Scenario: Failing scenario routes back to implement
- **GIVEN** a scenario is failing because the implementation is wrong
- **WHEN** the verify flow presents results
- **THEN** it recommends returning to the implement flow to fix the code
- **AND** does not suggest changing the scenario without human instruction

#### Scenario: Spec mismatch routes back to scenarios flow with human gate
- **GIVEN** a scenario is failing because the spec is wrong (behaviour changed by design)
- **WHEN** the verify flow identifies this
- **THEN** it surfaces this explicitly to the human and offers to re-enter the scenarios flow
- **AND** makes clear that changing scenarios requires going through Gate 2 again

#### Scenario: All passing prompts archive
- **GIVEN** every scenario has status pass
- **WHEN** the verify flow presents results
- **THEN** it confirms all scenarios pass and asks the human if they want to archive
