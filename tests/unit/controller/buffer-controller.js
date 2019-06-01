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

  describe('onBufferFlushing', function () {
    it('flushes a specific type when provided a type', function () {
      const spy = sandbox.spy(bufferController, 'flushBuffer');
      bufferController.onBufferFlushing({ startOffset: 0, endOffset: 10, type: 'video' });
      expect(spy).to.have.been.calledOnce;
    });

    it('flushes all source buffers when buffer flush event type is undefined', function () {
      const spy = sandbox.spy(bufferController, 'flushBuffer');

      bufferController.onBufferFlushing({ startOffset: 0, endOffset: 10 });
      expect(spy).to.have.been.calledTwice;
    });
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
      expect(removeStub).to.not.have.been.called;
    });

    it('exits early if liveBackBufferLength is not a finite number, or is less than 0', function () {
      hls.config.liveBackBufferLength = 'foo';
      bufferController.flushLiveBackBuffer();

      hls.config.liveBackBufferLength = -1;
      bufferController.flushLiveBackBuffer();

      expect(removeStub).to.not.have.been.called;
    });

    it('does not flush if nothing is buffered', function () {
      delete mockSourceBuffer.buffered;
      bufferController.flushLiveBackBuffer();

      mockSourceBuffer = null;
      bufferController.flushLiveBackBuffer();

      expect(removeStub).to.not.have.been.called;
    });

    it('does not flush if no buffered range intersects with back buffer limit', function () {
      bufStart = 5;
      mockMedia.currentTime = 10;
      bufferController.flushLiveBackBuffer();
      expect(removeStub).to.not.have.been.called;
    });

    it('does not flush if the liveBackBufferLength is Infinity', function () {
      hls.config.liveBackBufferLength = Infinity;
      mockMedia.currentTime = 15;
      bufferController.flushLiveBackBuffer();
      expect(removeStub).to.not.have.been.called;
    });

    it('flushes up to the back buffer limit if the buffer intersects with that point', function () {
      mockMedia.currentTime = 15;
      bufferController.flushLiveBackBuffer();
      expect(removeStub).to.have.been.calledOnce;
      expect(bufferController.flushBufferCounter).to.equal(0);
      expect(removeStub).to.have.been.calledWith('video', mockSourceBuffer.video, 0, 5);
    });

    it('flushes to a max of one targetDuration from currentTime, regardless of liveBackBufferLength', function () {
      mockMedia.currentTime = 15;
      bufferController._levelTargetDuration = 5;
      hls.config.liveBackBufferLength = 0;
      bufferController.flushLiveBackBuffer();
      expect(removeStub).to.have.been.calledWith('video', mockSourceBuffer.video, 0, 10);
    });

    it('should trigger clean back buffer when there are no pending appends', function () {
      bufferController.parent = {};
      bufferController.segments = [{ parent: bufferController.parent }];

      sandbox.stub(bufferController, 'doAppending');

      bufferController._onSBUpdateEnd();

      expect(flushSpy).to.not.have.been.called;

      bufferController.segments = [];
      bufferController._onSBUpdateEnd();

      expect(flushSpy).to.have.been.calledOnce;
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
      expect(bufferController.bufferCodecEventsExpected).to.equal(0);
    });

    it('should throw if no media element has been attached', function () {
      bufferController.createSourceBuffers.restore();
      bufferController.pendingTracks = { video: {} };

      expect(bufferController.checkPendingTracks).to.throw();
    });

    it('exposes tracks from buffer controller through BUFFER_CREATED event', function (done) {
      bufferController.createSourceBuffers.restore();

      let video = document.createElement('video');
      bufferController.onMediaAttaching({ media: video });

      hls.on(Hls.Events.BUFFER_CREATED, (_, data) => {
        const tracks = data.tracks;
        expect(bufferController.pendingTracks).to.not.equal(tracks);
        expect(bufferController.tracks).to.equal(tracks);
        done();
      });

      bufferController.pendingTracks = { video: { codec: 'testing' } };
      bufferController.checkPendingTracks();

      video = null;
    });

    it('expects one bufferCodec event by default', function () {
      bufferController.onManifestParsed({});
      expect(bufferController.bufferCodecEventsExpected).to.equal(1);
    });

    it('expects two bufferCodec events if altAudio is signaled', function () {
      bufferController.onManifestParsed({ altAudio: true });
      expect(bufferController.bufferCodecEventsExpected).to.equal(2);
    });

    it('creates sourceBuffers when no more BUFFER_CODEC events are expected', function () {
      bufferController.pendingTracks = { video: {} };

      bufferController.checkPendingTracks();
      expect(createSbStub).to.have.been.calledOnce;
    });

    it('creates sourceBuffers on the first even if two tracks are received', function () {
      bufferController.pendingTracks = { audio: {}, video: {} };
      bufferController.bufferCodecEventsExpected = 2;

      bufferController.checkPendingTracks();
      expect(createSbStub).to.have.been.calledOnce;
    });

    it('does not create sourceBuffers when BUFFER_CODEC events are expected', function () {
      bufferController.pendingTracks = { video: {} };
      bufferController.bufferCodecEventsExpected = 1;

      bufferController.checkPendingTracks();
      expect(createSbStub).to.not.have.been.called;
      expect(bufferController.bufferCodecEventsExpected).to.equal(1);
    });

    it('checks pending tracks in onMediaSourceOpen', function () {
      bufferController._onMediaSourceOpen();
      expect(checkPendingTracksSpy).to.have.been.calledOnce;
    });

    it('checks pending tracks even when more events are expected', function () {
      bufferController.sourceBuffer = {};
      bufferController.mediaSource = { readyState: 'open' };
      bufferController.bufferCodecEventsExpected = 2;

      bufferController.onBufferCodecs({});
      expect(checkPendingTracksSpy).to.have.been.calledOnce;
      expect(bufferController.bufferCodecEventsExpected).to.equal(1);

      bufferController.onBufferCodecs({});
      expect(checkPendingTracksSpy).to.have.been.calledTwice;
      expect(bufferController.bufferCodecEventsExpected).to.equal(0);
    });

    it('creates the expected amount of sourceBuffers given the standard event flow', function () {
      bufferController.sourceBuffer = {};
      bufferController.mediaSource = { readyState: 'open', removeEventListener: sandbox.stub() };

      bufferController.onManifestParsed({ altAudio: true });
      bufferController._onMediaSourceOpen();
      bufferController.onBufferCodecs({ audio: {} });
      bufferController.onBufferCodecs({ video: {} });

      expect(createSbStub).to.have.been.calledOnce;
      expect(createSbStub).to.have.been.calledWith({ audio: {}, video: {} });
    });
  });
});
