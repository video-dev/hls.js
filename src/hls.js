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

  constructor(video) {
    this.playlistLoader = new PlaylistLoader();
    this.levelController = new LevelController(video,this.playlistLoader);
    this.bufferController = new BufferController(video,this.levelController);
    this.Events = Event;
    this.debug = enableLogs;
    this.logEvt = this.logEvt;
    // observer setup
    this.on = observer.on.bind(observer);
    this.off = observer.removeListener.bind(observer);
    this.attachView(video);
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
    this.detachSource();
    this.detachView();
    observer.removeAllListeners();
  }

  attachView(video) {
    this.video = video;
    this.onverror = this.onVideoError.bind(this);
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
    // listen to all video events
    var listener = function(evt) { this.logEvt(evt); }.bind(this);
    this.onve = listener;
    video.addEventListener('loadstart',       listener);
    //video.addEventListener('progress',        listener);
    video.addEventListener('suspend',         listener);
    video.addEventListener('abort',           listener);
    video.addEventListener('error',           this.onverror);
    video.addEventListener('emptied',         listener);
    video.addEventListener('stalled',         listener);
    video.addEventListener('loadedmetadata',  listener);
    video.addEventListener('loadeddata',      listener);
    video.addEventListener('canplay',         listener);
    video.addEventListener('canplaythrough',  listener);
    video.addEventListener('playing',         listener);
    video.addEventListener('waiting',         listener);
    video.addEventListener('seeking',         listener);
    video.addEventListener('seeked',          listener);
    video.addEventListener('durationchange',  listener);
    //video.addEventListener('timeupdate',      listener);
    video.addEventListener('play',            listener);
    video.addEventListener('pause',           listener);
    video.addEventListener('ratechange',      listener);
    video.addEventListener('resize',          listener);
    video.addEventListener('volumechange',    listener);
  }

  detachView() {
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
    var listener = this.onve;
    this.onve = null;
    if(video) {
      this.video = null;
      // remove all video listeners
      video.removeEventListener('loadstart',       listener);
      //video.removeEventListener('progress',        listener);
      video.removeEventListener('suspend',         listener);
      video.removeEventListener('abort',           listener);
      video.removeEventListener('error',           this.onverror);
      video.removeEventListener('emptied',         listener);
      video.removeEventListener('stalled',         listener);
      video.removeEventListener('loadedmetadata',  listener);
      video.removeEventListener('loadeddata',      listener);
      video.removeEventListener('canplay',         listener);
      video.removeEventListener('canplaythrough',  listener);
      video.removeEventListener('playing',         listener);
      video.removeEventListener('waiting',         listener);
      video.removeEventListener('seeking',         listener);
      video.removeEventListener('seeked',          listener);
      video.removeEventListener('durationchange',  listener);
      //video.removeEventListener('timeupdate',      listener);
      video.removeEventListener('play',            listener);
      video.removeEventListener('pause',           listener);
      video.removeEventListener('ratechange',      listener);
      video.removeEventListener('resize',          listener);
      video.removeEventListener('volumechange',    listener);
      this.onverror = null;
    }
  }

  attachSource(url) {
    this.url = url;
    logger.log('attachSource:'+url);
    // when attaching to a source URL, trigger a playlist load
    this.playlistLoader.load(url,null);
  }

  detachSource() {
    this.url = null;
  }

  onMediaSourceOpen() {
    observer.trigger(Event.FRAMEWORK_READY, { mediaSource : this.mediaSource });
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

  logEvt(evt) {
    var data = '';
    switch(evt.type) {
      case 'durationchange':
        data = evt.target.duration;
        break;
      case 'resize':
        data = 'videoWidth:' + evt.target.videoWidth + '/videoHeight:' + evt.target.videoHeight;
        break;
      case 'loadedmetadata':
        data = 'duration:' + evt.target.duration + '/videoWidth:' + evt.target.videoWidth + '/videoHeight:' + evt.target.videoHeight;
        break;
      case 'loadeddata':
      case 'canplay':
      case 'canplaythrough':
      case 'timeupdate':
      case 'seeking':
      case 'seeked':
      case 'pause':
      case 'play':
      case 'stalled':
        data = 'currentTime:' + evt.target.currentTime;
        break;
      // case 'progress':
      //   data = 'currentTime:' + evt.target.currentTime + ',bufferRange:[' + this.video.buffered.start(0) + ',' + this.video.buffered.end(0) + ']';
      //   break;
      default:
      break;
    }
    logger.log(evt.type + ':' + data);
  }
}

export default Hls;
