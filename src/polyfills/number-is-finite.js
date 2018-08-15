// TODO: get rid of global polyfills and replace them with wrappers ("ponyfills")
Number.isFinite = Number.isFinite || function (value) {
  return typeof value === 'number' && isFinite(value);
};
