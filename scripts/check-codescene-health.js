#!/usr/bin/env node
/* eslint-env node */
import { spawnSync, execSync } from 'child_process'

process.env.PATH = `${process.env.HOME}/.local/bin:${process.env.PATH}`

const MIN_HEALTH = 10.0
let failed = false

const staged = execSync('git diff --cached --name-only --diff-filter=ACM')
  .toString()
  .trim()
  .split('\n')
  .filter(Boolean)

for (const file of staged) {
  const content = spawnSync('git', ['show', `:${file}`])
  if (content.status !== 0) continue

  const review = spawnSync('cs', ['review', '--file-name', file, '--output-format', 'json'], {
    input: content.stdout,
  })
  if (review.status !== 0) continue

  let result
  try {
    result = JSON.parse(review.stdout.toString())
  } catch {
    continue
  }

  const { score, review: findings } = result
  if (score == null || score >= MIN_HEALTH) continue

  console.error(`\n  ${file}  —  Code Health ${score}/10`)
  for (const finding of findings) {
    console.error(`  [${finding.category}]`)
    for (const fn of finding.functions) {
      console.error(`    ${fn.title} (${fn.details}, lines ${fn['start-line']}–${fn['end-line']})`)
    }
  }
  failed = true
}

if (failed) {
  console.error(
    `\nCodeScene health gate failed — all modified files must score ${MIN_HEALTH}/10 before committing.`
  )
  process.exit(1)
}

console.log('CodeScene health gate OK')
