## Why

Promoted posts can currently be soft-hidden by slop detection and then revealed via "Show anyway", bypassing the promoted-post filter. Promoted posts are a distinct ad category and should never be classified as slop — the two filters must not overlap.

## What Changes

- The promoted-post check in `applyKeywordToPost` will run unconditionally (not gated on `hidePromoted`), so promoted posts always exit the processing pipeline before slop detection, keyword matching, or async semantic checks run.
- When `hide-promoted` is enabled: promoted posts continue to be hard-hidden (no change).
- When `hide-promoted` is disabled: promoted posts are returned immediately without any filtering — they will not receive a slop banner, cannot be "shown anyway", and are not eligible for tone or semantic filtering.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `hide-promoted-posts`: Add a requirement that promoted posts are excluded from all other filters (slop, keyword, semantic, tone) regardless of the `hide-promoted` toggle state.

## Impact

- `src/features/feed.js` — `applyKeywordToPost` function: promote the `isPromotedPost` check to run before all other filters, with early return in both branches.
- `tests/features/` or `tests/index.dom.test.js` — new test scenarios covering the interaction between promoted detection and slop detection.
- No API, storage key, or UI changes required.
