/**
 * SAMPLE-AES decrypter
*/

import Decrypter from '../crypt/decrypter';

class SampleAesDecrypter {
  constructor (observer, config, decryptdata, discardEPB) {
    this.decryptdata = decryptdata;
    this.discardEPB = discardEPB;
    this.decrypter = new Decrypter(observer, config, { removePKCS7Padding: false });
  }

  decryptBuffer (encryptedData, callback) {
    this.decrypter.decrypt(encryptedData, this.decryptdata.key.buffer, this.decryptdata.iv.buffer, callback);
  }

  // AAC - encrypt all full 16 bytes blocks starting from offset 16
  decryptAacSample (samples, sampleIndex, callback, sync) {
    const curUnit = samples[sampleIndex].unit;
    const encryptedData = curUnit.subarray(16, curUnit.length - curUnit.length % 16);
    const encryptedBuffer = encryptedData.buffer.slice(
      encryptedData.byteOffset,
      encryptedData.byteOffset + encryptedData.length);

    const localthis = this;
    this.decryptBuffer(encryptedBuffer, function (decryptedData) {
      decryptedData = new Uint8Array(decryptedData);
      curUnit.set(decryptedData, 16);

      if (!sync) {
        localthis.decryptAacSamples(samples, sampleIndex + 1, callback);
      }
    });
  }

  decryptAacSamples (samples, sampleIndex, callback) {
    for (;; sampleIndex++) {
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
  getAvcEncryptedData (decodedData) {
    const encryptedDataLen = Math.floor((decodedData.length - 48) / 160) * 16 + 16;
    const encryptedData = new Int8Array(encryptedDataLen);
    let outputPos = 0;
    for (let inputPos = 32; inputPos <= decodedData.length - 16; inputPos += 160, outputPos += 16) {
      encryptedData.set(decodedData.subarray(inputPos, inputPos + 16), outputPos);
    }

    return encryptedData;
  }

  getAvcDecryptedUnit (decodedData, decryptedData) {
    decryptedData = new Uint8Array(decryptedData);
    let inputPos = 0;
    for (let outputPos = 32; outputPos <= decodedData.length - 16; outputPos += 160, inputPos += 16) {
      decodedData.set(decryptedData.subarray(inputPos, inputPos + 16), outputPos);
    }

    return decodedData;
  }

  decryptAvcSample (samples, sampleIndex, unitIndex, callback, curUnit, sync) {
    const decodedData = this.discardEPB(curUnit.data);
    const encryptedData = this.getAvcEncryptedData(decodedData);
    const localthis = this;

    this.decryptBuffer(encryptedData.buffer, function (decryptedData) {
      curUnit.data = localthis.getAvcDecryptedUnit(decodedData, decryptedData);

      if (!sync) {
        localthis.decryptAvcSamples(samples, sampleIndex, unitIndex + 1, callback);
      }
    });
  }

  decryptAvcSamples (samples, sampleIndex, unitIndex, callback) {
    for (;; sampleIndex++, unitIndex = 0) {
      if (sampleIndex >= samples.length) {
        callback();
        return;
      }

      const curUnits = samples[sampleIndex].units;
      for (;; unitIndex++) {
        if (unitIndex >= curUnits.length) {
          break;
        }

        const curUnit = curUnits[unitIndex];
        if (curUnit.length <= 48 || (curUnit.type !== 1 && curUnit.type !== 5)) {
          continue;
        }

        const sync = this.decrypter.isSync();

        this.decryptAvcSample(samples, sampleIndex, unitIndex, callback, curUnit, sync);

        if (!sync) {
          return;
        }
      }
    }
  }
}

export default SampleAesDecrypter;
