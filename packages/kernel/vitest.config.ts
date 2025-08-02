import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      resolve(__dirname, './tests/**/*.test.ts'),
      resolve(__dirname, './tests/**/*.spec.ts'),
    ],
    exclude: [
      'node_modules/',
      resolve(__dirname, './dist/'),
      resolve(__dirname, './src/**/*.test.ts'),
      resolve(__dirname, './src/**/*.spec.ts'),
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [resolve(__dirname, './src/**/*.ts')],
      exclude: [
        'node_modules/',
        resolve(__dirname, './dist/'),
        resolve(__dirname, './tests/'),
        './**/*.test.ts',
        './**/*.spec.ts',
        './**/*.d.ts',
      ],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    typecheck: {
      tsconfig: resolve(__dirname, './tooling/tsconfig.test.json'),
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@tests': resolve(__dirname, './tests'),
    },
  },
});
