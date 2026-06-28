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
        'src/constants.js',
        'src/features/slop-detector.js',
        'src/features/slop-keywords.js',
        'src/features/classifier.js',
        'src/features/semantic-filter.js',
        'src/features/tone-filter.js',
        'src/features/feed.js',
        'src/features/slop-reaction.js',
        'src/features/unfollow.js',
        'src/utils.js',
        'src/stats.js',
        'src/stats-renderer.js',
        'src/popup/popup.js',
        'scripts/spec-coverage.js',
        'scripts/generate-guardrails-dashboard.js',
        'scripts/migrate-specs-to-features.js',
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
