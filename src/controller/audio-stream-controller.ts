import BaseStreamController, { State } from './base-stream-controller';
import type { NetworkComponentAPI } from '../types/component-api';
import { Events } from '../events';
import { BufferHelper } from '../utils/buffer-helper';
import type { FragmentTracker } from './fragment-tracker';
import { FragmentState } from './fragment-tracker';
import { Level } from '../types/level';
import { PlaylistLevelType } from '../types/loader';
import { Fragment, ElementaryStreamTypes, Part } from '../loader/fragment';
import FragmentLoader from '../loader/fragment-loader';
import ChunkCache from '../demux/chunk-cache';
import TransmuxerInterface from '../demux/transmuxer-interface';
import type { TransmuxerResult } from '../types/transmuxer';
import { ChunkMetadata } from '../types/transmuxer';
import { fragmentWithinToleranceTest } from './fragment-finders';
import { alignPDT } from '../utils/discontinuities';
import { MAX_START_GAP_JUMP } from './gap-controller';
import { ErrorDetails } from '../errors';
import { logger } from '../utils/logger';
import type Hls from '../hls';
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
} from '../types/events';
import type { ErrorData } from '../types/events';

const TICK_INTERVAL = 100; // how often to tick in ms

type WaitingForPTSData = {
  frag: Fragment;
  part: Part | null;
  cache: ChunkCache;
  complete: boolean;
};

