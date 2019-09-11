'use strict';

const versionParser = require('./version-parser.js');
const packageJson = require('../package.json');

console.log(versionParser.getVersionTag('v' + packageJson.version));
