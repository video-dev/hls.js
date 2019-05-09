import EMEController from '../../../src/controller/eme-controller';
import HlsMock from '../../mocks/hls.mock';
import { ErrorDetails } from '../../../src/errors';

const sinon = require('sinon');

const MediaMock = function () {
  return document.createElement('video');
};

let emeController;
let media;
let _initDataType;
let _initData;
let _keySessions;

let keySystemMock = 'com.widevine.alpha';

const levelsMock = [{
  videoCodec: 'avc1.42c01e',
  audioCodec: 'mp4a.40.2'
}, {
  videoCodec: 'avc1.4d401f',
  audioCodec: 'mp4a.40.2'
}];

const supportedConfigurationsMock = [{
  audioCapabilities: [
    { contentType: 'audio/mp4; codecs="mp4a.40.2"' },
    { contentType: 'audio/mp4; codecs="mp4a.40.2"' }
  ],
  videoCapabilities: [
    { contentType: 'video/mp4; codecs="avc1.42c01e"' },
    { contentType: 'video/mp4; codecs="avc1.4d401f"' }
  ]
}];

const emeConfig = {
  emeEnabled: true,
  requestMediaKeySystemAccessFunc: function (supportedConfigurations) {
    return window.navigator.requestMediaKeySystemAccess(keySystemMock, supportedConfigurations);
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

const requestMediaKeySystemAccessSpy = sinon.spy(emeConfig.requestMediaKeySystemAccessFunc);

const getEMEInitializationDataSpy = sinon.spy(emeConfig.getEMEInitializationDataFunc);

const getEMELicenseSpy = sinon.spy(emeConfig.getEMELicenseFunc);

const setupEach = function (config) {
  media = new MediaMock();

  emeController = new EMEController(new HlsMock(config));
};

describe('EMEController', function () {
  beforeEach(function () {
    setupEach();
  });

  it('should not do anything when `emeEnabled` is false (default)', function () {
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

  it('should require all config functions when EME is enabled', function () {
    setupEach({
      emeEnabled: true
    });

    expect(function () {
      emeController.requestMediaKeySystemAccess;
    }).to.throw();

    expect(function () {
      emeController.getEMEInitializationData;
    }).to.throw();

    expect(function () {
      emeController.getEMELicense;
    }).to.throw();
  });

  it('should create supportedConfigurations from level data', function () {
    setupEach({
      emeEnabled: true,
      requestMediaKeySystemAccessFunc: requestMediaKeySystemAccessSpy,
      getEMEInitializationDataFunc: getEMEInitializationDataSpy,
      getEMELicenseFunc: getEMELicenseSpy
    });

    const supportedConfigurations = emeController._getSupportedMediaKeySystemConfigurations(levelsMock);

    expect(supportedConfigurations).to.eql(supportedConfigurationsMock);
  });

  it('should get MediaKeySystemAccess with valid configuration', function () {
    setupEach({
      emeEnabled: true,
      requestMediaKeySystemAccessFunc: requestMediaKeySystemAccessSpy,
      getEMEInitializationDataFunc: getEMEInitializationDataSpy,
      getEMELicenseFunc: getEMELicenseSpy
    });

    emeController.onMediaAttaching({ media });

    const supportedConfigurations = emeController._getSupportedMediaKeySystemConfigurations(levelsMock);

    return emeController._getMediaKeySystemAccess(supportedConfigurations).then((mediaKeySystemAccess) => {
      expect(mediaKeySystemAccess).to.be.an.instanceOf(MediaKeySystemAccess);
    });
  });

  it('should trigger KEY_SYSTEM_NO_ACCESS error when key system cannot be accessed', function () {
    setupEach({
      emeEnabled: true,
      requestMediaKeySystemAccessFunc: requestMediaKeySystemAccessSpy,
      getEMEInitializationDataFunc: getEMEInitializationDataSpy,
      getEMELicenseFunc: getEMELicenseSpy
    });

    emeController.onMediaAttaching({ media });

    keySystemMock = 'bad-key-system';

    return emeController._getMediaKeySystemAccess(null).catch((err) => {
      expect(err).to.equal(ErrorDetails.KEY_SYSTEM_NO_ACCESS);
    }).finally(() => {
      keySystemMock = 'com.widevine.alpha';
    });
  });

  it('should create MediaKeys', function () {
    setupEach({
      emeEnabled: true,
      requestMediaKeySystemAccessFunc: requestMediaKeySystemAccessSpy,
      getEMEInitializationDataFunc: getEMEInitializationDataSpy,
      getEMELicenseFunc: getEMELicenseSpy
    });

    emeController.onMediaAttaching({ media });

    const supportedConfigurations = emeController._getSupportedMediaKeySystemConfigurations(levelsMock);

    return emeController._getMediaKeySystemAccess(supportedConfigurations).then((mediaKeySystemAccess) => {
      return emeController._onMediaKeySystemAccessObtained(mediaKeySystemAccess);
    }).then((mediaKeys) => {
      expect(mediaKeys).to.be.an.instanceOf(MediaKeys);
    });
  });

  it('should set MediaKeys on media', function () {
    setupEach({
      emeEnabled: true,
      requestMediaKeySystemAccessFunc: requestMediaKeySystemAccessSpy,
      getEMEInitializationDataFunc: getEMEInitializationDataSpy,
      getEMELicenseFunc: getEMELicenseSpy
    });

    emeController.onMediaAttaching({ media });

    const supportedConfigurations = emeController._getSupportedMediaKeySystemConfigurations(levelsMock);

    return emeController._getMediaKeySystemAccess(supportedConfigurations).then((mediaKeySystemAccess) => {
      return emeController._onMediaKeySystemAccessObtained(mediaKeySystemAccess);
    }).then((mediaKeys) => {
      return emeController._onMediaKeysCreated(mediaKeys);
    }).then((mediaKeys) => {
      expect(mediaKeys).to.be.an.instanceOf(MediaKeys);
      expect(media.mediaKeys).to.be.an.instanceOf(MediaKeys);
    });
  });
});
