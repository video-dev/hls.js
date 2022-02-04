import {
  findFragmentByPDT,
  findFragmentByPTS,
  fragmentWithinToleranceTest,
  pdtWithinToleranceTest,
} from '../../../src/controller/fragment-finders';
import { mockFragments } from '../../mocks/data';
import BinarySearch from '../../../src/utils/binary-search';

describe('Fragment finders', function () {
  const sandbox = sinon.createSandbox();
  afterEach(function () {
    sandbox.restore();
  });

  const fragPrevious = {
    programDateTime: 1505502671523,
    endProgramDateTime: 1505502676523,
    duration: 5.0,
    level: 1,
    start: 10.0,
    sn: 2, // Fragment with PDT 1505502671523 in level 1 does not have the same sn as in level 2 where cc is 1
    cc: 0,
  };
  const bufferEnd = fragPrevious.start + fragPrevious.duration;

  describe('findFragmentByPTS', function () {
    const tolerance = 0.25;
    let binarySearchSpy;
    beforeEach(function () {
      binarySearchSpy = sandbox.spy(BinarySearch, 'search');
    });

    it('finds a fragment with SN sequential to the previous fragment', function () {
      const actual = findFragmentByPTS(
        fragPrevious,
        mockFragments,
        bufferEnd,
        tolerance
      );
      const resultSN = actual ? actual.sn : -1;
      expect(actual).to.equal(
        mockFragments[3],
        'Expected sn 3, found sn segment ' + resultSN
      );
      expect(binarySearchSpy).to.have.not.been.called;
    });

    it('chooses the fragment with the next SN if its contiguous with the end of the buffer', function () {
      const actual = findFragmentByPTS(
        mockFragments[0],
        mockFragments,
        mockFragments[0].duration,
        tolerance
      );
      expect(actual).to.equal(
        mockFragments[1],
        `expected sn ${mockFragments[1].sn}, but got sn ${
          actual ? actual.sn : null
        }`
      );
      expect(binarySearchSpy).to.have.not.been.called;
    });

    it('chooses the fragment with the next SN if its contiguous with the end of previous fragment', function () {
      // See https://github.com/video-dev/hls.js/issues/2776
      const bufferEnd = 60.139636;
      const fragments = [
        {
          deltaPTS: 0.012346258503441732,
          cc: 2,
          duration: 5.017346258503444,
          start: 55.21705215419478,
          sn: 11,
          level: 0,
        },
        {
          deltaPTS: 0,
          cc: 2,
          duration: 0.033,
          start: 60.234398412698226,
          sn: 12,
          level: 0,
        },
      ];
      const fragPrevious = fragments[0];
      const actual = findFragmentByPTS(
        fragPrevious,
        fragments,
        bufferEnd,
        tolerance
      );
      expect(actual).to.equal(
        fragments[1],
        `expected sn ${fragments[1].sn}, but got sn ${
          actual ? actual.sn : null
        }`
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
        {
          deltaPTS: 0,
          cc: 0,
          duration: 5,
          start: 54,
          sn: 5,
          level: 0,
        },
        {
          deltaPTS: 0,
          cc: 0,
          duration: 5,
          start: 59,
          sn: 5,
          level: 0,
        },
        {
          deltaPTS: 0,
          cc: 0,
          duration: 5,
          start: 64,
          sn: 5,
          level: 0,
        },
      ];
      // sn is not contiguous, and there is a gap between start and end
      const fragPrevious = {
        deltaPTS: 0,
        cc: 0,
        duration: 5,
        start: 44,
        sn: 1,
        level: 0,
      };
      const actual = findFragmentByPTS(
        fragPrevious,
        fragments,
        bufferEnd,
        tolerance
      );
      expect(actual).to.equal(null);
    });
  });

  describe('fragmentWithinToleranceTest', function () {
    const tolerance = 0.25;
    it('returns 0 if the fragment range is equal to the end of the buffer', function () {
      const frag = {
        start: 5,
        duration: 5 - tolerance,
      };
      const actual = fragmentWithinToleranceTest(5, tolerance, frag);
      expect(actual).to.equal(0);
    });

    it('returns 0 if the fragment range is greater than end of the buffer', function () {
      const frag = {
        start: 5,
        duration: 5,
      };
      const actual = fragmentWithinToleranceTest(5, tolerance, frag);
      expect(actual).to.equal(0);
    });

    it('returns 1 if the fragment range is less than the end of the buffer', function () {
      const frag = {
        start: 0,
        duration: 5,
      };
      const actual = fragmentWithinToleranceTest(5, tolerance, frag);
      expect(actual).to.equal(1);
    });

    it('returns -1 if the fragment range is greater than the end of the buffer', function () {
      const frag = {
        start: 6,
        duration: 5,
      };
      const actual = fragmentWithinToleranceTest(5, tolerance, frag);
      expect(actual).to.equal(-1);
    });

    it('does not skip very small fragments', function () {
      const frag = {
        start: 0.2,
        duration: 0.1,
        deltaPTS: 0.1,
      };
      const actual = fragmentWithinToleranceTest(0, tolerance, frag);
      expect(actual).to.equal(0);
    });
  });

  describe('findFragmentByPDT', function () {
    it('finds a fragment with endProgramDateTime greater than the reference PDT', function () {
      const foundFragment = findFragmentByPDT(
        mockFragments,
        fragPrevious.endProgramDateTime + 1
      );
      expect(foundFragment).to.equal(mockFragments[2]);
    });

    it('returns null when the reference pdt is outside of the pdt range of the fragment array', function () {
      let foundFragment = findFragmentByPDT(
        mockFragments,
        mockFragments[0].programDateTime - 1
      );
      expect(foundFragment).to.not.exist;

      foundFragment = findFragmentByPDT(
        mockFragments,
        mockFragments[mockFragments.length - 1].endProgramDateTime + 1
      );
      expect(foundFragment).to.not.exist;
    });

    it('is able to find the first fragment', function () {
      const foundFragment = findFragmentByPDT(
        mockFragments,
        mockFragments[0].programDateTime
      );
      const resultSN = foundFragment ? foundFragment.sn : -1;
      expect(foundFragment).to.equal(
        mockFragments[0],
        'Expected sn 0, found sn segment ' + resultSN
      );
    });

    it('is able to find the last fragment', function () {
      const foundFragment = findFragmentByPDT(
        mockFragments,
        mockFragments[mockFragments.length - 1].programDateTime
      );
      const resultSN = foundFragment ? foundFragment.sn : -1;
      expect(foundFragment).to.equal(
        mockFragments[4],
        'Expected sn 4, found sn segment ' + resultSN
      );
    });

    it('is able to find a fragment if the PDT value is 0', function () {
      const fragments = [
        {
          programDateTime: 0,
          endProgramDateTime: 1,
          duration: 0.001,
        },
        {
          programDateTime: 1,
          endProgramDateTime: 2,
          duration: 0.001,
        },
      ];
      const actual = findFragmentByPDT(fragments, 0);
      expect(actual).to.equal(fragments[0]);
    });

    it('returns null when passed undefined arguments', function () {
      expect(findFragmentByPDT(mockFragments)).to.not.exist;
      expect(findFragmentByPDT(undefined, 9001)).to.not.exist;
      expect(findFragmentByPDT()).to.not.exist;
    });

    it('returns null when passed an empty frag array', function () {
      expect(findFragmentByPDT([], 9001)).to.not.exist;
    });
  });

  describe('pdtWithinToleranceTest', function () {
    const tolerance = 0.25;
    const pdtBufferEnd = 1505502678523; // Fri Sep 15 2017 15:11:18 GMT-0400 (Eastern Daylight Time)
    it('returns true if the fragment range is equal to the end of the buffer', function () {
      const frag = {
        programDateTime: pdtBufferEnd,
        endProgramDateTime: pdtBufferEnd + 5000 - tolerance * 1000,
        duration: 5,
      };
      const actual = pdtWithinToleranceTest(pdtBufferEnd, tolerance, frag);
      expect(actual).to.be.true;
    });

    it('returns false if the fragment range is less than the end of the buffer', function () {
      const frag = {
        programDateTime: pdtBufferEnd - 10000,
        endProgramDateTime: pdtBufferEnd - 5000,
        duration: 5,
      };
      const actual = pdtWithinToleranceTest(pdtBufferEnd, tolerance, frag);
      expect(actual).to.be.false;
    });

    it('does not skip very small fragments', function () {
      const frag = {
        programDateTime: pdtBufferEnd + 200,
        endProgramDateTime: pdtBufferEnd + 300,
        duration: 0.1,
        deltaPTS: 0.1,
      };
      const actual = pdtWithinToleranceTest(pdtBufferEnd, tolerance, frag);
      expect(actual).to.be.true;
    });

    it('accounts for tolerance when checking the endProgramDateTime of the fragment', function () {
      const frag = {
        programDateTime: pdtBufferEnd,
        endProgramDateTime: pdtBufferEnd + tolerance * 1000,
        duration: 5,
      };
      const actual = pdtWithinToleranceTest(pdtBufferEnd, tolerance, frag);
      expect(actual).to.be.false;
    });
  });
});
