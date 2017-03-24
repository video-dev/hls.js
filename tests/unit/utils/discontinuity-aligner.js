const assert = require('assert');

import { shouldAlignOnDiscontinuities, findDiscontinuousReferenceFrag, adjustPtsByReferenceFrag } from '../../../src/utils/discontinuity-aligner';

const mockReferenceFrag = {
  start: 20,
  end: 24,
  startPTS: 20,
  endPTS: 24,
  duration: 4,
  cc: 0,
};

const mockFrags = [
  {
    start: 0,
    end: 4,
    startPTS: 0,
    endPTS: 4,
    duration: 4,
    cc: 0,
  },
  {
    start: 4,
    end: 8,
    startPTS: 4,
    endPTS: 8,
    duration: 4,
    cc: 1
  }
];


describe('level-helper', function () {
  it ('adjusts level fragments using a reference fragment', function () {
    const details = {
      fragments: mockFrags.slice(0),
      PTSKnown: false
    };
    const expected = [
      {
        start: 20,
        end: 24,
        startPTS: 20,
        endPTS: 24,
        duration: 4,
        cc: 0
      },
      {
        start: 24,
        end: 28,
        startPTS: 24,
        endPTS: 28,
        duration: 4,
        cc: 1
      }
    ];

    adjustPtsByReferenceFrag(mockReferenceFrag, details);
    assert.deepEqual(expected, details.fragments);
    assert.equal(true, details.PTSKnown);
  });

  it ('does not adjust level fragments if there is no reference frag', function () {
    const details = {
      fragments: mockFrags.slice(0),
      PTSKnown: false
    };

    adjustPtsByReferenceFrag(undefined, details);
    assert.deepEqual(mockFrags, details.fragments);
    assert.equal(false, details.PTSKnown);
  });

  it('finds the first fragment in an array which matches the CC of the first fragment in another array', function () {
    const prevDetails = {
      fragments: [mockReferenceFrag, { cc: 1  }]
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
