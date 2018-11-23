/**
 * Logger module, slightly inspired of https://gist.github.com/tchakabam/ae4f369b8726a87c5bb6b8904acd167e
 */

import { getSelfScope } from './get-self-scope';

const ENABLE_LOGS_DEFAULT = false; // the default setting on lib initialization
const ENABLE_TRACE_LOGS = false; // disabled by default as only useful for debugging purposes

const DEBUG_PREFIX = ''; // use this to prefix Hls.js when needed for debugging

const noop = () => void 0;
const self = getSelfScope();
const console = self.console;

function bindConsole (method, prefix, prependTime) {
  const logFn = console[method];
  if (!logFn) {
    // console.warn('No console support for: ' + method);
    return noop;
  }

  /**
   * NOTE on line-number in browser console log output
   *
   * Preserving line-numbers requires exporting a bound native log function as-is
   * to the calling code.
   *
   * Any kind of wrapping, necessary for example to dynamically insert values (unlike static values
   * inserted via `bind`) like needed for timestamp prefixing will cause line-numbers to not be preserved,
   * i.e line-number will be opaque against whichever the wrapper line-number is.
   */

  return logFn.bind(console, prefix);
}

let isLoggingEnabled = ENABLE_LOGS_DEFAULT;

function bindDefaultLogger (logger = {}) {
  logger.trace = ENABLE_TRACE_LOGS && isLoggingEnabled ? bindConsole('debug', DEBUG_PREFIX + ' [T] >') : noop;
  logger.debug = isLoggingEnabled ? bindConsole('debug', DEBUG_PREFIX + ' [D] >') : noop;
  logger.log = isLoggingEnabled ? bindConsole('log', DEBUG_PREFIX + ' [L] >') : noop;
  logger.info = isLoggingEnabled ? bindConsole('info', DEBUG_PREFIX + ' [I] >') : noop;
  logger.warn = isLoggingEnabled ? bindConsole('warn', DEBUG_PREFIX + ' [W] >') : noop;
  logger.error = isLoggingEnabled ? bindConsole('error', DEBUG_PREFIX + ' [E] >') : noop;
  return logger;
}

export const logger = bindDefaultLogger();

/**
 *
 * @param {boolean | LoggerConfig} enabled
 */
export function enableLogs (loggerConfig) {
  if (typeof loggerConfig === 'boolean') {
    isLoggingEnabled = loggerConfig;
    bindDefaultLogger(logger);
  } else if (typeof loggerConfig === 'object') {
    isLoggingEnabled = true;
    ['debug',
      'log',
      'info',
      'warn',
      'error'].forEach((logFn) => {
      if (typeof loggerConfig[logFn] === 'function') {
        logger[logFn] = loggerConfig[logFn];
      }
    });
  }
}
