import { getSelfScope } from './get-self-scope';

const ENABLE_LOGS_DEFAULT = true; // the default setting on lib initialization

const ENABLE_TRACE_LOGS = false;

const DEBUG_PREFIX = ''; // use this to prefix Hls.js when needed for debugging
const DEBUG_PREPEND_TIMESTAMP = false; // use this to prepend with timestamp when needed for debugging

const noop = () => void 0;
const self = getSelfScope();

const console = self.console;

function bindConsole (method, prefix, prependTime) {
  const logFn = console[method];
  if (!logFn) {
    throw new Error('No console support for: ' + method);
  }

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

      }
    });
  }
}
