/*
 * Stream Controller
*/

import Demuxer from '../demux/demuxer';
import Event from '../events';
import EventHandler from '../event-handler';
import {logger} from '../utils/logger';
import BinarySearch from '../utils/binary-search';
import BufferHelper from '../helper/buffer-helper';
import LevelHelper from '../helper/level-helper';
import {ErrorTypes, ErrorDetails} from '../errors';

const State = {
  STOPPED : 'STOPPED',
  STARTING : 'STARTING',
  IDLE : 'IDLE',
  PAUSED : 'PAUSED',
  KEY_LOADING : 'KEY_LOADING',
  FRAG_LOADING : 'FRAG_LOADING',
  FRAG_LOADING_WAITING_RETRY : 'FRAG_LOADING_WAITING_RETRY',
  WAITING_LEVEL : 'WAITING_LEVEL',
  PARSING : 'PARSING',
  PARSED : 'PARSED',
  ENDED : 'ENDED',
  ERROR : 'ERROR'
};

class StreamController extends EventHandler {

  constructor(hls) {
    super(hls,
      Event.MEDIA_ATTACHED,
      Event.MEDIA_DETACHING,
      Event.MANIFEST_LOADING,
      Event.MANIFEST_PARSED,
      Event.LEVEL_LOADED,
      Event.KEY_LOADED,
      Event.FRAG_LOADED,
      Event.FRAG_LOAD_EMERGENCY_ABORTED,
      Event.FRAG_PARSING_INIT_SEGMENT,
      Event.FRAG_PARSING_DATA,
      Event.FRAG_PARSED,
      Event.ERROR,
      Event.BUFFER_APPENDED,
      Event.BUFFER_FLUSHED);

    this.config = hls.config;
    this.audioCodecSwap = false;
    this.ticks = 0;
    this.ontick = this.tick.bind(this);
  }

  destroy() {
    this.stopLoad();
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    EventHandler.prototype.destroy.call(this);
    this.state = State.STOPPED;
  }

  startLoad(startPosition) {
    if (this.levels) {
      var media = this.media, lastCurrentTime = this.lastCurrentTime;
      this.stopLoad();
      this.demuxer = new Demuxer(this.hls);
      if (!this.timer) {
        this.timer = setInterval(this.ontick, 100);
      }
      this.level = -1;
      this.fragLoadError = 0;
      if (media && lastCurrentTime > 0) {
        logger.log(`configure startPosition @${lastCurrentTime}`);
        if (!this.lastPaused) {
          logger.log('resuming video');
          media.play();
        }
        this.state = State.IDLE;
      } else {
        this.lastCurrentTime = this.startPosition ? this.startPosition : startPosition;
        this.state = State.STARTING;
      }
      this.nextLoadPosition = this.startPosition = this.lastCurrentTime;
      this.tick();
    } else {
      logger.warn('cannot start loading as manifest not parsed yet');
      this.state = State.STOPPED;
    }
  }

  stopLoad() {
    var frag = this.fragCurrent;
    if (frag) {
      if (frag.loader) {
        frag.loader.abort();
      }
      this.fragCurrent = null;
    }
    this.fragPrevious = null;
    if (this.demuxer) {
      this.demuxer.destroy();
      this.demuxer = null;
    }
    this.state = State.STOPPED;
  }

  tick() {
    this.ticks++;
    if (this.ticks === 1) {
      this.doTick();
      if (this.ticks > 1) {
        setTimeout(this.tick, 1);
      }
      this.ticks = 0;
    }
  }

