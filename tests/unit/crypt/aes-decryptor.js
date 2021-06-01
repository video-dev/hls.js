import { removePadding } from '../../../src/crypt/aes-decryptor';

describe('AESDecryptor', function () {
  describe('removePadding()', function () {
    // this should never happen with a valid stream
    it('is a no-op when the last byte is 0', function () {
      const arr = new Uint8Array([1, 2, 3, 0]);
      expect(removePadding(arr)).to.equal(arr);
    });

    it('removes 1 byte when the last byte is 1', function () {
      const arr = new Uint8Array([1, 2, 3, 1]);
      expect(Array.from(new Uint8Array(removePadding(arr)))).to.deep.equal([
        1, 2, 3,
      ]);
    });

    it('removes 3 bytes when the last byte is 3', function () {
      const arr = new Uint8Array([1, 2, 3, 3]);
      expect(Array.from(new Uint8Array(removePadding(arr)))).to.deep.equal([1]);
    });

    it('removes 4 bytes when the last byte is 4', function () {
      const arr = new Uint8Array([1, 2, 3, 4]);
      expect(Array.from(new Uint8Array(removePadding(arr)))).to.deep.equal([]);
    });
  });
});
