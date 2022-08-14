import { initPTSFn } from '../../../src/demux/base-audio-demuxer';
import { expect } from 'chai';

describe('BaseAudioDemuxer', function () {
  describe('initPTSFn', function () {
    it('should use the timestamp if it is valid', function () {
      expect(initPTSFn(1, 1, 0)).to.be.eq(90);
      expect(initPTSFn(5, 1, 0)).to.be.eq(450);
      expect(initPTSFn(0, 1, 0)).to.be.eq(0);
    });
    it('should use the timeOffset if timestamp is undefined or not finite', function () {
      expect(initPTSFn(undefined, 1, 0)).to.be.eq(90000);
      expect(initPTSFn(NaN, 1, 0)).to.be.eq(90000);
      expect(initPTSFn(Infinity, 1, 0)).to.be.eq(90000);
    });
    it('should add initPTS to timeOffset when timestamp is undefined or not finite', function () {
      expect(initPTSFn(undefined, 1, 42)).to.be.eq(90042);
      expect(initPTSFn(NaN, 1, 42)).to.be.eq(90042);
    });
  });
});
