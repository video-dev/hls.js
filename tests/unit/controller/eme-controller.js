import Hls from '../../../src/hls';
import { ErrorDetails } from '../../../src/errors';
import HlsEvents from '../../../src/events';

const sinon = require('sinon');

const MediaMock = function () {
  return document.createElement('video');
};

let hls;
let emeController;
let media;

let keySystemMock = 'com.widevine.alpha';
let licenseServerUrlMock = 'https://cwip-shaka-proxy.appspot.com/no_auth';

const manifestDataMock = {
  levels: [{
    videoCodec: 'avc1.42c01e',
    audioCodec: 'mp4a.40.2'
  }, {
    videoCodec: 'avc1.4d401f',
    audioCodec: 'mp4a.40.2'
  }],
  audioTracks: [{
    name: 'stream_0',
    audioCodec: 'mp4a.40.2'
  }, {
    name: 'stream_1',
    audioCodec: 'mp4a.40.2'
  }, {
    name: 'stream_2',
    audioCodec: 'mp4a.40.2'
  }]
};

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
    const licenseServerUrl = licenseServerUrlMock;

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
  hls = new Hls(config);

  emeController = hls.emeController;

  media = new MediaMock();

  hls.attachMedia(media);
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

    emeController.manifestData = manifestDataMock;

    const supportedConfigurations = emeController._getSupportedMediaKeySystemConfigurations(emeController.manifestData.levels);

    expect(supportedConfigurations).to.eql(supportedConfigurationsMock);
  });

  it('should get MediaKeySystemAccess with valid configuration', function () {
    setupEach({
      emeEnabled: true,
      requestMediaKeySystemAccessFunc: requestMediaKeySystemAccessSpy,
      getEMEInitializationDataFunc: getEMEInitializationDataSpy,
      getEMELicenseFunc: getEMELicenseSpy
    });

    emeController.manifestData = manifestDataMock;

    const supportedConfigurations = emeController._getSupportedMediaKeySystemConfigurations(emeController.manifestData.levels);

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

    emeController.manifestData = manifestDataMock;

    const supportedConfigurations = emeController._getSupportedMediaKeySystemConfigurations(emeController.manifestData.levels);

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

    emeController.manifestData = manifestDataMock;

    const supportedConfigurations = emeController._getSupportedMediaKeySystemConfigurations(emeController.manifestData.levels);

    return emeController._getMediaKeySystemAccess(supportedConfigurations).then((mediaKeySystemAccess) => {
      return emeController._onMediaKeySystemAccessObtained(mediaKeySystemAccess);
    }).then((mediaKeys) => {
      return emeController._onMediaKeysCreated(mediaKeys);
    }).then((mediaKeys) => {
      expect(media.mediaKeys).to.be.an.instanceOf(MediaKeys);
    });
  });

  it('should create MediaKeySessions for each level and audio track', function () {
    setupEach({
      emeEnabled: true,
      requestMediaKeySystemAccessFunc: requestMediaKeySystemAccessSpy,
      getEMEInitializationDataFunc: getEMEInitializationDataSpy,
      getEMELicenseFunc: getEMELicenseSpy
    });

    emeController.onMediaAttaching({ media });

    emeController.manifestData = manifestDataMock;

    const supportedConfigurations = emeController._getSupportedMediaKeySystemConfigurations(emeController.manifestData.levels);

    return emeController._getMediaKeySystemAccess(supportedConfigurations).then((mediaKeySystemAccess) => {
      return emeController._onMediaKeySystemAccessObtained(mediaKeySystemAccess);
    }).then((mediaKeys) => {
      return emeController._onMediaKeysCreated(mediaKeys);
    }).then((mediaKeys) => {
      const levelRequests = emeController.manifestData.levels.map((level) => {
        return emeController._onMediaKeysSet(mediaKeys, level);
      });

      const audioRequests = emeController.manifestData.audioTracks.map((audioTrack) => {
        return emeController._onMediaKeysSet(mediaKeys, audioTrack);
      });

      const keySessionRequests = levelRequests.concat(audioRequests);

      return Promise.all(keySessionRequests);
    }).then((keySessionResponses) => {
      expect(keySessionResponses.length).to.equal(emeController.manifestData.levels.length + emeController.manifestData.audioTracks.length);

      keySessionResponses.forEach((keySessionResponse, index) => {
        expect(keySessionResponse.keySession).to.be.an.instanceOf(MediaKeySession);
      });
    });
  });

  it('should trigger KEY_SYSTEM_GENERATE_REQUEST_FAILED error when generating a license request fails', function () {
    setupEach({
      emeEnabled: true,
      requestMediaKeySystemAccessFunc: requestMediaKeySystemAccessSpy,
      getEMEInitializationDataFunc: getEMEInitializationDataSpy,
      getEMELicenseFunc: getEMELicenseSpy
    });

    emeController.onMediaAttaching({ media });

    emeController.manifestData = manifestDataMock;

    const supportedConfigurations = emeController._getSupportedMediaKeySystemConfigurations(emeController.manifestData.levels);

    return emeController._getMediaKeySystemAccess(supportedConfigurations).then((mediaKeySystemAccess) => {
      return emeController._onMediaKeySystemAccessObtained(mediaKeySystemAccess);
    }).then((mediaKeys) => {
      return emeController._onMediaKeysCreated(mediaKeys);
    }).then((mediaKeys) => {
      const levelRequests = emeController.manifestData.levels.map((level) => {
        return emeController._onMediaKeysSet(mediaKeys, level);
      });

      const audioRequests = emeController.manifestData.audioTracks.map((audioTrack) => {
        return emeController._onMediaKeysSet(mediaKeys, audioTrack);
      });

      const keySessionRequests = levelRequests.concat(audioRequests);

      return Promise.all(keySessionRequests);
    }).then((keySessionResponses) => {
      const licenseRequests = keySessionResponses.map((keySessionResponse) => {
        return keySessionResponse.keySession.close().then(() => {
          return this._onMediaKeySessionCreated(keySessionResponse.keySession, keySessionResponse.levelOrAudioTrack);
        });
      });

      return Promise.all(licenseRequests);
    }).catch((err) => {
      expect(err).to.be.an.instanceOf(DOMException);
    });
  });

  it('should request licenses for each level and audio track and apply them to their key sessions', function (done) {
    setupEach({
      emeEnabled: true,
      requestMediaKeySystemAccessFunc: requestMediaKeySystemAccessSpy,
      getEMEInitializationDataFunc: getEMEInitializationDataSpy,
      getEMELicenseFunc: getEMELicenseSpy
    });

    hls.on(HlsEvents.EME_CONFIGURED, () => {
      done();
    });

    hls.loadSource('https://storage.googleapis.com/shaka-demo-assets/angel-one-widevine-hls/hls.m3u8');
  }).timeout(20000);

  it('should trigger KEY_SYSTEM_LICENSE_REQUEST_FAILED error when license requests fail', function (done) {
    setupEach({
      emeEnabled: true,
      requestMediaKeySystemAccessFunc: requestMediaKeySystemAccessSpy,
      getEMEInitializationDataFunc: getEMEInitializationDataSpy,
      getEMELicenseFunc: getEMELicenseSpy
    });

    licenseServerUrlMock = 'https://bad-license-request-endpoint.com';

    hls.on(HlsEvents.ERROR, (_, data) => {
      // Other errors can be thrown while we are waiting for the
      // KEY_SYSTEM_LICENSE_REQUEST_FAILED error to be thrown, so we
      // filter other errors until the right one comes or the test times out
      if (data.details !== ErrorDetails.KEY_SYSTEM_LICENSE_REQUEST_FAILED) {
        return;
      }

      expect(data.details).to.equal(ErrorDetails.KEY_SYSTEM_LICENSE_REQUEST_FAILED);

      done();
    });

    hls.loadSource('https://storage.googleapis.com/shaka-demo-assets/angel-one-widevine-hls/hls.m3u8');
  }).timeout(20000);
});
