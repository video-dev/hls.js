var pkgJson = require('./package.json')
var path = require('path')
var webpack = require('webpack')

var buildVersion = process.env.BUILD_VERSION || 'full'

var config = {
  entry: './src/index.js',
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: [
          path.resolve(__dirname, 'node_modules')
        ],
        use: {
          loader: 'babel-loader'
        }
      }
    ]
  }
};

const multiConfig = [
  {
    name: 'debug',
    output: {
      filename: 'hls.js',
      chunkFilename: '[name].js',
      sourceMapFilename: 'hls.js.map',
      path: path.resolve(__dirname, 'dist'),
      publicPath: '/hls.js/dist/',
      library: 'Hls',
      libraryTarget: 'umd'
    },
    plugins: [
      new webpack.optimize.OccurrenceOrderPlugin(),
      new webpack.optimize.ModuleConcatenationPlugin(),
      new webpack.DefinePlugin(buildConstants)
    ],
    devtool: 'source-map',
  },
  {
    name: 'dist',
    output: {
      filename: 'hls.min.js',
      chunkFilename: '[name].js',
      path: path.resolve(__dirname, 'dist'),
      publicPath: '/hls.js/dist/',
      library: 'Hls',
      libraryTarget: 'umd'
    },
    plugins: [
      new webpack.optimize.OccurrenceOrderPlugin(),
      new webpack.optimize.ModuleConcatenationPlugin(),
      new webpack.DefinePlugin(buildConstants),
      new webpack.optimize.UglifyJsPlugin(uglifyJsOptions)
    ],
  },
  {
    name: 'light',
    output: {
      filename: 'hls.light.js',
      chunkFilename: '[name].js',
      sourceMapFilename: 'hls.light.js.map',
      path: path.resolve(__dirname, 'dist'),
      publicPath: '/hls.js/dist/',
      library: 'Hls',
      libraryTarget: 'umd'
    },
    resolve: {
      alias: {
        './controller/audio-track-controller': '',
        './controller/audio-stream-controller': '',
        './utils/cues': '',
        './controller/timeline-controller': '',
        './controller/subtitle-track-controller': '',
        './controller/subtitle-stream-controller': ''
      }
    },
    plugins: [
      new webpack.optimize.OccurrenceOrderPlugin(),
      new webpack.DefinePlugin(buildConstants),
      new webpack.optimize.ModuleConcatenationPlugin()
    ],
    devtool: 'source-map'
  },
  {
    name: 'light-dist',
    output: {
      filename: 'hls.light.min.js',
      chunkFilename: '[name].js',
      path: path.resolve(__dirname, 'dist'),
      publicPath: '/hls.js/dist/',
      library: 'Hls',
      libraryTarget: 'umd'
    },
    resolve: {
      alias: {
        './controller/audio-track-controller': '',
        './controller/audio-stream-controller': '',
        './utils/cues': '',
        './controller/timeline-controller': '',
        './controller/subtitle-track-controller': '',
        './controller/subtitle-stream-controller': ''
      }
    },
    plugins: [
      new webpack.optimize.OccurrenceOrderPlugin(),
      new webpack.DefinePlugin(buildConstants),
      new webpack.optimize.ModuleConcatenationPlugin(),
      new webpack.optimize.UglifyJsPlugin(uglifyJsOptions)
    ]
  }
].map(fragment => Object.assign({}, commonConfig, fragment));

// webpack matches the --env arguments to a string; for example, --env.debug.min translates to { debug: true, min: true }
module.exports = (envArgs) => {
  if (!envArgs) {
    // If no arguments are specified, return every configuration
    return multiConfig;
  }

  // Find the first enabled config within the arguments array
  const enabledConfigName = Object.keys(envArgs).find(envName => envArgs[envName]);
  let enabledConfig = multiConfig.find(config => config.name === enabledConfigName);

  if (!enabledConfig) {
    console.error(`Couldn't find a valid config with the name "${enabledConfigName}". Known configs are: ${multiConfig.map(config => config.name).join(', ')}`);
    return;
  }

  return enabledConfig;
};
