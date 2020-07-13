import { BufferHelper } from '../utils/buffer-helper';
import TransmuxerInterface from '../demux/transmuxer-interface';
import { Events } from '../events';
import { FragmentState, FragmentTracker } from './fragment-tracker';
import Fragment, { ElementaryStreamTypes } from '../loader/fragment';
import PlaylistLoader from '../loader/playlist-loader';
import TimeRanges from '../utils/time-ranges';
import { ErrorDetails } from '../errors';
import { logger } from '../utils/logger';
import GapController, { MAX_START_GAP_JUMP } from './gap-controller';
import BaseStreamController, { State } from './base-stream-controller';
import FragmentLoader from '../loader/fragment-loader';
import { ChunkMetadata, TransmuxerResult } from '../types/transmuxer';
import { Level } from '../types/level';
import LevelDetails from '../loader/level-details';
import { TrackSet } from '../types/track';
import { SourceBufferName } from '../types/buffer';
import {
  LevelLoadedData,
  ManifestParsedData,
  MediaAttachedData,
  AudioTrackSwitchingData,
  LevelsUpdatedData,
  AudioTrackSwitchedData,
  BufferCreatedData,
  ErrorData,
  FragParsingMetadataData, FragParsingUserdataData
} from '../types/events';
import Hls from '../hls';
import { NetworkComponentAPI } from '../types/component-api';

const TICK_INTERVAL = 100; // how often to tick in ms

export default class StreamController extends BaseStreamController implements NetworkComponentAPI {
  private audioCodecSwap: boolean = false;
  private bitrateTest: boolean = false;
  private gapController: GapController | null = null;
  private level: number = -1;
  private _forceStartLoad: boolean = false;
  private retryDate: number = 0;
  private altAudio: boolean = false;
  private audioOnly: boolean = false;
  private fragPlaying: Fragment | null = null;
  private previouslyPaused: boolean = false;
  private immediateSwitch: boolean = false;
  private onvplaying: EventListener | null = null;
  private onvseeking: EventListener | null = null;
  private onvseeked: EventListener | null = null;
  private onvended: EventListener | null = null;
  private fragLastKbps: number = 0;
  private stalled: boolean = false;
  private audioCodecSwitch: boolean = false;
  private videoBuffer: any | null = null;

  protected readonly logPrefix = '[stream-controller]';

  constructor (hls: Hls, fragmentTracker: FragmentTracker) {
    super(hls);
    this.fragmentLoader = new FragmentLoader(hls.config);
    this.config = hls.config;
    this.fragmentTracker = fragmentTracker;
    this.state = State.STOPPED;

    this._registerListeners();
  }

