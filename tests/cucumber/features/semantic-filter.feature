Feature: semantic-filter

  Scenario: Political content checkbox exists and is off by default
    When the popup opens for a user who has never enabled `political content`
    Then a checkbox with value `political content` is present and unchecked

  Scenario: Political content checkbox is persisted when enabled
    When the user checks the `political content` checkbox
    Then `political content` is saved to `semantic-filter` storage and used in subsequent semantic checks

  Scenario: War and conflict checkbox exists and is off by default
    When the popup opens for a user who has never enabled `war and conflict`
    Then a checkbox with value `war and conflict` is present and unchecked

  Scenario: War and conflict checkbox is persisted when enabled
    When the user checks the `war and conflict` checkbox
    Then `war and conflict` is saved to `semantic-filter` storage and used in subsequent semantic checks
