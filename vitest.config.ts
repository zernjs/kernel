import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: [resolve(__dirname, './tests/setup.ts')],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        'examples/**',
        'tools/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/index.ts',
        'src/**/types.ts',
      ],
      thresholds: {
        statements: 60,
        branches: 60,
        functions: 60,
        lines: 60,
      },
    },
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    exclude: ['node_modules', 'dist'],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@tests': resolve(__dirname, './tests'),
      '@alerts': resolve(__dirname, './src/alerts'),
      '@core': resolve(__dirname, './src/core'),
      '@diagnostics': resolve(__dirname, './src/diagnostics'),
      '@errors': resolve(__dirname, './src/errors'),
      '@events': resolve(__dirname, './src/events'),
      '@hooks': resolve(__dirname, './src/hooks'),
      '@lifecycle': resolve(__dirname, './src/lifecycle'),
      '@plugin': resolve(__dirname, './src/plugin'),
      '@resolver': resolve(__dirname, './src/resolve'),
      '@types': resolve(__dirname, './src/types'),
      '@utils': resolve(__dirname, './src/utils'),
    },
  },
  plugins: [],
  esbuild: {
    target: 'es2022',
  },
});
