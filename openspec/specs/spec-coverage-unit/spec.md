## Purpose

Defines the unit-testable interface for `scripts/spec-coverage.js`. The script exports its core functions as named ES module exports so they can be tested directly without spawning a child process.

## Requirements

### Requirement: spec-coverage.js exports core functions for unit testing
The script SHALL export `parseScenarios`, `isCovered`, and `findFiles` as named exports so they can be imported and tested directly without spawning a child process. The CLI entrypoint behaviour SHALL remain unchanged.

#### Scenario: parseScenarios returns entries from a spec file
- **WHEN** `parseScenarios(filePath, false)` is called on a spec file containing `#### Scenario:` headings
- **THEN** it returns an array of `{ requirement, scenario }` objects matching those headings

#### Scenario: parseScenarios in change mode only returns ADDED and MODIFIED entries
- **WHEN** `parseScenarios(filePath, true)` is called on a spec file with ADDED, MODIFIED, and REMOVED sections
- **THEN** only entries under `## ADDED Requirements` and `## MODIFIED Requirements` are returned

#### Scenario: isCovered returns true for a matching test
- **WHEN** a test file contains `it('Scenario: <name>'`
- **THEN** `isCovered(name)` returns true

#### Scenario: isCovered returns false when no test matches
- **WHEN** no test file contains `it('Scenario: <name>'`
- **THEN** `isCovered(name)` returns false

#### Scenario: findFiles recursively collects matching files
- **WHEN** `findFiles(dir, predicate)` is called on a directory tree
- **THEN** it returns all files matching the predicate, including files in subdirectories
