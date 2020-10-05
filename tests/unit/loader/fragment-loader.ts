import FragmentLoader, { LoadError } from '../../../src/loader/fragment-loader';
import Fragment from '../../../src/loader/fragment';
import { ErrorDetails, ErrorTypes } from '../../../src/errors';
import LoadStats from '../../../src/loader/load-stats';
import {
  FragmentLoaderContext,
  Loader,
  LoaderCallbacks,
  LoaderContext,
  PlaylistLevelType
} from '../../../src/types/loader';
import { hlsDefaultConfig, mergeConfig } from '../../../src/config';
import type { HlsConfig } from '../../../src/config';

import * as sinon from 'sinon';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';

chai.use(sinonChai);
const expect = chai.expect;

class MockXhr implements Loader<LoaderContext> {
  context!: LoaderContext;
  loader: any;
  stats: LoadStats;
  callbacks?: LoaderCallbacks<FragmentLoaderContext>;

  constructor (confg: HlsConfig) {
    this.stats = new LoadStats();
  }

  load (context, config, callbacks) {
    this.callbacks = callbacks;
  }

  abort () {}
  destroy (): void {}
  getResponseHeader (name: string): string | null {
    return null;
  }
}

describe('FragmentLoader tests', function () {
  const sandbox = sinon.createSandbox();
  let fragmentLoader: FragmentLoader;
  let frag;
  let response;
  let context;
  let stats;
  let networkDetails;
  beforeEach(function () {
    fragmentLoader = new FragmentLoader(mergeConfig(hlsDefaultConfig, { loader: MockXhr }));
    frag = new Fragment(PlaylistLevelType.MAIN, '');
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
      const fragmentLoaderPrivates = fragmentLoader as any;
      fragmentLoader.load(frag)
        .then(data => {
          expect(data).to.deep.equal({
            frag,
            payload: response.data,
            networkDetails
          });
          expect(frag.stats).to.exist;
          expect(fragmentLoaderPrivates.loader).to.not.exist;
          expect(frag.loader).to.not.exist;
          resolve();
        })
        .catch((e) => {
          reject(e);
        });
      expect(fragmentLoaderPrivates.loader).to.exist;
      expect(fragmentLoaderPrivates.loader).to.be.instanceOf(MockXhr);
      fragmentLoaderPrivates.loader.callbacks.onSuccess(response, stats, context, networkDetails);
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
      const fragmentLoaderPrivates = fragmentLoader as any;
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
          expect(fragmentLoaderPrivates.loader).to.not.exist;
          expect(frag.loader).to.not.exist;
          resolve();
        });
      expect(fragmentLoaderPrivates.loader).to.be.instanceOf(MockXhr);
      fragmentLoaderPrivates.loader.callbacks.onError(response, context, networkDetails);
    });
  });

  it('handles fragment load timeouts', function () {
    // let abortSpy;
    return new Promise((resolve, reject) => {
      const fragmentLoaderPrivates = fragmentLoader as any;
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
          expect(fragmentLoaderPrivates.loader).to.not.exist;
          expect(frag.loader).to.not.exist;
          // expect(abortSpy).to.have.been.calledOnce();
          resolve();
        });
      const loaderInstance: MockXhr = fragmentLoaderPrivates.loader;
      expect(loaderInstance).to.be.instanceOf(MockXhr);
      // abortSpy = sinon.spy(loaderInstance.abort);
      loaderInstance.callbacks!.onTimeout(response, context, networkDetails);
    });
  });
});
