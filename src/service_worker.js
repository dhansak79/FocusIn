import { semanticCheck } from './features/semantic-filter.js'
import { SLOP_ARCHETYPES } from './features/slop-keywords.js'

chrome.runtime.onMessage.addListener((req, _sender, sendResponse) => {
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
  })
})
