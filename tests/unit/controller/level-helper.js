import * as LevelHelper from '../../../src/controller/level-helper';
import Level from '../../../src/loader/level';
import Fragment from '../../../src/loader/fragment';
import sinon from 'sinon';
const assert = require('assert');

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

describe('LevelHelper Tests', function () {
  let sandbox;
  beforeEach(function () {
    sandbox = sinon.createSandbox();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('mapSegmentIntersection', function () {
    it('iterates over the intersection of the fragment arrays', function () {
      const oldPlaylist = generatePlaylist([1, 2, 3, 4, 5]);
      const newPlaylist = generatePlaylist([3, 4, 5, 6, 7]);
      const actual = getIteratedSequence(oldPlaylist, newPlaylist);
      assert.deepEqual(actual, [3, 4, 5]);
    });

    it('can iterate with one overlapping fragment', function () {
      const oldPlaylist = generatePlaylist([1, 2, 3, 4, 5]);
      const newPlaylist = generatePlaylist([5, 6, 7, 8, 9]);
      const actual = getIteratedSequence(oldPlaylist, newPlaylist);
      assert.deepEqual(actual, [5]);
    });

    it('can iterate over the entire segment array', function () {
      const oldPlaylist = generatePlaylist([1, 2, 3]);
      const newPlaylist = generatePlaylist([1, 2, 3]);
      const actual = getIteratedSequence(oldPlaylist, newPlaylist);
      assert.deepEqual(actual, [1, 2, 3]);
    });

    it('can iterate when overlapping happens at the start of the old playlist', function () {
      const oldPlaylist = generatePlaylist([5, 6, 7, 8]);
      const newPlaylist = generatePlaylist([3, 4, 5, 6]);
      const actual = getIteratedSequence(oldPlaylist, newPlaylist);
      assert.deepEqual(actual, [5, 6]);
    });

    it('never executes the callback if no intersection exists', function () {
      const oldPlaylist = generatePlaylist([1, 2, 3, 4, 5]);
      const newPlaylist = generatePlaylist([10, 11, 12]);
      const actual = getIteratedSequence(oldPlaylist, newPlaylist);
      assert.deepEqual(actual, []);
    });

    it('exits early if either playlist does not exist', function () {
      let oldPlaylist = null;
      let newPlaylist = generatePlaylist([10, 11, 12]);
      assert.deepEqual(getIteratedSequence(oldPlaylist, newPlaylist), []);
      oldPlaylist = newPlaylist;
      newPlaylist = null;
      assert.deepEqual(getIteratedSequence(oldPlaylist, newPlaylist), []);
    });
  });

  describe('adjustSliding', function () {
    // generatePlaylist creates fragments with a duration of 5 seconds
    it('adds the start time of the first comment segment to all other segment', function () {
      const oldPlaylist = generatePlaylist([1, 2, 3]); // start times: 0, 5, 10
      const newPlaylist = generatePlaylist([3, 4, 5]);
      LevelHelper.adjustSliding(oldPlaylist, newPlaylist);
      const actual = newPlaylist.fragments.map(f => f.start);
      assert.deepEqual(actual, [10, 15, 20]);
    });

    it('does not apply sliding if no common segments exist', function () {
      const oldPlaylist = generatePlaylist([1, 2, 3]);
      const newPlaylist = generatePlaylist([5, 6, 7]);
      LevelHelper.adjustSliding(oldPlaylist, newPlaylist);
      const actual = newPlaylist.fragments.map(f => f.start);
      assert.deepEqual(actual, [0, 5, 10]);
    });
  });

  describe('mergeSubtitlePlaylists', function () {
    it('transfers start times where segments overlap, and extrapolates the start of any new segment', function () {
      const oldPlaylist = generatePlaylist([1, 2, 3, 4]); // start times: 0, 5, 10, 15
      const newPlaylist = generatePlaylist([2, 3, 4, 5]);
      LevelHelper.mergeSubtitlePlaylists(oldPlaylist, newPlaylist);
      const actual = newPlaylist.fragments.map(f => f.start);
      assert.deepEqual(actual, [5, 10, 15, 20]);
    });

    it('does not change start times when there is no segment overlap', function () {
      const oldPlaylist = generatePlaylist([1, 2, 3]);
      const newPlaylist = generatePlaylist([5, 6, 7]);
      LevelHelper.mergeSubtitlePlaylists(oldPlaylist, newPlaylist);
      const actual = newPlaylist.fragments.map(f => f.start);
      assert.deepEqual(actual, [0, 5, 10]);
    });

    it('adjusts sliding using the reference start if there is no segment overlap', function () {
      const oldPlaylist = generatePlaylist([1, 2, 3]);
      const newPlaylist = generatePlaylist([5, 6, 7]);
      LevelHelper.mergeSubtitlePlaylists(oldPlaylist, newPlaylist, 30);
      const actual = newPlaylist.fragments.map(f => f.start);
      assert.deepEqual(actual, [30, 35, 40]);
    });

    it('does not extrapolate if the new playlist starts before the old', function () {
      const oldPlaylist = generatePlaylist([3, 4, 5]);
      oldPlaylist.fragments.forEach(f => {
        f.start += 10;
      });
      const newPlaylist = generatePlaylist([1, 2, 3]);
      LevelHelper.mergeSubtitlePlaylists(oldPlaylist, newPlaylist);
      const actual = newPlaylist.fragments.map(f => f.start);
      assert.deepEqual(actual, [0, 5, 10]);
    });
  });

  describe('computeReloadInterval', function () {
    it('returns the averagetargetduration of the new level if available', function () {
      const oldPlaylist = generatePlaylist([1, 2]);
      const newPlaylist = generatePlaylist([3, 4]);
      newPlaylist.averagetargetduration = 5;
      const actual = LevelHelper.computeReloadInterval(oldPlaylist, newPlaylist, null);
      assert.strictEqual(actual, 5000);
    });

    it('returns the targetduration of the new level if averagetargetduration is falsy', function () {
      const oldPlaylist = generatePlaylist([1, 2]);
      const newPlaylist = generatePlaylist([3, 4]);
      newPlaylist.averagetargetduration = null;
      newPlaylist.targetduration = 4;
      let actual = LevelHelper.computeReloadInterval(oldPlaylist, newPlaylist, null);
      assert.strictEqual(actual, 4000);

      newPlaylist.averagetargetduration = null;
      actual = LevelHelper.computeReloadInterval(oldPlaylist, newPlaylist, null);
      assert.strictEqual(actual, 4000);
    });

    it('halves the reload interval if the playlist contains the same segments', function () {
      const oldPlaylist = generatePlaylist([1, 2]);
      const newPlaylist = generatePlaylist([1, 2]);
      newPlaylist.averagetargetduration = 5;
      const actual = LevelHelper.computeReloadInterval(oldPlaylist, newPlaylist, null);
      assert.strictEqual(actual, 2500);
    });

    it('rounds the reload interval', function () {
      const oldPlaylist = generatePlaylist([1, 2]);
      const newPlaylist = generatePlaylist([3, 4]);
      newPlaylist.averagetargetduration = 5.9999;
      const actual = LevelHelper.computeReloadInterval(oldPlaylist, newPlaylist, null);
      assert.strictEqual(actual, 6000);
    });

    it('subtracts the request time of the last level load from the reload interval', function () {
      const oldPlaylist = generatePlaylist([1, 2]);
      const newPlaylist = generatePlaylist([3, 4]);
      newPlaylist.averagetargetduration = 5;

      const clock = sandbox.useFakeTimers();
      clock.tick(2000);
      const actual = LevelHelper.computeReloadInterval(oldPlaylist, newPlaylist, 1000);
      assert.strictEqual(actual, 4000);
    });

    it('returns a minimum of half the target duration', function () {
      const oldPlaylist = generatePlaylist([1, 2]);
      const newPlaylist = generatePlaylist([3, 4]);
      newPlaylist.averagetargetduration = 5;

      const clock = sandbox.useFakeTimers();
      clock.tick(9000);
      const actual = LevelHelper.computeReloadInterval(oldPlaylist, newPlaylist, 1000);
      assert.strictEqual(actual, 2500);
    });
  });
});
