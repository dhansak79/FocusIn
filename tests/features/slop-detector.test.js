import { describe, it, expect } from 'vitest'
import { getSlopScore, getSlopSignals, isSlop, SLOP_THRESHOLD } from '../../src/features/slop-detector.js'

// ---------------------------------------------------------------------------
// Phrase signal — binary: any matching phrase scores SLOP_THRESHOLD (triggers alone)
// ---------------------------------------------------------------------------

describe('getSlopScore - slop phrases', () => {
  it('scores 0 for a clean post with no slop signals', () => {
    expect(getSlopScore('Had a great meeting today. Really enjoyed the discussion about our roadmap.')).toBe(0)
  })

  it('scores SLOP_THRESHOLD when a known slop phrase is present', () => {
    expect(getSlopScore("In today's fast-paced world, we need to adapt.")).toBeGreaterThanOrEqual(SLOP_THRESHOLD)
  })

  it('triggers for "let that sink in"', () => {
    expect(isSlop('Let that sink in.')).toBe(true)
  })

  it('triggers for "game-changer"', () => {
    expect(isSlop('This tool is a game-changer for productivity.')).toBe(true)
  })

  it('triggers for "thought leadership"', () => {
    expect(isSlop('Real thought leadership is rare these days.')).toBe(true)
  })

  it('triggers for "key takeaways"', () => {
    expect(isSlop('Key takeaways from the conference:')).toBe(true)
  })

  it('a single phrase match alone crosses the slop threshold', () => {
    expect(isSlop("In today's fast-paced world, we need to adapt.")).toBe(true)
  })

  it('phrase score is the same regardless of how many phrases match', () => {
    const one = getSlopScore("In today's fast-paced world, adapting is key.")
    const five = getSlopScore("In today's fast-paced world, let that sink in. Game-changer! Leverage thought leadership. Key takeaways.")
    expect(one).toBe(five)
  })
})

// ---------------------------------------------------------------------------
// Emoji density signal — 1 point when emoji count exceeds threshold
// ---------------------------------------------------------------------------

describe('getSlopScore - emoji density', () => {
  it('scores 0 for a post with one emoji', () => {
    expect(getSlopScore('Great news! 🎉 We launched our product today.')).toBe(0)
  })

  it('scores 0 for a post with two emojis', () => {
    expect(getSlopScore('Excited 🎉 to share this 🚀 with everyone.')).toBe(0)
  })

  it('scores above 0 for a post with many emojis', () => {
    expect(getSlopScore('🚀 Big news! 💡 Think about it! 🔥 So hot! 💪 Strong! ⚡ Fast! 🎯 On target!')).toBeGreaterThan(0)
  })

  it('emoji signal is independent — adds to phrase score when both present', () => {
    const phraseOnly = getSlopScore("In today's fast-paced world we need to adapt.")
    const emojiOnly  = getSlopScore('🚀 Go! 💡 Think! 🔥 Hot! 💪 Strong! ⚡ Fast! 🎯 Win!')
    const both       = getSlopScore("🚀 In today's fast-paced world! 💡 Think! 🔥 Hot! 💪 Yes! ⚡ Fast! 🎯 Win!")
    expect(both).toBeGreaterThan(phraseOnly)
    expect(both).toBeGreaterThan(emojiOnly)
  })
})

// ---------------------------------------------------------------------------
// Line pattern signal — 1 point when ≥5 lines and most are single sentences
// ---------------------------------------------------------------------------

