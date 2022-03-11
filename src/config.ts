import AbrController from './controller/abr-controller';
import AudioStreamController from './controller/audio-stream-controller';
import AudioTrackController from './controller/audio-track-controller';
import { SubtitleStreamController } from './controller/subtitle-stream-controller';
import SubtitleTrackController from './controller/subtitle-track-controller';
import BufferController from './controller/buffer-controller';
import { TimelineController } from './controller/timeline-controller';
import CapLevelController from './controller/cap-level-controller';
import FPSController from './controller/fps-controller';
import EMEController from './controller/eme-controller';
import CMCDController from './controller/cmcd-controller';
import XhrLoader from './utils/xhr-loader';
import FetchLoader, { fetchSupported } from './utils/fetch-loader';
import Cues from './utils/cues';
import { requestMediaKeySystemAccess } from './utils/mediakeys-helper';
import { ILogger, logger } from './utils/logger';

import type { CuesInterface } from './utils/cues';
import type { MediaKeyFunc } from './utils/mediakeys-helper';
import type {
  FragmentLoaderContext,
  Loader,
  LoaderContext,
  PlaylistLoaderContext,
} from './types/loader';

export type ABRControllerConfig = {
  abrEwmaFastLive: number;
  abrEwmaSlowLive: number;
  abrEwmaFastVoD: number;
  abrEwmaSlowVoD: number;
  abrEwmaDefaultEstimate: number;
  abrBandWidthFactor: number;
  abrBandWidthUpFactor: number;
  abrMaxWithRealBitrate: boolean;
  maxStarvationDelay: number;
  maxLoadingDelay: number;
};

export type BufferControllerConfig = {
  appendErrorMaxRetry: number;
  backBufferLength: number;
  liveDurationInfinity: boolean;
  liveBackBufferLength: number | null;
};

export type CapLevelControllerConfig = {
  capLevelToPlayerSize: boolean;
};

export type CMCDControllerConfig = {
  sessionId?: string;
  contentId?: string;
  useHeaders?: boolean;
};

export type DRMSystemOptions = {
  audioRobustness?: string;
  videoRobustness?: string;
};

export type EMEControllerConfig = {
  licenseXhrSetup?: (xhr: XMLHttpRequest, url: string) => void;
  licenseResponseCallback?: (xhr: XMLHttpRequest, url: string) => ArrayBuffer;
  emeEnabled: boolean;
  widevineLicenseUrl?: string;
  drmSystemOptions: DRMSystemOptions;
  requestMediaKeySystemAccessFunc: MediaKeyFunc | null;
};

export interface FragmentLoaderConstructor {
  new (confg: HlsConfig): Loader<FragmentLoaderContext>;
}

export type FragmentLoaderConfig = {
  fLoader?: FragmentLoaderConstructor;

  fragLoadingTimeOut: number;
  fragLoadingMaxRetry: number;
  fragLoadingRetryDelay: number;
  fragLoadingMaxRetryTimeout: number;
};

export type FPSControllerConfig = {
  capLevelOnFPSDrop: boolean;
  fpsDroppedMonitoringPeriod: number;
  fpsDroppedMonitoringThreshold: number;
};

export type LevelControllerConfig = {
  startLevel?: number;
};

export type MP4RemuxerConfig = {
  stretchShortVideoTrack: boolean;
  maxAudioFramesDrift: number;
};

export interface PlaylistLoaderConstructor {
  new (confg: HlsConfig): Loader<PlaylistLoaderContext>;
}

export type PlaylistLoaderConfig = {
  pLoader?: PlaylistLoaderConstructor;

  manifestLoadingTimeOut: number;
  manifestLoadingMaxRetry: number;
  manifestLoadingRetryDelay: number;
  manifestLoadingMaxRetryTimeout: number;

  levelLoadingTimeOut: number;
  levelLoadingMaxRetry: number;
  levelLoadingRetryDelay: number;
  levelLoadingMaxRetryTimeout: number;
};

