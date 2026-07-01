import { Given } from '@cucumber/cucumber'

// 6 single-sentence lines: meets MIN_LINES_FOR_PATTERN (5) and LINE_PATTERN_RATIO (0.6) — moderate stacking
const makeModerateStackPost = (extraLine = '') => {
  const lines = [
    'Leaders adapt.',
    'Teams follow.',
    'Culture shifts.',
    'Results compound.',
    'Trust builds.',
    'Progress happens.',
  ]
  return extraLine ? [...lines, extraLine].join('\n') : lines.join('\n')
}

// 16 single-sentence lines: meets HEAVY_LINE_COUNT (15) and HEAVY_LINE_RATIO (0.8) — extreme stacking
const makeExtremeStackPost = () =>
  Array.from({ length: 16 }, (_, i) => `Point ${i + 1} matters.`).join('\n')

Given('a post with moderate line stacking and no other slop signals', function () {
  this.slopText = makeModerateStackPost()
})

Given('a post with moderate line stacking and one slop phrase', function () {
  this.slopText = makeModerateStackPost('This is a game-changer.')
})

Given(
  'a post with 15 or more single-sentence lines at 80% or higher ratio and no other signals',
  function () {
    this.slopText = makeExtremeStackPost()
  }
)