  private _registerListeners () {
    const { hls } = this;
    hls.on(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    hls.on(Events.MEDIA_DETACHING, this.onMediaDetaching, this);
    hls.on(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.on(Events.MANIFEST_PARSED, this.onManifestParsed, this);
    hls.on(Events.LEVEL_LOADING, this.onLevelLoading, this);
    hls.on(Events.LEVEL_LOADED, this.onLevelLoaded, this);
    hls.on(Events.KEY_LOADED, this.onKeyLoaded, this);
    hls.on(Events.FRAG_LOAD_EMERGENCY_ABORTED, this.onFragLoadEmergencyAborted, this);
    hls.on(Events.ERROR, this.onError, this);
    hls.on(Events.AUDIO_TRACK_SWITCHING, this.onAudioTrackSwitching, this);
    hls.on(Events.AUDIO_TRACK_SWITCHED, this.onAudioTrackSwitched, this);
    hls.on(Events.BUFFER_CREATED, this.onBufferCreated, this);
    hls.on(Events.BUFFER_FLUSHED, this.onBufferFlushed, this);
    hls.on(Events.LEVELS_UPDATED, this.onLevelsUpdated, this);
    hls.on(Events.FRAG_BUFFERED, this.onFragBuffered, this);
  }

  protected _unregisterListeners () {
    const { hls } = this;
    hls.off(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    hls.off(Events.MEDIA_DETACHING, this.onMediaDetaching, this);
    hls.off(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.off(Events.MANIFEST_PARSED, this.onManifestParsed, this);
    hls.off(Events.LEVEL_LOADED, this.onLevelLoaded, this);
    hls.off(Events.KEY_LOADED, this.onKeyLoaded, this);
    hls.off(Events.FRAG_LOAD_EMERGENCY_ABORTED, this.onFragLoadEmergencyAborted, this);
    hls.off(Events.ERROR, this.onError, this);
    hls.off(Events.AUDIO_TRACK_SWITCHING, this.onAudioTrackSwitching, this);
    hls.off(Events.AUDIO_TRACK_SWITCHED, this.onAudioTrackSwitched, this);
    hls.off(Events.BUFFER_CREATED, this.onBufferCreated, this);
    hls.off(Events.BUFFER_FLUSHED, this.onBufferFlushed, this);
    hls.off(Events.LEVELS_UPDATED, this.onLevelsUpdated, this);
    hls.off(Events.FRAG_BUFFERED, this.onFragBuffered, this);
  }

  protected onHandlerDestroying () {
    this._unregisterListeners();
  }

  startLoad (startPosition: number): void {
    if (this.levels) {
      const { lastCurrentTime, hls } = this;
      this.stopLoad();
      this.setInterval(TICK_INTERVAL);
      this.level = -1;
      this.fragLoadError = 0;
      if (!this.startFragRequested) {
        // determine load level
        let startLevel = hls.startLevel;
        if (startLevel === -1) {
          if (hls.config.testBandwidth) {
            // -1 : guess start Level by doing a bitrate test by loading first fragment of lowest quality level
            startLevel = 0;
            this.bitrateTest = true;
          } else {
            startLevel = hls.nextAutoLevel;
          }
        }
        // set new level to playlist loader : this will trigger start level load
        // hls.nextLoadLevel remains until it is set to a new value or until a new frag is successfully loaded
        this.level = hls.nextLoadLevel = startLevel;
        this.loadedmetadata = false;
      }
      // if startPosition undefined but lastCurrentTime set, set startPosition to last currentTime
      if (lastCurrentTime > 0 && startPosition === -1) {
        this.log(`Override startPosition with lastCurrentTime @${lastCurrentTime.toFixed(3)}`);
        startPosition = lastCurrentTime;
      }
      this.state = State.IDLE;
      this.nextLoadPosition = this.startPosition = this.lastCurrentTime = startPosition;
      this.tick();
    } else {
      this._forceStartLoad = true;
      this.state = State.STOPPED;
    }
  }

  stopLoad () {
    this._forceStartLoad = false;
    super.stopLoad();
  }

  doTick () {
    switch (this.state) {
    case State.IDLE:
      this._doTickIdle();
      break;
    case State.WAITING_LEVEL: {
      const { levels, level } = this;
      if (levels?.[level]?.details) {
        // Details is set after the playlist has been loaded
        this.state = State.IDLE;
        break;
      }
      break;
    }
    case State.FRAG_LOADING_WAITING_RETRY: {
      const now = self.performance.now();
      const retryDate = this.retryDate;
      // if current time is gt than retryDate, or if media seeking let's switch to IDLE state to retry loading
      if (!retryDate || (now >= retryDate) || (this.media && this.media.seeking)) {
        this.log('retryDate reached, switch back to IDLE state');
        this.state = State.IDLE;
      }
    }
      break;
    default:
      break;
    }
    // check buffer
    // check/update current fragment
    this.onTickEnd();
  }

  protected onTickEnd () {
    super.onTickEnd();
    this.checkBuffer();
    this.checkFragmentChanged();
  }

  _doTickIdle () {
    const { hls, levelLastLoaded, levels, media } = this;
    const { config, nextLoadLevel: level } = hls;

    // if start level not parsed yet OR
    // if video not attached AND start fragment already requested OR start frag prefetch not enabled
    // exit loop, as we either need more info (level not parsed) or we need media to be attached to load new fragment
    if (levelLastLoaded === null || (!media && (this.startFragRequested || !config.startFragPrefetch))) {
      return;
    }

    // If the "main" level is audio-only but we are loading an alternate track in the same group, do not load anything
    if (this.altAudio && this.audioOnly) {
      return;
    }

    if (!levels || !levels[level]) {
      return;
    }

    const levelInfo = levels[level];
    const pos = this.getLoadPosition();
    if (!Number.isFinite(pos)) {
      return;
    }
    // compute max Buffer Length that we could get from this load level, based on level bitrate. don't buffer more than 60 MB and more than 30s
    const levelBitrate = levelInfo.maxBitrate;
    let maxBufLen;
    if (levelBitrate) {
      maxBufLen = Math.max(8 * config.maxBufferSize / levelBitrate, config.maxBufferLength);
    } else {
      maxBufLen = config.maxBufferLength;
    }
    maxBufLen = Math.min(maxBufLen, config.maxMaxBufferLength);

    // determine next candidate fragment to be loaded, based on current position and end of buffer position
    // ensure up to `config.maxMaxBufferLength` of buffer upfront

    const maxBufferHole = pos < config.maxBufferHole ? Math.max(MAX_START_GAP_JUMP, config.maxBufferHole) : config.maxBufferHole;
    const bufferInfo = BufferHelper.bufferInfo(this.mediaBuffer ? this.mediaBuffer : media, pos, maxBufferHole);
    const bufferLen = bufferInfo.len;
    // Stay idle if we are still with buffer margins
    if (bufferLen >= maxBufLen) {
      return;
    }

    // if buffer length is less than maxBufLen try to load a new fragment
    // set next load level : this will trigger a playlist load if needed
    this.level = hls.nextLoadLevel = level;

    const levelDetails = levelInfo.details;
    // if level info not retrieved yet, switch state and wait for level retrieval
    // if live playlist, ensure that new playlist has been refreshed to avoid loading/try to load
    // a useless and outdated fragment (that might even introduce load error if it is already out of the live playlist)
    if (!levelDetails || this.state === State.WAITING_LEVEL || (levelDetails.live && this.levelLastLoaded !== level)) {
      this.state = State.WAITING_LEVEL;
      return;
    }

    if (this._streamEnded(bufferInfo, levelDetails)) {
      const data: any = {};
      if (this.altAudio) {
        data.type = 'video';
      }

      this.hls.trigger(Events.BUFFER_EOS, data);
      this.state = State.ENDED;
      return;
    }

    const frag = this.getNextFragment(bufferInfo.end, levelDetails);
    if (!frag) {
      return;
    }

    // We want to load the key if we're dealing with an identity key, because we will decrypt
    // this content using the key we fetch. Other keys will be handled by the DRM CDM via EME.
    if (frag.decryptdata?.keyFormat === 'identity' && !frag.decryptdata?.key) {
      this.log(`Loading key for ${frag.sn} of [${levelDetails.startSN} ,${levelDetails.endSN}],level ${level}`);
      this._loadKey(frag);
    } else {
      if (this.fragCurrent !== frag) {
        this.log(`Loading fragment ${frag.sn} of [${levelDetails.startSN} ,${levelDetails.endSN}],level ${level}, currentTime:${pos.toFixed(3)},bufferEnd:${bufferInfo.end.toFixed(3)}`);
      }
      this._loadFragment(frag);
    }
  }

  _loadKey (frag: Fragment) {
    this.state = State.KEY_LOADING;
    this.hls.trigger(Events.KEY_LOADING, { frag });
  }

  _loadFragment (frag: Fragment) {
    // Check if fragment is not loaded
    const fragState = this.fragmentTracker.getState(frag);
    this.fragCurrent = frag;
    // Don't update nextLoadPosition for fragments which are not buffered
    if (Number.isFinite(frag.sn as number) && !this.bitrateTest) {
      this.nextLoadPosition = frag.start + frag.duration;
    }

    // Allow backtracked fragments to load
    if (frag.backtracked || fragState === FragmentState.NOT_LOADED || fragState === FragmentState.PARTIAL) {
      if (frag.sn === 'initSegment') {
        this._loadInitSegment(frag);
      } else if (this.bitrateTest) {
        frag.bitrateTest = true;
        this.log(`Fragment ${frag.sn} of level ${frag.level} is being downloaded to test bitrate and will not be buffered`);
        this._loadBitrateTestFrag(frag);
      } else {
        this.startFragRequested = true;
        this._loadFragForPlayback(frag);
      }
    } else if (fragState === FragmentState.APPENDING) {
      // Lower the buffer size and try again
      if (this._reduceMaxBufferLength(frag.duration)) {
        this.fragmentTracker.removeFragment(frag);
      }
    } else if (this.media?.buffered.length === 0) {
      // Stop gap for bad tracker / buffer flush behavior
      this.fragmentTracker.removeAllFragments();
    }
  }

  getAppendedFrag (position) {
    return this.fragmentTracker.getAppendedFrag(position, PlaylistLoader.LevelType.MAIN);
  }

  getBufferedFrag (position) {
    return this.fragmentTracker.getBufferedFrag(position, PlaylistLoader.LevelType.MAIN);
  }

  followingBufferedFrag (frag: Fragment | null) {
    if (frag) {
      // try to get range of next fragment (500ms after this range)
      return this.getBufferedFrag(frag.endPTS + 0.5);
    }
    return null;
  }

  /*
    on immediate level switch :
     - pause playback if playing
     - cancel any pending load request
     - and trigger a buffer flush
  */
  immediateLevelSwitch () {
    this.log('immediateLevelSwitch');
    if (!this.immediateSwitch) {
      this.immediateSwitch = true;
      const media = this.media;
      let previouslyPaused;
      if (media) {
        previouslyPaused = media.paused;
        media.pause();
      } else {
        // don't restart playback after instant level switch in case media not attached
        previouslyPaused = true;
      }
      this.previouslyPaused = previouslyPaused;
    }
    const fragCurrent = this.fragCurrent;
    if (fragCurrent?.loader) {
      fragCurrent.loader.abort();
    }

    this.fragCurrent = null;
    // flush everything
    this.flushMainBuffer(0, Number.POSITIVE_INFINITY);
  }

  /**
   * on immediate level switch end, after new fragment has been buffered:
   * - nudge video decoder by slightly adjusting video currentTime (if currentTime buffered)
   * - resume the playback if needed
   */
  immediateLevelSwitchEnd () {
    const media = this.media;
    if (media?.buffered.length) {
      this.immediateSwitch = false;
      if (BufferHelper.isBuffered(media, media.currentTime)) {
        // only nudge if currentTime is buffered
        media.currentTime -= 0.0001;
      }
      if (!this.previouslyPaused) {
        media.play();
      }
    }
  }

  /**
   * try to switch ASAP without breaking video playback:
   * in order to ensure smooth but quick level switching,
   * we need to find the next flushable buffer range
   * we should take into account new segment fetch time
   */
  nextLevelSwitch () {
    const { levels, media } = this;
    // ensure that media is defined and that metadata are available (to retrieve currentTime)
    if (media?.readyState) {
      let fetchdelay;
      let nextBufferedFrag;
      const fragPlayingCurrent = this.getAppendedFrag(media.currentTime);
      if (fragPlayingCurrent && fragPlayingCurrent.start > 1) {
        // flush buffer preceding current fragment (flush until current fragment start offset)
        // minus 1s to avoid video freezing, that could happen if we flush keyframe of current video ...
        this.flushMainBuffer(0, fragPlayingCurrent.start - 1);
      }
      if (!media.paused && levels) {
        // add a safety delay of 1s
        const nextLevelId = this.hls.nextLoadLevel;
        const nextLevel = levels[nextLevelId];
        const fragLastKbps = this.fragLastKbps;
        if (fragLastKbps && this.fragCurrent) {
          fetchdelay = this.fragCurrent.duration * nextLevel.maxBitrate / (1000 * fragLastKbps) + 1;
        } else {
          fetchdelay = 0;
        }
      } else {
        fetchdelay = 0;
      }
      // this.log('fetchdelay:'+fetchdelay);
      // find buffer range that will be reached once new fragment will be fetched
      nextBufferedFrag = this.getBufferedFrag(media.currentTime + fetchdelay);
      if (nextBufferedFrag) {
        // we can flush buffer range following this one without stalling playback
        nextBufferedFrag = this.followingBufferedFrag(nextBufferedFrag);
        if (nextBufferedFrag) {
          // if we are here, we can also cancel any loading/demuxing in progress, as they are useless
          const fragCurrent = this.fragCurrent;
          if (fragCurrent?.loader) {
            fragCurrent.loader.abort();
          }

          this.fragCurrent = null;
          // start flush position is the start PTS of next buffered frag.
          // we use frag.naxStartPTS which is max(audio startPTS, video startPTS).
          // in case there is a small PTS Delta between audio and video, using maxStartPTS avoids flushing last samples from current fragment
          this.flushMainBuffer(nextBufferedFrag.maxStartPTS, Number.POSITIVE_INFINITY);
        }
      }
    }
  }

  flushMainBuffer (startOffset, endOffset) {
    // When alternate audio is playing, the audio-stream-controller is responsible for the audio buffer. Otherwise,
    // passing a null type flushes both buffers
    const flushScope: any = { startOffset: startOffset, endOffset: endOffset, type: this.altAudio ? 'video' : null };
    // Reset load errors on flush
    this.fragLoadError = 0;
    this.hls.trigger(Events.BUFFER_FLUSHING, flushScope);
  }

  onMediaAttached (event: Events.MEDIA_ATTACHED, data: MediaAttachedData) {
    const media = this.media = this.mediaBuffer = data.media;
    this.onvplaying = this.onMediaPlaying.bind(this);
    this.onvseeking = this.onMediaSeeking.bind(this);
    this.onvseeked = this.onMediaSeeked.bind(this);
    this.onvended = this.onMediaEnded.bind(this);
    media.addEventListener('playing', this.onvplaying as EventListener);
    media.addEventListener('seeking', this.onvseeking as EventListener);
    media.addEventListener('seeked', this.onvseeked as EventListener);
    media.addEventListener('ended', this.onvended as EventListener);
    const config = this.config;
    if (this.levels && config.autoStartLoad) {
      this.hls.startLoad(config.startPosition);
    }

    this.gapController = new GapController(config, media, this.fragmentTracker, this.hls);
  }

  onMediaDetaching () {
    const { levels, media } = this;
    if (media?.ended) {
      this.log('MSE detaching and video ended, reset startPosition');
      this.startPosition = this.lastCurrentTime = 0;
    }

    // reset fragment backtracked flag
    if (levels) {
      levels.forEach(level => {
        if (level.details) {
          level.details.fragments.forEach(fragment => {
            fragment.backtracked = false;
          });
        }
      });
    }
    // remove video listeners
    if (media) {
      media.removeEventListener('playing', this.onvplaying);
      media.removeEventListener('seeking', this.onvseeking);
      media.removeEventListener('seeked', this.onvseeked);
      media.removeEventListener('ended', this.onvended);
      this.onvplaying = this.onvseeking = this.onvseeked = this.onvended = null;
    }
    this.media = this.mediaBuffer = null;
    this.loadedmetadata = false;
    this.stopLoad();
  }

  onMediaPlaying () {
    // tick to speed up FRAG_CHANGED triggering
    this.tick();
  }

  onMediaSeeked () {
    const media = this.media;
    const currentTime = media ? media.currentTime : null;
    if (Number.isFinite(currentTime)) {
      this.log(`Media seeked to ${currentTime.toFixed(3)}`);
    }

    // tick to speed up FRAG_CHANGED triggering
    this.tick();
  }

  onManifestLoading () {
    // reset buffer on manifest loading
    this.log('Trigger BUFFER_RESET');
    this.hls.trigger(Events.BUFFER_RESET);
    this.fragmentTracker.removeAllFragments();
    this.stalled = false;
    this.startPosition = this.lastCurrentTime = 0;
    this.fragPlaying = null;
  }

  onManifestParsed (event: Events.MANIFEST_PARSED, data: ManifestParsedData) {
    let aac = false;
    let heaac = false;
    let codec;
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
      this.log('Both AAC/HE-AAC audio found in levels; declaring level codec as HE-AAC');
    }

    this.levels = data.levels;
    this.startFragRequested = false;
  }

  onLevelLoading () {
    this.state = State.WAITING_LEVEL;
  }

  onLevelLoaded (event: Events.LEVEL_LOADED, data: LevelLoadedData) {
    const { levels } = this;
    const newLevelId = data.level;
    const newDetails = data.details;
    const duration = newDetails.totalduration;

    if (!levels) {
      this.warn(`Levels were reset while loading level ${newLevelId}`);
      return;
    }
    this.log(`Level ${newLevelId} loaded [${newDetails.startSN},${newDetails.endSN}], cc [${newDetails.startCC}, ${newDetails.endCC}] duration:${duration}`);

    const curLevel = levels[newLevelId];
    let sliding = 0;
    if (newDetails.live) {
      sliding = this.mergeLivePlaylists(curLevel.details, newDetails);
      if (sliding) {
        this._liveSyncPosition = this.computeLivePosition(sliding, newDetails.targetduration, newDetails.totalduration);
      }
    } else {
      newDetails.PTSKnown = false;
    }
    // override level info
    curLevel.details = newDetails;
    this.levelLastLoaded = newLevelId;
    this.hls.trigger(Events.LEVEL_UPDATED, { details: newDetails, level: newLevelId });

    if (!this.startFragRequested) {
      this.setStartPosition(newDetails, sliding);
    }
    // only switch batck to IDLE state if we were waiting for level to start downloading a new fragment
    if (this.state === State.WAITING_LEVEL) {
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

  _handleFragmentLoadProgress (frag: Fragment, payload: Uint8Array) {
    const { levels, media } = this;
    if (!levels) {
      this.warn(`Levels were reset while fragment load was in progress. Fragment ${frag.sn} of level ${frag.level} will not be buffered`);
      return;
    }
    const currentLevel = levels[frag.level];
    const details = currentLevel.details as LevelDetails;
    console.assert(details, 'Audio track details are defined on fragment load progress');
    const videoCodec = currentLevel.videoCodec;

    // time Offset is accurate if level PTS is known, or if playlist is not sliding (not live) and if media is not seeking (this is to overcome potential timestamp drifts between playlists and fragments)
    const accurateTimeOffset = !(media?.seeking) && (details.PTSKnown || !details.live);
    const initSegmentData = details.initSegment ? details.initSegment.data : [];
    const audioCodec = this._getAudioCodec(currentLevel);

    // transmux the MPEG-TS data to ISO-BMFF segments
    // this.log(`Transmuxing ${frag.sn} of [${details.startSN} ,${details.endSN}],level ${frag.level}, cc ${frag.cc}`);
    const transmuxer = this.transmuxer = this.transmuxer ||
          new TransmuxerInterface(this.hls, 'main', this._handleTransmuxComplete.bind(this), this._handleTransmuxerFlush.bind(this));

    const chunkMeta = new ChunkMetadata(frag.level, frag.sn, frag.stats.chunkCount, payload.byteLength);
    chunkMeta.transmuxing.start = performance.now();

    transmuxer.push(
      payload,
      initSegmentData,
      audioCodec,
      videoCodec,
      frag,
      details.totalduration,
      accurateTimeOffset,
      chunkMeta
    );
  }

  private resetTransmuxer () {
    if (this.transmuxer) {
      this.transmuxer.destroy();
      this.transmuxer = null;
    }
  }

  onAudioTrackSwitching (event: Events.AUDIO_TRACK_SWITCHING, data: AudioTrackSwitchingData) {
    // if any URL found on new audio track, it is an alternate audio track
    const altAudio = !!data.url;
    const trackId = data.id;
    // if we switch on main audio, ensure that main fragment scheduling is synced with media.buffered
    // don't do anything if we switch to alt audio: audio stream controller is handling it.
    // we will just have to change buffer scheduling on audioTrackSwitched
    if (!altAudio) {
      if (this.mediaBuffer !== this.media) {
        this.log('Switching on main audio, use media.buffered to schedule main fragment loading');
        this.mediaBuffer = this.media;
        const fragCurrent = this.fragCurrent;
        // we need to refill audio buffer from main: cancel any frag loading to speed up audio switch
        if (fragCurrent?.loader) {
          this.log('Switching to main audio track, cancel main fragment load');
          fragCurrent.loader.abort();
        }
        this.fragCurrent = null;
        this.fragPrevious = null;
        // destroy transmuxer to force init segment generation (following audio switch)
        this.resetTransmuxer();
        // switch to IDLE state to load new fragment
        this.state = State.IDLE;
      } else if (this.audioOnly) {
        // Reset audio transmuxer so when switching back to main audio we're not still appending where we left off
        this.resetTransmuxer();
      }
      const hls = this.hls;
      // switching to main audio, flush all audio and trigger track switched
      hls.trigger(Events.BUFFER_FLUSHING, { startOffset: 0, endOffset: Number.POSITIVE_INFINITY, type: 'audio' });
      hls.trigger(Events.AUDIO_TRACK_SWITCHED, { id: trackId });
      this.altAudio = false;
    }
  }

  onAudioTrackSwitched (event: Events.AUDIO_TRACK_SWITCHED, data: AudioTrackSwitchedData) {
    const trackId = data.id;
    const altAudio = !!this.hls.audioTracks[trackId].url;
    if (altAudio) {
      const videoBuffer = this.videoBuffer;
      // if we switched on alternate audio, ensure that main fragment scheduling is synced with video sourcebuffer buffered
      if (videoBuffer && this.mediaBuffer !== videoBuffer) {
        this.log('Switching on alternate audio, use video.buffered to schedule main fragment loading');
        this.mediaBuffer = videoBuffer;
      }
    }
    this.altAudio = altAudio;
    this.tick();
  }

  onBufferCreated (event: Events.BUFFER_CREATED, data: BufferCreatedData) {
    const tracks = data.tracks;
    let mediaTrack;
    let name;
    let alternate = false;
    for (const type in tracks) {
      const track = tracks[type];
      if (track.id === 'main') {
        name = type;
        mediaTrack = track;
        // keep video source buffer reference
        if (type === 'video') {
          const videoTrack = tracks[type];
          if (videoTrack) {
            this.videoBuffer = videoTrack.buffer;
          }
        }
      } else {
        alternate = true;
      }
    }
    if (alternate && mediaTrack) {
      this.log(`Alternate track found, use ${name}.buffered to schedule main fragment loading`);
      this.mediaBuffer = mediaTrack.buffer;
    } else {
      this.mediaBuffer = this.media;
    }
  }

  onFragBuffered (event: Events.FRAG_BUFFERED, data: { frag: Fragment }) {
    const { frag } = data;
    if (frag && frag.type !== 'main') {
      return;
    }
    if (this._fragLoadAborted(frag)) {
      // If a level switch was requested while a fragment was buffering, it will emit the FRAG_BUFFERED event upon completion
      // Avoid setting state back to IDLE, since that will interfere with a level switch
      this.warn(`Fragment ${frag.sn} of level ${frag.level} finished buffering, but was aborted. state: ${this.state}`);
      return;
    }
    const media = this.mediaBuffer ? this.mediaBuffer : this.media;
    const stats = frag.stats;
    this.fragPrevious = frag;
    this.fragLastKbps = Math.round(8 * stats.total / (stats.buffering.end - stats.loading.first));

    this.log(`Buffered fragment ${frag.sn} of level ${frag.level}. PTS:[${frag.startPTS},${frag.endPTS}],DTS:[${frag.startDTS}/${frag.endDTS}], Buffered: ${TimeRanges.toString(media.buffered)}`);
    this.state = State.IDLE;
    this.tick();
  }

  onError (event: Events.ERROR, data: ErrorData) {
    const frag = data.frag || this.fragCurrent;
    // don't handle frag error not related to main fragment
    if (frag && frag.type !== 'main') {
      return;
    }

    // 0.5 : tolerance needed as some browsers stalls playback before reaching buffered end
    const mediaBuffered = !!this.media && BufferHelper.isBuffered(this.media, this.media.currentTime) && BufferHelper.isBuffered(this.media, this.media.currentTime + 0.5);

    switch (data.details) {
    case ErrorDetails.FRAG_LOAD_ERROR:
    case ErrorDetails.FRAG_LOAD_TIMEOUT:
    case ErrorDetails.KEY_LOAD_ERROR:
    case ErrorDetails.KEY_LOAD_TIMEOUT:
      if (!data.fatal) {
        // keep retrying until the limit will be reached
        if ((this.fragLoadError + 1) <= this.config.fragLoadingMaxRetry) {
          // exponential backoff capped to config.fragLoadingMaxRetryTimeout
          const delay = Math.min(Math.pow(2, this.fragLoadError) * this.config.fragLoadingRetryDelay, this.config.fragLoadingMaxRetryTimeout);
          // @ts-ignore - frag is potentially null according to TS here
          this.warn(`Fragment ${frag.sn} of level ${frag.level} failed to load, retrying in ${delay}ms`);
          this.retryDate = self.performance.now() + delay;
          // retry loading state
          // if loadedmetadata is not set, it means that we are emergency switch down on first frag
          // in that case, reset startFragRequested flag
          if (!this.loadedmetadata) {
            this.startFragRequested = false;
            this.nextLoadPosition = this.startPosition;
          }
          this.fragLoadError++;
          this.state = State.FRAG_LOADING_WAITING_RETRY;
        } else {
          logger.error(`[stream-controller]: ${data.details} reaches max retry, redispatch as fatal ...`);
          // switch error to fatal
          data.fatal = true;
          this.state = State.ERROR;
        }
      }
      break;
    case ErrorDetails.LEVEL_LOAD_ERROR:
    case ErrorDetails.LEVEL_LOAD_TIMEOUT:
      if (this.state !== State.ERROR) {
        if (data.fatal) {
          // if fatal error, stop processing
          this.warn(`${data.details}`);
          this.state = State.ERROR;
        } else {
          // in case of non fatal error while loading level, if level controller is not retrying to load level , switch back to IDLE
          if (!data.levelRetry && this.state === State.WAITING_LEVEL) {
            this.state = State.IDLE;
          }
        }
      }
      break;
    case ErrorDetails.BUFFER_FULL_ERROR:
      // if in appending state
      if (data.parent === 'main' && (this.state === State.PARSING || this.state === State.PARSED)) {
        // reduce max buf len if current position is buffered
        if (mediaBuffered) {
          this._reduceMaxBufferLength(this.config.maxBufferLength);
          this.state = State.IDLE;
        } else {
          // current position is not buffered, but browser is still complaining about buffer full error
          // this happens on IE/Edge, refer to https://github.com/video-dev/hls.js/pull/708
          // in that case flush the whole buffer to recover
          this.warn('buffer full error also media.currentTime is not buffered, flush everything');
          this.fragCurrent = null;
          // flush everything
          this.flushMainBuffer(0, Number.POSITIVE_INFINITY);
        }
      }
      break;
    default:
      break;
    }
  }

  _reduceMaxBufferLength (minLength) {
    const config = this.config;
    if (config.maxMaxBufferLength >= minLength) {
      // reduce max buffer length as it might be too high. we do this to avoid loop flushing ...
      config.maxMaxBufferLength /= 2;
      this.warn(`Reduce max buffer length to ${config.maxMaxBufferLength}s`);
      return true;
    }
    return false;
  }

  // Checks the health of the buffer and attempts to resolve playback stalls.
  private checkBuffer () {
    const { media, gapController } = this;
    if (!media || !gapController || !media.readyState) {
      // Exit early if we don't have media or if the media hasn't buffered anything yet (readyState 0)
      return;
    }

    const mediaBuffer = this.mediaBuffer ? this.mediaBuffer : media;
    const buffered = mediaBuffer.buffered;

    if (!this.loadedmetadata && buffered.length) {
      this.loadedmetadata = true;
      this._seekToStartPos();
    } else if (this.immediateSwitch) {
      this.immediateLevelSwitchEnd();
    } else {
      // Resolve gaps using the main buffer, whose ranges are the intersections of the A/V sourcebuffers
      gapController.poll(this.lastCurrentTime);
    }

    this.lastCurrentTime = media.currentTime;
  }

  onFragLoadEmergencyAborted () {
    this.state = State.IDLE;
    // if loadedmetadata is not set, it means that we are emergency switch down on first frag
    // in that case, reset startFragRequested flag
    if (!this.loadedmetadata) {
      this.startFragRequested = false;
      this.nextLoadPosition = this.startPosition;
    }
    this.tick();
  }

  onBufferFlushed () {
    /* after successful buffer flushing, filter flushed fragments from bufferedFrags
      use mediaBuffered instead of media (so that we will check against video.buffered ranges in case of alt audio track)
    */
    const media = this.mediaBuffer ? this.mediaBuffer : this.media;
    if (media) {
      // filter fragments potentially evicted from buffer. this is to avoid memleak on live streams
      const elementaryStreamType = this.audioOnly ? ElementaryStreamTypes.AUDIO : ElementaryStreamTypes.VIDEO;
      this.fragmentTracker.detectEvictedFragments(elementaryStreamType, media.buffered);
    }
    // move to IDLE once flush complete. this should trigger new fragment loading
    this.state = State.IDLE;
    // reset reference to frag
    this.fragPrevious = null;
  }

  onLevelsUpdated (event: Events.LEVELS_UPDATED, data: LevelsUpdatedData) {
    this.levels = data.levels;
  }

  swapAudioCodec () {
    this.audioCodecSwap = !this.audioCodecSwap;
  }

  /**
   * Seeks to the set startPosition if not equal to the mediaElement's current time.
   * @private
   */
  _seekToStartPos () {
    const { media } = this;
    const currentTime = media.currentTime;
    // only adjust currentTime if different from startPosition or if startPosition not buffered
    // at that stage, there should be only one buffered range, as we reach that code after first fragment has been buffered
    const startPosition = media.seeking ? currentTime : this.startPosition;
    // if currentTime not matching with expected startPosition or startPosition not buffered but close to first buffered
    if (currentTime !== startPosition && startPosition >= 0) {
      // if startPosition not buffered, let's seek to buffered.start(0)
      this.log(`Target start position not buffered, seek to buffered.start(0) ${startPosition} from current time ${currentTime} `);
      media.currentTime = startPosition;
    }
  }

  _getAudioCodec (currentLevel) {
    let audioCodec = this.config.defaultAudioCodec || currentLevel.audioCodec;
    if (this.audioCodecSwap) {
      this.log('Swapping playlist audio codec');
      if (audioCodec) {
        if (audioCodec.indexOf('mp4a.40.5') !== -1) {
          audioCodec = 'mp4a.40.2';
        } else {
          audioCodec = 'mp4a.40.5';
        }
      }
    }

    return audioCodec;
  }

  private _loadBitrateTestFrag (frag: Fragment) {
    this._doFragLoad(frag)
      .then((data) => {
        const { hls } = this;
        if (!data || hls.nextLoadLevel || this._fragLoadAborted(frag)) {
          return;
        }
        this.fragLoadError = 0;
        this.state = State.IDLE;
        this.startFragRequested = false;
        this.bitrateTest = false;
        frag.bitrateTest = false;
        const stats = frag.stats;
        // Bitrate tests fragments are neither parsed nor buffered
        stats.parsing.start = stats.parsing.end = stats.buffering.start = stats.buffering.end = self.performance.now();
        hls.trigger(Events.FRAG_BUFFERED, { stats, frag, id: 'main' });
        this.tick();
      });
  }

  private _handleTransmuxComplete (transmuxResult: TransmuxerResult) {
    const id = 'main';
    const { hls } = this;
    const { remuxResult, chunkMeta } = transmuxResult;

    const context = this.getCurrentContext(chunkMeta);
    if (!context) {
      this.warn(`The loading context changed while buffering fragment ${chunkMeta.sn} of level ${chunkMeta.level}. This chunk will not be buffered.`);
      return;
    }
    const { frag, level } = context;
    const { video, text, id3, initSegment } = remuxResult;
    // The audio-stream-controller handles audio buffering if Hls.js is playing an alternate audio track
    const audio = this.altAudio ? undefined : remuxResult.audio;

    this.state = State.PARSING;

    if (initSegment) {
      if (initSegment.tracks) {
        this._bufferInitSegment(level, initSegment.tracks, frag, chunkMeta);
        hls.trigger(Events.FRAG_PARSING_INIT_SEGMENT, { frag, id, tracks: initSegment.tracks });
      }

      // This would be nice if Number.isFinite acted as a typeguard, but it doesn't. See: https://github.com/Microsoft/TypeScript/issues/10038
      if (Number.isFinite(initSegment.initPTS as number)) {
        hls.trigger(Events.INIT_PTS_FOUND, { frag, id, initPTS: initSegment.initPTS as number });
      }
    }

    // Avoid buffering if backtracking this fragment
    if (video) {
      if (level.details && _hasDroppedFrames(frag, video.dropped, level.details.startSN)) {
        this.backtrack(frag, video.startPTS);
        return;
      } else {
        frag.setElementaryStreamInfo(video.type as ElementaryStreamTypes, video.startPTS, video.endPTS, video.startDTS, video.endDTS);
        this.bufferFragmentData(video, frag, chunkMeta);
      }
    }

    if (audio) {
      frag.setElementaryStreamInfo(ElementaryStreamTypes.AUDIO, audio.startPTS, audio.endPTS, audio.startDTS, audio.endDTS);
      this.bufferFragmentData(audio, frag, chunkMeta);
    }

    if (id3?.samples?.length) {
      const emittedID3: FragParsingMetadataData = Object.assign({
        frag,
        id
      }, id3);
      hls.trigger(Events.FRAG_PARSING_METADATA, emittedID3);
    }
    if (text) {
      const emittedText: FragParsingUserdataData = Object.assign({
        frag,
        id
      }, text);
      hls.trigger(Events.FRAG_PARSING_USERDATA, emittedText);
    }
  }

  private _bufferInitSegment (currentLevel: Level, tracks: TrackSet, frag: Fragment, chunkMeta: ChunkMetadata) {
    if (this.state !== State.PARSING) {
      return;
    }

    this.audioOnly = !!tracks.audio && !tracks.video;

    // if audio track is expected to come from audio stream controller, discard any coming from main
    if (this.altAudio && !this.audioOnly) {
      delete tracks.audio;
    }
    // include levelCodec in audio and video tracks
    const { audio, video } = tracks;
    if (audio) {
      let audioCodec = currentLevel.audioCodec;
      const ua = navigator.userAgent.toLowerCase();
      if (audioCodec && this.audioCodecSwap) {
        this.log('Swapping playlist audio codec');
        if (audioCodec.indexOf('mp4a.40.5') !== -1) {
          audioCodec = 'mp4a.40.2';
        } else {
          audioCodec = 'mp4a.40.5';
        }
      }
      // In the case that AAC and HE-AAC audio codecs are signalled in manifest,
      // force HE-AAC, as it seems that most browsers prefers it.
      if (this.audioCodecSwitch) {
        // don't force HE-AAC if mono stream, or in Firefox
        if (audio.metadata.channelCount !== 1 && ua.indexOf('firefox') === -1) {
          audioCodec = 'mp4a.40.5';
        }
      }
      // HE-AAC is broken on Android, always signal audio codec as AAC even if variant manifest states otherwise
      if (ua.indexOf('android') !== -1 && audio.container !== 'audio/mpeg') { // Exclude mpeg audio
        audioCodec = 'mp4a.40.2';
        this.log(`Android: force audio codec to ${audioCodec}`);
      }
      audio.levelCodec = audioCodec;
      audio.id = 'main';
    }
    if (video) {
      video.levelCodec = currentLevel.videoCodec;
      video.id = 'main';
    }
    this.hls.trigger(Events.BUFFER_CODECS, tracks);
    // loop through tracks that are going to be provided to bufferController
    Object.keys(tracks).forEach(trackName => {
      const track = tracks[trackName];
      const initSegment = track.initSegment;
      this.log(`Main track:${trackName},container:${track.container},codecs[level/parsed]=[${track.levelCodec}/${track.codec}]`);
      if (initSegment) {
        this.hls.trigger(Events.BUFFER_APPENDING, { type: trackName as SourceBufferName, data: initSegment, frag, chunkMeta });
      }
    });
    // trigger handler right now
    this.tick();
  }

  private backtrack (frag: Fragment, nextLoadPosition: number) {
    // Return back to the IDLE state without appending to buffer
    // Causes findFragments to backtrack a segment and find the keyframe
    // Audio fragments arriving before video sets the nextLoadPosition, causing _findFragments to skip the backtracked fragment
    this.fragmentTracker.removeFragment(frag);
    frag.backtracked = true;
    this.nextLoadPosition = nextLoadPosition;
    this.state = State.IDLE;
    this.fragPrevious = frag;
    this.tick();
  }

  private checkFragmentChanged () {
    const video = this.media;
    let fragPlayingCurrent;
    if (video && video.readyState > 1 && video.seeking === false) {
      const currentTime = video.currentTime;
      /* if video element is in seeked state, currentTime can only increase.
        (assuming that playback rate is positive ...)
        As sometimes currentTime jumps back to zero after a
        media decode error, check this, to avoid seeking back to
        wrong position after a media decode error
      */

      if (BufferHelper.isBuffered(video, currentTime)) {
        fragPlayingCurrent = this.getAppendedFrag(currentTime);
      } else if (BufferHelper.isBuffered(video, currentTime + 0.1)) {
        /* ensure that FRAG_CHANGED event is triggered at startup,
          when first video frame is displayed and playback is paused.
          add a tolerance of 100ms, in case current position is not buffered,
          check if current pos+100ms is buffered and use that buffer range
          for FRAG_CHANGED event reporting */
        fragPlayingCurrent = this.getAppendedFrag(currentTime + 0.1);
      }
      if (fragPlayingCurrent) {
        const fragPlaying = fragPlayingCurrent;
        if (fragPlaying !== this.fragPlaying) {
          this.hls.trigger(Events.FRAG_CHANGED, { frag: fragPlaying });
          const fragPlayingLevel = fragPlaying.level;
          if (!this.fragPlaying || this.fragPlaying.level !== fragPlayingLevel) {
            this.hls.trigger(Events.LEVEL_SWITCHED, { level: fragPlayingLevel });
          }

          this.fragPlaying = fragPlaying;
        }
      }
    }
  }

  get liveSyncPosition () {
    return this._liveSyncPosition;
  }

  get nextLevel () {
    const frag = this.nextBufferedFrag;
    if (frag) {
      return frag.level;
    } else {
      return -1;
    }
  }

  get currentLevel () {
    const media = this.media;
    if (media) {
      const fragPlayingCurrent = this.getAppendedFrag(media.currentTime);
      if (fragPlayingCurrent) {
        return fragPlayingCurrent.level;
      }
    }
    return -1;
  }

  get nextBufferedFrag () {
    const media = this.media;
    if (media) {
      // first get end range of current fragment
      const fragPlayingCurrent = this.getAppendedFrag(media.currentTime);
      return this.followingBufferedFrag(fragPlayingCurrent);
    } else {
      return null;
    }
  }

  set liveSyncPosition (value) {
    this._liveSyncPosition = value;
  }

  get forceStartLoad () {
    return this._forceStartLoad;
  }
}

function _hasDroppedFrames (frag, dropped: number | undefined, startSN: number) {
  // Detect gaps in a fragment  and try to fix it by finding a keyframe in the previous fragment (see _findFragments)
  if (dropped) {
    frag.dropped = dropped;
    if (!frag.backtracked) {
      if (frag.sn === startSN) {
        logger.warn(`[stream-controller]: Fragment ${frag.sn} of level ${frag.level} is missing ${frag.dropped} video frame(s); this is the start fragment and will be appended with a gap`);
        return false;
      } else {
        logger.warn(`[stream-controller]: Fragment ${frag.sn} of level ${frag.level} is missing ${frag.dropped} video frame(s); backtracking to find a keyframe`);
        return true;
      }
    } else {
      logger.warn(`[stream-controller]: Fragment ${frag.sn} of level ${frag.level} already backtracked and will be appended with a gap`);
      frag.backtracked = false;
      return false;
    }
  } else {
    // Only reset the backtracked flag if we've loaded the frag without any dropped frames
    frag.backtracked = false;
    return false;
  }
}
