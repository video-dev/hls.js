import Transmuxer, { isPromise } from '../demux/transmuxer';
import { Events } from '../events';
import { ILogFunction, enableLogs, logger } from '../utils/logger';
import { EventEmitter } from 'eventemitter3';
import type { RemuxedTrack, RemuxerResult } from '../types/remuxer';
import type { TransmuxerResult, ChunkMetadata } from '../types/transmuxer';
import { ErrorDetails, ErrorTypes } from '../errors';

export default function TransmuxerWorker(self) {
  const observer = new EventEmitter();
  const forwardMessage = (ev, data) => {
    self.postMessage({ event: ev, data: data });
  };

  // forward events to main thread
  observer.on(Events.FRAG_DECRYPTED, forwardMessage);
  observer.on(Events.ERROR, forwardMessage);

  // forward logger events to main thread
  const forwardWorkerLogs = () => {
    for (const logFn in logger) {
      const func: ILogFunction = (message?) => {
        forwardMessage('workerLog', {
          logType: logFn,
          message,
        });
      };

      logger[logFn] = func;
    }
  };

  self.addEventListener('message', (ev) => {
    const data = ev.data;
    switch (data.cmd) {
      case 'init': {
        const config = JSON.parse(data.config);
        self.transmuxer = new Transmuxer(
          observer,
          data.typeSupported,
          config,
          data.vendor,
          data.id
        );
        enableLogs(config.debug, data.id);
        forwardWorkerLogs();
        forwardMessage('init', null);
        break;
      }
      case 'configure': {
        self.transmuxer.configure(data.config);
        break;
      }
      case 'demux': {
        const transmuxResult: TransmuxerResult | Promise<TransmuxerResult> =
          self.transmuxer.push(
            data.data,
            data.decryptdata,
            data.chunkMeta,
            data.state
          );
        if (isPromise(transmuxResult)) {
          self.transmuxer.async = true;
          transmuxResult
            .then((data) => {
              emitTransmuxComplete(self, data);
            })
            .catch((error) => {
              forwardMessage(Events.ERROR, {
                type: ErrorTypes.MEDIA_ERROR,
                details: ErrorDetails.FRAG_PARSING_ERROR,
                chunkMeta: data.chunkMeta,
                fatal: false,
                error,
                err: error,
                reason: `transmuxer-worker push error`,
              });
            });
        } else {
          self.transmuxer.async = false;
          emitTransmuxComplete(self, transmuxResult);
        }
        break;
      }
      case 'flush': {
        const id = data.chunkMeta;
        let transmuxResult = self.transmuxer.flush(id);
        const asyncFlush = isPromise(transmuxResult);
        if (asyncFlush || self.transmuxer.async) {
          if (!isPromise(transmuxResult)) {
            transmuxResult = Promise.resolve(transmuxResult);
          }
          transmuxResult
            .then((results: Array<TransmuxerResult>) => {
              handleFlushResult(self, results as Array<TransmuxerResult>, id);
            })
            .catch((error) => {
              forwardMessage(Events.ERROR, {
                type: ErrorTypes.MEDIA_ERROR,
                details: ErrorDetails.FRAG_PARSING_ERROR,
                chunkMeta: data.chunkMeta,
                fatal: false,
                error,
                err: error,
                reason: `transmuxer-worker flush error`,
              });
            });
        } else {
          handleFlushResult(
            self,
            transmuxResult as Array<TransmuxerResult>,
            id
          );
        }
        break;
      }
      default:
        break;
    }
  });
}

function emitTransmuxComplete(
  self: any,
  transmuxResult: TransmuxerResult
): boolean {
  if (isEmptyResult(transmuxResult.remuxResult)) {
    return false;
  }
  const transferable: Array<ArrayBuffer> = [];
  const { audio, video } = transmuxResult.remuxResult;
  if (audio) {
    addToTransferable(transferable, audio);
  }
  if (video) {
    addToTransferable(transferable, video);
  }
  self.postMessage(
    { event: 'transmuxComplete', data: transmuxResult },
    transferable
  );
  return true;
}

// Converts data to a transferable object https://developers.google.com/web/updates/2011/12/Transferable-Objects-Lightning-Fast)
// in order to minimize message passing overhead
function addToTransferable(
  transferable: Array<ArrayBuffer>,
  track: RemuxedTrack
) {
  if (track.data1) {
    transferable.push(track.data1.buffer);
  }
  if (track.data2) {
    transferable.push(track.data2.buffer);
  }
}

function handleFlushResult(
  self: any,
  results: Array<TransmuxerResult>,
  chunkMeta: ChunkMetadata
) {
  const parsed = results.reduce(
    (parsed, result) => emitTransmuxComplete(self, result) || parsed,
    false
  );
  if (!parsed) {
    // Emit at least one "transmuxComplete" message even if media is not found to update stream-controller state to PARSING
    self.postMessage({ event: 'transmuxComplete', data: results[0] });
  }
  self.postMessage({ event: 'flush', data: chunkMeta });
}

function isEmptyResult(remuxResult: RemuxerResult) {
  return (
    !remuxResult.audio &&
    !remuxResult.video &&
    !remuxResult.text &&
    !remuxResult.id3 &&
    !remuxResult.initSegment
  );
}
