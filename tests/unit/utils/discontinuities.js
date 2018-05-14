const assert = require('assert');

import { shouldAlignOnDiscontinuities, findDiscontinuousReferenceFrag, adjustPts, alignDiscontinuities } from '../../../src/utils/discontinuities';

const mockReferenceFrag = {
  start: 20,
  startPTS: 20,
  endPTS: 24,
  duration: 4,
  cc: 0
};

const mockFrags = [
  {
    start: 0,
    startPTS: 0,
    endPTS: 4,
    duration: 4,
    cc: 0
  },
  {
    start: 4,
    startPTS: 4,
    endPTS: 8,
    duration: 4,
    cc: 1
  },
  {
    start: 8,
    startPTS: 8,
    endPTS: 16,
    duration: 8,
    cc: 1
  }
];

describe('level-helper', function () {
  it('adjusts level fragments with overlapping CC range using a reference fragment', function () {
    const details = {
      fragments: mockFrags.slice(0),
      PTSKnown: false
    };
    const expected = [
      {
        start: 20,
        startPTS: 20,
        endPTS: 24,
        duration: 4,
        cc: 0
      },
      {
        start: 24,
        startPTS: 24,
        endPTS: 28,
        duration: 4,
        cc: 1
      },
      {
        start: 28,
        startPTS: 28,
        endPTS: 36,
        duration: 8,
        cc: 1
      }
    ];

    adjustPts(mockReferenceFrag.start, details);
    assert.deepEqual(expected, details.fragments);
    assert.equal(true, details.PTSKnown);
  });

  it('adjusts level fragments without overlapping CC range but with programDateTime info', function () {
    const lastFrag = { cc: 0 };
    const lastLevel = {
      details: {
        PTSKnown: true,
        programDateTime: new Date('2017-08-28 00:00:00'),
        fragments: [
          {
            start: 20,
            startPTS: 20,
            endPTS: 24,
            duration: 4,
            cc: 0
          },
          {
            start: 24,
            startPTS: 24,
            endPTS: 28,
            duration: 4,
            cc: 1
          },
          {
            start: 28,
            startPTS: 28,
            endPTS: 36,
            duration: 8,
            cc: 1
          }
        ]
      }
    };

    let details = {
      fragments: [
        {
          start: 0,
          startPTS: 0,
          endPTS: 4,
          duration: 4,
          cc: 2
        },
        {
          start: 4,
          startPTS: 4,
          endPTS: 8,
          duration: 4,
          cc: 2
        },
        {
          start: 8,
          startPTS: 8,
          endPTS: 16,
          duration: 8,
          cc: 3
        }
      ],
      PTSKnown: false,
      programDateTime: new Date('2017-08-28 00:00:50'),
      startCC: 2,
      endCC: 3
    };

    let detailsExpected = {
      fragments: [
        {
          start: 70,
          startPTS: 70,
          endPTS: 74,
          duration: 4,
          cc: 2
        },
        {
          start: 74,
          startPTS: 74,
          endPTS: 78,
          duration: 4,
          cc: 2
        },
        {
          start: 78,
          startPTS: 78,
          endPTS: 86,
          duration: 8,
          cc: 3
        }
      ],
      PTSKnown: true,
      programDateTime: new Date('2017-08-28 00:00:50'),
      startCC: 2,
      endCC: 3
    };
    alignDiscontinuities(lastFrag, lastLevel, details);
    assert.deepEqual(detailsExpected, details);
  });

  it('finds the first fragment in an array which matches the CC of the first fragment in another array', function () {
    const prevDetails = {
      fragments: [mockReferenceFrag, { cc: 1 }]
    };
    const curDetails = {
      fragments: mockFrags
    };
    const expected = mockReferenceFrag;
    const actual = findDiscontinuousReferenceFrag(prevDetails, curDetails);
    assert.equal(expected, actual);
  });

  it('returns undefined if there are no frags in the previous level', function () {
    const expected = undefined;
    const actual = findDiscontinuousReferenceFrag({ fragments: [] }, { fragments: mockFrags });
    assert.equal(expected, actual);
  });

  it('returns undefined if there are no matching frags in the previous level', function () {
    const expected = undefined;
    const actual = findDiscontinuousReferenceFrag({ fragments: [{ cc: 10 }] }, { fragments: mockFrags });
    assert.equal(expected, actual);
  });

  it('returns undefined if there are no frags in the current level', function () {
    const expected = undefined;
    const actual = findDiscontinuousReferenceFrag({ fragments: [{ cc: 0 }] }, { fragments: [] });
    assert.equal(expected, actual);
  });

  it('should align current level when CC increases within the level', function () {
    const lastLevel = {
      details: {}
    };
    const curDetails = {
      startCC: 0,
      endCC: 1
    };

    const actual = shouldAlignOnDiscontinuities(null, lastLevel, curDetails);
    assert.equal(true, actual);
  });

  it('should align current level when CC increases from last frag to current level', function () {
    const lastLevel = {
      details: {}
    };
    const lastFrag = {
      cc: 0
    };
    const curDetails = {
      startCC: 1,
      endCC: 1
    };

    const actual = shouldAlignOnDiscontinuities(lastFrag, lastLevel, curDetails);
    assert.equal(true, actual);
  });

  it('should not align when there is no CC increase', function () {
    const lastLevel = {
      details: {}
    };
    const curDetails = {
      startCC: 1,
      endCC: 1
    };
    const lastFrag = {
      cc: 1
    };

    const actual = shouldAlignOnDiscontinuities(lastFrag, lastLevel, curDetails);
    assert.equal(false, actual);
  });

  it('should not align when there is no previous level', function () {
    const curDetails = {
      startCC: 1,
      endCC: 1
    };
    const lastFrag = {
      cc: 1
    };

    const actual = shouldAlignOnDiscontinuities(lastFrag, null, curDetails);
    assert.equal(false, actual);
  });

  it('should not align when there are no previous level details', function () {
    const lastLevel = {
    };
    const curDetails = {
      startCC: 1,
      endCC: 1
    };
    const lastFrag = {
      cc: 1
    };

    const actual = shouldAlignOnDiscontinuities(lastFrag, lastLevel, curDetails);
    assert.equal(false, actual);
  });

  it('should not align when there are no current level details', function () {
    const lastLevel = {
      details: {}
    };
    const lastFrag = {
      cc: 1
    };

    const actual = shouldAlignOnDiscontinuities(lastFrag, lastLevel, null);
    assert.equal(false, actual);
  });
});