class AudioStreamController
  extends BaseStreamController
  implements NetworkComponentAPI {
  private retryDate: number = 0;
  private videoBuffer: any | null = null;
  private videoTrackCC: number = -1;
  private waitingVideoCC: number = -1;
  private audioSwitch: boolean = false;
  private trackId: number = -1;
  private waitingData: WaitingForPTSData | null = null;
  private mainDetails: LevelDetails | null = null;

  constructor(hls: Hls, fragmentTracker: FragmentTracker) {
    super(hls, fragmentTracker, '[audio-stream-controller]');
    this.fragmentLoader = new FragmentLoader(hls.config);

    this._registerListeners();
  }

  protected onHandlerDestroying() {
    this._unregisterListeners();
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
    hls.off(Events.BUFFER_FLUSHED, this.onBufferFlushed, this);
    hls.off(Events.INIT_PTS_FOUND, this.onInitPtsFound, this);
    hls.off(Events.FRAG_BUFFERED, this.onFragBuffered, this);
  }

  // INIT_PTS_FOUND is triggered when the video track parsed in the stream-controller has a new PTS value
  onInitPtsFound(
    event: Events.INIT_PTS_FOUND,
    { frag, id, initPTS }: InitPTSFoundData
  ) {
    // Always update the new INIT PTS
    // Can change due level switch
    if (id === 'main') {
      const cc = frag.cc;
      this.initPTS[frag.cc] = initPTS;
      this.log(`InitPTS for cc: ${cc} found from main: ${initPTS}`);
      this.videoTrackCC = cc;
      // If we are waiting, tick immediately to unblock audio fragment transmuxing
      if (this.state === State.WAITING_INIT_PTS) {
        this.tick();
      }
    }
  }

  startLoad(startPosition) {
    if (!this.levels) {
      this.startPosition = startPosition;
      this.state = State.STOPPED;
      return;
    }
    const lastCurrentTime = this.lastCurrentTime;
    this.stopLoad();
    this.setInterval(TICK_INTERVAL);
    this.fragLoadError = 0;
    if (lastCurrentTime > 0 && startPosition === -1) {
      this.log(
        `Override startPosition with lastCurrentTime @${lastCurrentTime.toFixed(
          3
        )}`
      );
      this.state = State.IDLE;
    } else {
      this.lastCurrentTime = this.startPosition
        ? this.startPosition
        : startPosition;
      this.loadedmetadata = false;
      this.state = State.WAITING_TRACK;
    }
    this.nextLoadPosition = this.startPosition = this.lastCurrentTime = startPosition;
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
          this.log('RetryDate reached, switch back to IDLE state');
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
            logger.log(
              `Waiting fragment cc (${frag.cc}) cancelled because video is at cc ${this.videoTrackCC}`
            );
            this.clearWaitingFragment();
          } else {
            // Drop waiting fragment if an earlier fragment is needed
            const bufferInfo = BufferHelper.bufferInfo(
              this.mediaBuffer,
              this.media.currentTime,
              this.config.maxBufferHole
            );
            const waitingFragmentAtPosition = fragmentWithinToleranceTest(
              bufferInfo.end,
              this.config.maxFragLookUpTolerance,
              frag
            );
            if (waitingFragmentAtPosition < 0) {
              logger.log(
                `Waiting fragment cc (${frag.cc}) @ ${frag.start} cancelled because another fragment at ${bufferInfo.end} is needed`
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

  protected onTickEnd() {
    const { media } = this;
    if (!media || !media.readyState) {
      // Exit early if we don't have media or if the media hasn't buffered anything yet (readyState 0)
      return;
    }
    const mediaBuffer = this.mediaBuffer ? this.mediaBuffer : media;
    const buffered = mediaBuffer.buffered;

    if (!this.loadedmetadata && buffered.length) {
      this.loadedmetadata = true;
    }

    this.lastCurrentTime = media.currentTime;
  }

  private doTickIdle() {
    const { hls, levels, media, trackId } = this;

    const config = hls.config;
    if (!levels) {
      return;
    }

    // if video not attached AND
    // start fragment already requested OR start frag prefetch not enabled
    // exit loop
    // => if media not attached but start frag prefetch is enabled and start frag not requested yet, we will not exit loop
    if (!media && (this.startFragRequested || !config.startFragPrefetch)) {
      return;
    }

    const pos = this.getLoadPosition();
    if (!Number.isFinite(pos)) {
      return;
    }

    if (!levels || !levels[trackId]) {
      return;
    }
    const levelInfo = levels[trackId];

    const trackDetails = levelInfo.details;
    if (
      !trackDetails ||
      (trackDetails.live && this.levelLastLoaded !== trackId) ||
      this.waitForCdnTuneIn(trackDetails)
    ) {
      this.state = State.WAITING_TRACK;
      return;
    }

    let frag = trackDetails.initSegment;
    let targetBufferTime = 0;
    if (!frag || frag.data) {
      const mediaBuffer = this.mediaBuffer ? this.mediaBuffer : this.media;
      const videoBuffer = this.videoBuffer ? this.videoBuffer : this.media;
      const maxBufferHole =
        pos < config.maxBufferHole
          ? Math.max(MAX_START_GAP_JUMP, config.maxBufferHole)
          : config.maxBufferHole;
      const bufferInfo = BufferHelper.bufferInfo(
        mediaBuffer,
        pos,
        maxBufferHole
      );
      const mainBufferInfo = BufferHelper.bufferInfo(
        videoBuffer,
        pos,
        maxBufferHole
      );
      const bufferLen = bufferInfo.len;
      const maxConfigBuffer = Math.min(
        config.maxBufferLength,
        config.maxMaxBufferLength
      );
      const maxBufLen = Math.max(maxConfigBuffer, mainBufferInfo.len);
      const audioSwitch = this.audioSwitch;

      // if buffer length is less than maxBufLen try to load a new fragment
      if (bufferLen >= maxBufLen && !audioSwitch) {
        return;
      }

      if (!audioSwitch && this._streamEnded(bufferInfo, trackDetails)) {
        hls.trigger(Events.BUFFER_EOS, { type: 'audio' });
        this.state = State.ENDED;
        return;
      }

      const fragments = trackDetails.fragments;
      const start = fragments[0].start;
      targetBufferTime = bufferInfo.end;

      if (audioSwitch) {
        targetBufferTime = pos;
        // if currentTime (pos) is less than alt audio playlist start time, it means that alt audio is ahead of currentTime
        if (trackDetails.PTSKnown && pos < start) {
          // if everything is buffered from pos to start or if audio buffer upfront, let's seek to start
          if (bufferInfo.end > start || bufferInfo.nextStart) {
            this.log(
              'Alt audio track ahead of main track, seek to start of alt audio track'
            );
            media.currentTime = start + 0.05;
          }
        }
      }

      frag = this.getNextFragment(targetBufferTime, trackDetails);
      if (!frag) {
        return;
      }
    }

    if (frag.decryptdata?.keyFormat === 'identity' && !frag.decryptdata?.key) {
      this.log(
        `Loading key for ${frag.sn} of [${trackDetails.startSN} ,${trackDetails.endSN}],track ${trackId}`
      );
      this.state = State.KEY_LOADING;
      hls.trigger(Events.KEY_LOADING, { frag });
    } else {
      this.loadFragment(frag, trackDetails, targetBufferTime);
    }
  }

  onMediaDetaching() {
    this.videoBuffer = null;
    super.onMediaDetaching();
  }

  onAudioTracksUpdated(
    event: Events.AUDIO_TRACKS_UPDATED,
    { audioTracks }: AudioTracksUpdatedData
  ) {
    this.levels = audioTracks.map((mediaPlaylist) => new Level(mediaPlaylist));
  }

  onAudioTrackSwitching(
    event: Events.AUDIO_TRACK_SWITCHING,
    data: AudioTrackSwitchingData
  ) {
    // if any URL found on new audio track, it is an alternate audio track
    const altAudio = !!data.url;
    this.trackId = data.id;
    const { fragCurrent, transmuxer } = this;

    if (fragCurrent?.loader) {
      fragCurrent.loader.abort();
    }
    this.fragCurrent = null;
    this.clearWaitingFragment();
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
      this.state = State.STOPPED;
    }
    this.tick();
  }

  onManifestLoading() {
    this.mainDetails = null;
    this.fragmentTracker.removeAllFragments();
    this.startPosition = this.lastCurrentTime = 0;
  }

  onLevelLoaded(event: Events.LEVEL_LOADED, data: LevelLoadedData) {
    if (this.mainDetails === null) {
      this.mainDetails = data.details;
    }
  }

  onAudioTrackLoaded(event: Events.AUDIO_TRACK_LOADED, data: TrackLoadedData) {
    const { levels } = this;
    const { details: newDetails, id: trackId } = data;
    if (!levels) {
      this.warn(`Audio tracks were reset while loading level ${trackId}`);
      return;
    }
    this.log(
      `Track ${trackId} loaded [${newDetails.startSN},${newDetails.endSN}],duration:${newDetails.totalduration}`
    );

    const track = levels[trackId];
    let sliding = 0;
    if (newDetails.live || track.details?.live) {
      if (!newDetails.fragments[0]) {
        newDetails.deltaUpdateFailed = true;
      }
      if (newDetails.deltaUpdateFailed) {
        return;
      }
      if (
        !track.details &&
        this.mainDetails?.hasProgramDateTime &&
        newDetails.hasProgramDateTime
      ) {
        alignPDT(newDetails, this.mainDetails);
        sliding = newDetails.fragments[0].start;
      } else {
        sliding = this.alignPlaylists(newDetails, track.details);
      }
    }
    track.details = newDetails;
    this.levelLastLoaded = trackId;

    // compute start position
    if (!this.startFragRequested) {
      this.setStartPosition(track.details, sliding);
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
        `Audio tracks were reset while fragment load was in progress. Fragment ${frag.sn} of level ${frag.level} will not be buffered`
      );
      return;
    }

    const track = levels[trackId] as Level;
    console.assert(track, 'Audio track is defined on fragment load progress');
    const details = track.details as LevelDetails;
    console.assert(
      details,
      'Audio track details are defined on fragment load progress'
    );
    const audioCodec =
      config.defaultAudioCodec || track.audioCodec || 'mp4a.40.2';

    let transmuxer = this.transmuxer;
    if (!transmuxer) {
      transmuxer = this.transmuxer = new TransmuxerInterface(
        this.hls,
        PlaylistLevelType.AUDIO,
        this._handleTransmuxComplete.bind(this),
        this._handleTransmuxerFlush.bind(this)
      );
    }

    // Check if we have video initPTS
    // If not we need to wait for it
    const initPTS = this.initPTS[frag.cc];
    const initSegmentData = details.initSegment?.data;
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
        partial
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
        initPTS
      );
    } else {
      logger.log(
        `Unknown video PTS for cc ${frag.cc}, waiting for video PTS before demuxing audio frag ${frag.sn} of [${details.startSN} ,${details.endSN}],track ${trackId}`
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
      this.mediaBuffer = audioTrack.buffer;
    }
    if (data.tracks.video) {
      this.videoBuffer = data.tracks.video.buffer;
    }
  }

  onFragBuffered(event: Events.FRAG_BUFFERED, data: FragBufferedData) {
    const { frag, part } = data;
    if (frag.type !== PlaylistLevelType.AUDIO) {
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
        }, audioSwitch: ${this.audioSwitch}`
      );
      return;
    }
    this.fragPrevious = frag;
    if (this.audioSwitch && frag.sn !== 'initSegment') {
      this.audioSwitch = false;
      this.hls.trigger(Events.AUDIO_TRACK_SWITCHED, { id: this.trackId });
    }
    this.fragBufferedComplete(frag, part);
  }

  private onError(event: Events.ERROR, data: ErrorData) {
    switch (data.details) {
      case ErrorDetails.FRAG_LOAD_ERROR:
      case ErrorDetails.FRAG_LOAD_TIMEOUT:
      case ErrorDetails.KEY_LOAD_ERROR:
      case ErrorDetails.KEY_LOAD_TIMEOUT:
        if (!data.fatal) {
          const frag = data.frag;
          // don't handle frag error not related to audio fragment
          if (!frag || frag.type !== PlaylistLevelType.AUDIO) {
            return;
          }
          const fragCurrent = this.fragCurrent;
          console.assert(
            fragCurrent &&
              frag.sn === fragCurrent.sn &&
              frag.level === fragCurrent.level &&
              frag.urlId === fragCurrent.urlId, // FIXME: audio-group id
            'Frag load error must match current frag to retry'
          );
          const config = this.config;
          if (this.fragLoadError + 1 <= this.config.fragLoadingMaxRetry) {
            // exponential backoff capped to config.fragLoadingMaxRetryTimeout
            const delay = Math.min(
              Math.pow(2, this.fragLoadError) * config.fragLoadingRetryDelay,
              config.fragLoadingMaxRetryTimeout
            );
            this.warn(`Frag loading failed, retry in ${delay} ms`);
            this.retryDate = performance.now() + delay;
            this.fragLoadError++;
            this.state = State.FRAG_LOADING_WAITING_RETRY;
          } else if (data.levelRetry) {
            // Reset current fragment since audio track audio is essential and may not have a fail-over track
            this.fragCurrent = null;
            // Fragment errors that result in a level switch or redundant fail-over
            // should reset the audio stream controller state to idle
            this.fragLoadError = 0;
            this.state = State.IDLE;
          } else {
            logger.error(
              `${data.details} reaches max retry, redispatch as fatal ...`
            );
            // switch error to fatal
            data.fatal = true;
            this.hls.stopLoad();
            this.state = State.ERROR;
          }
        }
        break;
      case ErrorDetails.AUDIO_TRACK_LOAD_ERROR:
      case ErrorDetails.AUDIO_TRACK_LOAD_TIMEOUT:
        //  when in ERROR state, don't switch back to IDLE state in case a non-fatal error is received
        if (this.state !== State.ERROR && this.state !== State.STOPPED) {
          // if fatal error, stop processing, otherwise move to IDLE to retry loading
          this.state = data.fatal ? State.ERROR : State.IDLE;
          this.warn(
            `${data.details} while loading frag, switching to ${this.state} state`
          );
        }
        break;
      case ErrorDetails.BUFFER_FULL_ERROR:
        // if in appending state
        if (
          data.parent === 'audio' &&
          (this.state === State.PARSING || this.state === State.PARSED)
        ) {
          const media = this.mediaBuffer;
          const currentTime = this.media.currentTime;
          const mediaBuffered =
            media &&
            BufferHelper.isBuffered(media, currentTime) &&
            BufferHelper.isBuffered(media, currentTime + 0.5);
          // reduce max buf len if current position is buffered
          if (mediaBuffered) {
            this.reduceMaxBufferLength();
            this.state = State.IDLE;
          } else {
            // current position is not buffered, but browser is still complaining about buffer full error
            // this happens on IE/Edge, refer to https://github.com/video-dev/hls.js/pull/708
            // in that case flush the whole audio buffer to recover
            this.warn(
              'Buffer full error also media.currentTime is not buffered, flush audio buffer'
            );
            this.fragCurrent = null;
            // flush everything
            this.hls.trigger(Events.BUFFER_FLUSHING, {
              startOffset: 0,
              endOffset: Number.POSITIVE_INFINITY,
              type: 'audio',
            });
          }
        }
        break;
      default:
        break;
    }
  }

  onBufferFlushed(event: Events.BUFFER_FLUSHED, { type }: BufferFlushedData) {
    /* after successful buffer flushing, filter flushed fragments from bufferedFrags
      use mediaBuffered instead of media (so that we will check against video.buffered ranges in case of alt audio track)
    */
    const media = this.mediaBuffer ? this.mediaBuffer : this.media;
    if (media && type === ElementaryStreamTypes.AUDIO) {
      // filter fragments potentially evicted from buffer. this is to avoid memleak on live streams
      this.fragmentTracker.detectEvictedFragments(
        ElementaryStreamTypes.AUDIO,
        BufferHelper.getBuffered(media)
      );
    }
    // reset reference to frag
    this.fragPrevious = null;
    // move to IDLE once flush complete. this should trigger new fragment loading
    this.state = State.IDLE;
  }

  private _handleTransmuxComplete(transmuxResult: TransmuxerResult) {
    const id = 'audio';
    const { hls } = this;
    const { remuxResult, chunkMeta } = transmuxResult;

    const context = this.getCurrentContext(chunkMeta);
    if (!context) {
      this.warn(
        `The loading context changed while buffering fragment ${chunkMeta.sn} of level ${chunkMeta.level}. This chunk will not be buffered.`
      );
      return;
    }
    const { frag, part } = context;
    const { audio, text, id3, initSegment } = remuxResult;

    // Check if the current fragment has been aborted. We check this by first seeing if we're still playing the current level.
    // If we are, subsequently check if the currently loading fragment (fragCurrent) has changed.
    if (this.fragContextChanged(frag)) {
      return;
    }

    this.state = State.PARSING;
    if (this.audioSwitch && audio) {
      this.completeAudioSwitch();
    }

    if (initSegment?.tracks) {
      this._bufferInitSegment(initSegment.tracks, frag, chunkMeta);
      hls.trigger(Events.FRAG_PARSING_INIT_SEGMENT, {
        frag,
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
        endDTS
      );
      this.bufferFragmentData(audio, frag, part, chunkMeta);
    }

    if (id3?.samples?.length) {
      const emittedID3: FragParsingMetadataData = Object.assign(
        {
          frag,
          id,
        },
        id3
      );
      hls.trigger(Events.FRAG_PARSING_METADATA, emittedID3);
    }
    if (text) {
      const emittedText: FragParsingUserdataData = Object.assign(
        {
          frag,
          id,
        },
        text
      );
      hls.trigger(Events.FRAG_PARSING_USERDATA, emittedText);
    }
  }

  private _bufferInitSegment(
    tracks: TrackSet,
    frag: Fragment,
    chunkMeta: ChunkMetadata
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

    track.levelCodec = track.codec;
    track.id = 'audio';
    this.log(
      `Init audio buffer, container:${track.container}, codecs[parsed]=[${track.codec}]`
    );
    this.hls.trigger(Events.BUFFER_CODECS, tracks);
    const initSegment = track.initSegment;
    if (initSegment?.byteLength) {
      const segment: BufferAppendingData = {
        type: 'audio',
        data: initSegment,
        frag,
        part: null,
        chunkMeta,
      };
      this.hls.trigger(Events.BUFFER_APPENDING, segment);
    }
    // trigger handler right now
    this.tick();
  }

  protected loadFragment(
    frag: Fragment,
    trackDetails: LevelDetails,
    targetBufferTime: number
  ) {
    // only load if fragment is not loaded or if in audio switch
    const fragState = this.fragmentTracker.getState(frag);
    this.fragCurrent = frag;

    // we force a frag loading in audio switch as fragment tracker might not have evicted previous frags in case of quick audio switch
    if (
      this.audioSwitch ||
      fragState === FragmentState.NOT_LOADED ||
      fragState === FragmentState.PARTIAL
    ) {
      if (frag.sn === 'initSegment') {
        this._loadInitSegment(frag);
      } else if (trackDetails.live && !Number.isFinite(this.initPTS[frag.cc])) {
        this.log(
          `Waiting for video PTS in continuity counter ${frag.cc} of live stream before loading audio fragment ${frag.sn} of level ${this.trackId}`
        );
        this.state = State.WAITING_INIT_PTS;
      } else {
        this.startFragRequested = true;
        this.nextLoadPosition = frag.start + frag.duration;
        super.loadFragment(frag, trackDetails, targetBufferTime);
      }
    }
  }

  private completeAudioSwitch() {
    const { hls, media, trackId } = this;
    if (media) {
      this.log('Switching audio track : flushing all audio');
      hls.trigger(Events.BUFFER_FLUSHING, {
        startOffset: 0,
        endOffset: Number.POSITIVE_INFINITY,
        type: 'audio',
      });
    }
    this.audioSwitch = false;
    hls.trigger(Events.AUDIO_TRACK_SWITCHED, { id: trackId });
  }
}
export default AudioStreamController;
