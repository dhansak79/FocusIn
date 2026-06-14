import { describe, it, expect } from 'vitest'
import { getSlopScore, isSlop } from '../../src/features/slop-detector.js'

// ---------------------------------------------------------------------------
// AI and tech vocabulary
// ---------------------------------------------------------------------------

describe('getSlopScore - Dustin Andrews AI buzzwords', () => {
  it.each([
    ['agentic', 'We are building an agentic workflow for our team.'],
    ['game-changing', 'This is a game-changing approach to productivity.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - AI trend vocabulary', () => {
  it.each([
    ['vibe coding', 'Vibe coding is the future and I am here for it.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - atomic habits and 1% better genre', () => {
  it.each([
    ['1% better', 'Get 1% better every day. That is all it takes.'],
    ['compound effect', 'The compound effect of small daily habits is more powerful than any big leap.'],
    ['atomic habits', 'Atomic habits teaches us that identity-based change is more durable.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - hustle origin story', () => {
  it.each([
    ['nights and weekends', 'I built this product nights and weekends for two years before quitting my job.'],
    ['from zero to', 'From zero to one million users in eighteen months. Here is what we learned.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - missed clichés', () => {
  it.each([
    ['think outside the box', 'Great leaders do not just think outside the box. They redesign the box.'],
    ['80/20 rule', 'Apply the 80/20 rule to everything and watch your output double.'],
    ['went viral', 'My post went viral last week and the response has been overwhelming.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// LLM output tells and corporate jargon
// ---------------------------------------------------------------------------

describe('getSlopScore - LLM output tells', () => {
  it.each([
    ['rest assured', 'Rest assured, the team is working around the clock to resolve this.'],
    ['thought-provoking', 'A thought-provoking read on the future of distributed teams.'],
    ['nuanced', 'The reality is far more nuanced than most people realise.'],
    ['multifaceted', 'Leadership is a multifaceted skill that takes years to develop.'],
    ['feel free to reach out', 'If you have questions about this, feel free to reach out anytime.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - extended corporate jargon', () => {
  it.each([
    ['learnings', 'Sharing my top learnings from six months of building in stealth.'],
    ['ideation', 'We kicked off with a full day of ideation and cross-functional collaboration.'],
    ['low-hanging fruit', 'Most teams ignore the low-hanging fruit and go straight to complex solutions.'],
    ['best practices', 'Here are the best practices every engineering manager should know.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - more corporate jargon', () => {
  it.each([
    ['pain points', 'We identified the three biggest pain points our customers face.'],
    ['peel back the onion', 'When you peel back the onion on this problem, the root cause is culture.'],
    ['drink from the firehose', 'Week one at any new job: drink from the firehose and try not to drown.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - LLM transition phrases', () => {
  it.each([
    ['first and foremost', 'First and foremost, we need to align on what success looks like.'],
    ['last but not least', 'Last but not least, remember to celebrate your small wins.'],
    ['it goes without saying', 'It goes without saying that culture eats strategy for breakfast.'],
    ['with that being said', 'With that being said, here are the three things I would do differently.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - LLM vocabulary tells', () => {
  it.each([
    ['transformative', 'This was a truly transformative experience for our entire team.'],
    ['unprecedented', 'We are living through unprecedented change in the world of work.'],
    ['empower', 'Our mission is to empower every employee to reach their potential.'],
    ['supercharge', 'These five habits will supercharge your morning routine.'],
    ['life hack', 'The best life hack nobody talks about is simply showing up.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Content and brand vocabulary
// ---------------------------------------------------------------------------

describe('getSlopScore - "The Noun" framing', () => {
  it.each([
    ['the playbook', 'Here is the playbook I used to grow from zero to one million.'],
    ['the blueprint', 'The blueprint every new manager needs but nobody shares.'],
    ['the formula', 'After ten years I finally found the formula for consistent results.'],
    ['the masterclass', 'This thread is the masterclass on cold outreach I wish existed.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - normalize posts', () => {
  it.each([
    ['normalize asking', 'Normalize asking for help. It is a sign of strength, not weakness.'],
    ['normalize taking', 'Normalize taking a day off when your mental health needs it.'],
    ['normalize talking about', 'Normalize talking about salary with your colleagues.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - personal branding ecosystem', () => {
  it.each([
    ['personal brand', 'Your personal brand is the most valuable asset you own.'],
    ['thought leader', 'How to become a thought leader in your industry in 90 days.'],
    ['creator economy', 'The creator economy is the biggest opportunity of our generation.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - false wisdom', () => {
  it.each([
    ['done is better than perfect', 'Done is better than perfect. Ship it and iterate.'],
    ['embrace the journey', 'Stop rushing toward the destination. Embrace the journey.'],
    ['work smarter', 'Stop working harder. Work smarter. Here is how.'],
    ['you are the average of', 'You are the average of the five people you spend the most time with.'],
    ['this is why most people', 'This is why most people never reach their potential at work.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - career and hustle culture', () => {
  it.each([
    ['6-figure', 'How I built a 6-figure business from my spare bedroom.'],
    ['quit my 9-5', 'I quit my 9-5 eighteen months ago. Here is what happened.'],
    ['passive income', 'Three passive income streams I built in 2024.'],
    ['side hustle', 'My side hustle made more than my salary last year.'],
    ['solopreneur', 'Being a solopreneur is the hardest and best decision I ever made.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - motivational fluff', () => {
  it.each([
    ['trust the process', 'Trust the process. The results will come.'],
    ['invest in yourself', 'The best investment you will ever make is to invest in yourself.'],
    ['your future self', 'Your future self will thank you for starting today.'],
    ['bet on yourself', 'Stop waiting for permission. Bet on yourself.'],
    ['the best version of yourself', 'Every day is a chance to become the best version of yourself.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// B2B lead gen and corporate poison (Dustin Andrews)
// ---------------------------------------------------------------------------

describe('getSlopScore - B2B lead generation empathy hooks', () => {
  it.each([
    ['you are not alone', 'You are not alone. Most business leaders are stuck on jargon.'],
    ['you are not the only one', 'You are not the only one feeling overwhelmed by the pace of change.'],
    ['the good news', 'The good news. You do not need to code to lead well.'],
    ['the good news is', 'The good news is there is a simpler way to approach this.'],
    ['if this sounds familiar', 'If this sounds familiar, keep reading. I built a framework just for this.'],
    ['does this sound familiar', 'Does this sound familiar? You are stuck on strategy but unclear on execution.'],
    ['sound familiar?', 'Spending more time in meetings than doing actual work? Sound familiar?'],
    ['you need a clear', 'You need a clear business framework to lead AI adoption effectively.'],
    ['practical guidance', 'Follow along for practical guidance built for non-technical leaders.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })

  it('scores 2+ when two B2B empathy hooks appear together', () => {
    expect(getSlopScore('You are not alone. The good news is there is a better way.')).toBeGreaterThanOrEqual(2)
  })
})

describe('getSlopScore - corporate poison phrases (Dustin Andrews)', () => {
  it.each([
    ['framework', 'You need a clear business framework to navigate this transition.'],
    ['methodology', 'Our proprietary methodology has helped hundreds of teams scale faster.'],
    ['optimization', 'Optimization is the key to unlocking sustainable growth in any organisation.'],
    ['systematic approach', 'Success comes from taking a systematic approach to every challenge.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })

  it('scores 2+ when two corporate poison phrases appear together', () => {
    expect(getSlopScore('Our methodology and framework will transform your systematic approach to leadership.')).toBeGreaterThanOrEqual(2)
  })
})
