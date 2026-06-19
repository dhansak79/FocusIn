## Context

The collapse banners now display the post author's name. The natural next step is making that name actionable. Network inspection reveals that LinkedIn's unfollow action is handled by their React Server Components (RSC) action dispatcher — not a simple Voyager REST endpoint.

**Confirmed endpoint (from DevTools):**
```
POST https://www.linkedin.com/flagship-web/rsc-action/actions/server-request
     ?sduiid=com.linkedin.sdui.requests.feed.updateFollowState
     &parentSpanId=<tracing-id>
```

**Confirmed payload shape:**
```json
{
  "requestId": "com.linkedin.sdui.requests.feed.updateFollowState",
  "serverRequest": {
    "requestId": "com.linkedin.sdui.requests.feed.updateFollowState",
    "requestedArguments": {
      "$type": "proto.sdui.actions.requests.RequestedArguments",
      "payload": {
        "followStateType": "FollowStateType_UNFOLLOW",
        "memberUrn": { "memberId": "<numeric-member-id>" },
        "memberUrnTypeName": "proto_com_linkedin_common_MemberUrn",
        "memberVanityName": "<profile-slug>",
        "memberNonIterableProfileId": "<opaque-base64-id>",
        "memberFirstName": "...",
        "memberLastName": "...",
        "isSponsored": false,
        "updateKey": { ... },
        "controlActionContainerType": { ... }
      }
    }
  }
}
```

The numeric `memberId` (e.g. `6695917`) is the key identifier. It is extractable from `urn:li:member:NNNN` URN attributes embedded in LinkedIn's post DOM (e.g. `data-actor-urn`).

`memberNonIterableProfileId` is an opaque base64 ID whose requirement status is unconfirmed — it may be optional tracking context. Similarly, `updateKey.items` (activity URNs of the triggering posts) appears to be feed-state context for LinkedIn's UI update, not required for the actual unfollow action.

**Confirmed request headers (from DevTools):**
- `Content-Type: application/json`
- `csrf-token: <JSESSIONID cookie value>` — the CSRF token is exactly the value of the `JSESSIONID` cookie, extractable via `document.cookie`
- `x-li-rsc-stream: true` — required for the RSC action dispatcher
- `x-li-anchor-page-key: d_flagship3_feed` — static string for the feed page
- `x-li-page-instance: urn:li:page:d_flagship3_feed;<tracking-id>` — dynamic; may be readable from page meta tags or can be omitted in initial testing

Headers like `x-li-traceparent`, `x-li-tracestate`, `x-li-track`, and `x-li-application-version` are distributed tracing and analytics — not expected to be required for the action to succeed.

Current author extraction (`extractAuthorName`) returns a display name string only. Implementation requires extending extraction to also return the numeric `memberId` and, if confirmed required, `memberNonIterableProfileId`.

## Goals / Non-Goals

**Goals:**
- Add an Unfollow button to all three banner types when author info is present
- Fire LinkedIn's Voyager unfollow API from the content script using existing session credentials
- Show loading, success, and error states on the button

**Non-Goals:**
- Re-following (no undo from within the extension)
- Storing a local list of unfollowed authors
- Clicking through LinkedIn's native dropdown UI (too brittle)
- Supporting unfollow from the popup or any surface other than the banner

## Decisions

**RSC action over Voyager REST:** Network inspection confirmed the endpoint is LinkedIn's SDUI RSC action dispatcher, not a Voyager REST endpoint. The payload is a JSON envelope wrapping a protobuf-style action descriptor.

**Same-origin fetch from content script:** The endpoint is on `www.linkedin.com`, the same origin the content script runs on. `fetch('/flagship-web/rsc-action/...')` with `credentials: 'include'` picks up session cookies automatically. No additional `host_permissions` or service worker relay required.

**CSRF token from JSESSIONID cookie:** The `csrf-token` header value is exactly the `JSESSIONID` cookie value (e.g. `ajax:7142657973523399370`). Extract with a `document.cookie` regex match on `JSESSIONID="?([^";]+)` and pass as the `csrf-token` header.

**Vanity name as the sole identifier:** DOM inspection confirmed no numeric member ID exists anywhere in LinkedIn's SDUI post DOM. Testing confirmed the API accepts `memberVanityName` alone (no `memberUrn.memberId`) and returns 200. The vanity name is extractable from the `/in/username/` href already present in the actor card. This simplifies extraction significantly — no companion function needed beyond reading the href.

**Minimal payload strategy:** Send only confirmed-required fields. Start with `followStateType`, `memberUrn.memberId`, `memberUrnTypeName`, `memberVanityName`, and `memberFirstName`/`memberLastName`. Omit or stub `updateKey.items` and `memberNonIterableProfileId` until confirmed required by testing — if the API rejects the minimal payload, add fields incrementally.

**Button placement:** Rendered after the author name element, before "Show anyway", in all three banner construction paths. Visually distinct from "Show anyway" (smaller, secondary style).

## Risks / Trade-offs

- [LinkedIn API change] → The Voyager endpoint is undocumented and can change without notice. The button silently fails (shows error state) rather than breaking the page, and can be fixed by re-inspecting network traffic.
- [URN not in DOM] → Some post types may not embed the author URN. Mitigation: gate the Unfollow button on URN presence; degrade gracefully to name-only display.
- [CSRF token format change] → If LinkedIn changes how the CSRF token is exposed, the request will 403. Mitigation: error state on the button; no broader breakage.
- [Irreversibility] → Unfollow on LinkedIn is permanent until the user manually re-follows. Mitigation: button label and confirmation state make this clear.

## Open Questions

1. ~~**Request headers**~~ — **Resolved**: `Content-Type: application/json`, `csrf-token: <JSESSIONID value>`, `x-li-rsc-stream: true`, `x-li-anchor-page-key: d_flagship3_feed`
2. ~~**`memberNonIterableProfileId` required?**~~ — **Resolved**: not required, confirmed 200 OK without it.
3. ~~**`updateKey.items` required?**~~ — **Resolved**: not required, confirmed 200 OK without it.
4. ~~**`x-li-page-instance` required?**~~ — **Resolved**: not required, confirmed 200 OK without it.
5. ~~**`memberId` DOM location**~~ — **Resolved**: numeric member ID is not in the DOM. Vanity name from `/in/username/` href is sufficient and confirmed working.
6. **Confirmation step**: Immediate action with "Unfollowed" success label, or two-step confirm? → Recommend immediate; irreversibility is clear from the button label.
