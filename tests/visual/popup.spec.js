import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const popupUrl = `file://${path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/popup/popup.html')}`

const showTab = (page, id) =>
  page.evaluate((tabId) => {
    document.querySelectorAll('.content-tab').forEach((t) => (t.style.display = 'none'))
    document.getElementById(tabId).style.display = 'block'
  }, id)

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.chrome = {
      storage: {
        local: {
          get: (_keys, cb) => cb({}),
          set: () => {},
        },
      },
      tabs: {
        query: (_opts, cb) => cb([{ id: 1 }]),
        sendMessage: () => {},
      },
      runtime: { lastError: null },
    }
  })
  await page.goto(popupUrl)
})

test('Home tab — title and master toggle present', async ({ page }) => {
  await expect(page.locator('.app-title')).toHaveText('FocusIn')
  await expect(page.locator('.app-subtitle')).toHaveText('LinkedIn Attention Filter')
  await expect(page.locator('#main-toggle')).toBeChecked()
  await expect(page.locator('.onoffswitch-label')).toBeVisible()
  await page.screenshot({ path: 'tests/visual/screenshots/home.png' })
})

test('Home tab — no Noah Jelich references', async ({ page }) => {
  const html = await page.content()
  expect(html).not.toContain('Noah')
  expect(html).not.toContain('jelich')
  expect(html).not.toContain('ko-fi')
  expect(html).not.toContain('Buy me')
})

test('Feed tab — switches and sections present', async ({ page }) => {
  await showTab(page, 'Feed')
  await expect(page.locator('#Feed')).toBeVisible()
  await expect(page.locator('label[for="hide-whole-feed"]')).toBeVisible()
  await expect(page.locator('label[for="detect-slop"]')).toBeVisible()
  await expect(page.locator('#hide-by-keywords')).toBeAttached()
  await page.screenshot({ path: 'tests/visual/screenshots/feed.png' })
})

test('Jobs tab — present', async ({ page }) => {
  await showTab(page, 'Jobs')
  await expect(page.locator('#Jobs')).toBeVisible()
  await expect(page.locator('label[for="hide-promoted-jobs"]')).toBeVisible()
  await page.screenshot({ path: 'tests/visual/screenshots/jobs.png' })
})

test('Misc tab — present', async ({ page }) => {
  await showTab(page, 'Misc')
  await expect(page.locator('#Misc')).toBeVisible()
  await expect(page.locator('#unfollow-all')).toBeVisible()
  await page.screenshot({ path: 'tests/visual/screenshots/misc.png' })
})

test('Master toggle switches to DISABLED', async ({ page }) => {
  await expect(page.locator('#main-toggle')).toBeChecked()
  await page.locator('.onoffswitch-label').click()
  await expect(page.locator('#main-toggle')).not.toBeChecked()
  await page.screenshot({ path: 'tests/visual/screenshots/home-disabled.png' })
})
