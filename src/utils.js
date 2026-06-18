import { POST_SELECTOR } from './constants.js'

const isReady = (selector) => {
  const found = document.querySelectorAll(selector)
  return found.length > 0 && !Array.from(found).some((el) => el.innerHTML.includes('skeleton'))
}

export const findElement = (candidates) => {
  for (const selector of candidates) {
    const el = document.querySelector(selector)
    if (el) return el
  }
  return null
}

export const removeHideClasses = (element) => {
  element.classList.remove('hide', 'showIcon')
}

const resolveSelector = (selectors) =>
  Array.isArray(selectors) ? selectors.join(',') : selectors

const applyHide = (target, mode, showIcon) => {
  removeHideClasses(target)
  target.classList.add(mode)
  if (showIcon) target.classList.add('showIcon')
}

const resetBySelector = (selector) => {
  document.querySelectorAll(selector).forEach((el) => {
    removeHideClasses(el)
    delete el.dataset.hidden
  })
}

export const waitForSelector = (selector, timeout = 5000) =>
  new Promise((resolve) => {
    if (isReady(selector)) {
      resolve(document.querySelector(selector))
      return
    }

    const observer = new MutationObserver(() => {
      if (isReady(selector)) {
        observer.disconnect()
        clearTimeout(timer)
        resolve(document.querySelector(selector))
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })

    const timer = setTimeout(() => {
      observer.disconnect()
      resolve(null)
    }, timeout)
  })

export const waitForSelectorAll = (selector, timeout = 5000) =>
  new Promise((resolve) => {
    if (isReady(selector)) {
      resolve(document.querySelectorAll(selector))
      return
    }

    const observer = new MutationObserver(() => {
      if (isReady(selector)) {
        observer.disconnect()
        clearTimeout(timer)
        resolve(document.querySelectorAll(selector))
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })

    const timer = setTimeout(() => {
      observer.disconnect()
      resolve(document.querySelectorAll(selector))
    }, timeout)
  })

export const hideBySelector = async (selectors, mode, showIcon = true) => {
  const elements = await waitForSelectorAll(resolveSelector(selectors))
  for (const el of elements) applyHide(el, mode, showIcon)
}

export const showBySelector = async (selectors) => {
  const elements = await waitForSelectorAll(resolveSelector(selectors))
  for (const el of elements) removeHideClasses(el)
}

export const hideParentBySelector = async (selectors, mode, showIcon = true) => {
  const elements = await waitForSelectorAll(resolveSelector(selectors))
  for (const el of elements) applyHide(el.parentElement, mode, showIcon)
}

export const showParentBySelector = async (selectors) => {
  const elements = await waitForSelectorAll(resolveSelector(selectors))
  for (const el of elements) removeHideClasses(el.parentElement)
}

export const hideAncestorIndexBySelector = async (selectors, index, mode, showIcon = true) => {
  const elements = await waitForSelectorAll(resolveSelector(selectors))
  for (const el of elements) {
    let ancestor = el
    for (let i = 1; i <= index; i++) ancestor = ancestor.parentElement
    applyHide(ancestor, mode, showIcon)
  }
}

export const showAncestorIndexBySelector = async (selectors, index) => {
  const elements = await waitForSelectorAll(resolveSelector(selectors))
  for (const el of elements) {
    let ancestor = el
    for (let i = 1; i <= index; i++) ancestor = ancestor.parentElement
    removeHideClasses(ancestor)
  }
}

export const hidePost = (post, mode) => {
  post.classList.add(mode, 'showIcon')

  post.onclick = () => {
    post.classList.remove('hide', 'dim', 'showIcon')
    post.dataset.hidden = 'shown'
  }

  post.dataset.hidden = true
}

export const resetShownPosts = () => {
  console.log('FocusedIn: Reset shown posts')
  resetBySelector(POST_SELECTOR.map((s) => `${s}[data-hidden=false]`).join(','))
}

export const resetBlockedPosts = () => {
  console.log('FocusedIn: Resetting blocked posts')
  document.querySelectorAll(POST_SELECTOR.map((s) => `${s}[data-hidden=true]`).join(',')).forEach((el) => {
    removeHideClasses(el)
    delete el.dataset.hidden
    delete el.dataset.focusinBanner
  })
  document.querySelectorAll('.focusedin-slop-collapsed, .focusedin-slop-tag').forEach((el) => el.remove())
}

