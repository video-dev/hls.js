/**
 * MP4 demuxer
 */
import { logger } from '../utils/logger';
import { DemuxerResult} from '../types/demuxer';
import { findBox } from '../utils/mp4-tools';
import NonProgressiveDemuxer from './non-progressive-demuxer';
import { dummyTrack } from './dummy-demuxed-track';

const minProbeLength = 16384; // 16Kb
class MP4Demuxer extends NonProgressiveDemuxer {
  static readonly minProbeByteLength = 16384;

  resetTimeStamp () {
  }

  resetInitSegment () {
  }

  static probe (data) {
    // ensure we find a moof box in the first 16 kB
    return findBox({ data: data, start: 0, end: Math.min(data.length, minProbeLength) }, ['moof']).length > 0;
  }

  demuxInternal (data, timeOffset, contiguous, accurateTimeOffset): DemuxerResult {
      const avcTrack = dummyTrack();
      avcTrack.samples = data;

    return {
      audioTrack: dummyTrack(),
      avcTrack,
      id3Track: dummyTrack(),
      textTrack: dummyTrack()
    };
  }

  demuxSampleAes (data: Uint8Array, decryptData: Uint8Array, timeOffset: number, contiguous: boolean): Promise<DemuxerResult> {
    return Promise.reject(new Error('The MP4 demuxer does not support SAMPLE-AES decryption'));
  }

  destroy () {}
}

export default MP4Demuxer;
