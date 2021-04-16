import { LevelDetails } from '../loader/level-details';
import { AttrList } from '../utils/attr-list';

export interface LevelParsed {
  attrs: LevelAttributes;
  audioCodec?: string;
  bitrate: number;
  details?: LevelDetails;
  height?: number;
  id?: number;
  level?: number;
  name: string;
  textCodec?: string;
  unknownCodecs?: string[];
  url: string;
  videoCodec?: string;
  width?: number;
}

export interface LevelAttributes extends AttrList {
  AUDIO?: string;
  AUTOSELECT?: string;
  'AVERAGE-BANDWIDTH'?: string;
  BANDWIDTH?: string;
  BYTERANGE?: string;
  'CLOSED-CAPTIONS'?: string;
  CODECS?: string;
  DEFAULT?: string;
  FORCED?: string;
  'FRAME-RATE'?: string;
  LANGUAGE?: string;
  NAME?: string;
  'PROGRAM-ID'?: string;
  RESOLUTION?: string;
  SUBTITLES?: string;
  TYPE?: string;
  URI?: string;
}

export enum HlsSkip {
  No = '',
  Yes = 'YES',
  v2 = 'v2',
}

export function getSkipValue(details: LevelDetails, msn?: number): HlsSkip {
  const { canSkipUntil, canSkipDateRanges, endSN } = details;
  const snChangeGoal = msn !== undefined ? msn - endSN : 0;
  if (canSkipUntil && snChangeGoal < canSkipUntil) {
    if (canSkipDateRanges) {
      return HlsSkip.v2;
    }
    return HlsSkip.Yes;
  }
  return HlsSkip.No;
}

export class HlsUrlParameters {
  msn?: number;
  part?: number;
  skip?: HlsSkip;

  constructor(msn?: number, part?: number, skip?: HlsSkip) {
    this.msn = msn;
    this.part = part;
    this.skip = skip;
  }

  addDirectives(uri: string): string | never {
    const url: URL = new self.URL(uri);
    if (this.msn !== undefined) {
      url.searchParams.set('_HLS_msn', this.msn.toString());
    }
    if (this.part !== undefined) {
      url.searchParams.set('_HLS_part', this.part.toString());
    }
    if (this.skip) {
      url.searchParams.set('_HLS_skip', this.skip);
    }
    return url.toString();
  }
}

export class Level {
  public readonly attrs: LevelAttributes;
  public readonly audioCodec: string | undefined;
  public readonly bitrate: number;
  public readonly codecSet: string;
  public readonly height: number;
  public readonly id: number;
  public readonly name: string | undefined;
  public readonly videoCodec: string | undefined;
  public readonly width: number;
  public readonly unknownCodecs: string[] | undefined;
  public audioGroupIds?: string[];
  public details?: LevelDetails;
  public fragmentError: number = 0;
  public loadError: number = 0;
  public loaded?: { bytes: number; duration: number };
  public realBitrate: number = 0;
  public textGroupIds?: string[];
  public url: string[];
  private _urlId: number = 0;

  constructor(data: LevelParsed) {
    this.url = [data.url];
    this.attrs = data.attrs;
    this.bitrate = data.bitrate;
    if (data.details) {
      this.details = data.details;
    }
    this.id = data.id || 0;
    this.name = data.name;
    this.width = data.width || 0;
    this.height = data.height || 0;
    this.audioCodec = data.audioCodec;
    this.videoCodec = data.videoCodec;
    this.unknownCodecs = data.unknownCodecs;
    this.codecSet = [data.videoCodec, data.audioCodec]
      .filter((c) => c)
      .join(',')
      .replace(/\.[^.,]+/g, '');
  }

  get maxBitrate(): number {
    return Math.max(this.realBitrate, this.bitrate);
  }

  get uri(): string {
    return this.url[this._urlId] || '';
  }

  get urlId(): number {
    return this._urlId;
  }

  set urlId(value: number) {
    const newValue = value % this.url.length;
    if (this._urlId !== newValue) {
      this.details = undefined;
      this._urlId = newValue;
    }
  }
}
