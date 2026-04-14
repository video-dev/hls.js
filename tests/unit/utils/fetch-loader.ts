import { expect } from 'chai';
import sinon from 'sinon';
import { hlsDefaultConfig } from '../../../src/config';
import { LoaderContextType } from '../../../src/types/loader';
import FetchLoader from '../../../src/utils/fetch-loader';
import type { LoaderConfig } from '../../../src/config';
import type {
  LoaderConfiguration,
  LoaderContext,
} from '../../../src/types/loader';

describe('FetchLoader', function () {
  let fetchLoader: FetchLoader;
  let context: LoaderContext;
  let config: LoaderConfiguration;
  let callbacks: any;
  let sandbox: sinon.SinonSandbox;

  const createLoaderConfig = (
    overrides?: Partial<{
      errorRetry: LoaderConfig['errorRetry'];
      timeoutRetry: LoaderConfig['timeoutRetry'];
    }>,
  ): LoaderConfiguration => ({
    loadPolicy: {
      maxTimeToFirstByteMs: 8000,
      maxLoadTimeMs: 10000,
      timeoutRetry: {
        maxNumRetry: 2,
        retryDelayMs: 100,
        maxRetryDelayMs: 1000,
      },
      errorRetry: {
        maxNumRetry: 3,
        retryDelayMs: 100,
        maxRetryDelayMs: 1000,
      },
      ...overrides,
    },
    maxRetry: 0,
    timeout: 10000,
    retryDelay: 0,
    maxRetryDelay: 0,
  });

  beforeEach(function () {
    sandbox = sinon.createSandbox();
    fetchLoader = new FetchLoader(hlsDefaultConfig);
    context = {
      url: 'https://example.com/test.m3u8',
      responseType: 'text',
      type: LoaderContextType.MANIFEST,
    };
    config = createLoaderConfig();
    callbacks = {
      onSuccess: sandbox.stub(),
      onError: sandbox.stub(),
      onTimeout: sandbox.stub(),
      onAbort: sandbox.stub(),
      onProgress: sandbox.stub(),
    };
  });

  afterEach(function () {
    fetchLoader.destroy();
    sandbox.restore();
  });

  describe('retry on HTTP error', function () {
    it('should retry on 503 Service Unavailable', function (done) {
      let attemptCount = 0;

      sandbox.stub(self, 'fetch').callsFake(() => {
        attemptCount++;
        return Promise.resolve(
          new Response('Service Unavailable', {
            status: 503,
            statusText: 'Service Unavailable',
          }),
        );
      });

      callbacks.onError = sandbox.stub().callsFake(() => {
        // 1 initial + 3 retries = 4 total attempts
        expect(attemptCount).to.equal(4);
        expect(fetchLoader.stats.retry).to.equal(3);
        done();
      });

      fetchLoader.load(context, config, callbacks);
    });

    it('should NOT retry on 404 Not Found', function (done) {
      sandbox.stub(self, 'fetch').callsFake(() => {
        return Promise.resolve(
          new Response('Not Found', {
            status: 404,
            statusText: 'Not Found',
          }),
        );
      });

      callbacks.onError = sandbox.stub().callsFake(() => {
        expect(fetchLoader.stats.retry).to.equal(0);
        done();
      });

      fetchLoader.load(context, config, callbacks);
    });

    it('should NOT retry on 400 Bad Request', function (done) {
      sandbox.stub(self, 'fetch').callsFake(() => {
        return Promise.resolve(
          new Response('Bad Request', {
            status: 400,
            statusText: 'Bad Request',
          }),
        );
      });

      callbacks.onError = sandbox.stub().callsFake(() => {
        expect(fetchLoader.stats.retry).to.equal(0);
        done();
      });

      fetchLoader.load(context, config, callbacks);
    });

    it('should call onSuccess if retry succeeds', function (done) {
      let attemptCount = 0;

      sandbox.stub(self, 'fetch').callsFake(() => {
        attemptCount++;
        if (attemptCount === 1) {
          return Promise.resolve(
            new Response('Service Unavailable', {
              status: 503,
              statusText: 'Service Unavailable',
            }),
          );
        }
        return Promise.resolve(
          new Response('ok', { status: 200, statusText: 'OK' }),
        );
      });

      callbacks.onSuccess = sandbox.stub().callsFake(() => {
        expect(attemptCount).to.equal(2);
        expect(fetchLoader.stats.retry).to.equal(1);
        done();
      });

      fetchLoader.load(context, config, callbacks);
    });
  });

  describe('retry on network error', function () {
    it('should retry on fetch rejection when offline', function (done) {
      let attemptCount = 0;

      sandbox.stub(self, 'fetch').callsFake(() => {
        attemptCount++;
        return Promise.reject(new Error('Failed to fetch'));
      });

      // Simulate offline
      sandbox.stub(navigator, 'onLine').get(() => false);

      callbacks.onError = sandbox.stub().callsFake(() => {
        expect(attemptCount).to.equal(4);
        expect(fetchLoader.stats.retry).to.equal(3);
        done();
      });

      fetchLoader.load(context, config, callbacks);
    });
  });

  describe('no retry when errorRetry is null', function () {
    it('should not retry when errorRetry config is null', function (done) {
      config = createLoaderConfig({ errorRetry: null });
      let attemptCount = 0;

      sandbox.stub(self, 'fetch').callsFake(() => {
        attemptCount++;
        return Promise.resolve(
          new Response('Error', { status: 503, statusText: 'Error' }),
        );
      });

      callbacks.onError = sandbox.stub().callsFake(() => {
        expect(attemptCount).to.equal(1);
        expect(fetchLoader.stats.retry).to.equal(0);
        done();
      });

      fetchLoader.load(context, config, callbacks);
    });
  });

  describe('abort during retry', function () {
    it('should cancel pending retry when abort is called', function (done) {
      const clock = sandbox.useFakeTimers();

      const fetchStub = sandbox.stub(self, 'fetch').callsFake(() => {
        return Promise.resolve(
          new Response('Error', { status: 503, statusText: 'Error' }),
        );
      });

      fetchLoader.load(context, config, callbacks);

      // Flush microtasks so the promise chain settles and retry is scheduled
      // eslint-disable-next-line no-void
      void clock.tickAsync(0).then(() => {
        // Retry has been scheduled but not yet fired
        expect(fetchStub.calledOnce).to.be.true;
        expect(fetchLoader.stats.retry).to.equal(1);

        fetchLoader.abort();

        expect(fetchLoader.stats.aborted).to.be.true;

        // Advance clock past retry delay — loadInternal should NOT fire
        clock.tick(1000);

        expect(callbacks.onError.called).to.be.false;
        expect(callbacks.onSuccess.called).to.be.false;
        done();
      });
    });
  });

  describe('custom shouldRetry', function () {
    it('should use custom shouldRetry callback from RetryConfig', function (done) {
      const customShouldRetry = sandbox.stub().returns(false);
      config = createLoaderConfig({
        errorRetry: {
          maxNumRetry: 3,
          retryDelayMs: 100,
          maxRetryDelayMs: 1000,
          shouldRetry: customShouldRetry,
        },
      });

      sandbox.stub(self, 'fetch').callsFake(() => {
        return Promise.resolve(
          new Response('Error', { status: 503, statusText: 'Error' }),
        );
      });

      callbacks.onError = sandbox.stub().callsFake(() => {
        expect(customShouldRetry.calledOnce).to.be.true;
        expect(fetchLoader.stats.retry).to.equal(0);
        done();
      });

      fetchLoader.load(context, config, callbacks);
    });
  });

  describe('timeout retry', function () {
    it('should retry on timeout when timeoutRetry is configured', function (done) {
      let attemptCount = 0;

      sandbox.stub(self, 'fetch').callsFake(() => {
        attemptCount++;
        // Never resolve to trigger timeout
        return new Promise(() => {});
      });

      // Use very short timeouts for test
      config = createLoaderConfig({
        timeoutRetry: {
          maxNumRetry: 2,
          retryDelayMs: 10,
          maxRetryDelayMs: 50,
        },
      });
      config.loadPolicy.maxTimeToFirstByteMs = 50;
      config.loadPolicy.maxLoadTimeMs = 50;

      callbacks.onTimeout = sandbox.stub().callsFake(() => {
        // 1 initial + 2 retries = 3 total attempts
        expect(attemptCount).to.equal(3);
        expect(fetchLoader.stats.retry).to.equal(2);
        done();
      });

      fetchLoader.load(context, config, callbacks);
    });

    it('should not retry on timeout when timeoutRetry is null', function (done) {
      sandbox.stub(self, 'fetch').callsFake(() => {
        return new Promise(() => {});
      });

      config = createLoaderConfig({ timeoutRetry: null });
      config.loadPolicy.maxTimeToFirstByteMs = 50;
      config.loadPolicy.maxLoadTimeMs = 50;

      callbacks.onTimeout = sandbox.stub().callsFake(() => {
        expect(fetchLoader.stats.retry).to.equal(0);
        done();
      });

      fetchLoader.load(context, config, callbacks);
    });
  });
});
