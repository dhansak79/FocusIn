## Context

LinkedIn's reaction picker is a `ul` element that appears in the feed DOM when the user hovers over the "Like" button on a post. Each reaction item is a `li > button`. The picker is transient — it is inserted and removed from the DOM dynamically. FocusIn already has a `MutationObserver` on the feed for post filtering; the same pattern can detect the picker opening.

Manual "AI Slop" reactions need a **separate, persistent store** from the existing daily stats. The daily `focusin-stats` key resets every midnight and is driven by auto-detection. The Hall of Shame must never reset — it accumulates all-time manual reactions per author.

## Goals / Non-Goals

**Goals:**
- Inject an "AI Slop 🤖" button into LinkedIn's reaction picker whenever it appears in the feed.
- Clicking the button hard-hides the post, increments the daily `slopCollapsed` counter, and writes to a permanent per-author Hall of Shame store.
- A new "Hall of Shame" popup tab surfaces the all-time tally, ranked by count.
- The injected button is removed when the picker closes naturally (no DOM leaks).
- Works regardless of whether the auto slop detector is enabled.

**Non-Goals:**
- Not sending any data to LinkedIn (local-only; does NOT fire LinkedIn's reaction API).
- Not showing a "Show anyway" banner — the action is intentional, so the post is hard-hidden.
- Not affecting the existing daily Blocked tab or `authors` map.
- Not affecting non-feed contexts (articles, notifications, etc.).

## Decisions

**New module: `src/features/slop-reaction.js`**

Keeps reaction-picker injection separate from feed filtering. Exports a single `initSlopReaction(feedContainer)` that attaches a `MutationObserver` to `feedContainer`. When the observer sees a node matching the reaction-picker selector appear, it calls `injectButton(pickerNode, postEl)`.

Alternative considered: inline in `feed.js`. Rejected — `feed.js` is already large, and the reaction picker is a UI concern independent of the filter pipeline.

**Picker detection selector**

LinkedIn's reaction picker is identified by `[class*="reactions-menu"]`. Each reaction item is a `li` inside it. We insert our `li > button` as the last item. If LinkedIn renames the class, the feature silently does nothing (graceful degradation) rather than throwing.

**Tracing picker → post element**

From the picker node, walk up with `closest('[data-lazy-mount-id]')` or `closest('[role="listitem"]')` — the same selectors used in `isPostNode`. If no post ancestor is found, the injection is skipped.

**Author extraction**

Reuse the exported `extractAuthorVanityName` and `extractAuthorName` helpers already in `feed.js` (they will be exported for this purpose).

**Post hiding**

Add the `hide` class (same as keyword/promoted filter) via the already-exported `hidePost` from `utils.js`. No soft-hide banner is needed since the action is intentional.

**Storage: separate all-time key**

```
chrome.storage.local key: 'focusin-slop-reactions'
Shape: { [vanityOrName]: { name: string, count: number } }
```

Never reset. Written by a new `trackManualSlopReaction(vanity, name)` function in `stats.js`. Read by a new `readHallOfShame(callback)` function. The existing daily `trackAuthorBlocked` is NOT called from the reaction click handler — manual reactions are fully decoupled from daily stats.

The daily `trackSlopCollapsed(['manual'])` IS called so the Filters tab damage report reflects the collapse.

**Hall of Shame popup tab**

New fourth tab labelled "Hall of Shame" in the popup. Reads `focusin-slop-reactions` directly. Ranked by count descending, no cap (unlike the daily Blocked tab which is capped at 20 — the all-time list may grow longer but the user curated it intentionally). Empty state: *"No authors in the Hall of Shame yet — use the 🤖 button in the reaction picker to flag them."*

**Activation**

`initSlopReaction` is called from `feed.js`'s `connectObserver`, passing the same `feedContainer`. It shares the observer lifecycle — when the feed observer disconnects, the reaction observer also disconnects.

## Risks / Trade-offs

- [Risk] LinkedIn changes the reaction picker class name or structure → The injection silently does nothing; existing features are unaffected. A follow-up CSS/selector update would re-enable it.
- [Risk] Picker appears before `connectObserver` fires → The MutationObserver on `feedContainer` may miss pickers that open before it attaches. Mitigation: check for an already-open picker on `connectObserver` start.
- [Risk] User clicks "AI Slop" on a post they did not mean to flag → No undo in v1. The Hall of Shame persists indefinitely, but counts are small and the user chose to flag the post.
- [Risk] CSS conflict with LinkedIn styles on the injected `li` → Scope injected elements with `focusedin-` prefixed classes (matching existing convention).

## Open Questions

- None. Storage approach, tab name ("Hall of Shame"), and daily-stat behaviour are all decided.
