/**
 * @author Stephan Hesse <disparat@gmail.com> | <tchakabam@gmail.com>
 * @author Matthew Thompson <matthew@realeyes.com>
 *
 * DRM support for Hls.js
 */

import EventHandler from '../event-handler';
import Event from '../events';
import { ErrorTypes, ErrorDetails } from '../errors';

import { logger } from '../utils/logger';

const MAX_LICENSE_REQUEST_FAILURES = 3;

interface InitDataInfo {
  initDataType: string,
  initData: ArrayBuffer
}

interface EMEError {
  fatal: boolean,
  message: string
}

/**
 * Controller to deal with encrypted media extensions (EME)
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Encrypted_Media_Extensions_API
 *
 * @class
 * @constructor
 */
class EMEController extends EventHandler {
  private _media: HTMLMediaElement | null = null;
  private _requestLicenseFailureCount: number = 0;
  private _hasSetMediaKeys = false;
  private _keySessions: MediaKeySession[] = [];

  /**
   * User configurations
   */
  private _emeEnabled: boolean;
  private _requestMediaKeySystemAccess: (supportedConfigurations: MediaKeySystemConfiguration[]) => Promise<MediaKeySystemAccess>
  private _getInitializationData: (track) => Promise<InitDataInfo>;
  private _licenseXhrSetup: (xhr: XMLHttpRequest) => Promise<XMLHttpRequest>;

  /**
   * @constructs
   * @param {Hls} hls Our Hls.js instance
   */
  constructor(hls) {
    super(hls,
      Event.MEDIA_ATTACHED,
      Event.MEDIA_DETACHED,
      Event.MANIFEST_PARSED
    );

    this._emeEnabled = hls.config.emeEnabled;
    this._requestMediaKeySystemAccess = hls.config.requestMediaKeySystemAccessFunc;
    this._getInitializationData = hls.config.getInitializationDataFunc;
    this._licenseXhrSetup = hls.config.licenseXhrSetup;
  }

  private _onLicenseRequestError = (message, reject) => {
    if (this._requestLicenseFailureCount > MAX_LICENSE_REQUEST_FAILURES) {
      return reject({
        fatal: true,
        message: ErrorDetails.KEY_SYSTEM_LICENSE_REQUEST_FAILED
      })
    }

    this._requestLicenseFailureCount++;

    const attemptsLeft = MAX_LICENSE_REQUEST_FAILURES - this._requestLicenseFailureCount + 1;

    logger.warn(`Retrying license request, ${attemptsLeft} attempts left`);

    this._requestLicense(message);
  }

  /**
   * Requests the license to be used in the key session
   * @private
   * @param {MediaKeyMessageEvent} message Message created by generating request on key session https://developer.mozilla.org/en-US/docs/Web/API/MediaKeyMessageEvent
   */
  private _requestLicense = (message: ArrayBuffer): Promise<ArrayBuffer> => {
    logger.log('Requesting content license');

    let xhr = new XMLHttpRequest();

    return this.licenseXhrSetup(xhr).then(xhrRepsonse => {
      return new Promise((resolve, reject) => {
        xhrRepsonse.responseType = 'arraybuffer';

        xhrRepsonse.onload = () => {
          if (xhrRepsonse.status === 200) {
            this._requestLicenseFailureCount = 0;

            resolve(xhr.response as ArrayBuffer);
          } else {
            this._onLicenseRequestError(message, reject.bind(this));
          }
        }

        xhrRepsonse.onerror = this._onLicenseRequestError.bind(this, message, reject);

        xhrRepsonse.send(message);
      });
    }).then((license: ArrayBuffer) => {
      return Promise.resolve(license);
    });
  }

  /**
   * Handles key session messages
   * @private
   * @param {Event<MediaKeyMessageEvent>} event Message event created by license request generation
   */
  private _onKeySessionMessage = (resolve, reject, event: MediaKeyMessageEvent) => {
    logger.log('Received key session message');

    this._requestLicense(event.message).then((data: ArrayBuffer) => {
      logger.log('Received license data, updating key-session');

      return (event.target! as MediaKeySession).update(data).then((value) => {
        resolve();
      });
    }).catch((err) => {
      reject({
        message: ErrorTypes.KEY_SYSTEM_ERROR,
        fatal: true
      });
    });;
  }

