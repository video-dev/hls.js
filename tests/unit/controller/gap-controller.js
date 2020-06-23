import sinon from 'sinon';

import Hls from '../../../src/hls';

import GapController, { STALL_MINIMUM_DURATION_MS, SKIP_BUFFER_RANGE_START } from '../../../src/controller/gap-controller';
import { FragmentTracker } from '../../../src/controller/fragment-tracker';

import Event from '../../../src/events';

import { ErrorTypes, ErrorDetails } from '../../../src/errors';

describe('GapController', function () {
  let gapController;
  let config;
  let media;
  let triggerSpy;
  const sandbox = sinon.createSandbox();

  beforeEach(function () {
    const hls = new Hls({});
    media = document.createElement('video');
    config = hls.config;
    gapController = new GapController(config, media, new FragmentTracker(hls), hls);
    triggerSpy = sinon.spy(hls, 'trigger');
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('_tryNudgeBuffer', function () {
    it('should increment the currentTime by a multiple of nudgeRetry and the configured nudge amount', function () {
      for (let i = 1; i < config.nudgeMaxRetry; i++) {
        let expected = media.currentTime + (i * config.nudgeOffset);
        gapController._tryNudgeBuffer();
        expect(media.currentTime).to.equal(expected);
      }

      expect(triggerSpy).to.have.been.calledWith(Event.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.BUFFER_NUDGE_ON_STALL,
        fatal: false
      });
    });

    it('should not increment the currentTime if the max amount of nudges has been attempted', function () {
      config.nudgeMaxRetry = 0;
      gapController._tryNudgeBuffer();
      expect(media.currentTime).to.equal(0);
      expect(triggerSpy).to.have.been.calledWith(Event.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.BUFFER_STALLED_ERROR,
        fatal: true
      });
    });
  });

  describe('_reportStall', function () {
    it('should report a stall with the current buffer length if it has not already been reported', function () {
      gapController._reportStall(42);
      expect(triggerSpy).to.have.been.calledWith(Event.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.BUFFER_STALLED_ERROR,
        fatal: false,
        buffer: 42
      });
    });

    it('should not report a stall if it was already reported', function () {
      gapController.stallReported = true;
      gapController._reportStall(42);
      expect(triggerSpy).to.not.have.been.called;
    });
  });

  describe('_tryFixBufferStall', function () {
    it('should nudge when stalling close to the buffer end', function () {
      const mockBufferInfo = { len: 1 };
      const mockStallDuration = (config.highBufferWatchdogPeriod + 1) * 1000;
      const nudgeStub = sandbox.stub(gapController, '_tryNudgeBuffer');
      gapController._tryFixBufferStall(mockBufferInfo, mockStallDuration);
      expect(nudgeStub).to.have.been.calledOnce;
    });

    it('should not nudge when briefly stalling close to the buffer end', function () {
      const mockBufferInfo = { len: 1 };
      const mockStallDuration = (config.highBufferWatchdogPeriod / 2) * 1000;
      const nudgeStub = sandbox.stub(gapController, '_tryNudgeBuffer');
      gapController._tryFixBufferStall(mockBufferInfo, mockStallDuration);
      expect(nudgeStub).to.have.not.been.called;
    });

    it('should not nudge when too far from the buffer end', function () {
      const mockBufferInfo = { len: 0.25 };
      const mockStallDuration = (config.highBufferWatchdogPeriod + 1) * 1000;
      const nudgeStub = sandbox.stub(gapController, '_tryNudgeBuffer');
      gapController._tryFixBufferStall(mockBufferInfo, mockStallDuration);
      expect(nudgeStub).to.have.not.been.called;
    });

    it('should try to jump partial fragments when detected', function () {
      sandbox.stub(gapController.fragmentTracker, 'getPartialFragment').returns({});
      const skipHoleStub = sandbox.stub(gapController, '_trySkipBufferHole');
      gapController._tryFixBufferStall({ len: 0 });
      expect(skipHoleStub).to.have.been.calledOnce;
    });

    it('should not try to jump partial fragments when none are detected', function () {
      sandbox.stub(gapController.fragmentTracker, 'getPartialFragment').returns(null);
      const skipHoleStub = sandbox.stub(gapController, '_trySkipBufferHole');
      gapController._tryFixBufferStall({ len: 0 });
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
      mockTimeRangesData = [[0.1, 0.2], [0.4, 0.5]];
      mockTimeRanges = {
        length: mockTimeRangesData.length,
        start (index) {
          return mockTimeRangesData[index][0];
        },
        end (index) {
          return mockTimeRangesData[index][1];
        }
      };

      // by default the media
      // is setup in a "playable" state
      // note that the initial current time
      // is within the range of buffered data info
      mockMedia = {
        currentTime: 0,
        paused: false,
        seeking: false,
        readyState: 4,
        buffered: mockTimeRanges,
        addEventListener () {}
      };

      gapController.media = mockMedia;
      reportStallSpy = sandbox.spy(gapController, '_reportStall');
    });

    // tickMediaClock emulates the behavior
    // of our external polling schedule
    // which would progress as the media clock
    // is altered (or not)
    // when isStalling is false the media clock
    // will not progress while the poll call is done
    function tickMediaClock (incrementSec = 0.1) {
      lastCurrentTime = mockMedia.currentTime;
      if (!isStalling) {
        mockMedia.currentTime += incrementSec;
      }
      gapController.poll(lastCurrentTime);
    }

    it('should progress internally as specified to handle a stalled playable media properly as wall clock advances', function () {
      wallClock.tick(TIMER_STEP_MS);

      const fixStallStub = sandbox.stub(gapController, '_tryFixBufferStall');

      expect(gapController.moved).to.equal(false);

      // we need to play a bit to get past the moved check
      tickMediaClock();
      // check the moved flag has turned true
      expect(gapController.moved).to.equal(true);

      // check that stall detection flags are still reset
      expect(gapController.stalled).to.equal(null);
      expect(gapController.stallReported).to.equal(false);

      // set stalling and tick media again
      isStalling = true;
      tickMediaClock();

      // check that stall has been detected
      expect(gapController.stalled).to.equal(TIMER_STEP_MS);
      // check that stall has not been flagged reported
      expect(gapController.stallReported).to.equal(false);

      expect(reportStallSpy).to.not.have.been.called;
      expect(fixStallStub).to.not.have.been.called;

      wallClock.tick(STALL_MINIMUM_DURATION_MS / 2);
      tickMediaClock();

      // if stall was only sustained for below min duration, flags should be unchanged
      // and no stall reported yet
      expect(gapController.stalled).to.equal(TIMER_STEP_MS);
      expect(gapController.stallReported).to.equal(false);
      // nudge is attempted
      expect(fixStallStub).to.have.been.calledOnce;

      // more polling calls may happen without sys clock changing necessarily
      tickMediaClock();
      // nudge is attempted
      expect(fixStallStub).to.have.been.calledTwice;

      tickMediaClock();

      // if stall was only sustained for below min duration, flags should be unchanged
      // and no stall reported yet
      expect(gapController.stalled).to.equal(TIMER_STEP_MS);
      expect(gapController.stallReported).to.equal(false);
      // nudge is attempted
      expect(fixStallStub).to.have.been.calledThrice;

      // advance wall clock above threshold and tick media clock
      wallClock.tick(STALL_MINIMUM_DURATION_MS / 2);
      tickMediaClock();

      // now more time has passed than the min stall duration
      // which is threshold for reporting
      // initial detection time is unchanged
      expect(gapController.stalled).to.equal(TIMER_STEP_MS);
      expect(gapController.stallReported).to.equal(true);
      expect(reportStallSpy).to.have.been.calledOnce;
      expect(fixStallStub).to.have.callCount(4);

      tickMediaClock();
      tickMediaClock();
      wallClock.tick(STALL_HANDLING_RETRY_PERIOD_MS / 2);
      tickMediaClock();

      expect(reportStallSpy).to.have.been.callCount(4);
      expect(fixStallStub).to.have.callCount(7);

      wallClock.tick(STALL_HANDLING_RETRY_PERIOD_MS / 2);
      tickMediaClock();

      expect(reportStallSpy).to.have.been.callCount(5);
      expect(fixStallStub).to.have.callCount(8);
    });

    it('should reset stall flags when no longer stalling', function () {
      gapController.stallReported = true;
      gapController.nudgeRetry = 1;
      gapController.stalled = 4200;

      const fixStallStub = sandbox.stub(gapController, '_tryFixBufferStall');

      gapController.poll(lastCurrentTime);

      expect(gapController.stalled).to.equal(null);
      expect(gapController.nudgeRetry).to.equal(0);
      expect(gapController.stallReported).to.equal(false);

      expect(reportStallSpy).to.have.not.been.called;

      expect(fixStallStub).to.have.not.been.called;
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
      mockMedia.buffered.length = 0;

      tickMediaClock();
      expect(gapController.stalled).to.equal(null, 'empty buffer');
      wallClock.tick(2 * STALL_HANDLING_RETRY_PERIOD_MS);

      mockMedia.buffered.length = mockTimeRangesData.length;
      mockMedia.seeking = true;

      // tickMediaClock(100)
      expect(gapController.stalled).to.equal(null, 'seeking');
      wallClock.tick(2 * STALL_HANDLING_RETRY_PERIOD_MS);
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
      expect(gapController.stalled).to.equal(null);
      expect(mockMedia.currentTime).to.equal(0.1 + SKIP_BUFFER_RANGE_START);
    });
  });
});
