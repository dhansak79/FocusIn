import { pipeline, env } from '../lib/transformers.min.js'

if (typeof chrome !== 'undefined' && chrome?.runtime?.getURL) {
  env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('src/lib/')
}
env.backends.onnx.wasm.numThreads = 1

let rewriterLoading = null

// A resolved promise is memoized, so this also serves as the "already loaded" cache.
// On rejection the cache is cleared so a transient load failure can be retried.
//
// distilbart-cnn-6-6 (not a general instruction model like LaMini-Flan-T5)
// is fine-tuned specifically for summarization: it's trained to condense
// source text while covering its content, which is exactly where a tiny
// instruction-follower kept failing (dropping most of a post after a
// sentence or two, or looping). It expects raw source text, not an
// instruction-wrapped prompt — dialect transfer still isn't its job; that
// stays a deterministic pass (see scotticize below).
const getRewriter = () => {
  if (rewriterLoading) return rewriterLoading
  rewriterLoading = pipeline('summarization', 'Xenova/distilbart-cnn-6-6', {
    quantized: true,
  }).catch((err) => {
    console.error('FocusedIn: scottish-mode model failed to load', err)
    rewriterLoading = null
    throw err
  })
  return rewriterLoading
}

// Deterministic word/phrase substitutions toward a light Scots dialect
// flavor, applied after simplification. Longer phrases are listed before
// their single-word components so they match first.
const SCOTS_LEXICON = [
  [/\bgoing to\b/gi, 'gonnae'],
  [/\bcan ?not\b/gi, 'cannae'],
  [/\bcan't\b/gi, 'cannae'],
  [/\bdo not\b/gi, 'dinnae'],
  [/\bdon't\b/gi, 'dinnae'],
  [/\bdoesn't\b/gi, 'disnae'],
  [/\bdidn't\b/gi, 'didnae'],
  [/\bisn't\b/gi, 'isnae'],
  [/\bwasn't\b/gi, 'wisnae'],
  [/\bI am\b/g, "Ah'm"],
  [/\bI'm\b/g, "Ah'm"],
  [/\bI\b/g, 'Ah'],
  [/\bmy\b/gi, 'ma'],
  [/\byour\b/gi, 'yer'],
  [/\byou\b/gi, 'ye'],
  [/\bknow\b/gi, 'ken'],
  [/\blittle\b/gi, 'wee'],
  [/\bsmall\b/gi, 'wee'],
  [/\byes\b/gi, 'aye'],
  [/\babout\b/gi, 'aboot'],
  [/\baround\b/gi, 'aroond'],
  [/\btoday\b/gi, 'the day'],
  [/\btonight\b/gi, 'the night'],
  [/\bhouse\b/gi, 'hoose'],
  [/\bdown\b/gi, 'doon'],
  [/\bvery\b/gi, 'awfy'],
  [/\bchild\b/gi, 'bairn'],
]

const matchCase = (source, target) =>
  source[0] === source[0].toUpperCase() && source[0] !== source[0].toLowerCase()
    ? target[0].toUpperCase() + target.slice(1)
    : target

const scotticize = (text) => {
  let result = text
  for (const [pattern, replacement] of SCOTS_LEXICON) {
    result = result.replace(pattern, (match) => matchCase(match, replacement))
  }
  return result
}

// A long, dense post can still exhaust max_new_tokens before the model
// reaches a natural stopping point, cutting the summary off mid-clause
// (e.g. "...from late" instead of "...from late August"). Trimming back to
// the last complete sentence means a summary that had to leave out later
// content ends cleanly instead of looking broken.
const trimToLastSentence = (text) => {
  if (/[.!?]["'’]?$/.test(text)) return text
  const lastEnd = Math.max(text.lastIndexOf('.'), text.lastIndexOf('!'), text.lastIndexOf('?'))
  return lastEnd > 0 ? text.slice(0, lastEnd + 1) : text
}

// LinkedIn posts run up to ~3000 characters — don't chop a real post
// mid-sentence before the model ever sees the rest of it.
//
// no_repeat_ngram_size/repetition_penalty guard against the classic greedy-
// decoding failure mode where a small model gets stuck looping the same
// sentence on longer outputs; harmless to keep as a safety net here too.
const runRewrite = async (postText) => {
  const rewriter = await getRewriter()
  const [result] = await rewriter(postText.slice(0, 3000), {
    max_new_tokens: 300,
    no_repeat_ngram_size: 3,
    repetition_penalty: 1.3,
  })
  const simplified = trimToLastSentence((result.summary_text?.trim() || postText))
  return { text: scotticize(simplified) }
}

// The feed can flag several posts in the same scroll batch, each triggering
// a scottish-rewrite call. Running those concurrently makes them all
// contend for the same single-threaded WASM runtime instead of actually
// running in parallel, which just makes every one of them slower. Chaining
// them through one queue runs them one at a time instead — a rejection is
// caught inside the chain so one failed rewrite doesn't wedge every rewrite
// queued behind it.
let queue = Promise.resolve()

export const scottishRewrite = (postText) => {
  const result = queue.then(() => runRewrite(postText))
  queue = result.catch(() => {})
  return result
}
