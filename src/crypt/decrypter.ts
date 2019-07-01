import AESCrypto from './aes-crypto';
import FastAESKey from './fast-aes-key';
import AESDecryptor, { removePadding } from './aes-decryptor';
import { ErrorTypes, ErrorDetails } from '../errors';
import { logger } from '../utils/logger';
import { getSelfScope } from '../utils/get-self-scope';
import { appendUint8Array } from '../utils/mp4-tools';

// see https://stackoverflow.com/a/11237259/589493
const global = getSelfScope(); // safeguard for code that might run both on worker and main thread
const CHUNK_SIZE = 16; // 16 bytes, 128 bits

export default class Decrypter {
  private logEnabled: boolean = true;
  private observer: any;
  private config: any;
  private removePKCS7Padding: boolean;
  private disableWebCrypto: boolean;
  private subtle: boolean = false;
  private softwareDecrypter: AESDecryptor | null = null;
  private key: ArrayBuffer | null = null;
  private fastAesKey: FastAESKey | null = null;
  private remainderData: Uint8Array | null = null;
  private currentIV: ArrayBuffer | null = null;
  private currentResult: ArrayBuffer | null = null;

  constructor (observer, config, { removePKCS7Padding = true } = {}) {
    this.observer = observer;
    this.config = config;
    this.removePKCS7Padding = removePKCS7Padding;
    // built in decryptor expects PKCS7 padding
    if (removePKCS7Padding) {
      try {
        const browserCrypto = global.crypto;
        if (browserCrypto) {
          this.subtle = browserCrypto.subtle || browserCrypto.webkitSubtle;
        }
      } catch (e) {}
    }
    this.disableWebCrypto = !this.subtle || config.enableSoftwareAES;
  }

  isSync () {
    return (this.disableWebCrypto && this.config.enableSoftwareAES);
  }

  decrypt (data: Uint8Array, key: ArrayBuffer, iv: ArrayBuffer, callback: (buffer: ArrayBuffer) => void): void {
    const { config } = this;
    // Only software decryption works for progressive parsing. On construction of Hls.js, enableSoftwareAES is set to
    // true if using the progressive Fetch loader
    if (config.enableSoftwareAES) {
      this.logOnce('JS AES decrypt');
      this.decryptProgressively(data, key, iv, callback);
    } else {
      this.logOnce('WebCrypto AES decrypt');
      this.webCryptoDecrypt(data, key, iv, callback);
    }
  }

  flush (): Uint8Array | void {
    const { currentResult } = this;
    if (!currentResult) {
      this.reset();
      return;
    }
    let data = currentResult;
    if (this.removePKCS7Padding) {
      data = removePadding(currentResult);
    }
    this.reset();
    return new Uint8Array(data);
  }

  onWebCryptoError (err, data, key, iv, callback) {
    logger.warn('[decrypter.ts]: WebCrypto Error, disable WebCrypto API');
    this.disableWebCrypto = true;
    this.logEnabled = true;
    this.decrypt(data, key, iv, callback);
  }

  reset () {
    this.currentResult = null;
    this.currentIV = null;
    this.remainderData = null;
    if (this.softwareDecrypter) {
      this.softwareDecrypter = null;
    }
  }

  private decryptProgressively (data: Uint8Array, key: ArrayBuffer, iv: ArrayBuffer, callback: (buffer: ArrayBuffer) => void): void {
    let { currentIV, currentResult, softwareDecrypter, remainderData } = this;

    // The output is staggered during progressive parsing - the current result is cached, and emitted on the next call
    // This is done in order to strip PKCS7 padding, which is found at the end of each segment. We only know we've reached
    // the end on flush(), but by that time we have already received all bytes for the segment.
    // Progressive decryption does not work with WebCrypto
    if (currentResult) {
      callback(currentResult);
      this.currentResult = null;
    }

    if (remainderData) {
      data = appendUint8Array(remainderData, data);
      this.remainderData = null;
    }

    // Byte length must be a multiple of 16 (AES-128 = 128 bit blocks = 16 bytes)
    const currentChunk = this.getValidChunk(data);
    if (!currentChunk.length) {
      return;
    }

    if (currentIV) {
      iv = currentIV;
    }
    if (!softwareDecrypter) {
      softwareDecrypter = this.softwareDecrypter = new AESDecryptor();
    }
    softwareDecrypter.expandKey(key);
    this.currentResult = softwareDecrypter.decrypt(currentChunk.buffer, 0, iv);
    this.currentIV = currentChunk.slice(-16).buffer;
  }

  private webCryptoDecrypt (data: Uint8Array, key: ArrayBuffer, iv: ArrayBuffer, callback: (buffer: ArrayBuffer) => void): void  {
    const subtle = this.subtle;
    if (this.key !== key || !this.fastAesKey) {
      this.key = key;
      this.fastAesKey = new FastAESKey(subtle, key);
    }
    this.fastAesKey.expandKey()
      .then((aesKey) => {
        // decrypt using web crypto
        let crypto = new AESCrypto(subtle, iv);
        crypto.decrypt(data.buffer, aesKey)
          .catch((err) => {
            this.onWebCryptoError(err, data, key, iv, callback);
          })
          .then((result) => {
            callback(result);
          });
      })
      .catch((err) => {
        this.onWebCryptoError(err, data, key, iv, callback);
      });
  }

  private getValidChunk (data: Uint8Array) : Uint8Array {
    let currentChunk = data;
    const splitPoint = data.length - (data.length % CHUNK_SIZE);
    if (splitPoint !== data.length) {
      currentChunk = data.slice(0, splitPoint);
      this.remainderData = data.slice(splitPoint);
    }
    return currentChunk;
  }

  private logOnce (msg: string) {
    if (!this.logEnabled) {
      return;
    }
    logger.log(`[decrypter.ts]: ${msg}`);
    this.logEnabled = false;
  }
}
