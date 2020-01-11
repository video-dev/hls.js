import FragmentLoader, { LoadError } from '../../../src/loader/fragment-loader';
import Fragment from '../../../src/loader/fragment';
import { ErrorDetails, ErrorTypes } from '../../../src/errors';
import sinon from 'sinon';
import LoadStats from '../../../src/loader/load-stats';

class MockXhr {
  constructor () {
    this.stats = new LoadStats();
  }

  load (context, config, callbacks) {
    this.callbacks = callbacks;
  }

  abort () {}
}

describe('FragmentLoader tests', function () {
  const sandbox = sinon.createSandbox();
  let fragmentLoader;
  let frag;
  let response;
  let context;
  let stats;
  let networkDetails;
  beforeEach(function () {
    fragmentLoader = new FragmentLoader({ loader: MockXhr });
    frag = new Fragment();
    frag.url = 'foo';
    response = {};
    context = {};
    stats = new LoadStats();
    networkDetails = {};
  });

  afterEach(function () {
    sandbox.restore();
  });

  it('handles successful fragment loading', function () {
    response = { data: new Uint8Array(4) };
    return new Promise((resolve, reject) => {
      fragmentLoader.load(frag)
        .then(data => {
          expect(data).to.deep.equal({
            payload: response.data,
            networkDetails
          });
          expect(frag.stats).to.exist;
          expect(fragmentLoader.loader).to.not.exist;
          expect(frag.loader).to.not.exist;
          resolve();
        })
        .catch((e) => {
          reject(e);
        });
      expect(fragmentLoader.loader).to.exist;
      expect(fragmentLoader.loader).to.be.instanceOf(MockXhr);
      fragmentLoader.loader.callbacks.onSuccess(response, context, stats, networkDetails);
    });
  });

  it('should reject with a LoadError if the fragment does not have a url', function () {
    return new Promise((resolve, reject) => {
      frag.url = null;
      fragmentLoader.load(frag)
        .then(() => {
          reject(new Error('Fragment loader should not have resolved'));
        })
        .catch(() => {
          resolve();
        });
    });
  });

  it('handles fragment load errors', function () {
    return new Promise((resolve, reject) => {
      fragmentLoader.load(frag)
        .then(() => {
          reject(new Error('Fragment loader should not have resolved'));
        })
        .catch((error) => {
          expect(error).to.be.instanceOf(LoadError);
          expect(error.data).to.deep.equal({
            type: ErrorTypes.NETWORK_ERROR,
            details: ErrorDetails.FRAG_LOAD_ERROR,
            fatal: false,
            frag,
            response,
            networkDetails
          });
          expect(fragmentLoader.loader).to.not.exist;
          expect(frag.loader).to.not.exist;
          resolve();
        });
      expect(fragmentLoader.loader).to.be.instanceOf(MockXhr);
      fragmentLoader.loader.callbacks.onError(response, context, networkDetails);
    });
  });

  it('handles fragment load timeouts', function () {
    // let abortSpy;
    return new Promise((resolve, reject) => {
      fragmentLoader.load(frag)
        .then(() => {
          reject(new Error('Fragment loader should not have resolved'));
        })
        .catch((error) => {
          expect(error).to.be.instanceOf(LoadError);
          expect(error.data).to.deep.equal({
            type: ErrorTypes.NETWORK_ERROR,
            details: ErrorDetails.FRAG_LOAD_TIMEOUT,
            fatal: false,
            frag,
            networkDetails
          });
          expect(fragmentLoader.loader).to.not.exist;
          expect(frag.loader).to.not.exist;
          // expect(abortSpy).to.have.been.calledOnce();
          resolve();
        });
      const loaderInstance = fragmentLoader.loader;
      expect(loaderInstance).to.be.instanceOf(MockXhr);
      // abortSpy = sinon.spy(loaderInstance.abort);
      loaderInstance.callbacks.onTimeout(response, context, networkDetails);
    });
  });
});
