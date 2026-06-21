## 1. Rename Whitelist → Trust author in feed.js

- [x] 1.1 In `makeWhitelistButton` in `src/features/feed.js`: change button text from `'Whitelist'` to `'Trust author'` and confirmation from `'Whitelisted ✓'` to `'Trusted ✓'`
- [x] 1.2 Rename the CSS class from `focusedin-whitelist-btn` to `focusedin-trust-btn` on the button element in `makeWhitelistButton`
- [x] 1.3 Wrap the Unfollow and Trust author buttons in a `<div class="focusedin-banner-actions">` in both `addRevealBanner` and `buildSemanticCollapseBanner`

## 2. CSS — button styles and Show anyway width

- [x] 2.1 In `src/content/content.css`: change `.focusedin-slop-reveal-btn` from `align-self: flex-start` to `align-self: stretch` to make Show anyway full-width
- [x] 2.2 Add `.focusedin-banner-actions` styles: `display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px`
- [x] 2.3 Add `.focusedin-unfollow-btn` styles: muted red border (`rgba(220,38,38,0.45)`), red-tinted text (`#ff9a9a`), transparent background, matching border-radius and font-size as the reveal button
- [x] 2.4 Add `.focusedin-trust-btn` styles: muted teal border (`rgba(0,180,150,0.5)`), soft teal text (`#7eddd4`), transparent background, same base style as unfollow button
- [x] 2.5 Add hover states for `.focusedin-unfollow-btn:hover` (strengthen red) and `.focusedin-trust-btn:hover` (strengthen teal)
- [x] 2.6 Remove the `margin-top: 6px` from `.focusedin-slop-reveal-btn` (it moves to the wrapper) and adjust spacing so Show anyway sits below the action row with appropriate gap

## 3. Tests

- [ ] 3.1 Update all test assertions in `tests/features/slop.dom.test.js` that reference `.focusedin-whitelist-btn` → `.focusedin-trust-btn`
- [x] 3.2 Update test assertions that check button text `'Whitelist'` → `'Trust author'` and `'Whitelisted ✓'` → `'Trusted ✓'`
- [x] 3.3 Add a test for the action wrapper: verify `.focusedin-banner-actions` is present and contains both the Unfollow and Trust author buttons

## 4. Quality gates

- [x] 4.1 Run `npm test && npm run coverage` — both must exit 0
- [x] 4.2 Run `pre_commit_code_health_safeguard` — resolve any regressions before committing
