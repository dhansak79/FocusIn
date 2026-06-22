## Purpose

Defines the spec coverage tooling: a CLI parser that reads OpenSpec scenario definitions and cross-references them against boundary test files, producing a coverage report and gating the archive workflow.

## Requirements

### Requirement: Parser extracts scenarios from spec markdown files
The coverage parser SHALL read every `openspec/specs/*/spec.md` file, extract each `#### Scenario: <name>` heading, and build a registry of `{ specFile, requirementName, scenarioName }` entries.

#### Scenario: Scenarios extracted from a spec file
- **WHEN** the parser runs against a spec file containing `#### Scenario:` headings
- **THEN** each scenario name is extracted and associated with its parent requirement heading and spec file path

#### Scenario: Missing spec directory is handled gracefully
- **WHEN** no `openspec/specs/` directory exists
- **THEN** the parser exits with a clear error message and a non-zero exit code

### Requirement: Parser detects test coverage by name matching
The parser SHALL search all `tests/**/*.test.js` files for `it('Scenario: <name>')` occurrences. A scenario is considered covered when its exact name appears as the first argument to an `it()` call, regardless of quoting style (single or double quotes). `it.todo('Scenario: <name>')` also counts as covered.

#### Scenario: Covered scenario is marked ✓
- **WHEN** a test file contains `it('Scenario: Negative post is collapsed', ...)`
- **AND** the spec contains `#### Scenario: Negative post is collapsed`
- **THEN** the parser reports that scenario as covered (✓)

#### Scenario: Uncovered scenario is marked ✗
- **WHEN** no test file contains `it('Scenario: <name>', ...)`
- **AND** the spec contains `#### Scenario: <name>`
- **THEN** the parser reports that scenario as missing (✗)

#### Scenario: Partial name match does not count as covered
- **WHEN** a test file contains `it('Scenario: Negative post', ...)`
- **AND** the spec contains `#### Scenario: Negative post is collapsed`
- **THEN** the scenario is reported as missing (✗)

### Requirement: Parser outputs a human-readable coverage report
The parser SHALL print a grouped report to stdout: one section per spec file, with scenarios nested under their requirement headings, each prefixed ✓ or ✗. A summary line SHALL appear at the end with covered/total counts.

#### Scenario: Report groups scenarios under requirements
- **WHEN** the parser completes
- **THEN** each spec file is listed as a section header
- **AND** scenarios appear under their parent requirement name
- **AND** each scenario line is prefixed with ✓ (covered) or ✗ (missing)

#### Scenario: Summary line shows overall counts
- **WHEN** the parser completes
- **THEN** the final line reads `Summary: N / T scenarios covered` where N is covered count and T is total

#### Scenario: Exit code 0 when all scenarios covered
- **WHEN** every extracted scenario has a matching test
- **THEN** the parser exits with code 0

#### Scenario: Exit code 1 when any scenario is uncovered
- **WHEN** at least one scenario has no matching test
- **THEN** the parser exits with code 1

### Requirement: Coverage script is available as an npm script
The parser SHALL be runnable via `npm run spec:coverage` defined in `package.json`. The script SHALL also export its core functions (`parseScenarios`, `isCovered`, `findFiles`) as named exports for direct unit testing.

#### Scenario: npm script invokes the parser
- **WHEN** the developer runs `npm run spec:coverage`
- **THEN** the parser executes and prints the coverage report to stdout

#### Scenario: Core functions importable as ES module exports
- **WHEN** another module imports from `scripts/spec-coverage.js`
- **THEN** `parseScenarios`, `isCovered`, and `findFiles` are available as named exports

### Requirement: Boundary tests are named after spec scenarios
Each boundary test in `tests/spec/` SHALL name its `it()` block with the exact string `'Scenario: <name>'` where `<name>` matches the scenario heading in the corresponding spec file.

#### Scenario: Boundary test name matches spec scenario exactly
- **WHEN** a spec file contains `#### Scenario: Negative post is collapsed`
- **AND** a boundary test file contains `it('Scenario: Negative post is collapsed', ...)`
- **THEN** the parser reports that scenario as covered

#### Scenario: Boundary tests drive through feed.js default export
- **WHEN** a boundary test exercises a collapse behavior
- **THEN** it calls `doFeed(config)` with a config object matching the scenario's preconditions
- **AND** it asserts on DOM state (element classes, banner presence) rather than function return values

#### Scenario: Boundary tests mock only at system boundaries
- **WHEN** a boundary test runs
- **THEN** only the ML pipeline (`transformers.min.js`) and `chrome.*` APIs are mocked
- **AND** all internal extension code between `feed.js` and those boundaries runs un-mocked
