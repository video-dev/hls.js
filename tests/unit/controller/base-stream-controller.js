import BaseStreamController from '../../../src/controller/stream-controller';
import Hls from '../../../src/hls';
import { FragmentState } from '../../../src/controller/fragment-tracker';

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
      expect(baseStreamController._streamEnded(bufferInfo, levelDetails)).to.be.false;
    });

    it('returns false if fragCurrent does not exist', function () {
      baseStreamController.fragCurrent = null;
      expect(baseStreamController._streamEnded(bufferInfo, levelDetails)).to.be.false;
    });

    it('returns false if fragCurrent has backtracked set to true', function () {
      baseStreamController.fragCurrent = { backtracked: true };
      expect(baseStreamController._streamEnded(bufferInfo, levelDetails)).to.be.false;
    });

    it('returns false if fragCurrent is not the last fragment', function () {
      baseStreamController.fragCurrent = { sn: 9 };
      levelDetails.endSN = 10;
      expect(baseStreamController._streamEnded(bufferInfo, levelDetails)).to.be.false;
    });

    it('returns false if there is subsequently buffered range', function () {
      baseStreamController.fragCurrent = { sn: 10 };
      levelDetails.endSN = 10;
      bufferInfo.nextStart = 100;
      expect(baseStreamController._streamEnded(bufferInfo, levelDetails)).to.be.false;
    });

    it('returns true if fragCurrent is PARTIAL or OK', function () {
      baseStreamController.fragCurrent = { sn: 10 };
      levelDetails.endSN = 10;

      fragmentTracker.state = FragmentState.PARTIAL;
      expect(baseStreamController._streamEnded(bufferInfo, levelDetails), `fragState is ${fragmentTracker.getState()}, expecting PARTIAL`).to.be.true;

      fragmentTracker.state = FragmentState.OK;
      expect(baseStreamController._streamEnded(bufferInfo, levelDetails), `fragState is ${fragmentTracker.getState()}, expecting OK`).to.be.true;
    });
  });
});
