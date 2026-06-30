Feature: mutation-report-pages


  Scenario: Link injection survives Stryker version updates
    When Stryker is updated and its HTML bundle structure changes
    Then the cheerio injection still succeeds by targeting `<body>` rather than a specific string in the bundle


  Scenario: Mutation workflow uploads artifact for pages consumption
    When the Mutation workflow completes on a push to main
    Then a `mutation-report` artifact is available for download by the Pages workflow
