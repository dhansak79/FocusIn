import { describe, it, expect } from 'vitest'
import { getSlopScore, getSlopSignals, isSlop } from '../../src/features/slop-detector.js'

// ---------------------------------------------------------------------------
// Phrase signal — weighted: 1 phrase scores 1, 2+ score 2, threshold is 2
// A single common phrase in an otherwise clean post should not trigger alone.
// ---------------------------------------------------------------------------

describe('getSlopScore - slop phrases', () => {
  it('scores 0 for a clean post with no slop signals', () => {
    expect(getSlopScore('Had a great meeting today. Really enjoyed the discussion about our roadmap.')).toBe(0)
  })

  it('scores 1 for a single matching phrase (below the threshold)', () => {
    expect(getSlopScore("In today's fast-paced world, we need to adapt.")).toBe(1)
  })

  it('a single phrase match alone does not reach the slop threshold', () => {
    expect(isSlop("In today's fast-paced world, we need to adapt.")).toBe(false)
  })

  it('scores 2 for two or more phrase matches (reaches the threshold)', () => {
    expect(getSlopScore("In today's fast-paced world, let that sink in.")).toBe(2)
  })

  it('two phrase matches triggers isSlop', () => {
    expect(isSlop("In today's fast-paced world, let that sink in.")).toBe(true)
  })

  it('more phrases score higher than fewer phrases', () => {
    const one = getSlopScore("In today's fast-paced world, adapting is key.")
    const many = getSlopScore("In today's fast-paced world, let that sink in. Game-changer! Leverage thought leadership. Key takeaways.")
    expect(many).toBeGreaterThan(one)
  })
})

// ---------------------------------------------------------------------------
// Emoji density signal — 1 point when emoji count exceeds threshold
// ---------------------------------------------------------------------------