describe('getSlopScore - single sentence per line', () => {
  it('scores 0 for normal paragraph text on one line', () => {
    const text = 'This is a normal post. It has multiple sentences on the same line. Nothing unusual about the formatting at all.'
    expect(getSlopScore(text)).toBe(0)
  })

  it('scores 0 for a post with only two lines', () => {
    expect(getSlopScore(['Short thought.', 'Two lines total.'].join('\n'))).toBe(0)
  })

  it('scores above 0 when most lines contain a single short sentence', () => {
    const text = [
      'This is the hook.',
      'Here is the second thought.',
      'And the third.',
      'Another single line.',
      'This keeps going.',
      'One final line.',
    ].join('\n')
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })

  it('scores above 0 for the classic LinkedIn one-liner stacking pattern', () => {
    const text = [
      'I used to work 80 hours a week.',
      '',
      'Then I learned one thing.',
      '',
      'It changed everything.',
      '',
      'Here is what nobody tells you.',
      '',
      'Stop trying so hard.',
    ].join('\n')
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })

  it('does not penalise a long paragraph that happens to have many sentences', () => {
    const text = 'We shipped a major update today. The team spent six months on this. We rewrote the core engine from scratch. Performance improved by 40%. Users noticed immediately. The feedback has been incredible.'
    expect(getSlopScore(text)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Boundary conditions — targeted mutant killers
// ---------------------------------------------------------------------------

describe('getSlopScore - emoji threshold boundary', () => {
  it('scores 0 with exactly the threshold number of emojis', () => {
    // EMOJI_THRESHOLD = 4 — need strictly more than 4 to trigger
    expect(getSlopScore('🚀 Launch 💡 Idea 🔥 Fire 💪 Strong')).toBe(0)
  })

  it('scores above 0 with one more emoji than the threshold', () => {
    expect(getSlopScore('🚀 Launch 💡 Idea 🔥 Fire 💪 Strong ⚡ Fast')).toBeGreaterThan(0)
  })
})

describe('getSlopScore - line pattern boundary', () => {
  it('scores 0 when real content lines are below the minimum despite many empty lines', () => {
    // Only 4 non-empty lines — empty lines must not count toward the minimum
    const text = ['One.', '', '', '', '', '', '', 'Two.', 'Three.', 'Four.'].join('\n')
    expect(getSlopScore(text)).toBe(0)
  })

  it('scores 0 when fewer than the minimum ratio of lines are single-sentence', () => {
    // 1 single-sentence line out of 5 = 20% — well below the 60% threshold
    const text = [
      'Just one single line.',
      'This has two sentences. Then more here.',
      'Opening thought. Closing thought.',
      'First point. Second point added.',
      'Yet another multi. Sentence line.',
    ].join('\n')
    expect(getSlopScore(text)).toBe(0)
  })

  it('scores above 0 when exactly the minimum ratio of lines are single-sentence', () => {
    // 3 single-sentence lines out of 5 = exactly 60% = LINE_PATTERN_RATIO
    const text = [
      'Single thought here.',
      'Another single thought.',
      'One more single line.',
      'This has two sentences. Yes it does.',
      'This also has two. And more here.',
    ].join('\n')
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Heavy line stacking — extreme one-liner posts score 2 on their own
// ---------------------------------------------------------------------------

describe('getSlopScore - heavy line stacking', () => {
  it('scores 2 for a post with many short single-sentence lines and no other signals', () => {
    // Classic LinkedIn hook-bait: 20+ single-sentence lines, no phrases, no emojis
    const post = [
      'Fear charges high interest.',
      "But it's not fear's fault.",
      'Fear has one job.',
      'Protect you from the unknown.',
      'The problem?',
      'When you cannot see a path forward everything feels dangerous.',
      'A conversation.',
      'A career move.',
      'A new opportunity.',
      'A difficult decision.',
      'The less clarity you have the bigger the fear becomes.',
      'Your mind fills in the blanks.',
      'Worst-case scenarios.',
      'Regret.',
      'Failure.',
      'Loss.',
      'Not because the risk is higher.',
      'Because you cannot evaluate it.',
      'But something changes when you have a method.',
      'When you can see your options.',
    ].join('\n')
    expect(getSlopScore(post)).toBeGreaterThanOrEqual(2)
  })

  it('scores only 1 for moderate stacking (5–14 lines)', () => {
    const post = [
      'This is the hook.',
      'Here is the second thought.',
      'And the third.',
      'Another single line.',
      'This keeps going.',
      'One final line.',
    ].join('\n')
    expect(getSlopScore(post)).toBe(1)
  })

  it('flags a heavy stacker as slop even without phrases or emojis', () => {
    const post = Array.from({ length: 20 }, (_, i) => `Line number ${i + 1}.`).join('\n')
    expect(isSlop(post)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Signal accumulation
// ---------------------------------------------------------------------------

describe('getSlopScore - multiple signals accumulate', () => {
  it('two signals score higher than one', () => {
    const oneSignal = getSlopScore("In today's fast-paced world, we need to adapt.")
    const twoSignals = getSlopScore([
      "In today's fast-paced world.",
      'Let that sink in.',
      'Think about it.',
      'Really think.',
      'Game-changer.',
      '🚀 💡 🔥 💪 ⚡ 🎯 🌟',
    ].join('\n'))
    expect(twoSignals).toBeGreaterThan(oneSignal)
  })
})

// ---------------------------------------------------------------------------
// isSlop — threshold gate (2+ signals required)
// ---------------------------------------------------------------------------

describe('isSlop', () => {
  it('returns false for a clean post', () => {
    expect(isSlop('Just shipped a new feature today. The team worked really hard on it and I am proud of what we built.')).toBe(false)
  })

  it('returns true when a single slop phrase is present', () => {
    expect(isSlop("In today's fast-paced world, we need to adapt.")).toBe(true)
  })

  it('returns false when no signals are present', () => {
    expect(isSlop('We shipped a new feature today. The team is proud of the work done.')).toBe(false)
  })

  it('returns true for a post combining phrase slop with high emoji density', () => {
    expect(isSlop('🚀 Game-changer! 💡 Thought leadership! 🔥 Leverage! 💪 Synergy! ⚡ Fast! 🎯 Win!')).toBe(true)
  })

  it('returns true for a post combining phrase slop with the one-liner pattern', () => {
    const post = [
      "In today's fast-paced world.",
      'Thought leadership matters.',
      'Let that sink in.',
      'Game-changer.',
      'Leverage your potential.',
      'Key takeaways below.',
    ].join('\n')
    expect(isSlop(post)).toBe(true)
  })

  it('returns true for a post combining emoji density with the one-liner pattern', () => {
    const post = [
      '🚀 Big move.',
      '💡 Smart idea.',
      '🔥 On fire.',
      '💪 Stay strong.',
      '⚡ Move fast.',
      '🎯 Hit targets.',
    ].join('\n')
    expect(isSlop(post)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Keycap emoji numbers — 1️⃣–9️⃣ use U+20E3 which \p{Emoji_Presentation} misses
// ---------------------------------------------------------------------------

describe('getSlopScore - keycap emoji numbers', () => {
  it('counts 5 keycap emojis as exceeding the emoji threshold', () => {
    // All on one line so line stacking cannot score — only emoji signal fires
    // 1️⃣–5️⃣ each contain U+20E3 (Combining Enclosing Keycap), threshold is >4
    const text = '1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ some content here without any phrases'
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })

  it('does not trigger on exactly 4 keycap emojis', () => {
    // threshold is strictly > 4, so 4 should not score
    const text = '1️⃣ 2️⃣ 3️⃣ 4️⃣ some content here without any phrases'
    expect(getSlopScore(text)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// LinkedIn CTA phrases — "join the journey", "repost to", "save this"
// ---------------------------------------------------------------------------

describe('getSlopScore - LinkedIn CTA phrases', () => {
  it('scores above 0 for "join the journey"', () => {
    expect(getSlopScore('Follow Ivan Davidov to join the journey.')).toBeGreaterThan(0)
  })

  it('scores above 0 for "repost to"', () => {
    expect(getSlopScore('Repost to help another engineer level up.')).toBeGreaterThan(0)
  })

  it('scores above 0 for "save this"', () => {
    expect(getSlopScore('Save this for your next architecture review.')).toBeGreaterThan(0)
  })
})

describe('isSlop - numbered list CTA pattern', () => {
  it('detects a numbered-emoji list with LinkedIn CTA phrases', () => {
    // Classic: 8 keycap items + "join the journey" / "repost to" at the bottom
    const post = [
      '1️⃣ seed state in one call',
      '2️⃣ mock the response inline',
      '3️⃣ attach auth once',
      '4️⃣ wait for the API to settle',
      '5️⃣ block the heavy assets',
      'repost to help another qa architect level up',
      'join the journey',
    ].join('\n')
    expect(isSlop(post)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Regex patterns — SLOP_PATTERNS from slop-keywords.js
// ---------------------------------------------------------------------------

describe('getSlopScore - em dash', () => {
  it('flags a post containing an em dash', () => {
    expect(isSlop('We shipped the feature — and it went great.')).toBe(true)
  })

  it('does not flag a post with only a regular hyphen', () => {
    expect(getSlopScore('We shipped the feature - and it went great.')).toBe(0)
  })
})

describe('getSlopScore - "It\'s not X. It\'s Y." pattern', () => {
  it('flags the classic contrasting-clause structure', () => {
    expect(isSlop("It's not experience. It's exposure.")).toBe(true)
  })

  it('flags when the clauses are separated by a newline', () => {
    expect(isSlop("It's not about the tools.\nIt's about the mindset.")).toBe(true)
  })

  it('flags with curly apostrophes', () => {
    expect(isSlop('It’s not luck. It’s consistency.')).toBe(true)
  })

  it('does not flag a sentence that only has one clause', () => {
    expect(getSlopScore("It's not the destination that matters.")).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Markdown formatting — raw markdown pasted from an AI chat window
// ---------------------------------------------------------------------------

describe('getSlopScore - raw markdown', () => {
  it('scores above 0 for **bold** text', () => {
    expect(getSlopScore('Meenakshi reflects **advocacy and technical evolution** in her posts.')).toBeGreaterThan(0)
  })

  it('scores above 0 for ### headers', () => {
    expect(getSlopScore('### 3. Mentorship & Freshers Engagement\nA consistent theme.')).toBeGreaterThan(0)
  })

  it('scores above 0 for asterisk bullet lines', () => {
    expect(getSlopScore('* The Returnship Program: she shares content on women returning to work.')).toBeGreaterThan(0)
  })

  it('flags a post with mixed markdown as slop', () => {
    const post = [
      '**1. Diversity, Equity & Inclusion (DE&I)**',
      '* She promotes the RISE program for mid-level leadership.',
      '* She promotes the Propel program for senior coaching.',
      '### **2. Quality Engineering**',
    ].join('\n')
    expect(isSlop(post)).toBe(true)
  })

  it('does not flag a clean post with a single asterisk used naturally', () => {
    expect(getSlopScore('Revenue grew 3x - it was a great quarter*.')).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// getSlopSignals — human-readable labels for each triggered signal
// ---------------------------------------------------------------------------

describe('getSlopSignals', () => {
  it('returns an empty array for a clean post', () => {
    expect(getSlopSignals('We shipped a new feature. The team worked hard on it.')).toEqual([])
  })

  it('includes "buzzword phrases (n)" when a slop phrase matches', () => {
    const signals = getSlopSignals("In today's fast-paced world, we need to adapt.")
    expect(signals.some((s) => s.startsWith('buzzword phrases'))).toBe(true)
  })

  it('includes the phrase count in the buzzword signal label', () => {
    expect(getSlopSignals("In today's fast-paced world, let that sink in.")).toContain('buzzword phrases (2)')
  })

  it('includes "emoji overload" when emoji density exceeds threshold', () => {
    expect(getSlopSignals('🚀 Launch 💡 Idea 🔥 Fire 💪 Strong ⚡ Fast')).toContain('emoji overload')
  })

  it('includes "raw markdown" when markdown formatting is present', () => {
    expect(getSlopSignals('Her work reflects **advocacy and technical evolution**.')).toContain('raw markdown')
  })

  it('includes "line stacking" for moderate single-sentence stacking (5–14 lines)', () => {
    const text = ['Hook.', 'Second.', 'Third.', 'Fourth.', 'Fifth.', 'Sixth.'].join('\n')
    expect(getSlopSignals(text)).toContain('line stacking')
  })

  it('includes "extreme line stacking" for heavy stacking (15+ lines at 80%+ ratio)', () => {
    const text = Array.from({ length: 20 }, (_, i) => `Line ${i + 1}.`).join('\n')
    expect(getSlopSignals(text)).toContain('extreme line stacking')
  })

  it('does not include "extreme line stacking" for moderate stacking', () => {
    const text = ['Hook.', 'Second.', 'Third.', 'Fourth.', 'Fifth.', 'Sixth.'].join('\n')
    expect(getSlopSignals(text)).not.toContain('extreme line stacking')
  })

  it('returns all triggered signals when multiple fire', () => {
    const text = [
      "In today's fast-paced world.",
      '🚀 Launch. 💡 Think. 🔥 Hot. 💪 Strong. ⚡ Fast.',
      'Line one.',
      'Line two.',
      'Line three.',
      'Line four.',
    ].join('\n')
    const signals = getSlopSignals(text)
    expect(signals.some((s) => s.startsWith('buzzword phrases'))).toBe(true)
    expect(signals).toContain('emoji overload')
    expect(signals).toContain('line stacking')
  })
})
