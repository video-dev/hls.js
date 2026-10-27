import { expect, use } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import BufferController from '../../../src/controller/buffer-controller';
import { FragmentTracker } from '../../../src/controller/fragment-tracker';
import { ErrorDetails, ErrorTypes } from '../../../src/errors';
import { Events } from '../../../src/events';
import Hls from '../../../src/hls';
import { MockMediaElement, MockMediaSource } from '../../mocks/mock-media';
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

use(sinonChai);

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
  _onMediaSourceClose: () => void;
  _objectUrl: string | null;
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
                id: 'main',
                container: 'video/mp4',
                codec: 'avc1.42e01e',
                levelCodec: undefined,
                supplemental: undefined,
                listeners: bufferController.tracks.video?.listeners,
                metadata: undefined,
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

    it('ignores unmuxed tracks once a muxed "audiovideo" SourceBuffer is created', function () {
      const buffer = {} as unknown as ExtendedSourceBuffer;
      bufferController.tracks = {
        audiovideo: {
          id: 'main',
          container: 'video/mp4',
          buffer,
          listeners: [],
        },
      };
      bufferController.sourceBuffers = [
        ['audiovideo', buffer],
        [null, null],
      ];
      hls.trigger(Events.BUFFER_CODECS, {
        audio: {
          id: 'audio',
          container: 'audio/mp4',
          codec: 'mp4a.40.2',
        },
      });
      expect(bufferController.tracks).to.not.have.property('audio');
      expect(bufferController.tracks).to.have.property('audiovideo');
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

  describe('MediaSource requires reset', function () {
    it('emits error when sourceclose fires with media attached', function () {
      const media = new MockMediaElement() as unknown as HTMLMediaElement;
      const mediaSource = new MockMediaSource() as unknown as MediaSource;
      const triggerSpy = sandbox.spy(hls, 'trigger');
      bufferController.media = media;
      bufferController.mediaSource = mediaSource;
      bufferController._onMediaSourceClose();
      expect(triggerSpy).to.have.been.calledWith(
        Events.ERROR,
        sinon.match({
          type: ErrorTypes.MEDIA_ERROR,
          details: ErrorDetails.MEDIA_SOURCE_REQUIRES_RESET,
          fatal: false,
        }),
      );
    });

    it('does not emit error when media is not attached', function () {
      const mediaSource = new MockMediaSource() as unknown as MediaSource;
      const triggerSpy = sandbox.spy(hls, 'trigger');
      bufferController.media = null;
      bufferController.mediaSource = mediaSource;
      bufferController._onMediaSourceClose();
      expect(triggerSpy).to.not.have.been.calledWith(Events.ERROR);
    });

    describe('media element switched to another source', function () {
      const OBJECT_URL = 'blob:https://example.com/media-source';
      let media: MockMediaElement;
      let triggerSpy: sinon.SinonSpy;
      let detachSpy: sinon.SinonSpy;
      const resetErrorCount = () =>
        triggerSpy
          .getCalls()
          .filter(
            (call) =>
              call.args[0] === Events.ERROR &&
              call.args[1].details === ErrorDetails.MEDIA_SOURCE_REQUIRES_RESET,
          ).length;

      beforeEach(function () {
        media = new MockMediaElement();
        triggerSpy = sandbox.spy(hls, 'trigger');
        detachSpy = sandbox.spy(hls, 'detachMedia');
        bufferController.media = media as unknown as HTMLMediaElement;
        bufferController.mediaSource =
          new MockMediaSource() as unknown as MediaSource;
        bufferController._objectUrl = OBJECT_URL;
      });

      it('emits error when the element is still on the MediaSource object URL (bfcache restore)', function () {
        media.src = OBJECT_URL;
        media.currentSrc = OBJECT_URL;
        bufferController._onMediaSourceClose();
        expect(triggerSpy).to.have.been.calledWith(
          Events.ERROR,
          sinon.match({ details: ErrorDetails.MEDIA_SOURCE_REQUIRES_RESET }),
        );
        expect(detachSpy).to.not.have.been.called;
      });

      it('detaches instead of resetting when a third party set src on the element', function () {
        // currentSrc is stale at sourceclose time: resource selection has not run yet
        media.currentSrc = OBJECT_URL;
        // What an Ad SDK does to play in the content element
        media.src = 'https://example.com/ad.mp4';
        bufferController._onMediaSourceClose();
        expect(triggerSpy).to.not.have.been.calledWith(Events.ERROR);
        expect(detachSpy).to.have.been.calledOnce;
        expect(bufferController.media).to.be.null;
      });

      it('detaches without touching the element when the browser selected an alternate <source> (AirPlay)', function () {
        // ManagedMediaSource attaches through a <source> child which stays in place while Safari
        // loads the m3u8 source alternative on the AirPlay device
        (media as any).querySelector = (selector: string) =>
          selector === 'source' ? { src: OBJECT_URL } : null;
        media.currentSrc = 'https://example.com/main.m3u8';
        const loadSpy = sandbox.spy(media, 'load');
        const removeAttributeSpy = sandbox.spy(media, 'removeAttribute');
        bufferController._onMediaSourceClose();
        expect(triggerSpy).to.not.have.been.calledWith(Events.ERROR);
        expect(detachSpy).to.have.been.calledOnce;
        expect(loadSpy).to.not.have.been.called;
        expect(removeAttributeSpy).to.not.have.been.called;
        expect(bufferController.media).to.be.null;
      });

      it('prefers the src attribute over a <source> child when checking the active source', function () {
        (media as any).querySelector = (selector: string) =>
          selector === 'source' ? { src: OBJECT_URL } : null;
        // Without a src attribute the <source> child is the active source: reset as usual
        bufferController._onMediaSourceClose();
        expect(resetErrorCount()).to.equal(1);
        expect(detachSpy).to.not.have.been.called;
        // A src attribute set over the <source> child takes precedence: detach, do not reset
        media.src = 'https://example.com/ad.mp4';
        bufferController._onMediaSourceClose();
        expect(resetErrorCount()).to.equal(1);
        expect(detachSpy).to.have.been.calledOnce;
      });
    });
  });

  describe('onMediaAttaching', function () {
    it('sets the source immediately when no CDM cleanup is pending', function () {
      const media = new MockMediaElement() as unknown as HTMLMediaElement;
      hls.trigger(Events.MEDIA_ATTACHING, { media });
      expect(media.src).to.equal(bufferController._objectUrl);
    });

    it('sets the source immediately when the media element mediaKeys are null', async function () {
      let resolveCleanup!: () => void;
      const cleanupPromise = new Promise<void>((resolve) => {
        resolveCleanup = resolve;
      });
      hls.config.emeEnabled = true;
      hls.config.emeController = { CDMCleanupPromise: cleanupPromise } as any;
      const media = new MockMediaElement() as unknown as HTMLMediaElement;

      expect(media.mediaKeys).to.equal(null);
      expect(media.src).to.equal('');
      hls.trigger(Events.MEDIA_ATTACHING, { media });
      expect(media.src).to.equal(bufferController._objectUrl);

      resolveCleanup();
      await cleanupPromise;
      expect(media.src).to.equal(bufferController._objectUrl);
    });

    it('defers setting the source until CDM cleanup has completed', async function () {
      let resolveCleanup!: () => void;
      const cleanupPromise = new Promise<void>((resolve) => {
        resolveCleanup = resolve;
      });
      hls.config.emeEnabled = true;
      hls.config.emeController = { CDMCleanupPromise: cleanupPromise } as any;
      const media = new MockMediaElement() as unknown as HTMLMediaElement;
      (media as any).__mediaKeys = {};

      expect(media.mediaKeys).to.not.equal(null);
      expect(media.src).to.equal('');
      hls.trigger(Events.MEDIA_ATTACHING, { media });
      expect(media.src).to.equal('');

      resolveCleanup();
      await cleanupPromise;
      expect(media.src).to.equal(bufferController._objectUrl);
    });
  });
});
