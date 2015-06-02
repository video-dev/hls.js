/*
  * Xhr based Loader
  *
  */

import { logger } from '../utils/logger';

class XhrLoader {
    constructor() {}

    destroy() {
        this.abort();
        this.loader = null;
    }

    abort() {
        if (this.loader && this.loader.readyState !== 4) {
            this.loader.abort();
        }
        if (this.timeoutHandle) {
            window.clearTimeout(this.timeoutHandle);
        }
    }

    load(
        url,
        responseType,
        onSuccess,
        onError,
        onTimeout,
        timeout,
        maxRetry,
        retryDelay
    ) {
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
        this.timeoutHandle = window.setTimeout(
            this.loadtimeout.bind(this),
            timeout
        );
        this.loadInternal();
    }

    loadInternal() {
        var xhr = (this.loader = new XMLHttpRequest());
        xhr.onload = this.loadsuccess.bind(this);
        xhr.onerror = this.loaderror.bind(this);
        xhr.onprogress = this.loadprogress.bind(this);
        xhr.open('GET', this.url, true);
        xhr.responseType = this.responseType;
        this.tfirst = null;
        this.loaded = 0;
        xhr.send();
    }

    loadsuccess(event) {
        window.clearTimeout(this.timeoutHandle);
        this.onSuccess(event, {
            trequest: this.trequest,
            tfirst: this.tfirst,
            tload: new Date(),
            loaded: this.loaded
        });
    }

    loaderror(event) {
        if (this.retry < this.maxRetry) {
            logger.log(
                `${event.type} while loading ${this.url}, retrying in ${
                    this.retryDelay
                }...`
            );
            this.destroy();
            window.setTimeout(this.loadInternal.bind(this), this.retryDelay);
            // exponential backoff
            this.retryDelay = Math.min(2 * this.retryDelay, 64000);
            this.retry++;
        } else {
            window.clearTimeout(this.timeoutHandle);
            logger.log(`${event.type} while loading ${this.url}`);
            this.onError(event);
        }
    }

    loadtimeout(event) {
        logger.log(`timeout while loading ${this.url}`);
        this.onTimeout(event, {
            trequest: this.trequest,
            tfirst: this.tfirst,
            loaded: this.loaded
        });
    }

    loadprogress(event) {
        if (this.tfirst === null) {
            this.tfirst = new Date();
        }
        if (event.lengthComputable) {
            this.loaded = event.loaded;
        }
    }
}

export default XhrLoader;
