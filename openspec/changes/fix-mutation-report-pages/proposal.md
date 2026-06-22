## Why

The mutation test report is published to GitHub Pages but returns a 404 because Stryker's HTML reporter outputs `mutation.html` while GitHub Pages serves `index.html` at the site root. The report link is broken and inaccessible.

## What Changes

- Add a CI step in `mutation.yml` that copies `reports/mutation/mutation.html` → `reports/mutation/index.html` before the Pages upload
- Alternatively, configure Stryker's HTML reporter to output `index.html` directly via `stryker.config.json`

## Capabilities

### New Capabilities

- `mutation-report-pages`: Mutation HTML report reliably accessible at the GitHub Pages root URL

### Modified Capabilities

(none — no spec-level requirement changes)

## Impact

- `.github/workflows/mutation.yml`: add copy/rename step before `upload-pages-artifact`
- `stryker.config.json`: potentially add `htmlReporter.fileName` config
- `reports/mutation/`: local report files unchanged in structure, CI output gains `index.html`
