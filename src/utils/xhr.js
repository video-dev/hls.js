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

  load(url,responseType,onSuccess,onError,timeout,maxRetry,retryDelay) {
    this.url = url;
    this.responseType = responseType;
    this.onSuccess = onSuccess;
    this.onError = onError;
    this.trequest = new Date();
    this.timeout = timeout;
    this.maxRetry = maxRetry;
    this.retryDelay = retryDelay;
    this.retry = 0;
    this.loadInternal();
  }

  loadInternal() {
    var xhr = this.xhr = new XMLHttpRequest();
    xhr.onload=  this.loadsuccess.bind(this);
    xhr.onerror = xhr.ontimeout = this.loaderror.bind(this);
    xhr.onprogress = this.loadprogress.bind(this);
    xhr.open('GET', this.url , true);
    xhr.timeout = this.timeout;
    xhr.responseType = this.responseType;
    this.tfirst = null;
    xhr.send();
  }

  loadsuccess(event) {
    this.onSuccess(event,{trequest : this.trequest, tfirst : this.tfirst, tload : new Date() });
  }

  loaderror(event) {
    if(this.retry < this.maxRetry) {
      logger.log(`${event.type} while loading ${this.url}, retrying in ${this.retryDelay}...`);
      this.destroy();
      window.setTimeout(this.loadInternal.bind(this),this.retryDelay);
      // exponential backoff
      this.retryDelay=Math.min(2*this.retryDelay,64000);
      this.retry++;
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
