# Spec: Author Block Stats

## Purpose

Tracks per-author blocked-post counts in daily storage and surfaces them in a ranked "Blocked" tab in the popup.

## Requirements

### Requirement: Per-author block count is tracked in daily storage
The extension SHALL increment a per-author blocked-post counter in `chrome.storage.local` each time a post by that author is collapsed or filtered. Counts SHALL be keyed by the author's LinkedIn vanity name when available, falling back to display name. Counts SHALL reset daily alongside the existing damage-report stats.

#### Scenario: Block count increments on pattern match collapse
- **WHEN** a post is collapsed with a pattern match banner
- **AND** the author vanity name is extractable from the post DOM
- **THEN** the author's count in the daily `authors` map increments by 1

#### Scenario: Block count increments on semantic match collapse
- **WHEN** a post is collapsed with a semantic match banner
- **AND** the author vanity name is extractable from the post DOM
- **THEN** the author's count in the daily `authors` map increments by 1

#### Scenario: Block count increments on topic filter
- **WHEN** a post is hidden by the topic/keyword filter
- **AND** the author vanity name is extractable from the post DOM
- **THEN** the author's count in the daily `authors` map increments by 1

#### Scenario: Block count falls back to display name as key
- **WHEN** a post is blocked
- **AND** the vanity name cannot be extracted from the post DOM
- **AND** the display name is available
- **THEN** the author's count is keyed by display name in the `authors` map

#### Scenario: Silent skip when neither name is available
- **WHEN** a post is blocked
- **AND** neither vanity name nor display name can be extracted
- **THEN** no entry is written to the `authors` map

#### Scenario: Daily reset clears per-author tallies
- **WHEN** the current date differs from the stored date key
- **THEN** the `authors` map resets to empty along with the other daily stats

### Requirement: Popup shows a "Blocked" tab with ranked author list
The popup SHALL include a third tab labelled "Blocked" that displays a list of authors whose posts were blocked today, ranked by block count descending, showing display name and count.

#### Scenario: Blocked tab appears in the tab bar
- **WHEN** the popup opens
- **THEN** a "Blocked" tab button is visible in the tab bar alongside "Filters" and "Authors"

#### Scenario: Tab renders ranked author list
- **WHEN** the user clicks the "Blocked" tab
- **THEN** the panel shows each author with at least one blocked post today, sorted highest count first
- **AND** each row displays the author's display name and numeric block count

#### Scenario: Empty state when no posts blocked today
- **WHEN** the user clicks the "Blocked" tab
- **AND** no posts have been blocked in the current session date
- **THEN** the panel shows a message indicating no blocked posts yet today

#### Scenario: List is capped at 20 entries
- **WHEN** more than 20 distinct authors have been blocked today
- **THEN** the "Blocked" tab displays only the top 20 by count
