
import { buildAbsoluteURL } from 'url-toolkit';
import { logger } from '../utils/logger';
import LevelKey from './level-key';
import LoadStats from './load-stats';
import { PlaylistLevelType } from '../types/loader';

export enum ElementaryStreamTypes {
  AUDIO = 'audio',
  VIDEO = 'video',
  AUDIOVIDEO = 'audiovideo'
}

interface ElementaryStreamInfo {
  startPTS: number
  endPTS: number
  startDTS: number
  endDTS: number
}

export default class Fragment {
  private _url: string | null = null;
  private _byteRange: number[] | null = null;
  private _decryptdata: LevelKey | null = null;

  // Holds the types of data this fragment supports
  public elementaryStreams: Record<ElementaryStreamTypes, ElementaryStreamInfo | null> = {
    [ElementaryStreamTypes.AUDIO]: null,
    [ElementaryStreamTypes.VIDEO]: null,
    [ElementaryStreamTypes.AUDIOVIDEO]: null
  };

  public rawProgramDateTime: string | null = null;
  public programDateTime: number | null = null;
  public tagList: Array<string[]> = [];

  // TODO: Move at least baseurl to constructor.
  // Currently we do a two-pass construction as use the Fragment class almost like a object for holding parsing state.
  // It may make more sense to just use a POJO to keep state during the parsing phase.
  // Have Fragment be the representation once we have a known state?
  // Something to think on.

  // relurl is the portion of the URL that comes from inside the playlist.
  public relurl!: string;
  // baseurl is the URL to the playlist
  public baseurl!: string;
  // EXTINF has to be present for a m3u8 to be considered valid
  public duration!: number;
  // sn notates the sequence number for a segment, and if set to a string can be 'initSegment'
  public sn: number | 'initSegment' = 0;
  // levelkey is the EXT-X-KEY that applies to this segment for decryption
  // core difference from the private field _decryptdata is the lack of the initialized IV
  // _decryptdata will set the IV for this segment based on the segment number in the fragment
  public levelkey?: LevelKey;
  // A string representing the fragment type
  public type!: PlaylistLevelType;
  // A reference to the loader. Set while the fragment is loading, and removed afterwards. Used to abort fragment loading
  public loader!: any;
  // The level index to which the fragment belongs
  public level: number = -1;
  // The continuity counter of the fragment
  public cc: number = 0;
  // The starting Presentation Time Stamp (PTS) of the fragment. Set after transmux complete.
  public startPTS!: number;
  // The ending Presentation Time Stamp (PTS) of the fragment. Set after transmux complete.
  public endPTS!: number;
  // The latest Presentation Time Stamp (PTS) appended to the buffer.
  public appendedPTS!: number;
  // The starting Decode Time Stamp (DTS) of the fragment. Set after transmux complete.
  public startDTS!: number;
  // The ending Decode Time Stamp (DTS) of the fragment. Set after transmux complete.
  public endDTS!: number;
  // The start time of the fragment, as listed in the manifest. Updated after transmux complete.
  public start: number = 0;
  // Set when the fragment was loaded and transmuxed, but was stopped from buffering due to dropped frames.
  public backtracked: boolean = false;
  // Set by `updateFragPTSDTS` in level-helper
  public deltaPTS?: number;
  public maxStartPTS?: number;
  // Load/parse timing information
  public stats: LoadStats = new LoadStats();
  public urlId: number = 0;
  // TODO: Create InitSegment class extended from Fragment
  public data?: Uint8Array;
  // A flag indicating whether the segment was downloaded in order to test bitrate, and was not buffered
  public bitrateTest: boolean = false;
  // Total video frames dropped by the transmuxer
  public dropped: number = 0;
  public title: string | null = null;

  // setByteRange converts a EXT-X-BYTERANGE attribute into a two element array
  setByteRange (value: string, previousFrag?: Fragment) {
    const params = value.split('@', 2);
    const byteRange: number[] = [];
    if (params.length === 1) {
      byteRange[0] = previousFrag ? previousFrag.byteRangeEndOffset : 0;
    } else {
      byteRange[0] = parseInt(params[1]);
    }
    byteRange[1] = parseInt(params[0]) + byteRange[0];
    this._byteRange = byteRange;
  }

