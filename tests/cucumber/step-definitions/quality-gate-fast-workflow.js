import { When, Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '../../..')
const WORKFLOWS_DIR = join(ROOT, 'workflows')

function findWorkflow(name) {
  for (const f of readdirSync(WORKFLOWS_DIR)) {
    if (!f.endsWith('.yaml')) continue
    const content = readFileSync(join(WORKFLOWS_DIR, f), 'utf8')
    if (content.includes(`name: ${name}\n`)) return content
  }
  return null
}

When('`quality-gate-fast` is run on a branch where all checks pass', function () {
  this.wfContent = findWorkflow('quality-gate-fast')
  assert.ok(this.wfContent, 'quality-gate-fast workflow YAML must exist')
})

When('`quality-gate-fast` runs and `lint` step fails', function () {
  this.wfContent = findWorkflow('quality-gate-fast')
  assert.ok(this.wfContent, 'quality-gate-fast workflow YAML must exist')
})

When('`quality-gate-fast` runs and the `tests` step in the `check` job fails', function () {
  this.wfContent = findWorkflow('quality-gate-fast')
  assert.ok(this.wfContent, 'quality-gate-fast workflow YAML must exist')
})

When('`quality-gate-fast` runs successfully through the `coverage` job', function () {
  this.wfContent = findWorkflow('quality-gate-fast')
  assert.ok(this.wfContent, 'quality-gate-fast workflow YAML must exist')
})

When('the `quality-gate` workflow is run', function () {
  this.wfContent = findWorkflow('quality-gate')
  assert.ok(this.wfContent, 'quality-gate workflow YAML must exist')
})

When('any step in `quality-gate` before mutation fails', function () {
  this.wfContent = findWorkflow('quality-gate')
  assert.ok(this.wfContent, 'quality-gate workflow YAML must exist')
})

Then('all five jobs SHALL complete with status `succeeded` and each SHALL write its corresponding swamp data resource', function () {
  const wf = this.wfContent
  assert.ok(wf.includes('name: check'), 'check job must exist')
  assert.ok(wf.includes('name: coverage'), 'coverage job must exist')
  assert.ok(wf.includes('name: deno-ext'), 'deno-ext job must exist')
  assert.ok(wf.includes('name: patch-coverage'), 'patch-coverage job must exist')
  assert.ok(wf.includes('spec-coverage'), 'spec-coverage step must exist')
})

Then('the `check` job SHALL fail and the subsequent `coverage`, `deno-ext`, and `patch-coverage` jobs SHALL NOT run', function () {
  const wf = this.wfContent
  assert.ok(wf.includes('dependsOn'), 'downstream jobs must use dependsOn')
  assert.ok(wf.includes('type: succeeded'), 'downstream jobs must require succeeded condition so they skip on failure')
})

Then(/the `coverage` job SHALL NOT run \(dependsOn: check with condition: succeeded\)/, function () {
  const wf = this.wfContent
  // Find coverage job section and assert it depends on check with succeeded
  const coverageIdx = wf.indexOf('\n  - name: coverage\n')
  assert.ok(coverageIdx > 0, 'coverage job must exist')
  const coverageSection = wf.slice(coverageIdx, coverageIdx + 300)
  assert.ok(coverageSection.includes('dependsOn'), 'coverage job must have dependsOn')
  assert.ok(coverageSection.includes('check'), 'coverage must depend on check job')
  assert.ok(coverageSection.includes('succeeded'), 'coverage must require check to succeed')
})

Then(/the `deno-ext` job SHALL run next, and SHALL append deno coverage data to `coverage\/lcov\.info` before `patch-coverage` reads it/, function () {
  const wf = this.wfContent
  const denoIdx = wf.indexOf('name: deno-ext')
  const patchIdx = wf.indexOf('name: patch-coverage')
  assert.ok(denoIdx > 0, 'deno-ext job must exist')
  assert.ok(patchIdx > denoIdx, 'patch-coverage must come after deno-ext')
  // patch-coverage section must reference deno-ext in dependsOn
  const patchSection = wf.slice(patchIdx, patchIdx + 400)
  assert.ok(patchSection.includes('deno-ext'), 'patch-coverage must depend on deno-ext job')
})

Then('it SHALL execute lint, knip, spec-coverage, vitest tests, CodeScene health, vitest coverage, deno extension tests, and patch-coverage steps, followed by mutation testing', function () {
  const wf = this.wfContent
  assert.ok(wf.includes('focusin-lint'), 'must include lint step')
  assert.ok(wf.includes('focusin-knip'), 'must include knip step')
  assert.ok(wf.includes('focusin-spec-coverage'), 'must include spec-coverage step')
  assert.ok(wf.includes('focusin-tests'), 'must include vitest tests step')
  assert.ok(wf.includes('focusin-codescene'), 'must include CodeScene health step')
  assert.ok(wf.includes('focusin-deno-ext-tests'), 'must include deno ext tests step')
  assert.ok(wf.includes('focusin-patch-coverage'), 'must include patch-coverage step')
  assert.ok(wf.includes('focusin-mutation'), 'must include mutation step')
})

Then('the `mutation` job SHALL NOT run', function () {
  const wf = this.wfContent
  const mutationIdx = wf.indexOf('\n  - name: mutation\n')
  assert.ok(mutationIdx > 0, 'mutation job must exist')
  const mutationSection = wf.slice(mutationIdx, mutationIdx + 400)
  assert.ok(mutationSection.includes('dependsOn'), 'mutation job must have dependsOn')
  assert.ok(mutationSection.includes('succeeded'), 'mutation must require preceding jobs to succeed')
})
