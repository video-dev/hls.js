export interface TrackSet {
  audio?: Track;
  video?: Track;
  audiovideo?: Track;
}

export interface Track {
  id: 'audio' | 'main';
  buffer?: SourceBuffer; // eslint-disable-line no-restricted-globals
  container: string;
  codec?: string;
  initSegment?: Uint8Array;
  levelCodec?: string;
  metadata?: any;
}
