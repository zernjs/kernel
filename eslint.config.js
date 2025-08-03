import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

export default [
  // Base JavaScript recommended rules
  js.configs.recommended,

  // TypeScript configuration
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        // Node.js globals
        process: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        globalThis: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      prettier: prettier,
    },
    rules: {
      // TypeScript recommended rules (without type-checking)
      ...tseslint.configs.recommended.rules,

      // Prettier integration
      'prettier/prettier': 'error',

      // Custom TypeScript rules (without type-checking)
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // Error handling system needs DOM types for browser compatibility
  {
    files: ['**/error-handling-system.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        // Node.js globals
        process: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        globalThis: 'readonly',
        // DOM globals needed for browser compatibility
        Window: 'readonly',
        Event: 'readonly',
        EventTarget: 'readonly',
        EventListener: 'readonly',
        ErrorEvent: 'readonly',
        PromiseRejectionEvent: 'readonly',
        window: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      prettier: prettier,
    },
    rules: {
      // TypeScript recommended rules (without type-checking)
      ...tseslint.configs.recommended.rules,

      // Prettier integration
      'prettier/prettier': 'error',

      // Custom TypeScript rules (without type-checking)
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // Browser environment for UI files
  {
    files: ['**/ui/**/*.ts', '**/ui/**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        // Node.js globals
        process: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        HTMLElement: 'readonly',
        Element: 'readonly',
        Audio: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        fetch: 'readonly',
        XMLHttpRequest: 'readonly',
        FormData: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly',
        EventTarget: 'readonly',
        MutationObserver: 'readonly',
        ResizeObserver: 'readonly',
        IntersectionObserver: 'readonly',
        AudioContext: 'readonly',
        webkitAudioContext: 'readonly',
        globalThis: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      prettier: prettier,
    },
    rules: {
      // TypeScript recommended rules (without type-checking)
      ...tseslint.configs.recommended.rules,

      // Prettier integration
      'prettier/prettier': 'error',

      // Custom TypeScript rules (without type-checking)
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // Prettier config (disables conflicting rules)
  prettierConfig,

  // Global ignores
  {
    ignores: ['dist/', 'node_modules/', '**/*.js', '**/*.d.ts', '**/dist/**', '**/node_modules/**'],
  },
];
