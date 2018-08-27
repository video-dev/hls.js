import EventEmitter from 'events';
import work from 'webworkify-webpack';

import Event from '../events';
import DemuxerInline from '../demux/demuxer-inline';
import { logger } from '../utils/logger';
import { ErrorTypes, ErrorDetails } from '../errors';
import { getMediaSource } from '../utils/mediasource-helper';
import { getSelfScope } from '../utils/get-self-scope';

// see https://stackoverflow.com/a/11237259/589493
const global = getSelfScope(); // safeguard for code that might run both on worker and main thread
const MediaSource = getMediaSource();

class Demuxer {
  constructor (hls, id) {
    this.hls = hls;
    this.id = id;
    // observer setup
    const observer = this.observer = new EventEmitter();
    const config = hls.config;
    observer.trigger = function trigger (event, ...data) {
      observer.emit(event, event, ...data);
    };

    observer.off = function off (event, ...data) {
      observer.removeListener(event, ...data);
    };

    let forwardMessage = function (ev, data) {
      data = data || {};
      data.frag = this.frag;
      data.id = this.id;
      hls.trigger(ev, data);
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
      mp4: MediaSource.isTypeSupported('video/mp4'),
      mpeg: MediaSource.isTypeSupported('audio/mpeg'),
      mp3: MediaSource.isTypeSupported('audio/mp4; codecs="mp3"')
    };
    // navigator.vendor is not always available in Web Worker
    // refer to https://developer.mozilla.org/en-US/docs/Web/API/WorkerGlobalScope/navigator
    const vendor = navigator.vendor;
    if (config.enableWorker && (typeof (Worker) !== 'undefined')) {
      logger.log('demuxing in webworker');
      let w;
      try {
        w = this.w = work(require.resolve('../demux/demuxer-worker.js'));
        this.onwmsg = this.onWorkerMessage.bind(this);
        w.addEventListener('message', this.onwmsg);
        w.onerror = function (event) {
          hls.trigger(Event.ERROR, { type: ErrorTypes.OTHER_ERROR, details: ErrorDetails.INTERNAL_EXCEPTION, fatal: true, event: 'demuxerWorker', err: { message: event.message + ' (' + event.filename + ':' + event.lineno + ')' } });
        };
        w.postMessage({ cmd: 'init', typeSupported: typeSupported, vendor: vendor, id: id, config: JSON.stringify(config) });
      } catch (err) {
        logger.error('error while initializing DemuxerWorker, fallback on DemuxerInline');
        if (w) {
          // revoke the Object URL that was used to create demuxer worker, so as not to leak it
          global.URL.revokeObjectURL(w.objectURL);
        }
        this.demuxer = new DemuxerInline(observer, typeSupported, config, vendor);
        this.w = undefined;
      }
    } else {
      this.demuxer = new DemuxerInline(observer, typeSupported, config, vendor);
    }
  }

  destroy () {
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
    let observer = this.observer;
    if (observer) {
      observer.removeAllListeners();
      this.observer = null;
    }
  }

  push (data, initSegment, audioCodec, videoCodec, frag, duration, accurateTimeOffset, defaultInitPTS) {
    const w = this.w;
    const timeOffset = Number.isFinite(frag.startDTS) ? frag.startDTS : frag.start;
    const decryptdata = frag.decryptdata;
    const lastFrag = this.frag;
    const discontinuity = !(lastFrag && (frag.cc === lastFrag.cc));
    const trackSwitch = !(lastFrag && (frag.level === lastFrag.level));
    const nextSN = lastFrag && (frag.sn === (lastFrag.sn + 1));
    const contiguous = !trackSwitch && nextSN;
    if (discontinuity) {
      logger.log(`${this.id}:discontinuity detected`);
    }

    if (trackSwitch) {
      logger.log(`${this.id}:switch detected`);
    }

    this.frag = frag;
    if (w) {
      // post fragment payload as transferable objects for ArrayBuffer (no copy)
      w.postMessage({ cmd: 'demux', data, decryptdata, initSegment, audioCodec, videoCodec, timeOffset, discontinuity, trackSwitch, contiguous, duration, accurateTimeOffset, defaultInitPTS }, data instanceof ArrayBuffer ? [data] : []);
    } else {
      let demuxer = this.demuxer;
      if (demuxer) {
        demuxer.push(data, decryptdata, initSegment, audioCodec, videoCodec, timeOffset, discontinuity, trackSwitch, contiguous, duration, accurateTimeOffset, defaultInitPTS);
      }
    }
  }

  onWorkerMessage (ev) {
    let data = ev.data,
      hls = this.hls;
    switch (data.event) {
    case 'init':
      // revoke the Object URL that was used to create demuxer worker, so as not to leak it
      global.URL.revokeObjectURL(this.w.objectURL);
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
      data.data.frag = this.frag;
      data.data.id = this.id;
      hls.trigger(data.event, data.data);
      break;
    }
  }
}

export default Demuxer;
