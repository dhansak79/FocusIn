## Purpose

Defines the requirement that the mutation test HTML report is accessible via the GitHub Pages root URL after a push to main.

## Requirements

### Requirement: Mutation report is accessible at the GitHub Pages root URL
The CI pipeline SHALL ensure that the mutation report is accessible at `https://dhansak79.github.io/FocusIn/` without requiring any subpath navigation. The Pages artifact root SHALL contain an `index.html` that is the Stryker HTML report.

`htmlReporter.fileName` in `stryker.config.json` MUST be set to `"reports/mutation/index.html"` (a path relative to the working directory, not just `"index.html"`). This ensures the HTML report is written into the directory that `upload-pages-artifact` uploads.

#### Scenario: GitHub Pages root resolves to mutation report
- **WHEN** the mutation workflow completes on a push to main
- **THEN** the deployed GitHub Pages site serves the Stryker HTML report at the root URL with HTTP 200
