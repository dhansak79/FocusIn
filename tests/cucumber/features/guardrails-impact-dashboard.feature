Feature: guardrails-impact-dashboard


  Scenario: Dashboard loads at expected URL
    When a user navigates to `https://dhansak79.github.io/FocusIn/insights/`
    Then the browser receives HTTP 200 and renders the guardrails impact dashboard


  Scenario: Dashboard renders without network access
    When `reports/workflow-insights/index.html` is opened directly in a browser with no internet connection (file:// or served statically)
    Then all charts and panels render correctly without errors or blank sections


  Scenario: Dashboard renders chart data on load
    When the HTML is opened in a browser
    Then all charts render immediately from the embedded constant without any network request


  Scenario: Multi-attempt session appears as a taller bar
    When a session contains 3 runs (2 blocked pre-commits + 1 successful push)
    Then the corresponding bar has height 3


  Scenario: Summary panel reflects current telemetry
    When the YAML corpus contains runs forming multiple sessions
    Then the summary panel shows the correct totals and the date/step of the most recent block


  Scenario: Single-attempt session is shown collapsed
    When a session contains exactly 1 run that succeeded
    Then the session row renders as a single collapsed line showing the date and "1 attempt ✓"


  Scenario: Multi-run session shows per-check per-run table
    When a session with 3 runs is expanded
    Then the check table renders 3 columns and one row per check


  Scenario: Mutation column shows `—` for pre-commit runs
    When a session contains a `quality-gate-fast` commit run
    Then the mutation row cell for that column shows `—`


  Scenario: Mutation file scores visible within session
    When a session is expanded and mutation data includes per-file scores
    Then each file path and score is visible within the mutation row


  Scenario: Coverage threshold breaches highlighted
    When a coverage run has `branches: 89.5`
    Then the branches cell renders in red (below the 90% threshold)


  Scenario: Failed step with no embedded data shows ✗
    When a step failed before producing output (e.g. tests aborted)
    Then the corresponding cell renders `✗` in red rather than `—`


  Scenario: Link to dashboard is present on the mutation report page
    When a user visits `https://dhansak79.github.io/FocusIn/`
    Then the page contains a link with text "Guardrails Dashboard" pointing to `/FocusIn/insights/`
