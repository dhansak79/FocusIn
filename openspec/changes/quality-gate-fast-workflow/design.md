## Context

The pre-commit hook is a 7-step shell script. Every step is fire-and-forget: exit codes gate the commit, but nothing is stored. The `quality-gate` workflow (called from pre-push) already tracks results as swamp data. This change closes the gap by replacing the pre-commit shell script with a `quality-gate-fast` swamp workflow and creating the four missing extension models needed to represent lint, knip, deno extension tests, and patch-coverage.

**Branch ordering**: this change must be implemented on a branch based on `codescene-check-in-quality-workflow` (or merged after it), because `quality-gate-fast` includes the `focusin-codescene.check` step.

Current pre-commit hook steps:
1. `npm run lint`
2. `npm run knip`
3. `npm run coverage` (vitest)
4. `deno test extensions/models/ --coverage`
5. `deno coverage .deno-coverage --lcov >> coverage/lcov.info`
6. `node scripts/check-patch-coverage.js`
7. `node scripts/check-codescene-health.js`

## Goals / Non-Goals

**Goals:**
- Four new extension models so every pre-commit check is trackable as swamp data
- A `quality-gate-fast` workflow (everything except mutation) callable from pre-commit
- `quality-gate` workflow updated to include the same four new model steps
- Pre-commit hook reduced to: `"$SWAMP" workflow run quality-gate-fast`
- `scripts/check-codescene-health.js` removed (replaced by `focusin-codescene.check`)

**Non-Goals:**
- Removing `scripts/check-patch-coverage.js` immediately — keep it until after the Deno port is validated
- Adding new quality checks not already in the pre-commit hook
- Changing graduation criteria for `codescene-health` in `quality-gate` (covered by sibling change)

## Decisions

### 1. Four new extension models, not `command/shell` model steps

Lint, knip, deno-ext-tests, and patch-coverage could be wired as `command/shell` model steps (ad-hoc shell commands). Rejected: CLAUDE.md Rule 1 explicitly prohibits `command/shell` for wrapping tools. Extension models are the correct pattern and give typed schemas, stored results, and testable pure functions — consistent with `focusin_codescene`, `focusin_tests`, `focusin_mutation`.

**Models:**

| Model type | Method | Resource | Runs |
|---|---|---|---|
| `@focusin/lint` | `check` | `lintResult` | `npm run lint` |
| `@focusin/knip` | `check` | `knipResult` | `npm run knip` |
| `@focusin/deno-ext-tests` | `run` | `testResult` | `deno test extensions/models/ --coverage` + `deno coverage --lcov >> lcov.info` |
| `@focusin/patch-coverage` | `check` | `patchCoverageResult` | reimplements `check-patch-coverage.js` logic in Deno |

### 2. Patch-coverage reimplemented in Deno, not shelled out

`focusin-patch-coverage` reimplements the logic from `scripts/check-patch-coverage.js` in TypeScript using `Deno.Command` for git subprocesses and `Deno.readTextFile` for lcov parsing. This is consistent with all other models (which own their logic). The original script is kept alongside it until the Deno port is validated, then deleted in a follow-up task.

### 3. Workflow DAG — five jobs in quality-gate-fast

The five jobs are ordered by filesystem coupling, not just logic. Steps 3–5 share `coverage/lcov.info`:

```
check (parallel: lint, knip, spec-coverage, tests, codescene-health)
  ↓
coverage (vitest coverage → writes coverage/lcov.info)
  ↓
deno-ext (deno test + deno coverage → appends to coverage/lcov.info)
  ↓
patch-coverage (reads combined coverage/lcov.info + git diff --cached)
```

`lint` and `knip` are placed in `check` (parallel with tests) rather than a separate gating job. Reason: on a local machine, parallelism is faster than fail-fast sequential. Lint rarely blocks the other checks in practice, and the workflow step ordering already ensures failures are reported.

`quality-gate` = `quality-gate-fast` jobs + `mutation` job at the end.

### 4. Resource schemas — stored data per model

```
lintResult:          { passed, issueCount, ranAt }
knipResult:          { passed, issueCount, ranAt }
testResult (deno):   { passed, total, passing, failing, durationMs, ranAt }
patchCoverageResult: { passed, uncoveredLines, ranAt }
```

`issueCount` is parsed from the tool's stdout: ESLint reports `N problems`, knip reports `N (type) issues`. Deno test output parses `ok | N passed | N failed`. Patch-coverage counts lines matching `UNCOVERED` in output. All schemas store `ranAt` (ISO timestamp) for time-series queries.

### 5. codescene-health in quality-gate-fast starts allowFailure: false

In `quality-gate`, `codescene-health` is `allowFailure: true` during the graduation phase. In `quality-gate-fast`, it starts `allowFailure: false` because: (a) this change is implemented after the codescene model is proven, and (b) the whole point of the fast workflow is that it faithfully enforces all gates at commit time.

### 6. No allowFailure for new models

New models have clean exit semantics (`npm run lint` exits 1 on failure). They start `allowFailure: false`. No graduation phase needed.

## Risks / Trade-offs

`quality-gate-fast slower than shell script` → Running via swamp adds overhead (model locking, resource writes). Acceptable trade-off: the user explicitly chose tracking over raw speed.

`deno-ext-tests appends to lcov.info` → This filesystem coupling makes the deno-ext job strictly sequential after coverage. If lcov.info is missing (coverage job failed), deno coverage generates a standalone file. The patch-coverage job handles missing/partial lcov gracefully.

`patch-coverage reads git diff --cached` → At push time (quality-gate), there are no staged changes, so git diff --cached returns nothing and patch-coverage passes vacuously. This matches current behaviour.

`Two separate workflow YAML files with duplicated steps` → `quality-gate` and `quality-gate-fast` share 4 jobs. Swamp has no workflow inheritance. Duplication is explicit and acceptable. A future workflow import feature would remove it.

## Migration Plan

1. Implement on a new branch based on merged `codescene-check-in-quality-workflow`
2. Create four extension models + tests
3. Provision four model instances
4. Create `quality-gate-fast` workflow YAML
5. Add the four new steps to `quality-gate` workflow YAML
6. Switch `.githooks/pre-commit` to the single swamp call
7. Remove `scripts/check-codescene-health.js`
8. Validate end-to-end: `git commit` triggers fast workflow, `git push` triggers full workflow

**Rollback**: revert `.githooks/pre-commit` to the original script. The workflow and models are additive.
