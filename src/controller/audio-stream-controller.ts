import { BufferHelper } from '../utils/buffer-helper';
import TransmuxerInterface from '../demux/transmuxer-interface';
import Event from '../events';
import * as LevelHelper from './level-helper';
import TimeRanges from '../utils/time-ranges';
import { ErrorDetails, ErrorTypes } from '../errors';
import { logger } from '../utils/logger';
import { findFragWithCC } from '../utils/discontinuities';
import { FragmentState } from './fragment-tracker';
import { ElementaryStreamTypes } from '../loader/fragment';
import BaseStreamController, { State } from './base-stream-controller';
import FragmentLoader from '../loader/fragment-loader';
import { findFragmentByPTS } from './fragment-finders';

const { performance } = window;

const TICK_INTERVAL = 100; // how often to tick in ms

class AudioStreamController extends BaseStreamController {
  private startFragRequested: boolean = false;
  private retryDate: number = 0;
  private onvseeking: Function | null = null;
  private onvseeked: Function | null = null;
  private onvended: Function | null = null;
  private videoBuffer: any | null = null;
  private initPTS: any = [];
  private videoTrackCC: number = -1;
  private audioSwitch: boolean = false;
  private trackId: number = -1;

  protected readonly logPrefix = '[audio-stream-controller]';

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
      Event.BUFFER_FLUSHED,
      Event.INIT_PTS_FOUND,
      Event.FRAG_BUFFERED
    );

    this.config = hls.config;
    this.fragmentTracker = fragmentTracker;
    this.fragmentLoader = new FragmentLoader(hls.config);
  }

  // INIT_PTS_FOUND is triggered when the video track parsed in the stream-controller has a new PTS value
  onInitPtsFound ({ frag, initPTS }) {
    // Always update the new INIT PTS
    // Can change due level switch
    const cc = frag.cc;
    this.initPTS[cc] = initPTS;
    this.videoTrackCC = cc;
    this.log(`InitPTS for cc: ${cc} found from video track: ${initPTS}`);
    // If we are waiting, tick immediately to unblock audio fragment transmuxing
    if (this.state === State.WAITING_INIT_PTS) {
      this.tick();
    }
  }

  startLoad (startPosition) {
    if (!this.levels) {
      this.startPosition = startPosition;
      this.state = State.STOPPED;
      return;
    }
    let lastCurrentTime = this.lastCurrentTime;
    this.stopLoad();
    this.setInterval(TICK_INTERVAL);
    this.fragLoadError = 0;
    if (lastCurrentTime > 0 && startPosition === -1) {
      this.log(`Override startPosition with lastCurrentTime @${lastCurrentTime.toFixed(3)}`);
      this.state = State.IDLE;
    } else {
      this.lastCurrentTime = this.startPosition ? this.startPosition : startPosition;
      this.state = State.STARTING;
    }
    this.nextLoadPosition = this.startPosition = this.lastCurrentTime;
    this.tick();
  }

  doTick () {
    let pos, trackDetails, hls = this.hls, config = hls.config;
    switch (this.state) {
    case State.ERROR:
      // don't do anything in error state to avoid breaking further ...
        break;
      case State.PAUSED:
      // TODO: Remove useless PAUSED state
      // don't do anything in paused state either ...
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

      const trackId = this.trackId;
      if (!levels || !levels[trackId]) {
        return;
      }
      const levelInfo = levels[trackId];

      let media = this.mediaBuffer ? this.mediaBuffer : this.media;
      const videoBuffer = this.videoBuffer ? this.videoBuffer : this.media;
      const bufferInfo = BufferHelper.bufferInfo(media, pos, config.maxBufferHole);
      const mainBufferInfo = BufferHelper.bufferInfo(videoBuffer, pos, config.maxBufferHole);
      const bufferLen = bufferInfo.len;
      const fragPrevious = this.fragPrevious;// ensure we buffer at least config.maxBufferLength (default 30s) or config.maxMaxBufferLength (default: 600s) // whichever is smaller. // once we reach that threshold, don't buffer more than video (mainBufferInfo.len)
      const maxConfigBuffer = Math.min(config.maxBufferLength, config.maxMaxBufferLength);
      const maxBufLen = Math.max(maxConfigBuffer, mainBufferInfo.len);
      const audioSwitch = this.audioSwitch;

      // if buffer length is less than maxBufLen try to load a new fragment
      if (bufferLen < maxBufLen || audioSwitch) {
        trackDetails = levelInfo.details;
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
            this.log('Switching audiotrack, live stream, unknown PTS,load first fragment');
            bufferEnd = 0;
          } else {
            bufferEnd = pos;
            // if currentTime (pos) is less than alt audio playlist start time, it means that alt audio is ahead of currentTime
            if (trackDetails.PTSKnown && pos < start) {
              // if everything is buffered from pos to start or if audio buffer upfront, let's seek to start
              if (bufferInfo.end > start || bufferInfo.nextStart) {
                this.log('Alt audio track ahead of main track, seek to start of alt audio track');
                this.media.currentTime = start + 0.05;
              } else {
                return;
              }
            }
          }
        }
        if (trackDetails.initSegment && !trackDetails.initSegment.data) {
          frag = trackDetails.initSegment;
        } else if (bufferEnd < start) {
          // If bufferEnd is before the start of the playlist, load the first fragment
          frag = fragments[0];
          if (this.videoTrackCC > -1 && frag.cc !== this.videoTrackCC) {
            // Ensure we find a fragment which matches the continuity of the video track
            frag = findFragWithCC(fragments, this.videoTrackCC);
          }
          if (trackDetails.live) {
            // we just loaded this first fragment, and we are still lagging behind the start of the live playlist
            // let's force seek to start
            const nextBuffered = bufferInfo.nextStart ? bufferInfo.nextStart : start;
            this.log(`No alt audio available @currentTime:${this.media.currentTime}, seeking @${nextBuffered + 0.05}`);
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
            // this.log('Find SN matching with pos:' +  bufferEnd + ':' + frag.sn);
            if (fragPrevious && frag.level === fragPrevious.level && frag.sn === fragPrevious.sn) {
              if (frag.sn < trackDetails.endSN) {
                frag = fragments[frag.sn + 1 - trackDetails.startSN];
                this.log(`SN just loaded, load next one: ${frag.sn}`);
              } else {
                frag = null;
              }
            }
          }
        }
        if (!frag) {
          return;
        }
        // this.log('      loading frag ' + i +',pos/bufEnd:' + pos.toFixed(3) + '/' + bufferEnd.toFixed(3));
        if (frag.encrypted) {
          this.log(`Loading key for ${frag.sn} of [${trackDetails.startSN} ,${trackDetails.endSN}],track ${trackId}`);
          this.state = State.KEY_LOADING;
          hls.trigger(Event.KEY_LOADING, { frag: frag });
        } else {
          this.log(`Loading ${frag.sn}, cc: ${frag.cc} of [${trackDetails.startSN} ,${trackDetails.endSN}],track ${trackId}, currentTime:${pos},bufferEnd:${bufferEnd.toFixed(3)}`);
          this.loadFragment(frag);
        }
      }
      break;
    case State.WAITING_TRACK: {
      const {levels, trackId} = this;
      if (levels && levels[trackId] && levels[trackId].details) {
        // check if playlist is already loaded
        this.state = State.WAITING_INIT_PTS;
      }
      break;
    }
    case State.FRAG_LOADING_WAITING_RETRY:
      var now = performance.now();
      var retryDate = this.retryDate;
      media = this.media;
      var isSeeking = media && media.seeking;
      // if current time is gt than retryDate, or if media seeking let's switch to IDLE state to retry loading
      if (!retryDate || (now >= retryDate) || isSeeking) {
        this.log('RetryDate reached, switch back to IDLE state');
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

    const media = this.media;
    if (media) {
      if (media.currentTime > this.lastCurrentTime) {
        this.lastCurrentTime = media.currentTime;
      }
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
      this.log('MSE detaching and video ended, reset startPosition');
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
    this.log('Audio tracks updated');
    this.levels = data.audioTracks;
  }

  onAudioTrackSwitching (data) {
    // if any URL found on new audio track, it is an alternate audio track
    let altAudio = !!data.url;
    this.trackId = data.id;
    const { fragCurrent, transmuxer } = this;

    if (fragCurrent && fragCurrent.loader) {
     fragCurrent.loader.abort();
    }
    this.fragCurrent = null;
    // destroy useless transmuxer when switching audio to main
    if (!altAudio) {
      if (transmuxer) {
        transmuxer.destroy();
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
    } else {
      this.state = State.PAUSED;
    }
    this.tick();
  }

  onAudioTrackLoaded (data) {
    const { levels } = this;
    const { details: newDetails, totalduration: duration, id: trackId, } =  data;
    if (!levels) {
      this.warn(`Audio tracks were reset while loading level ${trackId}`);
      return;
    }
    this.log(`Track ${trackId} loaded [${newDetails.startSN},${newDetails.endSN}],duration:${duration}`);

    const track = levels[trackId];
    let sliding = 0;
    if (newDetails.live) {
      let curDetails = track.details;
      if (curDetails && newDetails.fragments.length > 0) {
        // we already have details for that level, merge them
        LevelHelper.mergeDetails(curDetails, newDetails);
        sliding = newDetails.fragments[0].start;
        // TODO : this.liveSyncPosition = this.computeLivePosition(sliding, curDetails);
        if (newDetails.PTSKnown) {
          this.log(`Live audio playlist sliding:${sliding.toFixed(3)}`);
        } else {
          this.log('Live audio playlist - outdated PTS, unknown sliding');
        }
      } else {
        newDetails.PTSKnown = false;
        this.log('Live audio playlist - first load, unknown sliding');
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
          this.log(`Start time offset found in playlist, adjust startPosition to ${startTimeOffset}`);
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

  _handleFragmentLoadProgress (frag, payload) {
    const { config, trackId, levels } = this;
    if (!levels) {
      this.warn(`Audio tracks were reset while fragment load was in progress. Fragment ${frag.sn} of level ${frag.level} will not be buffered`);
      return;
    }

    const track = levels[trackId];
    const details = track.details;
    const audioCodec = config.defaultAudioCodec || track.audioCodec || 'mp4a.40.2';

    let transmuxer = this.transmuxer;
    if (!transmuxer) {
      transmuxer = this.transmuxer =
          new TransmuxerInterface(this.hls, 'audio', this._handleTransmuxComplete.bind(this), this._handleTransmuxerFlush.bind(this));
    }

    // initPTS from the video track is required for transmuxing. It should exist before loading a fragment.
    const initPTS = this.initPTS[frag.cc];
    // TODO: Compile out asserts for production builds so that we can uncomment them
    // console.assert(Number.isFinite(initPTS), 'initPTS must exist, and must stay set, before and during fragment load');

    const initSegmentData = details.initSegment ? details.initSegment.data : [];
    // this.log(`Transmuxing ${sn} of [${details.startSN} ,${details.endSN}],track ${trackId}`);
    // time Offset is accurate if level PTS is known, or if playlist is not sliding (not live)
    let accurateTimeOffset = false; // details.PTSKnown || !details.live;
    const transmuxIdentifier = { level: frag.level, sn: frag.sn };
    transmuxer.push(payload, initSegmentData, audioCodec, '', frag, details.totalduration, accurateTimeOffset, transmuxIdentifier, initPTS);
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

  onFragBuffered (data) {
    const { frag } = data;
    if (frag && frag.type !== 'audio') {
      return;
    }
    if (this._fragLoadAborted(frag)) {
      // If a level switch was requested while a fragment was buffering, it will emit the FRAG_BUFFERED event upon completion
      // Avoid setting state back to IDLE or concluding the audio switch; otherwise, the switched-to track will not buffer
      this.warn(`Fragment ${frag.sn} of level ${frag.level} finished buffering, but was aborted. state: ${this.state}, audioSwitch: ${this.audioSwitch}`);
      return;
    }
    this.fragPrevious = frag;
    const media = this.mediaBuffer ? this.mediaBuffer : this.media;
    this.log(`Buffered fragment ${frag.sn} of level ${frag.level}. PTS:[${frag.startPTS},${frag.endPTS}],DTS:[${frag.startDTS}/${frag.endDTS}], Buffered: ${TimeRanges.toString(media.buffered)}`);
    if (this.audioSwitch && frag.sn !== 'initSegment') {
      this.audioSwitch = false;
      this.hls.trigger(Event.AUDIO_TRACK_SWITCHED, { id: this.trackId });
    }
    this.state = State.IDLE;
    this.tick();
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
          this.warn(`Frag loading failed, retry in ${delay} ms`);
          this.retryDate = performance.now() + delay;
          // retry loading state
          this.state = State.FRAG_LOADING_WAITING_RETRY;
        } else {
          logger.error(`${data.details} reaches max retry, redispatch as fatal ...`);
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
        this.warn(`${data.details} while loading frag, now switching to ${this.state} state ...`);
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
            this.warn(`Reduce max buffer length to ${config.maxMaxBufferLength}s`);
          }
          this.state = State.IDLE;
        } else {
          // current position is not buffered, but browser is still complaining about buffer full error
          // this happens on IE/Edge, refer to https://github.com/video-dev/hls.js/pull/708
          // in that case flush the whole audio buffer to recover
          this.warn('Buffer full error also media.currentTime is not buffered, flush audio buffer');
          this.fragCurrent = null;
          // flush everything
          this.hls.trigger(Event.BUFFER_FLUSHING, { startOffset: 0, endOffset: Number.POSITIVE_INFINITY, type: 'audio' });
        }
      }
      break;
    default:
      break;
    }
  }

  onBufferFlushed () {
    /* after successful buffer flushing, filter flushed fragments from bufferedFrags
      use mediaBuffered instead of media (so that we will check against video.buffered ranges in case of alt audio track)
    */
    const media = this.mediaBuffer ? this.mediaBuffer : this.media;
    if (media) {
      // filter fragments potentially evicted from buffer. this is to avoid memleak on live streams
      this.fragmentTracker.detectEvictedFragments(ElementaryStreamTypes.AUDIO, media.buffered);
    }
    // move to IDLE once flush complete. this should trigger new fragment loading
    this.state = State.IDLE;
    // reset reference to frag
    this.fragPrevious = null;
  }

  private _handleTransmuxComplete (transmuxResult) {
    const id = 'audio';
    const { hls } = this;
    const { remuxResult, transmuxIdentifier } = transmuxResult;

    const context = this.getCurrentContext(transmuxIdentifier);
    if (!context) {
      this.warn(`The loading context changed while buffering fragment ${transmuxIdentifier.sn} of level ${transmuxIdentifier.level}. This chunk will not be buffered.`);
      return;
    }
    const { frag } = context;
    const { audio, text, id3, initSegment } = remuxResult;

    this.state = State.PARSING;
    if (this.audioSwitch && audio) {
      this.completeAudioSwitch();
    }

    if (initSegment && initSegment.tracks) {
      this._bufferInitSegment(initSegment.tracks);
      hls.trigger(Event.FRAG_PARSING_INIT_SEGMENT, { frag, id, tracks: initSegment.tracks });
      // Only flush audio from old audio tracks when PTS is known on new audio track
    }
    if (audio) {
      frag.setElementaryStreamInfo(ElementaryStreamTypes.AUDIO, audio.startPTS, audio.endPTS, audio.startDTS, audio.endDTS);
      this.bufferFragmentData(audio, 'audio');
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

  private _bufferInitSegment (tracks) {
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
    this.log(`Audio, container:${track.container}, codecs[level/parsed]=[${track.levelCodec}/${track.codec}]`);
    let initSegment = track.initSegment;
    if (initSegment) {
      let appendObj = { type: 'audio', data: initSegment, parent: 'audio', content: 'initSegment' };
      this.hls.trigger(Event.BUFFER_APPENDING, appendObj);
    }
    // trigger handler right now
    this.tick();
  }

  private loadFragment (frag) {
    // only load if fragment is not loaded or if in audio switch
    // we force a frag loading in audio switch as fragment tracker might not have evicted previous frags in case of quick audio switch
    const fragState = this.fragmentTracker.getState(frag);
    this.fragCurrent = frag;
    this.startFragRequested = true;
    let prevPos = this.nextLoadPosition;

    if (!this.audioSwitch && fragState !== FragmentState.NOT_LOADED) {
      return;
    }

    if (frag.sn === 'initSegment') {
      this._loadInitSegment(frag);
    } else if (Number.isFinite(this.initPTS[frag.cc])) {
      this.nextLoadPosition = frag.start + frag.duration;
      this._loadFragForPlayback(frag);
    } else {
      this.log(`Unknown video PTS for continuity counter ${frag.cc}, waiting for video PTS before loading audio fragment ${frag.sn} of level ${this.trackId}`);
      this.state = State.WAITING_INIT_PTS;
      this.nextLoadPosition = prevPos;
    }
  }

  private completeAudioSwitch () {
    const { hls, media, trackId } = this;
    if (media) {
      this.warn('Switching audio track : flushing all audio');
      hls.trigger(Event.BUFFER_FLUSHING, {
        startOffset: 0,
        endOffset: Number.POSITIVE_INFINITY,
        type: 'audio'
      });
    }
    this.audioSwitch = false;
    hls.trigger(Event.AUDIO_TRACK_SWITCHED, { id: trackId });
  }
}
export default AudioStreamController;
