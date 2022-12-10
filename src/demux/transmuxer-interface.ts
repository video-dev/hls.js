import work from './webworkify-webpack';
import { Events } from '../events';
import Transmuxer, {
  TransmuxConfig,
  TransmuxState,
  isPromise,
} from '../demux/transmuxer';
import { logger } from '../utils/logger';
import { ErrorTypes, ErrorDetails } from '../errors';
import { getMediaSource } from '../utils/mediasource-helper';
import { EventEmitter } from 'eventemitter3';
import { Fragment, Part } from '../loader/fragment';
import type { ChunkMetadata, TransmuxerResult } from '../types/transmuxer';
import type Hls from '../hls';
import type { HlsEventEmitter } from '../events';
import type { PlaylistLevelType } from '../types/loader';
import type { TypeSupported } from './tsdemuxer';

const MediaSource = getMediaSource() || { isTypeSupported: () => false };

export default class TransmuxerInterface {
  private hls: Hls;
  private id: PlaylistLevelType;
  private observer: HlsEventEmitter;
  private frag: Fragment | null = null;
  private part: Part | null = null;
  private useWorker: boolean;
  private worker: any;
  private onwmsg?: Function;
  private transmuxer: Transmuxer | null = null;
  private onTransmuxComplete: (transmuxResult: TransmuxerResult) => void;
  private onFlush: (chunkMeta: ChunkMetadata) => void;

  constructor(
    hls: Hls,
    id: PlaylistLevelType,
    onTransmuxComplete: (transmuxResult: TransmuxerResult) => void,
    onFlush: (chunkMeta: ChunkMetadata) => void
  ) {
    const config = hls.config;
    this.hls = hls;
    this.id = id;
    this.useWorker = !!config.enableWorker;
    this.onTransmuxComplete = onTransmuxComplete;
    this.onFlush = onFlush;

    const forwardMessage = (ev, data) => {
      data = data || {};
      data.frag = this.frag;
      data.id = this.id;
      this.hls.trigger(ev, data);
    };

    // forward events to main thread
    this.observer = new EventEmitter() as HlsEventEmitter;
    this.observer.on(Events.FRAG_DECRYPTED, forwardMessage);
    this.observer.on(Events.ERROR, forwardMessage);

    const typeSupported: TypeSupported = {
      mp4: MediaSource.isTypeSupported('video/mp4'),
      mpeg: MediaSource.isTypeSupported('audio/mpeg'),
      mp3: MediaSource.isTypeSupported('audio/mp4; codecs="mp3"'),
    };
    // navigator.vendor is not always available in Web Worker
    // refer to https://developer.mozilla.org/en-US/docs/Web/API/WorkerGlobalScope/navigator
    const vendor = navigator.vendor;
    if (this.useWorker && typeof Worker !== 'undefined') {
      logger.log('demuxing in webworker');
      let worker;
      try {
        worker = this.worker = work(
          require.resolve('../demux/transmuxer-worker.ts')
        );
        this.onwmsg = this.onWorkerMessage.bind(this);
        worker.addEventListener('message', this.onwmsg);
        worker.onerror = (event) => {
          this.useWorker = false;
          logger.warn('Exception in webworker, fallback to inline');
          this.hls.trigger(Events.ERROR, {
            type: ErrorTypes.OTHER_ERROR,
            details: ErrorDetails.INTERNAL_EXCEPTION,
            fatal: false,
            event: 'demuxerWorker',
            error: new Error(
              `${event.message}  (${event.filename}:${event.lineno})`
            ),
          });
        };
        worker.postMessage({
          cmd: 'init',
          typeSupported: typeSupported,
          vendor: vendor,
          id: id,
          config: JSON.stringify(config),
        });
      } catch (err) {
        logger.warn('Error in worker:', err);
        logger.error(
          'Error while initializing DemuxerWorker, fallback to inline'
        );
        if (worker) {
          // revoke the Object URL that was used to create transmuxer worker, so as not to leak it
          self.URL.revokeObjectURL(worker.objectURL);
        }
        this.transmuxer = new Transmuxer(
          this.observer,
          typeSupported,
          config,
          vendor,
          id
        );
        this.worker = null;
      }
    } else {
      this.transmuxer = new Transmuxer(
        this.observer,
        typeSupported,
        config,
        vendor,
        id
      );
    }
  }

  destroy(): void {
    const w = this.worker;
    if (w) {
      w.removeEventListener('message', this.onwmsg);
      w.terminate();
      this.worker = null;
      this.onwmsg = undefined;
    } else {
      const transmuxer = this.transmuxer;
      if (transmuxer) {
        transmuxer.destroy();
        this.transmuxer = null;
      }
    }
    const observer = this.observer;
    if (observer) {
      observer.removeAllListeners();
    }
    this.frag = null;
    // @ts-ignore
    this.observer = null;
    // @ts-ignore
    this.hls = null;
  }

