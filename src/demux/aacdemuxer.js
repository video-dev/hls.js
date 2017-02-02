/**
 * AAC demuxer
 */
import ADTS from './adts';
import {logger} from '../utils/logger';
import ID3 from '../demux/id3';

 class AACDemuxer {

  constructor(observer, id, remuxerClass, config, typeSupported) {
    this.observer = observer;
    this.id = id;
    this.remuxerClass = remuxerClass;
    this.config = config;
    this.remuxer = new this.remuxerClass(observer,id, config, typeSupported);
    this.insertDiscontinuity();
  }

  insertDiscontinuity() {
    this._aacTrack = {container : 'audio/adts', type: 'audio', id :-1, sequenceNumber: 0, isAAC : true , samples : [], len : 0};
  }

  static probe(data) {
    // check if data contains ID3 timestamp and ADTS sync worc
    var id3 = new ID3(data), offset,len;
    if(id3.hasTimeStamp) {
      // look for ADTS header (0xFFFx)
      for (offset = id3.length, len = data.length; offset < len - 1; offset++) {
        if ((data[offset] === 0xff) && (data[offset+1] & 0xf0) === 0xf0) {
          //logger.log('ADTS sync word found !');
          return true;
        }
      }
    }
    return false;
  }


  // feed incoming data to the front of the parsing pipeline
  push(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration,accurateTimeOffset, defaultInitPTS) {
    var track,
        id3 = new ID3(data),
        pts = 90*id3.timeStamp,
        config, frameLength, frameDuration, frameIndex, offset, headerLength, stamp, len, aacSample;

    let contiguous = false;
    if (cc !== this.lastCC) {
      logger.log(`${this.id} discontinuity detected`);
      this.lastCC = cc;
      this.insertDiscontinuity();
      this.remuxer.switchLevel();
      this.remuxer.insertDiscontinuity();
    } else if (level !== this.lastLevel) {
      logger.log('audio track switch detected');
      this.lastLevel = level;
      this.remuxer.switchLevel();
      this.insertDiscontinuity();
    } else if (sn === (this.lastSN+1)) {
      contiguous = true;
    }
    track = this._aacTrack;
    this.lastSN = sn;
    this.lastLevel = level;

    // look for ADTS header (0xFFFx)
    for (offset = id3.length, len = data.length; offset < len - 1; offset++) {
      if ((data[offset] === 0xff) && (data[offset+1] & 0xf0) === 0xf0) {
        break;
      }
    }

    if (!track.audiosamplerate) {
      config = ADTS.getAudioConfig(this.observer,data, offset, audioCodec);
      track.config = config.config;
      track.audiosamplerate = config.samplerate;
      track.channelCount = config.channelCount;
      track.codec = config.codec;
      track.manifestCodec = config.manifestCodec;
      track.duration = duration;
      logger.log(`parsed codec:${track.codec},rate:${config.samplerate},nb channel:${config.channelCount}`);
    }
    frameIndex = 0;
    frameDuration = 1024 * 90000 / track.audiosamplerate;
    while ((offset + 5) < len) {
      // The protection skip bit tells us if we have 2 bytes of CRC data at the end of the ADTS header
      headerLength = (!!(data[offset + 1] & 0x01) ? 7 : 9);
      // retrieve frame size
      frameLength = ((data[offset + 3] & 0x03) << 11) |
                     (data[offset + 4] << 3) |
                    ((data[offset + 5] & 0xE0) >>> 5);
      frameLength  -= headerLength;
      //stamp = pes.pts;

      if ((frameLength > 0) && ((offset + headerLength + frameLength) <= len)) {
        stamp = pts + frameIndex * frameDuration;
        //logger.log(`AAC frame, offset/length/total/pts:${offset+headerLength}/${frameLength}/${data.byteLength}/${(stamp/90).toFixed(0)}`);
        aacSample = {unit: data.subarray(offset + headerLength, offset + headerLength + frameLength), pts: stamp, dts: stamp};
        track.samples.push(aacSample);
        track.len += frameLength;
        offset += frameLength + headerLength;
        frameIndex++;
        // look for ADTS header (0xFFFx)
        for ( ; offset < (len - 1); offset++) {
          if ((data[offset] === 0xff) && ((data[offset + 1] & 0xf0) === 0xf0)) {
            break;
          }
        }
      } else {
        break;
      }
    }
    this.remuxer.remux(level, sn , cc, track,{samples : []}, {samples : [ { pts: pts, dts : pts, unit : id3.payload} ]}, { samples: [] }, timeOffset, contiguous,accurateTimeOffset, defaultInitPTS);
  }

  destroy() {
  }

}

export default AACDemuxer;
