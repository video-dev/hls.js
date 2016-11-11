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
        let w;
        try {
          let work = require('webworkify');
          w = this.w = work(DemuxerWorker);
          this.onwmsg = this.onWorkerMessage.bind(this);
          w.addEventListener('message', this.onwmsg);
          w.onerror = function(event) { hls.trigger(Event.ERROR, {type: ErrorTypes.OTHER_ERROR, details: ErrorDetails.INTERNAL_EXCEPTION, fatal: true, event : 'demuxerWorker', err : { message : event.message + ' (' + event.filename + ':' + event.lineno + ')' }});};
          w.postMessage({cmd: 'init', typeSupported : typeSupported, id : id, config: JSON.stringify(hls.config)});
        } catch(err) {
          logger.error('error while initializing DemuxerWorker, fallback on DemuxerInline');
          if (w) {
            // revoke the Object URL that was used to create demuxer worker, so as not to leak it
            URL.revokeObjectURL(w.objectURL);
          }
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

  pushDecrypted(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration,accurateTimeOffset) {
    let w = this.w;
    if (w) {
      // post fragment payload as transferable objects (no copy)
      w.postMessage({cmd: 'demux', data: data, audioCodec: audioCodec, videoCodec: videoCodec, timeOffset: timeOffset, cc: cc, level: level, sn : sn, duration: duration, accurateTimeOffset : accurateTimeOffset}, [data]);
    } else {
      let demuxer = this.demuxer;
      if (demuxer) {
        demuxer.push(new Uint8Array(data), audioCodec, videoCodec, timeOffset, cc, level, sn, duration,accurateTimeOffset);
      }
    }
  }

  push(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration, decryptdata, accurateTimeOffset) {
    if ((data.byteLength > 0) && (decryptdata != null) && (decryptdata.key != null) && (decryptdata.method === 'AES-128')) {
      if (this.decrypter == null) {
        this.decrypter = new Decrypter(this.hls);
      }
      var localthis = this;
      var startTime = performance.now();
      this.decrypter.decrypt(data, decryptdata.key.buffer, decryptdata.iv.buffer, function (decryptedData) {
        localthis.hls.trigger(Event.FRAG_DECRYPTED, { level : level, sn : sn, stats: { tstart: startTime, tdecrypt: performance.now() } });
        localthis.pushDecrypted(decryptedData, audioCodec, videoCodec, timeOffset, cc, level, sn, duration, accurateTimeOffset);
      });
    } else {
      this.pushDecrypted(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration,accurateTimeOffset);
    }
  }

  onWorkerMessage(ev) {
    let data = ev.data,
        hls = this.hls;
    //console.log('onWorkerMessage:' + data.event);
    switch(data.event) {
      case 'init':
        // revoke the Object URL that was used to create demuxer worker, so as not to leak it
        URL.revokeObjectURL(this.w.objectURL);
        break;
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

