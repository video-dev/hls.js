import AbrController from './controller/abr-controller';
import AudioStreamController from './controller/audio-stream-controller';
import AudioTrackController from './controller/audio-track-controller';
import BufferController from './controller/buffer-controller';
import CapLevelController from './controller/cap-level-controller';
import FPSController from './controller/fps-controller';

import { TimelineController } from './controller/timeline-controller';
import SubtitleTrackController from './controller/subtitle-track-controller';
import EMEController from './controller/eme-controller';

import XhrLoader from './utils/xhr-loader';
import FetchLoader, { fetchSupported } from './utils/fetch-loader';
import * as Cues from './utils/cues';
import { SubtitleStreamController } from './controller/subtitle-stream-controller';
import { requestMediaKeySystemAccess, MediaKeyFunc } from './utils/mediakeys-helper';
import { logger } from './utils/logger';

type ABRControllerConfig = {
  abrEwmaFastLive: number,
  abrEwmaSlowLive: number,
  abrEwmaFastVoD: number,
  abrEwmaSlowVoD: number,
  abrEwmaDefaultEstimate: number,
  abrBandWidthFactor: number,
  abrBandWidthUpFactor: number,
  abrMaxWithRealBitrate: boolean,
  maxStarvationDelay: number,
  maxLoadingDelay: number,
};

export type BufferControllerConfig = {
  appendErrorMaxRetry: number,
  liveDurationInfinity: boolean,
  liveBackBufferLength: number,
};

type CapLevelControllerConfig = {
  capLevelToPlayerSize: boolean
};

export type DRMSystemOptions = {
  audioRobustness?: string,
  videoRobustness?: string,
}

export type EMEControllerConfig = {
  licenseXhrSetup?: (xhr: XMLHttpRequest, url: string) => void,
  emeEnabled: boolean,
  widevineLicenseUrl?: string,
  drmSystemOptions: DRMSystemOptions,
  requestMediaKeySystemAccessFunc: MediaKeyFunc | null,
};

type FragmentLoaderConfig = {
  fLoader: any, // TODO(typescript-loader): Once Loader is typed fill this in

  fragLoadingTimeOut: number,
  fragLoadingMaxRetry: number,
  fragLoadingRetryDelay: number,
  fragLoadingMaxRetryTimeout: number,
};

type FPSControllerConfig = {
  capLevelOnFPSDrop: boolean,
  fpsDroppedMonitoringPeriod: number,
  fpsDroppedMonitoringThreshold: number,
};

type LevelControllerConfig = {
  startLevel?: number
};

export type MP4RemuxerConfig = {
  stretchShortVideoTrack: boolean,
  maxAudioFramesDrift: number,
};

type PlaylistLoaderConfig = {
  pLoader: any, // TODO(typescript-loader): Once Loader is typed fill this in

  manifestLoadingTimeOut: number,
  manifestLoadingMaxRetry: number,
  manifestLoadingRetryDelay: number,
  manifestLoadingMaxRetryTimeout: number,

  levelLoadingTimeOut: number,
  levelLoadingMaxRetry: number,
  levelLoadingRetryDelay: number,
  levelLoadingMaxRetryTimeout: number
};

type StreamControllerConfig = {
  autoStartLoad: boolean,
  startPosition: number,
  defaultAudioCodec?: string,
  initialLiveManifestSize: number,
  maxBufferLength: number,
  maxBufferSize: number,
  maxBufferHole: number,

  lowBufferWatchdogPeriod: number,
  highBufferWatchdogPeriod: number,
  nudgeOffset: number,
  nudgeMaxRetry: number,
  maxFragLookUpTolerance: number,
  liveSyncDurationCount: number,
  liveMaxLatencyDurationCount: number,
  liveSyncDuration?: number,
  liveMaxLatencyDuration?: number,
  maxMaxBufferLength: number,

  startFragPrefetch: boolean,
  testBandwidth: boolean
};

type TimelineControllerConfig = {
  cueHandler: Cues.CuesInterface,
  enableCEA708Captions: boolean,
  enableWebVTT: boolean,
  enableIMSC1: boolean,
  captionsTextTrack1Label: string,
  captionsTextTrack1LanguageCode: string,
  captionsTextTrack2Label: string,
  captionsTextTrack2LanguageCode: string,
  captionsTextTrack3Label: string,
  captionsTextTrack3LanguageCode: string,
  captionsTextTrack4Label: string,
  captionsTextTrack4LanguageCode: string,
  renderTextTracksNatively: boolean
};

type TSDemuxerConfig = {
  forceKeyFrameOnDiscontinuity: boolean,
};

