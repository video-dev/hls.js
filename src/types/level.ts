import LevelDetails from '../loader/level-details';

export interface LevelParsed {
  attrs: LevelAttributes
  audioCodec?: string
  bitrate: number
  details: LevelDetails
  height?: number
  id?: number
  level?: number
  name?: string | undefined
  unknownCodecs?: string[]
  url: string
  videoCodec?: string
  width?: number
}

// audioTracks, captions and subtitles returned by `M3U8Parser.parseMasterPlaylistMedia`
export interface PlaylistMedia {
  audioCodec?: string
  autoselect: boolean
  default: boolean
  details?: LevelDetails
  forced: boolean
  groupId: string | undefined
  id: number
  instreamId: string | undefined
  lang: string | undefined
  name: string | undefined
  type: string
  url?: string
}

export interface LevelAttributes {
  AUDIO?: string
  'AVERAGE-BANDWIDTH'?: string
  SUBTITLES?: string
  BANDWIDTH?: string
  'CLOSED-CAPTIONS'?: string
  CODECS?: string
  'FRAME-RATE'?: string
  'PROGRAM-ID'?: string
  RESOLUTION?: string
}

export class Level {
  public attrs: LevelAttributes;
  public audioCodec?: string;
  public audioGroupIds?: string[];
  public bitrate: number;
  public details: LevelDetails | undefined;
  public fragmentError: boolean = false;
  public height: number;
  public id: number;
  public loadError: number = 0;
  public name: string | undefined;
  public realBitrate: number = 0;
  public textGroupIds?: string[];
  public url: string[];
  public urlId: number = 0;
  public videoCodec?: string;
  public width: number;
  public unknownCodecs: string[] | undefined;

  constructor(data: LevelParsed) {
    this.url = [ data.url ];
    this.attrs = data.attrs;
    this.bitrate = data.bitrate;
    this.details = data.details;
    this.id = data.id || 0;
    this.name = data.name;
    this.width = data.width || 0;
    this.height = data.height || 0;
    this.audioCodec = data.audioCodec;
    this.videoCodec = data.videoCodec;
    this.unknownCodecs = data.unknownCodecs;
  }
}
