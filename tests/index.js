import 'promise-polyfill/src/polyfill';
const testsContext = require.context('./unit', true);
testsContext.keys().forEach(testsContext);
