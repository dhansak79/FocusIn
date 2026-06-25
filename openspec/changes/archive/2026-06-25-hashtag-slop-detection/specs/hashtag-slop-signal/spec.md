## ADDED Requirements

### Requirement: Posts with 5 or more hashtags score 1 slop point
The slop detector SHALL treat a post containing 5 or more hashtag tokens (strings matching `#\w+`) as carrying a hashtag-spam signal worth 1 point toward the slop score. Posts with fewer than 5 hashtags SHALL NOT receive this point.

#### Scenario: Post with 5 hashtags triggers the signal
- **WHEN** the slop detector evaluates a post whose text contains exactly 5 hashtag tokens
- **THEN** `getSlopScore` includes 1 point for the hashtag signal
- **AND** `getSlopSignals` includes `"hashtag spam"` in the returned array

#### Scenario: Post with more than 5 hashtags triggers the signal
- **WHEN** the slop detector evaluates a post whose text contains more than 5 hashtag tokens
- **THEN** `getSlopScore` includes 1 point for the hashtag signal
- **AND** `getSlopSignals` includes `"hashtag spam"` in the returned array

#### Scenario: Post with fewer than 5 hashtags does not trigger the signal
- **WHEN** the slop detector evaluates a post whose text contains 4 or fewer hashtag tokens
- **THEN** `getSlopScore` does not include a point for the hashtag signal
- **AND** `getSlopSignals` does not include `"hashtag spam"`

#### Scenario: Post with no hashtags is not affected
- **WHEN** the slop detector evaluates a post with no hashtag tokens
- **THEN** `getSlopScore` does not include a point for the hashtag signal

#### Scenario: Hashtag signal combines with other signals to reach slop threshold
- **WHEN** a post contains 5 or more hashtags
- **AND** the post also triggers at least one other 1-point signal (e.g. emoji overload, emoji bullets)
- **THEN** the combined score reaches or exceeds the slop threshold and `isSlop` returns true
