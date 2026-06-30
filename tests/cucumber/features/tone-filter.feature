Feature: tone-filter

  Scenario: Tone filter toggle is off by default
    When a user installs the extension for the first time
    Then the `tone-filter` setting is `false` and no tone checking is performed

  Scenario: User enables tone filter
    When the user switches the tone filter toggle on
    Then `tone-filter` is saved as `true` in storage and tone checking begins on the next feed scan

  Scenario: Sensitivity slider is visible when tone filter is enabled
    When the tone filter toggle is on
    Then a sensitivity slider (0–100) is visible and its value is persisted to `tone-threshold` in storage

  Scenario: Negative post is collapsed
    When the tone filter is enabled
    And a feed post returns a NEGATIVE confidence score ≥ threshold / 100
    Then the post is soft-hidden and a "🌩 Negative tone" collapse banner is inserted before it

  Scenario: Positive or neutral post is not collapsed
    When the tone filter is enabled
    And a feed post returns a NEGATIVE confidence score < threshold / 100
    Then the post is not hidden and no banner is inserted

  Scenario: Already-collapsed posts are not re-checked
    When the tone filter is enabled
    And a post has already been collapsed by the slop, archetype, or semantic detector
    Then no tone-check message is sent for that post

  Scenario: Banner shows confidence percentage
    When a post is collapsed by the tone filter
    Then the banner signal line reads `"negative tone · NN%"` where NN is the classifier's NEGATIVE confidence rounded to the nearest integer

  Scenario: Show anyway reveals the post
    When the user clicks "Show anyway" on a negative tone banner
    Then the post is revealed and the banner is replaced with a small tag

  Scenario: Trust author prevents future collapse for that author
    When the user clicks "Trust author" on a negative tone banner
    Then the author is added to the author whitelist and the post is immediately revealed
