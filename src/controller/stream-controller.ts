import BaseStreamController, { State } from './base-stream-controller';
import { changeTypeSupported } from '../is-supported';
import { Events } from '../events';
import { BufferHelper, BufferInfo } from '../utils/buffer-helper';
import { FragmentState } from './fragment-tracker';
import { PlaylistContextType, PlaylistLevelType } from '../types/loader';
import { ElementaryStreamTypes, Fragment } from '../loader/fragment';
import TransmuxerInterface from '../demux/transmuxer-interface';
import { ChunkMetadata } from '../types/transmuxer';
import GapController, { MAX_START_GAP_JUMP } from './gap-controller';
import { ErrorDetails } from '../errors';
import type { NetworkComponentAPI } from '../types/component-api';
import type Hls from '../hls';
import type { Level } from '../types/level';
import type { LevelDetails } from '../loader/level-details';
import type { FragmentTracker } from './fragment-tracker';
import type KeyLoader from '../loader/key-loader';
import type { TransmuxerResult } from '../types/transmuxer';
import type { TrackSet } from '../types/track';
import type { SourceBufferName } from '../types/buffer';
import type {
  AudioTrackSwitchedData,
  AudioTrackSwitchingData,
  BufferCreatedData,
  BufferEOSData,
  BufferFlushedData,
  ErrorData,
  FragBufferedData,
  FragLoadedData,
  FragParsingMetadataData,
  FragParsingUserdataData,
  LevelLoadedData,
  LevelLoadingData,
  LevelsUpdatedData,
  ManifestParsedData,
  MediaAttachedData,
} from '../types/events';

const TICK_INTERVAL = 100; // how often to tick in ms

