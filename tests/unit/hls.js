import Hls from '../../src/hls';

const assert = require('assert');

describe('Hls', function () {
  it('should return a bandwidth estimate if the estimator exists', function () {
    const MOCKED_ESTIMATE = 2000;
    const hls = new Hls();
    hls.abrController = {
      _bwEstimator: {
        getEstimate: () => MOCKED_ESTIMATE
      }
    };
    assert.strictEqual(hls.bandwidthEstimate, MOCKED_ESTIMATE);
  });

  it('should return NaN if the estimator does not exist', function () {
    const hls = new Hls();
    assert.strictEqual(isNaN(hls.bandwidthEstimate), true);
  });
});
