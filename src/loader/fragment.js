
import URLToolkit from 'url-toolkit';

import LevelKey from './level-key';

export default class Fragment {

  constructor() {
    this._url = null;
    this._byteRange = null;
    this._decryptdata = null;
    this.tagList = [];
  }

  get url() {
    if (!this._url && this.relurl) {
      this._url = URLToolkit.buildAbsoluteURL(this.baseurl, this.relurl, { alwaysNormalize: true });
    }
    return this._url;
  }

  set url(value) {
    this._url = value;
  }

  get programDateTime() {
    if (!this._programDateTime && this.rawProgramDateTime) {
      this._programDateTime = new Date(Date.parse(this.rawProgramDateTime));
    }
    return this._programDateTime;
  }

  get byteRange() {
    if (!this._byteRange && !this.rawByteRange) {
      return [];
    }

    if (this._byteRange) {
      return this._byteRange;
    }

    let byteRange = [];
    if (this.rawByteRange) {
      const params = this.rawByteRange.split('@', 2);
      if (params.length === 1) {
        const lastByteRangeEndOffset = this.lastByteRangeEndOffset;
        byteRange[0] = lastByteRangeEndOffset ? lastByteRangeEndOffset : 0;
      } else {
        byteRange[0] = parseInt(params[1]);
      }
      byteRange[1] = parseInt(params[0]) + byteRange[0];
      this._byteRange = byteRange;
    }
    return byteRange;
  }

  get byteRangeStartOffset() {
    return this.byteRange[0];
  }

  get byteRangeEndOffset() {
    return this.byteRange[1];
  }

  get decryptdata() {
    if (!this._decryptdata) {
      this._decryptdata = this.fragmentDecryptdataFromLevelkey(this.levelkey, this.sn);
    }
    return this._decryptdata;
  }

  /**
   * Utility method for parseLevelPlaylist to create an initialization vector for a given segment
   * @returns {Uint8Array}
   */
  createInitializationVector(segmentNumber) {
    var uint8View = new Uint8Array(16);

    for (var i = 12; i < 16; i++) {
      uint8View[i] = (segmentNumber >> 8 * (15 - i)) & 0xff;
    }

    return uint8View;
  }

  /**
   * Utility method for parseLevelPlaylist to get a fragment's decryption data from the currently parsed encryption key data
   * @param levelkey - a playlist's encryption info
   * @param segmentNumber - the fragment's segment number
   * @returns {*} - an object to be applied as a fragment's decryptdata
   */
  fragmentDecryptdataFromLevelkey(levelkey, segmentNumber) {
    var decryptdata = levelkey;

    if (levelkey && levelkey.method && levelkey.uri && !levelkey.iv) {
      decryptdata = new LevelKey();
      decryptdata.method = levelkey.method;
      decryptdata.baseuri = levelkey.baseuri;
      decryptdata.reluri = levelkey.reluri;
      decryptdata.iv = this.createInitializationVector(segmentNumber);
    }

    return decryptdata;
  }

  cloneObj(obj) {
    return JSON.parse(JSON.stringify(obj));
  }
}
