import * as ID3 from '../demux/id3';
import type {
  DemuxerResult,
  Demuxer,
  DemuxedAudioTrack,
  AudioFrame,
  DemuxedMetadataTrack,
  DemuxedVideoTrack,
  DemuxedUserdataTrack,
  KeyData,
} from '../types/demuxer';
import { dummyTrack } from './dummy-demuxed-track';
import { appendUint8Array } from '../utils/mp4-tools';
import { sliceUint8 } from '../utils/typed-array';

class BaseAudioDemuxer implements Demuxer {
  protected _audioTrack!: DemuxedAudioTrack;
  protected _id3Track!: DemuxedMetadataTrack;
  protected frameIndex: number = 0;
  protected cachedData: Uint8Array | null = null;
  protected initPTS: number | null = null;

  resetInitSegment(
    initSegment: Uint8Array | undefined,
    audioCodec: string | undefined,
    videoCodec: string | undefined,
    trackDuration: number
  ) {
    this._id3Track = {
      type: 'id3',
      id: 3,
      pid: -1,
      inputTimeScale: 90000,
      sequenceNumber: 0,
      samples: [],
      dropped: 0,
    };
  }

  resetTimeStamp() {}

  resetContiguity(): void {}

  canParse(data: Uint8Array, offset: number): boolean {
    return false;
  }

  appendFrame(
    track: DemuxedAudioTrack,
    data: Uint8Array,
    offset: number
  ): AudioFrame | void {}

  // feed incoming data to the front of the parsing pipeline
  demux(data: Uint8Array, timeOffset: number): DemuxerResult {
    if (this.cachedData) {
      data = appendUint8Array(this.cachedData, data);
      this.cachedData = null;
    }

    let id3Data: Uint8Array | undefined = ID3.getID3Data(data, 0);
    let offset = id3Data ? id3Data.length : 0;
    let lastDataIndex;
    let pts;
    const track = this._audioTrack;
    const id3Track = this._id3Track;
    const timestamp = id3Data ? ID3.getTimeStamp(id3Data) : undefined;
    const length = data.length;

    if (this.frameIndex === 0 || this.initPTS === null) {
      this.initPTS = initPTSFn(timestamp, timeOffset);
    }

    // more expressive than alternative: id3Data?.length
    if (id3Data && id3Data.length > 0) {
      id3Track.samples.push({
        pts: this.initPTS,
        dts: this.initPTS,
        data: id3Data,
      });
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
        // after a ID3.canParse, a call to ID3.getID3Data *should* always returns some data
        id3Data = ID3.getID3Data(data, offset)!;
        id3Track.samples.push({ pts: pts, dts: pts, data: id3Data });
        offset += id3Data.length;
        lastDataIndex = offset;
      } else {
        offset++;
      }
      if (offset === length && lastDataIndex !== length) {
        const partialData = sliceUint8(data, lastDataIndex);
        if (this.cachedData) {
          this.cachedData = appendUint8Array(this.cachedData, partialData);
        } else {
          this.cachedData = partialData;
        }
      }
    }

    return {
      audioTrack: track,
      videoTrack: dummyTrack() as DemuxedVideoTrack,
      id3Track,
      textTrack: dummyTrack() as DemuxedUserdataTrack,
    };
  }

  demuxSampleAes(
    data: Uint8Array,
    keyData: KeyData,
    timeOffset: number
  ): Promise<DemuxerResult> {
    return Promise.reject(
      new Error(`[${this}] This demuxer does not support Sample-AES decryption`)
    );
  }

  flush(timeOffset: number): DemuxerResult {
    // Parse cache in case of remaining frames.
    const cachedData = this.cachedData;
    if (cachedData) {
      this.cachedData = null;
      this.demux(cachedData, 0);
    }

    this.frameIndex = 0;

    return {
      audioTrack: this._audioTrack,
      videoTrack: dummyTrack() as DemuxedVideoTrack,
      id3Track: this._id3Track,
      textTrack: dummyTrack() as DemuxedUserdataTrack,
    };
  }

  destroy() {}
}

/**
 * Initialize PTS
 * <p>
 *    use timestamp unless it is undefined, NaN or Infinity
 * </p>
 */
export const initPTSFn = (
  timestamp: number | undefined,
  timeOffset: number
): number => {
  return Number.isFinite(timestamp as number)
    ? timestamp! * 90
    : timeOffset * 90000;
};
export default BaseAudioDemuxer;
