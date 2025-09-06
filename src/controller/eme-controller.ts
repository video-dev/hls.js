/**
 * @author Stephan Hesse <disparat@gmail.com> | <tchakabam@gmail.com>
 *
 * DRM support for Hls.js
 */
import { EventEmitter } from 'eventemitter3';
import { ErrorDetails, ErrorTypes } from '../errors';
import { Events } from '../events';
import { LevelKey } from '../loader/level-key';
import { arrayValuesMatch } from '../utils/arrays';
import {
  addEventListener,
  removeEventListener,
} from '../utils/event-listener-helper';
import { arrayToHex } from '../utils/hex';
import { changeEndianness } from '../utils/keysystem-util';
import { Logger } from '../utils/logger';
import {
  getKeySystemsForConfig,
  getSupportedMediaKeySystemConfigurations,
  isPersistentSessionType,
  keySystemDomainToKeySystemFormat,
  keySystemFormatToKeySystemDomain,
  KeySystems,
  requestMediaKeySystemAccess,
} from '../utils/mediakeys-helper';
import { bin2str, parseSinf } from '../utils/mp4-tools';
import { base64Decode } from '../utils/numeric-encoding-utils';
import { stringify } from '../utils/safe-json-stringify';
import { strToUtf8array } from '../utils/utf8-utils';
import type { EMEControllerConfig, HlsConfig, LoadPolicy } from '../config';
import type Hls from '../hls';
import type { Fragment } from '../loader/fragment';
import type { DecryptData } from '../loader/level-key';
import type { ComponentAPI } from '../types/component-api';
import type {
  ErrorData,
  KeyLoadedData,
  ManifestLoadedData,
  MediaAttachedData,
} from '../types/events';
import type {
  Loader,
  LoaderCallbacks,
  LoaderConfiguration,
  LoaderContext,
} from '../types/loader';
import type { KeySystemFormats } from '../utils/mediakeys-helper';

interface KeySystemAccessPromises {
  keySystemAccess: Promise<MediaKeySystemAccess>;
  mediaKeys?: Promise<MediaKeys>;
  certificate?: Promise<BufferSource | void>;
  hasMediaKeys?: boolean;
}

export interface MediaKeySessionContext {
  keySystem: KeySystems;
  levelKeys: LevelKey[];
  mediaKeys: MediaKeys;
  mediaKeysSession: MediaKeySession;
  keyStatuses: { [keyId: string]: MediaKeyStatus };
  keyStatusTimeouts?: { [keyId: string]: number };
  licenseXhr?: XMLHttpRequest;
  _onmessage?: (this: MediaKeySession, ev: MediaKeyMessageEvent) => any;
  _onkeystatuseschange?: (this: MediaKeySession, ev: Event) => any;
}

// TODO: Remove duplicate typing (interface -> type (type is event specific))
export type MediaKeySessionContextAndLevelKey = {
  decryptdata: LevelKey; // soft-deprecated (replaced by levelKeys)
  keySystem: KeySystems;
  levelKeys: LevelKey[];
  mediaKeys: MediaKeys;
  mediaKeysSession: MediaKeySession;
  keyStatuses: { [keyId: string]: MediaKeyStatus };
  keyStatusTimeouts?: { [keyId: string]: number };
  licenseXhr?: XMLHttpRequest;
};

/**
 * Controller to deal with encrypted media extensions (EME)
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Encrypted_Media_Extensions_API
 *
 * @class
 * @constructor
 */
class EMEController extends Logger implements ComponentAPI {
  public static CDMCleanupPromise: Promise<void> | void;

  private readonly hls: Hls;
  private readonly config: EMEControllerConfig & {
    loader: { new (confg: HlsConfig): Loader<LoaderContext> };
    certLoadPolicy: LoadPolicy;
    keyLoadPolicy: LoadPolicy;
  };
  private media: HTMLMediaElement | null = null;
  private mediaResolved?: () => void;
  private keyFormatPromise: Promise<KeySystemFormats> | null = null;
  private keySystemAccessPromises: {
    [keysystem: string]: KeySystemAccessPromises | undefined;
  } = {};
  private _requestLicenseFailureCount: number = 0;
  private mediaKeySessions: MediaKeySessionContext[] = [];
  // TODO: keyUsablePromises (per KeyId, resolves on (startsWith) "usable", deleted when changed to expired or released)
  // TODO: One session with updates, or session queue for playlist (disco, timerange, etc...) and key rotation context?
  private keyUriToSessionPromise: {
    [keyUri: string]: Promise<MediaKeySessionContext> | undefined;
  } = {};
  private keyUriToLevelKeys: {
    [keyUri: string]: LevelKey[] | undefined;
  } = {};
  private mediaKeys: MediaKeys | null = null;
  private setMediaKeysQueue: Promise<void>[] = EMEController.CDMCleanupPromise
    ? [EMEController.CDMCleanupPromise]
    : [];

  constructor(hls: Hls) {
    super('eme', hls.logger);
    this.hls = hls;
    this.config = hls.config;
    this.registerListeners();
  }

  public destroy() {
    this.onDestroying();
    this.onMediaDetached();
    // Remove any references that could be held in config options or callbacks
    const config = this.config;
    config.requestMediaKeySystemAccessFunc = null;
    config.licenseXhrSetup = config.licenseResponseCallback = undefined;
    config.drmSystems = config.drmSystemOptions = {};
    // @ts-ignore
    this.hls = this.config = null;
    // @ts-ignore
    this.keyUriToSessionPromise = this.keyUriToLevelKeys = null;
    // @ts-ignore
    this.onMediaEncrypted = this.onWaitingForKey = null;
  }

