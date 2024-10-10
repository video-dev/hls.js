import chai from 'chai';
import sinonChai from 'sinon-chai';
import { Fragment } from '../../../src/loader/fragment';
import { LevelDetails } from '../../../src/loader/level-details';
import { Level } from '../../../src/types/level';
import { PlaylistLevelType } from '../../../src/types/loader';
import { AttrList } from '../../../src/utils/attr-list';
import {
  adjustSlidingStart,
  alignDiscontinuities,
  alignMediaPlaylistByPDT,
  shouldAlignOnDiscontinuities,
} from '../../../src/utils/discontinuities';
import type { MediaFragment } from '../../../src/loader/fragment';

chai.use(sinonChai);
const expect = chai.expect;

const mockReferenceFrag = objToFragment({
  start: 20,
  startPTS: 20,
  endPTS: 24,
  duration: 4,
  cc: 0,
});

const mockFrags = [
  {
    start: 0,
    startPTS: 0,
    endPTS: 4,
    duration: 4,
    cc: 0,
  },
  {
    start: 4,
    startPTS: 4,
    endPTS: 8,
    duration: 4,
    cc: 1,
  },
  {
    start: 8,
    startPTS: 8,
    endPTS: 16,
    duration: 8,
    cc: 1,
  },
];

describe('discontinuities', function () {
  it('adjusts level fragments with overlapping CC range using a reference fragment', function () {
    const details = objToLevelDetails({
      fragments: mockFrags.map(objToFragment),
      PTSKnown: false,
      alignedSliding: false,
    });
    const expected = [
      {
        start: 20,
        startPTS: 20,
        endPTS: 24,
        duration: 4,
        cc: 0,
      },
      {
        start: 24,
        startPTS: 24,
        endPTS: 28,
        duration: 4,
        cc: 1,
      },
      {
        start: 28,
        startPTS: 28,
        endPTS: 36,
        duration: 8,
        cc: 1,
      },
    ].map(objToFragment);

    adjustSlidingStart(mockReferenceFrag.start, details);
    expect(expected).to.deep.equal(details.fragments);
    expect(details.alignedSliding).to.be.true;
  });

  it('aligns level fragments times based on PDT and start time of reference level details', function () {
    const lastLevel = {
      details: objToLevelDetails({
        PTSKnown: false,
        alignedSliding: false,
        startCC: 0,
        endCC: 0,
        fragments: [
          {
            start: 18,
            startPTS: undefined,
            endPTS: undefined,
            duration: 2,
            programDateTime: 1629821766107,
          },
          {
            start: 20,
            startPTS: undefined,
            endPTS: 22,
            duration: 2,
            programDateTime: 1629821768107,
          },
          {
            start: 22,
            startPTS: 22,
            endPTS: 30,
            duration: 8,
            programDateTime: 1629821770107,
          },
        ].map(objToFragment),
        fragmentHint: objToFragment({
          start: 30,
          startPTS: 30,
          endPTS: 32,
          duration: 2,
          programDateTime: 1629821778107,
        }),
      }),
    };

    const refDetails = objToLevelDetails({
      fragments: [
        {
          start: 18,
          startPTS: undefined,
          endPTS: undefined,
          duration: 2,
          programDateTime: 1629821768107,
        },
      ].map(objToFragment),
      PTSKnown: false,
      alignedSliding: false,
      startCC: 0,
      endCC: 0,
    });

    const detailsExpected = objToLevelDetails({
      fragments: [
        {
          start: 16,
          startPTS: 16,
          endPTS: 18,
          duration: 2,
          programDateTime: 1629821766107,
        },
        {
          start: 18,
          startPTS: 18,
          endPTS: 20,
          duration: 2,
          programDateTime: 1629821768107,
        },
        {
          start: 20,
          startPTS: 20,
          endPTS: 28,
          duration: 8,
          programDateTime: 1629821770107,
        },
      ].map(objToFragment),
      fragmentHint: objToFragment({
        start: 28,
        startPTS: 28,
        endPTS: 30,
        duration: 2,
        programDateTime: 1629821778107,
      }),
      PTSKnown: false,
      alignedSliding: true,
      startCC: 0,
      endCC: 0,
    });
    alignMediaPlaylistByPDT(lastLevel.details, refDetails);
    expect(
      lastLevel.details,
      `actual:\n\n${JSON.stringify(
        lastLevel.details,
        null,
        2,
      )}\n\nexpected\n\n${JSON.stringify(detailsExpected, null, 2)}`,
    ).to.deep.equal(detailsExpected);
  });

  it('aligns level fragments with overlapping CC bounds and discontiguous programDateTime info', function () {
    const lastLevel = objToLevel({
      details: objToLevelDetails({
        PTSKnown: true,
        alignedSliding: false,
        startCC: 1,
        endCC: 3,
        fragments: [
          {
            start: 20,
            startPTS: 20,
            endPTS: 24,
            duration: 4,
            cc: 1,
            programDateTime: 1503892800000,
          },
          {
            start: 24,
            startPTS: 24,
            endPTS: 28,
            duration: 4,
            cc: 2,
            programDateTime: 1503892850000,
          },
          {
            start: 28,
            startPTS: 28,
            endPTS: 36,
            duration: 8,
            cc: 3,
            programDateTime: 1501111110000,
          },
          {
            start: 28,
            startPTS: 28,
            endPTS: 36,
            duration: 8,
            cc: 3,
            programDateTime: 1501111118000,
          },
        ].map(objToFragment),
      }),
    });

    const details = objToLevelDetails({
      fragments: [
        {
          start: 0,
          startPTS: 0,
          endPTS: 4,
          duration: 4,
          cc: 2,
          programDateTime: 1503892850000,
        },
        {
          start: 4,
          startPTS: 4,
          endPTS: 8,
          duration: 4,
          cc: 3,
          programDateTime: 1501111110000,
        },
        {
          start: 8,
          startPTS: 8,
          endPTS: 12,
          duration: 4,
          cc: 3,
          programDateTime: 1501111114000,
        },
        {
          start: 12,
          startPTS: 12,
          endPTS: 16,
          duration: 4,
          cc: 4,
          programDateTime: 1503892854000,
        },
      ].map(objToFragment),
      PTSKnown: false,
      alignedSliding: false,
      startCC: 2,
      endCC: 4,
    });

    const detailsExpected = objToLevelDetails({
      fragments: [
        {
          start: 24,
          startPTS: 24,
          endPTS: 28,
          duration: 4,
          cc: 2,
          programDateTime: 1503892850000,
        },
        {
          start: 28,
          startPTS: 28,
          endPTS: 32,
          duration: 4,
          cc: 3,
          programDateTime: 1501111110000,
        },
        {
          start: 32,
          startPTS: 32,
          endPTS: 36,
          duration: 4,
          cc: 3,
          programDateTime: 1501111114000,
        },
        {
          start: 36,
          startPTS: 36,
          endPTS: 40,
          duration: 4,
          cc: 4,
          programDateTime: 1503892854000,
        },
      ].map(objToFragment),
      PTSKnown: false,
      alignedSliding: true,
      startCC: 2,
      endCC: 4,
    });
    alignMediaPlaylistByPDT(details, lastLevel.details as LevelDetails);
    expect(details).to.deep.equal(detailsExpected);
  });

  it('adjusts level fragments without overlapping CC range but with programDateTime info', function () {
    const lastLevel = {
      details: objToLevelDetails({
        PTSKnown: true,
        alignedSliding: false,
        startCC: 0,
        endCC: 1,
        fragments: [
          {
            start: 20,
            startPTS: 20,
            endPTS: 24,
            duration: 4,
            cc: 0,
            programDateTime: 1503892800000,
          },
          {
            start: 24,
            startPTS: 24,
            endPTS: 28,
            duration: 4,
            cc: 1,
            programDateTime: 1503892804000,
          },
          {
            start: 28,
            startPTS: 28,
            endPTS: 36,
            duration: 8,
            cc: 1,
            programDateTime: 1503892808000,
          },
        ].map(objToFragment),
      }),
    };

    const details = objToLevelDetails({
      fragments: [
        {
          start: 0,
          startPTS: 0,
          endPTS: 4,
          duration: 4,
          cc: 2,
          programDateTime: 1503892850000,
        },
        {
          start: 4,
          startPTS: 4,
          endPTS: 8,
          duration: 4,
          cc: 2,
          programDateTime: 1503892854000,
        },
        {
          start: 8,
          startPTS: 8,
          endPTS: 16,
          duration: 8,
          cc: 3,
          programDateTime: 1503892858000,
        },
      ].map(objToFragment),
      PTSKnown: false,
      alignedSliding: false,
      startCC: 2,
      endCC: 3,
    });

    const detailsExpected = objToLevelDetails({
      fragments: [
        {
          start: 70,
          startPTS: 70,
          endPTS: 74,
          duration: 4,
          cc: 2,
          programDateTime: 1503892850000,
        },
        {
          start: 74,
          startPTS: 74,
          endPTS: 78,
          duration: 4,
          cc: 2,
          programDateTime: 1503892854000,
        },
        {
          start: 78,
          startPTS: 78,
          endPTS: 86,
          duration: 8,
          cc: 3,
          programDateTime: 1503892858000,
        },
      ].map(objToFragment),
      PTSKnown: false,
      alignedSliding: true,
      startCC: 2,
      endCC: 3,
    });
    alignMediaPlaylistByPDT(details, lastLevel.details);
    expect(detailsExpected).to.deep.equal(details, JSON.stringify(details));
  });

  describe('alignDiscontinuities', function () {
    it('aligns playlists (LevelDetails fragments starts) based on overlapping discontinuity sequence change', function () {
      const prevDetails = objToLevelDetails({
        fragments: [
          mockReferenceFrag,
          { start: 24, startPTS: 24, endPTS: 28, duration: 4, cc: 1 },
        ].map(objToFragment),
      });
      const curDetails = objToLevelDetails({
        fragments: mockFrags.map(objToFragment),
      });
      alignDiscontinuities(curDetails, prevDetails);
      expect(curDetails).to.have.property('alignedSliding').which.is.true;
      expect(curDetails.fragments[0].start).to.equal(20);
    });

    it('aligns playlists (LevelDetails fragments starts) based on overlapping discontinuity sequence change even when older playlist is newer', function () {
      const prevDetails = objToLevelDetails({
        fragments: [
          mockReferenceFrag,
          { start: 24, startPTS: 24, endPTS: 28, duration: 4, cc: 1 },
          { start: 28, startPTS: 28, endPTS: 32, duration: 4, cc: 2 },
        ].map(objToFragment),
      });
      const curDetails = objToLevelDetails({
        fragments: mockFrags.map(objToFragment),
      });
      alignDiscontinuities(curDetails, prevDetails);
      expect(curDetails).to.have.property('alignedSliding').which.is.true;
      expect(curDetails.fragments[0].start).to.equal(20);
    });

    it('aligns playlists (LevelDetails fragments starts) based on overlapping discontinuity sequence change using latest disco', function () {
      const prevDetails = objToLevelDetails({
        fragments: [
          mockReferenceFrag,
          { start: 24, startPTS: 24, endPTS: 28, duration: 4.5, cc: 1 },
          { start: 28.5, startPTS: 28, endPTS: 32, duration: 4, cc: 2 },
        ].map(objToFragment),
      });
      const curDetails = objToLevelDetails({
        fragments: [
          { start: 0, startPTS: 0, endPTS: 4, duration: 4.5, cc: 1 },
          { start: 4.5, startPTS: 4.5, endPTS: 8.5, duration: 4, cc: 2 },
          { start: 8.5, startPTS: 4.5, endPTS: 12.5, duration: 4, cc: 3 },
        ].map(objToFragment),
      });
      alignDiscontinuities(curDetails, prevDetails);
      expect(curDetails).to.have.property('alignedSliding').which.is.true;
      expect(curDetails.fragments[0].start).to.equal(24);
    });

    it('does not aligns playlists if there are no frags in the previous level', function () {
      const curDetails = objToLevelDetails({
        fragments: mockFrags.map(objToFragment),
      });
      alignDiscontinuities(curDetails, objToLevelDetails({ fragments: [] }));
      expect(curDetails).to.have.property('alignedSliding').which.is.false;
      expect(curDetails.fragments[0].start).to.equal(0);
    });

    it('does not aligns playlists if there is no matching discontinuity sequence change', function () {
      const curDetails = objToLevelDetails({
        fragments: mockFrags.map(objToFragment),
      });
      alignDiscontinuities(
        curDetails,
        objToLevelDetails({ fragments: [{ cc: 10 }].map(objToFragment) }),
      );
      expect(curDetails).to.have.property('alignedSliding').which.is.false;
      expect(curDetails.fragments[0].start).to.equal(0);
    });

    it('does not aligns playlists if there are no frags in the current level', function () {
      const curDetails = objToLevelDetails({
        fragments: [],
      });
      alignDiscontinuities(
        curDetails,
        objToLevelDetails({ fragments: [{ cc: 0 }].map(objToFragment) }),
      );
      expect(curDetails).to.have.property('alignedSliding').which.is.false;
    });
  });

  it('should align current level when there is overlap in discontinuity sequence change', function () {
    const lastLevelDetails = objToLevelDetails({
      startCC: 0,
      endCC: 1,
    });
    const curDetails = objToLevelDetails({
      startCC: 0,
      endCC: 1,
    });

    const actual = shouldAlignOnDiscontinuities(lastLevelDetails, curDetails);
    expect(actual).to.be.true;
  });

  it('should align current level when there is any overlap in discontinuity sequence change', function () {
    const lastLevelDetails = objToLevelDetails({
      startCC: 0,
      endCC: 2,
    });
    const curDetails = objToLevelDetails({
      startCC: 1,
      endCC: 3,
    });

    const actual = shouldAlignOnDiscontinuities(lastLevelDetails, curDetails);
    expect(actual).to.be.true;
  });

  it('should not align current level there is no overlap in discontinuity sequence change', function () {
    const lastLevelDetails = objToLevelDetails({
      startCC: 0,
      endCC: 1,
    });
    const curDetails = objToLevelDetails({
      startCC: 1,
      endCC: 2,
    });

    const actual = shouldAlignOnDiscontinuities(lastLevelDetails, curDetails);
    expect(actual).to.be.false;
  });

  it('should not align when there is no CC increase', function () {
    const lastLevelDetails = objToLevelDetails({
      startCC: 1,
      endCC: 1,
    });
    const curDetails = objToLevelDetails({
      startCC: 1,
      endCC: 1,
    });
    const actual = shouldAlignOnDiscontinuities(lastLevelDetails, curDetails);
    expect(actual).to.be.false;
  });

  it('should not align when there are no previous level details', function () {
    const curDetails = objToLevelDetails({
      startCC: 1,
      endCC: 1,
    });
    const actual = shouldAlignOnDiscontinuities(undefined, curDetails);
    expect(actual).to.be.false;
  });
});

function objToFragment(
  object: Partial<Fragment>,
  i: number = 0,
): MediaFragment {
  const fragment = new Fragment(PlaylistLevelType.MAIN, '') as MediaFragment;
  fragment.sn = i;
  for (const prop in object) {
    fragment[prop] = object[prop];
  }
  return fragment;
}

function objToLevelDetails(object: Partial<LevelDetails>): LevelDetails {
  const details = new LevelDetails('');
  for (const prop in object) {
    details[prop] = object[prop];
  }
  const fragCount = details.fragments.length;
  if (fragCount) {
    details.startCC = details.fragments[0].cc;
    details.endCC = details.fragments[fragCount - 1].cc;
  }
  return details;
}

function objToLevel(object: Partial<Level>): Level {
  const level = new Level({
    name: '',
    url: '',
    attrs: new AttrList({}),
    bitrate: 500000,
  });
  for (const prop in object) {
    level[prop] = object[prop];
  }
  return level;
}
