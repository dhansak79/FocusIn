import { readAuthorStats, readHallOfShame, readStats } from '../stats.js'
import { renderAuthorTally, renderDamageReport, renderHallOfShame } from '../stats-renderer.js'

/*
 * Settings functionality
 */

// Toggle buttons
const toggleProperty = (property) => (event) => {
  chrome.storage.local.set({
    [property.id]: event.target.checked,
  })
}

document.addEventListener('DOMContentLoaded', function () {
  // Add change listeners to switches
  var i, x
  x = document.getElementsByClassName('switch')
  for (i = 0; i < x.length; i++) {
    x[i].addEventListener('change', toggleProperty(x[i]))
  }

  var mainToggle = document.getElementById('main-toggle')
  var focusinPanels = document.getElementById('focusin-panels')
  mainToggle.addEventListener('change', function () {
    focusinPanels.style.display = mainToggle.checked ? 'block' : 'none'
  })

  const tabFilters = document.getElementById('tab-filters')
  const tabAuthors = document.getElementById('tab-authors')
  const tabBlocked = document.getElementById('tab-blocked')
  const tabHallOfShame = document.getElementById('tab-hall-of-shame')
  const settingsPanel = document.getElementById('settings-panel')
  const authorsPanel = document.getElementById('authors-panel')
  const blockedPanel = document.getElementById('blocked-panel')
  const hallOfShamePanel = document.getElementById('hall-of-shame-panel')
  const switchTab = (name) => {
    tabFilters.classList.toggle('active', name === 'filters')
    tabAuthors.classList.toggle('active', name === 'authors')
    tabBlocked.classList.toggle('active', name === 'blocked')
    tabHallOfShame.classList.toggle('active', name === 'hall-of-shame')
    settingsPanel.classList.toggle('active', name === 'filters')
    authorsPanel.classList.toggle('active', name === 'authors')
    blockedPanel.classList.toggle('active', name === 'blocked')
    hallOfShamePanel.classList.toggle('active', name === 'hall-of-shame')
  }
  tabFilters.addEventListener('click', () => switchTab('filters'))
  tabAuthors.addEventListener('click', () => switchTab('authors'))
  tabBlocked.addEventListener('click', () => switchTab('blocked'))
  tabHallOfShame.addEventListener('click', () => switchTab('hall-of-shame'))

  // Set initial checked state from storage
  chrome.storage.local.get(
    [].map.call(x, (el) => el.id),
    (res) => {
      if (res) {
        for (i = 0; i < x.length; i++) {
          if (res[x[i].id] !== undefined) {
            x[i].checked = res[x[i].id]
          }
        }
        focusinPanels.style.display = mainToggle.checked ? 'block' : 'none'
      }
    }
  )
})

// Feed hide by keywords

const feedKeywordList = [
  'Be the first to comment',
  'Be the first to react',
  'New post in',
  'Jobs recommended for you',
]

const feedKeywords = document.querySelector('input[id=hide-by-keywords]')
const feedTagify = new Tagify(feedKeywords, {
  whitelist: feedKeywordList,
  dropdown: {
    position: 'input',
    enabled: 0,
    placeAbove: true,
  },
  originalInputValueFormat: (valuesArr) =>
    valuesArr.map((item) => item.value).join(', '),
})

function onFeedChange(e) {
  chrome.storage.local.set({ 'feed-keywords': e.target.value }, () => {})
}

feedKeywords.addEventListener('change', onFeedChange)

const semanticTopicCheckboxes = document.querySelectorAll('.semantic-topic')

const getActiveSemanticTopics = () => {
  const presets = [...semanticTopicCheckboxes].filter((cb) => cb.checked).map((cb) => cb.value)
  const customEl = document.getElementById('semantic-custom-topics')
  const customs = (customEl?.value || '').split(',').map((t) => t.trim()).filter(Boolean)
  return [...presets, ...customs].join(', ')
}

const saveSemanticTopics = () => {
  chrome.storage.local.set({ 'semantic-filter': getActiveSemanticTopics() }, () => {})
}

semanticTopicCheckboxes.forEach((cb) => cb.addEventListener('change', saveSemanticTopics))

