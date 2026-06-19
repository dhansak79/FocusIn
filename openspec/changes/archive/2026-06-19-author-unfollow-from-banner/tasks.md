## 1. Investigation (prerequisite)

- [x] 1.1 Capture request headers — confirmed: `Content-Type: application/json`, `csrf-token: <JSESSIONID cookie value>`, `x-li-rsc-stream: true`, `x-li-anchor-page-key: d_flagship3_feed`
- [x] 1.2 Test a minimal payload (omit `updateKey.items`, `memberNonIterableProfileId`, `controlActionContainerType`, `x-li-page-instance` header) — confirmed 200 OK, these fields are not required
- [x] 1.3 DOM inspection confirmed no numeric member ID in post DOM — vanity name (from `/in/username/` href) is sufficient; tested vanity-name-only payload, confirmed 200 OK

## 2. Author vanity name extraction

- [x] 2.1 Add `extractAuthorVanityName(post)` function in `src/features/feed.js` that reads the vanity name from the first `/in/username/` href in the post's actor card
- [x] 2.2 Update all three banner construction paths to pass both display name and vanity name from extraction

## 3. Unfollow API call

- [x] 3.1 Add `unfollowAuthor(vanityName)` function (in `feed.js` or new `src/features/unfollow.js`) that reads the CSRF token from the `JSESSIONID` cookie and POSTs the minimal confirmed payload (`followStateType`, `memberUrnTypeName`, `memberVanityName`, `isSponsored: false`) to `/flagship-web/rsc-action/actions/server-request?sduiid=com.linkedin.sdui.requests.feed.updateFollowState`
- [x] 3.2 Return a promise that resolves on 2xx and rejects on non-2xx or network error

## 4. Unfollow button in banners

- [x] 4.1 Add Unfollow button to `addRevealBanner` (AI-generated post banner) — render only when URN is non-null, place after author element, before "Show anyway"
- [x] 4.2 Add Unfollow button to `buildSemanticCollapseBanner` (semantic match and pattern match banners) using the same pattern
- [x] 4.3 Wire button click to `unfollowAuthor(urn)`: disable button on click (loading state), show "Unfollowed" label on success, show error indicator and re-enable on failure

## 5. Tests and safeguard

- [x] 5.1 Unit tests for `extractAuthorVanityName`: vanity name returned when `/in/username/` href present, null returned when absent
- [x] 5.2 Unit tests for `unfollowAuthor`: correct fetch constructed (right URL, headers, payload shape), success resolves, non-2xx rejects
- [x] 5.3 DOM tests for Unfollow button: present when vanity name extractable, absent when not, transitions through loading/success/error states
- [x] 5.4 Run `npm test && npm run coverage` — both must exit 0
- [x] 5.5 Run `pre_commit_code_health_safeguard` — resolve any regressions before committing
