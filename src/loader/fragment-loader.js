/*
 * Fragment Loader
*/

import Event from '../events';
import {ErrorTypes, ErrorDetails} from '../errors';
import AES128Decrypter from '../crypt/aes128-decrypter';

class FragmentLoader {

  constructor(hls) {
    this.hls = hls;
    this.decrypter = null;
    this.onfl = this.onFragLoading.bind(this);
    this.onkl = this.onKeyLoaded.bind(this);
    hls.on(Event.FRAG_LOADING, this.onfl);
    hls.on(Event.KEY_LOADED, this.onkl);
  }

  destroy() {
    if (this.loader) {
      this.loader.destroy();
      this.loader = null;
    }
    this.hls.off(Event.FRAG_LOADING, this.onfl);
  }

  onKeyLoaded(event, data) {
    this.decrypter = new AES128Decrypter(data.key, data.iv);
  }

  onFragLoading(event, data) {
    var frag = data.frag;
    this.frag = frag;
    this.frag.loaded = 0;
    var config = this.hls.config;
    frag.loader = this.loader = new config.loader(config);
    this.loader.load(frag.url, 'arraybuffer', this.loadsuccess.bind(this), this.loaderror.bind(this), this.loadtimeout.bind(this), config.fragLoadingTimeOut, config.fragLoadingMaxRetry, config.fragLoadingRetryDelay, this.loadprogress.bind(this), frag);
  }

  dumpPayload(prefix, payload, length) {
    var string = prefix;
    var view = new DataView(payload);
    for (var i = 0; i < length; i++) {
      string += view.getUint8(i).toString(16) + ' ';
    }
    console.log(string);
  }

  loadsuccess(event, stats) {
    var payload = event.currentTarget.response;
    if (this.decrypter != null) {
      payload = this.decrypter.decrypt(payload).buffer;
    }

    stats.length = payload.byteLength;
    // detach fragment loader on load success
    this.frag.loader = undefined;
    this.hls.trigger(Event.FRAG_LOADED, {payload: payload, frag: this.frag, stats: stats});
  }

  loaderror(event) {
    this.loader.abort();
    this.hls.trigger(Event.ERROR, {type: ErrorTypes.NETWORK_ERROR, details: ErrorDetails.FRAG_LOAD_ERROR, fatal: false, frag: this.frag, response: event});
  }

  loadtimeout() {
    this.loader.abort();
    this.hls.trigger(Event.ERROR, {type: ErrorTypes.NETWORK_ERROR, details: ErrorDetails.FRAG_LOAD_TIMEOUT, fatal: false, frag: this.frag});
  }

  loadprogress(event, stats) {
    this.frag.loaded = stats.loaded;
   this.hls.trigger(Event.FRAG_LOAD_PROGRESS, {frag: this.frag, stats: stats});
  }
}

export default FragmentLoader;
