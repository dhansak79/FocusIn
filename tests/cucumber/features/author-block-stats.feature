Feature: author-block-stats

  Scenario: Block count increments on pattern match collapse
    When a post is collapsed with a pattern match banner
    And the author vanity name is extractable from the post DOM
    Then the author's count in the daily `authors` map increments by 1

  Scenario: Block count increments on semantic match collapse
    When a post is collapsed with a semantic match banner
    And the author vanity name is extractable from the post DOM
    Then the author's count in the daily `authors` map increments by 1

  Scenario: Block count increments on topic filter
    When a post is hidden by the topic/keyword filter
    And the author vanity name is extractable from the post DOM
    Then the author's count in the daily `authors` map increments by 1

  Scenario: Block count increments on promoted-post filter
    When a post is hidden by the promoted-post filter
    And the author vanity name is extractable from the post DOM
    Then the author's count in the daily `authors` map increments by 1

  Scenario: Block count falls back to display name as key
    When a post is blocked
    And the vanity name cannot be extracted from the post DOM
    And the display name is available
    Then the author's count is keyed by display name in the `authors` map

  Scenario: Silent skip when neither name is available
    When a post is blocked
    And neither vanity name nor display name can be extracted
    Then no entry is written to the `authors` map

  Scenario: Daily reset clears per-author tallies
    When the current date differs from the stored date key
    Then the `authors` map resets to empty along with the other daily stats

  Scenario: HTML metacharacters in author name are escaped
    When a blocked author's display name contains HTML metacharacters (e.g. `<`, `>`, `&`, `"`)
    Then those characters are rendered as their HTML entities in the popup and do not execute as markup

  Scenario: Signal strings with special characters are escaped
    When a slop signal string contains HTML metacharacters
    Then those characters are rendered as their HTML entities in the popup and do not execute as markup

  Scenario: Blocked tab appears in the tab bar
    When the popup opens
    Then a "Blocked" tab button is visible in the tab bar alongside "Filters" and "Authors"

  Scenario: Tab renders ranked author list
    When the user clicks the "Blocked" tab
    Then the panel shows each author with at least one blocked post today, sorted highest count first
    And each row displays the author's display name and numeric block count

  Scenario: Empty state when no posts blocked today
    When the user clicks the "Blocked" tab
    And no posts have been blocked in the current session date
    Then the panel shows a message indicating no blocked posts yet today

  Scenario: List is capped at 20 entries
    When more than 20 distinct authors have been blocked today
    Then the "Blocked" tab displays only the top 20 by count
