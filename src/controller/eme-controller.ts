/**
 * @author Stephan Hesse <disparat@gmail.com> | <tchakabam@gmail.com>
 *
 * DRM support for Hls.js
 */
import { Events } from '../events';
import { ErrorTypes, ErrorDetails } from '../errors';

import { logger, enableLogs } from '../utils/logger';
import type {
  DRMSystemOptions,
  DRMSystemsConfiguration,
  EMEControllerConfig,
} from '../config';
import type { MediaKeyFunc } from '../utils/mediakeys-helper';
import { KeySystems } from '../utils/mediakeys-helper';
import type Hls from '../hls';
import type { ComponentAPI } from '../types/component-api';
import type { MediaAttachedData, ManifestParsedData } from '../types/events';

enableLogs(true);

const MAX_LICENSE_REQUEST_FAILURES = 3;

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/API/MediaKeySystemConfiguration
 * @param {Array<string>} audioCodecs List of required audio codecs to support
 * @param {Array<string>} videoCodecs List of required video codecs to support
 * @param {object} drmSystemOptions Optional parameters/requirements for the key-system
 * @returns {Array<MediaSystemConfiguration>} An array of supported configurations
 */

const createMediaKeySystemConfigurations = function (
  initDataType: string,
  audioCodecs: string[],
  videoCodecs: string[],
  drmSystemOptions: DRMSystemOptions
): MediaKeySystemConfiguration[] {
  /* jshint ignore:line */
  const baseConfig: MediaKeySystemConfiguration = {
    initDataTypes: [initDataType],
    // label: "",
    persistentState: 'not-allowed', // or "required" ?
    distinctiveIdentifier: 'not-allowed', // or "required" ?
    sessionTypes: ['temporary'],
    audioCapabilities: [], // { contentType: 'audio/mp4; codecs="mp4a.40.2"' }
    videoCapabilities: [], // { contentType: 'video/mp4; codecs="avc1.42E01E"' }
  };

  audioCodecs.forEach((codec) => {
    baseConfig.audioCapabilities!.push({
      contentType: `audio/mp4; codecs="${codec}"`,
      robustness: drmSystemOptions.audioRobustness || '',
    });
  });
  videoCodecs.forEach((codec) => {
    baseConfig.videoCapabilities!.push({
      contentType: `video/mp4; codecs="${codec}"`,
      robustness: drmSystemOptions.videoRobustness || '',
    });
  });

  return [baseConfig];
};

/**
 * The idea here is to handle key-system (and their respective platforms) specific configuration differences
 * in order to work with the local requestMediaKeySystemAccess method.
 *
 * We can also rule-out platform-related key-system support at this point by throwing an error.
 *
 * @param {string} keySystem Identifier for the key-system, see `KeySystems` enum
 * @param {Array<string>} audioCodecs List of required audio codecs to support
 * @param {Array<string>} videoCodecs List of required video codecs to support
 * @throws will throw an error if a unknown key system is passed
 * @returns {Array<MediaSystemConfiguration>} A non-empty Array of MediaKeySystemConfiguration objects
 */
const getSupportedMediaKeySystemConfigurations = function (
  keySystem: KeySystems,
  audioCodecs: string[],
  videoCodecs: string[],
  drmSystemOptions: DRMSystemOptions
): MediaKeySystemConfiguration[] {
  switch (keySystem) {
    case KeySystems.WIDEVINE:
      return createMediaKeySystemConfigurations(
        'cenc',
        audioCodecs,
        videoCodecs,
        drmSystemOptions
      );
    case KeySystems.FAIRPLAY:
      return createMediaKeySystemConfigurations(
        'sinf',
        audioCodecs,
        videoCodecs,
        drmSystemOptions
      );
    default:
      throw new Error(`Unknown key-system: ${keySystem}`);
  }
};

interface MediaKeysListItem {
  mediaKeys?: MediaKeys;
  mediaKeysSession?: MediaKeySession;
  mediaKeysSessionInitialized: boolean;
  mediaKeySystemAccess: MediaKeySystemAccess;
  mediaKeySystemDomain: KeySystems;
}

