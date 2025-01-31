import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import BufferController from '../../../src/controller/buffer-controller';
import { FragmentTracker } from '../../../src/controller/fragment-tracker';
import { ErrorDetails, ErrorTypes } from '../../../src/errors';
import { Events } from '../../../src/events';
import Hls from '../../../src/hls';
import { ElementaryStreamTypes, Fragment } from '../../../src/loader/fragment';
import M3U8Parser from '../../../src/loader/m3u8-parser';
import { PlaylistLevelType } from '../../../src/types/loader';
import { ChunkMetadata } from '../../../src/types/transmuxer';
import { MockMediaElement, MockMediaSource } from '../utils/mock-media';
import type BufferOperationQueue from '../../../src/controller/buffer-operation-queue';
import type {
  BufferOperation,
  BufferOperationQueues,
  SourceBufferName,
  SourceBufferTrackSet,
} from '../../../src/types/buffer';
import type {
  ComponentAPI,
  NetworkComponentAPI,
} from '../../../src/types/component-api';
import type { BufferAppendingData } from '../../../src/types/events';
import type { MockSourceBuffer } from '../utils/mock-media';

chai.use(sinonChai);
const expect = chai.expect;
const sandbox = sinon.createSandbox();

type HlsTestable = Omit<Hls, 'networkControllers' | 'coreComponents'> & {
  coreComponents: ComponentAPI[];
  networkControllers: NetworkComponentAPI[];
};

const queueNames: Array<SourceBufferName> = ['audio', 'video'];

function getSourceBufferTracks(bufferController: BufferController) {
  return (bufferController as any).tracks as SourceBufferTrackSet;
}

function getSourceBufferTrack(
  bufferController: BufferController,
  type: SourceBufferName,
) {
  return getSourceBufferTracks(bufferController)[type];
}

function setSourceBufferBufferedRange(
  bufferController: BufferController,
  type: SourceBufferName,
  start: number,
  end: number,
) {
  const sb = getSourceBufferTrack(bufferController, type)
    ?.buffer as unknown as MockSourceBuffer;
  sb.setBuffered(start, end);
}

function evokeTrimBuffers(hls: HlsTestable) {
  const frag = new Fragment(PlaylistLevelType.MAIN, '');
  hls.trigger(Events.FRAG_CHANGED, { frag });
}

