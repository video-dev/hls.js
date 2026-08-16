import { expect } from 'chai';
import { parseDateTime } from '../../../src/utils/date-time';

describe('parseDateTime', function () {
  it('parses date-times with a time zone as-is', function () {
    expect(parseDateTime('2016-05-27T16:34:44Z')).to.equal(1464366884000);
    expect(parseDateTime('2016-05-27T16:34:44.000Z')).to.equal(1464366884000);
    expect(parseDateTime('2016-05-27T19:34:44+03:00')).to.equal(1464366884000);
    expect(parseDateTime('2016-05-27T13:34:44-03:00')).to.equal(1464366884000);
  });

  it('parses zone-less date-times as UTC', function () {
    expect(parseDateTime('2016-05-27T16:34:44')).to.equal(1464366884000);
    expect(parseDateTime('2016-05-27T16:34:44.000')).to.equal(1464366884000);
  });

  it('leaves date-only values alone (already UTC per ECMA-262)', function () {
    expect(parseDateTime('2016-05-27')).to.equal(1464307200000);
  });

  it('returns NaN for invalid input', function () {
    expect(parseDateTime('not a date')).to.be.NaN;
  });
});
