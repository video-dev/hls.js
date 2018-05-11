import Fragment from '../../../src/loader/fragment';
import assert from 'assert';

describe('Fragment tests', function () {
  describe('get keyLoadNeeded', function () {
    it('returns true if the fragment needs to be decrypted', function () {
      const frag = new Fragment();
      frag._decryptdata = {
        uri: 'foo.bar',
        key: null
      };

      assert(frag.encrypted);
    });

    it('returns false if the key uri is null', function () {
      const frag = new Fragment();
      frag._decryptdata = {
        uri: null,
        key: null
      };

      assert.strictEqual(frag.encrypted, false);
    });

    it('returns false if the frag has already been decrypted', function () {
      const frag = new Fragment();
      frag._decryptdata = {
        uri: 'foo.bar',
        key: 'foo'
      };

      assert.strictEqual(frag.encrypted, false);
    });

    it('returns false if the frag does not need decryption', function () {
      const frag = new Fragment();
      assert.strictEqual(frag.encrypted, false);
    });
  });
});
