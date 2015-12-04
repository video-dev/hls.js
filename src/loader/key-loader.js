/*
 * Decrypt key Loader
*/

import Event from '../events';
import {ErrorTypes, ErrorDetails} from '../errors';

class KeyLoader {

  constructor(hls) {
    this.hls = hls;
    this.decryptkey = null;
    this.decrypturl = null;
    this.ondkl = this.onDecryptKeyLoading.bind(this);
    hls.on(Event.KEY_LOADING, this.ondkl);
  }

  destroy() {
    if (this.loader) {
      this.loader.destroy();
      this.loader = null;
    }
    this.hls.off(Event.KEY_LOADING, this.ondkl);
  }

  onDecryptKeyLoading(event, data) {
    var frag = this.frag = data.frag,
        decryptdata = frag.decryptdata,
        uri = decryptdata.uri;
        // if uri is different from previous one or if decrypt key not retrieved yet
      if (uri !== this.decrypturl || this.decryptkey === null) {
        var config = this.hls.config;
        frag.loader = this.loader = new config.loader(config);
        this.decrypturl = uri;
        this.decryptkey = null;
        frag.loader.load(uri, 'arraybuffer', this.loadsuccess.bind(this), this.loaderror.bind(this), this.loadtimeout.bind(this), config.fragLoadingTimeOut, config.fragLoadingMaxRetry, config.fragLoadingRetryDelay, this.loadprogress.bind(this), frag);
      } else if (this.decryptkey) {
        // we already loaded this key, return it
        decryptdata.key = this.decryptkey;
        this.hls.trigger(Event.KEY_LOADED, {frag: frag});
      }
  }

  loadsuccess(event) {
    var frag = this.frag;
    this.decryptkey = frag.decryptdata.key = new Uint8Array(event.currentTarget.response);
    // detach fragment loader on load success
    frag.loader = undefined;
    this.hls.trigger(Event.KEY_LOADED, {frag: frag});
  }

  loaderror(event) {
    this.loader.abort();
    this.hls.trigger(Event.ERROR, {type: ErrorTypes.NETWORK_ERROR, details: ErrorDetails.KEY_LOAD_ERROR, fatal: false, frag: this.frag, response: event});
  }

  loadtimeout() {
    this.loader.abort();
    this.hls.trigger(Event.ERROR, {type: ErrorTypes.NETWORK_ERROR, details: ErrorDetails.KEY_LOAD_TIMEOUT, fatal: false, frag: this.frag});
  }

  loadprogress() {

  }
}

export default KeyLoader;
