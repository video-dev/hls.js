/* global process:false */
import pkgJson from './package.json' assert { type: 'json' };
import path from 'path';
import merge from 'deepmerge';
import importHelper from '@babel/helper-module-imports';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import alias from '@rollup/plugin-alias';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';

/* Allow to customise builds through env-vars */
const env = process.env;

const addSubtitleSupport = !!env.SUBTITLE || !!env.USE_SUBTITLES;
const addAltAudioSupport = !!env.ALT_AUDIO || !!env.USE_ALT_AUDIO;
const addEMESupport = !!env.EME_DRM || !!env.USE_EME_DRM;
const addCMCDSupport = !!env.CMCD || !!env.USE_CMCD;
const addContentSteeringSupport =
  !!env.CONTENT_STEERING || !!env.USE_CONTENT_STEERING;
const addVariableSubstitutionSupport =
  !!env.VARIABLE_SUBSTITUTION || !!env.USE_VARIABLE_SUBSTITUTION;

const buildConstants = (type, format) => ({
  preventAssignment: true,
  values: {
    __VERSION__: JSON.stringify(pkgJson.version),
    __USE_SUBTITLES__: JSON.stringify(type === 'main' || addSubtitleSupport),
    __USE_ALT_AUDIO__: JSON.stringify(type === 'main' || addAltAudioSupport),
    __USE_EME_DRM__: JSON.stringify(type === 'main' || addEMESupport),
    __USE_CMCD__: JSON.stringify(type === 'main' || addCMCDSupport),
    __USE_CONTENT_STEERING__: JSON.stringify(
      type === 'main' || addContentSteeringSupport
    ),
    __USE_VARIABLE_SUBSTITUTION__: JSON.stringify(
      type === 'main' || addVariableSubstitutionSupport
    ),
    __HLS_UMD_WORKER__: JSON.stringify(format === 'umd'),
  },
});

const umdBanner = '(function __HLS_UMD_BUNDLE__(__IN_WORKER__){';
const umdFooter = '})(false);';

const extensions = ['.ts', '.js'];

const basePlugins = [
  nodeResolve({
    extensions,
  }),
  commonjs(),
];

