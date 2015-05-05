/**
 * HLS engine
 */
'use strict';

import Event                from './events';
import observer             from './observer';
import PlaylistLoader       from './loader/playlist-loader';
import BufferController     from './controller/buffer-controller';
import LevelController      from './controller/level-controller';
import {logger,enableLogs}  from './utils/logger';
//import MP4Inspect         from '/remux/mp4-inspector';

class Hls {

  static isSupported() {
    return (window.MediaSource && MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E,mp4a.40.2"'));
  }

  constructor() {
    this.playlistLoader = new PlaylistLoader();
    this.levelController = new LevelController(this.playlistLoader);
    this.bufferController = new BufferController(this.levelController);
    this.Events = Event;
    this.debug = enableLogs;
    this.logEvt = this.logEvt;
    // observer setup
    this.on = observer.on.bind(observer);
    this.off = observer.removeListener.bind(observer);
  }

  destroy() {
    if(this.playlistLoader) {
      this.playlistLoader.destroy();
      this.playlistLoader = null;
    }
    if(this.bufferController) {
      this.bufferController.destroy();
      this.bufferController = null;
    }
    if(this.levelController) {
      this.levelController.destroy();
      this.levelController = null;
    }
    this.unloadSource();
    this.detachVideo();
    observer.removeAllListeners();
  }

  attachVideo(video) {
    this.video = video;
    // setup the media source
    var ms = this.mediaSource = new MediaSource();
    //Media Source listeners
    this.onmso = this.onMediaSourceOpen.bind(this);
    this.onmse = this.onMediaSourceEnded.bind(this);
    this.onmsc = this.onMediaSourceClose.bind(this);
    ms.addEventListener('sourceopen',  this.onmso);
    ms.addEventListener('sourceended', this.onmse);
    ms.addEventListener('sourceclose', this.onmsc);
    // link video and media Source
    video.src = URL.createObjectURL(ms);
    this.onverror = this.onVideoError.bind(this);
    video.addEventListener('error',this.onverror);
  }

  detachVideo() {
    var video = this.video;
    var ms = this.mediaSource;
    if(ms) {
      ms.endOfStream();
      ms.removeEventListener('sourceopen',  this.onmso);
      ms.removeEventListener('sourceended', this.onmse);
      ms.removeEventListener('sourceclose', this.onmsc);
      // unlink MediaSource from video tag
      video.src = '';
      this.mediaSource = null;
    }
    this.onmso = this.onmse = this.onmsc = null;
    if(video) {
      this.video = null;
      // remove video error listener
      video.removeEventListener('error',this.onverror);
      this.onverror = null;
    }
  }

  loadSource(url) {
    this.url = url;
    logger.log('loadSource:'+url);
    // when attaching to a source URL, trigger a playlist load
    this.playlistLoader.load(url,null);
  }

  unloadSource() {
    this.url = null;
  }

  /** Return all quality levels **/
  get levels() {
    return this.levelController.levels;
  }

  /** Return current playback quality level **/
  get currentLevel() {
    return this.bufferController.playbackLevel;
  }

  /* set quality level immediately (-1 for automatic level selection) */
  set currentLevel(newLevel) {
    this.loadLevel = newLevel;
    this.bufferController.immediateLevelSwitch();
  }

  /** Return the quality level of last loaded fragment **/
  get loadLevel() {
    return this.levelController.level;
  }

  /* set quality level for next loaded fragment (-1 for automatic level selection) */
  set loadLevel(newLevel) {
    this.levelController.manualLevel = newLevel;
  }

  /** Return first level (index of first level referenced in manifest)
  **/
  get firstLevel() {
    return this.levelController.firstLevel;
  }

  /** set first level (index of first level referenced in manifest)
  **/
  set firstLevel(newLevel) {
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
    this.levelController.startLevel = newLevel;
  }

  /** Return the capping/max level value that could be used by automatic level selection algorithm **/
  get autoLevelCapping() {
    return this.levelController.autoLevelCapping;
  }

  /** set the capping/max level value that could be used by automatic level selection algorithm **/
  set autoLevelCapping(newLevel) {
    this.levelController.autoLevelCapping = newLevel;
  }

  /* check if we are in automatic level selection mode */
  get autoLevelEnabled() {
    return (this.levelController.manualLevel  === -1);
  }

  /* return manual level */
  get manualLevel() {
    return this.levelController.manualLevel;
  }

  /* return current playback level */
  get playbackLevel() {
    return this.bufferController.playbackLevel;
  }

  onMediaSourceOpen() {
    observer.trigger(Event.MSE_ATTACHED, { video: this.video, mediaSource : this.mediaSource });
  }

  onMediaSourceClose() {
    logger.log('media source closed');
  }

  onMediaSourceEnded() {
    logger.log('media source ended');
  }

  onVideoError() {
    observer.trigger(Event.VIDEO_ERROR);
  }
}

export default Hls;
