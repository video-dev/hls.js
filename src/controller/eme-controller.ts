/**
 * @author Stephan Hesse <disparat@gmail.com> | <tchakabam@gmail.com>
 *
 * DRM support for Hls.js
 */
import { Events } from '../events';
import { ErrorTypes, ErrorDetails } from '../errors';
import { logger } from '../utils/logger';
import {
  getKeySystemsForConfig,
  getSupportedMediaKeySystemConfigurations,
  keySystemDomainToKeySystemFormat as keySystemToKeySystemFormat,
  KeySystemFormats,
  keySystemFormatToKeySystemDomain,
  KeySystemIds,
  keySystemIdToKeySystemDomain,
} from '../utils/mediakeys-helper';
import {
  KeySystems,
  requestMediaKeySystemAccess,
} from '../utils/mediakeys-helper';
import { strToUtf8array } from '../utils/keysystem-util';
import { utf8ArrayToStr } from '../demux/id3';
import { base64Decode, base64Encode } from '../utils/numeric-encoding-utils';
import { DecryptData, LevelKey } from '../loader/level-key';
import Hex from '../utils/hex';
import { parsePssh } from '../utils/mp4-tools';
import EventEmitter from 'eventemitter3';
import type Hls from '../hls';
import type { ComponentAPI } from '../types/component-api';
import type {
  MediaAttachedData,
  KeyLoadedData,
  ErrorData,
  ManifestLoadedData,
} from '../types/events';
import type { EMEControllerConfig } from '../config';
import type { Fragment } from '../loader/fragment';

const MAX_LICENSE_REQUEST_FAILURES = 3;
const LOGGER_PREFIX = '[eme]';

interface KeySystemAccessPromises {
  keySystemAccess: Promise<MediaKeySystemAccess>;
  mediaKeys?: Promise<MediaKeys>;
  certificate?: Promise<BufferSource | void>;
}

export interface MediaKeySessionContext {
  keySystem: KeySystems;
  mediaKeys: MediaKeys;
  decryptdata: LevelKey;
  mediaKeysSession: MediaKeySession;
  keyStatus: MediaKeyStatus;
  licenseXhr?: XMLHttpRequest;
}

/**
 * Controller to deal with encrypted media extensions (EME)
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Encrypted_Media_Extensions_API
 *
 * @class
 * @constructor
 */
class EMEController implements ComponentAPI {
  public static CDMCleanupPromise: Promise<void> | void;

  private readonly hls: Hls;
  private readonly config: EMEControllerConfig;
  private media: HTMLMediaElement | null = null;
  private keyFormatPromise: Promise<KeySystemFormats> | null = null;
  private keySystemAccessPromises: {
    [keysystem: string]: KeySystemAccessPromises;
  } = {};
  private _requestLicenseFailureCount: number = 0;
  private mediaKeySessions: MediaKeySessionContext[] = [];
  private keyIdToKeySessionPromise: {
    [keyId: string]: Promise<MediaKeySessionContext>;
  } = {};
  private setMediaKeysQueue: Promise<void>[] = EMEController.CDMCleanupPromise
    ? [EMEController.CDMCleanupPromise]
    : [];
  private onMediaEncrypted = this._onMediaEncrypted.bind(this);
  private onWaitingForKey = this._onWaitingForKey.bind(this);

  private log: (msg: any) => void = logger.log.bind(logger, LOGGER_PREFIX);
  private warn: (msg: any) => void = logger.warn.bind(logger, LOGGER_PREFIX);
  private error: (msg: any) => void = logger.error.bind(logger, LOGGER_PREFIX);

  constructor(hls: Hls) {
    this.hls = hls;
    this.config = hls.config;
    this.registerListeners();
  }

  public destroy() {
    this.unregisterListeners();
    this.onMediaDetached();
    // @ts-ignore
    this.hls =
      this.onMediaEncrypted =
      this.onWaitingForKey =
      this.keyIdToKeySessionPromise =
        null as any;
  }

