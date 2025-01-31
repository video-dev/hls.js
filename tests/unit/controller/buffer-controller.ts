import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import BufferController from '../../../src/controller/buffer-controller';
import { FragmentTracker } from '../../../src/controller/fragment-tracker';
import { Events } from '../../../src/events';
import Hls from '../../../src/hls';
import { MockMediaElement, MockMediaSource } from '../utils/mock-media';
import type BufferOperationQueue from '../../../src/controller/buffer-operation-queue';
import type {
  ExtendedSourceBuffer,
  ParsedTrack,
  SourceBuffersTuple,
  SourceBufferTrackSet,
} from '../../../src/types/buffer';
import type {
  ComponentAPI,
  NetworkComponentAPI,
} from '../../../src/types/component-api';

chai.use(sinonChai);
const expect = chai.expect;

type HlsTestable = Omit<Hls, 'networkControllers' | 'coreComponents'> & {
  coreComponents: ComponentAPI[];
  networkControllers: NetworkComponentAPI[];
};

type BufferOperationQueueTestable = Omit<BufferOperationQueue, 'tracks'> & {
  tracks: SourceBufferTrackSet;
};

type BufferControllerTestable = Omit<
  BufferController,
  | '_onMediaSourceOpen'
  | 'bufferCodecEventsTotal'
  | 'checkPendingTracks'
  | 'createSourceBuffers'
  | 'media'
  | 'mediaSource'
  | 'operationQueue'
  | 'pendingTrackCount'
  | 'sourceBufferCount'
  | 'sourceBuffers'
  | 'tracks'
  | 'tracksReady'
> & {
  _onMediaSourceOpen: (e?: Event) => void;
  bufferCodecEventsTotal: number;
  checkPendingTracks: () => void;
  createSourceBuffers: () => void;
  media: HTMLMediaElement | null;
  mediaSource: MediaSource | null;
  operationQueue: BufferOperationQueueTestable;
  pendingTrackCount: number;
  sourceBufferCount: number;
  sourceBuffers: SourceBuffersTuple;
  tracks: SourceBufferTrackSet;
  tracksReady: boolean;
};

