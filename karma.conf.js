const { buildRollupConfig, BUILD_TYPE, FORMAT } = require('./build-config');

const rollupPreprocessor = buildRollupConfig({
  type: BUILD_TYPE.full,
  format: FORMAT.umd,
  minified: false,
  allowCircularDeps: true,
});

// Do not add coverage for JavaScript debugging when running `test:unit:debug`
const preprocessors = {
  './tests/index.js': ['rollup'],
};

// eslint-disable-next-line no-undef
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
