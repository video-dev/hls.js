import { LoadPolicy, RetryConfig } from '../config';
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

export function shouldRetry(
  retryConfig: RetryConfig | null,
  retryCount: number,
  httpStatus: number | undefined
): retryConfig is RetryConfig & boolean {
  return (
    !!retryConfig &&
    retryCount < retryConfig.maxNumRetry &&
    retryForHttpStatus(httpStatus)
  );
}

export function retryForHttpStatus(httpStatus: number | undefined) {
  return (
    httpStatus === undefined ||
    (httpStatus !== 0 && (httpStatus < 400 || httpStatus > 499))
  );
}
