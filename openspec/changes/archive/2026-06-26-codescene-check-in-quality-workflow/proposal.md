## Why

The CodeScene pre-commit health check currently runs as an invisible script in the git hook, with no record of whether it blocked a commit, what issues it found, or how often it fires. Moving it into the swamp `quality-gate` workflow (which already runs at pre-commit via the pre-push hook) makes every check a tracked, queryable run — answering "how often does this gate prevent code health below 10 from being committed?" with real data.

## What Changes

- Remove `node scripts/check-codescene-health.js` from `.githooks/pre-commit`
- Add a new `codescene-health` step to the `quality-gate` workflow that runs the same per-file health check
- The step captures structured output: filename, score, and findings per file so failures can be analysed across runs
- The workflow model that wraps the codescene check stores results as swamp data, enabling future queries and reports

## Capabilities

### New Capabilities

- `codescene-quality-gate`: A swamp model method that runs the CodeScene `cs review` check against staged/changed files and emits structured output (file, score, findings). Replaces the ad-hoc `check-codescene-health.js` script. Integrated as a step in the `quality-gate` workflow so every run is tracked in swamp's data store.

### Modified Capabilities

<!-- No existing spec-level behaviour changes. -->

## Impact

- `.githooks/pre-commit`: remove the `check-codescene-health.js` invocation
- `scripts/check-codescene-health.js`: can be deleted (logic moves to extension model method)
- `workflows/workflow-adb5a2c2-eee7-4dbb-a708-86c7f53cd81a.yaml` (`quality-gate`): new `codescene-health` job added (runs in parallel with or after existing steps, TBD in design)
- New extension model in `extensions/models/` for the codescene check (or extension of existing model if one exists)
- No impact on production extension code, tests, or coverage thresholds
