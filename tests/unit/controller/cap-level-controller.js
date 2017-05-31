const assert = require('assert');

import CapLevelController from '../../../src/controller/cap-level-controller';

const levels = [
  {
    width: 360,
    height: 360,
    bandwidth: 1000
  },
  {
    width: 540,
    height: 540,
    bandwidth: 2000,
  },
  {
    width: 540,
    height: 540,
    bandwidth: 3000,
  },
  {
    width: 720,
    height: 720,
    bandwidth: 4000
  }
];

describe('CapLevelController', function () {
  describe('getMaxLevelByMediaSize', function () {
    it('Should choose the level whose dimensions are >= the media dimensions', function () {
      const expected = 0;
      const actual = CapLevelController.getMaxLevelByMediaSize(levels, 300, 300);
      assert.equal(expected, actual);
    });

    it('Should choose the level whose bandwidth is greater if level dimensions are equal', function () {
      const expected = 2;
      const actual = CapLevelController.getMaxLevelByMediaSize(levels, 500, 500);
      assert.equal(expected, actual);
    });

    it('Should choose the highest level if the media is greater than every level', function () {
      const expected = 3;
      const actual = CapLevelController.getMaxLevelByMediaSize(levels, 5000, 5000);
      assert.equal(expected, actual);
    });

    it('Should return -1 if there levels is empty', function () {
      const expected = -1;
      const actual = CapLevelController.getMaxLevelByMediaSize([], 5000, 5000);
      assert.equal(expected, actual);
    });

    it('Should return -1 if there levels is undefined', function () {
      const expected = -1;
      const actual = CapLevelController.getMaxLevelByMediaSize(undefined, 5000, 5000);
      assert.equal(expected, actual);
    });
  });
});
