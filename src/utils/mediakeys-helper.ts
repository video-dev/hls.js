/**
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigator/requestMediaKeySystemAccess
 */
export enum KeySystems {
  WIDEVINE = 'com.widevine.alpha',
  PLAYREADY = 'com.microsoft.playready',
}

export type MediaKeyFunc = (keySystem: KeySystems, supportedConfigurations: MediaKeySystemConfiguration[]) => Promise<MediaKeySystemAccess>;
const requestMediaKeySystemAccess = (function (): MediaKeyFunc | null {
  if (typeof window !== 'undefined' && window.navigator && window.navigator.requestMediaKeySystemAccess) {
    return window.navigator.requestMediaKeySystemAccess.bind(window.navigator);
  } else {
    return null;
  }
})();

export {
  requestMediaKeySystemAccess
};
