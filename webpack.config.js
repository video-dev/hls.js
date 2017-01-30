var pkgJson = require('./package.json')
var path = require('path')
var webpack = require('webpack')

var env = process.env.NODE_ENV

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
        presets: ['es2015']
      }
    }]
  },
  plugins: [
    new webpack.optimize.OccurrenceOrderPlugin(),
    new webpack.DefinePlugin({
      __VERSION__: JSON.stringify(pkgJson.version)
    })
  ]
}

if (env === 'production') {
  config.plugins.push(
    new webpack.optimize.UglifyJsPlugin({
      compressor: {
        sequences: true,
        dead_code: true,
        conditionals: true,
        booleans: true,
        unused: true,
        if_return: true,
        join_vars: true,
        drop_console: true
      },
      mangle: {
        screw_ie8: true
      },
      output: {
        screw_ie8: true
      }
    })
  )
}

module.exports = config
