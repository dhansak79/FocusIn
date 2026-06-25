# Spec: Hide Promoted Posts

## Purpose

Allows users to hide LinkedIn feed posts that contain a standalone "Promoted" label, using a toggle in the popup UI.

## Requirements

### Requirement: Hide promoted posts toggle
The extension SHALL provide a toggle in the popup UI labelled "Hide promoted posts" under an "Ads" section in the Filters tab. The toggle SHALL be stored in `chrome.storage.local` under the key `hide-promoted`. The toggle SHALL default to unchecked (off) for both new installs and existing users.

#### Scenario: Toggle exists and is off by default
- **WHEN** the popup opens for a user who has never enabled `hide-promoted`
- **THEN** a checkbox with id `hide-promoted` is present and unchecked

#### Scenario: Toggle state is persisted
- **WHEN** the user checks the `hide-promoted` checkbox
- **THEN** `chrome.storage.local` contains `{ "hide-promoted": true }`

#### Scenario: Toggle state is restored on popup reopen
- **WHEN** the user has previously enabled `hide-promoted` and reopens the popup
- **THEN** the `hide-promoted` checkbox is checked

### Requirement: Promoted posts are hidden when toggle is on
When `hide-promoted` is `true`, the feed processor SHALL hide any LinkedIn feed post that contains a standalone "Promoted" label element appearing before the post body. Hidden promoted posts SHALL be fully removed from view (not soft-collapsed). The detector SHALL identify the "Promoted" label without requiring the post to contain a `data-testid="expandable-text-box"` element, so that image-only and video ads are also detected.

#### Scenario: Promoted post is hidden immediately
- **WHEN** `hide-promoted` is `true` and a feed post contains a `<span>` or `<p>` whose trimmed `textContent` equals `"Promoted"` before the post body
- **THEN** the post is hidden with the same CSS class used for keyword-matched posts

#### Scenario: Image-only promoted post is hidden
- **WHEN** `hide-promoted` is `true` and a feed post contains a `<span>` or `<p>` with trimmed text `"Promoted"` but has no `data-testid="expandable-text-box"` element
- **THEN** the post is identified as promoted and hidden

#### Scenario: Non-promoted post is not affected
- **WHEN** `hide-promoted` is `true` and a feed post does not contain a standalone "Promoted" label
- **THEN** the post is not hidden by the promoted-post filter (other filters may still apply)

#### Scenario: Promoted posts reappear when toggle is turned off
- **WHEN** the user unchecks the `hide-promoted` toggle
- **THEN** the feed processor resets hidden posts and re-processes the feed without the promoted filter active

### Requirement: Hidden promoted posts are counted in daily stats
When a post is hidden by the promoted-post filter, the extension SHALL increment the daily `postsFiltered` counter and record the author in the daily blocked-authors map, consistent with the keyword-match and slop-detection paths.

#### Scenario: Promoted hide increments filtered counter
- **WHEN** `hide-promoted` is `true` and a post is hidden by the promoted-post filter
- **THEN** the daily `postsFiltered` count increments by 1

#### Scenario: Promoted hide records author in blocked-authors map
- **WHEN** a post is hidden by the promoted-post filter
- **AND** the author's vanity name is extractable from the post DOM
- **THEN** the author's count in the daily `authors` map increments by 1

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
