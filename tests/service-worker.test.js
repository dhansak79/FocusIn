import { vi, describe, it, expect, beforeEach } from 'vitest'

let capturedListener = null
const mockGet = vi.fn()
const mockSet = vi.fn()

const stubChrome = () =>
  vi.stubGlobal('chrome', {
    runtime: {
      onInstalled: {
        addListener: vi.fn((fn) => {
          capturedListener = fn
        }),
      },
    },
    storage: {
      local: { get: mockGet, set: mockSet },
    },
  })

beforeEach(async () => {
  vi.resetModules()
  capturedListener = null
  mockGet.mockReset()
  mockSet.mockReset()
  stubChrome()
  await import('../src/service_worker.js')
})

describe('onInstalled', () => {
  it('does nothing when reason is not install', async () => {
    await capturedListener({ reason: 'update' })
    expect(mockGet).not.toHaveBeenCalled()
    expect(mockSet).not.toHaveBeenCalled()
  })

  it('does not set defaults when already initialized', async () => {
    mockGet.mockResolvedValue({ initialized: 'v0.5' })
    await capturedListener({ reason: 'install' })
    expect(mockSet).not.toHaveBeenCalled()
  })

  it('sets all defaults on a fresh install', async () => {
    mockGet.mockResolvedValue({})
    await capturedListener({ reason: 'install' })
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        initialized: 'v0.5',
        'gentle-mode': true,
        'main-toggle': true,
        'hide-whole-feed': false,
        'hide-by-age': 'week',
        'feed-keywords': '',
        'hide-liked': true,
        'hide-suggested': true,
        'sort-by-recent': true,
        'detect-slop': false,
        'hide-slop': false,
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