/**
 * Controller to deal with encrypted media extensions (EME)
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Encrypted_Media_Extensions_API
 *
 * @class
 * @constructor
 */
class EMEController implements ComponentAPI {
  private hls: Hls;
  private _widevineLicenseUrl?: string;
  private _drmSystems: DRMSystemsConfiguration;
  private _licenseXhrSetup?: (
    xhr: XMLHttpRequest,
    url: string,
    keySystem: KeySystems
  ) => void | Promise<void>;
  private _licenseResponseCallback?: (
    xhr: XMLHttpRequest,
    url: string,
    keySystem: KeySystems
  ) => ArrayBuffer;
  private _emeEnabled: boolean;
  private _requestMediaKeySystemAccess: MediaKeyFunc | null;
  private _drmSystemOptions: DRMSystemOptions;

  private _config: EMEControllerConfig;
  private _mediaKeysList: MediaKeysListItem[] = [];
  private _media: HTMLMediaElement | null = null;
  private _hasSetMediaKeys: boolean = false;
  private _requestLicenseFailureCount: number = 0;

  private mediaKeysPromise: Promise<MediaKeys> | null = null;
  private _onMediaEncrypted = this.onMediaEncrypted.bind(this);

  /**
   * @constructs
   * @param {Hls} hls Our Hls.js instance
   */
  constructor(hls: Hls) {
    this.hls = hls;
    this._config = hls.config;

    this._widevineLicenseUrl = this._config.widevineLicenseUrl;
    this._drmSystems = this._config.drmSystems;
    this._licenseXhrSetup = this._config.licenseXhrSetup;
    this._licenseResponseCallback = this._config.licenseResponseCallback;
    this._emeEnabled = this._config.emeEnabled;
    this._requestMediaKeySystemAccess =
      this._config.requestMediaKeySystemAccessFunc;
    this._drmSystemOptions = this._config.drmSystemOptions;

    this._registerListeners();
  }

  public destroy() {
    this._unregisterListeners();
    // @ts-ignore
    this.hls = this._onMediaEncrypted = null;
    this._requestMediaKeySystemAccess = null;
  }

