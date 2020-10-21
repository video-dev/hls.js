export interface TrackSet {
  audio?: AudioTrack
  video?: VideoTrack
}

export interface AudioTrack {
  buffer: SourceBuffer; // eslint-disable-line no-restricted-globals
  container: string;
  codec: string;
  id: string;
  initSegment?: Uint8Array;
  levelCodec: string;
}

export interface VideoTrack {
  buffer: SourceBuffer; // eslint-disable-line no-restricted-globals
  container: string;
  codec: string;
  id: string;
  initSegment?: Uint8Array;
  levelCodec: string;
}
