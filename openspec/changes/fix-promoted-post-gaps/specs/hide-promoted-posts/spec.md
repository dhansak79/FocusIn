## MODIFIED Requirements

### Requirement: Promoted posts are hidden when toggle is on
When `hide-promoted` is `true`, the feed processor SHALL hide any LinkedIn feed post that contains a standalone "Promoted" label element appearing before the post body. Hidden promoted posts SHALL be fully removed from view (not soft-collapsed). The detector SHALL identify the "Promoted" label without requiring the post to contain a `data-testid="expandable-text-box"` element, so that image-only and video ads are also detected.

#### Scenario: Promoted post is hidden immediately
- **WHEN** `hide-promoted` is `true` and a feed post contains a `<span>` or `<p>` whose trimmed `textContent` equals `"Promoted"` before the post body
- **THEN** the post is hidden with the same CSS class used for keyword-matched posts

#### Scenario: Image-only promoted post is hidden
- **WHEN** `hide-promoted` is `true` and a feed post contains a `<span>` or `<p>` with trimmed text `"Promoted"` but has no `data-testid="expandable-text-box"` element
- **THEN** the post is identified as promoted and hidden

#### Scenario: Non-promoted post is not affected
- **WHEN** `hide-promoted` is `true` and a feed post does not contain a standalone "Promoted" label
- **THEN** the post is not hidden by the promoted-post filter (other filters may still apply)

#### Scenario: Promoted posts reappear when toggle is turned off
- **WHEN** the user unchecks the `hide-promoted` toggle
- **THEN** the feed processor resets hidden posts and re-processes the feed without the promoted filter active

## ADDED Requirements

### Requirement: Hidden promoted posts are counted in daily stats
When a post is hidden by the promoted-post filter, the extension SHALL increment the daily `postsFiltered` counter and record the author in the daily blocked-authors map, consistent with the keyword-match and slop-detection paths.

#### Scenario: Promoted hide increments filtered counter
- **WHEN** `hide-promoted` is `true` and a post is hidden by the promoted-post filter
- **THEN** the daily `postsFiltered` count increments by 1

#### Scenario: Promoted hide records author in blocked-authors map
- **WHEN** a post is hidden by the promoted-post filter
- **AND** the author's vanity name is extractable from the post DOM
- **THEN** the author's count in the daily `authors` map increments by 1
