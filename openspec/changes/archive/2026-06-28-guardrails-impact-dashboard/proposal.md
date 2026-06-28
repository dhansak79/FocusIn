## Why

The `.swamp` directory accumulates rich workflow telemetry — pass/fail status, step timing, coverage percentages, code health scores — that only exists locally and never gets shared. Committing the raw workflow run YAML files and building a GitHub Pages dashboard makes the value of the quality guardrails visible: visitors can see concrete metrics over time and understand what the codebase would look like if those gates didn't exist. A complementary swamp report extension surfaces the same data immediately in the developer's terminal after every gate run.

## What Changes

- `.swamp/workflow-runs/**/*.yaml` files are un-gitignored (outside the swamp-managed block) and committed as the authoritative telemetry record — GUID filenames mean no merge conflicts
- A swamp workflow-scope report extension on `quality-gate` runs after every gate attempt and displays a per-run terminal summary: attempt count, what blocked, key metrics
- A Node.js dashboard generator script reads the committed YAMLs in CI, clusters runs into sessions, and writes a single self-contained `reports/workflow-insights/index.html` with all data embedded
- The dashboard shows the spec coverage trajectory the codebase was on before the gate hardened, and the attempt counts that demonstrate the gate working
- `spec-coverage` is hardened from `allowFailure: true` to a blocking gate — threshold set conservatively for now, ratcheted up in a follow-on PR
- The existing `mutation.yml` workflow is extended to generate the dashboard and co-deploy it to GitHub Pages alongside the Stryker report

## Capabilities

### New Capabilities

- `quality-gate-swamp-report`: Swamp workflow-scope report extension that runs after every `quality-gate` execution and produces a terminal summary showing attempt count, blocking step, and key quality metrics for that run
- `guardrails-impact-dashboard`: Self-contained static HTML dashboard deployed to GitHub Pages at `/insights/` that visualises spec coverage trajectory over time and agent attempt counts per session, with data embedded at CI build time from committed YAML telemetry files

### Modified Capabilities

- `mutation-report-pages`: The Pages artifact must now include both the Stryker report and the guardrails dashboard so both are accessible at their respective paths on the deployed site

## Impact

- `.gitignore` — manual allowlist section (outside swamp-managed block) tracks `.swamp/workflow-runs/**/*.yaml`
- `extensions/models/` — new swamp report extension TypeScript file
- `scripts/generate-guardrails-dashboard.js` — new Node.js script run in CI
- `.github/workflows/mutation.yml` — new steps for dashboard generation, link injection via cheerio, and updated Pages artifact path
- No changes to production extension code or the Chrome extension itself
