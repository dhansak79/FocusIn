## ADDED Requirements

### Requirement: focusin-lint model tracks ESLint results
The system SHALL provide a `@focusin/lint` extension model with a `check` method that runs `npm run lint` in the project directory, stores the result as a `lintResult` resource, and fails if lint reports any issues.

#### Scenario: lint passes with no issues
- **WHEN** the `focusin-lint.check` method runs and ESLint finds no issues
- **THEN** the method SHALL write a `lintResult` resource with `passed: true` and `issueCount: 0` and SHALL return successfully

#### Scenario: lint fails with issues
- **WHEN** the `focusin-lint.check` method runs and ESLint reports one or more problems
- **THEN** the method SHALL write a `lintResult` resource with `passed: false` and `issueCount > 0` and SHALL throw with the ESLint output

#### Scenario: lintResult resource is always written before throwing
- **WHEN** `focusin-lint.check` runs and lint fails
- **THEN** the `lintResult` resource SHALL be written before the error is thrown, so the failure is recorded as swamp data

### Requirement: focusin-knip model tracks dead code results
The system SHALL provide a `@focusin/knip` extension model with a `check` method that runs `npm run knip` in the project directory, stores the result as a `knipResult` resource, and fails if knip reports any unused exports, files, or dependencies.

#### Scenario: knip passes with no issues
- **WHEN** the `focusin-knip.check` method runs and knip finds no issues
- **THEN** the method SHALL write a `knipResult` resource with `passed: true` and `issueCount: 0`

#### Scenario: knip fails with issues
- **WHEN** the `focusin-knip.check` method runs and knip reports issues
- **THEN** the method SHALL write a `knipResult` resource with `passed: false` and `issueCount > 0` and SHALL throw

### Requirement: focusin-deno-ext-tests model tracks deno extension test results
The system SHALL provide a `@focusin/deno-ext-tests` extension model with a `run` method that runs `deno test` on `extensions/models/`, generates lcov coverage data appended to `coverage/lcov.info`, stores the result as a `testResult` resource, and fails if any tests fail.

#### Scenario: all deno extension tests pass
- **WHEN** the `focusin-deno-ext-tests.run` method executes and all tests pass
- **THEN** the method SHALL write a `testResult` resource with `passed: true`, correct `total`/`passing`/`failing` counts, and SHALL append deno lcov data to `coverage/lcov.info`

#### Scenario: one or more deno tests fail
- **WHEN** the `focusin-deno-ext-tests.run` method executes and at least one test fails
- **THEN** the method SHALL write a `testResult` resource with `passed: false`, `failing > 0`, and SHALL throw with the failing test output

#### Scenario: deno coverage appended to lcov.info for patch-coverage
- **WHEN** `focusin-deno-ext-tests.run` completes successfully
- **THEN** `coverage/lcov.info` SHALL contain the deno extension model coverage entries, enabling `focusin-patch-coverage` to check coverage for `.ts` files in `extensions/models/`

### Requirement: focusin-patch-coverage model tracks staged-line coverage
The system SHALL provide a `@focusin/patch-coverage` extension model with a `check` method that reimplements the logic of `scripts/check-patch-coverage.js` in Deno, reads `coverage/lcov.info`, compares staged-diff added lines, and stores the result as a `patchCoverageResult` resource.

#### Scenario: all staged lines are covered
- **WHEN** `focusin-patch-coverage.check` runs and every newly added line in staged JS/TS source files is hit in the coverage report
- **THEN** the method SHALL write a `patchCoverageResult` resource with `passed: true` and `uncoveredLines: 0`

#### Scenario: one or more staged lines are uncovered
- **WHEN** `focusin-patch-coverage.check` runs and at least one newly added line in a covered file has zero hits
- **THEN** the method SHALL write a `patchCoverageResult` resource with `passed: false`, `uncoveredLines > 0`, and SHALL throw listing the uncovered file:line pairs

#### Scenario: no staged changes produces vacuous pass
- **WHEN** `focusin-patch-coverage.check` runs and `git diff --cached` returns no added lines (e.g. at push time)
- **THEN** the method SHALL write a `patchCoverageResult` resource with `passed: true` and `uncoveredLines: 0`

#### Scenario: patchCoverageResult written before throwing
- **WHEN** `focusin-patch-coverage.check` finds uncovered lines
- **THEN** the `patchCoverageResult` resource SHALL be written before the error is thrown
