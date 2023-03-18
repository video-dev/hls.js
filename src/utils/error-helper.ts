import { LoadPolicy, LoaderConfig, RetryConfig } from '../config';
import { ErrorDetails } from '../errors';
import { ErrorData } from '../types/events';

export function isTimeoutError(error: ErrorData): boolean {
  switch (error.details) {
    case ErrorDetails.FRAG_LOAD_TIMEOUT:
    case ErrorDetails.KEY_LOAD_TIMEOUT:
    case ErrorDetails.LEVEL_LOAD_TIMEOUT:
    case ErrorDetails.MANIFEST_LOAD_TIMEOUT:
      return true;
  }
  return false;
}

export function getRetryConfig(
  loadPolicy: LoadPolicy,
  error: ErrorData
): RetryConfig | null {
  const isTimeout = isTimeoutError(error);
  return loadPolicy.default[`${isTimeout ? 'timeout' : 'error'}Retry`];
}

export function getRetryDelay(
  retryConfig: RetryConfig,
  retryCount: number
): number {
  // exponential backoff capped to max retry delay
  const backoffFactor =
    retryConfig.backoff === 'linear' ? 1 : Math.pow(2, retryCount);
  return Math.min(
    backoffFactor * retryConfig.retryDelayMs,
    retryConfig.maxRetryDelayMs
  );
}

export function getLoaderConfigWithoutReties(
  loderConfig: LoaderConfig
): LoaderConfig {
  return {
    ...loderConfig,
    ...{
      errorRetry: null,
      timeoutRetry: null,
    },
  };
}

export function shouldRetry(
  retryConfig: RetryConfig | null | undefined,
  retryCount: number,
  isTimeout: boolean,
  httpStatus?: number | undefined
): retryConfig is RetryConfig & boolean {
  return (
    !!retryConfig &&
    retryCount < retryConfig.maxNumRetry &&
    (retryForHttpStatus(httpStatus) || !!isTimeout)
  );
}

export function retryForHttpStatus(httpStatus: number | undefined) {
  // Do not retry on status 4xx, status 0 (CORS error), or undefined (decrypt/gap/parse error)
  return (
    (httpStatus === 0 && navigator.onLine === false) ||
    (!!httpStatus && (httpStatus < 400 || httpStatus > 499))
  );
}