  doTick() {
    var pos, level, levelDetails, hls = this.hls, config = hls.config, media = this.media, isSeeking = media && media.seeking;
    //logger.log(this.state);
    switch(this.state) {
      case State.ERROR:
        //don't do anything in error state to avoid breaking further ...
      case State.PAUSED:
        //don't do anything in paused state either ...
        break;
      case State.STARTING:
        // determine load level
        let startLevel = hls.startLevel;
        if (startLevel === -1) {
          // -1 : guess start Level by doing a bitrate test by loading first fragment of lowest quality level
          startLevel = 0;
          this.fragBitrateTest = true;
        }
        // set new level to playlist loader : this will trigger start level load
        // hls.nextLoadLevel remains until it is set to a new value or until a new frag is successfully loaded
        this.level = hls.nextLoadLevel = startLevel;
        this.state = State.WAITING_LEVEL;
        this.loadedmetadata = false;
        break;
      case State.IDLE:
        // if video not attached AND
        // start fragment already requested OR start frag prefetch disable
        // exit loop
        // => if media not attached but start frag prefetch is enabled and start frag not requested yet, we will not exit loop
        if (!media &&
          (this.startFragRequested || !config.startFragPrefetch)) {
          break;
        }
        // determine next candidate fragment to be loaded, based on current position and
        //  end of buffer position
        //  ensure 60s of buffer upfront
        // if we have not yet loaded any fragment, start loading from start position
        if (this.loadedmetadata) {
          pos = media.currentTime;
        } else {
          pos = this.nextLoadPosition;
        }
        level = hls.nextLoadLevel;
        var bufferInfo = BufferHelper.bufferInfo(media,pos,config.maxBufferHole),
            bufferLen = bufferInfo.len,
            bufferEnd = bufferInfo.end,
            fragPrevious = this.fragPrevious,
            maxBufLen;
        // compute max Buffer Length that we could get from this load level, based on level bitrate. don't buffer more than 60 MB and more than 30s
        if ((this.levels[level]).hasOwnProperty('bitrate')) {
          maxBufLen = Math.max(8 * config.maxBufferSize / this.levels[level].bitrate, config.maxBufferLength);
          maxBufLen = Math.min(maxBufLen, config.maxMaxBufferLength);
        } else {
          maxBufLen = config.maxBufferLength;
        }
        // if buffer length is less than maxBufLen try to load a new fragment
        if (bufferLen < maxBufLen) {
          // set next load level : this will trigger a playlist load if needed
          hls.nextLoadLevel = level;
          this.level = level;
          levelDetails = this.levels[level].details;
          // if level info not retrieved yet, switch state and wait for level retrieval
          // if live playlist, ensure that new playlist has been refreshed to avoid loading/try to load
          // a useless and outdated fragment (that might even introduce load error if it is already out of the live playlist)
          if (typeof levelDetails === 'undefined' || levelDetails.live && this.levelLastLoaded !== level) {
            this.state = State.WAITING_LEVEL;
            break;
          }

          // DO NOT try to load a new fragment if we just got done loading the final fragment.
          if (!levelDetails.live && !isSeeking && fragPrevious && fragPrevious.sn === levelDetails.endSN) {
            // Finalize the media stream
            this.hls.trigger(Event.BUFFER_EOS);
            this.state = State.ENDED;
            break;
          }

          // find fragment index, contiguous with end of buffer position
          let fragments = levelDetails.fragments,
              fragLen = fragments.length,
              start = fragments[0].start,
              end = fragments[fragLen-1].start + fragments[fragLen-1].duration,
              frag;

            // in case of live playlist we need to ensure that requested position is not located before playlist start
          if (levelDetails.live) {
            // check if requested position is within seekable boundaries :
            //logger.log(`start/pos/bufEnd/seeking:${start.toFixed(3)}/${pos.toFixed(3)}/${bufferEnd.toFixed(3)}/${media.seeking}`);
            let maxLatency = config.liveMaxLatencyDuration !== undefined ? config.liveMaxLatencyDuration : config.liveMaxLatencyDurationCount*levelDetails.targetduration;

            if (bufferEnd < Math.max(start, end - maxLatency)) {
                let targetLatency = config.liveSyncDuration !== undefined ? config.liveSyncDuration : config.liveSyncDurationCount * levelDetails.targetduration;
                let liveSyncPosition = start + Math.max(0, levelDetails.totalduration - targetLatency);
                logger.log(`buffer end: ${bufferEnd} is located too far from the end of live sliding playlist, reset currentTime to : ${liveSyncPosition.toFixed(3)}`);
                bufferEnd = liveSyncPosition;
                if (media && media.readyState && media.duration > liveSyncPosition) {
                  media.currentTime = liveSyncPosition;
                }
            }

            // if end of buffer greater than live edge, don't load any fragment
            // this could happen if live playlist intermittently slides in the past.
            // level 1 loaded [182580161,182580167]
            // level 1 loaded [182580162,182580169]
            // Loading 182580168 of [182580162 ,182580169],level 1 ..
            // Loading 182580169 of [182580162 ,182580169],level 1 ..
            // level 1 loaded [182580162,182580168] <============= here we should have bufferEnd > end. in that case break to avoid reloading 182580168
            // level 1 loaded [182580164,182580171]
            //
            if (levelDetails.PTSKnown && bufferEnd > end) {
              break;
            }

            if (this.startFragRequested && !levelDetails.PTSKnown) {
              /* we are switching level on live playlist, but we don't have any PTS info for that quality level ...
                 try to load frag matching with next SN.
                 even if SN are not synchronized between playlists, loading this frag will help us
                 compute playlist sliding and find the right one after in case it was not the right consecutive one */
              if (fragPrevious) {
                var targetSN = fragPrevious.sn + 1;
                if (targetSN >= levelDetails.startSN && targetSN <= levelDetails.endSN) {
                  frag = fragments[targetSN - levelDetails.startSN];
                  logger.log(`live playlist, switching playlist, load frag with next SN: ${frag.sn}`);
                }
              }
              if (!frag) {
                /* we have no idea about which fragment should be loaded.
                   so let's load mid fragment. it will help computing playlist sliding and find the right one
                */
                frag = fragments[Math.min(fragLen - 1, Math.round(fragLen / 2))];
                logger.log(`live playlist, switching playlist, unknown, load middle frag : ${frag.sn}`);
              }
            }
          } else {
            // VoD playlist: if bufferEnd before start of playlist, load first fragment
            if (bufferEnd < start) {
              frag = fragments[0];
            }
          }
          if (!frag) {
            let maxFragLookUpTolerance = config.maxFragLookUpTolerance;
            if (bufferEnd < end) {
              // no frag look up tolerance in case bufferEnd close to end, or media seeking
              if (bufferEnd > end - maxFragLookUpTolerance || isSeeking) {
                maxFragLookUpTolerance = 0;
              }
              frag = BinarySearch.search(fragments, (candidate) => {
                // offset should be within fragment boundary - config.maxFragLookUpTolerance
                // this is to cope with situations like
                // bufferEnd = 9.991
                // frag[Ø] : [0,10]
                // frag[1] : [10,20]
                // bufferEnd is within frag[0] range ... although what we are expecting is to return frag[1] here
                    //              frag start               frag start+duration
                    //                  |-----------------------------|
                    //              <--->                         <--->
                    //  ...--------><-----------------------------><---------....
                    // previous frag         matching fragment         next frag
                    //  return -1             return 0                 return 1
                //logger.log(`level/sn/start/end/bufEnd:${level}/${candidate.sn}/${candidate.start}/${(candidate.start+candidate.duration)}/${bufferEnd}`);
                if ((candidate.start + candidate.duration - maxFragLookUpTolerance) <= bufferEnd) {
                  return 1;
                }
                else if (candidate.start - maxFragLookUpTolerance > bufferEnd) {
                  return -1;
                }
                return 0;
              });
            } else {
              // reach end of playlist
              frag = fragments[fragLen-1];
            }
          }
          if(frag) {
            start = frag.start;
            //logger.log('find SN matching with pos:' +  bufferEnd + ':' + frag.sn);
            if (fragPrevious && frag.level === fragPrevious.level && frag.sn === fragPrevious.sn) {
              if (frag.sn < levelDetails.endSN) {
                let deltaPTS = fragPrevious.deltaPTS,
                    curSNIdx = frag.sn - levelDetails.startSN;
                // if there is a significant delta between audio and video, larger than max allowed hole,
                // and if previous remuxed fragment did not start with a keyframe. (fragPrevious.dropped)
                // let's try to load previous fragment again to get last keyframe
                // then we will reload again current fragment (that way we should be able to fill the buffer hole ...)
                if (deltaPTS && deltaPTS > config.maxBufferHole && fragPrevious.dropped) {
                  frag = fragments[curSNIdx-1];
                  logger.warn(`SN just loaded, with large PTS gap between audio and video, maybe frag is not starting with a keyframe ? load previous one to try to overcome this`);
                  // decrement previous frag load counter to avoid frag loop loading error when next fragment will get reloaded
                  fragPrevious.loadCounter--;
                } else {
                  frag = fragments[curSNIdx+1];
                  logger.log(`SN just loaded, load next one: ${frag.sn}`);
                }
                // ensure frag is not undefined
                if(!frag) {
                  break;
                }
              } else {
                // have we reached end of VOD playlist ?
                if (!levelDetails.live) {
                  // Finalize the media stream
                  this.hls.trigger(Event.BUFFER_EOS);
                  // We might be loading the last fragment but actually the media
                  // is currently processing a seek command and waiting for new data to resume at another point.
                  // Going to ended state while media is seeking can spawn an infinite buffering broken state.
                  if (!isSeeking) {
                    this.state = State.ENDED;
                  }
                }
                break;
              }
            }
            //logger.log('      loading frag ' + i +',pos/bufEnd:' + pos.toFixed(3) + '/' + bufferEnd.toFixed(3));
            if ((frag.decryptdata.uri != null) && (frag.decryptdata.key == null)) {
              logger.log(`Loading key for ${frag.sn} of [${levelDetails.startSN} ,${levelDetails.endSN}],level ${level}`);
              this.state = State.KEY_LOADING;
              hls.trigger(Event.KEY_LOADING, {frag: frag});
            } else {
              logger.log(`Loading ${frag.sn} of [${levelDetails.startSN} ,${levelDetails.endSN}],level ${level}, currentTime:${pos},bufferEnd:${bufferEnd.toFixed(3)}`);
              // ensure that we are not reloading the same fragments in loop ...
              if (this.fragLoadIdx !== undefined) {
                this.fragLoadIdx++;
              } else {
                this.fragLoadIdx = 0;
              }
              if (frag.loadCounter) {
                frag.loadCounter++;
                let maxThreshold = config.fragLoadingLoopThreshold;
                // if this frag has already been loaded 3 times, and if it has been reloaded recently
                if (frag.loadCounter > maxThreshold && (Math.abs(this.fragLoadIdx - frag.loadIdx) < maxThreshold)) {
                  hls.trigger(Event.ERROR, {type: ErrorTypes.MEDIA_ERROR, details: ErrorDetails.FRAG_LOOP_LOADING_ERROR, fatal: false, frag: frag});
                  return;
                }
              } else {
                frag.loadCounter = 1;
              }
              frag.loadIdx = this.fragLoadIdx;
              this.fragCurrent = frag;
              this.startFragRequested = true;
              frag.autoLevel = hls.autoLevelEnabled;
              hls.trigger(Event.FRAG_LOADING, {frag: frag});
              this.state = State.FRAG_LOADING;
            }
          }
        }
        break;
      case State.WAITING_LEVEL:
        level = this.levels[this.level];
        // check if playlist is already loaded
        if (level && level.details) {
          this.state = State.IDLE;
        }
        break;
      case State.FRAG_LOADING_WAITING_RETRY:
        var now = performance.now();
        var retryDate = this.retryDate;
        // if current time is gt than retryDate, or if media seeking let's switch to IDLE state to retry loading
        if(!retryDate || (now >= retryDate) || isSeeking) {
          logger.log(`mediaController: retryDate reached, switch back to IDLE state`);
          this.state = State.IDLE;
        }
        break;
      case State.STOPPED:
      case State.FRAG_LOADING:
      case State.PARSING:
      case State.PARSED:
      case State.ENDED:
        break;
      default:
        break;
    }
    // check buffer
    this._checkBuffer();
    // check/update current fragment
    this._checkFragmentChanged();
  }




