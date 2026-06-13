#!/usr/bin/env node
/* eslint-env node */
// Checks that every line added in staged changes is hit by the coverage report.
// Run after npm run coverage so that coverage/lcov.info is up to date.

import { execSync } from 'child_process'
import { readFileSync, existsSync } from 'fs'

const LCOV = 'coverage/lcov.info'

if (!existsSync(LCOV)) {
  console.error('check-patch-coverage: coverage/lcov.info not found')
  process.exit(1)
}

// Parse lcov into { 'src/utils.js': { 43: 2, 44: 0, ... }, ... }
const coverage = {}
let file = null
for (const line of readFileSync(LCOV, 'utf8').split('\n')) {
  if (line.startsWith('SF:')) {
    file = line.slice(3).trim()
    coverage[file] = {}
  } else if (line.startsWith('DA:') && file) {
    const [ln, hits] = line.slice(3).split(',')
    coverage[file][Number(ln)] = Number(hits)
  }
}

// Parse staged diff to find added line numbers per file
const diff = execSync('git diff --cached -U0').toString()
const added = {} // { 'src/utils.js': Set<number> }
let cur = null
let lineNum = null

for (const line of diff.split('\n')) {
  if (line.startsWith('+++ b/')) {
    cur = line.slice(6).trim()
    added[cur] = added[cur] ?? new Set()
    lineNum = null
  } else if (line.startsWith('@@') && cur) {
    const m = line.match(/\+(\d+)/)
    lineNum = m ? Number(m[1]) : null
  } else if (line.startsWith('+') && !line.startsWith('+++') && lineNum !== null) {
    added[cur].add(lineNum++)
  }
  // '-' lines belong to the old file; don't advance lineNum
}

// Report any added lines with zero hits
let failed = false
for (const [f, lines] of Object.entries(added)) {
  const fileCov = coverage[f]
  if (!fileCov) continue // file not in coverage scope — skip

  for (const ln of lines) {
    if (ln in fileCov && fileCov[ln] === 0) {
      console.error(`  UNCOVERED  ${f}:${ln}`)
      failed = true
    }
  }
}

if (failed) {
  console.error('\nPatch coverage failed — add tests for the lines above before committing.')
  process.exit(1)
}

console.log('Patch coverage OK')
