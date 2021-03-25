import AESCrypto from './aes-crypto';
import FastAESKey from './fast-aes-key';
import AESDecryptor, { removePadding } from './aes-decryptor';
import { logger } from '../utils/logger';
import { appendUint8Array } from '../utils/mp4-tools';
import { sliceUint8 } from '../utils/typed-array';
import type { HlsConfig } from '../config';
import type { HlsEventEmitter } from '../events';

const CHUNK_SIZE = 16; // 16 bytes, 128 bits

export default class Decrypter {
  private logEnabled: boolean = true;
  private observer: HlsEventEmitter;
  private config: HlsConfig;
  private removePKCS7Padding: boolean;
  private subtle: SubtleCrypto | null = null;
  private softwareDecrypter: AESDecryptor | null = null;
  private key: ArrayBuffer | null = null;
  private fastAesKey: FastAESKey | null = null;
  private remainderData: Uint8Array | null = null;
  private currentIV: ArrayBuffer | null = null;
  private currentResult: ArrayBuffer | null = null;

  constructor(
    observer: HlsEventEmitter,
    config: HlsConfig,
    { removePKCS7Padding = true } = {}
  ) {
    this.observer = observer;
    this.config = config;
    this.removePKCS7Padding = removePKCS7Padding;
    // built in decryptor expects PKCS7 padding
    if (removePKCS7Padding) {
      try {
        const browserCrypto = self.crypto;
        if (browserCrypto) {
          this.subtle =
            browserCrypto.subtle ||
            ((browserCrypto as any).webkitSubtle as SubtleCrypto);
        }
      } catch (e) {
        /* no-op */
      }
    }
    if (this.subtle === null) {
      this.config.enableSoftwareAES = true;
    }
  }

  destroy() {
    // @ts-ignore
    this.observer = null;
  }

  public isSync() {
    return this.config.enableSoftwareAES;
  }

  public flush(): Uint8Array | void {
    const { currentResult } = this;
    if (!currentResult) {
      this.reset();
      return;
    }
    const data = new Uint8Array(currentResult);
    this.reset();
    if (this.removePKCS7Padding) {
      return removePadding(data);
    }
    return data;
  }

  public reset() {
    this.currentResult = null;
    this.currentIV = null;
    this.remainderData = null;
    if (this.softwareDecrypter) {
      this.softwareDecrypter = null;
    }
  }

  public decrypt(
    data: Uint8Array | ArrayBuffer,
    key: ArrayBuffer,
    iv: ArrayBuffer,
    callback: (decryptedData: ArrayBuffer) => void
  ) {
    if (this.config.enableSoftwareAES) {
      this.softwareDecrypt(new Uint8Array(data), key, iv);
      const decryptResult = this.flush();
      if (decryptResult) {
        callback(decryptResult.buffer);
      }
    } else {
      this.webCryptoDecrypt(new Uint8Array(data), key, iv).then(callback);
    }
  }

  public softwareDecrypt(
    data: Uint8Array,
    key: ArrayBuffer,
    iv: ArrayBuffer
  ): ArrayBuffer | null {
    const { currentIV, currentResult, remainderData } = this;
    this.logOnce('JS AES decrypt');
    // The output is staggered during progressive parsing - the current result is cached, and emitted on the next call
    // This is done in order to strip PKCS7 padding, which is found at the end of each segment. We only know we've reached
    // the end on flush(), but by that time we have already received all bytes for the segment.
    // Progressive decryption does not work with WebCrypto

    if (remainderData) {
      data = appendUint8Array(remainderData, data);
      this.remainderData = null;
    }

    // Byte length must be a multiple of 16 (AES-128 = 128 bit blocks = 16 bytes)
    const currentChunk = this.getValidChunk(data);
    if (!currentChunk.length) {
      return null;
    }

    if (currentIV) {
      iv = currentIV;
    }

    let softwareDecrypter = this.softwareDecrypter;
    if (!softwareDecrypter) {
      softwareDecrypter = this.softwareDecrypter = new AESDecryptor();
    }
    softwareDecrypter.expandKey(key);

    const result = currentResult;

    this.currentResult = softwareDecrypter.decrypt(currentChunk.buffer, 0, iv);
    this.currentIV = sliceUint8(currentChunk, -16).buffer;

    if (!result) {
      return null;
    }
    return result;
  }

  public webCryptoDecrypt(
    data: Uint8Array,
    key: ArrayBuffer,
    iv: ArrayBuffer
  ): Promise<ArrayBuffer> {
    const subtle = this.subtle;
    if (this.key !== key || !this.fastAesKey) {
      this.key = key;
      this.fastAesKey = new FastAESKey(subtle, key);
    }
    return this.fastAesKey
      .expandKey()
      .then((aesKey) => {
        // decrypt using web crypto
        if (!subtle) {
          return Promise.reject(new Error('web crypto not initialized'));
        }

        const crypto = new AESCrypto(subtle, iv);
        return crypto.decrypt(data.buffer, aesKey);
      })
      .catch((err) => {
        return this.onWebCryptoError(err, data, key, iv) as ArrayBuffer;
      });
  }

  private onWebCryptoError(err, data, key, iv): ArrayBuffer | null {
    logger.warn('[decrypter.ts]: WebCrypto Error, disable WebCrypto API:', err);
    this.config.enableSoftwareAES = true;
    this.logEnabled = true;
    return this.softwareDecrypt(data, key, iv);
  }

  private getValidChunk(data: Uint8Array): Uint8Array {
    let currentChunk = data;
    const splitPoint = data.length - (data.length % CHUNK_SIZE);
    if (splitPoint !== data.length) {
      currentChunk = sliceUint8(data, 0, splitPoint);
      this.remainderData = sliceUint8(data, splitPoint);
    }
    return currentChunk;
  }

  private logOnce(msg: string) {
    if (!this.logEnabled) {
      return;
    }
    logger.log(`[decrypter.ts]: ${msg}`);
    this.logEnabled = false;
  }
}
