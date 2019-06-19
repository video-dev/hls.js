const pkgJson = require('./package.json');
const path = require('path');
const webpack = require('webpack');
const merge = require('webpack-merge');
const importHelper = require('@babel/helper-module-imports');

/* Allow to customise builds through env-vars */
const env = process.env;

const plugins = [
  new webpack.optimize.ModuleConcatenationPlugin(),
  new webpack.optimize.OccurrenceOrderPlugin(),
  new webpack.BannerPlugin({ entryOnly: true, raw: true, banner: 'typeof window !== "undefined" &&' }), // SSR/Node.js guard
  new webpack.DefinePlugin({
    __VERSION__: JSON.stringify(pkgJson.version),

    // TODO: Remove this env
    __USE_SUBTITLES__: false
  })
];

const baseConfig = {
  mode: 'development',
  resolve: {
    // Add `.ts` as a resolvable extension.
    extensions: ['.ts', '.js']
  },
  module: {
    strictExportPresence: true,
    rules: [
      {
        test: /\.(ts|js)$/,
        exclude: [
          path.resolve(__dirname, 'node_modules')
        ],
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
      }
    ]
  },
  node: {
    global: false,
    process: false,
    __filename: false,
    __dirname: false,
    Buffer: false,
    setImmediate: false
  }
};

const multiConfig = [
  {
    name: 'debug',
    mode: 'development',
    entry: {
      'hls.core': './src/hls'
    },
    output: {
      filename: '[name].js',
      chunkFilename: '[name].js',
      sourceMapFilename: '[name].js.map',
      path: path.resolve(__dirname, 'dist'),
      publicPath: '/dist/',
      library: 'Hls',
      libraryTarget: 'umd',
      libraryExport: 'default',
      globalObject: 'this' // https://github.com/webpack/webpack/issues/6642#issuecomment-370222543
    },
    optimization: {
      splitChunks: {
        cacheGroups: {
          'hls.core': {
            test: /(hls|node_modules)/,
            chunks: 'initial',
            name: 'hls.core',
            enforce: true
          }
        }
      }
    },
    plugins: plugins,
    devtool: 'source-map'
  },
  {
    name: 'dist',
    mode: 'production',
    entry: {
      'hls.core': './src/hls'
    },
    output: {
      filename: '[name].min.js',
      chunkFilename: '[name].min.js',
      path: path.resolve(__dirname, 'dist'),
      publicPath: '/dist/',
      library: 'Hls',
      libraryTarget: 'umd',
      libraryExport: 'default',
      globalObject: 'this'
    },
    optimization: {
      splitChunks: {
        cacheGroups: {
          'hls.core': {
            test: /(hls|node_modules)/,
            chunks: 'initial',
            name: 'hls.core',
            enforce: true
          }
        }
      }
    },
    plugins: plugins,
    devtool: 'source-map'
  },
  {
    name: 'debug',
    mode: 'development',
    entry: {
      'hls.subtitle-stream': './src/controller/subtitle-stream-controller',
      'hls.subtitle-track': './src/controller/subtitle-track-controller',
      'hls.timeline': './src/controller/timeline-controller',
      'hls.audio-stream': './src/controller/audio-stream-controller',
      'hls.audio-track': './src/controller/audio-track-controller',
      'hls.eme': './src/controller/eme-controller',
    },
    output: {
      filename: '[name].js',
      chunkFilename: '[name].js',
      sourceMapFilename: '[name].js.map',
      path: path.resolve(__dirname, 'dist'),
      publicPath: '/dist/',
      globalObject: 'this' // https://github.com/webpack/webpack/issues/6642#issuecomment-370222543
    },
    plugins: plugins,
    devtool: 'source-map'
  },
  {
    name: 'dist',
    mode: 'production',
    entry: {
      'hls.subtitle-stream': './src/controller/subtitle-stream-controller',
      'hls.subtitle-track': './src/controller/subtitle-track-controller',
      'hls.timeline': './src/controller/timeline-controller',
      'hls.audio-stream': './src/controller/audio-stream-controller',
      'hls.audio-track': './src/controller/audio-track-controller',
      'hls.eme': './src/controller/eme-controller',
    },
    output: {
      filename: '[name].min.js',
      chunkFilename: '[name].min.js',
      path: path.resolve(__dirname, 'dist'),
      publicPath: '/dist/',
      globalObject: 'this'
    },
    plugins: plugins,
    devtool: 'source-map'
  },
  {
    name: 'demo',
    entry: './demo/main',
    mode: 'development',
    output: {
      filename: 'hls-demo.js',
      chunkFilename: '[name].js',
      sourceMapFilename: 'hls-demo.js.map',
      path: path.resolve(__dirname, 'dist'),
      publicPath: '/dist/',
      library: 'HlsDemo',
      libraryTarget: 'umd',
      libraryExport: 'default',
      globalObject: 'this' // https://github.com/webpack/webpack/issues/6642#issuecomment-370222543
    },
    plugins: plugins,
    devtool: 'source-map'
  }
].map(config => merge(baseConfig, config));

// webpack matches the --env arguments to a string; for example, --env.debug.min translates to { debug: true, min: true }
module.exports = (envArgs) => {
  let configs;
  if (!envArgs) {
    // If no arguments are specified, return every configuration
    configs = multiConfig;
  } else {
    // Find the first enabled config within the arguments array
    const enabledConfigName = Object.keys(envArgs).find(envName => envArgs[envName]);
    // Filter out config with name
    const enabledConfig = multiConfig.find(config => config.name === enabledConfigName);
    if (!enabledConfig) {
      throw new Error(`Couldn't find a valid config with the name "${enabledConfigName}". Known configs are: ${multiConfig.map(config => config.name).join(', ')}`);
    }

    configs = [enabledConfig];
  }

  console.log(`Building configs: ${configs.map(config => config.name).join(', ')}.\n`);
  return configs;
};