const babelTsWithPresetEnvTargets = (targets, plugins = []) =>
  babel({
    extensions,
    babelHelpers: 'bundled',
    exclude: 'node_modules/**',
    presets: [
      [
        '@babel/preset-typescript',
        {
          optimizeConstEnums: true,
        },
      ],
      [
        '@babel/preset-env',
        {
          loose: true,
          modules: false,
          targets,
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
              espath.get('callee').matchesPattern('Number.MAX_SAFE_INTEGER')
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
      ...plugins,
    ],
  });

const babelPresetEnvLegacyBrowserList = {
  browsers: [
    'chrome >= 47',
    'firefox >= 51',
    'safari >= 8',
    'ios >= 8',
    'android >= 4',
  ],
};

const babelLegacyBrowsers = babelTsWithPresetEnvTargets(
  babelPresetEnvLegacyBrowserList
);

const babelEsm = babelTsWithPresetEnvTargets({ esmodules: true });

function getAliasesForLightDist() {
  let aliases = {};

  if (!addEMESupport) {
    aliases = Object.assign({}, aliases, {
      './controller/eme-controller': './empty.js',
      './utils/mediakeys-helper': './empty.js',
      '../utils/mediakeys-helper': '../empty.js',
    });
  }

  if (!addCMCDSupport) {
    aliases = Object.assign({}, aliases, {
      './controller/cmcd-controller': './empty.js',
    });
  }

  if (!addSubtitleSupport) {
    aliases = Object.assign({}, aliases, {
      './utils/cues': './empty.js',
      './controller/timeline-controller': './empty.js',
      './controller/subtitle-track-controller': './empty.js',
      './controller/subtitle-stream-controller': './empty.js',
    });
  }

  if (!addAltAudioSupport) {
    aliases = Object.assign({}, aliases, {
      './controller/audio-track-controller': './empty.js',
      './controller/audio-stream-controller': './empty.js',
    });
  }

  if (!addVariableSubstitutionSupport) {
    aliases = Object.assign({}, aliases, {
      './utils/variable-substitution': './empty.js',
      '../utils/variable-substitution': '../empty.js',
    });
  }

  return aliases;
}

const multiConfigEntries = Object.entries({
  debug: {
    input: './src/hls.ts',
    output: {
      name: 'Hls',
      file: './dist/hls.js',
      format: 'umd',
      banner: umdBanner,
      footer: umdFooter,
      sourcemap: true,
      sourcemapFile: 'hls.js.map',
    },
    plugins: [
      ...basePlugins,
      replace(buildConstants('main', 'umd')),
      babelLegacyBrowsers,
    ],
  },
  esm: {
    input: './src/hls.ts',
    output: {
      name: 'Hls',
      file: './dist/hls.mjs',
      format: 'es',
      sourcemap: true,
      sourcemapFile: 'hls.mjs.map',
    },
    plugins: [...basePlugins, replace(buildConstants('main', 'es')), babelEsm],
  },
  dist: {
    input: './src/hls.ts',
    output: {
      name: 'Hls',
      file: './dist/hls.min.js',
      format: 'umd',
      banner: umdBanner,
      footer: umdFooter,
      sourcemap: true,
      sourcemapFile: './dist/hls.min.js.map',
    },
    plugins: [
      ...basePlugins,
      replace(buildConstants('main', 'umd')),
      babelLegacyBrowsers,
      terser(),
    ],
  },
  light: {
    input: './src/hls.ts',
    output: {
      name: 'Hls',
      file: './dist/hls.light.js',
      format: 'umd',
      banner: umdBanner,
      footer: umdFooter,
      sourcemap: true,
      sourcemapFile: 'hls.light.js.map',
    },
    plugins: [
      ...basePlugins,
      replace(buildConstants('light', 'umd')),
      babelLegacyBrowsers,
      alias({ entries: getAliasesForLightDist() }),
    ],
  },
  'light-dist': {
    input: './src/hls.ts',
    output: {
      name: 'Hls',
      file: './dist/hls.light.min.js',
      format: 'umd',
      banner: umdBanner,
      footer: umdFooter,
      sourcemap: true,
      sourcemapFile: 'hls.light.min.js.map',
    },
    plugins: [
      ...basePlugins,
      replace(buildConstants('light', 'umd')),
      babelLegacyBrowsers,
      alias({ entries: getAliasesForLightDist() }),
      terser(),
    ],
  },
  demo: {
    input: './demo/main.js',
    output: {
      name: 'HlsDemo',
      file: './dist/hls-demo.js',
      format: 'umd',
      sourcemap: true,
      sourcemapFile: 'hls-demo.js.map',
    },
    plugins: [
      nodeResolve({
        extensions,
      }),
      commonjs({
        transformMixedEsModules: true,
      }),
      replace({
        preventAssignment: true,
        values: {
          __CLOUDFLARE_PAGES__: JSON.stringify(
            env.CF_PAGES
              ? {
                  branch: env.CF_PAGES_BRANCH,
                  commitRef: env.CF_PAGES_COMMIT_SHA,
                }
              : null
          ),
        },
      }),
      babelLegacyBrowsers,
    ],
  },
});

const stripConsoleFromProd = (config) => {
  // Strip console.assert statements from build targets
  if (config.output.file.includes('.min.') || env.NETLIFY === 'true') {
    const clone = merge({}, config);
    // eslint-disable-next-line no-restricted-properties
    const babelPluginIndex = clone.plugins.findIndex(
      (plugin) => plugin.name === 'babel'
    );
    if (babelPluginIndex !== -1) {
      clone.plugins.splice(
        babelPluginIndex,
        1,
        babelTsWithPresetEnvTargets(babelPresetEnvLegacyBrowserList, [
          [
            'transform-remove-console',
            {
              exclude: ['log', 'warn', 'error'],
            },
          ],
        ])
      );
    } else {
      throw new Error(
        `Couldn't find babel plugin in config ${JSON.stringify(config)}`
      );
    }

    return clone;
  }
  return config;
};

export default (envArgs) => {
  const requestedConfigs = Object.keys(envArgs.env ?? {});
  let configEntries;
  if (!requestedConfigs.length) {
    // If no arguments are specified, return every configuration
    configEntries = multiConfigEntries;
  } else {
    // Filter out enabled configs
    const enabledEntries = multiConfigEntries.filter(([name]) =>
      requestedConfigs.includes(name)
    );
    if (!enabledEntries.length) {
      throw new Error(
        `Couldn't find a valid config with the names ${JSON.stringify(
          requestedConfigs
        )}. Known configs are: ${multiConfigEntries
          .map(([name]) => name)
          .join(', ')}`
      );
    }
    configEntries = enabledEntries;
  }

  console.log(
    `Building configs: ${configEntries.map(([name]) => name).join(', ')}.\n`
  );
  return configEntries.map(([name, config]) => stripConsoleFromProd(config));
};
