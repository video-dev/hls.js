import { expect } from 'chai';
import { LevelKey } from '../../../src/loader/level-key';

describe('LevelKey', function () {
  describe('getDecryptData', function () {
    function ivFor(sn: number): number[] {
      const key = new LevelKey(
        'AES-128',
        'https://example.com/key',
        'identity',
      );
      const iv = key.getDecryptData(sn)?.iv;
      expect(iv).to.be.an.instanceOf(Uint8Array);
      return Array.from(iv as Uint8Array);
    }

    it('uses the media sequence number as the IV when none is given', function () {
      expect(ivFor(1)).to.deep.equal([
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1,
      ]);
      expect(ivFor(0x01020304)).to.deep.equal([
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4,
      ]);
    });

    it('keeps the bits of a media sequence number of 2^32 or more', function () {
      expect(ivFor(2 ** 32 + 1)).to.deep.equal([
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1,
      ]);
      expect(ivFor(Number.MAX_SAFE_INTEGER)).to.deep.equal([
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0x1f, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
      ]);
    });
  });
});
