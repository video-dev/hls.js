import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { State } from '../../../src/controller/base-stream-controller';
import { FragmentTracker } from '../../../src/controller/fragment-tracker';
import GapController, {
  SKIP_BUFFER_RANGE_START,
} from '../../../src/controller/gap-controller';
import { ErrorDetails, ErrorTypes } from '../../../src/errors';
import { Events } from '../../../src/events';
import Hls from '../../../src/hls';
import {
  BufferHelper,
  type BufferInfo,
} from '../../../src/utils/buffer-helper';
import { MockMediaElement, MockMediaSource } from '../utils/mock-media';
import type { HlsConfig } from '../../../src/config';
import type StreamController from '../../../src/controller/stream-controller';
import type { Fragment } from '../../../src/loader/fragment';

chai.use(sinonChai);
const expect = chai.expect;

type GapControllerTestable = Omit<GapController, ''> & {
  fragmentTracker: FragmentTracker;
  media: HTMLMediaElement;
  moved: boolean;
  nudgeRetry: number;
  stalled: number;
  stallReported: boolean;
  waiting: number;
  _reportStall(bufferInfo: BufferInfo): void;
  _tryFixBufferStall(bufferInfo: BufferInfo, stalledDurationMs: number): void;
  _tryNudgeBuffer(bufferInfo: BufferInfo): void;
  _trySkipBufferHole(partial: Fragment | null): number;
};

