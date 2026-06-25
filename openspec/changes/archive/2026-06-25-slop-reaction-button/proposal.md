## Why

Slop detection catches most AI-generated posts automatically, but users sometimes encounter slop that slipped through. A manual "AI Slop" reaction button — injected into LinkedIn's existing reaction picker — gives users a one-click way to flag a post, building a permanent per-author tally that persists across sessions and is surfaced in a dedicated "Hall of Shame" tab in the popup.

## What Changes

- A new content-script module detects when LinkedIn's native reaction picker opens (MutationObserver on the feed) and injects an "AI Slop 🤖" button as the last item in the picker.
- Clicking the button hard-hides the post, increments the daily `slopCollapsed` counter (so the Filters tab damage report stays accurate), and writes an all-time per-author count to a new dedicated storage key.
- A new "Hall of Shame" tab in the popup displays the all-time per-author tally, ranked by count, persisting indefinitely (never resets).
- The injected button is styled to match LinkedIn's picker (circular, orange background, robot emoji) and is removed when the picker closes, leaving no trace in the DOM.

## Capabilities

### New Capabilities
- `slop-reaction-button`: Inject an "AI Slop" button into LinkedIn's reaction picker; clicking it collapses the post, records the event in the daily slop count, and increments the author's all-time Hall of Shame tally.

### Modified Capabilities
<!-- none — daily author-block-stats are not affected by manual reactions -->

## Impact

- `src/features/slop-reaction.js` (new) — MutationObserver watching the picker; click handler; reuses `hidePost` from `utils.js`.
- `src/stats.js` — new `trackManualSlopReaction(vanity, name)` function and `readHallOfShame(callback)` reader writing to a new `focusin-slop-reactions` storage key (all-time, never resets).
- `src/popup/popup.js` and popup HTML — new "Hall of Shame" tab reading from `focusin-slop-reactions`.
- New CSS for the injected button.
- No changes to existing daily stats storage or the Blocked tab.
