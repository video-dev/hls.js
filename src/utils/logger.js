import { getSelfScope } from './get-self-scope';

function noop (...args) {}

const fakeLogger = {
  trace: noop,
  debug: noop,
  log: noop,
  warn: noop,
  info: noop,
  error: noop
};

let exportedLogger = fakeLogger;

// let lastCallTime;
// function formatMsgWithTimeInfo(type, msg) {
//   const now = Date.now();
//   const diff = lastCallTime ? '+' + (now - lastCallTime) : '0';
//   lastCallTime = now;
//   msg = (new Date(now)).toISOString() + ' | [' +  type + '] > ' + msg + ' ( ' + diff + ' ms )';
//   return msg;
// }

function formatMsg (type, msg) {
  msg = '[' + type + '] > ' + msg;
  return msg;
}

const global = getSelfScope();

function consolePrintFn (type) {
  const func = global.console[type];
  if (func) {
    return function (...args) {
      if (args[0]) {
        args[0] = formatMsg(type, args[0]);
      }

      func.apply(global.console, args);
    };
  }
  return noop;
}

function exportLoggerFunctions (debugConfig, ...functions) {
  functions.forEach(function (type) {
    exportedLogger[type] = debugConfig[type] ? debugConfig[type].bind(debugConfig) : consolePrintFn(type);
  });
}

export const enableLogs = function (debugConfig) {
  // check that console is available
  if ((global.console && debugConfig === true) || typeof debugConfig === 'object') {
    exportLoggerFunctions(debugConfig,
      // Remove out from list here to hard-disable a log-level
      // 'trace',
      'debug',
      'log',
      'info',
      'warn',
      'error'
    );
    // Some browsers don't allow to use bind on console object anyway
    // fallback to default if needed
    try {
      exportedLogger.log();
    } catch (e) {
      exportedLogger = fakeLogger;
    }
  } else {
    exportedLogger = fakeLogger;
  }
};

export const logger = exportedLogger;
