#!/usr/bin/env node
/* eslint-env node */
'use strict';

/**
 * Writes the type declarations for the light build (see #7574).
 *
 * The light build stubs out a number of modules (EME, CMCD, subtitles,
 * alt-audio, variable substitution and advanced m2ts codecs — see
 * `getAliasesForDist` in build-config.js), so there is no clean way to type the
 * stubbed modules separately. The expectation is that consumers use the full
 * types and avoid the features the light build leaves out.
 *
 * Each light declaration therefore re-exports the full types, rather than
 * shipping another copy of hls.d.ts per entry point.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.resolve(__dirname, '..', 'dist');

// Each light declaration file, and the sibling declaration it re-exports.
// The ESM declaration points at the ESM build so that it stays ESM-to-ESM.
const declarations = [
  ['hls.light.d.ts', './hls.js'],
  ['hls.light.js.d.ts', './hls.js'],
  ['hls.light.d.mts', './hls.mjs'],
];

declarations.forEach(([file, source]) => {
  fs.writeFileSync(
    path.join(DIST, file),
    `export * from '${source}';\nexport { default } from '${source}';\n`,
  );
});
