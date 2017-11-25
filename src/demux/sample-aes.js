/**
 * SAMPLE-AES decrypter
*/

 import Decrypter from '../crypt/decrypter';

 class SampleAesDecrypter {

  constructor(observer, config, decryptdata, discardEPB) {
    this._decryptdata = decryptdata;
    this._discardEPB = discardEPB;
    this._decrypter = new Decrypter(observer, config);
  }

  _decryptBuffer(encryptedData, callback) {
    this._decrypter.decrypt(encryptedData, this._decryptdata.key.buffer, this._decryptdata.iv.buffer, callback);
  }

  // AAC - encrypt all full 16 bytes blocks starting from offset 16
  _decryptAacSample(samples, sampleIndex, callback, sync) {
    let curUnit = samples[sampleIndex].unit;
    let encryptedData = curUnit.subarray(16, curUnit.length - curUnit.length % 16);
    let encryptedBuffer = encryptedData.buffer.slice(
       encryptedData.byteOffset,
       encryptedData.byteOffset + encryptedData.length);

    let localthis = this;
    this._decryptBuffer(encryptedBuffer, function (decryptedData) {
      decryptedData = new Uint8Array(decryptedData);
      curUnit.set(decryptedData, 16);

      if (!sync) {
        localthis.decryptAacSamples(samples, sampleIndex + 1, callback);
      }
    });
  }

  decryptAacSamples(samples, sampleIndex, callback) {
    for (;; sampleIndex++) {
      if (sampleIndex >= samples.length) {
        callback();
        return;
      }

      if (samples[sampleIndex].unit.length < 32) {
        continue;
      }

      let sync = this._decrypter.isSync();

      this._decryptAacSample(samples, sampleIndex, callback, sync);

      if (!sync) {
        return;
      }
    }
  }

  // AVC - encrypt one 16 bytes block out of ten, starting from offset 32
  _getAvcEncryptedData(decodedData) {
    let encryptedDataLen = Math.floor((decodedData.length - 48) / 160) * 16 + 16;
    let encryptedData = new Int8Array(encryptedDataLen);
    let outputPos = 0;
    for (let inputPos = 32; inputPos <= decodedData.length - 16; inputPos += 160, outputPos += 16) {
      encryptedData.set(decodedData.subarray(inputPos, inputPos + 16), outputPos);
    }
    return encryptedData;
  }

  _getAvcDecryptedUnit(decodedData, decryptedData) {
    decryptedData = new Uint8Array(decryptedData);
    let inputPos = 0;
    for (let outputPos = 32; outputPos <= decodedData.length - 16; outputPos += 160, inputPos += 16) {
      decodedData.set(decryptedData.subarray(inputPos, inputPos + 16), outputPos);
    }
    return decodedData;
  }

  _decryptAvcSample(samples, sampleIndex, unitIndex, callback, curUnit, sync) {
    let decodedData = this._discardEPB(curUnit.data);
    let encryptedData = this._getAvcEncryptedData(decodedData);
    let localthis = this;

    this._decryptBuffer(encryptedData.buffer, function (decryptedData) {
      curUnit.data = localthis._getAvcDecryptedUnit(decodedData, decryptedData);

      if (!sync) {
        localthis.decryptAvcSamples(samples, sampleIndex, unitIndex + 1, callback);
      }
    });
  }

  decryptAvcSamples(samples, sampleIndex, unitIndex, callback) {
    for (;; sampleIndex++, unitIndex = 0) {
      if (sampleIndex >= samples.length) {
        callback();
        return;
      }

      let curUnits = samples[sampleIndex].units;
      for (;; unitIndex++) {
        if (unitIndex >= curUnits.length) {
          break;
        }

        let curUnit = curUnits[unitIndex];
        if (curUnit.length <= 48 || (curUnit.type !== 1 && curUnit.type !== 5)) {
          continue;
        }

        let sync = this._decrypter.isSync();

        this._decryptAvcSample(samples, sampleIndex, unitIndex, callback, curUnit, sync);

        if (!sync) {
          return;
        }
      }
    }
  }
 }

 export default SampleAesDecrypter;
