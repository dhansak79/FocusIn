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

### Requirement: Dashboard renders the pre-hardening spec coverage trajectory
The dashboard SHALL render two spec coverage series:
- **"Actual (gate enforced)"**: spec coverage % per `quality-gate` run in chronological order
- **"Pre-hardening trajectory"**: the observed slope from runs before the `spec-coverage` gate was hardened (before `allowFailure` was changed to `false`), shown as a straight continuation from the hardening date

The pre-hardening trajectory SHALL be labelled clearly as a historical trend, not a forecast. Both series SHALL be hidden if fewer than two data points exist.

#### Scenario: Both series render after gate hardening
- **WHEN** the data includes runs from before and after the spec-coverage gate was hardened
- **THEN** the "actual" line diverges upward (or holds) from the "pre-hardening trajectory" line at the hardening date

#### Scenario: Only actual series renders before any divergence
- **WHEN** all runs occurred before the gate was hardened (no blocked spec-coverage runs exist)
- **THEN** only the "actual" series renders; the "pre-hardening trajectory" series is hidden

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

### Requirement: Dashboard is navigable from the GitHub Pages mutation report root
The Stryker report root page SHALL include a visible link to `/FocusIn/insights/` so users can navigate between the mutation report and the guardrails dashboard.

#### Scenario: Link to dashboard is present on the mutation report page
- **WHEN** a user visits `https://dhansak79.github.io/FocusIn/`
- **THEN** the page contains a link with text "Guardrails Dashboard" pointing to `/FocusIn/insights/`
