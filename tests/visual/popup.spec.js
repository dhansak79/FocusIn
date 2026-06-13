import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const popupUrl = `file://${path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/popup/popup.html')}`

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

test('Header — title and master toggle present', async ({ page }) => {
  await expect(page.locator('.app-title')).toHaveText('FocusIn')
  await expect(page.locator('.app-subtitle')).toHaveText('LinkedIn Attention Filter')
  await expect(page.locator('#main-toggle')).toBeChecked()
  await expect(page.locator('label.master-field-text')).toBeVisible()
  await page.screenshot({ path: 'tests/visual/screenshots/top.png' })
})

test('No Noah Jelich references', async ({ page }) => {
  const html = await page.content()
  expect(html).not.toContain('Noah')
  expect(html).not.toContain('jelich')
  expect(html).not.toContain('ko-fi')
  expect(html).not.toContain('Buy me')
})

test('Feed section — switches present', async ({ page }) => {
  await expect(page.locator('label[for="hide-whole-feed"]').first()).toBeVisible()
  await expect(page.locator('label[for="sort-by-recent"]').first()).toBeVisible()
  await expect(page.locator('label[for="detect-slop"]').first()).toBeVisible()
  await expect(page.locator('#hide-by-keywords')).toBeAttached()
  await page.screenshot({ path: 'tests/visual/screenshots/feed.png', fullPage: true })
})

test('Jobs section — present', async ({ page }) => {
  await expect(page.locator('label[for="hide-promoted-jobs"]').first()).toBeVisible()
  await expect(page.locator('#hide-by-job-keywords')).toBeAttached()
})

test('Misc section — present', async ({ page }) => {
  await expect(page.locator('#unfollow-all')).toBeVisible()
  await expect(page.locator('label[for="hide-advertisements"]').first()).toBeVisible()
})

test('Master toggle switches to DISABLED', async ({ page }) => {
  await expect(page.locator('#main-toggle')).toBeChecked()
  await page.locator('label.master-field-text').click()
  await expect(page.locator('#main-toggle')).not.toBeChecked()
  await page.screenshot({ path: 'tests/visual/screenshots/disabled.png' })
})
