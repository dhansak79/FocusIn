import { SLOP_PHRASES, SLOP_PATTERNS, SLOP_PATTERN_LABELS } from './slop-keywords.js'

const EMOJI_THRESHOLD = 4
const HASHTAG_THRESHOLD = 5
const MIN_LINES_FOR_PATTERN = 5
const LINE_PATTERN_RATIO = 0.6
const HEAVY_LINE_COUNT = 15
const HEAVY_LINE_RATIO = 0.8

const SLOP_THRESHOLD = 2

const hasExcessiveHashtags = (text) => (text.match(/#\w+/g) ?? []).length >= HASHTAG_THRESHOLD

const countMatchingPhrases = (text) => {
  const lower = text.toLowerCase()
  return SLOP_PHRASES.filter((phrase) => lower.includes(phrase)).length
}

const hasHighEmojiDensity = (text) => {
  const standard = (text.match(/\p{Emoji_Presentation}/gu) ?? []).length
  const keycap = (text.match(/⃣/gu) ?? []).length
  return standard + keycap > EMOJI_THRESHOLD
}

const hasMarkdownFormatting = (text) =>
  // **bold** is the clearest artifact — almost never appears in real posts
  /\*\*\S[^*]*\*\*/.test(text) ||
  // Markdown headers: lines starting with one or more #
  /^#{1,3} /m.test(text) ||
  // Asterisk bullet lists: lines starting with "* text"
  /^\* \S/m.test(text)

// Two or more lines each starting with an emoji used as a bullet point.
// Common AI formatting pattern; individual emoji use in normal posts is fine.
const hasEmojiBullets = (text) => {
  const bulletLines = text
    .split('\n')
    .filter((line) => /^(\p{Emoji_Presentation}|\p{Extended_Pictographic})[ \t]/u.test(line))
  return bulletLines.length >= 2
}

// Returns 0 (no pattern), 1 (moderate stacking), or 2 (extreme stacking).
// Extreme stacking — 15+ single-sentence lines at 80%+ ratio — is suspicious
// enough to reach the slop threshold on its own.
const linePatternScore = (text) => {
  const nonEmptyLines = text.split('\n').filter((line) => line.trim().length > 0)
  if (nonEmptyLines.length < MIN_LINES_FOR_PATTERN) return 0
  const singleSentenceLines = nonEmptyLines.filter(
    (line) => line.split(/[.!?]/).length <= 2
  )
  const ratio = singleSentenceLines.length / nonEmptyLines.length
  if (ratio < LINE_PATTERN_RATIO) return 0
  if (nonEmptyLines.length >= HEAVY_LINE_COUNT && ratio >= HEAVY_LINE_RATIO) return 2
  return 1
}

// 1 phrase scores 1; 2+ score 2. A single phrase in an otherwise clean
// post should not flag it, but two dead giveaways together almost certainly
// means AI-generated content.
const phraseScore = (text) => {
  const count = countMatchingPhrases(text)
  if (count >= 2) return 2
  return count > 0 ? 1 : 0
}

// Regex patterns are high-confidence signals — a single match is enough.
const patternScore = (text) =>
  SLOP_PATTERNS.some((pattern) => pattern.test(text)) ? 2 : 0

export const getSlopScore = (text) =>
  phraseScore(text) +
  (hasHighEmojiDensity(text) ? 1 : 0) +
  (hasMarkdownFormatting(text) ? 2 : 0) +
  linePatternScore(text) +
  patternScore(text) +
  (hasEmojiBullets(text) ? 1 : 0) +
  (hasExcessiveHashtags(text) ? 1 : 0)

const BOOL_SIGNALS = [
  [hasEmojiBullets, 'emoji bullets'],
  [hasHighEmojiDensity, 'emoji overload'],
  [hasMarkdownFormatting, 'raw markdown'],
  [hasExcessiveHashtags, 'hashtag spam'],
]

const LINE_STACKING_LABELS = { 1: 'line stacking', 2: 'extreme line stacking' }

export const getSlopSignals = (text) => {
  const signals = []
  const lower = text.toLowerCase()

  // Show the actual matched phrases (up to 3), quoted
  const matchedPhrases = SLOP_PHRASES.filter((p) => lower.includes(p))
  for (const phrase of matchedPhrases.slice(0, 3)) signals.push(`"${phrase}"`)

  // Show the specific label for each matched pattern
  SLOP_PATTERNS.forEach((pattern, i) => {
    if (pattern.test(text)) signals.push(SLOP_PATTERN_LABELS[i])
  })

  for (const [check, label] of BOOL_SIGNALS) {
    if (check(text)) signals.push(label)
  }

  const lpsLabel = LINE_STACKING_LABELS[linePatternScore(text)]
  if (lpsLabel) signals.push(lpsLabel)
  return signals
}

export const isSlop = (text) => getSlopScore(text) >= SLOP_THRESHOLD
