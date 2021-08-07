module.exports = {
  env: {
    node: true,
    commonjs: true,
    es6: false,
    mocha: true,
  },
  plugins: ['mocha', 'node'],
  globals: {
    // Test globals
    after: false,
    afterEach: false,
    assert: false,
    before: false,
    beforeEach: false,
    describe: false,
    expect: true,
    sinon: false,
    xit: false,
  },
  rules: {
    'object-shorthand': ['error', 'never'], // Object-shorthand not supported in IE11
    // destructuring is not supported in IE11. This does not prevent it.
    // ES6 env settings in parent files cannot be overwritten.
    'prefer-destructuring': ['error', { object: false, array: false }],
    'one-var': 0,
    'no-undefined': 0,
    'no-unused-expressions': 0,
    'no-restricted-properties': [
      2,
      { property: 'findIndex' }, // Intended to block usage of Array.prototype.findIndex
      { property: 'find' }, // Intended to block usage of Array.prototype.find
      { property: 'only' }, // Intended to block usage of it.only in commits
    ],
    'node/no-restricted-require': ['error', ['assert']],
    'mocha/no-mocha-arrows': 2,
  },
};
