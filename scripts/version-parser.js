'use strict';

const VALID_VERSION_REGEX = /^v\d+\.\d+\.\d+(?:-([a-zA-Z][0-9a-zA-Z-]*))?/;
const STABLE_VERSION_REGEX = /^v\d+\.\d+\.\d+$/;

module.exports = {
  isValidVersion: function(version) {
    return VALID_VERSION_REGEX.test(version);
  },
  isValidStableVersion: function(version) {
    return STABLE_VERSION_REGEX.test(version);
  },
  // extract what we should use as the npm dist-tag (https://docs.npmjs.com/cli/dist-tag)
  // e.g
  // v1.2.3-beta => beta
  // v1.2.3-beta.1 => beta
  // v1.2.3 => latest
  getVersionTag: function(version) {
    const match = VALID_VERSION_REGEX.exec(version);
    if (!match) {
      throw new Error('Invalid version.');
    }
    return match[1] || 'latest';
  }
}
