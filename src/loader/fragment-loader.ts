import { ErrorTypes, ErrorDetails } from '../errors';
import Fragment from './fragment';
import {
  Loader,
  LoaderConfiguration,
  FragmentLoaderContext,
  LoaderCallbacks
} from '../types/loader';

const MIN_CHUNK_SIZE = Math.pow(2, 17); // 128kb

export default class FragmentLoader {
  private readonly config: any;
  private loader: Loader<FragmentLoaderContext> | null = null;

  constructor (config) {
    this.config = config;
  }

  load (frag: Fragment, onProgress?: FragmentLoadProgressCallback, highWaterMark?: number): Promise<FragLoadSuccessResult | LoadError> {
    if (!frag.url) {
      return Promise.reject(new LoadError(null, 'Fragment does not have a url'));
    }

    const config = this.config;
    const FragmentILoader = config.fLoader;
    const DefaultILoader = config.loader;

    let loader = this.loader;
    if (loader) {
      // Abort the loader for current fragment. Only one may load at any given time
      loader.abort();
    }

    loader = this.loader = frag.loader =
      config.fLoader ? new FragmentILoader(config) : new DefaultILoader(config);

    const loaderContext: FragmentLoaderContext = {
      frag,
      responseType: 'arraybuffer',
      url: frag.url,
      rangeStart: 0,
      rangeEnd: 0
    };

    const start = frag.byteRangeStartOffset;
    const end = frag.byteRangeEndOffset;
    if (Number.isFinite(start) && Number.isFinite(end)) {
      loaderContext.rangeStart = start;
      loaderContext.rangeEnd = end;
    }

    const loaderConfig: LoaderConfiguration = {
      timeout: config.fragLoadingTimeOut,
      maxRetry: 0,
      retryDelay: 0,
      maxRetryDelay: config.fragLoadingMaxRetryTimeout,
      highWaterMark: Math.max(highWaterMark || 0, MIN_CHUNK_SIZE)
    };

    return new Promise((resolve, reject) => {
      if (!loader) {
        reject(new LoadError(null, 'Loader was destroyed after fragment request'));
        return;
      }
      const callbacks: LoaderCallbacks<FragmentLoaderContext> = {
        onSuccess: (response, stats, context, networkDetails) => {
          this._resetLoader(frag);
          resolve({
            payload: response.data as ArrayBuffer,
            networkDetails
          });
        },
        onError: (response, context, networkDetails) => {
          this._resetLoader(frag);
          reject(new LoadError({
            type: ErrorTypes.NETWORK_ERROR,
            details: ErrorDetails.FRAG_LOAD_ERROR,
            fatal: false,
            frag,
            response,
            networkDetails
          }));
        },
        onAbort: (stats, context, networkDetails) => {
          this._resetLoader(frag);
          reject(new LoadError({
            type: ErrorTypes.NETWORK_ERROR,
            details: ErrorDetails.INTERNAL_ABORTED,
            fatal: false,
            frag,
            networkDetails
          }));
        },
        onTimeout: (response, context, networkDetails) => {
          this._resetLoader(frag);
          reject(new LoadError({
            type: ErrorTypes.NETWORK_ERROR,
            details: ErrorDetails.FRAG_LOAD_TIMEOUT,
            fatal: false,
            frag,
            networkDetails
          }));
        },
        onProgress: (stats, context, data, networkDetails) => {
          if (onProgress) {
            onProgress({
              payload: data as ArrayBuffer,
              networkDetails
            });
          }
        }
      };
      // Assign frag stats to the loader's stats reference
      loader.stats = frag.stats;
      loader.load(loaderContext, loaderConfig, callbacks);
    });
  }

  _resetLoader (frag: Fragment) {
    frag.loader = null;
    this.loader = null;
  }
}

export class LoadError extends Error {
  private data: FragLoadFailResult | null;
  constructor (data, ...params) {
    super(...params);
    this.data = data;
  }
}

export interface FragLoadSuccessResult {
  payload: ArrayBuffer
  networkDetails: XMLHttpRequest | null
}

export interface FragLoadFailResult {
  type: string
  details: string
  fatal: boolean
  frag: Fragment
  networkDetails: XMLHttpRequest
}

export type FragmentLoadProgressCallback = (result: FragLoadSuccessResult) => void;
