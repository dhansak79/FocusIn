import { describe, it, expect } from 'vitest'
import { getSlopScore } from '../../src/features/slop-detector.js'

// ---------------------------------------------------------------------------
// Identity and binary framing
// ---------------------------------------------------------------------------

describe('getSlopScore - two types of people', () => {
  it.each([
    ['there are two types of people', 'There are two types of people in any organisation. Those who wait and those who act.'],
    ['two kinds of people', 'Two kinds of people exist in every team. Which one are you?'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - hustle effort culture', () => {
  it.each([
    ['put in the work', 'There is no secret. You just have to put in the work every single day.'],
    ['no shortcuts', 'No shortcuts. No hacks. Just consistency over a long period of time.'],
    ['outwork everyone', 'The strategy is simple. Outwork everyone and stay humble.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - authenticity performance', () => {
  it.each([
    ['authentic self', 'The bravest thing you can do at work is show up as your authentic self.'],
    ['raw and honest', 'I want to be raw and honest with you today about what this year has been like.'],
    ['bring your whole self', 'The best companies let you bring your whole self to work every day.'],
    ['radical transparency', 'We practice radical transparency at every level of the organisation.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - disruption vocabulary', () => {
  it.each([
    ['disrupt', 'We are here to disrupt how the world thinks about talent acquisition.'],
    ['impactful', 'This was the most impactful decision I made in my entire career.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Time, seasons, and milestones
// ---------------------------------------------------------------------------

describe('getSlopScore - year in review format', () => {
  it.each([
    ['year in review', 'My year in review. Twelve months. Twelve lessons. Here we go.'],
    ['looking back on', 'Looking back on 2024, I am proud of how far we have come as a team.'],
    ['weekly recap', 'Weekly recap: three wins, two lessons, one thing I am proud of.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - chapter and season metaphors', () => {
  it.each([
    ['new chapter', 'Excited to share that I am starting a new chapter in my career.'],
    ['next chapter', 'Ready for the next chapter. Grateful for everything I have learned.'],
    ['this season of my life', 'In this season of my life I am choosing peace over hustle.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - 30-day challenge format', () => {
  it.each([
    ['30-day challenge', 'I just completed a 30-day challenge of writing every single day.'],
    ['day 1 of', 'Day 1 of posting every day for a year. Holding myself accountable.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Wellbeing and energy management
// ---------------------------------------------------------------------------

describe('getSlopScore - protect your energy posts', () => {
  it.each([
    ['protect your energy', 'Protect your energy. Not everyone deserves access to you.'],
    ['set boundaries', 'The most underrated leadership skill is learning to set boundaries.'],
    ['learn to say no', 'The most powerful word in your vocabulary is no. Learn to say no.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - gratitude overload', () => {
  it.each([
    ['forever grateful', 'Forever grateful to everyone who believed in me when I did not believe in myself.'],
    ['grateful for the journey', 'Whatever happens next, I am grateful for the journey.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - manifestation and abundance', () => {
  it.each([
    ['manifestation', 'Manifestation is not magic. It is clarity plus action.'],
    ['law of attraction', 'The law of attraction works. Here is the science behind it.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - surround yourself posts', () => {
  it.each([
    ['surround yourself with', 'Surround yourself with people who challenge you to grow.'],
    ['find your tribe', 'Find your tribe. The right community changes everything.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Mindset and growth genre
// ---------------------------------------------------------------------------

describe('getSlopScore - mindset genre', () => {
  it.each([
    ['growth mindset', 'The one thing that separates top performers is a growth mindset.'],
    ['mindset shift', 'This one mindset shift changed how I approach every challenge.'],
    ['abundance mindset', 'Switch from a scarcity mindset to an abundance mindset and watch everything change.'],
    ['mindset is everything', 'Mindset is everything. Skills can be learned. Mindset has to be earned.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - high performer culture', () => {
  it.each([
    ['high performers', 'High performers do not wait for motivation. They build systems.'],
    ['top 1%', 'The habits that put you in the top 1% are not complicated.'],
    ['non-negotiable', 'My morning walk is non-negotiable. It sets the tone for everything.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - morning routine genre', () => {
  it.each([
    ['morning routine', 'My morning routine is the reason I outperform most people.'],
    ['5am club', 'Joining the 5am club was the best decision I ever made.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - comfort zone posts', () => {
  it.each([
    ['comfort zone', 'Everything you want is on the other side of your comfort zone.'],
    ['get comfortable being uncomfortable', 'The fastest way to grow? Get comfortable being uncomfortable.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - level up language', () => {
  it.each([
    ['level up', 'Here are five books that will level up your thinking.'],
    ['next level thinking', 'Next level thinking is what separates good leaders from great ones.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - fail forward resilience genre', () => {
  it.each([
    ['fail forward', 'The best leaders I know have all learned to fail forward.'],
    ['failure is feedback', 'Stop calling it failure. Failure is feedback. Reframe it.'],
    ['celebrate the small wins', 'Celebrate the small wins. They are the foundation of big results.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Workplace culture
// ---------------------------------------------------------------------------

describe('getSlopScore - workplace culture buzzwords', () => {
  it.each([
    ['quiet quitting', 'Quiet quitting is not laziness. It is a rational response to broken management.'],
    ['the truth about', 'The truth about remote work that nobody wants to admit.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})

describe('getSlopScore - legacy and impact language', () => {
  it.each([
    ['leave a legacy', 'Build something worth remembering. Leave a legacy, not just a salary.'],
    ['be the change', 'Be the change you want to see in your organisation.'],
    ['ai-powered', 'We built an ai-powered solution that transforms how teams collaborate.'],
  ])('detects "%s"', (_, text) => {
    expect(getSlopScore(text)).toBeGreaterThan(0)
  })
})
