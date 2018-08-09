const fs = require('fs');
const package = require('../package.json');

try {
  // bump patch
  let matched = false;
  let newVersion = package.version.replace(/^(\d+)\.(\d+)\.(\d+).*$/, function(_, major, minor, patch) {
    matched = true;
    return major + '.' + minor + '.' + (parseInt(patch, 10) + 1);
  });
  if (!matched) {
    throw new Error('Error calculating version.');
  }
  newVersion += '-canary.' + getCommitNum();

  package.version = newVersion;
  fs.writeFileSync('./package.json', JSON.stringify(package));
  console.log('Set canary version: ' + newVersion);
} catch(e) {
  console.error(e);
  process.exit(1);
}
process.exit(0);


function getCommitNum() {
  return parseInt(require('child_process').execSync('git rev-list --count HEAD').toString(), 10);
}
