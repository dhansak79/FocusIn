## ADDED Requirements

### Requirement: Author vanity name extracted alongside display name
The banner construction logic SHALL extract the author's LinkedIn vanity name (profile slug) from the `/in/username/` href in the post DOM alongside the display name, making it available for the Unfollow button.

#### Scenario: Vanity name extracted when profile link present
- **WHEN** a post is collapsed into any banner type
- **AND** the post DOM contains a profile href in the form `/in/username/`
- **THEN** the extracted vanity name is available to the banner for constructing the Unfollow request

#### Scenario: Vanity name absent when no profile link in DOM
- **WHEN** a post is collapsed into any banner type
- **AND** the post DOM does not contain an extractable `/in/username/` href
- **THEN** vanity name extraction returns null and no Unfollow button is rendered
