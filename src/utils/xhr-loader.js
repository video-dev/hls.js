/**
 * XHR based logger
*/

import {logger} from '../utils/logger';

class XhrLoader {

  constructor(config) {
    if (config && config.xhrSetup) {
      this.xhrSetup = config.xhrSetup;
    }
  }

  destroy() {
    this.abort();
    this.loader = null;
  }

  abort() {
    if (this.loader && this.loader.readyState !== 4) {
      this.stats.aborted = true;
      this.loader.abort();
    }
    if (this.timeoutHandle) {
      window.clearTimeout(this.timeoutHandle);
    }
  }

  load(url, responseType, onSuccess, onError, onTimeout, timeout, maxRetry, retryDelay, onProgress = null) {
    this.url = url;
    this.responseType = responseType;
    this.onSuccess = onSuccess;
    this.onProgress = onProgress;
    this.onTimeout = onTimeout;
    this.onError = onError;
    this.stats = {trequest: new Date(), retry: 0};
    this.timeout = timeout;
    this.maxRetry = maxRetry;
    this.retryDelay = retryDelay;
    this.timeoutHandle = window.setTimeout(this.loadtimeout.bind(this), timeout);
    this.loadInternal();
  }

  loadInternal() {
    var xhr = this.loader = new XMLHttpRequest();
    xhr.onload =  this.loadsuccess.bind(this);
    xhr.onerror = this.loaderror.bind(this);
    xhr.onprogress = this.loadprogress.bind(this);
    xhr.open('GET', this.url, true);
    xhr.responseType = this.responseType;
    this.stats.tfirst = null;
    this.stats.loaded = 0;
    if (this.xhrSetup) {
      this.xhrSetup(xhr);
    }
    xhr.send();
  }

  loadsuccess(event) {
    window.clearTimeout(this.timeoutHandle);
    this.stats.tload = new Date();
    this.onSuccess(event, this.stats);
  }

  loaderror(event) {
    if (this.stats.retry < this.maxRetry) {
      logger.warn(`${event.type} while loading ${this.url}, retrying in ${this.retryDelay}...`);
      this.destroy();
      window.setTimeout(this.loadInternal.bind(this), this.retryDelay);
      // exponential backoff
      this.retryDelay = Math.min(2 * this.retryDelay, 64000);
      this.stats.retry++;
    } else {
      window.clearTimeout(this.timeoutHandle);
      logger.error(`${event.type} while loading ${this.url}` );
      this.onError(event);
    }
  }

  loadtimeout(event) {
    logger.warn(`timeout while loading ${this.url}` );
    this.onTimeout(event, this.stats);
  }

  loadprogress(event) {
    var stats = this.stats;
    if (stats.tfirst === null) {
      stats.tfirst = new Date();
    }
    stats.loaded = event.loaded;
    if (this.onProgress) {
      this.onProgress(event, stats);
    }
  }
}

export default XhrLoader;
