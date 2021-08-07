import * as sinon from 'sinon';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import Hls from '../../../src/hls';

import BufferOperationQueue from '../../../src/controller/buffer-operation-queue';
import BufferController from '../../../src/controller/buffer-controller';
import { BufferOperation, SourceBufferName } from '../../../src/types/buffer';
import { BufferAppendingData } from '../../../src/types/events';
import { Events } from '../../../src/events';
import { ErrorDetails, ErrorTypes } from '../../../src/errors';
import { ElementaryStreamTypes, Fragment } from '../../../src/loader/fragment';
import { PlaylistLevelType } from '../../../src/types/loader';
import { ChunkMetadata } from '../../../src/types/transmuxer';
import { LevelDetails } from '../../../src/loader/level-details';

chai.use(sinonChai);
const expect = chai.expect;
const sandbox = sinon.createSandbox();

class MockMediaSource {
  public readyState: string = 'open';
  public duration: number = Infinity;

  addSourceBuffer(): MockSourceBuffer {
    return new MockSourceBuffer();
  }

  addEventListener() {}

  removeEventListener() {}

  endOfStream() {}
}

class MockSourceBuffer extends EventTarget {
  public updating: boolean = false;
  public appendBuffer = sandbox.stub();
  public remove = sandbox.stub();

  public buffered = {
    start() {
      return this._start;
    },
    end() {
      return this._end;
    },
    length: 1,
    _start: 0,
    _end: 0,
  };

  setBuffered(start, end) {
    this.buffered._start = start;
    this.buffered._end = end;
    this.buffered.length = start === end ? 0 : 1;
  }
}

class MockMediaElement {
  public currentTime: number = 0;
  public duration: number = Infinity;
  public textTracks: any[] = [];
}

const queueNames: Array<SourceBufferName> = ['audio', 'video'];

