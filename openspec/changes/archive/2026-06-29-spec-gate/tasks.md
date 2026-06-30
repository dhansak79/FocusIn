## 1. Spec-Change Extension Model

- [x] 1.1 Scaffold `extensions/models/spec-change/` extension with swamp model structure
- [x] 1.2 Define the data schema: name, phase, proposal_text, design_text, scenarios (given/when/then arrays, status), tasks ({id, description, done}), approval timestamps
- [x] 1.3 Implement `create(name)` method — initialises change in `draft` phase with empty fields
- [x] 1.4 Implement phase state machine covering all 10 phases with transition guards (reject invalid transitions and phase skips)
- [x] 1.5 Implement `set-proposal(text)` method — stores proposal text, transitions `draft` → `proposal-pending-approval`
- [x] 1.6 Implement `approve-proposal()` method — Gate 1: transitions to `proposal-approved`, records timestamp, rejects if proposal text is empty
- [x] 1.7 Implement `set-scenarios(scenarios)` method — stores structured scenario data, transitions `proposal-approved` → `scenarios-pending-approval`
- [x] 1.8 Implement `approve-scenarios()` method — Gate 2: transitions to `approved`, records timestamp, rejects if no scenarios
- [x] 1.9 Implement `set-design(text)` method — stores design text, transitions `approved` → `designing`
- [x] 1.10 Implement `set-tasks(tasks)` method — stores task list with `done: false`, transitions `designing` → `tasking`
- [x] 1.11 Implement `start-implementing()` method — transitions `tasking` → `implementing`
- [x] 1.12 Implement `complete-task(id)` method — marks task done, rejects if not in `implementing` phase
- [x] 1.13 Implement `generate-features()` method — writes standard Gherkin `.feature` files to `tests/cucumber/features/`, callable from `approved` phase onwards
- [x] 1.14 Implement `record-results(reportPath)` method — reads Cucumber JSON, updates scenario statuses, transitions `implementing` → `verifying`
- [x] 1.15 Implement `archive()` method — guards on all scenarios passing, transitions `verifying` → `archived`, records timestamp
- [x] 1.16 Write extension unit tests covering: archive guard, both approval gates, phase transition guards, task completion

## 2. Project-Side Runner

- [x] 2.1 Add `@cucumber/cucumber` to `devDependencies` in `package.json`
- [x] 2.2 Create `tests/cucumber/support/world.js` with World class (jsdom document, chromeMock)
- [x] 2.3 Create `tests/cucumber/step-definitions/` directory with an initial `common.js` for shared steps
- [x] 2.4 Create `cucumber.mjs` configuration pointing to `tests/cucumber/features/` and step definitions
- [x] 2.5 Update `focusin-tests` swamp model `test` method to run both vitest and cucumber-js
- [x] 2.6 Scaffold `extensions/models/focusin_spec_runner.ts` model with a `run` method for development-time verify (generates cucumber-report.json)
- [x] 2.7 Validate end-to-end: generate-features → commit feature files → tests step runs cucumber → passes

## 3. Spec-Gate Skills

- [x] 3.1 Create `.claude/commands/spec.md` — entry router: reads model phase, routes to correct sub-flow, handles multi-change selection
- [x] 3.2 Create `.claude/commands/spec/propose.md` — propose flow: create change, generate proposal text, present, iterate, call `approve-proposal` (Gate 1)
- [x] 3.3 Create `.claude/commands/spec/scenarios.md` — scenarios flow: generate Given/When/Then scenarios from approved proposal, present, iterate, call `approve-scenarios` (Gate 2)
- [x] 3.4 Create `.claude/commands/spec/design.md` — design flow: generate technical design referencing scenarios, call `set-design`, continue automatically to tasks
- [x] 3.5 Create `.claude/commands/spec/tasks.md` — tasks flow: generate implementation checklist from design + scenarios, call `set-tasks`, continue to implement
- [x] 3.6 Create `.claude/commands/spec/implement.md` — implement flow: show N/M progress, work through tasks, call `complete-task` after each, pause on blockers, do not auto-verify
- [x] 3.7 Create `.claude/commands/spec/verify.md` — verify flow: generate features, trigger spec-gate workflow, present ✓/✗ summary, distinguish code-fix vs spec-revision paths
- [x] 3.8 Skills auto-discovered from `.claude/commands/` — no settings.json registration needed

## 4. Spec-Gate Workflow

- [x] 4.1 Create `spec-gate` swamp workflow with jobs: generate-features → run-runner → record-results
- [x] 4.2 Remove spec-coverage step from `quality-gate-fast` `check` job
- [x] 4.3 Add `spec-coverage` job to `quality-gate` (push) as a standalone job after `check`
- [x] 4.4 Verify `quality-gate-fast` has no spec-coverage step and no spec-gate job
- [x] 4.5 Verify `quality-gate` has no spec-gate job — BDD correctness is covered by the tests step

## 5. Spec-Coverage Extension

- [x] 5.1 Update `scripts/spec-coverage.js` to also scan `tests/cucumber/features/**/*.feature` for `Scenario: <name>` matches
- [x] 5.2 Update unit tests in `tests/` for spec-coverage to cover the feature file matching path

## 6. End-to-End Validation

- [x] 6.1 Write step definitions for `spec-coverage-unit` end-to-end (pure function, no DOM/timers needed)
- [x] 6.2 Run `/spec` skill through full propose → approve → implement → verify → archive flow on a real change
- [x] 6.3 Archive guard enforced in model: `archive()` throws when scenarios are not all `pass` (covered by unit tests)
- [x] 6.4 Quality-gate tests step runs cucumber via `focusin-tests` model; BDD failure blocks commit via same path as vitest failure

## 7. Existing Spec Migration (this branch)

- [x] 7.1 Generate feature files for all existing specs in `openspec/specs/*/spec.md` — all scenarios tagged `@wip`
- [x] 7.2 Pick one scenario from one spec to implement end-to-end — chose `spec-coverage-unit` (pure function, no DOM/timers)
- [x] 7.3 Write World class (`tests/cucumber/support/world.js`) and step definitions (`tests/cucumber/step-definitions/spec-coverage-unit.js`)
- [x] 7.4 Remove `@wip` tag from all 5 `spec-coverage-unit` scenarios
- [x] 7.5 Verify the full pipeline: cucumber runs, one scenario passes, all others skipped, gate is green
- [x] 7.6 Commit all feature files (as deliverables, not generated artifacts)

## 8. Removal of OpenSpec

- [x] 8.1 Complete `fix-whitelist-bypass-promoted-keyword` change under openspec before migrating (archived — will retry under spec-gate on next branch)
- [x] 8.2 Remove openspec skill files from `.claude/skills/openspec-*/`
- [x] 8.3 Update `CLAUDE.md` to reference spec-gate skills instead of openspec
- [x] 8.4 Document that `openspec/specs/` markdown files are now rendered outputs (generated by model), not source of truth
