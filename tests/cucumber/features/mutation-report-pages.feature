Feature: mutation-report-pages


  Scenario: GitHub Pages root resolves to mutation report
    When the pages workflow completes after a successful mutation run on main
    Then the deployed GitHub Pages site serves the Stryker HTML report at the root URL with HTTP 200


  Scenario: Dashboard is co-deployed alongside mutation report
    When the pages workflow completes after a successful mutation run on main
    Then `https://dhansak79.github.io/FocusIn/insights/` serves the guardrails impact dashboard with HTTP 200


  Scenario: Mutation report includes link to dashboard
    When a user visits `https://dhansak79.github.io/FocusIn/`
    Then the page contains a link pointing to `/FocusIn/insights/` with accessible text "Guardrails Dashboard"


  Scenario: Link injection survives Stryker version updates
    When Stryker is updated and its HTML bundle structure changes
    Then the cheerio injection still succeeds by targeting `<body>` rather than a specific string in the bundle


  Scenario: Failed mutation run does not trigger pages deployment
    When the Mutation workflow completes on main with a failing conclusion
    Then the Pages workflow does not execute the deployment job


  Scenario: Mutation workflow uploads artifact for pages consumption
    When the Mutation workflow completes on a push to main
    Then a `mutation-report` artifact is available for download by the Pages workflow
