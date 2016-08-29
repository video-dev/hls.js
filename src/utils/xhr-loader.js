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
    var loader = this.loader;
    if (loader && loader.readyState !== 4) {
      this.stats.aborted = true;
      loader.abort();
    }

    window.clearTimeout(this.requestTimeout);
    this.requestTimeout = null;
    window.clearTimeout(this.retryTimeout);
    this.retryTimeout = null;
  }

  load(url, context, responseType, onSuccess, onError, onTimeout, timeout, maxRetry, retryDelay, onProgress = null, frag = null) {
    this.url = url;
    this.context = context;
    if (context) {
      context.url = url;
    }
    if (frag && !isNaN(frag.byteRangeStartOffset) && !isNaN(frag.byteRangeEndOffset)) {
        this.byteRange = frag.byteRangeStartOffset + '-' + (frag.byteRangeEndOffset-1);
    }
    this.responseType = responseType;
    this.onSuccess = onSuccess;
    this.onProgress = onProgress;
    this.onTimeout = onTimeout;
    this.onError = onError;
    this.stats = {trequest: performance.now(), retry: 0};
    this.timeout = timeout;
    this.maxRetry = maxRetry;
    this.retryDelay = retryDelay;
    this.loadInternal();
  }

  loadInternal() {
    var xhr;

    if (typeof XDomainRequest !== 'undefined') {
       xhr = this.loader = new XDomainRequest();
    } else {
       xhr = this.loader = new XMLHttpRequest();
    }

    xhr.onloadend = this.loadend.bind(this);
    xhr.onprogress = this.loadprogress.bind(this);

    xhr.open('GET', this.url, true);
    if (this.byteRange) {
      xhr.setRequestHeader('Range', 'bytes=' + this.byteRange);
    }
    xhr.responseType = this.responseType;
    let stats = this.stats;
    stats.tfirst = 0;
    stats.loaded = 0;
    if (this.xhrSetup) {
      this.xhrSetup(xhr, this.url);
    }
    // setup timeout before we perform request
    this.requestTimeout = window.setTimeout(this.loadtimeout.bind(this), this.timeout);
    xhr.send();
  }

  loadend(event) {
    var xhr = event.currentTarget,
        status = xhr.status,
        stats = this.stats,
        context = this.context;

    // don't proceed if xhr has been aborted
    if (stats.aborted) {
      return;
    }

    // in any case clear the current xhrs timeout
    window.clearTimeout(this.requestTimeout);

    // http status between 200 to 299 are all successful
    if (status >= 200 && status < 300)  {
      stats.tload = Math.max(stats.tfirst,performance.now());
      this.onSuccess(event, stats, context);
    // everything else is a failure
    } else {
      // retry first
      if (stats.retry < this.maxRetry) {
        logger.warn(`${status} while loading ${this.url}, retrying in ${this.retryDelay}...`);
        // aborts and resets internal state
        this.destroy();
        // schedule retry
        this.retryTimeout = window.setTimeout(this.loadInternal.bind(this), this.retryDelay);
        // set exponential backoff
        this.retryDelay = Math.min(2 * this.retryDelay, 64000);
        stats.retry++;
      // permanent failure
      } else {
        logger.error(`${status} while loading ${this.url}` );
        this.onError(event, context);
      }
    }

  }

  loadtimeout() {
    logger.warn(`timeout while loading ${this.url}` );
    this.onTimeout(null, this.stats, this.context);
  }

  loadprogress(event) {
    var stats = this.stats;
    if (stats.tfirst === 0) {
      stats.tfirst = Math.max(performance.now(), stats.trequest);
    }
    stats.loaded = event.loaded;
    if (event.lengthComputable) {
      stats.total = event.total;
    }
    if (this.onProgress) {
      this.onProgress(event, stats, this.context);
    }
  }
}

export default XhrLoader;
