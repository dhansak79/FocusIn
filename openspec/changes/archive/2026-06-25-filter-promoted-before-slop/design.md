## Context

`applyKeywordToPost` in `src/features/feed.js` is the single processing function that runs on every feed post. It currently checks for promoted status only when `hidePromoted` is `true`. If the toggle is off, promoted posts flow into slop detection, keyword matching, and async semantic/tone checks. Even with the toggle on, async semantic callbacks (slop-archetype, tone) can fire on a promoted post if the initial sync processing didn't guard against it, potentially adding a soft-hide banner with a "Show anyway" button that bypasses the hard-hide.

The fix is a one-line re-ordering: hoist `isPromotedPost(post)` out of the `hidePromoted` gate so it is always evaluated first, and always causes an early return.

## Goals / Non-Goals

**Goals:**
- Promoted posts never enter the slop, keyword, semantic, or tone pipelines, regardless of the `hide-promoted` toggle state.
- When `hide-promoted` is on, promoted posts continue to be hard-hidden (no behaviour change).
- When `hide-promoted` is off, promoted posts are skipped silently — no banner, no soft-hide, no async checks.

**Non-Goals:**
- No changes to `isPromotedPost` detection logic.
- No UI, storage, or popup changes.
- No changes to slop detection or semantic filter logic.
- Not addressing potential false-negatives in `isPromotedPost` (a separate concern).

## Decisions

**Decouple promoted detection from the hide-promoted toggle**

Current code:
```js
if (hidePromoted && isPromotedPost(post)) {
  hidePost(post, mode)
  countOnce(post, trackPostFiltered)
  trackAuthorBlocked(vanity, name)
  return
}
```

Proposed:
```js
if (isPromotedPost(post)) {
  if (hidePromoted) {
    hidePost(post, mode)
    countOnce(post, trackPostFiltered)
    trackAuthorBlocked(vanity, name)
  }
  return   // always exit — promoted posts never enter slop/keyword/semantic
}
```

Alternative considered: add `isPromotedPost` guard inside `checkSlop` and inside each async callback. Rejected — defensive patches in every downstream path are fragile. A single early return at the top of `applyKeywordToPost` is the canonical fix.

## Risks / Trade-offs

- [Risk] A promoted post that is also keyword-matching will no longer be keyword-hidden (it exits early). → Acceptable: the user already chose not to hide promoted posts; keyword or slop mislabelling them was the bug, not a feature.
- [Risk] Stats undercounting if a promoted post would have matched keywords. → Acceptable: the promoted filter stats path is unchanged when `hidePromoted` is on; when off, we deliberately skip it.

## Open Questions

- None. The fix is contained to a single conditional rearrangement.
