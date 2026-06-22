// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

const mockGet = vi.fn()
const mockSet = vi.fn()
let tagifyInstances = []

beforeEach(async () => {
  vi.resetModules()
  mockGet.mockReset()
  mockSet.mockReset()
  tagifyInstances = []

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
    this.value = []
    tagifyInstances.push(this)
    if (opts?.originalInputValueFormat) opts.originalInputValueFormat([{ value: 'test' }])
  })

  document.body.innerHTML = `
    <input id="main-toggle" class="switch" type="checkbox" />
    <div id="focusin-panels">
      <div id="tab-bar">
        <button type="button" id="tab-filters" class="tab-btn active">Filters</button>
        <button type="button" id="tab-authors" class="tab-btn">Authors</button>
        <button type="button" id="tab-blocked" class="tab-btn">Blocked</button>
      </div>
      <div id="settings-panel" class="tab-panel active">
        <input id="tone-filter" class="switch is-rounded" type="checkbox" />
        <input id="tone-threshold" type="range" min="0" max="100" value="70" />
        <span id="tone-threshold-value">70</span>
      </div>
      <div id="authors-panel" class="tab-panel">
        <input id="author-whitelist" />
      </div>
      <div id="blocked-panel" class="tab-panel">
        <div id="author-tally-list"></div>
      </div>
    </div>
    <input id="hide-by-keywords" />
    <input type="checkbox" class="semantic-topic" value="hustle culture" />
    <input type="checkbox" class="semantic-topic" value="cryptocurrency" />
    <input type="checkbox" class="semantic-topic" value="political content" />
    <input type="checkbox" class="semantic-topic" value="war and conflict" />
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

  it('hides panels when main toggle is unchecked', () => {
    const toggle = document.getElementById('main-toggle')
    toggle.checked = false
    toggle.dispatchEvent(new Event('change'))
    expect(document.getElementById('focusin-panels').style.display).toBe('none')
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
    expect(mockSet).toHaveBeenCalledWith({ 'semantic-filter': 'hustle culture, cryptocurrency, political content, war and conflict' }, expect.any(Function))
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

  it('switches to Authors tab and shows authors panel', () => {
    document.getElementById('tab-authors').click()
    expect(document.getElementById('tab-authors').classList.contains('active')).toBe(true)
    expect(document.getElementById('tab-filters').classList.contains('active')).toBe(false)
    expect(document.getElementById('authors-panel').classList.contains('active')).toBe(true)
    expect(document.getElementById('settings-panel').classList.contains('active')).toBe(false)
  })

  it('switches back to Filters tab when Filters is clicked', () => {
    document.getElementById('tab-authors').click()
    document.getElementById('tab-filters').click()
    expect(document.getElementById('tab-filters').classList.contains('active')).toBe(true)
    expect(document.getElementById('settings-panel').classList.contains('active')).toBe(true)
    expect(document.getElementById('authors-panel').classList.contains('active')).toBe(false)
  })

  it('switches to Blocked tab and shows blocked panel', () => {
    document.getElementById('tab-blocked').click()
    expect(document.getElementById('tab-blocked').classList.contains('active')).toBe(true)
    expect(document.getElementById('tab-filters').classList.contains('active')).toBe(false)
    expect(document.getElementById('tab-authors').classList.contains('active')).toBe(false)
    expect(document.getElementById('blocked-panel').classList.contains('active')).toBe(true)
    expect(document.getElementById('settings-panel').classList.contains('active')).toBe(false)
    expect(document.getElementById('authors-panel').classList.contains('active')).toBe(false)
  })

  it('switches back to Filters tab from Blocked tab', () => {
    document.getElementById('tab-blocked').click()
    document.getElementById('tab-filters').click()
    expect(document.getElementById('tab-filters').classList.contains('active')).toBe(true)
    expect(document.getElementById('blocked-panel').classList.contains('active')).toBe(false)
    expect(document.getElementById('tab-blocked').classList.contains('active')).toBe(false)
  })

  it('renders author tally in blocked panel on window.onload when authors are stored', async () => {
    const TODAY = new Date().toISOString().slice(0, 10)
    mockGet.mockImplementation((keys, cb) => {
      if (Array.isArray(keys) && keys.includes('focusin-stats')) {
        cb({
          'focusin-stats': { postsFiltered: 0, slopCollapsed: 0, signals: {}, authors: { 'grace-hopper': { name: 'Grace Hopper', count: 3 } } },
          'focusin-stats-date': TODAY,
        })
      } else {
        cb({})
      }
    })
    window.onload()
    await Promise.resolve()
    expect(document.getElementById('author-tally-list').innerHTML).toContain('Grace Hopper')
  })

  it('renders empty state in blocked panel when no authors blocked today', async () => {
    mockGet.mockImplementation((_, cb) => cb && cb({}))
    window.onload()
    await Promise.resolve()
    expect(document.getElementById('author-tally-list').innerHTML).toContain('No posts blocked today')
  })

  it('saves author whitelist to storage when author-whitelist input changes (vanity from tag.vanity)', () => {
    // tagifyInstances[2] is authorWhitelistTagify (feedTagify=0, customTopicTagify=1, authorTagify=2)
    tagifyInstances[2].value = [{ value: 'John Doe', vanity: 'john-doe' }]
    document.getElementById('author-whitelist').dispatchEvent(new Event('change'))
    expect(mockSet).toHaveBeenCalledWith({ 'author-whitelist': [{ vanity: 'john-doe', name: 'John Doe' }] })
  })

  it('falls back to tag.value as vanity when tag.vanity is absent', () => {
    tagifyInstances[2].value = [{ value: 'jane-smith' }]
    document.getElementById('author-whitelist').dispatchEvent(new Event('change'))
    expect(mockSet).toHaveBeenCalledWith({ 'author-whitelist': [{ vanity: 'jane-smith', name: 'jane-smith' }] })
  })

  it('loads whitelisted authors into Tagify with name and vanity on window.onload', async () => {
    mockGet.mockImplementation((keyOrObj, cb) => {
      if (typeof keyOrObj === 'object') {
        cb({ 'author-whitelist': [{ vanity: 'john-doe', name: 'John Doe' }, { vanity: 'no-name' }] })
      } else {
        cb({})
      }
    })
    window.onload()
    await Promise.resolve()
    expect(tagifyInstances[2].addTags).toHaveBeenCalledWith([
      { value: 'John Doe', vanity: 'john-doe' },
      { value: 'no-name', vanity: 'no-name' },
    ])
  })

  it('skips addTags when author-whitelist entries are empty on load', async () => {
    mockGet.mockImplementation((keyOrObj, cb) => {
      if (typeof keyOrObj === 'object') {
        cb({ 'author-whitelist': [] })
      } else {
        cb({})
      }
    })
    window.onload()
    await Promise.resolve()
    expect(tagifyInstances[2].addTags).not.toHaveBeenCalled()
  })

  it('handles non-array author-whitelist value from storage without throwing', async () => {
    mockGet.mockImplementation((keyOrObj, cb) => {
      if (typeof keyOrObj === 'object') {
        cb({ 'author-whitelist': 'invalid' })
      } else {
        cb({})
      }
    })
    expect(() => { window.onload() }).not.toThrow()
  })

  it('saves tone-filter to storage when tone-filter switch changes', () => {
    const toggle = document.getElementById('tone-filter')
    toggle.checked = true
    toggle.dispatchEvent(new Event('change'))
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ 'tone-filter': true }))
  })

  it('saves tone-threshold to storage when slider changes', () => {
    const slider = document.getElementById('tone-threshold')
    slider.value = '80'
    slider.dispatchEvent(new Event('input'))
    expect(mockSet).toHaveBeenCalledWith({ 'tone-threshold': 80 })
  })

  it('updates tone-threshold-value label when slider changes', () => {
    const slider = document.getElementById('tone-threshold')
    slider.value = '55'
    slider.dispatchEvent(new Event('input'))
    expect(document.getElementById('tone-threshold-value').textContent).toBe('55')
  })

  it('loads tone-threshold from storage and sets slider and label on window.onload', async () => {
    mockGet.mockImplementation((keyOrObj, cb) => {
      if (typeof keyOrObj === 'object' && 'tone-threshold' in keyOrObj) {
        cb({ 'tone-threshold': 85 })
      } else {
        cb({})
      }
    })
    window.onload()
    await Promise.resolve()
    expect(document.getElementById('tone-threshold').value).toBe('85')
    expect(document.getElementById('tone-threshold-value').textContent).toBe('85')
  })

  it('political content checkbox is unchecked when not in stored semantic-filter', async () => {
    mockGet.mockImplementation((key, cb) => {
      if (key === 'semantic-filter') cb({ 'semantic-filter': 'hustle culture' })
      else cb({})
    })
    window.onload()
    await Promise.resolve()
    const cb = document.querySelector('.semantic-topic[value="political content"]')
    expect(cb.checked).toBe(false)
  })

  it('war and conflict checkbox is unchecked when not in stored semantic-filter', async () => {
    mockGet.mockImplementation((key, cb) => {
      if (key === 'semantic-filter') cb({ 'semantic-filter': 'hustle culture' })
      else cb({})
    })
    window.onload()
    await Promise.resolve()
    const cb = document.querySelector('.semantic-topic[value="war and conflict"]')
    expect(cb.checked).toBe(false)
  })

  it('checking political content saves it to semantic-filter storage', () => {
    const cb = document.querySelector('.semantic-topic[value="political content"]')
    cb.checked = true
    cb.dispatchEvent(new Event('change'))
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ 'semantic-filter': expect.stringContaining('political content') }),
      expect.any(Function)
    )
  })
})
