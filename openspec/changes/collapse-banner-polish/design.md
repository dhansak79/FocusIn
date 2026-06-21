## Context

Collapse banners (`.focusedin-slop-collapsed`) use a dark red theme (`#dc2626` border, near-black background). The banner renders as a flex column. Currently:

- `.focusedin-slop-reveal-btn` ("Show anyway") uses `align-self: flex-start`, so it shrinks to content width instead of spanning the banner.
- `.focusedin-unfollow-btn` and `.focusedin-whitelist-btn` have no CSS at all — they render as plain browser-default buttons, which looks inconsistent with the styled banner.
- The "Whitelist" label is jargon; "Trust author" communicates the action directly.

## Goals / Non-Goals

**Goals:**
- Rename button label "Whitelist" → "Trust author" and confirmation "Whitelisted ✓" → "Trusted ✓"
- Style Unfollow and Trust author buttons to match the dark red banner theme
- Group Unfollow + Trust author side-by-side in a flex row for compact layout
- Make "Show anyway" full-width below the action row

**Non-Goals:**
- Redesigning the banner layout or colour scheme (red theme stays)
- Adding tooltips or help text to the buttons
- Changing button behaviour (only labels and styles change)

## Decisions

**CSS class rename: `focusedin-whitelist-btn` → `focusedin-trust-btn`**
Keeps the class name aligned with the new label and prevents future confusion. Both the JS and CSS must be updated together. Test assertions referencing the old class name also update.

**Wrapper div for action buttons: `focusedin-banner-actions`**
Wrapping Unfollow and Trust author in a `<div class="focusedin-banner-actions">` (flex row, gap 6px) lets them sit side by side without requiring per-button width rules. Show anyway stays outside the wrapper, below.

**Unfollow button style: muted red**
Destructive in nature and consistent with the banner's red theme. Use a faint red border (`rgba(220,38,38,0.45)`) and red-tinted text (`#ff9a9a`) — same palette as the banner border, clearly danger-coded but not as heavy as a filled red button.

**Trust author button style: neutral/teal**
A positive action. Use a muted teal border (`rgba(0,180,150,0.5)`) and soft teal text (`#7eddd4`) to signal a safe/trust action without competing with the red banner theme.

**Show anyway: `align-self: stretch`**
One-line CSS fix. `align-self: stretch` on a flex-column child makes the button span the full width without changing its padding or layout model.

## Risks / Trade-offs

- [Class rename breaks tests] → Update test selectors from `.focusedin-whitelist-btn` to `.focusedin-trust-btn` in the same PR. Not a user-facing break.
- [Side-by-side buttons too narrow on small viewports] → `flex-wrap: wrap` on the action row lets buttons wrap to a second line if needed. Risk is low given LinkedIn's minimum post width.
- [Teal on dark red banner feels off-brand] → The teal (`#00d1b2`) is already the extension's accent colour (used throughout the popup), so it reads as "FocusIn green-light" rather than a random colour.