  private registerListeners() {
    this.hls.on(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    this.hls.on(Events.MEDIA_DETACHED, this.onMediaDetached, this);
    this.hls.on(Events.MANIFEST_LOADED, this.onManifestLoaded, this);
  }

  private unregisterListeners() {
    this.hls.off(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    this.hls.off(Events.MEDIA_DETACHED, this.onMediaDetached, this);
    this.hls.off(Events.MANIFEST_LOADED, this.onManifestLoaded, this);
  }

  private getLicenseServerUrl(keySystem: KeySystems): string | never {
    const { drmSystems, widevineLicenseUrl } = this.config;
    const keySystemConfiguration = drmSystems[keySystem];

    if (keySystemConfiguration) {
      return keySystemConfiguration.licenseUrl;
    }

    // For backward compatibility
    if (keySystem === KeySystems.WIDEVINE && widevineLicenseUrl) {
      return widevineLicenseUrl;
    }

    throw new Error(
      `no license server URL configured for key-system "${keySystem}"`
    );
  }

  private getServerCertificateUrl(keySystem: KeySystems): string | void {
    const { drmSystems } = this.config;
    const keySystemConfiguration = drmSystems[keySystem];

    if (keySystemConfiguration) {
      return keySystemConfiguration.serverCertificateUrl;
    } else {
      this.log(`No Server Certificate in config.drmSystems["${keySystem}"]`);
    }
  }

  private attemptKeySystemAccess(
    keySystemsToAttempt: KeySystems[]
  ): Promise<{ keySystem: KeySystems; mediaKeys: MediaKeys }> {
    const levels = this.hls.levels;
    const uniqueCodec = (value: string | undefined, i, a): value is string =>
      !!value && a.indexOf(value) === i;
    const audioCodecs = levels
      .map((level) => level.audioCodec)
      .filter(uniqueCodec);
    const videoCodecs = levels
      .map((level) => level.videoCodec)
      .filter(uniqueCodec);
    if (audioCodecs.length + videoCodecs.length === 0) {
      videoCodecs.push('avc1.42e01e');
    }

    return new Promise(
      (
        resolve: (result: {
          keySystem: KeySystems;
          mediaKeys: MediaKeys;
        }) => void,
        reject: (Error) => void
      ) => {
        const attempt = (keySystems) => {
          const keySystem = keySystems.shift();
          this.getMediaKeysPromise(keySystem, audioCodecs, videoCodecs)
            .then((mediaKeys) => resolve({ keySystem, mediaKeys }))
            .catch((error) => {
              if (keySystems.length) {
                attempt(keySystems);
              } else if (error instanceof EMEKeyError) {
                reject(error);
              } else {
                reject(
                  new EMEKeyError(
                    {
                      type: ErrorTypes.KEY_SYSTEM_ERROR,
                      details: ErrorDetails.KEY_SYSTEM_NO_ACCESS,
                      error,
                      fatal: true,
                    },
                    error.message
                  )
                );
              }
            });
        };
        attempt(keySystemsToAttempt);
      }
    );
  }

  private requestMediaKeySystemAccess(
    keySystem: KeySystems,
    supportedConfigurations: MediaKeySystemConfiguration[]
  ): Promise<MediaKeySystemAccess> {
    const { requestMediaKeySystemAccessFunc } = this.config;
    if (!(typeof requestMediaKeySystemAccessFunc === 'function')) {
      let errMessage = `Configured requestMediaKeySystemAccess is not a function ${requestMediaKeySystemAccessFunc}`;
      if (
        requestMediaKeySystemAccess === null &&
        self.location.protocol === 'http:'
      ) {
        errMessage = `navigator.requestMediaKeySystemAccess is not available over insecure protocol ${location.protocol}`;
      }
      return Promise.reject(new Error(errMessage));
    }

    return requestMediaKeySystemAccessFunc(keySystem, supportedConfigurations);
  }

  private getMediaKeysPromise(
    keySystem: KeySystems,
    audioCodecs: string[],
    videoCodecs: string[]
  ): Promise<MediaKeys> {
    // This can throw, but is caught in event handler callpath
    const mediaKeySystemConfigs = getSupportedMediaKeySystemConfigurations(
      keySystem,
      audioCodecs,
      videoCodecs,
      this.config.drmSystemOptions
    );
    const keySystemAccessPromises: KeySystemAccessPromises =
      this.keySystemAccessPromises[keySystem];
    let keySystemAccess = keySystemAccessPromises?.keySystemAccess;
    if (!keySystemAccess) {
      this.log(
        `Requesting encrypted media "${keySystem}" key-system access with config: ${JSON.stringify(
          mediaKeySystemConfigs
        )}`
      );
      keySystemAccess = this.requestMediaKeySystemAccess(
        keySystem,
        mediaKeySystemConfigs
      );
      const keySystemAccessPromises: KeySystemAccessPromises =
        (this.keySystemAccessPromises[keySystem] = {
          keySystemAccess,
        });
      keySystemAccess.catch((error) => {
        this.log(
          `Failed to obtain access to key-system "${keySystem}": ${error}`
        );
      });
      return keySystemAccess.then((mediaKeySystemAccess) => {
        this.log(
          `Access for key-system "${mediaKeySystemAccess.keySystem}" obtained`
        );

        const certificateRequest = this.fetchServerCertificate(keySystem);

        this.log(`Create media-keys for "${keySystem}"`);
        keySystemAccessPromises.mediaKeys = mediaKeySystemAccess
          .createMediaKeys()
          .then((mediaKeys) => {
            this.log(`Media-keys created for "${keySystem}"`);
            return certificateRequest.then((certificate) => {
              if (certificate) {
                return this.setMediaKeysServerCertificate(
                  mediaKeys,
                  keySystem,
                  certificate
                );
              }
              return mediaKeys;
            });
          });

        keySystemAccessPromises.mediaKeys.catch((error) => {
          this.error(
            `Failed to create media-keys for "${keySystem}"}: ${error}`
          );
        });

        return keySystemAccessPromises.mediaKeys;
      });
    }
    return keySystemAccess.then(() => keySystemAccessPromises.mediaKeys!);
  }

  private createMediaKeySessionContext({
    decryptdata,
    keySystem,
    mediaKeys,
  }: {
    decryptdata: LevelKey;
    keySystem: KeySystems;
    mediaKeys: MediaKeys;
  }): MediaKeySessionContext {
    console.assert(!!mediaKeys, 'mediaKeys is defined');

    this.log(
      `Creating key-system session "${keySystem}" keyId: ${Hex.hexDump(
        decryptdata.keyId! || []
      )}`
    );

    const mediaKeysSession = mediaKeys.createSession();

    const mediaKeySessionContext: MediaKeySessionContext = {
      decryptdata,
      keySystem,
      mediaKeys,
      mediaKeysSession,
      keyStatus: 'status-pending',
    };

    this.mediaKeySessions.push(mediaKeySessionContext);

    return mediaKeySessionContext;
  }

  private renewKeySession(mediaKeySessionContext: MediaKeySessionContext) {
    const decryptdata = mediaKeySessionContext.decryptdata;
    const keySessionContext = this.createMediaKeySessionContext(
      mediaKeySessionContext
    );
    const keyId = this.getKeyIdString(decryptdata);
    const scheme = 'cenc';
    this.keyIdToKeySessionPromise[keyId] =
      this.generateRequestWithPreferredKeySession(
        keySessionContext,
        scheme,
        decryptdata.pssh
      );
    this.removeSession(mediaKeySessionContext);
  }

  private getKeyIdString(decryptdata: DecryptData | undefined): string | never {
    if (!decryptdata) {
      throw new Error('Could not read keyId of undefined decryptdata');
    }
    if (decryptdata.keyId === null) {
      throw new Error('keyId is null');
    }
    return Hex.hexDump(decryptdata.keyId);
  }

  private handleParsedKeyResponse(
    mediaKeySessionContext: MediaKeySessionContext,
    licenseResponse: ArrayBuffer
  ): Uint8Array {
    switch (mediaKeySessionContext.keySystem) {
      case KeySystems.FAIRPLAY: {
        const responseStr = JSON.stringify([
          {
            keyID: base64Encode(
              mediaKeySessionContext.decryptdata?.keyId as Uint8Array
            ),
            payload: base64Encode(new Uint8Array(licenseResponse)),
          },
        ]);
        this.log(`processLicense msg=${responseStr}`);
        return strToUtf8array(responseStr);
      }
    }
    return new Uint8Array(licenseResponse);
  }

  private updateKeySession(
    mediaKeySessionContext: MediaKeySessionContext,
    data: Uint8Array
  ): Promise<void> {
    const keySession = mediaKeySessionContext.mediaKeysSession;
    this.log(
      `Updating key-session "${keySession.sessionId}" for keyID ${Hex.hexDump(
        mediaKeySessionContext.decryptdata?.keyId! || []
      )}
      } (data length: ${data ? data.byteLength : data})`
    );
    return keySession.update(data);
  }

  public selectKeySystemFormat(frag: Fragment): Promise<KeySystemFormats> {
    const keyFormats = Object.keys(frag.levelkeys || {}) as KeySystemFormats[];
    if (!this.keyFormatPromise) {
      this.log(
        `Selecting key-system from fragment (sn: ${frag.sn} ${frag.type}: ${
          frag.level
        }) key formats ${keyFormats.join(', ')}`
      );
      this.keyFormatPromise = this.getKeyFormatPromise(keyFormats);
    }
    return this.keyFormatPromise;
  }

  private getKeyFormatPromise(
    keyFormats: KeySystemFormats[]
  ): Promise<KeySystemFormats> {
    return new Promise((resolve, reject) => {
      const keySystemsInConfig = getKeySystemsForConfig(this.config);
      const keySystemsToAttempt = keyFormats
        .map(keySystemFormatToKeySystemDomain)
        .filter(
          (value) => !!value && keySystemsInConfig.indexOf(value) !== -1
        ) as any as KeySystems[];
      return this.getKeySystemSelectionPromise(keySystemsToAttempt)
        .then(({ keySystem }) => {
          const keySystemFormat = keySystemToKeySystemFormat(keySystem);
          if (keySystemFormat) {
            resolve(keySystemFormat);
          } else {
            reject(
              new Error(`Unable to find format for key-system "${keySystem}"`)
            );
          }
        })
        .catch(reject);
    });
  }

  public loadKey(data: KeyLoadedData): Promise<MediaKeySessionContext> {
    const decryptdata = data.keyInfo.decryptdata;

    const keyId = this.getKeyIdString(decryptdata);
    const keyDetails = `(keyId: ${keyId} format: "${decryptdata.keyFormat}" method: ${decryptdata.method} uri: ${decryptdata.uri})`;

    this.log(`Starting session for key ${keyDetails}`);

    let keySessionContextPromise = this.keyIdToKeySessionPromise[keyId];
    if (!keySessionContextPromise) {
      keySessionContextPromise = this.keyIdToKeySessionPromise[keyId] =
        this.getKeySystemForKeyPromise(decryptdata).then(
          ({ keySystem, mediaKeys }) => {
            this.throwIfDestroyed();
            this.log(
              `Handle encrypted media sn: ${data.frag.sn} ${data.frag.type}: ${data.frag.level} using key ${keyDetails}`
            );

            return this.attemptSetMediaKeys(keySystem, mediaKeys).then(() => {
              this.throwIfDestroyed();
              const keySessionContext = this.createMediaKeySessionContext({
                keySystem,
                mediaKeys,
                decryptdata,
              });
              const scheme = 'cenc';
              return this.generateRequestWithPreferredKeySession(
                keySessionContext,
                scheme,
                decryptdata.pssh
              );
            });
          }
        );

      keySessionContextPromise.catch((error) => this.handleError(error));
    }

    return keySessionContextPromise;
  }

  private throwIfDestroyed(message = 'Invalid state'): void | never {
    if (!this.hls) {
      throw new Error('invalid state');
    }
  }

  private handleError(error: EMEKeyError | Error) {
    if (!this.hls) {
      return;
    }
    this.error(error.message);
    if (error instanceof EMEKeyError) {
      this.hls.trigger(Events.ERROR, error.data);
    } else {
      this.hls.trigger(Events.ERROR, {
        type: ErrorTypes.KEY_SYSTEM_ERROR,
        details: ErrorDetails.KEY_SYSTEM_NO_KEYS,
        error,
        fatal: true,
      });
    }
  }

  private getKeySystemForKeyPromise(
    decryptdata: LevelKey
  ): Promise<{ keySystem: KeySystems; mediaKeys: MediaKeys }> {
    const keyId = this.getKeyIdString(decryptdata);
    const mediaKeySessionContext = this.keyIdToKeySessionPromise[keyId];
    if (!mediaKeySessionContext) {
      const keySystem = keySystemFormatToKeySystemDomain(
        decryptdata.keyFormat as KeySystemFormats
      );
      const keySystemsToAttempt = keySystem
        ? [keySystem]
        : getKeySystemsForConfig(this.config);
      return this.attemptKeySystemAccess(keySystemsToAttempt);
    }
    return mediaKeySessionContext;
  }

  private getKeySystemSelectionPromise(
    keySystemsToAttempt?: KeySystems[]
  ): Promise<{ keySystem: KeySystems; mediaKeys: MediaKeys }> {
    if (!keySystemsToAttempt || !keySystemsToAttempt.length) {
      keySystemsToAttempt = getKeySystemsForConfig(this.config);
    }
    return this.attemptKeySystemAccess(keySystemsToAttempt);
  }

  private _onMediaEncrypted(event: MediaEncryptedEvent) {
    const { initDataType, initData } = event;
    this.log(`"${event.type}" event: init data type: "${initDataType}"`);

    // Ignore event when initData is null
    if (initData === null) {
      return;
    }

    // Support clear-lead key-session creation (otherwise depend on playlist keys)
    const psshInfo = parsePssh(initData);
    if (psshInfo === null) {
      return;
    }
    let keyId: Uint8Array | null = null;
    if (
      psshInfo.version === 0 &&
      psshInfo.systemId === KeySystemIds.WIDEVINE &&
      psshInfo.data
    ) {
      keyId = psshInfo.data.subarray(8, 24);
    }
    const keySystemDomain = keySystemIdToKeySystemDomain(
      psshInfo.systemId as KeySystemIds
    );
    if (!keySystemDomain || !keyId) {
      return;
    }

    const keyIdHex = Hex.hexDump(keyId);
    let keySessionContextPromise = this.keyIdToKeySessionPromise[keyIdHex];
    if (!keySessionContextPromise) {
      keySessionContextPromise = this.keyIdToKeySessionPromise[keyIdHex] =
        this.getKeySystemSelectionPromise([keySystemDomain]).then(
          ({ keySystem, mediaKeys }) => {
            this.throwIfDestroyed();
            const decryptdata = new LevelKey(
              'ISO-23001-7',
              keyIdHex,
              keySystemToKeySystemFormat(keySystem) ?? ''
            );
            decryptdata.pssh = new Uint8Array(initData);
            decryptdata.keyId = keyId;
            return this.attemptSetMediaKeys(keySystem, mediaKeys).then(() => {
              this.throwIfDestroyed();
              const keySessionContext = this.createMediaKeySessionContext({
                decryptdata,
                keySystem,
                mediaKeys,
              });
              return this.generateRequestWithPreferredKeySession(
                keySessionContext,
                initDataType,
                initData
              );
            });
          }
        );
    }
    keySessionContextPromise.catch((error) => this.handleError(error));
  }

  private _onWaitingForKey(event: Event) {
    this.log(`"${event.type}" event`);
  }

  private attemptSetMediaKeys(
    keySystem: KeySystems,
    mediaKeys: MediaKeys
  ): Promise<void> {
    const queue = this.setMediaKeysQueue.slice();

    this.log(`Setting media-keys for "${keySystem}"`);
    // Only one setMediaKeys() can run at one time, and multiple setMediaKeys() operations
    // can be queued for execution for multiple key sessions.
    const setMediaKeysPromise = Promise.all(queue).then(() => {
      if (!this.media) {
        throw new Error(
          'Attempted to set mediaKeys without media element attached'
        );
      }
      return this.media.setMediaKeys(mediaKeys);
    });
    this.setMediaKeysQueue.push(setMediaKeysPromise);
    return setMediaKeysPromise.then(() => {
      this.log(`Media-keys set for "${keySystem}"`);
      queue.push(setMediaKeysPromise!);
      this.setMediaKeysQueue = this.setMediaKeysQueue.filter(
        (p) => queue.indexOf(p) === -1
      );
    });
  }

  private generateRequestWithPreferredKeySession(
    context: MediaKeySessionContext,
    initDataType: string,
    initData: ArrayBuffer | null
  ): Promise<MediaKeySessionContext> | never {
    const generateRequestFilter =
      this.config.drmSystems?.[context.keySystem]?.generateRequest;
    if (generateRequestFilter) {
      try {
        const mappedInitData = generateRequestFilter.call(
          this.hls,
          initDataType,
          initData,
          context
        );
        initDataType = mappedInitData.initDataType;
        initData = mappedInitData.initData;
      } catch (error) {
        this.error(error);
      }
    }

    if (!initData) {
      throw new EMEKeyError(
        {
          type: ErrorTypes.KEY_SYSTEM_ERROR,
          details: ErrorDetails.KEY_SYSTEM_NO_INIT_DATA,
          fatal: true,
        },
        'Fatal: initData required for generating a key session is null'
      );
    }

    const keyId = this.getKeyIdString(context.decryptdata);
    this.log(
      `Generating key-session request for ${keyId} (init data type: ${initDataType} length: ${
        initData ? initData.byteLength : null
      })`
    );

    const licenseStatus = new EventEmitter();

    context.mediaKeysSession.onmessage = (event: MediaKeyMessageEvent) => {
      const keySession = context.mediaKeysSession;
      if (!keySession) {
        licenseStatus.emit('error', new Error('invalid state'));
        return;
      }
      const { messageType, message } = event;
      this.log(
        `"${messageType}" message event for session "${keySession.sessionId}" message size: ${message.byteLength}`
      );
      if (
        messageType === 'license-request' ||
        messageType === 'license-renewal'
      ) {
        this.renewLicense(context, message).catch((error) => {
          this.handleError(error);
          licenseStatus.emit('error', error);
        });
      } else if (messageType === 'license-release') {
        if (context.keySystem === KeySystems.FAIRPLAY) {
          this.updateKeySession(context, strToUtf8array('acknowledged'));
          this.removeSession(context);
        }
      } else {
        this.warn(`unhandled media key message type "${messageType}"`);
      }
    };

    context.mediaKeysSession.onkeystatuseschange = (
      event: MediaKeyMessageEvent
    ) => {
      const keySession = context.mediaKeysSession;
      if (!keySession) {
        licenseStatus.emit('error', new Error('invalid state'));
        return;
      }
      this.onKeyStatusChange(context);
      const keyStatus = context.keyStatus;
      licenseStatus.emit('keyStatus', keyStatus);
      if (keyStatus === 'expired') {
        this.warn(`${context.keySystem} expired for key ${keyId}`);
        this.renewKeySession(context);
      }
    };

    const keyUsablePromise = new Promise(
      (resolve: (value?: void) => void, reject) => {
        licenseStatus.on('error', reject);

        licenseStatus.on('keyStatus', (keyStatus) => {
          if (keyStatus.startsWith('usable')) {
            resolve();
          } else if (keyStatus === 'output-restricted') {
            reject(
              new EMEKeyError(
                {
                  type: ErrorTypes.KEY_SYSTEM_ERROR,
                  details: ErrorDetails.KEY_SYSTEM_STATUS_OUTPUT_RESTRICTED,
                  fatal: false,
                },
                'HDCP level output restricted'
              )
            );
          } else if (keyStatus === 'internal-error') {
            reject(
              new EMEKeyError(
                {
                  type: ErrorTypes.KEY_SYSTEM_ERROR,
                  details: ErrorDetails.KEY_SYSTEM_STATUS_INTERNAL_ERROR,
                  fatal: true,
                },
                `key status changed to "${keyStatus}"`
              )
            );
          } else if (keyStatus === 'expired') {
            reject(new Error('key expired while generating request'));
          } else {
            this.warn(`unhandled key status change "${keyStatus}"`);
          }
        });
      }
    );

    return context.mediaKeysSession
      .generateRequest(initDataType, initData)
      .then(() => {
        this.log(
          `Request generated for key-session "${context.mediaKeysSession?.sessionId}" keyId: ${keyId}`
        );
      })
      .catch((error) => {
        throw new EMEKeyError(
          {
            type: ErrorTypes.KEY_SYSTEM_ERROR,
            details: ErrorDetails.KEY_SYSTEM_NO_SESSION,
            error,
            fatal: false,
          },
          `Error generating key-session request: ${error}`
        );
      })
      .then(() => keyUsablePromise)
      .catch((error) => {
        licenseStatus.removeAllListeners();
        this.removeSession(context);
        throw error;
      })
      .then(() => {
        licenseStatus.removeAllListeners();
        return context;
      });
  }

  private onKeyStatusChange(mediaKeySessionContext: MediaKeySessionContext) {
    mediaKeySessionContext.mediaKeysSession.keyStatuses.forEach(
      (status: MediaKeyStatus, keyId: BufferSource) => {
        this.log(
          `key status change "${status}" for keyStatuses keyId: ${Hex.hexDump(
            'buffer' in keyId
              ? new Uint8Array(keyId.buffer, keyId.byteOffset, keyId.byteLength)
              : new Uint8Array(keyId)
          )} session keyId: ${Hex.hexDump(
            new Uint8Array(mediaKeySessionContext.decryptdata.keyId || [])
          )} uri: ${mediaKeySessionContext.decryptdata.uri}`
        );
        mediaKeySessionContext.keyStatus = status;
      }
    );
  }

  private fetchServerCertificate(
    keySystem: KeySystems
  ): Promise<BufferSource | void> {
    return new Promise((resolve, reject) => {
      const url = this.getServerCertificateUrl(keySystem);
      if (!url) {
        return resolve();
      }
      this.log(`Fetching serverCertificate for "${keySystem}"`);
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'arraybuffer';
      xhr.onreadystatechange = () => {
        if (xhr.readyState === XMLHttpRequest.DONE) {
          if (xhr.status === 200) {
            resolve(xhr.response);
          } else {
            reject(
              new EMEKeyError(
                {
                  type: ErrorTypes.KEY_SYSTEM_ERROR,
                  details:
                    ErrorDetails.KEY_SYSTEM_SERVER_CERTIFICATE_REQUEST_FAILED,
                  fatal: true,
                  networkDetails: xhr,
                },
                `HTTP error ${xhr.status} happened while fetching server certificate`
              )
            );
          }
        }
      };
      xhr.send();
    });
  }

  private setMediaKeysServerCertificate(
    mediaKeys: MediaKeys,
    keySystem: KeySystems,
    cert: BufferSource
  ): Promise<MediaKeys> {
    return new Promise((resolve, reject) => {
      mediaKeys
        .setServerCertificate(cert)
        .then((success) => {
          this.log(
            `setServerCertificate ${
              success ? 'success' : 'not supported by CDM'
            } (${cert?.byteLength}) on "${keySystem}"`
          );
          resolve(mediaKeys);
        })
        .catch((error) => {
          reject(
            new EMEKeyError(
              {
                type: ErrorTypes.KEY_SYSTEM_ERROR,
                details:
                  ErrorDetails.KEY_SYSTEM_SERVER_CERTIFICATE_UPDATE_FAILED,
                error,
                fatal: true,
              },
              error.message
            )
          );
        });
    });
  }

  private renewLicense(
    context: MediaKeySessionContext,
    keyMessage: ArrayBuffer
  ): Promise<void> {
    const licenseChallenge = this.generateLicenseRequestChallenge(
      context,
      keyMessage
    );
    return this.requestLicense(context, licenseChallenge).then(
      (data: ArrayBuffer) => {
        const licenseResponse: Uint8Array = this.handleParsedKeyResponse(
          context,
          data
        );
        return this.updateKeySession(context, licenseResponse).catch(
          (error) => {
            throw new EMEKeyError(
              {
                type: ErrorTypes.KEY_SYSTEM_ERROR,
                details: ErrorDetails.KEY_SYSTEM_SESSION_UPDATE_FAILED,
                error,
                fatal: true,
              },
              error.message
            );
          }
        );
      }
    );
  }

  private setupLicenseXHR(
    xhr: XMLHttpRequest,
    url: string,
    keysListItem: MediaKeySessionContext,
    licenseChallenge: Uint8Array
  ): Promise<{ xhr: XMLHttpRequest; licenseChallenge: Uint8Array }> {
    const licenseXhrSetup = this.config.licenseXhrSetup;

    if (!licenseXhrSetup) {
      xhr.open('POST', url, true);

      return Promise.resolve({ xhr, licenseChallenge });
    }

    return Promise.resolve()
      .then(() => {
        if (!keysListItem.decryptdata) {
          throw new Error('Key removed');
        }
        return licenseXhrSetup.call(
          this.hls,
          xhr,
          url,
          keysListItem,
          licenseChallenge
        );
      })
      .catch((error: Error) => {
        if (!keysListItem.decryptdata) {
          // Key session removed. Cancel license request.
          throw error;
        }
        // let's try to open before running setup
        xhr.open('POST', url, true);

        return licenseXhrSetup.call(
          this.hls,
          xhr,
          url,
          keysListItem,
          licenseChallenge
        );
      })
      .then((licenseXhrSetupResult) => {
        // if licenseXhrSetup did not yet call open, let's do it now
        if (!xhr.readyState) {
          xhr.open('POST', url, true);
        }
        const finalLicenseChallenge = licenseXhrSetupResult
          ? licenseXhrSetupResult
          : licenseChallenge;
        return { xhr, licenseChallenge: finalLicenseChallenge };
      });
  }

  private requestLicense(
    keySessionContext: MediaKeySessionContext,
    licenseChallenge: Uint8Array
  ): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const url = this.getLicenseServerUrl(keySessionContext.keySystem);
      this.log(`Sending license request to URL: ${url}`);
      const xhr = new XMLHttpRequest();
      xhr.responseType = 'arraybuffer';
      xhr.onreadystatechange = () => {
        if (!this.hls || !keySessionContext.mediaKeysSession) {
          return reject(new Error('invalid state'));
        }
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            this._requestLicenseFailureCount = 0;
            let data = xhr.response;
            this.log(
              `License received ${
                data instanceof ArrayBuffer ? data.byteLength : data
              }`
            );
            const licenseResponseCallback = this.config.licenseResponseCallback;
            if (licenseResponseCallback) {
              try {
                data = licenseResponseCallback.call(
                  this.hls,
                  xhr,
                  url,
                  keySessionContext
                );
              } catch (error) {
                this.error(error);
              }
            }
            resolve(data);
          } else {
            const error = new Error(
              `License Request XHR failed (${url}). Status: ${xhr.status} (${xhr.statusText})`
            );
            this._requestLicenseFailureCount++;
            if (
              this._requestLicenseFailureCount > MAX_LICENSE_REQUEST_FAILURES ||
              (xhr.status >= 400 && xhr.status < 500)
            ) {
              reject(
                new EMEKeyError(
                  {
                    type: ErrorTypes.KEY_SYSTEM_ERROR,
                    details: ErrorDetails.KEY_SYSTEM_LICENSE_REQUEST_FAILED,
                    error,
                    fatal: true,
                    networkDetails: xhr,
                  },
                  error.message
                )
              );
            } else {
              const attemptsLeft =
                MAX_LICENSE_REQUEST_FAILURES -
                this._requestLicenseFailureCount +
                1;
              this.warn(
                `Retrying license request, ${attemptsLeft} attempts left`
              );
              this.requestLicense(keySessionContext, licenseChallenge).then(
                resolve,
                reject
              );
            }
          }
        }
      };
      if (
        keySessionContext.licenseXhr &&
        keySessionContext.licenseXhr.readyState !== XMLHttpRequest.DONE
      ) {
        keySessionContext.licenseXhr.abort();
      }
      keySessionContext.licenseXhr = xhr;

