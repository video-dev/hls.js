import { ErrorTypes, ErrorDetails } from '../errors';
import Fragment from './fragment';
import {
  Loader,
  LoaderConfiguration,
  FragmentLoaderContext
} from '../types/loader';
import type { HlsConfig } from '../config';
import type { BaseSegment, Part } from './fragment';
import type { FragLoadedData } from '../types/events';

const MIN_CHUNK_SIZE = Math.pow(2, 17); // 128kb

export default class FragmentLoader {
  private readonly config: HlsConfig;
  private loader: Loader<FragmentLoaderContext> | null = null;
  private partLoadTimeout: number = -1;
  private nextPartIndex: number = -1;

  constructor (config: HlsConfig) {
    this.config = config;
  }

  abort () {
    if (this.loader) {
      // Abort the loader for current fragment. Only one may load at any given time
      console.log(`Abort frag loader ${this.loader.context.url}`, this.loader);
      this.loader.abort();
    }
  }

  load (frag: Fragment, targetBufferTime: number | null = null, onProgress?: FragmentLoadProgressCallback): Promise<FragLoadedData> {
    const url = frag.url;
    if (!url) {
      return Promise.reject(new LoadError({
        type: ErrorTypes.NETWORK_ERROR,
        details: ErrorDetails.INTERNAL_EXCEPTION,
        fatal: false,
        frag,
        networkDetails: null
      }, `Fragment does not have a ${url ? 'part list' : 'url'}`));
    }

    const config = this.config;
    const FragmentILoader = config.fLoader;
    const DefaultILoader = config.loader;

    this.abort();

    const loader = this.loader = frag.loader =
      FragmentILoader ? new FragmentILoader(config) : new DefaultILoader(config) as Loader<FragmentLoaderContext>;

    const loaderConfig: LoaderConfiguration = {
      timeout: config.fragLoadingTimeOut,
      maxRetry: 0,
      retryDelay: 0,
      maxRetryDelay: config.fragLoadingMaxRetryTimeout,
      highWaterMark: MIN_CHUNK_SIZE
    };

    const loaderContext = createLoaderContext(frag);

    return new Promise((resolve, reject) => {
      // Assign frag stats to the loader's stats reference
      loader.stats = frag.stats;
      loader.load(loaderContext, loaderConfig, {
        onSuccess: (response, stats, context, networkDetails) => {
          this.resetLoader(frag, loader);
          resolve({
            frag,
            payload: response.data as ArrayBuffer,
            networkDetails
          });
        },
        onError: (response, context, networkDetails) => {
          this.resetLoader(frag, loader);
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
          this.resetLoader(frag, loader);
          reject(new LoadError({
            type: ErrorTypes.NETWORK_ERROR,
            details: ErrorDetails.INTERNAL_ABORTED,
            fatal: false,
            frag,
            networkDetails
          }));
        },
        onTimeout: (response, context, networkDetails) => {
          this.resetLoader(frag, loader);
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
              frag,
              payload: data as ArrayBuffer,
              networkDetails
            });
          }
        }
      });
    });
  }

  private resetLoader (frag: Fragment, loader: Loader<FragmentLoaderContext>) {
    frag.loader = null;
    if (this.loader === loader) {
      self.clearTimeout(this.partLoadTimeout);
      this.nextPartIndex = -1;
      this.loader = null;
    }
  }
}

function createLoaderContext (frag: Fragment, part: Part | null = null): FragmentLoaderContext {
  const segment: BaseSegment = part || frag;
  const loaderContext: FragmentLoaderContext = {
    frag,
    part,
    responseType: 'arraybuffer',
    url: segment.url,
    rangeStart: 0,
    rangeEnd: 0
  };
  const start = segment.byteRangeStartOffset;
  const end = segment.byteRangeEndOffset;
  if (Number.isFinite(start) && Number.isFinite(end)) {
    loaderContext.rangeStart = start;
    loaderContext.rangeEnd = end;
  }
  return loaderContext;
}

export class LoadError extends Error {
  public readonly data: FragLoadFailResult;
  constructor (data: FragLoadFailResult, ...params) {
    super(...params);
    this.data = data;
  }
}

export interface FragLoadFailResult {
  type: string
  details: string
  fatal: boolean
  frag: Fragment
  part?: Part
  response?: {
    // error status code
    code: number,
    // error description
    text: string,
  }
  networkDetails: any
}

export type FragmentLoadProgressCallback = (result: FragLoadedData) => void;
