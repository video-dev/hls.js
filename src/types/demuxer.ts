export interface Demuxer<T> {
  demux (data: Uint8Array, options?: T): DemuxerResult; // mp4-demuxer
  demuxSampleAes (data: Uint8Array, decryptData: Uint8Array, timeOffset: number) : Promise<DemuxerResult>
  flush(timeOffset?: number): DemuxerResult
  destroy() : void
  resetInitSegment(audioCodec: string | undefined, videoCodec: string | undefined, duration: number);
  resetTimeStamp(defaultInitPTS?: number | null): void;
  resetContiguity(): void;
}

export type DemuxedTrackType = 'audio' | 'video' | 'id3' | 'text'

export interface DemuxerResult {
  audioTrack: DemuxedAudioTrack
  avcTrack: DemuxedAvcTrack
  id3Track: DemuxedID3Track
  textTrack: DemuxedTrack<unknown, 'text'>
}

export interface DemuxedTrack<Samples, TrackType> {
  type: TrackType
  id: number
  pid: number
  inputTimeScale: number
  sequenceNumber: number
  samples: Samples
  timescale?: number
  container?: string
  dropped: number
  duration?: number
  pesData?: ElementaryStreamData | null
  codec?: string
}

export interface DemuxedAudioTrack extends DemuxedTrack<any, 'audio'> {
  type: 'audio',
  config?: Array<number>
  samplerate?: number
  isAAC?: boolean
  channelCount?: number
  manifestCodec?: string
}

export interface DemuxedAvcTrack extends DemuxedTrack<AvcSample[], 'video'> {
  type: 'video',
  width?: number
  height?: number
  pixelRatio?: number
  audFound?: boolean
  pps?: Array<number>
  sps?: Array<number>
  naluState?: number
}
export type DemuxedID3Track = DemuxedTrack<MetadataSample[], 'id3'>
export type DemuxedTextTrack = DemuxedTrack<UserdataSample[], 'text'>

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
