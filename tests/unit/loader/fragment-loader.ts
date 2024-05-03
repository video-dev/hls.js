import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { hlsDefaultConfig, mergeConfig } from '../../../src/config';
import { ErrorDetails, ErrorTypes } from '../../../src/errors';
import { Fragment } from '../../../src/loader/fragment';
import FragmentLoader, { LoadError } from '../../../src/loader/fragment-loader';
import { LevelDetails } from '../../../src/loader/level-details';
import { LoadStats } from '../../../src/loader/load-stats';
import { PlaylistLevelType } from '../../../src/types/loader';
import { logger } from '../../../src/utils/logger';
import { MockXhr } from '../../mocks/loader.mock';

chai.use(sinonChai);
const expect = chai.expect;

describe('FragmentLoader tests', function () {
  let fragmentLoader: FragmentLoader;
  let frag;
  let levelDetails;
  let response;
  let context;
  let stats;
  let networkDetails;

  beforeEach(function () {
    fragmentLoader = new FragmentLoader(
      mergeConfig(hlsDefaultConfig, { loader: MockXhr }, logger),
    );
    frag = new Fragment(PlaylistLevelType.MAIN, '');
    frag.url = 'foo';
    levelDetails = new LevelDetails('');
    levelDetails.fragments.push(frag);
    response = {};
    context = {};
    stats = new LoadStats();
    networkDetails = {};
  });

  afterEach(function () {
    fragmentLoader.destroy();
  });

  it('handles successful fragment loading', function () {
    response = { data: new Uint8Array(4) };
    return new Promise<void>((resolve, reject) => {
      const onProgress = sinon.spy();
      const fragmentLoaderPrivates = fragmentLoader as any;
      fragmentLoader
        .load(frag, onProgress)
        .then((data) => {
          expect(data).to.deep.equal({
            frag,
            part: null,
            payload: response.data,
            networkDetails,
          });
          expect(frag.stats).to.exist;
          expect(fragmentLoaderPrivates.loader).to.not.exist;
          expect(frag.loader).to.not.exist;
          expect(onProgress).to.have.been.calledOnce;
          expect(onProgress).to.have.been.calledWith({
            frag,
            part: null,
            payload: response.data,
            networkDetails,
          });
          resolve();
        })
        .catch((e) => {
          reject(e);
        });
      expect(fragmentLoaderPrivates.loader).to.exist;
      expect(fragmentLoaderPrivates.loader).to.be.instanceOf(MockXhr);
      fragmentLoaderPrivates.loader.callbacks.onProgress(
        stats,
        context,
        response.data,
        networkDetails,
      );
      fragmentLoaderPrivates.loader.callbacks.onSuccess(
        response,
        stats,
        context,
        networkDetails,
      );
    });
  });

  it('should reject with a LoadError if the fragment does not have a url', function () {
    return new Promise<void>((resolve, reject) => {
      frag.url = null;
      fragmentLoader
        .load(frag, levelDetails)
        .then(() => {
          reject(new Error('Fragment loader should not have resolved'));
        })
        .catch(() => {
          resolve();
        });
    });
  });

  it('handles fragment load errors', function () {
    const fragmentLoaderPrivates = fragmentLoader as any;
    return new Promise<LoadError>((resolve, reject) => {
      fragmentLoader
        .load(frag, levelDetails)
        .then(() => {
          reject(new Error('Fragment loader should not have resolved'));
        })
        .catch((error) => {
          resolve(error);
        });
      expect(fragmentLoaderPrivates.loader).to.be.instanceOf(MockXhr);
      const stats = new LoadStats();
      fragmentLoaderPrivates.loader.callbacks.onError(
        response,
        context,
        networkDetails,
        stats,
      );
    }).then((error: LoadError) => {
      expect(error).to.be.instanceOf(LoadError);
      expect(error.data).to.deep.equal(
        {
          type: ErrorTypes.NETWORK_ERROR,
          details: ErrorDetails.FRAG_LOAD_ERROR,
          fatal: false,
          frag,
          response: { url: frag.url, data: undefined, ...response },
          error: error.data.error,
          networkDetails,
          stats,
        },
        JSON.stringify(error.data, null, 2),
      );
      expect(fragmentLoaderPrivates.loader).to.not.exist;
      expect(frag.loader).to.not.exist;
    });
  });

  it('handles fragment load timeouts', function () {
    const fragmentLoaderPrivates = fragmentLoader as any;
    return new Promise<LoadError>((resolve, reject) => {
      fragmentLoader
        .load(frag, levelDetails)
        .then(() => {
          reject(new Error('Fragment loader should not have resolved'));
        })
        .catch((error) => {
          resolve(error);
        });
      const loaderInstance: MockXhr = fragmentLoaderPrivates.loader;
      expect(loaderInstance).to.be.instanceOf(MockXhr);
      const stats = new LoadStats();
      loaderInstance.callbacks!.onTimeout(stats, context, networkDetails);
    }).then((error: LoadError) => {
      expect(error).to.be.instanceOf(LoadError);
      expect(error.data).to.deep.equal({
        type: ErrorTypes.NETWORK_ERROR,
        details: ErrorDetails.FRAG_LOAD_TIMEOUT,
        fatal: false,
        frag,
        error: error.data.error,
        networkDetails,
        stats,
      });
      expect(fragmentLoaderPrivates.loader).to.not.exist;
      expect(frag.loader).to.not.exist;
    });
  });
});
