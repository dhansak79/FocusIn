Feature: slop-detection-tuning

  Scenario: Default tone threshold is 85%
    Given the tone filter is enabled with no user-configured threshold
    When a user installs the extension for the first time
    Then the tone-threshold setting defaults to 85

  Scenario: Em dash alone does not trigger detection
    Given a post containing an em dash and no other slop signals
    When the slop score is calculated
    Then the post is not detected as AI-generated

  Scenario: Em dash combined with another signal triggers detection
    Given a post containing an em dash and one slop phrase
    When the slop score is calculated
    Then the post is detected as AI-generated

  Scenario: Em dash signal appears in the signals list
    Given a post containing an em dash and one slop phrase
    When the slop signals are retrieved
    Then em dash is included in the returned signals

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
