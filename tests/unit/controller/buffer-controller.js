import assert from 'assert';
import { stub } from 'sinon';
import Hls from '../../../src/hls';
import BufferController from '../../../src/controller/buffer-controller';

describe('BufferController tests', function () {
  let hls;
  let bufferController;

  beforeEach(function () {
    hls = new Hls({});

    bufferController = new BufferController(hls);
  });

  describe('Live back buffer enforcement', () => {
    it('should trigger clean back buffer when there are no pending appends', () => {
      bufferController.parent = {};
      bufferController.segments = [{ parent: bufferController.parent }];

      let clearStub = stub(bufferController, 'clearLiveBackBuffer');
      stub(bufferController, 'doAppending');

      bufferController.onSBUpdateEnd();

      assert(clearStub.notCalled, 'clear live back buffer was called');

      bufferController.segments = [];
      bufferController.onSBUpdateEnd();

      assert(clearStub.calledOnce, 'clear live back buffer was not called once');
    });

    it('should trigger buffer removal with valid range for live', () => {
      bufferController.media = { currentTime: 360 };
      hls.config.liveBackBufferLength = 60;
      bufferController.sourceBuffer = {
        video: {
          buffered: {
            start: stub().withArgs(0).returns(120),
            length: 1
          }
        }
      };

      let removeBufferRangeStub = stub(bufferController, 'removeBufferRange');

      bufferController._live = false;
      bufferController.clearLiveBackBuffer();
      assert(removeBufferRangeStub.notCalled, 'remove buffer range was called for non-live');

      bufferController._live = true;
      bufferController.clearLiveBackBuffer();
      assert(removeBufferRangeStub.calledOnce, 'remove buffer range was not called once');

      assert(
        removeBufferRangeStub.calledWith(
          'video',
          bufferController.sourceBuffer.video,
          0,
          bufferController.media.currentTime - hls.config.liveBackBufferLength
        ),
        'remove buffer range was not requested with valid data from liveBackBufferLength'
      );

      hls.config.liveBackBufferLength = 0;
      bufferController._levelTargetDuration = 10;
      bufferController.clearLiveBackBuffer();
      assert(
        removeBufferRangeStub.calledWith(
          'video',
          bufferController.sourceBuffer.video,
          0,
          bufferController.media.currentTime - bufferController._levelTargetDuration
        ),
        'remove buffer range was not requested with valid data from _levelTargetDuration'
      );
    });
  });
});
