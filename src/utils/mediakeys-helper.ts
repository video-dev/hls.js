import type { DRMSystemOptions, EMEControllerConfig } from '../config';

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigator/requestMediaKeySystemAccess
 */
export const enum KeySystems {
  CLEARKEY = 'org.w3.clearkey',
  FAIRPLAY = 'com.apple.fps',
  PLAYREADY = 'com.microsoft.playready',
  WIDEVINE = 'com.widevine.alpha',
}

// Playlist #EXT-X-KEY KEYFORMAT values
export const enum KeySystemFormats {
  CLEARKEY = 'org.w3.clearkey',
  FAIRPLAY = 'com.apple.streamingkeydelivery',
  PLAYREADY = 'com.microsoft.playready',
  WIDEVINE = 'urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed',
}

export function keySystemFormatToKeySystemDomain(
  format: KeySystemFormats
): KeySystems | undefined {
  switch (format) {
    case KeySystemFormats.FAIRPLAY:
      return KeySystems.FAIRPLAY;
    case KeySystemFormats.PLAYREADY:
      return KeySystems.PLAYREADY;
    case KeySystemFormats.WIDEVINE:
      return KeySystems.WIDEVINE;
    case KeySystemFormats.CLEARKEY:
      return KeySystems.CLEARKEY;
  }
}

// System IDs for which we can extract a key ID from "encrypted" event PSSH
export const enum KeySystemIds {
  // CENC = '1077efecc0b24d02ace33c1e52e2fb4b'
  // CLEARKEY = 'e2719d58a985b3c9781ab030af78d30e',
  // FAIRPLAY = '94ce86fb07ff4f43adb893d2fa968ca2',
  // PLAYREADY = '9a04f07998404286ab92e65be0885f95',
  WIDEVINE = 'edef8ba979d64acea3c827dcd51d21ed',
}

export function keySystemIdToKeySystemDomain(
  systemId: KeySystemIds
): KeySystems | undefined {
  if (systemId === KeySystemIds.WIDEVINE) {
    return KeySystems.WIDEVINE;
    // } else if (systemId === KeySystemIds.PLAYREADY) {
    //   return KeySystems.PLAYREADY;
    // } else if (systemId === KeySystemIds.CENC || systemId === KeySystemIds.CLEARKEY) {
    //   return KeySystems.CLEARKEY;
  }
}

export function keySystemDomainToKeySystemFormat(
  keySystem: KeySystems
): KeySystemFormats | undefined {
  switch (keySystem) {
    case KeySystems.FAIRPLAY:
      return KeySystemFormats.FAIRPLAY;
    case KeySystems.PLAYREADY:
      return KeySystemFormats.PLAYREADY;
    case KeySystems.WIDEVINE:
      return KeySystemFormats.WIDEVINE;
    case KeySystems.CLEARKEY:
      return KeySystemFormats.CLEARKEY;
  }
}

export function getKeySystemsForConfig(
  config: EMEControllerConfig
): KeySystems[] {
  const { drmSystems, widevineLicenseUrl } = config;
  const keySystemsToAttempt: KeySystems[] = drmSystems
    ? [
        KeySystems.FAIRPLAY,
        KeySystems.WIDEVINE,
        KeySystems.PLAYREADY,
        KeySystems.CLEARKEY,
      ].filter((keySystem) => !!drmSystems[keySystem])
    : [];
  if (!keySystemsToAttempt[KeySystems.WIDEVINE] && widevineLicenseUrl) {
    keySystemsToAttempt.push(KeySystems.WIDEVINE);
  }
  return keySystemsToAttempt;
}

export type MediaKeyFunc = (
  keySystem: KeySystems,
  supportedConfigurations: MediaKeySystemConfiguration[]
) => Promise<MediaKeySystemAccess>;

export const requestMediaKeySystemAccess = (function (): MediaKeyFunc | null {
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

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/API/MediaKeySystemConfiguration
 */
export function getSupportedMediaKeySystemConfigurations(
  keySystem: KeySystems,
  audioCodecs: string[],
  videoCodecs: string[],
  drmSystemOptions: DRMSystemOptions
): MediaKeySystemConfiguration[] {
  let initDataTypes: string[];
  switch (keySystem) {
    case KeySystems.FAIRPLAY:
      initDataTypes = ['cenc', 'sinf'];
      break;
    case KeySystems.WIDEVINE:
    case KeySystems.PLAYREADY:
      initDataTypes = ['cenc'];
      break;
    case KeySystems.CLEARKEY:
      initDataTypes = ['cenc', 'keyids'];
      break;
    default:
      throw new Error(`Unknown key-system: ${keySystem}`);
  }
  return createMediaKeySystemConfigurations(
    initDataTypes,
    audioCodecs,
    videoCodecs,
    drmSystemOptions
  );
}

function createMediaKeySystemConfigurations(
  initDataTypes: string[],
  audioCodecs: string[],
  videoCodecs: string[],
  drmSystemOptions: DRMSystemOptions
): MediaKeySystemConfiguration[] {
  const baseConfig: MediaKeySystemConfiguration = {
    initDataTypes: initDataTypes,
    persistentState: drmSystemOptions.persistentState || 'not-allowed',
    distinctiveIdentifier:
      drmSystemOptions.distinctiveIdentifier || 'not-allowed',
    sessionTypes: drmSystemOptions.sessionTypes || [
      drmSystemOptions.sessionType || 'temporary',
    ],
    audioCapabilities: audioCodecs.map((codec) => ({
      contentType: `audio/mp4; codecs="${codec}"`,
      robustness: drmSystemOptions.audioRobustness || '',
      encryptionScheme: drmSystemOptions.audioEncryptionScheme || null,
    })),
    videoCapabilities: videoCodecs.map((codec) => ({
      contentType: `video/mp4; codecs="${codec}"`,
      robustness: drmSystemOptions.videoRobustness || '',
      encryptionScheme: drmSystemOptions.videoEncryptionScheme || null,
    })),
  };

  return [baseConfig];
}
