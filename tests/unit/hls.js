import Hls from '../../src/hls';
import { hlsDefaultConfig } from '../../src/config';
import { expect } from 'chai';

describe('Hls', function () {
  describe('bandwidthEstimate', function () {
    it('should return a bandwidth estimate', function () {
      const MOCKED_ESTIMATE = 2000;
      const hls = new Hls();
      hls.abrController = {
        bwEstimator: {
          getEstimate: () => MOCKED_ESTIMATE,
        },
      };
      expect(hls.bandwidthEstimate).to.equal(MOCKED_ESTIMATE);
    });

    it('should return a default bandwidth estimate', function () {
      const hls = new Hls();
      expect(hls.bandwidthEstimate).to.equal(
        hlsDefaultConfig.abrEwmaDefaultEstimate
      );
    });
  });

  describe('destroy', function () {
    it('should not crash on stopLoad() after destroy()', function () {
      const hls = new Hls();
      hls.destroy();
      expect(() => hls.stopLoad()).to.not.throw();
    });

    it('should not crash on startLoad() after destroy()', function () {
      const hls = new Hls();
      hls.destroy();
      expect(() => hls.startLoad()).to.not.throw();
    });
  });
});
