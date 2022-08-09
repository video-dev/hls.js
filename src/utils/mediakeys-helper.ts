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

// Playlist parser
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
    audioCapabilities: [],
    videoCapabilities: [],
  };

  audioCodecs.forEach((codec) => {
    baseConfig.audioCapabilities!.push({
      contentType: `audio/mp4; codecs="${codec}"`,
      robustness: drmSystemOptions.audioRobustness || '',
    });
  });
  videoCodecs.forEach((codec) => {
    baseConfig.videoCapabilities!.push({
      contentType: `video/mp4; codecs="${codec}"`,
      robustness: drmSystemOptions.videoRobustness || '',
    });
  });

  return [baseConfig];
}
