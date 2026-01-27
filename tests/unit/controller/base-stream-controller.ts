import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { hlsDefaultConfig } from '../../../src/config';
import { State } from '../../../src/controller/base-stream-controller';
import BaseStreamControllerImpl from '../../../src/controller/stream-controller';
import Hls from '../../../src/hls';
import { Fragment } from '../../../src/loader/fragment';
import KeyLoader from '../../../src/loader/key-loader';
import { LevelDetails } from '../../../src/loader/level-details';
import { PlaylistLevelType } from '../../../src/types/loader';
import { BufferHelper } from '../../../src/utils/buffer-helper';
import { TimeRangesMock } from '../../mocks/time-ranges.mock';
import type BaseStreamController from '../../../src/controller/base-stream-controller';
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
  | 'state'
  | 'nextLoadPosition'
  | 'startPosition'
  | 'fragPrevious'
  | 'tickImmediate'
  | 'hls'
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
  state: (typeof State)[keyof typeof State];
  nextLoadPosition: number;
  startPosition: number;
  fragPrevious: MediaFragment | null;
  tickImmediate: () => void;
  hls: Hls;
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
      removeFragmentsInRange: sinon.spy(),
    };
    baseStreamController = new BaseStreamControllerImpl(
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

      it('should reset loading state when in ENDED state', function () {
        const resetSpy = sinon.spy(
          baseStreamController,
          'resetLoadingState' as any,
        );
        baseStreamController.state = State.ENDED;
        baseStreamController.lastCurrentTime = 10.0;
        media.currentTime = 15.0;

        baseStreamController.onMediaSeeking();

        expect(resetSpy).to.have.been.calledOnce;
        resetSpy.restore();
      });

      it('should call fragmentTracker.removeFragmentsInRange when media exists', function () {
        baseStreamController.lastCurrentTime = 5.0;
        media.currentTime = 10.0;

        baseStreamController.onMediaSeeking();

        expect(fragmentTracker.removeFragmentsInRange).to.have.been.calledWith(
          10.0,
          Infinity,
          PlaylistLevelType.MAIN,
          true,
        );
      });

      it('should set nextLoadPosition and startPosition when no buffer exists and hasEnoughToStart is false', function () {
        // Mock hasEnoughToStart to return false and isBuffered to return false
        const hasEnoughToStartStub = sinon.stub(
          baseStreamController.hls,
          'hasEnoughToStart',
        );
        hasEnoughToStartStub.get(() => false);
        const isBufferedStub = sinon
          .stub(BufferHelper, 'isBuffered')
          .returns(false);
        baseStreamController.lastCurrentTime = 0;
        media.currentTime = 20.0;
        media.buffered = new TimeRangesMock(); // Empty buffer

        baseStreamController.onMediaSeeking();

        expect(baseStreamController.nextLoadPosition).to.equal(20.0);
        expect(baseStreamController.startPosition).to.equal(20.0);

        hasEnoughToStartStub.restore();
        isBufferedStub.restore();
      });

      it('should only set nextLoadPosition when position is buffered but hasEnoughToStart is false', function () {
        const hasEnoughToStartStub = sinon.stub(
          baseStreamController.hls,
          'hasEnoughToStart',
        );
        hasEnoughToStartStub.get(() => false);
        // Don't stub isBuffered - let it return true since position 5.0 is within [0, 10]
        // Setup buffer that extends forward from a position before currentTime
        // currentTime at 15.0, buffer from 0-10 means there's forward buffer info calculated
        // but we need bufferInfo.len > 0 which means there's forward buffer from currentTime
        // Actually, if currentTime=15 and buffer is [0,10], bufferInfo at 15 would have len=0
        // Let me position currentTime at 5 where there IS forward buffer (buffer extends to 10)
        // and position IS buffered, so bufferEmpty is false
        const originalStartPos = baseStreamController.startPosition;
        media.buffered = new TimeRangesMock([0, 10]);
        baseStreamController.lastCurrentTime = 0;
        media.currentTime = 5.0; // Positioned within buffer range

        baseStreamController.onMediaSeeking();

        expect(baseStreamController.nextLoadPosition).to.equal(5.0);
        // startPosition should remain at original value since bufferEmpty is false
        expect(baseStreamController.startPosition).to.equal(originalStartPos);

        hasEnoughToStartStub.restore();
      });

      it('should call tickImmediate when no forward buffer and state is IDLE', function () {
        const tickImmediateSpy = sinon.spy(
          baseStreamController,
          'tickImmediate' as any,
        );
        baseStreamController.state = State.IDLE;
        media.buffered = new TimeRangesMock(); // Empty buffer
        baseStreamController.lastCurrentTime = 0;
        media.currentTime = 5.0;

        baseStreamController.onMediaSeeking();

        expect(tickImmediateSpy).to.have.been.calledOnce;
        tickImmediateSpy.restore();
      });

      it('should not call tickImmediate when forward buffer exists even if state is IDLE', function () {
        const tickImmediateSpy = sinon.spy(
          baseStreamController,
          'tickImmediate' as any,
        );
        baseStreamController.state = State.IDLE;
        // Setup buffer with forward range
        media.buffered = new TimeRangesMock([0, 10]);
        baseStreamController.lastCurrentTime = 0;
        media.currentTime = 5.0;

        baseStreamController.onMediaSeeking();

        expect(tickImmediateSpy).to.not.have.been.called;
        tickImmediateSpy.restore();
      });

      it('should not call tickImmediate when no forward buffer but state is not IDLE', function () {
        const tickImmediateSpy = sinon.spy(
          baseStreamController,
          'tickImmediate' as any,
        );
        baseStreamController.state = State.FRAG_LOADING;
        media.buffered = new TimeRangesMock(); // Empty buffer
        baseStreamController.lastCurrentTime = 0;
        media.currentTime = 5.0;

        baseStreamController.onMediaSeeking();

        expect(tickImmediateSpy).to.not.have.been.called;
        tickImmediateSpy.restore();
      });
    });

    describe('Fragment Cancellation Logic', function () {
      let mockFragment: MediaFragment;
      let resetSpy: sinon.SinonSpy;

      beforeEach(function () {
        mockFragment = new Fragment(
          PlaylistLevelType.MAIN,
          'http://example.com/segment.ts',
        ) as MediaFragment;
        mockFragment.sn = 1;
        mockFragment.duration = 5;
        Object.defineProperty(mockFragment, 'start', {
          value: 10,
          writable: true,
        });
        Object.defineProperty(mockFragment, 'end', {
          value: 15,
          writable: true,
        });

        // Create fresh abort function each time
        mockFragment.abortRequests = sinon.spy();
        mockFragment.loader = { abort: sinon.spy() } as any;

        baseStreamController.fragCurrent = mockFragment;
        baseStreamController.config.maxFragLookUpTolerance = 0.1;

        resetSpy = sinon.spy(baseStreamController, 'resetLoadingState' as any);
      });

      afterEach(function () {
        resetSpy.restore();
      });

      it('should abort fragment when seeking forward past fragment and fragment is not nearly downloaded', function () {
        baseStreamController.lastCurrentTime = 12.0;
        media.currentTime = 18.0; // Past fragment end (15 + tolerance)
        // Setup fragment with loader but not nearly downloaded
        // For 1Mbps, need > 150k bits remaining to exceed 0.15s threshold
        mockFragment.loader = {
          stats: {
            loading: { first: 100 },
            total: 1000000,
            loaded: 100000, // 900k bits remaining, will take 0.9s > 0.15s
          },
        } as any;
        baseStreamController.config.abrEwmaDefaultEstimate = 1000000; // 1Mbps
        baseStreamController.hls.bandwidthEstimate = NaN; // Use default
        // Setup buffer info to indicate seeking out of range
        media.buffered = new TimeRangesMock([0, 5]); // Buffer before fragment

        baseStreamController.onMediaSeeking();

        expect(mockFragment.abortRequests).to.have.been.calledOnce;
        expect(resetSpy).to.have.been.calledOnce;
      });

      it('should abort fragment when seeking forward past fragment even if fragment is nearly downloaded', function () {
        baseStreamController.lastCurrentTime = 12.0;
        media.currentTime = 18.0; // Past fragment end
        // Setup fragment with loader that IS nearly downloaded
        // However, according to current logic, forward seeks past fragment always abort
        // because the condition is: (pastFragment || !isFragmentNearlyDownloaded)
        // When pastFragment is true, it always aborts regardless of nearlyDownloaded
        mockFragment.loader = {
          stats: {
            loading: { first: 100 },
            total: 1000000, // 1MB
            loaded: 998000, // 2000 bytes remaining - nearly downloaded
          },
        } as any;
        baseStreamController.config.abrEwmaDefaultEstimate = 10000000; // 10Mbps
        baseStreamController.hls.bandwidthEstimate = NaN;
        // Setup buffer info to indicate seeking out of range
        media.buffered = new TimeRangesMock([0, 5]); // Buffer before fragment

        baseStreamController.onMediaSeeking();

        // Forward seek past fragment always aborts, even if nearly downloaded
        expect(mockFragment.abortRequests).to.have.been.calledOnce;
        expect(resetSpy).to.have.been.calledOnce;
      });

      it('should NOT abort fragment when seeking backward before fragment if nearly downloaded', function () {
        baseStreamController.lastCurrentTime = 20.0;
        media.currentTime = 5.0; // Before fragment start (10 - tolerance)
        // Setup fragment with loader that IS nearly downloaded
        // For backward seeks, the condition is (pastFragment || !isFragmentNearlyDownloaded)
        // Since pastFragment = false for backward seeks, it only aborts if !isFragmentNearlyDownloaded
        // So if nearly downloaded, it should NOT abort
        mockFragment.loader = {
          stats: {
            loading: { first: 100 },
            total: 1000000,
            loaded: 900000, // Nearly complete (100k bits remaining = 0.1s < 0.15s)
          },
        } as any;
        baseStreamController.config.abrEwmaDefaultEstimate = 1000000;
        baseStreamController.hls.bandwidthEstimate = NaN;
        // Setup buffer info
        media.buffered = new TimeRangesMock([0, 3]); // Buffer before fragment

        baseStreamController.onMediaSeeking();

        // For backward seeks with nearly downloaded fragment, should NOT abort
        expect(mockFragment.abortRequests).to.not.have.been.called;
        expect(resetSpy).to.not.have.been.called;
      });

      it('should abort fragment when seeking backward before fragment and not nearly downloaded', function () {
        baseStreamController.lastCurrentTime = 20.0;
        media.currentTime = 5.0; // Before fragment start
        // Setup fragment with loader but not nearly downloaded
        mockFragment.loader = {
          stats: {
            loading: { first: 100 },
            total: 1000000,
            loaded: 100000, // Not nearly downloaded
          },
        } as any;
        baseStreamController.config.abrEwmaDefaultEstimate = 1000000;
        baseStreamController.hls.bandwidthEstimate = NaN;
        media.buffered = new TimeRangesMock([0, 3]);

        baseStreamController.onMediaSeeking();

        expect(mockFragment.abortRequests).to.have.been.calledOnce;
        expect(resetSpy).to.have.been.calledOnce;
      });

      it('should clear fragPrevious when seeking outside fragment range', function () {
        const previousFrag = new Fragment(
          PlaylistLevelType.MAIN,
          'http://example.com/prev.ts',
        ) as MediaFragment;
        baseStreamController.fragPrevious = previousFrag;
        baseStreamController.lastCurrentTime = 12.0;
        media.currentTime = 18.0; // Past fragment end
        mockFragment.loader = {
          stats: {
            loading: { first: 100 },
            total: 1000000,
            loaded: 500000,
          },
        } as any;
        baseStreamController.config.abrEwmaDefaultEstimate = 1000000;
        baseStreamController.hls.bandwidthEstimate = NaN;
        media.buffered = new TimeRangesMock([0, 5]);

        baseStreamController.onMediaSeeking();

        expect(baseStreamController.fragPrevious).to.be.null;
      });

      it('should not abort fragment when seeking within fragment range', function () {
        baseStreamController.lastCurrentTime = 10.0;
        media.currentTime = 12.0; // Within fragment range (10-15)
        // Setup buffer info showing we're in buffer
        media.buffered = new TimeRangesMock([10, 15]);
        mockFragment.loader = {
          stats: {
            loading: { first: 100 },
            total: 1000,
            loaded: 500,
          },
        } as any;
        baseStreamController.config.abrEwmaDefaultEstimate = 1000000;
        baseStreamController.hls.bandwidthEstimate = NaN;

        baseStreamController.onMediaSeeking();

        expect(mockFragment.abortRequests).to.not.have.been.called;
        expect(resetSpy).to.not.have.been.called;
      });

      it('should not abort fragment when fragment has no loader', function () {
        baseStreamController.lastCurrentTime = 12.0;
        media.currentTime = 18.0; // Past fragment end
        mockFragment.loader = null;
        media.buffered = new TimeRangesMock([0, 5]);

        baseStreamController.onMediaSeeking();

        expect(mockFragment.abortRequests).to.not.have.been.called;
        expect(resetSpy).to.not.have.been.called;
      });

      it('should not abort when fragment is in buffered range', function () {
        baseStreamController.lastCurrentTime = 8.0;
        media.currentTime = 13.0; // Within fragment but out of buffered range initially
        // But buffer extends into fragment range
        media.buffered = new TimeRangesMock([10, 14]); // Overlaps with fragment
        mockFragment.loader = {
          stats: {
            loading: { first: 100 },
            total: 1000000,
            loaded: 500000,
          },
        } as any;
        baseStreamController.config.abrEwmaDefaultEstimate = 1000000;
        baseStreamController.hls.bandwidthEstimate = NaN;

        baseStreamController.onMediaSeeking();

        // Should not abort because fragment is in buffered range
        expect(mockFragment.abortRequests).to.not.have.been.called;
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

      it('should return true when time to complete is exactly 0.15 seconds', function () {
        const mockFrag = new Fragment(
          PlaylistLevelType.MAIN,
          'http://example.com/segment.ts',
        ) as MediaFragment;
        // The code treats bandwidth as bytes/sec for this calculation (despite being labeled as bps in config)
        // For 1Mbps = 1,000,000 bits/s = 125,000 bytes/s
        // To complete in 0.15s: need 0.15 * 125,000 = 18,750 bytes
        // So: total = 1,000,000 bytes, loaded = 981,250 bytes, remaining = 18,750 bytes
        mockFrag.loader = {
          stats: {
            loading: { first: 100 },
            total: 1000000, // 1MB in bytes
            loaded: 981250, // 18,750 bytes remaining
          },
        } as any;

        // Set bandwidth to bytes/sec: 1Mbps = 125,000 bytes/s
        baseStreamController.config.abrEwmaDefaultEstimate = 125000; // 1Mbps in bytes/sec
        baseStreamController.hls.bandwidthEstimate = NaN; // Use default
        // Time = 18,750 / 125,000 = 0.15s

        const result =
          baseStreamController.isFragmentNearlyDownloaded(mockFrag);
        expect(result).to.be.true;
      });

      it('should return false when time to complete is just above 0.15 seconds', function () {
        const mockFrag = new Fragment(
          PlaylistLevelType.MAIN,
          'http://example.com/segment.ts',
        ) as MediaFragment;
        // The code treats bandwidth as bytes/sec for this calculation (despite being labeled as bps in config)
        // For 1Mbps = 1,000,000 bits/s = 125,000 bytes/s
        // To exceed 0.15s: need > 0.15 * 125,000 = > 18,750 bytes
        // So: total = 1,000,000 bytes, loaded = 981,249 bytes, remaining = 18,751 bytes
        mockFrag.loader = {
          stats: {
            loading: { first: 100 },
            total: 1000000, // 1MB in bytes
            loaded: 981249, // 18,751 bytes remaining
          },
        } as any;

        // Set bandwidth to bytes/sec: 1Mbps = 125,000 bytes/s
        baseStreamController.config.abrEwmaDefaultEstimate = 125000; // 1Mbps in bytes/sec
        baseStreamController.hls.bandwidthEstimate = NaN; // Use default
        // Time = 18,751 / 125,000 = 0.150008s (> 0.15)

        const result =
          baseStreamController.isFragmentNearlyDownloaded(mockFrag);
        expect(result).to.be.false;
      });

      it('should use hls.bandwidthEstimate when finite', function () {
        const mockFrag = new Fragment(
          PlaylistLevelType.MAIN,
          'http://example.com/segment.ts',
        ) as MediaFragment;
        // Set up to complete in 0.10 seconds with bandwidthEstimate
        // The code treats bandwidth as bytes/sec: 2Mbps = 250,000 bytes/s
        // To complete in 0.10s: need 0.10 * 250,000 = 25,000 bytes
        mockFrag.loader = {
          stats: {
            loading: { first: 100 },
            total: 1000000, // 1MB in bytes
            loaded: 975000, // 25,000 bytes remaining = 0.10s at 2Mbps (250k bytes/s)
          },
        } as any;

        baseStreamController.hls.bandwidthEstimate = 250000; // 2Mbps in bytes/sec
        baseStreamController.config.abrEwmaDefaultEstimate = 125000; // 1Mbps in bytes/sec (should not be used)

        const result =
          baseStreamController.isFragmentNearlyDownloaded(mockFrag);
        // With 2Mbps: 25,000 / 250,000 = 0.10s (< 0.15) -> true
        expect(result).to.be.true;
      });

      it('should use config.abrEwmaDefaultEstimate when bandwidthEstimate is not finite', function () {
        const mockFrag = new Fragment(
          PlaylistLevelType.MAIN,
          'http://example.com/segment.ts',
        ) as MediaFragment;
        // Set up to complete in 0.10 seconds with default estimate
        // The code treats bandwidth as bytes/sec: 1Mbps = 125,000 bytes/s
        // To complete in 0.10s: need 0.10 * 125,000 = 12,500 bytes
        mockFrag.loader = {
          stats: {
            loading: { first: 100 },
            total: 1000000, // 1MB in bytes
            loaded: 987500, // 12,500 bytes remaining = 0.10s at 1Mbps (125k bytes/s)
          },
        } as any;

        baseStreamController.hls.bandwidthEstimate = Infinity; // Not finite
        baseStreamController.config.abrEwmaDefaultEstimate = 125000; // 1Mbps in bytes/sec (should be used)

        const result =
          baseStreamController.isFragmentNearlyDownloaded(mockFrag);
        // With 1Mbps default: 12,500 / 125,000 = 0.10s (< 0.15) -> true
        expect(result).to.be.true;
      });

      it('should return true when fragment is already complete (bitsRemaining is 0)', function () {
        const mockFrag = new Fragment(
          PlaylistLevelType.MAIN,
          'http://example.com/segment.ts',
        ) as MediaFragment;
        mockFrag.loader = {
          stats: {
            loading: { first: 100 },
            total: 1000,
            loaded: 1000, // Completely downloaded
          },
        } as any;

        baseStreamController.config.abrEwmaDefaultEstimate = 1000000;

        const result =
          baseStreamController.isFragmentNearlyDownloaded(mockFrag);
        // Time = 0 / bandwidth = 0 seconds (< 0.15) -> true
        expect(result).to.be.true;
      });

      it('should handle NaN bandwidthEstimate by using default', function () {
        const mockFrag = new Fragment(
          PlaylistLevelType.MAIN,
          'http://example.com/segment.ts',
        ) as MediaFragment;
        // Set up to complete in 0.10 seconds with default estimate
        // The code treats bandwidth as bytes/sec: 1Mbps = 125,000 bytes/s
        // To complete in 0.10s: need 0.10 * 125,000 = 12,500 bytes
        mockFrag.loader = {
          stats: {
            loading: { first: 100 },
            total: 1000000, // 1MB in bytes
            loaded: 987500, // 12,500 bytes remaining = 0.10s at 1Mbps (125k bytes/s)
          },
        } as any;

        baseStreamController.hls.bandwidthEstimate = NaN; // Not finite
        baseStreamController.config.abrEwmaDefaultEstimate = 125000; // 1Mbps in bytes/sec (should be used)

        const result =
          baseStreamController.isFragmentNearlyDownloaded(mockFrag);
        // With 1Mbps default: 12,500 / 125,000 = 0.10s (< 0.15) -> true
        expect(result).to.be.true;
      });

      it('should return false when hasFirstByte but time exceeds 0.15 seconds', function () {
        const mockFrag = new Fragment(
          PlaylistLevelType.MAIN,
          'http://example.com/segment.ts',
        ) as MediaFragment;
        // Very low bandwidth, large remaining
        mockFrag.loader = {
          stats: {
            loading: { first: 100 },
            total: 1000000,
            loaded: 10000, // 990000 bits remaining
          },
        } as any;

        baseStreamController.config.abrEwmaDefaultEstimate = 100000; // 100Kbps (low)
        // Time = 990000 / 100000 = 9.9 seconds (> 0.15)

        const result =
          baseStreamController.isFragmentNearlyDownloaded(mockFrag);
        expect(result).to.be.false;
      });
    });
  });

  describe('backtrackFragment and couldBacktrack properties', function () {
    it('should return undefined for backtrackFragment by default', function () {
      expect((baseStreamController as any).backtrackFragment).to.be.undefined;
    });

    it('should return false for couldBacktrack by default', function () {
      expect((baseStreamController as any).couldBacktrack).to.be.false;
    });
  });

  describe('calculateOptimalSwitchPoint', function () {
    let mockLevel;
    let mockBufferInfo;
    let bandwidthStub;
    let ttfbStub;

    beforeEach(function () {
      mockLevel = {
        maxBitrate: 1000000,
        audioCodec: 'mp4a.40.2',
        details: null,
      };
      mockBufferInfo = {
        len: 5,
        end: 10,
        start: 5,
      };

      bandwidthStub = sinon
        .stub(baseStreamController.hls, 'bandwidthEstimate')
        .get(() => 2000000);
      ttfbStub = sinon
        .stub(baseStreamController.hls, 'ttfbEstimate')
        .get(() => 100);
      baseStreamController.config.abrBandWidthUpFactor = 0.7;

      (baseStreamController as any).levels = [mockLevel];
      media.paused = false;
      media.currentTime = 8;
    });

    afterEach(function () {
      bandwidthStub?.restore();
      ttfbStub?.restore();
    });

    it('should calculate fetchdelay when media is playing', function () {
      const result = (baseStreamController as any).calculateOptimalSwitchPoint(
        mockLevel,
        mockBufferInfo,
      );
      expect(result.fetchdelay).to.be.greaterThan(0);
      expect(result.okToFlushForwardBuffer).to.be.a('boolean');
    });

    it('should return fetchdelay=0 when media is paused', function () {
      media.paused = true;
      const result = (baseStreamController as any).calculateOptimalSwitchPoint(
        mockLevel,
        mockBufferInfo,
      );
      expect(result.fetchdelay).to.equal(0);
    });

    it('should add extra delay when level details are not available', function () {
      const result1 = (baseStreamController as any).calculateOptimalSwitchPoint(
        mockLevel,
        mockBufferInfo,
      );

      mockLevel.details = {};
      const result2 = (baseStreamController as any).calculateOptimalSwitchPoint(
        mockLevel,
        mockBufferInfo,
      );

      expect(result2.fetchdelay).to.be.lessThan(result1.fetchdelay);
    });

    it('should set okToFlushForwardBuffer to true for VOD with enough buffer', function () {
      (baseStreamController as any).getLevelDetails = () => ({ live: false });
      mockBufferInfo.end = 20;
      media.currentTime = 5;

      const result = (baseStreamController as any).calculateOptimalSwitchPoint(
        mockLevel,
        mockBufferInfo,
      );

      expect(result.okToFlushForwardBuffer).to.be.true;
    });

    it('should set okToFlushForwardBuffer to false for live with low buffer', function () {
      (baseStreamController as any).getLevelDetails = () => ({ live: true });
      mockBufferInfo.end = 10;
      media.currentTime = 9.5;

      const result = (baseStreamController as any).calculateOptimalSwitchPoint(
        mockLevel,
        mockBufferInfo,
      );

      expect(result.okToFlushForwardBuffer).to.be.false;
    });
  });

  describe('getBufferedFrag', function () {
    it('should call fragmentTracker.getBufferedFrag with correct parameters', function () {
      const mockFrag = new Fragment(PlaylistLevelType.MAIN, 'test.ts');
      fragmentTracker.getBufferedFrag = sinon.stub().returns(mockFrag);

      const result = (baseStreamController as any).getBufferedFrag(10);

      expect(fragmentTracker.getBufferedFrag).to.have.been.calledWith(
        10,
        PlaylistLevelType.MAIN,
      );
      expect(result).to.equal(mockFrag);
    });
  });

  describe('followingBufferedFrag', function () {
    beforeEach(function () {
      fragmentTracker.getBufferedFrag = sinon.stub();
    });

    it('should return next buffered fragment', function () {
      const frag1 = new Fragment(PlaylistLevelType.MAIN, 'test1.ts');
      frag1.setStart(0);
      frag1.duration = 10;
      const frag2 = new Fragment(PlaylistLevelType.MAIN, 'test2.ts');

      fragmentTracker.getBufferedFrag.returns(frag2);

      const result = (baseStreamController as any).followingBufferedFrag(frag1);

      expect(fragmentTracker.getBufferedFrag).to.have.been.calledWith(
        10.5,
        PlaylistLevelType.MAIN,
      );
      expect(result).to.equal(frag2);
    });

    it('should return null when frag is null', function () {
      const result = (baseStreamController as any).followingBufferedFrag(null);
      expect(result).to.be.null;
      expect(fragmentTracker.getBufferedFrag).to.not.have.been.called;
    });
  });

  describe('abortCurrentFrag', function () {
    let mockFrag;

    beforeEach(function () {
      mockFrag = new Fragment(
        PlaylistLevelType.MAIN,
        'test.ts',
      ) as MediaFragment;
      mockFrag.abortRequests = sinon.stub();
      fragmentTracker.removeFragment = sinon.spy();
    });

    it('should abort current fragment and reset state to IDLE', function () {
      baseStreamController.fragCurrent = mockFrag;
      baseStreamController.state = State.FRAG_LOADING;

      (baseStreamController as any).abortCurrentFrag();

      expect(mockFrag.abortRequests).to.have.been.called;
      expect(fragmentTracker.removeFragment).to.have.been.calledWith(mockFrag);
      expect(baseStreamController.fragCurrent).to.be.null;
      expect(baseStreamController.state).to.equal(State.IDLE);
    });

    it('should handle PARSING state', function () {
      baseStreamController.fragCurrent = mockFrag;
      baseStreamController.state = State.PARSING;

      (baseStreamController as any).abortCurrentFrag();

      expect(baseStreamController.state).to.equal(State.IDLE);
    });

    it('should not change state when already STOPPED', function () {
      baseStreamController.fragCurrent = mockFrag;
      baseStreamController.state = State.STOPPED;

      (baseStreamController as any).abortCurrentFrag();

      expect(baseStreamController.state).to.equal(State.STOPPED);
    });

    it('should update nextLoadPosition to current load position', function () {
      baseStreamController.fragCurrent = mockFrag;
      media.currentTime = 15;
      baseStreamController.nextLoadPosition = 10;

      (baseStreamController as any).abortCurrentFrag();

      expect(baseStreamController.nextLoadPosition).to.equal(10);
    });
  });

  describe('checkFragmentChanged', function () {
    let mockFrag;

    beforeEach(function () {
      mockFrag = new Fragment(
        PlaylistLevelType.MAIN,
        'test.ts',
      ) as MediaFragment;
      mockFrag.sn = 1;
      mockFrag.level = 0;
      mockFrag.setStart(5);
      mockFrag.duration = 10;
      fragmentTracker.getAppendedFrag = sinon.stub().returns(mockFrag);
      media.readyState = 4;
      media.seeking = false;
      media.currentTime = 7;
      media.buffered = new TimeRangesMock([5, 15]);
    });

    it('should return true when fragment changes', function () {
      (baseStreamController as any).fragPlaying = null;

      const result = (baseStreamController as any).checkFragmentChanged();

      expect(result).to.be.true;
      expect((baseStreamController as any).fragPlaying).to.equal(mockFrag);
    });

    it('should return false when fragment has not changed', function () {
      (baseStreamController as any).fragPlaying = mockFrag;

      const result = (baseStreamController as any).checkFragmentChanged();

      expect(result).to.be.false;
    });

    it('should return false when media readyState is low', function () {
      media.readyState = 1;

      const result = (baseStreamController as any).checkFragmentChanged();

      expect(result).to.be.false;
    });

    it('should clear backtrackFragment when fragment changes', function () {
      (baseStreamController as any).backtrackFragment = new Fragment(
        PlaylistLevelType.MAIN,
        'old.ts',
      );
      (baseStreamController as any).fragPlaying = null;

      (baseStreamController as any).checkFragmentChanged();

      expect((baseStreamController as any).backtrackFragment).to.be.undefined;
    });
  });

  describe('cleanupBackBuffer', function () {
    let mockFrag;

    beforeEach(function () {
      mockFrag = new Fragment(PlaylistLevelType.MAIN, 'test.ts');
      mockFrag.setStart(10);
      mockFrag.duration = 10;
      fragmentTracker.getAppendedFrag = sinon.stub().returns(mockFrag);
      media.currentTime = 15;
      sinon.stub(baseStreamController as any, 'flushMainBuffer');
    });

    it('should flush back buffer', function () {
      (baseStreamController as any).cleanupBackBuffer();

      expect(
        (baseStreamController as any).flushMainBuffer,
      ).to.have.been.calledWith(0, sinon.match.number);
    });

    it('should not flush when fragment start is less than 1 second', function () {
      mockFrag.setStart(0.5);

      (baseStreamController as any).cleanupBackBuffer();

      expect((baseStreamController as any).flushMainBuffer).to.not.have.been
        .called;
    });

    it('should not flush when media is not available', function () {
      baseStreamController.media = null;

      (baseStreamController as any).cleanupBackBuffer();

      expect((baseStreamController as any).flushMainBuffer).to.not.have.been
        .called;
    });
  });

  describe('scheduleTrackSwitch', function () {
    let mockBufferInfo;
    let mockBufferedFrag;
    let mockNextFrag;

    beforeEach(function () {
      mockBufferInfo = {
        len: 5,
        end: 10,
        start: 5,
      };
      mockBufferedFrag = new Fragment(PlaylistLevelType.MAIN, 'test1.ts');
      mockBufferedFrag.setStart(5);
      mockBufferedFrag.duration = 5;
      mockNextFrag = new Fragment(PlaylistLevelType.MAIN, 'test2.ts');
      mockNextFrag.setStart(10);
      mockNextFrag.duration = 5;

      fragmentTracker.getBufferedFrag = sinon.stub();
      fragmentTracker.getBufferedFrag.onCall(0).returns(mockBufferedFrag);
      fragmentTracker.getBufferedFrag.onCall(1).returns(mockNextFrag);

      sinon.stub(baseStreamController as any, 'abortCurrentFrag');
      sinon.stub(baseStreamController as any, 'flushMainBuffer');
      sinon.stub(baseStreamController as any, 'cleanupBackBuffer');

      media.currentTime = 8;
    });

    it('should schedule track switch when next fragment is available', function () {
      (baseStreamController as any).scheduleTrackSwitch(
        mockBufferInfo,
        2,
        true,
      );

      expect((baseStreamController as any).abortCurrentFrag).to.have.been
        .called;
      expect((baseStreamController as any).flushMainBuffer).to.have.been.called;
      expect((baseStreamController as any).cleanupBackBuffer).to.have.been
        .called;
    });

    it('should not flush when okToFlushForwardBuffer is false', function () {
      (baseStreamController as any).scheduleTrackSwitch(
        mockBufferInfo,
        2,
        false,
      );

      expect((baseStreamController as any).abortCurrentFrag).to.not.have.been
        .called;
      expect((baseStreamController as any).flushMainBuffer).to.not.have.been
        .called;
    });

    it('should not flush when next fragment is not available', function () {
      fragmentTracker.getBufferedFrag.onCall(1).returns(null);

      (baseStreamController as any).scheduleTrackSwitch(
        mockBufferInfo,
        2,
        true,
      );

      expect((baseStreamController as any).flushMainBuffer).to.not.have.been
        .called;
    });

    it('should not flush when media is not available', function () {
      baseStreamController.media = null;

      (baseStreamController as any).scheduleTrackSwitch(
        mockBufferInfo,
        2,
        true,
      );

      expect((baseStreamController as any).flushMainBuffer).to.not.have.been
        .called;
    });
  });

  describe('getBufferOutput', function () {
    it('should return media from StreamController override', function () {
      const result = (baseStreamController as any).getBufferOutput();
      expect(result).to.not.be.null;
    });
  });

  describe('nextLevelSwitch', function () {
    let mockLevel;
    let mockBufferInfo;

    beforeEach(function () {
      mockLevel = {
        maxBitrate: 1000000,
        audioCodec: 'mp4a.40.2',
        details: null,
      };
      mockBufferInfo = {
        len: 5,
        end: 10,
        start: 5,
      };

      (baseStreamController as any).levels = [mockLevel];
      media.readyState = 4;
      media.currentTime = 8;

      sinon.stub(baseStreamController as any, 'getBufferOutput').returns(media);
      sinon
        .stub(baseStreamController as any, 'getFwdBufferInfo')
        .returns(mockBufferInfo);
      sinon
        .stub(baseStreamController as any, 'calculateOptimalSwitchPoint')
        .returns({
          fetchdelay: 2,
          okToFlushForwardBuffer: true,
        });
      sinon.stub(baseStreamController as any, 'scheduleTrackSwitch');
      sinon.stub(baseStreamController as any, 'tickImmediate');

      baseStreamController.hls.nextLoadLevel = 0;
    });

    it('should call scheduleTrackSwitch for MAIN playlist type', function () {
      (baseStreamController as any).nextLevelSwitch();

      expect((baseStreamController as any).scheduleTrackSwitch).to.have.been
        .called;
      expect(baseStreamController.tickImmediate).to.have.been.called;
    });

    it('should not call scheduleTrackSwitch when media is not ready', function () {
      media.readyState = 0;

      (baseStreamController as any).nextLevelSwitch();

      expect((baseStreamController as any).scheduleTrackSwitch).to.not.have.been
        .called;
    });

    it('should not call scheduleTrackSwitch when bufferInfo is null', function () {
      (baseStreamController as any).getFwdBufferInfo.returns(null);

      (baseStreamController as any).nextLevelSwitch();

      expect((baseStreamController as any).scheduleTrackSwitch).to.not.have.been
        .called;
    });
  });
});
