Feature: scottish-mode

  Scenario: Slop-flagged post is rewritten in Scottish dialect when the mode is on
    Given scottish-mode is enabled in extension settings
    And a LinkedIn feed post is flagged as slop by the existing detection signals
    When the feed processes that post
    Then the post body is replaced in-place with a locally-generated Scottish-dialect rewrite
    And a "Translated — Scottish mode" tag is shown next to the rewritten text
    And no reveal-banner or collapse-banner is shown for that post

  Scenario: Semantic/tone-flagged post is rewritten, not banner-collapsed
    Given scottish-mode is enabled
    And a post is flagged by the semantic or tone filter (not the keyword/slop path)
    When the feed processes that post
    Then the post body is replaced with a Scottish-dialect rewrite in the same DOM position
    And the semantic/tone collapse-banner UI is not rendered for that post

  Scenario: Keyword-hidden post is rewritten instead of hidden
    Given scottish-mode is enabled
    And a post matches a user's keyword filter (previously handled by hidePost())
    When the feed processes that post
    Then the post body is replaced with a Scottish-dialect rewrite
    And the post is not hidden behind a click-to-reveal placeholder

  Scenario: User reveals the original text of a rewritten post
    Given a post has been replaced with a Scottish-dialect rewrite
    When the user clicks the "Translated — Scottish mode" tag
    Then the original, unmodified post text is shown
    And the user can collapse back to the rewritten version

  Scenario: Existing behavior is unchanged when Scottish mode is off
    Given scottish-mode is disabled (the default)
    And a post is flagged by any existing detection path (keyword, slop, semantic, tone)
    When the feed processes that post
    Then the existing reveal-banner, collapse-banner, or hide behavior is shown exactly as before
    And no Scottish-dialect rewrite is generated or displayed

  Scenario: Non-flagged posts are never rewritten
    Given scottish-mode is enabled
    And a post does not match any flagging signal
    When the feed processes that post
    Then the post is shown unmodified
    And no rewrite, banner, or hide treatment is applied

  Scenario: Rewrite falls back gracefully if the local model is unavailable
    Given scottish-mode is enabled
    And the local rewrite model has not finished loading or fails to produce output
    When a flagged post is processed
    Then the post falls back to its existing (non-Scottish-mode) treatment for that flag type
    And no broken or empty post body is left in the feed

  Scenario: Toggling Scottish mode on mid-session updates already-rendered posts
    Given the feed already contains posts collapsed by the existing banner/hide treatments
    When the user enables scottish-mode from the popup
    Then previously flagged, still-visible collapsed posts are re-rendered as Scottish-dialect rewrites
    And this re-render does not require a page reload
