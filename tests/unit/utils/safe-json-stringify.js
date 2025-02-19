import { stringify } from '../../../src/utils/safe-json-stringify';

describe('Stringify', function () {
  it('should safely stringify a circular object', function () {
    const originalObject = { a: 'test' };

    const circularObject = { ...originalObject };
    circularObject.b = circularObject;

    const stringified = stringify(circularObject);

    expect(stringified).to.equal(JSON.stringify(originalObject));
  });
});
