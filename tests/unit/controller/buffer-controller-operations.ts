import sinon from 'sinon';
import chai from 'chai';
import sinonChai from 'sinon-chai';
import Hls from '../../../src/hls';

import BufferOperationQueue from '../../../src/controller/buffer-operation-queue';
import BufferController from '../../../src/controller/buffer-controller';
import { BufferOperation, SourceBufferName } from '../../../src/types/buffer';
import { BufferAppendingData } from '../../../src/types/events';
import { Events } from '../../../src/events';
import { FragmentTracker } from '../../../src/controller/fragment-tracker';
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

type TimeRange = { start: number; end: number };

class MockBufferedRanges {
  public _ranges: Array<TimeRange> = [];
  start(index: number) {
    if (index < 0 || index >= this._ranges.length) {
      throw new Error(
        `Index out of bounds: index=${index} but buffered.length=${this._ranges.length}`,
      );
    }
    return this._ranges[index].start;
  }

  end(index: number) {
    if (index < 0 || index >= this._ranges.length) {
      throw new Error(
        `Index out of bounds: index=${index} but buffered.length=${this._ranges.length}`,
      );
    }
    return this._ranges[index].end;
  }

  get length() {
    return this._ranges.length;
  }

  add(range: TimeRange) {
    // Empty
    if (this._ranges.length === 0) {
      this._ranges.push(range);
      return;
    }

    // No overlap from beginning
    if (range.end < this.start(0)) {
      this._ranges.unshift(range);
      return;
    }

    // No overlap from end
    if (range.start > this.end(this.length - 1)) {
      this._ranges.push(range);
      return;
    }

    const result = [this._ranges[0]];
    this._ranges.push(range);
    this._ranges.sort((a, b) => a.start - b.start);

    let j = 0;
    // Find and merge overlapping range
    for (let i = 1; i < this._ranges.length; i++) {
      const curRange = result[j];
      const nextRange = this._ranges[i];
      if (curRange.end >= nextRange.start) {
        curRange.end = Math.max(curRange.end, nextRange.end);
      } else {
        result.push(nextRange);
        j++;
      }
    }

    this._ranges = result;
  }
}

class MockSourceBuffer extends EventTarget {
  public updating: boolean = false;
  public appendBuffer = sandbox.stub();
  public remove = sandbox.stub();
  public buffered: MockBufferedRanges = new MockBufferedRanges();

  setBuffered(start: number, end: number) {
    this.buffered.add({ start, end });
  }
}

