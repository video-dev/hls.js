const fs = require('fs');
const package = require('../package.json');

try {
  const version = package.version + '-canary.' + getCommitHash().substr(0, 8);
  package.version = version;
  fs.writeFileSync('./package.json', JSON.stringify(package));
  console.log('Set canary version: ' + version);
} catch(e) {
  console.error(e);
  process.exit(1);
}
process.exit(0);


function getCommitHash() {
  return require('child_process').execSync('git rev-parse HEAD').toString().trim();
}
