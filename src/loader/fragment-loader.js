 /*
 * fragment loader
 *
 */

import Event                from '../events';
import observer             from '../observer';
import {logger}             from '../utils/logger';

 class FragmentLoader {

  constructor() {
  }

  destroy() {
    this.abort();
    this.xhr = null;
  }

  abort() {
    if(this.xhr &&this.xhr.readyState !== 4) {
      this.xhr.abort();
    }
  }

  load(frag,levelId) {
    this.frag = frag;
    this.levelId = levelId;
    this.trequest = new Date();
    this.tfirst = null;
    var xhr = this.xhr = new XMLHttpRequest();
    xhr.onload=  this.loadsuccess.bind(this);
    xhr.onerror = this.loaderror.bind(this);
    xhr.onprogress = this.loadprogress.bind(this);
    xhr.open('GET', frag.url , true);
    xhr.responseType = 'arraybuffer';
    xhr.send();
    observer.trigger(Event.FRAG_LOADING, { frag : frag});
  }

  loadsuccess(event) {
    var payload = event.currentTarget.response;
    observer.trigger(Event.FRAG_LOADED,
                    { payload : payload,
                      frag : this.frag ,
                      stats : {trequest : this.trequest, tfirst : this.tfirst, tload : new Date(), length :payload.byteLength }});
  }

  loaderror(event) {
    logger.log('error loading ' + this.frag.url);
    observer.trigger(Event.LOAD_ERROR, { url : this.frag.url, event:event});
  }

  loadprogress() {
    if(this.tfirst === null) {
      this.tfirst = new Date();
    }
  }
}

export default FragmentLoader;
