'use strict';

const semver = require('semver');

const VALID_VERSION_REGEX = /^v\d+\.\d+\.\d+(?:-([a-zA-Z][0-9a-zA-Z-]*))?/;
const STABLE_VERSION_REGEX = /^v\d+\.\d+\.\d+$/;

module.exports = {
  isValidVersion: (version) => {
    return VALID_VERSION_REGEX.test(version);
  },
  isValidStableVersion: (version) => {
    return STABLE_VERSION_REGEX.test(version);
  },
  incrementPatch: (version) => {
    const newVersion = semver.inc('patch', version);
    if (!newVersion) {
      throw new Error('Error incrementing patch.');
    }
    return newVersion;
  },
  isGreater: (newVersion, previousVersion) => {
    return semver.gt(newVersion, previousVersion);
  },
  // returns true if the provided version is definitely greater than any existing
  // auto generated alpha versions
  isDefinitelyGreaterThanAlphas: (version) => {
    const parsed = semver.parse(version, { loose: false, includePrerelease: true });
    if (!parsed) {
      throw new Error('Error parsing version.');
    }

    // anything after a part of `0` must be greater than `alpha`
    let hadZero = false;
    return parsed.prerelease.every((part) => {
      if (hadZero && part <= 'alpha') {
        return false;
      } else {
        hadZero = false;
      }
      if (part === 0) {
        hadZero = true;
      }
      return true;
    });
  },
  // extract what we should use as the npm dist-tag (https://docs.npmjs.com/cli/dist-tag)
  // e.g
  // v1.2.3-beta => beta
  // v1.2.3-beta.1 => beta
  // v1.2.3 => latest
  getVersionTag: (version) => {
    const match = VALID_VERSION_REGEX.exec(version);
    if (!match) {
      throw new Error('Invalid version.');
    }
    return match[1] || 'latest';
  }
};
