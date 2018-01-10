module.exports = {
  "env": {
      "browser": true,
      "commonjs": true,
      "es6": true,
  },
  "globals": {
      // Allowed globals
      "console": true,
      "MediaSource": true,
      "performance": true,
      "crypto": true,
      "fetch": true,
      "Request": true,
      "Headers": true,
      "escape": true,
      // Compile-time defines
      "__VERSION__": true,
      "__USE_SUBTITLES__": true,
      "__USE_ALT_AUDIO__": true,
      "__USE_EME_DRM__": true
  },
  /*
  "extends": "node-style-guide",
  */
  "parserOptions": {
      "sourceType": "module"
  },
  "plugins": ["prettier"],
  "rules": {


      "no-bitwise": 0,
      "camelcase": 2,
      "curly": 2,
      "eqeqeq": 2,
      "no-eq-null": 2,
      "wrap-iife": [
        2,
        "any"
      ],
      "indent": 0,
      /*
      "indent": [
        2,
        4,
        {
          "SwitchCase": 1
        }
      ],
      */
      "no-use-before-define": [
        2,
        {
          "functions": false
        }
      ],
      "new-cap": 2,
      "no-caller": 2,
      "quotes": [
        2,
        "single"
      ],
      "strict": 0,
      "no-undef": 2,
      "no-unused-vars": 2

      /*
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
      */
  }
};