describe('getSlopScore - emoji density', () => {
  it.each([
    ['Great news! 🎉 We launched our product today.'],
    ['Excited 🎉 to share this 🚀 with everyone.'],
  ])('scores 0 with few emojis: %s', (text) => {
    expect(getSlopScore(text)).toBe(0)
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
  it.each([
    ['This is a normal post. It has multiple sentences on the same line. Nothing unusual about the formatting at all.'],
    [['Short thought.', 'Two lines total.'].join('\n')],
  ])('scores 0 for normal prose: %s', (text) => {
    expect(getSlopScore(text)).toBe(0)
  })

  it('scores above 0 when most lines contain a single short sentence', () => {
    const text = ['This is the hook.', 'Here is the second thought.', 'And the third.', 'Another single line.', 'This keeps going.', 'One final line.'].join('\n')
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })

  it('scores above 0 for the classic LinkedIn one-liner stacking pattern', () => {
    const text = ['I used to work 80 hours a week.', '', 'Then I learned one thing.', '', 'It changed everything.', '', 'Here is what nobody tells you.', '', 'Stop trying so hard.'].join('\n')
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
    const text = ['Just one single line.', 'This has two sentences. Then more here.', 'Opening thought. Closing thought.', 'First point. Second point added.', 'Yet another multi. Sentence line.'].join('\n')
    expect(getSlopScore(text)).toBe(0)
  })

  it('scores above 0 when exactly the minimum ratio of lines are single-sentence', () => {
    // 3 single-sentence lines out of 5 = exactly 60% = LINE_PATTERN_RATIO
    const text = ['Single thought here.', 'Another single thought.', 'One more single line.', 'This has two sentences. Yes it does.', 'This also has two. And more here.'].join('\n')
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Heavy line stacking — extreme one-liner posts score 2 on their own
// ---------------------------------------------------------------------------

describe('getSlopScore - heavy line stacking', () => {
  it('scores 2 for a post with many short single-sentence lines and no other signals', () => {
    const post = ['Fear charges high interest.', "But it's not fear's fault.", 'Fear has one job.', 'Protect you from the unknown.', 'The problem?', 'When you cannot see a path forward everything feels dangerous.', 'A conversation.', 'A career move.', 'A new opportunity.', 'A difficult decision.', 'The less clarity you have the bigger the fear becomes.', 'Your mind fills in the blanks.', 'Worst-case scenarios.', 'Regret.', 'Failure.', 'Loss.', 'Not because the risk is higher.', 'Because you cannot evaluate it.', 'But something changes when you have a method.', 'When you can see your options.'].join('\n')
    expect(getSlopScore(post)).toBeGreaterThanOrEqual(2)
  })

  it('scores only 1 for moderate stacking (5–14 lines)', () => {
    const post = ['This is the hook.', 'Here is the second thought.', 'And the third.', 'Another single line.', 'This keeps going.', 'One final line.'].join('\n')
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
    const twoSignals = getSlopScore(["In today's fast-paced world.", 'Let that sink in.', 'Think about it.', 'Really think.', 'Game-changer.', '🚀 💡 🔥 💪 ⚡ 🎯 🌟'].join('\n'))
    expect(twoSignals).toBeGreaterThan(oneSignal)
  })
})

// ---------------------------------------------------------------------------
// isSlop — threshold gate: requires 2+ signal points to flag
// ---------------------------------------------------------------------------

describe('isSlop', () => {
  it('returns false for a clean post', () => {
    expect(isSlop('Just shipped a new feature today. The team worked really hard on it and I am proud of what we built.')).toBe(false)
  })

  it('returns false for a single slop phrase with no other signals', () => {
    expect(isSlop("In today's fast-paced world, we need to adapt.")).toBe(false)
  })

  it('returns false when no signals are present', () => {
    expect(isSlop('We shipped a new feature today. The team is proud of the work done.')).toBe(false)
  })

  it('returns true for a post combining phrase slop with high emoji density', () => {
    expect(isSlop('🚀 Game-changer! 💡 Thought leadership! 🔥 Leverage! 💪 Synergy! ⚡ Fast! 🎯 Win!')).toBe(true)
  })

  it('returns true for a post combining phrase slop with the one-liner pattern', () => {
    const post = ["In today's fast-paced world.", 'Thought leadership matters.', 'Let that sink in.', 'Game-changer.', 'Leverage your potential.', 'Key takeaways below.'].join('\n')
    expect(isSlop(post)).toBe(true)
  })

  it('returns true for a post combining emoji density with the one-liner pattern', () => {
    const post = ['🚀 Big move.', '💡 Smart idea.', '🔥 On fire.', '💪 Stay strong.', '⚡ Move fast.', '🎯 Hit targets.'].join('\n')
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
// Regex patterns — SLOP_PATTERNS from slop-keywords.js
// ---------------------------------------------------------------------------

describe('getSlopScore - em dash', () => {
  it('flags a post containing an em dash', () => {
    expect(isSlop('We shipped the feature — and it went great.')).toBe(true)
  })

  it('does not flag a post with only a regular hyphen', () => {
    expect(getSlopScore('We shipped the feature - and it went great.')).toBe(0)
  })

  it('reports "em dash" in signals for an em dash', () => {
    expect(getSlopSignals('We shipped the feature — and it went great.')).toContain('em dash')
  })
})

describe("getSlopScore - \"It's not X. It's Y.\" pattern", () => {
  it.each([
    ["It's not experience. It's exposure."],
    ["It's not about the tools.\nIt's about the mindset."],
    ['It’s not luck. It’s consistency.'],
  ])('flags contrasting clause: %s', (text) => {
    expect(isSlop(text)).toBe(true)
  })

  it('does not flag a sentence that only has one clause', () => {
    expect(getSlopScore("It's not the destination that matters.")).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Markdown formatting — raw markdown pasted from an AI chat window
// ---------------------------------------------------------------------------

describe('getSlopScore - raw markdown', () => {
  it.each([
    ['Meenakshi reflects **advocacy and technical evolution** in her posts.'],
    ['### 3. Mentorship & Freshers Engagement\nA consistent theme.'],
    ['* The Returnship Program: she shares content on women returning to work.'],
  ])('scores above 0 for markdown: %s', (text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })

  it('flags a post with mixed markdown as slop', () => {
    const post = ['**1. Diversity, Equity & Inclusion (DE&I)**', '* She promotes the RISE program for mid-level leadership.', '* She promotes the Propel program for senior coaching.', '### **2. Quality Engineering**'].join('\n')
    expect(isSlop(post)).toBe(true)
  })

  it('does not flag a clean post with a single asterisk used naturally', () => {
    expect(getSlopScore('Revenue grew 3x - it was a great quarter*.')).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Numbered listicle pattern — "5 things", "7 habits", etc.
// ---------------------------------------------------------------------------

describe('getSlopScore - numbered listicle pattern', () => {
  it.each([
    ['5 things successful people do differently that most ignore.'],
    ['7 habits that changed my life and how you can adopt them today.'],
    ['10 mistakes every new manager makes in their first 90 days.'],
  ])('flags listicle: %s', (text) => {
    expect(isSlop(text)).toBe(true)
  })

  it('does not flag a genuine technical bullet count', () => {
    expect(getSlopScore('We fixed 3 bugs today: the race condition in the auth flow, the timeout in the API, and the broken redirect.')).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Emoji bullet lists — two or more lines starting with an emoji as a bullet
// ---------------------------------------------------------------------------

describe('getSlopScore - emoji bullet lists', () => {
  it('scores above 0 for two or more emoji-prefixed bullet lines', () => {
    const post = '5 habits of high performers:\n🎯 Set clear goals\n💡 Think creatively\n🔑 Unlock your potential'
    expect(getSlopScore(post)).toBeGreaterThan(0)
  })

  it('flags a post with emoji bullets combined with a slop phrase', () => {
    const post = 'Growth mindset in practice:\n🎯 Set clear goals\n💡 Think creatively\n🔑 Unlock your potential'
    expect(isSlop(post)).toBe(true)
  })

  it('does not flag a single emoji used naturally in a sentence', () => {
    expect(getSlopScore('Shipped the feature today 🎉 and the team is happy with the result.')).toBe(0)
  })

  it('does not flag emoji on single line without bullet structure', () => {
    expect(getSlopScore('Big news 🎉 - we just hit a million users 🚀')).toBe(0)
  })

  it('reports "emoji bullets" in signals', () => {
    const post = '🎯 Set goals\n💡 Think big\n🔑 Unlock success'
    expect(getSlopSignals(post)).toContain('emoji bullets')
  })
})

// ---------------------------------------------------------------------------
// Quote attribution pattern — "As X once said:"
// ---------------------------------------------------------------------------

describe('getSlopScore - quote attribution pattern', () => {
  it.each([
    ['As Steve Jobs once said: stay hungry, stay foolish.'],
    ['As my mentor always put it, the best time to start was yesterday.'],
    ['As Warren Buffett said, price is what you pay, value is what you get.'],
  ])('flags quote attribution: %s', (text) => {
    expect(isSlop(text)).toBe(true)
  })

  it('does not flag a natural sentence containing "as"', () => {
    expect(getSlopScore('We approached this problem as a team and found a clean solution.')).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Twitter thread format — "1/" "2/" "3/" numbered items on LinkedIn
// ---------------------------------------------------------------------------

describe('getSlopScore - thread format pattern', () => {
  it('flags a post structured as a numbered Twitter thread', () => {
    const post = ['10 lessons I learned building my first company:', '', '1/ Start before you are ready', '2/ Hire for attitude', '3/ Talk to customers every week', '4/ Cash flow is not the same as profit'].join('\n')
    expect(isSlop(post)).toBe(true)
  })

  it('does not flag a post with a regular numbered list', () => {
    expect(getSlopScore('We had three problems: 1. no budget, 2. no time, 3. no idea.')).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Arrow bullet lists — "→ item" used as AI listicle format
// ---------------------------------------------------------------------------

describe('getSlopScore - arrow bullet lists', () => {
  it('flags two or more arrow-bulleted lines', () => {
    const post = '5 things I learned the hard way:\n→ Ship early\n→ Talk to users\n→ Charge more\n→ Hire slowly\n→ Sleep more'
    expect(isSlop(post)).toBe(true)
  })

  it('does not flag a single arrow used naturally', () => {
    expect(getSlopScore('We went from idea → product in 6 weeks.')).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Additional contrasting clause patterns — "This isn't X. This is Y."
// ---------------------------------------------------------------------------

describe('getSlopScore - new contrasting clause patterns', () => {
  it.each([
    ["This isn't about the money. This is about the mission."],
    ["That's not failure. That's feedback."],
    ["This isn't burnout.\nThis is a signal."],
  ])('flags contrasting clause: %s', (text) => {
    expect(isSlop(text)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// "X isn't new. What's new is Y." pseudo-insight reframe pattern
// ---------------------------------------------------------------------------

describe("getSlopScore - \"isn't new / what's new is\" pattern", () => {
  it.each([
    ["Technical debt isn't new. What's new is the speed."],
    ["Burnout isn't new. What's new is how normalized it's become."],
    ["Imposter syndrome isn't new.\nWhat's new is that everyone is talking about it."],
  ])('flags pseudo-insight reframe: %s', (text) => {
    expect(isSlop(text)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Real-world post tests — catches obvious slop, spares genuine posts
// ---------------------------------------------------------------------------

describe('isSlop - real-world slop posts', () => {
  it('flags a classic AI ghostwritten LinkedIn post', () => {
    const post = [
      "Here's the thing about building a career in tech.",
      '',
      "Most people think it's about the tools.",
      "This isn't about the tools.",
      "This is about the mindset.",
      '',
      "The brutal truth? Let's be real.",
      "What it comes down to is showing up every single day.",
      '',
      'Make no mistake. The game is changing.',
      'Agentic workflows are game-changing.',
      '',
      'Long story short: start before you are ready.',
    ].join('\n')
    expect(isSlop(post)).toBe(true)
  })

  it('flags a B2B AI lead generation post (AI Learning School pattern)', () => {
    const post = [
      'Leading AI adoption feels bigger than your role?',
      '',
      'You are not alone. Most business leaders are not stuck on strategy, they are stuck on jargon, unclear use cases, and risk questions.',
      '',
      'The good news. You do not need to code to lead well.',
      'You need a clear business framework and the confidence to ask better questions.',
      '',
      'If this sounds familiar, follow AI Learning School and get ready for practical AI leadership guidance built for non-technical leaders.',
    ].join('\n')
    expect(isSlop(post)).toBe(true)
  })

  it('flags a post with heavy em dash usage', () => {
    const post = 'Leadership — real leadership — is rare. Consistency — not talent — is the differentiator. Results — not effort — is what matters.'
    expect(isSlop(post)).toBe(true)
  })

  it('flags a post pasted directly from an AI chat window', () => {
    const post = [
      '**Key Takeaways from My Leadership Journey**',
      '',
      '* Consistency beats talent every time',
      '* Systems matter more than goals',
      '* Your network is your net worth',
      '',
      '### What I Learned',
      'Leverage these insights to holistic approach your career.',
    ].join('\n')
    expect(isSlop(post)).toBe(true)
  })
})

describe('isSlop - real-world clean posts', () => {
  it('does not flag a genuine product update', () => {
    const post = 'We shipped dark mode today. Six weeks of work, three rewrites of the colour system, and one very patient design team. Worth it.'
    expect(isSlop(post)).toBe(false)
  })

  it('does not flag a genuine personal story', () => {
    const post = 'My first job paid £18k. I turned it down because the commute was two hours each way. My manager at the time told me I was making a mistake. He was wrong.'
    expect(isSlop(post)).toBe(false)
  })

  it('does not flag a technical post with no slop signals', () => {
    const post = 'If you are debugging a React re-render issue, check whether your useEffect dependencies include object references. Object identity in JavaScript means two objects with the same shape are not equal. This catches people out constantly.'
    expect(isSlop(post)).toBe(false)
  })

  it('does not flag a post that uses one common phrase naturally', () => {
    const post = 'Long story short, the migration took three days instead of one. We underestimated the schema differences. Lessons learned.'
    expect(isSlop(post)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Anaphora — same two-word phrase opens 3+ lines
// ---------------------------------------------------------------------------

describe('getSlopScore - anaphora pattern', () => {
  it('flags three or more lines opening with the same two-word phrase', () => {
    const post = [
      'It means sitting in rooms with city officials.',
      'It means curating events that create real connection.',
      'It means flying in experts so people can access knowledge.',
    ].join('\n')
    expect(isSlop(post)).toBe(true)
  })

  it('reports "anaphora" in signals', () => {
    const post = [
      'It means sitting in rooms.',
      'It means curating events.',
      'It means flying in experts.',
    ].join('\n')
    expect(getSlopSignals(post)).toContain('anaphora')
  })

  it('does not flag when the same phrase only opens two lines', () => {
    const post = 'It means sitting in rooms with city officials.\nIt means curating events that create real connection.\nThis is something different entirely.'
    expect(getSlopScore(post)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// "Some X. Some Y." — short parallel contrast at line start
// ---------------------------------------------------------------------------

describe('getSlopScore - some X some Y pattern', () => {
  it('flags the "Some creators attend. Some build." structure', () => {
    expect(isSlop('Some creators attend. Some build.')).toBe(true)
  })

  it('reports "some X, some Y" in signals', () => {
    expect(getSlopSignals('Some people lead. Some follow.')).toContain('some X, some Y')
  })

  it('does not flag "some" used naturally mid-sentence', () => {
    expect(getSlopScore('We tried some new approaches and some of them worked well.')).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// "Here's why" hook
// ---------------------------------------------------------------------------

describe("getSlopScore - here's why hook", () => {
  it("flags a post opening with \"here's why\"", () => {
    expect(isSlop("I turned down a dream this year. Here's why I'd do it again.")).toBe(true)
  })

  it('reports "here\'s why hook" in signals', () => {
    expect(getSlopSignals("Here's why this changes everything.")).toContain("here's why hook")
  })

  it('does not flag "here is what" or other here phrases', () => {
    expect(getSlopScore("Here is what we shipped today.")).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Hashtag spam signal — 1 point when post contains 5 or more hashtags
// ---------------------------------------------------------------------------

describe('getSlopScore - hashtag spam', () => {
  it('triggers the signal for exactly 5 hashtags (boundary)', () => {
    const text = 'Great post today. #leadership #growth #mindset #career #success'
    expect(getSlopScore(text)).toBeGreaterThanOrEqual(1)
    expect(getSlopSignals(text)).toContain('hashtag spam')
  })

  it('does not trigger the signal for 4 hashtags (below threshold)', () => {
    const text = 'Great post today. #leadership #growth #mindset #career'
    expect(getSlopSignals(text)).not.toContain('hashtag spam')
  })

  it('triggers the signal for 10 hashtags (well above threshold)', () => {
    const text = 'Great post. #leadership #growth #mindset #career #success #hiring #jobs #tech #ai #innovation'
    expect(getSlopScore(text)).toBeGreaterThanOrEqual(1)
    expect(getSlopSignals(text)).toContain('hashtag spam')
  })

  it('does not affect score or signals for a post with no hashtags', () => {
    const text = 'Great post today with absolutely no hashtags at all.'
    expect(getSlopSignals(text)).not.toContain('hashtag spam')
  })

  it('hashtag signal combined with emoji overload reaches isSlop threshold', () => {
    const text = 'Big news! 🚀 💡 🔥 💪 ⚡ #leadership #growth #mindset #career #success'
    expect(isSlop(text)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// getSlopSignals — human-readable labels for each triggered signal
// ---------------------------------------------------------------------------

describe('getSlopSignals', () => {
  it('returns an empty array for a clean post', () => {
    expect(getSlopSignals('We shipped a new feature. The team worked hard on it.')).toEqual([])
  })

  it('includes the actual matched phrase quoted when a slop phrase matches', () => {
    const signals = getSlopSignals("In today's fast-paced world, we need to adapt.")
    expect(signals).toContain('"in today\'s fast-paced"')
  })

  it('includes up to 3 quoted phrases when multiple match', () => {
    const signals = getSlopSignals("In today's fast-paced world, let that sink in.")
    const quoted = signals.filter((s) => s.startsWith('"'))
    expect(quoted.length).toBeGreaterThanOrEqual(2)
  })

  it('caps matched phrases at 3 even when more than 3 match', () => {
    const text = "In today's fast-paced world, let that sink in. Game-changer! Leverage thought leadership. Key takeaways."
    const signals = getSlopSignals(text)
    const quoted = signals.filter((s) => s.startsWith('"'))
    expect(quoted.length).toBeLessThanOrEqual(3)
  })

  it.each([
    ['em dash', 'We shipped the feature — and it went great.'],
    ['emoji overload', '🚀 Launch 💡 Idea 🔥 Fire 💪 Strong ⚡ Fast'],
    ['raw markdown', 'Her work reflects **advocacy and technical evolution**.'],
    ['line stacking', ['Hook.', 'Second.', 'Third.', 'Fourth.', 'Fifth.', 'Sixth.'].join('\n')],
    ['extreme line stacking', Array.from({ length: 20 }, (_, i) => `Line ${i + 1}.`).join('\n')],
  ])('includes "%s" signal when it fires', (signal, text) => {
    expect(getSlopSignals(text)).toContain(signal)
  })

  it('does not include "extreme line stacking" for moderate stacking', () => {
    const text = ['Hook.', 'Second.', 'Third.', 'Fourth.', 'Fifth.', 'Sixth.'].join('\n')
    expect(getSlopSignals(text)).not.toContain('extreme line stacking')
  })

  it('returns all triggered signals when multiple fire', () => {
    const text = ["In today's fast-paced world.", '🚀 Launch. 💡 Think. 🔥 Hot. 💪 Strong. ⚡ Fast.', 'Line one.', 'Line two.', 'Line three.', 'Line four.'].join('\n')
    const signals = getSlopSignals(text)
    expect(signals.some((s) => s.startsWith('"'))).toBe(true)
    expect(signals).toContain('emoji overload')
    expect(signals).toContain('line stacking')
  })

  it('reports specific pattern labels for regex matches', () => {
    expect(getSlopSignals("It's not experience. It's exposure.")).toContain("it's not X, it's Y")
    expect(getSlopSignals('5 things successful people do differently.')).toContain('numbered listicle')
    expect(getSlopSignals('As Steve Jobs once said: stay hungry.')).toContain('quote attribution')
    expect(getSlopSignals('It means sitting.\nIt means curating.\nIt means flying.')).toContain('anaphora')
    expect(getSlopSignals('Some creators attend. Some build.')).toContain('some X, some Y')
    expect(getSlopSignals("Here's why this matters.")).toContain("here's why hook")
  })
})
