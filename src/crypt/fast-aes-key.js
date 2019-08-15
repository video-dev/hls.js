class FastAESKey {
  constructor (subtle, key) {
    this.subtle = subtle;
    this.key = key;
  }

  expandKey () {
    return this.subtle.importKey('raw', this.key, { name: 'AES-CBC' }, false, ['encrypt', 'decrypt']);
  }
}

export default FastAESKey;
