#!/usr/bin/env node
/* eslint-env node */
import { spawnSync, execSync } from 'child_process'

const MIN_HEALTH = 10.0
const CS_CANDIDATES = ['cs', `${process.env.HOME}/.local/bin/cs`]

const csCmd = CS_CANDIDATES.find((cmd) => {
  const r = spawnSync(cmd, ['version'], { stdio: 'ignore' })
  return r.status === 0
})

if (!csCmd) {
  console.log('CodeScene health gate: cs not installed, skipping.')
  process.exit(0)
}

const staged = execSync('git diff --cached --name-only --diff-filter=ACM')
  .toString()
  .trim()
  .split('\n')
  .filter((f) => f.endsWith('.js') && f.length > 0)

if (!staged.length) process.exit(0)

let failed = false

for (const file of staged) {
  const content = spawnSync('git', ['show', `:${file}`])
  if (content.status !== 0) continue

  const review = spawnSync(csCmd, ['review', '--file-name', file, '--output-format', 'json'], {
    input: content.stdout,
  })

  if (review.status !== 0) continue

  let result
  try {
    result = JSON.parse(review.stdout.toString())
  } catch {
    continue
  }

  const { score } = result
  if (score === null || score === undefined) continue

  if (score < MIN_HEALTH) {
    console.error(`  HEALTH ${score}/10  ${file}`)
    failed = true
  }
}

if (failed) {
  console.error(
    `\nCodeScene health gate failed — all modified files must score ${MIN_HEALTH}/10 before committing.`
  )
  process.exit(1)
}

console.log('CodeScene health gate OK')
