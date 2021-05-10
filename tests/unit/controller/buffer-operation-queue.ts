import BufferOperationQueue from '../../../src/controller/buffer-operation-queue';
import { BufferOperation, SourceBuffers } from '../../../src/types/buffer';

import * as sinon from 'sinon';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';

chai.use(sinonChai);
const expect = chai.expect;
const queueNames = ['audio', 'video'];

describe('BufferOperationQueue tests', function () {
  const sandbox = sinon.createSandbox();
  let operationQueue;
  const sbMock = {
    audio: {
      updating: false,
    },
    video: {
      updating: false,
    },
  } as any as SourceBuffers;

  beforeEach(function () {
    operationQueue = new BufferOperationQueue(sbMock);
  });

  afterEach(function () {
    sandbox.restore();
  });

  it('initializes with an audio and video queue', function () {
    expect(operationQueue.queues.video).to.exist;
    expect(operationQueue.queues.audio).to.exist;
  });

  describe('append', function () {
    it('appends and executes if the queue is empty', function () {
      const execute = sandbox.spy();
      const operation: BufferOperation = {
        execute,
        onStart: () => {},
        onComplete: () => {},
        onError: () => {},
      };

      queueNames.forEach((name, i) => {
        operationQueue.append(operation, name);
        expect(
          execute,
          `The ${name} queue operation should have been executed`
        ).to.have.callCount(i + 1);
        expect(
          operationQueue.queues[name],
          `The ${name} queue should have a length of 1`
        ).to.have.length(1);
      });
    });
  });

  it('appends but does not execute if the queue has at least one operation enqueued', function () {
    queueNames.forEach((name) => {
      operationQueue.queues[name].push({});
    });

    const execute = sandbox.spy();
    const operation: BufferOperation = {
      execute,
      onStart: () => {},
      onComplete: () => {},
      onError: () => {},
    };

    queueNames.forEach((name) => {
      operationQueue.append(operation, name);
      expect(
        execute,
        `The ${name} queue operation should not have been executed`
      ).to.have.not.been.called;
      expect(
        operationQueue.queues[name],
        `The ${name} queue should have a length of 2`
      ).to.have.length(2);
    });
  });

  describe('appendBlocker', function () {
    it('appends a blocking promise, which resolves upon execution', function () {
      const promises: Promise<{}>[] = [];
      queueNames.forEach((name) => {
        promises.push(operationQueue.appendBlocker(name));
      });
      return Promise.all(promises).then(() => {
        queueNames.forEach((name) => {
          expect(
            operationQueue.queues[name],
            `The ${name} queue should have a length of 1`
          ).to.have.length(1);
        });
      });
    });
  });

  describe('executeNext', function () {
    it('does nothing if executing against an empty queue', function () {
      queueNames.forEach((name) => {
        expect(operationQueue.executeNext(name)).to.not.throw;
      });
    });

    it('should execute the onError callback and shift the operation if it throws an unhandled exception', function () {
      const onError = sandbox.spy();
      const error = new Error();
      const operation: BufferOperation = {
        execute: () => {
          throw error;
        },
        onStart: () => {},
        onComplete: () => {},
        onError,
      };
      queueNames.forEach((name, i) => {
        operationQueue.append(operation, name);
        expect(onError, 'onError should have been called').to.have.callCount(
          i + 1
        );
        expect(
          onError,
          'onError should have been called with the thrown exception'
        ).to.have.been.calledWith(error);
        expect(
          operationQueue.queues[name],
          `The ${name} queue should have a length of 0`
        ).to.have.length(0);
      });
    });
  });

  describe('shiftAndExecute', function () {
    const execute = sandbox.spy();
    const operation: BufferOperation = {
      execute,
      onStart: () => {},
      onComplete: () => {},
      onError: () => {},
    };
    it('should dequeue the current operation and execute the next', function () {
      queueNames.forEach((name) => {
        operationQueue.queues[name].push({}, operation);
      });

      queueNames.forEach((name, i) => {
        operationQueue.shiftAndExecuteNext(name);
        expect(
          execute,
          `The ${name} queue operation should have been executed`
        ).to.have.callCount(i + 1);
        expect(
          operationQueue.queues[name],
          `The ${name} queue should have a length of 1`
        ).to.have.length(1);
      });
    });
  });
});
