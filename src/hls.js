/**
 * HLS interface
 */
'use strict';

import Event from './events';
import {ErrorTypes, ErrorDetails} from './errors';
import StatsHandler from './stats';
import observer from './observer';
import PlaylistLoader from './loader/playlist-loader';
import FragmentLoader from './loader/fragment-loader';
import BufferController from './controller/buffer-controller';
import LevelController from './controller/level-controller';
//import FPSController from './controller/fps-controller';
import {logger, enableLogs} from './utils/logger';
import XhrLoader from './utils/xhr-loader';

class Hls {

  static isSupported() {
    return (window.MediaSource && window.MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E,mp4a.40.2"'));
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

  constructor(config = {}) {
   var configDefault = {
      autoStartLoad: true,
      debug: false,
      maxBufferLength: 30,
      maxBufferSize: 60 * 1000 * 1000,
      liveSyncDurationCount:3,
      maxMaxBufferLength: 600,
      enableWorker: true,
      fragLoadingTimeOut: 20000,
      fragLoadingMaxRetry: 1,
      fragLoadingRetryDelay: 1000,
      fragLoadingLoopThreshold: 3,
      manifestLoadingTimeOut: 10000,
      manifestLoadingMaxRetry: 1,
      manifestLoadingRetryDelay: 1000,
      fpsDroppedMonitoringPeriod: 5000,
      fpsDroppedMonitoringThreshold: 0.2,
      appendErrorMaxRetry: 200,
      loader: XhrLoader
    };
    for (var prop in configDefault) {
        if (prop in config) { continue; }
        config[prop] = configDefault[prop];
    }
    enableLogs(config.debug);
    this.config = config;
    this.playlistLoader = new PlaylistLoader(this);
    this.fragmentLoader = new FragmentLoader(this);
    this.levelController = new LevelController(this);
    this.bufferController = new BufferController(this);
    //this.fpsController = new FPSController(this);
    this.statsHandler = new StatsHandler(this);
    // observer setup
    this.on = observer.on.bind(observer);
    this.off = observer.off.bind(observer);
  }

  destroy() {
    logger.log('destroy');
    this.playlistLoader.destroy();
    this.fragmentLoader.destroy();
    this.levelController.destroy();
    this.bufferController.destroy();
    //this.fpsController.destroy();
    this.statsHandler.destroy();
    this.url = null;
    this.detachVideo();
    observer.removeAllListeners();
  }

  attachVideo(video) {
    logger.log('attachVideo');
    this.video = video;
    this.statsHandler.attachVideo(video);
    // setup the media source
    var ms = this.mediaSource = new MediaSource();
    //Media Source listeners
    this.onmso = this.onMediaSourceOpen.bind(this);
    this.onmse = this.onMediaSourceEnded.bind(this);
    this.onmsc = this.onMediaSourceClose.bind(this);
    ms.addEventListener('sourceopen', this.onmso);
    ms.addEventListener('sourceended', this.onmse);
    ms.addEventListener('sourceclose', this.onmsc);
    // link video and media Source
    video.src = URL.createObjectURL(ms);
    video.addEventListener('error', this.onverror);
  }

  detachVideo() {
    logger.log('detachVideo');
    var video = this.video;
    this.statsHandler.detachVideo(video);
    var ms = this.mediaSource;
    if (ms) {
      if (ms.readyState !== 'ended') {
        ms.endOfStream();
      }
      ms.removeEventListener('sourceopen', this.onmso);
      ms.removeEventListener('sourceended', this.onmse);
      ms.removeEventListener('sourceclose', this.onmsc);
      // unlink MediaSource from video tag
      video.src = '';
      this.mediaSource = null;
      logger.log('trigger MSE_DETACHED');
      observer.trigger(Event.MSE_DETACHED);
    }
    this.onmso = this.onmse = this.onmsc = null;
    if (video) {
      this.video = null;
    }
  }

  loadSource(url) {
    logger.log(`loadSource:${url}`);
    this.url = url;
    // when attaching to a source URL, trigger a playlist load
    observer.trigger(Event.MANIFEST_LOADING, {url: url});
  }

  startLoad() {
    logger.log('startLoad');
    this.bufferController.startLoad();
  }

  recoverMediaError() {
    logger.log('recoverMediaError');
    var video = this.video;
    this.detachVideo();
    this.attachVideo(video);
  }

  /** Return all quality levels **/
  get levels() {
    return this.levelController.levels;
  }

  /** Return current playback quality level **/
  get currentLevel() {
    return this.bufferController.currentLevel;
  }

  /* set quality level immediately (-1 for automatic level selection) */
  set currentLevel(newLevel) {
    logger.log(`set currentLevel:${newLevel}`);
    this.loadLevel = newLevel;
    this.bufferController.immediateLevelSwitch();
  }

  /** Return next playback quality level (quality level of next fragment) **/
  get nextLevel() {
    return this.bufferController.nextLevel;
  }

  /* set quality level for next fragment (-1 for automatic level selection) */
  set nextLevel(newLevel) {
    logger.log(`set nextLevel:${newLevel}`);
    this.levelController.manualLevel = newLevel;
    this.bufferController.nextLevelSwitch();
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
    return this.levelController.nextLoadLevel();
  }

  /** set quality level of next loaded fragment **/
  set nextLoadLevel(level) {
    this.levelController.level = level;
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
    return this.levelController.autoLevelCapping;
  }

  /** set the capping/max level value that could be used by automatic level selection algorithm **/
  set autoLevelCapping(newLevel) {
    logger.log(`set autoLevelCapping:${newLevel}`);
    this.levelController.autoLevelCapping = newLevel;
  }

  /* check if we are in automatic level selection mode */
  get autoLevelEnabled() {
    return (this.levelController.manualLevel === -1);
  }

  /* return manual level */
  get manualLevel() {
    return this.levelController.manualLevel;
  }

  /* return playback session stats */
  get stats() {
    return this.statsHandler.stats;
  }

  onMediaSourceOpen() {
    logger.log('media source opened');
    observer.trigger(Event.MSE_ATTACHED, {video: this.video, mediaSource: this.mediaSource});
    // once received, don't listen anymore to sourceopen event
    this.mediaSource.removeEventListener('sourceopen', this.onmso);
  }

  onMediaSourceClose() {
    logger.log('media source closed');
  }

  onMediaSourceEnded() {
    logger.log('media source ended');
  }
}

export default Hls;
