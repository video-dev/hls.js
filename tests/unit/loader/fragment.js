const assert = require('assert');
import Fragment from '../../../src/loader/fragment';

describe('Fragment class tests', function () {
  let frag;
  describe('endPdt getter', function () {
    beforeEach(function () {
      frag = new Fragment();
    });

    it('computes endPdt when pdt and duration are valid', function () {
      frag.pdt = 1000;
      frag.duration = 1;
      assert.strictEqual(frag.endPdt, 2000);
    });

    it('considers 0 a valid pdt', function () {
      frag.pdt = 0;
      frag.duration = 1;
      assert.strictEqual(frag.endPdt, 1000);
    });

    it('returns null if pdt is NaN', function () {
      frag.pdt = 'foo';
      frag.duration = 1;
      assert.strictEqual(frag.endPdt, null);
    });

    it('defaults duration to 0 if duration is NaN', function () {
      frag.pdt = 1000;
      frag.duration = 'foo';
      assert.strictEqual(frag.endPdt, 1000);
    });
  });
});
