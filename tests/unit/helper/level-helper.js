const assert = require('assert');

import LevelHelper from '../../../src/helper/level-helper';

const mockReferenceFrag = {
  start: 20,
  end: 24,
  startPTS: 20,
  endPTS: 24,
  duration: 4
};

const mockFrags = [
  {
    start: 0,
    end: 4,
    startPTS: 0,
    endPTS: 4,
    duration: 4
  },
  {
    start: 4,
    end: 8,
    startPTS: 4,
    endPTS: 8,
    duration: 4
  }
];

describe('level-helper', function () {
  it ('adjusts level fragments using a reference fragment', function () {
    const details = {
      fragments: mockFrags.splice(0),
      PTSKnown: false
    };
    const expected = [
      {
        start: 20,
        end: 24,
        startPTS: 20,
        endPTS: 24,
        duration: 4
      },
      {
        start: 24,
        end: 28,
        startPTS: 24,
        endPTS: 28,
        duration: 4
      }
    ];

    LevelHelper.adjustPtsByReferenceFrag(mockReferenceFrag, details);
    assert.deepEqual(expected, details.fragments);
    assert.equal(true, details.PTSKnown);
  });
});
