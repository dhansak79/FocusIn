Feature: banner-author-display

  Scenario: Author available on semantic match banner
    When a post is collapsed with a semantic match banner
    And the post DOM contains an extractable author name
    Then the banner displays the author name in a `focusedin-slop-author` element below the signal row

  Scenario: No author available on semantic match banner
    When a post with no identifiable author is collapsed with a semantic match banner
    And the post DOM does not contain an extractable author name
    Then the banner renders without an author element

  Scenario: Author available on pattern match banner
    When a post is collapsed with a pattern match banner
    And the post DOM contains an extractable author name
    Then the banner displays the author name in a `focusedin-slop-author` element below the signal row

  Scenario: No author available on pattern match banner
    When a post with no identifiable author is collapsed with a pattern match banner
    And the post DOM does not contain an extractable author name
    Then the banner renders without an author element

  Scenario: Pattern match headline
    When a post is collapsed due to structural slop detection
    Then the banner headline reads "🎯 Pattern match"

  Scenario: Pattern match signal text
    When a post is collapsed due to structural slop detection
    Then the signal row reads "pattern match · N%" where N is the similarity percentage

  Scenario: Vanity name extracted when profile link present
    When a post is collapsed into any banner type
    And the post DOM contains a profile href in the form `/in/username/`
    Then the extracted vanity name is available to the banner for constructing the Unfollow request

  Scenario: Vanity name absent when no profile link in DOM
    When a post with no profile link is collapsed into any banner type
    And the post DOM does not contain an extractable `/in/username/` href
    Then vanity name extraction returns null and no Unfollow button is rendered

  Scenario: Whitelist button present when vanity name available
    When a post is collapsed into a banner
    And the post DOM contains an extractable author vanity name
    Then the banner displays a "Whitelist" button after the Unfollow button

  Scenario: Whitelist button absent when vanity name unavailable
    When a post without an extractable vanity name is collapsed into a banner
    And the post DOM does not contain an extractable vanity name
    Then the banner renders without a Whitelist button

  Scenario: Post revealed immediately on whitelist
    When the user clicks the Whitelist button on a banner
    Then the author is added to `author-whitelist` in storage
    And the collapsed post is revealed (soft-hide class removed)
    And the banner is removed from the DOM

  Scenario: Whitelist button shows confirmation before removal
    When the Whitelist button is clicked
    Then the button briefly shows "Whitelisted ✓" before the banner is removed