describe('BufferController', function () {
  let hls: HlsTestable;
  let fragmentTracker: FragmentTracker;
  let bufferController: BufferControllerTestable;
  const sandbox = sinon.createSandbox();

  beforeEach(function () {
    hls = new Hls({
      // debug: true,
    }) as unknown as HlsTestable;
    fragmentTracker = new FragmentTracker(hls as unknown as Hls);
    hls.networkControllers.forEach((component) => component.destroy());
    hls.networkControllers.length = 0;
    hls.coreComponents.forEach((component) => component.destroy());
    hls.coreComponents.length = 0;
    bufferController = new BufferController(
      hls as unknown as Hls,
      fragmentTracker,
    ) as unknown as BufferControllerTestable;
  });

  afterEach(function () {
    hls.destroy();
    bufferController.destroy();
    sandbox.restore();
  });

  describe('onBufferFlushing', function () {
    beforeEach(function () {
      bufferController.sourceBuffers = [
        ['video', {} as unknown as ExtendedSourceBuffer],
        ['audio', {} as unknown as ExtendedSourceBuffer],
      ];
      bufferController.operationQueue.tracks = {
        audio: {
          id: 'audio',
          container: '',
          buffer: { updating: false } as unknown as ExtendedSourceBuffer,
          listeners: [],
        },
        video: {
          id: 'main',
          container: '',
          buffer: { updating: false } as unknown as ExtendedSourceBuffer,
          listeners: [],
        },
      };
    });

    it('flushes a specific type when provided a type', function () {
      const spy = sandbox.spy(bufferController.operationQueue, 'append');
      hls.trigger(Events.BUFFER_FLUSHING, {
        startOffset: 0,
        endOffset: 10,
        type: 'video',
      });
      expect(spy).to.have.been.calledOnce;
    });

    it('flushes all source buffers when buffer flush event type is null', function () {
      const spy = sandbox.spy(bufferController.operationQueue, 'append');
      hls.trigger(Events.BUFFER_FLUSHING, {
        startOffset: 0,
        endOffset: 10,
        type: null,
      });
      expect(spy).to.have.been.calledTwice;
    });
  });

  describe('sourcebuffer creation', function () {
    let createSbStub;
    let checkPendingTracksSpy;
    beforeEach(function () {
      createSbStub = sandbox
        .stub(bufferController, 'createSourceBuffers')
        .callsFake(() => {
          Object.keys(bufferController.tracks).forEach((type) => {
            bufferController.tracks ||= {};
            bufferController.tracks[type] = {
              appendBuffer: () => {},
              remove: () => {},
            };
          });
        });
      checkPendingTracksSpy = sandbox.spy(
        bufferController,
        'checkPendingTracks',
      );
    });

    it('initializes with zero expected BUFFER_CODEC events', function () {
      expect(bufferController.bufferCodecEventsTotal).to.equal(0);
    });

    it('should throw if no media element has been attached', function () {
      (bufferController.createSourceBuffers as sinon.SinonStub).restore();
      bufferController.tracks = {
        video: {
          id: 'main',
          container: '',
          listeners: [],
        },
      };

      expect(bufferController.checkPendingTracks).to.throw();
    });

    it('exposes tracks from buffer controller through BUFFER_CREATED event', function () {
      (bufferController.createSourceBuffers as sinon.SinonStub).restore();

      // MEDIA_ATTACHING
      bufferController.media =
        new MockMediaElement() as unknown as HTMLMediaElement;
      bufferController.mediaSource =
        new MockMediaSource() as unknown as MediaSource;
      sandbox.stub(bufferController.mediaSource as any, 'addSourceBuffer');

      return new Promise((resolve, reject) => {
        hls.on(Hls.Events.BUFFER_CREATED, (event, data) => {
          expect(bufferController.tracks)
            .to.have.property('video')
            .which.deep.equals(
              {
                buffer: undefined,
                levelCodec: undefined,
                metadata: undefined,
                id: 'main',
                container: 'video/mp4',
                codec: 'avc1.42e01e',
                listeners: bufferController.tracks.video?.listeners,
              },
              JSON.stringify(bufferController.tracks.video),
            );
          resolve({});
        });

        hls.once(Hls.Events.ERROR, (event, data) => {
          reject(data.error);
        });

        hls.trigger(Events.BUFFER_CODECS, {
          video: {
            id: 'main',
            container: 'video/mp4',
            codec: 'avc1.42e01e',
          },
        });
      });
    });

    it('expects one bufferCodec event by default', function () {
      hls.trigger(Events.MANIFEST_PARSED, {} as any);
      expect(bufferController.bufferCodecEventsTotal).to.equal(1);
    });

    it('expects two bufferCodec events if altAudio is signaled', function () {
      hls.trigger(Events.MANIFEST_PARSED, {
        altAudio: true,
      } as any);
      expect(bufferController.bufferCodecEventsTotal).to.equal(2);
    });

    it('expects one bufferCodec event if altAudio is signaled with audio only', function () {
      hls.trigger(Events.MANIFEST_PARSED, {
        altAudio: true,
        audio: true,
        video: false,
      } as any);
      expect(bufferController.bufferCodecEventsTotal).to.equal(1);
    });

    it('creates sourceBuffers when no more BUFFER_CODEC events are expected', function () {
      bufferController.tracks = {
        video: {
          id: 'main',
          container: 'video/mp4',
          listeners: [],
        },
      };
      bufferController.checkPendingTracks();
      expect(createSbStub).to.have.been.calledOnce;
    });

    it('creates sourceBuffers on the first even if two tracks are received', function () {
      bufferController.tracks = {
        audio: {
          id: 'audio',
          container: 'audio/mp4',
          listeners: [],
        },
        video: {
          id: 'main',
          container: 'video/mp4',
          listeners: [],
        },
      };
      bufferController.bufferCodecEventsTotal = 2;
      bufferController.checkPendingTracks();
      expect(bufferController.tracksReady).to.be.true;
      expect(createSbStub).to.have.been.calledOnce;
    });

    it('does not create sourceBuffers when BUFFER_CODEC events are expected', function () {
      bufferController.tracks = {
        video: {
          id: 'main',
          container: 'video/mp4',
          listeners: [],
        },
      };
      bufferController.bufferCodecEventsTotal = 2;
      expect(bufferController.pendingTrackCount).to.equal(1);
      bufferController.checkPendingTracks();
      expect(bufferController.tracksReady).to.be.false;
      expect(createSbStub).to.not.have.been.called;
    });

    it('checks pending tracks even when more events are expected', function () {
      bufferController.tracks = {};
      bufferController.mediaSource = {
        readyState: 'open',
        removeEventListener: () => {},
      } as unknown as MediaSource;
      bufferController.bufferCodecEventsTotal = 2;

      hls.trigger(Events.BUFFER_CODECS, {
        audio: {
          id: 'audio',
          container: 'audio/mp4',
        },
      });
      expect(checkPendingTracksSpy).to.have.been.calledOnce;
      expect(bufferController.pendingTrackCount).to.equal(1);
      expect(bufferController.sourceBufferCount).to.equal(0);
      expect(bufferController.tracksReady).to.be.false;

      hls.trigger(Events.BUFFER_CODECS, {
        video: {
          id: 'main',
          container: 'video/mp4',
        },
      });
      expect(checkPendingTracksSpy).to.have.been.calledTwice;
      expect(bufferController.pendingTrackCount).to.equal(2);
      expect(bufferController.sourceBufferCount).to.equal(0);
      expect(bufferController.tracksReady).to.be.true;
    });

    it('creates the expected amount of sourceBuffers given the standard event flow', function () {
      bufferController.tracks = {};
      bufferController.mediaSource =
        new MockMediaSource() as unknown as MediaSource;
      sandbox.stub(bufferController.mediaSource, 'removeEventListener');
      hls.trigger(Events.MANIFEST_PARSED, {
        altAudio: true,
      } as any);
      bufferController._onMediaSourceOpen();
      hls.trigger(Events.BUFFER_CODECS, { audio: {} } as any);
      hls.trigger(Events.BUFFER_CODECS, { video: {} } as any);

      expect(createSbStub).to.have.been.calledOnce;
      expect(bufferController.tracks).to.have.property('audio');
      expect(bufferController.tracks).to.have.property('video');
    });
  });

  describe('onBufferCodecs', function () {
    it('calls changeType if needed and stores current track info', function () {
      /* eslint-disable-next-line no-unused-vars */
      const appendChangeType = sandbox.stub(
        bufferController as any,
        'appendChangeType',
      );
      const buffer = {
        changeType: sandbox.stub(),
      } as unknown as ExtendedSourceBuffer;
      const originalAudioTrack: ParsedTrack = {
        id: 'main',
        codec: 'mp4a.40.2',
        levelCodec: undefined,
        container: 'audio/mp4',
        metadata: {
          channelCount: 1,
        },
      };
      const newAudioTrack: ParsedTrack = {
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
          listeners: [],
        },
      };
      bufferController.sourceBuffers = [
        [null, null],
        ['audio', buffer],
      ];
      hls.trigger(Events.BUFFER_CODECS, {
        audio: newAudioTrack,
      });
      expect(appendChangeType).to.have.been.calledOnce;
      expect(appendChangeType).to.have.been.calledWith(
        'audio',
        'audio/mp4',
        'mp4a.40.5',
      );
      expect(bufferController.tracks.audio?.pendingCodec).to.equal(
        newAudioTrack.codec,
      );
      hls.trigger(Events.BUFFER_CODECS, {
        audio: originalAudioTrack,
      });
      expect(appendChangeType).to.have.been.calledTwice;
      expect(appendChangeType).to.have.been.calledWith(
        'audio',
        'audio/mp4',
        'mp4a.40.2',
      );
      expect(bufferController.tracks.audio?.pendingCodec).to.equal(
        originalAudioTrack.codec,
      );
    });
  });

  describe('bufferedToEnd', function () {
    it('returns false when there are no source buffers and no pending tracks', function () {
      expect(bufferController.pendingTrackCount).to.equal(0);
      expect(bufferController.sourceBufferCount).to.equal(0);
      expect(bufferController.bufferedToEnd).to.equal(false);
    });

    it('returns false when there are no source buffers', function () {
      bufferController.tracks = {
        audio: {
          id: 'audio',
          container: 'audio/mp4',
          listeners: [],
        },
        video: {
          id: 'main',
          container: 'video/mp4',
          listeners: [],
        },
      };
      expect(bufferController.pendingTrackCount).to.equal(2);
      expect(bufferController.sourceBufferCount).to.equal(0);
      expect(bufferController.bufferedToEnd).to.equal(false);
    });

    it('returns false when there is a track that has not ended', function () {
      bufferController.tracks = {
        audio: {
          buffer: {} as unknown as ExtendedSourceBuffer,
          id: 'audio',
          container: 'audio/mp4',
          listeners: [],
        },
        video: {
          buffer: {} as unknown as ExtendedSourceBuffer,
          id: 'main',
          container: 'video/mp4',
          listeners: [],
        },
      };
      bufferController.sourceBuffers = [
        ['video', {} as unknown as ExtendedSourceBuffer],
        ['audio', {} as unknown as ExtendedSourceBuffer],
      ];
      expect(bufferController.pendingTrackCount).to.equal(0);
      expect(bufferController.sourceBufferCount).to.equal(2);
      expect(bufferController.bufferedToEnd).to.equal(false);
    });

    it('returns false when there is a track that is ending', function () {
      bufferController.tracks = {
        audio: {
          buffer: {} as unknown as ExtendedSourceBuffer,
          id: 'audio',
          container: 'audio/mp4',
          listeners: [],
          ended: true,
          ending: true,
        },
        video: {
          buffer: {} as unknown as ExtendedSourceBuffer,
          id: 'main',
          container: 'video/mp4',
          listeners: [],
          ended: true,
          ending: true,
        },
      };
      bufferController.sourceBuffers = [
        ['video', {} as unknown as ExtendedSourceBuffer],
        ['audio', {} as unknown as ExtendedSourceBuffer],
      ];
      expect(bufferController.pendingTrackCount).to.equal(0);
      expect(bufferController.sourceBufferCount).to.equal(2);
      expect(bufferController.bufferedToEnd).to.equal(false);
    });

    it('returns true when audio and video tracks haved ended', function () {
      bufferController.tracks = {
        audio: {
          buffer: {} as unknown as ExtendedSourceBuffer,
          id: 'audio',
          container: 'audio/mp4',
          listeners: [],
          ended: true,
          ending: false,
        },
        video: {
          buffer: {} as unknown as ExtendedSourceBuffer,
          id: 'main',
          container: 'video/mp4',
          listeners: [],
          ended: true,
          ending: false,
        },
      };
      bufferController.sourceBuffers = [
        ['video', {} as unknown as ExtendedSourceBuffer],
        ['audio', {} as unknown as ExtendedSourceBuffer],
      ];
      expect(bufferController.pendingTrackCount).to.equal(0);
      expect(bufferController.sourceBufferCount).to.equal(2);
      expect(bufferController.bufferedToEnd).to.be.true;
    });

    it('returns true when the audio-only track has ended', function () {
      bufferController.tracks = {
        audio: {
          buffer: {} as unknown as ExtendedSourceBuffer,
          id: 'audio',
          container: 'audio/mp4',
          listeners: [],
          ended: true,
          ending: false,
        },
      };
      bufferController.sourceBuffers = [
        [null, null],
        ['audio', {} as unknown as ExtendedSourceBuffer],
      ];
      expect(bufferController.pendingTrackCount).to.equal(0);
      expect(bufferController.sourceBufferCount).to.equal(1);
      expect(bufferController.bufferedToEnd).to.be.true;
    });

    it('returns true when the video-only track has ended', function () {
      bufferController.tracks = {
        video: {
          buffer: {} as unknown as ExtendedSourceBuffer,
          id: 'main',
          container: 'video/mp4',
          listeners: [],
          ended: true,
          ending: false,
        },
      };
      bufferController.sourceBuffers = [
        ['video', {} as unknown as ExtendedSourceBuffer],
        [null, null],
      ];
      expect(bufferController.pendingTrackCount).to.equal(0);
      expect(bufferController.sourceBufferCount).to.equal(1);
      expect(bufferController.bufferedToEnd).to.be.true;
    });

    it('returns true when the audiovideo track has ended', function () {
      bufferController.tracks = {
        audiovideo: {
          buffer: {} as unknown as ExtendedSourceBuffer,
          id: 'main',
          container: 'video/mp4',
          listeners: [],
          ended: true,
          ending: false,
        },
      };
      bufferController.sourceBuffers = [
        ['audiovideo', {} as unknown as ExtendedSourceBuffer],
        [null, null],
      ];
      expect(bufferController.pendingTrackCount).to.equal(0);
      expect(bufferController.sourceBufferCount).to.equal(1);
      expect(bufferController.bufferedToEnd).to.be.true;
    });
  });
});
