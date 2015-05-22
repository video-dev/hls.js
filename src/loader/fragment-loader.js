 /*
 * fragment loader
 *
 */

import Event                from '../events';
import observer             from '../observer';
import Xhr                  from '../utils/xhr';

 class FragmentLoader {

  constructor() {
  }

  destroy() {
    if(this.xhr) {
      this.xhr.destroy();
      this.xhr = null;
    }
  }

  abort() {
    if(this.xhr) {
      this.xhr.abort();
    }
  }

  load(frag,levelId, timeout = 60000, maxAttempts=3) {
    this.frag = frag;
    this.levelId = levelId;
    this.xhr = new Xhr();
    this.xhr.load(frag.url,'arraybuffer',this.loadsuccess.bind(this), this.loaderror.bind(this), timeout, maxAttempts);
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
}

export default FragmentLoader;
