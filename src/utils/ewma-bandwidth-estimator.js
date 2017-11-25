/*
 * EWMA Bandwidth Estimator
 *  - heavily inspired from shaka-player
 * Tracks bandwidth samples and estimates available bandwidth.
 * Based on the minimum of two exponentially-weighted moving averages with
 * different half-lives.
 */

import EWMA from '../utils/ewma';


class EwmaBandWidthEstimator {

  constructor(hls,slow,fast,defaultEstimate) {
    this._hls = hls;
    this._defaultEstimate = defaultEstimate;
    this._minWeight = 0.001;
    this._minDelayMs = 50;
    this._slow = new EWMA(slow);
    this._fast = new EWMA(fast);
  }

  sample(durationMs,numBytes) {
    durationMs = Math.max(durationMs, this._minDelayMs);
    var bandwidth = 8000* numBytes / durationMs,
    //console.log('instant bw:'+ Math.round(bandwidth));
    // we weight sample using loading duration....
        weight = durationMs / 1000;
    this._fast.sample(weight,bandwidth);
    this._slow.sample(weight,bandwidth);
  }

  canEstimate() {
    let fast = this._fast;
    return (fast && fast.getTotalWeight() >= this._minWeight);
  }


  getEstimate() {
    if (this.canEstimate()) {
      //console.log('slow estimate:'+ Math.round(this._slow.getEstimate()));
      //console.log('fast estimate:'+ Math.round(this._fast.getEstimate()));
      // Take the minimum of these two estimates.  This should have the effect of
      // adapting down quickly, but up more slowly.
      return Math.min(this._fast.getEstimate(),this._slow.getEstimate());
    } else {
      return this._defaultEstimate;
    }
  }

  destroy() {
  }
}
export default EwmaBandWidthEstimator;