  /**
   * Creates and handles the generation of requests for licenses
   * @private
   * @param {MediaKeys} session Media Keys Session created on the Media Keys object https://developer.mozilla.org/en-US/docs/Web/API/MediaKeySession
   */
  private _onMediaKeySessionCreated(session: MediaKeySession, track: any): Promise<any> {
    logger.log('Generating license request');

    const messagePromise = new Promise((resolve, reject) => {
      session.addEventListener('message', this._onKeySessionMessage.bind(this, resolve, reject))
    });;

    this.getInitializationData(track).then((initDataInfo) => {
      return session.generateRequest(initDataInfo.initDataType, initDataInfo.initData)
    });

    return messagePromise;
  }

  /**
   * Creates a session on the media keys object
   * @private
   * @param {MediaKeys} mediaKeys Media Keys created on the Media Key System access object https://developer.mozilla.org/en-US/docs/Web/API/MediaKeys
   * @returns {Promise<MediaKeySession>} Promise that resolves to the Media Key Session created on the Media Keys https://developer.mozilla.org/en-US/docs/Web/API/MediaKeySession
   */
  private _onMediaKeysSet(mediaKeys: MediaKeys, track: any): Promise<any> {
    logger.log('Creating session on media keys');

    const session = mediaKeys.createSession();

    this._keySessions.push(session);

    return Promise.resolve({session, track});
  }

  /**
   * Sets the media keys on the media
   * @private
   * @param {MediaKeys} mediaKeys Media Keys created on the Key System Access object https://developer.mozilla.org/en-US/docs/Web/API/MediaKeys
   * @returns {Promise<MediaKeys>} Promise that resvoles to the created media keys  https://developer.mozilla.org/en-US/docs/Web/API/MediaKeys
   */
  private _onMediaKeysCreated(mediaKeys): Promise<MediaKeys> {
    if (!this.hasSetMediaKeys) {
      logger.log('Settings media keys on media');

      return this.media.setMediaKeys(mediaKeys).then(() => {
        this.hasSetMediaKeys = true;
        return Promise.resolve(mediaKeys);
      }).catch((err) => {
        logger.error('Failed to set media keys on media:', err);

        return Promise.reject({
          fatal: true,
          message: ErrorDetails.KEY_SYSTEM_NO_KEYS
        });
      });
    } else {
      return Promise.reject({
        fatal: false,
        message: ErrorDetails.KEY_SYSTEM_KEYS_SET
      });
    }
  }

  /**
   * Creates media keys on the media key system access object
   * @private
   * @param {MediaKeySystemAccess} mediaKeySystemAccess https://developer.mozilla.org/en-US/docs/Web/API/MediaKeySystemAccess
   * @returns {Promise<MediaKeys>} Promise that resolves to the created media keys https://developer.mozilla.org/en-US/docs/Web/API/MediaKeys
   */
  private _onMediaKeySystemAccessObtained(mediaKeySystemAccess: MediaKeySystemAccess): Promise<MediaKeys> {
    logger.log('Creating media keys');

    return mediaKeySystemAccess.createMediaKeys().catch((err) => {
      logger.error('Failed to create media-keys:', err);

      return Promise.reject({
        fatal: true,
        message: ErrorDetails.KEY_SYSTEM_NO_KEYS
      });
    });
  }

  /**
   * Requests Media Key System access object where user defines key system
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigator/requestMediaKeySystemAccess
   * @private
   * @param {MediaKeySystemConfiguration[]} mediaKeySystemConfigs Configurations to request Media Key System access with https://developer.mozilla.org/en-US/docs/Web/API/MediaKeySystemConfiguration
   * @returns {Promise<MediaKeySystemAccess} Promise that resolves to the Media Key System Access object https://developer.mozilla.org/en-US/docs/Web/API/MediaKeySystemAccess
   */
  private _getKeySystemAccess(mediaKeySystemConfigs: MediaKeySystemConfiguration[]): Promise<MediaKeySystemAccess> {
    logger.log('Requesting encrypted media key system access');

    return this.requestMediaKeySystemAccess(mediaKeySystemConfigs).catch((err) => {
      logger.error(`Failed to obtain media key system access:`, err);

      return Promise.reject({
        fatal: true,
        message: ErrorDetails.KEY_SYSTEM_NO_ACCESS
      });
    });
  }

