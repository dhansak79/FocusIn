## 1. Implementation

- [x] 1.1 Add `const HASHTAG_THRESHOLD = 5` constant to `src/features/slop-detector.js` alongside the existing threshold constants
- [x] 1.2 Add `const hasExcessiveHashtags = (text) => (text.match(/#\w+/g) ?? []).length >= HASHTAG_THRESHOLD` function
- [x] 1.3 Add `+ (hasExcessiveHashtags(text) ? 1 : 0)` to the `getSlopScore` return expression
- [x] 1.4 Add `if (hasExcessiveHashtags(text)) signals.push('hashtag spam')` to `getSlopSignals`

## 2. Tests

- [x] 2.1 Add a test in `tests/features/slop-detector.test.js` for "Post with exactly 5 hashtags triggers the signal" (boundary: score includes 1 point, signals includes "hashtag spam")
- [x] 2.2 Add a test for "Post with 4 hashtags does not trigger the signal" (boundary below threshold)
- [x] 2.3 Add a test for "Post with 10 hashtags triggers the signal" (well above threshold)
- [x] 2.4 Add a test for "Post with no hashtags is not affected"
- [x] 2.5 Add a test for "Hashtag signal + one other signal reaches isSlop threshold"
- [x] 2.6 Run `npm test && npm run coverage` and confirm both pass with no regressions
