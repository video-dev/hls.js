/*
 * buffer controller
 *
 */

 import Event                from '../events';
 import FragmentLoader       from '../loader/fragment-loader';
 import observer             from '../observer';
 import {logger}             from '../utils/logger';
 import Demuxer              from '../demux/demuxer';

  const STARTING = -1;
  const IDLE = 0;
  const LOADING =  1;
  const WAITING_LEVEL = 2;
  const PARSING = 3;
  const PARSED = 4;
  const APPENDING = 5;
  const BUFFER_FLUSHING = 6;

 class BufferController {

  constructor(levelController) {
    this.levelController = levelController;
    this.fragmentLoader = new FragmentLoader();
    this.mp4segments = [];
    this.bufferRange = [];
    // Source Buffer listeners
    this.onsbue = this.onSourceBufferUpdateEnd.bind(this);
    this.onsbe  = this.onSourceBufferError.bind(this);
    // internal listeners
    this.onmse = this.onMSEAttached.bind(this);
    this.onmp = this.onManifestParsed.bind(this);
    this.onll = this.onLevelLoaded.bind(this);
    this.onfl = this.onFragmentLoaded.bind(this);
    this.onis = this.onInitSegment.bind(this);
    this.onfpg = this.onFragmentParsing.bind(this);
    this.onfp = this.onFragmentParsed.bind(this);
    this.ontick = this.tick.bind(this);
    observer.on(Event.MSE_ATTACHED, this.onmse);
    observer.on(Event.MANIFEST_PARSED, this.onmp);
    this.demuxer = new Demuxer();
  }
  destroy() {
    this.stop();
    this.fragmentLoader.destroy();
    if(this.demuxer) {
      this.demuxer.destroy();
      this.demuxer = null;
    }
    this.mp4segments = [];
    this.bufferRange = [];
    var sb = this.sourceBuffer;
    if(sb) {
      if(sb.audio) {
          //detach sourcebuffer from Media Source
          this.mediaSource.removeSourceBuffer(sb.audio);
          sb.audio.removeEventListener('updateend', this.onsbue);
          sb.audio.removeEventListener('error', this.onsbe);
      }
      if(sb.video) {
          //detach sourcebuffer from Media Source
          this.mediaSource.removeSourceBuffer(sb.video);
          sb.video.removeEventListener('updateend', this.onsbue);
          sb.video.removeEventListener('error', this.onsbe);
      }
      this.sourceBuffer = null;
    }
    observer.removeListener(Event.MANIFEST_PARSED, this.onmp);
    // remove video listener
    if(this.video) {
      this.video.removeEventListener('seeking',this.onvseeking);
      this.video.removeEventListener('seeked',this.onvseeked);
      this.video.removeEventListener('loadedmetadata',this.onvmetadata);
      this.onvseeking = this.onvseeked = this.onvmetadata = null;
    }

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
    this.state = STARTING;
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
    var pos,loadLevel,loadLevelDetails,fragIdx;
    switch(this.state) {
      case STARTING:
        // determine load level
        this.startLevel = this.levelController.startLevel;
        if (this.startLevel === -1) {
          // -1 : guess start Level by doing a bitrate test by loading first fragment of lowest quality level
          this.startLevel = 0;
          this.fragmentBitrateTest = true;
        }
        // set new level to playlist loader : this will trigger start level load
        this.levelController.level = this.startLevel;
        this.state = WAITING_LEVEL;
        this.loadedmetadata = false;
        break;
      case IDLE:
        // determine next candidate fragment to be loaded, based on current position and
        //  end of buffer position
        //  ensure 60s of buffer upfront
        // if we have not yet loaded any fragment, start loading from start position
        if(this.loadedmetadata) {
          pos = this.video.currentTime;
        } else {
          pos = this.nextLoadPosition;
        }
        // determine next load level
        if(this.startFragmentLoaded === false) {
          loadLevel = this.startLevel;
        } else {
          // we are not at playback start, get next load level from level Controller
          loadLevel = this.levelController.nextLevel();
        }
        var bufferInfo = this.bufferInfo(pos), bufferLen = bufferInfo.len, bufferEnd = bufferInfo.end;
        // compute max Buffer Length that we could get from this load level, based on level bitrate. don't buffer more than 60 MB and more than 30s
        var maxBufLen = Math.min(8*60*1000*1000/this.levels[loadLevel].bitrate,30);
        // if buffer length is less than maxBufLen try to load a new fragment
        if(bufferLen < maxBufLen) {
          if(loadLevel !== this.level) {
            // set new level to playlist loader : this will trigger a playlist load if needed
            this.levelController.level = loadLevel;
            // tell demuxer that we will switch level (this will force init segment to be regenerated)
            if (this.demuxer) {
              this.demuxer.switchLevel();
            }
          }
          loadLevelDetails = this.levels[loadLevel].details;
          // if level details retrieved yet, switch state and wait for level retrieval
          if(typeof loadLevelDetails === 'undefined') {
            this.state = WAITING_LEVEL;
            break;
          }
          // find fragment index, contiguous with end of buffer position
          var fragments = loadLevelDetails.fragments, frag, sliding = loadLevelDetails.sliding, start = fragments[0].start + sliding;
          // check if requested position is within seekable boundaries :
          // in case of live playlist we need to ensure that requested position is not located before playlist start
          if(bufferEnd < start) {
            logger.log('requested position:' + bufferEnd + ' is before start of playlist, reset video position to start:' + start);
            this.video.currentTime = start + 0.01;
            break;
          }
          // if one buffer range, load next SN
          if(bufferLen > 0 && this.video.buffered.length === 1) {
            fragIdx = this.frag.sn + 1 - fragments[0].sn;
            if(fragIdx >= fragments.length) {
              // most certainly live playlist is outdated, let's move to WAITING LEVEL state and come back once it will have been refreshed
              //logger.log('sn ' + (this.frag.sn + 1) + ' out of range, wait for live playlist update');
              this.state = WAITING_LEVEL;
              break;
            }
            frag = fragments[fragIdx];
          } else {
            // no data buffered, or multiple buffer range look for fragments matching with current play position
            for (fragIdx = 0; fragIdx < fragments.length ; fragIdx++) {
              frag = fragments[fragIdx];
              start = frag.start+sliding;
              // offset should be within fragment boundary
              if(start <= bufferEnd && (start + frag.duration) > bufferEnd) {
                break;
              }
            }
            //logger.log('find SN matching with pos:' +  bufferEnd + ':' + frag.sn);
          }
          if(fragIdx >= 0 && fragIdx < fragments.length) {
            if(this.frag && frag.sn === this.frag.sn) {
              if(fragIdx === (fragments.length -1)) {
                // we are at the end of the playlist and we already loaded last fragment, don't do anything
                break;
              } else {
                frag = fragments[fragIdx+1];
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
        break;
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
          if((this.sourceBuffer.audio && this.sourceBuffer.audio.updating) ||
             (this.sourceBuffer.video && this.sourceBuffer.video.updating)) {
            //logger.log('sb append in progress');
        // check if any MP4 segments left to append
          } else if(this.mp4segments.length) {
            var segment = this.mp4segments.shift();
            this.sourceBuffer[segment.type].appendBuffer(segment.data);
            this.state = APPENDING;
          }
        }
        break;
      case BUFFER_FLUSHING:
        // flushBuffer will abort any buffer append in progress and flush Audio/Video Buffer
        if(this.flushBuffer()) {
          // move to IDLE once flush complete. this should trigger new fragment loading
          this.state = IDLE;
        } // otherwise stay in BUFFER_FLUSHING state. we will come back here each time sourceBuffer updateend() callback will be triggered
        break;
      default:
        break;
    }
    // check/update current fragment
    this._checkFragmentChanged();
  }

   bufferInfo(pos) {
    var v = this.video,
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


  getFragment(position) {
    var i,range;
    for (i = this.bufferRange.length-1; i >=0 ; i--) {
      range = this.bufferRange[i];
      if(position >= range.start && position <= range.end) {
        return range.frag;
      }
    }
    return null;
  }


  get currentLevel() {
    if(this.video) {
      var frag = this.getFragment(this.video.currentTime);
      if(frag) {
        return frag.level;
      }
    }
    return -1;
  }

  isBuffered(position) {
    var v = this.video,buffered = v.buffered;
    for(var i = 0 ; i < buffered.length ; i++) {
      if(position >= buffered.start(i) && position <= buffered.end(i)) {
        return true;
      }
    }
    return false;
  }

  _checkFragmentChanged() {
    var fragCurrent;
    if(this.video && this.video.seeking === false && this.isBuffered(this.video.currentTime)) {
      fragCurrent = this.getFragment(this.video.currentTime);
    }

    if(fragCurrent && fragCurrent !== this.fragCurrent) {
      this.fragCurrent = fragCurrent;
      observer.trigger(Event.FRAG_CHANGED, { frag : fragCurrent });
    }
  }


/*
  abort any buffer append in progress, and flush all buffered data
  return true once everything has been flushed.
  sourceBuffer.abort() and sourceBuffer.remove() are asynchronous operations
  the idea is to call this function from tick() timer and call it again until all resources have been cleaned
  the timer is rearmed upon sourceBuffer updateend() event, so this should be optimal
*/
  flushBuffer() {
    var sb,i,start,end;
    if(this.sourceBuffer) {
      for(var type in this.sourceBuffer) {
        sb = this.sourceBuffer[type];
        if(!sb.updating) {
          for(i = 0 ; i < sb.buffered.length ; i++) {
            start = sb.buffered.start(i);
            end = sb.buffered.end(i);
            logger.log('flush ' + type + ' [' + start + ',' + end + ']');
            sb.remove(start,end);
            return false;
          }
        } else {
            logger.log('abort ' + type + ' append in progress');
          // this will abort any appending in progress
          sb.abort();
          return false;
        }
      }
    }
    this.bufferRange = [];
    logger.log('buffer flushed');
    // everything flushed !
    return true;
  }

    /*
      on immediate level switch :
       - pause playback if playing
       - cancel any pending load request
       - and trigger a buffer flush
    */
  immediateLevelSwitch() {
    if(!this.immediateSwitch) {
      this.immediateSwitch = true;
      this.previouslyPaused = this.video.paused;
      this.video.pause();
    }
    this.fragmentLoader.abort();
    // trigger a sourceBuffer flush
    this.state = BUFFER_FLUSHING;
    // speed up switching, trigger timer function
    this.tick();
  }

/*
   on immediate level switch end, after new fragment has been buffered :
    - nudge video decoder by slightly adjusting video currentTime
    - resume the playback if needed
*/
  immediateLevelSwitchEnd() {
    this.immediateSwitch = false;
    this.video.currentTime-=0.0001;
    if(!this.previouslyPaused) {
      this.video.play();
    }
  }

  onMSEAttached(event,data) {
    this.video = data.video;
    this.mediaSource = data.mediaSource;
    this.onvseeking = this.onVideoSeeking.bind(this);
    this.onvseeked = this.onVideoSeeked.bind(this);
    this.onvmetadata = this.onVideoMetadata.bind(this);
    this.video.addEventListener('seeking',this.onvseeking);
    this.video.addEventListener('seeked',this.onvseeked);
    this.video.addEventListener('loadedmetadata',this.onvmetadata);
    if(this.levels) {
      this.start();
    }
  }
  onVideoSeeking() {
    if(this.state === LOADING) {
      // check if currently loaded fragment is inside buffer.
      //if outside, cancel fragment loading, otherwise do nothing
      if(this.bufferInfo(this.video.currentTime).len === 0) {
        logger.log('seeking outside of buffer while fragment load in progress, cancel fragment load');
        this.fragmentLoader.abort();
        this.state = IDLE;
      }
    }
    // tick to speed up processing
    this.tick();
  }

  onVideoSeeked() {
    // tick to speed up FRAGMENT_PLAYING triggering
    this.tick();
  }

  onVideoMetadata() {
      if(this.video.currentTime !== this.startPosition) {
        this.video.currentTime = this.startPosition;
    }
    this.loadedmetadata = true;
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
    if(this.video) {
      this.start();
    }
  }

  onLevelLoaded(event,data) {
    var fragments = data.details.fragments,duration = data.details.totalduration;
    logger.log('level ' + data.levelId + ' loaded [' + fragments[0].sn + ',' + fragments[fragments.length-1].sn + '],duration:' + duration);

    var level = this.levels[data.levelId],sliding = 0, levelCurrent = this.levels[this.level];
    // check if playlist is already loaded (if yes, it should be a live playlist)
    if(levelCurrent && levelCurrent.details && levelCurrent.details.live) {
      //  playlist sliding is the sum of : current playlist sliding + sliding of new playlist compared to current one
      sliding = levelCurrent.details.sliding;
      // check sliding of updated playlist against current one :
      // and find its position in current playlist
      //logger.log("fragments[0].sn/this.level/levelCurrent.details.fragments[0].sn:" + fragments[0].sn + "/" + this.level + "/" + levelCurrent.details.fragments[0].sn);
      var SNdiff = fragments[0].sn - levelCurrent.details.fragments[0].sn;
      if(SNdiff >=0) {
        // positive sliding : new playlist sliding window is after previous one
        sliding += levelCurrent.details.fragments[SNdiff].start;
      } else {
        // negative sliding: new playlist sliding window is before previous one
        sliding -= fragments[-SNdiff].start;
      }
      logger.log('live playlist sliding:' + sliding.toFixed(3));
    }
    // override level info
    level.details = data.details;
    level.details.sliding = sliding;
    this.demuxer.setDuration(duration);
    if(this.startLevelLoaded === false) {
      // if live playlist, set start position to be fragment N-3
      if(data.details.live) {
        this.startPosition = Math.max(0,duration - 3 * data.details.targetduration);
      } else {
        this.startPosition = 0;
      }
      this.nextLoadPosition = this.startPosition;
      this.startLevelLoaded = true;
    }
    // only switch batck to IDLE state if we were waiting for level to start downloading a new fragment
    if(this.state === WAITING_LEVEL) {
      this.state = IDLE;
    }
    //trigger handler right now
    this.tick();
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
        this.demuxer.push(data.payload,this.levels[this.level].audioCodec,this.levels[this.level].videoCodec,this.frag.start);
      }
      this.startFragmentLoaded = true;
    }
  }

  onInitSegment(event,data) {
    // check if codecs have been explicitely defined in the master playlist for this level;
    // if yes use these ones instead of the ones parsed from the demux
    var audioCodec = this.levels[this.level].audioCodec, videoCodec = this.levels[this.level].videoCodec,sb;
    //logger.log('playlist level A/V codecs:' + audioCodec + ',' + videoCodec);
    //logger.log('playlist codecs:' + codec);
    // if playlist does not specify codecs, use codecs found while parsing fragment
    if(audioCodec === undefined) {
      audioCodec = data.audioCodec;
    }
    if(videoCodec === undefined) {
      videoCodec = data.videoCodec;
    }

    // codec="mp4a.40.5,avc1.420016";
    // in case several audio codecs might be used, force HE-AAC for audio (some browsers don't support audio codec switch)
    //don't do it for mono streams ...
    if(this.audiocodecswitch && data.audioChannelCount === 2 && navigator.userAgent.toLowerCase().indexOf('android') === -1 && navigator.userAgent.toLowerCase().indexOf('firefox') === -1) {
      audioCodec = 'mp4a.40.5';
    }
    if(!this.sourceBuffer) {
      this.sourceBuffer = {};
      logger.log('selected A/V codecs for sourceBuffers:' + audioCodec + ',' + videoCodec);
      // create source Buffer and link them to MediaSource
      if(audioCodec) {
        sb = this.sourceBuffer.audio = this.mediaSource.addSourceBuffer('video/mp4;codecs=' + audioCodec);
        sb.addEventListener('updateend', this.onsbue);
        sb.addEventListener('error', this.onsbe);
      }
      if(videoCodec) {
        sb = this.sourceBuffer.video = this.mediaSource.addSourceBuffer('video/mp4;codecs=' + videoCodec);
        sb.addEventListener('updateend', this.onsbue);
        sb.addEventListener('error', this.onsbe);
      }
    }
    if(audioCodec) {
      this.mp4segments.push({ type : 'audio', data : data.audioMoov});
    }
    if(videoCodec) {
      this.mp4segments.push({ type : 'video', data : data.videoMoov});
    }
    //trigger handler right now
    this.tick();
  }

  onFragmentParsing(event,data) {
    this.tparse2 = Date.now();
    var level = this.levels[this.level];
    if(level.details.live) {
      level.details.sliding = data.startPTS - this.frag.start;
    }
    logger.log('      parsed data, type/startPTS/endPTS/startDTS/endDTS/sliding:' + data.type + '/' + data.startPTS.toFixed(3) + '/' + data.endPTS.toFixed(3) + '/' + data.startDTS.toFixed(3) + '/' + data.endDTS.toFixed(3) + '/' + level.details.sliding.toFixed(3));
    this.mp4segments.push({ type : data.type, data : data.moof});
    this.mp4segments.push({ type : data.type, data : data.mdat});
    this.nextLoadPosition = data.endPTS;
    this.bufferRange.push({type : data.type, start : data.startPTS, end : data.endPTS, frag : this.frag});
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

      if(this.immediateSwitch) {
        this.immediateLevelSwitchEnd();
      }
    }
    this.tick();
  }

  onSourceBufferError(event) {
      logger.log(' buffer append error:' + event);
  }
}

export default BufferController;
