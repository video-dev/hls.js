export default class AESCrypto {
  private subtle: SubtleCrypto;
  private aesIV: Uint8Array;

  constructor(subtle: SubtleCrypto, iv: Uint8Array) {
    this.subtle = subtle;
    this.aesIV = iv;
  }

  decrypt(data: ArrayBuffer, key: CryptoKey) {
    return this.subtle.decrypt({ name: 'AES-CBC', iv: this.aesIV }, key, data);
  }
}