  private _registerListeners() {
    this.hls.on(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    this.hls.on(Events.MEDIA_DETACHED, this.onMediaDetached, this);
    this.hls.on(Events.MANIFEST_PARSED, this.onManifestParsed, this);
  }

  private _unregisterListeners() {
    this.hls.off(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    this.hls.off(Events.MEDIA_DETACHED, this.onMediaDetached, this);
    this.hls.off(Events.MANIFEST_PARSED, this.onManifestParsed, this);
  }

  /**
   * @param {string} keySystem Identifier for the key-system, see `KeySystems` enum
   * @returns {string} License server URL for key-system (if any configured, otherwise causes error)
   * @throws if a unsupported keysystem is passed
   */
  getLicenseServerUrl(keySystem: KeySystems): string {
    const keySystemConfiguration = this._drmSystems[keySystem];

    if (keySystemConfiguration) {
      return keySystemConfiguration.licenseUrl;
    }

    // For backward compatibility
    if (keySystem === KeySystems.WIDEVINE && this._widevineLicenseUrl) {
      return this._widevineLicenseUrl;
    }

    throw new Error(
      `no license server URL configured for key-system "${keySystem}"`
    );
  }

  getServerCertificateUrl(keySystem: KeySystems): string | undefined {
    const keySystemConfiguration = this._drmSystems[keySystem];

    if (keySystemConfiguration) {
      return keySystemConfiguration.serverCertificateUrl;
    }

    return undefined;
  }

  /**
   * Requests access object and adds it to our list upon success
   * @private
   * @param {string} keySystem System ID (see `KeySystems`)
   * @param {Array<string>} audioCodecs List of required audio codecs to support
   * @param {Array<string>} videoCodecs List of required video codecs to support
   * @throws When a unsupported KeySystem is passed
   */
  private _attemptKeySystemAccess(
    keySystem: KeySystems,
    audioCodecs: string[],
    videoCodecs: string[]
  ) {
    // This can throw, but is caught in event handler callpath
    const mediaKeySystemConfigs = getSupportedMediaKeySystemConfigurations(
      keySystem,
      audioCodecs,
      videoCodecs,
      this._drmSystemOptions
    );

    logger.log('Requesting encrypted media key-system access');

    // expecting interface like window.navigator.requestMediaKeySystemAccess
    const keySystemAccessPromise = this.requestMediaKeySystemAccess(
      keySystem,
      mediaKeySystemConfigs
    );

    this.mediaKeysPromise = keySystemAccessPromise.then(
      (mediaKeySystemAccess) =>
        this._onMediaKeySystemAccessObtained(keySystem, mediaKeySystemAccess)
    );

    keySystemAccessPromise.catch((err) => {
      logger.error(`Failed to obtain key-system "${keySystem}" access:`, err);
    });
  }

  get requestMediaKeySystemAccess() {
    if (!this._requestMediaKeySystemAccess) {
      throw new Error('No requestMediaKeySystemAccess function configured');
    }

    return this._requestMediaKeySystemAccess;
  }

  /**
   * Handles obtaining access to a key-system
   * @private
   * @param {string} keySystem
   * @param {MediaKeySystemAccess} mediaKeySystemAccess https://developer.mozilla.org/en-US/docs/Web/API/MediaKeySystemAccess
   */
  private _onMediaKeySystemAccessObtained(
    keySystem: KeySystems,
    mediaKeySystemAccess: MediaKeySystemAccess
  ): Promise<MediaKeys> {
    logger.log(`Access for key-system "${keySystem}" obtained`);

    const mediaKeysListItem: MediaKeysListItem = {
      mediaKeysSessionInitialized: false,
      mediaKeySystemAccess: mediaKeySystemAccess,
      mediaKeySystemDomain: keySystem,
    };

    this._mediaKeysList.push(mediaKeysListItem);

    const mediaKeysPromise = Promise.resolve()
      .then(() => mediaKeySystemAccess.createMediaKeys())
      .then((mediaKeys) => {
        mediaKeysListItem.mediaKeys = mediaKeys;

        logger.log(`Media-keys created for key-system "${keySystem}"`);

        return this._fetchAndSetServerCertificate(mediaKeysListItem).then(
          () => {
            this._onMediaKeysCreated();

            return mediaKeys;
          }
        );
      });

    mediaKeysPromise.catch((err) => {
      logger.error('Failed to create media-keys:', err);
    });

    return mediaKeysPromise;
  }

  /**
   * Handles key-creation (represents access to CDM). We are going to create key-sessions upon this
   * for all existing keys where no session exists yet.
   *
   * @private
   */
  private _onMediaKeysCreated() {
    // check for all key-list items if a session exists, otherwise, create one
    this._mediaKeysList.forEach((mediaKeysListItem) => {
      if (!mediaKeysListItem.mediaKeysSession) {
        // mediaKeys is definitely initialized here
        mediaKeysListItem.mediaKeysSession =
          mediaKeysListItem.mediaKeys!.createSession();
        this._onNewMediaKeySession(mediaKeysListItem.mediaKeysSession);
      }
    });
  }

  /**
   * @private
   * @param {*} keySession
   */
  private _onNewMediaKeySession(keySession: MediaKeySession) {
    logger.log(`New key-system session ${keySession.sessionId}`);

    keySession.addEventListener(
      'message',
      (event: MediaKeyMessageEvent) => {
        this._onKeySessionMessage(keySession, event.message);
      },
      false
    );
  }

  /**
   * @private
   * @param {MediaKeySession} keySession
   * @param {ArrayBuffer} message
   */
  private _onKeySessionMessage(
    keySession: MediaKeySession,
    message: ArrayBuffer
  ) {
    logger.log('Got EME message event, creating license request');

    this._requestLicense(message, (data: ArrayBuffer) => {
      logger.log(
        `Received license data (length: ${
          data ? data.byteLength : data
        }), updating key-session`
      );

      keySession.update(data).catch((error) => {
        logger.error('Fatal: KeySession rejected data update', error);

        this.hls.trigger(Events.ERROR, {
          type: ErrorTypes.KEY_SYSTEM_ERROR,
          details: ErrorDetails.KEY_SYSTEM_SESSION_UPDATE_FAILED,
          fatal: true,
          error,
        });
      });
    });
  }

  /**
   * @private
   * @param e {MediaEncryptedEvent}
   */
  private onMediaEncrypted(e: MediaEncryptedEvent) {
    logger.log(`Media is encrypted using "${e.initDataType}" init data type`);

    if (!this.mediaKeysPromise) {
      logger.error(
        'Fatal: Media is encrypted but no CDM access or no keys have been requested'
      );
      this.hls.trigger(Events.ERROR, {
        type: ErrorTypes.KEY_SYSTEM_ERROR,
        details: ErrorDetails.KEY_SYSTEM_NO_KEYS,
        fatal: true,
      });
      return;
    }

    const finallySetKeyAndStartSession = (mediaKeys) => {
      if (!this._media) {
        return;
      }
      this._attemptSetMediaKeys(mediaKeys);
      this._generateRequestWithPreferredKeySession(e.initDataType, e.initData);
    };

    // Could use `Promise.finally` but some Promise polyfills are missing it
    this.mediaKeysPromise
      .then(finallySetKeyAndStartSession)
      .catch(finallySetKeyAndStartSession);
  }

  /**
   * @private
   */
  private _attemptSetMediaKeys(mediaKeys?: MediaKeys) {
    if (!this._media) {
      throw new Error(
        'Attempted to set mediaKeys without first attaching a media element'
      );
    }

    if (!this._hasSetMediaKeys) {
      // FIXME: see if we can/want/need-to really to deal with several potential key-sessions?
      const keysListItem = this._mediaKeysList[0];
      if (!keysListItem || !keysListItem.mediaKeys) {
        logger.error(
          'Fatal: Media is encrypted but no CDM access or no keys have been obtained yet'
        );
        this.hls.trigger(Events.ERROR, {
          type: ErrorTypes.KEY_SYSTEM_ERROR,
          details: ErrorDetails.KEY_SYSTEM_NO_KEYS,
          fatal: true,
        });
        return;
      }

      logger.log('Setting keys for encrypted media');

      this._media.setMediaKeys(keysListItem.mediaKeys);
      this._hasSetMediaKeys = true;
    }
  }

  /**
   * @private
   */
  private _generateRequestWithPreferredKeySession(
    initDataType: string,
    initData: ArrayBuffer | null
  ) {
    // FIXME: see if we can/want/need-to really to deal with several potential key-sessions?
    const keysListItem = this._mediaKeysList[0];
    if (!keysListItem) {
      logger.error(
        'Fatal: Media is encrypted but not any key-system access has been obtained yet'
      );
      this.hls.trigger(Events.ERROR, {
        type: ErrorTypes.KEY_SYSTEM_ERROR,
        details: ErrorDetails.KEY_SYSTEM_NO_ACCESS,
        fatal: true,
      });
      return;
    }

    if (keysListItem.mediaKeysSessionInitialized) {
      logger.warn('Key-Session already initialized but requested again');
      return;
    }

    const keySession = keysListItem.mediaKeysSession;
    if (!keySession) {
      logger.error('Fatal: Media is encrypted but no key-session existing');
      this.hls.trigger(Events.ERROR, {
        type: ErrorTypes.KEY_SYSTEM_ERROR,
        details: ErrorDetails.KEY_SYSTEM_NO_SESSION,
        fatal: true,
      });
      return;
    }

    // initData is null if the media is not CORS-same-origin
    if (!initData) {
      logger.warn(
        'Fatal: initData required for generating a key session is null'
      );
      this.hls.trigger(Events.ERROR, {
        type: ErrorTypes.KEY_SYSTEM_ERROR,
        details: ErrorDetails.KEY_SYSTEM_NO_INIT_DATA,
        fatal: true,
      });
      return;
    }

    logger.log(
      `Generating key-session request for "${initDataType}" init data type`
    );
    keysListItem.mediaKeysSessionInitialized = true;

    keySession
      .generateRequest(initDataType, initData)
      .then(() => {
        logger.debug('Key-session generation succeeded');
      })
      .catch((err) => {
        logger.error('Error generating key-session request:', err);
        this.hls.trigger(Events.ERROR, {
          type: ErrorTypes.KEY_SYSTEM_ERROR,
          details: ErrorDetails.KEY_SYSTEM_NO_SESSION,
          fatal: false,
        });
      });
  }
  /**
   * @private
   * @param {MediaKeysListItem} mediaKeysListItem
   * @returns Promise
   */
  private _fetchAndSetServerCertificate(
    mediaKeysListItem: MediaKeysListItem
  ): Promise<void> {
    const url = this.getServerCertificateUrl(
      mediaKeysListItem.mediaKeySystemDomain
    );

    if (!url) {
      return Promise.resolve();
    }

    logger.log(
      `Fetching serverCertificate for ${mediaKeysListItem.mediaKeySystemDomain} keySystem`
    );

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.open('GET', url, true);
      xhr.responseType = 'arraybuffer';

      xhr.onreadystatechange = () => {
        switch (xhr.readyState) {
          case XMLHttpRequest.DONE:
            if (xhr.status === 200) {
              mediaKeysListItem.mediaKeys
                ?.setServerCertificate(xhr.response)
                .then(() => {
                  logger.log('serverCertificate successfully fetched and set');

                  resolve();
                })
                .catch((error) => {
                  this.hls.trigger(Events.ERROR, {
                    type: ErrorTypes.KEY_SYSTEM_ERROR,
                    details:
                      ErrorDetails.KEY_SYSTEM_SERVER_CERTIFICATE_UPDATE_FAILED,
                    fatal: true,
                    error,
                  });

                  reject(error);
                });
            } else {
              logger.error(
                `HTTP error ${xhr.status} happened while fetching server certificate`
              );

              this.hls.trigger(Events.ERROR, {
                type: ErrorTypes.KEY_SYSTEM_ERROR,
                details:
                  ErrorDetails.KEY_SYSTEM_SERVER_CERTIFICATE_REQUEST_FAILED,
                fatal: true,
              });

              reject(new Error(xhr.response));
            }
            break;
        }
      };

      xhr.send();
    });
  }

