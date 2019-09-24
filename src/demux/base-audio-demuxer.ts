import ID3 from '../demux/id3';
import { DemuxerResult, Demuxer, DemuxedTrack, DemuxedAudioTrack } from '../types/demuxer';
import { dummyTrack } from './dummy-demuxed-track';
import { appendUint8Array } from '../utils/mp4-tools';

class BaseAudioDemuxer implements Demuxer {
  protected _audioTrack!: DemuxedAudioTrack;
  protected _id3Track!: DemuxedTrack;
  protected frameIndex: number = 0;
  protected cachedData: Uint8Array = new Uint8Array();
  protected initPTS: number | null = null;

  resetInitSegment (audioCodec: string, videoCodec: string, duration: number) {
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

  canParse (data: Uint8Array, offset: number): boolean {
    return false;
  }

  appendFrame (track: DemuxedAudioTrack, data: Uint8Array, offset: number): { sample, length } | undefined {
    return undefined;
  }

  // feed incoming data to the front of the parsing pipeline
  demux (data: Uint8Array, timeOffset: number): DemuxerResult {
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
      if (this.canParse(data, offset)) {
        const frame = this.appendFrame(track, data, offset);
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
    return Promise.reject(new Error(`[${this}] This demuxer does not support Sample-AES decryption`));
  }

  flush (timeOffset: number): DemuxerResult {
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

  destroy () {}
}

export default BaseAudioDemuxer;
