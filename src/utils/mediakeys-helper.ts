/**
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigator/requestMediaKeySystemAccess
 */
export enum KeySystems {
  WIDEVINE = 'com.widevine.alpha',
  PLAYREADY = 'com.microsoft.playready',
}

export type MediaKeyFunc = (
  keySystem: KeySystems,
  supportedConfigurations: MediaKeySystemConfiguration[]
) => Promise<MediaKeySystemAccess>;
const requestMediaKeySystemAccess = (function (): MediaKeyFunc | null {
  if (
    typeof self !== 'undefined' &&
    self.navigator &&
    self.navigator.requestMediaKeySystemAccess
  ) {
    return self.navigator.requestMediaKeySystemAccess.bind(self.navigator);
  } else {
    return null;
  }
})();

export { requestMediaKeySystemAccess };
