import BaseStreamController, { State } from './base-stream-controller';
import { Events } from '../events';
import { Bufferable, BufferHelper } from '../utils/buffer-helper';
import { FragmentState } from './fragment-tracker';
import { Level } from '../types/level';
import { PlaylistContextType, PlaylistLevelType } from '../types/loader';
import { Fragment, ElementaryStreamTypes, Part } from '../loader/fragment';
import ChunkCache from '../demux/chunk-cache';
import TransmuxerInterface from '../demux/transmuxer-interface';
import { ChunkMetadata } from '../types/transmuxer';
import { fragmentWithinToleranceTest } from './fragment-finders';
import { alignMediaPlaylistByPDT } from '../utils/discontinuities';
import { ErrorDetails } from '../errors';
import { audioMatchPredicate, matchesOption } from '../utils/rendition-helper';
import type { NetworkComponentAPI } from '../types/component-api';
import type Hls from '../hls';
import type { FragmentTracker } from './fragment-tracker';
import type KeyLoader from '../loader/key-loader';
import type { TransmuxerResult } from '../types/transmuxer';
import type { LevelDetails } from '../loader/level-details';
import type { TrackSet } from '../types/track';
import type {
  BufferCreatedData,
  AudioTracksUpdatedData,
  AudioTrackSwitchingData,
  LevelLoadedData,
  TrackLoadedData,
  BufferAppendingData,
  BufferFlushedData,
  InitPTSFoundData,
  FragLoadedData,
  FragParsingMetadataData,
  FragParsingUserdataData,
  FragBufferedData,
  ErrorData,
  BufferFlushingData,
} from '../types/events';
import type { MediaPlaylist } from '../types/media-playlist';

const TICK_INTERVAL = 100; // how often to tick in ms

type WaitingForPTSData = {
  frag: Fragment;
  part: Part | null;
  cache: ChunkCache;
  complete: boolean;
};

