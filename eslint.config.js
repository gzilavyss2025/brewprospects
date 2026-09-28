import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  { ignores: ['dist/', '.astro/', '.vercel/', 'node_modules/', 'test-results/', 'playwright-report/'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // JSX identifiers count as uses only with eslint-plugin-react; this repo
      // has one island, so allow capitalized names instead of the plugin.
      'no-unused-vars': ['error', { varsIgnorePattern: '^([A-Z]|_)', argsIgnorePattern: '^_' }],
    },
  },
]
