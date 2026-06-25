## MODIFIED Requirements

### Requirement: Mutation report is accessible at the GitHub Pages root URL

Implementation constraint refined: `htmlReporter.fileName` in `stryker.config.json` MUST be set to `"reports/mutation/index.html"` (a path relative to the working directory), not just `"index.html"`. This ensures the HTML report is written into the directory that `upload-pages-artifact` uploads, so the Pages deployment includes it.

No change to the observable behaviour requirement — `dhansak79.github.io/FocusIn/` SHALL still serve the Stryker HTML report at HTTP 200 after a push to main.
