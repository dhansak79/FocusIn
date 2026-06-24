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
When `hide-promoted` is `true`, the feed processor SHALL hide any LinkedIn feed post that contains a standalone "Promoted" label element appearing before the post body. Hidden promoted posts SHALL be fully removed from view (not soft-collapsed).

#### Scenario: Promoted post is hidden immediately
- **WHEN** `hide-promoted` is `true` and a feed post contains a `<span>` or `<p>` whose trimmed `textContent` equals `"Promoted"` before the post body
- **THEN** the post is hidden with the same CSS class used for keyword-matched posts

#### Scenario: Non-promoted post is not affected
- **WHEN** `hide-promoted` is `true` and a feed post does not contain a standalone "Promoted" label
- **THEN** the post is not hidden by the promoted-post filter (other filters may still apply)

#### Scenario: Promoted posts reappear when toggle is turned off
- **WHEN** the user unchecks the `hide-promoted` toggle
- **THEN** the feed processor resets hidden posts and re-processes the feed without the promoted filter active