  /**
   * @private
   * @param {XMLHttpRequest} xhr
   * @param {string} url
   * @returns Promise
   */
  private _setupLicenseXHR = (
    xhr: XMLHttpRequest,
    url: string,
    keysListItem: MediaKeysListItem
  ): Promise<void> => {
    const licenseXhrSetup = this._licenseXhrSetup;

    if (!licenseXhrSetup) {
      xhr.open('POST', url, true);

      return Promise.resolve();
    }

    return Promise.resolve(
      licenseXhrSetup(xhr, url, keysListItem.mediaKeySystemDomain)
    )
      .catch(() => {
        // let's try to open before running setup
        xhr.open('POST', url, true);

        return licenseXhrSetup(xhr, url, keysListItem.mediaKeySystemDomain);
      })
      .then(() => {
        // if licenseXhrSetup did not yet call open, let's do it now
        if (!xhr.readyState) {
          xhr.open('POST', url, true);
        }
      })
      .catch((e) => {
        // IE11 throws an exception on xhr.open if attempting to access an HTTP resource over HTTPS
        return Promise.reject(
          new Error(`issue setting up KeySystem license XHR ${e}`)
        );
      });
  };

  /**
   * @private
   * @param {string} url License server URL
   * @param {ArrayBuffer} keyMessage Message data issued by key-system
   * @param {function} callback Called when XHR has succeeded
   * @returns {XMLHttpRequest} Unsent (but opened state) XHR object
   * @throws if XMLHttpRequest construction failed
   */
  private _createLicenseXhr(
    keysListItem: MediaKeysListItem,
    keyMessage: ArrayBuffer,
    callback: (data: ArrayBuffer) => void
  ): Promise<XMLHttpRequest> {
    const url = this.getLicenseServerUrl(keysListItem.mediaKeySystemDomain);

    logger.log(`Sending license request to URL: ${url}`);

    const xhr = new XMLHttpRequest();
    xhr.responseType = 'arraybuffer';
    xhr.onreadystatechange = this._onLicenseRequestReadyStageChange.bind(
      this,
      xhr,
      url,
      keysListItem,
      keyMessage,
      callback
    );

    return this._setupLicenseXHR(xhr, url, keysListItem).then(() => xhr);
  }

