import chai from 'chai';
import sinon from 'sinon';
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
  | 'media'
  | '_streamEnded'
  | 'backwardSeek'
  | 'lastCurrentTime'
  | 'fragCurrent'
  | 'onMediaSeeking'
  | 'getBufferInfo'
  | 'resetLoadingState'
  | 'config'
  | 'getFwdBufferInfoAtPos'
> & {
  media: HTMLMediaElement | null;
  _streamEnded: (bufferInfo: BufferInfo, levelDetails: LevelDetails) => boolean;
  backwardSeek: boolean;
  lastCurrentTime: number;
  fragCurrent: MediaFragment | null;
  onMediaSeeking: () => void;
  getBufferInfo: (pos: number, type: string) => BufferInfo | null;
  resetLoadingState: () => void;
  config: any;
  getFwdBufferInfoAtPos: (
    bufferable: any,
    pos: number,
    type: string,
    maxBufferHole: number,
  ) => BufferInfo | null;
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
      removeFragmentsInRange() {
        // Mock implementation for removeFragmentsInRange
      },
    };
    baseStreamController = new BaseStreamController(
      hls,
      fragmentTracker,
      new KeyLoader(hlsDefaultConfig, hls.logger),
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
      frag.setStart(i * 5);
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

  describe('Backward Seek Logic', function () {
    describe('onMediaSeeking', function () {
      it('should detect backward seek when currentTime < lastCurrentTime', function () {
        // Setup initial state
        baseStreamController.lastCurrentTime = 10.5;
        media.currentTime = 5.2;

        // Call onMediaSeeking
        baseStreamController.onMediaSeeking();

        // Verify backward seek is detected
        expect(baseStreamController.backwardSeek).to.be.true;
      });

      it('should not detect backward seek when currentTime >= lastCurrentTime', function () {
        // Setup initial state - forward seek
        baseStreamController.lastCurrentTime = 5.2;
        media.currentTime = 10.5;

        // Call onMediaSeeking
        baseStreamController.onMediaSeeking();

        // Verify backward seek is not detected
        expect(baseStreamController.backwardSeek).to.be.false;
      });

      it('should not detect backward seek when currentTime equals lastCurrentTime', function () {
        // Setup initial state - no seek
        baseStreamController.lastCurrentTime = 10.5;
        media.currentTime = 10.5;

        // Call onMediaSeeking
        baseStreamController.onMediaSeeking();

        // Verify backward seek is not detected
        expect(baseStreamController.backwardSeek).to.be.false;
      });
    });

    describe('Fragment Cancellation Logic', function () {
      let mockFragment: MediaFragment;
      let abortSpy: sinon.SinonSpy;

      beforeEach(function () {
        mockFragment = new Fragment(
          PlaylistLevelType.MAIN,
          'http://example.com/segment.ts',
        ) as MediaFragment;
        mockFragment.sn = 1;
        Object.defineProperty(mockFragment, 'start', {
          value: 10,
          writable: true,
        });
        Object.defineProperty(mockFragment, 'end', {
          value: 15,
          writable: true,
        });

        abortSpy = sinon.spy();
        mockFragment.abortRequests = abortSpy;
        mockFragment.loader = { abort: sinon.spy() } as any;

        baseStreamController.fragCurrent = mockFragment;
      });

      it('should have a fragment available for testing', function () {
        expect(baseStreamController.fragCurrent).to.not.be.null;
        expect(baseStreamController.fragCurrent?.sn).to.equal(1);
      });

      it('should handle backward seek properly', function () {
        // Just verify that the onMediaSeeking method can be called without error
        // and that we have access to the backwardSeek property
        expect(typeof baseStreamController.onMediaSeeking).to.equal('function');
        expect(typeof baseStreamController.backwardSeek).to.equal('boolean');

        // Test that we can set and read the backwardSeek flag
        baseStreamController.backwardSeek = true;
        expect(baseStreamController.backwardSeek).to.be.true;

        baseStreamController.backwardSeek = false;
        expect(baseStreamController.backwardSeek).to.be.false;
      });

      it('should handle forward seek properly', function () {
        // Setup forward seek
        baseStreamController.lastCurrentTime = 12.0;
        media.currentTime = 18.0; // After fragment end (15)

        // Call onMediaSeeking
        baseStreamController.onMediaSeeking();

        // Verify backward seek is not detected
        expect(baseStreamController.backwardSeek).to.be.false;
      });
    });

    describe('getFwdBufferInfo method behavior', function () {
      it('should use backwardSeek flag in buffer calculation', function () {
        // Setup backward seek flag
        baseStreamController.backwardSeek = true;

        // Setup media state
        Object.defineProperty(media, 'paused', { value: false });

        // The method should exist and be callable
        expect(typeof baseStreamController.getFwdBufferInfoAtPos).to.equal(
          'function',
        );

        // Call the method to ensure it works with backwardSeek=true
        const result = baseStreamController.getFwdBufferInfoAtPos(
          media.buffered,
          10.5,
          PlaylistLevelType.MAIN,
          0,
        );

        // Result should be an object (BufferInfo or null)
        expect(result === null || typeof result === 'object').to.be.true;
      });

      it('should work with different maxBufferHole values', function () {
        // Setup normal playback
        baseStreamController.backwardSeek = false;

        // Setup media state
        Object.defineProperty(media, 'paused', { value: false });

        // Call the method with different maxBufferHole values
        const result1 = baseStreamController.getFwdBufferInfoAtPos(
          media.buffered,
          10.5,
          PlaylistLevelType.MAIN,
          0,
        );

        const result2 = baseStreamController.getFwdBufferInfoAtPos(
          media.buffered,
          10.5,
          PlaylistLevelType.MAIN,
          0.5,
        );

        // Both results should be valid (object or null)
        expect(result1 === null || typeof result1 === 'object').to.be.true;
        expect(result2 === null || typeof result2 === 'object').to.be.true;
      });
    });

    describe('resetLoadingState method', function () {
      it('should reset backwardSeek flag to false', function () {
        // Setup backward seek state
        baseStreamController.backwardSeek = true;
        const mockFrag = new Fragment(
          PlaylistLevelType.MAIN,
          'http://example.com/segment.ts',
        ) as MediaFragment;
        baseStreamController.fragCurrent = mockFrag;

        // Call resetLoadingState
        baseStreamController.resetLoadingState();

        // Verify backwardSeek flag is reset
        expect(baseStreamController.backwardSeek).to.be.false;
        expect(baseStreamController.fragCurrent).to.be.null;
      });

      it('should reset backwardSeek flag even when fragCurrent is null', function () {
        // Setup backward seek state with no current fragment
        baseStreamController.backwardSeek = true;
        baseStreamController.fragCurrent = null;

        // Call resetLoadingState
        baseStreamController.resetLoadingState();

        // Verify backwardSeek flag is reset
        expect(baseStreamController.backwardSeek).to.be.false;
      });
    });
  });
});
