var pkgJson = require('./package.json')
var path = require('path')
var webpack = require('webpack')

var env = process.env.NODE_ENV
var buildVersion = process.env.BUILD_VERSION || 'full'

var config = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    publicPath: '/hls.js/dist/',
    library: 'Hls',
    libraryTarget: 'umd'
  },
  devServer: {
    compress: true,
    contentBase: path.resolve(__dirname, 'demo')
  },
  module: {
    rules: [{
      test: /\.js$/,
      exclude: [
        path.resolve(__dirname, 'node_modules')
      ],
      loader: 'babel-loader',
      options: {
        'presets': [
          ['env', {
            'modules': false,
            'loose': true
          }]
        ]
      }
    }]
  },
  plugins: [
    new webpack.optimize.OccurrenceOrderPlugin(),
    new webpack.DefinePlugin({
      __VERSION__: JSON.stringify(pkgJson.version),
      __BUILD_VERSION__: JSON.stringify(buildVersion)
    })
  ]
}

if (buildVersion === 'light') {
  config.resolve = {
    alias: {
      './controller/audio-track-controller': '',
      './controller/audio-stream-controller': '',
      './utils/cues': '',
      './controller/timeline-controller': '',
      './controller/subtitle-track-controller': '',
      './controller/subtitle-stream-controller': ''
    }
  };
}

module.exports = config
