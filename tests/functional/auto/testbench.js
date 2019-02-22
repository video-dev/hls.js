/* eslint-disable no-var, no-console */

// Browser environment state
var video;
var logString;
var hls;

function setupConsoleLogRedirection () {
  var log = document.getElementById('log');
  var inner = log.getElementsByClassName('inner')[0];

  // append log message
  function append (methodName, msg) {
    var a = (new Date()).toISOString().replace('T', ' ').replace('Z', '') + ': ' + msg;
    var text = document.createTextNode(a);
    var line = document.createElement('pre');
    line.className = 'line line-' + methodName;
    line.appendChild(text);
    inner.appendChild(line);

    window.logString = logString += a + '\n';
  }

  // overload global window console methods
  var methods = ['log', 'debug', 'info', 'warn', 'error'];
  methods.forEach(function (methodName) {
    var original = window.console[methodName];
    if (!original) {
      return;
    }

    window.console[methodName] = function () {
      append(methodName, Array.prototype.slice.call(arguments).map(function (arg) {
        try {
          return JSON.stringify(arg);
        } catch (err) {
          return 'Unserializable (reason: ' + err.message + ')';
        }
      }).join(' '));

      return original.apply(this, arguments);
    };
  });
}

// Object.assign polyfill
function objectAssign (target, firstSource) {
  if (target === undefined || target === null) {
    throw new TypeError('Cannot convert first argument to object');
  }

  var to = Object(target);
  for (var i = 1; i < arguments.length; i++) {
    var nextSource = arguments[i];
    if (nextSource === undefined || nextSource === null) {
      continue;
    }

    var keysArray = Object.keys(Object(nextSource));
    for (var nextIndex = 0, len = keysArray.length; nextIndex < len; nextIndex++) {
      var nextKey = keysArray[nextIndex];
      var desc = Object.getOwnPropertyDescriptor(nextSource, nextKey);
      if (desc !== undefined && desc.enumerable) {
        to[nextKey] = nextSource[nextKey];
      }
    }
  }
  return to;
}

function startStream (streamUrl, config, callback) {
  var Hls = window.Hls;
  if (!Hls) {
    throw new Error('Hls not installed');
  }

  if (Hls.isSupported()) {
    if (hls) {
      callback({ code: 'hlsjsAlreadyInitialised', logs: logString });
      return;
    }
    window.video = video = document.getElementById('video');
    try {
      window.hls = hls = new Hls(objectAssign({}, config, { debug: true }));
      console.log(navigator.userAgent);
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, function () {
        video.play();
      });
      hls.on(Hls.Events.ERROR, function (event, data) {
        if (data.fatal) {
          console.log('hlsjs fatal error :' + data.details);
          if (data.details === Hls.ErrorDetails.INTERNAL_EXCEPTION) {
            console.log('exception in :' + data.event);
            console.log(data.err.stack ? JSON.stringify(data.err.stack) : data.err.message);
          }
          callback({ code: data.details, logs: logString });
        }
      });
      video.onerror = function (event) {
        console.log('video error, code :' + video.error.code);
        callback({ code: 'video_error_' + video.error.code, logs: logString });
      };
    } catch (err) {
      callback({ code: 'exception', logs: logString });
    }
  } else {
    callback({ code: 'notSupported', logs: logString });
  }
}

function switchToLowestLevel (mode) {
  switch (mode) {
  case 'current':
    hls.currentLevel = 0;
    break;
  case 'next':
    hls.nextLevel = 0;
    break;
  case 'load':
  default:
    hls.loadLevel = 0;
    break;
  }
}

function switchToHighestLevel (mode) {
  var highestLevel = hls.levels.length - 1;
  switch (mode) {
  case 'current':
    hls.currentLevel = highestLevel;
    break;
  case 'next':
    hls.nextLevel = highestLevel;
    break;
  case 'load':
  default:
    hls.loadLevel = highestLevel;
    break;
  }
}

window.setupConsoleLogRedirection = setupConsoleLogRedirection;
window.startStream = startStream;
window.switchToHighestLevel = switchToHighestLevel;
window.switchToLowestLevel = switchToLowestLevel;
