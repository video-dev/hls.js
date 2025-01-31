import chai from 'chai';
import { EventEmitter } from 'eventemitter3';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import EMEController from '../../../src/controller/eme-controller';
import { ErrorDetails } from '../../../src/errors';
import { Events } from '../../../src/events';
import { KeySystemFormats } from '../../../src/utils/mediakeys-helper';
import HlsMock from '../../mocks/hls.mock';
import type { MediaKeySessionContext } from '../../../src/controller/eme-controller';
import type { MediaAttachedData } from '../../../src/types/events';

chai.use(sinonChai);
const expect = chai.expect;

type EMEControllerTestable = Omit<
  EMEController,
  'hls' | 'keyIdToKeySessionPromise' | 'mediaKeySessions'
> & {
  hls: HlsMock;
  keyIdToKeySessionPromise: {
    [keyId: string]: Promise<MediaKeySessionContext>;
  };
  mediaKeySessions: MediaKeySessionContext[];
  onMediaAttached: (
    event: Events.MEDIA_ATTACHED,
    data: MediaAttachedData,
  ) => void;
  onMediaDetached: () => void;
  media: HTMLMediaElement | null;
};

class MediaMock extends EventEmitter {
  setMediaKeys: sinon.SinonSpy<[mediaKeys: MediaKeys | null], Promise<void>>;
  addEventListener: any;
  removeEventListener: any;
  constructor() {
    super();
    this.setMediaKeys = sinon.spy((mediaKeys: MediaKeys | null) =>
      Promise.resolve(),
    );
    this.addEventListener = this.addListener.bind(this);
    this.removeEventListener = this.removeListener.bind(this);
  }
}

class MediaKeySessionMock extends EventEmitter {
  addEventListener: any;
  removeEventListener: any;
  keyStatuses: Map<Uint8Array, string>;
  constructor() {
    super();
    this.keyStatuses = new Map();
    this.addEventListener = this.addListener.bind(this);
    this.removeEventListener = this.removeListener.bind(this);
  }
  generateRequest() {
    return Promise.resolve().then(() => {
      this.emit('message', {
        messageType: 'license-request',
        message: new Uint8Array(0),
      });
      this.keyStatuses.set(new Uint8Array(0), 'usable');
      this.emit('keystatuseschange', {});
    });
  }
  remove() {
    return Promise.resolve();
  }
  update() {
    return Promise.resolve();
  }
}

let emeController: EMEControllerTestable;
let media: MediaMock;
let sinonFakeXMLHttpRequestStatic: sinon.SinonFakeXMLHttpRequestStatic;