export default class StreamController
  extends BaseStreamController
  implements NetworkComponentAPI
{
  private audioCodecSwap: boolean = false;
  private gapController: GapController | null = null;
  private level: number = -1;
  private _forceStartLoad: boolean = false;
  private altAudio: boolean = false;
  private audioOnly: boolean = false;
  private fragPlaying: Fragment | null = null;
  private onvplaying: EventListener | null = null;
  private onvseeked: EventListener | null = null;
  private fragLastKbps: number = 0;
  private couldBacktrack: boolean = false;
  private backtrackFragment: Fragment | null = null;
  private audioCodecSwitch: boolean = false;
  private videoBuffer: any | null = null;

  constructor(
    hls: Hls,
    fragmentTracker: FragmentTracker,
    keyLoader: KeyLoader,
  ) {
    super(
      hls,
      fragmentTracker,
      keyLoader,
      '[stream-controller]',
      PlaylistLevelType.MAIN,
    );
    this._registerListeners();
  }

  private _registerListeners() {
    const { hls } = this;
    hls.on(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    hls.on(Events.MEDIA_DETACHING, this.onMediaDetaching, this);
    hls.on(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.on(Events.MANIFEST_PARSED, this.onManifestParsed, this);
    hls.on(Events.LEVEL_LOADING, this.onLevelLoading, this);
    hls.on(Events.LEVEL_LOADED, this.onLevelLoaded, this);
    hls.on(
      Events.FRAG_LOAD_EMERGENCY_ABORTED,
      this.onFragLoadEmergencyAborted,
      this,
    );
    hls.on(Events.ERROR, this.onError, this);
    hls.on(Events.AUDIO_TRACK_SWITCHING, this.onAudioTrackSwitching, this);
    hls.on(Events.AUDIO_TRACK_SWITCHED, this.onAudioTrackSwitched, this);
    hls.on(Events.BUFFER_CREATED, this.onBufferCreated, this);
    hls.on(Events.BUFFER_FLUSHED, this.onBufferFlushed, this);
    hls.on(Events.LEVELS_UPDATED, this.onLevelsUpdated, this);
    hls.on(Events.FRAG_BUFFERED, this.onFragBuffered, this);
  }

  protected _unregisterListeners() {
    const { hls } = this;
    hls.off(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    hls.off(Events.MEDIA_DETACHING, this.onMediaDetaching, this);
    hls.off(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.off(Events.MANIFEST_PARSED, this.onManifestParsed, this);
    hls.off(Events.LEVEL_LOADED, this.onLevelLoaded, this);
    hls.off(
      Events.FRAG_LOAD_EMERGENCY_ABORTED,
      this.onFragLoadEmergencyAborted,
      this,
    );
    hls.off(Events.ERROR, this.onError, this);
    hls.off(Events.AUDIO_TRACK_SWITCHING, this.onAudioTrackSwitching, this);
    hls.off(Events.AUDIO_TRACK_SWITCHED, this.onAudioTrackSwitched, this);
    hls.off(Events.BUFFER_CREATED, this.onBufferCreated, this);
    hls.off(Events.BUFFER_FLUSHED, this.onBufferFlushed, this);
    hls.off(Events.LEVELS_UPDATED, this.onLevelsUpdated, this);
    hls.off(Events.FRAG_BUFFERED, this.onFragBuffered, this);
  }

  protected onHandlerDestroying() {
    this._unregisterListeners();
    super.onHandlerDestroying();
  }

  public startLoad(startPosition: number): void {
    if (this.levels) {
      const { lastCurrentTime, hls } = this;
      this.stopLoad();
      this.setInterval(TICK_INTERVAL);
      this.level = -1;
      if (!this.startFragRequested) {
        // determine load level
        let startLevel = hls.startLevel;
        if (startLevel === -1) {
          if (hls.config.testBandwidth && this.levels.length > 1) {
            // -1 : guess start Level by doing a bitrate test by loading first fragment of lowest quality level
            startLevel = 0;
            this.bitrateTest = true;
          } else {
            startLevel = hls.firstAutoLevel;
          }
        }
        // set new level to playlist loader : this will trigger start level load
        // hls.nextLoadLevel remains until it is set to a new value or until a new frag is successfully loaded
        hls.nextLoadLevel = startLevel;
        this.level = hls.loadLevel;
        this.loadedmetadata = false;
      }
      // if startPosition undefined but lastCurrentTime set, set startPosition to last currentTime
      if (lastCurrentTime > 0 && startPosition === -1) {
        this.log(
          `Override startPosition with lastCurrentTime @${lastCurrentTime.toFixed(
            3,
          )}`,
        );
        startPosition = lastCurrentTime;
      }
      this.state = State.IDLE;
      this.nextLoadPosition =
        this.startPosition =
        this.lastCurrentTime =
          startPosition;
      this.tick();
    } else {
      this._forceStartLoad = true;
      this.state = State.STOPPED;
    }
  }

  public stopLoad() {
    this._forceStartLoad = false;
    super.stopLoad();
  }

  protected doTick() {
    switch (this.state) {
      case State.WAITING_LEVEL: {
        const { levels, level } = this;
        const currentLevel = levels?.[level];
        const details = currentLevel?.details;
        if (
          details &&
          (!details.live || this.levelLastLoaded === currentLevel)
        ) {
          if (this.waitForCdnTuneIn(details)) {
            break;
          }
          this.state = State.IDLE;
          break;
        } else if (this.hls.nextLoadLevel !== this.level) {
          this.state = State.IDLE;
          break;
        }
        break;
      }
      case State.FRAG_LOADING_WAITING_RETRY:
        {
          const now = self.performance.now();
          const retryDate = this.retryDate;
          // if current time is gt than retryDate, or if media seeking let's switch to IDLE state to retry loading
          if (!retryDate || now >= retryDate || this.media?.seeking) {
            const { levels, level } = this;
            const currentLevel = levels?.[level];
            this.resetStartWhenNotLoaded(currentLevel || null);
            this.state = State.IDLE;
          }
        }
        break;
      default:
        break;
    }
    if (this.state === State.IDLE) {
      this.doTickIdle();
    }
    this.onTickEnd();
  }

  protected onTickEnd() {
    super.onTickEnd();
    this.checkBuffer();
    this.checkFragmentChanged();
  }

  private doTickIdle() {
    const { hls, levelLastLoaded, levels, media } = this;

    // if start level not parsed yet OR
    // if video not attached AND start fragment already requested OR start frag prefetch not enabled
    // exit loop, as we either need more info (level not parsed) or we need media to be attached to load new fragment
    if (
      levelLastLoaded === null ||
      (!media && (this.startFragRequested || !hls.config.startFragPrefetch))
    ) {
      return;
    }

    // If the "main" level is audio-only but we are loading an alternate track in the same group, do not load anything
    if (this.altAudio && this.audioOnly) {
      return;
    }

    const level = this.buffering ? hls.nextLoadLevel : hls.loadLevel;
    if (!levels?.[level]) {
      return;
    }

    const levelInfo = levels[level];

    // if buffer length is less than maxBufLen try to load a new fragment

    const bufferInfo = this.getMainFwdBufferInfo();
    if (bufferInfo === null) {
      return;
    }

    const lastDetails = this.getLevelDetails();
    if (lastDetails && this._streamEnded(bufferInfo, lastDetails)) {
      const data: BufferEOSData = {};
      if (this.altAudio) {
        data.type = 'video';
      }

      this.hls.trigger(Events.BUFFER_EOS, data);
      this.state = State.ENDED;
      return;
    }
    if (!this.buffering) {
      return;
    }

    // set next load level : this will trigger a playlist load if needed
    if (hls.loadLevel !== level && hls.manualLevel === -1) {
      this.log(`Adapting to level ${level} from level ${this.level}`);
    }
    this.level = hls.nextLoadLevel = level;

    const levelDetails = levelInfo.details;
    // if level info not retrieved yet, switch state and wait for level retrieval
    // if live playlist, ensure that new playlist has been refreshed to avoid loading/try to load
    // a useless and outdated fragment (that might even introduce load error if it is already out of the live playlist)
    if (
      !levelDetails ||
      this.state === State.WAITING_LEVEL ||
      (levelDetails.live && this.levelLastLoaded !== levelInfo)
    ) {
      this.level = level;
      this.state = State.WAITING_LEVEL;
      return;
    }

    const bufferLen = bufferInfo.len;

    // compute max Buffer Length that we could get from this load level, based on level bitrate. don't buffer more than 60 MB and more than 30s
    const maxBufLen = this.getMaxBufferLength(levelInfo.maxBitrate);

    // Stay idle if we are still with buffer margins
    if (bufferLen >= maxBufLen) {
      return;
    }

    if (
      this.backtrackFragment &&
      this.backtrackFragment.start > bufferInfo.end
    ) {
      this.backtrackFragment = null;
    }
    const targetBufferTime = this.backtrackFragment
      ? this.backtrackFragment.start
      : bufferInfo.end;
    let frag = this.getNextFragment(targetBufferTime, levelDetails);
    // Avoid backtracking by loading an earlier segment in streams with segments that do not start with a key frame (flagged by `couldBacktrack`)
    if (
      this.couldBacktrack &&
      !this.fragPrevious &&
      frag &&
      frag.sn !== 'initSegment' &&
      this.fragmentTracker.getState(frag) !== FragmentState.OK
    ) {
      const backtrackSn = (this.backtrackFragment ?? frag).sn as number;
      const fragIdx = backtrackSn - levelDetails.startSN;
      const backtrackFrag = levelDetails.fragments[fragIdx - 1];
      if (backtrackFrag && frag.cc === backtrackFrag.cc) {
        frag = backtrackFrag;
        this.fragmentTracker.removeFragment(backtrackFrag);
      }
    } else if (this.backtrackFragment && bufferInfo.len) {
      this.backtrackFragment = null;
    }
    // Avoid loop loading by using nextLoadPosition set for backtracking and skipping consecutive GAP tags
    if (frag && this.isLoopLoading(frag, targetBufferTime)) {
      const gapStart = frag.gap;
      if (!gapStart) {
        // Cleanup the fragment tracker before trying to find the next unbuffered fragment
        const type =
          this.audioOnly && !this.altAudio
            ? ElementaryStreamTypes.AUDIO
            : ElementaryStreamTypes.VIDEO;
        const mediaBuffer =
          (type === ElementaryStreamTypes.VIDEO
            ? this.videoBuffer
            : this.mediaBuffer) || this.media;
        if (mediaBuffer) {
          this.afterBufferFlushed(mediaBuffer, type, PlaylistLevelType.MAIN);
        }
      }
      frag = this.getNextFragmentLoopLoading(
        frag,
        levelDetails,
        bufferInfo,
        PlaylistLevelType.MAIN,
        maxBufLen,
      );
    }
    if (!frag) {
      return;
    }
    if (frag.initSegment && !frag.initSegment.data && !this.bitrateTest) {
      frag = frag.initSegment;
    }

    this.loadFragment(frag, levelInfo, targetBufferTime);
  }

  protected loadFragment(
    frag: Fragment,
    level: Level,
    targetBufferTime: number,
  ) {
    // Check if fragment is not loaded
    const fragState = this.fragmentTracker.getState(frag);
    this.fragCurrent = frag;
    if (
      fragState === FragmentState.NOT_LOADED ||
      fragState === FragmentState.PARTIAL
    ) {
      if (frag.sn === 'initSegment') {
        this._loadInitSegment(frag, level);
      } else if (this.bitrateTest) {
        this.log(
          `Fragment ${frag.sn} of level ${frag.level} is being downloaded to test bitrate and will not be buffered`,
        );
        this._loadBitrateTestFrag(frag, level);
      } else {
        this.startFragRequested = true;
        super.loadFragment(frag, level, targetBufferTime);
      }
    } else {
      this.clearTrackerIfNeeded(frag);
    }
  }

  private getBufferedFrag(position) {
    return this.fragmentTracker.getBufferedFrag(
      position,
      PlaylistLevelType.MAIN,
    );
  }

  private followingBufferedFrag(frag: Fragment | null) {
    if (frag) {
      // try to get range of next fragment (500ms after this range)
      return this.getBufferedFrag(frag.end + 0.5);
    }
    return null;
  }

  /*
    on immediate level switch :
     - pause playback if playing
     - cancel any pending load request
     - and trigger a buffer flush
  */
  public immediateLevelSwitch() {
    this.abortCurrentFrag();
    this.flushMainBuffer(0, Number.POSITIVE_INFINITY);
  }

  /**
   * try to switch ASAP without breaking video playback:
   * in order to ensure smooth but quick level switching,
   * we need to find the next flushable buffer range
   * we should take into account new segment fetch time
   */
  public nextLevelSwitch() {
    const { levels, media } = this;
    // ensure that media is defined and that metadata are available (to retrieve currentTime)
    if (media?.readyState) {
      let fetchdelay;
      const fragPlayingCurrent = this.getAppendedFrag(media.currentTime);
      if (fragPlayingCurrent && fragPlayingCurrent.start > 1) {
        // flush buffer preceding current fragment (flush until current fragment start offset)
        // minus 1s to avoid video freezing, that could happen if we flush keyframe of current video ...
        this.flushMainBuffer(0, fragPlayingCurrent.start - 1);
      }
      const levelDetails = this.getLevelDetails();
      if (levelDetails?.live) {
        const bufferInfo = this.getMainFwdBufferInfo();
        // Do not flush in live stream with low buffer
        if (!bufferInfo || bufferInfo.len < levelDetails.targetduration * 2) {
          return;
        }
      }
      if (!media.paused && levels) {
        // add a safety delay of 1s
        const nextLevelId = this.hls.nextLoadLevel;
        const nextLevel = levels[nextLevelId];
        const fragLastKbps = this.fragLastKbps;
        if (fragLastKbps && this.fragCurrent) {
          fetchdelay =
            (this.fragCurrent.duration * nextLevel.maxBitrate) /
              (1000 * fragLastKbps) +
            1;
        } else {
          fetchdelay = 0;
        }
      } else {
        fetchdelay = 0;
      }
      // this.log('fetchdelay:'+fetchdelay);
      // find buffer range that will be reached once new fragment will be fetched
      const bufferedFrag = this.getBufferedFrag(media.currentTime + fetchdelay);
      if (bufferedFrag) {
        // we can flush buffer range following this one without stalling playback
        const nextBufferedFrag = this.followingBufferedFrag(bufferedFrag);
        if (nextBufferedFrag) {
          // if we are here, we can also cancel any loading/demuxing in progress, as they are useless
          this.abortCurrentFrag();
          // start flush position is in next buffered frag. Leave some padding for non-independent segments and smoother playback.
          const maxStart = nextBufferedFrag.maxStartPTS
            ? nextBufferedFrag.maxStartPTS
            : nextBufferedFrag.start;
          const fragDuration = nextBufferedFrag.duration;
          const startPts = Math.max(
            bufferedFrag.end,
            maxStart +
              Math.min(
                Math.max(
                  fragDuration - this.config.maxFragLookUpTolerance,
                  fragDuration * (this.couldBacktrack ? 0.5 : 0.125),
                ),
                fragDuration * (this.couldBacktrack ? 0.75 : 0.25),
              ),
          );
          this.flushMainBuffer(startPts, Number.POSITIVE_INFINITY);
        }
      }
    }
  }

  private abortCurrentFrag() {
    const fragCurrent = this.fragCurrent;
    this.fragCurrent = null;
    this.backtrackFragment = null;
    if (fragCurrent) {
      fragCurrent.abortRequests();
      this.fragmentTracker.removeFragment(fragCurrent);
    }
    switch (this.state) {
      case State.KEY_LOADING:
      case State.FRAG_LOADING:
      case State.FRAG_LOADING_WAITING_RETRY:
      case State.PARSING:
      case State.PARSED:
        this.state = State.IDLE;
        break;
    }
    this.nextLoadPosition = this.getLoadPosition();
  }

  protected flushMainBuffer(startOffset: number, endOffset: number) {
    super.flushMainBuffer(
      startOffset,
      endOffset,
      this.altAudio ? 'video' : null,
    );
  }

  protected onMediaAttached(
    event: Events.MEDIA_ATTACHED,
    data: MediaAttachedData,
  ) {
    super.onMediaAttached(event, data);
    const media = data.media;
    this.onvplaying = this.onMediaPlaying.bind(this);
    this.onvseeked = this.onMediaSeeked.bind(this);
    media.addEventListener('playing', this.onvplaying as EventListener);
    media.addEventListener('seeked', this.onvseeked as EventListener);
    this.gapController = new GapController(
      this.config,
      media,
      this.fragmentTracker,
      this.hls,
    );
  }

  protected onMediaDetaching() {
    const { media } = this;
    if (media && this.onvplaying && this.onvseeked) {
      media.removeEventListener('playing', this.onvplaying);
      media.removeEventListener('seeked', this.onvseeked);
      this.onvplaying = this.onvseeked = null;
      this.videoBuffer = null;
    }
    this.fragPlaying = null;
    if (this.gapController) {
      this.gapController.destroy();
      this.gapController = null;
    }
    super.onMediaDetaching();
  }

  private onMediaPlaying() {
    // tick to speed up FRAG_CHANGED triggering
    this.tick();
  }

  private onMediaSeeked() {
    const media = this.media;
    const currentTime = media ? media.currentTime : null;
    if (Number.isFinite(currentTime)) {
      this.log(`Media seeked to ${(currentTime as number).toFixed(3)}`);
    }

    // If seeked was issued before buffer was appended do not tick immediately
    const bufferInfo = this.getMainFwdBufferInfo();
    if (bufferInfo === null || bufferInfo.len === 0) {
      this.warn(
        `Main forward buffer length on "seeked" event ${
          bufferInfo ? bufferInfo.len : 'empty'
        })`,
      );
      return;
    }

    // tick to speed up FRAG_CHANGED triggering
    this.tick();
  }

  private onManifestLoading() {
    // reset buffer on manifest loading
    this.log('Trigger BUFFER_RESET');
    this.hls.trigger(Events.BUFFER_RESET, undefined);
    this.fragmentTracker.removeAllFragments();
    this.couldBacktrack = false;
    this.startPosition = this.lastCurrentTime = this.fragLastKbps = 0;
    this.levels =
      this.fragPlaying =
      this.backtrackFragment =
      this.levelLastLoaded =
        null;
    this.altAudio = this.audioOnly = this.startFragRequested = false;
  }

  private onManifestParsed(
    event: Events.MANIFEST_PARSED,
    data: ManifestParsedData,
  ) {
    // detect if we have different kind of audio codecs used amongst playlists
    let aac = false;
    let heaac = false;
    data.levels.forEach((level) => {
      const codec = level.audioCodec;
      if (codec) {
        aac = aac || codec.indexOf('mp4a.40.2') !== -1;
        heaac = heaac || codec.indexOf('mp4a.40.5') !== -1;
      }
    });
    this.audioCodecSwitch = aac && heaac && !changeTypeSupported();
    if (this.audioCodecSwitch) {
      this.log(
        'Both AAC/HE-AAC audio found in levels; declaring level codec as HE-AAC',
      );
    }

    this.levels = data.levels;
    this.startFragRequested = false;
  }

  private onLevelLoading(event: Events.LEVEL_LOADING, data: LevelLoadingData) {
    const { levels } = this;
    if (!levels || this.state !== State.IDLE) {
      return;
    }
    const level = levels[data.level];
    if (
      !level.details ||
      (level.details.live && this.levelLastLoaded !== level) ||
      this.waitForCdnTuneIn(level.details)
    ) {
      this.state = State.WAITING_LEVEL;
    }
  }

  private onLevelLoaded(event: Events.LEVEL_LOADED, data: LevelLoadedData) {
    const { levels } = this;
    const newLevelId = data.level;
    const newDetails = data.details;
    const duration = newDetails.totalduration;

    if (!levels) {
      this.warn(`Levels were reset while loading level ${newLevelId}`);
      return;
    }
    this.log(
      `Level ${newLevelId} loaded [${newDetails.startSN},${newDetails.endSN}]${
        newDetails.lastPartSn
          ? `[part-${newDetails.lastPartSn}-${newDetails.lastPartIndex}]`
          : ''
      }, cc [${newDetails.startCC}, ${newDetails.endCC}] duration:${duration}`,
    );

    const curLevel = levels[newLevelId];
    const fragCurrent = this.fragCurrent;
    if (
      fragCurrent &&
      (this.state === State.FRAG_LOADING ||
        this.state === State.FRAG_LOADING_WAITING_RETRY)
    ) {
      if (fragCurrent.level !== data.level && fragCurrent.loader) {
        this.abortCurrentFrag();
      }
    }

    let sliding = 0;
    if (newDetails.live || curLevel.details?.live) {
      this.checkLiveUpdate(newDetails);
      if (newDetails.deltaUpdateFailed) {
        return;
      }
      sliding = this.alignPlaylists(
        newDetails,
        curLevel.details,
        this.levelLastLoaded?.details,
      );
    }
    // override level info
    curLevel.details = newDetails;
    this.levelLastLoaded = curLevel;

    this.hls.trigger(Events.LEVEL_UPDATED, {
      details: newDetails,
      level: newLevelId,
    });

    // only switch back to IDLE state if we were waiting for level to start downloading a new fragment
    if (this.state === State.WAITING_LEVEL) {
      if (this.waitForCdnTuneIn(newDetails)) {
        // Wait for Low-Latency CDN Tune-in
        return;
      }
      this.state = State.IDLE;
    }

    if (!this.startFragRequested) {
      this.setStartPosition(newDetails, sliding);
    } else if (newDetails.live) {
      this.synchronizeToLiveEdge(newDetails);
    }

    // trigger handler right now
    this.tick();
  }

  protected _handleFragmentLoadProgress(data: FragLoadedData) {
    const { frag, part, payload } = data;
    const { levels } = this;
    if (!levels) {
      this.warn(
        `Levels were reset while fragment load was in progress. Fragment ${frag.sn} of level ${frag.level} will not be buffered`,
      );
      return;
    }
    const currentLevel = levels[frag.level];
    const details = currentLevel.details as LevelDetails;
    if (!details) {
      this.warn(
        `Dropping fragment ${frag.sn} of level ${frag.level} after level details were reset`,
      );
      this.fragmentTracker.removeFragment(frag);
      return;
    }
    const videoCodec = currentLevel.videoCodec;

    // time Offset is accurate if level PTS is known, or if playlist is not sliding (not live)
    const accurateTimeOffset = details.PTSKnown || !details.live;
    const initSegmentData = frag.initSegment?.data;
    const audioCodec = this._getAudioCodec(currentLevel);

    // transmux the MPEG-TS data to ISO-BMFF segments
    // this.log(`Transmuxing ${frag.sn} of [${details.startSN} ,${details.endSN}],level ${frag.level}, cc ${frag.cc}`);
    const transmuxer = (this.transmuxer =
      this.transmuxer ||
      new TransmuxerInterface(
        this.hls,
        PlaylistLevelType.MAIN,
        this._handleTransmuxComplete.bind(this),
        this._handleTransmuxerFlush.bind(this),
      ));
    const partIndex = part ? part.index : -1;
    const partial = partIndex !== -1;
    const chunkMeta = new ChunkMetadata(
      frag.level,
      frag.sn as number,
      frag.stats.chunkCount,
      payload.byteLength,
      partIndex,
      partial,
    );
    const initPTS = this.initPTS[frag.cc];

    transmuxer.push(
      payload,
      initSegmentData,
      audioCodec,
      videoCodec,
      frag,
      part,
      details.totalduration,
      accurateTimeOffset,
      chunkMeta,
      initPTS,
    );
  }

  private onAudioTrackSwitching(
    event: Events.AUDIO_TRACK_SWITCHING,
    data: AudioTrackSwitchingData,
  ) {
    // if any URL found on new audio track, it is an alternate audio track
    const fromAltAudio = this.altAudio;
    const altAudio = !!data.url;
    // if we switch on main audio, ensure that main fragment scheduling is synced with media.buffered
    // don't do anything if we switch to alt audio: audio stream controller is handling it.
    // we will just have to change buffer scheduling on audioTrackSwitched
    if (!altAudio) {
      if (this.mediaBuffer !== this.media) {
        this.log(
          'Switching on main audio, use media.buffered to schedule main fragment loading',
        );
        this.mediaBuffer = this.media;
        const fragCurrent = this.fragCurrent;
        // we need to refill audio buffer from main: cancel any frag loading to speed up audio switch
        if (fragCurrent) {
          this.log('Switching to main audio track, cancel main fragment load');
          fragCurrent.abortRequests();
          this.fragmentTracker.removeFragment(fragCurrent);
        }
        // destroy transmuxer to force init segment generation (following audio switch)
        this.resetTransmuxer();
        // switch to IDLE state to load new fragment
        this.resetLoadingState();
      } else if (this.audioOnly) {
        // Reset audio transmuxer so when switching back to main audio we're not still appending where we left off
        this.resetTransmuxer();
      }
      const hls = this.hls;
      // If switching from alt to main audio, flush all audio and trigger track switched
      if (fromAltAudio) {
        hls.trigger(Events.BUFFER_FLUSHING, {
          startOffset: 0,
          endOffset: Number.POSITIVE_INFINITY,
          type: null,
        });
        this.fragmentTracker.removeAllFragments();
      }
      hls.trigger(Events.AUDIO_TRACK_SWITCHED, data);
    }
  }

  private onAudioTrackSwitched(
    event: Events.AUDIO_TRACK_SWITCHED,
    data: AudioTrackSwitchedData,
  ) {
    const trackId = data.id;
    const altAudio = !!this.hls.audioTracks[trackId].url;
    if (altAudio) {
      const videoBuffer = this.videoBuffer;
      // if we switched on alternate audio, ensure that main fragment scheduling is synced with video sourcebuffer buffered
      if (videoBuffer && this.mediaBuffer !== videoBuffer) {
        this.log(
          'Switching on alternate audio, use video.buffered to schedule main fragment loading',
        );
        this.mediaBuffer = videoBuffer;
      }
    }
    this.altAudio = altAudio;
    this.tick();
  }

  private onBufferCreated(
    event: Events.BUFFER_CREATED,
    data: BufferCreatedData,
  ) {
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
      this.log(
        `Alternate track found, use ${name}.buffered to schedule main fragment loading`,
      );
      this.mediaBuffer = mediaTrack.buffer;
    } else {
      this.mediaBuffer = this.media;
    }
  }

  private onFragBuffered(event: Events.FRAG_BUFFERED, data: FragBufferedData) {
    const { frag, part } = data;
    if (frag && frag.type !== PlaylistLevelType.MAIN) {
      return;
    }
    if (this.fragContextChanged(frag)) {
      // If a level switch was requested while a fragment was buffering, it will emit the FRAG_BUFFERED event upon completion
      // Avoid setting state back to IDLE, since that will interfere with a level switch
      this.warn(
        `Fragment ${frag.sn}${part ? ' p: ' + part.index : ''} of level ${
          frag.level
        } finished buffering, but was aborted. state: ${this.state}`,
      );
      if (this.state === State.PARSED) {
        this.state = State.IDLE;
      }
      return;
    }
    const stats = part ? part.stats : frag.stats;
    this.fragLastKbps = Math.round(
      (8 * stats.total) / (stats.buffering.end - stats.loading.first),
    );
    if (frag.sn !== 'initSegment') {
      this.fragPrevious = frag;
    }
    this.fragBufferedComplete(frag, part);
  }

  private onError(event: Events.ERROR, data: ErrorData) {
    if (data.fatal) {
      this.state = State.ERROR;
      return;
    }
    switch (data.details) {
      case ErrorDetails.FRAG_GAP:
      case ErrorDetails.FRAG_PARSING_ERROR:
      case ErrorDetails.FRAG_DECRYPT_ERROR:
      case ErrorDetails.FRAG_LOAD_ERROR:
      case ErrorDetails.FRAG_LOAD_TIMEOUT:
      case ErrorDetails.KEY_LOAD_ERROR:
      case ErrorDetails.KEY_LOAD_TIMEOUT:
        this.onFragmentOrKeyLoadError(PlaylistLevelType.MAIN, data);
        break;
      case ErrorDetails.LEVEL_LOAD_ERROR:
      case ErrorDetails.LEVEL_LOAD_TIMEOUT:
      case ErrorDetails.LEVEL_PARSING_ERROR:
        // in case of non fatal error while loading level, if level controller is not retrying to load level, switch back to IDLE
        if (
          !data.levelRetry &&
          this.state === State.WAITING_LEVEL &&
          data.context?.type === PlaylistContextType.LEVEL
        ) {
          this.state = State.IDLE;
        }
        break;
      case ErrorDetails.BUFFER_APPEND_ERROR:
      case ErrorDetails.BUFFER_FULL_ERROR:
        if (!data.parent || data.parent !== 'main') {
          return;
        }
        if (data.details === ErrorDetails.BUFFER_APPEND_ERROR) {
          this.resetLoadingState();
          return;
        }
        if (this.reduceLengthAndFlushBuffer(data)) {
          this.flushMainBuffer(0, Number.POSITIVE_INFINITY);
        }
        break;
      case ErrorDetails.INTERNAL_EXCEPTION:
        this.recoverWorkerError(data);
        break;
      default:
        break;
    }
  }

  // Checks the health of the buffer and attempts to resolve playback stalls.
  private checkBuffer() {
    const { media, gapController } = this;
    if (!media || !gapController || !media.readyState) {
      // Exit early if we don't have media or if the media hasn't buffered anything yet (readyState 0)
      return;
    }

    if (this.loadedmetadata || !BufferHelper.getBuffered(media).length) {
      // Resolve gaps using the main buffer, whose ranges are the intersections of the A/V sourcebuffers
      const activeFrag = this.state !== State.IDLE ? this.fragCurrent : null;
      gapController.poll(this.lastCurrentTime, activeFrag);
    }

    this.lastCurrentTime = media.currentTime;
  }

  private onFragLoadEmergencyAborted() {
    this.state = State.IDLE;
    // if loadedmetadata is not set, it means that we are emergency switch down on first frag
    // in that case, reset startFragRequested flag
    if (!this.loadedmetadata) {
      this.startFragRequested = false;
      this.nextLoadPosition = this.startPosition;
    }
    this.tickImmediate();
  }

  private onBufferFlushed(
    event: Events.BUFFER_FLUSHED,
    { type }: BufferFlushedData,
  ) {
    if (
      type !== ElementaryStreamTypes.AUDIO ||
      (this.audioOnly && !this.altAudio)
    ) {
      const mediaBuffer =
        (type === ElementaryStreamTypes.VIDEO
          ? this.videoBuffer
          : this.mediaBuffer) || this.media;
      this.afterBufferFlushed(mediaBuffer, type, PlaylistLevelType.MAIN);
      this.tick();
    }
  }

  private onLevelsUpdated(
    event: Events.LEVELS_UPDATED,
    data: LevelsUpdatedData,
  ) {
    if (this.level > -1 && this.fragCurrent) {
      this.level = this.fragCurrent.level;
    }
    this.levels = data.levels;
  }

  public swapAudioCodec() {
    this.audioCodecSwap = !this.audioCodecSwap;
  }

  /**
   * Seeks to the set startPosition if not equal to the mediaElement's current time.
   */
  protected seekToStartPos() {
    const { media } = this;
    if (!media) {
      return;
    }
    const currentTime = media.currentTime;
    let startPosition = this.startPosition;
    // only adjust currentTime if different from startPosition or if startPosition not buffered
    // at that stage, there should be only one buffered range, as we reach that code after first fragment has been buffered
    if (startPosition >= 0 && currentTime < startPosition) {
      if (media.seeking) {
        this.log(
          `could not seek to ${startPosition}, already seeking at ${currentTime}`,
        );
        return;
      }
      const buffered = BufferHelper.getBuffered(media);
      const bufferStart = buffered.length ? buffered.start(0) : 0;
      const delta = bufferStart - startPosition;
      if (
        delta > 0 &&
        (delta < this.config.maxBufferHole ||
          delta < this.config.maxFragLookUpTolerance)
      ) {
        this.log(`adjusting start position by ${delta} to match buffer start`);
        startPosition += delta;
        this.startPosition = startPosition;
      }
      this.log(
        `seek to target start position ${startPosition} from current time ${currentTime}`,
      );
      media.currentTime = startPosition;
    }
  }

  private _getAudioCodec(currentLevel) {
    let audioCodec = this.config.defaultAudioCodec || currentLevel.audioCodec;
    if (this.audioCodecSwap && audioCodec) {
      this.log('Swapping audio codec');
      if (audioCodec.indexOf('mp4a.40.5') !== -1) {
        audioCodec = 'mp4a.40.2';
      } else {
        audioCodec = 'mp4a.40.5';
      }
    }

    return audioCodec;
  }

  private _loadBitrateTestFrag(frag: Fragment, level: Level) {
    frag.bitrateTest = true;
    this._doFragLoad(frag, level).then((data) => {
      const { hls } = this;
      if (!data || this.fragContextChanged(frag)) {
        return;
      }
      level.fragmentError = 0;
      this.state = State.IDLE;
      this.startFragRequested = false;
      this.bitrateTest = false;
      const stats = frag.stats;
      // Bitrate tests fragments are neither parsed nor buffered
      stats.parsing.start =
        stats.parsing.end =
        stats.buffering.start =
        stats.buffering.end =
          self.performance.now();
      hls.trigger(Events.FRAG_LOADED, data as FragLoadedData);
      frag.bitrateTest = false;
    });
  }

  private _handleTransmuxComplete(transmuxResult: TransmuxerResult) {
    const id = 'main';
    const { hls } = this;
    const { remuxResult, chunkMeta } = transmuxResult;

    const context = this.getCurrentContext(chunkMeta);
    if (!context) {
      this.resetWhenMissingContext(chunkMeta);
      return;
    }
    const { frag, part, level } = context;
    const { video, text, id3, initSegment } = remuxResult;
    const { details } = level;
    // The audio-stream-controller handles audio buffering if Hls.js is playing an alternate audio track
    const audio = this.altAudio ? undefined : remuxResult.audio;

    // Check if the current fragment has been aborted. We check this by first seeing if we're still playing the current level.
    // If we are, subsequently check if the currently loading fragment (fragCurrent) has changed.
    if (this.fragContextChanged(frag)) {
      this.fragmentTracker.removeFragment(frag);
      return;
    }

    this.state = State.PARSING;

    if (initSegment) {
      if (initSegment?.tracks) {
        const mapFragment = frag.initSegment || frag;
        this._bufferInitSegment(
          level,
          initSegment.tracks,
          mapFragment,
          chunkMeta,
        );
        hls.trigger(Events.FRAG_PARSING_INIT_SEGMENT, {
          frag: mapFragment,
          id,
          tracks: initSegment.tracks,
        });
      }

      // This would be nice if Number.isFinite acted as a typeguard, but it doesn't. See: https://github.com/Microsoft/TypeScript/issues/10038
      const initPTS = initSegment.initPTS as number;
      const timescale = initSegment.timescale as number;
      if (Number.isFinite(initPTS)) {
        this.initPTS[frag.cc] = { baseTime: initPTS, timescale };
        hls.trigger(Events.INIT_PTS_FOUND, { frag, id, initPTS, timescale });
      }
    }

    // Avoid buffering if backtracking this fragment
    if (video && details && frag.sn !== 'initSegment') {
      const prevFrag = details.fragments[frag.sn - 1 - details.startSN];
      const isFirstFragment = frag.sn === details.startSN;
      const isFirstInDiscontinuity = !prevFrag || frag.cc > prevFrag.cc;
      if (remuxResult.independent !== false) {
        const { startPTS, endPTS, startDTS, endDTS } = video;
        if (part) {
          part.elementaryStreams[video.type] = {
            startPTS,
            endPTS,
            startDTS,
            endDTS,
          };
        } else {
          if (
            video.firstKeyFrame &&
            video.independent &&
            chunkMeta.id === 1 &&
            !isFirstInDiscontinuity
          ) {
            this.couldBacktrack = true;
          }
          if (video.dropped && video.independent) {
            // Backtrack if dropped frames create a gap after currentTime

            const bufferInfo = this.getMainFwdBufferInfo();
            const targetBufferTime =
              (bufferInfo ? bufferInfo.end : this.getLoadPosition()) +
              this.config.maxBufferHole;
            const startTime = video.firstKeyFramePTS
              ? video.firstKeyFramePTS
              : startPTS;
            if (
              !isFirstFragment &&
              targetBufferTime < startTime - this.config.maxBufferHole &&
              !isFirstInDiscontinuity
            ) {
              this.backtrack(frag);
              return;
            } else if (isFirstInDiscontinuity) {
              // Mark segment with a gap to avoid loop loading
              frag.gap = true;
            }
            // Set video stream start to fragment start so that truncated samples do not distort the timeline, and mark it partial
            frag.setElementaryStreamInfo(
              video.type as ElementaryStreamTypes,
              frag.start,
              endPTS,
              frag.start,
              endDTS,
              true,
            );
          } else if (isFirstFragment && startPTS > MAX_START_GAP_JUMP) {
            // Mark segment with a gap to skip large start gap
            frag.gap = true;
          }
        }
        frag.setElementaryStreamInfo(
          video.type as ElementaryStreamTypes,
          startPTS,
          endPTS,
          startDTS,
          endDTS,
        );
        if (this.backtrackFragment) {
          this.backtrackFragment = frag;
        }
        this.bufferFragmentData(
          video,
          frag,
          part,
          chunkMeta,
          isFirstFragment || isFirstInDiscontinuity,
        );
      } else if (isFirstFragment || isFirstInDiscontinuity) {
        // Mark segment with a gap to avoid loop loading
        frag.gap = true;
      } else {
        this.backtrack(frag);
        return;
      }
    }

    if (audio) {
      const { startPTS, endPTS, startDTS, endDTS } = audio;
      if (part) {
        part.elementaryStreams[ElementaryStreamTypes.AUDIO] = {
          startPTS,
          endPTS,
          startDTS,
          endDTS,
        };
      }
      frag.setElementaryStreamInfo(
        ElementaryStreamTypes.AUDIO,
        startPTS,
        endPTS,
        startDTS,
        endDTS,
      );
      this.bufferFragmentData(audio, frag, part, chunkMeta);
    }

    if (details && id3?.samples?.length) {
      const emittedID3: FragParsingMetadataData = {
        id,
        frag,
        details,
        samples: id3.samples,
      };
      hls.trigger(Events.FRAG_PARSING_METADATA, emittedID3);
    }
    if (details && text) {
      const emittedText: FragParsingUserdataData = {
        id,
        frag,
        details,
        samples: text.samples,
      };
      hls.trigger(Events.FRAG_PARSING_USERDATA, emittedText);
    }
  }

  private _bufferInitSegment(
    currentLevel: Level,
    tracks: TrackSet,
    frag: Fragment,
    chunkMeta: ChunkMetadata,
  ) {
    if (this.state !== State.PARSING) {
      return;
    }

    this.audioOnly = !!tracks.audio && !tracks.video;

    // if audio track is expected to come from audio stream controller, discard any coming from main
    if (this.altAudio && !this.audioOnly) {
      delete tracks.audio;
    }
    // include levelCodec in audio and video tracks
    const { audio, video, audiovideo } = tracks;
    if (audio) {
      let audioCodec = currentLevel.audioCodec;
      const ua = navigator.userAgent.toLowerCase();
      if (this.audioCodecSwitch) {
        if (audioCodec) {
          if (audioCodec.indexOf('mp4a.40.5') !== -1) {
            audioCodec = 'mp4a.40.2';
          } else {
            audioCodec = 'mp4a.40.5';
          }
        }
        // In the case that AAC and HE-AAC audio codecs are signalled in manifest,
        // force HE-AAC, as it seems that most browsers prefers it.
        // don't force HE-AAC if mono stream, or in Firefox
        const audioMetadata = audio.metadata;
        if (
          audioMetadata &&
          'channelCount' in audioMetadata &&
          (audioMetadata.channelCount || 1) !== 1 &&
          ua.indexOf('firefox') === -1
        ) {
          audioCodec = 'mp4a.40.5';
        }
      }
      // HE-AAC is broken on Android, always signal audio codec as AAC even if variant manifest states otherwise
      if (
        audioCodec &&
        audioCodec.indexOf('mp4a.40.5') !== -1 &&
        ua.indexOf('android') !== -1 &&
        audio.container !== 'audio/mpeg'
      ) {
        // Exclude mpeg audio
        audioCodec = 'mp4a.40.2';
        this.log(`Android: force audio codec to ${audioCodec}`);
      }
      if (currentLevel.audioCodec && currentLevel.audioCodec !== audioCodec) {
        this.log(
          `Swapping manifest audio codec "${currentLevel.audioCodec}" for "${audioCodec}"`,
        );
      }
      audio.levelCodec = audioCodec;
      audio.id = 'main';
      this.log(
        `Init audio buffer, container:${
          audio.container
        }, codecs[selected/level/parsed]=[${audioCodec || ''}/${
          currentLevel.audioCodec || ''
        }/${audio.codec}]`,
      );
    }
    if (video) {
      video.levelCodec = currentLevel.videoCodec;
      video.id = 'main';
      this.log(
        `Init video buffer, container:${
          video.container
        }, codecs[level/parsed]=[${currentLevel.videoCodec || ''}/${
          video.codec
        }]`,
      );
    }
    if (audiovideo) {
      this.log(
        `Init audiovideo buffer, container:${audiovideo.container}, codecs[level/parsed]=[${currentLevel.codecs}/${audiovideo.codec}]`,
      );
    }
    this.hls.trigger(Events.BUFFER_CODECS, tracks);
    // loop through tracks that are going to be provided to bufferController
    Object.keys(tracks).forEach((trackName) => {
      const track = tracks[trackName];
      const initSegment = track.initSegment;
      if (initSegment?.byteLength) {
        this.hls.trigger(Events.BUFFER_APPENDING, {
          type: trackName as SourceBufferName,
          data: initSegment,
          frag,
          part: null,
          chunkMeta,
          parent: frag.type,
        });
      }
    });
    // trigger handler right now
    this.tickImmediate();
  }

  public getMainFwdBufferInfo(): BufferInfo | null {
    return this.getFwdBufferInfo(
      this.mediaBuffer ? this.mediaBuffer : this.media,
      PlaylistLevelType.MAIN,
    );
  }

  private backtrack(frag: Fragment) {
    this.couldBacktrack = true;
    // Causes findFragments to backtrack through fragments to find the keyframe
    this.backtrackFragment = frag;
    this.resetTransmuxer();
    this.flushBufferGap(frag);
    this.fragmentTracker.removeFragment(frag);
    this.fragPrevious = null;
    this.nextLoadPosition = frag.start;
    this.state = State.IDLE;
  }

  private checkFragmentChanged() {
    const video = this.media;
    let fragPlayingCurrent: Fragment | null = null;
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
        this.backtrackFragment = null;
        const fragPlaying = this.fragPlaying;
        const fragCurrentLevel = fragPlayingCurrent.level;
        if (
          !fragPlaying ||
          fragPlayingCurrent.sn !== fragPlaying.sn ||
          fragPlaying.level !== fragCurrentLevel
        ) {
          this.fragPlaying = fragPlayingCurrent;
          this.hls.trigger(Events.FRAG_CHANGED, { frag: fragPlayingCurrent });
          if (!fragPlaying || fragPlaying.level !== fragCurrentLevel) {
            this.hls.trigger(Events.LEVEL_SWITCHED, {
              level: fragCurrentLevel,
            });
          }
        }
      }
    }
  }

  get nextLevel(): number {
    const frag = this.nextBufferedFrag;
    if (frag) {
      return frag.level;
    }
    return -1;
  }

  get currentFrag(): Fragment | null {
    const media = this.media;
    if (media) {
      return this.fragPlaying || this.getAppendedFrag(media.currentTime);
    }
    return null;
  }

  get currentProgramDateTime(): Date | null {
    const media = this.media;
    if (media) {
      const currentTime = media.currentTime;
      const frag = this.currentFrag;
      if (
        frag &&
        Number.isFinite(currentTime) &&
        Number.isFinite(frag.programDateTime)
      ) {
        const epocMs =
          (frag.programDateTime as number) + (currentTime - frag.start) * 1000;
        return new Date(epocMs);
      }
    }
    return null;
  }

  get currentLevel(): number {
    const frag = this.currentFrag;
    if (frag) {
      return frag.level;
    }
    return -1;
  }

  get nextBufferedFrag() {
    const frag = this.currentFrag;
    if (frag) {
      return this.followingBufferedFrag(frag);
    }
    return null;
  }

  get forceStartLoad() {
    return this._forceStartLoad;
  }
}
