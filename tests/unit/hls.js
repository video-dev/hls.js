import Hls from '../../src/hls';

const assert = require('assert');

describe('Hls', () => {
  it('should return a bandwidth estimate if the estimator exists', () => {
    const MOCKED_ESTIMATE = 2000;
    const hls = new Hls();
    hls.abrController = {
      _bwEstimator: {
        getEstimate: () => MOCKED_ESTIMATE
      }
    };
    assert.strictEqual(hls.bandwidthEstimate, MOCKED_ESTIMATE);
  });

  it('should return NaN if the estimator does not exist', () => {
    const hls = new Hls();
    assert.strictEqual(isNaN(hls.bandwidthEstimate), true);
  });
});
