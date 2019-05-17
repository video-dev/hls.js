/**
 * AAC demuxer
 */
import * as ADTS from './adts';
import { logger } from '../utils/logger';
import ID3 from '../demux/id3';
import { DemuxerResult, Demuxer } from '../types/demuxer';
import { dummyTrack } from './dummy-demuxed-track';
import { appendUint8Array } from '../utils/mp4-tools';

class AACDemuxer implements Demuxer {
  private observer: any;
  private config: any;
  private _audioTrack!: any;
  private frameIndex: number = 0;
  private cachedData: Uint8Array = new Uint8Array();
  static readonly minProbeByteLength: number = 9;
  
  constructor (observer, config) {
    this.observer = observer;
    this.config = config;
  }

  resetInitSegment (audioCodec, videoCodec, duration) {
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
  demux (data, timeOffset): DemuxerResult {
    if (this.cachedData.length) {
      data = appendUint8Array(this.cachedData, data);
      this.cachedData = new Uint8Array();
    }

    let id3Data = ID3.getID3Data(data, 0) || [];
    let offset = id3Data.length;
    let pts;
    const track = this._audioTrack;
    const timestamp = ID3.getTimeStamp(id3Data);
    const initialPts = Number.isFinite(timestamp) ? timestamp * 90 : timeOffset * 90000;
    const length = data.length;
    const id3Samples = [{ pts: initialPts, dts: initialPts, data: id3Data }];
   
    pts = initialPts;
    // Iteratively parse data for ADTS Headers and ID3 headers
    while (offset <= length) {
      //  Only begin parsing if there's at least one full frame
      if (ADTS.canParse(data, offset)) {
        ADTS.initTrackConfig(track, this.observer, data, offset, track.manifestCodec);
        let frame = ADTS.appendFrame(track, data, offset, initialPts, this.frameIndex);
        if (frame) {
          offset += frame.length;
          pts = frame.sample.pts;
          this.frameIndex++;
        } else {
          logger.log('Unable to parse AAC frame');
          this.cachedData = data.slice(offset);
          break;
        }
      } else if (ID3.canParse(data, offset)) {
        id3Data = ID3.getID3Data(data, offset);
        id3Samples.push({ pts: pts, dts: pts, data: id3Data });
        offset += id3Data.length;
      } else {
        // Nothing found, cache and keep looking
        this.cachedData = data.slice(offset);
        break;
      }
    }

    return {
      audioTrack: track,
      avcTrack: dummyTrack(),
      id3Track: dummyTrack(),
      textTrack: dummyTrack()
    };
  }

  demuxSampleAes (data: Uint8Array, decryptData: Uint8Array, timeOffset: number): Promise<DemuxerResult> {
    return Promise.reject(new Error('The AAC demuxer does not support Sample-AES decryption'));
  }

  flush (timeOffset): DemuxerResult {
    this.frameIndex = 0;
    
    return {
      audioTrack: this._audioTrack,
      avcTrack: dummyTrack(),
      id3Track: dummyTrack(),
      textTrack: dummyTrack()
    };
  }

  destroy () {
  }
}

export default AACDemuxer;
