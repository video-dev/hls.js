#!/usr/bin/env node
/* eslint-disable no-console */
/* eslint-env node */
'use strict';

/**
 * Reports dist/ file sizes and, with --check, exits non-zero when any file
 * exceeds its limit from dist-size-budget.json.
 *
 * Limits are compared against brotli size, which is what CDNs serve.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const BUDGET_FILE = path.join(ROOT, 'dist-size-budget.json');

/**
 * Resolves each budget to the byte limit enforced against it.
 *
 * Values are validated rather than defaulted: a tolerance that failed to parse
 * would raise every limit and let regressions through unnoticed.
 */
function loadLimits() {
  let config;
  try {
    config = JSON.parse(fs.readFileSync(BUDGET_FILE, { encoding: 'utf-8' }));
  } catch (error) {
    throw new Error(`Cannot read ${BUDGET_FILE}: ${error.message}`);
  }

  const { tolerance = 0, files } = config;

  if (typeof tolerance !== 'number' || !isFinite(tolerance) || tolerance < 0) {
    throw new Error(
      `${BUDGET_FILE}: "tolerance" must be a non-negative number, got ${JSON.stringify(tolerance)}.`,
    );
  }
  if (!files || typeof files !== 'object') {
    throw new Error(`${BUDGET_FILE}: "files" must be an object of budgets.`);
  }

  return Object.keys(files).map((name) => {
    const budget = files[name];
    if (typeof budget !== 'number' || !isFinite(budget) || budget <= 0) {
      throw new Error(
        `${BUDGET_FILE}: budget for "${name}" must be a positive number, got ${JSON.stringify(budget)}.`,
      );
    }
    return { name, budget, limit: Math.round(budget * (1 + tolerance)) };
  });
}

function measure(file) {
  const raw = fs.readFileSync(file);
  return {
    raw: raw.length,
    gzip: zlib.gzipSync(raw, { level: zlib.constants.Z_BEST_COMPRESSION })
      .length,
    brotli: zlib.brotliCompressSync(raw, {
      params: {
        // Pinned so the reported number does not drift with the Node version.
        [zlib.constants.BROTLI_PARAM_QUALITY]:
          zlib.constants.BROTLI_MAX_QUALITY,
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: raw.length,
      },
    }).length,
  };
}

function formatBytes(bytes) {
  const sign = bytes < 0 ? '-' : '';
  return `${sign}${(Math.abs(bytes) / 1024).toFixed(1)} KiB`;
}

function measureAll(limits) {
  const measured = [];
  const missing = [];

  limits.forEach(({ name, limit }) => {
    const file = path.join(ROOT, 'dist', name);
    if (!fs.existsSync(file)) {
      missing.push(name);
      return;
    }
    const sizes = measure(file);
    measured.push({
      name,
      ...sizes,
      limit,
      headroom: limit - sizes.brotli,
    });
  });

  return { measured, missing };
}

function printTable(rows) {
  const columns = [
    { title: 'file', of: (row) => row.name, align: 'left' },
    { title: 'raw', of: (row) => formatBytes(row.raw) },
    { title: 'gzip', of: (row) => formatBytes(row.gzip) },
    { title: 'brotli', of: (row) => formatBytes(row.brotli) },
    { title: 'limit', of: (row) => formatBytes(row.limit) },
    { title: 'headroom', of: (row) => formatBytes(row.headroom) },
  ];

  const widths = columns.map((column) =>
    Math.max(column.title.length, ...rows.map((row) => column.of(row).length)),
  );
  const line = (cells) =>
    cells
      .map((cell, i) =>
        columns[i].align === 'left'
          ? cell.padEnd(widths[i])
          : cell.padStart(widths[i]),
      )
      .join('  ');

  console.log(line(columns.map((column) => column.title)));
  console.log('-'.repeat(widths.reduce((sum, w) => sum + w + 2, -2)));
  rows.forEach((row) => {
    console.log(
      `${line(columns.map((column) => column.of(row)))}${row.headroom < 0 ? '  OVER LIMIT' : ''}`,
    );
  });
}

function writeStepSummary(rows, file) {
  const cells = (row) => [
    row.headroom < 0 ? `⚠️ \`${row.name}\`` : `\`${row.name}\``,
    formatBytes(row.raw),
    formatBytes(row.gzip),
    formatBytes(row.brotli),
    formatBytes(row.limit),
    formatBytes(row.headroom),
  ];

  fs.appendFileSync(
    file,
    [
      '## Bundle size',
      '',
      '| file | raw | gzip | brotli | limit | headroom |',
      '| --- | ---: | ---: | ---: | ---: | ---: |',
      ...rows.map((row) => `| ${cells(row).join(' | ')} |`),
      '',
      `Compared after brotli compression against the limits in \`dist-size-budget.json\`.`,
      '',
    ].join('\n'),
  );
}

let limits;
try {
  limits = loadLimits();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const { measured, missing } = measureAll(limits);

if (measured.length) {
  printTable(measured);
}
if (missing.length) {
  console.log(`\nNot built: ${missing.join(', ')}`);
}
if (process.env.GITHUB_STEP_SUMMARY && measured.length) {
  writeStepSummary(measured, process.env.GITHUB_STEP_SUMMARY);
}

if (!process.argv.includes('--check')) {
  process.exit(0);
}

if (missing.length) {
  console.error(
    `\nCannot check bundle size: ${missing.length} file(s) missing from dist/. Run \`npm run build\` first.`,
  );
  process.exit(1);
}

const over = measured.filter((row) => row.headroom < 0);
if (over.length) {
  console.error('\nBundle size limit exceeded:');
  over.forEach((row) => {
    console.error(
      `  ${row.name}: ${formatBytes(row.brotli)} brotli is ${formatBytes(-row.headroom)} over the ${formatBytes(row.limit)} limit.`,
    );
  });
  console.error(
    '\nIf the growth is intended, raise the budget in dist-size-budget.json in this change so the increase is reviewed.',
  );
  process.exit(1);
}

console.log('\nAll files within budget.');
