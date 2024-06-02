const path = require('path');
const importHelper = require('@babel/helper-module-imports');
const { nodeResolve } = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const babel = require('@rollup/plugin-babel');
const alias = require('@rollup/plugin-alias');
const replace = require('@rollup/plugin-replace');
const terser = require('@rollup/plugin-terser');
const istanbul = require('rollup-plugin-istanbul');
const fs = require('fs');

const pkgJson = JSON.parse(
  fs.readFileSync('./package.json', { encoding: 'utf-8' }),
);

const BUILD_TYPE = {
  full: 'full',
  light: 'light',
};

const FORMAT = {
  umd: 'umd',
  esm: 'esm',
  iife: 'iife',
};

const buildTypeToOutputName = {
  full: `hls`,
  light: `hls.light`,
};

/* Allow to customize builds through env-vars */
// eslint-disable-next-line no-undef
const env = process.env;

const addSubtitleSupport = !!env.SUBTITLE || !!env.USE_SUBTITLES;
const addAltAudioSupport = !!env.ALT_AUDIO || !!env.USE_ALT_AUDIO;
const addEMESupport = !!env.EME_DRM || !!env.USE_EME_DRM;
const addCMCDSupport = !!env.CMCD || !!env.USE_CMCD;
const addContentSteeringSupport =
  !!env.CONTENT_STEERING || !!env.USE_CONTENT_STEERING;
const addVariableSubstitutionSupport =
  !!env.VARIABLE_SUBSTITUTION || !!env.USE_VARIABLE_SUBSTITUTION;
const addM2TSAdvancedCodecSupport =
  !!env.M2TS_ADVANCED_CODECS || !!env.USE_M2TS_ADVANCED_CODECS;
const addMediaCapabilitiesSupport =
  !!env.MEDIA_CAPABILITIES || !!env.USE_MEDIA_CAPABILITIES;

const shouldBundleWorker = (format) => format !== FORMAT.esm;

const buildConstants = (type, additional = {}) => ({
  preventAssignment: true,
  values: {
    __VERSION__: JSON.stringify(pkgJson.version),
    __USE_SUBTITLES__: JSON.stringify(
      type === BUILD_TYPE.full || addSubtitleSupport,
    ),
    __USE_ALT_AUDIO__: JSON.stringify(
      type === BUILD_TYPE.full || addAltAudioSupport,
    ),
    __USE_EME_DRM__: JSON.stringify(type === BUILD_TYPE.full || addEMESupport),
    __USE_CMCD__: JSON.stringify(type === BUILD_TYPE.full || addCMCDSupport),
    __USE_CONTENT_STEERING__: JSON.stringify(
      type === BUILD_TYPE.full || BUILD_TYPE.light || addContentSteeringSupport,
    ),
    __USE_VARIABLE_SUBSTITUTION__: JSON.stringify(
      type === BUILD_TYPE.full || addVariableSubstitutionSupport,
    ),
    __USE_M2TS_ADVANCED_CODECS__: JSON.stringify(
      type === BUILD_TYPE.full || addM2TSAdvancedCodecSupport,
    ),
    __USE_MEDIA_CAPABILITIES__: JSON.stringify(
      type === BUILD_TYPE.full || addMediaCapabilitiesSupport,
    ),

    ...additional,
  },
});

const buildOnLog = ({ allowCircularDeps } = {}) => {
  return (level, log, handler) => {
    if (allowCircularDeps && log.code === 'CIRCULAR_DEPENDENCY') return;

    if (level === 'warn') {
      // treat warnings as errors
      handler('error', log);
    } else {
      handler(level, log);
    }
  };
};

const workerFnBanner = '(function __HLS_WORKER_BUNDLE__(__IN_WORKER__){';
const workerFnFooter = '})(false);';

const extensions = ['.ts', '.js'];

