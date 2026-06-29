## Context

The project currently uses `@fission-ai/openspec` to manage specification changes: a CLI that scaffolds change directories, tracks artifact completion, and merges delta specs into main specs on archive. Specs are markdown-first, scenarios have no Given step, and there is no execution path — specs are documentation only.

The quality-gate workflow already gates code quality (lint, tests, coverage, mutation, CodeScene). Spec-gate is the complementary workflow for requirements: it ensures AI-generated code matches the behaviour a human actually approved. Together they form the complete safeguarded agentic development methodology.

Spec-gate must be language-agnostic so it can be packaged and shared with clients using different stacks (JS, C#, Python, Go, etc.).

## Goals / Non-Goals

**Goals:**
- Replace openspec CLI with a swamp-native model that owns the full spec change lifecycle as structured data
- Two human approval gates: proposal (what to build) and scenarios (how it should behave)
- Agent generates design and tasks after Gate 2 — no human gate on implementation planning
- Scenarios exported as standard Gherkin `.feature` files committed to the repo
- BDD tests run as part of the standard test suite at commit time alongside vitest
- Project-side runner executes feature files and emits Cucumber JSON (supported by every major BDD tool)
- Spec-gate reads Cucumber JSON, updates scenario statuses in the model, gates archive on all passing
- Shareable: the extension model, skills, and workflow are generic; only the runner is project-specific
- `@wip` tagging for incremental scenario implementation without breaking the gate

**Non-Goals:**
- Building a general-purpose BDD framework (we use existing tools per project)
- Replacing unit/integration tests (BDD covers behaviour, existing tests cover code internals)
- Migrating historical archived specs (existing `openspec/specs/` markdown stays as human-readable record)
- Real-time scenario execution during implementation (verify runs as a discrete phase via `/spec verify`)
- Async or out-of-conversation approval (conversational approval is sufficient for now)

## Decisions

### 1. Structured data over markdown-first

**Decision**: Scenarios, proposal, design, and tasks are stored as structured data in the swamp model. Markdown spec files are rendered outputs, not the source of truth.

**Rationale**: Structured data enables the agent to query scenario status, filter failing scenarios, generate feature files without parsing markdown, and track task completion. It also enables reporting and dashboards over spec health. The full data model is: `name`, `phase`, `proposal_text`, `design_text`, `scenarios` (array of `{given, when, then, status}`), `tasks` (array of `{id, description, done}`), and approval timestamps.

**Alternative**: Keep markdown-first (openspec approach). Rejected — parsing markdown to drive test execution is fragile, and markdown cannot natively represent scenario pass/fail state or task completion.

### 2. Two human gates via conversational approval

**Decision**: There are two explicit human gates. Gate 1: the agent presents the proposal (why/what) and waits for the human to approve before generating scenarios. Gate 2: the agent presents the scenarios (Given/When/Then) and waits for the human to approve before generating design and tasks. Both gates are conversational — the human responds in-chat, the agent calls the appropriate model method to record approval.

**Rationale**: The proposal gate ensures the human agrees on scope before any scenarios are written. The scenario gate is the binding behaviour contract — the human is approving what the system will do, not how. Design and tasks are implementation detail and do not need human approval.

**Alternative**: Single gate on scenarios only (no proposal gate). Rejected — approving scenarios without agreeing on scope first wastes iteration cycles.

**Alternative**: File-based async approval (write to file, human edits, triggers command). Deferred — can be added as a workflow variant for client engagements where the reviewer is not in the coding session.

### 3. Ten-phase state machine

**Decision**: The model enforces the following phase sequence with no skipping allowed:

`draft` → `proposal-pending-approval` → `proposal-approved` → `scenarios-pending-approval` → `approved` → `designing` → `tasking` → `implementing` → `verifying` → `archived`

Phase transitions are enforced in the model — the agent cannot bypass them by calling methods out of order.

**Rationale**: The phase machine makes the workflow state explicit and auditable. It prevents the agent from, for example, archiving without verifying, or generating tasks before scenarios are approved.

### 4. Implement phase with task-tracking discipline

**Decision**: After scenarios are approved, the agent generates design text and a task list (both stored in the model). The implement phase works through tasks in order, calling `spec-change.complete-task(id)` immediately after each task is done, and showing N/M progress. The implement phase does not auto-verify or auto-archive.

**Rationale**: Preserves the discipline of `/opsx:apply` — the human can see progress, the agent pauses on blockers, and tasks are the unit of work. Scenarios are the acceptance criteria; tasks are how you get there.

### 5. Gherkin as the universal export format

**Decision**: The model exports standard Gherkin `.feature` files to `tests/cucumber/features/`. This is the input to any BDD tool regardless of language.

**Rationale**: Gherkin is the single format understood by Cucumber (JS/Ruby/Java), ReqnRoll/SpecFlow (C#), Behave (Python), Godog (Go), and others. Using it means spec-gate is not coupled to any specific runner. Clients with any stack can adopt the workflow.

**Alternative**: Export a custom JSON spec format. Rejected — every runner would need a custom adapter; Gherkin adapters already exist for every major language.

### 6. Feature files are committed to the repository

**Decision**: Generated feature files are committed as part of the implementation, not gitignored.

**Rationale**: Feature files are deliverables, not build artifacts. Committing them means they are always present for the test suite and spec-coverage without sequencing dependencies. They appear in PR diffs, providing reviewers visibility of scenario changes alongside implementation code.

### 7. @wip tagging for incremental implementation

**Decision**: When `generate-features` first writes a feature file, every scenario is tagged `@wip`. The Cucumber runner is configured with `--tags 'not @wip'` so unimplemented scenarios are skipped. As step definitions are written and verified, `@wip` is removed from individual scenarios. The gate is green as long as all non-`@wip` scenarios pass. Spec-coverage counts `@wip` scenarios as covered (the feature file entry exists).

**Rationale**: This allows incremental implementation without ever breaking the commit gate. It is the permanent mechanism for new changes (all scenarios start `@wip`) and the migration mechanism for existing specs (all legacy scenarios start `@wip`, implemented one-by-one on future branches).

**Alternative**: Stub step definitions that return `pending()` for all unimplemented scenarios. Rejected — pending steps are invisible in the feature file; `@wip` tags are explicit and communicate intent to reviewers.

### 8. BDD tests run in the standard test suite, not a separate quality gate job

**Decision**: Cucumber runs as part of the `tests` step in `quality-gate-fast` (pre-commit) alongside vitest, using `--tags 'not @wip'`. There is no separate `spec-gate` job in either quality gate workflow. The spec-gate workflow (generate-features → run-runner → record-results) is a development-time tool invoked only by the `/spec verify` skill.

**Rationale**: BDD tests are tests. They belong with the other tests at commit time. Adding a separate gate job at push time would delay feedback and create artificial separation between BDD correctness and unit test correctness. The spec-gate workflow serves a different purpose: updating scenario statuses in the model so the archive guard can evaluate them.

**Alternative**: Spec-gate as a separate push-time quality gate job. Rejected — BDD test failure should block at commit, same as any other test failure.

### 9. Spec-coverage moves to push gate only

**Decision**: Spec-coverage is removed from `quality-gate-fast` (pre-commit) and runs only in `quality-gate` (pre-push). At push time it checks that every scenario across all specs in `openspec/specs/` has either a boundary test (`it('Scenario: ...')`) or a feature file entry. `@wip` tagged scenarios count as covered.

**Rationale**: Spec-coverage is a completeness check, not a correctness check. Correctness is already covered by the test suite at commit time. Completeness is a push concern — it is acceptable to commit without full coverage during active development, but unacceptable to push.

### 10. Cucumber JSON as the result protocol

**Decision**: Project-side runners produce a `cucumber-report.json` file after execution. Spec-gate reads this to update scenario statuses.

**Rationale**: Cucumber JSON is natively supported by every major BDD tool. ReqnRoll, Behave, Godog, and Cucumber all have Cucumber JSON formatters. It maps directly to Feature → Scenario → Step structure.

**Alternative**: JUnit XML. Available everywhere but loses Gherkin-specific structure. Rejected.

### 11. Runner model as project-specific adapter

**Decision**: The spec-gate extension defines a runner interface contract (accepts feature file path, emits `cucumber-report.json`). Each project provides a thin runner model that fulfils this contract using their own BDD tool. This project uses `focusin-spec-runner` with `@cucumber/cucumber`.

**Rationale**: Keeps the extension generic. A C# client uses `dotnet test` with ReqnRoll. A Python client uses Behave. Spec-gate only cares about the Cucumber JSON output.

### 12. Archive guard is a hard model constraint

**Decision**: `spec-change.archive()` refuses to execute unless every scenario has `status: pass`. This is enforced in the model method, not just in the skill. The agent cannot bypass it.

**Rationale**: If the guard is advisory, it will be bypassed under pressure. A hard constraint means the only way to archive is to make scenarios pass — or explicitly remove a scenario, which requires a human decision surfaced by the skill.

### 13. Skill files are versioned with the extension

**Decision**: Spec-gate ships its own `.claude/skills/` files. `openspec update` is no longer called and cannot overwrite them. Skills are: `/spec` (router), plus sub-skills for propose, scenarios, design, tasks, implement, and verify phases.

**Rationale**: Eliminates the openspec update clobbering problem entirely. Skill behaviour is versioned alongside the model and workflow.

## Risks / Trade-offs

- **Step definition authoring is still manual** → Mitigation: skills guide the agent to write step defs alongside implementation; `/spec verify` surfaces undefined steps immediately
- **Cucumber JSON schema varies slightly between tools** → Mitigation: spec-gate's JSON reader handles the common subset; edge cases addressed per runner with a normalisation utility
- **Swamp extension model is new code to maintain** → Mitigation: the model is a state machine with data, not complex logic; the archive guard is the most critical path to test
- **@wip scenarios can accumulate indefinitely** → Mitigation: spec-coverage at push time catches legacy gaps; dashboard reporting over `@wip` count can be added as a swamp report
- **Clients may use BDD tools with partial Cucumber JSON support** → Mitigation: document the minimum required fields in the runner contract

## Migration Plan

1. Complete `fix-whitelist-bypass-promoted-keyword` under openspec (do not migrate mid-flight)
2. Build and validate the `spec-change` extension model with full phase machine and both approval gates
3. Write spec-gate skills covering all seven phases (propose, scenarios, design, tasks, implement, verify, archive)
4. Wire up `focusin-spec-runner` and validate: generate-features → cucumber-js → cucumber-report.json
5. **On this branch**: generate feature files for all existing specs with all scenarios tagged `@wip`, implement one scenario end-to-end (write step defs, remove `@wip`, verify passes), commit all feature files
6. Update `focusin-tests` model to run vitest + cucumber in the tests step
7. Remove spec-coverage from `quality-gate-fast`; add it to `quality-gate` after check job
8. Remove openspec skills from `.claude/skills/openspec-*/`; update `CLAUDE.md`
9. **Future branches**: implement remaining `@wip` scenarios capability by capability
