## MODIFIED Requirements

### Requirement: Trust author button appears on banners alongside Unfollow
Collapse banners SHALL display a "Trust author" button when the author's vanity name is extractable, placed after the Unfollow button and before "Show anyway".

#### Scenario: Trust author button present when vanity name available
- **WHEN** a post is collapsed into a banner
- **AND** the post DOM contains an extractable author vanity name
- **THEN** the banner displays a "Trust author" button after the Unfollow button

#### Scenario: Trust author button absent when vanity name unavailable
- **WHEN** a post is collapsed into a banner
- **AND** the post DOM does not contain an extractable vanity name
- **THEN** the banner renders without a Trust author button

### Requirement: Clicking Trust author saves the author and reveals the post
When the Trust author button is clicked, the extension SHALL add the author to the whitelist in storage and immediately reveal the currently collapsed post.

#### Scenario: Post revealed immediately on trust
- **WHEN** the user clicks the Trust author button on a banner
- **THEN** the author is added to `author-whitelist` in storage
- **AND** the collapsed post is revealed (soft-hide class removed)
- **AND** the banner is removed from the DOM

#### Scenario: Trust author button shows confirmation before removal
- **WHEN** the Trust author button is clicked
- **THEN** the button briefly shows "Trusted ✓" before the banner is removed

## ADDED Requirements

### Requirement: Show anyway button spans the full banner width
The "Show anyway" button on collapse banners SHALL be rendered full-width so it reads as the primary escape action.

#### Scenario: Show anyway is full-width
- **WHEN** a collapse banner is rendered
- **THEN** the "Show anyway" button spans the full width of the banner

### Requirement: Unfollow and Trust author buttons are styled to match the banner theme
The Unfollow and Trust author buttons SHALL use colours consistent with the banner's dark red palette, with Unfollow styled as a danger action and Trust author styled as a positive action.

#### Scenario: Unfollow button is red-tinted
- **WHEN** a collapse banner with an extractable vanity name is rendered
- **THEN** the Unfollow button uses a muted red border and red-tinted text

#### Scenario: Trust author button is teal-tinted
- **WHEN** a collapse banner with an extractable vanity name is rendered
- **THEN** the Trust author button uses a muted teal border and teal-tinted text
