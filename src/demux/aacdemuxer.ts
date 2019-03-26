/**
 * AAC demuxer
 */
import * as ADTS from './adts';
import { logger } from '../utils/logger';
import ID3 from '../demux/id3';
import { DemuxerResult } from '../types/demuxer';
import NonProgressiveDemuxer from './non-progressive-demuxer';
import { dummyTrack } from './dummy-demuxed-track';

class AACDemuxer extends NonProgressiveDemuxer {
  private observer: any;
  private config: any;
  private _audioTrack!: any;
  constructor (observer, config) {
    super();
    this.observer = observer;
    this.config = config;
  }

  resetInitSegment (initSegment, audioCodec, videoCodec, duration) {
    this._audioTrack = { container: 'audio/adts', type: 'audio', id: 0, sequenceNumber: 0, isAAC: true, samples: [], len: 0, manifestCodec: audioCodec, duration: duration, inputTimeScale: 90000 };
  }

  resetTimeStamp () {
  }

  // Source for probe info - https://wiki.multimedia.cx/index.php?title=ADTS
  static probe (data) {
    if (!data) {
      return false;
    }

    // Check for the ADTS sync word
    // Look for ADTS header | 1111 1111 | 1111 X00X | where X can be either 0 or 1
    // Layer bits (position 14 and 15) in header should be always 0 for ADTS
    // More info https://wiki.multimedia.cx/index.php?title=ADTS
    const id3Data = ID3.getID3Data(data, 0) || [];
    let offset = id3Data.length;

    for (let length = data.length; offset < length; offset++) {
      if (ADTS.probe(data, offset)) {
        logger.log('ADTS sync word found !');
        return true;
      }
    }
    return false;
  }

  // feed incoming data to the front of the parsing pipeline
  demuxInternal (data, timeOffset, contiguous, accurateTimeOffset): DemuxerResult {
    let track = this._audioTrack;
    let id3Data = ID3.getID3Data(data, 0) || [];
    let timestamp = ID3.getTimeStamp(id3Data);
    let pts = Number.isFinite(timestamp) ? timestamp * 90 : timeOffset * 90000;
    let frameIndex = 0;
    let stamp = pts;
    let length = data.length;
    let offset = id3Data.length;

    let id3Samples = [{ pts: stamp, dts: stamp, data: id3Data }];

    while (offset < length - 1) {
      if (ADTS.isHeader(data, offset) && (offset + 5) < length) {
        ADTS.initTrackConfig(track, this.observer, data, offset, track.manifestCodec);
        let frame = ADTS.appendFrame(track, data, offset, pts, frameIndex);
        if (frame) {
          offset += frame.length;
          stamp = frame.sample.pts;
          frameIndex++;
        } else {
          logger.log('Unable to parse AAC frame');
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
    return Promise.reject(new Error('The AAC demuxer does not support Sample-AES decryption'));
  }

  destroy () {
  }
}

export default AACDemuxer;