  getBufferRange(position) {
    var i, range,
        bufferRange = this.bufferRange;
    if (bufferRange) {
      for (i = bufferRange.length - 1; i >=0; i--) {
        range = bufferRange[i];
        if (position >= range.start && position <= range.end) {
          return range;
        }
      }
    }
    return null;
  }

  get currentLevel() {
    if (this.media) {
      var range = this.getBufferRange(this.media.currentTime);
      if (range) {
        return range.frag.level;
      }
    }
    return -1;
  }

  get nextBufferRange() {
    if (this.media) {
      // first get end range of current fragment
      return this.followingBufferRange(this.getBufferRange(this.media.currentTime));
    } else {
      return null;
    }
  }

  followingBufferRange(range) {
    if (range) {
      // try to get range of next fragment (500ms after this range)
      return this.getBufferRange(range.end + 0.5);
    }
    return null;
  }

  get nextLevel() {
    var range = this.nextBufferRange;
    if (range) {
      return range.frag.level;
    } else {
      return -1;
    }
  }

  isBuffered(position) {
    let media = this.media;
    if (media) {
      let buffered = media.buffered;
      for (let i = 0; i < buffered.length; i++) {
        if (position >= buffered.start(i) && position <= buffered.end(i)) {
          return true;
        }
      }
    }
    return false;
  }

