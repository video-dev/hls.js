 import Event from '../events';
 import EventEmitter from 'events';
 import TSDemuxer from '../demux/tsdemuxer';
 import MP4Remuxer from '../remux/mp4-remuxer';

var TSDemuxerWorker = function (self) {
  // observer setup
  var observer = new EventEmitter();
  observer.trigger = function trigger (event, ...data) {
    observer.emit(event, event, ...data);
  };

  observer.off = function off (event, ...data) {
    observer.removeListener(event, ...data);
  };
  self.addEventListener('message', function (ev) {
    //console.log('demuxer cmd:' + ev.data.cmd);
    switch (ev.data.cmd) {
      case 'init':
        self.demuxer = new TSDemuxer(observer,MP4Remuxer);
        break;
      case 'demux':
        self.demuxer.push(new Uint8Array(ev.data.data), ev.data.audioCodec, ev.data.videoCodec, ev.data.timeOffset, ev.data.cc, ev.data.level, ev.data.duration);
        self.demuxer.remux();
        break;
      default:
        break;
    }
  });

  // listen to events triggered by TS Demuxer
  observer.on(Event.FRAG_PARSING_INIT_SEGMENT, function(ev, data) {
    var objData = {event: ev};
    var objTransferable = [];
    if (data.audioCodec) {
      objData.audioCodec = data.audioCodec;
      objData.audioMoov = data.audioMoov.buffer;
      objData.audioChannelCount = data.audioChannelCount;
      objTransferable.push(objData.audioMoov);
    }
    if (data.videoCodec) {
      objData.videoCodec = data.videoCodec;
      objData.videoMoov = data.videoMoov.buffer;
      objData.videoWidth = data.videoWidth;
      objData.videoHeight = data.videoHeight;
      objTransferable.push(objData.videoMoov);
    }
    // pass moov as transferable object (no copy)
    self.postMessage(objData,objTransferable);
  });

  observer.on(Event.FRAG_PARSING_DATA, function(ev, data) {
    var objData = {event: ev, type: data.type, startPTS: data.startPTS, endPTS: data.endPTS, startDTS: data.startDTS, endDTS: data.endDTS, moof: data.moof.buffer, mdat: data.mdat.buffer, nb: data.nb};
    // pass moof/mdat data as transferable object (no copy)
    self.postMessage(objData, [objData.moof, objData.mdat]);
  });

  observer.on(Event.FRAG_PARSED, function(event) {
    self.postMessage({event: event});
  });

  observer.on(Event.ERROR, function(event, data) {
    self.postMessage({event: event, data: data});
  });

  observer.on(Event.FRAG_PARSING_METADATA, function(event, data) {
    var objData = {event: event, samples: data.samples};
    self.postMessage(objData);
  });
};

export default TSDemuxerWorker;

