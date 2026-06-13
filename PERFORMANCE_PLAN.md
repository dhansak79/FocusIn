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

## ~~3. Remove the `resetBlockedPosts` polling timer~~ ✅ Done

**Branch**: `perf/remove-reset-timer` — merged 2026-06-13

**Result**: `runs` counter and `% 10` reset removed from `jobs.js` (feed.js was already clean
from item 1). `resetJobs` / `resetBlockedPosts` are kept for toggle-off and keyword-change
cleanup only.

---

## ~~4. Replace `waitForSelector` rAF loop with `MutationObserver`~~ ✅ Done

**Branch**: `perf/wait-for-selector-observer` — merged 2026-06-13

**Result**: rAF polling loop replaced with a MutationObserver that resolves immediately on the
first matching mutation, then disconnects. 5 s timeout prevents hangs. `checkElementAndPlaceholderBySelector` removed; replaced by the leaner `isReady` predicate.

---

## ~~5. Replace URL polling with the Navigation API~~ ✅ Done

**Branch**: `perf/navigation-api-url-detection` — merged 2026-06-13

**Result**: 500ms `setInterval` replaced with `window.navigation.addEventListener('navigate')`
which fires synchronously on every SPA navigation with zero idle CPU cost. `handleNavigation`
also called on load so the current page initialises immediately. Fallback interval kept at
2000ms behind a `typeof` guard. `src/index.js` added to vitest coverage scope with 18 tests.

---

## ~~6. Rework `autoScrollFeed` to be reactive rather than unconditional~~ ✅ Done

**Branch**: `perf/reactive-auto-scroll` — merged 2026-06-13

**Result**: Removed the 10×scrollBy loop (4s of forced jank on every feed visit). Replaced with
a lazy check: if fewer than `MIN_POST_COUNT` posts are seen 1s after the observer connects, one
smooth scroll nudges LinkedIn to load more. A second attempt fires after another 1s if posts are
still absent; stops after 2 attempts. `lastAutoScrolledUrl` guard and `autoScrollFeed` removed
entirely. `disconnectObserver` cancels any pending scroll timer.

---

## Order of execution

```
1 ✅ MutationObserver feed          (foundational — unlocks 3 and 6)
2 ✅ textContent keyword match      (independent)
3 ✅ remove reset timer             (after 1 ✅)
4 ✅ waitForSelector observer       (independent)
5 ✅ Navigation API URL detection   (independent)
6 ✅ reactive auto-scroll           (after 1 ✅)
```
