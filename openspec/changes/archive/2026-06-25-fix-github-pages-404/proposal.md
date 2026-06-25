## Why

The GitHub Pages site at `dhansak79.github.io/FocusIn/` returns 404 because Stryker's `htmlReporter.fileName` is relative to the working directory (repo root), not the output directory — so `index.html` lands at the repo root, not inside `reports/mutation/`. The previous fix (#52) set `fileName: "index.html"` but that path is interpreted from `cwd`, placing the file outside the directory uploaded to Pages.

## What Changes

- Fix `stryker.config.json`: set `htmlReporter.fileName` to `"reports/mutation/index.html"` so the file is written into the directory that `upload-pages-artifact` uploads.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `mutation-report-pages`: The HTML report now lands at the correct path (`reports/mutation/index.html`) so Pages serves it at the site root.

## Impact

- `stryker.config.json`: one-line change to `htmlReporter.fileName`.
- No test changes, no workflow changes, no dependency changes.
