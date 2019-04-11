import { LoaderCallbacks, LoaderContext, Loader, LoaderStats, LoaderConfiguration } from '../types/loader';

const { fetch, AbortController, ReadableStream, Request, Headers, performance } = window as any;

export function fetchSupported () {
    if (fetch && AbortController && ReadableStream && Request) {
        try {
            new ReadableStream({}); // eslint-disable-line no-new
            return true;
        } catch (e) { /* noop */ }
    }
    return false;
}

class FetchLoader implements Loader<LoaderContext> {
  private fetchSetup: Function;
  private requestTimeout?: number;
  private request!: Request;
  private response!: Response;
  private controller: AbortController;
  public context!: LoaderContext;
  private config!: LoaderConfiguration;
  private callbacks!: LoaderCallbacks<LoaderContext>;
  public stats: LoaderStats;

  constructor (config /* HlsConfig */) {
    this.fetchSetup = config.fetchSetup || getRequest;
    this.controller = new AbortController();
    this.stats = {
      tfirst: 0,
      trequest: 0,
      tload: 0,
      loaded: 0,
      tparsed: 0,
      tbuffered: 0,
      total: 0,
      retry: 0,
      aborted: false
    };
  }

  destroy (): void {
    this.abortInternal();
  }

  abortInternal (): void {
      this.stats.aborted = true;
      this.controller.abort();
  }

  abort (): void {
    this.abortInternal();
    if (this.callbacks.onAbort) {
      this.callbacks.onAbort(this.stats, this.context, this.response);
    }
  }

  load (context: LoaderContext, config: LoaderConfiguration, callbacks: LoaderCallbacks<LoaderContext>): void {
    const stats = this.stats;
    stats.trequest = window.performance.now();

    const initParams = getRequestParameters(context, this.controller.signal);
    const onProgress = callbacks.onProgress;
    const isArrayBuffer = context.responseType === 'arraybuffer';
    const LENGTH = isArrayBuffer ? 'byteLength' : 'length';

    this.context = context;
    this.config = config;
    this.callbacks = callbacks;
    this.request = this.fetchSetup(context, initParams);
    this.requestTimeout = window.setTimeout(() => {
      this.abortInternal();
      callbacks.onTimeout(stats, context, this.response);
    }, config.timeout);

    fetch(this.request).then((response: Response): Promise<string | ArrayBuffer> => {
      this.response = response;

      if (!response.ok) {
        const { status, statusText } = response;
        throw new FetchError(statusText || 'fetch, bad network response', status, response);
      }
      stats.tfirst = Math.max(window.performance.now(), stats.trequest);
      stats.total = parseInt(response.headers.get('Content-Length') || '0');

      if (onProgress) {
        const reader = (response.clone().body as ReadableStream).getReader();
        new ReadableStream({
          start() {
            const pump = () => {
              reader.read().then(({ done, value }) => {
                if (done) {
                  return;
                }
                stats.loaded += value[LENGTH];
                onProgress(stats, context, value, response);
                pump();
              }).catch(() => {/* aborted */});
            };
            pump();
          }
        });
      }

      if (isArrayBuffer) {
        return response.arrayBuffer();
      }
      return response.text();
    }).then((responseData: string | ArrayBuffer) => {
      clearTimeout(this.requestTimeout);
      stats.tload = Math.max(stats.tfirst, performance.now());
      stats.loaded = stats.total = responseData[LENGTH];

      const response = { url: this.response.url, data: responseData };
      callbacks.onSuccess(response, stats, context, this.response);
    }).catch((error) => {
      clearTimeout(this.requestTimeout);
      if (stats.aborted) {
        return;
      }
      callbacks.onError({ code: error.code, text: error.message }, context, error.details);
    });
  }
}

function getRequestParameters (context: LoaderContext, signal): any {
  const initParams: any = {
    method: 'GET',
    mode: 'cors',
    credentials: 'same-origin',
    signal,
  };

  if (context.rangeEnd) {
    initParams.headers = new Headers({
      Range: 'bytes=' + context.rangeStart + '-' + String(context.rangeEnd - 1)
    });
  }

  return initParams;
}

function getRequest (context: LoaderContext, initParams: any): Request {
  return new Request(context.url, initParams);
}

class FetchError extends Error {
  public code: number;
  public details: any;
  constructor (message: string, code: number, details: any) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export default FetchLoader;
