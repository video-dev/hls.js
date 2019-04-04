/**
 * @author Stephan Hesse <disparat@gmail.com> | <tchakabam@gmail.com>
 *
 * DRM support for Hls.js
 */

import EventHandler from '../event-handler';
import Event from '../events';
import { ErrorTypes, ErrorDetails } from '../errors';

import { logger } from '../utils/logger';

const MAX_LICENSE_REQUEST_FAILURES = 3;

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigator/requestMediaKeySystemAccess
 */
enum KeySystems {
  WIDEVINE = 'com.widevine.alpha',
  PLAYREADY = 'com.microsoft.playready',
}

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/API/MediaKeySystemConfiguration
 * @param {Array<string>} audioCodecs List of required audio codecs to support
 * @param {Array<string>} videoCodecs List of required video codecs to support
 * @param {object} drmSystemOptions Optional parameters/requirements for the key-system
 * @returns {Array<MediaSystemConfiguration>} An array of supported configurations
 */

const createWidevineMediaKeySystemConfigurations = function (audioCodecs: string[], videoCodecs: string[]): MediaKeySystemConfiguration[] { /* jshint ignore:line */
  const baseConfig: MediaKeySystemConfiguration = {
    // initDataTypes: ['keyids', 'mp4'],
    // label: "",
    // persistentState: "not-allowed", // or "required" ?
    // distinctiveIdentifier: "not-allowed", // or "required" ?
    // sessionTypes: ['temporary'],
    videoCapabilities: [] // { contentType: 'video/mp4; codecs="avc1.42E01E"' }
  };

  videoCodecs.forEach((codec) => {
    baseConfig.videoCapabilities!.push({
      contentType: `video/mp4; codecs="${codec}"`
    });
  });

  return [
    baseConfig
  ];
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
const getSupportedMediaKeySystemConfigurations = function (keySystem: KeySystems, audioCodecs: string[], videoCodecs: string[]): MediaKeySystemConfiguration[] {
  switch (keySystem) {
  case KeySystems.WIDEVINE:
    return createWidevineMediaKeySystemConfigurations(audioCodecs, videoCodecs);
  default:
    throw new Error(`Unknown key-system: ${keySystem}`);
  }
};

interface MediaKeysListItem {
  mediaKeys?: MediaKeys,
  mediaKeysSession?: MediaKeySession,
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
class EMEController extends EventHandler {
  private _widevineLicenseUrl: string;
  private _licenseXhrSetup: (xhr: XMLHttpRequest, url: string) => void;
  private _emeEnabled: boolean;
  private _requestMediaKeySystemAccess: (keySystem: KeySystems, supportedConfigurations: MediaKeySystemConfiguration[]) => Promise<MediaKeySystemAccess>

  private _mediaKeysList: MediaKeysListItem[] = []
  private _media: HTMLMediaElement | null = null;
  private _hasSetMediaKeys: boolean = false;
  private _requestLicenseFailureCount: number = 0;

  /**
     * @constructs
     * @param {Hls} hls Our Hls.js instance
     */
  constructor (hls) {
    super(hls,
      Event.MEDIA_ATTACHED,
      Event.MEDIA_DETACHED,
      Event.MANIFEST_PARSED
    );

    this._widevineLicenseUrl = hls.config.widevineLicenseUrl;
    this._licenseXhrSetup = hls.config.licenseXhrSetup;
    this._emeEnabled = hls.config.emeEnabled;
    this._requestMediaKeySystemAccess = hls.config.requestMediaKeySystemAccessFunc;
  }

  /**
   * @param {string} keySystem Identifier for the key-system, see `KeySystems` enum
   * @returns {string} License server URL for key-system (if any configured, otherwise causes error)
   * @throws if a unsupported keysystem is passed
   */
  getLicenseServerUrl (keySystem: KeySystems): string {
    switch (keySystem) {
    case KeySystems.WIDEVINE:
      return this._widevineLicenseUrl;
    }

    throw new Error(`no license server URL configured for key-system "${keySystem}"`);
  }

  /**
     * Requests access object and adds it to our list upon success
     * @private
     * @param {string} keySystem System ID (see `KeySystems`)
     * @param {Array<string>} audioCodecs List of required audio codecs to support
     * @param {Array<string>} videoCodecs List of required video codecs to support
     * @throws When a unsupported KeySystem is passed
     */
  private _attemptKeySystemAccess (keySystem: KeySystems, audioCodecs: string[], videoCodecs: string[]) {
    // TODO: add other DRM "options"

    // This can throw, but is caught in event handler callpath
    const mediaKeySystemConfigs = getSupportedMediaKeySystemConfigurations(keySystem, audioCodecs, videoCodecs);

    logger.log('Requesting encrypted media key-system access');

    // expecting interface like window.navigator.requestMediaKeySystemAccess
    this.requestMediaKeySystemAccess(keySystem, mediaKeySystemConfigs)
      .then((mediaKeySystemAccess) => {
        this._onMediaKeySystemAccessObtained(keySystem, mediaKeySystemAccess);
      })
      .catch((err) => {
        logger.error(`Failed to obtain key-system "${keySystem}" access:`, err);
      });
  }

  get requestMediaKeySystemAccess () {
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
  private _onMediaKeySystemAccessObtained (keySystem: KeySystems, mediaKeySystemAccess: MediaKeySystemAccess) {
    logger.log(`Access for key-system "${keySystem}" obtained`);

    const mediaKeysListItem: MediaKeysListItem = {
      mediaKeysSessionInitialized: false,
      mediaKeySystemAccess: mediaKeySystemAccess,
      mediaKeySystemDomain: keySystem
    };

    this._mediaKeysList.push(mediaKeysListItem);

    mediaKeySystemAccess.createMediaKeys()
      .then((mediaKeys) => {
        mediaKeysListItem.mediaKeys = mediaKeys;

        logger.log(`Media-keys created for key-system "${keySystem}"`);

        this._onMediaKeysCreated();
      })
      .catch((err) => {
        logger.error('Failed to create media-keys:', err);
      });
  }

  /**
   * Handles key-creation (represents access to CDM). We are going to create key-sessions upon this
   * for all existing keys where no session exists yet.
   *
   * @private
   */
  private _onMediaKeysCreated () {
    // check for all key-list items if a session exists, otherwise, create one
    this._mediaKeysList.forEach((mediaKeysListItem) => {
      if (!mediaKeysListItem.mediaKeysSession) {
        // mediaKeys is definitely initialized here
        mediaKeysListItem.mediaKeysSession = mediaKeysListItem.mediaKeys!.createSession();
        this._onNewMediaKeySession(mediaKeysListItem.mediaKeysSession);
      }
    });
  }

  /**
     * @private
     * @param {*} keySession
     */
  private _onNewMediaKeySession (keySession: MediaKeySession) {
    logger.log(`New key-system session ${keySession.sessionId}`);

    keySession.addEventListener('message', (event: MediaKeyMessageEvent) => {
      this._onKeySessionMessage(keySession, event.message);
    }, false);
  }

  /**
   * @private
   * @param {MediaKeySession} keySession
   * @param {ArrayBuffer} message
   */
  private _onKeySessionMessage (keySession: MediaKeySession, message: ArrayBuffer) {
    logger.log('Got EME message event, creating license request');

    this._requestLicense(message, (data: ArrayBuffer) => {
      logger.log('Received license data, updating key-session');
      keySession.update(data);
    });
  }

  /**
   * @private
   * @param {string} initDataType
   * @param {ArrayBuffer|null} initData
   */
  private _onMediaEncrypted = (e: MediaEncryptedEvent) => {
    logger.log(`Media is encrypted using "${e.initDataType}" init data type`);

    this._attemptSetMediaKeys();
    this._generateRequestWithPreferredKeySession(e.initDataType, e.initData);
  }

  /**
   * @private
   */
  private _attemptSetMediaKeys () {
    if (!this._media) {
      throw new Error('Attempted to set mediaKeys without first attaching a media element');
    }

    if (!this._hasSetMediaKeys) {
      // FIXME: see if we can/want/need-to really to deal with several potential key-sessions?
      const keysListItem = this._mediaKeysList[0];
      if (!keysListItem || !keysListItem.mediaKeys) {
        logger.error('Fatal: Media is encrypted but no CDM access or no keys have been obtained yet');
        this.hls.trigger(Event.ERROR, {
          type: ErrorTypes.KEY_SYSTEM_ERROR,
          details: ErrorDetails.KEY_SYSTEM_NO_KEYS,
          fatal: true
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
  private _generateRequestWithPreferredKeySession (initDataType: string, initData: ArrayBuffer | null) {
    // FIXME: see if we can/want/need-to really to deal with several potential key-sessions?
    const keysListItem = this._mediaKeysList[0];
    if (!keysListItem) {
      logger.error('Fatal: Media is encrypted but not any key-system access has been obtained yet');
      this.hls.trigger(Event.ERROR, {
        type: ErrorTypes.KEY_SYSTEM_ERROR,
        details: ErrorDetails.KEY_SYSTEM_NO_ACCESS,
        fatal: true
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
      this.hls.trigger(Event.ERROR, {
        type: ErrorTypes.KEY_SYSTEM_ERROR,
        details: ErrorDetails.KEY_SYSTEM_NO_SESSION,
        fatal: true
      });
      return;
    }

    logger.log(`Generating key-session request for "${initDataType}" init data type`);
    keysListItem.mediaKeysSessionInitialized = true;

    keySession.generateRequest(initDataType, initData)
      .then(() => {
        logger.debug('Key-session generation succeeded');
      })
      .catch((err) => {
        logger.error('Error generating key-session request:', err);
        this.hls.trigger(Event.ERROR, {
          type: ErrorTypes.KEY_SYSTEM_ERROR,
          details: ErrorDetails.KEY_SYSTEM_NO_SESSION,
          fatal: false
        });
      });
  }

  /**
   * @private
   * @param {string} url License server URL
   * @param {ArrayBuffer} keyMessage Message data issued by key-system
   * @param {function} callback Called when XHR has succeeded
   * @returns {XMLHttpRequest} Unsent (but opened state) XHR object
   * @throws if XMLHttpRequest construction failed
   */
  private _createLicenseXhr (url: string, keyMessage: ArrayBuffer, callback: (data: ArrayBuffer) => void): XMLHttpRequest {
    const xhr = new XMLHttpRequest();
    const licenseXhrSetup = this._licenseXhrSetup;

    try {
      if (licenseXhrSetup) {
        try {
          licenseXhrSetup(xhr, url);
        } catch (e) {
          // let's try to open before running setup
          xhr.open('POST', url, true);
          licenseXhrSetup(xhr, url);
        }
      }
      // if licenseXhrSetup did not yet call open, let's do it now
      if (!xhr.readyState) {
        xhr.open('POST', url, true);
      }
    } catch (e) {
      // IE11 throws an exception on xhr.open if attempting to access an HTTP resource over HTTPS
      throw new Error(`issue setting up KeySystem license XHR ${e}`);
    }

    // Because we set responseType to ArrayBuffer here, callback is typed as handling only array buffers
    xhr.responseType = 'arraybuffer';
    xhr.onreadystatechange =
        this._onLicenseRequestReadyStageChange.bind(this, xhr, url, keyMessage, callback);
    return xhr;
  }

  /**
   * @private
   * @param {XMLHttpRequest} xhr
   * @param {string} url License server URL
   * @param {ArrayBuffer} keyMessage Message data issued by key-system
   * @param {function} callback Called when XHR has succeeded
   */
  private _onLicenseRequestReadyStageChange (xhr: XMLHttpRequest, url: string, keyMessage: ArrayBuffer, callback: (data: ArrayBuffer) => void) {
    switch (xhr.readyState) {
    case 4:
      if (xhr.status === 200) {
        this._requestLicenseFailureCount = 0;
        logger.log('License request succeeded');

        if (xhr.responseType !== 'arraybuffer') {
          logger.warn('xhr response type was not set to the expected arraybuffer for license request');
        }
        callback(xhr.response);
      } else {
        logger.error(`License Request XHR failed (${url}). Status: ${xhr.status} (${xhr.statusText})`);
        this._requestLicenseFailureCount++;
        if (this._requestLicenseFailureCount > MAX_LICENSE_REQUEST_FAILURES) {
          this.hls.trigger(Event.ERROR, {
            type: ErrorTypes.KEY_SYSTEM_ERROR,
            details: ErrorDetails.KEY_SYSTEM_LICENSE_REQUEST_FAILED,
            fatal: true
          });
          return;
        }

        const attemptsLeft = MAX_LICENSE_REQUEST_FAILURES - this._requestLicenseFailureCount + 1;
        logger.warn(`Retrying license request, ${attemptsLeft} attempts left`);
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
  private _generateLicenseRequestChallenge (keysListItem: MediaKeysListItem, keyMessage: ArrayBuffer): ArrayBuffer {
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
    case KeySystems.WIDEVINE:
      // For Widevine CDMs, the challenge is the keyMessage.
      return keyMessage;
    }

    throw new Error(`unsupported key-system: ${keysListItem.mediaKeySystemDomain}`);
  }

  /**
   * @private
   * @param keyMessage
   * @param callback
   */
  private _requestLicense (keyMessage: ArrayBuffer, callback: (data: ArrayBuffer) => void) {
    logger.log('Requesting content license for key-system');

    const keysListItem = this._mediaKeysList[0];
    if (!keysListItem) {
      logger.error('Fatal error: Media is encrypted but no key-system access has been obtained yet');
      this.hls.trigger(Event.ERROR, {
        type: ErrorTypes.KEY_SYSTEM_ERROR,
        details: ErrorDetails.KEY_SYSTEM_NO_ACCESS,
        fatal: true
      });
      return;
    }

    try {
      const url = this.getLicenseServerUrl(keysListItem.mediaKeySystemDomain);
      const xhr = this._createLicenseXhr(url, keyMessage, callback);
      logger.log(`Sending license request to URL: ${url}`);
      const challenge = this._generateLicenseRequestChallenge(keysListItem, keyMessage);
      xhr.send(challenge);
    } catch (e) {
      logger.error(`Failure requesting DRM license: ${e}`);
      this.hls.trigger(Event.ERROR, {
        type: ErrorTypes.KEY_SYSTEM_ERROR,
        details: ErrorDetails.KEY_SYSTEM_LICENSE_REQUEST_FAILED,
        fatal: true
      });
    }
  }

  onMediaAttached (data: { media: HTMLMediaElement; }) {
    if (!this._emeEnabled) {
      return;
    }

    const media = data.media;

    // keep reference of media
    this._media = media;

    media.addEventListener('encrypted', this._onMediaEncrypted);
  }

  onMediaDetached () {
    if (this._media) {
      this._media.removeEventListener('encrypted', this._onMediaEncrypted);
      this._media = null; // release reference
    }
  }

  // TODO: Use manifest types here when they are defined
  onManifestParsed (data: any) {
    if (!this._emeEnabled) {
      return;
    }

    const audioCodecs = data.levels.map((level) => level.audioCodec);
    const videoCodecs = data.levels.map((level) => level.videoCodec);

    this._attemptKeySystemAccess(KeySystems.WIDEVINE, audioCodecs, videoCodecs);
  }
}

export default EMEController;
