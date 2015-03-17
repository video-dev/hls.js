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
    if(this.xhr &&this.xhr.readyState !== 4) {
      this.xhr.abort();
      this.xhr = null;
    }
  }

  load(url) {
    this.url = url;
    this.trequest = new Date();
    this.tfirst = null;
    var xhr = this.xhr = new XMLHttpRequest();
    xhr.onload=  this.loadsuccess.bind(this);
    xhr.onerror = this.loaderror.bind(this);
    xhr.onprogress = this.loadprogress.bind(this);
    xhr.open('GET', url , true);
    xhr.responseType = 'arraybuffer';
    xhr.send();
    observer.trigger(Event.FRAGMENT_LOADING, { url: this.url});
  }

  loadsuccess(event) {
    var response = event.currentTarget.response;
    observer.trigger(Event.FRAGMENT_LOADED,
                    { payload : response,
                      url : this.url ,
                      stats : {trequest : this.trequest, tfirst : this.tfirst, tend : new Date(), length :response.byteLength }});
  }

  loaderror(event) {
    logger.log('error loading ' + this.url);
    observer.trigger(Event.LOAD_ERROR, { url : this.url, event:event});
  }

  loadprogress() {
    if(this.tfirst === null) {
      this.tfirst = new Date();
    }
  }
}

export default FragmentLoader;
