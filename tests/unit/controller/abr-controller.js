const assert = require('assert');

import AbrController from '../../../src/controller/abr-controller';
import EwmaBandWidthEstimator from '../../../src/utils/ewma-bandwidth-estimator';
import Hls from '../../../src/hls';

describe('AbrController', () => {
  it('should return correct next auto level', () => {
    let hls = new Hls({ maxStarvationDelay: 4 });
    hls.levelController._levels = [
      { bitrate: 105000, name: '144', details: { totalduration: 4, fragments: [{}] } },
      { bitrate: 246440, name: '240', details: { totalduration: 10, fragments: [ {} ] } },
      { bitrate: 460560, name: '380', details: { totalduration: 10, fragments: [ {} ] } },
      { bitrate: 836280, name: '480', details: { totalduration: 10, fragments: [ {} ] } },
      { bitrate: 2149280, name: '720', details: { totalduration: 10, fragments: [ {} ] } },
      { bitrate: 6221600, name: '1080', details: { totalduration: 10, fragments: [ {} ] } }
    ];
    let abrController = new AbrController(hls);
    abrController.bwEstimator = new EwmaBandWidthEstimator(hls, 15, 4, 5e5);
    assert.equal(abrController.nextAutoLevel, 0);
  });
});
