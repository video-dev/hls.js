import assert from 'assert';
import sinon from 'sinon';

import Hls from '../../../src/hls';

import StreamController from '../../../src/controller/stream-controller';
import { FragmentTracker } from '../../../src/controller/fragment-tracker';

import Event from '../../../src/events';

import { ErrorTypes, ErrorDetails } from '../../../src/errors';

describe('checkBuffer', function () {
  let streamController;
  let config;
  let media;
  let triggerSpy;
  const sandbox = sinon.sandbox.create();

  beforeEach(function () {
    media = document.createElement('video');
    const hls = new Hls({});
    const fragmentTracker = new FragmentTracker(hls);
    streamController = new StreamController(hls, fragmentTracker);
    streamController.media = media;
    config = hls.config;
    triggerSpy = sinon.spy(hls, 'trigger');
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('_tryNudgeBuffer', function () {
    it('should increment the currentTime by a multiple of nudgeRetry and the configured nudge amount', function () {
      for (let i = 1; i < config.nudgeMaxRetry; i++) {
        let expected = media.currentTime + (i * config.nudgeOffset);
        streamController._tryNudgeBuffer();
        assert.strictEqual(expected, media.currentTime);
      }
      assert(triggerSpy.alwaysCalledWith(Event.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.BUFFER_NUDGE_ON_STALL,
        fatal: false
      }));
    });

    it('should not increment the currentTime if the max amount of nudges has been attempted', function () {
      config.nudgeMaxRetry = 0;
      streamController._tryNudgeBuffer();
      assert.strictEqual(0, media.currentTime);
      assert(triggerSpy.calledWith(Event.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.BUFFER_STALLED_ERROR,
        fatal: true
      }));
    });
  });

  describe('_reportStall', function () {
    it('should report a stall with the current buffer length if it has not already been reported', function () {
      streamController._reportStall(42);
      assert(triggerSpy.calledWith(Event.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.BUFFER_STALLED_ERROR,
        fatal: false,
        buffer: 42
      }));
    });

    it('should not report a stall if it was already reported', function () {
      streamController.stallReported = true;
      streamController._reportStall(42);
      assert(triggerSpy.notCalled);
    });
  });

  describe('_tryFixBufferStall', function () {
    it('should nudge when stalling close to the buffer end', function () {
      const mockBufferInfo = { len: 1 };
      const mockStallDuration = (config.highBufferWatchdogPeriod + 1) * 1000;
      const nudgeStub = sandbox.stub(streamController, '_tryNudgeBuffer');
      streamController._tryFixBufferStall(mockBufferInfo, mockStallDuration);
      assert(nudgeStub.calledOnce);
    });

    it('should not nudge when briefly stalling close to the buffer end', function () {
      const mockBufferInfo = { len: 1 };
      const mockStallDuration = (config.highBufferWatchdogPeriod / 2) * 1000;
      const nudgeStub = sandbox.stub(streamController, '_tryNudgeBuffer');
      streamController._tryFixBufferStall(mockBufferInfo, mockStallDuration);
      assert(nudgeStub.notCalled);
    });

    it('should not nudge when too far from the buffer end', function () {
      const mockBufferInfo = { len: 0.25 };
      const mockStallDuration = (config.highBufferWatchdogPeriod + 1) * 1000;
      const nudgeStub = sandbox.stub(streamController, '_tryNudgeBuffer');
      streamController._tryFixBufferStall(mockBufferInfo, mockStallDuration);
      assert(nudgeStub.notCalled);
    });

    it('should try to jump partial fragments when detected', function () {
      sandbox.stub(streamController.fragmentTracker, 'getPartialFragment').returns({});
      const skipHoleStub = sandbox.stub(streamController, '_trySkipBufferHole');
      streamController._tryFixBufferStall({ len: 0 });
      assert(skipHoleStub.calledOnce);
    });

    it('should not try to jump partial fragments when none are detected', function () {
      sandbox.stub(streamController.fragmentTracker, 'getPartialFragment').returns(null);
      const skipHoleStub = sandbox.stub(streamController, '_trySkipBufferHole');
      streamController._tryFixBufferStall({ len: 0 });
      assert(skipHoleStub.notCalled);
    });
  });

  describe('_seekToStartPos', function () {
    it('should seek to startPosition when startPosition is not buffered & the media is not seeking', function () {
      streamController.startPosition = 5;
      streamController._seekToStartPos();
      assert.strictEqual(5, media.currentTime);
    });

    it('should not seek to startPosition when it is buffered', function () {
      streamController.startPosition = 5;
      media.currentTime = 5;
      streamController._seekToStartPos();
      assert.strictEqual(5, media.currentTime);
    });
  });

  describe('_checkBuffer', function () {
    let mockMedia;
    let reportStallSpy;
    beforeEach(function () {
      mockMedia = {
        readyState: 1,
        buffered: {
          length: 1
        }
      };
      streamController.media = mockMedia;
      reportStallSpy = sandbox.spy(streamController, '_reportStall');
    });

    function setExpectedPlaying () {
      streamController.loadedmetadata = true;
      streamController.immediateSwitch = false;
      mockMedia.paused = false;
      mockMedia.readyState = 4;
      mockMedia.currentTime = 4;
      streamController.lastCurrentTime = 4;
    }

    it('should not throw when media is undefined', function () {
      streamController.media = null;
      streamController._checkBuffer();
    });

    it('should seek to start pos when metadata has not yet been loaded', function () {
      const seekStub = sandbox.stub(streamController, '_seekToStartPos');
      streamController._checkBuffer();
      assert(seekStub.calledOnce);
      assert(streamController.loadedmetadata);
    });

    it('should not seek to start pos when metadata has been loaded', function () {
      const seekStub = sandbox.stub(streamController, '_seekToStartPos');
      streamController.loadedmetadata = true;
      streamController._checkBuffer();
      assert(seekStub.notCalled);
      assert(streamController.loadedmetadata);
    });

    it('should not seek to start pos when nothing has been buffered', function () {
      const seekStub = sandbox.stub(streamController, '_seekToStartPos');
      mockMedia.buffered.length = 0;
      streamController._checkBuffer();
      assert(seekStub.notCalled);
      assert.strictEqual(streamController.loadedmetadata, undefined);
    });

    it('should complete the immediate switch if signalled', function () {
      const levelSwitchStub = sandbox.stub(streamController, 'immediateLevelSwitchEnd');
      streamController.loadedmetadata = true;
      streamController.immediateSwitch = true;
      streamController._checkBuffer();
      assert(levelSwitchStub.called);
    });

    it('should try to fix a stall if expected to be playing', function () {
      const fixStallStub = sandbox.stub(streamController, '_tryFixBufferStall');
      setExpectedPlaying();
      streamController._checkBuffer();

      // The first _checkBuffer call made while stalling just sets stall flags
      assert.strictEqual(typeof streamController.stalled, 'number');
      assert.equal(streamController.stallReported, false);

      streamController._checkBuffer();
      assert(fixStallStub.calledOnce);
    });

    it('should reset stall flags when no longer stalling', function () {
      streamController.loadedmetadata = true;
      streamController.stallReported = true;
      streamController.nudgeRetry = 1;
      streamController.stalled = 4200;
      streamController.lastCurrentTime = 1;
      const fixStallStub = sandbox.stub(streamController, '_tryFixBufferStall');
      streamController._checkBuffer();

      assert.strictEqual(streamController.stalled, null);
      assert.strictEqual(streamController.nudgeRetry, 0);
      assert.strictEqual(streamController.stallReported, false);
      assert(fixStallStub.notCalled);
    });

    it('should trigger reportStall when stalling for 1 second or longer', function () {
      setExpectedPlaying();
      const clock = sandbox.useFakeTimers(0);
      clock.tick(1000);
      streamController.stalled = 1;
      streamController._checkBuffer();
      assert(reportStallSpy.notCalled);
      clock.tick(1001);
      streamController._checkBuffer();
      assert(reportStallSpy.calledOnce);
    });
  });
});
