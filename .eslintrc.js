module.exports = {
  "env": {
      "browser": true,
      "commonjs": true,
      "es6": true,
  },
  "globals": {
      "_gaq": false,
      "process": false,
      "ActiveXObject": false,
      "VERSION": false,
      // Build globals
      "__dirname": false,
      // Test globals
      "after": false,
      "afterEach": false,
      "assert": false,
      "before": false,
      "beforeEach": false,
      "describe": false,
      "expect": false,
      "it": false,
      "sinon": false,
      "xit": false
  },
  "extends": "node-style-guide",
  "parserOptions": {
      "sourceType": "module"
  },
  "rules": {
      // customizations of Node style-guide
      "indent": [
          "error",
          2
      ],
      "linebreak-style": [
          "error",
          "unix"
      ],
      "quotes": [
          "error",
          "single"
      ],
      "no-var": "error",
      "block-spacing": "error",
      "comma-style": ["error", "last"],
      "comma-spacing": ["error", { "before": false, "after": true }],
      "curly": ["error", "multi-or-nest", "consistent"],
      "object-curly-spacing": ["error", "always"],
      "object-curly-newline": ["error", {
        "ObjectExpression": "always",
        "ObjectPattern": { "multiline": false }
      }],
      "brace-style": ["error", "1tbs", { "allowSingleLine": true }],
      "key-spacing": ["error", { "beforeColon": false, "afterColon": true, "align": "colon" }],
      "semi": ["error", "always"],
      "object-property-newline": ["error"],
      // part of Node Style-guide but ignored
      "max-len": 0,
      "max-statements": 0,
      "space-after-keywords": 0
  }
};
