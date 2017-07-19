/*  inline demuxer.
 *   probe fragments and instantiate appropriate demuxer depending on content type (TSDemuxer, AACDemuxer, ...)
 */

import Event from '../events';
import { ErrorTypes, ErrorDetails } from '../errors';
import Decrypter from '../crypt/decrypter';
import AACDemuxer from '../demux/aacdemuxer';
import MP4Demuxer from '../demux/mp4demuxer';
import TSDemuxer from '../demux/tsdemuxer';
import MP3Demuxer from '../demux/mp3demuxer';
import MP4Remuxer from '../remux/mp4-remuxer';
import PassThroughRemuxer from '../remux/passthrough-remuxer';

class DemuxerInline {

  constructor(observer, typeSupported, config, vendor) {
    this._observer = observer;
    this._typeSupported = typeSupported;
    this._config = config;
    this._vendor = vendor;
  }

  destroy() {
    var demuxer = this._demuxer;
    if (demuxer) {
      demuxer.destroy();
    }
  }

  push(data, decryptdata, initSegment, audioCodec, videoCodec, timeOffset, discontinuity, trackSwitch, contiguous, duration, accurateTimeOffset, defaultInitPTS) {
    if ((data.byteLength > 0) && (decryptdata != null) && (decryptdata.key != null) && (decryptdata.method === 'AES-128')) {
      let decrypter = this._decrypter;
      if (decrypter == null) {
        decrypter = this._decrypter = new Decrypter(this._observer, this._config);
      }
      var localthis = this;
      // performance.now() not available on WebWorker, at least on Safari Desktop
      var startTime;
      try {
        startTime = performance.now();
      } catch (error) {
        startTime = Date.now();
      }
      decrypter.decrypt(data, decryptdata.key.buffer, decryptdata.iv.buffer, function (decryptedData) {
        var endTime;
        try {
          endTime = performance.now();
        } catch (error) {
          endTime = Date.now();
        }
        localthis._observer.trigger(Event.FRAG_DECRYPTED, { stats: { tstart: startTime, tdecrypt: endTime } });
        localthis._pushDecrypted(new Uint8Array(decryptedData), decryptdata, new Uint8Array(initSegment), audioCodec, videoCodec, timeOffset, discontinuity, trackSwitch, contiguous, duration, accurateTimeOffset, defaultInitPTS);
      });
    } else {
      this._pushDecrypted(new Uint8Array(data), decryptdata, new Uint8Array(initSegment), audioCodec, videoCodec, timeOffset, discontinuity, trackSwitch, contiguous, duration, accurateTimeOffset, defaultInitPTS);
    }
  }

  _pushDecrypted(data, decryptdata, initSegment, audioCodec, videoCodec, timeOffset, discontinuity, trackSwitch, contiguous, duration, accurateTimeOffset, defaultInitPTS) {
    var demuxer = this._demuxer;
    if (!demuxer ||
      // in case of continuity change, we might switch from content type (AAC container to TS container for example)
      // so let's check that current demuxer is still valid
      (discontinuity && !this._probe(data))) {
      const observer = this._observer;
      const typeSupported = this._typeSupported;
      const config = this._config;
      // probing order is TS/AAC/MP3/MP4
      const muxConfig = [
        { demux: TSDemuxer, remux: MP4Remuxer },
        { demux: AACDemuxer, remux: MP4Remuxer },
        { demux: MP3Demuxer, remux: MP4Remuxer },
        { demux: MP4Demuxer, remux: PassThroughRemuxer }

      // probe for content type
      for (let i = 0, len = muxConfig.length; i < len; i++) {
        const mux = muxConfig[i];
        const probe = mux.demux.probe;
        if (probe(data)) {
          const remuxer = this._remuxer = new mux.remux(observer, config, typeSupported, this._vendor);
          demuxer = new mux.demux(observer, remuxer, config, typeSupported);
          this._probe = probe;
          break;
        }
      }
      if (!demuxer) {
        observer.trigger(Event.ERROR, { type: ErrorTypes.MEDIA_ERROR, details: ErrorDetails.FRAG_PARSING_ERROR, fatal: true, reason: 'no demux matching with content found' });
        return;
      }
      this._demuxer = demuxer;
    }
    const remuxer = this._remuxer;

    if (discontinuity || trackSwitch) {
      demuxer.resetInitSegment(initSegment, audioCodec, videoCodec, duration);
      remuxer.resetInitSegment();
    }
    if (discontinuity) {
      demuxer.resetTimeStamp(defaultInitPTS);
      remuxer.resetTimeStamp(defaultInitPTS);
    }
    if (typeof demuxer.setDecryptData === 'function') {
      demuxer.setDecryptData(decryptdata);
    }
    demuxer.append(data, timeOffset, contiguous, accurateTimeOffset);
  }
}

export default DemuxerInline;
