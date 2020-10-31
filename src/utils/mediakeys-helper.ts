/**
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigator/requestMediaKeySystemAccess
 */
/* eslint-disable no-restricted-syntax */
export enum KeySystems {
  WIDEVINE = 'com.widevine.alpha',
  PLAYREADY = 'com.microsoft.playready',
}
/* eslint-enable no-restricted-syntax */

export type MediaKeyFunc = (keySystem: KeySystems, supportedConfigurations: MediaKeySystemConfiguration[]) => Promise<MediaKeySystemAccess>;
const requestMediaKeySystemAccess = (function (): MediaKeyFunc | null {
  if (typeof self !== 'undefined' && self.navigator && self.navigator.requestMediaKeySystemAccess) {
    return self.navigator.requestMediaKeySystemAccess.bind(self.navigator);
  } else {
    return null;
  }
})();

export {
  requestMediaKeySystemAccess
};
