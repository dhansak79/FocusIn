import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../src/features/semantic-filter.js', () => ({
  semanticCheck: vi.fn(),
}))

vi.mock('../src/features/tone-filter.js', () => ({
  toneCheck: vi.fn(),
}))

vi.mock('../src/features/scottish-mode.js', () => ({
  scottishRewrite: vi.fn(),
}))

let capturedInstallListener = null
let capturedMessageListener = null
const mockGet = vi.fn()
const mockSet = vi.fn()

const stubChrome = () =>
  vi.stubGlobal('chrome', {
    runtime: {
      onInstalled: {
        addListener: vi.fn((fn) => {
          capturedInstallListener = fn
        }),
      },
      onMessage: {
        addListener: vi.fn((fn) => {
          capturedMessageListener = fn
        }),
      },
    },
    storage: {
      local: { get: mockGet, set: mockSet },
    },
  })

beforeEach(async () => {
  vi.resetModules()
  capturedInstallListener = null
  capturedMessageListener = null
  mockGet.mockReset()
  mockSet.mockReset()
  stubChrome()
  await import('../src/service_worker.js')
})

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('onInstalled', () => {
  it('does nothing when reason is not install', async () => {
    await capturedInstallListener({ reason: 'update' })
    expect(mockGet).not.toHaveBeenCalled()
    expect(mockSet).not.toHaveBeenCalled()
  })

  it('does not set defaults when already initialized', async () => {
    mockGet.mockResolvedValue({ initialized: 'v1.0' })
    await capturedInstallListener({ reason: 'install' })
    expect(mockSet).not.toHaveBeenCalled()
  })

  it('sets all defaults on a fresh install', async () => {
    mockGet.mockResolvedValue({})
    await capturedInstallListener({ reason: 'install' })
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        initialized: 'v1.0',
        'main-toggle': true,
        'feed-keywords': '',
        'detect-slop': true,
        'slop-archetype': true,
        'semantic-filter': expect.any(String),
        'tone-filter': false,
        'tone-threshold': 70,
      })
    )
  })

  it('does not set removed feature defaults on a fresh install', async () => {
    mockGet.mockResolvedValue({})
    await capturedInstallListener({ reason: 'install' })
    const setArg = mockSet.mock.calls[0][0]
    expect(setArg).not.toHaveProperty('hide-whole-feed')
    expect(setArg).not.toHaveProperty('sort-by-recent')
    expect(setArg).not.toHaveProperty('hide-by-age')
    expect(setArg).not.toHaveProperty('hide-liked')
    expect(setArg).not.toHaveProperty('hide-suggested')
    expect(setArg).not.toHaveProperty('hide-premium')
    expect(setArg).not.toHaveProperty('job-keywords')
    expect(setArg).not.toHaveProperty('hide-slop')
  })
})

describe('onMessage — scottish-rewrite', () => {
  it('sends the rewritten text', async () => {
    const { scottishRewrite } = await import('../src/features/scottish-mode.js')
    scottishRewrite.mockResolvedValue({ text: "Aye, we shipped somethin' new." })
    const sendResponse = vi.fn()
    capturedMessageListener({ 'scottish-rewrite': { post: 'We shipped a new feature.' } }, {}, sendResponse)
    await flushPromises()
    expect(scottishRewrite).toHaveBeenCalledWith('We shipped a new feature.')
    expect(sendResponse).toHaveBeenCalledWith({ text: "Aye, we shipped somethin' new." })
  })

  it('returns true to signal an async response', async () => {
    const { scottishRewrite } = await import('../src/features/scottish-mode.js')
    scottishRewrite.mockResolvedValue({ text: 'rewritten' })
    expect(capturedMessageListener({ 'scottish-rewrite': { post: 'content' } }, {}, vi.fn())).toBe(true)
  })

  it('sends null text when scottishRewrite rejects', async () => {
    const { scottishRewrite } = await import('../src/features/scottish-mode.js')
    scottishRewrite.mockRejectedValue(new Error('model failed'))
    const sendResponse = vi.fn()
    capturedMessageListener({ 'scottish-rewrite': { post: 'content' } }, {}, sendResponse)
    await flushPromises()
    expect(sendResponse).toHaveBeenCalledWith({ text: null })
  })
})

