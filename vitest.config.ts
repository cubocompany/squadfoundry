import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      include: ['orchestrator/**/*.ts'],
      exclude: ['orchestrator/cli/**', 'orchestrator/adapters/**/stub*.ts'],
      reporter: ['text', 'html', 'json'],
    },
    testTimeout: 10000,
  },
})
