/*
 * compute an Exponential Weighted moving average
 * - https://en.wikipedia.org/wiki/Moving_average#Exponential_moving_average
 *  - heavily inspired from shaka-player
 */

class EWMA {

 //  About half of the estimated value will be from the last |halfLife| samples by weight.
  constructor(halfLife) {
    // Larger values of alpha expire historical data more slowly.
    this._alpha = halfLife ? Math.exp(Math.log(0.5) / halfLife) : 0;
    this._estimate = 0;
    this._totalWeight = 0;
  }

  sample(weight,value) {
    var adjAlpha = Math.pow(this._alpha, weight);
    this._estimate = value * (1 - adjAlpha) + adjAlpha * this._estimate;
    this._totalWeight += weight;
  }

  getTotalWeight() {
    return this._totalWeight;
  }

  getEstimate() {
    if (this._alpha) {
      var zeroFactor = 1 - Math.pow(this._alpha, this._totalWeight);
      return this._estimate / zeroFactor;
    } else {
      return this._estimate;
    }
  }
}

export default EWMA;
