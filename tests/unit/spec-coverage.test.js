import { it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { findFiles, parseScenarios, isCovered } from '../../scripts/spec-coverage.js'

let tmp

beforeEach(() => {
  tmp = join(tmpdir(), `spec-coverage-${Date.now()}`)
  mkdirSync(tmp, { recursive: true })
})

afterEach(() => {
  rmSync(tmp, { recursive: true })
})

// ---------------------------------------------------------------------------
// findFiles
// ---------------------------------------------------------------------------

it('findFiles returns matching files recursively', () => {
  mkdirSync(join(tmp, 'sub'))
  writeFileSync(join(tmp, 'a.md'), '')
  writeFileSync(join(tmp, 'sub', 'b.md'), '')
  writeFileSync(join(tmp, 'c.txt'), '')
  const result = findFiles(tmp, (n) => n.endsWith('.md'))
  expect(result).toHaveLength(2)
  expect(result.some((f) => f.endsWith('a.md'))).toBe(true)
  expect(result.some((f) => f.endsWith('b.md'))).toBe(true)
})

it('findFiles returns empty array when no files match', () => {
  writeFileSync(join(tmp, 'a.txt'), '')
  expect(findFiles(tmp, (n) => n.endsWith('.md'))).toEqual([])
})

// ---------------------------------------------------------------------------
// parseScenarios — global mode
// ---------------------------------------------------------------------------

it('parseScenarios extracts all scenarios in global mode', () => {
  writeFileSync(
    join(tmp, 'spec.md'),
    '### Requirement: Auth\n\n#### Scenario: Login succeeds\n- WHEN user logs in\n- THEN session created\n\n#### Scenario: Login fails\n- WHEN wrong password\n- THEN error shown\n'
  )
  const result = parseScenarios(join(tmp, 'spec.md'), false)
  expect(result).toHaveLength(2)
  expect(result[0]).toEqual({ requirement: 'Auth', scenario: 'Login succeeds' })
  expect(result[1]).toEqual({ requirement: 'Auth', scenario: 'Login fails' })
})

it('parseScenarios returns empty array when no scenarios present', () => {
  writeFileSync(join(tmp, 'spec.md'), '## Purpose\n\nSome background text.\n')
  expect(parseScenarios(join(tmp, 'spec.md'), false)).toEqual([])
})

// ---------------------------------------------------------------------------
// parseScenarios — change mode (ADDED/MODIFIED only)
// ---------------------------------------------------------------------------

it('parseScenarios in change mode returns only ADDED and MODIFIED entries', () => {
  writeFileSync(
    join(tmp, 'spec.md'),
    [
      '## ADDED Requirements',
      '',
      '### Requirement: New',
      '',
      '#### Scenario: Added scenario',
      '- WHEN ...',
      '- THEN ...',
      '',
      '## REMOVED Requirements',
      '',
      '### Requirement: Old',
      '',
      '#### Scenario: Removed scenario',
      '- WHEN ...',
      '- THEN ...',
      '',
      '## MODIFIED Requirements',
      '',
      '### Requirement: Changed',
      '',
      '#### Scenario: Modified scenario',
      '- WHEN ...',
      '- THEN ...',
    ].join('\n')
  )
  const result = parseScenarios(join(tmp, 'spec.md'), true)
  expect(result).toHaveLength(2)
  expect(result.map((r) => r.scenario)).toEqual(['Added scenario', 'Modified scenario'])
})

it('parseScenarios in change mode returns empty when only REMOVED sections exist', () => {
  writeFileSync(
    join(tmp, 'spec.md'),
    '## REMOVED Requirements\n\n### Requirement: Old\n\n#### Scenario: Gone\n- WHEN ...\n- THEN ...\n'
  )
  expect(parseScenarios(join(tmp, 'spec.md'), true)).toEqual([])
})

// ---------------------------------------------------------------------------
// isCovered
// ---------------------------------------------------------------------------

it('isCovered returns true for single-quoted match', () => {
  expect(isCovered('Foo happens', "it('Scenario: Foo happens', () => {})")).toBe(true)
})

it('isCovered returns true for double-quoted match', () => {
  expect(isCovered('Foo happens', 'it("Scenario: Foo happens", () => {})')).toBe(true)
})

it('isCovered returns false when no match', () => {
  expect(isCovered('Foo happens', "it('Scenario: Something else', () => {})")).toBe(false)
})

it('isCovered does not match on partial name', () => {
  expect(isCovered('Foo', "it('Scenario: Foo happens', () => {})")).toBe(false)
})
