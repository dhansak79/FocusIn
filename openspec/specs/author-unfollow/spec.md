## Requirements

### Requirement: Unfollow button appears on banners with a known author vanity name
Collapse banners (AI-generated post, semantic match, pattern match) SHALL display an Unfollow button when an author vanity name is extractable from the post DOM.

#### Scenario: Unfollow button present when vanity name available
- **WHEN** a post is collapsed into a banner
- **AND** the post DOM contains an extractable author vanity name
- **THEN** the banner displays an Unfollow button alongside the author name

#### Scenario: Unfollow button absent when vanity name unavailable
- **WHEN** a post is collapsed into a banner
- **AND** the post DOM does not contain an extractable vanity name
- **THEN** the banner renders without an Unfollow button

### Requirement: Clicking Unfollow fires LinkedIn's unfollow API
When the Unfollow button is clicked, the extension SHALL send LinkedIn's RSC action unfollow request using the author's vanity name and the session's CSRF token.

#### Scenario: Unfollow request sent on click
- **WHEN** the user clicks the Unfollow button on a banner
- **THEN** the extension fires an API request to unfollow the author
- **AND** the CSRF token from the JSESSIONID cookie is included in the request headers

#### Scenario: Button shows loading state during request
- **WHEN** the Unfollow button is clicked
- **THEN** the button is disabled and shows "Unfollowing…" while the request is in flight

### Requirement: Banner reflects unfollow outcome
The Unfollow button SHALL update to reflect whether the API call succeeded or failed.

#### Scenario: Success state after unfollow
- **WHEN** the unfollow API returns a success response
- **THEN** the button shows "Unfollowed" and remains disabled with the `focusedin-unfollow-done` class

#### Scenario: Error state after failed unfollow
- **WHEN** the unfollow API returns an error or the request fails
- **THEN** the button returns to its clickable state and shows "Unfollow failed"
- **AND** the rest of the banner is unaffected
