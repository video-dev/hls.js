const assert = require('assert');

import EwmaBandWidthEstimator from '../../../src/utils/ewma-bandwidth-estimator';
import Hls from '../../../src/hls';

describe('EwmaBandWidthEstimator', () => {
  it('returns default estimate if bw estimator not available yet', () => {
    let defaultEstimate = 5e5;
    let bwEstimator = new EwmaBandWidthEstimator(new Hls(), 0, 0, defaultEstimate);
    assert.equal(bwEstimator.getEstimate(), 5e5);
  });

  it('returns last bitrate is fast=slow=0', () => {
    let defaultEstimate = 5e5;
    let bwEstimator = new EwmaBandWidthEstimator(new Hls(), 0, 0, defaultEstimate);
    bwEstimator.sample(8000, 1000000);
    assert.equal(bwEstimator.getEstimate(), 1000000);
    bwEstimator.sample(4000, 1000000);
    assert.equal(bwEstimator.getEstimate(), 2000000);
    bwEstimator.sample(1000, 1000000);
    assert.equal(bwEstimator.getEstimate(), 8000000);
  });

  it('returns correct value bitrate is slow=15,fast=4', () => {
    let defaultEstimate = 5e5;
    let bwEstimator = new EwmaBandWidthEstimator(new Hls(), 15, 4, defaultEstimate);
    bwEstimator.sample(8000, 1000000);
    assert.equal(bwEstimator.getEstimate(), 1000000);
    bwEstimator.sample(4000, 1000000);
    assert.equal(Math.round(bwEstimator.getEstimate()), 1396480);
    bwEstimator.sample(1000, 1000000);
    assert.equal(Math.round(bwEstimator.getEstimate()), 2056827);
  });

  it('returns correct value bitrate is slow=9,fast=5', () => {
    let defaultEstimate = 5e5;
    let bwEstimator = new EwmaBandWidthEstimator(new Hls(), 9, 5, defaultEstimate);
    bwEstimator.sample(8000, 1000000);
    assert.equal(bwEstimator.getEstimate(), 1000000);
    bwEstimator.sample(4000, 1000000);
    assert.equal(Math.round(bwEstimator.getEstimate()), 1439580);
    bwEstimator.sample(1000, 1000000);
    assert.equal(Math.round(bwEstimator.getEstimate()), 2208342);
  });
});