export type HlsConfig =
  {
    debug: boolean,
    enableWorker: boolean,
    enableSoftwareAES: boolean,
    minAutoBitrate: number,
    loader: any, // TODO(typescript-xhrloader): Type once XHR is done
    xhrSetup?: (xhr: XMLHttpRequest, url: string) => void,

    // Alt Audio
    audioStreamController?: any, // TODO(typescript-audiostreamcontroller): Type once file is done
    audioTrackController?: any, // TODO(typescript-audiotrackcontroller): Type once file is done
    // Subtitle
    subtitleStreamController?: any, // TODO(typescript-subtitlestreamcontroller): Type once file is done
    subtitleTrackController?: any, // TODO(typescript-subtitletrackcontroller): Type once file is done
    timelineController?: typeof TimelineController,
    // EME
    emeController?: typeof EMEController,

    abrController: typeof AbrController,
    bufferController: typeof BufferController,
    capLevelController: typeof CapLevelController,
    fpsController: typeof FPSController,
    progressive: boolean
  } &
  ABRControllerConfig &
  BufferControllerConfig &
  CapLevelControllerConfig &
  EMEControllerConfig &
  FPSControllerConfig &
  FragmentLoaderConfig &
  LevelControllerConfig &
  MP4RemuxerConfig &
  PlaylistLoaderConfig &
  StreamControllerConfig &
  TimelineControllerConfig &
  TSDemuxerConfig;

// If possible, keep hlsDefaultConfig shallow
// It is cloned whenever a new Hls instance is created, by keeping the config
// shallow the properties are cloned, and we don't end up manipulating the default
export const hlsDefaultConfig: HlsConfig = {
  autoStartLoad: true, // used by stream-controller
  startPosition: -1, // used by stream-controller
  defaultAudioCodec: void 0, // used by stream-controller
  debug: false, // used by logger
  capLevelOnFPSDrop: false, // used by fps-controller
  capLevelToPlayerSize: false, // used by cap-level-controller
  initialLiveManifestSize: 1, // used by stream-controller
  maxBufferLength: 30, // used by stream-controller
  maxBufferSize: 60 * 1000 * 1000, // used by stream-controller
  maxBufferHole: 0.5, // used by stream-controller

  lowBufferWatchdogPeriod: 0.5, // used by stream-controller
  highBufferWatchdogPeriod: 3, // used by stream-controller
  nudgeOffset: 0.1, // used by stream-controller
  nudgeMaxRetry: 3, // used by stream-controller
  maxFragLookUpTolerance: 0.25, // used by stream-controller
  liveSyncDurationCount: 3, // used by stream-controller
  liveMaxLatencyDurationCount: Infinity, // used by stream-controller
  liveSyncDuration: void 0, // used by stream-controller
  liveMaxLatencyDuration: void 0, // used by stream-controller
  liveDurationInfinity: false, // used by buffer-controller
  liveBackBufferLength: Infinity, // used by buffer-controller
  maxMaxBufferLength: 600, // used by stream-controller
  enableWorker: true, // used by demuxer
  enableSoftwareAES: true, // used by decrypter
  manifestLoadingTimeOut: 10000, // used by playlist-loader
  manifestLoadingMaxRetry: 1, // used by playlist-loader
  manifestLoadingRetryDelay: 1000, // used by playlist-loader
  manifestLoadingMaxRetryTimeout: 64000, // used by playlist-loader
  startLevel: void 0, // used by level-controller
  levelLoadingTimeOut: 10000, // used by playlist-loader
  levelLoadingMaxRetry: 4, // used by playlist-loader
  levelLoadingRetryDelay: 1000, // used by playlist-loader
  levelLoadingMaxRetryTimeout: 64000, // used by playlist-loader
  fragLoadingTimeOut: 20000, // used by fragment-loader
  fragLoadingMaxRetry: 6, // used by fragment-loader
  fragLoadingRetryDelay: 1000, // used by fragment-loader
  fragLoadingMaxRetryTimeout: 64000, // used by fragment-loader
  startFragPrefetch: false, // used by stream-controller
  fpsDroppedMonitoringPeriod: 5000, // used by fps-controller
  fpsDroppedMonitoringThreshold: 0.2, // used by fps-controller
  appendErrorMaxRetry: 3, // used by buffer-controller
  loader: XhrLoader,
  // loader: FetchLoader,
  fLoader: void 0, // used by fragment-loader
  pLoader: void 0, // used by playlist-loader
  xhrSetup: void 0, // used by xhr-loader
  licenseXhrSetup: void 0, // used by eme-controller
  // fetchSetup: void 0,
  abrController: AbrController,
  bufferController: BufferController,
  capLevelController: CapLevelController,
  fpsController: FPSController,
  stretchShortVideoTrack: false, // used by mp4-remuxer
  maxAudioFramesDrift: 1, // used by mp4-remuxer
  forceKeyFrameOnDiscontinuity: true, // used by ts-demuxer
  abrEwmaFastLive: 3, // used by abr-controller
  abrEwmaSlowLive: 9, // used by abr-controller
  abrEwmaFastVoD: 3, // used by abr-controller
  abrEwmaSlowVoD: 9, // used by abr-controller
  abrEwmaDefaultEstimate: 5e5, // 500 kbps  // used by abr-controller
  abrBandWidthFactor: 0.95, // used by abr-controller
  abrBandWidthUpFactor: 0.7, // used by abr-controller
  abrMaxWithRealBitrate: false, // used by abr-controller
  maxStarvationDelay: 4, // used by abr-controller
  maxLoadingDelay: 4, // used by abr-controller
  minAutoBitrate: 0, // used by hls
  emeEnabled: false, // used by eme-controller
  widevineLicenseUrl: void 0, // used by eme-controller
  drmSystemOptions: {}, // used by eme-controller
  requestMediaKeySystemAccessFunc: requestMediaKeySystemAccess, // used by eme-controller
  testBandwidth: true,
  progressive: false,

  // Dynamic Modules
  ...timelineConfig(),
  subtitleStreamController: (__USE_SUBTITLES__) ? SubtitleStreamController : void 0,
  subtitleTrackController: (__USE_SUBTITLES__) ? SubtitleTrackController : void 0,
  timelineController: (__USE_SUBTITLES__) ? TimelineController : void 0,
  audioStreamController: (__USE_ALT_AUDIO__) ? AudioStreamController : void 0,
  audioTrackController: (__USE_ALT_AUDIO__) ? AudioTrackController : void 0,
  emeController: (__USE_EME_DRM__) ? EMEController : void 0
};

