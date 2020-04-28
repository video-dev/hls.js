import testStreams from '../../tests/test-streams';

export const searchParams = parseUrlSearchParams(location.search, {
  src: testStreams.bbb.url,
  width: '720px'
});

if (searchParams.config) {
  searchParams.config = parseBase64Config(searchParams.config);
}

function parseUrlSearchParams (url, object) {
  return (url || '').split('?').slice(1).join('').split('&').filter(function (pair) {
    return pair;
  }).reduce(function (obj, pair) {
    const key = pair.split('=')[0];
    const value = (pair.split('=')[1] || '').replace(/\+/g, ' ');
    try {
      obj[key] = decodeURIComponent(value);
    } catch (error) {
      // Allow for unencoded percentage width values in the config (width=100%)
      console.warn(`Could not decode key value "${key}=${value}"`, error);
      obj[key] = value;
    }
    return obj;
  }, object);
}

function parseBase64Config (encodedConfig) {
  const json = atob(encodedConfig);
  try {
    return JSON.parse(json);
  } catch (error) {
    console.warn(error);
  }
  return null;
}