  _checkFragmentChanged() {
    var rangeCurrent, currentTime, video = this.media;
    if (video && video.seeking === false) {
      currentTime = video.currentTime;
      /* if video element is in seeked state, currentTime can only increase.
        (assuming that playback rate is positive ...)
        As sometimes currentTime jumps back to zero after a
        media decode error, check this, to avoid seeking back to
        wrong position after a media decode error
      */
      if(currentTime > video.playbackRate*this.lastCurrentTime) {
        this.lastCurrentTime = currentTime;
      }
      if (this.isBuffered(currentTime)) {
        rangeCurrent = this.getBufferRange(currentTime);
      } else if (this.isBuffered(currentTime + 0.1)) {
        /* ensure that FRAG_CHANGED event is triggered at startup,
          when first video frame is displayed and playback is paused.
          add a tolerance of 100ms, in case current position is not buffered,
          check if current pos+100ms is buffered and use that buffer range
          for FRAG_CHANGED event reporting */
        rangeCurrent = this.getBufferRange(currentTime + 0.1);
      }
      if (rangeCurrent) {
        var fragPlaying = rangeCurrent.frag;
        if (fragPlaying !== this.fragPlaying) {
          this.fragPlaying = fragPlaying;
          this.hls.trigger(Event.FRAG_CHANGED, {frag: fragPlaying});
        }
      }
    }
  }

  /*
    on immediate level switch :
     - pause playback if playing
     - cancel any pending load request
     - and trigger a buffer flush
  */
  immediateLevelSwitch() {
    logger.log('immediateLevelSwitch');
    if (!this.immediateSwitch) {
      this.immediateSwitch = true;
      let media = this.media, previouslyPaused;
      if (media) {
        previouslyPaused = media.paused;
        media.pause();
      } else {
        // don't restart playback after instant level switch in case media not attached
        previouslyPaused = true;
      }
      this.previouslyPaused = previouslyPaused;
    }
    var fragCurrent = this.fragCurrent;
    if (fragCurrent && fragCurrent.loader) {
      fragCurrent.loader.abort();
    }
    this.fragCurrent = null;
    // increase fragment load Index to avoid frag loop loading error after buffer flush
    this.fragLoadIdx += 2 * this.config.fragLoadingLoopThreshold;
    this.state = State.PAUSED;
    // flush everything
    this.hls.trigger(Event.BUFFER_FLUSHING, {startOffset: 0, endOffset: Number.POSITIVE_INFINITY});
  }

  /*
     on immediate level switch end, after new fragment has been buffered :
      - nudge video decoder by slightly adjusting video currentTime
      - resume the playback if needed
  */
  immediateLevelSwitchEnd() {
    this.immediateSwitch = false;
    let media = this.media;
    if (media && media.readyState) {
      media.currentTime -= 0.0001;
      if (!this.previouslyPaused) {
        media.play();
      }
    }
  }

  nextLevelSwitch() {
    /* try to switch ASAP without breaking video playback :
       in order to ensure smooth but quick level switching,
      we need to find the next flushable buffer range
      we should take into account new segment fetch time
    */
    let media = this.media;
    // ensure that media is defined and that metadata are available (to retrieve currentTime)
    if (media && media.readyState) {
      let fetchdelay, currentRange, nextRange;
      // increase fragment load Index to avoid frag loop loading error after buffer flush
      this.fragLoadIdx += 2 * this.config.fragLoadingLoopThreshold;
      currentRange = this.getBufferRange(media.currentTime);
      if (currentRange && currentRange.start > 1) {
      // flush buffer preceding current fragment (flush until current fragment start offset)
      // minus 1s to avoid video freezing, that could happen if we flush keyframe of current video ...
        this.state = State.PAUSED;
        this.hls.trigger(Event.BUFFER_FLUSHING, {startOffset: 0, endOffset: currentRange.start - 1});
      }
      if (!media.paused) {
        // add a safety delay of 1s
        var nextLevelId = this.hls.nextLoadLevel,nextLevel = this.levels[nextLevelId], fragLastKbps = this.fragLastKbps;
        if (fragLastKbps && this.fragCurrent) {
          fetchdelay = this.fragCurrent.duration * nextLevel.bitrate / (1000 * fragLastKbps) + 1;
        } else {
          fetchdelay = 0;
        }
      } else {
        fetchdelay = 0;
      }
      //logger.log('fetchdelay:'+fetchdelay);
      // find buffer range that will be reached once new fragment will be fetched
      nextRange = this.getBufferRange(media.currentTime + fetchdelay);
      if (nextRange) {
        // we can flush buffer range following this one without stalling playback
        nextRange = this.followingBufferRange(nextRange);
        if (nextRange) {
          // if we are here, we can also cancel any loading/demuxing in progress, as they are useless
          var fragCurrent = this.fragCurrent;
          if (fragCurrent && fragCurrent.loader) {
            fragCurrent.loader.abort();
          }
          this.fragCurrent = null;
          // flush position is the start position of this new buffer
          this.state = State.PAUSED;
          this.hls.trigger(Event.BUFFER_FLUSHING, {startOffset: nextRange.start, endOffset: Number.POSITIVE_INFINITY});
        }
      }
    }
  }

