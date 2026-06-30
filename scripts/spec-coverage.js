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

export const parseScenariosFromFeature = (filePath) => {
  const lines = readFileSync(filePath, 'utf8').split('\n')
  const results = []
  let pendingWip = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === '@wip') {
      pendingWip = true
      continue
    }
    if (trimmed.startsWith('Scenario:') || trimmed.startsWith('Scenario Outline:')) {
      const name = trimmed.replace(/^Scenario(?: Outline)?:\s*/, '')
      results.push({ scenario: name, wip: pendingWip })
      pendingWip = false
      continue
    }
    const isNonTagContent = trimmed !== '' && !trimmed.startsWith('#') && !trimmed.startsWith('@')
    if (isNonTagContent) pendingWip = false
  }

  return results
}

/* c8 ignore start */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
  const args = process.argv.slice(2)
  const changeIdx = args.indexOf('--change')
  const changeName = changeIdx !== -1 ? args[changeIdx + 1] : null

  let featureFiles

  if (changeName) {
    const featureFile = join(ROOT, 'tests', 'cucumber', 'features', `${changeName}.feature`)
    if (!existsSync(featureFile)) {
      console.error(`Error: feature file not found: ${featureFile}`)
      process.exit(1)
    }
    featureFiles = [featureFile]
  } else {
    const featuresDir = join(ROOT, 'tests', 'cucumber', 'features')
    if (!existsSync(featuresDir)) {
      console.error(`Error: features directory not found: ${featuresDir}`)
      process.exit(1)
    }
    featureFiles = findFiles(featuresDir, (n) => n.endsWith('.feature'))
  }

  let total = 0
  let covered = 0

  console.log('\nSpec Coverage Report')
  console.log('─'.repeat(60))

  for (const featureFile of featureFiles) {
    const entries = parseScenariosFromFeature(featureFile)
    if (entries.length === 0) continue

    console.log(`\n${featureFile.replace(ROOT + '/', '')}`)

    for (const { scenario, wip } of entries) {
      const hit = !wip
      console.log(`  ${hit ? '✓' : '✗'} ${scenario}`)
      total++
      if (hit) covered++
    }
  }

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`Summary: ${covered} / ${total} scenarios covered\n`)

  process.exit(covered < total ? 1 : 0)
}
/* c8 ignore stop */
