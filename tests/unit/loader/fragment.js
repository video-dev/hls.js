import Fragment from '../../../src/loader/fragment';

describe('Fragment class tests', function () {
  let frag;
  describe('endProgramDateTime getter', function () {
    beforeEach(function () {
      frag = new Fragment();
    });

    it('computes endPdt when pdt and duration are valid', function () {
      frag.programDateTime = 1000;
      frag.duration = 1;
      expect(frag.endProgramDateTime).to.equal(2000);
    });

    it('considers 0 a valid pdt', function () {
      frag.programDateTime = 0;
      frag.duration = 1;
      expect(frag.endProgramDateTime).to.equal(1000);
    });

    it('returns null if pdt is NaN', function () {
      frag.programDateTime = 'foo';
      frag.duration = 1;
      expect(frag.endProgramDateTime).to.equal(null);
    });

    it('defaults duration to 0 if duration is NaN', function () {
      frag.programDateTime = 1000;
      frag.duration = 'foo';
      expect(frag.endProgramDateTime).to.equal(1000);
    });
  });
});
