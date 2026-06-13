---
name: testing
description: Mandatory gate before declaring any code change done. Run tests and coverage checks after every implementation change. Use this to verify a feature, fix, or refactor is actually complete.
---

# Testing Gate

## Definition of Done

No code change is finished until both of these pass:

1. **`npm test`** — all tests green, exit 0.
2. **`npm run coverage`** — all four thresholds met (statements, branches, functions, lines ≥ 90%), exit 0.

Run them in this order. Do not skip to coverage if tests are failing.

## When to Run

- After implementing any feature, fix, or refactor.
- After updating or adding tests.
- Before every commit (the pre-commit hook enforces this automatically, but run manually first to catch failures early).

## Reading the Coverage Report

The report shows per-file breakdown. When a threshold fails:

- **Branches** is the most common failure — look for uncovered `if`/`else`, optional chaining (`?.`), and short-circuit (`||`/`&&`) paths.
- **Functions** — a function that is defined but never called in tests.
- Check the `Uncovered Line #s` column to find exactly what is missing.

Add the minimal tests that cover the gap, then re-run. Do not lower the thresholds to make coverage pass.

## Common Mistakes

- Declaring done after implementation without running tests.
- Running `npm test` but not `npm run coverage` — tests can pass while coverage drops below threshold.
- Adding tests that execute the code but don't assert anything meaningful — coverage goes up, but the tests don't catch regressions.
- Lowering thresholds instead of writing tests.
