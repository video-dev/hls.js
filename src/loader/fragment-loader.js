 /*
 * fragment loader
 *
 */

import Event                from '../events';
import observer             from '../observer';
import {ErrorTypes,ErrorDetails} from '../errors';

 class FragmentLoader {

  constructor(config) {
    this.config=config;
  }

  destroy() {
    if(this.loader) {
      this.loader.destroy();
      this.loader = null;
    }
  }

  abort() {
    if(this.loader) {
      this.loader.abort();
    }
  }

  load(frag) {
    this.frag = frag;
    this.frag.loaded = 0;
    this.loader = new this.config.loader();
    this.loader.load(frag.url,'arraybuffer',this.loadsuccess.bind(this), this.loaderror.bind(this), this.loadtimeout.bind(this), this.config.fragLoadingTimeOut, this.config.fragLoadingMaxRetry,this.config.fragLoadingRetryDelay,this.loadprogress.bind(this));
  }

  loadsuccess(event, stats) {
    var payload = event.currentTarget.response;
    stats.length = payload.byteLength;
    observer.trigger(Event.FRAG_LOADED,
                    { payload : payload,
                      frag : this.frag ,
                      stats : stats});
  }

  loaderror(event) {
    // fatal error if fail to load fragment at level 0
    observer.trigger(Event.ERROR, { type : ErrorTypes.NETWORK_ERROR, details : ErrorDetails.FRAG_LOAD_ERROR, fatal:!!this.frag.level,frag : this.frag, response:event});
  }

  loadtimeout() {
    observer.trigger(Event.ERROR, { type : ErrorTypes.NETWORK_ERROR, details : ErrorDetails.FRAG_LOAD_TIMEOUT, fatal:!!this.frag.level,frag : this.frag});
  }

  loadprogress(event, stats) {
    this.frag.loaded = stats.loaded;
   observer.trigger(Event.FRAG_LOAD_PROGRESS, { frag : this.frag, stats : stats});
  }
}

export default FragmentLoader;
