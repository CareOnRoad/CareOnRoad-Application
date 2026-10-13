const path = require('node:path');
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/**', '.expo/**'] },
  {
    files: ['**/*.js', '**/*.cjs'],
    languageOptions: { globals: { __dirname: 'readonly' } },
  },
  {
    // Compiler diagnostics stay visible without changing existing runtime flows.
    // React Compiler is explicitly disabled in app.config.ts.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/static-components': 'warn',
    },
  },
  {
    settings: {
      'import/resolver': { typescript: { project: path.join(__dirname, 'tsconfig.json') } },
    },
  },
]);
