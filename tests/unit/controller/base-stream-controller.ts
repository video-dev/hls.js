import chai from 'chai';
import sinonChai from 'sinon-chai';
import { hlsDefaultConfig } from '../../../src/config';
import BaseStreamController from '../../../src/controller/stream-controller';
import Hls from '../../../src/hls';
import { Fragment } from '../../../src/loader/fragment';
import KeyLoader from '../../../src/loader/key-loader';
import { LevelDetails } from '../../../src/loader/level-details';
import { PlaylistLevelType } from '../../../src/types/loader';
import { TimeRangesMock } from '../../mocks/time-ranges.mock';
import type { MediaFragment, Part } from '../../../src/loader/fragment';
import type { BufferInfo } from '../../../src/utils/buffer-helper';

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
      new KeyLoader(hlsDefaultConfig),
    ) as unknown as BaseStreamControllerTestable;
    bufferInfo = {
      len: 1,
      nextStart: 0,
      start: 0,
      end: 1,
      bufferedIndex: 0,
      buffered: [{ start: 0, end: 1 }],
    };
    media = {
      duration: 0,
      buffered: new TimeRangesMock(),
    } as unknown as HTMLMediaElement;
    baseStreamController.media = media;
  });

  function levelDetailsWithEndSequenceVodOrLive(
    endSN: number = 1,
    live: boolean = false,
  ) {
    const details = new LevelDetails('');
    for (let i = 0; i < endSN; i++) {
      const frag = new Fragment(PlaylistLevelType.MAIN, '') as MediaFragment;
      frag.duration = 5;
      frag.sn = i;
      frag.start = i * 5;
      details.fragments.push(frag);
    }
    details.live = live;
    return details;
  }

  describe('_streamEnded', function () {
    it('returns false if the stream is live', function () {
      const levelDetails = levelDetailsWithEndSequenceVodOrLive(3, true);
      expect(baseStreamController._streamEnded(bufferInfo, levelDetails)).to.be
        .false;
    });

    it('returns false if there is subsequently buffered range within program range', function () {
      const levelDetails = levelDetailsWithEndSequenceVodOrLive(10);
      expect(levelDetails.edge).to.eq(50);
      bufferInfo.nextStart = 45;
      expect(baseStreamController._streamEnded(bufferInfo, levelDetails)).to.be
        .false;
    });

    it('returns true if complete and subsequently buffered range is outside program range', function () {
      const levelDetails = levelDetailsWithEndSequenceVodOrLive(10);
      expect(levelDetails.edge).to.eq(50);
      bufferInfo.nextStart = 100;
      expect(baseStreamController._streamEnded(bufferInfo, levelDetails)).to.be
        .true;
    });

    it('returns true if parts are buffered for low latency content', function () {
      media.buffered = new TimeRangesMock([0, 1]);
      const levelDetails = levelDetailsWithEndSequenceVodOrLive(10);
      levelDetails.partList = [{ start: 0, duration: 1 } as unknown as Part];

      expect(baseStreamController._streamEnded(bufferInfo, levelDetails)).to.be
        .true;
    });

    it('depends on fragment-tracker to determine if last fragment is buffered', function () {
      media.buffered = new TimeRangesMock([0, 1]);
      const levelDetails = levelDetailsWithEndSequenceVodOrLive(10);

      expect(baseStreamController._streamEnded(bufferInfo, levelDetails)).to.be
        .true;

      fragmentTracker.isEndListAppended = () => false;
      expect(baseStreamController._streamEnded(bufferInfo, levelDetails)).to.be
        .false;
    });
  });
});
