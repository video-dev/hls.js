import Hls from '../../src/hls';

describe('Hls', function () {
  it('should return a bandwidth estimate if the estimator exists', function () {
    const MOCKED_ESTIMATE = 2000;
    const hls = new Hls();
    hls.abrController = {
      _bwEstimator: {
        getEstimate: () => MOCKED_ESTIMATE
      }
    };
    expect(hls.bandwidthEstimate).to.equal(MOCKED_ESTIMATE);
  });

  it('should return NaN if the estimator does not exist', function () {
    const hls = new Hls();
    expect(hls.bandwidthEstimate).to.be.NaN;
  });
});
