module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es6: true,
  },
  globals: {
    // Allowed globals
    console: true,

    // Compile-time defines
    __VERSION__: true,
    __USE_SUBTITLES__: true,
    __USE_ALT_AUDIO__: true,
    __USE_EME_DRM__: true,
    __USE_CMCD__: true,
    __USE_CONTENT_STEERING__: true,
    __USE_VARIABLE_SUBSTITUTION__: true,
    __USE_M2TS_ADVANCED_CODECS__: true,
  },
  // see https://github.com/standard/eslint-config-standard
  // 'prettier' (https://github.com/prettier/eslint-config-prettier) must be last
  extends: ['eslint:recommended', 'prettier'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'import'],
  rules: {
    'no-restricted-globals': [
      2,
      {
        name: 'window',
        message:
          'Use `self` instead of `window` to access the global context everywhere (including workers).',
      },
      {
        name: 'SourceBuffer',
        message: 'Use `self.SourceBuffer`',
      },
      {
        name: 'setTimeout',
        message: 'Use `self.setTimeout`',
      },
      {
        name: 'setInterval',
        message: 'Use `self.setInterval`',
      },
    ],

    'no-restricted-properties': [
      2,
      { property: 'findIndex' }, // Intended to block usage of Array.prototype.findIndex
      { property: 'find' }, // Intended to block usage of Array.prototype.find
    ],

    'import/first': 1,
    'no-var': 1,
    'no-empty': 1,
    'no-unused-vars': 'warn',
    'no-console': [
      1,
      {
        allow: ['assert'],
      },
    ],
    'no-fallthrough': 1,
    'no-case-declarations': 2,
    'no-self-assign': 1,
    'new-cap': 1,
    'no-undefined': 0,
    'no-global-assign': 2,
    'prefer-const': 2,
    'dot-notation': 2,
    'no-void': 2,
    'no-useless-catch': 2,
    'no-prototype-builtins': 0,
  },
  overrides: [
    {
      files: ['*.ts'],
      rules: {
        'no-unused-vars': 0,
        'no-undef': 0,
        'no-use-before-define': 'off',
        '@typescript-eslint/no-unused-vars': [
          'warn',
          {
            args: 'none',
          },
        ],
        '@typescript-eslint/prefer-optional-chain': 2,
        '@typescript-eslint/consistent-type-assertions': [
          2,
          {
            assertionStyle: 'as',
            objectLiteralTypeAssertions: 'never',
          },
        ],
      },
    },
  ],
};
