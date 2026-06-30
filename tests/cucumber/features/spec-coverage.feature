Feature: spec-coverage

  Scenario: Active scenario extracted from feature file
    Given a feature file containing a Scenario with no @wip tag
    When parseScenariosFromFeature is called on that file
    Then the scenario is returned with wip: false

  Scenario: WIP scenario detected from @wip tag
    Given a feature file containing a Scenario preceded by @wip
    When parseScenariosFromFeature is called on that file
    Then the scenario is returned with wip: true

  Scenario: Mixed active and @wip scenarios in same file
    Given a feature file with one active scenario and one @wip scenario
    When parseScenariosFromFeature is called on that file
    Then the active scenario has wip: false and the @wip scenario has wip: true

  Scenario: @wip tag only applies to immediately following scenario
    Given a feature file where @wip precedes one scenario and a second scenario has no tag
    When parseScenariosFromFeature is called on that file
    Then only the first scenario has wip: true

  Scenario: findFiles returns matching files recursively
    Given a nested directory of files with mixed extensions
    When findFiles is called with a .feature predicate
    Then only .feature files from all subdirectories are returned

  Scenario: Missing feature file handled gracefully with --change
    When the CLI is run with --change and a non-existent change name
    Then it exits with a non-zero code and prints a clear error message

  Scenario: Summary line shows overall counts
    When the CLI scans the features directory
    Then the output ends with a line matching `Summary: N / T scenarios covered`

  Scenario: Exit code 1 when any @wip scenario exists
    Given at least one scenario in the features directory is tagged @wip
    When the CLI runs
    Then it exits with code 1

  Scenario: npm script invokes the parser
    When the developer runs `npm run spec:coverage`
    Then the parser executes and prints the coverage report to stdout

  Scenario: Core functions importable as ES module exports
    When another module imports from `scripts/spec-coverage.js`
    Then `parseScenariosFromFeature` and `findFiles` are available as named exports
