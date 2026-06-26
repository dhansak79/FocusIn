# Spec: AI Slop Reaction Button

## Purpose

Allow users to manually flag AI-generated slop posts via a 🤖 button injected directly into each post's action bar. Clicking records an all-time per-author tally in a dedicated "Hall of Shame" store without hiding the post.

## Requirements

### Requirement: AI Slop button is injected into the post action bar
The extension SHALL inject a 🤖 button into the action bar of each LinkedIn feed post that has a reaction bar, positioned immediately after the reaction group (next to the Like button). The button SHALL always be visible (not hover-triggered). A custom circular icon SHALL overlay an emoji fallback when the extension URL resolves.

#### Scenario: Button appears in the action bar when post is in feed
- **WHEN** a post with a `button[aria-label="Open reactions menu"]` is present in the feed
- **THEN** a `.focusedin-slop-reaction-btn` button is injected immediately after the reaction group

#### Scenario: Button is not duplicated when the observer fires multiple times
- **WHEN** the action bar is already present with an injected slop button
- **THEN** only one slop button is present at any time

#### Scenario: No button injected on posts without a reaction bar
- **WHEN** a post has no `button[aria-label="Open reactions menu"]`
- **THEN** no slop button is injected into that post

#### Scenario: Button injected via MutationObserver when action bar added dynamically
- **WHEN** a reactions button is added to the feed DOM after initial load
- **THEN** the slop button is injected into the new action bar

### Requirement: Clicking AI Slop records the event without hiding the post
When the user clicks the 🤖 button, the extension SHALL increment the daily slop-collapsed counter and write to the all-time Hall of Shame store. It SHALL NOT hide the post. It SHALL NOT modify the daily per-author `authors` map.

#### Scenario: Post is NOT hidden on click
- **WHEN** the user clicks the 🤖 button
- **THEN** the associated feed post remains visible

#### Scenario: Daily slop collapsed counter increments on click
- **WHEN** the user clicks the 🤖 button
- **THEN** the daily `slopCollapsed` counter increments by 1

#### Scenario: Author all-time count is incremented in Hall of Shame store on click
- **WHEN** the user clicks the 🤖 button
- **AND** the author vanity name is extractable from the post DOM
- **THEN** the author's count in `focusin-slop-reactions` increments by 1
- **AND** the daily `authors` map is NOT modified

#### Scenario: Click on post with no extractable author does not throw
- **WHEN** the user clicks the 🤖 button
- **AND** no author name or vanity name can be extracted from the post
- **THEN** no error is thrown and the daily counter still increments

### Requirement: Hall of Shame tab shows all-time per-author slop reaction counts
The popup SHALL include a "Hall of Shame" tab that displays a ranked list of authors the user has manually flagged via the 🤖 button. Counts SHALL persist indefinitely across sessions and SHALL NOT reset daily. The list SHALL be ranked by count descending with no entry cap.

#### Scenario: Hall of Shame tab appears in the popup tab bar
- **WHEN** the popup opens
- **THEN** a "Hall of Shame" tab button is visible in the tab bar

#### Scenario: Tab renders ranked author list
- **WHEN** the user clicks the "Hall of Shame" tab
- **THEN** the panel shows each author who has been manually slopped at least once, sorted highest count first
- **AND** each row displays the author's name and their all-time slop reaction count

#### Scenario: Counts persist after browser restart
- **WHEN** the user has flagged an author via the 🤖 button in a previous session
- **AND** the user opens the popup in a new session
- **THEN** the author still appears in the Hall of Shame with the correct accumulated count

#### Scenario: Empty state when no authors have been flagged
- **WHEN** the user clicks the "Hall of Shame" tab
- **AND** no posts have ever been flagged via the 🤖 button
- **THEN** the panel shows the message "No authors in the Hall of Shame yet — use the 🤖 button in the reaction picker to flag them."
