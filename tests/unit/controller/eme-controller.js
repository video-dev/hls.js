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
  media.removeEventListener = media.removeListener.bind(media);
  return media;
};

const fakeLevels = [
  {
    audioCodec: 'audio/foo',
  },
  {
    videoCodec: 'video/foo',
  },
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
      requestMediaKeySystemAccessFunc: reqMediaKsAccessSpy,
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
      requestMediaKeySystemAccessFunc: reqMediaKsAccessSpy,
    });

    emeController.onMediaAttached(Events.MEDIA_ATTACHED, { media });

    expect(media.setMediaKeys.callCount).to.equal(0);
    expect(reqMediaKsAccessSpy.callCount).to.equal(0);

    emeController.onManifestParsed(Events.MANIFEST_PARSED, {
      levels: fakeLevels,
    });

    self.setTimeout(function () {
      expect(media.setMediaKeys.callCount).to.equal(0);
      expect(reqMediaKsAccessSpy.callCount).to.equal(1);
      done();
    }, 0);
  });

  it('should request keys with specified robustness options when `emeEnabled` is true', function (done) {
    const reqMediaKsAccessSpy = sinon.spy(function () {
      return Promise.resolve({
        // Media-keys mock
      });
    });

    setupEach({
      emeEnabled: true,
      drmSystemOptions: {
        audioRobustness: 'HW_SECURE_ALL',
        videoRobustness: 'HW_SECURE_ALL',
      },
      requestMediaKeySystemAccessFunc: reqMediaKsAccessSpy,
    });

    emeController.onMediaAttached(Events.MEDIA_ATTACHED, { media });

    expect(media.setMediaKeys.callCount).to.equal(0);
    expect(reqMediaKsAccessSpy.callCount).to.equal(0);

    emeController.onManifestParsed(Events.MANIFEST_PARSED, {
      levels: fakeLevels,
    });

    self.setTimeout(function () {
      expect(reqMediaKsAccessSpy.callCount).to.equal(1);
      const baseConfig = reqMediaKsAccessSpy.getCall(0).args[1][0];
      expect(baseConfig.audioCapabilities[0]).to.have.property(
        'robustness',
        'HW_SECURE_ALL'
      );
      expect(baseConfig.videoCapabilities[0]).to.have.property(
        'robustness',
        'HW_SECURE_ALL'
      );
      done();
    }, 0);
  });

  it('should trigger key system error(s) when bad encrypted data is received', function (done) {
    const reqMediaKsAccessSpy = sinon.spy(function () {
      return Promise.resolve({
        // Media-keys mock
      });
    });

    setupEach({
      emeEnabled: true,
      requestMediaKeySystemAccessFunc: reqMediaKsAccessSpy,
    });

    const badData = {
      initDataType: 'cenc',
      initData: 'bad data',
    };

    emeController.onMediaAttached(Events.MEDIA_ATTACHED, { media });
    emeController.onManifestParsed(Events.MANIFEST_PARSED, {
      levels: fakeLevels,
    });

    media.emit('encrypted', badData);

    self.setTimeout(function () {
      expect(emeController.hls.trigger).to.have.been.calledTwice;
      expect(emeController.hls.trigger.args[0][1].details).to.equal(
        ErrorDetails.KEY_SYSTEM_NO_KEYS
      );
      expect(emeController.hls.trigger.args[1][1].details).to.equal(
        ErrorDetails.KEY_SYSTEM_NO_SESSION
      );
      done();
    }, 0);
  });

  it('should close all media key sessions and remove media keys when media is detached', function (done) {
    const reqMediaKsAccessSpy = sinon.spy(function () {
      return Promise.resolve({
        // Media-keys mock
      });
    });
    const keySessionCloseSpy = sinon.spy(() => Promise.resolve());

    setupEach({
      emeEnabled: true,
      requestMediaKeySystemAccessFunc: reqMediaKsAccessSpy,
    });

    emeController.onMediaAttached(Events.MEDIA_ATTACHED, { media });
    emeController._mediaKeysList = [
      {
        mediaKeysSession: {
          close: keySessionCloseSpy,
        },
      },
    ];
    emeController.onMediaDetached(Events.MEDIA_DETACHED);

    self.setTimeout(function () {
      expect(keySessionCloseSpy.callCount).to.equal(1);
      expect(emeController._mediaKeysList.length).to.equal(0);
      expect(media.setMediaKeys.calledWith(null)).to.be.true;
      done();
    }, 0);
  });
});
