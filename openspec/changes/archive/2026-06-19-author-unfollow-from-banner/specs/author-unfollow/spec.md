## ADDED Requirements

### Requirement: Unfollow button appears on banners with a known author URN
Collapse banners (AI-generated post, semantic match, pattern match) SHALL display an Unfollow button when both an author name and a LinkedIn member URN are extractable from the post DOM.

#### Scenario: Unfollow button present when URN available
- **WHEN** a post is collapsed into a banner
- **AND** the post DOM contains an extractable author name and member URN
- **THEN** the banner displays an Unfollow button alongside the author name

#### Scenario: Unfollow button absent when URN unavailable
- **WHEN** a post is collapsed into a banner
- **AND** the post DOM does not contain an extractable member URN
- **THEN** the banner renders without an Unfollow button

### Requirement: Clicking Unfollow fires LinkedIn's unfollow API
When the Unfollow button is clicked, the extension SHALL send LinkedIn's Voyager unfollow API request using the author's member URN and the session's CSRF token.

#### Scenario: Unfollow request sent on click
- **WHEN** the user clicks the Unfollow button on a banner
- **THEN** the extension fires a Voyager API request to unfollow the author
- **AND** the CSRF token from the page's cookies is included in the request headers

#### Scenario: Button shows loading state during request
- **WHEN** the Unfollow button is clicked
- **THEN** the button is disabled and indicates a pending state while the request is in flight

### Requirement: Banner reflects unfollow outcome
The Unfollow button SHALL update to reflect whether the API call succeeded or failed.

#### Scenario: Success state after unfollow
- **WHEN** the Voyager unfollow API returns a success response
- **THEN** the Unfollow button is replaced with a non-interactive "Unfollowed" confirmation label

#### Scenario: Error state after failed unfollow
- **WHEN** the Voyager unfollow API returns an error or the request fails
- **THEN** the button returns to its clickable state and displays an error indicator
- **AND** the rest of the banner is unaffected
