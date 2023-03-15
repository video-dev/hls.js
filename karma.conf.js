/* global process:false */
const { nodeResolve } = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const babel = require('@rollup/plugin-babel').babel;
const replace = require('@rollup/plugin-replace');

const extensions = ['.ts', '.js'];

const rollupPreprocessor = {
  output: {
    format: 'umd',
    banner: '(function __HLS_UMD_BUNDLE__(__IN_WORKER__){',
    footer: '})(false);',
    name: 'hlsjsunittests',
    dir: 'temp',
    sourcemap: 'inline',
  },
  plugins: [
    nodeResolve({
      extensions,
    }),
    commonjs({
      transformMixedEsModules: true,
    }),
    replace({
      preventAssignment: true,
      values: {
        __VERSION__: JSON.stringify(''),
        __USE_SUBTITLES__: JSON.stringify(true),
        __USE_ALT_AUDIO__: JSON.stringify(true),
        __USE_EME_DRM__: JSON.stringify(true),
        __USE_CMCD__: JSON.stringify(true),
        __USE_CONTENT_STEERING__: JSON.stringify(true),
        __USE_VARIABLE_SUBSTITUTION__: JSON.stringify(true),
        __HLS_UMD_WORKER__: JSON.stringify(true),
      },
    }),
    babel({
      extensions,
      babelHelpers: 'bundled',
      presets: [
        [
          '@babel/preset-typescript',
          {
            optimizeConstEnums: true,
          },
        ],
        [
          '@babel/preset-env',
          {
            loose: true,
            modules: false,
            targets: {
              browsers: [
                'chrome >= 47',
                'firefox >= 51',
                'safari >= 8',
                'ios >= 8',
                'android >= 4',
              ],
            },
          },
        ],
      ],
      plugins: [
        [
          '@babel/plugin-proposal-class-properties',
          {
            loose: true,
          },
        ],
        '@babel/plugin-proposal-object-rest-spread',
        '@babel/plugin-transform-object-assign',
        '@babel/plugin-proposal-optional-chaining',
      ],
    }),
  ],
};

// Do not add coverage for JavaScript debugging when running `test:unit:debug`
const preprocessors = {
  './tests/index.js': ['rollup'],
};

if (!process.env.DEBUG_UNIT_TESTS) {
  preprocessors['./src/**/*.ts'] = ['coverage'];
}

module.exports = function (config) {
  config.set({
    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['mocha', 'sinon-chai'],

    // list of files / patterns to load in the browser
    files: [
      {
        pattern: 'tests/index.js',
        watched: false,
      },
    ],

    // list of files to exclude
    exclude: [],

    // preprocess matching files before serving them to the browser
    // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors,

    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://npmjs.org/browse/keyword/karma-reporter
    reporters: ['mocha', 'coverage'],

    coverageReporter: {
      reporters: [
        { type: 'lcov', subdir: '.' },
        { type: 'text', subdir: '.' },
      ],
    },

    rollupPreprocessor,

    // web server port
    port: 9876,

    // enable / disable colors in the output (reporters and logs)
    colors: true,

    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,

    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: false,

    // start these browsers
    // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
    browsers: ['ChromeHeadless'],

    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: true,

    // Concurrency level
    // how many browser should be started simultaneous
    concurrency: Infinity,
  });
};
