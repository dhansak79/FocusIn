// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import {
  findElement,
  removeHideClasses,
  waitForSelector,
  waitForSelectorAll,
  hideBySelector,
  showBySelector,
  hideParentBySelector,
  showParentBySelector,
  hideAncestorIndexBySelector,
  showAncestorIndexBySelector,
  hidePost,
  resetShownPosts,
  resetBlockedPosts,
  resetJobs,
} from '../src/utils.js'

beforeEach(() => {
  document.body.innerHTML = ''
})

const expectHideClassesRemoved = (el) => {
  expect(el.classList.contains('hide')).toBe(false)
  expect(el.classList.contains('showIcon')).toBe(false)
}

// ---------------------------------------------------------------------------
// removeHideClasses
// ---------------------------------------------------------------------------

describe('removeHideClasses', () => {
  it('removes the hide class', () => {
    const el = document.createElement('div')
    el.classList.add('hide')
    removeHideClasses(el)
    expect(el.classList.contains('hide')).toBe(false)
  })

  it('removes the showIcon class', () => {
    const el = document.createElement('div')
    el.classList.add('showIcon')
    removeHideClasses(el)
    expect(el.classList.contains('showIcon')).toBe(false)
  })

  it('removes hide and showIcon at once', () => {
    const el = document.createElement('div')
    el.classList.add('hide', 'showIcon')
    removeHideClasses(el)
    expect(el.classList.length).toBe(0)
  })

  it('leaves unrelated classes intact', () => {
    const el = document.createElement('div')
    el.classList.add('hide', 'my-class')
    removeHideClasses(el)
    expect(el.classList.contains('my-class')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// hideBySelector
// ---------------------------------------------------------------------------

describe('hideBySelector', () => {
  it('adds the mode class to the matching element', async () => {
    document.body.innerHTML = '<div class="target">content</div>'
    await hideBySelector('.target', 'hide')
    expect(document.querySelector('.target').classList.contains('hide')).toBe(true)
  })

  it('adds the showIcon class by default', async () => {
    document.body.innerHTML = '<div class="target">content</div>'
    await hideBySelector('.target', 'hide')
    expect(document.querySelector('.target').classList.contains('showIcon')).toBe(true)
  })

  it('does not add showIcon when showIcon is false', async () => {
    document.body.innerHTML = '<div class="target">content</div>'
    await hideBySelector('.target', 'hide', false)
    expect(document.querySelector('.target').classList.contains('showIcon')).toBe(false)
  })

  it('clears existing hide classes before applying the new mode', async () => {
    document.body.innerHTML = '<div class="target showIcon">content</div>'
    await hideBySelector('.target', 'hide')
    const el = document.querySelector('.target')
    expect(el.classList.contains('hide')).toBe(true)
  })

  it('applies to every element when given an array of selectors', async () => {
    document.body.innerHTML = '<div class="a">a</div><div class="b">b</div>'
    await hideBySelector(['.a', '.b'], 'hide')
    expect(document.querySelector('.a').classList.contains('hide')).toBe(true)
    expect(document.querySelector('.b').classList.contains('hide')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// showBySelector
// ---------------------------------------------------------------------------

describe('showBySelector', () => {
  it('removes hide and showIcon from the matching element', async () => {
    document.body.innerHTML = '<div class="target hide showIcon">content</div>'
    await showBySelector('.target')
    expectHideClassesRemoved(document.querySelector('.target'))
  })

  it('leaves unrelated classes intact', async () => {
    document.body.innerHTML = '<div class="target hide other">content</div>'
    await showBySelector('.target')
    expect(document.querySelector('.target').classList.contains('other')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// hideParentBySelector
// ---------------------------------------------------------------------------

describe('hideParentBySelector', () => {
  it('adds the mode class to the parent of the matching element', async () => {
    document.body.innerHTML = '<div class="parent"><span class="child">content</span></div>'
    await hideParentBySelector('.child', 'hide')
    expect(document.querySelector('.parent').classList.contains('hide')).toBe(true)
  })

  it('adds showIcon to the parent by default', async () => {
    document.body.innerHTML = '<div class="parent"><span class="child">content</span></div>'
    await hideParentBySelector('.child', 'hide')
    expect(document.querySelector('.parent').classList.contains('showIcon')).toBe(true)
  })

  it('does not add showIcon to the parent when showIcon is false', async () => {
    document.body.innerHTML = '<div class="parent"><span class="child">content</span></div>'
    await hideParentBySelector('.child', 'hide', false)
    expect(document.querySelector('.parent').classList.contains('showIcon')).toBe(false)
  })

  it('clears existing hide classes from the parent before applying the new mode', async () => {
    document.body.innerHTML = '<div class="parent showIcon"><span class="child">content</span></div>'
    await hideParentBySelector('.child', 'hide')
    const parent = document.querySelector('.parent')
    expect(parent.classList.contains('hide')).toBe(true)
  })

  it('does not affect the child element itself', async () => {
    document.body.innerHTML = '<div class="parent"><span class="child">content</span></div>'
    await hideParentBySelector('.child', 'hide')
    expect(document.querySelector('.child').classList.contains('hide')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// showParentBySelector
// ---------------------------------------------------------------------------

describe('showParentBySelector', () => {
  it('removes hide classes from the parent of the matching element', async () => {
    document.body.innerHTML =
      '<div class="parent hide showIcon"><span class="child">content</span></div>'
    await showParentBySelector('.child')
    expectHideClassesRemoved(document.querySelector('.parent'))
  })

  it('leaves unrelated classes on the parent intact', async () => {
    document.body.innerHTML =
      '<div class="parent hide other"><span class="child">content</span></div>'
    await showParentBySelector('.child')
    expect(document.querySelector('.parent').classList.contains('other')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// hideAncestorIndexBySelector
// ---------------------------------------------------------------------------

describe('hideAncestorIndexBySelector', () => {
  it('hides the ancestor at the given depth', async () => {
    document.body.innerHTML = `
      <div class="grandparent">
        <div class="parent">
          <span class="child">content</span>
        </div>
      </div>`
    await hideAncestorIndexBySelector('.child', 2, 'hide')
    expect(document.querySelector('.grandparent').classList.contains('hide')).toBe(true)
  })

  it('adds showIcon by default', async () => {
    document.body.innerHTML = '<div class="gp"><div class="p"><span class="c">x</span></div></div>'
    await hideAncestorIndexBySelector('.c', 2, 'hide')
    expect(document.querySelector('.gp').classList.contains('showIcon')).toBe(true)
  })

  it('does not add showIcon when showIcon is false', async () => {
    document.body.innerHTML = '<div class="gp"><div class="p"><span class="c">x</span></div></div>'
    await hideAncestorIndexBySelector('.c', 2, 'hide', false)
    expect(document.querySelector('.gp').classList.contains('showIcon')).toBe(false)
  })

  it('hides the direct parent at depth 1', async () => {
    document.body.innerHTML = '<div class="parent"><span class="child">x</span></div>'
    await hideAncestorIndexBySelector('.child', 1, 'hide')
    expect(document.querySelector('.parent').classList.contains('hide')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// showAncestorIndexBySelector
// ---------------------------------------------------------------------------

describe('showAncestorIndexBySelector', () => {
  it('removes hide classes from the ancestor at the given depth', async () => {
    document.body.innerHTML = `
      <div class="grandparent hide showIcon">
        <div class="parent">
          <span class="child">content</span>
        </div>
      </div>`
    await showAncestorIndexBySelector('.child', 2)
    expectHideClassesRemoved(document.querySelector('.grandparent'))
  })
})

// ---------------------------------------------------------------------------
// hidePost
// ---------------------------------------------------------------------------

describe('hidePost', () => {
  it('adds the mode class', () => {
    const post = document.createElement('div')
    hidePost(post, 'hide')
    expect(post.classList.contains('hide')).toBe(true)
  })

  it('adds the showIcon class', () => {
    const post = document.createElement('div')
    hidePost(post, 'hide')
    expect(post.classList.contains('showIcon')).toBe(true)
  })

  it('sets dataset.hidden to true', () => {
    const post = document.createElement('div')
    hidePost(post, 'hide')
    expect(post.dataset.hidden).toBe('true')
  })

  it('onclick removes hide and showIcon classes', () => {
    const post = document.createElement('div')
    hidePost(post, 'hide')
    post.onclick()
    expect(post.classList.contains('hide')).toBe(false)
    expect(post.classList.contains('showIcon')).toBe(false)
  })

  it('onclick sets dataset.hidden to "shown"', () => {
    const post = document.createElement('div')
    hidePost(post, 'hide')
    post.onclick()
    expect(post.dataset.hidden).toBe('shown')
  })
})

// ---------------------------------------------------------------------------
// Helpers for feed post DOM structure
// ---------------------------------------------------------------------------

const FEED_CONTAINER = "container-update-list_mainFeed-lazy-container"

const buildFeedPost = (dataHidden, classes = []) => {
  document.body.innerHTML = `
    <div componentkey="${FEED_CONTAINER}">
      <div data-display-contents="true">
        <div data-hidden="${dataHidden}" class="${classes.join(' ')}">Post</div>
      </div>
    </div>`
  return document.querySelector(
    `[componentkey="${FEED_CONTAINER}"] > div > div`
  )
}

// ---------------------------------------------------------------------------
// resetShownPosts
// ---------------------------------------------------------------------------

describe('resetShownPosts', () => {
  it('removes hide classes from posts with data-hidden=false', () => {
    const post = buildFeedPost('false', ['hide', 'showIcon'])
    resetShownPosts()
    expect(post.classList.contains('hide')).toBe(false)
    expect(post.classList.contains('showIcon')).toBe(false)
  })

  it('deletes dataset.hidden from shown posts', () => {
    const post = buildFeedPost('false')
    resetShownPosts()
    expect(post.dataset.hidden).toBeUndefined()
  })

  it('does not touch posts with data-hidden=true', () => {
    const post = buildFeedPost('true', ['hide'])
    resetShownPosts()
    expect(post.classList.contains('hide')).toBe(true)
    expect(post.dataset.hidden).toBe('true')
  })
})

// ---------------------------------------------------------------------------
// resetBlockedPosts
// ---------------------------------------------------------------------------

describe('resetBlockedPosts', () => {
  it('removes hide classes from posts with data-hidden=true', () => {
    const post = buildFeedPost('true', ['hide', 'showIcon'])
    resetBlockedPosts()
    expect(post.classList.contains('hide')).toBe(false)
    expect(post.classList.contains('showIcon')).toBe(false)
  })

  it('deletes dataset.hidden from blocked posts', () => {
    const post = buildFeedPost('true')
    resetBlockedPosts()
    expect(post.dataset.hidden).toBeUndefined()
  })

  it('does not touch posts with data-hidden=false', () => {
    const post = buildFeedPost('false', ['hide'])
    resetBlockedPosts()
    expect(post.classList.contains('hide')).toBe(true)
    expect(post.dataset.hidden).toBe('false')
  })

  it('clears focusinBanner flag from blocked posts', () => {
    const post = buildFeedPost('true')
    post.dataset.focusinBanner = '1'
    resetBlockedPosts()
    expect(post.dataset.focusinBanner).toBeUndefined()
  })

  it('removes banner elements from the DOM', () => {
    buildFeedPost('true')
    const banner = document.createElement('div')
    banner.className = 'focusedin-slop-collapsed'
    document.body.appendChild(banner)
    const tag = document.createElement('div')
    tag.className = 'focusedin-slop-tag'
    document.body.appendChild(tag)

    resetBlockedPosts()

    expect(document.querySelector('.focusedin-slop-collapsed')).toBeNull()
    expect(document.querySelector('.focusedin-slop-tag')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// resetJobs
// ---------------------------------------------------------------------------

describe('resetJobs', () => {
  it('removes hide classes from .job-card-container elements', () => {
    document.body.innerHTML =
      '<div class="job-card-container hide showIcon" data-hidden="true">job</div>'
    const card = document.querySelector('.job-card-container')
    resetJobs()
    expect(card.classList.contains('hide')).toBe(false)
    expect(card.classList.contains('showIcon')).toBe(false)
  })

  it('deletes dataset.hidden from .job-card-container elements', () => {
    document.body.innerHTML =
      '<div class="job-card-container" data-hidden="true">job</div>'
    const card = document.querySelector('.job-card-container')
    resetJobs()
    expect(card.dataset.hidden).toBeUndefined()
  })

  it('removes hide classes from div[data-job-id] elements', () => {
    document.body.innerHTML =
      '<div data-job-id="123" class="hide showIcon" data-hidden="true">job</div>'
    const card = document.querySelector('[data-job-id]')
    resetJobs()
    expect(card.classList.contains('hide')).toBe(false)
  })

  it('deletes dataset.hidden from div[data-job-id] elements', () => {
    document.body.innerHTML =
      '<div data-job-id="123" class="dim" data-hidden="true">job</div>'
    const card = document.querySelector('[data-job-id]')
    resetJobs()
    expect(card.dataset.hidden).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// findElement
// ---------------------------------------------------------------------------

describe('findElement', () => {
  it('returns the first matching element', () => {
    document.body.innerHTML = '<div class="a">a</div><div class="b">b</div>'
    expect(findElement(['.a', '.b'])).toBe(document.querySelector('.a'))
  })

  it('skips non-matching selectors and returns the first match', () => {
    document.body.innerHTML = '<div class="b">b</div>'
    expect(findElement(['.a', '.b'])).toBe(document.querySelector('.b'))
  })

  it('returns null when no selector matches', () => {
    document.body.innerHTML = ''
    expect(findElement(['.nonexistent'])).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// waitForSelector
// ---------------------------------------------------------------------------

describe('waitForSelector', () => {
  it('returns the element immediately when it already exists', async () => {
    document.body.innerHTML = '<div class="target">content</div>'
    const el = await waitForSelector('.target')
    expect(el).toBe(document.querySelector('.target'))
  })

  it('resolves when the element is added to the DOM after the call', async () => {
    document.body.innerHTML = ''
    const promise = waitForSelector('.target')

    const el = document.createElement('div')
    el.className = 'target'
    el.textContent = 'content'
    document.body.appendChild(el)

    expect(await promise).toBe(el)
  })

  it('waits for skeleton content to be replaced before resolving', async () => {
    document.body.innerHTML = '<div class="target"><div class="skeleton"></div></div>'
    const promise = waitForSelector('.target')

    // Replace skeleton with real content — triggers a childList mutation
    document.querySelector('.target').innerHTML = 'real content'

    expect(await promise).toBe(document.querySelector('.target'))
  })

  it('resolves with null when the element never appears within the timeout', async () => {
    document.body.innerHTML = ''
    const result = await waitForSelector('.target', 10)
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// waitForSelectorAll
// ---------------------------------------------------------------------------

describe('waitForSelectorAll', () => {
  it('resolves immediately when elements already exist', async () => {
    document.body.innerHTML = '<div class="item">a</div><div class="item">b</div>'
    const result = await waitForSelectorAll('.item')
    expect(result.length).toBe(2)
  })

  it('resolves when elements are added to the DOM after the call', async () => {
    document.body.innerHTML = ''
    const promise = waitForSelectorAll('.item')

    const el = document.createElement('div')
    el.className = 'item'
    document.body.appendChild(el)

    const result = await promise
    expect(result.length).toBe(1)
  })

  it('waits for skeleton content to be replaced before resolving', async () => {
    document.body.innerHTML = '<div class="item"><div class="skeleton"></div></div>'
    const promise = waitForSelectorAll('.item')

    document.querySelector('.item').innerHTML = 'real content'

    const result = await promise
    expect(result.length).toBe(1)
  })

  it('resolves via timeout when no elements appear', async () => {
    document.body.innerHTML = ''
    const result = await waitForSelectorAll('.item', 10)
    expect(result.length).toBe(0)
  })
})