export type StreamControllerConfig = {
  autoStartLoad: boolean;
  startPosition: number;
  defaultAudioCodec?: string;
  initialLiveManifestSize: number;
  maxBufferLength: number;
  maxBufferSize: number;
  maxBufferHole: number;
  highBufferWatchdogPeriod: number;
  nudgeOffset: number;
  nudgeMaxRetry: number;
  maxFragLookUpTolerance: number;
  maxMaxBufferLength: number;
  startFragPrefetch: boolean;
  testBandwidth: boolean;
};

export type LatencyControllerConfig = {
  liveSyncDurationCount: number;
  liveMaxLatencyDurationCount: number;
  liveSyncDuration?: number;
  liveMaxLatencyDuration?: number;
  maxLiveSyncPlaybackRate: number;
};

export type TimelineControllerConfig = {
  cueHandler: CuesInterface;
  enableCEA708Captions: boolean;
  enableWebVTT: boolean;
  enableIMSC1: boolean;
  captionsTextTrack1Label: string;
  captionsTextTrack1LanguageCode: string;
  captionsTextTrack2Label: string;
  captionsTextTrack2LanguageCode: string;
  captionsTextTrack3Label: string;
  captionsTextTrack3LanguageCode: string;
  captionsTextTrack4Label: string;
  captionsTextTrack4LanguageCode: string;
  renderTextTracksNatively: boolean;
};

export type TSDemuxerConfig = {
  forceKeyFrameOnDiscontinuity: boolean;
};

export type HlsConfig = {
  debug: boolean | ILogger;
  enableWorker: boolean;
  enableSoftwareAES: boolean;
  minAutoBitrate: number;
  ignoreDevicePixelRatio: boolean;
  loader: { new (confg: HlsConfig): Loader<LoaderContext> };
  fetchSetup?: (context: LoaderContext, initParams: any) => Request;
  xhrSetup?: (xhr: XMLHttpRequest, url: string) => void;

  // Alt Audio
  audioStreamController?: typeof AudioStreamController;
  audioTrackController?: typeof AudioTrackController;
  // Subtitle
  subtitleStreamController?: typeof SubtitleStreamController;
  subtitleTrackController?: typeof SubtitleTrackController;
  timelineController?: typeof TimelineController;
  // EME
  emeController?: typeof EMEController;
  // CMCD
  cmcd?: CMCDControllerConfig;
  cmcdController?: typeof CMCDController;

  abrController: typeof AbrController;
  bufferController: typeof BufferController;
  capLevelController: typeof CapLevelController;
  fpsController: typeof FPSController;
  progressive: boolean;
  lowLatencyMode: boolean;
} & ABRControllerConfig &
  BufferControllerConfig &
  CapLevelControllerConfig &
  EMEControllerConfig &
  FPSControllerConfig &
  FragmentLoaderConfig &
  LevelControllerConfig &
  MP4RemuxerConfig &
  PlaylistLoaderConfig &
  StreamControllerConfig &
  LatencyControllerConfig &
  TimelineControllerConfig &
  TSDemuxerConfig;

