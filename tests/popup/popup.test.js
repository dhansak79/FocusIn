// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

const mockGet = vi.fn()
const mockSet = vi.fn()

beforeEach(async () => {
  vi.resetModules()
  mockGet.mockReset()
  mockSet.mockReset()

  vi.stubGlobal('chrome', {
    storage: { local: { get: mockGet, set: mockSet } },
    runtime: {},
  })
  // Return each requested key as true so the "if stored value !== undefined" branch fires
  mockGet.mockImplementation((keys, cb) => {
    const res = {}
    if (Array.isArray(keys)) keys.forEach((k) => { res[k] = true })
    cb && cb(res)
  })
  vi.stubGlobal('Tagify', function MockTagify(el, opts) {
    this.addTags = vi.fn()
    if (opts?.originalInputValueFormat) opts.originalInputValueFormat([{ value: 'test' }])
  })

  document.body.innerHTML = `
    <input id="main-toggle" class="switch" type="checkbox" />
    <div id="settings-panel"></div>
    <input id="hide-by-keywords" />
    <input type="checkbox" class="semantic-topic" value="hustle culture" />
    <input type="checkbox" class="semantic-topic" value="cryptocurrency" />
    <input id="semantic-custom-topics" />
    <button id="test-semantic-btn">Test model</button>
    <span id="semantic-test-result"></span>
    <div id="stat-slop">-</div>
    <div id="stat-filtered">-</div>
    <div id="top-signals"></div>
  `

  await import('../../src/popup/popup.js')
  document.dispatchEvent(new Event('DOMContentLoaded'))
  await Promise.resolve()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('popup', () => {
  it('renders zero stats on window.onload when storage is empty', async () => {
    mockGet.mockImplementation((_, cb) => cb && cb({}))
    window.onload()
    await Promise.resolve()
    expect(document.getElementById('stat-slop').textContent).toBe('0')
    expect(document.getElementById('stat-filtered').textContent).toBe('0')
  })

  it('saves toggle state to storage when a switch changes', () => {
    document.getElementById('main-toggle').dispatchEvent(new Event('change'))
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ 'main-toggle': expect.any(Boolean) }))
  })

  it('hides settings panel when main toggle is unchecked', () => {
    const toggle = document.getElementById('main-toggle')
    toggle.checked = false
    toggle.dispatchEvent(new Event('change'))
    expect(document.getElementById('settings-panel').style.display).toBe('none')
  })

  it('saves feed keywords to storage when feed input changes', () => {
    document.getElementById('hide-by-keywords').dispatchEvent(new Event('change'))
    expect(mockSet).toHaveBeenCalledWith({ 'feed-keywords': '' }, expect.any(Function))
  })

  it('saves checked semantic topics to storage when a topic is toggled', () => {
    const cb = document.querySelector('.semantic-topic[value="hustle culture"]')
    cb.checked = true
    cb.dispatchEvent(new Event('change'))
    expect(mockSet).toHaveBeenCalledWith({ 'semantic-filter': 'hustle culture' }, expect.any(Function))
  })

  it('includes custom topics alongside preset topics when saving', () => {
    const cb = document.querySelector('.semantic-topic[value="hustle culture"]')
    cb.checked = true
    document.getElementById('semantic-custom-topics').value = 'war, politics'
    cb.dispatchEvent(new Event('change'))
    expect(mockSet).toHaveBeenCalledWith({ 'semantic-filter': 'hustle culture, war, politics' }, expect.any(Function))
  })

  it('checks all semantic topics and saves defaults when semantic-filter is not in storage', async () => {
    mockGet.mockImplementation((_, cb) => cb && cb({}))
    window.onload()
    await Promise.resolve()
    const checkboxes = document.querySelectorAll('.semantic-topic')
    checkboxes.forEach((cb) => expect(cb.checked).toBe(true))
    expect(mockSet).toHaveBeenCalledWith({ 'semantic-filter': 'hustle culture, cryptocurrency' }, expect.any(Function))
  })

  it('restores saved semantic topic selection from storage on load', async () => {
    mockGet.mockImplementation((key, cb) => {
      if (key === 'semantic-filter') cb({ 'semantic-filter': 'cryptocurrency' })
      else cb({})
    })
    window.onload()
    await Promise.resolve()
    expect(document.querySelector('.semantic-topic[value="hustle culture"]').checked).toBe(false)
    expect(document.querySelector('.semantic-topic[value="cryptocurrency"]').checked).toBe(true)
  })

  it('shows no-topics message when test button clicked with no topics checked', () => {
    document.querySelectorAll('.semantic-topic').forEach((cb) => { cb.checked = false })
    document.getElementById('test-semantic-btn').click()
    expect(document.getElementById('semantic-test-result').textContent).toBe('No topics selected')
  })

  const stubRuntimeAndClickTest = (runtimeOverride) => {
    document.querySelector('.semantic-topic[value="hustle culture"]').checked = true
    const existing = window.chrome
    vi.stubGlobal('chrome', {
      ...existing,
      runtime: { ...existing.runtime, ...runtimeOverride },
    })
    document.getElementById('test-semantic-btn').click()
  }

  it('shows score when test button clicked and service worker responds', async () => {
    stubRuntimeAndClickTest({ lastError: null, sendMessage: vi.fn((_msg, cb) => cb({ score: 0.82 })) })
    await Promise.resolve()
    expect(document.getElementById('semantic-test-result').textContent).toContain('82%')
    expect(document.getElementById('semantic-test-result').textContent).toContain('Model loaded')
  })

  it('shows loading message when service worker returns no score', async () => {
    stubRuntimeAndClickTest({ lastError: null, sendMessage: vi.fn((_msg, cb) => cb({})) })
    await Promise.resolve()
    expect(document.getElementById('semantic-test-result').textContent).toContain('model may still be loading')
  })

  it('shows error message when service worker reports an error', async () => {
    stubRuntimeAndClickTest({ lastError: { message: 'Could not connect' }, sendMessage: vi.fn((_msg, cb) => cb(null)) })
    await Promise.resolve()
    expect(document.getElementById('semantic-test-result').textContent).toContain('Could not connect')
  })
})
