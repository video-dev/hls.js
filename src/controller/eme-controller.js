/**
 * @author Stephan Hesse <disparat@gmail.com> | <tchakabam@gmail.com>
 *
 * DRM support for Hls.js
 */

import EventHandler from '../event-handler';
import Event from '../events';
import { ErrorTypes, ErrorDetails } from '../errors';

import { logger } from '../utils/logger';

const { XMLHttpRequest } = window;

const MAX_LICENSE_REQUEST_FAILURES = 3;

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigator/requestMediaKeySystemAccess
 */
const KeySystems = {
  WIDEVINE: 'com.widevine.alpha',
  PLAYREADY: 'com.microsoft.playready'
};

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/API/MediaKeySystemConfiguration
 * @param {Array<string>} audioCodecs List of required audio codecs to support
 * @param {Array<string>} videoCodecs List of required video codecs to support
 * @param {object} drmSystemOptions Optional parameters/requirements for the key-system
 * @returns {Array<MediaSystemConfiguration>} An array of supported configurations
 */

const createWidevineMediaKeySystemConfigurations = function (audioCodecs, videoCodecs, drmSystemOptions) { /* jshint ignore:line */
  const baseConfig = {
    // initDataTypes: ['keyids', 'mp4'],
    // label: "",
    // persistentState: "not-allowed", // or "required" ?
    // distinctiveIdentifier: "not-allowed", // or "required" ?
    // sessionTypes: ['temporary'],
    videoCapabilities: [
      // { contentType: 'video/mp4; codecs="avc1.42E01E"' }
    ]
  };

  videoCodecs.forEach((codec) => {
    baseConfig.videoCapabilities.push({
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
 * We can also rule-out platform-related key-system support at this point by throwing an error or returning null.
 *
 * @param {string} keySystem Identifier for the key-system, see `KeySystems` enum
 * @param {Array<string>} audioCodecs List of required audio codecs to support
 * @param {Array<string>} videoCodecs List of required video codecs to support
 * @returns {Array<MediaSystemConfiguration> | null} A non-empty Array of MediaKeySystemConfiguration objects or `null`
 */
const getSupportedMediaKeySystemConfigurations = function (keySystem, audioCodecs, videoCodecs) {
  switch (keySystem) {
  case KeySystems.WIDEVINE:
    return createWidevineMediaKeySystemConfigurations(audioCodecs, videoCodecs);
  default:
    throw Error('Unknown key-system: ' + keySystem);
  }
};

/**
 * Controller to deal with encrypted media extensions (EME)
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Encrypted_Media_Extensions_API
 *
 * @class
 * @constructor
 */
class EMEController extends EventHandler {
  /**
     * @constructs
     * @param {Hls} hls Our Hls.js instance
     */
  constructor (hls) {
    super(hls,
      Event.MEDIA_ATTACHED,
      Event.MANIFEST_PARSED
    );

    this._widevineLicenseUrl = hls.config.widevineLicenseUrl;
    this._licenseXhrSetup = hls.config.licenseXhrSetup;
    this._emeEnabled = hls.config.emeEnabled;

    this._requestMediaKeySystemAccess = hls.config.requestMediaKeySystemAccessFunc;

    this._mediaKeysList = [];
    this._media = null;

    this._hasSetMediaKeys = false;
    this._isMediaEncrypted = false;

    this._requestLicenseFailureCount = 0;
  }

  /**
     *
     * @param {string} keySystem Identifier for the key-system, see `KeySystems` enum
     * @returns {string} License server URL for key-system (if any configured, otherwise causes error)
     */
  getLicenseServerUrl (keySystem) {
    let url;
    switch (keySystem) {
    case KeySystems.WIDEVINE:
      url = this._widevineLicenseUrl;
      break;
    default:
      url = null;
      break;
    }

    if (!url) {
      logger.error(`No license server URL configured for key-system "${keySystem}"`);
      this.hls.trigger(Event.ERROR, {
        type: ErrorTypes.KEY_SYSTEM_ERROR,
        details: ErrorDetails.KEY_SYSTEM_LICENSE_REQUEST_FAILED,
        fatal: true
      });
    }

    return url;
  }

  /**
     * Requests access object and adds it to our list upon success
     * @private
     * @param {string} keySystem System ID (see `KeySystems`)
     * @param {Array<string>} audioCodecs List of required audio codecs to support
     * @param {Array<string>} videoCodecs List of required video codecs to support
     */
  _attemptKeySystemAccess (keySystem, audioCodecs, videoCodecs) {
    // TODO: add other DRM "options"

    const mediaKeySystemConfigs = getSupportedMediaKeySystemConfigurations(keySystem, audioCodecs, videoCodecs);

    if (!mediaKeySystemConfigs) {
      logger.warn('Can not create config for key-system (maybe because platform is not supported):', keySystem);
      return;
    }

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
     *
     * @param {string} keySystem
     * @param {MediaKeySystemAccess} mediaKeySystemAccess https://developer.mozilla.org/en-US/docs/Web/API/MediaKeySystemAccess
     */
  _onMediaKeySystemAccessObtained (keySystem, mediaKeySystemAccess) {
    logger.log(`Access for key-system "${keySystem}" obtained`);

    const mediaKeysListItem = {
      mediaKeys: null,
      mediaKeysSession: null,
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
     */
  _onMediaKeysCreated () {
    // check for all key-list items if a session exists, otherwise, create one
    this._mediaKeysList.forEach((mediaKeysListItem) => {
      if (!mediaKeysListItem.mediaKeysSession) {
        mediaKeysListItem.mediaKeysSession = mediaKeysListItem.mediaKeys.createSession();
        this._onNewMediaKeySession(mediaKeysListItem.mediaKeysSession);
      }
    });
  }

  /**
     *
     * @param {*} keySession
     */
  _onNewMediaKeySession (keySession) {
    logger.log(`New key-system session ${keySession.sessionId}`);

    keySession.addEventListener('message', (event) => {
      this._onKeySessionMessage(keySession, event.message);
    }, false);
  }

  _onKeySessionMessage (keySession, message) {
    logger.log('Got EME message event, creating license request');

    this._requestLicense(message, (data) => {
      logger.log('Received license data, updating key-session');
      keySession.update(data);
    });
  }

  _onMediaEncrypted (initDataType, initData) {
    logger.log(`Media is encrypted using "${initDataType}" init data type`);

    this._isMediaEncrypted = true;
    this._mediaEncryptionInitDataType = initDataType;
    this._mediaEncryptionInitData = initData;

    this._attemptSetMediaKeys();
    this._generateRequestWithPreferredKeySession();
  }

  _attemptSetMediaKeys () {
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

  _generateRequestWithPreferredKeySession () {
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
    }

    const initDataType = this._mediaEncryptionInitDataType;
    const initData = this._mediaEncryptionInitData;

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
     * @param {string} url License server URL
     * @param {ArrayBuffer} keyMessage Message data issued by key-system
     * @param {function} callback Called when XHR has succeeded
     * @returns {XMLHttpRequest} Unsent (but opened state) XHR object
     */
  _createLicenseXhr (url, keyMessage, callback) {
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
      logger.error('Error setting up key-system license XHR', e);
      this.hls.trigger(Event.ERROR, {
        type: ErrorTypes.KEY_SYSTEM_ERROR,
        details: ErrorDetails.KEY_SYSTEM_LICENSE_REQUEST_FAILED,
        fatal: true
      });
      return;
    }

    xhr.responseType = 'arraybuffer';
    xhr.onreadystatechange =
        this._onLicenseRequestReadyStageChange.bind(this, xhr, url, keyMessage, callback);
    return xhr;
  }

  /**
     * @param {XMLHttpRequest} xhr
     * @param {string} url License server URL
     * @param {ArrayBuffer} keyMessage Message data issued by key-system
     * @param {function} callback Called when XHR has succeeded
     *
     */
  _onLicenseRequestReadyStageChange (xhr, url, keyMessage, callback) {
    switch (xhr.readyState) {
    case 4:
      if (xhr.status === 200) {
        this._requestLicenseFailureCount = 0;
        logger.log('License request succeeded');
        callback(xhr.response);
      } else {
        logger.error(`License Request XHR failed (${url}). Status: ${xhr.status} (${xhr.statusText})`);

        this._requestLicenseFailureCount++;
        if (this._requestLicenseFailureCount <= MAX_LICENSE_REQUEST_FAILURES) {
          const attemptsLeft = MAX_LICENSE_REQUEST_FAILURES - this._requestLicenseFailureCount + 1;
          logger.warn(`Retrying license request, ${attemptsLeft} attempts left`);
          this._requestLicense(keyMessage, callback);
          return;
        }

        this.hls.trigger(Event.ERROR, {
          type: ErrorTypes.KEY_SYSTEM_ERROR,
          details: ErrorDetails.KEY_SYSTEM_LICENSE_REQUEST_FAILED,
          fatal: true
        });
      }
      break;
    }
  }

  /**
     * @param {object} keysListItem
     * @param {ArrayBuffer} keyMessage
     * @returns {ArrayBuffer} Challenge data posted to license server
     */
  _generateLicenseRequestChallenge (keysListItem, keyMessage) {
    let challenge;

    if (keysListItem.mediaKeySystemDomain === KeySystems.PLAYREADY) {
      logger.error('PlayReady is not supported (yet)');

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
        */
    } else if (keysListItem.mediaKeySystemDomain === KeySystems.WIDEVINE) {
      // For Widevine CDMs, the challenge is the keyMessage.
      challenge = keyMessage;
    } else {
      logger.error('Unsupported key-system:', keysListItem.mediaKeySystemDomain);
    }

    return challenge;
  }

  _requestLicense (keyMessage, callback) {
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

    const url = this.getLicenseServerUrl(keysListItem.mediaKeySystemDomain);
    const xhr = this._createLicenseXhr(url, keyMessage, callback);

    logger.log(`Sending license request to URL: ${url}`);

    xhr.send(this._generateLicenseRequestChallenge(keysListItem, keyMessage));
  }

  onMediaAttached (data) {
    if (!this._emeEnabled) {
      return;
    }

    const media = data.media;

    // keep reference of media
    this._media = media;

    // FIXME: also handle detaching media !

    media.addEventListener('encrypted', (e) => {
      this._onMediaEncrypted(e.initDataType, e.initData);
    });
  }

  onManifestParsed (data) {
    if (!this._emeEnabled) {
      return;
    }

    const audioCodecs = data.levels.map((level) => level.audioCodec);
    const videoCodecs = data.levels.map((level) => level.videoCodec);

    this._attemptKeySystemAccess(KeySystems.WIDEVINE, audioCodecs, videoCodecs);
  }
}

export default EMEController;
