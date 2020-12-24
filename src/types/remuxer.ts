import type { TrackSet } from './track';
import {
  DemuxedAudioTrack,
  DemuxedTrack, DemuxedVideoTrack,
  MetadataSample,
  UserdataSample
} from './demuxer';
import type { SourceBufferName } from './buffer';

export interface Remuxer {
  remux(audioTrack: DemuxedAudioTrack,
        videoTrack: DemuxedVideoTrack,
        id3Track: DemuxedTrack,
        textTrack: DemuxedTrack,
        timeOffset: number,
        accurateTimeOffset: boolean
  ): RemuxerResult
  resetInitSegment(initSegment: Uint8Array, audioCodec: string | undefined, videoCodec: string | undefined): void
  resetTimeStamp(defaultInitPTS): void
  resetNextTimestamp() : void
  destroy() : void
}

export interface RemuxedTrack {
  data1: Uint8Array
  data2?: Uint8Array
  startPTS: number
  endPTS: number
  startDTS: number
  endDTS: number
  type: SourceBufferName
  hasAudio: boolean
  hasVideo: boolean
  independent?: boolean
  nb: number
  transferredData1?: ArrayBuffer
  transferredData2?: ArrayBuffer
  dropped?: number
}

export interface RemuxedMetadata {
  samples: MetadataSample[]
}

export interface RemuxedUserdata {
  samples: UserdataSample[]
}

export interface RemuxerResult {
  audio?: RemuxedTrack
  video?: RemuxedTrack
  text?: RemuxedUserdata
  id3?: RemuxedMetadata
  initSegment?: InitSegmentData
  independent?: boolean
}

export interface InitSegmentData {
  tracks?: TrackSet
  initPTS: number | undefined
  timescale: number | undefined
}