// If possible, keep hlsDefaultConfig shallow
// It is cloned whenever a new Hls instance is created, by keeping the config
// shallow the properties are cloned, and we don't end up manipulating the default
export const hlsDefaultConfig: HlsConfig = {
  autoStartLoad: true, // used by stream-controller
  startPosition: -1, // used by stream-controller
  defaultAudioCodec: undefined, // used by stream-controller
  debug: false, // used by logger
  capLevelOnFPSDrop: false, // used by fps-controller
  capLevelToPlayerSize: false, // used by cap-level-controller
  ignoreDevicePixelRatio: false, // used by cap-level-controller
  initialLiveManifestSize: 1, // used by stream-controller
  maxBufferLength: 30, // used by stream-controller
  backBufferLength: Infinity, // used by buffer-controller
  maxBufferSize: 60 * 1000 * 1000, // used by stream-controller
  maxBufferHole: 0.1, // used by stream-controller
  highBufferWatchdogPeriod: 2, // used by stream-controller
  nudgeOffset: 0.1, // used by stream-controller
  nudgeMaxRetry: 3, // used by stream-controller
  maxFragLookUpTolerance: 0.25, // used by stream-controller
  liveSyncDurationCount: 3, // used by latency-controller
  liveMaxLatencyDurationCount: Infinity, // used by latency-controller
  liveSyncDuration: undefined, // used by latency-controller
  liveMaxLatencyDuration: undefined, // used by latency-controller
  maxLiveSyncPlaybackRate: 1, // used by latency-controller
  liveDurationInfinity: false, // used by buffer-controller
  liveBackBufferLength: null, // used by buffer-controller
  maxMaxBufferLength: 600, // used by stream-controller
  enableWorker: true, // used by demuxer
  enableSoftwareAES: true, // used by decrypter
  manifestLoadingTimeOut: 10000, // used by playlist-loader
  manifestLoadingMaxRetry: 1, // used by playlist-loader
  manifestLoadingRetryDelay: 1000, // used by playlist-loader
  manifestLoadingMaxRetryTimeout: 64000, // used by playlist-loader
  startLevel: undefined, // used by level-controller
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
  fLoader: undefined, // used by fragment-loader
  pLoader: undefined, // used by playlist-loader
  xhrSetup: undefined, // used by xhr-loader
  licenseXhrSetup: undefined, // used by eme-controller
  licenseResponseCallback: undefined, // used by eme-controller
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
  widevineLicenseUrl: undefined, // used by eme-controller
  drmSystemOptions: {}, // used by eme-controller
  requestMediaKeySystemAccessFunc: requestMediaKeySystemAccess, // used by eme-controller
  testBandwidth: true,
  progressive: false,
  lowLatencyMode: true,
  cmcd: undefined,

  // Dynamic Modules
  ...timelineConfig(),
  subtitleStreamController: __USE_SUBTITLES__
    ? SubtitleStreamController
    : undefined,
  subtitleTrackController: __USE_SUBTITLES__
    ? SubtitleTrackController
    : undefined,
  timelineController: __USE_SUBTITLES__ ? TimelineController : undefined,
  audioStreamController: __USE_ALT_AUDIO__ ? AudioStreamController : undefined,
  audioTrackController: __USE_ALT_AUDIO__ ? AudioTrackController : undefined,
  emeController: __USE_EME_DRM__ ? EMEController : undefined,
  cmcdController: __USE_CMCD__ ? CMCDController : undefined,
};

function timelineConfig(): TimelineControllerConfig {
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
    renderTextTracksNatively: true,
  };
}

export function mergeConfig(
  defaultConfig: HlsConfig,
  userConfig: Partial<HlsConfig>
): HlsConfig {
  if (
    (userConfig.liveSyncDurationCount ||
      userConfig.liveMaxLatencyDurationCount) &&
    (userConfig.liveSyncDuration || userConfig.liveMaxLatencyDuration)
  ) {
    throw new Error(
      "Illegal hls.js config: don't mix up liveSyncDurationCount/liveMaxLatencyDurationCount and liveSyncDuration/liveMaxLatencyDuration"
    );
  }

  if (
    userConfig.liveMaxLatencyDurationCount !== undefined &&
    (userConfig.liveSyncDurationCount === undefined ||
      userConfig.liveMaxLatencyDurationCount <=
        userConfig.liveSyncDurationCount)
  ) {
    throw new Error(
      'Illegal hls.js config: "liveMaxLatencyDurationCount" must be greater than "liveSyncDurationCount"'
    );
  }

  if (
    userConfig.liveMaxLatencyDuration !== undefined &&
    (userConfig.liveSyncDuration === undefined ||
      userConfig.liveMaxLatencyDuration <= userConfig.liveSyncDuration)
  ) {
    throw new Error(
      'Illegal hls.js config: "liveMaxLatencyDuration" must be greater than "liveSyncDuration"'
    );
  }

  return Object.assign({}, defaultConfig, userConfig);
}

export function enableStreamingMode(config) {
  const currentLoader = config.loader;
  if (currentLoader !== FetchLoader && currentLoader !== XhrLoader) {
    // If a developer has configured their own loader, respect that choice
    logger.log(
      '[config]: Custom loader detected, cannot enable progressive streaming'
    );
    config.progressive = false;
  } else {
    const canStreamProgressively = fetchSupported();
    if (canStreamProgressively) {
      config.loader = FetchLoader;
      config.progressive = true;
      config.enableSoftwareAES = true;
      logger.log('[config]: Progressive streaming enabled, using FetchLoader');
    }
  }
}
