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
import StreamController from  './controller/stream-controller';
import LevelController from  './controller/level-controller';
import FPSController from './controller/fps-controller';
import AudioTrackController from './controller/audio-track-controller';
import {logger, enableLogs} from './utils/logger';
//import FetchLoader from './utils/fetch-loader';
import XhrLoader from './utils/xhr-loader';
import EventEmitter from 'events';
import KeyLoader from './loader/key-loader';

//#if altaudio
import AudioStreamController from  './controller/audio-stream-controller';
//#endif

//#if subtitle
import TimelineController from './controller/timeline-controller';
import SubtitleStreamController from  './controller/subtitle-stream-controller';
import SubtitleTrackController from './controller/subtitle-track-controller';
import Cues from './utils/cues';
//#endif


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
          maxMaxBufferLength: 600,
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
//#endif
          enableCEA708Captions: true,
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
          abrMaxWithRealBitrate : false,
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

    // network controllers
    const levelController = this.levelController = new LevelController(this);
    const streamController = this.streamController = new StreamController(this);
    let networkControllers = [levelController, streamController];

    // optional audio stream controller
    let controller = config.audioStreamController;
    if (controller) {
      networkControllers.push(new controller(this));
    }

    // optional subtitle stream controller
    controller = config.subtitleStreamController;
    if (controller) {
      networkControllers.push(new controller(this));
    }


    this.networkControllers = networkControllers;

    // core controllers and network loaders
    // hls.abrController is referenced in levelController, this would need to be fixed
    const abrController = this.abrController = new config.abrController(this);
    const bufferController  = new config.bufferController(this);
    const capLevelController = new config.capLevelController(this);
    const fpsController = new config.fpsController(this);
    const playListLoader = new PlaylistLoader(this);
    const fragmentLoader = new FragmentLoader(this);
    const keyLoader = new KeyLoader(this);

    let coreComponents = [ playListLoader, fragmentLoader, keyLoader, abrController, bufferController, capLevelController, fpsController ];


    // optional audio track and subtitle controller
    [config.audioTrackController, config.timelineController, config.subtitleTrackController].forEach(controller => {
      if (controller) {
        coreComponents.push(new controller(this));
      }
    });
    this.coreComponents = coreComponents;
  }x@

  destroy() {
    logger.log('destroy');
    this.trigger(Event.DESTROYING);
    this.detachMedia();
    this.coreComponents.concat(this.networkControllers).forEach(component => {component.destroy();});
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
    logger.log(`startLoad(${startPosition})`);
    this.networkControllers.forEach(controller => {controller.startLoad(startPosition);});
  }

  stopLoad() {
    logger.log('stopLoad');
    this.networkControllers.forEach(controller => {controller.stopLoad();});
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
    return Math.max(this.levelController.firstLevel, this.abrController.minAutoLevel);
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
    const audioTrackController = this.audioTrackController;
    return audioTrackController ? audioTrackController.audioTracks : [];
  }

  /** get index of the selected audio track (index in audio track lists) **/
  get audioTrack() {
    const audioTrackController = this.audioTrackController;
    return audioTrackController ? audioTrackController.audioTrack : -1;
  }

  /** select an audio track, based on its index in audio track lists**/
  set audioTrack(audioTrackId) {
    const audioTrackController = this.audioTrackController;
    if (audioTrackController) {
      audioTrackController.audioTrack = audioTrackId;
    }
  }

  get liveSyncPosition() {
    return this.streamController.liveSyncPosition;
  }

  /** get alternate subtitle tracks list from playlist **/
  get subtitleTracks() {
    const subtitleTrackController = this.subtitleTrackController;
    return subtitleTrackController ? subtitleTrackController.subtitleTracks : [];
  }

  /** get index of the selected subtitle track (index in subtitle track lists) **/
  get subtitleTrack() {
    const subtitleTrackController = this.subtitleTrackController;
    return subtitleTrackController ? subtitleTrackController.subtitleTrack : -1;
  }

  /** select an subtitle track, based on its index in subtitle track lists**/
  set subtitleTrack(subtitleTrackId) {
    const subtitleTrackController = this.subtitleTrackController;
    if (subtitleTrackController) {
      subtitleTrackController.subtitleTrack = subtitleTrackId;
    }
  }
}

export default Hls;
