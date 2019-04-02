/*
 * EWMA Bandwidth Estimator
 *  - heavily inspired from shaka-player
 * Tracks bandwidth samples and estimates available bandwidth.
 * Based on the minimum of two exponentially-weighted moving averages with
 * different half-lives.
 */

import EWMA from '../utils/ewma';

class EwmaBandWidthEstimator {
  constructor (hls, slow, fast, defaultEstimate) {
    this.hls = hls;
    this.defaultEstimate_ = defaultEstimate;
    this.minWeight_ = 0.001;
    this.minDelayMs_ = 50;
    this.slow_ = new EWMA(slow);
    this.fast_ = new EWMA(fast);
  }

  sample (durationMs, numBytes) {
    durationMs = Math.max(durationMs, this.minDelayMs_);
    let numBits = 8 * numBytes,
      // weight is duration in seconds
      durationS = durationMs / 1000,
      // value is bandwidth in bits/s
      bandwidthInBps = numBits / durationS;
    this.fast_.sample(durationS, bandwidthInBps);
    this.slow_.sample(durationS, bandwidthInBps);
  }

  canEstimate () {
    let fast = this.fast_;
    return (fast && fast.getTotalWeight() >= this.minWeight_);
  }

  getEstimate () {
    if (this.canEstimate()) {
      // console.log('slow estimate:'+ Math.round(this.slow_.getEstimate()));
      // console.log('fast estimate:'+ Math.round(this.fast_.getEstimate()));
      // Take the minimum of these two estimates.  This should have the effect of
      // adapting down quickly, but up more slowly.
      return Math.min(this.fast_.getEstimate(), this.slow_.getEstimate());
    } else {
      return this.defaultEstimate_;
    }
  }

  destroy () {
  }
}
export default EwmaBandWidthEstimator;
