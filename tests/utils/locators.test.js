// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { findElement } from '../../src/utils.js'

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('findElement', () => {
  it('returns the element matching the first candidate', () => {
    document.body.innerHTML = '<div id="a"></div>'
    expect(findElement(['#a', '#b']).id).toBe('a')
  })

  it('falls back to the second candidate when the first does not match', () => {
    document.body.innerHTML = '<div id="b"></div>'
    expect(findElement(['#a', '#b']).id).toBe('b')
  })

  it('prefers the first candidate when both are present', () => {
    document.body.innerHTML = '<div id="a"></div><div id="b"></div>'
    expect(findElement(['#a', '#b']).id).toBe('a')
  })

  it('returns null when no candidate matches', () => {
    document.body.innerHTML = '<div id="c"></div>'
    expect(findElement(['#a', '#b'])).toBeNull()
  })

  it('returns null for an empty candidates array', () => {
    expect(findElement([])).toBeNull()
  })

  it('skips candidates that return null and continues to the next', () => {
    document.body.innerHTML = '<div id="c"></div><div id="d"></div>'
    expect(findElement(['#a', '#b', '#c', '#d']).id).toBe('c')
  })
})
