## Why

AI-generated code has no automatic connection to the behaviour it was asked to produce — specs are documentation that drifts, tests are written after the fact, and humans review code they can't meaningfully evaluate. Spec-gate closes this loop: a swamp-native workflow where human-approved Given/When/Then scenarios become the executable contract that AI must satisfy before any change can be archived, completing the safeguarded agentic development methodology alongside the existing quality-gate.

## What Changes

- **BREAKING** — OpenSpec CLI dependency removed. Spec workflow is replaced entirely by a swamp extension model, skills, and workflow.
- **New**: `spec-change` swamp extension model — owns the full lifecycle of a specification change (propose → approve → implement → verify → archive) as structured data
- **New**: Spec-gate skills — Claude skills that guide the propose, approve, implement, and verify phases conversationally
- **New**: `spec-gate` swamp workflow — automated verification pipeline that generates Gherkin feature files, triggers the project-side runner, reads Cucumber JSON results, and gates archive on all scenarios passing
- **New**: Project-side runner model (`focusin-spec-runner`) — thin swamp model that executes `.feature` files using the project's BDD tool and emits a standard Cucumber JSON report
- **New**: Step definitions and World setup for this project (JS/Cucumber)
- **Modified**: `spec-coverage` — extended to also recognise feature files as valid scenario coverage
- **Modified**: `quality-gate` workflow — spec-gate verify step added as a gate alongside existing checks

## Capabilities

### New Capabilities
- `spec-change-model`: The swamp extension model that manages specification changes as structured data — scenarios, approval state, phase transitions, and archive gate
- `spec-gate-workflow`: The automated verify-and-archive workflow — feature file generation, runner invocation, Cucumber JSON ingestion, scenario status updates, and archive guard
- `spec-gate-skills`: Claude skills for the human-in-the-loop phases — propose (AI drafts scenarios), approve (human reviews conversationally), implement (AI codes to pass scenarios), verify (AI reads results and decides next step)
- `spec-runner`: Project-side runner model interface — the contract a project must satisfy to integrate with spec-gate (accepts feature files, emits Cucumber JSON); includes a reference implementation for this project using `@cucumber/cucumber`

### Modified Capabilities
- `spec-coverage`: Cucumber JSON report and generated feature files now count as valid coverage alongside `it('Scenario: ...')` boundary tests

## Impact

- Removes: `@fission-ai/openspec` CLI dependency, openspec skills, `openspec/changes/` workflow
- Retains: `openspec/specs/` directory structure (spec markdown files stay as human-readable documentation, generated from model data)
- Adds: swamp extension in `extensions/models/spec-change/`, new skills in `.claude/skills/`, `tests/cucumber/` directory
- Modifies: `scripts/spec-coverage.js`, `workflows/quality-gate.yaml`, `package.json`
- Cross-cutting: affects the development workflow for all future changes to this project
