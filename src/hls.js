/**
 * HLS interface
 */
'use strict';

import Event from './events';
import {ErrorTypes, ErrorDetails} from './errors';
import PlaylistLoader from './loader/playlist-loader';
import FragmentLoader from './loader/fragment-loader';
import AbrController from    './controller/abr-controller';
import BufferController from  './controller/buffer-controller';
import CapLevelController from  './controller/cap-level-controller';
import AudioStreamController from  './controller/audio-stream-controller';
import SubtitleStreamController from  './controller/subtitle-stream-controller';
import StreamController from  './controller/stream-controller';
import LevelController from  './controller/level-controller';
import TimelineController from './controller/timeline-controller';
import FPSController from './controller/fps-controller';
import AudioTrackController from './controller/audio-track-controller';
import SubtitleTrackController from './controller/subtitle-track-controller';
import {logger, enableLogs} from './utils/logger';
//import FetchLoader from './utils/fetch-loader';
import XhrLoader from './utils/xhr-loader';
import EventEmitter from 'events';
import KeyLoader from './loader/key-loader';
import Cues from './utils/cues';

class Hls {

  static get version() {
    // replaced with browserify-versionify transform
    return '__VERSION__';
  }

  static isSupported() {
    window.MediaSource = window.MediaSource || window.WebKitMediaSource;
    return (window.MediaSource &&
            typeof window.MediaSource.isTypeSupported === 'function' &&
            window.MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E,mp4a.40.2"'));
  }

  static get Events() {
    return Event;
  }

  static get ErrorTypes() {
    return ErrorTypes;
  }

  static get ErrorDetails() {
    return ErrorDetails;
  }

  static get DefaultConfig() {
    if(!Hls.defaultConfig) {
       Hls.defaultConfig = {
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
          seekHoleNudgeDuration: 0.01,
          stalledInBufferedNudgeThreshold: 10,
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
          streamController: StreamController,
          audioStreamController: AudioStreamController,
          subtitleStreamController: SubtitleStreamController,
          timelineController: TimelineController,
          cueHandler: Cues,
          enableCEA708Captions: false,
          enableWebVTT: true,
          enableMP2TPassThrough: false,
          stretchShortVideoTrack: false,
          forceKeyFrameOnDiscontinuity: true,
          abrEwmaFastLive: 3,
          abrEwmaSlowLive: 9,
          abrEwmaFastVoD: 3,
          abrEwmaSlowVoD: 9,
          abrEwmaDefaultEstimate: 5e5, // 500 kbps
          abrBandWidthFactor : 0.95,
          abrBandWidthUpFactor : 0.7,
          maxStarvationDelay : 4,
          maxLoadingDelay : 4,
          minAutoBitrate: 0
        };
    }
    return Hls.defaultConfig;
  }

  static set DefaultConfig(defaultConfig) {
    Hls.defaultConfig = defaultConfig;
  }

  constructor(config = {}) {
    var defaultConfig = Hls.DefaultConfig;

    if ((config.liveSyncDurationCount || config.liveMaxLatencyDurationCount) && (config.liveSyncDuration || config.liveMaxLatencyDuration)) {
      throw new Error('Illegal hls.js config: don\'t mix up liveSyncDurationCount/liveMaxLatencyDurationCount and liveSyncDuration/liveMaxLatencyDuration');
    }

    for (var prop in defaultConfig) {
        if (prop in config) { continue; }
        config[prop] = defaultConfig[prop];
    }

    if (config.liveMaxLatencyDurationCount !== undefined && config.liveMaxLatencyDurationCount <= config.liveSyncDurationCount) {
      throw new Error('Illegal hls.js config: "liveMaxLatencyDurationCount" must be gt "liveSyncDurationCount"');
    }

    if (config.liveMaxLatencyDuration !== undefined && (config.liveMaxLatencyDuration <= config.liveSyncDuration || config.liveSyncDuration === undefined)) {
      throw new Error('Illegal hls.js config: "liveMaxLatencyDuration" must be gt "liveSyncDuration"');
    }

    enableLogs(config.debug);
    this.config = config;
    // observer setup
    var observer = this.observer = new EventEmitter();
    observer.trigger = function trigger (event, ...data) {
      observer.emit(event, event, ...data);
    };

    observer.off = function off (event, ...data) {
      observer.removeListener(event, ...data);
    };
    this.on = observer.on.bind(observer);
    this.off = observer.off.bind(observer);
    this.trigger = observer.trigger.bind(observer);
    this.playlistLoader = new PlaylistLoader(this);
    this.fragmentLoader = new FragmentLoader(this);
    this.levelController = new LevelController(this);
    this.abrController = new config.abrController(this);
    this.bufferController = new config.bufferController(this);
    this.capLevelController = new config.capLevelController(this);
    this.fpsController = new config.fpsController(this);
    this.streamController = new config.streamController(this);
    this.audioStreamController = new config.audioStreamController(this);
    this.subtitleStreamController = new config.subtitleStreamController(this);
    this.timelineController = new config.timelineController(this);
    this.audioTrackController = new AudioTrackController(this);
    this.subtitleTrackController = new SubtitleTrackController(this);
    this.keyLoader = new KeyLoader(this);
  }

  destroy() {
    logger.log('destroy');
    this.trigger(Event.DESTROYING);
    this.detachMedia();
    this.playlistLoader.destroy();
    this.fragmentLoader.destroy();
    this.levelController.destroy();
    this.abrController.destroy();
    this.bufferController.destroy();
    this.capLevelController.destroy();
    this.fpsController.destroy();
    this.streamController.destroy();
    this.audioStreamController.destroy();
    this.subtitleStreamController.destroy();
    this.timelineController.destroy();
    this.audioTrackController.destroy();
    this.subtitleTrackController.destroy();
    this.keyLoader.destroy();
    this.url = null;
    this.observer.removeAllListeners();
  }

  attachMedia(media) {
    logger.log('attachMedia');
    this.media = media;
    this.trigger(Event.MEDIA_ATTACHING, {media: media});
  }

  detachMedia() {
    logger.log('detachMedia');
    this.trigger(Event.MEDIA_DETACHING);
    this.media = null;
  }

  loadSource(url) {
    logger.log(`loadSource:${url}`);
    this.url = url;
    // when attaching to a source URL, trigger a playlist load
    this.trigger(Event.MANIFEST_LOADING, {url: url});
  }

  startLoad(startPosition=-1) {
    logger.log('startLoad');
    this.levelController.startLoad();
    this.streamController.startLoad(startPosition);
    this.audioStreamController.startLoad(startPosition);
  }

  stopLoad() {
    logger.log('stopLoad');
    this.levelController.stopLoad();
    this.streamController.stopLoad();
    this.audioStreamController.stopLoad();
  }

  swapAudioCodec() {
    logger.log('swapAudioCodec');
    this.streamController.swapAudioCodec();
  }

  recoverMediaError() {
    logger.log('recoverMediaError');
    var media = this.media;
    this.detachMedia();
    this.attachMedia(media);
  }

  /** Return all quality levels **/
  get levels() {
    return this.levelController.levels;
  }

  /** Return current playback quality level **/
  get currentLevel() {
    return this.streamController.currentLevel;
  }

  /* set quality level immediately (-1 for automatic level selection) */
  set currentLevel(newLevel) {
    logger.log(`set currentLevel:${newLevel}`);
    this.loadLevel = newLevel;
    this.streamController.immediateLevelSwitch();
  }

  /** Return next playback quality level (quality level of next fragment) **/
  get nextLevel() {
    return this.streamController.nextLevel;
  }

  /* set quality level for next fragment (-1 for automatic level selection) */
  set nextLevel(newLevel) {
    logger.log(`set nextLevel:${newLevel}`);
    this.levelController.manualLevel = newLevel;
    this.streamController.nextLevelSwitch();
  }

  /** Return the quality level of current/last loaded fragment **/
  get loadLevel() {
    return this.levelController.level;
  }

  /* set quality level for current/next loaded fragment (-1 for automatic level selection) */
  set loadLevel(newLevel) {
    logger.log(`set loadLevel:${newLevel}`);
    this.levelController.manualLevel = newLevel;
  }

  /** Return the quality level of next loaded fragment **/
  get nextLoadLevel() {
    return this.levelController.nextLoadLevel;
  }

  /** set quality level of next loaded fragment **/
  set nextLoadLevel(level) {
    this.levelController.nextLoadLevel = level;
  }

  /** Return first level (index of first level referenced in manifest)
  **/
  get firstLevel() {
    return this.levelController.firstLevel;
  }

  /** set first level (index of first level referenced in manifest)
  **/
  set firstLevel(newLevel) {
    logger.log(`set firstLevel:${newLevel}`);
    this.levelController.firstLevel = newLevel;
  }

  /** Return start level (level of first fragment that will be played back)
      if not overrided by user, first level appearing in manifest will be used as start level
      if -1 : automatic start level selection, playback will start from level matching download bandwidth (determined from download of first segment)
  **/
  get startLevel() {
    return this.levelController.startLevel;
  }

  /** set  start level (level of first fragment that will be played back)
      if not overrided by user, first level appearing in manifest will be used as start level
      if -1 : automatic start level selection, playback will start from level matching download bandwidth (determined from download of first segment)
  **/
  set startLevel(newLevel) {
    logger.log(`set startLevel:${newLevel}`);
    this.levelController.startLevel = newLevel;
  }

  /** Return the capping/max level value that could be used by automatic level selection algorithm **/
  get autoLevelCapping() {
    return this.abrController.autoLevelCapping;
  }

  /** set the capping/max level value that could be used by automatic level selection algorithm **/
  set autoLevelCapping(newLevel) {
    logger.log(`set autoLevelCapping:${newLevel}`);
    this.abrController.autoLevelCapping = newLevel;
  }

  /* check if we are in automatic level selection mode */
  get autoLevelEnabled() {
    return (this.levelController.manualLevel === -1);
  }

  /* return manual level */
  get manualLevel() {
    return this.levelController.manualLevel;
  }

  /** get alternate audio tracks list from playlist **/
  get audioTracks() {
    return this.audioTrackController.audioTracks;
  }

  /** get index of the selected audio track (index in audio track lists) **/
  get audioTrack() {
   return this.audioTrackController.audioTrack;
  }

  /** select an audio track, based on its index in audio track lists**/
  set audioTrack(audioTrackId) {
    this.audioTrackController.audioTrack = audioTrackId;
  }

  get liveSyncPosition() {
    return this.streamController.liveSyncPosition;
  }

  /** get alternate subtitle tracks list from playlist **/
  get subtitleTracks() {
    return this.subtitleTrackController.subtitleTracks;
  }

  /** get index of the selected subtitle track (index in subtitle track lists) **/
  get subtitleTrack() {
   return this.subtitleTrackController.subtitleTrack;
  }

  /** select an subtitle track, based on its index in subtitle track lists**/
  set subtitleTrack(subtitleTrackId) {
    this.subtitleTrackController.subtitleTrack = subtitleTrackId;
  }
}

export default Hls;
