const pkgJson = require('./package.json');
const path = require('path');
const webpack = require('webpack');
const { merge } = require('webpack-merge');
const importHelper = require('@babel/helper-module-imports');

/* Allow to customise builds through env-vars */
const env = process.env;

const addSubtitleSupport = !!env.SUBTITLE || !!env.USE_SUBTITLES;
const addAltAudioSupport = !!env.ALT_AUDIO || !!env.USE_ALT_AUDIO;
const addEMESupport = !!env.EME_DRM || !!env.USE_EME_DRM;
const addCMCDSupport = !!env.CMCD || !!env.USE_CMCD;

const createDefinePlugin = (type) => {
  const buildConstants = {
    __VERSION__: JSON.stringify(pkgJson.version),
    __USE_SUBTITLES__: JSON.stringify(type === 'main' || addSubtitleSupport),
    __USE_ALT_AUDIO__: JSON.stringify(type === 'main' || addAltAudioSupport),
    __USE_EME_DRM__: JSON.stringify(type === 'main' || addEMESupport),
    __USE_CMCD__: JSON.stringify(type === 'main' || addCMCDSupport),
  };
  return new webpack.DefinePlugin(buildConstants);
};

const basePlugins = [
  new webpack.BannerPlugin({
    entryOnly: true,
    raw: true,
    banner: 'typeof window !== "undefined" &&',
  }), // SSR/Node.js guard
];
const mainPlugins = [...basePlugins, createDefinePlugin('main')];
const lightPlugins = [...basePlugins, createDefinePlugin('light')];

const baseConfig = {
  mode: 'development',
  entry: './src/hls',
  optimization: {
    splitChunks: false,
  },
  resolve: {
    // Add `.ts` as a resolvable extension.
    extensions: ['.ts', '.js'],
  },
  module: {
    strictExportPresence: true,
    rules: [
      {
        test: /\.(ts|js)$/,
        exclude: [path.resolve(__dirname, 'node_modules')],
        loader: 'babel-loader',
        options: {
          babelrc: false,
          presets: [
            '@babel/preset-typescript',
            [
              '@babel/preset-env',
              {
                loose: true,
                modules: false,
                targets: {
                  browsers: [
                    'chrome >= 47',
                    'firefox >= 51',
                    'ie >= 11',
                    'safari >= 8',
                    'ios >= 8',
                    'android >= 4',
                  ],
                },
              },
            ],
          ],
          plugins: [
            [
              '@babel/plugin-proposal-class-properties',
              {
                loose: true,
              },
            ],
            '@babel/plugin-proposal-object-rest-spread',
            {
              visitor: {
                CallExpression: function (espath) {
                  if (espath.get('callee').matchesPattern('Number.isFinite')) {
                    espath.node.callee = importHelper.addNamed(
                      espath,
                      'isFiniteNumber',
                      path.resolve('src/polyfills/number')
                    );
                  } else if (
                    espath
                      .get('callee')
                      .matchesPattern('Number.MAX_SAFE_INTEGER')
                  ) {
                    espath.node.callee = importHelper.addNamed(
                      espath,
                      'MAX_SAFE_INTEGER',
                      path.resolve('src/polyfills/number')
                    );
                  }
                },
              },
            },
            ['@babel/plugin-transform-object-assign'],
            ['@babel/plugin-proposal-optional-chaining'],
          ],
        },
      },
    ],
  },
  node: {
    global: false,
    process: false,
    __filename: false,
    __dirname: false,
    Buffer: false,
    setImmediate: false,
  },
};

function getAliasesForLightDist() {
  let aliases = {};

  if (!addEMESupport) {
    aliases = Object.assign({}, aliases, {
      './controller/eme-controller': './empty.js',
    });
  }

  if (!addCMCDSupport) {
    aliases = Object.assign({}, aliases, {
      './controller/cmcd-controller': './empty.js',
    });
  }

  if (!addSubtitleSupport) {
    aliases = Object.assign(aliases, {
      './utils/cues': './empty.js',
      './controller/timeline-controller': './empty.js',
      './controller/subtitle-track-controller': './empty.js',
      './controller/subtitle-stream-controller': './empty.js',
    });
  }

  if (!addAltAudioSupport) {
    aliases = Object.assign(aliases, {
      './controller/audio-track-controller': './empty.js',
      './controller/audio-stream-controller': './empty.js',
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
      globalObject: 'this', // https://github.com/webpack/webpack/issues/6642#issuecomment-370222543
    },
    plugins: mainPlugins,
    devtool: 'source-map',
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
      globalObject: 'this',
    },
    plugins: mainPlugins,
    devtool: 'source-map',
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
      globalObject: 'this',
    },
    resolve: {
      alias: getAliasesForLightDist(),
    },
    plugins: lightPlugins,
    devtool: 'source-map',
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
      globalObject: 'this',
    },
    resolve: {
      alias: getAliasesForLightDist(),
    },
    plugins: lightPlugins,
    devtool: 'source-map',
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
      globalObject: 'this', // https://github.com/webpack/webpack/issues/6642#issuecomment-370222543
    },
    plugins: [
      ...mainPlugins,
      new webpack.DefinePlugin({
        __NETLIFY__: JSON.stringify(
          process.env.NETLIFY === 'true'
            ? {
                branch: process.env.BRANCH,
                commitRef: process.env.COMMIT_REF,
                reviewID:
                  process.env.PULL_REQUEST === 'true'
                    ? parseInt(process.env.REVIEW_ID)
                    : null,
              }
            : {}
        ),
      }),
    ],
    devtool: 'source-map',
  },
].map((config) => {
  const baseClone = merge({}, baseConfig);
  // Strip console.assert statements from production webpack targets
  if (config.mode === 'production') {
    // eslint-disable-next-line no-restricted-properties
    baseClone.module.rules
      .find((rule) => rule.loader === 'babel-loader')
      .options.plugins.push([
        'transform-remove-console',
        {
          exclude: ['log', 'warn', 'error'],
        },
      ]);
  }
  return merge(baseClone, config);
});

// webpack matches the --env arguments to a string; for example, --env.debug.min translates to { debug: true, min: true }
module.exports = (envArgs) => {
  const requestedConfigs = Object.keys(envArgs).filter(
    (key) => !/^WEBPACK_/.test(key)
  );
  let configs;
  if (!requestedConfigs.length) {
    // If no arguments are specified, return every configuration
    configs = multiConfig;
  } else {
    // Filter out enabled configs
    const enabledConfigs = multiConfig.filter((config) =>
      requestedConfigs.includes(config.name)
    );
    if (!enabledConfigs.length) {
      throw new Error(
        `Couldn't find a valid config with the names ${JSON.stringify(
          requestedConfigs
        )}. Known configs are: ${multiConfig
          .map((config) => config.name)
          .join(', ')}`
      );
    }

    configs = enabledConfigs;
  }

  console.log(
    `Building configs: ${configs.map((config) => config.name).join(', ')}.\n`
  );
  return configs;
};
