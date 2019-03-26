/*
 * Audio Stream Controller
*/

import { BufferHelper } from '../utils/buffer-helper';
import TransmuxerInterface from '../demux/transmuxer-interface';
import Event from '../events';
import * as LevelHelper from './level-helper';
import TimeRanges from '../utils/time-ranges';
import { ErrorTypes, ErrorDetails } from '../errors';
import { logger } from '../utils/logger';
import { findFragWithCC } from '../utils/discontinuities';
import { FragmentState } from './fragment-tracker';
import { ElementaryStreamTypes } from '../loader/fragment';
import BaseStreamController, { State } from './base-stream-controller';
import FragmentLoader from '../loader/fragment-loader';
import { findFragmentByPTS } from './fragment-finders';
import { prependUint8Array } from '../utils/mp4-tools';

const { performance } = window;

const TICK_INTERVAL = 100; // how often to tick in ms

class AudioStreamController extends BaseStreamController {
  constructor (hls, fragmentTracker) {
    super(hls,
      Event.MEDIA_ATTACHED,
      Event.MEDIA_DETACHING,
      Event.AUDIO_TRACKS_UPDATED,
      Event.AUDIO_TRACK_SWITCHING,
      Event.AUDIO_TRACK_LOADED,
      Event.KEY_LOADED,
      Event.ERROR,
      Event.BUFFER_RESET,
      Event.BUFFER_CREATED,
      Event.BUFFER_APPENDED,
      Event.BUFFER_FLUSHED,
      Event.INIT_PTS_FOUND);
    this.fragmentTracker = fragmentTracker;
    this.config = hls.config;
    this.audioCodecSwap = false;
    this._state = State.STOPPED;
    this.initPTS = [];
    this.waitingFragment = null;
    this.videoTrackCC = null;
    this.fragmentLoader = new FragmentLoader(hls.config);
    this.levels = [];
  }

  // INIT_PTS_FOUND is triggered when the video track parsed in the stream-controller has a new PTS value
  onInitPtsFound ({ frag, initPTS }) {
    // Always update the new INIT PTS
    // Can change due level switch
    const cc = frag.cc;
    this.initPTS[cc] = initPTS;
    this.videoTrackCC = cc;
    logger.log(`InitPTS for cc: ${cc} found from video track: ${initPTS}`);
    // If we are waiting, tick immediately to unblock audio fragment transmuxing
    if (this.state === State.WAITING_INIT_PTS) {
      this.tick();
    }
  }

