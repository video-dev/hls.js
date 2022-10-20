/*
 * Decrypt key Loader
 */
import { ErrorTypes, ErrorDetails } from '../errors';
import { logger } from '../utils/logger';
import {
  LoaderStats,
  LoaderResponse,
  LoaderConfiguration,
  LoaderCallbacks,
  Loader,
  KeyLoaderContext,
} from '../types/loader';
import { LoadError } from './fragment-loader';
import type { HlsConfig } from '../hls';
import type { Fragment } from '../loader/fragment';
import type { ComponentAPI } from '../types/component-api';
import type { KeyLoadedData } from '../types/events';

export default class KeyLoader implements ComponentAPI {
  private readonly config: HlsConfig;
  public loader: Loader<KeyLoaderContext> | null = null;
  public decryptkey: Uint8Array | null = null;
  public decrypturl: string | null = null;

  constructor(config: HlsConfig) {
    this.config = config;
  }

  abort(): void {
    this.loader?.abort();
  }

  destroy(): void {
    if (this.loader) {
      this.loader.destroy();
      this.loader = null;
    }
  }

  load(frag: Fragment): Promise<KeyLoadedData | void> | never {
    const type = frag.type;
    const loader = this.loader;
    if (!frag.decryptdata) {
      throw new Error('Missing decryption data on fragment in onKeyLoading');
    }

    // Load the key if the uri is different from previous one, or if the decrypt key has not yet been retrieved
    const uri = frag.decryptdata.uri;
    if (uri !== this.decrypturl || this.decryptkey === null) {
      const config = this.config;
      if (loader) {
        logger.warn(`abort previous key loader for type:${type}`);
        loader.abort();
      }
      if (!uri) {
        throw new Error('key uri is falsy');
      }
      const Loader = config.loader;
      const keyLoader =
        (frag.keyLoader =
        this.loader =
          new Loader(config) as Loader<KeyLoaderContext>);
      this.decrypturl = uri;
      this.decryptkey = null;

      return new Promise((resolve, reject) => {
        const loaderContext: KeyLoaderContext = {
          url: uri,
          frag: frag,
          part: null,
          responseType: 'arraybuffer',
        };

        // maxRetry is 0 so that instead of retrying the same key on the same variant multiple times,
        // key-loader will trigger an error and rely on stream-controller to handle retry logic.
        // this will also align retry logic with fragment-loader
        const loaderConfig: LoaderConfiguration = {
          timeout: config.fragLoadingTimeOut,
          maxRetry: 0,
          retryDelay: config.fragLoadingRetryDelay,
          maxRetryDelay: config.fragLoadingMaxRetryTimeout,
          highWaterMark: 0,
        };

        const loaderCallbacks: LoaderCallbacks<KeyLoaderContext> = {
          onSuccess: (
            response: LoaderResponse,
            stats: LoaderStats,
            context: KeyLoaderContext,
            networkDetails: any
          ) => {
            const frag = context.frag;
            if (!frag.decryptdata) {
              logger.error('after key load, decryptdata unset');
              return reject(
                new LoadError({
                  type: ErrorTypes.NETWORK_ERROR,
                  details: ErrorDetails.KEY_LOAD_ERROR,
                  fatal: false,
                  frag,
                  networkDetails,
                })
              );
            }
            this.decryptkey = frag.decryptdata.key = new Uint8Array(
              response.data as ArrayBuffer
            );

            // detach fragment key loader on load success
            frag.keyLoader = null;
            this.loader = null;
            resolve({ frag });
          },

          onError: (
            error: { code: number; text: string },
            context: KeyLoaderContext,
            networkDetails: any
          ) => {
            this.resetLoader(context.frag, keyLoader);
            reject(
              new LoadError({
                type: ErrorTypes.NETWORK_ERROR,
                details: ErrorDetails.KEY_LOAD_ERROR,
                fatal: false,
                frag,
                networkDetails,
              })
            );
          },

          onTimeout: (
            stats: LoaderStats,
            context: KeyLoaderContext,
            networkDetails: any
          ) => {
            this.resetLoader(context.frag, keyLoader);
            reject(
              new LoadError({
                type: ErrorTypes.NETWORK_ERROR,
                details: ErrorDetails.KEY_LOAD_TIMEOUT,
                fatal: false,
                frag,
                networkDetails,
              })
            );
          },

          onAbort: (
            stats: LoaderStats,
            context: KeyLoaderContext,
            networkDetails: any
          ) => {
            this.resetLoader(context.frag, keyLoader);
            reject(
              new LoadError({
                type: ErrorTypes.NETWORK_ERROR,
                details: ErrorDetails.INTERNAL_ABORTED,
                fatal: false,
                frag,
                networkDetails,
              })
            );
          },
        };

        keyLoader.load(loaderContext, loaderConfig, loaderCallbacks);
      });
    } else if (this.decryptkey) {
      // Return the key if it's already been loaded
      frag.decryptdata.key = this.decryptkey;
      return Promise.resolve({ frag });
    }
    return Promise.resolve();
  }

  private resetLoader(frag: Fragment, loader: Loader<KeyLoaderContext>) {
    if (this.loader === loader) {
      this.loader = null;
    }
    loader.destroy();
  }
}
