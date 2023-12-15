/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const itemCountMd = 100;
const txtFileName = 'deployments.txt';

async function go() {
  // eslint-disable-next-line no-undef
  const [, , deploymentsFile, outputDir] = process.argv;

  assert(deploymentsFile, 'Missing deploymentsFile');
  assert(outputDir, 'Missing outputDir');

  const { stable, latest, individual } = JSON.parse(
    await fs.promises.readFile(deploymentsFile, { encoding: 'utf-8' }),
  );

  const mdContent = `# Deployments

- **Stable:** [${stable}](${stable})
- **Latest:** [${latest}](${latest})

Below you can find the URL's to deployments for individual commits:

${Array.from(individual)
  .reverse()
  .slice(0, itemCountMd)
  .map(
    ({ commit, version, url }) =>
      `- [\`${commit.slice(
        0,
        8,
      )} (${version})\`](https://github.com/video-dev/hls.js/commit/${commit}): [${url}](${url})`,
  )
  .join('\n')}

_Note for older deployments please check [${txtFileName}](./${txtFileName})._
`;

  await fs.promises.writeFile(path.resolve(outputDir, 'README.md'), mdContent, {
    encoding: 'utf-8',
  });

  const txtContent = `Deployments
===========

- Stable: ${stable}
- Latest: ${latest}

Below you can find the URL's to deployments for individual commits:

${Array.from(individual)
  .reverse()
  .map(
    ({ commit, version, url }) =>
      `- ${commit.slice(0, 8)} (${version}): ${url}`,
  )
  .join('\n')}
`;

  await fs.promises.writeFile(
    path.resolve(outputDir, txtFileName),
    txtContent,
    {
      encoding: 'utf-8',
    },
  );
}

go().catch((e) => {
  console.error(e);
  // eslint-disable-next-line no-undef
  process.exit(1);
});
