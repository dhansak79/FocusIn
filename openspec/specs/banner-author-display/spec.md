## ADDED Requirements

### Requirement: Semantic match banner shows author name
When a post is hidden by semantic match, the collapse banner SHALL display the post author's name when it can be extracted from the DOM.

#### Scenario: Author available on semantic match banner
- **WHEN** a post is collapsed with a semantic match banner
- **AND** the post DOM contains an extractable author name
- **THEN** the banner displays the author name in a `focusedin-slop-author` element below the signal row

#### Scenario: No author available on semantic match banner
- **WHEN** a post is collapsed with a semantic match banner
- **AND** the post DOM does not contain an extractable author name
- **THEN** the banner renders without an author element

### Requirement: Pattern match banner shows author name
When a post is hidden by pattern match (formerly structural slop), the collapse banner SHALL display the post author's name when it can be extracted from the DOM.

#### Scenario: Author available on pattern match banner
- **WHEN** a post is collapsed with a pattern match banner
- **AND** the post DOM contains an extractable author name
- **THEN** the banner displays the author name in a `focusedin-slop-author` element below the signal row

#### Scenario: No author available on pattern match banner
- **WHEN** a post is collapsed with a pattern match banner
- **AND** the post DOM does not contain an extractable author name
- **THEN** the banner renders without an author element

### Requirement: Pattern match label replaces structural slop label
The user-visible label for the structural slop detection type SHALL be "Pattern match" (headline) and "pattern match" (signal text).

#### Scenario: Pattern match headline
- **WHEN** a post is collapsed due to structural slop detection
- **THEN** the banner headline reads "🎯 Pattern match"

#### Scenario: Pattern match signal text
- **WHEN** a post is collapsed due to structural slop detection
- **THEN** the signal row reads "pattern match · N%" where N is the similarity percentage

### Requirement: Author vanity name extracted alongside display name
The banner construction logic SHALL extract the author's LinkedIn vanity name (profile slug) from the `/in/username/` href in the post DOM alongside the display name, making it available for the Unfollow button.

#### Scenario: Vanity name extracted when profile link present
- **WHEN** a post is collapsed into any banner type
- **AND** the post DOM contains a profile href in the form `/in/username/`
- **THEN** the extracted vanity name is available to the banner for constructing the Unfollow request

#### Scenario: Vanity name absent when no profile link in DOM
- **WHEN** a post is collapsed into any banner type
- **AND** the post DOM does not contain an extractable `/in/username/` href
- **THEN** vanity name extraction returns null and no Unfollow button is rendered
