import { expect } from 'chai';
import { initPTSFn } from '../../../src/demux/audio/base-audio-demuxer';

describe('BaseAudioDemuxer', function () {
  describe('initPTSFn', function () {
    it('should use the timestamp if it is valid', function () {
      expect(initPTSFn(1, 1, { baseTime: 0, timescale: 1 })).to.be.eq(90);
      expect(initPTSFn(5, 1, { baseTime: 0, timescale: 1 })).to.be.eq(450);
      expect(initPTSFn(0, 1, { baseTime: 0, timescale: 1 })).to.be.eq(0);
    });
    it('should use the timeOffset if timestamp is undefined or not finite', function () {
      expect(initPTSFn(undefined, 1, { baseTime: 0, timescale: 1 })).to.be.eq(
        90000,
      );
      expect(initPTSFn(NaN, 1, { baseTime: 0, timescale: 1 })).to.be.eq(90000);
      expect(initPTSFn(Infinity, 1, { baseTime: 0, timescale: 1 })).to.be.eq(
        90000,
      );
    });
    it('should add initPTS to timeOffset when timestamp is undefined or not finite', function () {
      expect(
        initPTSFn(undefined, 1, { baseTime: 42, timescale: 90000 }),
      ).to.be.eq(90042);
      expect(initPTSFn(NaN, 1, { baseTime: 42, timescale: 90000 })).to.be.eq(
        90042,
      );
    });
  });
});
