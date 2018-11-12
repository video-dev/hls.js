import { removePadding } from '../../../src/crypt/aes-decryptor';
const assert = require('assert');

describe('AESDecryptor', () => {
  describe('removePadding()', () => {
    // this should never happen with a valid stream
    it('is a no-op when the last byte is 0', () => {
      const arr = new Uint8Array([1, 2, 3, 0]);
      assert.strictEqual(removePadding(arr.buffer), arr.buffer);
    });

    it('removes 1 byte when the last byte is 1', () => {
      const arr = new Uint8Array([1, 2, 3, 1]);
      assert.deepEqual(Array.from(new Uint8Array(removePadding(arr.buffer))), [1, 2, 3]);
    });

    it('removes 3 bytes when the last byte is 3', () => {
      const arr = new Uint8Array([1, 2, 3, 3]);
      assert.deepEqual(Array.from(new Uint8Array(removePadding(arr.buffer))), [1]);
    });

    it('removes 4 bytes when the last byte is 4', () => {
      const arr = new Uint8Array([1, 2, 3, 4]);
      assert.deepEqual(Array.from(new Uint8Array(removePadding(arr.buffer))), []);
    });
  });
});
