## Why

The pre-commit hook is a 7-step shell script that runs checks in sequence but produces no historical data — failures are ephemeral, results are untracked, and there's no way to answer "how often does lint fail?" or "how frequently do patch-coverage gaps fire?". The `quality-gate` workflow (pre-push) already solves this with swamp model tracking, but pre-commit still lives outside that system. Consolidating everything into two swamp workflows (fast and full) gives uniform observability across both gates and reduces the pre-commit hook to a single maintainable line.

## What Changes

- **New `quality-gate-fast` swamp workflow** — runs all quality checks except mutation: lint, knip, deno extension tests, spec-coverage, vitest, CodeScene health, vitest coverage, and patch-coverage.
- **New extension models** — four new swamp extension models covering the checks not yet tracked: `focusin-lint`, `focusin-knip`, `focusin-deno-ext-tests`, and `focusin-patch-coverage`.
- **Updated `quality-gate` workflow** — adds the same four new models as steps (lint, knip, deno ext tests, patch-coverage) so the full push workflow also tracks these.
- **Pre-commit hook simplified** — the 7-step shell script is replaced with a single call: `$SWAMP workflow run quality-gate-fast`.
- **Dependency note** — this change depends on `codescene-check-in-quality-workflow` graduating (Phase 2: `allowFailure: false`) before the pre-commit hook is switched, since `quality-gate-fast` will include `codescene-health` as a blocking step.

## Capabilities

### New Capabilities

- `quality-gate-fast-workflow`: A new swamp workflow (`quality-gate-fast`) that runs all quality checks except mutation, intended to be called from the pre-commit hook.
- `pre-commit-single-workflow-call`: The pre-commit hook is reduced to a single swamp workflow call, with all check results tracked as swamp data resources.
- `lint-knip-deno-patch-models`: Four new extension models that expose lint, knip, deno extension tests, and patch-coverage as trackable swamp model methods with stored results.

### Modified Capabilities

_(none — no existing spec-level requirements change)_

## Impact

- `.githooks/pre-commit` — replaced with two-line hook calling `quality-gate-fast`
- `extensions/models/` — four new extension model files + test files
- `models/@focusin/` — four new model instance YAML files
- `workflows/` — two YAML files updated/created: `quality-gate-fast` (new) and `quality-gate` (updated with new model steps)
- **Ordering constraint**: implement after `codescene-check-in-quality-workflow` is merged and graduated
