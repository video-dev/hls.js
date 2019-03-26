export interface Demuxer {
  demux (data: Uint8Array, timeOffset: number, contiguous: boolean, isSampleAes?: boolean) : DemuxerResult
  demuxSampleAes (data: Uint8Array, decryptData: Uint8Array, timeOffset: number, contiguous: boolean) : Promise<DemuxerResult>
  flush(timeOffset?: number, contiguous?: boolean): DemuxerResult
  destroy() : void
  resetInitSegment(initSegment: Uint8Array, audioCodec: string, videoCodec: string, duration: number);
  resetTimeStamp(defaultInitPTS?: number | null): void;
}

export interface DemuxerResult {
  audioTrack: DemuxedAudioTrack
  avcTrack: DemuxedAvcTrack
  id3Track: DemuxedTrack
  textTrack: DemuxedTrack
}

export interface DemuxedTrack {
  type: string
  id: number
  pid: number
  inputTimeScale: number
  sequenceNumber: number
  samples: any
  len: number,
  timescale?: number
  container?: string
  dropped?: number
  duration?: number
  pesData?: ElementaryStreamData | null
  codec?: string
}

export interface DemuxedAudioTrack extends DemuxedTrack {
  config?: Array<number>
  samplerate?: number
  isAAC?: boolean
  channelCount?: number
}

export interface DemuxedAvcTrack extends DemuxedTrack {
  width?: number
  height?: number
  pixelRatio?: number
  audFound?: boolean
  pps?: Array<number>
  sps?: Array<number>
  naluState?: number
}

export interface ElementaryStreamData {
  data: Array<number>
  size: number
}
