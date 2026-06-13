import { describe, it, expect } from 'vitest'
import { getFeedKeywords } from '../../src/features/feed-keywords.js'

// Baseline config: no flags, no custom keywords, age filtering off
const base = { 'feed-keywords': '', 'hide-by-age': 'disabled' }

describe('getFeedKeywords — interaction flags', () => {
  it('returns an empty array when no flags are set', () => {
    expect(getFeedKeywords(base)).toEqual([])
  })

  it('includes both liked keywords when hide-liked is true', () => {
    const result = getFeedKeywords({ ...base, 'hide-liked': true })
    expect(result).toContain('likes this')
    expect(result).toContain('like this')
  })

  it('includes "Suggested" when hide-suggested is true', () => {
    expect(getFeedKeywords({ ...base, 'hide-suggested': true })).toContain(
      'Suggested'
    )
  })
})

describe('getFeedKeywords — custom keywords', () => {
  it('splits comma-separated feed-keywords into the result', () => {
    const result = getFeedKeywords({ ...base, 'feed-keywords': 'politics,crypto' })
    expect(result).toContain('politics')
    expect(result).toContain('crypto')
  })

  it('treats empty string as no custom keywords', () => {
    expect(getFeedKeywords({ ...base, 'feed-keywords': '' })).toEqual([])
  })

  it('combines custom keywords with flag keywords', () => {
    const result = getFeedKeywords({
      ...base,
      'feed-keywords': 'hustle',
      'hide-liked': true,
    })
    expect(result).toContain('hustle')
    expect(result).toContain('likes this')
  })
})

describe('getFeedKeywords — age filtering', () => {
  it('adds no keywords when hide-by-age is "disabled"', () => {
    expect(getFeedKeywords(base)).toEqual([])
  })

  describe('age = "hour"', () => {
    it('includes hour markers from 2h through 24h', () => {
      const result = getFeedKeywords({ ...base, 'hide-by-age': 'hour' })
      for (let x = 2; x <= 24; x++) {
        expect(result).toContain(`${x}h •`)
      }
    })

    it('does not include a 1h marker (hides from 2h old onwards)', () => {
      const result = getFeedKeywords({ ...base, 'hide-by-age': 'hour' })
      expect(result).not.toContain('1h •')
    })

    it('includes cascade sentinels for day, week, month, year', () => {
      const result = getFeedKeywords({ ...base, 'hide-by-age': 'hour' })
      expect(result).toContain('d •')
      expect(result).toContain('w •')
      expect(result).toContain('mo •')
      expect(result).toContain('y •')
    })
  })

  describe('age = "day"', () => {
    it('includes day markers from 2d through 30d', () => {
      const result = getFeedKeywords({ ...base, 'hide-by-age': 'day' })
      for (let x = 2; x <= 30; x++) {
        expect(result).toContain(`${x}d •`)
      }
    })

    it('does not include a bare "d •" sentinel (no 1d marker)', () => {
      const result = getFeedKeywords({ ...base, 'hide-by-age': 'day' })
      expect(result).not.toContain('d •')
      expect(result).not.toContain('1d •')
    })

    it('includes cascade sentinels for week, month, year', () => {
      const result = getFeedKeywords({ ...base, 'hide-by-age': 'day' })
      expect(result).toContain('w •')
      expect(result).toContain('mo •')
      expect(result).toContain('y •')
    })
  })

  describe('age = "week"', () => {
    it('includes week markers 2w through 4w', () => {
      const result = getFeedKeywords({ ...base, 'hide-by-age': 'week' })
      expect(result).toContain('2w •')
      expect(result).toContain('3w •')
      expect(result).toContain('4w •')
      expect(result).not.toContain('1w •')
    })

    it('includes cascade sentinels for month and year', () => {
      const result = getFeedKeywords({ ...base, 'hide-by-age': 'week' })
      expect(result).toContain('mo •')
      expect(result).toContain('y •')
    })
  })

  describe('age = "month"', () => {
    it('includes month markers 2mo through 12mo', () => {
      const result = getFeedKeywords({ ...base, 'hide-by-age': 'month' })
      for (let x = 2; x <= 12; x++) {
        expect(result).toContain(`${x}mo •`)
      }
      expect(result).not.toContain('1mo •')
    })

    it('includes a year sentinel', () => {
      const result = getFeedKeywords({ ...base, 'hide-by-age': 'month' })
      expect(result).toContain('y •')
    })
  })

  describe('age = "year"', () => {
    it('includes exactly years 2y through 5y and nothing else', () => {
      const result = getFeedKeywords({ ...base, 'hide-by-age': 'year' })
      expect(result).toEqual(['2y •', '3y •', '4y •', '5y •'])
    })
  })
})
