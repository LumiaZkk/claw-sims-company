import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '**/features/**',
            '**/features/company/types',
            '**/features/company/legacy-types',
          ],
        },
      ],
    },
  },
  {
    files: ['src/pages/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '**/infrastructure/**',
            '**/features/backend/**',
            '**/features/gateway/**',
            '**/features/execution/**',
            '**/features/org/**',
            '**/features/company/**',
            '**/features/company/types',
            '**/features/company/legacy-types',
          ],
        },
      ],
    },
  },
  {
    files: ['src/application/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '**/pages/**',
            '**/features/backend/**',
            '**/features/gateway/**',
            '**/features/execution/**',
            '**/features/org/**',
          ],
        },
      ],
    },
  },
  {
    files: ['src/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '**/application/**',
            '**/infrastructure/**',
            '**/pages/**',
            '**/shared/presentation/**',
            '**/system/**',
            '**/ui/**',
            '**/features/company/types',
            '**/features/company/legacy-types',
          ],
        },
      ],
    },
  },
  {
    files: [
      'src/pages/automation/Page.tsx',
      'src/pages/workspace/Page.tsx',
      'src/pages/board/Page.tsx',
      'src/pages/ceo/Page.tsx',
      'src/pages/chat/Page.tsx',
      'src/pages/lobby/Page.tsx',
    ],
    rules: {
      'react-hooks/exhaustive-deps': 'off',
    },
  },
])
