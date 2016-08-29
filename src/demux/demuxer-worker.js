/* demuxer web worker.
 *  - listen to worker message, and trigger DemuxerInline upon reception of Fragments.
 *  - provides MP4 Boxes back to main thread using [transferable objects](https://developers.google.com/web/updates/2011/12/Transferable-Objects-Lightning-Fast) in order to minimize message passing overhead.
 */

 import DemuxerInline from '../demux/demuxer-inline';
 import Event from '../events';
 import EventEmitter from 'events';

var DemuxerWorker = function (self) {
  // observer setup
  var observer = new EventEmitter();
  observer.trigger = function trigger (event, ...data) {
    observer.emit(event, event, ...data);
  };

  observer.off = function off (event, ...data) {
    observer.removeListener(event, ...data);
  };
  self.addEventListener('message', function (ev) {
    var data = ev.data;
    //console.log('demuxer cmd:' + data.cmd);
    switch (data.cmd) {
      case 'init':
        self.demuxer = new DemuxerInline(observer, data.id, data.typeSupported, JSON.parse(data.config));
        break;
      case 'demux':
        self.demuxer.push(new Uint8Array(data.data), data.audioCodec, data.videoCodec, data.timeOffset, data.cc, data.level, data.sn, data.duration);
        break;
      default:
        break;
    }
  });

  var forwardMessage = function(ev,data) {
    self.postMessage({event: ev, data:data });
  };

  // forward events to main thread
  observer.on(Event.FRAG_PARSING_INIT_SEGMENT, forwardMessage);
  observer.on(Event.FRAG_PARSED, forwardMessage);
  observer.on(Event.ERROR, forwardMessage);
  observer.on(Event.FRAG_PARSING_METADATA, forwardMessage);
  observer.on(Event.FRAG_PARSING_USERDATA, forwardMessage);

  // special case for FRAG_PARSING_DATA: pass data1/data2 as transferable object (no copy)
  observer.on(Event.FRAG_PARSING_DATA, function(ev, data) {
    let data1 = data.data1.buffer, data2 = data.data2.buffer;
    // remove data1 and data2 reference from data to avoid copying them ...
    delete data.data1;
    delete data.data2;
    self.postMessage({event: ev, data:data , data1 : data1, data2 : data2},[data1, data2]);
  });
};

export default DemuxerWorker;

