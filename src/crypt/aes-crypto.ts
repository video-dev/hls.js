export default class AESCrypto {
  private subtle: any;
  private aesIV: ArrayBuffer;

  constructor (subtle, iv) {
    this.subtle = subtle;
    this.aesIV = iv;
  }

  decrypt (data: ArrayBuffer, key) {
    return this.subtle.decrypt({ name: 'AES-CBC', iv: this.aesIV }, key, data);
  }
}
