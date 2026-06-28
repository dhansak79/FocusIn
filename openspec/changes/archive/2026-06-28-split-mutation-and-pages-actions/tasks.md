## 1. Create mutation.yml

- [x] 1.1 Create `.github/workflows/mutation.yml` with name `"Mutation"`, triggers on `push: branches: [main]` and `pull_request: branches: [main]`
- [x] 1.2 Add the `mutation` job: checkout, setup-node (node 22, npm cache), `npm ci`, `npm run mutate`
- [x] 1.3 Add the generate-mutation-summary step (`node scripts/mutation-report.js`, `if: always()`)
- [x] 1.4 Add the post-summary-to-job-page step (`cat reports/mutation/mutation-summary.md >> $GITHUB_STEP_SUMMARY`, `if: always()`)
- [x] 1.5 Add the upload-mutation-report-artifact step (`actions/upload-artifact@v4`, `if: always()`, path `reports/mutation/`)

## 2. Rewrite pages.yml

- [x] 2.1 Replace the `mutation` job and `deploy-pages` job in `pages.yml` with a `workflow_run` trigger: workflows `["Mutation"]`, types `[completed]`, branches `[main]`
- [x] 2.2 Remove the `push`/`pull_request` triggers and the existing jobs from `pages.yml`
- [x] 2.3 Add a `publish` job that gates on `github.event.workflow_run.conclusion == 'success'`
- [x] 2.4 Add step to download the `mutation-report` artifact from the triggering run using `actions/download-artifact@v4` with `github-token: ${{ secrets.GITHUB_TOKEN }}` and `run-id: ${{ github.event.workflow_run.id }}`
- [x] 2.5 Add the generate-guardrails-dashboard step (`node scripts/generate-guardrails-dashboard.js`)
- [x] 2.6 Add the inject-dashboard-link step (`node scripts/inject-dashboard-link.js`)
- [x] 2.7 Add the assemble-pages-staging-directory step (mkdir `reports/pages/insights`, copy mutation report and dashboard)
- [x] 2.8 Add the upload-pages-artifact step (`actions/upload-pages-artifact@v3`, path `reports/pages/`)
- [x] 2.9 Add the `deploy-pages` job (`needs: publish`, environment `github-pages`, `actions/deploy-pages@v4`)
- [x] 2.10 Ensure `permissions` block covers `contents: read`, `pages: write`, `id-token: write`, and `actions: read` (needed for cross-workflow artifact download)

## 3. Update README badge

- [x] 3.1 In `README.md` line 1, replace the `[![Pages](.../pages.yml/badge.svg)](...)` badge with `[![Mutation](https://github.com/dhansak79/FocusIn/actions/workflows/mutation.yml/badge.svg)](https://github.com/dhansak79/FocusIn/actions/workflows/mutation.yml)`

## 4. Verify

- [x] 4.1 Confirm `pages.yml` no longer contains any mutation-test steps
- [x] 4.2 Confirm `mutation.yml` no longer contains any pages-assembly or pages-upload steps
- [x] 4.3 Confirm `README.md` shows the Mutation badge and not the Pages badge
- [ ] 4.4 Push to a feature branch and verify the Mutation workflow runs and uploads the artifact
- [ ] 4.5 Merge to main and verify the Pages workflow triggers via `workflow_run` and deploys successfully
