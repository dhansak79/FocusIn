## Why

The current `pages.yml` workflow is misleadingly named — its primary `mutation` job runs mutation tests, generates reports, assembles the Pages staging directory, and uploads both mutation and Pages artifacts, while `deploy-pages` merely deploys. This makes it hard to understand what runs when, where to look when a step fails, and how the pipeline fits together. Splitting by responsibility (mutation testing vs. report publishing) makes each file's purpose immediately clear.

## What Changes

- The existing `pages.yml` is split into two workflow files:
  - `mutation.yml` — runs mutation tests, generates the mutation report and summary, and uploads the `mutation-report` artifact
  - `pages.yml` — downloads the `mutation-report` artifact from the mutation workflow (via `workflow_run`), generates the guardrails dashboard, assembles the Pages staging directory, uploads the Pages artifact, and deploys to GitHub Pages
- The `mutation` job in the old file is removed and replaced by the new `mutation.yml`
- The `deploy-pages` job and pages-assembly steps move into the new `pages.yml`
- Both workflows trigger on push to `main` and pull requests to `main`, with the pages workflow additionally using `workflow_run` to depend on the mutation workflow completing

## Capabilities

### New Capabilities
<!-- none — this is a structural refactor with no new user-visible behaviour -->

### Modified Capabilities
- `mutation-report-pages`: The deployment pipeline is restructured into two files; the requirements for what gets deployed and how the pages are assembled are unchanged, but the workflow topology changes

## Impact

- `.github/workflows/pages.yml` — split into two files
- `.github/workflows/mutation.yml` — new file
- No changes to scripts, reports structure, or deployed output
