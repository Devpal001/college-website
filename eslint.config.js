import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Data-fetching loaders (NewsPage, AdminNews, AdminAgent, Notifications)
      // intentionally flip loading/error state synchronously when an effect
      // (re)runs so skeletons render immediately. This compiler heuristic
      // flags the standard fetch-in-effect pattern, so it is disabled here.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    // Express server runs in Node (ESM — package.json has "type": "module").
    files: ['server/**/*.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // One-off maintenance scripts use CommonJS (require / __dirname).
    files: ['scripts/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: globals.node,
    },
  },
])
