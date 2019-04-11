import { Demuxer, DemuxerResult } from '../types/demuxer';
import { dummyTrack } from './dummy-demuxed-track';
import ChunkCache from './chunk-cache';

export default class NonProgressiveDemuxer implements Demuxer {
  private cache = new ChunkCache();
  public _isSampleAes: boolean = false;
  static readonly minProbeByteLength: number = 1024; // 1Kb

  demux (data: Uint8Array, timeOffset: number, isSampleAes?: boolean): DemuxerResult {
    this._isSampleAes = !!isSampleAes;
    this.cache.push(data);
    return dummyDemuxResult();
  }

  flush (timeOffset): DemuxerResult {
    const { _isSampleAes } = this;
    const data = this.cache.flush();
    const result = this.demuxInternal(data, timeOffset, _isSampleAes);
    this.reset();

    return result;
  }

  resetInitSegment (audioCodec: string, videoCodec: string, duration: number) {
    this.reset();
  }

  demuxSampleAes (data: Uint8Array, decryptData: Uint8Array, timeOffset: number): Promise<DemuxerResult> {
    return Promise.resolve(dummyDemuxResult());
  }

  resetTimeStamp (defaultInitPTS): void {}

  destroy (): void {}

  protected demuxInternal (data: Uint8Array, timeOffset: number, contiguous: boolean, isSampleAes?: boolean) : DemuxerResult {
    return dummyDemuxResult();
  }

  private reset () {
    this.cache.reset();
    this._isSampleAes = false;
  }
}

const dummyDemuxResult = () : DemuxerResult => ({
  audioTrack: dummyTrack(),
  avcTrack: dummyTrack(),
  id3Track: dummyTrack(),
  textTrack: dummyTrack()
});