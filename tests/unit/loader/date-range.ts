import chai from 'chai';
import { DateRange } from '../../../src/loader/date-range';
import { AttrList } from '../../../src/utils/attr-list';

const expect = chai.expect;

describe('DateRange class', function () {
  const startDateAndDuration = new AttrList(
    'ID="ad1",CLASS="com.apple.hls.interstitial",START-DATE="2020-01-02T21:55:44.000Z",DURATION=15.0,X-ASSET-URI="i.m3u8"',
  );
  const startDateAndEndDate = new AttrList(
    'ID="ad2",CLASS="com.apple.hls.interstitial",START-DATE="2020-01-02T21:55:44.000Z",END-DATE="2020-01-02T21:56:44.001Z",X-ASSET-URI="i.m3u8"',
  );
  const startDateAndEndOnNext = new AttrList(
    'ID="ad3",CLASS="com.apple.hls.interstitial",START-DATE="2022-01-01T00:00:00.100Z",END-ON-NEXT=YES,X-ASSET-URI="i.m3u8"',
  );

  const sctePlanned = new AttrList(
    'ID="s1",START-DATE="2014-03-05T11:15:00Z",PLANNED-DURATION=59.993,SCTE35-OUT=0xFC',
  );
  const scteDurationUpdate = new AttrList(
    'ID="s1",DURATION=59.994,SCTE35-IN=0xFC01',
  );

  const scteInvalidChange = new AttrList(
    'ID="s1",PLANNED-DURATION=60.0,SCTE35-OUT=0xFCCC,DURATION=59.993,SCTE35-IN=0xFC',
  );

  const missingId = new AttrList(
    'START-DATE="2020-01-02T21:55:44.000Z",DURATION=15.0',
  );
  const missingStartDate = new AttrList('ID="ad1",DURATION=15.0');

  const invalidStartDate = new AttrList(
    'ID="ad1",START-DATE="20-01-02-21:55",DURATION=15.0',
  );
  const negativeDuration = new AttrList(
    'ID="ad1",START-DATE="2020-01-02T21:55:44.000Z",DURATION=-1.0',
  );
  const endDateEarlierThanStartDate = new AttrList(
    'ID="ad2",START-DATE="2020-01-02T21:55:44.000Z",END-DATE="2019-01-02T21:56:44.001Z"',
  );
  const endOnNextWithNoClass = new AttrList(
    'ID="ad3",START-DATE="2022-01-01T00:00:00.100Z",END-ON-NEXT=YES',
  );
  const cueWithPre = new AttrList(
    'ID="mid1",CLASS="com.apple.hls.interstitial",CUE="PRE",START-DATE="2024-01-12T10:00:10.000Z",DURATION=15.0,X-ASSET-URI="b.m3u8"',
  );
  const cueWithPost = new AttrList(
    'ID="mid1",CLASS="com.apple.hls.interstitial",CUE="POST",START-DATE="2024-01-12T10:00:10.000Z",DURATION=15.0,X-ASSET-URI="b.m3u8"',
  );
  const cueWithPreOnce = new AttrList(
    'ID="mid1",CLASS="com.apple.hls.interstitial",CUE="PRE,ONCE",START-DATE="2024-01-12T10:00:10.000Z",DURATION=15.0,X-ASSET-URI="b.m3u8"',
  );
  const cueWithPostOnce = new AttrList(
    'ID="mid1",CLASS="com.apple.hls.interstitial",CUE="POST,ONCE",START-DATE="2024-01-12T10:00:10.000Z",DURATION=15.0,X-ASSET-URI="b.m3u8"',
  );
  const cueWithPreAndPost = new AttrList(
    'ID="mid1",CLASS="com.apple.hls.interstitial",CUE="PRE,POST",START-DATE="2024-01-12T10:00:10.000Z",DURATION=15.0,X-ASSET-URI="b.m3u8"',
  );
  // const invalidQuotedAttributeId = new AttrList(
  //   'ID=bad,START-DATE="2020-01-02T21:55:44.000Z",DURATION=1.0',
  // );
  // const invalidQuotedAttributeStartDate = new AttrList(
  //   'ID="ok",START-DATE=2020-01-02T21:55:44.000Z,DURATION=1.0',
  // );

  it('parses id, class, date, duration, and end-on-next attributes', function () {
    const dateRangeDuration = new DateRange(startDateAndDuration);
    expect(dateRangeDuration.id).to.equal('ad1');
    expect(dateRangeDuration.class).to.equal('com.apple.hls.interstitial');
    expect(dateRangeDuration.startDate.toISOString()).to.equal(
      '2020-01-02T21:55:44.000Z',
    );
    expect(dateRangeDuration.duration).to.equal(15);

    const dateRangeEndDate = new DateRange(startDateAndEndDate);
    expect(dateRangeEndDate.id).to.equal('ad2');
    expect(dateRangeEndDate.class).to.equal('com.apple.hls.interstitial');
    expect(dateRangeEndDate.startDate.toISOString()).to.equal(
      '2020-01-02T21:55:44.000Z',
    );
    expect(dateRangeEndDate.endDate?.toISOString()).to.equal(
      '2020-01-02T21:56:44.001Z',
    );

    const dateRangeEndOnNext = new DateRange(startDateAndEndOnNext);
    expect(dateRangeEndOnNext.id).to.equal('ad3');
    expect(dateRangeEndOnNext.class).to.equal('com.apple.hls.interstitial');
    expect(dateRangeEndOnNext.startDate.toISOString()).to.equal(
      '2022-01-01T00:00:00.100Z',
    );
    expect(dateRangeEndOnNext.endOnNext).to.equal(true);

    const dateRangePlannedDuration = new DateRange(sctePlanned);
    expect(dateRangePlannedDuration.id).to.equal('s1');
    expect(dateRangePlannedDuration.startDate.toISOString()).to.equal(
      '2014-03-05T11:15:00.000Z',
    );
    expect(dateRangePlannedDuration.plannedDuration).to.equal(59.993);
  });

  it('calculates end-date based on duration', function () {
    const dateRangeDuration = new DateRange(startDateAndDuration);
    expect(dateRangeDuration.endDate?.toISOString()).to.equal(
      '2020-01-02T21:55:59.000Z',
    );
  });

  it('calculates duration based on end-date', function () {
    const dateRangeEndDate = new DateRange(startDateAndEndDate);
    expect(dateRangeEndDate.duration).to.equal(60.001);
  });

  it('merges tags with matching ID attributes', function () {
    const scteOut = new DateRange(sctePlanned);
    const scteIn = new DateRange(scteDurationUpdate, scteOut);
    expect(scteIn.startDate.toISOString()).to.equal('2014-03-05T11:15:00.000Z');
    expect(scteIn.plannedDuration).to.equal(59.993);
    expect(scteIn.duration).to.equal(59.994);
    expect(scteIn.attr['SCTE35-OUT']).to.equal('0xFC');
    expect(scteIn.attr['SCTE35-IN']).to.equal('0xFC01');
    expect(scteIn.isValid).to.equal(true);
  });

  describe('isInterstitial', function () {
    it('identifies Interstitial DateRange tags with CLASS="com.apple.hls.interstitial"', function () {
      expect(new DateRange(startDateAndDuration).isInterstitial).to.be.true;
      expect(new DateRange(startDateAndEndDate).isInterstitial).to.be.true;
      expect(new DateRange(startDateAndEndOnNext).isInterstitial).to.be.true;
    });

    it('is false for non-Interstitial DateRanges', function () {
      expect(new DateRange(sctePlanned).isInterstitial).to.be.false;
      expect(new DateRange(scteDurationUpdate).isInterstitial).to.be.false;
      expect(new DateRange(scteInvalidChange).isInterstitial).to.be.false;
      expect(new DateRange(missingId).isInterstitial).to.be.false;
      expect(new DateRange(missingStartDate).isInterstitial).to.be.false;
      expect(new DateRange(invalidStartDate).isInterstitial).to.be.false;
      expect(new DateRange(negativeDuration).isInterstitial).to.be.false;
      expect(new DateRange(endDateEarlierThanStartDate).isInterstitial).to.be
        .false;
      expect(new DateRange(endOnNextWithNoClass).isInterstitial).to.be.false;
    });
  });

  describe('isValid indicates that DATERANGE tag:', function () {
    function validateDateRange(attributeList: AttrList, expected: boolean) {
      expect(new DateRange(attributeList).isValid).to.equal(
        expected,
        `Expected attributes to be ${
          expected ? 'valid' : 'invalid'
        } ${JSON.stringify(attributeList)}`,
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
          scteOut,
        )}\n${JSON.stringify(scteIn)}`,
      );
    });

    it('parses the CUE attribute PRE, POST, and ONCE Trigger Identifiers', function () {
      const pre = new DateRange(cueWithPre);
      const post = new DateRange(cueWithPost);
      const preOnce = new DateRange(cueWithPreOnce);
      const postOnce = new DateRange(cueWithPostOnce);
      expect(pre.isValid).to.equal(true, JSON.stringify(pre));
      expect(post.isValid).to.equal(true, JSON.stringify(post));
      expect(preOnce.isValid).to.equal(true, JSON.stringify(preOnce));
      expect(postOnce.isValid).to.equal(true, JSON.stringify(postOnce));
    });

    it('MUST NOT include both PRE and POST CUE Trigger Identifiers', function () {
      const preAndPost = new DateRange(cueWithPreAndPost);
      expect(preAndPost.isValid).to.equal(
        false,
        `Expected DateRange with CUE to have PRE or POST enumerated string values, but not both\n${JSON.stringify(
          preAndPost,
        )}`,
      );
    });

    // it('considers tags invalid when attributes whose values are expected to be quoted-strings are missing quotes', function () {
    //   const invalidId = new DateRange(invalidQuotedAttributeId);
    //   expect(invalidId.isValid).to.equal(false, 'ID is missing quotes');
    //   const invalidDate = new DateRange(invalidQuotedAttributeStartDate);
    //   expect(invalidDate.isValid).to.equal(
    //     false,
    //     'START-DATE is missing quotes',
    //   );
    // });
  });
});
