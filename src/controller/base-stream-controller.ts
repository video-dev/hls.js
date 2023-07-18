import TaskLoop from '../task-loop';
import { FragmentState } from './fragment-tracker';
import { Bufferable, BufferHelper, BufferInfo } from '../utils/buffer-helper';
import { logger } from '../utils/logger';
import { Events } from '../events';
import { ErrorDetails, ErrorTypes } from '../errors';
import { ChunkMetadata } from '../types/transmuxer';
import { appendUint8Array } from '../utils/mp4-tools';
import { alignStream } from '../utils/discontinuities';
import {
  findFragmentByPDT,
  findFragmentByPTS,
  findFragWithCC,
} from './fragment-finders';
import {
  findPart,
  getFragmentWithSN,
  getPartWith,
  updateFragPTSDTS,
} from './level-helper';
import TransmuxerInterface from '../demux/transmuxer-interface';
import { Fragment, Part } from '../loader/fragment';
import FragmentLoader, {
  FragmentLoadProgressCallback,
  LoadError,
} from '../loader/fragment-loader';
import KeyLoader from '../loader/key-loader';
import { LevelDetails } from '../loader/level-details';
import Decrypter from '../crypt/decrypter';
import TimeRanges from '../utils/time-ranges';
import { PlaylistLevelType } from '../types/loader';
import { getRetryDelay } from '../utils/error-helper';
import { NetworkErrorAction } from './error-controller';
import type {
  BufferAppendingData,
  ErrorData,
  FragLoadedData,
  PartsLoadedData,
  KeyLoadedData,
  MediaAttachedData,
  BufferFlushingData,
  ManifestLoadedData,
} from '../types/events';
import type { FragmentTracker } from './fragment-tracker';
import type { Level } from '../types/level';
import type { RemuxedTrack } from '../types/remuxer';
import type Hls from '../hls';
import type { HlsConfig } from '../config';
import type { NetworkComponentAPI } from '../types/component-api';
import type { SourceBufferName } from '../types/buffer';
import type { RationalTimestamp } from '../utils/timescale-conversion';

type ResolveFragLoaded = (FragLoadedEndData) => void;
type RejectFragLoaded = (LoadError) => void;

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
  WAITING_LEVEL: 'WAITING_LEVEL',
};

