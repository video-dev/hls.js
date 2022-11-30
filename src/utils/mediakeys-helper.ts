import type { DRMSystemOptions, EMEControllerConfig } from '../config';

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigator/requestMediaKeySystemAccess
 */
export enum KeySystems {
  CLEARKEY = 'org.w3.clearkey',
  FAIRPLAY = 'com.apple.fps',
  PLAYREADY = 'com.microsoft.playready',
  WIDEVINE = 'com.widevine.alpha',
}

// Playlist #EXT-X-KEY KEYFORMAT values
export enum KeySystemFormats {
  CLEARKEY = 'org.w3.clearkey',
  FAIRPLAY = 'com.apple.streamingkeydelivery',
  PLAYREADY = 'com.microsoft.playready',
  WIDEVINE = 'urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed',
}

export function keySystemFormatToKeySystemDomain(
  format: KeySystemFormats
): KeySystems | undefined {
  if (format === KeySystemFormats.FAIRPLAY) {
    return KeySystems.FAIRPLAY;
  } else if (format === KeySystemFormats.PLAYREADY) {
    return KeySystems.PLAYREADY;
  } else if (format === KeySystemFormats.WIDEVINE) {
    return KeySystems.WIDEVINE;
  } else if (format === KeySystemFormats.CLEARKEY) {
    return KeySystems.CLEARKEY;
  }
}

// System IDs for which we can extract a key ID from "encrypted" event PSSH
export enum KeySystemIds {
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
  if (keySystem === KeySystems.FAIRPLAY) {
    return KeySystemFormats.FAIRPLAY;
  } else if (keySystem === KeySystems.PLAYREADY) {
    return KeySystemFormats.PLAYREADY;
  } else if (keySystem === KeySystems.WIDEVINE) {
    return KeySystemFormats.WIDEVINE;
  } else if (keySystem === KeySystems.CLEARKEY) {
    return KeySystemFormats.CLEARKEY;
  }
}

export function getKeySystemsForConfig(
  config: EMEControllerConfig
): KeySystems[] {
  const { drmSystems, widevineLicenseUrl } = config;
  const keySystemsToAttempt: KeySystems[] = [];
  [KeySystems.FAIRPLAY, KeySystems.PLAYREADY, KeySystems.CLEARKEY].forEach(
    (keySystem) => {
      if (drmSystems?.[keySystem]) {
        keySystemsToAttempt.push(keySystem);
      }
    }
  );
  if (widevineLicenseUrl || drmSystems?.[KeySystems.WIDEVINE]) {
    keySystemsToAttempt.push(KeySystems.WIDEVINE);
  } else if (keySystemsToAttempt.length === 0) {
    keySystemsToAttempt.push(
      KeySystems.WIDEVINE,
      KeySystems.FAIRPLAY,
      KeySystems.PLAYREADY
    );
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
      initDataTypes = ['cenc', 'sinf', 'skd'];
      break;
    case KeySystems.WIDEVINE:
    case KeySystems.CLEARKEY:
      initDataTypes = ['cenc', 'keyids'];
      break;
    case KeySystems.PLAYREADY:
      initDataTypes = ['cenc'];
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
