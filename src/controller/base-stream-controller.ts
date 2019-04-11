import TaskLoop from '../task-loop';
import { FragmentState } from './fragment-tracker';
import { BufferHelper } from '../utils/buffer-helper';
import { logger } from '../utils/logger';
import Event from '../events';
import { ErrorDetails } from '../errors';
import Fragment from '../loader/fragment';
import TransmuxerInterface from '../demux/transmuxer-interface';
import FragmentLoader, { FragLoadSuccessResult, FragmentLoadProgressCallback } from '../loader/fragment-loader';

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
  BUFFER_FLUSHING: 'BUFFER_FLUSHING',
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
    const { config, media, mediaBuffer, state } = this;
    const currentTime = media ? media.currentTime : null;
    const bufferInfo = BufferHelper.bufferInfo(mediaBuffer || media, currentTime, this.config.maxBufferHole);

    if (Number.isFinite(currentTime)) {
      this.log(`media seeking to ${currentTime.toFixed(3)}`);
    }

    if (state === State.FRAG_LOADING) {
      let fragCurrent = this.fragCurrent;
      // check if we are seeking to a unbuffered area AND if frag loading is in progress
      if (bufferInfo.len === 0 && fragCurrent) {
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
        } else {
          this.log('seeking outside of buffer but within currently loaded fragment range');
        }
      }
    } else if (state === State.ENDED) {
      // if seeking to unbuffered area, clean up fragPrevious
      if (bufferInfo.len === 0) {
        this.fragPrevious = null;
        this.fragCurrent = null;
      }

      // switch to IDLE state to check for potential new fragment
      this.state = State.IDLE;
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
    const progressCallback: FragmentLoadProgressCallback = ({ stats, payload }) => {
      if (this._fragLoadAborted(frag)) {
        logger.warn(`Fragment ${frag.sn} of level ${frag.level} was aborted during progressive download.`);
        return;
      }
      this._handleFragmentLoadProgress(frag, payload, stats);
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
        this._handleFragmentLoadComplete(frag);
      });
  }

  protected _loadInitSegment (frag) {
    this._doFragLoad(frag)
      .then((data: FragLoadSuccessResult) => {
        const { stats, payload } = data;
        const { fragCurrent, hls, levels } = this;
        if (!data || this._fragLoadAborted(frag) || !levels) {
          return;
        }
        this.state = State.IDLE;
        this.fragLoadError = 0;
        levels[frag.level].details.initSegment.data = payload;
        stats.tparsed = stats.tbuffered = window.performance.now();
        hls.trigger(Event.FRAG_BUFFERED, { stats: stats, frag: fragCurrent, id: 'main' });
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

  protected _handleFragmentLoadComplete (frag) {
    const { transmuxer } = this;
    if (!transmuxer) {
      return;
    }
    transmuxer.flush({ level: frag.level, sn: frag.sn });
  }

  protected _handleFragmentLoadProgress (frag, payload, stats) {}

  protected _doFragLoad (frag, progressCallback?: FragmentLoadProgressCallback) {
    this.state = State.FRAG_LOADING;
    this.hls.trigger(Event.FRAG_LOADING, { frag });

    const errorHandler = (e) => {
      const errorData = e ? e.data : null;
      if (errorData && errorData.details === ErrorDetails.INTERNAL_ABORTED) {
        const fragPrev = this.fragPrevious;
        if (fragPrev) {
          this.nextLoadPosition = fragPrev.start + fragPrev.duration;
        } else {
          this.nextLoadPosition = this.lastCurrentTime;
        }
        this.log(`Frag load aborted, resetting nextLoadPosition to ${this.nextLoadPosition}`);
        return;
      }
      this.hls.trigger(Event.ERROR, errorData);
    };

    // TODO: Allow progressive downloading of encrypted streams after the decrypter can handle progressive decryption
    if (frag.decryptdata && frag.decryptdata.key && progressCallback) {
      return this.fragmentLoader.load(frag)
        .then((data: FragLoadSuccessResult) => {
          progressCallback(data);
          return data;
        })
        .catch(errorHandler);
    } else {
      return this.fragmentLoader.load(frag, progressCallback)
        .catch(errorHandler);
    }
  }

  protected log (msg) {
    logger.log(`${this.logPrefix}: ${msg}`);
  }

  protected warn (msg) {
    logger.warn(`${this.logPrefix}: ${msg}`);
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
}
