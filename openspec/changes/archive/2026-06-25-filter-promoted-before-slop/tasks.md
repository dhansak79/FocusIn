## 1. Core Fix

- [x] 1.1 In `src/features/feed.js`, refactor the `isPromotedPost` check in `applyKeywordToPost` to run unconditionally (not gated on `hidePromoted`), with an inner `if (hidePromoted)` block for hiding and a bare `return` for both branches.

## 2. Tests

- [x] 2.1 Add test: promoted post that is also slop is NOT soft-hidden (no `focusedin-slop-soft-hide` class, no banner) when `hide-promoted` is off.
- [x] 2.2 Add test: promoted post that is also slop is hard-hidden (not soft-hidden, no "Show anyway" banner) when `hide-promoted` is on.
- [x] 2.3 Add test: promoted post that matches a keyword is not keyword-filtered (exits promoted path instead).
- [x] 2.4 Verify existing slop/keyword/promoted tests still pass (`npm test`).

## 3. Spec Coverage

- [x] 3.1 Run `npm run coverage` and confirm patch coverage is 100% for changed lines.
