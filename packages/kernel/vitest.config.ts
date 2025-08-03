import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['./tests/**/*.test.ts', './tests/**/*.spec.ts'],
    exclude: ['node_modules/', './dist/', './src/**/*.test.ts', './src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/*.d.ts',
        'scripts/',
        'tooling/',
      ],
      reportsDirectory: './coverage',
      all: true,
      thresholds: {
        statements: 50,
        branches: 75,
        functions: 50,
        lines: 50,
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    typecheck: {
      tsconfig: './tooling/tsconfig.test.json',
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@tests': resolve(__dirname, './tests'),
    },
  },
});
