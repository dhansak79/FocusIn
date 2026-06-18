#!/usr/bin/env node
/* eslint-env node */
import { spawnSync, execSync } from 'child_process'

process.env.PATH = `${process.env.HOME}/.local/bin:${process.env.PATH}`

if (spawnSync('cs', ['version'], { stdio: 'ignore' }).error) {
  console.error(
    'CodeScene health gate: cs is not installed.\n' +
    'Follow the guidance at https://codescene.io/docs/cli/index.html to install it.'
  )
  process.exit(1)
}

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
    for (const fn of (finding.functions ?? [])) {
      console.error(`    ${fn.title} (${fn.details}, lines ${fn['start-line']}–${fn['end-line']})`)
    }
  }
  failed = true
}

if (failed) {
  console.error(`
CodeScene health gate failed — all modified files must score ${MIN_HEALTH}/10 before committing.

To fix: use the CodeScene MCP tool \`code_health_review\` on each failing file for a detailed
breakdown, then follow the \`codescene:guiding-refactoring-with-code-health\` skill to work
through the issues in small, verifiable steps.`)
  process.exit(1)
}

console.log('CodeScene health gate OK')
