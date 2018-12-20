import assert from 'assert';
import sinon from 'sinon';
import Hls from '../../../src/hls';
import BufferController from '../../../src/controller/buffer-controller';
import Event from '../../../src/events';
import { logger } from '../../../src/utils/logger';

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
      bufferController._live = null;
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

    it('creates sourceBuffers given valid tracks', function () {
      createSbStub.restore();
      bufferController.sourceBuffer = {};
      bufferController.mediaSource = {
        addSourceBuffer: function () {
          return {
            addEventListener: function () {}
          };
        }
      };
      const hlsTriggerSpy = sandbox.spy(bufferController.hls, 'trigger');

      bufferController.createSourceBuffers({
        audio: { container: 'audio/mp4', codec: 'mp4a.40.29' },
        video: { container: 'video/mp2t', levelCodec: 'avc1.640028' }
      });
      assert.strictEqual(hlsTriggerSpy.args[0][0], Event.BUFFER_CREATED);
    });

    it('triggers ERROR event given wrong MIME type in createSourceBuffers', function () {
      createSbStub.restore();
      bufferController.sourceBuffer = {};
      bufferController.mediaSource = {
        addSourceBuffer: function () {
          throw new Error('NotSupportedError');
        }
      };
      const hlsTriggerSpy = sandbox.spy(bufferController.hls, 'trigger');

      bufferController.createSourceBuffers({
        audio: { container: 'audio/xxx', codec: 'mp4a.40.29' }
      });
      assert.strictEqual(hlsTriggerSpy.args[0][0], Event.ERROR);
    });
  });

  describe('media attaching and detaching', function () {
    it('does not create media source if media unexists when attaching media', function () {
      bufferController.onMediaAttaching({});
      assert.strictEqual(bufferController.mediaSource, undefined);
    });

    it('assigns media src with object url representation of the media source when attaching media', function () {
      const mockMedia = {};

      bufferController.onMediaAttaching({
        media: mockMedia
      });
      assert.strictEqual(typeof mockMedia.src === 'undefined', false);
      assert.strictEqual(mockMedia.src, bufferController._objectUrl);
    });

    it('triggers MEDIA_ATTACHED event if sourceopen event happens on media source when attaching media', function () {
      const hlsTriggerSpy = sandbox.spy(bufferController.hls, 'trigger');

      bufferController.onMediaSourceOpen();
      assert.strictEqual(hlsTriggerSpy.args[0][0], Event.MEDIA_ATTACHED);
    });

    it('removes sourceopen listener if sourceopen event happens on media source when attaching media', function () {
      const removeEventListenerSpy = sandbox.spy();
      bufferController.mediaSource = {
        removeEventListener: removeEventListenerSpy
      };

      bufferController.onMediaSourceOpen();
      assert.strictEqual(removeEventListenerSpy.args[0][0], 'sourceopen');
    });

    it('simply logs if sourceclose or sourceended events happen on media source when attaching media', function () {
      const logSpy = sandbox.spy(logger, 'log');

      bufferController.onMediaSourceClose();
      assert.strictEqual(logSpy.calledOnce, true);
      bufferController.onMediaSourceEnded();
      assert.strictEqual(logSpy.calledTwice, true);
    });

    it('triggers MEDIA_DETACHED event when detaching media', function () {
      const hlsTriggerSpy = sandbox.spy(bufferController.hls, 'trigger');

      bufferController.onMediaDetaching();
      assert.strictEqual(hlsTriggerSpy.args[0][0], Event.MEDIA_DETACHED);
    });

    it('terminates stream and resets media source if media source exists when detaching media', function () {
      const endOfStreamSpy = sandbox.spy();
      bufferController.mediaSource = {
        readyState: 'open',
        endOfStream: endOfStreamSpy,
        removeEventListener: function () {}
      };

      bufferController.onMediaDetaching();
      assert.strictEqual(endOfStreamSpy.calledOnce, true);
      assert.strictEqual(bufferController.mediaSource, null);
    });

    it('does not terminate media stream if media source ready state is not open when detaching media', function () {
      const endOfStreamSpy = sandbox.spy();
      bufferController.mediaSource = {
        readyState: 'closed',
        endOfStream: endOfStreamSpy,
        removeEventListener: function () {}
      };

      bufferController.onMediaDetaching();
      assert.strictEqual(endOfStreamSpy.called, false);
    });

    it('continues to clean other things even if terminating media stream fails when detaching media', function () {
      const endOfStreamSpy = sandbox.spy();
      bufferController.mediaSource = {
        readyState: 'open',
        endOfStream: function () {
          throw new Error('Some source buffer is in updating');
        },
        removeEventListener: function () {}
      };

      bufferController.onMediaDetaching();
      assert.strictEqual(bufferController.mediaSource, null);
    });

    it('cleans up video tag on if it is our own url when detaching media', function () {
      const Blob = window.Blob;
      const objectUrl = window.URL.createObjectURL(new Blob(['xxx']));
      const mockMedia = {
        src: objectUrl,
        removeAttribute: sandbox.spy(),
        load: sandbox.spy()
      };
      const mockMediaSource = {
        readyState: 'open',
        endOfStream: function () {},
        removeEventListener: function () {}
      };
      bufferController.mediaSource = mockMediaSource;
      bufferController._objectUrl = window.URL.createObjectURL(new Blob(['yyy']));
      bufferController.media = mockMedia;

      bufferController.onMediaDetaching();
      assert.strictEqual(mockMedia.load.called, false);

      bufferController.media = mockMedia;
      bufferController.mediaSource = mockMediaSource;
      // make the url to be the same as media src
      bufferController._objectUrl = objectUrl;

      bufferController.onMediaDetaching();
      assert.strictEqual(mockMedia.removeAttribute.args[0][0], 'src');
      assert.strictEqual(mockMedia.load.calledOnce, true);
      assert.strictEqual(bufferController.media, null);
    });
  });
});
