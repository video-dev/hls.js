/* demuxer web worker.
 *  - listen to worker message, and trigger DemuxerInline upon reception of Fragments.
 *  - provides MP4 Boxes back to main thread using [transferable objects](https://developers.google.com/web/updates/2011/12/Transferable-Objects-Lightning-Fast) in order to minimize message passing overhead.
 */

import DemuxerInline from '../demux/demuxer-inline';
import Event from '../events';
import { enableLogs } from '../utils/logger';
import EventEmitter from 'events';

let DemuxerWorker = function (self) {
  // observer setup
  let observer = new EventEmitter();
  observer.trigger = function trigger (event, ...data) {
    observer.emit(event, event, ...data);
  };

  observer.off = function off (event, ...data) {
    observer.removeListener(event, ...data);
  };

  let forwardMessage = function (ev, data) {
    self.postMessage({ event: ev, data: data });
  };

  self.addEventListener('message', function (ev) {
    let data = ev.data;
    // console.log('demuxer cmd:' + data.cmd);
    switch (data.cmd) {
    case 'init':
      let config = JSON.parse(data.config);
      self.demuxer = new DemuxerInline(observer, data.typeSupported, config, data.vendor);
      try {
        enableLogs(config.debug === true);
      } catch (err) {
        console.warn('demuxerWorker: unable to enable logs');
      }
      // signal end of worker init
      forwardMessage('init', null);
      break;
    case 'demux':
      self.demuxer.push(data.data, data.decryptdata, data.initSegment, data.audioCodec, data.videoCodec, data.timeOffset, data.discontinuity, data.trackSwitch, data.contiguous, data.duration, data.accurateTimeOffset, data.defaultInitPTS);
      break;
    default:
      break;
    }
  });

  // forward events to main thread
  observer.on(Event.FRAG_DECRYPTED, forwardMessage);
  observer.on(Event.FRAG_PARSING_INIT_SEGMENT, forwardMessage);
  observer.on(Event.FRAG_PARSED, forwardMessage);
  observer.on(Event.ERROR, forwardMessage);
  observer.on(Event.FRAG_PARSING_METADATA, forwardMessage);
  observer.on(Event.FRAG_PARSING_USERDATA, forwardMessage);
  observer.on(Event.INIT_PTS_FOUND, forwardMessage);

  // special case for FRAG_PARSING_DATA: pass data1/data2 as transferable object (no copy)
  observer.on(Event.FRAG_PARSING_DATA, function (ev, data) {
    let transferable = [];
    let message = { event: ev, data: data };
    if (data.data1) {
      message.data1 = data.data1.buffer;
      transferable.push(data.data1.buffer);
      delete data.data1;
    }
    if (data.data2) {
      message.data2 = data.data2.buffer;
      transferable.push(data.data2.buffer);
      delete data.data2;
    }
    self.postMessage(message, transferable);
  });
};

export default DemuxerWorker;
