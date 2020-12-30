import type { DemuxedTrack } from '../types/demuxer';

export function dummyTrack(): DemuxedTrack {
  return {
    type: '',
    id: -1,
    pid: -1,
    inputTimeScale: 90000,
    sequenceNumber: -1,
    samples: [],
    dropped: 0,
  };
}
