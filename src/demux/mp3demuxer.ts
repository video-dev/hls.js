/**
 * MP3 demuxer
 */
import ID3 from '../demux/id3';
import { logger } from '../utils/logger';
import MpegAudio from './mpegaudio';
import { DemuxerResult, Demuxer, DemuxedTrack } from '../types/demuxer';
import { dummyTrack } from './dummy-demuxed-track';
import { appendUint8Array } from '../utils/mp4-tools';

class MP3Demuxer implements Demuxer {
  private observer: any;
  private config: any;
  private _audioTrack!: any;
  private _id3Track!: DemuxedTrack;
  private frameIndex: number = 0;
  private cachedData: Uint8Array = new Uint8Array();
  private initPTS: number | null = null;
  static readonly minProbeByteLength: number = 4;

  constructor (observer, config) {
    this.observer = observer;
    this.config = config;
  }

  resetInitSegment (audioCodec, videoCodec, duration) {
    this._audioTrack = { container: 'audio/mpeg', type: 'audio', id: -1, sequenceNumber: 0, isAAC: false, samples: [], len: 0, manifestCodec: audioCodec, duration: duration, inputTimeScale: 90000 };
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

  static probe (data) {
    if (!data) {
      return false;
    }

    // check if data contains ID3 timestamp and MPEG sync word
    // Look for MPEG header | 1111 1111 | 111X XYZX | where X can be either 0 or 1 and Y or Z should be 1
    // Layer bits (position 14 and 15) in header should be always different from 0 (Layer I or Layer II or Layer III)
    // More info http://www.mp3-tech.org/programmer/frame_header.html
    const id3Data = ID3.getID3Data(data, 0) || [];
    let offset = id3Data.length;

    for (let length = data.length; offset < length; offset++) {
      if (MpegAudio.probe(data, offset)) {
        logger.log('MPEG Audio sync word found !');
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

    while (offset < length) {
      if (MpegAudio.canParse(data, offset)) {
        const frame = MpegAudio.appendFrame(track, data, offset, this.initPTS, this.frameIndex);
        if (frame) {
          this.frameIndex++;
          pts = frame.sample.pts;
          offset += frame.length;
          lastDataIndex = offset;
        } else {
          offset = length;
        }
      } else if (ID3.canParse(data, offset)) {
        id3Data = ID3.getID3Data(data, offset);
        id3Track.samples.push({ pts: pts, dts: pts, data: id3Data });
        offset += id3Data.length;
        lastDataIndex = offset;
      } else {
        offset++;
      }
      if (offset === length && lastDataIndex !== length) {
        const partialData = data.slice(lastDataIndex);
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
      id3Track: this._id3Track,
      textTrack: dummyTrack()
    };
  }

  destroy () {
  }
}

export default MP3Demuxer;