  get url () {
    if (!this._url && this.relurl) {
      this._url = buildAbsoluteURL(this.baseurl, this.relurl, { alwaysNormalize: true });
    }

    return this._url;
  }

  set url (value) {
    this._url = value;
  }

  get byteRange (): number[] {
    if (!this._byteRange) {
      return [];
    }

    return this._byteRange;
  }

  /**
   * @type {number}
   */
  get byteRangeStartOffset () {
    return this.byteRange[0];
  }

  get byteRangeEndOffset () {
    return this.byteRange[1];
  }

  get decryptdata (): LevelKey | null {
    if (!this.levelkey && !this._decryptdata) {
      return null;
    }

    if (!this._decryptdata && this.levelkey) {
      let sn = this.sn;
      if (typeof sn !== 'number') {
        // We are fetching decryption data for a initialization segment
        // If the segment was encrypted with AES-128
        // It must have an IV defined. We cannot substitute the Segment Number in.
        if (this.levelkey && this.levelkey.method === 'AES-128' && !this.levelkey.iv) {
          logger.warn(`missing IV for initialization segment with method="${this.levelkey.method}" - compliance issue`);
        }

        /*
        Be converted to a Number.
        'initSegment' will become NaN.
        NaN, which when converted through ToInt32() -> +0.
        ---
        Explicitly set sn to resulting value from implicit conversions 'initSegment' values for IV generation.
        */
        sn = 0;
      }
      this._decryptdata = this.setDecryptDataFromLevelKey(this.levelkey, sn);
    }

    return this._decryptdata;
  }

  get endProgramDateTime () {
    if (this.programDateTime === null) {
      return null;
    }

    if (!Number.isFinite(this.programDateTime)) {
      return null;
    }

    const duration = !Number.isFinite(this.duration) ? 0 : this.duration;

    return this.programDateTime + (duration * 1000);
  }

  get encrypted () {
    // At the m3u8-parser level we need to add support for manifest signalled keyformats
    // when we want the fragment to start reporting that it is encrypted.
    // Currently, keyFormat will only be set for identity keys
    if (this.decryptdata?.keyFormat && this.decryptdata.uri) {
      return true;
    }

    return false;
  }

  /**
   * Utility method for parseLevelPlaylist to create an initialization vector for a given segment
   * @param {number} segmentNumber - segment number to generate IV with
   * @returns {Uint8Array}
   */
  createInitializationVector (segmentNumber: number): Uint8Array {
    const uint8View = new Uint8Array(16);

    for (let i = 12; i < 16; i++) {
      uint8View[i] = (segmentNumber >> 8 * (15 - i)) & 0xff;
    }

    return uint8View;
  }

  /**
   * Utility method for parseLevelPlaylist to get a fragment's decryption data from the currently parsed encryption key data
   * @param levelkey - a playlist's encryption info
   * @param segmentNumber - the fragment's segment number
   * @returns {LevelKey} - an object to be applied as a fragment's decryptdata
   */
  setDecryptDataFromLevelKey (levelkey: LevelKey, segmentNumber: number): LevelKey {
    let decryptdata = levelkey;

    if (levelkey?.method === 'AES-128' && levelkey.uri && !levelkey.iv) {
      decryptdata = LevelKey.fromURI(levelkey.uri);
      decryptdata.method = levelkey.method;
      decryptdata.iv = this.createInitializationVector(segmentNumber);
      decryptdata.keyFormat = 'identity';
    }

    return decryptdata;
  }

  setElementaryStreamInfo (type: ElementaryStreamTypes, startPTS: number, endPTS: number, startDTS: number, endDTS: number) {
    const { elementaryStreams } = this;
    const info = elementaryStreams[type];
    if (!info) {
      elementaryStreams[type] = {
        startPTS,
        endPTS,
        startDTS,
        endDTS
      };
      return;
    }

    info.startPTS = Math.min(info.startPTS, startPTS);
    info.endPTS = Math.max(info.endPTS, endPTS);
    info.startDTS = Math.min(info.startDTS, startDTS);
    info.endDTS = Math.max(info.endDTS, endDTS);
  }
}
