import { logger } from '../utils/logger';
import type {
  BufferOperation,
  BufferOperationQueues,
  SourceBuffers,
  SourceBufferName,
} from '../types/buffer';

export default class BufferOperationQueue {
  private buffers: SourceBuffers;
  private queues: BufferOperationQueues = {
    video: [],
    audio: [],
    audiovideo: [],
  };

  constructor(sourceBufferReference: SourceBuffers) {
    this.buffers = sourceBufferReference;
  }

  public append(
    operation: BufferOperation,
    type: SourceBufferName,
    pending?: boolean,
  ) {
    const queue = this.queues[type];
    queue.push(operation);
    if (queue.length === 1 && !pending) {
      this.executeNext(type);
    }
  }

  public appendBlocker(type: SourceBufferName): Promise<void> {
    return new Promise((resolve) => {
      const operation: BufferOperation = {
        execute: resolve,
        onStart: () => {},
        onComplete: () => {},
        onError: () => {},
      };
      this.append(operation, type);
    });
  }

  unblockAudio(op: BufferOperation) {
    const queue = this.queues.audio;
    if (queue[0] === op) {
      this.shiftAndExecuteNext('audio');
    }
  }

  public executeNext(type: SourceBufferName) {
    const queue = this.queues[type];
    if (queue.length) {
      const operation: BufferOperation = queue[0];
      try {
        // Operations are expected to result in an 'updateend' event being fired. If not, the queue will lock. Operations
        // which do not end with this event must call _onSBUpdateEnd manually
        operation.execute();
      } catch (error) {
        logger.warn(
          `[buffer-operation-queue]: Exception executing "${type}" SourceBuffer operation: ${error}`,
        );
        operation.onError(error);

        // Only shift the current operation off, otherwise the updateend handler will do this for us
        const sb = this.buffers[type];
        if (!sb?.updating) {
          this.shiftAndExecuteNext(type);
        }
      }
    }
  }

  public shiftAndExecuteNext(type: SourceBufferName) {
    this.queues[type].shift();
    this.executeNext(type);
  }

  public current(type: SourceBufferName): BufferOperation {
    return this.queues[type][0];
  }
}
