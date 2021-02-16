export const isFiniteNumber =
  Number.isFinite ||
  function (value) {
    return typeof value === 'number' && isFinite(value);
  };

export const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER || 9007199254740991;
