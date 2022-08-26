'use strict';

const semver = require('semver');

const VALID_VERSION_REGEX =
  /^v(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z][0-9a-zA-Z-]*))?/;
const STABLE_VERSION_REGEX = /^v\d+\.\d+\.\d+$/;

module.exports = {
  isValidVersion: (version) => {
    return VALID_VERSION_REGEX.test(version);
  },
  isValidStableVersion: (version) => {
    return STABLE_VERSION_REGEX.test(version);
  },
  incrementPatch: (version) => {
    const newVersion = 'v' + semver.inc(version, 'patch');
    if (!newVersion) {
      throw new Error(`Error incrementing patch for version "${version}"`);
    }
    return newVersion;
  },
  isGreaterOrEqual: (newVersion, previousVersion) => {
    return semver.gte(newVersion, previousVersion);
  },
  // returns true if the provided version is definitely greater than any existing
  // auto generated canary versions
  isDefinitelyGreaterThanCanaries: (version) => {
    const parsed = semver.parse(version, {
      loose: false,
      includePrerelease: true,
    });
    if (!parsed) {
      throw new Error('Error parsing version.');
    }

    // anything after a part of `0` must be greater than `canary`
    let hadZero = false;
    return parsed.prerelease.every((part) => {
      if (hadZero && part <= 'canary') {
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
    return match[4] || 'latest';
  },
  getPotentialPreviousStableVersions: (version) => {
    const match = VALID_VERSION_REGEX.exec(version);
    if (!match) {
      throw new Error('Invalid version.');
    }

    const major = parseInt(match[1]);
    const minor = parseInt(match[2]);
    const patch = parseInt(match[3]);

    const versions = [];
    if (major > 0) versions.push(`${major - 1}.0.${major === 1 ? '1' : '0'}`);
    if (minor > 0) versions.push(`${major}.${minor - 1}.0`);
    if (patch > 0) versions.push(`${major}.${minor}.${patch - 1}`);
    return versions;
  },
};
