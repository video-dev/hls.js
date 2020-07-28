export interface Demuxer {
  demux (data: Uint8Array, timeOffset: number, isSampleAes?: boolean) : DemuxerResult
  demuxSampleAes (data: Uint8Array, decryptData: Uint8Array, timeOffset: number) : Promise<DemuxerResult>
  flush(timeOffset?: number): DemuxerResult
  destroy() : void
  resetInitSegment(audioCodec: string | undefined, videoCodec: string | undefined, duration: number);
  resetTimeStamp(defaultInitPTS?: number | null): void;
  resetContiguity(): void;
}

export interface DemuxerResult {
  audioTrack: DemuxedAudioTrack
  avcTrack: DemuxedAvcTrack
  id3Track: DemuxedMetadataTrack
  textTrack: DemuxedTrack<unknown>
}

export interface DemuxedTrack<T> {
  type: 'audio' | 'video' | 'id3' | 'text'
  id: number
  pid: number
  inputTimeScale: number
  sequenceNumber: number
  samples: T
  timescale?: number
  container?: string
  dropped: number
  duration?: number
  pesData?: ElementaryStreamData | null
  codec?: string
}

export interface DemuxedAudioTrack extends DemuxedTrack<any> {
  type: 'audio',
  config?: Array<number>
  samplerate?: number
  isAAC?: boolean
  channelCount?: number
  manifestCodec?: string
}

export interface DemuxedAvcTrack extends DemuxedTrack<AvcSample[]> {
  type: 'video',
  width?: number
  height?: number
  pixelRatio?: number
  audFound?: boolean
  pps?: Array<number>
  sps?: Array<number>
  naluState?: number
}

export interface DemuxedMetadataTrack extends DemuxedTrack<MetadataSample[]> {
  type: 'id3'
}

export interface DemuxedUserdataTrack extends DemuxedTrack<UserdataSample[]> {
  type: 'text'
}

export interface MetadataSample {
  pts: number,
  dts: number,
  len: number,
  data: Uint8Array;
}

export interface UserdataSample {
  pts: number,
  bytes: Uint8Array;
}

export interface AvcSample {
  dts: number
  pts: number
  key: boolean
  frame: boolean
  units: Array<AvcSampleUnit>,
  debug: string
  length: number
}

export interface AvcSampleUnit {
  data: Uint8Array;
}

export interface ElementaryStreamData {
  data: Array<Uint8Array>
  size: number
}
