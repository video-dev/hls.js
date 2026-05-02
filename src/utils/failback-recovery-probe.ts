import { logger } from './logger';
import { LoaderContextType } from '../types/loader';
import type { HlsConfig } from '../config';
import type { LoaderContext } from '../types/loader';

function probeOriginalCDNWithFetch(
  url: string,
  timeoutMs: number,
  headers?: Record<string, string>,
): Promise<boolean> {
  return new Promise((resolve) => {
    const controller = new AbortController();
    const timeoutId = self.setTimeout(() => {
      logger.log(`[FailbackLoader] Probe timeout after ${timeoutMs}ms`);
      controller.abort();
    }, timeoutMs);

    const mergedHeaders: Record<string, string> = {
      Range: 'bytes=0-1023',
      ...headers,
    };

    logger.log(`[FailbackLoader] Probe fetch starting: ${url}`);

    fetch(url, {
      method: 'GET',
      headers: mergedHeaders,
      signal: controller.signal,
    })
      .then((response) => {
        self.clearTimeout(timeoutId);
        const isSuccess = response.status === 200 || response.status === 206;
        logger.log(
          `[FailbackLoader] Probe response: status=${response.status}, success=${isSuccess}`,
        );
        resolve(isSuccess);
      })
      .catch((error) => {
        self.clearTimeout(timeoutId);
        logger.log(
          `[FailbackLoader] Probe fetch error: ${error?.message || error}`,
        );
        resolve(false);
      });
  });
}

export function probeOriginalCDN(
  config: HlsConfig,
  url: string,
  timeoutMs: number,
  headers?: Record<string, string>,
): Promise<boolean> {
  const xhrSetup = config.xhrSetup;
  if (!xhrSetup) {
    return probeOriginalCDNWithFetch(url, timeoutMs, headers);
  }

  return new Promise((resolve) => {
    const xhr = new self.XMLHttpRequest();
    const mergedHeaders: Record<string, string> = {
      Range: 'bytes=0-1023',
      ...headers,
    };
    let settled = false;

    const finalize = (isSuccess: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      self.clearTimeout(timeoutId);
      xhr.onreadystatechange = null;
      xhr.onerror = null;
      if (xhr.readyState !== 4) {
        xhr.abort();
      }
      resolve(isSuccess);
    };

    const openAndSend = () => {
      if (!xhr.readyState) {
        xhr.open('GET', url, true);
      }

      for (const header in mergedHeaders) {
        xhr.setRequestHeader(header, mergedHeaders[header]);
      }

      xhr.onreadystatechange = () => {
        if (xhr.readyState !== 4) {
          return;
        }

        const isSuccess = xhr.status === 200 || xhr.status === 206;
        logger.log(
          `[FailbackLoader] Probe response: status=${xhr.status}, success=${isSuccess}`,
        );
        finalize(isSuccess);
      };

      xhr.onerror = () => {
        logger.log(`[FailbackLoader] Probe xhr error: ${url}`);
        finalize(false);
      };

      try {
        xhr.send();
      } catch (error) {
        logger.log(
          `[FailbackLoader] Probe xhr send error: ${error?.message || error}`,
        );
        finalize(false);
      }
    };

    const timeoutId = self.setTimeout(() => {
      logger.log(`[FailbackLoader] Probe timeout after ${timeoutMs}ms`);
      finalize(false);
    }, timeoutMs);

    logger.log(`[FailbackLoader] Probe xhr starting: ${url}`);

    Promise.resolve()
      .then(() => {
        const probeContext: LoaderContext = {
          url,
          responseType: 'arraybuffer',
          type: LoaderContextType.MEDIA_FRAGMENT,
        };
        return xhrSetup(xhr, url, probeContext);
      })
      .catch(() => {
        if (settled) {
          return;
        }
        xhr.open('GET', url, true);
        const probeContext: LoaderContext = {
          url,
          responseType: 'arraybuffer',
          type: LoaderContextType.MEDIA_FRAGMENT,
        };
        return xhrSetup(xhr, url, probeContext);
      })
      .then(() => {
        if (settled) {
          return;
        }
        openAndSend();
      })
      .catch((error) => {
        logger.log(
          `[FailbackLoader] Probe xhrSetup error: ${error?.message || error}`,
        );
        finalize(false);
      });
  });
}