const babelPresetEnvTargets = {
  chrome: '47',
  firefox: '51',
  safari: '8',
  ios: '8',
  android: '4',
  samsung: '5',
  edge: '14',
};

const babelTsWithPresetEnvTargets = ({ targets, stripConsole }) =>
  babel({
    extensions,
    babelHelpers: 'bundled',
    exclude: /node_modules\/(?!(@svta)\/).*/,
    assumptions: {
      noDocumentAll: true,
      noClassCalls: true,
    },
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
          targets,
          bugfixes: true,
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
                path.resolve('src/polyfills/number'),
              );
            } else if (
              espath.get('callee').matchesPattern('Number.isSafeInteger')
            ) {
              espath.node.callee = importHelper.addNamed(
                espath,
                'isSafeInteger',
                path.resolve('src/polyfills/number'),
              );
            } else if (
              espath.get('callee').matchesPattern('Number.MAX_SAFE_INTEGER')
            ) {
              espath.node.callee = importHelper.addNamed(
                espath,
                'MAX_SAFE_INTEGER',
                path.resolve('src/polyfills/number'),
              );
            }
          },
        },
      },
      ['@babel/plugin-transform-object-assign'],
      ['@babel/plugin-proposal-optional-chaining'],

      ...(stripConsole
        ? [
            [
              // Strip console.assert statements from build targets
              'transform-remove-console',
              {
                exclude: ['log', 'warn', 'error'],
              },
            ],
          ]
        : []),
    ],
  });

const buildBabelLegacyBrowsers = ({ stripConsole }) =>
  babelTsWithPresetEnvTargets({
    targets: babelPresetEnvTargets,
    stripConsole,
  });

const buildBabelEsm = ({ stripConsole }) =>
  babelTsWithPresetEnvTargets({ targets: { esmodules: true }, stripConsole });

const basePlugins = [
  nodeResolve({
    extensions,
    browser: true,
    preferBuiltins: false,
  }),
  commonjs({ transformMixedEsModules: true }),
];

function getAliasesForLightDist(format) {
  const emptyFile = format === 'esm' ? 'empty-es.js' : 'empty.js';

  let aliases = {};

  if (!addEMESupport) {
    aliases = {
      ...aliases,
      './controller/eme-controller': `./${emptyFile}`,
      './utils/mediakeys-helper': `./${emptyFile}`,
      '../utils/mediakeys-helper': `../${emptyFile}`,
    };
  }

  if (!addCMCDSupport) {
    aliases = { ...aliases, './controller/cmcd-controller': `./${emptyFile}` };
  }

  if (!addSubtitleSupport) {
    aliases = {
      ...aliases,
      './utils/cues': `./${emptyFile}`,
      './controller/timeline-controller': `./${emptyFile}`,
      './controller/subtitle-track-controller': `./${emptyFile}`,
      './controller/subtitle-stream-controller': `./${emptyFile}`,
    };
  }

  if (!addAltAudioSupport) {
    aliases = {
      ...aliases,
      './controller/audio-track-controller': `./${emptyFile}`,
      './controller/audio-stream-controller': `./${emptyFile}`,
    };
  }

  if (!addVariableSubstitutionSupport) {
    aliases = {
      ...aliases,
      './utils/variable-substitution': `./${emptyFile}`,
      '../utils/variable-substitution': `../${emptyFile}`,
    };
  }

  if (!addM2TSAdvancedCodecSupport) {
    aliases = {
      ...aliases,
      './ac3-demuxer': `../${emptyFile}`,
      './video/hevc-video-parser': `../${emptyFile}`,
    };
  }

  if (!addMediaCapabilitiesSupport) {
    aliases = {
      ...aliases,
      '../utils/mediacapabilities-helper': `../${emptyFile}`,
    };
  }

  return aliases;
}

