'use strict';

function noop() {}

let fakeLogger = {
  log: noop,
  warn: noop,
  info: noop,
  error: noop
};

let exportedLogger = fakeLogger;

export var enableLogs = function(debug) {
  if (debug === true || typeof debug === 'object') {
    exportedLogger.log = debug.log ? debug.log.bind(debug) : console.log.bind(console);
    exportedLogger.info = debug.info ? debug.info.bind(debug) : console.info.bind(console);
    exportedLogger.error = debug.error ? debug.error.bind(debug) : console.error.bind(console);
    exportedLogger.warn = debug.warn ? debug.warn.bind(debug) : console.warn.bind(console);
    // Some browsers don't allow to use bind on console object anyway
    // fallback to default if needed
    try {
     exportedLogger.log();
    }
    catch (e) {
      exportedLogger.log = noop;
      exportedLogger.info = noop;
      exportedLogger.error = noop;
      exportedLogger.   = noop;
    }
  }
  else {
    exportedLogger = fakeLogger;
  }
};

export var logger = exportedLogger;
