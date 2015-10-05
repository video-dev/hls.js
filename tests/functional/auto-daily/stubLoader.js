 /*
  * Stubbed URL Loader (for test)
  * add 1000ms of latency at beginning of loading
  * add 1000ms of latency at end of loading
  */


var stubLoader = function() {
  this.destroy = function() {
    this.abort();
    this.loader = null;
  }

  this.abort = function() {
    if(this.loader &&this.loader.readyState !== 4) {
      this.loader.abort();
    }
  }
  this.load = function(url,responseType,onSuccess,onError,onTimeout,timeout,maxRetry,retryDelay) {
    this.url = url;
    this.responseType = responseType;
    this.onSuccess = onSuccess;
    this.onTimeout = onTimeout;
    this.onError = onError;
    this.trequest = new Date();
    this.timeout = timeout;
    this.maxRetry = maxRetry;
    this.retryDelay = retryDelay;
    this.retry = 0;
    this.timeoutHandle = window.setTimeout(this.loadtimeout.bind(this),timeout);
    window.setTimeout(this.loadInternal.bind(this),1000);
    //this.loadInternal();
  }

  this.loadInternal = function() {
    var xhr = this.loader = new XMLHttpRequest();
    xhr.onload=  this.loadsuccess.bind(this);
    xhr.onerror = this.loaderror.bind(this);
    xhr.onprogress = this.loadprogress.bind(this);
    xhr.open('GET', this.url , true);
    xhr.responseType = this.responseType;
    this.tfirst = null;
    this.loaded = 0;
    xhr.send();
  }

  this.loadsuccess = function(event) {
    window.clearTimeout(this.timeoutHandle);
    window.setTimeout(this.onSuccess(event,{trequest : this.trequest, tfirst : this.tfirst, tload : new Date() }),1000);

  }

  this.loaderror = function(event) {
    if(this.retry < this.maxRetry) {
      logger.log(`${event.type} while loading ${this.url}, retrying in ${this.retryDelay}...`);
      this.destroy();
      window.setTimeout(this.loadInternal.bind(this),this.retryDelay);
      // exponential backoff
      this.retryDelay=Math.min(2*this.retryDelay,64000);
      this.retry++;
    } else {
      window.clearTimeout(this.timeoutHandle);
      logger.log(`${event.type} while loading ${this.url}` );
      this.onError(event);
    }
  }

  this.loadtimeout = function(event) {
    logger.log(`timeout while loading ${this.url}` );
    this.onTimeout(event,{trequest : this.trequest, tfirst : this.tfirst, loaded : this.loaded});
  }

  this.loadprogress = function(event) {
    if(this.tfirst === null) {
      this.tfirst = new Date();
    }
    if(event.lengthComputable) {
      this.loaded = event.loaded;
    }
  }
}



