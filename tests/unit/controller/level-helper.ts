import {
  adjustSliding,
  computeReloadInterval,
  mapFragmentIntersection,
  mapPartIntersection,
  mergeDetails,
} from '../../../src/utils/level-helper';
import { LevelDetails } from '../../../src/loader/level-details';
import { Fragment, Part } from '../../../src/loader/fragment';
import { PlaylistLevelType } from '../../../src/types/loader';
import { AttrList } from '../../../src/utils/attr-list';
import M3U8Parser from '../../../src/loader/m3u8-parser';
import sinon from 'sinon';
import chai from 'chai';
import sinonChai from 'sinon-chai';

chai.use(sinonChai);
const expect = chai.expect;

const generatePlaylist = (sequenceNumbers, offset = 0, duration = 5) => {
  const playlist = new LevelDetails('');
  playlist.startSN = sequenceNumbers[0];
  playlist.endSN = sequenceNumbers[sequenceNumbers.length - 1];
  playlist.fragments = sequenceNumbers.map((n, i) => {
    const frag = new Fragment(PlaylistLevelType.MAIN, '');
    frag.sn = n;
    frag.start = i * 5 + offset;
    frag.duration = duration;
    return frag;
  });
  return playlist;
};

const getIteratedSequence = (oldPlaylist, newPlaylist) => {
  const actual: number[] = [];
  mapFragmentIntersection(oldPlaylist, newPlaylist, (oldFrag, newFrag) => {
    if (oldFrag.sn !== newFrag.sn) {
      throw new Error('Expected old frag and new frag to have the same SN');
    }
    actual.push(newFrag.sn as number);
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
      expect(actual).to.deep.equal([3, 4, 5]);
    });

    it('can iterate with one overlapping fragment', function () {
      const oldPlaylist = generatePlaylist([1, 2, 3, 4, 5]);
      const newPlaylist = generatePlaylist([5, 6, 7, 8, 9]);
      const actual = getIteratedSequence(oldPlaylist, newPlaylist);
      expect(actual).to.deep.equal([5]);
    });

    it('can iterate over the entire segment array', function () {
      const oldPlaylist = generatePlaylist([1, 2, 3]);
      const newPlaylist = generatePlaylist([1, 2, 3]);
      const actual = getIteratedSequence(oldPlaylist, newPlaylist);
      expect(actual).to.deep.equal([1, 2, 3]);
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
  });

  describe('mapPartIntersection', function () {
    it('finds overlapping parts and executes callback for each', function () {
      const oldFrags = generatePlaylist([1, 2, 3]).fragments;
      const newFrags = generatePlaylist([2, 3, 4]).fragments;
      const attr = new AttrList('DURATION=1');
      const oldParts: Part[] = [
        new Part(attr, oldFrags[1], '', 0),
        new Part(attr, oldFrags[1], '', 1),
        new Part(attr, oldFrags[1], '', 2),
        new Part(attr, oldFrags[2], '', 0),
        new Part(attr, oldFrags[2], '', 1),
        new Part(attr, oldFrags[2], '', 2),
      ];
      const newParts: Part[] = [
        new Part(attr, newFrags[1], '', 0),
        new Part(attr, newFrags[1], '', 1),
        new Part(attr, newFrags[1], '', 2),
        new Part(attr, newFrags[2], '', 0),
        new Part(attr, newFrags[2], '', 1),
        new Part(attr, newFrags[2], '', 2),
      ];
      const intersectionFn = sinon.spy();
      mapPartIntersection(oldParts, newParts, intersectionFn);
      expect(intersectionFn).to.have.been.calledThrice;
      expect(intersectionFn.firstCall).to.have.been.calledWith(
        oldParts[3],
        newParts[0],
      );
      expect(intersectionFn.secondCall).to.have.been.calledWith(
        oldParts[4],
        newParts[1],
      );
      expect(intersectionFn.thirdCall).to.have.been.calledWith(
        oldParts[5],
        newParts[2],
      );
    });
  });

  describe('adjustSliding', function () {
    // generatePlaylist creates fragments with a duration of 5 seconds
    it('adds the start time of the first comment segment to all other segment', function () {
      const oldPlaylist = generatePlaylist([1, 2, 3]); // start times: 0, 5, 10
      const newPlaylist = generatePlaylist([3, 4, 5]);
      adjustSliding(oldPlaylist, newPlaylist);
      const actual = newPlaylist.fragments.map((f) => f.start);
      expect(actual).to.deep.equal([10, 15, 20]);
    });

    it('does not apply sliding if no common segments exist', function () {
      const oldPlaylist = generatePlaylist([1, 2, 3]);
      const newPlaylist = generatePlaylist([5, 6, 7]);
      adjustSliding(oldPlaylist, newPlaylist);
      const actual = newPlaylist.fragments.map((f) => f.start);
      expect(actual).to.deep.equal([0, 5, 10]);
    });

    it('does not apply sliding when segments meet but do not overlap', function () {
      const oldPlaylist = generatePlaylist([1, 2, 3]);
      const newPlaylist = generatePlaylist([4, 5, 6]);
      adjustSliding(oldPlaylist, newPlaylist);
      const actual = newPlaylist.fragments.map((f) => f.start);
      expect(actual).to.deep.equal([0, 5, 10]);
    });
  });

  describe('mergeDetails', function () {
    const getFragmentSequenceNumbers = (details: LevelDetails) =>
      details.fragments.map((f) => `${f?.sn}-${f?.cc}`).join(',');

    it('transfers start times where segments overlap, and extrapolates the start of any new segment', function () {
      const oldPlaylist = generatePlaylist([1, 2, 3, 4]); // start times: 0, 5, 10, 15
      const newPlaylist = generatePlaylist([2, 3, 4, 5]);
      mergeDetails(oldPlaylist, newPlaylist);
      const actual = newPlaylist.fragments.map((f) => f.start);
      expect(actual).to.deep.equal([5, 10, 15, 20]);
    });

    it('does not change start times when there is no segment overlap', function () {
      const oldPlaylist = generatePlaylist([1, 2, 3]);
      const newPlaylist = generatePlaylist([5, 6, 7]);
      mergeDetails(oldPlaylist, newPlaylist);
      const actual = newPlaylist.fragments.map((f) => f.start);
      expect(actual).to.deep.equal([0, 5, 10]);
    });

    it('does not extrapolate if the new playlist starts before the old', function () {
      const oldPlaylist = generatePlaylist([3, 4, 5]);
      oldPlaylist.fragments.forEach((f) => {
        f.start += 10;
      });
      const newPlaylist = generatePlaylist([1, 2, 3]);
      mergeDetails(oldPlaylist, newPlaylist);
      const actual = newPlaylist.fragments.map((f) => f.start);
      expect(actual).to.deep.equal([0, 5, 10]);
    });

    it('merges delta playlist updates', function () {
      const oldPlaylist = generatePlaylist([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      const newPlaylist = generatePlaylist([10, 11, 12]);
      newPlaylist.skippedSegments = 7;
      newPlaylist.startSN = 3;
      // @ts-ignore
      newPlaylist.fragments.unshift(null, null, null, null, null, null, null);
      const merged = generatePlaylist([3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 10);
      mergeDetails(oldPlaylist, newPlaylist);
      expect(newPlaylist.deltaUpdateFailed).to.equal(false);
      expect(newPlaylist.fragments.length).to.equal(merged.fragments.length);
      newPlaylist.fragments.forEach((frag, i) => {
        expect(
          frag,
          `Fragment sn: ${frag.sn} does not match expected:
actual: ${JSON.stringify(frag)}
expect: ${JSON.stringify(merged.fragments[i])}`,
        ).to.deep.equal(merged.fragments[i]);
      });
    });

    it('marks failed delta playlist updates', function () {
      const oldPlaylist = generatePlaylist([1, 2, 3, 4, 5, 6, 7, 8]);
      const newPlaylist = generatePlaylist([10, 11, 12]);
      newPlaylist.skippedSegments = 5;
      newPlaylist.startSN = 5;
      // @ts-ignore
      newPlaylist.fragments.unshift(null, null, null, null, null);
      // FIXME: An expected offset of 50 would be preferred, but there is nothing to sync playlist start with
      const merged = generatePlaylist([10, 11, 12], 0);
      mergeDetails(oldPlaylist, newPlaylist);
      expect(newPlaylist.deltaUpdateFailed).to.equal(true);
      expect(newPlaylist.fragments.length).to.equal(3);
      newPlaylist.fragments.forEach((frag, i) => {
        expect(
          frag,
          `Fragment sn: ${frag.sn} does not match expected:
actual: ${JSON.stringify(frag)}
expect: ${JSON.stringify(merged.fragments[i])}`,
        ).to.deep.equal(merged.fragments[i]);
      });
    });

    it('merges initSegments', function () {
      const oldPlaylist = generatePlaylist([1, 2, 3]);
      const oldInitSegment = new Fragment(PlaylistLevelType.MAIN, '');
      oldInitSegment.sn = 'initSegment';
      oldInitSegment.relurl = 'init.mp4';
      oldPlaylist.fragments.forEach((frag) => {
        frag.initSegment = oldInitSegment;
      });
      oldPlaylist.fragmentHint = new Fragment(PlaylistLevelType.MAIN, '');
      oldPlaylist.fragmentHint.sn = 4;
      oldPlaylist.fragmentHint.initSegment = oldInitSegment;

      const newPlaylist = generatePlaylist([2, 3, 4]);
      const newInitSegment = new Fragment(PlaylistLevelType.MAIN, '');
      newInitSegment.sn = 'initSegment';
      newInitSegment.relurl = 'init.mp4';
      newPlaylist.fragments.forEach((frag) => {
        frag.initSegment = newInitSegment;
      });
      newPlaylist.fragmentHint = new Fragment(PlaylistLevelType.MAIN, '');
      newPlaylist.fragmentHint.sn = 5;
      newPlaylist.fragmentHint.initSegment = newInitSegment;

      mergeDetails(oldPlaylist, newPlaylist);

      newPlaylist.fragments.forEach((frag, i) => {
        expect(
          frag.initSegment,
          `Fragment sn: ${frag.sn} does not have correct initSegment`,
        ).to.equal(oldInitSegment);
      });
      expect(
        newPlaylist.fragmentHint.initSegment,
        'fragmentHint does not have correct initSegment',
      ).to.equal(oldInitSegment);
    });

    it('handles delta Playlist updates with discontinuities', function () {
      const playlist = `#EXTM3U
#EXT-X-TARGETDURATION:6
#EXT-X-VERSION:9
#EXT-X-SERVER-CONTROL:CAN-SKIP-UNTIL=36
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-DISCONTINUITY-SEQUENCE:0
#EXTINF:6,
fileSequence0.ts
#EXTINF:6,
fileSequence1.ts
#EXT-X-DISCONTINUITY
#EXTINF:6,
fileSequence2.ts
#EXTINF:6,
fileSequence3.ts
#EXTINF:6,
fileSequence4.ts
#EXTINF:6,
fileSequence5.ts
#EXTINF:6,
fileSequence6.ts
#EXTINF:6,
fileSequence7.ts
#EXTINF:6,
fileSequence8.ts
#EXTINF:6,
fileSequence9.ts`;
      const deltaUpdate1 = `#EXTM3U
#EXT-X-TARGETDURATION:6
#EXT-X-VERSION:9
#EXT-X-SERVER-CONTROL:CAN-SKIP-UNTIL=36
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-DISCONTINUITY-SEQUENCE:0
#EXT-X-SKIP:SKIPPED-SEGMENTS=3
#EXTINF:6,
fileSequence3.ts
#EXTINF:6,
fileSequence4.ts
#EXTINF:6,
fileSequence5.ts
#EXTINF:6,
fileSequence6.ts
#EXTINF:6,
fileSequence7.ts
#EXTINF:6,
fileSequence8.ts
#EXTINF:6,
fileSequence9.ts`;
      const deltaUpdate2 = `#EXTM3U
#EXT-X-TARGETDURATION:6
#EXT-X-VERSION:9
#EXT-X-SERVER-CONTROL:CAN-SKIP-UNTIL=36
#EXT-X-MEDIA-SEQUENCE:1
#EXT-X-DISCONTINUITY-SEQUENCE:0
#EXT-X-SKIP:SKIPPED-SEGMENTS=3
#EXTINF:6,
fileSequence4.ts
#EXTINF:6,
fileSequence5.ts
#EXTINF:6,
fileSequence6.ts
#EXTINF:6,
fileSequence7.ts
#EXTINF:6,
fileSequence8.ts
#EXTINF:6,
fileSequence9.ts
#EXTINF:6,
fileSequence10.ts`;
      const deltaUpdate3 = `#EXTM3U
#EXT-X-TARGETDURATION:6
#EXT-X-VERSION:9
#EXT-X-SERVER-CONTROL:CAN-SKIP-UNTIL=36
#EXT-X-MEDIA-SEQUENCE:3
#EXT-X-DISCONTINUITY-SEQUENCE:1
#EXT-X-SKIP:SKIPPED-SEGMENTS=3
#EXTINF:6,
fileSequence6.ts
#EXTINF:6,
fileSequence7.ts
#EXTINF:6,
fileSequence8.ts
#EXTINF:6,
fileSequence9.ts
#EXTINF:6,
fileSequence10.ts
#EXTINF:6,
fileSequence11.ts
#EXT-X-DISCONTINUITY
#EXTINF:6,
fileSequence12.ts`;
      const details1 = M3U8Parser.parseLevelPlaylist(
        playlist,
        'http://dummy.url.com/playlist.m3u8',
        0,
        PlaylistLevelType.MAIN,
        0,
        null,
      );
      const details2 = M3U8Parser.parseLevelPlaylist(
        deltaUpdate1,
        'http://dummy.url.com/playlist.m3u8',
        0,
        PlaylistLevelType.MAIN,
        0,
        null,
      );
      const details3 = M3U8Parser.parseLevelPlaylist(
        deltaUpdate2,
        'http://dummy.url.com/playlist.m3u8',
        0,
        PlaylistLevelType.MAIN,
        0,
        null,
      );
      const details4 = M3U8Parser.parseLevelPlaylist(
        deltaUpdate3,
        'http://dummy.url.com/playlist.m3u8',
        0,
        PlaylistLevelType.MAIN,
        0,
        null,
      );

      expect(details1, 'details1').to.include({
        live: true,
        canSkipUntil: 36,
        totalduration: 60,
        startSN: 0,
        endSN: 9,
        lastPartSn: 9,
        lastPartIndex: -1,
        fragmentHint: undefined,
        startCC: 0,
        endCC: 1,
      });

      expect(details2, 'details2 before merging').to.include({
        live: true,
        skippedSegments: 3,
        canSkipUntil: 36,
        totalduration: 60,
        startSN: 0,
        endSN: 9,
        lastPartSn: 9,
        lastPartIndex: -1,
        fragmentHint: undefined,
        startCC: 0,
        endCC: 0, // end CC reflects delta details until merged with previous
      });
      expect(details2.fragments, 'details2 parsed fragments').to.have.lengthOf(
        10,
      );

      expect(details3, 'details3 before merging').to.include({
        live: true,
        skippedSegments: 3,
        canSkipUntil: 36,
        totalduration: 60,
        startSN: 1,
        endSN: 10,
        lastPartSn: 10,
        lastPartIndex: -1,
        fragmentHint: undefined,
        startCC: 0,
        endCC: 0, // end CC reflects delta details until merged with previous
      });
      expect(details3.fragments, 'details3 parsed fragments').to.have.lengthOf(
        10,
      );
      expect(details4, 'details4 before merging').to.include({
        live: true,
        skippedSegments: 3,
        totalduration: 60,
        startSN: 3,
        endSN: 12,
        lastPartSn: 12,
        lastPartIndex: -1,
        fragmentHint: undefined,
        startCC: 0, // start CC not set until merged
        endCC: 2,
      });
      expect(details4.fragments, 'details4 parsed fragments').to.have.lengthOf(
        10,
      );

      // This delta update had no changes from the last (same end SN)
      details2.reloaded(details1);
      expect(details2, 'details2 reloaded').to.include({
        misses: 1,
        advanced: false,
        updated: false,
      });
      // discontinuity sequence numbers (frag.cc) should be carried over
      mergeDetails(details1, details2);
      const mergedSequence1 = getFragmentSequenceNumbers(details2);
      expect(
        details2,
        `details2 merged with details1 (${mergedSequence1})`,
      ).to.include({
        skippedSegments: 3,
        deltaUpdateFailed: false,
        startSN: 0,
        endSN: 9,
        startCC: 0,
        endCC: 1,
      });
      expect(mergedSequence1).to.equal(
        '0-0,1-0,2-1,3-1,4-1,5-1,6-1,7-1,8-1,9-1',
      );

      // This delta update added and removed one segment
      details3.reloaded(details2);
      expect(details3, 'details3 reloaded').to.include({
        misses: 0,
        advanced: true,
        updated: true,
      });

      // discontinuity sequence numbers (frag.cc) should be carried over
      mergeDetails(details2, details3);
      const mergedSequence2 = getFragmentSequenceNumbers(details3);
      expect(
        details3,
        `details3 merged with details2 (${mergedSequence2})`,
      ).to.include({
        skippedSegments: 3,
        deltaUpdateFailed: false,
        startSN: 1,
        endSN: 10,
        startCC: 0,
        endCC: 1,
      });
      expect(mergedSequence2).to.equal(
        '1-0,2-1,3-1,4-1,5-1,6-1,7-1,8-1,9-1,10-1',
      );

      // This delta update added and removed two segments with a discontinuity at the last segment
      details4.reloaded(details3);
      expect(details4, 'details4 reloaded').to.include({
        misses: 0,
        advanced: true,
        updated: true,
      });

      // discontinuity sequence numbers (frag.cc) should be carried over
      mergeDetails(details3, details4);
      const mergedSequence3 = getFragmentSequenceNumbers(details4);
      expect(
        details4,
        `details4 merged with details3 (${mergedSequence3})`,
      ).to.include({
        skippedSegments: 3,
        deltaUpdateFailed: false,
        startSN: 3,
        endSN: 12,
        startCC: 1,
        endCC: 2,
      });
      expect(mergedSequence3).to.equal(
        '3-1,4-1,5-1,6-1,7-1,8-1,9-1,10-1,11-1,12-2',
      );
    });

    it('handles delta Playlist updates with discontinuities and parts', function () {
      const playlist = `#EXTM3U
#EXT-X-TARGETDURATION:6
#EXT-X-VERSION:9
#EXT-X-SERVER-CONTROL:CAN-BLOCK-RELOAD=YES,CAN-SKIP-UNTIL=24,PART-HOLD-BACK=3.0
#EXT-X-MEDIA-SEQUENCE:101
#EXT-X-DISCONTINUITY-SEQUENCE:10
#EXTINF:6,
fileSequence1.m4s
#EXT-X-DISCONTINUITY
#EXTINF:6,
fileSequence2.m4s
#EXTINF:6,
fileSequence3.m4s
#EXTINF:6,
fileSequence4.m4s
#EXTINF:6,
fileSequence5.m4s
#EXTINF:6,
fileSequence6.m4s
#EXT-X-PART:DURATION=2,URI="ll.m4s?segment=fileSequence7.1.m4s"
#EXT-X-PART:DURATION=2,URI="ll.m4s?segment=fileSequence7.2.m4s"
#EXT-X-PART:DURATION=2,URI="ll.m4s?segment=fileSequence7.3.m4s"
#EXTINF:6,
fileSequence7.m4s
#EXT-X-PART:DURATION=2,URI="ll.m4s?segment=fileSequence8.1.m4s"
#EXT-X-PART:DURATION=2,URI="ll.m4s?segment=fileSequence8.2.m4s"
#EXT-X-PART:DURATION=2,URI="ll.m4s?segment=fileSequence8.3.m4s"`;
      const deltaUpdate = `#EXTM3U
#EXT-X-TARGETDURATION:6
#EXT-X-VERSION:9
#EXT-X-SERVER-CONTROL:CAN-BLOCK-RELOAD=YES,CAN-SKIP-UNTIL=24,PART-HOLD-BACK=3.0
#EXT-X-MEDIA-SEQUENCE:102
#EXT-X-DISCONTINUITY-SEQUENCE:10
#EXT-X-SKIP:SKIPPED-SEGMENTS=4
#EXTINF:6,
fileSequence6.m4s
#EXT-X-PART:DURATION=2,URI="ll.m4s?segment=fileSequence7.1.m4s"
#EXT-X-PART:DURATION=2,URI="ll.m4s?segment=fileSequence7.2.m4s"
#EXT-X-PART:DURATION=2,URI="ll.m4s?segment=fileSequence7.3.m4s"
#EXTINF:6,
fileSequence7.m4s
#EXT-X-PART:DURATION=2,URI="ll.m4s?segment=fileSequence8.1.m4s"
#EXT-X-PART:DURATION=2,URI="ll.m4s?segment=fileSequence8.2.m4s"
#EXT-X-PART:DURATION=2,URI="ll.m4s?segment=fileSequence8.3.m4s"
#EXTINF:6,
fileSequence8.m4s
#EXT-X-DISCONTINUITY
#EXT-X-PART:DURATION=2,URI="ll.m4s?segment=fileSequence9.1.m4s"`;
      const deltaUpdateIncrementDisco = `#EXTM3U
#EXT-X-TARGETDURATION:6
#EXT-X-VERSION:9
#EXT-X-SERVER-CONTROL:CAN-BLOCK-RELOAD=YES,CAN-SKIP-UNTIL=24,PART-HOLD-BACK=3.0
#EXT-X-MEDIA-SEQUENCE:102
#EXT-X-DISCONTINUITY-SEQUENCE:11
#EXT-X-SKIP:SKIPPED-SEGMENTS=4
#EXTINF:6,
fileSequence6.m4s
#EXT-X-PART:DURATION=2,URI="ll.m4s?segment=fileSequence7.1.m4s"
#EXT-X-PART:DURATION=2,URI="ll.m4s?segment=fileSequence7.2.m4s"
#EXT-X-PART:DURATION=2,URI="ll.m4s?segment=fileSequence7.3.m4s"
#EXTINF:6,
fileSequence7.m4s
#EXT-X-PART:DURATION=2,URI="ll.m4s?segment=fileSequence8.1.m4s"
#EXT-X-PART:DURATION=2,URI="ll.m4s?segment=fileSequence8.2.m4s"
#EXT-X-PART:DURATION=2,URI="ll.m4s?segment=fileSequence8.3.m4s"
#EXTINF:6,
fileSequence8.m4s
#EXT-X-DISCONTINUITY
#EXT-X-PART:DURATION=2,URI="ll.m4s?segment=fileSequence9.1.m4s"`;
      const details1 = M3U8Parser.parseLevelPlaylist(
        playlist,
        'http://dummy.url.com/playlist.m3u8',
        0,
        PlaylistLevelType.MAIN,
        0,
        null,
      );
      const details2 = M3U8Parser.parseLevelPlaylist(
        deltaUpdate,
        'http://dummy.url.com/playlist.m3u8',
        0,
        PlaylistLevelType.MAIN,
        0,
        null,
      );
      const details3 = M3U8Parser.parseLevelPlaylist(
        deltaUpdateIncrementDisco,
        'http://dummy.url.com/playlist.m3u8',
        0,
        PlaylistLevelType.MAIN,
        0,
        null,
      );
      expect(details1, 'details1').to.include({
        live: true,
        canSkipUntil: 24,
        totalduration: 48,
        startSN: 101,
        endSN: 107,
        lastPartSn: 108,
        lastPartIndex: 2,
        startCC: 10,
        endCC: 11,
      });

      expect(
        details2,
        'delta w/o disco seq incremented before merging',
      ).to.include({
        live: true,
        skippedSegments: 4,
        canSkipUntil: 24,
        totalduration: 44,
        startSN: 102,
        endSN: 108,
        lastPartSn: 109,
        lastPartIndex: 0,
        startCC: 0, // w/o disco-sequence incremented (start CC not set until merged)
        endCC: 11, // end CC reflects delta details until merged with previous
      });
      expect(
        details2.fragments,
        'delta w/o disco seq incremented fragments',
      ).to.have.lengthOf(7);

      expect(
        details3,
        'delta w/ disco seq incremented before merging',
      ).to.include({
        live: true,
        skippedSegments: 4,
        canSkipUntil: 24,
        totalduration: 44,
        startSN: 102,
        endSN: 108,
        lastPartSn: 109,
        lastPartIndex: 0,
        startCC: 0, // w/ disco-sequence incremented (start CC not set until merged)
        endCC: 12, // end CC reflects delta details until merged with previous
      });
      expect(
        details3.fragments,
        'delta w/ disco seq incremented fragments',
      ).to.have.lengthOf(7);

      // This delta update does not increment discontinuity-sequence (discontinuity tag would appear before first segment)
      details2.reloaded(details1);
      expect(details2, 'delta w/o disco seq incremented reloaded').to.include({
        misses: 0,
        advanced: true,
        updated: true,
      });
      // discontinuity sequence numbers (frag.cc) should be carried over
      mergeDetails(details1, details2);
      const mergedSequence1 = getFragmentSequenceNumbers(details2);
      expect(
        details2,
        `delta w/o disco seq incremented merged (${mergedSequence1})`,
      ).to.include({
        skippedSegments: 4,
        deltaUpdateFailed: false,
        startSN: 102,
        endSN: 108,
        startCC: 11, // w/o disco-sequence incremented (matches first segment in v1.5)
        endCC: 11,
      });
      expect(details2.fragmentHint).to.include({ sn: 109, cc: 12 });
      expect(mergedSequence1).to.equal(
        '102-11,103-11,104-11,105-11,106-11,107-11,108-11',
      );

      // This delta update does not increment discontinuity-sequence (discontinuity tag would appear before first segment)
      details3.reloaded(details1);
      expect(details3, 'delta w/ disco seq incremented reloaded').to.include({
        misses: 0,
        advanced: true,
        updated: true,
      });
      // discontinuity sequence numbers (frag.cc) should be carried over
      mergeDetails(details1, details3);
      const mergedSequence2 = getFragmentSequenceNumbers(details3);
      expect(
        details3,
        `delta w/ disco seq incremented merged (${mergedSequence2})`,
      ).to.include({
        skippedSegments: 4,
        deltaUpdateFailed: false,
        startSN: 102,
        endSN: 108,
        startCC: 11, // w/ disco-sequence incremented
        endCC: 11,
      });
      expect(details2.fragmentHint).to.include({ sn: 109, cc: 12 });
      expect(mergedSequence2).to.equal(
        '102-11,103-11,104-11,105-11,106-11,107-11,108-11',
      );
    });
  });

  describe('computeReloadInterval', function () {
    let sandbox;
    beforeEach(function () {
      sandbox = sinon.createSandbox();
      sandbox.stub(performance, 'now').returns(0);
    });

    afterEach(function () {
      sandbox.restore();
    });

    it('returns the targetduration of the new level if available', function () {
      const newPlaylist = generatePlaylist([3, 4], 0, 6);
      newPlaylist.targetduration = 5;
      newPlaylist.updated = true;
      const actual = computeReloadInterval(newPlaylist);
      expect(actual).to.equal(5000);
    });

    it('halves the reload interval if the playlist contains the same segments', function () {
      const newPlaylist = generatePlaylist([1, 2]);
      newPlaylist.updated = false;
      newPlaylist.targetduration = 5;
      const actual = computeReloadInterval(newPlaylist);
      expect(actual).to.equal(2500);
    });

    it('rounds the reload interval', function () {
      const newPlaylist = generatePlaylist([3, 4], 0, 10);
      newPlaylist.targetduration = 5.9999;
      newPlaylist.updated = true;
      const actual = computeReloadInterval(newPlaylist);
      expect(actual).to.equal(6000);
    });

    it('returns a minimum of half the target duration', function () {
      const newPlaylist = generatePlaylist([3, 4]);
      newPlaylist.targetduration = 5;
      newPlaylist.updated = false;
      const actual = computeReloadInterval(newPlaylist);
      expect(actual).to.equal(2500);
    });

    it('returns the last fragment duration when distance to live edge is less than or equal to four target durations', function () {
      const newPlaylist = generatePlaylist([3, 4], 0, 2);
      newPlaylist.targetduration = 5;
      newPlaylist.updated = true;
      const actual = computeReloadInterval(newPlaylist, 20000);
      expect(actual).to.equal(5000);
      const actualLow = computeReloadInterval(newPlaylist, 14000);
      expect(actualLow).to.equal(2000);
    });
  });
});
