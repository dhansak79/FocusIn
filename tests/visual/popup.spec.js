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

test('AI content section — switches present', async ({ page }) => {
  await expect(page.locator('label[for="detect-slop"]').first()).toBeVisible()
  await expect(page.locator('label[for="slop-archetype"]').first()).toBeVisible()
  await page.screenshot({ path: 'tests/visual/screenshots/ai-content.png', fullPage: true })
})

test('Keyword filter — present', async ({ page }) => {
  await expect(page.locator('#hide-by-keywords')).toBeAttached()
})

test('Removed sections — not present', async ({ page }) => {
  await expect(page.locator('label[for="hide-whole-feed"]')).not.toBeAttached()
  await expect(page.locator('label[for="sort-by-recent"]')).not.toBeAttached()
  await expect(page.locator('label[for="hide-slop"]')).not.toBeAttached()
  await expect(page.locator('#unfollow-all')).not.toBeAttached()
  await expect(page.locator('label[for="hide-advertisements"]')).not.toBeAttached()
  await expect(page.locator('#hide-by-job-keywords')).not.toBeAttached()
})

test('Master toggle switches to DISABLED', async ({ page }) => {
  await expect(page.locator('#main-toggle')).toBeChecked()
  await page.locator('label.master-field-text').click()
  await expect(page.locator('#main-toggle')).not.toBeChecked()
  await page.screenshot({ path: 'tests/visual/screenshots/disabled.png' })
})
