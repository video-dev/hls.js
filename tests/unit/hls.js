import Hls from '../../src/hls';

const assert = require('assert');

describe('Hls', () => {
  it('should return bandwidth estimate', () => {
    let hls = new Hls();
    assert.strictEqual(isNaN(hls.bandwidthEstimate), true);
  });
});