describe('BufferController', function () {
  let hls;
  let bufferController;
  let operationQueue;
  let triggerSpy;
  let shiftAndExecuteNextSpy;
  let queueAppendBlockerSpy;
  let mockMedia;
  let mockMediaSource;
  beforeEach(function () {
    hls = new Hls({});

    bufferController = new BufferController(hls);
    bufferController.media = mockMedia = new MockMediaElement();
    bufferController.mediaSource = mockMediaSource = new MockMediaSource();
    bufferController.createSourceBuffers({
      audio: {},
      video: {},
    });

    operationQueue = new BufferOperationQueue(bufferController.sourceBuffer);
    bufferController.operationQueue = operationQueue;
    triggerSpy = sandbox.spy(hls, 'trigger');
    shiftAndExecuteNextSpy = sandbox.spy(operationQueue, 'shiftAndExecuteNext');
    queueAppendBlockerSpy = sandbox.spy(operationQueue, 'appendBlocker');
  });

  afterEach(function () {
    sandbox.restore();
  });

  it('cycles the SourceBuffer operation queue on updateend', function () {
    const currentOnComplete = sandbox.spy();
    const currentOperation: BufferOperation = {
      execute: () => {},
      onStart: () => {},
      onComplete: currentOnComplete,
      onError: () => {},
    };

    const nextExecute = sandbox.spy();
    const nextOperation: BufferOperation = {
      execute: nextExecute,
      onStart: () => {},
      onComplete: () => {},
      onError: () => {},
    };

    queueNames.forEach((name, i) => {
      const currentQueue = operationQueue.queues[name];
      currentQueue.push(currentOperation, nextOperation);
      bufferController.sourceBuffer[name].dispatchEvent(new Event('updateend'));
      expect(
        currentOnComplete,
        'onComplete should have been called on the current operation'
      ).to.have.callCount(i + 1);
      expect(
        shiftAndExecuteNextSpy,
        'The queue should have been cycled'
      ).to.have.callCount(i + 1);
    });
  });

  it('does not cycle the SourceBuffer operation queue on error', function () {
    const onError = sandbox.spy();
    const operation: BufferOperation = {
      execute: () => {},
      onStart: () => {},
      onComplete: () => {},
      onError,
    };
    queueNames.forEach((name, i) => {
      const currentQueue = operationQueue.queues[name];
      currentQueue.push(operation);
      const errorEvent = new Event('error');
      bufferController.sourceBuffer[name].dispatchEvent(errorEvent);

      expect(
        onError,
        'onError should have been called on the current operation'
      ).to.have.callCount(i + 1);
      expect(
        onError,
        'onError should be called with the error event'
      ).to.have.been.calledWith(errorEvent);
      expect(
        triggerSpy,
        'ERROR should have been triggered in response to the SourceBuffer error'
      ).to.have.been.calledWith(Events.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.BUFFER_APPENDING_ERROR,
        fatal: false,
      });
      expect(shiftAndExecuteNextSpy, 'The queue should not have been cycled').to
        .have.not.been.called;
    });
  });

  describe('onBufferAppending', function () {
    it('should enqueue and execute an append operation', function () {
      const queueAppendSpy = sandbox.spy(operationQueue, 'append');
      const buffers = bufferController.sourceBuffer;
      queueNames.forEach((name, i) => {
        const buffer = buffers[name];
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

        bufferController.onBufferAppending(Events.BUFFER_APPENDING, data);
        expect(
          queueAppendSpy,
          'The append operation should have been enqueued'
        ).to.have.callCount(i + 1);

        buffer.dispatchEvent(new Event('updateend'));
        expect(
          buffer.ended,
          `The ${name} buffer should not be marked as true if an append occurred`
        ).to.be.false;
        expect(
          buffer.appendBuffer,
          'appendBuffer should have been called with the remuxed data'
        ).to.have.been.calledWith(segmentData);
        expect(
          triggerSpy,
          'BUFFER_APPENDED should be triggered upon completion of the operation'
        ).to.have.been.calledWith(Events.BUFFER_APPENDED, {
          parent: 'main',
          type: name,
          timeRanges: {
            audio: buffers.audio.buffered,
            video: buffers.video.buffered,
          },
          frag,
          part: null,
          chunkMeta,
        });
        expect(
          shiftAndExecuteNextSpy,
          'The queue should have been cycled'
        ).to.have.callCount(i + 1);
      });
    });

    it('should cycle the SourceBuffer operation queue if the sourceBuffer does not exist while appending', function () {
      const queueAppendSpy = sandbox.spy(operationQueue, 'append');
      queueNames.forEach((name, i) => {
        bufferController.sourceBuffer = {};
        bufferController.onBufferAppending(Events.BUFFER_APPENDING, {
          type: name,
          data: new Uint8Array(),
          frag: new Fragment(PlaylistLevelType.MAIN, ''),
          chunkMeta: new ChunkMetadata(0, 0, 0, 0),
        });

        expect(
          queueAppendSpy,
          'The append operation should have been enqueued'
        ).to.have.callCount(i + 1);
        expect(
          shiftAndExecuteNextSpy,
          'The queue should have been cycled'
        ).to.have.callCount(i + 1);
      });
      expect(triggerSpy, 'No event should have been triggered').to.have.not.been
        .called;
    });
  });

  describe('onFragParsed', function () {
    it('should trigger FRAG_BUFFERED when all audio/video data has been buffered', function () {
      const frag = new Fragment(PlaylistLevelType.MAIN, '');
      frag.setElementaryStreamInfo(ElementaryStreamTypes.AUDIO, 0, 0, 0, 0);
      frag.setElementaryStreamInfo(ElementaryStreamTypes.VIDEO, 0, 0, 0, 0);

      bufferController.onFragParsed(Events.FRAG_PARSED, { frag });
      expect(queueAppendBlockerSpy).to.have.been.calledTwice;
      return new Promise<void>((resolve, reject) => {
        hls.on(Events.FRAG_BUFFERED, (event, data) => {
          try {
            expect(
              data.frag,
              'The frag emitted in FRAG_BUFFERED should be the frag passed in onFragParsed'
            ).to.equal(frag);
            expect(
              data.id,
              'The id of the event should be equal to the frag type'
            ).to.equal(frag.type);
            // TODO: remove stats from event & place onto frag
            // expect(data.stats).to.equal({});
          } catch (e) {
            reject(e);
          }
          resolve();
        });
      }).then(() => {
        expect(shiftAndExecuteNextSpy, 'The queues should have been cycled').to
          .have.been.calledTwice;
      });
    });
  });

  describe('onBufferFlushing', function () {
    let queueAppendSpy;
    beforeEach(function () {
      queueAppendSpy = sandbox.spy(operationQueue, 'append');
      queueNames.forEach((name) => {
        const sb = bufferController.sourceBuffer[name];
        sb.setBuffered(0, 10);
      });
    });

    it('flushes audio and video buffers if no type arg is specified', function () {
      bufferController.onBufferFlushing(Events.BUFFER_FLUSHING, {
        startOffset: 0,
        endOffset: 10,
      });

      expect(
        queueAppendSpy,
        'A remove operation should have been appended to each queue'
      ).to.have.been.calledTwice;
      queueNames.forEach((name, i) => {
        const buffer = bufferController.sourceBuffer[name];
        expect(
          buffer.remove,
          `Remove should have been called once on the ${name} SourceBuffer`
        ).to.have.been.calledOnce;
        expect(
          buffer.remove,
          'Remove should have been called with the expected range'
        ).to.have.been.calledWith(0, 10);

        buffer.dispatchEvent(new Event('updateend'));
        expect(
          triggerSpy,
          'The BUFFER_FLUSHED event should be called once per buffer'
        ).to.have.callCount(i + 1);
        expect(
          triggerSpy,
          'BUFFER_FLUSHED should be the only event fired'
        ).to.have.been.calledWith(Events.BUFFER_FLUSHED);
        expect(
          shiftAndExecuteNextSpy,
          'The queue should have been cycled'
        ).to.have.callCount(i + 1);
      });
    });

    it('Does not queue remove operations when there are no SourceBuffers', function () {
      bufferController.sourceBuffer = {};
      bufferController.onBufferFlushing(Events.BUFFER_FLUSHING, {
        startOffset: 0,
        endOffset: Infinity,
      });

      expect(
        queueAppendSpy,
        'No remove operations should have been appended'
      ).to.have.callCount(0);
    });

    it('Only queues remove operations for existing SourceBuffers', function () {
      bufferController.sourceBuffer = {
        audiovideo: {},
      };
      bufferController.onBufferFlushing(Events.BUFFER_FLUSHING, {
        startOffset: 0,
        endOffset: Infinity,
      });
      expect(
        queueAppendSpy,
        'Queue one remove for muxed "audiovideo" SourceBuffer'
      ).to.have.been.calledOnce;
    });

    it('dequeues the remove operation if the requested remove range is not valid', function () {
      // Does not flush if start greater than end
      bufferController.onBufferFlushing(Events.BUFFER_FLUSHING, {
        startOffset: 9001,
        endOffset: 9000,
      });

      expect(
        queueAppendSpy,
        'Two remove operations should have been appended'
      ).to.have.callCount(2);
      expect(
        shiftAndExecuteNextSpy,
        'The queues should have been cycled'
      ).to.have.callCount(2);
      queueNames.forEach((name) => {
        const buffer = bufferController.sourceBuffer[name];
        expect(
          buffer.remove,
          `Remove should not have been called on the ${name} buffer`
        ).to.have.not.been.called;
      });
      expect(triggerSpy, 'No event should have been triggered').to.have.not.been
        .called;
    });
  });

  describe('flushBackBuffer', function () {
    beforeEach(function () {
      bufferController.details = {
        levelTargetDuration: 10,
      };
      hls.config.backBufferLength = 10;
      queueNames.forEach((name) => {
        const sb = bufferController.sourceBuffer[name];
        sb.setBuffered(0, 30);
      });
      mockMedia.currentTime = 30;
    });

    it('exits early if no media is defined', function () {
      delete bufferController.media;
      bufferController.flushBackBuffer();
      expect(triggerSpy, 'BUFFER_FLUSHING should not have been triggered').to
        .have.not.been.called;
    });

    it('exits early if the backBufferLength config is not a finite number, or less than 0', function () {
      hls.config.backBufferLength = null;
      bufferController.flushBackBuffer();
      hls.config.backBufferLength = -1;
      bufferController.flushBackBuffer();
      hls.config.backBufferLength = Infinity;
      bufferController.flushBackBuffer();
      expect(triggerSpy, 'BUFFER_FLUSHING should not have been triggered').to
        .have.not.been.called;
    });

    it('should execute a remove operation if flushing a valid backBuffer range', function () {
      bufferController.flushBackBuffer();
      expect(triggerSpy.withArgs(Events.BUFFER_FLUSHING)).to.have.callCount(2);
      queueNames.forEach((name) => {
        expect(
          triggerSpy,
          `BUFFER_FLUSHING should have been triggered for the ${name} SourceBuffer`
        ).to.have.been.calledWith(Events.BUFFER_FLUSHING, {
          startOffset: 0,
          endOffset: 20,
          type: name,
        });
      });
    });

    it('should support the deprecated liveBackBufferLength for live content', function () {
      bufferController.details.live = true;
      hls.config.backBufferLength = Infinity;
      hls.config.liveBackBufferLength = 10;
      bufferController.flushBackBuffer();

      expect(
        triggerSpy.withArgs(Events.LIVE_BACK_BUFFER_REACHED)
      ).to.have.callCount(2);
    });

    it('removes a maximum of one targetDuration from currentTime at intervals of targetDuration', function () {
      mockMedia.currentTime = 25;
      hls.config.backBufferLength = 5;
      bufferController.flushBackBuffer();
      queueNames.forEach((name) => {
        expect(
          triggerSpy,
          `BUFFER_FLUSHING should have been triggered for the ${name} SourceBuffer`
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
        const buffer = bufferController.sourceBuffer[name];
        buffer.setBuffered(10, 30);
      });
      bufferController.flushBackBuffer();
      expect(triggerSpy, 'BUFFER_FLUSHING should not have been triggered').to
        .have.not.been.called;
    });

    it('does not remove if the buffer does not exist', function () {
      queueNames.forEach((name) => {
        const buffer = bufferController.sourceBuffer[name];
        buffer.setBuffered(0, 0);
      });
      bufferController.flushBackBuffer();

      bufferController.sourceBuffer = {};
      bufferController.flushBackBuffer();

      expect(triggerSpy, 'BUFFER_FLUSHING should not have been triggered').to
        .have.not.been.called;
    });
  });

  describe('onLevelUpdated', function () {
    let data;
    beforeEach(function () {
      const details = Object.assign(new LevelDetails(''), {
        averagetargetduration: 6,
        totalduration: 5,
        fragments: [{ start: 5 }],
      });
      mockMediaSource.duration = Infinity;
      data = { details };
    });

    it('exits early if the fragments array is empty', function () {
      data.details.fragments = [];
      bufferController.onLevelUpdated(Events.LEVEL_UPDATED, data);
      expect(bufferController.details, 'details').to.be.null;
    });

    it('updates class properties based on level data', function () {
      bufferController.onLevelUpdated(Events.LEVEL_UPDATED, data);
      expect(bufferController.details).to.equal(data.details);
    });

    it('enqueues a blocking operation which updates the MediaSource duration', function () {
      bufferController.onLevelUpdated(Events.LEVEL_UPDATED, data);
      expect(queueAppendBlockerSpy).to.have.been.calledTwice;
      // Updating the duration is aync and has no event to signal completion, so we are unable to test for it directly
    });

    it('synchronously sets media duration if no SourceBuffers exist', function () {
      bufferController.sourceBuffer = {};
      bufferController.onLevelUpdated(Events.LEVEL_UPDATED, data);
      expect(queueAppendBlockerSpy).to.have.not.been.called;
      expect(mockMediaSource.duration, 'mediaSource.duration').to.equal(10);
    });

    it('sets media duration when attaching after level update', function () {
      bufferController.sourceBuffer = {};
      const media = bufferController.media;
      // media is null prior to attaching
      bufferController.media = null;
      expect(mockMediaSource.duration, 'mediaSource.duration').to.equal(
        Infinity
      );
      bufferController.onLevelUpdated(Events.LEVEL_UPDATED, data);
      expect(mockMediaSource.duration, 'mediaSource.duration').to.equal(
        Infinity
      );
      // simulate attach and open source buffers
      bufferController.media = media;
      bufferController._onMediaSourceOpen();
      expect(mockMediaSource.duration, 'mediaSource.duration').to.equal(10);
    });
  });

  describe('onBufferEos', function () {
    it('marks the ExtendedSourceBuffer as ended', function () {
      // No type arg ends both SourceBuffers
      bufferController.onBufferEos(Events.BUFFER_EOS, {});
      expect(queueAppendBlockerSpy).to.have.been.calledTwice;
      queueNames.forEach((type) => {
        const buffer = bufferController.sourceBuffer[type];
        expect(buffer.ended, 'ExtendedSourceBuffer.ended').to.be.true;
      });
    });
  });
});