  push(
    data: ArrayBuffer,
    initSegmentData: Uint8Array | undefined,
    audioCodec: string | undefined,
    videoCodec: string | undefined,
    frag: Fragment,
    part: Part | null,
    duration: number,
    accurateTimeOffset: boolean,
    chunkMeta: ChunkMetadata,
    defaultInitPTS?: number
  ): void {
    chunkMeta.transmuxing.start = self.performance.now();
    const { transmuxer, worker } = this;
    const timeOffset = part ? part.start : frag.start;
    // TODO: push "clear-lead" decrypt data for unencrypted fragments in streams with encrypted ones
    const decryptdata = frag.decryptdata;
    const lastFrag = this.frag;

    const discontinuity = !(lastFrag && frag.cc === lastFrag.cc);
    const trackSwitch = !(lastFrag && chunkMeta.level === lastFrag.level);
    const snDiff = lastFrag ? chunkMeta.sn - (lastFrag.sn as number) : -1;
    const partDiff = this.part ? chunkMeta.part - this.part.index : -1;
    const progressive =
      snDiff === 0 &&
      chunkMeta.id > 1 &&
      chunkMeta.id === lastFrag?.stats.chunkCount;
    const contiguous =
      !trackSwitch &&
      (snDiff === 1 ||
        (snDiff === 0 && (partDiff === 1 || (progressive && partDiff <= 0))));
    const now = self.performance.now();

    if (trackSwitch || snDiff || frag.stats.parsing.start === 0) {
      frag.stats.parsing.start = now;
    }
    if (part && (partDiff || !contiguous)) {
      part.stats.parsing.start = now;
    }
    const initSegmentChange = !(
      lastFrag && frag.initSegment?.url === lastFrag.initSegment?.url
    );
    const state = new TransmuxState(
      discontinuity,
      contiguous,
      accurateTimeOffset,
      trackSwitch,
      timeOffset,
      initSegmentChange
    );
    if (!contiguous || discontinuity || initSegmentChange) {
      logger.log(`[transmuxer-interface, ${frag.type}]: Starting new transmux session for sn: ${chunkMeta.sn} p: ${chunkMeta.part} level: ${chunkMeta.level} id: ${chunkMeta.id}
        discontinuity: ${discontinuity}
        trackSwitch: ${trackSwitch}
        contiguous: ${contiguous}
        accurateTimeOffset: ${accurateTimeOffset}
        timeOffset: ${timeOffset}
        initSegmentChange: ${initSegmentChange}`);
      const config = new TransmuxConfig(
        audioCodec,
        videoCodec,
        initSegmentData,
        duration,
        defaultInitPTS
      );
      this.configureTransmuxer(config);
    }

    this.frag = frag;
    this.part = part;

    // Frags with sn of 'initSegment' are not transmuxed
    if (worker) {
      // post fragment payload as transferable objects for ArrayBuffer (no copy)
      worker.postMessage(
        {
          cmd: 'demux',
          data,
          decryptdata,
          chunkMeta,
          state,
        },
        data instanceof ArrayBuffer ? [data] : []
      );
    } else if (transmuxer) {
      const transmuxResult = transmuxer.push(
        data,
        decryptdata,
        chunkMeta,
        state
      );
      if (isPromise(transmuxResult)) {
        transmuxer.async = true;
        transmuxResult
          .then((data) => {
            this.handleTransmuxComplete(data);
          })
          .catch((error) => {
            this.transmuxerError(
              error,
              chunkMeta,
              'transmuxer-interface push error'
            );
          });
      } else {
        transmuxer.async = false;
        this.handleTransmuxComplete(transmuxResult as TransmuxerResult);
      }
    }
  }

  flush(chunkMeta: ChunkMetadata) {
    chunkMeta.transmuxing.start = self.performance.now();
    const { transmuxer, worker } = this;
    if (worker) {
      1;
      worker.postMessage({
        cmd: 'flush',
        chunkMeta,
      });
    } else if (transmuxer) {
      let transmuxResult = transmuxer.flush(chunkMeta);
      const asyncFlush = isPromise(transmuxResult);
      if (asyncFlush || transmuxer.async) {
        if (!isPromise(transmuxResult)) {
          transmuxResult = Promise.resolve(transmuxResult);
        }
        transmuxResult
          .then((data) => {
            this.handleFlushResult(data, chunkMeta);
          })
          .catch((error) => {
            this.transmuxerError(
              error,
              chunkMeta,
              'transmuxer-interface flush error'
            );
          });
      } else {
        this.handleFlushResult(
          transmuxResult as Array<TransmuxerResult>,
          chunkMeta
        );
      }
    }
  }

  private transmuxerError(
    error: Error,
    chunkMeta: ChunkMetadata,
    reason: string
  ) {
    if (!this.hls) {
      return;
    }
    this.hls.trigger(Events.ERROR, {
      type: ErrorTypes.MEDIA_ERROR,
      details: ErrorDetails.FRAG_PARSING_ERROR,
      chunkMeta,
      fatal: false,
      error,
      err: error,
      reason,
    });
  }

  private handleFlushResult(
    results: Array<TransmuxerResult>,
    chunkMeta: ChunkMetadata
  ) {
    results.forEach((result) => {
      this.handleTransmuxComplete(result);
    });
    this.onFlush(chunkMeta);
  }

  private onWorkerMessage(ev: any): void {
    const data = ev.data;
    const hls = this.hls;
    switch (data.event) {
      case 'init': {
        // revoke the Object URL that was used to create transmuxer worker, so as not to leak it
        self.URL.revokeObjectURL(this.worker.objectURL);
        break;
      }

      case 'transmuxComplete': {
        this.handleTransmuxComplete(data.data);
        break;
      }

      case 'flush': {
        this.onFlush(data.data);
        break;
      }

      // pass logs from the worker thread to the main logger
      case 'workerLog':
        if (logger[data.data.logType]) {
          logger[data.data.logType](data.data.message);
        }
        break;

      default: {
        data.data = data.data || {};
        data.data.frag = this.frag;
        data.data.id = this.id;
        hls.trigger(data.event, data.data);
        break;
      }
    }
  }

  private configureTransmuxer(config: TransmuxConfig) {
    const { worker, transmuxer } = this;
    if (worker) {
      worker.postMessage({
        cmd: 'configure',
        config,
      });
    } else if (transmuxer) {
      transmuxer.configure(config);
    }
  }

  private handleTransmuxComplete(result: TransmuxerResult) {
    result.chunkMeta.transmuxing.end = self.performance.now();
    this.onTransmuxComplete(result);
  }
}
