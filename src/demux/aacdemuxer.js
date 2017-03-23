/**
 * AAC demuxer
 */
import ADTS from './adts';
import {logger} from '../utils/logger';
import ID3 from '../demux/id3';

 class AACDemuxer {

  constructor(observer, remuxer, config) {
    this.observer = observer;
    this.config = config;
    this.remuxer = remuxer;
  }

  resetInitSegment(initSegment,audioCodec,videoCodec, duration) {
    this._aacTrack = {container : 'audio/adts', type: 'audio', id :-1, sequenceNumber: 0, isAAC : true , samples : [], len : 0, manifestCodec : audioCodec, duration : duration, inputTimeScale : 90000};
  }

  resetTimeStamp() {
  }

  // Source for probe info - https://wiki.multimedia.cx/index.php?title=ADTS
  static probe(data) {
    var id3 = new ID3(data), offset, len;
    for ( offset = id3.length || 0, len = data.length; offset < len - 1; offset++) {
      // ADTS Header is | 1111 1111 | 1111 X00X | where X can be either 0 or 1
      if ((data[offset] === 0xff) && (data[offset+1] & 0xf6) === 0xf0) {
        //logger.log('ADTS sync word found !');
        return true;
      }
    }
    return false;
  }

  // feed incoming data to the front of the parsing pipeline
  append(data, timeOffset, contiguous,accurateTimeOffset) {
    var track,
        id3 = new ID3(data),
        pts, config, frameLength, frameDuration, frameIndex, offset, headerLength, stamp, len, aacSample;

    // Use ID3 Timestamp if needed, as in v4 audio tracks.  Otherwise, concat AAC audio in the order it comes in.
    pts = (id3.timeStamp) ? 90 * id3.timeStamp : timeOffset * 90000;

    track = this._aacTrack;

    // look for ADTS header (0xFFFx)
    for (offset = id3.length, len = data.length; offset < len - 1; offset++) {
      if ((data[offset] === 0xff) && (data[offset+1] & 0xf0) === 0xf0) {
        break;
      }
    }

    if (!track.samplerate) {
      config = ADTS.getAudioConfig(this.observer,data, offset, track.manifestCodec);
      track.config = config.config;
      track.samplerate = config.samplerate;
      track.channelCount = config.channelCount;
      track.codec = config.codec;
      logger.log(`parsed codec:${track.codec},rate:${config.samplerate},nb channel:${config.channelCount}`);
    }
    frameIndex = 0;
    frameDuration = 1024 * 90000 / track.samplerate;
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
    const id3Track = (id3.payload) ? { samples : [ { pts: pts, dts : pts, unit : id3.payload} ] } : { samples: [] };
    this.remuxer.remux(track,
                        {samples : []},
                        id3Track,
                        {samples : []},
                        timeOffset,
                        contiguous,
                        accurateTimeOffset);
  }

  destroy() {
  }

}

export default AACDemuxer;
