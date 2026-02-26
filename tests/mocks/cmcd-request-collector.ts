/**
 * CmcdRequestCollector — intercepts fetch requests to capture CMCD data.
 *
 * Monkey-patches self.fetch so that outgoing requests carrying CMCD query
 * params or headers are recorded for later assertion in e2e tests.
 *
 * For event target URLs, intercepts POST requests and returns a synthetic
 * 200 response to prevent actual network calls to external endpoints.
 *
 * Requires hls.js to be configured with `loader: FetchLoader` so that all
 * requests flow through fetch.
 */

export type CmcdRequestType = 'manifest' | 'segment' | 'event' | 'unknown';

export type CmcdRequestMode = 'query' | 'header' | 'event';

export interface CollectedRequest {
  request: Request;
  type: CmcdRequestType;
  reportingMode: CmcdRequestMode;
  timestamp: number;
}

export interface CollectorOptions {
  eventTargetUrls?: string[];
}

interface Waiter {
  type: CmcdRequestType | undefined;
  count: number;
  resolve: (requests: CollectedRequest[]) => void;
  reject: (reason: Error) => void;
  timer: number;
}

const MANIFEST_EXTENSIONS = /\.(m3u8|mpd)/i;
const SEGMENT_EXTENSIONS = /\.(m4s|ts|mp4|m4a|m4v|aac)(\?|$)/i;

function classifyUrl(url: string, method: string): CmcdRequestType {
  if (method === 'POST') {
    return 'event';
  }
  if (MANIFEST_EXTENSIONS.test(url)) {
    return 'manifest';
  }
  if (SEGMENT_EXTENSIONS.test(url)) {
    return 'segment';
  }
  return 'unknown';
}

function hasCmcdHeaders(request: Request): boolean {
  let found = false;
  request.headers.forEach((_value, name) => {
    if (name.toLowerCase().startsWith('cmcd-')) {
      found = true;
    }
  });
  return found;
}

export class CmcdRequestCollector {
  private requests: CollectedRequest[] = [];
  private waiters: Waiter[] = [];
  private attached = false;
  private eventTargetUrls: string[] = [];
  private origFetch: typeof self.fetch | null = null;

  attach(options: CollectorOptions = {}): void {
    if (this.attached) {
      return;
    }
    this.attached = true;
    this.eventTargetUrls = options.eventTargetUrls || [];

    const origFetch = (this.origFetch = self.fetch);

    (self as any).fetch = (
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      const request =
        input instanceof Request ? input : new Request(String(input), init);

      const type = classifyUrl(request.url, request.method);

      const entry: CollectedRequest = {
        request: request.clone(),
        type,
        reportingMode:
          type === 'event'
            ? 'event'
            : hasCmcdHeaders(request)
              ? 'header'
              : 'query',
        timestamp: Date.now(),
      };

      this.addRequest(entry);

      // Intercept event target POSTs — return synthetic 200 response
      if (this.isEventTargetRequest(request)) {
        return Promise.resolve(new Response('', { status: 200 }));
      }

      return origFetch.call(self, input, init);
    };
  }

  detach(): void {
    if (!this.attached) {
      return;
    }

    if (this.origFetch) {
      self.fetch = this.origFetch;
    }

    this.origFetch = null;
    this.attached = false;

    // Clear pending waiters
    this.waiters.forEach((waiter) => {
      self.clearTimeout(waiter.timer);
      waiter.reject(new Error('Collector detached while waiting'));
    });
    this.waiters = [];
  }

  getRequests(type?: CmcdRequestType): CollectedRequest[] {
    if (type) {
      return this.requests.filter((r) => r.type === type);
    }
    return [...this.requests];
  }

  clear(): void {
    this.requests = [];
  }

  waitForRequests(
    type: CmcdRequestType | undefined,
    count: number,
    timeout: number = 30000,
  ): Promise<CollectedRequest[]> {
    const matching = this.getRequests(type);

    if (matching.length >= count) {
      return Promise.resolve(matching);
    }

    return new Promise<CollectedRequest[]>((resolve, reject) => {
      const timer = self.setTimeout(() => {
        this.removeWaiter(waiter);
        const current = this.getRequests(type);
        reject(
          new Error(
            `Timeout waiting for ${count} ${type || 'any'} CMCD request(s). ` +
              `Got ${current.length}. Total collected: ${this.requests.length}.`,
          ),
        );
      }, timeout);

      const waiter: Waiter = { type, count, resolve, reject, timer };
      this.waiters.push(waiter);
    });
  }

  private addRequest(entry: CollectedRequest): void {
    this.requests.push(entry);
    this.checkWaiters();
  }

  private isEventTargetRequest(request: Request): boolean {
    const { method, url } = request;
    return (
      method === 'POST' &&
      this.eventTargetUrls.some((target) => url.startsWith(target))
    );
  }

  private removeWaiter(waiter: Waiter): void {
    const idx = this.waiters.indexOf(waiter);
    if (idx >= 0) {
      this.waiters.splice(idx, 1);
    }
  }

  private checkWaiters(): void {
    const resolved: Waiter[] = [];

    this.waiters.forEach((waiter) => {
      const matching = this.getRequests(waiter.type);
      if (matching.length >= waiter.count) {
        self.clearTimeout(waiter.timer);
        waiter.resolve(matching);
        resolved.push(waiter);
      }
    });

    resolved.forEach((w) => this.removeWaiter(w));
  }
}
