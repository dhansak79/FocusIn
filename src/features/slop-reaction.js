import { trackSlopCollapsed, trackManualSlopReaction } from '../stats.js'

const REACTIONS_BTN = 'button[aria-label="Open reactions menu"]'

const isPostBoundary = (node) =>
  node.matches('[role="listitem"]') ||
  !!node.parentElement?.hasAttribute('data-lazy-mount-id') ||
  node.parentElement?.getAttribute('data-display-contents') === 'true' ||
  (node.tagName === 'LI' && !!node.closest('.scaffold-finite-scroll--infinite'))

const findPostAncestor = (el) => {
  // data-urn="urn:li:activity:..." is the most reliable LinkedIn post identifier
  const byUrn = el.closest('[data-urn*="activity"]')
  if (byUrn) return byUrn
  for (let node = el.parentElement; node; node = node.parentElement) {
    if (isPostBoundary(node)) return node
  }
  return null
}

const injectIntoPost = (reactionsBtn, getVanity, getName) => {
  // Guard on the reaction group div, not the post, so injection always happens
  // even when findPostAncestor can't resolve the post boundary
  const reactionGroup = reactionsBtn.parentElement
  if (!reactionGroup || reactionGroup.dataset.focusinSlopBtn) return
  reactionGroup.dataset.focusinSlopBtn = '1'

  const post = findPostAncestor(reactionsBtn)

  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'focusedin-slop-reaction-btn'
  btn.setAttribute('aria-label', 'Mark as AI Slop')
  btn.textContent = '🤖'

  btn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    // Re-try post lookup at click time if not resolved at injection time
    const target = post ?? findPostAncestor(btn)
    if (target) {
      trackManualSlopReaction(getVanity(target), getName(target))
    }
    trackSlopCollapsed(['manual'])
  })

  reactionGroup.after(btn)
}

let slopButtonObserver = null

export const initSlopReaction = (feedContainer, getVanity, getName) => {
  slopButtonObserver = new MutationObserver((mutations) => {
    for (const { addedNodes } of mutations) {
      for (const node of addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue
        if (node.matches?.(REACTIONS_BTN)) {
          injectIntoPost(node, getVanity, getName)
        } else {
          node.querySelectorAll(REACTIONS_BTN).forEach(
            (btn) => injectIntoPost(btn, getVanity, getName)
          )
        }
      }
    }
  })
  slopButtonObserver.observe(feedContainer, { childList: true, subtree: true })
  feedContainer.querySelectorAll(REACTIONS_BTN).forEach(
    (btn) => injectIntoPost(btn, getVanity, getName)
  )
}

export const disconnectSlopReaction = () => {
  slopButtonObserver?.disconnect()
  slopButtonObserver = null
}
