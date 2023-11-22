const micromatch = require('micromatch');
const prettier = require('prettier');

const addQuotes = (a) => `"${a}"`;

module.exports = async (allStagedFiles) => {
  const prettierSupportedExtensions = (
    await prettier.getSupportInfo()
  ).languages
    .map(({ extensions }) => extensions)
    .flat();

  const eslintFiles = micromatch(allStagedFiles, '**/*.{js,ts}');
  const prettierFiles = micromatch(
    allStagedFiles,
    prettierSupportedExtensions.map((extension) => `**/*${extension}`),
  );

  return [
    eslintFiles.length &&
      `eslint --cache --fix ${eslintFiles.map(addQuotes).join(' ')}`,
    prettierFiles.length &&
      `prettier --cache --write ${prettierFiles.map(addQuotes).join(' ')}`,
  ].filter(Boolean);
};
