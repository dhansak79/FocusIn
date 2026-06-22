## Context

Stryker identified 61 survived mutants in `feed.js` (score: 72.88%) and 8 in `utils.js`. The survivors cluster into five groups. Separately, `scripts/spec-coverage.js` shows 0% line coverage in CI because all its tests use `spawnSync` — the child process isn't instrumented by v8.

## Goals / Non-Goals

**Goals:**
- Kill the highest-density mutation clusters in `feed.js` with focused boundary tests
- Make `scripts/spec-coverage.js` importable so its functions can be unit-tested directly
- Get CodeScene and Codecov coverage gates passing without `.codesceneignore` workarounds

**Non-Goals:**
- 100% mutation score — some survivors (console.log strings, auto-scroll interval edge cases) are not worth the test complexity
- Retrofitting existing unit tests

## Decisions

**Decision: Export functions from spec-coverage.js rather than extracting a separate module**

The script is already clean. Adding `export` keywords to the three core functions (`parseScenarios`, `isCovered`, `findFiles`) and wrapping the CLI side-effects in an `if (process.argv[1] === fileURLToPath(import.meta.url))` guard is the minimal change. No new file needed.

The unit tests live in `tests/unit/spec-coverage.test.js` (not `tests/spec/`) because they test a script, not a feed boundary. Add `scripts/spec-coverage.js` to vitest `coverage.include` so it appears in lcov.

**Decision: Prioritise mutation clusters by density, not line number**

Kill order:
1. **Author name extraction** (L62–L78, ~14 mutants) — one test with a "Grace Hopper Premium 2nd" aria-label kills the entire regex cluster in `banner-author-display.spec.test.js`
2. **`slopRevealed` guard** (L85, L91, L120, ~3 mutants) — test that a post with `dataset.slopRevealed = 'true'` is not re-collapsed; goes in `author-whitelist.spec.test.js` or a dedicated slop-revealed file
3. **`post.dataset.hidden` boolean** (L132) — assert `dataset.hidden === 'true'` on the keyword-match path (not just tone path); the existing tone test covers tone, need a keyword test
4. **`if (author)` branch** (L100) — assert banner differs when author present vs absent on the *slop* path (banner-author-display already covers semantic/pattern paths)
5. **`runs % 10` reset** (L153) — call `doFeed()` 10 times in a loop and assert `resetShownPosts` side-effect; lower priority, add if time permits

**Decision: Skip auto-scroll cluster (L197–L234)**

The auto-scroll mutants require URL changes and interval manipulation across multiple `doFeed` calls. The test complexity exceeds the value — 10 mutants from a non-critical UX feature.

## Risks / Trade-offs

- [Risk] Adding `scripts/spec-coverage.js` to vitest `include` will show real uncovered lines if the unit tests don't reach 95% patch coverage → Mitigation: the unit tests target every exported function, covering all meaningful branches
- [Risk] The `if (process.argv[1] === ...)` guard changes the CLI entrypoint detection — test manually that `npm run spec:coverage` still works → the existing `spawnSync` integration test covers this
