import EMEController from '../../../src/controller/eme-controller';
import HlsMock from '../../mocks/hls.mock';
import EventEmitter from 'events';
import { ErrorDetails } from '../../../src/errors';

const sinon = require('sinon');

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

describe('EMEController', function () {
  beforeEach(function () {
    setupEach();
  });

  it('should trigger key system error when bad encrypted data is received', function (done) {
    let reqMediaKsAccessSpy = sinon.spy(function () {
      return Promise.resolve({
        // Media-keys mock
      });
    });

    setupEach({
      requestMediaKeySystemAccessFunc: reqMediaKsAccessSpy,
      drmSystem: 'WIDEVINE'
    });

    let badData = {
      initDataType: 'cenc',
      initData: 'bad data'
    };

    emeController.onMediaAttached({ media });
    emeController.onManifestParsed({ levels: fakeLevels });

    media.emit('encrypted', badData);

    setTimeout(function () {
      expect(emeController.hls.trigger.args[0][1].details).to.equal(ErrorDetails.KEY_SYSTEM_NO_KEYS);
      expect(emeController.hls.trigger.args[1][1].details).to.equal(ErrorDetails.KEY_SYSTEM_NO_ACCESS);
      done();
    }, 0);
  });

  it('should retrieve PSSH data if it exists in manifest', function (done) {
    let reqMediaKsAccessSpy = sinon.spy(() => {
      return Promise.resolve({
        // Media-keys mock
      });
    });

    setupEach({
      requestMediaKeySystemAccessFunc: reqMediaKsAccessSpy,
      drmSystem: 'WIDEVINE'
    });

    const data = {
      frag: {
        foundKeys: true,
        drmInfo: [{
          format: 'urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed',
          reluri: 'data:text/plain;base64,AAAAPnBzc2gAAAAA7e+LqXnWSs6jyCfc1R0h7QAAAB4iFnNoYWthX2NlYzJmNjRhYTc4OTBhMTFI49yVmwY='
        }]
      }
    };

    emeController.onMediaAttached({ media });
    emeController.onManifestParsed({ levels: fakeLevels });
    emeController.onFragLoaded(data);

    media.emit('encrypted', {
      'initDataType': emeController._initDataType,
      'initData': emeController._initData
    });

    expect(emeController._initDataType).to.equal('cenc');
    expect(62).to.equal(emeController._initData.byteLength);

    setTimeout(() => {
      expect(emeController._isMediaEncrypted).to.equal(true);
      done();
    }, 0);
  });
});
