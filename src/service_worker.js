import { semanticCheck } from './features/semantic-filter.js'
import { toneCheck } from './features/tone-filter.js'
import { scottishRewrite } from './features/scottish-mode.js'
import { SLOP_ARCHETYPES } from './features/slop-keywords.js'

chrome.runtime.onMessage.addListener((req, _sender, sendResponse) => {
  if (req['scottish-rewrite']) {
    const { post } = req['scottish-rewrite']
    scottishRewrite(post)
      .then(({ text }) => sendResponse({ text }))
      .catch((err) => {
        console.error('FocusedIn: scottish-rewrite failed', err)
        sendResponse({ text: null })
      })
    return true
  }
  if (req['semantic-check']) {
    const { queries, post } = req['semantic-check']
    semanticCheck(queries, post)
      .then(({ score, topic }) => sendResponse({ score, topic }))
      .catch(() => sendResponse({ score: 0 }))
    return true
  }
  if (req['slop-archetype-check']) {
    const { post } = req['slop-archetype-check']
    semanticCheck(SLOP_ARCHETYPES, post)
      .then(({ score, topic }) => sendResponse({ score, topic }))
      .catch(() => sendResponse({ score: 0 }))
    return true
  }
  if (req['tone-check']) {
    const { post } = req['tone-check']
    toneCheck(post)
      .then(({ score, label }) => sendResponse({ score, label }))
      .catch(() => sendResponse({ score: 0, label: 'POSITIVE' }))
    return true
  }
})

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason !== 'install') return
  const res = await chrome.storage.local.get('initialized')
  if (res.initialized === 'v1.0') return
  await chrome.storage.local.set({
    initialized: 'v1.0',
    'main-toggle': true,
    'feed-keywords': '',
    'detect-slop': true,
    'slop-archetype': true,
    'semantic-filter': 'hustle culture, personal branding, motivational quotes, cryptocurrency, job interview tips, AI productivity tools, startup success story, sales and lead generation',
    'tone-filter': false,
    'tone-threshold': 70,
    'scottish-mode': false,
  })
})