  /**
   * @private
   * @param {XMLHttpRequest} xhr
   * @param {string} url License server URL
   * @param {ArrayBuffer} keyMessage Message data issued by key-system
   * @param {function} callback Called when XHR has succeeded
   */
  private _onLicenseRequestReadyStageChange(
    xhr: XMLHttpRequest,
    url: string,
    keysListItem: MediaKeysListItem,
    keyMessage: ArrayBuffer,
    callback: (data: ArrayBuffer) => void
  ) {
    switch (xhr.readyState) {
      case 4:
        if (xhr.status === 200) {
          this._requestLicenseFailureCount = 0;
          logger.log('License request succeeded');
          let data: ArrayBuffer = xhr.response;
          const licenseResponseCallback = this._licenseResponseCallback;
          if (licenseResponseCallback) {
            try {
              data = licenseResponseCallback.call(
                this.hls,
                xhr,
                url,
                keysListItem.mediaKeySystemDomain
              );
            } catch (e) {
              logger.error(e);
            }
          }
          callback(data);
        } else {
          logger.error(
            `License Request XHR failed (${url}). Status: ${xhr.status} (${xhr.statusText})`
          );
          this._requestLicenseFailureCount++;
          if (this._requestLicenseFailureCount > MAX_LICENSE_REQUEST_FAILURES) {
            this.hls.trigger(Events.ERROR, {
              type: ErrorTypes.KEY_SYSTEM_ERROR,
              details: ErrorDetails.KEY_SYSTEM_LICENSE_REQUEST_FAILED,
              fatal: true,
            });
            return;
          }

          const attemptsLeft =
            MAX_LICENSE_REQUEST_FAILURES - this._requestLicenseFailureCount + 1;
          logger.warn(
            `Retrying license request, ${attemptsLeft} attempts left`
          );
          this._requestLicense(keyMessage, callback);
        }
        break;
    }
  }

