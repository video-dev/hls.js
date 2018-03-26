const ENABLE_LOGS_DEFAULT = true;
const PREFIX = '[Hls.js] |';
const PREPEND_TIMESTAMP = false;
const noop = () => void 0;

function bindConsole (method, prefix, prependTime) {
  const logFn = console[method];
  if (!logFn)
    throw new Error('No console support for: ' + method);

  if (prependTime)
    return (...args) => logFn.call(console, prefix, `[${(new Date()).toISOString()}]`, ...args);
  else
    return logFn.bind(console, prefix);
}

// TODO: Replace `ENABLE_LOGS_DEFAULT` by a log-level check here and add a function set logging level :)

const trace = ENABLE_LOGS_DEFAULT ? bindConsole('debug', PREFIX + ' [T] >', PREPEND_TIMESTAMP) : noop;
const debug = ENABLE_LOGS_DEFAULT ? bindConsole('debug', PREFIX + ' [D] >', PREPEND_TIMESTAMP) : noop;
const log = ENABLE_LOGS_DEFAULT ? bindConsole('log', PREFIX + ' [L] >', PREPEND_TIMESTAMP) : noop;
const info = ENABLE_LOGS_DEFAULT ? bindConsole('info', PREFIX + ' [I] >', PREPEND_TIMESTAMP) : noop;
const warn = ENABLE_LOGS_DEFAULT ? bindConsole('warn', PREFIX + ' [W] >', PREPEND_TIMESTAMP) : noop;
const error = ENABLE_LOGS_DEFAULT ? bindConsole('error', PREFIX + ' [E] >', PREPEND_TIMESTAMP) : noop;

export const logger = {
  trace,
  debug,
  log,
  info,
  warn,
  error
};

let _enabled = ENABLE_LOGS_DEFAULT;
export function enableLogs (enabled) {
  _enabled = enabled;
}
