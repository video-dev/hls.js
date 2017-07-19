import Event from '../events';
import DemuxerInline from '../demux/demuxer-inline';
import {logger} from '../utils/logger';
import {ErrorTypes, ErrorDetails} from '../errors';
import EventEmitter from 'events';
import work from 'webworkify-webpack';
import {getMediaSource} from '../helper/mediasource-helper';

const MediaSource = getMediaSource();

class Demuxer {

  constructor(hls, id) {
    this._hls = hls;
    this._id = id;
    // observer setup
    const observer = this._observer = new EventEmitter();
    const config = hls.config;
    observer.trigger = function trigger (event, ...data) {
      observer.emit(event, event, ...data);
    };

    observer.off = function off (event, ...data) {
      observer.removeListener(event, ...data);
    };

    var forwardMessage = function(ev,data) {
      data = data || {};
      data.frag = this._frag;
      data.id = this._id;
      hls.trigger(ev,data);
    }.bind(this);

    // forward events to main thread
    observer.on(Event.FRAG_DECRYPTED, forwardMessage);
    observer.on(Event.FRAG_PARSING_INIT_SEGMENT, forwardMessage);
    observer.on(Event.FRAG_PARSING_DATA, forwardMessage);
    observer.on(Event.FRAG_PARSED, forwardMessage);
    observer.on(Event.ERROR, forwardMessage);
    observer.on(Event.FRAG_PARSING_METADATA, forwardMessage);
    observer.on(Event.FRAG_PARSING_USERDATA, forwardMessage);
    observer.on(Event.INIT_PTS_FOUND, forwardMessage);

    const typeSupported = {
      mp4 : MediaSource.isTypeSupported('video/mp4'),
      mpeg: MediaSource.isTypeSupported('audio/mpeg'),
      mp3: MediaSource.isTypeSupported('audio/mp4; codecs="mp3"')
    };
    // navigator.vendor is not always available in Web Worker
    // refer to https://developer.mozilla.org/en-US/docs/Web/API/WorkerGlobalScope/navigator
    const vendor = navigator.vendor;
    if (config.enableWorker && (typeof(Worker) !== 'undefined')) {
        logger.log('demuxing in webworker');
        let w;
        try {
          w = this._w = work(require.resolve('../demux/demuxer-worker.js'));
          this._onwmsg = this._onWorkerMessage.bind(this);
          w.addEventListener('message', this._onwmsg);
          w.onerror = function(event) { hls.trigger(Event.ERROR, {type: ErrorTypes.OTHER_ERROR, details: ErrorDetails.INTERNAL_EXCEPTION, fatal: true, event : 'demuxerWorker', err : { message : event.message + ' (' + event.filename + ':' + event.lineno + ')' }});};
          w.postMessage({cmd: 'init', typeSupported : typeSupported, vendor : vendor, id : id, config: JSON.stringify(config)});
        } catch(err) {
          logger.error('error while initializing DemuxerWorker, fallback on DemuxerInline');
          if (w) {
            // revoke the Object URL that was used to create demuxer worker, so as not to leak it
            URL.revokeObjectURL(w.objectURL);
          }
          this._demuxer = new DemuxerInline(observer,typeSupported,config,vendor);
          this._w = undefined;
        }
      } else {
        this._demuxer = new DemuxerInline(observer,typeSupported,config, vendor);
      }
  }

  destroy() {
    let w = this._w;
    if (w) {
      w.removeEventListener('message', this._onwmsg);
      w.terminate();
      this._w = null;
    } else {
      let demuxer = this._demuxer;
      if (demuxer) {
        demuxer.destroy();
        this._demuxer = null;
      }
    }
    let observer = this._observer;
    if (observer) {
      observer.removeAllListeners();
      this._observer = null;
    }
  }

  push(data, initSegment, audioCodec, videoCodec, frag, duration,accurateTimeOffset,defaultInitPTS) {
    const w = this._w;
    const timeOffset = !isNaN(frag.startDTS) ? frag.startDTS  : frag.start;
    const decryptdata = frag.decryptdata;
    const lastFrag = this._frag;
    const discontinuity = !(lastFrag && (frag.cc === lastFrag.cc));
    const trackSwitch = !(lastFrag && (frag.level === lastFrag.level));
    const nextSN = lastFrag && (frag.sn === (lastFrag.sn+1));
    const contiguous = !trackSwitch && nextSN;
    if (discontinuity) {
      logger.log(`${this._id}:discontinuity detected`);
    }
    if (trackSwitch) {
      logger.log(`${this._id}:switch detected`);
    }
    this._frag = frag;
    if (w) {
      // post fragment payload as transferable objects for ArrayBuffer (no copy)
      w.postMessage({cmd: 'demux', data, decryptdata, initSegment, audioCodec, videoCodec, timeOffset, discontinuity, trackSwitch, contiguous, duration, accurateTimeOffset,defaultInitPTS}, data instanceof ArrayBuffer ? [data] : []);
    } else {
      let demuxer = this._demuxer;
      if (demuxer) {
        demuxer.push(data, decryptdata, initSegment, audioCodec, videoCodec, timeOffset, discontinuity, trackSwitch, contiguous, duration, accurateTimeOffset,defaultInitPTS);
      }
    }
  }

  _onWorkerMessage(ev) {
    let data = ev.data,
        hls = this._hls;
    //console.log('onWorkerMessage:' + data.event);
    switch(data.event) {
      case 'init':
        // revoke the Object URL that was used to create demuxer worker, so as not to leak it
        URL.revokeObjectURL(this._w.objectURL);
        break;
      // special case for FRAG_PARSING_DATA: data1 and data2 are transferable objects
      case Event.FRAG_PARSING_DATA:
        data.data.data1 = new Uint8Array(data.data1);
        if (data.data2) {
          data.data.data2 = new Uint8Array(data.data2);
        }
        /* falls through */
      default:
        data.data = data.data || {};
        data.data.frag = this._frag;
        data.data.id = this._id;
        hls.trigger(data.event, data.data);
        break;
    }
  }
}

export default Demuxer;

