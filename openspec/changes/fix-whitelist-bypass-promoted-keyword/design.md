## Context

`applyKeywordToPost` in `src/features/feed.js` is the central post-processing function. It evaluates three independent filter paths in order: (1) promoted-post, (2) keyword-match, (3) slop/semantic. The whitelist guard was added in commit 96b6923 inside `applySlopDecision` (path 3) and `makeSemanticApplier`, but the two earlier branches return before reaching it. The fix is to extract the vanity name once at the top of `applyKeywordToPost` and short-circuit both early branches.

## Goals / Non-Goals

**Goals:**
- Whitelisted authors' posts are never hidden by any path in `applyKeywordToPost`
- The fix is minimal, touches one function, and does not change any other behaviour

**Non-Goals:**
- Not addressing the stats/tracking omission for promoted posts (separate issue)
- Not refactoring `applyKeywordToPost` beyond the guard insertions

## Decisions

**Single vanity lookup at function entry** — `extractAuthorVanityName(post)` is called once at the top and reused for the two new guards and the existing `trackAuthorBlocked` call (which already receives it). This avoids adding a second DOM query.

**Guard placement: before side-effects, not after** — The guard `if (vanity && whitelisted.has(vanity)) return` is placed immediately before each hiding call, matching the existing pattern in `applySlopDecision` (line 411). Placing it after `postsProcessed++` is intentional: we still want the post counted as processed for scroll-advance purposes, just not hidden.

**No changes to `isPromotedPost` or the keyword-match logic** — This change only adds early-return guards. Detection logic is unchanged.

## Risks / Trade-offs

[Risk: vanity is null for posts where LinkedIn doesn't expose a /in/ link] → Mitigation: the guard is `vanity && whitelisted.has(vanity)` — a null vanity safely falls through to the existing behaviour, same as `applySlopDecision` line 411.
