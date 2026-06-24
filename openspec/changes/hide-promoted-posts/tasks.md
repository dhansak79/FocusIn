## 1. Popup UI

- [x] 1.1 Add an "Ads" `<div class="divider">` section and a `hide-promoted` checkbox toggle to `src/popup/popup.html` (above the "AI content" divider)

## 2. Content Script — Feed Processor

- [x] 2.1 Add a `hidePromoted` boolean parameter to `blockPosts()` in `src/features/feed.js`
- [x] 2.2 Implement `isPromotedPost(post)` helper: returns `true` if the post contains a `<p>` or `<span>` whose trimmed `textContent === 'Promoted'` and which appears before `[data-testid="expandable-text-box"]`
- [x] 2.3 In `applyKeywordToPost`, call `hidePost(post, 'hide')` (and return early) when `hidePromoted && isPromotedPost(post)` is true
- [x] 2.4 Update `handleFilterFeed` to read `config['hide-promoted']` and pass it into `blockPosts`
- [x] 2.5 Update the `connectObserver` guard condition to also start the observer when `hidePromoted` is true

## 3. Tests

- [x] 3.1 Add unit tests for `isPromotedPost`: true for a post with a standalone `<span>Promoted</span>` before the text box, false for a post with "Promoted" only in the body text, false for a plain non-promoted post
- [x] 3.2 Add an integration/boundary test confirming a promoted post is hidden when `hide-promoted` is `true` and passes through unmodified when it is `false`
- [x] 3.3 Run `npm test && npm run coverage` and confirm all tests pass

## 4. Manual Smoke Test

- [ ] 4.1 Load the extension in a Chrome dev profile on `linkedin.com/feed`, enable "Hide promoted posts", and confirm promoted posts disappear
- [ ] 4.2 Disable the toggle and confirm promoted posts reappear (feed resets)
