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
const DISABLED_ENV_VALUES = ['', '0', 'false', 'off', 'no'];

function parseEnvToggle(value) {
  if (value === undefined) return undefined;
  const normalized = String(value).trim().toLowerCase();
  // Preserve prior behavior where any non-empty, non-false-like value enables a feature.
  return !DISABLED_ENV_VALUES.includes(normalized);
}

function readFeatureFlag(name, ...aliases) {
  const envName = [`USE_${name}`, name, ...aliases].find(
    (candidate) => env[candidate] !== undefined,
  );

  return envName ? parseEnvToggle(env[envName]) : undefined;
}

function isFeatureEnabled(type, explicit, enableInLight = false) {
  return explicit ?? (type === BUILD_TYPE.full || enableInLight);
}

const flags = {
  subtitles: readFeatureFlag('SUBTITLES', 'SUBTITLE'),
  altAudio: readFeatureFlag('ALT_AUDIO'),
  emeDrm: readFeatureFlag('EME_DRM'),
  cmcd: readFeatureFlag('CMCD'),
  contentSteering: readFeatureFlag('CONTENT_STEERING'),
  variableSubstitution: readFeatureFlag('VARIABLE_SUBSTITUTION'),
  m2tsAdvancedCodecs: readFeatureFlag('M2TS_ADVANCED_CODECS'),
  mediaCapabilities: readFeatureFlag('MEDIA_CAPABILITIES'),
  interstitials: readFeatureFlag(
    'INTERSTITIALS',
    // Backward-compatible support for legacy misspelled env vars
    'USE_INTERSTITALS',
    'INTERSTITALS',
  ),
};

function getFeatureSupport(type) {
  return {
    subtitles: isFeatureEnabled(type, flags.subtitles),
    altAudio: isFeatureEnabled(type, flags.altAudio),
    emeDrm: isFeatureEnabled(type, flags.emeDrm),
    cmcd: isFeatureEnabled(type, flags.cmcd),
    contentSteering: isFeatureEnabled(type, flags.contentSteering, true),
    variableSubstitution: isFeatureEnabled(type, flags.variableSubstitution),
    m2tsAdvancedCodecs: isFeatureEnabled(type, flags.m2tsAdvancedCodecs),
    mediaCapabilities: isFeatureEnabled(type, flags.mediaCapabilities),
    interstitials: isFeatureEnabled(type, flags.interstitials),
  };
}

const shouldBundleWorker = (format) => format !== FORMAT.esm;

const buildConstants = (
  type,
  additional = {},
  features = getFeatureSupport(type),
) => ({
  preventAssignment: true,
  values: {
    __VERSION__: JSON.stringify(pkgJson.version),
    __USE_SUBTITLES__: JSON.stringify(features.subtitles),
    __USE_ALT_AUDIO__: JSON.stringify(features.altAudio),
    __USE_EME_DRM__: JSON.stringify(features.emeDrm),
    __USE_CMCD__: JSON.stringify(features.cmcd),
    __USE_CONTENT_STEERING__: JSON.stringify(features.contentSteering),
    __USE_VARIABLE_SUBSTITUTION__: JSON.stringify(
      features.variableSubstitution,
    ),
    __USE_M2TS_ADVANCED_CODECS__: JSON.stringify(features.m2tsAdvancedCodecs),
    __USE_MEDIA_CAPABILITIES__: JSON.stringify(features.mediaCapabilities),
    __USE_INTERSTITIALS__: JSON.stringify(features.interstitials),

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
        '@babel/plugin-transform-class-properties',
        {
          loose: true,
        },
      ],
      '@babel/plugin-transform-object-rest-spread',
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
      ['@babel/plugin-transform-optional-chaining'],

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

function getAliasesForDist(format, features) {
  const emptyFile = format === 'esm' ? 'empty-es.js' : 'empty.js';

  let aliases = {};

  if (!features.emeDrm) {
    aliases = {
      ...aliases,
      './controller/eme-controller': `./${emptyFile}`,
      './utils/mediakeys-helper': `./${emptyFile}`,
      '../utils/mediakeys-helper': `../${emptyFile}`,
    };
  }

  if (!features.cmcd) {
    aliases = { ...aliases, './controller/cmcd-controller': `./${emptyFile}` };
  }

  if (!features.subtitles) {
    aliases = {
      ...aliases,
      './utils/cues': `./${emptyFile}`,
      './controller/timeline-controller': `./${emptyFile}`,
      './controller/subtitle-track-controller': `./${emptyFile}`,
      './controller/subtitle-stream-controller': `./${emptyFile}`,
    };
  }

  if (!features.altAudio) {
    aliases = {
      ...aliases,
      './controller/audio-track-controller': `./${emptyFile}`,
      './controller/audio-stream-controller': `./${emptyFile}`,
    };
  }

  if (!features.variableSubstitution) {
    aliases = {
      ...aliases,
      './utils/variable-substitution': `./${emptyFile}`,
      '../utils/variable-substitution': `../${emptyFile}`,
    };
  }

  if (!features.m2tsAdvancedCodecs) {
    aliases = {
      ...aliases,
      './ac3-demuxer': `../${emptyFile}`,
      './video/hevc-video-parser': `../${emptyFile}`,
    };
  }

  if (!features.mediaCapabilities) {
    aliases = {
      ...aliases,
      './utils/mediacapabilities-helper': `./${emptyFile}`,
      '../utils/mediacapabilities-helper': `../${emptyFile}`,
    };
  }

  if (!features.contentSteering) {
    aliases = {
      ...aliases,
      './controller/content-steering-controller': `./${emptyFile}`,
      '../controller/content-steering-controller': `../${emptyFile}`,
    };
  }

  if (!features.interstitials) {
    aliases = {
      ...aliases,
      './controller/interstitials-controller': `./${emptyFile}`,
      './controller/interstitial-player': `./${emptyFile}`,
      './controller/interstitials-schedule': `./${emptyFile}`,
      './interstitial-player': `./${emptyFile}`,
      './interstitials-schedule': `./${emptyFile}`,
      './interstitial-event': `./${emptyFile}`,
      '../controller/interstitial-player': `../${emptyFile}`,
      '../controller/interstitials-schedule': `../${emptyFile}`,
      '../loader/interstitial-event': `../${emptyFile}`,
      '../loader/interstitial-asset-list': `../${emptyFile}`,
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
  const featureSupport = getFeatureSupport(type);
  const distAliases = getAliasesForDist(format, featureSupport);

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
      replace(buildConstants(type, {}, featureSupport)),
      ...(!shouldBundleWorker(format)
        ? [alias({ entries: { './transmuxer-worker': '../empty.js' } })]
        : []),
      ...(Object.keys(distAliases).length
        ? [alias({ entries: distAliases })]
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
