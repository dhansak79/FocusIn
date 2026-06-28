#!/usr/bin/env node
/* eslint-env node */
/**
 * One-time migration: convert existing openspec/specs/ markdown to Gherkin feature files.
 * All scenarios are tagged @wip. Run once on the executable-specifications branch.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SPECS_DIR = join(ROOT, 'openspec', 'specs')
const FEATURES_DIR = join(ROOT, 'tests', 'cucumber', 'features')

export function parseSpecScenarios(content) {
  const lines = content.split('\n')
  const scenarios = []
  let currentScenario = null
  let lastArray = null

  for (const line of lines) {
    const scenarioMatch = line.match(/^#### Scenario: (.+)$/)
    if (scenarioMatch) {
      if (currentScenario) scenarios.push(currentScenario)
      currentScenario = { name: scenarioMatch[1].trim(), given: [], when: [], then: [] }
      lastArray = null
      continue
    }
    if (!currentScenario) continue

    const stepMatch = line.match(/^- \*\*(GIVEN|WHEN|THEN|AND)\*\* (.+)$/)
    if (!stepMatch) continue

    const [, keyword, text] = stepMatch
    const keyMap = { GIVEN: currentScenario.given, WHEN: currentScenario.when, THEN: currentScenario.then }
    const target = keyMap[keyword] ?? lastArray
    if (target) { target.push(text.trim()); lastArray = target }
  }
  if (currentScenario) scenarios.push(currentScenario)
  return scenarios
}

export function buildFeatureFile(featureName, scenarios) {
  const lines = [`Feature: ${featureName}`, '']
  for (const s of scenarios) {
    lines.push('  @wip')
    lines.push(`  Scenario: ${s.name}`)
    if (s.given.length > 0) {
      lines.push(`    Given ${s.given[0]}`)
      for (const step of s.given.slice(1)) lines.push(`    And ${step}`)
    }
    if (s.when.length > 0) {
      lines.push(`    When ${s.when[0]}`)
      for (const step of s.when.slice(1)) lines.push(`    And ${step}`)
    }
    if (s.then.length > 0) {
      lines.push(`    Then ${s.then[0]}`)
      for (const step of s.then.slice(1)) lines.push(`    And ${step}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

export function migrate(specsDir, featuresDir) {
  mkdirSync(featuresDir, { recursive: true })

  const specDirs = readdirSync(specsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)

  let totalScenarios = 0
  let totalFiles = 0

  for (const specName of specDirs) {
    const specFile = join(specsDir, specName, 'spec.md')
    if (!existsSync(specFile)) continue

    const content = readFileSync(specFile, 'utf8')
    const scenarios = parseSpecScenarios(content)
    if (scenarios.length === 0) continue

    const featureContent = buildFeatureFile(specName, scenarios)
    const outputPath = join(featuresDir, `${specName}.feature`)
    writeFileSync(outputPath, featureContent)

    totalScenarios += scenarios.length
    totalFiles++
  }

  return { totalFiles, totalScenarios }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { totalFiles, totalScenarios } = migrate(SPECS_DIR, FEATURES_DIR)
  console.log(`\nGenerated ${totalFiles} feature files with ${totalScenarios} @wip scenarios.`)
  console.log(`Output: ${FEATURES_DIR}`)
}
