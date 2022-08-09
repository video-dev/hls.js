import EMEController, {
  MediaKeySessionContext,
} from '../../../src/controller/eme-controller';
import HlsMock from '../../mocks/hls.mock';
import { EventEmitter } from 'eventemitter3';
import { ErrorDetails } from '../../../src/errors';
import { Events } from '../../../src/events';

import * as sinon from 'sinon';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import { MediaAttachedData } from '../../../src/types/events';

chai.use(sinonChai);
const expect = chai.expect;

type EMEControllerTestable = Omit<
  EMEController,
  'hls' | 'keyUriToKeySessionPromise' | 'mediaKeySessions'
> & {
  hls: HlsMock;
  keyUriToKeySessionPromise: {
    [keyuri: string]: Promise<MediaKeySessionContext>;
  };
  mediaKeySessions: MediaKeySessionContext[];
  onMediaAttached: (
    event: Events.MEDIA_ATTACHED,
    data: MediaAttachedData
  ) => void;
  onMediaDetached: () => void;
};

class MediaMock extends EventEmitter {
  setMediaKeys: sinon.SinonSpy<[mediaKeys: MediaKeys | null], Promise<void>>;
  addEventListener: any;
  removeEventListener: any;
  constructor() {
    super();
    this.setMediaKeys = sinon.spy((mediaKeys: MediaKeys | null) =>
      Promise.resolve()
    );
    this.addEventListener = this.addListener.bind(this);
    this.removeEventListener = this.removeListener.bind(this);
  }
}

let emeController: EMEControllerTestable;
let media: MediaMock;
let sinonFakeXMLHttpRequestStatic: sinon.SinonFakeXMLHttpRequestStatic;

const setupEach = function (config) {
  const hls = new HlsMock(config);
  hls.levels = [
    {
      audioCodec: 'audio/foo',
    },
    {
      videoCodec: 'video/foo',
    },
  ];
  media = new MediaMock();
  emeController = new EMEController(hls) as any as EMEControllerTestable;
  sinonFakeXMLHttpRequestStatic = sinon.useFakeXMLHttpRequest();
};

