import { describe, it, expect } from 'vitest'
import { renderDamageReport } from '../src/stats-renderer.js'

const makeEl = (text = '0') => ({ textContent: text, innerHTML: '' })

const makeElements = () => ({
  slopEl: makeEl(),
  filteredEl: makeEl(),
  signalsEl: makeEl(),
})

const ZERO = { postsFiltered: 0, slopCollapsed: 0, slopHidden: 0, signals: {} }

describe('renderDamageReport', () => {
  it('shows zeros when stats are empty', () => {
    const els = makeElements()
    renderDamageReport(ZERO, els)
    expect(els.slopEl.textContent).toBe(0)
    expect(els.filteredEl.textContent).toBe(0)
    expect(els.signalsEl.innerHTML).toBe('')
  })

  it('sums slopCollapsed and slopHidden into the slop element', () => {
    const els = makeElements()
    renderDamageReport({ ...ZERO, slopCollapsed: 7, slopHidden: 3 }, els)
    expect(els.slopEl.textContent).toBe(10)
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
    expect(els.signalsEl.innerHTML).toContain('"game-changer"')
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