describe('BufferController with attached media', function () {
  let hls: HlsTestable;
  let fragmentTracker: FragmentTracker;
  let bufferController: BufferController;
  let operationQueue: BufferOperationQueue;
  let triggerSpy: sinon.SinonSpy;
  let shiftAndExecuteNextSpy: sinon.SinonSpy;
  let queueAppendBlockerSpy: sinon.SinonSpy;
  let mockMedia: MockMediaElement;
  let mockMediaSource: MockMediaSource;
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
    );
    operationQueue = (bufferController as any).operationQueue;
    // MEDIA_ATTACHING
    (bufferController as any).media = mockMedia = new MockMediaElement();
    (bufferController as any).mediaSource = mockMediaSource =
      new MockMediaSource();
    // checkPendingTracks > createSourceBuffers
    hls.trigger(Events.BUFFER_CODECS, {
      audio: {
        id: 'audio',
        container: 'audio/mp4',
      },
      video: {
        id: 'main',
        container: 'video/mp4',
      },
    });
    triggerSpy = sandbox.spy(hls, 'trigger');
    shiftAndExecuteNextSpy = sandbox.spy(operationQueue, 'shiftAndExecuteNext');
    queueAppendBlockerSpy = sandbox.spy(operationQueue, 'appendBlocker');
  });

  afterEach(function () {
    sandbox.restore();
    hls.destroy();
  });

  it('cycles the SourceBuffer operation queue on updateend', function () {
    const currentOnComplete = sandbox.spy();
    const currentOperation: BufferOperation = {
      label: '',
      execute: () => {},
      onStart: () => {},
      onComplete: currentOnComplete,
      onError: () => {},
    };

    const nextExecute = sandbox.spy();
    const nextOperation: BufferOperation = {
      label: '',
      execute: nextExecute,
      onStart: () => {},
      onComplete: () => {},
      onError: () => {},
    };

    queueNames.forEach((name, i) => {
      const currentQueue = (operationQueue as any).queues[
        name
      ] as BufferOperation[];
      currentQueue.push(currentOperation, nextOperation);
      const track = getSourceBufferTrack(bufferController, name);
      expect(bufferController)
        .to.have.property('tracks')
        .which.has.property(name);
      if (!track) {
        return;
      }
      expect(track).to.have.property('buffer');
      const buffer = track.buffer;
      if (!buffer) {
        return;
      }
      buffer.dispatchEvent(new Event('updateend'));
      expect(
        currentOnComplete,
        'onComplete should have been called on the current operation',
      ).to.have.callCount(i + 1);
      expect(
        shiftAndExecuteNextSpy,
        'The queue should have been cycled',
      ).to.have.callCount(i + 1);
    });
  });

  it('does not cycle the SourceBuffer operation queue on error', function () {
    const onError = sandbox.spy();
    const operation: BufferOperation = {
      label: '',
      execute: () => {},
      onStart: () => {},
      onComplete: () => {},
      onError,
    };
    queueNames.forEach((name, i) => {
      const currentQueue = (
        (operationQueue as any).queues as BufferOperationQueues
      )[name];
      currentQueue.push(operation);
      const errorEvent = new Event('error');
      getSourceBufferTrack(bufferController, name)?.buffer?.dispatchEvent(
        errorEvent,
      );
      const sbErrorObject = triggerSpy.getCall(0).lastArg.error;

      expect(
        onError,
        'onError should have been called on the current operation',
      ).to.have.callCount(i + 1);
      expect(
        onError,
        'onError should be called with an error object',
      ).to.have.been.calledWith(sbErrorObject);
      expect(sbErrorObject.message).equals(
        'audio SourceBuffer error. MediaSource readyState: open',
      );
      expect(
        triggerSpy,
        'ERROR should have been triggered in response to the SourceBuffer error',
      ).to.have.been.calledWith(Events.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.BUFFER_APPENDING_ERROR,
        sourceBufferName: triggerSpy.getCall(0).lastArg.sourceBufferName,
        error: triggerSpy.getCall(0).lastArg.error,
        fatal: false,
      });
      expect(shiftAndExecuteNextSpy, 'The queue should not have been cycled').to
        .have.not.been.called;
    });
  });

  describe('onBufferAppending', function () {
    it('should enqueue and execute an append operation', function () {
      const queueAppendSpy = sandbox.spy(operationQueue, 'append');
      queueNames.forEach((name, i) => {
        const track = getSourceBufferTrack(bufferController, name);
        const buffer = track?.buffer;
        expect(buffer).to.not.be.undefined;
        if (!buffer) {
          return;
        }
        const segmentData = new Uint8Array();
        const frag = new Fragment(PlaylistLevelType.MAIN, '');
        const chunkMeta = new ChunkMetadata(0, 0, 0, 0);
        const data: BufferAppendingData = {
          parent: PlaylistLevelType.MAIN,
          type: name,
          data: segmentData,
          frag,
          part: null,
          chunkMeta,
        };

        hls.trigger(Events.BUFFER_APPENDING, data);
        expect(
          queueAppendSpy,
          'The append operation should have been enqueued',
        ).to.have.callCount(i + 1);

        buffer.dispatchEvent(new Event('updateend'));
        expect(
          track.ended,
          `The ${name} SourceBufferTrack should not be marked "ended" after an append occurred`,
        ).to.be.false;
        expect(
          buffer.appendBuffer,
          'appendBuffer should have been called with the remuxed data',
        ).to.have.been.calledWith(segmentData);
        expect(
          triggerSpy,
          'BUFFER_APPENDED should be triggered upon completion of the operation',
        ).to.have.been.calledWith(Events.BUFFER_APPENDED, {
          parent: 'main',
          type: name,
          timeRanges: {
            audio: getSourceBufferTrack(bufferController, 'audio')?.buffer
              ?.buffered,
            video: getSourceBufferTrack(bufferController, 'video')?.buffer
              ?.buffered,
          },
          frag,
          part: null,
          chunkMeta,
        });
        expect(
          shiftAndExecuteNextSpy,
          'The queue should have been cycled',
        ).to.have.callCount(i + 1);
      });
    });

    it('should cycle the SourceBuffer operation queue if the sourceBuffer does not exist while appending', function () {
      const queueAppendSpy = sandbox.spy(operationQueue, 'append');
      const frag = new Fragment(PlaylistLevelType.MAIN, '');
      const chunkMeta = new ChunkMetadata(0, 0, 0, 0);
      (bufferController as any).resetBuffer('audio');
      (bufferController as any).resetBuffer('video');
      queueNames.forEach((name, i) => {
        hls.trigger(Events.BUFFER_APPENDING, {
          parent: PlaylistLevelType.MAIN,
          type: name,
          data: new Uint8Array(),
          frag,
          part: null,
          chunkMeta,
        });

        expect(
          queueAppendSpy,
          'The append operation should have been enqueued',
        ).to.have.callCount(i + 1);
        expect(
          shiftAndExecuteNextSpy,
          'The queue should have been cycled',
        ).to.have.callCount(i + 1);
      });
      expect(triggerSpy).to.have.callCount(4);
      const lastCall = triggerSpy.getCall(3);
      expect(
        triggerSpy,
        'Buffer append error event should have been triggered',
      ).to.have.been.calledWith(Events.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.BUFFER_APPEND_ERROR,
        sourceBufferName: lastCall.lastArg.sourceBufferName,
        parent: 'main',
        frag,
        part: null,
        chunkMeta,
        error: lastCall.lastArg.error,
        err: lastCall.lastArg.error,
        fatal: false,
        errorAction: { action: 0, flags: 0, resolved: true },
      });
    });
  });

  describe('onFragParsed', function () {
    it('should trigger FRAG_BUFFERED when all audio/video data has been buffered', function () {
      const frag = new Fragment(PlaylistLevelType.MAIN, '');
      frag.setElementaryStreamInfo(ElementaryStreamTypes.AUDIO, 0, 0, 0, 0);
      frag.setElementaryStreamInfo(ElementaryStreamTypes.VIDEO, 0, 0, 0, 0);

      hls.trigger(Events.FRAG_PARSED, { frag, part: null });
      return new Promise<void>((resolve, reject) => {
        hls.on(Events.FRAG_BUFFERED, (event, data) => {
          try {
            expect(
              data.frag,
              'The frag emitted in FRAG_BUFFERED should be the frag passed in onFragParsed',
            ).to.equal(frag);
            expect(
              data.id,
              'The id of the event should be equal to the frag type',
            ).to.equal(frag.type);
          } catch (e) {
            reject(e);
          }
          resolve();
        });
      });
    });
  });

  describe('onBufferFlushing', function () {
    let queueAppendSpy;
    beforeEach(function () {
      queueAppendSpy = sandbox.spy(operationQueue, 'append');
      queueNames.forEach((name) => {
        setSourceBufferBufferedRange(bufferController, name, 0, 10);
      });
    });

    it('flushes audio and video buffers if no type arg is specified', function () {
      hls.trigger(Events.BUFFER_FLUSHING, {
        startOffset: 0,
        endOffset: 10,
        type: null,
      });

      expect(
        queueAppendSpy,
        'A remove operation should have been appended to each queue',
      ).to.have.been.calledTwice;
      queueNames.forEach((name, i) => {
        const buffer = getSourceBufferTrack(bufferController, name)?.buffer;
        expect(buffer).to.not.be.undefined;
        if (!buffer) {
          return;
        }
        expect(
          buffer.remove,
          `Remove should have been called once on the ${name} SourceBuffer`,
        ).to.have.been.calledOnce;
        expect(
          buffer.remove,
          'Remove should have been called with the expected range',
        ).to.have.been.calledWith(0, 10);

        buffer.dispatchEvent(new Event('updateend'));
        expect(
          triggerSpy,
          'The BUFFER_FLUSHED event should be called once per buffer',
        ).to.have.callCount(i + 2);
        expect(triggerSpy).to.have.been.calledWith(Events.BUFFER_FLUSHING);
        expect(triggerSpy).to.have.been.calledWith(Events.BUFFER_FLUSHED);
        expect(
          shiftAndExecuteNextSpy,
          'The queue should have been cycled',
        ).to.have.callCount(i + 1);
      });
    });

    it('Does not queue remove operations when there are no SourceBuffers', function () {
      (bufferController as any).resetBuffer('audio');
      (bufferController as any).resetBuffer('video');
      hls.trigger(Events.BUFFER_FLUSHING, {
        startOffset: 0,
        endOffset: Infinity,
        type: null,
      });

      expect(
        queueAppendSpy,
        'No remove operations should have been appended',
      ).to.have.callCount(0);
    });

    it('Only queues remove operations for existing SourceBuffers', function () {
      (bufferController as any).tracks = {
        audiovideo: {},
      };
      (bufferController as any).sourceBuffers = [
        ['audiovideo', {}],
        [null, null],
      ];
      hls.trigger(Events.BUFFER_FLUSHING, {
        startOffset: 0,
        endOffset: Infinity,
        type: null,
      });
      expect(
        queueAppendSpy,
        'Queue one remove for muxed "audiovideo" SourceBuffer',
      ).to.have.been.calledOnce;
    });

    it('dequeues the remove operation if the requested remove range is not valid', function () {
      // Does not flush if start greater than end
      hls.trigger(Events.BUFFER_FLUSHING, {
        startOffset: 9001,
        endOffset: 9000,
        type: null,
      });

      expect(
        queueAppendSpy,
        'Two remove operations should have been appended',
      ).to.have.callCount(2);
      expect(
        shiftAndExecuteNextSpy,
        'The queues should have been cycled',
      ).to.have.callCount(2);
      queueNames.forEach((name) => {
        const buffer = getSourceBufferTrack(bufferController, name)?.buffer;
        expect(buffer).to.not.be.undefined;
        if (!buffer) {
          return;
        }
        expect(
          buffer.remove,
          `Remove should not have been called on the ${name} buffer`,
        ).to.have.not.been.called;
      });
      expect(triggerSpy).to.have.been.calledWith(Events.BUFFER_FLUSHING);
      expect(
        triggerSpy,
        'Only Events.BUFFER_FLUSHING should have been triggered',
      ).to.have.been.calledOnce;
    });
  });

  describe('trimBuffers', function () {
    it('exits early if no media is defined', function () {
      delete (bufferController as any).media;
      evokeTrimBuffers(hls);
      expect(triggerSpy).to.have.been.calledWith(Events.FRAG_CHANGED);
      expect(triggerSpy).to.not.have.been.calledWith(
        Events.BACK_BUFFER_REACHED,
      );
      expect(triggerSpy).to.not.have.been.calledWith(
        Events.LIVE_BACK_BUFFER_REACHED,
      );
      expect(triggerSpy).to.not.have.been.calledWith(Events.BUFFER_FLUSHING);
    });

    it('does not remove if the buffer does not exist', function () {
      queueNames.forEach((name) => {
        setSourceBufferBufferedRange(bufferController, name, 0, 0);
      });
      evokeTrimBuffers(hls);

      (bufferController as any).resetBuffer('audio');
      (bufferController as any).resetBuffer('video');
      evokeTrimBuffers(hls);

      expect(triggerSpy).to.not.have.been.calledWith(Events.BUFFER_FLUSHING);
    });

    describe('flushBackBuffer', function () {
      beforeEach(function () {
        (bufferController as any).details = {
          levelTargetDuration: 10,
        };
        hls.config.backBufferLength = 10;
        queueNames.forEach((name) => {
          setSourceBufferBufferedRange(bufferController, name, 0, 30);
        });
        mockMedia.currentTime = 30;
      });

      it('exits early if the backBufferLength config is not a finite number, or less than 0', function () {
        (hls.config as any).backBufferLength = null;
        evokeTrimBuffers(hls);
        hls.config.backBufferLength = -1;
        evokeTrimBuffers(hls);
        hls.config.backBufferLength = Infinity;
        evokeTrimBuffers(hls);
        expect(triggerSpy).to.not.have.been.calledWith(Events.BUFFER_FLUSHING);
      });

      it('should execute a remove operation if backBufferLength is set to 0', function () {
        hls.config.backBufferLength = 0;
        evokeTrimBuffers(hls);
        expect(triggerSpy.withArgs(Events.BUFFER_FLUSHING)).to.have.callCount(
          2,
        );
      });

      it('should execute a remove operation if flushing a valid backBuffer range', function () {
        evokeTrimBuffers(hls);
        expect(triggerSpy.withArgs(Events.BUFFER_FLUSHING)).to.have.callCount(
          2,
        );
        queueNames.forEach((name) => {
          expect(
            triggerSpy,
            `BUFFER_FLUSHING should have been triggered for the ${name} SourceBuffer`,
          ).to.have.been.calledWith(Events.BUFFER_FLUSHING, {
            startOffset: 0,
            endOffset: 20,
            type: name,
          });
        });
      });

      it('should support the deprecated liveBackBufferLength for live content', function () {
        (bufferController as any).details.live = true;
        hls.config.backBufferLength = Infinity;
        hls.config.liveBackBufferLength = 10;
        evokeTrimBuffers(hls);

        expect(
          triggerSpy.withArgs(Events.LIVE_BACK_BUFFER_REACHED),
        ).to.have.callCount(2);
      });

      it('removes a maximum of one targetDuration from currentTime at intervals of targetDuration', function () {
        mockMedia.currentTime = 25;
        hls.config.backBufferLength = 5;
        evokeTrimBuffers(hls);
        queueNames.forEach((name) => {
          expect(
            triggerSpy,
            `BUFFER_FLUSHING should have been triggered for the ${name} SourceBuffer`,
          ).to.have.been.calledWith(Events.BUFFER_FLUSHING, {
            startOffset: 0,
            endOffset: 10,
            type: name,
          });
        });
      });

      it('removes nothing if no buffered range intersects with back buffer limit', function () {
        mockMedia.currentTime = 15;
        queueNames.forEach((name) => {
          setSourceBufferBufferedRange(bufferController, name, 10, 30);
        });
        evokeTrimBuffers(hls);
        expect(triggerSpy).to.not.have.been.calledWith(Events.BUFFER_FLUSHING);
      });
    });

    describe('flushFrontBuffer', function () {
      beforeEach(function () {
        (bufferController as any).details = {
          levelTargetDuration: 10,
        };
        hls.config.maxBufferLength = 60;
        hls.config.frontBufferFlushThreshold = hls.config.maxBufferLength;
        queueNames.forEach((name) => {
          setSourceBufferBufferedRange(bufferController, name, 0, 100);
        });
        mockMedia.currentTime = 0;
      });

      it('exits early if the frontBufferFlushThreshold config is not a finite number, or less than 0', function () {
        (hls.config as any).frontBufferFlushThreshold = null;
        evokeTrimBuffers(hls);
        hls.config.frontBufferFlushThreshold = -1;
        evokeTrimBuffers(hls);
        hls.config.frontBufferFlushThreshold = Infinity;
        evokeTrimBuffers(hls);
        expect(triggerSpy).to.not.have.been.calledWith(Events.BUFFER_FLUSHING);
      });

      it('should execute a remove operation if flushing a valid frontBuffer range', function () {
        queueNames.forEach((name) => {
          setSourceBufferBufferedRange(bufferController, name, 150, 200);
        });

        evokeTrimBuffers(hls);
        expect(triggerSpy.withArgs(Events.BUFFER_FLUSHING)).to.have.callCount(
          2,
        );
        queueNames.forEach((name) => {
          expect(
            triggerSpy,
            `BUFFER_FLUSHING should have been triggered for the ${name} SourceBuffer`,
          ).to.have.been.calledWith(Events.BUFFER_FLUSHING, {
            startOffset: 150,
            endOffset: Infinity,
            type: name,
          });
        });
      });

      it('should do nothing if the buffer is contiguous', function () {
        evokeTrimBuffers(hls);
        expect(triggerSpy).to.not.have.been.calledWith(Events.BUFFER_FLUSHING);
      });

      it('should use maxBufferLength if frontBufferFlushThreshold < maxBufferLength', function () {
        queueNames.forEach((name) => {
          setSourceBufferBufferedRange(bufferController, name, 150, 200);
        });
        hls.config.frontBufferFlushThreshold = 10;
        evokeTrimBuffers(hls);
        expect(triggerSpy.withArgs(Events.BUFFER_FLUSHING)).to.have.callCount(
          2,
        );
        queueNames.forEach((name) => {
          expect(
            triggerSpy,
            `BUFFER_FLUSHING should have been triggered for the ${name} SourceBuffer`,
          ).to.have.been.calledWith(Events.BUFFER_FLUSHING, {
            startOffset: 150,
            endOffset: Infinity,
            type: name,
          });
        });
      });

      it('removes nothing if no buffered range intersects with front buffer limit', function () {
        mockMedia.currentTime = 0;
        queueNames.forEach((name) => {
          setSourceBufferBufferedRange(bufferController, name, 0, 20);
        });
        evokeTrimBuffers(hls);
        expect(triggerSpy).to.not.have.been.calledWith(Events.BUFFER_FLUSHING);
      });
    });
  });

  describe('onLevelUpdated', function () {
    let data;
    beforeEach(function () {
      const level = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:6
#EXTINF:5.1
1.seg
#EXTINF:4.9
2.seg
#EXT-X-ENDLIST
`;
      const details = M3U8Parser.parseLevelPlaylist(
        level,
        'http://domain/test.m3u8',
        0,
        PlaylistLevelType.MAIN,
        0,
        null,
      );
      mockMediaSource.duration = Infinity;
      data = { details };
    });

    it('exits early if the fragments array is empty', function () {
      data.details.fragments = [];
      hls.trigger(Events.LEVEL_UPDATED, data);
      expect((bufferController as any).details, 'details').to.be.null;
    });

    it('updates class properties based on level data', function () {
      hls.trigger(Events.LEVEL_UPDATED, data);
      expect((bufferController as any).details).to.equal(data.details);
    });

    it('synchronously sets media duration if no SourceBuffers exist', function () {
      (bufferController as any).resetBuffer('audio');
      (bufferController as any).resetBuffer('video');
      hls.trigger(Events.LEVEL_UPDATED, data);
      expect(queueAppendBlockerSpy).to.have.not.been.called;
      expect(mockMediaSource.duration, 'mediaSource.duration').to.equal(10);
    });

    it('sets media duration when attaching after level update', function () {
      (bufferController as any).resetBuffer('audio');
      (bufferController as any).resetBuffer('video');
      const media = (bufferController as any).media;
      // media is null prior to attaching
      (bufferController as any).media = null;
      expect(mockMediaSource.duration, 'mediaSource.duration').to.equal(
        Infinity,
      );
      hls.trigger(Events.LEVEL_UPDATED, data);
      expect(mockMediaSource.duration, 'mediaSource.duration').to.equal(
        Infinity,
      );
      // simulate attach and open source buffers
      (bufferController as any).media = media;
      (bufferController as any)._onMediaSourceOpen();
      expect(mockMediaSource.duration, 'mediaSource.duration').to.equal(10);
    });
  });

  describe('onBufferEos', function () {
    it('marks the ExtendedSourceBuffer as ended', function () {
      // No type arg ends both SourceBuffers
      hls.trigger(Events.BUFFER_EOS, {});
      queueNames.forEach((type) => {
        const track = getSourceBufferTrack(bufferController, type);
        const buffer = track?.buffer;
        expect(buffer).to.not.be.undefined;
        if (!buffer) {
          return;
        }
        expect(track.ended, 'SourceBufferTrack.ended').to.be.true;
      });
    });
  });
});
