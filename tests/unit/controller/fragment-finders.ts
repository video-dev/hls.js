import { expect, use } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import {
  findFragmentByPDT,
  findFragmentByPTS,
  findNearestWithCC,
  fragmentWithinToleranceTest,
  pdtWithinToleranceTest,
} from '../../../src/controller/fragment-finders';
import { LevelDetails } from '../../../src/loader/level-details';
import BinarySearch from '../../../src/utils/binary-search';
import {
  fragment,
  mockFragments,
  mockFragmentsWithDiscos,
} from '../../mocks/data';
import type { MediaFragment } from '../../../src/loader/fragment';

use(sinonChai);

function makeMockFragment(options): MediaFragment {
  return fragment(Object.assign({ start: 0, sn: 0, cc: 0, level: 0 }, options));
}

describe('Fragment finders', function () {
  const sandbox = sinon.createSandbox();
  afterEach(function () {
    sandbox.restore();
  });

  const fragPrevious = makeMockFragment({
    programDateTime: 1505502671523,
    duration: 5.0,
    level: 1,
    start: 10.0,
    sn: 2, // Fragment with PDT 1505502671523 in level 1 does not have the same sn as in level 2 where cc is 1
    cc: 0,
  });
  const bufferEnd = fragPrevious.start + fragPrevious.duration;

  describe('findFragmentByPTS', function () {
    const tolerance = 0.25;
    let binarySearchSpy;
    beforeEach(function () {
      binarySearchSpy = sandbox.spy(BinarySearch, 'search');
    });

    it('finds a fragment with SN sequential to the previous fragment', function () {
      const fragPreviousSameLevel = makeMockFragment({
        ...fragPrevious,
        level: 2,
      });
      const actual = findFragmentByPTS(
        fragPreviousSameLevel,
        mockFragments,
        bufferEnd,
        tolerance,
      );
      const resultSN = actual ? actual.sn : -1;
      expect(actual).to.equal(
        mockFragments[3],
        'Expected sn 3, found sn segment ' + resultSN,
      );
      expect(binarySearchSpy).to.have.not.been.called;
    });

    it('chooses the fragment with the next SN if its contiguous with the end of the buffer', function () {
      const actual = findFragmentByPTS(
        mockFragments[0],
        mockFragments,
        mockFragments[0].duration,
        tolerance,
      );
      expect(actual).to.equal(
        mockFragments[1],
        `expected sn ${mockFragments[1].sn}, but got sn ${
          actual ? actual.sn : null
        }`,
      );
      expect(binarySearchSpy).to.have.not.been.called;
    });

    it('chooses the fragment with the next SN if its contiguous with the end of previous fragment', function () {
      // See https://github.com/video-dev/hls.js/issues/2776
      const bufferEnd = 60.139636;
      const fragments = [
        makeMockFragment({
          deltaPTS: 0.012346258503441732,
          cc: 2,
          duration: 5.017346258503444,
          start: 55.21705215419478,
          sn: 11,
          level: 0,
        }),
        makeMockFragment({
          deltaPTS: 0,
          cc: 2,
          duration: 0.033,
          start: 60.234398412698226,
          sn: 12,
          level: 0,
        }),
      ];
      const fragPrevious = fragments[0];
      const actual = findFragmentByPTS(
        fragPrevious,
        fragments,
        bufferEnd,
        tolerance,
      );
      expect(actual).to.equal(
        fragments[1],
        `expected sn ${fragments[1].sn}, but got sn ${
          actual ? actual.sn : null
        }`,
      );
    });

    it('uses BinarySearch to find a fragment if the subsequent one is not within tolerance', function () {
      const fragments = [
        mockFragments[0],
        mockFragments[mockFragments.length - 1],
      ];
      findFragmentByPTS(fragments[0], fragments, bufferEnd, tolerance);
      expect(binarySearchSpy).to.have.been.calledOnce;
    });

    it('returns null when there is a gap in sn and start-end time', function () {
      const bufferEnd = 49;
      const fragments = [
        makeMockFragment({
          deltaPTS: 0,
          cc: 0,
          duration: 5,
          start: 54,
          sn: 5,
          level: 0,
        }),
        makeMockFragment({
          deltaPTS: 0,
          cc: 0,
          duration: 5,
          start: 59,
          sn: 5,
          level: 0,
        }),
        makeMockFragment({
          deltaPTS: 0,
          cc: 0,
          duration: 5,
          start: 64,
          sn: 5,
          level: 0,
        }),
      ];
      // sn is not contiguous, and there is a gap between start and end
      const fragPrevious = makeMockFragment({
        deltaPTS: 0,
        cc: 0,
        duration: 5,
        start: 44,
        sn: 1,
        level: 0,
      });
      const actual = findFragmentByPTS(
        fragPrevious,
        fragments,
        bufferEnd,
        tolerance,
      );
      expect(actual).to.equal(null);
    });
  });

  describe('fragmentWithinToleranceTest', function () {
    const tolerance = 0.25;
    it('returns 0 if the fragment range is equal to the end of the buffer', function () {
      const frag = makeMockFragment({
        start: 5,
        duration: 5 - tolerance,
      });
      const actual = fragmentWithinToleranceTest(5, tolerance, frag);
      expect(actual).to.equal(0);
    });

    it('returns 0 if the fragment range is greater than end of the buffer', function () {
      const frag = makeMockFragment({
        start: 5,
        duration: 5,
      });
      const actual = fragmentWithinToleranceTest(5, tolerance, frag);
      expect(actual).to.equal(0);
    });

    it('returns 1 if the fragment range is less than the end of the buffer', function () {
      const frag = makeMockFragment({
        start: 0,
        duration: 5,
      });
      const actual = fragmentWithinToleranceTest(5, tolerance, frag);
      expect(actual).to.equal(1);
    });

    it('returns -1 if the fragment range is greater than the end of the buffer', function () {
      const frag = makeMockFragment({
        start: 6,
        duration: 5,
      });
      const actual = fragmentWithinToleranceTest(5, tolerance, frag);
      expect(actual).to.equal(-1);
    });

    it('does not skip very small fragments at the start', function () {
      const frag = makeMockFragment({
        start: 0.2,
        duration: 0.1,
        deltaPTS: 0.1,
      });
      const actual = fragmentWithinToleranceTest(0, tolerance, frag);
      expect(actual).to.equal(0);
    });
    it('does not skip very small fragments', function () {
      const frag = makeMockFragment({
        start: 5,
        duration: 0.1,
        deltaPTS: 0.1,
      });
      const actual = fragmentWithinToleranceTest(5, tolerance, frag);
      expect(actual).to.equal(0);
    });
    it('does not skip very small fragments without deltaPTS', function () {
      const frag = makeMockFragment({
        start: 5,
        duration: 0.1,
      });
      const actual = fragmentWithinToleranceTest(5, tolerance, frag);
      expect(actual).to.equal(0);
    });
    it('does not skip fragments when searching near boundaries', function () {
      const frag = makeMockFragment({
        start: 19.96916,
        duration: 9.98458,
      });
      const actual = fragmentWithinToleranceTest(29, 0.25, frag);
      expect(actual).to.equal(0);
    });
  });

  describe('findFragmentByPDT', function () {
    it('finds a fragment with endProgramDateTime greater than the reference PDT', function () {
      const foundFragment = findFragmentByPDT(
        mockFragments,
        (fragPrevious.endProgramDateTime as number) + 1,
        0,
      );
      expect(foundFragment).to.equal(mockFragments[2]);
    });

    it('returns null when the reference pdt is outside of the pdt range of the fragment array', function () {
      let foundFragment = findFragmentByPDT(
        mockFragments,
        (mockFragments[0].programDateTime as number) - 1,
        0,
      );
      expect(foundFragment).to.not.exist;

      foundFragment = findFragmentByPDT(
        mockFragments,
        (mockFragments[mockFragments.length - 1].endProgramDateTime as number) +
          1,
        0,
      );
      expect(foundFragment).to.not.exist;
    });

    it('is able to find the first fragment', function () {
      const foundFragment = findFragmentByPDT(
        mockFragments,
        mockFragments[0].programDateTime,
        0,
      );
      const resultSN = foundFragment ? foundFragment.sn : -1;
      expect(foundFragment).to.equal(
        mockFragments[0],
        'Expected sn 0, found sn segment ' + resultSN,
      );
    });

    it('is able to find the last fragment', function () {
      const foundFragment = findFragmentByPDT(
        mockFragments,
        mockFragments[mockFragments.length - 1].programDateTime,
        0,
      );
      const resultSN = foundFragment ? foundFragment.sn : -1;
      expect(foundFragment).to.equal(
        mockFragments[4],
        'Expected sn 4, found sn segment ' + resultSN,
      );
    });

    it('is able to find a fragment if the PDT value is 0', function () {
      const fragments = [
        makeMockFragment({
          programDateTime: 0,
          duration: 0.001,
        }),
        makeMockFragment({
          programDateTime: 1,
          duration: 0.001,
        }),
      ];
      const actual = findFragmentByPDT(fragments, 0, 0);
      expect(actual).to.equal(fragments[0]);
    });

    it('returns null when passed undefined arguments', function () {
      expect(findFragmentByPDT(mockFragments, 0, 0)).to.not.exist;
      expect(findFragmentByPDT(undefined as any, 9001, 0)).to.not.exist;
      expect(
        findFragmentByPDT(undefined as any, undefined as any, undefined as any),
      ).to.not.exist;
    });

    it('returns null when passed an empty frag array', function () {
      expect(findFragmentByPDT([], 9001, 0)).to.not.exist;
    });
  });

  describe('pdtWithinToleranceTest', function () {
    const tolerance = 0.25;
    const pdtBufferEnd = 1505502678523; // Fri Sep 15 2017 15:11:18 GMT-0400 (Eastern Daylight Time)
    it('returns true if the fragment range is equal to the end of the buffer', function () {
      const frag = makeMockFragment({
        programDateTime: pdtBufferEnd,
        duration: 5 - tolerance,
      });
      const actual = pdtWithinToleranceTest(pdtBufferEnd, tolerance, frag);
      expect(actual).to.be.true;
    });

    it('returns false if the fragment range is less than the end of the buffer', function () {
      const frag = makeMockFragment({
        programDateTime: pdtBufferEnd - 10000,
        duration: 5,
      });
      const actual = pdtWithinToleranceTest(pdtBufferEnd, tolerance, frag);
      expect(actual).to.be.false;
    });

    it('does not skip very small fragments', function () {
      const frag = makeMockFragment({
        programDateTime: pdtBufferEnd + 200,
        duration: 0.1,
        deltaPTS: 0.1,
      });
      const actual = pdtWithinToleranceTest(pdtBufferEnd, tolerance, frag);
      expect(actual).to.be.true;
    });

    it('accounts for tolerance when checking the endProgramDateTime of the fragment', function () {
      const frag = makeMockFragment({
        programDateTime: pdtBufferEnd,
        duration: tolerance,
      });
      const actual = pdtWithinToleranceTest(pdtBufferEnd, tolerance, frag);
      expect(actual).to.be.false;
    });
  });

  describe('findNearestWithCC', function () {
    const levelDetails = new LevelDetails('');
    levelDetails.startCC = mockFragmentsWithDiscos[0].cc;
    levelDetails.endCC =
      mockFragmentsWithDiscos[mockFragmentsWithDiscos.length - 1].cc;
    levelDetails.fragments = mockFragmentsWithDiscos;

    const detailsToDomains = (levelDetails: LevelDetails) =>
      levelDetails.fragments.reduce((a, f) => {
        a[f.cc] ||= [f.start, f.end];
        a[f.cc][1] = f.end;
        return a;
      }, {});
    const expectToFindFragment = (
      levelDetails: LevelDetails,
      cc: number,
      pos: number,
      props: Partial<MediaFragment>,
    ) => {
      const frag = findNearestWithCC(levelDetails, cc, pos);
      expect(frag).to.be.an('object');
      Object.entries(props).forEach(([prop, val]) => {
        expect(
          frag,
          `findNearestWithCC(${JSON.stringify(detailsToDomains(levelDetails))}, cc: ${cc}, pos: ${pos}) => frag.${prop}`,
        )
          .to.have.property(prop)
          .which.equals(val);
      });
    };

    it('returns a fragment with discontinuity sequence (cc) that starts at the given position', function () {
      expectToFindFragment(levelDetails, 1, 10, {
        start: 10,
        sn: 2,
        cc: 1,
      });
    });

    it('returns a fragment with discontinuity sequence (cc) whose range intersects with the given position', function () {
      expectToFindFragment(levelDetails, 0, 1, {
        start: 0,
        sn: 0,
        cc: 0,
      });
      expectToFindFragment(levelDetails, 1, 17, {
        start: 15,
        sn: 3,
        cc: 1,
      });
      expectToFindFragment(levelDetails, 2, 36, {
        start: 35,
        sn: 7,
        cc: 2,
      });
    });

    it('returns first fragment with discontinuity sequence (cc) when given a position before the domain', function () {
      expectToFindFragment(levelDetails, 1, 0, {
        start: 5,
        sn: 1,
        cc: 1,
      });
      expectToFindFragment(levelDetails, 2, 0, {
        start: 25,
        sn: 5,
        cc: 2,
      });
      expectToFindFragment(levelDetails, 2, 19, {
        start: 25,
        sn: 5,
        cc: 2,
      });
      expectToFindFragment(levelDetails, 2, 24, {
        start: 25,
        sn: 5,
        cc: 2,
      });
    });

    it('returns last fragment with discontinuity sequence (cc) when given a position past the domain', function () {
      expectToFindFragment(levelDetails, 1, 25, {
        start: 20,
        sn: 4,
        cc: 1,
      });
      expectToFindFragment(levelDetails, 1, 30, {
        start: 20,
        sn: 4,
        cc: 1,
      });
      expectToFindFragment(levelDetails, 1, 33, {
        start: 20,
        sn: 4,
        cc: 1,
      });
      expectToFindFragment(levelDetails, 2, 50, {
        start: 35,
        sn: 7,
        cc: 2,
      });
    });

    it('returns a fragment with discontinuity sequence (cc) at the end of the playlist', function () {
      const lastFragment =
        levelDetails.fragments[levelDetails.fragments.length - 1];
      const { start, sn, cc } = lastFragment;
      expectToFindFragment(levelDetails, cc, lastFragment.end, {
        start,
        sn,
        cc,
      });
    });

    it('returns null when LevelDetails does not include discontinuity sequence (cc)', function () {
      const result1 = findNearestWithCC(levelDetails, 5, 0);
      expect(result1).to.be.null;
      const result2 = findNearestWithCC(levelDetails, -1, 0);
      expect(result2).to.be.null;
    });

    it('returns null when LevelDetails is undefined', function () {
      const result = findNearestWithCC(undefined, 0, 0);
      expect(result).to.be.null;
    });
  });
});
