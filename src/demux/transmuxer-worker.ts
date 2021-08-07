import Transmuxer, { isPromise } from '../demux/transmuxer';
import { Events } from '../events';
import { enableLogs } from '../utils/logger';
import { EventEmitter } from 'eventemitter3';
import type { RemuxedTrack, RemuxerResult } from '../types/remuxer';
import type { TransmuxerResult, ChunkMetadata } from '../types/transmuxer';

export default function TransmuxerWorker(self) {
  const observer = new EventEmitter();
  const forwardMessage = (ev, data) => {
    self.postMessage({ event: ev, data: data });
  };

  // forward events to main thread
  observer.on(Events.FRAG_DECRYPTED, forwardMessage);
  observer.on(Events.ERROR, forwardMessage);

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
        enableLogs(config.debug);
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
          transmuxResult.then((data) => {
            emitTransmuxComplete(self, data);
          });
        } else {
          emitTransmuxComplete(self, transmuxResult);
        }
        break;
      }
      case 'flush': {
        const id = data.chunkMeta;
        const transmuxResult = self.transmuxer.flush(id);
        if (isPromise(transmuxResult)) {
          transmuxResult.then((results: Array<TransmuxerResult>) => {
            handleFlushResult(self, results as Array<TransmuxerResult>, id);
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

function emitTransmuxComplete(self: any, transmuxResult: TransmuxerResult) {
  if (isEmptyResult(transmuxResult.remuxResult)) {
    return;
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
  results.forEach((result) => {
    emitTransmuxComplete(self, result);
  });
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
