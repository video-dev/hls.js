/*
 * Fragment Loader
*/

import Event from '../events';
import EventHandler from '../event-handler';
import {ErrorTypes, ErrorDetails} from '../errors';
import {logger} from '../utils/logger';

class FragmentLoader extends EventHandler {

  constructor(hls) {
    super(hls, Event.FRAG_LOADING);
    this._hls = hls;
    this._loaders = {};
  }

  destroy() {
    let loaders = this._loaders;
    for (let loaderName in loaders) {
      let loader = loaders[loaderName];
      if (loader) {
        loader.destroy();
      }
    }
    this._loaders = {};
    EventHandler.prototype.destroy.call(this);
  }

  onFragLoading(data) {
    let frag = data.frag,
        type = frag.type,
        loader = this._loaders[type],
        config = this._hls.config;

    frag.loaded = 0;
    if (loader) {
      logger.warn(`abort previous fragment loader for type:${type}`);
      loader.abort();
    }
    loader  = this._loaders[type] = frag.loader = typeof(config.fLoader) !== 'undefined' ? new config.fLoader(config) : new config.loader(config);

    let loaderContext, loaderConfig, loaderCallbacks;
    loaderContext = { url : frag.url, frag : frag, responseType : 'arraybuffer', progressData : false};
    let start = frag.byteRangeStartOffset, end = frag.byteRangeEndOffset;
    if (!isNaN(start) && !isNaN(end)) {
      loaderContext.rangeStart = start;
      loaderContext.rangeEnd = end;
    }
    loaderConfig = { timeout : config.fragLoadingTimeOut, maxRetry : 0 , retryDelay : 0, maxRetryDelay : config.fragLoadingMaxRetryTimeout};
    loaderCallbacks = { onSuccess : this._loadsuccess.bind(this), onError :this._loaderror.bind(this), onTimeout : this._loadtimeout.bind(this), onProgress: this._loadprogress.bind(this)};
    loader.load(loaderContext,loaderConfig,loaderCallbacks);
  }

  _loadsuccess(response, stats, context, networkDetails=null) {
    let payload = response.data, frag = context.frag;
    // detach fragment loader on load success
    frag.loader = undefined;
    this._loaders[frag.type] = undefined;
    this._hls.trigger(Event.FRAG_LOADED, {payload: payload, frag: frag, stats: stats, networkDetails: networkDetails});
  }

  _loaderror(response, context, networkDetails=null) {
    let loader = context.loader;
    if (loader) {
      loader.abort();
    }
    this._loaders[context.type] = undefined;
    this._hls.trigger(Event.ERROR, {type: ErrorTypes.NETWORK_ERROR, details: ErrorDetails.FRAG_LOAD_ERROR, fatal: false, frag: context.frag, response: response, networkDetails: networkDetails});
  }

  _loadtimeout(stats, context, networkDetails=null) {
    let loader = context.loader;
    if (loader) {
      loader.abort();
    }
    this._loaders[context.type] = undefined;
    this._hls.trigger(Event.ERROR, {type: ErrorTypes.NETWORK_ERROR, details: ErrorDetails.FRAG_LOAD_TIMEOUT, fatal: false, frag: context.frag, networkDetails: networkDetails});
  }

  // data will be used for progressive parsing
  _loadprogress(stats, context, data, networkDetails=null) { // jshint ignore:line
    let frag = context.frag;
    frag.loaded = stats.loaded;
    this._hls.trigger(Event.FRAG_LOAD_PROGRESS, {frag: frag, stats: stats, networkDetails: networkDetails});
  }
}

export default FragmentLoader;
