import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../src/features/semantic-filter.js', () => ({
  semanticCheck: vi.fn(),
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
    mockGet.mockResolvedValue({ initialized: 'v0.5' })
    await capturedInstallListener({ reason: 'install' })
    expect(mockSet).not.toHaveBeenCalled()
  })

  it('sets all defaults on a fresh install', async () => {
    mockGet.mockResolvedValue({})
    await capturedInstallListener({ reason: 'install' })
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        initialized: 'v0.5',
        'main-toggle': true,
        'hide-whole-feed': false,
        'hide-by-age': 'week',
        'feed-keywords': '',
        'hide-liked': true,
        'hide-suggested': true,
        'sort-by-recent': true,
        'detect-slop': true,
        'hide-slop': false,
        'semantic-filter': expect.any(String),
        'hide-premium': true,
        'hide-advertisements': true,
        'hide-follow-recommendations': true,
        'hide-news': false,
        'hide-notification-count': false,
        'job-keywords': '',
        'hide-promoted-jobs': false,
      })
    )
  })
})

describe('onMessage — semantic-check', () => {
  it('does nothing for unrelated messages', () => {
    const result = capturedMessageListener({ other: true }, {}, vi.fn())
    expect(result).toBeUndefined()
  })

  it('returns true to signal an async response', async () => {
    const { semanticCheck } = await import('../src/features/semantic-filter.js')
    semanticCheck.mockResolvedValue({ score: 0.75, topic: 'hustle culture' })
    const result = capturedMessageListener(
      { 'semantic-check': { queries: ['hustle culture'], post: 'rise and grind' } },
      {},
      vi.fn()
    )
    expect(result).toBe(true)
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

  it('sends score 0 when semanticCheck rejects', async () => {
    const { semanticCheck } = await import('../src/features/semantic-filter.js')
    semanticCheck.mockRejectedValue(new Error('model failed'))
    const sendResponse = vi.fn()
    capturedMessageListener(
      { 'semantic-check': { queries: ['hustle culture'], post: 'text' } },
      {},
      sendResponse
    )
    await flushPromises()
    expect(sendResponse).toHaveBeenCalledWith({ score: 0 })
  })
})
