## Why

LinkedIn's feed mixes organic posts with promoted (sponsored) ads, and there is currently no way for FocusIn users to automatically remove them. Promoted posts are identifiable in the DOM by a `<span>Promoted</span>` label and a distinct post structure, making them straightforward to detect and hide without ML inference.

## What Changes

- Add a **"Hide promoted posts"** toggle switch to the popup UI under a new "Ads" section in the Filters tab.
- Add promoted-post detection logic to the content-script feed processor: when the toggle is on, any feed post whose DOM contains the `Promoted` label is hidden immediately.
- Persist the toggle state in `chrome.storage.local` under the key `hide-promoted`.
- Pass the `hide-promoted` config value through `applyFeed` → `blockPosts` so the live filter respects it without a page reload.

## Capabilities

### New Capabilities
- `hide-promoted-posts`: Toggle in popup UI + content-script detection that hides LinkedIn promoted/sponsored feed posts when enabled.

### Modified Capabilities
- (none — no existing spec-level requirements are changing)

## Impact

- `src/popup/popup.html` — new toggle field in the Filters tab
- `src/popup/popup.js` — no code change needed; the generic `.switch` listener and `chrome.storage.local.get` already handle any new checkbox with a matching `id`
- `src/features/feed.js` — `blockPosts` receives and acts on a new `hidePromoted` boolean parameter; detection uses a lightweight DOM text check, no model download
- `src/index.js` — no change; config is passed through unchanged
- No new dependencies