class MockMediaElement {
  public currentTime: number = 0;
  public duration: number = Infinity;
  public textTracks: any[] = [];
  addEventListener() {}
  removeEventListener() {}
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
    hls.networkControllers.forEach((component) => component.destroy());
    hls.networkControllers.length = 0;
    hls.coreComponents.forEach((component) => component.destroy());
    hls.coreComponents.length = 0;
    bufferController = new BufferController(hls, new FragmentTracker(hls));
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
          'The append operation should have been enqueued',
        ).to.have.callCount(i + 1);

        buffer.dispatchEvent(new Event('updateend'));
        expect(
          buffer.ended,
          `The ${name} buffer should not be marked as true if an append occurred`,
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
            audio: buffers.audio.buffered,
            video: buffers.video.buffered,
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
      queueNames.forEach((name, i) => {
        bufferController.sourceBuffer = {};
        bufferController.onBufferAppending(Events.BUFFER_APPENDING, {
          type: name,
          data: new Uint8Array(),
          frag,
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
      expect(
        triggerSpy,
        'Buffer append error event should have been triggered',
      ).to.have.been.calledWith(Events.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.BUFFER_APPEND_ERROR,
        sourceBufferName: triggerSpy.getCall(0).lastArg.sourceBufferName,
        parent: 'main',
        frag,
        part: undefined,
        chunkMeta,
        error: triggerSpy.getCall(0).lastArg.error,
        err: triggerSpy.getCall(0).lastArg.error,
        fatal: false,
      });
    });
  });

  describe('onFragParsed', function () {
    it('should trigger FRAG_BUFFERED when all audio/video data has been buffered', function () {
      const frag = new Fragment(PlaylistLevelType.MAIN, '');
      frag.setElementaryStreamInfo(ElementaryStreamTypes.AUDIO, 0, 0, 0, 0);
      frag.setElementaryStreamInfo(ElementaryStreamTypes.VIDEO, 0, 0, 0, 0);

      bufferController.onFragParsed(Events.FRAG_PARSED, { frag });
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
        'A remove operation should have been appended to each queue',
      ).to.have.been.calledTwice;
      queueNames.forEach((name, i) => {
        const buffer = bufferController.sourceBuffer[name];
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
        ).to.have.callCount(i + 1);
        expect(
          triggerSpy,
          'BUFFER_FLUSHED should be the only event fired',
        ).to.have.been.calledWith(Events.BUFFER_FLUSHED);
        expect(
          shiftAndExecuteNextSpy,
          'The queue should have been cycled',
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
        'No remove operations should have been appended',
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
        'Queue one remove for muxed "audiovideo" SourceBuffer',
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
        'Two remove operations should have been appended',
      ).to.have.callCount(2);
      expect(
        shiftAndExecuteNextSpy,
        'The queues should have been cycled',
      ).to.have.callCount(2);
      queueNames.forEach((name) => {
        const buffer = bufferController.sourceBuffer[name];
        expect(
          buffer.remove,
          `Remove should not have been called on the ${name} buffer`,
        ).to.have.not.been.called;
      });
      expect(triggerSpy, 'No event should have been triggered').to.have.not.been
        .called;
    });
  });

  describe('trimBuffers', function () {
    it('exits early if no media is defined', function () {
      delete bufferController.media;
      bufferController.trimBuffers();
      expect(triggerSpy, 'BUFFER_FLUSHING should not have been triggered').to
        .have.not.been.called;
    });

    it('does not remove if the buffer does not exist', function () {
      queueNames.forEach((name) => {
        const buffer = bufferController.sourceBuffer[name];
        buffer.setBuffered(0, 0);
      });
      bufferController.trimBuffers();

      bufferController.sourceBuffer = {};
      bufferController.trimBuffers();

      expect(triggerSpy, 'BUFFER_FLUSHING should not have been triggered').to
        .have.not.been.called;
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

      it('exits early if the backBufferLength config is not a finite number, or less than 0', function () {
        hls.config.backBufferLength = null;
        bufferController.trimBuffers();
        hls.config.backBufferLength = -1;
        bufferController.trimBuffers();
        hls.config.backBufferLength = Infinity;
        bufferController.trimBuffers();
        expect(triggerSpy, 'BUFFER_FLUSHING should not have been triggered').to
          .have.not.been.called;
      });

      it('should execute a remove operation if flushing a valid backBuffer range', function () {
        bufferController.trimBuffers();
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
        bufferController.details.live = true;
        hls.config.backBufferLength = Infinity;
        hls.config.liveBackBufferLength = 10;
        bufferController.trimBuffers();

        expect(
          triggerSpy.withArgs(Events.LIVE_BACK_BUFFER_REACHED),
        ).to.have.callCount(2);
      });

      it('removes a maximum of one targetDuration from currentTime at intervals of targetDuration', function () {
        mockMedia.currentTime = 25;
        hls.config.backBufferLength = 5;
        bufferController.trimBuffers();
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
          const buffer = bufferController.sourceBuffer[name];
          buffer.setBuffered(10, 30);
        });
        bufferController.trimBuffers();
        expect(triggerSpy, 'BUFFER_FLUSHING should not have been triggered').to
          .have.not.been.called;
      });
    });

    describe('flushFrontBuffer', function () {
      beforeEach(function () {
        bufferController.details = {
          levelTargetDuration: 10,
        };
        hls.config.maxBufferLength = 60;
        hls.config.frontBufferFlushThreshold = hls.config.maxBufferLength;
        queueNames.forEach((name) => {
          const sb = bufferController.sourceBuffer[name];
          sb.setBuffered(0, 100);
        });
        mockMedia.currentTime = 0;
      });

      it('exits early if the frontBufferFlushThreshold config is not a finite number, or less than 0', function () {
        hls.config.frontBufferFlushThreshold = null;
        bufferController.trimBuffers();
        hls.config.frontBufferFlushThreshold = -1;
        bufferController.trimBuffers();
        hls.config.frontBufferFlushThreshold = Infinity;
        bufferController.trimBuffers();
        expect(triggerSpy, 'BUFFER_FLUSHING should not have been triggered').to
          .have.not.been.called;
      });

      it('should execute a remove operation if flushing a valid frontBuffer range', function () {
        queueNames.forEach((name) => {
          const sb = bufferController.sourceBuffer[name];
          sb.setBuffered(150, 200);
        });

        bufferController.trimBuffers();
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
        bufferController.trimBuffers();
        expect(triggerSpy.withArgs(Events.BUFFER_FLUSHING)).to.have.callCount(
          0,
        );
        queueNames.forEach((name) => {
          expect(
            triggerSpy,
            `BUFFER_FLUSHING should not have been triggered for the ${name} SourceBuffer`,
          ).to.have.been.callCount(0);
        });
      });

      it('should use maxBufferLength if frontBufferFlushThreshold < maxBufferLength', function () {
        queueNames.forEach((name) => {
          const sb = bufferController.sourceBuffer[name];
          sb.setBuffered(150, 200);
        });
        hls.config.frontBufferFlushThreshold = 10;
        bufferController.trimBuffers();
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
          const buffer = bufferController.sourceBuffer[name];
          buffer.setBuffered(0, 20);
        });
        bufferController.trimBuffers();
        expect(triggerSpy, 'BUFFER_FLUSHING should not have been triggered').to
          .have.not.been.called;
      });
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
        Infinity,
      );
      bufferController.onLevelUpdated(Events.LEVEL_UPDATED, data);
      expect(mockMediaSource.duration, 'mediaSource.duration').to.equal(
        Infinity,
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
      queueNames.forEach((type) => {
        const buffer = bufferController.sourceBuffer[type];
        expect(buffer.ended, 'ExtendedSourceBuffer.ended').to.be.true;
      });
    });
  });
});
