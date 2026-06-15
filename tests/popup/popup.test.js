// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

const mockGet = vi.fn()
const mockSet = vi.fn()
const mockQuery = vi.fn()
const mockSendMessage = vi.fn()

beforeEach(async () => {
  vi.resetModules()
  mockGet.mockReset()
  mockSet.mockReset()
  mockQuery.mockReset()
  mockSendMessage.mockReset()

  vi.stubGlobal('chrome', {
    storage: { local: { get: mockGet, set: mockSet } },
    tabs: { query: mockQuery, sendMessage: mockSendMessage },
    runtime: {},
  })
  // Return each requested key as true so the "if stored value !== undefined" branch fires
  mockGet.mockImplementation((keys, cb) => {
    const res = {}
    if (Array.isArray(keys)) keys.forEach((k) => { res[k] = true })
    cb && cb(res)
  })
  mockQuery.mockImplementation((_, cb) => cb([{ id: 1 }]))
  vi.stubGlobal('Tagify', function MockTagify() { this.addTags = vi.fn() })

  document.body.innerHTML = `
    <div id="feed-tab" class="content-tab"></div>
    <div id="jobs-tab" class="content-tab"></div>
    <button class="tab" title="feed-tab">Feed</button>
    <button class="tab is-active" title="jobs-tab">Jobs</button>
    <input id="main-toggle" class="switch" type="checkbox" />
    <div id="settings-panel"></div>
    <select id="hide-by-age"></select>
    <input id="hide-by-keywords" />
    <input id="hide-by-job-keywords" />
    <button id="reset-btn" title="reset-blocked-posts">Reset</button>
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

  it('opens the named tab when a tab button is clicked', () => {
    document.querySelectorAll('.tab')[0].click()
    expect(document.getElementById('feed-tab').style.display).toBe('block')
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

  it('saves select value to storage when a select changes', () => {
    document.querySelector('select').dispatchEvent(new Event('change'))
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ 'hide-by-age': '' }))
  })

  it('sends action message to active tab when action button is clicked', async () => {
    document.getElementById('reset-btn').click()
    await Promise.resolve()
    expect(mockSendMessage).toHaveBeenCalledWith(1, { 'reset-btn': true })
  })

  it('saves feed keywords to storage when feed input changes', () => {
    document.getElementById('hide-by-keywords').dispatchEvent(new Event('change'))
    expect(mockSet).toHaveBeenCalledWith({ 'feed-keywords': '' }, expect.any(Function))
  })

  it('saves job keywords to storage when job input changes', () => {
    document.getElementById('hide-by-job-keywords').dispatchEvent(new Event('change'))
    expect(mockSet).toHaveBeenCalledWith({ 'job-keywords': '' }, expect.any(Function))
  })
})
