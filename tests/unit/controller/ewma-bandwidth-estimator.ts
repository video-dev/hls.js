import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import EwmaBandWidthEstimator from '../../../src/utils/ewma-bandwidth-estimator';

chai.use(sinonChai);
const expect = chai.expect;

describe('EwmaBandWidthEstimator', function () {
  it('returns default estimate if bw estimator not available yet', function () {
    const defaultEstimate = 5e5;
    const bwEstimator = new EwmaBandWidthEstimator(0, 0, defaultEstimate);
    expect(bwEstimator.getEstimate()).to.equal(5e5);
  });

  it('returns last bitrate is fast=slow=0', function () {
    const defaultEstimate = 5e5;
    const bwEstimator = new EwmaBandWidthEstimator(0, 0, defaultEstimate);
    bwEstimator.sample(8000, 1000000);
    expect(bwEstimator.getEstimate()).to.equal(1000000);
    bwEstimator.sample(4000, 1000000);
    expect(bwEstimator.getEstimate()).to.equal(2000000);
    bwEstimator.sample(1000, 1000000);
    expect(bwEstimator.getEstimate()).to.equal(8000000);
  });

  it('returns correct value bitrate is slow=15,fast=4', function () {
    const defaultEstimate = 5e5;
    const bwEstimator = new EwmaBandWidthEstimator(15, 4, defaultEstimate);
    bwEstimator.sample(8000, 1000000);
    expect(bwEstimator.getEstimate()).to.equal(1000000);
    bwEstimator.sample(4000, 1000000);
    expect(bwEstimator.getEstimate()).to.closeTo(
      1511550.3977404737,
      0.000000001
    );
    bwEstimator.sample(1000, 1000000);
    expect(bwEstimator.getEstimate()).to.closeTo(
      3775044.041335162,
      0.000000001
    );
  });

  it('returns correct value bitrate is slow=9,fast=5', function () {
    const defaultEstimate = 5e5;
    const bwEstimator = new EwmaBandWidthEstimator(9, 5, defaultEstimate);
    bwEstimator.sample(8000, 1000000);
    expect(bwEstimator.getEstimate()).to.equal(1000000);
    bwEstimator.sample(4000, 1000000);
    expect(bwEstimator.getEstimate()).to.closeTo(
      1519244.5768252169,
      0.000000001
    );
    bwEstimator.sample(1000, 1000000);
    expect(bwEstimator.getEstimate()).to.closeTo(
      3847839.2697109017,
      0.000000001
    );
  });
});
