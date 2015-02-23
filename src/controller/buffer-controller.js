/*
 * buffer controller
 *
 */

 import Event                from '../events';
 import FragmentLoader       from '../loader/fragment-loader';
 import observer             from '../observer';
 import {logger}             from '../utils/logger';
import TSDemuxer             from '../demux/tsdemuxer';


  const LOADING_IDLE = 0;
  const LOADING_IN_PROGRESS = 1;
  const LOADING_WAITING_LEVEL_UPDATE = 2;
  // const LOADING_STALLED = 3;
  // const LOADING_FRAGMENT_IO_ERROR = 4;
  //const LOADING_COMPLETED = 5;

 class BufferController {

  constructor(video) {
    this.video = video;
    this.fragmentLoader = new FragmentLoader();
    this.demuxer = new TSDemuxer();
    this.mp4segments = [];
    // Source Buffer listeners
    this.onsbue = this.onSourceBufferUpdateEnd.bind(this);
    this.onsbe  = this.onSourceBufferError.bind(this);
    // internal listeners
    this.onll = this.onLevelLoaded.bind(this);
    this.onfl = this.onFragmentLoaded.bind(this);
    this.onis = this.onInitSegment.bind(this);
    this.onfp = this.onFragmentParsed.bind(this);
    this.ontick = this.tick.bind(this);
    this.state = LOADING_WAITING_LEVEL_UPDATE;
  }

  destroy() {
    this.stop();
    this.fragmentLoader.destroy();
    this.demuxer.destroy();
    this.mp4segments = [];
    var sb = this.sourceBuffer;
    if(sb) {
      //detach sourcebuffer from Media Source
      this.mediaSource.removeSourceBuffer(sb);
      sb.removeEventListener('updateend', this.onsbue);
      sb.removeEventListener('error', this.onsbe);
      this.sourceBuffer = null;
    }
    this.state = LOADING_WAITING_LEVEL_UPDATE;
  }

  start(levels, mediaSource) {
    this.levels = levels;
    this.mediaSource =mediaSource;
    this.stop();
    this.timer = setInterval(this.ontick, 100);
    observer.on(Event.FRAGMENT_LOADED, this.onfl);
    observer.on(Event.INIT_SEGMENT, this.onis);
    observer.on(Event.FRAGMENT_PARSED, this.onfp);
    observer.on(Event.LEVEL_LOADED, this.onll);
  }

  stop() {
    if(this.timer) {
      clearInterval(this.ontick);
    }
    this.timer = undefined;
    observer.removeListener(Event.FRAGMENT_LOADED, this.onfl);
    observer.removeListener(Event.FRAGMENT_PARSED, this.onfp);
    observer.removeListener(Event.LEVEL_LOADED, this.onll);
    observer.removeListener(Event.INIT_SEGMENT, this.onis);
  }


  tick() {
    if(this.state === LOADING_IDLE && (!this.sourceBuffer || !this.sourceBuffer.updating)) {
      // check if current play position is buffered
      var v = this.video,
          pos = v.currentTime,
          buffered = v.buffered,
          bufferLen,
          bufferEnd,
          i;
      for(i = 0, bufferLen = 0, bufferEnd = pos ; i < buffered.length ; i++) {
        if(pos >= buffered.start(i) && pos < buffered.end(i)) {
          // play position is inside this buffer TimeRange, retrieve end of buffer position and buffer length
          bufferEnd = buffered.end(i);
          bufferLen = bufferEnd - pos;
        }
      }
      // if buffer length is less than 60s try to load a new fragment
      if(bufferLen < 60) {
        // find fragment index, contiguous with end of buffer position
        var fragments = this.levels[this.level].fragments;
        for (i = 0; i < fragments.length ; i++) {
          if(fragments[i].start <=  (bufferEnd+0.1) && (fragments[i].start + fragments[i].duration) > (bufferEnd+0.1)) {
            break;
          }
        }
        if(i < fragments.length && this.loadingIndex !== i) {
        logger.log('loading frag ' + i);
        this.loadingIndex = i;
        fragments[i].loaded = true;
        this.fragmentLoader.load(fragments[i].url);
        this.state = LOADING_IN_PROGRESS;
        } else {
          //logger.log('last fragment loaded');
          //observer.trigger(Event.LAST_FRAGMENT_LOADED);
          //this.state = LOADING_COMPLETED;
        }
      }
    }
  }

  onLevelLoaded(event,data) {
    this.level = data.level;
    this.demuxer.duration = this.levels[this.level].totalduration;
    this.fragmentIndex = 0;
    var stats = data.stats;
    logger.log('level loaded,RTT(ms)/load(ms)/duration:' + (stats.tfirst - stats.trequest) + '/' + (stats.tend - stats.trequest) + '/' + this.demuxer.duration);
    this.state = LOADING_IDLE;
  }

  onFragmentLoaded(event,data) {
    // transmux the MPEG-TS data to ISO-BMFF segments
    this.demuxer.push(new Uint8Array(data.payload));
    this.demuxer.end();
    this.state = LOADING_IDLE;
    var stats,rtt,loadtime,bw;
    stats = data.stats;
    rtt = stats.tfirst - stats.trequest;
    loadtime = stats.tend - stats.trequest;
    bw = stats.length*8/(1000*loadtime);
    //logger.log(data.url + ' loaded, RTT(ms)/load(ms)/bitrate:' + rtt + '/' + loadtime + '/' + bw.toFixed(3) + ' Mb/s');
  }

  onInitSegment(event,data) {
    // create source Buffer and link them to MediaSource
    var codec = data.codec;
    // var codec = this.levels[this.level].codecs;
    // if(codec === undefined) {
    //   codec = data.codec;
    // }
    // codec="mp4a.40.5,avc1.420016";
    // logger.log("choosed codecs:" + codec);
    var sb = this.sourceBuffer = this.mediaSource.addSourceBuffer('video/mp4;codecs=' + codec);
    sb.addEventListener('updateend', this.onsbue);
    sb.addEventListener('error', this.onsbe);
    this.mp4segments.push(data);
    this.appendSegments();
  }

  onFragmentParsed(event,data) {
    this.mp4segments.push(data);
    this.appendSegments();
  }

  appendSegments() {
    if (this.sourceBuffer && !this.sourceBuffer.updating && this.mp4segments.length) {
      this.sourceBuffer.appendBuffer(this.mp4segments.shift().data);
    }
  }

  onSourceBufferUpdateEnd() {
    //logger.log('buffer appended');
    this.appendSegments();
  }

  onSourceBufferError(event) {
      logger.log(' buffer append error:' + event);
  }
}

export default BufferController;
