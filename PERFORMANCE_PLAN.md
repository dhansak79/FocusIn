# Performance Improvement Plan

Refactor the core post-interception approach for a snappier, lower-CPU experience.
Each item is its own branch and PR, tackled in order.

---

## ~~1. Replace `setInterval` with `MutationObserver` in `feed.js`~~ ✅ Done

**Branch**: `perf/mutation-observer-feed` — merged 2026-06-13

**Result**: Noticeable real-world performance improvement confirmed by manual testing. Posts are
processed reactively as LinkedIn appends them; zero CPU usage when the feed is idle.

---

## ~~2. Replace `outerHTML` with `textContent` for keyword matching~~ ✅ Done

**Branch**: `perf/textcontent-keyword-match` — merged 2026-06-13

**Result**: `post.textContent` (pre-computed by the browser, O(1)) replaces `post.outerHTML`
(5–15 KB serialisation per check) in `feed.js` and `post.innerHTML` in `jobs.js`. Note: used
`textContent` rather than `extractPostText` since interaction/age keywords appear in post
metadata outside the expandable text box.

---

## 3. Remove the `resetBlockedPosts` polling timer

**Branch**: `perf/remove-reset-timer`

**Problem**: `if (runs % 10 === 0) resetBlockedPosts()` strips state from every post every
~3.5 seconds as a defensive measure against LinkedIn mutating posts in-place. After the
MutationObserver refactor (item 1), this is no longer needed — the observer handles new/replaced
nodes automatically.

**Change**:
- Remove the `runs` counter and the `% 10` reset in both `feed.js` and `jobs.js`.
- If LinkedIn does replace a post node in-place (rather than removing + re-inserting it), handle
  that with a separate `subtree: true, attributes: false, characterData: false, childList: true`
  observer rather than periodic full resets.
- Keep `resetBlockedPosts` as a utility for the "toggle off" cleanup path, but don't call it on
  a timer.

**Files**: `src/features/feed.js`, `src/features/jobs.js`

**Depends on**: ~~Item 1~~ ✅ complete

---

## 4. Replace `waitForSelector` rAF loop with `MutationObserver`

**Branch**: `perf/wait-for-selector-observer`

**Problem**: `waitForSelector` uses `requestAnimationFrame` to poll for an element — up to 60
checks per second until it appears. For elements that take seconds to render (sort dropdown,
recent option), this wastes up to ~120 frames.

**Change**:
- Rewrite `waitForSelector` in `utils.js` to use a `MutationObserver` on `document.body`
  (`subtree: true, childList: true`).
- Check for the element once immediately; if not present, set up the observer and resolve as
  soon as the node appears, then disconnect.
- Keep the same `async`/`Promise` API so all callers (`handleSortByRecent` etc.) are unchanged.
- Add a timeout (e.g. 5 s) that resolves with `null` to match current behaviour.

**Files**: `src/utils.js`

---

## 5. Replace URL polling with the Navigation API

**Branch**: `perf/navigation-api-url-detection`

**Problem**: `index.js` polls `window.location.href` every 500ms to detect LinkedIn SPA
navigation. The Navigation API (`navigation.addEventListener('navigate', ...)`) has been
available in Chrome since v102 and fires synchronously on every pushState/replaceState —
no polling needed.

**Change**:
- In `index.js`, replace the 500ms `setInterval` URL check with a `navigation.navigate` event
  listener.
- Keep the `visibilitychange` and `pagehide` cleanup hooks — they still make sense.
- Add a feature-detect guard: `if ('navigation' in window)` use the API, else fall back to the
  existing interval (for any edge cases or older Chrome versions).
- The interval can be set to 2 000ms in the fallback path since it's now genuinely a fallback.

**Files**: `src/index.js`

---

## 6. Rework `autoScrollFeed` to be reactive rather than unconditional

**Branch**: `perf/reactive-auto-scroll`

**Problem**: On every page visit, `autoScrollFeed` fires 10 full-viewport `scrollBy` calls at
400ms intervals regardless of how many posts are already loaded. This causes 4 seconds of forced
jank on every feed visit.

**Change**:
- Remove the unconditional `autoScrollFeed` call from `handleFilterFeed`.
- Instead, after the MutationObserver is set up, observe how many posts have been processed. If
  after 1 second fewer than `MIN_POST_COUNT` posts have been seen, trigger a single smooth scroll
  to prompt LinkedIn to load more.
- Use `window.scrollBy({ top: window.innerHeight, behavior: 'smooth' })` for a less jarring
  scroll, and only repeat if the post count is still low after another second.
- Remove the `lastAutoScrolledUrl` guard (it becomes unnecessary).

**Files**: `src/features/feed.js`

**Depends on**: ~~Item 1~~ ✅ complete

---

## Order of execution

```
1 ✅ MutationObserver feed          (foundational — unlocks 3 and 6)
2 ✅ textContent keyword match      (independent)
3 → remove reset timer             (after 1 ✅)
4 → waitForSelector observer       (independent)
5 → Navigation API URL detection   (independent)
6 → reactive auto-scroll           (after 1 ✅)
```
