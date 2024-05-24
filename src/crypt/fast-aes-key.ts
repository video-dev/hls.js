export default class FastAESKey {
  private subtle: SubtleCrypto;
  private key: ArrayBuffer;

  constructor(subtle: SubtleCrypto, key: ArrayBuffer) {
    this.subtle = subtle;
    this.key = key;
  }

  expandKey() {
    return this.subtle.importKey('raw', this.key, { name: 'AES-CBC' }, false, [
      'encrypt',
      'decrypt',
    ]);
  }
}
