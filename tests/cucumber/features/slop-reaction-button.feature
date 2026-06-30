Feature: slop-reaction-button

  Scenario: Button appears in the action bar when post is in feed
    When a post with a `button[aria-label="Open reactions menu"]` is present in the feed
    Then a `.focusedin-slop-reaction-btn` button is injected immediately after the reaction group

  Scenario: Button is not duplicated when the observer fires multiple times
    When the action bar is already present with an injected slop button
    Then only one slop button is present at any time

  Scenario: No button injected on posts without a reaction bar
    When a post has no `button[aria-label="Open reactions menu"]`
    Then no slop button is injected into that post

  Scenario: Button injected via MutationObserver when action bar added dynamically
    When a reactions button is added to the feed DOM after initial load
    Then the slop button is injected into the new action bar

  Scenario: Post is NOT hidden on click
    When the user clicks the 🤖 button
    Then the associated feed post remains visible

  Scenario: Daily slop collapsed counter increments on click
    When the user clicks the 🤖 button
    Then the daily `slopCollapsed` counter increments by 1

  Scenario: Author all-time count is incremented in Hall of Shame store on click
    When the user clicks the 🤖 button
    And the author vanity name is extractable from the post DOM
    Then the author's count in `focusin-slop-reactions` increments by 1
    And the daily `authors` map is NOT modified

  Scenario: Click on post with no extractable author does not throw
    When the user clicks the 🤖 button
    And no author name or vanity name can be extracted from the post
    Then no error is thrown and the daily counter still increments

  Scenario: Hall of Shame tab appears in the popup tab bar
    When the popup opens
    Then a "Hall of Shame" tab button is visible in the tab bar

  Scenario: Tab renders ranked author list
    When the user clicks the "Hall of Shame" tab
    Then the panel shows each author who has been manually slopped at least once, sorted highest count first
    And each row displays the author's name and their all-time slop reaction count

  Scenario: Counts persist after browser restart
    When the user has flagged an author via the 🤖 button in a previous session
    And the user opens the popup in a new session
    Then the author still appears in the Hall of Shame with the correct accumulated count

  Scenario: Empty state when no authors have been flagged
    When the user clicks the "Hall of Shame" tab
    And no posts have ever been flagged via the 🤖 button
    Then the panel shows the message "No authors in the Hall of Shame yet — use the 🤖 button in the reaction picker to flag them."
