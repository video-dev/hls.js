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
      autoStartLoad: true,                    // used by stream-controller
      startPosition: -1,                      // used by stream-controller
      defaultAudioCodec: undefined,           // used by stream-controller
      debug: false,                           // used by logger
      capLevelOnFPSDrop: false,               // used by fps-controller
      capLevelToPlayerSize: false,            // used by cap-level-controller
      initialLiveManifestSize: 1,             // used by stream-controller
      maxBufferLength: 30,                    // used by stream-controller
      maxBufferSize: 60 * 1000 * 1000,        // used by stream-controller
      maxBufferHole: 0.5,                     // used by stream-controller
      maxSeekHole: 2,                         // used by stream-controller
      lowBufferWatchdogPeriod: 0.5,           // used by stream-controller
      highBufferWatchdogPeriod: 3,            // used by stream-controller
      nudgeOffset: 0.1,                       // used by stream-controller
      nudgeMaxRetry : 3,                      // used by stream-controller
      maxFragLookUpTolerance: 0.2,            // used by stream-controller
      liveSyncDurationCount:3,                // used by stream-controller
      liveMaxLatencyDurationCount: Infinity,  // used by stream-controller
      liveSyncDuration: undefined,            // used by stream-controller
      liveMaxLatencyDuration: undefined,      // used by stream-controller
      maxMaxBufferLength: 600,                // used by stream-controller
      enableWorker: true,                     // used by demuxer
      enableSoftwareAES: true,                // used by decrypter
      manifestLoadingTimeOut: 10000,          // used by playlist-loader
      manifestLoadingMaxRetry: 1,             // used by playlist-loader
      manifestLoadingRetryDelay: 1000,        // used by playlist-loader
      manifestLoadingMaxRetryTimeout: 64000,  // used by playlist-loader
      startLevel: undefined,                  // used by level-controller
      levelLoadingTimeOut: 10000,             // used by playlist-loader
      levelLoadingMaxRetry: 4,                // used by playlist-loader
      levelLoadingRetryDelay: 1000,           // used by playlist-loader
      levelLoadingMaxRetryTimeout: 64000,     // used by playlist-loader
      fragLoadingTimeOut: 20000,              // used by fragment-loader
      fragLoadingMaxRetry: 6,                 // used by fragment-loader
      fragLoadingRetryDelay: 1000,            // used by fragment-loader
      fragLoadingMaxRetryTimeout: 64000,      // used by fragment-loader
      fragLoadingLoopThreshold: 3,            // used by stream-controller
      startFragPrefetch: false,               // used by stream-controller
      fpsDroppedMonitoringPeriod: 5000,       // used by fps-controller
      fpsDroppedMonitoringThreshold: 0.2,     // used by fps-controller
      appendErrorMaxRetry: 3,                 // used by buffer-controller
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
      enableCEA708Captions: true,               // used by timeline-controller
      enableWebVTT: true,                       // used by timeline-controller
      captionsTextTrack1Label: 'English',       // used by timeline-controller
      captionsTextTrack1LanguageCode: 'en',      // used by timeline-controller
      captionsTextTrack2Label: 'Spanish',       // used by timeline-controller
      captionsTextTrack2LanguageCode: 'es',     // used by timeline-controller
//#endif
      stretchShortVideoTrack: false,            // used by mp4-remuxer
      forceKeyFrameOnDiscontinuity: true,       // used by ts-demuxer
      abrEwmaFastLive: 3,                       // used by abr-controller
      abrEwmaSlowLive: 9,                       // used by abr-controller
      abrEwmaFastVoD: 3,                        // used by abr-controller
      abrEwmaSlowVoD: 9,                        // used by abr-controller
      abrEwmaDefaultEstimate: 5e5, // 500 kbps  // used by abr-controller
      abrBandWidthFactor : 0.95,                // used by abr-controller
      abrBandWidthUpFactor : 0.7,               // used by abr-controller
      abrMaxWithRealBitrate : false,            // used by abr-controller
      maxStarvationDelay : 4,                   // used by abr-controller
      maxLoadingDelay : 4,                      // used by abr-controller
      minAutoBitrate: 0                         // used by hls
    };
