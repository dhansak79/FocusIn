import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

vi.mock('../../src/lib/transformers.min.js', () => ({
  pipeline: vi.fn(),
  env: { backends: { onnx: { wasm: {} } } },
}))

// The real lexicon is pure data (curated from a public Scots slang glossary)
// and deliberately excluded from mutation testing, same as slop-keywords.js.
// Tests here exercise the substitution *mechanism* against a small fixture,
// not the real 100+-entry dictionary.
vi.mock('../../src/features/scots-lexicon.js', () => ({
  SCOTS_WORD_LEXICON: { small: 'wee', know: 'ken', house: 'hoose' },
}))

let scottishRewrite
let pipelineMock
let mockRewriterFn

beforeEach(async () => {
  vi.resetModules()
  const transformers = await import('../../src/lib/transformers.min.js')
  pipelineMock = transformers.pipeline
  pipelineMock.mockReset()
  mockRewriterFn = vi.fn()
  pipelineMock.mockResolvedValue(mockRewriterFn)
  scottishRewrite = (await import('../../src/features/scottish-mode.js')).scottishRewrite
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('scottishRewrite', () => {
  it('calls pipeline with the summarization model', async () => {
    mockRewriterFn.mockResolvedValue([{ summary_text: 'a summary.' }])
    await scottishRewrite('some post text')
    expect(pipelineMock).toHaveBeenCalledWith(
      'summarization',
      'Xenova/distilbart-cnn-6-6',
      { quantized: true }
    )
  })

  it('returns the scotticized summary text', async () => {
    mockRewriterFn.mockResolvedValue([{ summary_text: 'We have a small house.' }])
    const result = await scottishRewrite('some post text')
    expect(result.text).toBe('We have a wee hoose.')
  })

  it('falls back to the original post text when summary_text is missing', async () => {
    mockRewriterFn.mockResolvedValue([{}])
    const result = await scottishRewrite('I know a small thing')
    expect(result.text).toBe('Ah ken a wee thing')
  })

  it('truncates input to 3000 characters before summarizing', async () => {
    mockRewriterFn.mockResolvedValue([{ summary_text: 'summary.' }])
    await scottishRewrite('A'.repeat(5000))
    expect(mockRewriterFn.mock.calls[0][0].length).toBe(3000)
  })

  it('passes generation options guarding against repetition and truncation', async () => {
    mockRewriterFn.mockResolvedValue([{ summary_text: 'summary.' }])
    await scottishRewrite('post')
    expect(mockRewriterFn.mock.calls[0][1]).toEqual({
      max_new_tokens: 300,
      no_repeat_ngram_size: 3,
      repetition_penalty: 1.3,
    })
  })

  it('trims a summary cut off mid-sentence back to the last complete sentence', async () => {
    mockRewriterFn.mockResolvedValue([{ summary_text: 'First sentence. Second cut off mid' }])
    const result = await scottishRewrite('post')
    expect(result.text).toBe('First sentence.')
  })

  it('does not trim a summary that already ends cleanly', async () => {
    mockRewriterFn.mockResolvedValue([{ summary_text: 'A complete sentence!' }])
    const result = await scottishRewrite('post')
    expect(result.text).toBe('A complete sentence!')
  })

  it('reuses the cached pipeline for subsequent calls', async () => {
    mockRewriterFn.mockResolvedValue([{ summary_text: 'summary.' }])
    await scottishRewrite('first post')
    await scottishRewrite('second post')
    expect(pipelineMock).toHaveBeenCalledTimes(1)
  })

  it('reuses an in-flight pipeline load for concurrent calls', async () => {
    mockRewriterFn.mockResolvedValue([{ summary_text: 'summary.' }])
    await Promise.all([scottishRewrite('post a'), scottishRewrite('post b')])
    expect(pipelineMock).toHaveBeenCalledTimes(1)
  })

  it('retries loading the pipeline after a prior load failure', async () => {
    pipelineMock.mockRejectedValueOnce(new Error('model download failed'))
    await expect(scottishRewrite('some post')).rejects.toThrow('model download failed')

    pipelineMock.mockResolvedValueOnce(mockRewriterFn)
    mockRewriterFn.mockResolvedValue([{ summary_text: 'summary.' }])
    const result = await scottishRewrite('some post')
    expect(result.text).toBe('summary.')
    expect(pipelineMock).toHaveBeenCalledTimes(2)
  })

  it('runs queued rewrites one at a time rather than concurrently', async () => {
    const order = []
    mockRewriterFn.mockImplementation(async (text) => {
      order.push(`start:${text}`)
      await Promise.resolve()
      order.push(`end:${text}`)
      return [{ summary_text: 'summary.' }]
    })
    await Promise.all([scottishRewrite('a'), scottishRewrite('b')])
    expect(order).toEqual(['start:a', 'end:a', 'start:b', 'end:b'])
  })

  it('does not let one failed rewrite block the next queued rewrite', async () => {
    mockRewriterFn.mockRejectedValueOnce(new Error('boom'))
    await expect(scottishRewrite('a')).rejects.toThrow('boom')

    mockRewriterFn.mockResolvedValue([{ summary_text: 'summary.' }])
    const result = await scottishRewrite('b')
    expect(result.text).toBe('summary.')
  })

  it('sets wasmPaths when chrome.runtime.getURL is available', async () => {
    vi.resetModules()
    const getURL = vi.fn().mockReturnValue('chrome-extension://abc/src/lib/')
    vi.stubGlobal('chrome', { runtime: { getURL } })

    const transformers = await import('../../src/lib/transformers.min.js')
    transformers.pipeline.mockResolvedValue(
      vi.fn().mockResolvedValue([{ summary_text: 'summary.' }])
    )

    const { scottishRewrite: sr } = await import('../../src/features/scottish-mode.js')
    await sr('post')

    expect(getURL).toHaveBeenCalledWith('src/lib/')
    expect(transformers.env.backends.onnx.wasm.wasmPaths).toBe('chrome-extension://abc/src/lib/')
  })

  it('does not throw when chrome is defined but chrome.runtime is not', async () => {
    vi.resetModules()
    vi.stubGlobal('chrome', {})
    const transformers = await import('../../src/lib/transformers.min.js')
    transformers.pipeline.mockResolvedValue(
      vi.fn().mockResolvedValue([{ summary_text: 'summary.' }])
    )
    await expect(import('../../src/features/scottish-mode.js')).resolves.toBeDefined()
  })
})

describe('scotticize', () => {
  it('applies word substitutions from the lexicon, preserving capitalization', async () => {
    mockRewriterFn.mockResolvedValue([{ summary_text: 'Small House. I know.' }])
    const result = await scottishRewrite('post')
    expect(result.text).toBe('Wee Hoose. Ah ken.')
  })

  it('applies negation contractions', async () => {
    mockRewriterFn.mockResolvedValue([
      { summary_text: "I can't, don't, doesn't, didn't, isn't, wasn't, cannot." },
    ])
    const result = await scottishRewrite('post')
    expect(result.text).toBe('Ah cannae, dinnae, disnae, didnae, isnae, wisnae, cannae.')
  })

  it('applies the uncontracted "<verb> not" form the same as the contraction', async () => {
    mockRewriterFn.mockResolvedValue([
      { summary_text: 'It is not true. It was not there. I do not know. It does not work. It did not happen.' },
    ])
    const result = await scottishRewrite('post')
    expect(result.text).toBe(
      "It isnae true. It wisnae there. Ah dinnae ken. It disnae work. It didnae happen."
    )
  })

  it('applies the apostrophe-less informal contraction the same as the proper one', async () => {
    mockRewriterFn.mockResolvedValue([{ summary_text: "I dont, wasnt, couldnt, shouldnt, wouldnt." }])
    const result = await scottishRewrite('post')
    expect(result.text).toBe('Ah dinnae, wisnae, couldnae, shouldnae, widnae.')
  })

  it('negates would/should/could (regular "verb not"/"verbn\'t"/"verbnt")', async () => {
    mockRewriterFn.mockResolvedValue([
      { summary_text: "I wouldn't, shouldn't, couldn't do that." },
    ])
    const result = await scottishRewrite('post')
    expect(result.text).toBe('Ah widnae, shouldnae, couldnae do that.')
  })

  it('converts "I am"/"I\'m"/standalone "I" to "Ah\'m"/"Ah"', async () => {
    mockRewriterFn.mockResolvedValue([{ summary_text: "I am here. I'm ready. I left." }])
    const result = await scottishRewrite('post')
    expect(result.text).toBe("Ah'm here. Ah'm ready. Ah left.")
  })

  it('converts "today", "tonight", and "around"', async () => {
    mockRewriterFn.mockResolvedValue([{ summary_text: 'See you today, tonight, around five.' }])
    const result = await scottishRewrite('post')
    expect(result.text).toBe('See you the day, the night, aroond five.')
  })

  it('does not touch words that only contain a lexicon word as a substring', async () => {
    mockRewriterFn.mockResolvedValue([{ summary_text: 'The household knows housework.' }])
    const result = await scottishRewrite('post')
    expect(result.text).toBe('The household knows housework.')
  })

  it('drops the trailing g on words ending "ing"', async () => {
    mockRewriterFn.mockResolvedValue([{ summary_text: 'We are shipping something exciting.' }])
    const result = await scottishRewrite('post')
    expect(result.text).toBe("We are shippin' somethin' excitin'.")
  })

  it('leaves words where "ing" is part of the root, not a gerund suffix, unchanged', async () => {
    mockRewriterFn.mockResolvedValue([
      { summary_text: 'A ring, a king, a thing, string, spring, sing, wing, bring.' },
    ])
    const result = await scottishRewrite('post')
    expect(result.text).toBe('A ring, a king, a thing, string, spring, sing, wing, bring.')
  })

  it('still drops the g for a real gerund built on an excluded root', async () => {
    mockRewriterFn.mockResolvedValue([{ summary_text: 'He kept ringing and springing about.' }])
    const result = await scottishRewrite('post')
    expect(result.text).toBe("He kept ringin' and springin' about.")
  })
})