  onMediaAttached(data) {
    var media = this.media = data.media;
    this.onvseeking = this.onMediaSeeking.bind(this);
    this.onvseeked = this.onMediaSeeked.bind(this);
    this.onvended = this.onMediaEnded.bind(this);
    media.addEventListener('seeking', this.onvseeking);
    media.addEventListener('seeked', this.onvseeked);
    media.addEventListener('ended', this.onvended);
    let config = this.config;
    if(this.levels && config.autoStartLoad) {
      this.hls.startLoad(config.startPosition);
    }
  }

  onMediaDetaching() {
    var media = this.media;
    if (media && media.ended) {
      logger.log('MSE detaching and video ended, reset startPosition');
      this.startPosition = this.lastCurrentTime = 0;
    }

    // reset fragment loading counter on MSE detaching to avoid reporting FRAG_LOOP_LOADING_ERROR after error recovery
    var levels = this.levels;
    if (levels) {
      // reset fragment load counter
        levels.forEach(level => {
          if(level.details) {
            level.details.fragments.forEach(fragment => {
              fragment.loadCounter = undefined;
            });
          }
      });
    }
    // remove video listeners
    if (media) {
      media.removeEventListener('seeking', this.onvseeking);
      media.removeEventListener('seeked', this.onvseeked);
      media.removeEventListener('ended', this.onvended);
      this.onvseeking = this.onvseeked  = this.onvended = null;
    }
    this.media = null;
    this.loadedmetadata = false;
    this.stopLoad();
  }

  onMediaSeeking() {
    if (this.state === State.FRAG_LOADING) {
      // check if currently loaded fragment is inside buffer.
      //if outside, cancel fragment loading, otherwise do nothing
      if (BufferHelper.bufferInfo(this.media,this.media.currentTime,this.config.maxBufferHole).len === 0) {
        logger.log('seeking outside of buffer while fragment load in progress, cancel fragment load');
        var fragCurrent = this.fragCurrent;
        if (fragCurrent) {
          if (fragCurrent.loader) {
            fragCurrent.loader.abort();
          }
          this.fragCurrent = null;
        }
        this.fragPrevious = null;
        // switch to IDLE state to load new fragment
        this.state = State.IDLE;
      }
    } else if (this.state === State.ENDED) {
        // switch to IDLE state to check for potential new fragment
        this.state = State.IDLE;
    }
    if (this.media) {
      this.lastCurrentTime = this.media.currentTime;
    }
    // avoid reporting fragment loop loading error in case user is seeking several times on same position
    if (this.fragLoadIdx !== undefined) {
      this.fragLoadIdx += 2 * this.config.fragLoadingLoopThreshold;
    }
    // tick to speed up processing
    this.tick();
  }

  onMediaSeeked() {
    // tick to speed up FRAGMENT_PLAYING triggering
    this.tick();
  }

  onMediaEnded() {
    logger.log('media ended');
    // reset startPosition and lastCurrentTime to restart playback @ stream beginning
    this.startPosition = this.lastCurrentTime = 0;
  }


  onManifestLoading() {
    // reset buffer on manifest loading
    logger.log('trigger BUFFER_RESET');
    this.hls.trigger(Event.BUFFER_RESET);
    this.bufferRange = [];
    this.stalled = false;
  }

  onManifestParsed(data) {
    var aac = false, heaac = false, codec;
    data.levels.forEach(level => {
      // detect if we have different kind of audio codecs used amongst playlists
      codec = level.audioCodec;
      if (codec) {
        if (codec.indexOf('mp4a.40.2') !== -1) {
          aac = true;
        }
        if (codec.indexOf('mp4a.40.5') !== -1) {
          heaac = true;
        }
      }
    });
    this.audioCodecSwitch = (aac && heaac);
    if (this.audioCodecSwitch) {
      logger.log('both AAC/HE-AAC audio found in levels; declaring level codec as HE-AAC');
    }
    this.levels = data.levels;
    this.startLevelLoaded = false;
    this.startFragRequested = false;
    let config = this.config;
    if (config.autoStartLoad) {
      this.hls.startLoad(config.startPosition);
    }
  }

