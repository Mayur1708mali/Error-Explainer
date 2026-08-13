import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-plugin-prettier'
import prettierConfig from 'eslint-config-prettier'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // ── Global ignores ────────────────────────────────────────────────────────
  globalIgnores(['dist/**', 'build/**', 'coverage/**', 'node_modules/**', '**/*.d.ts']),

  // ── Shared base: all TS/JS files across /src and /backend ─────────────────
  {
    files: ['src/**/*.{ts,tsx,js,jsx}', 'backend/**/*.{ts,js}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    plugins: {
      prettier,
    },
    rules: {
      // Prettier formatting as ESLint errors
      'prettier/prettier': 'error',

      // Sensible defaults for both environments
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'no-debugger': 'error',
      'no-duplicate-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    },
    // Disable any ESLint rules that conflict with Prettier
    ...prettierConfig,
  },

  // ── Frontend: /src — React, browser globals ───────────────────────────────
  {
    files: ['src/**/*.{ts,tsx,js,jsx}'],
    extends: [
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // ── Backend: /backend — Node.js globals ───────────────────────────────────
  {
    files: ['backend/**/*.{ts,js}'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      // Node-specific: allow require() if backend mixes CJS
      '@typescript-eslint/no-require-imports': 'off',
      'no-process-exit': 'off',
    },
  },

  // ── Tooling configs (vite.config.ts, etc.) ────────────────────────────────
  {
    files: ['*.config.{ts,js}', '*.config.*.{ts,js}'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
