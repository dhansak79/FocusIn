// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { unfollowAll } from '../../src/features/misc.js'
import doMisc from '../../src/features/misc.js'
import {
  hideBySelector,
  hideParentBySelector,
  showBySelector,
  showParentBySelector,
  showAncestorIndexBySelector,
  hideAncestorIndexBySelector,
} from '../../src/utils.js'

vi.mock('../../src/utils.js', () => ({
  hideBySelector: vi.fn(),
  hideParentBySelector: vi.fn(),
  showBySelector: vi.fn(),
  showParentBySelector: vi.fn(),
  showAncestorIndexBySelector: vi.fn(),
  hideAncestorIndexBySelector: vi.fn(),
}))

const UNFOLLOW_BTN = 'button[aria-label^="Click to stop"]'

// ---------------------------------------------------------------------------
// unfollowAll
// ---------------------------------------------------------------------------

describe('unfollowAll', () => {
  let logSpy

  beforeEach(() => {
    vi.useFakeTimers()
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    document.body.innerHTML = ''
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('logs success immediately when no buttons are present', async () => {
    await unfollowAll()
    expect(logSpy).toHaveBeenCalledWith('LinkOff: Successfully unfollowed all')
  })

  it('clicks all buttons and logs success after they disappear', async () => {
    document.body.innerHTML = `
      <button aria-label="Click to stop following Alice"></button>
      <button aria-label="Click to stop following Bob"></button>
    `
    const buttons = [...document.querySelectorAll(UNFOLLOW_BTN)]
    const clickSpies = buttons.map((b) => vi.spyOn(b, 'click'))

    // Remove buttons after first click so round 2 finds none
    buttons[0].addEventListener('click', () => {
      document.body.innerHTML = ''
    })

    const promise = unfollowAll()
    await vi.advanceTimersByTimeAsync(200)  // 2 buttons × 100ms
    await vi.advanceTimersByTimeAsync(1000) // round-end wait
    await promise

    clickSpies.forEach((spy) => expect(spy).toHaveBeenCalled())
    expect(logSpy).toHaveBeenCalledWith('LinkOff: Successfully unfollowed all')
  })

  it('terminates after 10 rounds when buttons never disappear', async () => {
    document.body.innerHTML = `<button aria-label="Click to stop following Alice"></button>`

    const promise = unfollowAll()
    // 10 rounds × (100ms per button + 1000ms wait)
    await vi.advanceTimersByTimeAsync(11000)
    await promise

    // Terminated without logging success (buttons never cleared)
    expect(logSpy).not.toHaveBeenCalledWith('LinkOff: Successfully unfollowed all')
  })
})

// ---------------------------------------------------------------------------
// doMisc (default export)
// ---------------------------------------------------------------------------

describe('doMisc', () => {
  let checkNeedUpdate

  beforeEach(() => {
    checkNeedUpdate = vi.fn().mockReturnValue(false)
    vi.clearAllMocks()
  })

  it('calls showAll when main-toggle is toggled off', () => {
    checkNeedUpdate.mockImplementation((field, bool) => field === 'main-toggle' && bool === false)
    doMisc(checkNeedUpdate, false, 'hide')
    expect(showParentBySelector).toHaveBeenCalled()
    expect(showBySelector).toHaveBeenCalled()
    expect(showAncestorIndexBySelector).toHaveBeenCalled()
  })

  it('does not call handlers when not enabled', () => {
    doMisc(checkNeedUpdate, false, 'hide')
    expect(hideBySelector).not.toHaveBeenCalled()
    expect(hideParentBySelector).not.toHaveBeenCalled()
    expect(hideAncestorIndexBySelector).not.toHaveBeenCalled()
  })

  it('hides advertisements when toggled on', () => {
    checkNeedUpdate.mockImplementation((f, b) => f === 'hide-advertisements' && b === true)
    doMisc(checkNeedUpdate, true, 'hide')
    expect(hideParentBySelector).toHaveBeenCalled()
  })

  it('shows advertisement when hide-advertisements toggled off', () => {
    checkNeedUpdate.mockImplementation((f, b) => f === 'hide-advertisements' && b === false)
    doMisc(checkNeedUpdate, true, 'hide')
    expect(showParentBySelector).toHaveBeenCalled()
  })

  it('hides notification count when toggled on', () => {
    checkNeedUpdate.mockImplementation((f, b) => f === 'hide-notification-count' && b === true)
    doMisc(checkNeedUpdate, true, 'hide')
    expect(hideBySelector).toHaveBeenCalled()
  })

  it('shows notification count when hide-notification-count toggled off', () => {
    checkNeedUpdate.mockImplementation((f, b) => f === 'hide-notification-count' && b === false)
    doMisc(checkNeedUpdate, true, 'hide')
    expect(showBySelector).toHaveBeenCalled()
  })

  it('hides news when toggled on', () => {
    checkNeedUpdate.mockImplementation((f, b) => f === 'hide-news' && b === true)
    doMisc(checkNeedUpdate, true, 'dim')
    expect(hideBySelector).toHaveBeenCalled()
  })

  it('shows news when hide-news toggled off', () => {
    checkNeedUpdate.mockImplementation((f, b) => f === 'hide-news' && b === false)
    doMisc(checkNeedUpdate, true, 'hide')
    expect(showBySelector).toHaveBeenCalled()
  })

  it('hides premium elements when toggled on', () => {
    checkNeedUpdate.mockImplementation((f, b) => f === 'hide-premium' && b === true)
    doMisc(checkNeedUpdate, true, 'hide')
    expect(hideBySelector).toHaveBeenCalled()
    expect(hideAncestorIndexBySelector).toHaveBeenCalled()
  })

  it('shows premium when hide-premium toggled off', () => {
    checkNeedUpdate.mockImplementation((f, b) => f === 'hide-premium' && b === false)
    doMisc(checkNeedUpdate, true, 'hide')
    expect(showBySelector).toHaveBeenCalled()
    expect(showAncestorIndexBySelector).toHaveBeenCalled()
  })

  it('hides follow recommendations when toggled on', () => {
    checkNeedUpdate.mockImplementation((f, b) => f === 'hide-follow-recommendations' && b === true)
    doMisc(checkNeedUpdate, true, 'hide')
    expect(hideAncestorIndexBySelector).toHaveBeenCalled()
  })

  it('shows follow recommendations when toggled off', () => {
    checkNeedUpdate.mockImplementation((f, b) => f === 'hide-follow-recommendations' && b === false)
    doMisc(checkNeedUpdate, true, 'hide')
    expect(showAncestorIndexBySelector).toHaveBeenCalled()
  })
})
