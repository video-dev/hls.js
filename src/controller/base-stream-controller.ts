import TaskLoop from '../task-loop';
import { FragmentState, FragmentTracker } from './fragment-tracker';
import { BufferHelper } from '../utils/buffer-helper';
import { logger } from '../utils/logger';
import { Events } from '../events';
import { ErrorDetails } from '../errors';
import * as LevelHelper from './level-helper';
import { ChunkMetadata } from '../types/transmuxer';
import { appendUint8Array } from '../utils/mp4-tools';
import { alignStream } from '../utils/discontinuities';
import { findFragmentByPDT, findFragmentByPTS, findFragWithCC } from './fragment-finders';
import TransmuxerInterface from '../demux/transmuxer-interface';
import Fragment from '../loader/fragment';
import FragmentLoader, { FragLoadSuccessResult, FragmentLoadProgressCallback } from '../loader/fragment-loader';
import LevelDetails from '../loader/level-details';
import { BufferAppendingData } from '../types/events';
import { Level } from '../types/level';
import { RemuxedTrack } from '../types/remuxer';
import Hls from '../hls';
import Decrypter from '../crypt/decrypter';

export const State = {
  STOPPED: 'STOPPED',
  IDLE: 'IDLE',
  PAUSED: 'PAUSED',
  KEY_LOADING: 'KEY_LOADING',
  FRAG_LOADING: 'FRAG_LOADING',
  FRAG_LOADING_WAITING_RETRY: 'FRAG_LOADING_WAITING_RETRY',
  WAITING_TRACK: 'WAITING_TRACK',
  PARSING: 'PARSING',
  PARSED: 'PARSED',
  ENDED: 'ENDED',
  ERROR: 'ERROR',
  WAITING_INIT_PTS: 'WAITING_INIT_PTS',
  WAITING_LEVEL: 'WAITING_LEVEL'
};

export default class BaseStreamController extends TaskLoop {
  protected hls: Hls;

  protected fragPrevious: Fragment | null = null;
  protected fragCurrent: Fragment | null = null;
  protected fragmentTracker!: FragmentTracker;
  protected transmuxer: TransmuxerInterface | null = null;
  protected _state: string = State.STOPPED;
  protected media?: any;
  protected mediaBuffer?: any;
  protected config: any;
  protected lastCurrentTime: number = 0;
  protected nextLoadPosition: number = 0;
  protected startPosition: number = 0;
  protected loadedmetadata: boolean = false;
  protected fragLoadError: number = 0;
  protected levels: Array<Level> | null = null;
  protected fragmentLoader!: FragmentLoader;
  protected _liveSyncPosition: number | null = null;
  protected levelLastLoaded: number | null = null;
  protected startFragRequested: boolean = false;
  protected decrypter: Decrypter;

  protected readonly logPrefix: string = '';

  constructor (hls: Hls) {
    super();
    this.hls = hls;
    this.decrypter = new Decrypter(hls, hls.config);
  }

  protected doTick () {
    this.onTickEnd();
  }

