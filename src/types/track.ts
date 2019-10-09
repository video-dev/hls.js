export interface TrackSet {
  audio?: Track
  video?: Track
  audiovideo?: Track
}

export interface Track {
  id: 'audio' | 'main'
  buffer?: SourceBuffer
  container: string;
  codec?: string;
  initSegment?: Uint8Array
  levelCodec?: string;
  metadata?: any
}
