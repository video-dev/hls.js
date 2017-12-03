/**
 * @author Stephan Hesse <disparat@gmail.com> | <tchakabam@gmail.com>
 *
 * DRM support for Hls.js
 */

import EventHandler from '../event-handler';
import Event from '../events';

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

const createWidevineMediaKeySystemConfigurations = function(audioCodecs, videoCodecs, drmSystemOptions) { /* jshint ignore:line */
    const baseConfig = {
        //initDataTypes: ['keyids', 'mp4'],
        //label: "",
        //persistentState: "not-allowed", // or "required" ?
        //distinctiveIdentifier: "not-allowed", // or "required" ?
        //sessionTypes: ['temporary'],
        videoCapabilities: [
            //{ contentType: 'video/mp4; codecs="avc1.42E01E"' }
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
const getSupportedMediaKeySystemConfigurations = function(keySystem, audioCodecs, videoCodecs) {
    switch(keySystem) {
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
    constructor(hls) {
        super(hls,
            Event.MEDIA_ATTACHED,
            Event.MANIFEST_PARSED,
            Event.LEVEL_SWITCHED
        );

        this._drmConfig = hls.config.drmConfig;

        console.log('EME controller online');

        this._mediaKeysList = [];
        this._media = null;

        this._hasSetMediaKeys = false;
        this._isMediaEncrypted = false;
    }

    /**
     * Requests access object and adds it to our list upon success
     * @private
     * @param {string} keySystem System ID (see `KeySystems`)
     * @param {Array<string>} audioCodecs List of required audio codecs to support
     * @param {Array<string>} videoCodecs List of required video codecs to support
     */
    _attemptKeySystemAccess(keySystem, audioCodecs, videoCodecs) {

        // TODO: add other DRM "options"

        const mediaKeySystemConfigs = getSupportedMediaKeySystemConfigurations(keySystem, audioCodecs, videoCodecs);

        if (!mediaKeySystemConfigs) {
            console.warn('Can not create config for key-system (maybe because platform is not supported):', keySystem);
            return;
        }

        console.log(mediaKeySystemConfigs);

        window.navigator.requestMediaKeySystemAccess(keySystem, mediaKeySystemConfigs)
            .then((mediaKeySystemAccess) => {
                this._onMediaKeySystemAccessObtained(keySystem, mediaKeySystemAccess);
            })
            .catch((err) => {
                console.error(`Failed to obtain key-system ${keySystem} access:`, err);
            });
    }

    /**
     * Handles obtaining access to a key-system
     *
     * @param {string} keySystem
     * @param {MediaKeySystemAccess} mediaKeySystemAccess https://developer.mozilla.org/en-US/docs/Web/API/MediaKeySystemAccess
     */
    _onMediaKeySystemAccessObtained(keySystem, mediaKeySystemAccess) {

        console.log('Key system access obtained with config:',
            mediaKeySystemAccess.getConfiguration());

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

                console.log('Created media-keys:', mediaKeys);

                this._onMediaKeysCreated();
            })
            .catch((err) => {
                console.error('Failed to create media-keys:', err);
            });

        console.log('Obtained key-system access for:', keySystem);
    }

    /**
     * Handles key-creation (represents access to CDM). We are going to create key-sessions upon this
     * for all existing keys where no session exists yet.
     */
    _onMediaKeysCreated() {

        // check for all key-list items if a session exists, otherwise, create one
        this._mediaKeysList.forEach((mediaKeysListItem) => {
            if(!mediaKeysListItem.mediaKeysSession) {
                mediaKeysListItem.mediaKeysSession = mediaKeysListItem.mediaKeys.createSession();
                this._onNewMediaKeySession(mediaKeysListItem.mediaKeysSession);
            }
        });
    }

    /**
     *
     * @param {*} keySession
     */
    _onNewMediaKeySession(keySession) {
        console.log('New key-system session:', keySession);

        keySession.addEventListener('message', (event) => {
            console.log('Key-session message event:', event);
            this._onKeySessionMessage(keySession, event.message);
        }, false);
    }

    _onKeySessionMessage(keySession, message) {

        console.log('message:', message);

        this._requestLicense(message, (data) => {
            keySession.update(data);
        });
    }

    _onMediaEncrypted(initDataType, initData) {

        console.log('Media is encrypted, init data:', initDataType, initData);

        this._isMediaEncrypted = true;
        this._mediaEncryptionInitDataType = initDataType;
        this._mediaEncryptionInitData = initData;

        this._attemptSetMediaKeys();
        this._generateRequestWithPreferredKeySession();
    }

    _attemptSetMediaKeys() {
        if (!this._hasSetMediaKeys) {

            // FIXME: see if we can/want/need-to really to deal with several potential key-sessions?
            const keysListItem = this._mediaKeysList[0];
            if (!keysListItem || !keysListItem.mediaKeys) {
                console.error('Fatal error: Media is encrypted but no CDM access and keys have been obtained yet');
                return;
            }

            this._media.setMediaKeys(keysListItem.mediaKeys);
            this._hasSetMediaKeys = true;

            console.log('Media keys set!');
        }
    }

    _generateRequestWithPreferredKeySession() {

        // FIXME: see if we can/want/need-to really to deal with several potential key-sessions?
        const keysListItem = this._mediaKeysList[0];
        if (!keysListItem) {
            console.error('Fatal error: Media is encrypted but no key-system access has been obtained yet');
            return;
        }

        if (keysListItem.mediaKeysSessionInitialized) {
            console.log('Key-Session already initialized');
            return;
        }

        const keySession = keysListItem.mediaKeysSession;
        if (!keySession) {
            console.error('Fatal error: Media is encrypted but no key-session existing');
        }

        const initDataType = this._mediaEncryptionInitDataType;
        const initData = this._mediaEncryptionInitData;

        console.log('generating key-session request:', initDataType, initData);

        keysListItem.mediaKeysSessionInitialized = true;

        keySession.generateRequest(initDataType, initData)
            .then(() => {
                console.log('generateRequest succeeded');
            })
            .catch((err) => {
                console.error('Error generating key-session request:', err);
        });
    }

    _requestLicense(keyMessage, callback) {

        const keysListItem = this._mediaKeysList[0];
        if (!keysListItem) {
            console.error('Fatal error: Media is encrypted but no key-system access has been obtained yet');
            return;
        }

        const url = this._drmConfig.widevineLicenseUrl;

        console.log('_requestLicense');

        let challenge;

        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        xhr.responseType = 'arraybuffer';
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    console.log('License received');
                    callback(xhr.response);
                } else {
                    throw new Error('XHR failed (' + url + '). Status: ' + xhr.status + ' (' + xhr.statusText + ')');
                }
            }
        };

        if (keysListItem.mediaKeySystemDomain === KeySystems.PLAYREADY) {

            console.error('PlayReady is not supported (yet)');

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
            console.error('Unsupported key-system:', keysListItem.mediaKeySystemDomain);
        }

        xhr.send(challenge);
    }

    onMediaAttached(data) {
        const media = data.media;

        console.log('media attached:', media);

        this._media = media;

        media.addEventListener('encrypted', (e) => {
            this._onMediaEncrypted(e.initDataType, e.initData);
        });
    }

    onManifestParsed(data) {
        console.log('onManifestParsed:', data);

        const audioCodecs = data.levels.map((level) => level.audioCodec);
        const videoCodecs = data.levels.map((level) => level.videoCodec);

        console.log(videoCodecs);

        this._attemptKeySystemAccess(KeySystems.WIDEVINE, audioCodecs, videoCodecs);
    }

    onLevelSwitched(data) {
        console.log('onLevelSwitched:', data);
    }
}

export default EMEController;
