import Event from '../events';
import DemuxerInline from '../demux/demuxer-inline';
import DemuxerWorker from '../demux/demuxer-worker';
import {logger} from '../utils/logger';
import {ErrorTypes, ErrorDetails} from '../errors';
import work from 'webworkify-webpack';

class Demuxer {

  constructor(hls, id) {
    this.hls = hls;
    this.id = id;
    var typeSupported = {
      mp4 : MediaSource.isTypeSupported('video/mp4'),
      mpeg: MediaSource.isTypeSupported('audio/mpeg'),
      mp3: MediaSource.isTypeSupported('audio/mp4; codecs="mp3"')
    };
    if (hls.config.enableWorker && (typeof(Worker) !== 'undefined')) {
        logger.log('demuxing in webworker');
        let w;
        try {
          w = this.w = work(require.resolve('../demux/demuxer-worker.js'));
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
          this.w = undefined;
        }
      } else {
        this.demuxer = new DemuxerInline(hls,id,typeSupported);
      }
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
  }

  push(data, initSegment, audioCodec, videoCodec, timeOffset, cc, level, sn, duration, decryptdata,accurateTimeOffset,defaultInitPTS) {
    let w = this.w;
    if (w) {
      // post fragment payload as transferable objects (no copy)
      w.postMessage({cmd: 'demux', data, initSegment, audioCodec, videoCodec, timeOffset, cc, level, sn, duration, decryptdata, accurateTimeOffset,defaultInitPTS}, [data]);
    } else {
      let demuxer = this.demuxer;
      if (demuxer) {
        demuxer.push(data, initSegment, audioCodec, videoCodec, timeOffset, cc, level, sn, duration,decryptdata, accurateTimeOffset,defaultInitPTS);
      }
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
        if (data.data2) {
          data.data.data2 = new Uint8Array(data.data2);
        }
        /* falls through */
      default:
        hls.trigger(data.event, data.data);
        break;
    }
  }
}

export default Demuxer;

