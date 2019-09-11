module.exports = {
    "env": {
        "node": true,
        "commonjs": true,
        "es6": true,
        "mocha": true
    },
  "plugins": [ "mocha" ],
  "globals": {
      // Test globals
      "after": false,
      "afterEach": false,
      "assert": false,
      "before": false,
      "beforeEach": false,
      "describe": false,
      "expect": true,
      "sinon": false,
      "xit": false
    },
    "rules": {
        "no-unused-expressions": 0,
        "no-restricted-modules": ["error", "assert"],
        "mocha/no-mocha-arrows": 2
    }
};
