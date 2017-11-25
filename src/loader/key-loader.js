/*
 * Decrypt key Loader
*/

import Event from '../events';
import EventHandler from '../event-handler';
import {ErrorTypes, ErrorDetails} from '../errors';
import {logger} from '../utils/logger';

class KeyLoader extends EventHandler {

  constructor(hls) {
    super(hls, Event.KEY_LOADING);
    this._hls = hls;
    this._loaders = {};
    this._decryptkey = null;
    this._decrypturl = null;
  }

  destroy() {
    for (let loaderName in this._loaders) {
      let loader = this._loaders[loaderName];
      if (loader) {
        loader.destroy();
      }
    }
    this._loaders = {};
    EventHandler.prototype.destroy.call(this);
  }

  onKeyLoading(data) {
    let frag = data.frag,
        type = frag.type,
        loader = this._loaders[type],
        decryptdata = frag.decryptdata,
        uri = decryptdata.uri;
        // if uri is different from previous one or if decrypt key not retrieved yet
      if (uri !== this._decrypturl || this._decryptkey === null) {
        let config = this._hls.config;

        if (loader) {
          logger.warn(`abort previous key loader for type:${type}`);
          loader.abort();
        }
        frag.loader = this._loaders[type] = new config.loader(config);
        this._decrypturl = uri;
        this._decryptkey = null;

        let loaderContext, loaderConfig, loaderCallbacks;
        loaderContext = { url : uri, frag : frag, responseType : 'arraybuffer'};
        loaderConfig = { timeout : config.fragLoadingTimeOut, maxRetry : config.fragLoadingMaxRetry , retryDelay : config.fragLoadingRetryDelay, maxRetryDelay : config.fragLoadingMaxRetryTimeout};
        loaderCallbacks = { onSuccess : this._loadsuccess.bind(this), onError :this._loaderror.bind(this), onTimeout : this._loadtimeout.bind(this)};
        frag.loader.load(loaderContext,loaderConfig,loaderCallbacks);
      } else if (this._decryptkey) {
        // we already loaded this key, return it
        decryptdata.key = this._decryptkey;
        this._hls.trigger(Event.KEY_LOADED, {frag: frag});
      }
  }

  _loadsuccess(response, stats, context) {
    let frag = context.frag;
    this._decryptkey = frag.decryptdata.key = new Uint8Array(response.data);
    // detach fragment loader on load success
    frag.loader = undefined;
    this._loaders[frag.type] = undefined;
    this._hls.trigger(Event.KEY_LOADED, {frag: frag});
  }

  _loaderror(response, context) {
    let frag = context.frag,
        loader = frag.loader;
    if (loader) {
      loader.abort();
    }
    this._loaders[context.type] = undefined;
    this._hls.trigger(Event.ERROR, {type: ErrorTypes.NETWORK_ERROR, details: ErrorDetails.KEY_LOAD_ERROR, fatal: false, frag: frag, response: response});
  }

  _loadtimeout(stats, context) {
    let frag = context.frag,
        loader = frag.loader;
    if (loader) {
      loader.abort();
    }
    this._loaders[context.type] = undefined;
    this._hls.trigger(Event.ERROR, {type: ErrorTypes.NETWORK_ERROR, details: ErrorDetails.KEY_LOAD_TIMEOUT, fatal: false, frag: frag});
  }
}

export default KeyLoader;
