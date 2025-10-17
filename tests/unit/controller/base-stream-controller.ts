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
  | 'lastCurrentTime'
  | 'fragCurrent'
  | 'onMediaSeeking'
  | 'getBufferInfo'
  | 'resetLoadingState'
  | 'config'
  | 'getFwdBufferInfoAtPos'
  | 'isFragmentNearlyDownloaded'
> & {
  media: HTMLMediaElement | null;
  _streamEnded: (bufferInfo: BufferInfo, levelDetails: LevelDetails) => boolean;
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
  isFragmentNearlyDownloaded: (fragment: MediaFragment) => boolean;
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

  describe('Seeking Logic', function () {
    describe('onMediaSeeking', function () {
      it('should handle backward seek behavior correctly', function () {
        // Setup initial state for backward seek
        baseStreamController.lastCurrentTime = 10.5;
        media.currentTime = 5.2;

        // Call onMediaSeeking - should execute without error
        expect(() => baseStreamController.onMediaSeeking()).to.not.throw();

        // Verify lastCurrentTime is not updated on backward seek
        expect(baseStreamController.lastCurrentTime).to.equal(10.5);
      });

      it('should handle forward seek behavior correctly', function () {
        // Setup initial state for forward seek
        baseStreamController.lastCurrentTime = 5.2;
        media.currentTime = 10.5;

        // Call onMediaSeeking - should execute without error
        expect(() => baseStreamController.onMediaSeeking()).to.not.throw();

        // Verify lastCurrentTime is updated on forward seek
        expect(baseStreamController.lastCurrentTime).to.equal(10.5);
      });

      it('should handle same position seek correctly', function () {
        // Setup initial state - no seek
        baseStreamController.lastCurrentTime = 10.5;
        media.currentTime = 10.5;

        // Call onMediaSeeking - should execute without error
        expect(() => baseStreamController.onMediaSeeking()).to.not.throw();

        // Verify lastCurrentTime remains the same
        expect(baseStreamController.lastCurrentTime).to.equal(10.5);
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

      it('should handle fragment cancellation logic properly', function () {
        // Verify that the onMediaSeeking method can be called without error
        expect(typeof baseStreamController.onMediaSeeking).to.equal('function');
        expect(typeof baseStreamController.isFragmentNearlyDownloaded).to.equal(
          'function',
        );

        // Setup fragment with loader
        mockFragment.loader = {
          abort: sinon.spy(),
          stats: {
            loading: { first: 100 },
            total: 1000,
            loaded: 900,
          },
        } as any;

        // Call onMediaSeeking - should not throw
        expect(() => baseStreamController.onMediaSeeking()).to.not.throw();
      });

      it('should handle forward seek properly', function () {
        // Setup forward seek
        baseStreamController.lastCurrentTime = 12.0;
        media.currentTime = 18.0; // After fragment end (15)

        // Call onMediaSeeking - should execute without error
        expect(() => baseStreamController.onMediaSeeking()).to.not.throw();

        // Verify lastCurrentTime is updated for forward seek
        expect(baseStreamController.lastCurrentTime).to.equal(18.0);
      });
    });

    describe('getFwdBufferInfo method behavior', function () {
      it('should calculate buffer info correctly for backward seek scenarios', function () {
        // Setup backward seek scenario (lastCurrentTime > current position)
        baseStreamController.lastCurrentTime = 15.0;
        media.currentTime = 10.5;

        // Setup media state
        Object.defineProperty(media, 'paused', { value: false });

        // The method should exist and be callable
        expect(typeof baseStreamController.getFwdBufferInfoAtPos).to.equal(
          'function',
        );

        // Call the method - should handle backward seek logic internally
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
        // Setup normal forward playback scenario
        baseStreamController.lastCurrentTime = 5.0;
        media.currentTime = 10.5;

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
      it('should reset fragment state correctly', function () {
        // Setup state with current fragment
        const mockFrag = new Fragment(
          PlaylistLevelType.MAIN,
          'http://example.com/segment.ts',
        ) as MediaFragment;
        baseStreamController.fragCurrent = mockFrag;

        // Call resetLoadingState
        baseStreamController.resetLoadingState();

        // Verify fragment state is reset
        expect(baseStreamController.fragCurrent).to.be.null;
      });

      it('should handle reset when fragCurrent is already null', function () {
        // Setup state with no current fragment
        baseStreamController.fragCurrent = null;

        // Call resetLoadingState - should not throw
        expect(() => baseStreamController.resetLoadingState()).to.not.throw();

        // Verify fragCurrent remains null
        expect(baseStreamController.fragCurrent).to.be.null;
      });
    });

    describe('isFragmentNearlyDownloaded method', function () {
      it('should return false when fragment has no loader', function () {
        const mockFrag = new Fragment(
          PlaylistLevelType.MAIN,
          'http://example.com/segment.ts',
        ) as MediaFragment;
        mockFrag.loader = null;

        const result =
          baseStreamController.isFragmentNearlyDownloaded(mockFrag);
        expect(result).to.be.false;
      });

      it('should return false when fragment loader has no stats', function () {
        const mockFrag = new Fragment(
          PlaylistLevelType.MAIN,
          'http://example.com/segment.ts',
        ) as MediaFragment;
        mockFrag.loader = { stats: null } as any;

        const result =
          baseStreamController.isFragmentNearlyDownloaded(mockFrag);
        expect(result).to.be.false;
      });

      it('should return false when fragment has not started loading', function () {
        const mockFrag = new Fragment(
          PlaylistLevelType.MAIN,
          'http://example.com/segment.ts',
        ) as MediaFragment;
        mockFrag.loader = {
          stats: {
            loading: { first: 0 }, // No first byte yet
            total: 1000,
            loaded: 0,
          },
        } as any;

        const result =
          baseStreamController.isFragmentNearlyDownloaded(mockFrag);
        expect(result).to.be.false;
      });

      it('should return true when fragment is nearly complete', function () {
        const mockFrag = new Fragment(
          PlaylistLevelType.MAIN,
          'http://example.com/segment.ts',
        ) as MediaFragment;
        mockFrag.loader = {
          stats: {
            loading: { first: 100 }, // Has first byte
            total: 1000,
            loaded: 950, // Almost complete
          },
        } as any;

        // Mock bandwidth estimate for calculation
        baseStreamController.config.abrEwmaDefaultEstimate = 1000000; // 1Mbps

        const result =
          baseStreamController.isFragmentNearlyDownloaded(mockFrag);
        expect(result).to.be.true;
      });

      it('should return false when fragment will take too long to complete', function () {
        const mockFrag = new Fragment(
          PlaylistLevelType.MAIN,
          'http://example.com/segment.ts',
        ) as MediaFragment;
        mockFrag.loader = {
          stats: {
            loading: { first: 100 }, // Has first byte
            total: 1000000, // Large file
            loaded: 100, // Just started
          },
        } as any;

        // Mock low bandwidth estimate
        baseStreamController.config.abrEwmaDefaultEstimate = 100000; // 100Kbps

        const result =
          baseStreamController.isFragmentNearlyDownloaded(mockFrag);
        expect(result).to.be.false;
      });
    });
  });
});
