## Purpose

Documents the requirements for the Guardrails Impact Dashboard — a self-contained HTML page deployed to GitHub Pages that visualises quality gate telemetry to demonstrate the impact of AI guardrails.

## Requirements

### Requirement: Dashboard is accessible at the `/insights/` GitHub Pages path
The file `reports/workflow-insights/index.html` SHALL be included in the GitHub Pages artifact at path `insights/index.html` so the dashboard is reachable at `https://dhansak79.github.io/FocusIn/insights/`.

#### Scenario: Dashboard loads at expected URL
- **WHEN** a user navigates to `https://dhansak79.github.io/FocusIn/insights/`
- **THEN** the browser receives HTTP 200 and renders the guardrails impact dashboard

### Requirement: Dashboard is a self-contained HTML file with all data and scripts inline
The dashboard SHALL be a single `index.html` with all CSS, JavaScript, and chart data embedded inline. It SHALL NOT load any external scripts, fonts, or data files at runtime, and SHALL NOT require a build step, a bundler, or a network connection to render correctly. Chart.js SHALL be inlined, not loaded from a CDN.

#### Scenario: Dashboard renders without network access
- **WHEN** `reports/workflow-insights/index.html` is opened directly in a browser with no internet connection (file:// or served statically)
- **THEN** all charts and panels render correctly without errors or blank sections

### Requirement: Dashboard data is embedded at CI build time
The dashboard generator script SHALL embed all telemetry data as a JavaScript constant directly in the HTML at CI build time. The dashboard SHALL NOT fetch any external data file at runtime.

#### Scenario: Dashboard renders chart data on load
- **WHEN** the HTML is opened in a browser
- **THEN** all charts render immediately from the embedded constant without any network request

### Requirement: Dashboard renders an agent attempt sessions chart
The dashboard SHALL render a bar chart showing the number of gate runs per inferred session, derived from both `quality-gate` and `quality-gate-fast` YAML telemetry. Each bar represents one session; bar height is the total run count.

#### Scenario: Multi-attempt session appears as a taller bar
- **WHEN** a session contains 3 runs (2 blocked pre-commits + 1 successful push)
- **THEN** the corresponding bar has height 3

### Requirement: Dashboard shows a summary panel of gate activity
The dashboard SHALL include a summary section showing: total gate runs, total inferred sessions, average runs per session, and the most recent blocked run's date and failing step name.

#### Scenario: Summary panel reflects current telemetry
- **WHEN** the YAML corpus contains runs forming multiple sessions
- **THEN** the summary panel shows the correct totals and the date/step of the most recent block

### Requirement: Dashboard includes a session explorer with per-attempt check detail
The dashboard SHALL render a **Session Explorer** section below the summary and charts. Each session SHALL be displayed as a collapsible row. When expanded, the session SHALL show a table with one column per run and one row per quality-gate check, displaying the result of each check on each run.

`quality-gate` runs appear as **push** columns; `quality-gate-fast` runs appear as **commit** columns. When a session contains more than one run of the same type, a numeric suffix is appended (e.g. `commit 2`, `push 2`).

The checks shown SHALL be: `lint`, `knip`, `spec-coverage`, `tests`, `deno-ext`, `coverage`, `mutation`, `codescene`, `patch-coverage`.

Per-check detail requirements:
- **lint / knip**: show issue count; show `✓` when 0 issues; show `✗` when step failed with no embedded data
- **spec-coverage**: show `covered/total` count per run
- **tests / deno-ext**: show `passing/total` count per run; highlight red when `passed: false`; show `✗` when step failed with no embedded data
- **coverage**: show `lines`, `functions`, `branches`, `statements` as percentages; highlight any value below 90% in red
- **mutation**: show overall score per run, and a per-file score sub-row for each file in `mutation.files`; highlight files below the passing threshold; shows `—` on `quality-gate-fast` runs (mutation does not run pre-commit)
- **codescene**: show degraded file count per run; when `files[]` is non-empty, show each degraded filename
- **patch-coverage**: show `uncoveredLines` count per run; highlight red when `passed: false`; show `✗` when step failed with no embedded data

Sessions with a single successful run MAY be shown collapsed by default. Sessions with 2+ runs SHOULD be shown expanded by default.

#### Scenario: Single-attempt session is shown collapsed
- **WHEN** a session contains exactly 1 run that succeeded
- **THEN** the session row renders as a single collapsed line showing the date and "1 attempt ✓"

#### Scenario: Multi-run session shows per-check per-run table
- **WHEN** a session with 3 runs is expanded
- **THEN** the check table renders 3 columns and one row per check

#### Scenario: Mutation column shows `—` for pre-commit runs
- **WHEN** a session contains a `quality-gate-fast` commit run
- **THEN** the mutation row cell for that column shows `—`

#### Scenario: Mutation file scores visible within session
- **WHEN** a session is expanded and mutation data includes per-file scores
- **THEN** each file path and score is visible within the mutation row

#### Scenario: Coverage threshold breaches highlighted
- **WHEN** a coverage run has `branches: 89.5`
- **THEN** the branches cell renders in red (below the 90% threshold)

#### Scenario: Failed step with no embedded data shows ✗
- **WHEN** a step failed before producing output (e.g. tests aborted)
- **THEN** the corresponding cell renders `✗` in red rather than `—`

### Requirement: Dashboard is navigable from the GitHub Pages mutation report root
The Stryker report root page SHALL include a visible link to `/FocusIn/insights/` so users can navigate between the mutation report and the guardrails dashboard.

#### Scenario: Link to dashboard is present on the mutation report page
- **WHEN** a user visits `https://dhansak79.github.io/FocusIn/`
- **THEN** the page contains a link with text "Guardrails Dashboard" pointing to `/FocusIn/insights/`
