## 1. DOM Detection Fix

- [x] 1.1 In `isPromotedPost` (`src/features/feed.js` line ~259), replace `textBox && !textBox.contains(el)` with `!textBox?.contains(el)` so the "Promoted" label is detected even when `expandable-text-box` is absent
- [x] 1.2 Verify the change does not affect existing passing tests for the promoted-post scenario

## 2. Stats Tracking

- [x] 2.1 In the promoted-post branch of `applyKeywordToPost` (`src/features/feed.js` line ~423), extract `vanity` and `name` via `extractAuthorVanityName(post)` and `extractAuthorName(post)` before the `hidePost` call (or reuse if already extracted by `fix-whitelist-bypass-promoted-keyword`)
- [x] 2.2 Add `countOnce(post, trackPostFiltered)` after `hidePost(post, mode)` in the promoted branch
- [x] 2.3 Add `trackAuthorBlocked(vanity, name)` after the `countOnce` call in the promoted branch
- [x] 2.4 Confirm the stats calls are placed after any whitelist guard inserted by `fix-whitelist-bypass-promoted-keyword` so whitelisted authors are not counted

## 3. Popup XSS Fix

- [x] 3.1 Add an `escapeHtml(str)` helper at the top of `src/stats-renderer.js` that replaces `&`, `<`, `>`, and `"` with their HTML entities
- [x] 3.2 Wrap `name` with `escapeHtml()` in the `renderAuthorTally` template literal (line ~14)
- [x] 3.3 Wrap `signal` with `escapeHtml()` in the `renderDamageReport` template literal (line ~31)

## 4. Spec Sync

- [x] 4.1 Update `openspec/specs/hide-promoted-posts/spec.md` with the modified requirement (robust detection) and new requirement (stats tracking) from the delta spec
- [x] 4.2 Update `openspec/specs/author-block-stats/spec.md` with the new promoted-post scenario and the HTML-escaping requirement from the delta spec

## 5. Tests

- [x] 5.1 Add a test in `tests/spec/hide-promoted-posts.spec.test.js` for "Image-only promoted post is hidden" (post without expandable-text-box)
- [x] 5.2 Add a test for "Promoted hide increments filtered counter" in `tests/spec/hide-promoted-posts.spec.test.js`
- [x] 5.3 Add a test for "Promoted hide records author in blocked-authors map" in `tests/spec/hide-promoted-posts.spec.test.js`
- [x] 5.4 Add a test in `tests/spec/author-block-stats.spec.test.js` for "Block count increments on promoted-post filter"
- [x] 5.5 Add a unit test in `tests/stats-renderer.test.js` for "HTML metacharacters in author name are escaped"
- [x] 5.6 Run `npm test && npm run coverage` and confirm both pass with no regressions
