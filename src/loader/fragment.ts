import { buildAbsoluteURL } from 'url-toolkit';
import { LoadStats } from './load-stats';
import type { LevelKey } from './level-key';
import type {
  FragmentLoaderContext,
  KeyLoaderContext,
  Loader,
  PlaylistLevelType,
} from '../types/loader';
import type { AttrList } from '../utils/attr-list';
import type { KeySystemFormats } from '../utils/mediakeys-helper';

export const enum ElementaryStreamTypes {
  AUDIO = 'audio',
  VIDEO = 'video',
  AUDIOVIDEO = 'audiovideo',
}

export interface ElementaryStreamInfo {
  startPTS: number;
  endPTS: number;
  startDTS: number;
  endDTS: number;
  partial?: boolean;
}

export type ElementaryStreams = Record<
  ElementaryStreamTypes,
  ElementaryStreamInfo | null
>;

export type Base = {
  url: string;
};

export type BaseSegment = {
  // baseurl is the URL to the playlist
  readonly base: Base;
  // relurl is the portion of the URL that comes from inside the playlist.
  relurl?: string;
  setByteRange(value: string, previous?: BaseSegment);
  clearElementaryStreamInfo();
  readonly baseurl;
  readonly byteRange;
  readonly byteRangeStartOffset;
  readonly byteRangeEndOffset;
  readonly hasStats;
  readonly hasStreams;
  elementaryStreams: ElementaryStreams;
  stats: LoadStats;
  url: string;
  _byteRange: [number, number] | null;
  _url: string | null;
  _stats: LoadStats | null;
  _streams: ElementaryStreams | null;
};

export type Fragment = BaseSegment & {
  // A string representing the fragment type
  readonly type: PlaylistLevelType;
  // EXTINF has to be present for a m3u8 to be considered valid
  duration: number;
  // sn notates the sequence number for a segment, and if set to a string can be 'initSegment'
  sn: number | 'initSegment';
  // levelkeys are the EXT-X-KEY tags that apply to this segment for decryption
  // core difference from the private field _decryptdata is the lack of the initialized IV
  // _decryptdata will set the IV for this segment based on the segment number in the fragment
  levelkeys?: { [key: string]: LevelKey };
  // A reference to the loader. Set while the fragment is loading, and removed afterwards. Used to abort fragment loading
  loader: Loader<FragmentLoaderContext> | null;
  // A reference to the key loader. Set while the key is loading, and removed afterwards. Used to abort key loading
  keyLoader: Loader<KeyLoaderContext> | null;
  // The level/track index to which the fragment belongs
  level: number;
  // The continuity counter of the fragment
  cc: number;
  // The starting Presentation Time Stamp (PTS) of the fragment. Set after transmux complete.
  startPTS?: number;
  // The ending Presentation Time Stamp (PTS) of the fragment. Set after transmux complete.
  endPTS?: number;
  // The starting Decode Time Stamp (DTS) of the fragment. Set after transmux complete.
  startDTS?: number;
  // The ending Decode Time Stamp (DTS) of the fragment. Set after transmux complete.
  endDTS?: number;
  // The start time of the fragment, as listed in the manifest. Updated after transmux complete.
  start: number;
  // The offset time (seconds) of the fragment from the start of the Playlist
  playlistOffset: number;
  // Set by `updateFragPTSDTS` in level-helper
  deltaPTS?: number;
  // The maximum starting Presentation Time Stamp (audio/video PTS) of the fragment. Set after transmux complete.
  maxStartPTS?: number;
  // The minimum ending Presentation Time Stamp (audio/video PTS) of the fragment. Set after transmux complete.
  minEndPTS?: number;
  // Init Segment bytes (unset for media segments)
  data?: Uint8Array;
  // A flag indicating whether the segment was downloaded in order to test bitrate, and was not buffered
  bitrateTest: boolean;
  // #EXTINF  segment title
  title: string | null;
  // The Media Initialization Section for this segment
  initSegment: Fragment | null;
  // Fragment is the last fragment in the media playlist
  endList?: boolean;
  // Fragment is marked by an EXT-X-GAP tag indicating that it does not contain media data and should not be loaded
  gap?: boolean;
  // Deprecated
  urlId: number;
  // PROGRAM-DATE-TIME string
  rawProgramDateTime: string | null;
  // PROGRAM-DATE-TIME epoch (new Date(rawProgramDateTime).getTime())
  programDateTime: number | null;
  // Soft Deprecated
  tagList: Array<string[]>;
  // most accurate bitrate calculation available if any
  bitrate: number | null;
  // read-only
  readonly byteLength: number | null;
  readonly decryptdata;
  readonly end;
  readonly endProgramDateTime;
  readonly encrypted;
  readonly ref: MediaFragmentRef | null;
  addStart(value: number);
  setStart(value: number);
  setDuration(value: number);
  setKeyFormat(keyFormat: KeySystemFormats);
  abortRequests();
  setElementaryStreamInfo(
    type: ElementaryStreamTypes,
    startPTS: number,
    endPTS: number,
    startDTS: number,
    endDTS: number,
    partial?: boolean,
  );
  _decryptdata: LevelKey | null;
  _programDateTime: number | null;
  _ref?: MediaFragmentRef;
  // Approximate bit rate of the fragment expressed in bits per second (bps) as indicated by the last EXT-X-BITRATE (kbps) tag
  _bitrate?: number;
};

