
import { buildAbsoluteURL } from 'url-toolkit';
import { logger } from '../utils/logger';
import LevelKey from './level-key';

export enum ElementaryStreamTypes {
  AUDIO = 'audio',
  VIDEO = 'video',
}

export default class Fragment {
  private _url: string | null = null;
  private _byteRange: number[] | null = null;
  private _decryptdata: LevelKey | null = null;

  // Holds the types of data this fragment supports
  private _elementaryStreams: Record<ElementaryStreamTypes, boolean> = {
    [ElementaryStreamTypes.AUDIO]: false,
    [ElementaryStreamTypes.VIDEO]: false
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

    let duration = !Number.isFinite(this.duration) ? 0 : this.duration;

    return this.programDateTime + (duration * 1000);
  }

  get encrypted () {
    return !!((this.decryptdata && this.decryptdata.uri !== null) && (this.decryptdata.key === null));
  }

  /**
   * @param {ElementaryStreamTypes} type
   */
  addElementaryStream (type: ElementaryStreamTypes) {
    this._elementaryStreams[type] = true;
  }

  /**
   * @param {ElementaryStreamTypes} type
   */
  hasElementaryStream (type: ElementaryStreamTypes) {
    return this._elementaryStreams[type] === true;
  }

  /**
   * Utility method for parseLevelPlaylist to create an initialization vector for a given segment
   * @param {number} segmentNumber - segment number to generate IV with
   * @returns {Uint8Array}
   */
  createInitializationVector (segmentNumber: number): Uint8Array {
    let uint8View = new Uint8Array(16);

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

    if (levelkey && levelkey.method && levelkey.uri && !levelkey.iv) {
      decryptdata = new LevelKey(levelkey.baseuri, levelkey.reluri);
      decryptdata.method = levelkey.method;
      decryptdata.iv = this.createInitializationVector(segmentNumber);
    }

    return decryptdata;
  }
}
