## Why

Seeing an author's name on the banner is useful, but acting on it still requires navigating away to unfollow them on LinkedIn. An unfollow button on the banner closes that loop — one click removes the source of noise without leaving the feed.

## What Changes

- An **Unfollow** button is added to AI-generated post, semantic match, and pattern match collapse banners, but only when an author name is present
- Clicking Unfollow fires LinkedIn's own unfollow API call (reverse-engineered from network traffic) directly from the content script, using session credentials already present in the browser
- On success, the banner updates to confirm the unfollow; on failure, a brief error state is shown
- The author's LinkedIn member URN must be extracted from the post DOM alongside their name to construct the API call

## Capabilities

### New Capabilities
- `author-unfollow`: Unfollow a post author directly from a collapse banner via LinkedIn's internal API

### Modified Capabilities
- `banner-author-display`: Author display now also surfaces the author's LinkedIn URN from the DOM, required to construct the unfollow request

## Impact

- `src/features/feed.js`: Author extraction needs to return both name and member URN; banner construction for all three banner types needs an Unfollow button wired to the API call
- `src/features/feed.js` or new `src/features/unfollow.js`: Logic to construct and fire the LinkedIn unfollow API request
- LinkedIn's internal Voyager API (`api.linkedin.com/voyager/api/`) — no new external dependencies, but relies on undocumented endpoints that may change
- `manifest.json`: May need `api.linkedin.com` added to `host_permissions` if not already covered
