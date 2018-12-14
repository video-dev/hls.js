import assert from 'assert';
import sinon from 'sinon';
import Hls from '../../../src/hls';
import BufferController from '../../../src/controller/buffer-controller';

describe('BufferController tests', function () {
  let hls;
  let bufferController;
  let flushSpy;
  let removeStub;
  const sandbox = sinon.sandbox.create();

  beforeEach(function () {
    hls = new Hls({});
    bufferController = new BufferController(hls);
    flushSpy = sandbox.spy(bufferController, 'flushLiveBackBuffer');
    removeStub = sandbox.stub(bufferController, 'removeBufferRange');
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('Live back buffer enforcement', function () {
    let mockMedia;
    let mockSourceBuffer;
    let bufStart;

    beforeEach(function () {
      bufStart = 0;
      bufferController._levelTargetDuration = 10;
      bufferController.media = mockMedia = {
        currentTime: 0
      };
      bufferController.sourceBuffer = mockSourceBuffer = {
        video: {
          buffered: {
            start () {
              return bufStart;
            },
            length: 1
          }
        }
      };
      bufferController._live = true;
      hls.config.liveBackBufferLength = 10;
    });

    it('exits early if not live', function () {
      bufferController.flushLiveBackBuffer();
      assert(removeStub.notCalled);
    });

    it('exits early if liveBackBufferLength is not a finite number, or is less than 0', function () {
      hls.config.liveBackBufferLength = 'foo';
      bufferController.flushLiveBackBuffer();

      hls.config.liveBackBufferLength = -1;
      bufferController.flushLiveBackBuffer();

      assert(removeStub.notCalled);
    });

    it('does not flush if nothing is buffered', function () {
      delete mockSourceBuffer.buffered;
      bufferController.flushLiveBackBuffer();

      mockSourceBuffer = null;
      bufferController.flushLiveBackBuffer();

      assert(removeStub.notCalled);
    });

    it('does not flush if no buffered range intersects with back buffer limit', function () {
      bufStart = 5;
      mockMedia.currentTime = 10;
      bufferController.flushLiveBackBuffer();
      assert(removeStub.notCalled);
    });

    it('does not flush if the liveBackBufferLength is Infinity', function () {
      hls.config.liveBackBufferLength = Infinity;
      mockMedia.currentTime = 15;
      bufferController.flushLiveBackBuffer();
      assert(removeStub.notCalled);
    });

    it('flushes up to the back buffer limit if the buffer intersects with that point', function () {
      mockMedia.currentTime = 15;
      bufferController.flushLiveBackBuffer();
      assert(removeStub.calledOnce);
      assert(!bufferController.flushBufferCounter, 'Should reset the flushBufferCounter');
      assert(removeStub.calledWith('video', mockSourceBuffer.video, 0, 5));
    });

    it('flushes to a max of one targetDuration from currentTime, regardless of liveBackBufferLength', function () {
      mockMedia.currentTime = 15;
      bufferController._levelTargetDuration = 5;
      hls.config.liveBackBufferLength = 0;
      bufferController.flushLiveBackBuffer();
      assert(removeStub.calledWith('video', mockSourceBuffer.video, 0, 10));
    });

    it('should trigger clean back buffer when there are no pending appends', function () {
      bufferController.parent = {};
      bufferController.segments = [{ parent: bufferController.parent }];

      sandbox.stub(bufferController, 'doAppending');

      bufferController.onSBUpdateEnd();

      assert(flushSpy.notCalled, 'clear live back buffer was called');

      bufferController.segments = [];
      bufferController.onSBUpdateEnd();

      assert(flushSpy.calledOnce, 'clear live back buffer was not called once');
    });
  });

  describe('sourcebuffer creation', function () {
    let createSbStub;
    let checkPendingTracksSpy;
    beforeEach(function () {
      createSbStub = sandbox.stub(bufferController, 'createSourceBuffers');
      checkPendingTracksSpy = sandbox.spy(bufferController, 'checkPendingTracks');
      sandbox.stub(bufferController, 'doAppending');
    });

    it('initializes with zero expected BUFFER_CODEC events', function () {
      assert.strictEqual(bufferController.bufferCodecEventsExpected, 0);
    });

    it('expects one bufferCodec event by default', function () {
      bufferController.onManifestParsed({});
      assert.strictEqual(bufferController.bufferCodecEventsExpected, 1);
    });

    it('expects two bufferCodec events if altAudio is signaled', function () {
      bufferController.onManifestParsed({ altAudio: true });
      assert.strictEqual(bufferController.bufferCodecEventsExpected, 2);
    });

    it('creates sourceBuffers when no more BUFFER_CODEC events are expected', function () {
      bufferController.pendingTracks = { video: {} };

      bufferController.checkPendingTracks();
      assert.strictEqual(createSbStub.calledOnce, true);
    });

    it('does not create sourceBuffers when BUFFER_CODEC events are expected', function () {
      bufferController.pendingTracks = { video: {} };
      bufferController.bufferCodecEventsExpected = 1;

      bufferController.checkPendingTracks();
      assert.strictEqual(createSbStub.notCalled, true);
      assert.strictEqual(bufferController.bufferCodecEventsExpected, 1);
    });

    it('checks pending tracks in onMediaSourceOpen', function () {
      bufferController.onMediaSourceOpen();
      assert.strictEqual(checkPendingTracksSpy.calledOnce, true);
    });

    it('does not check pending tracks in onBufferCodecs until called for the expected amount of times', function () {
      bufferController.sourceBuffer = {};
      bufferController.mediaSource = { readyState: 'open' };
      bufferController.bufferCodecEventsExpected = 2;

      bufferController.onBufferCodecs({});
      assert.strictEqual(checkPendingTracksSpy.calledOnce, true);
      assert.strictEqual(bufferController.bufferCodecEventsExpected, 1);

      bufferController.onBufferCodecs({});
      assert.strictEqual(checkPendingTracksSpy.calledTwice, true);
      assert.strictEqual(bufferController.bufferCodecEventsExpected, 0);
    });

    it('creates the expected amount of sourceBuffers given the standard event flow', function () {
      bufferController.sourceBuffer = {};
      bufferController.mediaSource = { readyState: 'open', removeEventListener: sandbox.stub() };

      bufferController.onManifestParsed({ altAudio: true });
      bufferController.onMediaSourceOpen();
      bufferController.onBufferCodecs({ audio: {} });
      bufferController.onBufferCodecs({ video: {} });

      assert.strictEqual(createSbStub.calledOnce, true);
      assert.strictEqual(createSbStub.calledWith({ audio: {}, video: {} }), true);
    });
  });
});