const buildRollupConfig = ({
  type,
  minified,
  format,
  allowCircularDeps,
  includeCoverage,
  sourcemap = true,
  outputFile = null,
  input = './src/exports-default.ts',
}) => {
  const outputName = buildTypeToOutputName[type];
  const extension = format === FORMAT.esm ? 'mjs' : 'js';

  return {
    input,
    onLog: buildOnLog({ allowCircularDeps }),
    output: {
      name: 'Hls',
      file: outputFile
        ? outputFile
        : minified
          ? `./dist/${outputName}.min.${extension}`
          : `./dist/${outputName}.${extension}`,
      format,
      banner: shouldBundleWorker(format) ? workerFnBanner : null,
      footer: shouldBundleWorker(format) ? workerFnFooter : null,
      sourcemap,
      sourcemapFile: minified
        ? `${outputName}.${extension}.min.map`
        : `${outputName}.${extension}.map`,
    },
    plugins: [
      ...basePlugins,
      replace(buildConstants(type)),
      ...(!shouldBundleWorker(format)
        ? [alias({ entries: { './transmuxer-worker': '../empty.js' } })]
        : []),
      ...(type === BUILD_TYPE.light
        ? [alias({ entries: getAliasesForLightDist(format) })]
        : []),
      ...(format === 'esm'
        ? [buildBabelEsm({ stripConsole: true })]
        : [buildBabelLegacyBrowsers({ stripConsole: true })]),
      ...(minified ? [terser()] : []),
      ...(includeCoverage
        ? [istanbul({ exclude: ['tests/**/*', 'node_modules/**/*'] })]
        : []),
    ],
  };
};

const configs = Object.entries({
  full: buildRollupConfig({
    type: BUILD_TYPE.full,
    format: FORMAT.umd,
    minified: false,
  }),
  fullMin: buildRollupConfig({
    type: BUILD_TYPE.full,
    format: FORMAT.umd,
    minified: true,
  }),
  fullEsm: buildRollupConfig({
    input: './src/exports-named.ts',
    type: BUILD_TYPE.full,
    format: FORMAT.esm,
    minified: false,
  }),
  light: buildRollupConfig({
    type: BUILD_TYPE.light,
    format: FORMAT.umd,
    minified: false,
  }),
  lightMin: buildRollupConfig({
    type: BUILD_TYPE.light,
    format: FORMAT.umd,
    minified: true,
  }),
  lightEsm: buildRollupConfig({
    input: './src/exports-named.ts',
    type: BUILD_TYPE.light,
    format: FORMAT.esm,
    minified: false,
  }),
  worker: {
    input: './src/demux/transmuxer-worker.ts',
    onLog: buildOnLog(),
    output: {
      name: 'HlsWorker',
      file: './dist/hls.worker.js',
      format: FORMAT.iife,
      sourcemap: true,
      sourcemapFile: 'hls.worker.js.map',
    },
    plugins: [
      ...basePlugins,
      replace(
        buildConstants(BUILD_TYPE.full, {
          __IN_WORKER__: JSON.stringify(true),
        }),
      ),
      buildBabelLegacyBrowsers({ stripConsole: true }),
      terser(),
    ],
  },
  demo: {
    input: './demo/main.js',
    onLog: buildOnLog(),
    output: {
      name: 'HlsDemo',
      file: './dist/hls-demo.js',
      format: FORMAT.umd,
      sourcemap: true,
      sourcemapFile: 'hls-demo.js.map',
    },
    watch: {
      clearScreen: false,
    },
    plugins: [
      ...basePlugins,
      replace({
        preventAssignment: true,
        values: {
          __CLOUDFLARE_PAGES__: JSON.stringify(
            env.CF_PAGES
              ? {
                  branch: env.CF_PAGES_BRANCH,
                  commitRef: env.CF_PAGES_COMMIT_SHA,
                }
              : null,
          ),
        },
      }),
      buildBabelLegacyBrowsers({ stripConsole: false }),
    ],
  },
});

module.exports = {
  BUILD_TYPE,
  FORMAT,
  configs,
  buildRollupConfig,
};
