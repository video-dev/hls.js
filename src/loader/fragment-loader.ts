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

  constructor (config: HlsConfig) {
    this.config = config;
  }

  abort () {
    if (this.loader) {
      // Abort the loader for current fragment. Only one may load at any given time
      this.loader.abort();
    }
  }

  load (frag: Fragment, onProgress?: FragmentLoadProgressCallback): Promise<FragLoadedData> {
    const url = frag.url;
    if (!url) {
      return Promise.reject(new LoadError({
        type: ErrorTypes.NETWORK_ERROR,
        details: ErrorDetails.FRAG_LOAD_ERROR,
        fatal: false,
        frag,
        networkDetails: null
      }, `Fragment does not have a ${url ? 'part list' : 'url'}`));
    }
    this.abort();

    const config = this.config;
    const FragmentILoader = config.fLoader;
    const DefaultILoader = config.loader;

    return new Promise((resolve, reject) => {
      const loader = this.loader = frag.loader =
        FragmentILoader ? new FragmentILoader(config) : new DefaultILoader(config) as Loader<FragmentLoaderContext>;
      const loaderContext = createLoaderContext(frag);
      const loaderConfig: LoaderConfiguration = {
        timeout: config.fragLoadingTimeOut,
        maxRetry: 0,
        retryDelay: 0,
        maxRetryDelay: config.fragLoadingMaxRetryTimeout,
        highWaterMark: MIN_CHUNK_SIZE
      };
      // Assign frag stats to the loader's stats reference
      frag.stats = loader.stats;
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

  public loadPart (frag: Fragment, part: Part, onProgress: FragmentLoadProgressCallback): Promise<FragLoadedData> {
    this.abort();

    const config = this.config;
    const FragmentILoader = config.fLoader;
    const DefaultILoader = config.loader;

    return new Promise((resolve, reject) => {
      const loader = this.loader = frag.loader =
        FragmentILoader ? new FragmentILoader(config) : new DefaultILoader(config) as Loader<FragmentLoaderContext>;
      const loaderContext = createLoaderContext(frag, part);
      const loaderConfig: LoaderConfiguration = {
        timeout: config.fragLoadingTimeOut,
        maxRetry: 0,
        retryDelay: 0,
        maxRetryDelay: config.fragLoadingMaxRetryTimeout,
        highWaterMark: MIN_CHUNK_SIZE
      };
      // Assign part stats to the loader's stats reference
      part.stats = loader.stats;
      loader.load(loaderContext, loaderConfig, {
        onSuccess: (response, stats, context, networkDetails) => {
          this.resetLoader(frag, loader);
          this.updateStatsFromPart(frag, part);
          const partLoadedData: FragLoadedData = {
            frag,
            part,
            payload: response.data as ArrayBuffer,
            networkDetails
          };
          onProgress(partLoadedData);
          resolve(partLoadedData);
        },
        onError: (response, context, networkDetails) => {
          this.resetLoader(frag, loader);
          reject(new LoadError({
            type: ErrorTypes.NETWORK_ERROR,
            details: ErrorDetails.FRAG_LOAD_ERROR,
            fatal: false,
            frag,
            part,
            response,
            networkDetails
          }));
        },
        onAbort: (stats, context, networkDetails) => {
          frag.stats.aborted = part.stats.aborted;
          this.resetLoader(frag, loader);
          reject(new LoadError({
            type: ErrorTypes.NETWORK_ERROR,
            details: ErrorDetails.INTERNAL_ABORTED,
            fatal: false,
            frag,
            part,
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
            part,
            networkDetails
          }));
        }
      });
    });
  }

  private updateStatsFromPart (frag: Fragment, part: Part) {
    const fragStats = frag.stats;
    const partStats = part.stats;
    const partTotal = partStats.total;
    fragStats.loaded += partStats.loaded;
    if (partTotal) {
      const estLoadedParts = Math.round(fragStats.loaded / partTotal);
      const estTotalParts = Math.round(frag.duration / part.duration);
      const estRemainingParts = estTotalParts - estLoadedParts;
      fragStats.total = fragStats.loaded + partStats.total + estRemainingParts * Math.round(fragStats.loaded / estLoadedParts);
    }
    const fragLoading = fragStats.loading;
    if (fragLoading.start) {
      // add to fragment loader latency
      fragLoading.first += partStats.loading.first - partStats.loading.start;
    } else {
      fragLoading.start = partStats.loading.start;
      fragLoading.first = partStats.loading.first;
    }
    fragLoading.end = partStats.loading.end;
  }

  private resetLoader (frag: Fragment, loader: Loader<FragmentLoaderContext>) {
    frag.loader = null;
    if (this.loader === loader) {
      self.clearTimeout(this.partLoadTimeout);
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
