import { describe, it, expect } from 'vitest'
import { SCOTS_WORD_LEXICON } from '../../src/features/scots-lexicon.js'

// Every other test that touches scottish-mode.js mocks this module out with
// a small fixture, so the real data file is otherwise never imported by the
// test suite — nothing would catch a corrupted or malformed entry (this is
// exactly how a duplicated/out-of-order block once slipped in unnoticed
// from a manual edit). These tests import the real module to guard its
// structural integrity, not the rewrite behaviour it feeds.
describe('SCOTS_WORD_LEXICON', () => {
  const entries = Object.entries(SCOTS_WORD_LEXICON)

  it('is a non-empty object', () => {
    expect(entries.length).toBeGreaterThan(0)
  })

  it('has non-empty string keys and values', () => {
    for (const [key, value] of entries) {
      expect(typeof key).toBe('string')
      expect(key.length).toBeGreaterThan(0)
      expect(typeof value).toBe('string')
      expect(value.length).toBeGreaterThan(0)
    }
  })

  it('has no duplicate keys', () => {
    const keys = entries.map(([key]) => key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('keeps keys sorted alphabetically', () => {
    const keys = entries.map(([key]) => key)
    const sorted = [...keys].sort((a, b) => a.localeCompare(b))
    expect(keys).toEqual(sorted)
  })
})
