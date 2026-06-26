## ADDED Requirements

### Requirement: CodeScene health check runs as a tracked workflow step
The system SHALL execute the CodeScene `cs delta main` health check as a step in the `quality-gate` swamp workflow, and SHALL store the structured result (per-file score and findings) as a swamp data resource on every run.

#### Scenario: No degradations introduced on branch
- **WHEN** the `quality-gate` workflow runs and no changed files on the branch have introduced new health findings
- **THEN** the `codescene-health` step SHALL pass and SHALL write a `healthResult` resource with `passed: true` and `failedFiles: 0`

#### Scenario: At least one file introduces a health degradation
- **WHEN** the `quality-gate` workflow runs and at least one changed file has introduced new health findings vs. `main`
- **THEN** the `codescene-health` step SHALL fail and SHALL write a `healthResult` resource with `passed: false`, `failedFiles > 0`, and the failing file(s) listed with their `newScore` and `findings`

#### Scenario: No files degraded on branch
- **WHEN** the `quality-gate` workflow runs and `cs delta main` returns an empty array (no degradations)
- **THEN** the `codescene-health` step SHALL pass and SHALL write a `healthResult` resource with `failedFiles: 0` and `passed: true`

#### Scenario: `cs` CLI not installed
- **WHEN** the `quality-gate` workflow runs and the `cs` binary is not available on PATH
- **THEN** the `codescene-health` step SHALL fail with a human-readable error message indicating that the CodeScene CLI must be installed

### Requirement: Health check result is stored with per-file degradation data
The `healthResult` resource SHALL capture, for every degraded file: the file path, old and new numeric health scores, and the raw findings array. Files that were modified but not degraded SHALL NOT appear in the stored `files` array (this reflects `cs delta` output behaviour — only degraded files are returned).

#### Scenario: Degraded file stored with findings
- **WHEN** a file has introduced new health findings during the check
- **THEN** the stored `healthResult` SHALL include that file's `name`, `newScore`, and a non-empty `findings` array containing at least one entry with a `category` field

#### Scenario: Result is stored even when nothing degraded
- **WHEN** `cs delta main` returns an empty array
- **THEN** the stored `healthResult` SHALL still be written with `passed: true`, `failedFiles: 0`, and an empty `files` array

### Requirement: CodeScene check removed from pre-commit hook
The `check-codescene-health.js` script invocation SHALL be removed from `.githooks/pre-commit` and the script SHALL be deleted. This SHALL only happen after the `codescene-health` workflow step has graduated from `allowFailure: true` to `allowFailure: false` (see design.md Rollout section). The health gate SHALL then run exclusively via the `quality-gate` workflow at pre-push time.

#### Scenario: Pre-commit no longer runs CodeScene check (post-graduation)
- **WHEN** a developer runs `git commit` after Phase 3 cleanup
- **THEN** the pre-commit hook SHALL NOT invoke `check-codescene-health.js` or any equivalent CodeScene CLI call

#### Scenario: Pre-push enforces health gate
- **WHEN** a developer runs `git push`
- **THEN** the pre-push hook SHALL trigger the `quality-gate` workflow which SHALL include the `codescene-health` step
