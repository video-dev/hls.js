import AbrController from '../../../src/controller/abr-controller';
import EwmaBandWidthEstimator from '../../../src/utils/ewma-bandwidth-estimator';
import Hls from '../../../src/hls';

describe('AbrController', function () {
  it('should return correct next auto level', function () {
    const hls = new Hls({ maxStarvationDelay: 4 });
    hls.levelController._levels = [
      {
        bitrate: 105000,
        name: '144',
        details: { totalduration: 4, fragments: [{}] },
      },
      {
        bitrate: 246440,
        name: '240',
        details: { totalduration: 10, fragments: [{}] },
      },
      {
        bitrate: 460560,
        name: '380',
        details: { totalduration: 10, fragments: [{}] },
      },
      {
        bitrate: 836280,
        name: '480',
        details: { totalduration: 10, fragments: [{}] },
      },
      {
        bitrate: 2149280,
        name: '720',
        details: { totalduration: 10, fragments: [{}] },
      },
      {
        bitrate: 6221600,
        name: '1080',
        details: { totalduration: 10, fragments: [{}] },
      },
    ];
    const abrController = new AbrController(hls);
    abrController.bwEstimator = new EwmaBandWidthEstimator(hls, 15, 4, 5e5);
    expect(abrController.nextAutoLevel).to.equal(0);
  });
});
