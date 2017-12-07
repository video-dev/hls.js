import EMEController from '../../../src/controller/eme-controller';

import HlsMock from '../../mocks/hls.mock';

describe.only('EMEController', () => {
  it('should be constructable with an unconfigured Hls.js instance', () => {

    new EMEController(new HlsMock());

  });
})
