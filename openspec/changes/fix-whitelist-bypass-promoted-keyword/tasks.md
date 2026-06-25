## 1. Implementation

- [ ] 1.1 In `applyKeywordToPost`, extract `extractAuthorVanityName(post)` once at the top of the function (before the `postsProcessed++` increment) and assign to `vanity`
- [ ] 1.2 Add `if (vanity && whitelisted.has(vanity)) return` guard immediately before the `hidePost` call in the promoted-post branch (line ~424)
- [ ] 1.3 Add `if (vanity && whitelisted.has(vanity)) return` guard immediately before the `hidePost` call in the keyword-match branch (line ~430)
- [ ] 1.4 Update the existing `trackAuthorBlocked` call in the keyword branch to reuse the already-extracted `vanity` instead of calling `extractAuthorVanityName(post)` again

## 2. Spec Delta

- [ ] 2.1 Update `openspec/specs/author-whitelist/spec.md` with the two new scenarios from the delta spec (whitelist bypasses keyword match; whitelist bypasses promoted-post filter)

## 3. Tests

- [ ] 3.1 Add a test in `tests/spec/author-whitelist.spec.test.js` for the scenario "Whitelisted author bypasses keyword match"
- [ ] 3.2 Add a test in `tests/spec/author-whitelist.spec.test.js` for the scenario "Whitelisted author bypasses promoted-post filter"
- [ ] 3.3 Run `npm test && npm run coverage` and confirm both pass with no regressions
