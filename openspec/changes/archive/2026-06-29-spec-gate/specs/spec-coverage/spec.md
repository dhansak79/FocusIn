## Purpose

Delta spec for `spec-coverage`. The coverage parser is extended to recognise committed Gherkin feature files as valid scenario coverage alongside the existing `it('Scenario: ...')` boundary test convention. Spec-coverage moves from the pre-commit gate to the pre-push gate where it serves as a completeness check across all specs.

## MODIFIED Requirements

### Requirement: Parser detects test coverage by name matching
The parser SHALL search all `tests/**/*.test.js` files for `it('Scenario: <name>')` occurrences AND all `tests/cucumber/features/**/*.feature` files for `Scenario: <name>` occurrences. A scenario is considered covered when its exact name appears in either source. `it.todo('Scenario: <name>')` also counts as covered.

#### Scenario: Covered scenario is marked ✓ via boundary test
- **WHEN** a test file contains `it('Scenario: Negative post is collapsed', ...)`
- **AND** the spec contains `#### Scenario: Negative post is collapsed`
- **THEN** the parser reports that scenario as covered (✓)

#### Scenario: Covered scenario is marked ✓ via feature file
- **WHEN** a feature file contains `Scenario: Negative post is collapsed`
- **AND** the spec contains `#### Scenario: Negative post is collapsed`
- **THEN** the parser reports that scenario as covered (✓)

#### Scenario: @wip tagged scenario still counts as covered
- **WHEN** a feature file contains `@wip` followed by `Scenario: Negative post is collapsed`
- **AND** the spec contains `#### Scenario: Negative post is collapsed`
- **THEN** the parser reports that scenario as covered (✓)
- **AND** does not distinguish between @wip and implemented scenarios for coverage purposes

#### Scenario: Uncovered scenario is marked ✗
- **WHEN** no test file contains `it('Scenario: <name>', ...)`
- **AND** no feature file contains `Scenario: <name>`
- **AND** the spec contains `#### Scenario: <name>`
- **THEN** the parser reports that scenario as missing (✗)

#### Scenario: Partial name match does not count as covered
- **WHEN** a test file contains `it('Scenario: Negative post', ...)`
- **AND** the spec contains `#### Scenario: Negative post is collapsed`
- **THEN** the scenario is reported as missing (✗)

## ADDED Requirements

### Requirement: Spec-coverage runs in quality-gate only, not quality-gate-fast
Spec-coverage SHALL be removed from the `quality-gate-fast` (pre-commit) workflow and SHALL run only in `quality-gate` (pre-push). At commit time, correctness of BDD scenarios is already verified by the tests step. At push time, spec-coverage acts as a completeness check: every scenario across all specs must have either a boundary test or a committed feature file.

#### Scenario: Spec-coverage is absent from pre-commit gate
- **GIVEN** a developer commits code
- **WHEN** the pre-commit hook runs `swamp workflow run quality-gate-fast`
- **THEN** no spec-coverage step is executed

#### Scenario: Spec-coverage runs at push time
- **GIVEN** a developer pushes a branch
- **WHEN** the pre-push hook runs `swamp workflow run quality-gate`
- **THEN** spec-coverage runs and evaluates all scenarios across all specs in `openspec/specs/`

#### Scenario: Spec-coverage catches legacy scenarios without any test coverage
- **GIVEN** a scenario in an existing spec has no feature file and no boundary test
- **WHEN** spec-coverage runs in quality-gate
- **THEN** that scenario is reported as missing (✗) and the push is blocked
