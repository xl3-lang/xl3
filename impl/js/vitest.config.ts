import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: '../../coverage',
      include: ['src/**/*.ts'],
      // CLI behavior is covered by child-process tests against dist/. V8
      // cannot attribute those subprocess instructions to this test process,
      // so including src/bin would report a misleading hard zero.
      exclude: ['src/**/__tests__/**', 'src/bin/**'],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 75,
        lines: 74,
      },
    },
  },
});