  startLoad (startPosition) {
    if (this.levels) {
      let lastCurrentTime = this.lastCurrentTime;
      this.stopLoad();
      this.setInterval(TICK_INTERVAL);
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

  set state (nextState) {
    if (this.state !== nextState) {
      const previousState = this.state;
      this._state = nextState;
      logger.log(`audio stream:${previousState}->${nextState}`);
    }
  }

  get state () {
    return this._state;
  }

  doTick () {
    let pos, track, trackDetails, hls = this.hls, config = hls.config;
    // logger.log('audioStream:' + this.state);
    switch (this.state) {
    case State.ERROR:
      // don't do anything in error state to avoid breaking further ...
    case State.PAUSED:
      // don't do anything in paused state either ...
    case State.BUFFER_FLUSHING:
      break;
    case State.STARTING:
      this.state = State.WAITING_TRACK;
      this.loadedmetadata = false;
      break;
    case State.IDLE:
      const levels = this.levels;
      // audio tracks not received => exit loop
      if (!levels) {
        break;
      }

      // if video not attached AND
      // start fragment already requested OR start frag prefetch disable
      // exit loop
      // => if media not attached but start frag prefetch is enabled and start frag not requested yet, we will not exit loop
      if (!this.media && (this.startFragRequested || !config.startFragPrefetch)) {
        break;
      }

      // determine next candidate fragment to be loaded, based on current position and
      //  end of buffer position
      // if we have not yet loaded any fragment, start loading from start position
      if (this.loadedmetadata) {
        pos = this.media.currentTime;
      } else {
        pos = this.nextLoadPosition;
        if (!Number.isFinite(pos)) {
          break;
        }
      }

      let media = this.mediaBuffer ? this.mediaBuffer : this.media;
      const videoBuffer = this.videoBuffer ? this.videoBuffer : this.media;
      const bufferInfo = BufferHelper.bufferInfo(media, pos, config.maxBufferHole);
      const mainBufferInfo = BufferHelper.bufferInfo(videoBuffer, pos, config.maxBufferHole);
      const bufferLen = bufferInfo.len;
      const fragPrevious = this.fragPrevious;// ensure we buffer at least config.maxBufferLength (default 30s) or config.maxMaxBufferLength (default: 600s) // whichever is smaller. // once we reach that threshold, don't buffer more than video (mainBufferInfo.len)
      const maxConfigBuffer = Math.min(config.maxBufferLength, config.maxMaxBufferLength);
      const maxBufLen = Math.max(maxConfigBuffer, mainBufferInfo.len);
      const audioSwitch = this.audioSwitch;
      const trackId = this.trackId;

      // if buffer length is less than maxBufLen try to load a new fragment
      if ((bufferLen < maxBufLen || audioSwitch) && trackId < levels.length) {
        trackDetails = levels[trackId].details;
        // if track info not retrieved yet, switch state and wait for track retrieval
        if (typeof trackDetails === 'undefined') {
          this.state = State.WAITING_TRACK;
          break;
        }

        if (!audioSwitch && this._streamEnded(bufferInfo, trackDetails)) {
          this.hls.trigger(Event.BUFFER_EOS, { type: 'audio' });
          this.state = State.ENDED;
          return;
        }

        // find fragment index, contiguous with end of buffer position
        const fragments = trackDetails.fragments;
        const fragLen = fragments.length;
        const end = fragments[fragLen - 1].start + fragments[fragLen - 1].duration;
        let start = fragments[0].start;
        let frag;

        // When switching audio track, reload audio as close as possible to currentTime
        let bufferEnd = bufferInfo.end;
        if (audioSwitch) {
          if (trackDetails.live && !trackDetails.PTSKnown) {
            logger.log('switching audiotrack, live stream, unknown PTS,load first fragment');
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
        } else if (bufferEnd <= start) {
          // If bufferEnd is before the start of the playlist, load the first fragment
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
          if (bufferEnd < end) {
            if (bufferEnd > end - maxFragLookUpTolerance) {
              maxFragLookUpTolerance = 0;
            }
            foundFrag = findFragmentByPTS(fragPrevious, fragments, bufferEnd, maxFragLookUpTolerance);
          } else {
            // reach end of playlist
            foundFrag = fragments[fragLen - 1];
          }
          if (foundFrag) {
            frag = foundFrag;
            start = foundFrag.start;
            // logger.log('find SN matching with pos:' +  bufferEnd + ':' + frag.sn);
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
        if (!frag) {
          return;
        }
        // logger.log('      loading frag ' + i +',pos/bufEnd:' + pos.toFixed(3) + '/' + bufferEnd.toFixed(3));
        if (frag.encrypted) {
          logger.log(`Loading key for ${frag.sn} of [${trackDetails.startSN} ,${trackDetails.endSN}],track ${trackId}`);
          this.state = State.KEY_LOADING;
          hls.trigger(Event.KEY_LOADING, { frag: frag });
        } else {
          logger.log(`Loading ${frag.sn}, cc: ${frag.cc} of [${trackDetails.startSN} ,${trackDetails.endSN}],track ${trackId}, currentTime:${pos},bufferEnd:${bufferEnd.toFixed(3)}`);
          // only load if fragment is not loaded or if in audio switch
          // we force a frag loading in audio switch as fragment tracker might not have evicted previous frags in case of quick audio switch
          const fragState = this.fragmentTracker.getState(frag);
          this.fragCurrent = frag;
          this.startFragRequested = true;
          if (Number.isFinite(frag.sn)) {
            this.nextLoadPosition = frag.start + frag.duration;
          }
          if (audioSwitch || fragState === FragmentState.NOT_LOADED) {
            if (frag.sn === 'initSegment') {
              this._loadInitSegment(frag);
            } else if (trackDetails.initSegment || Number.isFinite(this.initPTS[frag.cc])) {
              this._loadFragForPlayback(frag);
            } else {
              logger.log(`Unknown video PTS for continuity counter ${frag.cc}, waiting for video PTS before loading audio frag ${frag.sn} of [${trackDetails.startSN} ,${trackDetails.endSN}],track ${trackId}`);
              this.state = State.WAITING_INIT_PTS;
            }
          }
        }
      }
      break;
    case State.WAITING_TRACK:
      track = this.levels[this.trackId];
      // check if playlist is already loaded
      if (track && track.details) {
        this.state = State.WAITING_INIT_PTS;
      }

      break;
    case State.FRAG_LOADING_WAITING_RETRY:
      var now = performance.now();
      var retryDate = this.retryDate;
      media = this.media;
      var isSeeking = media && media.seeking;
      // if current time is gt than retryDate, or if media seeking let's switch to IDLE state to retry loading
      if (!retryDate || (now >= retryDate) || isSeeking) {
        logger.log('audioStreamController: retryDate reached, switch back to IDLE state');
        this.state = State.IDLE;
      }
      break;
    case State.WAITING_INIT_PTS:
      const videoTrackCC = this.videoTrackCC;
      if (Number.isFinite(this.initPTS[videoTrackCC])) {
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

  onMediaAttached (data) {
    let media = this.media = this.mediaBuffer = data.media;
    this.onvseeking = this.onMediaSeeking.bind(this);
    this.onvended = this.onMediaEnded.bind(this);
    media.addEventListener('seeking', this.onvseeking);
    media.addEventListener('ended', this.onvended);
    let config = this.config;
    if (this.levels && config.autoStartLoad) {
      this.startLoad(config.startPosition);
    }
  }

  onMediaDetaching () {
    let media = this.media;
    if (media && media.ended) {
      logger.log('MSE detaching and video ended, reset startPosition');
      this.startPosition = this.lastCurrentTime = 0;
    }

    // remove video listeners
    if (media) {
      media.removeEventListener('seeking', this.onvseeking);
      media.removeEventListener('ended', this.onvended);
      this.onvseeking = this.onvseeked = this.onvended = null;
    }
    this.media = this.mediaBuffer = this.videoBuffer = null;
    this.loadedmetadata = false;
    this.stopLoad();
  }

  onAudioTracksUpdated (data) {
    logger.log('audio tracks updated');
    this.levels = data.audioTracks;
  }

  onAudioTrackSwitching (data) {
    // if any URL found on new audio track, it is an alternate audio track
    let altAudio = !!data.url;
    this.trackId = data.id;

    this.fragCurrent = null;
    this.state = State.PAUSED;
    this.waitingFragment = null;
    // destroy useless transmuxer when switching audio to main
    if (!altAudio) {
      if (this.transmuxer) {
        this.transmuxer.destroy();
        this.transmuxer = null;
      }
    } else {
      // switching to audio track, start timer if not already started
      this.setInterval(TICK_INTERVAL);
    }

    // should we switch tracks ?
    if (altAudio) {
      this.audioSwitch = true;
      // main audio track are handled by stream-controller, just do something if switching to alt audio track
      this.state = State.IDLE;
    }
    this.tick();
  }

  onAudioTrackLoaded (data) {
    let newDetails = data.details,
      trackId = data.id,
      track = this.levels[trackId],
      duration = newDetails.totalduration,
      sliding = 0;

    logger.log(`track ${trackId} loaded [${newDetails.startSN},${newDetails.endSN}],duration:${duration}`);

    if (newDetails.live) {
      let curDetails = track.details;
      if (curDetails && newDetails.fragments.length > 0) {
        // we already have details for that level, merge them
        LevelHelper.mergeDetails(curDetails, newDetails);
        sliding = newDetails.fragments[0].start;
        // TODO
        // this.liveSyncPosition = this.computeLivePosition(sliding, curDetails);
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
        if (Number.isFinite(startTimeOffset)) {
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

    // trigger handler right now
    this.tick();
  }

  onKeyLoaded () {
    if (this.state === State.KEY_LOADING) {
      this.state = State.IDLE;
      this.tick();
    }
  }

  _handleFragmentLoad (frag, payload, stats) {
    const { config, trackId, levels } = this;
    let { transmuxer } = this;
    const { cc, sn } = frag;
    const track = levels[trackId];
    const details = track.details;
    const audioCodec = config.defaultAudioCodec || track.audioCodec || 'mp4a.40.2';
    this.stats = stats;
    this.state = State.PARSING;
    // transmux the MPEG-TS data to ISO-BMFF segments
    this.appended = false;
    if (!transmuxer) {
      transmuxer = this.transmuxer =
          new TransmuxerInterface(this.hls, 'audio', this._handleTransmuxComplete.bind(this), this._handleTransmuxerFlush.bind(this));
    }

    // Check if we have video initPTS
    // If not we need to wait for it
    const initPTS = this.initPTS[cc];
    const initSegmentData = details.initSegment ? details.initSegment.data : [];
    this.pendingBuffering = true;
    logger.log(`Transmuxing ${sn} of [${details.startSN} ,${details.endSN}],track ${trackId}`);
    // time Offset is accurate if level PTS is known, or if playlist is not sliding (not live)
    let accurateTimeOffset = false; // details.PTSKnown || !details.live;
    const transmuxIdentifier = { level: frag.level, sn: frag.sn };
    transmuxer.push(payload, initSegmentData, audioCodec, null, frag, details.totalduration, accurateTimeOffset, initPTS, transmuxIdentifier);
    transmuxer.flush(transmuxIdentifier);
  }

  _handleFragmentLoadComplete (frag, stats) {
    super._handleFragmentLoadComplete(frag, stats);
  }

  onBufferReset () {
    // reset reference to sourcebuffers
    this.mediaBuffer = this.videoBuffer = null;
    this.loadedmetadata = false;
  }

  onBufferCreated (data) {
    let audioTrack = data.tracks.audio;
    if (audioTrack) {
      this.mediaBuffer = audioTrack.buffer;
      this.loadedmetadata = true;
    }
    if (data.tracks.video) {
      this.videoBuffer = data.tracks.video.buffer;
    }
  }

  onBufferAppended (data) {
    if (data.parent === 'audio') {
      const state = this.state;
      if (state === State.PARSING || state === State.PARSED) {
        // check if all buffers have been appended
        this.pendingBuffering = (data.pending > 0);
        this._checkAppendedParsed();
      }
    }
  }

  _checkAppendedParsed () {
    // trigger handler right now
    if (this.state === State.PARSED && (!this.appended || !this.pendingBuffering)) {
      let frag = this.fragCurrent, stats = this.stats, hls = this.hls;
      if (frag) {
        this.fragPrevious = frag;
        stats.tbuffered = performance.now();
        hls.trigger(Event.FRAG_BUFFERED, { stats: stats, frag: frag, id: 'audio' });
        let media = this.mediaBuffer ? this.mediaBuffer : this.media;
        logger.log(`audio buffered : ${TimeRanges.toString(media.buffered)}`);
        if (this.audioSwitch && this.appended) {
          this.audioSwitch = false;
          hls.trigger(Event.AUDIO_TRACK_SWITCHED, { id: this.trackId });
        }
        this.state = State.IDLE;
      }
      this.tick();
    }
  }

  onError (data) {
    let frag = data.frag;
    // don't handle frag error not related to audio fragment
    if (frag && frag.type !== 'audio') {
      return;
    }

    switch (data.details) {
    case ErrorDetails.FRAG_LOAD_ERROR:
    case ErrorDetails.FRAG_LOAD_TIMEOUT:
      const frag = data.frag;
      // don't handle frag error not related to audio fragment
      if (frag && frag.type !== 'audio') {
        break;
      }

      if (!data.fatal) {
        let loadError = this.fragLoadError;
        if (loadError) {
          loadError++;
        } else {
          loadError = 1;
        }

        const config = this.config;
        if (loadError <= config.fragLoadingMaxRetry) {
          this.fragLoadError = loadError;
          // exponential backoff capped to config.fragLoadingMaxRetryTimeout
          const delay = Math.min(Math.pow(2, loadError - 1) * config.fragLoadingRetryDelay, config.fragLoadingMaxRetryTimeout);
          logger.warn(`AudioStreamController: frag loading failed, retry in ${delay} ms`);
          this.retryDate = performance.now() + delay;
          // retry loading state
          this.state = State.FRAG_LOADING_WAITING_RETRY;
        } else {
          logger.error(`AudioStreamController: ${data.details} reaches max retry, redispatch as fatal ...`);
          // switch error to fatal
          data.fatal = true;
          this.state = State.ERROR;
        }
      }
      break;
    case ErrorDetails.AUDIO_TRACK_LOAD_ERROR:
    case ErrorDetails.AUDIO_TRACK_LOAD_TIMEOUT:
    case ErrorDetails.KEY_LOAD_ERROR:
    case ErrorDetails.KEY_LOAD_TIMEOUT:
      //  when in ERROR state, don't switch back to IDLE state in case a non-fatal error is received
      if (this.state !== State.ERROR) {
        // if fatal error, stop processing, otherwise move to IDLE to retry loading
        this.state = data.fatal ? State.ERROR : State.IDLE;
        logger.warn(`AudioStreamController: ${data.details} while loading frag, now switching to ${this.state} state ...`);
      }
      break;
    case ErrorDetails.BUFFER_FULL_ERROR:
      // if in appending state
      if (data.parent === 'audio' && (this.state === State.PARSING || this.state === State.PARSED)) {
        const media = this.mediaBuffer,
          currentTime = this.media.currentTime,
          mediaBuffered = media && BufferHelper.isBuffered(media, currentTime) && BufferHelper.isBuffered(media, currentTime + 0.5);
          // reduce max buf len if current position is buffered
        if (mediaBuffered) {
          const config = this.config;
          if (config.maxMaxBufferLength >= config.maxBufferLength) {
            // reduce max buffer length as it might be too high. we do this to avoid loop flushing ...
            config.maxMaxBufferLength /= 2;
            logger.warn(`AudioStreamController: reduce max buffer length to ${config.maxMaxBufferLength}s`);
          }
          this.state = State.IDLE;
        } else {
          // current position is not buffered, but browser is still complaining about buffer full error
          // this happens on IE/Edge, refer to https://github.com/video-dev/hls.js/pull/708
          // in that case flush the whole audio buffer to recover
          logger.warn('AudioStreamController: buffer full error also media.currentTime is not buffered, flush audio buffer');
          this.fragCurrent = null;
          // flush everything
          this.state = State.BUFFER_FLUSHING;
          this.hls.trigger(Event.BUFFER_FLUSHING, { startOffset: 0, endOffset: Number.POSITIVE_INFINITY, type: 'audio' });
        }
      }
      break;
    default:
      break;
    }
  }

  onBufferFlushed () {
    let pendingData = this.pendingData;
    if (pendingData && pendingData.length) {
      logger.log('AudioStreamController: appending pending audio data after buffer flushed');
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

  _handleTransmuxComplete (transmuxResult) {
    const id = 'audio';
    const { hls, levels } = this;
    const { remuxResult, transmuxIdentifier: { level, sn } } = transmuxResult;

    // Check if the current fragment has been aborted. We check this by first seeing if we're still playing the current level.
    // If we are, subsequently check if the currently loading fragment (fragCurrent) has changed.
    // If nothing has changed by this point, allow the segment to be buffered.
    if (!levels) {
      return;
    }
    let frag = LevelHelper.getFragmentWithSN(levels[level], sn);
    if (!frag || frag !== this.fragCurrent) {
      return;
    }
    frag = this.fragCurrent;

    const { audio, text, id3, initSegment } = remuxResult;
    if (initSegment && initSegment.tracks) {
      this._bufferInitSegment(frag, initSegment.tracks);
      hls.trigger(Event.FRAG_PARSING_INIT_SEGMENT, { frag, id, tracks: initSegment.tracks });
    }
    if (audio) {
      this._bufferFragmentData(frag, audio);
    }
    if (id3) {
      id3.frag = frag;
      id3.id = id;
      hls.trigger(Event.FRAG_PARSING_METADATA, id3);
    }
    if (text) {
      text.frag = frag;
      text.id = id;
      hls.trigger(Event.FRAG_PARSING_USERDATA, text);
    }
  }

  _handleTransmuxerFlush () {
    this._endParsing();
  }

  _endParsing () {
    if (this.state !== State.PARSING) {
      return;
    }
    this.stats.tparsed = window.performance.now();
    this.state = State.PARSED;
    this._checkAppendedParsed();
  }

  _bufferInitSegment (frag, tracks) {
    if (this.state !== State.PARSING) {
      return;
    }
    // delete any video track found on audio transmuxer
    if (tracks.video) {
      delete tracks.video;
    }

    // include levelCodec in audio and video tracks
    const track = tracks.audio;
    if (!track) {
      return;
    }

    track.levelCodec = track.codec;
    track.id = 'audio';
    this.hls.trigger(Event.BUFFER_CODECS, tracks);
    logger.log(`audio track:audio,container:${track.container},codecs[level/parsed]=[${track.levelCodec}/${track.codec}]`);
    let initSegment = track.initSegment;
    if (initSegment) {
      let appendObj = { type: 'audio', data: initSegment, parent: 'audio', content: 'initSegment' };
      if (this.audioSwitch) {
        this.pendingData = [appendObj];
      } else {
        this.appended = true;
        // arm pending Buffering flag before appending a segment
        this.pendingBuffering = true;
        this.hls.trigger(Event.BUFFER_APPENDING, appendObj);
      }
    }
    // trigger handler right now
    this.tick();
  }

  _bufferFragmentData (frag, data) {
    if (this.state !== State.PARSING) {
      return;
    }

    frag.addElementaryStream(ElementaryStreamTypes.AUDIO);
    if (!Number.isFinite(data.endPTS)) {
      data.endPTS = data.startPTS + frag.duration;
      data.endDTS = data.startDTS + frag.duration;
    }
    logger.log(`parsed ${data.type},PTS:[${data.startPTS.toFixed(3)},${data.endPTS.toFixed(3)}],DTS:[${data.startDTS.toFixed(3)}/${data.endDTS.toFixed(3)}],nb:${data.nb}`);

    const { audioSwitch, hls, levels, media, pendingData, trackId } = this;
    const track = levels[trackId];
    LevelHelper.updateFragPTSDTS(track.details, frag, data.startPTS, data.endPTS);
    let appendOnBufferFlush = false;
    // Only flush audio from old audio tracks when PTS is known on new audio track
    if (audioSwitch) {
      if (media && media.readyState) {
        if (media.currentTime >= data.startPTS) {
          logger.log('switching audio track : flushing all audio');
          this.state = State.BUFFER_FLUSHING;
          hls.trigger(Event.BUFFER_FLUSHING, {
            startOffset: 0,
            endOffset: Number.POSITIVE_INFINITY,
            type: 'audio'
          });
          appendOnBufferFlush = true;
        }
      }
      this.audioSwitch = false;
      hls.trigger(Event.AUDIO_TRACK_SWITCHED, { id: trackId });
    }

    if (!this.pendingData) {
      hls.trigger(Event.ERROR, { type: ErrorTypes.MEDIA_ERROR, details: null, fatal: true });
      return;
    }

    if (!this.audioSwitch) {
      [data.data1, data.data2].forEach(buffer => {
        if (buffer && buffer.length) {
          pendingData.push({ type: data.type, data: buffer, parent: 'audio', content: 'data' });
        }
      });
      if (!appendOnBufferFlush && pendingData.length) {
        pendingData.forEach(appendObj => {
          // only append in PARSING state (rationale is that an appending error could happen synchronously on first segment appending)
          // in that case it is useless to append following segments
          if (this.state === State.PARSING) {
            // arm pending Buffering flag before appending a segment
            this.pendingBuffering = true;
            hls.trigger(Event.BUFFER_APPENDING, appendObj);
          }
        });
        this.pendingData = [];
        this.appended = true;
      }
    }
    // trigger handler right now
    this.tick();
  }
}
export default AudioStreamController;
