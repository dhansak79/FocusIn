## 1. focusin-lint Extension Model

- [x] 1.1 Create `extensions/models/focusin_lint.ts` with `@focusin/lint` model, `lintResult` resource schema (`passed`, `issueCount`, `ranAt`), and `check` method that runs `npm run lint`, parses ESLint issue count from stdout, writes resource before throwing on failure
- [x] 1.2 Export pure functions: `parseLintOutput(stdout)` → `issueCount: number`, `buildLintResult(issueCount, ranAt)` → `{ passed, issueCount, ranAt }`
- [x] 1.3 Create `extensions/models/focusin_lint_test.ts` covering: zero issues (passed), non-zero issues (writes then throws), exit code non-zero with zero-count output (fails), npm not found (throws with message)
- [x] 1.4 Verify bundle: `swamp extension bundle`

## 2. focusin-knip Extension Model

- [x] 2.1 Create `extensions/models/focusin_knip.ts` with `@focusin/knip` model, `knipResult` resource schema (`passed`, `issueCount`, `ranAt`), and `check` method that runs `npm run knip`, parses issue count from stdout, writes resource before throwing on failure
- [x] 2.2 Export pure functions: `parseKnipOutput(stdout)` → `issueCount: number`, `buildKnipResult(issueCount, ranAt)` → `{ passed, issueCount, ranAt }`
- [x] 2.3 Create `extensions/models/focusin_knip_test.ts` covering: zero issues (passed), non-zero issues (writes then throws), npm not found (throws with message)
- [x] 2.4 Verify bundle: `swamp extension bundle`

## 3. focusin-deno-ext-tests Extension Model

- [x] 3.1 Create `extensions/models/focusin_deno_ext_tests.ts` with `@focusin/deno-ext-tests` model, `testResult` resource schema (`passed`, `total`, `passing`, `failing`, `durationMs`, `ranAt`), and `run` method that: (a) runs `deno test extensions/models/ --coverage=.deno-coverage`, (b) runs `deno coverage .deno-coverage --lcov >> coverage/lcov.info`, (c) writes resource and throws if any tests fail
- [x] 3.2 Export pure function: `parseDenoTestOutput(stdout)` → `{ total, passing, failing, durationMs }` parsing the summary line `ok | N passed | N failed (Xs)`
- [x] 3.3 Create `extensions/models/focusin_deno_ext_tests_test.ts` covering: all pass, one fail (writes then throws), summary line parsing variants
- [x] 3.4 Verify bundle: `swamp extension bundle`

## 4. focusin-patch-coverage Extension Model

- [x] 4.1 Create `extensions/models/focusin_patch_coverage.ts` with `@focusin/patch-coverage` model, `patchCoverageResult` resource schema (`passed`, `uncoveredLines`, `ranAt`), and `check` method that reimplements `scripts/check-patch-coverage.js` logic in Deno (reads lcov, parses staged diff, checks coverage per added line)
- [x] 4.2 Export pure functions: `parseLcov(raw)` → `Record<string, Record<number, number>>`, `parseStagedDiff(diff)` → `Record<string, Set<number>>`, `findUncoveredLines(coverage, staged)` → `{ file, line }[]`
- [x] 4.3 Create `extensions/models/focusin_patch_coverage_test.ts` covering: no staged changes (vacuous pass), all staged lines covered, one staged line uncovered (writes then throws), file not in coverage scope (skipped), missing lcov.info (handled gracefully)
- [x] 4.4 Verify bundle: `swamp extension bundle`

## 5. Provision Model Instances

- [x] 5.1 `~/.swamp/bin/swamp model create @focusin/lint focusin-lint --global-arg projectDir=$(pwd)`
- [x] 5.2 `~/.swamp/bin/swamp model create @focusin/knip focusin-knip --global-arg projectDir=$(pwd)`
- [x] 5.3 `~/.swamp/bin/swamp model create @focusin/deno-ext-tests focusin-deno-ext-tests --global-arg projectDir=$(pwd)`
- [x] 5.4 `~/.swamp/bin/swamp model create @focusin/patch-coverage focusin-patch-coverage --global-arg projectDir=$(pwd)`

## 6. Create quality-gate-fast Workflow

- [x] 6.1 Create `quality-gate-fast` workflow: `~/.swamp/bin/swamp workflow create quality-gate-fast`
- [x] 6.2 Edit the workflow YAML to define 5 jobs: `check` (lint, knip, spec-coverage, tests, codescene-health in parallel), `coverage` (vitest coverage), `deno-ext` (deno ext tests + coverage), `patch-coverage` (patch-coverage check) — each job `dependsOn` the previous with `condition: succeeded`
- [x] 6.3 Validate: `~/.swamp/bin/swamp workflow validate quality-gate-fast`

## 7. Update quality-gate Workflow

- [x] 7.1 Add lint, knip steps to the `check` job in `workflows/workflow-adb5a2c2-eee7-4dbb-a708-86c7f53cd81a.yaml` (alongside existing spec-coverage, tests, codescene-health)
- [x] 7.2 Add `deno-ext` job between `coverage` and `mutation` in the same workflow YAML, depending on `coverage` with `condition: succeeded` and with mutation depending on `deno-ext`
- [x] 7.3 Add `patch-coverage` step to the `deno-ext` job (or as its own job, depending on filesystem coupling review at implementation time)
- [x] 7.4 Validate: `~/.swamp/bin/swamp workflow validate quality-gate`

## 8. Pre-commit Hook Migration

- [x] 8.1 Replace `.githooks/pre-commit` body with the two-line swamp invocation pattern (matching pre-push style):
  ```sh
  SWAMP="${HOME}/.swamp/bin/swamp"
  command -v swamp >/dev/null 2>&1 && SWAMP="swamp"
  "$SWAMP" workflow run quality-gate-fast
  ```
- [x] 8.2 Delete `scripts/check-codescene-health.js` (now replaced by `focusin-codescene.check` in the workflow)
- [ ] 8.3 Verify `git commit` triggers `quality-gate-fast` and all 5 jobs complete

## 9. Validation

- [x] 9.1 Run `npm test && npm run coverage` to confirm all tests pass and thresholds are met
- [ ] 9.2 Run `~/.swamp/bin/swamp workflow run quality-gate-fast` end-to-end and verify all 5 jobs complete
- [ ] 9.3 Confirm data written: `~/.swamp/bin/swamp data latest focusin-lint lintResult`, `focusin-knip knipResult`, `focusin-deno-ext-tests testResult`, `focusin-patch-coverage patchCoverageResult`
- [ ] 9.4 Run `~/.swamp/bin/swamp workflow run quality-gate` end-to-end and verify all 6 jobs complete (including mutation)
