## Why

The hide-promoted-posts feature (commit b8eb779) hides posts silently but counts nothing: the popup's Filtered counter stays at 0, the Blocked tab never shows promoted-post authors, and the `isPromotedPost` detector always returns false for image-only or video ads (which have no `expandable-text-box` testid), leaving a large class of LinkedIn ads unhidden. Additionally, `stats-renderer.js` interpolates author display names and signal strings directly into `innerHTML` template literals without HTML-escaping, creating a stored XSS path from LinkedIn page content into the extension popup.

## What Changes

- **Stats**: The promoted-post branch SHALL call `countOnce(post, trackPostFiltered)` and `trackAuthorBlocked()` so promoted hides appear in the daily damage report and the Blocked tab, consistent with the keyword and slop paths.
- **DOM detection**: `isPromotedPost` SHALL detect the "Promoted" label without requiring `expandable-text-box` to be present. When `textBox` is `null` the current guard short-circuits the entire loop to `false`; the fix widens detection to any `<p>` or `<span>` whose trimmed text equals `"Promoted"` that is not inside the post's main text body.
- **Popup XSS**: `stats-renderer.js` SHALL HTML-escape all dynamic string values (`name`, `signal`) before injecting them into `innerHTML` template literals. Both template literals in the file are affected.
- **Whitelist**: The whitelist bypass for promoted posts is addressed in the companion change `fix-whitelist-bypass-promoted-keyword` and is not duplicated here.

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `hide-promoted-posts`: Add requirements for stats tracking and robust DOM detection (posts without `expandable-text-box` must still be detected).
- `author-block-stats`: Add a scenario for promoted-post blocking and a requirement that author names are HTML-escaped when rendered in the popup.

## Impact

- **`src/features/feed.js`** — `isPromotedPost`: widen detection logic; `applyKeywordToPost` promoted branch: add `countOnce` + `trackAuthorBlocked` calls.
- **`src/stats-renderer.js`** — HTML-escape `name` and `signal` before innerHTML insertion; introduce a local `escapeHtml` helper.
- **`openspec/specs/hide-promoted-posts/spec.md`** — two new requirements (stats, robust detection).
- **`openspec/specs/author-block-stats/spec.md`** — new scenario (promoted-post blocking) and new requirement (HTML-escaped rendering).
- No new storage keys, no API changes, no dependency changes.
