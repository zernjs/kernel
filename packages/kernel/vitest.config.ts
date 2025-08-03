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
      reporter: ['text', 'json', 'html'],
      include: ['./src/**/*.ts'],
      exclude: [
        'node_modules/',
        './dist/',
        './tests/',
        './**/*.test.ts',
        './**/*.spec.ts',
        './**/*.d.ts',
      ],
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
