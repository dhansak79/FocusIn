## Context

The `.swamp` directory stores versioned workflow telemetry locally: YAML run manifests under `.swamp/workflow-runs/<workflowId>/`, model data under `.swamp/data/@focusin/<modelName>/<modelId>/current/<version>/raw` (JSON), and SQLite catalogs. These are gitignored today.

Two swamp workflows run quality gates:
- `quality-gate` (full): lint → spec-coverage → tests → patch-coverage → codescene → mutation
- `quality-gate-fast`: lint → tests (developer iteration tool, not the push gate)

The pre-push git hook (`/.githooks/pre-push`) fires `swamp workflow run quality-gate` on every push attempt. A failed gate blocks the push; the AI agent must fix issues and retry. Each attempt produces a new YAML file in `.swamp/workflow-runs/<workflowId>/workflow-run-<guid>.yaml`. Interrupted runs (agent killed mid-execution) produce files with `status: running` — 37.5% of the existing corpus. Both `failed` and `running` represent push attempts that did not result in shipped code.

The existing `mutation.yml` GitHub Actions workflow already deploys a Stryker HTML report to GitHub Pages at the repo root. Pages is configured for this project.

Data shapes confirmed from the raw files:
- `spec-coverage`: `{passed, covered, total, pct, ranAt}`
- `tests`: pass/fail + timing (inferred from workflow YAML)
- Workflow run YAML: `{id, workflowName, status, startedAt, completedAt, jobs[].steps[].output.resources.<name>.current.attributes}`

**Live data finding:** Spec coverage declined from 49.3% to 32.1% over 4 days of AI agent work (June 23–27, 2026) while `spec-coverage` was `allowFailure: true`. The AI shipped features faster than specs were written. This drift is exactly what the methodology is designed to prevent. `spec-coverage` is being hardened to a blocking gate; the initial threshold is set conservatively and will be ratcheted upward in a follow-on remediation PR.

## Goals / Non-Goals

**Goals:**
- Commit raw workflow run YAML files into the repo as the authoritative telemetry record
- Provide a swamp-native terminal summary after every gate run (immediate developer feedback)
- Build a self-contained static HTML dashboard deployed to GitHub Pages alongside the Stryker report
- Show how many push attempts the AI agent made per task before the gate passed
- Surface the spec coverage trajectory the codebase was on before the gate hardened
- Keep SQLite databases, secrets, and bundle files out of git permanently

**Non-Goals:**
- Real-time or live-updating data (static embedded JSON, regenerated on each CI run)
- Authentication / access control on the dashboard
- Replacing or moving the existing Stryker report
- Pruning YAML telemetry files (deferred; git log retains the record regardless)

## Decisions

### Decision 1: Dashboard generator in Node.js, not Deno

The existing `scripts/` directory uses Node (e.g. `scripts/mutation-report.js`). Consistency with the existing toolchain avoids a second runtime in CI. The dashboard generator reads YAML with `js-yaml` and writes the HTML file.

**Alternative considered:** Deno script (consistent with swamp extensions). Rejected because CI already has Node, and adding Deno to the mutation job adds setup time and complexity.

### Decision 2: Commit raw YAML workflow run files directly

`.swamp/workflow-runs/` is selectively un-gitignored. The YAML files accumulate in the working tree and are committed by the AI agent as part of normal commits — no export script, no intermediary JSON. The files are the source of truth.

Every YAML filename is a GUID (`workflow-run-<uuid>.yaml`). Files from different machines, agents, or branches never collide — git merges them additively with no conflicts.

**Critical implementation note:** The `.gitignore` currently contains a swamp-managed block explicitly labelled `# BEGIN swamp managed section - DO NOT EDIT`. The YAML allowlist MUST be placed in a separate manually-maintained section OUTSIDE this block, or swamp will silently overwrite it on any repo reconfiguration:

```gitignore
# BEGIN swamp managed section - DO NOT EDIT
.swamp/
# END swamp managed section

# Telemetry — manually maintained, do not move into swamp managed section
!.swamp/workflow-runs/
.swamp/workflow-runs/*
!.swamp/workflow-runs/**/*.yaml
```

**Alternative considered:** Generate a synthetic `runs.json` locally and commit that. Rejected because JSON arrays conflict on merge, require an export/merge script, and introduce a derived artifact when the source data is already the right shape.

**Alternative considered:** Generate data entirely in CI from GitHub Actions run history. Rejected because it loses swamp-specific metrics (spec coverage, code health per run, mutation scores) which are the whole point of the methodology story.

### Decision 3: Dashboard data embedded in HTML at CI build time

The CI generator script produces a single `reports/workflow-insights/index.html` with all chart data embedded as a JavaScript constant — not fetched at runtime. This eliminates CORS issues at `file://`, removes the need for a separate `data/runs.json` file, and means the dashboard renders offline with no network dependency.

