## 1. Make spec-coverage.js unit-testable

- [x] 1.1 Export `parseScenarios`, `isCovered`, and `findFiles` as named exports from `scripts/spec-coverage.js`
- [x] 1.2 Wrap CLI side-effects (file reads for testContents, main loop, console output, process.exit) in an `if (process.argv[1] === fileURLToPath(import.meta.url))` guard so importing the module doesn't execute the CLI
- [x] 1.3 Add `scripts/spec-coverage.js` to vitest `coverage.include` in `vite.config.js`
- [x] 1.4 Create `tests/unit/spec-coverage.test.js` with direct unit tests for `parseScenarios`, `isCovered`, and `findFiles` — using temp fixture files, not spawnSync
- [x] 1.5 Remove `.codesceneignore` entry for `scripts/` (no longer needed once real coverage exists)

## 2. Kill author name extraction mutants (feed.js L62–L78)

- [x] 2.1 Add a test in `tests/spec/banner-author-display.spec.test.js` with an actor div whose `aria-label` contains "Premium 2nd" and assert the banner shows the cleaned name `"Grace Hopper"`
- [x] 2.2 Add a test where the `aria-label` contains "Profile 3rd+" suffix to cover the Profile-prefix variant of the regex

## 3. Kill slopRevealed guard mutants (feed.js L85, L91, L120)

- [x] 3.1 Add a test that sets `post.dataset.slopRevealed = 'true'` on a slop post before calling `doFeed` and asserts the post is not re-collapsed (no `focusedin-slop-collapsed` sibling added)

## 4. Kill dataset.hidden boolean mutant (feed.js L132)

- [x] 4.1 Add a keyword-match test in `tests/spec/` that asserts `post.dataset.hidden === 'true'` on the keyword-collapse path (distinct from the existing tone-filter test which covers the same assertion on a different path)

## 5. Kill if(author) branch mutant (feed.js L100)

- [x] 5.1 Add a test in `tests/spec/banner-author-display.spec.test.js` that exercises the slop-detection path (not semantic/pattern) with a post that has no author link and asserts the banner lacks a `.focusedin-slop-author` element

## 6. Verify and clean up

- [x] 6.1 Run `npm test && npm run coverage` — all tests pass, patch coverage OK
- [x] 6.2 Run `npm run mutate` — confirm mutation score improves on feed.js
