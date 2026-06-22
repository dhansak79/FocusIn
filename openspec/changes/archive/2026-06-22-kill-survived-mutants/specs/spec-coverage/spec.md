## MODIFIED Requirements

### Requirement: Coverage script is available as an npm script
The parser SHALL be runnable via `npm run spec:coverage` defined in `package.json`. The script SHALL also export its core functions (`parseScenarios`, `isCovered`, `findFiles`) as named exports for direct unit testing.

#### Scenario: npm script invokes the parser
- **WHEN** the developer runs `npm run spec:coverage`
- **THEN** the parser executes and prints the coverage report to stdout

#### Scenario: Core functions importable as ES module exports
- **WHEN** another module imports from `scripts/spec-coverage.js`
- **THEN** `parseScenarios`, `isCovered`, and `findFiles` are available as named exports
