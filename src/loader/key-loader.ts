/*
 * Decrypt key Loader
*/

import Event from '../events';
import EventHandler from '../event-handler';
import { ErrorTypes, ErrorDetails } from '../errors';
import { logger } from '../utils/logger';
import Hls from '../hls';
import Fragment from './fragment';
import { LoaderStats, LoaderResponse, LoaderContext, LoaderConfiguration, LoaderCallbacks } from '../types/loader';

interface OnKeyLoadingPayload {
  frag: Fragment
}

interface KeyLoaderContext extends LoaderContext {
  frag: Fragment
}

class KeyLoader extends EventHandler {
  public loaders = {};
  public decryptkey: Uint8Array | null = null;
  public decrypturl: string | null = null;

  constructor (hls: Hls) {
    super(hls, Event.KEY_LOADING);
  }

  destroy (): void {
    for (const loaderName in this.loaders) {
      let loader = this.loaders[loaderName];
      if (loader) {
        loader.destroy();
      }
    }
    this.loaders = {};

    super.destroy();
  }

  onKeyLoading (data: OnKeyLoadingPayload) {
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
      let config = this.hls.config;
      if (loader) {
        logger.warn(`abort previous key loader for type:${type}`);
        loader.abort();
      }
      if (!uri) {
        logger.warn('key uri is falsy');
        return;
      }

      frag.loader = this.loaders[type] = new config.loader(config);
      this.decrypturl = uri;
      this.decryptkey = null;

      const loaderContext: KeyLoaderContext = {
        url: uri,
        frag: frag,
        responseType: 'arraybuffer'
      };

      // maxRetry is 0 so that instead of retrying the same key on the same variant multiple times,
      // key-loader will trigger an error and rely on stream-controller to handle retry logic.
      // this will also align retry logic with fragment-loader
      const loaderConfig: LoaderConfiguration = {
        timeout: config.fragLoadingTimeOut,
        maxRetry: 0,
        retryDelay: config.fragLoadingRetryDelay,
        maxRetryDelay: config.fragLoadingMaxRetryTimeout
      };

      const loaderCallbacks: LoaderCallbacks<KeyLoaderContext> = {
        onSuccess: this.loadsuccess.bind(this),
        onError: this.loaderror.bind(this),
        onTimeout: this.loadtimeout.bind(this)
      };

      frag.loader.load(loaderContext, loaderConfig, loaderCallbacks);
    } else if (this.decryptkey) {
      // Return the key if it's already been loaded
      frag.decryptdata.key = this.decryptkey;
      this.hls.trigger(Event.KEY_LOADED, { frag: frag });
    }
  }

  loadsuccess (response: LoaderResponse, stats: LoaderStats, context: KeyLoaderContext) {
    let frag = context.frag;
    if (!frag.decryptdata) {
      logger.error('after key load, decryptdata unset');
      return;
    }
    this.decryptkey = frag.decryptdata.key = new Uint8Array(response.data as ArrayBuffer);

    // detach fragment loader on load success
    frag.loader = undefined;
    delete this.loaders[frag.type];
    this.hls.trigger(Event.KEY_LOADED, { frag: frag });
  }

  loaderror (response: LoaderResponse, context: KeyLoaderContext) {
    let frag = context.frag;
    let loader = frag.loader;
    if (loader) {
      loader.abort();
    }

    delete this.loaders[frag.type];
    this.hls.trigger(Event.ERROR, { type: ErrorTypes.NETWORK_ERROR, details: ErrorDetails.KEY_LOAD_ERROR, fatal: false, frag, response });
  }

  loadtimeout (stats: LoaderStats, context: KeyLoaderContext) {
    let frag = context.frag;
    let loader = frag.loader;
    if (loader) {
      loader.abort();
    }

    delete this.loaders[frag.type];
    this.hls.trigger(Event.ERROR, { type: ErrorTypes.NETWORK_ERROR, details: ErrorDetails.KEY_LOAD_TIMEOUT, fatal: false, frag });
  }
}

export default KeyLoader;
