module.exports = {
  'env': {
    'browser': true,
    'commonjs': true,
    'es6': true
  },
  'globals': {
    // Allowed globals
    'console': true,

    // Compile-time defines
    '__VERSION__': true,
    '__USE_SUBTITLES__': true,
    '__USE_ALT_AUDIO__': true,
    '__USE_EME_DRM__': true
  },
  // see https://standardjs.com/
  // see https://github.com/standard/eslint-config-standard
  'extends': [
    'eslint:recommended',
    'standard'
  ],
  'parser': 'typescript-eslint-parser',
  'plugins': [
      'typescript'
  ],
  'parserOptions': {
    'sourceType': 'module'
  },
  'rules': {
    // our basic style rules
    'semi': [
      'error',
      'always'
    ],
    'indent': [
      'error',
      2
    ],
    'quotes': [
      'error',
      'single'
    ],
    'linebreak-style': [
      'error',
      'unix'
    ],
    // spacing
    'space-infix-ops': 2,
    'space-unary-ops': [2, { 'words': true, 'nonwords': false }],
    'space-in-parens': ['error', 'never'],
    'keyword-spacing': [2, { 'before': true, 'after': true }],
    // enforce litteral objects on multiple lines
    'block-spacing': 'error',
    'curly': 2,
    'object-curly-spacing': ['error', 'always'],
    'brace-style': ['error', '1tbs', { 'allowSingleLine': false }],

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
    'one-var': [
      1,
      'never'
    ],

    'no-restricted-properties': [2,
      { 'property': 'findIndex' },  // Intended to block usage of Array.prototype.findIndex
      { 'property': 'find' }        // Intended to block usage of Array.prototype.find
    ],

    'standard/no-callback-literal': 1,
    'import/first': 1,
    'no-var': 1,
    'no-empty': 1,
    'no-mixed-operators': 1,
    'no-unused-vars': 1,
    'no-console': 1,
    'no-fallthrough': 1,
    'no-case-declarations': 1,
    'no-irregular-whitespace': 1,
    'no-self-assign': 1,
    'new-cap': 1,
    'no-undefined': 1,
    'no-global-assign': 2
  }
};
