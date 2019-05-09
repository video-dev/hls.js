import EMEController from '../../../src/controller/eme-controller';
import HlsMock from '../../mocks/hls.mock';
import { EventEmitter } from 'eventemitter3';
import { ErrorDetails } from '../../../src/errors';

const sinon = require('sinon');

const MediaMock = function () {
  let media = new EventEmitter();
  media.addEventListener = media.addListener.bind(media);
  return media;
};

const emeConfig = {
  emeEnabled: true,
  requestMediaKeySystemAccessFunc: function (supportedConfigurations) {
    const keySystem = 'com.widevine.alpha';

    console.log(supportedConfigurations)

    return window.navigator.requestMediaKeySystemAccess(keySystem, supportedConfigurations);
  },
  getEMEInitializationDataFunc: function (levelOrAudioTrack, initDataType, initData) {
    return Promise.resolve({
      initDataType,
      initData
    });
  },
  getEMELicenseFunc: function (levelOrAudioTrack, event) {
    const licenseServerUrl = 'https://cwip-shaka-proxy.appspot.com/no_auth';

    const licenseXhr = new XMLHttpRequest();

    const licensePromise = new Promise((resolve, reject) => {
      licenseXhr.onload = function () {
        resolve(this.response);
      };

      licenseXhr.onerror = function (err) {
        if (err) {
          reject(new Error('License request failed'));
        }
      };
    });

    licenseXhr.responseType = 'arraybuffer';

    licenseXhr.open('POST', licenseServerUrl);

    licenseXhr.send(event.message);

    return licensePromise;
  }
};

let emeController;
let media;
let _initDataType;
let _initData;
let _keySessions;

const levelsMock = [{
  videoCodec: 'avc1.42c01e',
  audioCodec: 'mp4a.40.2'
}, {
  videoCodec: 'avc1.4d401f',
  audioCodec: 'mp4a.40.2'
}];

const supportedConfigurationsMock = {
  valid: [{
    audioCapabilities: [
      { contentType: 'audio/mp4; codecs="mp4a.40.2"' },
      { contentType: 'audio/mp4; codecs="mp4a.40.2"' }
    ],
    videoCapabilities: [
      { contentType: 'video/mp4; codecs="avc1.42c01e"' },
      { contentType: 'video/mp4; codecs="avc1.4d401f"' }
    ]
  }],
  invalid: [{
    audioCapabilities: [{ contentType: 'invalid' }],
    videoCapabilities: [{ contentType: 'invalid' }]
  }]
};

const requestMediaKeySystemAccessSpy = function (mockType) {
  return sinon.spy(function () {
    return Promise.resolve(emeConfig.requestMediaKeySystemAccessFunc(supportedConfigurationsMock[mockType]));
  });
};

const getEMEInitializationDataSpy = sinon.spy(function () {
  return Promise.resolve(emeConfig.getEMEInitializationDataFunc);
});

const getEMELicenseSpy = sinon.spy(function () {
  return Promise.resolve(emeConfig.getEMELicenseFunc);
});

const setupEach = function (config) {
  media = new MediaMock();

  emeController = new EMEController(new HlsMock(config));
};

describe('EMEController', function () {
  beforeEach(function () {
    setupEach();
  });

  it('should not do anything when `emeEnabled` is false (default)', function () {
    let requestMediaKeySystemAccessSpy = sinon.spy();
    let getEMEInitializationDataSpy = sinon.spy();
    let getEMELicenseSpy = sinon.spy();

    setupEach({
      requestMediaKeySystemAccessFunc: requestMediaKeySystemAccessSpy,
      getEMEInitializationDataFunc: getEMEInitializationDataSpy,
      getEMELicenseFunc: getEMELicenseSpy
    });

    emeController.onMediaAttaching({ media });

    expect(requestMediaKeySystemAccessSpy.callCount).to.equal(0);
    expect(getEMEInitializationDataSpy.callCount).to.equal(0);
    expect(getEMELicenseSpy.callCount).to.equal(0);
  });

  it('should create supportedConfigurations from level data', function () {
    setupEach({
      emeEnabled: true,
      requestMediaKeySystemAccessFunc: requestMediaKeySystemAccessSpy('valid'),
      getEMEInitializationDataFunc: getEMEInitializationDataSpy,
      getEMELicenseFunc: getEMELicenseSpy
    });

    const supportedConfigurations = emeController._getSupportedMediaKeySystemConfigurations(levelsMock);

    expect(supportedConfigurations).to.eql(supportedConfigurationsMock.valid);
  });

  it('should get MediaKeySystemAccess with valid configuration', function () {
    setupEach({
      emeEnabled: true,
      requestMediaKeySystemAccessFunc: requestMediaKeySystemAccessSpy('valid'),
      getEMEInitializationDataFunc: getEMEInitializationDataSpy,
      getEMELicenseFunc: getEMELicenseSpy
    });

    emeController.onMediaAttaching({ media });

    const supportedConfigurations = emeController._getSupportedMediaKeySystemConfigurations(levelsMock);

    return emeController._getMediaKeySystemAccess(supportedConfigurations).then((mediaKeySystemAccess) => {
      expect(mediaKeySystemAccess).to.be.an.instanceOf(MediaKeySystemAccess);
    });
  });

  // it('should trigger key system error when bad encrypted data is received', function (done) {
  //   let reqMediaKsAccessSpy = sinon.spy(function () {
  //     return Promise.resolve({
  //       // Media-keys mock
  //     });
  //   });

  //   setupEach({
  //     emeEnabled: true,
  //     requestMediaKeySystemAccessFunc: reqMediaKsAccessSpy
  //   });

  //   let badData = {
  //     initDataType: 'cenc',
  //     initData: 'bad data'
  //   };

  //   emeController.onMediaAttached({ media });
  //   emeController.onManifestParsed({ levels: fakeLevels });

  //   media.emit('encrypted', badData);

  //   setTimeout(function () {
  //     expect(emeController.hls.trigger.args[0][1].details).to.equal(ErrorDetails.KEY_SYSTEM_NO_KEYS);
  //     expect(emeController.hls.trigger.args[1][1].details).to.equal(ErrorDetails.KEY_SYSTEM_NO_ACCESS);
  //     done();
  //   }, 0);
  // });
});
