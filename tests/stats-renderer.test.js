import { describe, it, expect } from 'vitest'
import { renderAuthorTally, renderDamageReport, renderHallOfShame } from '../src/stats-renderer.js'

const makeEl = (text = '0') => ({ textContent: text, innerHTML: '' })

const makeElements = () => ({
  slopEl: makeEl(),
  filteredEl: makeEl(),
  signalsEl: makeEl(),
})

const ZERO = { postsFiltered: 0, slopCollapsed: 0, signals: {} }

const makeContainer = () => ({ innerHTML: '' })

describe('renderAuthorTally', () => {
  it('renders empty state when authorStats is empty', () => {
    const el = makeContainer()
    renderAuthorTally({}, el)
    expect(el.innerHTML).toContain('No posts blocked today')
  })

  it('renders authors sorted by count descending', () => {
    const el = makeContainer()
    renderAuthorTally({
      'alice': { name: 'Alice', count: 2 },
      'bob': { name: 'Bob', count: 7 },
      'carol': { name: 'Carol', count: 4 },
    }, el)
    const names = [...el.innerHTML.matchAll(/class="author-tally-name">([^<]+)</g)].map((m) => m[1])
    expect(names).toEqual(['Bob', 'Carol', 'Alice'])
  })

  it('caps list at 20 entries', () => {
    const el = makeContainer()
    const authors = Object.fromEntries(
      Array.from({ length: 25 }, (_, i) => [`author-${i}`, { name: `Author ${i}`, count: 25 - i }])
    )
    renderAuthorTally(authors, el)
    const items = el.innerHTML.match(/author-tally-item/g) ?? []
    expect(items.length).toBe(20)
  })

  it('renders author name and count in each row', () => {
    const el = makeContainer()
    renderAuthorTally({ 'grace-hopper': { name: 'Grace Hopper', count: 5 } }, el)
    expect(el.innerHTML).toContain('Grace Hopper')
    expect(el.innerHTML).toContain('>5<')
  })

  it('does nothing when containerEl is null', () => {
    expect(() => renderAuthorTally({ 'a': { name: 'A', count: 1 } }, null)).not.toThrow()
  })

  it('renders empty state when authorStats is null', () => {
    const el = makeContainer()
    renderAuthorTally(null, el)
    expect(el.innerHTML).toContain('No posts blocked today')
  })

  it('HTML metacharacters in author name are escaped', () => {
    const el = makeContainer()
    renderAuthorTally({ 'xss': { name: '<img src=x onerror=alert(1)>', count: 1 } }, el)
    expect(el.innerHTML).not.toContain('<img')
    expect(el.innerHTML).toContain('&lt;img')
  })
})

describe('renderHallOfShame', () => {
  it('Scenario: Hall of Shame panel shows empty-state message when no authors flagged', () => {
    const el = makeContainer()
    renderHallOfShame({}, el)
    expect(el.innerHTML).toContain('No authors in the Hall of Shame yet')
  })

  it('Scenario: Hall of Shame panel renders author list ranked by count descending', () => {
    const el = makeContainer()
    renderHallOfShame({
      'alice': { name: 'Alice', count: 2 },
      'bob': { name: 'Bob', count: 9 },
      'carol': { name: 'Carol', count: 5 },
    }, el)
    const names = [...el.innerHTML.matchAll(/class="author-tally-name">([^<]+)</g)].map((m) => m[1])
    expect(names).toEqual(['Bob', 'Carol', 'Alice'])
  })

  it('does not cap list at 20 entries (all-time list is uncapped)', () => {
    const el = makeContainer()
    const authors = Object.fromEntries(
      Array.from({ length: 25 }, (_, i) => [`author-${i}`, { name: `Author ${i}`, count: 25 - i }])
    )
    renderHallOfShame(authors, el)
    const items = el.innerHTML.match(/author-tally-item/g) ?? []
    expect(items.length).toBe(25)
  })

  it('renders null stats as empty state', () => {
    const el = makeContainer()
    renderHallOfShame(null, el)
    expect(el.innerHTML).toContain('No authors in the Hall of Shame yet')
  })
})

describe('renderDamageReport', () => {
  it('shows zeros when stats are empty', () => {
    const els = makeElements()
    renderDamageReport(ZERO, els)
    expect(els.slopEl.textContent).toBe(0)
    expect(els.filteredEl.textContent).toBe(0)
    expect(els.signalsEl.innerHTML).toBe('')
  })

  it('shows slopCollapsed in the slop element', () => {
    const els = makeElements()
    renderDamageReport({ ...ZERO, slopCollapsed: 7 }, els)
    expect(els.slopEl.textContent).toBe(7)
  })

  it('sets postsFiltered into the filtered element', () => {
    const els = makeElements()
    renderDamageReport({ ...ZERO, postsFiltered: 42 }, els)
    expect(els.filteredEl.textContent).toBe(42)
  })

  it('renders top 5 signals sorted by count descending', () => {
    const els = makeElements()
    renderDamageReport({
      ...ZERO,
      signals: { 'em dash': 5, 'line stacking': 2, '"game-changer"': 8, 'arrow bullets': 1, 'emoji bullets': 4, 'raw markdown': 3, 'emoji overload': 0 },
    }, els)
    expect(els.signalsEl.innerHTML).toContain('&quot;game-changer&quot;')
    expect(els.signalsEl.innerHTML).toContain('em dash')
    expect(els.signalsEl.innerHTML).toContain('emoji bullets')
    expect(els.signalsEl.innerHTML).toContain('raw markdown')
    expect(els.signalsEl.innerHTML).toContain('line stacking')
    expect(els.signalsEl.innerHTML).not.toContain('arrow bullets')
    expect(els.signalsEl.innerHTML).not.toContain('emoji overload')
  })

  it('renders signal count with times symbol', () => {
    const els = makeElements()
    renderDamageReport({ ...ZERO, signals: { 'em dash': 3 } }, els)
    expect(els.signalsEl.innerHTML).toContain('3&times;')
  })

  it('does not update signalsEl when there are no signals', () => {
    const els = makeElements()
    els.signalsEl.innerHTML = 'previous'
    renderDamageReport(ZERO, els)
    expect(els.signalsEl.innerHTML).toBe('previous')
  })

  it('handles null signalsEl gracefully', () => {
    const els = { slopEl: makeEl(), filteredEl: makeEl(), signalsEl: null }
    expect(() =>
      renderDamageReport({ ...ZERO, signals: { 'em dash': 1 } }, els)
    ).not.toThrow()
  })
})