describe('onMessage — semantic-check', () => {
  it('does nothing for unrelated messages', () => {
    const result = capturedMessageListener({ other: true }, {}, vi.fn())
    expect(result).toBeUndefined()
  })

  it('sends the similarity score and matched topic', async () => {
    const { semanticCheck } = await import('../src/features/semantic-filter.js')
    semanticCheck.mockResolvedValue({ score: 0.72, topic: 'hustle culture' })
    const sendResponse = vi.fn()
    capturedMessageListener(
      { 'semantic-check': { queries: ['hustle culture'], post: 'rise and grind' } },
      {},
      sendResponse
    )
    await flushPromises()
    expect(semanticCheck).toHaveBeenCalledWith(['hustle culture'], 'rise and grind')
    expect(sendResponse).toHaveBeenCalledWith({ score: 0.72, topic: 'hustle culture' })
  })
})

describe('onMessage — slop-archetype-check', () => {
  it('sends the similarity score and matched archetype topic', async () => {
    const { semanticCheck } = await import('../src/features/semantic-filter.js')
    semanticCheck.mockResolvedValue({ score: 0.42, topic: 'manufactured courage' })
    const sendResponse = vi.fn()
    capturedMessageListener(
      { 'slop-archetype-check': { post: 'I had to work up the nerve to walk in' } },
      {},
      sendResponse
    )
    await flushPromises()
    expect(sendResponse).toHaveBeenCalledWith({ score: 0.42, topic: 'manufactured courage' })
  })

  it('calls semanticCheck with SLOP_ARCHETYPES as the queries', async () => {
    const { semanticCheck } = await import('../src/features/semantic-filter.js')
    const { SLOP_ARCHETYPES } = await import('../src/features/slop-keywords.js')
    semanticCheck.mockResolvedValue({ score: 0.4, topic: 'lone voice' })
    capturedMessageListener(
      { 'slop-archetype-check': { post: 'some post text' } },
      {},
      vi.fn()
    )
    await flushPromises()
    expect(semanticCheck).toHaveBeenCalledWith(SLOP_ARCHETYPES, 'some post text')
  })
})

describe('onMessage — tone-check', () => {
  it('sends the tone score and label', async () => {
    const { toneCheck } = await import('../src/features/tone-filter.js')
    toneCheck.mockResolvedValue({ score: 0.85, label: 'NEGATIVE' })
    const sendResponse = vi.fn()
    capturedMessageListener({ 'tone-check': { post: 'outrage bait content' } }, {}, sendResponse)
    await flushPromises()
    expect(toneCheck).toHaveBeenCalledWith('outrage bait content')
    expect(sendResponse).toHaveBeenCalledWith({ score: 0.85, label: 'NEGATIVE' })
  })

  it('returns true to signal an async response', async () => {
    const { toneCheck } = await import('../src/features/tone-filter.js')
    toneCheck.mockResolvedValue({ score: 0.5, label: 'POSITIVE' })
    expect(capturedMessageListener({ 'tone-check': { post: 'content' } }, {}, vi.fn())).toBe(true)
  })

  it('sends score 0 and POSITIVE label when toneCheck rejects', async () => {
    const { toneCheck } = await import('../src/features/tone-filter.js')
    toneCheck.mockRejectedValue(new Error('model failed'))
    const sendResponse = vi.fn()
    capturedMessageListener({ 'tone-check': { post: 'content' } }, {}, sendResponse)
    await flushPromises()
    expect(sendResponse).toHaveBeenCalledWith({ score: 0, label: 'POSITIVE' })
  })
})

describe.each([
  ['semantic-check', { 'semantic-check': { queries: ['hustle culture'], post: 'rise and grind' } }],
  ['slop-archetype-check', { 'slop-archetype-check': { post: 'I had to work up the nerve to walk in' } }],
])('onMessage — %s', (_msgType, msg) => {
  it('returns true to signal an async response', async () => {
    const { semanticCheck } = await import('../src/features/semantic-filter.js')
    semanticCheck.mockResolvedValue({ score: 0.5, topic: 'topic' })
    expect(capturedMessageListener(msg, {}, vi.fn())).toBe(true)
  })

  it('sends score 0 when semanticCheck rejects', async () => {
    const { semanticCheck } = await import('../src/features/semantic-filter.js')
    semanticCheck.mockRejectedValue(new Error('model failed'))
    const sendResponse = vi.fn()
    capturedMessageListener(msg, {}, sendResponse)
    await flushPromises()
    expect(sendResponse).toHaveBeenCalledWith({ score: 0 })
  })
})
