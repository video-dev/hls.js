/*
 * Decrypt key Loader
 */
import { Events } from '../events';
import { ErrorTypes, ErrorDetails } from '../errors';
import { logger } from '../utils/logger';
import type Hls from '../hls';
import { Fragment } from './fragment';
import {
  LoaderStats,
  LoaderResponse,
  LoaderContext,
  LoaderConfiguration,
  LoaderCallbacks,
  Loader,
  FragmentLoaderContext,
} from '../types/loader';
import type { ComponentAPI } from '../types/component-api';
import type { KeyLoadingData } from '../types/events';

interface KeyLoaderContext extends LoaderContext {
  frag: Fragment;
}

export default class KeyLoader implements ComponentAPI {
  private hls: Hls;
  public loaders = {};
  public decryptkey: Uint8Array | null = null;
  public decrypturl: string | null = null;

  constructor(hls: Hls) {
    this.hls = hls;

    this._registerListeners();
  }

  private _registerListeners() {
    this.hls.on(Events.KEY_LOADING, this.onKeyLoading, this);
  }

  private _unregisterListeners() {
    this.hls.off(Events.KEY_LOADING, this.onKeyLoading);
  }

  destroy(): void {
    this._unregisterListeners();
    for (const loaderName in this.loaders) {
      const loader = this.loaders[loaderName];
      if (loader) {
        loader.destroy();
      }
    }
    this.loaders = {};
  }

  onKeyLoading(event: Events.KEY_LOADING, data: KeyLoadingData) {
    const { frag } = data;
    const type = frag.type;
    const loader = this.loaders[type];
    if (!frag.decryptdata) {
      logger.warn('Missing decryption data on fragment in onKeyLoading');
      return;
    }

    // Load the key if the uri is different from previous one, or if the decrypt key has not yet been retrieved
    const uri = frag.decryptdata.uri;
    if (uri !== this.decrypturl || this.decryptkey === null) {
      const config = this.hls.config;
      if (loader) {
        logger.warn(`abort previous key loader for type:${type}`);
        loader.abort();
      }
      if (!uri) {
        logger.warn('key uri is falsy');
        return;
      }
      const Loader = config.loader;
      const fragLoader =
        (frag.loader =
        this.loaders[type] =
          new Loader(config) as Loader<FragmentLoaderContext>);
      this.decrypturl = uri;
      this.decryptkey = null;

      const loaderContext: KeyLoaderContext = {
        url: uri,
        frag: frag,
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
        onSuccess: this.loadsuccess.bind(this),
        onError: this.loaderror.bind(this),
        onTimeout: this.loadtimeout.bind(this),
      };

      fragLoader.load(loaderContext, loaderConfig, loaderCallbacks);
    } else if (this.decryptkey) {
      // Return the key if it's already been loaded
      frag.decryptdata.key = this.decryptkey;
      this.hls.trigger(Events.KEY_LOADED, { frag: frag });
    }
  }

  loadsuccess(
    response: LoaderResponse,
    stats: LoaderStats,
    context: KeyLoaderContext
  ) {
    const frag = context.frag;
    if (!frag.decryptdata) {
      logger.error('after key load, decryptdata unset');
      return;
    }
    this.decryptkey = frag.decryptdata.key = new Uint8Array(
      response.data as ArrayBuffer
    );

    // detach fragment loader on load success
    frag.loader = null;
    delete this.loaders[frag.type];
    this.hls.trigger(Events.KEY_LOADED, { frag: frag });
  }

  loaderror(response: LoaderResponse, context: KeyLoaderContext) {
    const frag = context.frag;
    const loader = frag.loader;
    if (loader) {
      loader.abort();
    }

    delete this.loaders[frag.type];
    this.hls.trigger(Events.ERROR, {
      type: ErrorTypes.NETWORK_ERROR,
      details: ErrorDetails.KEY_LOAD_ERROR,
      fatal: false,
      frag,
      response,
    });
  }

  loadtimeout(stats: LoaderStats, context: KeyLoaderContext) {
    const frag = context.frag;
    const loader = frag.loader;
    if (loader) {
      loader.abort();
    }

    delete this.loaders[frag.type];
    this.hls.trigger(Events.ERROR, {
      type: ErrorTypes.NETWORK_ERROR,
      details: ErrorDetails.KEY_LOAD_TIMEOUT,
      fatal: false,
      frag,
    });
  }
}
