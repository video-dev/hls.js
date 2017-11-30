/**
 * HLS interface
 */
import URLToolkit from 'url-toolkit';
import Event from './events';
import {ErrorTypes, ErrorDetails} from './errors';
import PlaylistLoader from './loader/playlist-loader';
import FragmentLoader from './loader/fragment-loader';
import KeyLoader from './loader/key-loader';

import StreamController from  './controller/stream-controller';
import LevelController from  './controller/level-controller';
import ID3TrackController from './controller/id3-track-controller';

import {isSupported} from './helper/is-supported';
import {logger, enableLogs} from './utils/logger';
import EventEmitter from 'events';
import {hlsDefaultConfig} from './config';

export default class Hls {
  static get version() {
    return __VERSION__;
  }

  static isSupported() {
    return isSupported();
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
      return hlsDefaultConfig;
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
    this._autoLevelCapping = -1;
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

    // core controllers and network loaders
    const abrController = this.abrController = new config.abrController(this);
    const bufferController  = new config.bufferController(this);
    const capLevelController = new config.capLevelController(this);
    const fpsController = new config.fpsController(this);
    const playListLoader = new PlaylistLoader(this);
    const fragmentLoader = new FragmentLoader(this);
    const keyLoader = new KeyLoader(this);
    const id3TrackController = new ID3TrackController(this);

    // network controllers
    const levelController = this.levelController = new LevelController(this);
    const streamController = this.streamController = new StreamController(this);
    let networkControllers = [levelController, streamController];

    // optional audio stream controller
    let Controller = config.audioStreamController;
    if (Controller) {
      networkControllers.push(new Controller(this));
    }
    this.networkControllers = networkControllers;

    let coreComponents = [ playListLoader, fragmentLoader, keyLoader, abrController, bufferController, capLevelController, fpsController, id3TrackController ];

    // optional audio track and subtitle controller
    Controller = config.audioTrackController;
    if (Controller) {
      let audioTrackController = new Controller(this);
      this.audioTrackController = audioTrackController;
      coreComponents.push(audioTrackController);
    }

    Controller = config.subtitleTrackController;
    if (Controller) {
      let subtitleTrackController = new Controller(this);
      this.subtitleTrackController = subtitleTrackController;
      coreComponents.push(subtitleTrackController);
    }

    // optional subtitle controller
    [config.subtitleStreamController, config.timelineController].forEach(Controller => {
      if (Controller) {
        coreComponents.push(new Controller(this));
      }
    });
    this.coreComponents = coreComponents;
  }

  destroy() {
    logger.log('destroy');
    this.trigger(Event.DESTROYING);
    this.detachMedia();
    this.coreComponents.concat(this.networkControllers).forEach(component => {component.destroy();});
    this.url = null;
    this.observer.removeAllListeners();
    this._autoLevelCapping = -1;
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
    url = URLToolkit.buildAbsoluteURL(window.location.href, url, { alwaysNormalize: true });
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
    return Math.max(this.levelController.firstLevel, this.minAutoLevel);
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
    const hls = this;
    // if not in automatic start level detection, ensure startLevel is greater than minAutoLevel
    if (newLevel !== -1) {
      newLevel = Math.max(newLevel,hls.minAutoLevel);
    }
    hls.levelController.startLevel = newLevel;
  }

  /** Return the capping/max level value that could be used by automatic level selection algorithm **/
  get autoLevelCapping() {
    return this._autoLevelCapping;
  }

  /** set the capping/max level value that could be used by automatic level selection algorithm **/
  set autoLevelCapping(newLevel) {
    logger.log(`set autoLevelCapping:${newLevel}`);
    this._autoLevelCapping = newLevel;
  }

  /* check if we are in automatic level selection mode */
  get autoLevelEnabled() {
    return (this.levelController.manualLevel === -1);
  }

  /* return manual level */
  get manualLevel() {
    return this.levelController.manualLevel;
  }

  /* return min level selectable in auto mode according to config.minAutoBitrate */
  get minAutoLevel() {
    let hls = this, levels = hls.levels, minAutoBitrate = hls.config.minAutoBitrate, len = levels ? levels.length : 0;
    for (let i = 0; i < len; i++) {
      const levelNextBitrate = levels[i].realBitrate ? Math.max(levels[i].realBitrate,levels[i].bitrate) : levels[i].bitrate;
      if (levelNextBitrate > minAutoBitrate) {
        return i;
      }
    }
    return 0;
  }

  /* return max level selectable in auto mode according to autoLevelCapping */
  get maxAutoLevel() {
    const hls = this;
    const levels = hls.levels;
    const autoLevelCapping = hls.autoLevelCapping;
    let maxAutoLevel;
    if (autoLevelCapping=== -1 && levels && levels.length) {
      maxAutoLevel = levels.length - 1;
    } else {
      maxAutoLevel = autoLevelCapping;
    }
    return maxAutoLevel;
  }

  // return next auto level
  get nextAutoLevel() {
    const hls = this;
    // ensure next auto level is between  min and max auto level
    return Math.min(Math.max(hls.abrController.nextAutoLevel,hls.minAutoLevel),hls.maxAutoLevel);
  }

  // this setter is used to force next auto level
  // this is useful to force a switch down in auto mode : in case of load error on level N, hls.js can set nextAutoLevel to N-1 for example)
  // forced value is valid for one fragment. upon succesful frag loading at forced level, this value will be resetted to -1 by ABR controller
  set nextAutoLevel(nextLevel) {
    const hls = this;
    hls.abrController.nextAutoLevel = Math.max(hls.minAutoLevel,nextLevel);
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

  get subtitleDisplay() {
    const subtitleTrackController = this.subtitleTrackController;
    return subtitleTrackController ? subtitleTrackController.subtitleDisplay : false;
  }

  set subtitleDisplay(value) {
    const subtitleTrackController = this.subtitleTrackController;
    if (subtitleTrackController) {
      subtitleTrackController.subtitleDisplay = value;
    }
  }
}
