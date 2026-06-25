## 1. Fix Stryker HTML output path

- [x] 1.1 In `stryker.config.json`, change `htmlReporter.fileName` from `"index.html"` to `"reports/mutation/index.html"`

## 2. Verify locally

- [x] 2.1 Run `npm run mutate` locally and confirm `reports/mutation/index.html` is created (not just `index.html` at repo root)
- [x] 2.2 Run `npm test && npm run coverage` to confirm no regressions

## 3. Validate CI

- [ ] 3.1 Push to main (or open a PR) and confirm the mutation workflow run log shows `HtmlReporter … reports/mutation/index.html`
- [ ] 3.2 Confirm `dhansak79.github.io/FocusIn/` returns HTTP 200 after the deploy-pages job completes
