const { buildRollupConfig, BUILD_TYPE, FORMAT } = require('./build-config');

// Do not add coverage for JavaScript debugging when running `test:unit:debug`
// eslint-disable-next-line no-undef
const includeCoverage = !process.env.DEBUG_UNIT_TESTS && !process.env.CI;

const rollupPreprocessor = buildRollupConfig({
  type: BUILD_TYPE.full,
  format: FORMAT.iife,
  minified: false,
  allowCircularDeps: true,
  includeCoverage,
  sourcemap: false,
  outputFile: 'karma-temp/tests.js',
});

// preprocess matching files before serving them to the browser
// available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
const preprocessors = {
  './tests/index.js': ['rollup'],
};
// test results reporter to use
// possible values: 'dots', 'progress'
// available reporters: https://npmjs.org/browse/keyword/karma-reporter
const reporters = ['mocha'];
const coverageReporter = {
  reporters: [],
};

if (includeCoverage) {
  reporters.push('coverage');
  coverageReporter.reporters.push({ type: 'html', subdir: '.' });
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

    preprocessors,
    coverageReporter,
    reporters,

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
    concurrency: 1,
  });
};
