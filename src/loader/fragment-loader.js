 /*
 * fragment loader
 *
 */

import Event                from '../events';
import observer             from '../observer';

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
    this.loader = new this.config.loader();
    this.loader.load(frag.url,'arraybuffer',this.loadsuccess.bind(this), this.loaderror.bind(this), this.loadtimeout.bind(this), this.config.fragLoadingTimeOut, this.config.fragLoadingMaxRetry,this.config.fragLoadingRetryDelay);
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
    observer.trigger(Event.LOAD_ERROR, { url : this.frag.url, event:event});
  }

  loadtimeout() {
   observer.trigger(Event.LOAD_TIMEOUT, { url : this.frag.url});
  }
}

export default FragmentLoader;
