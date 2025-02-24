import { stringify } from '../../../src/utils/safe-json-stringify';

describe('Stringify', function () {
  it('should safely stringify a circular object', function () {
    const originalObject = { a: 'test' };

    const circularObject = { ...originalObject };
    circularObject.b = circularObject;

    const stringified = stringify(circularObject);

    expect(stringified).to.equal(JSON.stringify(originalObject));
  });

  it('should use the optional custom replacer', function () {
    const stringified = stringify(
      {
        a: '1',
        b: { c: 2 },
      },
      (k, v) => (k === 'b' ? '2' : v),
    );

    expect(stringified).to.equal(
      JSON.stringify({
        a: '1',
        b: '2',
      }),
    );
  });

  it('uses the optional custom replacer before checking for cyclical references', function () {
    const originalObject = { a: 'test' };

    const circularObject = { ...originalObject };
    circularObject.b = circularObject;

    const stringified = stringify(circularObject, (k, v) =>
      k === 'b' ? 'replaced' : v,
    );

    expect(stringified).to.equal(
      JSON.stringify({
        a: 'test',
        b: 'replaced',
      }),
    );
  });

  it('cyclical references added by the custom replacer are removed', function () {
    const originalObject = { a: 'test' };

    const circularObject = { ...originalObject };
    circularObject.b = {};
    circularObject.d = 'replace-with-circular-object';

    const stringified = stringify(circularObject, (k, v) => {
      if (k === 'b') {
        v.b = circularObject;
        v.c = 'test';
      } else if (v === 'replace-with-circular-object') {
        v = circularObject;
      }
      return v;
    });

    expect(stringified).to.equal(
      JSON.stringify({
        a: 'test',
        b: { c: 'test' },
      }),
    );
  });
});