describe('EMEController', function () {
  beforeEach(function () {
    setupEach({});
  });

  afterEach(function () {
    sinonFakeXMLHttpRequestStatic.restore();
  });

  it('should request keysystem access based on key format when `emeEnabled` is true', function () {
    const reqMediaKsAccessSpy = sinon.spy(function () {
      return Promise.resolve({
        // Media-keys mock
        keySystem: 'com.apple.fps',
        createMediaKeys: sinon.spy(() =>
          Promise.resolve({
            setServerCertificate: () => Promise.resolve(),
            createSession: (): Partial<MediaKeySession> => ({
              addEventListener: () => {},
              onmessage: null,
              onkeystatuseschange: null,
              generateRequest() {
                return Promise.resolve().then(() => {
                  this.onmessage({
                    messageType: 'license-request',
                    message: new Uint8Array(0),
                  });
                  this.keyStatuses.set(new Uint8Array(0), 'usable');
                  this.onkeystatuseschange({});
                });
              },
              remove: () => Promise.resolve(),
              update: () => Promise.resolve(),
              keyStatuses: new Map(),
            }),
          })
        ),
      });
    });

    setupEach({
      emeEnabled: true,
      drmSystems: {
        'com.apple.fps': {
          licenseUrl: 'http://noop',
        },
      },
      requestMediaKeySystemAccessFunc: reqMediaKsAccessSpy,
      // useEmeEncryptedEvent: true, // skip generate request, license exchange, and key status "usable"
    });

    sinonFakeXMLHttpRequestStatic.onCreate = (
      xhr: sinon.SinonFakeXMLHttpRequest
    ) => {
      self.setTimeout(() => {
        (xhr as any).response = new Uint8Array();
        xhr.respond(200, {}, '');
      }, 0);
    };

    emeController.onMediaAttached(Events.MEDIA_ATTACHED, {
      media: media as any as HTMLMediaElement,
    });

    expect(media.setMediaKeys).callCount(0);
    expect(reqMediaKsAccessSpy).callCount(0);

    const emePromise = emeController.loadKey({
      frag: {},
      keyInfo: {
        decryptdata: {
          encrypted: true,
          method: 'SAMPLE-AES',
          keyFormat: 'com.apple.streamingkeydelivery',
          uri: 'data://key-uri',
          keyId: new Uint8Array(16),
          pssh: new Uint8Array(16),
        },
      },
    } as any);

    expect(emePromise).to.be.a('Promise');
    if (!emePromise) {
      return;
    }
    return emePromise.finally(() => {
      expect(media.setMediaKeys).callCount(1);
      expect(reqMediaKsAccessSpy).callCount(1);
    });
  });

  it('should request keys with specified robustness options when `emeEnabled` is true', function () {
    const reqMediaKsAccessSpy = sinon.spy(function () {
      return Promise.resolve({
        // Media-keys mock
        keySystem: 'com.apple.fps',
        createMediaKeys: sinon.spy(() =>
          Promise.resolve({
            setServerCertificate: () => Promise.resolve(),
            createSession: (): Partial<MediaKeySession> => ({
              addEventListener: () => {},
              onmessage: null,
              onkeystatuseschange: null,
              generateRequest() {
                return Promise.resolve().then(() => {
                  this.onmessage({
                    messageType: 'license-request',
                    message: new Uint8Array(0),
                  });
                  this.keyStatuses.set(new Uint8Array(0), 'usable');
                  this.onkeystatuseschange({});
                });
              },
              remove: () => Promise.resolve(),
              update: () => Promise.resolve(),
              keyStatuses: new Map(),
            }),
          })
        ),
      });
    });

    setupEach({
      emeEnabled: true,
      drmSystems: {
        'com.apple.fps': {
          licenseUrl: 'http://noop',
        },
      },
      drmSystemOptions: {
        audioRobustness: 'HW_SECURE_ALL',
        videoRobustness: 'HW_SECURE_ALL',
      },
      requestMediaKeySystemAccessFunc: reqMediaKsAccessSpy,
    });

    sinonFakeXMLHttpRequestStatic.onCreate = (
      xhr: sinon.SinonFakeXMLHttpRequest
    ) => {
      self.setTimeout(() => {
        (xhr as any).response = new Uint8Array();
        xhr.respond(200, {}, '');
      }, 0);
    };

    emeController.onMediaAttached(Events.MEDIA_ATTACHED, {
      media: media as any as HTMLMediaElement,
    });

    expect(media.setMediaKeys).callCount(0);
    expect(reqMediaKsAccessSpy).callCount(0);

    const emePromise = emeController.loadKey({
      frag: {},
      keyInfo: {
        decryptdata: {
          encrypted: true,
          method: 'SAMPLE-AES',
          keyFormat: 'com.apple.streamingkeydelivery',
          uri: 'data://key-uri',
          keyId: new Uint8Array(16),
          pssh: new Uint8Array(16),
        },
      },
    } as any);

    expect(emePromise).to.be.a('Promise');
    if (!emePromise) {
      return;
    }
    return emePromise.finally(() => {
      expect(reqMediaKsAccessSpy).callCount(1);
      const args = reqMediaKsAccessSpy.getCall(0)
        .args as MediaKeySystemConfiguration[][];
      const baseConfig: MediaKeySystemConfiguration = args[1][0];
      expect(baseConfig.audioCapabilities)
        .to.be.an('array')
        .with.property('0')
        .with.property('robustness', 'HW_SECURE_ALL');
      expect(baseConfig.videoCapabilities)
        .to.be.an('array')
        .with.property('0')
        .with.property('robustness', 'HW_SECURE_ALL');
    });
  });

  it('should trigger key system error(s) when bad encrypted data is received', function () {
    const reqMediaKsAccessSpy = sinon.spy(function () {
      return Promise.resolve({
        // Media-keys mock
        keySystem: 'com.apple.fps',
        createMediaKeys: sinon.spy(() =>
          Promise.resolve({
            setServerCertificate: () => Promise.resolve(),
            createSession: () => ({
              addEventListener: () => {},
              generateRequest: () => Promise.reject(new Error('bad data')),
              remove: () => Promise.resolve(),
              update: () => Promise.resolve(),
              keyStatuses: new Map(),
            }),
          })
        ),
      });
    });

    setupEach({
      emeEnabled: true,
      useEmeEncryptedEvent: true,
      requestMediaKeySystemAccessFunc: reqMediaKsAccessSpy,
    });

    const badData = {
      initDataType: 'cenc',
      initData: 'bad data',
    };

    emeController.onMediaAttached(Events.MEDIA_ATTACHED, {
      media: media as any as HTMLMediaElement,
    });

    media.emit('encrypted', badData);

    expect(emeController.keyUriToKeySessionPromise.encrypted).to.be.a(
      'Promise'
    );
    if (!emeController.keyUriToKeySessionPromise.encrypted) {
      return;
    }
    return emeController.keyUriToKeySessionPromise.encrypted
      .catch(() => {})
      .finally(() => {
        expect(emeController.hls.trigger).callCount(1);
        expect(emeController.hls.trigger.args[0][1].details).to.equal(
          ErrorDetails.KEY_SYSTEM_NO_SESSION
        );
      });
  });

  it('should fetch the server certificate and set it into the session', function () {
    const mediaKeysSetServerCertificateSpy = sinon.spy(() => Promise.resolve());

    const reqMediaKsAccessSpy = sinon.spy(function () {
      return Promise.resolve({
        // Media-keys mock
        keySystem: 'com.apple.fps',
        createMediaKeys: sinon.spy(() =>
          Promise.resolve({
            setServerCertificate: mediaKeysSetServerCertificateSpy,
            createSession: () => ({
              addEventListener: () => {},
              onmessage: null,
              onkeystatuseschange: null,
              generateRequest() {
                return Promise.resolve().then(() => {
                  this.onmessage({
                    messageType: 'license-request',
                    message: new Uint8Array(0),
                  });
                  this.keyStatuses.set(new Uint8Array(0), 'usable');
                  this.onkeystatuseschange({});
                });
              },
              remove: () => Promise.resolve(),
              update: () => Promise.resolve(),
              keyStatuses: new Map(),
            }),
          })
        ),
      });
    });

    setupEach({
      emeEnabled: true,
      requestMediaKeySystemAccessFunc: reqMediaKsAccessSpy,
      drmSystems: {
        'com.apple.fps': {
          serverCertificateUrl: 'https://example.com/certificate.cer',
        },
      },
    });

    let xhrInstance;
    sinonFakeXMLHttpRequestStatic.onCreate = (
      xhr: sinon.SinonFakeXMLHttpRequest
    ) => {
      xhrInstance = xhr;
      self.setTimeout(() => {
        (xhr as any).response = new Uint8Array();
        xhr.respond(200, {}, '');
      }, 0);
    };

    emeController.onMediaAttached(Events.MEDIA_ATTACHED, {
      media: media as any as HTMLMediaElement,
    });
    emeController.loadKey({
      frag: {},
      keyInfo: {
        decryptdata: {
          encrypted: true,
          method: 'SAMPLE-AES',
          uri: 'data://key-uri',
          keyFormatVersions: [1],
          keyId: new Uint8Array(16),
          pssh: new Uint8Array(16),
        },
      },
    } as any);

    expect(emeController.keyUriToKeySessionPromise['data://key-uri']).to.be.a(
      'Promise'
    );
    if (!emeController.keyUriToKeySessionPromise['data://key-uri']) {
      return;
    }
    return emeController.keyUriToKeySessionPromise['data://key-uri'].finally(
      () => {
        expect(mediaKeysSetServerCertificateSpy).to.have.been.calledOnce;
        expect(mediaKeysSetServerCertificateSpy).to.have.been.calledWith(
          xhrInstance.response
        );
      }
    );
  });

  it('should fetch the server certificate and trigger update failed error', function () {
    const mediaKeysSetServerCertificateSpy = sinon.spy(() =>
      Promise.reject(new Error('Failed'))
    );

    const reqMediaKsAccessSpy = sinon.spy(function () {
      return Promise.resolve({
        // Media-keys mock
        keySystem: 'com.apple.fps',
        createMediaKeys: sinon.spy(() =>
          Promise.resolve({
            setServerCertificate: mediaKeysSetServerCertificateSpy,
            createSession: () => ({
              addEventListener: () => {},
              generateRequest: () => Promise.resolve(),
              remove: () => Promise.resolve(),
              update: () => Promise.resolve(),
              keyStatuses: new Map(),
            }),
          })
        ),
      });
    });

    setupEach({
      emeEnabled: true,
      requestMediaKeySystemAccessFunc: reqMediaKsAccessSpy,
      drmSystems: {
        'com.apple.fps': {
          serverCertificateUrl: 'https://example.com/certificate.cer',
        },
      },
    });

    let xhrInstance;
    sinonFakeXMLHttpRequestStatic.onCreate = (
      xhr: sinon.SinonFakeXMLHttpRequest
    ) => {
      xhrInstance = xhr;
      self.setTimeout(() => {
        (xhr as any).response = new Uint8Array();
        xhr.respond(200, {}, '');
      }, 0);
    };

    emeController.onMediaAttached(Events.MEDIA_ATTACHED, {
      media: media as any as HTMLMediaElement,
    });
    emeController.loadKey({
      frag: {},
      keyInfo: {
        decryptdata: {
          encrypted: true,
          method: 'SAMPLE-AES',
          uri: 'data://key-uri',
        },
      },
    } as any);

    expect(
      emeController.keyUriToKeySessionPromise['data://key-uri']
    ).to.not.equal(null);
    if (!emeController.keyUriToKeySessionPromise['data://key-uri']) {
      return;
    }
    return emeController.keyUriToKeySessionPromise['data://key-uri']
      .catch(() => {})
      .finally(() => {
        expect(mediaKeysSetServerCertificateSpy).to.have.been.calledOnce;
        expect((mediaKeysSetServerCertificateSpy.args[0] as any)[0]).to.equal(
          xhrInstance.response
        );

        expect(emeController.hls.trigger).to.have.been.calledOnce;
        expect(emeController.hls.trigger.args[0][1].details).to.equal(
          ErrorDetails.KEY_SYSTEM_SERVER_CERTIFICATE_UPDATE_FAILED
        );
      });
  });

  it('should fetch the server certificate and trigger request failed error', function () {
    const reqMediaKsAccessSpy = sinon.spy(function () {
      return Promise.resolve({
        // Media-keys mock
        keySystem: 'com.apple.fps',
        createMediaKeys: sinon.spy(() =>
          Promise.resolve({
            createSession: () => ({
              addEventListener: () => {},
              generateRequest: () => Promise.resolve(),
              remove: () => Promise.resolve(),
              update: () => Promise.resolve(),
              keyStatuses: new Map(),
            }),
          })
        ),
      });
    });

    setupEach({
      emeEnabled: true,
      requestMediaKeySystemAccessFunc: reqMediaKsAccessSpy,
      drmSystems: {
        'com.apple.fps': {
          serverCertificateUrl: 'https://example.com/certificate.cer',
        },
      },
    });

    sinonFakeXMLHttpRequestStatic.onCreate = (
      xhr: sinon.SinonFakeXMLHttpRequest
    ) => {
      self.setTimeout(() => {
        xhr.status = 400;
        xhr.error();
      }, 0);
    };

    emeController.onMediaAttached(Events.MEDIA_ATTACHED, {
      media: media as any as HTMLMediaElement,
    });
    emeController.loadKey({
      frag: {},
      keyInfo: {
        decryptdata: {
          encrypted: true,
          method: 'SAMPLE-AES',
          uri: 'data://key-uri',
        },
      },
    } as any);

    expect(
      emeController.keyUriToKeySessionPromise['data://key-uri']
    ).to.not.equal(null);
    if (!emeController.keyUriToKeySessionPromise['data://key-uri']) {
      return;
    }
    return emeController.keyUriToKeySessionPromise['data://key-uri']
      .catch(() => {})
      .finally(() => {
        expect(emeController.hls.trigger).to.have.been.calledOnce;
        expect(emeController.hls.trigger.args[0][1].details).to.equal(
          ErrorDetails.KEY_SYSTEM_SERVER_CERTIFICATE_REQUEST_FAILED
        );
      });
  });

  it('should close all media key sessions and remove media keys when media is detached', function () {
    const reqMediaKsAccessSpy = sinon.spy(function () {
      return Promise.resolve({
        // Media-keys mock
        keySystem: 'com.apple.fps',
        createMediaKeys: sinon.spy(() =>
          Promise.resolve({
            setServerCertificate: () => Promise.resolve(),
            createSession: () => ({
              addEventListener: () => {},
              generateRequest: () => Promise.resolve(),
              remove: () => Promise.resolve(),
              update: () => Promise.resolve(),
              keyStatuses: new Map(),
            }),
          })
        ),
      });
    });
    const keySessionRemoveSpy = sinon.spy(() => Promise.resolve());
    const keySessionCloseSpy = sinon.spy(() => Promise.resolve());

    setupEach({
      emeEnabled: true,
      requestMediaKeySystemAccessFunc: reqMediaKsAccessSpy,
    });

    emeController.onMediaAttached(Events.MEDIA_ATTACHED, {
      media: media as any as HTMLMediaElement,
    });
    emeController.mediaKeySessions = [
      {
        mediaKeysSession: {
          remove: keySessionRemoveSpy,
          close: keySessionCloseSpy,
        },
      } as any,
    ];
    emeController.onMediaDetached();

    expect(EMEController.CDMCleanupPromise).to.be.a('Promise');
    if (!EMEController.CDMCleanupPromise) {
      return;
    }
    return EMEController.CDMCleanupPromise.then(() => {
      expect(keySessionRemoveSpy).callCount(1);
      expect(keySessionCloseSpy).callCount(1);
      expect(emeController.mediaKeySessions.length).to.equal(0);
      expect(media.setMediaKeys).calledWith(null);
    });
  });
});
