const path = require('path');

/* eslint-env node */
/* eslint no-process-env: 0 */

module.exports = {
  name: 'index',
  entry: {
    index: './src/index',
  },
  devtool: 'cheap-module-source-map',
  mode: 'development',
  node: false,
  optimization: {
    splitChunks: false,
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.(?:ts|js)$/,
        exclude: /\/node_modules\//,
        use: {
          loader: 'babel-loader',
          options: {
            babelrc: false,
            presets: [
              ['@babel/preset-env', { loose: true, modules: false }],
              [
                '@babel/preset-typescript',
                {
                  onlyRemoveTypeImports: true,
                },
              ],
            ],
          },
        },
      },
    ],
  },
};