const semanticCustomInput = document.querySelector('#semantic-custom-topics')
let customTopicTagify = null
if (semanticCustomInput) {
  customTopicTagify = new Tagify(semanticCustomInput, {
    originalInputValueFormat: (valuesArr) => valuesArr.map((item) => item.value).join(', '),
  })
  semanticCustomInput.addEventListener('change', saveSemanticTopics)
}

const TEST_POST = 'Grind harder than yesterday. Hustle culture is the only way to build wealth and achieve your crypto dreams. Personal branding is everything.'

document.getElementById('test-semantic-btn').addEventListener('click', () => {
  const resultEl = document.getElementById('semantic-test-result')
  const queries = [...semanticTopicCheckboxes].filter((cb) => cb.checked).map((cb) => cb.value)
  if (!queries.length) {
    resultEl.textContent = 'No topics selected'
    return
  }
  resultEl.textContent = 'Testing...'
  chrome.runtime.sendMessage(
    { 'semantic-check': { queries, post: TEST_POST } },
    (response) => {
      if (chrome.runtime.lastError) {
        resultEl.textContent = `SW error: ${chrome.runtime.lastError.message}`
        return
      }
      if (response?.score == null) {
        resultEl.textContent = 'No response — model may still be loading'
        return
      }
      resultEl.textContent = `Model loaded · test post scored ${Math.round(response.score * 100)}% — posts above 35% are hidden`
    }
  )
})

const toneThresholdInput = document.getElementById('tone-threshold')
const toneThresholdValue = document.getElementById('tone-threshold-value')
if (toneThresholdInput) {
  toneThresholdInput.addEventListener('input', () => {
    const val = Number(toneThresholdInput.value)
    if (toneThresholdValue) toneThresholdValue.textContent = val
    chrome.storage.local.set({ 'tone-threshold': val })
  })
}

const loadToneThreshold = () => {
  chrome.storage.local.get({ 'tone-threshold': 85 }, (res) => {
    const val = res['tone-threshold'] ?? 85
    if (toneThresholdInput) toneThresholdInput.value = val
    if (toneThresholdValue) toneThresholdValue.textContent = val
  })
}

const authorWhitelistInput = document.querySelector('#author-whitelist')
let authorWhitelistTagify = null
if (authorWhitelistInput) {
  authorWhitelistTagify = new Tagify(authorWhitelistInput)
  authorWhitelistInput.addEventListener('change', () => {
    const whitelist = authorWhitelistTagify.value.map((tag) => ({
      vanity: tag.vanity ?? tag.value,
      name: tag.value,
    }))
    chrome.storage.local.set({ 'author-whitelist': whitelist })
  })
}

window.onload = function () {
  chrome.storage.local.get('feed-keywords', function (res) {
    feedTagify.addTags(res['feed-keywords'])
  })
  chrome.storage.local.get({ 'author-whitelist': [] }, function (res) {
    const entries = Array.isArray(res['author-whitelist']) ? res['author-whitelist'] : []
    if (entries.length) {
      authorWhitelistTagify?.addTags(
        entries.map(({ vanity, name }) => ({ value: name ?? vanity, vanity }))
      )
    }
  })
  chrome.storage.local.get('semantic-filter', function (res) {
    if (res['semantic-filter'] === undefined) {
      semanticTopicCheckboxes.forEach((cb) => { cb.checked = true })
      saveSemanticTopics()
      return
    }
    const stored = res['semantic-filter'].split(',').map((s) => s.trim()).filter(Boolean)
    const presetValues = new Set([...semanticTopicCheckboxes].map((cb) => cb.value))
    const storedSet = new Set(stored)
    semanticTopicCheckboxes.forEach((cb) => { cb.checked = storedSet.has(cb.value) })
    const customTopics = stored.filter((t) => !presetValues.has(t))
    if (customTopics.length) customTopicTagify?.addTags(customTopics)
  })

  loadToneThreshold()

  readStats((stats) =>
    renderDamageReport(stats, {
      slopEl: document.getElementById('stat-slop'),
      filteredEl: document.getElementById('stat-filtered'),
      signalsEl: document.getElementById('top-signals'),
    })
  )

  readAuthorStats((authorStats) =>
    renderAuthorTally(authorStats, document.getElementById('author-tally-list'))
  )

  readHallOfShame((shameStats) =>
    renderHallOfShame(shameStats, document.getElementById('hall-of-shame-list'))
  )
}