  private registerListeners() {
    this.hls.on(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    this.hls.on(Events.MEDIA_DETACHED, this.onMediaDetached, this);
    this.hls.on(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    this.hls.on(Events.MANIFEST_LOADED, this.onManifestLoaded, this);
    this.hls.on(Events.DESTROYING, this.onDestroying, this);
  }

  private unregisterListeners() {
    this.hls.off(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    this.hls.off(Events.MEDIA_DETACHED, this.onMediaDetached, this);
    this.hls.off(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    this.hls.off(Events.MANIFEST_LOADED, this.onManifestLoaded, this);
    this.hls.off(Events.DESTROYING, this.onDestroying, this);
  }

  private getLicenseServerUrl(keySystem: KeySystems): string | undefined {
    const { drmSystems, widevineLicenseUrl } = this.config;
    const keySystemConfiguration = drmSystems?.[keySystem];

    if (keySystemConfiguration) {
      return keySystemConfiguration.licenseUrl;
    }

    // For backward compatibility
    if (keySystem === KeySystems.WIDEVINE && widevineLicenseUrl) {
      return widevineLicenseUrl;
    }
  }

  private getLicenseServerUrlOrThrow(keySystem: KeySystems): string | never {
    const url = this.getLicenseServerUrl(keySystem);
    if (url === undefined) {
      throw new Error(
        `no license server URL configured for key-system "${keySystem}"`,
      );
    }
    return url;
  }

  private getServerCertificateUrl(keySystem: KeySystems): string | void {
    const { drmSystems } = this.config;
    const keySystemConfiguration = drmSystems?.[keySystem];

    if (keySystemConfiguration) {
      return keySystemConfiguration.serverCertificateUrl;
    } else {
      this.log(`No Server Certificate in config.drmSystems["${keySystem}"]`);
    }
  }

  private attemptKeySystemAccess(
    keySystemsToAttempt: KeySystems[],
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
        reject: (Error) => void,
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
                    error.message,
                  ),
                );
              }
            });
        };
        attempt(keySystemsToAttempt);
      },
    );
  }

  private requestMediaKeySystemAccess(
    keySystem: KeySystems,
    supportedConfigurations: MediaKeySystemConfiguration[],
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
    videoCodecs: string[],
  ): Promise<MediaKeys> {
    // This can throw, but is caught in event handler callpath
    const mediaKeySystemConfigs = getSupportedMediaKeySystemConfigurations(
      keySystem,
      audioCodecs,
      videoCodecs,
      this.config.drmSystemOptions || {},
    );
    let keySystemAccessPromises = this.keySystemAccessPromises[keySystem];
    let keySystemAccess = keySystemAccessPromises?.keySystemAccess;
    if (!keySystemAccess) {
      this.log(
        `Requesting encrypted media "${keySystem}" key-system access with config: ${stringify(
          mediaKeySystemConfigs,
        )}`,
      );
      keySystemAccess = this.requestMediaKeySystemAccess(
        keySystem,
        mediaKeySystemConfigs,
      );
      const keySystemAccessPromisesNew = (keySystemAccessPromises =
        this.keySystemAccessPromises[keySystem] =
          {
            keySystemAccess,
          }) as KeySystemAccessPromises;
      keySystemAccess.catch((error) => {
        this.log(
          `Failed to obtain access to key-system "${keySystem}": ${error}`,
        );
      });
      return keySystemAccess.then((mediaKeySystemAccess) => {
        this.log(
          `Access for key-system "${mediaKeySystemAccess.keySystem}" obtained`,
        );

        const certificateRequest = this.fetchServerCertificate(keySystem);

        this.log(`Create media-keys for "${keySystem}"`);
        const mediaKeys = (keySystemAccessPromisesNew.mediaKeys =
          mediaKeySystemAccess.createMediaKeys().then((mediaKeys) => {
            this.log(`Media-keys created for "${keySystem}"`);
            keySystemAccessPromisesNew.hasMediaKeys = true;
            return certificateRequest.then((certificate) => {
              if (certificate) {
                return this.setMediaKeysServerCertificate(
                  mediaKeys,
                  keySystem,
                  certificate,
                );
              }
              return mediaKeys;
            });
          }));

        mediaKeys.catch((error) => {
          this.error(
            `Failed to create media-keys for "${keySystem}"}: ${error}`,
          );
        });

        return mediaKeys;
      });
    }
    return keySystemAccess.then(() => keySystemAccessPromises!.mediaKeys!);
  }

  private createMediaKeySessionContext(
    {
      levelKeys,
      keySystem,
      mediaKeys,
    }: {
      levelKeys: LevelKey[];
      keySystem: KeySystems;
      mediaKeys: MediaKeys;
    },
    decryptdata: LevelKey,
  ): MediaKeySessionContext {
    this.log(
      `Creating key-system session "${keySystem}" keyId: ${arrayToHex(
        decryptdata.keyId || ([] as number[]),
      )} keyUri: ${decryptdata.uri}`,
    );

    const mediaKeysSession = mediaKeys.createSession();

    const mediaKeySessionContext: MediaKeySessionContext = {
      levelKeys,
      keySystem,
      mediaKeys,
      mediaKeysSession,
      keyStatuses: {},
    };

    this.mediaKeySessions.push(mediaKeySessionContext);

    return mediaKeySessionContext;
  }

  private renewKeySession(
    mediaKeySessionContext: MediaKeySessionContext,
    levelKey: LevelKey,
  ) {
    if (levelKey.pssh) {
      const keySessionContext = this.createMediaKeySessionContext(
        mediaKeySessionContext,
        levelKey,
      );
      const keyUri = levelKey.uri;
      const scheme = 'cenc';
      this.keyUriToSessionPromise[keyUri] =
        this.generateRequestWithPreferredKeySession(
          keySessionContext,
          scheme,
          levelKey.pssh.buffer,
          'expired',
          levelKey,
        );
    } else {
      this.warn(`Could not renew expired session. Missing pssh initData.`);
    }
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.removeSession(mediaKeySessionContext);
  }

  private updateKeySession(
    mediaKeySessionContext: MediaKeySessionContext,
    decryptdata: LevelKey,
    data: Uint8Array<ArrayBuffer>,
  ): Promise<void> {
    const keySession = mediaKeySessionContext.mediaKeysSession;
    this.log(
      `Updating key-session "${keySession.sessionId}" for keyId ${arrayToHex(
        decryptdata.keyId || [],
      )}
      } (data length: ${data.byteLength})`,
    );
    return keySession.update(data);
  }

  public getSelectedKeySystemFormats(): KeySystemFormats[] {
    return (Object.keys(this.keySystemAccessPromises) as KeySystems[])
      .map((keySystem) => ({
        keySystem,
        hasMediaKeys: this.keySystemAccessPromises[keySystem]!.hasMediaKeys,
      }))
      .filter(({ hasMediaKeys }) => !!hasMediaKeys)
      .map(({ keySystem }) => keySystemDomainToKeySystemFormat(keySystem))
      .filter((keySystem): keySystem is KeySystemFormats => !!keySystem);
  }

  public getKeySystemAccess(keySystemsToAttempt: KeySystems[]): Promise<void> {
    return this.getKeySystemSelectionPromise(keySystemsToAttempt).then(
      ({ keySystem, mediaKeys }) => {
        return this.attemptSetMediaKeys(keySystem, mediaKeys);
      },
    );
  }

  public selectKeySystem(
    keySystemsToAttempt: KeySystems[],
  ): Promise<KeySystemFormats> {
    return new Promise((resolve, reject) => {
      this.getKeySystemSelectionPromise(keySystemsToAttempt)
        .then(({ keySystem }) => {
          const keySystemFormat = keySystemDomainToKeySystemFormat(keySystem);
          if (keySystemFormat) {
            resolve(keySystemFormat);
          } else {
            reject(
              new Error(`Unable to find format for key-system "${keySystem}"`),
            );
          }
        })
        .catch(reject);
    });
  }

  public selectKeySystemFormat(frag: Fragment): Promise<KeySystemFormats> {
    const keyFormats = Object.keys(frag.levelkeys || {}) as KeySystemFormats[];
    if (!this.keyFormatPromise) {
      this.log(
        `Selecting key-system from fragment (sn: ${frag.sn} ${frag.type}: ${
          frag.level
        }) key formats ${keyFormats.join(', ')}`,
      );
      this.keyFormatPromise = this.getKeyFormatPromise(keyFormats);
    }
    return this.keyFormatPromise;
  }

  private getKeyFormatPromise(
    keyFormats: KeySystemFormats[],
  ): Promise<KeySystemFormats> {
    const keySystemsInConfig = getKeySystemsForConfig(this.config);
    const keySystemsToAttempt = keyFormats
      .map(keySystemFormatToKeySystemDomain)
      .filter(
        (value) => !!value && keySystemsInConfig.indexOf(value) !== -1,
      ) as any as KeySystems[];

    return this.selectKeySystem(keySystemsToAttempt);
  }

  public getKeyStatus(decryptdata: LevelKey): MediaKeyStatus | undefined {
    const { mediaKeySessions } = this;
    for (let i = 0; i < mediaKeySessions.length; i++) {
      const status = getKeyStatus(decryptdata, mediaKeySessions[i]);
      if (status) {
        return status;
      }
    }
    return undefined;
  }

  public loadKey(data: KeyLoadedData): Promise<MediaKeySessionContext> {
    const levelKey = data.keyInfo.decryptdata;

    // Error immediately when encountering a key ID with this status again
    const status = this.getKeyStatus(levelKey);
    if (status === 'internal-error') {
      const error = getKeyStatusError(status, levelKey);
      this.handleError(error, data.frag);
      return Promise.reject(error);
    }

    const keyUri = levelKey.uri;

    // Keep collection of level-keys associated with Key URI and key-session context
    let levelKeys = this.keyUriToLevelKeys[keyUri];
    if (!levelKeys) {
      levelKeys = this.keyUriToLevelKeys[keyUri] = [levelKey];
    } else if (
      !levelKeys.some((decryptdata) => decryptdata.matches(levelKey))
    ) {
      levelKeys.push(levelKey);
    }

    // Get key-session context async
    const keyContextPromise = this.keyUriToSessionPromise[keyUri];
    if (!keyContextPromise) {
      const keyId = getKeyIdString(levelKey);
      const keyDetails = `(keyId: ${keyId} URI: ${keyUri} format: "${levelKey.keyFormat}" method: ${levelKey.method})`;
      this.log(`Starting session for key ${keyDetails}`);
      const keySessionContextPromise = this.getKeySystemForKeyPromise(levelKey)
        .then(({ keySystem, mediaKeys }) => {
          this.throwIfDestroyed();
          this.log(
            `Handle encrypted media sn: ${data.frag.sn} ${data.frag.type}: ${data.frag.level} using key ${keyDetails}`,
          );

          return this.attemptSetMediaKeys(keySystem, mediaKeys).then(() => {
            this.throwIfDestroyed();
            return this.createMediaKeySessionContext(
              {
                keySystem,
                mediaKeys,
                levelKeys,
              },
              levelKey,
            );
          });
        })
        .then((keySessionContext) => {
          const scheme = 'cenc';
          const initData = levelKey.pssh ? levelKey.pssh.buffer : null;
          return this.generateRequestWithPreferredKeySession(
            keySessionContext,
            scheme,
            initData,
            'playlist-key',
            levelKey,
          );
        });

      keySessionContextPromise.catch((error) =>
        this.handleError(error, data.frag),
      );
      this.keyUriToSessionPromise[keyUri] = keySessionContextPromise;

      return keySessionContextPromise;
    }

    // Re-emit error for playlist key loading
    keyContextPromise.catch((error) => {
      if (error instanceof EMEKeyError) {
        const errorData = { ...error.data };
        if (this.getKeyStatus(levelKey) === 'internal-error') {
          errorData.decryptdata = levelKey;
        }
        const clonedError = new EMEKeyError(errorData, error.message);
        this.handleError(clonedError, data.frag);
      }
    });

    return keyContextPromise;
  }

  private throwIfDestroyed(message = 'Invalid state'): void | never {
    if (!this.hls as any) {
      throw new Error('invalid state');
    }
  }

  private handleError(error: EMEKeyError | Error, frag?: Fragment) {
    if (!this.hls as any) {
      return;
    }

    if (error instanceof EMEKeyError) {
      if (frag) {
        error.data.frag = frag;
      }
      const levelKey = error.data.decryptdata;
      this.error(
        `${error.message}${
          levelKey ? ` (${arrayToHex(levelKey.keyId || [])})` : ''
        }`,
      );
      this.hls.trigger(Events.ERROR, error.data);
    } else {
      this.error(error.message);
      this.hls.trigger(Events.ERROR, {
        type: ErrorTypes.KEY_SYSTEM_ERROR,
        details: ErrorDetails.KEY_SYSTEM_NO_KEYS,
        error,
        fatal: true,
      });
    }
  }

  private getKeySystemForKeyPromise(
    decryptdata: LevelKey,
  ): Promise<{ keySystem: KeySystems; mediaKeys: MediaKeys }> {
    const keyUri = decryptdata.uri;
    const mediaKeySessionContext = this.keyUriToSessionPromise[keyUri];
    if (!mediaKeySessionContext) {
      const keySystem = keySystemFormatToKeySystemDomain(
        decryptdata.keyFormat as KeySystemFormats,
      );
      const keySystemsToAttempt = keySystem
        ? [keySystem]
        : getKeySystemsForConfig(this.config);
      return this.attemptKeySystemAccess(keySystemsToAttempt);
    }
    return mediaKeySessionContext;
  }

  private getKeySystemSelectionPromise(
    keySystemsToAttempt: KeySystems[],
  ): Promise<{ keySystem: KeySystems; mediaKeys: MediaKeys }> | never {
    if (!keySystemsToAttempt.length) {
      keySystemsToAttempt = getKeySystemsForConfig(this.config);
    }
    if (keySystemsToAttempt.length === 0) {
      throw new EMEKeyError(
        {
          type: ErrorTypes.KEY_SYSTEM_ERROR,
          details: ErrorDetails.KEY_SYSTEM_NO_CONFIGURED_LICENSE,
          fatal: true,
        },
        `Missing key-system license configuration options ${stringify({
          drmSystems: this.config.drmSystems,
        })}`,
      );
    }
    return this.attemptKeySystemAccess(keySystemsToAttempt);
  }

  private onMediaEncrypted = (event: MediaEncryptedEvent) => {
    const { initDataType, initData } = event;
    const logMessage = `"${event.type}" event: init data type: "${initDataType}"`;
    this.debug(logMessage);

    // Ignore event when initData is null
    if (initData === null) {
      return;
    }

    if (!this.keyFormatPromise) {
      let keySystems = Object.keys(
        this.keySystemAccessPromises,
      ) as KeySystems[];
      if (!keySystems.length) {
        keySystems = getKeySystemsForConfig(this.config);
      }
      const keyFormats = keySystems
        .map(keySystemDomainToKeySystemFormat)
        .filter((k) => !!k) as KeySystemFormats[];
      this.keyFormatPromise = this.getKeyFormatPromise(keyFormats);
    }

    this.keyFormatPromise
      .then((keySystemFormat) => {
        const keySystem = keySystemFormatToKeySystemDomain(keySystemFormat);
        if (initDataType !== 'sinf' || keySystem !== KeySystems.FAIRPLAY) {
          this.log(
            `Ignoring "${event.type}" event with init data type: "${initDataType}" for selected key-system ${keySystem}`,
          );
          return;
        }

        // Match sinf keyId to playlist skd://keyId=
        let keyId: Uint8Array<ArrayBuffer> | undefined;
        try {
          const json = bin2str(new Uint8Array(initData));
          const sinf = base64Decode(JSON.parse(json).sinf);
          const tenc = parseSinf(sinf);
          if (!tenc) {
            throw new Error(
              `'schm' box missing or not cbcs/cenc with schi > tenc`,
            );
          }
          keyId = new Uint8Array(tenc.subarray(8, 24));
        } catch (error) {
          this.warn(`${logMessage} Failed to parse sinf: ${error}`);
          return;
        }

        const keyIdHex = arrayToHex(keyId);
        const { keyUriToSessionPromise, mediaKeySessions } = this;
        let keySessionContextPromise:
          | Promise<MediaKeySessionContext>
          | undefined;

        // Match `tenc` box keyId to playlist key in session
        for (let i = 0; i < mediaKeySessions.length; i++) {
          const keyContext = mediaKeySessions[i];
          for (let j = 0; j < keyContext.levelKeys.length; j++) {
            const decryptdata = keyContext.levelKeys[j];
            if (!decryptdata.keyId) {
              continue;
            }
            const sessionKeyUri = decryptdata.uri;
            if (
              arrayValuesMatch(keyId, decryptdata.keyId) ||
              sessionKeyUri.replace(/-/g, '').indexOf(keyIdHex) !== -1
            ) {
              keySessionContextPromise = keyUriToSessionPromise[sessionKeyUri];
              if (!keySessionContextPromise) {
                continue;
              }
              if (decryptdata.pssh) {
                break;
              }
              decryptdata.pssh = new Uint8Array(initData);
              decryptdata.keyId = keyId;
              LevelKey.setKeyIdForUri(sessionKeyUri, keyId);
              keySessionContextPromise = keyUriToSessionPromise[sessionKeyUri] =
                keySessionContextPromise.then(() => {
                  return this.generateRequestWithPreferredKeySession(
                    keyContext,
                    initDataType,
                    initData,
                    'encrypted-event-key-match',
                    decryptdata,
                  );
                });
              keySessionContextPromise.catch((error) =>
                this.handleError(error),
              );
              break;
            }
          }
        }

        if (!keySessionContextPromise) {
          this.handleError(
            new Error(
              `Key ID ${keyIdHex} not encountered in playlist. Key-system sessions ${mediaKeySessions.length}.`,
            ),
          );
        }
      })
      .catch((error) => this.handleError(error));
  };

  private onWaitingForKey = (event: Event) => {
    this.log(`"${event.type}" event`);
  };

  private attemptSetMediaKeys(
    keySystem: KeySystems,
    mediaKeys: MediaKeys,
  ): Promise<void> {
    this.mediaResolved = undefined;
    if (this.mediaKeys === mediaKeys) {
      return Promise.resolve();
    }
    const queue = this.setMediaKeysQueue.slice();

    this.log(`Setting media-keys for "${keySystem}"`);
    // Only one setMediaKeys() can run at one time, and multiple setMediaKeys() operations
    // can be queued for execution for multiple key sessions.
    const setMediaKeysPromise = Promise.all(queue).then(() => {
      if (!this.media) {
        return new Promise((resolve: (value?: void) => void, reject) => {
          this.mediaResolved = () => {
            this.mediaResolved = undefined;
            if (!this.media) {
              return reject(
                new Error(
                  'Attempted to set mediaKeys without media element attached',
                ),
              );
            }
            this.mediaKeys = mediaKeys;
            this.media.setMediaKeys(mediaKeys).then(resolve).catch(reject);
          };
        });
      }
      return this.media.setMediaKeys(mediaKeys);
    });
    this.mediaKeys = mediaKeys;
    this.setMediaKeysQueue.push(setMediaKeysPromise);
    return setMediaKeysPromise.then(() => {
      this.log(`Media-keys set for "${keySystem}"`);
      queue.push(setMediaKeysPromise!);
      this.setMediaKeysQueue = this.setMediaKeysQueue.filter(
        (p) => queue.indexOf(p) === -1,
      );
    });
  }

  private generateRequestWithPreferredKeySession(
    context: MediaKeySessionContext,
    initDataType: string,
    initData: ArrayBuffer | null,
    reason:
      | 'playlist-key'
      | 'encrypted-event-key-match'
      | 'encrypted-event-no-match'
      | 'expired',
    levelKey: LevelKey,
  ): Promise<MediaKeySessionContext> | never {
    const generateRequestFilter =
      this.config.drmSystems?.[context.keySystem]?.generateRequest;
    if (generateRequestFilter) {
      const contextWithLevelKey: MediaKeySessionContextAndLevelKey = {
        decryptdata: levelKey,
        ...context,
      };
      try {
        const mappedInitData: ReturnType<typeof generateRequestFilter> =
          generateRequestFilter.call(
            this.hls,
            initDataType,
            initData,
            contextWithLevelKey,
          );
        if (!mappedInitData) {
          throw new Error(
            'Invalid response from configured generateRequest filter',
          );
        }
        initDataType = mappedInitData.initDataType;
        initData = mappedInitData.initData ? mappedInitData.initData : null;
        levelKey.pssh = initData ? new Uint8Array(initData) : null;
      } catch (error) {
        this.warn(error.message);
        if ((this.hls as any) && this.hls.config.debug) {
          throw error;
        }
      }
    }

    if (initData === null) {
      this.log(`Skipping key-session request for "${reason}" (no initData)`);
      return Promise.resolve(context);
    }

    const keyId = getKeyIdString(levelKey);
    const keyUri = levelKey.uri;
    this.log(
      `Generating key-session request for "${reason}" keyId: ${keyId} URI: ${keyUri} (init data type: ${initDataType} length: ${
        initData.byteLength
      })`,
    );

    const licenseStatus = new EventEmitter();

    const onmessage = (context._onmessage = (event: MediaKeyMessageEvent) => {
      const keySession = context.mediaKeysSession;
      if (!keySession as any) {
        licenseStatus.emit('error', new Error('invalid state'));
        return;
      }
      const { messageType, message } = event;
      this.log(
        `"${messageType}" message event for session "${keySession.sessionId}" message size: ${message.byteLength}`,
      );
      if (
        messageType === 'license-request' ||
        messageType === 'license-renewal'
      ) {
        this.renewLicense(context, levelKey, message).catch((error) => {
          if (licenseStatus.eventNames().length) {
            licenseStatus.emit('error', error);
          } else {
            this.handleError(error);
          }
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.removeSession(context);
        });
      } else if (messageType === 'license-release') {
        if (context.keySystem === KeySystems.FAIRPLAY) {
          this.updateKeySession(
            context,
            levelKey,
            strToUtf8array('acknowledged'),
          )
            .then(() => this.removeSession(context))
            .catch((error) => this.handleError(error));
        }
      } else {
        this.warn(`unhandled media key message type "${messageType}"`);
      }
    });

    const handleKeyStatus = (keyStatus: MediaKeyStatus) => {
      let keyError: EMEKeyError | Error | undefined;
      if (keyStatus.startsWith('usable')) {
        licenseStatus.emit('resolved');
      } else if (
        keyStatus === 'internal-error' ||
        keyStatus === 'output-restricted' ||
        keyStatus === 'output-downscaled'
      ) {
        keyError = getKeyStatusError(keyStatus, levelKey); // TODO: levelKeys (which one?)
      } else if (keyStatus === 'expired') {
        keyError = new Error(`key expired (keyId: ${keyId})`);
      } else if (keyStatus === 'released') {
        keyError = new Error(`key released`);
      } else if (keyStatus === 'status-pending') {
        /* no-op */
      } else {
        this.warn(
          `unhandled key status change "${keyStatus}" (keyId: ${keyId})`,
        );
      }
      if (keyError) {
        if (licenseStatus.eventNames().length) {
          licenseStatus.emit('error', keyError);
        } else {
          this.handleError(keyError);
        }
      }
    };

    const onkeystatuseschange = (context._onkeystatuseschange = (
      event: Event,
    ) => {
      const keySession = context.mediaKeysSession;
      if (!keySession as any) {
        licenseStatus.emit('error', new Error('invalid state'));
        return;
      }

      const keyStatuses = this.getKeyStatuses(context);
      const keyIds = Object.keys(keyStatuses);

      // ignore change if all keys are status-pending
      if (!keyIds.some((id) => keyStatuses[id] !== 'status-pending')) {
        return;
      }
      // renew when a key status for a levelKey comes back expired
      // TODO: If any of the active level keys are expired then renew
      // if (keyIds.some((id) => context.keyStatuses[id] === 'expired')) {
      if (keyStatuses[keyId] === 'expired') {
        // renew when a key status comes back expired
        this.log(
          `Expired key ${stringify(keyStatuses)} in key-session "${context.mediaKeysSession.sessionId}"`,
        );
        this.renewKeySession(context, levelKey);
      }

      let keyStatus = keyStatuses[keyId] as MediaKeyStatus | undefined;
      if (keyStatus) {
        // handle status of current key
        handleKeyStatus(keyStatus);
      } else {
        // Timeout key-status
        const timeout = 1000;
        context.keyStatusTimeouts ||= {};
        context.keyStatusTimeouts[keyId] ||= self.setTimeout(() => {
          if ((!context.mediaKeysSession as any) || !context.levelKeys.length) {
            return;
          }

          // Find key status in another session if missing (PlayReady #7519 no key-status "single-key" setup with shared key)
          const sessionKeyStatus = this.getKeyStatus(levelKey);
          if (sessionKeyStatus && sessionKeyStatus !== 'status-pending') {
            this.log(
              `No status for keyId ${keyId} in key-session "${context.mediaKeysSession.sessionId}". Using session key-status ${sessionKeyStatus} from other session.`,
            );
            return handleKeyStatus(sessionKeyStatus);
          }

          // Timeout key with internal-error
          this.log(
            `key status for ${keyId} in key-session "${context.mediaKeysSession.sessionId}" timed out after ${timeout}ms`,
          );
          keyStatus = 'internal-error';
          handleKeyStatus(keyStatus);
        }, timeout);

        this.log(`No status for keyId ${keyId} (${stringify(keyStatuses)}).`);
      }
    });

    addEventListener(context.mediaKeysSession, 'message', onmessage);
    addEventListener(
      context.mediaKeysSession,
      'keystatuseschange',
      onkeystatuseschange,
    );

    const keyUsablePromise = new Promise(
      (resolve: (value?: void) => void, reject) => {
        licenseStatus.on('error', reject);
        licenseStatus.on('resolved', resolve);
      },
    );

    return context.mediaKeysSession
      .generateRequest(initDataType, initData)
      .then(() => {
        this.log(
          `Request generated for key-session "${context.mediaKeysSession.sessionId}" keyId: ${keyId} URI: ${keyUri}`,
        );
      })
      .catch((error) => {
        throw new EMEKeyError(
          {
            type: ErrorTypes.KEY_SYSTEM_ERROR,
            details: ErrorDetails.KEY_SYSTEM_NO_SESSION,
            error,
            decryptdata: levelKey,
            fatal: false,
          },
          `Error generating key-session request: ${error}`,
        );
      })
      .then(() => keyUsablePromise)
      .catch((error) => {
        licenseStatus.removeAllListeners();
        return this.removeSession(context).then(() => {
          throw error;
        });
      })
      .then(() => {
        licenseStatus.removeAllListeners();
        return context;
      });
  }

  private getKeyStatuses(mediaKeySessionContext: MediaKeySessionContext): {
    [keyId: string]: MediaKeyStatus;
  } {
    const keyStatuses: { [keyId: string]: MediaKeyStatus } = {};
    mediaKeySessionContext.mediaKeysSession.keyStatuses.forEach(
      (status: MediaKeyStatus, keyId: BufferSource) => {
        // keyStatuses.forEach is not standard API so the callback value looks weird on xboxone
        // xboxone callback(keyId, status) so we need to exchange them
        if (typeof keyId === 'string' && typeof status === 'object') {
          const temp = keyId;
          keyId = status;
          status = temp;
        }
        const keyIdArray =
          'buffer' in keyId
            ? new Uint8Array(keyId.buffer, keyId.byteOffset, keyId.byteLength)
            : new Uint8Array(keyId);

        if (
          mediaKeySessionContext.keySystem === KeySystems.PLAYREADY &&
          keyIdArray.length === 16
        ) {
          // On some devices, the key ID has already been converted for endianness.
          // In such cases, this key ID is the one we need to cache.
          const originKeyIdWithStatusChange = arrayToHex(keyIdArray);
          // Cache the original key IDs to ensure compatibility across all cases.
          keyStatuses[originKeyIdWithStatusChange] = status;

          changeEndianness(keyIdArray);
        }
        const keyIdWithStatusChange = arrayToHex(keyIdArray);
        this.log(
          `key status change "${status}" for keyStatuses keyId: ${keyIdWithStatusChange} key-session "${mediaKeySessionContext.mediaKeysSession.sessionId}"`,
        );

        keyStatuses[keyIdWithStatusChange] = status;
      },
    );
    return keyStatuses;
  }

  private fetchServerCertificate(
    keySystem: KeySystems,
  ): Promise<BufferSource | void> {
    const config = this.config;
    const Loader = config.loader;
    const certLoader = new Loader(config as HlsConfig) as Loader<LoaderContext>;
    const url = this.getServerCertificateUrl(keySystem);
    if (!url) {
      return Promise.resolve();
    }
    this.log(`Fetching server certificate for "${keySystem}"`);
    return new Promise((resolve, reject) => {
      const loaderContext: LoaderContext = {
        responseType: 'arraybuffer',
        url,
      };
      const loadPolicy = config.certLoadPolicy.default;
      const loaderConfig: LoaderConfiguration = {
        loadPolicy,
        timeout: loadPolicy.maxLoadTimeMs,
        maxRetry: 0,
        retryDelay: 0,
        maxRetryDelay: 0,
      };
      const loaderCallbacks: LoaderCallbacks<LoaderContext> = {
        onSuccess: (response, stats, context, networkDetails) => {
          resolve(response.data as ArrayBuffer);
        },
        onError: (response, contex, networkDetails, stats) => {
          reject(
            new EMEKeyError(
              {
                type: ErrorTypes.KEY_SYSTEM_ERROR,
                details:
                  ErrorDetails.KEY_SYSTEM_SERVER_CERTIFICATE_REQUEST_FAILED,
                fatal: true,
                networkDetails,
                response: {
                  url: loaderContext.url,
                  data: undefined,
                  ...response,
                },
              },
              `"${keySystem}" certificate request failed (${url}). Status: ${response.code} (${response.text})`,
            ),
          );
        },
        onTimeout: (stats, context, networkDetails) => {
          reject(
            new EMEKeyError(
              {
                type: ErrorTypes.KEY_SYSTEM_ERROR,
                details:
                  ErrorDetails.KEY_SYSTEM_SERVER_CERTIFICATE_REQUEST_FAILED,
                fatal: true,
                networkDetails,
                response: {
                  url: loaderContext.url,
                  data: undefined,
                },
              },
              `"${keySystem}" certificate request timed out (${url})`,
            ),
          );
        },
        onAbort: (stats, context, networkDetails) => {
          reject(new Error('aborted'));
        },
      };
      certLoader.load(loaderContext, loaderConfig, loaderCallbacks);
    });
  }

  private setMediaKeysServerCertificate(
    mediaKeys: MediaKeys,
    keySystem: KeySystems,
    cert: BufferSource,
  ): Promise<MediaKeys> {
    return new Promise((resolve, reject) => {
      mediaKeys
        .setServerCertificate(cert)
        .then((success) => {
          this.log(
            `setServerCertificate ${
              success ? 'success' : 'not supported by CDM'
            } (${cert.byteLength}) on "${keySystem}"`,
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
              error.message,
            ),
          );
        });
    });
  }

  private renewLicense(
    context: MediaKeySessionContext,
    levelKey: LevelKey,
    keyMessage: ArrayBuffer,
  ): Promise<void> {
    const contextWithLevelKey: MediaKeySessionContextAndLevelKey = {
      decryptdata: levelKey,
      ...context,
    };
    return this.requestLicense(
      contextWithLevelKey,
      new Uint8Array(keyMessage),
    ).then((data: ArrayBuffer) => {
      return this.updateKeySession(
        context,
        levelKey,
        new Uint8Array(data),
      ).catch((error) => {
        throw new EMEKeyError(
          {
            type: ErrorTypes.KEY_SYSTEM_ERROR,
            details: ErrorDetails.KEY_SYSTEM_SESSION_UPDATE_FAILED,
            decryptdata: levelKey,
            error,
            fatal: false,
          },
          error.message,
        );
      });
    });
  }

  private unpackPlayReadyKeyMessage(
    xhr: XMLHttpRequest,
    licenseChallenge: Uint8Array<ArrayBuffer>,
  ): Uint8Array<ArrayBuffer> {
    // On Edge, the raw license message is UTF-16-encoded XML.  We need
    // to unpack the Challenge element (base64-encoded string containing the
    // actual license request) and any HttpHeader elements (sent as request
    // headers).
    // For PlayReady CDMs, we need to dig the Challenge out of the XML.
    const xmlString = String.fromCharCode.apply(
      null,
      new Uint16Array(licenseChallenge.buffer),
    );
    if (!xmlString.includes('PlayReadyKeyMessage')) {
      // This does not appear to be a wrapped message as on Edge.  Some
      // clients do not need this unwrapping, so we will assume this is one of
      // them.  Note that "xml" at this point probably looks like random
      // garbage, since we interpreted UTF-8 as UTF-16.
      xhr.setRequestHeader('Content-Type', 'text/xml; charset=utf-8');
      return licenseChallenge;
    }
    const keyMessageXml = new DOMParser().parseFromString(
      xmlString,
      'application/xml',
    );
    // Set request headers.
    const headers = keyMessageXml.querySelectorAll('HttpHeader');
    if (headers.length > 0) {
      let header: Element;
      for (let i = 0, len = headers.length; i < len; i++) {
        header = headers[i];
        const name = header.querySelector('name')?.textContent;
        const value = header.querySelector('value')?.textContent;
        if (name && value) {
          xhr.setRequestHeader(name, value);
        }
      }
    }
    const challengeElement = keyMessageXml.querySelector('Challenge');
    const challengeText = challengeElement?.textContent;
    if (!challengeText) {
      throw new Error(`Cannot find <Challenge> in key message`);
    }
    return strToUtf8array(atob(challengeText));
  }

  private setupLicenseXHR(
    xhr: XMLHttpRequest,
    url: string,
    contextWithLevelKey: MediaKeySessionContextAndLevelKey,
    licenseChallenge: Uint8Array<ArrayBuffer>,
  ): Promise<{
    xhr: XMLHttpRequest;
    licenseChallenge: Uint8Array<ArrayBuffer>;
  }> {
    const licenseXhrSetup = this.config.licenseXhrSetup;

    if (!licenseXhrSetup) {
      xhr.open('POST', url, true);

      return Promise.resolve({ xhr, licenseChallenge });
    }

    return Promise.resolve()
      .then(() => {
        if (contextWithLevelKey.levelKeys.length === 0) {
          throw new Error('Keys removed');
        }
        return licenseXhrSetup.call(
          this.hls,
          xhr,
          url,
          contextWithLevelKey,
          licenseChallenge,
        );
      })
      .catch((error: Error) => {
        if (contextWithLevelKey.levelKeys.length === 0) {
          // Key session removed. Cancel license request.
          throw error;
        }
        // let's try to open before running setup
        xhr.open('POST', url, true);

        return licenseXhrSetup.call(
          this.hls,
          xhr,
          url,
          contextWithLevelKey,
          licenseChallenge,
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
    contextWithLevelKey: MediaKeySessionContextAndLevelKey,
    licenseChallenge: Uint8Array<ArrayBuffer>,
  ): Promise<ArrayBuffer> {
    const keyLoadPolicy = this.config.keyLoadPolicy.default;
    return new Promise((resolve, reject) => {
      const url = this.getLicenseServerUrlOrThrow(
        contextWithLevelKey.keySystem,
      );
      this.log(`Sending license request to URL: ${url}`);
      const xhr = new XMLHttpRequest();
      xhr.responseType = 'arraybuffer';
      xhr.onreadystatechange = () => {
        if (
          (!this.hls as any) ||
          (!contextWithLevelKey.mediaKeysSession as any)
        ) {
          return reject(new Error('invalid state'));
        }
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            this._requestLicenseFailureCount = 0;
            let data = xhr.response;
            this.log(
              `License received ${
                data instanceof ArrayBuffer ? data.byteLength : data
              }`,
            );
            const licenseResponseCallback = this.config.licenseResponseCallback;
            if (licenseResponseCallback) {
              try {
                data = licenseResponseCallback.call(
                  this.hls,
                  xhr,
                  url,
                  contextWithLevelKey,
                );
              } catch (error) {
                this.error(error);
              }
            }
            resolve(data);
          } else {
            const retryConfig = keyLoadPolicy.errorRetry;
            const maxNumRetry = retryConfig ? retryConfig.maxNumRetry : 0;
            this._requestLicenseFailureCount++;
            if (
              this._requestLicenseFailureCount > maxNumRetry ||
              (xhr.status >= 400 && xhr.status < 500)
            ) {
              reject(
                new EMEKeyError(
                  {
                    type: ErrorTypes.KEY_SYSTEM_ERROR,
                    details: ErrorDetails.KEY_SYSTEM_LICENSE_REQUEST_FAILED,
                    decryptdata: contextWithLevelKey.decryptdata,
                    fatal: true,
                    networkDetails: xhr,
                    response: {
                      url,
                      data: undefined as any,
                      code: xhr.status,
                      text: xhr.statusText,
                    },
                  },
                  `License Request XHR failed (${url}). Status: ${xhr.status} (${xhr.statusText})`,
                ),
              );
            } else {
              const attemptsLeft =
                maxNumRetry - this._requestLicenseFailureCount + 1;
              this.warn(
                `Retrying license request, ${attemptsLeft} attempts left`,
              );
              this.requestLicense(contextWithLevelKey, licenseChallenge).then(
                resolve,
                reject,
              );
            }
          }
        }
      };
      if (
        contextWithLevelKey.licenseXhr &&
        contextWithLevelKey.licenseXhr.readyState !== XMLHttpRequest.DONE
      ) {
        contextWithLevelKey.licenseXhr.abort();
      }
      contextWithLevelKey.licenseXhr = xhr;

      this.setupLicenseXHR(xhr, url, contextWithLevelKey, licenseChallenge)
        .then(({ xhr, licenseChallenge }) => {
          if (contextWithLevelKey.keySystem == KeySystems.PLAYREADY) {
            licenseChallenge = this.unpackPlayReadyKeyMessage(
              xhr,
              licenseChallenge,
            );
          }
          xhr.send(licenseChallenge);
        })
        .catch(reject);
    });
  }

  private onDestroying() {
    this.unregisterListeners();
    this._clear();
  }

  private onMediaAttached(
    event: Events.MEDIA_ATTACHED,
    data: MediaAttachedData,
  ) {
    if (!this.config.emeEnabled) {
      return;
    }

    const media = data.media;

    // keep reference of media
    this.media = media;

    addEventListener(media, 'encrypted', this.onMediaEncrypted);
    addEventListener(media, 'waitingforkey', this.onWaitingForKey);

    const mediaResolved = this.mediaResolved;
    if (mediaResolved) {
      mediaResolved();
    } else {
      this.mediaKeys = media.mediaKeys;
    }
  }

  private onMediaDetached() {
    const media = this.media;

    if (media) {
      removeEventListener(media, 'encrypted', this.onMediaEncrypted);
      removeEventListener(media, 'waitingforkey', this.onWaitingForKey);
      this.media = null;
      this.mediaKeys = null;
    }
  }

  private _clear() {
    this._requestLicenseFailureCount = 0;
    this.keyUriToSessionPromise = {};
    this.keyUriToLevelKeys = {};
    const mediaResolved = this.mediaResolved;
    if (mediaResolved) {
      mediaResolved();
    }
    if (!this.mediaKeys && !this.mediaKeySessions.length) {
      return;
    }
    const media = this.media;
    const mediaKeysList = this.mediaKeySessions.slice();
    this.mediaKeySessions = [];
    this.mediaKeys = null;

    LevelKey.clearKeyUriToKeyIdMap();

    // Close all sessions and remove media keys from the video element.
    const keySessionCount = mediaKeysList.length;
    EMEController.CDMCleanupPromise = Promise.all(
      mediaKeysList
        .map((mediaKeySessionContext) =>
          this.removeSession(mediaKeySessionContext),
        )
        .concat(
          (media?.setMediaKeys(null) as Promise<void> | null)?.catch(
            (error) => {
              this.log(`Could not clear media keys: ${error}`);
              if (!this.hls as any) return;
              this.hls.trigger(Events.ERROR, {
                type: ErrorTypes.OTHER_ERROR,
                details: ErrorDetails.KEY_SYSTEM_DESTROY_MEDIA_KEYS_ERROR,
                fatal: false,
                error: new Error(`Could not clear media keys: ${error}`),
              });
            },
          ) || Promise.resolve(),
        ),
    )
      .catch((error) => {
        this.log(`Could not close sessions and clear media keys: ${error}`);
        if (!this.hls as any) return;
        this.hls.trigger(Events.ERROR, {
          type: ErrorTypes.OTHER_ERROR,
          details: ErrorDetails.KEY_SYSTEM_DESTROY_CLOSE_SESSION_ERROR,
          fatal: false,
          error: new Error(
            `Could not close sessions and clear media keys: ${error}`,
          ),
        });
      })

      .then(() => {
        if (keySessionCount) {
          this.log('finished closing key sessions and clearing media keys');
        }
      });
  }

  private onManifestLoading() {
    this._clear();
    this.keyFormatPromise = null;
  }

  private onManifestLoaded(
    event: Events.MANIFEST_LOADED,
    { sessionKeys }: ManifestLoadedData,
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
        [],
      );
      this.log(
        `Selecting key-system from session-keys ${keyFormats.join(', ')}`,
      );
      this.keyFormatPromise = this.getKeyFormatPromise(keyFormats);
    }
  }

  private removeSession(
    mediaKeySessionContext: MediaKeySessionContext,
  ): Promise<void> {
    const { mediaKeysSession, licenseXhr, levelKeys } = mediaKeySessionContext;
    if (mediaKeysSession as MediaKeySession | undefined) {
      this.log(
        `Remove licenses and keys and close session "${mediaKeysSession.sessionId}" keyIds: ${levelKeys.map(({ keyId }) => arrayToHex(keyId || []))} URI: ${levelKeys[0]?.uri}`,
      );
      if (mediaKeySessionContext._onmessage) {
        mediaKeysSession.removeEventListener(
          'message',
          mediaKeySessionContext._onmessage,
        );
        mediaKeySessionContext._onmessage = undefined;
      }
      if (mediaKeySessionContext._onkeystatuseschange) {
        mediaKeysSession.removeEventListener(
          'keystatuseschange',
          mediaKeySessionContext._onkeystatuseschange,
        );
        mediaKeySessionContext._onkeystatuseschange = undefined;
      }

      if (licenseXhr && licenseXhr.readyState !== XMLHttpRequest.DONE) {
        licenseXhr.abort();
      }
      mediaKeySessionContext.mediaKeysSession =
        mediaKeySessionContext.licenseXhr = undefined!;
      mediaKeySessionContext.levelKeys = [];
      const index = this.mediaKeySessions.indexOf(mediaKeySessionContext);
      if (index > -1) {
        this.mediaKeySessions.splice(index, 1);
      }
      const { keyStatusTimeouts } = mediaKeySessionContext;
      if (keyStatusTimeouts) {
        Object.keys(keyStatusTimeouts).forEach((keyId) =>
          self.clearTimeout(keyStatusTimeouts[keyId]),
        );
      }
      const { drmSystemOptions } = this.config;
      const removePromise = isPersistentSessionType(drmSystemOptions)
        ? new Promise((resolve, reject) => {
            self.setTimeout(
              () => reject(new Error(`MediaKeySession.remove() timeout`)),
              8000,
            );
            mediaKeysSession.remove().then(resolve).catch(reject);
          })
        : Promise.resolve();
      return removePromise
        .catch((error) => {
          this.log(`Could not remove session: ${error}`);
          if (!this.hls as any) return;
          this.hls.trigger(Events.ERROR, {
            type: ErrorTypes.OTHER_ERROR,
            details: ErrorDetails.KEY_SYSTEM_DESTROY_REMOVE_SESSION_ERROR,
            fatal: false,
            error: new Error(`Could not remove session: ${error}`),
          });
        })
        .then(() => {
          return mediaKeysSession.close();
        })
        .catch((error) => {
          this.log(`Could not close session: ${error}`);
          if (!this.hls as any) return;
          this.hls.trigger(Events.ERROR, {
            type: ErrorTypes.OTHER_ERROR,
            details: ErrorDetails.KEY_SYSTEM_DESTROY_CLOSE_SESSION_ERROR,
            fatal: false,
            error: new Error(`Could not close session: ${error}`),
          });
        });
    }
    return Promise.resolve();
  }
}

