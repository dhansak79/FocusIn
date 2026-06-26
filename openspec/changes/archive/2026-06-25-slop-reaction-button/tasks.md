## 1. Module Setup

- [x] 1.1 Create `src/features/slop-reaction.js` — export `initSlopReaction(feedContainer)` that attaches a `MutationObserver` watching for new posts with a reaction bar.
- [x] 1.2 Export `extractAuthorVanityName` and `extractAuthorName` from `src/features/feed.js` (currently unexported) so `slop-reaction.js` can reuse them.

## 2. Button Injection into Post Action Bar

- [x] 2.1 In `initSlopReaction`, observe `feedContainer` subtree for added nodes containing `button[aria-label="Open reactions menu"]`. When found, call `injectIntoPost`.
- [x] 2.2 Implement `injectIntoPost(reactionsBtn, getVanity, getName)`: find post ancestor via `findPostAncestor`, guard against double-injection (`dataset.focusinSlopInjected`), create a `<button>` with 🤖 textContent and `focusedin-slop-reaction-btn` class, insert after `reactionsBtn.parentElement`.
- [x] 2.3 Trace reactions button → post element using the same `findPostAncestor` traversal (`[role="listitem"]`, `[data-lazy-mount-id]` parent check, etc.); skip injection if no post ancestor found.
- [x] 2.4 Also scan already-present reaction buttons via `feedContainer.querySelectorAll` on `initSlopReaction` startup (synchronous injection for posts already in the DOM).

## 3. Click Handler

- [x] 3.1 On button click: add the `hide` class via `hidePost(post, 'hide')`.
- [x] 3.2 On button click: call `trackSlopCollapsed(['manual'])` (daily counter) and `trackManualSlopReaction(vanity, name)` (all-time Hall of Shame). Do NOT call `trackAuthorBlocked`.
- [x] 3.3 On button click: prevent default and stop propagation.

## 4. Stats — Hall of Shame Storage

- [x] 4.1 Add `trackManualSlopReaction(vanity, name)` to `src/stats.js` — writes to `focusin-slop-reactions` in `chrome.storage.local` (all-time, never reset). Uses same debounced flush pattern as existing stat functions.
- [x] 4.2 Add `readHallOfShame(callback)` to `src/stats.js` — reads `focusin-slop-reactions` and returns the map (or empty object if not set).

## 5. Popup — Hall of Shame Tab

- [x] 5.1 Add "Hall of Shame" tab button and panel to the popup HTML alongside Filters / Authors / Blocked.
- [x] 5.2 Wire up the tab in `src/popup/popup.js` — add `tabHallOfShame` / `hallOfShamePanel` to the `switchTab` logic.
- [x] 5.3 On popup load, call `readHallOfShame` and render ranked author list (name + count) into the Hall of Shame panel; render the empty-state message when the map is empty.

## 6. Styling

- [x] 6.1 Add CSS for `.focusedin-slop-reaction-btn` to the extension stylesheet — slim inline button styled to sit in the action bar (transparent background, orange hover tint, 🤖 emoji text).

## 7. Integration

- [x] 7.1 Call `initSlopReaction(feedContainer, extractAuthorVanityName, extractAuthorName)` from `connectObserver` in `feed.js`, after the feed observer is attached.
- [x] 7.2 Disconnect the slop-reaction observer in `disconnectObserver` alongside the feed observer.

## 8. Tests

- [x] 8.1 Add test: button appears when post with reaction bar is in the feed (synchronous initial scan).
- [x] 8.2 Add test: double-injection guard — calling `initSlopReaction` twice results in only one button per post.
- [x] 8.3 Add test: clicking the button hides the associated post (`hide` class added).
- [x] 8.4 Add test: clicking the button calls `trackSlopCollapsed` with `['manual']`.
- [x] 8.5 Add test: clicking the button calls `trackManualSlopReaction` with vanity and name.
- [x] 8.6 Add test: clicking the button does NOT call `trackAuthorBlocked`.
- [x] 8.7 Add test: post with no reaction bar gets no button injected.
- [x] 8.8 Add test: `trackManualSlopReaction` writes to `focusin-slop-reactions`, not `focusin-stats`.
- [x] 8.9 Add test: `readHallOfShame` returns accumulated counts across multiple calls.
- [x] 8.10 Add test: Hall of Shame panel renders author list ranked by count descending.
- [x] 8.11 Add test: Hall of Shame panel shows empty-state message when no authors flagged.

## 9. Verification

- [x] 9.1 Run `npm test` — all tests pass (678/678).
- [x] 9.2 Run `npm run coverage` — patch coverage clean, no regressions.
