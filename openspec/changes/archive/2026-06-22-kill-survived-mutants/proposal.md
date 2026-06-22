## Why

Stryker mutation testing reveals 61 survived mutants in `feed.js` and 8 in `utils.js`, concentrated in author name extraction, the `slopRevealed` guard, and the auto-scroll subsystem. Additionally, `scripts/spec-coverage.js` has 0% line coverage in CI because its tests run it via `spawnSync` — meaning CodeScene and Codecov flag it as uncovered new code on every PR.

## What Changes

- Add boundary tests in `tests/spec/` that kill the highest-density mutant clusters in `feed.js`: author name regex cleanup, `slopRevealed` re-collapse guard, `if (author)` banner branch, and `post.dataset.hidden` boolean
- Add direct unit tests for `scripts/spec-coverage.js` functions (imported as a module) so CI coverage tools see them as covered
- Refactor `scripts/spec-coverage.js` to export its core functions (`parseScenarios`, `isCovered`, `findFiles`) so they can be unit-tested without spawning a child process

## Capabilities

### New Capabilities

- `spec-coverage-unit`: Unit-testable exports for `scripts/spec-coverage.js` core functions

### Modified Capabilities

- `spec-coverage`: `scripts/spec-coverage.js` now exports functions; CLI entrypoint remains unchanged

## Impact

- `scripts/spec-coverage.js`: split into exported functions + thin CLI wrapper
- `tests/spec/`: new tests targeting specific `feed.js` mutation survivors
- `tests/unit/spec-coverage.test.js` (new): direct unit tests for exported parser functions
- CodeScene and Codecov coverage gates: should pass without needing `.codesceneignore` workaround
