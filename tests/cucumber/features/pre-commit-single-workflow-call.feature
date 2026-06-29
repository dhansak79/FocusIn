Feature: pre-commit-single-workflow-call


  Scenario: pre-commit triggers quality-gate-fast on git commit
    When a developer runs `git commit`
    Then the pre-commit hook SHALL run `$SWAMP workflow run quality-gate-fast` and the commit SHALL succeed only if all steps in `quality-gate-fast` pass


  Scenario: pre-commit hook uses path-resilient swamp invocation
    When the pre-commit hook runs on a machine where `swamp` is not on PATH
    Then the hook SHALL fall back to `~/.swamp/bin/swamp`, consistent with the pre-push hook pattern


  Scenario: pre-commit no longer invokes shell quality scripts directly
    When a developer runs `git commit` after this change
    Then the hook SHALL NOT directly invoke `npm run lint`, `npm run knip`, `npm run coverage`, `deno test`, `check-patch-coverage.js`, or `check-codescene-health.js`


  Scenario: CodeScene check runs via swamp model after this change
    When the pre-commit hook runs
    Then the CodeScene health check SHALL execute through the `focusin-codescene` swamp model method, not via the standalone script
