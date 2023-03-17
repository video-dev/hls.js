/* eslint-disable no-console */
const { configs } = require('./build-config');

module.exports = ({ configType = [] }) => {
  const requestedConfigs = Array.isArray(configType)
    ? configType
    : [configType];

  let configEntries;
  if (!requestedConfigs.length) {
    // If no arguments are specified, return every configuration
    configEntries = configs;
  } else {
    // Filter out enabled configs
    const enabledEntries = configs.filter(([name]) =>
      requestedConfigs.includes(name)
    );
    if (!enabledEntries.length) {
      throw new Error(
        `Couldn't find a valid config with the names ${JSON.stringify(
          requestedConfigs
        )}. Known configs are: ${configs.map(([name]) => name).join(', ')}`
      );
    }
    configEntries = enabledEntries;
  }

  console.log(
    `Building configs: ${configEntries.map(([name]) => name).join(', ')}.\n`
  );
  return configEntries.map(([, config]) => config);
};
