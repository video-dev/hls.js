import {
  changeEndianness,
  convertDataUriToArrayBytes,
} from '../utils/keysystem-util';
import { KeySystemFormats } from '../utils/mediakeys-helper';
import { mp4pssh } from '../utils/mp4-tools';
import { logger } from '../utils/logger';
import { base64Decode } from '../utils/numeric-encoding-utils';

let keyUriToKeyIdMap: { [uri: string]: Uint8Array } = {};

export interface DecryptData {
  uri: string;
  method: string;
  keyFormat: string;
  keyFormatVersions: number[];
  iv: Uint8Array | null;
  key: Uint8Array | null;
  keyId: Uint8Array | null;
  pssh: Uint8Array | null;
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
  public iv: Uint8Array | null = null;
  public key: Uint8Array | null = null;
  public keyId: Uint8Array | null = null;
  public pssh: Uint8Array | null = null;

  static clearKeyUriToKeyIdMap() {
    keyUriToKeyIdMap = {};
  }

  constructor(
    method: string,
    uri: string,
    format: string,
    formatversions: number[] = [1],
    iv: Uint8Array | null = null
  ) {
    this.method = method;
    this.uri = uri;
    this.keyFormat = format;
    this.keyFormatVersions = formatversions;
    this.iv = iv;
    this.encrypted = method ? method !== 'NONE' : false;
    this.isCommonEncryption = this.encrypted && method !== 'AES-128';
  }

  public isSupported(): boolean {
    // If it's Segment encryption or No encryption, just select that key system
    if (this.method) {
      if (this.method === 'AES-128' || this.method === 'NONE') {
        return true;
      }
      switch (this.keyFormat) {
        case 'identity':
          // Maintain support for clear SAMPLE-AES with MPEG-3 TS
          return this.method === 'SAMPLE-AES';
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
    return false;
  }

  public getDecryptData(sn: number | 'initSegment'): LevelKey | null {
    if (!this.encrypted || !this.uri) {
      return null;
    }

    if (this.method === 'AES-128' && this.uri && !this.iv) {
      if (typeof sn !== 'number') {
        // We are fetching decryption data for a initialization segment
        // If the segment was encrypted with AES-128
        // It must have an IV defined. We cannot substitute the Segment Number in.
        if (this.method === 'AES-128' && !this.iv) {
          logger.warn(
            `missing IV for initialization segment with method="${this.method}" - compliance issue`
          );
        }
        // Explicitly set sn to resulting value from implicit conversions 'initSegment' values for IV generation.
        sn = 0;
      }
      const iv = createInitializationVector(sn);
      const decryptdata = new LevelKey(
        this.method,
        this.uri,
        'identity',
        this.keyFormatVersions,
        iv
      );
      return decryptdata;
    }

    // Initialize keyId if possible
    const keyBytes = convertDataUriToArrayBytes(this.uri);
    if (keyBytes) {
      switch (this.keyFormat) {
        case KeySystemFormats.WIDEVINE:
          this.pssh = keyBytes;
          // In case of widevine keyID is embedded in PSSH box. Read Key ID.
          if (keyBytes.length >= 22) {
            this.keyId = keyBytes.subarray(
              keyBytes.length - 22,
              keyBytes.length - 6
            );
          }
          break;
        case KeySystemFormats.PLAYREADY: {
          const PlayReadyKeySystemUUID = new Uint8Array([
            0x9a, 0x04, 0xf0, 0x79, 0x98, 0x40, 0x42, 0x86, 0xab, 0x92, 0xe6,
            0x5b, 0xe0, 0x88, 0x5f, 0x95,
          ]);

          this.pssh = mp4pssh(PlayReadyKeySystemUUID, null, keyBytes);

          const keyBytesUtf16 = new Uint16Array(
            keyBytes.buffer,
            keyBytes.byteOffset,
            keyBytes.byteLength / 2
          );
          const keyByteStr = String.fromCharCode.apply(
            null,
            Array.from(keyBytesUtf16)
          );

          // Parse Playready WRMHeader XML
          const xmlKeyBytes = keyByteStr.substring(
            keyByteStr.indexOf('<'),
            keyByteStr.length
          );
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(xmlKeyBytes, 'text/xml');
          const keyData = xmlDoc.getElementsByTagName('KID')[0];
          if (keyData) {
            const keyId = keyData.childNodes[0]
              ? keyData.childNodes[0].nodeValue
              : keyData.getAttribute('VALUE');
            if (keyId) {
              const keyIdArray = base64Decode(keyId).subarray(0, 16);
              // KID value in PRO is a base64-encoded little endian GUID interpretation of UUID
              // KID value in ‘tenc’ is a big endian UUID GUID interpretation of UUID
              changeEndianness(keyIdArray);
              this.keyId = keyIdArray;
            }
          }
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

function createInitializationVector(segmentNumber: number): Uint8Array {
  const uint8View = new Uint8Array(16);
  for (let i = 12; i < 16; i++) {
    uint8View[i] = (segmentNumber >> (8 * (15 - i))) & 0xff;
  }
  return uint8View;
}
