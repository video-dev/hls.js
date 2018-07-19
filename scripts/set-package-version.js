'use strict';

const fs = require('fs');
const packageJson = require('../package.json');

const VALID_VERSION_REGEX = /^v\d+\.\d+\.\d+$/;

const TRAVIS_MODE = process.env.TRAVIS_MODE;
let newVersion = '';

try {
  if (TRAVIS_MODE === 'release') {
    // write the version field in the package json to the version in the git tag
    const tag = process.env.TRAVIS_TAG;
    if (!VALID_VERSION_REGEX.test(tag)) {
      throw new Error('Unsuported tag for release: ' + tag);
    }
    // remove v
    newVersion = tag.substring(1);
  } else if (TRAVIS_MODE === 'releaseCanary') {
    // bump patch in version from latest git tag
    let currentVersion = getLatestVersionTag();
    if (!VALID_VERSION_REGEX.test(currentVersion)) {
      throw new Error('Latest version tag invalid: ' + currentVersion);
    }
    // remove v
    currentVersion = currentVersion.substring(1);

    let matched = false;
    newVersion = currentVersion.replace(/^(\d+)\.(\d+)\.(\d+).*$/, function(_, major, minor, patch) {
      matched = true;
      return major + '.' + minor + '.' + (parseInt(patch, 10) + 1);
    });
    if (!matched) {
      throw new Error('Error calculating version.');
    }
    newVersion += '-canary.' + getCommitNum();
  } else {
    throw new Error('Unsupported travis mode: ' + TRAVIS_MODE);
  }

  packageJson.version = newVersion;
  fs.writeFileSync('./package.json', JSON.stringify(packageJson));
  console.log('Set version: ' + newVersion);
} catch(e) {
  console.error(e);
  process.exit(1);
}
process.exit(0);

function getCommitNum() {
  return parseInt(require('child_process').execSync('git rev-list --count HEAD').toString(), 10);
}

function getLatestVersionTag() {
  return require('child_process').execSync('git describe --abbrev=0 --match="v*"').toString().trim();
}
