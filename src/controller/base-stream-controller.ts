import TaskLoop from '../task-loop';
import { FragmentState } from './fragment-tracker';
import { BufferHelper } from '../utils/buffer-helper';
import { logger } from '../utils/logger';
import Event from '../events';
import { ErrorDetails } from '../errors';
import Fragment from '../loader/fragment';
import TransmuxerInterface from '../demux/transmuxer-interface';
import FragmentLoader, { FragLoadSuccessResult, FragmentLoadProgressCallback } from '../loader/fragment-loader';
import * as LevelHelper from './level-helper';
import { TransmuxIdentifier } from '../types/transmuxer';
import { appendUint8Array } from '../utils/mp4-tools';

export const State = {
  STOPPED: 'STOPPED',
  STARTING: 'STARTING',
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
  protected fragPrevious: Fragment | null = null;
  protected fragCurrent: Fragment | null = null;
  protected fragmentTracker: any;
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
  protected levels: Array<any> | null = null;
  protected fragmentLoader!: FragmentLoader;

  protected readonly logPrefix: string = '';

  protected doTick () {}

  public startLoad (startPosition: number) : void {}

  public stopLoad () {
    let frag = this.fragCurrent;
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
    this.fragmentTracker = null;
  }

  protected _loadFragForPlayback (frag) {
    const progressCallback: FragmentLoadProgressCallback = ({ payload }) => {
      if (this._fragLoadAborted(frag)) {
        this.warn(`Fragment ${frag.sn} of level ${frag.level} was aborted during progressive download.`);
        this.fragmentTracker.removeFragment(frag);
        return;
      }
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
        this.hls.trigger(Event.FRAG_LOADED, compatibilityEventData);
        // Pass through the whole payload; controllers not implementing progressive loading receive data from this callback
        this._handleFragmentLoadComplete(frag, data.payload);
      });
  }

  protected _loadInitSegment (frag) {
    this._doFragLoad(frag)
      .then((data: FragLoadSuccessResult) => {
        const { fragCurrent, hls, levels } = this;
        if (!data || this._fragLoadAborted(frag) || !levels) {
          return;
        }
        const { payload } = data;
        const stats = frag.stats;
        this.state = State.IDLE;
        this.fragLoadError = 0;
        levels[frag.level].details.initSegment.data = payload;
        stats.tparsed = stats.tbuffered = window.performance.now();
        // TODO: set id from calling class
        hls.trigger(Event.FRAG_BUFFERED, { stats, frag: fragCurrent, id: frag.type });
        this.tick();
      });
  }

  protected _fragLoadAborted (frag) {
    const { fragCurrent } = this;
    if (!frag || !fragCurrent) {
      return true;
    }
    return frag.level !== fragCurrent.level || frag.sn !== fragCurrent.sn;
  }

  protected _handleFragmentLoadComplete (frag, payload?: ArrayBuffer) {
    const { transmuxer } = this;
    if (!transmuxer) {
      return;
    }
    transmuxer.flush({ level: frag.level, sn: frag.sn });
  }

  protected _handleFragmentLoadProgress (frag, payload) {}

  protected _doFragLoad (frag, progressCallback?: FragmentLoadProgressCallback) {
    this.state = State.FRAG_LOADING;
    this.hls.trigger(Event.FRAG_LOADING, { frag });

    const errorHandler = (e) => {
      const errorData = e ? e.data : null;
      if (errorData && errorData.details === ErrorDetails.INTERNAL_ABORTED) {
        this.handleFragLoadAborted(frag);
        return;
      }
      this.hls.trigger(Event.ERROR, errorData);
    };

    return this.fragmentLoader.load(frag, progressCallback)
      .catch(errorHandler);
  }

  protected _handleTransmuxerFlush (identifier: TransmuxIdentifier) {
    if (this.state !== State.PARSING) {
      this.warn(`State is expected to be PARSING on transmuxer flush, but is ${this.state}.`);
      return;
    }

    const context = this.getCurrentContext(identifier);
    if (!context) {
      return;
    }
    const { frag, level } = context;
    frag.stats.tparsed = window.performance.now();

    this.updateLevelTiming(frag, level);
    this.state = State.PARSED;
    this.hls.trigger(Event.FRAG_PARSED, { frag });
  }

  protected getCurrentContext (identifier: TransmuxIdentifier) : { frag: Fragment, level: any } | null {
    const { fragCurrent, levels } = this;
    const { level, sn } = identifier;
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

  // TODO: Emit moof+mdat as a single Uint8 instead of data1 & data2
  protected bufferFragmentData (data, parent) {
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

    this.hls.trigger(Event.BUFFER_APPENDING, { type: data.type, data: buffer, parent, content: 'data' });
    this.tick();
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
      transmuxer.flush({ sn: frag.sn, level: frag.level });
    }

    Object.keys(frag.elementaryStreams).forEach(type => frag.elementaryStreams[type] = null);
    this.log(`Fragment ${frag.sn} of level ${frag.level} was aborted, flushing transmuxer & resetting nextLoadPosition to ${this.nextLoadPosition}`);
  }

  private updateLevelTiming (frag, currentLevel) {
    const { details } = currentLevel;
    Object.keys(frag.elementaryStreams).forEach(type => {
      const info = frag.elementaryStreams[type];
      if (info) {
        const drift = LevelHelper.updateFragPTSDTS(details, frag, info.startPTS, info.endPTS, info.startDTS, info.endDTS);
        this.hls.trigger(Event.LEVEL_PTS_UPDATED, {
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
    if (this.state !== nextState) {
      const previousState = this.state;
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