Chart.js is inlined (not loaded from a CDN) so the file is genuinely self-contained. The minified+gzipped bundle is ~250KB — acceptable for a static report file.

**Alternative considered:** Fetch `./data/runs.json` at runtime. Rejected because it breaks at `file://` (CORS), requires a separate file, and introduces a runtime dependency. The embedded approach is strictly simpler.

**Alternative considered:** CDN URL for Chart.js. Rejected because it contradicts the self-contained requirement and breaks offline use.

### Decision 4: Pages artifact expanded to include both reports

The `mutation.yml` upload step currently points at `reports/mutation/`. A staging directory (`reports/pages/`) is assembled before upload containing both the Stryker report and the guardrails dashboard. The root `index.html` (Stryker) is preserved at `reports/pages/index.html` to keep the existing URL working.

**Alternative considered:** Two separate Pages deployments. GitHub Pages supports only one deployment per repo — not an option.

### Decision 5: Counterfactual framed as historical trajectory, not a prediction

The dashboard renders two spec-coverage series: "actual (gate enforced)" and "pre-hardening trajectory (gate absent)." The second series is the literal observed trend from the pre-hardening period (June 23–27) — a real slope from real data, not an extrapolated regression. The narrative is: "this is the direction we were heading; here is where the gate changed it."

The label is "pre-hardening trajectory" rather than "without guardrails projection" to avoid overstating statistical confidence. The gap between the lines grows as the gate remains active — the evidence builds over time.

### Decision 6: Session clustering treats `running` and `failed` as equivalent attempts

The gate produces one YAML per push attempt. `status: running` (interrupted runs) and `status: failed` (gate-blocked runs) both represent attempts that did not result in shipped code — 37.5% of the existing corpus is `running`. The clustering algorithm must treat both identically.

Session definition: all consecutive `quality-gate` runs within a 4-hour window where all but the last have `status: failed` OR `status: running`, and the last has `status: succeeded`. The 4-hour window is a heuristic for a single working session.

`quality-gate-fast` runs are excluded from all session and attempt-count calculations. Fast-gate is a developer iteration tool; only full-gate push attempts are meaningful for the methodology story.

**Alternative considered:** Only count `failed` runs as attempts. Rejected because real data shows 37.5% of attempts are `running` — the metric would be systematically wrong.

### Decision 7: `spec-coverage` hardened to a blocking gate

The `spec-coverage` step in `quality-gate` is changed from `allowFailure: true` to `allowFailure: false`. Initial threshold set conservatively to avoid immediately blocking; will be ratcheted upward in a dedicated remediation PR as the spec backlog is addressed.

### Decision 8: Swamp workflow-scope report as complementary terminal view

A TypeScript report extension scoped to `workflow` runs after every `quality-gate` execution (pass or fail). It reads step outputs from `WorkflowReportContext.stepExecutions`, infers the attempt number by querying recent report history, and produces:

- **Markdown**: terminal-formatted per-run summary with attempt count, blocking step, and key metrics
- **JSON**: structured data persisted in `.swamp/data/` as `report-quality-gate-summary-json`

This is a developer-facing tool — immediate feedback in the terminal. It does not affect the GitHub Pages dashboard architecture.

### Decision 9: Link injection into Stryker HTML via cheerio, not sed

The Stryker HTML report is a React/webpack SPA — a minified bundle. A `sed` pattern targeting it will break on any Stryker version change. A Node.js script using `cheerio` targets a stable DOM selector (`<body>`) and injects the nav link regardless of bundle structure changes.

## Risks / Trade-offs

- **YAML files accumulate without bound** — Every push attempt adds a file. At current velocity (~10/day) this is ~45MB at 90 days. Deferred by user decision; git history is the permanent record.
- **Gitignore managed block** — If swamp overwrites its managed section, the YAML allowlist is silently removed. The allowlist MUST remain outside the managed block with a clear comment. See Decision 2.
- **Attempt-count heuristic misfires on long pauses** — The 4-hour window may split an overnight task into two apparent sessions. The dashboard labels these as "estimated sessions."
- **Counterfactual lines overlap at launch** — The pre-hardening trajectory and actual lines are identical until the gate starts blocking. The divergence grows post-hardening. The narrative should set this expectation clearly.
- **Pages URL restructuring** — The Stryker report moves from `reports/mutation/` to staging at `reports/pages/`, but the deployed URL (`/`) is unchanged. Mitigation: copy, don't move.

## Open Questions

- Should the dashboard live at `/insights/` or be a tab injected into the Stryker report HTML? (Current decision: separate path `/insights/`.)
- Do we want per-step durations in the dashboard, or just overall workflow pass/fail + key metric values? (Current decision: key metrics only.)
