import { DateRange } from '../../../src/loader/date-range';
import { AttrList } from '../../../src/utils/attr-list';

import chai from 'chai';

const expect = chai.expect;

describe('DateRange class', function () {
  const startDateAndDuration = new AttrList(
    'ID="ad1",CLASS="com.apple.hls.interstitial",START-DATE="2020-01-02T21:55:44.000Z",DURATION=15.0'
  );
  const startDateAndEndDate = new AttrList(
    'ID="ad2",CLASS="com.apple.hls.interstitial",START-DATE="2020-01-02T21:55:44.000Z",END-DATE="2020-01-02T21:56:44.001Z"'
  );
  const startDateAndEndOnNext = new AttrList(
    'ID="ad3",CLASS="com.apple.hls.interstitial",START-DATE="2022-01-01T00:00:00.100Z",END-ON-NEXT=YES'
  );

  const sctePlanned = new AttrList(
    'ID="s1",START-DATE="2014-03-05T11:15:00Z",PLANNED-DURATION=59.993,SCTE35-OUT=0xFC'
  );
  const scteDurationUpdate = new AttrList(
    'ID="s1",DURATION=59.994,SCTE35-IN=0xFC01'
  );

  const scteInvalidChange = new AttrList(
    'ID="s1",PLANNED-DURATION=60.0,SCTE35-OUT=0xFCCC,DURATION=59.993,SCTE35-IN=0xFC'
  );

  const missingId = new AttrList(
    'START-DATE="2020-01-02T21:55:44.000Z",DURATION=15.0'
  );
  const missingStartDate = new AttrList('ID="ad1",DURATION=15.0');

  const invalidStartDate = new AttrList(
    'ID="ad1",START-DATE="20-01-02-21:55",DURATION=15.0'
  );
  const negativeDuration = new AttrList(
    'ID="ad1",START-DATE="2020-01-02T21:55:44.000Z",DURATION=-1.0'
  );
  const endDateEarlierThanStartDate = new AttrList(
    'ID="ad2",START-DATE="2020-01-02T21:55:44.000Z",END-DATE="2019-01-02T21:56:44.001Z"'
  );
  const endOnNextWithNoClass = new AttrList(
    'ID="ad3",START-DATE="2022-01-01T00:00:00.100Z",END-ON-NEXT=YES'
  );

  it('parses id, class, date, duration, and end-on-next attributes', function () {
    const dateRangeDuration = new DateRange(startDateAndDuration);
    expect(dateRangeDuration.id).to.equal('ad1');
    expect(dateRangeDuration.class).to.equal('com.apple.hls.interstitial');
    expect(dateRangeDuration.startDate.toISOString()).to.equal(
      '2020-01-02T21:55:44.000Z'
    );
    expect(dateRangeDuration.duration).to.equal(15);

    const dateRangeEndDate = new DateRange(startDateAndEndDate);
    expect(dateRangeEndDate.id).to.equal('ad2');
    expect(dateRangeEndDate.class).to.equal('com.apple.hls.interstitial');
    expect(dateRangeEndDate.startDate.toISOString()).to.equal(
      '2020-01-02T21:55:44.000Z'
    );
    expect(dateRangeEndDate.endDate?.toISOString()).to.equal(
      '2020-01-02T21:56:44.001Z'
    );

    const dateRangeEndOnNext = new DateRange(startDateAndEndOnNext);
    expect(dateRangeEndOnNext.id).to.equal('ad3');
    expect(dateRangeEndOnNext.class).to.equal('com.apple.hls.interstitial');
    expect(dateRangeEndOnNext.startDate.toISOString()).to.equal(
      '2022-01-01T00:00:00.100Z'
    );
    expect(dateRangeEndOnNext.endOnNext).to.equal(true);

    const dateRangePlannedDuration = new DateRange(sctePlanned);
    expect(dateRangePlannedDuration.id).to.equal('s1');
    expect(dateRangePlannedDuration.startDate.toISOString()).to.equal(
      '2014-03-05T11:15:00.000Z'
    );
    expect(dateRangePlannedDuration.plannedDuration).to.equal(59.993);
  });

  it('calculates end-date based on duration', function () {
    const dateRangeDuration = new DateRange(startDateAndDuration);
    expect(dateRangeDuration.endDate?.toISOString()).to.equal(
      '2020-01-02T21:55:59.000Z'
    );
  });

  it('calculates duration based on end-date', function () {
    const dateRangeEndDate = new DateRange(startDateAndEndDate);
    expect(dateRangeEndDate.duration).to.equal(60.001);
  });

  describe('merges tags with matching ID attributes', function () {
    const scteOut = new DateRange(sctePlanned);
    const scteIn = new DateRange(scteDurationUpdate, scteOut);
    expect(scteIn.startDate.toISOString()).to.equal('2014-03-05T11:15:00.000Z');
    expect(scteIn.plannedDuration).to.equal(59.993);
    expect(scteIn.duration).to.equal(59.994);
    expect(scteIn.attr['SCTE35-OUT']).to.equal('0xFC');
    expect(scteIn.attr['SCTE35-IN']).to.equal('0xFC01');
    expect(scteIn.isValid).to.equal(true);
  });

  describe('isValid indicates that DATERANGE tag:', function () {
    function validateDateRange(attributeList: AttrList, expected: boolean) {
      expect(new DateRange(attributeList).isValid).to.equal(
        expected,
        `Expected attributes to be ${
          expected ? 'valid' : 'invalid'
        } ${JSON.stringify(attributeList)}`
      );
    }

    it('has required attributes', function () {
      validateDateRange(startDateAndDuration, true);
      validateDateRange(startDateAndEndDate, true);
      validateDateRange(startDateAndEndOnNext, true);
      validateDateRange(sctePlanned, true);

      validateDateRange(missingId, false);
      validateDateRange(missingStartDate, false);
      validateDateRange(scteDurationUpdate, false);
    });

    it('has a valid START-DATE date/time value', function () {
      validateDateRange(invalidStartDate, false);
    });

    it('has an optional DURATION is not negative', function () {
      validateDateRange(negativeDuration, false);
    });

    it('has an optional END-DATE that is equal to or later than the value of START-DATE', function () {
      validateDateRange(endDateEarlierThanStartDate, false);
    });

    it('has a CLASS attribute when END-ON-NEXT=YES', function () {
      validateDateRange(endOnNextWithNoClass, false);
    });

    it('has another DateRange tag with the same ID attribute value, and attributes that appear in both tags have the same value', function () {
      const scteOut = new DateRange(sctePlanned);
      const scteIn = new DateRange(scteInvalidChange, scteOut);
      expect(scteIn.isValid).to.equal(
        false,
        `Expected DateRange with same ID to be invalid because of conflicting attribute values\n${JSON.stringify(
          scteOut
        )}\n${JSON.stringify(scteIn)}`
      );
    });
  });
});
