import { expect } from 'chai';
import { parseDateTime } from '../../../src/utils/date-time';

describe('parseDateTime', function () {
  it('parses date-times with a time zone as-is', function () {
    expect(parseDateTime('2016-05-27T16:34:44Z')).to.equal(1464366884000);
    expect(parseDateTime('2016-05-27T16:34:44.000Z')).to.equal(1464366884000);
    expect(parseDateTime('2016-05-27T16:34:44z')).to.equal(1464366884000);
    expect(parseDateTime('2016-05-27T19:34:44+03:00')).to.equal(1464366884000);
    expect(parseDateTime('2016-05-27T13:34:44-03:00')).to.equal(1464366884000);
    expect(parseDateTime('2016-05-27T19:34:44+0300')).to.equal(1464366884000);
  });

  it('parses zone-less date-times as UTC', function () {
    expect(parseDateTime('2016-05-27T16:34:44')).to.equal(1464366884000);
    expect(parseDateTime('2016-05-27T16:34:44.000')).to.equal(1464366884000);
    expect(parseDateTime('2016-05-27T16:34:44.000123')).to.equal(1464366884000);
    expect(parseDateTime('2016-05-27T16:34')).to.equal(1464366840000);
  });

  it('leaves date-only values alone (already UTC per ECMA-262)', function () {
    expect(parseDateTime('2016-05-27')).to.equal(1464307200000);
  });

  it('leaves non-ISO date strings alone', function () {
    const rfc2822 = 'Fri, 27 May 2016 16:34:44 GMT';
    expect(parseDateTime(rfc2822)).to.equal(Date.parse(rfc2822));
  });

  it('returns NaN for invalid or missing input', function () {
    expect(parseDateTime('not a date')).to.be.NaN;
    expect(parseDateTime('2016-05-27T16:34:44 not a date')).to.be.NaN;
    expect(parseDateTime(undefined as unknown as string)).to.be.NaN;
  });
});