class AudioStreamController
  extends BaseStreamController
  implements NetworkComponentAPI
{
  private videoBuffer: Bufferable | null = null;
  private videoTrackCC: number = -1;
  private waitingVideoCC: number = -1;
  private bufferedTrack: MediaPlaylist | null = null;
  private switchingTrack: MediaPlaylist | null = null;
  private trackId: number = -1;
  private waitingData: WaitingForPTSData | null = null;
  private mainDetails: LevelDetails | null = null;
  private flushing: boolean = false;
  private bufferFlushed: boolean = false;
  private cachedTrackLoadedData: TrackLoadedData | null = null;

  constructor(
    hls: Hls,
    fragmentTracker: FragmentTracker,
    keyLoader: KeyLoader,
  ) {
    super(
      hls,
      fragmentTracker,
      keyLoader,
      '[audio-stream-controller]',
      PlaylistLevelType.AUDIO,
    );
    this._registerListeners();
  }

  protected onHandlerDestroying() {
    this._unregisterListeners();
    super.onHandlerDestroying();
    this.mainDetails = null;
    this.bufferedTrack = null;
    this.switchingTrack = null;
  }

  private _registerListeners() {
    const { hls } = this;
    hls.on(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    hls.on(Events.MEDIA_DETACHING, this.onMediaDetaching, this);
    hls.on(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.on(Events.LEVEL_LOADED, this.onLevelLoaded, this);
    hls.on(Events.AUDIO_TRACKS_UPDATED, this.onAudioTracksUpdated, this);
    hls.on(Events.AUDIO_TRACK_SWITCHING, this.onAudioTrackSwitching, this);
    hls.on(Events.AUDIO_TRACK_LOADED, this.onAudioTrackLoaded, this);
    hls.on(Events.ERROR, this.onError, this);
    hls.on(Events.BUFFER_RESET, this.onBufferReset, this);
    hls.on(Events.BUFFER_CREATED, this.onBufferCreated, this);
    hls.on(Events.BUFFER_FLUSHING, this.onBufferFlushing, this);
    hls.on(Events.BUFFER_FLUSHED, this.onBufferFlushed, this);
    hls.on(Events.INIT_PTS_FOUND, this.onInitPtsFound, this);
    hls.on(Events.FRAG_BUFFERED, this.onFragBuffered, this);
  }

  private _unregisterListeners() {
    const { hls } = this;
    hls.off(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    hls.off(Events.MEDIA_DETACHING, this.onMediaDetaching, this);
    hls.off(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.off(Events.LEVEL_LOADED, this.onLevelLoaded, this);
    hls.off(Events.AUDIO_TRACKS_UPDATED, this.onAudioTracksUpdated, this);
    hls.off(Events.AUDIO_TRACK_SWITCHING, this.onAudioTrackSwitching, this);
    hls.off(Events.AUDIO_TRACK_LOADED, this.onAudioTrackLoaded, this);
    hls.off(Events.ERROR, this.onError, this);
    hls.off(Events.BUFFER_RESET, this.onBufferReset, this);
    hls.off(Events.BUFFER_CREATED, this.onBufferCreated, this);
    hls.off(Events.BUFFER_FLUSHING, this.onBufferFlushing, this);
    hls.off(Events.BUFFER_FLUSHED, this.onBufferFlushed, this);
    hls.off(Events.INIT_PTS_FOUND, this.onInitPtsFound, this);
    hls.off(Events.FRAG_BUFFERED, this.onFragBuffered, this);
  }

  // INIT_PTS_FOUND is triggered when the video track parsed in the stream-controller has a new PTS value
  onInitPtsFound(
    event: Events.INIT_PTS_FOUND,
    { frag, id, initPTS, timescale }: InitPTSFoundData,
  ) {
    // Always update the new INIT PTS
    // Can change due level switch
    if (id === 'main') {
      const cc = frag.cc;
      this.initPTS[frag.cc] = { baseTime: initPTS, timescale };
      this.log(`InitPTS for cc: ${cc} found from main: ${initPTS}`);
      this.videoTrackCC = cc;
      // If we are waiting, tick immediately to unblock audio fragment transmuxing
      if (this.state === State.WAITING_INIT_PTS) {
        this.tick();
      }
    }
  }

  startLoad(startPosition: number) {
    if (!this.levels) {
      this.startPosition = startPosition;
      this.state = State.STOPPED;
      return;
    }
    const lastCurrentTime = this.lastCurrentTime;
    this.stopLoad();
    this.setInterval(TICK_INTERVAL);
    if (lastCurrentTime > 0 && startPosition === -1) {
      this.log(
        `Override startPosition with lastCurrentTime @${lastCurrentTime.toFixed(
          3,
        )}`,
      );
      startPosition = lastCurrentTime;
      this.state = State.IDLE;
    } else {
      this.loadedmetadata = false;
      this.state = State.WAITING_TRACK;
    }
    this.nextLoadPosition =
      this.startPosition =
      this.lastCurrentTime =
        startPosition;

    this.tick();
  }

  doTick() {
    switch (this.state) {
      case State.IDLE:
        this.doTickIdle();
        break;
      case State.WAITING_TRACK: {
        const { levels, trackId } = this;
        const details = levels?.[trackId]?.details;
        if (details) {
          if (this.waitForCdnTuneIn(details)) {
            break;
          }
          this.state = State.WAITING_INIT_PTS;
        }
        break;
      }
      case State.FRAG_LOADING_WAITING_RETRY: {
        const now = performance.now();
        const retryDate = this.retryDate;
        // if current time is gt than retryDate, or if media seeking let's switch to IDLE state to retry loading
        if (!retryDate || now >= retryDate || this.media?.seeking) {
          const { levels, trackId } = this;
          this.log('RetryDate reached, switch back to IDLE state');
          this.resetStartWhenNotLoaded(levels?.[trackId] || null);
          this.state = State.IDLE;
        }
        break;
      }
      case State.WAITING_INIT_PTS: {
        // Ensure we don't get stuck in the WAITING_INIT_PTS state if the waiting frag CC doesn't match any initPTS
        const waitingData = this.waitingData;
        if (waitingData) {
          const { frag, part, cache, complete } = waitingData;
          if (this.initPTS[frag.cc] !== undefined) {
            this.waitingData = null;
            this.waitingVideoCC = -1;
            this.state = State.FRAG_LOADING;
            const payload = cache.flush();
            const data: FragLoadedData = {
              frag,
              part,
              payload,
              networkDetails: null,
            };
            this._handleFragmentLoadProgress(data);
            if (complete) {
              super._handleFragmentLoadComplete(data);
            }
          } else if (this.videoTrackCC !== this.waitingVideoCC) {
            // Drop waiting fragment if videoTrackCC has changed since waitingFragment was set and initPTS was not found
            this.log(
              `Waiting fragment cc (${frag.cc}) cancelled because video is at cc ${this.videoTrackCC}`,
            );
            this.clearWaitingFragment();
          } else {
            // Drop waiting fragment if an earlier fragment is needed
            const pos = this.getLoadPosition();
            const bufferInfo = BufferHelper.bufferInfo(
              this.mediaBuffer,
              pos,
              this.config.maxBufferHole,
            );
            const waitingFragmentAtPosition = fragmentWithinToleranceTest(
              bufferInfo.end,
              this.config.maxFragLookUpTolerance,
              frag,
            );
            if (waitingFragmentAtPosition < 0) {
              this.log(
                `Waiting fragment cc (${frag.cc}) @ ${frag.start} cancelled because another fragment at ${bufferInfo.end} is needed`,
              );
              this.clearWaitingFragment();
            }
          }
        } else {
          this.state = State.IDLE;
        }
      }
    }

    this.onTickEnd();
  }

  clearWaitingFragment() {
    const waitingData = this.waitingData;
    if (waitingData) {
      this.fragmentTracker.removeFragment(waitingData.frag);
      this.waitingData = null;
      this.waitingVideoCC = -1;
      this.state = State.IDLE;
    }
  }

  protected resetLoadingState() {
    this.clearWaitingFragment();
    super.resetLoadingState();
  }

  protected onTickEnd() {
    const { media } = this;
    if (!media?.readyState) {
      // Exit early if we don't have media or if the media hasn't buffered anything yet (readyState 0)
      return;
    }

    this.lastCurrentTime = media.currentTime;
  }

  private doTickIdle() {
    const { hls, levels, media, trackId } = this;
    const config = hls.config;

    // 1. if buffering is suspended
    // 2. if video not attached AND
    //    start fragment already requested OR start frag prefetch not enabled
    // 3. if tracks or track not loaded and selected
    // then exit loop
    // => if media not attached but start frag prefetch is enabled and start frag not requested yet, we will not exit loop
    if (
      !this.buffering ||
      (!media && (this.startFragRequested || !config.startFragPrefetch)) ||
      !levels?.[trackId]
    ) {
      return;
    }

    const levelInfo = levels[trackId];

    const trackDetails = levelInfo.details;
    if (
      !trackDetails ||
      (trackDetails.live && this.levelLastLoaded !== levelInfo) ||
      this.waitForCdnTuneIn(trackDetails)
    ) {
      this.state = State.WAITING_TRACK;
      return;
    }

    const bufferable = this.mediaBuffer ? this.mediaBuffer : this.media;
    if (this.bufferFlushed && bufferable) {
      this.bufferFlushed = false;
      this.afterBufferFlushed(
        bufferable,
        ElementaryStreamTypes.AUDIO,
        PlaylistLevelType.AUDIO,
      );
    }

    const bufferInfo = this.getFwdBufferInfo(
      bufferable,
      PlaylistLevelType.AUDIO,
    );
    if (bufferInfo === null) {
      return;
    }

    if (!this.switchingTrack && this._streamEnded(bufferInfo, trackDetails)) {
      hls.trigger(Events.BUFFER_EOS, { type: 'audio' });
      this.state = State.ENDED;
      return;
    }

    const mainBufferInfo = this.getFwdBufferInfo(
      this.videoBuffer ? this.videoBuffer : this.media,
      PlaylistLevelType.MAIN,
    );
    const bufferLen = bufferInfo.len;
    const maxBufLen = this.getMaxBufferLength(mainBufferInfo?.len);

    const fragments = trackDetails.fragments;
    const start = fragments[0].start;
    const loadPosition = this.getLoadPosition();
    const targetBufferTime = this.flushing ? loadPosition : bufferInfo.end;

    if (this.switchingTrack && media) {
      const pos = loadPosition;
      // if currentTime (pos) is less than alt audio playlist start time, it means that alt audio is ahead of currentTime
      if (trackDetails.PTSKnown && pos < start) {
        // if everything is buffered from pos to start or if audio buffer upfront, let's seek to start
        if (bufferInfo.end > start || bufferInfo.nextStart) {
          this.log(
            'Alt audio track ahead of main track, seek to start of alt audio track',
          );
          media.currentTime = start + 0.05;
        }
      }
    }

    // if buffer length is less than maxBufLen, or near the end, find a fragment to load
    if (
      bufferLen >= maxBufLen &&
      !this.switchingTrack &&
      targetBufferTime < fragments[fragments.length - 1].start
    ) {
      return;
    }

    let frag = this.getNextFragment(targetBufferTime, trackDetails);
    let atGap = false;
    // Avoid loop loading by using nextLoadPosition set for backtracking and skipping consecutive GAP tags
    if (frag && this.isLoopLoading(frag, targetBufferTime)) {
      atGap = !!frag.gap;
      frag = this.getNextFragmentLoopLoading(
        frag,
        trackDetails,
        bufferInfo,
        PlaylistLevelType.MAIN,
        maxBufLen,
      );
    }
    if (!frag) {
      this.bufferFlushed = true;
      return;
    }

    // Buffer audio up to one target duration ahead of main buffer
    const atBufferSyncLimit =
      mainBufferInfo &&
      frag.start > mainBufferInfo.end + trackDetails.targetduration;
    if (
      atBufferSyncLimit ||
      // Or wait for main buffer after buffing some audio
      (!mainBufferInfo?.len && bufferInfo.len)
    ) {
      // Check fragment-tracker for main fragments since GAP segments do not show up in bufferInfo
      const mainFrag = this.getAppendedFrag(frag.start, PlaylistLevelType.MAIN);
      if (mainFrag === null) {
        return;
      }
      // Bridge gaps in main buffer
      atGap ||=
        !!mainFrag.gap || (!!atBufferSyncLimit && mainBufferInfo.len === 0);
      if (
        (atBufferSyncLimit && !atGap) ||
        (atGap && bufferInfo.nextStart && bufferInfo.nextStart < mainFrag.end)
      ) {
        return;
      }
    }

    this.loadFragment(frag, levelInfo, targetBufferTime);
  }

  protected getMaxBufferLength(mainBufferLength?: number): number {
    const maxConfigBuffer = super.getMaxBufferLength();
    if (!mainBufferLength) {
      return maxConfigBuffer;
    }
    return Math.min(
      Math.max(maxConfigBuffer, mainBufferLength),
      this.config.maxMaxBufferLength,
    );
  }

  onMediaDetaching() {
    this.videoBuffer = null;
    this.bufferFlushed = this.flushing = false;
    super.onMediaDetaching();
  }

  onAudioTracksUpdated(
    event: Events.AUDIO_TRACKS_UPDATED,
    { audioTracks }: AudioTracksUpdatedData,
  ) {
    // Reset tranxmuxer is essential for large context switches (Content Steering)
    this.resetTransmuxer();
    this.levels = audioTracks.map((mediaPlaylist) => new Level(mediaPlaylist));
  }

  onAudioTrackSwitching(
    event: Events.AUDIO_TRACK_SWITCHING,
    data: AudioTrackSwitchingData,
  ) {
    // if any URL found on new audio track, it is an alternate audio track
    const altAudio = !!data.url;
    this.trackId = data.id;
    const { fragCurrent } = this;

    if (fragCurrent) {
      fragCurrent.abortRequests();
      this.removeUnbufferedFrags(fragCurrent.start);
    }
    this.resetLoadingState();
    // destroy useless transmuxer when switching audio to main
    if (!altAudio) {
      this.resetTransmuxer();
    } else {
      // switching to audio track, start timer if not already started
      this.setInterval(TICK_INTERVAL);
    }

    // should we switch tracks ?
    if (altAudio) {
      this.switchingTrack = data;
      // main audio track are handled by stream-controller, just do something if switching to alt audio track
      this.state = State.IDLE;
      this.flushAudioIfNeeded(data);
    } else {
      this.switchingTrack = null;
      this.bufferedTrack = data;
      this.state = State.STOPPED;
    }
    this.tick();
  }

  onManifestLoading() {
    this.fragmentTracker.removeAllFragments();
    this.startPosition = this.lastCurrentTime = 0;
    this.bufferFlushed = this.flushing = false;
    this.levels =
      this.mainDetails =
      this.waitingData =
      this.bufferedTrack =
      this.cachedTrackLoadedData =
      this.switchingTrack =
        null;
    this.startFragRequested = false;
    this.trackId = this.videoTrackCC = this.waitingVideoCC = -1;
  }

  onLevelLoaded(event: Events.LEVEL_LOADED, data: LevelLoadedData) {
    this.mainDetails = data.details;
    if (this.cachedTrackLoadedData !== null) {
      this.hls.trigger(Events.AUDIO_TRACK_LOADED, this.cachedTrackLoadedData);
      this.cachedTrackLoadedData = null;
    }
  }

  onAudioTrackLoaded(event: Events.AUDIO_TRACK_LOADED, data: TrackLoadedData) {
    if (this.mainDetails == null) {
      this.cachedTrackLoadedData = data;
      return;
    }
    const { levels } = this;
    const { details: newDetails, id: trackId } = data;
    if (!levels) {
      this.warn(`Audio tracks were reset while loading level ${trackId}`);
      return;
    }
    this.log(
      `Audio track ${trackId} loaded [${newDetails.startSN},${
        newDetails.endSN
      }]${
        newDetails.lastPartSn
          ? `[part-${newDetails.lastPartSn}-${newDetails.lastPartIndex}]`
          : ''
      },duration:${newDetails.totalduration}`,
    );

    const track = levels[trackId];
    let sliding = 0;
    if (newDetails.live || track.details?.live) {
      this.checkLiveUpdate(newDetails);
      const mainDetails = this.mainDetails;
      if (newDetails.deltaUpdateFailed || !mainDetails) {
        return;
      }
      if (
        !track.details &&
        newDetails.hasProgramDateTime &&
        mainDetails.hasProgramDateTime
      ) {
        // Make sure our audio rendition is aligned with the "main" rendition, using
        // pdt as our reference times.
        alignMediaPlaylistByPDT(newDetails, mainDetails);
        sliding = newDetails.fragments[0].start;
      } else {
        sliding = this.alignPlaylists(
          newDetails,
          track.details,
          this.levelLastLoaded?.details,
        );
      }
    }
    track.details = newDetails;
    this.levelLastLoaded = track;

    // compute start position if we are aligned with the main playlist
    if (!this.startFragRequested && (this.mainDetails || !newDetails.live)) {
      this.setStartPosition(this.mainDetails || newDetails, sliding);
    }
    // only switch back to IDLE state if we were waiting for track to start downloading a new fragment
    if (
      this.state === State.WAITING_TRACK &&
      !this.waitForCdnTuneIn(newDetails)
    ) {
      this.state = State.IDLE;
    }

    // trigger handler right now
    this.tick();
  }

  _handleFragmentLoadProgress(data: FragLoadedData) {
    const { frag, part, payload } = data;
    const { config, trackId, levels } = this;
    if (!levels) {
      this.warn(
        `Audio tracks were reset while fragment load was in progress. Fragment ${frag.sn} of level ${frag.level} will not be buffered`,
      );
      return;
    }

    const track = levels[trackId] as Level;
    if (!track) {
      this.warn('Audio track is undefined on fragment load progress');
      return;
    }
    const details = track.details as LevelDetails;
    if (!details) {
      this.warn('Audio track details undefined on fragment load progress');
      this.removeUnbufferedFrags(frag.start);
      return;
    }
    const audioCodec =
      config.defaultAudioCodec || track.audioCodec || 'mp4a.40.2';

    let transmuxer = this.transmuxer;
    if (!transmuxer) {
      transmuxer = this.transmuxer = new TransmuxerInterface(
        this.hls,
        PlaylistLevelType.AUDIO,
        this._handleTransmuxComplete.bind(this),
        this._handleTransmuxerFlush.bind(this),
      );
    }

    // Check if we have video initPTS
    // If not we need to wait for it
    const initPTS = this.initPTS[frag.cc];
    const initSegmentData = frag.initSegment?.data;
    if (initPTS !== undefined) {
      // this.log(`Transmuxing ${sn} of [${details.startSN} ,${details.endSN}],track ${trackId}`);
      // time Offset is accurate if level PTS is known, or if playlist is not sliding (not live)
      const accurateTimeOffset = false; // details.PTSKnown || !details.live;
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
      transmuxer.push(
        payload,
        initSegmentData,
        audioCodec,
        '',
        frag,
        part,
        details.totalduration,
        accurateTimeOffset,
        chunkMeta,
        initPTS,
      );
    } else {
      this.log(
        `Unknown video PTS for cc ${frag.cc}, waiting for video PTS before demuxing audio frag ${frag.sn} of [${details.startSN} ,${details.endSN}],track ${trackId}`,
      );
      const { cache } = (this.waitingData = this.waitingData || {
        frag,
        part,
        cache: new ChunkCache(),
        complete: false,
      });
      cache.push(new Uint8Array(payload));
      this.waitingVideoCC = this.videoTrackCC;
      this.state = State.WAITING_INIT_PTS;
    }
  }

  protected _handleFragmentLoadComplete(fragLoadedData: FragLoadedData) {
    if (this.waitingData) {
      this.waitingData.complete = true;
      return;
    }
    super._handleFragmentLoadComplete(fragLoadedData);
  }

  onBufferReset(/* event: Events.BUFFER_RESET */) {
    // reset reference to sourcebuffers
    this.mediaBuffer = this.videoBuffer = null;
    this.loadedmetadata = false;
  }

  onBufferCreated(event: Events.BUFFER_CREATED, data: BufferCreatedData) {
    const audioTrack = data.tracks.audio;
    if (audioTrack) {
      this.mediaBuffer = audioTrack.buffer || null;
    }
    if (data.tracks.video) {
      this.videoBuffer = data.tracks.video.buffer || null;
    }
  }

  onFragBuffered(event: Events.FRAG_BUFFERED, data: FragBufferedData) {
    const { frag, part } = data;
    if (frag.type !== PlaylistLevelType.AUDIO) {
      if (!this.loadedmetadata && frag.type === PlaylistLevelType.MAIN) {
        const bufferable = this.videoBuffer || this.media;
        if (bufferable) {
          const bufferedTimeRanges = BufferHelper.getBuffered(bufferable);
          if (bufferedTimeRanges.length) {
            this.loadedmetadata = true;
          }
        }
      }
      return;
    }
    if (this.fragContextChanged(frag)) {
      // If a level switch was requested while a fragment was buffering, it will emit the FRAG_BUFFERED event upon completion
      // Avoid setting state back to IDLE or concluding the audio switch; otherwise, the switched-to track will not buffer
      this.warn(
        `Fragment ${frag.sn}${part ? ' p: ' + part.index : ''} of level ${
          frag.level
        } finished buffering, but was aborted. state: ${
          this.state
        }, audioSwitch: ${
          this.switchingTrack ? this.switchingTrack.name : 'false'
        }`,
      );
      return;
    }
    if (frag.sn !== 'initSegment') {
      this.fragPrevious = frag;
      const track = this.switchingTrack;
      if (track) {
        this.bufferedTrack = track;
        this.switchingTrack = null;
        this.hls.trigger(Events.AUDIO_TRACK_SWITCHED, { ...track });
      }
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
        this.onFragmentOrKeyLoadError(PlaylistLevelType.AUDIO, data);
        break;
      case ErrorDetails.AUDIO_TRACK_LOAD_ERROR:
      case ErrorDetails.AUDIO_TRACK_LOAD_TIMEOUT:
      case ErrorDetails.LEVEL_PARSING_ERROR:
        // in case of non fatal error while loading track, if not retrying to load track, switch back to IDLE
        if (
          !data.levelRetry &&
          this.state === State.WAITING_TRACK &&
          data.context?.type === PlaylistContextType.AUDIO_TRACK
        ) {
          this.state = State.IDLE;
        }
        break;
      case ErrorDetails.BUFFER_APPEND_ERROR:
      case ErrorDetails.BUFFER_FULL_ERROR:
        if (!data.parent || data.parent !== 'audio') {
          return;
        }
        if (data.details === ErrorDetails.BUFFER_APPEND_ERROR) {
          this.resetLoadingState();
          return;
        }
        if (this.reduceLengthAndFlushBuffer(data)) {
          this.bufferedTrack = null;
          super.flushMainBuffer(0, Number.POSITIVE_INFINITY, 'audio');
        }
        break;
      case ErrorDetails.INTERNAL_EXCEPTION:
        this.recoverWorkerError(data);
        break;
      default:
        break;
    }
  }

  private onBufferFlushing(
    event: Events.BUFFER_FLUSHING,
    { type }: BufferFlushingData,
  ) {
    if (type !== ElementaryStreamTypes.VIDEO) {
      this.flushing = true;
    }
  }

  private onBufferFlushed(
    event: Events.BUFFER_FLUSHED,
    { type }: BufferFlushedData,
  ) {
    if (type !== ElementaryStreamTypes.VIDEO) {
      this.flushing = false;
      this.bufferFlushed = true;
      if (this.state === State.ENDED) {
        this.state = State.IDLE;
      }
      const mediaBuffer = this.mediaBuffer || this.media;
      if (mediaBuffer) {
        this.afterBufferFlushed(mediaBuffer, type, PlaylistLevelType.AUDIO);
        this.tick();
      }
    }
  }

  private _handleTransmuxComplete(transmuxResult: TransmuxerResult) {
    const id = 'audio';
    const { hls } = this;
    const { remuxResult, chunkMeta } = transmuxResult;

    const context = this.getCurrentContext(chunkMeta);
    if (!context) {
      this.resetWhenMissingContext(chunkMeta);
      return;
    }
    const { frag, part, level } = context;
    const { details } = level;
    const { audio, text, id3, initSegment } = remuxResult;

    // Check if the current fragment has been aborted. We check this by first seeing if we're still playing the current level.
    // If we are, subsequently check if the currently loading fragment (fragCurrent) has changed.
    if (this.fragContextChanged(frag) || !details) {
      this.fragmentTracker.removeFragment(frag);
      return;
    }

    this.state = State.PARSING;
    if (this.switchingTrack && audio) {
      this.completeAudioSwitch(this.switchingTrack);
    }

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
      // Only flush audio from old audio tracks when PTS is known on new audio track
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

    if (id3?.samples?.length) {
      const emittedID3: FragParsingMetadataData = Object.assign(
        {
          id,
          frag,
          details,
        },
        id3,
      );
      hls.trigger(Events.FRAG_PARSING_METADATA, emittedID3);
    }
    if (text) {
      const emittedText: FragParsingUserdataData = Object.assign(
        {
          id,
          frag,
          details,
        },
        text,
      );
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
    // delete any video track found on audio transmuxer
    if (tracks.video) {
      delete tracks.video;
    }

    // include levelCodec in audio and video tracks
    const track = tracks.audio;
    if (!track) {
      return;
    }

    track.id = 'audio';

    const variantAudioCodecs = currentLevel.audioCodec;
    this.log(
      `Init audio buffer, container:${track.container}, codecs[level/parsed]=[${variantAudioCodecs}/${track.codec}]`,
    );
    // SourceBuffer will use track.levelCodec if defined
    if (variantAudioCodecs && variantAudioCodecs.split(',').length === 1) {
      track.levelCodec = variantAudioCodecs;
    }
    this.hls.trigger(Events.BUFFER_CODECS, tracks);
    const initSegment = track.initSegment;
    if (initSegment?.byteLength) {
      const segment: BufferAppendingData = {
        type: 'audio',
        frag,
        part: null,
        chunkMeta,
        parent: frag.type,
        data: initSegment,
      };
      this.hls.trigger(Events.BUFFER_APPENDING, segment);
    }
    // trigger handler right now
    this.tickImmediate();
  }

  protected loadFragment(
    frag: Fragment,
    track: Level,
    targetBufferTime: number,
  ) {
    // only load if fragment is not loaded or if in audio switch
    const fragState = this.fragmentTracker.getState(frag);
    this.fragCurrent = frag;

    // we force a frag loading in audio switch as fragment tracker might not have evicted previous frags in case of quick audio switch
    if (
      this.switchingTrack ||
      fragState === FragmentState.NOT_LOADED ||
      fragState === FragmentState.PARTIAL
    ) {
      if (frag.sn === 'initSegment') {
        this._loadInitSegment(frag, track);
      } else if (track.details?.live && !this.initPTS[frag.cc]) {
        this.log(
          `Waiting for video PTS in continuity counter ${frag.cc} of live stream before loading audio fragment ${frag.sn} of level ${this.trackId}`,
        );
        this.state = State.WAITING_INIT_PTS;
        const mainDetails = this.mainDetails;
        if (
          mainDetails &&
          mainDetails.fragments[0].start !== track.details.fragments[0].start
        ) {
          alignMediaPlaylistByPDT(track.details, mainDetails);
        }
      } else {
        this.startFragRequested = true;
        super.loadFragment(frag, track, targetBufferTime);
      }
    } else {
      this.clearTrackerIfNeeded(frag);
    }
  }

  private flushAudioIfNeeded(switchingTrack: MediaPlaylist) {
    if (this.media && this.bufferedTrack) {
      const { name, lang, assocLang, characteristics, audioCodec, channels } =
        this.bufferedTrack;
      if (
        !matchesOption(
          { name, lang, assocLang, characteristics, audioCodec, channels },
          switchingTrack,
          audioMatchPredicate,
        )
      ) {
        this.log('Switching audio track : flushing all audio');
        super.flushMainBuffer(0, Number.POSITIVE_INFINITY, 'audio');
        this.bufferedTrack = null;
      }
    }
  }

  private completeAudioSwitch(switchingTrack: MediaPlaylist) {
    const { hls } = this;
    this.flushAudioIfNeeded(switchingTrack);
    this.bufferedTrack = switchingTrack;
    this.switchingTrack = null;
    hls.trigger(Events.AUDIO_TRACK_SWITCHED, { ...switchingTrack });
  }
}
export default AudioStreamController;
