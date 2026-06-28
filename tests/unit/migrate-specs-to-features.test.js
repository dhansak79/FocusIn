import { it, expect } from 'vitest'
import { parseSpecScenarios, buildFeatureFile } from '../../scripts/migrate-specs-to-features.js'

// ---------------------------------------------------------------------------
// parseSpecScenarios
// ---------------------------------------------------------------------------

it('parseSpecScenarios: returns empty array for content with no scenarios', () => {
  expect(parseSpecScenarios('# Spec\n\nSome intro text.')).toEqual([])
})

it('parseSpecScenarios: parses a single scenario with GIVEN/WHEN/THEN steps', () => {
  const content = [
    '#### Scenario: User logs in',
    '- **GIVEN** a logged-out user',
    '- **WHEN** they submit valid credentials',
    '- **THEN** they are redirected to the dashboard',
  ].join('\n')
  expect(parseSpecScenarios(content)).toEqual([{
    name: 'User logs in',
    given: ['a logged-out user'],
    when: ['they submit valid credentials'],
    then: ['they are redirected to the dashboard'],
  }])
})

it('parseSpecScenarios: AND continues the previous keyword array', () => {
  const content = [
    '#### Scenario: Multi-step',
    '- **WHEN** first action',
    '- **AND** second action',
    '- **THEN** result',
  ].join('\n')
  const [s] = parseSpecScenarios(content)
  expect(s.when).toEqual(['first action', 'second action'])
  expect(s.then).toEqual(['result'])
})

it('parseSpecScenarios: parses multiple scenarios', () => {
  const content = [
    '#### Scenario: First',
    '- **WHEN** action one',
    '- **THEN** result one',
    '#### Scenario: Second',
    '- **WHEN** action two',
    '- **THEN** result two',
  ].join('\n')
  const result = parseSpecScenarios(content)
  expect(result).toHaveLength(2)
  expect(result[0].name).toBe('First')
  expect(result[1].name).toBe('Second')
})

it('parseSpecScenarios: ignores lines before first scenario', () => {
  const content = '- **WHEN** orphan step\n#### Scenario: Real\n- **THEN** ok'
  const result = parseSpecScenarios(content)
  expect(result).toHaveLength(1)
  expect(result[0].then).toEqual(['ok'])
})

// ---------------------------------------------------------------------------
// buildFeatureFile
// ---------------------------------------------------------------------------

it('buildFeatureFile: produces Feature header and @wip-tagged scenario', () => {
  const out = buildFeatureFile('my-feature', [{
    name: 'Basic scenario', given: [], when: ['something happens'], then: ['result follows'],
  }])
  expect(out).toContain('Feature: my-feature')
  expect(out).toContain('  @wip')
  expect(out).toContain('  Scenario: Basic scenario')
  expect(out).toContain('    When something happens')
  expect(out).toContain('    Then result follows')
})

it('buildFeatureFile: emits And for extra steps', () => {
  const out = buildFeatureFile('f', [{
    name: 'S',
    given: ['precondition one', 'precondition two'],
    when: ['act one', 'act two'],
    then: ['check one', 'check two'],
  }])
  expect(out).toContain('    Given precondition one')
  expect(out).toContain('    And precondition two')
  expect(out).toContain('    When act one')
  expect(out).toContain('    And act two')
  expect(out).toContain('    Then check one')
  expect(out).toContain('    And check two')
})

it('buildFeatureFile: omits Given block when given is empty', () => {
  const out = buildFeatureFile('f', [{ name: 'S', given: [], when: ['act'], then: ['check'] }])
  expect(out).not.toContain('Given')
})
