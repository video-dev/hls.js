import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import { parseTimeStamp } from '../../../src/utils/vttparser';

chai.use(sinonChai);
const expect = chai.expect;

describe('VTTParser', function () {
  describe('parseTimeStamp', function () {
    function assertTimeStampValue(timestamp, value) {
      expect(parseTimeStamp(timestamp)).to.eq(
        value,
        `"${timestamp}" should equal ${value}`
      );
    }
    it('should parse fractional seconds correctly regardless of length', function () {
      assertTimeStampValue('00:00:01.5', 1.5);
      assertTimeStampValue('00:00:01.05', 1.05);
      assertTimeStampValue('00:00:01.005', 1.005);
      assertTimeStampValue('00:00:01.', 1);
    });

    it('should parse h:m:s', function () {
      assertTimeStampValue('01:01:01', 3661);
    });

    it('should parse h>59:m and h>59:m.ms', function () {
      assertTimeStampValue('60:01', 216060);
      assertTimeStampValue('60:01.55', 216060.55);
    });

    it('should parse m:s and m:s.ms', function () {
      assertTimeStampValue('01:01', 61);
      assertTimeStampValue('01:01.09', 61.09);
    });
  });
});