  onLevelLoaded(data) {
    var newDetails = data.details,
        newLevelId = data.level,
        curLevel = this.levels[newLevelId],
        duration = newDetails.totalduration,
        sliding = 0;

    logger.log(`level ${newLevelId} loaded [${newDetails.startSN},${newDetails.endSN}],duration:${duration}`);
    this.levelLastLoaded = newLevelId;

    if (newDetails.live) {
      var curDetails = curLevel.details;
      if (curDetails) {
        // we already have details for that level, merge them
        LevelHelper.mergeDetails(curDetails,newDetails);
        sliding = newDetails.fragments[0].start;
        if (newDetails.PTSKnown) {
          logger.log(`live playlist sliding:${sliding.toFixed(3)}`);
        } else {
          logger.log('live playlist - outdated PTS, unknown sliding');
        }
      } else {
        newDetails.PTSKnown = false;
        logger.log('live playlist - first load, unknown sliding');
      }
    } else {
      newDetails.PTSKnown = false;
    }
    // override level info
    curLevel.details = newDetails;
    this.hls.trigger(Event.LEVEL_UPDATED, { details: newDetails, level: newLevelId });

    if (this.startFragRequested === false) {
    // compute start position if set to -1. use it straight away if value is defined
      if (this.startPosition === -1) {
        // first, check if start time offset has been set in playlist, if yes, use this value
        let startTimeOffset = newDetails.startTimeOffset;
        if(!isNaN(startTimeOffset)) {
          logger.log(`start time offset found in playlist, adjust startPosition to ${startTimeOffset}`);
          this.startPosition = startTimeOffset;
        } else {
          // if live playlist, set start position to be fragment N-this.config.liveSyncDurationCount (usually 3)
          if (newDetails.live) {
            let targetLatency = this.config.liveSyncDuration !== undefined ? this.config.liveSyncDuration : this.config.liveSyncDurationCount * newDetails.targetduration;
            this.startPosition = Math.max(0, sliding + duration - targetLatency);
          } else {
            this.startPosition = 0;
          }
        }
      }
      this.nextLoadPosition = this.startPosition;
    }
    // only switch batck to IDLE state if we were waiting for level to start downloading a new fragment
    if (this.state === State.WAITING_LEVEL) {
      this.state = State.IDLE;
    }
    //trigger handler right now
    this.tick();
  }

  onKeyLoaded() {
    if (this.state === State.KEY_LOADING) {
      this.state = State.IDLE;
      this.tick();
    }
  }

  onFragLoaded(data) {
    var fragCurrent = this.fragCurrent;
    if (this.state === State.FRAG_LOADING &&
        fragCurrent &&
        data.frag.level === fragCurrent.level &&
        data.frag.sn === fragCurrent.sn) {

      logger.log(`Loaded  ${fragCurrent.sn} of level ${fragCurrent.level}`);
      if (this.fragBitrateTest === true) {
        // switch back to IDLE state ... we just loaded a fragment to determine adequate start bitrate and initialize autoswitch algo
        this.state = State.IDLE;
        this.fragBitrateTest = false;
        this.startFragRequested = false;
        data.stats.tparsed = data.stats.tbuffered = performance.now();
        this.hls.trigger(Event.FRAG_BUFFERED, {stats: data.stats, frag: fragCurrent});
      } else {
        this.state = State.PARSING;
        // transmux the MPEG-TS data to ISO-BMFF segments
        this.stats = data.stats;
        var currentLevel = this.levels[this.level],
            details = currentLevel.details,
            duration = details.totalduration,
            start = fragCurrent.startDTS !== undefined && !isNaN(fragCurrent.startDTS) ? fragCurrent.startDTS  : fragCurrent.start,
            level = fragCurrent.level,
            sn = fragCurrent.sn,
            audioCodec = currentLevel.audioCodec || this.config.defaultAudioCodec;
        if(this.audioCodecSwap) {
          logger.log('swapping playlist audio codec');
          if(audioCodec === undefined) {
            audioCodec = this.lastAudioCodec;
          }
          if(audioCodec) {
            if(audioCodec.indexOf('mp4a.40.5') !==-1) {
              audioCodec = 'mp4a.40.2';
            } else {
              audioCodec = 'mp4a.40.5';
            }
          }
        }
        this.pendingAppending = 0;
        logger.log(`Demuxing ${sn} of [${details.startSN} ,${details.endSN}],level ${level}, cc ${fragCurrent.cc}`);
        let demuxer = this.demuxer;
        if (demuxer) {
          demuxer.push(data.payload, audioCodec, currentLevel.videoCodec, start, fragCurrent.cc, level, sn, duration, fragCurrent.decryptdata);
        }
      }
    }
    this.fragLoadError = 0;
  }

  onFragParsingInitSegment(data) {
    if (this.state === State.PARSING) {
      var tracks = data.tracks, trackName, track;

      // include levelCodec in audio and video tracks
      track = tracks.audio;
      if(track) {
        var audioCodec = this.levels[this.level].audioCodec,
            ua = navigator.userAgent.toLowerCase();
        if(audioCodec && this.audioCodecSwap) {
          logger.log('swapping playlist audio codec');
          if(audioCodec.indexOf('mp4a.40.5') !==-1) {
            audioCodec = 'mp4a.40.2';
          } else {
            audioCodec = 'mp4a.40.5';
          }
        }
        // in case AAC and HE-AAC audio codecs are signalled in manifest
        // force HE-AAC , as it seems that most browsers prefers that way,
        // except for mono streams OR on FF
        // these conditions might need to be reviewed ...
        if (this.audioCodecSwitch) {
            // don't force HE-AAC if mono stream
           if(track.metadata.channelCount !== 1 &&
            // don't force HE-AAC if firefox
            ua.indexOf('firefox') === -1) {
              audioCodec = 'mp4a.40.5';
          }
        }
        // HE-AAC is broken on Android, always signal audio codec as AAC even if variant manifest states otherwise
        if(ua.indexOf('android') !== -1) {
          audioCodec = 'mp4a.40.2';
          logger.log(`Android: force audio codec to` + audioCodec);
        }
        track.levelCodec = audioCodec;
      }
      track = tracks.video;
      if(track) {
        track.levelCodec = this.levels[this.level].videoCodec;
      }

      // if remuxer specify that a unique track needs to generated,
      // let's merge all tracks together
      if (data.unique) {
        var mergedTrack = {
            codec : '',
            levelCodec : ''
          };
        for (trackName in data.tracks) {
          track = tracks[trackName];
          mergedTrack.container = track.container;
          if (mergedTrack.codec) {
            mergedTrack.codec +=  ',';
            mergedTrack.levelCodec +=  ',';
          }
          if(track.codec) {
            mergedTrack.codec +=  track.codec;
          }
          if (track.levelCodec) {
            mergedTrack.levelCodec +=  track.levelCodec;
          }
        }
        tracks = { audiovideo : mergedTrack };
      }
      this.hls.trigger(Event.BUFFER_CODECS,tracks);
      // loop through tracks that are going to be provided to bufferController
      for (trackName in tracks) {
        track = tracks[trackName];
        logger.log(`track:${trackName},container:${track.container},codecs[level/parsed]=[${track.levelCodec}/${track.codec}]`);
        var initSegment = track.initSegment;
        if (initSegment) {
          this.pendingAppending++;
          this.hls.trigger(Event.BUFFER_APPENDING, {type: trackName, data: initSegment});
        }
      }
      //trigger handler right now
      this.tick();
    }
  }

