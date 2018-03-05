module.exports = {
  "env": {
    "browser": true,
    "commonjs": true,
    "es6": true,
  },
  "globals": {
    // Allowed globals
    "console": true,
    //"MediaSource": true,
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
  // see https://standardjs.com/
  // see https://github.com/standard/eslint-config-standard
  // see https://github.com/felixge/node-style-guide
  "extends": [
    "eslint:recommended",
    "standard"
  ],
  "parserOptions": {
    "sourceType": "module"
  },
  "rules": {
    // our basic style rules
    "semi": ["error", "always"],
    "indent": [
      "error",
      2
    ],
    "quotes": [
      "error",
      "single"
    ],
    "linebreak-style": [
      "error",
      "unix"
    ],
    "space-infix-ops": 2,
    "space-unary-ops": [2, {"words": true, "nonwords": false}],
    "space-in-parens": ["error", "never"],
    "keyword-spacing": [2, {"before": true, "after": true}],

    "one-var": 0,

    // limit code block and line length
    /*
    "max-len": 0,
    "max-statements": 0,
    "max-depth": 0,
    "max-nested-callbacks": 0,
    "max-params": 0,
    "max-statements": 0,
    "max-statements-per-line": 0
    */

    // loosening of code-quality rules we may want to fix later
    // (warnings for now)
    "standard/no-callback-literal": 1,
    "import/first": 1,
    "no-empty": 1,
    "no-mixed-operators": 1,
    "no-unused-vars": 1,
    "no-console": 1,
    "no-fallthrough": 1,
    "no-case-declarations": 1,
    "no-irregular-whitespace": 1,
    "no-self-assign": 1,
    "new-cap": 1,
    "no-undefined": 1
  }
};
