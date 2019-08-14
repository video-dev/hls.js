/* transmuxer web worker.
 *  - listen to worker message, and trigger DemuxerInline upon reception of Fragments.
 *  - provides MP4 Boxes back to main thread using [transferable objects](https://developers.google.com/web/updates/2011/12/Transferable-Objects-Lightning-Fast) in order to minimize message passing overhead.
 */

import Transmuxer from '../demux/transmuxer';
import Event from '../events';
import { enableLogs } from '../utils/logger';
import { EventEmitter } from 'eventemitter3';
import { RemuxedTrack } from '../types/remuxer';
import { TransmuxerResult, ChunkMetadata } from '../types/transmuxer';

export default function TransmuxerWorker (self) {
  const observer = new EventEmitter() as any;
  observer.trigger = (event, data) => {
    observer.emit(event, event, ...data);
  };

  observer.off = (event, ...data) => {
    observer.removeListener(event, ...data);
  };

  const forwardMessage = (ev, data) => {
    self.postMessage({ event: ev, data: data });
  };

  // forward events to main thread
  observer.on(Event.FRAG_DECRYPTED, forwardMessage);
  observer.on(Event.ERROR, forwardMessage);

  self.addEventListener('message', (ev) => {
    const data = ev.data;
    switch (data.cmd) {
      case 'init': {
        const config = JSON.parse(data.config);
        self.transmuxer = new Transmuxer(observer, data.typeSupported, config, data.vendor);
        enableLogs(config.debug);
        forwardMessage('init', null);
        break;
      }
      case 'configure': {
        self.transmuxer.configure(data.config, data.state);
        break;
      }
      case 'demux': {
        const transmuxResult: TransmuxerResult = self.transmuxer.push(data.data, data.decryptdata, data.chunkMeta);
        if (!transmuxResult) {
          return;
        }
        // @ts-ignore
        if (transmuxResult.then) {
          // @ts-ignore
          transmuxResult.then(data => {
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
          if (transmuxResult.then) {
            // @ts-ignore
            transmuxResult.then((results: Array<TransmuxerResult>) => {
              handleFlushResult(self, results as Array<TransmuxerResult>, id);
            });
          } else {
            handleFlushResult(self, transmuxResult as Array<TransmuxerResult>, id);
          }
          break;
        }
      default:
        break;
      }
  });
}

function emitTransmuxComplete (self: any, transmuxResult : TransmuxerResult): void {
  let transferable = [] as Array<ArrayBuffer>;
  const { audio, video } = transmuxResult.remuxResult;
  if (audio) {
    transferable = transferable.concat(convertToTransferable(audio));
  }
  if (video) {
    transferable = transferable.concat(convertToTransferable(video));
  }
  self.postMessage({ event: 'transmuxComplete', data: transmuxResult }, transferable);
}

function convertToTransferable (track: RemuxedTrack): Array<ArrayBuffer> {
  const transferable: Array<ArrayBuffer> = [];
  if (track.data1) {
    transferable.push(track.data1.buffer);
  }
  if (track.data2) {
    transferable.push(track.data2.buffer);
  }
  return transferable;
}

function handleFlushResult (self: any, results: Array<TransmuxerResult>, chunkMeta: ChunkMetadata) {
  results.forEach(result => {
    emitTransmuxComplete(self, result);
  });
  self.postMessage({ event: 'flush', data: chunkMeta });
}
