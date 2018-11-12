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
});
