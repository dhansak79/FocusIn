Feature: line-stacking-slop-signal

  Scenario: Moderate line stacking alone does not trigger detection
    Given a post with moderate line stacking and no other slop signals
    When the slop score is calculated
    Then the post is not detected as AI-generated

  Scenario: Moderate line stacking combined with a phrase triggers detection
    Given a post with moderate line stacking and one slop phrase
    When the slop score is calculated
    Then the post is detected as AI-generated

  Scenario: Extreme line stacking alone triggers detection
    Given a post with 15 or more single-sentence lines at 80% or higher ratio and no other signals
    When the slop score is calculated
    Then the post is detected as AI-generated