      this.setupLicenseXHR(xhr, url, keySessionContext, licenseChallenge).then(
        ({ xhr, licenseChallenge }) => {
          xhr.send(licenseChallenge);
        }
      );
    });
  }

  private generateLicenseRequestChallenge(
    keySessionContext: MediaKeySessionContext,
    keyMessage: ArrayBuffer
  ): Uint8Array | never {
    const message = new Uint8Array(keyMessage);
    switch (keySessionContext.keySystem) {
      case KeySystems.FAIRPLAY: {
        if (keySessionContext.decryptdata?.keyId) {
          const messageJson = utf8ArrayToStr(message);
          try {
            const spcArray = JSON.parse(messageJson);
            const keyID = base64Encode(keySessionContext.decryptdata.keyId);
            // this.log(`License challenge message with key IDs: ${spcArray.map(p => p.keyID).join(', ')}`);
            for (let i = 0; i < spcArray.length; i++) {
              const payload = spcArray[i];
              if (payload.keyID === keyID) {
                this.log(
                  `Generateing license challenge with ID ${payload.keyID}`
                );
                const spc = base64Decode(payload.payload);
                return spc;
              }
            }
          } catch (error) {
            this.warn(
              `Failed to extract spc from FairPlay license-request message. Fallback to message data for key uri: "${keySessionContext.decryptdata.uri}"`
            );
          }
        }
        return message;
      }
      case KeySystems.WIDEVINE:
      case KeySystems.PLAYREADY:
      case KeySystems.CLEARKEY:
        return message;
      default:
        throw new Error(
          `unsupported key-system: ${keySessionContext.keySystem}`
        );
    }
  }

  private onMediaAttached(
    event: Events.MEDIA_ATTACHED,
    data: MediaAttachedData
  ) {
    if (!this.config.emeEnabled) {
      return;
    }

    const media = data.media;

    // keep reference of media
    this.media = media;

    media.addEventListener('encrypted', this.onMediaEncrypted);
    media.addEventListener('waitingforkey', this.onWaitingForKey);
  }

  private onMediaDetached() {
    const media = this.media;
    const mediaKeysList = this.mediaKeySessions;
    if (media) {
      media.removeEventListener('encrypted', this.onMediaEncrypted);
      media.removeEventListener('waitingforkey', this.onWaitingForKey);
      this.media = null;
    }

    this._requestLicenseFailureCount = 0;
    this.setMediaKeysQueue = [];
    this.mediaKeySessions = [];
    this.keyIdToKeySessionPromise = {};
    LevelKey.clearKeyUriToKeyIdMap();

    // Close all sessions and remove media keys from the video element.
    const keySessionCount = mediaKeysList.length;
    EMEController.CDMCleanupPromise = Promise.all(
      mediaKeysList
        .map((mediaKeySessionContext) =>
          this.removeSession(mediaKeySessionContext)
        )
        .concat(
          media?.setMediaKeys(null).catch((error) => {
            this.log(
              `Could not clear media keys: ${error}. media.src: ${media?.src}`
            );
          })
        )
    )
      .then(() => {
        if (keySessionCount) {
          this.log('finished closing key sessions and clearing media keys');
          mediaKeysList.length = 0;
        }
      })
      .catch((error) => {
        this.log(
          `Could not close sessions and clear media keys: ${error}. media.src: ${media?.src}`
        );
      });
  }

  private onManifestLoaded(
    event: Events.MANIFEST_LOADED,
    { sessionKeys }: ManifestLoadedData
  ) {
    if (!sessionKeys || !this.config.emeEnabled) {
      return;
    }
    if (!this.keyFormatPromise) {
      const keyFormats: KeySystemFormats[] = sessionKeys.reduce(
        (formats: KeySystemFormats[], sessionKey: LevelKey) => {
          if (
            formats.indexOf(sessionKey.keyFormat as KeySystemFormats) === -1
          ) {
            formats.push(sessionKey.keyFormat as KeySystemFormats);
          }
          return formats;
        },
        []
      );
      this.log(
        `Selecting key-system from session-keys ${keyFormats.join(', ')}`
      );
      this.keyFormatPromise = this.getKeyFormatPromise(keyFormats);
    }
  }

  private removeSession(
    mediaKeySessionContext: MediaKeySessionContext
  ): Promise<void> | void {
    const { mediaKeysSession, licenseXhr } = mediaKeySessionContext;
    if (mediaKeysSession) {
      this.log(
        `Remove licenses and keys and close session ${mediaKeysSession.sessionId}`
      );
      mediaKeysSession.onmessage = null;
      mediaKeysSession.onkeystatuseschange = null;
      if (licenseXhr && licenseXhr.readyState !== XMLHttpRequest.DONE) {
        licenseXhr.abort();
      }
      mediaKeySessionContext.mediaKeysSession =
        mediaKeySessionContext.decryptdata =
        mediaKeySessionContext.licenseXhr =
          undefined!;
      const index = this.mediaKeySessions.indexOf(mediaKeySessionContext);
      if (index > -1) {
        this.mediaKeySessions.splice(index, 1);
      }
      return mediaKeysSession
        .remove()
        .catch((error) => {
          this.log(`Could not remove session: ${error}`);
        })
        .then(() => {
          return mediaKeysSession.close();
        })
        .catch((error) => {
          this.log(`Could not close session: ${error}`);
        });
    }
  }
}

class EMEKeyError extends Error {
  public readonly data: ErrorData;
  constructor(data: ErrorData, message: string) {
    super(message);
    this.data = data;
    data.err = data.error;
  }
}

export default EMEController;
