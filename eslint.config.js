const js = require('@eslint/js');
const globals = require('globals');
const jestPlugin = require('eslint-plugin-jest');

module.exports = [
  js.configs.recommended,

  // Browser code: plain <script> tags, no bundler, no import/export.
  // Each HTML page loads several of these files one after another, and
  // like any classic multi-<script> page, they all share one global
  // scope — a function defined in auth.js is simply available in
  // dashboard.js once both have loaded. ESLint only ever looks at one
  // file at a time, so it can't see that, and "no-undef" would otherwise
  // flag every one of those shared functions as undefined. The real
  // safety net here is each HTML file's <script> order, not ESLint, so
  // we turn that one rule off for this folder instead of working around
  // it file by file.
  {
    files: ['public/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        firebase: 'readonly',
        module: 'readonly', // only read by pseudonym.js/mood-validate.js, for their Jest export
      },
    },
    rules: {
      'no-undef': 'off',
    },
  },

  // Node code: the seed script and config files, using require/module.exports.
  {
    files: ['scripts/**/*.js', '*.config.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
  },

  // Test code: Jest tests, also plain Node/CommonJS.
  {
    files: ['test/**/*.js'],
    plugins: { jest: jestPlugin },
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.jest },
    },
    rules: {
      ...jestPlugin.configs.recommended.rules,
      // assertSucceeds/assertFails (from @firebase/rules-unit-testing) are
      // our assertions in the rules tests, same as expect().
      'jest/expect-expect': ['warn', { assertFunctionNames: ['expect', 'assertSucceeds', 'assertFails'] }],
    },
  },

  {
    ignores: [
      'node_modules/**',
      'coverage/**',
      // Config data, not logic — nothing in here to lint.
      'public/js/firebase-config.js',
      'public/js/firebase-config.example.js',
    ],
  },
];
