/**
 * HLS config
 */
'use strict';

import AbrController from    './controller/abr-controller';
import BufferController from  './controller/buffer-controller';
import CapLevelController from  './controller/cap-level-controller';
import FPSController from './controller/fps-controller';
import XhrLoader from './utils/xhr-loader';
//import FetchLoader from './utils/fetch-loader';
//#if altaudio
import AudioTrackController from './controller/audio-track-controller';
import AudioStreamController from  './controller/audio-stream-controller';
//#endif

//#if subtitle
import Cues from './utils/cues';
import TimelineController from './controller/timeline-controller';
import SubtitleTrackController from './controller/subtitle-track-controller';
import SubtitleStreamController from  './controller/subtitle-stream-controller';
//#endif

export var hlsDefaultConfig = {
      autoStartLoad: true,
      startPosition: -1,
      defaultAudioCodec: undefined,
      debug: false,
      capLevelOnFPSDrop: false,
      capLevelToPlayerSize: false,
      initialLiveManifestSize: 1,
      maxBufferLength: 30,
      maxBufferSize: 60 * 1000 * 1000,
      maxBufferHole: 0.5,
      maxSeekHole: 2,
      lowBufferWatchdogPeriod: 0.5,
      highBufferWatchdogPeriod: 3,
      nudgeOffset: 0.1,
      nudgeMaxRetry : 3,
      maxFragLookUpTolerance: 0.2,
      liveSyncDurationCount:3,
      liveMaxLatencyDurationCount: Infinity,
      liveSyncDuration: undefined,
      liveMaxLatencyDuration: undefined,
      maxMaxBufferLength: 600,
      enableWorker: true,
      enableSoftwareAES: true,
      manifestLoadingTimeOut: 10000,
      manifestLoadingMaxRetry: 1,
      manifestLoadingRetryDelay: 1000,
      manifestLoadingMaxRetryTimeout: 64000,
      startLevel: undefined,
      levelLoadingTimeOut: 10000,
      levelLoadingMaxRetry: 4,
      levelLoadingRetryDelay: 1000,
      levelLoadingMaxRetryTimeout: 64000,
      fragLoadingTimeOut: 20000,
      fragLoadingMaxRetry: 6,
      fragLoadingRetryDelay: 1000,
      fragLoadingMaxRetryTimeout: 64000,
      fragLoadingLoopThreshold: 3,
      startFragPrefetch: false,
      fpsDroppedMonitoringPeriod: 5000,
      fpsDroppedMonitoringThreshold: 0.2,
      appendErrorMaxRetry: 3,
      loader: XhrLoader,
      //loader: FetchLoader,
      fLoader: undefined,
      pLoader: undefined,
      xhrSetup: undefined,
      fetchSetup: undefined,
      abrController: AbrController,
      bufferController: BufferController,
      capLevelController: CapLevelController,
      fpsController: FPSController,
//#if altaudio
      audioStreamController: AudioStreamController,
      audioTrackController : AudioTrackController,
//#endif
//#if subtitle
      subtitleStreamController: SubtitleStreamController,
      subtitleTrackController: SubtitleTrackController,
      timelineController: TimelineController,
      cueHandler: Cues,
      enableCEA708Captions: true,
      enableWebVTT: true,
//#endif
      stretchShortVideoTrack: false,
      forceKeyFrameOnDiscontinuity: true,
      abrEwmaFastLive: 3,
      abrEwmaSlowLive: 9,
      abrEwmaFastVoD: 3,
      abrEwmaSlowVoD: 9,
      abrEwmaDefaultEstimate: 5e5, // 500 kbps
      abrBandWidthFactor : 0.95,
      abrBandWidthUpFactor : 0.7,
      abrMaxWithRealBitrate : false,
      maxStarvationDelay : 4,
      maxLoadingDelay : 4,
      minAutoBitrate: 0
    };
