## 1. Configure Stryker HTML output

- [x] 1.1 Add `"htmlReporter": { "fileName": "index.html" }` to `stryker.config.json` so Stryker outputs `reports/mutation/index.html` instead of `mutation.html`
- [x] 1.2 Rename (or delete) the existing local `reports/mutation/mutation.html` to `reports/mutation/index.html` to keep the local copy consistent

## 2. Update CI workflow

- [x] 2.1 Remove or update any CI step that references `mutation.html` by name (if any)

## 3. Verify and test

- [x] 3.1 Run `npm run mutate` locally and confirm `reports/mutation/index.html` is generated
- [x] 3.2 Run `npm test && npm run coverage` to confirm no regressions
