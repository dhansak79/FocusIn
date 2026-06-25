## ADDED Requirements

### Requirement: AI Slop button is injected into the LinkedIn reaction picker
When the LinkedIn reaction picker appears in the feed, the extension SHALL inject an "AI Slop 🤖" button as the last item in the picker. The injected item SHALL be styled to match the picker's existing items (circular button, orange background). The button SHALL be removed when the picker closes.

#### Scenario: Button appears in the reaction picker
- **WHEN** the user hovers over the Like button on a feed post
- **AND** LinkedIn's reaction picker appears in the DOM
- **THEN** an "AI Slop 🤖" button labelled "AI Slop" is visible as the last item in the picker

#### Scenario: Button is not duplicated if picker re-renders
- **WHEN** the reaction picker is already present with an injected "AI Slop" button
- **AND** the picker DOM is updated by LinkedIn
- **THEN** only one "AI Slop" button is present in the picker at any time

#### Scenario: Button is removed when picker closes
- **WHEN** the reaction picker is removed from the DOM
- **THEN** the injected button is also removed and no orphaned elements remain

#### Scenario: No injection outside the feed
- **WHEN** a LinkedIn reaction picker appears outside the main feed (e.g. in a notification or article)
- **THEN** no "AI Slop" button is injected

### Requirement: Clicking AI Slop hides the post and records the event
When the user clicks the "AI Slop" button, the extension SHALL hard-hide the associated feed post, increment the daily slop-collapsed counter, and write to the all-time Hall of Shame store. It SHALL NOT write to the daily per-author `authors` map.

#### Scenario: Post is hidden on click
- **WHEN** the user clicks the "AI Slop" button in the reaction picker
- **THEN** the associated feed post is hidden with the `hide` CSS class

#### Scenario: Daily slop collapsed counter increments on click
- **WHEN** the user clicks the "AI Slop" button
- **THEN** the daily `slopCollapsed` counter increments by 1

#### Scenario: Author all-time count is incremented in Hall of Shame store
- **WHEN** the user clicks the "AI Slop" button
- **AND** the author vanity name is extractable from the post DOM
- **THEN** the author's count in `focusin-slop-reactions` increments by 1
- **AND** the daily `authors` map is NOT modified

#### Scenario: Click on post with no extractable author is handled gracefully
- **WHEN** the user clicks the "AI Slop" button
- **AND** no author name or vanity name can be extracted from the post
- **THEN** the post is still hidden and no error is thrown

#### Scenario: Reaction picker closes after click
- **WHEN** the user clicks the "AI Slop" button
- **THEN** the reaction picker is removed from view

### Requirement: Hall of Shame tab shows all-time per-author slop reaction counts
The popup SHALL include a "Hall of Shame" tab that displays a ranked list of authors the user has manually flagged via the AI Slop reaction button. Counts SHALL persist indefinitely across sessions and SHALL NOT reset daily. The list SHALL be ranked by count descending.

#### Scenario: Hall of Shame tab appears in the popup tab bar
- **WHEN** the popup opens
- **THEN** a "Hall of Shame" tab button is visible in the tab bar

#### Scenario: Tab renders ranked author list
- **WHEN** the user clicks the "Hall of Shame" tab
- **THEN** the panel shows each author who has been manually slopped at least once, sorted highest count first
- **AND** each row displays the author's name and their all-time slop reaction count

#### Scenario: Counts persist after browser restart
- **WHEN** the user has flagged an author via the AI Slop button in a previous session
- **AND** the user opens the popup in a new session
- **THEN** the author still appears in the Hall of Shame with the correct accumulated count

#### Scenario: Empty state when no authors have been flagged
- **WHEN** the user clicks the "Hall of Shame" tab
- **AND** no posts have ever been flagged via the AI Slop button
- **THEN** the panel shows the message "No authors in the Hall of Shame yet — use the 🤖 button in the reaction picker to flag them."
