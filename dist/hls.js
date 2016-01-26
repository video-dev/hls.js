(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Hls = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(require,module,exports){
var bundleFn = arguments[3];
var sources = arguments[4];
var cache = arguments[5];

var stringify = JSON.stringify;

module.exports = function (fn) {
    var keys = [];
    var wkey;
    var cacheKeys = Object.keys(cache);
    
    for (var i = 0, l = cacheKeys.length; i < l; i++) {
        var key = cacheKeys[i];
        if (cache[key].exports === fn) {
            wkey = key;
            break;
        }
    }
    
    if (!wkey) {
        wkey = Math.floor(Math.pow(16, 8) * Math.random()).toString(16);
        var wcache = {};
        for (var i = 0, l = cacheKeys.length; i < l; i++) {
            var key = cacheKeys[i];
            wcache[key] = key;
        }
        sources[wkey] = [
            Function(['require','module','exports'], '(' + fn + ')(self)'),
            wcache
        ];
    }
    var skey = Math.floor(Math.pow(16, 8) * Math.random()).toString(16);
    
    var scache = {}; scache[wkey] = wkey;
    sources[skey] = [
        Function(['require'],'require(' + stringify(wkey) + ')(self)'),
        scache
    ];
    
    var src = '(' + bundleFn + ')({'
        + Object.keys(sources).map(function (key) {
            return stringify(key) + ':['
                + sources[key][0]
                + ',' + stringify(sources[key][1]) + ']'
            ;
        }).join(',')
        + '},{},[' + stringify(skey) + '])'
    ;
    
    var URL = window.URL || window.webkitURL || window.mozURL || window.msURL;
    
    return new Worker(URL.createObjectURL(
        new Blob([src], { type: 'text/javascript' })
    ));
};

},{}],3:[function(require,module,exports){
/*
 * simple ABR Controller
*/

'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _eventHandler = require('../event-handler');

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var AbrController = (function (_EventHandler) {
  _inherits(AbrController, _EventHandler);

  function AbrController(hls) {
    _classCallCheck(this, AbrController);

    _get(Object.getPrototypeOf(AbrController.prototype), 'constructor', this).call(this, hls, _events2['default'].FRAG_LOAD_PROGRESS);
    this.lastfetchlevel = 0;
    this._autoLevelCapping = -1;
    this._nextAutoLevel = -1;
  }

  _createClass(AbrController, [{
    key: 'destroy',
    value: function destroy() {
      _eventHandler2['default'].prototype.destroy.call(this);
    }
  }, {
    key: 'onFragLoadProgress',
    value: function onFragLoadProgress(data) {
      var stats = data.stats;
      if (stats.aborted === undefined) {
        this.lastfetchduration = (performance.now() - stats.trequest) / 1000;
        this.lastfetchlevel = data.frag.level;
        this.lastbw = stats.loaded * 8 / this.lastfetchduration;
        //console.log(`fetchDuration:${this.lastfetchduration},bw:${(this.lastbw/1000).toFixed(0)}/${stats.aborted}`);
      }
    }

    /** Return the capping/max level value that could be used by automatic level selection algorithm **/
  }, {
    key: 'autoLevelCapping',
    get: function get() {
      return this._autoLevelCapping;
    },

    /** set the capping/max level value that could be used by automatic level selection algorithm **/
    set: function set(newLevel) {
      this._autoLevelCapping = newLevel;
    }
  }, {
    key: 'nextAutoLevel',
    get: function get() {
      var lastbw = this.lastbw,
          hls = this.hls,
          adjustedbw,
          i,
          maxAutoLevel;
      if (this._autoLevelCapping === -1) {
        maxAutoLevel = hls.levels.length - 1;
      } else {
        maxAutoLevel = this._autoLevelCapping;
      }

      if (this._nextAutoLevel !== -1) {
        var nextLevel = Math.min(this._nextAutoLevel, maxAutoLevel);
        if (nextLevel === this.lastfetchlevel) {
          this._nextAutoLevel = -1;
        } else {
          return nextLevel;
        }
      }

      // follow algorithm captured from stagefright :
      // https://android.googlesource.com/platform/frameworks/av/+/master/media/libstagefright/httplive/LiveSession.cpp
      // Pick the highest bandwidth stream below or equal to estimated bandwidth.
      for (i = 0; i <= maxAutoLevel; i++) {
        // consider only 80% of the available bandwidth, but if we are switching up,
        // be even more conservative (70%) to avoid overestimating and immediately
        // switching back.
        if (i <= this.lastfetchlevel) {
          adjustedbw = 0.8 * lastbw;
        } else {
          adjustedbw = 0.7 * lastbw;
        }
        if (adjustedbw < hls.levels[i].bitrate) {
          return Math.max(0, i - 1);
        }
      }
      return i - 1;
    },
    set: function set(nextLevel) {
      this._nextAutoLevel = nextLevel;
    }
  }]);

  return AbrController;
})(_eventHandler2['default']);

exports['default'] = AbrController;
module.exports = exports['default'];

},{"../event-handler":19,"../events":20}],4:[function(require,module,exports){
/*
 * Level Controller
*/

'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _eventHandler = require('../event-handler');

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _utilsLogger = require('../utils/logger');

var _errors = require('../errors');

var LevelController = (function (_EventHandler) {
  _inherits(LevelController, _EventHandler);

  function LevelController(hls) {
    _classCallCheck(this, LevelController);

    _get(Object.getPrototypeOf(LevelController.prototype), 'constructor', this).call(this, hls, _events2['default'].MANIFEST_LOADED, _events2['default'].LEVEL_LOADED, _events2['default'].ERROR);
    this.ontick = this.tick.bind(this);
    this._manualLevel = this._autoLevelCapping = -1;
  }

  _createClass(LevelController, [{
    key: 'destroy',
    value: function destroy() {
      if (this.timer) {
        clearInterval(this.timer);
      }
      this._manualLevel = -1;
    }
  }, {
    key: 'onManifestLoaded',
    value: function onManifestLoaded(data) {
      var levels0 = [],
          levels = [],
          bitrateStart,
          i,
          bitrateSet = {},
          videoCodecFound = false,
          audioCodecFound = false,
          hls = this.hls;

      // regroup redundant level together
      data.levels.forEach(function (level) {
        if (level.videoCodec) {
          videoCodecFound = true;
        }
        if (level.audioCodec) {
          audioCodecFound = true;
        }
        var redundantLevelId = bitrateSet[level.bitrate];
        if (redundantLevelId === undefined) {
          bitrateSet[level.bitrate] = levels0.length;
          level.url = [level.url];
          level.urlId = 0;
          levels0.push(level);
        } else {
          levels0[redundantLevelId].url.push(level.url);
        }
      });

      // remove audio-only level if we also have levels with audio+video codecs signalled
      if (videoCodecFound && audioCodecFound) {
        levels0.forEach(function (level) {
          if (level.videoCodec) {
            levels.push(level);
          }
        });
      } else {
        levels = levels0;
      }

      // only keep level with supported audio/video codecs
      levels = levels.filter(function (level) {
        var checkSupported = function checkSupported(codec) {
          return MediaSource.isTypeSupported('video/mp4;codecs=' + codec);
        };
        var audioCodec = level.audioCodec,
            videoCodec = level.videoCodec;

        return (!audioCodec || checkSupported(audioCodec)) && (!videoCodec || checkSupported(videoCodec));
      });

      if (levels.length) {
        // start bitrate is the first bitrate of the manifest
        bitrateStart = levels[0].bitrate;
        // sort level on bitrate
        levels.sort(function (a, b) {
          return a.bitrate - b.bitrate;
        });
        this._levels = levels;
        // find index of first level in sorted levels
        for (i = 0; i < levels.length; i++) {
          if (levels[i].bitrate === bitrateStart) {
            this._firstLevel = i;
            _utilsLogger.logger.log('manifest loaded,' + levels.length + ' level(s) found, first bitrate:' + bitrateStart);
            break;
          }
        }
        hls.trigger(_events2['default'].MANIFEST_PARSED, { levels: this._levels, firstLevel: this._firstLevel, stats: data.stats });
      } else {
        hls.trigger(_events2['default'].ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: _errors.ErrorDetails.MANIFEST_PARSING_ERROR, fatal: true, url: hls.url, reason: 'no compatible level found in manifest' });
      }
      return;
    }
  }, {
    key: 'setLevelInternal',
    value: function setLevelInternal(newLevel) {
      // check if level idx is valid
      if (newLevel >= 0 && newLevel < this._levels.length) {
        // stopping live reloading timer if any
        if (this.timer) {
          clearInterval(this.timer);
          this.timer = null;
        }
        this._level = newLevel;
        _utilsLogger.logger.log('switching to level ' + newLevel);
        this.hls.trigger(_events2['default'].LEVEL_SWITCH, { level: newLevel });
        var level = this._levels[newLevel];
        // check if we need to load playlist for this level
        if (level.details === undefined || level.details.live === true) {
          // level not retrieved yet, or live playlist we need to (re)load it
          _utilsLogger.logger.log('(re)loading playlist for level ' + newLevel);
          var urlId = level.urlId;
          this.hls.trigger(_events2['default'].LEVEL_LOADING, { url: level.url[urlId], level: newLevel, id: urlId });
        }
      } else {
        // invalid level id given, trigger error
        this.hls.trigger(_events2['default'].ERROR, { type: _errors.ErrorTypes.OTHER_ERROR, details: _errors.ErrorDetails.LEVEL_SWITCH_ERROR, level: newLevel, fatal: false, reason: 'invalid level idx' });
      }
    }
  }, {
    key: 'onError',
    value: function onError(data) {
      if (data.fatal) {
        return;
      }

      var details = data.details,
          hls = this.hls,
          levelId,
          level;
      // try to recover not fatal errors
      switch (details) {
        case _errors.ErrorDetails.FRAG_LOAD_ERROR:
        case _errors.ErrorDetails.FRAG_LOAD_TIMEOUT:
        case _errors.ErrorDetails.FRAG_LOOP_LOADING_ERROR:
        case _errors.ErrorDetails.KEY_LOAD_ERROR:
        case _errors.ErrorDetails.KEY_LOAD_TIMEOUT:
          levelId = data.frag.level;
          break;
        case _errors.ErrorDetails.LEVEL_LOAD_ERROR:
        case _errors.ErrorDetails.LEVEL_LOAD_TIMEOUT:
          levelId = data.level;
          break;
        default:
          break;
      }
      /* try to switch to a redundant stream if any available.
       * if no redundant stream available, emergency switch down (if in auto mode and current level not 0)
       * otherwise, we cannot recover this network error ...
       * don't raise FRAG_LOAD_ERROR and FRAG_LOAD_TIMEOUT as fatal, as it is handled by mediaController
       */
      if (levelId !== undefined) {
        level = this._levels[levelId];
        if (level.urlId < level.url.length - 1) {
          level.urlId++;
          level.details = undefined;
          _utilsLogger.logger.warn('level controller,' + details + ' for level ' + levelId + ': switching to redundant stream id ' + level.urlId);
        } else {
          // we could try to recover if in auto mode and current level not lowest level (0)
          var recoverable = this._manualLevel === -1 && levelId;
          if (recoverable) {
            _utilsLogger.logger.warn('level controller,' + details + ': emergency switch-down for next fragment');
            hls.abrController.nextAutoLevel = 0;
          } else if (level && level.details && level.details.live) {
            _utilsLogger.logger.warn('level controller,' + details + ' on live stream, discard');
            // FRAG_LOAD_ERROR and FRAG_LOAD_TIMEOUT are handled by mediaController
          } else if (details !== _errors.ErrorDetails.FRAG_LOAD_ERROR && details !== _errors.ErrorDetails.FRAG_LOAD_TIMEOUT) {
              _utilsLogger.logger.error('cannot recover ' + details + ' error');
              this._level = undefined;
              // stopping live reloading timer if any
              if (this.timer) {
                clearInterval(this.timer);
                this.timer = null;
              }
              // redispatch same error but with fatal set to true
              data.fatal = true;
              hls.trigger(event, data);
            }
        }
      }
    }
  }, {
    key: 'onLevelLoaded',
    value: function onLevelLoaded(data) {
      // check if current playlist is a live playlist
      if (data.details.live && !this.timer) {
        // if live playlist we will have to reload it periodically
        // set reload period to playlist target duration
        this.timer = setInterval(this.ontick, 1000 * data.details.targetduration);
      }
      if (!data.details.live && this.timer) {
        // playlist is not live and timer is armed : stopping it
        clearInterval(this.timer);
        this.timer = null;
      }
    }
  }, {
    key: 'tick',
    value: function tick() {
      var levelId = this._level;
      if (levelId !== undefined) {
        var level = this._levels[levelId],
            urlId = level.urlId;
        this.hls.trigger(_events2['default'].LEVEL_LOADING, { url: level.url[urlId], level: levelId, id: urlId });
      }
    }
  }, {
    key: 'nextLoadLevel',
    value: function nextLoadLevel() {
      if (this._manualLevel !== -1) {
        return this._manualLevel;
      } else {
        return this.hls.abrController.nextAutoLevel;
      }
    }
  }, {
    key: 'levels',
    get: function get() {
      return this._levels;
    }
  }, {
    key: 'level',
    get: function get() {
      return this._level;
    },
    set: function set(newLevel) {
      if (this._level !== newLevel || this._levels[newLevel].details === undefined) {
        this.setLevelInternal(newLevel);
      }
    }
  }, {
    key: 'manualLevel',
    get: function get() {
      return this._manualLevel;
    },
    set: function set(newLevel) {
      this._manualLevel = newLevel;
      if (newLevel !== -1) {
        this.level = newLevel;
      }
    }
  }, {
    key: 'firstLevel',
    get: function get() {
      return this._firstLevel;
    },
    set: function set(newLevel) {
      this._firstLevel = newLevel;
    }
  }, {
    key: 'startLevel',
    get: function get() {
      if (this._startLevel === undefined) {
        return this._firstLevel;
      } else {
        return this._startLevel;
      }
    },
    set: function set(newLevel) {
      this._startLevel = newLevel;
    }
  }]);

  return LevelController;
})(_eventHandler2['default']);

exports['default'] = LevelController;
module.exports = exports['default'];

},{"../errors":18,"../event-handler":19,"../events":20,"../utils/logger":31}],5:[function(require,module,exports){
/*
 * MSE Media Controller
*/

'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _demuxDemuxer = require('../demux/demuxer');

var _demuxDemuxer2 = _interopRequireDefault(_demuxDemuxer);

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _eventHandler = require('../event-handler');

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _utilsLogger = require('../utils/logger');

var _utilsBinarySearch = require('../utils/binary-search');

var _utilsBinarySearch2 = _interopRequireDefault(_utilsBinarySearch);

var _helperLevelHelper = require('../helper/level-helper');

var _helperLevelHelper2 = _interopRequireDefault(_helperLevelHelper);

var _errors = require('../errors');

var State = {
  ERROR: -2,
  STARTING: -1,
  IDLE: 0,
  KEY_LOADING: 1,
  FRAG_LOADING: 2,
  FRAG_LOADING_WAITING_RETRY: 3,
  WAITING_LEVEL: 4,
  PARSING: 5,
  PARSED: 6,
  APPENDING: 7,
  BUFFER_FLUSHING: 8,
  ENDED: 9
};

var MSEMediaController = (function (_EventHandler) {
  _inherits(MSEMediaController, _EventHandler);

  function MSEMediaController(hls) {
    _classCallCheck(this, MSEMediaController);

    _get(Object.getPrototypeOf(MSEMediaController.prototype), 'constructor', this).call(this, hls, _events2['default'].MEDIA_ATTACHING, _events2['default'].MEDIA_DETACHING, _events2['default'].MANIFEST_PARSED, _events2['default'].LEVEL_LOADED, _events2['default'].KEY_LOADED, _events2['default'].FRAG_LOADED, _events2['default'].FRAG_PARSING_INIT_SEGMENT, _events2['default'].FRAG_PARSING_DATA, _events2['default'].FRAG_PARSED, _events2['default'].ERROR);
    this.config = hls.config;
    this.audioCodecSwap = false;
    this.ticks = 0;
    // Source Buffer listeners
    this.onsbue = this.onSBUpdateEnd.bind(this);
    this.onsbe = this.onSBUpdateError.bind(this);
    this.ontick = this.tick.bind(this);
  }

  _createClass(MSEMediaController, [{
    key: 'destroy',
    value: function destroy() {
      this.stop();
      _eventHandler2['default'].prototype.destroy.call(this);
      this.state = State.IDLE;
    }
  }, {
    key: 'startLoad',
    value: function startLoad() {
      if (this.levels && this.media) {
        this.startInternal();
        if (this.lastCurrentTime) {
          _utilsLogger.logger.log('seeking @ ' + this.lastCurrentTime);
          if (!this.lastPaused) {
            _utilsLogger.logger.log('resuming video');
            this.media.play();
          }
          this.state = State.IDLE;
        } else {
          this.lastCurrentTime = 0;
          this.state = State.STARTING;
        }
        this.nextLoadPosition = this.startPosition = this.lastCurrentTime;
        this.tick();
      } else {
        _utilsLogger.logger.warn('cannot start loading as either manifest not parsed or video not attached');
      }
    }
  }, {
    key: 'startInternal',
    value: function startInternal() {
      var hls = this.hls;
      this.stop();
      this.demuxer = new _demuxDemuxer2['default'](hls);
      this.timer = setInterval(this.ontick, 100);
      this.level = -1;
      this.fragLoadError = 0;
    }
  }, {
    key: 'stop',
    value: function stop() {
      this.mp4segments = [];
      this.flushRange = [];
      this.bufferRange = [];
      this.stalled = false;
      var frag = this.fragCurrent;
      if (frag) {
        if (frag.loader) {
          frag.loader.abort();
        }
        this.fragCurrent = null;
      }
      this.fragPrevious = null;
      if (this.sourceBuffer) {
        for (var type in this.sourceBuffer) {
          var sb = this.sourceBuffer[type];
          try {
            this.mediaSource.removeSourceBuffer(sb);
            sb.removeEventListener('updateend', this.onsbue);
            sb.removeEventListener('error', this.onsbe);
          } catch (err) {}
        }
        this.sourceBuffer = null;
      }
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
      if (this.demuxer) {
        this.demuxer.destroy();
        this.demuxer = null;
      }
    }
  }, {
    key: 'tick',
    value: function tick() {
      this.ticks++;
      if (this.ticks === 1) {
        this.doTick();
        if (this.ticks > 1) {
          setTimeout(this.tick, 1);
        }
        this.ticks = 0;
      }
    }
  }, {
    key: 'doTick',
    value: function doTick() {
      var pos,
          level,
          levelDetails,
          hls = this.hls;
      switch (this.state) {
        case State.ERROR:
          //don't do anything in error state to avoid breaking further ...
          break;
        case State.STARTING:
          // determine load level
          this.startLevel = hls.startLevel;
          if (this.startLevel === -1) {
            // -1 : guess start Level by doing a bitrate test by loading first fragment of lowest quality level
            this.startLevel = 0;
            this.fragBitrateTest = true;
          }
          // set new level to playlist loader : this will trigger start level load
          this.level = hls.nextLoadLevel = this.startLevel;
          this.state = State.WAITING_LEVEL;
          this.loadedmetadata = false;
          break;
        case State.IDLE:
          // if video detached or unbound exit loop
          if (!this.media) {
            break;
          }
          // determine next candidate fragment to be loaded, based on current position and
          //  end of buffer position
          //  ensure 60s of buffer upfront
          // if we have not yet loaded any fragment, start loading from start position
          if (this.loadedmetadata) {
            pos = this.media.currentTime;
          } else {
            pos = this.nextLoadPosition;
          }
          // determine next load level
          if (this.startFragmentRequested === false) {
            level = this.startLevel;
          } else {
            // we are not at playback start, get next load level from level Controller
            level = hls.nextLoadLevel;
          }
          var bufferInfo = this.bufferInfo(pos, this.config.maxBufferHole),
              bufferLen = bufferInfo.len,
              bufferEnd = bufferInfo.end,
              fragPrevious = this.fragPrevious,
              maxBufLen;
          // compute max Buffer Length that we could get from this load level, based on level bitrate. don't buffer more than 60 MB and more than 30s
          if (this.levels[level].hasOwnProperty('bitrate')) {
            maxBufLen = Math.max(8 * this.config.maxBufferSize / this.levels[level].bitrate, this.config.maxBufferLength);
            maxBufLen = Math.min(maxBufLen, this.config.maxMaxBufferLength);
          } else {
            maxBufLen = this.config.maxBufferLength;
          }
          // if buffer length is less than maxBufLen try to load a new fragment
          if (bufferLen < maxBufLen) {
            // set next load level : this will trigger a playlist load if needed
            hls.nextLoadLevel = level;
            this.level = level;
            levelDetails = this.levels[level].details;
            // if level info not retrieved yet, switch state and wait for level retrieval
            // if live playlist, ensure that new playlist has been refreshed to avoid loading/try to load
            // a useless and outdated fragment (that might even introduce load error if it is already out of the live playlist)
            if (typeof levelDetails === 'undefined' || levelDetails.live && this.levelLastLoaded !== level) {
              this.state = State.WAITING_LEVEL;
              break;
            }
            // find fragment index, contiguous with end of buffer position
            var fragments = levelDetails.fragments,
                fragLen = fragments.length,
                start = fragments[0].start,
                end = fragments[fragLen - 1].start + fragments[fragLen - 1].duration,
                _frag = undefined;

            // in case of live playlist we need to ensure that requested position is not located before playlist start
            if (levelDetails.live) {
              // check if requested position is within seekable boundaries :
              //logger.log(`start/pos/bufEnd/seeking:${start.toFixed(3)}/${pos.toFixed(3)}/${bufferEnd.toFixed(3)}/${this.media.seeking}`);
              if (bufferEnd < Math.max(start, end - this.config.liveMaxLatencyDurationCount * levelDetails.targetduration)) {
                this.seekAfterBuffered = start + Math.max(0, levelDetails.totalduration - this.config.liveSyncDurationCount * levelDetails.targetduration);
                _utilsLogger.logger.log('buffer end: ' + bufferEnd + ' is located too far from the end of live sliding playlist, media position will be reseted to: ' + this.seekAfterBuffered.toFixed(3));
                bufferEnd = this.seekAfterBuffered;
              }
              if (this.startFragmentRequested && !levelDetails.PTSKnown) {
                /* we are switching level on live playlist, but we don't have any PTS info for that quality level ...
                   try to load frag matching with next SN.
                   even if SN are not synchronized between playlists, loading this frag will help us
                   compute playlist sliding and find the right one after in case it was not the right consecutive one */
                if (fragPrevious) {
                  var targetSN = fragPrevious.sn + 1;
                  if (targetSN >= levelDetails.startSN && targetSN <= levelDetails.endSN) {
                    _frag = fragments[targetSN - levelDetails.startSN];
                    _utilsLogger.logger.log('live playlist, switching playlist, load frag with next SN: ' + _frag.sn);
                  }
                }
                if (!_frag) {
                  /* we have no idea about which fragment should be loaded.
                     so let's load mid fragment. it will help computing playlist sliding and find the right one
                  */
                  _frag = fragments[Math.min(fragLen - 1, Math.round(fragLen / 2))];
                  _utilsLogger.logger.log('live playlist, switching playlist, unknown, load middle frag : ' + _frag.sn);
                }
              }
            } else {
              // VoD playlist: if bufferEnd before start of playlist, load first fragment
              if (bufferEnd < start) {
                _frag = fragments[0];
              }
            }
            if (!_frag) {
              var foundFrag;
              if (bufferEnd < end) {
                foundFrag = _utilsBinarySearch2['default'].search(fragments, function (candidate) {
                  //logger.log(`level/sn/start/end/bufEnd:${level}/${candidate.sn}/${candidate.start}/${(candidate.start+candidate.duration)}/${bufferEnd}`);
                  // offset should be within fragment boundary
                  if (candidate.start + candidate.duration <= bufferEnd) {
                    return 1;
                  } else if (candidate.start > bufferEnd) {
                    return -1;
                  }
                  return 0;
                });
              } else {
                // reach end of playlist
                foundFrag = fragments[fragLen - 1];
              }
              if (foundFrag) {
                _frag = foundFrag;
                start = foundFrag.start;
                //logger.log('find SN matching with pos:' +  bufferEnd + ':' + frag.sn);
                if (fragPrevious && _frag.level === fragPrevious.level && _frag.sn === fragPrevious.sn) {
                  if (_frag.sn < levelDetails.endSN) {
                    _frag = fragments[_frag.sn + 1 - levelDetails.startSN];
                    _utilsLogger.logger.log('SN just loaded, load next one: ' + _frag.sn);
                  } else {
                    // have we reached end of VOD playlist ?
                    if (!levelDetails.live) {
                      var mediaSource = this.mediaSource;
                      if (mediaSource) {
                        switch (mediaSource.readyState) {
                          case 'open':
                            var sb = this.sourceBuffer;
                            if (!(sb.audio && sb.audio.updating || sb.video && sb.video.updating)) {
                              _utilsLogger.logger.log('all media data available, signal endOfStream() to MediaSource and stop loading fragment');
                              //Notify the media element that it now has all of the media data
                              mediaSource.endOfStream();
                              this.state = State.ENDED;
                            }
                            break;
                          case 'ended':
                            _utilsLogger.logger.log('all media data available and mediaSource ended, stop loading fragment');
                            this.state = State.ENDED;
                            break;
                          default:
                            break;
                        }
                      }
                    }
                    _frag = null;
                  }
                }
              }
            }
            if (_frag) {
              //logger.log('      loading frag ' + i +',pos/bufEnd:' + pos.toFixed(3) + '/' + bufferEnd.toFixed(3));
              if (_frag.decryptdata.uri != null && _frag.decryptdata.key == null) {
                _utilsLogger.logger.log('Loading key for ' + _frag.sn + ' of [' + levelDetails.startSN + ' ,' + levelDetails.endSN + '],level ' + level);
                this.state = State.KEY_LOADING;
                hls.trigger(_events2['default'].KEY_LOADING, { frag: _frag });
              } else {
                _utilsLogger.logger.log('Loading ' + _frag.sn + ' of [' + levelDetails.startSN + ' ,' + levelDetails.endSN + '],level ' + level + ', currentTime:' + pos + ',bufferEnd:' + bufferEnd.toFixed(3));
                _frag.autoLevel = hls.autoLevelEnabled;
                if (this.levels.length > 1) {
                  _frag.expectedLen = Math.round(_frag.duration * this.levels[level].bitrate / 8);
                  _frag.trequest = performance.now();
                }
                // ensure that we are not reloading the same fragments in loop ...
                if (this.fragLoadIdx !== undefined) {
                  this.fragLoadIdx++;
                } else {
                  this.fragLoadIdx = 0;
                }
                if (_frag.loadCounter) {
                  _frag.loadCounter++;
                  var maxThreshold = this.config.fragLoadingLoopThreshold;
                  // if this frag has already been loaded 3 times, and if it has been reloaded recently
                  if (_frag.loadCounter > maxThreshold && Math.abs(this.fragLoadIdx - _frag.loadIdx) < maxThreshold) {
                    hls.trigger(_events2['default'].ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.FRAG_LOOP_LOADING_ERROR, fatal: false, frag: _frag });
                    return;
                  }
                } else {
                  _frag.loadCounter = 1;
                }
                _frag.loadIdx = this.fragLoadIdx;
                this.fragCurrent = _frag;
                this.startFragmentRequested = true;
                hls.trigger(_events2['default'].FRAG_LOADING, { frag: _frag });
                this.state = State.FRAG_LOADING;
              }
            }
          }
          break;
        case State.WAITING_LEVEL:
          level = this.levels[this.level];
          // check if playlist is already loaded
          if (level && level.details) {
            this.state = State.IDLE;
          }
          break;
        case State.FRAG_LOADING:
          /*
            monitor fragment retrieval time...
            we compute expected time of arrival of the complete fragment.
            we compare it to expected time of buffer starvation
          */
          var v = this.media,
              frag = this.fragCurrent;
          /* only monitor frag retrieval time if
          (video not paused OR first fragment being loaded) AND autoswitching enabled AND not lowest level AND multiple levels */
          if (v && (!v.paused || this.loadedmetadata === false) && frag.autoLevel && this.level && this.levels.length > 1) {
            var requestDelay = performance.now() - frag.trequest;
            // monitor fragment load progress after half of expected fragment duration,to stabilize bitrate
            if (requestDelay > 500 * frag.duration) {
              var loadRate = frag.loaded * 1000 / requestDelay; // byte/s
              if (frag.expectedLen < frag.loaded) {
                frag.expectedLen = frag.loaded;
              }
              pos = v.currentTime;
              var fragLoadedDelay = (frag.expectedLen - frag.loaded) / loadRate;
              var bufferStarvationDelay = this.bufferInfo(pos, this.config.maxBufferHole).end - pos;
              var fragLevelNextLoadedDelay = frag.duration * this.levels[hls.nextLoadLevel].bitrate / (8 * loadRate); //bps/Bps
              /* if we have less than 2 frag duration in buffer and if frag loaded delay is greater than buffer starvation delay
                ... and also bigger than duration needed to load fragment at next level ...*/
              if (bufferStarvationDelay < 2 * frag.duration && fragLoadedDelay > bufferStarvationDelay && fragLoadedDelay > fragLevelNextLoadedDelay) {
                // abort fragment loading ...
                _utilsLogger.logger.warn('loading too slow, abort fragment loading');
                _utilsLogger.logger.log('fragLoadedDelay/bufferStarvationDelay/fragLevelNextLoadedDelay :' + fragLoadedDelay.toFixed(1) + '/' + bufferStarvationDelay.toFixed(1) + '/' + fragLevelNextLoadedDelay.toFixed(1));
                //abort fragment loading
                frag.loader.abort();
                hls.trigger(_events2['default'].FRAG_LOAD_EMERGENCY_ABORTED, { frag: frag });
                // switch back to IDLE state to request new fragment at lowest level
                this.state = State.IDLE;
              }
            }
          }
          break;
        case State.FRAG_LOADING_WAITING_RETRY:
          var now = performance.now();
          var retryDate = this.retryDate;
          var media = this.media;
          var isSeeking = media && media.seeking;
          // if current time is gt than retryDate, or if media seeking let's switch to IDLE state to retry loading
          if (!retryDate || now >= retryDate || isSeeking) {
            _utilsLogger.logger.log('mediaController: retryDate reached, switch back to IDLE state');
            this.state = State.IDLE;
          }
          break;
        case State.PARSING:
          // nothing to do, wait for fragment being parsed
          break;
        case State.PARSED:
        case State.APPENDING:
          if (this.sourceBuffer) {
            if (this.media.error) {
              _utilsLogger.logger.error('trying to append although a media error occured, switch to ERROR state');
              this.state = State.ERROR;
              return;
            }
            // if MP4 segment appending in progress nothing to do
            else if (this.sourceBuffer.audio && this.sourceBuffer.audio.updating || this.sourceBuffer.video && this.sourceBuffer.video.updating) {
                //logger.log('sb append in progress');
                // check if any MP4 segments left to append
              } else if (this.mp4segments.length) {
                  var segment = this.mp4segments.shift();
                  try {
                    //logger.log(`appending ${segment.type} SB, size:${segment.data.length});
                    this.sourceBuffer[segment.type].appendBuffer(segment.data);
                    this.appendError = 0;
                  } catch (err) {
                    // in case any error occured while appending, put back segment in mp4segments table
                    _utilsLogger.logger.error('error while trying to append buffer:' + err.message + ',try appending later');
                    this.mp4segments.unshift(segment);
                    // just discard QuotaExceededError for now, and wait for the natural browser buffer eviction
                    //http://www.w3.org/TR/html5/infrastructure.html#quotaexceedederror
                    if (err.code !== 22) {
                      if (this.appendError) {
                        this.appendError++;
                      } else {
                        this.appendError = 1;
                      }
                      var event = { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.BUFFER_APPEND_ERROR, frag: this.fragCurrent };
                      /* with UHD content, we could get loop of quota exceeded error until
                        browser is able to evict some data from sourcebuffer. retrying help recovering this
                      */
                      if (this.appendError > this.config.appendErrorMaxRetry) {
                        _utilsLogger.logger.log('fail ' + this.config.appendErrorMaxRetry + ' times to append segment in sourceBuffer');
                        event.fatal = true;
                        hls.trigger(_events2['default'].ERROR, event);
                        this.state = State.ERROR;
                        return;
                      } else {
                        event.fatal = false;
                        hls.trigger(_events2['default'].ERROR, event);
                      }
                    }
                  }
                  this.state = State.APPENDING;
                }
          } else {
            // sourceBuffer undefined, switch back to IDLE state
            this.state = State.IDLE;
          }
          break;
        case State.BUFFER_FLUSHING:
          // loop through all buffer ranges to flush
          while (this.flushRange.length) {
            var range = this.flushRange[0];
            // flushBuffer will abort any buffer append in progress and flush Audio/Video Buffer
            if (this.flushBuffer(range.start, range.end)) {
              // range flushed, remove from flush array
              this.flushRange.shift();
            } else {
              // flush in progress, come back later
              break;
            }
          }
          if (this.flushRange.length === 0) {
            // handle end of immediate switching if needed
            if (this.immediateSwitch) {
              this.immediateLevelSwitchEnd();
            }
            // move to IDLE once flush complete. this should trigger new fragment loading
            this.state = State.IDLE;
            // reset reference to frag
            this.fragPrevious = null;
          }
          /* if not everything flushed, stay in BUFFER_FLUSHING state. we will come back here
             each time sourceBuffer updateend() callback will be triggered
             */
          break;
        case State.ENDED:
          break;
        default:
          break;
      }
      // check buffer
      this._checkBuffer();
      // check/update current fragment
      this._checkFragmentChanged();
    }
  }, {
    key: 'bufferInfo',
    value: function bufferInfo(pos, maxHoleDuration) {
      var media = this.media,
          vbuffered = media.buffered,
          buffered = [],
          i;
      for (i = 0; i < vbuffered.length; i++) {
        buffered.push({ start: vbuffered.start(i), end: vbuffered.end(i) });
      }
      return this.bufferedInfo(buffered, pos, maxHoleDuration);
    }
  }, {
    key: 'bufferedInfo',
    value: function bufferedInfo(buffered, pos, maxHoleDuration) {
      var buffered2 = [],

      // bufferStart and bufferEnd are buffer boundaries around current video position
      bufferLen,
          bufferStart,
          bufferEnd,
          bufferStartNext,
          i;
      // sort on buffer.start/smaller end (IE does not always return sorted buffered range)
      buffered.sort(function (a, b) {
        var diff = a.start - b.start;
        if (diff) {
          return diff;
        } else {
          return b.end - a.end;
        }
      });
      // there might be some small holes between buffer time range
      // consider that holes smaller than maxHoleDuration are irrelevant and build another
      // buffer time range representations that discards those holes
      for (i = 0; i < buffered.length; i++) {
        var buf2len = buffered2.length;
        if (buf2len) {
          var buf2end = buffered2[buf2len - 1].end;
          // if small hole (value between 0 or maxHoleDuration ) or overlapping (negative)
          if (buffered[i].start - buf2end < maxHoleDuration) {
            // merge overlapping time ranges
            // update lastRange.end only if smaller than item.end
            // e.g.  [ 1, 15] with  [ 2,8] => [ 1,15] (no need to modify lastRange.end)
            // whereas [ 1, 8] with  [ 2,15] => [ 1,15] ( lastRange should switch from [1,8] to [1,15])
            if (buffered[i].end > buf2end) {
              buffered2[buf2len - 1].end = buffered[i].end;
            }
          } else {
            // big hole
            buffered2.push(buffered[i]);
          }
        } else {
          // first value
          buffered2.push(buffered[i]);
        }
      }
      for (i = 0, bufferLen = 0, bufferStart = bufferEnd = pos; i < buffered2.length; i++) {
        var start = buffered2[i].start,
            end = buffered2[i].end;
        //logger.log('buf start/end:' + buffered.start(i) + '/' + buffered.end(i));
        if (pos + maxHoleDuration >= start && pos < end) {
          // play position is inside this buffer TimeRange, retrieve end of buffer position and buffer length
          bufferStart = start;
          bufferEnd = end + maxHoleDuration;
          bufferLen = bufferEnd - pos;
        } else if (pos + maxHoleDuration < start) {
          bufferStartNext = start;
          break;
        }
      }
      return { len: bufferLen, start: bufferStart, end: bufferEnd, nextStart: bufferStartNext };
    }
  }, {
    key: 'getBufferRange',
    value: function getBufferRange(position) {
      var i, range;
      for (i = this.bufferRange.length - 1; i >= 0; i--) {
        range = this.bufferRange[i];
        if (position >= range.start && position <= range.end) {
          return range;
        }
      }
      return null;
    }
  }, {
    key: 'followingBufferRange',
    value: function followingBufferRange(range) {
      if (range) {
        // try to get range of next fragment (500ms after this range)
        return this.getBufferRange(range.end + 0.5);
      }
      return null;
    }
  }, {
    key: 'isBuffered',
    value: function isBuffered(position) {
      var v = this.media,
          buffered = v.buffered;
      for (var i = 0; i < buffered.length; i++) {
        if (position >= buffered.start(i) && position <= buffered.end(i)) {
          return true;
        }
      }
      return false;
    }
  }, {
    key: '_checkFragmentChanged',
    value: function _checkFragmentChanged() {
      var rangeCurrent,
          currentTime,
          video = this.media;
      if (video && video.seeking === false) {
        currentTime = video.currentTime;
        /* if video element is in seeked state, currentTime can only increase.
          (assuming that playback rate is positive ...)
          As sometimes currentTime jumps back to zero after a
          media decode error, check this, to avoid seeking back to
          wrong position after a media decode error
        */
        if (currentTime > video.playbackRate * this.lastCurrentTime) {
          this.lastCurrentTime = currentTime;
        }
        if (this.isBuffered(currentTime)) {
          rangeCurrent = this.getBufferRange(currentTime);
        } else if (this.isBuffered(currentTime + 0.1)) {
          /* ensure that FRAG_CHANGED event is triggered at startup,
            when first video frame is displayed and playback is paused.
            add a tolerance of 100ms, in case current position is not buffered,
            check if current pos+100ms is buffered and use that buffer range
            for FRAG_CHANGED event reporting */
          rangeCurrent = this.getBufferRange(currentTime + 0.1);
        }
        if (rangeCurrent) {
          var fragPlaying = rangeCurrent.frag;
          if (fragPlaying !== this.fragPlaying) {
            this.fragPlaying = fragPlaying;
            this.hls.trigger(_events2['default'].FRAG_CHANGED, { frag: fragPlaying });
          }
        }
      }
    }

    /*
      abort any buffer append in progress, and flush all buffered data
      return true once everything has been flushed.
      sourceBuffer.abort() and sourceBuffer.remove() are asynchronous operations
      the idea is to call this function from tick() timer and call it again until all resources have been cleaned
      the timer is rearmed upon sourceBuffer updateend() event, so this should be optimal
    */
  }, {
    key: 'flushBuffer',
    value: function flushBuffer(startOffset, endOffset) {
      var sb, i, bufStart, bufEnd, flushStart, flushEnd;
      //logger.log('flushBuffer,pos/start/end: ' + this.media.currentTime + '/' + startOffset + '/' + endOffset);
      // safeguard to avoid infinite looping
      if (this.flushBufferCounter++ < 2 * this.bufferRange.length && this.sourceBuffer) {
        for (var type in this.sourceBuffer) {
          sb = this.sourceBuffer[type];
          if (!sb.updating) {
            for (i = 0; i < sb.buffered.length; i++) {
              bufStart = sb.buffered.start(i);
              bufEnd = sb.buffered.end(i);
              // workaround firefox not able to properly flush multiple buffered range.
              if (navigator.userAgent.toLowerCase().indexOf('firefox') !== -1 && endOffset === Number.POSITIVE_INFINITY) {
                flushStart = startOffset;
                flushEnd = endOffset;
              } else {
                flushStart = Math.max(bufStart, startOffset);
                flushEnd = Math.min(bufEnd, endOffset);
              }
              /* sometimes sourcebuffer.remove() does not flush
                 the exact expected time range.
                 to avoid rounding issues/infinite loop,
                 only flush buffer range of length greater than 500ms.
              */
              if (flushEnd - flushStart > 0.5) {
                _utilsLogger.logger.log('flush ' + type + ' [' + flushStart + ',' + flushEnd + '], of [' + bufStart + ',' + bufEnd + '], pos:' + this.media.currentTime);
                sb.remove(flushStart, flushEnd);
                return false;
              }
            }
          } else {
            //logger.log('abort ' + type + ' append in progress');
            // this will abort any appending in progress
            //sb.abort();
            return false;
          }
        }
      }

      /* after successful buffer flushing, rebuild buffer Range array
        loop through existing buffer range and check if
        corresponding range is still buffered. only push to new array already buffered range
      */
      var newRange = [],
          range;
      for (i = 0; i < this.bufferRange.length; i++) {
        range = this.bufferRange[i];
        if (this.isBuffered((range.start + range.end) / 2)) {
          newRange.push(range);
        }
      }
      this.bufferRange = newRange;
      _utilsLogger.logger.log('buffer flushed');
      // everything flushed !
      return true;
    }

    /*
      on immediate level switch :
       - pause playback if playing
       - cancel any pending load request
       - and trigger a buffer flush
    */
  }, {
    key: 'immediateLevelSwitch',
    value: function immediateLevelSwitch() {
      _utilsLogger.logger.log('immediateLevelSwitch');
      if (!this.immediateSwitch) {
        this.immediateSwitch = true;
        this.previouslyPaused = this.media.paused;
        this.media.pause();
      }
      var fragCurrent = this.fragCurrent;
      if (fragCurrent && fragCurrent.loader) {
        fragCurrent.loader.abort();
      }
      this.fragCurrent = null;
      // flush everything
      this.flushBufferCounter = 0;
      this.flushRange.push({ start: 0, end: Number.POSITIVE_INFINITY });
      // trigger a sourceBuffer flush
      this.state = State.BUFFER_FLUSHING;
      // increase fragment load Index to avoid frag loop loading error after buffer flush
      this.fragLoadIdx += 2 * this.config.fragLoadingLoopThreshold;
      // speed up switching, trigger timer function
      this.tick();
    }

    /*
       on immediate level switch end, after new fragment has been buffered :
        - nudge video decoder by slightly adjusting video currentTime
        - resume the playback if needed
    */
  }, {
    key: 'immediateLevelSwitchEnd',
    value: function immediateLevelSwitchEnd() {
      this.immediateSwitch = false;
      this.media.currentTime -= 0.0001;
      if (!this.previouslyPaused) {
        this.media.play();
      }
    }
  }, {
    key: 'nextLevelSwitch',
    value: function nextLevelSwitch() {
      /* try to switch ASAP without breaking video playback :
         in order to ensure smooth but quick level switching,
        we need to find the next flushable buffer range
        we should take into account new segment fetch time
      */
      var fetchdelay, currentRange, nextRange;
      currentRange = this.getBufferRange(this.media.currentTime);
      if (currentRange) {
        // flush buffer preceding current fragment (flush until current fragment start offset)
        // minus 1s to avoid video freezing, that could happen if we flush keyframe of current video ...
        this.flushRange.push({ start: 0, end: currentRange.start - 1 });
      }
      if (!this.media.paused) {
        // add a safety delay of 1s
        var nextLevelId = this.hls.nextLoadLevel,
            nextLevel = this.levels[nextLevelId],
            fragLastKbps = this.fragLastKbps;
        if (fragLastKbps && this.fragCurrent) {
          fetchdelay = this.fragCurrent.duration * nextLevel.bitrate / (1000 * fragLastKbps) + 1;
        } else {
          fetchdelay = 0;
        }
      } else {
        fetchdelay = 0;
      }
      //logger.log('fetchdelay:'+fetchdelay);
      // find buffer range that will be reached once new fragment will be fetched
      nextRange = this.getBufferRange(this.media.currentTime + fetchdelay);
      if (nextRange) {
        // we can flush buffer range following this one without stalling playback
        nextRange = this.followingBufferRange(nextRange);
        if (nextRange) {
          // flush position is the start position of this new buffer
          this.flushRange.push({ start: nextRange.start, end: Number.POSITIVE_INFINITY });
          // if we are here, we can also cancel any loading/demuxing in progress, as they are useless
          var fragCurrent = this.fragCurrent;
          if (fragCurrent && fragCurrent.loader) {
            fragCurrent.loader.abort();
          }
          this.fragCurrent = null;
        }
      }
      if (this.flushRange.length) {
        this.flushBufferCounter = 0;
        // trigger a sourceBuffer flush
        this.state = State.BUFFER_FLUSHING;
        // increase fragment load Index to avoid frag loop loading error after buffer flush
        this.fragLoadIdx += 2 * this.config.fragLoadingLoopThreshold;
        // speed up switching, trigger timer function
        this.tick();
      }
    }
  }, {
    key: 'onMediaAttaching',
    value: function onMediaAttaching(data) {
      var media = this.media = data.media;
      // setup the media source
      var ms = this.mediaSource = new MediaSource();
      //Media Source listeners
      this.onmso = this.onMediaSourceOpen.bind(this);
      this.onmse = this.onMediaSourceEnded.bind(this);
      this.onmsc = this.onMediaSourceClose.bind(this);
      ms.addEventListener('sourceopen', this.onmso);
      ms.addEventListener('sourceended', this.onmse);
      ms.addEventListener('sourceclose', this.onmsc);
      // link video and media Source
      media.src = URL.createObjectURL(ms);
    }
  }, {
    key: 'onMediaDetaching',
    value: function onMediaDetaching() {
      var media = this.media;
      if (media && media.ended) {
        _utilsLogger.logger.log('MSE detaching and video ended, reset startPosition');
        this.startPosition = this.lastCurrentTime = 0;
      }

      // reset fragment loading counter on MSE detaching to avoid reporting FRAG_LOOP_LOADING_ERROR after error recovery
      var levels = this.levels;
      if (levels) {
        // reset fragment load counter
        levels.forEach(function (level) {
          if (level.details) {
            level.details.fragments.forEach(function (fragment) {
              fragment.loadCounter = undefined;
            });
          }
        });
      }
      var ms = this.mediaSource;
      if (ms) {
        if (ms.readyState === 'open') {
          try {
            // endOfStream could trigger exception if any sourcebuffer is in updating state
            // we don't really care about checking sourcebuffer state here,
            // as we are anyway detaching the MediaSource
            // let's just avoid this exception to propagate
            ms.endOfStream();
          } catch (err) {
            _utilsLogger.logger.warn('onMediaDetaching:' + err.message + ' while calling endOfStream');
          }
        }
        ms.removeEventListener('sourceopen', this.onmso);
        ms.removeEventListener('sourceended', this.onmse);
        ms.removeEventListener('sourceclose', this.onmsc);
        // unlink MediaSource from video tag
        this.media.src = '';
        this.mediaSource = null;
        // remove video listeners
        if (media) {
          media.removeEventListener('seeking', this.onvseeking);
          media.removeEventListener('seeked', this.onvseeked);
          media.removeEventListener('loadedmetadata', this.onvmetadata);
          media.removeEventListener('ended', this.onvended);
          this.onvseeking = this.onvseeked = this.onvmetadata = null;
        }
        this.media = null;
        this.loadedmetadata = false;
        this.stop();
      }
      this.onmso = this.onmse = this.onmsc = null;
      this.hls.trigger(_events2['default'].MEDIA_DETACHED);
    }
  }, {
    key: 'onMediaSeeking',
    value: function onMediaSeeking() {
      if (this.state === State.FRAG_LOADING) {
        // check if currently loaded fragment is inside buffer.
        //if outside, cancel fragment loading, otherwise do nothing
        if (this.bufferInfo(this.media.currentTime, this.config.maxBufferHole).len === 0) {
          _utilsLogger.logger.log('seeking outside of buffer while fragment load in progress, cancel fragment load');
          var fragCurrent = this.fragCurrent;
          if (fragCurrent) {
            if (fragCurrent.loader) {
              fragCurrent.loader.abort();
            }
            this.fragCurrent = null;
          }
          this.fragPrevious = null;
          // switch to IDLE state to load new fragment
          this.state = State.IDLE;
        }
      } else if (this.state === State.ENDED) {
        // switch to IDLE state to check for potential new fragment
        this.state = State.IDLE;
      }
      if (this.media) {
        this.lastCurrentTime = this.media.currentTime;
      }
      // avoid reporting fragment loop loading error in case user is seeking several times on same position
      if (this.fragLoadIdx !== undefined) {
        this.fragLoadIdx += 2 * this.config.fragLoadingLoopThreshold;
      }
      // tick to speed up processing
      this.tick();
    }
  }, {
    key: 'onMediaSeeked',
    value: function onMediaSeeked() {
      // tick to speed up FRAGMENT_PLAYING triggering
      this.tick();
    }
  }, {
    key: 'onMediaMetadata',
    value: function onMediaMetadata() {
      var media = this.media,
          currentTime = media.currentTime;
      // only adjust currentTime if not equal to 0
      if (!currentTime && currentTime !== this.startPosition) {
        _utilsLogger.logger.log('onMediaMetadata: adjust currentTime to startPosition');
        media.currentTime = this.startPosition;
      }
      this.loadedmetadata = true;
      this.tick();
    }
  }, {
    key: 'onMediaEnded',
    value: function onMediaEnded() {
      _utilsLogger.logger.log('media ended');
      // reset startPosition and lastCurrentTime to restart playback @ stream beginning
      this.startPosition = this.lastCurrentTime = 0;
    }
  }, {
    key: 'onManifestParsed',
    value: function onManifestParsed(data) {
      var aac = false,
          heaac = false,
          codecs;
      data.levels.forEach(function (level) {
        // detect if we have different kind of audio codecs used amongst playlists
        codecs = level.codecs;
        if (codecs) {
          if (codecs.indexOf('mp4a.40.2') !== -1) {
            aac = true;
          }
          if (codecs.indexOf('mp4a.40.5') !== -1) {
            heaac = true;
          }
        }
      });
      this.audiocodecswitch = aac && heaac;
      if (this.audiocodecswitch) {
        _utilsLogger.logger.log('both AAC/HE-AAC audio found in levels; declaring audio codec as HE-AAC');
      }
      this.levels = data.levels;
      this.startLevelLoaded = false;
      this.startFragmentRequested = false;
      if (this.media && this.config.autoStartLoad) {
        this.startLoad();
      }
    }
  }, {
    key: 'onLevelLoaded',
    value: function onLevelLoaded(data) {
      var newDetails = data.details,
          newLevelId = data.level,
          curLevel = this.levels[newLevelId],
          duration = newDetails.totalduration;

      _utilsLogger.logger.log('level ' + newLevelId + ' loaded [' + newDetails.startSN + ',' + newDetails.endSN + '],duration:' + duration);
      this.levelLastLoaded = newLevelId;

      if (newDetails.live) {
        var curDetails = curLevel.details;
        if (curDetails) {
          // we already have details for that level, merge them
          _helperLevelHelper2['default'].mergeDetails(curDetails, newDetails);
          if (newDetails.PTSKnown) {
            _utilsLogger.logger.log('live playlist sliding:' + newDetails.fragments[0].start.toFixed(3));
          } else {
            _utilsLogger.logger.log('live playlist - outdated PTS, unknown sliding');
          }
        } else {
          newDetails.PTSKnown = false;
          _utilsLogger.logger.log('live playlist - first load, unknown sliding');
        }
      } else {
        newDetails.PTSKnown = false;
      }
      // override level info
      curLevel.details = newDetails;
      this.hls.trigger(_events2['default'].LEVEL_UPDATED, { details: newDetails, level: newLevelId });

      // compute start position
      if (this.startLevelLoaded === false) {
        // if live playlist, set start position to be fragment N-this.config.liveSyncDurationCount (usually 3)
        if (newDetails.live) {
          this.startPosition = Math.max(0, duration - this.config.liveSyncDurationCount * newDetails.targetduration);
        }
        this.nextLoadPosition = this.startPosition;
        this.startLevelLoaded = true;
      }
      // only switch batck to IDLE state if we were waiting for level to start downloading a new fragment
      if (this.state === State.WAITING_LEVEL) {
        this.state = State.IDLE;
      }
      //trigger handler right now
      this.tick();
    }
  }, {
    key: 'onKeyLoaded',
    value: function onKeyLoaded() {
      if (this.state === State.KEY_LOADING) {
        this.state = State.IDLE;
        this.tick();
      }
    }
  }, {
    key: 'onFragLoaded',
    value: function onFragLoaded(data) {
      var fragCurrent = this.fragCurrent;
      if (this.state === State.FRAG_LOADING && fragCurrent && data.frag.level === fragCurrent.level && data.frag.sn === fragCurrent.sn) {
        if (this.fragBitrateTest === true) {
          // switch back to IDLE state ... we just loaded a fragment to determine adequate start bitrate and initialize autoswitch algo
          this.state = State.IDLE;
          this.fragBitrateTest = false;
          data.stats.tparsed = data.stats.tbuffered = performance.now();
          this.hls.trigger(_events2['default'].FRAG_BUFFERED, { stats: data.stats, frag: fragCurrent });
        } else {
          this.state = State.PARSING;
          // transmux the MPEG-TS data to ISO-BMFF segments
          this.stats = data.stats;
          var currentLevel = this.levels[this.level],
              details = currentLevel.details,
              duration = details.totalduration,
              start = fragCurrent.start,
              level = fragCurrent.level,
              sn = fragCurrent.sn,
              audioCodec = currentLevel.audioCodec;
          if (this.audioCodecSwap) {
            _utilsLogger.logger.log('swapping playlist audio codec');
            if (audioCodec === undefined) {
              audioCodec = this.lastAudioCodec;
            }
            if (audioCodec.indexOf('mp4a.40.5') !== -1) {
              audioCodec = 'mp4a.40.2';
            } else {
              audioCodec = 'mp4a.40.5';
            }
          }
          _utilsLogger.logger.log('Demuxing ' + sn + ' of [' + details.startSN + ' ,' + details.endSN + '],level ' + level);
          this.demuxer.push(data.payload, audioCodec, currentLevel.videoCodec, start, fragCurrent.cc, level, sn, duration, fragCurrent.decryptdata);
        }
      }
      this.fragLoadError = 0;
    }
  }, {
    key: 'onFragParsingInitSegment',
    value: function onFragParsingInitSegment(data) {
      if (this.state === State.PARSING) {
        // check if codecs have been explicitely defined in the master playlist for this level;
        // if yes use these ones instead of the ones parsed from the demux
        var audioCodec = this.levels[this.level].audioCodec,
            videoCodec = this.levels[this.level].videoCodec,
            sb;
        this.lastAudioCodec = data.audioCodec;
        if (audioCodec && this.audioCodecSwap) {
          _utilsLogger.logger.log('swapping playlist audio codec');
          if (audioCodec.indexOf('mp4a.40.5') !== -1) {
            audioCodec = 'mp4a.40.2';
          } else {
            audioCodec = 'mp4a.40.5';
          }
        }
        _utilsLogger.logger.log('playlist_level/init_segment codecs: video => ' + videoCodec + '/' + data.videoCodec + '; audio => ' + audioCodec + '/' + data.audioCodec);
        // if playlist does not specify codecs, use codecs found while parsing fragment
        // if no codec found while parsing fragment, also set codec to undefined to avoid creating sourceBuffer
        if (audioCodec === undefined || data.audioCodec === undefined) {
          audioCodec = data.audioCodec;
        }

        if (videoCodec === undefined || data.videoCodec === undefined) {
          videoCodec = data.videoCodec;
        }
        // in case several audio codecs might be used, force HE-AAC for audio (some browsers don't support audio codec switch)
        //don't do it for mono streams ...
        var ua = navigator.userAgent.toLowerCase();
        if (this.audiocodecswitch && data.audioChannelCount !== 1 && ua.indexOf('android') === -1 && ua.indexOf('firefox') === -1) {
          audioCodec = 'mp4a.40.5';
        }
        if (!this.sourceBuffer) {
          this.sourceBuffer = {};
          _utilsLogger.logger.log('selected A/V codecs for sourceBuffers:' + audioCodec + ',' + videoCodec);
          // create source Buffer and link them to MediaSource
          if (audioCodec) {
            sb = this.sourceBuffer.audio = this.mediaSource.addSourceBuffer('video/mp4;codecs=' + audioCodec);
            sb.addEventListener('updateend', this.onsbue);
            sb.addEventListener('error', this.onsbe);
          }
          if (videoCodec) {
            sb = this.sourceBuffer.video = this.mediaSource.addSourceBuffer('video/mp4;codecs=' + videoCodec);
            sb.addEventListener('updateend', this.onsbue);
            sb.addEventListener('error', this.onsbe);
          }
        }
        if (audioCodec) {
          this.mp4segments.push({ type: 'audio', data: data.audioMoov });
        }
        if (videoCodec) {
          this.mp4segments.push({ type: 'video', data: data.videoMoov });
        }
        //trigger handler right now
        this.tick();
      }
    }
  }, {
    key: 'onFragParsingData',
    value: function onFragParsingData(data) {
      if (this.state === State.PARSING) {
        this.tparse2 = Date.now();
        var level = this.levels[this.level],
            frag = this.fragCurrent;
        _utilsLogger.logger.log('parsed ' + data.type + ',PTS:[' + data.startPTS.toFixed(3) + ',' + data.endPTS.toFixed(3) + '],DTS:[' + data.startDTS.toFixed(3) + '/' + data.endDTS.toFixed(3) + '],nb:' + data.nb);
        var drift = _helperLevelHelper2['default'].updateFragPTS(level.details, frag.sn, data.startPTS, data.endPTS);
        this.hls.trigger(_events2['default'].LEVEL_PTS_UPDATED, { details: level.details, level: this.level, drift: drift });

        this.mp4segments.push({ type: data.type, data: data.moof });
        this.mp4segments.push({ type: data.type, data: data.mdat });
        this.nextLoadPosition = data.endPTS;
        this.bufferRange.push({ type: data.type, start: data.startPTS, end: data.endPTS, frag: frag });

        //trigger handler right now
        this.tick();
      } else {
        _utilsLogger.logger.warn('not in PARSING state, ignoring FRAG_PARSING_DATA event');
      }
    }
  }, {
    key: 'onFragParsed',
    value: function onFragParsed() {
      if (this.state === State.PARSING) {
        this.state = State.PARSED;
        this.stats.tparsed = performance.now();
        //trigger handler right now
        this.tick();
      }
    }
  }, {
    key: 'onError',
    value: function onError(data) {
      switch (data.details) {
        case _errors.ErrorDetails.FRAG_LOAD_ERROR:
        case _errors.ErrorDetails.FRAG_LOAD_TIMEOUT:
          if (!data.fatal) {
            var loadError = this.fragLoadError;
            if (loadError) {
              loadError++;
            } else {
              loadError = 1;
            }
            if (loadError <= this.config.fragLoadingMaxRetry) {
              this.fragLoadError = loadError;
              // reset load counter to avoid frag loop loading error
              data.frag.loadCounter = 0;
              // exponential backoff capped to 64s
              var delay = Math.min(Math.pow(2, loadError - 1) * this.config.fragLoadingRetryDelay, 64000);
              _utilsLogger.logger.warn('mediaController: frag loading failed, retry in ' + delay + ' ms');
              this.retryDate = performance.now() + delay;
              // retry loading state
              this.state = State.FRAG_LOADING_WAITING_RETRY;
            } else {
              _utilsLogger.logger.error('mediaController: ' + data.details + ' reaches max retry, redispatch as fatal ...');
              // redispatch same error but with fatal set to true
              data.fatal = true;
              this.hls.trigger(_events2['default'].ERROR, data);
              this.state = State.ERROR;
            }
          }
          break;
        case _errors.ErrorDetails.FRAG_LOOP_LOADING_ERROR:
        case _errors.ErrorDetails.LEVEL_LOAD_ERROR:
        case _errors.ErrorDetails.LEVEL_LOAD_TIMEOUT:
        case _errors.ErrorDetails.KEY_LOAD_ERROR:
        case _errors.ErrorDetails.KEY_LOAD_TIMEOUT:
          // if fatal error, stop processing, otherwise move to IDLE to retry loading
          _utilsLogger.logger.warn('mediaController: ' + data.details + ' while loading frag,switch to ' + (data.fatal ? 'ERROR' : 'IDLE') + ' state ...');
          this.state = data.fatal ? State.ERROR : State.IDLE;
          break;
        default:
          break;
      }
    }
  }, {
    key: 'onSBUpdateEnd',
    value: function onSBUpdateEnd() {
      //trigger handler right now
      if (this.state === State.APPENDING && this.mp4segments.length === 0) {
        var frag = this.fragCurrent,
            stats = this.stats;
        if (frag) {
          this.fragPrevious = frag;
          stats.tbuffered = performance.now();
          this.fragLastKbps = Math.round(8 * stats.length / (stats.tbuffered - stats.tfirst));
          this.hls.trigger(_events2['default'].FRAG_BUFFERED, { stats: stats, frag: frag });
          _utilsLogger.logger.log('media buffered : ' + this.timeRangesToString(this.media.buffered));
          this.state = State.IDLE;
        }
      }
      this.tick();
    }
  }, {
    key: '_checkBuffer',
    value: function _checkBuffer() {
      var media = this.media;
      if (media) {
        // compare readyState
        var readyState = media.readyState;
        // if ready state different from HAVE_NOTHING (numeric value 0), we are allowed to seek
        if (readyState) {
          // if seek after buffered defined, let's seek if within acceptable range
          var seekAfterBuffered = this.seekAfterBuffered;
          if (seekAfterBuffered) {
            if (media.duration >= seekAfterBuffered) {
              media.currentTime = seekAfterBuffered;
              this.seekAfterBuffered = undefined;
            }
          } else {
            var currentTime = media.currentTime,
                bufferInfo = this.bufferInfo(currentTime, 0),
                isPlaying = !(media.paused || media.ended || media.seeking || readyState < 3),
                jumpThreshold = 0.2,
                playheadMoving = currentTime > media.playbackRate * this.lastCurrentTime;

            if (this.stalled && playheadMoving) {
              this.stalled = false;
            }

            // check buffer upfront
            // if less than 200ms is buffered, and media is playing but playhead is not moving,
            // and we have a new buffer range available upfront, let's seek to that one
            if (bufferInfo.len <= jumpThreshold) {
              if (playheadMoving || !isPlaying) {
                // playhead moving or media not playing
                jumpThreshold = 0;
              } else {
                // playhead not moving AND media playing
                _utilsLogger.logger.log('playback seems stuck');
                if (!this.stalled) {
                  this.hls.trigger(_events2['default'].ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.BUFFER_STALLED_ERROR, fatal: false });
                  this.stalled = true;
                }
              }
              // if we are below threshold, try to jump if next buffer range is close
              if (bufferInfo.len <= jumpThreshold) {
                // no buffer available @ currentTime, check if next buffer is close (more than 5ms diff but within a config.maxSeekHole second range)
                var nextBufferStart = bufferInfo.nextStart,
                    delta = nextBufferStart - currentTime;
                if (nextBufferStart && delta < this.config.maxSeekHole && delta > 0.005 && !media.seeking) {
                  // next buffer is close ! adjust currentTime to nextBufferStart
                  // this will ensure effective video decoding
                  _utilsLogger.logger.log('adjust currentTime from ' + currentTime + ' to ' + nextBufferStart);
                  media.currentTime = nextBufferStart;
                }
              }
            }
          }
        }
      }
    }
  }, {
    key: 'swapAudioCodec',
    value: function swapAudioCodec() {
      this.audioCodecSwap = !this.audioCodecSwap;
    }
  }, {
    key: 'onSBUpdateError',
    value: function onSBUpdateError(event) {
      _utilsLogger.logger.error('sourceBuffer error:' + event);
      this.state = State.ERROR;
      // according to http://www.w3.org/TR/media-source/#sourcebuffer-append-error
      // this error might not always be fatal (it is fatal if decode error is set, in that case
      // it will be followed by a mediaElement error ...)
      this.hls.trigger(_events2['default'].ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.BUFFER_APPENDING_ERROR, fatal: false, frag: this.fragCurrent });
    }
  }, {
    key: 'timeRangesToString',
    value: function timeRangesToString(r) {
      var log = '',
          len = r.length;
      for (var i = 0; i < len; i++) {
        log += '[' + r.start(i) + ',' + r.end(i) + ']';
      }
      return log;
    }
  }, {
    key: 'onMediaSourceOpen',
    value: function onMediaSourceOpen() {
      _utilsLogger.logger.log('media source opened');
      this.hls.trigger(_events2['default'].MEDIA_ATTACHED);
      this.onvseeking = this.onMediaSeeking.bind(this);
      this.onvseeked = this.onMediaSeeked.bind(this);
      this.onvmetadata = this.onMediaMetadata.bind(this);
      this.onvended = this.onMediaEnded.bind(this);
      var media = this.media;
      media.addEventListener('seeking', this.onvseeking);
      media.addEventListener('seeked', this.onvseeked);
      media.addEventListener('loadedmetadata', this.onvmetadata);
      media.addEventListener('ended', this.onvended);
      if (this.levels && this.config.autoStartLoad) {
        this.startLoad();
      }
      // once received, don't listen anymore to sourceopen event
      this.mediaSource.removeEventListener('sourceopen', this.onmso);
    }
  }, {
    key: 'onMediaSourceClose',
    value: function onMediaSourceClose() {
      _utilsLogger.logger.log('media source closed');
    }
  }, {
    key: 'onMediaSourceEnded',
    value: function onMediaSourceEnded() {
      _utilsLogger.logger.log('media source ended');
    }
  }, {
    key: 'currentLevel',
    get: function get() {
      if (this.media) {
        var range = this.getBufferRange(this.media.currentTime);
        if (range) {
          return range.frag.level;
        }
      }
      return -1;
    }
  }, {
    key: 'nextBufferRange',
    get: function get() {
      if (this.media) {
        // first get end range of current fragment
        return this.followingBufferRange(this.getBufferRange(this.media.currentTime));
      } else {
        return null;
      }
    }
  }, {
    key: 'nextLevel',
    get: function get() {
      var range = this.nextBufferRange;
      if (range) {
        return range.frag.level;
      } else {
        return -1;
      }
    }
  }]);

  return MSEMediaController;
})(_eventHandler2['default']);

exports['default'] = MSEMediaController;
module.exports = exports['default'];

},{"../demux/demuxer":14,"../errors":18,"../event-handler":19,"../events":20,"../helper/level-helper":21,"../utils/binary-search":29,"../utils/logger":31}],6:[function(require,module,exports){
/*
 * Timeline Controller
*/

'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _utilsCea708Interpreter = require('../utils/cea-708-interpreter');

var _utilsCea708Interpreter2 = _interopRequireDefault(_utilsCea708Interpreter);

var TimelineController = (function () {
  function TimelineController(hls) {
    _classCallCheck(this, TimelineController);

    this.hls = hls;
    this.config = hls.config;

    if (this.config.enableCEA708Captions) {
      this.onmediaatt0 = this.onMediaAttaching.bind(this);
      this.onmediadet0 = this.onMediaDetaching.bind(this);
      this.onud = this.onFragParsingUserData.bind(this);
      this.onfl = this.onFragLoaded.bind(this);
      this.onml = this.onManifestLoading.bind(this);
      hls.on(_events2['default'].MEDIA_ATTACHING, this.onmediaatt0);
      hls.on(_events2['default'].MEDIA_DETACHING, this.onmediadet0);
      hls.on(_events2['default'].FRAG_PARSING_USERDATA, this.onud);
      hls.on(_events2['default'].MANIFEST_LOADING, this.onml);
      hls.on(_events2['default'].FRAG_LOADED, this.onfl);

      this.cea708Interpreter = new _utilsCea708Interpreter2['default']();
    }
  }

  _createClass(TimelineController, [{
    key: 'destroy',
    value: function destroy() {}
  }, {
    key: 'onMediaAttaching',
    value: function onMediaAttaching(event, data) {
      var media = this.media = data.media;
      this.cea708Interpreter.attach(media);
    }
  }, {
    key: 'onMediaDetaching',
    value: function onMediaDetaching() {
      this.cea708Interpreter.detatch();
    }
  }, {
    key: 'onManifestLoading',
    value: function onManifestLoading() {
      this.lastPts = Number.POSITIVE_INFINITY;
    }
  }, {
    key: 'onFragLoaded',
    value: function onFragLoaded(event, data) {
      var pts = data.frag.start; //Number.POSITIVE_INFINITY;

      // if this is a frag for a previously loaded timerange, remove all captions
      // TODO: consider just removing captions for the timerange
      if (pts < this.lastPts) {
        this.cea708Interpreter.clear();
      }

      this.lastPts = pts;
    }
  }, {
    key: 'onFragParsingUserData',
    value: function onFragParsingUserData(event, data) {
      // push all of the CEA-708 messages into the interpreter
      // immediately. It will create the proper timestamps based on our PTS value
      for (var i = 0; i < data.samples.length; i++) {
        this.cea708Interpreter.push(data.samples[i].pts, data.samples[i].bytes);
      }
    }
  }]);

  return TimelineController;
})();

exports['default'] = TimelineController;
module.exports = exports['default'];

},{"../events":20,"../utils/cea-708-interpreter":30}],7:[function(require,module,exports){
/*
 *
 * This file contains an adaptation of the AES decryption algorithm
 * from the Standford Javascript Cryptography Library. That work is
 * covered by the following copyright and permissions notice:
 *
 * Copyright 2009-2010 Emily Stark, Mike Hamburg, Dan Boneh.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above
 *    copyright notice, this list of conditions and the following
 *    disclaimer in the documentation and/or other materials provided
 *    with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE AUTHORS ``AS IS'' AND ANY EXPRESS OR
 * IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR
 * BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 * WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE
 * OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN
 * IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * The views and conclusions contained in the software and documentation
 * are those of the authors and should not be interpreted as representing
 * official policies, either expressed or implied, of the authors.
 */
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var AES = (function () {

  /**
   * Schedule out an AES key for both encryption and decryption. This
   * is a low-level class. Use a cipher mode to do bulk encryption.
   *
   * @constructor
   * @param key {Array} The key as an array of 4, 6 or 8 words.
   */

  function AES(key) {
    _classCallCheck(this, AES);

    /**
     * The expanded S-box and inverse S-box tables. These will be computed
     * on the client so that we don't have to send them down the wire.
     *
     * There are two tables, _tables[0] is for encryption and
     * _tables[1] is for decryption.
     *
     * The first 4 sub-tables are the expanded S-box with MixColumns. The
     * last (_tables[01][4]) is the S-box itself.
     *
     * @private
     */
    this._tables = [[[], [], [], [], []], [[], [], [], [], []]];

    this._precompute();

    var i,
        j,
        tmp,
        encKey,
        decKey,
        sbox = this._tables[0][4],
        decTable = this._tables[1],
        keyLen = key.length,
        rcon = 1;

    if (keyLen !== 4 && keyLen !== 6 && keyLen !== 8) {
      throw new Error('Invalid aes key size=' + keyLen);
    }

    encKey = key.slice(0);
    decKey = [];
    this._key = [encKey, decKey];

    // schedule encryption keys
    for (i = keyLen; i < 4 * keyLen + 28; i++) {
      tmp = encKey[i - 1];

      // apply sbox
      if (i % keyLen === 0 || keyLen === 8 && i % keyLen === 4) {
        tmp = sbox[tmp >>> 24] << 24 ^ sbox[tmp >> 16 & 255] << 16 ^ sbox[tmp >> 8 & 255] << 8 ^ sbox[tmp & 255];

        // shift rows and add rcon
        if (i % keyLen === 0) {
          tmp = tmp << 8 ^ tmp >>> 24 ^ rcon << 24;
          rcon = rcon << 1 ^ (rcon >> 7) * 283;
        }
      }

      encKey[i] = encKey[i - keyLen] ^ tmp;
    }

    // schedule decryption keys
    for (j = 0; i; j++, i--) {
      tmp = encKey[j & 3 ? i : i - 4];
      if (i <= 4 || j < 4) {
        decKey[j] = tmp;
      } else {
        decKey[j] = decTable[0][sbox[tmp >>> 24]] ^ decTable[1][sbox[tmp >> 16 & 255]] ^ decTable[2][sbox[tmp >> 8 & 255]] ^ decTable[3][sbox[tmp & 255]];
      }
    }
  }

  /**
   * Expand the S-box tables.
   *
   * @private
   */

  _createClass(AES, [{
    key: '_precompute',
    value: function _precompute() {
      var encTable = this._tables[0],
          decTable = this._tables[1],
          sbox = encTable[4],
          sboxInv = decTable[4],
          i,
          x,
          xInv,
          d = [],
          th = [],
          x2,
          x4,
          x8,
          s,
          tEnc,
          tDec;

      // Compute double and third tables
      for (i = 0; i < 256; i++) {
        th[(d[i] = i << 1 ^ (i >> 7) * 283) ^ i] = i;
      }

      for (x = xInv = 0; !sbox[x]; x ^= x2 || 1, xInv = th[xInv] || 1) {
        // Compute sbox
        s = xInv ^ xInv << 1 ^ xInv << 2 ^ xInv << 3 ^ xInv << 4;
        s = s >> 8 ^ s & 255 ^ 99;
        sbox[x] = s;
        sboxInv[s] = x;

        // Compute MixColumns
        x8 = d[x4 = d[x2 = d[x]]];
        tDec = x8 * 0x1010101 ^ x4 * 0x10001 ^ x2 * 0x101 ^ x * 0x1010100;
        tEnc = d[s] * 0x101 ^ s * 0x1010100;

        for (i = 0; i < 4; i++) {
          encTable[i][x] = tEnc = tEnc << 24 ^ tEnc >>> 8;
          decTable[i][s] = tDec = tDec << 24 ^ tDec >>> 8;
        }
      }

      // Compactify. Considerable speedup on Firefox.
      for (i = 0; i < 5; i++) {
        encTable[i] = encTable[i].slice(0);
        decTable[i] = decTable[i].slice(0);
      }
    }

    /**
     * Decrypt 16 bytes, specified as four 32-bit words.
     * @param encrypted0 {number} the first word to decrypt
     * @param encrypted1 {number} the second word to decrypt
     * @param encrypted2 {number} the third word to decrypt
     * @param encrypted3 {number} the fourth word to decrypt
     * @param out {Int32Array} the array to write the decrypted words
     * into
     * @param offset {number} the offset into the output array to start
     * writing results
     * @return {Array} The plaintext.
     */
  }, {
    key: 'decrypt',
    value: function decrypt(encrypted0, encrypted1, encrypted2, encrypted3, out, offset) {
      var key = this._key[1],

      // state variables a,b,c,d are loaded with pre-whitened data
      a = encrypted0 ^ key[0],
          b = encrypted3 ^ key[1],
          c = encrypted2 ^ key[2],
          d = encrypted1 ^ key[3],
          a2,
          b2,
          c2,
          nInnerRounds = key.length / 4 - 2,
          // key.length === 2 ?
      i,
          kIndex = 4,
          table = this._tables[1],

      // load up the tables
      table0 = table[0],
          table1 = table[1],
          table2 = table[2],
          table3 = table[3],
          sbox = table[4];

      // Inner rounds. Cribbed from OpenSSL.
      for (i = 0; i < nInnerRounds; i++) {
        a2 = table0[a >>> 24] ^ table1[b >> 16 & 255] ^ table2[c >> 8 & 255] ^ table3[d & 255] ^ key[kIndex];
        b2 = table0[b >>> 24] ^ table1[c >> 16 & 255] ^ table2[d >> 8 & 255] ^ table3[a & 255] ^ key[kIndex + 1];
        c2 = table0[c >>> 24] ^ table1[d >> 16 & 255] ^ table2[a >> 8 & 255] ^ table3[b & 255] ^ key[kIndex + 2];
        d = table0[d >>> 24] ^ table1[a >> 16 & 255] ^ table2[b >> 8 & 255] ^ table3[c & 255] ^ key[kIndex + 3];
        kIndex += 4;
        a = a2;b = b2;c = c2;
      }

      // Last round.
      for (i = 0; i < 4; i++) {
        out[(3 & -i) + offset] = sbox[a >>> 24] << 24 ^ sbox[b >> 16 & 255] << 16 ^ sbox[c >> 8 & 255] << 8 ^ sbox[d & 255] ^ key[kIndex++];
        a2 = a;a = b;b = c;c = d;d = a2;
      }
    }
  }]);

  return AES;
})();

exports['default'] = AES;
module.exports = exports['default'];

},{}],8:[function(require,module,exports){
/*
 *
 * This file contains an adaptation of the AES decryption algorithm
 * from the Standford Javascript Cryptography Library. That work is
 * covered by the following copyright and permissions notice:
 *
 * Copyright 2009-2010 Emily Stark, Mike Hamburg, Dan Boneh.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above
 *    copyright notice, this list of conditions and the following
 *    disclaimer in the documentation and/or other materials provided
 *    with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE AUTHORS ``AS IS'' AND ANY EXPRESS OR
 * IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR
 * BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 * WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE
 * OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN
 * IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * The views and conclusions contained in the software and documentation
 * are those of the authors and should not be interpreted as representing
 * official policies, either expressed or implied, of the authors.
 */

'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _aes = require('./aes');

var _aes2 = _interopRequireDefault(_aes);

var AES128Decrypter = (function () {
  function AES128Decrypter(key, initVector) {
    _classCallCheck(this, AES128Decrypter);

    this.key = key;
    this.iv = initVector;
  }

  /**
   * Convert network-order (big-endian) bytes into their little-endian
   * representation.
   */

  _createClass(AES128Decrypter, [{
    key: 'ntoh',
    value: function ntoh(word) {
      return word << 24 | (word & 0xff00) << 8 | (word & 0xff0000) >> 8 | word >>> 24;
    }

    /**
     * Decrypt bytes using AES-128 with CBC and PKCS#7 padding.
     * @param encrypted {Uint8Array} the encrypted bytes
     * @param key {Uint32Array} the bytes of the decryption key
     * @param initVector {Uint32Array} the initialization vector (IV) to
     * use for the first round of CBC.
     * @return {Uint8Array} the decrypted bytes
     *
     * @see http://en.wikipedia.org/wiki/Advanced_Encryption_Standard
     * @see http://en.wikipedia.org/wiki/Block_cipher_mode_of_operation#Cipher_Block_Chaining_.28CBC.29
     * @see https://tools.ietf.org/html/rfc2315
     */
  }, {
    key: 'doDecrypt',
    value: function doDecrypt(encrypted, key, initVector) {
      var
      // word-level access to the encrypted bytes
      encrypted32 = new Int32Array(encrypted.buffer, encrypted.byteOffset, encrypted.byteLength >> 2),
          decipher = new _aes2['default'](Array.prototype.slice.call(key)),

      // byte and word-level access for the decrypted output
      decrypted = new Uint8Array(encrypted.byteLength),
          decrypted32 = new Int32Array(decrypted.buffer),

      // temporary variables for working with the IV, encrypted, and
      // decrypted data
      init0,
          init1,
          init2,
          init3,
          encrypted0,
          encrypted1,
          encrypted2,
          encrypted3,

      // iteration variable
      wordIx;

      // pull out the words of the IV to ensure we don't modify the
      // passed-in reference and easier access
      init0 = ~ ~initVector[0];
      init1 = ~ ~initVector[1];
      init2 = ~ ~initVector[2];
      init3 = ~ ~initVector[3];

      // decrypt four word sequences, applying cipher-block chaining (CBC)
      // to each decrypted block
      for (wordIx = 0; wordIx < encrypted32.length; wordIx += 4) {
        // convert big-endian (network order) words into little-endian
        // (javascript order)
        encrypted0 = ~ ~this.ntoh(encrypted32[wordIx]);
        encrypted1 = ~ ~this.ntoh(encrypted32[wordIx + 1]);
        encrypted2 = ~ ~this.ntoh(encrypted32[wordIx + 2]);
        encrypted3 = ~ ~this.ntoh(encrypted32[wordIx + 3]);

        // decrypt the block
        decipher.decrypt(encrypted0, encrypted1, encrypted2, encrypted3, decrypted32, wordIx);

        // XOR with the IV, and restore network byte-order to obtain the
        // plaintext
        decrypted32[wordIx] = this.ntoh(decrypted32[wordIx] ^ init0);
        decrypted32[wordIx + 1] = this.ntoh(decrypted32[wordIx + 1] ^ init1);
        decrypted32[wordIx + 2] = this.ntoh(decrypted32[wordIx + 2] ^ init2);
        decrypted32[wordIx + 3] = this.ntoh(decrypted32[wordIx + 3] ^ init3);

        // setup the IV for the next round
        init0 = encrypted0;
        init1 = encrypted1;
        init2 = encrypted2;
        init3 = encrypted3;
      }

      return decrypted;
    }
  }, {
    key: 'localDecrypt',
    value: function localDecrypt(encrypted, key, initVector, decrypted) {
      var bytes = this.doDecrypt(encrypted, key, initVector);
      decrypted.set(bytes, encrypted.byteOffset);
    }
  }, {
    key: 'decrypt',
    value: function decrypt(encrypted) {
      var step = 4 * 8000,

      //encrypted32 = new Int32Array(encrypted.buffer),
      encrypted32 = new Int32Array(encrypted),
          decrypted = new Uint8Array(encrypted.byteLength),
          i = 0;

      // split up the encryption job and do the individual chunks asynchronously
      var key = this.key;
      var initVector = this.iv;
      this.localDecrypt(encrypted32.subarray(i, i + step), key, initVector, decrypted);

      for (i = step; i < encrypted32.length; i += step) {
        initVector = new Uint32Array([this.ntoh(encrypted32[i - 4]), this.ntoh(encrypted32[i - 3]), this.ntoh(encrypted32[i - 2]), this.ntoh(encrypted32[i - 1])]);
        this.localDecrypt(encrypted32.subarray(i, i + step), key, initVector, decrypted);
      }

      return decrypted;
    }
  }]);

  return AES128Decrypter;
})();

exports['default'] = AES128Decrypter;
module.exports = exports['default'];

},{"./aes":7}],9:[function(require,module,exports){
/*
 * AES128 decryption.
 */

'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _aes128Decrypter = require('./aes128-decrypter');

var _aes128Decrypter2 = _interopRequireDefault(_aes128Decrypter);

var _errors = require('../errors');

var _utilsLogger = require('../utils/logger');

var Decrypter = (function () {
  function Decrypter(hls) {
    _classCallCheck(this, Decrypter);

    this.hls = hls;
    try {
      var browserCrypto = window ? window.crypto : crypto;
      this.subtle = browserCrypto.subtle || browserCrypto.webkitSubtle;
      this.disableWebCrypto = !this.subtle;
    } catch (e) {
      this.disableWebCrypto = true;
    }
  }

  _createClass(Decrypter, [{
    key: 'destroy',
    value: function destroy() {}
  }, {
    key: 'decrypt',
    value: function decrypt(data, key, iv, callback) {
      if (this.disableWebCrypto && this.hls.config.enableSoftwareAES) {
        this.decryptBySoftware(data, key, iv, callback);
      } else {
        this.decryptByWebCrypto(data, key, iv, callback);
      }
    }
  }, {
    key: 'decryptByWebCrypto',
    value: function decryptByWebCrypto(data, key, iv, callback) {
      var _this = this;

      _utilsLogger.logger.log('decrypting by WebCrypto API');

      this.subtle.importKey('raw', key, { name: 'AES-CBC', length: 128 }, false, ['decrypt']).then(function (importedKey) {
        _this.subtle.decrypt({ name: 'AES-CBC', iv: iv.buffer }, importedKey, data).then(callback)['catch'](function (err) {
          _this.onWebCryptoError(err, data, key, iv, callback);
        });
      })['catch'](function (err) {
        _this.onWebCryptoError(err, data, key, iv, callback);
      });
    }
  }, {
    key: 'decryptBySoftware',
    value: function decryptBySoftware(data, key8, iv8, callback) {
      _utilsLogger.logger.log('decrypting by JavaScript Implementation');

      var view = new DataView(key8.buffer);
      var key = new Uint32Array([view.getUint32(0), view.getUint32(4), view.getUint32(8), view.getUint32(12)]);

      view = new DataView(iv8.buffer);
      var iv = new Uint32Array([view.getUint32(0), view.getUint32(4), view.getUint32(8), view.getUint32(12)]);

      var decrypter = new _aes128Decrypter2['default'](key, iv);
      callback(decrypter.decrypt(data).buffer);
    }
  }, {
    key: 'onWebCryptoError',
    value: function onWebCryptoError(err, data, key, iv, callback) {
      if (this.hls.config.enableSoftwareAES) {
        _utilsLogger.logger.log('disabling to use WebCrypto API');
        this.disableWebCrypto = true;
        this.decryptBySoftware(data, key, iv, callback);
      } else {
        _utilsLogger.logger.error('decrypting error : ' + err.message);
        this.hls.trigger(Event.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.FRAG_DECRYPT_ERROR, fatal: true, reason: err.message });
      }
    }
  }]);

  return Decrypter;
})();

exports['default'] = Decrypter;
module.exports = exports['default'];

},{"../errors":18,"../utils/logger":31,"./aes128-decrypter":8}],10:[function(require,module,exports){
/**
 * AAC demuxer
 */
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _adts = require('./adts');

var _adts2 = _interopRequireDefault(_adts);

var _utilsLogger = require('../utils/logger');

var _demuxId3 = require('../demux/id3');

var _demuxId32 = _interopRequireDefault(_demuxId3);

var AACDemuxer = (function () {
  function AACDemuxer(observer, remuxerClass) {
    _classCallCheck(this, AACDemuxer);

    this.observer = observer;
    this.remuxerClass = remuxerClass;
    this.remuxer = new this.remuxerClass(observer);
    this._aacTrack = { type: 'audio', id: -1, sequenceNumber: 0, samples: [], len: 0 };
  }

  _createClass(AACDemuxer, [{
    key: 'push',

    // feed incoming data to the front of the parsing pipeline
    value: function push(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration) {
      var track = this._aacTrack,
          id3 = new _demuxId32['default'](data),
          pts = 90 * id3.timeStamp,
          config,
          adtsFrameSize,
          adtsStartOffset,
          adtsHeaderLen,
          stamp,
          nbSamples,
          len,
          aacSample;
      // look for ADTS header (0xFFFx)
      for (adtsStartOffset = id3.length, len = data.length; adtsStartOffset < len - 1; adtsStartOffset++) {
        if (data[adtsStartOffset] === 0xff && (data[adtsStartOffset + 1] & 0xf0) === 0xf0) {
          break;
        }
      }

      if (!track.audiosamplerate) {
        config = _adts2['default'].getAudioConfig(this.observer, data, adtsStartOffset, audioCodec);
        track.config = config.config;
        track.audiosamplerate = config.samplerate;
        track.channelCount = config.channelCount;
        track.codec = config.codec;
        track.timescale = this.remuxer.timescale;
        track.duration = this.remuxer.timescale * duration;
        _utilsLogger.logger.log('parsed codec:' + track.codec + ',rate:' + config.samplerate + ',nb channel:' + config.channelCount);
      }
      nbSamples = 0;
      while (adtsStartOffset + 5 < len) {
        // retrieve frame size
        adtsFrameSize = (data[adtsStartOffset + 3] & 0x03) << 11;
        // byte 4
        adtsFrameSize |= data[adtsStartOffset + 4] << 3;
        // byte 5
        adtsFrameSize |= (data[adtsStartOffset + 5] & 0xE0) >>> 5;
        adtsHeaderLen = !!(data[adtsStartOffset + 1] & 0x01) ? 7 : 9;
        adtsFrameSize -= adtsHeaderLen;
        stamp = Math.round(pts + nbSamples * 1024 * 90000 / track.audiosamplerate);
        //stamp = pes.pts;
        //console.log('AAC frame, offset/length/pts:' + (adtsStartOffset+7) + '/' + adtsFrameSize + '/' + stamp.toFixed(0));
        if (adtsFrameSize > 0 && adtsStartOffset + adtsHeaderLen + adtsFrameSize <= len) {
          aacSample = { unit: data.subarray(adtsStartOffset + adtsHeaderLen, adtsStartOffset + adtsHeaderLen + adtsFrameSize), pts: stamp, dts: stamp };
          track.samples.push(aacSample);
          track.len += adtsFrameSize;
          adtsStartOffset += adtsFrameSize + adtsHeaderLen;
          nbSamples++;
          // look for ADTS header (0xFFFx)
          for (; adtsStartOffset < len - 1; adtsStartOffset++) {
            if (data[adtsStartOffset] === 0xff && (data[adtsStartOffset + 1] & 0xf0) === 0xf0) {
              break;
            }
          }
        } else {
          break;
        }
      }
      this.remuxer.remux(this._aacTrack, { samples: [] }, { samples: [{ pts: pts, dts: pts, unit: id3.payload }] }, timeOffset);
    }
  }, {
    key: 'destroy',
    value: function destroy() {}
  }], [{
    key: 'probe',
    value: function probe(data) {
      // check if data contains ID3 timestamp and ADTS sync worc
      var id3 = new _demuxId32['default'](data),
          adtsStartOffset,
          len;
      if (id3.hasTimeStamp) {
        // look for ADTS header (0xFFFx)
        for (adtsStartOffset = id3.length, len = data.length; adtsStartOffset < len - 1; adtsStartOffset++) {
          if (data[adtsStartOffset] === 0xff && (data[adtsStartOffset + 1] & 0xf0) === 0xf0) {
            //logger.log('ADTS sync word found !');
            return true;
          }
        }
      }
      return false;
    }
  }]);

  return AACDemuxer;
})();

exports['default'] = AACDemuxer;
module.exports = exports['default'];

},{"../demux/id3":16,"../utils/logger":31,"./adts":11}],11:[function(require,module,exports){
/**
 *  ADTS parser helper
 */
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _utilsLogger = require('../utils/logger');

var _errors = require('../errors');

var ADTS = (function () {
  function ADTS() {
    _classCallCheck(this, ADTS);
  }

  _createClass(ADTS, null, [{
    key: 'getAudioConfig',
    value: function getAudioConfig(observer, data, offset, audioCodec) {
      var adtsObjectType,
          // :int
      adtsSampleingIndex,
          // :int
      adtsExtensionSampleingIndex,
          // :int
      adtsChanelConfig,
          // :int
      config,
          userAgent = navigator.userAgent.toLowerCase(),
          adtsSampleingRates = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
      // byte 2
      adtsObjectType = ((data[offset + 2] & 0xC0) >>> 6) + 1;
      adtsSampleingIndex = (data[offset + 2] & 0x3C) >>> 2;
      if (adtsSampleingIndex > adtsSampleingRates.length - 1) {
        observer.trigger(Event.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.FRAG_PARSING_ERROR, fatal: true, reason: 'invalid ADTS sampling index:' + adtsSampleingIndex });
        return;
      }
      adtsChanelConfig = (data[offset + 2] & 0x01) << 2;
      // byte 3
      adtsChanelConfig |= (data[offset + 3] & 0xC0) >>> 6;
      _utilsLogger.logger.log('manifest codec:' + audioCodec + ',ADTS data:type:' + adtsObjectType + ',sampleingIndex:' + adtsSampleingIndex + '[' + adtsSampleingRates[adtsSampleingIndex] + 'Hz],channelConfig:' + adtsChanelConfig);
      // firefox: freq less than 24kHz = AAC SBR (HE-AAC)
      if (userAgent.indexOf('firefox') !== -1) {
        if (adtsSampleingIndex >= 6) {
          adtsObjectType = 5;
          config = new Array(4);
          // HE-AAC uses SBR (Spectral Band Replication) , high frequencies are constructed from low frequencies
          // there is a factor 2 between frame sample rate and output sample rate
          // multiply frequency by 2 (see table below, equivalent to substract 3)
          adtsExtensionSampleingIndex = adtsSampleingIndex - 3;
        } else {
          adtsObjectType = 2;
          config = new Array(2);
          adtsExtensionSampleingIndex = adtsSampleingIndex;
        }
        // Android : always use AAC
      } else if (userAgent.indexOf('android') !== -1) {
          adtsObjectType = 2;
          config = new Array(2);
          adtsExtensionSampleingIndex = adtsSampleingIndex;
        } else {
          /*  for other browsers (chrome ...)
              always force audio type to be HE-AAC SBR, as some browsers do not support audio codec switch properly (like Chrome ...)
          */
          adtsObjectType = 5;
          config = new Array(4);
          // if (manifest codec is HE-AAC or HE-AACv2) OR (manifest codec not specified AND frequency less than 24kHz)
          if (audioCodec && (audioCodec.indexOf('mp4a.40.29') !== -1 || audioCodec.indexOf('mp4a.40.5') !== -1) || !audioCodec && adtsSampleingIndex >= 6) {
            // HE-AAC uses SBR (Spectral Band Replication) , high frequencies are constructed from low frequencies
            // there is a factor 2 between frame sample rate and output sample rate
            // multiply frequency by 2 (see table below, equivalent to substract 3)
            adtsExtensionSampleingIndex = adtsSampleingIndex - 3;
          } else {
            // if (manifest codec is AAC) AND (frequency less than 24kHz OR nb channel is 1) OR (manifest codec not specified and mono audio)
            // Chrome fails to play back with AAC LC mono when initialized with HE-AAC.  This is not a problem with stereo.
            if (audioCodec && audioCodec.indexOf('mp4a.40.2') !== -1 && (adtsSampleingIndex >= 6 || adtsChanelConfig === 1) || !audioCodec && adtsChanelConfig === 1) {
              adtsObjectType = 2;
              config = new Array(2);
            }
            adtsExtensionSampleingIndex = adtsSampleingIndex;
          }
        }
      /* refer to http://wiki.multimedia.cx/index.php?title=MPEG-4_Audio#Audio_Specific_Config
          ISO 14496-3 (AAC).pdf - Table 1.13 — Syntax of AudioSpecificConfig()
        Audio Profile / Audio Object Type
        0: Null
        1: AAC Main
        2: AAC LC (Low Complexity)
        3: AAC SSR (Scalable Sample Rate)
        4: AAC LTP (Long Term Prediction)
        5: SBR (Spectral Band Replication)
        6: AAC Scalable
       sampling freq
        0: 96000 Hz
        1: 88200 Hz
        2: 64000 Hz
        3: 48000 Hz
        4: 44100 Hz
        5: 32000 Hz
        6: 24000 Hz
        7: 22050 Hz
        8: 16000 Hz
        9: 12000 Hz
        10: 11025 Hz
        11: 8000 Hz
        12: 7350 Hz
        13: Reserved
        14: Reserved
        15: frequency is written explictly
        Channel Configurations
        These are the channel configurations:
        0: Defined in AOT Specifc Config
        1: 1 channel: front-center
        2: 2 channels: front-left, front-right
      */
      // audioObjectType = profile => profile, the MPEG-4 Audio Object Type minus 1
      config[0] = adtsObjectType << 3;
      // samplingFrequencyIndex
      config[0] |= (adtsSampleingIndex & 0x0E) >> 1;
      config[1] |= (adtsSampleingIndex & 0x01) << 7;
      // channelConfiguration
      config[1] |= adtsChanelConfig << 3;
      if (adtsObjectType === 5) {
        // adtsExtensionSampleingIndex
        config[1] |= (adtsExtensionSampleingIndex & 0x0E) >> 1;
        config[2] = (adtsExtensionSampleingIndex & 0x01) << 7;
        // adtsObjectType (force to 2, chrome is checking that object type is less than 5 ???
        //    https://chromium.googlesource.com/chromium/src.git/+/master/media/formats/mp4/aac.cc
        config[2] |= 2 << 2;
        config[3] = 0;
      }
      return { config: config, samplerate: adtsSampleingRates[adtsSampleingIndex], channelCount: adtsChanelConfig, codec: 'mp4a.40.' + adtsObjectType };
    }
  }]);

  return ADTS;
})();

exports['default'] = ADTS;
module.exports = exports['default'];

},{"../errors":18,"../utils/logger":31}],12:[function(require,module,exports){
/*  inline demuxer.
 *   probe fragments and instantiate appropriate demuxer depending on content type (TSDemuxer, AACDemuxer, ...)
 */

'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _errors = require('../errors');

var _demuxAacdemuxer = require('../demux/aacdemuxer');

var _demuxAacdemuxer2 = _interopRequireDefault(_demuxAacdemuxer);

var _demuxTsdemuxer = require('../demux/tsdemuxer');

var _demuxTsdemuxer2 = _interopRequireDefault(_demuxTsdemuxer);

var DemuxerInline = (function () {
  function DemuxerInline(hls, remuxer) {
    _classCallCheck(this, DemuxerInline);

    this.hls = hls;
    this.remuxer = remuxer;
  }

  _createClass(DemuxerInline, [{
    key: 'destroy',
    value: function destroy() {
      var demuxer = this.demuxer;
      if (demuxer) {
        demuxer.destroy();
      }
    }
  }, {
    key: 'push',
    value: function push(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration) {
      var demuxer = this.demuxer;
      if (!demuxer) {
        // probe for content type
        if (_demuxTsdemuxer2['default'].probe(data)) {
          demuxer = this.demuxer = new _demuxTsdemuxer2['default'](this.hls, this.remuxer);
        } else if (_demuxAacdemuxer2['default'].probe(data)) {
          demuxer = this.demuxer = new _demuxAacdemuxer2['default'](this.hls, this.remuxer);
        } else {
          this.hls.trigger(_events2['default'].ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.FRAG_PARSING_ERROR, fatal: true, reason: 'no demux matching with content found' });
          return;
        }
      }
      demuxer.push(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration);
    }
  }]);

  return DemuxerInline;
})();

exports['default'] = DemuxerInline;
module.exports = exports['default'];

},{"../demux/aacdemuxer":10,"../demux/tsdemuxer":17,"../errors":18,"../events":20}],13:[function(require,module,exports){
/* demuxer web worker.
 *  - listen to worker message, and trigger DemuxerInline upon reception of Fragments.
 *  - provides MP4 Boxes back to main thread using [transferable objects](https://developers.google.com/web/updates/2011/12/Transferable-Objects-Lightning-Fast) in order to minimize message passing overhead.
 */

'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _demuxDemuxerInline = require('../demux/demuxer-inline');

var _demuxDemuxerInline2 = _interopRequireDefault(_demuxDemuxerInline);

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _events3 = require('events');

var _events4 = _interopRequireDefault(_events3);

var _remuxMp4Remuxer = require('../remux/mp4-remuxer');

var _remuxMp4Remuxer2 = _interopRequireDefault(_remuxMp4Remuxer);

var DemuxerWorker = function DemuxerWorker(self) {
  // observer setup
  var observer = new _events4['default']();
  observer.trigger = function trigger(event) {
    for (var _len = arguments.length, data = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      data[_key - 1] = arguments[_key];
    }

    observer.emit.apply(observer, [event, event].concat(data));
  };

  observer.off = function off(event) {
    for (var _len2 = arguments.length, data = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
      data[_key2 - 1] = arguments[_key2];
    }

    observer.removeListener.apply(observer, [event].concat(data));
  };
  self.addEventListener('message', function (ev) {
    //console.log('demuxer cmd:' + ev.data.cmd);
    switch (ev.data.cmd) {
      case 'init':
        self.demuxer = new _demuxDemuxerInline2['default'](observer, _remuxMp4Remuxer2['default']);
        break;
      case 'demux':
        var data = ev.data;
        self.demuxer.push(new Uint8Array(data.data), data.audioCodec, data.videoCodec, data.timeOffset, data.cc, data.level, data.sn, data.duration);
        break;
      default:
        break;
    }
  });

  // listen to events triggered by TS Demuxer
  observer.on(_events2['default'].FRAG_PARSING_INIT_SEGMENT, function (ev, data) {
    var objData = { event: ev };
    var objTransferable = [];
    if (data.audioCodec) {
      objData.audioCodec = data.audioCodec;
      objData.audioMoov = data.audioMoov.buffer;
      objData.audioChannelCount = data.audioChannelCount;
      objTransferable.push(objData.audioMoov);
    }
    if (data.videoCodec) {
      objData.videoCodec = data.videoCodec;
      objData.videoMoov = data.videoMoov.buffer;
      objData.videoWidth = data.videoWidth;
      objData.videoHeight = data.videoHeight;
      objTransferable.push(objData.videoMoov);
    }
    // pass moov as transferable object (no copy)
    self.postMessage(objData, objTransferable);
  });

  observer.on(_events2['default'].FRAG_PARSING_DATA, function (ev, data) {
    var objData = { event: ev, type: data.type, startPTS: data.startPTS, endPTS: data.endPTS, startDTS: data.startDTS, endDTS: data.endDTS, moof: data.moof.buffer, mdat: data.mdat.buffer, nb: data.nb };
    // pass moof/mdat data as transferable object (no copy)
    self.postMessage(objData, [objData.moof, objData.mdat]);
  });

  observer.on(_events2['default'].FRAG_PARSED, function (event) {
    self.postMessage({ event: event });
  });

  observer.on(_events2['default'].ERROR, function (event, data) {
    self.postMessage({ event: event, data: data });
  });

  observer.on(_events2['default'].FRAG_PARSING_METADATA, function (event, data) {
    var objData = { event: event, samples: data.samples };
    self.postMessage(objData);
  });

  observer.on(_events2['default'].FRAG_PARSING_USERDATA, function (event, data) {
    var objData = { event: event, samples: data.samples };
    self.postMessage(objData);
  });
};

exports['default'] = DemuxerWorker;
module.exports = exports['default'];

},{"../demux/demuxer-inline":12,"../events":20,"../remux/mp4-remuxer":27,"events":1}],14:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _demuxDemuxerInline = require('../demux/demuxer-inline');

var _demuxDemuxerInline2 = _interopRequireDefault(_demuxDemuxerInline);

var _demuxDemuxerWorker = require('../demux/demuxer-worker');

var _demuxDemuxerWorker2 = _interopRequireDefault(_demuxDemuxerWorker);

var _utilsLogger = require('../utils/logger');

var _remuxMp4Remuxer = require('../remux/mp4-remuxer');

var _remuxMp4Remuxer2 = _interopRequireDefault(_remuxMp4Remuxer);

var _cryptDecrypter = require('../crypt/decrypter');

var _cryptDecrypter2 = _interopRequireDefault(_cryptDecrypter);

var Demuxer = (function () {
  function Demuxer(hls) {
    _classCallCheck(this, Demuxer);

    this.hls = hls;
    if (hls.config.enableWorker && typeof Worker !== 'undefined') {
      _utilsLogger.logger.log('demuxing in webworker');
      try {
        var work = require('webworkify');
        this.w = work(_demuxDemuxerWorker2['default']);
        this.onwmsg = this.onWorkerMessage.bind(this);
        this.w.addEventListener('message', this.onwmsg);
        this.w.postMessage({ cmd: 'init' });
      } catch (err) {
        _utilsLogger.logger.error('error while initializing DemuxerWorker, fallback on DemuxerInline');
        this.demuxer = new _demuxDemuxerInline2['default'](hls, _remuxMp4Remuxer2['default']);
      }
    } else {
      this.demuxer = new _demuxDemuxerInline2['default'](hls, _remuxMp4Remuxer2['default']);
    }
    this.demuxInitialized = true;
  }

  _createClass(Demuxer, [{
    key: 'destroy',
    value: function destroy() {
      if (this.w) {
        this.w.removeEventListener('message', this.onwmsg);
        this.w.terminate();
        this.w = null;
      } else {
        this.demuxer.destroy();
        this.demuxer = null;
      }
      if (this.decrypter) {
        this.decrypter.destroy();
        this.decrypter = null;
      }
    }
  }, {
    key: 'pushDecrypted',
    value: function pushDecrypted(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration) {
      if (this.w) {
        // post fragment payload as transferable objects (no copy)
        this.w.postMessage({ cmd: 'demux', data: data, audioCodec: audioCodec, videoCodec: videoCodec, timeOffset: timeOffset, cc: cc, level: level, sn: sn, duration: duration }, [data]);
      } else {
        this.demuxer.push(new Uint8Array(data), audioCodec, videoCodec, timeOffset, cc, level, sn, duration);
      }
    }
  }, {
    key: 'push',
    value: function push(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration, decryptdata) {
      if (data.byteLength > 0 && decryptdata != null && decryptdata.key != null && decryptdata.method === 'AES-128') {
        if (this.decrypter == null) {
          this.decrypter = new _cryptDecrypter2['default'](this.hls);
        }

        var localthis = this;
        this.decrypter.decrypt(data, decryptdata.key, decryptdata.iv, function (decryptedData) {
          localthis.pushDecrypted(decryptedData, audioCodec, videoCodec, timeOffset, cc, level, sn, duration);
        });
      } else {
        this.pushDecrypted(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration);
      }
    }
  }, {
    key: 'onWorkerMessage',
    value: function onWorkerMessage(ev) {
      //console.log('onWorkerMessage:' + ev.data.event);
      switch (ev.data.event) {
        case _events2['default'].FRAG_PARSING_INIT_SEGMENT:
          var obj = {};
          if (ev.data.audioMoov) {
            obj.audioMoov = new Uint8Array(ev.data.audioMoov);
            obj.audioCodec = ev.data.audioCodec;
            obj.audioChannelCount = ev.data.audioChannelCount;
          }
          if (ev.data.videoMoov) {
            obj.videoMoov = new Uint8Array(ev.data.videoMoov);
            obj.videoCodec = ev.data.videoCodec;
            obj.videoWidth = ev.data.videoWidth;
            obj.videoHeight = ev.data.videoHeight;
          }
          this.hls.trigger(_events2['default'].FRAG_PARSING_INIT_SEGMENT, obj);
          break;
        case _events2['default'].FRAG_PARSING_DATA:
          this.hls.trigger(_events2['default'].FRAG_PARSING_DATA, {
            moof: new Uint8Array(ev.data.moof),
            mdat: new Uint8Array(ev.data.mdat),
            startPTS: ev.data.startPTS,
            endPTS: ev.data.endPTS,
            startDTS: ev.data.startDTS,
            endDTS: ev.data.endDTS,
            type: ev.data.type,
            nb: ev.data.nb
          });
          break;
        case _events2['default'].FRAG_PARSING_METADATA:
          this.hls.trigger(_events2['default'].FRAG_PARSING_METADATA, {
            samples: ev.data.samples
          });
          break;
        case _events2['default'].FRAG_PARSING_USERDATA:
          this.hls.trigger(_events2['default'].FRAG_PARSING_USERDATA, {
            samples: ev.data.samples
          });
          break;
        default:
          this.hls.trigger(ev.data.event, ev.data.data);
          break;
      }
    }
  }]);

  return Demuxer;
})();

exports['default'] = Demuxer;
module.exports = exports['default'];

},{"../crypt/decrypter":9,"../demux/demuxer-inline":12,"../demux/demuxer-worker":13,"../events":20,"../remux/mp4-remuxer":27,"../utils/logger":31,"webworkify":2}],15:[function(require,module,exports){
/**
 * Parser for exponential Golomb codes, a variable-bitwidth number encoding scheme used by h264.
*/

'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _utilsLogger = require('../utils/logger');

var ExpGolomb = (function () {
  function ExpGolomb(data) {
    _classCallCheck(this, ExpGolomb);

    this.data = data;
    // the number of bytes left to examine in this.data
    this.bytesAvailable = this.data.byteLength;
    // the current word being examined
    this.word = 0; // :uint
    // the number of bits left to examine in the current word
    this.bitsAvailable = 0; // :uint
  }

  // ():void

  _createClass(ExpGolomb, [{
    key: 'loadWord',
    value: function loadWord() {
      var position = this.data.byteLength - this.bytesAvailable,
          workingBytes = new Uint8Array(4),
          availableBytes = Math.min(4, this.bytesAvailable);
      if (availableBytes === 0) {
        throw new Error('no bytes available');
      }
      workingBytes.set(this.data.subarray(position, position + availableBytes));
      this.word = new DataView(workingBytes.buffer).getUint32(0);
      // track the amount of this.data that has been processed
      this.bitsAvailable = availableBytes * 8;
      this.bytesAvailable -= availableBytes;
    }

    // (count:int):void
  }, {
    key: 'skipBits',
    value: function skipBits(count) {
      var skipBytes; // :int
      if (this.bitsAvailable > count) {
        this.word <<= count;
        this.bitsAvailable -= count;
      } else {
        count -= this.bitsAvailable;
        skipBytes = count >> 3;
        count -= skipBytes >> 3;
        this.bytesAvailable -= skipBytes;
        this.loadWord();
        this.word <<= count;
        this.bitsAvailable -= count;
      }
    }

    // (size:int):uint
  }, {
    key: 'readBits',
    value: function readBits(size) {
      var bits = Math.min(this.bitsAvailable, size),
          // :uint
      valu = this.word >>> 32 - bits; // :uint
      if (size > 32) {
        _utilsLogger.logger.error('Cannot read more than 32 bits at a time');
      }
      this.bitsAvailable -= bits;
      if (this.bitsAvailable > 0) {
        this.word <<= bits;
      } else if (this.bytesAvailable > 0) {
        this.loadWord();
      }
      bits = size - bits;
      if (bits > 0) {
        return valu << bits | this.readBits(bits);
      } else {
        return valu;
      }
    }

    // ():uint
  }, {
    key: 'skipLZ',
    value: function skipLZ() {
      var leadingZeroCount; // :uint
      for (leadingZeroCount = 0; leadingZeroCount < this.bitsAvailable; ++leadingZeroCount) {
        if (0 !== (this.word & 0x80000000 >>> leadingZeroCount)) {
          // the first bit of working word is 1
          this.word <<= leadingZeroCount;
          this.bitsAvailable -= leadingZeroCount;
          return leadingZeroCount;
        }
      }
      // we exhausted word and still have not found a 1
      this.loadWord();
      return leadingZeroCount + this.skipLZ();
    }

    // ():void
  }, {
    key: 'skipUEG',
    value: function skipUEG() {
      this.skipBits(1 + this.skipLZ());
    }

    // ():void
  }, {
    key: 'skipEG',
    value: function skipEG() {
      this.skipBits(1 + this.skipLZ());
    }

    // ():uint
  }, {
    key: 'readUEG',
    value: function readUEG() {
      var clz = this.skipLZ(); // :uint
      return this.readBits(clz + 1) - 1;
    }

    // ():int
  }, {
    key: 'readEG',
    value: function readEG() {
      var valu = this.readUEG(); // :int
      if (0x01 & valu) {
        // the number is odd if the low order bit is set
        return 1 + valu >>> 1; // add 1 to make it even, and divide by 2
      } else {
          return -1 * (valu >>> 1); // divide by two then make it negative
        }
    }

    // Some convenience functions
    // :Boolean
  }, {
    key: 'readBoolean',
    value: function readBoolean() {
      return 1 === this.readBits(1);
    }

    // ():int
  }, {
    key: 'readUByte',
    value: function readUByte() {
      return this.readBits(8);
    }

    // ():int
  }, {
    key: 'readUShort',
    value: function readUShort() {
      return this.readBits(16);
    }

    // ():int
  }, {
    key: 'readUInt',
    value: function readUInt() {
      return this.readBits(32);
    }

    /**
     * Advance the ExpGolomb decoder past a scaling list. The scaling
     * list is optionally transmitted as part of a sequence parameter
     * set and is not relevant to transmuxing.
     * @param count {number} the number of entries in this scaling list
     * @see Recommendation ITU-T H.264, Section 7.3.2.1.1.1
     */
  }, {
    key: 'skipScalingList',
    value: function skipScalingList(count) {
      var lastScale = 8,
          nextScale = 8,
          j,
          deltaScale;
      for (j = 0; j < count; j++) {
        if (nextScale !== 0) {
          deltaScale = this.readEG();
          nextScale = (lastScale + deltaScale + 256) % 256;
        }
        lastScale = nextScale === 0 ? lastScale : nextScale;
      }
    }

    /**
     * Read a sequence parameter set and return some interesting video
     * properties. A sequence parameter set is the H264 metadata that
     * describes the properties of upcoming video frames.
     * @param data {Uint8Array} the bytes of a sequence parameter set
     * @return {object} an object with configuration parsed from the
     * sequence parameter set, including the dimensions of the
     * associated video frames.
     */
  }, {
    key: 'readSPS',
    value: function readSPS() {
      var frameCropLeftOffset = 0,
          frameCropRightOffset = 0,
          frameCropTopOffset = 0,
          frameCropBottomOffset = 0,
          sarScale = 1,
          profileIdc,
          profileCompat,
          levelIdc,
          numRefFramesInPicOrderCntCycle,
          picWidthInMbsMinus1,
          picHeightInMapUnitsMinus1,
          frameMbsOnlyFlag,
          scalingListCount,
          i;
      this.readUByte();
      profileIdc = this.readUByte(); // profile_idc
      profileCompat = this.readBits(5); // constraint_set[0-4]_flag, u(5)
      this.skipBits(3); // reserved_zero_3bits u(3),
      levelIdc = this.readUByte(); //level_idc u(8)
      this.skipUEG(); // seq_parameter_set_id
      // some profiles have more optional data we don't need
      if (profileIdc === 100 || profileIdc === 110 || profileIdc === 122 || profileIdc === 244 || profileIdc === 44 || profileIdc === 83 || profileIdc === 86 || profileIdc === 118 || profileIdc === 128) {
        var chromaFormatIdc = this.readUEG();
        if (chromaFormatIdc === 3) {
          this.skipBits(1); // separate_colour_plane_flag
        }
        this.skipUEG(); // bit_depth_luma_minus8
        this.skipUEG(); // bit_depth_chroma_minus8
        this.skipBits(1); // qpprime_y_zero_transform_bypass_flag
        if (this.readBoolean()) {
          // seq_scaling_matrix_present_flag
          scalingListCount = chromaFormatIdc !== 3 ? 8 : 12;
          for (i = 0; i < scalingListCount; i++) {
            if (this.readBoolean()) {
              // seq_scaling_list_present_flag[ i ]
              if (i < 6) {
                this.skipScalingList(16);
              } else {
                this.skipScalingList(64);
              }
            }
          }
        }
      }
      this.skipUEG(); // log2_max_frame_num_minus4
      var picOrderCntType = this.readUEG();
      if (picOrderCntType === 0) {
        this.readUEG(); //log2_max_pic_order_cnt_lsb_minus4
      } else if (picOrderCntType === 1) {
          this.skipBits(1); // delta_pic_order_always_zero_flag
          this.skipEG(); // offset_for_non_ref_pic
          this.skipEG(); // offset_for_top_to_bottom_field
          numRefFramesInPicOrderCntCycle = this.readUEG();
          for (i = 0; i < numRefFramesInPicOrderCntCycle; i++) {
            this.skipEG(); // offset_for_ref_frame[ i ]
          }
        }
      this.skipUEG(); // max_num_ref_frames
      this.skipBits(1); // gaps_in_frame_num_value_allowed_flag
      picWidthInMbsMinus1 = this.readUEG();
      picHeightInMapUnitsMinus1 = this.readUEG();
      frameMbsOnlyFlag = this.readBits(1);
      if (frameMbsOnlyFlag === 0) {
        this.skipBits(1); // mb_adaptive_frame_field_flag
      }
      this.skipBits(1); // direct_8x8_inference_flag
      if (this.readBoolean()) {
        // frame_cropping_flag
        frameCropLeftOffset = this.readUEG();
        frameCropRightOffset = this.readUEG();
        frameCropTopOffset = this.readUEG();
        frameCropBottomOffset = this.readUEG();
      }
      if (this.readBoolean()) {
        // vui_parameters_present_flag
        if (this.readBoolean()) {
          // aspect_ratio_info_present_flag
          var sarRatio = undefined;
          var aspectRatioIdc = this.readUByte();
          switch (aspectRatioIdc) {
            //case 1: sarRatio = [1,1]; break;
            case 2:
              sarRatio = [12, 11];break;
            case 3:
              sarRatio = [10, 11];break;
            case 4:
              sarRatio = [16, 11];break;
            case 5:
              sarRatio = [40, 33];break;
            case 6:
              sarRatio = [24, 11];break;
            case 7:
              sarRatio = [20, 11];break;
            case 8:
              sarRatio = [32, 11];break;
            case 9:
              sarRatio = [80, 33];break;
            case 10:
              sarRatio = [18, 11];break;
            case 11:
              sarRatio = [15, 11];break;
            case 12:
              sarRatio = [64, 33];break;
            case 13:
              sarRatio = [160, 99];break;
            case 14:
              sarRatio = [4, 3];break;
            case 15:
              sarRatio = [3, 2];break;
            case 16:
              sarRatio = [2, 1];break;
            case 255:
              {
                sarRatio = [this.readUByte() << 8 | this.readUByte(), this.readUByte() << 8 | this.readUByte()];
                break;
              }
          }
          if (sarRatio) {
            sarScale = sarRatio[0] / sarRatio[1];
          }
        }
      }
      return {
        width: ((picWidthInMbsMinus1 + 1) * 16 - frameCropLeftOffset * 2 - frameCropRightOffset * 2) * sarScale,
        height: (2 - frameMbsOnlyFlag) * (picHeightInMapUnitsMinus1 + 1) * 16 - (frameMbsOnlyFlag ? 2 : 4) * (frameCropTopOffset + frameCropBottomOffset)
      };
    }
  }, {
    key: 'readSliceType',
    value: function readSliceType() {
      // skip NALu type
      this.readUByte();
      // discard first_mb_in_slice
      this.readUEG();
      // return slice_type
      return this.readUEG();
    }
  }]);

  return ExpGolomb;
})();

exports['default'] = ExpGolomb;
module.exports = exports['default'];

},{"../utils/logger":31}],16:[function(require,module,exports){
/**
 * ID3 parser
 */
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _utilsLogger = require('../utils/logger');

//import Hex from '../utils/hex';

var ID3 = (function () {
  function ID3(data) {
    _classCallCheck(this, ID3);

    this._hasTimeStamp = false;
    var offset = 0,
        byte1,
        byte2,
        byte3,
        byte4,
        tagSize,
        endPos,
        header,
        len;
    do {
      header = this.readUTF(data, offset, 3);
      offset += 3;
      // first check for ID3 header
      if (header === 'ID3') {
        // skip 24 bits
        offset += 3;
        // retrieve tag(s) length
        byte1 = data[offset++] & 0x7f;
        byte2 = data[offset++] & 0x7f;
        byte3 = data[offset++] & 0x7f;
        byte4 = data[offset++] & 0x7f;
        tagSize = (byte1 << 21) + (byte2 << 14) + (byte3 << 7) + byte4;
        endPos = offset + tagSize;
        //logger.log(`ID3 tag found, size/end: ${tagSize}/${endPos}`);

        // read ID3 tags
        this._parseID3Frames(data, offset, endPos);
        offset = endPos;
      } else if (header === '3DI') {
        // http://id3.org/id3v2.4.0-structure chapter 3.4.   ID3v2 footer
        offset += 7;
        _utilsLogger.logger.log('3DI footer found, end: ' + offset);
      } else {
        offset -= 3;
        len = offset;
        if (len) {
          //logger.log(`ID3 len: ${len}`);
          if (!this.hasTimeStamp) {
            _utilsLogger.logger.warn('ID3 tag found, but no timestamp');
          }
          this._length = len;
          this._payload = data.subarray(0, len);
        }
        return;
      }
    } while (true);
  }

  _createClass(ID3, [{
    key: 'readUTF',
    value: function readUTF(data, start, len) {

      var result = '',
          offset = start,
          end = start + len;
      do {
        result += String.fromCharCode(data[offset++]);
      } while (offset < end);
      return result;
    }
  }, {
    key: '_parseID3Frames',
    value: function _parseID3Frames(data, offset, endPos) {
      var tagId, tagLen, tagStart, tagFlags, timestamp;
      while (offset + 8 <= endPos) {
        tagId = this.readUTF(data, offset, 4);
        offset += 4;

        tagLen = data[offset++] << 24 + data[offset++] << 16 + data[offset++] << 8 + data[offset++];

        tagFlags = data[offset++] << 8 + data[offset++];

        tagStart = offset;
        //logger.log("ID3 tag id:" + tagId);
        switch (tagId) {
          case 'PRIV':
            //logger.log('parse frame:' + Hex.hexDump(data.subarray(offset,endPos)));
            // owner should be "com.apple.streaming.transportStreamTimestamp"
            if (this.readUTF(data, offset, 44) === 'com.apple.streaming.transportStreamTimestamp') {
              offset += 44;
              // smelling even better ! we found the right descriptor
              // skip null character (string end) + 3 first bytes
              offset += 4;

              // timestamp is 33 bit expressed as a big-endian eight-octet number, with the upper 31 bits set to zero.
              var pts33Bit = data[offset++] & 0x1;
              this._hasTimeStamp = true;

              timestamp = ((data[offset++] << 23) + (data[offset++] << 15) + (data[offset++] << 7) + data[offset++]) / 45;

              if (pts33Bit) {
                timestamp += 47721858.84; // 2^32 / 90
              }
              timestamp = Math.round(timestamp);
              _utilsLogger.logger.trace('ID3 timestamp found: ' + timestamp);
              this._timeStamp = timestamp;
            }
            break;
          default:
            break;
        }
      }
    }
  }, {
    key: 'hasTimeStamp',
    get: function get() {
      return this._hasTimeStamp;
    }
  }, {
    key: 'timeStamp',
    get: function get() {
      return this._timeStamp;
    }
  }, {
    key: 'length',
    get: function get() {
      return this._length;
    }
  }, {
    key: 'payload',
    get: function get() {
      return this._payload;
    }
  }]);

  return ID3;
})();

exports['default'] = ID3;
module.exports = exports['default'];

},{"../utils/logger":31}],17:[function(require,module,exports){
/**
 * highly optimized TS demuxer:
 * parse PAT, PMT
 * extract PES packet from audio and video PIDs
 * extract AVC/H264 NAL units and AAC/ADTS samples from PES packet
 * trigger the remuxer upon parsing completion
 * it also tries to workaround as best as it can audio codec switch (HE-AAC to AAC and vice versa), without having to restart the MediaSource.
 * it also controls the remuxing process :
 * upon discontinuity or level switch detection, it will also notifies the remuxer so that it can reset its state.
*/

'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _adts = require('./adts');

var _adts2 = _interopRequireDefault(_adts);

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _expGolomb = require('./exp-golomb');

var _expGolomb2 = _interopRequireDefault(_expGolomb);

// import Hex from '../utils/hex';

var _utilsLogger = require('../utils/logger');

var _errors = require('../errors');

var TSDemuxer = (function () {
  function TSDemuxer(observer, remuxerClass) {
    _classCallCheck(this, TSDemuxer);

    this.observer = observer;
    this.remuxerClass = remuxerClass;
    this.lastCC = 0;
    this.remuxer = new this.remuxerClass(observer);
    this._userData = [];
  }

  _createClass(TSDemuxer, [{
    key: 'switchLevel',
    value: function switchLevel() {
      this.pmtParsed = false;
      this._pmtId = -1;
      this.lastAacPTS = null;
      this.aacOverFlow = null;
      this._avcTrack = { type: 'video', id: -1, sequenceNumber: 0, samples: [], len: 0, nbNalu: 0 };
      this._aacTrack = { type: 'audio', id: -1, sequenceNumber: 0, samples: [], len: 0 };
      this._id3Track = { type: 'id3', id: -1, sequenceNumber: 0, samples: [], len: 0 };
      this._txtTrack = { type: 'text', id: -1, sequenceNumber: 0, samples: [], len: 0 };
      this.remuxer.switchLevel();
    }
  }, {
    key: 'insertDiscontinuity',
    value: function insertDiscontinuity() {
      this.switchLevel();
      this.remuxer.insertDiscontinuity();
    }

    // feed incoming data to the front of the parsing pipeline
  }, {
    key: 'push',
    value: function push(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration) {
      var avcData,
          aacData,
          id3Data,
          start,
          len = data.length,
          stt,
          pid,
          atf,
          offset;
      this.audioCodec = audioCodec;
      this.videoCodec = videoCodec;
      this.timeOffset = timeOffset;
      this._duration = duration;
      this.contiguous = false;
      if (cc !== this.lastCC) {
        _utilsLogger.logger.log('discontinuity detected');
        this.insertDiscontinuity();
        this.lastCC = cc;
      } else if (level !== this.lastLevel) {
        _utilsLogger.logger.log('level switch detected');
        this.switchLevel();
        this.lastLevel = level;
      } else if (sn === this.lastSN + 1) {
        this.contiguous = true;
      }
      this.lastSN = sn;

      if (!this.contiguous) {
        // flush any partial content
        this.aacOverFlow = null;
      }

      var pmtParsed = this.pmtParsed,
          avcId = this._avcTrack.id,
          aacId = this._aacTrack.id,
          id3Id = this._id3Track.id;
      // loop through TS packets
      for (start = 0; start < len; start += 188) {
        if (data[start] === 0x47) {
          stt = !!(data[start + 1] & 0x40);
          // pid is a 13-bit field starting at the last bit of TS[1]
          pid = ((data[start + 1] & 0x1f) << 8) + data[start + 2];
          atf = (data[start + 3] & 0x30) >> 4;
          // if an adaption field is present, its length is specified by the fifth byte of the TS packet header.
          if (atf > 1) {
            offset = start + 5 + data[start + 4];
            // continue if there is only adaptation field
            if (offset === start + 188) {
              continue;
            }
          } else {
            offset = start + 4;
          }
          if (pmtParsed) {
            if (pid === avcId) {
              if (stt) {
                if (avcData) {
                  this._parseAVCPES(this._parsePES(avcData));
                }
                avcData = { data: [], size: 0 };
              }
              if (avcData) {
                avcData.data.push(data.subarray(offset, start + 188));
                avcData.size += start + 188 - offset;
              }
            } else if (pid === aacId) {
              if (stt) {
                if (aacData) {
                  this._parseAACPES(this._parsePES(aacData));
                }
                aacData = { data: [], size: 0 };
              }
              if (aacData) {
                aacData.data.push(data.subarray(offset, start + 188));
                aacData.size += start + 188 - offset;
              }
            } else if (pid === id3Id) {
              if (stt) {
                if (id3Data) {
                  this._parseID3PES(this._parsePES(id3Data));
                }
                id3Data = { data: [], size: 0 };
              }
              if (id3Data) {
                id3Data.data.push(data.subarray(offset, start + 188));
                id3Data.size += start + 188 - offset;
              }
            }
          } else {
            if (stt) {
              offset += data[offset] + 1;
            }
            if (pid === 0) {
              this._parsePAT(data, offset);
            } else if (pid === this._pmtId) {
              this._parsePMT(data, offset);
              pmtParsed = this.pmtParsed = true;
              avcId = this._avcTrack.id;
              aacId = this._aacTrack.id;
              id3Id = this._id3Track.id;
            }
          }
        } else {
          this.observer.trigger(_events2['default'].ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.FRAG_PARSING_ERROR, fatal: false, reason: 'TS packet did not start with 0x47' });
        }
      }
      // parse last PES packet
      if (avcData) {
        this._parseAVCPES(this._parsePES(avcData));
      }
      if (aacData) {
        this._parseAACPES(this._parsePES(aacData));
      }
      if (id3Data) {
        this._parseID3PES(this._parsePES(id3Data));
      }
      this.remux();
    }
  }, {
    key: 'remux',
    value: function remux() {
      this.remuxer.remux(this._aacTrack, this._avcTrack, this._id3Track, this._txtTrack, this.timeOffset, this.contiguous);
    }
  }, {
    key: 'destroy',
    value: function destroy() {
      this.switchLevel();
      this._initPTS = this._initDTS = undefined;
      this._duration = 0;
    }
  }, {
    key: '_parsePAT',
    value: function _parsePAT(data, offset) {
      // skip the PSI header and parse the first PMT entry
      this._pmtId = (data[offset + 10] & 0x1F) << 8 | data[offset + 11];
      //logger.log('PMT PID:'  + this._pmtId);
    }
  }, {
    key: '_parsePMT',
    value: function _parsePMT(data, offset) {
      var sectionLength, tableEnd, programInfoLength, pid;
      sectionLength = (data[offset + 1] & 0x0f) << 8 | data[offset + 2];
      tableEnd = offset + 3 + sectionLength - 4;
      // to determine where the table is, we have to figure out how
      // long the program info descriptors are
      programInfoLength = (data[offset + 10] & 0x0f) << 8 | data[offset + 11];
      // advance the offset to the first entry in the mapping table
      offset += 12 + programInfoLength;
      while (offset < tableEnd) {
        pid = (data[offset + 1] & 0x1F) << 8 | data[offset + 2];
        switch (data[offset]) {
          // ISO/IEC 13818-7 ADTS AAC (MPEG-2 lower bit-rate audio)
          case 0x0f:
            //logger.log('AAC PID:'  + pid);
            this._aacTrack.id = pid;
            break;
          // Packetized metadata (ID3)
          case 0x15:
            //logger.log('ID3 PID:'  + pid);
            this._id3Track.id = pid;
            break;
          // ITU-T Rec. H.264 and ISO/IEC 14496-10 (lower bit-rate video)
          case 0x1b:
            //logger.log('AVC PID:'  + pid);
            this._avcTrack.id = pid;
            break;
          default:
            _utilsLogger.logger.log('unkown stream type:' + data[offset]);
            break;
        }
        // move to the next table entry
        // skip past the elementary stream descriptors, if present
        offset += ((data[offset + 3] & 0x0F) << 8 | data[offset + 4]) + 5;
      }
    }
  }, {
    key: '_parsePES',
    value: function _parsePES(stream) {
      var i = 0,
          frag,
          pesFlags,
          pesPrefix,
          pesLen,
          pesHdrLen,
          pesData,
          pesPts,
          pesDts,
          payloadStartOffset;
      //retrieve PTS/DTS from first fragment
      frag = stream.data[0];
      pesPrefix = (frag[0] << 16) + (frag[1] << 8) + frag[2];
      if (pesPrefix === 1) {
        pesLen = (frag[4] << 8) + frag[5];
        pesFlags = frag[7];
        if (pesFlags & 0xC0) {
          /* PES header described here : http://dvd.sourceforge.net/dvdinfo/pes-hdr.html
              as PTS / DTS is 33 bit we cannot use bitwise operator in JS,
              as Bitwise operators treat their operands as a sequence of 32 bits */
          pesPts = (frag[9] & 0x0E) * 536870912 + // 1 << 29
          (frag[10] & 0xFF) * 4194304 + // 1 << 22
          (frag[11] & 0xFE) * 16384 + // 1 << 14
          (frag[12] & 0xFF) * 128 + // 1 << 7
          (frag[13] & 0xFE) / 2;
          // check if greater than 2^32 -1
          if (pesPts > 4294967295) {
            // decrement 2^33
            pesPts -= 8589934592;
          }
          if (pesFlags & 0x40) {
            pesDts = (frag[14] & 0x0E) * 536870912 + // 1 << 29
            (frag[15] & 0xFF) * 4194304 + // 1 << 22
            (frag[16] & 0xFE) * 16384 + // 1 << 14
            (frag[17] & 0xFF) * 128 + // 1 << 7
            (frag[18] & 0xFE) / 2;
            // check if greater than 2^32 -1
            if (pesDts > 4294967295) {
              // decrement 2^33
              pesDts -= 8589934592;
            }
          } else {
            pesDts = pesPts;
          }
        }
        pesHdrLen = frag[8];
        payloadStartOffset = pesHdrLen + 9;
        // trim PES header
        stream.data[0] = stream.data[0].subarray(payloadStartOffset);
        stream.size -= payloadStartOffset;
        //reassemble PES packet
        pesData = new Uint8Array(stream.size);
        // reassemble the packet
        while (stream.data.length) {
          frag = stream.data.shift();
          pesData.set(frag, i);
          i += frag.byteLength;
        }
        return { data: pesData, pts: pesPts, dts: pesDts, len: pesLen };
      } else {
        return null;
      }
    }
  }, {
    key: '_parseAVCPES',
    value: function _parseAVCPES(pes) {
      var _this = this;

      var track = this._avcTrack,
          samples = track.samples,
          units = this._parseAVCNALu(pes.data),
          units2 = [],
          debug = false,
          key = false,
          length = 0,
          expGolombDecoder,
          avcSample,
          push,
          i;
      // no NALu found
      if (units.length === 0 && samples.length > 0) {
        // append pes.data to previous NAL unit
        var lastavcSample = samples[samples.length - 1];
        var lastUnit = lastavcSample.units.units[lastavcSample.units.units.length - 1];
        var tmp = new Uint8Array(lastUnit.data.byteLength + pes.data.byteLength);
        tmp.set(lastUnit.data, 0);
        tmp.set(pes.data, lastUnit.data.byteLength);
        lastUnit.data = tmp;
        lastavcSample.units.length += pes.data.byteLength;
        track.len += pes.data.byteLength;
      }
      //free pes.data to save up some memory
      pes.data = null;
      var debugString = '';

      units.forEach(function (unit) {
        switch (unit.type) {
          //NDR
          case 1:
            push = true;
            if (debug) {
              debugString += 'NDR ';
            }
            break;
          //IDR
          case 5:
            push = true;
            if (debug) {
              debugString += 'IDR ';
            }
            key = true;
            break;
          //SEI
          case 6:
            push = true;
            if (debug) {
              debugString += 'SEI ';
            }
            expGolombDecoder = new _expGolomb2['default'](unit.data);

            // skip frameType
            expGolombDecoder.readUByte();

            var payloadType = expGolombDecoder.readUByte();

            // TODO: there can be more than one payload in an SEI packet...
            // TODO: need to read type and size in a while loop to get them all
            if (payloadType === 4) {
              var payloadSize = 0;

              do {
                payloadSize = expGolombDecoder.readUByte();
              } while (payloadSize === 255);

              var countryCode = expGolombDecoder.readUByte();

              if (countryCode === 181) {
                var providerCode = expGolombDecoder.readUShort();

                if (providerCode === 49) {
                  var userStructure = expGolombDecoder.readUInt();

                  if (userStructure === 0x47413934) {
                    var userDataType = expGolombDecoder.readUByte();

                    // Raw CEA-608 bytes wrapped in CEA-708 packet
                    if (userDataType === 3) {
                      var firstByte = expGolombDecoder.readUByte();
                      var secondByte = expGolombDecoder.readUByte();

                      var totalCCs = 31 & firstByte;
                      var byteArray = [firstByte, secondByte];

                      for (i = 0; i < totalCCs; i++) {
                        // 3 bytes per CC
                        byteArray.push(expGolombDecoder.readUByte());
                        byteArray.push(expGolombDecoder.readUByte());
                        byteArray.push(expGolombDecoder.readUByte());
                      }

                      _this._txtTrack.samples.push({ type: 3, pts: pes.pts, bytes: byteArray });
                    }
                  }
                }
              }
            }
            break;
          //SPS
          case 7:
            push = true;
            if (debug) {
              debugString += 'SPS ';
            }
            if (!track.sps) {
              expGolombDecoder = new _expGolomb2['default'](unit.data);
              var config = expGolombDecoder.readSPS();
              track.width = config.width;
              track.height = config.height;
              track.sps = [unit.data];
              track.timescale = _this.remuxer.timescale;
              track.duration = _this.remuxer.timescale * _this._duration;
              var codecarray = unit.data.subarray(1, 4);
              var codecstring = 'avc1.';
              for (i = 0; i < 3; i++) {
                var h = codecarray[i].toString(16);
                if (h.length < 2) {
                  h = '0' + h;
                }
                codecstring += h;
              }
              track.codec = codecstring;
            }
            break;
          //PPS
          case 8:
            push = true;
            if (debug) {
              debugString += 'PPS ';
            }
            if (!track.pps) {
              track.pps = [unit.data];
            }
            break;
          case 9:
            push = true;
            if (debug) {
              debugString += 'AUD ';
            }
            break;
          default:
            push = false;
            debugString += 'unknown NAL ' + unit.type + ' ';
            break;
        }
        if (push) {
          units2.push(unit);
          length += unit.data.byteLength;
        }
      });
      if (debug || debugString.length) {
        _utilsLogger.logger.log(debugString);
      }
      //build sample from PES
      // Annex B to MP4 conversion to be done
      if (units2.length) {
        // only push AVC sample if keyframe already found. browsers expect a keyframe at first to start decoding
        if (key === true || track.sps) {
          avcSample = { units: { units: units2, length: length }, pts: pes.pts, dts: pes.dts, key: key };
          samples.push(avcSample);
          track.len += length;
          track.nbNalu += units2.length;
        }
      }
    }
  }, {
    key: '_parseAVCNALu',
    value: function _parseAVCNALu(array) {
      var i = 0,
          len = array.byteLength,
          value,
          overflow,
          state = 0;
      var units = [],
          unit,
          unitType,
          lastUnitStart,
          lastUnitType;
      //logger.log('PES:' + Hex.hexDump(array));
      while (i < len) {
        value = array[i++];
        // finding 3 or 4-byte start codes (00 00 01 OR 00 00 00 01)
        switch (state) {
          case 0:
            if (value === 0) {
              state = 1;
            }
            break;
          case 1:
            if (value === 0) {
              state = 2;
            } else {
              state = 0;
            }
            break;
          case 2:
          case 3:
            if (value === 0) {
              state = 3;
            } else if (value === 1 && i < len) {
              unitType = array[i] & 0x1f;
              //logger.log('find NALU @ offset:' + i + ',type:' + unitType);
              if (lastUnitStart) {
                unit = { data: array.subarray(lastUnitStart, i - state - 1), type: lastUnitType };
                //logger.log('pushing NALU, type/size:' + unit.type + '/' + unit.data.byteLength);
                units.push(unit);
              } else {
                // If NAL units are not starting right at the beginning of the PES packet, push preceding data into previous NAL unit.
                overflow = i - state - 1;
                if (overflow) {
                  var track = this._avcTrack,
                      samples = track.samples;
                  //logger.log('first NALU found with overflow:' + overflow);
                  if (samples.length) {
                    var lastavcSample = samples[samples.length - 1],
                        lastUnits = lastavcSample.units.units,
                        lastUnit = lastUnits[lastUnits.length - 1],
                        tmp = new Uint8Array(lastUnit.data.byteLength + overflow);
                    tmp.set(lastUnit.data, 0);
                    tmp.set(array.subarray(0, overflow), lastUnit.data.byteLength);
                    lastUnit.data = tmp;
                    lastavcSample.units.length += overflow;
                    track.len += overflow;
                  }
                }
              }
              lastUnitStart = i;
              lastUnitType = unitType;
              if (unitType === 1 || unitType === 5) {
                // OPTI !!! if IDR/NDR unit, consider it is last NALu
                i = len;
              }
              state = 0;
            } else {
              state = 0;
            }
            break;
          default:
            break;
        }
      }
      if (lastUnitStart) {
        unit = { data: array.subarray(lastUnitStart, len), type: lastUnitType };
        units.push(unit);
        //logger.log('pushing NALU, type/size:' + unit.type + '/' + unit.data.byteLength);
      }
      return units;
    }
  }, {
    key: '_parseAACPES',
    value: function _parseAACPES(pes) {
      var track = this._aacTrack,
          data = pes.data,
          pts = pes.pts,
          startOffset = 0,
          duration = this._duration,
          audioCodec = this.audioCodec,
          aacOverFlow = this.aacOverFlow,
          lastAacPTS = this.lastAacPTS,
          config,
          frameLength,
          frameDuration,
          frameIndex,
          offset,
          headerLength,
          stamp,
          len,
          aacSample;
      if (aacOverFlow) {
        var tmp = new Uint8Array(aacOverFlow.byteLength + data.byteLength);
        tmp.set(aacOverFlow, 0);
        tmp.set(data, aacOverFlow.byteLength);
        //logger.log(`AAC: append overflowing ${aacOverFlow.byteLength} bytes to beginning of new PES`);
        data = tmp;
      }
      // look for ADTS header (0xFFFx)
      for (offset = startOffset, len = data.length; offset < len - 1; offset++) {
        if (data[offset] === 0xff && (data[offset + 1] & 0xf0) === 0xf0) {
          break;
        }
      }
      // if ADTS header does not start straight from the beginning of the PES payload, raise an error
      if (offset) {
        var reason, fatal;
        if (offset < len - 1) {
          reason = 'AAC PES did not start with ADTS header,offset:' + offset;
          fatal = false;
        } else {
          reason = 'no ADTS header found in AAC PES';
          fatal = true;
        }
        this.observer.trigger(_events2['default'].ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.FRAG_PARSING_ERROR, fatal: fatal, reason: reason });
        if (fatal) {
          return;
        }
      }
      if (!track.audiosamplerate) {
        config = _adts2['default'].getAudioConfig(this.observer, data, offset, audioCodec);
        track.config = config.config;
        track.audiosamplerate = config.samplerate;
        track.channelCount = config.channelCount;
        track.codec = config.codec;
        track.timescale = this.remuxer.timescale;
        track.duration = track.timescale * duration;
        _utilsLogger.logger.log('parsed codec:' + track.codec + ',rate:' + config.samplerate + ',nb channel:' + config.channelCount);
      }
      frameIndex = 0;
      frameDuration = 1024 * 90000 / track.audiosamplerate;

      // if last AAC frame is overflowing, we should ensure timestamps are contiguous:
      // first sample PTS should be equal to last sample PTS + frameDuration
      if (aacOverFlow && lastAacPTS) {
        var newPTS = lastAacPTS + frameDuration;
        if (Math.abs(newPTS - pts) > 1) {
          _utilsLogger.logger.log('AAC: align PTS for overlapping frames by ' + Math.round((newPTS - pts) / 90));
          pts = newPTS;
        }
      }

      while (offset + 5 < len) {
        // The protection skip bit tells us if we have 2 bytes of CRC data at the end of the ADTS header
        headerLength = !!(data[offset + 1] & 0x01) ? 7 : 9;
        // retrieve frame size
        frameLength = (data[offset + 3] & 0x03) << 11 | data[offset + 4] << 3 | (data[offset + 5] & 0xE0) >>> 5;
        frameLength -= headerLength;
        //stamp = pes.pts;

        if (frameLength > 0 && offset + headerLength + frameLength <= len) {
          stamp = Math.round(pts + frameIndex * frameDuration);
          //logger.log(`AAC frame, offset/length/total/pts:${offset+headerLength}/${frameLength}/${data.byteLength}/${(stamp/90).toFixed(0)}`);
          aacSample = { unit: data.subarray(offset + headerLength, offset + headerLength + frameLength), pts: stamp, dts: stamp };
          track.samples.push(aacSample);
          track.len += frameLength;
          offset += frameLength + headerLength;
          frameIndex++;
          // look for ADTS header (0xFFFx)
          for (; offset < len - 1; offset++) {
            if (data[offset] === 0xff && (data[offset + 1] & 0xf0) === 0xf0) {
              break;
            }
          }
        } else {
          break;
        }
      }
      if (offset < len) {
        aacOverFlow = data.subarray(offset, len);
        //logger.log(`AAC: overflow detected:${len-offset}`);
      } else {
          aacOverFlow = null;
        }
      this.aacOverFlow = aacOverFlow;
      this.lastAacPTS = stamp;
    }
  }, {
    key: '_parseID3PES',
    value: function _parseID3PES(pes) {
      this._id3Track.samples.push(pes);
    }
  }], [{
    key: 'probe',
    value: function probe(data) {
      // a TS fragment should contain at least 3 TS packets, a PAT, a PMT, and one PID, each starting with 0x47
      if (data.length >= 3 * 188 && data[0] === 0x47 && data[188] === 0x47 && data[2 * 188] === 0x47) {
        return true;
      } else {
        return false;
      }
    }
  }]);

  return TSDemuxer;
})();

exports['default'] = TSDemuxer;
module.exports = exports['default'];

},{"../errors":18,"../events":20,"../utils/logger":31,"./adts":11,"./exp-golomb":15}],18:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
var ErrorTypes = {
  // Identifier for a network error (loading error / timeout ...)
  NETWORK_ERROR: 'hlsNetworkError',
  // Identifier for a media Error (video/parsing/mediasource error)
  MEDIA_ERROR: 'hlsMediaError',
  // Identifier for all other errors
  OTHER_ERROR: 'hlsOtherError'
};

exports.ErrorTypes = ErrorTypes;
var ErrorDetails = {
  // Identifier for a manifest load error - data: { url : faulty URL, response : XHR response}
  MANIFEST_LOAD_ERROR: 'manifestLoadError',
  // Identifier for a manifest load timeout - data: { url : faulty URL, response : XHR response}
  MANIFEST_LOAD_TIMEOUT: 'manifestLoadTimeOut',
  // Identifier for a manifest parsing error - data: { url : faulty URL, reason : error reason}
  MANIFEST_PARSING_ERROR: 'manifestParsingError',
  // Identifier for playlist load error - data: { url : faulty URL, response : XHR response}
  LEVEL_LOAD_ERROR: 'levelLoadError',
  // Identifier for playlist load timeout - data: { url : faulty URL, response : XHR response}
  LEVEL_LOAD_TIMEOUT: 'levelLoadTimeOut',
  // Identifier for a level switch error - data: { level : faulty level Id, event : error description}
  LEVEL_SWITCH_ERROR: 'levelSwitchError',
  // Identifier for fragment load error - data: { frag : fragment object, response : XHR response}
  FRAG_LOAD_ERROR: 'fragLoadError',
  // Identifier for fragment loop loading error - data: { frag : fragment object}
  FRAG_LOOP_LOADING_ERROR: 'fragLoopLoadingError',
  // Identifier for fragment load timeout error - data: { frag : fragment object}
  FRAG_LOAD_TIMEOUT: 'fragLoadTimeOut',
  // Identifier for a fragment decryption error event - data: parsing error description
  FRAG_DECRYPT_ERROR: 'fragDecryptError',
  // Identifier for a fragment parsing error event - data: parsing error description
  FRAG_PARSING_ERROR: 'fragParsingError',
  // Identifier for decrypt key load error - data: { frag : fragment object, response : XHR response}
  KEY_LOAD_ERROR: 'keyLoadError',
  // Identifier for decrypt key load timeout error - data: { frag : fragment object}
  KEY_LOAD_TIMEOUT: 'keyLoadTimeOut',
  // Identifier for a buffer append error - data: append error description
  BUFFER_APPEND_ERROR: 'bufferAppendError',
  // Identifier for a buffer appending error event - data: appending error description
  BUFFER_APPENDING_ERROR: 'bufferAppendingError',
  // Identifier for a buffer stalled error event
  BUFFER_STALLED_ERROR: 'bufferStalledError'
};
exports.ErrorDetails = ErrorDetails;

},{}],19:[function(require,module,exports){
/*
*
* All objects in the event handling chain should inherit from this class
*
*/

//import {logger} from './utils/logger';

'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var EventHandler = (function () {
  function EventHandler(hls) {
    _classCallCheck(this, EventHandler);

    this.hls = hls;
    this.onEvent = this.onEvent.bind(this);

    for (var _len = arguments.length, events = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      events[_key - 1] = arguments[_key];
    }

    this.handledEvents = events;
    this.useGenericHandler = true;

    this.registerListeners();
  }

  _createClass(EventHandler, [{
    key: 'destroy',
    value: function destroy() {
      this.unregisterListeners();
    }
  }, {
    key: 'isEventHandler',
    value: function isEventHandler() {
      return typeof this.handledEvents === 'object' && this.handledEvents.length && typeof this.onEvent === 'function';
    }
  }, {
    key: 'registerListeners',
    value: function registerListeners() {
      if (this.isEventHandler()) {
        this.handledEvents.forEach((function (event) {
          if (event === 'hlsEventGeneric') {
            throw new Error('Forbidden event name: ' + event);
          }
          this.hls.on(event, this.onEvent);
        }).bind(this));
      }
    }
  }, {
    key: 'unregisterListeners',
    value: function unregisterListeners() {
      if (this.isEventHandler()) {
        this.handledEvents.forEach((function (event) {
          this.hls.off(event, this.onEvent);
        }).bind(this));
      }
    }

    /*
    * arguments: event (string), data (any)
    */
  }, {
    key: 'onEvent',
    value: function onEvent(event, data) {
      this.onEventGeneric(event, data);
    }
  }, {
    key: 'onEventGeneric',
    value: function onEventGeneric(event, data) {
      var eventToFunction = function eventToFunction(event, data) {
        var funcName = 'on' + event.replace('hls', '');
        if (typeof this[funcName] !== 'function') {
          throw new Error('Event ' + event + ' has no generic handler in this ' + this.constructor.name + ' class (tried ' + funcName + ')');
        }
        return this[funcName].bind(this, data);
      };
      eventToFunction.call(this, event, data).call();
    }
  }]);

  return EventHandler;
})();

exports['default'] = EventHandler;
module.exports = exports['default'];

},{}],20:[function(require,module,exports){
'use strict';

module.exports = {
  // fired before MediaSource is attaching to media element - data: { media }
  MEDIA_ATTACHING: 'hlsMediaAttaching',
  // fired when MediaSource has been succesfully attached to media element - data: { }
  MEDIA_ATTACHED: 'hlsMediaAttached',
  // fired before detaching MediaSource from media element - data: { }
  MEDIA_DETACHING: 'hlsMediaDetaching',
  // fired when MediaSource has been detached from media element - data: { }
  MEDIA_DETACHED: 'hlsMediaDetached',
  // fired to signal that a manifest loading starts - data: { url : manifestURL}
  MANIFEST_LOADING: 'hlsManifestLoading',
  // fired after manifest has been loaded - data: { levels : [available quality levels] , url : manifestURL, stats : { trequest, tfirst, tload, mtime}}
  MANIFEST_LOADED: 'hlsManifestLoaded',
  // fired after manifest has been parsed - data: { levels : [available quality levels] , firstLevel : index of first quality level appearing in Manifest}
  MANIFEST_PARSED: 'hlsManifestParsed',
  // fired when a level playlist loading starts - data: { url : level URL  level : id of level being loaded}
  LEVEL_LOADING: 'hlsLevelLoading',
  // fired when a level playlist loading finishes - data: { details : levelDetails object, level : id of loaded level, stats : { trequest, tfirst, tload, mtime} }
  LEVEL_LOADED: 'hlsLevelLoaded',
  // fired when a level's details have been updated based on previous details, after it has been loaded. - data: { details : levelDetails object, level : id of updated level }
  LEVEL_UPDATED: 'hlsLevelUpdated',
  // fired when a level's PTS information has been updated after parsing a fragment - data: { details : levelDetails object, level : id of updated level, drift: PTS drift observed when parsing last fragment }
  LEVEL_PTS_UPDATED: 'hlsLevelPtsUpdated',
  // fired when a level switch is requested - data: { level : id of new level }
  LEVEL_SWITCH: 'hlsLevelSwitch',
  // fired when a fragment loading starts - data: { frag : fragment object}
  FRAG_LOADING: 'hlsFragLoading',
  // fired when a fragment loading is progressing - data: { frag : fragment object, { trequest, tfirst, loaded}}
  FRAG_LOAD_PROGRESS: 'hlsFragLoadProgress',
  // Identifier for fragment load aborting for emergency switch down - data: {frag : fragment object}
  FRAG_LOAD_EMERGENCY_ABORTED: 'hlsFragLoadEmergencyAborted',
  // fired when a fragment loading is completed - data: { frag : fragment object, payload : fragment payload, stats : { trequest, tfirst, tload, length}}
  FRAG_LOADED: 'hlsFragLoaded',
  // fired when Init Segment has been extracted from fragment - data: { moov : moov MP4 box, codecs : codecs found while parsing fragment}
  FRAG_PARSING_INIT_SEGMENT: 'hlsFragParsingInitSegment',
  // fired when parsing sei text is completed - data: { samples : [ sei samples pes ] }
  FRAG_PARSING_USERDATA: 'hlsFraParsingUserdata',
  // fired when parsing id3 is completed - data: { samples : [ id3 samples pes ] }
  FRAG_PARSING_METADATA: 'hlsFragParsingMetadata',
  // fired when moof/mdat have been extracted from fragment - data: { moof : moof MP4 box, mdat : mdat MP4 box}
  FRAG_PARSING_DATA: 'hlsFragParsingData',
  // fired when fragment parsing is completed - data: undefined
  FRAG_PARSED: 'hlsFragParsed',
  // fired when fragment remuxed MP4 boxes have all been appended into SourceBuffer - data: { frag : fragment object, stats : { trequest, tfirst, tload, tparsed, tbuffered, length} }
  FRAG_BUFFERED: 'hlsFragBuffered',
  // fired when fragment matching with current media position is changing - data : { frag : fragment object }
  FRAG_CHANGED: 'hlsFragChanged',
  // Identifier for a FPS drop event - data: {curentDropped, currentDecoded, totalDroppedFrames}
  FPS_DROP: 'hlsFpsDrop',
  // Identifier for an error event - data: { type : error type, details : error details, fatal : if true, hls.js cannot/will not try to recover, if false, hls.js will try to recover,other error specific data}
  ERROR: 'hlsError',
  // fired when hls.js instance starts destroying. Different from MEDIA_DETACHED as one could want to detach and reattach a media to the instance of hls.js to handle mid-rolls for example
  DESTROYING: 'hlsDestroying',
  // fired when a decrypt key loading starts - data: { frag : fragment object}
  KEY_LOADING: 'hlsKeyLoading',
  // fired when a decrypt key loading is completed - data: { frag : fragment object, payload : key payload, stats : { trequest, tfirst, tload, length}}
  KEY_LOADED: 'hlsKeyLoaded'
};

},{}],21:[function(require,module,exports){
/**
 * Level Helper class, providing methods dealing with playlist sliding and drift
*/

'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _utilsLogger = require('../utils/logger');

var LevelHelper = (function () {
  function LevelHelper() {
    _classCallCheck(this, LevelHelper);
  }

  _createClass(LevelHelper, null, [{
    key: 'mergeDetails',
    value: function mergeDetails(oldDetails, newDetails) {
      var start = Math.max(oldDetails.startSN, newDetails.startSN) - newDetails.startSN,
          end = Math.min(oldDetails.endSN, newDetails.endSN) - newDetails.startSN,
          delta = newDetails.startSN - oldDetails.startSN,
          oldfragments = oldDetails.fragments,
          newfragments = newDetails.fragments,
          ccOffset = 0,
          PTSFrag;

      // check if old/new playlists have fragments in common
      if (end < start) {
        newDetails.PTSKnown = false;
        return;
      }
      // loop through overlapping SN and update startPTS , cc, and duration if any found
      for (var i = start; i <= end; i++) {
        var oldFrag = oldfragments[delta + i],
            newFrag = newfragments[i];
        ccOffset = oldFrag.cc - newFrag.cc;
        if (!isNaN(oldFrag.startPTS)) {
          newFrag.start = newFrag.startPTS = oldFrag.startPTS;
          newFrag.endPTS = oldFrag.endPTS;
          newFrag.duration = oldFrag.duration;
          PTSFrag = newFrag;
        }
      }

      if (ccOffset) {
        _utilsLogger.logger.log('discontinuity sliding from playlist, take drift into account');
        for (i = 0; i < newfragments.length; i++) {
          newfragments[i].cc += ccOffset;
        }
      }

      // if at least one fragment contains PTS info, recompute PTS information for all fragments
      if (PTSFrag) {
        LevelHelper.updateFragPTS(newDetails, PTSFrag.sn, PTSFrag.startPTS, PTSFrag.endPTS);
      } else {
        // adjust start by sliding offset
        var sliding = oldfragments[delta].start;
        for (i = 0; i < newfragments.length; i++) {
          newfragments[i].start += sliding;
        }
      }
      // if we are here, it means we have fragments overlapping between
      // old and new level. reliable PTS info is thus relying on old level
      newDetails.PTSKnown = oldDetails.PTSKnown;
      return;
    }
  }, {
    key: 'updateFragPTS',
    value: function updateFragPTS(details, sn, startPTS, endPTS) {
      var fragIdx, fragments, frag, i;
      // exit if sn out of range
      if (sn < details.startSN || sn > details.endSN) {
        return 0;
      }
      fragIdx = sn - details.startSN;
      fragments = details.fragments;
      frag = fragments[fragIdx];
      if (!isNaN(frag.startPTS)) {
        startPTS = Math.min(startPTS, frag.startPTS);
        endPTS = Math.max(endPTS, frag.endPTS);
      }

      var drift = startPTS - frag.start;

      frag.start = frag.startPTS = startPTS;
      frag.endPTS = endPTS;
      frag.duration = endPTS - startPTS;
      // adjust fragment PTS/duration from seqnum-1 to frag 0
      for (i = fragIdx; i > 0; i--) {
        LevelHelper.updatePTS(fragments, i, i - 1);
      }

      // adjust fragment PTS/duration from seqnum to last frag
      for (i = fragIdx; i < fragments.length - 1; i++) {
        LevelHelper.updatePTS(fragments, i, i + 1);
      }
      details.PTSKnown = true;
      //logger.log(`                                            frag start/end:${startPTS.toFixed(3)}/${endPTS.toFixed(3)}`);

      return drift;
    }
  }, {
    key: 'updatePTS',
    value: function updatePTS(fragments, fromIdx, toIdx) {
      var fragFrom = fragments[fromIdx],
          fragTo = fragments[toIdx],
          fragToPTS = fragTo.startPTS;
      // if we know startPTS[toIdx]
      if (!isNaN(fragToPTS)) {
        // update fragment duration.
        // it helps to fix drifts between playlist reported duration and fragment real duration
        if (toIdx > fromIdx) {
          fragFrom.duration = fragToPTS - fragFrom.start;
          if (fragFrom.duration < 0) {
            _utilsLogger.logger.error('negative duration computed for frag ' + fragFrom.sn + ',level ' + fragFrom.level + ', there should be some duration drift between playlist and fragment!');
          }
        } else {
          fragTo.duration = fragFrom.start - fragToPTS;
          if (fragTo.duration < 0) {
            _utilsLogger.logger.error('negative duration computed for frag ' + fragTo.sn + ',level ' + fragTo.level + ', there should be some duration drift between playlist and fragment!');
          }
        }
      } else {
        // we dont know startPTS[toIdx]
        if (toIdx > fromIdx) {
          fragTo.start = fragFrom.start + fragFrom.duration;
        } else {
          fragTo.start = fragFrom.start - fragTo.duration;
        }
      }
    }
  }]);

  return LevelHelper;
})();

exports['default'] = LevelHelper;
module.exports = exports['default'];

},{"../utils/logger":31}],22:[function(require,module,exports){
/**
 * HLS interface
 */
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _events = require('./events');

var _events2 = _interopRequireDefault(_events);

var _errors = require('./errors');

var _loaderPlaylistLoader = require('./loader/playlist-loader');

var _loaderPlaylistLoader2 = _interopRequireDefault(_loaderPlaylistLoader);

var _loaderFragmentLoader = require('./loader/fragment-loader');

var _loaderFragmentLoader2 = _interopRequireDefault(_loaderFragmentLoader);

var _controllerAbrController = require('./controller/abr-controller');

var _controllerAbrController2 = _interopRequireDefault(_controllerAbrController);

var _controllerMseMediaController = require('./controller/mse-media-controller');

var _controllerMseMediaController2 = _interopRequireDefault(_controllerMseMediaController);

var _controllerLevelController = require('./controller/level-controller');

var _controllerLevelController2 = _interopRequireDefault(_controllerLevelController);

var _controllerTimelineController = require('./controller/timeline-controller');

var _controllerTimelineController2 = _interopRequireDefault(_controllerTimelineController);

//import FPSController from './controller/fps-controller';

var _utilsLogger = require('./utils/logger');

var _utilsXhrLoader = require('./utils/xhr-loader');

var _utilsXhrLoader2 = _interopRequireDefault(_utilsXhrLoader);

var _events3 = require('events');

var _events4 = _interopRequireDefault(_events3);

var _loaderKeyLoader = require('./loader/key-loader');

var _loaderKeyLoader2 = _interopRequireDefault(_loaderKeyLoader);

var Hls = (function () {
  _createClass(Hls, null, [{
    key: 'isSupported',
    value: function isSupported() {
      return window.MediaSource && window.MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E,mp4a.40.2"');
    }
  }, {
    key: 'Events',
    get: function get() {
      return _events2['default'];
    }
  }, {
    key: 'ErrorTypes',
    get: function get() {
      return _errors.ErrorTypes;
    }
  }, {
    key: 'ErrorDetails',
    get: function get() {
      return _errors.ErrorDetails;
    }
  }, {
    key: 'DefaultConfig',
    get: function get() {
      if (!Hls.defaultConfig) {
        Hls.defaultConfig = {
          autoStartLoad: true,
          debug: false,
          maxBufferLength: 30,
          maxBufferSize: 60 * 1000 * 1000,
          maxBufferHole: 0.3,
          maxSeekHole: 2,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: Infinity,
          maxMaxBufferLength: 600,
          enableWorker: true,
          enableSoftwareAES: true,
          manifestLoadingTimeOut: 10000,
          manifestLoadingMaxRetry: 1,
          manifestLoadingRetryDelay: 1000,
          levelLoadingTimeOut: 10000,
          levelLoadingMaxRetry: 4,
          levelLoadingRetryDelay: 1000,
          fragLoadingTimeOut: 20000,
          fragLoadingMaxRetry: 6,
          fragLoadingRetryDelay: 1000,
          fragLoadingLoopThreshold: 3,
          // fpsDroppedMonitoringPeriod: 5000,
          // fpsDroppedMonitoringThreshold: 0.2,
          appendErrorMaxRetry: 3,
          loader: _utilsXhrLoader2['default'],
          fLoader: undefined,
          pLoader: undefined,
          abrController: _controllerAbrController2['default'],
          mediaController: _controllerMseMediaController2['default'],
          timelineController: _controllerTimelineController2['default'],
          enableCEA708Captions: true
        };
      }
      return Hls.defaultConfig;
    },
    set: function set(defaultConfig) {
      Hls.defaultConfig = defaultConfig;
    }
  }]);

  function Hls() {
    var config = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, Hls);

    var defaultConfig = Hls.DefaultConfig;
    for (var prop in defaultConfig) {
      if (prop in config) {
        continue;
      }
      config[prop] = defaultConfig[prop];
    }

    if (config.liveMaxLatencyDurationCount !== undefined && config.liveMaxLatencyDurationCount <= config.liveSyncDurationCount) {
      throw new Error('Illegal hls.js config: "liveMaxLatencyDurationCount" must be gt "liveSyncDurationCount"');
    }

    (0, _utilsLogger.enableLogs)(config.debug);
    this.config = config;
    // observer setup
    var observer = this.observer = new _events4['default']();
    observer.trigger = function trigger(event) {
      for (var _len = arguments.length, data = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        data[_key - 1] = arguments[_key];
      }

      observer.emit.apply(observer, [event, event].concat(data));
    };

    observer.off = function off(event) {
      for (var _len2 = arguments.length, data = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
        data[_key2 - 1] = arguments[_key2];
      }

      observer.removeListener.apply(observer, [event].concat(data));
    };
    this.on = observer.on.bind(observer);
    this.off = observer.off.bind(observer);
    this.trigger = observer.trigger.bind(observer);
    this.playlistLoader = new _loaderPlaylistLoader2['default'](this);
    this.fragmentLoader = new _loaderFragmentLoader2['default'](this);
    this.levelController = new _controllerLevelController2['default'](this);
    this.abrController = new config.abrController(this);
    this.mediaController = new config.mediaController(this);
    this.timelineController = new config.timelineController(this);
    this.keyLoader = new _loaderKeyLoader2['default'](this);
    //this.fpsController = new FPSController(this);
  }

  _createClass(Hls, [{
    key: 'destroy',
    value: function destroy() {
      _utilsLogger.logger.log('destroy');
      this.trigger(_events2['default'].DESTROYING);
      this.detachMedia();
      this.playlistLoader.destroy();
      this.fragmentLoader.destroy();
      this.levelController.destroy();
      this.mediaController.destroy();
      this.timelineController.destroy();
      this.keyLoader.destroy();
      //this.fpsController.destroy();
      this.url = null;
      this.observer.removeAllListeners();
    }
  }, {
    key: 'attachMedia',
    value: function attachMedia(media) {
      _utilsLogger.logger.log('attachMedia');
      this.media = media;
      this.trigger(_events2['default'].MEDIA_ATTACHING, { media: media });
    }
  }, {
    key: 'detachMedia',
    value: function detachMedia() {
      _utilsLogger.logger.log('detachMedia');
      this.trigger(_events2['default'].MEDIA_DETACHING);
      this.media = null;
    }
  }, {
    key: 'loadSource',
    value: function loadSource(url) {
      _utilsLogger.logger.log('loadSource:' + url);
      this.url = url;
      // when attaching to a source URL, trigger a playlist load
      this.trigger(_events2['default'].MANIFEST_LOADING, { url: url });
    }
  }, {
    key: 'startLoad',
    value: function startLoad() {
      _utilsLogger.logger.log('startLoad');
      this.mediaController.startLoad();
    }
  }, {
    key: 'swapAudioCodec',
    value: function swapAudioCodec() {
      _utilsLogger.logger.log('swapAudioCodec');
      this.mediaController.swapAudioCodec();
    }
  }, {
    key: 'recoverMediaError',
    value: function recoverMediaError() {
      _utilsLogger.logger.log('recoverMediaError');
      var media = this.media;
      this.detachMedia();
      this.attachMedia(media);
    }

    /** Return all quality levels **/
  }, {
    key: 'levels',
    get: function get() {
      return this.levelController.levels;
    }

    /** Return current playback quality level **/
  }, {
    key: 'currentLevel',
    get: function get() {
      return this.mediaController.currentLevel;
    },

    /* set quality level immediately (-1 for automatic level selection) */
    set: function set(newLevel) {
      _utilsLogger.logger.log('set currentLevel:' + newLevel);
      this.loadLevel = newLevel;
      this.mediaController.immediateLevelSwitch();
    }

    /** Return next playback quality level (quality level of next fragment) **/
  }, {
    key: 'nextLevel',
    get: function get() {
      return this.mediaController.nextLevel;
    },

    /* set quality level for next fragment (-1 for automatic level selection) */
    set: function set(newLevel) {
      _utilsLogger.logger.log('set nextLevel:' + newLevel);
      this.levelController.manualLevel = newLevel;
      this.mediaController.nextLevelSwitch();
    }

    /** Return the quality level of current/last loaded fragment **/
  }, {
    key: 'loadLevel',
    get: function get() {
      return this.levelController.level;
    },

    /* set quality level for current/next loaded fragment (-1 for automatic level selection) */
    set: function set(newLevel) {
      _utilsLogger.logger.log('set loadLevel:' + newLevel);
      this.levelController.manualLevel = newLevel;
    }

    /** Return the quality level of next loaded fragment **/
  }, {
    key: 'nextLoadLevel',
    get: function get() {
      return this.levelController.nextLoadLevel();
    },

    /** set quality level of next loaded fragment **/
    set: function set(level) {
      this.levelController.level = level;
    }

    /** Return first level (index of first level referenced in manifest)
    **/
  }, {
    key: 'firstLevel',
    get: function get() {
      return this.levelController.firstLevel;
    },

    /** set first level (index of first level referenced in manifest)
    **/
    set: function set(newLevel) {
      _utilsLogger.logger.log('set firstLevel:' + newLevel);
      this.levelController.firstLevel = newLevel;
    }

    /** Return start level (level of first fragment that will be played back)
        if not overrided by user, first level appearing in manifest will be used as start level
        if -1 : automatic start level selection, playback will start from level matching download bandwidth (determined from download of first segment)
    **/
  }, {
    key: 'startLevel',
    get: function get() {
      return this.levelController.startLevel;
    },

    /** set  start level (level of first fragment that will be played back)
        if not overrided by user, first level appearing in manifest will be used as start level
        if -1 : automatic start level selection, playback will start from level matching download bandwidth (determined from download of first segment)
    **/
    set: function set(newLevel) {
      _utilsLogger.logger.log('set startLevel:' + newLevel);
      this.levelController.startLevel = newLevel;
    }

    /** Return the capping/max level value that could be used by automatic level selection algorithm **/
  }, {
    key: 'autoLevelCapping',
    get: function get() {
      return this.abrController.autoLevelCapping;
    },

    /** set the capping/max level value that could be used by automatic level selection algorithm **/
    set: function set(newLevel) {
      _utilsLogger.logger.log('set autoLevelCapping:' + newLevel);
      this.abrController.autoLevelCapping = newLevel;
    }

    /* check if we are in automatic level selection mode */
  }, {
    key: 'autoLevelEnabled',
    get: function get() {
      return this.levelController.manualLevel === -1;
    }

    /* return manual level */
  }, {
    key: 'manualLevel',
    get: function get() {
      return this.levelController.manualLevel;
    }
  }]);

  return Hls;
})();

exports['default'] = Hls;
module.exports = exports['default'];

},{"./controller/abr-controller":3,"./controller/level-controller":4,"./controller/mse-media-controller":5,"./controller/timeline-controller":6,"./errors":18,"./events":20,"./loader/fragment-loader":23,"./loader/key-loader":24,"./loader/playlist-loader":25,"./utils/logger":31,"./utils/xhr-loader":33,"events":1}],23:[function(require,module,exports){
/*
 * Fragment Loader
*/

'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _eventHandler = require('../event-handler');

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _errors = require('../errors');

var FragmentLoader = (function (_EventHandler) {
  _inherits(FragmentLoader, _EventHandler);

  function FragmentLoader(hls) {
    _classCallCheck(this, FragmentLoader);

    _get(Object.getPrototypeOf(FragmentLoader.prototype), 'constructor', this).call(this, hls, _events2['default'].FRAG_LOADING);
  }

  _createClass(FragmentLoader, [{
    key: 'destroy',
    value: function destroy() {
      if (this.loader) {
        this.loader.destroy();
        this.loader = null;
      }
      _eventHandler2['default'].prototype.destroy.call(this);
    }
  }, {
    key: 'onFragLoading',
    value: function onFragLoading(data) {
      var frag = data.frag;
      this.frag = frag;
      this.frag.loaded = 0;
      var config = this.hls.config;
      frag.loader = this.loader = typeof config.fLoader !== 'undefined' ? new config.fLoader(config) : new config.loader(config);
      this.loader.load(frag.url, 'arraybuffer', this.loadsuccess.bind(this), this.loaderror.bind(this), this.loadtimeout.bind(this), config.fragLoadingTimeOut, 1, 0, this.loadprogress.bind(this), frag);
    }
  }, {
    key: 'loadsuccess',
    value: function loadsuccess(event, stats) {
      var payload = event.currentTarget.response;
      stats.length = payload.byteLength;
      // detach fragment loader on load success
      this.frag.loader = undefined;
      this.hls.trigger(_events2['default'].FRAG_LOADED, { payload: payload, frag: this.frag, stats: stats });
    }
  }, {
    key: 'loaderror',
    value: function loaderror(event) {
      this.loader.abort();
      this.hls.trigger(_events2['default'].ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: _errors.ErrorDetails.FRAG_LOAD_ERROR, fatal: false, frag: this.frag, response: event });
    }
  }, {
    key: 'loadtimeout',
    value: function loadtimeout() {
      this.loader.abort();
      this.hls.trigger(_events2['default'].ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: _errors.ErrorDetails.FRAG_LOAD_TIMEOUT, fatal: false, frag: this.frag });
    }
  }, {
    key: 'loadprogress',
    value: function loadprogress(event, stats) {
      this.frag.loaded = stats.loaded;
      this.hls.trigger(_events2['default'].FRAG_LOAD_PROGRESS, { frag: this.frag, stats: stats });
    }
  }]);

  return FragmentLoader;
})(_eventHandler2['default']);

exports['default'] = FragmentLoader;
module.exports = exports['default'];

},{"../errors":18,"../event-handler":19,"../events":20}],24:[function(require,module,exports){
/*
 * Decrypt key Loader
*/

'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _eventHandler = require('../event-handler');

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _errors = require('../errors');

var KeyLoader = (function (_EventHandler) {
  _inherits(KeyLoader, _EventHandler);

  function KeyLoader(hls) {
    _classCallCheck(this, KeyLoader);

    _get(Object.getPrototypeOf(KeyLoader.prototype), 'constructor', this).call(this, hls, _events2['default'].KEY_LOADING);
    this.decryptkey = null;
    this.decrypturl = null;
  }

  _createClass(KeyLoader, [{
    key: 'destroy',
    value: function destroy() {
      if (this.loader) {
        this.loader.destroy();
        this.loader = null;
      }
      _eventHandler2['default'].prototype.destroy.call(this);
    }
  }, {
    key: 'onKeyLoading',
    value: function onKeyLoading(data) {
      var frag = this.frag = data.frag,
          decryptdata = frag.decryptdata,
          uri = decryptdata.uri;
      // if uri is different from previous one or if decrypt key not retrieved yet
      if (uri !== this.decrypturl || this.decryptkey === null) {
        var config = this.hls.config;
        frag.loader = this.loader = new config.loader(config);
        this.decrypturl = uri;
        this.decryptkey = null;
        frag.loader.load(uri, 'arraybuffer', this.loadsuccess.bind(this), this.loaderror.bind(this), this.loadtimeout.bind(this), config.fragLoadingTimeOut, config.fragLoadingMaxRetry, config.fragLoadingRetryDelay, this.loadprogress.bind(this), frag);
      } else if (this.decryptkey) {
        // we already loaded this key, return it
        decryptdata.key = this.decryptkey;
        this.hls.trigger(_events2['default'].KEY_LOADED, { frag: frag });
      }
    }
  }, {
    key: 'loadsuccess',
    value: function loadsuccess(event) {
      var frag = this.frag;
      this.decryptkey = frag.decryptdata.key = new Uint8Array(event.currentTarget.response);
      // detach fragment loader on load success
      frag.loader = undefined;
      this.hls.trigger(_events2['default'].KEY_LOADED, { frag: frag });
    }
  }, {
    key: 'loaderror',
    value: function loaderror(event) {
      this.loader.abort();
      this.hls.trigger(_events2['default'].ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: _errors.ErrorDetails.KEY_LOAD_ERROR, fatal: false, frag: this.frag, response: event });
    }
  }, {
    key: 'loadtimeout',
    value: function loadtimeout() {
      this.loader.abort();
      this.hls.trigger(_events2['default'].ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: _errors.ErrorDetails.KEY_LOAD_TIMEOUT, fatal: false, frag: this.frag });
    }
  }, {
    key: 'loadprogress',
    value: function loadprogress() {}
  }]);

  return KeyLoader;
})(_eventHandler2['default']);

exports['default'] = KeyLoader;
module.exports = exports['default'];

},{"../errors":18,"../event-handler":19,"../events":20}],25:[function(require,module,exports){
/**
 * Playlist Loader
*/

'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _eventHandler = require('../event-handler');

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _errors = require('../errors');

var _utilsUrl = require('../utils/url');

var _utilsUrl2 = _interopRequireDefault(_utilsUrl);

var _utilsAttrList = require('../utils/attr-list');

var _utilsAttrList2 = _interopRequireDefault(_utilsAttrList);

//import {logger} from '../utils/logger';

var PlaylistLoader = (function (_EventHandler) {
  _inherits(PlaylistLoader, _EventHandler);

  function PlaylistLoader(hls) {
    _classCallCheck(this, PlaylistLoader);

    _get(Object.getPrototypeOf(PlaylistLoader.prototype), 'constructor', this).call(this, hls, _events2['default'].MANIFEST_LOADING, _events2['default'].LEVEL_LOADING);
  }

  _createClass(PlaylistLoader, [{
    key: 'destroy',
    value: function destroy() {
      if (this.loader) {
        this.loader.destroy();
        this.loader = null;
      }
      this.url = this.id = null;
      _eventHandler2['default'].prototype.destroy.call(this);
    }
  }, {
    key: 'onManifestLoading',
    value: function onManifestLoading(data) {
      this.load(data.url, null);
    }
  }, {
    key: 'onLevelLoading',
    value: function onLevelLoading(data) {
      this.load(data.url, data.level, data.id);
    }
  }, {
    key: 'load',
    value: function load(url, id1, id2) {
      var config = this.hls.config,
          retry,
          timeout,
          retryDelay;
      this.url = url;
      this.id = id1;
      this.id2 = id2;
      if (this.id === undefined) {
        retry = config.manifestLoadingMaxRetry;
        timeout = config.manifestLoadingTimeOut;
        retryDelay = config.manifestLoadingRetryDelay;
      } else {
        retry = config.levelLoadingMaxRetry;
        timeout = config.levelLoadingTimeOut;
        retryDelay = config.levelLoadingRetryDelay;
      }
      this.loader = typeof config.pLoader !== 'undefined' ? new config.pLoader(config) : new config.loader(config);
      this.loader.load(url, '', this.loadsuccess.bind(this), this.loaderror.bind(this), this.loadtimeout.bind(this), timeout, retry, retryDelay);
    }
  }, {
    key: 'resolve',
    value: function resolve(url, baseUrl) {
      return _utilsUrl2['default'].buildAbsoluteURL(baseUrl, url);
    }
  }, {
    key: 'parseMasterPlaylist',
    value: function parseMasterPlaylist(string, baseurl) {
      var levels = [],
          result = undefined;

      // https://regex101.com is your friend
      var re = /#EXT-X-STREAM-INF:([^\n\r]*)[\r\n]+([^\r\n]+)/g;
      while ((result = re.exec(string)) != null) {
        var level = {};

        var attrs = level.attrs = new _utilsAttrList2['default'](result[1]);
        level.url = this.resolve(result[2], baseurl);

        var resolution = attrs.decimalResolution('RESOLUTION');
        if (resolution) {
          level.width = resolution.width;
          level.height = resolution.height;
        }
        level.bitrate = attrs.decimalInteger('BANDWIDTH');
        level.name = attrs.NAME;

        var codecs = attrs.CODECS;
        if (codecs) {
          codecs = codecs.split(',');
          for (var i = 0; i < codecs.length; i++) {
            var codec = codecs[i];
            if (codec.indexOf('avc1') !== -1) {
              level.videoCodec = this.avc1toavcoti(codec);
            } else {
              level.audioCodec = codec;
            }
          }
        }

        levels.push(level);
      }
      return levels;
    }
  }, {
    key: 'avc1toavcoti',
    value: function avc1toavcoti(codec) {
      var result,
          avcdata = codec.split('.');
      if (avcdata.length > 2) {
        result = avcdata.shift() + '.';
        result += parseInt(avcdata.shift()).toString(16);
        result += ('000' + parseInt(avcdata.shift()).toString(16)).substr(-4);
      } else {
        result = codec;
      }
      return result;
    }
  }, {
    key: 'cloneObj',
    value: function cloneObj(obj) {
      return JSON.parse(JSON.stringify(obj));
    }
  }, {
    key: 'parseLevelPlaylist',
    value: function parseLevelPlaylist(string, baseurl, id) {
      var currentSN = 0,
          totalduration = 0,
          level = { url: baseurl, fragments: [], live: true, startSN: 0 },
          levelkey = { method: null, key: null, iv: null, uri: null },
          cc = 0,
          programDateTime = null,
          frag = null,
          result,
          regexp,
          byteRangeEndOffset,
          byteRangeStartOffset;

      regexp = /(?:#EXT-X-(MEDIA-SEQUENCE):(\d+))|(?:#EXT-X-(TARGETDURATION):(\d+))|(?:#EXT-X-(KEY):(.*))|(?:#EXT(INF):([\d\.]+)[^\r\n]*([\r\n]+[^#|\r\n]+)?)|(?:#EXT-X-(BYTERANGE):([\d]+[@[\d]*)]*[\r\n]+([^#|\r\n]+)?|(?:#EXT-X-(ENDLIST))|(?:#EXT-X-(DIS)CONTINUITY))|(?:#EXT-X-(PROGRAM-DATE-TIME):(.*))/g;
      while ((result = regexp.exec(string)) !== null) {
        result.shift();
        result = result.filter(function (n) {
          return n !== undefined;
        });
        switch (result[0]) {
          case 'MEDIA-SEQUENCE':
            currentSN = level.startSN = parseInt(result[1]);
            break;
          case 'TARGETDURATION':
            level.targetduration = parseFloat(result[1]);
            break;
          case 'ENDLIST':
            level.live = false;
            break;
          case 'DIS':
            cc++;
            break;
          case 'BYTERANGE':
            var params = result[1].split('@');
            if (params.length === 1) {
              byteRangeStartOffset = byteRangeEndOffset;
            } else {
              byteRangeStartOffset = parseInt(params[1]);
            }
            byteRangeEndOffset = parseInt(params[0]) + byteRangeStartOffset;
            if (frag && !frag.url) {
              frag.byteRangeStartOffset = byteRangeStartOffset;
              frag.byteRangeEndOffset = byteRangeEndOffset;
              frag.url = this.resolve(result[2], baseurl);
            }
            break;
          case 'INF':
            var duration = parseFloat(result[1]);
            if (!isNaN(duration)) {
              var fragdecryptdata,
                  sn = currentSN++;
              if (levelkey.method && levelkey.uri && !levelkey.iv) {
                fragdecryptdata = this.cloneObj(levelkey);
                var uint8View = new Uint8Array(16);
                for (var i = 12; i < 16; i++) {
                  uint8View[i] = sn >> 8 * (15 - i) & 0xff;
                }
                fragdecryptdata.iv = uint8View;
              } else {
                fragdecryptdata = levelkey;
              }
              var url = result[2] ? this.resolve(result[2], baseurl) : null;
              frag = { url: url, duration: duration, start: totalduration, sn: sn, level: id, cc: cc, byteRangeStartOffset: byteRangeStartOffset, byteRangeEndOffset: byteRangeEndOffset, decryptdata: fragdecryptdata, programDateTime: programDateTime };
              level.fragments.push(frag);
              totalduration += duration;
              byteRangeStartOffset = null;
              programDateTime = null;
            }
            break;
          case 'KEY':
            // https://tools.ietf.org/html/draft-pantos-http-live-streaming-08#section-3.4.4
            var decryptparams = result[1];
            var keyAttrs = new _utilsAttrList2['default'](decryptparams);
            var decryptmethod = keyAttrs.enumeratedString('METHOD'),
                decrypturi = keyAttrs.URI,
                decryptiv = keyAttrs.hexadecimalInteger('IV');
            if (decryptmethod) {
              levelkey = { method: null, key: null, iv: null, uri: null };
              if (decrypturi && decryptmethod === 'AES-128') {
                levelkey.method = decryptmethod;
                // URI to get the key
                levelkey.uri = this.resolve(decrypturi, baseurl);
                levelkey.key = null;
                // Initialization Vector (IV)
                levelkey.iv = decryptiv;
              }
            }
            break;
          case 'PROGRAM-DATE-TIME':
            programDateTime = new Date(Date.parse(result[1]));
            break;
          default:
            break;
        }
      }
      //logger.log('found ' + level.fragments.length + ' fragments');
      if (frag && !frag.url) {
        level.fragments.pop();
        totalduration -= frag.duration;
      }
      level.totalduration = totalduration;
      level.endSN = currentSN - 1;
      return level;
    }
  }, {
    key: 'loadsuccess',
    value: function loadsuccess(event, stats) {
      var target = event.currentTarget,
          string = target.responseText,
          url = target.responseURL,
          id = this.id,
          id2 = this.id2,
          hls = this.hls,
          levels;
      // responseURL not supported on some browsers (it is used to detect URL redirection)
      if (url === undefined) {
        // fallback to initial URL
        url = this.url;
      }
      stats.tload = performance.now();
      stats.mtime = new Date(target.getResponseHeader('Last-Modified'));
      if (string.indexOf('#EXTM3U') === 0) {
        if (string.indexOf('#EXTINF:') > 0) {
          // 1 level playlist
          // if first request, fire manifest loaded event, level will be reloaded afterwards
          // (this is to have a uniform logic for 1 level/multilevel playlists)
          if (this.id === null) {
            hls.trigger(_events2['default'].MANIFEST_LOADED, { levels: [{ url: url }], url: url, stats: stats });
          } else {
            var levelDetails = this.parseLevelPlaylist(string, url, id);
            stats.tparsed = performance.now();
            hls.trigger(_events2['default'].LEVEL_LOADED, { details: levelDetails, level: id, id: id2, stats: stats });
          }
        } else {
          levels = this.parseMasterPlaylist(string, url);
          // multi level playlist, parse level info
          if (levels.length) {
            hls.trigger(_events2['default'].MANIFEST_LOADED, { levels: levels, url: url, stats: stats });
          } else {
            hls.trigger(_events2['default'].ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: _errors.ErrorDetails.MANIFEST_PARSING_ERROR, fatal: true, url: url, reason: 'no level found in manifest' });
          }
        }
      } else {
        hls.trigger(_events2['default'].ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: _errors.ErrorDetails.MANIFEST_PARSING_ERROR, fatal: true, url: url, reason: 'no EXTM3U delimiter' });
      }
    }
  }, {
    key: 'loaderror',
    value: function loaderror(event) {
      var details, fatal;
      if (this.id === null) {
        details = _errors.ErrorDetails.MANIFEST_LOAD_ERROR;
        fatal = true;
      } else {
        details = _errors.ErrorDetails.LEVEL_LOAD_ERROR;
        fatal = false;
      }
      this.loader.abort();
      this.hls.trigger(_events2['default'].ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: details, fatal: fatal, url: this.url, loader: this.loader, response: event.currentTarget, level: this.id, id: this.id2 });
    }
  }, {
    key: 'loadtimeout',
    value: function loadtimeout() {
      var details, fatal;
      if (this.id === null) {
        details = _errors.ErrorDetails.MANIFEST_LOAD_TIMEOUT;
        fatal = true;
      } else {
        details = _errors.ErrorDetails.LEVEL_LOAD_TIMEOUT;
        fatal = false;
      }
      this.loader.abort();
      this.hls.trigger(_events2['default'].ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: details, fatal: fatal, url: this.url, loader: this.loader, level: this.id, id: this.id2 });
    }
  }]);

  return PlaylistLoader;
})(_eventHandler2['default']);

exports['default'] = PlaylistLoader;
module.exports = exports['default'];

},{"../errors":18,"../event-handler":19,"../events":20,"../utils/attr-list":28,"../utils/url":32}],26:[function(require,module,exports){
/**
 * Generate MP4 Box
*/

//import Hex from '../utils/hex';
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var MP4 = (function () {
  function MP4() {
    _classCallCheck(this, MP4);
  }

  _createClass(MP4, null, [{
    key: 'init',
    value: function init() {
      MP4.types = {
        avc1: [], // codingname
        avcC: [],
        btrt: [],
        dinf: [],
        dref: [],
        esds: [],
        ftyp: [],
        hdlr: [],
        mdat: [],
        mdhd: [],
        mdia: [],
        mfhd: [],
        minf: [],
        moof: [],
        moov: [],
        mp4a: [],
        mvex: [],
        mvhd: [],
        sdtp: [],
        stbl: [],
        stco: [],
        stsc: [],
        stsd: [],
        stsz: [],
        stts: [],
        tfdt: [],
        tfhd: [],
        traf: [],
        trak: [],
        trun: [],
        trex: [],
        tkhd: [],
        vmhd: [],
        smhd: []
      };

      var i;
      for (i in MP4.types) {
        if (MP4.types.hasOwnProperty(i)) {
          MP4.types[i] = [i.charCodeAt(0), i.charCodeAt(1), i.charCodeAt(2), i.charCodeAt(3)];
        }
      }

      var videoHdlr = new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x00, // flags
      0x00, 0x00, 0x00, 0x00, // pre_defined
      0x76, 0x69, 0x64, 0x65, // handler_type: 'vide'
      0x00, 0x00, 0x00, 0x00, // reserved
      0x00, 0x00, 0x00, 0x00, // reserved
      0x00, 0x00, 0x00, 0x00, // reserved
      0x56, 0x69, 0x64, 0x65, 0x6f, 0x48, 0x61, 0x6e, 0x64, 0x6c, 0x65, 0x72, 0x00 // name: 'VideoHandler'
      ]);

      var audioHdlr = new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x00, // flags
      0x00, 0x00, 0x00, 0x00, // pre_defined
      0x73, 0x6f, 0x75, 0x6e, // handler_type: 'soun'
      0x00, 0x00, 0x00, 0x00, // reserved
      0x00, 0x00, 0x00, 0x00, // reserved
      0x00, 0x00, 0x00, 0x00, // reserved
      0x53, 0x6f, 0x75, 0x6e, 0x64, 0x48, 0x61, 0x6e, 0x64, 0x6c, 0x65, 0x72, 0x00 // name: 'SoundHandler'
      ]);

      MP4.HDLR_TYPES = {
        'video': videoHdlr,
        'audio': audioHdlr
      };

      var dref = new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x00, // flags
      0x00, 0x00, 0x00, 0x01, // entry_count
      0x00, 0x00, 0x00, 0x0c, // entry_size
      0x75, 0x72, 0x6c, 0x20, // 'url' type
      0x00, // version 0
      0x00, 0x00, 0x01 // entry_flags
      ]);

      var stco = new Uint8Array([0x00, // version
      0x00, 0x00, 0x00, // flags
      0x00, 0x00, 0x00, 0x00 // entry_count
      ]);

      MP4.STTS = MP4.STSC = MP4.STCO = stco;

      MP4.STSZ = new Uint8Array([0x00, // version
      0x00, 0x00, 0x00, // flags
      0x00, 0x00, 0x00, 0x00, // sample_size
      0x00, 0x00, 0x00, 0x00]);
      // sample_count
      MP4.VMHD = new Uint8Array([0x00, // version
      0x00, 0x00, 0x01, // flags
      0x00, 0x00, // graphicsmode
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00 // opcolor
      ]);
      MP4.SMHD = new Uint8Array([0x00, // version
      0x00, 0x00, 0x00, // flags
      0x00, 0x00, // balance
      0x00, 0x00 // reserved
      ]);

      MP4.STSD = new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x00, // flags
      0x00, 0x00, 0x00, 0x01]); // entry_count

      var majorBrand = new Uint8Array([105, 115, 111, 109]); // isom
      var avc1Brand = new Uint8Array([97, 118, 99, 49]); // avc1
      var minorVersion = new Uint8Array([0, 0, 0, 1]);

      MP4.FTYP = MP4.box(MP4.types.ftyp, majorBrand, minorVersion, majorBrand, avc1Brand);
      MP4.DINF = MP4.box(MP4.types.dinf, MP4.box(MP4.types.dref, dref));
    }
  }, {
    key: 'box',
    value: function box(type) {
      var payload = Array.prototype.slice.call(arguments, 1),
          size = 8,
          i = payload.length,
          len = i,
          result;
      // calculate the total size we need to allocate
      while (i--) {
        size += payload[i].byteLength;
      }
      result = new Uint8Array(size);
      result[0] = size >> 24 & 0xff;
      result[1] = size >> 16 & 0xff;
      result[2] = size >> 8 & 0xff;
      result[3] = size & 0xff;
      result.set(type, 4);
      // copy the payload into the result
      for (i = 0, size = 8; i < len; i++) {
        // copy payload[i] array @ offset size
        result.set(payload[i], size);
        size += payload[i].byteLength;
      }
      return result;
    }
  }, {
    key: 'hdlr',
    value: function hdlr(type) {
      return MP4.box(MP4.types.hdlr, MP4.HDLR_TYPES[type]);
    }
  }, {
    key: 'mdat',
    value: function mdat(data) {
      return MP4.box(MP4.types.mdat, data);
    }
  }, {
    key: 'mdhd',
    value: function mdhd(timescale, duration) {
      return MP4.box(MP4.types.mdhd, new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x00, // flags
      0x00, 0x00, 0x00, 0x02, // creation_time
      0x00, 0x00, 0x00, 0x03, // modification_time
      timescale >> 24 & 0xFF, timescale >> 16 & 0xFF, timescale >> 8 & 0xFF, timescale & 0xFF, // timescale
      duration >> 24, duration >> 16 & 0xFF, duration >> 8 & 0xFF, duration & 0xFF, // duration
      0x55, 0xc4, // 'und' language (undetermined)
      0x00, 0x00]));
    }
  }, {
    key: 'mdia',
    value: function mdia(track) {
      return MP4.box(MP4.types.mdia, MP4.mdhd(track.timescale, track.duration), MP4.hdlr(track.type), MP4.minf(track));
    }
  }, {
    key: 'mfhd',
    value: function mfhd(sequenceNumber) {
      return MP4.box(MP4.types.mfhd, new Uint8Array([0x00, 0x00, 0x00, 0x00, // flags
      sequenceNumber >> 24, sequenceNumber >> 16 & 0xFF, sequenceNumber >> 8 & 0xFF, sequenceNumber & 0xFF]));
    }
  }, {
    key: 'minf',
    // sequence_number
    value: function minf(track) {
      if (track.type === 'audio') {
        return MP4.box(MP4.types.minf, MP4.box(MP4.types.smhd, MP4.SMHD), MP4.DINF, MP4.stbl(track));
      } else {
        return MP4.box(MP4.types.minf, MP4.box(MP4.types.vmhd, MP4.VMHD), MP4.DINF, MP4.stbl(track));
      }
    }
  }, {
    key: 'moof',
    value: function moof(sn, baseMediaDecodeTime, track) {
      return MP4.box(MP4.types.moof, MP4.mfhd(sn), MP4.traf(track, baseMediaDecodeTime));
    }

    /**
     * @param tracks... (optional) {array} the tracks associated with this movie
     */
  }, {
    key: 'moov',
    value: function moov(tracks) {
      var i = tracks.length,
          boxes = [];

      while (i--) {
        boxes[i] = MP4.trak(tracks[i]);
      }

      return MP4.box.apply(null, [MP4.types.moov, MP4.mvhd(tracks[0].timescale, tracks[0].duration)].concat(boxes).concat(MP4.mvex(tracks)));
    }
  }, {
    key: 'mvex',
    value: function mvex(tracks) {
      var i = tracks.length,
          boxes = [];

      while (i--) {
        boxes[i] = MP4.trex(tracks[i]);
      }
      return MP4.box.apply(null, [MP4.types.mvex].concat(boxes));
    }
  }, {
    key: 'mvhd',
    value: function mvhd(timescale, duration) {
      var bytes = new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x00, // flags
      0x00, 0x00, 0x00, 0x01, // creation_time
      0x00, 0x00, 0x00, 0x02, // modification_time
      timescale >> 24 & 0xFF, timescale >> 16 & 0xFF, timescale >> 8 & 0xFF, timescale & 0xFF, // timescale
      duration >> 24 & 0xFF, duration >> 16 & 0xFF, duration >> 8 & 0xFF, duration & 0xFF, // duration
      0x00, 0x01, 0x00, 0x00, // 1.0 rate
      0x01, 0x00, // 1.0 volume
      0x00, 0x00, // reserved
      0x00, 0x00, 0x00, 0x00, // reserved
      0x00, 0x00, 0x00, 0x00, // reserved
      0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x40, 0x00, 0x00, 0x00, // transformation: unity matrix
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // pre_defined
      0xff, 0xff, 0xff, 0xff // next_track_ID
      ]);
      return MP4.box(MP4.types.mvhd, bytes);
    }
  }, {
    key: 'sdtp',
    value: function sdtp(track) {
      var samples = track.samples || [],
          bytes = new Uint8Array(4 + samples.length),
          flags,
          i;
      // leave the full box header (4 bytes) all zero
      // write the sample table
      for (i = 0; i < samples.length; i++) {
        flags = samples[i].flags;
        bytes[i + 4] = flags.dependsOn << 4 | flags.isDependedOn << 2 | flags.hasRedundancy;
      }

      return MP4.box(MP4.types.sdtp, bytes);
    }
  }, {
    key: 'stbl',
    value: function stbl(track) {
      return MP4.box(MP4.types.stbl, MP4.stsd(track), MP4.box(MP4.types.stts, MP4.STTS), MP4.box(MP4.types.stsc, MP4.STSC), MP4.box(MP4.types.stsz, MP4.STSZ), MP4.box(MP4.types.stco, MP4.STCO));
    }
  }, {
    key: 'avc1',
    value: function avc1(track) {
      var sps = [],
          pps = [],
          i,
          data,
          len;
      // assemble the SPSs

      for (i = 0; i < track.sps.length; i++) {
        data = track.sps[i];
        len = data.byteLength;
        sps.push(len >>> 8 & 0xFF);
        sps.push(len & 0xFF);
        sps = sps.concat(Array.prototype.slice.call(data)); // SPS
      }

      // assemble the PPSs
      for (i = 0; i < track.pps.length; i++) {
        data = track.pps[i];
        len = data.byteLength;
        pps.push(len >>> 8 & 0xFF);
        pps.push(len & 0xFF);
        pps = pps.concat(Array.prototype.slice.call(data));
      }

      var avcc = MP4.box(MP4.types.avcC, new Uint8Array([0x01, // version
      sps[3], // profile
      sps[4], // profile compat
      sps[5], // level
      0xfc | 3, // lengthSizeMinusOne, hard-coded to 4 bytes
      0xE0 | track.sps.length // 3bit reserved (111) + numOfSequenceParameterSets
      ].concat(sps).concat([track.pps.length // numOfPictureParameterSets
      ]).concat(pps))),
          // "PPS"
      width = track.width,
          height = track.height;
      //console.log('avcc:' + Hex.hexDump(avcc));
      return MP4.box(MP4.types.avc1, new Uint8Array([0x00, 0x00, 0x00, // reserved
      0x00, 0x00, 0x00, // reserved
      0x00, 0x01, // data_reference_index
      0x00, 0x00, // pre_defined
      0x00, 0x00, // reserved
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // pre_defined
      width >> 8 & 0xFF, width & 0xff, // width
      height >> 8 & 0xFF, height & 0xff, // height
      0x00, 0x48, 0x00, 0x00, // horizresolution
      0x00, 0x48, 0x00, 0x00, // vertresolution
      0x00, 0x00, 0x00, 0x00, // reserved
      0x00, 0x01, // frame_count
      0x13, 0x76, 0x69, 0x64, 0x65, 0x6f, 0x6a, 0x73, 0x2d, 0x63, 0x6f, 0x6e, 0x74, 0x72, 0x69, 0x62, 0x2d, 0x68, 0x6c, 0x73, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // compressorname
      0x00, 0x18, // depth = 24
      0x11, 0x11]), // pre_defined = -1
      avcc, MP4.box(MP4.types.btrt, new Uint8Array([0x00, 0x1c, 0x9c, 0x80, // bufferSizeDB
      0x00, 0x2d, 0xc6, 0xc0, // maxBitrate
      0x00, 0x2d, 0xc6, 0xc0])) // avgBitrate
      );
    }
  }, {
    key: 'esds',
    value: function esds(track) {
      var configlen = track.config.length;
      return new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x00, // flags

      0x03, // descriptor_type
      0x17 + configlen, // length
      0x00, 0x01, //es_id
      0x00, // stream_priority

      0x04, // descriptor_type
      0x0f + configlen, // length
      0x40, //codec : mpeg4_audio
      0x15, // stream_type
      0x00, 0x00, 0x00, // buffer_size
      0x00, 0x00, 0x00, 0x00, // maxBitrate
      0x00, 0x00, 0x00, 0x00, // avgBitrate

      0x05 // descriptor_type
      ].concat([configlen]).concat(track.config).concat([0x06, 0x01, 0x02])); // GASpecificConfig)); // length + audio config descriptor
    }
  }, {
    key: 'mp4a',
    value: function mp4a(track) {
      var audiosamplerate = track.audiosamplerate;
      return MP4.box(MP4.types.mp4a, new Uint8Array([0x00, 0x00, 0x00, // reserved
      0x00, 0x00, 0x00, // reserved
      0x00, 0x01, // data_reference_index
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // reserved
      0x00, track.channelCount, // channelcount
      0x00, 0x10, // sampleSize:16bits
      0x00, 0x00, 0x00, 0x00, // reserved2
      audiosamplerate >> 8 & 0xFF, audiosamplerate & 0xff, //
      0x00, 0x00]), MP4.box(MP4.types.esds, MP4.esds(track)));
    }
  }, {
    key: 'stsd',
    value: function stsd(track) {
      if (track.type === 'audio') {
        return MP4.box(MP4.types.stsd, MP4.STSD, MP4.mp4a(track));
      } else {
        return MP4.box(MP4.types.stsd, MP4.STSD, MP4.avc1(track));
      }
    }
  }, {
    key: 'tkhd',
    value: function tkhd(track) {
      var id = track.id,
          duration = track.duration,
          width = track.width,
          height = track.height;
      return MP4.box(MP4.types.tkhd, new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x07, // flags
      0x00, 0x00, 0x00, 0x00, // creation_time
      0x00, 0x00, 0x00, 0x00, // modification_time
      id >> 24 & 0xFF, id >> 16 & 0xFF, id >> 8 & 0xFF, id & 0xFF, // track_ID
      0x00, 0x00, 0x00, 0x00, // reserved
      duration >> 24, duration >> 16 & 0xFF, duration >> 8 & 0xFF, duration & 0xFF, // duration
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // reserved
      0x00, 0x00, // layer
      0x00, 0x00, // alternate_group
      0x00, 0x00, // non-audio track volume
      0x00, 0x00, // reserved
      0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x40, 0x00, 0x00, 0x00, // transformation: unity matrix
      width >> 8 & 0xFF, width & 0xFF, 0x00, 0x00, // width
      height >> 8 & 0xFF, height & 0xFF, 0x00, 0x00 // height
      ]));
    }
  }, {
    key: 'traf',
    value: function traf(track, baseMediaDecodeTime) {
      var sampleDependencyTable = MP4.sdtp(track),
          id = track.id;
      return MP4.box(MP4.types.traf, MP4.box(MP4.types.tfhd, new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x00, // flags
      id >> 24, id >> 16 & 0XFF, id >> 8 & 0XFF, id & 0xFF])), // track_ID
      MP4.box(MP4.types.tfdt, new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x00, // flags
      baseMediaDecodeTime >> 24, baseMediaDecodeTime >> 16 & 0XFF, baseMediaDecodeTime >> 8 & 0XFF, baseMediaDecodeTime & 0xFF])), // baseMediaDecodeTime
      MP4.trun(track, sampleDependencyTable.length + 16 + // tfhd
      16 + // tfdt
      8 + // traf header
      16 + // mfhd
      8 + // moof header
      8), // mdat header
      sampleDependencyTable);
    }

    /**
     * Generate a track box.
     * @param track {object} a track definition
     * @return {Uint8Array} the track box
     */
  }, {
    key: 'trak',
    value: function trak(track) {
      track.duration = track.duration || 0xffffffff;
      return MP4.box(MP4.types.trak, MP4.tkhd(track), MP4.mdia(track));
    }
  }, {
    key: 'trex',
    value: function trex(track) {
      var id = track.id;
      return MP4.box(MP4.types.trex, new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x00, // flags
      id >> 24, id >> 16 & 0XFF, id >> 8 & 0XFF, id & 0xFF, // track_ID
      0x00, 0x00, 0x00, 0x01, // default_sample_description_index
      0x00, 0x00, 0x00, 0x00, // default_sample_duration
      0x00, 0x00, 0x00, 0x00, // default_sample_size
      0x00, 0x01, 0x00, 0x01 // default_sample_flags
      ]));
    }
  }, {
    key: 'trun',
    value: function trun(track, offset) {
      var samples = track.samples || [],
          len = samples.length,
          arraylen = 12 + 16 * len,
          array = new Uint8Array(arraylen),
          i,
          sample,
          duration,
          size,
          flags,
          cts;
      offset += 8 + arraylen;
      array.set([0x00, // version 0
      0x00, 0x0f, 0x01, // flags
      len >>> 24 & 0xFF, len >>> 16 & 0xFF, len >>> 8 & 0xFF, len & 0xFF, // sample_count
      offset >>> 24 & 0xFF, offset >>> 16 & 0xFF, offset >>> 8 & 0xFF, offset & 0xFF // data_offset
      ], 0);
      for (i = 0; i < len; i++) {
        sample = samples[i];
        duration = sample.duration;
        size = sample.size;
        flags = sample.flags;
        cts = sample.cts;
        array.set([duration >>> 24 & 0xFF, duration >>> 16 & 0xFF, duration >>> 8 & 0xFF, duration & 0xFF, // sample_duration
        size >>> 24 & 0xFF, size >>> 16 & 0xFF, size >>> 8 & 0xFF, size & 0xFF, // sample_size
        flags.isLeading << 2 | flags.dependsOn, flags.isDependedOn << 6 | flags.hasRedundancy << 4 | flags.paddingValue << 1 | flags.isNonSync, flags.degradPrio & 0xF0 << 8, flags.degradPrio & 0x0F, // sample_flags
        cts >>> 24 & 0xFF, cts >>> 16 & 0xFF, cts >>> 8 & 0xFF, cts & 0xFF // sample_composition_time_offset
        ], 12 + 16 * i);
      }
      return MP4.box(MP4.types.trun, array);
    }
  }, {
    key: 'initSegment',
    value: function initSegment(tracks) {
      if (!MP4.types) {
        MP4.init();
      }
      var movie = MP4.moov(tracks),
          result;
      result = new Uint8Array(MP4.FTYP.byteLength + movie.byteLength);
      result.set(MP4.FTYP);
      result.set(movie, MP4.FTYP.byteLength);
      return result;
    }
  }]);

  return MP4;
})();

exports['default'] = MP4;
module.exports = exports['default'];

},{}],27:[function(require,module,exports){
/**
 * fMP4 remuxer
*/

'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _utilsLogger = require('../utils/logger');

var _remuxMp4Generator = require('../remux/mp4-generator');

var _remuxMp4Generator2 = _interopRequireDefault(_remuxMp4Generator);

var _errors = require('../errors');

var MP4Remuxer = (function () {
  function MP4Remuxer(observer) {
    _classCallCheck(this, MP4Remuxer);

    this.observer = observer;
    this.ISGenerated = false;
    this.PES2MP4SCALEFACTOR = 4;
    this.PES_TIMESCALE = 90000;
    this.MP4_TIMESCALE = this.PES_TIMESCALE / this.PES2MP4SCALEFACTOR;
  }

  _createClass(MP4Remuxer, [{
    key: 'destroy',
    value: function destroy() {}
  }, {
    key: 'insertDiscontinuity',
    value: function insertDiscontinuity() {
      this._initPTS = this._initDTS = this.nextAacPts = this.nextAvcDts = undefined;
    }
  }, {
    key: 'switchLevel',
    value: function switchLevel() {
      this.ISGenerated = false;
    }
  }, {
    key: 'remux',
    value: function remux(audioTrack, videoTrack, id3Track, textTrack, timeOffset, contiguous) {
      // generate Init Segment if needed
      if (!this.ISGenerated) {
        this.generateIS(audioTrack, videoTrack, timeOffset);
      }
      //logger.log('nb AVC samples:' + videoTrack.samples.length);
      if (videoTrack.samples.length) {
        this.remuxVideo(videoTrack, timeOffset, contiguous);
      }
      //logger.log('nb AAC samples:' + audioTrack.samples.length);
      if (audioTrack.samples.length) {
        this.remuxAudio(audioTrack, timeOffset, contiguous);
      }
      //logger.log('nb ID3 samples:' + audioTrack.samples.length);
      if (id3Track.samples.length) {
        this.remuxID3(id3Track, timeOffset);
      }
      //logger.log('nb ID3 samples:' + audioTrack.samples.length);
      if (textTrack.samples.length) {
        this.remuxText(textTrack, timeOffset);
      }
      //notify end of parsing
      this.observer.trigger(_events2['default'].FRAG_PARSED);
    }
  }, {
    key: 'generateIS',
    value: function generateIS(audioTrack, videoTrack, timeOffset) {
      var observer = this.observer,
          audioSamples = audioTrack.samples,
          videoSamples = videoTrack.samples,
          nbAudio = audioSamples.length,
          nbVideo = videoSamples.length,
          pesTimeScale = this.PES_TIMESCALE;

      if (nbAudio === 0 && nbVideo === 0) {
        observer.trigger(_events2['default'].ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.FRAG_PARSING_ERROR, fatal: false, reason: 'no audio/video samples found' });
      } else if (nbVideo === 0) {
        //audio only
        if (audioTrack.config) {
          observer.trigger(_events2['default'].FRAG_PARSING_INIT_SEGMENT, {
            audioMoov: _remuxMp4Generator2['default'].initSegment([audioTrack]),
            audioCodec: audioTrack.codec,
            audioChannelCount: audioTrack.channelCount
          });
          this.ISGenerated = true;
        }
        if (this._initPTS === undefined) {
          // remember first PTS of this demuxing context
          this._initPTS = audioSamples[0].pts - pesTimeScale * timeOffset;
          this._initDTS = audioSamples[0].dts - pesTimeScale * timeOffset;
        }
      } else if (nbAudio === 0) {
        //video only
        if (videoTrack.sps && videoTrack.pps) {
          observer.trigger(_events2['default'].FRAG_PARSING_INIT_SEGMENT, {
            videoMoov: _remuxMp4Generator2['default'].initSegment([videoTrack]),
            videoCodec: videoTrack.codec,
            videoWidth: videoTrack.width,
            videoHeight: videoTrack.height
          });
          this.ISGenerated = true;
          if (this._initPTS === undefined) {
            // remember first PTS of this demuxing context
            this._initPTS = videoSamples[0].pts - pesTimeScale * timeOffset;
            this._initDTS = videoSamples[0].dts - pesTimeScale * timeOffset;
          }
        }
      } else {
        //audio and video
        if (audioTrack.config && videoTrack.sps && videoTrack.pps) {
          observer.trigger(_events2['default'].FRAG_PARSING_INIT_SEGMENT, {
            audioMoov: _remuxMp4Generator2['default'].initSegment([audioTrack]),
            audioCodec: audioTrack.codec,
            audioChannelCount: audioTrack.channelCount,
            videoMoov: _remuxMp4Generator2['default'].initSegment([videoTrack]),
            videoCodec: videoTrack.codec,
            videoWidth: videoTrack.width,
            videoHeight: videoTrack.height
          });
          this.ISGenerated = true;
          if (this._initPTS === undefined) {
            // remember first PTS of this demuxing context
            this._initPTS = Math.min(videoSamples[0].pts, audioSamples[0].pts) - pesTimeScale * timeOffset;
            this._initDTS = Math.min(videoSamples[0].dts, audioSamples[0].dts) - pesTimeScale * timeOffset;
          }
        }
      }
    }
  }, {
    key: 'remuxVideo',
    value: function remuxVideo(track, timeOffset, contiguous) {
      var view,
          offset = 8,
          pesTimeScale = this.PES_TIMESCALE,
          pes2mp4ScaleFactor = this.PES2MP4SCALEFACTOR,
          avcSample,
          mp4Sample,
          mp4SampleLength,
          unit,
          mdat,
          moof,
          firstPTS,
          firstDTS,
          lastDTS,
          pts,
          dts,
          ptsnorm,
          dtsnorm,
          flags,
          samples = [];
      /* concatenate the video data and construct the mdat in place
        (need 8 more bytes to fill length and mpdat type) */
      mdat = new Uint8Array(track.len + 4 * track.nbNalu + 8);
      view = new DataView(mdat.buffer);
      view.setUint32(0, mdat.byteLength);
      mdat.set(_remuxMp4Generator2['default'].types.mdat, 4);
      while (track.samples.length) {
        avcSample = track.samples.shift();
        mp4SampleLength = 0;
        // convert NALU bitstream to MP4 format (prepend NALU with size field)
        while (avcSample.units.units.length) {
          unit = avcSample.units.units.shift();
          view.setUint32(offset, unit.data.byteLength);
          offset += 4;
          mdat.set(unit.data, offset);
          offset += unit.data.byteLength;
          mp4SampleLength += 4 + unit.data.byteLength;
        }
        pts = avcSample.pts - this._initDTS;
        dts = avcSample.dts - this._initDTS;
        // ensure DTS is not bigger than PTS
        dts = Math.min(pts, dts);
        //logger.log(`Video/PTS/DTS:${Math.round(pts/90)}/${Math.round(dts/90)}`);
        // if not first AVC sample of video track, normalize PTS/DTS with previous sample value
        // and ensure that sample duration is positive
        if (lastDTS !== undefined) {
          ptsnorm = this._PTSNormalize(pts, lastDTS);
          dtsnorm = this._PTSNormalize(dts, lastDTS);
          var sampleDuration = (dtsnorm - lastDTS) / pes2mp4ScaleFactor;
          if (sampleDuration <= 0) {
            _utilsLogger.logger.log('invalid sample duration at PTS/DTS: ' + avcSample.pts + '/' + avcSample.dts + ':' + sampleDuration);
            sampleDuration = 1;
          }
          mp4Sample.duration = sampleDuration;
        } else {
          var nextAvcDts = this.nextAvcDts,
              delta;
          // first AVC sample of video track, normalize PTS/DTS
          ptsnorm = this._PTSNormalize(pts, nextAvcDts);
          dtsnorm = this._PTSNormalize(dts, nextAvcDts);
          delta = Math.round((dtsnorm - nextAvcDts) / 90);
          // if fragment are contiguous, or delta less than 600ms, ensure there is no overlap/hole between fragments
          if (contiguous || Math.abs(delta) < 600) {
            if (delta) {
              if (delta > 1) {
                _utilsLogger.logger.log('AVC:' + delta + ' ms hole between fragments detected,filling it');
              } else if (delta < -1) {
                _utilsLogger.logger.log('AVC:' + -delta + ' ms overlapping between fragments detected');
              }
              // set DTS to next DTS
              dtsnorm = nextAvcDts;
              // offset PTS as well, ensure that PTS is smaller or equal than new DTS
              ptsnorm = Math.max(ptsnorm - delta, dtsnorm);
              _utilsLogger.logger.log('Video/PTS/DTS adjusted: ' + ptsnorm + '/' + dtsnorm + ',delta:' + delta);
            }
          }
          // remember first PTS of our avcSamples, ensure value is positive
          firstPTS = Math.max(0, ptsnorm);
          firstDTS = Math.max(0, dtsnorm);
        }
        //console.log('PTS/DTS/initDTS/normPTS/normDTS/relative PTS : ${avcSample.pts}/${avcSample.dts}/${this._initDTS}/${ptsnorm}/${dtsnorm}/${(avcSample.pts/4294967296).toFixed(3)}');
        mp4Sample = {
          size: mp4SampleLength,
          duration: 0,
          cts: (ptsnorm - dtsnorm) / pes2mp4ScaleFactor,
          flags: {
            isLeading: 0,
            isDependedOn: 0,
            hasRedundancy: 0,
            degradPrio: 0
          }
        };
        flags = mp4Sample.flags;
        if (avcSample.key === true) {
          // the current sample is a key frame
          flags.dependsOn = 2;
          flags.isNonSync = 0;
        } else {
          flags.dependsOn = 1;
          flags.isNonSync = 1;
        }
        samples.push(mp4Sample);
        lastDTS = dtsnorm;
      }
      var lastSampleDuration = 0;
      if (samples.length >= 2) {
        lastSampleDuration = samples[samples.length - 2].duration;
        mp4Sample.duration = lastSampleDuration;
      }
      // next AVC sample DTS should be equal to last sample DTS + last sample duration
      this.nextAvcDts = dtsnorm + lastSampleDuration * pes2mp4ScaleFactor;
      track.len = 0;
      track.nbNalu = 0;
      if (samples.length && navigator.userAgent.toLowerCase().indexOf('chrome') > -1) {
        flags = samples[0].flags;
        // chrome workaround, mark first sample as being a Random Access Point to avoid sourcebuffer append issue
        // https://code.google.com/p/chromium/issues/detail?id=229412
        flags.dependsOn = 2;
        flags.isNonSync = 0;
      }
      track.samples = samples;
      moof = _remuxMp4Generator2['default'].moof(track.sequenceNumber++, firstDTS / pes2mp4ScaleFactor, track);
      track.samples = [];
      this.observer.trigger(_events2['default'].FRAG_PARSING_DATA, {
        moof: moof,
        mdat: mdat,
        startPTS: firstPTS / pesTimeScale,
        endPTS: (ptsnorm + pes2mp4ScaleFactor * lastSampleDuration) / pesTimeScale,
        startDTS: firstDTS / pesTimeScale,
        endDTS: this.nextAvcDts / pesTimeScale,
        type: 'video',
        nb: samples.length
      });
    }
  }, {
    key: 'remuxAudio',
    value: function remuxAudio(track, timeOffset, contiguous) {
      var view,
          offset = 8,
          pesTimeScale = this.PES_TIMESCALE,
          pes2mp4ScaleFactor = this.PES2MP4SCALEFACTOR,
          aacSample,
          mp4Sample,
          unit,
          mdat,
          moof,
          firstPTS,
          firstDTS,
          lastDTS,
          pts,
          dts,
          ptsnorm,
          dtsnorm,
          samples = [],
          samples0 = [];

      track.samples.forEach(function (aacSample) {
        if (pts === undefined || aacSample.pts > pts) {
          samples0.push(aacSample);
          pts = aacSample.pts;
        } else {
          _utilsLogger.logger.warn('dropping past audio frame');
        }
      });

      while (samples0.length) {
        aacSample = samples0.shift();
        unit = aacSample.unit;
        pts = aacSample.pts - this._initDTS;
        dts = aacSample.dts - this._initDTS;
        //logger.log(`Audio/PTS:${Math.round(pts/90)}`);
        // if not first sample
        if (lastDTS !== undefined) {
          ptsnorm = this._PTSNormalize(pts, lastDTS);
          dtsnorm = this._PTSNormalize(dts, lastDTS);
          // let's compute sample duration
          mp4Sample.duration = (dtsnorm - lastDTS) / pes2mp4ScaleFactor;
          if (mp4Sample.duration < 0) {
            // not expected to happen ...
            _utilsLogger.logger.log('invalid AAC sample duration at PTS:' + aacSample.pts + ':' + mp4Sample.duration);
            mp4Sample.duration = 0;
          }
        } else {
          var nextAacPts = this.nextAacPts,
              delta;
          ptsnorm = this._PTSNormalize(pts, nextAacPts);
          dtsnorm = this._PTSNormalize(dts, nextAacPts);
          delta = Math.round(1000 * (ptsnorm - nextAacPts) / pesTimeScale);
          // if fragment are contiguous, or delta less than 600ms, ensure there is no overlap/hole between fragments
          if (contiguous || Math.abs(delta) < 600) {
            // log delta
            if (delta) {
              if (delta > 0) {
                _utilsLogger.logger.log(delta + ' ms hole between AAC samples detected,filling it');
                // if we have frame overlap, overlapping for more than half a frame duraion
              } else if (delta < -12) {
                  // drop overlapping audio frames... browser will deal with it
                  _utilsLogger.logger.log(-delta + ' ms overlapping between AAC samples detected, drop frame');
                  track.len -= unit.byteLength;
                  continue;
                }
              // set DTS to next DTS
              ptsnorm = dtsnorm = nextAacPts;
            }
          }
          // remember first PTS of our aacSamples, ensure value is positive
          firstPTS = Math.max(0, ptsnorm);
          firstDTS = Math.max(0, dtsnorm);
          /* concatenate the audio data and construct the mdat in place
            (need 8 more bytes to fill length and mdat type) */
          mdat = new Uint8Array(track.len + 8);
          view = new DataView(mdat.buffer);
          view.setUint32(0, mdat.byteLength);
          mdat.set(_remuxMp4Generator2['default'].types.mdat, 4);
        }
        mdat.set(unit, offset);
        offset += unit.byteLength;
        //console.log('PTS/DTS/initDTS/normPTS/normDTS/relative PTS : ${aacSample.pts}/${aacSample.dts}/${this._initDTS}/${ptsnorm}/${dtsnorm}/${(aacSample.pts/4294967296).toFixed(3)}');
        mp4Sample = {
          size: unit.byteLength,
          cts: 0,
          duration: 0,
          flags: {
            isLeading: 0,
            isDependedOn: 0,
            hasRedundancy: 0,
            degradPrio: 0,
            dependsOn: 1
          }
        };
        samples.push(mp4Sample);
        lastDTS = dtsnorm;
      }
      var lastSampleDuration = 0;
      var nbSamples = samples.length;
      //set last sample duration as being identical to previous sample
      if (nbSamples >= 2) {
        lastSampleDuration = samples[nbSamples - 2].duration;
        mp4Sample.duration = lastSampleDuration;
      }
      if (nbSamples) {
        // next aac sample PTS should be equal to last sample PTS + duration
        this.nextAacPts = ptsnorm + pes2mp4ScaleFactor * lastSampleDuration;
        //logger.log('Audio/PTS/PTSend:' + aacSample.pts.toFixed(0) + '/' + this.nextAacDts.toFixed(0));
        track.len = 0;
        track.samples = samples;
        moof = _remuxMp4Generator2['default'].moof(track.sequenceNumber++, firstDTS / pes2mp4ScaleFactor, track);
        track.samples = [];
        this.observer.trigger(_events2['default'].FRAG_PARSING_DATA, {
          moof: moof,
          mdat: mdat,
          startPTS: firstPTS / pesTimeScale,
          endPTS: this.nextAacPts / pesTimeScale,
          startDTS: firstDTS / pesTimeScale,
          endDTS: (dtsnorm + pes2mp4ScaleFactor * lastSampleDuration) / pesTimeScale,
          type: 'audio',
          nb: nbSamples
        });
      }
    }
  }, {
    key: 'remuxID3',
    value: function remuxID3(track, timeOffset) {
      var length = track.samples.length,
          sample;
      // consume samples
      if (length) {
        for (var index = 0; index < length; index++) {
          sample = track.samples[index];
          // setting id3 pts, dts to relative time
          // using this._initPTS and this._initDTS to calculate relative time
          sample.pts = (sample.pts - this._initPTS) / this.PES_TIMESCALE;
          sample.dts = (sample.dts - this._initDTS) / this.PES_TIMESCALE;
        }
        this.observer.trigger(_events2['default'].FRAG_PARSING_METADATA, {
          samples: track.samples
        });
      }

      track.samples = [];
      timeOffset = timeOffset;
    }
  }, {
    key: 'remuxText',
    value: function remuxText(track, timeOffset) {
      track.samples.sort(function (a, b) {
        if (a.pts < b.pts) {
          return -1;
        } else if (a.pts > b.pts) {
          return 1;
        } else {
          return 0;
        }
      });

      var length = track.samples.length,
          sample;
      // consume samples
      if (length) {
        for (var index = 0; index < length; index++) {
          sample = track.samples[index];
          // setting text pts, dts to relative time
          // using this._initPTS and this._initDTS to calculate relative time
          sample.pts = (sample.pts - this._initPTS) / this.PES_TIMESCALE;
        }
        this.observer.trigger(_events2['default'].FRAG_PARSING_USERDATA, {
          samples: track.samples
        });
      }

      track.samples = [];
      timeOffset = timeOffset;
    }
  }, {
    key: '_PTSNormalize',
    value: function _PTSNormalize(value, reference) {
      var offset;
      if (reference === undefined) {
        return value;
      }
      if (reference < value) {
        // - 2^33
        offset = -8589934592;
      } else {
        // + 2^33
        offset = 8589934592;
      }
      /* PTS is 33bit (from 0 to 2^33 -1)
        if diff between value and reference is bigger than half of the amplitude (2^32) then it means that
        PTS looping occured. fill the gap */
      while (Math.abs(value - reference) > 4294967296) {
        value += offset;
      }
      return value;
    }
  }, {
    key: 'timescale',
    get: function get() {
      return this.MP4_TIMESCALE;
    }
  }]);

  return MP4Remuxer;
})();

exports['default'] = MP4Remuxer;
module.exports = exports['default'];

},{"../errors":18,"../events":20,"../remux/mp4-generator":26,"../utils/logger":31}],28:[function(require,module,exports){

// adapted from https://github.com/kanongil/node-m3u8parse/blob/master/attrlist.js
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var AttrList = (function () {
  function AttrList(attrs) {
    _classCallCheck(this, AttrList);

    if (typeof attrs === 'string') {
      attrs = AttrList.parseAttrList(attrs);
    }
    for (var attr in attrs) {
      if (attrs.hasOwnProperty(attr)) {
        this[attr] = attrs[attr];
      }
    }
  }

  _createClass(AttrList, [{
    key: 'decimalInteger',
    value: function decimalInteger(attrName) {
      var intValue = parseInt(this[attrName], 10);
      if (intValue > Number.MAX_SAFE_INTEGER) {
        return Infinity;
      }
      return intValue;
    }
  }, {
    key: 'hexadecimalInteger',
    value: function hexadecimalInteger(attrName) {
      if (this[attrName]) {
        var stringValue = (this[attrName] || '0x').slice(2);
        stringValue = (stringValue.length & 1 ? '0' : '') + stringValue;

        var value = new Uint8Array(stringValue.length / 2);
        for (var i = 0; i < stringValue.length / 2; i++) {
          value[i] = parseInt(stringValue.slice(i * 2, i * 2 + 2), 16);
        }
        return value;
      } else {
        return null;
      }
    }
  }, {
    key: 'hexadecimalIntegerAsNumber',
    value: function hexadecimalIntegerAsNumber(attrName) {
      var intValue = parseInt(this[attrName], 16);
      if (intValue > Number.MAX_SAFE_INTEGER) {
        return Infinity;
      }
      return intValue;
    }
  }, {
    key: 'decimalFloatingPoint',
    value: function decimalFloatingPoint(attrName) {
      return parseFloat(this[attrName]);
    }
  }, {
    key: 'enumeratedString',
    value: function enumeratedString(attrName) {
      return this[attrName];
    }
  }, {
    key: 'decimalResolution',
    value: function decimalResolution(attrName) {
      var res = /^(\d+)x(\d+)$/.exec(this[attrName]);
      if (res === null) {
        return undefined;
      }
      return {
        width: parseInt(res[1], 10),
        height: parseInt(res[2], 10)
      };
    }
  }], [{
    key: 'parseAttrList',
    value: function parseAttrList(input) {
      var re = /\s*(.+?)\s*=((?:\".*?\")|.*?)(?:,|$)/g;
      var match,
          attrs = {};
      while ((match = re.exec(input)) !== null) {
        var value = match[2],
            quote = '"';

        if (value.indexOf(quote) === 0 && value.lastIndexOf(quote) === value.length - 1) {
          value = value.slice(1, -1);
        }
        attrs[match[1]] = value;
      }
      return attrs;
    }
  }]);

  return AttrList;
})();

exports['default'] = AttrList;
module.exports = exports['default'];

},{}],29:[function(require,module,exports){
"use strict";

var BinarySearch = {
    /**
     * Searches for an item in an array which matches a certain condition.
     * This requires the condition to only match one item in the array,
     * and for the array to be ordered.
     *
     * @param {Array} list The array to search.
     * @param {Function} comparisonFunction
     *      Called and provided a candidate item as the first argument.
     *      Should return:
     *          > -1 if the item should be located at a lower index than the provided item.
     *          > 1 if the item should be located at a higher index than the provided item.
     *          > 0 if the item is the item you're looking for.
     *
     * @return {*} The object if it is found or null otherwise.
     */
    search: function search(list, comparisonFunction) {
        var minIndex = 0;
        var maxIndex = list.length - 1;
        var currentIndex = null;
        var currentElement = null;

        while (minIndex <= maxIndex) {
            currentIndex = (minIndex + maxIndex) / 2 | 0;
            currentElement = list[currentIndex];

            var comparisonResult = comparisonFunction(currentElement);
            if (comparisonResult > 0) {
                minIndex = currentIndex + 1;
            } else if (comparisonResult < 0) {
                maxIndex = currentIndex - 1;
            } else {
                return currentElement;
            }
        }

        return null;
    }
};

module.exports = BinarySearch;

},{}],30:[function(require,module,exports){
/*
 * CEA-708 interpreter
*/

'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var CEA708Interpreter = (function () {
  function CEA708Interpreter() {
    _classCallCheck(this, CEA708Interpreter);
  }

  _createClass(CEA708Interpreter, [{
    key: 'attach',
    value: function attach(media) {
      this.media = media;
      this.display = [];
      this.memory = [];
      this._createCue();
    }
  }, {
    key: 'detatch',
    value: function detatch() {
      this.clear();
    }
  }, {
    key: 'destroy',
    value: function destroy() {}
  }, {
    key: '_createCue',
    value: function _createCue() {
      var VTTCue = window.VTTCue;

      this.cue = new VTTCue(-1, -1, '');
      this.cue.text = '';
      this.cue.pauseOnExit = false;

      // make sure it doesn't show up before it's ready
      this.startTime = Number.MAX_VALUE;

      // show it 'forever' once we do show it
      // (we'll set the end time once we know it later)
      this.cue.endTime = Number.MAX_VALUE;

      this.memory.push(this.cue);
    }
  }, {
    key: 'clear',
    value: function clear() {
      if (this._textTrack && this._textTrack.cues) {
        while (this._textTrack.cues.length > 0) {
          this._textTrack.removeCue(this._textTrack.cues[0]);
        }
      }
    }
  }, {
    key: 'push',
    value: function push(timestamp, bytes) {
      var count = bytes[0] & 31;
      var position = 2;
      var byte, ccbyte1, ccbyte2, ccValid, ccType;

      for (var j = 0; j < count; j++) {
        byte = bytes[position++];
        ccbyte1 = 0x7F & bytes[position++];
        ccbyte2 = 0x7F & bytes[position++];
        ccValid = (4 & byte) === 0 ? false : true;
        ccType = 3 & byte;

        if (ccbyte1 === 0 && ccbyte2 === 0) {
          continue;
        }

        if (ccValid) {
          if (ccType === 0) // || ccType === 1
            {
              // Standard Characters
              if (0x20 & ccbyte1 || 0x40 & ccbyte1) {
                this.cue.text += this._fromCharCode(ccbyte1) + this._fromCharCode(ccbyte2);
              }
              // Special Characters
              else if ((ccbyte1 === 0x11 || ccbyte1 === 0x19) && ccbyte2 >= 0x30 && ccbyte2 <= 0x3F) {
                  // extended chars, e.g. musical note, accents
                  switch (ccbyte2) {
                    case 48:
                      this.cue.text += '®';
                      break;
                    case 49:
                      this.cue.text += '°';
                      break;
                    case 50:
                      this.cue.text += '½';
                      break;
                    case 51:
                      this.cue.text += '¿';
                      break;
                    case 52:
                      this.cue.text += '™';
                      break;
                    case 53:
                      this.cue.text += '¢';
                      break;
                    case 54:
                      this.cue.text += '';
                      break;
                    case 55:
                      this.cue.text += '£';
                      break;
                    case 56:
                      this.cue.text += '♪';
                      break;
                    case 57:
                      this.cue.text += ' ';
                      break;
                    case 58:
                      this.cue.text += 'è';
                      break;
                    case 59:
                      this.cue.text += 'â';
                      break;
                    case 60:
                      this.cue.text += 'ê';
                      break;
                    case 61:
                      this.cue.text += 'î';
                      break;
                    case 62:
                      this.cue.text += 'ô';
                      break;
                    case 63:
                      this.cue.text += 'û';
                      break;
                  }
                }
              if ((ccbyte1 === 0x11 || ccbyte1 === 0x19) && ccbyte2 >= 0x20 && ccbyte2 <= 0x2F) {
                // Mid-row codes: color/underline
                switch (ccbyte2) {
                  case 0x20:
                    // White
                    break;
                  case 0x21:
                    // White Underline
                    break;
                  case 0x22:
                    // Green
                    break;
                  case 0x23:
                    // Green Underline
                    break;
                  case 0x24:
                    // Blue
                    break;
                  case 0x25:
                    // Blue Underline
                    break;
                  case 0x26:
                    // Cyan
                    break;
                  case 0x27:
                    // Cyan Underline
                    break;
                  case 0x28:
                    // Red
                    break;
                  case 0x29:
                    // Red Underline
                    break;
                  case 0x2A:
                    // Yellow
                    break;
                  case 0x2B:
                    // Yellow Underline
                    break;
                  case 0x2C:
                    // Magenta
                    break;
                  case 0x2D:
                    // Magenta Underline
                    break;
                  case 0x2E:
                    // Italics
                    break;
                  case 0x2F:
                    // Italics Underline
                    break;
                }
              }
              if ((ccbyte1 === 0x14 || ccbyte1 === 0x1C) && ccbyte2 >= 0x20 && ccbyte2 <= 0x2F) {
                // Mid-row codes: color/underline
                switch (ccbyte2) {
                  case 0x20:
                    // TODO: shouldn't affect roll-ups...
                    this._clearActiveCues(timestamp);
                    // RCL: Resume Caption Loading
                    // begin pop on
                    break;
                  case 0x21:
                    // BS: Backspace
                    this.cue.text = this.cue.text.substr(0, this.cue.text.length - 1);
                    break;
                  case 0x22:
                    // AOF: reserved (formerly alarm off)
                    break;
                  case 0x23:
                    // AON: reserved (formerly alarm on)
                    break;
                  case 0x24:
                    // DER: Delete to end of row
                    break;
                  case 0x25:
                    // RU2: roll-up 2 rows
                    //this._rollup(2);
                    break;
                  case 0x26:
                    // RU3: roll-up 3 rows
                    //this._rollup(3);
                    break;
                  case 0x27:
                    // RU4: roll-up 4 rows
                    //this._rollup(4);
                    break;
                  case 0x28:
                    // FON: Flash on
                    break;
                  case 0x29:
                    // RDC: Resume direct captioning
                    this._clearActiveCues(timestamp);
                    break;
                  case 0x2A:
                    // TR: Text Restart
                    break;
                  case 0x2B:
                    // RTD: Resume Text Display
                    break;
                  case 0x2C:
                    // EDM: Erase Displayed Memory
                    this._clearActiveCues(timestamp);
                    break;
                  case 0x2D:
                    // CR: Carriage Return
                    // only affects roll-up
                    //this._rollup(1);
                    break;
                  case 0x2E:
                    // ENM: Erase non-displayed memory
                    this._text = '';
                    break;
                  case 0x2F:
                    this._flipMemory(timestamp);
                    // EOC: End of caption
                    // hide any displayed captions and show any hidden one
                    break;
                }
              }
              if ((ccbyte1 === 0x17 || ccbyte1 === 0x1F) && ccbyte2 >= 0x21 && ccbyte2 <= 0x23) {
                // Mid-row codes: color/underline
                switch (ccbyte2) {
                  case 0x21:
                    // TO1: tab offset 1 column
                    break;
                  case 0x22:
                    // TO1: tab offset 2 column
                    break;
                  case 0x23:
                    // TO1: tab offset 3 column
                    break;
                }
              } else {
                // Probably a pre-amble address code
              }
            }
        }
      }
    }
  }, {
    key: '_fromCharCode',
    value: function _fromCharCode(byte) {
      if (byte === 42) {
        return 'á';
      } else if (byte === 92) {
        return 'é';
      } else if (byte === 94) {
        return 'í';
      } else if (byte === 95) {
        return 'ó';
      } else if (byte === 96) {
        return 'ú';
      } else if (byte === 123) {
        return 'ç';
      } else if (byte === 124) {
        return '÷';
      } else if (byte === 125) {
        return 'Ñ';
      } else if (byte === 126) {
        return 'ñ';
      } else if (byte === 127) {
        return '█';
      } else {
        return String.fromCharCode(byte);
      }
    }
  }, {
    key: '_flipMemory',
    value: function _flipMemory(timestamp) {
      this._clearActiveCues(timestamp);
      this._flushCaptions(timestamp);
    }
  }, {
    key: '_flushCaptions',
    value: function _flushCaptions(timestamp) {
      if (!this._has708) {
        this._textTrack = this.media.addTextTrack('captions', 'English', 'en');
        this._has708 = true;
      }

      for (var i = 0; i < this.memory.length; i++) {
        this.memory[i].startTime = timestamp;
        this._textTrack.addCue(this.memory[i]);
        this.display.push(this.memory[i]);
      }

      this.memory = [];

      this._createCue();
    }
  }, {
    key: '_clearActiveCues',
    value: function _clearActiveCues(timestamp) {
      for (var i = 0; i < this.display.length; i++) {
        this.display[i].endTime = timestamp;
      }

      this.display = [];
    }

    /*  _rollUp(n)
      {
        // TODO: implement roll-up captions
      }
    */
  }, {
    key: '_clearBufferedCues',
    value: function _clearBufferedCues() {
      //remove them all...
    }
  }]);

  return CEA708Interpreter;
})();

exports['default'] = CEA708Interpreter;
module.exports = exports['default'];

},{}],31:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
function noop() {}

var fakeLogger = {
  trace: noop,
  debug: noop,
  log: noop,
  warn: noop,
  info: noop,
  error: noop
};

var exportedLogger = fakeLogger;

//let lastCallTime;
// function formatMsgWithTimeInfo(type, msg) {
//   const now = Date.now();
//   const diff = lastCallTime ? '+' + (now - lastCallTime) : '0';
//   lastCallTime = now;
//   msg = (new Date(now)).toISOString() + ' | [' +  type + '] > ' + msg + ' ( ' + diff + ' ms )';
//   return msg;
// }

function formatMsg(type, msg) {
  msg = '[' + type + '] > ' + msg;
  return msg;
}

function consolePrintFn(type) {
  var func = window.console[type];
  if (func) {
    return function () {
      for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      if (args[0]) {
        args[0] = formatMsg(type, args[0]);
      }
      func.apply(window.console, args);
    };
  }
  return noop;
}

function exportLoggerFunctions(debugConfig) {
  for (var _len2 = arguments.length, functions = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
    functions[_key2 - 1] = arguments[_key2];
  }

  functions.forEach(function (type) {
    exportedLogger[type] = debugConfig[type] ? debugConfig[type].bind(debugConfig) : consolePrintFn(type);
  });
}

var enableLogs = function enableLogs(debugConfig) {
  if (debugConfig === true || typeof debugConfig === 'object') {
    exportLoggerFunctions(debugConfig,
    // Remove out from list here to hard-disable a log-level
    //'trace',
    'debug', 'log', 'info', 'warn', 'error');
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

exports.enableLogs = enableLogs;
var logger = exportedLogger;
exports.logger = logger;

},{}],32:[function(require,module,exports){
'use strict';

var URLHelper = {

  // build an absolute URL from a relative one using the provided baseURL
  // if relativeURL is an absolute URL it will be returned as is.
  buildAbsoluteURL: function buildAbsoluteURL(baseURL, relativeURL) {
    // remove any remaining space and CRLF
    relativeURL = relativeURL.trim();
    if (/^[a-z]+:/i.test(relativeURL)) {
      // complete url, not relative
      return relativeURL;
    }

    var relativeURLQuery = null;
    var relativeURLHash = null;

    var relativeURLHashSplit = /^([^#]*)(.*)$/.exec(relativeURL);
    if (relativeURLHashSplit) {
      relativeURLHash = relativeURLHashSplit[2];
      relativeURL = relativeURLHashSplit[1];
    }
    var relativeURLQuerySplit = /^([^\?]*)(.*)$/.exec(relativeURL);
    if (relativeURLQuerySplit) {
      relativeURLQuery = relativeURLQuerySplit[2];
      relativeURL = relativeURLQuerySplit[1];
    }

    var baseURLHashSplit = /^([^#]*)(.*)$/.exec(baseURL);
    if (baseURLHashSplit) {
      baseURL = baseURLHashSplit[1];
    }
    var baseURLQuerySplit = /^([^\?]*)(.*)$/.exec(baseURL);
    if (baseURLQuerySplit) {
      baseURL = baseURLQuerySplit[1];
    }

    var baseURLDomainSplit = /^((([a-z]+):)?\/\/[a-z0-9\.-]+(:[0-9]+)?\/)(.*)$/i.exec(baseURL);
    var baseURLProtocol = baseURLDomainSplit[3];
    var baseURLDomain = baseURLDomainSplit[1];
    var baseURLPath = baseURLDomainSplit[5];

    var builtURL = null;
    if (/^\/\//.test(relativeURL)) {
      builtURL = baseURLProtocol + '://' + URLHelper.buildAbsolutePath('', relativeURL.substring(2));
    } else if (/^\//.test(relativeURL)) {
      builtURL = baseURLDomain + URLHelper.buildAbsolutePath('', relativeURL.substring(1));
    } else {
      var newPath = URLHelper.buildAbsolutePath(baseURLPath, relativeURL);
      builtURL = baseURLDomain + newPath;
    }

    // put the query and hash parts back
    if (relativeURLQuery) {
      builtURL += relativeURLQuery;
    }
    if (relativeURLHash) {
      builtURL += relativeURLHash;
    }
    return builtURL;
  },

  // build an absolute path using the provided basePath
  // adapted from https://developer.mozilla.org/en-US/docs/Web/API/document/cookie#Using_relative_URLs_in_the_path_parameter
  // this does not handle the case where relativePath is "/" or "//". These cases should be handled outside this.
  buildAbsolutePath: function buildAbsolutePath(basePath, relativePath) {
    var sRelPath = relativePath;
    var nUpLn,
        sDir = '',
        sPath = basePath.replace(/[^\/]*$/, sRelPath.replace(/(\/|^)(?:\.?\/+)+/g, '$1'));
    for (var nEnd, nStart = 0; nEnd = sPath.indexOf('/../', nStart), nEnd > -1; nStart = nEnd + nUpLn) {
      nUpLn = /^\/(?:\.\.\/)*/.exec(sPath.slice(nEnd))[0].length;
      sDir = (sDir + sPath.substring(nStart, nEnd)).replace(new RegExp('(?:\\\/+[^\\\/]*){0,' + (nUpLn - 1) / 3 + '}$'), '/');
    }
    return sDir + sPath.substr(nStart);
  }
};

module.exports = URLHelper;

},{}],33:[function(require,module,exports){
/**
 * XHR based logger
*/

'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _utilsLogger = require('../utils/logger');

var XhrLoader = (function () {
  function XhrLoader(config) {
    _classCallCheck(this, XhrLoader);

    if (config && config.xhrSetup) {
      this.xhrSetup = config.xhrSetup;
    }
  }

  _createClass(XhrLoader, [{
    key: 'destroy',
    value: function destroy() {
      this.abort();
      this.loader = null;
    }
  }, {
    key: 'abort',
    value: function abort() {
      var loader = this.loader,
          timeoutHandle = this.timeoutHandle;
      if (loader && loader.readyState !== 4) {
        this.stats.aborted = true;
        loader.abort();
      }
      if (timeoutHandle) {
        window.clearTimeout(timeoutHandle);
      }
    }
  }, {
    key: 'load',
    value: function load(url, responseType, onSuccess, onError, onTimeout, timeout, maxRetry, retryDelay) {
      var onProgress = arguments.length <= 8 || arguments[8] === undefined ? null : arguments[8];
      var frag = arguments.length <= 9 || arguments[9] === undefined ? null : arguments[9];

      this.url = url;
      if (frag && !isNaN(frag.byteRangeStartOffset) && !isNaN(frag.byteRangeEndOffset)) {
        this.byteRange = frag.byteRangeStartOffset + '-' + (frag.byteRangeEndOffset - 1);
      }
      this.responseType = responseType;
      this.onSuccess = onSuccess;
      this.onProgress = onProgress;
      this.onTimeout = onTimeout;
      this.onError = onError;
      this.stats = { trequest: performance.now(), retry: 0 };
      this.timeout = timeout;
      this.maxRetry = maxRetry;
      this.retryDelay = retryDelay;
      this.timeoutHandle = window.setTimeout(this.loadtimeout.bind(this), timeout);
      this.loadInternal();
    }
  }, {
    key: 'loadInternal',
    value: function loadInternal() {
      var xhr;

      if (typeof XDomainRequest !== 'undefined') {
        xhr = this.loader = new XDomainRequest();
      } else {
        xhr = this.loader = new XMLHttpRequest();
      }

      xhr.onloadend = this.loadend.bind(this);
      xhr.onprogress = this.loadprogress.bind(this);

      xhr.open('GET', this.url, true);
      if (this.byteRange) {
        xhr.setRequestHeader('Range', 'bytes=' + this.byteRange);
      }
      xhr.responseType = this.responseType;
      this.stats.tfirst = null;
      this.stats.loaded = 0;
      if (this.xhrSetup) {
        this.xhrSetup(xhr, this.url);
      }
      xhr.send();
    }
  }, {
    key: 'loadend',
    value: function loadend(event) {
      var xhr = event.currentTarget,
          status = xhr.status,
          stats = this.stats;
      // don't proceed if xhr has been aborted
      if (!stats.aborted) {
        // http status between 200 to 299 are all successful
        if (status >= 200 && status < 300) {
          window.clearTimeout(this.timeoutHandle);
          stats.tload = performance.now();
          this.onSuccess(event, stats);
        } else {
          // error ...
          if (stats.retry < this.maxRetry) {
            _utilsLogger.logger.warn(status + ' while loading ' + this.url + ', retrying in ' + this.retryDelay + '...');
            this.destroy();
            window.setTimeout(this.loadInternal.bind(this), this.retryDelay);
            // exponential backoff
            this.retryDelay = Math.min(2 * this.retryDelay, 64000);
            stats.retry++;
          } else {
            window.clearTimeout(this.timeoutHandle);
            _utilsLogger.logger.error(status + ' while loading ' + this.url);
            this.onError(event);
          }
        }
      }
    }
  }, {
    key: 'loadtimeout',
    value: function loadtimeout(event) {
      _utilsLogger.logger.warn('timeout while loading ' + this.url);
      this.onTimeout(event, this.stats);
    }
  }, {
    key: 'loadprogress',
    value: function loadprogress(event) {
      var stats = this.stats;
      if (stats.tfirst === null) {
        stats.tfirst = performance.now();
      }
      stats.loaded = event.loaded;
      if (this.onProgress) {
        this.onProgress(event, stats);
      }
    }
  }]);

  return XhrLoader;
})();

exports['default'] = XhrLoader;
module.exports = exports['default'];

},{"../utils/logger":31}]},{},[22])(22)
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwibm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwibm9kZV9tb2R1bGVzL3dlYndvcmtpZnkvaW5kZXguanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL2NvbnRyb2xsZXIvYWJyLWNvbnRyb2xsZXIuanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL2NvbnRyb2xsZXIvbGV2ZWwtY29udHJvbGxlci5qcyIsIi9Vc2Vycy9qZXJlbXkubGFjaXZpdGEvR2l0SHViL2hscy5qcy9zcmMvY29udHJvbGxlci9tc2UtbWVkaWEtY29udHJvbGxlci5qcyIsIi9Vc2Vycy9qZXJlbXkubGFjaXZpdGEvR2l0SHViL2hscy5qcy9zcmMvY29udHJvbGxlci90aW1lbGluZS1jb250cm9sbGVyLmpzIiwiL1VzZXJzL2plcmVteS5sYWNpdml0YS9HaXRIdWIvaGxzLmpzL3NyYy9jcnlwdC9hZXMuanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL2NyeXB0L2FlczEyOC1kZWNyeXB0ZXIuanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL2NyeXB0L2RlY3J5cHRlci5qcyIsIi9Vc2Vycy9qZXJlbXkubGFjaXZpdGEvR2l0SHViL2hscy5qcy9zcmMvZGVtdXgvYWFjZGVtdXhlci5qcyIsIi9Vc2Vycy9qZXJlbXkubGFjaXZpdGEvR2l0SHViL2hscy5qcy9zcmMvZGVtdXgvYWR0cy5qcyIsIi9Vc2Vycy9qZXJlbXkubGFjaXZpdGEvR2l0SHViL2hscy5qcy9zcmMvZGVtdXgvZGVtdXhlci1pbmxpbmUuanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL2RlbXV4L2RlbXV4ZXItd29ya2VyLmpzIiwiL1VzZXJzL2plcmVteS5sYWNpdml0YS9HaXRIdWIvaGxzLmpzL3NyYy9kZW11eC9kZW11eGVyLmpzIiwiL1VzZXJzL2plcmVteS5sYWNpdml0YS9HaXRIdWIvaGxzLmpzL3NyYy9kZW11eC9leHAtZ29sb21iLmpzIiwiL1VzZXJzL2plcmVteS5sYWNpdml0YS9HaXRIdWIvaGxzLmpzL3NyYy9kZW11eC9pZDMuanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL2RlbXV4L3RzZGVtdXhlci5qcyIsIi9Vc2Vycy9qZXJlbXkubGFjaXZpdGEvR2l0SHViL2hscy5qcy9zcmMvZXJyb3JzLmpzIiwiL1VzZXJzL2plcmVteS5sYWNpdml0YS9HaXRIdWIvaGxzLmpzL3NyYy9ldmVudC1oYW5kbGVyLmpzIiwiL1VzZXJzL2plcmVteS5sYWNpdml0YS9HaXRIdWIvaGxzLmpzL3NyYy9ldmVudHMuanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL2hlbHBlci9sZXZlbC1oZWxwZXIuanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL2hscy5qcyIsIi9Vc2Vycy9qZXJlbXkubGFjaXZpdGEvR2l0SHViL2hscy5qcy9zcmMvbG9hZGVyL2ZyYWdtZW50LWxvYWRlci5qcyIsIi9Vc2Vycy9qZXJlbXkubGFjaXZpdGEvR2l0SHViL2hscy5qcy9zcmMvbG9hZGVyL2tleS1sb2FkZXIuanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL2xvYWRlci9wbGF5bGlzdC1sb2FkZXIuanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL3JlbXV4L21wNC1nZW5lcmF0b3IuanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL3JlbXV4L21wNC1yZW11eGVyLmpzIiwiL1VzZXJzL2plcmVteS5sYWNpdml0YS9HaXRIdWIvaGxzLmpzL3NyYy91dGlscy9hdHRyLWxpc3QuanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL3V0aWxzL2JpbmFyeS1zZWFyY2guanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL3V0aWxzL2NlYS03MDgtaW50ZXJwcmV0ZXIuanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL3V0aWxzL2xvZ2dlci5qcyIsIi9Vc2Vycy9qZXJlbXkubGFjaXZpdGEvR2l0SHViL2hscy5qcy9zcmMvdXRpbHMvdXJsLmpzIiwiL1VzZXJzL2plcmVteS5sYWNpdml0YS9HaXRIdWIvaGxzLmpzL3NyYy91dGlscy94aHItbG9hZGVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFD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Q0FBQyxHQUFHLEdBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUMvRixVQUFFLEdBQUcsTUFBTSxDQUFDLENBQUMsS0FBRyxFQUFFLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxJQUFFLEVBQUUsR0FBRyxHQUFHLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxJQUFFLENBQUMsR0FBRyxHQUFHLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDbkcsVUFBRSxHQUFHLE1BQU0sQ0FBQyxDQUFDLEtBQUcsRUFBRSxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsSUFBRSxFQUFFLEdBQUcsR0FBRyxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsSUFBRSxDQUFDLEdBQUcsR0FBRyxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsR0FBRyxHQUFHLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ25HLFNBQUMsR0FBSSxNQUFNLENBQUMsQ0FBQyxLQUFHLEVBQUUsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLElBQUUsRUFBRSxHQUFHLEdBQUcsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLElBQUUsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLEdBQUcsR0FBRyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztBQUNuRyxjQUFNLElBQUksQ0FBQyxDQUFDO0FBQ1osU0FBQyxHQUFDLEVBQUUsQ0FBQyxBQUFDLENBQUMsR0FBQyxFQUFFLENBQUMsQUFBQyxDQUFDLEdBQUMsRUFBRSxDQUFDO09BQ2xCOzs7QUFHRCxXQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRTtBQUN0QixXQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENB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QUFFLENBQUMsQ0FBQyxBQUFDLE1BQU07QUFBQSxBQUNsQyxpQkFBSyxDQUFDO0FBQUUsc0JBQVEsR0FBRyxDQUFDLEVBQUUsRUFBQyxFQUFFLENBQUMsQ0FBQyxBQUFDLE1BQU07QUFBQSxBQUNsQyxpQkFBSyxDQUFDO0FBQUUsc0JBQVEsR0FBRyxDQUFDLEVBQUUsRUFBQyxFQUFFLENBQUMsQ0FBQyxBQUFDLE1BQU07QUFBQSxBQUNsQyxpQkFBSyxDQUFDO0FBQUUsc0JBQVEsR0FBRyxDQUFDLEVBQUUsRUFBQyxFQUFFLENBQUMsQ0FBQyxBQUFDLE1BQU07QUFBQSxBQUNsQyxpQkFBSyxDQUFDO0FBQUUsc0JBQVEsR0FBRyxDQUFDLEVBQUUsRUFBQyxFQUFFLENBQUMsQ0FBQyxBQUFDLE1BQU07QUFBQSxBQUNsQyxpQkFBSyxFQUFFO0FBQUUsc0JBQVEsR0FBRyxDQUFDLEVBQUUsRUFBQyxFQUFFLENBQUMsQ0FBQyxBQUFDLE1BQU07QUFBQSxBQUNuQyxpQkFBSyxFQUFFO0FBQUUsc0JBQVEsR0FBRyxDQUFDLEVBQUUsRUFBQyxFQUFFLENBQUMsQ0FBQyxBQUFDLE1BQU07QUFBQSxBQUNuQyxpQkFBSyxFQUFFO0FBQUUsc0JBQVEsR0FBRyxDQUFDLEVBQUUsRUFBQyxFQUFFLENBQUMsQ0FBQyxBQUFDLE1BQU07QUFBQSxBQUNuQyxpQkFBSyxFQUFFO0FBQUUsc0JBQVEsR0FBRyxDQUFDLEdBQUcsRUFBQyxFQUFFLENBQUMsQ0FBQyxBQUFDLE1BQU07QUFBQSxBQUNwQyxpQkFBSyxFQUFFO0FBQUUsc0JBQVEsR0FBRyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsQ0FBQyxBQUFDLE1BQU07QUFBQSxBQUNqQyxpQkFBSyxFQUFFO0FBQUUsc0JBQVEsR0FBRyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsQ0FBQyxBQUFDLE1BQU07QUFBQSxBQUNqQyxpQkFBSyxFQUFFO0FBQUUsc0JBQVEsR0FBRyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsQ0FBQyxBQUFDLE1BQU07QUFBQSxBQUNqQyxpQkFBSyxH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RSxHQUFJLElBQUksRUFDdkIsQUFBQyxRQUFRLElBQUksRUFBRSxHQUFJLElBQUksRUFDdkIsQUFBQyxRQUFRLElBQUssQ0FBQyxHQUFJLElBQUksRUFDdkIsUUFBUSxHQUFHLElBQUk7QUFDZixVQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJO0FBQ3RCLFVBQUksRUFBRSxJQUFJO0FBQ1YsVUFBSSxFQUFFLElBQUk7QUFDVixVQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJO0FBQ3RCLFVBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUk7QUFDdEIsVUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUN0QixJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQ3RCLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFDdEIsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUN0QixJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQ3RCLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFDdEIsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUN0QixJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQ3RCLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUk7QUFDdEIsVUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUN0QixJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQ3RCLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFDdEIsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUN0QixJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQ3RCLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUk7QUFDdEIsVUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSTtPQUN2QixDQUFDLENBQUM7QUFDTCxhQUFPLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7S0FDdkM7OztXQUVVLGNBQUMsS0FBSyxFQUFFO0FBQ2pCLFVBQ0UsT0FBTyxHQUFHLEtBQUssQ0FBQyxPQUFPLElBQUksRUFBRTtVQUM3QixLQUFLLEdBQUcsSUFBSSxVQUFVLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUM7VUFDMUMsS0FBSztVQUNMLENBQUMsQ0FBQzs7O0FBR0osV0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQ25DLGFBQUssR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO0FBQ3pCLGFBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQUFBQyxLQUFLLENBQUMsU0FBUyxJQUFJLENBQUMsR0FDakMsS0FBSyxDQUFDLFlBQVksSUFBSSxDQUFDLEFBQUMsR0FDeEIsS0FBSyxDQUFDLGFBQWEsQUFBQyxDQUFDO09BQ3pCOztBQUVELGFBQU8sR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztLQUN2Qzs7O1dBRVUsY0FBQyxLQUFLLEVBQUU7QUFDakIsYUFBTyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztLQUM3TDs7O1dBRVUsY0FBQyxLQUFLLEVBQUU7QUFDakIsVUFBSSxHQUFHLEdBQUcsRUFBRTtVQUFFLEdBQUcsR0FBRyxFQUFFO1VBQUUsQ0FBQztVQUFFLElBQUk7VUFBRSxHQUFHLENBQUM7OztBQUdyQyxXQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQ3JDLFlBQUksR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3BCLFdBQUcsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDO0FBQ3RCLFdBQUcsQ0FBQyxJQUFJLENBQUMsQUFBQyxHQUFHLEtBQUssQ0FBQyxHQUFJLElBQUksQ0FBQyxDQUFDO0FBQzdCLFdBQUcsQ0FBQyxJQUFJLENBQUUsR0FBRyxHQUFHLElBQUksQ0FBRSxDQUFDO0FBQ3ZCLFdBQUcsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO09BQ3BEOzs7QUFHRCxXQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQ3JDLFlBQUksR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3BCLFdBQUcsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDO0FBQ3RCLFdBQUcsQ0FBQyxJQUFJLENBQUMsQUFBQyxHQUFHLEtBQUssQ0FBQyxHQUFJLElBQUksQ0FBQyxDQUFDO0FBQzdC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LEVBQUUsSUFBSSxFQUFFLEdBQUksSUFBSSxFQUNqQixBQUFDLEVBQUUsSUFBSSxDQUFDLEdBQUksSUFBSSxFQUNoQixFQUFFLEdBQUcsSUFBSTtBQUNULFVBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUk7QUFDckIsY0FBUSxJQUFJLEVBQUUsRUFDZixBQUFDLFFBQVEsSUFBSSxFQUFFLEdBQUksSUFBSSxFQUN2QixBQUFDLFFBQVEsSUFBSyxDQUFDLEdBQUksSUFBSSxFQUN2QixRQUFRLEdBQUcsSUFBSTtBQUNmLFVBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFDdEIsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSTtBQUN0QixVQUFJLEVBQUUsSUFBSTtBQUNWLFVBQUksRUFBRSxJQUFJO0FBQ1YsVUFBSSxFQUFFLElBQUk7QUFDVixVQUFJLEVBQUUsSUFBSTtBQUNWLFVBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFDdEIsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUN0QixJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQ3RCLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFDdEIsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUN0QixJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQ3RCLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFDdEIsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUN0QixJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJO0FBQ3RCLEFBQUMsV0FBSyxJQUFJLENBQUMsR0FBSSxJQUFJLEVBQ25CLEtBQUssR0FBRyxJQUFJLEVBQ1osSUFBSSxFQUFFLElBQUk7QUFDVixBQUFDLFlBQU0sSUFBSSxDQUFDLEdBQUksSUFBSSxFQUNwQixNQUFNLEdBQUcsSUFBSSxF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QUFBQSxBQUNSLHlCQUFLLEVBQUU7QUFDTCwwQkFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksR0FBRyxDQUFDO0FBQ3JCLDRCQUFNO0FBQUEsQUFDUix5QkFBSyxFQUFFO0FBQ0wsMEJBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLEdBQUcsQ0FBQztBQUNyQiw0QkFBTTtBQUFBLEFBQ1IseUJBQUssRUFBRTtBQUNMLDBCQUFJLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxHQUFHLENBQUM7QUFDckIsNEJBQU07QUFBQSxBQUNSLHlCQUFLLEVBQUU7QUFDTCwwQkFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksRUFBRSxDQUFDO0FBQ3BCLDRCQUFNO0FBQUEsQUFDUix5QkFBSyxFQUFFO0FBQ0wsMEJBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLEdBQUcsQ0FBQztBQUNyQiw0QkFBTTtBQUFBLEFBQ1IseUJBQUssRUFBRTtBQUNMLDBCQUFJLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxHQUFHLENBQUM7QUFDckIsNEJBQU07QUFBQSxBQUNSLHlCQUFLLEVBQUU7QUFDTCwwQkFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksR0FBRyxDQUFDO0FBQ3JCLDRCQUFNO0FBQUEsQUFDUix5QkFBSyxFQUFFO0FBQ0wsMEJBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLEdBQUcsQ0FBQztBQUNyQiw0QkFBTTtBQUFBLEFBQ1IseUJBQUssRUFBRTtBQUNMLDBCQUFJLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxHQUFHLENBQUM7QUFDckIsNEJBQU07QUFBQSxBQUNSLHlCQUFLLEVBQUU7QUFDTCwwQkFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksR0FBRyxDQUFDO0FBQ3JCLDRCQUFNO0FBQUEsQUFDUix5QkFBSyxFQUFFO0FBQ0wsMEJBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLEdBQUcsQ0FBQztBQUNyQiw0QkFBTTtBQUFBLEFBQ1IseUJBQUssRUFBRTtBQUNMLDBCQUFJ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QUFLLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0tBQ25DOzs7V0FFVyxzQkFBQyxLQUFLLEVBQUU7QUFDbEIsVUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQztBQUN2QixVQUFJLEtBQUssQ0FBQyxNQUFNLEtBQUssSUFBSSxFQUFFO0FBQ3pCLGFBQUssQ0FBQyxNQUFNLEdBQUcsV0FBVyxDQUFDLEdBQUcsRUFBRSxDQUFDO09BQ2xDO0FBQ0QsV0FBSyxDQUFDLE1BQU0sR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDO0FBQzVCLFVBQUksSUFBSSxDQUFDLFVBQVUsRUFBRTtBQUNuQixZQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQztPQUMvQjtLQUNGOzs7U0EvR0csU0FBUzs7O3FCQWtIQSxTQUFTIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9XG4gICAgICB0aHJvdyBUeXBlRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuJyk7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG5cbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICB2YXIgbTtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2Uge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIWVtaXR0ZXIuX2V2ZW50cyB8fCAhZW1pdHRlci5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IDA7XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24oZW1pdHRlci5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSAxO1xuICBlbHNlXG4gICAgcmV0ID0gZW1pdHRlci5fZXZlbnRzW3R5cGVdLmxlbmd0aDtcbiAgcmV0dXJuIHJldDtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbiIsInZhciBidW5kbGVGbiA9IGFyZ3VtZW50c1szXTtcbnZhciBzb3VyY2VzID0gYXJndW1lbnRzWzRdO1xudmFyIGNhY2hlID0gYXJndW1lbnRzWzVdO1xuXG52YXIgc3RyaW5naWZ5ID0gSlNPTi5zdHJpbmdpZnk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGZuKSB7XG4gICAgdmFyIGtleXMgPSBbXTtcbiAgICB2YXIgd2tleTtcbiAgICB2YXIgY2FjaGVLZXlzID0gT2JqZWN0LmtleXMoY2FjaGUpO1xuICAgIFxuICAgIGZvciAodmFyIGkgPSAwLCBsID0gY2FjaGVLZXlzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICB2YXIga2V5ID0gY2FjaGVLZXlzW2ldO1xuICAgICAgICBpZiAoY2FjaGVba2V5XS5leHBvcnRzID09PSBmbikge1xuICAgICAgICAgICAgd2tleSA9IGtleTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxuICAgIFxuICAgIGlmICghd2tleSkge1xuICAgICAgICB3a2V5ID0gTWF0aC5mbG9vcihNYXRoLnBvdygxNiwgOCkgKiBNYXRoLnJhbmRvbSgpKS50b1N0cmluZygxNik7XG4gICAgICAgIHZhciB3Y2FjaGUgPSB7fTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBjYWNoZUtleXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIga2V5ID0gY2FjaGVLZXlzW2ldO1xuICAgICAgICAgICAgd2NhY2hlW2tleV0gPSBrZXk7XG4gICAgICAgIH1cbiAgICAgICAgc291cmNlc1t3a2V5XSA9IFtcbiAgICAgICAgICAgIEZ1bmN0aW9uKFsncmVxdWlyZScsJ21vZHVsZScsJ2V4cG9ydHMnXSwgJygnICsgZm4gKyAnKShzZWxmKScpLFxuICAgICAgICAgICAgd2NhY2hlXG4gICAgICAgIF07XG4gICAgfVxuICAgIHZhciBza2V5ID0gTWF0aC5mbG9vcihNYXRoLnBvdygxNiwgOCkgKiBNYXRoLnJhbmRvbSgpKS50b1N0cmluZygxNik7XG4gICAgXG4gICAgdmFyIHNjYWNoZSA9IHt9OyBzY2FjaGVbd2tleV0gPSB3a2V5O1xuICAgIHNvdXJjZXNbc2tleV0gPSBbXG4gICAgICAgIEZ1bmN0aW9uKFsncmVxdWlyZSddLCdyZXF1aXJlKCcgKyBzdHJpbmdpZnkod2tleSkgKyAnKShzZWxmKScpLFxuICAgICAgICBzY2FjaGVcbiAgICBdO1xuICAgIFxuICAgIHZhciBzcmMgPSAnKCcgKyBidW5kbGVGbiArICcpKHsnXG4gICAgICAgICsgT2JqZWN0LmtleXMoc291cmNlcykubWFwKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgIHJldHVybiBzdHJpbmdpZnkoa2V5KSArICc6WydcbiAgICAgICAgICAgICAgICArIHNvdXJjZXNba2V5XVswXVxuICAgICAgICAgICAgICAgICsgJywnICsgc3RyaW5naWZ5KHNvdXJjZXNba2V5XVsxXSkgKyAnXSdcbiAgICAgICAgICAgIDtcbiAgICAgICAgfSkuam9pbignLCcpXG4gICAgICAgICsgJ30se30sWycgKyBzdHJpbmdpZnkoc2tleSkgKyAnXSknXG4gICAgO1xuICAgIFxuICAgIHZhciBVUkwgPSB3aW5kb3cuVVJMIHx8IHdpbmRvdy53ZWJraXRVUkwgfHwgd2luZG93Lm1velVSTCB8fCB3aW5kb3cubXNVUkw7XG4gICAgXG4gICAgcmV0dXJuIG5ldyBXb3JrZXIoVVJMLmNyZWF0ZU9iamVjdFVSTChcbiAgICAgICAgbmV3IEJsb2IoW3NyY10sIHsgdHlwZTogJ3RleHQvamF2YXNjcmlwdCcgfSlcbiAgICApKTtcbn07XG4iLCIvKlxuICogc2ltcGxlIEFCUiBDb250cm9sbGVyXG4qL1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBFdmVudEhhbmRsZXIgZnJvbSAnLi4vZXZlbnQtaGFuZGxlcic7XG5cbmNsYXNzIEFickNvbnRyb2xsZXIgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHN1cGVyKGhscywgRXZlbnQuRlJBR19MT0FEX1BST0dSRVNTKTtcbiAgICB0aGlzLmxhc3RmZXRjaGxldmVsID0gMDtcbiAgICB0aGlzLl9hdXRvTGV2ZWxDYXBwaW5nID0gLTE7XG4gICAgdGhpcy5fbmV4dEF1dG9MZXZlbCA9IC0xO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBFdmVudEhhbmRsZXIucHJvdG90eXBlLmRlc3Ryb3kuY2FsbCh0aGlzKTtcbiAgfVxuXG4gIG9uRnJhZ0xvYWRQcm9ncmVzcyhkYXRhKSB7XG4gICAgdmFyIHN0YXRzID0gZGF0YS5zdGF0cztcbiAgICBpZiAoc3RhdHMuYWJvcnRlZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLmxhc3RmZXRjaGR1cmF0aW9uID0gKHBlcmZvcm1hbmNlLm5vdygpIC0gc3RhdHMudHJlcXVlc3QpIC8gMTAwMDtcbiAgICAgIHRoaXMubGFzdGZldGNobGV2ZWwgPSBkYXRhLmZyYWcubGV2ZWw7XG4gICAgICB0aGlzLmxhc3RidyA9IChzdGF0cy5sb2FkZWQgKiA4KSAvIHRoaXMubGFzdGZldGNoZHVyYXRpb247XG4gICAgICAvL2NvbnNvbGUubG9nKGBmZXRjaER1cmF0aW9uOiR7dGhpcy5sYXN0ZmV0Y2hkdXJhdGlvbn0sYnc6JHsodGhpcy5sYXN0YncvMTAwMCkudG9GaXhlZCgwKX0vJHtzdGF0cy5hYm9ydGVkfWApO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBSZXR1cm4gdGhlIGNhcHBpbmcvbWF4IGxldmVsIHZhbHVlIHRoYXQgY291bGQgYmUgdXNlZCBieSBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uIGFsZ29yaXRobSAqKi9cbiAgZ2V0IGF1dG9MZXZlbENhcHBpbmcoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2F1dG9MZXZlbENhcHBpbmc7XG4gIH1cblxuICAvKiogc2V0IHRoZSBjYXBwaW5nL21heCBsZXZlbCB2YWx1ZSB0aGF0IGNvdWxkIGJlIHVzZWQgYnkgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBhbGdvcml0aG0gKiovXG4gIHNldCBhdXRvTGV2ZWxDYXBwaW5nKG5ld0xldmVsKSB7XG4gICAgdGhpcy5fYXV0b0xldmVsQ2FwcGluZyA9IG5ld0xldmVsO1xuICB9XG5cbiAgZ2V0IG5leHRBdXRvTGV2ZWwoKSB7XG4gICAgdmFyIGxhc3RidyA9IHRoaXMubGFzdGJ3LCBobHMgPSB0aGlzLmhscyxhZGp1c3RlZGJ3LCBpLCBtYXhBdXRvTGV2ZWw7XG4gICAgaWYgKHRoaXMuX2F1dG9MZXZlbENhcHBpbmcgPT09IC0xKSB7XG4gICAgICBtYXhBdXRvTGV2ZWwgPSBobHMubGV2ZWxzLmxlbmd0aCAtIDE7XG4gICAgfSBlbHNlIHtcbiAgICAgIG1heEF1dG9MZXZlbCA9IHRoaXMuX2F1dG9MZXZlbENhcHBpbmc7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX25leHRBdXRvTGV2ZWwgIT09IC0xKSB7XG4gICAgICB2YXIgbmV4dExldmVsID0gTWF0aC5taW4odGhpcy5fbmV4dEF1dG9MZXZlbCxtYXhBdXRvTGV2ZWwpO1xuICAgICAgaWYgKG5leHRMZXZlbCA9PT0gdGhpcy5sYXN0ZmV0Y2hsZXZlbCkge1xuICAgICAgICB0aGlzLl9uZXh0QXV0b0xldmVsID0gLTE7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gbmV4dExldmVsO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGZvbGxvdyBhbGdvcml0aG0gY2FwdHVyZWQgZnJvbSBzdGFnZWZyaWdodCA6XG4gICAgLy8gaHR0cHM6Ly9hbmRyb2lkLmdvb2dsZXNvdXJjZS5jb20vcGxhdGZvcm0vZnJhbWV3b3Jrcy9hdi8rL21hc3Rlci9tZWRpYS9saWJzdGFnZWZyaWdodC9odHRwbGl2ZS9MaXZlU2Vzc2lvbi5jcHBcbiAgICAvLyBQaWNrIHRoZSBoaWdoZXN0IGJhbmR3aWR0aCBzdHJlYW0gYmVsb3cgb3IgZXF1YWwgdG8gZXN0aW1hdGVkIGJhbmR3aWR0aC5cbiAgICBmb3IgKGkgPSAwOyBpIDw9IG1heEF1dG9MZXZlbDsgaSsrKSB7XG4gICAgLy8gY29uc2lkZXIgb25seSA4MCUgb2YgdGhlIGF2YWlsYWJsZSBiYW5kd2lkdGgsIGJ1dCBpZiB3ZSBhcmUgc3dpdGNoaW5nIHVwLFxuICAgIC8vIGJlIGV2ZW4gbW9yZSBjb25zZXJ2YXRpdmUgKDcwJSkgdG8gYXZvaWQgb3ZlcmVzdGltYXRpbmcgYW5kIGltbWVkaWF0ZWx5XG4gICAgLy8gc3dpdGNoaW5nIGJhY2suXG4gICAgICBpZiAoaSA8PSB0aGlzLmxhc3RmZXRjaGxldmVsKSB7XG4gICAgICAgIGFkanVzdGVkYncgPSAwLjggKiBsYXN0Ync7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhZGp1c3RlZGJ3ID0gMC43ICogbGFzdGJ3O1xuICAgICAgfVxuICAgICAgaWYgKGFkanVzdGVkYncgPCBobHMubGV2ZWxzW2ldLmJpdHJhdGUpIHtcbiAgICAgICAgcmV0dXJuIE1hdGgubWF4KDAsIGkgLSAxKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGkgLSAxO1xuICB9XG5cbiAgc2V0IG5leHRBdXRvTGV2ZWwobmV4dExldmVsKSB7XG4gICAgdGhpcy5fbmV4dEF1dG9MZXZlbCA9IG5leHRMZXZlbDtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBBYnJDb250cm9sbGVyO1xuXG4iLCIvKlxuICogTGV2ZWwgQ29udHJvbGxlclxuKi9cblxuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgRXZlbnRIYW5kbGVyIGZyb20gJy4uL2V2ZW50LWhhbmRsZXInO1xuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcblxuY2xhc3MgTGV2ZWxDb250cm9sbGVyIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMpIHtcbiAgICBzdXBlcihobHMsXG4gICAgICBFdmVudC5NQU5JRkVTVF9MT0FERUQsXG4gICAgICBFdmVudC5MRVZFTF9MT0FERUQsXG4gICAgICBFdmVudC5FUlJPUik7XG4gICAgdGhpcy5vbnRpY2sgPSB0aGlzLnRpY2suYmluZCh0aGlzKTtcbiAgICB0aGlzLl9tYW51YWxMZXZlbCA9IHRoaXMuX2F1dG9MZXZlbENhcHBpbmcgPSAtMTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgaWYgKHRoaXMudGltZXIpIHtcbiAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnRpbWVyKTtcbiAgICB9XG4gICAgdGhpcy5fbWFudWFsTGV2ZWwgPSAtMTtcbiAgfVxuXG4gIG9uTWFuaWZlc3RMb2FkZWQoZGF0YSkge1xuICAgIHZhciBsZXZlbHMwID0gW10sIGxldmVscyA9IFtdLCBiaXRyYXRlU3RhcnQsIGksIGJpdHJhdGVTZXQgPSB7fSwgdmlkZW9Db2RlY0ZvdW5kID0gZmFsc2UsIGF1ZGlvQ29kZWNGb3VuZCA9IGZhbHNlLCBobHMgPSB0aGlzLmhscztcblxuICAgIC8vIHJlZ3JvdXAgcmVkdW5kYW50IGxldmVsIHRvZ2V0aGVyXG4gICAgZGF0YS5sZXZlbHMuZm9yRWFjaChsZXZlbCA9PiB7XG4gICAgICBpZihsZXZlbC52aWRlb0NvZGVjKSB7XG4gICAgICAgIHZpZGVvQ29kZWNGb3VuZCA9IHRydWU7XG4gICAgICB9XG4gICAgICBpZihsZXZlbC5hdWRpb0NvZGVjKSB7XG4gICAgICAgIGF1ZGlvQ29kZWNGb3VuZCA9IHRydWU7XG4gICAgICB9XG4gICAgICB2YXIgcmVkdW5kYW50TGV2ZWxJZCA9IGJpdHJhdGVTZXRbbGV2ZWwuYml0cmF0ZV07XG4gICAgICBpZiAocmVkdW5kYW50TGV2ZWxJZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGJpdHJhdGVTZXRbbGV2ZWwuYml0cmF0ZV0gPSBsZXZlbHMwLmxlbmd0aDtcbiAgICAgICAgbGV2ZWwudXJsID0gW2xldmVsLnVybF07XG4gICAgICAgIGxldmVsLnVybElkID0gMDtcbiAgICAgICAgbGV2ZWxzMC5wdXNoKGxldmVsKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxldmVsczBbcmVkdW5kYW50TGV2ZWxJZF0udXJsLnB1c2gobGV2ZWwudXJsKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIHJlbW92ZSBhdWRpby1vbmx5IGxldmVsIGlmIHdlIGFsc28gaGF2ZSBsZXZlbHMgd2l0aCBhdWRpbyt2aWRlbyBjb2RlY3Mgc2lnbmFsbGVkXG4gICAgaWYodmlkZW9Db2RlY0ZvdW5kICYmIGF1ZGlvQ29kZWNGb3VuZCkge1xuICAgICAgbGV2ZWxzMC5mb3JFYWNoKGxldmVsID0+IHtcbiAgICAgICAgaWYobGV2ZWwudmlkZW9Db2RlYykge1xuICAgICAgICAgIGxldmVscy5wdXNoKGxldmVsKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldmVscyA9IGxldmVsczA7XG4gICAgfVxuXG4gICAgLy8gb25seSBrZWVwIGxldmVsIHdpdGggc3VwcG9ydGVkIGF1ZGlvL3ZpZGVvIGNvZGVjc1xuICAgIGxldmVscyA9IGxldmVscy5maWx0ZXIoZnVuY3Rpb24obGV2ZWwpIHtcbiAgICAgIHZhciBjaGVja1N1cHBvcnRlZCA9IGZ1bmN0aW9uKGNvZGVjKSB7IHJldHVybiBNZWRpYVNvdXJjZS5pc1R5cGVTdXBwb3J0ZWQoYHZpZGVvL21wNDtjb2RlY3M9JHtjb2RlY31gKTt9O1xuICAgICAgdmFyIGF1ZGlvQ29kZWMgPSBsZXZlbC5hdWRpb0NvZGVjLCB2aWRlb0NvZGVjID0gbGV2ZWwudmlkZW9Db2RlYztcblxuICAgICAgcmV0dXJuICghYXVkaW9Db2RlYyB8fCBjaGVja1N1cHBvcnRlZChhdWRpb0NvZGVjKSkgJiZcbiAgICAgICAgICAgICAoIXZpZGVvQ29kZWMgfHwgY2hlY2tTdXBwb3J0ZWQodmlkZW9Db2RlYykpO1xuICAgIH0pO1xuXG4gICAgaWYobGV2ZWxzLmxlbmd0aCkge1xuICAgICAgLy8gc3RhcnQgYml0cmF0ZSBpcyB0aGUgZmlyc3QgYml0cmF0ZSBvZiB0aGUgbWFuaWZlc3RcbiAgICAgIGJpdHJhdGVTdGFydCA9IGxldmVsc1swXS5iaXRyYXRlO1xuICAgICAgLy8gc29ydCBsZXZlbCBvbiBiaXRyYXRlXG4gICAgICBsZXZlbHMuc29ydChmdW5jdGlvbiAoYSwgYikge1xuICAgICAgICByZXR1cm4gYS5iaXRyYXRlIC0gYi5iaXRyYXRlO1xuICAgICAgfSk7XG4gICAgICB0aGlzLl9sZXZlbHMgPSBsZXZlbHM7XG4gICAgICAvLyBmaW5kIGluZGV4IG9mIGZpcnN0IGxldmVsIGluIHNvcnRlZCBsZXZlbHNcbiAgICAgIGZvciAoaSA9IDA7IGkgPCBsZXZlbHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKGxldmVsc1tpXS5iaXRyYXRlID09PSBiaXRyYXRlU3RhcnQpIHtcbiAgICAgICAgICB0aGlzLl9maXJzdExldmVsID0gaTtcbiAgICAgICAgICBsb2dnZXIubG9nKGBtYW5pZmVzdCBsb2FkZWQsJHtsZXZlbHMubGVuZ3RofSBsZXZlbChzKSBmb3VuZCwgZmlyc3QgYml0cmF0ZToke2JpdHJhdGVTdGFydH1gKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuTUFOSUZFU1RfUEFSU0VELCB7bGV2ZWxzOiB0aGlzLl9sZXZlbHMsIGZpcnN0TGV2ZWw6IHRoaXMuX2ZpcnN0TGV2ZWwsIHN0YXRzOiBkYXRhLnN0YXRzfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5ORVRXT1JLX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuTUFOSUZFU1RfUEFSU0lOR19FUlJPUiwgZmF0YWw6IHRydWUsIHVybDogaGxzLnVybCwgcmVhc29uOiAnbm8gY29tcGF0aWJsZSBsZXZlbCBmb3VuZCBpbiBtYW5pZmVzdCd9KTtcbiAgICB9XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgZ2V0IGxldmVscygpIHtcbiAgICByZXR1cm4gdGhpcy5fbGV2ZWxzO1xuICB9XG5cbiAgZ2V0IGxldmVsKCkge1xuICAgIHJldHVybiB0aGlzLl9sZXZlbDtcbiAgfVxuXG4gIHNldCBsZXZlbChuZXdMZXZlbCkge1xuICAgIGlmICh0aGlzLl9sZXZlbCAhPT0gbmV3TGV2ZWwgfHwgdGhpcy5fbGV2ZWxzW25ld0xldmVsXS5kZXRhaWxzID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMuc2V0TGV2ZWxJbnRlcm5hbChuZXdMZXZlbCk7XG4gICAgfVxuICB9XG5cbiBzZXRMZXZlbEludGVybmFsKG5ld0xldmVsKSB7XG4gICAgLy8gY2hlY2sgaWYgbGV2ZWwgaWR4IGlzIHZhbGlkXG4gICAgaWYgKG5ld0xldmVsID49IDAgJiYgbmV3TGV2ZWwgPCB0aGlzLl9sZXZlbHMubGVuZ3RoKSB7XG4gICAgICAvLyBzdG9wcGluZyBsaXZlIHJlbG9hZGluZyB0aW1lciBpZiBhbnlcbiAgICAgIGlmICh0aGlzLnRpbWVyKSB7XG4gICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnRpbWVyKTtcbiAgICAgICB0aGlzLnRpbWVyID0gbnVsbDtcbiAgICAgIH1cbiAgICAgIHRoaXMuX2xldmVsID0gbmV3TGV2ZWw7XG4gICAgICBsb2dnZXIubG9nKGBzd2l0Y2hpbmcgdG8gbGV2ZWwgJHtuZXdMZXZlbH1gKTtcbiAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuTEVWRUxfU1dJVENILCB7bGV2ZWw6IG5ld0xldmVsfSk7XG4gICAgICB2YXIgbGV2ZWwgPSB0aGlzLl9sZXZlbHNbbmV3TGV2ZWxdO1xuICAgICAgIC8vIGNoZWNrIGlmIHdlIG5lZWQgdG8gbG9hZCBwbGF5bGlzdCBmb3IgdGhpcyBsZXZlbFxuICAgICAgaWYgKGxldmVsLmRldGFpbHMgPT09IHVuZGVmaW5lZCB8fCBsZXZlbC5kZXRhaWxzLmxpdmUgPT09IHRydWUpIHtcbiAgICAgICAgLy8gbGV2ZWwgbm90IHJldHJpZXZlZCB5ZXQsIG9yIGxpdmUgcGxheWxpc3Qgd2UgbmVlZCB0byAocmUpbG9hZCBpdFxuICAgICAgICBsb2dnZXIubG9nKGAocmUpbG9hZGluZyBwbGF5bGlzdCBmb3IgbGV2ZWwgJHtuZXdMZXZlbH1gKTtcbiAgICAgICAgdmFyIHVybElkID0gbGV2ZWwudXJsSWQ7XG4gICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuTEVWRUxfTE9BRElORywge3VybDogbGV2ZWwudXJsW3VybElkXSwgbGV2ZWw6IG5ld0xldmVsLCBpZDogdXJsSWR9KTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gaW52YWxpZCBsZXZlbCBpZCBnaXZlbiwgdHJpZ2dlciBlcnJvclxuICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGUgOiBFcnJvclR5cGVzLk9USEVSX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuTEVWRUxfU1dJVENIX0VSUk9SLCBsZXZlbDogbmV3TGV2ZWwsIGZhdGFsOiBmYWxzZSwgcmVhc29uOiAnaW52YWxpZCBsZXZlbCBpZHgnfSk7XG4gICAgfVxuIH1cblxuICBnZXQgbWFudWFsTGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuX21hbnVhbExldmVsO1xuICB9XG5cbiAgc2V0IG1hbnVhbExldmVsKG5ld0xldmVsKSB7XG4gICAgdGhpcy5fbWFudWFsTGV2ZWwgPSBuZXdMZXZlbDtcbiAgICBpZiAobmV3TGV2ZWwgIT09IC0xKSB7XG4gICAgICB0aGlzLmxldmVsID0gbmV3TGV2ZWw7XG4gICAgfVxuICB9XG5cbiAgZ2V0IGZpcnN0TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2ZpcnN0TGV2ZWw7XG4gIH1cblxuICBzZXQgZmlyc3RMZXZlbChuZXdMZXZlbCkge1xuICAgIHRoaXMuX2ZpcnN0TGV2ZWwgPSBuZXdMZXZlbDtcbiAgfVxuXG4gIGdldCBzdGFydExldmVsKCkge1xuICAgIGlmICh0aGlzLl9zdGFydExldmVsID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB0aGlzLl9maXJzdExldmVsO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdGhpcy5fc3RhcnRMZXZlbDtcbiAgICB9XG4gIH1cblxuICBzZXQgc3RhcnRMZXZlbChuZXdMZXZlbCkge1xuICAgIHRoaXMuX3N0YXJ0TGV2ZWwgPSBuZXdMZXZlbDtcbiAgfVxuXG4gIG9uRXJyb3IoZGF0YSkge1xuICAgIGlmKGRhdGEuZmF0YWwpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgZGV0YWlscyA9IGRhdGEuZGV0YWlscywgaGxzID0gdGhpcy5obHMsIGxldmVsSWQsIGxldmVsO1xuICAgIC8vIHRyeSB0byByZWNvdmVyIG5vdCBmYXRhbCBlcnJvcnNcbiAgICBzd2l0Y2goZGV0YWlscykge1xuICAgICAgY2FzZSBFcnJvckRldGFpbHMuRlJBR19MT0FEX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuRlJBR19MT0FEX1RJTUVPVVQ6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5GUkFHX0xPT1BfTE9BRElOR19FUlJPUjpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLktFWV9MT0FEX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuS0VZX0xPQURfVElNRU9VVDpcbiAgICAgICAgIGxldmVsSWQgPSBkYXRhLmZyYWcubGV2ZWw7XG4gICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkxFVkVMX0xPQURfRVJST1I6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5MRVZFTF9MT0FEX1RJTUVPVVQ6XG4gICAgICAgIGxldmVsSWQgPSBkYXRhLmxldmVsO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICAvKiB0cnkgdG8gc3dpdGNoIHRvIGEgcmVkdW5kYW50IHN0cmVhbSBpZiBhbnkgYXZhaWxhYmxlLlxuICAgICAqIGlmIG5vIHJlZHVuZGFudCBzdHJlYW0gYXZhaWxhYmxlLCBlbWVyZ2VuY3kgc3dpdGNoIGRvd24gKGlmIGluIGF1dG8gbW9kZSBhbmQgY3VycmVudCBsZXZlbCBub3QgMClcbiAgICAgKiBvdGhlcndpc2UsIHdlIGNhbm5vdCByZWNvdmVyIHRoaXMgbmV0d29yayBlcnJvciAuLi5cbiAgICAgKiBkb24ndCByYWlzZSBGUkFHX0xPQURfRVJST1IgYW5kIEZSQUdfTE9BRF9USU1FT1VUIGFzIGZhdGFsLCBhcyBpdCBpcyBoYW5kbGVkIGJ5IG1lZGlhQ29udHJvbGxlclxuICAgICAqL1xuICAgIGlmIChsZXZlbElkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGxldmVsID0gdGhpcy5fbGV2ZWxzW2xldmVsSWRdO1xuICAgICAgaWYgKGxldmVsLnVybElkIDwgKGxldmVsLnVybC5sZW5ndGggLSAxKSkge1xuICAgICAgICBsZXZlbC51cmxJZCsrO1xuICAgICAgICBsZXZlbC5kZXRhaWxzID0gdW5kZWZpbmVkO1xuICAgICAgICBsb2dnZXIud2FybihgbGV2ZWwgY29udHJvbGxlciwke2RldGFpbHN9IGZvciBsZXZlbCAke2xldmVsSWR9OiBzd2l0Y2hpbmcgdG8gcmVkdW5kYW50IHN0cmVhbSBpZCAke2xldmVsLnVybElkfWApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gd2UgY291bGQgdHJ5IHRvIHJlY292ZXIgaWYgaW4gYXV0byBtb2RlIGFuZCBjdXJyZW50IGxldmVsIG5vdCBsb3dlc3QgbGV2ZWwgKDApXG4gICAgICAgIGxldCByZWNvdmVyYWJsZSA9ICgodGhpcy5fbWFudWFsTGV2ZWwgPT09IC0xKSAmJiBsZXZlbElkKTtcbiAgICAgICAgaWYgKHJlY292ZXJhYmxlKSB7XG4gICAgICAgICAgbG9nZ2VyLndhcm4oYGxldmVsIGNvbnRyb2xsZXIsJHtkZXRhaWxzfTogZW1lcmdlbmN5IHN3aXRjaC1kb3duIGZvciBuZXh0IGZyYWdtZW50YCk7XG4gICAgICAgICAgaGxzLmFickNvbnRyb2xsZXIubmV4dEF1dG9MZXZlbCA9IDA7XG4gICAgICAgIH0gZWxzZSBpZihsZXZlbCAmJiBsZXZlbC5kZXRhaWxzICYmIGxldmVsLmRldGFpbHMubGl2ZSkge1xuICAgICAgICAgIGxvZ2dlci53YXJuKGBsZXZlbCBjb250cm9sbGVyLCR7ZGV0YWlsc30gb24gbGl2ZSBzdHJlYW0sIGRpc2NhcmRgKTtcbiAgICAgICAgLy8gRlJBR19MT0FEX0VSUk9SIGFuZCBGUkFHX0xPQURfVElNRU9VVCBhcmUgaGFuZGxlZCBieSBtZWRpYUNvbnRyb2xsZXJcbiAgICAgICAgfSBlbHNlIGlmIChkZXRhaWxzICE9PSBFcnJvckRldGFpbHMuRlJBR19MT0FEX0VSUk9SICYmIGRldGFpbHMgIT09IEVycm9yRGV0YWlscy5GUkFHX0xPQURfVElNRU9VVCkge1xuICAgICAgICAgIGxvZ2dlci5lcnJvcihgY2Fubm90IHJlY292ZXIgJHtkZXRhaWxzfSBlcnJvcmApO1xuICAgICAgICAgIHRoaXMuX2xldmVsID0gdW5kZWZpbmVkO1xuICAgICAgICAgIC8vIHN0b3BwaW5nIGxpdmUgcmVsb2FkaW5nIHRpbWVyIGlmIGFueVxuICAgICAgICAgIGlmICh0aGlzLnRpbWVyKSB7XG4gICAgICAgICAgICBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgICAgICAgICAgdGhpcy50aW1lciA9IG51bGw7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIHJlZGlzcGF0Y2ggc2FtZSBlcnJvciBidXQgd2l0aCBmYXRhbCBzZXQgdG8gdHJ1ZVxuICAgICAgICAgIGRhdGEuZmF0YWwgPSB0cnVlO1xuICAgICAgICAgIGhscy50cmlnZ2VyKGV2ZW50LCBkYXRhKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIG9uTGV2ZWxMb2FkZWQoZGF0YSkge1xuICAgIC8vIGNoZWNrIGlmIGN1cnJlbnQgcGxheWxpc3QgaXMgYSBsaXZlIHBsYXlsaXN0XG4gICAgaWYgKGRhdGEuZGV0YWlscy5saXZlICYmICF0aGlzLnRpbWVyKSB7XG4gICAgICAvLyBpZiBsaXZlIHBsYXlsaXN0IHdlIHdpbGwgaGF2ZSB0byByZWxvYWQgaXQgcGVyaW9kaWNhbGx5XG4gICAgICAvLyBzZXQgcmVsb2FkIHBlcmlvZCB0byBwbGF5bGlzdCB0YXJnZXQgZHVyYXRpb25cbiAgICAgIHRoaXMudGltZXIgPSBzZXRJbnRlcnZhbCh0aGlzLm9udGljaywgMTAwMCAqIGRhdGEuZGV0YWlscy50YXJnZXRkdXJhdGlvbik7XG4gICAgfVxuICAgIGlmICghZGF0YS5kZXRhaWxzLmxpdmUgJiYgdGhpcy50aW1lcikge1xuICAgICAgLy8gcGxheWxpc3QgaXMgbm90IGxpdmUgYW5kIHRpbWVyIGlzIGFybWVkIDogc3RvcHBpbmcgaXRcbiAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy50aW1lcik7XG4gICAgICB0aGlzLnRpbWVyID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICB0aWNrKCkge1xuICAgIHZhciBsZXZlbElkID0gdGhpcy5fbGV2ZWw7XG4gICAgaWYgKGxldmVsSWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdmFyIGxldmVsID0gdGhpcy5fbGV2ZWxzW2xldmVsSWRdLCB1cmxJZCA9IGxldmVsLnVybElkO1xuICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5MRVZFTF9MT0FESU5HLCB7dXJsOiBsZXZlbC51cmxbdXJsSWRdLCBsZXZlbDogbGV2ZWxJZCwgaWQ6IHVybElkfSk7XG4gICAgfVxuICB9XG5cbiAgbmV4dExvYWRMZXZlbCgpIHtcbiAgICBpZiAodGhpcy5fbWFudWFsTGV2ZWwgIT09IC0xKSB7XG4gICAgICByZXR1cm4gdGhpcy5fbWFudWFsTGV2ZWw7XG4gICAgfSBlbHNlIHtcbiAgICAgcmV0dXJuIHRoaXMuaGxzLmFickNvbnRyb2xsZXIubmV4dEF1dG9MZXZlbDtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTGV2ZWxDb250cm9sbGVyO1xuXG4iLCIvKlxuICogTVNFIE1lZGlhIENvbnRyb2xsZXJcbiovXG5cbmltcG9ydCBEZW11eGVyIGZyb20gJy4uL2RlbXV4L2RlbXV4ZXInO1xuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgRXZlbnRIYW5kbGVyIGZyb20gJy4uL2V2ZW50LWhhbmRsZXInO1xuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQgQmluYXJ5U2VhcmNoIGZyb20gJy4uL3V0aWxzL2JpbmFyeS1zZWFyY2gnO1xuaW1wb3J0IExldmVsSGVscGVyIGZyb20gJy4uL2hlbHBlci9sZXZlbC1oZWxwZXInO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5cbmNvbnN0IFN0YXRlID0ge1xuICBFUlJPUiA6IC0yLFxuICBTVEFSVElORyA6IC0xLFxuICBJRExFIDogMCxcbiAgS0VZX0xPQURJTkcgOiAxLFxuICBGUkFHX0xPQURJTkcgOiAyLFxuICBGUkFHX0xPQURJTkdfV0FJVElOR19SRVRSWSA6IDMsXG4gIFdBSVRJTkdfTEVWRUwgOiA0LFxuICBQQVJTSU5HIDogNSxcbiAgUEFSU0VEIDogNixcbiAgQVBQRU5ESU5HIDogNyxcbiAgQlVGRkVSX0ZMVVNISU5HIDogOCxcbiAgRU5ERUQgOiA5XG59O1xuXG5jbGFzcyBNU0VNZWRpYUNvbnRyb2xsZXIgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHN1cGVyKGhscywgRXZlbnQuTUVESUFfQVRUQUNISU5HLFxuICAgICAgRXZlbnQuTUVESUFfREVUQUNISU5HLFxuICAgICAgRXZlbnQuTUFOSUZFU1RfUEFSU0VELFxuICAgICAgRXZlbnQuTEVWRUxfTE9BREVELFxuICAgICAgRXZlbnQuS0VZX0xPQURFRCxcbiAgICAgIEV2ZW50LkZSQUdfTE9BREVELFxuICAgICAgRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCxcbiAgICAgIEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLFxuICAgICAgRXZlbnQuRlJBR19QQVJTRUQsXG4gICAgICBFdmVudC5FUlJPUik7XG4gICAgdGhpcy5jb25maWcgPSBobHMuY29uZmlnO1xuICAgIHRoaXMuYXVkaW9Db2RlY1N3YXAgPSBmYWxzZTtcbiAgICB0aGlzLnRpY2tzID0gMDtcbiAgICAvLyBTb3VyY2UgQnVmZmVyIGxpc3RlbmVyc1xuICAgIHRoaXMub25zYnVlID0gdGhpcy5vblNCVXBkYXRlRW5kLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbnNiZSAgPSB0aGlzLm9uU0JVcGRhdGVFcnJvci5iaW5kKHRoaXMpO1xuICAgIHRoaXMub250aWNrID0gdGhpcy50aWNrLmJpbmQodGhpcyk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIHRoaXMuc3RvcCgpO1xuICAgIEV2ZW50SGFuZGxlci5wcm90b3R5cGUuZGVzdHJveS5jYWxsKHRoaXMpO1xuICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICB9XG5cbiAgc3RhcnRMb2FkKCkge1xuICAgIGlmICh0aGlzLmxldmVscyAmJiB0aGlzLm1lZGlhKSB7XG4gICAgICB0aGlzLnN0YXJ0SW50ZXJuYWwoKTtcbiAgICAgIGlmICh0aGlzLmxhc3RDdXJyZW50VGltZSkge1xuICAgICAgICBsb2dnZXIubG9nKGBzZWVraW5nIEAgJHt0aGlzLmxhc3RDdXJyZW50VGltZX1gKTtcbiAgICAgICAgaWYgKCF0aGlzLmxhc3RQYXVzZWQpIHtcbiAgICAgICAgICBsb2dnZXIubG9nKCdyZXN1bWluZyB2aWRlbycpO1xuICAgICAgICAgIHRoaXMubWVkaWEucGxheSgpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5sYXN0Q3VycmVudFRpbWUgPSAwO1xuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuU1RBUlRJTkc7XG4gICAgICB9XG4gICAgICB0aGlzLm5leHRMb2FkUG9zaXRpb24gPSB0aGlzLnN0YXJ0UG9zaXRpb24gPSB0aGlzLmxhc3RDdXJyZW50VGltZTtcbiAgICAgIHRoaXMudGljaygpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsb2dnZXIud2FybignY2Fubm90IHN0YXJ0IGxvYWRpbmcgYXMgZWl0aGVyIG1hbmlmZXN0IG5vdCBwYXJzZWQgb3IgdmlkZW8gbm90IGF0dGFjaGVkJyk7XG4gICAgfVxuICB9XG5cbiAgc3RhcnRJbnRlcm5hbCgpIHtcbiAgICB2YXIgaGxzID0gdGhpcy5obHM7XG4gICAgdGhpcy5zdG9wKCk7XG4gICAgdGhpcy5kZW11eGVyID0gbmV3IERlbXV4ZXIoaGxzKTtcbiAgICB0aGlzLnRpbWVyID0gc2V0SW50ZXJ2YWwodGhpcy5vbnRpY2ssIDEwMCk7XG4gICAgdGhpcy5sZXZlbCA9IC0xO1xuICAgIHRoaXMuZnJhZ0xvYWRFcnJvciA9IDA7XG4gIH1cblxuICBzdG9wKCkge1xuICAgIHRoaXMubXA0c2VnbWVudHMgPSBbXTtcbiAgICB0aGlzLmZsdXNoUmFuZ2UgPSBbXTtcbiAgICB0aGlzLmJ1ZmZlclJhbmdlID0gW107XG4gICAgdGhpcy5zdGFsbGVkID0gZmFsc2U7XG4gICAgdmFyIGZyYWcgPSB0aGlzLmZyYWdDdXJyZW50O1xuICAgIGlmIChmcmFnKSB7XG4gICAgICBpZiAoZnJhZy5sb2FkZXIpIHtcbiAgICAgICAgZnJhZy5sb2FkZXIuYWJvcnQoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuZnJhZ0N1cnJlbnQgPSBudWxsO1xuICAgIH1cbiAgICB0aGlzLmZyYWdQcmV2aW91cyA9IG51bGw7XG4gICAgaWYgKHRoaXMuc291cmNlQnVmZmVyKSB7XG4gICAgICBmb3IodmFyIHR5cGUgaW4gdGhpcy5zb3VyY2VCdWZmZXIpIHtcbiAgICAgICAgdmFyIHNiID0gdGhpcy5zb3VyY2VCdWZmZXJbdHlwZV07XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdGhpcy5tZWRpYVNvdXJjZS5yZW1vdmVTb3VyY2VCdWZmZXIoc2IpO1xuICAgICAgICAgIHNiLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3VwZGF0ZWVuZCcsIHRoaXMub25zYnVlKTtcbiAgICAgICAgICBzYi5yZW1vdmVFdmVudExpc3RlbmVyKCdlcnJvcicsIHRoaXMub25zYmUpO1xuICAgICAgICB9IGNhdGNoKGVycikge1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLnNvdXJjZUJ1ZmZlciA9IG51bGw7XG4gICAgfVxuICAgIGlmICh0aGlzLnRpbWVyKSB7XG4gICAgICBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgICAgdGhpcy50aW1lciA9IG51bGw7XG4gICAgfVxuICAgIGlmICh0aGlzLmRlbXV4ZXIpIHtcbiAgICAgIHRoaXMuZGVtdXhlci5kZXN0cm95KCk7XG4gICAgICB0aGlzLmRlbXV4ZXIgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIHRpY2soKSB7XG4gICAgdGhpcy50aWNrcysrO1xuICAgIGlmICh0aGlzLnRpY2tzID09PSAxKSB7XG4gICAgICB0aGlzLmRvVGljaygpO1xuICAgICAgaWYgKHRoaXMudGlja3MgPiAxKSB7XG4gICAgICAgIHNldFRpbWVvdXQodGhpcy50aWNrLCAxKTtcbiAgICAgIH1cbiAgICAgIHRoaXMudGlja3MgPSAwO1xuICAgIH1cbiAgfVxuXG4gIGRvVGljaygpIHtcbiAgICB2YXIgcG9zLCBsZXZlbCwgbGV2ZWxEZXRhaWxzLCBobHMgPSB0aGlzLmhscztcbiAgICBzd2l0Y2godGhpcy5zdGF0ZSkge1xuICAgICAgY2FzZSBTdGF0ZS5FUlJPUjpcbiAgICAgICAgLy9kb24ndCBkbyBhbnl0aGluZyBpbiBlcnJvciBzdGF0ZSB0byBhdm9pZCBicmVha2luZyBmdXJ0aGVyIC4uLlxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgU3RhdGUuU1RBUlRJTkc6XG4gICAgICAgIC8vIGRldGVybWluZSBsb2FkIGxldmVsXG4gICAgICAgIHRoaXMuc3RhcnRMZXZlbCA9IGhscy5zdGFydExldmVsO1xuICAgICAgICBpZiAodGhpcy5zdGFydExldmVsID09PSAtMSkge1xuICAgICAgICAgIC8vIC0xIDogZ3Vlc3Mgc3RhcnQgTGV2ZWwgYnkgZG9pbmcgYSBiaXRyYXRlIHRlc3QgYnkgbG9hZGluZyBmaXJzdCBmcmFnbWVudCBvZiBsb3dlc3QgcXVhbGl0eSBsZXZlbFxuICAgICAgICAgIHRoaXMuc3RhcnRMZXZlbCA9IDA7XG4gICAgICAgICAgdGhpcy5mcmFnQml0cmF0ZVRlc3QgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIC8vIHNldCBuZXcgbGV2ZWwgdG8gcGxheWxpc3QgbG9hZGVyIDogdGhpcyB3aWxsIHRyaWdnZXIgc3RhcnQgbGV2ZWwgbG9hZFxuICAgICAgICB0aGlzLmxldmVsID0gaGxzLm5leHRMb2FkTGV2ZWwgPSB0aGlzLnN0YXJ0TGV2ZWw7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5XQUlUSU5HX0xFVkVMO1xuICAgICAgICB0aGlzLmxvYWRlZG1ldGFkYXRhID0gZmFsc2U7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBTdGF0ZS5JRExFOlxuICAgICAgICAvLyBpZiB2aWRlbyBkZXRhY2hlZCBvciB1bmJvdW5kIGV4aXQgbG9vcFxuICAgICAgICBpZiAoIXRoaXMubWVkaWEpIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICAvLyBkZXRlcm1pbmUgbmV4dCBjYW5kaWRhdGUgZnJhZ21lbnQgdG8gYmUgbG9hZGVkLCBiYXNlZCBvbiBjdXJyZW50IHBvc2l0aW9uIGFuZFxuICAgICAgICAvLyAgZW5kIG9mIGJ1ZmZlciBwb3NpdGlvblxuICAgICAgICAvLyAgZW5zdXJlIDYwcyBvZiBidWZmZXIgdXBmcm9udFxuICAgICAgICAvLyBpZiB3ZSBoYXZlIG5vdCB5ZXQgbG9hZGVkIGFueSBmcmFnbWVudCwgc3RhcnQgbG9hZGluZyBmcm9tIHN0YXJ0IHBvc2l0aW9uXG4gICAgICAgIGlmICh0aGlzLmxvYWRlZG1ldGFkYXRhKSB7XG4gICAgICAgICAgcG9zID0gdGhpcy5tZWRpYS5jdXJyZW50VGltZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwb3MgPSB0aGlzLm5leHRMb2FkUG9zaXRpb247XG4gICAgICAgIH1cbiAgICAgICAgLy8gZGV0ZXJtaW5lIG5leHQgbG9hZCBsZXZlbFxuICAgICAgICBpZiAodGhpcy5zdGFydEZyYWdtZW50UmVxdWVzdGVkID09PSBmYWxzZSkge1xuICAgICAgICAgIGxldmVsID0gdGhpcy5zdGFydExldmVsO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIHdlIGFyZSBub3QgYXQgcGxheWJhY2sgc3RhcnQsIGdldCBuZXh0IGxvYWQgbGV2ZWwgZnJvbSBsZXZlbCBDb250cm9sbGVyXG4gICAgICAgICAgbGV2ZWwgPSBobHMubmV4dExvYWRMZXZlbDtcbiAgICAgICAgfVxuICAgICAgICB2YXIgYnVmZmVySW5mbyA9IHRoaXMuYnVmZmVySW5mbyhwb3MsdGhpcy5jb25maWcubWF4QnVmZmVySG9sZSksXG4gICAgICAgICAgICBidWZmZXJMZW4gPSBidWZmZXJJbmZvLmxlbixcbiAgICAgICAgICAgIGJ1ZmZlckVuZCA9IGJ1ZmZlckluZm8uZW5kLFxuICAgICAgICAgICAgZnJhZ1ByZXZpb3VzID0gdGhpcy5mcmFnUHJldmlvdXMsXG4gICAgICAgICAgICBtYXhCdWZMZW47XG4gICAgICAgIC8vIGNvbXB1dGUgbWF4IEJ1ZmZlciBMZW5ndGggdGhhdCB3ZSBjb3VsZCBnZXQgZnJvbSB0aGlzIGxvYWQgbGV2ZWwsIGJhc2VkIG9uIGxldmVsIGJpdHJhdGUuIGRvbid0IGJ1ZmZlciBtb3JlIHRoYW4gNjAgTUIgYW5kIG1vcmUgdGhhbiAzMHNcbiAgICAgICAgaWYgKCh0aGlzLmxldmVsc1tsZXZlbF0pLmhhc093blByb3BlcnR5KCdiaXRyYXRlJykpIHtcbiAgICAgICAgICBtYXhCdWZMZW4gPSBNYXRoLm1heCg4ICogdGhpcy5jb25maWcubWF4QnVmZmVyU2l6ZSAvIHRoaXMubGV2ZWxzW2xldmVsXS5iaXRyYXRlLCB0aGlzLmNvbmZpZy5tYXhCdWZmZXJMZW5ndGgpO1xuICAgICAgICAgIG1heEJ1ZkxlbiA9IE1hdGgubWluKG1heEJ1ZkxlbiwgdGhpcy5jb25maWcubWF4TWF4QnVmZmVyTGVuZ3RoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBtYXhCdWZMZW4gPSB0aGlzLmNvbmZpZy5tYXhCdWZmZXJMZW5ndGg7XG4gICAgICAgIH1cbiAgICAgICAgLy8gaWYgYnVmZmVyIGxlbmd0aCBpcyBsZXNzIHRoYW4gbWF4QnVmTGVuIHRyeSB0byBsb2FkIGEgbmV3IGZyYWdtZW50XG4gICAgICAgIGlmIChidWZmZXJMZW4gPCBtYXhCdWZMZW4pIHtcbiAgICAgICAgICAvLyBzZXQgbmV4dCBsb2FkIGxldmVsIDogdGhpcyB3aWxsIHRyaWdnZXIgYSBwbGF5bGlzdCBsb2FkIGlmIG5lZWRlZFxuICAgICAgICAgIGhscy5uZXh0TG9hZExldmVsID0gbGV2ZWw7XG4gICAgICAgICAgdGhpcy5sZXZlbCA9IGxldmVsO1xuICAgICAgICAgIGxldmVsRGV0YWlscyA9IHRoaXMubGV2ZWxzW2xldmVsXS5kZXRhaWxzO1xuICAgICAgICAgIC8vIGlmIGxldmVsIGluZm8gbm90IHJldHJpZXZlZCB5ZXQsIHN3aXRjaCBzdGF0ZSBhbmQgd2FpdCBmb3IgbGV2ZWwgcmV0cmlldmFsXG4gICAgICAgICAgLy8gaWYgbGl2ZSBwbGF5bGlzdCwgZW5zdXJlIHRoYXQgbmV3IHBsYXlsaXN0IGhhcyBiZWVuIHJlZnJlc2hlZCB0byBhdm9pZCBsb2FkaW5nL3RyeSB0byBsb2FkXG4gICAgICAgICAgLy8gYSB1c2VsZXNzIGFuZCBvdXRkYXRlZCBmcmFnbWVudCAodGhhdCBtaWdodCBldmVuIGludHJvZHVjZSBsb2FkIGVycm9yIGlmIGl0IGlzIGFscmVhZHkgb3V0IG9mIHRoZSBsaXZlIHBsYXlsaXN0KVxuICAgICAgICAgIGlmICh0eXBlb2YgbGV2ZWxEZXRhaWxzID09PSAndW5kZWZpbmVkJyB8fCBsZXZlbERldGFpbHMubGl2ZSAmJiB0aGlzLmxldmVsTGFzdExvYWRlZCAhPT0gbGV2ZWwpIHtcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5XQUlUSU5HX0xFVkVMO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIGZpbmQgZnJhZ21lbnQgaW5kZXgsIGNvbnRpZ3VvdXMgd2l0aCBlbmQgb2YgYnVmZmVyIHBvc2l0aW9uXG4gICAgICAgICAgbGV0IGZyYWdtZW50cyA9IGxldmVsRGV0YWlscy5mcmFnbWVudHMsXG4gICAgICAgICAgICAgIGZyYWdMZW4gPSBmcmFnbWVudHMubGVuZ3RoLFxuICAgICAgICAgICAgICBzdGFydCA9IGZyYWdtZW50c1swXS5zdGFydCxcbiAgICAgICAgICAgICAgZW5kID0gZnJhZ21lbnRzW2ZyYWdMZW4tMV0uc3RhcnQgKyBmcmFnbWVudHNbZnJhZ0xlbi0xXS5kdXJhdGlvbixcbiAgICAgICAgICAgICAgZnJhZztcblxuICAgICAgICAgICAgLy8gaW4gY2FzZSBvZiBsaXZlIHBsYXlsaXN0IHdlIG5lZWQgdG8gZW5zdXJlIHRoYXQgcmVxdWVzdGVkIHBvc2l0aW9uIGlzIG5vdCBsb2NhdGVkIGJlZm9yZSBwbGF5bGlzdCBzdGFydFxuICAgICAgICAgIGlmIChsZXZlbERldGFpbHMubGl2ZSkge1xuICAgICAgICAgICAgLy8gY2hlY2sgaWYgcmVxdWVzdGVkIHBvc2l0aW9uIGlzIHdpdGhpbiBzZWVrYWJsZSBib3VuZGFyaWVzIDpcbiAgICAgICAgICAgIC8vbG9nZ2VyLmxvZyhgc3RhcnQvcG9zL2J1ZkVuZC9zZWVraW5nOiR7c3RhcnQudG9GaXhlZCgzKX0vJHtwb3MudG9GaXhlZCgzKX0vJHtidWZmZXJFbmQudG9GaXhlZCgzKX0vJHt0aGlzLm1lZGlhLnNlZWtpbmd9YCk7XG4gICAgICAgICAgICBpZiAoYnVmZmVyRW5kIDwgTWF0aC5tYXgoc3RhcnQsZW5kLXRoaXMuY29uZmlnLmxpdmVNYXhMYXRlbmN5RHVyYXRpb25Db3VudCpsZXZlbERldGFpbHMudGFyZ2V0ZHVyYXRpb24pKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zZWVrQWZ0ZXJCdWZmZXJlZCA9IHN0YXJ0ICsgTWF0aC5tYXgoMCwgbGV2ZWxEZXRhaWxzLnRvdGFsZHVyYXRpb24gLSB0aGlzLmNvbmZpZy5saXZlU3luY0R1cmF0aW9uQ291bnQgKiBsZXZlbERldGFpbHMudGFyZ2V0ZHVyYXRpb24pO1xuICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYGJ1ZmZlciBlbmQ6ICR7YnVmZmVyRW5kfSBpcyBsb2NhdGVkIHRvbyBmYXIgZnJvbSB0aGUgZW5kIG9mIGxpdmUgc2xpZGluZyBwbGF5bGlzdCwgbWVkaWEgcG9zaXRpb24gd2lsbCBiZSByZXNldGVkIHRvOiAke3RoaXMuc2Vla0FmdGVyQnVmZmVyZWQudG9GaXhlZCgzKX1gKTtcbiAgICAgICAgICAgICAgICBidWZmZXJFbmQgPSB0aGlzLnNlZWtBZnRlckJ1ZmZlcmVkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRoaXMuc3RhcnRGcmFnbWVudFJlcXVlc3RlZCAmJiAhbGV2ZWxEZXRhaWxzLlBUU0tub3duKSB7XG4gICAgICAgICAgICAgIC8qIHdlIGFyZSBzd2l0Y2hpbmcgbGV2ZWwgb24gbGl2ZSBwbGF5bGlzdCwgYnV0IHdlIGRvbid0IGhhdmUgYW55IFBUUyBpbmZvIGZvciB0aGF0IHF1YWxpdHkgbGV2ZWwgLi4uXG4gICAgICAgICAgICAgICAgIHRyeSB0byBsb2FkIGZyYWcgbWF0Y2hpbmcgd2l0aCBuZXh0IFNOLlxuICAgICAgICAgICAgICAgICBldmVuIGlmIFNOIGFyZSBub3Qgc3luY2hyb25pemVkIGJldHdlZW4gcGxheWxpc3RzLCBsb2FkaW5nIHRoaXMgZnJhZyB3aWxsIGhlbHAgdXNcbiAgICAgICAgICAgICAgICAgY29tcHV0ZSBwbGF5bGlzdCBzbGlkaW5nIGFuZCBmaW5kIHRoZSByaWdodCBvbmUgYWZ0ZXIgaW4gY2FzZSBpdCB3YXMgbm90IHRoZSByaWdodCBjb25zZWN1dGl2ZSBvbmUgKi9cbiAgICAgICAgICAgICAgaWYgKGZyYWdQcmV2aW91cykge1xuICAgICAgICAgICAgICAgIHZhciB0YXJnZXRTTiA9IGZyYWdQcmV2aW91cy5zbiArIDE7XG4gICAgICAgICAgICAgICAgaWYgKHRhcmdldFNOID49IGxldmVsRGV0YWlscy5zdGFydFNOICYmIHRhcmdldFNOIDw9IGxldmVsRGV0YWlscy5lbmRTTikge1xuICAgICAgICAgICAgICAgICAgZnJhZyA9IGZyYWdtZW50c1t0YXJnZXRTTiAtIGxldmVsRGV0YWlscy5zdGFydFNOXTtcbiAgICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYGxpdmUgcGxheWxpc3QsIHN3aXRjaGluZyBwbGF5bGlzdCwgbG9hZCBmcmFnIHdpdGggbmV4dCBTTjogJHtmcmFnLnNufWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoIWZyYWcpIHtcbiAgICAgICAgICAgICAgICAvKiB3ZSBoYXZlIG5vIGlkZWEgYWJvdXQgd2hpY2ggZnJhZ21lbnQgc2hvdWxkIGJlIGxvYWRlZC5cbiAgICAgICAgICAgICAgICAgICBzbyBsZXQncyBsb2FkIG1pZCBmcmFnbWVudC4gaXQgd2lsbCBoZWxwIGNvbXB1dGluZyBwbGF5bGlzdCBzbGlkaW5nIGFuZCBmaW5kIHRoZSByaWdodCBvbmVcbiAgICAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgICAgIGZyYWcgPSBmcmFnbWVudHNbTWF0aC5taW4oZnJhZ0xlbiAtIDEsIE1hdGgucm91bmQoZnJhZ0xlbiAvIDIpKV07XG4gICAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgbGl2ZSBwbGF5bGlzdCwgc3dpdGNoaW5nIHBsYXlsaXN0LCB1bmtub3duLCBsb2FkIG1pZGRsZSBmcmFnIDogJHtmcmFnLnNufWApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIFZvRCBwbGF5bGlzdDogaWYgYnVmZmVyRW5kIGJlZm9yZSBzdGFydCBvZiBwbGF5bGlzdCwgbG9hZCBmaXJzdCBmcmFnbWVudFxuICAgICAgICAgICAgaWYgKGJ1ZmZlckVuZCA8IHN0YXJ0KSB7XG4gICAgICAgICAgICAgIGZyYWcgPSBmcmFnbWVudHNbMF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICghZnJhZykge1xuICAgICAgICAgICAgdmFyIGZvdW5kRnJhZztcbiAgICAgICAgICAgIGlmIChidWZmZXJFbmQgPCBlbmQpIHtcbiAgICAgICAgICAgICAgZm91bmRGcmFnID0gQmluYXJ5U2VhcmNoLnNlYXJjaChmcmFnbWVudHMsIChjYW5kaWRhdGUpID0+IHtcbiAgICAgICAgICAgICAgICAvL2xvZ2dlci5sb2coYGxldmVsL3NuL3N0YXJ0L2VuZC9idWZFbmQ6JHtsZXZlbH0vJHtjYW5kaWRhdGUuc259LyR7Y2FuZGlkYXRlLnN0YXJ0fS8keyhjYW5kaWRhdGUuc3RhcnQrY2FuZGlkYXRlLmR1cmF0aW9uKX0vJHtidWZmZXJFbmR9YCk7XG4gICAgICAgICAgICAgICAgLy8gb2Zmc2V0IHNob3VsZCBiZSB3aXRoaW4gZnJhZ21lbnQgYm91bmRhcnlcbiAgICAgICAgICAgICAgICBpZiAoKGNhbmRpZGF0ZS5zdGFydCArIGNhbmRpZGF0ZS5kdXJhdGlvbikgPD0gYnVmZmVyRW5kKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoY2FuZGlkYXRlLnN0YXJ0ID4gYnVmZmVyRW5kKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIHJlYWNoIGVuZCBvZiBwbGF5bGlzdFxuICAgICAgICAgICAgICBmb3VuZEZyYWcgPSBmcmFnbWVudHNbZnJhZ0xlbi0xXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChmb3VuZEZyYWcpIHtcbiAgICAgICAgICAgICAgZnJhZyA9IGZvdW5kRnJhZztcbiAgICAgICAgICAgICAgc3RhcnQgPSBmb3VuZEZyYWcuc3RhcnQ7XG4gICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnZmluZCBTTiBtYXRjaGluZyB3aXRoIHBvczonICsgIGJ1ZmZlckVuZCArICc6JyArIGZyYWcuc24pO1xuICAgICAgICAgICAgICBpZiAoZnJhZ1ByZXZpb3VzICYmIGZyYWcubGV2ZWwgPT09IGZyYWdQcmV2aW91cy5sZXZlbCAmJiBmcmFnLnNuID09PSBmcmFnUHJldmlvdXMuc24pIHtcbiAgICAgICAgICAgICAgICBpZiAoZnJhZy5zbiA8IGxldmVsRGV0YWlscy5lbmRTTikge1xuICAgICAgICAgICAgICAgICAgZnJhZyA9IGZyYWdtZW50c1tmcmFnLnNuICsgMSAtIGxldmVsRGV0YWlscy5zdGFydFNOXTtcbiAgICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYFNOIGp1c3QgbG9hZGVkLCBsb2FkIG5leHQgb25lOiAke2ZyYWcuc259YCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIC8vIGhhdmUgd2UgcmVhY2hlZCBlbmQgb2YgVk9EIHBsYXlsaXN0ID9cbiAgICAgICAgICAgICAgICAgIGlmICghbGV2ZWxEZXRhaWxzLmxpdmUpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG1lZGlhU291cmNlID0gdGhpcy5tZWRpYVNvdXJjZTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1lZGlhU291cmNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgc3dpdGNoKG1lZGlhU291cmNlLnJlYWR5U3RhdGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ29wZW4nOlxuICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgc2IgPSB0aGlzLnNvdXJjZUJ1ZmZlcjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCEoKHNiLmF1ZGlvICYmIHNiLmF1ZGlvLnVwZGF0aW5nKSB8fCAoc2IudmlkZW8gJiYgc2IudmlkZW8udXBkYXRpbmcpKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coJ2FsbCBtZWRpYSBkYXRhIGF2YWlsYWJsZSwgc2lnbmFsIGVuZE9mU3RyZWFtKCkgdG8gTWVkaWFTb3VyY2UgYW5kIHN0b3AgbG9hZGluZyBmcmFnbWVudCcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vTm90aWZ5IHRoZSBtZWRpYSBlbGVtZW50IHRoYXQgaXQgbm93IGhhcyBhbGwgb2YgdGhlIG1lZGlhIGRhdGFcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZWRpYVNvdXJjZS5lbmRPZlN0cmVhbSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5FTkRFRDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ2VuZGVkJzpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nZ2VyLmxvZygnYWxsIG1lZGlhIGRhdGEgYXZhaWxhYmxlIGFuZCBtZWRpYVNvdXJjZSBlbmRlZCwgc3RvcCBsb2FkaW5nIGZyYWdtZW50Jyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5FTkRFRDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIGZyYWcgPSBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZihmcmFnKSB7XG4gICAgICAgICAgICAvL2xvZ2dlci5sb2coJyAgICAgIGxvYWRpbmcgZnJhZyAnICsgaSArJyxwb3MvYnVmRW5kOicgKyBwb3MudG9GaXhlZCgzKSArICcvJyArIGJ1ZmZlckVuZC50b0ZpeGVkKDMpKTtcbiAgICAgICAgICAgIGlmICgoZnJhZy5kZWNyeXB0ZGF0YS51cmkgIT0gbnVsbCkgJiYgKGZyYWcuZGVjcnlwdGRhdGEua2V5ID09IG51bGwpKSB7XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coYExvYWRpbmcga2V5IGZvciAke2ZyYWcuc259IG9mIFske2xldmVsRGV0YWlscy5zdGFydFNOfSAsJHtsZXZlbERldGFpbHMuZW5kU059XSxsZXZlbCAke2xldmVsfWApO1xuICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuS0VZX0xPQURJTkc7XG4gICAgICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50LktFWV9MT0FESU5HLCB7ZnJhZzogZnJhZ30pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgTG9hZGluZyAke2ZyYWcuc259IG9mIFske2xldmVsRGV0YWlscy5zdGFydFNOfSAsJHtsZXZlbERldGFpbHMuZW5kU059XSxsZXZlbCAke2xldmVsfSwgY3VycmVudFRpbWU6JHtwb3N9LGJ1ZmZlckVuZDoke2J1ZmZlckVuZC50b0ZpeGVkKDMpfWApO1xuICAgICAgICAgICAgICBmcmFnLmF1dG9MZXZlbCA9IGhscy5hdXRvTGV2ZWxFbmFibGVkO1xuICAgICAgICAgICAgICBpZiAodGhpcy5sZXZlbHMubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgIGZyYWcuZXhwZWN0ZWRMZW4gPSBNYXRoLnJvdW5kKGZyYWcuZHVyYXRpb24gKiB0aGlzLmxldmVsc1tsZXZlbF0uYml0cmF0ZSAvIDgpO1xuICAgICAgICAgICAgICAgIGZyYWcudHJlcXVlc3QgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAvLyBlbnN1cmUgdGhhdCB3ZSBhcmUgbm90IHJlbG9hZGluZyB0aGUgc2FtZSBmcmFnbWVudHMgaW4gbG9vcCAuLi5cbiAgICAgICAgICAgICAgaWYgKHRoaXMuZnJhZ0xvYWRJZHggIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZnJhZ0xvYWRJZHgrKztcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmZyYWdMb2FkSWR4ID0gMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoZnJhZy5sb2FkQ291bnRlcikge1xuICAgICAgICAgICAgICAgIGZyYWcubG9hZENvdW50ZXIrKztcbiAgICAgICAgICAgICAgICBsZXQgbWF4VGhyZXNob2xkID0gdGhpcy5jb25maWcuZnJhZ0xvYWRpbmdMb29wVGhyZXNob2xkO1xuICAgICAgICAgICAgICAgIC8vIGlmIHRoaXMgZnJhZyBoYXMgYWxyZWFkeSBiZWVuIGxvYWRlZCAzIHRpbWVzLCBhbmQgaWYgaXQgaGFzIGJlZW4gcmVsb2FkZWQgcmVjZW50bHlcbiAgICAgICAgICAgICAgICBpZiAoZnJhZy5sb2FkQ291bnRlciA+IG1heFRocmVzaG9sZCAmJiAoTWF0aC5hYnModGhpcy5mcmFnTG9hZElkeCAtIGZyYWcubG9hZElkeCkgPCBtYXhUaHJlc2hvbGQpKSB7XG4gICAgICAgICAgICAgICAgICBobHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5GUkFHX0xPT1BfTE9BRElOR19FUlJPUiwgZmF0YWw6IGZhbHNlLCBmcmFnOiBmcmFnfSk7XG4gICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGZyYWcubG9hZENvdW50ZXIgPSAxO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGZyYWcubG9hZElkeCA9IHRoaXMuZnJhZ0xvYWRJZHg7XG4gICAgICAgICAgICAgIHRoaXMuZnJhZ0N1cnJlbnQgPSBmcmFnO1xuICAgICAgICAgICAgICB0aGlzLnN0YXJ0RnJhZ21lbnRSZXF1ZXN0ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICBobHMudHJpZ2dlcihFdmVudC5GUkFHX0xPQURJTkcsIHtmcmFnOiBmcmFnfSk7XG4gICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5GUkFHX0xPQURJTkc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBTdGF0ZS5XQUlUSU5HX0xFVkVMOlxuICAgICAgICBsZXZlbCA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdO1xuICAgICAgICAvLyBjaGVjayBpZiBwbGF5bGlzdCBpcyBhbHJlYWR5IGxvYWRlZFxuICAgICAgICBpZiAobGV2ZWwgJiYgbGV2ZWwuZGV0YWlscykge1xuICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBTdGF0ZS5GUkFHX0xPQURJTkc6XG4gICAgICAgIC8qXG4gICAgICAgICAgbW9uaXRvciBmcmFnbWVudCByZXRyaWV2YWwgdGltZS4uLlxuICAgICAgICAgIHdlIGNvbXB1dGUgZXhwZWN0ZWQgdGltZSBvZiBhcnJpdmFsIG9mIHRoZSBjb21wbGV0ZSBmcmFnbWVudC5cbiAgICAgICAgICB3ZSBjb21wYXJlIGl0IHRvIGV4cGVjdGVkIHRpbWUgb2YgYnVmZmVyIHN0YXJ2YXRpb25cbiAgICAgICAgKi9cbiAgICAgICAgbGV0IHYgPSB0aGlzLm1lZGlhLGZyYWcgPSB0aGlzLmZyYWdDdXJyZW50O1xuICAgICAgICAvKiBvbmx5IG1vbml0b3IgZnJhZyByZXRyaWV2YWwgdGltZSBpZlxuICAgICAgICAodmlkZW8gbm90IHBhdXNlZCBPUiBmaXJzdCBmcmFnbWVudCBiZWluZyBsb2FkZWQpIEFORCBhdXRvc3dpdGNoaW5nIGVuYWJsZWQgQU5EIG5vdCBsb3dlc3QgbGV2ZWwgQU5EIG11bHRpcGxlIGxldmVscyAqL1xuICAgICAgICBpZiAodiAmJiAoIXYucGF1c2VkIHx8IHRoaXMubG9hZGVkbWV0YWRhdGEgPT09IGZhbHNlKSAmJiBmcmFnLmF1dG9MZXZlbCAmJiB0aGlzLmxldmVsICYmIHRoaXMubGV2ZWxzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICB2YXIgcmVxdWVzdERlbGF5ID0gcGVyZm9ybWFuY2Uubm93KCkgLSBmcmFnLnRyZXF1ZXN0O1xuICAgICAgICAgIC8vIG1vbml0b3IgZnJhZ21lbnQgbG9hZCBwcm9ncmVzcyBhZnRlciBoYWxmIG9mIGV4cGVjdGVkIGZyYWdtZW50IGR1cmF0aW9uLHRvIHN0YWJpbGl6ZSBiaXRyYXRlXG4gICAgICAgICAgaWYgKHJlcXVlc3REZWxheSA+ICg1MDAgKiBmcmFnLmR1cmF0aW9uKSkge1xuICAgICAgICAgICAgdmFyIGxvYWRSYXRlID0gZnJhZy5sb2FkZWQgKiAxMDAwIC8gcmVxdWVzdERlbGF5OyAvLyBieXRlL3NcbiAgICAgICAgICAgIGlmIChmcmFnLmV4cGVjdGVkTGVuIDwgZnJhZy5sb2FkZWQpIHtcbiAgICAgICAgICAgICAgZnJhZy5leHBlY3RlZExlbiA9IGZyYWcubG9hZGVkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcG9zID0gdi5jdXJyZW50VGltZTtcbiAgICAgICAgICAgIHZhciBmcmFnTG9hZGVkRGVsYXkgPSAoZnJhZy5leHBlY3RlZExlbiAtIGZyYWcubG9hZGVkKSAvIGxvYWRSYXRlO1xuICAgICAgICAgICAgdmFyIGJ1ZmZlclN0YXJ2YXRpb25EZWxheSA9IHRoaXMuYnVmZmVySW5mbyhwb3MsdGhpcy5jb25maWcubWF4QnVmZmVySG9sZSkuZW5kIC0gcG9zO1xuICAgICAgICAgICAgdmFyIGZyYWdMZXZlbE5leHRMb2FkZWREZWxheSA9IGZyYWcuZHVyYXRpb24gKiB0aGlzLmxldmVsc1tobHMubmV4dExvYWRMZXZlbF0uYml0cmF0ZSAvICg4ICogbG9hZFJhdGUpOyAvL2Jwcy9CcHNcbiAgICAgICAgICAgIC8qIGlmIHdlIGhhdmUgbGVzcyB0aGFuIDIgZnJhZyBkdXJhdGlvbiBpbiBidWZmZXIgYW5kIGlmIGZyYWcgbG9hZGVkIGRlbGF5IGlzIGdyZWF0ZXIgdGhhbiBidWZmZXIgc3RhcnZhdGlvbiBkZWxheVxuICAgICAgICAgICAgICAuLi4gYW5kIGFsc28gYmlnZ2VyIHRoYW4gZHVyYXRpb24gbmVlZGVkIHRvIGxvYWQgZnJhZ21lbnQgYXQgbmV4dCBsZXZlbCAuLi4qL1xuICAgICAgICAgICAgaWYgKGJ1ZmZlclN0YXJ2YXRpb25EZWxheSA8ICgyICogZnJhZy5kdXJhdGlvbikgJiYgZnJhZ0xvYWRlZERlbGF5ID4gYnVmZmVyU3RhcnZhdGlvbkRlbGF5ICYmIGZyYWdMb2FkZWREZWxheSA+IGZyYWdMZXZlbE5leHRMb2FkZWREZWxheSkge1xuICAgICAgICAgICAgICAvLyBhYm9ydCBmcmFnbWVudCBsb2FkaW5nIC4uLlxuICAgICAgICAgICAgICBsb2dnZXIud2FybignbG9hZGluZyB0b28gc2xvdywgYWJvcnQgZnJhZ21lbnQgbG9hZGluZycpO1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBmcmFnTG9hZGVkRGVsYXkvYnVmZmVyU3RhcnZhdGlvbkRlbGF5L2ZyYWdMZXZlbE5leHRMb2FkZWREZWxheSA6JHtmcmFnTG9hZGVkRGVsYXkudG9GaXhlZCgxKX0vJHtidWZmZXJTdGFydmF0aW9uRGVsYXkudG9GaXhlZCgxKX0vJHtmcmFnTGV2ZWxOZXh0TG9hZGVkRGVsYXkudG9GaXhlZCgxKX1gKTtcbiAgICAgICAgICAgICAgLy9hYm9ydCBmcmFnbWVudCBsb2FkaW5nXG4gICAgICAgICAgICAgIGZyYWcubG9hZGVyLmFib3J0KCk7XG4gICAgICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkZSQUdfTE9BRF9FTUVSR0VOQ1lfQUJPUlRFRCwge2ZyYWc6IGZyYWd9KTtcbiAgICAgICAgICAgICAgLy8gc3dpdGNoIGJhY2sgdG8gSURMRSBzdGF0ZSB0byByZXF1ZXN0IG5ldyBmcmFnbWVudCBhdCBsb3dlc3QgbGV2ZWxcbiAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBTdGF0ZS5GUkFHX0xPQURJTkdfV0FJVElOR19SRVRSWTpcbiAgICAgICAgdmFyIG5vdyA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgICB2YXIgcmV0cnlEYXRlID0gdGhpcy5yZXRyeURhdGU7XG4gICAgICAgIHZhciBtZWRpYSA9IHRoaXMubWVkaWE7XG4gICAgICAgIHZhciBpc1NlZWtpbmcgPSBtZWRpYSAmJiBtZWRpYS5zZWVraW5nO1xuICAgICAgICAvLyBpZiBjdXJyZW50IHRpbWUgaXMgZ3QgdGhhbiByZXRyeURhdGUsIG9yIGlmIG1lZGlhIHNlZWtpbmcgbGV0J3Mgc3dpdGNoIHRvIElETEUgc3RhdGUgdG8gcmV0cnkgbG9hZGluZ1xuICAgICAgICBpZighcmV0cnlEYXRlIHx8IChub3cgPj0gcmV0cnlEYXRlKSB8fCBpc1NlZWtpbmcpIHtcbiAgICAgICAgICBsb2dnZXIubG9nKGBtZWRpYUNvbnRyb2xsZXI6IHJldHJ5RGF0ZSByZWFjaGVkLCBzd2l0Y2ggYmFjayB0byBJRExFIHN0YXRlYCk7XG4gICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFN0YXRlLlBBUlNJTkc6XG4gICAgICAgIC8vIG5vdGhpbmcgdG8gZG8sIHdhaXQgZm9yIGZyYWdtZW50IGJlaW5nIHBhcnNlZFxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgU3RhdGUuUEFSU0VEOlxuICAgICAgY2FzZSBTdGF0ZS5BUFBFTkRJTkc6XG4gICAgICAgIGlmICh0aGlzLnNvdXJjZUJ1ZmZlcikge1xuICAgICAgICAgIGlmICh0aGlzLm1lZGlhLmVycm9yKSB7XG4gICAgICAgICAgICBsb2dnZXIuZXJyb3IoJ3RyeWluZyB0byBhcHBlbmQgYWx0aG91Z2ggYSBtZWRpYSBlcnJvciBvY2N1cmVkLCBzd2l0Y2ggdG8gRVJST1Igc3RhdGUnKTtcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5FUlJPUjtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gaWYgTVA0IHNlZ21lbnQgYXBwZW5kaW5nIGluIHByb2dyZXNzIG5vdGhpbmcgdG8gZG9cbiAgICAgICAgICBlbHNlIGlmICgodGhpcy5zb3VyY2VCdWZmZXIuYXVkaW8gJiYgdGhpcy5zb3VyY2VCdWZmZXIuYXVkaW8udXBkYXRpbmcpIHx8XG4gICAgICAgICAgICAgKHRoaXMuc291cmNlQnVmZmVyLnZpZGVvICYmIHRoaXMuc291cmNlQnVmZmVyLnZpZGVvLnVwZGF0aW5nKSkge1xuICAgICAgICAgICAgLy9sb2dnZXIubG9nKCdzYiBhcHBlbmQgaW4gcHJvZ3Jlc3MnKTtcbiAgICAgICAgLy8gY2hlY2sgaWYgYW55IE1QNCBzZWdtZW50cyBsZWZ0IHRvIGFwcGVuZFxuICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5tcDRzZWdtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHZhciBzZWdtZW50ID0gdGhpcy5tcDRzZWdtZW50cy5zaGlmdCgpO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgLy9sb2dnZXIubG9nKGBhcHBlbmRpbmcgJHtzZWdtZW50LnR5cGV9IFNCLCBzaXplOiR7c2VnbWVudC5kYXRhLmxlbmd0aH0pO1xuICAgICAgICAgICAgICB0aGlzLnNvdXJjZUJ1ZmZlcltzZWdtZW50LnR5cGVdLmFwcGVuZEJ1ZmZlcihzZWdtZW50LmRhdGEpO1xuICAgICAgICAgICAgICB0aGlzLmFwcGVuZEVycm9yID0gMDtcbiAgICAgICAgICAgIH0gY2F0Y2goZXJyKSB7XG4gICAgICAgICAgICAgIC8vIGluIGNhc2UgYW55IGVycm9yIG9jY3VyZWQgd2hpbGUgYXBwZW5kaW5nLCBwdXQgYmFjayBzZWdtZW50IGluIG1wNHNlZ21lbnRzIHRhYmxlXG4gICAgICAgICAgICAgIGxvZ2dlci5lcnJvcihgZXJyb3Igd2hpbGUgdHJ5aW5nIHRvIGFwcGVuZCBidWZmZXI6JHtlcnIubWVzc2FnZX0sdHJ5IGFwcGVuZGluZyBsYXRlcmApO1xuICAgICAgICAgICAgICB0aGlzLm1wNHNlZ21lbnRzLnVuc2hpZnQoc2VnbWVudCk7XG4gICAgICAgICAgICAgICAgLy8ganVzdCBkaXNjYXJkIFF1b3RhRXhjZWVkZWRFcnJvciBmb3Igbm93LCBhbmQgd2FpdCBmb3IgdGhlIG5hdHVyYWwgYnJvd3NlciBidWZmZXIgZXZpY3Rpb25cbiAgICAgICAgICAgICAgLy9odHRwOi8vd3d3LnczLm9yZy9UUi9odG1sNS9pbmZyYXN0cnVjdHVyZS5odG1sI3F1b3RhZXhjZWVkZWRlcnJvclxuICAgICAgICAgICAgICBpZihlcnIuY29kZSAhPT0gMjIpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5hcHBlbmRFcnJvcikge1xuICAgICAgICAgICAgICAgICAgdGhpcy5hcHBlbmRFcnJvcisrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICB0aGlzLmFwcGVuZEVycm9yID0gMTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdmFyIGV2ZW50ID0ge3R5cGU6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5CVUZGRVJfQVBQRU5EX0VSUk9SLCBmcmFnOiB0aGlzLmZyYWdDdXJyZW50fTtcbiAgICAgICAgICAgICAgICAvKiB3aXRoIFVIRCBjb250ZW50LCB3ZSBjb3VsZCBnZXQgbG9vcCBvZiBxdW90YSBleGNlZWRlZCBlcnJvciB1bnRpbFxuICAgICAgICAgICAgICAgICAgYnJvd3NlciBpcyBhYmxlIHRvIGV2aWN0IHNvbWUgZGF0YSBmcm9tIHNvdXJjZWJ1ZmZlci4gcmV0cnlpbmcgaGVscCByZWNvdmVyaW5nIHRoaXNcbiAgICAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmFwcGVuZEVycm9yID4gdGhpcy5jb25maWcuYXBwZW5kRXJyb3JNYXhSZXRyeSkge1xuICAgICAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgZmFpbCAke3RoaXMuY29uZmlnLmFwcGVuZEVycm9yTWF4UmV0cnl9IHRpbWVzIHRvIGFwcGVuZCBzZWdtZW50IGluIHNvdXJjZUJ1ZmZlcmApO1xuICAgICAgICAgICAgICAgICAgZXZlbnQuZmF0YWwgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIGV2ZW50KTtcbiAgICAgICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5FUlJPUjtcbiAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgZXZlbnQuZmF0YWwgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCBldmVudCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuQVBQRU5ESU5HO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBzb3VyY2VCdWZmZXIgdW5kZWZpbmVkLCBzd2l0Y2ggYmFjayB0byBJRExFIHN0YXRlXG4gICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFN0YXRlLkJVRkZFUl9GTFVTSElORzpcbiAgICAgICAgLy8gbG9vcCB0aHJvdWdoIGFsbCBidWZmZXIgcmFuZ2VzIHRvIGZsdXNoXG4gICAgICAgIHdoaWxlKHRoaXMuZmx1c2hSYW5nZS5sZW5ndGgpIHtcbiAgICAgICAgICB2YXIgcmFuZ2UgPSB0aGlzLmZsdXNoUmFuZ2VbMF07XG4gICAgICAgICAgLy8gZmx1c2hCdWZmZXIgd2lsbCBhYm9ydCBhbnkgYnVmZmVyIGFwcGVuZCBpbiBwcm9ncmVzcyBhbmQgZmx1c2ggQXVkaW8vVmlkZW8gQnVmZmVyXG4gICAgICAgICAgaWYgKHRoaXMuZmx1c2hCdWZmZXIocmFuZ2Uuc3RhcnQsIHJhbmdlLmVuZCkpIHtcbiAgICAgICAgICAgIC8vIHJhbmdlIGZsdXNoZWQsIHJlbW92ZSBmcm9tIGZsdXNoIGFycmF5XG4gICAgICAgICAgICB0aGlzLmZsdXNoUmFuZ2Uuc2hpZnQoKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gZmx1c2ggaW4gcHJvZ3Jlc3MsIGNvbWUgYmFjayBsYXRlclxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLmZsdXNoUmFuZ2UubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgLy8gaGFuZGxlIGVuZCBvZiBpbW1lZGlhdGUgc3dpdGNoaW5nIGlmIG5lZWRlZFxuICAgICAgICAgIGlmICh0aGlzLmltbWVkaWF0ZVN3aXRjaCkge1xuICAgICAgICAgICAgdGhpcy5pbW1lZGlhdGVMZXZlbFN3aXRjaEVuZCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBtb3ZlIHRvIElETEUgb25jZSBmbHVzaCBjb21wbGV0ZS4gdGhpcyBzaG91bGQgdHJpZ2dlciBuZXcgZnJhZ21lbnQgbG9hZGluZ1xuICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgICAgICAgIC8vIHJlc2V0IHJlZmVyZW5jZSB0byBmcmFnXG4gICAgICAgICAgdGhpcy5mcmFnUHJldmlvdXMgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgICAvKiBpZiBub3QgZXZlcnl0aGluZyBmbHVzaGVkLCBzdGF5IGluIEJVRkZFUl9GTFVTSElORyBzdGF0ZS4gd2Ugd2lsbCBjb21lIGJhY2sgaGVyZVxuICAgICAgICAgICAgZWFjaCB0aW1lIHNvdXJjZUJ1ZmZlciB1cGRhdGVlbmQoKSBjYWxsYmFjayB3aWxsIGJlIHRyaWdnZXJlZFxuICAgICAgICAgICAgKi9cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFN0YXRlLkVOREVEOlxuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICAvLyBjaGVjayBidWZmZXJcbiAgICB0aGlzLl9jaGVja0J1ZmZlcigpO1xuICAgIC8vIGNoZWNrL3VwZGF0ZSBjdXJyZW50IGZyYWdtZW50XG4gICAgdGhpcy5fY2hlY2tGcmFnbWVudENoYW5nZWQoKTtcbiAgfVxuXG5cbiAgYnVmZmVySW5mbyhwb3MsbWF4SG9sZUR1cmF0aW9uKSB7XG4gICAgdmFyIG1lZGlhID0gdGhpcy5tZWRpYSxcbiAgICAgICAgdmJ1ZmZlcmVkID0gbWVkaWEuYnVmZmVyZWQsXG4gICAgICAgIGJ1ZmZlcmVkID0gW10saTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgdmJ1ZmZlcmVkLmxlbmd0aDsgaSsrKSB7XG4gICAgICBidWZmZXJlZC5wdXNoKHtzdGFydDogdmJ1ZmZlcmVkLnN0YXJ0KGkpLCBlbmQ6IHZidWZmZXJlZC5lbmQoaSl9KTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuYnVmZmVyZWRJbmZvKGJ1ZmZlcmVkLHBvcyxtYXhIb2xlRHVyYXRpb24pO1xuICB9XG5cbiAgYnVmZmVyZWRJbmZvKGJ1ZmZlcmVkLHBvcyxtYXhIb2xlRHVyYXRpb24pIHtcbiAgICB2YXIgYnVmZmVyZWQyID0gW10sXG4gICAgICAgIC8vIGJ1ZmZlclN0YXJ0IGFuZCBidWZmZXJFbmQgYXJlIGJ1ZmZlciBib3VuZGFyaWVzIGFyb3VuZCBjdXJyZW50IHZpZGVvIHBvc2l0aW9uXG4gICAgICAgIGJ1ZmZlckxlbixidWZmZXJTdGFydCwgYnVmZmVyRW5kLGJ1ZmZlclN0YXJ0TmV4dCxpO1xuICAgIC8vIHNvcnQgb24gYnVmZmVyLnN0YXJ0L3NtYWxsZXIgZW5kIChJRSBkb2VzIG5vdCBhbHdheXMgcmV0dXJuIHNvcnRlZCBidWZmZXJlZCByYW5nZSlcbiAgICBidWZmZXJlZC5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICB2YXIgZGlmZiA9IGEuc3RhcnQgLSBiLnN0YXJ0O1xuICAgICAgaWYgKGRpZmYpIHtcbiAgICAgICAgcmV0dXJuIGRpZmY7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gYi5lbmQgLSBhLmVuZDtcbiAgICAgIH1cbiAgICB9KTtcbiAgICAvLyB0aGVyZSBtaWdodCBiZSBzb21lIHNtYWxsIGhvbGVzIGJldHdlZW4gYnVmZmVyIHRpbWUgcmFuZ2VcbiAgICAvLyBjb25zaWRlciB0aGF0IGhvbGVzIHNtYWxsZXIgdGhhbiBtYXhIb2xlRHVyYXRpb24gYXJlIGlycmVsZXZhbnQgYW5kIGJ1aWxkIGFub3RoZXJcbiAgICAvLyBidWZmZXIgdGltZSByYW5nZSByZXByZXNlbnRhdGlvbnMgdGhhdCBkaXNjYXJkcyB0aG9zZSBob2xlc1xuICAgIGZvciAoaSA9IDA7IGkgPCBidWZmZXJlZC5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGJ1ZjJsZW4gPSBidWZmZXJlZDIubGVuZ3RoO1xuICAgICAgaWYoYnVmMmxlbikge1xuICAgICAgICB2YXIgYnVmMmVuZCA9IGJ1ZmZlcmVkMltidWYybGVuIC0gMV0uZW5kO1xuICAgICAgICAvLyBpZiBzbWFsbCBob2xlICh2YWx1ZSBiZXR3ZWVuIDAgb3IgbWF4SG9sZUR1cmF0aW9uICkgb3Igb3ZlcmxhcHBpbmcgKG5lZ2F0aXZlKVxuICAgICAgICBpZigoYnVmZmVyZWRbaV0uc3RhcnQgLSBidWYyZW5kKSA8IG1heEhvbGVEdXJhdGlvbikge1xuICAgICAgICAgIC8vIG1lcmdlIG92ZXJsYXBwaW5nIHRpbWUgcmFuZ2VzXG4gICAgICAgICAgLy8gdXBkYXRlIGxhc3RSYW5nZS5lbmQgb25seSBpZiBzbWFsbGVyIHRoYW4gaXRlbS5lbmRcbiAgICAgICAgICAvLyBlLmcuICBbIDEsIDE1XSB3aXRoICBbIDIsOF0gPT4gWyAxLDE1XSAobm8gbmVlZCB0byBtb2RpZnkgbGFzdFJhbmdlLmVuZClcbiAgICAgICAgICAvLyB3aGVyZWFzIFsgMSwgOF0gd2l0aCAgWyAyLDE1XSA9PiBbIDEsMTVdICggbGFzdFJhbmdlIHNob3VsZCBzd2l0Y2ggZnJvbSBbMSw4XSB0byBbMSwxNV0pXG4gICAgICAgICAgaWYoYnVmZmVyZWRbaV0uZW5kID4gYnVmMmVuZCkge1xuICAgICAgICAgICAgYnVmZmVyZWQyW2J1ZjJsZW4gLSAxXS5lbmQgPSBidWZmZXJlZFtpXS5lbmQ7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIGJpZyBob2xlXG4gICAgICAgICAgYnVmZmVyZWQyLnB1c2goYnVmZmVyZWRbaV0pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBmaXJzdCB2YWx1ZVxuICAgICAgICBidWZmZXJlZDIucHVzaChidWZmZXJlZFtpXSk7XG4gICAgICB9XG4gICAgfVxuICAgIGZvciAoaSA9IDAsIGJ1ZmZlckxlbiA9IDAsIGJ1ZmZlclN0YXJ0ID0gYnVmZmVyRW5kID0gcG9zOyBpIDwgYnVmZmVyZWQyLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgc3RhcnQgPSAgYnVmZmVyZWQyW2ldLnN0YXJ0LFxuICAgICAgICAgIGVuZCA9IGJ1ZmZlcmVkMltpXS5lbmQ7XG4gICAgICAvL2xvZ2dlci5sb2coJ2J1ZiBzdGFydC9lbmQ6JyArIGJ1ZmZlcmVkLnN0YXJ0KGkpICsgJy8nICsgYnVmZmVyZWQuZW5kKGkpKTtcbiAgICAgIGlmICgocG9zICsgbWF4SG9sZUR1cmF0aW9uKSA+PSBzdGFydCAmJiBwb3MgPCBlbmQpIHtcbiAgICAgICAgLy8gcGxheSBwb3NpdGlvbiBpcyBpbnNpZGUgdGhpcyBidWZmZXIgVGltZVJhbmdlLCByZXRyaWV2ZSBlbmQgb2YgYnVmZmVyIHBvc2l0aW9uIGFuZCBidWZmZXIgbGVuZ3RoXG4gICAgICAgIGJ1ZmZlclN0YXJ0ID0gc3RhcnQ7XG4gICAgICAgIGJ1ZmZlckVuZCA9IGVuZCArIG1heEhvbGVEdXJhdGlvbjtcbiAgICAgICAgYnVmZmVyTGVuID0gYnVmZmVyRW5kIC0gcG9zO1xuICAgICAgfSBlbHNlIGlmICgocG9zICsgbWF4SG9sZUR1cmF0aW9uKSA8IHN0YXJ0KSB7XG4gICAgICAgIGJ1ZmZlclN0YXJ0TmV4dCA9IHN0YXJ0O1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHtsZW46IGJ1ZmZlckxlbiwgc3RhcnQ6IGJ1ZmZlclN0YXJ0LCBlbmQ6IGJ1ZmZlckVuZCwgbmV4dFN0YXJ0IDogYnVmZmVyU3RhcnROZXh0fTtcbiAgfVxuXG4gIGdldEJ1ZmZlclJhbmdlKHBvc2l0aW9uKSB7XG4gICAgdmFyIGksIHJhbmdlO1xuICAgIGZvciAoaSA9IHRoaXMuYnVmZmVyUmFuZ2UubGVuZ3RoIC0gMTsgaSA+PTA7IGktLSkge1xuICAgICAgcmFuZ2UgPSB0aGlzLmJ1ZmZlclJhbmdlW2ldO1xuICAgICAgaWYgKHBvc2l0aW9uID49IHJhbmdlLnN0YXJ0ICYmIHBvc2l0aW9uIDw9IHJhbmdlLmVuZCkge1xuICAgICAgICByZXR1cm4gcmFuZ2U7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgZ2V0IGN1cnJlbnRMZXZlbCgpIHtcbiAgICBpZiAodGhpcy5tZWRpYSkge1xuICAgICAgdmFyIHJhbmdlID0gdGhpcy5nZXRCdWZmZXJSYW5nZSh0aGlzLm1lZGlhLmN1cnJlbnRUaW1lKTtcbiAgICAgIGlmIChyYW5nZSkge1xuICAgICAgICByZXR1cm4gcmFuZ2UuZnJhZy5sZXZlbDtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIC0xO1xuICB9XG5cbiAgZ2V0IG5leHRCdWZmZXJSYW5nZSgpIHtcbiAgICBpZiAodGhpcy5tZWRpYSkge1xuICAgICAgLy8gZmlyc3QgZ2V0IGVuZCByYW5nZSBvZiBjdXJyZW50IGZyYWdtZW50XG4gICAgICByZXR1cm4gdGhpcy5mb2xsb3dpbmdCdWZmZXJSYW5nZSh0aGlzLmdldEJ1ZmZlclJhbmdlKHRoaXMubWVkaWEuY3VycmVudFRpbWUpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgZm9sbG93aW5nQnVmZmVyUmFuZ2UocmFuZ2UpIHtcbiAgICBpZiAocmFuZ2UpIHtcbiAgICAgIC8vIHRyeSB0byBnZXQgcmFuZ2Ugb2YgbmV4dCBmcmFnbWVudCAoNTAwbXMgYWZ0ZXIgdGhpcyByYW5nZSlcbiAgICAgIHJldHVybiB0aGlzLmdldEJ1ZmZlclJhbmdlKHJhbmdlLmVuZCArIDAuNSk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgZ2V0IG5leHRMZXZlbCgpIHtcbiAgICB2YXIgcmFuZ2UgPSB0aGlzLm5leHRCdWZmZXJSYW5nZTtcbiAgICBpZiAocmFuZ2UpIHtcbiAgICAgIHJldHVybiByYW5nZS5mcmFnLmxldmVsO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gLTE7XG4gICAgfVxuICB9XG5cbiAgaXNCdWZmZXJlZChwb3NpdGlvbikge1xuICAgIHZhciB2ID0gdGhpcy5tZWRpYSwgYnVmZmVyZWQgPSB2LmJ1ZmZlcmVkO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYnVmZmVyZWQubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChwb3NpdGlvbiA+PSBidWZmZXJlZC5zdGFydChpKSAmJiBwb3NpdGlvbiA8PSBidWZmZXJlZC5lbmQoaSkpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIF9jaGVja0ZyYWdtZW50Q2hhbmdlZCgpIHtcbiAgICB2YXIgcmFuZ2VDdXJyZW50LCBjdXJyZW50VGltZSwgdmlkZW8gPSB0aGlzLm1lZGlhO1xuICAgIGlmICh2aWRlbyAmJiB2aWRlby5zZWVraW5nID09PSBmYWxzZSkge1xuICAgICAgY3VycmVudFRpbWUgPSB2aWRlby5jdXJyZW50VGltZTtcbiAgICAgIC8qIGlmIHZpZGVvIGVsZW1lbnQgaXMgaW4gc2Vla2VkIHN0YXRlLCBjdXJyZW50VGltZSBjYW4gb25seSBpbmNyZWFzZS5cbiAgICAgICAgKGFzc3VtaW5nIHRoYXQgcGxheWJhY2sgcmF0ZSBpcyBwb3NpdGl2ZSAuLi4pXG4gICAgICAgIEFzIHNvbWV0aW1lcyBjdXJyZW50VGltZSBqdW1wcyBiYWNrIHRvIHplcm8gYWZ0ZXIgYVxuICAgICAgICBtZWRpYSBkZWNvZGUgZXJyb3IsIGNoZWNrIHRoaXMsIHRvIGF2b2lkIHNlZWtpbmcgYmFjayB0b1xuICAgICAgICB3cm9uZyBwb3NpdGlvbiBhZnRlciBhIG1lZGlhIGRlY29kZSBlcnJvclxuICAgICAgKi9cbiAgICAgIGlmKGN1cnJlbnRUaW1lID4gdmlkZW8ucGxheWJhY2tSYXRlKnRoaXMubGFzdEN1cnJlbnRUaW1lKSB7XG4gICAgICAgIHRoaXMubGFzdEN1cnJlbnRUaW1lID0gY3VycmVudFRpbWU7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5pc0J1ZmZlcmVkKGN1cnJlbnRUaW1lKSkge1xuICAgICAgICByYW5nZUN1cnJlbnQgPSB0aGlzLmdldEJ1ZmZlclJhbmdlKGN1cnJlbnRUaW1lKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5pc0J1ZmZlcmVkKGN1cnJlbnRUaW1lICsgMC4xKSkge1xuICAgICAgICAvKiBlbnN1cmUgdGhhdCBGUkFHX0NIQU5HRUQgZXZlbnQgaXMgdHJpZ2dlcmVkIGF0IHN0YXJ0dXAsXG4gICAgICAgICAgd2hlbiBmaXJzdCB2aWRlbyBmcmFtZSBpcyBkaXNwbGF5ZWQgYW5kIHBsYXliYWNrIGlzIHBhdXNlZC5cbiAgICAgICAgICBhZGQgYSB0b2xlcmFuY2Ugb2YgMTAwbXMsIGluIGNhc2UgY3VycmVudCBwb3NpdGlvbiBpcyBub3QgYnVmZmVyZWQsXG4gICAgICAgICAgY2hlY2sgaWYgY3VycmVudCBwb3MrMTAwbXMgaXMgYnVmZmVyZWQgYW5kIHVzZSB0aGF0IGJ1ZmZlciByYW5nZVxuICAgICAgICAgIGZvciBGUkFHX0NIQU5HRUQgZXZlbnQgcmVwb3J0aW5nICovXG4gICAgICAgIHJhbmdlQ3VycmVudCA9IHRoaXMuZ2V0QnVmZmVyUmFuZ2UoY3VycmVudFRpbWUgKyAwLjEpO1xuICAgICAgfVxuICAgICAgaWYgKHJhbmdlQ3VycmVudCkge1xuICAgICAgICB2YXIgZnJhZ1BsYXlpbmcgPSByYW5nZUN1cnJlbnQuZnJhZztcbiAgICAgICAgaWYgKGZyYWdQbGF5aW5nICE9PSB0aGlzLmZyYWdQbGF5aW5nKSB7XG4gICAgICAgICAgdGhpcy5mcmFnUGxheWluZyA9IGZyYWdQbGF5aW5nO1xuICAgICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRlJBR19DSEFOR0VELCB7ZnJhZzogZnJhZ1BsYXlpbmd9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qXG4gICAgYWJvcnQgYW55IGJ1ZmZlciBhcHBlbmQgaW4gcHJvZ3Jlc3MsIGFuZCBmbHVzaCBhbGwgYnVmZmVyZWQgZGF0YVxuICAgIHJldHVybiB0cnVlIG9uY2UgZXZlcnl0aGluZyBoYXMgYmVlbiBmbHVzaGVkLlxuICAgIHNvdXJjZUJ1ZmZlci5hYm9ydCgpIGFuZCBzb3VyY2VCdWZmZXIucmVtb3ZlKCkgYXJlIGFzeW5jaHJvbm91cyBvcGVyYXRpb25zXG4gICAgdGhlIGlkZWEgaXMgdG8gY2FsbCB0aGlzIGZ1bmN0aW9uIGZyb20gdGljaygpIHRpbWVyIGFuZCBjYWxsIGl0IGFnYWluIHVudGlsIGFsbCByZXNvdXJjZXMgaGF2ZSBiZWVuIGNsZWFuZWRcbiAgICB0aGUgdGltZXIgaXMgcmVhcm1lZCB1cG9uIHNvdXJjZUJ1ZmZlciB1cGRhdGVlbmQoKSBldmVudCwgc28gdGhpcyBzaG91bGQgYmUgb3B0aW1hbFxuICAqL1xuICBmbHVzaEJ1ZmZlcihzdGFydE9mZnNldCwgZW5kT2Zmc2V0KSB7XG4gICAgdmFyIHNiLCBpLCBidWZTdGFydCwgYnVmRW5kLCBmbHVzaFN0YXJ0LCBmbHVzaEVuZDtcbiAgICAvL2xvZ2dlci5sb2coJ2ZsdXNoQnVmZmVyLHBvcy9zdGFydC9lbmQ6ICcgKyB0aGlzLm1lZGlhLmN1cnJlbnRUaW1lICsgJy8nICsgc3RhcnRPZmZzZXQgKyAnLycgKyBlbmRPZmZzZXQpO1xuICAgIC8vIHNhZmVndWFyZCB0byBhdm9pZCBpbmZpbml0ZSBsb29waW5nXG4gICAgaWYgKHRoaXMuZmx1c2hCdWZmZXJDb3VudGVyKysgPCAoMiAqIHRoaXMuYnVmZmVyUmFuZ2UubGVuZ3RoKSAmJiB0aGlzLnNvdXJjZUJ1ZmZlcikge1xuICAgICAgZm9yICh2YXIgdHlwZSBpbiB0aGlzLnNvdXJjZUJ1ZmZlcikge1xuICAgICAgICBzYiA9IHRoaXMuc291cmNlQnVmZmVyW3R5cGVdO1xuICAgICAgICBpZiAoIXNiLnVwZGF0aW5nKSB7XG4gICAgICAgICAgZm9yIChpID0gMDsgaSA8IHNiLmJ1ZmZlcmVkLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBidWZTdGFydCA9IHNiLmJ1ZmZlcmVkLnN0YXJ0KGkpO1xuICAgICAgICAgICAgYnVmRW5kID0gc2IuYnVmZmVyZWQuZW5kKGkpO1xuICAgICAgICAgICAgLy8gd29ya2Fyb3VuZCBmaXJlZm94IG5vdCBhYmxlIHRvIHByb3Blcmx5IGZsdXNoIG11bHRpcGxlIGJ1ZmZlcmVkIHJhbmdlLlxuICAgICAgICAgICAgaWYgKG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5pbmRleE9mKCdmaXJlZm94JykgIT09IC0xICYmIGVuZE9mZnNldCA9PT0gTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZKSB7XG4gICAgICAgICAgICAgIGZsdXNoU3RhcnQgPSBzdGFydE9mZnNldDtcbiAgICAgICAgICAgICAgZmx1c2hFbmQgPSBlbmRPZmZzZXQ7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBmbHVzaFN0YXJ0ID0gTWF0aC5tYXgoYnVmU3RhcnQsIHN0YXJ0T2Zmc2V0KTtcbiAgICAgICAgICAgICAgZmx1c2hFbmQgPSBNYXRoLm1pbihidWZFbmQsIGVuZE9mZnNldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvKiBzb21ldGltZXMgc291cmNlYnVmZmVyLnJlbW92ZSgpIGRvZXMgbm90IGZsdXNoXG4gICAgICAgICAgICAgICB0aGUgZXhhY3QgZXhwZWN0ZWQgdGltZSByYW5nZS5cbiAgICAgICAgICAgICAgIHRvIGF2b2lkIHJvdW5kaW5nIGlzc3Vlcy9pbmZpbml0ZSBsb29wLFxuICAgICAgICAgICAgICAgb25seSBmbHVzaCBidWZmZXIgcmFuZ2Ugb2YgbGVuZ3RoIGdyZWF0ZXIgdGhhbiA1MDBtcy5cbiAgICAgICAgICAgICovXG4gICAgICAgICAgICBpZiAoZmx1c2hFbmQgLSBmbHVzaFN0YXJ0ID4gMC41KSB7XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coYGZsdXNoICR7dHlwZX0gWyR7Zmx1c2hTdGFydH0sJHtmbHVzaEVuZH1dLCBvZiBbJHtidWZTdGFydH0sJHtidWZFbmR9XSwgcG9zOiR7dGhpcy5tZWRpYS5jdXJyZW50VGltZX1gKTtcbiAgICAgICAgICAgICAgc2IucmVtb3ZlKGZsdXNoU3RhcnQsIGZsdXNoRW5kKTtcbiAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ2Fib3J0ICcgKyB0eXBlICsgJyBhcHBlbmQgaW4gcHJvZ3Jlc3MnKTtcbiAgICAgICAgICAvLyB0aGlzIHdpbGwgYWJvcnQgYW55IGFwcGVuZGluZyBpbiBwcm9ncmVzc1xuICAgICAgICAgIC8vc2IuYWJvcnQoKTtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvKiBhZnRlciBzdWNjZXNzZnVsIGJ1ZmZlciBmbHVzaGluZywgcmVidWlsZCBidWZmZXIgUmFuZ2UgYXJyYXlcbiAgICAgIGxvb3AgdGhyb3VnaCBleGlzdGluZyBidWZmZXIgcmFuZ2UgYW5kIGNoZWNrIGlmXG4gICAgICBjb3JyZXNwb25kaW5nIHJhbmdlIGlzIHN0aWxsIGJ1ZmZlcmVkLiBvbmx5IHB1c2ggdG8gbmV3IGFycmF5IGFscmVhZHkgYnVmZmVyZWQgcmFuZ2VcbiAgICAqL1xuICAgIHZhciBuZXdSYW5nZSA9IFtdLHJhbmdlO1xuICAgIGZvciAoaSA9IDA7IGkgPCB0aGlzLmJ1ZmZlclJhbmdlLmxlbmd0aDsgaSsrKSB7XG4gICAgICByYW5nZSA9IHRoaXMuYnVmZmVyUmFuZ2VbaV07XG4gICAgICBpZiAodGhpcy5pc0J1ZmZlcmVkKChyYW5nZS5zdGFydCArIHJhbmdlLmVuZCkgLyAyKSkge1xuICAgICAgICBuZXdSYW5nZS5wdXNoKHJhbmdlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5idWZmZXJSYW5nZSA9IG5ld1JhbmdlO1xuICAgIGxvZ2dlci5sb2coJ2J1ZmZlciBmbHVzaGVkJyk7XG4gICAgLy8gZXZlcnl0aGluZyBmbHVzaGVkICFcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8qXG4gICAgb24gaW1tZWRpYXRlIGxldmVsIHN3aXRjaCA6XG4gICAgIC0gcGF1c2UgcGxheWJhY2sgaWYgcGxheWluZ1xuICAgICAtIGNhbmNlbCBhbnkgcGVuZGluZyBsb2FkIHJlcXVlc3RcbiAgICAgLSBhbmQgdHJpZ2dlciBhIGJ1ZmZlciBmbHVzaFxuICAqL1xuICBpbW1lZGlhdGVMZXZlbFN3aXRjaCgpIHtcbiAgICBsb2dnZXIubG9nKCdpbW1lZGlhdGVMZXZlbFN3aXRjaCcpO1xuICAgIGlmICghdGhpcy5pbW1lZGlhdGVTd2l0Y2gpIHtcbiAgICAgIHRoaXMuaW1tZWRpYXRlU3dpdGNoID0gdHJ1ZTtcbiAgICAgIHRoaXMucHJldmlvdXNseVBhdXNlZCA9IHRoaXMubWVkaWEucGF1c2VkO1xuICAgICAgdGhpcy5tZWRpYS5wYXVzZSgpO1xuICAgIH1cbiAgICB2YXIgZnJhZ0N1cnJlbnQgPSB0aGlzLmZyYWdDdXJyZW50O1xuICAgIGlmIChmcmFnQ3VycmVudCAmJiBmcmFnQ3VycmVudC5sb2FkZXIpIHtcbiAgICAgIGZyYWdDdXJyZW50LmxvYWRlci5hYm9ydCgpO1xuICAgIH1cbiAgICB0aGlzLmZyYWdDdXJyZW50ID0gbnVsbDtcbiAgICAvLyBmbHVzaCBldmVyeXRoaW5nXG4gICAgdGhpcy5mbHVzaEJ1ZmZlckNvdW50ZXIgPSAwO1xuICAgIHRoaXMuZmx1c2hSYW5nZS5wdXNoKHtzdGFydDogMCwgZW5kOiBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFl9KTtcbiAgICAvLyB0cmlnZ2VyIGEgc291cmNlQnVmZmVyIGZsdXNoXG4gICAgdGhpcy5zdGF0ZSA9IFN0YXRlLkJVRkZFUl9GTFVTSElORztcbiAgICAvLyBpbmNyZWFzZSBmcmFnbWVudCBsb2FkIEluZGV4IHRvIGF2b2lkIGZyYWcgbG9vcCBsb2FkaW5nIGVycm9yIGFmdGVyIGJ1ZmZlciBmbHVzaFxuICAgIHRoaXMuZnJhZ0xvYWRJZHggKz0gMiAqIHRoaXMuY29uZmlnLmZyYWdMb2FkaW5nTG9vcFRocmVzaG9sZDtcbiAgICAvLyBzcGVlZCB1cCBzd2l0Y2hpbmcsIHRyaWdnZXIgdGltZXIgZnVuY3Rpb25cbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4gIC8qXG4gICAgIG9uIGltbWVkaWF0ZSBsZXZlbCBzd2l0Y2ggZW5kLCBhZnRlciBuZXcgZnJhZ21lbnQgaGFzIGJlZW4gYnVmZmVyZWQgOlxuICAgICAgLSBudWRnZSB2aWRlbyBkZWNvZGVyIGJ5IHNsaWdodGx5IGFkanVzdGluZyB2aWRlbyBjdXJyZW50VGltZVxuICAgICAgLSByZXN1bWUgdGhlIHBsYXliYWNrIGlmIG5lZWRlZFxuICAqL1xuICBpbW1lZGlhdGVMZXZlbFN3aXRjaEVuZCgpIHtcbiAgICB0aGlzLmltbWVkaWF0ZVN3aXRjaCA9IGZhbHNlO1xuICAgIHRoaXMubWVkaWEuY3VycmVudFRpbWUgLT0gMC4wMDAxO1xuICAgIGlmICghdGhpcy5wcmV2aW91c2x5UGF1c2VkKSB7XG4gICAgICB0aGlzLm1lZGlhLnBsYXkoKTtcbiAgICB9XG4gIH1cblxuICBuZXh0TGV2ZWxTd2l0Y2goKSB7XG4gICAgLyogdHJ5IHRvIHN3aXRjaCBBU0FQIHdpdGhvdXQgYnJlYWtpbmcgdmlkZW8gcGxheWJhY2sgOlxuICAgICAgIGluIG9yZGVyIHRvIGVuc3VyZSBzbW9vdGggYnV0IHF1aWNrIGxldmVsIHN3aXRjaGluZyxcbiAgICAgIHdlIG5lZWQgdG8gZmluZCB0aGUgbmV4dCBmbHVzaGFibGUgYnVmZmVyIHJhbmdlXG4gICAgICB3ZSBzaG91bGQgdGFrZSBpbnRvIGFjY291bnQgbmV3IHNlZ21lbnQgZmV0Y2ggdGltZVxuICAgICovXG4gICAgdmFyIGZldGNoZGVsYXksIGN1cnJlbnRSYW5nZSwgbmV4dFJhbmdlO1xuICAgIGN1cnJlbnRSYW5nZSA9IHRoaXMuZ2V0QnVmZmVyUmFuZ2UodGhpcy5tZWRpYS5jdXJyZW50VGltZSk7XG4gICAgaWYgKGN1cnJlbnRSYW5nZSkge1xuICAgIC8vIGZsdXNoIGJ1ZmZlciBwcmVjZWRpbmcgY3VycmVudCBmcmFnbWVudCAoZmx1c2ggdW50aWwgY3VycmVudCBmcmFnbWVudCBzdGFydCBvZmZzZXQpXG4gICAgLy8gbWludXMgMXMgdG8gYXZvaWQgdmlkZW8gZnJlZXppbmcsIHRoYXQgY291bGQgaGFwcGVuIGlmIHdlIGZsdXNoIGtleWZyYW1lIG9mIGN1cnJlbnQgdmlkZW8gLi4uXG4gICAgICB0aGlzLmZsdXNoUmFuZ2UucHVzaCh7c3RhcnQ6IDAsIGVuZDogY3VycmVudFJhbmdlLnN0YXJ0IC0gMX0pO1xuICAgIH1cbiAgICBpZiAoIXRoaXMubWVkaWEucGF1c2VkKSB7XG4gICAgICAvLyBhZGQgYSBzYWZldHkgZGVsYXkgb2YgMXNcbiAgICAgIHZhciBuZXh0TGV2ZWxJZCA9IHRoaXMuaGxzLm5leHRMb2FkTGV2ZWwsbmV4dExldmVsID0gdGhpcy5sZXZlbHNbbmV4dExldmVsSWRdLCBmcmFnTGFzdEticHMgPSB0aGlzLmZyYWdMYXN0S2JwcztcbiAgICAgIGlmIChmcmFnTGFzdEticHMgJiYgdGhpcy5mcmFnQ3VycmVudCkge1xuICAgICAgICBmZXRjaGRlbGF5ID0gdGhpcy5mcmFnQ3VycmVudC5kdXJhdGlvbiAqIG5leHRMZXZlbC5iaXRyYXRlIC8gKDEwMDAgKiBmcmFnTGFzdEticHMpICsgMTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZldGNoZGVsYXkgPSAwO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBmZXRjaGRlbGF5ID0gMDtcbiAgICB9XG4gICAgLy9sb2dnZXIubG9nKCdmZXRjaGRlbGF5OicrZmV0Y2hkZWxheSk7XG4gICAgLy8gZmluZCBidWZmZXIgcmFuZ2UgdGhhdCB3aWxsIGJlIHJlYWNoZWQgb25jZSBuZXcgZnJhZ21lbnQgd2lsbCBiZSBmZXRjaGVkXG4gICAgbmV4dFJhbmdlID0gdGhpcy5nZXRCdWZmZXJSYW5nZSh0aGlzLm1lZGlhLmN1cnJlbnRUaW1lICsgZmV0Y2hkZWxheSk7XG4gICAgaWYgKG5leHRSYW5nZSkge1xuICAgICAgLy8gd2UgY2FuIGZsdXNoIGJ1ZmZlciByYW5nZSBmb2xsb3dpbmcgdGhpcyBvbmUgd2l0aG91dCBzdGFsbGluZyBwbGF5YmFja1xuICAgICAgbmV4dFJhbmdlID0gdGhpcy5mb2xsb3dpbmdCdWZmZXJSYW5nZShuZXh0UmFuZ2UpO1xuICAgICAgaWYgKG5leHRSYW5nZSkge1xuICAgICAgICAvLyBmbHVzaCBwb3NpdGlvbiBpcyB0aGUgc3RhcnQgcG9zaXRpb24gb2YgdGhpcyBuZXcgYnVmZmVyXG4gICAgICAgIHRoaXMuZmx1c2hSYW5nZS5wdXNoKHtzdGFydDogbmV4dFJhbmdlLnN0YXJ0LCBlbmQ6IE51bWJlci5QT1NJVElWRV9JTkZJTklUWX0pO1xuICAgICAgICAvLyBpZiB3ZSBhcmUgaGVyZSwgd2UgY2FuIGFsc28gY2FuY2VsIGFueSBsb2FkaW5nL2RlbXV4aW5nIGluIHByb2dyZXNzLCBhcyB0aGV5IGFyZSB1c2VsZXNzXG4gICAgICAgIHZhciBmcmFnQ3VycmVudCA9IHRoaXMuZnJhZ0N1cnJlbnQ7XG4gICAgICAgIGlmIChmcmFnQ3VycmVudCAmJiBmcmFnQ3VycmVudC5sb2FkZXIpIHtcbiAgICAgICAgICBmcmFnQ3VycmVudC5sb2FkZXIuYWJvcnQoKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmZyYWdDdXJyZW50ID0gbnVsbDtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHRoaXMuZmx1c2hSYW5nZS5sZW5ndGgpIHtcbiAgICAgIHRoaXMuZmx1c2hCdWZmZXJDb3VudGVyID0gMDtcbiAgICAgIC8vIHRyaWdnZXIgYSBzb3VyY2VCdWZmZXIgZmx1c2hcbiAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5CVUZGRVJfRkxVU0hJTkc7XG4gICAgICAvLyBpbmNyZWFzZSBmcmFnbWVudCBsb2FkIEluZGV4IHRvIGF2b2lkIGZyYWcgbG9vcCBsb2FkaW5nIGVycm9yIGFmdGVyIGJ1ZmZlciBmbHVzaFxuICAgICAgdGhpcy5mcmFnTG9hZElkeCArPSAyICogdGhpcy5jb25maWcuZnJhZ0xvYWRpbmdMb29wVGhyZXNob2xkO1xuICAgICAgLy8gc3BlZWQgdXAgc3dpdGNoaW5nLCB0cmlnZ2VyIHRpbWVyIGZ1bmN0aW9uXG4gICAgICB0aGlzLnRpY2soKTtcbiAgICB9XG4gIH1cblxuICBvbk1lZGlhQXR0YWNoaW5nKGRhdGEpIHtcbiAgICB2YXIgbWVkaWEgPSB0aGlzLm1lZGlhID0gZGF0YS5tZWRpYTtcbiAgICAvLyBzZXR1cCB0aGUgbWVkaWEgc291cmNlXG4gICAgdmFyIG1zID0gdGhpcy5tZWRpYVNvdXJjZSA9IG5ldyBNZWRpYVNvdXJjZSgpO1xuICAgIC8vTWVkaWEgU291cmNlIGxpc3RlbmVyc1xuICAgIHRoaXMub25tc28gPSB0aGlzLm9uTWVkaWFTb3VyY2VPcGVuLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbm1zZSA9IHRoaXMub25NZWRpYVNvdXJjZUVuZGVkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbm1zYyA9IHRoaXMub25NZWRpYVNvdXJjZUNsb3NlLmJpbmQodGhpcyk7XG4gICAgbXMuYWRkRXZlbnRMaXN0ZW5lcignc291cmNlb3BlbicsIHRoaXMub25tc28pO1xuICAgIG1zLmFkZEV2ZW50TGlzdGVuZXIoJ3NvdXJjZWVuZGVkJywgdGhpcy5vbm1zZSk7XG4gICAgbXMuYWRkRXZlbnRMaXN0ZW5lcignc291cmNlY2xvc2UnLCB0aGlzLm9ubXNjKTtcbiAgICAvLyBsaW5rIHZpZGVvIGFuZCBtZWRpYSBTb3VyY2VcbiAgICBtZWRpYS5zcmMgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKG1zKTtcbiAgfVxuXG4gIG9uTWVkaWFEZXRhY2hpbmcoKSB7XG4gICAgdmFyIG1lZGlhID0gdGhpcy5tZWRpYTtcbiAgICBpZiAobWVkaWEgJiYgbWVkaWEuZW5kZWQpIHtcbiAgICAgIGxvZ2dlci5sb2coJ01TRSBkZXRhY2hpbmcgYW5kIHZpZGVvIGVuZGVkLCByZXNldCBzdGFydFBvc2l0aW9uJyk7XG4gICAgICB0aGlzLnN0YXJ0UG9zaXRpb24gPSB0aGlzLmxhc3RDdXJyZW50VGltZSA9IDA7XG4gICAgfVxuXG4gICAgLy8gcmVzZXQgZnJhZ21lbnQgbG9hZGluZyBjb3VudGVyIG9uIE1TRSBkZXRhY2hpbmcgdG8gYXZvaWQgcmVwb3J0aW5nIEZSQUdfTE9PUF9MT0FESU5HX0VSUk9SIGFmdGVyIGVycm9yIHJlY292ZXJ5XG4gICAgdmFyIGxldmVscyA9IHRoaXMubGV2ZWxzO1xuICAgIGlmIChsZXZlbHMpIHtcbiAgICAgIC8vIHJlc2V0IGZyYWdtZW50IGxvYWQgY291bnRlclxuICAgICAgICBsZXZlbHMuZm9yRWFjaChsZXZlbCA9PiB7XG4gICAgICAgICAgaWYobGV2ZWwuZGV0YWlscykge1xuICAgICAgICAgICAgbGV2ZWwuZGV0YWlscy5mcmFnbWVudHMuZm9yRWFjaChmcmFnbWVudCA9PiB7XG4gICAgICAgICAgICAgIGZyYWdtZW50LmxvYWRDb3VudGVyID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICAgIHZhciBtcyA9IHRoaXMubWVkaWFTb3VyY2U7XG4gICAgaWYgKG1zKSB7XG4gICAgICBpZiAobXMucmVhZHlTdGF0ZSA9PT0gJ29wZW4nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgLy8gZW5kT2ZTdHJlYW0gY291bGQgdHJpZ2dlciBleGNlcHRpb24gaWYgYW55IHNvdXJjZWJ1ZmZlciBpcyBpbiB1cGRhdGluZyBzdGF0ZVxuICAgICAgICAgIC8vIHdlIGRvbid0IHJlYWxseSBjYXJlIGFib3V0IGNoZWNraW5nIHNvdXJjZWJ1ZmZlciBzdGF0ZSBoZXJlLFxuICAgICAgICAgIC8vIGFzIHdlIGFyZSBhbnl3YXkgZGV0YWNoaW5nIHRoZSBNZWRpYVNvdXJjZVxuICAgICAgICAgIC8vIGxldCdzIGp1c3QgYXZvaWQgdGhpcyBleGNlcHRpb24gdG8gcHJvcGFnYXRlXG4gICAgICAgICAgbXMuZW5kT2ZTdHJlYW0oKTtcbiAgICAgICAgfSBjYXRjaChlcnIpIHtcbiAgICAgICAgICBsb2dnZXIud2Fybihgb25NZWRpYURldGFjaGluZzoke2Vyci5tZXNzYWdlfSB3aGlsZSBjYWxsaW5nIGVuZE9mU3RyZWFtYCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIG1zLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NvdXJjZW9wZW4nLCB0aGlzLm9ubXNvKTtcbiAgICAgIG1zLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NvdXJjZWVuZGVkJywgdGhpcy5vbm1zZSk7XG4gICAgICBtcy5yZW1vdmVFdmVudExpc3RlbmVyKCdzb3VyY2VjbG9zZScsIHRoaXMub25tc2MpO1xuICAgICAgLy8gdW5saW5rIE1lZGlhU291cmNlIGZyb20gdmlkZW8gdGFnXG4gICAgICB0aGlzLm1lZGlhLnNyYyA9ICcnO1xuICAgICAgdGhpcy5tZWRpYVNvdXJjZSA9IG51bGw7XG4gICAgICAvLyByZW1vdmUgdmlkZW8gbGlzdGVuZXJzXG4gICAgICBpZiAobWVkaWEpIHtcbiAgICAgICAgbWVkaWEucmVtb3ZlRXZlbnRMaXN0ZW5lcignc2Vla2luZycsIHRoaXMub252c2Vla2luZyk7XG4gICAgICAgIG1lZGlhLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NlZWtlZCcsIHRoaXMub252c2Vla2VkKTtcbiAgICAgICAgbWVkaWEucmVtb3ZlRXZlbnRMaXN0ZW5lcignbG9hZGVkbWV0YWRhdGEnLCB0aGlzLm9udm1ldGFkYXRhKTtcbiAgICAgICAgbWVkaWEucmVtb3ZlRXZlbnRMaXN0ZW5lcignZW5kZWQnLCB0aGlzLm9udmVuZGVkKTtcbiAgICAgICAgdGhpcy5vbnZzZWVraW5nID0gdGhpcy5vbnZzZWVrZWQgPSB0aGlzLm9udm1ldGFkYXRhID0gbnVsbDtcbiAgICAgIH1cbiAgICAgIHRoaXMubWVkaWEgPSBudWxsO1xuICAgICAgdGhpcy5sb2FkZWRtZXRhZGF0YSA9IGZhbHNlO1xuICAgICAgdGhpcy5zdG9wKCk7XG4gICAgfVxuICAgIHRoaXMub25tc28gPSB0aGlzLm9ubXNlID0gdGhpcy5vbm1zYyA9IG51bGw7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5NRURJQV9ERVRBQ0hFRCk7XG4gIH1cblxuICBvbk1lZGlhU2Vla2luZygpIHtcbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gU3RhdGUuRlJBR19MT0FESU5HKSB7XG4gICAgICAvLyBjaGVjayBpZiBjdXJyZW50bHkgbG9hZGVkIGZyYWdtZW50IGlzIGluc2lkZSBidWZmZXIuXG4gICAgICAvL2lmIG91dHNpZGUsIGNhbmNlbCBmcmFnbWVudCBsb2FkaW5nLCBvdGhlcndpc2UgZG8gbm90aGluZ1xuICAgICAgaWYgKHRoaXMuYnVmZmVySW5mbyh0aGlzLm1lZGlhLmN1cnJlbnRUaW1lLHRoaXMuY29uZmlnLm1heEJ1ZmZlckhvbGUpLmxlbiA9PT0gMCkge1xuICAgICAgICBsb2dnZXIubG9nKCdzZWVraW5nIG91dHNpZGUgb2YgYnVmZmVyIHdoaWxlIGZyYWdtZW50IGxvYWQgaW4gcHJvZ3Jlc3MsIGNhbmNlbCBmcmFnbWVudCBsb2FkJyk7XG4gICAgICAgIHZhciBmcmFnQ3VycmVudCA9IHRoaXMuZnJhZ0N1cnJlbnQ7XG4gICAgICAgIGlmIChmcmFnQ3VycmVudCkge1xuICAgICAgICAgIGlmIChmcmFnQ3VycmVudC5sb2FkZXIpIHtcbiAgICAgICAgICAgIGZyYWdDdXJyZW50LmxvYWRlci5hYm9ydCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLmZyYWdDdXJyZW50ID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmZyYWdQcmV2aW91cyA9IG51bGw7XG4gICAgICAgIC8vIHN3aXRjaCB0byBJRExFIHN0YXRlIHRvIGxvYWQgbmV3IGZyYWdtZW50XG4gICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAodGhpcy5zdGF0ZSA9PT0gU3RhdGUuRU5ERUQpIHtcbiAgICAgICAgLy8gc3dpdGNoIHRvIElETEUgc3RhdGUgdG8gY2hlY2sgZm9yIHBvdGVudGlhbCBuZXcgZnJhZ21lbnRcbiAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gICAgfVxuICAgIGlmICh0aGlzLm1lZGlhKSB7XG4gICAgICB0aGlzLmxhc3RDdXJyZW50VGltZSA9IHRoaXMubWVkaWEuY3VycmVudFRpbWU7XG4gICAgfVxuICAgIC8vIGF2b2lkIHJlcG9ydGluZyBmcmFnbWVudCBsb29wIGxvYWRpbmcgZXJyb3IgaW4gY2FzZSB1c2VyIGlzIHNlZWtpbmcgc2V2ZXJhbCB0aW1lcyBvbiBzYW1lIHBvc2l0aW9uXG4gICAgaWYgKHRoaXMuZnJhZ0xvYWRJZHggIT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5mcmFnTG9hZElkeCArPSAyICogdGhpcy5jb25maWcuZnJhZ0xvYWRpbmdMb29wVGhyZXNob2xkO1xuICAgIH1cbiAgICAvLyB0aWNrIHRvIHNwZWVkIHVwIHByb2Nlc3NpbmdcbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4gIG9uTWVkaWFTZWVrZWQoKSB7XG4gICAgLy8gdGljayB0byBzcGVlZCB1cCBGUkFHTUVOVF9QTEFZSU5HIHRyaWdnZXJpbmdcbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4gIG9uTWVkaWFNZXRhZGF0YSgpIHtcbiAgICB2YXIgbWVkaWEgPSB0aGlzLm1lZGlhLFxuICAgICAgICBjdXJyZW50VGltZSA9IG1lZGlhLmN1cnJlbnRUaW1lO1xuICAgIC8vIG9ubHkgYWRqdXN0IGN1cnJlbnRUaW1lIGlmIG5vdCBlcXVhbCB0byAwXG4gICAgaWYgKCFjdXJyZW50VGltZSAmJiBjdXJyZW50VGltZSAhPT0gdGhpcy5zdGFydFBvc2l0aW9uKSB7XG4gICAgICBsb2dnZXIubG9nKCdvbk1lZGlhTWV0YWRhdGE6IGFkanVzdCBjdXJyZW50VGltZSB0byBzdGFydFBvc2l0aW9uJyk7XG4gICAgICBtZWRpYS5jdXJyZW50VGltZSA9IHRoaXMuc3RhcnRQb3NpdGlvbjtcbiAgICB9XG4gICAgdGhpcy5sb2FkZWRtZXRhZGF0YSA9IHRydWU7XG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvbk1lZGlhRW5kZWQoKSB7XG4gICAgbG9nZ2VyLmxvZygnbWVkaWEgZW5kZWQnKTtcbiAgICAvLyByZXNldCBzdGFydFBvc2l0aW9uIGFuZCBsYXN0Q3VycmVudFRpbWUgdG8gcmVzdGFydCBwbGF5YmFjayBAIHN0cmVhbSBiZWdpbm5pbmdcbiAgICB0aGlzLnN0YXJ0UG9zaXRpb24gPSB0aGlzLmxhc3RDdXJyZW50VGltZSA9IDA7XG4gIH1cblxuXG4gIG9uTWFuaWZlc3RQYXJzZWQoZGF0YSkge1xuICAgIHZhciBhYWMgPSBmYWxzZSwgaGVhYWMgPSBmYWxzZSwgY29kZWNzO1xuICAgIGRhdGEubGV2ZWxzLmZvckVhY2gobGV2ZWwgPT4ge1xuICAgICAgLy8gZGV0ZWN0IGlmIHdlIGhhdmUgZGlmZmVyZW50IGtpbmQgb2YgYXVkaW8gY29kZWNzIHVzZWQgYW1vbmdzdCBwbGF5bGlzdHNcbiAgICAgIGNvZGVjcyA9IGxldmVsLmNvZGVjcztcbiAgICAgIGlmIChjb2RlY3MpIHtcbiAgICAgICAgaWYgKGNvZGVjcy5pbmRleE9mKCdtcDRhLjQwLjInKSAhPT0gLTEpIHtcbiAgICAgICAgICBhYWMgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjb2RlY3MuaW5kZXhPZignbXA0YS40MC41JykgIT09IC0xKSB7XG4gICAgICAgICAgaGVhYWMgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gICAgdGhpcy5hdWRpb2NvZGVjc3dpdGNoID0gKGFhYyAmJiBoZWFhYyk7XG4gICAgaWYgKHRoaXMuYXVkaW9jb2RlY3N3aXRjaCkge1xuICAgICAgbG9nZ2VyLmxvZygnYm90aCBBQUMvSEUtQUFDIGF1ZGlvIGZvdW5kIGluIGxldmVsczsgZGVjbGFyaW5nIGF1ZGlvIGNvZGVjIGFzIEhFLUFBQycpO1xuICAgIH1cbiAgICB0aGlzLmxldmVscyA9IGRhdGEubGV2ZWxzO1xuICAgIHRoaXMuc3RhcnRMZXZlbExvYWRlZCA9IGZhbHNlO1xuICAgIHRoaXMuc3RhcnRGcmFnbWVudFJlcXVlc3RlZCA9IGZhbHNlO1xuICAgIGlmICh0aGlzLm1lZGlhICYmIHRoaXMuY29uZmlnLmF1dG9TdGFydExvYWQpIHtcbiAgICAgIHRoaXMuc3RhcnRMb2FkKCk7XG4gICAgfVxuICB9XG5cbiAgb25MZXZlbExvYWRlZChkYXRhKSB7XG4gICAgdmFyIG5ld0RldGFpbHMgPSBkYXRhLmRldGFpbHMsXG4gICAgICAgIG5ld0xldmVsSWQgPSBkYXRhLmxldmVsLFxuICAgICAgICBjdXJMZXZlbCA9IHRoaXMubGV2ZWxzW25ld0xldmVsSWRdLFxuICAgICAgICBkdXJhdGlvbiA9IG5ld0RldGFpbHMudG90YWxkdXJhdGlvbjtcblxuICAgIGxvZ2dlci5sb2coYGxldmVsICR7bmV3TGV2ZWxJZH0gbG9hZGVkIFske25ld0RldGFpbHMuc3RhcnRTTn0sJHtuZXdEZXRhaWxzLmVuZFNOfV0sZHVyYXRpb246JHtkdXJhdGlvbn1gKTtcbiAgICB0aGlzLmxldmVsTGFzdExvYWRlZCA9IG5ld0xldmVsSWQ7XG5cbiAgICBpZiAobmV3RGV0YWlscy5saXZlKSB7XG4gICAgICB2YXIgY3VyRGV0YWlscyA9IGN1ckxldmVsLmRldGFpbHM7XG4gICAgICBpZiAoY3VyRGV0YWlscykge1xuICAgICAgICAvLyB3ZSBhbHJlYWR5IGhhdmUgZGV0YWlscyBmb3IgdGhhdCBsZXZlbCwgbWVyZ2UgdGhlbVxuICAgICAgICBMZXZlbEhlbHBlci5tZXJnZURldGFpbHMoY3VyRGV0YWlscyxuZXdEZXRhaWxzKTtcbiAgICAgICAgaWYgKG5ld0RldGFpbHMuUFRTS25vd24pIHtcbiAgICAgICAgICBsb2dnZXIubG9nKGBsaXZlIHBsYXlsaXN0IHNsaWRpbmc6JHtuZXdEZXRhaWxzLmZyYWdtZW50c1swXS5zdGFydC50b0ZpeGVkKDMpfWApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGxvZ2dlci5sb2coJ2xpdmUgcGxheWxpc3QgLSBvdXRkYXRlZCBQVFMsIHVua25vd24gc2xpZGluZycpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBuZXdEZXRhaWxzLlBUU0tub3duID0gZmFsc2U7XG4gICAgICAgIGxvZ2dlci5sb2coJ2xpdmUgcGxheWxpc3QgLSBmaXJzdCBsb2FkLCB1bmtub3duIHNsaWRpbmcnKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgbmV3RGV0YWlscy5QVFNLbm93biA9IGZhbHNlO1xuICAgIH1cbiAgICAvLyBvdmVycmlkZSBsZXZlbCBpbmZvXG4gICAgY3VyTGV2ZWwuZGV0YWlscyA9IG5ld0RldGFpbHM7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5MRVZFTF9VUERBVEVELCB7IGRldGFpbHM6IG5ld0RldGFpbHMsIGxldmVsOiBuZXdMZXZlbElkIH0pO1xuXG4gICAgLy8gY29tcHV0ZSBzdGFydCBwb3NpdGlvblxuICAgIGlmICh0aGlzLnN0YXJ0TGV2ZWxMb2FkZWQgPT09IGZhbHNlKSB7XG4gICAgICAvLyBpZiBsaXZlIHBsYXlsaXN0LCBzZXQgc3RhcnQgcG9zaXRpb24gdG8gYmUgZnJhZ21lbnQgTi10aGlzLmNvbmZpZy5saXZlU3luY0R1cmF0aW9uQ291bnQgKHVzdWFsbHkgMylcbiAgICAgIGlmIChuZXdEZXRhaWxzLmxpdmUpIHtcbiAgICAgICAgdGhpcy5zdGFydFBvc2l0aW9uID0gTWF0aC5tYXgoMCwgZHVyYXRpb24gLSB0aGlzLmNvbmZpZy5saXZlU3luY0R1cmF0aW9uQ291bnQgKiBuZXdEZXRhaWxzLnRhcmdldGR1cmF0aW9uKTtcbiAgICAgIH1cbiAgICAgIHRoaXMubmV4dExvYWRQb3NpdGlvbiA9IHRoaXMuc3RhcnRQb3NpdGlvbjtcbiAgICAgIHRoaXMuc3RhcnRMZXZlbExvYWRlZCA9IHRydWU7XG4gICAgfVxuICAgIC8vIG9ubHkgc3dpdGNoIGJhdGNrIHRvIElETEUgc3RhdGUgaWYgd2Ugd2VyZSB3YWl0aW5nIGZvciBsZXZlbCB0byBzdGFydCBkb3dubG9hZGluZyBhIG5ldyBmcmFnbWVudFxuICAgIGlmICh0aGlzLnN0YXRlID09PSBTdGF0ZS5XQUlUSU5HX0xFVkVMKSB7XG4gICAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICB9XG4gICAgLy90cmlnZ2VyIGhhbmRsZXIgcmlnaHQgbm93XG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvbktleUxvYWRlZCgpIHtcbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gU3RhdGUuS0VZX0xPQURJTkcpIHtcbiAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgICAgdGhpcy50aWNrKCk7XG4gICAgfVxuICB9XG5cbiAgb25GcmFnTG9hZGVkKGRhdGEpIHtcbiAgICB2YXIgZnJhZ0N1cnJlbnQgPSB0aGlzLmZyYWdDdXJyZW50O1xuICAgIGlmICh0aGlzLnN0YXRlID09PSBTdGF0ZS5GUkFHX0xPQURJTkcgJiZcbiAgICAgICAgZnJhZ0N1cnJlbnQgJiZcbiAgICAgICAgZGF0YS5mcmFnLmxldmVsID09PSBmcmFnQ3VycmVudC5sZXZlbCAmJlxuICAgICAgICBkYXRhLmZyYWcuc24gPT09IGZyYWdDdXJyZW50LnNuKSB7XG4gICAgICBpZiAodGhpcy5mcmFnQml0cmF0ZVRlc3QgPT09IHRydWUpIHtcbiAgICAgICAgLy8gc3dpdGNoIGJhY2sgdG8gSURMRSBzdGF0ZSAuLi4gd2UganVzdCBsb2FkZWQgYSBmcmFnbWVudCB0byBkZXRlcm1pbmUgYWRlcXVhdGUgc3RhcnQgYml0cmF0ZSBhbmQgaW5pdGlhbGl6ZSBhdXRvc3dpdGNoIGFsZ29cbiAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gICAgICAgIHRoaXMuZnJhZ0JpdHJhdGVUZXN0ID0gZmFsc2U7XG4gICAgICAgIGRhdGEuc3RhdHMudHBhcnNlZCA9IGRhdGEuc3RhdHMudGJ1ZmZlcmVkID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRlJBR19CVUZGRVJFRCwge3N0YXRzOiBkYXRhLnN0YXRzLCBmcmFnOiBmcmFnQ3VycmVudH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLlBBUlNJTkc7XG4gICAgICAgIC8vIHRyYW5zbXV4IHRoZSBNUEVHLVRTIGRhdGEgdG8gSVNPLUJNRkYgc2VnbWVudHNcbiAgICAgICAgdGhpcy5zdGF0cyA9IGRhdGEuc3RhdHM7XG4gICAgICAgIHZhciBjdXJyZW50TGV2ZWwgPSB0aGlzLmxldmVsc1t0aGlzLmxldmVsXSxcbiAgICAgICAgICAgIGRldGFpbHMgPSBjdXJyZW50TGV2ZWwuZGV0YWlscyxcbiAgICAgICAgICAgIGR1cmF0aW9uID0gZGV0YWlscy50b3RhbGR1cmF0aW9uLFxuICAgICAgICAgICAgc3RhcnQgPSBmcmFnQ3VycmVudC5zdGFydCxcbiAgICAgICAgICAgIGxldmVsID0gZnJhZ0N1cnJlbnQubGV2ZWwsXG4gICAgICAgICAgICBzbiA9IGZyYWdDdXJyZW50LnNuLFxuICAgICAgICAgICAgYXVkaW9Db2RlYyA9IGN1cnJlbnRMZXZlbC5hdWRpb0NvZGVjO1xuICAgICAgICBpZih0aGlzLmF1ZGlvQ29kZWNTd2FwKSB7XG4gICAgICAgICAgbG9nZ2VyLmxvZygnc3dhcHBpbmcgcGxheWxpc3QgYXVkaW8gY29kZWMnKTtcbiAgICAgICAgICBpZihhdWRpb0NvZGVjID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGF1ZGlvQ29kZWMgPSB0aGlzLmxhc3RBdWRpb0NvZGVjO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZihhdWRpb0NvZGVjLmluZGV4T2YoJ21wNGEuNDAuNScpICE9PS0xKSB7XG4gICAgICAgICAgICBhdWRpb0NvZGVjID0gJ21wNGEuNDAuMic7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGF1ZGlvQ29kZWMgPSAnbXA0YS40MC41JztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgbG9nZ2VyLmxvZyhgRGVtdXhpbmcgJHtzbn0gb2YgWyR7ZGV0YWlscy5zdGFydFNOfSAsJHtkZXRhaWxzLmVuZFNOfV0sbGV2ZWwgJHtsZXZlbH1gKTtcbiAgICAgICAgdGhpcy5kZW11eGVyLnB1c2goZGF0YS5wYXlsb2FkLCBhdWRpb0NvZGVjLCBjdXJyZW50TGV2ZWwudmlkZW9Db2RlYywgc3RhcnQsIGZyYWdDdXJyZW50LmNjLCBsZXZlbCwgc24sIGR1cmF0aW9uLCBmcmFnQ3VycmVudC5kZWNyeXB0ZGF0YSk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuZnJhZ0xvYWRFcnJvciA9IDA7XG4gIH1cblxuICBvbkZyYWdQYXJzaW5nSW5pdFNlZ21lbnQoZGF0YSkge1xuICAgIGlmICh0aGlzLnN0YXRlID09PSBTdGF0ZS5QQVJTSU5HKSB7XG4gICAgICAvLyBjaGVjayBpZiBjb2RlY3MgaGF2ZSBiZWVuIGV4cGxpY2l0ZWx5IGRlZmluZWQgaW4gdGhlIG1hc3RlciBwbGF5bGlzdCBmb3IgdGhpcyBsZXZlbDtcbiAgICAgIC8vIGlmIHllcyB1c2UgdGhlc2Ugb25lcyBpbnN0ZWFkIG9mIHRoZSBvbmVzIHBhcnNlZCBmcm9tIHRoZSBkZW11eFxuICAgICAgdmFyIGF1ZGlvQ29kZWMgPSB0aGlzLmxldmVsc1t0aGlzLmxldmVsXS5hdWRpb0NvZGVjLCB2aWRlb0NvZGVjID0gdGhpcy5sZXZlbHNbdGhpcy5sZXZlbF0udmlkZW9Db2RlYywgc2I7XG4gICAgICB0aGlzLmxhc3RBdWRpb0NvZGVjID0gZGF0YS5hdWRpb0NvZGVjO1xuICAgICAgaWYoYXVkaW9Db2RlYyAmJiB0aGlzLmF1ZGlvQ29kZWNTd2FwKSB7XG4gICAgICAgIGxvZ2dlci5sb2coJ3N3YXBwaW5nIHBsYXlsaXN0IGF1ZGlvIGNvZGVjJyk7XG4gICAgICAgIGlmKGF1ZGlvQ29kZWMuaW5kZXhPZignbXA0YS40MC41JykgIT09LTEpIHtcbiAgICAgICAgICBhdWRpb0NvZGVjID0gJ21wNGEuNDAuMic7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYXVkaW9Db2RlYyA9ICdtcDRhLjQwLjUnO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBsb2dnZXIubG9nKGBwbGF5bGlzdF9sZXZlbC9pbml0X3NlZ21lbnQgY29kZWNzOiB2aWRlbyA9PiAke3ZpZGVvQ29kZWN9LyR7ZGF0YS52aWRlb0NvZGVjfTsgYXVkaW8gPT4gJHthdWRpb0NvZGVjfS8ke2RhdGEuYXVkaW9Db2RlY31gKTtcbiAgICAgIC8vIGlmIHBsYXlsaXN0IGRvZXMgbm90IHNwZWNpZnkgY29kZWNzLCB1c2UgY29kZWNzIGZvdW5kIHdoaWxlIHBhcnNpbmcgZnJhZ21lbnRcbiAgICAgIC8vIGlmIG5vIGNvZGVjIGZvdW5kIHdoaWxlIHBhcnNpbmcgZnJhZ21lbnQsIGFsc28gc2V0IGNvZGVjIHRvIHVuZGVmaW5lZCB0byBhdm9pZCBjcmVhdGluZyBzb3VyY2VCdWZmZXJcbiAgICAgIGlmIChhdWRpb0NvZGVjID09PSB1bmRlZmluZWQgfHwgZGF0YS5hdWRpb0NvZGVjID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgYXVkaW9Db2RlYyA9IGRhdGEuYXVkaW9Db2RlYztcbiAgICAgIH1cblxuICAgICAgaWYgKHZpZGVvQ29kZWMgPT09IHVuZGVmaW5lZCAgfHwgZGF0YS52aWRlb0NvZGVjID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdmlkZW9Db2RlYyA9IGRhdGEudmlkZW9Db2RlYztcbiAgICAgIH1cbiAgICAgIC8vIGluIGNhc2Ugc2V2ZXJhbCBhdWRpbyBjb2RlY3MgbWlnaHQgYmUgdXNlZCwgZm9yY2UgSEUtQUFDIGZvciBhdWRpbyAoc29tZSBicm93c2VycyBkb24ndCBzdXBwb3J0IGF1ZGlvIGNvZGVjIHN3aXRjaClcbiAgICAgIC8vZG9uJ3QgZG8gaXQgZm9yIG1vbm8gc3RyZWFtcyAuLi5cbiAgICAgIHZhciB1YSA9IG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKTtcbiAgICAgIGlmICh0aGlzLmF1ZGlvY29kZWNzd2l0Y2ggJiZcbiAgICAgICAgIGRhdGEuYXVkaW9DaGFubmVsQ291bnQgIT09IDEgJiZcbiAgICAgICAgICB1YS5pbmRleE9mKCdhbmRyb2lkJykgPT09IC0xICYmXG4gICAgICAgICAgdWEuaW5kZXhPZignZmlyZWZveCcpID09PSAtMSkge1xuICAgICAgICBhdWRpb0NvZGVjID0gJ21wNGEuNDAuNSc7XG4gICAgICB9XG4gICAgICBpZiAoIXRoaXMuc291cmNlQnVmZmVyKSB7XG4gICAgICAgIHRoaXMuc291cmNlQnVmZmVyID0ge307XG4gICAgICAgIGxvZ2dlci5sb2coYHNlbGVjdGVkIEEvViBjb2RlY3MgZm9yIHNvdXJjZUJ1ZmZlcnM6JHthdWRpb0NvZGVjfSwke3ZpZGVvQ29kZWN9YCk7XG4gICAgICAgIC8vIGNyZWF0ZSBzb3VyY2UgQnVmZmVyIGFuZCBsaW5rIHRoZW0gdG8gTWVkaWFTb3VyY2VcbiAgICAgICAgaWYgKGF1ZGlvQ29kZWMpIHtcbiAgICAgICAgICBzYiA9IHRoaXMuc291cmNlQnVmZmVyLmF1ZGlvID0gdGhpcy5tZWRpYVNvdXJjZS5hZGRTb3VyY2VCdWZmZXIoYHZpZGVvL21wNDtjb2RlY3M9JHthdWRpb0NvZGVjfWApO1xuICAgICAgICAgIHNiLmFkZEV2ZW50TGlzdGVuZXIoJ3VwZGF0ZWVuZCcsIHRoaXMub25zYnVlKTtcbiAgICAgICAgICBzYi5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsIHRoaXMub25zYmUpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh2aWRlb0NvZGVjKSB7XG4gICAgICAgICAgc2IgPSB0aGlzLnNvdXJjZUJ1ZmZlci52aWRlbyA9IHRoaXMubWVkaWFTb3VyY2UuYWRkU291cmNlQnVmZmVyKGB2aWRlby9tcDQ7Y29kZWNzPSR7dmlkZW9Db2RlY31gKTtcbiAgICAgICAgICBzYi5hZGRFdmVudExpc3RlbmVyKCd1cGRhdGVlbmQnLCB0aGlzLm9uc2J1ZSk7XG4gICAgICAgICAgc2IuYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLCB0aGlzLm9uc2JlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKGF1ZGlvQ29kZWMpIHtcbiAgICAgICAgdGhpcy5tcDRzZWdtZW50cy5wdXNoKHt0eXBlOiAnYXVkaW8nLCBkYXRhOiBkYXRhLmF1ZGlvTW9vdn0pO1xuICAgICAgfVxuICAgICAgaWYodmlkZW9Db2RlYykge1xuICAgICAgICB0aGlzLm1wNHNlZ21lbnRzLnB1c2goe3R5cGU6ICd2aWRlbycsIGRhdGE6IGRhdGEudmlkZW9Nb292fSk7XG4gICAgICB9XG4gICAgICAvL3RyaWdnZXIgaGFuZGxlciByaWdodCBub3dcbiAgICAgIHRoaXMudGljaygpO1xuICAgIH1cbiAgfVxuXG4gIG9uRnJhZ1BhcnNpbmdEYXRhKGRhdGEpIHtcbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gU3RhdGUuUEFSU0lORykge1xuICAgICAgdGhpcy50cGFyc2UyID0gRGF0ZS5ub3coKTtcbiAgICAgIHZhciBsZXZlbCA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdLFxuICAgICAgICAgIGZyYWcgPSB0aGlzLmZyYWdDdXJyZW50O1xuICAgICAgbG9nZ2VyLmxvZyhgcGFyc2VkICR7ZGF0YS50eXBlfSxQVFM6WyR7ZGF0YS5zdGFydFBUUy50b0ZpeGVkKDMpfSwke2RhdGEuZW5kUFRTLnRvRml4ZWQoMyl9XSxEVFM6WyR7ZGF0YS5zdGFydERUUy50b0ZpeGVkKDMpfS8ke2RhdGEuZW5kRFRTLnRvRml4ZWQoMyl9XSxuYjoke2RhdGEubmJ9YCk7XG4gICAgICB2YXIgZHJpZnQgPSBMZXZlbEhlbHBlci51cGRhdGVGcmFnUFRTKGxldmVsLmRldGFpbHMsZnJhZy5zbixkYXRhLnN0YXJ0UFRTLGRhdGEuZW5kUFRTKTtcbiAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuTEVWRUxfUFRTX1VQREFURUQsIHtkZXRhaWxzOiBsZXZlbC5kZXRhaWxzLCBsZXZlbDogdGhpcy5sZXZlbCwgZHJpZnQ6IGRyaWZ0fSk7XG5cbiAgICAgIHRoaXMubXA0c2VnbWVudHMucHVzaCh7dHlwZTogZGF0YS50eXBlLCBkYXRhOiBkYXRhLm1vb2Z9KTtcbiAgICAgIHRoaXMubXA0c2VnbWVudHMucHVzaCh7dHlwZTogZGF0YS50eXBlLCBkYXRhOiBkYXRhLm1kYXR9KTtcbiAgICAgIHRoaXMubmV4dExvYWRQb3NpdGlvbiA9IGRhdGEuZW5kUFRTO1xuICAgICAgdGhpcy5idWZmZXJSYW5nZS5wdXNoKHt0eXBlOiBkYXRhLnR5cGUsIHN0YXJ0OiBkYXRhLnN0YXJ0UFRTLCBlbmQ6IGRhdGEuZW5kUFRTLCBmcmFnOiBmcmFnfSk7XG5cbiAgICAgIC8vdHJpZ2dlciBoYW5kbGVyIHJpZ2h0IG5vd1xuICAgICAgdGhpcy50aWNrKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvZ2dlci53YXJuKGBub3QgaW4gUEFSU0lORyBzdGF0ZSwgaWdub3JpbmcgRlJBR19QQVJTSU5HX0RBVEEgZXZlbnRgKTtcbiAgICB9XG4gIH1cblxuICBvbkZyYWdQYXJzZWQoKSB7XG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IFN0YXRlLlBBUlNJTkcpIHtcbiAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5QQVJTRUQ7XG4gICAgICB0aGlzLnN0YXRzLnRwYXJzZWQgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgIC8vdHJpZ2dlciBoYW5kbGVyIHJpZ2h0IG5vd1xuICAgICAgdGhpcy50aWNrKCk7XG4gICAgfVxuICB9XG5cbiAgb25FcnJvcihkYXRhKSB7XG4gICAgc3dpdGNoKGRhdGEuZGV0YWlscykge1xuICAgICAgY2FzZSBFcnJvckRldGFpbHMuRlJBR19MT0FEX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuRlJBR19MT0FEX1RJTUVPVVQ6XG4gICAgICAgIGlmKCFkYXRhLmZhdGFsKSB7XG4gICAgICAgICAgdmFyIGxvYWRFcnJvciA9IHRoaXMuZnJhZ0xvYWRFcnJvcjtcbiAgICAgICAgICBpZihsb2FkRXJyb3IpIHtcbiAgICAgICAgICAgIGxvYWRFcnJvcisrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsb2FkRXJyb3I9MTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGxvYWRFcnJvciA8PSB0aGlzLmNvbmZpZy5mcmFnTG9hZGluZ01heFJldHJ5KSB7XG4gICAgICAgICAgICB0aGlzLmZyYWdMb2FkRXJyb3IgPSBsb2FkRXJyb3I7XG4gICAgICAgICAgICAvLyByZXNldCBsb2FkIGNvdW50ZXIgdG8gYXZvaWQgZnJhZyBsb29wIGxvYWRpbmcgZXJyb3JcbiAgICAgICAgICAgIGRhdGEuZnJhZy5sb2FkQ291bnRlciA9IDA7XG4gICAgICAgICAgICAvLyBleHBvbmVudGlhbCBiYWNrb2ZmIGNhcHBlZCB0byA2NHNcbiAgICAgICAgICAgIHZhciBkZWxheSA9IE1hdGgubWluKE1hdGgucG93KDIsbG9hZEVycm9yLTEpKnRoaXMuY29uZmlnLmZyYWdMb2FkaW5nUmV0cnlEZWxheSw2NDAwMCk7XG4gICAgICAgICAgICBsb2dnZXIud2FybihgbWVkaWFDb250cm9sbGVyOiBmcmFnIGxvYWRpbmcgZmFpbGVkLCByZXRyeSBpbiAke2RlbGF5fSBtc2ApO1xuICAgICAgICAgICAgdGhpcy5yZXRyeURhdGUgPSBwZXJmb3JtYW5jZS5ub3coKSArIGRlbGF5O1xuICAgICAgICAgICAgLy8gcmV0cnkgbG9hZGluZyBzdGF0ZVxuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLkZSQUdfTE9BRElOR19XQUlUSU5HX1JFVFJZO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsb2dnZXIuZXJyb3IoYG1lZGlhQ29udHJvbGxlcjogJHtkYXRhLmRldGFpbHN9IHJlYWNoZXMgbWF4IHJldHJ5LCByZWRpc3BhdGNoIGFzIGZhdGFsIC4uLmApO1xuICAgICAgICAgICAgLy8gcmVkaXNwYXRjaCBzYW1lIGVycm9yIGJ1dCB3aXRoIGZhdGFsIHNldCB0byB0cnVlXG4gICAgICAgICAgICBkYXRhLmZhdGFsID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIGRhdGEpO1xuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLkVSUk9SO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkZSQUdfTE9PUF9MT0FESU5HX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuTEVWRUxfTE9BRF9FUlJPUjpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkxFVkVMX0xPQURfVElNRU9VVDpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLktFWV9MT0FEX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuS0VZX0xPQURfVElNRU9VVDpcbiAgICAgICAgLy8gaWYgZmF0YWwgZXJyb3IsIHN0b3AgcHJvY2Vzc2luZywgb3RoZXJ3aXNlIG1vdmUgdG8gSURMRSB0byByZXRyeSBsb2FkaW5nXG4gICAgICAgIGxvZ2dlci53YXJuKGBtZWRpYUNvbnRyb2xsZXI6ICR7ZGF0YS5kZXRhaWxzfSB3aGlsZSBsb2FkaW5nIGZyYWcsc3dpdGNoIHRvICR7ZGF0YS5mYXRhbCA/ICdFUlJPUicgOiAnSURMRSd9IHN0YXRlIC4uLmApO1xuICAgICAgICB0aGlzLnN0YXRlID0gZGF0YS5mYXRhbCA/IFN0YXRlLkVSUk9SIDogU3RhdGUuSURMRTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICBvblNCVXBkYXRlRW5kKCkge1xuICAgIC8vdHJpZ2dlciBoYW5kbGVyIHJpZ2h0IG5vd1xuICAgIGlmICh0aGlzLnN0YXRlID09PSBTdGF0ZS5BUFBFTkRJTkcgJiYgdGhpcy5tcDRzZWdtZW50cy5sZW5ndGggPT09IDApICB7XG4gICAgICB2YXIgZnJhZyA9IHRoaXMuZnJhZ0N1cnJlbnQsIHN0YXRzID0gdGhpcy5zdGF0cztcbiAgICAgIGlmIChmcmFnKSB7XG4gICAgICAgIHRoaXMuZnJhZ1ByZXZpb3VzID0gZnJhZztcbiAgICAgICAgc3RhdHMudGJ1ZmZlcmVkID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICAgIHRoaXMuZnJhZ0xhc3RLYnBzID0gTWF0aC5yb3VuZCg4ICogc3RhdHMubGVuZ3RoIC8gKHN0YXRzLnRidWZmZXJlZCAtIHN0YXRzLnRmaXJzdCkpO1xuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkZSQUdfQlVGRkVSRUQsIHtzdGF0czogc3RhdHMsIGZyYWc6IGZyYWd9KTtcbiAgICAgICAgbG9nZ2VyLmxvZyhgbWVkaWEgYnVmZmVyZWQgOiAke3RoaXMudGltZVJhbmdlc1RvU3RyaW5nKHRoaXMubWVkaWEuYnVmZmVyZWQpfWApO1xuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuX2NoZWNrQnVmZmVyKCkge1xuICAgIHZhciBtZWRpYSA9IHRoaXMubWVkaWE7XG4gICAgaWYobWVkaWEpIHtcbiAgICAgIC8vIGNvbXBhcmUgcmVhZHlTdGF0ZVxuICAgICAgdmFyIHJlYWR5U3RhdGUgPSBtZWRpYS5yZWFkeVN0YXRlO1xuICAgICAgLy8gaWYgcmVhZHkgc3RhdGUgZGlmZmVyZW50IGZyb20gSEFWRV9OT1RISU5HIChudW1lcmljIHZhbHVlIDApLCB3ZSBhcmUgYWxsb3dlZCB0byBzZWVrXG4gICAgICBpZihyZWFkeVN0YXRlKSB7XG4gICAgICAgIC8vIGlmIHNlZWsgYWZ0ZXIgYnVmZmVyZWQgZGVmaW5lZCwgbGV0J3Mgc2VlayBpZiB3aXRoaW4gYWNjZXB0YWJsZSByYW5nZVxuICAgICAgICB2YXIgc2Vla0FmdGVyQnVmZmVyZWQgPSB0aGlzLnNlZWtBZnRlckJ1ZmZlcmVkO1xuICAgICAgICBpZihzZWVrQWZ0ZXJCdWZmZXJlZCkge1xuICAgICAgICAgIGlmKG1lZGlhLmR1cmF0aW9uID49IHNlZWtBZnRlckJ1ZmZlcmVkKSB7XG4gICAgICAgICAgICBtZWRpYS5jdXJyZW50VGltZSA9IHNlZWtBZnRlckJ1ZmZlcmVkO1xuICAgICAgICAgICAgdGhpcy5zZWVrQWZ0ZXJCdWZmZXJlZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFyIGN1cnJlbnRUaW1lID0gbWVkaWEuY3VycmVudFRpbWUsXG4gICAgICAgICAgICAgIGJ1ZmZlckluZm8gPSB0aGlzLmJ1ZmZlckluZm8oY3VycmVudFRpbWUsMCksXG4gICAgICAgICAgICAgIGlzUGxheWluZyA9ICEobWVkaWEucGF1c2VkIHx8IG1lZGlhLmVuZGVkIHx8IG1lZGlhLnNlZWtpbmcgfHwgcmVhZHlTdGF0ZSA8IDMpLFxuICAgICAgICAgICAgICBqdW1wVGhyZXNob2xkID0gMC4yLFxuICAgICAgICAgICAgICBwbGF5aGVhZE1vdmluZyA9IGN1cnJlbnRUaW1lID4gbWVkaWEucGxheWJhY2tSYXRlKnRoaXMubGFzdEN1cnJlbnRUaW1lO1xuXG4gICAgICAgICAgaWYgKHRoaXMuc3RhbGxlZCAmJiBwbGF5aGVhZE1vdmluZykge1xuICAgICAgICAgICAgdGhpcy5zdGFsbGVkID0gZmFsc2U7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gY2hlY2sgYnVmZmVyIHVwZnJvbnRcbiAgICAgICAgICAvLyBpZiBsZXNzIHRoYW4gMjAwbXMgaXMgYnVmZmVyZWQsIGFuZCBtZWRpYSBpcyBwbGF5aW5nIGJ1dCBwbGF5aGVhZCBpcyBub3QgbW92aW5nLFxuICAgICAgICAgIC8vIGFuZCB3ZSBoYXZlIGEgbmV3IGJ1ZmZlciByYW5nZSBhdmFpbGFibGUgdXBmcm9udCwgbGV0J3Mgc2VlayB0byB0aGF0IG9uZVxuICAgICAgICAgIGlmKGJ1ZmZlckluZm8ubGVuIDw9IGp1bXBUaHJlc2hvbGQpIHtcbiAgICAgICAgICAgIGlmKHBsYXloZWFkTW92aW5nIHx8ICFpc1BsYXlpbmcpIHtcbiAgICAgICAgICAgICAgLy8gcGxheWhlYWQgbW92aW5nIG9yIG1lZGlhIG5vdCBwbGF5aW5nXG4gICAgICAgICAgICAgIGp1bXBUaHJlc2hvbGQgPSAwO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gcGxheWhlYWQgbm90IG1vdmluZyBBTkQgbWVkaWEgcGxheWluZ1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKCdwbGF5YmFjayBzZWVtcyBzdHVjaycpO1xuICAgICAgICAgICAgICBpZighdGhpcy5zdGFsbGVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5CVUZGRVJfU1RBTExFRF9FUlJPUiwgZmF0YWw6IGZhbHNlfSk7XG4gICAgICAgICAgICAgICAgdGhpcy5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gaWYgd2UgYXJlIGJlbG93IHRocmVzaG9sZCwgdHJ5IHRvIGp1bXAgaWYgbmV4dCBidWZmZXIgcmFuZ2UgaXMgY2xvc2VcbiAgICAgICAgICAgIGlmKGJ1ZmZlckluZm8ubGVuIDw9IGp1bXBUaHJlc2hvbGQpIHtcbiAgICAgICAgICAgICAgLy8gbm8gYnVmZmVyIGF2YWlsYWJsZSBAIGN1cnJlbnRUaW1lLCBjaGVjayBpZiBuZXh0IGJ1ZmZlciBpcyBjbG9zZSAobW9yZSB0aGFuIDVtcyBkaWZmIGJ1dCB3aXRoaW4gYSBjb25maWcubWF4U2Vla0hvbGUgc2Vjb25kIHJhbmdlKVxuICAgICAgICAgICAgICB2YXIgbmV4dEJ1ZmZlclN0YXJ0ID0gYnVmZmVySW5mby5uZXh0U3RhcnQsIGRlbHRhID0gbmV4dEJ1ZmZlclN0YXJ0LWN1cnJlbnRUaW1lO1xuICAgICAgICAgICAgICBpZihuZXh0QnVmZmVyU3RhcnQgJiZcbiAgICAgICAgICAgICAgICAgKGRlbHRhIDwgdGhpcy5jb25maWcubWF4U2Vla0hvbGUpICYmXG4gICAgICAgICAgICAgICAgIChkZWx0YSA+IDAuMDA1KSAgJiZcbiAgICAgICAgICAgICAgICAgIW1lZGlhLnNlZWtpbmcpIHtcbiAgICAgICAgICAgICAgICAvLyBuZXh0IGJ1ZmZlciBpcyBjbG9zZSAhIGFkanVzdCBjdXJyZW50VGltZSB0byBuZXh0QnVmZmVyU3RhcnRcbiAgICAgICAgICAgICAgICAvLyB0aGlzIHdpbGwgZW5zdXJlIGVmZmVjdGl2ZSB2aWRlbyBkZWNvZGluZ1xuICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYGFkanVzdCBjdXJyZW50VGltZSBmcm9tICR7Y3VycmVudFRpbWV9IHRvICR7bmV4dEJ1ZmZlclN0YXJ0fWApO1xuICAgICAgICAgICAgICAgIG1lZGlhLmN1cnJlbnRUaW1lID0gbmV4dEJ1ZmZlclN0YXJ0O1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgc3dhcEF1ZGlvQ29kZWMoKSB7XG4gICAgdGhpcy5hdWRpb0NvZGVjU3dhcCA9ICF0aGlzLmF1ZGlvQ29kZWNTd2FwO1xuICB9XG5cbiAgb25TQlVwZGF0ZUVycm9yKGV2ZW50KSB7XG4gICAgbG9nZ2VyLmVycm9yKGBzb3VyY2VCdWZmZXIgZXJyb3I6JHtldmVudH1gKTtcbiAgICB0aGlzLnN0YXRlID0gU3RhdGUuRVJST1I7XG4gICAgLy8gYWNjb3JkaW5nIHRvIGh0dHA6Ly93d3cudzMub3JnL1RSL21lZGlhLXNvdXJjZS8jc291cmNlYnVmZmVyLWFwcGVuZC1lcnJvclxuICAgIC8vIHRoaXMgZXJyb3IgbWlnaHQgbm90IGFsd2F5cyBiZSBmYXRhbCAoaXQgaXMgZmF0YWwgaWYgZGVjb2RlIGVycm9yIGlzIHNldCwgaW4gdGhhdCBjYXNlXG4gICAgLy8gaXQgd2lsbCBiZSBmb2xsb3dlZCBieSBhIG1lZGlhRWxlbWVudCBlcnJvciAuLi4pXG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5CVUZGRVJfQVBQRU5ESU5HX0VSUk9SLCBmYXRhbDogZmFsc2UsIGZyYWc6IHRoaXMuZnJhZ0N1cnJlbnR9KTtcbiAgfVxuXG4gIHRpbWVSYW5nZXNUb1N0cmluZyhyKSB7XG4gICAgdmFyIGxvZyA9ICcnLCBsZW4gPSByLmxlbmd0aDtcbiAgICBmb3IgKHZhciBpPTA7IGk8bGVuOyBpKyspIHtcbiAgICAgIGxvZyArPSAnWycgKyByLnN0YXJ0KGkpICsgJywnICsgci5lbmQoaSkgKyAnXSc7XG4gICAgfVxuICAgIHJldHVybiBsb2c7XG4gIH1cblxuICBvbk1lZGlhU291cmNlT3BlbigpIHtcbiAgICBsb2dnZXIubG9nKCdtZWRpYSBzb3VyY2Ugb3BlbmVkJyk7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5NRURJQV9BVFRBQ0hFRCk7XG4gICAgdGhpcy5vbnZzZWVraW5nID0gdGhpcy5vbk1lZGlhU2Vla2luZy5iaW5kKHRoaXMpO1xuICAgIHRoaXMub252c2Vla2VkID0gdGhpcy5vbk1lZGlhU2Vla2VkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbnZtZXRhZGF0YSA9IHRoaXMub25NZWRpYU1ldGFkYXRhLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbnZlbmRlZCA9IHRoaXMub25NZWRpYUVuZGVkLmJpbmQodGhpcyk7XG4gICAgdmFyIG1lZGlhID0gdGhpcy5tZWRpYTtcbiAgICBtZWRpYS5hZGRFdmVudExpc3RlbmVyKCdzZWVraW5nJywgdGhpcy5vbnZzZWVraW5nKTtcbiAgICBtZWRpYS5hZGRFdmVudExpc3RlbmVyKCdzZWVrZWQnLCB0aGlzLm9udnNlZWtlZCk7XG4gICAgbWVkaWEuYWRkRXZlbnRMaXN0ZW5lcignbG9hZGVkbWV0YWRhdGEnLCB0aGlzLm9udm1ldGFkYXRhKTtcbiAgICBtZWRpYS5hZGRFdmVudExpc3RlbmVyKCdlbmRlZCcsIHRoaXMub252ZW5kZWQpO1xuICAgIGlmKHRoaXMubGV2ZWxzICYmIHRoaXMuY29uZmlnLmF1dG9TdGFydExvYWQpIHtcbiAgICAgIHRoaXMuc3RhcnRMb2FkKCk7XG4gICAgfVxuICAgIC8vIG9uY2UgcmVjZWl2ZWQsIGRvbid0IGxpc3RlbiBhbnltb3JlIHRvIHNvdXJjZW9wZW4gZXZlbnRcbiAgICB0aGlzLm1lZGlhU291cmNlLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NvdXJjZW9wZW4nLCB0aGlzLm9ubXNvKTtcbiAgfVxuXG4gIG9uTWVkaWFTb3VyY2VDbG9zZSgpIHtcbiAgICBsb2dnZXIubG9nKCdtZWRpYSBzb3VyY2UgY2xvc2VkJyk7XG4gIH1cblxuICBvbk1lZGlhU291cmNlRW5kZWQoKSB7XG4gICAgbG9nZ2VyLmxvZygnbWVkaWEgc291cmNlIGVuZGVkJyk7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IE1TRU1lZGlhQ29udHJvbGxlcjtcblxuIiwiLypcbiAqIFRpbWVsaW5lIENvbnRyb2xsZXJcbiovXG5cbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IENFQTcwOEludGVycHJldGVyIGZyb20gJy4uL3V0aWxzL2NlYS03MDgtaW50ZXJwcmV0ZXInO1xuXG5jbGFzcyBUaW1lbGluZUNvbnRyb2xsZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHRoaXMuaGxzID0gaGxzO1xuICAgIHRoaXMuY29uZmlnID0gaGxzLmNvbmZpZztcblxuICAgIGlmICh0aGlzLmNvbmZpZy5lbmFibGVDRUE3MDhDYXB0aW9ucylcbiAgICB7XG4gICAgICB0aGlzLm9ubWVkaWFhdHQwID0gdGhpcy5vbk1lZGlhQXR0YWNoaW5nLmJpbmQodGhpcyk7XG4gICAgICB0aGlzLm9ubWVkaWFkZXQwID0gdGhpcy5vbk1lZGlhRGV0YWNoaW5nLmJpbmQodGhpcyk7XG4gICAgICB0aGlzLm9udWQgPSB0aGlzLm9uRnJhZ1BhcnNpbmdVc2VyRGF0YS5iaW5kKHRoaXMpO1xuICAgICAgdGhpcy5vbmZsID0gdGhpcy5vbkZyYWdMb2FkZWQuYmluZCh0aGlzKTtcbiAgICAgIHRoaXMub25tbCA9IHRoaXMub25NYW5pZmVzdExvYWRpbmcuYmluZCh0aGlzKTtcbiAgICAgIGhscy5vbihFdmVudC5NRURJQV9BVFRBQ0hJTkcsIHRoaXMub25tZWRpYWF0dDApO1xuICAgICAgaGxzLm9uKEV2ZW50Lk1FRElBX0RFVEFDSElORywgdGhpcy5vbm1lZGlhZGV0MCk7XG4gICAgICBobHMub24oRXZlbnQuRlJBR19QQVJTSU5HX1VTRVJEQVRBLCB0aGlzLm9udWQpO1xuICAgICAgaGxzLm9uKEV2ZW50Lk1BTklGRVNUX0xPQURJTkcsIHRoaXMub25tbCk7XG4gICAgICBobHMub24oRXZlbnQuRlJBR19MT0FERUQsIHRoaXMub25mbCk7XG5cbiAgICAgIHRoaXMuY2VhNzA4SW50ZXJwcmV0ZXIgPSBuZXcgQ0VBNzA4SW50ZXJwcmV0ZXIoKTtcbiAgICB9XG4gIH1cblxuICBkZXN0cm95KCkge1xuICB9XG5cbiAgb25NZWRpYUF0dGFjaGluZyhldmVudCwgZGF0YSkge1xuICAgIHZhciBtZWRpYSA9IHRoaXMubWVkaWEgPSBkYXRhLm1lZGlhO1xuICAgIHRoaXMuY2VhNzA4SW50ZXJwcmV0ZXIuYXR0YWNoKG1lZGlhKTtcbiAgfVxuXG4gIG9uTWVkaWFEZXRhY2hpbmcoKSB7XG4gICAgdGhpcy5jZWE3MDhJbnRlcnByZXRlci5kZXRhdGNoKCk7XG4gIH1cblxuICBvbk1hbmlmZXN0TG9hZGluZygpXG4gIHtcbiAgICB0aGlzLmxhc3RQdHMgPSBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7XG4gIH1cblxuICBvbkZyYWdMb2FkZWQoZXZlbnQsIGRhdGEpXG4gIHtcbiAgICB2YXIgcHRzID0gZGF0YS5mcmFnLnN0YXJ0OyAvL051bWJlci5QT1NJVElWRV9JTkZJTklUWTtcblxuICAgIC8vIGlmIHRoaXMgaXMgYSBmcmFnIGZvciBhIHByZXZpb3VzbHkgbG9hZGVkIHRpbWVyYW5nZSwgcmVtb3ZlIGFsbCBjYXB0aW9uc1xuICAgIC8vIFRPRE86IGNvbnNpZGVyIGp1c3QgcmVtb3ZpbmcgY2FwdGlvbnMgZm9yIHRoZSB0aW1lcmFuZ2VcbiAgICBpZiAocHRzIDwgdGhpcy5sYXN0UHRzKVxuICAgIHtcbiAgICAgIHRoaXMuY2VhNzA4SW50ZXJwcmV0ZXIuY2xlYXIoKTtcbiAgICB9XG5cbiAgICB0aGlzLmxhc3RQdHMgPSBwdHM7XG4gIH1cblxuICBvbkZyYWdQYXJzaW5nVXNlckRhdGEoZXZlbnQsIGRhdGEpIHtcbiAgICAvLyBwdXNoIGFsbCBvZiB0aGUgQ0VBLTcwOCBtZXNzYWdlcyBpbnRvIHRoZSBpbnRlcnByZXRlclxuICAgIC8vIGltbWVkaWF0ZWx5LiBJdCB3aWxsIGNyZWF0ZSB0aGUgcHJvcGVyIHRpbWVzdGFtcHMgYmFzZWQgb24gb3VyIFBUUyB2YWx1ZVxuICAgIGZvciAodmFyIGk9MDsgaTxkYXRhLnNhbXBsZXMubGVuZ3RoOyBpKyspXG4gICAge1xuICAgICAgdGhpcy5jZWE3MDhJbnRlcnByZXRlci5wdXNoKGRhdGEuc2FtcGxlc1tpXS5wdHMsIGRhdGEuc2FtcGxlc1tpXS5ieXRlcyk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFRpbWVsaW5lQ29udHJvbGxlcjsiLCIvKlxuICpcbiAqIFRoaXMgZmlsZSBjb250YWlucyBhbiBhZGFwdGF0aW9uIG9mIHRoZSBBRVMgZGVjcnlwdGlvbiBhbGdvcml0aG1cbiAqIGZyb20gdGhlIFN0YW5kZm9yZCBKYXZhc2NyaXB0IENyeXB0b2dyYXBoeSBMaWJyYXJ5LiBUaGF0IHdvcmsgaXNcbiAqIGNvdmVyZWQgYnkgdGhlIGZvbGxvd2luZyBjb3B5cmlnaHQgYW5kIHBlcm1pc3Npb25zIG5vdGljZTpcbiAqXG4gKiBDb3B5cmlnaHQgMjAwOS0yMDEwIEVtaWx5IFN0YXJrLCBNaWtlIEhhbWJ1cmcsIERhbiBCb25laC5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogUmVkaXN0cmlidXRpb24gYW5kIHVzZSBpbiBzb3VyY2UgYW5kIGJpbmFyeSBmb3Jtcywgd2l0aCBvciB3aXRob3V0XG4gKiBtb2RpZmljYXRpb24sIGFyZSBwZXJtaXR0ZWQgcHJvdmlkZWQgdGhhdCB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnMgYXJlXG4gKiBtZXQ6XG4gKlxuICogMS4gUmVkaXN0cmlidXRpb25zIG9mIHNvdXJjZSBjb2RlIG11c3QgcmV0YWluIHRoZSBhYm92ZSBjb3B5cmlnaHRcbiAqICAgIG5vdGljZSwgdGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmcgZGlzY2xhaW1lci5cbiAqXG4gKiAyLiBSZWRpc3RyaWJ1dGlvbnMgaW4gYmluYXJ5IGZvcm0gbXVzdCByZXByb2R1Y2UgdGhlIGFib3ZlXG4gKiAgICBjb3B5cmlnaHQgbm90aWNlLCB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZ1xuICogICAgZGlzY2xhaW1lciBpbiB0aGUgZG9jdW1lbnRhdGlvbiBhbmQvb3Igb3RoZXIgbWF0ZXJpYWxzIHByb3ZpZGVkXG4gKiAgICB3aXRoIHRoZSBkaXN0cmlidXRpb24uXG4gKlxuICogVEhJUyBTT0ZUV0FSRSBJUyBQUk9WSURFRCBCWSBUSEUgQVVUSE9SUyBgYEFTIElTJycgQU5EIEFOWSBFWFBSRVNTIE9SXG4gKiBJTVBMSUVEIFdBUlJBTlRJRVMsIElOQ0xVRElORywgQlVUIE5PVCBMSU1JVEVEIFRPLCBUSEUgSU1QTElFRFxuICogV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFkgQU5EIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFSRVxuICogRElTQ0xBSU1FRC4gSU4gTk8gRVZFTlQgU0hBTEwgPENPUFlSSUdIVCBIT0xERVI+IE9SIENPTlRSSUJVVE9SUyBCRVxuICogTElBQkxFIEZPUiBBTlkgRElSRUNULCBJTkRJUkVDVCwgSU5DSURFTlRBTCwgU1BFQ0lBTCwgRVhFTVBMQVJZLCBPUlxuICogQ09OU0VRVUVOVElBTCBEQU1BR0VTIChJTkNMVURJTkcsIEJVVCBOT1QgTElNSVRFRCBUTywgUFJPQ1VSRU1FTlQgT0ZcbiAqIFNVQlNUSVRVVEUgR09PRFMgT1IgU0VSVklDRVM7IExPU1MgT0YgVVNFLCBEQVRBLCBPUiBQUk9GSVRTOyBPUlxuICogQlVTSU5FU1MgSU5URVJSVVBUSU9OKSBIT1dFVkVSIENBVVNFRCBBTkQgT04gQU5ZIFRIRU9SWSBPRiBMSUFCSUxJVFksXG4gKiBXSEVUSEVSIElOIENPTlRSQUNULCBTVFJJQ1QgTElBQklMSVRZLCBPUiBUT1JUIChJTkNMVURJTkcgTkVHTElHRU5DRVxuICogT1IgT1RIRVJXSVNFKSBBUklTSU5HIElOIEFOWSBXQVkgT1VUIE9GIFRIRSBVU0UgT0YgVEhJUyBTT0ZUV0FSRSwgRVZFTlxuICogSUYgQURWSVNFRCBPRiBUSEUgUE9TU0lCSUxJVFkgT0YgU1VDSCBEQU1BR0UuXG4gKlxuICogVGhlIHZpZXdzIGFuZCBjb25jbHVzaW9ucyBjb250YWluZWQgaW4gdGhlIHNvZnR3YXJlIGFuZCBkb2N1bWVudGF0aW9uXG4gKiBhcmUgdGhvc2Ugb2YgdGhlIGF1dGhvcnMgYW5kIHNob3VsZCBub3QgYmUgaW50ZXJwcmV0ZWQgYXMgcmVwcmVzZW50aW5nXG4gKiBvZmZpY2lhbCBwb2xpY2llcywgZWl0aGVyIGV4cHJlc3NlZCBvciBpbXBsaWVkLCBvZiB0aGUgYXV0aG9ycy5cbiAqL1xuY2xhc3MgQUVTIHtcblxuICAvKipcbiAgICogU2NoZWR1bGUgb3V0IGFuIEFFUyBrZXkgZm9yIGJvdGggZW5jcnlwdGlvbiBhbmQgZGVjcnlwdGlvbi4gVGhpc1xuICAgKiBpcyBhIGxvdy1sZXZlbCBjbGFzcy4gVXNlIGEgY2lwaGVyIG1vZGUgdG8gZG8gYnVsayBlbmNyeXB0aW9uLlxuICAgKlxuICAgKiBAY29uc3RydWN0b3JcbiAgICogQHBhcmFtIGtleSB7QXJyYXl9IFRoZSBrZXkgYXMgYW4gYXJyYXkgb2YgNCwgNiBvciA4IHdvcmRzLlxuICAgKi9cbiAgY29uc3RydWN0b3Ioa2V5KSB7XG4gICAgLyoqXG4gICAgICogVGhlIGV4cGFuZGVkIFMtYm94IGFuZCBpbnZlcnNlIFMtYm94IHRhYmxlcy4gVGhlc2Ugd2lsbCBiZSBjb21wdXRlZFxuICAgICAqIG9uIHRoZSBjbGllbnQgc28gdGhhdCB3ZSBkb24ndCBoYXZlIHRvIHNlbmQgdGhlbSBkb3duIHRoZSB3aXJlLlxuICAgICAqXG4gICAgICogVGhlcmUgYXJlIHR3byB0YWJsZXMsIF90YWJsZXNbMF0gaXMgZm9yIGVuY3J5cHRpb24gYW5kXG4gICAgICogX3RhYmxlc1sxXSBpcyBmb3IgZGVjcnlwdGlvbi5cbiAgICAgKlxuICAgICAqIFRoZSBmaXJzdCA0IHN1Yi10YWJsZXMgYXJlIHRoZSBleHBhbmRlZCBTLWJveCB3aXRoIE1peENvbHVtbnMuIFRoZVxuICAgICAqIGxhc3QgKF90YWJsZXNbMDFdWzRdKSBpcyB0aGUgUy1ib3ggaXRzZWxmLlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICB0aGlzLl90YWJsZXMgPSBbW1tdLFtdLFtdLFtdLFtdXSxbW10sW10sW10sW10sW11dXTtcblxuICAgIHRoaXMuX3ByZWNvbXB1dGUoKTtcblxuICAgIHZhciBpLCBqLCB0bXAsXG4gICAgZW5jS2V5LCBkZWNLZXksXG4gICAgc2JveCA9IHRoaXMuX3RhYmxlc1swXVs0XSwgZGVjVGFibGUgPSB0aGlzLl90YWJsZXNbMV0sXG4gICAga2V5TGVuID0ga2V5Lmxlbmd0aCwgcmNvbiA9IDE7XG5cbiAgICBpZiAoa2V5TGVuICE9PSA0ICYmIGtleUxlbiAhPT0gNiAmJiBrZXlMZW4gIT09IDgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBhZXMga2V5IHNpemU9JyArIGtleUxlbik7XG4gICAgfVxuXG4gICAgZW5jS2V5ID0ga2V5LnNsaWNlKDApO1xuICAgIGRlY0tleSA9IFtdO1xuICAgIHRoaXMuX2tleSA9IFtlbmNLZXksIGRlY0tleV07XG5cbiAgICAvLyBzY2hlZHVsZSBlbmNyeXB0aW9uIGtleXNcbiAgICBmb3IgKGkgPSBrZXlMZW47IGkgPCA0ICoga2V5TGVuICsgMjg7IGkrKykge1xuICAgICAgdG1wID0gZW5jS2V5W2ktMV07XG5cbiAgICAgIC8vIGFwcGx5IHNib3hcbiAgICAgIGlmIChpJWtleUxlbiA9PT0gMCB8fCAoa2V5TGVuID09PSA4ICYmIGkla2V5TGVuID09PSA0KSkge1xuICAgICAgICB0bXAgPSBzYm94W3RtcD4+PjI0XTw8MjQgXiBzYm94W3RtcD4+MTYmMjU1XTw8MTYgXiBzYm94W3RtcD4+OCYyNTVdPDw4IF4gc2JveFt0bXAmMjU1XTtcblxuICAgICAgICAvLyBzaGlmdCByb3dzIGFuZCBhZGQgcmNvblxuICAgICAgICBpZiAoaSVrZXlMZW4gPT09IDApIHtcbiAgICAgICAgICB0bXAgPSB0bXA8PDggXiB0bXA+Pj4yNCBeIHJjb248PDI0O1xuICAgICAgICAgIHJjb24gPSByY29uPDwxIF4gKHJjb24+PjcpKjI4MztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBlbmNLZXlbaV0gPSBlbmNLZXlbaS1rZXlMZW5dIF4gdG1wO1xuICAgIH1cblxuICAgIC8vIHNjaGVkdWxlIGRlY3J5cHRpb24ga2V5c1xuICAgIGZvciAoaiA9IDA7IGk7IGorKywgaS0tKSB7XG4gICAgICB0bXAgPSBlbmNLZXlbaiYzID8gaSA6IGkgLSA0XTtcbiAgICAgIGlmIChpPD00IHx8IGo8NCkge1xuICAgICAgICBkZWNLZXlbal0gPSB0bXA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkZWNLZXlbal0gPSBkZWNUYWJsZVswXVtzYm94W3RtcD4+PjI0ICAgICAgXV0gXlxuICAgICAgICAgIGRlY1RhYmxlWzFdW3Nib3hbdG1wPj4xNiAgJiAyNTVdXSBeXG4gICAgICAgICAgZGVjVGFibGVbMl1bc2JveFt0bXA+PjggICAmIDI1NV1dIF5cbiAgICAgICAgICBkZWNUYWJsZVszXVtzYm94W3RtcCAgICAgICYgMjU1XV07XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEV4cGFuZCB0aGUgUy1ib3ggdGFibGVzLlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3ByZWNvbXB1dGUoKSB7XG4gICAgdmFyIGVuY1RhYmxlID0gdGhpcy5fdGFibGVzWzBdLCBkZWNUYWJsZSA9IHRoaXMuX3RhYmxlc1sxXSxcbiAgICBzYm94ID0gZW5jVGFibGVbNF0sIHNib3hJbnYgPSBkZWNUYWJsZVs0XSxcbiAgICBpLCB4LCB4SW52LCBkPVtdLCB0aD1bXSwgeDIsIHg0LCB4OCwgcywgdEVuYywgdERlYztcblxuICAgIC8vIENvbXB1dGUgZG91YmxlIGFuZCB0aGlyZCB0YWJsZXNcbiAgICBmb3IgKGkgPSAwOyBpIDwgMjU2OyBpKyspIHtcbiAgICAgIHRoWyggZFtpXSA9IGk8PDEgXiAoaT4+NykqMjgzICleaV09aTtcbiAgICB9XG5cbiAgICBmb3IgKHggPSB4SW52ID0gMDsgIXNib3hbeF07IHggXj0geDIgfHwgMSwgeEludiA9IHRoW3hJbnZdIHx8IDEpIHtcbiAgICAgIC8vIENvbXB1dGUgc2JveFxuICAgICAgcyA9IHhJbnYgXiB4SW52PDwxIF4geEludjw8MiBeIHhJbnY8PDMgXiB4SW52PDw0O1xuICAgICAgcyA9IHM+PjggXiBzJjI1NSBeIDk5O1xuICAgICAgc2JveFt4XSA9IHM7XG4gICAgICBzYm94SW52W3NdID0geDtcblxuICAgICAgLy8gQ29tcHV0ZSBNaXhDb2x1bW5zXG4gICAgICB4OCA9IGRbeDQgPSBkW3gyID0gZFt4XV1dO1xuICAgICAgdERlYyA9IHg4KjB4MTAxMDEwMSBeIHg0KjB4MTAwMDEgXiB4MioweDEwMSBeIHgqMHgxMDEwMTAwO1xuICAgICAgdEVuYyA9IGRbc10qMHgxMDEgXiBzKjB4MTAxMDEwMDtcblxuICAgICAgZm9yIChpID0gMDsgaSA8IDQ7IGkrKykge1xuICAgICAgICBlbmNUYWJsZVtpXVt4XSA9IHRFbmMgPSB0RW5jPDwyNCBeIHRFbmM+Pj44O1xuICAgICAgICBkZWNUYWJsZVtpXVtzXSA9IHREZWMgPSB0RGVjPDwyNCBeIHREZWM+Pj44O1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIENvbXBhY3RpZnkuIENvbnNpZGVyYWJsZSBzcGVlZHVwIG9uIEZpcmVmb3guXG4gICAgZm9yIChpID0gMDsgaSA8IDU7IGkrKykge1xuICAgICAgZW5jVGFibGVbaV0gPSBlbmNUYWJsZVtpXS5zbGljZSgwKTtcbiAgICAgIGRlY1RhYmxlW2ldID0gZGVjVGFibGVbaV0uc2xpY2UoMCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIERlY3J5cHQgMTYgYnl0ZXMsIHNwZWNpZmllZCBhcyBmb3VyIDMyLWJpdCB3b3Jkcy5cbiAgICogQHBhcmFtIGVuY3J5cHRlZDAge251bWJlcn0gdGhlIGZpcnN0IHdvcmQgdG8gZGVjcnlwdFxuICAgKiBAcGFyYW0gZW5jcnlwdGVkMSB7bnVtYmVyfSB0aGUgc2Vjb25kIHdvcmQgdG8gZGVjcnlwdFxuICAgKiBAcGFyYW0gZW5jcnlwdGVkMiB7bnVtYmVyfSB0aGUgdGhpcmQgd29yZCB0byBkZWNyeXB0XG4gICAqIEBwYXJhbSBlbmNyeXB0ZWQzIHtudW1iZXJ9IHRoZSBmb3VydGggd29yZCB0byBkZWNyeXB0XG4gICAqIEBwYXJhbSBvdXQge0ludDMyQXJyYXl9IHRoZSBhcnJheSB0byB3cml0ZSB0aGUgZGVjcnlwdGVkIHdvcmRzXG4gICAqIGludG9cbiAgICogQHBhcmFtIG9mZnNldCB7bnVtYmVyfSB0aGUgb2Zmc2V0IGludG8gdGhlIG91dHB1dCBhcnJheSB0byBzdGFydFxuICAgKiB3cml0aW5nIHJlc3VsdHNcbiAgICogQHJldHVybiB7QXJyYXl9IFRoZSBwbGFpbnRleHQuXG4gICAqL1xuICBkZWNyeXB0KGVuY3J5cHRlZDAsIGVuY3J5cHRlZDEsIGVuY3J5cHRlZDIsIGVuY3J5cHRlZDMsIG91dCwgb2Zmc2V0KSB7XG4gICAgdmFyIGtleSA9IHRoaXMuX2tleVsxXSxcbiAgICAvLyBzdGF0ZSB2YXJpYWJsZXMgYSxiLGMsZCBhcmUgbG9hZGVkIHdpdGggcHJlLXdoaXRlbmVkIGRhdGFcbiAgICBhID0gZW5jcnlwdGVkMCBeIGtleVswXSxcbiAgICBiID0gZW5jcnlwdGVkMyBeIGtleVsxXSxcbiAgICBjID0gZW5jcnlwdGVkMiBeIGtleVsyXSxcbiAgICBkID0gZW5jcnlwdGVkMSBeIGtleVszXSxcbiAgICBhMiwgYjIsIGMyLFxuXG4gICAgbklubmVyUm91bmRzID0ga2V5Lmxlbmd0aCAvIDQgLSAyLCAvLyBrZXkubGVuZ3RoID09PSAyID9cbiAgICBpLFxuICAgIGtJbmRleCA9IDQsXG4gICAgdGFibGUgPSB0aGlzLl90YWJsZXNbMV0sXG5cbiAgICAvLyBsb2FkIHVwIHRoZSB0YWJsZXNcbiAgICB0YWJsZTAgICAgPSB0YWJsZVswXSxcbiAgICB0YWJsZTEgICAgPSB0YWJsZVsxXSxcbiAgICB0YWJsZTIgICAgPSB0YWJsZVsyXSxcbiAgICB0YWJsZTMgICAgPSB0YWJsZVszXSxcbiAgICBzYm94ICA9IHRhYmxlWzRdO1xuXG4gICAgLy8gSW5uZXIgcm91bmRzLiBDcmliYmVkIGZyb20gT3BlblNTTC5cbiAgICBmb3IgKGkgPSAwOyBpIDwgbklubmVyUm91bmRzOyBpKyspIHtcbiAgICAgIGEyID0gdGFibGUwW2E+Pj4yNF0gXiB0YWJsZTFbYj4+MTYgJiAyNTVdIF4gdGFibGUyW2M+PjggJiAyNTVdIF4gdGFibGUzW2QgJiAyNTVdIF4ga2V5W2tJbmRleF07XG4gICAgICBiMiA9IHRhYmxlMFtiPj4+MjRdIF4gdGFibGUxW2M+PjE2ICYgMjU1XSBeIHRhYmxlMltkPj44ICYgMjU1XSBeIHRhYmxlM1thICYgMjU1XSBeIGtleVtrSW5kZXggKyAxXTtcbiAgICAgIGMyID0gdGFibGUwW2M+Pj4yNF0gXiB0YWJsZTFbZD4+MTYgJiAyNTVdIF4gdGFibGUyW2E+PjggJiAyNTVdIF4gdGFibGUzW2IgJiAyNTVdIF4ga2V5W2tJbmRleCArIDJdO1xuICAgICAgZCAgPSB0YWJsZTBbZD4+PjI0XSBeIHRhYmxlMVthPj4xNiAmIDI1NV0gXiB0YWJsZTJbYj4+OCAmIDI1NV0gXiB0YWJsZTNbYyAmIDI1NV0gXiBrZXlba0luZGV4ICsgM107XG4gICAgICBrSW5kZXggKz0gNDtcbiAgICAgIGE9YTI7IGI9YjI7IGM9YzI7XG4gICAgfVxuXG4gICAgLy8gTGFzdCByb3VuZC5cbiAgICBmb3IgKGkgPSAwOyBpIDwgNDsgaSsrKSB7XG4gICAgICBvdXRbKDMgJiAtaSkgKyBvZmZzZXRdID1cbiAgICAgICAgc2JveFthPj4+MjQgICAgICBdPDwyNCBeXG4gICAgICAgIHNib3hbYj4+MTYgICYgMjU1XTw8MTYgXlxuICAgICAgICBzYm94W2M+PjggICAmIDI1NV08PDggIF5cbiAgICAgICAgc2JveFtkICAgICAgJiAyNTVdICAgICBeXG4gICAgICAgIGtleVtrSW5kZXgrK107XG4gICAgICBhMj1hOyBhPWI7IGI9YzsgYz1kOyBkPWEyO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBBRVM7XG4iLCIvKlxuICpcbiAqIFRoaXMgZmlsZSBjb250YWlucyBhbiBhZGFwdGF0aW9uIG9mIHRoZSBBRVMgZGVjcnlwdGlvbiBhbGdvcml0aG1cbiAqIGZyb20gdGhlIFN0YW5kZm9yZCBKYXZhc2NyaXB0IENyeXB0b2dyYXBoeSBMaWJyYXJ5LiBUaGF0IHdvcmsgaXNcbiAqIGNvdmVyZWQgYnkgdGhlIGZvbGxvd2luZyBjb3B5cmlnaHQgYW5kIHBlcm1pc3Npb25zIG5vdGljZTpcbiAqXG4gKiBDb3B5cmlnaHQgMjAwOS0yMDEwIEVtaWx5IFN0YXJrLCBNaWtlIEhhbWJ1cmcsIERhbiBCb25laC5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogUmVkaXN0cmlidXRpb24gYW5kIHVzZSBpbiBzb3VyY2UgYW5kIGJpbmFyeSBmb3Jtcywgd2l0aCBvciB3aXRob3V0XG4gKiBtb2RpZmljYXRpb24sIGFyZSBwZXJtaXR0ZWQgcHJvdmlkZWQgdGhhdCB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnMgYXJlXG4gKiBtZXQ6XG4gKlxuICogMS4gUmVkaXN0cmlidXRpb25zIG9mIHNvdXJjZSBjb2RlIG11c3QgcmV0YWluIHRoZSBhYm92ZSBjb3B5cmlnaHRcbiAqICAgIG5vdGljZSwgdGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmcgZGlzY2xhaW1lci5cbiAqXG4gKiAyLiBSZWRpc3RyaWJ1dGlvbnMgaW4gYmluYXJ5IGZvcm0gbXVzdCByZXByb2R1Y2UgdGhlIGFib3ZlXG4gKiAgICBjb3B5cmlnaHQgbm90aWNlLCB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZ1xuICogICAgZGlzY2xhaW1lciBpbiB0aGUgZG9jdW1lbnRhdGlvbiBhbmQvb3Igb3RoZXIgbWF0ZXJpYWxzIHByb3ZpZGVkXG4gKiAgICB3aXRoIHRoZSBkaXN0cmlidXRpb24uXG4gKlxuICogVEhJUyBTT0ZUV0FSRSBJUyBQUk9WSURFRCBCWSBUSEUgQVVUSE9SUyBgYEFTIElTJycgQU5EIEFOWSBFWFBSRVNTIE9SXG4gKiBJTVBMSUVEIFdBUlJBTlRJRVMsIElOQ0xVRElORywgQlVUIE5PVCBMSU1JVEVEIFRPLCBUSEUgSU1QTElFRFxuICogV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFkgQU5EIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFSRVxuICogRElTQ0xBSU1FRC4gSU4gTk8gRVZFTlQgU0hBTEwgPENPUFlSSUdIVCBIT0xERVI+IE9SIENPTlRSSUJVVE9SUyBCRVxuICogTElBQkxFIEZPUiBBTlkgRElSRUNULCBJTkRJUkVDVCwgSU5DSURFTlRBTCwgU1BFQ0lBTCwgRVhFTVBMQVJZLCBPUlxuICogQ09OU0VRVUVOVElBTCBEQU1BR0VTIChJTkNMVURJTkcsIEJVVCBOT1QgTElNSVRFRCBUTywgUFJPQ1VSRU1FTlQgT0ZcbiAqIFNVQlNUSVRVVEUgR09PRFMgT1IgU0VSVklDRVM7IExPU1MgT0YgVVNFLCBEQVRBLCBPUiBQUk9GSVRTOyBPUlxuICogQlVTSU5FU1MgSU5URVJSVVBUSU9OKSBIT1dFVkVSIENBVVNFRCBBTkQgT04gQU5ZIFRIRU9SWSBPRiBMSUFCSUxJVFksXG4gKiBXSEVUSEVSIElOIENPTlRSQUNULCBTVFJJQ1QgTElBQklMSVRZLCBPUiBUT1JUIChJTkNMVURJTkcgTkVHTElHRU5DRVxuICogT1IgT1RIRVJXSVNFKSBBUklTSU5HIElOIEFOWSBXQVkgT1VUIE9GIFRIRSBVU0UgT0YgVEhJUyBTT0ZUV0FSRSwgRVZFTlxuICogSUYgQURWSVNFRCBPRiBUSEUgUE9TU0lCSUxJVFkgT0YgU1VDSCBEQU1BR0UuXG4gKlxuICogVGhlIHZpZXdzIGFuZCBjb25jbHVzaW9ucyBjb250YWluZWQgaW4gdGhlIHNvZnR3YXJlIGFuZCBkb2N1bWVudGF0aW9uXG4gKiBhcmUgdGhvc2Ugb2YgdGhlIGF1dGhvcnMgYW5kIHNob3VsZCBub3QgYmUgaW50ZXJwcmV0ZWQgYXMgcmVwcmVzZW50aW5nXG4gKiBvZmZpY2lhbCBwb2xpY2llcywgZWl0aGVyIGV4cHJlc3NlZCBvciBpbXBsaWVkLCBvZiB0aGUgYXV0aG9ycy5cbiAqL1xuXG5pbXBvcnQgQUVTIGZyb20gJy4vYWVzJztcblxuY2xhc3MgQUVTMTI4RGVjcnlwdGVyIHtcblxuICBjb25zdHJ1Y3RvcihrZXksIGluaXRWZWN0b3IpIHtcbiAgICB0aGlzLmtleSA9IGtleTtcbiAgICB0aGlzLml2ID0gaW5pdFZlY3RvcjtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb252ZXJ0IG5ldHdvcmstb3JkZXIgKGJpZy1lbmRpYW4pIGJ5dGVzIGludG8gdGhlaXIgbGl0dGxlLWVuZGlhblxuICAgKiByZXByZXNlbnRhdGlvbi5cbiAgICovXG4gIG50b2god29yZCkge1xuICAgIHJldHVybiAod29yZCA8PCAyNCkgfFxuICAgICAgKCh3b3JkICYgMHhmZjAwKSA8PCA4KSB8XG4gICAgICAoKHdvcmQgJiAweGZmMDAwMCkgPj4gOCkgfFxuICAgICAgKHdvcmQgPj4+IDI0KTtcbiAgfVxuXG5cbiAgLyoqXG4gICAqIERlY3J5cHQgYnl0ZXMgdXNpbmcgQUVTLTEyOCB3aXRoIENCQyBhbmQgUEtDUyM3IHBhZGRpbmcuXG4gICAqIEBwYXJhbSBlbmNyeXB0ZWQge1VpbnQ4QXJyYXl9IHRoZSBlbmNyeXB0ZWQgYnl0ZXNcbiAgICogQHBhcmFtIGtleSB7VWludDMyQXJyYXl9IHRoZSBieXRlcyBvZiB0aGUgZGVjcnlwdGlvbiBrZXlcbiAgICogQHBhcmFtIGluaXRWZWN0b3Ige1VpbnQzMkFycmF5fSB0aGUgaW5pdGlhbGl6YXRpb24gdmVjdG9yIChJVikgdG9cbiAgICogdXNlIGZvciB0aGUgZmlyc3Qgcm91bmQgb2YgQ0JDLlxuICAgKiBAcmV0dXJuIHtVaW50OEFycmF5fSB0aGUgZGVjcnlwdGVkIGJ5dGVzXG4gICAqXG4gICAqIEBzZWUgaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9BZHZhbmNlZF9FbmNyeXB0aW9uX1N0YW5kYXJkXG4gICAqIEBzZWUgaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9CbG9ja19jaXBoZXJfbW9kZV9vZl9vcGVyYXRpb24jQ2lwaGVyX0Jsb2NrX0NoYWluaW5nXy4yOENCQy4yOVxuICAgKiBAc2VlIGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmMyMzE1XG4gICAqL1xuICBkb0RlY3J5cHQoZW5jcnlwdGVkLCBrZXksIGluaXRWZWN0b3IpIHtcbiAgICB2YXJcbiAgICAgIC8vIHdvcmQtbGV2ZWwgYWNjZXNzIHRvIHRoZSBlbmNyeXB0ZWQgYnl0ZXNcbiAgICAgIGVuY3J5cHRlZDMyID0gbmV3IEludDMyQXJyYXkoZW5jcnlwdGVkLmJ1ZmZlciwgZW5jcnlwdGVkLmJ5dGVPZmZzZXQsIGVuY3J5cHRlZC5ieXRlTGVuZ3RoID4+IDIpLFxuXG4gICAgZGVjaXBoZXIgPSBuZXcgQUVTKEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGtleSkpLFxuXG4gICAgLy8gYnl0ZSBhbmQgd29yZC1sZXZlbCBhY2Nlc3MgZm9yIHRoZSBkZWNyeXB0ZWQgb3V0cHV0XG4gICAgZGVjcnlwdGVkID0gbmV3IFVpbnQ4QXJyYXkoZW5jcnlwdGVkLmJ5dGVMZW5ndGgpLFxuICAgIGRlY3J5cHRlZDMyID0gbmV3IEludDMyQXJyYXkoZGVjcnlwdGVkLmJ1ZmZlciksXG5cbiAgICAvLyB0ZW1wb3JhcnkgdmFyaWFibGVzIGZvciB3b3JraW5nIHdpdGggdGhlIElWLCBlbmNyeXB0ZWQsIGFuZFxuICAgIC8vIGRlY3J5cHRlZCBkYXRhXG4gICAgaW5pdDAsIGluaXQxLCBpbml0MiwgaW5pdDMsXG4gICAgZW5jcnlwdGVkMCwgZW5jcnlwdGVkMSwgZW5jcnlwdGVkMiwgZW5jcnlwdGVkMyxcblxuICAgIC8vIGl0ZXJhdGlvbiB2YXJpYWJsZVxuICAgIHdvcmRJeDtcblxuICAgIC8vIHB1bGwgb3V0IHRoZSB3b3JkcyBvZiB0aGUgSVYgdG8gZW5zdXJlIHdlIGRvbid0IG1vZGlmeSB0aGVcbiAgICAvLyBwYXNzZWQtaW4gcmVmZXJlbmNlIGFuZCBlYXNpZXIgYWNjZXNzXG4gICAgaW5pdDAgPSB+fmluaXRWZWN0b3JbMF07XG4gICAgaW5pdDEgPSB+fmluaXRWZWN0b3JbMV07XG4gICAgaW5pdDIgPSB+fmluaXRWZWN0b3JbMl07XG4gICAgaW5pdDMgPSB+fmluaXRWZWN0b3JbM107XG5cbiAgICAvLyBkZWNyeXB0IGZvdXIgd29yZCBzZXF1ZW5jZXMsIGFwcGx5aW5nIGNpcGhlci1ibG9jayBjaGFpbmluZyAoQ0JDKVxuICAgIC8vIHRvIGVhY2ggZGVjcnlwdGVkIGJsb2NrXG4gICAgZm9yICh3b3JkSXggPSAwOyB3b3JkSXggPCBlbmNyeXB0ZWQzMi5sZW5ndGg7IHdvcmRJeCArPSA0KSB7XG4gICAgICAvLyBjb252ZXJ0IGJpZy1lbmRpYW4gKG5ldHdvcmsgb3JkZXIpIHdvcmRzIGludG8gbGl0dGxlLWVuZGlhblxuICAgICAgLy8gKGphdmFzY3JpcHQgb3JkZXIpXG4gICAgICBlbmNyeXB0ZWQwID0gfn50aGlzLm50b2goZW5jcnlwdGVkMzJbd29yZEl4XSk7XG4gICAgICBlbmNyeXB0ZWQxID0gfn50aGlzLm50b2goZW5jcnlwdGVkMzJbd29yZEl4ICsgMV0pO1xuICAgICAgZW5jcnlwdGVkMiA9IH5+dGhpcy5udG9oKGVuY3J5cHRlZDMyW3dvcmRJeCArIDJdKTtcbiAgICAgIGVuY3J5cHRlZDMgPSB+fnRoaXMubnRvaChlbmNyeXB0ZWQzMlt3b3JkSXggKyAzXSk7XG5cbiAgICAgIC8vIGRlY3J5cHQgdGhlIGJsb2NrXG4gICAgICBkZWNpcGhlci5kZWNyeXB0KGVuY3J5cHRlZDAsXG4gICAgICAgICAgZW5jcnlwdGVkMSxcbiAgICAgICAgICBlbmNyeXB0ZWQyLFxuICAgICAgICAgIGVuY3J5cHRlZDMsXG4gICAgICAgICAgZGVjcnlwdGVkMzIsXG4gICAgICAgICAgd29yZEl4KTtcblxuICAgICAgLy8gWE9SIHdpdGggdGhlIElWLCBhbmQgcmVzdG9yZSBuZXR3b3JrIGJ5dGUtb3JkZXIgdG8gb2J0YWluIHRoZVxuICAgICAgLy8gcGxhaW50ZXh0XG4gICAgICBkZWNyeXB0ZWQzMlt3b3JkSXhdICAgICA9IHRoaXMubnRvaChkZWNyeXB0ZWQzMlt3b3JkSXhdIF4gaW5pdDApO1xuICAgICAgZGVjcnlwdGVkMzJbd29yZEl4ICsgMV0gPSB0aGlzLm50b2goZGVjcnlwdGVkMzJbd29yZEl4ICsgMV0gXiBpbml0MSk7XG4gICAgICBkZWNyeXB0ZWQzMlt3b3JkSXggKyAyXSA9IHRoaXMubnRvaChkZWNyeXB0ZWQzMlt3b3JkSXggKyAyXSBeIGluaXQyKTtcbiAgICAgIGRlY3J5cHRlZDMyW3dvcmRJeCArIDNdID0gdGhpcy5udG9oKGRlY3J5cHRlZDMyW3dvcmRJeCArIDNdIF4gaW5pdDMpO1xuXG4gICAgICAvLyBzZXR1cCB0aGUgSVYgZm9yIHRoZSBuZXh0IHJvdW5kXG4gICAgICBpbml0MCA9IGVuY3J5cHRlZDA7XG4gICAgICBpbml0MSA9IGVuY3J5cHRlZDE7XG4gICAgICBpbml0MiA9IGVuY3J5cHRlZDI7XG4gICAgICBpbml0MyA9IGVuY3J5cHRlZDM7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRlY3J5cHRlZDtcbiAgfVxuXG4gIGxvY2FsRGVjcnlwdChlbmNyeXB0ZWQsIGtleSwgaW5pdFZlY3RvciwgZGVjcnlwdGVkKSB7XG4gICAgdmFyIGJ5dGVzID0gdGhpcy5kb0RlY3J5cHQoZW5jcnlwdGVkLFxuICAgICAgICBrZXksXG4gICAgICAgIGluaXRWZWN0b3IpO1xuICAgIGRlY3J5cHRlZC5zZXQoYnl0ZXMsIGVuY3J5cHRlZC5ieXRlT2Zmc2V0KTtcbiAgfVxuXG4gIGRlY3J5cHQoZW5jcnlwdGVkKSB7XG4gICAgdmFyXG4gICAgICBzdGVwID0gNCAqIDgwMDAsXG4gICAgLy9lbmNyeXB0ZWQzMiA9IG5ldyBJbnQzMkFycmF5KGVuY3J5cHRlZC5idWZmZXIpLFxuICAgIGVuY3J5cHRlZDMyID0gbmV3IEludDMyQXJyYXkoZW5jcnlwdGVkKSxcbiAgICBkZWNyeXB0ZWQgPSBuZXcgVWludDhBcnJheShlbmNyeXB0ZWQuYnl0ZUxlbmd0aCksXG4gICAgaSA9IDA7XG5cbiAgICAvLyBzcGxpdCB1cCB0aGUgZW5jcnlwdGlvbiBqb2IgYW5kIGRvIHRoZSBpbmRpdmlkdWFsIGNodW5rcyBhc3luY2hyb25vdXNseVxuICAgIHZhciBrZXkgPSB0aGlzLmtleTtcbiAgICB2YXIgaW5pdFZlY3RvciA9IHRoaXMuaXY7XG4gICAgdGhpcy5sb2NhbERlY3J5cHQoZW5jcnlwdGVkMzIuc3ViYXJyYXkoaSwgaSArIHN0ZXApLCBrZXksIGluaXRWZWN0b3IsIGRlY3J5cHRlZCk7XG5cbiAgICBmb3IgKGkgPSBzdGVwOyBpIDwgZW5jcnlwdGVkMzIubGVuZ3RoOyBpICs9IHN0ZXApIHtcbiAgICAgIGluaXRWZWN0b3IgPSBuZXcgVWludDMyQXJyYXkoW1xuICAgICAgICAgIHRoaXMubnRvaChlbmNyeXB0ZWQzMltpIC0gNF0pLFxuICAgICAgICAgIHRoaXMubnRvaChlbmNyeXB0ZWQzMltpIC0gM10pLFxuICAgICAgICAgIHRoaXMubnRvaChlbmNyeXB0ZWQzMltpIC0gMl0pLFxuICAgICAgICAgIHRoaXMubnRvaChlbmNyeXB0ZWQzMltpIC0gMV0pXG4gICAgICBdKTtcbiAgICAgIHRoaXMubG9jYWxEZWNyeXB0KGVuY3J5cHRlZDMyLnN1YmFycmF5KGksIGkgKyBzdGVwKSwga2V5LCBpbml0VmVjdG9yLCBkZWNyeXB0ZWQpO1xuICAgIH1cblxuICAgIHJldHVybiBkZWNyeXB0ZWQ7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQUVTMTI4RGVjcnlwdGVyO1xuIiwiLypcbiAqIEFFUzEyOCBkZWNyeXB0aW9uLlxuICovXG5cbmltcG9ydCBBRVMxMjhEZWNyeXB0ZXIgZnJvbSAnLi9hZXMxMjgtZGVjcnlwdGVyJztcbmltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5cbmNsYXNzIERlY3J5cHRlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgdGhpcy5obHMgPSBobHM7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGJyb3dzZXJDcnlwdG8gPSB3aW5kb3cgPyB3aW5kb3cuY3J5cHRvIDogY3J5cHRvO1xuICAgICAgdGhpcy5zdWJ0bGUgPSBicm93c2VyQ3J5cHRvLnN1YnRsZSB8fCBicm93c2VyQ3J5cHRvLndlYmtpdFN1YnRsZTtcbiAgICAgIHRoaXMuZGlzYWJsZVdlYkNyeXB0byA9ICF0aGlzLnN1YnRsZTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0aGlzLmRpc2FibGVXZWJDcnlwdG8gPSB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gIH1cblxuICBkZWNyeXB0KGRhdGEsIGtleSwgaXYsIGNhbGxiYWNrKSB7XG4gICAgaWYgKHRoaXMuZGlzYWJsZVdlYkNyeXB0byAmJiB0aGlzLmhscy5jb25maWcuZW5hYmxlU29mdHdhcmVBRVMpIHtcbiAgICAgIHRoaXMuZGVjcnlwdEJ5U29mdHdhcmUoZGF0YSwga2V5LCBpdiwgY2FsbGJhY2spO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRlY3J5cHRCeVdlYkNyeXB0byhkYXRhLCBrZXksIGl2LCBjYWxsYmFjayk7XG4gICAgfVxuICB9XG5cbiAgZGVjcnlwdEJ5V2ViQ3J5cHRvKGRhdGEsIGtleSwgaXYsIGNhbGxiYWNrKSB7XG4gICAgbG9nZ2VyLmxvZygnZGVjcnlwdGluZyBieSBXZWJDcnlwdG8gQVBJJyk7XG5cbiAgICB0aGlzLnN1YnRsZS5pbXBvcnRLZXkoJ3JhdycsIGtleSwgeyBuYW1lIDogJ0FFUy1DQkMnLCBsZW5ndGggOiAxMjggfSwgZmFsc2UsIFsnZGVjcnlwdCddKS5cbiAgICAgIHRoZW4oKGltcG9ydGVkS2V5KSA9PiB7XG4gICAgICAgIHRoaXMuc3VidGxlLmRlY3J5cHQoeyBuYW1lIDogJ0FFUy1DQkMnLCBpdiA6IGl2LmJ1ZmZlciB9LCBpbXBvcnRlZEtleSwgZGF0YSkuXG4gICAgICAgICAgdGhlbihjYWxsYmFjaykuXG4gICAgICAgICAgY2F0Y2ggKChlcnIpID0+IHtcbiAgICAgICAgICAgIHRoaXMub25XZWJDcnlwdG9FcnJvcihlcnIsIGRhdGEsIGtleSwgaXYsIGNhbGxiYWNrKTtcbiAgICAgICAgICB9KTtcbiAgICAgIH0pLlxuICAgIGNhdGNoICgoZXJyKSA9PiB7XG4gICAgICB0aGlzLm9uV2ViQ3J5cHRvRXJyb3IoZXJyLCBkYXRhLCBrZXksIGl2LCBjYWxsYmFjayk7XG4gICAgfSk7XG4gIH1cblxuICBkZWNyeXB0QnlTb2Z0d2FyZShkYXRhLCBrZXk4LCBpdjgsIGNhbGxiYWNrKSB7XG4gICAgbG9nZ2VyLmxvZygnZGVjcnlwdGluZyBieSBKYXZhU2NyaXB0IEltcGxlbWVudGF0aW9uJyk7XG5cbiAgICB2YXIgdmlldyA9IG5ldyBEYXRhVmlldyhrZXk4LmJ1ZmZlcik7XG4gICAgdmFyIGtleSA9IG5ldyBVaW50MzJBcnJheShbXG4gICAgICAgIHZpZXcuZ2V0VWludDMyKDApLFxuICAgICAgICB2aWV3LmdldFVpbnQzMig0KSxcbiAgICAgICAgdmlldy5nZXRVaW50MzIoOCksXG4gICAgICAgIHZpZXcuZ2V0VWludDMyKDEyKVxuICAgIF0pO1xuXG4gICAgdmlldyA9IG5ldyBEYXRhVmlldyhpdjguYnVmZmVyKTtcbiAgICB2YXIgaXYgPSBuZXcgVWludDMyQXJyYXkoW1xuICAgICAgICB2aWV3LmdldFVpbnQzMigwKSxcbiAgICAgICAgdmlldy5nZXRVaW50MzIoNCksXG4gICAgICAgIHZpZXcuZ2V0VWludDMyKDgpLFxuICAgICAgICB2aWV3LmdldFVpbnQzMigxMilcbiAgICBdKTtcblxuICAgIHZhciBkZWNyeXB0ZXIgPSBuZXcgQUVTMTI4RGVjcnlwdGVyKGtleSwgaXYpO1xuICAgIGNhbGxiYWNrKGRlY3J5cHRlci5kZWNyeXB0KGRhdGEpLmJ1ZmZlcik7XG4gIH1cblxuICBvbldlYkNyeXB0b0Vycm9yKGVyciwgZGF0YSwga2V5LCBpdiwgY2FsbGJhY2spIHtcbiAgICBpZiAodGhpcy5obHMuY29uZmlnLmVuYWJsZVNvZnR3YXJlQUVTKSB7XG4gICAgICBsb2dnZXIubG9nKCdkaXNhYmxpbmcgdG8gdXNlIFdlYkNyeXB0byBBUEknKTtcbiAgICAgIHRoaXMuZGlzYWJsZVdlYkNyeXB0byA9IHRydWU7XG4gICAgICB0aGlzLmRlY3J5cHRCeVNvZnR3YXJlKGRhdGEsIGtleSwgaXYsIGNhbGxiYWNrKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBsb2dnZXIuZXJyb3IoYGRlY3J5cHRpbmcgZXJyb3IgOiAke2Vyci5tZXNzYWdlfWApO1xuICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGUgOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzIDogRXJyb3JEZXRhaWxzLkZSQUdfREVDUllQVF9FUlJPUiwgZmF0YWwgOiB0cnVlLCByZWFzb24gOiBlcnIubWVzc2FnZX0pO1xuICAgIH1cbiAgfVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IERlY3J5cHRlcjtcbiIsIi8qKlxuICogQUFDIGRlbXV4ZXJcbiAqL1xuaW1wb3J0IEFEVFMgZnJvbSAnLi9hZHRzJztcbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IElEMyBmcm9tICcuLi9kZW11eC9pZDMnO1xuXG4gY2xhc3MgQUFDRGVtdXhlciB7XG5cbiAgY29uc3RydWN0b3Iob2JzZXJ2ZXIscmVtdXhlckNsYXNzKSB7XG4gICAgdGhpcy5vYnNlcnZlciA9IG9ic2VydmVyO1xuICAgIHRoaXMucmVtdXhlckNsYXNzID0gcmVtdXhlckNsYXNzO1xuICAgIHRoaXMucmVtdXhlciA9IG5ldyB0aGlzLnJlbXV4ZXJDbGFzcyhvYnNlcnZlcik7XG4gICAgdGhpcy5fYWFjVHJhY2sgPSB7dHlwZTogJ2F1ZGlvJywgaWQgOi0xLCBzZXF1ZW5jZU51bWJlcjogMCwgc2FtcGxlcyA6IFtdLCBsZW4gOiAwfTtcbiAgfVxuXG4gIHN0YXRpYyBwcm9iZShkYXRhKSB7XG4gICAgLy8gY2hlY2sgaWYgZGF0YSBjb250YWlucyBJRDMgdGltZXN0YW1wIGFuZCBBRFRTIHN5bmMgd29yY1xuICAgIHZhciBpZDMgPSBuZXcgSUQzKGRhdGEpLCBhZHRzU3RhcnRPZmZzZXQsbGVuO1xuICAgIGlmKGlkMy5oYXNUaW1lU3RhbXApIHtcbiAgICAgIC8vIGxvb2sgZm9yIEFEVFMgaGVhZGVyICgweEZGRngpXG4gICAgICBmb3IgKGFkdHNTdGFydE9mZnNldCA9IGlkMy5sZW5ndGgsIGxlbiA9IGRhdGEubGVuZ3RoOyBhZHRzU3RhcnRPZmZzZXQgPCBsZW4gLSAxOyBhZHRzU3RhcnRPZmZzZXQrKykge1xuICAgICAgICBpZiAoKGRhdGFbYWR0c1N0YXJ0T2Zmc2V0XSA9PT0gMHhmZikgJiYgKGRhdGFbYWR0c1N0YXJ0T2Zmc2V0KzFdICYgMHhmMCkgPT09IDB4ZjApIHtcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ0FEVFMgc3luYyB3b3JkIGZvdW5kICEnKTtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuXG4gIC8vIGZlZWQgaW5jb21pbmcgZGF0YSB0byB0aGUgZnJvbnQgb2YgdGhlIHBhcnNpbmcgcGlwZWxpbmVcbiAgcHVzaChkYXRhLCBhdWRpb0NvZGVjLCB2aWRlb0NvZGVjLCB0aW1lT2Zmc2V0LCBjYywgbGV2ZWwsIHNuLCBkdXJhdGlvbikge1xuICAgIHZhciB0cmFjayA9IHRoaXMuX2FhY1RyYWNrLFxuICAgICAgICBpZDMgPSBuZXcgSUQzKGRhdGEpLFxuICAgICAgICBwdHMgPSA5MCppZDMudGltZVN0YW1wLFxuICAgICAgICBjb25maWcsIGFkdHNGcmFtZVNpemUsIGFkdHNTdGFydE9mZnNldCwgYWR0c0hlYWRlckxlbiwgc3RhbXAsIG5iU2FtcGxlcywgbGVuLCBhYWNTYW1wbGU7XG4gICAgLy8gbG9vayBmb3IgQURUUyBoZWFkZXIgKDB4RkZGeClcbiAgICBmb3IgKGFkdHNTdGFydE9mZnNldCA9IGlkMy5sZW5ndGgsIGxlbiA9IGRhdGEubGVuZ3RoOyBhZHRzU3RhcnRPZmZzZXQgPCBsZW4gLSAxOyBhZHRzU3RhcnRPZmZzZXQrKykge1xuICAgICAgaWYgKChkYXRhW2FkdHNTdGFydE9mZnNldF0gPT09IDB4ZmYpICYmIChkYXRhW2FkdHNTdGFydE9mZnNldCsxXSAmIDB4ZjApID09PSAweGYwKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghdHJhY2suYXVkaW9zYW1wbGVyYXRlKSB7XG4gICAgICBjb25maWcgPSBBRFRTLmdldEF1ZGlvQ29uZmlnKHRoaXMub2JzZXJ2ZXIsZGF0YSwgYWR0c1N0YXJ0T2Zmc2V0LCBhdWRpb0NvZGVjKTtcbiAgICAgIHRyYWNrLmNvbmZpZyA9IGNvbmZpZy5jb25maWc7XG4gICAgICB0cmFjay5hdWRpb3NhbXBsZXJhdGUgPSBjb25maWcuc2FtcGxlcmF0ZTtcbiAgICAgIHRyYWNrLmNoYW5uZWxDb3VudCA9IGNvbmZpZy5jaGFubmVsQ291bnQ7XG4gICAgICB0cmFjay5jb2RlYyA9IGNvbmZpZy5jb2RlYztcbiAgICAgIHRyYWNrLnRpbWVzY2FsZSA9IHRoaXMucmVtdXhlci50aW1lc2NhbGU7XG4gICAgICB0cmFjay5kdXJhdGlvbiA9IHRoaXMucmVtdXhlci50aW1lc2NhbGUgKiBkdXJhdGlvbjtcbiAgICAgIGxvZ2dlci5sb2coYHBhcnNlZCBjb2RlYzoke3RyYWNrLmNvZGVjfSxyYXRlOiR7Y29uZmlnLnNhbXBsZXJhdGV9LG5iIGNoYW5uZWw6JHtjb25maWcuY2hhbm5lbENvdW50fWApO1xuICAgIH1cbiAgICBuYlNhbXBsZXMgPSAwO1xuICAgIHdoaWxlICgoYWR0c1N0YXJ0T2Zmc2V0ICsgNSkgPCBsZW4pIHtcbiAgICAgIC8vIHJldHJpZXZlIGZyYW1lIHNpemVcbiAgICAgIGFkdHNGcmFtZVNpemUgPSAoKGRhdGFbYWR0c1N0YXJ0T2Zmc2V0ICsgM10gJiAweDAzKSA8PCAxMSk7XG4gICAgICAvLyBieXRlIDRcbiAgICAgIGFkdHNGcmFtZVNpemUgfD0gKGRhdGFbYWR0c1N0YXJ0T2Zmc2V0ICsgNF0gPDwgMyk7XG4gICAgICAvLyBieXRlIDVcbiAgICAgIGFkdHNGcmFtZVNpemUgfD0gKChkYXRhW2FkdHNTdGFydE9mZnNldCArIDVdICYgMHhFMCkgPj4+IDUpO1xuICAgICAgYWR0c0hlYWRlckxlbiA9ICghIShkYXRhW2FkdHNTdGFydE9mZnNldCArIDFdICYgMHgwMSkgPyA3IDogOSk7XG4gICAgICBhZHRzRnJhbWVTaXplIC09IGFkdHNIZWFkZXJMZW47XG4gICAgICBzdGFtcCA9IE1hdGgucm91bmQocHRzICsgbmJTYW1wbGVzICogMTAyNCAqIDkwMDAwIC8gdHJhY2suYXVkaW9zYW1wbGVyYXRlKTtcbiAgICAgIC8vc3RhbXAgPSBwZXMucHRzO1xuICAgICAgLy9jb25zb2xlLmxvZygnQUFDIGZyYW1lLCBvZmZzZXQvbGVuZ3RoL3B0czonICsgKGFkdHNTdGFydE9mZnNldCs3KSArICcvJyArIGFkdHNGcmFtZVNpemUgKyAnLycgKyBzdGFtcC50b0ZpeGVkKDApKTtcbiAgICAgIGlmICgoYWR0c0ZyYW1lU2l6ZSA+IDApICYmICgoYWR0c1N0YXJ0T2Zmc2V0ICsgYWR0c0hlYWRlckxlbiArIGFkdHNGcmFtZVNpemUpIDw9IGxlbikpIHtcbiAgICAgICAgYWFjU2FtcGxlID0ge3VuaXQ6IGRhdGEuc3ViYXJyYXkoYWR0c1N0YXJ0T2Zmc2V0ICsgYWR0c0hlYWRlckxlbiwgYWR0c1N0YXJ0T2Zmc2V0ICsgYWR0c0hlYWRlckxlbiArIGFkdHNGcmFtZVNpemUpLCBwdHM6IHN0YW1wLCBkdHM6IHN0YW1wfTtcbiAgICAgICAgdHJhY2suc2FtcGxlcy5wdXNoKGFhY1NhbXBsZSk7XG4gICAgICAgIHRyYWNrLmxlbiArPSBhZHRzRnJhbWVTaXplO1xuICAgICAgICBhZHRzU3RhcnRPZmZzZXQgKz0gYWR0c0ZyYW1lU2l6ZSArIGFkdHNIZWFkZXJMZW47XG4gICAgICAgIG5iU2FtcGxlcysrO1xuICAgICAgICAvLyBsb29rIGZvciBBRFRTIGhlYWRlciAoMHhGRkZ4KVxuICAgICAgICBmb3IgKCA7IGFkdHNTdGFydE9mZnNldCA8IChsZW4gLSAxKTsgYWR0c1N0YXJ0T2Zmc2V0KyspIHtcbiAgICAgICAgICBpZiAoKGRhdGFbYWR0c1N0YXJ0T2Zmc2V0XSA9PT0gMHhmZikgJiYgKChkYXRhW2FkdHNTdGFydE9mZnNldCArIDFdICYgMHhmMCkgPT09IDB4ZjApKSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLnJlbXV4ZXIucmVtdXgodGhpcy5fYWFjVHJhY2sse3NhbXBsZXMgOiBbXX0sIHtzYW1wbGVzIDogWyB7IHB0czogcHRzLCBkdHMgOiBwdHMsIHVuaXQgOiBpZDMucGF5bG9hZH0gXX0sIHRpbWVPZmZzZXQpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgfVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IEFBQ0RlbXV4ZXI7XG4iLCIvKipcbiAqICBBRFRTIHBhcnNlciBoZWxwZXJcbiAqL1xuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcblxuIGNsYXNzIEFEVFMge1xuXG4gIHN0YXRpYyBnZXRBdWRpb0NvbmZpZyhvYnNlcnZlciwgZGF0YSwgb2Zmc2V0LCBhdWRpb0NvZGVjKSB7XG4gICAgdmFyIGFkdHNPYmplY3RUeXBlLCAvLyA6aW50XG4gICAgICAgIGFkdHNTYW1wbGVpbmdJbmRleCwgLy8gOmludFxuICAgICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXgsIC8vIDppbnRcbiAgICAgICAgYWR0c0NoYW5lbENvbmZpZywgLy8gOmludFxuICAgICAgICBjb25maWcsXG4gICAgICAgIHVzZXJBZ2VudCA9IG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKSxcbiAgICAgICAgYWR0c1NhbXBsZWluZ1JhdGVzID0gW1xuICAgICAgICAgICAgOTYwMDAsIDg4MjAwLFxuICAgICAgICAgICAgNjQwMDAsIDQ4MDAwLFxuICAgICAgICAgICAgNDQxMDAsIDMyMDAwLFxuICAgICAgICAgICAgMjQwMDAsIDIyMDUwLFxuICAgICAgICAgICAgMTYwMDAsIDEyMDAwLFxuICAgICAgICAgICAgMTEwMjUsIDgwMDAsXG4gICAgICAgICAgICA3MzUwXTtcbiAgICAvLyBieXRlIDJcbiAgICBhZHRzT2JqZWN0VHlwZSA9ICgoZGF0YVtvZmZzZXQgKyAyXSAmIDB4QzApID4+PiA2KSArIDE7XG4gICAgYWR0c1NhbXBsZWluZ0luZGV4ID0gKChkYXRhW29mZnNldCArIDJdICYgMHgzQykgPj4+IDIpO1xuICAgIGlmKGFkdHNTYW1wbGVpbmdJbmRleCA+IGFkdHNTYW1wbGVpbmdSYXRlcy5sZW5ndGgtMSkge1xuICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5GUkFHX1BBUlNJTkdfRVJST1IsIGZhdGFsOiB0cnVlLCByZWFzb246IGBpbnZhbGlkIEFEVFMgc2FtcGxpbmcgaW5kZXg6JHthZHRzU2FtcGxlaW5nSW5kZXh9YH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBhZHRzQ2hhbmVsQ29uZmlnID0gKChkYXRhW29mZnNldCArIDJdICYgMHgwMSkgPDwgMik7XG4gICAgLy8gYnl0ZSAzXG4gICAgYWR0c0NoYW5lbENvbmZpZyB8PSAoKGRhdGFbb2Zmc2V0ICsgM10gJiAweEMwKSA+Pj4gNik7XG4gICAgbG9nZ2VyLmxvZyhgbWFuaWZlc3QgY29kZWM6JHthdWRpb0NvZGVjfSxBRFRTIGRhdGE6dHlwZToke2FkdHNPYmplY3RUeXBlfSxzYW1wbGVpbmdJbmRleDoke2FkdHNTYW1wbGVpbmdJbmRleH1bJHthZHRzU2FtcGxlaW5nUmF0ZXNbYWR0c1NhbXBsZWluZ0luZGV4XX1Iel0sY2hhbm5lbENvbmZpZzoke2FkdHNDaGFuZWxDb25maWd9YCk7XG4gICAgLy8gZmlyZWZveDogZnJlcSBsZXNzIHRoYW4gMjRrSHogPSBBQUMgU0JSIChIRS1BQUMpXG4gICAgaWYgKHVzZXJBZ2VudC5pbmRleE9mKCdmaXJlZm94JykgIT09IC0xKSB7XG4gICAgICBpZiAoYWR0c1NhbXBsZWluZ0luZGV4ID49IDYpIHtcbiAgICAgICAgYWR0c09iamVjdFR5cGUgPSA1O1xuICAgICAgICBjb25maWcgPSBuZXcgQXJyYXkoNCk7XG4gICAgICAgIC8vIEhFLUFBQyB1c2VzIFNCUiAoU3BlY3RyYWwgQmFuZCBSZXBsaWNhdGlvbikgLCBoaWdoIGZyZXF1ZW5jaWVzIGFyZSBjb25zdHJ1Y3RlZCBmcm9tIGxvdyBmcmVxdWVuY2llc1xuICAgICAgICAvLyB0aGVyZSBpcyBhIGZhY3RvciAyIGJldHdlZW4gZnJhbWUgc2FtcGxlIHJhdGUgYW5kIG91dHB1dCBzYW1wbGUgcmF0ZVxuICAgICAgICAvLyBtdWx0aXBseSBmcmVxdWVuY3kgYnkgMiAoc2VlIHRhYmxlIGJlbG93LCBlcXVpdmFsZW50IHRvIHN1YnN0cmFjdCAzKVxuICAgICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggPSBhZHRzU2FtcGxlaW5nSW5kZXggLSAzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYWR0c09iamVjdFR5cGUgPSAyO1xuICAgICAgICBjb25maWcgPSBuZXcgQXJyYXkoMik7XG4gICAgICAgIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCA9IGFkdHNTYW1wbGVpbmdJbmRleDtcbiAgICAgIH1cbiAgICAgIC8vIEFuZHJvaWQgOiBhbHdheXMgdXNlIEFBQ1xuICAgIH0gZWxzZSBpZiAodXNlckFnZW50LmluZGV4T2YoJ2FuZHJvaWQnKSAhPT0gLTEpIHtcbiAgICAgIGFkdHNPYmplY3RUeXBlID0gMjtcbiAgICAgIGNvbmZpZyA9IG5ldyBBcnJheSgyKTtcbiAgICAgIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCA9IGFkdHNTYW1wbGVpbmdJbmRleDtcbiAgICB9IGVsc2Uge1xuICAgICAgLyogIGZvciBvdGhlciBicm93c2VycyAoY2hyb21lIC4uLilcbiAgICAgICAgICBhbHdheXMgZm9yY2UgYXVkaW8gdHlwZSB0byBiZSBIRS1BQUMgU0JSLCBhcyBzb21lIGJyb3dzZXJzIGRvIG5vdCBzdXBwb3J0IGF1ZGlvIGNvZGVjIHN3aXRjaCBwcm9wZXJseSAobGlrZSBDaHJvbWUgLi4uKVxuICAgICAgKi9cbiAgICAgIGFkdHNPYmplY3RUeXBlID0gNTtcbiAgICAgIGNvbmZpZyA9IG5ldyBBcnJheSg0KTtcbiAgICAgIC8vIGlmIChtYW5pZmVzdCBjb2RlYyBpcyBIRS1BQUMgb3IgSEUtQUFDdjIpIE9SIChtYW5pZmVzdCBjb2RlYyBub3Qgc3BlY2lmaWVkIEFORCBmcmVxdWVuY3kgbGVzcyB0aGFuIDI0a0h6KVxuICAgICAgaWYgKChhdWRpb0NvZGVjICYmICgoYXVkaW9Db2RlYy5pbmRleE9mKCdtcDRhLjQwLjI5JykgIT09IC0xKSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAoYXVkaW9Db2RlYy5pbmRleE9mKCdtcDRhLjQwLjUnKSAhPT0gLTEpKSkgfHxcbiAgICAgICAgICAoIWF1ZGlvQ29kZWMgJiYgYWR0c1NhbXBsZWluZ0luZGV4ID49IDYpKSB7XG4gICAgICAgIC8vIEhFLUFBQyB1c2VzIFNCUiAoU3BlY3RyYWwgQmFuZCBSZXBsaWNhdGlvbikgLCBoaWdoIGZyZXF1ZW5jaWVzIGFyZSBjb25zdHJ1Y3RlZCBmcm9tIGxvdyBmcmVxdWVuY2llc1xuICAgICAgICAvLyB0aGVyZSBpcyBhIGZhY3RvciAyIGJldHdlZW4gZnJhbWUgc2FtcGxlIHJhdGUgYW5kIG91dHB1dCBzYW1wbGUgcmF0ZVxuICAgICAgICAvLyBtdWx0aXBseSBmcmVxdWVuY3kgYnkgMiAoc2VlIHRhYmxlIGJlbG93LCBlcXVpdmFsZW50IHRvIHN1YnN0cmFjdCAzKVxuICAgICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggPSBhZHRzU2FtcGxlaW5nSW5kZXggLSAzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gaWYgKG1hbmlmZXN0IGNvZGVjIGlzIEFBQykgQU5EIChmcmVxdWVuY3kgbGVzcyB0aGFuIDI0a0h6IE9SIG5iIGNoYW5uZWwgaXMgMSkgT1IgKG1hbmlmZXN0IGNvZGVjIG5vdCBzcGVjaWZpZWQgYW5kIG1vbm8gYXVkaW8pXG4gICAgICAgIC8vIENocm9tZSBmYWlscyB0byBwbGF5IGJhY2sgd2l0aCBBQUMgTEMgbW9ubyB3aGVuIGluaXRpYWxpemVkIHdpdGggSEUtQUFDLiAgVGhpcyBpcyBub3QgYSBwcm9ibGVtIHdpdGggc3RlcmVvLlxuICAgICAgICBpZiAoYXVkaW9Db2RlYyAmJiBhdWRpb0NvZGVjLmluZGV4T2YoJ21wNGEuNDAuMicpICE9PSAtMSAmJiAoYWR0c1NhbXBsZWluZ0luZGV4ID49IDYgfHwgYWR0c0NoYW5lbENvbmZpZyA9PT0gMSkgfHxcbiAgICAgICAgICAgICghYXVkaW9Db2RlYyAmJiBhZHRzQ2hhbmVsQ29uZmlnID09PSAxKSkge1xuICAgICAgICAgIGFkdHNPYmplY3RUeXBlID0gMjtcbiAgICAgICAgICBjb25maWcgPSBuZXcgQXJyYXkoMik7XG4gICAgICAgIH1cbiAgICAgICAgYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ID0gYWR0c1NhbXBsZWluZ0luZGV4O1xuICAgICAgfVxuICAgIH1cbiAgICAvKiByZWZlciB0byBodHRwOi8vd2lraS5tdWx0aW1lZGlhLmN4L2luZGV4LnBocD90aXRsZT1NUEVHLTRfQXVkaW8jQXVkaW9fU3BlY2lmaWNfQ29uZmlnXG4gICAgICAgIElTTyAxNDQ5Ni0zIChBQUMpLnBkZiAtIFRhYmxlIDEuMTMg4oCUIFN5bnRheCBvZiBBdWRpb1NwZWNpZmljQ29uZmlnKClcbiAgICAgIEF1ZGlvIFByb2ZpbGUgLyBBdWRpbyBPYmplY3QgVHlwZVxuICAgICAgMDogTnVsbFxuICAgICAgMTogQUFDIE1haW5cbiAgICAgIDI6IEFBQyBMQyAoTG93IENvbXBsZXhpdHkpXG4gICAgICAzOiBBQUMgU1NSIChTY2FsYWJsZSBTYW1wbGUgUmF0ZSlcbiAgICAgIDQ6IEFBQyBMVFAgKExvbmcgVGVybSBQcmVkaWN0aW9uKVxuICAgICAgNTogU0JSIChTcGVjdHJhbCBCYW5kIFJlcGxpY2F0aW9uKVxuICAgICAgNjogQUFDIFNjYWxhYmxlXG4gICAgIHNhbXBsaW5nIGZyZXFcbiAgICAgIDA6IDk2MDAwIEh6XG4gICAgICAxOiA4ODIwMCBIelxuICAgICAgMjogNjQwMDAgSHpcbiAgICAgIDM6IDQ4MDAwIEh6XG4gICAgICA0OiA0NDEwMCBIelxuICAgICAgNTogMzIwMDAgSHpcbiAgICAgIDY6IDI0MDAwIEh6XG4gICAgICA3OiAyMjA1MCBIelxuICAgICAgODogMTYwMDAgSHpcbiAgICAgIDk6IDEyMDAwIEh6XG4gICAgICAxMDogMTEwMjUgSHpcbiAgICAgIDExOiA4MDAwIEh6XG4gICAgICAxMjogNzM1MCBIelxuICAgICAgMTM6IFJlc2VydmVkXG4gICAgICAxNDogUmVzZXJ2ZWRcbiAgICAgIDE1OiBmcmVxdWVuY3kgaXMgd3JpdHRlbiBleHBsaWN0bHlcbiAgICAgIENoYW5uZWwgQ29uZmlndXJhdGlvbnNcbiAgICAgIFRoZXNlIGFyZSB0aGUgY2hhbm5lbCBjb25maWd1cmF0aW9uczpcbiAgICAgIDA6IERlZmluZWQgaW4gQU9UIFNwZWNpZmMgQ29uZmlnXG4gICAgICAxOiAxIGNoYW5uZWw6IGZyb250LWNlbnRlclxuICAgICAgMjogMiBjaGFubmVsczogZnJvbnQtbGVmdCwgZnJvbnQtcmlnaHRcbiAgICAqL1xuICAgIC8vIGF1ZGlvT2JqZWN0VHlwZSA9IHByb2ZpbGUgPT4gcHJvZmlsZSwgdGhlIE1QRUctNCBBdWRpbyBPYmplY3QgVHlwZSBtaW51cyAxXG4gICAgY29uZmlnWzBdID0gYWR0c09iamVjdFR5cGUgPDwgMztcbiAgICAvLyBzYW1wbGluZ0ZyZXF1ZW5jeUluZGV4XG4gICAgY29uZmlnWzBdIHw9IChhZHRzU2FtcGxlaW5nSW5kZXggJiAweDBFKSA+PiAxO1xuICAgIGNvbmZpZ1sxXSB8PSAoYWR0c1NhbXBsZWluZ0luZGV4ICYgMHgwMSkgPDwgNztcbiAgICAvLyBjaGFubmVsQ29uZmlndXJhdGlvblxuICAgIGNvbmZpZ1sxXSB8PSBhZHRzQ2hhbmVsQ29uZmlnIDw8IDM7XG4gICAgaWYgKGFkdHNPYmplY3RUeXBlID09PSA1KSB7XG4gICAgICAvLyBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXhcbiAgICAgIGNvbmZpZ1sxXSB8PSAoYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ICYgMHgwRSkgPj4gMTtcbiAgICAgIGNvbmZpZ1syXSA9IChhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggJiAweDAxKSA8PCA3O1xuICAgICAgLy8gYWR0c09iamVjdFR5cGUgKGZvcmNlIHRvIDIsIGNocm9tZSBpcyBjaGVja2luZyB0aGF0IG9iamVjdCB0eXBlIGlzIGxlc3MgdGhhbiA1ID8/P1xuICAgICAgLy8gICAgaHR0cHM6Ly9jaHJvbWl1bS5nb29nbGVzb3VyY2UuY29tL2Nocm9taXVtL3NyYy5naXQvKy9tYXN0ZXIvbWVkaWEvZm9ybWF0cy9tcDQvYWFjLmNjXG4gICAgICBjb25maWdbMl0gfD0gMiA8PCAyO1xuICAgICAgY29uZmlnWzNdID0gMDtcbiAgICB9XG4gICAgcmV0dXJuIHtjb25maWc6IGNvbmZpZywgc2FtcGxlcmF0ZTogYWR0c1NhbXBsZWluZ1JhdGVzW2FkdHNTYW1wbGVpbmdJbmRleF0sIGNoYW5uZWxDb3VudDogYWR0c0NoYW5lbENvbmZpZywgY29kZWM6ICgnbXA0YS40MC4nICsgYWR0c09iamVjdFR5cGUpfTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBBRFRTO1xuIiwiLyogIGlubGluZSBkZW11eGVyLlxuICogICBwcm9iZSBmcmFnbWVudHMgYW5kIGluc3RhbnRpYXRlIGFwcHJvcHJpYXRlIGRlbXV4ZXIgZGVwZW5kaW5nIG9uIGNvbnRlbnQgdHlwZSAoVFNEZW11eGVyLCBBQUNEZW11eGVyLCAuLi4pXG4gKi9cblxuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcbmltcG9ydCBBQUNEZW11eGVyIGZyb20gJy4uL2RlbXV4L2FhY2RlbXV4ZXInO1xuaW1wb3J0IFRTRGVtdXhlciBmcm9tICcuLi9kZW11eC90c2RlbXV4ZXInO1xuXG5jbGFzcyBEZW11eGVySW5saW5lIHtcblxuICBjb25zdHJ1Y3RvcihobHMscmVtdXhlcikge1xuICAgIHRoaXMuaGxzID0gaGxzO1xuICAgIHRoaXMucmVtdXhlciA9IHJlbXV4ZXI7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIHZhciBkZW11eGVyID0gdGhpcy5kZW11eGVyO1xuICAgIGlmIChkZW11eGVyKSB7XG4gICAgICBkZW11eGVyLmRlc3Ryb3koKTtcbiAgICB9XG4gIH1cblxuICBwdXNoKGRhdGEsIGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQsIGNjLCBsZXZlbCwgc24sIGR1cmF0aW9uKSB7XG4gICAgdmFyIGRlbXV4ZXIgPSB0aGlzLmRlbXV4ZXI7XG4gICAgaWYgKCFkZW11eGVyKSB7XG4gICAgICAvLyBwcm9iZSBmb3IgY29udGVudCB0eXBlXG4gICAgICBpZiAoVFNEZW11eGVyLnByb2JlKGRhdGEpKSB7XG4gICAgICAgIGRlbXV4ZXIgPSB0aGlzLmRlbXV4ZXIgPSBuZXcgVFNEZW11eGVyKHRoaXMuaGxzLHRoaXMucmVtdXhlcik7XG4gICAgICB9IGVsc2UgaWYoQUFDRGVtdXhlci5wcm9iZShkYXRhKSkge1xuICAgICAgICBkZW11eGVyID0gdGhpcy5kZW11eGVyID0gbmV3IEFBQ0RlbXV4ZXIodGhpcy5obHMsdGhpcy5yZW11eGVyKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlIDogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkZSQUdfUEFSU0lOR19FUlJPUiwgZmF0YWw6IHRydWUsIHJlYXNvbjogJ25vIGRlbXV4IG1hdGNoaW5nIHdpdGggY29udGVudCBmb3VuZCd9KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgICBkZW11eGVyLnB1c2goZGF0YSxhdWRpb0NvZGVjLHZpZGVvQ29kZWMsdGltZU9mZnNldCxjYyxsZXZlbCxzbixkdXJhdGlvbik7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRGVtdXhlcklubGluZTtcbiIsIi8qIGRlbXV4ZXIgd2ViIHdvcmtlci5cbiAqICAtIGxpc3RlbiB0byB3b3JrZXIgbWVzc2FnZSwgYW5kIHRyaWdnZXIgRGVtdXhlcklubGluZSB1cG9uIHJlY2VwdGlvbiBvZiBGcmFnbWVudHMuXG4gKiAgLSBwcm92aWRlcyBNUDQgQm94ZXMgYmFjayB0byBtYWluIHRocmVhZCB1c2luZyBbdHJhbnNmZXJhYmxlIG9iamVjdHNdKGh0dHBzOi8vZGV2ZWxvcGVycy5nb29nbGUuY29tL3dlYi91cGRhdGVzLzIwMTEvMTIvVHJhbnNmZXJhYmxlLU9iamVjdHMtTGlnaHRuaW5nLUZhc3QpIGluIG9yZGVyIHRvIG1pbmltaXplIG1lc3NhZ2UgcGFzc2luZyBvdmVyaGVhZC5cbiAqL1xuXG4gaW1wb3J0IERlbXV4ZXJJbmxpbmUgZnJvbSAnLi4vZGVtdXgvZGVtdXhlci1pbmxpbmUnO1xuIGltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuIGltcG9ydCBFdmVudEVtaXR0ZXIgZnJvbSAnZXZlbnRzJztcbiBpbXBvcnQgTVA0UmVtdXhlciBmcm9tICcuLi9yZW11eC9tcDQtcmVtdXhlcic7XG5cbnZhciBEZW11eGVyV29ya2VyID0gZnVuY3Rpb24gKHNlbGYpIHtcbiAgLy8gb2JzZXJ2ZXIgc2V0dXBcbiAgdmFyIG9ic2VydmVyID0gbmV3IEV2ZW50RW1pdHRlcigpO1xuICBvYnNlcnZlci50cmlnZ2VyID0gZnVuY3Rpb24gdHJpZ2dlciAoZXZlbnQsIC4uLmRhdGEpIHtcbiAgICBvYnNlcnZlci5lbWl0KGV2ZW50LCBldmVudCwgLi4uZGF0YSk7XG4gIH07XG5cbiAgb2JzZXJ2ZXIub2ZmID0gZnVuY3Rpb24gb2ZmIChldmVudCwgLi4uZGF0YSkge1xuICAgIG9ic2VydmVyLnJlbW92ZUxpc3RlbmVyKGV2ZW50LCAuLi5kYXRhKTtcbiAgfTtcbiAgc2VsZi5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgZnVuY3Rpb24gKGV2KSB7XG4gICAgLy9jb25zb2xlLmxvZygnZGVtdXhlciBjbWQ6JyArIGV2LmRhdGEuY21kKTtcbiAgICBzd2l0Y2ggKGV2LmRhdGEuY21kKSB7XG4gICAgICBjYXNlICdpbml0JzpcbiAgICAgICAgc2VsZi5kZW11eGVyID0gbmV3IERlbXV4ZXJJbmxpbmUob2JzZXJ2ZXIsTVA0UmVtdXhlcik7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnZGVtdXgnOlxuICAgICAgICB2YXIgZGF0YSA9IGV2LmRhdGE7XG4gICAgICAgIHNlbGYuZGVtdXhlci5wdXNoKG5ldyBVaW50OEFycmF5KGRhdGEuZGF0YSksIGRhdGEuYXVkaW9Db2RlYywgZGF0YS52aWRlb0NvZGVjLCBkYXRhLnRpbWVPZmZzZXQsIGRhdGEuY2MsIGRhdGEubGV2ZWwsIGRhdGEuc24sIGRhdGEuZHVyYXRpb24pO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gbGlzdGVuIHRvIGV2ZW50cyB0cmlnZ2VyZWQgYnkgVFMgRGVtdXhlclxuICBvYnNlcnZlci5vbihFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULCBmdW5jdGlvbihldiwgZGF0YSkge1xuICAgIHZhciBvYmpEYXRhID0ge2V2ZW50OiBldn07XG4gICAgdmFyIG9ialRyYW5zZmVyYWJsZSA9IFtdO1xuICAgIGlmIChkYXRhLmF1ZGlvQ29kZWMpIHtcbiAgICAgIG9iakRhdGEuYXVkaW9Db2RlYyA9IGRhdGEuYXVkaW9Db2RlYztcbiAgICAgIG9iakRhdGEuYXVkaW9Nb292ID0gZGF0YS5hdWRpb01vb3YuYnVmZmVyO1xuICAgICAgb2JqRGF0YS5hdWRpb0NoYW5uZWxDb3VudCA9IGRhdGEuYXVkaW9DaGFubmVsQ291bnQ7XG4gICAgICBvYmpUcmFuc2ZlcmFibGUucHVzaChvYmpEYXRhLmF1ZGlvTW9vdik7XG4gICAgfVxuICAgIGlmIChkYXRhLnZpZGVvQ29kZWMpIHtcbiAgICAgIG9iakRhdGEudmlkZW9Db2RlYyA9IGRhdGEudmlkZW9Db2RlYztcbiAgICAgIG9iakRhdGEudmlkZW9Nb292ID0gZGF0YS52aWRlb01vb3YuYnVmZmVyO1xuICAgICAgb2JqRGF0YS52aWRlb1dpZHRoID0gZGF0YS52aWRlb1dpZHRoO1xuICAgICAgb2JqRGF0YS52aWRlb0hlaWdodCA9IGRhdGEudmlkZW9IZWlnaHQ7XG4gICAgICBvYmpUcmFuc2ZlcmFibGUucHVzaChvYmpEYXRhLnZpZGVvTW9vdik7XG4gICAgfVxuICAgIC8vIHBhc3MgbW9vdiBhcyB0cmFuc2ZlcmFibGUgb2JqZWN0IChubyBjb3B5KVxuICAgIHNlbGYucG9zdE1lc3NhZ2Uob2JqRGF0YSxvYmpUcmFuc2ZlcmFibGUpO1xuICB9KTtcblxuICBvYnNlcnZlci5vbihFdmVudC5GUkFHX1BBUlNJTkdfREFUQSwgZnVuY3Rpb24oZXYsIGRhdGEpIHtcbiAgICB2YXIgb2JqRGF0YSA9IHtldmVudDogZXYsIHR5cGU6IGRhdGEudHlwZSwgc3RhcnRQVFM6IGRhdGEuc3RhcnRQVFMsIGVuZFBUUzogZGF0YS5lbmRQVFMsIHN0YXJ0RFRTOiBkYXRhLnN0YXJ0RFRTLCBlbmREVFM6IGRhdGEuZW5kRFRTLCBtb29mOiBkYXRhLm1vb2YuYnVmZmVyLCBtZGF0OiBkYXRhLm1kYXQuYnVmZmVyLCBuYjogZGF0YS5uYn07XG4gICAgLy8gcGFzcyBtb29mL21kYXQgZGF0YSBhcyB0cmFuc2ZlcmFibGUgb2JqZWN0IChubyBjb3B5KVxuICAgIHNlbGYucG9zdE1lc3NhZ2Uob2JqRGF0YSwgW29iakRhdGEubW9vZiwgb2JqRGF0YS5tZGF0XSk7XG4gIH0pO1xuXG4gIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0VELCBmdW5jdGlvbihldmVudCkge1xuICAgIHNlbGYucG9zdE1lc3NhZ2Uoe2V2ZW50OiBldmVudH0pO1xuICB9KTtcblxuICBvYnNlcnZlci5vbihFdmVudC5FUlJPUiwgZnVuY3Rpb24oZXZlbnQsIGRhdGEpIHtcbiAgICBzZWxmLnBvc3RNZXNzYWdlKHtldmVudDogZXZlbnQsIGRhdGE6IGRhdGF9KTtcbiAgfSk7XG5cbiAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19QQVJTSU5HX01FVEFEQVRBLCBmdW5jdGlvbihldmVudCwgZGF0YSkge1xuICAgIHZhciBvYmpEYXRhID0ge2V2ZW50OiBldmVudCwgc2FtcGxlczogZGF0YS5zYW1wbGVzfTtcbiAgICBzZWxmLnBvc3RNZXNzYWdlKG9iakRhdGEpO1xuICB9KTtcblxuICBvYnNlcnZlci5vbihFdmVudC5GUkFHX1BBUlNJTkdfVVNFUkRBVEEsIGZ1bmN0aW9uKGV2ZW50LCBkYXRhKSB7XG4gICAgdmFyIG9iakRhdGEgPSB7ZXZlbnQ6IGV2ZW50LCBzYW1wbGVzOiBkYXRhLnNhbXBsZXN9O1xuICAgIHNlbGYucG9zdE1lc3NhZ2Uob2JqRGF0YSk7XG4gIH0pO1xuXG59O1xuXG5leHBvcnQgZGVmYXVsdCBEZW11eGVyV29ya2VyO1xuXG4iLCJpbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBEZW11eGVySW5saW5lIGZyb20gJy4uL2RlbXV4L2RlbXV4ZXItaW5saW5lJztcbmltcG9ydCBEZW11eGVyV29ya2VyIGZyb20gJy4uL2RlbXV4L2RlbXV4ZXItd29ya2VyJztcbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IE1QNFJlbXV4ZXIgZnJvbSAnLi4vcmVtdXgvbXA0LXJlbXV4ZXInO1xuaW1wb3J0IERlY3J5cHRlciBmcm9tICcuLi9jcnlwdC9kZWNyeXB0ZXInO1xuXG5jbGFzcyBEZW11eGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMpIHtcbiAgICB0aGlzLmhscyA9IGhscztcbiAgICBpZiAoaGxzLmNvbmZpZy5lbmFibGVXb3JrZXIgJiYgKHR5cGVvZihXb3JrZXIpICE9PSAndW5kZWZpbmVkJykpIHtcbiAgICAgICAgbG9nZ2VyLmxvZygnZGVtdXhpbmcgaW4gd2Vid29ya2VyJyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdmFyIHdvcmsgPSByZXF1aXJlKCd3ZWJ3b3JraWZ5Jyk7XG4gICAgICAgICAgdGhpcy53ID0gd29yayhEZW11eGVyV29ya2VyKTtcbiAgICAgICAgICB0aGlzLm9ud21zZyA9IHRoaXMub25Xb3JrZXJNZXNzYWdlLmJpbmQodGhpcyk7XG4gICAgICAgICAgdGhpcy53LmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCB0aGlzLm9ud21zZyk7XG4gICAgICAgICAgdGhpcy53LnBvc3RNZXNzYWdlKHtjbWQ6ICdpbml0J30pO1xuICAgICAgICB9IGNhdGNoKGVycikge1xuICAgICAgICAgIGxvZ2dlci5lcnJvcignZXJyb3Igd2hpbGUgaW5pdGlhbGl6aW5nIERlbXV4ZXJXb3JrZXIsIGZhbGxiYWNrIG9uIERlbXV4ZXJJbmxpbmUnKTtcbiAgICAgICAgICB0aGlzLmRlbXV4ZXIgPSBuZXcgRGVtdXhlcklubGluZShobHMsTVA0UmVtdXhlcik7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZGVtdXhlciA9IG5ldyBEZW11eGVySW5saW5lKGhscyxNUDRSZW11eGVyKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuZGVtdXhJbml0aWFsaXplZCA9IHRydWU7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIGlmICh0aGlzLncpIHtcbiAgICAgIHRoaXMudy5yZW1vdmVFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgdGhpcy5vbndtc2cpO1xuICAgICAgdGhpcy53LnRlcm1pbmF0ZSgpO1xuICAgICAgdGhpcy53ID0gbnVsbDtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5kZW11eGVyLmRlc3Ryb3koKTtcbiAgICAgIHRoaXMuZGVtdXhlciA9IG51bGw7XG4gICAgfVxuICAgIGlmICh0aGlzLmRlY3J5cHRlcikge1xuICAgICAgdGhpcy5kZWNyeXB0ZXIuZGVzdHJveSgpO1xuICAgICAgdGhpcy5kZWNyeXB0ZXIgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIHB1c2hEZWNyeXB0ZWQoZGF0YSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCwgY2MsIGxldmVsLCBzbiwgZHVyYXRpb24pIHtcbiAgICBpZiAodGhpcy53KSB7XG4gICAgICAvLyBwb3N0IGZyYWdtZW50IHBheWxvYWQgYXMgdHJhbnNmZXJhYmxlIG9iamVjdHMgKG5vIGNvcHkpXG4gICAgICB0aGlzLncucG9zdE1lc3NhZ2Uoe2NtZDogJ2RlbXV4JywgZGF0YTogZGF0YSwgYXVkaW9Db2RlYzogYXVkaW9Db2RlYywgdmlkZW9Db2RlYzogdmlkZW9Db2RlYywgdGltZU9mZnNldDogdGltZU9mZnNldCwgY2M6IGNjLCBsZXZlbDogbGV2ZWwsIHNuIDogc24sIGR1cmF0aW9uOiBkdXJhdGlvbn0sIFtkYXRhXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZGVtdXhlci5wdXNoKG5ldyBVaW50OEFycmF5KGRhdGEpLCBhdWRpb0NvZGVjLCB2aWRlb0NvZGVjLCB0aW1lT2Zmc2V0LCBjYywgbGV2ZWwsIHNuLCBkdXJhdGlvbik7XG4gICAgfVxuICB9XG5cbiAgcHVzaChkYXRhLCBhdWRpb0NvZGVjLCB2aWRlb0NvZGVjLCB0aW1lT2Zmc2V0LCBjYywgbGV2ZWwsIHNuLCBkdXJhdGlvbiwgZGVjcnlwdGRhdGEpIHtcbiAgICBpZiAoKGRhdGEuYnl0ZUxlbmd0aCA+IDApICYmIChkZWNyeXB0ZGF0YSAhPSBudWxsKSAmJiAoZGVjcnlwdGRhdGEua2V5ICE9IG51bGwpICYmIChkZWNyeXB0ZGF0YS5tZXRob2QgPT09ICdBRVMtMTI4JykpIHtcbiAgICAgIGlmICh0aGlzLmRlY3J5cHRlciA9PSBudWxsKSB7XG4gICAgICAgIHRoaXMuZGVjcnlwdGVyID0gbmV3IERlY3J5cHRlcih0aGlzLmhscyk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIHZhciBsb2NhbHRoaXMgPSB0aGlzO1xuICAgICAgdGhpcy5kZWNyeXB0ZXIuZGVjcnlwdChkYXRhLCBkZWNyeXB0ZGF0YS5rZXksIGRlY3J5cHRkYXRhLml2LCBmdW5jdGlvbihkZWNyeXB0ZWREYXRhKXtcbiAgICAgICAgbG9jYWx0aGlzLnB1c2hEZWNyeXB0ZWQoZGVjcnlwdGVkRGF0YSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCwgY2MsIGxldmVsLCBzbiwgZHVyYXRpb24pO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucHVzaERlY3J5cHRlZChkYXRhLCBhdWRpb0NvZGVjLCB2aWRlb0NvZGVjLCB0aW1lT2Zmc2V0LCBjYywgbGV2ZWwsIHNuLCBkdXJhdGlvbik7XG4gICAgfVxuICB9XG5cbiAgb25Xb3JrZXJNZXNzYWdlKGV2KSB7XG4gICAgLy9jb25zb2xlLmxvZygnb25Xb3JrZXJNZXNzYWdlOicgKyBldi5kYXRhLmV2ZW50KTtcbiAgICBzd2l0Y2goZXYuZGF0YS5ldmVudCkge1xuICAgICAgY2FzZSBFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5UOlxuICAgICAgICB2YXIgb2JqID0ge307XG4gICAgICAgIGlmIChldi5kYXRhLmF1ZGlvTW9vdikge1xuICAgICAgICAgIG9iai5hdWRpb01vb3YgPSBuZXcgVWludDhBcnJheShldi5kYXRhLmF1ZGlvTW9vdik7XG4gICAgICAgICAgb2JqLmF1ZGlvQ29kZWMgPSBldi5kYXRhLmF1ZGlvQ29kZWM7XG4gICAgICAgICAgb2JqLmF1ZGlvQ2hhbm5lbENvdW50ID0gZXYuZGF0YS5hdWRpb0NoYW5uZWxDb3VudDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZXYuZGF0YS52aWRlb01vb3YpIHtcbiAgICAgICAgICBvYmoudmlkZW9Nb292ID0gbmV3IFVpbnQ4QXJyYXkoZXYuZGF0YS52aWRlb01vb3YpO1xuICAgICAgICAgIG9iai52aWRlb0NvZGVjID0gZXYuZGF0YS52aWRlb0NvZGVjO1xuICAgICAgICAgIG9iai52aWRlb1dpZHRoID0gZXYuZGF0YS52aWRlb1dpZHRoO1xuICAgICAgICAgIG9iai52aWRlb0hlaWdodCA9IGV2LmRhdGEudmlkZW9IZWlnaHQ7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULCBvYmopO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgRXZlbnQuRlJBR19QQVJTSU5HX0RBVEE6XG4gICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0RBVEEse1xuICAgICAgICAgIG1vb2Y6IG5ldyBVaW50OEFycmF5KGV2LmRhdGEubW9vZiksXG4gICAgICAgICAgbWRhdDogbmV3IFVpbnQ4QXJyYXkoZXYuZGF0YS5tZGF0KSxcbiAgICAgICAgICBzdGFydFBUUzogZXYuZGF0YS5zdGFydFBUUyxcbiAgICAgICAgICBlbmRQVFM6IGV2LmRhdGEuZW5kUFRTLFxuICAgICAgICAgIHN0YXJ0RFRTOiBldi5kYXRhLnN0YXJ0RFRTLFxuICAgICAgICAgIGVuZERUUzogZXYuZGF0YS5lbmREVFMsXG4gICAgICAgICAgdHlwZTogZXYuZGF0YS50eXBlLFxuICAgICAgICAgIG5iOiBldi5kYXRhLm5iXG4gICAgICAgIH0pO1xuICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBFdmVudC5GUkFHX1BBUlNJTkdfTUVUQURBVEE6XG4gICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX01FVEFEQVRBLCB7XG4gICAgICAgICAgc2FtcGxlczogZXYuZGF0YS5zYW1wbGVzXG4gICAgICAgIH0pO1xuICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBFdmVudC5GUkFHX1BBUlNJTkdfVVNFUkRBVEE6XG4gICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX1VTRVJEQVRBLCB7XG4gICAgICAgICAgc2FtcGxlczogZXYuZGF0YS5zYW1wbGVzXG4gICAgICAgIH0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoZXYuZGF0YS5ldmVudCwgZXYuZGF0YS5kYXRhKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IERlbXV4ZXI7XG5cbiIsIi8qKlxuICogUGFyc2VyIGZvciBleHBvbmVudGlhbCBHb2xvbWIgY29kZXMsIGEgdmFyaWFibGUtYml0d2lkdGggbnVtYmVyIGVuY29kaW5nIHNjaGVtZSB1c2VkIGJ5IGgyNjQuXG4qL1xuXG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuY2xhc3MgRXhwR29sb21iIHtcblxuICBjb25zdHJ1Y3RvcihkYXRhKSB7XG4gICAgdGhpcy5kYXRhID0gZGF0YTtcbiAgICAvLyB0aGUgbnVtYmVyIG9mIGJ5dGVzIGxlZnQgdG8gZXhhbWluZSBpbiB0aGlzLmRhdGFcbiAgICB0aGlzLmJ5dGVzQXZhaWxhYmxlID0gdGhpcy5kYXRhLmJ5dGVMZW5ndGg7XG4gICAgLy8gdGhlIGN1cnJlbnQgd29yZCBiZWluZyBleGFtaW5lZFxuICAgIHRoaXMud29yZCA9IDA7IC8vIDp1aW50XG4gICAgLy8gdGhlIG51bWJlciBvZiBiaXRzIGxlZnQgdG8gZXhhbWluZSBpbiB0aGUgY3VycmVudCB3b3JkXG4gICAgdGhpcy5iaXRzQXZhaWxhYmxlID0gMDsgLy8gOnVpbnRcbiAgfVxuXG4gIC8vICgpOnZvaWRcbiAgbG9hZFdvcmQoKSB7XG4gICAgdmFyXG4gICAgICBwb3NpdGlvbiA9IHRoaXMuZGF0YS5ieXRlTGVuZ3RoIC0gdGhpcy5ieXRlc0F2YWlsYWJsZSxcbiAgICAgIHdvcmtpbmdCeXRlcyA9IG5ldyBVaW50OEFycmF5KDQpLFxuICAgICAgYXZhaWxhYmxlQnl0ZXMgPSBNYXRoLm1pbig0LCB0aGlzLmJ5dGVzQXZhaWxhYmxlKTtcbiAgICBpZiAoYXZhaWxhYmxlQnl0ZXMgPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignbm8gYnl0ZXMgYXZhaWxhYmxlJyk7XG4gICAgfVxuICAgIHdvcmtpbmdCeXRlcy5zZXQodGhpcy5kYXRhLnN1YmFycmF5KHBvc2l0aW9uLCBwb3NpdGlvbiArIGF2YWlsYWJsZUJ5dGVzKSk7XG4gICAgdGhpcy53b3JkID0gbmV3IERhdGFWaWV3KHdvcmtpbmdCeXRlcy5idWZmZXIpLmdldFVpbnQzMigwKTtcbiAgICAvLyB0cmFjayB0aGUgYW1vdW50IG9mIHRoaXMuZGF0YSB0aGF0IGhhcyBiZWVuIHByb2Nlc3NlZFxuICAgIHRoaXMuYml0c0F2YWlsYWJsZSA9IGF2YWlsYWJsZUJ5dGVzICogODtcbiAgICB0aGlzLmJ5dGVzQXZhaWxhYmxlIC09IGF2YWlsYWJsZUJ5dGVzO1xuICB9XG5cbiAgLy8gKGNvdW50OmludCk6dm9pZFxuICBza2lwQml0cyhjb3VudCkge1xuICAgIHZhciBza2lwQnl0ZXM7IC8vIDppbnRcbiAgICBpZiAodGhpcy5iaXRzQXZhaWxhYmxlID4gY291bnQpIHtcbiAgICAgIHRoaXMud29yZCA8PD0gY291bnQ7XG4gICAgICB0aGlzLmJpdHNBdmFpbGFibGUgLT0gY291bnQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvdW50IC09IHRoaXMuYml0c0F2YWlsYWJsZTtcbiAgICAgIHNraXBCeXRlcyA9IGNvdW50ID4+IDM7XG4gICAgICBjb3VudCAtPSAoc2tpcEJ5dGVzID4+IDMpO1xuICAgICAgdGhpcy5ieXRlc0F2YWlsYWJsZSAtPSBza2lwQnl0ZXM7XG4gICAgICB0aGlzLmxvYWRXb3JkKCk7XG4gICAgICB0aGlzLndvcmQgPDw9IGNvdW50O1xuICAgICAgdGhpcy5iaXRzQXZhaWxhYmxlIC09IGNvdW50O1xuICAgIH1cbiAgfVxuXG4gIC8vIChzaXplOmludCk6dWludFxuICByZWFkQml0cyhzaXplKSB7XG4gICAgdmFyXG4gICAgICBiaXRzID0gTWF0aC5taW4odGhpcy5iaXRzQXZhaWxhYmxlLCBzaXplKSwgLy8gOnVpbnRcbiAgICAgIHZhbHUgPSB0aGlzLndvcmQgPj4+ICgzMiAtIGJpdHMpOyAvLyA6dWludFxuICAgIGlmIChzaXplID4gMzIpIHtcbiAgICAgIGxvZ2dlci5lcnJvcignQ2Fubm90IHJlYWQgbW9yZSB0aGFuIDMyIGJpdHMgYXQgYSB0aW1lJyk7XG4gICAgfVxuICAgIHRoaXMuYml0c0F2YWlsYWJsZSAtPSBiaXRzO1xuICAgIGlmICh0aGlzLmJpdHNBdmFpbGFibGUgPiAwKSB7XG4gICAgICB0aGlzLndvcmQgPDw9IGJpdHM7XG4gICAgfSBlbHNlIGlmICh0aGlzLmJ5dGVzQXZhaWxhYmxlID4gMCkge1xuICAgICAgdGhpcy5sb2FkV29yZCgpO1xuICAgIH1cbiAgICBiaXRzID0gc2l6ZSAtIGJpdHM7XG4gICAgaWYgKGJpdHMgPiAwKSB7XG4gICAgICByZXR1cm4gdmFsdSA8PCBiaXRzIHwgdGhpcy5yZWFkQml0cyhiaXRzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHZhbHU7XG4gICAgfVxuICB9XG5cbiAgLy8gKCk6dWludFxuICBza2lwTFooKSB7XG4gICAgdmFyIGxlYWRpbmdaZXJvQ291bnQ7IC8vIDp1aW50XG4gICAgZm9yIChsZWFkaW5nWmVyb0NvdW50ID0gMDsgbGVhZGluZ1plcm9Db3VudCA8IHRoaXMuYml0c0F2YWlsYWJsZTsgKytsZWFkaW5nWmVyb0NvdW50KSB7XG4gICAgICBpZiAoMCAhPT0gKHRoaXMud29yZCAmICgweDgwMDAwMDAwID4+PiBsZWFkaW5nWmVyb0NvdW50KSkpIHtcbiAgICAgICAgLy8gdGhlIGZpcnN0IGJpdCBvZiB3b3JraW5nIHdvcmQgaXMgMVxuICAgICAgICB0aGlzLndvcmQgPDw9IGxlYWRpbmdaZXJvQ291bnQ7XG4gICAgICAgIHRoaXMuYml0c0F2YWlsYWJsZSAtPSBsZWFkaW5nWmVyb0NvdW50O1xuICAgICAgICByZXR1cm4gbGVhZGluZ1plcm9Db3VudDtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gd2UgZXhoYXVzdGVkIHdvcmQgYW5kIHN0aWxsIGhhdmUgbm90IGZvdW5kIGEgMVxuICAgIHRoaXMubG9hZFdvcmQoKTtcbiAgICByZXR1cm4gbGVhZGluZ1plcm9Db3VudCArIHRoaXMuc2tpcExaKCk7XG4gIH1cblxuICAvLyAoKTp2b2lkXG4gIHNraXBVRUcoKSB7XG4gICAgdGhpcy5za2lwQml0cygxICsgdGhpcy5za2lwTFooKSk7XG4gIH1cblxuICAvLyAoKTp2b2lkXG4gIHNraXBFRygpIHtcbiAgICB0aGlzLnNraXBCaXRzKDEgKyB0aGlzLnNraXBMWigpKTtcbiAgfVxuXG4gIC8vICgpOnVpbnRcbiAgcmVhZFVFRygpIHtcbiAgICB2YXIgY2x6ID0gdGhpcy5za2lwTFooKTsgLy8gOnVpbnRcbiAgICByZXR1cm4gdGhpcy5yZWFkQml0cyhjbHogKyAxKSAtIDE7XG4gIH1cblxuICAvLyAoKTppbnRcbiAgcmVhZEVHKCkge1xuICAgIHZhciB2YWx1ID0gdGhpcy5yZWFkVUVHKCk7IC8vIDppbnRcbiAgICBpZiAoMHgwMSAmIHZhbHUpIHtcbiAgICAgIC8vIHRoZSBudW1iZXIgaXMgb2RkIGlmIHRoZSBsb3cgb3JkZXIgYml0IGlzIHNldFxuICAgICAgcmV0dXJuICgxICsgdmFsdSkgPj4+IDE7IC8vIGFkZCAxIHRvIG1ha2UgaXQgZXZlbiwgYW5kIGRpdmlkZSBieSAyXG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiAtMSAqICh2YWx1ID4+PiAxKTsgLy8gZGl2aWRlIGJ5IHR3byB0aGVuIG1ha2UgaXQgbmVnYXRpdmVcbiAgICB9XG4gIH1cblxuICAvLyBTb21lIGNvbnZlbmllbmNlIGZ1bmN0aW9uc1xuICAvLyA6Qm9vbGVhblxuICByZWFkQm9vbGVhbigpIHtcbiAgICByZXR1cm4gMSA9PT0gdGhpcy5yZWFkQml0cygxKTtcbiAgfVxuXG4gIC8vICgpOmludFxuICByZWFkVUJ5dGUoKSB7XG4gICAgcmV0dXJuIHRoaXMucmVhZEJpdHMoOCk7XG4gIH1cblxuICAvLyAoKTppbnRcbiAgcmVhZFVTaG9ydCgpIHtcbiAgICByZXR1cm4gdGhpcy5yZWFkQml0cygxNik7XG4gIH1cbiAgICAvLyAoKTppbnRcbiAgcmVhZFVJbnQoKSB7XG4gICAgcmV0dXJuIHRoaXMucmVhZEJpdHMoMzIpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkdmFuY2UgdGhlIEV4cEdvbG9tYiBkZWNvZGVyIHBhc3QgYSBzY2FsaW5nIGxpc3QuIFRoZSBzY2FsaW5nXG4gICAqIGxpc3QgaXMgb3B0aW9uYWxseSB0cmFuc21pdHRlZCBhcyBwYXJ0IG9mIGEgc2VxdWVuY2UgcGFyYW1ldGVyXG4gICAqIHNldCBhbmQgaXMgbm90IHJlbGV2YW50IHRvIHRyYW5zbXV4aW5nLlxuICAgKiBAcGFyYW0gY291bnQge251bWJlcn0gdGhlIG51bWJlciBvZiBlbnRyaWVzIGluIHRoaXMgc2NhbGluZyBsaXN0XG4gICAqIEBzZWUgUmVjb21tZW5kYXRpb24gSVRVLVQgSC4yNjQsIFNlY3Rpb24gNy4zLjIuMS4xLjFcbiAgICovXG4gIHNraXBTY2FsaW5nTGlzdChjb3VudCkge1xuICAgIHZhclxuICAgICAgbGFzdFNjYWxlID0gOCxcbiAgICAgIG5leHRTY2FsZSA9IDgsXG4gICAgICBqLFxuICAgICAgZGVsdGFTY2FsZTtcbiAgICBmb3IgKGogPSAwOyBqIDwgY291bnQ7IGorKykge1xuICAgICAgaWYgKG5leHRTY2FsZSAhPT0gMCkge1xuICAgICAgICBkZWx0YVNjYWxlID0gdGhpcy5yZWFkRUcoKTtcbiAgICAgICAgbmV4dFNjYWxlID0gKGxhc3RTY2FsZSArIGRlbHRhU2NhbGUgKyAyNTYpICUgMjU2O1xuICAgICAgfVxuICAgICAgbGFzdFNjYWxlID0gKG5leHRTY2FsZSA9PT0gMCkgPyBsYXN0U2NhbGUgOiBuZXh0U2NhbGU7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJlYWQgYSBzZXF1ZW5jZSBwYXJhbWV0ZXIgc2V0IGFuZCByZXR1cm4gc29tZSBpbnRlcmVzdGluZyB2aWRlb1xuICAgKiBwcm9wZXJ0aWVzLiBBIHNlcXVlbmNlIHBhcmFtZXRlciBzZXQgaXMgdGhlIEgyNjQgbWV0YWRhdGEgdGhhdFxuICAgKiBkZXNjcmliZXMgdGhlIHByb3BlcnRpZXMgb2YgdXBjb21pbmcgdmlkZW8gZnJhbWVzLlxuICAgKiBAcGFyYW0gZGF0YSB7VWludDhBcnJheX0gdGhlIGJ5dGVzIG9mIGEgc2VxdWVuY2UgcGFyYW1ldGVyIHNldFxuICAgKiBAcmV0dXJuIHtvYmplY3R9IGFuIG9iamVjdCB3aXRoIGNvbmZpZ3VyYXRpb24gcGFyc2VkIGZyb20gdGhlXG4gICAqIHNlcXVlbmNlIHBhcmFtZXRlciBzZXQsIGluY2x1ZGluZyB0aGUgZGltZW5zaW9ucyBvZiB0aGVcbiAgICogYXNzb2NpYXRlZCB2aWRlbyBmcmFtZXMuXG4gICAqL1xuICByZWFkU1BTKCkge1xuICAgIHZhclxuICAgICAgZnJhbWVDcm9wTGVmdE9mZnNldCA9IDAsXG4gICAgICBmcmFtZUNyb3BSaWdodE9mZnNldCA9IDAsXG4gICAgICBmcmFtZUNyb3BUb3BPZmZzZXQgPSAwLFxuICAgICAgZnJhbWVDcm9wQm90dG9tT2Zmc2V0ID0gMCxcbiAgICAgIHNhclNjYWxlID0gMSxcbiAgICAgIHByb2ZpbGVJZGMscHJvZmlsZUNvbXBhdCxsZXZlbElkYyxcbiAgICAgIG51bVJlZkZyYW1lc0luUGljT3JkZXJDbnRDeWNsZSwgcGljV2lkdGhJbk1ic01pbnVzMSxcbiAgICAgIHBpY0hlaWdodEluTWFwVW5pdHNNaW51czEsXG4gICAgICBmcmFtZU1ic09ubHlGbGFnLFxuICAgICAgc2NhbGluZ0xpc3RDb3VudCxcbiAgICAgIGk7XG4gICAgdGhpcy5yZWFkVUJ5dGUoKTtcbiAgICBwcm9maWxlSWRjID0gdGhpcy5yZWFkVUJ5dGUoKTsgLy8gcHJvZmlsZV9pZGNcbiAgICBwcm9maWxlQ29tcGF0ID0gdGhpcy5yZWFkQml0cyg1KTsgLy8gY29uc3RyYWludF9zZXRbMC00XV9mbGFnLCB1KDUpXG4gICAgdGhpcy5za2lwQml0cygzKTsgLy8gcmVzZXJ2ZWRfemVyb18zYml0cyB1KDMpLFxuICAgIGxldmVsSWRjID0gdGhpcy5yZWFkVUJ5dGUoKTsgLy9sZXZlbF9pZGMgdSg4KVxuICAgIHRoaXMuc2tpcFVFRygpOyAvLyBzZXFfcGFyYW1ldGVyX3NldF9pZFxuICAgIC8vIHNvbWUgcHJvZmlsZXMgaGF2ZSBtb3JlIG9wdGlvbmFsIGRhdGEgd2UgZG9uJ3QgbmVlZFxuICAgIGlmIChwcm9maWxlSWRjID09PSAxMDAgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gMTEwIHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDEyMiB8fFxuICAgICAgICBwcm9maWxlSWRjID09PSAyNDQgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gNDQgIHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDgzICB8fFxuICAgICAgICBwcm9maWxlSWRjID09PSA4NiAgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gMTE4IHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDEyOCkge1xuICAgICAgdmFyIGNocm9tYUZvcm1hdElkYyA9IHRoaXMucmVhZFVFRygpO1xuICAgICAgaWYgKGNocm9tYUZvcm1hdElkYyA9PT0gMykge1xuICAgICAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBzZXBhcmF0ZV9jb2xvdXJfcGxhbmVfZmxhZ1xuICAgICAgfVxuICAgICAgdGhpcy5za2lwVUVHKCk7IC8vIGJpdF9kZXB0aF9sdW1hX21pbnVzOFxuICAgICAgdGhpcy5za2lwVUVHKCk7IC8vIGJpdF9kZXB0aF9jaHJvbWFfbWludXM4XG4gICAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBxcHByaW1lX3lfemVyb190cmFuc2Zvcm1fYnlwYXNzX2ZsYWdcbiAgICAgIGlmICh0aGlzLnJlYWRCb29sZWFuKCkpIHsgLy8gc2VxX3NjYWxpbmdfbWF0cml4X3ByZXNlbnRfZmxhZ1xuICAgICAgICBzY2FsaW5nTGlzdENvdW50ID0gKGNocm9tYUZvcm1hdElkYyAhPT0gMykgPyA4IDogMTI7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBzY2FsaW5nTGlzdENvdW50OyBpKyspIHtcbiAgICAgICAgICBpZiAodGhpcy5yZWFkQm9vbGVhbigpKSB7IC8vIHNlcV9zY2FsaW5nX2xpc3RfcHJlc2VudF9mbGFnWyBpIF1cbiAgICAgICAgICAgIGlmIChpIDwgNikge1xuICAgICAgICAgICAgICB0aGlzLnNraXBTY2FsaW5nTGlzdCgxNik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB0aGlzLnNraXBTY2FsaW5nTGlzdCg2NCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuc2tpcFVFRygpOyAvLyBsb2cyX21heF9mcmFtZV9udW1fbWludXM0XG4gICAgdmFyIHBpY09yZGVyQ250VHlwZSA9IHRoaXMucmVhZFVFRygpO1xuICAgIGlmIChwaWNPcmRlckNudFR5cGUgPT09IDApIHtcbiAgICAgIHRoaXMucmVhZFVFRygpOyAvL2xvZzJfbWF4X3BpY19vcmRlcl9jbnRfbHNiX21pbnVzNFxuICAgIH0gZWxzZSBpZiAocGljT3JkZXJDbnRUeXBlID09PSAxKSB7XG4gICAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBkZWx0YV9waWNfb3JkZXJfYWx3YXlzX3plcm9fZmxhZ1xuICAgICAgdGhpcy5za2lwRUcoKTsgLy8gb2Zmc2V0X2Zvcl9ub25fcmVmX3BpY1xuICAgICAgdGhpcy5za2lwRUcoKTsgLy8gb2Zmc2V0X2Zvcl90b3BfdG9fYm90dG9tX2ZpZWxkXG4gICAgICBudW1SZWZGcmFtZXNJblBpY09yZGVyQ250Q3ljbGUgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICAgIGZvcihpID0gMDsgaSA8IG51bVJlZkZyYW1lc0luUGljT3JkZXJDbnRDeWNsZTsgaSsrKSB7XG4gICAgICAgIHRoaXMuc2tpcEVHKCk7IC8vIG9mZnNldF9mb3JfcmVmX2ZyYW1lWyBpIF1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5za2lwVUVHKCk7IC8vIG1heF9udW1fcmVmX2ZyYW1lc1xuICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIGdhcHNfaW5fZnJhbWVfbnVtX3ZhbHVlX2FsbG93ZWRfZmxhZ1xuICAgIHBpY1dpZHRoSW5NYnNNaW51czEgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICBwaWNIZWlnaHRJbk1hcFVuaXRzTWludXMxID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgZnJhbWVNYnNPbmx5RmxhZyA9IHRoaXMucmVhZEJpdHMoMSk7XG4gICAgaWYgKGZyYW1lTWJzT25seUZsYWcgPT09IDApIHtcbiAgICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIG1iX2FkYXB0aXZlX2ZyYW1lX2ZpZWxkX2ZsYWdcbiAgICB9XG4gICAgdGhpcy5za2lwQml0cygxKTsgLy8gZGlyZWN0Xzh4OF9pbmZlcmVuY2VfZmxhZ1xuICAgIGlmICh0aGlzLnJlYWRCb29sZWFuKCkpIHsgLy8gZnJhbWVfY3JvcHBpbmdfZmxhZ1xuICAgICAgZnJhbWVDcm9wTGVmdE9mZnNldCA9IHRoaXMucmVhZFVFRygpO1xuICAgICAgZnJhbWVDcm9wUmlnaHRPZmZzZXQgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICAgIGZyYW1lQ3JvcFRvcE9mZnNldCA9IHRoaXMucmVhZFVFRygpO1xuICAgICAgZnJhbWVDcm9wQm90dG9tT2Zmc2V0ID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgfVxuICAgIGlmICh0aGlzLnJlYWRCb29sZWFuKCkpIHtcbiAgICAgIC8vIHZ1aV9wYXJhbWV0ZXJzX3ByZXNlbnRfZmxhZ1xuICAgICAgaWYgKHRoaXMucmVhZEJvb2xlYW4oKSkge1xuICAgICAgICAvLyBhc3BlY3RfcmF0aW9faW5mb19wcmVzZW50X2ZsYWdcbiAgICAgICAgbGV0IHNhclJhdGlvO1xuICAgICAgICBjb25zdCBhc3BlY3RSYXRpb0lkYyA9IHRoaXMucmVhZFVCeXRlKCk7XG4gICAgICAgIHN3aXRjaCAoYXNwZWN0UmF0aW9JZGMpIHtcbiAgICAgICAgICAvL2Nhc2UgMTogc2FyUmF0aW8gPSBbMSwxXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSAyOiBzYXJSYXRpbyA9IFsxMiwxMV07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgMzogc2FyUmF0aW8gPSBbMTAsMTFdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDQ6IHNhclJhdGlvID0gWzE2LDExXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSA1OiBzYXJSYXRpbyA9IFs0MCwzM107IGJyZWFrO1xuICAgICAgICAgIGNhc2UgNjogc2FyUmF0aW8gPSBbMjQsMTFdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDc6IHNhclJhdGlvID0gWzIwLDExXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSA4OiBzYXJSYXRpbyA9IFszMiwxMV07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgOTogc2FyUmF0aW8gPSBbODAsMzNdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDEwOiBzYXJSYXRpbyA9IFsxOCwxMV07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgMTE6IHNhclJhdGlvID0gWzE1LDExXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSAxMjogc2FyUmF0aW8gPSBbNjQsMzNdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDEzOiBzYXJSYXRpbyA9IFsxNjAsOTldOyBicmVhaztcbiAgICAgICAgICBjYXNlIDE0OiBzYXJSYXRpbyA9IFs0LDNdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDE1OiBzYXJSYXRpbyA9IFszLDJdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDE2OiBzYXJSYXRpbyA9IFsyLDFdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDI1NToge1xuICAgICAgICAgICAgc2FyUmF0aW8gPSBbdGhpcy5yZWFkVUJ5dGUoKSA8PCA4IHwgdGhpcy5yZWFkVUJ5dGUoKSwgdGhpcy5yZWFkVUJ5dGUoKSA8PCA4IHwgdGhpcy5yZWFkVUJ5dGUoKV07XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHNhclJhdGlvKSB7XG4gICAgICAgICAgc2FyU2NhbGUgPSBzYXJSYXRpb1swXSAvIHNhclJhdGlvWzFdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICB3aWR0aDogKCgocGljV2lkdGhJbk1ic01pbnVzMSArIDEpICogMTYpIC0gZnJhbWVDcm9wTGVmdE9mZnNldCAqIDIgLSBmcmFtZUNyb3BSaWdodE9mZnNldCAqIDIpICogc2FyU2NhbGUsXG4gICAgICBoZWlnaHQ6ICgoMiAtIGZyYW1lTWJzT25seUZsYWcpICogKHBpY0hlaWdodEluTWFwVW5pdHNNaW51czEgKyAxKSAqIDE2KSAtICgoZnJhbWVNYnNPbmx5RmxhZz8gMiA6IDQpICogKGZyYW1lQ3JvcFRvcE9mZnNldCArIGZyYW1lQ3JvcEJvdHRvbU9mZnNldCkpXG4gICAgfTtcbiAgfVxuXG4gIHJlYWRTbGljZVR5cGUoKSB7XG4gICAgLy8gc2tpcCBOQUx1IHR5cGVcbiAgICB0aGlzLnJlYWRVQnl0ZSgpO1xuICAgIC8vIGRpc2NhcmQgZmlyc3RfbWJfaW5fc2xpY2VcbiAgICB0aGlzLnJlYWRVRUcoKTtcbiAgICAvLyByZXR1cm4gc2xpY2VfdHlwZVxuICAgIHJldHVybiB0aGlzLnJlYWRVRUcoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFeHBHb2xvbWI7XG4iLCIvKipcbiAqIElEMyBwYXJzZXJcbiAqL1xuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG4vL2ltcG9ydCBIZXggZnJvbSAnLi4vdXRpbHMvaGV4JztcblxuIGNsYXNzIElEMyB7XG5cbiAgY29uc3RydWN0b3IoZGF0YSkge1xuICAgIHRoaXMuX2hhc1RpbWVTdGFtcCA9IGZhbHNlO1xuICAgIHZhciBvZmZzZXQgPSAwLCBieXRlMSxieXRlMixieXRlMyxieXRlNCx0YWdTaXplLGVuZFBvcyxoZWFkZXIsbGVuO1xuICAgICAgZG8ge1xuICAgICAgICBoZWFkZXIgPSB0aGlzLnJlYWRVVEYoZGF0YSxvZmZzZXQsMyk7XG4gICAgICAgIG9mZnNldCs9MztcbiAgICAgICAgICAvLyBmaXJzdCBjaGVjayBmb3IgSUQzIGhlYWRlclxuICAgICAgICAgIGlmIChoZWFkZXIgPT09ICdJRDMnKSB7XG4gICAgICAgICAgICAgIC8vIHNraXAgMjQgYml0c1xuICAgICAgICAgICAgICBvZmZzZXQgKz0gMztcbiAgICAgICAgICAgICAgLy8gcmV0cmlldmUgdGFnKHMpIGxlbmd0aFxuICAgICAgICAgICAgICBieXRlMSA9IGRhdGFbb2Zmc2V0KytdICYgMHg3ZjtcbiAgICAgICAgICAgICAgYnl0ZTIgPSBkYXRhW29mZnNldCsrXSAmIDB4N2Y7XG4gICAgICAgICAgICAgIGJ5dGUzID0gZGF0YVtvZmZzZXQrK10gJiAweDdmO1xuICAgICAgICAgICAgICBieXRlNCA9IGRhdGFbb2Zmc2V0KytdICYgMHg3ZjtcbiAgICAgICAgICAgICAgdGFnU2l6ZSA9IChieXRlMSA8PCAyMSkgKyAoYnl0ZTIgPDwgMTQpICsgKGJ5dGUzIDw8IDcpICsgYnl0ZTQ7XG4gICAgICAgICAgICAgIGVuZFBvcyA9IG9mZnNldCArIHRhZ1NpemU7XG4gICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZyhgSUQzIHRhZyBmb3VuZCwgc2l6ZS9lbmQ6ICR7dGFnU2l6ZX0vJHtlbmRQb3N9YCk7XG5cbiAgICAgICAgICAgICAgLy8gcmVhZCBJRDMgdGFnc1xuICAgICAgICAgICAgICB0aGlzLl9wYXJzZUlEM0ZyYW1lcyhkYXRhLCBvZmZzZXQsZW5kUG9zKTtcbiAgICAgICAgICAgICAgb2Zmc2V0ID0gZW5kUG9zO1xuICAgICAgICAgIH0gZWxzZSBpZiAoaGVhZGVyID09PSAnM0RJJykge1xuICAgICAgICAgICAgICAvLyBodHRwOi8vaWQzLm9yZy9pZDN2Mi40LjAtc3RydWN0dXJlIGNoYXB0ZXIgMy40LiAgIElEM3YyIGZvb3RlclxuICAgICAgICAgICAgICBvZmZzZXQgKz0gNztcbiAgICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYDNESSBmb290ZXIgZm91bmQsIGVuZDogJHtvZmZzZXR9YCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgb2Zmc2V0IC09IDM7XG4gICAgICAgICAgICAgIGxlbiA9IG9mZnNldDtcbiAgICAgICAgICAgICAgICAgIGlmIChsZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgICAvL2xvZ2dlci5sb2coYElEMyBsZW46ICR7bGVufWApO1xuICAgICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5oYXNUaW1lU3RhbXApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nZ2VyLndhcm4oJ0lEMyB0YWcgZm91bmQsIGJ1dCBubyB0aW1lc3RhbXAnKTtcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGVuZ3RoID0gbGVuO1xuICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3BheWxvYWQgPSBkYXRhLnN1YmFycmF5KDAsbGVuKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgIH0gd2hpbGUgKHRydWUpO1xuICB9XG5cbiAgcmVhZFVURihkYXRhLHN0YXJ0LGxlbikge1xuXG4gICAgdmFyIHJlc3VsdCA9ICcnLG9mZnNldCA9IHN0YXJ0LCBlbmQgPSBzdGFydCArIGxlbjtcbiAgICBkbyB7XG4gICAgICByZXN1bHQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShkYXRhW29mZnNldCsrXSk7XG4gICAgfSB3aGlsZShvZmZzZXQgPCBlbmQpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBfcGFyc2VJRDNGcmFtZXMoZGF0YSxvZmZzZXQsZW5kUG9zKSB7XG4gICAgdmFyIHRhZ0lkLHRhZ0xlbix0YWdTdGFydCx0YWdGbGFncyx0aW1lc3RhbXA7XG4gICAgd2hpbGUob2Zmc2V0ICsgOCA8PSBlbmRQb3MpIHtcbiAgICAgIHRhZ0lkID0gdGhpcy5yZWFkVVRGKGRhdGEsb2Zmc2V0LDQpO1xuICAgICAgb2Zmc2V0ICs9NDtcblxuICAgICAgdGFnTGVuID0gZGF0YVtvZmZzZXQrK10gPDwgMjQgK1xuICAgICAgICAgICAgICAgIGRhdGFbb2Zmc2V0KytdIDw8IDE2ICtcbiAgICAgICAgICAgICAgICBkYXRhW29mZnNldCsrXSA8PCA4ICtcbiAgICAgICAgICAgICAgICBkYXRhW29mZnNldCsrXTtcblxuICAgICAgdGFnRmxhZ3MgPSBkYXRhW29mZnNldCsrXSA8PCA4ICtcbiAgICAgICAgICAgICAgICAgIGRhdGFbb2Zmc2V0KytdO1xuXG4gICAgICB0YWdTdGFydCA9IG9mZnNldDtcbiAgICAgIC8vbG9nZ2VyLmxvZyhcIklEMyB0YWcgaWQ6XCIgKyB0YWdJZCk7XG4gICAgICBzd2l0Y2godGFnSWQpIHtcbiAgICAgICAgY2FzZSAnUFJJVic6XG4gICAgICAgICAgICAvL2xvZ2dlci5sb2coJ3BhcnNlIGZyYW1lOicgKyBIZXguaGV4RHVtcChkYXRhLnN1YmFycmF5KG9mZnNldCxlbmRQb3MpKSk7XG4gICAgICAgICAgICAvLyBvd25lciBzaG91bGQgYmUgXCJjb20uYXBwbGUuc3RyZWFtaW5nLnRyYW5zcG9ydFN0cmVhbVRpbWVzdGFtcFwiXG4gICAgICAgICAgICBpZiAodGhpcy5yZWFkVVRGKGRhdGEsb2Zmc2V0LDQ0KSA9PT0gJ2NvbS5hcHBsZS5zdHJlYW1pbmcudHJhbnNwb3J0U3RyZWFtVGltZXN0YW1wJykge1xuICAgICAgICAgICAgICAgIG9mZnNldCs9NDQ7XG4gICAgICAgICAgICAgICAgLy8gc21lbGxpbmcgZXZlbiBiZXR0ZXIgISB3ZSBmb3VuZCB0aGUgcmlnaHQgZGVzY3JpcHRvclxuICAgICAgICAgICAgICAgIC8vIHNraXAgbnVsbCBjaGFyYWN0ZXIgKHN0cmluZyBlbmQpICsgMyBmaXJzdCBieXRlc1xuICAgICAgICAgICAgICAgIG9mZnNldCs9IDQ7XG5cbiAgICAgICAgICAgICAgICAvLyB0aW1lc3RhbXAgaXMgMzMgYml0IGV4cHJlc3NlZCBhcyBhIGJpZy1lbmRpYW4gZWlnaHQtb2N0ZXQgbnVtYmVyLCB3aXRoIHRoZSB1cHBlciAzMSBiaXRzIHNldCB0byB6ZXJvLlxuICAgICAgICAgICAgICAgIHZhciBwdHMzM0JpdCAgPSBkYXRhW29mZnNldCsrXSAmIDB4MTtcbiAgICAgICAgICAgICAgICB0aGlzLl9oYXNUaW1lU3RhbXAgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgdGltZXN0YW1wID0gKChkYXRhW29mZnNldCsrXSA8PCAyMykgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoZGF0YVtvZmZzZXQrK10gPDwgMTUpICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKGRhdGFbb2Zmc2V0KytdIDw8ICA3KSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFbb2Zmc2V0KytdKSAvNDU7XG5cbiAgICAgICAgICAgICAgICBpZiAocHRzMzNCaXQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGltZXN0YW1wICAgKz0gNDc3MjE4NTguODQ7IC8vIDJeMzIgLyA5MFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aW1lc3RhbXAgPSBNYXRoLnJvdW5kKHRpbWVzdGFtcCk7XG4gICAgICAgICAgICAgICAgbG9nZ2VyLnRyYWNlKGBJRDMgdGltZXN0YW1wIGZvdW5kOiAke3RpbWVzdGFtcH1gKTtcbiAgICAgICAgICAgICAgICB0aGlzLl90aW1lU3RhbXAgPSB0aW1lc3RhbXA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGdldCBoYXNUaW1lU3RhbXAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2hhc1RpbWVTdGFtcDtcbiAgfVxuXG4gIGdldCB0aW1lU3RhbXAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3RpbWVTdGFtcDtcbiAgfVxuXG4gIGdldCBsZW5ndGgoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2xlbmd0aDtcbiAgfVxuXG4gIGdldCBwYXlsb2FkKCkge1xuICAgIHJldHVybiB0aGlzLl9wYXlsb2FkO1xuICB9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgSUQzO1xuXG4iLCIvKipcbiAqIGhpZ2hseSBvcHRpbWl6ZWQgVFMgZGVtdXhlcjpcbiAqIHBhcnNlIFBBVCwgUE1UXG4gKiBleHRyYWN0IFBFUyBwYWNrZXQgZnJvbSBhdWRpbyBhbmQgdmlkZW8gUElEc1xuICogZXh0cmFjdCBBVkMvSDI2NCBOQUwgdW5pdHMgYW5kIEFBQy9BRFRTIHNhbXBsZXMgZnJvbSBQRVMgcGFja2V0XG4gKiB0cmlnZ2VyIHRoZSByZW11eGVyIHVwb24gcGFyc2luZyBjb21wbGV0aW9uXG4gKiBpdCBhbHNvIHRyaWVzIHRvIHdvcmthcm91bmQgYXMgYmVzdCBhcyBpdCBjYW4gYXVkaW8gY29kZWMgc3dpdGNoIChIRS1BQUMgdG8gQUFDIGFuZCB2aWNlIHZlcnNhKSwgd2l0aG91dCBoYXZpbmcgdG8gcmVzdGFydCB0aGUgTWVkaWFTb3VyY2UuXG4gKiBpdCBhbHNvIGNvbnRyb2xzIHRoZSByZW11eGluZyBwcm9jZXNzIDpcbiAqIHVwb24gZGlzY29udGludWl0eSBvciBsZXZlbCBzd2l0Y2ggZGV0ZWN0aW9uLCBpdCB3aWxsIGFsc28gbm90aWZpZXMgdGhlIHJlbXV4ZXIgc28gdGhhdCBpdCBjYW4gcmVzZXQgaXRzIHN0YXRlLlxuKi9cblxuIGltcG9ydCBBRFRTIGZyb20gJy4vYWR0cyc7XG4gaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG4gaW1wb3J0IEV4cEdvbG9tYiBmcm9tICcuL2V4cC1nb2xvbWInO1xuLy8gaW1wb3J0IEhleCBmcm9tICcuLi91dGlscy9oZXgnO1xuIGltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuIGltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuXG4gY2xhc3MgVFNEZW11eGVyIHtcblxuICBjb25zdHJ1Y3RvcihvYnNlcnZlcixyZW11eGVyQ2xhc3MpIHtcbiAgICB0aGlzLm9ic2VydmVyID0gb2JzZXJ2ZXI7XG4gICAgdGhpcy5yZW11eGVyQ2xhc3MgPSByZW11eGVyQ2xhc3M7XG4gICAgdGhpcy5sYXN0Q0MgPSAwO1xuICAgIHRoaXMucmVtdXhlciA9IG5ldyB0aGlzLnJlbXV4ZXJDbGFzcyhvYnNlcnZlcik7XG4gICAgdGhpcy5fdXNlckRhdGEgPSBbXTtcbiAgfVxuXG4gIHN0YXRpYyBwcm9iZShkYXRhKSB7XG4gICAgLy8gYSBUUyBmcmFnbWVudCBzaG91bGQgY29udGFpbiBhdCBsZWFzdCAzIFRTIHBhY2tldHMsIGEgUEFULCBhIFBNVCwgYW5kIG9uZSBQSUQsIGVhY2ggc3RhcnRpbmcgd2l0aCAweDQ3XG4gICAgaWYgKGRhdGEubGVuZ3RoID49IDMqMTg4ICYmIGRhdGFbMF0gPT09IDB4NDcgJiYgZGF0YVsxODhdID09PSAweDQ3ICYmIGRhdGFbMioxODhdID09PSAweDQ3KSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIHN3aXRjaExldmVsKCkge1xuICAgIHRoaXMucG10UGFyc2VkID0gZmFsc2U7XG4gICAgdGhpcy5fcG10SWQgPSAtMTtcbiAgICB0aGlzLmxhc3RBYWNQVFMgPSBudWxsO1xuICAgIHRoaXMuYWFjT3ZlckZsb3cgPSBudWxsO1xuICAgIHRoaXMuX2F2Y1RyYWNrID0ge3R5cGU6ICd2aWRlbycsIGlkIDotMSwgc2VxdWVuY2VOdW1iZXI6IDAsIHNhbXBsZXMgOiBbXSwgbGVuIDogMCwgbmJOYWx1IDogMH07XG4gICAgdGhpcy5fYWFjVHJhY2sgPSB7dHlwZTogJ2F1ZGlvJywgaWQgOi0xLCBzZXF1ZW5jZU51bWJlcjogMCwgc2FtcGxlcyA6IFtdLCBsZW4gOiAwfTtcbiAgICB0aGlzLl9pZDNUcmFjayA9IHt0eXBlOiAnaWQzJywgaWQgOi0xLCBzZXF1ZW5jZU51bWJlcjogMCwgc2FtcGxlcyA6IFtdLCBsZW4gOiAwfTtcbiAgICB0aGlzLl90eHRUcmFjayA9IHt0eXBlOiAndGV4dCcsIGlkOiAtMSwgc2VxdWVuY2VOdW1iZXI6IDAsIHNhbXBsZXM6IFtdLCBsZW46IDB9O1xuICAgIHRoaXMucmVtdXhlci5zd2l0Y2hMZXZlbCgpO1xuICB9XG5cbiAgaW5zZXJ0RGlzY29udGludWl0eSgpIHtcbiAgICB0aGlzLnN3aXRjaExldmVsKCk7XG4gICAgdGhpcy5yZW11eGVyLmluc2VydERpc2NvbnRpbnVpdHkoKTtcbiAgfVxuXG4gIC8vIGZlZWQgaW5jb21pbmcgZGF0YSB0byB0aGUgZnJvbnQgb2YgdGhlIHBhcnNpbmcgcGlwZWxpbmVcbiAgcHVzaChkYXRhLCBhdWRpb0NvZGVjLCB2aWRlb0NvZGVjLCB0aW1lT2Zmc2V0LCBjYywgbGV2ZWwsIHNuLCBkdXJhdGlvbikge1xuICAgIHZhciBhdmNEYXRhLCBhYWNEYXRhLCBpZDNEYXRhLFxuICAgICAgICBzdGFydCwgbGVuID0gZGF0YS5sZW5ndGgsIHN0dCwgcGlkLCBhdGYsIG9mZnNldDtcbiAgICB0aGlzLmF1ZGlvQ29kZWMgPSBhdWRpb0NvZGVjO1xuICAgIHRoaXMudmlkZW9Db2RlYyA9IHZpZGVvQ29kZWM7XG4gICAgdGhpcy50aW1lT2Zmc2V0ID0gdGltZU9mZnNldDtcbiAgICB0aGlzLl9kdXJhdGlvbiA9IGR1cmF0aW9uO1xuICAgIHRoaXMuY29udGlndW91cyA9IGZhbHNlO1xuICAgIGlmIChjYyAhPT0gdGhpcy5sYXN0Q0MpIHtcbiAgICAgIGxvZ2dlci5sb2coJ2Rpc2NvbnRpbnVpdHkgZGV0ZWN0ZWQnKTtcbiAgICAgIHRoaXMuaW5zZXJ0RGlzY29udGludWl0eSgpO1xuICAgICAgdGhpcy5sYXN0Q0MgPSBjYztcbiAgICB9IGVsc2UgaWYgKGxldmVsICE9PSB0aGlzLmxhc3RMZXZlbCkge1xuICAgICAgbG9nZ2VyLmxvZygnbGV2ZWwgc3dpdGNoIGRldGVjdGVkJyk7XG4gICAgICB0aGlzLnN3aXRjaExldmVsKCk7XG4gICAgICB0aGlzLmxhc3RMZXZlbCA9IGxldmVsO1xuICAgIH0gZWxzZSBpZiAoc24gPT09ICh0aGlzLmxhc3RTTisxKSkge1xuICAgICAgdGhpcy5jb250aWd1b3VzID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5sYXN0U04gPSBzbjtcblxuICAgIGlmKCF0aGlzLmNvbnRpZ3VvdXMpIHtcbiAgICAgIC8vIGZsdXNoIGFueSBwYXJ0aWFsIGNvbnRlbnRcbiAgICAgIHRoaXMuYWFjT3ZlckZsb3cgPSBudWxsO1xuICAgIH1cblxuICAgIHZhciBwbXRQYXJzZWQgPSB0aGlzLnBtdFBhcnNlZCxcbiAgICAgICAgYXZjSWQgPSB0aGlzLl9hdmNUcmFjay5pZCxcbiAgICAgICAgYWFjSWQgPSB0aGlzLl9hYWNUcmFjay5pZCxcbiAgICAgICAgaWQzSWQgPSB0aGlzLl9pZDNUcmFjay5pZDtcbiAgICAvLyBsb29wIHRocm91Z2ggVFMgcGFja2V0c1xuICAgIGZvciAoc3RhcnQgPSAwOyBzdGFydCA8IGxlbjsgc3RhcnQgKz0gMTg4KSB7XG4gICAgICBpZiAoZGF0YVtzdGFydF0gPT09IDB4NDcpIHtcbiAgICAgICAgc3R0ID0gISEoZGF0YVtzdGFydCArIDFdICYgMHg0MCk7XG4gICAgICAgIC8vIHBpZCBpcyBhIDEzLWJpdCBmaWVsZCBzdGFydGluZyBhdCB0aGUgbGFzdCBiaXQgb2YgVFNbMV1cbiAgICAgICAgcGlkID0gKChkYXRhW3N0YXJ0ICsgMV0gJiAweDFmKSA8PCA4KSArIGRhdGFbc3RhcnQgKyAyXTtcbiAgICAgICAgYXRmID0gKGRhdGFbc3RhcnQgKyAzXSAmIDB4MzApID4+IDQ7XG4gICAgICAgIC8vIGlmIGFuIGFkYXB0aW9uIGZpZWxkIGlzIHByZXNlbnQsIGl0cyBsZW5ndGggaXMgc3BlY2lmaWVkIGJ5IHRoZSBmaWZ0aCBieXRlIG9mIHRoZSBUUyBwYWNrZXQgaGVhZGVyLlxuICAgICAgICBpZiAoYXRmID4gMSkge1xuICAgICAgICAgIG9mZnNldCA9IHN0YXJ0ICsgNSArIGRhdGFbc3RhcnQgKyA0XTtcbiAgICAgICAgICAvLyBjb250aW51ZSBpZiB0aGVyZSBpcyBvbmx5IGFkYXB0YXRpb24gZmllbGRcbiAgICAgICAgICBpZiAob2Zmc2V0ID09PSAoc3RhcnQgKyAxODgpKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgb2Zmc2V0ID0gc3RhcnQgKyA0O1xuICAgICAgICB9XG4gICAgICAgIGlmIChwbXRQYXJzZWQpIHtcbiAgICAgICAgICBpZiAocGlkID09PSBhdmNJZCkge1xuICAgICAgICAgICAgaWYgKHN0dCkge1xuICAgICAgICAgICAgICBpZiAoYXZjRGF0YSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3BhcnNlQVZDUEVTKHRoaXMuX3BhcnNlUEVTKGF2Y0RhdGEpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBhdmNEYXRhID0ge2RhdGE6IFtdLCBzaXplOiAwfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChhdmNEYXRhKSB7XG4gICAgICAgICAgICAgIGF2Y0RhdGEuZGF0YS5wdXNoKGRhdGEuc3ViYXJyYXkob2Zmc2V0LCBzdGFydCArIDE4OCkpO1xuICAgICAgICAgICAgICBhdmNEYXRhLnNpemUgKz0gc3RhcnQgKyAxODggLSBvZmZzZXQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGlmIChwaWQgPT09IGFhY0lkKSB7XG4gICAgICAgICAgICBpZiAoc3R0KSB7XG4gICAgICAgICAgICAgIGlmIChhYWNEYXRhKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcGFyc2VBQUNQRVModGhpcy5fcGFyc2VQRVMoYWFjRGF0YSkpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGFhY0RhdGEgPSB7ZGF0YTogW10sIHNpemU6IDB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGFhY0RhdGEpIHtcbiAgICAgICAgICAgICAgYWFjRGF0YS5kYXRhLnB1c2goZGF0YS5zdWJhcnJheShvZmZzZXQsIHN0YXJ0ICsgMTg4KSk7XG4gICAgICAgICAgICAgIGFhY0RhdGEuc2l6ZSArPSBzdGFydCArIDE4OCAtIG9mZnNldDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgaWYgKHBpZCA9PT0gaWQzSWQpIHtcbiAgICAgICAgICAgIGlmIChzdHQpIHtcbiAgICAgICAgICAgICAgaWYgKGlkM0RhdGEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9wYXJzZUlEM1BFUyh0aGlzLl9wYXJzZVBFUyhpZDNEYXRhKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWQzRGF0YSA9IHtkYXRhOiBbXSwgc2l6ZTogMH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoaWQzRGF0YSkge1xuICAgICAgICAgICAgICBpZDNEYXRhLmRhdGEucHVzaChkYXRhLnN1YmFycmF5KG9mZnNldCwgc3RhcnQgKyAxODgpKTtcbiAgICAgICAgICAgICAgaWQzRGF0YS5zaXplICs9IHN0YXJ0ICsgMTg4IC0gb2Zmc2V0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpZiAoc3R0KSB7XG4gICAgICAgICAgICBvZmZzZXQgKz0gZGF0YVtvZmZzZXRdICsgMTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHBpZCA9PT0gMCkge1xuICAgICAgICAgICAgdGhpcy5fcGFyc2VQQVQoZGF0YSwgb2Zmc2V0KTtcbiAgICAgICAgICB9IGVsc2UgaWYgKHBpZCA9PT0gdGhpcy5fcG10SWQpIHtcbiAgICAgICAgICAgIHRoaXMuX3BhcnNlUE1UKGRhdGEsIG9mZnNldCk7XG4gICAgICAgICAgICBwbXRQYXJzZWQgPSB0aGlzLnBtdFBhcnNlZCA9IHRydWU7XG4gICAgICAgICAgICBhdmNJZCA9IHRoaXMuX2F2Y1RyYWNrLmlkO1xuICAgICAgICAgICAgYWFjSWQgPSB0aGlzLl9hYWNUcmFjay5pZDtcbiAgICAgICAgICAgIGlkM0lkID0gdGhpcy5faWQzVHJhY2suaWQ7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLm9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlIDogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkZSQUdfUEFSU0lOR19FUlJPUiwgZmF0YWw6IGZhbHNlLCByZWFzb246ICdUUyBwYWNrZXQgZGlkIG5vdCBzdGFydCB3aXRoIDB4NDcnfSk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIHBhcnNlIGxhc3QgUEVTIHBhY2tldFxuICAgIGlmIChhdmNEYXRhKSB7XG4gICAgICB0aGlzLl9wYXJzZUFWQ1BFUyh0aGlzLl9wYXJzZVBFUyhhdmNEYXRhKSk7XG4gICAgfVxuICAgIGlmIChhYWNEYXRhKSB7XG4gICAgICB0aGlzLl9wYXJzZUFBQ1BFUyh0aGlzLl9wYXJzZVBFUyhhYWNEYXRhKSk7XG4gICAgfVxuICAgIGlmIChpZDNEYXRhKSB7XG4gICAgICB0aGlzLl9wYXJzZUlEM1BFUyh0aGlzLl9wYXJzZVBFUyhpZDNEYXRhKSk7XG4gICAgfVxuICAgIHRoaXMucmVtdXgoKTtcbiAgfVxuXG4gIHJlbXV4KCkge1xuICAgIHRoaXMucmVtdXhlci5yZW11eCh0aGlzLl9hYWNUcmFjaywgdGhpcy5fYXZjVHJhY2ssIHRoaXMuX2lkM1RyYWNrLCB0aGlzLl90eHRUcmFjaywgdGhpcy50aW1lT2Zmc2V0LCB0aGlzLmNvbnRpZ3VvdXMpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLnN3aXRjaExldmVsKCk7XG4gICAgdGhpcy5faW5pdFBUUyA9IHRoaXMuX2luaXREVFMgPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5fZHVyYXRpb24gPSAwO1xuICB9XG5cbiAgX3BhcnNlUEFUKGRhdGEsIG9mZnNldCkge1xuICAgIC8vIHNraXAgdGhlIFBTSSBoZWFkZXIgYW5kIHBhcnNlIHRoZSBmaXJzdCBQTVQgZW50cnlcbiAgICB0aGlzLl9wbXRJZCAgPSAoZGF0YVtvZmZzZXQgKyAxMF0gJiAweDFGKSA8PCA4IHwgZGF0YVtvZmZzZXQgKyAxMV07XG4gICAgLy9sb2dnZXIubG9nKCdQTVQgUElEOicgICsgdGhpcy5fcG10SWQpO1xuICB9XG5cbiAgX3BhcnNlUE1UKGRhdGEsIG9mZnNldCkge1xuICAgIHZhciBzZWN0aW9uTGVuZ3RoLCB0YWJsZUVuZCwgcHJvZ3JhbUluZm9MZW5ndGgsIHBpZDtcbiAgICBzZWN0aW9uTGVuZ3RoID0gKGRhdGFbb2Zmc2V0ICsgMV0gJiAweDBmKSA8PCA4IHwgZGF0YVtvZmZzZXQgKyAyXTtcbiAgICB0YWJsZUVuZCA9IG9mZnNldCArIDMgKyBzZWN0aW9uTGVuZ3RoIC0gNDtcbiAgICAvLyB0byBkZXRlcm1pbmUgd2hlcmUgdGhlIHRhYmxlIGlzLCB3ZSBoYXZlIHRvIGZpZ3VyZSBvdXQgaG93XG4gICAgLy8gbG9uZyB0aGUgcHJvZ3JhbSBpbmZvIGRlc2NyaXB0b3JzIGFyZVxuICAgIHByb2dyYW1JbmZvTGVuZ3RoID0gKGRhdGFbb2Zmc2V0ICsgMTBdICYgMHgwZikgPDwgOCB8IGRhdGFbb2Zmc2V0ICsgMTFdO1xuICAgIC8vIGFkdmFuY2UgdGhlIG9mZnNldCB0byB0aGUgZmlyc3QgZW50cnkgaW4gdGhlIG1hcHBpbmcgdGFibGVcbiAgICBvZmZzZXQgKz0gMTIgKyBwcm9ncmFtSW5mb0xlbmd0aDtcbiAgICB3aGlsZSAob2Zmc2V0IDwgdGFibGVFbmQpIHtcbiAgICAgIHBpZCA9IChkYXRhW29mZnNldCArIDFdICYgMHgxRikgPDwgOCB8IGRhdGFbb2Zmc2V0ICsgMl07XG4gICAgICBzd2l0Y2goZGF0YVtvZmZzZXRdKSB7XG4gICAgICAgIC8vIElTTy9JRUMgMTM4MTgtNyBBRFRTIEFBQyAoTVBFRy0yIGxvd2VyIGJpdC1yYXRlIGF1ZGlvKVxuICAgICAgICBjYXNlIDB4MGY6XG4gICAgICAgICAgLy9sb2dnZXIubG9nKCdBQUMgUElEOicgICsgcGlkKTtcbiAgICAgICAgICB0aGlzLl9hYWNUcmFjay5pZCA9IHBpZDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgLy8gUGFja2V0aXplZCBtZXRhZGF0YSAoSUQzKVxuICAgICAgICBjYXNlIDB4MTU6XG4gICAgICAgICAgLy9sb2dnZXIubG9nKCdJRDMgUElEOicgICsgcGlkKTtcbiAgICAgICAgICB0aGlzLl9pZDNUcmFjay5pZCA9IHBpZDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgLy8gSVRVLVQgUmVjLiBILjI2NCBhbmQgSVNPL0lFQyAxNDQ5Ni0xMCAobG93ZXIgYml0LXJhdGUgdmlkZW8pXG4gICAgICAgIGNhc2UgMHgxYjpcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ0FWQyBQSUQ6JyAgKyBwaWQpO1xuICAgICAgICAgIHRoaXMuX2F2Y1RyYWNrLmlkID0gcGlkO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICBsb2dnZXIubG9nKCd1bmtvd24gc3RyZWFtIHR5cGU6JyAgKyBkYXRhW29mZnNldF0pO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIC8vIG1vdmUgdG8gdGhlIG5leHQgdGFibGUgZW50cnlcbiAgICAgIC8vIHNraXAgcGFzdCB0aGUgZWxlbWVudGFyeSBzdHJlYW0gZGVzY3JpcHRvcnMsIGlmIHByZXNlbnRcbiAgICAgIG9mZnNldCArPSAoKGRhdGFbb2Zmc2V0ICsgM10gJiAweDBGKSA8PCA4IHwgZGF0YVtvZmZzZXQgKyA0XSkgKyA1O1xuICAgIH1cbiAgfVxuXG4gIF9wYXJzZVBFUyhzdHJlYW0pIHtcbiAgICB2YXIgaSA9IDAsIGZyYWcsIHBlc0ZsYWdzLCBwZXNQcmVmaXgsIHBlc0xlbiwgcGVzSGRyTGVuLCBwZXNEYXRhLCBwZXNQdHMsIHBlc0R0cywgcGF5bG9hZFN0YXJ0T2Zmc2V0O1xuICAgIC8vcmV0cmlldmUgUFRTL0RUUyBmcm9tIGZpcnN0IGZyYWdtZW50XG4gICAgZnJhZyA9IHN0cmVhbS5kYXRhWzBdO1xuICAgIHBlc1ByZWZpeCA9IChmcmFnWzBdIDw8IDE2KSArIChmcmFnWzFdIDw8IDgpICsgZnJhZ1syXTtcbiAgICBpZiAocGVzUHJlZml4ID09PSAxKSB7XG4gICAgICBwZXNMZW4gPSAoZnJhZ1s0XSA8PCA4KSArIGZyYWdbNV07XG4gICAgICBwZXNGbGFncyA9IGZyYWdbN107XG4gICAgICBpZiAocGVzRmxhZ3MgJiAweEMwKSB7XG4gICAgICAgIC8qIFBFUyBoZWFkZXIgZGVzY3JpYmVkIGhlcmUgOiBodHRwOi8vZHZkLnNvdXJjZWZvcmdlLm5ldC9kdmRpbmZvL3Blcy1oZHIuaHRtbFxuICAgICAgICAgICAgYXMgUFRTIC8gRFRTIGlzIDMzIGJpdCB3ZSBjYW5ub3QgdXNlIGJpdHdpc2Ugb3BlcmF0b3IgaW4gSlMsXG4gICAgICAgICAgICBhcyBCaXR3aXNlIG9wZXJhdG9ycyB0cmVhdCB0aGVpciBvcGVyYW5kcyBhcyBhIHNlcXVlbmNlIG9mIDMyIGJpdHMgKi9cbiAgICAgICAgcGVzUHRzID0gKGZyYWdbOV0gJiAweDBFKSAqIDUzNjg3MDkxMiArLy8gMSA8PCAyOVxuICAgICAgICAgIChmcmFnWzEwXSAmIDB4RkYpICogNDE5NDMwNCArLy8gMSA8PCAyMlxuICAgICAgICAgIChmcmFnWzExXSAmIDB4RkUpICogMTYzODQgKy8vIDEgPDwgMTRcbiAgICAgICAgICAoZnJhZ1sxMl0gJiAweEZGKSAqIDEyOCArLy8gMSA8PCA3XG4gICAgICAgICAgKGZyYWdbMTNdICYgMHhGRSkgLyAyO1xuICAgICAgICAgIC8vIGNoZWNrIGlmIGdyZWF0ZXIgdGhhbiAyXjMyIC0xXG4gICAgICAgICAgaWYgKHBlc1B0cyA+IDQyOTQ5NjcyOTUpIHtcbiAgICAgICAgICAgIC8vIGRlY3JlbWVudCAyXjMzXG4gICAgICAgICAgICBwZXNQdHMgLT0gODU4OTkzNDU5MjtcbiAgICAgICAgICB9XG4gICAgICAgIGlmIChwZXNGbGFncyAmIDB4NDApIHtcbiAgICAgICAgICBwZXNEdHMgPSAoZnJhZ1sxNF0gJiAweDBFICkgKiA1MzY4NzA5MTIgKy8vIDEgPDwgMjlcbiAgICAgICAgICAgIChmcmFnWzE1XSAmIDB4RkYgKSAqIDQxOTQzMDQgKy8vIDEgPDwgMjJcbiAgICAgICAgICAgIChmcmFnWzE2XSAmIDB4RkUgKSAqIDE2Mzg0ICsvLyAxIDw8IDE0XG4gICAgICAgICAgICAoZnJhZ1sxN10gJiAweEZGICkgKiAxMjggKy8vIDEgPDwgN1xuICAgICAgICAgICAgKGZyYWdbMThdICYgMHhGRSApIC8gMjtcbiAgICAgICAgICAvLyBjaGVjayBpZiBncmVhdGVyIHRoYW4gMl4zMiAtMVxuICAgICAgICAgIGlmIChwZXNEdHMgPiA0Mjk0OTY3Mjk1KSB7XG4gICAgICAgICAgICAvLyBkZWNyZW1lbnQgMl4zM1xuICAgICAgICAgICAgcGVzRHRzIC09IDg1ODk5MzQ1OTI7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlc0R0cyA9IHBlc1B0cztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcGVzSGRyTGVuID0gZnJhZ1s4XTtcbiAgICAgIHBheWxvYWRTdGFydE9mZnNldCA9IHBlc0hkckxlbiArIDk7XG4gICAgICAvLyB0cmltIFBFUyBoZWFkZXJcbiAgICAgIHN0cmVhbS5kYXRhWzBdID0gc3RyZWFtLmRhdGFbMF0uc3ViYXJyYXkocGF5bG9hZFN0YXJ0T2Zmc2V0KTtcbiAgICAgIHN0cmVhbS5zaXplIC09IHBheWxvYWRTdGFydE9mZnNldDtcbiAgICAgIC8vcmVhc3NlbWJsZSBQRVMgcGFja2V0XG4gICAgICBwZXNEYXRhID0gbmV3IFVpbnQ4QXJyYXkoc3RyZWFtLnNpemUpO1xuICAgICAgLy8gcmVhc3NlbWJsZSB0aGUgcGFja2V0XG4gICAgICB3aGlsZSAoc3RyZWFtLmRhdGEubGVuZ3RoKSB7XG4gICAgICAgIGZyYWcgPSBzdHJlYW0uZGF0YS5zaGlmdCgpO1xuICAgICAgICBwZXNEYXRhLnNldChmcmFnLCBpKTtcbiAgICAgICAgaSArPSBmcmFnLmJ5dGVMZW5ndGg7XG4gICAgICB9XG4gICAgICByZXR1cm4ge2RhdGE6IHBlc0RhdGEsIHB0czogcGVzUHRzLCBkdHM6IHBlc0R0cywgbGVuOiBwZXNMZW59O1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBfcGFyc2VBVkNQRVMocGVzKSB7XG4gICAgdmFyIHRyYWNrID0gdGhpcy5fYXZjVHJhY2ssXG4gICAgICAgIHNhbXBsZXMgPSB0cmFjay5zYW1wbGVzLFxuICAgICAgICB1bml0cyA9IHRoaXMuX3BhcnNlQVZDTkFMdShwZXMuZGF0YSksXG4gICAgICAgIHVuaXRzMiA9IFtdLFxuICAgICAgICBkZWJ1ZyA9IGZhbHNlLFxuICAgICAgICBrZXkgPSBmYWxzZSxcbiAgICAgICAgbGVuZ3RoID0gMCxcbiAgICAgICAgZXhwR29sb21iRGVjb2RlcixcbiAgICAgICAgYXZjU2FtcGxlLFxuICAgICAgICBwdXNoLFxuICAgICAgICBpO1xuICAgIC8vIG5vIE5BTHUgZm91bmRcbiAgICBpZiAodW5pdHMubGVuZ3RoID09PSAwICYmIHNhbXBsZXMubGVuZ3RoID4gMCkge1xuICAgICAgLy8gYXBwZW5kIHBlcy5kYXRhIHRvIHByZXZpb3VzIE5BTCB1bml0XG4gICAgICB2YXIgbGFzdGF2Y1NhbXBsZSA9IHNhbXBsZXNbc2FtcGxlcy5sZW5ndGggLSAxXTtcbiAgICAgIHZhciBsYXN0VW5pdCA9IGxhc3RhdmNTYW1wbGUudW5pdHMudW5pdHNbbGFzdGF2Y1NhbXBsZS51bml0cy51bml0cy5sZW5ndGggLSAxXTtcbiAgICAgIHZhciB0bXAgPSBuZXcgVWludDhBcnJheShsYXN0VW5pdC5kYXRhLmJ5dGVMZW5ndGggKyBwZXMuZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICAgIHRtcC5zZXQobGFzdFVuaXQuZGF0YSwgMCk7XG4gICAgICB0bXAuc2V0KHBlcy5kYXRhLCBsYXN0VW5pdC5kYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgbGFzdFVuaXQuZGF0YSA9IHRtcDtcbiAgICAgIGxhc3RhdmNTYW1wbGUudW5pdHMubGVuZ3RoICs9IHBlcy5kYXRhLmJ5dGVMZW5ndGg7XG4gICAgICB0cmFjay5sZW4gKz0gcGVzLmRhdGEuYnl0ZUxlbmd0aDtcbiAgICB9XG4gICAgLy9mcmVlIHBlcy5kYXRhIHRvIHNhdmUgdXAgc29tZSBtZW1vcnlcbiAgICBwZXMuZGF0YSA9IG51bGw7XG4gICAgdmFyIGRlYnVnU3RyaW5nID0gJyc7XG5cbiAgICB1bml0cy5mb3JFYWNoKHVuaXQgPT4ge1xuICAgICAgc3dpdGNoKHVuaXQudHlwZSkge1xuICAgICAgICAvL05EUlxuICAgICAgICAgY2FzZSAxOlxuICAgICAgICAgICBwdXNoID0gdHJ1ZTtcbiAgICAgICAgICAgaWYoZGVidWcpIHtcbiAgICAgICAgICAgIGRlYnVnU3RyaW5nICs9ICdORFIgJztcbiAgICAgICAgICAgfVxuICAgICAgICAgICBicmVhaztcbiAgICAgICAgLy9JRFJcbiAgICAgICAgY2FzZSA1OlxuICAgICAgICAgIHB1c2ggPSB0cnVlO1xuICAgICAgICAgIGlmKGRlYnVnKSB7XG4gICAgICAgICAgICBkZWJ1Z1N0cmluZyArPSAnSURSICc7XG4gICAgICAgICAgfVxuICAgICAgICAgIGtleSA9IHRydWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIC8vU0VJXG4gICAgICAgIGNhc2UgNjpcbiAgICAgICAgICBwdXNoID0gdHJ1ZTtcbiAgICAgICAgICBpZihkZWJ1Zykge1xuICAgICAgICAgICAgZGVidWdTdHJpbmcgKz0gJ1NFSSAnO1xuICAgICAgICAgIH1cbiAgICAgICAgICBleHBHb2xvbWJEZWNvZGVyID0gbmV3IEV4cEdvbG9tYih1bml0LmRhdGEpO1xuXG4gICAgICAgICAgLy8gc2tpcCBmcmFtZVR5cGVcbiAgICAgICAgICBleHBHb2xvbWJEZWNvZGVyLnJlYWRVQnl0ZSgpO1xuXG4gICAgICAgICAgdmFyIHBheWxvYWRUeXBlID0gZXhwR29sb21iRGVjb2Rlci5yZWFkVUJ5dGUoKTtcblxuICAgICAgICAgIC8vIFRPRE86IHRoZXJlIGNhbiBiZSBtb3JlIHRoYW4gb25lIHBheWxvYWQgaW4gYW4gU0VJIHBhY2tldC4uLlxuICAgICAgICAgIC8vIFRPRE86IG5lZWQgdG8gcmVhZCB0eXBlIGFuZCBzaXplIGluIGEgd2hpbGUgbG9vcCB0byBnZXQgdGhlbSBhbGxcbiAgICAgICAgICBpZiAocGF5bG9hZFR5cGUgPT09IDQpXG4gICAgICAgICAge1xuICAgICAgICAgICAgdmFyIHBheWxvYWRTaXplID0gMDtcblxuICAgICAgICAgICAgZG8ge1xuICAgICAgICAgICAgICBwYXlsb2FkU2l6ZSA9IGV4cEdvbG9tYkRlY29kZXIucmVhZFVCeXRlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB3aGlsZSAocGF5bG9hZFNpemUgPT09IDI1NSk7XG5cbiAgICAgICAgICAgIHZhciBjb3VudHJ5Q29kZSA9IGV4cEdvbG9tYkRlY29kZXIucmVhZFVCeXRlKCk7XG5cbiAgICAgICAgICAgIGlmIChjb3VudHJ5Q29kZSA9PT0gMTgxKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICB2YXIgcHJvdmlkZXJDb2RlID0gZXhwR29sb21iRGVjb2Rlci5yZWFkVVNob3J0KCk7XG5cbiAgICAgICAgICAgICAgaWYgKHByb3ZpZGVyQ29kZSA9PT0gNDkpXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB2YXIgdXNlclN0cnVjdHVyZSA9IGV4cEdvbG9tYkRlY29kZXIucmVhZFVJbnQoKTtcblxuICAgICAgICAgICAgICAgIGlmICh1c2VyU3RydWN0dXJlID09PSAweDQ3NDEzOTM0KVxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIHZhciB1c2VyRGF0YVR5cGUgPSBleHBHb2xvbWJEZWNvZGVyLnJlYWRVQnl0ZSgpO1xuXG4gICAgICAgICAgICAgICAgICAvLyBSYXcgQ0VBLTYwOCBieXRlcyB3cmFwcGVkIGluIENFQS03MDggcGFja2V0XG4gICAgICAgICAgICAgICAgICBpZiAodXNlckRhdGFUeXBlID09PSAzKVxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZmlyc3RCeXRlID0gZXhwR29sb21iRGVjb2Rlci5yZWFkVUJ5dGUoKTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHNlY29uZEJ5dGUgPSBleHBHb2xvbWJEZWNvZGVyLnJlYWRVQnl0ZSgpO1xuXG4gICAgICAgICAgICAgICAgICAgIHZhciB0b3RhbENDcyA9IDMxICYgZmlyc3RCeXRlO1xuICAgICAgICAgICAgICAgICAgICB2YXIgYnl0ZUFycmF5ID0gW2ZpcnN0Qnl0ZSwgc2Vjb25kQnl0ZV07XG5cbiAgICAgICAgICAgICAgICAgICAgZm9yIChpPTA7IGk8dG90YWxDQ3M7IGkrKylcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgIC8vIDMgYnl0ZXMgcGVyIENDXG4gICAgICAgICAgICAgICAgICAgICAgYnl0ZUFycmF5LnB1c2goZXhwR29sb21iRGVjb2Rlci5yZWFkVUJ5dGUoKSk7XG4gICAgICAgICAgICAgICAgICAgICAgYnl0ZUFycmF5LnB1c2goZXhwR29sb21iRGVjb2Rlci5yZWFkVUJ5dGUoKSk7XG4gICAgICAgICAgICAgICAgICAgICAgYnl0ZUFycmF5LnB1c2goZXhwR29sb21iRGVjb2Rlci5yZWFkVUJ5dGUoKSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICB0aGlzLl90eHRUcmFjay5zYW1wbGVzLnB1c2goe3R5cGU6IDMsIHB0czogcGVzLnB0cywgYnl0ZXM6IGJ5dGVBcnJheX0pO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgLy9TUFNcbiAgICAgICAgY2FzZSA3OlxuICAgICAgICAgIHB1c2ggPSB0cnVlO1xuICAgICAgICAgIGlmKGRlYnVnKSB7XG4gICAgICAgICAgICBkZWJ1Z1N0cmluZyArPSAnU1BTICc7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmKCF0cmFjay5zcHMpIHtcbiAgICAgICAgICAgIGV4cEdvbG9tYkRlY29kZXIgPSBuZXcgRXhwR29sb21iKHVuaXQuZGF0YSk7XG4gICAgICAgICAgICB2YXIgY29uZmlnID0gZXhwR29sb21iRGVjb2Rlci5yZWFkU1BTKCk7XG4gICAgICAgICAgICB0cmFjay53aWR0aCA9IGNvbmZpZy53aWR0aDtcbiAgICAgICAgICAgIHRyYWNrLmhlaWdodCA9IGNvbmZpZy5oZWlnaHQ7XG4gICAgICAgICAgICB0cmFjay5zcHMgPSBbdW5pdC5kYXRhXTtcbiAgICAgICAgICAgIHRyYWNrLnRpbWVzY2FsZSA9IHRoaXMucmVtdXhlci50aW1lc2NhbGU7XG4gICAgICAgICAgICB0cmFjay5kdXJhdGlvbiA9IHRoaXMucmVtdXhlci50aW1lc2NhbGUgKiB0aGlzLl9kdXJhdGlvbjtcbiAgICAgICAgICAgIHZhciBjb2RlY2FycmF5ID0gdW5pdC5kYXRhLnN1YmFycmF5KDEsIDQpO1xuICAgICAgICAgICAgdmFyIGNvZGVjc3RyaW5nID0gJ2F2YzEuJztcbiAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCAzOyBpKyspIHtcbiAgICAgICAgICAgICAgdmFyIGggPSBjb2RlY2FycmF5W2ldLnRvU3RyaW5nKDE2KTtcbiAgICAgICAgICAgICAgaWYgKGgubGVuZ3RoIDwgMikge1xuICAgICAgICAgICAgICAgIGggPSAnMCcgKyBoO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGNvZGVjc3RyaW5nICs9IGg7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0cmFjay5jb2RlYyA9IGNvZGVjc3RyaW5nO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgLy9QUFNcbiAgICAgICAgY2FzZSA4OlxuICAgICAgICAgIHB1c2ggPSB0cnVlO1xuICAgICAgICAgIGlmKGRlYnVnKSB7XG4gICAgICAgICAgICBkZWJ1Z1N0cmluZyArPSAnUFBTICc7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICghdHJhY2sucHBzKSB7XG4gICAgICAgICAgICB0cmFjay5wcHMgPSBbdW5pdC5kYXRhXTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgOTpcbiAgICAgICAgICBwdXNoID0gdHJ1ZTtcbiAgICAgICAgICBpZihkZWJ1Zykge1xuICAgICAgICAgICAgZGVidWdTdHJpbmcgKz0gJ0FVRCAnO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBwdXNoID0gZmFsc2U7XG4gICAgICAgICAgZGVidWdTdHJpbmcgKz0gJ3Vua25vd24gTkFMICcgKyB1bml0LnR5cGUgKyAnICc7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBpZihwdXNoKSB7XG4gICAgICAgIHVuaXRzMi5wdXNoKHVuaXQpO1xuICAgICAgICBsZW5ndGgrPXVuaXQuZGF0YS5ieXRlTGVuZ3RoO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGlmKGRlYnVnIHx8IGRlYnVnU3RyaW5nLmxlbmd0aCkge1xuICAgICAgbG9nZ2VyLmxvZyhkZWJ1Z1N0cmluZyk7XG4gICAgfVxuICAgIC8vYnVpbGQgc2FtcGxlIGZyb20gUEVTXG4gICAgLy8gQW5uZXggQiB0byBNUDQgY29udmVyc2lvbiB0byBiZSBkb25lXG4gICAgaWYgKHVuaXRzMi5sZW5ndGgpIHtcbiAgICAgIC8vIG9ubHkgcHVzaCBBVkMgc2FtcGxlIGlmIGtleWZyYW1lIGFscmVhZHkgZm91bmQuIGJyb3dzZXJzIGV4cGVjdCBhIGtleWZyYW1lIGF0IGZpcnN0IHRvIHN0YXJ0IGRlY29kaW5nXG4gICAgICBpZiAoa2V5ID09PSB0cnVlIHx8IHRyYWNrLnNwcyApIHtcbiAgICAgICAgYXZjU2FtcGxlID0ge3VuaXRzOiB7IHVuaXRzIDogdW5pdHMyLCBsZW5ndGggOiBsZW5ndGh9LCBwdHM6IHBlcy5wdHMsIGR0czogcGVzLmR0cywga2V5OiBrZXl9O1xuICAgICAgICBzYW1wbGVzLnB1c2goYXZjU2FtcGxlKTtcbiAgICAgICAgdHJhY2subGVuICs9IGxlbmd0aDtcbiAgICAgICAgdHJhY2submJOYWx1ICs9IHVuaXRzMi5sZW5ndGg7XG4gICAgICB9XG4gICAgfVxuICB9XG5cblxuICBfcGFyc2VBVkNOQUx1KGFycmF5KSB7XG4gICAgdmFyIGkgPSAwLCBsZW4gPSBhcnJheS5ieXRlTGVuZ3RoLCB2YWx1ZSwgb3ZlcmZsb3csIHN0YXRlID0gMDtcbiAgICB2YXIgdW5pdHMgPSBbXSwgdW5pdCwgdW5pdFR5cGUsIGxhc3RVbml0U3RhcnQsIGxhc3RVbml0VHlwZTtcbiAgICAvL2xvZ2dlci5sb2coJ1BFUzonICsgSGV4LmhleER1bXAoYXJyYXkpKTtcbiAgICB3aGlsZSAoaSA8IGxlbikge1xuICAgICAgdmFsdWUgPSBhcnJheVtpKytdO1xuICAgICAgLy8gZmluZGluZyAzIG9yIDQtYnl0ZSBzdGFydCBjb2RlcyAoMDAgMDAgMDEgT1IgMDAgMDAgMDAgMDEpXG4gICAgICBzd2l0Y2ggKHN0YXRlKSB7XG4gICAgICAgIGNhc2UgMDpcbiAgICAgICAgICBpZiAodmFsdWUgPT09IDApIHtcbiAgICAgICAgICAgIHN0YXRlID0gMTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgMTpcbiAgICAgICAgICBpZiggdmFsdWUgPT09IDApIHtcbiAgICAgICAgICAgIHN0YXRlID0gMjtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3RhdGUgPSAwO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAyOlxuICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgaWYoIHZhbHVlID09PSAwKSB7XG4gICAgICAgICAgICBzdGF0ZSA9IDM7XG4gICAgICAgICAgfSBlbHNlIGlmICh2YWx1ZSA9PT0gMSAmJiBpIDwgbGVuKSB7XG4gICAgICAgICAgICB1bml0VHlwZSA9IGFycmF5W2ldICYgMHgxZjtcbiAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnZmluZCBOQUxVIEAgb2Zmc2V0OicgKyBpICsgJyx0eXBlOicgKyB1bml0VHlwZSk7XG4gICAgICAgICAgICBpZiAobGFzdFVuaXRTdGFydCkge1xuICAgICAgICAgICAgICB1bml0ID0ge2RhdGE6IGFycmF5LnN1YmFycmF5KGxhc3RVbml0U3RhcnQsIGkgLSBzdGF0ZSAtIDEpLCB0eXBlOiBsYXN0VW5pdFR5cGV9O1xuICAgICAgICAgICAgICAvL2xvZ2dlci5sb2coJ3B1c2hpbmcgTkFMVSwgdHlwZS9zaXplOicgKyB1bml0LnR5cGUgKyAnLycgKyB1bml0LmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICAgICAgICAgIHVuaXRzLnB1c2godW5pdCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyBJZiBOQUwgdW5pdHMgYXJlIG5vdCBzdGFydGluZyByaWdodCBhdCB0aGUgYmVnaW5uaW5nIG9mIHRoZSBQRVMgcGFja2V0LCBwdXNoIHByZWNlZGluZyBkYXRhIGludG8gcHJldmlvdXMgTkFMIHVuaXQuXG4gICAgICAgICAgICAgIG92ZXJmbG93ICA9IGkgLSBzdGF0ZSAtIDE7XG4gICAgICAgICAgICAgIGlmIChvdmVyZmxvdykge1xuICAgICAgICAgICAgICAgIHZhciB0cmFjayA9IHRoaXMuX2F2Y1RyYWNrLFxuICAgICAgICAgICAgICAgICAgICBzYW1wbGVzID0gdHJhY2suc2FtcGxlcztcbiAgICAgICAgICAgICAgICAvL2xvZ2dlci5sb2coJ2ZpcnN0IE5BTFUgZm91bmQgd2l0aCBvdmVyZmxvdzonICsgb3ZlcmZsb3cpO1xuICAgICAgICAgICAgICAgIGlmIChzYW1wbGVzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgdmFyIGxhc3RhdmNTYW1wbGUgPSBzYW1wbGVzW3NhbXBsZXMubGVuZ3RoIC0gMV0sXG4gICAgICAgICAgICAgICAgICAgICAgbGFzdFVuaXRzID0gbGFzdGF2Y1NhbXBsZS51bml0cy51bml0cyxcbiAgICAgICAgICAgICAgICAgICAgICBsYXN0VW5pdCA9IGxhc3RVbml0c1tsYXN0VW5pdHMubGVuZ3RoIC0gMV0sXG4gICAgICAgICAgICAgICAgICAgICAgdG1wID0gbmV3IFVpbnQ4QXJyYXkobGFzdFVuaXQuZGF0YS5ieXRlTGVuZ3RoICsgb3ZlcmZsb3cpO1xuICAgICAgICAgICAgICAgICAgdG1wLnNldChsYXN0VW5pdC5kYXRhLCAwKTtcbiAgICAgICAgICAgICAgICAgIHRtcC5zZXQoYXJyYXkuc3ViYXJyYXkoMCwgb3ZlcmZsb3cpLCBsYXN0VW5pdC5kYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgICAgICAgICAgICAgbGFzdFVuaXQuZGF0YSA9IHRtcDtcbiAgICAgICAgICAgICAgICAgIGxhc3RhdmNTYW1wbGUudW5pdHMubGVuZ3RoICs9IG92ZXJmbG93O1xuICAgICAgICAgICAgICAgICAgdHJhY2subGVuICs9IG92ZXJmbG93O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGFzdFVuaXRTdGFydCA9IGk7XG4gICAgICAgICAgICBsYXN0VW5pdFR5cGUgPSB1bml0VHlwZTtcbiAgICAgICAgICAgIGlmICh1bml0VHlwZSA9PT0gMSB8fCB1bml0VHlwZSA9PT0gNSkge1xuICAgICAgICAgICAgICAvLyBPUFRJICEhISBpZiBJRFIvTkRSIHVuaXQsIGNvbnNpZGVyIGl0IGlzIGxhc3QgTkFMdVxuICAgICAgICAgICAgICBpID0gbGVuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc3RhdGUgPSAwO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzdGF0ZSA9IDA7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAobGFzdFVuaXRTdGFydCkge1xuICAgICAgdW5pdCA9IHtkYXRhOiBhcnJheS5zdWJhcnJheShsYXN0VW5pdFN0YXJ0LCBsZW4pLCB0eXBlOiBsYXN0VW5pdFR5cGV9O1xuICAgICAgdW5pdHMucHVzaCh1bml0KTtcbiAgICAgIC8vbG9nZ2VyLmxvZygncHVzaGluZyBOQUxVLCB0eXBlL3NpemU6JyArIHVuaXQudHlwZSArICcvJyArIHVuaXQuZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICB9XG4gICAgcmV0dXJuIHVuaXRzO1xuICB9XG5cbiAgX3BhcnNlQUFDUEVTKHBlcykge1xuICAgIHZhciB0cmFjayA9IHRoaXMuX2FhY1RyYWNrLFxuICAgICAgICBkYXRhID0gcGVzLmRhdGEsXG4gICAgICAgIHB0cyA9IHBlcy5wdHMsXG4gICAgICAgIHN0YXJ0T2Zmc2V0ID0gMCxcbiAgICAgICAgZHVyYXRpb24gPSB0aGlzLl9kdXJhdGlvbixcbiAgICAgICAgYXVkaW9Db2RlYyA9IHRoaXMuYXVkaW9Db2RlYyxcbiAgICAgICAgYWFjT3ZlckZsb3cgPSB0aGlzLmFhY092ZXJGbG93LFxuICAgICAgICBsYXN0QWFjUFRTID0gdGhpcy5sYXN0QWFjUFRTLFxuICAgICAgICBjb25maWcsIGZyYW1lTGVuZ3RoLCBmcmFtZUR1cmF0aW9uLCBmcmFtZUluZGV4LCBvZmZzZXQsIGhlYWRlckxlbmd0aCwgc3RhbXAsIGxlbiwgYWFjU2FtcGxlO1xuICAgIGlmIChhYWNPdmVyRmxvdykge1xuICAgICAgdmFyIHRtcCA9IG5ldyBVaW50OEFycmF5KGFhY092ZXJGbG93LmJ5dGVMZW5ndGggKyBkYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgdG1wLnNldChhYWNPdmVyRmxvdywgMCk7XG4gICAgICB0bXAuc2V0KGRhdGEsIGFhY092ZXJGbG93LmJ5dGVMZW5ndGgpO1xuICAgICAgLy9sb2dnZXIubG9nKGBBQUM6IGFwcGVuZCBvdmVyZmxvd2luZyAke2FhY092ZXJGbG93LmJ5dGVMZW5ndGh9IGJ5dGVzIHRvIGJlZ2lubmluZyBvZiBuZXcgUEVTYCk7XG4gICAgICBkYXRhID0gdG1wO1xuICAgIH1cbiAgICAvLyBsb29rIGZvciBBRFRTIGhlYWRlciAoMHhGRkZ4KVxuICAgIGZvciAob2Zmc2V0ID0gc3RhcnRPZmZzZXQsIGxlbiA9IGRhdGEubGVuZ3RoOyBvZmZzZXQgPCBsZW4gLSAxOyBvZmZzZXQrKykge1xuICAgICAgaWYgKChkYXRhW29mZnNldF0gPT09IDB4ZmYpICYmIChkYXRhW29mZnNldCsxXSAmIDB4ZjApID09PSAweGYwKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBpZiBBRFRTIGhlYWRlciBkb2VzIG5vdCBzdGFydCBzdHJhaWdodCBmcm9tIHRoZSBiZWdpbm5pbmcgb2YgdGhlIFBFUyBwYXlsb2FkLCByYWlzZSBhbiBlcnJvclxuICAgIGlmIChvZmZzZXQpIHtcbiAgICAgIHZhciByZWFzb24sIGZhdGFsO1xuICAgICAgaWYgKG9mZnNldCA8IGxlbiAtIDEpIHtcbiAgICAgICAgcmVhc29uID0gYEFBQyBQRVMgZGlkIG5vdCBzdGFydCB3aXRoIEFEVFMgaGVhZGVyLG9mZnNldDoke29mZnNldH1gO1xuICAgICAgICBmYXRhbCA9IGZhbHNlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVhc29uID0gJ25vIEFEVFMgaGVhZGVyIGZvdW5kIGluIEFBQyBQRVMnO1xuICAgICAgICBmYXRhbCA9IHRydWU7XG4gICAgICB9XG4gICAgICB0aGlzLm9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuRlJBR19QQVJTSU5HX0VSUk9SLCBmYXRhbDogZmF0YWwsIHJlYXNvbjogcmVhc29ufSk7XG4gICAgICBpZiAoZmF0YWwpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIXRyYWNrLmF1ZGlvc2FtcGxlcmF0ZSkge1xuICAgICAgY29uZmlnID0gQURUUy5nZXRBdWRpb0NvbmZpZyh0aGlzLm9ic2VydmVyLGRhdGEsIG9mZnNldCwgYXVkaW9Db2RlYyk7XG4gICAgICB0cmFjay5jb25maWcgPSBjb25maWcuY29uZmlnO1xuICAgICAgdHJhY2suYXVkaW9zYW1wbGVyYXRlID0gY29uZmlnLnNhbXBsZXJhdGU7XG4gICAgICB0cmFjay5jaGFubmVsQ291bnQgPSBjb25maWcuY2hhbm5lbENvdW50O1xuICAgICAgdHJhY2suY29kZWMgPSBjb25maWcuY29kZWM7XG4gICAgICB0cmFjay50aW1lc2NhbGUgPSB0aGlzLnJlbXV4ZXIudGltZXNjYWxlO1xuICAgICAgdHJhY2suZHVyYXRpb24gPSB0cmFjay50aW1lc2NhbGUgKiBkdXJhdGlvbjtcbiAgICAgIGxvZ2dlci5sb2coYHBhcnNlZCBjb2RlYzoke3RyYWNrLmNvZGVjfSxyYXRlOiR7Y29uZmlnLnNhbXBsZXJhdGV9LG5iIGNoYW5uZWw6JHtjb25maWcuY2hhbm5lbENvdW50fWApO1xuICAgIH1cbiAgICBmcmFtZUluZGV4ID0gMDtcbiAgICBmcmFtZUR1cmF0aW9uID0gMTAyNCAqIDkwMDAwIC8gdHJhY2suYXVkaW9zYW1wbGVyYXRlO1xuXG4gICAgLy8gaWYgbGFzdCBBQUMgZnJhbWUgaXMgb3ZlcmZsb3dpbmcsIHdlIHNob3VsZCBlbnN1cmUgdGltZXN0YW1wcyBhcmUgY29udGlndW91czpcbiAgICAvLyBmaXJzdCBzYW1wbGUgUFRTIHNob3VsZCBiZSBlcXVhbCB0byBsYXN0IHNhbXBsZSBQVFMgKyBmcmFtZUR1cmF0aW9uXG4gICAgaWYoYWFjT3ZlckZsb3cgJiYgbGFzdEFhY1BUUykge1xuICAgICAgdmFyIG5ld1BUUyA9IGxhc3RBYWNQVFMrZnJhbWVEdXJhdGlvbjtcbiAgICAgIGlmKE1hdGguYWJzKG5ld1BUUy1wdHMpID4gMSkge1xuICAgICAgICBsb2dnZXIubG9nKGBBQUM6IGFsaWduIFBUUyBmb3Igb3ZlcmxhcHBpbmcgZnJhbWVzIGJ5ICR7TWF0aC5yb3VuZCgobmV3UFRTLXB0cykvOTApfWApO1xuICAgICAgICBwdHM9bmV3UFRTO1xuICAgICAgfVxuICAgIH1cblxuICAgIHdoaWxlICgob2Zmc2V0ICsgNSkgPCBsZW4pIHtcbiAgICAgIC8vIFRoZSBwcm90ZWN0aW9uIHNraXAgYml0IHRlbGxzIHVzIGlmIHdlIGhhdmUgMiBieXRlcyBvZiBDUkMgZGF0YSBhdCB0aGUgZW5kIG9mIHRoZSBBRFRTIGhlYWRlclxuICAgICAgaGVhZGVyTGVuZ3RoID0gKCEhKGRhdGFbb2Zmc2V0ICsgMV0gJiAweDAxKSA/IDcgOiA5KTtcbiAgICAgIC8vIHJldHJpZXZlIGZyYW1lIHNpemVcbiAgICAgIGZyYW1lTGVuZ3RoID0gKChkYXRhW29mZnNldCArIDNdICYgMHgwMykgPDwgMTEpIHxcbiAgICAgICAgICAgICAgICAgICAgIChkYXRhW29mZnNldCArIDRdIDw8IDMpIHxcbiAgICAgICAgICAgICAgICAgICAgKChkYXRhW29mZnNldCArIDVdICYgMHhFMCkgPj4+IDUpO1xuICAgICAgZnJhbWVMZW5ndGggIC09IGhlYWRlckxlbmd0aDtcbiAgICAgIC8vc3RhbXAgPSBwZXMucHRzO1xuXG4gICAgICBpZiAoKGZyYW1lTGVuZ3RoID4gMCkgJiYgKChvZmZzZXQgKyBoZWFkZXJMZW5ndGggKyBmcmFtZUxlbmd0aCkgPD0gbGVuKSkge1xuICAgICAgICBzdGFtcCA9IE1hdGgucm91bmQocHRzICsgZnJhbWVJbmRleCAqIGZyYW1lRHVyYXRpb24pO1xuICAgICAgICAvL2xvZ2dlci5sb2coYEFBQyBmcmFtZSwgb2Zmc2V0L2xlbmd0aC90b3RhbC9wdHM6JHtvZmZzZXQraGVhZGVyTGVuZ3RofS8ke2ZyYW1lTGVuZ3RofS8ke2RhdGEuYnl0ZUxlbmd0aH0vJHsoc3RhbXAvOTApLnRvRml4ZWQoMCl9YCk7XG4gICAgICAgIGFhY1NhbXBsZSA9IHt1bml0OiBkYXRhLnN1YmFycmF5KG9mZnNldCArIGhlYWRlckxlbmd0aCwgb2Zmc2V0ICsgaGVhZGVyTGVuZ3RoICsgZnJhbWVMZW5ndGgpLCBwdHM6IHN0YW1wLCBkdHM6IHN0YW1wfTtcbiAgICAgICAgdHJhY2suc2FtcGxlcy5wdXNoKGFhY1NhbXBsZSk7XG4gICAgICAgIHRyYWNrLmxlbiArPSBmcmFtZUxlbmd0aDtcbiAgICAgICAgb2Zmc2V0ICs9IGZyYW1lTGVuZ3RoICsgaGVhZGVyTGVuZ3RoO1xuICAgICAgICBmcmFtZUluZGV4Kys7XG4gICAgICAgIC8vIGxvb2sgZm9yIEFEVFMgaGVhZGVyICgweEZGRngpXG4gICAgICAgIGZvciAoIDsgb2Zmc2V0IDwgKGxlbiAtIDEpOyBvZmZzZXQrKykge1xuICAgICAgICAgIGlmICgoZGF0YVtvZmZzZXRdID09PSAweGZmKSAmJiAoKGRhdGFbb2Zmc2V0ICsgMV0gJiAweGYwKSA9PT0gMHhmMCkpIHtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChvZmZzZXQgPCBsZW4pIHtcbiAgICAgIGFhY092ZXJGbG93ID0gZGF0YS5zdWJhcnJheShvZmZzZXQsIGxlbik7XG4gICAgICAvL2xvZ2dlci5sb2coYEFBQzogb3ZlcmZsb3cgZGV0ZWN0ZWQ6JHtsZW4tb2Zmc2V0fWApO1xuICAgIH0gZWxzZSB7XG4gICAgICBhYWNPdmVyRmxvdyA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMuYWFjT3ZlckZsb3cgPSBhYWNPdmVyRmxvdztcbiAgICB0aGlzLmxhc3RBYWNQVFMgPSBzdGFtcDtcbiAgfVxuXG4gIF9wYXJzZUlEM1BFUyhwZXMpIHtcbiAgICB0aGlzLl9pZDNUcmFjay5zYW1wbGVzLnB1c2gocGVzKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBUU0RlbXV4ZXI7XG5cbiIsImV4cG9ydCBjb25zdCBFcnJvclR5cGVzID0ge1xuICAvLyBJZGVudGlmaWVyIGZvciBhIG5ldHdvcmsgZXJyb3IgKGxvYWRpbmcgZXJyb3IgLyB0aW1lb3V0IC4uLilcbiAgTkVUV09SS19FUlJPUjogJ2hsc05ldHdvcmtFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgbWVkaWEgRXJyb3IgKHZpZGVvL3BhcnNpbmcvbWVkaWFzb3VyY2UgZXJyb3IpXG4gIE1FRElBX0VSUk9SOiAnaGxzTWVkaWFFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGFsbCBvdGhlciBlcnJvcnNcbiAgT1RIRVJfRVJST1I6ICdobHNPdGhlckVycm9yJ1xufTtcblxuZXhwb3J0IGNvbnN0IEVycm9yRGV0YWlscyA9IHtcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBtYW5pZmVzdCBsb2FkIGVycm9yIC0gZGF0YTogeyB1cmwgOiBmYXVsdHkgVVJMLCByZXNwb25zZSA6IFhIUiByZXNwb25zZX1cbiAgTUFOSUZFU1RfTE9BRF9FUlJPUjogJ21hbmlmZXN0TG9hZEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBtYW5pZmVzdCBsb2FkIHRpbWVvdXQgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBNQU5JRkVTVF9MT0FEX1RJTUVPVVQ6ICdtYW5pZmVzdExvYWRUaW1lT3V0JyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBtYW5pZmVzdCBwYXJzaW5nIGVycm9yIC0gZGF0YTogeyB1cmwgOiBmYXVsdHkgVVJMLCByZWFzb24gOiBlcnJvciByZWFzb259XG4gIE1BTklGRVNUX1BBUlNJTkdfRVJST1I6ICdtYW5pZmVzdFBhcnNpbmdFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIHBsYXlsaXN0IGxvYWQgZXJyb3IgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBMRVZFTF9MT0FEX0VSUk9SOiAnbGV2ZWxMb2FkRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBwbGF5bGlzdCBsb2FkIHRpbWVvdXQgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBMRVZFTF9MT0FEX1RJTUVPVVQ6ICdsZXZlbExvYWRUaW1lT3V0JyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBsZXZlbCBzd2l0Y2ggZXJyb3IgLSBkYXRhOiB7IGxldmVsIDogZmF1bHR5IGxldmVsIElkLCBldmVudCA6IGVycm9yIGRlc2NyaXB0aW9ufVxuICBMRVZFTF9TV0lUQ0hfRVJST1I6ICdsZXZlbFN3aXRjaEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgZnJhZ21lbnQgbG9hZCBlcnJvciAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdCwgcmVzcG9uc2UgOiBYSFIgcmVzcG9uc2V9XG4gIEZSQUdfTE9BRF9FUlJPUjogJ2ZyYWdMb2FkRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBmcmFnbWVudCBsb29wIGxvYWRpbmcgZXJyb3IgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3R9XG4gIEZSQUdfTE9PUF9MT0FESU5HX0VSUk9SOiAnZnJhZ0xvb3BMb2FkaW5nRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBmcmFnbWVudCBsb2FkIHRpbWVvdXQgZXJyb3IgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3R9XG4gIEZSQUdfTE9BRF9USU1FT1VUOiAnZnJhZ0xvYWRUaW1lT3V0JyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBmcmFnbWVudCBkZWNyeXB0aW9uIGVycm9yIGV2ZW50IC0gZGF0YTogcGFyc2luZyBlcnJvciBkZXNjcmlwdGlvblxuICBGUkFHX0RFQ1JZUFRfRVJST1I6ICdmcmFnRGVjcnlwdEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBmcmFnbWVudCBwYXJzaW5nIGVycm9yIGV2ZW50IC0gZGF0YTogcGFyc2luZyBlcnJvciBkZXNjcmlwdGlvblxuICBGUkFHX1BBUlNJTkdfRVJST1I6ICdmcmFnUGFyc2luZ0Vycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgZGVjcnlwdCBrZXkgbG9hZCBlcnJvciAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdCwgcmVzcG9uc2UgOiBYSFIgcmVzcG9uc2V9XG4gIEtFWV9MT0FEX0VSUk9SOiAna2V5TG9hZEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgZGVjcnlwdCBrZXkgbG9hZCB0aW1lb3V0IGVycm9yIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0fVxuICBLRVlfTE9BRF9USU1FT1VUOiAna2V5TG9hZFRpbWVPdXQnLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIGJ1ZmZlciBhcHBlbmQgZXJyb3IgLSBkYXRhOiBhcHBlbmQgZXJyb3IgZGVzY3JpcHRpb25cbiAgQlVGRkVSX0FQUEVORF9FUlJPUjogJ2J1ZmZlckFwcGVuZEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBidWZmZXIgYXBwZW5kaW5nIGVycm9yIGV2ZW50IC0gZGF0YTogYXBwZW5kaW5nIGVycm9yIGRlc2NyaXB0aW9uXG4gIEJVRkZFUl9BUFBFTkRJTkdfRVJST1I6ICdidWZmZXJBcHBlbmRpbmdFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgYnVmZmVyIHN0YWxsZWQgZXJyb3IgZXZlbnRcbiAgQlVGRkVSX1NUQUxMRURfRVJST1I6ICdidWZmZXJTdGFsbGVkRXJyb3InXG59O1xuIiwiLypcbipcbiogQWxsIG9iamVjdHMgaW4gdGhlIGV2ZW50IGhhbmRsaW5nIGNoYWluIHNob3VsZCBpbmhlcml0IGZyb20gdGhpcyBjbGFzc1xuKlxuKi9cblxuLy9pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi91dGlscy9sb2dnZXInO1xuXG5jbGFzcyBFdmVudEhhbmRsZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscywgLi4uZXZlbnRzKSB7XG4gICAgdGhpcy5obHMgPSBobHM7XG4gICAgdGhpcy5vbkV2ZW50ID0gdGhpcy5vbkV2ZW50LmJpbmQodGhpcyk7XG4gICAgdGhpcy5oYW5kbGVkRXZlbnRzID0gZXZlbnRzO1xuICAgIHRoaXMudXNlR2VuZXJpY0hhbmRsZXIgPSB0cnVlO1xuXG4gICAgdGhpcy5yZWdpc3Rlckxpc3RlbmVycygpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLnVucmVnaXN0ZXJMaXN0ZW5lcnMoKTtcbiAgfVxuXG4gIGlzRXZlbnRIYW5kbGVyKCkge1xuICAgIHJldHVybiB0eXBlb2YgdGhpcy5oYW5kbGVkRXZlbnRzID09PSAnb2JqZWN0JyAmJiB0aGlzLmhhbmRsZWRFdmVudHMubGVuZ3RoICYmIHR5cGVvZiB0aGlzLm9uRXZlbnQgPT09ICdmdW5jdGlvbic7XG4gIH1cblxuICByZWdpc3Rlckxpc3RlbmVycygpIHtcbiAgICBpZiAodGhpcy5pc0V2ZW50SGFuZGxlcigpKSB7XG4gICAgICB0aGlzLmhhbmRsZWRFdmVudHMuZm9yRWFjaChmdW5jdGlvbihldmVudCkge1xuICAgICAgICBpZiAoZXZlbnQgPT09ICdobHNFdmVudEdlbmVyaWMnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdGb3JiaWRkZW4gZXZlbnQgbmFtZTogJyArIGV2ZW50KTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmhscy5vbihldmVudCwgdGhpcy5vbkV2ZW50KTtcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfVxuICB9XG5cbiAgdW5yZWdpc3Rlckxpc3RlbmVycygpIHtcbiAgICBpZiAodGhpcy5pc0V2ZW50SGFuZGxlcigpKSB7XG4gICAgICB0aGlzLmhhbmRsZWRFdmVudHMuZm9yRWFjaChmdW5jdGlvbihldmVudCkge1xuICAgICAgICB0aGlzLmhscy5vZmYoZXZlbnQsIHRoaXMub25FdmVudCk7XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH1cbiAgfVxuXG4gIC8qXG4gICogYXJndW1lbnRzOiBldmVudCAoc3RyaW5nKSwgZGF0YSAoYW55KVxuICAqL1xuICBvbkV2ZW50KGV2ZW50LCBkYXRhKSB7XG4gICAgdGhpcy5vbkV2ZW50R2VuZXJpYyhldmVudCwgZGF0YSk7XG4gIH1cblxuICBvbkV2ZW50R2VuZXJpYyhldmVudCwgZGF0YSkge1xuICAgIHZhciBldmVudFRvRnVuY3Rpb24gPSBmdW5jdGlvbihldmVudCwgZGF0YSkge1xuICAgICAgdmFyIGZ1bmNOYW1lID0gJ29uJyArIGV2ZW50LnJlcGxhY2UoJ2hscycsICcnKTtcbiAgICAgIGlmICh0eXBlb2YgdGhpc1tmdW5jTmFtZV0gIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBFdmVudCAke2V2ZW50fSBoYXMgbm8gZ2VuZXJpYyBoYW5kbGVyIGluIHRoaXMgJHt0aGlzLmNvbnN0cnVjdG9yLm5hbWV9IGNsYXNzICh0cmllZCAke2Z1bmNOYW1lfSlgKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzW2Z1bmNOYW1lXS5iaW5kKHRoaXMsIGRhdGEpO1xuICAgIH07XG4gICAgZXZlbnRUb0Z1bmN0aW9uLmNhbGwodGhpcywgZXZlbnQsIGRhdGEpLmNhbGwoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFdmVudEhhbmRsZXI7IiwibW9kdWxlLmV4cG9ydHMgPSB7XG4gIC8vIGZpcmVkIGJlZm9yZSBNZWRpYVNvdXJjZSBpcyBhdHRhY2hpbmcgdG8gbWVkaWEgZWxlbWVudCAtIGRhdGE6IHsgbWVkaWEgfVxuICBNRURJQV9BVFRBQ0hJTkc6ICdobHNNZWRpYUF0dGFjaGluZycsXG4gIC8vIGZpcmVkIHdoZW4gTWVkaWFTb3VyY2UgaGFzIGJlZW4gc3VjY2VzZnVsbHkgYXR0YWNoZWQgdG8gbWVkaWEgZWxlbWVudCAtIGRhdGE6IHsgfVxuICBNRURJQV9BVFRBQ0hFRDogJ2hsc01lZGlhQXR0YWNoZWQnLFxuICAvLyBmaXJlZCBiZWZvcmUgZGV0YWNoaW5nIE1lZGlhU291cmNlIGZyb20gbWVkaWEgZWxlbWVudCAtIGRhdGE6IHsgfVxuICBNRURJQV9ERVRBQ0hJTkc6ICdobHNNZWRpYURldGFjaGluZycsXG4gIC8vIGZpcmVkIHdoZW4gTWVkaWFTb3VyY2UgaGFzIGJlZW4gZGV0YWNoZWQgZnJvbSBtZWRpYSBlbGVtZW50IC0gZGF0YTogeyB9XG4gIE1FRElBX0RFVEFDSEVEOiAnaGxzTWVkaWFEZXRhY2hlZCcsXG4gIC8vIGZpcmVkIHRvIHNpZ25hbCB0aGF0IGEgbWFuaWZlc3QgbG9hZGluZyBzdGFydHMgLSBkYXRhOiB7IHVybCA6IG1hbmlmZXN0VVJMfVxuICBNQU5JRkVTVF9MT0FESU5HOiAnaGxzTWFuaWZlc3RMb2FkaW5nJyxcbiAgLy8gZmlyZWQgYWZ0ZXIgbWFuaWZlc3QgaGFzIGJlZW4gbG9hZGVkIC0gZGF0YTogeyBsZXZlbHMgOiBbYXZhaWxhYmxlIHF1YWxpdHkgbGV2ZWxzXSAsIHVybCA6IG1hbmlmZXN0VVJMLCBzdGF0cyA6IHsgdHJlcXVlc3QsIHRmaXJzdCwgdGxvYWQsIG10aW1lfX1cbiAgTUFOSUZFU1RfTE9BREVEOiAnaGxzTWFuaWZlc3RMb2FkZWQnLFxuICAvLyBmaXJlZCBhZnRlciBtYW5pZmVzdCBoYXMgYmVlbiBwYXJzZWQgLSBkYXRhOiB7IGxldmVscyA6IFthdmFpbGFibGUgcXVhbGl0eSBsZXZlbHNdICwgZmlyc3RMZXZlbCA6IGluZGV4IG9mIGZpcnN0IHF1YWxpdHkgbGV2ZWwgYXBwZWFyaW5nIGluIE1hbmlmZXN0fVxuICBNQU5JRkVTVF9QQVJTRUQ6ICdobHNNYW5pZmVzdFBhcnNlZCcsXG4gIC8vIGZpcmVkIHdoZW4gYSBsZXZlbCBwbGF5bGlzdCBsb2FkaW5nIHN0YXJ0cyAtIGRhdGE6IHsgdXJsIDogbGV2ZWwgVVJMICBsZXZlbCA6IGlkIG9mIGxldmVsIGJlaW5nIGxvYWRlZH1cbiAgTEVWRUxfTE9BRElORzogJ2hsc0xldmVsTG9hZGluZycsXG4gIC8vIGZpcmVkIHdoZW4gYSBsZXZlbCBwbGF5bGlzdCBsb2FkaW5nIGZpbmlzaGVzIC0gZGF0YTogeyBkZXRhaWxzIDogbGV2ZWxEZXRhaWxzIG9iamVjdCwgbGV2ZWwgOiBpZCBvZiBsb2FkZWQgbGV2ZWwsIHN0YXRzIDogeyB0cmVxdWVzdCwgdGZpcnN0LCB0bG9hZCwgbXRpbWV9IH1cbiAgTEVWRUxfTE9BREVEOiAnaGxzTGV2ZWxMb2FkZWQnLFxuICAvLyBmaXJlZCB3aGVuIGEgbGV2ZWwncyBkZXRhaWxzIGhhdmUgYmVlbiB1cGRhdGVkIGJhc2VkIG9uIHByZXZpb3VzIGRldGFpbHMsIGFmdGVyIGl0IGhhcyBiZWVuIGxvYWRlZC4gLSBkYXRhOiB7IGRldGFpbHMgOiBsZXZlbERldGFpbHMgb2JqZWN0LCBsZXZlbCA6IGlkIG9mIHVwZGF0ZWQgbGV2ZWwgfVxuICBMRVZFTF9VUERBVEVEOiAnaGxzTGV2ZWxVcGRhdGVkJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGxldmVsJ3MgUFRTIGluZm9ybWF0aW9uIGhhcyBiZWVuIHVwZGF0ZWQgYWZ0ZXIgcGFyc2luZyBhIGZyYWdtZW50IC0gZGF0YTogeyBkZXRhaWxzIDogbGV2ZWxEZXRhaWxzIG9iamVjdCwgbGV2ZWwgOiBpZCBvZiB1cGRhdGVkIGxldmVsLCBkcmlmdDogUFRTIGRyaWZ0IG9ic2VydmVkIHdoZW4gcGFyc2luZyBsYXN0IGZyYWdtZW50IH1cbiAgTEVWRUxfUFRTX1VQREFURUQ6ICdobHNMZXZlbFB0c1VwZGF0ZWQnLFxuICAvLyBmaXJlZCB3aGVuIGEgbGV2ZWwgc3dpdGNoIGlzIHJlcXVlc3RlZCAtIGRhdGE6IHsgbGV2ZWwgOiBpZCBvZiBuZXcgbGV2ZWwgfVxuICBMRVZFTF9TV0lUQ0g6ICdobHNMZXZlbFN3aXRjaCcsXG4gIC8vIGZpcmVkIHdoZW4gYSBmcmFnbWVudCBsb2FkaW5nIHN0YXJ0cyAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdH1cbiAgRlJBR19MT0FESU5HOiAnaGxzRnJhZ0xvYWRpbmcnLFxuICAvLyBmaXJlZCB3aGVuIGEgZnJhZ21lbnQgbG9hZGluZyBpcyBwcm9ncmVzc2luZyAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdCwgeyB0cmVxdWVzdCwgdGZpcnN0LCBsb2FkZWR9fVxuICBGUkFHX0xPQURfUFJPR1JFU1M6ICdobHNGcmFnTG9hZFByb2dyZXNzJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgZnJhZ21lbnQgbG9hZCBhYm9ydGluZyBmb3IgZW1lcmdlbmN5IHN3aXRjaCBkb3duIC0gZGF0YToge2ZyYWcgOiBmcmFnbWVudCBvYmplY3R9XG4gIEZSQUdfTE9BRF9FTUVSR0VOQ1lfQUJPUlRFRDogJ2hsc0ZyYWdMb2FkRW1lcmdlbmN5QWJvcnRlZCcsXG4gIC8vIGZpcmVkIHdoZW4gYSBmcmFnbWVudCBsb2FkaW5nIGlzIGNvbXBsZXRlZCAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdCwgcGF5bG9hZCA6IGZyYWdtZW50IHBheWxvYWQsIHN0YXRzIDogeyB0cmVxdWVzdCwgdGZpcnN0LCB0bG9hZCwgbGVuZ3RofX1cbiAgRlJBR19MT0FERUQ6ICdobHNGcmFnTG9hZGVkJyxcbiAgLy8gZmlyZWQgd2hlbiBJbml0IFNlZ21lbnQgaGFzIGJlZW4gZXh0cmFjdGVkIGZyb20gZnJhZ21lbnQgLSBkYXRhOiB7IG1vb3YgOiBtb292IE1QNCBib3gsIGNvZGVjcyA6IGNvZGVjcyBmb3VuZCB3aGlsZSBwYXJzaW5nIGZyYWdtZW50fVxuICBGUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5UOiAnaGxzRnJhZ1BhcnNpbmdJbml0U2VnbWVudCcsXG4gIC8vIGZpcmVkIHdoZW4gcGFyc2luZyBzZWkgdGV4dCBpcyBjb21wbGV0ZWQgLSBkYXRhOiB7IHNhbXBsZXMgOiBbIHNlaSBzYW1wbGVzIHBlcyBdIH1cbiAgRlJBR19QQVJTSU5HX1VTRVJEQVRBOiAnaGxzRnJhUGFyc2luZ1VzZXJkYXRhJyxcbiAgLy8gZmlyZWQgd2hlbiBwYXJzaW5nIGlkMyBpcyBjb21wbGV0ZWQgLSBkYXRhOiB7IHNhbXBsZXMgOiBbIGlkMyBzYW1wbGVzIHBlcyBdIH1cbiAgRlJBR19QQVJTSU5HX01FVEFEQVRBOiAnaGxzRnJhZ1BhcnNpbmdNZXRhZGF0YScsXG4gIC8vIGZpcmVkIHdoZW4gbW9vZi9tZGF0IGhhdmUgYmVlbiBleHRyYWN0ZWQgZnJvbSBmcmFnbWVudCAtIGRhdGE6IHsgbW9vZiA6IG1vb2YgTVA0IGJveCwgbWRhdCA6IG1kYXQgTVA0IGJveH1cbiAgRlJBR19QQVJTSU5HX0RBVEE6ICdobHNGcmFnUGFyc2luZ0RhdGEnLFxuICAvLyBmaXJlZCB3aGVuIGZyYWdtZW50IHBhcnNpbmcgaXMgY29tcGxldGVkIC0gZGF0YTogdW5kZWZpbmVkXG4gIEZSQUdfUEFSU0VEOiAnaGxzRnJhZ1BhcnNlZCcsXG4gIC8vIGZpcmVkIHdoZW4gZnJhZ21lbnQgcmVtdXhlZCBNUDQgYm94ZXMgaGF2ZSBhbGwgYmVlbiBhcHBlbmRlZCBpbnRvIFNvdXJjZUJ1ZmZlciAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdCwgc3RhdHMgOiB7IHRyZXF1ZXN0LCB0Zmlyc3QsIHRsb2FkLCB0cGFyc2VkLCB0YnVmZmVyZWQsIGxlbmd0aH0gfVxuICBGUkFHX0JVRkZFUkVEOiAnaGxzRnJhZ0J1ZmZlcmVkJyxcbiAgLy8gZmlyZWQgd2hlbiBmcmFnbWVudCBtYXRjaGluZyB3aXRoIGN1cnJlbnQgbWVkaWEgcG9zaXRpb24gaXMgY2hhbmdpbmcgLSBkYXRhIDogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0IH1cbiAgRlJBR19DSEFOR0VEOiAnaGxzRnJhZ0NoYW5nZWQnLFxuICAgIC8vIElkZW50aWZpZXIgZm9yIGEgRlBTIGRyb3AgZXZlbnQgLSBkYXRhOiB7Y3VyZW50RHJvcHBlZCwgY3VycmVudERlY29kZWQsIHRvdGFsRHJvcHBlZEZyYW1lc31cbiAgRlBTX0RST1A6ICdobHNGcHNEcm9wJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYW4gZXJyb3IgZXZlbnQgLSBkYXRhOiB7IHR5cGUgOiBlcnJvciB0eXBlLCBkZXRhaWxzIDogZXJyb3IgZGV0YWlscywgZmF0YWwgOiBpZiB0cnVlLCBobHMuanMgY2Fubm90L3dpbGwgbm90IHRyeSB0byByZWNvdmVyLCBpZiBmYWxzZSwgaGxzLmpzIHdpbGwgdHJ5IHRvIHJlY292ZXIsb3RoZXIgZXJyb3Igc3BlY2lmaWMgZGF0YX1cbiAgRVJST1I6ICdobHNFcnJvcicsXG4gIC8vIGZpcmVkIHdoZW4gaGxzLmpzIGluc3RhbmNlIHN0YXJ0cyBkZXN0cm95aW5nLiBEaWZmZXJlbnQgZnJvbSBNRURJQV9ERVRBQ0hFRCBhcyBvbmUgY291bGQgd2FudCB0byBkZXRhY2ggYW5kIHJlYXR0YWNoIGEgbWVkaWEgdG8gdGhlIGluc3RhbmNlIG9mIGhscy5qcyB0byBoYW5kbGUgbWlkLXJvbGxzIGZvciBleGFtcGxlXG4gIERFU1RST1lJTkc6ICdobHNEZXN0cm95aW5nJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGRlY3J5cHQga2V5IGxvYWRpbmcgc3RhcnRzIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0fVxuICBLRVlfTE9BRElORzogJ2hsc0tleUxvYWRpbmcnLFxuICAvLyBmaXJlZCB3aGVuIGEgZGVjcnlwdCBrZXkgbG9hZGluZyBpcyBjb21wbGV0ZWQgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QsIHBheWxvYWQgOiBrZXkgcGF5bG9hZCwgc3RhdHMgOiB7IHRyZXF1ZXN0LCB0Zmlyc3QsIHRsb2FkLCBsZW5ndGh9fVxuICBLRVlfTE9BREVEOiAnaGxzS2V5TG9hZGVkJyxcbn07XG4iLCIvKipcbiAqIExldmVsIEhlbHBlciBjbGFzcywgcHJvdmlkaW5nIG1ldGhvZHMgZGVhbGluZyB3aXRoIHBsYXlsaXN0IHNsaWRpbmcgYW5kIGRyaWZ0XG4qL1xuXG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuY2xhc3MgTGV2ZWxIZWxwZXIge1xuXG4gIHN0YXRpYyBtZXJnZURldGFpbHMob2xkRGV0YWlscyxuZXdEZXRhaWxzKSB7XG4gICAgdmFyIHN0YXJ0ID0gTWF0aC5tYXgob2xkRGV0YWlscy5zdGFydFNOLG5ld0RldGFpbHMuc3RhcnRTTiktbmV3RGV0YWlscy5zdGFydFNOLFxuICAgICAgICBlbmQgPSBNYXRoLm1pbihvbGREZXRhaWxzLmVuZFNOLG5ld0RldGFpbHMuZW5kU04pLW5ld0RldGFpbHMuc3RhcnRTTixcbiAgICAgICAgZGVsdGEgPSBuZXdEZXRhaWxzLnN0YXJ0U04gLSBvbGREZXRhaWxzLnN0YXJ0U04sXG4gICAgICAgIG9sZGZyYWdtZW50cyA9IG9sZERldGFpbHMuZnJhZ21lbnRzLFxuICAgICAgICBuZXdmcmFnbWVudHMgPSBuZXdEZXRhaWxzLmZyYWdtZW50cyxcbiAgICAgICAgY2NPZmZzZXQgPTAsXG4gICAgICAgIFBUU0ZyYWc7XG5cbiAgICAvLyBjaGVjayBpZiBvbGQvbmV3IHBsYXlsaXN0cyBoYXZlIGZyYWdtZW50cyBpbiBjb21tb25cbiAgICBpZiAoIGVuZCA8IHN0YXJ0KSB7XG4gICAgICBuZXdEZXRhaWxzLlBUU0tub3duID0gZmFsc2U7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIC8vIGxvb3AgdGhyb3VnaCBvdmVybGFwcGluZyBTTiBhbmQgdXBkYXRlIHN0YXJ0UFRTICwgY2MsIGFuZCBkdXJhdGlvbiBpZiBhbnkgZm91bmRcbiAgICBmb3IodmFyIGkgPSBzdGFydCA7IGkgPD0gZW5kIDsgaSsrKSB7XG4gICAgICB2YXIgb2xkRnJhZyA9IG9sZGZyYWdtZW50c1tkZWx0YStpXSxcbiAgICAgICAgICBuZXdGcmFnID0gbmV3ZnJhZ21lbnRzW2ldO1xuICAgICAgY2NPZmZzZXQgPSBvbGRGcmFnLmNjIC0gbmV3RnJhZy5jYztcbiAgICAgIGlmICghaXNOYU4ob2xkRnJhZy5zdGFydFBUUykpIHtcbiAgICAgICAgbmV3RnJhZy5zdGFydCA9IG5ld0ZyYWcuc3RhcnRQVFMgPSBvbGRGcmFnLnN0YXJ0UFRTO1xuICAgICAgICBuZXdGcmFnLmVuZFBUUyA9IG9sZEZyYWcuZW5kUFRTO1xuICAgICAgICBuZXdGcmFnLmR1cmF0aW9uID0gb2xkRnJhZy5kdXJhdGlvbjtcbiAgICAgICAgUFRTRnJhZyA9IG5ld0ZyYWc7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYoY2NPZmZzZXQpIHtcbiAgICAgIGxvZ2dlci5sb2coYGRpc2NvbnRpbnVpdHkgc2xpZGluZyBmcm9tIHBsYXlsaXN0LCB0YWtlIGRyaWZ0IGludG8gYWNjb3VudGApO1xuICAgICAgZm9yKGkgPSAwIDsgaSA8IG5ld2ZyYWdtZW50cy5sZW5ndGggOyBpKyspIHtcbiAgICAgICAgbmV3ZnJhZ21lbnRzW2ldLmNjICs9IGNjT2Zmc2V0O1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGlmIGF0IGxlYXN0IG9uZSBmcmFnbWVudCBjb250YWlucyBQVFMgaW5mbywgcmVjb21wdXRlIFBUUyBpbmZvcm1hdGlvbiBmb3IgYWxsIGZyYWdtZW50c1xuICAgIGlmKFBUU0ZyYWcpIHtcbiAgICAgIExldmVsSGVscGVyLnVwZGF0ZUZyYWdQVFMobmV3RGV0YWlscyxQVFNGcmFnLnNuLFBUU0ZyYWcuc3RhcnRQVFMsUFRTRnJhZy5lbmRQVFMpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBhZGp1c3Qgc3RhcnQgYnkgc2xpZGluZyBvZmZzZXRcbiAgICAgIHZhciBzbGlkaW5nID0gb2xkZnJhZ21lbnRzW2RlbHRhXS5zdGFydDtcbiAgICAgIGZvcihpID0gMCA7IGkgPCBuZXdmcmFnbWVudHMubGVuZ3RoIDsgaSsrKSB7XG4gICAgICAgIG5ld2ZyYWdtZW50c1tpXS5zdGFydCArPSBzbGlkaW5nO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBpZiB3ZSBhcmUgaGVyZSwgaXQgbWVhbnMgd2UgaGF2ZSBmcmFnbWVudHMgb3ZlcmxhcHBpbmcgYmV0d2VlblxuICAgIC8vIG9sZCBhbmQgbmV3IGxldmVsLiByZWxpYWJsZSBQVFMgaW5mbyBpcyB0aHVzIHJlbHlpbmcgb24gb2xkIGxldmVsXG4gICAgbmV3RGV0YWlscy5QVFNLbm93biA9IG9sZERldGFpbHMuUFRTS25vd247XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgc3RhdGljIHVwZGF0ZUZyYWdQVFMoZGV0YWlscyxzbixzdGFydFBUUyxlbmRQVFMpIHtcbiAgICB2YXIgZnJhZ0lkeCwgZnJhZ21lbnRzLCBmcmFnLCBpO1xuICAgIC8vIGV4aXQgaWYgc24gb3V0IG9mIHJhbmdlXG4gICAgaWYgKHNuIDwgZGV0YWlscy5zdGFydFNOIHx8IHNuID4gZGV0YWlscy5lbmRTTikge1xuICAgICAgcmV0dXJuIDA7XG4gICAgfVxuICAgIGZyYWdJZHggPSBzbiAtIGRldGFpbHMuc3RhcnRTTjtcbiAgICBmcmFnbWVudHMgPSBkZXRhaWxzLmZyYWdtZW50cztcbiAgICBmcmFnID0gZnJhZ21lbnRzW2ZyYWdJZHhdO1xuICAgIGlmKCFpc05hTihmcmFnLnN0YXJ0UFRTKSkge1xuICAgICAgc3RhcnRQVFMgPSBNYXRoLm1pbihzdGFydFBUUyxmcmFnLnN0YXJ0UFRTKTtcbiAgICAgIGVuZFBUUyA9IE1hdGgubWF4KGVuZFBUUywgZnJhZy5lbmRQVFMpO1xuICAgIH1cblxuICAgIHZhciBkcmlmdCA9IHN0YXJ0UFRTIC0gZnJhZy5zdGFydDtcblxuICAgIGZyYWcuc3RhcnQgPSBmcmFnLnN0YXJ0UFRTID0gc3RhcnRQVFM7XG4gICAgZnJhZy5lbmRQVFMgPSBlbmRQVFM7XG4gICAgZnJhZy5kdXJhdGlvbiA9IGVuZFBUUyAtIHN0YXJ0UFRTO1xuICAgIC8vIGFkanVzdCBmcmFnbWVudCBQVFMvZHVyYXRpb24gZnJvbSBzZXFudW0tMSB0byBmcmFnIDBcbiAgICBmb3IoaSA9IGZyYWdJZHggOyBpID4gMCA7IGktLSkge1xuICAgICAgTGV2ZWxIZWxwZXIudXBkYXRlUFRTKGZyYWdtZW50cyxpLGktMSk7XG4gICAgfVxuXG4gICAgLy8gYWRqdXN0IGZyYWdtZW50IFBUUy9kdXJhdGlvbiBmcm9tIHNlcW51bSB0byBsYXN0IGZyYWdcbiAgICBmb3IoaSA9IGZyYWdJZHggOyBpIDwgZnJhZ21lbnRzLmxlbmd0aCAtIDEgOyBpKyspIHtcbiAgICAgIExldmVsSGVscGVyLnVwZGF0ZVBUUyhmcmFnbWVudHMsaSxpKzEpO1xuICAgIH1cbiAgICBkZXRhaWxzLlBUU0tub3duID0gdHJ1ZTtcbiAgICAvL2xvZ2dlci5sb2coYCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnJhZyBzdGFydC9lbmQ6JHtzdGFydFBUUy50b0ZpeGVkKDMpfS8ke2VuZFBUUy50b0ZpeGVkKDMpfWApO1xuXG4gICAgcmV0dXJuIGRyaWZ0O1xuICB9XG5cbiAgc3RhdGljIHVwZGF0ZVBUUyhmcmFnbWVudHMsZnJvbUlkeCwgdG9JZHgpIHtcbiAgICB2YXIgZnJhZ0Zyb20gPSBmcmFnbWVudHNbZnJvbUlkeF0sZnJhZ1RvID0gZnJhZ21lbnRzW3RvSWR4XSwgZnJhZ1RvUFRTID0gZnJhZ1RvLnN0YXJ0UFRTO1xuICAgIC8vIGlmIHdlIGtub3cgc3RhcnRQVFNbdG9JZHhdXG4gICAgaWYoIWlzTmFOKGZyYWdUb1BUUykpIHtcbiAgICAgIC8vIHVwZGF0ZSBmcmFnbWVudCBkdXJhdGlvbi5cbiAgICAgIC8vIGl0IGhlbHBzIHRvIGZpeCBkcmlmdHMgYmV0d2VlbiBwbGF5bGlzdCByZXBvcnRlZCBkdXJhdGlvbiBhbmQgZnJhZ21lbnQgcmVhbCBkdXJhdGlvblxuICAgICAgaWYgKHRvSWR4ID4gZnJvbUlkeCkge1xuICAgICAgICBmcmFnRnJvbS5kdXJhdGlvbiA9IGZyYWdUb1BUUy1mcmFnRnJvbS5zdGFydDtcbiAgICAgICAgaWYoZnJhZ0Zyb20uZHVyYXRpb24gPCAwKSB7XG4gICAgICAgICAgbG9nZ2VyLmVycm9yKGBuZWdhdGl2ZSBkdXJhdGlvbiBjb21wdXRlZCBmb3IgZnJhZyAke2ZyYWdGcm9tLnNufSxsZXZlbCAke2ZyYWdGcm9tLmxldmVsfSwgdGhlcmUgc2hvdWxkIGJlIHNvbWUgZHVyYXRpb24gZHJpZnQgYmV0d2VlbiBwbGF5bGlzdCBhbmQgZnJhZ21lbnQhYCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZyYWdUby5kdXJhdGlvbiA9IGZyYWdGcm9tLnN0YXJ0IC0gZnJhZ1RvUFRTO1xuICAgICAgICBpZihmcmFnVG8uZHVyYXRpb24gPCAwKSB7XG4gICAgICAgICAgbG9nZ2VyLmVycm9yKGBuZWdhdGl2ZSBkdXJhdGlvbiBjb21wdXRlZCBmb3IgZnJhZyAke2ZyYWdUby5zbn0sbGV2ZWwgJHtmcmFnVG8ubGV2ZWx9LCB0aGVyZSBzaG91bGQgYmUgc29tZSBkdXJhdGlvbiBkcmlmdCBiZXR3ZWVuIHBsYXlsaXN0IGFuZCBmcmFnbWVudCFgKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyB3ZSBkb250IGtub3cgc3RhcnRQVFNbdG9JZHhdXG4gICAgICBpZiAodG9JZHggPiBmcm9tSWR4KSB7XG4gICAgICAgIGZyYWdUby5zdGFydCA9IGZyYWdGcm9tLnN0YXJ0ICsgZnJhZ0Zyb20uZHVyYXRpb247XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmcmFnVG8uc3RhcnQgPSBmcmFnRnJvbS5zdGFydCAtIGZyYWdUby5kdXJhdGlvbjtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTGV2ZWxIZWxwZXI7XG4iLCIvKipcbiAqIEhMUyBpbnRlcmZhY2VcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi9ldmVudHMnO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4vZXJyb3JzJztcbmltcG9ydCBQbGF5bGlzdExvYWRlciBmcm9tICcuL2xvYWRlci9wbGF5bGlzdC1sb2FkZXInO1xuaW1wb3J0IEZyYWdtZW50TG9hZGVyIGZyb20gJy4vbG9hZGVyL2ZyYWdtZW50LWxvYWRlcic7XG5pbXBvcnQgQWJyQ29udHJvbGxlciBmcm9tICAgICcuL2NvbnRyb2xsZXIvYWJyLWNvbnRyb2xsZXInO1xuaW1wb3J0IE1TRU1lZGlhQ29udHJvbGxlciBmcm9tICcuL2NvbnRyb2xsZXIvbXNlLW1lZGlhLWNvbnRyb2xsZXInO1xuaW1wb3J0IExldmVsQ29udHJvbGxlciBmcm9tICAnLi9jb250cm9sbGVyL2xldmVsLWNvbnRyb2xsZXInO1xuaW1wb3J0IFRpbWVsaW5lQ29udHJvbGxlciBmcm9tICcuL2NvbnRyb2xsZXIvdGltZWxpbmUtY29udHJvbGxlcic7XG4vL2ltcG9ydCBGUFNDb250cm9sbGVyIGZyb20gJy4vY29udHJvbGxlci9mcHMtY29udHJvbGxlcic7XG5pbXBvcnQge2xvZ2dlciwgZW5hYmxlTG9nc30gZnJvbSAnLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IFhockxvYWRlciBmcm9tICcuL3V0aWxzL3hoci1sb2FkZXInO1xuaW1wb3J0IEV2ZW50RW1pdHRlciBmcm9tICdldmVudHMnO1xuaW1wb3J0IEtleUxvYWRlciBmcm9tICcuL2xvYWRlci9rZXktbG9hZGVyJztcblxuY2xhc3MgSGxzIHtcblxuICBzdGF0aWMgaXNTdXBwb3J0ZWQoKSB7XG4gICAgcmV0dXJuICh3aW5kb3cuTWVkaWFTb3VyY2UgJiYgd2luZG93Lk1lZGlhU291cmNlLmlzVHlwZVN1cHBvcnRlZCgndmlkZW8vbXA0OyBjb2RlY3M9XCJhdmMxLjQyRTAxRSxtcDRhLjQwLjJcIicpKTtcbiAgfVxuXG4gIHN0YXRpYyBnZXQgRXZlbnRzKCkge1xuICAgIHJldHVybiBFdmVudDtcbiAgfVxuXG4gIHN0YXRpYyBnZXQgRXJyb3JUeXBlcygpIHtcbiAgICByZXR1cm4gRXJyb3JUeXBlcztcbiAgfVxuXG4gIHN0YXRpYyBnZXQgRXJyb3JEZXRhaWxzKCkge1xuICAgIHJldHVybiBFcnJvckRldGFpbHM7XG4gIH1cblxuICBzdGF0aWMgZ2V0IERlZmF1bHRDb25maWcoKSB7XG4gICAgaWYoIUhscy5kZWZhdWx0Q29uZmlnKSB7XG4gICAgICAgSGxzLmRlZmF1bHRDb25maWcgPSB7XG4gICAgICAgICAgYXV0b1N0YXJ0TG9hZDogdHJ1ZSxcbiAgICAgICAgICBkZWJ1ZzogZmFsc2UsXG4gICAgICAgICAgbWF4QnVmZmVyTGVuZ3RoOiAzMCxcbiAgICAgICAgICBtYXhCdWZmZXJTaXplOiA2MCAqIDEwMDAgKiAxMDAwLFxuICAgICAgICAgIG1heEJ1ZmZlckhvbGU6IDAuMyxcbiAgICAgICAgICBtYXhTZWVrSG9sZTogMixcbiAgICAgICAgICBsaXZlU3luY0R1cmF0aW9uQ291bnQ6MyxcbiAgICAgICAgICBsaXZlTWF4TGF0ZW5jeUR1cmF0aW9uQ291bnQ6IEluZmluaXR5LFxuICAgICAgICAgIG1heE1heEJ1ZmZlckxlbmd0aDogNjAwLFxuICAgICAgICAgIGVuYWJsZVdvcmtlcjogdHJ1ZSxcbiAgICAgICAgICBlbmFibGVTb2Z0d2FyZUFFUzogdHJ1ZSxcbiAgICAgICAgICBtYW5pZmVzdExvYWRpbmdUaW1lT3V0OiAxMDAwMCxcbiAgICAgICAgICBtYW5pZmVzdExvYWRpbmdNYXhSZXRyeTogMSxcbiAgICAgICAgICBtYW5pZmVzdExvYWRpbmdSZXRyeURlbGF5OiAxMDAwLFxuICAgICAgICAgIGxldmVsTG9hZGluZ1RpbWVPdXQ6IDEwMDAwLFxuICAgICAgICAgIGxldmVsTG9hZGluZ01heFJldHJ5OiA0LFxuICAgICAgICAgIGxldmVsTG9hZGluZ1JldHJ5RGVsYXk6IDEwMDAsXG4gICAgICAgICAgZnJhZ0xvYWRpbmdUaW1lT3V0OiAyMDAwMCxcbiAgICAgICAgICBmcmFnTG9hZGluZ01heFJldHJ5OiA2LFxuICAgICAgICAgIGZyYWdMb2FkaW5nUmV0cnlEZWxheTogMTAwMCxcbiAgICAgICAgICBmcmFnTG9hZGluZ0xvb3BUaHJlc2hvbGQ6IDMsXG4gICAgICAgICAgLy8gZnBzRHJvcHBlZE1vbml0b3JpbmdQZXJpb2Q6IDUwMDAsXG4gICAgICAgICAgLy8gZnBzRHJvcHBlZE1vbml0b3JpbmdUaHJlc2hvbGQ6IDAuMixcbiAgICAgICAgICBhcHBlbmRFcnJvck1heFJldHJ5OiAzLFxuICAgICAgICAgIGxvYWRlcjogWGhyTG9hZGVyLFxuICAgICAgICAgIGZMb2FkZXI6IHVuZGVmaW5lZCxcbiAgICAgICAgICBwTG9hZGVyOiB1bmRlZmluZWQsXG4gICAgICAgICAgYWJyQ29udHJvbGxlciA6IEFickNvbnRyb2xsZXIsXG4gICAgICAgICAgbWVkaWFDb250cm9sbGVyOiBNU0VNZWRpYUNvbnRyb2xsZXIsXG4gICAgICAgICAgdGltZWxpbmVDb250cm9sbGVyOiBUaW1lbGluZUNvbnRyb2xsZXIsXG4gICAgICAgICAgZW5hYmxlQ0VBNzA4Q2FwdGlvbnM6IHRydWVcbiAgICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIEhscy5kZWZhdWx0Q29uZmlnO1xuICB9XG5cbiAgc3RhdGljIHNldCBEZWZhdWx0Q29uZmlnKGRlZmF1bHRDb25maWcpIHtcbiAgICBIbHMuZGVmYXVsdENvbmZpZyA9IGRlZmF1bHRDb25maWc7XG4gIH1cblxuICBjb25zdHJ1Y3Rvcihjb25maWcgPSB7fSkge1xuICAgIHZhciBkZWZhdWx0Q29uZmlnID0gSGxzLkRlZmF1bHRDb25maWc7XG4gICAgZm9yICh2YXIgcHJvcCBpbiBkZWZhdWx0Q29uZmlnKSB7XG4gICAgICAgIGlmIChwcm9wIGluIGNvbmZpZykgeyBjb250aW51ZTsgfVxuICAgICAgICBjb25maWdbcHJvcF0gPSBkZWZhdWx0Q29uZmlnW3Byb3BdO1xuICAgIH1cblxuICAgIGlmIChjb25maWcubGl2ZU1heExhdGVuY3lEdXJhdGlvbkNvdW50ICE9PSB1bmRlZmluZWQgJiYgY29uZmlnLmxpdmVNYXhMYXRlbmN5RHVyYXRpb25Db3VudCA8PSBjb25maWcubGl2ZVN5bmNEdXJhdGlvbkNvdW50KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0lsbGVnYWwgaGxzLmpzIGNvbmZpZzogXCJsaXZlTWF4TGF0ZW5jeUR1cmF0aW9uQ291bnRcIiBtdXN0IGJlIGd0IFwibGl2ZVN5bmNEdXJhdGlvbkNvdW50XCInKTtcbiAgICB9XG5cbiAgICBlbmFibGVMb2dzKGNvbmZpZy5kZWJ1Zyk7XG4gICAgdGhpcy5jb25maWcgPSBjb25maWc7XG4gICAgLy8gb2JzZXJ2ZXIgc2V0dXBcbiAgICB2YXIgb2JzZXJ2ZXIgPSB0aGlzLm9ic2VydmVyID0gbmV3IEV2ZW50RW1pdHRlcigpO1xuICAgIG9ic2VydmVyLnRyaWdnZXIgPSBmdW5jdGlvbiB0cmlnZ2VyIChldmVudCwgLi4uZGF0YSkge1xuICAgICAgb2JzZXJ2ZXIuZW1pdChldmVudCwgZXZlbnQsIC4uLmRhdGEpO1xuICAgIH07XG5cbiAgICBvYnNlcnZlci5vZmYgPSBmdW5jdGlvbiBvZmYgKGV2ZW50LCAuLi5kYXRhKSB7XG4gICAgICBvYnNlcnZlci5yZW1vdmVMaXN0ZW5lcihldmVudCwgLi4uZGF0YSk7XG4gICAgfTtcbiAgICB0aGlzLm9uID0gb2JzZXJ2ZXIub24uYmluZChvYnNlcnZlcik7XG4gICAgdGhpcy5vZmYgPSBvYnNlcnZlci5vZmYuYmluZChvYnNlcnZlcik7XG4gICAgdGhpcy50cmlnZ2VyID0gb2JzZXJ2ZXIudHJpZ2dlci5iaW5kKG9ic2VydmVyKTtcbiAgICB0aGlzLnBsYXlsaXN0TG9hZGVyID0gbmV3IFBsYXlsaXN0TG9hZGVyKHRoaXMpO1xuICAgIHRoaXMuZnJhZ21lbnRMb2FkZXIgPSBuZXcgRnJhZ21lbnRMb2FkZXIodGhpcyk7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIgPSBuZXcgTGV2ZWxDb250cm9sbGVyKHRoaXMpO1xuICAgIHRoaXMuYWJyQ29udHJvbGxlciA9IG5ldyBjb25maWcuYWJyQ29udHJvbGxlcih0aGlzKTtcbiAgICB0aGlzLm1lZGlhQ29udHJvbGxlciA9IG5ldyBjb25maWcubWVkaWFDb250cm9sbGVyKHRoaXMpO1xuICAgIHRoaXMudGltZWxpbmVDb250cm9sbGVyID0gbmV3IGNvbmZpZy50aW1lbGluZUNvbnRyb2xsZXIodGhpcyk7XG4gICAgdGhpcy5rZXlMb2FkZXIgPSBuZXcgS2V5TG9hZGVyKHRoaXMpO1xuICAgIC8vdGhpcy5mcHNDb250cm9sbGVyID0gbmV3IEZQU0NvbnRyb2xsZXIodGhpcyk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIGxvZ2dlci5sb2coJ2Rlc3Ryb3knKTtcbiAgICB0aGlzLnRyaWdnZXIoRXZlbnQuREVTVFJPWUlORyk7XG4gICAgdGhpcy5kZXRhY2hNZWRpYSgpO1xuICAgIHRoaXMucGxheWxpc3RMb2FkZXIuZGVzdHJveSgpO1xuICAgIHRoaXMuZnJhZ21lbnRMb2FkZXIuZGVzdHJveSgpO1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLmRlc3Ryb3koKTtcbiAgICB0aGlzLm1lZGlhQ29udHJvbGxlci5kZXN0cm95KCk7XG4gICAgdGhpcy50aW1lbGluZUNvbnRyb2xsZXIuZGVzdHJveSgpO1xuICAgIHRoaXMua2V5TG9hZGVyLmRlc3Ryb3koKTtcbiAgICAvL3RoaXMuZnBzQ29udHJvbGxlci5kZXN0cm95KCk7XG4gICAgdGhpcy51cmwgPSBudWxsO1xuICAgIHRoaXMub2JzZXJ2ZXIucmVtb3ZlQWxsTGlzdGVuZXJzKCk7XG4gIH1cblxuICBhdHRhY2hNZWRpYShtZWRpYSkge1xuICAgIGxvZ2dlci5sb2coJ2F0dGFjaE1lZGlhJyk7XG4gICAgdGhpcy5tZWRpYSA9IG1lZGlhO1xuICAgIHRoaXMudHJpZ2dlcihFdmVudC5NRURJQV9BVFRBQ0hJTkcsIHttZWRpYTogbWVkaWF9KTtcbiAgfVxuXG4gIGRldGFjaE1lZGlhKCkge1xuICAgIGxvZ2dlci5sb2coJ2RldGFjaE1lZGlhJyk7XG4gICAgdGhpcy50cmlnZ2VyKEV2ZW50Lk1FRElBX0RFVEFDSElORyk7XG4gICAgdGhpcy5tZWRpYSA9IG51bGw7XG4gIH1cblxuICBsb2FkU291cmNlKHVybCkge1xuICAgIGxvZ2dlci5sb2coYGxvYWRTb3VyY2U6JHt1cmx9YCk7XG4gICAgdGhpcy51cmwgPSB1cmw7XG4gICAgLy8gd2hlbiBhdHRhY2hpbmcgdG8gYSBzb3VyY2UgVVJMLCB0cmlnZ2VyIGEgcGxheWxpc3QgbG9hZFxuICAgIHRoaXMudHJpZ2dlcihFdmVudC5NQU5JRkVTVF9MT0FESU5HLCB7dXJsOiB1cmx9KTtcbiAgfVxuXG4gIHN0YXJ0TG9hZCgpIHtcbiAgICBsb2dnZXIubG9nKCdzdGFydExvYWQnKTtcbiAgICB0aGlzLm1lZGlhQ29udHJvbGxlci5zdGFydExvYWQoKTtcbiAgfVxuXG4gIHN3YXBBdWRpb0NvZGVjKCkge1xuICAgIGxvZ2dlci5sb2coJ3N3YXBBdWRpb0NvZGVjJyk7XG4gICAgdGhpcy5tZWRpYUNvbnRyb2xsZXIuc3dhcEF1ZGlvQ29kZWMoKTtcbiAgfVxuXG4gIHJlY292ZXJNZWRpYUVycm9yKCkge1xuICAgIGxvZ2dlci5sb2coJ3JlY292ZXJNZWRpYUVycm9yJyk7XG4gICAgdmFyIG1lZGlhID0gdGhpcy5tZWRpYTtcbiAgICB0aGlzLmRldGFjaE1lZGlhKCk7XG4gICAgdGhpcy5hdHRhY2hNZWRpYShtZWRpYSk7XG4gIH1cblxuICAvKiogUmV0dXJuIGFsbCBxdWFsaXR5IGxldmVscyAqKi9cbiAgZ2V0IGxldmVscygpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIubGV2ZWxzO1xuICB9XG5cbiAgLyoqIFJldHVybiBjdXJyZW50IHBsYXliYWNrIHF1YWxpdHkgbGV2ZWwgKiovXG4gIGdldCBjdXJyZW50TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubWVkaWFDb250cm9sbGVyLmN1cnJlbnRMZXZlbDtcbiAgfVxuXG4gIC8qIHNldCBxdWFsaXR5IGxldmVsIGltbWVkaWF0ZWx5ICgtMSBmb3IgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbikgKi9cbiAgc2V0IGN1cnJlbnRMZXZlbChuZXdMZXZlbCkge1xuICAgIGxvZ2dlci5sb2coYHNldCBjdXJyZW50TGV2ZWw6JHtuZXdMZXZlbH1gKTtcbiAgICB0aGlzLmxvYWRMZXZlbCA9IG5ld0xldmVsO1xuICAgIHRoaXMubWVkaWFDb250cm9sbGVyLmltbWVkaWF0ZUxldmVsU3dpdGNoKCk7XG4gIH1cblxuICAvKiogUmV0dXJuIG5leHQgcGxheWJhY2sgcXVhbGl0eSBsZXZlbCAocXVhbGl0eSBsZXZlbCBvZiBuZXh0IGZyYWdtZW50KSAqKi9cbiAgZ2V0IG5leHRMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5tZWRpYUNvbnRyb2xsZXIubmV4dExldmVsO1xuICB9XG5cbiAgLyogc2V0IHF1YWxpdHkgbGV2ZWwgZm9yIG5leHQgZnJhZ21lbnQgKC0xIGZvciBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uKSAqL1xuICBzZXQgbmV4dExldmVsKG5ld0xldmVsKSB7XG4gICAgbG9nZ2VyLmxvZyhgc2V0IG5leHRMZXZlbDoke25ld0xldmVsfWApO1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLm1hbnVhbExldmVsID0gbmV3TGV2ZWw7XG4gICAgdGhpcy5tZWRpYUNvbnRyb2xsZXIubmV4dExldmVsU3dpdGNoKCk7XG4gIH1cblxuICAvKiogUmV0dXJuIHRoZSBxdWFsaXR5IGxldmVsIG9mIGN1cnJlbnQvbGFzdCBsb2FkZWQgZnJhZ21lbnQgKiovXG4gIGdldCBsb2FkTGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLmxldmVsO1xuICB9XG5cbiAgLyogc2V0IHF1YWxpdHkgbGV2ZWwgZm9yIGN1cnJlbnQvbmV4dCBsb2FkZWQgZnJhZ21lbnQgKC0xIGZvciBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uKSAqL1xuICBzZXQgbG9hZExldmVsKG5ld0xldmVsKSB7XG4gICAgbG9nZ2VyLmxvZyhgc2V0IGxvYWRMZXZlbDoke25ld0xldmVsfWApO1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLm1hbnVhbExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICAvKiogUmV0dXJuIHRoZSBxdWFsaXR5IGxldmVsIG9mIG5leHQgbG9hZGVkIGZyYWdtZW50ICoqL1xuICBnZXQgbmV4dExvYWRMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIubmV4dExvYWRMZXZlbCgpO1xuICB9XG5cbiAgLyoqIHNldCBxdWFsaXR5IGxldmVsIG9mIG5leHQgbG9hZGVkIGZyYWdtZW50ICoqL1xuICBzZXQgbmV4dExvYWRMZXZlbChsZXZlbCkge1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLmxldmVsID0gbGV2ZWw7XG4gIH1cblxuICAvKiogUmV0dXJuIGZpcnN0IGxldmVsIChpbmRleCBvZiBmaXJzdCBsZXZlbCByZWZlcmVuY2VkIGluIG1hbmlmZXN0KVxuICAqKi9cbiAgZ2V0IGZpcnN0TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLmZpcnN0TGV2ZWw7XG4gIH1cblxuICAvKiogc2V0IGZpcnN0IGxldmVsIChpbmRleCBvZiBmaXJzdCBsZXZlbCByZWZlcmVuY2VkIGluIG1hbmlmZXN0KVxuICAqKi9cbiAgc2V0IGZpcnN0TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICBsb2dnZXIubG9nKGBzZXQgZmlyc3RMZXZlbDoke25ld0xldmVsfWApO1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLmZpcnN0TGV2ZWwgPSBuZXdMZXZlbDtcbiAgfVxuXG4gIC8qKiBSZXR1cm4gc3RhcnQgbGV2ZWwgKGxldmVsIG9mIGZpcnN0IGZyYWdtZW50IHRoYXQgd2lsbCBiZSBwbGF5ZWQgYmFjaylcbiAgICAgIGlmIG5vdCBvdmVycmlkZWQgYnkgdXNlciwgZmlyc3QgbGV2ZWwgYXBwZWFyaW5nIGluIG1hbmlmZXN0IHdpbGwgYmUgdXNlZCBhcyBzdGFydCBsZXZlbFxuICAgICAgaWYgLTEgOiBhdXRvbWF0aWMgc3RhcnQgbGV2ZWwgc2VsZWN0aW9uLCBwbGF5YmFjayB3aWxsIHN0YXJ0IGZyb20gbGV2ZWwgbWF0Y2hpbmcgZG93bmxvYWQgYmFuZHdpZHRoIChkZXRlcm1pbmVkIGZyb20gZG93bmxvYWQgb2YgZmlyc3Qgc2VnbWVudClcbiAgKiovXG4gIGdldCBzdGFydExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLmxldmVsQ29udHJvbGxlci5zdGFydExldmVsO1xuICB9XG5cbiAgLyoqIHNldCAgc3RhcnQgbGV2ZWwgKGxldmVsIG9mIGZpcnN0IGZyYWdtZW50IHRoYXQgd2lsbCBiZSBwbGF5ZWQgYmFjaylcbiAgICAgIGlmIG5vdCBvdmVycmlkZWQgYnkgdXNlciwgZmlyc3QgbGV2ZWwgYXBwZWFyaW5nIGluIG1hbmlmZXN0IHdpbGwgYmUgdXNlZCBhcyBzdGFydCBsZXZlbFxuICAgICAgaWYgLTEgOiBhdXRvbWF0aWMgc3RhcnQgbGV2ZWwgc2VsZWN0aW9uLCBwbGF5YmFjayB3aWxsIHN0YXJ0IGZyb20gbGV2ZWwgbWF0Y2hpbmcgZG93bmxvYWQgYmFuZHdpZHRoIChkZXRlcm1pbmVkIGZyb20gZG93bmxvYWQgb2YgZmlyc3Qgc2VnbWVudClcbiAgKiovXG4gIHNldCBzdGFydExldmVsKG5ld0xldmVsKSB7XG4gICAgbG9nZ2VyLmxvZyhgc2V0IHN0YXJ0TGV2ZWw6JHtuZXdMZXZlbH1gKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5zdGFydExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICAvKiogUmV0dXJuIHRoZSBjYXBwaW5nL21heCBsZXZlbCB2YWx1ZSB0aGF0IGNvdWxkIGJlIHVzZWQgYnkgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBhbGdvcml0aG0gKiovXG4gIGdldCBhdXRvTGV2ZWxDYXBwaW5nKCkge1xuICAgIHJldHVybiB0aGlzLmFickNvbnRyb2xsZXIuYXV0b0xldmVsQ2FwcGluZztcbiAgfVxuXG4gIC8qKiBzZXQgdGhlIGNhcHBpbmcvbWF4IGxldmVsIHZhbHVlIHRoYXQgY291bGQgYmUgdXNlZCBieSBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uIGFsZ29yaXRobSAqKi9cbiAgc2V0IGF1dG9MZXZlbENhcHBpbmcobmV3TGV2ZWwpIHtcbiAgICBsb2dnZXIubG9nKGBzZXQgYXV0b0xldmVsQ2FwcGluZzoke25ld0xldmVsfWApO1xuICAgIHRoaXMuYWJyQ29udHJvbGxlci5hdXRvTGV2ZWxDYXBwaW5nID0gbmV3TGV2ZWw7XG4gIH1cblxuICAvKiBjaGVjayBpZiB3ZSBhcmUgaW4gYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBtb2RlICovXG4gIGdldCBhdXRvTGV2ZWxFbmFibGVkKCkge1xuICAgIHJldHVybiAodGhpcy5sZXZlbENvbnRyb2xsZXIubWFudWFsTGV2ZWwgPT09IC0xKTtcbiAgfVxuXG4gIC8qIHJldHVybiBtYW51YWwgbGV2ZWwgKi9cbiAgZ2V0IG1hbnVhbExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLmxldmVsQ29udHJvbGxlci5tYW51YWxMZXZlbDtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBIbHM7XG4iLCIvKlxuICogRnJhZ21lbnQgTG9hZGVyXG4qL1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBFdmVudEhhbmRsZXIgZnJvbSAnLi4vZXZlbnQtaGFuZGxlcic7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcblxuY2xhc3MgRnJhZ21lbnRMb2FkZXIgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHN1cGVyKGhscywgRXZlbnQuRlJBR19MT0FESU5HKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgaWYgKHRoaXMubG9hZGVyKSB7XG4gICAgICB0aGlzLmxvYWRlci5kZXN0cm95KCk7XG4gICAgICB0aGlzLmxvYWRlciA9IG51bGw7XG4gICAgfVxuICAgIEV2ZW50SGFuZGxlci5wcm90b3R5cGUuZGVzdHJveS5jYWxsKHRoaXMpO1xuICB9XG5cbiAgb25GcmFnTG9hZGluZyhkYXRhKSB7XG4gICAgdmFyIGZyYWcgPSBkYXRhLmZyYWc7XG4gICAgdGhpcy5mcmFnID0gZnJhZztcbiAgICB0aGlzLmZyYWcubG9hZGVkID0gMDtcbiAgICB2YXIgY29uZmlnID0gdGhpcy5obHMuY29uZmlnO1xuICAgIGZyYWcubG9hZGVyID0gdGhpcy5sb2FkZXIgPSB0eXBlb2YoY29uZmlnLmZMb2FkZXIpICE9PSAndW5kZWZpbmVkJyA/IG5ldyBjb25maWcuZkxvYWRlcihjb25maWcpIDogbmV3IGNvbmZpZy5sb2FkZXIoY29uZmlnKTtcbiAgICB0aGlzLmxvYWRlci5sb2FkKGZyYWcudXJsLCAnYXJyYXlidWZmZXInLCB0aGlzLmxvYWRzdWNjZXNzLmJpbmQodGhpcyksIHRoaXMubG9hZGVycm9yLmJpbmQodGhpcyksIHRoaXMubG9hZHRpbWVvdXQuYmluZCh0aGlzKSwgY29uZmlnLmZyYWdMb2FkaW5nVGltZU91dCwgMSwgMCwgdGhpcy5sb2FkcHJvZ3Jlc3MuYmluZCh0aGlzKSwgZnJhZyk7XG4gIH1cblxuICBsb2Fkc3VjY2VzcyhldmVudCwgc3RhdHMpIHtcbiAgICB2YXIgcGF5bG9hZCA9IGV2ZW50LmN1cnJlbnRUYXJnZXQucmVzcG9uc2U7XG4gICAgc3RhdHMubGVuZ3RoID0gcGF5bG9hZC5ieXRlTGVuZ3RoO1xuICAgIC8vIGRldGFjaCBmcmFnbWVudCBsb2FkZXIgb24gbG9hZCBzdWNjZXNzXG4gICAgdGhpcy5mcmFnLmxvYWRlciA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkZSQUdfTE9BREVELCB7cGF5bG9hZDogcGF5bG9hZCwgZnJhZzogdGhpcy5mcmFnLCBzdGF0czogc3RhdHN9KTtcbiAgfVxuXG4gIGxvYWRlcnJvcihldmVudCkge1xuICAgIHRoaXMubG9hZGVyLmFib3J0KCk7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTkVUV09SS19FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9FUlJPUiwgZmF0YWw6IGZhbHNlLCBmcmFnOiB0aGlzLmZyYWcsIHJlc3BvbnNlOiBldmVudH0pO1xuICB9XG5cbiAgbG9hZHRpbWVvdXQoKSB7XG4gICAgdGhpcy5sb2FkZXIuYWJvcnQoKTtcbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5ORVRXT1JLX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuRlJBR19MT0FEX1RJTUVPVVQsIGZhdGFsOiBmYWxzZSwgZnJhZzogdGhpcy5mcmFnfSk7XG4gIH1cblxuICBsb2FkcHJvZ3Jlc3MoZXZlbnQsIHN0YXRzKSB7XG4gICAgdGhpcy5mcmFnLmxvYWRlZCA9IHN0YXRzLmxvYWRlZDtcbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkZSQUdfTE9BRF9QUk9HUkVTUywge2ZyYWc6IHRoaXMuZnJhZywgc3RhdHM6IHN0YXRzfSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRnJhZ21lbnRMb2FkZXI7XG4iLCIvKlxuICogRGVjcnlwdCBrZXkgTG9hZGVyXG4qL1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBFdmVudEhhbmRsZXIgZnJvbSAnLi4vZXZlbnQtaGFuZGxlcic7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcblxuY2xhc3MgS2V5TG9hZGVyIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMpIHtcbiAgICBzdXBlcihobHMsIEV2ZW50LktFWV9MT0FESU5HKTtcbiAgICB0aGlzLmRlY3J5cHRrZXkgPSBudWxsO1xuICAgIHRoaXMuZGVjcnlwdHVybCA9IG51bGw7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIGlmICh0aGlzLmxvYWRlcikge1xuICAgICAgdGhpcy5sb2FkZXIuZGVzdHJveSgpO1xuICAgICAgdGhpcy5sb2FkZXIgPSBudWxsO1xuICAgIH1cbiAgICBFdmVudEhhbmRsZXIucHJvdG90eXBlLmRlc3Ryb3kuY2FsbCh0aGlzKTtcbiAgfVxuXG4gIG9uS2V5TG9hZGluZyhkYXRhKSB7XG4gICAgdmFyIGZyYWcgPSB0aGlzLmZyYWcgPSBkYXRhLmZyYWcsXG4gICAgICAgIGRlY3J5cHRkYXRhID0gZnJhZy5kZWNyeXB0ZGF0YSxcbiAgICAgICAgdXJpID0gZGVjcnlwdGRhdGEudXJpO1xuICAgICAgICAvLyBpZiB1cmkgaXMgZGlmZmVyZW50IGZyb20gcHJldmlvdXMgb25lIG9yIGlmIGRlY3J5cHQga2V5IG5vdCByZXRyaWV2ZWQgeWV0XG4gICAgICBpZiAodXJpICE9PSB0aGlzLmRlY3J5cHR1cmwgfHwgdGhpcy5kZWNyeXB0a2V5ID09PSBudWxsKSB7XG4gICAgICAgIHZhciBjb25maWcgPSB0aGlzLmhscy5jb25maWc7XG4gICAgICAgIGZyYWcubG9hZGVyID0gdGhpcy5sb2FkZXIgPSBuZXcgY29uZmlnLmxvYWRlcihjb25maWcpO1xuICAgICAgICB0aGlzLmRlY3J5cHR1cmwgPSB1cmk7XG4gICAgICAgIHRoaXMuZGVjcnlwdGtleSA9IG51bGw7XG4gICAgICAgIGZyYWcubG9hZGVyLmxvYWQodXJpLCAnYXJyYXlidWZmZXInLCB0aGlzLmxvYWRzdWNjZXNzLmJpbmQodGhpcyksIHRoaXMubG9hZGVycm9yLmJpbmQodGhpcyksIHRoaXMubG9hZHRpbWVvdXQuYmluZCh0aGlzKSwgY29uZmlnLmZyYWdMb2FkaW5nVGltZU91dCwgY29uZmlnLmZyYWdMb2FkaW5nTWF4UmV0cnksIGNvbmZpZy5mcmFnTG9hZGluZ1JldHJ5RGVsYXksIHRoaXMubG9hZHByb2dyZXNzLmJpbmQodGhpcyksIGZyYWcpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLmRlY3J5cHRrZXkpIHtcbiAgICAgICAgLy8gd2UgYWxyZWFkeSBsb2FkZWQgdGhpcyBrZXksIHJldHVybiBpdFxuICAgICAgICBkZWNyeXB0ZGF0YS5rZXkgPSB0aGlzLmRlY3J5cHRrZXk7XG4gICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuS0VZX0xPQURFRCwge2ZyYWc6IGZyYWd9KTtcbiAgICAgIH1cbiAgfVxuXG4gIGxvYWRzdWNjZXNzKGV2ZW50KSB7XG4gICAgdmFyIGZyYWcgPSB0aGlzLmZyYWc7XG4gICAgdGhpcy5kZWNyeXB0a2V5ID0gZnJhZy5kZWNyeXB0ZGF0YS5rZXkgPSBuZXcgVWludDhBcnJheShldmVudC5jdXJyZW50VGFyZ2V0LnJlc3BvbnNlKTtcbiAgICAvLyBkZXRhY2ggZnJhZ21lbnQgbG9hZGVyIG9uIGxvYWQgc3VjY2Vzc1xuICAgIGZyYWcubG9hZGVyID0gdW5kZWZpbmVkO1xuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuS0VZX0xPQURFRCwge2ZyYWc6IGZyYWd9KTtcbiAgfVxuXG4gIGxvYWRlcnJvcihldmVudCkge1xuICAgIHRoaXMubG9hZGVyLmFib3J0KCk7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTkVUV09SS19FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLktFWV9MT0FEX0VSUk9SLCBmYXRhbDogZmFsc2UsIGZyYWc6IHRoaXMuZnJhZywgcmVzcG9uc2U6IGV2ZW50fSk7XG4gIH1cblxuICBsb2FkdGltZW91dCgpIHtcbiAgICB0aGlzLmxvYWRlci5hYm9ydCgpO1xuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5LRVlfTE9BRF9USU1FT1VULCBmYXRhbDogZmFsc2UsIGZyYWc6IHRoaXMuZnJhZ30pO1xuICB9XG5cbiAgbG9hZHByb2dyZXNzKCkge1xuXG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgS2V5TG9hZGVyO1xuIiwiLyoqXG4gKiBQbGF5bGlzdCBMb2FkZXJcbiovXG5cbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IEV2ZW50SGFuZGxlciBmcm9tICcuLi9ldmVudC1oYW5kbGVyJztcbmltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuaW1wb3J0IFVSTEhlbHBlciBmcm9tICcuLi91dGlscy91cmwnO1xuaW1wb3J0IEF0dHJMaXN0IGZyb20gJy4uL3V0aWxzL2F0dHItbGlzdCc7XG4vL2ltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG5jbGFzcyBQbGF5bGlzdExvYWRlciBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgc3VwZXIoaGxzLFxuICAgICAgRXZlbnQuTUFOSUZFU1RfTE9BRElORyxcbiAgICAgIEV2ZW50LkxFVkVMX0xPQURJTkcpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBpZiAodGhpcy5sb2FkZXIpIHtcbiAgICAgIHRoaXMubG9hZGVyLmRlc3Ryb3koKTtcbiAgICAgIHRoaXMubG9hZGVyID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy51cmwgPSB0aGlzLmlkID0gbnVsbDtcbiAgICBFdmVudEhhbmRsZXIucHJvdG90eXBlLmRlc3Ryb3kuY2FsbCh0aGlzKTtcbiAgfVxuXG4gIG9uTWFuaWZlc3RMb2FkaW5nKGRhdGEpIHtcbiAgICB0aGlzLmxvYWQoZGF0YS51cmwsIG51bGwpO1xuICB9XG5cbiAgb25MZXZlbExvYWRpbmcoZGF0YSkge1xuICAgIHRoaXMubG9hZChkYXRhLnVybCwgZGF0YS5sZXZlbCwgZGF0YS5pZCk7XG4gIH1cblxuICBsb2FkKHVybCwgaWQxLCBpZDIpIHtcbiAgICB2YXIgY29uZmlnID0gdGhpcy5obHMuY29uZmlnLFxuICAgICAgICByZXRyeSxcbiAgICAgICAgdGltZW91dCxcbiAgICAgICAgcmV0cnlEZWxheTtcbiAgICB0aGlzLnVybCA9IHVybDtcbiAgICB0aGlzLmlkID0gaWQxO1xuICAgIHRoaXMuaWQyID0gaWQyO1xuICAgIGlmKHRoaXMuaWQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0cnkgPSBjb25maWcubWFuaWZlc3RMb2FkaW5nTWF4UmV0cnk7XG4gICAgICB0aW1lb3V0ID0gY29uZmlnLm1hbmlmZXN0TG9hZGluZ1RpbWVPdXQ7XG4gICAgICByZXRyeURlbGF5ID0gY29uZmlnLm1hbmlmZXN0TG9hZGluZ1JldHJ5RGVsYXk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHJ5ID0gY29uZmlnLmxldmVsTG9hZGluZ01heFJldHJ5O1xuICAgICAgdGltZW91dCA9IGNvbmZpZy5sZXZlbExvYWRpbmdUaW1lT3V0O1xuICAgICAgcmV0cnlEZWxheSA9IGNvbmZpZy5sZXZlbExvYWRpbmdSZXRyeURlbGF5O1xuICAgIH1cbiAgICB0aGlzLmxvYWRlciA9IHR5cGVvZihjb25maWcucExvYWRlcikgIT09ICd1bmRlZmluZWQnID8gbmV3IGNvbmZpZy5wTG9hZGVyKGNvbmZpZykgOiBuZXcgY29uZmlnLmxvYWRlcihjb25maWcpO1xuICAgIHRoaXMubG9hZGVyLmxvYWQodXJsLCAnJywgdGhpcy5sb2Fkc3VjY2Vzcy5iaW5kKHRoaXMpLCB0aGlzLmxvYWRlcnJvci5iaW5kKHRoaXMpLCB0aGlzLmxvYWR0aW1lb3V0LmJpbmQodGhpcyksIHRpbWVvdXQsIHJldHJ5LCByZXRyeURlbGF5KTtcbiAgfVxuXG4gIHJlc29sdmUodXJsLCBiYXNlVXJsKSB7XG4gICAgcmV0dXJuIFVSTEhlbHBlci5idWlsZEFic29sdXRlVVJMKGJhc2VVcmwsIHVybCk7XG4gIH1cblxuICBwYXJzZU1hc3RlclBsYXlsaXN0KHN0cmluZywgYmFzZXVybCkge1xuICAgIGxldCBsZXZlbHMgPSBbXSwgcmVzdWx0O1xuXG4gICAgLy8gaHR0cHM6Ly9yZWdleDEwMS5jb20gaXMgeW91ciBmcmllbmRcbiAgICBjb25zdCByZSA9IC8jRVhULVgtU1RSRUFNLUlORjooW15cXG5cXHJdKilbXFxyXFxuXSsoW15cXHJcXG5dKykvZztcbiAgICB3aGlsZSAoKHJlc3VsdCA9IHJlLmV4ZWMoc3RyaW5nKSkgIT0gbnVsbCl7XG4gICAgICBjb25zdCBsZXZlbCA9IHt9O1xuXG4gICAgICB2YXIgYXR0cnMgPSBsZXZlbC5hdHRycyA9IG5ldyBBdHRyTGlzdChyZXN1bHRbMV0pO1xuICAgICAgbGV2ZWwudXJsID0gdGhpcy5yZXNvbHZlKHJlc3VsdFsyXSwgYmFzZXVybCk7XG5cbiAgICAgIHZhciByZXNvbHV0aW9uID0gYXR0cnMuZGVjaW1hbFJlc29sdXRpb24oJ1JFU09MVVRJT04nKTtcbiAgICAgIGlmKHJlc29sdXRpb24pIHtcbiAgICAgICAgbGV2ZWwud2lkdGggPSByZXNvbHV0aW9uLndpZHRoO1xuICAgICAgICBsZXZlbC5oZWlnaHQgPSByZXNvbHV0aW9uLmhlaWdodDtcbiAgICAgIH1cbiAgICAgIGxldmVsLmJpdHJhdGUgPSBhdHRycy5kZWNpbWFsSW50ZWdlcignQkFORFdJRFRIJyk7XG4gICAgICBsZXZlbC5uYW1lID0gYXR0cnMuTkFNRTtcblxuICAgICAgdmFyIGNvZGVjcyA9IGF0dHJzLkNPREVDUztcbiAgICAgIGlmKGNvZGVjcykge1xuICAgICAgICBjb2RlY3MgPSBjb2RlY3Muc3BsaXQoJywnKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb2RlY3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBjb25zdCBjb2RlYyA9IGNvZGVjc1tpXTtcbiAgICAgICAgICBpZiAoY29kZWMuaW5kZXhPZignYXZjMScpICE9PSAtMSkge1xuICAgICAgICAgICAgbGV2ZWwudmlkZW9Db2RlYyA9IHRoaXMuYXZjMXRvYXZjb3RpKGNvZGVjKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGV2ZWwuYXVkaW9Db2RlYyA9IGNvZGVjO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBsZXZlbHMucHVzaChsZXZlbCk7XG4gICAgfVxuICAgIHJldHVybiBsZXZlbHM7XG4gIH1cblxuICBhdmMxdG9hdmNvdGkoY29kZWMpIHtcbiAgICB2YXIgcmVzdWx0LCBhdmNkYXRhID0gY29kZWMuc3BsaXQoJy4nKTtcbiAgICBpZiAoYXZjZGF0YS5sZW5ndGggPiAyKSB7XG4gICAgICByZXN1bHQgPSBhdmNkYXRhLnNoaWZ0KCkgKyAnLic7XG4gICAgICByZXN1bHQgKz0gcGFyc2VJbnQoYXZjZGF0YS5zaGlmdCgpKS50b1N0cmluZygxNik7XG4gICAgICByZXN1bHQgKz0gKCcwMDAnICsgcGFyc2VJbnQoYXZjZGF0YS5zaGlmdCgpKS50b1N0cmluZygxNikpLnN1YnN0cigtNCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdCA9IGNvZGVjO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgY2xvbmVPYmoob2JqKSB7XG4gICAgcmV0dXJuIEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkob2JqKSk7XG4gIH1cblxuICBwYXJzZUxldmVsUGxheWxpc3Qoc3RyaW5nLCBiYXNldXJsLCBpZCkge1xuICAgIHZhciBjdXJyZW50U04gPSAwLFxuICAgICAgICB0b3RhbGR1cmF0aW9uID0gMCxcbiAgICAgICAgbGV2ZWwgPSB7dXJsOiBiYXNldXJsLCBmcmFnbWVudHM6IFtdLCBsaXZlOiB0cnVlLCBzdGFydFNOOiAwfSxcbiAgICAgICAgbGV2ZWxrZXkgPSB7bWV0aG9kIDogbnVsbCwga2V5IDogbnVsbCwgaXYgOiBudWxsLCB1cmkgOiBudWxsfSxcbiAgICAgICAgY2MgPSAwLFxuICAgICAgICBwcm9ncmFtRGF0ZVRpbWUgPSBudWxsLFxuICAgICAgICBmcmFnID0gbnVsbCxcbiAgICAgICAgcmVzdWx0LFxuICAgICAgICByZWdleHAsXG4gICAgICAgIGJ5dGVSYW5nZUVuZE9mZnNldCxcbiAgICAgICAgYnl0ZVJhbmdlU3RhcnRPZmZzZXQ7XG5cbiAgICByZWdleHAgPSAvKD86I0VYVC1YLShNRURJQS1TRVFVRU5DRSk6KFxcZCspKXwoPzojRVhULVgtKFRBUkdFVERVUkFUSU9OKTooXFxkKykpfCg/OiNFWFQtWC0oS0VZKTooLiopKXwoPzojRVhUKElORik6KFtcXGRcXC5dKylbXlxcclxcbl0qKFtcXHJcXG5dK1teI3xcXHJcXG5dKyk/KXwoPzojRVhULVgtKEJZVEVSQU5HRSk6KFtcXGRdK1tAW1xcZF0qKV0qW1xcclxcbl0rKFteI3xcXHJcXG5dKyk/fCg/OiNFWFQtWC0oRU5ETElTVCkpfCg/OiNFWFQtWC0oRElTKUNPTlRJTlVJVFkpKXwoPzojRVhULVgtKFBST0dSQU0tREFURS1USU1FKTooLiopKS9nO1xuICAgIHdoaWxlICgocmVzdWx0ID0gcmVnZXhwLmV4ZWMoc3RyaW5nKSkgIT09IG51bGwpIHtcbiAgICAgIHJlc3VsdC5zaGlmdCgpO1xuICAgICAgcmVzdWx0ID0gcmVzdWx0LmZpbHRlcihmdW5jdGlvbihuKSB7IHJldHVybiAobiAhPT0gdW5kZWZpbmVkKTsgfSk7XG4gICAgICBzd2l0Y2ggKHJlc3VsdFswXSkge1xuICAgICAgICBjYXNlICdNRURJQS1TRVFVRU5DRSc6XG4gICAgICAgICAgY3VycmVudFNOID0gbGV2ZWwuc3RhcnRTTiA9IHBhcnNlSW50KHJlc3VsdFsxXSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ1RBUkdFVERVUkFUSU9OJzpcbiAgICAgICAgICBsZXZlbC50YXJnZXRkdXJhdGlvbiA9IHBhcnNlRmxvYXQocmVzdWx0WzFdKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnRU5ETElTVCc6XG4gICAgICAgICAgbGV2ZWwubGl2ZSA9IGZhbHNlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdESVMnOlxuICAgICAgICAgIGNjKys7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0JZVEVSQU5HRSc6XG4gICAgICAgICAgdmFyIHBhcmFtcyA9IHJlc3VsdFsxXS5zcGxpdCgnQCcpO1xuICAgICAgICAgIGlmIChwYXJhbXMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgICBieXRlUmFuZ2VTdGFydE9mZnNldCA9IGJ5dGVSYW5nZUVuZE9mZnNldDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYnl0ZVJhbmdlU3RhcnRPZmZzZXQgPSBwYXJzZUludChwYXJhbXNbMV0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBieXRlUmFuZ2VFbmRPZmZzZXQgPSBwYXJzZUludChwYXJhbXNbMF0pICsgYnl0ZVJhbmdlU3RhcnRPZmZzZXQ7XG4gICAgICAgICAgaWYgKGZyYWcgJiYgIWZyYWcudXJsKSB7XG4gICAgICAgICAgICBmcmFnLmJ5dGVSYW5nZVN0YXJ0T2Zmc2V0ID0gYnl0ZVJhbmdlU3RhcnRPZmZzZXQ7XG4gICAgICAgICAgICBmcmFnLmJ5dGVSYW5nZUVuZE9mZnNldCA9IGJ5dGVSYW5nZUVuZE9mZnNldDtcbiAgICAgICAgICAgIGZyYWcudXJsID0gdGhpcy5yZXNvbHZlKHJlc3VsdFsyXSwgYmFzZXVybCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdJTkYnOlxuICAgICAgICAgIHZhciBkdXJhdGlvbiA9IHBhcnNlRmxvYXQocmVzdWx0WzFdKTtcbiAgICAgICAgICBpZiAoIWlzTmFOKGR1cmF0aW9uKSkge1xuICAgICAgICAgICAgdmFyIGZyYWdkZWNyeXB0ZGF0YSxcbiAgICAgICAgICAgICAgICBzbiA9IGN1cnJlbnRTTisrO1xuICAgICAgICAgICAgaWYgKGxldmVsa2V5Lm1ldGhvZCAmJiBsZXZlbGtleS51cmkgJiYgIWxldmVsa2V5Lml2KSB7XG4gICAgICAgICAgICAgIGZyYWdkZWNyeXB0ZGF0YSA9IHRoaXMuY2xvbmVPYmoobGV2ZWxrZXkpO1xuICAgICAgICAgICAgICB2YXIgdWludDhWaWV3ID0gbmV3IFVpbnQ4QXJyYXkoMTYpO1xuICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMTI7IGkgPCAxNjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdWludDhWaWV3W2ldID0gKHNuID4+IDgqKDE1LWkpKSAmIDB4ZmY7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZnJhZ2RlY3J5cHRkYXRhLml2ID0gdWludDhWaWV3O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgZnJhZ2RlY3J5cHRkYXRhID0gbGV2ZWxrZXk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgdXJsID0gcmVzdWx0WzJdID8gdGhpcy5yZXNvbHZlKHJlc3VsdFsyXSwgYmFzZXVybCkgOiBudWxsO1xuICAgICAgICAgICAgZnJhZyA9IHt1cmw6IHVybCwgZHVyYXRpb246IGR1cmF0aW9uLCBzdGFydDogdG90YWxkdXJhdGlvbiwgc246IHNuLCBsZXZlbDogaWQsIGNjOiBjYywgYnl0ZVJhbmdlU3RhcnRPZmZzZXQ6IGJ5dGVSYW5nZVN0YXJ0T2Zmc2V0LCBieXRlUmFuZ2VFbmRPZmZzZXQ6IGJ5dGVSYW5nZUVuZE9mZnNldCwgZGVjcnlwdGRhdGEgOiBmcmFnZGVjcnlwdGRhdGEsIHByb2dyYW1EYXRlVGltZTogcHJvZ3JhbURhdGVUaW1lfTtcbiAgICAgICAgICAgIGxldmVsLmZyYWdtZW50cy5wdXNoKGZyYWcpO1xuICAgICAgICAgICAgdG90YWxkdXJhdGlvbiArPSBkdXJhdGlvbjtcbiAgICAgICAgICAgIGJ5dGVSYW5nZVN0YXJ0T2Zmc2V0ID0gbnVsbDtcbiAgICAgICAgICAgIHByb2dyYW1EYXRlVGltZSA9IG51bGw7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdLRVknOlxuICAgICAgICAgIC8vIGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9kcmFmdC1wYW50b3MtaHR0cC1saXZlLXN0cmVhbWluZy0wOCNzZWN0aW9uLTMuNC40XG4gICAgICAgICAgdmFyIGRlY3J5cHRwYXJhbXMgPSByZXN1bHRbMV07XG4gICAgICAgICAgdmFyIGtleUF0dHJzID0gbmV3IEF0dHJMaXN0KGRlY3J5cHRwYXJhbXMpO1xuICAgICAgICAgIHZhciBkZWNyeXB0bWV0aG9kID0ga2V5QXR0cnMuZW51bWVyYXRlZFN0cmluZygnTUVUSE9EJyksXG4gICAgICAgICAgICAgIGRlY3J5cHR1cmkgPSBrZXlBdHRycy5VUkksXG4gICAgICAgICAgICAgIGRlY3J5cHRpdiA9IGtleUF0dHJzLmhleGFkZWNpbWFsSW50ZWdlcignSVYnKTtcbiAgICAgICAgICBpZiAoZGVjcnlwdG1ldGhvZCkge1xuICAgICAgICAgICAgbGV2ZWxrZXkgPSB7IG1ldGhvZDogbnVsbCwga2V5OiBudWxsLCBpdjogbnVsbCwgdXJpOiBudWxsIH07XG4gICAgICAgICAgICBpZiAoKGRlY3J5cHR1cmkpICYmIChkZWNyeXB0bWV0aG9kID09PSAnQUVTLTEyOCcpKSB7XG4gICAgICAgICAgICAgIGxldmVsa2V5Lm1ldGhvZCA9IGRlY3J5cHRtZXRob2Q7XG4gICAgICAgICAgICAgIC8vIFVSSSB0byBnZXQgdGhlIGtleVxuICAgICAgICAgICAgICBsZXZlbGtleS51cmkgPSB0aGlzLnJlc29sdmUoZGVjcnlwdHVyaSwgYmFzZXVybCk7XG4gICAgICAgICAgICAgIGxldmVsa2V5LmtleSA9IG51bGw7XG4gICAgICAgICAgICAgIC8vIEluaXRpYWxpemF0aW9uIFZlY3RvciAoSVYpXG4gICAgICAgICAgICAgIGxldmVsa2V5Lml2ID0gZGVjcnlwdGl2O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnUFJPR1JBTS1EQVRFLVRJTUUnOlxuICAgICAgICAgIHByb2dyYW1EYXRlVGltZSA9IG5ldyBEYXRlKERhdGUucGFyc2UocmVzdWx0WzFdKSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIC8vbG9nZ2VyLmxvZygnZm91bmQgJyArIGxldmVsLmZyYWdtZW50cy5sZW5ndGggKyAnIGZyYWdtZW50cycpO1xuICAgIGlmKGZyYWcgJiYgIWZyYWcudXJsKSB7XG4gICAgICBsZXZlbC5mcmFnbWVudHMucG9wKCk7XG4gICAgICB0b3RhbGR1cmF0aW9uLT1mcmFnLmR1cmF0aW9uO1xuICAgIH1cbiAgICBsZXZlbC50b3RhbGR1cmF0aW9uID0gdG90YWxkdXJhdGlvbjtcbiAgICBsZXZlbC5lbmRTTiA9IGN1cnJlbnRTTiAtIDE7XG4gICAgcmV0dXJuIGxldmVsO1xuICB9XG5cbiAgbG9hZHN1Y2Nlc3MoZXZlbnQsIHN0YXRzKSB7XG4gICAgdmFyIHRhcmdldCA9IGV2ZW50LmN1cnJlbnRUYXJnZXQsXG4gICAgICAgIHN0cmluZyA9IHRhcmdldC5yZXNwb25zZVRleHQsXG4gICAgICAgIHVybCA9IHRhcmdldC5yZXNwb25zZVVSTCxcbiAgICAgICAgaWQgPSB0aGlzLmlkLFxuICAgICAgICBpZDIgPSB0aGlzLmlkMixcbiAgICAgICAgaGxzID0gdGhpcy5obHMsXG4gICAgICAgIGxldmVscztcbiAgICAvLyByZXNwb25zZVVSTCBub3Qgc3VwcG9ydGVkIG9uIHNvbWUgYnJvd3NlcnMgKGl0IGlzIHVzZWQgdG8gZGV0ZWN0IFVSTCByZWRpcmVjdGlvbilcbiAgICBpZiAodXJsID09PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIGZhbGxiYWNrIHRvIGluaXRpYWwgVVJMXG4gICAgICB1cmwgPSB0aGlzLnVybDtcbiAgICB9XG4gICAgc3RhdHMudGxvYWQgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICBzdGF0cy5tdGltZSA9IG5ldyBEYXRlKHRhcmdldC5nZXRSZXNwb25zZUhlYWRlcignTGFzdC1Nb2RpZmllZCcpKTtcbiAgICBpZiAoc3RyaW5nLmluZGV4T2YoJyNFWFRNM1UnKSA9PT0gMCkge1xuICAgICAgaWYgKHN0cmluZy5pbmRleE9mKCcjRVhUSU5GOicpID4gMCkge1xuICAgICAgICAvLyAxIGxldmVsIHBsYXlsaXN0XG4gICAgICAgIC8vIGlmIGZpcnN0IHJlcXVlc3QsIGZpcmUgbWFuaWZlc3QgbG9hZGVkIGV2ZW50LCBsZXZlbCB3aWxsIGJlIHJlbG9hZGVkIGFmdGVyd2FyZHNcbiAgICAgICAgLy8gKHRoaXMgaXMgdG8gaGF2ZSBhIHVuaWZvcm0gbG9naWMgZm9yIDEgbGV2ZWwvbXVsdGlsZXZlbCBwbGF5bGlzdHMpXG4gICAgICAgIGlmICh0aGlzLmlkID09PSBudWxsKSB7XG4gICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuTUFOSUZFU1RfTE9BREVELCB7bGV2ZWxzOiBbe3VybDogdXJsfV0sIHVybDogdXJsLCBzdGF0czogc3RhdHN9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YXIgbGV2ZWxEZXRhaWxzID0gdGhpcy5wYXJzZUxldmVsUGxheWxpc3Qoc3RyaW5nLCB1cmwsIGlkKTtcbiAgICAgICAgICBzdGF0cy50cGFyc2VkID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuTEVWRUxfTE9BREVELCB7ZGV0YWlsczogbGV2ZWxEZXRhaWxzLCBsZXZlbDogaWQsIGlkOiBpZDIsIHN0YXRzOiBzdGF0c30pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsZXZlbHMgPSB0aGlzLnBhcnNlTWFzdGVyUGxheWxpc3Qoc3RyaW5nLCB1cmwpO1xuICAgICAgICAvLyBtdWx0aSBsZXZlbCBwbGF5bGlzdCwgcGFyc2UgbGV2ZWwgaW5mb1xuICAgICAgICBpZiAobGV2ZWxzLmxlbmd0aCkge1xuICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50Lk1BTklGRVNUX0xPQURFRCwge2xldmVsczogbGV2ZWxzLCB1cmw6IHVybCwgc3RhdHM6IHN0YXRzfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5NQU5JRkVTVF9QQVJTSU5HX0VSUk9SLCBmYXRhbDogdHJ1ZSwgdXJsOiB1cmwsIHJlYXNvbjogJ25vIGxldmVsIGZvdW5kIGluIG1hbmlmZXN0J30pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5ORVRXT1JLX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuTUFOSUZFU1RfUEFSU0lOR19FUlJPUiwgZmF0YWw6IHRydWUsIHVybDogdXJsLCByZWFzb246ICdubyBFWFRNM1UgZGVsaW1pdGVyJ30pO1xuICAgIH1cbiAgfVxuXG4gIGxvYWRlcnJvcihldmVudCkge1xuICAgIHZhciBkZXRhaWxzLCBmYXRhbDtcbiAgICBpZiAodGhpcy5pZCA9PT0gbnVsbCkge1xuICAgICAgZGV0YWlscyA9IEVycm9yRGV0YWlscy5NQU5JRkVTVF9MT0FEX0VSUk9SO1xuICAgICAgZmF0YWwgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBkZXRhaWxzID0gRXJyb3JEZXRhaWxzLkxFVkVMX0xPQURfRVJST1I7XG4gICAgICBmYXRhbCA9IGZhbHNlO1xuICAgIH1cbiAgICB0aGlzLmxvYWRlci5hYm9ydCgpO1xuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHM6IGRldGFpbHMsIGZhdGFsOiBmYXRhbCwgdXJsOiB0aGlzLnVybCwgbG9hZGVyOiB0aGlzLmxvYWRlciwgcmVzcG9uc2U6IGV2ZW50LmN1cnJlbnRUYXJnZXQsIGxldmVsOiB0aGlzLmlkLCBpZDogdGhpcy5pZDJ9KTtcbiAgfVxuXG4gIGxvYWR0aW1lb3V0KCkge1xuICAgIHZhciBkZXRhaWxzLCBmYXRhbDtcbiAgICBpZiAodGhpcy5pZCA9PT0gbnVsbCkge1xuICAgICAgZGV0YWlscyA9IEVycm9yRGV0YWlscy5NQU5JRkVTVF9MT0FEX1RJTUVPVVQ7XG4gICAgICBmYXRhbCA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGRldGFpbHMgPSBFcnJvckRldGFpbHMuTEVWRUxfTE9BRF9USU1FT1VUO1xuICAgICAgZmF0YWwgPSBmYWxzZTtcbiAgICB9XG4gICB0aGlzLmxvYWRlci5hYm9ydCgpO1xuICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTkVUV09SS19FUlJPUiwgZGV0YWlsczogZGV0YWlscywgZmF0YWw6IGZhdGFsLCB1cmw6IHRoaXMudXJsLCBsb2FkZXI6IHRoaXMubG9hZGVyLCBsZXZlbDogdGhpcy5pZCwgaWQ6IHRoaXMuaWQyfSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgUGxheWxpc3RMb2FkZXI7XG4iLCIvKipcbiAqIEdlbmVyYXRlIE1QNCBCb3hcbiovXG5cbi8vaW1wb3J0IEhleCBmcm9tICcuLi91dGlscy9oZXgnO1xuY2xhc3MgTVA0IHtcbiAgc3RhdGljIGluaXQoKSB7XG4gICAgTVA0LnR5cGVzID0ge1xuICAgICAgYXZjMTogW10sIC8vIGNvZGluZ25hbWVcbiAgICAgIGF2Y0M6IFtdLFxuICAgICAgYnRydDogW10sXG4gICAgICBkaW5mOiBbXSxcbiAgICAgIGRyZWY6IFtdLFxuICAgICAgZXNkczogW10sXG4gICAgICBmdHlwOiBbXSxcbiAgICAgIGhkbHI6IFtdLFxuICAgICAgbWRhdDogW10sXG4gICAgICBtZGhkOiBbXSxcbiAgICAgIG1kaWE6IFtdLFxuICAgICAgbWZoZDogW10sXG4gICAgICBtaW5mOiBbXSxcbiAgICAgIG1vb2Y6IFtdLFxuICAgICAgbW9vdjogW10sXG4gICAgICBtcDRhOiBbXSxcbiAgICAgIG12ZXg6IFtdLFxuICAgICAgbXZoZDogW10sXG4gICAgICBzZHRwOiBbXSxcbiAgICAgIHN0Ymw6IFtdLFxuICAgICAgc3RjbzogW10sXG4gICAgICBzdHNjOiBbXSxcbiAgICAgIHN0c2Q6IFtdLFxuICAgICAgc3RzejogW10sXG4gICAgICBzdHRzOiBbXSxcbiAgICAgIHRmZHQ6IFtdLFxuICAgICAgdGZoZDogW10sXG4gICAgICB0cmFmOiBbXSxcbiAgICAgIHRyYWs6IFtdLFxuICAgICAgdHJ1bjogW10sXG4gICAgICB0cmV4OiBbXSxcbiAgICAgIHRraGQ6IFtdLFxuICAgICAgdm1oZDogW10sXG4gICAgICBzbWhkOiBbXVxuICAgIH07XG5cbiAgICB2YXIgaTtcbiAgICBmb3IgKGkgaW4gTVA0LnR5cGVzKSB7XG4gICAgICBpZiAoTVA0LnR5cGVzLmhhc093blByb3BlcnR5KGkpKSB7XG4gICAgICAgIE1QNC50eXBlc1tpXSA9IFtcbiAgICAgICAgICBpLmNoYXJDb2RlQXQoMCksXG4gICAgICAgICAgaS5jaGFyQ29kZUF0KDEpLFxuICAgICAgICAgIGkuY2hhckNvZGVBdCgyKSxcbiAgICAgICAgICBpLmNoYXJDb2RlQXQoMylcbiAgICAgICAgXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgdmlkZW9IZGxyID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcHJlX2RlZmluZWRcbiAgICAgIDB4NzYsIDB4NjksIDB4NjQsIDB4NjUsIC8vIGhhbmRsZXJfdHlwZTogJ3ZpZGUnXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDU2LCAweDY5LCAweDY0LCAweDY1LFxuICAgICAgMHg2ZiwgMHg0OCwgMHg2MSwgMHg2ZSxcbiAgICAgIDB4NjQsIDB4NmMsIDB4NjUsIDB4NzIsIDB4MDAgLy8gbmFtZTogJ1ZpZGVvSGFuZGxlcidcbiAgICBdKTtcblxuICAgIHZhciBhdWRpb0hkbHIgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBwcmVfZGVmaW5lZFxuICAgICAgMHg3MywgMHg2ZiwgMHg3NSwgMHg2ZSwgLy8gaGFuZGxlcl90eXBlOiAnc291bidcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4NTMsIDB4NmYsIDB4NzUsIDB4NmUsXG4gICAgICAweDY0LCAweDQ4LCAweDYxLCAweDZlLFxuICAgICAgMHg2NCwgMHg2YywgMHg2NSwgMHg3MiwgMHgwMCAvLyBuYW1lOiAnU291bmRIYW5kbGVyJ1xuICAgIF0pO1xuXG4gICAgTVA0LkhETFJfVFlQRVMgPSB7XG4gICAgICAndmlkZW8nOiB2aWRlb0hkbHIsXG4gICAgICAnYXVkaW8nOiBhdWRpb0hkbHJcbiAgICB9O1xuXG4gICAgdmFyIGRyZWYgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAxLCAvLyBlbnRyeV9jb3VudFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwYywgLy8gZW50cnlfc2l6ZVxuICAgICAgMHg3NSwgMHg3MiwgMHg2YywgMHgyMCwgLy8gJ3VybCcgdHlwZVxuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAxIC8vIGVudHJ5X2ZsYWdzXG4gICAgXSk7XG5cbiAgICB2YXIgc3RjbyA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwIC8vIGVudHJ5X2NvdW50XG4gICAgXSk7XG5cbiAgICBNUDQuU1RUUyA9IE1QNC5TVFNDID0gTVA0LlNUQ08gPSBzdGNvO1xuXG4gICAgTVA0LlNUU1ogPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gc2FtcGxlX3NpemVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHNhbXBsZV9jb3VudFxuICAgIF0pO1xuICAgIE1QNC5WTUhEID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMSwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIC8vIGdyYXBoaWNzbW9kZVxuICAgICAgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwIC8vIG9wY29sb3JcbiAgICBdKTtcbiAgICBNUDQuU01IRCA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAvLyBiYWxhbmNlXG4gICAgICAweDAwLCAweDAwIC8vIHJlc2VydmVkXG4gICAgXSk7XG5cbiAgICBNUDQuU1RTRCA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDFdKTsvLyBlbnRyeV9jb3VudFxuXG4gICAgdmFyIG1ham9yQnJhbmQgPSBuZXcgVWludDhBcnJheShbMTA1LDExNSwxMTEsMTA5XSk7IC8vIGlzb21cbiAgICB2YXIgYXZjMUJyYW5kID0gbmV3IFVpbnQ4QXJyYXkoWzk3LDExOCw5OSw0OV0pOyAvLyBhdmMxXG4gICAgdmFyIG1pbm9yVmVyc2lvbiA9IG5ldyBVaW50OEFycmF5KFswLCAwLCAwLCAxXSk7XG5cbiAgICBNUDQuRlRZUCA9IE1QNC5ib3goTVA0LnR5cGVzLmZ0eXAsIG1ham9yQnJhbmQsIG1pbm9yVmVyc2lvbiwgbWFqb3JCcmFuZCwgYXZjMUJyYW5kKTtcbiAgICBNUDQuRElORiA9IE1QNC5ib3goTVA0LnR5cGVzLmRpbmYsIE1QNC5ib3goTVA0LnR5cGVzLmRyZWYsIGRyZWYpKTtcbiAgfVxuXG4gIHN0YXRpYyBib3godHlwZSkge1xuICB2YXJcbiAgICBwYXlsb2FkID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSxcbiAgICBzaXplID0gOCxcbiAgICBpID0gcGF5bG9hZC5sZW5ndGgsXG4gICAgbGVuID0gaSxcbiAgICByZXN1bHQ7XG4gICAgLy8gY2FsY3VsYXRlIHRoZSB0b3RhbCBzaXplIHdlIG5lZWQgdG8gYWxsb2NhdGVcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICBzaXplICs9IHBheWxvYWRbaV0uYnl0ZUxlbmd0aDtcbiAgICB9XG4gICAgcmVzdWx0ID0gbmV3IFVpbnQ4QXJyYXkoc2l6ZSk7XG4gICAgcmVzdWx0WzBdID0gKHNpemUgPj4gMjQpICYgMHhmZjtcbiAgICByZXN1bHRbMV0gPSAoc2l6ZSA+PiAxNikgJiAweGZmO1xuICAgIHJlc3VsdFsyXSA9IChzaXplID4+IDgpICYgMHhmZjtcbiAgICByZXN1bHRbM10gPSBzaXplICAmIDB4ZmY7XG4gICAgcmVzdWx0LnNldCh0eXBlLCA0KTtcbiAgICAvLyBjb3B5IHRoZSBwYXlsb2FkIGludG8gdGhlIHJlc3VsdFxuICAgIGZvciAoaSA9IDAsIHNpemUgPSA4OyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIC8vIGNvcHkgcGF5bG9hZFtpXSBhcnJheSBAIG9mZnNldCBzaXplXG4gICAgICByZXN1bHQuc2V0KHBheWxvYWRbaV0sIHNpemUpO1xuICAgICAgc2l6ZSArPSBwYXlsb2FkW2ldLmJ5dGVMZW5ndGg7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBzdGF0aWMgaGRscih0eXBlKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLmhkbHIsIE1QNC5IRExSX1RZUEVTW3R5cGVdKTtcbiAgfVxuXG4gIHN0YXRpYyBtZGF0KGRhdGEpIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWRhdCwgZGF0YSk7XG4gIH1cblxuICBzdGF0aWMgbWRoZCh0aW1lc2NhbGUsIGR1cmF0aW9uKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1kaGQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDIsIC8vIGNyZWF0aW9uX3RpbWVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDMsIC8vIG1vZGlmaWNhdGlvbl90aW1lXG4gICAgICAodGltZXNjYWxlID4+IDI0KSAmIDB4RkYsXG4gICAgICAodGltZXNjYWxlID4+IDE2KSAmIDB4RkYsXG4gICAgICAodGltZXNjYWxlID4+ICA4KSAmIDB4RkYsXG4gICAgICB0aW1lc2NhbGUgJiAweEZGLCAvLyB0aW1lc2NhbGVcbiAgICAgIChkdXJhdGlvbiA+PiAyNCksXG4gICAgICAoZHVyYXRpb24gPj4gMTYpICYgMHhGRixcbiAgICAgIChkdXJhdGlvbiA+PiAgOCkgJiAweEZGLFxuICAgICAgZHVyYXRpb24gJiAweEZGLCAvLyBkdXJhdGlvblxuICAgICAgMHg1NSwgMHhjNCwgLy8gJ3VuZCcgbGFuZ3VhZ2UgKHVuZGV0ZXJtaW5lZClcbiAgICAgIDB4MDAsIDB4MDBcbiAgICBdKSk7XG4gIH1cblxuICBzdGF0aWMgbWRpYSh0cmFjaykge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tZGlhLCBNUDQubWRoZCh0cmFjay50aW1lc2NhbGUsIHRyYWNrLmR1cmF0aW9uKSwgTVA0LmhkbHIodHJhY2sudHlwZSksIE1QNC5taW5mKHRyYWNrKSk7XG4gIH1cblxuICBzdGF0aWMgbWZoZChzZXF1ZW5jZU51bWJlcikge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tZmhkLCBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIChzZXF1ZW5jZU51bWJlciA+PiAyNCksXG4gICAgICAoc2VxdWVuY2VOdW1iZXIgPj4gMTYpICYgMHhGRixcbiAgICAgIChzZXF1ZW5jZU51bWJlciA+PiAgOCkgJiAweEZGLFxuICAgICAgc2VxdWVuY2VOdW1iZXIgJiAweEZGLCAvLyBzZXF1ZW5jZV9udW1iZXJcbiAgICBdKSk7XG4gIH1cblxuICBzdGF0aWMgbWluZih0cmFjaykge1xuICAgIGlmICh0cmFjay50eXBlID09PSAnYXVkaW8nKSB7XG4gICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWluZiwgTVA0LmJveChNUDQudHlwZXMuc21oZCwgTVA0LlNNSEQpLCBNUDQuRElORiwgTVA0LnN0YmwodHJhY2spKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1pbmYsIE1QNC5ib3goTVA0LnR5cGVzLnZtaGQsIE1QNC5WTUhEKSwgTVA0LkRJTkYsIE1QNC5zdGJsKHRyYWNrKSk7XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIG1vb2Yoc24sIGJhc2VNZWRpYURlY29kZVRpbWUsIHRyYWNrKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1vb2YsIE1QNC5tZmhkKHNuKSwgTVA0LnRyYWYodHJhY2ssYmFzZU1lZGlhRGVjb2RlVGltZSkpO1xuICB9XG4vKipcbiAqIEBwYXJhbSB0cmFja3MuLi4gKG9wdGlvbmFsKSB7YXJyYXl9IHRoZSB0cmFja3MgYXNzb2NpYXRlZCB3aXRoIHRoaXMgbW92aWVcbiAqL1xuICBzdGF0aWMgbW9vdih0cmFja3MpIHtcbiAgICB2YXJcbiAgICAgIGkgPSB0cmFja3MubGVuZ3RoLFxuICAgICAgYm94ZXMgPSBbXTtcblxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIGJveGVzW2ldID0gTVA0LnRyYWsodHJhY2tzW2ldKTtcbiAgICB9XG5cbiAgICByZXR1cm4gTVA0LmJveC5hcHBseShudWxsLCBbTVA0LnR5cGVzLm1vb3YsIE1QNC5tdmhkKHRyYWNrc1swXS50aW1lc2NhbGUsIHRyYWNrc1swXS5kdXJhdGlvbildLmNvbmNhdChib3hlcykuY29uY2F0KE1QNC5tdmV4KHRyYWNrcykpKTtcbiAgfVxuXG4gIHN0YXRpYyBtdmV4KHRyYWNrcykge1xuICAgIHZhclxuICAgICAgaSA9IHRyYWNrcy5sZW5ndGgsXG4gICAgICBib3hlcyA9IFtdO1xuXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgYm94ZXNbaV0gPSBNUDQudHJleCh0cmFja3NbaV0pO1xuICAgIH1cbiAgICByZXR1cm4gTVA0LmJveC5hcHBseShudWxsLCBbTVA0LnR5cGVzLm12ZXhdLmNvbmNhdChib3hlcykpO1xuICB9XG5cbiAgc3RhdGljIG12aGQodGltZXNjYWxlLGR1cmF0aW9uKSB7XG4gICAgdmFyXG4gICAgICBieXRlcyA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDEsIC8vIGNyZWF0aW9uX3RpbWVcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMiwgLy8gbW9kaWZpY2F0aW9uX3RpbWVcbiAgICAgICAgKHRpbWVzY2FsZSA+PiAyNCkgJiAweEZGLFxuICAgICAgICAodGltZXNjYWxlID4+IDE2KSAmIDB4RkYsXG4gICAgICAgICh0aW1lc2NhbGUgPj4gIDgpICYgMHhGRixcbiAgICAgICAgdGltZXNjYWxlICYgMHhGRiwgLy8gdGltZXNjYWxlXG4gICAgICAgIChkdXJhdGlvbiA+PiAyNCkgJiAweEZGLFxuICAgICAgICAoZHVyYXRpb24gPj4gMTYpICYgMHhGRixcbiAgICAgICAgKGR1cmF0aW9uID4+ICA4KSAmIDB4RkYsXG4gICAgICAgIGR1cmF0aW9uICYgMHhGRiwgLy8gZHVyYXRpb25cbiAgICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCwgLy8gMS4wIHJhdGVcbiAgICAgICAgMHgwMSwgMHgwMCwgLy8gMS4wIHZvbHVtZVxuICAgICAgICAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDQwLCAweDAwLCAweDAwLCAweDAwLCAvLyB0cmFuc2Zvcm1hdGlvbjogdW5pdHkgbWF0cml4XG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAgIDB4ZmYsIDB4ZmYsIDB4ZmYsIDB4ZmYgLy8gbmV4dF90cmFja19JRFxuICAgICAgXSk7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm12aGQsIGJ5dGVzKTtcbiAgfVxuXG4gIHN0YXRpYyBzZHRwKHRyYWNrKSB7XG4gICAgdmFyXG4gICAgICBzYW1wbGVzID0gdHJhY2suc2FtcGxlcyB8fCBbXSxcbiAgICAgIGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkoNCArIHNhbXBsZXMubGVuZ3RoKSxcbiAgICAgIGZsYWdzLFxuICAgICAgaTtcbiAgICAvLyBsZWF2ZSB0aGUgZnVsbCBib3ggaGVhZGVyICg0IGJ5dGVzKSBhbGwgemVyb1xuICAgIC8vIHdyaXRlIHRoZSBzYW1wbGUgdGFibGVcbiAgICBmb3IgKGkgPSAwOyBpIDwgc2FtcGxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgZmxhZ3MgPSBzYW1wbGVzW2ldLmZsYWdzO1xuICAgICAgYnl0ZXNbaSArIDRdID0gKGZsYWdzLmRlcGVuZHNPbiA8PCA0KSB8XG4gICAgICAgIChmbGFncy5pc0RlcGVuZGVkT24gPDwgMikgfFxuICAgICAgICAoZmxhZ3MuaGFzUmVkdW5kYW5jeSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnNkdHAsIGJ5dGVzKTtcbiAgfVxuXG4gIHN0YXRpYyBzdGJsKHRyYWNrKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnN0YmwsIE1QNC5zdHNkKHRyYWNrKSwgTVA0LmJveChNUDQudHlwZXMuc3R0cywgTVA0LlNUVFMpLCBNUDQuYm94KE1QNC50eXBlcy5zdHNjLCBNUDQuU1RTQyksIE1QNC5ib3goTVA0LnR5cGVzLnN0c3osIE1QNC5TVFNaKSwgTVA0LmJveChNUDQudHlwZXMuc3RjbywgTVA0LlNUQ08pKTtcbiAgfVxuXG4gIHN0YXRpYyBhdmMxKHRyYWNrKSB7XG4gICAgdmFyIHNwcyA9IFtdLCBwcHMgPSBbXSwgaSwgZGF0YSwgbGVuO1xuICAgIC8vIGFzc2VtYmxlIHRoZSBTUFNzXG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgdHJhY2suc3BzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBkYXRhID0gdHJhY2suc3BzW2ldO1xuICAgICAgbGVuID0gZGF0YS5ieXRlTGVuZ3RoO1xuICAgICAgc3BzLnB1c2goKGxlbiA+Pj4gOCkgJiAweEZGKTtcbiAgICAgIHNwcy5wdXNoKChsZW4gJiAweEZGKSk7XG4gICAgICBzcHMgPSBzcHMuY29uY2F0KEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGRhdGEpKTsgLy8gU1BTXG4gICAgfVxuXG4gICAgLy8gYXNzZW1ibGUgdGhlIFBQU3NcbiAgICBmb3IgKGkgPSAwOyBpIDwgdHJhY2sucHBzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBkYXRhID0gdHJhY2sucHBzW2ldO1xuICAgICAgbGVuID0gZGF0YS5ieXRlTGVuZ3RoO1xuICAgICAgcHBzLnB1c2goKGxlbiA+Pj4gOCkgJiAweEZGKTtcbiAgICAgIHBwcy5wdXNoKChsZW4gJiAweEZGKSk7XG4gICAgICBwcHMgPSBwcHMuY29uY2F0KEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGRhdGEpKTtcbiAgICB9XG5cbiAgICB2YXIgYXZjYyA9IE1QNC5ib3goTVA0LnR5cGVzLmF2Y0MsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgICAgIDB4MDEsICAgLy8gdmVyc2lvblxuICAgICAgICAgICAgc3BzWzNdLCAvLyBwcm9maWxlXG4gICAgICAgICAgICBzcHNbNF0sIC8vIHByb2ZpbGUgY29tcGF0XG4gICAgICAgICAgICBzcHNbNV0sIC8vIGxldmVsXG4gICAgICAgICAgICAweGZjIHwgMywgLy8gbGVuZ3RoU2l6ZU1pbnVzT25lLCBoYXJkLWNvZGVkIHRvIDQgYnl0ZXNcbiAgICAgICAgICAgIDB4RTAgfCB0cmFjay5zcHMubGVuZ3RoIC8vIDNiaXQgcmVzZXJ2ZWQgKDExMSkgKyBudW1PZlNlcXVlbmNlUGFyYW1ldGVyU2V0c1xuICAgICAgICAgIF0uY29uY2F0KHNwcykuY29uY2F0KFtcbiAgICAgICAgICAgIHRyYWNrLnBwcy5sZW5ndGggLy8gbnVtT2ZQaWN0dXJlUGFyYW1ldGVyU2V0c1xuICAgICAgICAgIF0pLmNvbmNhdChwcHMpKSksIC8vIFwiUFBTXCJcbiAgICAgICAgd2lkdGggPSB0cmFjay53aWR0aCxcbiAgICAgICAgaGVpZ2h0ID0gdHJhY2suaGVpZ2h0O1xuICAgIC8vY29uc29sZS5sb2coJ2F2Y2M6JyArIEhleC5oZXhEdW1wKGF2Y2MpKTtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuYXZjMSwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAxLCAvLyBkYXRhX3JlZmVyZW5jZV9pbmRleFxuICAgICAgICAweDAwLCAweDAwLCAvLyBwcmVfZGVmaW5lZFxuICAgICAgICAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBwcmVfZGVmaW5lZFxuICAgICAgICAod2lkdGggPj4gOCkgJiAweEZGLFxuICAgICAgICB3aWR0aCAmIDB4ZmYsIC8vIHdpZHRoXG4gICAgICAgIChoZWlnaHQgPj4gOCkgJiAweEZGLFxuICAgICAgICBoZWlnaHQgJiAweGZmLCAvLyBoZWlnaHRcbiAgICAgICAgMHgwMCwgMHg0OCwgMHgwMCwgMHgwMCwgLy8gaG9yaXpyZXNvbHV0aW9uXG4gICAgICAgIDB4MDAsIDB4NDgsIDB4MDAsIDB4MDAsIC8vIHZlcnRyZXNvbHV0aW9uXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDEsIC8vIGZyYW1lX2NvdW50XG4gICAgICAgIDB4MTMsXG4gICAgICAgIDB4NzYsIDB4NjksIDB4NjQsIDB4NjUsXG4gICAgICAgIDB4NmYsIDB4NmEsIDB4NzMsIDB4MmQsXG4gICAgICAgIDB4NjMsIDB4NmYsIDB4NmUsIDB4NzQsXG4gICAgICAgIDB4NzIsIDB4NjksIDB4NjIsIDB4MmQsXG4gICAgICAgIDB4NjgsIDB4NmMsIDB4NzMsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGNvbXByZXNzb3JuYW1lXG4gICAgICAgIDB4MDAsIDB4MTgsIC8vIGRlcHRoID0gMjRcbiAgICAgICAgMHgxMSwgMHgxMV0pLCAvLyBwcmVfZGVmaW5lZCA9IC0xXG4gICAgICAgICAgYXZjYyxcbiAgICAgICAgICBNUDQuYm94KE1QNC50eXBlcy5idHJ0LCBuZXcgVWludDhBcnJheShbXG4gICAgICAgICAgICAweDAwLCAweDFjLCAweDljLCAweDgwLCAvLyBidWZmZXJTaXplREJcbiAgICAgICAgICAgIDB4MDAsIDB4MmQsIDB4YzYsIDB4YzAsIC8vIG1heEJpdHJhdGVcbiAgICAgICAgICAgIDB4MDAsIDB4MmQsIDB4YzYsIDB4YzBdKSkgLy8gYXZnQml0cmF0ZVxuICAgICAgICAgICk7XG4gIH1cblxuICBzdGF0aWMgZXNkcyh0cmFjaykge1xuICAgIHZhciBjb25maWdsZW4gPSB0cmFjay5jb25maWcubGVuZ3RoO1xuICAgIHJldHVybiBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG5cbiAgICAgIDB4MDMsIC8vIGRlc2NyaXB0b3JfdHlwZVxuICAgICAgMHgxNytjb25maWdsZW4sIC8vIGxlbmd0aFxuICAgICAgMHgwMCwgMHgwMSwgLy9lc19pZFxuICAgICAgMHgwMCwgLy8gc3RyZWFtX3ByaW9yaXR5XG5cbiAgICAgIDB4MDQsIC8vIGRlc2NyaXB0b3JfdHlwZVxuICAgICAgMHgwZitjb25maWdsZW4sIC8vIGxlbmd0aFxuICAgICAgMHg0MCwgLy9jb2RlYyA6IG1wZWc0X2F1ZGlvXG4gICAgICAweDE1LCAvLyBzdHJlYW1fdHlwZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gYnVmZmVyX3NpemVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIG1heEJpdHJhdGVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGF2Z0JpdHJhdGVcblxuICAgICAgMHgwNSAvLyBkZXNjcmlwdG9yX3R5cGVcbiAgICAgIF0uY29uY2F0KFtjb25maWdsZW5dKS5jb25jYXQodHJhY2suY29uZmlnKS5jb25jYXQoWzB4MDYsIDB4MDEsIDB4MDJdKSk7IC8vIEdBU3BlY2lmaWNDb25maWcpKTsgLy8gbGVuZ3RoICsgYXVkaW8gY29uZmlnIGRlc2NyaXB0b3JcbiAgfVxuXG4gIHN0YXRpYyBtcDRhKHRyYWNrKSB7XG4gICAgdmFyIGF1ZGlvc2FtcGxlcmF0ZSA9IHRyYWNrLmF1ZGlvc2FtcGxlcmF0ZTtcbiAgICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tcDRhLCBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDEsIC8vIGRhdGFfcmVmZXJlbmNlX2luZGV4XG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIHRyYWNrLmNoYW5uZWxDb3VudCwgLy8gY2hhbm5lbGNvdW50XG4gICAgICAweDAwLCAweDEwLCAvLyBzYW1wbGVTaXplOjE2Yml0c1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWQyXG4gICAgICAoYXVkaW9zYW1wbGVyYXRlID4+IDgpICYgMHhGRixcbiAgICAgIGF1ZGlvc2FtcGxlcmF0ZSAmIDB4ZmYsIC8vXG4gICAgICAweDAwLCAweDAwXSksXG4gICAgICBNUDQuYm94KE1QNC50eXBlcy5lc2RzLCBNUDQuZXNkcyh0cmFjaykpKTtcbiAgfVxuXG4gIHN0YXRpYyBzdHNkKHRyYWNrKSB7XG4gICAgaWYgKHRyYWNrLnR5cGUgPT09ICdhdWRpbycpIHtcbiAgICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5zdHNkLCBNUDQuU1RTRCwgTVA0Lm1wNGEodHJhY2spKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnN0c2QsIE1QNC5TVFNELCBNUDQuYXZjMSh0cmFjaykpO1xuICAgIH1cbiAgfVxuXG4gIHN0YXRpYyB0a2hkKHRyYWNrKSB7XG4gICAgdmFyIGlkID0gdHJhY2suaWQsXG4gICAgICAgIGR1cmF0aW9uID0gdHJhY2suZHVyYXRpb24sXG4gICAgICAgIHdpZHRoID0gdHJhY2sud2lkdGgsXG4gICAgICAgIGhlaWdodCA9IHRyYWNrLmhlaWdodDtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudGtoZCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDA3LCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gY3JlYXRpb25fdGltZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gbW9kaWZpY2F0aW9uX3RpbWVcbiAgICAgIChpZCA+PiAyNCkgJiAweEZGLFxuICAgICAgKGlkID4+IDE2KSAmIDB4RkYsXG4gICAgICAoaWQgPj4gOCkgJiAweEZGLFxuICAgICAgaWQgJiAweEZGLCAvLyB0cmFja19JRFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIChkdXJhdGlvbiA+PiAyNCksXG4gICAgICAoZHVyYXRpb24gPj4gMTYpICYgMHhGRixcbiAgICAgIChkdXJhdGlvbiA+PiAgOCkgJiAweEZGLFxuICAgICAgZHVyYXRpb24gJiAweEZGLCAvLyBkdXJhdGlvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAvLyBsYXllclxuICAgICAgMHgwMCwgMHgwMCwgLy8gYWx0ZXJuYXRlX2dyb3VwXG4gICAgICAweDAwLCAweDAwLCAvLyBub24tYXVkaW8gdHJhY2sgdm9sdW1lXG4gICAgICAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDQwLCAweDAwLCAweDAwLCAweDAwLCAvLyB0cmFuc2Zvcm1hdGlvbjogdW5pdHkgbWF0cml4XG4gICAgICAod2lkdGggPj4gOCkgJiAweEZGLFxuICAgICAgd2lkdGggJiAweEZGLFxuICAgICAgMHgwMCwgMHgwMCwgLy8gd2lkdGhcbiAgICAgIChoZWlnaHQgPj4gOCkgJiAweEZGLFxuICAgICAgaGVpZ2h0ICYgMHhGRixcbiAgICAgIDB4MDAsIDB4MDAgLy8gaGVpZ2h0XG4gICAgXSkpO1xuICB9XG5cbiAgc3RhdGljIHRyYWYodHJhY2ssYmFzZU1lZGlhRGVjb2RlVGltZSkge1xuICAgIHZhciBzYW1wbGVEZXBlbmRlbmN5VGFibGUgPSBNUDQuc2R0cCh0cmFjayksXG4gICAgICAgIGlkID0gdHJhY2suaWQ7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnRyYWYsXG4gICAgICAgICAgICAgICBNUDQuYm94KE1QNC50eXBlcy50ZmhkLCBuZXcgVWludDhBcnJheShbXG4gICAgICAgICAgICAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgICAgICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgICAgICAgICAgICAoaWQgPj4gMjQpLFxuICAgICAgICAgICAgICAgICAoaWQgPj4gMTYpICYgMFhGRixcbiAgICAgICAgICAgICAgICAgKGlkID4+IDgpICYgMFhGRixcbiAgICAgICAgICAgICAgICAgKGlkICYgMHhGRikgLy8gdHJhY2tfSURcbiAgICAgICAgICAgICAgIF0pKSxcbiAgICAgICAgICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLnRmZHQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgICAgICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAgICAgICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAgICAgICAgICAgIChiYXNlTWVkaWFEZWNvZGVUaW1lID4+MjQpLFxuICAgICAgICAgICAgICAgICAoYmFzZU1lZGlhRGVjb2RlVGltZSA+PiAxNikgJiAwWEZGLFxuICAgICAgICAgICAgICAgICAoYmFzZU1lZGlhRGVjb2RlVGltZSA+PiA4KSAmIDBYRkYsXG4gICAgICAgICAgICAgICAgIChiYXNlTWVkaWFEZWNvZGVUaW1lICYgMHhGRikgLy8gYmFzZU1lZGlhRGVjb2RlVGltZVxuICAgICAgICAgICAgICAgXSkpLFxuICAgICAgICAgICAgICAgTVA0LnRydW4odHJhY2ssXG4gICAgICAgICAgICAgICAgICAgIHNhbXBsZURlcGVuZGVuY3lUYWJsZS5sZW5ndGggK1xuICAgICAgICAgICAgICAgICAgICAxNiArIC8vIHRmaGRcbiAgICAgICAgICAgICAgICAgICAgMTYgKyAvLyB0ZmR0XG4gICAgICAgICAgICAgICAgICAgIDggKyAgLy8gdHJhZiBoZWFkZXJcbiAgICAgICAgICAgICAgICAgICAgMTYgKyAvLyBtZmhkXG4gICAgICAgICAgICAgICAgICAgIDggKyAgLy8gbW9vZiBoZWFkZXJcbiAgICAgICAgICAgICAgICAgICAgOCksICAvLyBtZGF0IGhlYWRlclxuICAgICAgICAgICAgICAgc2FtcGxlRGVwZW5kZW5jeVRhYmxlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZW5lcmF0ZSBhIHRyYWNrIGJveC5cbiAgICogQHBhcmFtIHRyYWNrIHtvYmplY3R9IGEgdHJhY2sgZGVmaW5pdGlvblxuICAgKiBAcmV0dXJuIHtVaW50OEFycmF5fSB0aGUgdHJhY2sgYm94XG4gICAqL1xuICBzdGF0aWMgdHJhayh0cmFjaykge1xuICAgIHRyYWNrLmR1cmF0aW9uID0gdHJhY2suZHVyYXRpb24gfHwgMHhmZmZmZmZmZjtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudHJhaywgTVA0LnRraGQodHJhY2spLCBNUDQubWRpYSh0cmFjaykpO1xuICB9XG5cbiAgc3RhdGljIHRyZXgodHJhY2spIHtcbiAgICB2YXIgaWQgPSB0cmFjay5pZDtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudHJleCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAoaWQgPj4gMjQpLFxuICAgICAoaWQgPj4gMTYpICYgMFhGRixcbiAgICAgKGlkID4+IDgpICYgMFhGRixcbiAgICAgKGlkICYgMHhGRiksIC8vIHRyYWNrX0lEXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAxLCAvLyBkZWZhdWx0X3NhbXBsZV9kZXNjcmlwdGlvbl9pbmRleFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZGVmYXVsdF9zYW1wbGVfZHVyYXRpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGRlZmF1bHRfc2FtcGxlX3NpemVcbiAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDEgLy8gZGVmYXVsdF9zYW1wbGVfZmxhZ3NcbiAgICBdKSk7XG4gIH1cblxuICBzdGF0aWMgdHJ1bih0cmFjaywgb2Zmc2V0KSB7XG4gICAgdmFyIHNhbXBsZXM9IHRyYWNrLnNhbXBsZXMgfHwgW10sXG4gICAgICAgIGxlbiA9IHNhbXBsZXMubGVuZ3RoLFxuICAgICAgICBhcnJheWxlbiA9IDEyICsgKDE2ICogbGVuKSxcbiAgICAgICAgYXJyYXkgPSBuZXcgVWludDhBcnJheShhcnJheWxlbiksXG4gICAgICAgIGksc2FtcGxlLGR1cmF0aW9uLHNpemUsZmxhZ3MsY3RzO1xuICAgIG9mZnNldCArPSA4ICsgYXJyYXlsZW47XG4gICAgYXJyYXkuc2V0KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwZiwgMHgwMSwgLy8gZmxhZ3NcbiAgICAgIChsZW4gPj4+IDI0KSAmIDB4RkYsXG4gICAgICAobGVuID4+PiAxNikgJiAweEZGLFxuICAgICAgKGxlbiA+Pj4gOCkgJiAweEZGLFxuICAgICAgbGVuICYgMHhGRiwgLy8gc2FtcGxlX2NvdW50XG4gICAgICAob2Zmc2V0ID4+PiAyNCkgJiAweEZGLFxuICAgICAgKG9mZnNldCA+Pj4gMTYpICYgMHhGRixcbiAgICAgIChvZmZzZXQgPj4+IDgpICYgMHhGRixcbiAgICAgIG9mZnNldCAmIDB4RkYgLy8gZGF0YV9vZmZzZXRcbiAgICBdLDApO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgc2FtcGxlID0gc2FtcGxlc1tpXTtcbiAgICAgIGR1cmF0aW9uID0gc2FtcGxlLmR1cmF0aW9uO1xuICAgICAgc2l6ZSA9IHNhbXBsZS5zaXplO1xuICAgICAgZmxhZ3MgPSBzYW1wbGUuZmxhZ3M7XG4gICAgICBjdHMgPSBzYW1wbGUuY3RzO1xuICAgICAgYXJyYXkuc2V0KFtcbiAgICAgICAgKGR1cmF0aW9uID4+PiAyNCkgJiAweEZGLFxuICAgICAgICAoZHVyYXRpb24gPj4+IDE2KSAmIDB4RkYsXG4gICAgICAgIChkdXJhdGlvbiA+Pj4gOCkgJiAweEZGLFxuICAgICAgICBkdXJhdGlvbiAmIDB4RkYsIC8vIHNhbXBsZV9kdXJhdGlvblxuICAgICAgICAoc2l6ZSA+Pj4gMjQpICYgMHhGRixcbiAgICAgICAgKHNpemUgPj4+IDE2KSAmIDB4RkYsXG4gICAgICAgIChzaXplID4+PiA4KSAmIDB4RkYsXG4gICAgICAgIHNpemUgJiAweEZGLCAvLyBzYW1wbGVfc2l6ZVxuICAgICAgICAoZmxhZ3MuaXNMZWFkaW5nIDw8IDIpIHwgZmxhZ3MuZGVwZW5kc09uLFxuICAgICAgICAoZmxhZ3MuaXNEZXBlbmRlZE9uIDw8IDYpIHxcbiAgICAgICAgICAoZmxhZ3MuaGFzUmVkdW5kYW5jeSA8PCA0KSB8XG4gICAgICAgICAgKGZsYWdzLnBhZGRpbmdWYWx1ZSA8PCAxKSB8XG4gICAgICAgICAgZmxhZ3MuaXNOb25TeW5jLFxuICAgICAgICBmbGFncy5kZWdyYWRQcmlvICYgMHhGMCA8PCA4LFxuICAgICAgICBmbGFncy5kZWdyYWRQcmlvICYgMHgwRiwgLy8gc2FtcGxlX2ZsYWdzXG4gICAgICAgIChjdHMgPj4+IDI0KSAmIDB4RkYsXG4gICAgICAgIChjdHMgPj4+IDE2KSAmIDB4RkYsXG4gICAgICAgIChjdHMgPj4+IDgpICYgMHhGRixcbiAgICAgICAgY3RzICYgMHhGRiAvLyBzYW1wbGVfY29tcG9zaXRpb25fdGltZV9vZmZzZXRcbiAgICAgIF0sMTIrMTYqaSk7XG4gICAgfVxuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50cnVuLCBhcnJheSk7XG4gIH1cblxuICBzdGF0aWMgaW5pdFNlZ21lbnQodHJhY2tzKSB7XG4gICAgaWYgKCFNUDQudHlwZXMpIHtcbiAgICAgIE1QNC5pbml0KCk7XG4gICAgfVxuICAgIHZhciBtb3ZpZSA9IE1QNC5tb292KHRyYWNrcyksIHJlc3VsdDtcbiAgICByZXN1bHQgPSBuZXcgVWludDhBcnJheShNUDQuRlRZUC5ieXRlTGVuZ3RoICsgbW92aWUuYnl0ZUxlbmd0aCk7XG4gICAgcmVzdWx0LnNldChNUDQuRlRZUCk7XG4gICAgcmVzdWx0LnNldChtb3ZpZSwgTVA0LkZUWVAuYnl0ZUxlbmd0aCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBNUDQ7XG4iLCIvKipcbiAqIGZNUDQgcmVtdXhlclxuKi9cblxuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IE1QNCBmcm9tICcuLi9yZW11eC9tcDQtZ2VuZXJhdG9yJztcbmltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuXG5jbGFzcyBNUDRSZW11eGVyIHtcbiAgY29uc3RydWN0b3Iob2JzZXJ2ZXIpIHtcbiAgICB0aGlzLm9ic2VydmVyID0gb2JzZXJ2ZXI7XG4gICAgdGhpcy5JU0dlbmVyYXRlZCA9IGZhbHNlO1xuICAgIHRoaXMuUEVTMk1QNFNDQUxFRkFDVE9SID0gNDtcbiAgICB0aGlzLlBFU19USU1FU0NBTEUgPSA5MDAwMDtcbiAgICB0aGlzLk1QNF9USU1FU0NBTEUgPSB0aGlzLlBFU19USU1FU0NBTEUgLyB0aGlzLlBFUzJNUDRTQ0FMRUZBQ1RPUjtcbiAgfVxuXG4gIGdldCB0aW1lc2NhbGUoKSB7XG4gICAgcmV0dXJuIHRoaXMuTVA0X1RJTUVTQ0FMRTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gIH1cblxuICBpbnNlcnREaXNjb250aW51aXR5KCkge1xuICAgIHRoaXMuX2luaXRQVFMgPSB0aGlzLl9pbml0RFRTID0gdGhpcy5uZXh0QWFjUHRzID0gdGhpcy5uZXh0QXZjRHRzID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgc3dpdGNoTGV2ZWwoKSB7XG4gICAgdGhpcy5JU0dlbmVyYXRlZCA9IGZhbHNlO1xuICB9XG5cbiAgcmVtdXgoYXVkaW9UcmFjayx2aWRlb1RyYWNrLGlkM1RyYWNrLHRleHRUcmFjayx0aW1lT2Zmc2V0LCBjb250aWd1b3VzKSB7XG4gICAgLy8gZ2VuZXJhdGUgSW5pdCBTZWdtZW50IGlmIG5lZWRlZFxuICAgIGlmICghdGhpcy5JU0dlbmVyYXRlZCkge1xuICAgICAgdGhpcy5nZW5lcmF0ZUlTKGF1ZGlvVHJhY2ssdmlkZW9UcmFjayx0aW1lT2Zmc2V0KTtcbiAgICB9XG4gICAgLy9sb2dnZXIubG9nKCduYiBBVkMgc2FtcGxlczonICsgdmlkZW9UcmFjay5zYW1wbGVzLmxlbmd0aCk7XG4gICAgaWYgKHZpZGVvVHJhY2suc2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgIHRoaXMucmVtdXhWaWRlbyh2aWRlb1RyYWNrLHRpbWVPZmZzZXQsY29udGlndW91cyk7XG4gICAgfVxuICAgIC8vbG9nZ2VyLmxvZygnbmIgQUFDIHNhbXBsZXM6JyArIGF1ZGlvVHJhY2suc2FtcGxlcy5sZW5ndGgpO1xuICAgIGlmIChhdWRpb1RyYWNrLnNhbXBsZXMubGVuZ3RoKSB7XG4gICAgICB0aGlzLnJlbXV4QXVkaW8oYXVkaW9UcmFjayx0aW1lT2Zmc2V0LGNvbnRpZ3VvdXMpO1xuICAgIH1cbiAgICAvL2xvZ2dlci5sb2coJ25iIElEMyBzYW1wbGVzOicgKyBhdWRpb1RyYWNrLnNhbXBsZXMubGVuZ3RoKTtcbiAgICBpZiAoaWQzVHJhY2suc2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgIHRoaXMucmVtdXhJRDMoaWQzVHJhY2ssdGltZU9mZnNldCk7XG4gICAgfVxuICAgIC8vbG9nZ2VyLmxvZygnbmIgSUQzIHNhbXBsZXM6JyArIGF1ZGlvVHJhY2suc2FtcGxlcy5sZW5ndGgpO1xuICAgIGlmICh0ZXh0VHJhY2suc2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgIHRoaXMucmVtdXhUZXh0KHRleHRUcmFjayx0aW1lT2Zmc2V0KTtcbiAgICB9XG4gICAgLy9ub3RpZnkgZW5kIG9mIHBhcnNpbmdcbiAgICB0aGlzLm9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTRUQpO1xuICB9XG5cbiAgZ2VuZXJhdGVJUyhhdWRpb1RyYWNrLHZpZGVvVHJhY2ssdGltZU9mZnNldCkge1xuICAgIHZhciBvYnNlcnZlciA9IHRoaXMub2JzZXJ2ZXIsXG4gICAgICAgIGF1ZGlvU2FtcGxlcyA9IGF1ZGlvVHJhY2suc2FtcGxlcyxcbiAgICAgICAgdmlkZW9TYW1wbGVzID0gdmlkZW9UcmFjay5zYW1wbGVzLFxuICAgICAgICBuYkF1ZGlvID0gYXVkaW9TYW1wbGVzLmxlbmd0aCxcbiAgICAgICAgbmJWaWRlbyA9IHZpZGVvU2FtcGxlcy5sZW5ndGgsXG4gICAgICAgIHBlc1RpbWVTY2FsZSA9IHRoaXMuUEVTX1RJTUVTQ0FMRTtcblxuICAgIGlmKG5iQXVkaW8gPT09IDAgJiYgbmJWaWRlbyA9PT0gMCkge1xuICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGUgOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuRlJBR19QQVJTSU5HX0VSUk9SLCBmYXRhbDogZmFsc2UsIHJlYXNvbjogJ25vIGF1ZGlvL3ZpZGVvIHNhbXBsZXMgZm91bmQnfSk7XG4gICAgfSBlbHNlIGlmIChuYlZpZGVvID09PSAwKSB7XG4gICAgICAvL2F1ZGlvIG9ubHlcbiAgICAgIGlmIChhdWRpb1RyYWNrLmNvbmZpZykge1xuICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULCB7XG4gICAgICAgICAgYXVkaW9Nb292OiBNUDQuaW5pdFNlZ21lbnQoW2F1ZGlvVHJhY2tdKSxcbiAgICAgICAgICBhdWRpb0NvZGVjIDogYXVkaW9UcmFjay5jb2RlYyxcbiAgICAgICAgICBhdWRpb0NoYW5uZWxDb3VudCA6IGF1ZGlvVHJhY2suY2hhbm5lbENvdW50XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLklTR2VuZXJhdGVkID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLl9pbml0UFRTID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgLy8gcmVtZW1iZXIgZmlyc3QgUFRTIG9mIHRoaXMgZGVtdXhpbmcgY29udGV4dFxuICAgICAgICB0aGlzLl9pbml0UFRTID0gYXVkaW9TYW1wbGVzWzBdLnB0cyAtIHBlc1RpbWVTY2FsZSAqIHRpbWVPZmZzZXQ7XG4gICAgICAgIHRoaXMuX2luaXREVFMgPSBhdWRpb1NhbXBsZXNbMF0uZHRzIC0gcGVzVGltZVNjYWxlICogdGltZU9mZnNldDtcbiAgICAgIH1cbiAgICB9IGVsc2VcbiAgICBpZiAobmJBdWRpbyA9PT0gMCkge1xuICAgICAgLy92aWRlbyBvbmx5XG4gICAgICBpZiAodmlkZW9UcmFjay5zcHMgJiYgdmlkZW9UcmFjay5wcHMpIHtcbiAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCwge1xuICAgICAgICAgIHZpZGVvTW9vdjogTVA0LmluaXRTZWdtZW50KFt2aWRlb1RyYWNrXSksXG4gICAgICAgICAgdmlkZW9Db2RlYzogdmlkZW9UcmFjay5jb2RlYyxcbiAgICAgICAgICB2aWRlb1dpZHRoOiB2aWRlb1RyYWNrLndpZHRoLFxuICAgICAgICAgIHZpZGVvSGVpZ2h0OiB2aWRlb1RyYWNrLmhlaWdodFxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5JU0dlbmVyYXRlZCA9IHRydWU7XG4gICAgICAgIGlmICh0aGlzLl9pbml0UFRTID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAvLyByZW1lbWJlciBmaXJzdCBQVFMgb2YgdGhpcyBkZW11eGluZyBjb250ZXh0XG4gICAgICAgICAgdGhpcy5faW5pdFBUUyA9IHZpZGVvU2FtcGxlc1swXS5wdHMgLSBwZXNUaW1lU2NhbGUgKiB0aW1lT2Zmc2V0O1xuICAgICAgICAgIHRoaXMuX2luaXREVFMgPSB2aWRlb1NhbXBsZXNbMF0uZHRzIC0gcGVzVGltZVNjYWxlICogdGltZU9mZnNldDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvL2F1ZGlvIGFuZCB2aWRlb1xuICAgICAgaWYgKGF1ZGlvVHJhY2suY29uZmlnICYmIHZpZGVvVHJhY2suc3BzICYmIHZpZGVvVHJhY2sucHBzKSB7XG4gICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULCB7XG4gICAgICAgICAgYXVkaW9Nb292OiBNUDQuaW5pdFNlZ21lbnQoW2F1ZGlvVHJhY2tdKSxcbiAgICAgICAgICBhdWRpb0NvZGVjOiBhdWRpb1RyYWNrLmNvZGVjLFxuICAgICAgICAgIGF1ZGlvQ2hhbm5lbENvdW50OiBhdWRpb1RyYWNrLmNoYW5uZWxDb3VudCxcbiAgICAgICAgICB2aWRlb01vb3Y6IE1QNC5pbml0U2VnbWVudChbdmlkZW9UcmFja10pLFxuICAgICAgICAgIHZpZGVvQ29kZWM6IHZpZGVvVHJhY2suY29kZWMsXG4gICAgICAgICAgdmlkZW9XaWR0aDogdmlkZW9UcmFjay53aWR0aCxcbiAgICAgICAgICB2aWRlb0hlaWdodDogdmlkZW9UcmFjay5oZWlnaHRcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuSVNHZW5lcmF0ZWQgPSB0cnVlO1xuICAgICAgICBpZiAodGhpcy5faW5pdFBUUyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgLy8gcmVtZW1iZXIgZmlyc3QgUFRTIG9mIHRoaXMgZGVtdXhpbmcgY29udGV4dFxuICAgICAgICAgIHRoaXMuX2luaXRQVFMgPSBNYXRoLm1pbih2aWRlb1NhbXBsZXNbMF0ucHRzLCBhdWRpb1NhbXBsZXNbMF0ucHRzKSAtIHBlc1RpbWVTY2FsZSAqIHRpbWVPZmZzZXQ7XG4gICAgICAgICAgdGhpcy5faW5pdERUUyA9IE1hdGgubWluKHZpZGVvU2FtcGxlc1swXS5kdHMsIGF1ZGlvU2FtcGxlc1swXS5kdHMpIC0gcGVzVGltZVNjYWxlICogdGltZU9mZnNldDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJlbXV4VmlkZW8odHJhY2ssIHRpbWVPZmZzZXQsIGNvbnRpZ3VvdXMpIHtcbiAgICB2YXIgdmlldyxcbiAgICAgICAgb2Zmc2V0ID0gOCxcbiAgICAgICAgcGVzVGltZVNjYWxlID0gdGhpcy5QRVNfVElNRVNDQUxFLFxuICAgICAgICBwZXMybXA0U2NhbGVGYWN0b3IgPSB0aGlzLlBFUzJNUDRTQ0FMRUZBQ1RPUixcbiAgICAgICAgYXZjU2FtcGxlLFxuICAgICAgICBtcDRTYW1wbGUsXG4gICAgICAgIG1wNFNhbXBsZUxlbmd0aCxcbiAgICAgICAgdW5pdCxcbiAgICAgICAgbWRhdCwgbW9vZixcbiAgICAgICAgZmlyc3RQVFMsIGZpcnN0RFRTLCBsYXN0RFRTLFxuICAgICAgICBwdHMsIGR0cywgcHRzbm9ybSwgZHRzbm9ybSxcbiAgICAgICAgZmxhZ3MsXG4gICAgICAgIHNhbXBsZXMgPSBbXTtcbiAgICAvKiBjb25jYXRlbmF0ZSB0aGUgdmlkZW8gZGF0YSBhbmQgY29uc3RydWN0IHRoZSBtZGF0IGluIHBsYWNlXG4gICAgICAobmVlZCA4IG1vcmUgYnl0ZXMgdG8gZmlsbCBsZW5ndGggYW5kIG1wZGF0IHR5cGUpICovXG4gICAgbWRhdCA9IG5ldyBVaW50OEFycmF5KHRyYWNrLmxlbiArICg0ICogdHJhY2submJOYWx1KSArIDgpO1xuICAgIHZpZXcgPSBuZXcgRGF0YVZpZXcobWRhdC5idWZmZXIpO1xuICAgIHZpZXcuc2V0VWludDMyKDAsIG1kYXQuYnl0ZUxlbmd0aCk7XG4gICAgbWRhdC5zZXQoTVA0LnR5cGVzLm1kYXQsIDQpO1xuICAgIHdoaWxlICh0cmFjay5zYW1wbGVzLmxlbmd0aCkge1xuICAgICAgYXZjU2FtcGxlID0gdHJhY2suc2FtcGxlcy5zaGlmdCgpO1xuICAgICAgbXA0U2FtcGxlTGVuZ3RoID0gMDtcbiAgICAgIC8vIGNvbnZlcnQgTkFMVSBiaXRzdHJlYW0gdG8gTVA0IGZvcm1hdCAocHJlcGVuZCBOQUxVIHdpdGggc2l6ZSBmaWVsZClcbiAgICAgIHdoaWxlIChhdmNTYW1wbGUudW5pdHMudW5pdHMubGVuZ3RoKSB7XG4gICAgICAgIHVuaXQgPSBhdmNTYW1wbGUudW5pdHMudW5pdHMuc2hpZnQoKTtcbiAgICAgICAgdmlldy5zZXRVaW50MzIob2Zmc2V0LCB1bml0LmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICAgIG9mZnNldCArPSA0O1xuICAgICAgICBtZGF0LnNldCh1bml0LmRhdGEsIG9mZnNldCk7XG4gICAgICAgIG9mZnNldCArPSB1bml0LmRhdGEuYnl0ZUxlbmd0aDtcbiAgICAgICAgbXA0U2FtcGxlTGVuZ3RoICs9IDQgKyB1bml0LmRhdGEuYnl0ZUxlbmd0aDtcbiAgICAgIH1cbiAgICAgIHB0cyA9IGF2Y1NhbXBsZS5wdHMgLSB0aGlzLl9pbml0RFRTO1xuICAgICAgZHRzID0gYXZjU2FtcGxlLmR0cyAtIHRoaXMuX2luaXREVFM7XG4gICAgICAvLyBlbnN1cmUgRFRTIGlzIG5vdCBiaWdnZXIgdGhhbiBQVFNcbiAgICAgIGR0cyA9IE1hdGgubWluKHB0cyxkdHMpO1xuICAgICAgLy9sb2dnZXIubG9nKGBWaWRlby9QVFMvRFRTOiR7TWF0aC5yb3VuZChwdHMvOTApfS8ke01hdGgucm91bmQoZHRzLzkwKX1gKTtcbiAgICAgIC8vIGlmIG5vdCBmaXJzdCBBVkMgc2FtcGxlIG9mIHZpZGVvIHRyYWNrLCBub3JtYWxpemUgUFRTL0RUUyB3aXRoIHByZXZpb3VzIHNhbXBsZSB2YWx1ZVxuICAgICAgLy8gYW5kIGVuc3VyZSB0aGF0IHNhbXBsZSBkdXJhdGlvbiBpcyBwb3NpdGl2ZVxuICAgICAgaWYgKGxhc3REVFMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBwdHNub3JtID0gdGhpcy5fUFRTTm9ybWFsaXplKHB0cywgbGFzdERUUyk7XG4gICAgICAgIGR0c25vcm0gPSB0aGlzLl9QVFNOb3JtYWxpemUoZHRzLCBsYXN0RFRTKTtcbiAgICAgICAgdmFyIHNhbXBsZUR1cmF0aW9uID0gKGR0c25vcm0gLSBsYXN0RFRTKSAvIHBlczJtcDRTY2FsZUZhY3RvcjtcbiAgICAgICAgaWYgKHNhbXBsZUR1cmF0aW9uIDw9IDApIHtcbiAgICAgICAgICBsb2dnZXIubG9nKGBpbnZhbGlkIHNhbXBsZSBkdXJhdGlvbiBhdCBQVFMvRFRTOiAke2F2Y1NhbXBsZS5wdHN9LyR7YXZjU2FtcGxlLmR0c306JHtzYW1wbGVEdXJhdGlvbn1gKTtcbiAgICAgICAgICBzYW1wbGVEdXJhdGlvbiA9IDE7XG4gICAgICAgIH1cbiAgICAgICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gc2FtcGxlRHVyYXRpb247XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgbmV4dEF2Y0R0cyA9IHRoaXMubmV4dEF2Y0R0cyxkZWx0YTtcbiAgICAgICAgLy8gZmlyc3QgQVZDIHNhbXBsZSBvZiB2aWRlbyB0cmFjaywgbm9ybWFsaXplIFBUUy9EVFNcbiAgICAgICAgcHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShwdHMsIG5leHRBdmNEdHMpO1xuICAgICAgICBkdHNub3JtID0gdGhpcy5fUFRTTm9ybWFsaXplKGR0cywgbmV4dEF2Y0R0cyk7XG4gICAgICAgIGRlbHRhID0gTWF0aC5yb3VuZCgoZHRzbm9ybSAtIG5leHRBdmNEdHMpIC8gOTApO1xuICAgICAgICAvLyBpZiBmcmFnbWVudCBhcmUgY29udGlndW91cywgb3IgZGVsdGEgbGVzcyB0aGFuIDYwMG1zLCBlbnN1cmUgdGhlcmUgaXMgbm8gb3ZlcmxhcC9ob2xlIGJldHdlZW4gZnJhZ21lbnRzXG4gICAgICAgIGlmIChjb250aWd1b3VzIHx8IE1hdGguYWJzKGRlbHRhKSA8IDYwMCkge1xuICAgICAgICAgIGlmIChkZWx0YSkge1xuICAgICAgICAgICAgaWYgKGRlbHRhID4gMSkge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBBVkM6JHtkZWx0YX0gbXMgaG9sZSBiZXR3ZWVuIGZyYWdtZW50cyBkZXRlY3RlZCxmaWxsaW5nIGl0YCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGRlbHRhIDwgLTEpIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgQVZDOiR7KC1kZWx0YSl9IG1zIG92ZXJsYXBwaW5nIGJldHdlZW4gZnJhZ21lbnRzIGRldGVjdGVkYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBzZXQgRFRTIHRvIG5leHQgRFRTXG4gICAgICAgICAgICBkdHNub3JtID0gbmV4dEF2Y0R0cztcbiAgICAgICAgICAgIC8vIG9mZnNldCBQVFMgYXMgd2VsbCwgZW5zdXJlIHRoYXQgUFRTIGlzIHNtYWxsZXIgb3IgZXF1YWwgdGhhbiBuZXcgRFRTXG4gICAgICAgICAgICBwdHNub3JtID0gTWF0aC5tYXgocHRzbm9ybSAtIGRlbHRhLCBkdHNub3JtKTtcbiAgICAgICAgICAgIGxvZ2dlci5sb2coYFZpZGVvL1BUUy9EVFMgYWRqdXN0ZWQ6ICR7cHRzbm9ybX0vJHtkdHNub3JtfSxkZWx0YToke2RlbHRhfWApO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyByZW1lbWJlciBmaXJzdCBQVFMgb2Ygb3VyIGF2Y1NhbXBsZXMsIGVuc3VyZSB2YWx1ZSBpcyBwb3NpdGl2ZVxuICAgICAgICBmaXJzdFBUUyA9IE1hdGgubWF4KDAsIHB0c25vcm0pO1xuICAgICAgICBmaXJzdERUUyA9IE1hdGgubWF4KDAsIGR0c25vcm0pO1xuICAgICAgfVxuICAgICAgLy9jb25zb2xlLmxvZygnUFRTL0RUUy9pbml0RFRTL25vcm1QVFMvbm9ybURUUy9yZWxhdGl2ZSBQVFMgOiAke2F2Y1NhbXBsZS5wdHN9LyR7YXZjU2FtcGxlLmR0c30vJHt0aGlzLl9pbml0RFRTfS8ke3B0c25vcm19LyR7ZHRzbm9ybX0vJHsoYXZjU2FtcGxlLnB0cy80Mjk0OTY3Mjk2KS50b0ZpeGVkKDMpfScpO1xuICAgICAgbXA0U2FtcGxlID0ge1xuICAgICAgICBzaXplOiBtcDRTYW1wbGVMZW5ndGgsXG4gICAgICAgIGR1cmF0aW9uOiAwLFxuICAgICAgICBjdHM6IChwdHNub3JtIC0gZHRzbm9ybSkgLyBwZXMybXA0U2NhbGVGYWN0b3IsXG4gICAgICAgIGZsYWdzOiB7XG4gICAgICAgICAgaXNMZWFkaW5nOiAwLFxuICAgICAgICAgIGlzRGVwZW5kZWRPbjogMCxcbiAgICAgICAgICBoYXNSZWR1bmRhbmN5OiAwLFxuICAgICAgICAgIGRlZ3JhZFByaW86IDBcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIGZsYWdzID0gbXA0U2FtcGxlLmZsYWdzO1xuICAgICAgaWYgKGF2Y1NhbXBsZS5rZXkgPT09IHRydWUpIHtcbiAgICAgICAgLy8gdGhlIGN1cnJlbnQgc2FtcGxlIGlzIGEga2V5IGZyYW1lXG4gICAgICAgIGZsYWdzLmRlcGVuZHNPbiA9IDI7XG4gICAgICAgIGZsYWdzLmlzTm9uU3luYyA9IDA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmbGFncy5kZXBlbmRzT24gPSAxO1xuICAgICAgICBmbGFncy5pc05vblN5bmMgPSAxO1xuICAgICAgfVxuICAgICAgc2FtcGxlcy5wdXNoKG1wNFNhbXBsZSk7XG4gICAgICBsYXN0RFRTID0gZHRzbm9ybTtcbiAgICB9XG4gICAgdmFyIGxhc3RTYW1wbGVEdXJhdGlvbiA9IDA7XG4gICAgaWYgKHNhbXBsZXMubGVuZ3RoID49IDIpIHtcbiAgICAgIGxhc3RTYW1wbGVEdXJhdGlvbiA9IHNhbXBsZXNbc2FtcGxlcy5sZW5ndGggLSAyXS5kdXJhdGlvbjtcbiAgICAgIG1wNFNhbXBsZS5kdXJhdGlvbiA9IGxhc3RTYW1wbGVEdXJhdGlvbjtcbiAgICB9XG4gICAgLy8gbmV4dCBBVkMgc2FtcGxlIERUUyBzaG91bGQgYmUgZXF1YWwgdG8gbGFzdCBzYW1wbGUgRFRTICsgbGFzdCBzYW1wbGUgZHVyYXRpb25cbiAgICB0aGlzLm5leHRBdmNEdHMgPSBkdHNub3JtICsgbGFzdFNhbXBsZUR1cmF0aW9uICogcGVzMm1wNFNjYWxlRmFjdG9yO1xuICAgIHRyYWNrLmxlbiA9IDA7XG4gICAgdHJhY2submJOYWx1ID0gMDtcbiAgICBpZihzYW1wbGVzLmxlbmd0aCAmJiBuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkuaW5kZXhPZignY2hyb21lJykgPiAtMSkge1xuICAgICAgZmxhZ3MgPSBzYW1wbGVzWzBdLmZsYWdzO1xuICAgIC8vIGNocm9tZSB3b3JrYXJvdW5kLCBtYXJrIGZpcnN0IHNhbXBsZSBhcyBiZWluZyBhIFJhbmRvbSBBY2Nlc3MgUG9pbnQgdG8gYXZvaWQgc291cmNlYnVmZmVyIGFwcGVuZCBpc3N1ZVxuICAgIC8vIGh0dHBzOi8vY29kZS5nb29nbGUuY29tL3AvY2hyb21pdW0vaXNzdWVzL2RldGFpbD9pZD0yMjk0MTJcbiAgICAgIGZsYWdzLmRlcGVuZHNPbiA9IDI7XG4gICAgICBmbGFncy5pc05vblN5bmMgPSAwO1xuICAgIH1cbiAgICB0cmFjay5zYW1wbGVzID0gc2FtcGxlcztcbiAgICBtb29mID0gTVA0Lm1vb2YodHJhY2suc2VxdWVuY2VOdW1iZXIrKywgZmlyc3REVFMgLyBwZXMybXA0U2NhbGVGYWN0b3IsIHRyYWNrKTtcbiAgICB0cmFjay5zYW1wbGVzID0gW107XG4gICAgdGhpcy5vYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLCB7XG4gICAgICBtb29mOiBtb29mLFxuICAgICAgbWRhdDogbWRhdCxcbiAgICAgIHN0YXJ0UFRTOiBmaXJzdFBUUyAvIHBlc1RpbWVTY2FsZSxcbiAgICAgIGVuZFBUUzogKHB0c25vcm0gKyBwZXMybXA0U2NhbGVGYWN0b3IgKiBsYXN0U2FtcGxlRHVyYXRpb24pIC8gcGVzVGltZVNjYWxlLFxuICAgICAgc3RhcnREVFM6IGZpcnN0RFRTIC8gcGVzVGltZVNjYWxlLFxuICAgICAgZW5kRFRTOiB0aGlzLm5leHRBdmNEdHMgLyBwZXNUaW1lU2NhbGUsXG4gICAgICB0eXBlOiAndmlkZW8nLFxuICAgICAgbmI6IHNhbXBsZXMubGVuZ3RoXG4gICAgfSk7XG4gIH1cblxuICByZW11eEF1ZGlvKHRyYWNrLHRpbWVPZmZzZXQsIGNvbnRpZ3VvdXMpIHtcbiAgICB2YXIgdmlldyxcbiAgICAgICAgb2Zmc2V0ID0gOCxcbiAgICAgICAgcGVzVGltZVNjYWxlID0gdGhpcy5QRVNfVElNRVNDQUxFLFxuICAgICAgICBwZXMybXA0U2NhbGVGYWN0b3IgPSB0aGlzLlBFUzJNUDRTQ0FMRUZBQ1RPUixcbiAgICAgICAgYWFjU2FtcGxlLCBtcDRTYW1wbGUsXG4gICAgICAgIHVuaXQsXG4gICAgICAgIG1kYXQsIG1vb2YsXG4gICAgICAgIGZpcnN0UFRTLCBmaXJzdERUUywgbGFzdERUUyxcbiAgICAgICAgcHRzLCBkdHMsIHB0c25vcm0sIGR0c25vcm0sXG4gICAgICAgIHNhbXBsZXMgPSBbXSxcbiAgICAgICAgc2FtcGxlczAgPSBbXTtcblxuICAgIHRyYWNrLnNhbXBsZXMuZm9yRWFjaChhYWNTYW1wbGUgPT4ge1xuICAgICAgaWYocHRzID09PSB1bmRlZmluZWQgfHwgYWFjU2FtcGxlLnB0cyA+IHB0cykge1xuICAgICAgICBzYW1wbGVzMC5wdXNoKGFhY1NhbXBsZSk7XG4gICAgICAgIHB0cyA9IGFhY1NhbXBsZS5wdHM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsb2dnZXIud2FybignZHJvcHBpbmcgcGFzdCBhdWRpbyBmcmFtZScpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgd2hpbGUgKHNhbXBsZXMwLmxlbmd0aCkge1xuICAgICAgYWFjU2FtcGxlID0gc2FtcGxlczAuc2hpZnQoKTtcbiAgICAgIHVuaXQgPSBhYWNTYW1wbGUudW5pdDtcbiAgICAgIHB0cyA9IGFhY1NhbXBsZS5wdHMgLSB0aGlzLl9pbml0RFRTO1xuICAgICAgZHRzID0gYWFjU2FtcGxlLmR0cyAtIHRoaXMuX2luaXREVFM7XG4gICAgICAvL2xvZ2dlci5sb2coYEF1ZGlvL1BUUzoke01hdGgucm91bmQocHRzLzkwKX1gKTtcbiAgICAgIC8vIGlmIG5vdCBmaXJzdCBzYW1wbGVcbiAgICAgIGlmIChsYXN0RFRTICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShwdHMsIGxhc3REVFMpO1xuICAgICAgICBkdHNub3JtID0gdGhpcy5fUFRTTm9ybWFsaXplKGR0cywgbGFzdERUUyk7XG4gICAgICAgIC8vIGxldCdzIGNvbXB1dGUgc2FtcGxlIGR1cmF0aW9uXG4gICAgICAgIG1wNFNhbXBsZS5kdXJhdGlvbiA9IChkdHNub3JtIC0gbGFzdERUUykgLyBwZXMybXA0U2NhbGVGYWN0b3I7XG4gICAgICAgIGlmIChtcDRTYW1wbGUuZHVyYXRpb24gPCAwKSB7XG4gICAgICAgICAgLy8gbm90IGV4cGVjdGVkIHRvIGhhcHBlbiAuLi5cbiAgICAgICAgICBsb2dnZXIubG9nKGBpbnZhbGlkIEFBQyBzYW1wbGUgZHVyYXRpb24gYXQgUFRTOiR7YWFjU2FtcGxlLnB0c306JHttcDRTYW1wbGUuZHVyYXRpb259YCk7XG4gICAgICAgICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIG5leHRBYWNQdHMgPSB0aGlzLm5leHRBYWNQdHMsZGVsdGE7XG4gICAgICAgIHB0c25vcm0gPSB0aGlzLl9QVFNOb3JtYWxpemUocHRzLCBuZXh0QWFjUHRzKTtcbiAgICAgICAgZHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShkdHMsIG5leHRBYWNQdHMpO1xuICAgICAgICBkZWx0YSA9IE1hdGgucm91bmQoMTAwMCAqIChwdHNub3JtIC0gbmV4dEFhY1B0cykgLyBwZXNUaW1lU2NhbGUpO1xuICAgICAgICAvLyBpZiBmcmFnbWVudCBhcmUgY29udGlndW91cywgb3IgZGVsdGEgbGVzcyB0aGFuIDYwMG1zLCBlbnN1cmUgdGhlcmUgaXMgbm8gb3ZlcmxhcC9ob2xlIGJldHdlZW4gZnJhZ21lbnRzXG4gICAgICAgIGlmIChjb250aWd1b3VzIHx8IE1hdGguYWJzKGRlbHRhKSA8IDYwMCkge1xuICAgICAgICAgIC8vIGxvZyBkZWx0YVxuICAgICAgICAgIGlmIChkZWx0YSkge1xuICAgICAgICAgICAgaWYgKGRlbHRhID4gMCkge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGAke2RlbHRhfSBtcyBob2xlIGJldHdlZW4gQUFDIHNhbXBsZXMgZGV0ZWN0ZWQsZmlsbGluZyBpdGApO1xuICAgICAgICAgICAgICAvLyBpZiB3ZSBoYXZlIGZyYW1lIG92ZXJsYXAsIG92ZXJsYXBwaW5nIGZvciBtb3JlIHRoYW4gaGFsZiBhIGZyYW1lIGR1cmFpb25cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZGVsdGEgPCAtMTIpIHtcbiAgICAgICAgICAgICAgLy8gZHJvcCBvdmVybGFwcGluZyBhdWRpbyBmcmFtZXMuLi4gYnJvd3NlciB3aWxsIGRlYWwgd2l0aCBpdFxuICAgICAgICAgICAgICBsb2dnZXIubG9nKGAkeygtZGVsdGEpfSBtcyBvdmVybGFwcGluZyBiZXR3ZWVuIEFBQyBzYW1wbGVzIGRldGVjdGVkLCBkcm9wIGZyYW1lYCk7XG4gICAgICAgICAgICAgIHRyYWNrLmxlbiAtPSB1bml0LmJ5dGVMZW5ndGg7XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gc2V0IERUUyB0byBuZXh0IERUU1xuICAgICAgICAgICAgcHRzbm9ybSA9IGR0c25vcm0gPSBuZXh0QWFjUHRzO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyByZW1lbWJlciBmaXJzdCBQVFMgb2Ygb3VyIGFhY1NhbXBsZXMsIGVuc3VyZSB2YWx1ZSBpcyBwb3NpdGl2ZVxuICAgICAgICBmaXJzdFBUUyA9IE1hdGgubWF4KDAsIHB0c25vcm0pO1xuICAgICAgICBmaXJzdERUUyA9IE1hdGgubWF4KDAsIGR0c25vcm0pO1xuICAgICAgICAvKiBjb25jYXRlbmF0ZSB0aGUgYXVkaW8gZGF0YSBhbmQgY29uc3RydWN0IHRoZSBtZGF0IGluIHBsYWNlXG4gICAgICAgICAgKG5lZWQgOCBtb3JlIGJ5dGVzIHRvIGZpbGwgbGVuZ3RoIGFuZCBtZGF0IHR5cGUpICovXG4gICAgICAgIG1kYXQgPSBuZXcgVWludDhBcnJheSh0cmFjay5sZW4gKyA4KTtcbiAgICAgICAgdmlldyA9IG5ldyBEYXRhVmlldyhtZGF0LmJ1ZmZlcik7XG4gICAgICAgIHZpZXcuc2V0VWludDMyKDAsIG1kYXQuYnl0ZUxlbmd0aCk7XG4gICAgICAgIG1kYXQuc2V0KE1QNC50eXBlcy5tZGF0LCA0KTtcbiAgICAgIH1cbiAgICAgIG1kYXQuc2V0KHVuaXQsIG9mZnNldCk7XG4gICAgICBvZmZzZXQgKz0gdW5pdC5ieXRlTGVuZ3RoO1xuICAgICAgLy9jb25zb2xlLmxvZygnUFRTL0RUUy9pbml0RFRTL25vcm1QVFMvbm9ybURUUy9yZWxhdGl2ZSBQVFMgOiAke2FhY1NhbXBsZS5wdHN9LyR7YWFjU2FtcGxlLmR0c30vJHt0aGlzLl9pbml0RFRTfS8ke3B0c25vcm19LyR7ZHRzbm9ybX0vJHsoYWFjU2FtcGxlLnB0cy80Mjk0OTY3Mjk2KS50b0ZpeGVkKDMpfScpO1xuICAgICAgbXA0U2FtcGxlID0ge1xuICAgICAgICBzaXplOiB1bml0LmJ5dGVMZW5ndGgsXG4gICAgICAgIGN0czogMCxcbiAgICAgICAgZHVyYXRpb246MCxcbiAgICAgICAgZmxhZ3M6IHtcbiAgICAgICAgICBpc0xlYWRpbmc6IDAsXG4gICAgICAgICAgaXNEZXBlbmRlZE9uOiAwLFxuICAgICAgICAgIGhhc1JlZHVuZGFuY3k6IDAsXG4gICAgICAgICAgZGVncmFkUHJpbzogMCxcbiAgICAgICAgICBkZXBlbmRzT246IDEsXG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICBzYW1wbGVzLnB1c2gobXA0U2FtcGxlKTtcbiAgICAgIGxhc3REVFMgPSBkdHNub3JtO1xuICAgIH1cbiAgICB2YXIgbGFzdFNhbXBsZUR1cmF0aW9uID0gMDtcbiAgICB2YXIgbmJTYW1wbGVzID0gc2FtcGxlcy5sZW5ndGg7XG4gICAgLy9zZXQgbGFzdCBzYW1wbGUgZHVyYXRpb24gYXMgYmVpbmcgaWRlbnRpY2FsIHRvIHByZXZpb3VzIHNhbXBsZVxuICAgIGlmIChuYlNhbXBsZXMgPj0gMikge1xuICAgICAgbGFzdFNhbXBsZUR1cmF0aW9uID0gc2FtcGxlc1tuYlNhbXBsZXMgLSAyXS5kdXJhdGlvbjtcbiAgICAgIG1wNFNhbXBsZS5kdXJhdGlvbiA9IGxhc3RTYW1wbGVEdXJhdGlvbjtcbiAgICB9XG4gICAgaWYgKG5iU2FtcGxlcykge1xuICAgICAgLy8gbmV4dCBhYWMgc2FtcGxlIFBUUyBzaG91bGQgYmUgZXF1YWwgdG8gbGFzdCBzYW1wbGUgUFRTICsgZHVyYXRpb25cbiAgICAgIHRoaXMubmV4dEFhY1B0cyA9IHB0c25vcm0gKyBwZXMybXA0U2NhbGVGYWN0b3IgKiBsYXN0U2FtcGxlRHVyYXRpb247XG4gICAgICAvL2xvZ2dlci5sb2coJ0F1ZGlvL1BUUy9QVFNlbmQ6JyArIGFhY1NhbXBsZS5wdHMudG9GaXhlZCgwKSArICcvJyArIHRoaXMubmV4dEFhY0R0cy50b0ZpeGVkKDApKTtcbiAgICAgIHRyYWNrLmxlbiA9IDA7XG4gICAgICB0cmFjay5zYW1wbGVzID0gc2FtcGxlcztcbiAgICAgIG1vb2YgPSBNUDQubW9vZih0cmFjay5zZXF1ZW5jZU51bWJlcisrLCBmaXJzdERUUyAvIHBlczJtcDRTY2FsZUZhY3RvciwgdHJhY2spO1xuICAgICAgdHJhY2suc2FtcGxlcyA9IFtdO1xuICAgICAgdGhpcy5vYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLCB7XG4gICAgICAgIG1vb2Y6IG1vb2YsXG4gICAgICAgIG1kYXQ6IG1kYXQsXG4gICAgICAgIHN0YXJ0UFRTOiBmaXJzdFBUUyAvIHBlc1RpbWVTY2FsZSxcbiAgICAgICAgZW5kUFRTOiB0aGlzLm5leHRBYWNQdHMgLyBwZXNUaW1lU2NhbGUsXG4gICAgICAgIHN0YXJ0RFRTOiBmaXJzdERUUyAvIHBlc1RpbWVTY2FsZSxcbiAgICAgICAgZW5kRFRTOiAoZHRzbm9ybSArIHBlczJtcDRTY2FsZUZhY3RvciAqIGxhc3RTYW1wbGVEdXJhdGlvbikgLyBwZXNUaW1lU2NhbGUsXG4gICAgICAgIHR5cGU6ICdhdWRpbycsXG4gICAgICAgIG5iOiBuYlNhbXBsZXNcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIHJlbXV4SUQzKHRyYWNrLHRpbWVPZmZzZXQpIHtcbiAgICB2YXIgbGVuZ3RoID0gdHJhY2suc2FtcGxlcy5sZW5ndGgsIHNhbXBsZTtcbiAgICAvLyBjb25zdW1lIHNhbXBsZXNcbiAgICBpZihsZW5ndGgpIHtcbiAgICAgIGZvcih2YXIgaW5kZXggPSAwOyBpbmRleCA8IGxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICBzYW1wbGUgPSB0cmFjay5zYW1wbGVzW2luZGV4XTtcbiAgICAgICAgLy8gc2V0dGluZyBpZDMgcHRzLCBkdHMgdG8gcmVsYXRpdmUgdGltZVxuICAgICAgICAvLyB1c2luZyB0aGlzLl9pbml0UFRTIGFuZCB0aGlzLl9pbml0RFRTIHRvIGNhbGN1bGF0ZSByZWxhdGl2ZSB0aW1lXG4gICAgICAgIHNhbXBsZS5wdHMgPSAoKHNhbXBsZS5wdHMgLSB0aGlzLl9pbml0UFRTKSAvIHRoaXMuUEVTX1RJTUVTQ0FMRSk7XG4gICAgICAgIHNhbXBsZS5kdHMgPSAoKHNhbXBsZS5kdHMgLSB0aGlzLl9pbml0RFRTKSAvIHRoaXMuUEVTX1RJTUVTQ0FMRSk7XG4gICAgICB9XG4gICAgICB0aGlzLm9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX01FVEFEQVRBLCB7XG4gICAgICAgIHNhbXBsZXM6dHJhY2suc2FtcGxlc1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgdHJhY2suc2FtcGxlcyA9IFtdO1xuICAgIHRpbWVPZmZzZXQgPSB0aW1lT2Zmc2V0O1xuICB9XG5cbiAgcmVtdXhUZXh0KHRyYWNrLHRpbWVPZmZzZXQpIHtcbiAgICB0cmFjay5zYW1wbGVzLnNvcnQoZnVuY3Rpb24oYSwgYikge1xuICAgICAgaWYgKGEucHRzIDwgYi5wdHMpXG4gICAgICB7XG4gICAgICAgIHJldHVybiAtMTtcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKGEucHRzID4gYi5wdHMpXG4gICAgICB7XG4gICAgICAgIHJldHVybiAxO1xuICAgICAgfVxuICAgICAgZWxzZVxuICAgICAge1xuICAgICAgICByZXR1cm4gMDtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHZhciBsZW5ndGggPSB0cmFjay5zYW1wbGVzLmxlbmd0aCwgc2FtcGxlO1xuICAgIC8vIGNvbnN1bWUgc2FtcGxlc1xuICAgIGlmKGxlbmd0aCkge1xuICAgICAgZm9yKHZhciBpbmRleCA9IDA7IGluZGV4IDwgbGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgIHNhbXBsZSA9IHRyYWNrLnNhbXBsZXNbaW5kZXhdO1xuICAgICAgICAvLyBzZXR0aW5nIHRleHQgcHRzLCBkdHMgdG8gcmVsYXRpdmUgdGltZVxuICAgICAgICAvLyB1c2luZyB0aGlzLl9pbml0UFRTIGFuZCB0aGlzLl9pbml0RFRTIHRvIGNhbGN1bGF0ZSByZWxhdGl2ZSB0aW1lXG4gICAgICAgIHNhbXBsZS5wdHMgPSAoKHNhbXBsZS5wdHMgLSB0aGlzLl9pbml0UFRTKSAvIHRoaXMuUEVTX1RJTUVTQ0FMRSk7XG4gICAgICB9XG4gICAgICB0aGlzLm9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX1VTRVJEQVRBLCB7XG4gICAgICAgIHNhbXBsZXM6dHJhY2suc2FtcGxlc1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgdHJhY2suc2FtcGxlcyA9IFtdO1xuICAgIHRpbWVPZmZzZXQgPSB0aW1lT2Zmc2V0O1xuICB9XG4gIFxuICBfUFRTTm9ybWFsaXplKHZhbHVlLCByZWZlcmVuY2UpIHtcbiAgICB2YXIgb2Zmc2V0O1xuICAgIGlmIChyZWZlcmVuY2UgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cbiAgICBpZiAocmVmZXJlbmNlIDwgdmFsdWUpIHtcbiAgICAgIC8vIC0gMl4zM1xuICAgICAgb2Zmc2V0ID0gLTg1ODk5MzQ1OTI7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vICsgMl4zM1xuICAgICAgb2Zmc2V0ID0gODU4OTkzNDU5MjtcbiAgICB9XG4gICAgLyogUFRTIGlzIDMzYml0IChmcm9tIDAgdG8gMl4zMyAtMSlcbiAgICAgIGlmIGRpZmYgYmV0d2VlbiB2YWx1ZSBhbmQgcmVmZXJlbmNlIGlzIGJpZ2dlciB0aGFuIGhhbGYgb2YgdGhlIGFtcGxpdHVkZSAoMl4zMikgdGhlbiBpdCBtZWFucyB0aGF0XG4gICAgICBQVFMgbG9vcGluZyBvY2N1cmVkLiBmaWxsIHRoZSBnYXAgKi9cbiAgICB3aGlsZSAoTWF0aC5hYnModmFsdWUgLSByZWZlcmVuY2UpID4gNDI5NDk2NzI5Nikge1xuICAgICAgICB2YWx1ZSArPSBvZmZzZXQ7XG4gICAgfVxuICAgIHJldHVybiB2YWx1ZTtcbiAgfVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IE1QNFJlbXV4ZXI7XG4iLCJcbi8vIGFkYXB0ZWQgZnJvbSBodHRwczovL2dpdGh1Yi5jb20va2Fub25naWwvbm9kZS1tM3U4cGFyc2UvYmxvYi9tYXN0ZXIvYXR0cmxpc3QuanNcbmNsYXNzIEF0dHJMaXN0IHtcblxuICBjb25zdHJ1Y3RvcihhdHRycykge1xuICAgIGlmICh0eXBlb2YgYXR0cnMgPT09ICdzdHJpbmcnKSB7XG4gICAgICBhdHRycyA9IEF0dHJMaXN0LnBhcnNlQXR0ckxpc3QoYXR0cnMpO1xuICAgIH1cbiAgICBmb3IodmFyIGF0dHIgaW4gYXR0cnMpe1xuICAgICAgaWYoYXR0cnMuaGFzT3duUHJvcGVydHkoYXR0cikpIHtcbiAgICAgICAgdGhpc1thdHRyXSA9IGF0dHJzW2F0dHJdO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGRlY2ltYWxJbnRlZ2VyKGF0dHJOYW1lKSB7XG4gICAgY29uc3QgaW50VmFsdWUgPSBwYXJzZUludCh0aGlzW2F0dHJOYW1lXSwgMTApO1xuICAgIGlmIChpbnRWYWx1ZSA+IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSKSB7XG4gICAgICByZXR1cm4gSW5maW5pdHk7XG4gICAgfVxuICAgIHJldHVybiBpbnRWYWx1ZTtcbiAgfVxuXG4gIGhleGFkZWNpbWFsSW50ZWdlcihhdHRyTmFtZSkge1xuICAgIGlmKHRoaXNbYXR0ck5hbWVdKSB7XG4gICAgICBsZXQgc3RyaW5nVmFsdWUgPSAodGhpc1thdHRyTmFtZV0gfHwgJzB4Jykuc2xpY2UoMik7XG4gICAgICBzdHJpbmdWYWx1ZSA9ICgoc3RyaW5nVmFsdWUubGVuZ3RoICYgMSkgPyAnMCcgOiAnJykgKyBzdHJpbmdWYWx1ZTtcblxuICAgICAgY29uc3QgdmFsdWUgPSBuZXcgVWludDhBcnJheShzdHJpbmdWYWx1ZS5sZW5ndGggLyAyKTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RyaW5nVmFsdWUubGVuZ3RoIC8gMjsgaSsrKSB7XG4gICAgICAgIHZhbHVlW2ldID0gcGFyc2VJbnQoc3RyaW5nVmFsdWUuc2xpY2UoaSAqIDIsIGkgKiAyICsgMiksIDE2KTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgaGV4YWRlY2ltYWxJbnRlZ2VyQXNOdW1iZXIoYXR0ck5hbWUpIHtcbiAgICBjb25zdCBpbnRWYWx1ZSA9IHBhcnNlSW50KHRoaXNbYXR0ck5hbWVdLCAxNik7XG4gICAgaWYgKGludFZhbHVlID4gTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIpIHtcbiAgICAgIHJldHVybiBJbmZpbml0eTtcbiAgICB9XG4gICAgcmV0dXJuIGludFZhbHVlO1xuICB9XG5cbiAgZGVjaW1hbEZsb2F0aW5nUG9pbnQoYXR0ck5hbWUpIHtcbiAgICByZXR1cm4gcGFyc2VGbG9hdCh0aGlzW2F0dHJOYW1lXSk7XG4gIH1cblxuICBlbnVtZXJhdGVkU3RyaW5nKGF0dHJOYW1lKSB7XG4gICAgcmV0dXJuIHRoaXNbYXR0ck5hbWVdO1xuICB9XG5cbiAgZGVjaW1hbFJlc29sdXRpb24oYXR0ck5hbWUpIHtcbiAgICBjb25zdCByZXMgPSAvXihcXGQrKXgoXFxkKykkLy5leGVjKHRoaXNbYXR0ck5hbWVdKTtcbiAgICBpZiAocmVzID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgd2lkdGg6IHBhcnNlSW50KHJlc1sxXSwgMTApLFxuICAgICAgaGVpZ2h0OiBwYXJzZUludChyZXNbMl0sIDEwKVxuICAgIH07XG4gIH1cblxuICBzdGF0aWMgcGFyc2VBdHRyTGlzdChpbnB1dCkge1xuICAgIGNvbnN0IHJlID0gL1xccyooLis/KVxccyo9KCg/OlxcXCIuKj9cXFwiKXwuKj8pKD86LHwkKS9nO1xuICAgIHZhciBtYXRjaCwgYXR0cnMgPSB7fTtcbiAgICB3aGlsZSAoKG1hdGNoID0gcmUuZXhlYyhpbnB1dCkpICE9PSBudWxsKSB7XG4gICAgICB2YXIgdmFsdWUgPSBtYXRjaFsyXSwgcXVvdGUgPSAnXCInO1xuXG4gICAgICBpZiAodmFsdWUuaW5kZXhPZihxdW90ZSkgPT09IDAgJiZcbiAgICAgICAgICB2YWx1ZS5sYXN0SW5kZXhPZihxdW90ZSkgPT09ICh2YWx1ZS5sZW5ndGgtMSkpIHtcbiAgICAgICAgdmFsdWUgPSB2YWx1ZS5zbGljZSgxLCAtMSk7XG4gICAgICB9XG4gICAgICBhdHRyc1ttYXRjaFsxXV0gPSB2YWx1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGF0dHJzO1xuICB9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgQXR0ckxpc3Q7XG4iLCJ2YXIgQmluYXJ5U2VhcmNoID0ge1xuICAgIC8qKlxuICAgICAqIFNlYXJjaGVzIGZvciBhbiBpdGVtIGluIGFuIGFycmF5IHdoaWNoIG1hdGNoZXMgYSBjZXJ0YWluIGNvbmRpdGlvbi5cbiAgICAgKiBUaGlzIHJlcXVpcmVzIHRoZSBjb25kaXRpb24gdG8gb25seSBtYXRjaCBvbmUgaXRlbSBpbiB0aGUgYXJyYXksXG4gICAgICogYW5kIGZvciB0aGUgYXJyYXkgdG8gYmUgb3JkZXJlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXJyYXl9IGxpc3QgVGhlIGFycmF5IHRvIHNlYXJjaC5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjb21wYXJpc29uRnVuY3Rpb25cbiAgICAgKiAgICAgIENhbGxlZCBhbmQgcHJvdmlkZWQgYSBjYW5kaWRhdGUgaXRlbSBhcyB0aGUgZmlyc3QgYXJndW1lbnQuXG4gICAgICogICAgICBTaG91bGQgcmV0dXJuOlxuICAgICAqICAgICAgICAgID4gLTEgaWYgdGhlIGl0ZW0gc2hvdWxkIGJlIGxvY2F0ZWQgYXQgYSBsb3dlciBpbmRleCB0aGFuIHRoZSBwcm92aWRlZCBpdGVtLlxuICAgICAqICAgICAgICAgID4gMSBpZiB0aGUgaXRlbSBzaG91bGQgYmUgbG9jYXRlZCBhdCBhIGhpZ2hlciBpbmRleCB0aGFuIHRoZSBwcm92aWRlZCBpdGVtLlxuICAgICAqICAgICAgICAgID4gMCBpZiB0aGUgaXRlbSBpcyB0aGUgaXRlbSB5b3UncmUgbG9va2luZyBmb3IuXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHsqfSBUaGUgb2JqZWN0IGlmIGl0IGlzIGZvdW5kIG9yIG51bGwgb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIHNlYXJjaDogZnVuY3Rpb24obGlzdCwgY29tcGFyaXNvbkZ1bmN0aW9uKSB7XG4gICAgICAgIHZhciBtaW5JbmRleCA9IDA7XG4gICAgICAgIHZhciBtYXhJbmRleCA9IGxpc3QubGVuZ3RoIC0gMTtcbiAgICAgICAgdmFyIGN1cnJlbnRJbmRleCA9IG51bGw7XG4gICAgICAgIHZhciBjdXJyZW50RWxlbWVudCA9IG51bGw7XG4gICAgIFxuICAgICAgICB3aGlsZSAobWluSW5kZXggPD0gbWF4SW5kZXgpIHtcbiAgICAgICAgICAgIGN1cnJlbnRJbmRleCA9IChtaW5JbmRleCArIG1heEluZGV4KSAvIDIgfCAwO1xuICAgICAgICAgICAgY3VycmVudEVsZW1lbnQgPSBsaXN0W2N1cnJlbnRJbmRleF07XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHZhciBjb21wYXJpc29uUmVzdWx0ID0gY29tcGFyaXNvbkZ1bmN0aW9uKGN1cnJlbnRFbGVtZW50KTtcbiAgICAgICAgICAgIGlmIChjb21wYXJpc29uUmVzdWx0ID4gMCkge1xuICAgICAgICAgICAgICAgIG1pbkluZGV4ID0gY3VycmVudEluZGV4ICsgMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGNvbXBhcmlzb25SZXN1bHQgPCAwKSB7XG4gICAgICAgICAgICAgICAgbWF4SW5kZXggPSBjdXJyZW50SW5kZXggLSAxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGN1cnJlbnRFbGVtZW50O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgIFxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEJpbmFyeVNlYXJjaDtcbiIsIi8qXG4gKiBDRUEtNzA4IGludGVycHJldGVyXG4qL1xuXG5jbGFzcyBDRUE3MDhJbnRlcnByZXRlciB7XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gIH1cblxuICBhdHRhY2gobWVkaWEpIHtcbiAgICB0aGlzLm1lZGlhID0gbWVkaWE7XG4gICAgdGhpcy5kaXNwbGF5ID0gW107XG4gICAgdGhpcy5tZW1vcnkgPSBbXTtcbiAgICB0aGlzLl9jcmVhdGVDdWUoKTtcbiAgfVxuXG4gIGRldGF0Y2goKVxuICB7XG4gICAgdGhpcy5jbGVhcigpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgfVxuXG4gIF9jcmVhdGVDdWUoKVxuICB7XG4gICAgdmFyIFZUVEN1ZSA9IHdpbmRvdy5WVFRDdWU7XG4gICAgXG4gICAgdGhpcy5jdWUgPSBuZXcgVlRUQ3VlKC0xLCAtMSwgJycpO1xuICAgIHRoaXMuY3VlLnRleHQgPSAnJztcbiAgICB0aGlzLmN1ZS5wYXVzZU9uRXhpdCA9IGZhbHNlO1xuXG4gICAgLy8gbWFrZSBzdXJlIGl0IGRvZXNuJ3Qgc2hvdyB1cCBiZWZvcmUgaXQncyByZWFkeVxuICAgIHRoaXMuc3RhcnRUaW1lID0gTnVtYmVyLk1BWF9WQUxVRTtcblxuICAgIC8vIHNob3cgaXQgJ2ZvcmV2ZXInIG9uY2Ugd2UgZG8gc2hvdyBpdFxuICAgIC8vICh3ZSdsbCBzZXQgdGhlIGVuZCB0aW1lIG9uY2Ugd2Uga25vdyBpdCBsYXRlcilcbiAgICB0aGlzLmN1ZS5lbmRUaW1lID0gTnVtYmVyLk1BWF9WQUxVRTtcblxuICAgIHRoaXMubWVtb3J5LnB1c2godGhpcy5jdWUpO1xuICB9XG5cbiAgY2xlYXIoKVxuICB7XG4gICAgaWYgKHRoaXMuX3RleHRUcmFjayAmJiB0aGlzLl90ZXh0VHJhY2suY3VlcylcbiAgICB7XG4gICAgICB3aGlsZSAodGhpcy5fdGV4dFRyYWNrLmN1ZXMubGVuZ3RoID4gMClcbiAgICAgIHtcbiAgICAgICAgdGhpcy5fdGV4dFRyYWNrLnJlbW92ZUN1ZSh0aGlzLl90ZXh0VHJhY2suY3Vlc1swXSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHVzaCh0aW1lc3RhbXAsIGJ5dGVzKVxuICB7XG4gICAgdmFyIGNvdW50ID0gYnl0ZXNbMF0gJiAzMTtcbiAgICB2YXIgcG9zaXRpb24gPSAyO1xuICAgIHZhciBieXRlLCBjY2J5dGUxLCBjY2J5dGUyLCBjY1ZhbGlkLCBjY1R5cGU7XG5cbiAgICBmb3IgKHZhciBqPTA7IGo8Y291bnQ7IGorKylcbiAgICB7XG4gICAgICBieXRlID0gYnl0ZXNbcG9zaXRpb24rK107XG4gICAgICBjY2J5dGUxID0gMHg3RiAmIGJ5dGVzW3Bvc2l0aW9uKytdO1xuICAgICAgY2NieXRlMiA9IDB4N0YgJiBieXRlc1twb3NpdGlvbisrXTtcbiAgICAgIGNjVmFsaWQgPSAoKDQgJiBieXRlKSA9PT0gMCA/IGZhbHNlIDogdHJ1ZSk7XG4gICAgICBjY1R5cGUgPSAoMyAmIGJ5dGUpO1xuXG4gICAgICBpZiAoY2NieXRlMSA9PT0gMCAmJiBjY2J5dGUyID09PSAwKVxuICAgICAge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKGNjVmFsaWQpXG4gICAgICB7XG4gICAgICAgIGlmIChjY1R5cGUgPT09IDApIC8vIHx8IGNjVHlwZSA9PT0gMVxuICAgICAgICB7XG4gICAgICAgICAgLy8gU3RhbmRhcmQgQ2hhcmFjdGVyc1xuICAgICAgICAgIGlmICgweDIwICYgY2NieXRlMSB8fCAweDQwICYgY2NieXRlMSlcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9IHRoaXMuX2Zyb21DaGFyQ29kZShjY2J5dGUxKSArIHRoaXMuX2Zyb21DaGFyQ29kZShjY2J5dGUyKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gU3BlY2lhbCBDaGFyYWN0ZXJzXG4gICAgICAgICAgZWxzZSBpZiAoKGNjYnl0ZTEgPT09IDB4MTEgfHwgY2NieXRlMSA9PT0gMHgxOSkgJiYgY2NieXRlMiA+PSAweDMwICYmIGNjYnl0ZTIgPD0gMHgzRilcbiAgICAgICAgICB7XG4gICAgICAgICAgICAvLyBleHRlbmRlZCBjaGFycywgZS5nLiBtdXNpY2FsIG5vdGUsIGFjY2VudHNcbiAgICAgICAgICAgIHN3aXRjaCAoY2NieXRlMilcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgY2FzZSA0ODpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICfCric7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNDk6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAnwrAnO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDUwOlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gJ8K9JztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA1MTpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICfCvyc7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNTI6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAn4oSiJztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA1MzpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICfCoic7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNTQ6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAnJztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA1NTpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICfCoyc7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNTY6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAn4pmqJztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA1NzpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICcgJztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA1ODpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICfDqCc7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNTk6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAnw6InO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDYwOlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gJ8OqJztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA2MTpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICfDric7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNjI6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAnw7QnO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDYzOlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gJ8O7JztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKChjY2J5dGUxID09PSAweDExIHx8IGNjYnl0ZTEgPT09IDB4MTkpICYmIGNjYnl0ZTIgPj0gMHgyMCAmJiBjY2J5dGUyIDw9IDB4MkYpXG4gICAgICAgICAge1xuICAgICAgICAgICAgLy8gTWlkLXJvdyBjb2RlczogY29sb3IvdW5kZXJsaW5lXG4gICAgICAgICAgICBzd2l0Y2ggKGNjYnl0ZTIpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGNhc2UgMHgyMDpcbiAgICAgICAgICAgICAgICAvLyBXaGl0ZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjE6XG4gICAgICAgICAgICAgICAgLy8gV2hpdGUgVW5kZXJsaW5lXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyMjpcbiAgICAgICAgICAgICAgICAvLyBHcmVlblxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjM6XG4gICAgICAgICAgICAgICAgLy8gR3JlZW4gVW5kZXJsaW5lXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyNDpcbiAgICAgICAgICAgICAgICAvLyBCbHVlXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyNTpcbiAgICAgICAgICAgICAgICAvLyBCbHVlIFVuZGVybGluZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjY6XG4gICAgICAgICAgICAgICAgLy8gQ3lhblxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4Mjc6XG4gICAgICAgICAgICAgICAgLy8gQ3lhbiBVbmRlcmxpbmVcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDI4OlxuICAgICAgICAgICAgICAgIC8vIFJlZFxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4Mjk6XG4gICAgICAgICAgICAgICAgLy8gUmVkIFVuZGVybGluZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkE6XG4gICAgICAgICAgICAgICAgLy8gWWVsbG93XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyQjpcbiAgICAgICAgICAgICAgICAvLyBZZWxsb3cgVW5kZXJsaW5lXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyQzpcbiAgICAgICAgICAgICAgICAvLyBNYWdlbnRhXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyRDpcbiAgICAgICAgICAgICAgICAvLyBNYWdlbnRhIFVuZGVybGluZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkU6XG4gICAgICAgICAgICAgICAgLy8gSXRhbGljc1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkY6XG4gICAgICAgICAgICAgICAgLy8gSXRhbGljcyBVbmRlcmxpbmVcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9ICAgICAgICAgIFxuICAgICAgICAgIGlmICgoY2NieXRlMSA9PT0gMHgxNCB8fCBjY2J5dGUxID09PSAweDFDKSAmJiBjY2J5dGUyID49IDB4MjAgJiYgY2NieXRlMiA8PSAweDJGKVxuICAgICAgICAgIHtcbiAgICAgICAgICAgIC8vIE1pZC1yb3cgY29kZXM6IGNvbG9yL3VuZGVybGluZVxuICAgICAgICAgICAgc3dpdGNoIChjY2J5dGUyKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBjYXNlIDB4MjA6XG4gICAgICAgICAgICAgICAgLy8gVE9ETzogc2hvdWxkbid0IGFmZmVjdCByb2xsLXVwcy4uLlxuICAgICAgICAgICAgICAgIHRoaXMuX2NsZWFyQWN0aXZlQ3Vlcyh0aW1lc3RhbXApO1xuICAgICAgICAgICAgICAgIC8vIFJDTDogUmVzdW1lIENhcHRpb24gTG9hZGluZ1xuICAgICAgICAgICAgICAgIC8vIGJlZ2luIHBvcCBvblxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjE6XG4gICAgICAgICAgICAgICAgLy8gQlM6IEJhY2tzcGFjZVxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgPSB0aGlzLmN1ZS50ZXh0LnN1YnN0cigwLCB0aGlzLmN1ZS50ZXh0Lmxlbmd0aC0xKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDIyOlxuICAgICAgICAgICAgICAgIC8vIEFPRjogcmVzZXJ2ZWQgKGZvcm1lcmx5IGFsYXJtIG9mZilcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDIzOlxuICAgICAgICAgICAgICAgIC8vIEFPTjogcmVzZXJ2ZWQgKGZvcm1lcmx5IGFsYXJtIG9uKVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjQ6XG4gICAgICAgICAgICAgICAgLy8gREVSOiBEZWxldGUgdG8gZW5kIG9mIHJvd1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjU6XG4gICAgICAgICAgICAgICAgLy8gUlUyOiByb2xsLXVwIDIgcm93c1xuICAgICAgICAgICAgICAgIC8vdGhpcy5fcm9sbHVwKDIpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjY6XG4gICAgICAgICAgICAgICAgLy8gUlUzOiByb2xsLXVwIDMgcm93c1xuICAgICAgICAgICAgICAgIC8vdGhpcy5fcm9sbHVwKDMpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4Mjc6XG4gICAgICAgICAgICAgICAgLy8gUlU0OiByb2xsLXVwIDQgcm93c1xuICAgICAgICAgICAgICAgIC8vdGhpcy5fcm9sbHVwKDQpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4Mjg6XG4gICAgICAgICAgICAgICAgLy8gRk9OOiBGbGFzaCBvblxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4Mjk6XG4gICAgICAgICAgICAgICAgLy8gUkRDOiBSZXN1bWUgZGlyZWN0IGNhcHRpb25pbmdcbiAgICAgICAgICAgICAgICB0aGlzLl9jbGVhckFjdGl2ZUN1ZXModGltZXN0YW1wKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDJBOlxuICAgICAgICAgICAgICAgIC8vIFRSOiBUZXh0IFJlc3RhcnRcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDJCOlxuICAgICAgICAgICAgICAgIC8vIFJURDogUmVzdW1lIFRleHQgRGlzcGxheVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkM6XG4gICAgICAgICAgICAgICAgLy8gRURNOiBFcmFzZSBEaXNwbGF5ZWQgTWVtb3J5XG4gICAgICAgICAgICAgICAgdGhpcy5fY2xlYXJBY3RpdmVDdWVzKHRpbWVzdGFtcCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyRDpcbiAgICAgICAgICAgICAgICAvLyBDUjogQ2FycmlhZ2UgUmV0dXJuXG4gICAgICAgICAgICAgICAgLy8gb25seSBhZmZlY3RzIHJvbGwtdXBcbiAgICAgICAgICAgICAgICAvL3RoaXMuX3JvbGx1cCgxKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDJFOlxuICAgICAgICAgICAgICAgIC8vIEVOTTogRXJhc2Ugbm9uLWRpc3BsYXllZCBtZW1vcnlcbiAgICAgICAgICAgICAgICB0aGlzLl90ZXh0ID0gJyc7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyRjpcbiAgICAgICAgICAgICAgICB0aGlzLl9mbGlwTWVtb3J5KHRpbWVzdGFtcCk7XG4gICAgICAgICAgICAgICAgLy8gRU9DOiBFbmQgb2YgY2FwdGlvblxuICAgICAgICAgICAgICAgIC8vIGhpZGUgYW55IGRpc3BsYXllZCBjYXB0aW9ucyBhbmQgc2hvdyBhbnkgaGlkZGVuIG9uZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gICBcbiAgICAgICAgICBpZiAoKGNjYnl0ZTEgPT09IDB4MTcgfHwgY2NieXRlMSA9PT0gMHgxRikgJiYgY2NieXRlMiA+PSAweDIxICYmIGNjYnl0ZTIgPD0gMHgyMylcbiAgICAgICAgICB7XG4gICAgICAgICAgICAvLyBNaWQtcm93IGNvZGVzOiBjb2xvci91bmRlcmxpbmVcbiAgICAgICAgICAgIHN3aXRjaCAoY2NieXRlMilcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgY2FzZSAweDIxOlxuICAgICAgICAgICAgICAgIC8vIFRPMTogdGFiIG9mZnNldCAxIGNvbHVtblxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjI6XG4gICAgICAgICAgICAgICAgLy8gVE8xOiB0YWIgb2Zmc2V0IDIgY29sdW1uXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyMzpcbiAgICAgICAgICAgICAgICAvLyBUTzE6IHRhYiBvZmZzZXQgMyBjb2x1bW5cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAvLyBQcm9iYWJseSBhIHByZS1hbWJsZSBhZGRyZXNzIGNvZGVcbiAgICAgICAgICB9ICAgICAgICBcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gIFxuICB9XG5cbiAgX2Zyb21DaGFyQ29kZShieXRlKVxuICB7XG4gICAgaWYgKGJ5dGUgPT09IDQyKVxuICAgIHtcbiAgICAgIHJldHVybiAnw6EnO1xuICAgIH1cbiAgICBlbHNlIGlmIChieXRlID09PSA5MilcbiAgICB7XG4gICAgICByZXR1cm4gJ8OpJztcbiAgICB9XG4gICAgZWxzZSBpZiAoYnl0ZSA9PT0gOTQpXG4gICAge1xuICAgICAgcmV0dXJuICfDrSc7XG4gICAgfVxuICAgIGVsc2UgaWYgKGJ5dGUgPT09IDk1KVxuICAgIHtcbiAgICAgIHJldHVybiAnw7MnO1xuICAgIH1cbiAgICBlbHNlIGlmIChieXRlID09PSA5NilcbiAgICB7XG4gICAgICByZXR1cm4gJ8O6JztcbiAgICB9XG4gICAgZWxzZSBpZiAoYnl0ZSA9PT0gMTIzKVxuICAgIHtcbiAgICAgIHJldHVybiAnw6cnO1xuICAgIH1cbiAgICBlbHNlIGlmIChieXRlID09PSAxMjQpXG4gICAge1xuICAgICAgcmV0dXJuICfDtyc7XG4gICAgfVxuICAgIGVsc2UgaWYgKGJ5dGUgPT09IDEyNSlcbiAgICB7XG4gICAgICByZXR1cm4gJ8ORJztcbiAgICB9XG4gICAgZWxzZSBpZiAoYnl0ZSA9PT0gMTI2KVxuICAgIHtcbiAgICAgIHJldHVybiAnw7EnO1xuICAgIH1cbiAgICBlbHNlIGlmIChieXRlID09PSAxMjcpXG4gICAge1xuICAgICAgcmV0dXJuICfilognO1xuICAgIH1cbiAgICBlbHNlXG4gICAge1xuICAgICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUoYnl0ZSk7XG4gICAgfVxuXG4gIH1cblxuICBfZmxpcE1lbW9yeSh0aW1lc3RhbXApXG4gIHtcbiAgICB0aGlzLl9jbGVhckFjdGl2ZUN1ZXModGltZXN0YW1wKTtcbiAgICB0aGlzLl9mbHVzaENhcHRpb25zKHRpbWVzdGFtcCk7XG4gIH1cblxuICBfZmx1c2hDYXB0aW9ucyh0aW1lc3RhbXApXG4gIHtcbiAgICBpZiAoIXRoaXMuX2hhczcwOClcbiAgICB7XG4gICAgICB0aGlzLl90ZXh0VHJhY2sgPSB0aGlzLm1lZGlhLmFkZFRleHRUcmFjaygnY2FwdGlvbnMnLCAnRW5nbGlzaCcsICdlbicpO1xuICAgICAgdGhpcy5faGFzNzA4ID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBmb3IgKHZhciBpPTA7IGk8dGhpcy5tZW1vcnkubGVuZ3RoOyBpKyspXG4gICAge1xuICAgICAgdGhpcy5tZW1vcnlbaV0uc3RhcnRUaW1lID0gdGltZXN0YW1wO1xuICAgICAgdGhpcy5fdGV4dFRyYWNrLmFkZEN1ZSh0aGlzLm1lbW9yeVtpXSk7XG4gICAgICB0aGlzLmRpc3BsYXkucHVzaCh0aGlzLm1lbW9yeVtpXSk7XG4gICAgfVxuXG4gICAgdGhpcy5tZW1vcnkgPSBbXTtcblxuICAgIHRoaXMuX2NyZWF0ZUN1ZSgpO1xuICB9XG5cbiAgX2NsZWFyQWN0aXZlQ3Vlcyh0aW1lc3RhbXApXG4gIHtcbiAgICBmb3IgKHZhciBpPTA7IGk8dGhpcy5kaXNwbGF5Lmxlbmd0aDsgaSsrKVxuICAgIHtcbiAgICAgIHRoaXMuZGlzcGxheVtpXS5lbmRUaW1lID0gdGltZXN0YW1wO1xuICAgIH1cblxuICAgIHRoaXMuZGlzcGxheSA9IFtdO1xuICB9XG5cbi8qICBfcm9sbFVwKG4pXG4gIHtcbiAgICAvLyBUT0RPOiBpbXBsZW1lbnQgcm9sbC11cCBjYXB0aW9uc1xuICB9XG4qL1xuICBfY2xlYXJCdWZmZXJlZEN1ZXMoKVxuICB7XG4gICAgLy9yZW1vdmUgdGhlbSBhbGwuLi5cbiAgfVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IENFQTcwOEludGVycHJldGVyO1xuXG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5jb25zdCBmYWtlTG9nZ2VyID0ge1xuICB0cmFjZTogbm9vcCxcbiAgZGVidWc6IG5vb3AsXG4gIGxvZzogbm9vcCxcbiAgd2Fybjogbm9vcCxcbiAgaW5mbzogbm9vcCxcbiAgZXJyb3I6IG5vb3Bcbn07XG5cbmxldCBleHBvcnRlZExvZ2dlciA9IGZha2VMb2dnZXI7XG5cbi8vbGV0IGxhc3RDYWxsVGltZTtcbi8vIGZ1bmN0aW9uIGZvcm1hdE1zZ1dpdGhUaW1lSW5mbyh0eXBlLCBtc2cpIHtcbi8vICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbi8vICAgY29uc3QgZGlmZiA9IGxhc3RDYWxsVGltZSA/ICcrJyArIChub3cgLSBsYXN0Q2FsbFRpbWUpIDogJzAnO1xuLy8gICBsYXN0Q2FsbFRpbWUgPSBub3c7XG4vLyAgIG1zZyA9IChuZXcgRGF0ZShub3cpKS50b0lTT1N0cmluZygpICsgJyB8IFsnICsgIHR5cGUgKyAnXSA+ICcgKyBtc2cgKyAnICggJyArIGRpZmYgKyAnIG1zICknO1xuLy8gICByZXR1cm4gbXNnO1xuLy8gfVxuXG5mdW5jdGlvbiBmb3JtYXRNc2codHlwZSwgbXNnKSB7XG4gIG1zZyA9ICdbJyArICB0eXBlICsgJ10gPiAnICsgbXNnO1xuICByZXR1cm4gbXNnO1xufVxuXG5mdW5jdGlvbiBjb25zb2xlUHJpbnRGbih0eXBlKSB7XG4gIGNvbnN0IGZ1bmMgPSB3aW5kb3cuY29uc29sZVt0eXBlXTtcbiAgaWYgKGZ1bmMpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oLi4uYXJncykge1xuICAgICAgaWYoYXJnc1swXSkge1xuICAgICAgICBhcmdzWzBdID0gZm9ybWF0TXNnKHR5cGUsIGFyZ3NbMF0pO1xuICAgICAgfVxuICAgICAgZnVuYy5hcHBseSh3aW5kb3cuY29uc29sZSwgYXJncyk7XG4gICAgfTtcbiAgfVxuICByZXR1cm4gbm9vcDtcbn1cblxuZnVuY3Rpb24gZXhwb3J0TG9nZ2VyRnVuY3Rpb25zKGRlYnVnQ29uZmlnLCAuLi5mdW5jdGlvbnMpIHtcbiAgZnVuY3Rpb25zLmZvckVhY2goZnVuY3Rpb24odHlwZSkge1xuICAgIGV4cG9ydGVkTG9nZ2VyW3R5cGVdID0gZGVidWdDb25maWdbdHlwZV0gPyBkZWJ1Z0NvbmZpZ1t0eXBlXS5iaW5kKGRlYnVnQ29uZmlnKSA6IGNvbnNvbGVQcmludEZuKHR5cGUpO1xuICB9KTtcbn1cblxuZXhwb3J0IHZhciBlbmFibGVMb2dzID0gZnVuY3Rpb24oZGVidWdDb25maWcpIHtcbiAgaWYgKGRlYnVnQ29uZmlnID09PSB0cnVlIHx8IHR5cGVvZiBkZWJ1Z0NvbmZpZyA9PT0gJ29iamVjdCcpIHtcbiAgICBleHBvcnRMb2dnZXJGdW5jdGlvbnMoZGVidWdDb25maWcsXG4gICAgICAvLyBSZW1vdmUgb3V0IGZyb20gbGlzdCBoZXJlIHRvIGhhcmQtZGlzYWJsZSBhIGxvZy1sZXZlbFxuICAgICAgLy8ndHJhY2UnLFxuICAgICAgJ2RlYnVnJyxcbiAgICAgICdsb2cnLFxuICAgICAgJ2luZm8nLFxuICAgICAgJ3dhcm4nLFxuICAgICAgJ2Vycm9yJ1xuICAgICk7XG4gICAgLy8gU29tZSBicm93c2VycyBkb24ndCBhbGxvdyB0byB1c2UgYmluZCBvbiBjb25zb2xlIG9iamVjdCBhbnl3YXlcbiAgICAvLyBmYWxsYmFjayB0byBkZWZhdWx0IGlmIG5lZWRlZFxuICAgIHRyeSB7XG4gICAgIGV4cG9ydGVkTG9nZ2VyLmxvZygpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGV4cG9ydGVkTG9nZ2VyID0gZmFrZUxvZ2dlcjtcbiAgICB9XG4gIH1cbiAgZWxzZSB7XG4gICAgZXhwb3J0ZWRMb2dnZXIgPSBmYWtlTG9nZ2VyO1xuICB9XG59O1xuXG5leHBvcnQgdmFyIGxvZ2dlciA9IGV4cG9ydGVkTG9nZ2VyO1xuIiwidmFyIFVSTEhlbHBlciA9IHtcblxuICAvLyBidWlsZCBhbiBhYnNvbHV0ZSBVUkwgZnJvbSBhIHJlbGF0aXZlIG9uZSB1c2luZyB0aGUgcHJvdmlkZWQgYmFzZVVSTFxuICAvLyBpZiByZWxhdGl2ZVVSTCBpcyBhbiBhYnNvbHV0ZSBVUkwgaXQgd2lsbCBiZSByZXR1cm5lZCBhcyBpcy5cbiAgYnVpbGRBYnNvbHV0ZVVSTDogZnVuY3Rpb24oYmFzZVVSTCwgcmVsYXRpdmVVUkwpIHtcbiAgICAvLyByZW1vdmUgYW55IHJlbWFpbmluZyBzcGFjZSBhbmQgQ1JMRlxuICAgIHJlbGF0aXZlVVJMID0gcmVsYXRpdmVVUkwudHJpbSgpO1xuICAgIGlmICgvXlthLXpdKzovaS50ZXN0KHJlbGF0aXZlVVJMKSkge1xuICAgICAgLy8gY29tcGxldGUgdXJsLCBub3QgcmVsYXRpdmVcbiAgICAgIHJldHVybiByZWxhdGl2ZVVSTDtcbiAgICB9XG5cbiAgICB2YXIgcmVsYXRpdmVVUkxRdWVyeSA9IG51bGw7XG4gICAgdmFyIHJlbGF0aXZlVVJMSGFzaCA9IG51bGw7XG5cbiAgICB2YXIgcmVsYXRpdmVVUkxIYXNoU3BsaXQgPSAvXihbXiNdKikoLiopJC8uZXhlYyhyZWxhdGl2ZVVSTCk7XG4gICAgaWYgKHJlbGF0aXZlVVJMSGFzaFNwbGl0KSB7XG4gICAgICByZWxhdGl2ZVVSTEhhc2ggPSByZWxhdGl2ZVVSTEhhc2hTcGxpdFsyXTtcbiAgICAgIHJlbGF0aXZlVVJMID0gcmVsYXRpdmVVUkxIYXNoU3BsaXRbMV07XG4gICAgfVxuICAgIHZhciByZWxhdGl2ZVVSTFF1ZXJ5U3BsaXQgPSAvXihbXlxcP10qKSguKikkLy5leGVjKHJlbGF0aXZlVVJMKTtcbiAgICBpZiAocmVsYXRpdmVVUkxRdWVyeVNwbGl0KSB7XG4gICAgICByZWxhdGl2ZVVSTFF1ZXJ5ID0gcmVsYXRpdmVVUkxRdWVyeVNwbGl0WzJdO1xuICAgICAgcmVsYXRpdmVVUkwgPSByZWxhdGl2ZVVSTFF1ZXJ5U3BsaXRbMV07XG4gICAgfVxuXG4gICAgdmFyIGJhc2VVUkxIYXNoU3BsaXQgPSAvXihbXiNdKikoLiopJC8uZXhlYyhiYXNlVVJMKTtcbiAgICBpZiAoYmFzZVVSTEhhc2hTcGxpdCkge1xuICAgICAgYmFzZVVSTCA9IGJhc2VVUkxIYXNoU3BsaXRbMV07XG4gICAgfVxuICAgIHZhciBiYXNlVVJMUXVlcnlTcGxpdCA9IC9eKFteXFw/XSopKC4qKSQvLmV4ZWMoYmFzZVVSTCk7XG4gICAgaWYgKGJhc2VVUkxRdWVyeVNwbGl0KSB7XG4gICAgICBiYXNlVVJMID0gYmFzZVVSTFF1ZXJ5U3BsaXRbMV07XG4gICAgfVxuXG4gICAgdmFyIGJhc2VVUkxEb21haW5TcGxpdCA9IC9eKCgoW2Etel0rKTopP1xcL1xcL1thLXowLTlcXC4tXSsoOlswLTldKyk/XFwvKSguKikkL2kuZXhlYyhiYXNlVVJMKTtcbiAgICB2YXIgYmFzZVVSTFByb3RvY29sID0gYmFzZVVSTERvbWFpblNwbGl0WzNdO1xuICAgIHZhciBiYXNlVVJMRG9tYWluID0gYmFzZVVSTERvbWFpblNwbGl0WzFdO1xuICAgIHZhciBiYXNlVVJMUGF0aCA9IGJhc2VVUkxEb21haW5TcGxpdFs1XTtcblxuICAgIHZhciBidWlsdFVSTCA9IG51bGw7XG4gICAgaWYgKC9eXFwvXFwvLy50ZXN0KHJlbGF0aXZlVVJMKSkge1xuICAgICAgYnVpbHRVUkwgPSBiYXNlVVJMUHJvdG9jb2wrJzovLycrVVJMSGVscGVyLmJ1aWxkQWJzb2x1dGVQYXRoKCcnLCByZWxhdGl2ZVVSTC5zdWJzdHJpbmcoMikpO1xuICAgIH1cbiAgICBlbHNlIGlmICgvXlxcLy8udGVzdChyZWxhdGl2ZVVSTCkpIHtcbiAgICAgIGJ1aWx0VVJMID0gYmFzZVVSTERvbWFpbitVUkxIZWxwZXIuYnVpbGRBYnNvbHV0ZVBhdGgoJycsIHJlbGF0aXZlVVJMLnN1YnN0cmluZygxKSk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdmFyIG5ld1BhdGggPSBVUkxIZWxwZXIuYnVpbGRBYnNvbHV0ZVBhdGgoYmFzZVVSTFBhdGgsIHJlbGF0aXZlVVJMKTtcbiAgICAgIGJ1aWx0VVJMID0gYmFzZVVSTERvbWFpbiArIG5ld1BhdGg7XG4gICAgfVxuXG4gICAgLy8gcHV0IHRoZSBxdWVyeSBhbmQgaGFzaCBwYXJ0cyBiYWNrXG4gICAgaWYgKHJlbGF0aXZlVVJMUXVlcnkpIHtcbiAgICAgIGJ1aWx0VVJMICs9IHJlbGF0aXZlVVJMUXVlcnk7XG4gICAgfVxuICAgIGlmIChyZWxhdGl2ZVVSTEhhc2gpIHtcbiAgICAgIGJ1aWx0VVJMICs9IHJlbGF0aXZlVVJMSGFzaDtcbiAgICB9XG4gICAgcmV0dXJuIGJ1aWx0VVJMO1xuICB9LFxuXG4gIC8vIGJ1aWxkIGFuIGFic29sdXRlIHBhdGggdXNpbmcgdGhlIHByb3ZpZGVkIGJhc2VQYXRoXG4gIC8vIGFkYXB0ZWQgZnJvbSBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvZG9jdW1lbnQvY29va2llI1VzaW5nX3JlbGF0aXZlX1VSTHNfaW5fdGhlX3BhdGhfcGFyYW1ldGVyXG4gIC8vIHRoaXMgZG9lcyBub3QgaGFuZGxlIHRoZSBjYXNlIHdoZXJlIHJlbGF0aXZlUGF0aCBpcyBcIi9cIiBvciBcIi8vXCIuIFRoZXNlIGNhc2VzIHNob3VsZCBiZSBoYW5kbGVkIG91dHNpZGUgdGhpcy5cbiAgYnVpbGRBYnNvbHV0ZVBhdGg6IGZ1bmN0aW9uKGJhc2VQYXRoLCByZWxhdGl2ZVBhdGgpIHtcbiAgICB2YXIgc1JlbFBhdGggPSByZWxhdGl2ZVBhdGg7XG4gICAgdmFyIG5VcExuLCBzRGlyID0gJycsIHNQYXRoID0gYmFzZVBhdGgucmVwbGFjZSgvW15cXC9dKiQvLCBzUmVsUGF0aC5yZXBsYWNlKC8oXFwvfF4pKD86XFwuP1xcLyspKy9nLCAnJDEnKSk7XG4gICAgZm9yICh2YXIgbkVuZCwgblN0YXJ0ID0gMDsgbkVuZCA9IHNQYXRoLmluZGV4T2YoJy8uLi8nLCBuU3RhcnQpLCBuRW5kID4gLTE7IG5TdGFydCA9IG5FbmQgKyBuVXBMbikge1xuICAgICAgblVwTG4gPSAvXlxcLyg/OlxcLlxcLlxcLykqLy5leGVjKHNQYXRoLnNsaWNlKG5FbmQpKVswXS5sZW5ndGg7XG4gICAgICBzRGlyID0gKHNEaXIgKyBzUGF0aC5zdWJzdHJpbmcoblN0YXJ0LCBuRW5kKSkucmVwbGFjZShuZXcgUmVnRXhwKCcoPzpcXFxcXFwvK1teXFxcXFxcL10qKXswLCcgKyAoKG5VcExuIC0gMSkgLyAzKSArICd9JCcpLCAnLycpO1xuICAgIH1cbiAgICByZXR1cm4gc0RpciArIHNQYXRoLnN1YnN0cihuU3RhcnQpO1xuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFVSTEhlbHBlcjtcbiIsIi8qKlxuICogWEhSIGJhc2VkIGxvZ2dlclxuKi9cblxuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5cbmNsYXNzIFhockxvYWRlciB7XG5cbiAgY29uc3RydWN0b3IoY29uZmlnKSB7XG4gICAgaWYgKGNvbmZpZyAmJiBjb25maWcueGhyU2V0dXApIHtcbiAgICAgIHRoaXMueGhyU2V0dXAgPSBjb25maWcueGhyU2V0dXA7XG4gICAgfVxuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLmFib3J0KCk7XG4gICAgdGhpcy5sb2FkZXIgPSBudWxsO1xuICB9XG5cbiAgYWJvcnQoKSB7XG4gICAgdmFyIGxvYWRlciA9IHRoaXMubG9hZGVyLFxuICAgICAgICB0aW1lb3V0SGFuZGxlID0gdGhpcy50aW1lb3V0SGFuZGxlO1xuICAgIGlmIChsb2FkZXIgJiYgbG9hZGVyLnJlYWR5U3RhdGUgIT09IDQpIHtcbiAgICAgIHRoaXMuc3RhdHMuYWJvcnRlZCA9IHRydWU7XG4gICAgICBsb2FkZXIuYWJvcnQoKTtcbiAgICB9XG4gICAgaWYgKHRpbWVvdXRIYW5kbGUpIHtcbiAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGltZW91dEhhbmRsZSk7XG4gICAgfVxuICB9XG5cbiAgbG9hZCh1cmwsIHJlc3BvbnNlVHlwZSwgb25TdWNjZXNzLCBvbkVycm9yLCBvblRpbWVvdXQsIHRpbWVvdXQsIG1heFJldHJ5LCByZXRyeURlbGF5LCBvblByb2dyZXNzID0gbnVsbCwgZnJhZyA9IG51bGwpIHtcbiAgICB0aGlzLnVybCA9IHVybDtcbiAgICBpZiAoZnJhZyAmJiAhaXNOYU4oZnJhZy5ieXRlUmFuZ2VTdGFydE9mZnNldCkgJiYgIWlzTmFOKGZyYWcuYnl0ZVJhbmdlRW5kT2Zmc2V0KSkge1xuICAgICAgICB0aGlzLmJ5dGVSYW5nZSA9IGZyYWcuYnl0ZVJhbmdlU3RhcnRPZmZzZXQgKyAnLScgKyAoZnJhZy5ieXRlUmFuZ2VFbmRPZmZzZXQtMSk7XG4gICAgfVxuICAgIHRoaXMucmVzcG9uc2VUeXBlID0gcmVzcG9uc2VUeXBlO1xuICAgIHRoaXMub25TdWNjZXNzID0gb25TdWNjZXNzO1xuICAgIHRoaXMub25Qcm9ncmVzcyA9IG9uUHJvZ3Jlc3M7XG4gICAgdGhpcy5vblRpbWVvdXQgPSBvblRpbWVvdXQ7XG4gICAgdGhpcy5vbkVycm9yID0gb25FcnJvcjtcbiAgICB0aGlzLnN0YXRzID0ge3RyZXF1ZXN0OiBwZXJmb3JtYW5jZS5ub3coKSwgcmV0cnk6IDB9O1xuICAgIHRoaXMudGltZW91dCA9IHRpbWVvdXQ7XG4gICAgdGhpcy5tYXhSZXRyeSA9IG1heFJldHJ5O1xuICAgIHRoaXMucmV0cnlEZWxheSA9IHJldHJ5RGVsYXk7XG4gICAgdGhpcy50aW1lb3V0SGFuZGxlID0gd2luZG93LnNldFRpbWVvdXQodGhpcy5sb2FkdGltZW91dC5iaW5kKHRoaXMpLCB0aW1lb3V0KTtcbiAgICB0aGlzLmxvYWRJbnRlcm5hbCgpO1xuICB9XG5cbiAgbG9hZEludGVybmFsKCkge1xuICAgIHZhciB4aHI7XG4gICAgXG4gICAgaWYgKHR5cGVvZiBYRG9tYWluUmVxdWVzdCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICB4aHIgPSB0aGlzLmxvYWRlciA9IG5ldyBYRG9tYWluUmVxdWVzdCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgeGhyID0gdGhpcy5sb2FkZXIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICB9XG4gICAgXG4gICAgeGhyLm9ubG9hZGVuZCA9IHRoaXMubG9hZGVuZC5iaW5kKHRoaXMpO1xuICAgIHhoci5vbnByb2dyZXNzID0gdGhpcy5sb2FkcHJvZ3Jlc3MuYmluZCh0aGlzKTtcblxuICAgIHhoci5vcGVuKCdHRVQnLCB0aGlzLnVybCwgdHJ1ZSk7XG4gICAgaWYgKHRoaXMuYnl0ZVJhbmdlKSB7XG4gICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcignUmFuZ2UnLCAnYnl0ZXM9JyArIHRoaXMuYnl0ZVJhbmdlKTtcbiAgICB9XG4gICAgeGhyLnJlc3BvbnNlVHlwZSA9IHRoaXMucmVzcG9uc2VUeXBlO1xuICAgIHRoaXMuc3RhdHMudGZpcnN0ID0gbnVsbDtcbiAgICB0aGlzLnN0YXRzLmxvYWRlZCA9IDA7XG4gICAgaWYgKHRoaXMueGhyU2V0dXApIHtcbiAgICAgIHRoaXMueGhyU2V0dXAoeGhyLCB0aGlzLnVybCk7XG4gICAgfVxuICAgIHhoci5zZW5kKCk7XG4gIH1cblxuICBsb2FkZW5kKGV2ZW50KSB7XG4gICAgdmFyIHhociA9IGV2ZW50LmN1cnJlbnRUYXJnZXQsXG4gICAgICAgIHN0YXR1cyA9IHhoci5zdGF0dXMsXG4gICAgICAgIHN0YXRzID0gdGhpcy5zdGF0cztcbiAgICAvLyBkb24ndCBwcm9jZWVkIGlmIHhociBoYXMgYmVlbiBhYm9ydGVkXG4gICAgaWYgKCFzdGF0cy5hYm9ydGVkKSB7XG4gICAgICAgIC8vIGh0dHAgc3RhdHVzIGJldHdlZW4gMjAwIHRvIDI5OSBhcmUgYWxsIHN1Y2Nlc3NmdWxcbiAgICAgICAgaWYgKHN0YXR1cyA+PSAyMDAgJiYgc3RhdHVzIDwgMzAwKSAge1xuICAgICAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy50aW1lb3V0SGFuZGxlKTtcbiAgICAgICAgICBzdGF0cy50bG9hZCA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgICAgIHRoaXMub25TdWNjZXNzKGV2ZW50LCBzdGF0cyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBlcnJvciAuLi5cbiAgICAgICAgaWYgKHN0YXRzLnJldHJ5IDwgdGhpcy5tYXhSZXRyeSkge1xuICAgICAgICAgIGxvZ2dlci53YXJuKGAke3N0YXR1c30gd2hpbGUgbG9hZGluZyAke3RoaXMudXJsfSwgcmV0cnlpbmcgaW4gJHt0aGlzLnJldHJ5RGVsYXl9Li4uYCk7XG4gICAgICAgICAgdGhpcy5kZXN0cm95KCk7XG4gICAgICAgICAgd2luZG93LnNldFRpbWVvdXQodGhpcy5sb2FkSW50ZXJuYWwuYmluZCh0aGlzKSwgdGhpcy5yZXRyeURlbGF5KTtcbiAgICAgICAgICAvLyBleHBvbmVudGlhbCBiYWNrb2ZmXG4gICAgICAgICAgdGhpcy5yZXRyeURlbGF5ID0gTWF0aC5taW4oMiAqIHRoaXMucmV0cnlEZWxheSwgNjQwMDApO1xuICAgICAgICAgIHN0YXRzLnJldHJ5Kys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgd2luZG93LmNsZWFyVGltZW91dCh0aGlzLnRpbWVvdXRIYW5kbGUpO1xuICAgICAgICAgIGxvZ2dlci5lcnJvcihgJHtzdGF0dXN9IHdoaWxlIGxvYWRpbmcgJHt0aGlzLnVybH1gICk7XG4gICAgICAgICAgdGhpcy5vbkVycm9yKGV2ZW50KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGxvYWR0aW1lb3V0KGV2ZW50KSB7XG4gICAgbG9nZ2VyLndhcm4oYHRpbWVvdXQgd2hpbGUgbG9hZGluZyAke3RoaXMudXJsfWAgKTtcbiAgICB0aGlzLm9uVGltZW91dChldmVudCwgdGhpcy5zdGF0cyk7XG4gIH1cblxuICBsb2FkcHJvZ3Jlc3MoZXZlbnQpIHtcbiAgICB2YXIgc3RhdHMgPSB0aGlzLnN0YXRzO1xuICAgIGlmIChzdGF0cy50Zmlyc3QgPT09IG51bGwpIHtcbiAgICAgIHN0YXRzLnRmaXJzdCA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgIH1cbiAgICBzdGF0cy5sb2FkZWQgPSBldmVudC5sb2FkZWQ7XG4gICAgaWYgKHRoaXMub25Qcm9ncmVzcykge1xuICAgICAgdGhpcy5vblByb2dyZXNzKGV2ZW50LCBzdGF0cyk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFhockxvYWRlcjtcbiJdfQ==
