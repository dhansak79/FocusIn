import { SLOP_PHRASES } from './slop-keywords.js'

const EMOJI_THRESHOLD = 4
const MIN_LINES_FOR_PATTERN = 5
const LINE_PATTERN_RATIO = 0.6
const HEAVY_LINE_COUNT = 15
const HEAVY_LINE_RATIO = 0.8

export const SLOP_THRESHOLD = 2

const hasSlopPhrase = (text) => {
  const lower = text.toLowerCase()
  return SLOP_PHRASES.some((phrase) => lower.includes(phrase))
}

const hasHighEmojiDensity = (text) =>
  (text.match(/\p{Emoji_Presentation}/gu) ?? []).length > EMOJI_THRESHOLD

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
  (hasSlopPhrase(text) ? 1 : 0) +
  (hasHighEmojiDensity(text) ? 1 : 0) +
  linePatternScore(text)

export const getSlopSignals = (text) => {
  const signals = []
  if (hasSlopPhrase(text)) signals.push('buzzword phrases')
  if (hasHighEmojiDensity(text)) signals.push('emoji overload')
  const lps = linePatternScore(text)
  if (lps === 2) signals.push('extreme line stacking')
  else if (lps === 1) signals.push('line stacking')
  return signals
}

export const isSlop = (text) => getSlopScore(text) >= SLOP_THRESHOLD
