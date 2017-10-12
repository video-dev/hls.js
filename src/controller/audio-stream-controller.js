/*
 * Audio Stream Controller
*/

import BinarySearch from '../utils/binary-search';
import BufferHelper from '../helper/buffer-helper';
import Demuxer from '../demux/demuxer';
import Event from '../events';
import EventHandler from '../event-handler';
import * as LevelHelper from '../helper/level-helper';import TimeRanges from '../utils/timeRanges';
import {ErrorTypes, ErrorDetails} from '../errors';
import {logger} from '../utils/logger';
import { findFragWithCC } from '../utils/discontinuities';

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
  BUFFER_FLUSHING : 'BUFFER_FLUSHING',
  ENDED : 'ENDED',
  ERROR : 'ERROR',
  WAITING_INIT_PTS : 'WAITING_INIT_PTS'
};

class AudioStreamController extends EventHandler {

  constructor(hls) {
    super(hls,
      Event.MEDIA_ATTACHED,
      Event.MEDIA_DETACHING,
      Event.AUDIO_TRACKS_UPDATED,
      Event.AUDIO_TRACK_SWITCHING,
      Event.AUDIO_TRACK_LOADED,
      Event.KEY_LOADED,
      Event.FRAG_LOADED,
      Event.FRAG_PARSING_INIT_SEGMENT,
      Event.FRAG_PARSING_DATA,
      Event.FRAG_PARSED,
      Event.ERROR,
      Event.BUFFER_CREATED,
      Event.BUFFER_APPENDED,
      Event.BUFFER_FLUSHED,
      Event.INIT_PTS_FOUND);

    this.config = hls.config;
    this.audioCodecSwap = false;
    this.ticks = 0;
    this._state = State.STOPPED;
    this.ontick = this.tick.bind(this);
    this.initPTS=[];
    this.waitingFragment=null;
    this.videoTrackCC = null;
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

  //Signal that video PTS was found
  onInitPtsFound(data) {
    var demuxerId=data.id, cc = data.frag.cc, initPTS = data.initPTS;
    if(demuxerId === 'main') {
      //Always update the new INIT PTS
      //Can change due level switch
      this.initPTS[cc] = initPTS;
      this.videoTrackCC = cc;
      logger.log(`InitPTS for cc:${cc} found from video track:${initPTS}`);

      //If we are waiting we need to demux/remux the waiting frag
      //With the new initPTS
      if (this.state === State.WAITING_INIT_PTS) {
        this.tick();
      }
    }
  }

  startLoad(startPosition) {
    if (this.tracks) {
      var lastCurrentTime = this.lastCurrentTime;
      this.stopLoad();
      if (!this.timer) {
        this.timer = setInterval(this.ontick, 100);
      }
      this.fragLoadError = 0;
      if (lastCurrentTime > 0 && startPosition === -1) {
        logger.log(`audio:override startPosition with lastCurrentTime @${lastCurrentTime.toFixed(3)}`);
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

  set state(nextState) {
    if (this.state !== nextState) {
      const previousState = this.state;
      this._state = nextState;
      logger.log(`audio stream:${previousState}->${nextState}`);
    }
  }

  get state() {
    return this._state;
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
      case State.BUFFER_FLUSHING:
        break;
      case State.STARTING:
        this.state = State.WAITING_TRACK;
        this.loadedmetadata = false;
        break;
      case State.IDLE:
        const tracks = this.tracks;
        // audio tracks not received => exit loop
        if (!tracks) {
          break;
        }
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
          if (pos === undefined) {
            break;
          }
        }
        let media = this.mediaBuffer ? this.mediaBuffer : this.media,
            videoBuffer = this.videoBuffer ? this.videoBuffer : this.media,
            bufferInfo = BufferHelper.bufferInfo(media,pos,config.maxBufferHole),
            mainBufferInfo = BufferHelper.bufferInfo(videoBuffer,pos,config.maxBufferHole),
            bufferLen = bufferInfo.len,
            bufferEnd = bufferInfo.end,
            fragPrevious = this.fragPrevious,
            // ensure we buffer at least config.maxBufferLength (default 30s)
            // once we reach that threshold, don't buffer more than video (mainBufferInfo.len)
            maxBufLen = Math.max(config.maxBufferLength,mainBufferInfo.len),
            audioSwitch = this.audioSwitch,
            trackId = this.trackId;

        // if buffer length is less than maxBufLen try to load a new fragment
        if ((bufferLen < maxBufLen || audioSwitch) && trackId < tracks.length) {
          trackDetails = tracks[trackId].details;
          // if track info not retrieved yet, switch state and wait for track retrieval
          if (typeof trackDetails === 'undefined') {
            this.state = State.WAITING_TRACK;
            break;
          }

          // we just got done loading the final fragment, check if we need to finalize media stream
          if (!audioSwitch && !trackDetails.live && fragPrevious && fragPrevious.sn === trackDetails.endSN) {
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

          // When switching audio track, reload audio as close as possible to currentTime
          if(audioSwitch){
            if (trackDetails.live && !trackDetails.PTSKnown) {
              logger.log(`switching audiotrack, live stream, unknown PTS,load first fragment`);
              bufferEnd = 0;
            } else {
              bufferEnd = pos;
              // if currentTime (pos) is less than alt audio playlist start time, it means that alt audio is ahead of currentTime
              if (trackDetails.PTSKnown && pos < start) {
                // if everything is buffered from pos to start or if audio buffer upfront, let's seek to start
                if (bufferInfo.end > start || bufferInfo.nextStart) {
                  logger.log('alt audio track ahead of main track, seek to start of alt audio track');
                  this.media.currentTime = start + 0.05;
                } else {
                  return;
                }
              }
            }
          }
          if (trackDetails.initSegment && !trackDetails.initSegment.data) {
              frag = trackDetails.initSegment;
           }
          // if bufferEnd before start of playlist, load first fragment
          else if (bufferEnd <= start) {
            frag = fragments[0];
            if (this.videoTrackCC !== null && frag.cc !== this.videoTrackCC) {
              // Ensure we find a fragment which matches the continuity of the video track
              frag = findFragWithCC(fragments, this.videoTrackCC);
            }
            if (trackDetails.live && frag.loadIdx && frag.loadIdx === this.fragLoadIdx) {
              // we just loaded this first fragment, and we are still lagging behind the start of the live playlist
              // let's force seek to start
              const nextBuffered = bufferInfo.nextStart ? bufferInfo.nextStart : start;
              logger.log(`no alt audio available @currentTime:${this.media.currentTime}, seeking @${nextBuffered + 0.05}`);
              this.media.currentTime = nextBuffered + 0.05;
              return;
            }
          } else {
            let foundFrag;
            let maxFragLookUpTolerance = config.maxFragLookUpTolerance;
            const fragNext = fragPrevious ? fragments[fragPrevious.sn - fragments[0].sn + 1] : undefined;
            let fragmentWithinToleranceTest = (candidate) => {
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
              // Set the lookup tolerance to be small enough to detect the current segment - ensures we don't skip over very small segments
              let candidateLookupTolerance = Math.min(maxFragLookUpTolerance, candidate.duration);
              if ((candidate.start + candidate.duration - candidateLookupTolerance) <= bufferEnd) {
                return 1;
              }// if maxFragLookUpTolerance will have negative value then don't return -1 for first element
              else if (candidate.start - candidateLookupTolerance > bufferEnd && candidate.start) {
                return -1;
              }
              return 0;
            };

            if (bufferEnd < end) {
              if (bufferEnd > end - maxFragLookUpTolerance) {
                maxFragLookUpTolerance = 0;
              }
              // Prefer the next fragment if it's within tolerance
              if (fragNext && !fragmentWithinToleranceTest(fragNext)) {
                foundFrag = fragNext;
              } else {
                foundFrag = BinarySearch.search(fragments, fragmentWithinToleranceTest);
              }
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
            if (frag.decryptdata && (frag.decryptdata.uri != null) && (frag.decryptdata.key == null)) {
              logger.log(`Loading key for ${frag.sn} of [${trackDetails.startSN} ,${trackDetails.endSN}],track ${trackId}`);
              this.state = State.KEY_LOADING;
              hls.trigger(Event.KEY_LOADING, {frag: frag});
            } else {
              logger.log(`Loading ${frag.sn}, cc: ${frag.cc} of [${trackDetails.startSN} ,${trackDetails.endSN}],track ${trackId}, currentTime:${pos},bufferEnd:${bufferEnd.toFixed(3)}`);
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
              if (!isNaN(frag.sn)) {
                this.nextLoadPosition = frag.start + frag.duration;
              }
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
      case State.WAITING_INIT_PTS:
      const videoTrackCC = this.videoTrackCC;
        if (this.initPTS[videoTrackCC] === undefined) {
          break;
        }

        // Ensure we don't get stuck in the WAITING_INIT_PTS state if the waiting frag CC doesn't match any initPTS
        const waitingFrag = this.waitingFragment;
        if (waitingFrag) {
          const waitingFragCC = waitingFrag.frag.cc;
          if (videoTrackCC !== waitingFragCC) {
            track = this.tracks[this.trackId];
            if (track.details && track.details.live) {
              logger.warn(`Waiting fragment CC (${waitingFragCC}) does not match video track CC (${videoTrackCC})`);
              this.waitingFragment = null;
              this.state = State.IDLE;
            }
          } else {
            this.state = State.FRAG_LOADING;
            this.onFragLoaded(this.waitingFragment);
            this.waitingFragment = null;
          }
        } else {
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
    this.media = this.mediaBuffer = this.videoBuffer = null;
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

  onAudioTrackSwitching(data) {
    // if any URL found on new audio track, it is an alternate audio track
    var altAudio = !!data.url;
    this.trackId = data.id;

    this.fragCurrent = null;
    this.state = State.PAUSED;
    this.waitingFragment=null;
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

    //should we switch tracks ?
    if(altAudio){
      this.audioSwitch = true;
      //main audio track are handled by stream-controller, just do something if switching to alt audio track
      this.state=State.IDLE;
      // increase fragment load Index to avoid frag loop loading error after buffer flush
      if (this.fragLoadIdx !== undefined) {
        this.fragLoadIdx += 2 * this.config.fragLoadingLoopThreshold;
      }
    }
    this.tick();
  }

  onAudioTrackLoaded(data) {
    var newDetails = data.details,
        trackId = data.id,
        track = this.tracks[trackId],
        duration = newDetails.totalduration,
        sliding = 0;

    logger.log(`track ${trackId} loaded [${newDetails.startSN},${newDetails.endSN}],duration:${duration}`);

    if (newDetails.live) {
      var curDetails = track.details;
      if (curDetails && newDetails.fragments.length > 0) {
        // we already have details for that level, merge them
        LevelHelper.mergeDetails(curDetails,newDetails);
        sliding = newDetails.fragments[0].start;
        // TODO
        //this.liveSyncPosition = this.computeLivePosition(sliding, curDetails);
        if (newDetails.PTSKnown) {
          logger.log(`live audio playlist sliding:${sliding.toFixed(3)}`);
        } else {
          logger.log('live audio playlist - outdated PTS, unknown sliding');
        }
      } else {
        newDetails.PTSKnown = false;
        logger.log('live audio playlist - first load, unknown sliding');
      }
    } else {
      newDetails.PTSKnown = false;
    }
    track.details = newDetails;

    // compute start position
    if (!this.startFragRequested) {
    // compute start position if set to -1. use it straight away if value is defined
      if (this.startPosition === -1) {
        // first, check if start time offset has been set in playlist, if yes, use this value
        let startTimeOffset = newDetails.startTimeOffset;
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
    var fragCurrent = this.fragCurrent,
        fragLoaded = data.frag;
    if (this.state === State.FRAG_LOADING &&
        fragCurrent &&
        fragLoaded.type === 'audio' &&
        fragLoaded.level === fragCurrent.level &&
        fragLoaded.sn === fragCurrent.sn) {
        var track = this.tracks[this.trackId],
            details = track.details,
            duration = details.totalduration,
            trackId = fragCurrent.level,
            sn = fragCurrent.sn,
            cc = fragCurrent.cc,
            audioCodec = this.config.defaultAudioCodec || track.audioCodec || 'mp4a.40.2',
            stats = this.stats = data.stats;
      if (sn === 'initSegment') {
        this.state = State.IDLE;

        stats.tparsed = stats.tbuffered = performance.now();
        details.initSegment.data = data.payload;
        this.hls.trigger(Event.FRAG_BUFFERED, {stats: stats, frag: fragCurrent, id : 'audio'});
        this.tick();
      } else {
        this.state = State.PARSING;
        // transmux the MPEG-TS data to ISO-BMFF segments
        this.appended = false;
        if(!this.demuxer) {
          this.demuxer = new Demuxer(this.hls,'audio');
        }
        //Check if we have video initPTS
        // If not we need to wait for it
        let initPTS = this.initPTS[cc];
        let initSegmentData = details.initSegment ? details.initSegment.data : [];
        if (details.initSegment || initPTS !== undefined) {
          this.pendingBuffering = true;
          logger.log(`Demuxing ${sn} of [${details.startSN} ,${details.endSN}],track ${trackId}`);
          // time Offset is accurate if level PTS is known, or if playlist is not sliding (not live)
          let accurateTimeOffset = false; //details.PTSKnown || !details.live;
          this.demuxer.push(data.payload, initSegmentData, audioCodec, null, fragCurrent, duration, accurateTimeOffset, initPTS);
        } else {
          logger.log(`unknown video PTS for continuity counter ${cc}, waiting for video PTS before demuxing audio frag ${sn} of [${details.startSN} ,${details.endSN}],track ${trackId}`);
          this.waitingFragment=data;
          this.state=State.WAITING_INIT_PTS;
        }
      }
    }
    this.fragLoadError = 0;
  }

  onFragParsingInitSegment(data) {
    const fragCurrent = this.fragCurrent;
    const fragNew = data.frag;
    if (fragCurrent &&
        data.id === 'audio' &&
        fragNew.sn === fragCurrent.sn &&
        fragNew.level === fragCurrent.level &&
        this.state === State.PARSING) {
      let tracks = data.tracks, track;

      // delete any video track found on audio demuxer
      if (tracks.video) {
        delete tracks.video;
      }

      // include levelCodec in audio and video tracks
      track = tracks.audio;
      if(track) {
        track.levelCodec = track.codec;
        track.id = data.id;
        this.hls.trigger(Event.BUFFER_CODECS,tracks);
        logger.log(`audio track:audio,container:${track.container},codecs[level/parsed]=[${track.levelCodec}/${track.codec}]`);
        let initSegment = track.initSegment;
        if (initSegment) {
          let appendObj = {type: 'audio', data: initSegment, parent : 'audio',content : 'initSegment'};
          if (this.audioSwitch) {
            this.pendingData = [appendObj];
          } else {
            this.appended = true;
            // arm pending Buffering flag before appending a segment
            this.pendingBuffering = true;
            this.hls.trigger(Event.BUFFER_APPENDING, appendObj);
          }
        }
        //trigger handler right now
        this.tick();
      }
    }
  }

  onFragParsingData(data) {
    const fragCurrent = this.fragCurrent;
    const fragNew = data.frag;
    if (fragCurrent &&
        data.id === 'audio' &&
        data.type === 'audio' &&
        fragNew.sn === fragCurrent.sn &&
        fragNew.level === fragCurrent.level &&
        this.state === State.PARSING) {
      let trackId= this.trackId,
          track = this.tracks[trackId],
          hls = this.hls;

      if (isNaN(data.endPTS)) {
        data.endPTS = data.startPTS + fragCurrent.duration;
        data.endDTS = data.startDTS + fragCurrent.duration;
      }

      logger.log(`parsed ${data.type},PTS:[${data.startPTS.toFixed(3)},${data.endPTS.toFixed(3)}],DTS:[${data.startDTS.toFixed(3)}/${data.endDTS.toFixed(3)}],nb:${data.nb}`);
      LevelHelper.updateFragPTSDTS(track.details,fragCurrent,data.startPTS,data.endPTS);

      let audioSwitch = this.audioSwitch, media = this.media, appendOnBufferFlush = false;
      //Only flush audio from old audio tracks when PTS is known on new audio track
      if(audioSwitch && media) {
        if (media.readyState) {
          let currentTime = media.currentTime;
          logger.log('switching audio track : currentTime:'+ currentTime);
          if (currentTime >= data.startPTS) {
            logger.log('switching audio track : flushing all audio');
            this.state = State.BUFFER_FLUSHING;
            hls.trigger(Event.BUFFER_FLUSHING, {startOffset: 0 , endOffset: Number.POSITIVE_INFINITY, type : 'audio'});
            appendOnBufferFlush = true;
            //Lets announce that the initial audio track switch flush occur
            this.audioSwitch = false;
            hls.trigger(Event.AUDIO_TRACK_SWITCHED, {id : trackId});
          }
        } else {
          //Lets announce that the initial audio track switch flush occur
          this.audioSwitch=false;
          hls.trigger(Event.AUDIO_TRACK_SWITCHED, {id : trackId});
        }
      }


      let pendingData = this.pendingData;
      if(!this.audioSwitch) {
        [data.data1, data.data2].forEach(buffer => {
          if (buffer && buffer.length) {
            pendingData.push({type: data.type, data: buffer, parent : 'audio',content : 'data'});
          }
        });
      if (!appendOnBufferFlush && pendingData.length) {
          pendingData.forEach(appendObj => {
            // only append in PARSING state (rationale is that an appending error could happen synchronously on first segment appending)
            // in that case it is useless to append following segments
            if (this.state === State.PARSING) {
              // arm pending Buffering flag before appending a segment
              this.pendingBuffering = true;
              this.hls.trigger(Event.BUFFER_APPENDING, appendObj);
            }
          });
          this.pendingData = [];
          this.appended = true;
        }
      }
      //trigger handler right now
      this.tick();
    }
  }

  onFragParsed(data) {
    const fragCurrent = this.fragCurrent;
    const fragNew = data.frag;
    if (fragCurrent &&
        data.id === 'audio' &&
        fragNew.sn === fragCurrent.sn &&
        fragNew.level === fragCurrent.level &&
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
    if (data.tracks.video) {
      this.videoBuffer = data.tracks.video.buffer;
    }
  }

  onBufferAppended(data) {
    if (data.parent === 'audio') {
      const state = this.state;
      if (state === State.PARSING || state === State.PARSED) {
        // check if all buffers have been appended
        this.pendingBuffering = (data.pending > 0);
        this._checkAppendedParsed();
      }
    }
  }

  _checkAppendedParsed() {
    //trigger handler right now
    if (this.state === State.PARSED && (!this.appended || !this.pendingBuffering))   {
      let frag = this.fragCurrent, stats = this.stats, hls = this.hls;
      if (frag) {
        this.fragPrevious = frag;
        stats.tbuffered = performance.now();
        hls.trigger(Event.FRAG_BUFFERED, {stats: stats, frag: frag, id : 'audio'});
        let media = this.mediaBuffer ? this.mediaBuffer : this.media;
        logger.log(`audio buffered : ${TimeRanges.toString(media.buffered)}`);
        if (this.audioSwitch && this.appended) {
          this.audioSwitch = false;
          hls.trigger(Event.AUDIO_TRACK_SWITCHED, {id : this.trackId});
        }
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
            // switch error to fatal
            data.fatal = true;
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
      case ErrorDetails.BUFFER_FULL_ERROR:
        // if in appending state
        if (data.parent === 'audio' && (this.state === State.PARSING || this.state === State.PARSED)) {
          const media = this.mediaBuffer,
                currentTime = this.media.currentTime,
                mediaBuffered = media && BufferHelper.isBuffered(media,currentTime) && BufferHelper.isBuffered(media,currentTime+0.5);
          // reduce max buf len if current position is buffered
          if (mediaBuffered) {
            const config = this.config;
            if(config.maxMaxBufferLength >= config.maxBufferLength) {
              // reduce max buffer length as it might be too high. we do this to avoid loop flushing ...
              config.maxMaxBufferLength/=2;
              logger.warn(`audio:reduce max buffer length to ${config.maxMaxBufferLength}s`);
              // increase fragment load Index to avoid frag loop loading error after buffer flush
              this.fragLoadIdx += 2 * config.fragLoadingLoopThreshold;
            }
            this.state = State.IDLE;
          } else {
            // current position is not buffered, but browser is still complaining about buffer full error
            // this happens on IE/Edge, refer to https://github.com/video-dev/hls.js/pull/708
            // in that case flush the whole audio buffer to recover
            logger.warn('buffer full error also media.currentTime is not buffered, flush audio buffer');
            this.fragCurrent = null;
            // flush everything
            this.state = State.BUFFER_FLUSHING;
            this.hls.trigger(Event.BUFFER_FLUSHING, {startOffset: 0 , endOffset: Number.POSITIVE_INFINITY, type : 'audio'});
          }
        }
        break;
      default:
        break;
    }
  }

  onBufferFlushed() {
    let pendingData = this.pendingData;
    if (pendingData && pendingData.length) {
      logger.log('appending pending audio data on Buffer Flushed');
      pendingData.forEach(appendObj => {
        this.hls.trigger(Event.BUFFER_APPENDING, appendObj);
      });
      this.appended = true;
      this.pendingData = [];
      this.state = State.PARSED;
    } else {
      // move to IDLE once flush complete. this should trigger new fragment loading
      this.state = State.IDLE;
      // reset reference to frag
      this.fragPrevious = null;
      this.tick();
    }
  }
}
export default AudioStreamController;

