/*
 *
 *
 *
 */

const assert = require('assert');
const sinon = require('sinon');
import LevelSuppression from '../../../src/utils/level-suppression';
import Hls from '../../../src/hls';

describe('Level suppression logic', function () {


  let levelSuppressionTimeout = 10000;


  describe('level-suppression', function () {

    let levelSuppression;
    let clock;

    beforeEach(function () {
      clock = sinon.useFakeTimers();
    });

    afterEach(function () {
      clock.restore();
    });

    it('suppresses some levels', function () {
      levelSuppression = new LevelSuppression();
      levelSuppression.set(2, levelSuppressionTimeout);
      levelSuppression.set(3, levelSuppressionTimeout);
      levelSuppression.set(4, levelSuppressionTimeout);

      assert.strictEqual(levelSuppression.isSuppressed(0), false);
      assert.strictEqual(levelSuppression.isSuppressed(1), false);
      assert.strictEqual(levelSuppression.isSuppressed(2), true);
      assert.strictEqual(levelSuppression.isSuppressed(3), true);
      assert.strictEqual(levelSuppression.isSuppressed(4), true);
    });

    it('suppresses all levels', function () {
      let levels = [0, 1, 2, 3, 4];
      levelSuppression = new LevelSuppression();

      levels.forEach((level) => {
        levelSuppression.set(level, levelSuppressionTimeout)
      });

      assert.equal(levelSuppression.isAllSuppressed(0, levels.length - 1), true);
    });

    it('is not suppressed when timeout is exceeded', function () {

      levelSuppression = new LevelSuppression();

      levelSuppression.set(2, levelSuppressionTimeout);
      levelSuppression.set(3, levelSuppressionTimeout);
      levelSuppression.set(4, levelSuppressionTimeout);

      clock.tick(levelSuppressionTimeout); //advance clock by length of timeout

      assert.strictEqual(levelSuppression.isSuppressed(2), false);
      assert.strictEqual(levelSuppression.isSuppressed(3), false);
      assert.strictEqual(levelSuppression.isSuppressed(4), false);
    });
  });

  describe('getAppropriateLevel', function () {
    let hls;

    beforeEach(function () {
      hls = new Hls();
      hls.levelController._levels = [
        { bitrate: 105000, name: "144", details: { totalduration: 4, fragments: [{}] } },
        { bitrate: 246440, name: "240", details: { totalduration: 10, fragments: [{}] } },
        { bitrate: 460560, name: "380", details: { totalduration: 10, fragments: [{}] } },
        { bitrate: 836280, name: "480", details: { totalduration: 10, fragments: [{}] } },
        { bitrate: 2149280, name: "720", details: { totalduration: 10, fragments: [{}] } },
        { bitrate: 6221600, name: "1080", details: { totalduration: 10, fragments: [{}] } }
      ];
    });

    afterEach(function () {
      hls = null;
    });

    it('returns the next non-suppressed level when one level is suppressed', function () {

      let currentLevel = 4;

      // suppress the fourth level
      hls.levelSuppression.set(currentLevel, hls.config.levelLoadingMaxRetryTimeout);

      assert.strictEqual(hls.getAppropriateLevel(currentLevel), 3);
    });

    it('returns the next non-suppressed level when multiple levels are suppressed', function () {

      hls.levelSuppression.set(4, hls.config.levelLoadingMaxRetryTimeout);
      hls.levelSuppression.set(5, hls.config.levelLoadingMaxRetryTimeout);

      let nonSuppressedLevel = hls.getAppropriateLevel(5);

      assert.strictEqual(nonSuppressedLevel, 3);
    });

    it('returns the last level if all levels are suppressed', function () {

      //last level hls loaded
      hls.streamController.levelLastLoaded = 0;

      //suppress all levels
      hls.levelController._levels.forEach((level, levelIndex) => {
        hls.levelSuppression.set(levelIndex, hls.config.levelLoadingMaxRetryTimeout)
      });

      assert.strictEqual(hls.getAppropriateLevel(hls.abrController.nextAutoLevel), hls.levelController._levels.length - 1);
    });

  })

});