  /**
   * Creates Media Key System Configurations that will be used to request Media Key System Access
   * @private
   * @param {any} levels Levels found in manifest
   * @returns {Array<MediaSystemConfiguration>} A non-empty Array of MediaKeySystemConfiguration objects https://developer.mozilla.org/en-US/docs/Web/API/MediaKeySystemConfiguration
   */
  private _getSupportedMediaKeySystemConfigurations(levels: any): MediaKeySystemConfiguration[] {
    const baseConfig: MediaKeySystemConfiguration = {
      audioCapabilities: [], // e.g. { contentType: 'audio/mp4; codecs="avc1.42E01E"' }
      videoCapabilities: []  // e.g. { contentType: 'video/mp4; codecs="avc1.42E01E"' }
    };

    levels.forEach((level) => {
      baseConfig.videoCapabilities!.push({
        contentType: `video/mp4; codecs="${level.videoCodec}"`
      });

      baseConfig.audioCapabilities!.push({
        contentType: `audio/mp4; codecs="${level.audioCodec}"`
      });
    });

    return [
      baseConfig
    ];
  };

  onManifestParsed(data: any) {
    if (!this._emeEnabled) {
      return;
    }

    let entry;

    const mediaKeySystemConfigs = this._getSupportedMediaKeySystemConfigurations(data.levels);

    this._getKeySystemAccess(mediaKeySystemConfigs).then((mediaKeySystemAccess) => {
      logger.log('Obtained encrypted media key system access');

      return this._onMediaKeySystemAccessObtained(mediaKeySystemAccess);
    }).then((mediaKeys) => {
      logger.log('Created media keys');

      return this._onMediaKeysCreated(mediaKeys);
    }).then((mediaKeys) => {
      logger.log('Set media keys on media');

      const levelRequests = data.levels.map((level) => {
        return this._onMediaKeysSet(mediaKeys, level);
      })

      const audioRequests = data.audioTracks.map((audioTrack) => {
        return this._onMediaKeysSet(mediaKeys, audioTrack);
      })

      const keySessionRequests = levelRequests.concat(audioRequests);

      return Promise.all(keySessionRequests);
    }).then((keySessionResponses: any[]) => {
      logger.log('Created media key sessions');

      const licenseRequests = keySessionResponses.map((keySessionResponse) => {
        return this._onMediaKeySessionCreated(keySessionResponse.session, keySessionResponse.track);
      })

      return Promise.all(licenseRequests);
    }).then(() => {
      logger.log('EME sucessfully configured');

      this.hls.trigger(Event.KEY_LOADED, {});
    }).catch((err: EMEError) => {
      logger.error('DRM Configuration failed')

      this.hls.trigger(Event.ERROR, {
        type: ErrorTypes.KEY_SYSTEM_ERROR,
        details: err.message,
        fatal: err.fatal
      });
    })
  }

  onMediaAttached(data: { media: HTMLMediaElement; }) {
    if (!this._emeEnabled) {
      return;
    }

    this._media = data.media; // keep reference of media
  }

  onMediaDetached() {
    this._keySessions.forEach((keySession) => {
      keySession.close();
    })

    if (this._media) {
      this._media.setMediaKeys(null).then(() => {
        this._media = null; // release media reference
      })
    }
  }

  // Getters for EME Controller

  get media() {
    if (!this._media) {
      throw new Error('Media has not been set on EME Controller');
    }

    return this._media;
  }

  get hasSetMediaKeys() {
    return this._hasSetMediaKeys;
  }

  set hasSetMediaKeys(value) {
    this._hasSetMediaKeys = value;
  }

  get keySessions() {
    return this._keySessions;
  }

  set keySessions(value) {
    this._keySessions = value;
  }

  // Getters for user configurations

  get requestMediaKeySystemAccess() {
    if (!this._requestMediaKeySystemAccess) {
      throw new Error('No requestMediaKeySystemAccess function configured');
    }

    return this._requestMediaKeySystemAccess;
  }

  get getInitializationData() {
    if (!this._getInitializationData) {
      throw new Error('No getInitializationData function configured');
    }

    return this._getInitializationData;
  }

  get licenseXhrSetup() {
    if (!this._licenseXhrSetup) {
      throw new Error('No licenseXhrSetup function configured');
    }

    return this._licenseXhrSetup;
  }
}

export default EMEController;
