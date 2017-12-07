import EMEController from '../../../src/controller/eme-controller';

import HlsMock from '../../mocks/hls.mock';

const MediaMock = function() {
  return {
    setMediaKeys: sinon.spy(),
    addEventListener: sinon.spy()
  }
};

const fakeLevels = [
  {
    audioCodec: 'audio/foo'
  },
  {
    videoCoded: 'video/foo'
  }
];

let emeController;
let media;

const setupEach = function(config) {
  media = new MediaMock();

  emeController = new EMEController(new HlsMock(config));
}

describe('EMEController', () => {

  beforeEach(() => {
    setupEach();
  });

  it('should be constructable with an unconfigured Hls.js instance', () => {});

  it('should not do anything when `emeEnabled` is false (default)', () => {

    let reqMediaKsAccessSpy = sinon.spy();

    setupEach({
      requestMediaKeySystemAccessFunc: reqMediaKsAccessSpy
    });

    emeController.onMediaAttached({media});
    emeController.onManifestParsed({media});

    media.setMediaKeys.callCount.should.be.equal(0);
    reqMediaKsAccessSpy.callCount.should.be.equal(0);
  });

  it('should request keys when `emeEnabled` is true (but not set them)', (done) => {

      let reqMediaKsAccessSpy = sinon.spy(() => {
        return Promise.resolve({
          // Media-keys mock
        })
      });

      setupEach({
        emeEnabled: true,
        requestMediaKeySystemAccessFunc: reqMediaKsAccessSpy
      });

      emeController.onMediaAttached({media});

      media.setMediaKeys.callCount.should.be.equal(0);
      reqMediaKsAccessSpy.callCount.should.be.equal(0);

      emeController.onManifestParsed({levels: fakeLevels});

      setTimeout(() => {
        media.setMediaKeys.callCount.should.be.equal(0);
        reqMediaKsAccessSpy.callCount.should.be.equal(1);
        done();
      }, 0)

  });
})
