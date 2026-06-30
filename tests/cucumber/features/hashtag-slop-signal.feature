Feature: hashtag-slop-signal

  Scenario: Post with 5 hashtags triggers the signal
    When the slop detector evaluates a post whose text contains exactly 5 hashtag tokens
    Then `getSlopScore` includes 1 point for the hashtag signal
    And `getSlopSignals` includes `"hashtag spam"` in the returned array

  Scenario: Post with more than 5 hashtags triggers the signal
    When the slop detector evaluates a post whose text contains more than 5 hashtag tokens
    Then `getSlopScore` includes 1 point for the hashtag signal
    And `getSlopSignals` includes `"hashtag spam"` in the returned array

  Scenario: Post with fewer than 5 hashtags does not trigger the signal
    When the slop detector evaluates a post whose text contains 4 or fewer hashtag tokens
    Then `getSlopScore` does not include a point for the hashtag signal
    And `getSlopSignals` does not include `"hashtag spam"`

  Scenario: Post with no hashtags is not affected
    When the slop detector evaluates a post with no hashtag tokens
    Then `getSlopScore` does not include a point for the hashtag signal

  Scenario: Hashtag signal combines with other signals to reach slop threshold
    When a post contains 5 or more hashtags
    And the post also triggers at least one other 1-point signal (e.g. emoji overload, emoji bullets)
    Then the combined score reaches or exceeds the slop threshold and `isSlop` returns true
