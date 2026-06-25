## Context

`isPromotedPost` in `src/features/feed.js` (line 255) requires `data-testid="expandable-text-box"` to be present before it will match any element. When that node is absent (image-only ads, video ads, reshared sponsored posts), the `textBox && ...` guard short-circuits the loop body to false on every iteration and the function returns false unconditionally. The promoted branch in `applyKeywordToPost` (line 423) then calls `hidePost()` and returns immediately — no stats call, no author tracking — unlike every other filtering path.

## Goals / Non-Goals

**Goals:**
- `isPromotedPost` detects "Promoted" labels in posts regardless of whether `expandable-text-box` is present.
- Hiding a promoted post increments `postsFiltered` and records the author in the daily blocked-authors map, consistent with keyword and slop paths.

**Non-Goals:**
- Not changing the whitelist check for promoted posts (covered by `fix-whitelist-bypass-promoted-keyword`).
- Not changing the CSS hiding mechanism or user-visible appearance.
- Not capturing any new signals or banner for promoted posts (they remain fully hidden, not soft-collapsed).

## Decisions

**DOM detection: use optional chaining to drop the `textBox` precondition** — Replace `textBox && !textBox.contains(el)` with `!textBox?.contains(el)`. When `textBox` is null, `textBox?.contains(el)` evaluates to `undefined`; `!undefined` is `true`, so the sole remaining test is `el.textContent.trim() === 'Promoted'`. When `textBox` is present the original exclusion still applies. This is a one-token change that preserves the existing precise-matching logic and avoids introducing new selector dependencies on LinkedIn's unstable class names.

Alternative considered: checking `!el.closest('.feed-shared-update-v2__description, article')` as a fallback exclusion anchor. Rejected — would couple the detector to class names that LinkedIn changes frequently, and the `=== 'Promoted'` equality check is already tight enough to prevent false positives on posts that merely mention the word.

**Stats: call `countOnce` and `trackAuthorBlocked` in the promoted branch before the early return** — The `countOnce` guard already prevents double-counting; `trackAuthorBlocked` is safe to call with a null vanity (it no-ops when both vanity and display name are absent). Extract `vanity` and `name` before the return, matching the pattern used in the keyword branch (lines 431–432). Note: this coordinates with `fix-whitelist-bypass-promoted-keyword`, which inserts a whitelist guard before the `hidePost` call — the stats calls must come after that guard so whitelisted authors are not counted.

## Popup XSS: HTML-escape dynamic values in stats-renderer

`stats-renderer.js` builds innerHTML via template literals in two places:
- Line 14: `${name}` — author display names sourced from LinkedIn DOM via `extractAuthorName`, stored in `chrome.storage.local`, and rendered on every popup open. A LinkedIn profile with an HTML-injected display name (e.g. `<img src=x onerror=…>`) would execute in the extension popup context.
- Line 31: `${signal}` — slop-signal strings from `SLOP_PHRASES`/pattern names. These are hardcoded constants today, but the pattern is unsafe and should be treated consistently.

**Decision: introduce a local `escapeHtml(str)` helper in `stats-renderer.js`** — one function, four characters replaced (`&`, `<`, `>`, `"`). Apply it to every dynamic value before insertion into the template literals. No third-party dependency needed.

Alternative considered: replace innerHTML with DOM construction (`createElement` + `textContent`). This is safer but significantly increases code size and complexity for a file that's currently 35 lines. The escaping helper achieves the same security goal with minimal change.

## Risks / Trade-offs

[Risk: `=== 'Promoted'` matches if a post contains a standalone `<span>Promoted</span>` in its body text] → Low probability — LinkedIn renders the promoted label as a distinct DOM subtree outside post content, and the equality check (not substring) makes accidental matches unlikely. If LinkedIn ever puts "Promoted" in body text as a standalone element, a future iteration can add a positional guard.

[Risk: stats ordering with the whitelist fix] → The two changes touch the same code block. Implementation of this change should be applied after `fix-whitelist-bypass-promoted-keyword` so the whitelist guard is already in place at the stats call site.
