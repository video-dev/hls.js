/**
 * MP3 demuxer
 */
import ID3 from '../demux/id3';
import { logger } from '../utils/logger';
import MpegAudio from './mpegaudio';
import { DemuxerResult } from '../types/demuxer';
import NonProgressiveDemuxer from './non-progressive-demuxer';
import { dummyTrack } from './dummy-demuxed-track';

class MP3Demuxer extends NonProgressiveDemuxer {
  private observer: any;
  private config: any;
  private _audioTrack!: any;
  constructor (observer, config) {
    super();
    this.observer = observer;
    this.config = config;
  }

  resetInitSegment (initSegment, audioCodec, videoCodec, duration) {
    this._audioTrack = { container: 'audio/mpeg', type: 'audio', id: -1, sequenceNumber: 0, isAAC: false, samples: [], len: 0, manifestCodec: audioCodec, duration: duration, inputTimeScale: 90000 };
  }

  resetTimeStamp () {
  }

  static probe (data) {
    // check if data contains ID3 timestamp and MPEG sync word
    let offset, length;
    let id3Data = ID3.getID3Data(data, 0);
    if (id3Data && ID3.getTimeStamp(id3Data) !== undefined) {
      // Look for MPEG header | 1111 1111 | 111X XYZX | where X can be either 0 or 1 and Y or Z should be 1
      // Layer bits (position 14 and 15) in header should be always different from 0 (Layer I or Layer II or Layer III)
      // More info http://www.mp3-tech.org/programmer/frame_header.html
      for (offset = id3Data.length, length = Math.min(data.length - 1, offset + 100); offset < length; offset++) {
        if (MpegAudio.probe(data, offset)) {
          logger.log('MPEG Audio sync word found !');
          return true;
        }
      }
    }
    return false;
  }

  // feed incoming data to the front of the parsing pipeline
  demux (data, timeOffset, contiguous, accurateTimeOffset) {
    let id3Data = ID3.getID3Data(data, 0);
    let timestamp = ID3.getTimeStamp(id3Data);
    let pts = timestamp ? 90 * timestamp : timeOffset * 90000;
    let offset = id3Data.length;
    let length = data.length;
    let frameIndex = 0, stamp = 0;
    let track = this._audioTrack;

    let id3Samples = [{ pts: pts, dts: pts, data: id3Data }];

    while (offset < length) {
      if (MpegAudio.isHeader(data, offset)) {
        let frame = MpegAudio.appendFrame(track, data, offset, pts, frameIndex);
        if (frame) {
          offset += frame.length;
          stamp = frame.sample.pts;
          frameIndex++;
        } else {
          // logger.log('Unable to parse Mpeg audio frame');
          break;
        }
      } else if (ID3.isHeader(data, offset)) {
        id3Data = ID3.getID3Data(data, offset);
        id3Samples.push({ pts: stamp, dts: stamp, data: id3Data });
        offset += id3Data.length;
      } else {
        // nothing found, keep looking
        offset++;
      }
    }

    return {
      audioTrack: track,
      avcTrack: dummyTrack(),
      id3Track: dummyTrack(),
      textTrack: dummyTrack()
    };
  }

  demuxSampleAes (data: Uint8Array, decryptData: Uint8Array, timeOffset: number, contiguous: boolean): Promise<DemuxerResult> {
    return Promise.reject(new Error('The MP3 demuxer does not support SAMPLE-AES decryption'));
  }

  destroy () {
  }
}

export default MP3Demuxer;