export type Part = BaseSegment & {
  readonly fragOffset: number;
  readonly duration: number;
  readonly gap: boolean;
  readonly independent: boolean;
  readonly relurl: string;
  readonly fragment: MediaFragment;
  readonly index: number;
  readonly start: number;
  readonly end: number;
  readonly loaded: boolean;
};

export const getBasePropertyDescriptors = (base: Base) => {
  const baseSegment: BaseSegment = {
    _byteRange: null,
    _url: null,
    _stats: null,
    _streams: null,
    base,
    // setByteRange converts a EXT-X-BYTERANGE attribute into a two element array
    setByteRange(this: BaseSegment, value: string, previous?: BaseSegment) {
      const params = value.split('@', 2);
      let start: number;
      if (params.length === 1) {
        start = previous?.byteRangeEndOffset || 0;
      } else {
        start = parseInt(params[1]);
      }
      this._byteRange = [start, parseInt(params[0]) + start];
    },

    get baseurl(): string {
      return this.base.url;
    },

    get byteRange(): [number, number] | [] {
      if (this._byteRange === null) {
        return [];
      }

      return this._byteRange;
    },

    get byteRangeStartOffset(): number | undefined {
      return this.byteRange[0];
    },

    get byteRangeEndOffset(): number | undefined {
      return this.byteRange[1];
    },

    get elementaryStreams(): ElementaryStreams {
      if (this._streams === null) {
        this._streams = {
          [ElementaryStreamTypes.AUDIO]: null,
          [ElementaryStreamTypes.VIDEO]: null,
          [ElementaryStreamTypes.AUDIOVIDEO]: null,
        };
      }
      return this._streams;
    },

    set elementaryStreams(value: ElementaryStreams) {
      this._streams = value;
    },

    get hasStats(): boolean {
      return this._stats !== null;
    },

    get hasStreams(): boolean {
      return this._streams !== null;
    },

    get stats(): LoadStats {
      if (this._stats === null) {
        this._stats = new LoadStats();
      }
      return this._stats;
    },

    set stats(value: LoadStats) {
      this._stats = value;
    },

    get url(): string {
      if (!this._url && this.baseurl && this.relurl) {
        this._url = buildAbsoluteURL(this.baseurl, this.relurl, {
          alwaysNormalize: true,
        });
      }
      return this._url || '';
    },

    set url(value: string) {
      this._url = value;
    },

    clearElementaryStreamInfo(this: BaseSegment) {
      const { elementaryStreams } = this;
      elementaryStreams[ElementaryStreamTypes.AUDIO] = null;
      elementaryStreams[ElementaryStreamTypes.VIDEO] = null;
      elementaryStreams[ElementaryStreamTypes.AUDIOVIDEO] = null;
    },
  };
  const baseSegmentPropertyDescriptors =
    Object.getOwnPropertyDescriptors(baseSegment);
  baseSegmentPropertyDescriptors._byteRange.enumerable = false;
  baseSegmentPropertyDescriptors._url.enumerable = false;
  baseSegmentPropertyDescriptors._stats.enumerable = false;
  baseSegmentPropertyDescriptors._streams.enumerable = false;
  baseSegmentPropertyDescriptors.baseurl.enumerable = false;
  baseSegmentPropertyDescriptors.byteRange.enumerable = false;
  baseSegmentPropertyDescriptors.byteRangeStartOffset.enumerable = false;
  baseSegmentPropertyDescriptors.byteRangeEndOffset.enumerable = false;
  baseSegmentPropertyDescriptors.hasStats.enumerable = false;
  baseSegmentPropertyDescriptors.hasStreams.enumerable = false;
  baseSegmentPropertyDescriptors.setByteRange.enumerable = false;
  baseSegmentPropertyDescriptors.clearElementaryStreamInfo.enumerable = false;
  return baseSegmentPropertyDescriptors;
};

