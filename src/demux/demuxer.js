import Event from '../events';
import DemuxerInline from '../demux/demuxer-inline';
import DemuxerWorker from '../demux/demuxer-worker';
import {logger} from '../utils/logger';
import Decrypter from '../crypt/decrypter';
import {ErrorTypes, ErrorDetails} from '../errors';

class Demuxer {

  constructor(hls, id) {
    this.hls = hls;
    this.id = id;
    var typeSupported = {
      mp4 : MediaSource.isTypeSupported('video/mp4'),
      mp2t : hls.config.enableMP2TPassThrough && MediaSource.isTypeSupported('video/mp2t')
    };
    if (hls.config.enableWorker && (typeof(Worker) !== 'undefined')) {
        logger.log('demuxing in webworker');
        try {
          let work = require('webworkify');
          let w = this.w = work(DemuxerWorker);
          this.onwmsg = this.onWorkerMessage.bind(this);
          w.addEventListener('message', this.onwmsg);
          w.onerror = function(event) { hls.trigger(Event.ERROR, {type: ErrorTypes.OTHER_ERROR, details: ErrorDetails.INTERNAL_EXCEPTION, fatal: true, event : 'demuxerWorker', err : { message : event.message + ' (' + event.filename + ':' + event.lineno + ')' }});};
          w.postMessage({cmd: 'init', typeSupported : typeSupported, id : id, config: JSON.stringify(hls.config)});
        } catch(err) {
          logger.error('error while initializing DemuxerWorker, fallback on DemuxerInline');
          this.demuxer = new DemuxerInline(hls,id,typeSupported);
        }
      } else {
        this.demuxer = new DemuxerInline(hls,id,typeSupported);
      }
      this.demuxInitialized = true;
  }

  destroy() {
    let w = this.w;
    if (w) {
      w.removeEventListener('message', this.onwmsg);
      w.terminate();
      this.w = null;
    } else {
      let demuxer = this.demuxer;
      if (demuxer) {
        demuxer.destroy();
        this.demuxer = null;
      }
    }
    let decrypter = this.decrypter;
    if (decrypter) {
      decrypter.destroy();
      this.decrypter = null;
    }
  }

  pushDecrypted(data, audioCodec, videoCodec, timeOffset, frag, level, sn, duration) {
    let w = this.w;
    if (w) {
      // post fragment payload as transferable objects (no copy)
      w.postMessage({cmd: 'demux', data: data, audioCodec: audioCodec, videoCodec: videoCodec, timeOffset: timeOffset, cc: frag.cc, level: level, sn : sn, duration: duration}, [data]);
    } else {
      let demuxer = this.demuxer;
      if (demuxer) {
        demuxer.push(new Uint8Array(data), audioCodec, videoCodec, timeOffset, frag, level, sn, duration);
      }
    }
  }

  push(data, audioCodec, videoCodec, timeOffset, frag, level, sn, duration) {
    var decryptdata = frag.decryptdata;
    if ((data.byteLength > 0) && (decryptdata != null) && (decryptdata.key != null) && (decryptdata.method === 'AES-128')) {
      if (this.decrypter == null) {
        this.decrypter = new Decrypter(this.hls);
      }

      var localthis = this;
      this.decrypter.decrypt(data, decryptdata.key, decryptdata.iv, function(decryptedData){
        localthis.pushDecrypted(decryptedData, audioCodec, videoCodec, timeOffset, frag, level, sn, duration);
      });
    } else {
      this.pushDecrypted(data, audioCodec, videoCodec, timeOffset, frag, level, sn, duration);
    }
  }

  onWorkerMessage(ev) {
    let data = ev.data,
        hls = this.hls;
    //console.log('onWorkerMessage:' + data.event);
    switch(data.event) {
      // special case for FRAG_PARSING_DATA: data1 and data2 are transferable objects
      case Event.FRAG_PARSING_DATA:
        data.data.data1 = new Uint8Array(data.data1);
        data.data.data2 = new Uint8Array(data.data2);
        /* falls through */
      default:
        hls.trigger(data.event, data.data);
        break;
    }
  }
}

export default Demuxer;

