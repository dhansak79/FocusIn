## 1. Telemetry Directory Setup

> Architecture pivot: swamp gitignores all of `.swamp/` (same as our repo). Git cannot negate files inside an excluded parent directory. Solution: `telemetry/workflow-runs/` at the repo root, tracked normally. `scripts/sync-telemetry.js` copies from `.swamp/workflow-runs/` → `telemetry/workflow-runs/` (GUID filenames = no merge conflicts).

- [x] 1.1 Create `telemetry/workflow-runs/` directory at the repo root (tracked by git, not inside `.swamp/`)
- [x] 1.2 Create `scripts/sync-telemetry.js` — copies new YAML files from `.swamp/workflow-runs/<id>/` → `telemetry/workflow-runs/<id>/`, skipping files that already exist
- [x] 1.3 Run `node scripts/sync-telemetry.js` to seed all 38 existing YAML files into `telemetry/`

## 2. Harden spec-coverage Gate

- [x] 2.1 In the `quality-gate` workflow definition, change the `spec-coverage` step from `allowFailure: true` to `allowFailure: false`
- [x] 2.2 Harden `quality-gate-fast` spec-coverage the same way (`allowFailure: true` → `allowFailure: false`) — running spec-coverage as advisory on the fast gate was pointless
- [x] 2.3 Run `swamp workflow validate quality-gate` to confirm the DAG is valid after the change
- [x] 2.4 Run the quality gate once locally to confirm it blocks at the current coverage level and the failure message is clear

## 3. Swamp Report Extension

- [x] 3.1 Create `extensions/reports/quality_gate_summary.ts` exporting a workflow-scope report (file location follows swamp extension guide: `extensions/reports/*.ts`)
- [x] 3.2 Implement `execute(context: WorkflowReportContext)`: extract per-step metrics from `context.stepExecutions` via `context.dataRepository.getContent`
- [x] 3.3 Infer attempt number by reading `.swamp/workflow-runs/<workflowId>/*.yaml` from disk — count runs within the last 4 hours with `status: failed` or `status: running`
- [x] 3.4 Produce markdown output: one-line header (run status, attempt number), key metrics table, blocking step if failed
- [x] 3.5 Produce JSON output matching the shape defined in the spec
- [x] 3.6 Register the report in the `quality-gate` workflow definition YAML under `reports.require`
- [x] 3.7 Write Deno unit tests for the report (6 tests covering: metrics extraction, blocking step detection, skipped steps, markdown format)
- [x] 3.8 Run Deno tests — 6/6 passed

## 4. Dashboard Generator Script

> Reads from `telemetry/workflow-runs/` (committed); Chart.js inlined from node_modules.

- [x] 4.1 Create `scripts/generate-guardrails-dashboard.js` reading `telemetry/workflow-runs/**/*.yaml`, filtering to `workflowName === 'quality-gate'`
- [x] 4.2 Extract per-run fields from `jobs[].steps[].output.resources`
- [x] 4.3 Implement session clustering (4-hour window, any status counts as attempt)
- [x] 4.4 Get hardening date from `git log` on the quality-gate workflow YAML; compute pre-hardening slope via linear regression
- [x] 4.5 Read `node_modules/chart.js/dist/chart.umd.min.js` and inline into HTML at build time
- [x] 4.6 Write `reports/workflow-insights/index.html` with all data embedded as `const DATA` — no external requests

## 5. Dashboard HTML

- [x] 5.1 Spec coverage line chart with "Actual (gate enforced)" and "Pre-hardening trajectory" series
- [x] 5.2 Trajectory tooltip: "Observed trend before spec-coverage gate was hardened"
- [x] 5.3 Trajectory series hidden if fewer than 2 pre-hardening data points
- [x] 5.4 "Agent Attempt Sessions" bar chart — quality-gate only, bars colour-coded by attempt count
- [x] 5.5 Summary panel: total runs, total sessions, avg attempts/session, last blocked date/step
- [x] 5.6 Dashboard verified by content inspection (browser extension unavailable in session)

## 6. Pages Staging Assembly

- [x] 6.1 Added `cheerio`, `chart.js`, and `js-yaml` to `package.json` devDependencies
- [x] 6.2 Created `scripts/inject-dashboard-link.js` using cheerio to prepend a fixed nav link to Stryker `<body>`
- [x] 6.3 Added three steps to `mutation.yml` (all `if: always()`): generate dashboard, inject link, assemble staging dir
- [x] 6.4 Changed `upload-pages-artifact` to point at `reports/pages/`
- [x] 6.5 Staging uses `cp -r reports/mutation/. reports/pages/` which preserves all Stryker CSS/JS assets

## 7. Fix GUARDRAILS.md

- [x] 7.1 Dashboard link already formatted correctly in `GUARDRAILS.md` with `*(coming soon)*` annotation
- [x] 7.2 Counterfactual already framed as "pre-hardening trajectory" in `GUARDRAILS.md`

## 8. Tests and Spec Coverage

- [x] 8.1 17 unit tests for clustering (4h window, running status, chronological sort, edge cases), slope, projection, and parseRun
- [x] 8.2 Tests for slope calculation including exclusion of post-hardening runs
- [x] 8.3 Specs promoted: `openspec/specs/quality-gate-swamp-report/spec.md` and `openspec/specs/guardrails-impact-dashboard/spec.md`
- [x] 8.4 `npm test` → 699 tests passed; `npm run coverage` → all thresholds met
- [x] 8.5 `pre_commit_code_health_safeguard` → passed (refactored renderHtml, getStepAttrs, loadRuns)