  onFragParsingData(data) {
    if (this.state === State.PARSING) {
      this.tparse2 = Date.now();
      var level = this.levels[this.level],
          frag = this.fragCurrent;

      logger.log(`parsed ${data.type},PTS:[${data.startPTS.toFixed(3)},${data.endPTS.toFixed(3)}],DTS:[${data.startDTS.toFixed(3)}/${data.endDTS.toFixed(3)}],nb:${data.nb},dropped:${data.dropped || 0}`);

      var drift = LevelHelper.updateFragPTSDTS(level.details,frag.sn,data.startPTS,data.endPTS,data.startDTS,data.endDTS),
          hls = this.hls;
      hls.trigger(Event.LEVEL_PTS_UPDATED, {details: level.details, level: this.level, drift: drift});

      // has remuxer dropped video frames located before first keyframe ?
      if(data.type === 'video') {
        frag.dropped = data.dropped;
      }

      [data.data1, data.data2].forEach(buffer => {
        if (buffer) {
          this.pendingAppending++;
          hls.trigger(Event.BUFFER_APPENDING, {type: data.type, data: buffer});
        }
      });

      this.nextLoadPosition = data.endPTS;
      this.bufferRange.push({type: data.type, start: data.startPTS, end: data.endPTS, frag: frag});

      //trigger handler right now
      this.tick();
    } else {
      logger.warn(`not in PARSING state but ${this.state}, ignoring FRAG_PARSING_DATA event`);
    }
  }

  onFragParsed() {
    if (this.state === State.PARSING) {
      this.stats.tparsed = performance.now();
      this.state = State.PARSED;
      this._checkAppendedParsed();
    }
  }

  onBufferAppended() {
    switch (this.state) {
      case State.PARSING:
      case State.PARSED:
        this.pendingAppending--;
        this._checkAppendedParsed();
        break;
      default:
        break;
    }
  }

  _checkAppendedParsed() {
    //trigger handler right now
    if (this.state === State.PARSED && this.pendingAppending === 0)  {
      var frag = this.fragCurrent, stats = this.stats;
      if (frag) {
        this.fragPrevious = frag;
        stats.tbuffered = performance.now();
        this.fragLastKbps = Math.round(8 * stats.length / (stats.tbuffered - stats.tfirst));
        this.hls.trigger(Event.FRAG_BUFFERED, {stats: stats, frag: frag});
        logger.log(`media buffered : ${this.timeRangesToString(this.media.buffered)}`);
        this.state = State.IDLE;
      }
      this.tick();
    }
  }

