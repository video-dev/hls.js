/**
 * AAC demuxer
 */
import * as ADTS from './adts';
import { logger } from '../utils/logger';
import ID3 from '../demux/id3';
import {DemuxerResult, Demuxer, DemuxedTrack} from '../types/demuxer';
import { dummyTrack } from './dummy-demuxed-track';
import { appendUint8Array } from '../utils/mp4-tools';

class AACDemuxer implements Demuxer {
  private observer: any;
  private config: any;
  private _audioTrack!: any;
  private _id3Track!: DemuxedTrack;
  private frameIndex: number = 0;
  private cachedData: Uint8Array = new Uint8Array();
  private initPTS: number | null = null;
  static readonly minProbeByteLength: number = 9;
  
  constructor (observer, config) {
    this.observer = observer;
    this.config = config;
  }

  resetInitSegment (audioCodec, videoCodec, duration) {
    this._audioTrack = { container: 'audio/adts', type: 'audio', id: 0, sequenceNumber: 0, isAAC: true, samples: [], len: 0, manifestCodec: audioCodec, duration: duration, inputTimeScale: 90000 };
    this._id3Track = {
      type: 'id3',
      id: 0,
      pid: -1,
      inputTimeScale: 90000,
      sequenceNumber: 0,
      samples: [],
      dropped: 0
    };
  }

  resetTimeStamp () {
  }

  resetContiguity (): void {
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
    let lastDataIndex;
    let pts;
    const track = this._audioTrack;
    const id3Track = this._id3Track;
    const timestamp = ID3.getTimeStamp(id3Data);
    const length = data.length;

    if (this.initPTS === null) {
      this.initPTS = Number.isFinite(timestamp) ? timestamp * 90 : timeOffset * 90000;
    }
    
    if (id3Data.length) {
      id3Track.samples.push({ pts: this.initPTS, dts: this.initPTS, data: id3Data });
    }
    
    pts = this.initPTS;
    
    // Iteratively parse data for ADTS Headers and ID3 headers
    while (offset < length) {
      //  Only begin parsing if able.
      if (ADTS.canParse(data, offset)) {
        ADTS.initTrackConfig(track, this.observer, data, offset, track.manifestCodec);
        let frame = ADTS.appendFrame(track, data, offset, this.initPTS, this.frameIndex);
        if (frame) {
          this.frameIndex++;
          pts = frame.sample.pts;
          offset += frame.length;
          lastDataIndex = offset;
        } else {
          logger.log('Unable to parse AAC frame');
          let partialData = data.slice(offset);

          this.cachedData = appendUint8Array(this.cachedData, partialData);
          offset += partialData.length;
        }
      } else if (ID3.canParse(data, offset)) {
        id3Data = ID3.getID3Data(data, offset);
        id3Track.samples.push({ pts: pts, dts: pts, data: id3Data });
        offset += id3Data.length;
        lastDataIndex = offset;
      } else {
        offset++;
      }
      // At end of fragment, if there is remaining data, append everything since last useable data to cache.
      if (offset === length && lastDataIndex !== length) {
          let partialData = data.slice(lastDataIndex);
          this.cachedData = appendUint8Array(this.cachedData, partialData);
      }
    }

    return {
      audioTrack: track,
      avcTrack: dummyTrack(),
      id3Track,
      textTrack: dummyTrack()
    };
  }

  demuxSampleAes (data: Uint8Array, decryptData: Uint8Array, timeOffset: number): Promise<DemuxerResult> {
    return Promise.reject(new Error('The AAC demuxer does not support Sample-AES decryption'));
  }

  flush (timeOffset): DemuxerResult {
    // Parse cache in case of remaining frames.
    if (this.cachedData) {
      this.demux(this.cachedData, 0);
    }
    
    this.frameIndex = 0;
    this.cachedData = new Uint8Array();
    this.initPTS = null;
    
    return {
      audioTrack: this._audioTrack,
      avcTrack: dummyTrack(),
      id3Track: this._id3Track,
      textTrack: dummyTrack()
    };
  }

  destroy () {
  }
}

export default AACDemuxer;
