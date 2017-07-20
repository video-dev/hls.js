class FastAESKey {
  constructor(subtle,key) {
    this._subtle = subtle;
    this._key = key;
  }

  expandKey() {
    return this._subtle.importKey('raw', this._key, {name: 'AES-CBC'}, false, ['encrypt', 'decrypt']);
  }
}

export default FastAESKey;
