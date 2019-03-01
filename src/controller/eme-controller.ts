/**
 * @author Stephan Hesse <disparat@gmail.com> | <tchakabam@gmail.com>
 * @author Matthew Thompson <matthew@realeyes.com>
 *
 * DRM support for Hls.js
 */

import EventHandler from '../event-handler';
import Event from '../events';
import { ErrorTypes, ErrorDetails } from '../errors';
import { EMEInitDataInfo } from '../config';

import { logger } from '../utils/logger';

interface EMEError {
  fatal: boolean,
  message: string
}

interface EMEKeySessionResponse {
  session: MediaKeySession,
  levelOrAudioTrack: any
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
  private _hasSetMediaKeys = false;
  private _keySessions: MediaKeySession[] = [];

  /**
   * User configurations
   */
  private _emeEnabled: boolean;
  private _requestMediaKeySystemAccess: (supportedConfigurations: MediaKeySystemConfiguration[]) => Promise<MediaKeySystemAccess>
  private _getEMEInitializationData: (levelOrAudioTrack: any) => Promise<EMEInitDataInfo>;
  private _getEMELicense: (levelOrAudioTrack: any, event: MediaKeyMessageEvent) => Promise<ArrayBuffer>;

  /**
   * @constructs
   * @param {Hls} hls Our Hls.js instance
   */
  constructor(hls) {
    super(hls,
      Event.MEDIA_ATTACHING,
      Event.MEDIA_DETACHED,
      Event.MANIFEST_PARSED
    );

    this._emeEnabled = hls.config.emeEnabled;
    this._requestMediaKeySystemAccess = hls.config.requestMediaKeySystemAccessFunc;
    this._getEMEInitializationData = hls.config.getEMEInitializationDataFunc;
    this._getEMELicense = hls.config.getEMELicenseFunc;
  }

  /**
   * Handles key session messages and requests licenses
   * @private
   * @param {Promise.resolve} resolve Resolve method to be called on successful license update on MediaKeySession
   * @param {Promise.resolve} reject Reject method to be called on unsuccessful license update on MediaKeySession
   * @param {Event<MediaKeyMessageEvent>} event Message event created by license request generation
   */
  private _onKeySessionMessage = (levelOrAudioTrack: any, resolve, reject, event: MediaKeyMessageEvent) => {
    logger.log('Received key session message, requesting license');

    this.getEMELicense(levelOrAudioTrack, event).then((license: ArrayBuffer) => {
      logger.log('Received license data, updating key-session');

      return (event.target! as MediaKeySession).update(license).then(() => {
        resolve();
      });
    }).catch((err) => {
      reject({
        message: ErrorTypes.KEY_SYSTEM_ERROR,
        fatal: true
      });
    });
  }

  /**
   * Creates and handles the generation of requests for licenses
   * @private
   * @param {MediaKeys} session Media Keys Session created on the Media Keys object https://developer.mozilla.org/en-US/docs/Web/API/MediaKeySession
   * @param {Level | AudioTrack} levelOrAudioTrack Either a level or audio track mapped from manifestParsed data, used by client should different licenses be
   * requred for different levels or audio tracks
   * @returns {Promise<any>} Promise resolved or rejected by _onKeySessionMessage
   */
  private _onMediaKeySessionCreated(session: MediaKeySession, levelOrAudioTrack: any): Promise<any> {
    logger.log('Generating license request');

    return this.getEMEInitializationData(levelOrAudioTrack).then((initDataInfo) => {
      const messagePromise = new Promise((resolve, reject) => {
        session.addEventListener('message', this._onKeySessionMessage.bind(this, levelOrAudioTrack, resolve, reject))
      });

      session.generateRequest(initDataInfo.initDataType, initDataInfo.initData)

      return messagePromise;
    });
  }

  /**
   * Creates a session on the media keys object
   * @private
   * @param {MediaKeys} mediaKeys Media Keys created on the Media Key System access object https://developer.mozilla.org/en-US/docs/Web/API/MediaKeys
   * @param {Level | AudioTrack} levelOrAudioTrack Either a level or audio track mapped from manifestParsed data, used by client should different licenses be
   * requred for different levels or audio tracks
   * @returns {Promise<EMEKeySessionResponse>} Promise that resolves to the Media Key Session created on the Media Keys https://developer.mozilla.org/en-US/docs/Web/API/MediaKeySession
   * Also includes the level or audio track to associate with the session
   */
  private _onMediaKeysSet(mediaKeys: MediaKeys, levelOrAudioTrack: any): Promise<EMEKeySessionResponse> {
    logger.log('Creating session on media keys');

    const session = mediaKeys.createSession();

    this._keySessions.push(session);

    const keySessionResponse: EMEKeySessionResponse = {
      session, 
      levelOrAudioTrack
    };

    return Promise.resolve(keySessionResponse);
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

      this.hasSetMediaKeys = true;

      return this.media.setMediaKeys(mediaKeys).then(() => {
        return Promise.resolve(mediaKeys);
      }).catch((err) => {
        logger.error('Failed to set media keys on media:', err);

        this.hasSetMediaKeys = false;

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

    if (!window.navigator.requestMediaKeySystemAccess) {
      return Promise.reject({
        fatal: true,
        message: ErrorDetails.KEY_SYSTEM_NO_ACCESS
      })
    }

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

    this.hls.trigger(Event.EME_CONFIGURING, {});

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
    }).then((keySessionResponses) => {
      logger.log('Created media key sessions');

      const licenseRequests = keySessionResponses.map((keySessionResponse: EMEKeySessionResponse) => {
        return this._onMediaKeySessionCreated(keySessionResponse.session, keySessionResponse.levelOrAudioTrack);
      })

      return Promise.all(licenseRequests);
    }).then(() => {
      logger.log('EME sucessfully configured');

      this.hls.trigger(Event.EME_CONFIGURED, {});
    }).catch((err: EMEError) => {
      logger.error('EME Configuration failed')

      this.hls.trigger(Event.ERROR, {
        type: ErrorTypes.KEY_SYSTEM_ERROR,
        details: err.message,
        fatal: err.fatal
      });
    })
  }

  onMediaAttaching(data: { media: HTMLMediaElement }) {
    let media = data.media;

    if (media) {
      this._media = media; // keep reference of media
    }
  }

  onMediaDetached() {
    this._keySessions.forEach((keySession) => {
      keySession.close();
    })

    if (this._media && this._media.setMediaKeys) {
      this._media.setMediaKeys(null).then(() => {
        this.hasSetMediaKeys = false;

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

  get getEMEInitializationData() {
    if (!this._getEMEInitializationData) {
      throw new Error('No getInitializationData function configured');
    }

    return this._getEMEInitializationData;
  }

  get getEMELicense() {
    if (!this._getEMELicense) {
      throw new Error('No getEMELicense function configured');
    }

    return this._getEMELicense;
  }
}

export default EMEController;
