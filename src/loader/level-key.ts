import { isFullSegmentEncryption } from '../utils/encryption-methods-util';
import { hexToArrayBuffer } from '../utils/hex';
import { convertDataUriToArrayBytes } from '../utils/keysystem-util';
import { logger } from '../utils/logger';
import { KeySystemFormats, parsePlayReadyWRM } from '../utils/mediakeys-helper';
import { mp4pssh } from '../utils/mp4-tools';

let keyUriToKeyIdMap: { [uri: string]: Uint8Array<ArrayBuffer> } = {};

export interface DecryptData {
  uri: string;
  method: string;
  keyFormat: string;
  keyFormatVersions: number[];
  iv: Uint8Array<ArrayBuffer> | null;
  key: Uint8Array<ArrayBuffer> | null;
  keyId: Uint8Array<ArrayBuffer> | null;
  pssh: Uint8Array<ArrayBuffer> | null;
  encrypted: boolean;
  isCommonEncryption: boolean;
}

export class LevelKey implements DecryptData {
  public readonly uri: string;
  public readonly method: string;
  public readonly keyFormat: string;
  public readonly keyFormatVersions: number[];
  public readonly encrypted: boolean;
  public readonly isCommonEncryption: boolean;
  public iv: Uint8Array<ArrayBuffer> | null = null;
  public key: Uint8Array<ArrayBuffer> | null = null;
  public keyId: Uint8Array<ArrayBuffer> | null = null;
  public pssh: Uint8Array<ArrayBuffer> | null = null;

  static clearKeyUriToKeyIdMap() {
    keyUriToKeyIdMap = {};
  }

  constructor(
    method: string,
    uri: string,
    format: string,
    formatversions: number[] = [1],
    iv: Uint8Array<ArrayBuffer> | null = null,
    keyId?: string,
  ) {
    this.method = method;
    this.uri = uri;
    this.keyFormat = format;
    this.keyFormatVersions = formatversions;
    this.iv = iv;
    this.encrypted = method ? method !== 'NONE' : false;
    this.isCommonEncryption =
      this.encrypted && !isFullSegmentEncryption(method);
    if (keyId?.startsWith('0x')) {
      this.keyId = new Uint8Array(hexToArrayBuffer(keyId));
    }
  }

  public matches(key: LevelKey): boolean {
    return (
      key.uri === this.uri &&
      key.method === this.method &&
      key.encrypted === this.encrypted &&
      key.keyFormat === this.keyFormat &&
      key.keyFormatVersions.join(',') === this.keyFormatVersions.join(',') &&
      key.iv?.join(',') === this.iv?.join(',')
    );
  }

  public isSupported(): boolean {
    // If it's Segment encryption or No encryption, just select that key system
    if (this.method) {
      if (isFullSegmentEncryption(this.method) || this.method === 'NONE') {
        return true;
      }
      if (this.keyFormat === 'identity') {
        // Maintain support for clear SAMPLE-AES with MPEG-3 TS
        return this.method === 'SAMPLE-AES';
      } else if (__USE_EME_DRM__) {
        switch (this.keyFormat) {
          case KeySystemFormats.FAIRPLAY:
          case KeySystemFormats.WIDEVINE:
          case KeySystemFormats.PLAYREADY:
          case KeySystemFormats.CLEARKEY:
            return (
              [
                'ISO-23001-7',
                'SAMPLE-AES',
                'SAMPLE-AES-CENC',
                'SAMPLE-AES-CTR',
              ].indexOf(this.method) !== -1
            );
        }
      }
    }
    return false;
  }

  public getDecryptData(sn: number | 'initSegment'): LevelKey | null {
    if (!this.encrypted || !this.uri) {
      return null;
    }

    if (isFullSegmentEncryption(this.method) && this.uri && !this.iv) {
      if (typeof sn !== 'number') {
        // We are fetching decryption data for a initialization segment
        // If the segment was encrypted with AES-128/256
        // It must have an IV defined. We cannot substitute the Segment Number in.
        logger.warn(
          `missing IV for initialization segment with method="${this.method}" - compliance issue`,
        );

        // Explicitly set sn to resulting value from implicit conversions 'initSegment' values for IV generation.
        sn = 0;
      }
      const iv = createInitializationVector(sn);
      const decryptdata = new LevelKey(
        this.method,
        this.uri,
        'identity',
        this.keyFormatVersions,
        iv,
      );
      return decryptdata;
    }

    if (!__USE_EME_DRM__) {
      return this;
    }

    if (this.pssh && this.keyId) {
      return this;
    }

    // Initialize keyId if possible
    const keyBytes = convertDataUriToArrayBytes(this.uri);
    if (keyBytes) {
      switch (this.keyFormat) {
        case KeySystemFormats.WIDEVINE:
          // Setting `pssh` on this LevelKey/DecryptData allows HLS.js to generate a session using
          // the playlist-key before the "encrypted" event. (Comment out to only use "encrypted" path.)
          this.pssh = keyBytes;
          // In case of Widevine, if KEYID is not in the playlist, assume only two fields in the pssh KEY tag URI.
          if (!this.keyId && keyBytes.length >= 22) {
            const offset = keyBytes.length - 22;
            this.keyId = keyBytes.subarray(offset, offset + 16);
          }
          break;
        case KeySystemFormats.PLAYREADY: {
          const PlayReadyKeySystemUUID = new Uint8Array([
            0x9a, 0x04, 0xf0, 0x79, 0x98, 0x40, 0x42, 0x86, 0xab, 0x92, 0xe6,
            0x5b, 0xe0, 0x88, 0x5f, 0x95,
          ]);

          // Setting `pssh` on this LevelKey/DecryptData allows HLS.js to generate a session using
          // the playlist-key before the "encrypted" event. (Comment out to only use "encrypted" path.)
          this.pssh = mp4pssh(PlayReadyKeySystemUUID, null, keyBytes);

          this.keyId = parsePlayReadyWRM(keyBytes);

          break;
        }
        default: {
          let keydata = keyBytes.subarray(0, 16);
          if (keydata.length !== 16) {
            const padded = new Uint8Array(16);
            padded.set(keydata, 16 - keydata.length);
            keydata = padded;
          }
          this.keyId = keydata;
          break;
        }
      }
    }

    // Default behavior: assign a new keyId for each uri
    if (!this.keyId || this.keyId.byteLength !== 16) {
      let keyId = keyUriToKeyIdMap[this.uri];
      if (!keyId) {
        const val =
          Object.keys(keyUriToKeyIdMap).length % Number.MAX_SAFE_INTEGER;
        keyId = new Uint8Array(16);
        const dv = new DataView(keyId.buffer, 12, 4); // Just set the last 4 bytes
        dv.setUint32(0, val);
        keyUriToKeyIdMap[this.uri] = keyId;
      }
      this.keyId = keyId;
    }

    return this;
  }
}

function createInitializationVector(segmentNumber: number) {
  const uint8View = new Uint8Array(16);
  for (let i = 12; i < 16; i++) {
    uint8View[i] = (segmentNumber >> (8 * (15 - i))) & 0xff;
  }
  return uint8View;
}
