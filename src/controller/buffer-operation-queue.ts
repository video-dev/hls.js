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

  public append(operation: BufferOperation, type: SourceBufferName) {
    const queue = this.queues[type];
    queue.push(operation);
    if (queue.length === 1 && this.buffers[type]) {
      this.executeNext(type);
    }
  }

  public insertAbort(operation: BufferOperation, type: SourceBufferName) {
    const queue = this.queues[type];
    queue.unshift(operation);
    this.executeNext(type);
  }

  public appendBlocker(type: SourceBufferName): Promise<{}> {
    let execute;
    const promise: Promise<{}> = new Promise((resolve) => {
      execute = resolve;
    });
    const operation: BufferOperation = {
      execute,
      onStart: () => {},
      onComplete: () => {},
      onError: () => {},
    };

    this.append(operation, type);
    return promise;
  }

  public executeNext(type: SourceBufferName) {
    const { buffers, queues } = this;
    const sb = buffers[type];
    const queue = queues[type];
    if (queue.length) {
      const operation: BufferOperation = queue[0];
      try {
        // Operations are expected to result in an 'updateend' event being fired. If not, the queue will lock. Operations
        // which do not end with this event must call _onSBUpdateEnd manually
        operation.execute();
      } catch (e) {
        logger.warn(
          '[buffer-operation-queue]: Unhandled exception executing the current operation'
        );
        operation.onError(e);

        // Only shift the current operation off, otherwise the updateend handler will do this for us
        if (!sb || !sb.updating) {
          queue.shift();
          this.executeNext(type);
        }
      }
    }
  }

  public shiftAndExecuteNext(type: SourceBufferName) {
    this.queues[type].shift();
    this.executeNext(type);
  }

  public current(type: SourceBufferName) {
    return this.queues[type][0];
  }
}
