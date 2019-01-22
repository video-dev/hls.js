export interface TrackSet {
  audio?: AudioTrack
  video?: VideoTrack
}

export interface AudioTrack {
  buffer: SourceBuffer;
  container: string;
  codec: string;
  initSegment?: Uint8Array;
  levelCodec: string;
}

export interface VideoTrack {
  buffer: SourceBuffer;
  container: string;
  codec: string;
  initSegment?: Uint8Array;
  levelCodec: string;
}
