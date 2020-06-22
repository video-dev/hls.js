'use strict';

const fs = require('fs');
const versionParser = require('./version-parser.js');
const packageJson = require('../package.json');
const { isValidStableVersion, incrementPatch } = require('./version-parser.js');

const TRAVIS_MODE = process.env.TRAVIS_MODE;
let newVersion = '';

try {
  if (TRAVIS_MODE === 'release') {
    // write the version field in the package json to the version in the git tag
    const tag = process.env.TRAVIS_TAG;
    if (!versionParser.isValidVersion(tag)) {
      throw new Error('Unsuported tag for release: ' + tag);
    }
    // remove v
    newVersion = tag.substring(1);
  } else if (TRAVIS_MODE === 'releaseAlpha' || TRAVIS_MODE === 'netlifyPr' || TRAVIS_MODE === 'netlifyBranch') {
    // bump patch in version from latest git tag
    let intermediateVersion = getLatestVersionTag();
    const isStable = isValidStableVersion(intermediateVersion);

    // if last git tagged version is a prerelease we should append `.<type>.<commit num>`
    // if the last git tagged version is a stable version then we should append `-<type>.<commit num>` and increment the patch
    // `type` can be `pr`, `branch`, or `alpha`
    if (isStable) {
      intermediateVersion = incrementPatch(intermediateVersion);
    }

    // remove v
    intermediateVersion = intermediateVersion.substring(1);

    const suffix = TRAVIS_MODE === 'netlifyPr'
      ? `pr.${getCommitHash().substr(0, 8)}`
      : TRAVIS_MODE === 'netlifyBranch'
        ? `branch.${process.env.BRANCH/* set by netlify */.replace(/[^a-zA-Z0-9]/g, '-')}.${getCommitHash().substr(0, 8)}`
        : `alpha.${getCommitNum()}`;

    newVersion = `${intermediateVersion}${isStable ? '-' : '.'}${suffix}`;
  } else {
    throw new Error('Unsupported travis mode: ' + TRAVIS_MODE);
  }

  packageJson.version = newVersion;
  fs.writeFileSync('./package.json', JSON.stringify(packageJson));
  console.log('Set version: ' + newVersion);
} catch (e) {
  console.error(e);
  process.exit(1);
}
process.exit(0);

function getCommitNum () {
  return parseInt(exec('git rev-list --count HEAD'), 10);
}

function getCommitHash () {
  return exec('git rev-parse HEAD');
}

function getLatestVersionTag () {
  let commitish = '';
  while (true) {
    const tag = exec('git describe --abbrev=0 --match="v*" ' + commitish);
    if (!tag) {
      throw new Error('Could not find tag.');
    }
    if (versionParser.isValidVersion(tag)) {
      return tag;
    }
    // next time search older tags than this one
    commitish = tag + '~1';
  }
}

function exec (cmd) {
  return require('child_process').execSync(cmd).toString().trim();
}
