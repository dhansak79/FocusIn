## Context

The current `pages.yml` workflow file contains two jobs:

1. `mutation` — runs mutation tests, generates reports, assembles the Pages staging directory, and uploads both a `mutation-report` artifact and the GitHub Pages artifact
2. `deploy-pages` — deploys the Pages artifact

The `mutation` job name is misleading because it does far more than mutation testing: it also generates the guardrails dashboard, injects nav links into the Stryker HTML, assembles the staging directory (`reports/pages/`), and stages it for Pages deployment. On PRs the pages-specific steps are gated by `if: github.ref == 'refs/heads/main'`, but they still appear in the same job definition.

## Goals / Non-Goals

**Goals:**
- One workflow file responsible for mutation testing and reporting (`mutation.yml`)
- One workflow file responsible for Pages deployment (`pages.yml`)
- No change to the deployed output, URLs, or scripts

**Non-Goals:**
- Changing what gets deployed to GitHub Pages
- Modifying any of the `scripts/` files
- Changing PR behaviour (mutation tests still run on PRs)

## Decisions

### Chaining via `workflow_run`

The `deploy-pages` action requires that `upload-pages-artifact` runs in the **same** workflow run — GitHub Pages artifacts cannot be passed between unrelated workflow runs. This means `pages.yml` must run as a separate workflow that is triggered after `mutation.yml` completes.

The `workflow_run` event is used: `pages.yml` triggers when the workflow named `"Mutation"` completes on the `main` branch. This preserves the existing semantics (pages deploy only on main) without any `if: github.ref` guards inside the mutation job.

**Alternatives considered:**
- *Rename jobs only, keep one file*: Improves naming but doesn't achieve the file-level separation the user wants.
- *`needs:` across workflows*: Not supported by GitHub Actions — jobs in different workflows cannot depend on each other directly.

### Artifact handoff

`mutation.yml` uploads the `mutation-report` artifact as today. `pages.yml` downloads it using `actions/download-artifact` with `github-token` and `run-id` from the triggering workflow (`github.event.workflow_run.id`). This is the idiomatic pattern for cross-workflow artifact sharing.

### Triggering the pages workflow

`pages.yml` uses:
```yaml
on:
  workflow_run:
    workflows: ["Mutation"]
    types: [completed]
    branches: [main]
```

The pages job gates on `github.event.workflow_run.conclusion == 'success'` so that a failed mutation run does not deploy stale content.

## Risks / Trade-offs

- [Artifact retention] If the `mutation-report` artifact expires before the pages workflow picks it up (unlikely within the same run window, but possible if GitHub queuing delays exceed retention) → Mitigation: the default 90-day retention is far longer than any realistic queue delay.
- [`workflow_run` UI discoverability] The pages deploy run appears as a separate workflow run entry in the Actions tab, not as a child of the mutation run → Mitigation: workflow names (`Mutation`, `Pages`) make each run's purpose self-evident.
- [First-run ordering] On a repo with no prior mutation run, the pages workflow will never fire until a mutation run completes on main → Acceptable; this was already the implicit behaviour via the `if: github.ref` guards.
