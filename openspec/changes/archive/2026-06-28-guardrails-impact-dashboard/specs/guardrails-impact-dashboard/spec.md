## ADDED Requirements

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

## REMOVED Requirements

### ~~Requirement: Dashboard renders the pre-hardening spec coverage trajectory~~
Removed. The `spec-coverage` check is being removed from the quality gate pipeline. All spec coverage chart series and the pre-hardening slope calculation are out of scope.

---

## ADDED Requirements (continued)

### Requirement: Dashboard renders an agent attempt sessions chart
The dashboard SHALL render a bar chart showing the number of push attempts per inferred session, derived from the `quality-gate` YAML telemetry. Each bar represents one session; bar height is the attempt count. Sessions with a single successful attempt (no blocks) have height 1.

Only `quality-gate` runs are included. `quality-gate-fast` runs are excluded from all session calculations.

#### Scenario: Multi-attempt session appears as a taller bar
- **WHEN** a session contains 3 attempts (2 blocked + 1 success)
- **THEN** the corresponding bar has height 3

#### Scenario: quality-gate-fast runs do not appear
- **WHEN** the YAML corpus includes both `quality-gate` and `quality-gate-fast` runs
- **THEN** the attempt chart contains no data points derived from `quality-gate-fast` runs

### Requirement: Dashboard shows a summary panel of gate activity
The dashboard SHALL include a summary section showing: total `quality-gate` runs, total inferred sessions, average attempts per session, and the most recent blocked run's date and failing step name.

#### Scenario: Summary panel reflects current telemetry
- **WHEN** the YAML corpus contains 32 runs forming 10 sessions with a total of 14 attempts across blocked runs
- **THEN** the summary panel shows the correct totals and the date/step of the most recent block

### Requirement: Dashboard includes a session explorer with per-attempt check detail
The dashboard SHALL render a **Session Explorer** section below the summary and charts. Each session SHALL be displayed as a collapsible row. When expanded, the session SHALL show a table with one column per attempt and one row per quality-gate check, displaying the result of each check on each attempt.

The checks shown SHALL be: `tests`, `coverage`, `mutation`, `codescene`, `patch-coverage`. `spec-coverage` SHALL be excluded.

Per-check detail requirements:
- **tests**: show `passing/total` count per attempt; highlight red when `passed: false`
- **coverage**: show `lines`, `functions`, `branches`, `statements` as percentages per attempt; highlight any value below 90% in red
- **mutation**: show overall score per attempt, and a per-file score sub-row for each file in `mutation.files`; highlight files below the passing threshold
- **codescene**: show degraded file count per attempt; when `files[]` is non-empty, show each degraded filename
- **patch-coverage**: show `uncoveredLines` count per attempt; highlight red when `passed: false`

Sessions with a single successful attempt (never blocked) MAY be shown collapsed by default. Sessions with 2+ attempts SHOULD be shown expanded by default.

#### Scenario: Single-attempt session is shown collapsed
- **WHEN** a session contains exactly 1 attempt (no blocks)
- **THEN** the session row renders as a single collapsed line showing the date and "1 attempt ✓"

#### Scenario: Multi-attempt session shows per-check per-attempt table
- **WHEN** a session with 3 attempts is expanded
- **THEN** the check table renders 3 columns (A1, A2, A3) and one row per check

#### Scenario: Mutation file scores visible within session
- **WHEN** a session is expanded and mutation data includes per-file scores
- **THEN** each file path and score is visible within the mutation row

#### Scenario: Coverage threshold breaches highlighted
- **WHEN** a coverage attempt has `branches: 89.5`
- **THEN** the branches cell renders in red (below the 90% threshold)

### Requirement: Dashboard is navigable from the GitHub Pages mutation report root
The Stryker report root page SHALL include a visible link to `/FocusIn/insights/` so users can navigate between the mutation report and the guardrails dashboard.

#### Scenario: Link to dashboard is present on the mutation report page
- **WHEN** a user visits `https://dhansak79.github.io/FocusIn/`
- **THEN** the page contains a link with text "Guardrails Dashboard" pointing to `/FocusIn/insights/`
