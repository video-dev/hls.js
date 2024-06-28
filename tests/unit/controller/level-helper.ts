import {
  adjustSliding,
  computeReloadInterval,
  mapFragmentIntersection,
  mapPartIntersection,
  mergeDetails,
} from '../../../src/utils/level-helper';
import { LevelDetails } from '../../../src/loader/level-details';
import { Fragment, MediaFragment, Part } from '../../../src/loader/fragment';
import M3U8Parser from '../../../src/loader/m3u8-parser';
import { PlaylistLevelType } from '../../../src/types/loader';
import { AttrList } from '../../../src/utils/attr-list';
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
      oldPlaylist.fragmentHint = new Fragment(
        PlaylistLevelType.MAIN,
        '',
      ) as MediaFragment;
      oldPlaylist.fragmentHint.sn = 4;
      oldPlaylist.fragmentHint.initSegment = oldInitSegment;

      const newPlaylist = generatePlaylist([2, 3, 4]);
      const newInitSegment = new Fragment(PlaylistLevelType.MAIN, '');
      newInitSegment.sn = 'initSegment';
      newInitSegment.relurl = 'init.mp4';
      newPlaylist.fragments.forEach((frag) => {
        frag.initSegment = newInitSegment;
      });
      newPlaylist.fragmentHint = new Fragment(
        PlaylistLevelType.MAIN,
        '',
      ) as MediaFragment;
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

    it('handles delta Playlist updates with merged program date time and skipped date ranges', function () {
      const playlist = `#EXTM3U
#EXT-X-TARGETDURATION:6
#EXT-X-VERSION:9
#EXT-X-MEDIA-SEQUENCE:3
#EXT-X-SERVER-CONTROL:CAN-SKIP-UNTIL=36.0,CAN-SKIP-DATERANGES=YES,CAN-BLOCK-RELOAD=YES,HOLDBACK=18,PART-HOLDBACK=3
#EXTINF:6,
fileSequence3.ts
#EXT-X-DATERANGE:ID="one",START-DATE="2024-02-29T12:00:04.000Z"
#EXT-X-MAP:URI="map.ts\
#EXT-X-KEY:METHOD=SAMPLE-AES,URI="key.bin"
#EXT-X-PROGRAM-DATE-TIME:2024-02-29T12:00:06.000Z
#EXTINF:6,
fileSequence4.ts
#EXT-X-BITRATE:2000
#EXT-X-DISCONTINUITY
#EXT-X-PROGRAM-DATE-TIME:2024-02-29T12:01:00.000Z
#EXTINF:6,
fileSequence5.ts
#EXT-X-DATERANGE:ID="two",START-DATE="2024-02-29T12:00:10.000Z"
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
#EXT-X-DATERANGE:ID="three",START-DATE="2024-02-29T12:01:04.000Z"`;
      const playlistUpdate = `#EXTM3U
#EXT-X-TARGETDURATION:6
#EXT-X-VERSION:9
#EXT-X-MEDIA-SEQUENCE:4
#EXT-X-SERVER-CONTROL:CAN-SKIP-UNTIL=36.0,CAN-SKIP-DATERANGES=YES,CAN-BLOCK-RELOAD=YES,HOLDBACK=18,PART-HOLDBACK=3
#EXT-X-SKIP:SKIPPED-SEGMENTS=3
#EXTINF:6,
fileSequence7.ts
#EXTINF:6,
fileSequence8.ts
#EXTINF:6,
fileSequence9.ts
#EXTINF:6,
fileSequence10.ts
#EXT-X-DATERANGE:ID="three",START-DATE="2024-02-29T12:01:04.000Z"
#EXTINF:6,
fileSequence11.ts
#EXT-X-DATERANGE:ID="four",START-DATE="2024-02-29T12:02:04.000Z"`;
      const details = M3U8Parser.parseLevelPlaylist(
        playlist,
        'http://dummy.url.com/playlist.m3u8',
        0,
        PlaylistLevelType.MAIN,
        0,
        null,
      );
      const detailsUpdated = M3U8Parser.parseLevelPlaylist(
        playlistUpdate,
        'http://dummy.url.com/playlist.m3u8',
        0,
        PlaylistLevelType.MAIN,
        0,
        null,
      );
      mergeDetails(details, detailsUpdated);
      expect(details.hasProgramDateTime, 'details.hasProgramDateTime').to.be
        .true;
      expect(details.dateRanges, 'one')
        .to.have.property('one')
        .which.has.property('tagAnchor')
        .which.equals(details.fragments[1])
        .which.has.property('sn')
        .which.equals(4);
      expect(details.dateRanges, 'two')
        .to.have.property('two')
        .which.has.property('tagAnchor')
        .which.equals(details.fragments[1])
        .which.has.property('sn')
        .which.equals(4);
      expect(details.dateRanges, 'three')
        .to.have.property('three')
        .which.has.property('tagAnchor')
        .which.equals(details.fragments[2])
        .which.has.property('sn')
        .which.equals(5);
      expect(details.dateRanges.one.startTime).to.equal(4);
      expect(details.dateRanges.two.startTime).to.equal(10);
      expect(details.dateRanges.three.startTime).to.equal(16);
      expect(details.dateRanges.one.tagOrder, 'one.tagOrder').to.equal(0);
      expect(details.dateRanges.two.tagOrder, 'two.tagOrder').to.equal(1);
      expect(details.dateRanges.three.tagOrder, 'three.tagOrder').to.equal(2);
      expect(
        detailsUpdated.hasProgramDateTime,
        'detailsUpdated.hasProgramDateTime',
      ).to.be.true;
      expect(detailsUpdated.dateRanges, 'one updated')
        .to.have.property('one')
        .which.has.property('tagAnchor')
        .which.equals(detailsUpdated.fragments[0])
        .which.has.property('sn')
        .which.equals(4);
      expect(detailsUpdated.dateRanges, 'two updated')
        .to.have.property('two')
        .which.has.property('tagAnchor')
        .which.equals(detailsUpdated.fragments[0])
        .which.has.property('sn')
        .which.equals(4);
      expect(detailsUpdated.dateRanges, 'three updated')
        .to.have.property('three')
        .which.has.property('tagAnchor')
        .which.equals(detailsUpdated.fragments[1])
        .which.has.property('sn')
        .which.equals(5);
      expect(detailsUpdated.dateRanges, 'four')
        .to.have.property('four')
        .which.has.property('tagAnchor')
        .which.has.property('sn')
        .which.equals(5);
      expect(detailsUpdated.dateRanges.one.startTime).to.equal(4);
      expect(detailsUpdated.dateRanges.two.startTime).to.equal(10);
      expect(detailsUpdated.dateRanges.three.startTime).to.equal(16);
      expect(detailsUpdated.dateRanges.four.startTime).to.equal(76);
      expect(
        detailsUpdated.dateRanges.one.tagOrder,
        'one.tagOrder updated',
      ).to.equal(0);
      expect(
        detailsUpdated.dateRanges.two.tagOrder,
        'two.tagOrder updated',
      ).to.equal(1);
      expect(
        detailsUpdated.dateRanges.three.tagOrder,
        'three.tagOrder updated',
      ).to.equal(2);
      expect(detailsUpdated.dateRanges.four.tagOrder, 'four.tagOrder').to.equal(
        3,
      );
    });

    it('handles delta Playlist updates with multiple skip tags and removed date ranges', function () {
      const playlist = `#EXTM3U
#EXT-X-TARGETDURATION:6
#EXT-X-VERSION:10
#EXT-X-MEDIA-SEQUENCE:3
#EXT-X-SERVER-CONTROL:CAN-SKIP-UNTIL=36.0,CAN-SKIP-DATERANGES=YES,CAN-BLOCK-RELOAD=YES,HOLDBACK=18,PART-HOLDBACK=3
#EXT-X-PROGRAM-DATE-TIME:2019-04-29T19:52:19.060Z
#EXT-X-DATERANGE:ID="d0",START-DATE="2019-04-29T19:52:20.000Z",DURATION=0
#EXT-X-DATERANGE:ID="d1",START-DATE="2019-04-29T19:52:21.000Z",DURATION=1
#EXT-X-DATERANGE:ID="d2",START-DATE="2019-04-29T19:52:22.000Z",DURATION=2
#EXT-X-DATERANGE:ID="d3",START-DATE="2019-04-29T19:52:23.000Z",DURATION=3
#EXT-X-DATERANGE:ID="d4",START-DATE="2019-04-29T19:52:24.000Z",DURATION=4
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
fileSequence9.ts
#EXTINF:6,
fileSequence10.ts
#EXTINF:6,
fileSequence11.ts
#EXTINF:6,
fileSequence12.ts
#EXTINF:6,
fileSequence13.ts
#EXTINF:6,
fileSequence14.ts
#EXTINF:6,
fileSequence15.ts
#EXTINF:6,
fileSequence16.ts
#EXTINF:6,
fileSequence17.ts`;
      const playlistUpdate = `#EXTM3U
#EXT-X-TARGETDURATION:6
#EXT-X-VERSION:10
#EXT-X-MEDIA-SEQUENCE:3
#EXT-X-SERVER-CONTROL:CAN-SKIP-UNTIL=36.0,CAN-SKIP-DATERANGES=YES,CAN-BLOCK-RELOAD=YES,HOLDBACK=18,PART-HOLDBACK=3
#EXT-X-DATERANGE:ID="d3",START-DATE="2019-04-29T19:52:23.000Z",DURATION=3
#EXT-X-DATERANGE:ID="d5",START-DATE="2019-04-29T19:52:25.000Z",DURATION=5
#EXT-X-DATERANGE:ID="d6",START-DATE="2019-04-29T19:52:26.000Z",DURATION=6
#EXT-X-SKIP:SKIPPED-SEGMENTS=2,RECENTLY-REMOVED-DATERANGES="d1	d4"
#EXTINF:6,
fileSequence5.ts
#EXTINF:6,
fileSequence6.ts
#EXT-X-SKIP:SKIPPED-SEGMENTS=2,RECENTLY-REMOVED-DATERANGES="d0"
#EXTINF:6,
fileSequence9.ts
#EXTINF:6,
fileSequence10.ts
#EXTINF:6,
fileSequence11.ts
#EXTINF:6,
fileSequence12.ts
#EXTINF:6,
fileSequence13.ts
#EXTINF:6,
fileSequence14.ts
#EXTINF:6,
fileSequence15.ts
#EXTINF:6,
fileSequence16.ts
#EXTINF:6,
fileSequence17.ts
#EXTINF:6,
fileSequence18.ts`;
      const details = M3U8Parser.parseLevelPlaylist(
        playlist,
        'http://dummy.url.com/playlist.m3u8',
        0,
        PlaylistLevelType.MAIN,
        0,
        null,
      );
      const detailsUpdated = M3U8Parser.parseLevelPlaylist(
        playlistUpdate,
        'http://dummy.url.com/playlist.m3u8',
        0,
        PlaylistLevelType.MAIN,
        0,
        null,
      );
      mergeDetails(details, detailsUpdated);
      expect(details.hasProgramDateTime, 'details.hasProgramDateTime').to.be
        .true;
      expect(
        Object.keys(details.dateRanges),
        'first playlist daterange ids',
      ).to.have.deep.equal(['d0', 'd1', 'd2', 'd3', 'd4']);
      expect(details.dateRanges.d2.startTime).to.equal(2.94);
      expect(details.dateRanges.d3.startTime).to.equal(3.94);
      expect(
        detailsUpdated.hasProgramDateTime,
        'detailsUpdated.hasProgramDateTime',
      ).to.be.true;
      expect(
        detailsUpdated.recentlyRemovedDateranges,
        'removed daterange ids',
      ).to.deep.equal(['d1', 'd4', 'd0']);
      expect(
        Object.keys(detailsUpdated.dateRanges),
        'delta playlist merged daterange ids',
      ).to.have.deep.equal(['d2', 'd3', 'd5', 'd6']);
      expect(detailsUpdated.dateRanges, 'd2 updated')
        .to.have.property('d2')
        .which.has.property('tagAnchor')
        .which.equals(detailsUpdated.fragments[0])
        .which.has.property('sn')
        .which.equals(3);
      expect(detailsUpdated.dateRanges.d2.startTime).to.equal(2.94);
      expect(detailsUpdated.dateRanges.d3.startTime).to.equal(3.94);
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
