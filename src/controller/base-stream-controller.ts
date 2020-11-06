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
import Fragment, { Part } from '../loader/fragment';
import FragmentLoader, {
  FragLoadFailResult,
  FragmentLoadProgressCallback,
  LoadError
} from '../loader/fragment-loader';
import LevelDetails from '../loader/level-details';
import { BufferAppendingData, ErrorData, FragLoadedData } from '../types/events';
import { Level } from '../types/level';
import { RemuxedTrack } from '../types/remuxer';
import Hls from '../hls';
import Decrypter from '../crypt/decrypter';
import type { HlsConfig } from '../config';
import type { HlsEventEmitter } from '../events';
import { NetworkComponentAPI } from '../types/component-api';

export const State = {
  STOPPED: 'STOPPED',
  IDLE: 'IDLE',
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

export default class BaseStreamController extends TaskLoop implements NetworkComponentAPI {
  protected hls: Hls;

  protected fragPrevious: Fragment | null = null;
  protected fragCurrent: Fragment | null = null;
  protected fragmentTracker: FragmentTracker;
  protected transmuxer: TransmuxerInterface | null = null;
  protected _state: string = State.STOPPED;
  protected media?: any;
  protected mediaBuffer?: any;
  protected config: HlsConfig;
  protected lastCurrentTime: number = 0;
  protected nextLoadPosition: number = 0;
  protected startPosition: number = 0;
  protected loadedmetadata: boolean = false;
  protected fragLoadError: number = 0;
  protected levels: Array<Level> | null = null;
  protected fragmentLoader!: FragmentLoader;
  protected levelLastLoaded: number | null = null;
  protected startFragRequested: boolean = false;
  protected decrypter: Decrypter;
  protected initPTS: Array<number> = [];

  protected readonly logPrefix: string = '';

  constructor (hls: Hls, fragmentTracker: FragmentTracker) {
    super();
    this.hls = hls;
    this.fragmentTracker = fragmentTracker;
    this.config = hls.config;
    this.decrypter = new Decrypter(hls as HlsEventEmitter, hls.config);
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
    const bufferInfo = BufferHelper.bufferInfo(mediaBuffer || media, currentTime, config.maxBufferHole);

    this.log(`media seeking to ${Number.isFinite(currentTime) ? currentTime.toFixed(3) : currentTime}, state: ${state}`);

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

  protected _loadFragForPlayback (frag: Fragment, targetBufferTime: number) {
    const progressCallback: FragmentLoadProgressCallback = (data: FragLoadedData) => {
      if (this._fragLoadAborted(frag)) {
        this.warn(`Fragment ${frag.sn} of level ${frag.level} was aborted during progressive download.`);
        this.fragmentTracker.removeFragment(frag);
        return;
      }
      frag.stats.chunkCount++;
      this._handleFragmentLoadProgress(data);
    };

    this._doFragLoad(frag, targetBufferTime, progressCallback)
      .then((data: FragLoadedData | null) => {
        this.fragLoadError = 0;
        const aborted = this._fragLoadAborted(frag);
        if (!data || aborted) {
          return;
        }
        this.log(`Loaded fragment ${frag.sn} of level ${frag.level}`);
        this.hls.trigger(Events.FRAG_LOADED, data);
        // Pass through the whole payload; controllers not implementing progressive loading receive data from this callback
        this._handleFragmentLoadComplete(data);
      });
  }

  protected _loadInitSegment (frag: Fragment) {
    this._doFragLoad(frag)
      .then((data: FragLoadedData | null) => {
        if (!data || this._fragLoadAborted(frag) || !this.levels) {
          throw new Error('init load aborted');
        }

        return data;
      })
      .then((data: FragLoadedData) => {
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
      }).then((data: FragLoadedData) => {
        const { fragCurrent, hls, levels } = this;
        if (!levels) {
          throw new Error('init load aborted, missing levels');
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

        // Silence FRAG_BUFFERED event if fragCurrent is null
        if (data.frag === fragCurrent) {
          hls.trigger(Events.FRAG_BUFFERED, { stats, frag: fragCurrent, id: frag.type });
        }
        this.tick();
      }).catch(reason => {
        logger.warn(reason);
      });
  }

  protected _fragLoadAborted (frag: Fragment | null) {
    const { fragCurrent } = this;
    // frag.level can refer to bitrate variant or media track index
    if (!frag || !fragCurrent || frag.level !== fragCurrent.level || frag.sn !== fragCurrent.sn) {
      return true;
    }
    return false;
  }

  protected _handleFragmentLoadComplete (fragLoadedData: FragLoadedData) {
    const { transmuxer } = this;
    if (!transmuxer) {
      return;
    }
    const { frag, part } = fragLoadedData;
    const partIndex = part ? part.index : -1;
    const chunkMeta = new ChunkMetadata(frag.level, frag.sn, frag.stats.chunkCount + 1, 0, partIndex);
    chunkMeta.transmuxing.start = performance.now();
    transmuxer.flush(chunkMeta);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected _handleFragmentLoadProgress (frag: FragLoadedData) {}

  protected _doFragLoad (frag: Fragment, targetBufferTime: number | null = null, progressCallback?: FragmentLoadProgressCallback): Promise<FragLoadedData | null> {
    this.state = State.FRAG_LOADING;
    this.hls.trigger(Events.FRAG_LOADING, { frag, targetBufferTime });

    return this.fragmentLoader.load(frag, targetBufferTime, progressCallback)
      .catch((e: LoadError) => {
        const errorData: FragLoadFailResult = e.data;

        if (errorData && errorData.details === ErrorDetails.INTERNAL_ABORTED) {
          this.handleFragLoadAborted(frag, errorData.part);
        } else {
          this.hls.trigger(Events.ERROR, errorData as ErrorData);
        }
        return null;
      });
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
    const { frag, partIndex, level } = context;
    frag.stats.parsing.end = performance.now();

    this.updateLevelTiming(frag, level);
    this.state = State.PARSED;
    this.hls.trigger(Events.FRAG_PARSED, { frag, partIndex });
  }

  protected getCurrentContext (chunkMeta: ChunkMetadata) : { frag: Fragment, partIndex: number, level: Level } | null {
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
    frag = fragCurrent!;
    return { frag, partIndex: chunkMeta.part, level: currentLevel };
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
    const end = levelDetails.edge;
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
      // The real fragment start times for a live stream are only known after the PTS range for that level is known.
      // In order to discover the range, we load the best matching fragment for that level and demux it.
      // Do not load using live logic if the starting frag is requested - we want to use getFragmentAtPosition() so that
      // we get the fragment matching that start time
      if (!levelDetails.PTSKnown && !startFragRequested) {
        frag = this.getInitialLiveFragment(levelDetails, fragments);
      }
    } else if (pos < start) {
      // VoD playlist: if loadPosition before start of playlist, load first fragment
      frag = fragments[0];
    }

    // If we haven't run into any special cases already, just load the fragment most closely matching the requested position
    if (!frag) {
      frag = this.getFragmentAtPosition(pos, end, levelDetails);
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
            if (this.fragmentTracker.getState(frag) !== FragmentState.OK) {
              this.log(`SN just loaded, load next one: ${frag.sn}`);
            }
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

  protected synchronizeToLiveEdge (levelDetails: LevelDetails): number | null {
    const { config, media } = this;
    const liveSyncPosition = this.hls.liveSyncPosition;
    const currentTime = media.currentTime;
    if (liveSyncPosition !== null && media?.readyState && media.duration > liveSyncPosition && liveSyncPosition > currentTime) {
      const maxLatency = config.liveMaxLatencyDuration !== undefined
        ? config.liveMaxLatencyDuration
        : config.liveMaxLatencyDurationCount * levelDetails.targetduration;
      const start = levelDetails.fragments[0].start;
      const end = levelDetails.edge;
      if (currentTime < Math.max(start - config.maxFragLookUpTolerance, end - maxLatency)) {
        this.warn(`Playback: ${currentTime.toFixed(3)} is located too far from the end of live sliding playlist: ${end}, reset currentTime to : ${liveSyncPosition.toFixed(3)}`);
        if (!this.loadedmetadata) {
          this.nextLoadPosition = liveSyncPosition;
        }
        media.currentTime = liveSyncPosition;
        return liveSyncPosition;
      }
    }
    return null;
  }

  protected alignPlaylists (details: LevelDetails, previousDetails?: LevelDetails): number {
    const { levels, levelLastLoaded } = this;
    const lastLevel: Level | null = (levelLastLoaded !== null) ? levels![levelLastLoaded] : null;

    // FIXME: If not for `shouldAlignOnDiscontinuities` requiring fragPrevious.cc,
    //  this could all go in LevelHelper.mergeDetails
    let sliding = 0;
    if (previousDetails && details.fragments.length > 0) {
      sliding = details.fragments[0].start;
      if (details.alignedSliding && Number.isFinite(sliding)) {
        this.log(`Live playlist sliding:${sliding.toFixed(3)}`);
      } else if (!sliding) {
        this.warn(`[${this.constructor.name}] Live playlist - outdated PTS, unknown sliding`);
        alignStream(this.fragPrevious, lastLevel, details);
      }
    } else {
      this.log('Live playlist - first load, unknown sliding');
      alignStream(this.fragPrevious, lastLevel, details);
    }

    return sliding;
  }

  protected waitForCdnTuneIn (details: LevelDetails) {
    // Wait for Low-Latency CDN Tune-in to get an updated playlist
    const advancePartLimit = 3;
    return details.live && details.canBlockReload && details.tuneInGoal > Math.max(details.partHoldBack, details.partTarget * advancePartLimit);
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
        if (details.live) {
          this.startPosition = this.hls.liveSyncPosition || sliding;
          this.log(`Configure startPosition to ${this.startPosition}`);
        } else {
          this.startPosition = 0;
        }
      }
      this.lastCurrentTime = this.startPosition;
    }
    this.nextLoadPosition = this.startPosition;
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

  private handleFragLoadAborted (frag: Fragment, part: Part | undefined) {
    const { transmuxer } = this;
    if (transmuxer && frag.sn !== 'initSegment') {
      transmuxer.flush(new ChunkMetadata(frag.level, frag.sn, frag.stats.chunkCount + 1, 0, part ? part.index : -1));
    }
    Object.keys(frag.elementaryStreams).forEach(type => {
      frag.elementaryStreams[type] = null;
    });
    this.log(`Fragment ${frag.sn} of level ${frag.level} was aborted, flushing transmuxer & resetting nextLoadPosition to ${this.nextLoadPosition}`);
  }

  private updateLevelTiming (frag: Fragment, level: Level) {
    const details = level.details as LevelDetails;
    console.assert(!!details, 'level.details must be defined');
    Object.keys(frag.elementaryStreams).forEach(type => {
      const info = frag.elementaryStreams[type];
      if (info) {
        const drift = LevelHelper.updateFragPTSDTS(details, frag, info.startPTS, info.endPTS, info.startDTS, info.endDTS);
        this.hls.trigger(Events.LEVEL_PTS_UPDATED, {
          details,
          level,
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
