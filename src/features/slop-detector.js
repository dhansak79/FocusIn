import { SLOP_PHRASES, SLOP_PATTERNS } from './slop-keywords.js'

const EMOJI_THRESHOLD = 4
const MIN_LINES_FOR_PATTERN = 5
const LINE_PATTERN_RATIO = 0.6
const HEAVY_LINE_COUNT = 15
const HEAVY_LINE_RATIO = 0.8

export const SLOP_THRESHOLD = 1

const countSlopPhrases = (text) => {
  const lower = text.toLowerCase()
  return (
    SLOP_PHRASES.filter((phrase) => lower.includes(phrase)).length +
    SLOP_PATTERNS.filter((pattern) => pattern.test(text)).length
  )
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

export const getSlopScore = (text) =>
  (countSlopPhrases(text) > 0 ? SLOP_THRESHOLD : 0) +
  (hasHighEmojiDensity(text) ? 1 : 0) +
  (hasMarkdownFormatting(text) ? 1 : 0) +
  linePatternScore(text)

export const getSlopSignals = (text) => {
  const signals = []
  const phraseCount = countSlopPhrases(text)
  if (phraseCount > 0) signals.push(`buzzword phrases (${phraseCount})`)
  if (hasHighEmojiDensity(text)) signals.push('emoji overload')
  if (hasMarkdownFormatting(text)) signals.push('raw markdown')
  const lps = linePatternScore(text)
  if (lps === 2) signals.push('extreme line stacking')
  else if (lps === 1) signals.push('line stacking')
  return signals
}

export const isSlop = (text) => getSlopScore(text) >= SLOP_THRESHOLD
