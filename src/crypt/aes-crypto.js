export default class AESCrypto {
  constructor(subtle,iv) {
    this.subtle = subtle;
    this.aesIV = iv;
  }

  decrypt(data, key) {
    return this.subtle.decrypt({name: 'AES-CBC', iv: this.aesIV}, key, data);
  }
}