function getKeyIdString(decryptdata: DecryptData | undefined): string | never {
  if (!decryptdata) {
    throw new Error('Could not read keyId of undefined decryptdata');
  }
  if (decryptdata.keyId === null) {
    throw new Error('keyId is null');
  }
  return arrayToHex(decryptdata.keyId);
}

function getKeyStatus(
  decryptdata: LevelKey,
  keyContext: MediaKeySessionContext,
): MediaKeyStatus | undefined {
  const keyId = decryptdata.keyId;
  if (keyId) {
    if (keyContext.mediaKeysSession.keyStatuses.has(keyId)) {
      return keyContext.mediaKeysSession.keyStatuses.get(keyId);
    }
    return keyContext.keyStatuses[arrayToHex(keyId)];
  }
  return undefined;
}
export class EMEKeyError extends Error {
  public readonly data: ErrorData;
  constructor(
    data: Omit<ErrorData, 'error'> & { error?: Error },
    message: string,
  ) {
    super(message);
    data.error ||= new Error(message);
    this.data = data as ErrorData;
    data.err = data.error;
  }
}

function getKeyStatusError(
  keyStatus: MediaKeyStatus,
  decryptdata: LevelKey,
): EMEKeyError {
  const outputRestricted = keyStatus === 'output-restricted';
  const details = outputRestricted
    ? ErrorDetails.KEY_SYSTEM_STATUS_OUTPUT_RESTRICTED
    : ErrorDetails.KEY_SYSTEM_STATUS_INTERNAL_ERROR;
  return new EMEKeyError(
    {
      type: ErrorTypes.KEY_SYSTEM_ERROR,
      details,
      fatal: false,
      decryptdata,
    },
    outputRestricted
      ? 'HDCP level output restricted'
      : `key status changed to "${keyStatus}"`,
  );
}

export default EMEController;
