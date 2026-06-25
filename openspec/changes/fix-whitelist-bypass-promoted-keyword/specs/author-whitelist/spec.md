## MODIFIED Requirements

### Requirement: Whitelisted authors' posts are never collapsed
When an author's vanity name appears in the whitelist, the extension SHALL pass through their posts without collapsing them, regardless of which detection path fires (keyword/pattern slop, model-based slop, semantic match, pattern match, promoted-post filter).

#### Scenario: Whitelisted author bypasses AI slop detection
- **WHEN** a post is detected as AI-generated slop
- **AND** the post author's vanity name is in the whitelist
- **THEN** the post is not collapsed and no banner is rendered

#### Scenario: Whitelisted author bypasses semantic match
- **WHEN** a post scores above the semantic match threshold
- **AND** the post author's vanity name is in the whitelist
- **THEN** the post is not collapsed and no banner is rendered

#### Scenario: Whitelisted author bypasses pattern match
- **WHEN** a post scores above the pattern match threshold
- **AND** the post author's vanity name is in the whitelist
- **THEN** the post is not collapsed and no banner is rendered

#### Scenario: Whitelisted author bypasses keyword match
- **WHEN** a post's text contains a configured keyword
- **AND** the post author's vanity name is in the whitelist
- **THEN** the post is not hidden and is not counted as blocked

#### Scenario: Whitelisted author bypasses promoted-post filter
- **WHEN** `hide-promoted` is `true` and a post is identified as a promoted post
- **AND** the post author's vanity name is in the whitelist
- **THEN** the post is not hidden by the promoted-post filter

#### Scenario: Non-whitelisted author is still collapsed
- **WHEN** a post triggers any detection path
- **AND** the post author's vanity name is not in the whitelist
- **THEN** the post is collapsed as normal
