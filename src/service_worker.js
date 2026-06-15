import { classifyPost } from './features/classifier.js'
import { semanticCheck } from './features/semantic-filter.js'

chrome.runtime.onMessage.addListener((req, _sender, sendResponse) => {
  if (req['classify-post']) {
    classifyPost(req['classify-post'])
      .then((result) => sendResponse({ result }))
      .catch(() => sendResponse({ result: null }))
    return true
  }
  if (req['semantic-check']) {
    const { queries, post } = req['semantic-check']
    semanticCheck(queries, post)
      .then((score) => sendResponse({ score }))
      .catch(() => sendResponse({ score: 0 }))
    return true
  }
})

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason !== 'install') return
  const res = await chrome.storage.local.get('initialized')
  if (res.initialized === 'v0.5') return
  await chrome.storage.local.set({
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
    'classify-posts': false,
    'semantic-filter': 'hustle culture, personal branding, motivational quotes, cryptocurrency, job interview tips, AI productivity tools, startup success story, sales and lead generation',
    'hide-premium': true,
    'hide-advertisements': true,
    'hide-follow-recommendations': true,
    'hide-news': false,
    'hide-notification-count': false,
    'job-keywords': '',
    'hide-promoted-jobs': false,
  })
})
