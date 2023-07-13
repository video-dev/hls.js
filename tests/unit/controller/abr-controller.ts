import AbrController from '../../../src/controller/abr-controller';
import EwmaBandWidthEstimator from '../../../src/utils/ewma-bandwidth-estimator';
import Hls from '../../../src/hls';

import chai from 'chai';
import sinonChai from 'sinon-chai';

chai.use(sinonChai);
const expect = chai.expect;

describe('AbrController', function () {
  it('can be reset with new BWE', function () {
    const hls = new Hls({ maxStarvationDelay: 4 });
    const abrController = new AbrController(hls);
    abrController.bwEstimator = new EwmaBandWidthEstimator(15, 4, 5e5, 100);
    expect(abrController.bwEstimator.getEstimate()).to.equal(5e5);
    abrController.resetEstimator(5e6);
    expect(abrController.bwEstimator.getEstimate()).to.equal(5e6);
  });

  it('should return correct next auto level', function () {
    const hls = new Hls({ maxStarvationDelay: 4 });
    (hls as any).levelController._levels = [
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
    abrController.bwEstimator = new EwmaBandWidthEstimator(15, 4, 5e5, 100);
    expect(abrController.nextAutoLevel).to.equal(0);
  });
});