export interface MediaFragment extends Fragment {
  sn: number;
  ref: MediaFragmentRef;
}

export type MediaFragmentRef = {
  base: Base;
  start: number;
  duration: number;
  sn: number;
  programDateTime: number | null;
};

export function isMediaFragment(frag: Fragment): frag is MediaFragment {
  return frag.sn !== 'initSegment';
}

/**
 * Object representing parsed data from an HLS Segment. Found in {@link hls.js#LevelDetails.fragments}.
 */
export const createFragment = (
  type: PlaylistLevelType,
  base: Base = { url: '' },
) => {
  const fragmentProperties = {
    get byteLength(): number | null {
      if (this.hasStats) {
        const total = this.stats.total;
        if (total) {
          return total;
        }
      }
      if (this.byteRange) {
        const start = this.byteRange[0];
        const end = this.byteRange[1];
        if (Number.isFinite(start) && Number.isFinite(end)) {
          return (end as number) - (start as number);
        }
      }
      return null;
    },
    get bitrate(): number | null {
      if (this.byteLength) {
        return (this.byteLength * 8) / this.duration;
      }
      if (this._bitrate) {
        return this._bitrate;
      }
      return null;
    },

    set bitrate(value: number) {
      this._bitrate = value;
    },

    get decryptdata(): LevelKey | null {
      const { levelkeys } = this;
      if (!levelkeys && !this._decryptdata) {
        return null;
      }

      if (!this._decryptdata && this.levelkeys && !this.levelkeys.NONE) {
        const key = this.levelkeys.identity;
        if (key) {
          this._decryptdata = key.getDecryptData(this.sn);
        } else {
          const keyFormats = Object.keys(this.levelkeys);
          if (keyFormats.length === 1) {
            return (this._decryptdata = this.levelkeys[
              keyFormats[0]
            ].getDecryptData(this.sn));
          } else {
            // Multiple keys. key-loader to call Fragment.setKeyFormat based on selected key-system.
          }
        }
      }

      return this._decryptdata;
    },

    get end(): number {
      return this.start + this.duration;
    },

    get endProgramDateTime() {
      if (this.programDateTime === null) {
        return null;
      }

      const duration = !Number.isFinite(this.duration) ? 0 : this.duration;

      return this.programDateTime + duration * 1000;
    },

    get encrypted() {
      // At the m3u8-parser level we need to add support for manifest signalled keyformats
      // when we want the fragment to start reporting that it is encrypted.
      // Currently, keyFormat will only be set for identity keys
      if (this._decryptdata?.encrypted) {
        return true;
      } else if (this.levelkeys) {
        const keyFormats = Object.keys(this.levelkeys);
        const len = keyFormats.length;
        if (len > 1 || (len === 1 && this.levelkeys[keyFormats[0]].encrypted)) {
          return true;
        }
      }
      return false;
    },

    get programDateTime(): number | null {
      if (this._programDateTime === null && this.rawProgramDateTime) {
        this.programDateTime = Date.parse(this.rawProgramDateTime);
      }
      return this._programDateTime;
    },

    set programDateTime(value: number | null) {
      if (!Number.isFinite(value)) {
        this._programDateTime = this.rawProgramDateTime = null;
        return;
      }
      this._programDateTime = value;
    },

    get ref(): MediaFragmentRef | null {
      if (!isMediaFragment(this)) {
        return null;
      }
      if (!this._ref) {
        this._ref = {
          base: this.base,
          start: this.start,
          duration: this.duration,
          sn: this.sn,
          programDateTime: this.programDateTime,
        };
      }
      return this._ref;
    },

    addStart(value: number) {
      this.setStart(this.start + value);
    },

    setStart(value: number) {
      this.start = value;
      if (this._ref) {
        this._ref.start = value;
      }
    },

    setDuration(value: number) {
      this.duration = value;
      if (this._ref) {
        this._ref.duration = value;
      }
    },

    setKeyFormat(keyFormat: KeySystemFormats) {
      if (this.levelkeys) {
        const key = this.levelkeys[keyFormat];
        if (key && !this._decryptdata) {
          this._decryptdata = key.getDecryptData(this.sn);
        }
      }
    },

    abortRequests(): void {
      this.loader?.abort();
      this.keyLoader?.abort();
    },

    setElementaryStreamInfo(
      type: ElementaryStreamTypes,
      startPTS: number,
      endPTS: number,
      startDTS: number,
      endDTS: number,
      partial: boolean = false,
    ) {
      const { elementaryStreams } = this;
      const info = elementaryStreams[type];
      if (!info) {
        elementaryStreams[type] = {
          startPTS,
          endPTS,
          startDTS,
          endDTS,
          partial,
        };
        return;
      }

      info.startPTS = Math.min(info.startPTS, startPTS);
      info.endPTS = Math.max(info.endPTS, endPTS);
      info.startDTS = Math.min(info.startDTS, startDTS);
      info.endDTS = Math.max(info.endDTS, endDTS);
    },
  };
  const fragmentPropertyDescriptors =
    Object.getOwnPropertyDescriptors(fragmentProperties);
  fragmentPropertyDescriptors.byteLength.enumerable = false;
  fragmentPropertyDescriptors.decryptdata.enumerable = false;
  fragmentPropertyDescriptors.end.enumerable = false;
  fragmentPropertyDescriptors.endProgramDateTime.enumerable = false;
  fragmentPropertyDescriptors.encrypted.enumerable = false;
  fragmentPropertyDescriptors.programDateTime.enumerable = false;
  fragmentPropertyDescriptors.ref.enumerable = false;
  fragmentPropertyDescriptors.addStart.enumerable = false;
  fragmentPropertyDescriptors.setStart.enumerable = false;
  fragmentPropertyDescriptors.setDuration.enumerable = false;
  fragmentPropertyDescriptors.setKeyFormat.enumerable = false;
  fragmentPropertyDescriptors.abortRequests.enumerable = false;
  fragmentPropertyDescriptors.setElementaryStreamInfo.enumerable = false;
  return Object.defineProperties(
    {
      _decryptdata: null,
      _programDateTime: null,
      type,
      rawProgramDateTime: null,
      tagList: [],
      duration: 0,
      sn: 0,
      loader: null,
      keyLoader: null,
      level: -1,
      cc: 0,
      start: 0,
      playlistOffset: 0,
      bitrateTest: false,
      title: null,
      initSegment: null,
      urlId: 0,
    } as any as Fragment,
    {
      ...fragmentPropertyDescriptors,
      ...getBasePropertyDescriptors(base),
    },
  );
};

