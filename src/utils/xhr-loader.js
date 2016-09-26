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
    var loader = this.loader,
        timeoutHandle = this.timeoutHandle;
    if (loader && loader.readyState !== 4) {
      this.stats.aborted = true;
      loader.abort();
    }
    if (timeoutHandle) {
      window.clearTimeout(timeoutHandle);
    }
  }

  load(url, responseType, onSuccess, onError, onTimeout, timeout, maxRetry, retryDelay, onProgress = null, frag = null) {
    this.url = url;
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

    xhr.onreadystatechange = this.readystatechange.bind(this);
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
    this.timeoutHandle = window.setTimeout(this.loadtimeout.bind(this), this.timeout);
    xhr.send();
  }

  readystatechange(event) {
    var xhr = event.currentTarget,
        readystate = xhr.readyState,
        stats = this.stats;
    // don't proceed if xhr has been aborted
    if (!stats.aborted) {
      // HEADERS_RECEIVED
      if (readystate >=2) {
        if (stats.tfirst === 0) {
          stats.tfirst = Math.max(performance.now(), stats.trequest);
        }
        if (readystate === 4) {
          let status = xhr.status;
          // http status between 200 to 299 are all successful
          if (status >= 200 && status < 300)  {
            window.clearTimeout(this.timeoutHandle);
            stats.tload = Math.max(stats.tfirst,performance.now());
            this.onSuccess(event, stats);
          } else {
              // if max nb of retries reached or if http status between 400 and 499 (such error cannot be recovered, retrying is useless), return error
            if (stats.retry >= this.maxRetry || (status >= 400 && status < 499)) {
              window.clearTimeout(this.timeoutHandle);
              logger.error(`${status} while loading ${this.url}` );
              this.onError(event);
            } else {
              logger.warn(`${status} while loading ${this.url}, retrying in ${this.retryDelay}...`);
              this.destroy();
              window.setTimeout(this.loadInternal.bind(this), this.retryDelay);
              // exponential backoff
              this.retryDelay = Math.min(2 * this.retryDelay, 64000);
              stats.retry++;
            }
          }
        }
      }
    }
  }

  loadtimeout(event) {
    logger.warn(`timeout while loading ${this.url}` );
    this.onTimeout(event, this.stats);
  }

  loadprogress(event) {
    var stats = this.stats;
    stats.loaded = event.loaded;
    if (this.onProgress) {
      this.onProgress(event, stats);
    }
  }
}

export default XhrLoader;
