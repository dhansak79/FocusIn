## Why

The collapse banners have three action buttons — Trust author (was "Whitelist"), Unfollow, and "Show anyway" — but the button styling undermines clarity: the action buttons lack visual hierarchy, colours don't match the extension's dark theme, and "Show anyway" sits at an arbitrary width instead of spanning the banner. The "Whitelist" label is also jargon that doesn't communicate intent without prior knowledge of the feature.

## What Changes

- Rename the banner Whitelist button to **"Trust author"** (confirmation text: "Trusted ✓") so the action is self-evident without knowing the feature
- Polish the action button colours on collapse banners to use the established teal/dark palette and provide clearer visual hierarchy
- Make the "Show anyway" button full-width so it reads as the primary escape action and fills the banner consistently

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `banner-author-display`: Whitelist button label changes to "Trust author" / "Trusted ✓"; button colour and layout requirements updated

## Impact

- `src/features/feed.js` — button label strings and CSS class names for Trust author button
- `src/content/focusedin.css` (or equivalent) — button colour and layout rules for banner action buttons
- `tests/features/slop.dom.test.js` — update assertions that check for "Whitelist" label / `.focusedin-whitelist-btn` class
