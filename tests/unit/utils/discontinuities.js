import {
  shouldAlignOnDiscontinuities,
  findDiscontinuousReferenceFrag,
  adjustSlidingStart,
  alignPDT,
} from '../../../src/utils/discontinuities';

const mockReferenceFrag = {
  start: 20,
  startPTS: 20,
  endPTS: 24,
  duration: 4,
  cc: 0,
};

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

describe('level-helper', function () {
  it('adjusts level fragments with overlapping CC range using a reference fragment', function () {
    const details = {
      fragments: mockFrags.slice(0),
      PTSKnown: false,
      alignedSliding: false,
    };
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
    ];

    adjustSlidingStart(mockReferenceFrag.start, details);
    expect(expected).to.deep.equal(details.fragments);
    expect(details.alignedSliding).to.be.true;
  });

  it('adjusts level fragments without overlapping CC range but with programDateTime info', function () {
    const lastLevel = {
      details: {
        PTSKnown: true,
        alignedSliding: false,
        hasProgramDateTime: true,
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
          },
          {
            start: 28,
            startPTS: 28,
            endPTS: 36,
            duration: 8,
            cc: 1,
          },
        ],
      },
    };

    const details = {
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
        },
        {
          start: 8,
          startPTS: 8,
          endPTS: 16,
          duration: 8,
          cc: 3,
        },
      ],
      PTSKnown: false,
      alignedSliding: false,
      startCC: 2,
      endCC: 3,
      hasProgramDateTime: true,
    };

    const detailsExpected = {
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
        },
        {
          start: 78,
          startPTS: 78,
          endPTS: 86,
          duration: 8,
          cc: 3,
        },
      ],
      PTSKnown: false,
      alignedSliding: true,
      startCC: 2,
      endCC: 3,
      hasProgramDateTime: true,
    };
    alignPDT(details, lastLevel.details);
    expect(detailsExpected).to.deep.equal(details);
  });

  it('finds the first fragment in an array which matches the CC of the first fragment in another array', function () {
    const prevDetails = {
      fragments: [mockReferenceFrag, { cc: 1 }],
    };
    const curDetails = {
      fragments: mockFrags,
    };
    const expected = mockReferenceFrag;
    const actual = findDiscontinuousReferenceFrag(prevDetails, curDetails);
    expect(actual).to.equal(expected);
  });

  it('returns undefined if there are no frags in the previous level', function () {
    const expected = undefined;
    const actual = findDiscontinuousReferenceFrag(
      { fragments: [] },
      { fragments: mockFrags }
    );
    expect(actual).to.equal(expected);
  });

  it('returns undefined if there are no matching frags in the previous level', function () {
    const expected = undefined;
    const actual = findDiscontinuousReferenceFrag(
      { fragments: [{ cc: 10 }] },
      { fragments: mockFrags }
    );
    expect(actual).to.equal(expected);
  });

  it('returns undefined if there are no frags in the current level', function () {
    const expected = undefined;
    const actual = findDiscontinuousReferenceFrag(
      { fragments: [{ cc: 0 }] },
      { fragments: [] }
    );
    expect(actual).to.equal(expected);
  });

  it('should align current level when CC increases within the level', function () {
    const lastLevel = {
      details: {},
    };
    const curDetails = {
      startCC: 0,
      endCC: 1,
    };

    const actual = shouldAlignOnDiscontinuities(null, lastLevel, curDetails);
    expect(actual).to.be.true;
  });

  it('should align current level when CC increases from last frag to current level', function () {
    const lastLevel = {
      details: {},
    };
    const lastFrag = {
      cc: 0,
    };
    const curDetails = {
      startCC: 1,
      endCC: 1,
    };

    const actual = shouldAlignOnDiscontinuities(
      lastFrag,
      lastLevel,
      curDetails
    );
    expect(actual).to.be.true;
  });

  it('should not align when there is no CC increase', function () {
    const lastLevel = {
      details: {},
    };
    const curDetails = {
      startCC: 1,
      endCC: 1,
    };
    const lastFrag = {
      cc: 1,
    };

    const actual = shouldAlignOnDiscontinuities(
      lastFrag,
      lastLevel,
      curDetails
    );
    expect(actual).to.be.false;
  });

  it('should not align when there are no previous level details', function () {
    const lastLevel = {};
    const curDetails = {
      startCC: 1,
      endCC: 1,
    };
    const lastFrag = {
      cc: 1,
    };

    const actual = shouldAlignOnDiscontinuities(
      lastFrag,
      lastLevel,
      curDetails
    );
    expect(actual).to.be.false;
  });
});
