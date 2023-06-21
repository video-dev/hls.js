import type { RationalTimestamp } from '../utils/timescale-conversion';

export interface Demuxer {
  demux(
    data: Uint8Array,
    timeOffset: number,
    isSampleAes?: boolean,
    flush?: boolean
  ): DemuxerResult;
  demuxSampleAes(
    data: Uint8Array,
    keyData: KeyData,
    timeOffset: number
  ): Promise<DemuxerResult>;
  flush(timeOffset?: number): DemuxerResult | Promise<DemuxerResult>;
  destroy(): void;
  resetInitSegment(
    initSegment: Uint8Array | undefined,
    audioCodec: string | undefined,
    videoCodec: string | undefined,
    trackDuration: number
  );
  resetTimeStamp(defaultInitPTS?: RationalTimestamp | null): void;
  resetContiguity(): void;
}

export interface DemuxerResult {
  audioTrack: DemuxedAudioTrack;
  videoTrack: DemuxedVideoTrack;
  id3Track: DemuxedMetadataTrack;
  textTrack: DemuxedUserdataTrack;
}

export interface DemuxedTrack {
  type: string;
  id: number;
  pid: number;
  inputTimeScale: number;
  sequenceNumber: number;
  samples:
    | AudioSample[]
    | AvcSample[]
    | MetadataSample[]
    | UserdataSample[]
    | Uint8Array;
  timescale?: number;
  container?: string;
  dropped: number;
  duration?: number;
  pesData?: ElementaryStreamData | null;
  codec?: string;
}

export interface PassthroughTrack extends DemuxedTrack {
  sampleDuration: number;
  samples: Uint8Array;
  timescale: number;
  duration: number;
  codec: string;
}
export interface DemuxedAudioTrack extends DemuxedTrack {
  config?: number[] | Uint8Array;
  samplerate?: number;
  segmentCodec?: string;
  channelCount?: number;
  manifestCodec?: string;
  samples: AudioSample[];
}

export interface DemuxedVideoTrack extends DemuxedTrack {
  width?: number;
  height?: number;
  pixelRatio?: [number, number];
  audFound?: boolean;
  pps?: Uint8Array[];
  sps?: Uint8Array[];
  naluState?: number;
  samples: AvcSample[] | Uint8Array;
}

export interface DemuxedAvcTrack extends DemuxedVideoTrack {
  samples: AvcSample[];
}

export interface DemuxedMetadataTrack extends DemuxedTrack {
  samples: MetadataSample[];
}

export interface DemuxedUserdataTrack extends DemuxedTrack {
  samples: UserdataSample[];
}

export const enum MetadataSchema {
  audioId3 = 'org.id3',
  dateRange = 'com.apple.quicktime.HLS',
  emsg = 'https://aomedia.org/emsg/ID3',
}
export interface MetadataSample {
  pts: number;
  dts: number;
  duration: number;
  len?: number;
  data: Uint8Array;
  type: MetadataSchema;
}

export interface UserdataSample {
  pts: number;
  bytes?: Uint8Array;
  type?: number;
  payloadType?: number;
  uuid?: string;
  userData?: string;
  userDataBytes?: Uint8Array;
}

export interface AvcSample {
  dts: number;
  pts: number;
  key: boolean;
  frame: boolean;
  units: AvcSampleUnit[];
  debug: string;
  length: number;
}

export interface AvcSampleUnit {
  data: Uint8Array;
  type: number;
  state?: number;
}

export type AudioSample = {
  unit: Uint8Array;
  pts: number;
};

export type AudioFrame = {
  sample: AudioSample;
  length: number;
  missing: number;
};

export interface ElementaryStreamData {
  data: Uint8Array[];
  size: number;
}

export interface KeyData {
  method: string;
  key: Uint8Array;
  iv: Uint8Array;
}
