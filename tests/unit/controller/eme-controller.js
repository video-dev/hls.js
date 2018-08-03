import EMEController from '../../../src/controller/eme-controller';
import HlsMock from '../../mocks/hls.mock';
import EventEmitter from 'events';
import { ErrorTypes, ErrorDetails } from '../../../src/errors';

const sinon = require('sinon');

import assert from 'assert';

const MediaMock = function () {
  let media = new EventEmitter();
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

    emeController.onMediaAttached({ media });
    emeController.onManifestParsed({ media });

    media.setMediaKeys.callCount.should.be.equal(0);
    reqMediaKsAccessSpy.callCount.should.be.equal(0);
  });

  it('should request keys when `emeEnabled` is true (but not set them)', (done) => {
    let reqMediaKsAccessSpy = sinon.spy(() => {
      return Promise.resolve({
        // Media-keys mock
      });
    });

    setupEach({
      emeEnabled: true,
      requestMediaKeySystemAccessFunc: reqMediaKsAccessSpy
    });

    emeController.onMediaAttached({ media });

    media.setMediaKeys.callCount.should.be.equal(0);
    reqMediaKsAccessSpy.callCount.should.be.equal(0);

    emeController.onManifestParsed({ levels: fakeLevels });

    setTimeout(() => {
      media.setMediaKeys.callCount.should.be.equal(0);
      reqMediaKsAccessSpy.callCount.should.be.equal(1);
      done();
    }, 0);
  });

  it('should trigger key system error when bad encrypted data is received', (done) => {
    let reqMediaKsAccessSpy = sinon.spy(() => {
      return Promise.resolve({
        // Media-keys mock
      });
    });

    setupEach({
      emeEnabled: true,
      requestMediaKeySystemAccessFunc: reqMediaKsAccessSpy
    });

    let badData = {
      initDataType: 'cenc',
      initData: 'bad data'
    };

    emeController.onMediaAttached({ media });
    emeController.onManifestParsed({ levels: fakeLevels });

    media.emit('encrypted', badData);

    setTimeout(() => {
      assert.equal(emeController.hls.trigger.args[0][1].details, ErrorDetails.KEY_SYSTEM_NO_KEYS);
      assert.equal(emeController.hls.trigger.args[1][1].details, ErrorDetails.KEY_SYSTEM_NO_ACCESS);
      done();
    }, 0);
  });
});
