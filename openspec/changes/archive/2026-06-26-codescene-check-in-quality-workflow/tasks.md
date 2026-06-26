## 1. Extension Model

- [x] 1.1 Create `extensions/models/focusin_codescene.ts` with `@focusin/codescene` model, `healthResult` resource schema (`passed`, `failedFiles`, `ranAt`, `files[]` with typed `name`/`oldScore`/`newScore`/`findings`), and `check` method that extends PATH with `~/.local/bin`, checks `cs` is available, runs `cs delta main --output-format json`, and builds the result
- [x] 1.2 Add unit-testable pure functions: `parseDeltaOutput(raw)` to parse and map kebab-case output fields (`f['old-score']` → `oldScore`, `f['new-score']` → `newScore`), and `buildHealthResult(files, ranAt)` to derive envelope fields
- [x] 1.3 Create `extensions/models/focusin_codescene_test.ts` covering: empty array (no degradations), one failing file with findings, `cs` binary not found (fails with clear message), `old-score: null` for new files parsed correctly
- [x] 1.4 Verify the extension bundles without error

## 2. Workflow Integration (Phase 1)

- [x] 2.1 Add `codescene-health` step to the `check` job in `workflows/workflow-adb5a2c2-eee7-4dbb-a708-86c7f53cd81a.yaml` using model `focusin-codescene` and method `check`, with `allowFailure: true`
- [x] 2.2 Provision the model instance: `swamp model create @focusin/codescene focusin-codescene --global-arg projectDir=$(pwd)`
- [x] 2.3 Run `swamp workflow run quality-gate` and confirm the `codescene-health` step writes a `healthResult` resource with a valid `ranAt` field

## 3. Graduation (Phase 2)

- [x] 3.1 Confirm graduation criteria: 3 consecutive workflow runs with valid `healthResult` written AND (at least one `failedFiles > 0` run observed OR 5+ clean pushes with no unexplained missing results)
- [x] 3.2 Flip `allowFailure: true` → `allowFailure: false` in the workflow YAML
- [x] 3.3 Run `swamp workflow run quality-gate` to confirm the step now blocks on failure

## 4. Pre-commit Cleanup (Phase 3 — only after Phase 2 complete)

- [ ] 4.1 Remove `node scripts/check-codescene-health.js` from `.githooks/pre-commit`
- [ ] 4.2 Delete `scripts/check-codescene-health.js`
- [ ] 4.3 Verify `git commit` no longer invokes CodeScene

## 5. Validation

- [x] 5.1 Run `npm test && npm run coverage` to confirm existing tests still pass and coverage thresholds are met
- [x] 5.2 Run `swamp workflow run quality-gate` end-to-end and verify all five steps complete: spec-coverage, tests, codescene-health, coverage, mutation
- [x] 5.3 Confirm `healthResult` data is stored: `swamp data latest focusin-codescene healthResult` shows a result with `ranAt`, `failedFiles`, and `files` array
