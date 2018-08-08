import { getSelfScope } from './get-self-scope';

const ENABLE_LOGS_DEFAULT = true; // the default setting on lib initialization

const DEBUG_PREFIX = ''; // use this to prefix Hls.js when needed for debugging
const DEBUG_PREPEND_TIMESTAMP = false; // use this to prepend with timestamp when needed for debugging

const noop = () => void 0;
const self = getSelfScope();

function bindConsole (method, prefix, prependTime) {
  const logFn = console[method];
  if (!logFn)
    throw new Error('No console support for: ' + method);

  if (prependTime)
    return (...args) => logFn.call(self.console, prefix, `[${(new Date()).toISOString()}]`, ...args);
  else
    return logFn.bind(self.console, prefix);
}

// TODO: Replace `ENABLE_LOGS_DEFAULT` by a log-level check here and add a function set logging level :)

const trace = isLogFunctionEnabled() ? bindConsole('debug', DEBUG_PREFIX + ' [T] >', DEBUG_PREPEND_TIMESTAMP) : noop;
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

let _enabled = ENABLE_LOGS_DEFAULT;

function isLogFunctionEnabled() {
  return _enabled;
}

export function enableLogs (enabled) {
  _enabled = enabled;
}
