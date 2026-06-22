## Context

The popup currently shows a "damage report" (total AI-flagged and posts filtered today) and two tabs: Filters and Authors. There is no per-author breakdown. The stats module (`src/stats.js`) tracks daily aggregates flushed to `chrome.storage.local` in a batched pattern. Author identity (vanity name + display name) is already extracted in `src/features/feed.js` at every collapse/filter point.

## Goals / Non-Goals

**Goals:**
- Track how many posts were blocked per author each day
- Add a "Blocked" tab to the popup displaying a ranked author list (most blocked first)
- Reuse the existing daily-reset and batched-flush storage pattern

**Non-Goals:**
- Persistent history across days (tallies reset with the damage report)
- Action buttons (Unfollow/Whitelist) in the Blocked tab — those live on banners
- Tracking authors whose posts pass all filters

## Decisions

### 1. Extend existing daily stats object rather than a separate storage key

Store per-author counts inside the same object at `focusin-stats` under an `authors` sub-map (`{ [vanityName]: { name, count } }`). This means author tallies reset together with the global counts for free, and there is only one storage read/write path to maintain.

Alternative considered: a separate `focusin-author-stats` key with its own date guard. Rejected because it duplicates the reset logic and adds a second storage read in the popup.

### 2. Key by vanity name, store latest display name

LinkedIn vanity names are stable identifiers; display names can vary (e.g. name changes, trailing credentials). Keying by vanity gives consistent identity. We store the most-recently-seen display name as a fallback for rendering when vanity is unavailable or for display purposes.

When vanity name cannot be extracted (returns null), fall back to keying by display name. Posts where both are null are not tallied (rare edge case, not worth silent key collisions).

### 3. Same batched-flush pattern as existing stats

`trackAuthorBlocked(vanityName, displayName)` accumulates into the same `pending` object that `flush()` already writes. No new timer or storage write path needed.

### 4. New "Blocked" tab rendered from popup.js

The popup already handles a two-tab UI. A third tab button and panel follow the same pattern. `renderAuthorTally` in `stats-renderer.js` takes the `authors` map and a container element and renders a sorted list, matching the style of the existing signals list.

## Risks / Trade-offs

- **Vanity name extraction may fail on some post layouts** → Mitigation: fall back to display name as key; if both null, skip tallying silently. Count is best-effort, not critical.
- **Storage bloat if many distinct authors blocked in one day** → Mitigation: cap rendered list at 20 entries in the popup; storage object is bounded by daily reset.
- **feed.js call sites must be kept in sync** → Mitigation: `trackAuthorBlocked` is a no-op when both args are null/undefined, so it is safe to call speculatively at every collapse point.
