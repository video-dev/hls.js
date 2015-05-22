 /*
  * Xhr helper class
  *
  */

import {logger}             from '../utils/logger';

 class Xhr {

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

  load(url,responseType,onSuccess,onError,timeout,maxAttempts, retryDelay=500) {
    this.url = url;
    this.responseType = responseType;
    this.onSuccess = onSuccess;
    this.onError = onError;
    this.trequest = new Date();
    this.timeout = timeout;
    this.maxAttempts = maxAttempts;
    this.retryDelay = retryDelay;
    this.attempts = 0;
    this.loadInternal();
  }

  loadInternal() {
    var xhr = this.xhr = new XMLHttpRequest();
    xhr.onload=  this.loadsuccess.bind(this);
    xhr.onerror = xhr.ontimeout = this.loaderror.bind(this);
    xhr.onprogress = this.loadprogress.bind(this);
    xhr.timeout = this.timeout;
    xhr.open('GET', this.url , true);
    xhr.responseType = this.responseType;
    this.attempts++;
    this.tfirst = null;
    xhr.send();
  }

  loadsuccess(event) {
    this.onSuccess(event,{trequest : this.trequest, tfirst : this.tfirst, tload : new Date() });
  }

  loaderror(event) {
    if(this.attempts < this.maxAttempts) {
      var retryDelay = this.retryDelay*this.attempts;
      this.timeout*=2;
      logger.log(`${event.type} while loading ${this.url}, retrying in ${retryDelay}...`);
      this.destroy();
      window.setTimeout(this.loadInternal.bind(this),retryDelay);
    } else {
      logger.log(`${event.type} while loading ${this.url}` );
      this.onError(event);
    }
  }

  loadprogress() {
    if(this.tfirst === null) {
      this.tfirst = new Date();
    }
  }
}

export default Xhr;
