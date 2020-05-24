import { logger } from '../utils/logger';
import { LoaderCallbacks, LoaderContext, LoaderStats, Loader, LoaderConfiguration } from '../types/loader';
import LoadStats, { reset } from '../loader/load-stats';

class XhrLoader implements Loader<LoaderContext> {
  private xhrSetup: Function | null;
  private requestTimeout?: number;
  private retryTimeout?: number | undefined;
  private retryDelay: number;
  private config!: LoaderConfiguration;
  private callbacks!: LoaderCallbacks<LoaderContext>;
  public context!: LoaderContext;

  public loader: XMLHttpRequest | null;
  public stats: LoaderStats;

  constructor (config /* HlsConfig */) {
    this.xhrSetup = config ? config.xhrSetup : null;
    this.loader = null;
    this.stats = new LoadStats();
    this.retryDelay = 0;
  }

  destroy (): void {
    this.abortInternal();
    this.loader = null;
  }

  abortInternal (): void {
    this.stats.aborted = true;
    const loader = this.loader;
    if (loader && loader.readyState !== 4) {
      loader.abort();
    }
    self.clearTimeout(this.requestTimeout);
    this.requestTimeout = -1;
    self.clearTimeout(this.retryTimeout);
    this.retryTimeout = -1;
  }

  abort (): void {
    this.abortInternal();
    if (this.callbacks.onAbort) {
      this.callbacks.onAbort(this.stats, this.context, this.loader);
    }
  }

  load (context: LoaderContext, config: LoaderConfiguration, callbacks: LoaderCallbacks<LoaderContext>): void {
    this.context = context;
    this.config = config;
    this.callbacks = callbacks;
    reset(this.stats);
    this.stats.loading.start = performance.now();
    this.retryDelay = config.retryDelay;
    this.loadInternal();
  }

  loadInternal (): void {
    const context = this.context;
    const xhr = this.loader = new self.XMLHttpRequest();

    const stats = this.stats;
    stats.loading.first = 0;
    stats.loaded = 0;
    const xhrSetup = this.xhrSetup;

    try {
      if (xhrSetup) {
        try {
          xhrSetup(xhr, context.url);
        } catch (e) {
          // fix xhrSetup: (xhr, url) => {xhr.setRequestHeader("Content-Language", "test");}
          // not working, as xhr.setRequestHeader expects xhr.readyState === OPEN
          xhr.open('GET', context.url, true);
          xhrSetup(xhr, context.url);
        }
      }
      if (!xhr.readyState) {
        xhr.open('GET', context.url, true);
      }
    } catch (e) {
      const final = xhr.status >= 400 && xhr.status < 499;
      // IE11 throws an exception on xhr.open if attempting to access an HTTP resource over HTTPS
      this.callbacks.onError({ code: xhr.status, final, text: e.message }, context, xhr);
      return;
    }

    if (context.rangeEnd) {
      xhr.setRequestHeader('Range', 'bytes=' + context.rangeStart + '-' + (context.rangeEnd - 1));
    }

    xhr.onreadystatechange = this.readystatechange.bind(this);
    xhr.responseType = context.responseType as XMLHttpRequestResponseType;
    // setup timeout before we perform request
    this.requestTimeout = self.setTimeout(this.loadtimeout.bind(this), this.config.timeout);
    xhr.send();
  }

  readystatechange (event): void {
    const xhr = event.currentTarget;
    const readyState = xhr.readyState;
    const { stats, context, config } = this;

    // don't proceed if xhr has been aborted
    if (stats.aborted) {
      return;
    }

    // >= HEADERS_RECEIVED
    if (readyState >= 2) {
      // clear xhr timeout and rearm it if readyState less than 4
      self.clearTimeout(this.requestTimeout);
      if (stats.loading.first === 0) {
        stats.loading.first = Math.max(performance.now(), stats.loading.start);
      }

      if (readyState === 4) {
        const status = xhr.status;
        // http status between 200 to 299 are all successful
        if (status >= 200 && status < 300) {
          stats.loading.end = Math.max(performance.now(), stats.loading.first);
          let data;
          let len : number;
          if (context.responseType === 'arraybuffer') {
            data = xhr.response;
            len = data.byteLength;
          } else {
            data = xhr.responseText;
            len = data.length;
          }
          stats.loaded = stats.total = len;

          const onProgress = this.callbacks.onProgress;
          if (onProgress) {
            onProgress(stats, context, data, xhr);
          }

          const response = {
            url: xhr.responseURL,
            data: data
          };

          this.callbacks.onSuccess(response, stats, context, xhr);
        } else {
          // if max nb of retries reached or if http status between 400 and 499 (such error cannot be recovered, retrying is useless), return error
          const final = status >= 400 && status < 499;
          if (stats.retry >= config.maxRetry || final) {
            logger.error(`${status} while loading ${context.url}`);
            this.callbacks.onError({ code: status, final, text: xhr.statusText }, context, xhr);
          } else {
            // retry
            logger.warn(`${status} while loading ${context.url}, retrying in ${this.retryDelay}...`);
            // aborts and resets internal state
            this.destroy();
            // schedule retry
            this.retryTimeout = self.setTimeout(this.loadInternal.bind(this), this.retryDelay);
            // set exponential backoff
            this.retryDelay = Math.min(2 * this.retryDelay, config.maxRetryDelay);
            stats.retry++;
          }
        }
      } else {
        // readyState >= 2 AND readyState !==4 (readyState = HEADERS_RECEIVED || LOADING) rearm timeout as xhr not finished yet
        this.requestTimeout = self.setTimeout(this.loadtimeout.bind(this), config.timeout);
      }
    }
  }

  loadtimeout (): void {
    logger.warn(`timeout while loading ${this.context.url}`);
    this.abortInternal();
    this.callbacks.onTimeout(this.stats, this.context, this.loader);
  }

  getResponseHeader (name: string): string | null {
    if (this.loader) {
      try {
        return this.loader.getResponseHeader(name);
      } catch (error) { /* Could not get headers */ }
    }
    return null;
  }
}

export default XhrLoader;
