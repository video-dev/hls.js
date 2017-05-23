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
    this._audioTrack = {container : 'audio/adts', type: 'audio', id :-1, sequenceNumber: 0, isAAC : true , samples : [], len : 0, manifestCodec : audioCodec, duration : duration, inputTimeScale : 90000};
  }

  resetTimeStamp() {
  }

  static probe(data) {
    // check if data contains ID3 timestamp and ADTS sync word
    var offset, length;
    let id3Data = ID3.getID3Data(data, 0);
    if (id3Data && ID3.getTimeStamp(id3Data) !== undefined) {
      // Look for ADTS header | 1111 1111 | 1111 X00X | where X can be either 0 or 1
      // Layer bits (position 14 and 15) in header should be always 0 for ADTS
      // More info https://wiki.multimedia.cx/index.php?title=ADTS
      for (offset = id3Data.length, length = Math.min(data.length - 1, offset + 100); offset < length; offset++) {
        if (ADTS.isHeader(data, offset)) {
          //logger.log('ADTS sync word found !');
          return true;
        }
      }
    }
    return false;
  }

  // feed incoming data to the front of the parsing pipeline
  append(data, timeOffset, contiguous, accurateTimeOffset) {
    var track,
        config, frameLength, frameDuration, frameIndex, offset, headerLength, stamp, length, aacSample, start;

    let id3Data = ID3.getID3Data(data, 0);
    let pts = 90 * ID3.getTimeStamp(id3Data);
    stamp = pts;

    let id3Samples = [];
    id3Samples.push({ pts: pts, dts : pts, data : id3Data });

    track = this._audioTrack;
    start = id3Data.length;

    frameIndex = 0;

    offset = start;
    length = data.length

    while (offset < length - 1) {
      if (ADTS.isHeader(data, offset) && (offset + 5) < length) {
        if (!track.samplerate) {
          config = ADTS.getAudioConfig(this.observer,data, offset, track.manifestCodec);
          track.config = config.config;
          track.samplerate = config.samplerate;
          track.channelCount = config.channelCount;
          track.codec = config.codec;
          logger.log(`parsed codec:${track.codec},rate:${config.samplerate},nb channel:${config.channelCount}`);
        }

        frameDuration = 1024 * 90000 / track.samplerate;

        var aacFrame = this.parseAACFrame(data, offset, pts, frameIndex, frameDuration);
        if (aacFrame) {
          stamp = aacFrame.stamp;
          headerLength = aacFrame.headerLength;
          frameLength = aacFrame.frameLength;

          //logger.log(`AAC frame, offset/length/total/pts:${offset+headerLength}/${frameLength}/${data.byteLength}/${(stamp/90).toFixed(0)}`);

          aacSample = { unit: data.subarray(offset + headerLength, offset + headerLength + frameLength), pts: stamp, dts: stamp };
          track.samples.push(aacSample);
          track.len += frameLength;
          offset += frameLength + headerLength;
          frameIndex++;
        } else {
          //logger.log('Unable to parse AAC frame');
          offset++;
        }
      } else if (ID3.isHeader(data, offset)) {
        id3Data = ID3.getID3Data(data, offset);
        id3Samples.push({ pts: stamp, dts : stamp, data : id3Data });
        offset += id3Data.length;
      } else {
        //nothing found, keep looking
        offset++;
      }
    }

    this.remuxer.remux(track,
                        {samples : []},
                        {samples : id3Samples, inputTimeScale : 90000},
                        {samples : []},
                        timeOffset,
                        contiguous,
                        accurateTimeOffset);
  }

  parseAACFrame(data, offset, pts, frameIndex, frameDuration) {
    var headerLength, frameLength, stamp;
    var length = data.length;

    // The protection skip bit tells us if we have 2 bytes of CRC data at the end of the ADTS header
    headerLength = (!!(data[offset + 1] & 0x01) ? 7 : 9);
    // retrieve frame size
    frameLength = ((data[offset + 3] & 0x03) << 11) |
                   (data[offset + 4] << 3) |
                  ((data[offset + 5] & 0xE0) >>> 5);
    frameLength  -= headerLength;
    //stamp = pes.pts;

    if ((frameLength > 0) && ((offset + headerLength + frameLength) <= length)) {
      stamp = pts + frameIndex * frameDuration;
      //logger.log(`AAC frame, offset/length/total/pts:${offset+headerLength}/${frameLength}/${data.byteLength}/${(stamp/90).toFixed(0)}`);
      return { headerLength, frameLength, stamp }
    }

    return undefined;
  }

  destroy() {
  }

}

export default AACDemuxer;
