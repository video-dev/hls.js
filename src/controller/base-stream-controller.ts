import TaskLoop from '../task-loop';
import { FragmentState, FragmentTracker } from './fragment-tracker';
import { BufferHelper } from '../utils/buffer-helper';
import { logger } from '../utils/logger';
import { Events } from '../events';
import { ErrorDetails, ErrorTypes } from '../errors';
import * as LevelHelper from './level-helper';
import { ChunkMetadata } from '../types/transmuxer';
import { appendUint8Array } from '../utils/mp4-tools';
import { alignStream } from '../utils/discontinuities';
import { findFragmentByPDT, findFragmentByPTS, findFragWithCC } from './fragment-finders';
import TransmuxerInterface from '../demux/transmuxer-interface';
import Fragment, { Part } from '../loader/fragment';
import FragmentLoader, {
  FragmentLoadProgressCallback,
  LoadError
} from '../loader/fragment-loader';
import LevelDetails from '../loader/level-details';
import { BufferAppendingData, ErrorData, FragLoadedData, FragLoadedEndData, KeyLoadedData } from '../types/events';
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
    hls.on(Events.KEY_LOADED, this.onKeyLoaded, this);
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

  onKeyLoaded (event: Events.KEY_LOADED, data: KeyLoadedData) {
    if (this.state === State.KEY_LOADING && this.levels) {
      this.state = State.IDLE;
      const levelDetails = this.levels[data.frag.level].details;
      if (levelDetails) {
        this.loadFragment(data.frag, levelDetails, data.frag.start);
      }
    }
  }

  protected onHandlerDestroying () {
    this.stopLoad();
    super.onHandlerDestroying();
  }

  protected onHandlerDestroyed () {
    this.state = State.STOPPED;
    this.hls.off(Events.KEY_LOADED, this.onKeyLoaded, this);
    super.onHandlerDestroyed();
  }

  protected loadFragment (frag: Fragment, levelDetails: LevelDetails, targetBufferTime: number) {
    this._loadFragForPlayback(frag, levelDetails, targetBufferTime);
  }

  private _loadFragForPlayback (frag: Fragment, levelDetails: LevelDetails, targetBufferTime: number) {
    const progressCallback: FragmentLoadProgressCallback = (data: FragLoadedData) => {
      if (this.fragContextChanged(frag)) {
        this.warn(`Fragment ${frag.sn} of level ${frag.level} was dropped during download.`);
        this.fragmentTracker.removeFragment(frag);
        return;
      }
      frag.stats.chunkCount++;
      this._handleFragmentLoadProgress(data);
    };

    this._doFragLoad(frag, levelDetails, targetBufferTime, progressCallback)
      .then((data: FragLoadedData | null) => {
        this.fragLoadError = 0;
        if (!data) {
          // if we're here we probably needed to backtrack
          return;
        }
        if (this.fragContextChanged(frag)) {
          if (this.state === State.FRAG_LOADING) {
            this.state = State.IDLE;
          }
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
        if (!data || this.fragContextChanged(frag) || !this.levels) {
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
          const startTime = self.performance.now();
          // decrypt the subtitles
          return this.decrypter.webCryptoDecrypt(new Uint8Array(payload), decryptData.key.buffer, decryptData.iv.buffer).then((decryptedData) => {
            const endTime = self.performance.now();
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
          hls.trigger(Events.FRAG_BUFFERED, {
            stats,
            frag: fragCurrent,
            part: null,
            id: frag.type
          });
        }
        this.tick();
      }).catch(reason => {
        logger.warn(reason);
      });
  }

  protected fragContextChanged (frag: Fragment | null) {
    const { fragCurrent } = this;
    return !frag || !fragCurrent || frag.level !== fragCurrent.level || frag.sn !== fragCurrent.sn || frag.urlId !== fragCurrent.urlId;
  }

  protected _handleFragmentLoadComplete (fragLoadedEndData: FragLoadedEndData) {
    const { transmuxer } = this;
    if (!transmuxer) {
      return;
    }
    const { frag, partsLoaded } = fragLoadedEndData;
    // If we did not load parts, or loaded all parts, we have complete (not partial) fragment data
    const complete = !partsLoaded || (partsLoaded && (partsLoaded.length === 0 || partsLoaded.some(fragLoaded => !fragLoaded)));
    const chunkMeta = new ChunkMetadata(frag.level, frag.sn as number, frag.stats.chunkCount + 1, 0, -1, !complete);
    transmuxer.flush(chunkMeta);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected _handleFragmentLoadProgress (frag: FragLoadedData) {}

  protected _doFragLoad (frag: Fragment, details?: LevelDetails, targetBufferTime: number | null = null, progressCallback?: FragmentLoadProgressCallback): Promise<FragLoadedEndData | FragLoadedData | null> {
    if (!this.levels) {
      throw new Error('frag load aborted, missing levels');
    }

    targetBufferTime = Math.max(frag.start, targetBufferTime || 0);
    const partList = details?.partList;
    if (partList && progressCallback) {
      const partIndex = this.getNextPart(partList, frag, targetBufferTime);
      if (partIndex > -1) {
        this.state = State.FRAG_LOADING;
        this.hls.trigger(Events.FRAG_LOADING, { frag, part: partList[partIndex], targetBufferTime });
        return this.doFragPartsLoad(frag, partList, partIndex, progressCallback)
          .catch((error: LoadError) => this.handleFragError(error));
      } else if (!frag.url || this.loadedEndOfParts(partList, targetBufferTime)) {
        // Fragment hint has no parts
        return Promise.resolve(null);
      }
    }

    this.state = State.FRAG_LOADING;
    this.hls.trigger(Events.FRAG_LOADING, { frag, targetBufferTime });

    return this.fragmentLoader.load(frag, progressCallback)
      .catch((error: LoadError) => this.handleFragError(error));
  }

  private doFragPartsLoad (frag: Fragment, partList: Part[], partIndex: number, progressCallback: FragmentLoadProgressCallback): Promise<FragLoadedEndData | null> {
    return new Promise((resolve: (FragLoadedEndData) => void, reject: (LoadError) => void) => {
      const partsLoaded: FragLoadedData[] = [];
      const fragLoadedEndData: FragLoadedEndData = {
        frag,
        partsLoaded
      };
      const loadPartIndex = (index: number) => {
        const part = partList[index];
        this.fragmentLoader.loadPart(frag, part, progressCallback).then((partLoadedData: FragLoadedData) => {
          partsLoaded[part.index] = partLoadedData;
          const loadedPart = partLoadedData.part as Part;
          const nextPart = partList[index + 1];
          if (nextPart && nextPart.fragment === frag) {
            loadPartIndex(index + 1);
          } else {
            if (index >= partList.length - 1) {
              // console.log(`last in list sn: ${loadedPart.fragment.sn} p: ${loadedPart!.index} partList[${index}]`);
              // FIXME: We shouldn't have to abort here. Resolve with partial result as long as we can resume from the correct position later.
              //  Or, wait for partList update
              // frag.stats.aborted = true;
              return reject(new LoadError({
                type: ErrorTypes.NETWORK_ERROR,
                details: ErrorDetails.INTERNAL_ABORTED,
                fatal: false,
                frag,
                part: loadedPart,
                networkDetails: partLoadedData.networkDetails
              }));
            }
            return resolve(fragLoadedEndData);
          }
        }).catch(reject);
      };
      loadPartIndex(partIndex);
    });
  }

  private handleFragError ({ data }: LoadError) {
    if (data && data.details === ErrorDetails.INTERNAL_ABORTED) {
      this.handleFragLoadAborted(data.frag, data.part);
    } else {
      this.hls.trigger(Events.ERROR, data as ErrorData);
    }
    return null;
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
    const { frag, part, level } = context;
    const now = self.performance.now();
    frag.stats.parsing.end = now;
    if (part) {
      part.stats.parsing.end = now;
    }
    this.updateLevelTiming(frag, level, chunkMeta.partial);
    this.state = State.PARSED;
    this.hls.trigger(Events.FRAG_PARSED, { frag, part });
  }

  protected getCurrentContext (chunkMeta: ChunkMetadata) : { frag: Fragment, part: Part | null, level: Level } | null {
    const { levels } = this;
    const { level: levelIndex, sn, part: partIndex } = chunkMeta;
    if (!levels || !levels[levelIndex]) {
      this.warn(`Levels object was unset while buffering fragment ${sn} of level ${levelIndex}. The current chunk will not be buffered.`);
      return null;
    }
    const level = levels[levelIndex];
    const part = (partIndex > -1) ? LevelHelper.getPartWith(level, sn, partIndex) : null;
    const frag = part ? part.fragment : LevelHelper.getFragmentWithSN(level, sn);
    if (!frag) {
      return null;
    }
    return { frag, part, level };
  }

  protected bufferFragmentData (data: RemuxedTrack, frag: Fragment, part: Part | null, chunkMeta: ChunkMetadata) {
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

    const segment: BufferAppendingData = {
      type: data.type,
      data: buffer,
      frag,
      part,
      chunkMeta
    };
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
    } else if (pos <= start) {
      // VoD playlist: if loadPosition before start of playlist, load first fragment
      frag = fragments[0];
    }

    // If we haven't run into any special cases already, just load the fragment most closely matching the requested position
    if (!frag) {
      const end = config.lowLatencyMode ? levelDetails.partEnd : levelDetails.fragmentEnd;
      frag = this.getFragmentAtPosition(pos, end, levelDetails);
    }

    return frag;
  }

  getNextPart (partList: Part[], frag: Fragment, targetBufferTime: number): number {
    let nextPart = -1;
    let contiguous = false;
    for (let i = 0, len = partList.length; i < len; i++) {
      const part = partList[i];
      if (nextPart > -1 && targetBufferTime < part.start) {
        break;
      }
      const loaded = part.loaded;
      if (!loaded && (contiguous || part.independent) && part.fragment === frag) {
        nextPart = i;
      }
      contiguous = loaded;
    }
    return nextPart;
  }

  private loadedEndOfParts (partList: Part[], targetBufferTime: number) {
    const lastPart = partList[partList.length - 1];
    return lastPart && targetBufferTime > lastPart.start && lastPart.loaded;
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
    let { fragments, endSN, fragmentHint } = levelDetails;
    const tolerance = config.maxFragLookUpTolerance;

    const loadingParts = !!(config.lowLatencyMode && levelDetails.partList && fragmentHint);
    if (loadingParts && fragmentHint) {
      // Include incomplete fragment with parts at end
      fragments = fragments.concat(fragmentHint);
      endSN = fragmentHint.sn as number;
    }

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
      if (fragPrevious && frag.sn === fragPrevious.sn && !loadingParts) {
        if (sameLevel && !frag.backtracked) {
          if (frag.sn < endSN) {
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
    if (this.transmuxer && frag.sn !== 'initSegment') {
      this.log(`Fragment ${frag.sn} of level ${frag.level} was aborted, flushing transmuxer`);
      this.transmuxer.flush(new ChunkMetadata(frag.level, frag.sn, frag.stats.chunkCount + 1, 0, part ? part.index : -1, true));
    }
  }

  private updateLevelTiming (frag: Fragment, level: Level, partial: boolean) {
    const details = level.details as LevelDetails;
    console.assert(!!details, 'level.details must be defined');
    Object.keys(frag.elementaryStreams).forEach(type => {
      const info = frag.elementaryStreams[type];
      if (info) {
        const drift = partial ? 0 : LevelHelper.updateFragPTSDTS(details, frag, info.startPTS, info.endPTS, info.startDTS, info.endDTS);
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
