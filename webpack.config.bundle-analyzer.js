const clone = require('clone');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const webpackConfigDev = require('./webpack.config.js');

const configs = clone(webpackConfigDev)();

configs.forEach(function(config) {
  if (config.name === 'dist') {
    // filter out ModuleConcatenationPlugin
    // https://github.com/webpack-contrib/webpack-bundle-analyzer/issues/115
    config.plugins = config.plugins.filter(plugin => plugin.constructor.name != 'ModuleConcatenationPlugin');
    
    config.plugins = config.plugins.concat([new BundleAnalyzerPlugin()]);
  }
});

module.exports = configs;
