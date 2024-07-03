const Uint8Array = window.Uint8Array;
const TimeRanges = window.TimeRanges;

export function stringify(value, replacer, space) {
  try {
    return truncate(
      JSON.stringify(value, replacer || stringifyReplacer(value), space),
      100000
    );
  } catch (error) {
    return `[${error}]`;
  }
}

function truncate(str, length) {
  return str?.length > length
    ? str.substr(0, length) +
        '\n... Event truncated due to length (see console for complete output)'
    : str;
}

function stringifyReplacer(parentValue) {
  const references: any[] = [];
  const safeResults: any[] = [];
  let complexity = 0;
  return function stringifyKeyValue(key: string, value) {
    if (typeof value === 'object') {
      if (value === null || value instanceof Date || value instanceof RegExp) {
        return value;
      }
      if (!!Uint8Array && value instanceof Uint8Array) {
        // Stub values of Arrays with more than 1000 items
        let str = '' + value;
        str = str.length > 40 ? str.substr(0, 40) + '...(see console)' : str;
        return `Uint8Array(${value.length}) [${str}]`;
      }
      if (!!TimeRanges && value instanceof TimeRanges) {
        const ranges: string[] = [];
        for (let i = 0; i < value.length; i++) {
          ranges[i] =
            `start(${i}) = ${value.start(i)} end(${i}) = ${value.end(i)}`;
        }
        return `TimeRanges(${value.length}) [${ranges}]`;
      }
      if (value === parentValue && complexity > 0) {
        return '<parent object>';
      }
      const referenceIndex = references.indexOf(value);
      if (referenceIndex !== -1) {
        // Duplicate reference found
        const safe = safeResults[referenceIndex];
        if (safe) {
          return safe;
        }
        try {
          // Test for circular references
          JSON.stringify(value);
        } catch (error) {
          return (safeResults[referenceIndex] =
            '<' + value + '...(see console)>');
        }
        safeResults[referenceIndex] = value;
      }
      if (complexity++ > 10000) {
        return '<complexity exceeded>';
      }
      references.push(value);
      return value;
    }
    if (typeof value === 'function') {
      return `${value}`;
    }
    return value;
  };
}