export default class BaseStreamController
  extends TaskLoop
  implements NetworkComponentAPI
{
  protected hls: Hls;

  protected fragPrevious: Fragment | null = null;
  protected fragCurrent: Fragment | null = null;
  protected fragmentTracker: FragmentTracker;
  protected transmuxer: TransmuxerInterface | null = null;
  protected _state: string = State.STOPPED;
  protected playlistType: PlaylistLevelType;
  protected media: HTMLMediaElement | null = null;
  protected mediaBuffer: Bufferable | null = null;
  protected config: HlsConfig;
  protected bitrateTest: boolean = false;
  protected lastCurrentTime: number = 0;
  protected nextLoadPosition: number = 0;
  protected startPosition: number = 0;
  protected startTimeOffset: number | null = null;
  protected loadedmetadata: boolean = false;
  protected retryDate: number = 0;
  protected levels: Array<Level> | null = null;
  protected fragmentLoader: FragmentLoader;
  protected keyLoader: KeyLoader;
  protected levelLastLoaded: number | null = null;
  protected startFragRequested: boolean = false;
  protected decrypter: Decrypter;
  protected initPTS: RationalTimestamp[] = [];
  protected onvseeking: EventListener | null = null;
  protected onvended: EventListener | null = null;

  private readonly logPrefix: string = '';
  protected log: (msg: any) => void;
  protected warn: (msg: any) => void;

  constructor(
    hls: Hls,
    fragmentTracker: FragmentTracker,
    keyLoader: KeyLoader,
    logPrefix: string,
    playlistType: PlaylistLevelType
  ) {
    super();
    this.playlistType = playlistType;
    this.logPrefix = logPrefix;
    this.log = logger.log.bind(logger, `${logPrefix}:`);
    this.warn = logger.warn.bind(logger, `${logPrefix}:`);
    this.hls = hls;
    this.fragmentLoader = new FragmentLoader(hls.config);
    this.keyLoader = keyLoader;
    this.fragmentTracker = fragmentTracker;
    this.config = hls.config;
    this.decrypter = new Decrypter(hls.config);
    hls.on(Events.MANIFEST_LOADED, this.onManifestLoaded, this);
  }

  protected doTick() {
    this.onTickEnd();
  }

  protected onTickEnd() {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public startLoad(startPosition: number): void {}

  public stopLoad() {
    this.fragmentLoader.abort();
    this.keyLoader.abort(this.playlistType);
    const frag = this.fragCurrent;
    if (frag?.loader) {
      frag.abortRequests();
      this.fragmentTracker.removeFragment(frag);
    }
    this.resetTransmuxer();
    this.fragCurrent = null;
    this.fragPrevious = null;
    this.clearInterval();
    this.clearNextTick();
    this.state = State.STOPPED;
  }

  protected _streamEnded(
    bufferInfo: BufferInfo,
    levelDetails: LevelDetails
  ): boolean {
    // If playlist is live, there is another buffered range after the current range, nothing buffered, media is detached,
    // of nothing loading/loaded return false
    if (
      levelDetails.live ||
      bufferInfo.nextStart ||
      !bufferInfo.end ||
      !this.media
    ) {
      return false;
    }
    const partList = levelDetails.partList;
    // Since the last part isn't guaranteed to correspond to the last playlist segment for Low-Latency HLS,
    // check instead if the last part is buffered.
    if (partList?.length) {
      const lastPart = partList[partList.length - 1];

      // Checking the midpoint of the part for potential margin of error and related issues.
      // NOTE: Technically I believe parts could yield content that is < the computed duration (including potential a duration of 0)
      // and still be spec-compliant, so there may still be edge cases here. Likewise, there could be issues in end of stream
      // part mismatches for independent audio and video playlists/segments.
      const lastPartBuffered = BufferHelper.isBuffered(
        this.media,
        lastPart.start + lastPart.duration / 2
      );
      return lastPartBuffered;
    }

    const playlistType =
      levelDetails.fragments[levelDetails.fragments.length - 1].type;
    return this.fragmentTracker.isEndListAppended(playlistType);
  }

  protected getLevelDetails(): LevelDetails | undefined {
    if (this.levels && this.levelLastLoaded !== null) {
      return this.levels[this.levelLastLoaded]?.details;
    }
  }

  protected onMediaAttached(
    event: Events.MEDIA_ATTACHED,
    data: MediaAttachedData
  ) {
    const media = (this.media = this.mediaBuffer = data.media);
    this.onvseeking = this.onMediaSeeking.bind(this) as EventListener;
    this.onvended = this.onMediaEnded.bind(this) as EventListener;
    media.addEventListener('seeking', this.onvseeking);
    media.addEventListener('ended', this.onvended);
    const config = this.config;
    if (this.levels && config.autoStartLoad && this.state === State.STOPPED) {
      this.startLoad(config.startPosition);
    }
  }

  protected onMediaDetaching() {
    const media = this.media;
    if (media?.ended) {
      this.log('MSE detaching and video ended, reset startPosition');
      this.startPosition = this.lastCurrentTime = 0;
    }

    // remove video listeners
    if (media && this.onvseeking && this.onvended) {
      media.removeEventListener('seeking', this.onvseeking);
      media.removeEventListener('ended', this.onvended);
      this.onvseeking = this.onvended = null;
    }
    if (this.keyLoader) {
      this.keyLoader.detach();
    }
    this.media = this.mediaBuffer = null;
    this.loadedmetadata = false;
    this.fragmentTracker.removeAllFragments();
    this.stopLoad();
  }

  protected onMediaSeeking() {
    const { config, fragCurrent, media, mediaBuffer, state } = this;
    const currentTime: number = media ? media.currentTime : 0;
    const bufferInfo = BufferHelper.bufferInfo(
      mediaBuffer ? mediaBuffer : media,
      currentTime,
      config.maxBufferHole
    );

    this.log(
      `media seeking to ${
        Number.isFinite(currentTime) ? currentTime.toFixed(3) : currentTime
      }, state: ${state}`
    );

    if (this.state === State.ENDED) {
      this.resetLoadingState();
    } else if (fragCurrent) {
      // Seeking while frag load is in progress
      const tolerance = config.maxFragLookUpTolerance;
      const fragStartOffset = fragCurrent.start - tolerance;
      const fragEndOffset =
        fragCurrent.start + fragCurrent.duration + tolerance;
      // if seeking out of buffered range or into new one
      if (
        !bufferInfo.len ||
        fragEndOffset < bufferInfo.start ||
        fragStartOffset > bufferInfo.end
      ) {
        const pastFragment = currentTime > fragEndOffset;
        // if the seek position is outside the current fragment range
        if (currentTime < fragStartOffset || pastFragment) {
          if (pastFragment && fragCurrent.loader) {
            this.log(
              'seeking outside of buffer while fragment load in progress, cancel fragment load'
            );
            fragCurrent.abortRequests();
            this.resetLoadingState();
          }
          this.fragPrevious = null;
        }
      }
    }

    if (media) {
      // Remove gap fragments
      this.fragmentTracker.removeFragmentsInRange(
        currentTime,
        Infinity,
        this.playlistType,
        true
      );

      this.lastCurrentTime = currentTime;
    }

    // in case seeking occurs although no media buffered, adjust startPosition and nextLoadPosition to seek target
    if (!this.loadedmetadata && !bufferInfo.len) {
      this.nextLoadPosition = this.startPosition = currentTime;
    }

    // Async tick to speed up processing
    this.tickImmediate();
  }

  protected onMediaEnded() {
    // reset startPosition and lastCurrentTime to restart playback @ stream beginning
    this.startPosition = this.lastCurrentTime = 0;
  }

  protected onManifestLoaded(
    event: Events.MANIFEST_LOADED,
    data: ManifestLoadedData
  ): void {
    this.startTimeOffset = data.startTimeOffset;
    this.initPTS = [];
  }

  protected onHandlerDestroying() {
    this.stopLoad();
    super.onHandlerDestroying();
  }

  protected onHandlerDestroyed() {
    this.state = State.STOPPED;
    if (this.fragmentLoader) {
      this.fragmentLoader.destroy();
    }
    if (this.keyLoader) {
      this.keyLoader.destroy();
    }
    if (this.decrypter) {
      this.decrypter.destroy();
    }

    this.hls =
      this.log =
      this.warn =
      this.decrypter =
      this.keyLoader =
      this.fragmentLoader =
      this.fragmentTracker =
        null as any;
    super.onHandlerDestroyed();
  }

  protected loadFragment(
    frag: Fragment,
    level: Level,
    targetBufferTime: number
  ) {
    this._loadFragForPlayback(frag, level, targetBufferTime);
  }

  private _loadFragForPlayback(
    frag: Fragment,
    level: Level,
    targetBufferTime: number
  ) {
    const progressCallback: FragmentLoadProgressCallback = (
      data: FragLoadedData
    ) => {
      if (this.fragContextChanged(frag)) {
        this.warn(
          `Fragment ${frag.sn}${
            data.part ? ' p: ' + data.part.index : ''
          } of level ${frag.level} was dropped during download.`
        );
        this.fragmentTracker.removeFragment(frag);
        return;
      }
      frag.stats.chunkCount++;
      this._handleFragmentLoadProgress(data);
    };

    this._doFragLoad(frag, level, targetBufferTime, progressCallback)
      .then((data) => {
        if (!data) {
          // if we're here we probably needed to backtrack or are waiting for more parts
          return;
        }
        const state = this.state;
        if (this.fragContextChanged(frag)) {
          if (
            state === State.FRAG_LOADING ||
            (!this.fragCurrent && state === State.PARSING)
          ) {
            this.fragmentTracker.removeFragment(frag);
            this.state = State.IDLE;
          }
          return;
        }

        if ('payload' in data) {
          this.log(`Loaded fragment ${frag.sn} of level ${frag.level}`);
          this.hls.trigger(Events.FRAG_LOADED, data);
        }

        // Pass through the whole payload; controllers not implementing progressive loading receive data from this callback
        this._handleFragmentLoadComplete(data);
      })
      .catch((reason) => {
        if (this.state === State.STOPPED || this.state === State.ERROR) {
          return;
        }
        this.warn(reason);
        this.resetFragmentLoading(frag);
      });
  }

  protected clearTrackerIfNeeded(frag: Fragment) {
    const { fragmentTracker } = this;
    const fragState = fragmentTracker.getState(frag);
    if (fragState === FragmentState.APPENDING) {
      // Lower the buffer size and try again
      const playlistType = frag.type as PlaylistLevelType;
      const bufferedInfo = this.getFwdBufferInfo(
        this.mediaBuffer,
        playlistType
      );
      const minForwardBufferLength = Math.max(
        frag.duration,
        bufferedInfo ? bufferedInfo.len : this.config.maxBufferLength
      );
      if (this.reduceMaxBufferLength(minForwardBufferLength)) {
        fragmentTracker.removeFragment(frag);
      }
    } else if (this.mediaBuffer?.buffered.length === 0) {
      // Stop gap for bad tracker / buffer flush behavior
      fragmentTracker.removeAllFragments();
    } else if (fragmentTracker.hasParts(frag.type)) {
      // In low latency mode, remove fragments for which only some parts were buffered
      fragmentTracker.detectPartialFragments({
        frag,
        part: null,
        stats: frag.stats,
        id: frag.type,
      });
      if (fragmentTracker.getState(frag) === FragmentState.PARTIAL) {
        fragmentTracker.removeFragment(frag);
      }
    }
  }

  protected flushMainBuffer(
    startOffset: number,
    endOffset: number,
    type: SourceBufferName | null = null
  ) {
    if (!(startOffset - endOffset)) {
      return;
    }
    // When alternate audio is playing, the audio-stream-controller is responsible for the audio buffer. Otherwise,
    // passing a null type flushes both buffers
    const flushScope: BufferFlushingData = { startOffset, endOffset, type };
    this.hls.trigger(Events.BUFFER_FLUSHING, flushScope);
  }

  protected _loadInitSegment(frag: Fragment, level: Level) {
    this._doFragLoad(frag, level)
      .then((data) => {
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
        if (
          payload &&
          payload.byteLength > 0 &&
          decryptData &&
          decryptData.key &&
          decryptData.iv &&
          decryptData.method === 'AES-128'
        ) {
          const startTime = self.performance.now();
          // decrypt init segment data
          return this.decrypter
            .decrypt(
              new Uint8Array(payload),
              decryptData.key.buffer,
              decryptData.iv.buffer
            )
            .catch((err) => {
              hls.trigger(Events.ERROR, {
                type: ErrorTypes.MEDIA_ERROR,
                details: ErrorDetails.FRAG_DECRYPT_ERROR,
                fatal: false,
                error: err,
                reason: err.message,
                frag,
              });
              throw err;
            })
            .then((decryptedData) => {
              const endTime = self.performance.now();
              hls.trigger(Events.FRAG_DECRYPTED, {
                frag,
                payload: decryptedData,
                stats: {
                  tstart: startTime,
                  tdecrypt: endTime,
                },
              });
              data.payload = decryptedData;

              return data;
            });
        }

        return data;
      })
      .then((data: FragLoadedData) => {
        const { fragCurrent, hls, levels } = this;
        if (!levels) {
          throw new Error('init load aborted, missing levels');
        }

        const stats = frag.stats;
        this.state = State.IDLE;
        level.fragmentError = 0;
        frag.data = new Uint8Array(data.payload);
        stats.parsing.start = stats.buffering.start = self.performance.now();
        stats.parsing.end = stats.buffering.end = self.performance.now();

        // Silence FRAG_BUFFERED event if fragCurrent is null
        if (data.frag === fragCurrent) {
          hls.trigger(Events.FRAG_BUFFERED, {
            stats,
            frag: fragCurrent,
            part: null,
            id: frag.type,
          });
        }
        this.tick();
      })
      .catch((reason) => {
        if (this.state === State.STOPPED || this.state === State.ERROR) {
          return;
        }
        this.warn(reason);
        this.resetFragmentLoading(frag);
      });
  }

  protected fragContextChanged(frag: Fragment | null) {
    const { fragCurrent } = this;
    return (
      !frag ||
      !fragCurrent ||
      frag.level !== fragCurrent.level ||
      frag.sn !== fragCurrent.sn ||
      frag.urlId !== fragCurrent.urlId
    );
  }

  protected fragBufferedComplete(frag: Fragment, part: Part | null) {
    const media = this.mediaBuffer ? this.mediaBuffer : this.media;
    this.log(
      `Buffered ${frag.type} sn: ${frag.sn}${
        part ? ' part: ' + part.index : ''
      } of ${
        this.playlistType === PlaylistLevelType.MAIN ? 'level' : 'track'
      } ${frag.level} (frag:[${(frag.startPTS ?? NaN).toFixed(3)}-${(
        frag.endPTS ?? NaN
      ).toFixed(3)}] > buffer:${
        media
          ? TimeRanges.toString(BufferHelper.getBuffered(media))
          : '(detached)'
      })`
    );
    this.state = State.IDLE;
    if (!media) {
      return;
    }
    if (
      !this.loadedmetadata &&
      frag.type == PlaylistLevelType.MAIN &&
      media.buffered.length &&
      this.fragCurrent?.sn === this.fragPrevious?.sn
    ) {
      this.loadedmetadata = true;
      this.seekToStartPos();
    }
    this.tick();
  }

  protected seekToStartPos() {}

  protected _handleFragmentLoadComplete(fragLoadedEndData: PartsLoadedData) {
    const { transmuxer } = this;
    if (!transmuxer) {
      return;
    }
    const { frag, part, partsLoaded } = fragLoadedEndData;
    // If we did not load parts, or loaded all parts, we have complete (not partial) fragment data
    const complete =
      !partsLoaded ||
      partsLoaded.length === 0 ||
      partsLoaded.some((fragLoaded) => !fragLoaded);
    const chunkMeta = new ChunkMetadata(
      frag.level,
      frag.sn as number,
      frag.stats.chunkCount + 1,
      0,
      part ? part.index : -1,
      !complete
    );
    transmuxer.flush(chunkMeta);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected _handleFragmentLoadProgress(
    frag: PartsLoadedData | FragLoadedData
  ) {}

  protected _doFragLoad(
    frag: Fragment,
    level: Level,
    targetBufferTime: number | null = null,
    progressCallback?: FragmentLoadProgressCallback
  ): Promise<PartsLoadedData | FragLoadedData | null> {
    const details = level?.details;
    if (!this.levels || !details) {
      throw new Error(
        `frag load aborted, missing level${details ? '' : ' detail'}s`
      );
    }

    let keyLoadingPromise: Promise<KeyLoadedData | void> | null = null;
    if (frag.encrypted && !frag.decryptdata?.key) {
      this.log(
        `Loading key for ${frag.sn} of [${details.startSN}-${details.endSN}], ${
          this.logPrefix === '[stream-controller]' ? 'level' : 'track'
        } ${frag.level}`
      );
      this.state = State.KEY_LOADING;
      this.fragCurrent = frag;
      keyLoadingPromise = this.keyLoader.load(frag).then((keyLoadedData) => {
        if (!this.fragContextChanged(keyLoadedData.frag)) {
          this.hls.trigger(Events.KEY_LOADED, keyLoadedData);
          if (this.state === State.KEY_LOADING) {
            this.state = State.IDLE;
          }
          return keyLoadedData;
        }
      });
      this.hls.trigger(Events.KEY_LOADING, { frag });
      if (this.fragCurrent === null) {
        keyLoadingPromise = Promise.reject(
          new Error(`frag load aborted, context changed in KEY_LOADING`)
        );
      }
    } else if (!frag.encrypted && details.encryptedFragments.length) {
      this.keyLoader.loadClear(frag, details.encryptedFragments);
    }

    targetBufferTime = Math.max(frag.start, targetBufferTime || 0);
    if (this.config.lowLatencyMode && frag.sn !== 'initSegment') {
      const partList = details.partList;
      if (partList && progressCallback) {
        if (targetBufferTime > frag.end && details.fragmentHint) {
          frag = details.fragmentHint;
        }
        const partIndex = this.getNextPart(partList, frag, targetBufferTime);
        if (partIndex > -1) {
          const part = partList[partIndex];
          this.log(
            `Loading part sn: ${frag.sn} p: ${part.index} cc: ${
              frag.cc
            } of playlist [${details.startSN}-${
              details.endSN
            }] parts [0-${partIndex}-${partList.length - 1}] ${
              this.logPrefix === '[stream-controller]' ? 'level' : 'track'
            }: ${frag.level}, target: ${parseFloat(
              targetBufferTime.toFixed(3)
            )}`
          );
          this.nextLoadPosition = part.start + part.duration;
          this.state = State.FRAG_LOADING;
          let result: Promise<PartsLoadedData | FragLoadedData | null>;
          if (keyLoadingPromise) {
            result = keyLoadingPromise
              .then((keyLoadedData) => {
                if (
                  !keyLoadedData ||
                  this.fragContextChanged(keyLoadedData.frag)
                ) {
                  return null;
                }
                return this.doFragPartsLoad(
                  frag,
                  part,
                  level,
                  progressCallback
                );
              })
              .catch((error) => this.handleFragLoadError(error));
          } else {
            result = this.doFragPartsLoad(
              frag,
              part,
              level,
              progressCallback
            ).catch((error: LoadError) => this.handleFragLoadError(error));
          }
          this.hls.trigger(Events.FRAG_LOADING, {
            frag,
            part,
            targetBufferTime,
          });
          if (this.fragCurrent === null) {
            return Promise.reject(
              new Error(
                `frag load aborted, context changed in FRAG_LOADING parts`
              )
            );
          }
          return result;
        } else if (
          !frag.url ||
          this.loadedEndOfParts(partList, targetBufferTime)
        ) {
          // Fragment hint has no parts
          return Promise.resolve(null);
        }
      }
    }

    this.log(
      `Loading fragment ${frag.sn} cc: ${frag.cc} ${
        details ? 'of [' + details.startSN + '-' + details.endSN + '] ' : ''
      }${this.logPrefix === '[stream-controller]' ? 'level' : 'track'}: ${
        frag.level
      }, target: ${parseFloat(targetBufferTime.toFixed(3))}`
    );
    // Don't update nextLoadPosition for fragments which are not buffered
    if (Number.isFinite(frag.sn as number) && !this.bitrateTest) {
      this.nextLoadPosition = frag.start + frag.duration;
    }
    this.state = State.FRAG_LOADING;

    // Load key before streaming fragment data
    const dataOnProgress = this.config.progressive;
    let result: Promise<PartsLoadedData | FragLoadedData | null>;
    if (dataOnProgress && keyLoadingPromise) {
      result = keyLoadingPromise
        .then((keyLoadedData) => {
          if (!keyLoadedData || this.fragContextChanged(keyLoadedData?.frag)) {
            return null;
          }
          return this.fragmentLoader.load(frag, progressCallback);
        })
        .catch((error) => this.handleFragLoadError(error));
    } else {
      // load unencrypted fragment data with progress event,
      // or handle fragment result after key and fragment are finished loading
      result = Promise.all([
        this.fragmentLoader.load(
          frag,
          dataOnProgress ? progressCallback : undefined
        ),
        keyLoadingPromise,
      ])
        .then(([fragLoadedData]) => {
          if (!dataOnProgress && fragLoadedData && progressCallback) {
            progressCallback(fragLoadedData);
          }
          return fragLoadedData;
        })
        .catch((error) => this.handleFragLoadError(error));
    }
    this.hls.trigger(Events.FRAG_LOADING, { frag, targetBufferTime });
    if (this.fragCurrent === null) {
      return Promise.reject(
        new Error(`frag load aborted, context changed in FRAG_LOADING`)
      );
    }
    return result;
  }

  private doFragPartsLoad(
    frag: Fragment,
    fromPart: Part,
    level: Level,
    progressCallback: FragmentLoadProgressCallback
  ): Promise<PartsLoadedData | null> {
    return new Promise(
      (resolve: ResolveFragLoaded, reject: RejectFragLoaded) => {
        const partsLoaded: FragLoadedData[] = [];
        const initialPartList = level.details?.partList;
        const loadPart = (part: Part) => {
          this.fragmentLoader
            .loadPart(frag, part, progressCallback)
            .then((partLoadedData: FragLoadedData) => {
              partsLoaded[part.index] = partLoadedData;
              const loadedPart = partLoadedData.part as Part;
              this.hls.trigger(Events.FRAG_LOADED, partLoadedData);
              const nextPart =
                getPartWith(level, frag.sn as number, part.index + 1) ||
                findPart(initialPartList, frag.sn as number, part.index + 1);
              if (nextPart) {
                loadPart(nextPart);
              } else {
                return resolve({
                  frag,
                  part: loadedPart,
                  partsLoaded,
                });
              }
            })
            .catch(reject);
        };
        loadPart(fromPart);
      }
    );
  }

  private handleFragLoadError(error: LoadError | Error) {
    if ('data' in error) {
      const data = error.data;
      if (error.data && data.details === ErrorDetails.INTERNAL_ABORTED) {
        this.handleFragLoadAborted(data.frag, data.part);
      } else {
        this.hls.trigger(Events.ERROR, data as ErrorData);
      }
    } else {
      this.hls.trigger(Events.ERROR, {
        type: ErrorTypes.OTHER_ERROR,
        details: ErrorDetails.INTERNAL_EXCEPTION,
        err: error,
        error,
        fatal: true,
      });
    }
    return null;
  }

  protected _handleTransmuxerFlush(chunkMeta: ChunkMetadata) {
    const context = this.getCurrentContext(chunkMeta);
    if (!context || this.state !== State.PARSING) {
      if (
        !this.fragCurrent &&
        this.state !== State.STOPPED &&
        this.state !== State.ERROR
      ) {
        this.state = State.IDLE;
      }
      return;
    }
    const { frag, part, level } = context;
    const now = self.performance.now();
    frag.stats.parsing.end = now;
    if (part) {
      part.stats.parsing.end = now;
    }
    this.updateLevelTiming(frag, part, level, chunkMeta.partial);
  }

  protected getCurrentContext(
    chunkMeta: ChunkMetadata
  ): { frag: Fragment; part: Part | null; level: Level } | null {
    const { levels, fragCurrent } = this;
    const { level: levelIndex, sn, part: partIndex } = chunkMeta;
    if (!levels?.[levelIndex]) {
      this.warn(
        `Levels object was unset while buffering fragment ${sn} of level ${levelIndex}. The current chunk will not be buffered.`
      );
      return null;
    }
    const level = levels[levelIndex];
    const part = partIndex > -1 ? getPartWith(level, sn, partIndex) : null;
    const frag = part
      ? part.fragment
      : getFragmentWithSN(level, sn, fragCurrent);
    if (!frag) {
      return null;
    }
    if (fragCurrent && fragCurrent !== frag) {
      frag.stats = fragCurrent.stats;
    }
    return { frag, part, level };
  }

  protected bufferFragmentData(
    data: RemuxedTrack,
    frag: Fragment,
    part: Part | null,
    chunkMeta: ChunkMetadata,
    noBacktracking?: boolean
  ) {
    if (!data || this.state !== State.PARSING) {
      return;
    }

    const { data1, data2 } = data;
    let buffer = data1;
    if (data1 && data2) {
      // Combine the moof + mdat so that we buffer with a single append
      buffer = appendUint8Array(data1, data2);
    }

    if (!buffer?.length) {
      return;
    }

    const segment: BufferAppendingData = {
      type: data.type,
      frag,
      part,
      chunkMeta,
      parent: frag.type,
      data: buffer,
    };
    this.hls.trigger(Events.BUFFER_APPENDING, segment);

    if (data.dropped && data.independent && !part) {
      if (noBacktracking) {
        return;
      }
      // Clear buffer so that we reload previous segments sequentially if required
      this.flushBufferGap(frag);
    }
  }

  protected flushBufferGap(frag: Fragment) {
    const media = this.media;
    if (!media) {
      return;
    }
    // If currentTime is not buffered, clear the back buffer so that we can backtrack as much as needed
    if (!BufferHelper.isBuffered(media, media.currentTime)) {
      this.flushMainBuffer(0, frag.start);
      return;
    }
    // Remove back-buffer without interrupting playback to allow back tracking
    const currentTime = media.currentTime;
    const bufferInfo = BufferHelper.bufferInfo(media, currentTime, 0);
    const fragDuration = frag.duration;
    const segmentFraction = Math.min(
      this.config.maxFragLookUpTolerance * 2,
      fragDuration * 0.25
    );
    const start = Math.max(
      Math.min(frag.start - segmentFraction, bufferInfo.end - segmentFraction),
      currentTime + segmentFraction
    );
    if (frag.start - start > segmentFraction) {
      this.flushMainBuffer(start, frag.start);
    }
  }

  protected getFwdBufferInfo(
    bufferable: Bufferable | null,
    type: PlaylistLevelType
  ): BufferInfo | null {
    const pos = this.getLoadPosition();
    if (!Number.isFinite(pos)) {
      return null;
    }
    return this.getFwdBufferInfoAtPos(bufferable, pos, type);
  }

  protected getFwdBufferInfoAtPos(
    bufferable: Bufferable | null,
    pos: number,
    type: PlaylistLevelType
  ): BufferInfo | null {
    const {
      config: { maxBufferHole },
    } = this;
    const bufferInfo = BufferHelper.bufferInfo(bufferable, pos, maxBufferHole);
    // Workaround flaw in getting forward buffer when maxBufferHole is smaller than gap at current pos
    if (bufferInfo.len === 0 && bufferInfo.nextStart !== undefined) {
      const bufferedFragAtPos = this.fragmentTracker.getBufferedFrag(pos, type);
      if (bufferedFragAtPos && bufferInfo.nextStart < bufferedFragAtPos.end) {
        return BufferHelper.bufferInfo(
          bufferable,
          pos,
          Math.max(bufferInfo.nextStart, maxBufferHole)
        );
      }
    }
    return bufferInfo;
  }

  protected getMaxBufferLength(levelBitrate?: number): number {
    const { config } = this;
    let maxBufLen;
    if (levelBitrate) {
      maxBufLen = Math.max(
        (8 * config.maxBufferSize) / levelBitrate,
        config.maxBufferLength
      );
    } else {
      maxBufLen = config.maxBufferLength;
    }
    return Math.min(maxBufLen, config.maxMaxBufferLength);
  }

  protected reduceMaxBufferLength(threshold: number) {
    const config = this.config;
    const minLength = threshold || config.maxBufferLength;
    if (config.maxMaxBufferLength >= minLength) {
      // reduce max buffer length as it might be too high. we do this to avoid loop flushing ...
      config.maxMaxBufferLength /= 2;
      this.warn(`Reduce max buffer length to ${config.maxMaxBufferLength}s`);
      return true;
    }
    return false;
  }

  protected getAppendedFrag(
    position: number,
    playlistType: PlaylistLevelType = PlaylistLevelType.MAIN
  ): Fragment | null {
    const fragOrPart = this.fragmentTracker.getAppendedFrag(
      position,
      PlaylistLevelType.MAIN
    );
    if (fragOrPart && 'fragment' in fragOrPart) {
      return fragOrPart.fragment;
    }
    return fragOrPart;
  }

  protected getNextFragment(
    pos: number,
    levelDetails: LevelDetails
  ): Fragment | null {
    const fragments = levelDetails.fragments;
    const fragLen = fragments.length;

    if (!fragLen) {
      return null;
    }

    // find fragment index, contiguous with end of buffer position
    const { config } = this;
    const start = fragments[0].start;
    let frag;

    if (levelDetails.live) {
      const initialLiveManifestSize = config.initialLiveManifestSize;
      if (fragLen < initialLiveManifestSize) {
        this.warn(
          `Not enough fragments to start playback (have: ${fragLen}, need: ${initialLiveManifestSize})`
        );
        return null;
      }
      // The real fragment start times for a live stream are only known after the PTS range for that level is known.
      // In order to discover the range, we load the best matching fragment for that level and demux it.
      // Do not load using live logic if the starting frag is requested - we want to use getFragmentAtPosition() so that
      // we get the fragment matching that start time
      if (
        !levelDetails.PTSKnown &&
        !this.startFragRequested &&
        this.startPosition === -1
      ) {
        frag = this.getInitialLiveFragment(levelDetails, fragments);
        this.startPosition = frag
          ? this.hls.liveSyncPosition || frag.start
          : pos;
      }
    } else if (pos <= start) {
      // VoD playlist: if loadPosition before start of playlist, load first fragment
      frag = fragments[0];
    }

    // If we haven't run into any special cases already, just load the fragment most closely matching the requested position
    if (!frag) {
      const end = config.lowLatencyMode
        ? levelDetails.partEnd
        : levelDetails.fragmentEnd;
      frag = this.getFragmentAtPosition(pos, end, levelDetails);
    }

    return this.mapToInitFragWhenRequired(frag);
  }

  protected isLoopLoading(frag: Fragment, targetBufferTime: number): boolean {
    const trackerState = this.fragmentTracker.getState(frag);
    return (
      (trackerState === FragmentState.OK ||
        (trackerState === FragmentState.PARTIAL && !!frag.gap)) &&
      this.nextLoadPosition > targetBufferTime
    );
  }

  protected getNextFragmentLoopLoading(
    frag: Fragment,
    levelDetails: LevelDetails,
    bufferInfo: BufferInfo,
    playlistType: PlaylistLevelType,
    maxBufLen: number
  ): Fragment | null {
    const gapStart = frag.gap;
    const nextFragment = this.getNextFragment(
      this.nextLoadPosition,
      levelDetails
    );
    if (nextFragment === null) {
      return nextFragment;
    }
    frag = nextFragment;
    if (gapStart && frag && !frag.gap && bufferInfo.nextStart) {
      // Media buffered after GAP tags should not make the next buffer timerange exceed forward buffer length
      const nextbufferInfo = this.getFwdBufferInfoAtPos(
        this.mediaBuffer ? this.mediaBuffer : this.media,
        bufferInfo.nextStart,
        playlistType
      );
      if (
        nextbufferInfo !== null &&
        bufferInfo.len + nextbufferInfo.len >= maxBufLen
      ) {
        // Returning here might result in not finding an audio and video candiate to skip to
        this.log(
          `buffer full after gaps in "${playlistType}" playlist starting at sn: ${frag.sn}`
        );
        return null;
      }
    }
    return frag;
  }

  mapToInitFragWhenRequired(frag: Fragment | null): typeof frag {
    // If an initSegment is present, it must be buffered first
    if (frag?.initSegment && !frag?.initSegment.data && !this.bitrateTest) {
      return frag.initSegment;
    }

    return frag;
  }

  getNextPart(
    partList: Part[],
    frag: Fragment,
    targetBufferTime: number
  ): number {
    let nextPart = -1;
    let contiguous = false;
    let independentAttrOmitted = true;
    for (let i = 0, len = partList.length; i < len; i++) {
      const part = partList[i];
      independentAttrOmitted = independentAttrOmitted && !part.independent;
      if (nextPart > -1 && targetBufferTime < part.start) {
        break;
      }
      const loaded = part.loaded;
      if (loaded) {
        nextPart = -1;
      } else if (
        (contiguous || part.independent || independentAttrOmitted) &&
        part.fragment === frag
      ) {
        nextPart = i;
      }
      contiguous = loaded;
    }
    return nextPart;
  }

  private loadedEndOfParts(
    partList: Part[],
    targetBufferTime: number
  ): boolean {
    const lastPart = partList[partList.length - 1];
    return lastPart && targetBufferTime > lastPart.start && lastPart.loaded;
  }

  /*
   This method is used find the best matching first fragment for a live playlist. This fragment is used to calculate the
   "sliding" of the playlist, which is its offset from the start of playback. After sliding we can compute the real
   start and end times for each fragment in the playlist (after which this method will not need to be called).
  */
  protected getInitialLiveFragment(
    levelDetails: LevelDetails,
    fragments: Array<Fragment>
  ): Fragment | null {
    const fragPrevious = this.fragPrevious;
    let frag: Fragment | null = null;
    if (fragPrevious) {
      if (levelDetails.hasProgramDateTime) {
        // Prefer using PDT, because it can be accurate enough to choose the correct fragment without knowing the level sliding
        this.log(
          `Live playlist, switching playlist, load frag with same PDT: ${fragPrevious.programDateTime}`
        );
        frag = findFragmentByPDT(
          fragments,
          fragPrevious.endProgramDateTime,
          this.config.maxFragLookUpTolerance
        );
      }
      if (!frag) {
        // SN does not need to be accurate between renditions, but depending on the packaging it may be so.
        const targetSN = (fragPrevious.sn as number) + 1;
        if (
          targetSN >= levelDetails.startSN &&
          targetSN <= levelDetails.endSN
        ) {
          const fragNext = fragments[targetSN - levelDetails.startSN];
          // Ensure that we're staying within the continuity range, since PTS resets upon a new range
          if (fragPrevious.cc === fragNext.cc) {
            frag = fragNext;
            this.log(
              `Live playlist, switching playlist, load frag with next SN: ${
                frag!.sn
              }`
            );
          }
        }
        // It's important to stay within the continuity range if available; otherwise the fragments in the playlist
        // will have the wrong start times
        if (!frag) {
          frag = findFragWithCC(fragments, fragPrevious.cc);
          if (frag) {
            this.log(
              `Live playlist, switching playlist, load frag with same CC: ${frag.sn}`
            );
          }
        }
      }
    } else {
      // Find a new start fragment when fragPrevious is null
      const liveStart = this.hls.liveSyncPosition;
      if (liveStart !== null) {
        frag = this.getFragmentAtPosition(
          liveStart,
          this.bitrateTest ? levelDetails.fragmentEnd : levelDetails.edge,
          levelDetails
        );
      }
    }

    return frag;
  }

  /*
  This method finds the best matching fragment given the provided position.
   */
  protected getFragmentAtPosition(
    bufferEnd: number,
    end: number,
    levelDetails: LevelDetails
  ): Fragment | null {
    const { config } = this;
    let { fragPrevious } = this;
    let { fragments, endSN } = levelDetails;
    const { fragmentHint } = levelDetails;
    const tolerance = config.maxFragLookUpTolerance;
    const partList = levelDetails.partList;

    const loadingParts = !!(
      config.lowLatencyMode &&
      partList?.length &&
      fragmentHint
    );
    if (loadingParts && fragmentHint && !this.bitrateTest) {
      // Include incomplete fragment with parts at end
      fragments = fragments.concat(fragmentHint);
      endSN = fragmentHint.sn as number;
    }

    let frag;
    if (bufferEnd < end) {
      const lookupTolerance = bufferEnd > end - tolerance ? 0 : tolerance;
      // Remove the tolerance if it would put the bufferEnd past the actual end of stream
      // Uses buffer and sequence number to calculate switch segment (required if using EXT-X-DISCONTINUITY-SEQUENCE)
      frag = findFragmentByPTS(
        fragPrevious,
        fragments,
        bufferEnd,
        lookupTolerance
      );
    } else {
      // reach end of playlist
      frag = fragments[fragments.length - 1];
    }

    if (frag) {
      const curSNIdx = frag.sn - levelDetails.startSN;
      // Move fragPrevious forward to support forcing the next fragment to load
      // when the buffer catches up to a previously buffered range.
      const fragState = this.fragmentTracker.getState(frag);
      if (
        fragState === FragmentState.OK ||
        (fragState === FragmentState.PARTIAL && frag.gap)
      ) {
        fragPrevious = frag;
      }
      if (
        fragPrevious &&
        frag.sn === fragPrevious.sn &&
        (!loadingParts || partList[0].fragment.sn > frag.sn)
      ) {
        // Force the next fragment to load if the previous one was already selected. This can occasionally happen with
        // non-uniform fragment durations
        const sameLevel = fragPrevious && frag.level === fragPrevious.level;
        if (sameLevel) {
          const nextFrag = fragments[curSNIdx + 1];
          if (
            frag.sn < endSN &&
            this.fragmentTracker.getState(nextFrag) !== FragmentState.OK
          ) {
            frag = nextFrag;
          } else {
            frag = null;
          }
        }
      }
    }
    return frag;
  }

  protected synchronizeToLiveEdge(levelDetails: LevelDetails) {
    const { config, media } = this;
    if (!media) {
      return;
    }
    const liveSyncPosition = this.hls.liveSyncPosition;
    const currentTime = media.currentTime;
    const start = levelDetails.fragments[0].start;
    const end = levelDetails.edge;
    const withinSlidingWindow =
      currentTime >= start - config.maxFragLookUpTolerance &&
      currentTime <= end;
    // Continue if we can seek forward to sync position or if current time is outside of sliding window
    if (
      liveSyncPosition !== null &&
      media.duration > liveSyncPosition &&
      (currentTime < liveSyncPosition || !withinSlidingWindow)
    ) {
      // Continue if buffer is starving or if current time is behind max latency
      const maxLatency =
        config.liveMaxLatencyDuration !== undefined
          ? config.liveMaxLatencyDuration
          : config.liveMaxLatencyDurationCount * levelDetails.targetduration;
      if (
        (!withinSlidingWindow && media.readyState < 4) ||
        currentTime < end - maxLatency
      ) {
        if (!this.loadedmetadata) {
          this.nextLoadPosition = liveSyncPosition;
        }
        // Only seek if ready and there is not a significant forward buffer available for playback
        if (media.readyState) {
          this.warn(
            `Playback: ${currentTime.toFixed(
              3
            )} is located too far from the end of live sliding playlist: ${end}, reset currentTime to : ${liveSyncPosition.toFixed(
              3
            )}`
          );
          media.currentTime = liveSyncPosition;
        }
      }
    }
  }

  protected alignPlaylists(
    details: LevelDetails,
    previousDetails?: LevelDetails
  ): number {
    const { levels, levelLastLoaded, fragPrevious } = this;
    const lastLevel: Level | null =
      levelLastLoaded !== null ? levels![levelLastLoaded] : null;

    // FIXME: If not for `shouldAlignOnDiscontinuities` requiring fragPrevious.cc,
    //  this could all go in level-helper mergeDetails()
    const length = details.fragments.length;
    if (!length) {
      this.warn(`No fragments in live playlist`);
      return 0;
    }
    const slidingStart = details.fragments[0].start;
    const firstLevelLoad = !previousDetails;
    const aligned = details.alignedSliding && Number.isFinite(slidingStart);
    if (firstLevelLoad || (!aligned && !slidingStart)) {
      alignStream(fragPrevious, lastLevel, details);
      const alignedSlidingStart = details.fragments[0].start;
      this.log(
        `Live playlist sliding: ${alignedSlidingStart.toFixed(2)} start-sn: ${
          previousDetails ? previousDetails.startSN : 'na'
        }->${details.startSN} prev-sn: ${
          fragPrevious ? fragPrevious.sn : 'na'
        } fragments: ${length}`
      );
      return alignedSlidingStart;
    }
    return slidingStart;
  }

  protected waitForCdnTuneIn(details: LevelDetails) {
    // Wait for Low-Latency CDN Tune-in to get an updated playlist
    const advancePartLimit = 3;
    return (
      details.live &&
      details.canBlockReload &&
      details.partTarget &&
      details.tuneInGoal >
        Math.max(details.partHoldBack, details.partTarget * advancePartLimit)
    );
  }

  protected setStartPosition(details: LevelDetails, sliding: number) {
    // compute start position if set to -1. use it straight away if value is defined
    let startPosition = this.startPosition;
    if (startPosition < sliding) {
      startPosition = -1;
    }
    if (startPosition === -1 || this.lastCurrentTime === -1) {
      // Use Playlist EXT-X-START:TIME-OFFSET when set
      // Prioritize Multivariant Playlist offset so that main, audio, and subtitle stream-controller start times match
      const offsetInMultivariantPlaylist = this.startTimeOffset !== null;
      const startTimeOffset = offsetInMultivariantPlaylist
        ? this.startTimeOffset
        : details.startTimeOffset;
      if (startTimeOffset !== null && Number.isFinite(startTimeOffset)) {
        startPosition = sliding + startTimeOffset;
        if (startTimeOffset < 0) {
          startPosition += details.totalduration;
        }
        startPosition = Math.min(
          Math.max(sliding, startPosition),
          sliding + details.totalduration
        );
        this.log(
          `Start time offset ${startTimeOffset} found in ${
            offsetInMultivariantPlaylist ? 'multivariant' : 'media'
          } playlist, adjust startPosition to ${startPosition}`
        );
        this.startPosition = startPosition;
      } else if (details.live) {
        // Leave this.startPosition at -1, so that we can use `getInitialLiveFragment` logic when startPosition has
        // not been specified via the config or an as an argument to startLoad (#3736).
        startPosition = this.hls.liveSyncPosition || sliding;
      } else {
        this.startPosition = startPosition = 0;
      }
      this.lastCurrentTime = startPosition;
    }
    this.nextLoadPosition = startPosition;
  }

  protected getLoadPosition(): number {
    const { media } = this;
    // if we have not yet loaded any fragment, start loading from start position
    let pos = 0;
    if (this.loadedmetadata && media) {
      pos = media.currentTime;
    } else if (this.nextLoadPosition) {
      pos = this.nextLoadPosition;
    }

    return pos;
  }

  private handleFragLoadAborted(frag: Fragment, part: Part | undefined) {
    if (this.transmuxer && frag.sn !== 'initSegment' && frag.stats.aborted) {
      this.warn(
        `Fragment ${frag.sn}${part ? ' part ' + part.index : ''} of level ${
          frag.level
        } was aborted`
      );
      this.resetFragmentLoading(frag);
    }
  }

  protected resetFragmentLoading(frag: Fragment) {
    if (
      !this.fragCurrent ||
      (!this.fragContextChanged(frag) &&
        this.state !== State.FRAG_LOADING_WAITING_RETRY)
    ) {
      this.state = State.IDLE;
    }
  }

  protected onFragmentOrKeyLoadError(
    filterType: PlaylistLevelType,
    data: ErrorData
  ) {
    if (data.chunkMeta && !data.frag) {
      const context = this.getCurrentContext(data.chunkMeta);
      if (context) {
        data.frag = context.frag;
      }
    }
    const frag = data.frag;
    // Handle frag error related to caller's filterType
    if (!frag || frag.type !== filterType || !this.levels) {
      return;
    }
    if (this.fragContextChanged(frag)) {
      this.warn(
        `Frag load error must match current frag to retry ${frag.url} > ${this.fragCurrent?.url}`
      );
      return;
    }
    const gapTagEncountered = data.details === ErrorDetails.FRAG_GAP;
    if (gapTagEncountered) {
      this.fragmentTracker.fragBuffered(frag, true);
    }
    // keep retrying until the limit will be reached
    const errorAction = data.errorAction;
    const { action, retryCount = 0, retryConfig } = errorAction || {};
    if (
      errorAction &&
      action === NetworkErrorAction.RetryRequest &&
      retryConfig
    ) {
      this.resetStartWhenNotLoaded(this.levelLastLoaded ?? frag.level);
      const delay = getRetryDelay(retryConfig, retryCount);
      this.warn(
        `Fragment ${frag.sn} of ${filterType} ${frag.level} errored with ${
          data.details
        }, retrying loading ${retryCount + 1}/${
          retryConfig.maxNumRetry
        } in ${delay}ms`
      );
      errorAction.resolved = true;
      this.retryDate = self.performance.now() + delay;
      this.state = State.FRAG_LOADING_WAITING_RETRY;
    } else if (retryConfig && errorAction) {
      this.resetFragmentErrors(filterType);
      if (retryCount < retryConfig.maxNumRetry) {
        // Network retry is skipped when level switch is preferred
        if (!gapTagEncountered) {
          errorAction.resolved = true;
        }
      } else {
        logger.warn(
          `${data.details} reached or exceeded max retry (${retryCount})`
        );
      }
    } else if (
      errorAction?.action === NetworkErrorAction.SendAlternateToPenaltyBox
    ) {
      this.state = State.WAITING_LEVEL;
    } else {
      this.state = State.ERROR;
    }
    // Perform next async tick sooner to speed up error action resolution
    this.tickImmediate();
  }

  protected reduceLengthAndFlushBuffer(data: ErrorData): boolean {
    // if in appending state
    if (this.state === State.PARSING || this.state === State.PARSED) {
      const playlistType = data.parent as PlaylistLevelType;
      const bufferedInfo = this.getFwdBufferInfo(
        this.mediaBuffer,
        playlistType
      );
      // 0.5 : tolerance needed as some browsers stalls playback before reaching buffered end
      // reduce max buf len if current position is buffered
      const buffered = bufferedInfo && bufferedInfo.len > 0.5;
      if (buffered) {
        this.reduceMaxBufferLength(bufferedInfo.len);
      }
      const flushBuffer = !buffered;
      if (flushBuffer) {
        // current position is not buffered, but browser is still complaining about buffer full error
        // this happens on IE/Edge, refer to https://github.com/video-dev/hls.js/pull/708
        // in that case flush the whole audio buffer to recover
        this.warn(
          `Buffer full error while media.currentTime is not buffered, flush ${playlistType} buffer`
        );
      }
      if (data.frag) {
        this.fragmentTracker.removeFragment(data.frag);
        this.nextLoadPosition = data.frag.start;
      }
      this.resetLoadingState();
      return flushBuffer;
    }
    return false;
  }

  protected resetFragmentErrors(filterType: PlaylistLevelType) {
    if (filterType === PlaylistLevelType.AUDIO) {
      // Reset current fragment since audio track audio is essential and may not have a fail-over track
      this.fragCurrent = null;
    }
    // Fragment errors that result in a level switch or redundant fail-over
    // should reset the stream controller state to idle
    if (!this.loadedmetadata) {
      this.startFragRequested = false;
    }
    if (this.state !== State.STOPPED) {
      this.state = State.IDLE;
    }
  }

  protected afterBufferFlushed(
    media: Bufferable,
    bufferType: SourceBufferName,
    playlistType: PlaylistLevelType
  ) {
    if (!media) {
      return;
    }
    // After successful buffer flushing, filter flushed fragments from bufferedFrags use mediaBuffered instead of media
    // (so that we will check against video.buffered ranges in case of alt audio track)
    const bufferedTimeRanges = BufferHelper.getBuffered(media);
    this.fragmentTracker.detectEvictedFragments(
      bufferType,
      bufferedTimeRanges,
      playlistType
    );
    if (this.state === State.ENDED) {
      this.resetLoadingState();
    }
  }

  protected resetLoadingState() {
    this.log('Reset loading state');
    this.fragCurrent = null;
    this.fragPrevious = null;
    this.state = State.IDLE;
  }

  protected resetStartWhenNotLoaded(level: number): void {
    // if loadedmetadata is not set, it means that first frag request failed
    // in that case, reset startFragRequested flag
    if (!this.loadedmetadata) {
      this.startFragRequested = false;
      const details = this.levels ? this.levels[level].details : null;
      if (details?.live) {
        // Update the start position and return to IDLE to recover live start
        this.startPosition = -1;
        this.setStartPosition(details, 0);
        this.resetLoadingState();
      } else {
        this.nextLoadPosition = this.startPosition;
      }
    }
  }

  protected resetWhenMissingContext(chunkMeta: ChunkMetadata) {
    this.warn(
      `The loading context changed while buffering fragment ${chunkMeta.sn} of level ${chunkMeta.level}. This chunk will not be buffered.`
    );
    this.removeUnbufferedFrags();
    this.resetStartWhenNotLoaded(this.levelLastLoaded ?? chunkMeta.level);
    this.resetLoadingState();
  }

  protected removeUnbufferedFrags(start: number = 0) {
    this.fragmentTracker.removeFragmentsInRange(
      start,
      Infinity,
      this.playlistType,
      false,
      true
    );
  }

  private updateLevelTiming(
    frag: Fragment,
    part: Part | null,
    level: Level,
    partial: boolean
  ) {
    const details = level.details as LevelDetails;
    if (!details) {
      this.warn('level.details undefined');
      return;
    }
    const parsed = Object.keys(frag.elementaryStreams).reduce(
      (result, type) => {
        const info = frag.elementaryStreams[type];
        if (info) {
          const parsedDuration = info.endPTS - info.startPTS;
          if (parsedDuration <= 0) {
            // Destroy the transmuxer after it's next time offset failed to advance because duration was <= 0.
            // The new transmuxer will be configured with a time offset matching the next fragment start,
            // preventing the timeline from shifting.
            this.warn(
              `Could not parse fragment ${frag.sn} ${type} duration reliably (${parsedDuration})`
            );
            return result || false;
          }
          const drift = partial
            ? 0
            : updateFragPTSDTS(
                details,
                frag,
                info.startPTS,
                info.endPTS,
                info.startDTS,
                info.endDTS
              );
          this.hls.trigger(Events.LEVEL_PTS_UPDATED, {
            details,
            level,
            drift,
            type,
            frag,
            start: info.startPTS,
            end: info.endPTS,
          });
          return true;
        }
        return result;
      },
      false
    );
    if (parsed) {
      level.fragmentError = 0;
    } else if (this.transmuxer?.error === null) {
      const error = new Error(
        `Found no media in fragment ${frag.sn} of level ${frag.level} resetting transmuxer to fallback to playlist timing`
      );
      if (level.fragmentError === 0) {
        // Mark and track the odd empty segment as a gap to avoid reloading
        level.fragmentError++;
        frag.gap = true;
        this.fragmentTracker.removeFragment(frag);
        this.fragmentTracker.fragBuffered(frag, true);
      }
      this.warn(error.message);
      this.hls.trigger(Events.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.FRAG_PARSING_ERROR,
        fatal: false,
        error,
        frag,
        reason: `Found no media in msn ${frag.sn} of level "${level.url}"`,
      });
      if (!this.hls) {
        return;
      }
      this.resetTransmuxer();
      // For this error fallthrough. Marking parsed will allow advancing to next fragment.
    }
    this.state = State.PARSED;
    this.hls.trigger(Events.FRAG_PARSED, { frag, part });
  }

  protected resetTransmuxer() {
    if (this.transmuxer) {
      this.transmuxer.destroy();
      this.transmuxer = null;
    }
  }

  protected recoverWorkerError(data: ErrorData) {
    if (data.event === 'demuxerWorker') {
      this.fragmentTracker.removeAllFragments();
      this.resetTransmuxer();
      this.resetStartWhenNotLoaded(
        this.levelLastLoaded ?? this.fragCurrent?.level ?? 0
      );
      this.resetLoadingState();
    }
  }

  set state(nextState) {
    const previousState = this._state;
    if (previousState !== nextState) {
      this._state = nextState;
      this.log(`${previousState}->${nextState}`);
    }
  }

  get state() {
    return this._state;
  }
}
