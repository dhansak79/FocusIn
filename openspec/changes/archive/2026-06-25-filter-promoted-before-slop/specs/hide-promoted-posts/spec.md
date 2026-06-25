## ADDED Requirements

### Requirement: Promoted posts are excluded from all other filters
The feed processor SHALL evaluate whether a post is promoted before running keyword matching, slop detection, or any async semantic or tone checks. If a post is identified as promoted, the processor SHALL exit the filtering pipeline immediately, regardless of the `hide-promoted` toggle state. When `hide-promoted` is `false`, the promoted post SHALL be left unmodified and visible; it SHALL NOT receive a slop-collapse banner or a "Show anyway" button.

#### Scenario: Promoted slop post is not soft-hidden when hide-promoted is off
- **WHEN** `hide-promoted` is `false`
- **AND** a feed post is identified as promoted
- **AND** the post text would trigger slop detection
- **THEN** the post does not receive a `focusedin-slop-soft-hide` class
- **AND** no slop-collapse banner is inserted before the post

#### Scenario: Promoted slop post is hard-hidden when hide-promoted is on
- **WHEN** `hide-promoted` is `true`
- **AND** a feed post is identified as promoted
- **AND** the post text would trigger slop detection
- **THEN** the post is hard-hidden by the promoted filter (not soft-hidden by slop detection)
- **AND** no slop-collapse banner or "Show anyway" button is inserted

#### Scenario: Promoted post does not enter keyword filter
- **WHEN** a feed post is identified as promoted
- **AND** the post text contains a configured keyword
- **THEN** the keyword filter does not run on the post
- **AND** the promoted post is either hard-hidden (if `hide-promoted` is on) or left visible (if off)

#### Scenario: Non-promoted slop post is unaffected
- **WHEN** a feed post is NOT promoted
- **AND** the post text triggers slop detection
- **THEN** the post is soft-hidden by slop detection with a "Show anyway" banner (existing behaviour unchanged)
