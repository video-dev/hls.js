import sinon from 'sinon';
import Hls from '../../../src/hls';
import CapLevelController from '../../../src/controller/cap-level-controller';

const assert = require('assert');

const levels = [
  {
    width: 360,
    height: 360,
    bandwidth: 1000
  },
  {
    width: 540,
    height: 540,
    bandwidth: 2000
  },
  {
    width: 540,
    height: 540,
    bandwidth: 3000
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

  describe('initialization', function () {
    let capLevelController;
    let firstLevelSpy;
    let startCappingSpy;
    beforeEach(function () {
      const hls = new Hls({ capLevelToPlayerSize: true });
      firstLevelSpy = sinon.spy(hls, 'firstLevel', ['set']);
      capLevelController = new CapLevelController(hls);
      startCappingSpy = sinon.spy(capLevelController, '_startCapping');
    });

    describe('start and stop', function () {
      it('immediately caps and sets a timer for monitoring size size', function () {
        const detectPlayerSizeSpy = sinon.spy(capLevelController, 'detectPlayerSize');
        capLevelController._startCapping();
        assert(capLevelController.timer);
        assert(firstLevelSpy.set.calledOnce);
        assert(detectPlayerSizeSpy.calledOnce);
      });

      it('stops the capping timer and resets capping', function () {
        capLevelController.autoLevelCapping = 4;
        capLevelController.timer = 1;
        capLevelController._stopCapping();

        assert.strictEqual(capLevelController.autoLevelCapping, Number.POSITIVE_INFINITY);
        assert.strictEqual(capLevelController.restrictedLevels.length, 0);
        assert.strictEqual(capLevelController.firstLevel, null);
        assert.strictEqual(capLevelController.timer, null);
      });
    });

    it('constructs with no restrictions', function () {
      assert.strictEqual(capLevelController.levels.length, 0);
      assert.strictEqual(capLevelController.restrictedLevels.length, 0);
      assert.strictEqual(capLevelController.timer, null);
      assert.strictEqual(capLevelController.autoLevelCapping, Number.POSITIVE_INFINITY);
      assert(firstLevelSpy.set.notCalled);
    });

    it('starts capping on BUFFER_CODECS only if video is found', function () {
      capLevelController.onBufferCodecs({ video: {} });
      assert(startCappingSpy.calledOnce);
    });

    it('does not start capping on BUFFER_CODECS if video is not found', function () {
      capLevelController.onBufferCodecs({ audio: {} });
      assert(startCappingSpy.notCalled);
    });

    it('starts capping if the video codec was found after the audio codec', function () {
      capLevelController.onBufferCodecs({ audio: {} });
      assert(startCappingSpy.notCalled);
      capLevelController.onBufferCodecs({ video: {} });
      assert(startCappingSpy.calledOnce);
    });

    it('receives level information from the MANIFEST_PARSED event', function () {
      capLevelController.restrictedLevels = [1];
      let data = {
        levels: [{ foo: 'bar' }],
        firstLevel: 0
      };

      capLevelController.onManifestParsed(data);
      assert.strictEqual(capLevelController.levels, data.levels);
      assert.strictEqual(capLevelController.firstLevel, data.firstLevel);
      assert.strictEqual(capLevelController.restrictedLevels.length, 0);
    });

    it('should start capping in MANIFEST_PARSED if a video codec was signaled in the manifest', function () {
      capLevelController.onManifestParsed({ video: {} });
      assert(startCappingSpy.calledOnce);
    });

    it('does not start capping on MANIFEST_PARSED if no video codec was signaled in the manifest', function () {
      capLevelController.onManifestParsed({ levels: [{}], altAudio: true });
      assert(startCappingSpy.notCalled);
    });
  });
});
