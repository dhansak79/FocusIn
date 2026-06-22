## Why

Users have no visibility into which authors are generating the most filtered content — knowing this makes it easier to decide who to unfollow or whitelist. A per-author tally turns the existing "damage report" into actionable data.

## What Changes

- Track blocked-post counts per author (by vanity name + display name) in chrome.storage alongside existing daily stats
- Add a new "Blocked" tab to the popup's tab bar, between or after "Authors"
- Render a ranked list of authors by blocked-post count in the new tab, showing display name and tally
- Flush per-author tallies using the same batched-write pattern as the existing stats module

## Capabilities

### New Capabilities
- `author-block-stats`: Track and display a per-author tally of blocked posts in a dedicated popup tab, ranked by block count, resetting daily with the rest of the damage report

### Modified Capabilities
- `banner-author-display`: Author identity (vanity + display name) already surfaces in banners; the blocking event now also writes to the per-author tally storage

## Impact

- `src/stats.js`: Add `trackAuthorBlocked(vanityName, displayName)` and `readAuthorStats(callback)` exports; extend the daily storage object with an `authors` map
- `src/features/feed.js`: Call `trackAuthorBlocked` at each collapse/filter point that already extracts author identity
- `src/popup/popup.html`: Add a third tab button and panel for "Blocked"
- `src/popup/popup.js`: Wire up tab switching and render the ranked author list
- `src/stats-renderer.js`: Add `renderAuthorTally(authorStats, containerEl)` helper
