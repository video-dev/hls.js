import { MediaKeysListItem } from '../controller/eme-controller';

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigator/requestMediaKeySystemAccess
 */
export enum KeySystems {
  WIDEVINE = 'com.widevine.alpha',
  PLAYREADY = 'com.microsoft.playready',
  FAIRPLAY = 'com.apple.fps.3_0'
}

export type MediaKeyFunc = (keySystem: KeySystems, supportedConfigurations: MediaKeySystemConfiguration[]) => Promise<MediaKeySystemAccess>;
const requestMediaKeySystemAccess = (function (): MediaKeyFunc | null {
  if (typeof window !== 'undefined' && window.navigator && window.navigator.requestMediaKeySystemAccess) {
    return window.navigator.requestMediaKeySystemAccess.bind(window.navigator);
  } else {
    return null;
  }
})();

export type GenerateLicenseChallengFunc = (keySystemItem: MediaKeysListItem, keyMessage: ArrayBuffer) => ArrayBuffer;
const generateLicenseChallenge = (keySystemItem: MediaKeysListItem, keyMessage: ArrayBuffer): ArrayBuffer => {
  switch (keySystemItem.mediaKeySystemDomain) {
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
  case KeySystems.FAIRPLAY:
    // For Widevine CDMs, the challenge is the keyMessage.
    return keyMessage;
  }

  throw new Error(`unsupported key-system: ${keySystemItem.mediaKeySystemDomain}`);
};

export {
  requestMediaKeySystemAccess,
  generateLicenseChallenge
};
