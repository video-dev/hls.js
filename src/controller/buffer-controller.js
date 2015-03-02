/*
 * buffer controller
 *
 */

 import Event                from '../events';
 import FragmentLoader       from '../loader/fragment-loader';
 import observer             from '../observer';
 import {logger}             from '../utils/logger';
 import TSDemuxer            from '../demux/tsdemuxer';
 import TSDemuxerWorker      from '../demux/tsdemuxerworker';

  const LOADING_IDLE = 0;
  const LOADING_IN_PROGRESS = 1;
  const LOADING_WAITING_LEVEL_UPDATE = 2;
  const PARSING_APPENDING = 3;
  const PARSED_APPENDING = 4;

 class BufferController {

  constructor(video,playlistLoader,levelController) {
    this.video = video;
    this.playlistLoader = playlistLoader;
    this.levelController = levelController;
    this.fragmentLoader = new FragmentLoader();
    var enableWorker = false;
    if(enableWorker && (typeof(Worker) !== 'undefined')) {
      console.log('TS demuxing in webworker');
      var work = require('webworkify');
      this.w = work(TSDemuxerWorker);
      this.onwmsg = this.onWorkerMessage.bind(this);
      this.w.addEventListener('message', this.onwmsg);
    } else {
      this.demuxer = new TSDemuxer();
    }
    this.mp4segments = [];
    // Source Buffer listeners
    this.onsbue = this.onSourceBufferUpdateEnd.bind(this);
    this.onsbe  = this.onSourceBufferError.bind(this);
    // internal listeners
    this.onll = this.onLevelLoaded.bind(this);
    this.onfl = this.onFragmentLoaded.bind(this);
    this.onis = this.onInitSegment.bind(this);
    this.onfpg = this.onFragmentParsing.bind(this);
    this.onfp = this.onFragmentParsed.bind(this);
    this.ontick = this.tick.bind(this);
    this.state = LOADING_IDLE;
    this.waitlevel = true;
  }

  destroy() {
    this.stop();
    this.fragmentLoader.destroy();
    if(this.w) {
      this.w.removeEventListener('message',this.onwmsg);
      this.w.terminate();
      this.w = null;
    } else {
      this.demuxer.destroy();
    }
    this.mp4segments = [];
    var sb = this.sourceBuffer;
    if(sb) {
      //detach sourcebuffer from Media Source
      this.mediaSource.removeSourceBuffer(sb);
      sb.removeEventListener('updateend', this.onsbue);
      sb.removeEventListener('error', this.onsbe);
      this.sourceBuffer = null;
    }
    this.state = LOADING_IDLE;
  }

  start(levels, mediaSource) {
    this.levels = levels;
    this.mediaSource =mediaSource;
    this.stop();
    this.timer = setInterval(this.ontick, 100);
    observer.on(Event.FRAGMENT_LOADED, this.onfl);
    observer.on(Event.INIT_SEGMENT, this.onis);
    observer.on(Event.FRAGMENT_PARSING, this.onfpg);
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
    observer.removeListener(Event.FRAGMENT_PARSING, this.onfpg);
    observer.removeListener(Event.LEVEL_LOADED, this.onll);
    observer.removeListener(Event.INIT_SEGMENT, this.onis);
  }


  tick() {
    switch(this.state) {
      case LOADING_IN_PROGRESS:
        // nothing to do, wait for fragment retrieval
      case LOADING_WAITING_LEVEL_UPDATE:
        // nothing to do, wait for level retrieval
        break;
      case PARSING_APPENDING:
      case PARSED_APPENDING:
        if (this.sourceBuffer) {
          // if MP4 segment appending in progress nothing to do
          if(this.sourceBuffer.updating) {
            //logger.log('sb append in progress');
        // check if any MP4 segments left to append
          } else if(this.mp4segments.length) {
            this.sourceBuffer.appendBuffer(this.mp4segments.shift());
          } else if (this.state === PARSED_APPENDING) {
            // no more sourcebuffer to update, and parsing finished we are done with this segment, switch back to IDLE state
            //logger.log('sb append finished');
            this.state = LOADING_IDLE;
          }
        }
        break;
      case LOADING_IDLE:
        // determine next candidate fragment to be loaded, based on current position and end of buffer position
        // ensure 60s of buffer upfront
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
          var loadLevel;
          // determine loading level
          if(typeof this.level === 'undefined') {
            // level not defined, get start level from level Controller
            loadLevel = this.levelController.startLevel();
          } else if(this.waitlevel === false) {
            // level already defined, and we are not already switching, get best level from level Controller
            loadLevel = this.levelController.bestLevel();
          } else {
            // we just switched level and playlist should now be retrieved, stick to switched level
            loadLevel = this.level;
          }
          if(loadLevel !== this.playlistLoader.level) {
            // set new level to playlist loader : this will trigger a playlist load if needed
            this.playlistLoader.level = loadLevel;
            this.level = loadLevel;
            // tell demuxer that we will switch level (this will force init segment to be regenerated)
            this.demuxer.switchLevel();
          }
          var level = this.levels[loadLevel];
          // if level not retrieved yet, switch state and wait for playlist retrieval
          if(typeof level.fragments === 'undefined') {
            this.state = LOADING_WAITING_LEVEL_UPDATE;
            this.waitlevel = true;
          } else {
            this.waitlevel = false;
            // find fragment index, contiguous with end of buffer position
            var fragments = level.fragments, frag;
            for (i = 0; i < fragments.length ; i++) {
              frag = fragments[i];
              if(frag.start <=  (bufferEnd+0.2) && (frag.start + frag.duration) > (bufferEnd+0.2)) {
                break;
              }
            }
            if(i < fragments.length) {
              if(this.loadingIndex !== i) {
                logger.log('      Loading       ' + frag.sn + ' of [' + fragments[0].sn + ',' + fragments[fragments.length-1].sn + '],level '  + loadLevel);
                //logger.log('      loading frag ' + i +',pos/bufEnd:' + pos.toFixed(3) + '/' + bufferEnd.toFixed(3));
                this.loadingIndex = i;
                this.fragmentLoader.load(frag.url);
                this.state = LOADING_IN_PROGRESS;
              } else {
                logger.log('avoid loading frag ' + i +',pos/bufEnd:' + pos.toFixed(3) + '/' + bufferEnd.toFixed(3) +',frag start/end:' + frag.start + '/' + (frag.start + frag.duration));
              }
            }
          }
        }
        break;
      default:
        break;
    }
  }

  onLevelLoaded(event,data) {
    this.level = data.level;
    var duration = this.levels[this.level].totalduration;
    if(this.w) {
      this.w.postMessage(duration); // post duration
    } else {
      this.demuxer.duration = duration;
    }
    var stats = data.stats;
    logger.log('level ' + data.level + ' loaded,RTT(ms)/load(ms)/duration:' + (stats.tfirst - stats.trequest) + '/' + (stats.tend - stats.trequest) + '/' + duration);
    this.state = LOADING_IDLE;
    //trigger handler right now
    this.tick();
  }

  onFragmentLoaded(event,data) {
    this.state = PARSING_APPENDING;
    // transmux the MPEG-TS data to ISO-BMFF segments
    this.tparse0 = Date.now();
    this.parselen = data.payload.byteLength;
    if(this.w) {
      // post fragment payload as transferable objects (no copy)
      this.w.postMessage(data.payload,[data.payload]);
      this.tparse1 = Date.now();
    } else {
      this.demuxer.push(new Uint8Array(data.payload));
      this.tparse1 = Date.now();
      this.demuxer.end();
    }
    var stats,rtt,loadtime,bw;
    stats = data.stats;
    rtt = stats.tfirst - stats.trequest;
    loadtime = stats.tend - stats.trequest;
    bw = stats.length*8/(1000*loadtime);
    //logger.log(data.url + ' loaded, RTT(ms)/load(ms)/bitrate:' + rtt + '/' + loadtime + '/' + bw.toFixed(3) + ' Mb/s');
  }

  onInitSegment(event,data) {
    // check if codecs have been explicitely defined in the master playlist for this level;
    // if yes use these ones instead of the ones parsed from the demux
    var codec = this.levels[this.level].codecs;
    if(codec === undefined) {
      codec = data.codec;
    }
    // codec="mp4a.40.5,avc1.420016";
    logger.log('choosed codecs:' + codec);
    if(!this.sourceBuffer) {
      // create source Buffer and link them to MediaSource
      var sb = this.sourceBuffer = this.mediaSource.addSourceBuffer('video/mp4;codecs=' + codec);
      sb.addEventListener('updateend', this.onsbue);
      sb.addEventListener('error', this.onsbe);
    }
    this.mp4segments.push(data.moov);
    //trigger handler right now
    this.tick();
  }

  onFragmentParsing(event,data) {
    this.tparse2 = Date.now();
    logger.log('parsed data, type/start/end:' + data.type + '/' + data.start.toFixed(3) + '/' + data.end.toFixed(3) );
    this.mp4segments.push(data.moof);
    this.mp4segments.push(data.mdat);
    //trigger handler right now
    this.tick();
  }

  onFragmentParsed() {
    this.state = PARSED_APPENDING;
    this.tparse2 = Date.now();
    //logger.log('      parsing len/duration/rate:' + (this.parselen/1000000).toFixed(2) + 'MB/'  + (this.tparse2-this.tparse0) +'ms/' + ((this.parselen/1000)/(this.tparse2-this.tparse0)).toFixed(2) + 'MB/s');
     //trigger handler right now
    this.tick();
  }

  onSourceBufferUpdateEnd() {
    //trigger handler right now
    this.tick();
  }

  onSourceBufferError(event) {
      logger.log(' buffer append error:' + event);
  }

  onWorkerMessage(ev) {
    //console.log(ev);
    switch(ev.data.event) {
      case Event.INIT_SEGMENT:
        observer.trigger(Event.INIT_SEGMENT,{
          moov: new Uint8Array(ev.moov.data),
          codec : ev.data.codec
        });
      break;
      case Event.FRAGMENT_PARSING:
        observer.trigger(Event.FRAGMENT_PARSING,{
          moof : new Uint8Array(ev.moof.data),
          mdat : new Uint8Array(ev.mdat.data),
          start : ev.data.start,
          end : ev.data.end,
          type : ev.data.type
        });
      break;
      case Event.FRAGMENT_PARSED:
        observer.trigger(Event.FRAGMENT_PARSED);
      break;
      default:
      break;
    }
  }
}

export default BufferController;
