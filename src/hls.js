/**
 * HLS engine
 */
'use strict';

import Event                from './events';
import FragmentLoader       from './loader/fragment-loader';
import observer             from './observer';
import PlaylistLoader       from './loader/playlist-loader';
import TSDemuxer            from './demux/tsdemuxer';
import {logger,enableLogs}  from './utils/logger';
//import MP4Inspect         from '/remux/mp4-inspector';


class Hls {

  constructor() {
    this.mediaSource = new MediaSource();
    this.playlistLoader = new PlaylistLoader();
    this.fragmentLoader = new FragmentLoader();
    this.demuxer = new TSDemuxer();
    this.mp4segments = [];
    this.Events = Event;
    this.debug = enableLogs;
    this.logEvt = this.logEvt;
    // setup listeners
    this.on = observer.on.bind(observer);
    this.off = observer.removeListener.bind(observer);
    // setup the media source
    this.mediaSource.addEventListener('sourceopen', this.onMediaSourceOpen.bind(this));
    this.mediaSource.addEventListener('sourceended', function() {logger.log('media source ended');});
    this.mediaSource.addEventListener('sourceclose', function() {logger.log('media source closed');});

    observer.on(Event.MANIFEST_LOADED, function(event,data) {
      this.fragments = data.levels[0].fragments;
      this.fragmentIndex = 0;
      this.fragmentLoader.load(this.fragments[this.fragmentIndex++].url);
      var stats,rtt,loadtime;
      stats = data.stats;
      rtt = stats.tfirst - stats.trequest;
      loadtime = stats.tend - stats.trequest;
      logger.log('playlist loaded,RTT(ms)/load(ms)/nb frag:' + rtt + '/' + loadtime + '/' + stats.length);
    }.bind(this));

    observer.on(Event.FRAGMENT_LOADED, function(event,data) {
      this.demuxer.push(new Uint8Array(data.payload));
      this.demuxer.end();
      this.appendSegments();
      if (this.fragmentIndex < this.fragments.length) {
        this.fragmentLoader.load(this.fragments[this.fragmentIndex++].url);
      } else {
        logger.log('last fragment loaded');
        observer.trigger(Event.LAST_FRAGMENT_LOADED);
      }
      var stats,rtt,loadtime,bw;
      stats = data.stats;
      rtt = stats.tfirst - stats.trequest;
      loadtime = stats.tend - stats.trequest;
      bw = stats.length*8/(1000*loadtime);
      logger.log('frag loaded, RTT(ms)/load(ms)/bitrate:' + rtt + '/' + loadtime + '/' + bw.toFixed(3) + ' Mb/s');
    }.bind(this));

    // transmux the MPEG-TS data to ISO-BMFF segments
    observer.on(Event.FRAGMENT_PARSED, function(event,segment) {
      //logger.log(JSON.stringify(MP4Inspect.mp4toJSON(segment.data)),null,4);
      this.mp4segments.push(segment);
    }.bind(this));
  }

  attachView(video) {
    this.video = video;
    video.src = URL.createObjectURL(this.mediaSource);
    video.addEventListener('loadstart',       function(evt) { this.logEvt(evt); }.bind(this));
    video.addEventListener('progress',        function(evt) { this.logEvt(evt); }.bind(this));
    video.addEventListener('suspend',         function(evt) { this.logEvt(evt); }.bind(this));
    video.addEventListener('abort',           function(evt) { this.logEvt(evt); }.bind(this));
    video.addEventListener('error',           function(evt) { this.logEvt(evt); }.bind(this));
    video.addEventListener('emptied',         function(evt) { this.logEvt(evt); }.bind(this));
    video.addEventListener('stalled',         function(evt) { this.logEvt(evt); }.bind(this));
    video.addEventListener('loadedmetadata',  function(evt) { this.logEvt(evt); }.bind(this));
    video.addEventListener('loadeddata',      function(evt) { this.logEvt(evt); }.bind(this));
    video.addEventListener('canplay',         function(evt) { this.logEvt(evt); }.bind(this));
    video.addEventListener('canplaythrough',  function(evt) { this.logEvt(evt); }.bind(this));
    video.addEventListener('playing',         function(evt) { this.logEvt(evt); }.bind(this));
    video.addEventListener('waiting',         function(evt) { this.logEvt(evt); }.bind(this));
    video.addEventListener('seeking',         function(evt) { this.logEvt(evt); }.bind(this));
    video.addEventListener('seeked',          function(evt) { this.logEvt(evt); }.bind(this));
    video.addEventListener('durationchange',  function(evt) { this.logEvt(evt); }.bind(this));
    video.addEventListener('timeupdate',      function(evt) { this.logEvt(evt); }.bind(this));
    video.addEventListener('play',            function(evt) { this.logEvt(evt); }.bind(this));
    video.addEventListener('pause',           function(evt) { this.logEvt(evt); }.bind(this));
    video.addEventListener('ratechange',      function(evt) { this.logEvt(evt); }.bind(this));
    video.addEventListener('resize',          function(evt) { this.logEvt(evt); }.bind(this));
    video.addEventListener('volumechange',    function(evt) { this.logEvt(evt); }.bind(this));
  }

  attachSource(url) {
    url = url;
    logger.log('attachSource:'+url);
    this.playlistLoader.load(url);
  }

  onMediaSourceOpen() {
    this.buffer = this.mediaSource.addSourceBuffer('video/mp4;codecs=avc1.4d400d,mp4a.40.5');
    this.buffer.addEventListener('updateend', function() {
    this.appendSegments();
    }.bind(this));

    this.buffer.addEventListener('error', function(event) {
      logger.log(' buffer append error:' + event);
    });
    observer.trigger(Event.FRAMEWORK_READY);
  }

  appendSegments() {
    if (!this.buffer.updating && this.mp4segments.length) {
      this.buffer.appendBuffer(this.mp4segments.shift().data);
    }
  }

  logEvt(evt) {
    var data = '';
    switch(evt.type) {
      case 'durationchange':
      data = event.target.duration;
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
      default:
      break;
    }
    logger.log(evt.type + ':' + data);
  }
}

export default Hls;
