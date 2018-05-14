/*
 * Fragment Loader
*/

import Event from '../events';
import EventHandler from '../event-handler';
import { ErrorTypes, ErrorDetails } from '../errors';
import { logger } from '../utils/logger';

class FragmentLoader extends EventHandler {
  constructor (hls) {
    super(hls, Event.FRAG_LOADING);
    this.loaders = {};
  }

  destroy () {
    let loaders = this.loaders;
    for (let loaderName in loaders) {
      let loader = loaders[loaderName];
      if (loader) {
        loader.destroy();
      }
    }
    this.loaders = {};

    super.destroy();
  }

  onFragLoading (data) {
    const frag = data.frag,
      type = frag.type,
      loaders = this.loaders,
      config = this.hls.config,
      FragmentILoader = config.fLoader,
      DefaultILoader = config.loader;

    // reset fragment state
    frag.loaded = 0;

    let loader = loaders[type];
    if (loader) {
      logger.warn(`abort previous fragment loader for type: ${type}`);
      loader.abort();
    }

    loader = loaders[type] = frag.loader =
      config.fLoader ? new FragmentILoader(config) : new DefaultILoader(config);

    let loaderContext, loaderConfig, loaderCallbacks;

    loaderContext = { url: frag.url, frag: frag, responseType: 'arraybuffer', progressData: false };

    let start = frag.byteRangeStartOffset,
      end = frag.byteRangeEndOffset;

    if (!isNaN(start) && !isNaN(end)) {
      loaderContext.rangeStart = start;
      loaderContext.rangeEnd = end;
    }

    loaderConfig = {
      timeout: config.fragLoadingTimeOut,
      maxRetry: 0,
      retryDelay: 0,
      maxRetryDelay: config.fragLoadingMaxRetryTimeout
    };

    loaderCallbacks = {
      onSuccess: this.loadsuccess.bind(this),
      onError: this.loaderror.bind(this),
      onTimeout: this.loadtimeout.bind(this),
      onProgress: this.loadprogress.bind(this)
    };

    loader.load(loaderContext, loaderConfig, loaderCallbacks);
  }

  loadsuccess (response, stats, context, networkDetails = null) {
    let payload = response.data, frag = context.frag;
    // detach fragment loader on load success
    frag.loader = undefined;
    this.loaders[frag.type] = undefined;
    this.hls.trigger(Event.FRAG_LOADED, { payload: payload, frag: frag, stats: stats, networkDetails: networkDetails });
  }

  loaderror (response, context, networkDetails = null) {
    let loader = context.loader;
    if (loader) {
      loader.abort();
    }

    this.loaders[context.type] = undefined;
    this.hls.trigger(Event.ERROR, { type: ErrorTypes.NETWORK_ERROR, details: ErrorDetails.FRAG_LOAD_ERROR, fatal: false, frag: context.frag, response: response, networkDetails: networkDetails });
  }

  loadtimeout (stats, context, networkDetails = null) {
    let loader = context.loader;
    if (loader) {
      loader.abort();
    }

    this.loaders[context.type] = undefined;
    this.hls.trigger(Event.ERROR, { type: ErrorTypes.NETWORK_ERROR, details: ErrorDetails.FRAG_LOAD_TIMEOUT, fatal: false, frag: context.frag, networkDetails: networkDetails });
  }

  // data will be used for progressive parsing
  loadprogress (stats, context, data, networkDetails = null) { // jshint ignore:line
    let frag = context.frag;
    frag.loaded = stats.loaded;
    this.hls.trigger(Event.FRAG_LOAD_PROGRESS, { frag: frag, stats: stats, networkDetails: networkDetails });
  }
}

export default FragmentLoader;
