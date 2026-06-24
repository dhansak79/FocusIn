## Context

FocusIn is a LinkedIn content-script extension. The feed processor in `src/features/feed.js` iterates over feed posts via a `MutationObserver` and applies keyword, slop, semantic, and tone filters. Each filter is driven by a boolean/string value passed into `blockPosts()` from the config loaded in `src/index.js`.

LinkedIn marks promoted posts with a visible `<span>Promoted</span>` text node in the post header area (confirmed from the DOM sample provided by the user — the `<p componentkey="c8813a2e-..."><span>Promoted</span></p>` element).

## Goals / Non-Goals

**Goals:**
- Let users toggle hiding of promoted/sponsored posts from their LinkedIn feed.
- Detection must be purely DOM-based (no model download, no network request).
- Hidden promoted posts should be fully removed from view (not soft-collapsed — users don't need a "show anyway" banner for ads).
- Toggle state persists across browser sessions via `chrome.storage.local`.

**Non-Goals:**
- Counting promoted posts in the stats/damage report (out of scope for this change).
- Detecting promoted posts outside the main feed (e.g. sidebar widgets, InMail).
- Any "whitelist" for promoted posts.

## Decisions

### Detection: text-content scan vs. element selector

**Decision:** Use `post.textContent.includes('Promoted')` combined with a structural guard to avoid false positives.

**Rationale:** LinkedIn's obfuscated class names change frequently. Searching for the literal string "Promoted" in the post's text is resilient to class-name churn. The `<span>Promoted</span>` text is rendered by LinkedIn for the user to read and is stable across locales (LinkedIn uses "Promoted" in English; international considerations are out of scope for now).

**False-positive risk and mitigation:** A post whose body text happens to include the word "Promoted" could be incorrectly hidden. We mitigate this by checking that the word appears as a standalone paragraph-level element within the post header area, not buried in the post body. Specifically: any `<p>` or `<span>` inside the post that whose trimmed `textContent === 'Promoted'` and appears before the post body text element (identified by `[data-testid="expandable-text-box"]`) qualifies as a promotion label.

**Alternative considered:** CSS selector on known class patterns. Rejected because LinkedIn's generated class names (`_930bef0b`, etc.) are content-addressed hashes and will change on any LinkedIn deploy.

### Hide style: full `display:none` vs. existing `hide` class

**Decision:** Reuse `hidePost(post, 'hide')` (the same call used for keyword matches) which applies the existing CSS `.hide { display: none }` rule.

**Rationale:** Consistency with existing filter behaviour. No banner is needed for ads.

### UI placement

**Decision:** Add a new `<div class="divider">Ads</div>` section in `popup.html` above the existing "AI content" divider, with a single toggle `id="hide-promoted"`.

**Rationale:** Matches the existing popup pattern. No JS changes needed in `popup.js` — the existing generic `.switch` change listener and `chrome.storage.local.get` loop already handle any checkbox whose `id` matches a storage key.

## Risks / Trade-offs

- **LinkedIn DOM changes** → The "Promoted" text check could break if LinkedIn changes the label text or structure. Mitigation: the check is simple enough to fix in minutes when reported.
- **Locale sensitivity** → Non-English LinkedIn users may see a different word than "Promoted". Out of scope; can be addressed in a follow-up by checking multiple locales.
- **No stats tracking** → Promoted posts hidden this way are not counted in the damage report. Acceptable for v1; can be added later.
