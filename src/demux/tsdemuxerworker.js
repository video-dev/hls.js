 import Event                from '../events';
 import TSDemuxer            from '../demux/tsdemuxer';
 import observer             from '../observer';

var TSDemuxerWorker = function (self) {
    self.addEventListener('message',function (ev) {
      //console.log('demuxer cmd:' + ev.data.cmd);
      switch(ev.data.cmd) {
        case 'init':
          self.demuxer = new TSDemuxer();
          break;
        case 'duration':
          self.demuxer.setDuration(ev.data.data);
          break;
        case 'switchLevel':
          self.demuxer.switchLevel();
          break;
        case 'demux':
          self.demuxer.push(new Uint8Array(ev.data.data), ev.data.audioCodec,ev.data.videoCodec, ev.data.timeOffset);
          self.demuxer.end();
          break;
        default:
          break;
      }
    });

    // listen to events triggered by TS Demuxer
    observer.on(Event.FRAG_PARSING_INIT_SEGMENT, function(ev,data) {
      var objData = { event : ev };
      var objTransferable = [];
      if(data.audioCodec) {
        objData.audioCodec = data.audioCodec;
        objData.audioMoov = data.audioMoov.buffer;
        objData.audioChannelCount = data.audioChannelCount;
        objTransferable.push(objData.audioMoov);
      }
      if(data.videoCodec) {
        objData.videoCodec = data.videoCodec;
        objData.videoMoov = data.videoMoov.buffer;
        objData.videoWidth = data.videoWidth;
        objData.videoHeight = data.videoHeight;
        objTransferable.push(objData.videoMoov);
      }
      // pass moov as transferable object (no copy)
      self.postMessage(objData,objTransferable);
    });
    observer.on(Event.FRAG_PARSING_DATA, function(ev,data) {
      var objData = { event : ev , type : data.type, startPTS : data.startPTS, endPTS : data.endPTS , startDTS : data.startDTS, endDTS : data.endDTS ,moof : data.moof.buffer, mdat : data.mdat.buffer, nb : data.nb};
      // pass moof/mdat data as transferable object (no copy)
      self.postMessage(objData,[objData.moof,objData.mdat]);
    });
    observer.on(Event.FRAG_PARSED, function(ev) {
      var objData = { event : ev };
      self.postMessage(objData);
    });

  }

export default TSDemuxerWorker;