/**
 * Object representing parsed data from an HLS Partial Segment. Found in {@link hls.js#LevelDetails.partList}.
 */
export const createPart = (
  partAttrs: AttrList,
  frag: MediaFragment,
  index: number,
  base: Base = { url: '' },
  previous?: Part,
) => {
  const partProperties = {
    get start(): number {
      return this.fragment.start + this.fragOffset;
    },
    get end(): number {
      return this.start + this.duration;
    },
    get loaded(): boolean {
      const { elementaryStreams } = this;
      return !!(
        elementaryStreams.audio ||
        elementaryStreams.video ||
        elementaryStreams.audiovideo
      );
    },
  };
  const partPropertyDescriptors =
    Object.getOwnPropertyDescriptors(partProperties);
  partPropertyDescriptors.start.enumerable = false;
  partPropertyDescriptors.end.enumerable = false;
  partPropertyDescriptors.loaded.enumerable = false;

  const part = Object.defineProperties(
    {
      duration: partAttrs.decimalFloatingPoint('DURATION'),
      gap: partAttrs.bool('GAP'),
      independent: partAttrs.bool('INDEPENDENT'),
      relurl: partAttrs.enumeratedString('URI') as string,
      fragment: frag,
      index: index,
      fragOffset: previous ? previous.fragOffset + previous.duration : 0,
    } as any as Part,
    {
      ...partPropertyDescriptors,
      ...getBasePropertyDescriptors(base),
    },
  );

  const byteRange = partAttrs.enumeratedString('BYTERANGE');
  if (byteRange) {
    part.setByteRange(byteRange, previous);
  }

  return part;
};
