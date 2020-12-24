'use strict';

const packageJson = require('../package.json');

try {
  if (versionPublished()) {
    console.log('published');
  } else {
    console.log('not published');
  }
} catch (e) {
  console.error(e);
  process.exit(1);
}
process.exit(0);

function versionPublished() {
  // npm view returns empty string if package doesn't exist
  return !!require('child_process')
    .execSync(
      'npm view ' + packageJson.name + '@' + packageJson.version + ' --json'
    )
    .toString()
    .trim();
}
