import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

vi.mock('../../src/lib/transformers.min.js', () => ({
  pipeline: vi.fn(),
  env: { backends: { onnx: { wasm: {} } } },
}))

let semanticCheck
let pipelineMock
let mockEmbedFn

beforeEach(async () => {
  vi.resetModules()
  const transformers = await import('../../src/lib/transformers.min.js')
  pipelineMock = transformers.pipeline
  pipelineMock.mockReset()
  mockEmbedFn = vi.fn()
  pipelineMock.mockResolvedValue(mockEmbedFn)
  semanticCheck = (await import('../../src/features/semantic-filter.js')).semanticCheck
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const makeEmbedding = (vec) => ({ data: vec })

describe('semanticCheck', () => {
  it('returns 1.0 for identical normalized embeddings', async () => {
    const vec = [1, 0, 0]
    mockEmbedFn.mockResolvedValue(makeEmbedding(vec))
    const score = await semanticCheck(['hustle culture'], 'rise and grind')
    expect(score).toBeCloseTo(1.0)
  })

  it('returns 0.0 for orthogonal embeddings', async () => {
    mockEmbedFn
      .mockResolvedValueOnce(makeEmbedding([1, 0, 0]))
      .mockResolvedValueOnce(makeEmbedding([0, 1, 0]))
    const score = await semanticCheck(['hustle culture'], 'strawberry jam recipe')
    expect(score).toBeCloseTo(0.0)
  })

  it('returns the maximum score across multiple queries', async () => {
    mockEmbedFn
      .mockResolvedValueOnce(makeEmbedding([1, 0, 0]))
      .mockResolvedValueOnce(makeEmbedding([0, 1, 0]))
      .mockResolvedValueOnce(makeEmbedding([0, 1, 0]))
    const score = await semanticCheck(['query one', 'query two'], 'post text')
    expect(score).toBeCloseTo(1.0)
  })

  it('calls pipeline with the feature-extraction model', async () => {
    mockEmbedFn.mockResolvedValue(makeEmbedding([1, 0]))
    await semanticCheck(['topic'], 'post text')
    expect(pipelineMock).toHaveBeenCalledWith('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      quantized: true,
    })
  })

  it('truncates query and post text to 256 characters', async () => {
    mockEmbedFn.mockResolvedValue(makeEmbedding([1, 0]))
    const longText = 'A'.repeat(500)
    await semanticCheck([longText], longText)
    const [firstCall, secondCall] = mockEmbedFn.mock.calls
    expect(firstCall[0].length).toBe(256)
    expect(secondCall[0].length).toBe(256)
  })

  it('reuses the cached query embeddings on subsequent calls with the same queries', async () => {
    mockEmbedFn.mockResolvedValue(makeEmbedding([1, 0]))
    await semanticCheck(['hustle culture'], 'post one')
    await semanticCheck(['hustle culture'], 'post two')
    expect(mockEmbedFn).toHaveBeenCalledTimes(3) // 1 query + 2 posts
  })

  it('re-embeds queries when the list changes', async () => {
    mockEmbedFn.mockResolvedValue(makeEmbedding([1, 0]))
    await semanticCheck(['hustle culture'], 'post one')
    await semanticCheck(['javascript'], 'post one')
    expect(mockEmbedFn).toHaveBeenCalledTimes(4) // 2 queries + 2 posts
  })

  it('reuses the pipeline for concurrent calls', async () => {
    mockEmbedFn.mockResolvedValue(makeEmbedding([1, 0]))
    await Promise.all([
      semanticCheck(['topic'], 'post a'),
      semanticCheck(['topic'], 'post b'),
    ])
    expect(pipelineMock).toHaveBeenCalledTimes(1)
  })

  it('sets wasmPaths when chrome.runtime.getURL is available', async () => {
    vi.resetModules()
    const getURL = vi.fn().mockReturnValue('chrome-extension://abc/src/lib/')
    vi.stubGlobal('chrome', { runtime: { getURL } })

    const transformers = await import('../../src/lib/transformers.min.js')
    transformers.pipeline.mockResolvedValue(
      vi.fn().mockResolvedValue(makeEmbedding([1, 0]))
    )

    const { semanticCheck: sc } = await import('../../src/features/semantic-filter.js')
    await sc(['topic'], 'post')

    expect(getURL).toHaveBeenCalledWith('src/lib/')
    expect(transformers.env.backends.onnx.wasm.wasmPaths).toBe('chrome-extension://abc/src/lib/')
  })
})
