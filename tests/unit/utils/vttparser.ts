import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { parseTimeStamp } from '../../../src/utils/vttparser';
import { parseWebVTT } from '../../../src/utils/webvtt-parser';
import type { VTTCCs } from '../../../src/types/vtt';

chai.use(sinonChai);
const expect = chai.expect;

describe('VTTParser', function () {
  describe('parseTimeStamp', function () {
    function assertTimeStampValue(timestamp, value) {
      expect(parseTimeStamp(timestamp)).to.eq(
        value,
        `"${timestamp}" should equal ${value}`,
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

describe('parseWebVTT', function () {
  function toArrayBuffer(str: string): ArrayBuffer {
    return new TextEncoder().encode(str).buffer;
  }

  describe('WebVTT with X-TIMESTAMP-MAP across discontinuities', function () {
    // Subtitle playlist has 3 discontinuity sequences:
    //   cc=0: preroll1, 31.135s duration
    //   cc=1: preroll2, 31.086s duration
    //   cc=2: main content, starts at 62.221s on presentation timeline
    const initPTS = { baseTime: 900000, timescale: 90000, trackId: 0 };

    const preroll1Vtt = `WEBVTT
X-TIMESTAMP-MAP=MPEGTS:900000,LOCAL:00:00:00.000

1
00:00:01.668 --> 00:00:03.961
preroll1
`;
    const preroll2Vtt = `WEBVTT
X-TIMESTAMP-MAP=MPEGTS:900000,LOCAL:00:00:00.000

1
00:00:03.879 --> 00:00:05.547
preroll2
`;
    const mainContentVtt = `WEBVTT
X-TIMESTAMP-MAP=MPEGTS:900000,LOCAL:00:00:00.000

1
00:00:09.426 --> 00:00:11.345
main content
`;

    it('should map cues correctly for cc=0 (first discontinuity, preroll1)', function () {
      const cc = 0;
      const vttCCs: VTTCCs = {
        ccOffset: 0,
        presentationOffset: 0,
        0: { start: 0, prevCC: -1, new: true },
      };
      const parsedCallback = sinon.spy();
      const errorCallback = sinon.spy();

      parseWebVTT(
        toArrayBuffer(preroll1Vtt),
        initPTS,
        vttCCs,
        cc,
        0,
        parsedCallback,
        errorCallback,
      );

      expect(errorCallback).to.not.have.been.called;
      expect(parsedCallback).to.have.been.calledOnce;
      const cues = parsedCallback.getCall(0).firstArg;
      expect(cues).to.have.lengthOf(1);
      expect(cues[0].startTime).to.be.closeTo(1.668, 0.001);
      expect(cues[0].endTime).to.be.closeTo(3.961, 0.001);
    });

    it('should map cues correctly for cc=1 (second discontinuity, preroll2)', function () {
      const cc = 1;
      const fragStart = 31.135;
      const vttCCs: VTTCCs = {
        ccOffset: 0,
        presentationOffset: 0,
        0: { start: 0, prevCC: -1, new: false },
        1: { start: fragStart, prevCC: 0, new: true },
      };
      const parsedCallback = sinon.spy();
      const errorCallback = sinon.spy();

      parseWebVTT(
        toArrayBuffer(preroll2Vtt),
        initPTS,
        vttCCs,
        cc,
        fragStart,
        parsedCallback,
        errorCallback,
      );

      expect(errorCallback).to.not.have.been.called;
      expect(parsedCallback).to.have.been.calledOnce;
      const cues = parsedCallback.getCall(0).firstArg;
      expect(cues).to.have.lengthOf(1);
      // cueOffset = currCC.start = 31.135; startTime = 3.879 + 31.135 = 35.014
      expect(cues[0].startTime).to.be.closeTo(35.014, 0.001);
      expect(cues[0].endTime).to.be.closeTo(36.682, 0.001);
    });

    it('should map cues correctly for cc=2 (main content after prerolls)', function () {
      const cc = 2;
      const fragStart = 62.221;
      const vttCCs: VTTCCs = {
        ccOffset: 0,
        presentationOffset: 0,
        0: { start: 0, prevCC: -1, new: false },
        1: { start: 31.135, prevCC: 0, new: false },
        2: { start: fragStart, prevCC: 1, new: true },
      };
      const parsedCallback = sinon.spy();
      const errorCallback = sinon.spy();

      parseWebVTT(
        toArrayBuffer(mainContentVtt),
        initPTS,
        vttCCs,
        cc,
        fragStart,
        parsedCallback,
        errorCallback,
      );

      expect(errorCallback).to.not.have.been.called;
      expect(parsedCallback).to.have.been.calledOnce;
      const cues = parsedCallback.getCall(0).firstArg;
      expect(cues).to.have.lengthOf(1);
      // cueOffset = currCC.start = 62.221; startTime = 9.426 + 62.221 = 71.647
      expect(cues[0].startTime).to.be.closeTo(71.647, 0.001);
      expect(cues[0].endTime).to.be.closeTo(73.566, 0.001);
    });
  });

  describe('WebVTT segments without X-TIMESTAMP-MAP must assume cue times map to media timestamps (#7850)', function () {
    const vttContent = `WEBVTT

1
00:22:16.000 --> 00:22:19.000
Hello after ad
`;
    const cc = 4;
    const fragStart = 1335.066;

    function makeVTTCCs(): VTTCCs {
      return {
        ccOffset: 0,
        presentationOffset: 0,
        0: { start: 0, prevCC: -1, new: false },
        [cc]: { start: fragStart, prevCC: 3, new: true },
      };
    }

    it('should not parse WEBVTT without X-TIMESTAMP-MAP when initPTS is undefined', function () {
      const parsedCallback = sinon.spy();
      const errorCallback = sinon.spy();

      parseWebVTT(
        toArrayBuffer(vttContent),
        undefined,
        makeVTTCCs(),
        cc,
        fragStart,
        parsedCallback,
        errorCallback,
      );

      expect(parsedCallback, 'parsing callback should be deferred').to.not.have
        .been.called;
      expect(errorCallback, 'error until initPTS is known').to.have.been
        .calledOnce;
      const error = errorCallback.getCall(0).firstArg;
      expect(error)
        .to.have.property('message')
        .that.eqls('Missing initPTS for VTT without X-TIMESTAMP-MAP');
    });

    it('should produce correct cue timing when initPTS is available', function () {
      const initPTS = { baseTime: 10000, timescale: 1000, trackId: 0 };
      const parsedCallback = sinon.spy();
      const errorCallback = sinon.spy();

      parseWebVTT(
        toArrayBuffer(vttContent),
        initPTS,
        makeVTTCCs(),
        cc,
        fragStart,
        parsedCallback,
        errorCallback,
      );

      expect(errorCallback, 'parsed without error').to.not.have.been.called;
      expect(parsedCallback, 'parsed cue').to.have.been.calledOnce;
      const cues = parsedCallback.getCall(0).firstArg;
      expect(cues).to.have.lengthOf(1);
      const mediaTimestamp = initPTS.baseTime / initPTS.timescale;
      expect(cues[0].startTime).to.be.closeTo(fragStart - mediaTimestamp, 1);
      expect(cues[0].endTime).to.be.closeTo(fragStart + 3 - mediaTimestamp, 1);
    });
  });
});
