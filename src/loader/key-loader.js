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
    this.loaders = {};
    this.decryptkey = null;
    this.decrypturl = null;
  }

  destroy() {
    for (let loaderName in this.loaders) {
      let loader = this.loaders[loaderName];
      if (loader) {
        loader.destroy();
      }
    }
    this.loaders = {};
    EventHandler.prototype.destroy.call(this);
  }

  onKeyLoading(data) {
    let frag = data.frag,
        type = frag.type,
        loader = this.loaders[type],
        decryptdata = frag.decryptdata,
        uri = decryptdata.uri;
        // if uri is different from previous one or if decrypt key not retrieved yet
      if (uri !== this.decrypturl || this.decryptkey === null) {
        let config = this.hls.config;

        if (loader) {
          logger.warn(`abort previous fragment loader for type:${type}`);
          loader.abort();
        }
        frag.loader = this.loaders[type] = new config.loader(config);
        this.decrypturl = uri;
        this.decryptkey = null;
        frag.loader.load(uri, { frag : frag }, 'arraybuffer', this.loadsuccess.bind(this), this.loaderror.bind(this), this.loadtimeout.bind(this), config.fragLoadingTimeOut, config.fragLoadingMaxRetry, config.fragLoadingRetryDelay, this.loadprogress.bind(this), frag);
      } else if (this.decryptkey) {
        // we already loaded this key, return it
        decryptdata.key = this.decryptkey;
        this.hls.trigger(Event.KEY_LOADED, {frag: frag});
      }
  }

  loadsuccess(event, stats, context) {
    let frag = context.frag;
    this.decryptkey = frag.decryptdata.key = new Uint8Array(event.currentTarget.response);
    // detach fragment loader on load success
    frag.loader = undefined;
    this.loaders[context.type] = undefined;
    this.hls.trigger(Event.KEY_LOADED, {frag: frag});
  }

  loaderror(event, context) {
    let frag = context.frag,
        loader = frag.loader;
    if (loader) {
      loader.abort();
    }
    this.loaders[context.type] = undefined;
    this.hls.trigger(Event.ERROR, {type: ErrorTypes.NETWORK_ERROR, details: ErrorDetails.KEY_LOAD_ERROR, fatal: false, frag: frag, response: event});
  }

  loadtimeout(event, stats, context) {
    let frag = context.frag,
        loader = frag.loader;
    if (loader) {
      loader.abort();
    }
    this.loaders[context.type] = undefined;
    this.hls.trigger(Event.ERROR, {type: ErrorTypes.NETWORK_ERROR, details: ErrorDetails.KEY_LOAD_TIMEOUT, fatal: false, frag: frag});
  }

  loadprogress() {

  }
}

export default KeyLoader;
