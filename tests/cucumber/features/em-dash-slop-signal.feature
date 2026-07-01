Feature: em-dash-slop-signal

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