const setupEach = function (config) {
  const hls = new HlsMock(config);
  hls.levelController = {
    levels: [
      {
        audioCodec: 'audio/foo',
      },
      {
        videoCodec: 'video/foo',
      },
    ],
  };
  media = new MediaMock();
  emeController = new EMEController(hls as any) as any as EMEControllerTestable;
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
            createSession: () => new MediaKeySessionMock(),
          }),
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
    });

    sinonFakeXMLHttpRequestStatic.onCreate = (
      xhr: sinon.SinonFakeXMLHttpRequest,
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
            createSession: () => new MediaKeySessionMock(),
          }),
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
      xhr: sinon.SinonFakeXMLHttpRequest,
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

  it('should ignore "encrypted" events with bad data', function () {
    const reqMediaKsAccessSpy = sinon.spy(function () {
      return Promise.resolve({
        // Media-keys mock
        keySystem: 'com.apple.fps',
        createMediaKeys: sinon.spy(() =>
          Promise.resolve({
            setServerCertificate: () => Promise.resolve(),
            createSession: () => ({
              addEventListener: () => {},
              removeEventListener: () => {},
              generateRequest: () => Promise.reject(new Error('bad data')),
              remove: () => Promise.resolve(),
              update: () => Promise.resolve(),
              keyStatuses: new Map(),
            }),
          }),
        ),
      });
    });

    setupEach({
      emeEnabled: true,
      requestMediaKeySystemAccessFunc: reqMediaKsAccessSpy,
      drmSystems: {
        'com.apple.fps': {
          licenseUrl: '.',
        },
      },
    });

    const badData = {
      initDataType: 'cenc',
      initData: new Uint8Array([
        // box size
        0, 0, 0, 44,
        // "PSSH"
        112, 115, 115, 104,
        // version
        0, 0, 0, 0,
        // Widevine system id
        237, 239, 139, 169, 121, 214, 74, 206, 163, 200, 39, 220, 213, 29, 33,
        237,
        // data size
        0, 0, 0, 12,
        // data (incomplete key)
        0, 0, 0, 0, 0, 0, 0, 0, 240, 0, 186, 0,
      ]).buffer,
    };

    emeController.onMediaAttached(Events.MEDIA_ATTACHED, {
      media: media as any as HTMLMediaElement,
    });

    media.emit('encrypted', badData);

    return emeController
      .selectKeySystemFormat({
        levelkeys: {
          [KeySystemFormats.FAIRPLAY]: {},
          [KeySystemFormats.WIDEVINE]: {},
          [KeySystemFormats.PLAYREADY]: {},
        },
        sn: 0,
        type: 'main',
      } as any)
      .then(() => {
        expect(emeController.keyIdToKeySessionPromise).to.deep.equal(
          {},
          '`keyIdToKeySessionPromise` should be an empty dictionary when no key IDs are found',
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
            createSession: () => new MediaKeySessionMock(),
          }),
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
      xhr: sinon.SinonFakeXMLHttpRequest,
    ) => {
      xhrInstance = xhr;
      Promise.resolve().then(() => {
        (xhr as any).response = new Uint8Array();
        xhr.respond(200, {}, '');
      });
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

    expect(
      emeController.keyIdToKeySessionPromise[
        '00000000000000000000000000000000'
      ],
    ).to.be.a('Promise');
    if (
      !emeController.keyIdToKeySessionPromise[
        '00000000000000000000000000000000'
      ]
    ) {
      return;
    }
    return emeController.keyIdToKeySessionPromise[
      '00000000000000000000000000000000'
    ].finally(() => {
      expect(mediaKeysSetServerCertificateSpy).to.have.been.calledOnce;
      expect(mediaKeysSetServerCertificateSpy).to.have.been.calledWith(
        xhrInstance.response,
      );
    });
  });

  it('should fetch the server certificate and trigger update failed error', function () {
    const mediaKeysSetServerCertificateSpy = sinon.spy(() =>
      Promise.reject(new Error('Failed')),
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
              removeEventListener: () => {},
              generateRequest: () => Promise.resolve(),
              remove: () => Promise.resolve(),
              update: () => Promise.resolve(),
              keyStatuses: new Map(),
            }),
          }),
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
      xhr: sinon.SinonFakeXMLHttpRequest,
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
          keyId: new Uint8Array(16),
        },
      },
    } as any);

    expect(
      emeController.keyIdToKeySessionPromise[
        '00000000000000000000000000000000'
      ],
    ).to.be.a('Promise');
    if (
      !emeController.keyIdToKeySessionPromise[
        '00000000000000000000000000000000'
      ]
    ) {
      return;
    }
    return emeController.keyIdToKeySessionPromise[
      '00000000000000000000000000000000'
    ]
      .catch(() => {})
      .finally(() => {
        expect(mediaKeysSetServerCertificateSpy).to.have.been.calledOnce;
        expect((mediaKeysSetServerCertificateSpy.args[0] as any)[0]).to.equal(
          xhrInstance.response,
        );

        expect(emeController.hls.trigger).to.have.been.calledOnce;
        expect(emeController.hls.trigger.args[0][1].details).to.equal(
          ErrorDetails.KEY_SYSTEM_SERVER_CERTIFICATE_UPDATE_FAILED,
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
              removeEventListener: () => {},
              generateRequest: () => Promise.resolve(),
              remove: () => Promise.resolve(),
              update: () => Promise.resolve(),
              keyStatuses: new Map(),
            }),
          }),
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
      xhr: sinon.SinonFakeXMLHttpRequest,
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
          keyId: new Uint8Array(16),
        },
      },
    } as any);

    expect(
      emeController.keyIdToKeySessionPromise[
        '00000000000000000000000000000000'
      ],
    ).to.be.a('Promise');
    if (
      !emeController.keyIdToKeySessionPromise[
        '00000000000000000000000000000000'
      ]
    ) {
      return;
    }
    return emeController.keyIdToKeySessionPromise[
      '00000000000000000000000000000000'
    ]
      .catch(() => {})
      .finally(() => {
        expect(emeController.hls.trigger).to.have.been.calledOnce;
        expect(emeController.hls.trigger.args[0][1].details).to.equal(
          ErrorDetails.KEY_SYSTEM_SERVER_CERTIFICATE_REQUEST_FAILED,
        );
      });
  });

  it('should remove media property  when media is detached', function () {
    const reqMediaKsAccessSpy = sinon.spy(function () {
      return Promise.resolve({
        // Media-keys mock
        keySystem: 'com.apple.fps',
        createMediaKeys: sinon.spy(() =>
          Promise.resolve({
            setServerCertificate: () => Promise.resolve(),
            createSession: () => ({
              addEventListener: () => {},
              removeEventListener: () => {},
              generateRequest: () => Promise.resolve(),
              remove: () => Promise.resolve(),
              update: () => Promise.resolve(),
              keyStatuses: new Map(),
            }),
          }),
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
    emeController.destroy();

    expect(emeController.media).to.equal(null);
  });

  it('should close all media key sessions and remove media keys when call destroy', function () {
    const reqMediaKsAccessSpy = sinon.spy(function () {
      return Promise.resolve({
        // Media-keys mock
        keySystem: 'com.apple.fps',
        createMediaKeys: sinon.spy(() =>
          Promise.resolve({
            setServerCertificate: () => Promise.resolve(),
            createSession: () => ({
              addEventListener: () => {},
              removeEventListener: () => {},
              generateRequest: () => Promise.resolve(),
              remove: () => Promise.resolve(),
              update: () => Promise.resolve(),
              keyStatuses: new Map(),
            }),
          }),
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
    emeController.destroy();

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
