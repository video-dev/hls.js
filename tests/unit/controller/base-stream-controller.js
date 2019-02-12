import BaseStreamController from '../../../src/controller/stream-controller';
import Hls from '../../../src/hls';
import { FragmentState } from '../../../src/controller/fragment-tracker';
const assert = require('assert');

describe('BaseStreamController', function () {
  let baseStreamController;
  let bufferInfo;
  let levelDetails;
  let fragmentTracker;
  let media;
  beforeEach(function () {
    baseStreamController = new BaseStreamController(new Hls({}));
    bufferInfo = {
      nextStart: 0,
      end: 0
    };
    levelDetails = {
      endSN: 0,
      live: false
    };
    media = {
      duration: 0
    };
    fragmentTracker = {
      state: null,
      getState () {
        return this.state;
      }
    };
    baseStreamController.media = media;
    baseStreamController.fragmentTracker = fragmentTracker;
  });

  describe('_streamEnded', function () {
    it('returns false if the stream is live', function () {
      levelDetails.live = true;
      assert.strictEqual(baseStreamController._streamEnded(bufferInfo, levelDetails), false);
    });

    it('returns false if fragCurrent does not exist', function () {
      baseStreamController.fragCurrent = null;
      assert.strictEqual(baseStreamController._streamEnded(bufferInfo, levelDetails), false);
    });

    it('returns false if fragCurrent has backtracked set to true', function () {
      baseStreamController.fragCurrent = { backtracked: true };
      assert.strictEqual(baseStreamController._streamEnded(bufferInfo, levelDetails), false);
    });

    it('returns false if fragCurrent is not the last fragment', function () {
      baseStreamController.fragCurrent = { sn: 9 };
      levelDetails.endSN = 10;
      assert.strictEqual(baseStreamController._streamEnded(bufferInfo, levelDetails), false);
    });

    it('returns false if there is subsequently buffered range', function () {
      baseStreamController.fragCurrent = { sn: 10 };
      levelDetails.endSN = 10;
      bufferInfo.nextStart = 100;
      assert.strictEqual(baseStreamController._streamEnded(bufferInfo, levelDetails), false);
    });

    it('returns true if fragCurrent is PARTIAL or OK', function () {
      baseStreamController.fragCurrent = { sn: 10 };
      levelDetails.endSN = 10;

      fragmentTracker.state = FragmentState.PARTIAL;
      assert.strictEqual(baseStreamController._streamEnded(bufferInfo, levelDetails), true, `fragState is ${fragmentTracker.getState()}, expecting PARTIAL`);

      fragmentTracker.state = FragmentState.OK;
      assert.strictEqual(baseStreamController._streamEnded(bufferInfo, levelDetails), true, `fragState is ${fragmentTracker.getState()}, expecting OK`);
    });
  });
});
