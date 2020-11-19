module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es6: true
  },
  globals: {
    // Allowed globals
    console: true,

    // Compile-time defines
    __VERSION__: true,
    __USE_SUBTITLES__: true,
    __USE_ALT_AUDIO__: true,
    __USE_EME_DRM__: true
  },
  // see https://standardjs.com/
  // see https://github.com/standard/eslint-config-standard
  extends: [
    'eslint:recommended',
    'standard'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module'
  },
  plugins: [
    '@typescript-eslint'
  ],
  rules: {
    // our basic style rules
    semi: [
      'error',
      'always'
    ],
    indent: [
      'error',
      2
    ],
    quotes: [
      'error',
      'single'
    ],
    'linebreak-style': [
      'error',
      'unix'
    ],
    // spacing
    'space-infix-ops': 2,
    'space-unary-ops': [2, { words: true, nonwords: false }],
    'space-in-parens': ['error', 'never'],
    'keyword-spacing': [2, { before: true, after: true }],
    // enforce litteral objects on multiple lines
    'block-spacing': 'error',
    curly: 2,
    'object-curly-spacing': ['error', 'always'],
    'brace-style': ['error', '1tbs', { allowSingleLine: false }],

    // limit code block and line length
    /*
    "max-len": 1,
    "max-statements": 1,
    "max-depth": 1,
    "max-nested-callbacks": 1,
    "max-params": 1,
    "max-statements": 1,
    "max-statements-per-line": 1
    */

    // loosening of code-quality rules we may want to fix later
    // (warnings for now)

    // forbid "one var" style, enforce one declaration per variable
    'one-var': 2,

    'no-restricted-globals': [2,
      {
        name: 'window',
        message: 'Use `self` instead of `window` to access the global context everywhere (including workers).'
      },
      {
        name: 'SourceBuffer',
        message: 'Use `self.SourceBuffer`'
      },
      {
        name: 'setTimeout',
        message: 'Use `self.setTimeout`'
      },
      {
        name: 'setInterval',
        message: 'Use `self.setInterval`'
      }
    ],

    'no-restricted-properties': [2,
      { property: 'findIndex' }, // Intended to block usage of Array.prototype.findIndex
      { property: 'find' } // Intended to block usage of Array.prototype.find
    ],

    'standard/no-callback-literal': 0,
    'import/first': 1,
    'no-var': 1,
    'no-empty': 1,
    'no-mixed-operators': 2,
    'no-unused-vars': 2,
    'no-console': [
      1,
      {
        allow: ['assert']
      }
    ],
    'no-fallthrough': 1,
    'no-case-declarations': 2,
    'no-irregular-whitespace': 1,
    'no-self-assign': 1,
    'new-cap': 1,
    'no-undefined': 0,
    'no-global-assign': 2,
    'prefer-const': 2,
    'dot-notation': 2,
    'array-bracket-spacing': 2,
    'quote-props': 2,
    'no-void': 2,
    'no-useless-catch': 2,
    'lines-between-class-members': 2,
    'no-prototype-builtins': 0
  },
  overrides: [
    {
      files: ['*.ts'],
      rules: {
        'no-unused-vars': 0,
        'no-undef': 0,
        'no-use-before-define': 'off',
        // '@typescript-eslint/no-use-before-define': ['error'],
        '@typescript-eslint/no-unused-vars': ['error', { args: 'none' }],
        '@typescript-eslint/prefer-optional-chain': 2,
        '@typescript-eslint/consistent-type-assertions': [2,
          {
            assertionStyle: 'as',
            objectLiteralTypeAssertions: 'never'
          }
        ]
      }
    }
  ]
};
