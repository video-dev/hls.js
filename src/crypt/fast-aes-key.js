class FastAESKey {
  constructor(key) {
    this.key = key;
  }

  expandKey() {
    return window.crypto.subtle.importKey('raw', this.key, {name: 'AES-CBC'}, false, ['encrypt', 'decrypt']);
  }
}

export default FastAESKey;
