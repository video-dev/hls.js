export interface ILogFunction {
  (message?: any, ...optionalParams: any[]): void;
}

export interface ILogger {
  trace: ILogFunction;
  debug: ILogFunction;
  log: ILogFunction;
  warn: ILogFunction;
  info: ILogFunction;
  error: ILogFunction;
}

const noop: ILogFunction = function () {};

const fakeLogger: ILogger = {
  trace: noop,
  debug: noop,
  log: noop,
  warn: noop,
  info: noop,
  error: noop,
};

let exportedLogger: ILogger = fakeLogger;

// let lastCallTime;
// function formatMsgWithTimeInfo(type, msg) {
//   const now = Date.now();
//   const diff = lastCallTime ? '+' + (now - lastCallTime) : '0';
//   lastCallTime = now;
//   msg = (new Date(now)).toISOString() + ' | [' +  type + '] > ' + msg + ' ( ' + diff + ' ms )';
//   return msg;
// }

function consolePrintFn(type: string): ILogFunction {
  const func: ILogFunction = self.console[type];
  if (func) {
    return func.bind(self.console, `[${type}] >`);
  }
  return noop;
}

function exportLoggerFunctions(
  debugConfig: boolean | ILogger,
  ...functions: string[]
): void {
  functions.forEach(function (type) {
    exportedLogger[type] = debugConfig[type]
      ? debugConfig[type].bind(debugConfig)
      : consolePrintFn(type);
  });
}

export function enableLogs(debugConfig: boolean | ILogger, id: string): void {
  // check that console is available
  if (
    (typeof console === 'object' && debugConfig === true) ||
    typeof debugConfig === 'object'
  ) {
    exportLoggerFunctions(
      debugConfig,
      // Remove out from list here to hard-disable a log-level
      // 'trace',
      'debug',
      'log',
      'info',
      'warn',
      'error',
    );
    // Some browsers don't allow to use bind on console object anyway
    // fallback to default if needed
    try {
      exportedLogger.log(
        `Debug logs enabled for "${id}" in hls.js version ${__VERSION__}`,
      );
    } catch (e) {
      exportedLogger = fakeLogger;
    }
  } else {
    exportedLogger = fakeLogger;
  }
}

export const logger: ILogger = exportedLogger;
