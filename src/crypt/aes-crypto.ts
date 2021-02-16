export default class AESCrypto {
  private subtle: SubtleCrypto;
  private aesIV: ArrayBuffer;

  constructor(subtle: SubtleCrypto, iv: ArrayBuffer) {
    this.subtle = subtle;
    this.aesIV = iv;
  }

  decrypt(data: ArrayBuffer, key: CryptoKey) {
    return this.subtle.decrypt({ name: 'AES-CBC', iv: this.aesIV }, key, data);
  }
}
