import { When, Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '../../..')
const PRE_COMMIT = join(ROOT, '.githooks', 'pre-commit')

let hookContent = null

function getHook() {
  if (!hookContent) hookContent = readFileSync(PRE_COMMIT, 'utf8')
  return hookContent
}

When('a developer runs `git commit`', function () {
  this.hookContent = getHook()
})

When('the pre-commit hook runs on a machine where `swamp` is not on PATH', function () {
  this.hookContent = getHook()
})

When('a developer runs `git commit` after this change', function () {
  this.hookContent = getHook()
})

When('the pre-commit hook runs', function () {
  this.hookContent = getHook()
})

Then('the pre-commit hook SHALL run `$SWAMP workflow run quality-gate-fast` and the commit SHALL succeed only if all steps in `quality-gate-fast` pass', function () {
  assert.ok(this.hookContent.includes('workflow run quality-gate-fast'), 'pre-commit should invoke quality-gate-fast workflow')
  // Hook must propagate exit code (not swallow it)
  assert.ok(
    this.hookContent.includes('RESULT=$?') || this.hookContent.includes('exit $RESULT') || this.hookContent.includes('exit $?'),
    'pre-commit should propagate workflow exit code to git'
  )
})

Then(/the hook SHALL fall back to `~\/.swamp\/bin\/swamp`, consistent with the pre-push hook pattern/, function () {
  assert.ok(this.hookContent.includes('~/.swamp/bin/swamp') || this.hookContent.includes('${HOME}/.swamp/bin/swamp'), 'hook should fall back to ~/.swamp/bin/swamp')
  assert.ok(this.hookContent.includes('command -v swamp'), 'hook should check if swamp is on PATH first')
})

Then('the hook SHALL NOT directly invoke `npm run lint`, `npm run knip`, `npm run coverage`, `deno test`, `check-patch-coverage.js`, or `check-codescene-health.js`', function () {
  assert.ok(!this.hookContent.includes('npm run lint'), 'hook should not call npm run lint directly')
  assert.ok(!this.hookContent.includes('npm run knip'), 'hook should not call npm run knip directly')
  assert.ok(!this.hookContent.includes('npm run coverage'), 'hook should not call npm run coverage directly')
  assert.ok(!this.hookContent.includes('deno test'), 'hook should not call deno test directly')
  assert.ok(!this.hookContent.includes('check-patch-coverage'), 'hook should not call check-patch-coverage.js directly')
  assert.ok(!this.hookContent.includes('check-codescene-health'), 'hook should not call check-codescene-health.js directly')
})

Then('the CodeScene health check SHALL execute through the `focusin-codescene` swamp model method, not via the standalone script', function () {
  assert.ok(!this.hookContent.includes('check-codescene-health'), 'hook should not call CodeScene script directly')
  // CodeScene runs through quality-gate-fast workflow which includes the codescene-health step
  assert.ok(this.hookContent.includes('quality-gate-fast'), 'hook should delegate to quality-gate-fast which includes CodeScene')
})
