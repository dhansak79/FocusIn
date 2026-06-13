import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/visual',
  use: {
    viewport: { width: 400, height: 650 },
  },
})
