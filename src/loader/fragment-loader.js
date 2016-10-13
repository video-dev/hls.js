/*
 * Fragment Loader
*/

import Event from '../events';
import EventHandler from '../event-handler';
import {ErrorTypes, ErrorDetails} from '../errors';

class FragmentLoader extends EventHandler {

  constructor(hls) {
    super(hls, Event.FRAG_LOADING);
  }

  destroy() {
    var loader = this.loader;
    if (loader) {
      loader.abort();
      this.loader = null;
    }
    EventHandler.prototype.destroy.call(this);
  }

  onFragLoading(data) {
    var frag = this.frag = data.frag,
        config = this.hls.config;
    frag.loaded = 0;
    frag.loader = this.loader = typeof(config.fLoader) !== 'undefined' ? new config.fLoader(config) : new config.loader(config);
    frag.loader.load(frag.url, 'arraybuffer', this.loadsuccess.bind(this), this.loaderror.bind(this), this.loadtimeout.bind(this), config.fragLoadingTimeOut, 0, 0, this.loadprogress.bind(this), frag);
  }

  loadsuccess(event, stats) {
    var payload = event.currentTarget.response,
        frag = this.frag;
    stats.length = payload.byteLength;
    // detach fragment loader on load success
    this.loader = frag.loader = undefined;
    this.hls.trigger(Event.FRAG_LOADED, {payload: payload, frag: frag, stats: stats});
  }

  loaderror(event) {
    var loader = this.loader;
    if (loader) {
      loader.abort();
    }
    this.hls.trigger(Event.ERROR, {type: ErrorTypes.NETWORK_ERROR, details: ErrorDetails.FRAG_LOAD_ERROR, fatal: false, frag: this.frag, response: event});
  }

  loadtimeout() {
    var loader = this.loader;
    if (loader) {
      loader.abort();
    }
    this.hls.trigger(Event.ERROR, {type: ErrorTypes.NETWORK_ERROR, details: ErrorDetails.FRAG_LOAD_TIMEOUT, fatal: false, frag: this.frag});
  }

  loadprogress(event, stats) {
    var frag = this.frag;
    frag.loaded = stats.loaded;
    this.hls.trigger(Event.FRAG_LOAD_PROGRESS, {frag: frag, stats: stats});
  }
}

export default FragmentLoader;
