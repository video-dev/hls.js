import sinon from 'sinon';
import Hls from '../../../src/hls';
import BufferController from '../../../src/controller/buffer-controller';

describe('BufferController tests', function () {
  let hls;
  let bufferController;
  const sandbox = sinon.sandbox.create();

  beforeEach(function () {
    hls = new Hls({});
    bufferController = new BufferController(hls);
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('sourcebuffer creation', function () {
    let createSbStub;
    let checkPendingTracksSpy;
    beforeEach(function () {
      createSbStub = sandbox.stub(bufferController, 'createSourceBuffers');
      checkPendingTracksSpy = sandbox.spy(bufferController, 'checkPendingTracks');
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
