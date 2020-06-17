import { initPTSFn } from '../../../src/demux/base-audio-demuxer';
import { expect } from 'chai';

describe('BaseAudioDemuxer', function () {
  describe('initPTSFn', function () {
    it('should use the timestamp if it is valid', function (done) {
      expect(initPTSFn(1, -1)).to.be.above(0);
      expect(initPTSFn(5, -1)).to.be.above(0);
      expect(initPTSFn(0, -1)).to.be.eq(0);

      done();
    });
    it('should use the timeOffset if timestamp is undefined or not finite', function (done) {
      expect(initPTSFn(undefined, -1)).to.be.below(0);
      expect(initPTSFn(NaN, -1)).to.be.below(0);
      expect(initPTSFn(Infinity, -1)).to.be.below(0);

      done();
    });
  });
});
