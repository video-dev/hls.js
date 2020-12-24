const micromatch = require('micromatch');
const prettier = require('prettier');

const prettierSupportedExtensions = prettier
  .getSupportInfo()
  .languages.map(({ extensions }) => extensions)
  .flat();
const addQuotes = (a) => `"${a}"`;

module.exports = (allStagedFiles) => {
  const eslintFiles = micromatch(allStagedFiles, '{src,tests}/**/*.{js,ts}');
  const prettierFiles = micromatch(
    allStagedFiles,
    prettierSupportedExtensions.map((extension) => `**/*${extension}`)
  );
  return [
    `eslint --cache --fix ${eslintFiles.map(addQuotes).join(' ')}`,
    `prettier --write ${prettierFiles.map(addQuotes).join(' ')}`,
  ];
};