describe('GapController', function () {
  let hls: Hls;
  let streamController: StreamController;
  let config: HlsConfig;
  let gapController: GapControllerTestable;
  let media: HTMLMediaElement;
  let mediaSource: MediaSource;
  let triggerSpy;
  const sandbox = sinon.createSandbox();

  beforeEach(function () {
    hls = new Hls({ debug: true });
    config = hls.config;
    const hlsTestable: any = hls;
    for (let i = hlsTestable.networkControllers.length; i--; ) {
      const component = hlsTestable.networkControllers[i];
      if (component !== (hls as any).streamController) {
        component.destroy();
        hlsTestable.networkControllers.splice(i, 1);
      }
    }
    hlsTestable.coreComponents.forEach((component) => component.destroy());
    hlsTestable.coreComponents.length = 0;
    media = new MockMediaElement() as unknown as HTMLMediaElement;
    mediaSource = new MockMediaSource() as unknown as MediaSource;
    streamController = (hls as any).streamController;
    streamController.state = State.IDLE;
    gapController = new GapController(
      hls,
      new FragmentTracker(hls as Hls),
    ) as unknown as GapControllerTestable;
    hls.trigger(Events.MEDIA_ATTACHING, { media });
    hls.trigger(Events.MEDIA_ATTACHED, {
      media,
      mediaSource,
    });
    triggerSpy = sinon.spy(hls, 'trigger');
  });

  afterEach(function () {
    sandbox.restore();
    hls.destroy();
  });

  describe('_tryNudgeBuffer', function () {
    const bufferInfo = BufferHelper.bufferedInfo([{ start: 0, end: 10 }], 0, 0);
    it('should increment the currentTime by a multiple of nudgeRetry and the configured nudge amount', function () {
      for (let i = 0; i < config.nudgeMaxRetry; i++) {
        triggerSpy.resetHistory();

        const expected = media.currentTime + (i + 1) * config.nudgeOffset;
        gapController._tryNudgeBuffer(bufferInfo);
        expect(media.currentTime).to.equal(expected);

        expect(triggerSpy).to.have.been.calledWith(Events.ERROR, {
          type: ErrorTypes.MEDIA_ERROR,
          details: ErrorDetails.BUFFER_NUDGE_ON_STALL,
          fatal: false,
          error: triggerSpy.getCall(0).lastArg.error,
          buffer: bufferInfo.len,
          bufferInfo,
        });
      }

      triggerSpy.resetHistory();
      gapController._tryNudgeBuffer(bufferInfo);

      expect(triggerSpy).not.to.have.been.calledWith(Events.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.BUFFER_NUDGE_ON_STALL,
        fatal: false,
      });
    });

    it('should not increment the currentTime if the max amount of nudges has been attempted', function () {
      config.nudgeMaxRetry = 0;
      gapController._tryNudgeBuffer(bufferInfo);
      expect(media.currentTime).to.equal(0);
      expect(triggerSpy).to.have.been.called;
      expect(triggerSpy).to.have.been.calledWith(Events.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.BUFFER_STALLED_ERROR,
        fatal: true,
        error: triggerSpy.getCall(0).lastArg.error,
        buffer: bufferInfo.len,
        bufferInfo,
      });
    });
  });

  describe('_reportStall', function () {
    it('should report a stall with the current buffer length if it has not already been reported', function () {
      const bufferInfo = BufferHelper.bufferedInfo(
        [{ start: 0, end: 42 }],
        0,
        0,
      );
      gapController.stalled = 456;
      gapController._reportStall(bufferInfo);
      expect(triggerSpy).to.have.been.calledWith(Events.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.BUFFER_STALLED_ERROR,
        fatal: false,
        error: triggerSpy.getCall(0).lastArg.error,
        buffer: 42,
        bufferInfo,
        stalled: { start: 456 },
      });
    });

    it('should not report a stall if it was already reported', function () {
      const bufferInfo = BufferHelper.bufferedInfo(
        [{ start: 0, end: 42 }],
        0,
        0,
      );
      gapController.stallReported = true;
      gapController.stalled = 456;
      gapController._reportStall(bufferInfo);
      expect(triggerSpy).to.not.have.been.called;
    });
  });

  describe('_tryFixBufferStall', function () {
    it('should nudge when stalling close to the buffer end with multiple ranges', function () {
      const bufferInfo = BufferHelper.bufferedInfo(
        [
          { start: 0, end: 4 },
          { start: 4.1, end: 8 },
        ],
        0,
        0,
      );
      const mockStallDuration = (config.highBufferWatchdogPeriod + 1) * 1000;
      const nudgeStub = sandbox.stub(gapController, '_tryNudgeBuffer');
      gapController._tryFixBufferStall(bufferInfo, mockStallDuration);
      expect(nudgeStub).to.have.been.calledOnce;
    });

    it('should not nudge when briefly stalling close to the buffer end', function () {
      const bufferInfo = BufferHelper.bufferedInfo(
        [{ start: 0, end: 1 }],
        0,
        0,
      );
      const mockStallDuration = (config.highBufferWatchdogPeriod / 2) * 1000;
      const nudgeStub = sandbox.stub(gapController, '_tryNudgeBuffer');
      gapController._tryFixBufferStall(bufferInfo, mockStallDuration);
      expect(nudgeStub).to.have.not.been.called;
    });

    it('should not nudge when too far from the buffer end', function () {
      const bufferInfo = BufferHelper.bufferedInfo(
        [{ start: 0, end: 0.09 }],
        0,
        0,
      );
      const mockStallDuration = (config.highBufferWatchdogPeriod + 1) * 1000;
      const nudgeStub = sandbox.stub(gapController, '_tryNudgeBuffer');
      gapController._tryFixBufferStall(bufferInfo, mockStallDuration);
      expect(nudgeStub).to.have.not.been.called;
    });

    it('should try to jump partial fragments when detected', function () {
      const bufferInfo = BufferHelper.bufferedInfo([], 0, 0);
      sandbox
        .stub(gapController.fragmentTracker, 'getPartialFragment')
        .returns({} as unknown as Fragment);
      const skipHoleStub = sandbox.stub(gapController, '_trySkipBufferHole');
      gapController._tryFixBufferStall(bufferInfo, 100);
      expect(skipHoleStub).to.have.been.calledOnce;
    });

    it('should not try to jump partial fragments when none are detected', function () {
      const bufferInfo = BufferHelper.bufferedInfo([], 0, 0);
      sandbox
        .stub(gapController.fragmentTracker, 'getPartialFragment')
        .returns(null);
      const skipHoleStub = sandbox.stub(gapController, '_trySkipBufferHole');
      gapController._tryFixBufferStall(bufferInfo, 100);
      expect(skipHoleStub).to.have.not.been.called;
    });
  });

  describe('media clock polling', function () {
    const TIMER_STEP_MS = 1234;
    const STALL_HANDLING_RETRY_PERIOD_MS = 1000;

    let mockMedia;
    let mockTimeRanges;
    let mockTimeRangesData;
    let reportStallSpy;
    let lastCurrentTime;
    let isStalling;
    let wallClock;

    beforeEach(function () {
      wallClock = sandbox.useFakeTimers(0);
      isStalling = false;
      mockTimeRangesData = [
        [0.1, 0.2],
        [0.4, 0.5],
      ];
      mockTimeRanges = {
        get length() {
          return mockTimeRangesData.length;
        },
        start(index) {
          return mockTimeRangesData[index][0];
        },
        end(index) {
          return mockTimeRangesData[index][1];
        },
      };

      // by default the media
      // is setup in a "playable" state
      // note that the initial current time
      // is within the range of buffered data info
      mockMedia = new MockMediaElement();
      Object.assign(mockMedia, {
        currentTime: 0,
        paused: false,
        seeking: false,
        buffered: mockTimeRanges,
      });

      gapController.media = mockMedia;
      reportStallSpy = sandbox.spy(gapController, '_reportStall');
    });

    // tickMediaClock emulates the behavior
    // of our external polling schedule
    // which would progress as the media clock
    // is altered (or not)
    // when isStalling is false the media clock
    // will not progress while the poll call is done
    function tickMediaClock(incrementSec = 0.1) {
      lastCurrentTime = mockMedia.currentTime;
      if (!isStalling) {
        mockMedia.currentTime += incrementSec;
        gapController.waiting = 0;
      }
      gapController.poll(lastCurrentTime, mockMedia.currentTime);
    }

    function setStalling() {
      gapController.moved = true;
      mockMedia.paused = false;
      mockMedia.currentTime = 4;
      mockTimeRangesData.length = 1;
      mockTimeRangesData[0] = [0, 10];
      lastCurrentTime = 4;
    }

    function setNotStalling() {
      gapController.moved = true;
      mockMedia.paused = false;
      mockMedia.currentTime = 5;
      mockTimeRangesData.length = 1;
      mockTimeRangesData[0] = [0, 10];
      lastCurrentTime = 4;
    }

    it('should try to fix a stall if expected to be playing', function () {
      const fixStallStub = sandbox.stub(gapController, '_tryFixBufferStall');
      setStalling();
      gapController.poll(lastCurrentTime, mockMedia.currentTime);

      // The first poll call made while stalling just sets stall flags
      expect(gapController.stalled).to.be.a('number');
      expect(gapController.stallReported).to.be.false;

      gapController.poll(lastCurrentTime, mockMedia.currentTime);
      expect(fixStallStub).to.have.been.calledOnce;
    });

    it('should reset stall flags when no longer stalling', function () {
      setNotStalling();
      gapController.stallReported = true;
      gapController.nudgeRetry = 1;
      gapController.stalled = 4200;
      const fixStallStub = sandbox.stub(gapController, '_tryFixBufferStall');
      gapController.poll(lastCurrentTime, mockMedia.currentTime);

      expect(gapController.stalled).to.not.exist;
      expect(gapController.nudgeRetry).to.equal(0);
      expect(gapController.stallReported).to.be.false;
      expect(fixStallStub).to.not.have.been.called;
    });

    it('should not detect stalls when ended, unbuffered or seeking', function () {
      wallClock.tick(TIMER_STEP_MS);

      // we need to play a bit to get past the moved check
      tickMediaClock();

      isStalling = true;
      mockMedia.ended = true;

      tickMediaClock();
      expect(gapController.stalled).to.equal(null, 'ended');
      wallClock.tick(2 * STALL_HANDLING_RETRY_PERIOD_MS);

      mockMedia.ended = false;
      mockTimeRangesData.length = 0;

      tickMediaClock();
      expect(gapController.stalled).to.equal(null, 'empty buffer');
      wallClock.tick(2 * STALL_HANDLING_RETRY_PERIOD_MS);

      mockTimeRangesData = [
        [0.1, 0.2],
        [0.4, 0.5],
      ];
      mockMedia.seeking = true;

      // tickMediaClock(100)
      expect(gapController.stalled).to.equal(null, 'seeking');
      wallClock.tick(2 * STALL_HANDLING_RETRY_PERIOD_MS);
    });

    it('should not detect stalls when loading an earlier fragment while seeking', function () {
      wallClock.tick(2 * STALL_HANDLING_RETRY_PERIOD_MS);
      mockMedia.currentTime += 0.1;
      gapController.poll(0, mockMedia.currentTime);
      expect(gapController.stalled).to.equal(null, 'buffered start');

      wallClock.tick(2 * STALL_HANDLING_RETRY_PERIOD_MS);
      mockMedia.currentTime += 5;
      mockMedia.seeking = true;
      mockTimeRangesData.length = 1;
      mockTimeRangesData[0] = [5.5, 10];
      gapController.poll(mockMedia.currentTime - 5, mockMedia.currentTime);
      expect(gapController.stalled).to.equal(null, 'new seek position');

      wallClock.tick(2 * STALL_HANDLING_RETRY_PERIOD_MS);
      streamController.state = State.FRAG_LOADING;
      (streamController as any).fragCurrent = {
        start: 5,
      } as unknown as Fragment;
      gapController.poll(mockMedia.currentTime, mockMedia.currentTime);
      expect(gapController.stalled).to.equal(
        null,
        'seeking while loading fragment',
      );
    });

    it('should trigger reportStall when stalling for `detectStallWithCurrentTimeMs` or longer', function () {
      setStalling();
      wallClock.tick(250);
      gapController.stalled = 1;
      gapController.poll(lastCurrentTime, mockMedia.currentTime);
      expect(reportStallSpy).to.not.have.been.called;
      wallClock.tick(config.detectStallWithCurrentTimeMs + 1);
      gapController.poll(lastCurrentTime, mockMedia.currentTime);
      expect(reportStallSpy).to.have.been.calledOnce;
    });

    it('should trigger reportStall when stalling for after waiting event', function () {
      setStalling();
      wallClock.tick(250);
      gapController.stalled = 1;
      gapController.poll(lastCurrentTime, mockMedia.currentTime);
      expect(reportStallSpy).to.not.have.been.called;
      gapController.waiting = 250;
      wallClock.tick(1);
      gapController.poll(lastCurrentTime, mockMedia.currentTime);
      expect(reportStallSpy).to.have.been.calledOnce;
    });

    it('should not handle a stall (clock not advancing) when media has played before and is now paused', function () {
      wallClock.tick(TIMER_STEP_MS);

      tickMediaClock();

      expect(gapController.moved).to.equal(true);
      expect(gapController.stalled).to.equal(null);

      mockMedia.paused = true;
      isStalling = true;

      tickMediaClock();

      expect(gapController.stalled).to.equal(null);

      mockMedia.paused = false;

      tickMediaClock();

      expect(gapController.stalled).to.equal(TIMER_STEP_MS);
    });

    it('should skip any initial gap before playing on the second poll (so that Chrome can jump the gap first)', function () {
      wallClock.tick(TIMER_STEP_MS);

      mockMedia.currentTime = 0;

      isStalling = true;

      tickMediaClock();

      expect(gapController.moved).to.equal(false);
      expect(gapController.stalled).to.equal(1234);
      expect(mockMedia.currentTime).to.equal(0);

      tickMediaClock();

      expect(gapController.moved).to.equal(true);
      expect(gapController.stalled).to.equal(1234);
      expect(mockMedia.currentTime).to.equal(0.1 + SKIP_BUFFER_RANGE_START);
    });

    it('should skip any initial gap when not having played yet on second poll', function () {
      mockMedia.currentTime = 0;
      mockTimeRangesData = [[0.9, 10]];
      gapController.poll(0, mockMedia.currentTime);
      gapController.poll(0, mockMedia.currentTime);
      expect(mockMedia.currentTime).to.equal(0.9 + SKIP_BUFFER_RANGE_START);
    });
  });
});
