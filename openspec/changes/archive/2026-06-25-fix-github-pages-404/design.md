## Context

Stryker's `htmlReporter.fileName` is documented as a path relative to the working directory (repo root), not relative to Stryker's internal output directory. The previous fix set `"fileName": "index.html"`, which wrote the file to the repo root. The `upload-pages-artifact` step uploads `reports/mutation/`, so the HTML file was never included in the Pages deployment — causing an ongoing 404.

CI log evidence from run 27955707873 (the PR #52 fix, which "succeeded"):
```
INFO HtmlReporter  Your report can be found at: file://.../FocusIn/index.html        ← repo root
INFO JsonReporter  Your report can be found at: file://.../FocusIn/reports/mutation/mutation.json  ← correct
```

## Goals / Non-Goals

**Goals:**
- `reports/mutation/index.html` exists after `npm run mutate` so the `upload-pages-artifact` step includes it.
- `dhansak79.github.io/FocusIn/` serves HTTP 200 with the Stryker report after the next push to main.

**Non-Goals:**
- Changing the CI workflow structure.
- Changing Stryker output for any other reporter.

## Decisions

**Change `htmlReporter.fileName` to `"reports/mutation/index.html"`.**

This is a relative path from the working directory, so Stryker writes to the same directory the JSON reporter uses. No workflow changes needed.

Alternatives considered:
- Add a `cp` step in the workflow to move `index.html` into `reports/mutation/` after Stryker runs — more moving parts, not idiomatic.
- Change the `upload-pages-artifact` path to `.` (repo root) — would deploy the entire repo to Pages, not just the report.

## Risks / Trade-offs

- [Low] If a future Stryker version changes how `fileName` is resolved, this could break again. Mitigation: the CI log output path is an observable signal; if 404 recurs, check that log line first.