function timelineConfig (): TimelineControllerConfig {
  return {
    cueHandler: Cues, // used by timeline-controller
    enableCEA708Captions: __USE_SUBTITLES__, // used by timeline-controller
    enableWebVTT: __USE_SUBTITLES__, // used by timeline-controller
    enableIMSC1: __USE_SUBTITLES__, // used by timeline-controller
    captionsTextTrack1Label: 'English', // used by timeline-controller
    captionsTextTrack1LanguageCode: 'en', // used by timeline-controller
    captionsTextTrack2Label: 'Spanish', // used by timeline-controller
    captionsTextTrack2LanguageCode: 'es', // used by timeline-controller
    captionsTextTrack3Label: 'Unknown CC', // used by timeline-controller
    captionsTextTrack3LanguageCode: '', // used by timeline-controller
    captionsTextTrack4Label: 'Unknown CC', // used by timeline-controller
    captionsTextTrack4LanguageCode: '', // used by timeline-controller
    renderTextTracksNatively: true
  };
}

export function mergeConfig (defaultConfig, passedConfig) {
  if ((passedConfig.liveSyncDurationCount || passedConfig.liveMaxLatencyDurationCount) && (passedConfig.liveSyncDuration || passedConfig.liveMaxLatencyDuration)) {
    throw new Error('Illegal hls.js passedConfig: don\'t mix up liveSyncDurationCount/liveMaxLatencyDurationCount and liveSyncDuration/liveMaxLatencyDuration');
  }

  for (const prop in defaultConfig) {
    if (prop in passedConfig) continue;
    passedConfig[prop] = defaultConfig[prop];
  }

  if (passedConfig.liveMaxLatencyDurationCount !== void 0 && passedConfig.liveMaxLatencyDurationCount <= passedConfig.liveSyncDurationCount) {
    throw new Error('Illegal hls.js config: "liveMaxLatencyDurationCount" must be greater than "liveSyncDurationCount"');
  }

  if (passedConfig.liveMaxLatencyDuration !== void 0 && (passedConfig.liveMaxLatencyDuration <= passedConfig.liveSyncDuration || passedConfig.liveSyncDuration === void 0)) {
    throw new Error('Illegal hls.js config: "liveMaxLatencyDuration" must be greater than "liveSyncDuration"');
  }
}

const canStreamProgressively = fetchSupported();
export function setStreamingMode (config, allowProgressive) {
  const currentLoader = config.loader;
  if (currentLoader !== FetchLoader && currentLoader !== XhrLoader) {
    // If a developer has configured their own loader, respect that choice
    logger.log('[config]: Custom loader detected, cannot enable progressive streaming');
    config.progressive = false;
    return;
  }

  if (allowProgressive && canStreamProgressively) {
    config.loader = FetchLoader;
    config.progressive = true;
    config.enableSoftwareAES = true;
    logger.log('[config]: Progressive streaming enabled, using FetchLoader');
  } else {
    config.loader = XhrLoader;
    config.progressive = false;
    logger.log('[config]: Progressive streaming disabled, using XhrLoader');
  }
}
