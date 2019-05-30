/**
 * MP3 demuxer
 */
import ID3 from '../demux/id3';
import { logger } from '../utils/logger';
import MpegAudio from './mpegaudio';
import { DemuxerResult, Demuxer } from '../types/demuxer';
import { dummyTrack } from './dummy-demuxed-track';
import { appendUint8Array } from '../utils/mp4-tools';

class MP3Demuxer implements Demuxer {
  private _audioTrack!: any;
  private cachedData: Uint8Array = new Uint8Array();
  private frameIndex: number = 0;
  private initPTS: number | null = null;
  static readonly minProbeByteLength: number = 4;

  resetInitSegment (audioCodec, videoCodec, duration) {
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
  demux (data, timeOffset) {
    if (this.cachedData.length) {
      data = appendUint8Array(this.cachedData, data);
      this.cachedData = new Uint8Array();
    }

    let id3Data = ID3.getID3Data(data, 0) || [];
    let offset = id3Data.length;
    let pts;
    const track = this._audioTrack;
    const timestamp = ID3.getTimeStamp(id3Data);
    const length = data.length;
    const id3Samples: any[] = [];
    
    if (this.initPTS === null) {
      this.initPTS = timestamp ? 90 * timestamp : timeOffset * 90000;
    }

    if (id3Data.length) {
      id3Samples.push({ pts: this.initPTS, dts: this.initPTS, data: id3Data });
    }

    while (offset < length) {
      if (MpegAudio.canParse(data, offset)) {
        let frame = MpegAudio.appendFrame(track, data, offset, this.initPTS, this.frameIndex);
        if (frame) {
          offset += frame.length;
          pts = frame.sample.pts;
          this.frameIndex++;
        } else {
          let partialData = data.slice(offset);

          this.cachedData = appendUint8Array(this.cachedData, partialData);
          offset += partialData.length;
        }
      } else if (ID3.canParse(data, offset)) {
        id3Data = ID3.getID3Data(data, offset);
        id3Samples.push({ pts: pts, dts: pts, data: id3Data });
        offset += id3Data.length;
      } else {
        let partialData = data.slice(offset);

        this.cachedData = appendUint8Array(this.cachedData, partialData);
        offset += partialData.length;
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
    return Promise.reject(new Error('The MP3 demuxer does not support SAMPLE-AES decryption'));
  }

  flush (timeOffset): DemuxerResult {
    // Parse cache in case of remaining frames.
    if (this.cachedData) {
      this.demux(this.cachedData, 0);
    }
    
    this.frameIndex = 0;
    this.initPTS = null;
    this.cachedData = new Uint8Array();
    
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

export default MP3Demuxer;
