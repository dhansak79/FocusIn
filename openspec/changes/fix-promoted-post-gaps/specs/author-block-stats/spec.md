## MODIFIED Requirements

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

#### Scenario: Block count increments on promoted-post filter
- **WHEN** a post is hidden by the promoted-post filter
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

## ADDED Requirements

### Requirement: Author names and signal strings are HTML-escaped before popup rendering
The stats renderer SHALL HTML-escape all dynamic string values (author display names and signal strings) before inserting them into `innerHTML` template literals, to prevent stored cross-site scripting from LinkedIn profile names or other page-sourced data reaching the extension popup.

#### Scenario: HTML metacharacters in author name are escaped
- **WHEN** a blocked author's display name contains HTML metacharacters (e.g. `<`, `>`, `&`, `"`)
- **THEN** those characters are rendered as their HTML entities in the popup and do not execute as markup

#### Scenario: Signal strings with special characters are escaped
- **WHEN** a slop signal string contains HTML metacharacters
- **THEN** those characters are rendered as their HTML entities in the popup and do not execute as markup
