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
    WIDEVINE: 'com.widevine.alpha'
}

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/API/MediaKeySystemConfiguration
 * @param {Array<string>} audioCodecs List of required audio codecs to support
 * @param {Array<string>} videoCodecs List of required video codecs to support
 * @param {object} drmOptions Optional parameters/requirements for the key-system
 * @returns {Array<MediaSystemConfiguration>} An array of supported configurations
 */
const createWidevineMediaKeySystemConfigurations = function(audioCodecs, videoCodecs, drmOptions) {
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
}

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
        return createWidevineMediaKeySystemConfigurations(audioCodecs, videoCodecs)
    default:
        throw Error('Unknown key-system: ' + keySystem);
    }
}

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
            Event.MEDIA_ATTACHING,
            Event.MEDIA_ATTACHED,
            Event.MANIFEST_PARSED,
            Event.LEVEL_SWITCHED
        );

        console.log('EME controller online');

        this._mediaKeySystemAccessList = [];
        this._mediaKeysList = [];
        this._media = null;

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

                console.log('Key system access obtained with config:', 
                    mediaKeySystemAccess.getConfiguration());

                const mediaKeysListItem = {
                    mediaKeys: null,
                    mediaKeysSession: null,
                    mediaKeySystemAccess: mediaKeySystemAccess
                };

                this._mediaKeysList.push(mediaKeysListItem);

                // this is a bit redundant for now, let's see if we ll really need it
                this._mediaKeySystemAccessList.push(mediaKeySystemAccess);
        
                mediaKeySystemAccess.createMediaKeys()
                    .then((mediaKeys) => {
                        mediaKeysListItem.mediaKeys = mediaKeys;

                        console.log('Created media-keys:', mediaKeys);
                    })
                    .catch((err) => {
                        console.error('Failed to create media-keys:', err);
                    });

                console.log('Obtained key-system access for:', keySystem);
            })
            .catch((err) => {
                console.error(`Failed to obtain key-system ${keySystem} access:`, err);
            });
    }

    _setMediaEncrypted(isEncrypted) {
        this._isMediaEncrypted = isEncrypted;

        if (isEncrypted) {

            console.log('Media is encrypted!');

            const keysListItem = this._mediaKeysList[0];

            if (!keysListItem) {
                console.error('Fatal error: Media is encrypted but no key-system access has been obtained yet');
                return;
            }

            this._media.setMediaKeys(keysListItem.mediaKeys);

            console.log('Media keys set!');
        }
    }

    // Event handlers

    onMediaAttaching(data) {
        console.log('media attaching');
    }

    onMediaAttached(data) {
        const media = data.media;

        console.log('media attached:', media);

        this._media = media;

        media.addEventListener('encrypted', () => {
            this._setMediaEncrypted(true);
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