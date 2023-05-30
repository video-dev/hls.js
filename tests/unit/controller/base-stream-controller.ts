import Hls from '../../../src/hls';
import { hlsDefaultConfig } from '../../../src/config';
import BaseStreamController from '../../../src/controller/stream-controller';
import KeyLoader from '../../../src/loader/key-loader';
import { TimeRangesMock } from '../../mocks/time-ranges.mock';
import type { BufferInfo } from '../../../src/utils/buffer-helper';
import type { LevelDetails } from '../../../src/loader/level-details';
import type { Fragment, Part } from '../../../src/loader/fragment';

import chai from 'chai';
import sinonChai from 'sinon-chai';

chai.use(sinonChai);
const expect = chai.expect;

type BaseStreamControllerTestable = Omit<
  BaseStreamController,
  'media' | '_streamEnded'
> & {
  media: HTMLMediaElement | null;
  _streamEnded: (bufferInfo: BufferInfo, levelDetails: LevelDetails) => boolean;
};

describe('BaseStreamController', function () {
  let hls: Hls;
  let baseStreamController: BaseStreamControllerTestable;
  let bufferInfo: BufferInfo;
  let levelDetails: LevelDetails;
  let fragmentTracker;
  let media;
  beforeEach(function () {
    hls = new Hls({});
    fragmentTracker = {
      state: null,
      getState() {
        return this.state;
      },
      isEndListAppended() {
        return true;
      },
    };
    baseStreamController = new BaseStreamController(
      hls,
      fragmentTracker,
      new KeyLoader(hlsDefaultConfig)
    ) as unknown as BaseStreamControllerTestable;
    bufferInfo = {
      len: 1,
      nextStart: 0,
      start: 0,
      end: 1,
    };
    levelDetails = {
      endSN: 0,
      live: false,
      get fragments() {
        const frags: Fragment[] = [];
        for (let i = 0; i < this.endSN; i++) {
          frags.push({ sn: i, type: 'main' } as unknown as Fragment);
        }
        return frags;
      },
    } as unknown as LevelDetails;
    media = {
      duration: 0,
      buffered: new TimeRangesMock(),
    } as unknown as HTMLMediaElement;
    baseStreamController.media = media;
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
      levelDetails.partList = [{ start: 0, duration: 1 } as unknown as Part];

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
