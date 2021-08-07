/**
 * SAMPLE-AES decrypter
 */

import { HlsConfig } from '../config';
import Decrypter from '../crypt/decrypter';
import { HlsEventEmitter } from '../events';
import type {
  AudioSample,
  AvcSample,
  AvcSampleUnit,
  DemuxedVideoTrack,
  KeyData,
} from '../types/demuxer';
import { discardEPB } from './tsdemuxer';

class SampleAesDecrypter {
  private keyData: KeyData;
  private decrypter: Decrypter;

  constructor(observer: HlsEventEmitter, config: HlsConfig, keyData: KeyData) {
    this.keyData = keyData;
    this.decrypter = new Decrypter(observer, config, {
      removePKCS7Padding: false,
    });
  }

  decryptBuffer(
    encryptedData: Uint8Array | ArrayBuffer,
    callback: (decryptedData: ArrayBuffer) => void
  ) {
    this.decrypter.decrypt(
      encryptedData,
      this.keyData.key.buffer,
      this.keyData.iv.buffer,
      callback
    );
  }

  // AAC - encrypt all full 16 bytes blocks starting from offset 16
  private decryptAacSample(
    samples: AudioSample[],
    sampleIndex: number,
    callback: () => void,
    sync: boolean
  ) {
    const curUnit = samples[sampleIndex].unit;
    const encryptedData = curUnit.subarray(
      16,
      curUnit.length - (curUnit.length % 16)
    );
    const encryptedBuffer = encryptedData.buffer.slice(
      encryptedData.byteOffset,
      encryptedData.byteOffset + encryptedData.length
    );

    const localthis = this;
    this.decryptBuffer(encryptedBuffer, (decryptedBuffer: ArrayBuffer) => {
      const decryptedData = new Uint8Array(decryptedBuffer);
      curUnit.set(decryptedData, 16);

      if (!sync) {
        localthis.decryptAacSamples(samples, sampleIndex + 1, callback);
      }
    });
  }

  decryptAacSamples(
    samples: AudioSample[],
    sampleIndex: number,
    callback: () => void
  ) {
    for (; ; sampleIndex++) {
      if (sampleIndex >= samples.length) {
        callback();
        return;
      }

      if (samples[sampleIndex].unit.length < 32) {
        continue;
      }

      const sync = this.decrypter.isSync();

      this.decryptAacSample(samples, sampleIndex, callback, sync);

      if (!sync) {
        return;
      }
    }
  }

  // AVC - encrypt one 16 bytes block out of ten, starting from offset 32
  getAvcEncryptedData(decodedData: Uint8Array) {
    const encryptedDataLen =
      Math.floor((decodedData.length - 48) / 160) * 16 + 16;
    const encryptedData = new Int8Array(encryptedDataLen);
    let outputPos = 0;
    for (
      let inputPos = 32;
      inputPos <= decodedData.length - 16;
      inputPos += 160, outputPos += 16
    ) {
      encryptedData.set(
        decodedData.subarray(inputPos, inputPos + 16),
        outputPos
      );
    }

    return encryptedData;
  }

  getAvcDecryptedUnit(
    decodedData: Uint8Array,
    decryptedData: ArrayLike<number> | ArrayBuffer | SharedArrayBuffer
  ) {
    const uint8DecryptedData = new Uint8Array(decryptedData);
    let inputPos = 0;
    for (
      let outputPos = 32;
      outputPos <= decodedData.length - 16;
      outputPos += 160, inputPos += 16
    ) {
      decodedData.set(
        uint8DecryptedData.subarray(inputPos, inputPos + 16),
        outputPos
      );
    }

    return decodedData;
  }

  decryptAvcSample(
    samples: AvcSample[],
    sampleIndex: number,
    unitIndex: number,
    callback: () => void,
    curUnit: AvcSampleUnit,
    sync: boolean
  ) {
    const decodedData = discardEPB(curUnit.data);
    const encryptedData = this.getAvcEncryptedData(decodedData);
    const localthis = this;

    this.decryptBuffer(
      encryptedData.buffer,
      function (decryptedBuffer: ArrayBuffer) {
        curUnit.data = localthis.getAvcDecryptedUnit(
          decodedData,
          decryptedBuffer
        );

        if (!sync) {
          localthis.decryptAvcSamples(
            samples,
            sampleIndex,
            unitIndex + 1,
            callback
          );
        }
      }
    );
  }

  decryptAvcSamples(
    samples: DemuxedVideoTrack['samples'],
    sampleIndex: number,
    unitIndex: number,
    callback: () => void
  ) {
    if (samples instanceof Uint8Array) {
      throw new Error('Cannot decrypt samples of type Uint8Array');
    }

    for (; ; sampleIndex++, unitIndex = 0) {
      if (sampleIndex >= samples.length) {
        callback();
        return;
      }

      const curUnits = samples[sampleIndex].units;
      for (; ; unitIndex++) {
        if (unitIndex >= curUnits.length) {
          break;
        }

        const curUnit = curUnits[unitIndex];
        if (
          curUnit.data.length <= 48 ||
          (curUnit.type !== 1 && curUnit.type !== 5)
        ) {
          continue;
        }

        const sync = this.decrypter.isSync();

        this.decryptAvcSample(
          samples,
          sampleIndex,
          unitIndex,
          callback,
          curUnit,
          sync
        );

        if (!sync) {
          return;
        }
      }
    }
  }
}

export default SampleAesDecrypter;
