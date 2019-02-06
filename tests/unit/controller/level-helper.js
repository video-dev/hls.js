import * as LevelHelper from '../../../src/controller/level-helper';
import Level from '../../../src/loader/level';
import Fragment from '../../../src/loader/fragment';
import sinon from 'sinon';

const generatePlaylist = (sequenceNumbers) => {
  const playlist = new Level('');
  playlist.startSN = sequenceNumbers[0];
  playlist.endSN = sequenceNumbers[sequenceNumbers.length - 1];
  playlist.fragments = sequenceNumbers.map((n, i) => {
    const frag = new Fragment();
    frag.sn = n;
    frag.start = i * 5;
    frag.duration = 5;
    return frag;
  });
  return playlist;
};

const getIteratedSequence = (oldPlaylist, newPlaylist) => {
  const actual = [];
  LevelHelper.mapFragmentIntersection(oldPlaylist, newPlaylist, (oldFrag, newFrag) => {
    if (oldFrag.sn !== newFrag.sn) {
      throw new Error('Expected old frag and new frag to have the same SN');
    }
    actual.push(newFrag.sn);
  });
  return actual;
};

describe('Level-Helper Tests', function () {
  describe('mapSegmentIntersection', function () {
    it('iterates over the intersection of the fragment arrays', function () {
      const oldPlaylist = generatePlaylist([1, 2, 3, 4, 5]);
      const newPlaylist = generatePlaylist([3, 4, 5, 6, 7]);
      const actual = getIteratedSequence(oldPlaylist, newPlaylist);
      expect(actual).to.deep.equal([3, 4, 5]);
    });

    it('can iterate with one overlapping fragment', function () {
      const oldPlaylist = generatePlaylist([1, 2, 3, 4, 5]);
      const newPlaylist = generatePlaylist([5, 6, 7, 8, 9]);
      const actual = getIteratedSequence(oldPlaylist, newPlaylist);
      expect(actual).to.deep.equal([5]);
    });

    it('can iterate when overlapping happens at the start of the old playlist', function () {
      const oldPlaylist = generatePlaylist([5, 6, 7, 8]);
      const newPlaylist = generatePlaylist([3, 4, 5, 6]);
      const actual = getIteratedSequence(oldPlaylist, newPlaylist);
      expect(actual).to.deep.equal([5, 6]);
    });

    it('never executes the callback if no intersection exists', function () {
      const oldPlaylist = generatePlaylist([1, 2, 3, 4, 5]);
      const newPlaylist = generatePlaylist([10, 11, 12]);
      const actual = getIteratedSequence(oldPlaylist, newPlaylist);
      expect(actual).to.deep.equal([]);
    });

    it('exits early if either playlist does not exist', function () {
      let oldPlaylist = null;
      let newPlaylist = generatePlaylist([10, 11, 12]);
      expect(getIteratedSequence(oldPlaylist, newPlaylist)).to.deep.equal([]);
      oldPlaylist = newPlaylist;
      newPlaylist = null;
      expect(getIteratedSequence(oldPlaylist, newPlaylist)).to.deep.equal([]);
    });
  });

  describe('adjustSliding', function () {
    // generatePlaylist creates fragments with a duration of 5 seconds
    it('adds the start time of the first comment segment to all other segment', function () {
      const oldPlaylist = generatePlaylist([1, 2, 3]); // start times: 0, 5, 10
      const newPlaylist = generatePlaylist([3, 4, 5]);
      LevelHelper.adjustSliding(oldPlaylist, newPlaylist);
      const actual = newPlaylist.fragments.map(f => f.start);
      expect(actual).to.deep.equal([10, 15, 20]);
    });

    it('does not apply sliding if no common segments exist', function () {
      const oldPlaylist = generatePlaylist([1, 2, 3]);
      const newPlaylist = generatePlaylist([5, 6, 7]);
      LevelHelper.adjustSliding(oldPlaylist, newPlaylist);
      const actual = newPlaylist.fragments.map(f => f.start);
      expect(actual).to.deep.equal([0, 5, 10]);
    });
  });

  describe('mergeSubtitlePlaylists', function () {
    it('transfers start times where segments overlap, and extrapolates the start of any new segment', function () {
      const oldPlaylist = generatePlaylist([1, 2, 3, 4]); // start times: 0, 5, 10, 15
      const newPlaylist = generatePlaylist([2, 3, 4, 5]);
      LevelHelper.mergeSubtitlePlaylists(oldPlaylist, newPlaylist);
      const actual = newPlaylist.fragments.map(f => f.start);
      expect(actual).to.deep.equal([5, 10, 15, 20]);
    });

    it('does not change start times when there is no segment overlap', function () {
      const oldPlaylist = generatePlaylist([1, 2, 3]);
      const newPlaylist = generatePlaylist([5, 6, 7]);
      LevelHelper.mergeSubtitlePlaylists(oldPlaylist, newPlaylist);
      const actual = newPlaylist.fragments.map(f => f.start);
      expect(actual).to.deep.equal([0, 5, 10]);
    });

    it('does not extrapolate if the new playlist starts before the old', function () {
      const oldPlaylist = generatePlaylist([3, 4, 5]);
      oldPlaylist.fragments.forEach(f => {
        f.start += 10;
      });
      const newPlaylist = generatePlaylist([1, 2, 3]);
      LevelHelper.mergeSubtitlePlaylists(oldPlaylist, newPlaylist);
      const actual = newPlaylist.fragments.map(f => f.start);
      expect(actual).to.deep.equal([0, 5, 10]);
    });
  });
});