  /**
   * @private
   * @param {MediaKeysListItem} keysListItem
   * @param {ArrayBuffer} keyMessage
   * @returns {ArrayBuffer} Challenge data posted to license server
   * @throws if KeySystem is unsupported
   */
  private _generateLicenseRequestChallenge(
    keysListItem: MediaKeysListItem,
    keyMessage: ArrayBuffer
  ): ArrayBuffer {
    switch (keysListItem.mediaKeySystemDomain) {
      // case KeySystems.PLAYREADY:
      // from https://github.com/MicrosoftEdge/Demos/blob/master/eme/scripts/demo.js
      /*
      if (this.licenseType !== this.LICENSE_TYPE_WIDEVINE) {
        // For PlayReady CDMs, we need to dig the Challenge out of the XML.
        var keyMessageXml = new DOMParser().parseFromString(String.fromCharCode.apply(null, new Uint16Array(keyMessage)), 'application/xml');
        if (keyMessageXml.getElementsByTagName('Challenge')[0]) {
            challenge = atob(keyMessageXml.getElementsByTagName('Challenge')[0].childNodes[0].nodeValue);
        } else {
            throw 'Cannot find <Challenge> in key message';
        }
        var headerNames = keyMessageXml.getElementsByTagName('name');
        var headerValues = keyMessageXml.getElementsByTagName('value');
        if (headerNames.length !== headerValues.length) {
            throw 'Mismatched header <name>/<value> pair in key message';
        }
        for (var i = 0; i < headerNames.length; i++) {
            xhr.setRequestHeader(headerNames[i].childNodes[0].nodeValue, headerValues[i].childNodes[0].nodeValue);
        }
      }
      break;
    */
      // For Widevine and Fairplay CDMs, the challenge is the keyMessage.
      case KeySystems.FAIRPLAY:
      case KeySystems.WIDEVINE:
        return keyMessage;
    }

    throw new Error(
      `unsupported key-system: ${keysListItem.mediaKeySystemDomain}`
    );
  }

