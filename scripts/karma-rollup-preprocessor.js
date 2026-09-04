/* eslint-env node */
'use strict';

/**
 * Karma's `rollup` preprocessor: bundles a test entry point through Rollup and
 * hands the result to Karma, keeping Karma's file watcher in step with Rollup's
 * module graph so a change to any imported module reruns the suite.
 *
 * Configure through `rollupPreprocessor` in karma.conf.js. Register it in
 * `plugins`, since Karma only auto-loads plugins published as `karma-*`
 * packages.
 *
 * Vendored from karma-rollup-preprocessor at 7a7268d, MIT licensed,
 * Copyright (c) 2021 karma-rollup-preprocessor contributors.
 *
 * It is vendored rather than depended on because the only release that fixes
 * the watch-mode memory leak (jlmakes/karma-rollup-preprocessor#78) was never
 * published to npm, leaving a git reference as the sole way to obtain it. npm
 * 12 defaults `allow-git` to `none`, so a git dependency no longer installs
 * without per-environment opt-in and cannot be restored from the registry at
 * all. Upstream has had no release since June 2022.
 */

const path = require('path');
const rollup = require('rollup');
const chokidar = require('chokidar');
const debounce = require('debounce');

// Rollup names synthetic modules (helpers, plugin-generated code) with a
// leading null byte. They have no path on disk for the watcher to resolve.
const hasNullByte = (string) => string.includes('\u0000');

function createWatcher(emitter) {
  const files = new Map();
  const watch = chokidar.watch();

  const refreshFile = (filePath) => {
    const isPOSIX = path.sep === '/';
    // Karma indexes its file list by POSIX path regardless of platform.
    const normalized = isPOSIX ? filePath : filePath.replace(/\\/g, '/');
    // Not part of Karma's public API, but the only way to invalidate a single
    // entry rather than restarting the run.
    emitter._fileList.changeFile(normalized, true);
  };

  // A change to any module in the graph must rebuild the entry that pulled it
  // in, not the module itself, which Karma does not serve.
  const handleChange = (changed) => {
    for (const [entry, dependencies] of files.entries()) {
      if (entry === changed || dependencies.includes(changed)) {
        return refreshFile(entry);
      }
    }
  };

  watch.on('change', debounce(handleChange, 150));

  return {
    add(entry, dependencies) {
      if (hasNullByte(entry)) {
        return;
      }
      const resolvable = dependencies.filter((file) => !hasNullByte(file));
      files.set(entry, resolvable);
      watch.add([entry, ...resolvable]);
    },
  };
}

function createPreprocessor(preconfig, config, emitter, logger) {
  const cache = new Map();
  const log = logger.create('preprocessor.rollup');

  // Watching is only meaningful when Karma stays resident between runs.
  const watcher =
    !config.singleRun && config.autoWatch ? createWatcher(emitter) : null;

  return async function preprocess(original, file, done) {
    const originalPath = file.originalPath;
    const location = path.relative(config.basePath, originalPath);
    try {
      const options = Object.assign(
        {},
        config.rollupPreprocessor,
        preconfig.options,
        {
          input: originalPath,
          // Reusing the previous build's cache is what keeps rebuilds
          // incremental across watch runs.
          cache: cache.get(originalPath),
        },
      );

      options.output = Object.assign({}, options.output);

      if (
        options.output.dir === undefined &&
        options.output.file === undefined
      ) {
        options.output.dir = path.dirname(originalPath);
      }

      const bundle = await rollup.rollup(options);
      cache.set(originalPath, bundle.cache);

      if (watcher) {
        const [entry, ...dependencies] = bundle.watchFiles;
        watcher.add(entry, dependencies);
      }

      log.info('Generating bundle for ./%s', location);
      const { output } = await bundle.generate(options.output);

      for (const result of output) {
        if (result.type !== 'chunk') {
          continue;
        }
        const { code, map, facadeModuleId, fileName } = result;

        // A preprocessor that changes the file extension must serve the name
        // Rollup emitted, or Karma will request a path that does not exist.
        if (facadeModuleId && !hasNullByte(facadeModuleId)) {
          const { dir } = path.parse(originalPath);
          file.path = path.posix.join(dir, fileName);
        }

        file.sourceMap = map;

        const processed =
          options.output.sourcemap === 'inline'
            ? code + `\n//# sourceMappingURL=${map.toUrl()}\n`
            : code;

        return done(null, processed);
      }
      log.warn('Nothing was processed.');
      done(null, original);
    } catch (error) {
      log.error('Failed to process ./%s\n\n%s\n', location, error.stack);
      done(error, null);
    }
  };
}

createPreprocessor.$inject = ['args', 'config', 'emitter', 'logger'];

module.exports = {
  'preprocessor:rollup': ['factory', createPreprocessor],
};
