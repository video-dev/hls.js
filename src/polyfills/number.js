import { getSelfScope } from '../utils/get-self-scope';

const self = getSelfScope();
const Number = self.Number;

// TODO: get rid of global polyfills and replace them with wrappers ("ponyfills")
Number.isFinite = Number.isFinite || function (value) {
  return typeof value === 'number' && isFinite(value);
};

export { Number };
