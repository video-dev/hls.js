import assert from 'assert';
import sinon from 'sinon';
import { findFragmentByPDT, findFragmentByPTS, fragmentWithinToleranceTest, pdtWithinToleranceTest } from '../../../src/controller/fragment-finders';
import { mockFragments } from '../../mocks/data';
import BinarySearch from '../../../src/utils/binary-search';

describe('Fragment finders', function () {
  const sandbox = sinon.sandbox.create();
  afterEach(function () {
    sandbox.restore();
  });

  let fragPrevious = {
    programDateTime: 1505502671523,
    endProgramDateTime: 1505502676523,
    duration: 5.000,
    level: 1,
    start: 10.000,
    sn: 2, // Fragment with PDT 1505502671523 in level 1 does not have the same sn as in level 2 where cc is 1
    cc: 0
  };
  const bufferEnd = fragPrevious.start + fragPrevious.duration;

  describe('findFragmentByPTS', function () {
    let tolerance = 0.25;
    let binarySearchSpy;
    beforeEach(function () {
      binarySearchSpy = sandbox.spy(BinarySearch, 'search');
    });

    it('finds a fragment with SN sequential to the previous fragment', function () {
      const foundFragment = findFragmentByPTS(fragPrevious, mockFragments, bufferEnd, tolerance);
      const resultSN = foundFragment ? foundFragment.sn : -1;
      assert.equal(foundFragment, mockFragments[3], 'Expected sn 3, found sn segment ' + resultSN);
      assert(binarySearchSpy.notCalled);
    });

    it('chooses the fragment with the next SN if its contiguous with the end of the buffer', function () {
      const actual = findFragmentByPTS(mockFragments[0], mockFragments, mockFragments[0].duration, tolerance);
      assert.strictEqual(mockFragments[1], actual, `expected sn ${mockFragments[1].sn}, but got sn ${actual ? actual.sn : null}`);
      assert(binarySearchSpy.notCalled);
    });

    it('uses BinarySearch to find a fragment if the subsequent one is not within tolerance', function () {
      const fragments = [mockFragments[0], mockFragments[(mockFragments.length - 1)]];
      findFragmentByPTS(fragments[0], fragments, bufferEnd, tolerance);
      assert(binarySearchSpy.calledOnce);
    });
  });

  describe('fragmentWithinToleranceTest', function () {
    let tolerance = 0.25;
    it('returns 0 if the fragment range is equal to the end of the buffer', function () {
      const frag = {
        start: 5,
        duration: 5 - tolerance
      };
      const actual = fragmentWithinToleranceTest(5, tolerance, frag);
      assert.strictEqual(0, actual);
    });

    it('returns 0 if the fragment range is greater than end of the buffer', function () {
      const frag = {
        start: 5,
        duration: 5
      };
      const actual = fragmentWithinToleranceTest(5, tolerance, frag);
      assert.strictEqual(0, actual);
    });

    it('returns 1 if the fragment range is less than the end of the buffer', function () {
      const frag = {
        start: 0,
        duration: 5
      };
      const actual = fragmentWithinToleranceTest(5, tolerance, frag);
      assert.strictEqual(1, actual);
    });

    it('returns -1 if the fragment range is greater than the end of the buffer', function () {
      const frag = {
        start: 6,
        duration: 5
      };
      const actual = fragmentWithinToleranceTest(5, tolerance, frag);
      assert.strictEqual(-1, actual);
    });

    it('does not skip very small fragments', function () {
      const frag = {
        start: 0.2,
        duration: 0.1,
        deltaPTS: 0.1
      };
      const actual = fragmentWithinToleranceTest(0, tolerance, frag);
      assert.strictEqual(0, actual);
    });
  });

  describe('findFragmentByPDT', function () {
    it('finds a fragment with endProgramDateTime greater than the reference PDT', function () {
      const foundFragment = findFragmentByPDT(mockFragments, fragPrevious.endProgramDateTime + 1);
      const resultSN = foundFragment ? foundFragment.sn : -1;
      assert.strictEqual(foundFragment, mockFragments[2], 'Expected sn 2, found sn segment ' + resultSN);
    });

    it('returns null when the reference pdt is outside of the pdt range of the fragment array', function () {
      let foundFragment = findFragmentByPDT(mockFragments, mockFragments[0].programDateTime - 1);
      let resultSN = foundFragment ? foundFragment.sn : -1;
      assert.strictEqual(foundFragment, null, 'Expected sn -1, found sn segment ' + resultSN);

      foundFragment = findFragmentByPDT(mockFragments, mockFragments[mockFragments.length - 1].endProgramDateTime + 1);
      resultSN = foundFragment ? foundFragment.sn : -1;
      assert.strictEqual(foundFragment, null, 'Expected sn -1, found sn segment ' + resultSN);
    });

    it('is able to find the first fragment', function () {
      const foundFragment = findFragmentByPDT(mockFragments, mockFragments[0].programDateTime);
      const resultSN = foundFragment ? foundFragment.sn : -1;
      assert.strictEqual(foundFragment, mockFragments[0], 'Expected sn 0, found sn segment ' + resultSN);
    });

    it('is able to find the last fragment', function () {
      const foundFragment = findFragmentByPDT(mockFragments, mockFragments[mockFragments.length - 1].programDateTime);
      const resultSN = foundFragment ? foundFragment.sn : -1;
      assert.strictEqual(foundFragment, mockFragments[4], 'Expected sn 4, found sn segment ' + resultSN);
    });

    it('is able to find a fragment if the PDT value is 0', function () {
      const fragments = [
        {
          programDateTime: 0,
          endProgramDateTime: 1,
          duration: 0.001
        },
        {
          programDateTime: 1,
          endProgramDateTime: 2,
          duration: 0.001
        }
      ];
      const actual = findFragmentByPDT(fragments, 0);
      assert.strictEqual(fragments[0], actual);
    });

    it('returns null when passed undefined arguments', function () {
      assert.strictEqual(findFragmentByPDT(mockFragments), null);
      assert.strictEqual(findFragmentByPDT(undefined, 9001), null);
      assert.strictEqual(findFragmentByPDT(), null);
    });

    it('returns null when passed an empty frag array', function () {
      assert.strictEqual(findFragmentByPDT([], 9001), null);
    });
  });

  describe('pdtWithinToleranceTest', function () {
    let tolerance = 0.25;
    let pdtBufferEnd = 1505502678523; // Fri Sep 15 2017 15:11:18 GMT-0400 (Eastern Daylight Time)
    it('returns true if the fragment range is equal to the end of the buffer', function () {
      const frag = {
        programDateTime: pdtBufferEnd,
        endProgramDateTime: pdtBufferEnd + 5000 - (tolerance * 1000),
        duration: 5
      };
      const actual = pdtWithinToleranceTest(pdtBufferEnd, tolerance, frag);
      assert.strictEqual(true, actual);
    });

    it('returns false if the fragment range is less than the end of the buffer', function () {
      const frag = {
        programDateTime: pdtBufferEnd - 10000,
        endProgramDateTime: pdtBufferEnd - 5000,
        duration: 5
      };
      const actual = pdtWithinToleranceTest(pdtBufferEnd, tolerance, frag);
      assert.strictEqual(false, actual);
    });

    it('does not skip very small fragments', function () {
      const frag = {
        programDateTime: pdtBufferEnd + 200,
        endProgramDateTime: pdtBufferEnd + 300,
        duration: 0.1,
        deltaPTS: 0.1
      };
      const actual = pdtWithinToleranceTest(pdtBufferEnd, tolerance, frag);
      assert.strictEqual(true, actual);
    });

    it('accounts for tolerance when checking the endProgramDateTime of the fragment', function () {
      const frag = {
        programDateTime: pdtBufferEnd,
        endProgramDateTime: pdtBufferEnd + (tolerance * 1000),
        duration: 5
      };
      const actual = pdtWithinToleranceTest(pdtBufferEnd, tolerance, frag);
      assert.strictEqual(false, actual);
    });
  });
});
