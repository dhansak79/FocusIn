## Why

AI-generated LinkedIn posts routinely dump 5–15 hashtags at the end as a block — a pattern almost no real person uses, since hashtags on LinkedIn provide negligible discoverability benefit. The slop detector currently has no hashtag signal, so a post whose only tell is a wall of hashtags passes through undetected.

## What Changes

- Add a `hasExcessiveHashtags(text)` signal to `slop-detector.js` that scores 1 point when a post contains 5 or more hashtags.
- Add `"hashtag spam"` to the signals list returned by `getSlopSignals` when the signal fires.
- Add the signal to `getSlopScore` alongside the existing emoji density, emoji bullets, line stacking, and markdown signals.

## Capabilities

### New Capabilities

- `hashtag-slop-signal`: The slop detector SHALL identify posts with 5 or more hashtags as carrying a hashtag-spam signal worth 1 slop point, reflected in both the score and the signals list.

### Modified Capabilities

_(none — no existing spec covers slop detection)_

## Impact

- **`src/features/slop-detector.js`** — new `hasExcessiveHashtags` function, updated `getSlopScore` and `getSlopSignals`.
- **`tests/features/slop-detector.test.js`** — new test cases for hashtag signal boundary conditions.
- No new storage keys, no API changes, no UI changes.
