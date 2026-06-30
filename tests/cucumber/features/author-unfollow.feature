Feature: author-unfollow

  Scenario: Unfollow button present when vanity name available
    When a post is collapsed into a banner
    And the post DOM contains an extractable author vanity name
    Then the banner displays an Unfollow button alongside the author name

  Scenario: Unfollow button absent when vanity name unavailable
    When a post without an extractable vanity name is collapsed into a banner
    And the post DOM does not contain an extractable vanity name
    Then the banner renders without an Unfollow button

  Scenario: Unfollow request sent on click
    When the user clicks the Unfollow button on a banner
    Then the extension fires an API request to unfollow the author
    And the CSRF token from the JSESSIONID cookie is included in the request headers

  Scenario: Button shows loading state during request
    When the Unfollow button is clicked
    Then the button is disabled and shows "Unfollowing…" while the request is in flight

  Scenario: Success state after unfollow
    When the unfollow API returns a success response
    Then the button shows "Unfollowed" and remains disabled with the `focusedin-unfollow-done` class

  Scenario: Error state after failed unfollow
    When the unfollow API returns an error or the request fails
    Then the button returns to its clickable state and shows "Unfollow failed"
    And the rest of the banner is unaffected
