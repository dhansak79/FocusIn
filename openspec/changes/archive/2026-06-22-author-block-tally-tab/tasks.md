## 1. Extend stats module with per-author tracking

- [x] 1.1 Add `authors` sub-map to the `zero()` factory in `src/stats.js`
- [x] 1.2 Add `trackAuthorBlocked(vanityName, displayName)` export that accumulates into `pending.authors` and calls `schedule()`
- [x] 1.3 Extend `applyDelta` to merge `delta.authors` into the stored `authors` map (increment counts, update display name)
- [x] 1.4 Add `readAuthorStats(callback)` export that reads and returns the `authors` map from daily storage (empty object if date differs)

## 2. Wire author tracking into feed.js collapse points

- [x] 2.1 Import `trackAuthorBlocked` in `src/features/feed.js`
- [x] 2.2 Call `trackAuthorBlocked(vanityName, author)` in the pattern-match banner construction path (where `trackSlopCollapsed` is called)
- [x] 2.3 Call `trackAuthorBlocked(vanityName, author)` in the semantic-match banner construction path (where `trackPostFiltered` is called via `countOnce`)
- [x] 2.4 Call `trackAuthorBlocked(vanityName, author)` in the topic/keyword filter path (where posts are hidden without a banner)

## 3. Add renderAuthorTally to stats-renderer.js

- [x] 3.1 Add `renderAuthorTally(authorStats, containerEl)` export that renders a sorted list (descending count, capped at 20) with author name and count per row, and an empty-state message when authorStats is empty

## 4. Add "Blocked" tab to the popup

- [x] 4.1 Add a third `<button>` (`id="tab-blocked"`) to the `#tab-bar` in `src/popup/popup.html`
- [x] 4.2 Add a corresponding `<div id="blocked-panel">` panel with a container element for the tally list
- [x] 4.3 Wire `tab-blocked` into the tab-switching logic in `src/popup/popup.js` (follow the same pattern as `tab-filters` and `tab-authors`)
- [x] 4.4 On popup load, call `readAuthorStats` and pass the result to `renderAuthorTally` targeting `#blocked-panel`'s container

## 5. Tests and coverage

- [x] 5.1 Add unit tests for `trackAuthorBlocked` and `applyDelta` author merging in the stats module tests
- [x] 5.2 Add unit tests for `renderAuthorTally` (sorted order, cap at 20, empty state)
- [x] 5.3 Add boundary tests for the `author-block-stats` spec scenarios
- [x] 5.4 Run `npm test && npm run coverage` and confirm both pass
