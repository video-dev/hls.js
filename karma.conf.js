// Karma configuration
// Generated on Tue Jul 18 2017 12:17:16 GMT-0700 (PDT)

const pkgJson = require('./package.json');
const webpack = require('webpack');
const path = require('path');
const importHelper = require('@babel/helper-module-imports');

module.exports = function (config) {
  config.set({
    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',

    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['mocha', 'sinon-chai'],

    // list of files / patterns to load in the browser
    files: [
      'tests/index.js'
    ],

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

    webpack: {
      mode: 'development',
      devtool: 'inline-source-map',
      resolve: {
        extensions: ['.ts', '.js']
      },
      module: {
        rules: [
          {
            test: /\.(ts|js)$/,
            include: path.resolve(__dirname, 'src'),
            exclude: path.resolve(__dirname, 'node_modules'),
            loader: 'babel-loader',
            options: {
              babelrc: false,
              presets: [
                '@babel/preset-typescript',
                ['@babel/preset-env', {
                  loose: true,
                  modules: false,
                  targets: {
                    browsers: [
                      'chrome >= 47',
                      'firefox >= 51',
                      'ie >= 11',
                      'safari >= 8',
                      'ios >= 8',
                      'android >= 4'
                    ]
                  }
                }]
              ],
              plugins: [
                ['@babel/plugin-proposal-class-properties', {
                  loose: true
                }],
                '@babel/plugin-proposal-object-rest-spread',
                {
                  visitor: {
                    CallExpression: function (espath) {
                      if (espath.get('callee').matchesPattern('Number.isFinite')) {
                        espath.node.callee = importHelper.addNamed(espath, 'isFiniteNumber', path.resolve('src/polyfills/number-isFinite'));
                      }
                    }
                  }
                }
              ]
            }
          }, // instrument only testing sources with Istanbul
          {
            test: /\.(ts|js)$/,
            exclude: path.resolve(__dirname, 'node_modules'),
            enforce: 'post',
            use: [
              {
                loader: 'istanbul-instrumenter-loader',
                options: { esModules: true }
              }
            ]
          }
        ]
      },
      plugins: [
        new webpack.DefinePlugin({
          __VERSION__: JSON.stringify(pkgJson.version),
          __USE_SUBTITLES__: JSON.stringify(true),
          __USE_ALT_AUDIO__: JSON.stringify(true),
          __USE_EME_DRM__: JSON.stringify(true)
        })
      ]
    },

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
    concurrency: Infinity
  });
};
