/*
 * Audio Stream Controller
*/

import BinarySearch from '../utils/binary-search';
import BufferHelper from '../helper/buffer-helper';
import Demuxer from '../demux/demuxer';
import Event from '../events';
import EventHandler from '../event-handler';
import LevelHelper from '../helper/level-helper';
import TimeRanges from '../utils/timeRanges';
import {ErrorTypes, ErrorDetails} from '../errors';
import {logger} from '../utils/logger';

const State = {
  STOPPED : 'STOPPED',
  STARTING : 'STARTING',
  IDLE : 'IDLE',
  PAUSED : 'PAUSED',
  KEY_LOADING : 'KEY_LOADING',
  FRAG_LOADING : 'FRAG_LOADING',
  FRAG_LOADING_WAITING_RETRY : 'FRAG_LOADING_WAITING_RETRY',
  WAITING_TRACK : 'WAITING_TRACK',
  PARSING : 'PARSING',
  PARSED : 'PARSED',
  ENDED : 'ENDED',
  ERROR : 'ERROR'
};

class AudioStreamController extends EventHandler {

  constructor(hls) {
    super(hls,
      Event.MEDIA_ATTACHED,
      Event.MEDIA_DETACHING,
      Event.AUDIO_TRACKS_UPDATED,
      Event.AUDIO_TRACK_SWITCH,
      Event.AUDIO_TRACK_LOADED,
      Event.KEY_LOADED,
      Event.FRAG_LOADED,
      Event.FRAG_PARSING_INIT_SEGMENT,
      Event.FRAG_PARSING_DATA,
      Event.FRAG_PARSED,
      Event.ERROR,
      Event.BUFFER_CREATED,
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
    if (this.tracks) {
      var media = this.media, lastCurrentTime = this.lastCurrentTime;
      this.stopLoad();
      if (!this.timer) {
        this.timer = setInterval(this.ontick, 100);
      }
      this.fragLoadError = 0;
      if (media && lastCurrentTime) {
        logger.log(`configure startPosition @${lastCurrentTime}`);
        this.state = State.IDLE;
      } else {
        this.lastCurrentTime = this.startPosition ? this.startPosition : startPosition;
        this.state = State.STARTING;
      }
      this.nextLoadPosition = this.startPosition = this.lastCurrentTime;
      this.tick();
    } else {
      this.startPosition = startPosition;
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
    var pos, track, trackDetails, hls = this.hls, config = hls.config;
    //logger.log('audioStream:' + this.state);
    switch(this.state) {
      case State.ERROR:
        //don't do anything in error state to avoid breaking further ...
      case State.PAUSED:
        //don't do anything in paused state either ...
        break;
      case State.STARTING:
        this.state = State.WAITING_TRACK;
        this.loadedmetadata = false;
        break;
      case State.IDLE:
        // if video not attached AND
        // start fragment already requested OR start frag prefetch disable
        // exit loop
        // => if media not attached but start frag prefetch is enabled and start frag not requested yet, we will not exit loop
        if (!this.media &&
          (this.startFragRequested || !config.startFragPrefetch)) {
          break;
        }
        // determine next candidate fragment to be loaded, based on current position and
        //  end of buffer position
        // if we have not yet loaded any fragment, start loading from start position
        if (this.loadedmetadata) {
          pos = this.media.currentTime;
        } else {
          pos = this.nextLoadPosition;
        }
        let media = this.mediaBuffer ? this.mediaBuffer : this.media;
        var bufferInfo = BufferHelper.bufferInfo(media,pos,config.maxBufferHole),
            bufferLen = bufferInfo.len,
            bufferEnd = bufferInfo.end,
            fragPrevious = this.fragPrevious,
            maxBufLen = config.maxMaxBufferLength;

        // if buffer length is less than maxBufLen try to load a new fragment
        if (bufferLen < maxBufLen && this.trackId < this.tracks.length) {
          trackDetails = this.tracks[this.trackId].details;
          // if track info not retrieved yet, switch state and wait for track retrieval
          if (typeof trackDetails === 'undefined') {
            this.state = State.WAITING_TRACK;
            break;
          }

        // we just got done loading the final fragment, check if we need to finalize media stream
        if (!trackDetails.live && fragPrevious && fragPrevious.sn === trackDetails.endSN) {
            // if we are not seeking or if we are seeking but everything (almost) til the end is buffered, let's signal eos
            // we don't compare exactly media.duration === bufferInfo.end as there could be some subtle media duration difference when switching
            // between different renditions. using half frag duration should help cope with these cases.
            if (!this.media.seeking || (this.media.duration-bufferEnd) < fragPrevious.duration/2) {
            // Finalize the media stream
            this.hls.trigger(Event.BUFFER_EOS,{ type : 'audio'});
            this.state = State.ENDED;
            break;
          }
        }

          // find fragment index, contiguous with end of buffer position
          let fragments = trackDetails.fragments,
              fragLen = fragments.length,
              start = fragments[0].start,
              end = fragments[fragLen-1].start + fragments[fragLen-1].duration,
              frag;

          // if bufferEnd before start of playlist, load first fragment
          if (bufferEnd < start) {
            frag = fragments[0];
          } else {
            let foundFrag;
            let maxFragLookUpTolerance = config.maxFragLookUpTolerance;
            if (bufferEnd < end) {
              if (bufferEnd > end - maxFragLookUpTolerance) {
                maxFragLookUpTolerance = 0;
              }
              foundFrag = BinarySearch.search(fragments, (candidate) => {
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
              foundFrag = fragments[fragLen-1];
            }
            if (foundFrag) {
              frag = foundFrag;
              start = foundFrag.start;
              //logger.log('find SN matching with pos:' +  bufferEnd + ':' + frag.sn);
              if (fragPrevious && frag.level === fragPrevious.level && frag.sn === fragPrevious.sn) {
                if (frag.sn < trackDetails.endSN) {
                  frag = fragments[frag.sn + 1 - trackDetails.startSN];
                  logger.log(`SN just loaded, load next one: ${frag.sn}`);
                } else {
                  frag = null;
                }
              }
            }
          }
          if(frag) {
            //logger.log('      loading frag ' + i +',pos/bufEnd:' + pos.toFixed(3) + '/' + bufferEnd.toFixed(3));
            if ((frag.decryptdata.uri != null) && (frag.decryptdata.key == null)) {
              logger.log(`Loading key for ${frag.sn} of [${trackDetails.startSN} ,${trackDetails.endSN}],track ${this.trackId}`);
              this.state = State.KEY_LOADING;
              hls.trigger(Event.KEY_LOADING, {frag: frag});
            } else {
              logger.log(`Loading ${frag.sn} of [${trackDetails.startSN} ,${trackDetails.endSN}],track ${this.trackId}, currentTime:${pos},bufferEnd:${bufferEnd.toFixed(3)}`);
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
              hls.trigger(Event.FRAG_LOADING, {frag: frag});
              this.state = State.FRAG_LOADING;
            }
          }
        }
        break;
      case State.WAITING_TRACK:
        track = this.tracks[this.trackId];
        // check if playlist is already loaded
        if (track && track.details) {
          this.state = State.IDLE;
        }
        break;
      case State.FRAG_LOADING_WAITING_RETRY:
        var now = performance.now();
        var retryDate = this.retryDate;
        media = this.media;
        var isSeeking = media && media.seeking;
        // if current time is gt than retryDate, or if media seeking let's switch to IDLE state to retry loading
        if(!retryDate || (now >= retryDate) || isSeeking) {
          logger.log(`audioStreamController: retryDate reached, switch back to IDLE state`);
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
  }

  onMediaAttached(data) {
    var media = this.media = this.mediaBuffer = data.media;
    this.onvseeking = this.onMediaSeeking.bind(this);
    this.onvended = this.onMediaEnded.bind(this);
    media.addEventListener('seeking', this.onvseeking);
    media.addEventListener('ended', this.onvended);
    let config = this.config;
    if(this.tracks && config.autoStartLoad) {
      this.startLoad(config.startPosition);
    }
  }

  onMediaDetaching() {
    var media = this.media;
    if (media && media.ended) {
      logger.log('MSE detaching and video ended, reset startPosition');
      this.startPosition = this.lastCurrentTime = 0;
    }

    // reset fragment loading counter on MSE detaching to avoid reporting FRAG_LOOP_LOADING_ERROR after error recovery
    var tracks = this.tracks;
    if (tracks) {
      // reset fragment load counter
        tracks.forEach(track => {
          if(track.details) {
            track.details.fragments.forEach(fragment => {
              fragment.loadCounter = undefined;
            });
          }
      });
    }
    // remove video listeners
    if (media) {
      media.removeEventListener('seeking', this.onvseeking);
      media.removeEventListener('ended', this.onvended);
      this.onvseeking = this.onvseeked  = this.onvended = null;
    }
    this.media = null;
    this.loadedmetadata = false;
    this.stopLoad();
  }

  onMediaSeeking() {
    if (this.state === State.ENDED) {
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

  onMediaEnded() {
    // reset startPosition and lastCurrentTime to restart playback @ stream beginning
    this.startPosition = this.lastCurrentTime = 0;
  }


  onAudioTracksUpdated(data) {
    logger.log('audio tracks updated');
    this.tracks = data.audioTracks;
  }

  onAudioTrackSwitch(data) {
    // if any URL found on new audio track, it is an alternate audio track
    var altAudio = !!data.url;
    this.trackId = data.id;
    this.state = State.IDLE;

    this.fragCurrent = null;
    this.state = State.PAUSED;
    // destroy useless demuxer when switching audio to main
    if (!altAudio) {
      if (this.demuxer) {
        this.demuxer.destroy();
        this.demuxer = null;
      }
    } else {
      // switching to audio track, start timer if not already started
      if (!this.timer) {
        this.timer = setInterval(this.ontick, 100);
      }
    }
    // flush audio source buffer
    this.hls.trigger(Event.BUFFER_FLUSHING, {startOffset: 0, endOffset: Number.POSITIVE_INFINITY, type : 'audio'});
    this.tick();
  }

  onAudioTrackLoaded(data) {
    var details = data.details,
        trackId = data.id,
        track = this.tracks[trackId],
        duration = details.totalduration;

    logger.log(`track ${trackId} loaded [${details.startSN},${details.endSN}],duration:${duration}`);
    details.PTSKnown = false;
    track.details = details;

    // compute start position
    if (!this.startFragRequested) {
    // compute start position if set to -1. use it straight away if value is defined
      if (this.startPosition === -1) {
        // first, check if start time offset has been set in playlist, if yes, use this value
        let startTimeOffset = details.startTimeOffset;
        if(!isNaN(startTimeOffset)) {
          logger.log(`start time offset found in playlist, adjust startPosition to ${startTimeOffset}`);
          this.startPosition = startTimeOffset;
        } else {
          this.startPosition = 0;
        }
      }
      this.nextLoadPosition = this.startPosition;
    }
    // only switch batck to IDLE state if we were waiting for track to start downloading a new fragment
    if (this.state === State.WAITING_TRACK) {
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
        data.frag.type === 'audio' &&
        data.frag.level === fragCurrent.level &&
        data.frag.sn === fragCurrent.sn) {
        this.state = State.PARSING;
        // transmux the MPEG-TS data to ISO-BMFF segments
        this.stats = data.stats;
        var track = this.tracks[this.trackId],
            details = track.details,
            duration = details.totalduration,
            start = fragCurrent.start,
            trackId = fragCurrent.level,
            sn = fragCurrent.sn,
            audioCodec = this.config.defaultAudioCodec || track.audioCodec;
        this.pendingAppending = 0;
        if(!this.demuxer) {
          this.demuxer = new Demuxer(this.hls,'audio');
        }
        logger.log(`Demuxing ${sn} of [${details.startSN} ,${details.endSN}],track ${trackId}`);
        // time Offset is accurate if level PTS is known, or if playlist is not sliding (not live)
        let accurateTimeOffset = details.PTSKnown || !details.live;
        this.demuxer.push(data.payload, audioCodec, null, start, fragCurrent.cc, trackId, sn, duration, fragCurrent.decryptdata,accurateTimeOffset);
    }
    this.fragLoadError = 0;
  }

  onFragParsingInitSegment(data) {
    let fragCurrent = this.fragCurrent;
    if (fragCurrent &&
        data.id === 'audio' &&
        data.sn === fragCurrent.sn &&
        data.level === fragCurrent.level &&
        this.state === State.PARSING) {
      let tracks = data.tracks, track;

      // include levelCodec in audio and video tracks
      track = tracks.audio;
      if(track) {
        track.levelCodec = 'mp4a.40.2';
        track.id = data.id;
        this.hls.trigger(Event.BUFFER_CODECS,tracks);
        logger.log(`audio track:audio,container:${track.container},codecs[level/parsed]=[${track.levelCodec}/${track.codec}]`);
        let initSegment = track.initSegment;
        if (initSegment) {
          this.pendingAppending++;
          this.hls.trigger(Event.BUFFER_APPENDING, {type: 'audio', data: initSegment, parent : 'audio',content : 'initSegment'});
        }
        //trigger handler right now
        this.tick();
      }
    }
  }

  onFragParsingData(data) {
    let fragCurrent = this.fragCurrent;
    if (fragCurrent &&
        data.id === 'audio' &&
        data.sn === fragCurrent.sn &&
        data.level === fragCurrent.level &&
        this.state === State.PARSING) {
      var track = this.tracks[this.trackId],
          frag = this.fragCurrent;

      logger.log(`parsed ${data.type},PTS:[${data.startPTS.toFixed(3)},${data.endPTS.toFixed(3)}],DTS:[${data.startDTS.toFixed(3)}/${data.endDTS.toFixed(3)}],nb:${data.nb}`);
      LevelHelper.updateFragPTSDTS(track.details,frag.sn,data.startPTS,data.endPTS);

      [data.data1, data.data2].forEach(buffer => {
        if (buffer) {
          this.pendingAppending++;
          this.hls.trigger(Event.BUFFER_APPENDING, {type: data.type, data: buffer, parent : 'audio',content : 'data'});
        }
      });
      this.nextLoadPosition = data.endPTS;
      //trigger handler right now
      this.tick();
    }
  }

  onFragParsed(data) {
    let fragCurrent = this.fragCurrent;
    if (fragCurrent &&
        data.id === 'audio' &&
        data.sn === fragCurrent.sn &&
        data.level === fragCurrent.level &&
        this.state === State.PARSING) {
      this.stats.tparsed = performance.now();
      this.state = State.PARSED;
      this._checkAppendedParsed();
    }
  }


  onBufferCreated(data) {
    let audioTrack = data.tracks.audio;
    if (audioTrack) {
      this.mediaBuffer = audioTrack.buffer;
      this.loadedmetadata = true;
    }
  }

  onBufferAppended(data) {
    if (data.parent === 'audio') {
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
  }

  _checkAppendedParsed() {
    //trigger handler right now
    if (this.state === State.PARSED && this.pendingAppending === 0)  {
      var frag = this.fragCurrent, stats = this.stats;
      if (frag) {
        this.fragPrevious = frag;
        stats.tbuffered = performance.now();
        this.hls.trigger(Event.FRAG_BUFFERED, {stats: stats, frag: frag, id : 'audio'});
        let media = this.mediaBuffer ? this.mediaBuffer : this.media;
        logger.log(`audio buffered : ${TimeRanges.toString(media.buffered)}`);
        this.state = State.IDLE;
      }
      this.tick();
    }
  }

  onError(data) {
    let frag = data.frag;
    // don't handle frag error not related to audio fragment
    if (frag && frag.type !== 'audio') {
      return;
    }
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
          let config = this.config;
          if (loadError <= config.fragLoadingMaxRetry) {
            this.fragLoadError = loadError;
            // reset load counter to avoid frag loop loading error
            frag.loadCounter = 0;
            // exponential backoff capped to config.fragLoadingMaxRetryTimeout
            var delay = Math.min(Math.pow(2,loadError-1)*config.fragLoadingRetryDelay,config.fragLoadingMaxRetryTimeout);
            logger.warn(`audioStreamController: frag loading failed, retry in ${delay} ms`);
            this.retryDate = performance.now() + delay;
            // retry loading state
            this.state = State.FRAG_LOADING_WAITING_RETRY;
          } else {
            logger.error(`audioStreamController: ${data.details} reaches max retry, redispatch as fatal ...`);
            // redispatch same error but with fatal set to true
            data.fatal = true;
            this.hls.trigger(Event.ERROR, data);
            this.state = State.ERROR;
          }
        }
        break;
      case ErrorDetails.FRAG_LOOP_LOADING_ERROR:
      case ErrorDetails.AUDIO_TRACK_LOAD_ERROR:
      case ErrorDetails.AUDIO_TRACK_LOAD_TIMEOUT:
      case ErrorDetails.KEY_LOAD_ERROR:
      case ErrorDetails.KEY_LOAD_TIMEOUT:
        //  when in ERROR state, don't switch back to IDLE state in case a non-fatal error is received
        if(this.state !== State.ERROR) {
            // if fatal error, stop processing, otherwise move to IDLE to retry loading
            this.state = data.fatal ? State.ERROR : State.IDLE;
            logger.warn(`audioStreamController: ${data.details} while loading frag,switch to ${this.state} state ...`);
        }
        break;
      default:
        break;
    }
  }

  onBufferFlushed() {
    // increase fragment load Index to avoid frag loop loading error after buffer flush
    this.fragLoadIdx += 2 * this.config.fragLoadingLoopThreshold;
    // move to IDLE once flush complete. this should trigger new fragment loading
    this.state = State.IDLE;
    // reset reference to frag
    this.fragPrevious = null;
    this.tick();
  }
}
export default AudioStreamController;

