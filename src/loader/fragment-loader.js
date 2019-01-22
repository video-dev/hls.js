import { ErrorTypes, ErrorDetails } from '../errors';
import { logger } from '../utils/logger';

class FragmentLoader {
  constructor (config) {
    this.config = config;
    this.loader = null;
  }

  load (frag) {
    const config = this.config;
    const FragmentILoader = config.fLoader;
    const DefaultILoader = config.loader;

    // reset fragment state
    frag.loaded = 0;

    let loader = this.loader;
    if (loader) {
      logger.warn(`Aborting loader for previous ${frag.type} fragment`);
      loader.abort();
    }

    loader = this.loader = frag.loader =
      config.fLoader ? new FragmentILoader(config) : new DefaultILoader(config);

    const loaderContext = {
      frag,
      responseType: 'arraybuffer',
      url: frag.url
    };

    const start = frag.byteRangeStartOffset;
    const end = frag.byteRangeEndOffset;
    if (Number.isFinite(start) && Number.isFinite(end)) {
      loaderContext.rangeStart = start;
      loaderContext.rangeEnd = end;
    }

    const loaderConfig = {
      timeout: config.fragLoadingTimeOut,
      maxRetry: 0,
      retryDelay: 0,
      maxRetryDelay: config.fragLoadingMaxRetryTimeout
    };

    return new Promise((resolve, reject) => {
      loader.load(loaderContext, loaderConfig, {
        onSuccess: (response, stats, context, networkDetails = null) => {
          this._resetLoader(frag);
          resolve({
            payload: response.data,
            stats,
            networkDetails
          });
        },
        onError: (response, context, networkDetails = null) => {
          this._abortLoader(frag);
          reject(new LoadError({
            type: ErrorTypes.NETWORK_ERROR,
            details: ErrorDetails.FRAG_LOAD_ERROR,
            fatal: false,
            frag,
            response,
            networkDetails
          }));
        },
        onTimeout: (response, context, networkDetails = null) => {
          this._abortLoader(frag);
          reject(new LoadError({
            type: ErrorTypes.NETWORK_ERROR,
            details: ErrorDetails.FRAG_LOAD_TIMEOUT,
            fatal: false,
            frag,
            networkDetails
          }));
        }
      });
    });
  }

  _abortLoader (frag) {
    if (!frag || !frag.loader) {
      return;
    }
    frag.loader.abort();
    this._resetLoader(frag);
  }

  _resetLoader (frag) {
    frag.loader = null;
    this.loader = null;
  }
}

export class LoadError extends Error {
  constructor (data, ...params) {
    super(...params);
    this.data = data;
  }
}

export default FragmentLoader;
