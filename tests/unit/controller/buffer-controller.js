import sinon from 'sinon';
import Hls from '../../../src/hls';
import BufferController from '../../../src/controller/buffer-controller';
import { Events } from '../../../src/events';

describe('BufferController tests', function () {
  let hls;
  let bufferController;
  const sandbox = sinon.createSandbox();

  beforeEach(function () {
    hls = new Hls({});
    bufferController = new BufferController(hls);
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('onBufferFlushing', function () {
    beforeEach(function () {
      bufferController.operationQueue.buffers.audio = {};
      bufferController.operationQueue.buffers.video = {};
    });

    it('flushes a specific type when provided a type', function () {
      const spy = sandbox.spy(bufferController.operationQueue, 'append');
      bufferController.onBufferFlushing(Events.BUFFER_FLUSHING, {
        startOffset: 0,
        endOffset: 10,
        type: 'video',
      });
      expect(spy).to.have.been.calledOnce;
    });

    it('flushes all source buffers when buffer flush event type is undefined', function () {
      const spy = sandbox.spy(bufferController.operationQueue, 'append');
      bufferController.onBufferFlushing(Events.BUFFER_FLUSHING, {
        startOffset: 0,
        endOffset: 10,
      });
      expect(spy).to.have.been.calledTwice;
    });
  });

  // describe('Live back buffer enforcement', function () {
  //   let mockMedia;
  //   let mockSourceBuffer;
  //   let bufStart;
  //
  //   beforeEach(function () {
  //     bufStart = 0;
  //     bufferController._levelTargetDuration = 10;
  //     bufferController.media = mockMedia = {
  //       currentTime: 0
  //     };
  //     bufferController.sourceBuffer = mockSourceBuffer = {
  //       video: {
  //         buffered: {
  //           start () {
  //             return bufStart;
  //           },
  //           length: 1
  //         }
  //       }
  //     };
  //     bufferController._live = true;
  //     hls.config.backBufferLength = 10;
  //   });
  //
  //   it('exits early if not live', function () {
  //     bufferController.flushBackBuffer();
  //     expect(removeStub).to.not.have.been.called;
  //   });
  //
  //   it('exits early if backBufferLength is not a finite number, or is less than 0', function () {
  //     hls.config.backBufferLength = 'foo';
  //     bufferController.flushBackBuffer();
  //
  //     hls.config.backBufferLength = -1;
  //     bufferController.flushBackBuffer();
  //
  //     expect(removeStub).to.not.have.been.called;
  //   });
  //
  //   it('does not flush if nothing is buffered', function () {
  //     delete mockSourceBuffer.buffered;
  //     bufferController.flushBackBuffer();
  //
  //     mockSourceBuffer = null;
  //     bufferController.flushBackBuffer();
  //
  //     expect(removeStub).to.not.have.been.called;
  //   });
  //
  //   it('does not flush if no buffered range intersects with back buffer limit', function () {
  //     bufStart = 5;
  //     mockMedia.currentTime = 10;
  //     bufferController.flushBackBuffer();
  //     expect(removeStub).to.not.have.been.called;
  //   });
  //
  //   it('does not flush if the backBufferLength is Infinity', function () {
  //     hls.config.backBufferLength = Infinity;
  //     mockMedia.currentTime = 15;
  //     bufferController.flushBackBuffer();
  //     expect(removeStub).to.not.have.been.called;
  //   });
  //
  //   it('flushes up to the back buffer limit if the buffer intersects with that point', function () {
  //     mockMedia.currentTime = 15;
  //     bufferController.flushBackBuffer();
  //     expect(removeStub).to.have.been.calledOnce;
  //     expect(bufferController.flushBufferCounter).to.equal(0);
  //     expect(removeStub).to.have.been.calledWith('video', mockSourceBuffer.video, 0, 5);
  //   });
  //
  //   it('flushes to a max of one targetDuration from currentTime, regardless of backBufferLength', function () {
  //     mockMedia.currentTime = 15;
  //     bufferController._levelTargetDuration = 5;
  //     hls.config.backBufferLength = 0;
  //     bufferController.flushBackBuffer();
  //     expect(removeStub).to.have.been.calledWith('video', mockSourceBuffer.video, 0, 10);
  //   });
  //
  //   it('should trigger clean back buffer when there are no pending appends', function () {
  //     bufferController.parent = {};
  //     bufferController.segments = [{ parent: bufferController.parent }];
  //
  //     sandbox.stub(bufferController, 'doAppending');
  //
  //     bufferController._onSBUpdateEnd();
  //
  //     expect(flushSpy).to.not.have.been.called;
  //
  //     bufferController.segments = [];
  //     bufferController._onSBUpdateEnd();
  //
  //     expect(flushSpy).to.have.been.calledOnce;
  //   });
  // });

  describe('sourcebuffer creation', function () {
    let createSbStub;
    let checkPendingTracksSpy;
    beforeEach(function () {
      createSbStub = sandbox.stub(bufferController, 'createSourceBuffers');
      checkPendingTracksSpy = sandbox.spy(
        bufferController,
        'checkPendingTracks'
      );
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
      bufferController.onMediaAttaching(Events.MEDIA_ATTACHING, {
        media: video,
      });
      sandbox.stub(bufferController.mediaSource, 'addSourceBuffer');

      hls.on(Hls.Events.BUFFER_CREATED, (event, data) => {
        const tracks = data.tracks;
        expect(bufferController.pendingTracks).to.not.equal(tracks);
        expect(bufferController.tracks).to.equal(tracks);
        done();
      });

      hls.once(Hls.Events.ERROR, (event, data) => {
        // Async timeout prevents assertion from throwing in event handler
        self.setTimeout(() => {
          expect(data.error.message).to.equal(null);
          done();
        });
      });

      bufferController.pendingTracks = {
        video: {
          container: 'video/mp4',
          codec: 'avc1.42e01e',
        },
      };
      bufferController.checkPendingTracks();

      video = null;
    });

    it('expects one bufferCodec event by default', function () {
      bufferController.onManifestParsed(Events.MANIFEST_PARSED, {});
      expect(bufferController.bufferCodecEventsExpected).to.equal(1);
    });

    it('expects two bufferCodec events if altAudio is signaled', function () {
      bufferController.onManifestParsed(Events.MANIFEST_PARSED, {
        altAudio: true,
      });
      expect(bufferController.bufferCodecEventsExpected).to.equal(2);
    });

    it('expects one bufferCodec event if altAudio is signaled with audio only', function () {
      bufferController.onManifestParsed(Events.MANIFEST_PARSED, {
        altAudio: true,
        audio: true,
        video: false,
      });
      expect(bufferController.bufferCodecEventsExpected).to.equal(1);
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

      bufferController.onBufferCodecs(Events.BUFFER_CODECS, {});
      expect(checkPendingTracksSpy).to.have.been.calledOnce;
      expect(bufferController.bufferCodecEventsExpected).to.equal(1);

      bufferController.onBufferCodecs(Events.BUFFER_CODECS, {});
      expect(checkPendingTracksSpy).to.have.been.calledTwice;
      expect(bufferController.bufferCodecEventsExpected).to.equal(0);
    });

    it('creates the expected amount of sourceBuffers given the standard event flow', function () {
      bufferController.sourceBuffer = {};
      bufferController.mediaSource = {
        readyState: 'open',
        removeEventListener: sandbox.stub(),
      };

      bufferController.onManifestParsed(Events.MANIFEST_PARSED, {
        altAudio: true,
      });
      bufferController._onMediaSourceOpen();
      bufferController.onBufferCodecs(Events.BUFFER_CODECS, { audio: {} });
      bufferController.onBufferCodecs(Events.BUFFER_CODECS, { video: {} });

      expect(createSbStub).to.have.been.calledOnce;
      expect(createSbStub).to.have.been.calledWith({ audio: {}, video: {} });
    });
  });

  describe('onBufferCodecs', function () {
    it('calls changeType if needed and stores current track info', function () {
      const getSourceBufferTypes = sandbox
        .stub(bufferController, 'getSourceBufferTypes')
        .returns(['audio', 'video']);
      /* eslint-disable-next-line no-unused-vars */
      const appendChangeType = sandbox.stub(
        bufferController,
        'appendChangeType'
      );
      const buffer = {
        changeType: sandbox.stub(),
      };
      const originalAudioTrack = {
        id: 'main',
        codec: 'mp4a.40.2',
        levelCodec: undefined,
        container: 'audio/mp4',
        metadata: {
          channelCount: 1,
        },
      };
      const newAudioTrack = {
        id: 'main',
        codec: 'mp4a.40.5',
        levelCodec: undefined,
        container: 'audio/mp4',
        metadata: {
          channelCount: 1,
        },
      };
      bufferController.tracks = {
        audio: {
          ...originalAudioTrack,
          buffer,
        },
      };
      bufferController.onBufferCodecs(Events.BUFFER_CODECS, {
        audio: newAudioTrack,
      });
      expect(getSourceBufferTypes).to.have.been.calledOnce;
      expect(bufferController.appendChangeType).to.have.been.calledOnce;
      expect(bufferController.appendChangeType).to.have.been.calledWith(
        'audio',
        'audio/mp4;codecs=mp4a.40.5'
      );
      expect(bufferController.tracks.audio).to.deep.equal({
        buffer,
        ...newAudioTrack,
      });

      bufferController.onBufferCodecs(Events.BUFFER_CODECS, {
        audio: originalAudioTrack,
      });
      expect(getSourceBufferTypes).to.have.been.calledTwice;
      expect(bufferController.appendChangeType).to.have.been.calledTwice;
      expect(bufferController.appendChangeType).to.have.been.calledWith(
        'audio',
        'audio/mp4;codecs=mp4a.40.2'
      );
      expect(bufferController.tracks.audio).to.deep.equal({
        buffer,
        ...originalAudioTrack,
      });
    });
  });
});
