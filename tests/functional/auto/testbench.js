/* eslint-disable no-var, no-console */

// Browser environment state
var video;
var logString = '';
var hls;

function setupConsoleLogRedirection() {
  var log = document.getElementById('log');
  var inner = log.getElementsByClassName('inner')[0];

  // append log message
  function append(methodName, msg) {
    var a =
      new Date().toISOString().replace('T', ' ').replace('Z', '') + ': ' + msg;
    var text = document.createTextNode(a);
    var line = document.createElement('pre');
    line.className = 'line line-' + methodName;
    line.appendChild(text);
    inner.appendChild(line);

    // The empty log line at the beginning comes from a test in `enableLogs`.
    self.logString = logString += a + '\n';
  }

  // overload global window console methods
  var methods = ['log', 'debug', 'info', 'warn', 'error'];
  methods.forEach(function (methodName) {
    var original = self.console[methodName];
    if (!original) {
      return;
    }

    self.console[methodName] = function () {
      append(
        methodName,
        Array.prototype.slice
          .call(arguments)
          .map(function (arg) {
            try {
              return JSON.stringify(arg);
            } catch (err) {
              return 'Unserializable (reason: ' + err.message + ')';
            }
          })
          .join(' ')
      );

      return original.apply(this, arguments);
    };
  });
}

// Object.assign polyfill
function objectAssign(target) {
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
    for (
      var nextIndex = 0, len = keysArray.length;
      nextIndex < len;
      nextIndex++
    ) {
      var nextKey = keysArray[nextIndex];
      var desc = Object.getOwnPropertyDescriptor(nextSource, nextKey);
      if (desc !== undefined && desc.enumerable) {
        to[nextKey] = nextSource[nextKey];
      }
    }
  }
  return to;
}

function startStream(streamUrl, config, callback, autoplay) {
  var Hls = self.Hls;
  if (!Hls) {
    throw new Error('Hls not installed');
  }
  if (!Hls.isSupported()) {
    callback({ code: 'notSupported', logs: logString });
    return;
  }
  if (hls) {
    callback({ code: 'hlsjsAlreadyInitialised', logs: logString });
    return;
  }
  self.video = video = document.getElementById('video');
  try {
    self.hls = hls = new Hls(
      objectAssign({}, config, {
        // debug: true
        debug: {
          debug: function () {},
          log: console.log.bind(console),
          info: console.info.bind(console, '[info]'),
          warn: console.warn.bind(console, '[warn]'),
          error: console.error.bind(console, '[error]'),
        },
      })
    );
    console.log('[test] > userAgent:', navigator.userAgent);
    if (autoplay !== false) {
      hls.on(Hls.Events.MANIFEST_PARSED, function () {
        console.log('[test] > Manifest parsed. Calling video.play()');
        var playPromise = video.play();
        if (playPromise) {
          playPromise.catch(function (error) {
            console.log(
              '[test] > video.play() failed with error: ' +
                error.name +
                ' ' +
                error.message
            );
            if (error.name === 'NotAllowedError') {
              console.log('[test] > Attempting to play with video muted');
              video.muted = true;
              return video.play();
            }
          });
        }
      });
    }
    hls.on(Hls.Events.ERROR, function (event, data) {
      if (data.fatal) {
        console.log('[test] > hlsjs fatal error :' + data.details);
        if (data.details === Hls.ErrorDetails.INTERNAL_EXCEPTION) {
          console.log('[test] > exception in :' + data.event);
          console.log(
            data.error.stack
              ? JSON.stringify(data.error.stack)
              : data.error.message
          );
        }
        callback({ code: data.details, logs: logString });
      }
    });
    video.onerror = function () {
      console.log('[test] > video error, code :' + video.error.code);
      callback({ code: 'video_error_' + video.error.code, logs: logString });
    };
    hls.loadSource(streamUrl);
    hls.attachMedia(video);
  } catch (err) {
    callback({ code: 'exception', logs: logString });
  }
}

function switchToLowestLevel(mode) {
  console.log('[test] > switch to lowest level', mode);
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

function switchToHighestLevel(mode) {
  var highestLevel = hls.levels.length - 1;
  console.log('[test] > switch to highest level', highestLevel, mode);
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

self.setupConsoleLogRedirection = setupConsoleLogRedirection;
self.startStream = startStream;
self.switchToHighestLevel = switchToHighestLevel;
self.switchToLowestLevel = switchToLowestLevel;
