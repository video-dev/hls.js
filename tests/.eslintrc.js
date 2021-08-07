module.exports = {
  env: {
    node: true,
    commonjs: true,
    es6: true,
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
