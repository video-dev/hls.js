// Karma configuration
// Generated on Tue Jul 18 2017 12:17:16 GMT-0700 (PDT)
const path = require('path');
const fs = require('fs');
const merge = require('webpack-merge');
const webpackConfig = require('./webpack.config')({ debug: true })[0];
delete webpackConfig.entry;
delete webpackConfig.output;
const mergeConfig = merge(webpackConfig, {
  devtool: 'inline-source-map',
  module: {
    rules: [
      {
        test: /\.(ts|js)$/,
        exclude: path.resolve(__dirname, 'node_modules'),
        enforce: 'post',
        use: [
          {
            loader: 'coverage-istanbul-loader',
            options: {
              esModules: true
            }
          }
        ]
      }
    ]
  }
});

module.exports = function (config) {
  config.set({
    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['mocha', 'sinon-chai'],

    // list of files / patterns to load in the browser
    // https://github.com/webpack-contrib/karma-webpack#alternative-usage
    files: ['tests/index.js'],

    // list of files to exclude
    exclude: [],

    // preprocess matching files before serving them to the browser
    // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors: {
      'tests/index.js': ['webpack', 'sourcemap']
    },

    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://npmjs.org/browse/keyword/karma-reporter
    reporters: ['mocha', 'coverage-istanbul'],

    coverageIstanbulReporter: {
      reports: ['lcov', 'text-summary'],
      fixWebpackSourcePaths: true
    },

    webpack: mergeConfig,

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
    browsers: ['ChromeOptionalSSL'],

    // configure Chrome to allow localhost SSL (used to test EME) or use Chrome Headless
    customLaunchers: {
      ChromeOptionalSSL: {
        base: process.env.KARMA_SSL ? 'Chrome' : 'ChromeHeadless',
        flags: process.env.KARMA_SSL ? ['--ignore-certificate-errors', '--allow-running-insecure-content '] : []
      }
    },

    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: true,

    // Concurrency level
    // how many browser should be started simultaneous
    concurrency: Infinity,

    // Test Server protocol
    // needed to test EME, only set if env has KARMA_SSL=true
    protocol: process.env.KARMA_SSL ? 'https' : 'http',

    // HTTP Server options
    // allows tester to pass certs and keys for testing EME over https
    httpsServerOptions: process.env.KARMA_SSL ? {
      key: fs.readFileSync('server.key', 'utf8'), // user must set the path to their SSL key
      cert: fs.readFileSync('server.cert', 'utf8') // user must set the path to their SSL cert
    } : {}
  });
};
