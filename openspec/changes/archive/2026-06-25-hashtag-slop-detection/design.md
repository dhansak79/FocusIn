## Context

The slop detector (`src/features/slop-detector.js`) accumulates a score from independent signals — phrase matching, regex patterns, emoji density, emoji bullets, markdown formatting, line stacking — and fires when the total reaches `SLOP_THRESHOLD = 2`. Each signal contributes 1 or 2 points. The hashtag-spam pattern (a dump of 5+ hashtags, typically at the post end) has no representation in the current signal set.

LinkedIn hashtags are parsed by the feed DOM as plain text (they are not rendered as special elements in `extractPostText` output), so detection must work on the raw text string.

## Goals / Non-Goals

**Goals:**
- Posts with 5 or more hashtags contribute 1 slop point.
- The signal label `"hashtag spam"` appears in `getSlopSignals` output when it fires, so it shows in collapse banners.
- The threshold constant is named and isolated, matching the style of `EMOJI_THRESHOLD`.

**Non-Goals:**
- Not distinguishing hashtag position (end-of-post block vs. inline) — the count alone is the signal.
- Not scoring heavier for extreme counts (10+) — 1 point keeps it consistent with other moderate signals and avoids over-weighting a single dimension.
- Not removing or blocking posts that only have hashtags with no other slop signal — a single 1-point signal does not reach the threshold on its own.

## Decisions

**Regex-based count: `(text.match(/#\w+/g) ?? []).length`** — simple, no dependencies, works on extracted post text. Matches any `#word` token. LinkedIn hashtag syntax requires at least one word character after `#`, so this does not match standalone `#` symbols.

Alternative considered: counting only hashtags appearing after the last paragraph break (end-of-post block detection). Rejected — adds complexity and the count-based approach is already precise enough; a post genuinely using 5+ hashtags inline is just as AI-typical as one with them at the end.

**Threshold: `HASHTAG_THRESHOLD = 5`** — 1–4 hashtags are plausible in human posts (topic tags, branded content); 5+ is the threshold where the pattern becomes unusual. Matches the `EMOJI_THRESHOLD = 4` precedent (4 emojis triggers the signal).

**Score weight: 1 point** — consistent with `hasHighEmojiDensity` and `hasEmojiBullets`. A post with only a hashtag block is likely low-quality but not definitively AI; combined with one other signal (a slop phrase, emoji bullets, etc.) it crosses the threshold.

## Risks / Trade-offs

[Risk: false positive on legitimate niche content creators who routinely tag 5+ topics] → Low impact — such posts will need a second signal to collapse, and the reveal banner lets users see them anyway. No posts are permanently hidden by the slop detector.

[Risk: LinkedIn changes hashtag rendering so they no longer appear as `#word` in extracted text] → Mitigated by the fact that `extractPostText` reads `textContent`, which preserves `#word` tokens regardless of DOM wrapping.
