export default class AESCrypto {
  constructor(subtle,iv) {
    this._subtle = subtle;
    this._aesIV = iv;
  }

  decrypt(data, key) {
    return this._subtle.decrypt({name: 'AES-CBC', iv: this._aesIV}, key, data);
  }
}
