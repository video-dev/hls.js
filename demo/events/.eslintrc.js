module.exports = {
  env: {
    browser: true,
    es6: true,
  },
  globals: {
    Hls: true,
    hls: true,
  },
  extends: ['eslint:recommended', 'prettier'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module',
    project: './tsconfig.json',
  },
  ignorePatterns: ['src/ace.d.ts', 'dist/**'],
  rules: {
    'no-restricted-globals': 0,
    'no-restricted-properties': 0,
    'no-cond-assign': 0,
    'no-console': 0,
    'no-extra-parens': 0,
    'block-scoped-var': 0,
    complexity: 0,
    'consistent-return': 0,
    'no-eval': 0,
    'no-extend-native': 0,
    'no-unused-expressions': 1,
    'no-warning-comments': [0, { terms: ['todo', 'fixme'], location: 'start' }],
    strict: 0,
    'no-use-before-define': 0,
    'func-names': 0,
    'func-style': 0,
    'newline-after-var': 0,
    'no-inline-comments': 0,
    'no-ternary': 0,
    'no-trailing-spaces': 0,
    'no-underscore-dangle': 0,
    'sort-vars': 0,
    'wrap-regex': 0,
    'max-params': 0,
    'max-statements': 0,
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
