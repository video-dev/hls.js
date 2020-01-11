import EMEController from '../../../src/controller/eme-controller';
import HlsMock from '../../mocks/hls.mock';
import { EventEmitter } from 'eventemitter3';
import { ErrorDetails } from '../../../src/errors';
import { Events } from '../../../src/events';

const sinon = require('sinon');

const MediaMock = function () {
  const media = new EventEmitter();
  media.setMediaKeys = sinon.spy();
  media.addEventListener = media.addListener.bind(media);
  return media;
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

const setupEach = function (config) {
  media = new MediaMock();

  emeController = new EMEController(new HlsMock(config));
};

describe('EMEController', function () {
  beforeEach(function () {
    setupEach();
  });

  it('should not do anything when `emeEnabled` is false (default)', function () {
    const reqMediaKsAccessSpy = sinon.spy();

    setupEach({
      requestMediaKeySystemAccessFunc: reqMediaKsAccessSpy
    });

    emeController.onMediaAttached(Events.MEDIA_ATTACHED, { media });
    emeController.onManifestParsed(Events.MANIFEST_PARSED, { media });

    expect(media.setMediaKeys.callCount).to.equal(0);
    expect(reqMediaKsAccessSpy.callCount).to.equal(0);
  });

  it('should request keys when `emeEnabled` is true (but not set them)', function (done) {
    const reqMediaKsAccessSpy = sinon.spy(function () {
      return Promise.resolve({
        // Media-keys mock
      });
    });

    setupEach({
      emeEnabled: true,
      requestMediaKeySystemAccessFunc: reqMediaKsAccessSpy
    });

    emeController.onMediaAttached(Events.MEDIA_ATTACHED, { media });

    expect(media.setMediaKeys.callCount).to.equal(0);
    expect(reqMediaKsAccessSpy.callCount).to.equal(0);

    emeController.onManifestParsed(Events.MANIFEST_PARSED, { levels: fakeLevels });

    self.setTimeout(function () {
      expect(media.setMediaKeys.callCount).to.equal(0);
      expect(reqMediaKsAccessSpy.callCount).to.equal(1);
      done();
    }, 0);
  });

  it('should emit key system error when bad encrypted data is received', function (done) {
    const reqMediaKsAccessSpy = sinon.spy(function () {
      return Promise.resolve({
        // Media-keys mock
      });
    });

    setupEach({
      emeEnabled: true,
      requestMediaKeySystemAccessFunc: reqMediaKsAccessSpy
    });

    const badData = {
      initDataType: 'cenc',
      initData: 'bad data'
    };

    emeController.onMediaAttached(Events.MEDIA_ATTACHED, { media });
    emeController.onManifestParsed(Events.MANIFEST_PARSED, { levels: fakeLevels });

    media.emit('encrypted', badData);

    self.setTimeout(function () {
      expect(emeController.hls.trigger.args[0][1].details).to.equal(ErrorDetails.KEY_SYSTEM_NO_KEYS);
      expect(emeController.hls.trigger.args[1][1].details).to.equal(ErrorDetails.KEY_SYSTEM_NO_ACCESS);
      done();
    }, 0);
  });
});
