import Hls from '../../src/hls';
import { hlsDefaultConfig } from '../../src/config';

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
});