  private _onLicenseRequestError(error) {
    logger.error(`Failure requesting DRM license: ${error}`);

    this.hls.trigger(Events.ERROR, {
      type: ErrorTypes.KEY_SYSTEM_ERROR,
      details: ErrorDetails.KEY_SYSTEM_LICENSE_REQUEST_FAILED,
      fatal: true,
    });
  }

  /**
   * @private
   * @param keyMessage
   * @param callback
   */
  private _requestLicense(
    keyMessage: ArrayBuffer,
    callback: (data: ArrayBuffer) => void
  ) {
    logger.log('Requesting content license for key-system');

    const keysListItem = this._mediaKeysList[0];
    if (!keysListItem) {
      logger.error(
        'Fatal error: Media is encrypted but no key-system access has been obtained yet'
      );
      this.hls.trigger(Events.ERROR, {
        type: ErrorTypes.KEY_SYSTEM_ERROR,
        details: ErrorDetails.KEY_SYSTEM_NO_ACCESS,
        fatal: true,
      });
      return;
    }

    try {
      this._createLicenseXhr(keysListItem, keyMessage, callback)
        .then((xhr) => {
          const challenge = this._generateLicenseRequestChallenge(
            keysListItem,
            keyMessage
          );
          xhr.send(challenge);
        })
        .catch((error) => {
          this._onLicenseRequestError(error);
        });
    } catch (e) {
      this._onLicenseRequestError(e);
    }
  }

  onMediaAttached(event: Events.MEDIA_ATTACHED, data: MediaAttachedData) {
    if (!this._emeEnabled) {
      return;
    }

    const media = data.media;

    // keep reference of media
    this._media = media;

    media.addEventListener('encrypted', this._onMediaEncrypted);
  }

  onMediaDetached() {
    const media = this._media;
    const mediaKeysList = this._mediaKeysList;
    if (!media) {
      return;
    }
    media.removeEventListener('encrypted', this._onMediaEncrypted);
    this._media = null;
    this._mediaKeysList = [];
    // Close all sessions and remove media keys from the video element.
    Promise.all(
      mediaKeysList.map((mediaKeysListItem) => {
        if (mediaKeysListItem.mediaKeysSession) {
          return mediaKeysListItem.mediaKeysSession.close().catch(() => {
            // Ignore errors when closing the sessions. Closing a session that
            // generated no key requests will throw an error.
          });
        }
      })
    )
      .then(() => {
        return media.setMediaKeys(null);
      })
      .catch(() => {
        // Ignore any failures while removing media keys from the video element.
      });
  }

  onManifestParsed(event: Events.MANIFEST_PARSED, data: ManifestParsedData) {
    if (!this._emeEnabled) {
      return;
    }

    const audioCodecs = data.levels
      .map((level) => level.audioCodec)
      .filter(
        (audioCodec: string | undefined): audioCodec is string => !!audioCodec
      );
    const videoCodecs = data.levels
      .map((level) => level.videoCodec)
      .filter(
        (videoCodec: string | undefined): videoCodec is string => !!videoCodec
      );

    // TBD We should try a keySystem based on manifest information
    this._attemptKeySystemAccess(KeySystems.FAIRPLAY, audioCodecs, videoCodecs);
  }
}

export default EMEController;
