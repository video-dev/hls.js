const tests = require.context('./unit/', true, /\.js$/);

tests.keys().forEach(tests);

const components = require.context('../src/', true, /\.js$/);

components.keys().forEach(components);
