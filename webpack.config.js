const pkgJson = require('./package.json');
const path = require('path');
const webpack = require('webpack');

const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

const getGitVersion = require('git-tag-version');
const getGitCommitInfo = require('git-commit-info');

const clone = (...args) => Object.assign({}, ...args);

/* Allow to customise builds through env-vars */
const env = process.env;

const addSubtitleSupport = !!env.SUBTITLE || !!env.USE_SUBTITLES;
const addAltAudioSupport = !!env.ALT_AUDIO || !!env.USE_ALT_AUDIO;
const addEMESupport = !!env.EME_DRM || !!env.USE_EME_DRM;
const runAnalyzer = !!env.ANALYZE;

const baseConfig = {
  mode: 'development',
  entry: './src/hls',
  resolve: {
    // Add `.ts` as a resolvable extension.
    extensions: [".ts", ".js"]
  },
  module: {
    strictExportPresence: true,
    rules: [
      // all files with a `.ts` extension will be handled by `ts-loader`
      { test: /\.ts?$/, loader: "ts-loader" },
      { test: /\.js?$/, exclude: [/node_modules/], loader: "ts-loader" },
    ]
  }
};

const demoConfig = clone(baseConfig, {
  name: 'demo',
  mode: 'development',
  entry: './demo/main',
  output: {
    filename: 'hls-demo.js',
    chunkFilename: '[name].js',
    sourceMapFilename: 'hls-demo.js.map',
    path: path.resolve(__dirname, 'dist'),
    publicPath: '/dist/',
    library: 'HlsDemo',
    libraryTarget: 'umd',
    libraryExport: 'default',
    globalObject: 'this'  // https://github.com/webpack/webpack/issues/6642#issuecomment-370222543
  },
  optimization: {
    minimize: false
  },
  plugins: [],
  devtool: 'source-map'
});

function getPluginsForConfig(type, minify = false) {
  // common plugins.

  const defineConstants = getConstantsForConfig(type);

  // console.log('DefinePlugin constants:', JSON.stringify(defineConstants, null, 2))

  const plugins = [
    new webpack.BannerPlugin({ entryOnly: true, raw: true, banner: 'typeof window !== "undefined" &&' }), // SSR/Node.js guard
    new webpack.optimize.OccurrenceOrderPlugin(),
    new webpack.DefinePlugin(defineConstants),
    new webpack.ProvidePlugin({
      Number: [path.resolve('./src/polyfills/number'), 'Number']
    })
  ];

  if (runAnalyzer && !minify) {
    plugins.push(new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      reportFilename: `bundle-analyzer-report.${type}.html`
    }));
  } else {
    // https://github.com/webpack-contrib/webpack-bundle-analyzer/issues/115
    plugins.push(new webpack.optimize.ModuleConcatenationPlugin());
  }

  return plugins;
}

function getConstantsForConfig (type) {

  const gitCommitInfo = getGitCommitInfo();
  const suffix = gitCommitInfo.shortCommit ? ('-' + gitCommitInfo.shortCommit) : '';

  // By default the "main" dists (hls.js & hls.min.js) are full-featured.
  return {
    __VERSION__: JSON.stringify(pkgJson.version || (getGitVersion() + suffix)),
    __USE_SUBTITLES__: JSON.stringify(type === 'main' || addSubtitleSupport),
    __USE_ALT_AUDIO__: JSON.stringify(type === 'main' || addAltAudioSupport),
    __USE_EME_DRM__: JSON.stringify(type === 'main' || addEMESupport)
  };
}

function getAliasesForLightDist () {
  let aliases = {};

  if (!addEMESupport) {
    aliases = Object.assign({}, aliases, {
      './controller/eme-controller': './empty.js'
    });
  }

  if (!addSubtitleSupport) {
    aliases = clone(aliases, {
      './utils/cues': './empty.js',
      './controller/timeline-controller': './empty.js',
      './controller/subtitle-track-controller': './empty.js',
      './controller/subtitle-stream-controller': './empty.js'
    });
  }

  if (!addAltAudioSupport) {
    aliases = clone(aliases, {
      './controller/audio-track-controller': './empty.js',
      './controller/audio-stream-controller': './empty.js'
    });
  }

  return aliases;
}

const multiConfig = [
  {
    name: 'debug',
    mode: 'development',
    output: {
      filename: 'hls.js',
      chunkFilename: '[name].js',
      sourceMapFilename: 'hls.js.map',
      path: path.resolve(__dirname, 'dist'),
      publicPath: '/dist/',
      library: 'Hls',
      libraryTarget: 'umd',
      libraryExport: 'default',
      globalObject: 'this'
    },
    plugins: getPluginsForConfig('main'),
    devtool: 'source-map'
  },
  {
    name: 'dist',
    mode: 'production',
    output: {
      filename: 'hls.min.js',
      chunkFilename: '[name].js',
      path: path.resolve(__dirname, 'dist'),
      publicPath: '/dist/',
      library: 'Hls',
      libraryTarget: 'umd',
      libraryExport: 'default',
      globalObject: 'this'
    },
    plugins: getPluginsForConfig('main', true),
    optimization: {
      minimize: true
    },
    devtool: 'source-map'
  },
  {
    name: 'light',
    mode: 'development',
    output: {
      filename: 'hls.light.js',
      chunkFilename: '[name].js',
      sourceMapFilename: 'hls.light.js.map',
      path: path.resolve(__dirname, 'dist'),
      publicPath: '/dist/',
      library: 'Hls',
      libraryTarget: 'umd',
      libraryExport: 'default',
      globalObject: 'this'
    },
    resolve: {
      alias: getAliasesForLightDist()
    },
    plugins: getPluginsForConfig('light'),
    devtool: 'source-map'
  },
  {
    name: 'light-dist',
    mode: 'production',
    output: {
      filename: 'hls.light.min.js',
      chunkFilename: '[name].js',
      path: path.resolve(__dirname, 'dist'),
      publicPath: '/dist/',
      library: 'Hls',
      libraryTarget: 'umd',
      libraryExport: 'default',
      globalObject: 'this'
    },
    resolve: {
      alias: getAliasesForLightDist()
    },
    plugins: getPluginsForConfig('light', true),
    optimization: {
      minimize: true
    },
    devtool: 'source-map'
  }
].map(config => clone(baseConfig, config));

multiConfig.push(demoConfig);

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
      console.error(`Couldn't find a valid config with the name "${enabledConfigName}". Known configs are: ${multiConfig.map(config => config.name).join(', ')}`);

      throw new Error('Hls.js webpack config: Invalid environment parameters');
    }

    configs = [enabledConfig, demoConfig];
  }

  console.log(
    `Building configs: ${configs.map(config => config.name).join(', ')}.\n`
  );

  return configs;
};
