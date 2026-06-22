## Context

Stryker v9 (`@stryker-mutator/core`) with the default `html` reporter outputs `reports/mutation/mutation.html`. GitHub Pages serves `index.html` at the site root (`dhansak79.github.io/FocusIn/`), so visiting the root returns 404.

The `mutation.yml` workflow uploads `reports/mutation/` as the Pages artifact. No `index.html` exists in that directory.

## Goals / Non-Goals

**Goals:**
- The GitHub Pages URL resolves to the mutation report HTML without manual navigation
- Fix is minimal and contained to CI config and/or Stryker config

**Non-Goals:**
- Changing the structure of the mutation report itself
- Adding a custom HTML wrapper or index page

## Decisions

**Configure Stryker to output `index.html` directly** via `stryker.config.json`:

```json
{
  "htmlReporter": { "fileName": "index.html" }
}
```

This is cleaner than a CI `cp` step because:
- The local `reports/mutation/` directory also gets a browseable `index.html`
- No extra CI step to maintain
- Self-documenting in the Stryker config

The existing `mutation.html` local artifact becomes `index.html` — no functional difference.

## Risks / Trade-offs

- Any bookmark or direct link to `mutation.html` will break (no redirect). Acceptable — the report URL was never publicly working anyway.
- Stryker v9 `htmlReporter.fileName` must be verified to be a supported option. If not, fall back to a `cp` step in `mutation.yml`.
