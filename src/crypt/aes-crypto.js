export default class AESCrypto {
  constructor(iv) {
    this.aesIV = iv;
  }

  decrypt(data, key) {
    return window.crypto.subtle.decrypt({name: 'AES-CBC', iv: this.aesIV}, key, data);
  }
}
