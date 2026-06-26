## ADDED Requirements

### Requirement: pre-commit hook calls quality-gate-fast as a single command
The `.githooks/pre-commit` hook SHALL invoke `quality-gate-fast` via the swamp CLI as its sole quality gate, replacing the previous multi-step shell pipeline.

#### Scenario: pre-commit triggers quality-gate-fast on git commit
- **WHEN** a developer runs `git commit`
- **THEN** the pre-commit hook SHALL run `$SWAMP workflow run quality-gate-fast` and the commit SHALL succeed only if all steps in `quality-gate-fast` pass

#### Scenario: pre-commit hook uses path-resilient swamp invocation
- **WHEN** the pre-commit hook runs on a machine where `swamp` is not on PATH
- **THEN** the hook SHALL fall back to `~/.swamp/bin/swamp`, consistent with the pre-push hook pattern

#### Scenario: pre-commit no longer invokes shell quality scripts directly
- **WHEN** a developer runs `git commit` after this change
- **THEN** the hook SHALL NOT directly invoke `npm run lint`, `npm run knip`, `npm run coverage`, `deno test`, `check-patch-coverage.js`, or `check-codescene-health.js`

### Requirement: check-codescene-health.js script removed
The `scripts/check-codescene-health.js` file SHALL be deleted as part of this change, since the CodeScene check is now handled by the `focusin-codescene.check` step in the `quality-gate-fast` workflow.

#### Scenario: CodeScene check runs via swamp model after this change
- **WHEN** the pre-commit hook runs
- **THEN** the CodeScene health check SHALL execute through the `focusin-codescene` swamp model method, not via the standalone script
