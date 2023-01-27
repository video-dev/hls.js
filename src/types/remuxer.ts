import type { TrackSet } from './track';
import {
  DemuxedAudioTrack,
  DemuxedMetadataTrack,
  DemuxedUserdataTrack,
  DemuxedVideoTrack,
  MetadataSample,
  UserdataSample,
} from './demuxer';
import type { SourceBufferName } from './buffer';
import type { PlaylistLevelType } from './loader';
import type { DecryptData } from '../loader/level-key';
import type { RationalTimestamp } from '../utils/timescale-conversion';

export interface Remuxer {
  remux(
    audioTrack: DemuxedAudioTrack,
    videoTrack: DemuxedVideoTrack,
    id3Track: DemuxedMetadataTrack,
    textTrack: DemuxedUserdataTrack,
    timeOffset: number,
    accurateTimeOffset: boolean,
    flush: boolean,
    playlistType: PlaylistLevelType
  ): RemuxerResult;
  resetInitSegment(
    initSegment: Uint8Array | undefined,
    audioCodec: string | undefined,
    videoCodec: string | undefined,
    decryptdata: DecryptData | null
  ): void;
  resetTimeStamp(defaultInitPTS: RationalTimestamp | null): void;
  resetNextTimestamp(): void;
  destroy(): void;
}

export interface RemuxedTrack {
  data1: Uint8Array;
  data2?: Uint8Array;
  startPTS: number;
  endPTS: number;
  startDTS: number;
  endDTS: number;
  type: SourceBufferName;
  hasAudio: boolean;
  hasVideo: boolean;
  independent?: boolean;
  firstKeyFrame?: number;
  firstKeyFramePTS?: number;
  nb: number;
  transferredData1?: ArrayBuffer;
  transferredData2?: ArrayBuffer;
  dropped?: number;
}

export interface RemuxedMetadata {
  samples: MetadataSample[];
}

export interface RemuxedUserdata {
  samples: UserdataSample[];
}

export interface RemuxerResult {
  audio?: RemuxedTrack;
  video?: RemuxedTrack;
  text?: RemuxedUserdata;
  id3?: RemuxedMetadata;
  initSegment?: InitSegmentData;
  independent?: boolean;
}

export interface InitSegmentData {
  tracks?: TrackSet;
  initPTS: number | undefined;
  timescale: number | undefined;
}
