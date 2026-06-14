import { describe, it, expect } from 'vitest'
import { getSlopScore, isSlop } from '../../src/features/slop-detector.js'

// ---------------------------------------------------------------------------
// LinkedIn CTA phrases
// ---------------------------------------------------------------------------

describe('getSlopScore - LinkedIn CTA phrases', () => {
  it.each([
    ['join the journey', 'Follow Ivan Davidov to join the journey.'],
    ['repost to', 'Repost to help another engineer level up.'],
    ['save this', 'Save this for your next architecture review.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('isSlop - numbered list CTA pattern', () => {
  it('detects a numbered-emoji list with LinkedIn CTA phrases', () => {
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
// Dustin Andrews dead giveaways
// ---------------------------------------------------------------------------

describe('getSlopScore - Dustin Andrews filler hooks', () => {
  it.each([
    ['the fix:', 'The fix: stop trying to do everything at once.'],
    ['the key insight:', 'The key insight: most people skip this step entirely.'],
    ['the bottom line:', 'The bottom line: it comes down to consistency.'],
    ["here's how:", "Here's how: start with the smallest possible action."],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })

  it('two filler hooks together reach the slop threshold', () => {
    expect(isSlop('The key insight: you are overthinking it. The fix: start small.')).toBe(true)
  })
})

describe('getSlopScore - Dustin Andrews cliché phrases', () => {
  it.each([
    ["here's the thing", "Here's the thing about modern leadership."],
    ["let's be real", "Let's be real — most people won't do this."],
    ['the brutal truth', 'The brutal truth is that consistency beats talent.'],
    ['long story short', 'Long story short, we pivoted the entire product.'],
    ['make no mistake', 'Make no mistake, this will change how teams operate.'],
    ['you cannot unsee it', 'Once you notice this pattern, you cannot unsee it.'],
    ['the uncomfortable truth', 'The uncomfortable truth about remote work.'],
    ['what it comes down to', 'What it comes down to is how you handle pressure.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })

  it('two cliché phrases together reach the slop threshold', () => {
    expect(isSlop("Here's the thing. Let's be real about what matters.")).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Engagement hooks and manipulation
// ---------------------------------------------------------------------------

describe('getSlopScore - hot take and opinion hooks', () => {
  it.each([
    ['unpopular opinion:', 'Unpopular opinion: most stand-ups are a waste of time.'],
    ['hot take:', 'Hot take: async work is not actually harder.'],
    ['real talk:', 'Real talk: most people are not learning from their mistakes.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - fake vulnerability and humility bait', () => {
  it.each([
    ['i was wrong about', 'I was wrong about remote work. Here is what changed my mind.'],
    ['i almost quit', 'I almost quit my job in 2022. Here is what stopped me.'],
    ['full transparency,', 'Full transparency, I had no idea what I was doing.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - question engagement hooks', () => {
  it.each([
    ['what if i told you', 'What if I told you that most meetings could be emails?'],
    ['raise your hand if', 'Raise your hand if you have ever shipped something you were not proud of.'],
    ['who needs to hear this', 'Who needs to hear this today? You are doing better than you think.'],
    ['you need to hear this', 'You need to hear this if you are struggling with productivity.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - pseudo-revelatory patterns', () => {
  it.each([
    ['this is your sign', 'This is your sign to finally start that side project.'],
    ['this is your reminder', 'This is your reminder that done is better than perfect.'],
    ['no one tells you', 'No one tells you how hard the first year of leadership really is.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - fake reluctance posts', () => {
  it.each([
    ["i almost didn't post this", "I almost didn't post this. But I think someone needs to hear it."],
    ["i don't usually share", "I don't usually share personal things here. But today is different."],
    ['i was hesitant to post', 'I was hesitant to post this because it feels vulnerable.'],
    ['this might be controversial', 'This might be controversial but remote work is not for everyone.'],
    ['i debated whether to share', 'I debated whether to share this. Decided to go for it.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - PSA and sending love posts', () => {
  it.each([
    ['psa:', 'PSA: you do not need to respond to emails after 6pm.'],
    ['sending love to', 'Sending love to every founder out there grinding through uncertainty.'],
    ['for anyone who needs to hear', 'For anyone who needs to hear this: you are doing better than you think.'],
    ['if you needed to hear this', 'If you needed to hear this today, here it is: rest is productive.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - deserve motivational posts', () => {
  it.each([
    ['you deserve', 'You deserve a manager who actually invests in your growth.'],
    ['seat at the table', 'Stop waiting to be invited. Pull up your own seat at the table.'],
    ['take up space', 'You were not born to shrink. Take up space. Own the room.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - reminder posts', () => {
  it.each([
    ['gentle reminder:', 'Gentle reminder: your worth is not tied to your productivity.'],
    ['friendly reminder:', 'Friendly reminder: it is okay to say no.'],
    ['reminder that', 'Just a reminder that not every day needs to be your best day.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - fear-based engagement', () => {
  it.each([
    ["don't make this mistake", "Don't make this mistake when negotiating your salary."],
    ['biggest mistake', 'The biggest mistake new managers make in their first 90 days.'],
    ['the number one reason', 'The number one reason startups fail is not what you think.'],
    ["before it's too late", "Learn these skills before it's too late."],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - engagement solicitation', () => {
  it.each([
    ['agree or disagree?', 'Managers are the number one reason people quit. Agree or disagree?'],
    ['can anyone relate?', 'Some days you just feel like giving up. Can anyone relate?'],
    ['am i the only one', 'Am I the only one who finds open plan offices unbearable?'],
    ['what would you add?', 'These are my top five lessons. What would you add?'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - self-promotion patterns', () => {
  it.each([
    ['link in comments', 'I wrote a full breakdown of this. Link in comments.'],
    ['dm me for', 'DM me for the free template I built for this.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Narrative and identity hooks
// ---------------------------------------------------------------------------

describe('getSlopScore - "stop X" imperatives', () => {
  it.each([
    ['stop overthinking', 'Stop overthinking and start shipping.'],
    ['stop waiting for', 'Stop waiting for the perfect moment. It does not exist.'],
    ['stop playing small', 'You were not born to stop playing small. Go bigger.'],
    ['stop comparing yourself', 'Stop comparing yourself to others. Your timeline is your own.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - "what I wish" reflections', () => {
  it.each([
    ['what i wish i knew', 'What I wish I knew before starting my first business.'],
    ['what nobody told me', 'What nobody told me about becoming a people manager.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - narrative arc and confession', () => {
  it.each([
    ['changed my life', 'One book changed my life. Here is what it taught me.'],
    ['confession:', 'Confession: I almost gave up three times before we hit product-market fit.'],
    ['the moment i realised', 'The moment I realised I was the problem, everything changed.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - LinkedIn ecosystem specific', () => {
  it.each([
    ['your network is your net worth', 'Your network is your net worth. Invest in relationships.'],
    ['beat the algorithm', 'Five ways to beat the algorithm and grow your reach organically.'],
    ['most underrated', 'The most underrated skill in tech is clear written communication.'],
    ['the secret to', 'The secret to consistent productivity is not what you think.'],
    ['an open letter to', 'An open letter to every junior developer feeling overwhelmed right now.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - underdog narrative', () => {
  it.each([
    ['prove them wrong', 'Use every rejection as fuel to prove them wrong.'],
    ["they said i couldn't", "They said I couldn't do it. Five years later, here we are."],
    ['they doubted me', 'They doubted me. I am grateful for every single one of them.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - narrative formula phrases', () => {
  it.each([
    ['that moment changed everything', 'I got the rejection. That moment changed everything.'],
    ['i will never forget', "I will never forget the look on my manager's face."],
    ['everything changed when', 'Everything changed when I stopped trying to please everyone.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - anecdote and storytime hooks', () => {
  it.each([
    ['story time:', 'Story time: I once lost a client because of one email.'],
    ['true story:', 'True story: I was rejected by every investor in the room.'],
    ['i remember the day', 'I remember the day I decided to leave my corporate job.'],
    ['plot twist:', 'Plot twist: the hardest part was not the work.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})
