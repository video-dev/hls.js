/*
 * buffer controller
 *
 */

 import Event                from '../events';
 import FragmentLoader       from '../loader/fragment-loader';
 import observer             from '../observer';
 import {logger}             from '../utils/logger';
 import Demuxer              from '../demux/demuxer';

  const IDLE = 0;
  const LOADING = 1;
  const WAITING_LEVEL = 2;
  const PARSING = 3;
  const PARSED = 4;
  const APPENDING = 5;

 class BufferController {

  constructor(video,levelController) {
    this.video = video;
    this.levelController = levelController;
    this.fragmentLoader = new FragmentLoader();
    this.mp4segments = [];
    // Source Buffer listeners
    this.onsbue = this.onSourceBufferUpdateEnd.bind(this);
    this.onsbe  = this.onSourceBufferError.bind(this);
    // internal listeners
    this.onfr = this.onFrameworkReady.bind(this);
    this.onmp = this.onManifestParsed.bind(this);
    this.onll = this.onLevelLoaded.bind(this);
    this.onfl = this.onFragmentLoaded.bind(this);
    this.onis = this.onInitSegment.bind(this);
    this.onfpg = this.onFragmentParsing.bind(this);
    this.onfp = this.onFragmentParsed.bind(this);
    this.ontick = this.tick.bind(this);
    this.state = IDLE;
    this.waitlevel = false;
    observer.on(Event.FRAMEWORK_READY, this.onfr);
    observer.on(Event.MANIFEST_PARSED, this.onmp);
    this.demuxer = new Demuxer();
    // video seeking listener
    this.onvseeking = this.onVideoSeeking.bind(this);
    video.addEventListener('seeking',this.onvseeking);
  }

  destroy() {
    this.stop();
    this.fragmentLoader.destroy();
    if(this.demuxer) {
      this.demuxer.destroy();
      this.demuxer = null;
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
    observer.removeListener(Event.FRAMEWORK_READY, this.onfr);
    observer.removeListener(Event.MANIFEST_PARSED, this.onmp);
    // remove video listener
    this.video.removeEventListener('seeking',this.onvseeking);
    this.onvseeking = null;
    this.state = IDLE;
  }

  start() {
    this.stop();
    this.timer = setInterval(this.ontick, 100);
    observer.on(Event.FRAG_LOADED, this.onfl);
    observer.on(Event.FRAG_PARSING_INIT_SEGMENT, this.onis);
    observer.on(Event.FRAG_PARSING_DATA, this.onfpg);
    observer.on(Event.FRAG_PARSED, this.onfp);
    observer.on(Event.LEVEL_LOADED, this.onll);
    this.tick();
  }

  stop() {
    if(this.timer) {
      clearInterval(this.timer);
    }
    this.timer = undefined;
    observer.removeListener(Event.FRAG_LOADED, this.onfl);
    observer.removeListener(Event.FRAG_PARSED, this.onfp);
    observer.removeListener(Event.FRAG_PARSING_DATA, this.onfpg);
    observer.removeListener(Event.LEVEL_LOADED, this.onll);
    observer.removeListener(Event.FRAG_PARSING_INIT_SEGMENT, this.onis);
  }

  tick() {
    switch(this.state) {
      case LOADING:
        // nothing to do, wait for fragment retrieval
      case WAITING_LEVEL:
        // nothing to do, wait for level retrieval
      case PARSING:
        // nothing to do, wait for fragment being parsed
        break;
      case PARSED:
      case APPENDING:
        if (this.sourceBuffer) {
          // if MP4 segment appending in progress nothing to do
          if(this.sourceBuffer.updating) {
            //logger.log('sb append in progress');
        // check if any MP4 segments left to append
          } else if(this.mp4segments.length) {
            this.sourceBuffer.appendBuffer(this.mp4segments.shift());
            this.state = APPENDING;
          }
        }
        break;
      case IDLE:
        // determine next candidate fragment to be loaded, based on current position and
        //  end of buffer position
        //  ensure 60s of buffer upfront
        var bufferInfo = this.bufferInfo, bufferLen = bufferInfo.len, bufferEnd = bufferInfo.end;
        // if buffer length is less than 60s try to load a new fragment
        if(bufferLen < 60) {
          var loadLevel;
          if(this.waitlevel === false) {
            // determine loading level
            if(this.startFragmentLoaded === false) {
              // get start level from level Controller
              loadLevel = this.levelController.startLevel;
              if (loadLevel === -1) {
                // -1 : guess start Level by doing a bitrate test by loading first fragment of lowest quality level
                loadLevel = 0;
                this.fragmentBitrateTest = true;
              }
            } else {
              // we are not at playback start, get next load level from level Controller
              loadLevel = this.levelController.nextLevel();
            }
            if(loadLevel !== this.level) {
              // set new level to playlist loader : this will trigger a playlist load if needed
              this.levelController.level = loadLevel;
              // tell demuxer that we will switch level (this will force init segment to be regenerated)
              if (this.demuxer) {
                this.demuxer.switchLevel();
              }
            }
          } else {
            // we just retrieved playlist info after switching level,
            // stick on same level, retrieve level from level controller
            loadLevel = this.levelController.level;
          }
          var level = this.levels[loadLevel];
          // if level not retrieved yet, switch state and wait for playlist retrieval
          if(typeof level.data === 'undefined') {
            this.state = WAITING_LEVEL;
            this.waitlevel = true;
          } else {
            // find fragment index, contiguous with end of buffer position
            var fragments = level.data.fragments, frag, sliding = level.data.sliding, start;
            // check if requested position is within seekable boundaries :
            // in case of live playlist we need to ensure that requested position is not located before playlist start
            start = fragments[0].start + sliding;
            if(bufferEnd < start) {
              logger.log('requested position:' + bufferEnd + ' is before start of playlist, reset video position to start:' + start);
              this.video.currentTime = start + 0.01;
              return;
            }
            if(bufferLen > 0 && this.video.buffered.length === 1) {
              var i = this.frag.sn + 1 - fragments[0].sn;
              if(i >= fragments.length) {
                // most certainly live playlist is outdated, let's move to WAITING LEVEL state and come back once it will have been refreshed
                //logger.log('sn ' + (this.frag.sn + 1) + ' out of range, wait for live playlist update');
                this.state = WAITING_LEVEL;
                this.waitlevel = true;
                return;
              }
              frag = fragments[i];
            } else {
              // no data buffered, look for fragments matching with current play position
              for (i = 0; i < fragments.length ; i++) {
                frag = fragments[i];
                start = frag.start+sliding;
                // offset should be within fragment boundary
                if(start <= bufferEnd && (start + frag.duration) > bufferEnd) {
                  break;
                }
              }
              //logger.log('find SN matching with pos:' +  bufferEnd + ':' + frag.sn);
            }
            if(i >= 0 && i < fragments.length) {
              this.waitlevel = false;
              if(this.frag && frag.sn === this.frag.sn) {
                if(i === (fragments.length -1)) {
                  // we are at the end of the playlist and we already loaded last fragment, don't do anything
                  return;
                } else {
                  frag = fragments[i+1];
                  logger.log('SN just loaded, load next one:' + frag.sn);
                }
              }
              logger.log('Loading       ' + frag.sn + ' of [' + fragments[0].sn + ',' + fragments[fragments.length-1].sn + '],level '  + loadLevel);
              //logger.log('      loading frag ' + i +',pos/bufEnd:' + pos.toFixed(3) + '/' + bufferEnd.toFixed(3));

              this.frag = frag;
              this.level = loadLevel;
              this.fragmentLoader.load(frag,loadLevel);
              this.state = LOADING;
            }
          }
        }
        break;
      default:
        break;
    }
  }

  get bufferInfo() {
    var v = this.video,
        pos = v.currentTime,
        buffered = v.buffered,
        bufferLen,
        // bufferStart and bufferEnd are buffer boundaries around current video position
        bufferStart,bufferEnd,
        i;
    var buffered2 = [];
    // there might be some small holes between buffer time range
    // consider that holes smaller than 300 ms are irrelevant and build another
    // buffer time range representations that discards those holes
    for(i = 0 ; i < buffered.length ; i++) {
      //logger.log('buf start/end:' + buffered.start(i) + '/' + buffered.end(i));
      if((buffered2.length) && (buffered.start(i) - buffered2[buffered2.length-1].end ) < 0.3) {
        buffered2[buffered2.length-1].end = buffered.end(i);
      } else {
        buffered2.push({start : buffered.start(i),end : buffered.end(i)});
      }
    }

    for(i = 0, bufferLen = 0, bufferStart = bufferEnd = pos ; i < buffered2.length ; i++) {
      //logger.log('buf start/end:' + buffered.start(i) + '/' + buffered.end(i));
      if((pos+0.3) >= buffered2[i].start && pos < buffered2[i].end) {
        // play position is inside this buffer TimeRange, retrieve end of buffer position and buffer length
        bufferStart = buffered2[i].start;
        bufferEnd = buffered2[i].end + 0.3;
        bufferLen = bufferEnd - pos;
      }
    }
    return {len : bufferLen, start : bufferStart, end : bufferEnd};
  }


  onFrameworkReady(event,data) {
    this.mediaSource = data.mediaSource;
  }

  onVideoSeeking(event) {
    if(this.state === LOADING) {
      // check if currently loaded fragment is inside buffer.
      //if outside, cancel fragment loading, otherwise do nothing
      if(this.bufferInfo.len === 0) {
      logger.log('seeking outside of buffer while fragment load in progress, cancel fragment load');
      this.fragmentLoader.abort();
      this.state = IDLE;
      }
    }
    // tick to speed up processing
    this.tick();
  }

  onManifestParsed(event,data) {
    this.audiocodecswitch = data.audiocodecswitch;
    if(this.audiocodecswitch) {
      logger.log('both AAC/HE-AAC audio found in levels; declaring audio codec as HE-AAC');
    }
    this.levels = data.levels;
    this.startLevelLoaded = false;
    this.startFragmentLoaded = false;
    this.start();
  }

  onLevelLoaded(event,data) {
    var fragments = data.level.fragments,duration = data.level.totalduration;
    logger.log('level ' + data.id + ' loaded [' + fragments[0].sn + ',' + fragments[fragments.length-1].sn + '],duration:' + duration);

    var level = this.levels[data.id],sliding = 0, levelCurrent = this.levels[this.level];
    // check if playlist is already loaded (if yes, it should be a live playlist)
    if(levelCurrent && levelCurrent.data && levelCurrent.data.live) {
      //  playlist sliding is the sum of : current playlist sliding + sliding of new playlist compared to current one
      sliding = levelCurrent.data.sliding;
      // check sliding of updated playlist against current one :
      // and find its position in current playlist
      //logger.log("fragments[0].sn/this.level/levelCurrent.data.fragments[0].sn:" + fragments[0].sn + "/" + this.level + "/" + levelCurrent.data.fragments[0].sn);
      var SNdiff = fragments[0].sn - levelCurrent.data.fragments[0].sn;
      if(SNdiff >=0) {
        // positive sliding : new playlist sliding window is after previous one
        sliding += levelCurrent.data.fragments[SNdiff].start;
      } else {
        // negative sliding: new playlist sliding window is before previous one
        sliding -= fragments[-SNdiff].start;
      }
      logger.log('live playlist sliding:' + sliding.toFixed(3));
    }
    // override level info
    level.data = data.level;
    level.data.sliding = sliding;
    this.demuxer.duration = duration;
    if(this.startLevelLoaded === false) {
      // if live playlist, set start position to be fragment N-3
      if(data.level.live) {
        this.video.currentTime = Math.max(0,duration - 3 * data.level.targetduration);
      }
      this.startLevelLoaded = true;
    }
    // only switch batck to IDLE state if we were waiting for level to start downloading a new fragment
    if(this.state === WAITING_LEVEL) {
      this.state = IDLE;
      //trigger handler right now
      this.tick();
    }
  }

  onFragmentLoaded(event,data) {
    if(this.state === LOADING) {
      if(this.fragmentBitrateTest === true) {
        // switch back to IDLE state ... we just loaded a fragment to determine adequate start bitrate and initialize autoswitch algo
        this.state = IDLE;
        this.fragmentBitrateTest = false;
        data.stats.tparsed = data.stats.tbuffered = new Date();
        observer.trigger(Event.FRAG_BUFFERED, { stats : data.stats, frag : this.frag});
        this.frag = null;
      } else {
        this.state = PARSING;
        // transmux the MPEG-TS data to ISO-BMFF segments
        this.stats = data.stats;
        this.demuxer.push(data.payload,this.levels[this.level].codecs,this.frag.start);
      }
      this.startFragmentLoaded = true;
    }
  }

  onInitSegment(event,data) {
    // check if codecs have been explicitely defined in the master playlist for this level;
    // if yes use these ones instead of the ones parsed from the demux
    var codec = this.levels[this.level].codecs;
    //logger.log('playlist codecs:' + codec);
    // if playlist does not specify codecs, use codecs found while parsing fragment
    if(codec === undefined) {
      codec = data.codec;
    }
    // codec="mp4a.40.5,avc1.420016";
    // in case several audio codecs might be used, force HE-AAC for audio (some browsers don't support audio codec switch)
    //don't do it for mono streams ...
    if(this.audiocodecswitch && data.audioChannelCount === 2 && navigator.userAgent.toLowerCase().indexOf('android') === -1 && navigator.userAgent.toLowerCase().indexOf('firefox') === -1) {
      codec = codec.replace('mp4a.40.2','mp4a.40.5');
    }
    logger.log('playlist/choosed codecs:' + this.levels[this.level].codecs + '/' + codec);
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
    var level = this.levels[this.level];
    if(level.data.live) {
      level.data.sliding = data.startPTS - this.frag.start;
    }
    logger.log('      parsed data, type/startPTS/endPTS/startDTS/endDTS/sliding:' + data.type + '/' + data.startPTS.toFixed(3) + '/' + data.endPTS.toFixed(3) + '/' + data.startDTS.toFixed(3) + '/' + data.endDTS.toFixed(3) + '/' + level.data.sliding.toFixed(3));
    this.mp4segments.push(data.moof);
    this.mp4segments.push(data.mdat);
    //trigger handler right now
    this.tick();
  }

  onFragmentParsed() {
      this.state = PARSED;
      this.stats.tparsed = new Date();
    //trigger handler right now
    this.tick();
  }

  onSourceBufferUpdateEnd() {
    //trigger handler right now
    if(this.state === APPENDING && this.mp4segments.length === 0)  {
      this.stats.tbuffered = new Date();
      observer.trigger(Event.FRAG_BUFFERED, { stats : this.stats, frag : this.frag});
      this.state = IDLE;
    }
    this.tick();
  }

  onSourceBufferError(event) {
      logger.log(' buffer append error:' + event);
  }
}

export default BufferController;
