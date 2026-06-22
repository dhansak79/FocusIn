#!/usr/bin/env node
/* eslint-env node */
import { readdirSync, readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

export const findFiles = (dir, predicate) => {
  const results = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) results.push(...findFiles(full, predicate))
    else if (predicate(entry.name)) results.push(full)
  }
  return results
}

const DELTA_SECTIONS = new Set(['ADDED Requirements', 'MODIFIED Requirements'])

const sectionIncluded = (section, changeMode) => !changeMode || DELTA_SECTIONS.has(section)

export const parseScenarios = (filePath, changeMode) => {
  let requirement = null
  let include = !changeMode

  return readFileSync(filePath, 'utf8').split('\n').flatMap((line) => {
    if (line.startsWith('## ')) {
      include = sectionIncluded(line.slice(3).trim(), changeMode)
      return []
    }
    if (line.startsWith('### Requirement: ')) {
      requirement = line.slice('### Requirement: '.length).trim()
      return []
    }
    if (!include || !requirement) return []
    if (!line.startsWith('#### Scenario: ')) return []
    return [{ requirement, scenario: line.slice('#### Scenario: '.length).trim() }]
  })
}

export const isCovered = (name, testContents) =>
  testContents.includes(`it('Scenario: ${name}'`) ||
  testContents.includes(`it("Scenario: ${name}"`)

/* c8 ignore start */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
  const args = process.argv.slice(2)
  const changeIdx = args.indexOf('--change')
  const changeName = changeIdx !== -1 ? args[changeIdx + 1] : null

  const specsDir = changeName
    ? join(ROOT, 'openspec', 'changes', changeName, 'specs')
    : join(ROOT, 'openspec', 'specs')

  if (!existsSync(specsDir)) {
    console.error(`Error: spec directory not found: ${specsDir}`)
    process.exit(1)
  }

  const testContents = findFiles(join(ROOT, 'tests'), (n) => n.endsWith('.test.js'))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n')

  const specFiles = findFiles(specsDir, (n) => n === 'spec.md')
  let total = 0
  let covered = 0

  console.log('\nSpec Coverage Report')
  console.log('─'.repeat(60))

  for (const specFile of specFiles) {
    const entries = parseScenarios(specFile, changeName !== null)
    if (entries.length === 0) continue

    console.log(`\n${specFile.replace(ROOT + '/', '')}`)

    let lastReq = null
    for (const { requirement, scenario } of entries) {
      if (requirement !== lastReq) {
        console.log(`  ${requirement}`)
        lastReq = requirement
      }
      const hit = isCovered(scenario, testContents)
      console.log(`    ${hit ? '✓' : '✗'} ${scenario}`)
      total++
      if (hit) covered++
    }
  }

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`Summary: ${covered} / ${total} scenarios covered\n`)

  process.exit(covered < total ? 1 : 0)
}
/* c8 ignore stop */
