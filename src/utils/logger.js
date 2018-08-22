import { getSelfScope } from './get-self-scope';

const ENABLE_LOGS_DEFAULT = true; // the default setting on lib initialization

const ENABLE_TRACE_LOGS = true;

const DEBUG_PREFIX = ''; // use this to prefix Hls.js when needed for debugging
const DEBUG_PREPEND_TIMESTAMP = false; // use this to prepend with timestamp when needed for debugging (makes line-number opaque)

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
   * NOTE on line-number in browser console log output and using DEBUG_PREPEND_TIMESTAMP
   *
   * Preserving line-numbers requires exporting a bound native log function as-is
   * to the calling code.
   *
   * Any kind of wrapping, necessary for example to dynamically insert values (unlike static values
   * inserted via `bind`) like needed for timestamp prefixing will cause line-numbers to not be preserved,
   * i.e line-number will be opaque against whichever the wrapper line-number is.
   */
  if (prependTime) {
    return (...args) => logFn.call(console, prefix, `[${(new Date()).toISOString()}]`, ...args);
  } else {
    return logFn.bind(console, prefix);
  }
}

let _enabled = ENABLE_LOGS_DEFAULT;

function isLogFunctionEnabled () {
  return _enabled;
}

// TODO: Replace `ENABLE_LOGS_DEFAULT` by a log-level check here and add a function set logging level :)

const trace = ENABLE_TRACE_LOGS && isLogFunctionEnabled() ? bindConsole('debug', DEBUG_PREFIX + ' [T] >', DEBUG_PREPEND_TIMESTAMP) : noop;
const debug = isLogFunctionEnabled() ? bindConsole('debug', DEBUG_PREFIX + ' [D] >', DEBUG_PREPEND_TIMESTAMP) : noop;
const log = isLogFunctionEnabled() ? bindConsole('log', DEBUG_PREFIX + ' [L] >', DEBUG_PREPEND_TIMESTAMP) : noop;
const info = isLogFunctionEnabled() ? bindConsole('info', DEBUG_PREFIX + ' [I] >', DEBUG_PREPEND_TIMESTAMP) : noop;
const warn = isLogFunctionEnabled() ? bindConsole('warn', DEBUG_PREFIX + ' [W] >', DEBUG_PREPEND_TIMESTAMP) : noop;
const error = isLogFunctionEnabled() ? bindConsole('error', DEBUG_PREFIX + ' [E] >', DEBUG_PREPEND_TIMESTAMP) : noop;

export const logger = {
  trace,
  debug,
  log,
  info,
  warn,
  error
};

/**
 *
 * @param {boolean | LoggerConfig} enabled
 */
export function enableLogs (loggerConfig) {
  if (typeof loggerConfig === 'boolean') {
    _enabled = loggerConfig;
  } else if (typeof loggerConfig === 'object') {
    _enabled = true;
    ['debug',
      'log',
      'info',
      'warn',
      'error'].forEach((logFn) => {
      if (loggerConfig[logFn]) {
        logger[logFn] = loggerConfig[logFn];
      }
    });
  }
}