  protected onTickEnd () {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public startLoad (startPosition: number) : void {}

  public stopLoad () {
    const frag = this.fragCurrent;
    if (frag) {
      if (frag.loader) {
        frag.loader.abort();
      }
      this.fragmentTracker.removeFragment(frag);
    }
    if (this.transmuxer) {
      this.transmuxer.destroy();
      this.transmuxer = null;
    }
    this.fragCurrent = null;
    this.fragPrevious = null;
    this.clearInterval();
    this.clearNextTick();
    this.state = State.STOPPED;
  }

  protected _streamEnded (bufferInfo, levelDetails) {
    const { fragCurrent, fragmentTracker } = this;
    // we just got done loading the final fragment and there is no other buffered range after ...
    // rationale is that in case there are any buffered ranges after, it means that there are unbuffered portion in between
    // so we should not switch to ENDED in that case, to be able to buffer them
    // dont switch to ENDED if we need to backtrack last fragment
    if (!levelDetails.live && fragCurrent && !fragCurrent.backtracked && fragCurrent.sn === levelDetails.endSN && !bufferInfo.nextStart) {
      const fragState = fragmentTracker.getState(fragCurrent);
      return fragState === FragmentState.PARTIAL || fragState === FragmentState.OK;
    }
    return false;
  }

  protected onMediaSeeking () {
    const { config, fragCurrent, media, mediaBuffer, state } = this;
    const currentTime = media ? media.currentTime : null;
    const bufferInfo = BufferHelper.bufferInfo(mediaBuffer || media, currentTime, this.config.maxBufferHole);

    if (Number.isFinite(currentTime)) {
      this.log(`media seeking to ${currentTime.toFixed(3)}, state: ${state}`);
    }

    if (state === State.ENDED) {
      // if seeking to unbuffered area, clean up fragPrevious
      if (!bufferInfo.len) {
        this.fragPrevious = null;
        this.fragCurrent = null;
      }
      // switch to IDLE state to check for potential new fragment
      this.state = State.IDLE;
    } else if (fragCurrent && !bufferInfo.len) {
      // check if we are seeking to a unbuffered area AND if frag loading is in progress
      const tolerance = config.maxFragLookUpTolerance;
      const fragStartOffset = fragCurrent.start - tolerance;
      const fragEndOffset = fragCurrent.start + fragCurrent.duration + tolerance;
      // check if we seek position will be out of currently loaded frag range : if out cancel frag load, if in, don't do anything
      if (currentTime < fragStartOffset || currentTime > fragEndOffset) {
        if (fragCurrent.loader) {
          this.log('seeking outside of buffer while fragment load in progress, cancel fragment load');
          fragCurrent.loader.abort();
        }
        this.fragCurrent = null;
        this.fragPrevious = null;
        // switch to IDLE state to load new fragment
        this.state = State.IDLE;
      }
    }

    if (media) {
      this.lastCurrentTime = currentTime;
    }

    // in case seeking occurs although no media buffered, adjust startPosition and nextLoadPosition to seek target
    if (!this.loadedmetadata) {
      this.nextLoadPosition = this.startPosition = currentTime;
    }

    // tick to speed up processing
    this.tick();
  }

  protected onMediaEnded () {
    // reset startPosition and lastCurrentTime to restart playback @ stream beginning
    this.startPosition = this.lastCurrentTime = 0;
  }

  protected onHandlerDestroying () {
    this.stopLoad();
    super.onHandlerDestroying();
  }

  protected onHandlerDestroyed () {
    this.state = State.STOPPED;
    super.onHandlerDestroyed();
  }

  protected _loadFragForPlayback (frag: Fragment) {
    const progressCallback: FragmentLoadProgressCallback = ({ payload }) => {
      if (this._fragLoadAborted(frag)) {
        this.warn(`Fragment ${frag.sn} of level ${frag.level} was aborted during progressive download.`);
        this.fragmentTracker.removeFragment(frag);
        return;
      }
      frag.stats.chunkCount++;
      this._handleFragmentLoadProgress(frag, payload);
    };

    this._doFragLoad(frag, progressCallback)
      .then((data: FragLoadSuccessResult) => {
        this.fragLoadError = 0;
        if (!data || this._fragLoadAborted(frag)) {
          return;
        }
        this.log(`Loaded fragment ${frag.sn} of level ${frag.level}`);
        // For compatibility, emit the FRAG_LOADED with the same signature
        const compatibilityEventData: any = data;
        compatibilityEventData.frag = frag;
        this.hls.trigger(Events.FRAG_LOADED, compatibilityEventData);
        // Pass through the whole payload; controllers not implementing progressive loading receive data from this callback
        this._handleFragmentLoadComplete(frag, data.payload);
      });
  }

  protected _loadInitSegment (frag: Fragment) {
    this._doFragLoad(frag)
      .then((data: FragLoadSuccessResult) => {
        if (!data || this._fragLoadAborted(frag) || !this.levels) {
          return;
        }

        return data;
      }).then((data: FragLoadSuccessResult) => {
        const { hls } = this;
        const { payload } = data;
        const decryptData = frag.decryptdata;

        // check to see if the payload needs to be decrypted
        if (payload && payload.byteLength > 0 && decryptData && decryptData.key && decryptData.iv && decryptData.method === 'AES-128') {
          const startTime = performance.now();
          // decrypt the subtitles
          return this.decrypter.webCryptoDecrypt(new Uint8Array(payload), decryptData.key.buffer, decryptData.iv.buffer).then((decryptedData) => {
            const endTime = performance.now();
            hls.trigger(Events.FRAG_DECRYPTED, {
              frag,
              payload: decryptedData,
              stats: {
                tstart: startTime,
                tdecrypt: endTime
              }
            });
            data.payload = decryptedData;

            return data;
          });
        }

        return data;
      }).then((data: FragLoadSuccessResult) => {
        const { fragCurrent, hls, levels } = this;
        if (!levels) {
          return;
        }

        const details = levels[frag.level].details as LevelDetails;
        console.assert(details, 'Level details are defined when init segment is loaded');
        const initSegment = details.initSegment as Fragment;
        console.assert(initSegment, 'Fragment initSegment is defined when init segment is loaded');

        const stats = frag.stats;
        this.state = State.IDLE;
        this.fragLoadError = 0;
        initSegment.data = new Uint8Array(data.payload);
        stats.parsing.start = stats.buffering.start = self.performance.now();
        stats.parsing.end = stats.buffering.end = self.performance.now();
        // TODO: set id from calling class

        // Silence FRAG_BUFFERED event if fragCurrent is null
        if (fragCurrent) {
          hls.trigger(Events.FRAG_BUFFERED, { stats, frag: fragCurrent, id: frag.type });
        }
        this.tick();
      });
  }

  protected _fragLoadAborted (frag: Fragment | null) {
    const { fragCurrent } = this;
    if (!frag || !fragCurrent) {
      return true;
    }
    return frag.level !== fragCurrent.level || frag.sn !== fragCurrent.sn;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected _handleFragmentLoadComplete (frag: Fragment, payload: ArrayBuffer | Uint8Array) {
    const { transmuxer } = this;
    if (!transmuxer) {
      return;
    }
    const chunkMeta = new ChunkMetadata(frag.level, frag.sn, frag.stats.chunkCount + 1, 0);
    chunkMeta.transmuxing.start = performance.now();
    transmuxer.flush(chunkMeta);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected _handleFragmentLoadProgress (frag: Fragment, payload: ArrayBuffer | Uint8Array) {}

  protected _doFragLoad (frag: Fragment, progressCallback?: FragmentLoadProgressCallback) {
    this.state = State.FRAG_LOADING;
    this.hls.trigger(Events.FRAG_LOADING, { frag });

    const errorHandler = (e) => {
      const errorData = e ? e.data : null;
      if (errorData && errorData.details === ErrorDetails.INTERNAL_ABORTED) {
        this.handleFragLoadAborted(frag);
        return;
      }
      this.hls.trigger(Events.ERROR, errorData);
    };

    const level = (this.levels as Array<Level>)[frag.level];
    const details = level.details as LevelDetails;
    const media = this.mediaBuffer || this.media;
    const currentTime = media ? media.currentTime : null;
    const bufferInfo = BufferHelper.bufferInfo(media, currentTime, this.config.maxBufferHole);
    const maxBitrate = level.maxBitrate || 0;

    let bitsToBuffer: number = 0;
    if (bufferInfo.len === 0) {
      // Attempt to buffer 3 seconds of content when no buffer is available
      bitsToBuffer = maxBitrate * 3;
    } else if (details.live || (bufferInfo.end - this.media.currentTime) < details.levelTargetDuration * 2) {
      // Buffer at least one second at a time
      bitsToBuffer = Math.min(maxBitrate, Math.round(this.hls.bandwidthEstimate * 0.05));
    } else {
      // Load the whole fragment without progress updates
      bitsToBuffer = Infinity;
    }

    return this.fragmentLoader.load(frag, progressCallback, Math.round(bitsToBuffer / 8))
      .catch(errorHandler);
  }

  protected _handleTransmuxerFlush (chunkMeta: ChunkMetadata) {
    if (this.state !== State.PARSING) {
      this.warn(`State is expected to be PARSING on transmuxer flush, but is ${this.state}.`);
      return;
    }

    const context = this.getCurrentContext(chunkMeta);
    if (!context) {
      return;
    }
    const { frag, level } = context;
    frag.stats.parsing.end = performance.now();

    this.updateLevelTiming(frag, level);
    this.state = State.PARSED;
    this.hls.trigger(Events.FRAG_PARSED, { frag });
  }

  protected getCurrentContext (chunkMeta: ChunkMetadata) : { frag: Fragment, level: Level } | null {
    const { fragCurrent, levels } = this;
    const { level, sn } = chunkMeta;
    if (!levels || !levels[level]) {
      this.warn(`Levels object was unset while buffering fragment ${sn} of level ${level}. The current chunk will not be buffered.`);
      return null;
    }
    const currentLevel = levels[level];

    // Check if the current fragment has been aborted. We check this by first seeing if we're still playing the current level.
    // If we are, subsequently check if the currently loading fragment (fragCurrent) has changed.
    let frag = LevelHelper.getFragmentWithSN(currentLevel, sn);
    if (this._fragLoadAborted(frag)) {
      return null;
    }
    // Assign fragCurrent. References to fragments in the level details change between playlist refreshes.
    // TODO: Preserve frag references between live playlist refreshes
    frag = fragCurrent!;
    return { frag, level: currentLevel };
  }

  protected bufferFragmentData (data: RemuxedTrack, frag: Fragment, chunkMeta: ChunkMetadata) {
    if (!data || this.state !== State.PARSING) {
      return;
    }

    const { data1, data2 } = data;
    let buffer = data1;
    if (data1 && data2) {
      // Combine the moof + mdat so that we buffer with a single append
      buffer = appendUint8Array(data1, data2);
    }

    if (!buffer || !buffer.length) {
      return;
    }

    const segment: BufferAppendingData = { type: data.type, data: buffer, frag, chunkMeta };
    this.hls.trigger(Events.BUFFER_APPENDING, segment);
    this.tick();
  }

  protected getNextFragment (pos: number, levelDetails: LevelDetails): Fragment | null {
    const { config, startFragRequested } = this;
    const fragments = levelDetails.fragments;
    const fragLen = fragments.length;

    if (!fragLen) {
      return null;
    }

    // find fragment index, contiguous with end of buffer position
    const start = fragments[0].start;
    const end = fragments[fragLen - 1].start + fragments[fragLen - 1].duration;
    let loadPosition = pos;
    let frag;

    // If an initSegment is present, it must be buffered first
    if (levelDetails.initSegment && !levelDetails.initSegment.data) {
      frag = levelDetails.initSegment;
    } else if (levelDetails.live) {
      const initialLiveManifestSize = config.initialLiveManifestSize;
      if (fragLen < initialLiveManifestSize) {
        this.warn(`Not enough fragments to start playback (have: ${fragLen}, need: ${initialLiveManifestSize})`);
        return null;
      }
      // Check to see if we're within the live range; if not, this method will seek to the live edge and return the new position
      const syncPos = this.synchronizeToLiveEdge(start, end, loadPosition, levelDetails.targetduration, levelDetails.totalduration);
      if (syncPos !== null) {
        loadPosition = syncPos;
      }
      // The real fragment start times for a live stream are only known after the PTS range for that level is known.
      // In order to discover the range, we load the best matching fragment for that level and demux it.
      // Do not load using live logic if the starting frag is requested - we want to use getFragmentAtPosition() so that
      // we get the fragment matching that start time
      if (!levelDetails.PTSKnown && !startFragRequested) {
        frag = this.getInitialLiveFragment(levelDetails, fragments);
      }
    } else if (loadPosition < start) {
      // VoD playlist: if loadPosition before start of playlist, load first fragment
      frag = fragments[0];
    }

    // If we haven't run into any special cases already, just load the fragment most closely matching the requested position
    if (!frag) {
      frag = this.getFragmentAtPosition(loadPosition, end, levelDetails);
    }

    return frag;
  }

  /*
   This method is used find the best matching first fragment for a live playlist. This fragment is used to calculate the
   "sliding" of the playlist, which is its offset from the start of playback. After sliding we can compute the real
   start and end times for each fragment in the playlist (after which this method will not need to be called).
  */
  protected getInitialLiveFragment (levelDetails: LevelDetails, fragments: Array<Fragment>): Fragment | null {
    const { config, fragPrevious } = this;
    let frag: Fragment | null = null;
    if (fragPrevious) {
      if (levelDetails.hasProgramDateTime) {
        // Prefer using PDT, because it can be accurate enough to choose the correct fragment without knowing the level sliding
        this.log(`Live playlist, switching playlist, load frag with same PDT: ${fragPrevious.programDateTime}`);
        frag = findFragmentByPDT(fragments, fragPrevious.endProgramDateTime, config.maxFragLookUpTolerance);
      } else {
        // SN does not need to be accurate between renditions, but depending on the packaging it may be so.
        const targetSN = (fragPrevious.sn as number) + 1;
        if (targetSN >= levelDetails.startSN && targetSN <= levelDetails.endSN) {
          const fragNext = fragments[targetSN - levelDetails.startSN];
          // Ensure that we're staying within the continuity range, since PTS resets upon a new range
          if (fragPrevious.cc === fragNext.cc) {
            frag = fragNext;
            this.log(`Live playlist, switching playlist, load frag with next SN: ${frag!.sn}`);
          }
        }
        // It's important to stay within the continuity range if available; otherwise the fragments in the playlist
        // will have the wrong start times
        if (!frag) {
          frag = findFragWithCC(fragments, fragPrevious.cc);
          if (frag) {
            this.log(`Live playlist, switching playlist, load frag with same CC: ${frag.sn}`);
          }
        }
      }
    }

    // If no fragment has been selected by this point, load any one
    if (!frag) {
      const len = fragments.length;
      frag = fragments[Math.min(len - 1, Math.round(len / 2))];
      this.log(`Live playlist, switching playlist, unknown, load middle frag : ${frag!.sn}`);
    }

    return frag;
  }

  /*
  This method finds the best matching fragment given the provided position.
   */
  protected getFragmentAtPosition (bufferEnd: number, end: number, levelDetails: LevelDetails): Fragment | null {
    const { config, fragPrevious } = this;
    const fragments = levelDetails.fragments;
    const tolerance = config.maxFragLookUpTolerance;

    let frag;
    if (bufferEnd < end) {
      const lookupTolerance = (bufferEnd > end - tolerance) ? 0 : tolerance;
      // Remove the tolerance if it would put the bufferEnd past the actual end of stream
      // Uses buffer and sequence number to calculate switch segment (required if using EXT-X-DISCONTINUITY-SEQUENCE)
      frag = findFragmentByPTS(fragPrevious, fragments, bufferEnd, lookupTolerance);
    } else {
      // reach end of playlist
      frag = fragments[fragments.length - 1];
    }

    if (frag) {
      const curSNIdx = frag.sn - levelDetails.startSN;
      const sameLevel = fragPrevious && frag.level === fragPrevious.level;
      const prevFrag = fragments[curSNIdx - 1];
      const nextFrag = fragments[curSNIdx + 1];
      // Force the next fragment to load if the previous one was already selected. This can occasionally happen with
      // non-uniform fragment durations
      if (fragPrevious && frag.sn === fragPrevious.sn) {
        if (sameLevel && !frag.backtracked) {
          if (frag.sn < levelDetails.endSN) {
            frag = nextFrag;
            this.log(`SN just loaded, load next one: ${frag.sn}`);
          } else {
            frag = null;
          }
        } else if (frag.backtracked) {
          // Only backtrack a max of 1 consecutive fragment to prevent sliding back too far when little or no frags start with keyframes
          if (nextFrag?.backtracked) {
            this.warn(`Already backtracked from fragment ${nextFrag.sn}, will not backtrack to fragment ${frag.sn}. Loading fragment ${nextFrag.sn}`);
            frag = nextFrag;
          } else {
            // If a fragment has dropped frames and it's in a same level/sequence, load the previous fragment to try and find the keyframe
            // Reset the dropped count now since it won't be reset until we parse the fragment again, which prevents infinite backtracking on the same segment
            frag.dropped = 0;
            if (prevFrag) {
              frag = prevFrag;
              frag.backtracked = true;
            } else if (curSNIdx) {
              // can't backtrack on very first fragment
              frag = null;
            }
          }
        }
      }
    }
    return frag;
  }

  protected synchronizeToLiveEdge (start: number, end: number, bufferEnd: number, targetDuration: number, totalDuration: number): number | null {
    const { config, media } = this;
    const maxLatency = config.liveMaxLatencyDuration !== undefined
      ? config.liveMaxLatencyDuration
      : config.liveMaxLatencyDurationCount * targetDuration;

    if (bufferEnd < Math.max(start - config.maxFragLookUpTolerance, end - maxLatency)) {
      const liveSyncPosition = this._liveSyncPosition = this.computeLivePosition(start, targetDuration, totalDuration);
      this.log(`Buffer end: ${bufferEnd.toFixed(3)} is located too far from the end of live sliding playlist, reset currentTime to : ${liveSyncPosition.toFixed(3)}`);
      this.nextLoadPosition = liveSyncPosition;
      if (media?.readyState && media.duration > liveSyncPosition && liveSyncPosition > media.currentTime) {
        media.currentTime = liveSyncPosition;
      }
      return liveSyncPosition;
    }
    return null;
  }

  protected mergeLivePlaylists (oldDetails: LevelDetails | undefined, newDetails: LevelDetails): number {
    const { levels, levelLastLoaded } = this;
    let lastLevel: Level | undefined;
    if (levelLastLoaded) {
      lastLevel = levels![levelLastLoaded];
    }

    let sliding = 0;
    if (oldDetails && newDetails.fragments.length > 0) {
      // we already have details for that level, merge them
      LevelHelper.mergeDetails(oldDetails, newDetails);
      sliding = newDetails.fragments[0].start;
      if (newDetails.PTSKnown && Number.isFinite(sliding)) {
        this.log(`Live playlist sliding:${sliding.toFixed(3)}`);
      } else {
        this.log('Live playlist - outdated PTS, unknown sliding');
        alignStream(this.fragPrevious, lastLevel, newDetails);
      }
    } else {
      this.log('Live playlist - first load, unknown sliding');
      newDetails.PTSKnown = false;
      alignStream(this.fragPrevious, lastLevel, newDetails);
    }

    return sliding;
  }

  protected setStartPosition (details: LevelDetails, sliding: number) {
    // compute start position if set to -1. use it straight away if value is defined
    if (this.startPosition === -1 || this.lastCurrentTime === -1) {
      // first, check if start time offset has been set in playlist, if yes, use this value
      let startTimeOffset = details.startTimeOffset!;
      if (Number.isFinite(startTimeOffset)) {
        if (startTimeOffset < 0) {
          this.log(`Negative start time offset ${startTimeOffset}, count from end of last fragment`);
          startTimeOffset = sliding + details.totalduration + startTimeOffset;
        }
        this.log(`Start time offset found in playlist, adjust startPosition to ${startTimeOffset}`);
        this.startPosition = startTimeOffset;
      } else {
        // if live playlist, set start position to be fragment N-this.config.liveSyncDurationCount (usually 3)
        if (details.live) {
          this.startPosition = this.computeLivePosition(sliding, details.targetduration, details.totalduration);
          this.log(`Configure startPosition to ${this.startPosition}`);
        } else {
          this.startPosition = 0;
        }
      }
      this.lastCurrentTime = this.startPosition;
    }
    this.nextLoadPosition = this.startPosition;
  }

  protected computeLivePosition (sliding: number, targetDuration: number, totalDuration: number): number {
    const { liveSyncDuration, liveSyncDurationCount } = this.config;
    const targetLatency = liveSyncDuration !== undefined ? liveSyncDuration : liveSyncDurationCount * targetDuration;
    return sliding + Math.max(0, totalDuration - targetLatency);
  }

  protected getLoadPosition (): number {
    const { media } = this;
    // if we have not yet loaded any fragment, start loading from start position
    let pos = 0;
    if (this.loadedmetadata) {
      pos = media.currentTime;
    } else if (this.nextLoadPosition) {
      pos = this.nextLoadPosition;
    }

    return pos;
  }

  private handleFragLoadAborted (frag: Fragment) {
    const { fragPrevious, transmuxer } = this;
    // TODO: nextLoadPos should only be set on successful frag load
    if (fragPrevious) {
      this.nextLoadPosition = fragPrevious.start + fragPrevious.duration;
    } else {
      this.nextLoadPosition = this.lastCurrentTime;
    }
    if (transmuxer && frag.sn !== 'initSegment') {
      transmuxer.flush(new ChunkMetadata(frag.level, frag.sn, frag.stats.chunkCount + 1, 0));
    }

    Object.keys(frag.elementaryStreams).forEach(type => {
      frag.elementaryStreams[type] = null;
    });
    this.log(`Fragment ${frag.sn} of level ${frag.level} was aborted, flushing transmuxer & resetting nextLoadPosition to ${this.nextLoadPosition}`);
  }

  private updateLevelTiming (frag: Fragment, currentLevel: Level) {
    const { details } = currentLevel;
    Object.keys(frag.elementaryStreams).forEach(type => {
      const info = frag.elementaryStreams[type];
      if (info) {
        const drift = LevelHelper.updateFragPTSDTS(details, frag, info.startPTS, info.endPTS, info.startDTS, info.endDTS);
        this.hls.trigger(Events.LEVEL_PTS_UPDATED, {
          details,
          level: currentLevel,
          drift,
          type,
          start: info.startPTS,
          end: info.endPTS
        });
      }
    });
  }

  set state (nextState) {
    const previousState = this._state;
    if (previousState !== nextState) {
      this._state = nextState;
      this.log(`${previousState}->${nextState}`);
    }
  }

  get state () {
    return this._state;
  }

  protected log (msg) {
    logger.log(`${this.logPrefix}: ${msg}`);
  }

  protected warn (msg) {
    logger.warn(`${this.logPrefix}: ${msg}`);
  }
}