  onError(data) {
    switch(data.details) {
      case ErrorDetails.FRAG_LOAD_ERROR:
      case ErrorDetails.FRAG_LOAD_TIMEOUT:
        if(!data.fatal) {
          var loadError = this.fragLoadError;
          if(loadError) {
            loadError++;
          } else {
            loadError=1;
          }
          if (loadError <= this.config.fragLoadingMaxRetry ||
            // keep retrying / don't raise fatal network error if current position is buffered
            (this.media && this.isBuffered(this.media.currentTime))) {
            this.fragLoadError = loadError;
            // reset load counter to avoid frag loop loading error
            data.frag.loadCounter = 0;
            // exponential backoff capped to 64s
            var delay = Math.min(Math.pow(2,loadError-1)*this.config.fragLoadingRetryDelay,64000);
            logger.warn(`mediaController: frag loading failed, retry in ${delay} ms`);
            this.retryDate = performance.now() + delay;
            // retry loading state
            this.state = State.FRAG_LOADING_WAITING_RETRY;
          } else {
            logger.error(`mediaController: ${data.details} reaches max retry, redispatch as fatal ...`);
            // redispatch same error but with fatal set to true
            data.fatal = true;
            this.hls.trigger(Event.ERROR, data);
            this.state = State.ERROR;
          }
        }
        break;
      case ErrorDetails.FRAG_LOOP_LOADING_ERROR:
      case ErrorDetails.LEVEL_LOAD_ERROR:
      case ErrorDetails.LEVEL_LOAD_TIMEOUT:
      case ErrorDetails.KEY_LOAD_ERROR:
      case ErrorDetails.KEY_LOAD_TIMEOUT:
        //  when in ERROR state, don't switch back to IDLE state in case a non-fatal error is received
        if(this.state !== State.ERROR) {
            // if fatal error, stop processing, otherwise move to IDLE to retry loading
            this.state = data.fatal ? State.ERROR : State.IDLE;
            logger.warn(`mediaController: ${data.details} while loading frag,switch to ${this.state} state ...`);
        }
        break;
      case ErrorDetails.BUFFER_FULL_ERROR:
        // only reduce max buf len if in appending state
        if (this.state === State.PARSING || this.state === State.PARSED) {
          // reduce max buffer length as it might be too high. we do this to avoid loop flushing ...
          this.config.maxMaxBufferLength/=2;
          logger.warn(`reduce max buffer length to ${this.config.maxMaxBufferLength}s and switch to IDLE state`);
          // increase fragment load Index to avoid frag loop loading error after buffer flush
          this.fragLoadIdx += 2 * this.config.fragLoadingLoopThreshold;
          this.state = State.IDLE;
        }
        break;
      default:
        break;
    }
  }

_checkBuffer() {
    var media = this.media;
    // if ready state different from HAVE_NOTHING (numeric value 0), we are allowed to seek
    if(media && media.readyState) {
        let currentTime = media.currentTime,
             buffered = media.buffered;
      // adjust currentTime to start position on loaded metadata
      if(!this.loadedmetadata && buffered.length) {
        this.loadedmetadata = true;
        // only adjust currentTime if startPosition not equal to 0
        let startPosition = this.startPosition;
        // if currentTime === 0 AND not matching with expected startPosition
        if (!currentTime && currentTime !== startPosition) {
          if (startPosition) {
            logger.log(`target start position:${startPosition}`);
            // at that stage, there should be only one buffered range, as we reach that code after first fragment has been
            let bufferStart = buffered.start(0),
                bufferEnd = buffered.end(0);
            // if startPosition not buffered, let's seek to buffered.start(0)
            if(startPosition < bufferStart || startPosition > bufferEnd) {
              startPosition = bufferStart;
              logger.log(`target start position not buffered, seek to buffered.start(0) ${bufferStart}`);
            }
            logger.log(`adjust currentTime from ${currentTime} to ${startPosition}`);
            media.currentTime = startPosition;
          }
        }
      } else {
        let bufferInfo = BufferHelper.bufferInfo(media,currentTime,0),
            expectedPlaying = !(media.paused || // not playing when media is paused
                                media.ended  || // not playing when media is ended
                                media.buffered.length === 0), // not playing if nothing buffered
            jumpThreshold = 0.4, // tolerance needed as some browsers stalls playback before reaching buffered range end
            playheadMoving = currentTime > media.playbackRate*this.lastCurrentTime;

        if (this.stalled && playheadMoving) {
          this.stalled = false;
          logger.log(`playback not stuck anymore @${currentTime}`);
        }
        // check buffer upfront
        // if less than jumpThreshold second is buffered, let's check in more details
        if(expectedPlaying && bufferInfo.len <= jumpThreshold) {
          if(playheadMoving) {
            // playhead moving
            jumpThreshold = 0;
            this.seekHoleNudgeDuration = 0;
          } else {
            // playhead not moving AND media expected to play
            if(!this.stalled) {
              this.seekHoleNudgeDuration = 0;
              logger.log(`playback seems stuck @${currentTime}`);
              this.hls.trigger(Event.ERROR, {type: ErrorTypes.MEDIA_ERROR, details: ErrorDetails.BUFFER_STALLED_ERROR, fatal: false});
              this.stalled = true;
            } else {
              this.seekHoleNudgeDuration += this.config.seekHoleNudgeDuration;
            }
          }
          // if we are below threshold, try to jump to start of next buffer range if close
          if(bufferInfo.len <= jumpThreshold) {
            // no buffer available @ currentTime, check if next buffer is close (within a config.maxSeekHole second range)
            var nextBufferStart = bufferInfo.nextStart, delta = nextBufferStart-currentTime;
            if(nextBufferStart &&
               (delta < this.config.maxSeekHole) &&
               (delta > 0)) {
              // next buffer is close ! adjust currentTime to nextBufferStart
              // this will ensure effective video decoding
              logger.log(`adjust currentTime from ${media.currentTime} to next buffered @ ${nextBufferStart} + nudge ${this.seekHoleNudgeDuration}`);
              let hole = nextBufferStart + this.seekHoleNudgeDuration - media.currentTime;
              media.currentTime = nextBufferStart + this.seekHoleNudgeDuration;
              this.hls.trigger(Event.ERROR, {type: ErrorTypes.MEDIA_ERROR, details: ErrorDetails.BUFFER_SEEK_OVER_HOLE, fatal: false, hole : hole});
            }
          }
        }
      }
    }
  }

  onFragLoadEmergencyAborted() {
    this.state = State.IDLE;
    this.tick();
  }

  onBufferFlushed() {
    /* after successful buffer flushing, rebuild buffer Range array
      loop through existing buffer range and check if
      corresponding range is still buffered. only push to new array already buffered range
    */
    var newRange = [],range,i;
    for (i = 0; i < this.bufferRange.length; i++) {
      range = this.bufferRange[i];
      if (this.isBuffered((range.start + range.end) / 2)) {
        newRange.push(range);
      }
    }
    this.bufferRange = newRange;

    // handle end of immediate switching if needed
    if (this.immediateSwitch) {
      this.immediateLevelSwitchEnd();
    }
    // move to IDLE once flush complete. this should trigger new fragment loading
    this.state = State.IDLE;
    // reset reference to frag
    this.fragPrevious = null;
  }

  swapAudioCodec() {
    this.audioCodecSwap = !this.audioCodecSwap;
  }

  timeRangesToString(r) {
    var log = '', len = r.length;
    for (var i=0; i<len; i++) {
      log += '[' + r.start(i) + ',' + r.end(i) + ']';
    }
    return log;
  }
}
export default StreamController;

