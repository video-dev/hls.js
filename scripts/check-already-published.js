/* eslint-disable no-undef */
/* eslint-disable no-console */
'use strict';

const packageJson = require('../package.json');

(async () => {
  try {
    if (await versionPublished()) {
      console.log('published');
    } else {
      console.log('not published');
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
  process.exit(0);
})();

async function versionPublished() {
  const fetch = (await import('node-fetch')).default;

  //https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md
  const response = await fetch(
    `https://registry.npmjs.org/${encodeURIComponent(
      packageJson.name,
    )}/${encodeURIComponent(packageJson.version)}`,
  );
  if (response.status === 200) {
    return true;
  } else if (response.status === 404) {
    return false;
  } else {
    throw new Error(`Invalid status: ${response.status}`);
  }
}
