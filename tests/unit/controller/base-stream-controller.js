import BaseStreamController from '../../../src/controller/stream-controller';
import Hls from '../../../src/hls';
import { TimeRangesMock } from '../../mocks/time-ranges.mock';

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
      end: 1,
    };
    levelDetails = {
      endSN: 0,
      live: false,
      get fragments() {
        const frags = [];
        for (let i = 0; i < this.endSN; i++) {
          frags.push({ sn: i, type: 'main' });
        }
        return frags;
      },
    };
    media = {
      duration: 0,
    };
    fragmentTracker = {
      state: null,
      getState() {
        return this.state;
      },
      isEndListAppended() {
        return true;
      },
    };
    baseStreamController.media = media;
    baseStreamController.fragmentTracker = fragmentTracker;
  });

  describe('_streamEnded', function () {
    it('returns false if the stream is live', function () {
      levelDetails.live = true;
      expect(baseStreamController._streamEnded(bufferInfo, levelDetails)).to.be
        .false;
    });

    it('returns false if there is subsequently buffered range', function () {
      levelDetails.endSN = 10;
      bufferInfo.nextStart = 100;
      expect(baseStreamController._streamEnded(bufferInfo, levelDetails)).to.be
        .false;
    });

    it('returns true if parts are buffered for low latency content', function () {
      media.buffered = new TimeRangesMock([0, 1]);
      levelDetails.endSN = 10;
      levelDetails.partList = [{ start: 0, duration: 1 }];

      expect(baseStreamController._streamEnded(bufferInfo, levelDetails)).to.be
        .true;
    });

    it('depends on fragment-tracker to determine if last fragment is buffered', function () {
      media.buffered = new TimeRangesMock([0, 1]);
      levelDetails.endSN = 10;

      expect(baseStreamController._streamEnded(bufferInfo, levelDetails)).to.be
        .true;

      fragmentTracker.isEndListAppended = () => false;
      expect(baseStreamController._streamEnded(bufferInfo, levelDetails)).to.be
        .false;
    });
  });
});
