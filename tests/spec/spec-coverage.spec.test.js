import { spawnSync } from 'child_process'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { it, expect } from 'vitest'
import { findFiles, parseScenariosFromFeature } from '../../scripts/spec-coverage.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'spec-coverage.js')

const run = (args = []) =>
  spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8', cwd: ROOT })

const withTmpFeature = (content, fn) => {
  const tmp = join(ROOT, '.tmp-spec-coverage-test')
  mkdirSync(tmp, { recursive: true })
  const file = join(tmp, 'test.feature')
  writeFileSync(file, content)
  try {
    return fn(file)
  } finally {
    rmSync(tmp, { recursive: true })
  }
}

// ---------------------------------------------------------------------------
// Requirement: parseScenariosFromFeature extracts scenarios with @wip status
// ---------------------------------------------------------------------------

it('Scenario: Active scenario extracted from feature file', () => {
  withTmpFeature('Feature: test\n\n  Scenario: Things work\n    Given a thing\n', (file) => {
    expect(parseScenariosFromFeature(file)).toEqual([{ scenario: 'Things work', wip: false }])
  })
})

it('Scenario: WIP scenario detected from @wip tag', () => {
  withTmpFeature('Feature: test\n\n  @wip\n  Scenario: Not yet done\n    Given something\n', (file) => {
    expect(parseScenariosFromFeature(file)).toEqual([{ scenario: 'Not yet done', wip: true }])
  })
})

it('Scenario: Mixed active and @wip scenarios in same file', () => {
  withTmpFeature(
    'Feature: test\n\n  Scenario: Done\n    Given done\n\n  @wip\n  Scenario: Not done\n    Given pending\n',
    (file) => {
      expect(parseScenariosFromFeature(file)).toEqual([
        { scenario: 'Done', wip: false },
        { scenario: 'Not done', wip: true },
      ])
    }
  )
})

it('Scenario: @wip tag only applies to immediately following scenario', () => {
  withTmpFeature(
    'Feature: test\n\n  @wip\n  Scenario: Pending\n    Given pending\n\n  Scenario: Active\n    Given active\n',
    (file) => {
      expect(parseScenariosFromFeature(file)).toEqual([
        { scenario: 'Pending', wip: true },
        { scenario: 'Active', wip: false },
      ])
    }
  )
})

// ---------------------------------------------------------------------------
// Requirement: findFiles recursively finds files matching predicate
// ---------------------------------------------------------------------------

it('Scenario: findFiles returns matching files recursively', () => {
  const tmp = join(ROOT, '.tmp-spec-coverage-find')
  mkdirSync(join(tmp, 'sub'), { recursive: true })
  writeFileSync(join(tmp, 'a.feature'), '')
  writeFileSync(join(tmp, 'sub', 'b.feature'), '')
  writeFileSync(join(tmp, 'c.txt'), '')
  try {
    const result = findFiles(tmp, (n) => n.endsWith('.feature'))
    expect(result).toHaveLength(2)
    expect(result.some((f) => f.endsWith('a.feature'))).toBe(true)
    expect(result.some((f) => f.endsWith('b.feature'))).toBe(true)
  } finally {
    rmSync(tmp, { recursive: true })
  }
})

// ---------------------------------------------------------------------------
// Requirement: CLI reports coverage based on @wip status
// ---------------------------------------------------------------------------

it('Scenario: Missing feature file handled gracefully with --change', () => {
  const result = run(['--change', 'nonexistent-change-xyz'])
  expect(result.status).toBe(1)
  expect(result.stderr).toContain('feature file not found')
})

it('Scenario: Summary line shows overall counts', () => {
  const result = run()
  expect(result.stdout).toMatch(/Summary: \d+ \/ \d+ scenarios covered/)
})

it('Scenario: Exit code 1 when any @wip scenario exists', () => {
  const tmp = join(ROOT, `tests/cucumber/features/.tmp-wip-vitest-${Date.now()}.feature`)
  writeFileSync(tmp, 'Feature: temp\n\n  @wip\n  Scenario: Pending\n    Given something pending\n')
  try {
    const result = run()
    expect(result.status).toBe(1)
  } finally {
    rmSync(tmp, { force: true })
  }
})

it('Scenario: npm script invokes the parser', () => {
  const result = spawnSync('npm', ['run', 'spec:coverage'], { encoding: 'utf8', cwd: ROOT })
  expect(result.stdout + result.stderr).toContain('Spec Coverage Report')
})

it('Scenario: Core functions importable as ES module exports', () => {
  expect(typeof findFiles).toBe('function')
  expect(typeof parseScenariosFromFeature).toBe('function')
})
