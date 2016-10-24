class AESDecryptor {
  constructor(keyBuffer) {
    // convert keyBuffer to Uint32Array
    var key = this.uint8ArrayToUint32Array_(keyBuffer);
    var keySize = this.keySize = key.length;

    if (keySize !== 4 && keySize !== 6 && keySize !== 8) {
      throw new Error('Invalid aes key size=' + keySize);
    }

    var nRounds = keySize + 6;
    this.ksRows = (nRounds + 1) * 4;
    this.keyWords = key;
    this.subMix = [];
    this.invSubMix = [];
    this.initTable();
    this.expandKey();
  }

  uint8ArrayToUint32Array_(arrayBuffer) {
    var view = new DataView(arrayBuffer);
    var newArray = new Uint32Array(4);
    for (var i = 0; i < newArray.length; i++) {
      newArray[i] = view.getUint32(i * 4);
    }
    return newArray;
  }

  initTable() {
    var sBox = this.sBox = new Uint32Array(256);
    var invSBox = this.invSBox= new Uint32Array(256);
    var subMix0 = this.subMix[0] = new Uint32Array(256);
    var subMix1 = this.subMix[1] = new Uint32Array(256);
    var subMix2 = this.subMix[2] = new Uint32Array(256);
    var subMix3 = this.subMix[3] = new Uint32Array(256);
    var invSubMix0 = this.invSubMix[0] = new Uint32Array(256);
    var invSubMix1 = this.invSubMix[1] = new Uint32Array(256);
    var invSubMix2 = this.invSubMix[2] = new Uint32Array(256);
    var invSubMix3 = this.invSubMix[3] = new Uint32Array(256);
    this.rcon = [0x0, 0x1, 0x2, 0x4, 0x8, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

    var d = new Uint32Array(256);
    var x = 0;
    var xi = 0;
    var i = 0;
    for (i = 0; i < 256; i++) {
      if (i < 128) {
        d[i] = i << 1;
      } else {
        d[i] = (i << 1) ^ 0x11b;
      }
    }

    for (i = 0; i < 256; i++) {
      var sx = xi ^ (xi << 1) ^ (xi << 2) ^ (xi << 3) ^ (xi << 4);
      sx = (sx >>> 8) ^ (sx & 0xff) ^ 0x63;
      sBox[x] = sx;
      invSBox[sx] = x;

      // Compute multiplication
      var x2 = d[x];
      var x4 = d[x2];
      var x8 = d[x4];

      // Compute sub/invSub bytes, mix columns tables
      var t = (d[sx] * 0x101) ^ (sx * 0x1010100);
      subMix0[x] = (t << 24) | (t >>> 8);
      subMix1[x] = (t << 16) | (t >>> 16);
      subMix2[x] = (t << 8) | (t >>> 24);
      subMix3[x] = t;

      // Compute inv sub bytes, inv mix columns tables
      t = (x8 * 0x1010101) ^ (x4 * 0x10001) ^ (x2 * 0x101) ^ (x * 0x1010100);
      invSubMix0[sx] = (t << 24) | (t >>> 8);
      invSubMix1[sx] = (t << 16) | (t >>> 16);
      invSubMix2[sx] = (t << 8) | (t >>> 24);
      invSubMix3[sx] = t;

      // Compute next counter
      if (!x) {
        x = xi = 1;
      } else {
        x = x2 ^ d[d[d[x8 ^ x2]]];
        xi ^= d[d[xi]];
      }
    }
  }

  expandKey() {
    var keySchedule = this.keySchedule = new Uint32Array(this.ksRows).fill(0);
    var rcon = this.rcon;
    var invKeySchedule = this.invKeySchedule = new Uint32Array(this.ksRows).fill(0);
    var keySize = this.keySize;
    var keyWords = this.keyWords;
    var ksRows = this.ksRows;
    var sbox = this.sBox;
    var invSubMix0 = this.invSubMix[0];
    var invSubMix1 = this.invSubMix[1];
    var invSubMix2 = this.invSubMix[2];
    var invSubMix3 = this.invSubMix[3];
    var prev;
    var t;

    for (var ksRow = 0; ksRow < ksRows; ksRow++) {
      if (ksRow < keySize) {
        prev = keySchedule[ksRow] = keyWords[ksRow];
        continue;
      }
      t = prev;

      if (ksRow % keySize === 0) {
        // Rot word
        t = (t << 8) | (t >>> 24);

        // Sub word
        t = (sbox[t >>> 24] << 24) | (sbox[(t >>> 16) & 0xff] << 16) | (sbox[(t >>> 8) & 0xff] << 8) | sbox[t & 0xff];

        // Mix Rcon
        t ^= rcon[(ksRow / keySize) | 0] << 24;
      } else if (keySize > 6 && ksRow % keySize === 4)  {
        // Sub word
        t = (sbox[t >>> 24] << 24) | (sbox[(t >>> 16) & 0xff] << 16) | (sbox[(t >>> 8) & 0xff] << 8) | sbox[t & 0xff];
      }

      keySchedule[ksRow] = prev = (keySchedule[ksRow - keySize] ^ t) >>> 0;
    }

    for (var invKsRow = 0; invKsRow < ksRows; invKsRow++) {
      ksRow = ksRows - invKsRow;
      if (invKsRow & 3) {
        t = keySchedule[ksRow];
      } else {
        t = keySchedule[ksRow - 4];
      }

      if (invKsRow < 4 || ksRow <= 4) {
        invKeySchedule[invKsRow] = t;
      } else {
        invKeySchedule[invKsRow] = invSubMix0[sbox[t >>> 24]] ^ invSubMix1[sbox[(t >>> 16) & 0xff]] ^ invSubMix2[sbox[(t >>> 8) & 0xff]] ^ invSubMix3[sbox[t & 0xff]];
      }

      invKeySchedule[invKsRow] = invKeySchedule[invKsRow] >>> 0;
    }
  }

  decrypt(inputData, offset, aesIV) {
    var invKeySched = this.invKeySchedule;
    var invKey0 = invKeySched[0];
    var invKey1 = invKeySched[1];
    var invKey2 = invKeySched[2];
    var invKey3 = invKeySched[3];
    var nRounds = this.keySize + 6;
    var invSubMix0 = this.invSubMix[0];
    var invSubMix1 = this.invSubMix[1];
    var invSubMix2 = this.invSubMix[2];
    var invSubMix3 = this.invSubMix[3];
    var invSBOX = this.invSBox;
    var output = new Uint8Array(inputData.byteLength);

    // parse iv to Uint32Array
    var iv = this.uint8ArrayToUint32Array_(aesIV);

    var mixing0 = iv[0];
    var mixing1 = iv[1];
    var mixing2 = iv[2];
    var mixing3 = iv[3];

    var input = new DataView(inputData);

    while (offset < inputData.byteLength) {
      var w0 = input.getUint32(offset);
      var w1 = input.getUint32(offset + 4);
      var w2 = input.getUint32(offset + 8);
      var w3 = input.getUint32(offset + 12);

      var s = new Uint32Array(4);
      var t = new Uint32Array(4);
      var r = new Uint32Array(4);

      s[0] = w0 ^ invKey0;
      s[1] = w3 ^ invKey1;
      s[2] = w2 ^ invKey2;
      s[3] = w1 ^ invKey3;

      var ksRow = 4;
      var i;
      for (i = 1; i < nRounds; i++) {
        t[0] = invSubMix0[s[0] >>> 24] ^ invSubMix1[(s[1] >>> 16) & 0xff] ^ invSubMix2[(s[2] >>> 8) & 0xff] ^ invSubMix3[s[3] & 0xff] ^ invKeySched[ksRow++];
        t[1] = invSubMix0[s[1] >>> 24] ^ invSubMix1[(s[2] >>> 16) & 0xff] ^ invSubMix2[(s[3] >>> 8) & 0xff] ^ invSubMix3[s[0] & 0xff] ^ invKeySched[ksRow++];
        t[2] = invSubMix0[s[2] >>> 24] ^ invSubMix1[(s[3] >>> 16) & 0xff] ^ invSubMix2[(s[0] >>> 8) & 0xff] ^ invSubMix3[s[1] & 0xff] ^ invKeySched[ksRow++];
        t[3] = invSubMix0[s[3] >>> 24] ^ invSubMix1[(s[0] >>> 16) & 0xff] ^ invSubMix2[(s[1] >>> 8) & 0xff] ^ invSubMix3[s[2] & 0xff] ^ invKeySched[ksRow++];
        // Update state
        s[0] = t[0];
        s[1] = t[1];
        s[2] = t[2];
        s[3] = t[3];
      }
      // Shift rows, sub bytes, add round key
      t[0] = ((invSBOX[s[0] >>> 24] << 24) | (invSBOX[(s[1] >>> 16) & 0xff] << 16) | (invSBOX[(s[2] >>> 8) & 0xff] << 8) | invSBOX[s[3] & 0xff]) ^ invKeySched[ksRow++];
      t[1] = ((invSBOX[s[1] >>> 24] << 24) | (invSBOX[(s[2] >>> 16) & 0xff] << 16) | (invSBOX[(s[3] >>> 8) & 0xff] << 8) | invSBOX[s[0] & 0xff]) ^ invKeySched[ksRow++];
      t[2] = ((invSBOX[s[2] >>> 24] << 24) | (invSBOX[(s[3] >>> 16) & 0xff] << 16) | (invSBOX[(s[0] >>> 8) & 0xff] << 8) | invSBOX[s[1] & 0xff]) ^ invKeySched[ksRow++];
      t[3] = ((invSBOX[s[3] >>> 24] << 24) | (invSBOX[(s[0] >>> 16) & 0xff] << 16) | (invSBOX[(s[1] >>> 8) & 0xff] << 8) | invSBOX[s[2] & 0xff]) ^ invKeySched[ksRow];

      r[3] = t[0] ^ mixing0;
      r[2] = t[3] ^ mixing1;
      r[1] = t[2] ^ mixing2;
      r[0] = t[1] ^ mixing3;

      // convert result to uint8Array and write to output
      var rView = new DataView(r.buffer);
      for (i = 0; i < 16; i++) {
        output[i + offset] = rView.getUint8(15 - i);
      }

      // reset iv to last 4 unsigned int
      mixing0 = w0;
      mixing1 = w1;
      mixing2 = w2;
      mixing3 = w3;

      offset += 16;
    }

    return this.unpad_(output);
  }

  unpad_(data) {
    // Remove the padding at the end of output.
    // The padding occurs because each decryption happens in 16 bytes, but the encrypted data is not modulus of 16
    var len = data.length;
    var bytesOfPadding = data[len - 1];

    // Uncomment to log info about padding
    //for (var i = bytesOfPadding; i > 0; --i) {
    //    var v = data[--len];
    //
    //    if (bytesOfPadding !== v) {
    //        console.warn('Invalid padding error: Expected ' + bytesOfPadding, ', but received ' + v);
    //    }
    //}

    return data.subarray(0, data.length - bytesOfPadding);
  }
}

export default AESDecryptor;
