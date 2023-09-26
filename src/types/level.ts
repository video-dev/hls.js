import type { LevelDetails } from '../loader/level-details';
import type { AttrList } from '../utils/attr-list';
import type { MediaDecodingInfo } from '../utils/mediacapabilities-helper';

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
  'ALLOWED-CPC'?: string;
  AUDIO?: string;
  'AVERAGE-BANDWIDTH'?: string;
  BANDWIDTH?: string;
  'CLOSED-CAPTIONS'?: string;
  CODECS?: string;
  'FRAME-RATE'?: string;
  'HDCP-LEVEL'?: 'TYPE-0' | 'TYPE-1' | 'NONE';
  'PATHWAY-ID'?: string;
  RESOLUTION?: string;
  SCORE?: string;
  'STABLE-VARIANT-ID'?: string;
  SUBTITLES?: string;
  'SUPPLEMENTAL-CODECS'?: string;
  VIDEO?: string;
  'VIDEO-RANGE'?: VideoRange;
}

export const HdcpLevels = ['NONE', 'TYPE-0', 'TYPE-1', null] as const;
export type HdcpLevel = (typeof HdcpLevels)[number];

export function isHdcpLevel(value: any): value is HdcpLevel {
  return HdcpLevels.indexOf(value) > -1;
}

export const VideoRangeValues = ['SDR', 'PQ', 'HLG'] as const;
export type VideoRange = (typeof VideoRangeValues)[number];

export function isVideoRange(value: any): value is VideoRange {
  return !!value && VideoRangeValues.indexOf(value) > -1;
}

export type VariableMap = Record<string, string>;

export const enum HlsSkip {
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
    return url.href;
  }
}

export class Level {
  public readonly _attrs: LevelAttributes[];
  public readonly audioCodec: string | undefined;
  public readonly bitrate: number;
  public readonly codecSet: string;
  public readonly frameRate: number;
  public readonly height: number;
  public readonly id: number;
  public readonly name: string | undefined;
  public readonly videoCodec: string | undefined;
  public readonly width: number;
  public readonly unknownCodecs: string[] | undefined;
  public audioGroupIds?: (string | undefined)[];
  public details?: LevelDetails;
  public fragmentError: number = 0;
  public loadError: number = 0;
  public loaded?: { bytes: number; duration: number };
  public realBitrate: number = 0;
  public textGroupIds?: (string | undefined)[];
  public url: string[];
  public supportedPromise?: Promise<MediaDecodingInfo>;
  public supportedResult?: MediaDecodingInfo;
  private _urlId: number = 0;
  private _avgBitrate: number = 0;
  private _audioGroups?: (string | undefined)[][];
  private _subtitleGroups?: (string | undefined)[][];

  constructor(data: LevelParsed) {
    this.url = [data.url];
    this._attrs = [data.attrs];
    this.bitrate = data.bitrate;
    if (data.details) {
      this.details = data.details;
    }
    this.id = data.id || 0;
    this.name = data.name;
    this.width = data.width || 0;
    this.height = data.height || 0;
    this.frameRate = data.attrs.optionalFloat('FRAME-RATE', 0);
    this._avgBitrate = this.attrs.decimalInteger('AVERAGE-BANDWIDTH');
    this.audioCodec = data.audioCodec;
    this.videoCodec = data.videoCodec;
    this.unknownCodecs = data.unknownCodecs;
    this.codecSet = [data.videoCodec, data.audioCodec]
      .filter((c) => !!c)
      .map((s: string) => s.substring(0, 4))
      .join(',');
  }

  get maxBitrate(): number {
    return Math.max(this.realBitrate, this.bitrate);
  }

  get averageBitrate(): number {
    return this._avgBitrate || this.realBitrate || this.bitrate;
  }

  get attrs(): LevelAttributes {
    return this._attrs[this._urlId];
  }

  get codecs(): string {
    return this.attrs.CODECS || '';
  }

  get pathwayId(): string {
    return this.attrs['PATHWAY-ID'] || '.';
  }

  get videoRange(): VideoRange {
    return this.attrs['VIDEO-RANGE'] || 'SDR';
  }

  get score(): number {
    return this.attrs.optionalFloat('SCORE', 0);
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
      this.fragmentError = 0;
      this.loadError = 0;
      this.details = undefined;
      this._urlId = newValue;
    }
  }

  get audioGroupId(): string | undefined {
    return this.audioGroupIds?.[this.urlId];
  }

  get textGroupId(): string | undefined {
    return this.textGroupIds?.[this.urlId];
  }

  get audioGroups(): (string | undefined)[] | undefined {
    return this._audioGroups?.[this.urlId];
  }

  get subtitleGroups(): (string | undefined)[] | undefined {
    return this._subtitleGroups?.[this.urlId];
  }

  addFallback(data: LevelParsed) {
    this.url.push(data.url);
    this._attrs.push(data.attrs);
  }

  addGroupId(type: string, groupId: string | undefined, fallbackIndex: number) {
    if (!groupId) {
      return;
    }
    const lastIndex = this.url.length - 1;
    if (type === 'audio') {
      let audioGroupsByUrlId = this._audioGroups;
      if (!this.audioGroupIds) {
        this.audioGroupIds = [];
      }
      if (!audioGroupsByUrlId) {
        audioGroupsByUrlId = this._audioGroups = [];
      }
      if (fallbackIndex === -1) {
        this.audioGroupIds[lastIndex] = groupId;
        audioGroupsByUrlId[lastIndex] = [groupId];
      } else if (audioGroupsByUrlId[fallbackIndex].indexOf(groupId) === -1) {
        audioGroupsByUrlId[fallbackIndex].push(groupId);
      }
    } else if (type === 'text') {
      let subtitleGroupsByUrlId = this._subtitleGroups;
      if (!this.textGroupIds) {
        this.textGroupIds = [];
      }
      if (!subtitleGroupsByUrlId) {
        subtitleGroupsByUrlId = this._subtitleGroups = [];
      }
      if (fallbackIndex === -1) {
        this.textGroupIds[lastIndex] = groupId;
        subtitleGroupsByUrlId[lastIndex] = [groupId];
      } else if (subtitleGroupsByUrlId[fallbackIndex].indexOf(groupId) === -1) {
        subtitleGroupsByUrlId[fallbackIndex].push(groupId);
      }
    }
  }
}
