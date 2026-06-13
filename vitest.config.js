import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: ['node_modules/**', '.stryker-tmp/**', 'tests/visual/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'src/index.js',
        'src/service_worker.js',
        'src/features/feed-keywords.js',
        'src/features/job-keywords.js',
        'src/features/jobs.js',
        'src/features/misc.js',
        'src/features/slop-detector.js',
        'src/features/feed.js',
        'src/features/message.js',
        'src/utils.js',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
})
