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

var _utilsLogger = require('../utils/logger');

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
      this.onml = this.onManifestLoading.bind(this);
      this.onls = this.onLevelSwitch.bind(this);
      hls.on(_events2['default'].MEDIA_ATTACHING, this.onmediaatt0);
      hls.on(_events2['default'].MEDIA_DETACHING, this.onmediadet0);
      hls.on(Hls.Events.FRAG_PARSING_USERDATA, this.onud);
      hls.on(_events2['default'].MANIFEST_LOADING, this.onml);
      hls.on(_events2['default'].LEVEL_SWITCH, this.onls);
    }
  }

  _createClass(TimelineController, [{
    key: 'destroy',
    value: function destroy() {}
  }, {
    key: 'onMediaAttaching',
    value: function onMediaAttaching(event, data) {
      var media = this.media = data.media;
      this.cea708Interpreter = new _utilsCea708Interpreter2['default'](this.media);
    }
  }, {
    key: 'onMediaDetaching',
    value: function onMediaDetaching() {}
  }, {
    key: 'onManifestLoading',
    value: function onManifestLoading() {
      this.level = -1;
    }
  }, {
    key: 'onLevelSwitch',
    value: function onLevelSwitch() {
      this.cea708Interpreter.clear();
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

},{"../events":20,"../utils/cea-708-interpreter":30,"../utils/logger":31}],7:[function(require,module,exports){
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
      if (profileIdc === 100 || profileIdc === 110 || profileIdc === 122 || profileIdc === 144) {
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
          avcSample,
          push;
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
            var expGolombDecoder = new _expGolomb2['default'](unit.data);

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
                      var sizeOfCCs = totalCCs * 3;
                      var byteArray = [firstByte, secondByte];

                      for (var i = 0; i < totalCCs; i++) {
                        // 3 bytes per CC
                        byteArray.push(expGolombDecoder.readUByte());
                        byteArray.push(expGolombDecoder.readUByte());
                        byteArray.push(expGolombDecoder.readUByte());
                      }

                      _this._txtTrack.samples.push({ type: 3, pts: pes.pts, level: _this.lastLevel, bytes: byteArray });
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
              var expGolombDecoder = new _expGolomb2['default'](unit.data);
              var config = expGolombDecoder.readSPS();
              track.width = config.width;
              track.height = config.height;
              track.sps = [unit.data];
              track.timescale = _this.remuxer.timescale;
              track.duration = _this.remuxer.timescale * _this._duration;
              var codecarray = unit.data.subarray(1, 4);
              var codecstring = 'avc1.';
              for (var i = 0; i < 3; i++) {
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
          config,
          adtsFrameSize,
          adtsStartOffset,
          adtsHeaderLen,
          stamp,
          nbSamples,
          len,
          aacSample;
      if (this.aacOverFlow) {
        var tmp = new Uint8Array(this.aacOverFlow.byteLength + data.byteLength);
        tmp.set(this.aacOverFlow, 0);
        tmp.set(data, this.aacOverFlow.byteLength);
        data = tmp;
      }
      // look for ADTS header (0xFFFx)
      for (adtsStartOffset = startOffset, len = data.length; adtsStartOffset < len - 1; adtsStartOffset++) {
        if (data[adtsStartOffset] === 0xff && (data[adtsStartOffset + 1] & 0xf0) === 0xf0) {
          break;
        }
      }
      // if ADTS header does not start straight from the beginning of the PES payload, raise an error
      if (adtsStartOffset) {
        var reason, fatal;
        if (adtsStartOffset < len - 1) {
          reason = 'AAC PES did not start with ADTS header,offset:' + adtsStartOffset;
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
      if (adtsStartOffset < len) {
        this.aacOverFlow = data.subarray(adtsStartOffset, len);
      } else {
        this.aacOverFlow = null;
      }
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

"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var CEA708Interpreter = (function () {
  function CEA708Interpreter(media) {
    _classCallCheck(this, CEA708Interpreter);

    this.media = media;
    this.display = [];
    this.memory = [];
    this._createCue();
  }

  _createClass(CEA708Interpreter, [{
    key: "destroy",
    value: function destroy() {}
  }, {
    key: "_createCue",
    value: function _createCue() {
      this.cue = new VTTCue(-1, -1, "");
      this.cue.text = "";
      this.cue.pauseOnExit = false;

      // make sure it doesn't show up before it's ready
      this.startTime = Number.MAX_VALUE;

      // show it 'forever' once we do show it
      // (we'll set the end time once we know it later)
      this.cue.endTime = Number.MAX_VALUE;

      this.memory.push(this.cue);
    }
  }, {
    key: "clear",
    value: function clear() {
      if (this._textTrack && this._textTrack.cues) {
        while (this._textTrack.cues.length > 0) {
          this._textTrack.removeCue(this._textTrack.cues[0]);
        }
      }
    }
  }, {
    key: "push",
    value: function push(timestamp, bytes) {
      var count = bytes[0] & 31;
      var position = 2;
      var byte, ccbyte1, ccbyte2, ccdata1, ccdata2, ccValid, ccType;

      for (var j = 0; j < count; j++) {
        byte = bytes[position++];
        ccbyte1 = 0x7F & bytes[position++];
        ccbyte2 = 0x7F & bytes[position++];
        ccValid = !((4 & byte) == 0);
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
                console.log(this.cue.text);
              }
              // Special Characters
              else if ((ccbyte1 === 0x11 || ccbyte1 === 0x19) && ccbyte2 >= 0x30 && ccbyte2 <= 0x3F) {
                  // extended chars, e.g. musical note, accents
                  switch (ccbyte2) {
                    case 48:
                      this.cue.text += "®";
                      break;
                    case 49:
                      this.cue.text += "°";
                      break;
                    case 50:
                      this.cue.text += "½";
                      break;
                    case 51:
                      this.cue.text += "¿";
                      break;
                    case 52:
                      this.cue.text += "™";
                      break;
                    case 53:
                      this.cue.text += "¢";
                      break;
                    case 54:
                      this.cue.text += "";
                      break;
                    case 55:
                      this.cue.text += "£";
                      break;
                    case 56:
                      this.cue.text += "♪";
                      break;
                    case 57:
                      this.cue.text += " ";
                      break;
                    case 58:
                      this.cue.text += "è";
                      break;
                    case 59:
                      this.cue.text += "â";
                      break;
                    case 60:
                      this.cue.text += "ê";
                      break;
                    case 61:
                      this.cue.text += "î";
                      break;
                    case 62:
                      this.cue.text += "ô";
                      break;
                    case 63:
                      this.cue.text += "û";
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
                    console.log("-RCL-");
                    // TODO: shouldn't affect roll-ups...
                    this._clearActiveCues(timestamp);
                    // RCL: Resume Caption Loading
                    // begin pop on
                    break;
                  case 0x21:
                    console.log("-BS-");
                    // BS: Backspace
                    this.cue.text = this.cue.text.substr(0, this.cue.text.length - 1);
                    break;
                  case 0x22:
                    console.log("-AOF-");
                    // AOF: reserved (formerly alarm off)
                    break;
                  case 0x23:
                    console.log("-AON-");
                    // AON: reserved (formerly alarm on)
                    break;
                  case 0x24:
                    console.log("-DER-");
                    // DER: Delete to end of row
                    break;
                  case 0x25:
                    console.log("-RU2-");
                    // RU2: roll-up 2 rows
                    this._rollup(2);
                    break;
                  case 0x26:
                    console.log("-RU3-");
                    // RU3: roll-up 3 rows
                    this._rollup(3);
                    break;
                  case 0x27:
                    console.log("-RU4-");
                    // RU4: roll-up 4 rows
                    this._rollup(4);
                    break;
                  case 0x28:
                    console.log("-FON-");
                    // FON: Flash on
                    break;
                  case 0x29:
                    console.log("-RDC-");
                    // RDC: Resume direct captioning
                    this._clearActiveCues(timestamp);
                    break;
                  case 0x2A:
                    console.log("-TR-");
                    // TR: Text Restart
                    break;
                  case 0x2B:
                    console.log("-RTD-");
                    // RTD: Resume Text Display
                    break;
                  case 0x2C:
                    console.log("-EDM-");
                    // EDM: Erase Displayed Memory
                    this._clearActiveCues(timestamp);
                    break;
                  case 0x2D:
                    console.log("-CR-");
                    // CR: Carriage Return
                    // only affects roll-up
                    this._rollup(1);
                    break;
                  case 0x2E:
                    console.log("-ENM-");
                    // ENM: Erase non-displayed memory
                    this._text = "";
                    break;
                  case 0x2F:
                    console.log("-EOC-: " + timestamp);
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
    key: "_fromCharCode",
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
    key: "_flipMemory",
    value: function _flipMemory(timestamp) {
      this._clearActiveCues(timestamp);
      this._flushCaptions(timestamp);
    }
  }, {
    key: "_flushCaptions",
    value: function _flushCaptions(timestamp) {
      if (!this._has708) {
        this._textTrack = this.media.addTextTrack("captions", "English", "en");
        this._has708 = true;
      }

      for (var i = 0; i < this.memory.length; i++) {
        console.error(this.memory[i].text);

        this.memory[i].startTime = timestamp;
        this._textTrack.addCue(this.memory[i]);
        this.display.push(this.memory[i]);
      }

      this.memory = [];

      this._createCue();
    }
  }, {
    key: "_clearActiveCues",
    value: function _clearActiveCues(timestamp) {
      for (var i = 0; i < this.display.length; i++) {
        this.display[i].endTime = timestamp;
      }

      this.display = [];
    }
  }, {
    key: "_rollUp",
    value: function _rollUp(n) {
      // TODO: implement roll-up captions
    }
  }, {
    key: "_clearBufferedCues",
    value: function _clearBufferedCues() {
      //remove them all...
    }
  }]);

  return CEA708Interpreter;
})();

exports["default"] = CEA708Interpreter;
module.exports = exports["default"];

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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwibm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwibm9kZV9tb2R1bGVzL3dlYndvcmtpZnkvaW5kZXguanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL2NvbnRyb2xsZXIvYWJyLWNvbnRyb2xsZXIuanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL2NvbnRyb2xsZXIvbGV2ZWwtY29udHJvbGxlci5qcyIsIi9Vc2Vycy9qZXJlbXkubGFjaXZpdGEvR2l0SHViL2hscy5qcy9zcmMvY29udHJvbGxlci9tc2UtbWVkaWEtY29udHJvbGxlci5qcyIsIi9Vc2Vycy9qZXJlbXkubGFjaXZpdGEvR2l0SHViL2hscy5qcy9zcmMvY29udHJvbGxlci90aW1lbGluZS1jb250cm9sbGVyLmpzIiwiL1VzZXJzL2plcmVteS5sYWNpdml0YS9HaXRIdWIvaGxzLmpzL3NyYy9jcnlwdC9hZXMuanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL2NyeXB0L2FlczEyOC1kZWNyeXB0ZXIuanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL2NyeXB0L2RlY3J5cHRlci5qcyIsIi9Vc2Vycy9qZXJlbXkubGFjaXZpdGEvR2l0SHViL2hscy5qcy9zcmMvZGVtdXgvYWFjZGVtdXhlci5qcyIsIi9Vc2Vycy9qZXJlbXkubGFjaXZpdGEvR2l0SHViL2hscy5qcy9zcmMvZGVtdXgvYWR0cy5qcyIsIi9Vc2Vycy9qZXJlbXkubGFjaXZpdGEvR2l0SHViL2hscy5qcy9zcmMvZGVtdXgvZGVtdXhlci1pbmxpbmUuanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL2RlbXV4L2RlbXV4ZXItd29ya2VyLmpzIiwiL1VzZXJzL2plcmVteS5sYWNpdml0YS9HaXRIdWIvaGxzLmpzL3NyYy9kZW11eC9kZW11eGVyLmpzIiwiL1VzZXJzL2plcmVteS5sYWNpdml0YS9HaXRIdWIvaGxzLmpzL3NyYy9kZW11eC9leHAtZ29sb21iLmpzIiwiL1VzZXJzL2plcmVteS5sYWNpdml0YS9HaXRIdWIvaGxzLmpzL3NyYy9kZW11eC9pZDMuanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL2RlbXV4L3RzZGVtdXhlci5qcyIsIi9Vc2Vycy9qZXJlbXkubGFjaXZpdGEvR2l0SHViL2hscy5qcy9zcmMvZXJyb3JzLmpzIiwiL1VzZXJzL2plcmVteS5sYWNpdml0YS9HaXRIdWIvaGxzLmpzL3NyYy9ldmVudC1oYW5kbGVyLmpzIiwiL1VzZXJzL2plcmVteS5sYWNpdml0YS9HaXRIdWIvaGxzLmpzL3NyYy9ldmVudHMuanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL2hlbHBlci9sZXZlbC1oZWxwZXIuanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL2hscy5qcyIsIi9Vc2Vycy9qZXJlbXkubGFjaXZpdGEvR2l0SHViL2hscy5qcy9zcmMvbG9hZGVyL2ZyYWdtZW50LWxvYWRlci5qcyIsIi9Vc2Vycy9qZXJlbXkubGFjaXZpdGEvR2l0SHViL2hscy5qcy9zcmMvbG9hZGVyL2tleS1sb2FkZXIuanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL2xvYWRlci9wbGF5bGlzdC1sb2FkZXIuanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL3JlbXV4L21wNC1nZW5lcmF0b3IuanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL3JlbXV4L21wNC1yZW11eGVyLmpzIiwiL1VzZXJzL2plcmVteS5sYWNpdml0YS9HaXRIdWIvaGxzLmpzL3NyYy91dGlscy9hdHRyLWxpc3QuanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL3V0aWxzL2JpbmFyeS1zZWFyY2guanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL3V0aWxzL2NlYS03MDgtaW50ZXJwcmV0ZXIuanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL3V0aWxzL2xvZ2dlci5qcyIsIi9Vc2Vycy9qZXJlbXkubGFjaXZpdGEvR2l0SHViL2hscy5qcy9zcmMvdXRpbHMvdXJsLmpzIiwiL1VzZXJzL2plcmVteS5sYWNpdml0YS9HaXRIdWIvaGxzLmpzL3NyYy91dGlscy94aHItbG9hZGVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFD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LENBQUM7VUFDcEIsTUFBTSxHQUFNLEtBQUssQ0FBQyxDQUFDLENBQUM7VUFDcEIsSUFBSSxHQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQzs7O0FBR2pCLFdBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsWUFBWSxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQ2pDLFVBQUUsR0FBRyxNQUFNLENBQUMsQ0FBQyxLQUFHLEVBQUUsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLElBQUUsRUFBRSxHQUFHLEdBQUcsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLElBQUUsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQy9GLFVBQUUsR0FBRyxNQUFNLENBQUMsQ0FBQyxLQUFHLEVBQUUsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLElBQUUsRUFBRSxHQUFHLEdBQUcsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLElBQUUsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLEdBQUcsR0FBRyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztBQUNuRyxVQUFFLEdBQUcsTUFBTSxDQUFDLENBQUMsS0FBRyxFQUFFLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxJQUFFLEVBQUUsR0FBRyxHQUFHLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxJQUFFLENBQUMsR0FBRyxHQUFHLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDbkcsU0FBQyxHQUFJLE1BQU0sQ0FBQyxDQUFDLEtBQUcsRUFBRSxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsSUFBRSxFQUFFLEdBQUcsR0FBRyxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsSUFBRSxDQUFDLEdBQUcs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QUFNLENBQUMsWUFBWSxDQUFHLENBQUM7T0FDdkc7QUFDRCxlQUFTLEdBQUcsQ0FBQyxDQUFDO0FBQ2QsYUFBTyxBQUFDLGVBQWUsR0FBRyxDQUFDLEdBQUksR0FBRyxFQUFFOztBQUVsQyxxQkFBYSxHQUFJLENBQUMsSUFBSSxDQUFDLGVBQWUsR0FBRyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUEsSUFBSyxFQUFFLEFBQUMsQ0FBQzs7QUFFM0QscUJBQWEsSUFBSyxJQUFJLENBQUMsZUFBZSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQUFBQyxDQUFDOztBQUVsRCxxQkFBYSxJQUFLLENBQUMsSUFBSSxDQUFDLGVBQWUsR0FBRyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUEsS0FBTSxDQUFDLEFBQUMsQ0FBQztBQUM1RCxxQkFBYSxHQUFJLENBQUMsRUFBRSxJQUFJLENBQUMsZUFBZSxHQUFHLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQSxBQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQUFBQyxDQUFDO0FBQy9ELHFCQUFhLElBQUksYUFBYSxDQUFDO0FBQy9CLGFBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsR0FBRyxTQUFTLEdBQUcsSUFBSSxHQUFHLEtBQUssR0FBRyxLQUFLLENBQUMsZUFBZSxDQUFDLENBQUM7OztBQUczRSxZQUFJLEFBQUMsYUFBYSxHQUFHLENBQUMsSUFBTSxBQUFDLGVBQWUsR0FBRyxhQUFhLEdBQUcsYUFBYSxJQUFLLEdBQUcsQUFBQyxFQUFFO0FBQ3JGLG1CQUFTLEdBQUcsRUFBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxlQUFlLEdBQUcsYUFBYSxFQUFFLGVBQWUsR0FBRyxhQUFhLEdBQUcsYUFBYSxDQUFDLEVBQUUsR0FBRyxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUUsS0FBSyxFQUFDLENBQUM7QUFDNUksZUFBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDOUIsZUFBSyxDQUFDLEdBQUcsSUFBSSxhQUFh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QUFLLENBQUM7QUFBRSxzQkFBUSxHQUFHLENBQUMsRUFBRSxFQUFDLEVBQUUsQ0FBQyxDQUFDLEFBQUMsTUFBTTtBQUFBLEFBQ2xDLGlCQUFLLENBQUM7QUFBRSxzQkFBUSxHQUFHLENBQUMsRUFBRSxFQUFDLEVBQUUsQ0FBQyxDQUFDLEFBQUMsTUFBTTtBQUFBLEFBQ2xDLGlCQUFLLENBQUM7QUFBRSxzQkFBUSxHQUFHLENBQUMsRUFBRSxFQUFDLEVBQUUsQ0FBQyxDQUFDLEFBQUMsTUFBTTtBQUFBLEFBQ2xDLGlCQUFLLENBQUM7QUFBRSxzQkFBUSxHQUFHLENBQUMsRUFBRSxFQUFDLEVBQUUsQ0FBQyxDQUFDLEFBQUMsTUFBTTtBQUFBLEFBQ2xDLGlCQUFLLENBQUM7QUFBRSxzQkFBUSxHQUFHLENBQUMsRUFBRSxFQUFDLEVBQUUsQ0FBQyxDQUFDLEFBQUMsTUFBTTtBQUFBLEFBQ2xDLGlCQUFLLENBQUM7QUFBRSxzQkFBUSxHQUFHLENBQUMsRUFBRSxFQUFDLEVBQUUsQ0FBQyxDQUFDLEFBQUMsTUFBTTtBQUFBLEFBQ2xDLGlCQUFLLENBQUM7QUFBRSxzQkFBUSxHQUFHLENBQUMsRUFBRSxFQUFDLEVBQUUsQ0FBQyxDQUFDLEFBQUMsTUFBTTtBQUFBLEFBQ2xDLGlCQUFLLEVBQUU7QUFBRSxzQkFBUSxHQUFHLENBQUMsRUFBRSxFQUFDLEVBQUUsQ0FBQyxDQUFDLEFBQUMsTUFBTTtBQUFBLEFBQ25DLGlCQUFLLEVBQUU7QUFBRSxzQkFBUSxHQUFHLENBQUMsRUFBRSxFQUFDLEVBQUUsQ0FBQyxDQUFDLEFBQUMsTUFBTTtBQUFBLEFBQ25DLGlCQUFLLEVBQUU7QUFBRSxzQkFBUSxHQUFHLENBQUMsRUFBRSxFQUFDLEVBQUUsQ0FBQyxDQUFDLEFBQUMsTUFBTTtBQUFBLEFBQ25DLGlCQUFLLEVBQUU7QUFBRSxzQkFBUSxHQUFHLENBQUMsR0FBRyxFQUFDLEVBQUUsQ0FBQyxDQUFDLEFBQUMsTUFBTTtBQUFBLEFBQ3BDLGlCQUFLLEVBQUU7QUFBRSxzQkFBUSxHQUFHLENBQUMsQ0FBQyxFQUFDLENB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QUksRUFBRSxJQUFJO0FBQ1YsVUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSTtBQUN0QixVQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJO0FBQ3RCLFVBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFDdEIsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUN0QixJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQ3RCLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFDdEIsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUN0QixJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQ3RCLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFDdEIsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUN0QixJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJO0FBQ3RCLFVBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFDdEIsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUN0QixJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQ3RCLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFDdEIsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUN0QixJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJO0FBQ3RCLFVBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUk7T0FDdkIsQ0FBQyxDQUFDO0FBQ0wsYUFBTyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO0tBQ3ZDOzs7V0FFVSxjQUFDLEtBQUssRUFBRTtBQUNqQixVQUNFLE9BQU8sR0FBRyxLQUFLLENBQUMsT0FBTyxJQUFJLEVBQUU7VUFDN0IsS0FBSyxHQUFHLElBQUksVUFBVSxDQUFDLENBQUMsR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDO1VBQzFDLEtBQUs7VUFDTCxDQUFDLENBQUM7OztBQUdKLFdBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtBQUNuQyxhQUFLLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQztBQUN6QixhQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEFBQUMsS0FBSyxDQUFDLFNBQVMsSUFBSSxDQUFDLEdBQ2pDLEtBQUssQ0FBQyxZQUFZLElBQUksQ0FBQyxBQUFDLEdBQ3hCLEtBQUssQ0FBQyxhQUFhLEFBQUMsQ0FBQztPQUN6Qjs7QUFFRCxhQUFPLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7S0FDdkM7OztXQUVVLGNBQUMsS0FBSyxFQUFFO0FBQ2pCLGFBQU8sR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7S0FDN0w7OztXQUVVLGNBQUMsS0FBSyxFQUFFO0FBQ2pCLFVBQUksR0FBRyxHQUFHLEVBQUU7VUFBRSxHQUFHLEdBQUcsRUFBRTtVQUFFLENBQUM7VUFBRSxJQUFJO1VBQUUsR0FBRyxDQUFDOzs7QUFHckMsV0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtBQUNyQyxZQUFJLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNwQixXQUFHLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQztBQUN0QixXQUFHLENBQUMsSUFBSSxDQUFDLEFBQUMsR0FBRyxLQUFLLENBQUMsR0FBSSxJQUFJLENBQUMsQ0FBQztBQUM3QixXQUFHLENBQUMsSUFBSSxDQUFFLEdBQUcsR0FBRyxJQUFJLENBQUUsQ0FBQztBQUN2QixXQUFHLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztPQUNwRDs7O0FBR0QsV0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtBQUNyQyxZQUFJLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNwQixXQUFHLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQztBQUN0QixXQUFHLENBQUMsSUFBSSxDQUFDLEFBQUMsR0FBRyxLQUFLLENBQUMsR0FBSSxJQUFJLENBQUMsQ0FBQztBQUM3QixXQUFHLENBQUMsSUFBSSxDQUFFLEdBQUcsR0FBRyxJQUFJLENBQUUsQ0FBQztBQUN2QixXQUFHLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztPQUNwRDs7QUFFRCxVQUFJLElBQUksR0FBRyxHQUFH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QyxHQUFHLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxHQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2hFLDBCQUFNO0FBQUEsQUFDUix1QkFBSyxJQUFJO0FBQ1AsMkJBQU8sQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7O0FBRXJCLDBCQUFNO0FBQUEsQUFDUix1QkFBSyxJQUFJO0FBQ1AsMkJBQU8sQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7O0FBRXJCLDBCQUFNO0FBQUEsQUFDUix1QkFBSyxJQUFJO0FBQ1AsMkJBQU8sQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7O0FBRXJCLDBCQUFNO0FBQUEsQUFDUix1QkFBSyxJQUFJO0FBQ1AsMkJBQU8sQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7O0FBRXJCLHdCQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2hCLDBCQUFNO0FBQUEsQUFDUix1QkFBSyxJQUFJO0FBQ1AsMkJBQU8sQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7O0FBRXJCLHdCQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2hCLDBCQUFNO0FBQUEsQUFDUix1QkFBSyxJQUFJO0FBQ1AsMkJBQU8sQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7O0FBRXJCLHdCQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2hCLDBCQUFNO0FBQUEsQUFDUix1QkFBSyxJQUFJO0FBQ1AsMkJBQU8sQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7O0FBRXJCLDBCQUFNO0FBQUEsQUFDUix1QkFBSyxJQUFJO0FBQ1AsMkJBQU8sQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7O0FBRXJCLHdCQUFJLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxDQUFDLENBQUM7QUFD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RyxXQUFXLENBQUMsR0FBRyxFQUFFLENBQUM7T0FDbEM7QUFDRCxXQUFLLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUM7QUFDNUIsVUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFO0FBQ25CLFlBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDO09BQy9CO0tBQ0Y7OztTQS9HRyxTQUFTOzs7cUJBa0hBLFNBQVMiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkO1xufVxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4vLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3Ncbi8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gIGlmICghaXNOdW1iZXIobikgfHwgbiA8IDAgfHwgaXNOYU4obikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCduIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXInKTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBlciwgaGFuZGxlciwgbGVuLCBhcmdzLCBpLCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgIGlmICghdGhpcy5fZXZlbnRzLmVycm9yIHx8XG4gICAgICAgIChpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpICYmICF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKSkge1xuICAgICAgZXIgPSBhcmd1bWVudHNbMV07XG4gICAgICBpZiAoZXIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICB0aHJvdyBlcjsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgIH1cbiAgICAgIHRocm93IFR5cGVFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4nKTtcbiAgICB9XG4gIH1cblxuICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc1VuZGVmaW5lZChoYW5kbGVyKSlcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlcikpIHtcbiAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIC8vIGZhc3QgY2FzZXNcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICBicmVhaztcbiAgICAgIC8vIHNsb3dlclxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICAgICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICBoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChpc09iamVjdChoYW5kbGVyKSkge1xuICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcblxuICAgIGxpc3RlbmVycyA9IGhhbmRsZXIuc2xpY2UoKTtcbiAgICBsZW4gPSBsaXN0ZW5lcnMubGVuZ3RoO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIGxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBtO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBUbyBhdm9pZCByZWN1cnNpb24gaW4gdGhlIGNhc2UgdGhhdCB0eXBlID09PSBcIm5ld0xpc3RlbmVyXCIhIEJlZm9yZVxuICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyXCIuXG4gIGlmICh0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpXG4gICAgdGhpcy5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsXG4gICAgICAgICAgICAgIGlzRnVuY3Rpb24obGlzdGVuZXIubGlzdGVuZXIpID9cbiAgICAgICAgICAgICAgbGlzdGVuZXIubGlzdGVuZXIgOiBsaXN0ZW5lcik7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgLy8gT3B0aW1pemUgdGhlIGNhc2Ugb2Ygb25lIGxpc3RlbmVyLiBEb24ndCBuZWVkIHRoZSBleHRyYSBhcnJheSBvYmplY3QuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbGlzdGVuZXI7XG4gIGVsc2UgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcbiAgZWxzZVxuICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV0sIGxpc3RlbmVyXTtcblxuICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xuICBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSAmJiAhdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCkge1xuICAgIHZhciBtO1xuICAgIGlmICghaXNVbmRlZmluZWQodGhpcy5fbWF4TGlzdGVuZXJzKSkge1xuICAgICAgbSA9IHRoaXMuX21heExpc3RlbmVycztcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IEV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzO1xuICAgIH1cblxuICAgIGlmIChtICYmIG0gPiAwICYmIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGggPiBtKSB7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkID0gdHJ1ZTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO1xuICAgICAgaWYgKHR5cGVvZiBjb25zb2xlLnRyYWNlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIC8vIG5vdCBzdXBwb3J0ZWQgaW4gSUUgMTBcbiAgICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICB2YXIgZmlyZWQgPSBmYWxzZTtcblxuICBmdW5jdGlvbiBnKCkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgZyk7XG5cbiAgICBpZiAoIWZpcmVkKSB7XG4gICAgICBmaXJlZCA9IHRydWU7XG4gICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgfVxuXG4gIGcubGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgdGhpcy5vbih0eXBlLCBnKTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIGVtaXRzIGEgJ3JlbW92ZUxpc3RlbmVyJyBldmVudCBpZmYgdGhlIGxpc3RlbmVyIHdhcyByZW1vdmVkXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIGxpc3QsIHBvc2l0aW9uLCBsZW5ndGgsIGk7XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgbGlzdCA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgbGVuZ3RoID0gbGlzdC5sZW5ndGg7XG4gIHBvc2l0aW9uID0gLTE7XG5cbiAgaWYgKGxpc3QgPT09IGxpc3RlbmVyIHx8XG4gICAgICAoaXNGdW5jdGlvbihsaXN0Lmxpc3RlbmVyKSAmJiBsaXN0Lmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuXG4gIH0gZWxzZSBpZiAoaXNPYmplY3QobGlzdCkpIHtcbiAgICBmb3IgKGkgPSBsZW5ndGg7IGktLSA+IDA7KSB7XG4gICAgICBpZiAobGlzdFtpXSA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgICAobGlzdFtpXS5saXN0ZW5lciAmJiBsaXN0W2ldLmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgcG9zaXRpb24gPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9zaXRpb24gPCAwKVxuICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICAgIGxpc3QubGVuZ3RoID0gMDtcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3Quc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBrZXksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICByZXR1cm4gdGhpcztcblxuICAvLyBub3QgbGlzdGVuaW5nIGZvciByZW1vdmVMaXN0ZW5lciwgbm8gbmVlZCB0byBlbWl0XG4gIGlmICghdGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApXG4gICAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICBlbHNlIGlmICh0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gZW1pdCByZW1vdmVMaXN0ZW5lciBmb3IgYWxsIGxpc3RlbmVycyBvbiBhbGwgZXZlbnRzXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgZm9yIChrZXkgaW4gdGhpcy5fZXZlbnRzKSB7XG4gICAgICBpZiAoa2V5ID09PSAncmVtb3ZlTGlzdGVuZXInKSBjb250aW51ZTtcbiAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKGtleSk7XG4gICAgfVxuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdyZW1vdmVMaXN0ZW5lcicpO1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgbGlzdGVuZXJzID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGxpc3RlbmVycykpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVycyk7XG4gIH0gZWxzZSB7XG4gICAgLy8gTElGTyBvcmRlclxuICAgIHdoaWxlIChsaXN0ZW5lcnMubGVuZ3RoKVxuICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnNbbGlzdGVuZXJzLmxlbmd0aCAtIDFdKTtcbiAgfVxuICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gW107XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24odGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcbiAgZWxzZVxuICAgIHJldCA9IHRoaXMuX2V2ZW50c1t0eXBlXS5zbGljZSgpO1xuICByZXR1cm4gcmV0O1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghZW1pdHRlci5fZXZlbnRzIHx8ICFlbWl0dGVyLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gMDtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbihlbWl0dGVyLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IDE7XG4gIGVsc2VcbiAgICByZXQgPSBlbWl0dGVyLl9ldmVudHNbdHlwZV0ubGVuZ3RoO1xuICByZXR1cm4gcmV0O1xufTtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuIiwidmFyIGJ1bmRsZUZuID0gYXJndW1lbnRzWzNdO1xudmFyIHNvdXJjZXMgPSBhcmd1bWVudHNbNF07XG52YXIgY2FjaGUgPSBhcmd1bWVudHNbNV07XG5cbnZhciBzdHJpbmdpZnkgPSBKU09OLnN0cmluZ2lmeTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoZm4pIHtcbiAgICB2YXIga2V5cyA9IFtdO1xuICAgIHZhciB3a2V5O1xuICAgIHZhciBjYWNoZUtleXMgPSBPYmplY3Qua2V5cyhjYWNoZSk7XG4gICAgXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSBjYWNoZUtleXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIHZhciBrZXkgPSBjYWNoZUtleXNbaV07XG4gICAgICAgIGlmIChjYWNoZVtrZXldLmV4cG9ydHMgPT09IGZuKSB7XG4gICAgICAgICAgICB3a2V5ID0ga2V5O1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgaWYgKCF3a2V5KSB7XG4gICAgICAgIHdrZXkgPSBNYXRoLmZsb29yKE1hdGgucG93KDE2LCA4KSAqIE1hdGgucmFuZG9tKCkpLnRvU3RyaW5nKDE2KTtcbiAgICAgICAgdmFyIHdjYWNoZSA9IHt9O1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGNhY2hlS2V5cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBrZXkgPSBjYWNoZUtleXNbaV07XG4gICAgICAgICAgICB3Y2FjaGVba2V5XSA9IGtleTtcbiAgICAgICAgfVxuICAgICAgICBzb3VyY2VzW3drZXldID0gW1xuICAgICAgICAgICAgRnVuY3Rpb24oWydyZXF1aXJlJywnbW9kdWxlJywnZXhwb3J0cyddLCAnKCcgKyBmbiArICcpKHNlbGYpJyksXG4gICAgICAgICAgICB3Y2FjaGVcbiAgICAgICAgXTtcbiAgICB9XG4gICAgdmFyIHNrZXkgPSBNYXRoLmZsb29yKE1hdGgucG93KDE2LCA4KSAqIE1hdGgucmFuZG9tKCkpLnRvU3RyaW5nKDE2KTtcbiAgICBcbiAgICB2YXIgc2NhY2hlID0ge307IHNjYWNoZVt3a2V5XSA9IHdrZXk7XG4gICAgc291cmNlc1tza2V5XSA9IFtcbiAgICAgICAgRnVuY3Rpb24oWydyZXF1aXJlJ10sJ3JlcXVpcmUoJyArIHN0cmluZ2lmeSh3a2V5KSArICcpKHNlbGYpJyksXG4gICAgICAgIHNjYWNoZVxuICAgIF07XG4gICAgXG4gICAgdmFyIHNyYyA9ICcoJyArIGJ1bmRsZUZuICsgJykoeydcbiAgICAgICAgKyBPYmplY3Qua2V5cyhzb3VyY2VzKS5tYXAoZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgcmV0dXJuIHN0cmluZ2lmeShrZXkpICsgJzpbJ1xuICAgICAgICAgICAgICAgICsgc291cmNlc1trZXldWzBdXG4gICAgICAgICAgICAgICAgKyAnLCcgKyBzdHJpbmdpZnkoc291cmNlc1trZXldWzFdKSArICddJ1xuICAgICAgICAgICAgO1xuICAgICAgICB9KS5qb2luKCcsJylcbiAgICAgICAgKyAnfSx7fSxbJyArIHN0cmluZ2lmeShza2V5KSArICddKSdcbiAgICA7XG4gICAgXG4gICAgdmFyIFVSTCA9IHdpbmRvdy5VUkwgfHwgd2luZG93LndlYmtpdFVSTCB8fCB3aW5kb3cubW96VVJMIHx8IHdpbmRvdy5tc1VSTDtcbiAgICBcbiAgICByZXR1cm4gbmV3IFdvcmtlcihVUkwuY3JlYXRlT2JqZWN0VVJMKFxuICAgICAgICBuZXcgQmxvYihbc3JjXSwgeyB0eXBlOiAndGV4dC9qYXZhc2NyaXB0JyB9KVxuICAgICkpO1xufTtcbiIsIi8qXG4gKiBzaW1wbGUgQUJSIENvbnRyb2xsZXJcbiovXG5cbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IEV2ZW50SGFuZGxlciBmcm9tICcuLi9ldmVudC1oYW5kbGVyJztcblxuY2xhc3MgQWJyQ29udHJvbGxlciBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgc3VwZXIoaGxzLCBFdmVudC5GUkFHX0xPQURfUFJPR1JFU1MpO1xuICAgIHRoaXMubGFzdGZldGNobGV2ZWwgPSAwO1xuICAgIHRoaXMuX2F1dG9MZXZlbENhcHBpbmcgPSAtMTtcbiAgICB0aGlzLl9uZXh0QXV0b0xldmVsID0gLTE7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIEV2ZW50SGFuZGxlci5wcm90b3R5cGUuZGVzdHJveS5jYWxsKHRoaXMpO1xuICB9XG5cbiAgb25GcmFnTG9hZFByb2dyZXNzKGRhdGEpIHtcbiAgICB2YXIgc3RhdHMgPSBkYXRhLnN0YXRzO1xuICAgIGlmIChzdGF0cy5hYm9ydGVkID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMubGFzdGZldGNoZHVyYXRpb24gPSAocGVyZm9ybWFuY2Uubm93KCkgLSBzdGF0cy50cmVxdWVzdCkgLyAxMDAwO1xuICAgICAgdGhpcy5sYXN0ZmV0Y2hsZXZlbCA9IGRhdGEuZnJhZy5sZXZlbDtcbiAgICAgIHRoaXMubGFzdGJ3ID0gKHN0YXRzLmxvYWRlZCAqIDgpIC8gdGhpcy5sYXN0ZmV0Y2hkdXJhdGlvbjtcbiAgICAgIC8vY29uc29sZS5sb2coYGZldGNoRHVyYXRpb246JHt0aGlzLmxhc3RmZXRjaGR1cmF0aW9ufSxidzokeyh0aGlzLmxhc3Ridy8xMDAwKS50b0ZpeGVkKDApfS8ke3N0YXRzLmFib3J0ZWR9YCk7XG4gICAgfVxuICB9XG5cbiAgLyoqIFJldHVybiB0aGUgY2FwcGluZy9tYXggbGV2ZWwgdmFsdWUgdGhhdCBjb3VsZCBiZSB1c2VkIGJ5IGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24gYWxnb3JpdGhtICoqL1xuICBnZXQgYXV0b0xldmVsQ2FwcGluZygpIHtcbiAgICByZXR1cm4gdGhpcy5fYXV0b0xldmVsQ2FwcGluZztcbiAgfVxuXG4gIC8qKiBzZXQgdGhlIGNhcHBpbmcvbWF4IGxldmVsIHZhbHVlIHRoYXQgY291bGQgYmUgdXNlZCBieSBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uIGFsZ29yaXRobSAqKi9cbiAgc2V0IGF1dG9MZXZlbENhcHBpbmcobmV3TGV2ZWwpIHtcbiAgICB0aGlzLl9hdXRvTGV2ZWxDYXBwaW5nID0gbmV3TGV2ZWw7XG4gIH1cblxuICBnZXQgbmV4dEF1dG9MZXZlbCgpIHtcbiAgICB2YXIgbGFzdGJ3ID0gdGhpcy5sYXN0YncsIGhscyA9IHRoaXMuaGxzLGFkanVzdGVkYncsIGksIG1heEF1dG9MZXZlbDtcbiAgICBpZiAodGhpcy5fYXV0b0xldmVsQ2FwcGluZyA9PT0gLTEpIHtcbiAgICAgIG1heEF1dG9MZXZlbCA9IGhscy5sZXZlbHMubGVuZ3RoIC0gMTtcbiAgICB9IGVsc2Uge1xuICAgICAgbWF4QXV0b0xldmVsID0gdGhpcy5fYXV0b0xldmVsQ2FwcGluZztcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fbmV4dEF1dG9MZXZlbCAhPT0gLTEpIHtcbiAgICAgIHZhciBuZXh0TGV2ZWwgPSBNYXRoLm1pbih0aGlzLl9uZXh0QXV0b0xldmVsLG1heEF1dG9MZXZlbCk7XG4gICAgICBpZiAobmV4dExldmVsID09PSB0aGlzLmxhc3RmZXRjaGxldmVsKSB7XG4gICAgICAgIHRoaXMuX25leHRBdXRvTGV2ZWwgPSAtMTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBuZXh0TGV2ZWw7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gZm9sbG93IGFsZ29yaXRobSBjYXB0dXJlZCBmcm9tIHN0YWdlZnJpZ2h0IDpcbiAgICAvLyBodHRwczovL2FuZHJvaWQuZ29vZ2xlc291cmNlLmNvbS9wbGF0Zm9ybS9mcmFtZXdvcmtzL2F2LysvbWFzdGVyL21lZGlhL2xpYnN0YWdlZnJpZ2h0L2h0dHBsaXZlL0xpdmVTZXNzaW9uLmNwcFxuICAgIC8vIFBpY2sgdGhlIGhpZ2hlc3QgYmFuZHdpZHRoIHN0cmVhbSBiZWxvdyBvciBlcXVhbCB0byBlc3RpbWF0ZWQgYmFuZHdpZHRoLlxuICAgIGZvciAoaSA9IDA7IGkgPD0gbWF4QXV0b0xldmVsOyBpKyspIHtcbiAgICAvLyBjb25zaWRlciBvbmx5IDgwJSBvZiB0aGUgYXZhaWxhYmxlIGJhbmR3aWR0aCwgYnV0IGlmIHdlIGFyZSBzd2l0Y2hpbmcgdXAsXG4gICAgLy8gYmUgZXZlbiBtb3JlIGNvbnNlcnZhdGl2ZSAoNzAlKSB0byBhdm9pZCBvdmVyZXN0aW1hdGluZyBhbmQgaW1tZWRpYXRlbHlcbiAgICAvLyBzd2l0Y2hpbmcgYmFjay5cbiAgICAgIGlmIChpIDw9IHRoaXMubGFzdGZldGNobGV2ZWwpIHtcbiAgICAgICAgYWRqdXN0ZWRidyA9IDAuOCAqIGxhc3RidztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGFkanVzdGVkYncgPSAwLjcgKiBsYXN0Ync7XG4gICAgICB9XG4gICAgICBpZiAoYWRqdXN0ZWRidyA8IGhscy5sZXZlbHNbaV0uYml0cmF0ZSkge1xuICAgICAgICByZXR1cm4gTWF0aC5tYXgoMCwgaSAtIDEpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gaSAtIDE7XG4gIH1cblxuICBzZXQgbmV4dEF1dG9MZXZlbChuZXh0TGV2ZWwpIHtcbiAgICB0aGlzLl9uZXh0QXV0b0xldmVsID0gbmV4dExldmVsO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEFickNvbnRyb2xsZXI7XG5cbiIsIi8qXG4gKiBMZXZlbCBDb250cm9sbGVyXG4qL1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBFdmVudEhhbmRsZXIgZnJvbSAnLi4vZXZlbnQtaGFuZGxlcic7XG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuXG5jbGFzcyBMZXZlbENvbnRyb2xsZXIgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHN1cGVyKGhscyxcbiAgICAgIEV2ZW50Lk1BTklGRVNUX0xPQURFRCxcbiAgICAgIEV2ZW50LkxFVkVMX0xPQURFRCxcbiAgICAgIEV2ZW50LkVSUk9SKTtcbiAgICB0aGlzLm9udGljayA9IHRoaXMudGljay5iaW5kKHRoaXMpO1xuICAgIHRoaXMuX21hbnVhbExldmVsID0gdGhpcy5fYXV0b0xldmVsQ2FwcGluZyA9IC0xO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBpZiAodGhpcy50aW1lcikge1xuICAgICBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgIH1cbiAgICB0aGlzLl9tYW51YWxMZXZlbCA9IC0xO1xuICB9XG5cbiAgb25NYW5pZmVzdExvYWRlZChkYXRhKSB7XG4gICAgdmFyIGxldmVsczAgPSBbXSwgbGV2ZWxzID0gW10sIGJpdHJhdGVTdGFydCwgaSwgYml0cmF0ZVNldCA9IHt9LCB2aWRlb0NvZGVjRm91bmQgPSBmYWxzZSwgYXVkaW9Db2RlY0ZvdW5kID0gZmFsc2UsIGhscyA9IHRoaXMuaGxzO1xuXG4gICAgLy8gcmVncm91cCByZWR1bmRhbnQgbGV2ZWwgdG9nZXRoZXJcbiAgICBkYXRhLmxldmVscy5mb3JFYWNoKGxldmVsID0+IHtcbiAgICAgIGlmKGxldmVsLnZpZGVvQ29kZWMpIHtcbiAgICAgICAgdmlkZW9Db2RlY0ZvdW5kID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGlmKGxldmVsLmF1ZGlvQ29kZWMpIHtcbiAgICAgICAgYXVkaW9Db2RlY0ZvdW5kID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHZhciByZWR1bmRhbnRMZXZlbElkID0gYml0cmF0ZVNldFtsZXZlbC5iaXRyYXRlXTtcbiAgICAgIGlmIChyZWR1bmRhbnRMZXZlbElkID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgYml0cmF0ZVNldFtsZXZlbC5iaXRyYXRlXSA9IGxldmVsczAubGVuZ3RoO1xuICAgICAgICBsZXZlbC51cmwgPSBbbGV2ZWwudXJsXTtcbiAgICAgICAgbGV2ZWwudXJsSWQgPSAwO1xuICAgICAgICBsZXZlbHMwLnB1c2gobGV2ZWwpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGV2ZWxzMFtyZWR1bmRhbnRMZXZlbElkXS51cmwucHVzaChsZXZlbC51cmwpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gcmVtb3ZlIGF1ZGlvLW9ubHkgbGV2ZWwgaWYgd2UgYWxzbyBoYXZlIGxldmVscyB3aXRoIGF1ZGlvK3ZpZGVvIGNvZGVjcyBzaWduYWxsZWRcbiAgICBpZih2aWRlb0NvZGVjRm91bmQgJiYgYXVkaW9Db2RlY0ZvdW5kKSB7XG4gICAgICBsZXZlbHMwLmZvckVhY2gobGV2ZWwgPT4ge1xuICAgICAgICBpZihsZXZlbC52aWRlb0NvZGVjKSB7XG4gICAgICAgICAgbGV2ZWxzLnB1c2gobGV2ZWwpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGV2ZWxzID0gbGV2ZWxzMDtcbiAgICB9XG5cbiAgICAvLyBvbmx5IGtlZXAgbGV2ZWwgd2l0aCBzdXBwb3J0ZWQgYXVkaW8vdmlkZW8gY29kZWNzXG4gICAgbGV2ZWxzID0gbGV2ZWxzLmZpbHRlcihmdW5jdGlvbihsZXZlbCkge1xuICAgICAgdmFyIGNoZWNrU3VwcG9ydGVkID0gZnVuY3Rpb24oY29kZWMpIHsgcmV0dXJuIE1lZGlhU291cmNlLmlzVHlwZVN1cHBvcnRlZChgdmlkZW8vbXA0O2NvZGVjcz0ke2NvZGVjfWApO307XG4gICAgICB2YXIgYXVkaW9Db2RlYyA9IGxldmVsLmF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMgPSBsZXZlbC52aWRlb0NvZGVjO1xuXG4gICAgICByZXR1cm4gKCFhdWRpb0NvZGVjIHx8IGNoZWNrU3VwcG9ydGVkKGF1ZGlvQ29kZWMpKSAmJlxuICAgICAgICAgICAgICghdmlkZW9Db2RlYyB8fCBjaGVja1N1cHBvcnRlZCh2aWRlb0NvZGVjKSk7XG4gICAgfSk7XG5cbiAgICBpZihsZXZlbHMubGVuZ3RoKSB7XG4gICAgICAvLyBzdGFydCBiaXRyYXRlIGlzIHRoZSBmaXJzdCBiaXRyYXRlIG9mIHRoZSBtYW5pZmVzdFxuICAgICAgYml0cmF0ZVN0YXJ0ID0gbGV2ZWxzWzBdLmJpdHJhdGU7XG4gICAgICAvLyBzb3J0IGxldmVsIG9uIGJpdHJhdGVcbiAgICAgIGxldmVscy5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgIHJldHVybiBhLmJpdHJhdGUgLSBiLmJpdHJhdGU7XG4gICAgICB9KTtcbiAgICAgIHRoaXMuX2xldmVscyA9IGxldmVscztcbiAgICAgIC8vIGZpbmQgaW5kZXggb2YgZmlyc3QgbGV2ZWwgaW4gc29ydGVkIGxldmVsc1xuICAgICAgZm9yIChpID0gMDsgaSA8IGxldmVscy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAobGV2ZWxzW2ldLmJpdHJhdGUgPT09IGJpdHJhdGVTdGFydCkge1xuICAgICAgICAgIHRoaXMuX2ZpcnN0TGV2ZWwgPSBpO1xuICAgICAgICAgIGxvZ2dlci5sb2coYG1hbmlmZXN0IGxvYWRlZCwke2xldmVscy5sZW5ndGh9IGxldmVsKHMpIGZvdW5kLCBmaXJzdCBiaXRyYXRlOiR7Yml0cmF0ZVN0YXJ0fWApO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBobHMudHJpZ2dlcihFdmVudC5NQU5JRkVTVF9QQVJTRUQsIHtsZXZlbHM6IHRoaXMuX2xldmVscywgZmlyc3RMZXZlbDogdGhpcy5fZmlyc3RMZXZlbCwgc3RhdHM6IGRhdGEuc3RhdHN9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5NQU5JRkVTVF9QQVJTSU5HX0VSUk9SLCBmYXRhbDogdHJ1ZSwgdXJsOiBobHMudXJsLCByZWFzb246ICdubyBjb21wYXRpYmxlIGxldmVsIGZvdW5kIGluIG1hbmlmZXN0J30pO1xuICAgIH1cbiAgICByZXR1cm47XG4gIH1cblxuICBnZXQgbGV2ZWxzKCkge1xuICAgIHJldHVybiB0aGlzLl9sZXZlbHM7XG4gIH1cblxuICBnZXQgbGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2xldmVsO1xuICB9XG5cbiAgc2V0IGxldmVsKG5ld0xldmVsKSB7XG4gICAgaWYgKHRoaXMuX2xldmVsICE9PSBuZXdMZXZlbCB8fCB0aGlzLl9sZXZlbHNbbmV3TGV2ZWxdLmRldGFpbHMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5zZXRMZXZlbEludGVybmFsKG5ld0xldmVsKTtcbiAgICB9XG4gIH1cblxuIHNldExldmVsSW50ZXJuYWwobmV3TGV2ZWwpIHtcbiAgICAvLyBjaGVjayBpZiBsZXZlbCBpZHggaXMgdmFsaWRcbiAgICBpZiAobmV3TGV2ZWwgPj0gMCAmJiBuZXdMZXZlbCA8IHRoaXMuX2xldmVscy5sZW5ndGgpIHtcbiAgICAgIC8vIHN0b3BwaW5nIGxpdmUgcmVsb2FkaW5nIHRpbWVyIGlmIGFueVxuICAgICAgaWYgKHRoaXMudGltZXIpIHtcbiAgICAgICBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgICAgIHRoaXMudGltZXIgPSBudWxsO1xuICAgICAgfVxuICAgICAgdGhpcy5fbGV2ZWwgPSBuZXdMZXZlbDtcbiAgICAgIGxvZ2dlci5sb2coYHN3aXRjaGluZyB0byBsZXZlbCAke25ld0xldmVsfWApO1xuICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5MRVZFTF9TV0lUQ0gsIHtsZXZlbDogbmV3TGV2ZWx9KTtcbiAgICAgIHZhciBsZXZlbCA9IHRoaXMuX2xldmVsc1tuZXdMZXZlbF07XG4gICAgICAgLy8gY2hlY2sgaWYgd2UgbmVlZCB0byBsb2FkIHBsYXlsaXN0IGZvciB0aGlzIGxldmVsXG4gICAgICBpZiAobGV2ZWwuZGV0YWlscyA9PT0gdW5kZWZpbmVkIHx8IGxldmVsLmRldGFpbHMubGl2ZSA9PT0gdHJ1ZSkge1xuICAgICAgICAvLyBsZXZlbCBub3QgcmV0cmlldmVkIHlldCwgb3IgbGl2ZSBwbGF5bGlzdCB3ZSBuZWVkIHRvIChyZSlsb2FkIGl0XG4gICAgICAgIGxvZ2dlci5sb2coYChyZSlsb2FkaW5nIHBsYXlsaXN0IGZvciBsZXZlbCAke25ld0xldmVsfWApO1xuICAgICAgICB2YXIgdXJsSWQgPSBsZXZlbC51cmxJZDtcbiAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5MRVZFTF9MT0FESU5HLCB7dXJsOiBsZXZlbC51cmxbdXJsSWRdLCBsZXZlbDogbmV3TGV2ZWwsIGlkOiB1cmxJZH0pO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBpbnZhbGlkIGxldmVsIGlkIGdpdmVuLCB0cmlnZ2VyIGVycm9yXG4gICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZSA6IEVycm9yVHlwZXMuT1RIRVJfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5MRVZFTF9TV0lUQ0hfRVJST1IsIGxldmVsOiBuZXdMZXZlbCwgZmF0YWw6IGZhbHNlLCByZWFzb246ICdpbnZhbGlkIGxldmVsIGlkeCd9KTtcbiAgICB9XG4gfVxuXG4gIGdldCBtYW51YWxMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5fbWFudWFsTGV2ZWw7XG4gIH1cblxuICBzZXQgbWFudWFsTGV2ZWwobmV3TGV2ZWwpIHtcbiAgICB0aGlzLl9tYW51YWxMZXZlbCA9IG5ld0xldmVsO1xuICAgIGlmIChuZXdMZXZlbCAhPT0gLTEpIHtcbiAgICAgIHRoaXMubGV2ZWwgPSBuZXdMZXZlbDtcbiAgICB9XG4gIH1cblxuICBnZXQgZmlyc3RMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5fZmlyc3RMZXZlbDtcbiAgfVxuXG4gIHNldCBmaXJzdExldmVsKG5ld0xldmVsKSB7XG4gICAgdGhpcy5fZmlyc3RMZXZlbCA9IG5ld0xldmVsO1xuICB9XG5cbiAgZ2V0IHN0YXJ0TGV2ZWwoKSB7XG4gICAgaWYgKHRoaXMuX3N0YXJ0TGV2ZWwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2ZpcnN0TGV2ZWw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0aGlzLl9zdGFydExldmVsO1xuICAgIH1cbiAgfVxuXG4gIHNldCBzdGFydExldmVsKG5ld0xldmVsKSB7XG4gICAgdGhpcy5fc3RhcnRMZXZlbCA9IG5ld0xldmVsO1xuICB9XG5cbiAgb25FcnJvcihkYXRhKSB7XG4gICAgaWYoZGF0YS5mYXRhbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBkZXRhaWxzID0gZGF0YS5kZXRhaWxzLCBobHMgPSB0aGlzLmhscywgbGV2ZWxJZCwgbGV2ZWw7XG4gICAgLy8gdHJ5IHRvIHJlY292ZXIgbm90IGZhdGFsIGVycm9yc1xuICAgIHN3aXRjaChkZXRhaWxzKSB7XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5GUkFHX0xPQURfRVJST1I6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5GUkFHX0xPQURfVElNRU9VVDpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkZSQUdfTE9PUF9MT0FESU5HX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuS0VZX0xPQURfRVJST1I6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5LRVlfTE9BRF9USU1FT1VUOlxuICAgICAgICAgbGV2ZWxJZCA9IGRhdGEuZnJhZy5sZXZlbDtcbiAgICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBFcnJvckRldGFpbHMuTEVWRUxfTE9BRF9FUlJPUjpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkxFVkVMX0xPQURfVElNRU9VVDpcbiAgICAgICAgbGV2ZWxJZCA9IGRhdGEubGV2ZWw7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIC8qIHRyeSB0byBzd2l0Y2ggdG8gYSByZWR1bmRhbnQgc3RyZWFtIGlmIGFueSBhdmFpbGFibGUuXG4gICAgICogaWYgbm8gcmVkdW5kYW50IHN0cmVhbSBhdmFpbGFibGUsIGVtZXJnZW5jeSBzd2l0Y2ggZG93biAoaWYgaW4gYXV0byBtb2RlIGFuZCBjdXJyZW50IGxldmVsIG5vdCAwKVxuICAgICAqIG90aGVyd2lzZSwgd2UgY2Fubm90IHJlY292ZXIgdGhpcyBuZXR3b3JrIGVycm9yIC4uLlxuICAgICAqIGRvbid0IHJhaXNlIEZSQUdfTE9BRF9FUlJPUiBhbmQgRlJBR19MT0FEX1RJTUVPVVQgYXMgZmF0YWwsIGFzIGl0IGlzIGhhbmRsZWQgYnkgbWVkaWFDb250cm9sbGVyXG4gICAgICovXG4gICAgaWYgKGxldmVsSWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgbGV2ZWwgPSB0aGlzLl9sZXZlbHNbbGV2ZWxJZF07XG4gICAgICBpZiAobGV2ZWwudXJsSWQgPCAobGV2ZWwudXJsLmxlbmd0aCAtIDEpKSB7XG4gICAgICAgIGxldmVsLnVybElkKys7XG4gICAgICAgIGxldmVsLmRldGFpbHMgPSB1bmRlZmluZWQ7XG4gICAgICAgIGxvZ2dlci53YXJuKGBsZXZlbCBjb250cm9sbGVyLCR7ZGV0YWlsc30gZm9yIGxldmVsICR7bGV2ZWxJZH06IHN3aXRjaGluZyB0byByZWR1bmRhbnQgc3RyZWFtIGlkICR7bGV2ZWwudXJsSWR9YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyB3ZSBjb3VsZCB0cnkgdG8gcmVjb3ZlciBpZiBpbiBhdXRvIG1vZGUgYW5kIGN1cnJlbnQgbGV2ZWwgbm90IGxvd2VzdCBsZXZlbCAoMClcbiAgICAgICAgbGV0IHJlY292ZXJhYmxlID0gKCh0aGlzLl9tYW51YWxMZXZlbCA9PT0gLTEpICYmIGxldmVsSWQpO1xuICAgICAgICBpZiAocmVjb3ZlcmFibGUpIHtcbiAgICAgICAgICBsb2dnZXIud2FybihgbGV2ZWwgY29udHJvbGxlciwke2RldGFpbHN9OiBlbWVyZ2VuY3kgc3dpdGNoLWRvd24gZm9yIG5leHQgZnJhZ21lbnRgKTtcbiAgICAgICAgICBobHMuYWJyQ29udHJvbGxlci5uZXh0QXV0b0xldmVsID0gMDtcbiAgICAgICAgfSBlbHNlIGlmKGxldmVsICYmIGxldmVsLmRldGFpbHMgJiYgbGV2ZWwuZGV0YWlscy5saXZlKSB7XG4gICAgICAgICAgbG9nZ2VyLndhcm4oYGxldmVsIGNvbnRyb2xsZXIsJHtkZXRhaWxzfSBvbiBsaXZlIHN0cmVhbSwgZGlzY2FyZGApO1xuICAgICAgICAvLyBGUkFHX0xPQURfRVJST1IgYW5kIEZSQUdfTE9BRF9USU1FT1VUIGFyZSBoYW5kbGVkIGJ5IG1lZGlhQ29udHJvbGxlclxuICAgICAgICB9IGVsc2UgaWYgKGRldGFpbHMgIT09IEVycm9yRGV0YWlscy5GUkFHX0xPQURfRVJST1IgJiYgZGV0YWlscyAhPT0gRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9USU1FT1VUKSB7XG4gICAgICAgICAgbG9nZ2VyLmVycm9yKGBjYW5ub3QgcmVjb3ZlciAke2RldGFpbHN9IGVycm9yYCk7XG4gICAgICAgICAgdGhpcy5fbGV2ZWwgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgLy8gc3RvcHBpbmcgbGl2ZSByZWxvYWRpbmcgdGltZXIgaWYgYW55XG4gICAgICAgICAgaWYgKHRoaXMudGltZXIpIHtcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy50aW1lcik7XG4gICAgICAgICAgICB0aGlzLnRpbWVyID0gbnVsbDtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gcmVkaXNwYXRjaCBzYW1lIGVycm9yIGJ1dCB3aXRoIGZhdGFsIHNldCB0byB0cnVlXG4gICAgICAgICAgZGF0YS5mYXRhbCA9IHRydWU7XG4gICAgICAgICAgaGxzLnRyaWdnZXIoZXZlbnQsIGRhdGEpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgb25MZXZlbExvYWRlZChkYXRhKSB7XG4gICAgLy8gY2hlY2sgaWYgY3VycmVudCBwbGF5bGlzdCBpcyBhIGxpdmUgcGxheWxpc3RcbiAgICBpZiAoZGF0YS5kZXRhaWxzLmxpdmUgJiYgIXRoaXMudGltZXIpIHtcbiAgICAgIC8vIGlmIGxpdmUgcGxheWxpc3Qgd2Ugd2lsbCBoYXZlIHRvIHJlbG9hZCBpdCBwZXJpb2RpY2FsbHlcbiAgICAgIC8vIHNldCByZWxvYWQgcGVyaW9kIHRvIHBsYXlsaXN0IHRhcmdldCBkdXJhdGlvblxuICAgICAgdGhpcy50aW1lciA9IHNldEludGVydmFsKHRoaXMub250aWNrLCAxMDAwICogZGF0YS5kZXRhaWxzLnRhcmdldGR1cmF0aW9uKTtcbiAgICB9XG4gICAgaWYgKCFkYXRhLmRldGFpbHMubGl2ZSAmJiB0aGlzLnRpbWVyKSB7XG4gICAgICAvLyBwbGF5bGlzdCBpcyBub3QgbGl2ZSBhbmQgdGltZXIgaXMgYXJtZWQgOiBzdG9wcGluZyBpdFxuICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnRpbWVyKTtcbiAgICAgIHRoaXMudGltZXIgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIHRpY2soKSB7XG4gICAgdmFyIGxldmVsSWQgPSB0aGlzLl9sZXZlbDtcbiAgICBpZiAobGV2ZWxJZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB2YXIgbGV2ZWwgPSB0aGlzLl9sZXZlbHNbbGV2ZWxJZF0sIHVybElkID0gbGV2ZWwudXJsSWQ7XG4gICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkxFVkVMX0xPQURJTkcsIHt1cmw6IGxldmVsLnVybFt1cmxJZF0sIGxldmVsOiBsZXZlbElkLCBpZDogdXJsSWR9KTtcbiAgICB9XG4gIH1cblxuICBuZXh0TG9hZExldmVsKCkge1xuICAgIGlmICh0aGlzLl9tYW51YWxMZXZlbCAhPT0gLTEpIHtcbiAgICAgIHJldHVybiB0aGlzLl9tYW51YWxMZXZlbDtcbiAgICB9IGVsc2Uge1xuICAgICByZXR1cm4gdGhpcy5obHMuYWJyQ29udHJvbGxlci5uZXh0QXV0b0xldmVsO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBMZXZlbENvbnRyb2xsZXI7XG5cbiIsIi8qXG4gKiBNU0UgTWVkaWEgQ29udHJvbGxlclxuKi9cblxuaW1wb3J0IERlbXV4ZXIgZnJvbSAnLi4vZGVtdXgvZGVtdXhlcic7XG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBFdmVudEhhbmRsZXIgZnJvbSAnLi4vZXZlbnQtaGFuZGxlcic7XG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCBCaW5hcnlTZWFyY2ggZnJvbSAnLi4vdXRpbHMvYmluYXJ5LXNlYXJjaCc7XG5pbXBvcnQgTGV2ZWxIZWxwZXIgZnJvbSAnLi4vaGVscGVyL2xldmVsLWhlbHBlcic7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcblxuY29uc3QgU3RhdGUgPSB7XG4gIEVSUk9SIDogLTIsXG4gIFNUQVJUSU5HIDogLTEsXG4gIElETEUgOiAwLFxuICBLRVlfTE9BRElORyA6IDEsXG4gIEZSQUdfTE9BRElORyA6IDIsXG4gIEZSQUdfTE9BRElOR19XQUlUSU5HX1JFVFJZIDogMyxcbiAgV0FJVElOR19MRVZFTCA6IDQsXG4gIFBBUlNJTkcgOiA1LFxuICBQQVJTRUQgOiA2LFxuICBBUFBFTkRJTkcgOiA3LFxuICBCVUZGRVJfRkxVU0hJTkcgOiA4XG59O1xuXG5jbGFzcyBNU0VNZWRpYUNvbnRyb2xsZXIgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHN1cGVyKGhscywgRXZlbnQuTUVESUFfQVRUQUNISU5HLFxuICAgICAgRXZlbnQuTUVESUFfREVUQUNISU5HLFxuICAgICAgRXZlbnQuTUFOSUZFU1RfUEFSU0VELFxuICAgICAgRXZlbnQuTEVWRUxfTE9BREVELFxuICAgICAgRXZlbnQuS0VZX0xPQURFRCxcbiAgICAgIEV2ZW50LkZSQUdfTE9BREVELFxuICAgICAgRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCxcbiAgICAgIEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLFxuICAgICAgRXZlbnQuRlJBR19QQVJTRUQsXG4gICAgICBFdmVudC5FUlJPUik7XG4gICAgdGhpcy5jb25maWcgPSBobHMuY29uZmlnO1xuICAgIHRoaXMuYXVkaW9Db2RlY1N3YXAgPSBmYWxzZTtcbiAgICB0aGlzLnRpY2tzID0gMDtcbiAgICAvLyBTb3VyY2UgQnVmZmVyIGxpc3RlbmVyc1xuICAgIHRoaXMub25zYnVlID0gdGhpcy5vblNCVXBkYXRlRW5kLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbnNiZSAgPSB0aGlzLm9uU0JVcGRhdGVFcnJvci5iaW5kKHRoaXMpO1xuICAgIHRoaXMub250aWNrID0gdGhpcy50aWNrLmJpbmQodGhpcyk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIHRoaXMuc3RvcCgpO1xuICAgIEV2ZW50SGFuZGxlci5wcm90b3R5cGUuZGVzdHJveS5jYWxsKHRoaXMpO1xuICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICB9XG5cbiAgc3RhcnRMb2FkKCkge1xuICAgIGlmICh0aGlzLmxldmVscyAmJiB0aGlzLm1lZGlhKSB7XG4gICAgICB0aGlzLnN0YXJ0SW50ZXJuYWwoKTtcbiAgICAgIGlmICh0aGlzLmxhc3RDdXJyZW50VGltZSkge1xuICAgICAgICBsb2dnZXIubG9nKGBzZWVraW5nIEAgJHt0aGlzLmxhc3RDdXJyZW50VGltZX1gKTtcbiAgICAgICAgaWYgKCF0aGlzLmxhc3RQYXVzZWQpIHtcbiAgICAgICAgICBsb2dnZXIubG9nKCdyZXN1bWluZyB2aWRlbycpO1xuICAgICAgICAgIHRoaXMubWVkaWEucGxheSgpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5sYXN0Q3VycmVudFRpbWUgPSAwO1xuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuU1RBUlRJTkc7XG4gICAgICB9XG4gICAgICB0aGlzLm5leHRMb2FkUG9zaXRpb24gPSB0aGlzLnN0YXJ0UG9zaXRpb24gPSB0aGlzLmxhc3RDdXJyZW50VGltZTtcbiAgICAgIHRoaXMudGljaygpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsb2dnZXIud2FybignY2Fubm90IHN0YXJ0IGxvYWRpbmcgYXMgZWl0aGVyIG1hbmlmZXN0IG5vdCBwYXJzZWQgb3IgdmlkZW8gbm90IGF0dGFjaGVkJyk7XG4gICAgfVxuICB9XG5cbiAgc3RhcnRJbnRlcm5hbCgpIHtcbiAgICB2YXIgaGxzID0gdGhpcy5obHM7XG4gICAgdGhpcy5zdG9wKCk7XG4gICAgdGhpcy5kZW11eGVyID0gbmV3IERlbXV4ZXIoaGxzKTtcbiAgICB0aGlzLnRpbWVyID0gc2V0SW50ZXJ2YWwodGhpcy5vbnRpY2ssIDEwMCk7XG4gICAgdGhpcy5sZXZlbCA9IC0xO1xuICAgIHRoaXMuZnJhZ0xvYWRFcnJvciA9IDA7XG4gIH1cblxuICBzdG9wKCkge1xuICAgIHRoaXMubXA0c2VnbWVudHMgPSBbXTtcbiAgICB0aGlzLmZsdXNoUmFuZ2UgPSBbXTtcbiAgICB0aGlzLmJ1ZmZlclJhbmdlID0gW107XG4gICAgdGhpcy5zdGFsbGVkID0gZmFsc2U7XG4gICAgdmFyIGZyYWcgPSB0aGlzLmZyYWdDdXJyZW50O1xuICAgIGlmIChmcmFnKSB7XG4gICAgICBpZiAoZnJhZy5sb2FkZXIpIHtcbiAgICAgICAgZnJhZy5sb2FkZXIuYWJvcnQoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuZnJhZ0N1cnJlbnQgPSBudWxsO1xuICAgIH1cbiAgICB0aGlzLmZyYWdQcmV2aW91cyA9IG51bGw7XG4gICAgaWYgKHRoaXMuc291cmNlQnVmZmVyKSB7XG4gICAgICBmb3IodmFyIHR5cGUgaW4gdGhpcy5zb3VyY2VCdWZmZXIpIHtcbiAgICAgICAgdmFyIHNiID0gdGhpcy5zb3VyY2VCdWZmZXJbdHlwZV07XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdGhpcy5tZWRpYVNvdXJjZS5yZW1vdmVTb3VyY2VCdWZmZXIoc2IpO1xuICAgICAgICAgIHNiLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3VwZGF0ZWVuZCcsIHRoaXMub25zYnVlKTtcbiAgICAgICAgICBzYi5yZW1vdmVFdmVudExpc3RlbmVyKCdlcnJvcicsIHRoaXMub25zYmUpO1xuICAgICAgICB9IGNhdGNoKGVycikge1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLnNvdXJjZUJ1ZmZlciA9IG51bGw7XG4gICAgfVxuICAgIGlmICh0aGlzLnRpbWVyKSB7XG4gICAgICBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgICAgdGhpcy50aW1lciA9IG51bGw7XG4gICAgfVxuICAgIGlmICh0aGlzLmRlbXV4ZXIpIHtcbiAgICAgIHRoaXMuZGVtdXhlci5kZXN0cm95KCk7XG4gICAgICB0aGlzLmRlbXV4ZXIgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIHRpY2soKSB7XG4gICAgdGhpcy50aWNrcysrO1xuICAgIGlmICh0aGlzLnRpY2tzID09PSAxKSB7XG4gICAgICB0aGlzLmRvVGljaygpO1xuICAgICAgaWYgKHRoaXMudGlja3MgPiAxKSB7XG4gICAgICAgIHNldFRpbWVvdXQodGhpcy50aWNrLCAxKTtcbiAgICAgIH1cbiAgICAgIHRoaXMudGlja3MgPSAwO1xuICAgIH1cbiAgfVxuXG4gIGRvVGljaygpIHtcbiAgICB2YXIgcG9zLCBsZXZlbCwgbGV2ZWxEZXRhaWxzLCBobHMgPSB0aGlzLmhscztcbiAgICBzd2l0Y2godGhpcy5zdGF0ZSkge1xuICAgICAgY2FzZSBTdGF0ZS5FUlJPUjpcbiAgICAgICAgLy9kb24ndCBkbyBhbnl0aGluZyBpbiBlcnJvciBzdGF0ZSB0byBhdm9pZCBicmVha2luZyBmdXJ0aGVyIC4uLlxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgU3RhdGUuU1RBUlRJTkc6XG4gICAgICAgIC8vIGRldGVybWluZSBsb2FkIGxldmVsXG4gICAgICAgIHRoaXMuc3RhcnRMZXZlbCA9IGhscy5zdGFydExldmVsO1xuICAgICAgICBpZiAodGhpcy5zdGFydExldmVsID09PSAtMSkge1xuICAgICAgICAgIC8vIC0xIDogZ3Vlc3Mgc3RhcnQgTGV2ZWwgYnkgZG9pbmcgYSBiaXRyYXRlIHRlc3QgYnkgbG9hZGluZyBmaXJzdCBmcmFnbWVudCBvZiBsb3dlc3QgcXVhbGl0eSBsZXZlbFxuICAgICAgICAgIHRoaXMuc3RhcnRMZXZlbCA9IDA7XG4gICAgICAgICAgdGhpcy5mcmFnQml0cmF0ZVRlc3QgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIC8vIHNldCBuZXcgbGV2ZWwgdG8gcGxheWxpc3QgbG9hZGVyIDogdGhpcyB3aWxsIHRyaWdnZXIgc3RhcnQgbGV2ZWwgbG9hZFxuICAgICAgICB0aGlzLmxldmVsID0gaGxzLm5leHRMb2FkTGV2ZWwgPSB0aGlzLnN0YXJ0TGV2ZWw7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5XQUlUSU5HX0xFVkVMO1xuICAgICAgICB0aGlzLmxvYWRlZG1ldGFkYXRhID0gZmFsc2U7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBTdGF0ZS5JRExFOlxuICAgICAgICAvLyBpZiB2aWRlbyBkZXRhY2hlZCBvciB1bmJvdW5kIGV4aXQgbG9vcFxuICAgICAgICBpZiAoIXRoaXMubWVkaWEpIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICAvLyBkZXRlcm1pbmUgbmV4dCBjYW5kaWRhdGUgZnJhZ21lbnQgdG8gYmUgbG9hZGVkLCBiYXNlZCBvbiBjdXJyZW50IHBvc2l0aW9uIGFuZFxuICAgICAgICAvLyAgZW5kIG9mIGJ1ZmZlciBwb3NpdGlvblxuICAgICAgICAvLyAgZW5zdXJlIDYwcyBvZiBidWZmZXIgdXBmcm9udFxuICAgICAgICAvLyBpZiB3ZSBoYXZlIG5vdCB5ZXQgbG9hZGVkIGFueSBmcmFnbWVudCwgc3RhcnQgbG9hZGluZyBmcm9tIHN0YXJ0IHBvc2l0aW9uXG4gICAgICAgIGlmICh0aGlzLmxvYWRlZG1ldGFkYXRhKSB7XG4gICAgICAgICAgcG9zID0gdGhpcy5tZWRpYS5jdXJyZW50VGltZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwb3MgPSB0aGlzLm5leHRMb2FkUG9zaXRpb247XG4gICAgICAgIH1cbiAgICAgICAgLy8gZGV0ZXJtaW5lIG5leHQgbG9hZCBsZXZlbFxuICAgICAgICBpZiAodGhpcy5zdGFydEZyYWdtZW50UmVxdWVzdGVkID09PSBmYWxzZSkge1xuICAgICAgICAgIGxldmVsID0gdGhpcy5zdGFydExldmVsO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIHdlIGFyZSBub3QgYXQgcGxheWJhY2sgc3RhcnQsIGdldCBuZXh0IGxvYWQgbGV2ZWwgZnJvbSBsZXZlbCBDb250cm9sbGVyXG4gICAgICAgICAgbGV2ZWwgPSBobHMubmV4dExvYWRMZXZlbDtcbiAgICAgICAgfVxuICAgICAgICB2YXIgYnVmZmVySW5mbyA9IHRoaXMuYnVmZmVySW5mbyhwb3MsdGhpcy5jb25maWcubWF4QnVmZmVySG9sZSksXG4gICAgICAgICAgICBidWZmZXJMZW4gPSBidWZmZXJJbmZvLmxlbixcbiAgICAgICAgICAgIGJ1ZmZlckVuZCA9IGJ1ZmZlckluZm8uZW5kLFxuICAgICAgICAgICAgZnJhZ1ByZXZpb3VzID0gdGhpcy5mcmFnUHJldmlvdXMsXG4gICAgICAgICAgICBtYXhCdWZMZW47XG4gICAgICAgIC8vIGNvbXB1dGUgbWF4IEJ1ZmZlciBMZW5ndGggdGhhdCB3ZSBjb3VsZCBnZXQgZnJvbSB0aGlzIGxvYWQgbGV2ZWwsIGJhc2VkIG9uIGxldmVsIGJpdHJhdGUuIGRvbid0IGJ1ZmZlciBtb3JlIHRoYW4gNjAgTUIgYW5kIG1vcmUgdGhhbiAzMHNcbiAgICAgICAgaWYgKCh0aGlzLmxldmVsc1tsZXZlbF0pLmhhc093blByb3BlcnR5KCdiaXRyYXRlJykpIHtcbiAgICAgICAgICBtYXhCdWZMZW4gPSBNYXRoLm1heCg4ICogdGhpcy5jb25maWcubWF4QnVmZmVyU2l6ZSAvIHRoaXMubGV2ZWxzW2xldmVsXS5iaXRyYXRlLCB0aGlzLmNvbmZpZy5tYXhCdWZmZXJMZW5ndGgpO1xuICAgICAgICAgIG1heEJ1ZkxlbiA9IE1hdGgubWluKG1heEJ1ZkxlbiwgdGhpcy5jb25maWcubWF4TWF4QnVmZmVyTGVuZ3RoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBtYXhCdWZMZW4gPSB0aGlzLmNvbmZpZy5tYXhCdWZmZXJMZW5ndGg7XG4gICAgICAgIH1cbiAgICAgICAgLy8gaWYgYnVmZmVyIGxlbmd0aCBpcyBsZXNzIHRoYW4gbWF4QnVmTGVuIHRyeSB0byBsb2FkIGEgbmV3IGZyYWdtZW50XG4gICAgICAgIGlmIChidWZmZXJMZW4gPCBtYXhCdWZMZW4pIHtcbiAgICAgICAgICAvLyBzZXQgbmV4dCBsb2FkIGxldmVsIDogdGhpcyB3aWxsIHRyaWdnZXIgYSBwbGF5bGlzdCBsb2FkIGlmIG5lZWRlZFxuICAgICAgICAgIGhscy5uZXh0TG9hZExldmVsID0gbGV2ZWw7XG4gICAgICAgICAgdGhpcy5sZXZlbCA9IGxldmVsO1xuICAgICAgICAgIGxldmVsRGV0YWlscyA9IHRoaXMubGV2ZWxzW2xldmVsXS5kZXRhaWxzO1xuICAgICAgICAgIC8vIGlmIGxldmVsIGluZm8gbm90IHJldHJpZXZlZCB5ZXQsIHN3aXRjaCBzdGF0ZSBhbmQgd2FpdCBmb3IgbGV2ZWwgcmV0cmlldmFsXG4gICAgICAgICAgLy8gaWYgbGl2ZSBwbGF5bGlzdCwgZW5zdXJlIHRoYXQgbmV3IHBsYXlsaXN0IGhhcyBiZWVuIHJlZnJlc2hlZCB0byBhdm9pZCBsb2FkaW5nL3RyeSB0byBsb2FkXG4gICAgICAgICAgLy8gYSB1c2VsZXNzIGFuZCBvdXRkYXRlZCBmcmFnbWVudCAodGhhdCBtaWdodCBldmVuIGludHJvZHVjZSBsb2FkIGVycm9yIGlmIGl0IGlzIGFscmVhZHkgb3V0IG9mIHRoZSBsaXZlIHBsYXlsaXN0KVxuICAgICAgICAgIGlmICh0eXBlb2YgbGV2ZWxEZXRhaWxzID09PSAndW5kZWZpbmVkJyB8fCBsZXZlbERldGFpbHMubGl2ZSAmJiB0aGlzLmxldmVsTGFzdExvYWRlZCAhPT0gbGV2ZWwpIHtcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5XQUlUSU5HX0xFVkVMO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIGZpbmQgZnJhZ21lbnQgaW5kZXgsIGNvbnRpZ3VvdXMgd2l0aCBlbmQgb2YgYnVmZmVyIHBvc2l0aW9uXG4gICAgICAgICAgbGV0IGZyYWdtZW50cyA9IGxldmVsRGV0YWlscy5mcmFnbWVudHMsXG4gICAgICAgICAgICAgIGZyYWdMZW4gPSBmcmFnbWVudHMubGVuZ3RoLFxuICAgICAgICAgICAgICBzdGFydCA9IGZyYWdtZW50c1swXS5zdGFydCxcbiAgICAgICAgICAgICAgZW5kID0gZnJhZ21lbnRzW2ZyYWdMZW4tMV0uc3RhcnQgKyBmcmFnbWVudHNbZnJhZ0xlbi0xXS5kdXJhdGlvbixcbiAgICAgICAgICAgICAgZnJhZztcblxuICAgICAgICAgICAgLy8gaW4gY2FzZSBvZiBsaXZlIHBsYXlsaXN0IHdlIG5lZWQgdG8gZW5zdXJlIHRoYXQgcmVxdWVzdGVkIHBvc2l0aW9uIGlzIG5vdCBsb2NhdGVkIGJlZm9yZSBwbGF5bGlzdCBzdGFydFxuICAgICAgICAgIGlmIChsZXZlbERldGFpbHMubGl2ZSkge1xuICAgICAgICAgICAgLy8gY2hlY2sgaWYgcmVxdWVzdGVkIHBvc2l0aW9uIGlzIHdpdGhpbiBzZWVrYWJsZSBib3VuZGFyaWVzIDpcbiAgICAgICAgICAgIC8vbG9nZ2VyLmxvZyhgc3RhcnQvcG9zL2J1ZkVuZC9zZWVraW5nOiR7c3RhcnQudG9GaXhlZCgzKX0vJHtwb3MudG9GaXhlZCgzKX0vJHtidWZmZXJFbmQudG9GaXhlZCgzKX0vJHt0aGlzLm1lZGlhLnNlZWtpbmd9YCk7XG4gICAgICAgICAgICBpZiAoYnVmZmVyRW5kIDwgTWF0aC5tYXgoc3RhcnQsZW5kLXRoaXMuY29uZmlnLmxpdmVNYXhMYXRlbmN5RHVyYXRpb25Db3VudCpsZXZlbERldGFpbHMudGFyZ2V0ZHVyYXRpb24pKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zZWVrQWZ0ZXJCdWZmZXJlZCA9IHN0YXJ0ICsgTWF0aC5tYXgoMCwgbGV2ZWxEZXRhaWxzLnRvdGFsZHVyYXRpb24gLSB0aGlzLmNvbmZpZy5saXZlU3luY0R1cmF0aW9uQ291bnQgKiBsZXZlbERldGFpbHMudGFyZ2V0ZHVyYXRpb24pO1xuICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYGJ1ZmZlciBlbmQ6ICR7YnVmZmVyRW5kfSBpcyBsb2NhdGVkIHRvbyBmYXIgZnJvbSB0aGUgZW5kIG9mIGxpdmUgc2xpZGluZyBwbGF5bGlzdCwgbWVkaWEgcG9zaXRpb24gd2lsbCBiZSByZXNldGVkIHRvOiAke3RoaXMuc2Vla0FmdGVyQnVmZmVyZWQudG9GaXhlZCgzKX1gKTtcbiAgICAgICAgICAgICAgICBidWZmZXJFbmQgPSB0aGlzLnNlZWtBZnRlckJ1ZmZlcmVkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRoaXMuc3RhcnRGcmFnbWVudFJlcXVlc3RlZCAmJiAhbGV2ZWxEZXRhaWxzLlBUU0tub3duKSB7XG4gICAgICAgICAgICAgIC8qIHdlIGFyZSBzd2l0Y2hpbmcgbGV2ZWwgb24gbGl2ZSBwbGF5bGlzdCwgYnV0IHdlIGRvbid0IGhhdmUgYW55IFBUUyBpbmZvIGZvciB0aGF0IHF1YWxpdHkgbGV2ZWwgLi4uXG4gICAgICAgICAgICAgICAgIHRyeSB0byBsb2FkIGZyYWcgbWF0Y2hpbmcgd2l0aCBuZXh0IFNOLlxuICAgICAgICAgICAgICAgICBldmVuIGlmIFNOIGFyZSBub3Qgc3luY2hyb25pemVkIGJldHdlZW4gcGxheWxpc3RzLCBsb2FkaW5nIHRoaXMgZnJhZyB3aWxsIGhlbHAgdXNcbiAgICAgICAgICAgICAgICAgY29tcHV0ZSBwbGF5bGlzdCBzbGlkaW5nIGFuZCBmaW5kIHRoZSByaWdodCBvbmUgYWZ0ZXIgaW4gY2FzZSBpdCB3YXMgbm90IHRoZSByaWdodCBjb25zZWN1dGl2ZSBvbmUgKi9cbiAgICAgICAgICAgICAgaWYgKGZyYWdQcmV2aW91cykge1xuICAgICAgICAgICAgICAgIHZhciB0YXJnZXRTTiA9IGZyYWdQcmV2aW91cy5zbiArIDE7XG4gICAgICAgICAgICAgICAgaWYgKHRhcmdldFNOID49IGxldmVsRGV0YWlscy5zdGFydFNOICYmIHRhcmdldFNOIDw9IGxldmVsRGV0YWlscy5lbmRTTikge1xuICAgICAgICAgICAgICAgICAgZnJhZyA9IGZyYWdtZW50c1t0YXJnZXRTTiAtIGxldmVsRGV0YWlscy5zdGFydFNOXTtcbiAgICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYGxpdmUgcGxheWxpc3QsIHN3aXRjaGluZyBwbGF5bGlzdCwgbG9hZCBmcmFnIHdpdGggbmV4dCBTTjogJHtmcmFnLnNufWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoIWZyYWcpIHtcbiAgICAgICAgICAgICAgICAvKiB3ZSBoYXZlIG5vIGlkZWEgYWJvdXQgd2hpY2ggZnJhZ21lbnQgc2hvdWxkIGJlIGxvYWRlZC5cbiAgICAgICAgICAgICAgICAgICBzbyBsZXQncyBsb2FkIG1pZCBmcmFnbWVudC4gaXQgd2lsbCBoZWxwIGNvbXB1dGluZyBwbGF5bGlzdCBzbGlkaW5nIGFuZCBmaW5kIHRoZSByaWdodCBvbmVcbiAgICAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgICAgIGZyYWcgPSBmcmFnbWVudHNbTWF0aC5taW4oZnJhZ0xlbiAtIDEsIE1hdGgucm91bmQoZnJhZ0xlbiAvIDIpKV07XG4gICAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgbGl2ZSBwbGF5bGlzdCwgc3dpdGNoaW5nIHBsYXlsaXN0LCB1bmtub3duLCBsb2FkIG1pZGRsZSBmcmFnIDogJHtmcmFnLnNufWApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIFZvRCBwbGF5bGlzdDogaWYgYnVmZmVyRW5kIGJlZm9yZSBzdGFydCBvZiBwbGF5bGlzdCwgbG9hZCBmaXJzdCBmcmFnbWVudFxuICAgICAgICAgICAgaWYgKGJ1ZmZlckVuZCA8IHN0YXJ0KSB7XG4gICAgICAgICAgICAgIGZyYWcgPSBmcmFnbWVudHNbMF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICghZnJhZykge1xuICAgICAgICAgICAgdmFyIGZvdW5kRnJhZztcbiAgICAgICAgICAgIGlmIChidWZmZXJFbmQgPCBlbmQpIHtcbiAgICAgICAgICAgICAgZm91bmRGcmFnID0gQmluYXJ5U2VhcmNoLnNlYXJjaChmcmFnbWVudHMsIChjYW5kaWRhdGUpID0+IHtcbiAgICAgICAgICAgICAgICAvL2xvZ2dlci5sb2coYGxldmVsL3NuL3N0YXJ0L2VuZC9idWZFbmQ6JHtsZXZlbH0vJHtjYW5kaWRhdGUuc259LyR7Y2FuZGlkYXRlLnN0YXJ0fS8keyhjYW5kaWRhdGUuc3RhcnQrY2FuZGlkYXRlLmR1cmF0aW9uKX0vJHtidWZmZXJFbmR9YCk7XG4gICAgICAgICAgICAgICAgLy8gb2Zmc2V0IHNob3VsZCBiZSB3aXRoaW4gZnJhZ21lbnQgYm91bmRhcnlcbiAgICAgICAgICAgICAgICBpZiAoKGNhbmRpZGF0ZS5zdGFydCArIGNhbmRpZGF0ZS5kdXJhdGlvbikgPD0gYnVmZmVyRW5kKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoY2FuZGlkYXRlLnN0YXJ0ID4gYnVmZmVyRW5kKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIHJlYWNoIGVuZCBvZiBwbGF5bGlzdFxuICAgICAgICAgICAgICBmb3VuZEZyYWcgPSBmcmFnbWVudHNbZnJhZ0xlbi0xXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChmb3VuZEZyYWcpIHtcbiAgICAgICAgICAgICAgZnJhZyA9IGZvdW5kRnJhZztcbiAgICAgICAgICAgICAgc3RhcnQgPSBmb3VuZEZyYWcuc3RhcnQ7XG4gICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnZmluZCBTTiBtYXRjaGluZyB3aXRoIHBvczonICsgIGJ1ZmZlckVuZCArICc6JyArIGZyYWcuc24pO1xuICAgICAgICAgICAgICBpZiAoZnJhZ1ByZXZpb3VzICYmIGZyYWcubGV2ZWwgPT09IGZyYWdQcmV2aW91cy5sZXZlbCAmJiBmcmFnLnNuID09PSBmcmFnUHJldmlvdXMuc24pIHtcbiAgICAgICAgICAgICAgICBpZiAoZnJhZy5zbiA8IGxldmVsRGV0YWlscy5lbmRTTikge1xuICAgICAgICAgICAgICAgICAgZnJhZyA9IGZyYWdtZW50c1tmcmFnLnNuICsgMSAtIGxldmVsRGV0YWlscy5zdGFydFNOXTtcbiAgICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYFNOIGp1c3QgbG9hZGVkLCBsb2FkIG5leHQgb25lOiAke2ZyYWcuc259YCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIC8vIGhhdmUgd2UgcmVhY2hlZCBlbmQgb2YgVk9EIHBsYXlsaXN0ID9cbiAgICAgICAgICAgICAgICAgIGlmICghbGV2ZWxEZXRhaWxzLmxpdmUpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG1lZGlhU291cmNlID0gdGhpcy5tZWRpYVNvdXJjZTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1lZGlhU291cmNlICYmIG1lZGlhU291cmNlLnJlYWR5U3RhdGUgPT09ICdvcGVuJykge1xuICAgICAgICAgICAgICAgICAgICAgICAvLyBlbnN1cmUgc291cmNlQnVmZmVyIGFyZSBub3QgaW4gdXBkYXRpbmcgc3RhdGVzXG4gICAgICAgICAgICAgICAgICAgICAgdmFyIHNiID0gdGhpcy5zb3VyY2VCdWZmZXI7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKCEoKHNiLmF1ZGlvICYmIHNiLmF1ZGlvLnVwZGF0aW5nKSB8fCAoc2IudmlkZW8gJiYgc2IudmlkZW8udXBkYXRpbmcpKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nZ2VyLmxvZygnYWxsIG1lZGlhIGRhdGEgYXZhaWxhYmxlLCBzaWduYWwgZW5kT2ZTdHJlYW0oKSB0byBNZWRpYVNvdXJjZScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy9Ob3RpZnkgdGhlIG1lZGlhIGVsZW1lbnQgdGhhdCBpdCBub3cgaGFzIGFsbCBvZiB0aGUgbWVkaWEgZGF0YVxuICAgICAgICAgICAgICAgICAgICAgICAgbWVkaWFTb3VyY2UuZW5kT2ZTdHJlYW0oKTtcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIGZyYWcgPSBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZihmcmFnKSB7XG4gICAgICAgICAgICAvL2xvZ2dlci5sb2coJyAgICAgIGxvYWRpbmcgZnJhZyAnICsgaSArJyxwb3MvYnVmRW5kOicgKyBwb3MudG9GaXhlZCgzKSArICcvJyArIGJ1ZmZlckVuZC50b0ZpeGVkKDMpKTtcbiAgICAgICAgICAgIGlmICgoZnJhZy5kZWNyeXB0ZGF0YS51cmkgIT0gbnVsbCkgJiYgKGZyYWcuZGVjcnlwdGRhdGEua2V5ID09IG51bGwpKSB7XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coYExvYWRpbmcga2V5IGZvciAke2ZyYWcuc259IG9mIFske2xldmVsRGV0YWlscy5zdGFydFNOfSAsJHtsZXZlbERldGFpbHMuZW5kU059XSxsZXZlbCAke2xldmVsfWApO1xuICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuS0VZX0xPQURJTkc7XG4gICAgICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50LktFWV9MT0FESU5HLCB7ZnJhZzogZnJhZ30pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgTG9hZGluZyAke2ZyYWcuc259IG9mIFske2xldmVsRGV0YWlscy5zdGFydFNOfSAsJHtsZXZlbERldGFpbHMuZW5kU059XSxsZXZlbCAke2xldmVsfSwgY3VycmVudFRpbWU6JHtwb3N9LGJ1ZmZlckVuZDoke2J1ZmZlckVuZC50b0ZpeGVkKDMpfWApO1xuICAgICAgICAgICAgICBmcmFnLmF1dG9MZXZlbCA9IGhscy5hdXRvTGV2ZWxFbmFibGVkO1xuICAgICAgICAgICAgICBpZiAodGhpcy5sZXZlbHMubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgIGZyYWcuZXhwZWN0ZWRMZW4gPSBNYXRoLnJvdW5kKGZyYWcuZHVyYXRpb24gKiB0aGlzLmxldmVsc1tsZXZlbF0uYml0cmF0ZSAvIDgpO1xuICAgICAgICAgICAgICAgIGZyYWcudHJlcXVlc3QgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAvLyBlbnN1cmUgdGhhdCB3ZSBhcmUgbm90IHJlbG9hZGluZyB0aGUgc2FtZSBmcmFnbWVudHMgaW4gbG9vcCAuLi5cbiAgICAgICAgICAgICAgaWYgKHRoaXMuZnJhZ0xvYWRJZHggIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZnJhZ0xvYWRJZHgrKztcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmZyYWdMb2FkSWR4ID0gMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoZnJhZy5sb2FkQ291bnRlcikge1xuICAgICAgICAgICAgICAgIGZyYWcubG9hZENvdW50ZXIrKztcbiAgICAgICAgICAgICAgICBsZXQgbWF4VGhyZXNob2xkID0gdGhpcy5jb25maWcuZnJhZ0xvYWRpbmdMb29wVGhyZXNob2xkO1xuICAgICAgICAgICAgICAgIC8vIGlmIHRoaXMgZnJhZyBoYXMgYWxyZWFkeSBiZWVuIGxvYWRlZCAzIHRpbWVzLCBhbmQgaWYgaXQgaGFzIGJlZW4gcmVsb2FkZWQgcmVjZW50bHlcbiAgICAgICAgICAgICAgICBpZiAoZnJhZy5sb2FkQ291bnRlciA+IG1heFRocmVzaG9sZCAmJiAoTWF0aC5hYnModGhpcy5mcmFnTG9hZElkeCAtIGZyYWcubG9hZElkeCkgPCBtYXhUaHJlc2hvbGQpKSB7XG4gICAgICAgICAgICAgICAgICBobHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5GUkFHX0xPT1BfTE9BRElOR19FUlJPUiwgZmF0YWw6IGZhbHNlLCBmcmFnOiBmcmFnfSk7XG4gICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGZyYWcubG9hZENvdW50ZXIgPSAxO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGZyYWcubG9hZElkeCA9IHRoaXMuZnJhZ0xvYWRJZHg7XG4gICAgICAgICAgICAgIHRoaXMuZnJhZ0N1cnJlbnQgPSBmcmFnO1xuICAgICAgICAgICAgICB0aGlzLnN0YXJ0RnJhZ21lbnRSZXF1ZXN0ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICBobHMudHJpZ2dlcihFdmVudC5GUkFHX0xPQURJTkcsIHtmcmFnOiBmcmFnfSk7XG4gICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5GUkFHX0xPQURJTkc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBTdGF0ZS5XQUlUSU5HX0xFVkVMOlxuICAgICAgICBsZXZlbCA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdO1xuICAgICAgICAvLyBjaGVjayBpZiBwbGF5bGlzdCBpcyBhbHJlYWR5IGxvYWRlZFxuICAgICAgICBpZiAobGV2ZWwgJiYgbGV2ZWwuZGV0YWlscykge1xuICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBTdGF0ZS5GUkFHX0xPQURJTkc6XG4gICAgICAgIC8qXG4gICAgICAgICAgbW9uaXRvciBmcmFnbWVudCByZXRyaWV2YWwgdGltZS4uLlxuICAgICAgICAgIHdlIGNvbXB1dGUgZXhwZWN0ZWQgdGltZSBvZiBhcnJpdmFsIG9mIHRoZSBjb21wbGV0ZSBmcmFnbWVudC5cbiAgICAgICAgICB3ZSBjb21wYXJlIGl0IHRvIGV4cGVjdGVkIHRpbWUgb2YgYnVmZmVyIHN0YXJ2YXRpb25cbiAgICAgICAgKi9cbiAgICAgICAgbGV0IHYgPSB0aGlzLm1lZGlhLGZyYWcgPSB0aGlzLmZyYWdDdXJyZW50O1xuICAgICAgICAvKiBvbmx5IG1vbml0b3IgZnJhZyByZXRyaWV2YWwgdGltZSBpZlxuICAgICAgICAodmlkZW8gbm90IHBhdXNlZCBPUiBmaXJzdCBmcmFnbWVudCBiZWluZyBsb2FkZWQpIEFORCBhdXRvc3dpdGNoaW5nIGVuYWJsZWQgQU5EIG5vdCBsb3dlc3QgbGV2ZWwgQU5EIG11bHRpcGxlIGxldmVscyAqL1xuICAgICAgICBpZiAodiAmJiAoIXYucGF1c2VkIHx8IHRoaXMubG9hZGVkbWV0YWRhdGEgPT09IGZhbHNlKSAmJiBmcmFnLmF1dG9MZXZlbCAmJiB0aGlzLmxldmVsICYmIHRoaXMubGV2ZWxzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICB2YXIgcmVxdWVzdERlbGF5ID0gcGVyZm9ybWFuY2Uubm93KCkgLSBmcmFnLnRyZXF1ZXN0O1xuICAgICAgICAgIC8vIG1vbml0b3IgZnJhZ21lbnQgbG9hZCBwcm9ncmVzcyBhZnRlciBoYWxmIG9mIGV4cGVjdGVkIGZyYWdtZW50IGR1cmF0aW9uLHRvIHN0YWJpbGl6ZSBiaXRyYXRlXG4gICAgICAgICAgaWYgKHJlcXVlc3REZWxheSA+ICg1MDAgKiBmcmFnLmR1cmF0aW9uKSkge1xuICAgICAgICAgICAgdmFyIGxvYWRSYXRlID0gZnJhZy5sb2FkZWQgKiAxMDAwIC8gcmVxdWVzdERlbGF5OyAvLyBieXRlL3NcbiAgICAgICAgICAgIGlmIChmcmFnLmV4cGVjdGVkTGVuIDwgZnJhZy5sb2FkZWQpIHtcbiAgICAgICAgICAgICAgZnJhZy5leHBlY3RlZExlbiA9IGZyYWcubG9hZGVkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcG9zID0gdi5jdXJyZW50VGltZTtcbiAgICAgICAgICAgIHZhciBmcmFnTG9hZGVkRGVsYXkgPSAoZnJhZy5leHBlY3RlZExlbiAtIGZyYWcubG9hZGVkKSAvIGxvYWRSYXRlO1xuICAgICAgICAgICAgdmFyIGJ1ZmZlclN0YXJ2YXRpb25EZWxheSA9IHRoaXMuYnVmZmVySW5mbyhwb3MsdGhpcy5jb25maWcubWF4QnVmZmVySG9sZSkuZW5kIC0gcG9zO1xuICAgICAgICAgICAgdmFyIGZyYWdMZXZlbE5leHRMb2FkZWREZWxheSA9IGZyYWcuZHVyYXRpb24gKiB0aGlzLmxldmVsc1tobHMubmV4dExvYWRMZXZlbF0uYml0cmF0ZSAvICg4ICogbG9hZFJhdGUpOyAvL2Jwcy9CcHNcbiAgICAgICAgICAgIC8qIGlmIHdlIGhhdmUgbGVzcyB0aGFuIDIgZnJhZyBkdXJhdGlvbiBpbiBidWZmZXIgYW5kIGlmIGZyYWcgbG9hZGVkIGRlbGF5IGlzIGdyZWF0ZXIgdGhhbiBidWZmZXIgc3RhcnZhdGlvbiBkZWxheVxuICAgICAgICAgICAgICAuLi4gYW5kIGFsc28gYmlnZ2VyIHRoYW4gZHVyYXRpb24gbmVlZGVkIHRvIGxvYWQgZnJhZ21lbnQgYXQgbmV4dCBsZXZlbCAuLi4qL1xuICAgICAgICAgICAgaWYgKGJ1ZmZlclN0YXJ2YXRpb25EZWxheSA8ICgyICogZnJhZy5kdXJhdGlvbikgJiYgZnJhZ0xvYWRlZERlbGF5ID4gYnVmZmVyU3RhcnZhdGlvbkRlbGF5ICYmIGZyYWdMb2FkZWREZWxheSA+IGZyYWdMZXZlbE5leHRMb2FkZWREZWxheSkge1xuICAgICAgICAgICAgICAvLyBhYm9ydCBmcmFnbWVudCBsb2FkaW5nIC4uLlxuICAgICAgICAgICAgICBsb2dnZXIud2FybignbG9hZGluZyB0b28gc2xvdywgYWJvcnQgZnJhZ21lbnQgbG9hZGluZycpO1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBmcmFnTG9hZGVkRGVsYXkvYnVmZmVyU3RhcnZhdGlvbkRlbGF5L2ZyYWdMZXZlbE5leHRMb2FkZWREZWxheSA6JHtmcmFnTG9hZGVkRGVsYXkudG9GaXhlZCgxKX0vJHtidWZmZXJTdGFydmF0aW9uRGVsYXkudG9GaXhlZCgxKX0vJHtmcmFnTGV2ZWxOZXh0TG9hZGVkRGVsYXkudG9GaXhlZCgxKX1gKTtcbiAgICAgICAgICAgICAgLy9hYm9ydCBmcmFnbWVudCBsb2FkaW5nXG4gICAgICAgICAgICAgIGZyYWcubG9hZGVyLmFib3J0KCk7XG4gICAgICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkZSQUdfTE9BRF9FTUVSR0VOQ1lfQUJPUlRFRCwge2ZyYWc6IGZyYWd9KTtcbiAgICAgICAgICAgICAgLy8gc3dpdGNoIGJhY2sgdG8gSURMRSBzdGF0ZSB0byByZXF1ZXN0IG5ldyBmcmFnbWVudCBhdCBsb3dlc3QgbGV2ZWxcbiAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBTdGF0ZS5GUkFHX0xPQURJTkdfV0FJVElOR19SRVRSWTpcbiAgICAgICAgdmFyIG5vdyA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgICB2YXIgcmV0cnlEYXRlID0gdGhpcy5yZXRyeURhdGU7XG4gICAgICAgIHZhciBtZWRpYSA9IHRoaXMubWVkaWE7XG4gICAgICAgIHZhciBpc1NlZWtpbmcgPSBtZWRpYSAmJiBtZWRpYS5zZWVraW5nO1xuICAgICAgICAvLyBpZiBjdXJyZW50IHRpbWUgaXMgZ3QgdGhhbiByZXRyeURhdGUsIG9yIGlmIG1lZGlhIHNlZWtpbmcgbGV0J3Mgc3dpdGNoIHRvIElETEUgc3RhdGUgdG8gcmV0cnkgbG9hZGluZ1xuICAgICAgICBpZighcmV0cnlEYXRlIHx8IChub3cgPj0gcmV0cnlEYXRlKSB8fCBpc1NlZWtpbmcpIHtcbiAgICAgICAgICBsb2dnZXIubG9nKGBtZWRpYUNvbnRyb2xsZXI6IHJldHJ5RGF0ZSByZWFjaGVkLCBzd2l0Y2ggYmFjayB0byBJRExFIHN0YXRlYCk7XG4gICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFN0YXRlLlBBUlNJTkc6XG4gICAgICAgIC8vIG5vdGhpbmcgdG8gZG8sIHdhaXQgZm9yIGZyYWdtZW50IGJlaW5nIHBhcnNlZFxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgU3RhdGUuUEFSU0VEOlxuICAgICAgY2FzZSBTdGF0ZS5BUFBFTkRJTkc6XG4gICAgICAgIGlmICh0aGlzLnNvdXJjZUJ1ZmZlcikge1xuICAgICAgICAgIGlmICh0aGlzLm1lZGlhLmVycm9yKSB7XG4gICAgICAgICAgICBsb2dnZXIuZXJyb3IoJ3RyeWluZyB0byBhcHBlbmQgYWx0aG91Z2ggYSBtZWRpYSBlcnJvciBvY2N1cmVkLCBzd2l0Y2ggdG8gRVJST1Igc3RhdGUnKTtcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5FUlJPUjtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gaWYgTVA0IHNlZ21lbnQgYXBwZW5kaW5nIGluIHByb2dyZXNzIG5vdGhpbmcgdG8gZG9cbiAgICAgICAgICBlbHNlIGlmICgodGhpcy5zb3VyY2VCdWZmZXIuYXVkaW8gJiYgdGhpcy5zb3VyY2VCdWZmZXIuYXVkaW8udXBkYXRpbmcpIHx8XG4gICAgICAgICAgICAgKHRoaXMuc291cmNlQnVmZmVyLnZpZGVvICYmIHRoaXMuc291cmNlQnVmZmVyLnZpZGVvLnVwZGF0aW5nKSkge1xuICAgICAgICAgICAgLy9sb2dnZXIubG9nKCdzYiBhcHBlbmQgaW4gcHJvZ3Jlc3MnKTtcbiAgICAgICAgLy8gY2hlY2sgaWYgYW55IE1QNCBzZWdtZW50cyBsZWZ0IHRvIGFwcGVuZFxuICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5tcDRzZWdtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHZhciBzZWdtZW50ID0gdGhpcy5tcDRzZWdtZW50cy5zaGlmdCgpO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgLy9sb2dnZXIubG9nKGBhcHBlbmRpbmcgJHtzZWdtZW50LnR5cGV9IFNCLCBzaXplOiR7c2VnbWVudC5kYXRhLmxlbmd0aH0pO1xuICAgICAgICAgICAgICB0aGlzLnNvdXJjZUJ1ZmZlcltzZWdtZW50LnR5cGVdLmFwcGVuZEJ1ZmZlcihzZWdtZW50LmRhdGEpO1xuICAgICAgICAgICAgICB0aGlzLmFwcGVuZEVycm9yID0gMDtcbiAgICAgICAgICAgIH0gY2F0Y2goZXJyKSB7XG4gICAgICAgICAgICAgIC8vIGluIGNhc2UgYW55IGVycm9yIG9jY3VyZWQgd2hpbGUgYXBwZW5kaW5nLCBwdXQgYmFjayBzZWdtZW50IGluIG1wNHNlZ21lbnRzIHRhYmxlXG4gICAgICAgICAgICAgIGxvZ2dlci5lcnJvcihgZXJyb3Igd2hpbGUgdHJ5aW5nIHRvIGFwcGVuZCBidWZmZXI6JHtlcnIubWVzc2FnZX0sdHJ5IGFwcGVuZGluZyBsYXRlcmApO1xuICAgICAgICAgICAgICB0aGlzLm1wNHNlZ21lbnRzLnVuc2hpZnQoc2VnbWVudCk7XG4gICAgICAgICAgICAgICAgLy8ganVzdCBkaXNjYXJkIFF1b3RhRXhjZWVkZWRFcnJvciBmb3Igbm93LCBhbmQgd2FpdCBmb3IgdGhlIG5hdHVyYWwgYnJvd3NlciBidWZmZXIgZXZpY3Rpb25cbiAgICAgICAgICAgICAgLy9odHRwOi8vd3d3LnczLm9yZy9UUi9odG1sNS9pbmZyYXN0cnVjdHVyZS5odG1sI3F1b3RhZXhjZWVkZWRlcnJvclxuICAgICAgICAgICAgICBpZihlcnIuY29kZSAhPT0gMjIpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5hcHBlbmRFcnJvcikge1xuICAgICAgICAgICAgICAgICAgdGhpcy5hcHBlbmRFcnJvcisrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICB0aGlzLmFwcGVuZEVycm9yID0gMTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdmFyIGV2ZW50ID0ge3R5cGU6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5CVUZGRVJfQVBQRU5EX0VSUk9SLCBmcmFnOiB0aGlzLmZyYWdDdXJyZW50fTtcbiAgICAgICAgICAgICAgICAvKiB3aXRoIFVIRCBjb250ZW50LCB3ZSBjb3VsZCBnZXQgbG9vcCBvZiBxdW90YSBleGNlZWRlZCBlcnJvciB1bnRpbFxuICAgICAgICAgICAgICAgICAgYnJvd3NlciBpcyBhYmxlIHRvIGV2aWN0IHNvbWUgZGF0YSBmcm9tIHNvdXJjZWJ1ZmZlci4gcmV0cnlpbmcgaGVscCByZWNvdmVyaW5nIHRoaXNcbiAgICAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmFwcGVuZEVycm9yID4gdGhpcy5jb25maWcuYXBwZW5kRXJyb3JNYXhSZXRyeSkge1xuICAgICAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgZmFpbCAke3RoaXMuY29uZmlnLmFwcGVuZEVycm9yTWF4UmV0cnl9IHRpbWVzIHRvIGFwcGVuZCBzZWdtZW50IGluIHNvdXJjZUJ1ZmZlcmApO1xuICAgICAgICAgICAgICAgICAgZXZlbnQuZmF0YWwgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIGV2ZW50KTtcbiAgICAgICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5FUlJPUjtcbiAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgZXZlbnQuZmF0YWwgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCBldmVudCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuQVBQRU5ESU5HO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBzb3VyY2VCdWZmZXIgdW5kZWZpbmVkLCBzd2l0Y2ggYmFjayB0byBJRExFIHN0YXRlXG4gICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFN0YXRlLkJVRkZFUl9GTFVTSElORzpcbiAgICAgICAgLy8gbG9vcCB0aHJvdWdoIGFsbCBidWZmZXIgcmFuZ2VzIHRvIGZsdXNoXG4gICAgICAgIHdoaWxlKHRoaXMuZmx1c2hSYW5nZS5sZW5ndGgpIHtcbiAgICAgICAgICB2YXIgcmFuZ2UgPSB0aGlzLmZsdXNoUmFuZ2VbMF07XG4gICAgICAgICAgLy8gZmx1c2hCdWZmZXIgd2lsbCBhYm9ydCBhbnkgYnVmZmVyIGFwcGVuZCBpbiBwcm9ncmVzcyBhbmQgZmx1c2ggQXVkaW8vVmlkZW8gQnVmZmVyXG4gICAgICAgICAgaWYgKHRoaXMuZmx1c2hCdWZmZXIocmFuZ2Uuc3RhcnQsIHJhbmdlLmVuZCkpIHtcbiAgICAgICAgICAgIC8vIHJhbmdlIGZsdXNoZWQsIHJlbW92ZSBmcm9tIGZsdXNoIGFycmF5XG4gICAgICAgICAgICB0aGlzLmZsdXNoUmFuZ2Uuc2hpZnQoKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gZmx1c2ggaW4gcHJvZ3Jlc3MsIGNvbWUgYmFjayBsYXRlclxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLmZsdXNoUmFuZ2UubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgLy8gaGFuZGxlIGVuZCBvZiBpbW1lZGlhdGUgc3dpdGNoaW5nIGlmIG5lZWRlZFxuICAgICAgICAgIGlmICh0aGlzLmltbWVkaWF0ZVN3aXRjaCkge1xuICAgICAgICAgICAgdGhpcy5pbW1lZGlhdGVMZXZlbFN3aXRjaEVuZCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBtb3ZlIHRvIElETEUgb25jZSBmbHVzaCBjb21wbGV0ZS4gdGhpcyBzaG91bGQgdHJpZ2dlciBuZXcgZnJhZ21lbnQgbG9hZGluZ1xuICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgICAgICAgIC8vIHJlc2V0IHJlZmVyZW5jZSB0byBmcmFnXG4gICAgICAgICAgdGhpcy5mcmFnUHJldmlvdXMgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgICAvKiBpZiBub3QgZXZlcnl0aGluZyBmbHVzaGVkLCBzdGF5IGluIEJVRkZFUl9GTFVTSElORyBzdGF0ZS4gd2Ugd2lsbCBjb21lIGJhY2sgaGVyZVxuICAgICAgICAgICAgZWFjaCB0aW1lIHNvdXJjZUJ1ZmZlciB1cGRhdGVlbmQoKSBjYWxsYmFjayB3aWxsIGJlIHRyaWdnZXJlZFxuICAgICAgICAgICAgKi9cbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBicmVhaztcbiAgICB9XG4gICAgLy8gY2hlY2sgYnVmZmVyXG4gICAgdGhpcy5fY2hlY2tCdWZmZXIoKTtcbiAgICAvLyBjaGVjay91cGRhdGUgY3VycmVudCBmcmFnbWVudFxuICAgIHRoaXMuX2NoZWNrRnJhZ21lbnRDaGFuZ2VkKCk7XG4gIH1cblxuXG4gIGJ1ZmZlckluZm8ocG9zLG1heEhvbGVEdXJhdGlvbikge1xuICAgIHZhciBtZWRpYSA9IHRoaXMubWVkaWEsXG4gICAgICAgIHZidWZmZXJlZCA9IG1lZGlhLmJ1ZmZlcmVkLFxuICAgICAgICBidWZmZXJlZCA9IFtdLGk7XG4gICAgZm9yIChpID0gMDsgaSA8IHZidWZmZXJlZC5sZW5ndGg7IGkrKykge1xuICAgICAgYnVmZmVyZWQucHVzaCh7c3RhcnQ6IHZidWZmZXJlZC5zdGFydChpKSwgZW5kOiB2YnVmZmVyZWQuZW5kKGkpfSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmJ1ZmZlcmVkSW5mbyhidWZmZXJlZCxwb3MsbWF4SG9sZUR1cmF0aW9uKTtcbiAgfVxuXG4gIGJ1ZmZlcmVkSW5mbyhidWZmZXJlZCxwb3MsbWF4SG9sZUR1cmF0aW9uKSB7XG4gICAgdmFyIGJ1ZmZlcmVkMiA9IFtdLFxuICAgICAgICAvLyBidWZmZXJTdGFydCBhbmQgYnVmZmVyRW5kIGFyZSBidWZmZXIgYm91bmRhcmllcyBhcm91bmQgY3VycmVudCB2aWRlbyBwb3NpdGlvblxuICAgICAgICBidWZmZXJMZW4sYnVmZmVyU3RhcnQsIGJ1ZmZlckVuZCxidWZmZXJTdGFydE5leHQsaTtcbiAgICAvLyBzb3J0IG9uIGJ1ZmZlci5zdGFydC9zbWFsbGVyIGVuZCAoSUUgZG9lcyBub3QgYWx3YXlzIHJldHVybiBzb3J0ZWQgYnVmZmVyZWQgcmFuZ2UpXG4gICAgYnVmZmVyZWQuc29ydChmdW5jdGlvbiAoYSwgYikge1xuICAgICAgdmFyIGRpZmYgPSBhLnN0YXJ0IC0gYi5zdGFydDtcbiAgICAgIGlmIChkaWZmKSB7XG4gICAgICAgIHJldHVybiBkaWZmO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGIuZW5kIC0gYS5lbmQ7XG4gICAgICB9XG4gICAgfSk7XG4gICAgLy8gdGhlcmUgbWlnaHQgYmUgc29tZSBzbWFsbCBob2xlcyBiZXR3ZWVuIGJ1ZmZlciB0aW1lIHJhbmdlXG4gICAgLy8gY29uc2lkZXIgdGhhdCBob2xlcyBzbWFsbGVyIHRoYW4gbWF4SG9sZUR1cmF0aW9uIGFyZSBpcnJlbGV2YW50IGFuZCBidWlsZCBhbm90aGVyXG4gICAgLy8gYnVmZmVyIHRpbWUgcmFuZ2UgcmVwcmVzZW50YXRpb25zIHRoYXQgZGlzY2FyZHMgdGhvc2UgaG9sZXNcbiAgICBmb3IgKGkgPSAwOyBpIDwgYnVmZmVyZWQubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBidWYybGVuID0gYnVmZmVyZWQyLmxlbmd0aDtcbiAgICAgIGlmKGJ1ZjJsZW4pIHtcbiAgICAgICAgdmFyIGJ1ZjJlbmQgPSBidWZmZXJlZDJbYnVmMmxlbiAtIDFdLmVuZDtcbiAgICAgICAgLy8gaWYgc21hbGwgaG9sZSAodmFsdWUgYmV0d2VlbiAwIG9yIG1heEhvbGVEdXJhdGlvbiApIG9yIG92ZXJsYXBwaW5nIChuZWdhdGl2ZSlcbiAgICAgICAgaWYoKGJ1ZmZlcmVkW2ldLnN0YXJ0IC0gYnVmMmVuZCkgPCBtYXhIb2xlRHVyYXRpb24pIHtcbiAgICAgICAgICAvLyBtZXJnZSBvdmVybGFwcGluZyB0aW1lIHJhbmdlc1xuICAgICAgICAgIC8vIHVwZGF0ZSBsYXN0UmFuZ2UuZW5kIG9ubHkgaWYgc21hbGxlciB0aGFuIGl0ZW0uZW5kXG4gICAgICAgICAgLy8gZS5nLiAgWyAxLCAxNV0gd2l0aCAgWyAyLDhdID0+IFsgMSwxNV0gKG5vIG5lZWQgdG8gbW9kaWZ5IGxhc3RSYW5nZS5lbmQpXG4gICAgICAgICAgLy8gd2hlcmVhcyBbIDEsIDhdIHdpdGggIFsgMiwxNV0gPT4gWyAxLDE1XSAoIGxhc3RSYW5nZSBzaG91bGQgc3dpdGNoIGZyb20gWzEsOF0gdG8gWzEsMTVdKVxuICAgICAgICAgIGlmKGJ1ZmZlcmVkW2ldLmVuZCA+IGJ1ZjJlbmQpIHtcbiAgICAgICAgICAgIGJ1ZmZlcmVkMltidWYybGVuIC0gMV0uZW5kID0gYnVmZmVyZWRbaV0uZW5kO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBiaWcgaG9sZVxuICAgICAgICAgIGJ1ZmZlcmVkMi5wdXNoKGJ1ZmZlcmVkW2ldKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gZmlyc3QgdmFsdWVcbiAgICAgICAgYnVmZmVyZWQyLnB1c2goYnVmZmVyZWRbaV0pO1xuICAgICAgfVxuICAgIH1cbiAgICBmb3IgKGkgPSAwLCBidWZmZXJMZW4gPSAwLCBidWZmZXJTdGFydCA9IGJ1ZmZlckVuZCA9IHBvczsgaSA8IGJ1ZmZlcmVkMi5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHN0YXJ0ID0gIGJ1ZmZlcmVkMltpXS5zdGFydCxcbiAgICAgICAgICBlbmQgPSBidWZmZXJlZDJbaV0uZW5kO1xuICAgICAgLy9sb2dnZXIubG9nKCdidWYgc3RhcnQvZW5kOicgKyBidWZmZXJlZC5zdGFydChpKSArICcvJyArIGJ1ZmZlcmVkLmVuZChpKSk7XG4gICAgICBpZiAoKHBvcyArIG1heEhvbGVEdXJhdGlvbikgPj0gc3RhcnQgJiYgcG9zIDwgZW5kKSB7XG4gICAgICAgIC8vIHBsYXkgcG9zaXRpb24gaXMgaW5zaWRlIHRoaXMgYnVmZmVyIFRpbWVSYW5nZSwgcmV0cmlldmUgZW5kIG9mIGJ1ZmZlciBwb3NpdGlvbiBhbmQgYnVmZmVyIGxlbmd0aFxuICAgICAgICBidWZmZXJTdGFydCA9IHN0YXJ0O1xuICAgICAgICBidWZmZXJFbmQgPSBlbmQgKyBtYXhIb2xlRHVyYXRpb247XG4gICAgICAgIGJ1ZmZlckxlbiA9IGJ1ZmZlckVuZCAtIHBvcztcbiAgICAgIH0gZWxzZSBpZiAoKHBvcyArIG1heEhvbGVEdXJhdGlvbikgPCBzdGFydCkge1xuICAgICAgICBidWZmZXJTdGFydE5leHQgPSBzdGFydDtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7bGVuOiBidWZmZXJMZW4sIHN0YXJ0OiBidWZmZXJTdGFydCwgZW5kOiBidWZmZXJFbmQsIG5leHRTdGFydCA6IGJ1ZmZlclN0YXJ0TmV4dH07XG4gIH1cblxuICBnZXRCdWZmZXJSYW5nZShwb3NpdGlvbikge1xuICAgIHZhciBpLCByYW5nZTtcbiAgICBmb3IgKGkgPSB0aGlzLmJ1ZmZlclJhbmdlLmxlbmd0aCAtIDE7IGkgPj0wOyBpLS0pIHtcbiAgICAgIHJhbmdlID0gdGhpcy5idWZmZXJSYW5nZVtpXTtcbiAgICAgIGlmIChwb3NpdGlvbiA+PSByYW5nZS5zdGFydCAmJiBwb3NpdGlvbiA8PSByYW5nZS5lbmQpIHtcbiAgICAgICAgcmV0dXJuIHJhbmdlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGdldCBjdXJyZW50TGV2ZWwoKSB7XG4gICAgaWYgKHRoaXMubWVkaWEpIHtcbiAgICAgIHZhciByYW5nZSA9IHRoaXMuZ2V0QnVmZmVyUmFuZ2UodGhpcy5tZWRpYS5jdXJyZW50VGltZSk7XG4gICAgICBpZiAocmFuZ2UpIHtcbiAgICAgICAgcmV0dXJuIHJhbmdlLmZyYWcubGV2ZWw7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiAtMTtcbiAgfVxuXG4gIGdldCBuZXh0QnVmZmVyUmFuZ2UoKSB7XG4gICAgaWYgKHRoaXMubWVkaWEpIHtcbiAgICAgIC8vIGZpcnN0IGdldCBlbmQgcmFuZ2Ugb2YgY3VycmVudCBmcmFnbWVudFxuICAgICAgcmV0dXJuIHRoaXMuZm9sbG93aW5nQnVmZmVyUmFuZ2UodGhpcy5nZXRCdWZmZXJSYW5nZSh0aGlzLm1lZGlhLmN1cnJlbnRUaW1lKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGZvbGxvd2luZ0J1ZmZlclJhbmdlKHJhbmdlKSB7XG4gICAgaWYgKHJhbmdlKSB7XG4gICAgICAvLyB0cnkgdG8gZ2V0IHJhbmdlIG9mIG5leHQgZnJhZ21lbnQgKDUwMG1zIGFmdGVyIHRoaXMgcmFuZ2UpXG4gICAgICByZXR1cm4gdGhpcy5nZXRCdWZmZXJSYW5nZShyYW5nZS5lbmQgKyAwLjUpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGdldCBuZXh0TGV2ZWwoKSB7XG4gICAgdmFyIHJhbmdlID0gdGhpcy5uZXh0QnVmZmVyUmFuZ2U7XG4gICAgaWYgKHJhbmdlKSB7XG4gICAgICByZXR1cm4gcmFuZ2UuZnJhZy5sZXZlbDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIC0xO1xuICAgIH1cbiAgfVxuXG4gIGlzQnVmZmVyZWQocG9zaXRpb24pIHtcbiAgICB2YXIgdiA9IHRoaXMubWVkaWEsIGJ1ZmZlcmVkID0gdi5idWZmZXJlZDtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGJ1ZmZlcmVkLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAocG9zaXRpb24gPj0gYnVmZmVyZWQuc3RhcnQoaSkgJiYgcG9zaXRpb24gPD0gYnVmZmVyZWQuZW5kKGkpKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBfY2hlY2tGcmFnbWVudENoYW5nZWQoKSB7XG4gICAgdmFyIHJhbmdlQ3VycmVudCwgY3VycmVudFRpbWUsIHZpZGVvID0gdGhpcy5tZWRpYTtcbiAgICBpZiAodmlkZW8gJiYgdmlkZW8uc2Vla2luZyA9PT0gZmFsc2UpIHtcbiAgICAgIGN1cnJlbnRUaW1lID0gdmlkZW8uY3VycmVudFRpbWU7XG4gICAgICAvKiBpZiB2aWRlbyBlbGVtZW50IGlzIGluIHNlZWtlZCBzdGF0ZSwgY3VycmVudFRpbWUgY2FuIG9ubHkgaW5jcmVhc2UuXG4gICAgICAgIChhc3N1bWluZyB0aGF0IHBsYXliYWNrIHJhdGUgaXMgcG9zaXRpdmUgLi4uKVxuICAgICAgICBBcyBzb21ldGltZXMgY3VycmVudFRpbWUganVtcHMgYmFjayB0byB6ZXJvIGFmdGVyIGFcbiAgICAgICAgbWVkaWEgZGVjb2RlIGVycm9yLCBjaGVjayB0aGlzLCB0byBhdm9pZCBzZWVraW5nIGJhY2sgdG9cbiAgICAgICAgd3JvbmcgcG9zaXRpb24gYWZ0ZXIgYSBtZWRpYSBkZWNvZGUgZXJyb3JcbiAgICAgICovXG4gICAgICBpZihjdXJyZW50VGltZSA+IHZpZGVvLnBsYXliYWNrUmF0ZSp0aGlzLmxhc3RDdXJyZW50VGltZSkge1xuICAgICAgICB0aGlzLmxhc3RDdXJyZW50VGltZSA9IGN1cnJlbnRUaW1lO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMuaXNCdWZmZXJlZChjdXJyZW50VGltZSkpIHtcbiAgICAgICAgcmFuZ2VDdXJyZW50ID0gdGhpcy5nZXRCdWZmZXJSYW5nZShjdXJyZW50VGltZSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuaXNCdWZmZXJlZChjdXJyZW50VGltZSArIDAuMSkpIHtcbiAgICAgICAgLyogZW5zdXJlIHRoYXQgRlJBR19DSEFOR0VEIGV2ZW50IGlzIHRyaWdnZXJlZCBhdCBzdGFydHVwLFxuICAgICAgICAgIHdoZW4gZmlyc3QgdmlkZW8gZnJhbWUgaXMgZGlzcGxheWVkIGFuZCBwbGF5YmFjayBpcyBwYXVzZWQuXG4gICAgICAgICAgYWRkIGEgdG9sZXJhbmNlIG9mIDEwMG1zLCBpbiBjYXNlIGN1cnJlbnQgcG9zaXRpb24gaXMgbm90IGJ1ZmZlcmVkLFxuICAgICAgICAgIGNoZWNrIGlmIGN1cnJlbnQgcG9zKzEwMG1zIGlzIGJ1ZmZlcmVkIGFuZCB1c2UgdGhhdCBidWZmZXIgcmFuZ2VcbiAgICAgICAgICBmb3IgRlJBR19DSEFOR0VEIGV2ZW50IHJlcG9ydGluZyAqL1xuICAgICAgICByYW5nZUN1cnJlbnQgPSB0aGlzLmdldEJ1ZmZlclJhbmdlKGN1cnJlbnRUaW1lICsgMC4xKTtcbiAgICAgIH1cbiAgICAgIGlmIChyYW5nZUN1cnJlbnQpIHtcbiAgICAgICAgdmFyIGZyYWdQbGF5aW5nID0gcmFuZ2VDdXJyZW50LmZyYWc7XG4gICAgICAgIGlmIChmcmFnUGxheWluZyAhPT0gdGhpcy5mcmFnUGxheWluZykge1xuICAgICAgICAgIHRoaXMuZnJhZ1BsYXlpbmcgPSBmcmFnUGxheWluZztcbiAgICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkZSQUdfQ0hBTkdFRCwge2ZyYWc6IGZyYWdQbGF5aW5nfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKlxuICAgIGFib3J0IGFueSBidWZmZXIgYXBwZW5kIGluIHByb2dyZXNzLCBhbmQgZmx1c2ggYWxsIGJ1ZmZlcmVkIGRhdGFcbiAgICByZXR1cm4gdHJ1ZSBvbmNlIGV2ZXJ5dGhpbmcgaGFzIGJlZW4gZmx1c2hlZC5cbiAgICBzb3VyY2VCdWZmZXIuYWJvcnQoKSBhbmQgc291cmNlQnVmZmVyLnJlbW92ZSgpIGFyZSBhc3luY2hyb25vdXMgb3BlcmF0aW9uc1xuICAgIHRoZSBpZGVhIGlzIHRvIGNhbGwgdGhpcyBmdW5jdGlvbiBmcm9tIHRpY2soKSB0aW1lciBhbmQgY2FsbCBpdCBhZ2FpbiB1bnRpbCBhbGwgcmVzb3VyY2VzIGhhdmUgYmVlbiBjbGVhbmVkXG4gICAgdGhlIHRpbWVyIGlzIHJlYXJtZWQgdXBvbiBzb3VyY2VCdWZmZXIgdXBkYXRlZW5kKCkgZXZlbnQsIHNvIHRoaXMgc2hvdWxkIGJlIG9wdGltYWxcbiAgKi9cbiAgZmx1c2hCdWZmZXIoc3RhcnRPZmZzZXQsIGVuZE9mZnNldCkge1xuICAgIHZhciBzYiwgaSwgYnVmU3RhcnQsIGJ1ZkVuZCwgZmx1c2hTdGFydCwgZmx1c2hFbmQ7XG4gICAgLy9sb2dnZXIubG9nKCdmbHVzaEJ1ZmZlcixwb3Mvc3RhcnQvZW5kOiAnICsgdGhpcy5tZWRpYS5jdXJyZW50VGltZSArICcvJyArIHN0YXJ0T2Zmc2V0ICsgJy8nICsgZW5kT2Zmc2V0KTtcbiAgICAvLyBzYWZlZ3VhcmQgdG8gYXZvaWQgaW5maW5pdGUgbG9vcGluZ1xuICAgIGlmICh0aGlzLmZsdXNoQnVmZmVyQ291bnRlcisrIDwgKDIgKiB0aGlzLmJ1ZmZlclJhbmdlLmxlbmd0aCkgJiYgdGhpcy5zb3VyY2VCdWZmZXIpIHtcbiAgICAgIGZvciAodmFyIHR5cGUgaW4gdGhpcy5zb3VyY2VCdWZmZXIpIHtcbiAgICAgICAgc2IgPSB0aGlzLnNvdXJjZUJ1ZmZlclt0eXBlXTtcbiAgICAgICAgaWYgKCFzYi51cGRhdGluZykge1xuICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBzYi5idWZmZXJlZC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYnVmU3RhcnQgPSBzYi5idWZmZXJlZC5zdGFydChpKTtcbiAgICAgICAgICAgIGJ1ZkVuZCA9IHNiLmJ1ZmZlcmVkLmVuZChpKTtcbiAgICAgICAgICAgIC8vIHdvcmthcm91bmQgZmlyZWZveCBub3QgYWJsZSB0byBwcm9wZXJseSBmbHVzaCBtdWx0aXBsZSBidWZmZXJlZCByYW5nZS5cbiAgICAgICAgICAgIGlmIChuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkuaW5kZXhPZignZmlyZWZveCcpICE9PSAtMSAmJiBlbmRPZmZzZXQgPT09IE51bWJlci5QT1NJVElWRV9JTkZJTklUWSkge1xuICAgICAgICAgICAgICBmbHVzaFN0YXJ0ID0gc3RhcnRPZmZzZXQ7XG4gICAgICAgICAgICAgIGZsdXNoRW5kID0gZW5kT2Zmc2V0O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgZmx1c2hTdGFydCA9IE1hdGgubWF4KGJ1ZlN0YXJ0LCBzdGFydE9mZnNldCk7XG4gICAgICAgICAgICAgIGZsdXNoRW5kID0gTWF0aC5taW4oYnVmRW5kLCBlbmRPZmZzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLyogc29tZXRpbWVzIHNvdXJjZWJ1ZmZlci5yZW1vdmUoKSBkb2VzIG5vdCBmbHVzaFxuICAgICAgICAgICAgICAgdGhlIGV4YWN0IGV4cGVjdGVkIHRpbWUgcmFuZ2UuXG4gICAgICAgICAgICAgICB0byBhdm9pZCByb3VuZGluZyBpc3N1ZXMvaW5maW5pdGUgbG9vcCxcbiAgICAgICAgICAgICAgIG9ubHkgZmx1c2ggYnVmZmVyIHJhbmdlIG9mIGxlbmd0aCBncmVhdGVyIHRoYW4gNTAwbXMuXG4gICAgICAgICAgICAqL1xuICAgICAgICAgICAgaWYgKGZsdXNoRW5kIC0gZmx1c2hTdGFydCA+IDAuNSkge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBmbHVzaCAke3R5cGV9IFske2ZsdXNoU3RhcnR9LCR7Zmx1c2hFbmR9XSwgb2YgWyR7YnVmU3RhcnR9LCR7YnVmRW5kfV0sIHBvczoke3RoaXMubWVkaWEuY3VycmVudFRpbWV9YCk7XG4gICAgICAgICAgICAgIHNiLnJlbW92ZShmbHVzaFN0YXJ0LCBmbHVzaEVuZCk7XG4gICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy9sb2dnZXIubG9nKCdhYm9ydCAnICsgdHlwZSArICcgYXBwZW5kIGluIHByb2dyZXNzJyk7XG4gICAgICAgICAgLy8gdGhpcyB3aWxsIGFib3J0IGFueSBhcHBlbmRpbmcgaW4gcHJvZ3Jlc3NcbiAgICAgICAgICAvL3NiLmFib3J0KCk7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLyogYWZ0ZXIgc3VjY2Vzc2Z1bCBidWZmZXIgZmx1c2hpbmcsIHJlYnVpbGQgYnVmZmVyIFJhbmdlIGFycmF5XG4gICAgICBsb29wIHRocm91Z2ggZXhpc3RpbmcgYnVmZmVyIHJhbmdlIGFuZCBjaGVjayBpZlxuICAgICAgY29ycmVzcG9uZGluZyByYW5nZSBpcyBzdGlsbCBidWZmZXJlZC4gb25seSBwdXNoIHRvIG5ldyBhcnJheSBhbHJlYWR5IGJ1ZmZlcmVkIHJhbmdlXG4gICAgKi9cbiAgICB2YXIgbmV3UmFuZ2UgPSBbXSxyYW5nZTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5idWZmZXJSYW5nZS5sZW5ndGg7IGkrKykge1xuICAgICAgcmFuZ2UgPSB0aGlzLmJ1ZmZlclJhbmdlW2ldO1xuICAgICAgaWYgKHRoaXMuaXNCdWZmZXJlZCgocmFuZ2Uuc3RhcnQgKyByYW5nZS5lbmQpIC8gMikpIHtcbiAgICAgICAgbmV3UmFuZ2UucHVzaChyYW5nZSk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuYnVmZmVyUmFuZ2UgPSBuZXdSYW5nZTtcbiAgICBsb2dnZXIubG9nKCdidWZmZXIgZmx1c2hlZCcpO1xuICAgIC8vIGV2ZXJ5dGhpbmcgZmx1c2hlZCAhXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvKlxuICAgIG9uIGltbWVkaWF0ZSBsZXZlbCBzd2l0Y2ggOlxuICAgICAtIHBhdXNlIHBsYXliYWNrIGlmIHBsYXlpbmdcbiAgICAgLSBjYW5jZWwgYW55IHBlbmRpbmcgbG9hZCByZXF1ZXN0XG4gICAgIC0gYW5kIHRyaWdnZXIgYSBidWZmZXIgZmx1c2hcbiAgKi9cbiAgaW1tZWRpYXRlTGV2ZWxTd2l0Y2goKSB7XG4gICAgbG9nZ2VyLmxvZygnaW1tZWRpYXRlTGV2ZWxTd2l0Y2gnKTtcbiAgICBpZiAoIXRoaXMuaW1tZWRpYXRlU3dpdGNoKSB7XG4gICAgICB0aGlzLmltbWVkaWF0ZVN3aXRjaCA9IHRydWU7XG4gICAgICB0aGlzLnByZXZpb3VzbHlQYXVzZWQgPSB0aGlzLm1lZGlhLnBhdXNlZDtcbiAgICAgIHRoaXMubWVkaWEucGF1c2UoKTtcbiAgICB9XG4gICAgdmFyIGZyYWdDdXJyZW50ID0gdGhpcy5mcmFnQ3VycmVudDtcbiAgICBpZiAoZnJhZ0N1cnJlbnQgJiYgZnJhZ0N1cnJlbnQubG9hZGVyKSB7XG4gICAgICBmcmFnQ3VycmVudC5sb2FkZXIuYWJvcnQoKTtcbiAgICB9XG4gICAgdGhpcy5mcmFnQ3VycmVudCA9IG51bGw7XG4gICAgLy8gZmx1c2ggZXZlcnl0aGluZ1xuICAgIHRoaXMuZmx1c2hCdWZmZXJDb3VudGVyID0gMDtcbiAgICB0aGlzLmZsdXNoUmFuZ2UucHVzaCh7c3RhcnQ6IDAsIGVuZDogTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZfSk7XG4gICAgLy8gdHJpZ2dlciBhIHNvdXJjZUJ1ZmZlciBmbHVzaFxuICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5CVUZGRVJfRkxVU0hJTkc7XG4gICAgLy8gaW5jcmVhc2UgZnJhZ21lbnQgbG9hZCBJbmRleCB0byBhdm9pZCBmcmFnIGxvb3AgbG9hZGluZyBlcnJvciBhZnRlciBidWZmZXIgZmx1c2hcbiAgICB0aGlzLmZyYWdMb2FkSWR4ICs9IDIgKiB0aGlzLmNvbmZpZy5mcmFnTG9hZGluZ0xvb3BUaHJlc2hvbGQ7XG4gICAgLy8gc3BlZWQgdXAgc3dpdGNoaW5nLCB0cmlnZ2VyIHRpbWVyIGZ1bmN0aW9uXG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICAvKlxuICAgICBvbiBpbW1lZGlhdGUgbGV2ZWwgc3dpdGNoIGVuZCwgYWZ0ZXIgbmV3IGZyYWdtZW50IGhhcyBiZWVuIGJ1ZmZlcmVkIDpcbiAgICAgIC0gbnVkZ2UgdmlkZW8gZGVjb2RlciBieSBzbGlnaHRseSBhZGp1c3RpbmcgdmlkZW8gY3VycmVudFRpbWVcbiAgICAgIC0gcmVzdW1lIHRoZSBwbGF5YmFjayBpZiBuZWVkZWRcbiAgKi9cbiAgaW1tZWRpYXRlTGV2ZWxTd2l0Y2hFbmQoKSB7XG4gICAgdGhpcy5pbW1lZGlhdGVTd2l0Y2ggPSBmYWxzZTtcbiAgICB0aGlzLm1lZGlhLmN1cnJlbnRUaW1lIC09IDAuMDAwMTtcbiAgICBpZiAoIXRoaXMucHJldmlvdXNseVBhdXNlZCkge1xuICAgICAgdGhpcy5tZWRpYS5wbGF5KCk7XG4gICAgfVxuICB9XG5cbiAgbmV4dExldmVsU3dpdGNoKCkge1xuICAgIC8qIHRyeSB0byBzd2l0Y2ggQVNBUCB3aXRob3V0IGJyZWFraW5nIHZpZGVvIHBsYXliYWNrIDpcbiAgICAgICBpbiBvcmRlciB0byBlbnN1cmUgc21vb3RoIGJ1dCBxdWljayBsZXZlbCBzd2l0Y2hpbmcsXG4gICAgICB3ZSBuZWVkIHRvIGZpbmQgdGhlIG5leHQgZmx1c2hhYmxlIGJ1ZmZlciByYW5nZVxuICAgICAgd2Ugc2hvdWxkIHRha2UgaW50byBhY2NvdW50IG5ldyBzZWdtZW50IGZldGNoIHRpbWVcbiAgICAqL1xuICAgIHZhciBmZXRjaGRlbGF5LCBjdXJyZW50UmFuZ2UsIG5leHRSYW5nZTtcbiAgICBjdXJyZW50UmFuZ2UgPSB0aGlzLmdldEJ1ZmZlclJhbmdlKHRoaXMubWVkaWEuY3VycmVudFRpbWUpO1xuICAgIGlmIChjdXJyZW50UmFuZ2UpIHtcbiAgICAvLyBmbHVzaCBidWZmZXIgcHJlY2VkaW5nIGN1cnJlbnQgZnJhZ21lbnQgKGZsdXNoIHVudGlsIGN1cnJlbnQgZnJhZ21lbnQgc3RhcnQgb2Zmc2V0KVxuICAgIC8vIG1pbnVzIDFzIHRvIGF2b2lkIHZpZGVvIGZyZWV6aW5nLCB0aGF0IGNvdWxkIGhhcHBlbiBpZiB3ZSBmbHVzaCBrZXlmcmFtZSBvZiBjdXJyZW50IHZpZGVvIC4uLlxuICAgICAgdGhpcy5mbHVzaFJhbmdlLnB1c2goe3N0YXJ0OiAwLCBlbmQ6IGN1cnJlbnRSYW5nZS5zdGFydCAtIDF9KTtcbiAgICB9XG4gICAgaWYgKCF0aGlzLm1lZGlhLnBhdXNlZCkge1xuICAgICAgLy8gYWRkIGEgc2FmZXR5IGRlbGF5IG9mIDFzXG4gICAgICB2YXIgbmV4dExldmVsSWQgPSB0aGlzLmhscy5uZXh0TG9hZExldmVsLG5leHRMZXZlbCA9IHRoaXMubGV2ZWxzW25leHRMZXZlbElkXSwgZnJhZ0xhc3RLYnBzID0gdGhpcy5mcmFnTGFzdEticHM7XG4gICAgICBpZiAoZnJhZ0xhc3RLYnBzICYmIHRoaXMuZnJhZ0N1cnJlbnQpIHtcbiAgICAgICAgZmV0Y2hkZWxheSA9IHRoaXMuZnJhZ0N1cnJlbnQuZHVyYXRpb24gKiBuZXh0TGV2ZWwuYml0cmF0ZSAvICgxMDAwICogZnJhZ0xhc3RLYnBzKSArIDE7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmZXRjaGRlbGF5ID0gMDtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgZmV0Y2hkZWxheSA9IDA7XG4gICAgfVxuICAgIC8vbG9nZ2VyLmxvZygnZmV0Y2hkZWxheTonK2ZldGNoZGVsYXkpO1xuICAgIC8vIGZpbmQgYnVmZmVyIHJhbmdlIHRoYXQgd2lsbCBiZSByZWFjaGVkIG9uY2UgbmV3IGZyYWdtZW50IHdpbGwgYmUgZmV0Y2hlZFxuICAgIG5leHRSYW5nZSA9IHRoaXMuZ2V0QnVmZmVyUmFuZ2UodGhpcy5tZWRpYS5jdXJyZW50VGltZSArIGZldGNoZGVsYXkpO1xuICAgIGlmIChuZXh0UmFuZ2UpIHtcbiAgICAgIC8vIHdlIGNhbiBmbHVzaCBidWZmZXIgcmFuZ2UgZm9sbG93aW5nIHRoaXMgb25lIHdpdGhvdXQgc3RhbGxpbmcgcGxheWJhY2tcbiAgICAgIG5leHRSYW5nZSA9IHRoaXMuZm9sbG93aW5nQnVmZmVyUmFuZ2UobmV4dFJhbmdlKTtcbiAgICAgIGlmIChuZXh0UmFuZ2UpIHtcbiAgICAgICAgLy8gZmx1c2ggcG9zaXRpb24gaXMgdGhlIHN0YXJ0IHBvc2l0aW9uIG9mIHRoaXMgbmV3IGJ1ZmZlclxuICAgICAgICB0aGlzLmZsdXNoUmFuZ2UucHVzaCh7c3RhcnQ6IG5leHRSYW5nZS5zdGFydCwgZW5kOiBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFl9KTtcbiAgICAgICAgLy8gaWYgd2UgYXJlIGhlcmUsIHdlIGNhbiBhbHNvIGNhbmNlbCBhbnkgbG9hZGluZy9kZW11eGluZyBpbiBwcm9ncmVzcywgYXMgdGhleSBhcmUgdXNlbGVzc1xuICAgICAgICB2YXIgZnJhZ0N1cnJlbnQgPSB0aGlzLmZyYWdDdXJyZW50O1xuICAgICAgICBpZiAoZnJhZ0N1cnJlbnQgJiYgZnJhZ0N1cnJlbnQubG9hZGVyKSB7XG4gICAgICAgICAgZnJhZ0N1cnJlbnQubG9hZGVyLmFib3J0KCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5mcmFnQ3VycmVudCA9IG51bGw7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0aGlzLmZsdXNoUmFuZ2UubGVuZ3RoKSB7XG4gICAgICB0aGlzLmZsdXNoQnVmZmVyQ291bnRlciA9IDA7XG4gICAgICAvLyB0cmlnZ2VyIGEgc291cmNlQnVmZmVyIGZsdXNoXG4gICAgICB0aGlzLnN0YXRlID0gU3RhdGUuQlVGRkVSX0ZMVVNISU5HO1xuICAgICAgLy8gaW5jcmVhc2UgZnJhZ21lbnQgbG9hZCBJbmRleCB0byBhdm9pZCBmcmFnIGxvb3AgbG9hZGluZyBlcnJvciBhZnRlciBidWZmZXIgZmx1c2hcbiAgICAgIHRoaXMuZnJhZ0xvYWRJZHggKz0gMiAqIHRoaXMuY29uZmlnLmZyYWdMb2FkaW5nTG9vcFRocmVzaG9sZDtcbiAgICAgIC8vIHNwZWVkIHVwIHN3aXRjaGluZywgdHJpZ2dlciB0aW1lciBmdW5jdGlvblxuICAgICAgdGhpcy50aWNrKCk7XG4gICAgfVxuICB9XG5cbiAgb25NZWRpYUF0dGFjaGluZyhkYXRhKSB7XG4gICAgdmFyIG1lZGlhID0gdGhpcy5tZWRpYSA9IGRhdGEubWVkaWE7XG4gICAgLy8gc2V0dXAgdGhlIG1lZGlhIHNvdXJjZVxuICAgIHZhciBtcyA9IHRoaXMubWVkaWFTb3VyY2UgPSBuZXcgTWVkaWFTb3VyY2UoKTtcbiAgICAvL01lZGlhIFNvdXJjZSBsaXN0ZW5lcnNcbiAgICB0aGlzLm9ubXNvID0gdGhpcy5vbk1lZGlhU291cmNlT3Blbi5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25tc2UgPSB0aGlzLm9uTWVkaWFTb3VyY2VFbmRlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25tc2MgPSB0aGlzLm9uTWVkaWFTb3VyY2VDbG9zZS5iaW5kKHRoaXMpO1xuICAgIG1zLmFkZEV2ZW50TGlzdGVuZXIoJ3NvdXJjZW9wZW4nLCB0aGlzLm9ubXNvKTtcbiAgICBtcy5hZGRFdmVudExpc3RlbmVyKCdzb3VyY2VlbmRlZCcsIHRoaXMub25tc2UpO1xuICAgIG1zLmFkZEV2ZW50TGlzdGVuZXIoJ3NvdXJjZWNsb3NlJywgdGhpcy5vbm1zYyk7XG4gICAgLy8gbGluayB2aWRlbyBhbmQgbWVkaWEgU291cmNlXG4gICAgbWVkaWEuc3JjID0gVVJMLmNyZWF0ZU9iamVjdFVSTChtcyk7XG4gIH1cblxuICBvbk1lZGlhRGV0YWNoaW5nKCkge1xuICAgIHZhciBtZWRpYSA9IHRoaXMubWVkaWE7XG4gICAgaWYgKG1lZGlhICYmIG1lZGlhLmVuZGVkKSB7XG4gICAgICBsb2dnZXIubG9nKCdNU0UgZGV0YWNoaW5nIGFuZCB2aWRlbyBlbmRlZCwgcmVzZXQgc3RhcnRQb3NpdGlvbicpO1xuICAgICAgdGhpcy5zdGFydFBvc2l0aW9uID0gdGhpcy5sYXN0Q3VycmVudFRpbWUgPSAwO1xuICAgIH1cblxuICAgIC8vIHJlc2V0IGZyYWdtZW50IGxvYWRpbmcgY291bnRlciBvbiBNU0UgZGV0YWNoaW5nIHRvIGF2b2lkIHJlcG9ydGluZyBGUkFHX0xPT1BfTE9BRElOR19FUlJPUiBhZnRlciBlcnJvciByZWNvdmVyeVxuICAgIHZhciBsZXZlbHMgPSB0aGlzLmxldmVscztcbiAgICBpZiAobGV2ZWxzKSB7XG4gICAgICAvLyByZXNldCBmcmFnbWVudCBsb2FkIGNvdW50ZXJcbiAgICAgICAgbGV2ZWxzLmZvckVhY2gobGV2ZWwgPT4ge1xuICAgICAgICAgIGlmKGxldmVsLmRldGFpbHMpIHtcbiAgICAgICAgICAgIGxldmVsLmRldGFpbHMuZnJhZ21lbnRzLmZvckVhY2goZnJhZ21lbnQgPT4ge1xuICAgICAgICAgICAgICBmcmFnbWVudC5sb2FkQ291bnRlciA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgICB2YXIgbXMgPSB0aGlzLm1lZGlhU291cmNlO1xuICAgIGlmIChtcykge1xuICAgICAgaWYgKG1zLnJlYWR5U3RhdGUgPT09ICdvcGVuJykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIC8vIGVuZE9mU3RyZWFtIGNvdWxkIHRyaWdnZXIgZXhjZXB0aW9uIGlmIGFueSBzb3VyY2VidWZmZXIgaXMgaW4gdXBkYXRpbmcgc3RhdGVcbiAgICAgICAgICAvLyB3ZSBkb24ndCByZWFsbHkgY2FyZSBhYm91dCBjaGVja2luZyBzb3VyY2VidWZmZXIgc3RhdGUgaGVyZSxcbiAgICAgICAgICAvLyBhcyB3ZSBhcmUgYW55d2F5IGRldGFjaGluZyB0aGUgTWVkaWFTb3VyY2VcbiAgICAgICAgICAvLyBsZXQncyBqdXN0IGF2b2lkIHRoaXMgZXhjZXB0aW9uIHRvIHByb3BhZ2F0ZVxuICAgICAgICAgIG1zLmVuZE9mU3RyZWFtKCk7XG4gICAgICAgIH0gY2F0Y2goZXJyKSB7XG4gICAgICAgICAgbG9nZ2VyLndhcm4oYG9uTWVkaWFEZXRhY2hpbmc6JHtlcnIubWVzc2FnZX0gd2hpbGUgY2FsbGluZyBlbmRPZlN0cmVhbWApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBtcy5yZW1vdmVFdmVudExpc3RlbmVyKCdzb3VyY2VvcGVuJywgdGhpcy5vbm1zbyk7XG4gICAgICBtcy5yZW1vdmVFdmVudExpc3RlbmVyKCdzb3VyY2VlbmRlZCcsIHRoaXMub25tc2UpO1xuICAgICAgbXMucmVtb3ZlRXZlbnRMaXN0ZW5lcignc291cmNlY2xvc2UnLCB0aGlzLm9ubXNjKTtcbiAgICAgIC8vIHVubGluayBNZWRpYVNvdXJjZSBmcm9tIHZpZGVvIHRhZ1xuICAgICAgdGhpcy5tZWRpYS5zcmMgPSAnJztcbiAgICAgIHRoaXMubWVkaWFTb3VyY2UgPSBudWxsO1xuICAgICAgLy8gcmVtb3ZlIHZpZGVvIGxpc3RlbmVyc1xuICAgICAgaWYgKG1lZGlhKSB7XG4gICAgICAgIG1lZGlhLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NlZWtpbmcnLCB0aGlzLm9udnNlZWtpbmcpO1xuICAgICAgICBtZWRpYS5yZW1vdmVFdmVudExpc3RlbmVyKCdzZWVrZWQnLCB0aGlzLm9udnNlZWtlZCk7XG4gICAgICAgIG1lZGlhLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2xvYWRlZG1ldGFkYXRhJywgdGhpcy5vbnZtZXRhZGF0YSk7XG4gICAgICAgIG1lZGlhLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2VuZGVkJywgdGhpcy5vbnZlbmRlZCk7XG4gICAgICAgIHRoaXMub252c2Vla2luZyA9IHRoaXMub252c2Vla2VkID0gdGhpcy5vbnZtZXRhZGF0YSA9IG51bGw7XG4gICAgICB9XG4gICAgICB0aGlzLm1lZGlhID0gbnVsbDtcbiAgICAgIHRoaXMubG9hZGVkbWV0YWRhdGEgPSBmYWxzZTtcbiAgICAgIHRoaXMuc3RvcCgpO1xuICAgIH1cbiAgICB0aGlzLm9ubXNvID0gdGhpcy5vbm1zZSA9IHRoaXMub25tc2MgPSBudWxsO1xuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuTUVESUFfREVUQUNIRUQpO1xuICB9XG5cbiAgb25NZWRpYVNlZWtpbmcoKSB7XG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IFN0YXRlLkZSQUdfTE9BRElORykge1xuICAgICAgLy8gY2hlY2sgaWYgY3VycmVudGx5IGxvYWRlZCBmcmFnbWVudCBpcyBpbnNpZGUgYnVmZmVyLlxuICAgICAgLy9pZiBvdXRzaWRlLCBjYW5jZWwgZnJhZ21lbnQgbG9hZGluZywgb3RoZXJ3aXNlIGRvIG5vdGhpbmdcbiAgICAgIGlmICh0aGlzLmJ1ZmZlckluZm8odGhpcy5tZWRpYS5jdXJyZW50VGltZSx0aGlzLmNvbmZpZy5tYXhCdWZmZXJIb2xlKS5sZW4gPT09IDApIHtcbiAgICAgICAgbG9nZ2VyLmxvZygnc2Vla2luZyBvdXRzaWRlIG9mIGJ1ZmZlciB3aGlsZSBmcmFnbWVudCBsb2FkIGluIHByb2dyZXNzLCBjYW5jZWwgZnJhZ21lbnQgbG9hZCcpO1xuICAgICAgICB2YXIgZnJhZ0N1cnJlbnQgPSB0aGlzLmZyYWdDdXJyZW50O1xuICAgICAgICBpZiAoZnJhZ0N1cnJlbnQpIHtcbiAgICAgICAgICBpZiAoZnJhZ0N1cnJlbnQubG9hZGVyKSB7XG4gICAgICAgICAgICBmcmFnQ3VycmVudC5sb2FkZXIuYWJvcnQoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5mcmFnQ3VycmVudCA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5mcmFnUHJldmlvdXMgPSBudWxsO1xuICAgICAgICAvLyBzd2l0Y2ggdG8gSURMRSBzdGF0ZSB0byBsb2FkIG5ldyBmcmFnbWVudFxuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHRoaXMubWVkaWEpIHtcbiAgICAgIHRoaXMubGFzdEN1cnJlbnRUaW1lID0gdGhpcy5tZWRpYS5jdXJyZW50VGltZTtcbiAgICB9XG4gICAgLy8gYXZvaWQgcmVwb3J0aW5nIGZyYWdtZW50IGxvb3AgbG9hZGluZyBlcnJvciBpbiBjYXNlIHVzZXIgaXMgc2Vla2luZyBzZXZlcmFsIHRpbWVzIG9uIHNhbWUgcG9zaXRpb25cbiAgICBpZiAodGhpcy5mcmFnTG9hZElkeCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLmZyYWdMb2FkSWR4ICs9IDIgKiB0aGlzLmNvbmZpZy5mcmFnTG9hZGluZ0xvb3BUaHJlc2hvbGQ7XG4gICAgfVxuICAgIC8vIHRpY2sgdG8gc3BlZWQgdXAgcHJvY2Vzc2luZ1xuICAgIHRoaXMudGljaygpO1xuICB9XG5cbiAgb25NZWRpYVNlZWtlZCgpIHtcbiAgICAvLyB0aWNrIHRvIHNwZWVkIHVwIEZSQUdNRU5UX1BMQVlJTkcgdHJpZ2dlcmluZ1xuICAgIHRoaXMudGljaygpO1xuICB9XG5cbiAgb25NZWRpYU1ldGFkYXRhKCkge1xuICAgIHZhciBtZWRpYSA9IHRoaXMubWVkaWEsXG4gICAgICAgIGN1cnJlbnRUaW1lID0gbWVkaWEuY3VycmVudFRpbWU7XG4gICAgLy8gb25seSBhZGp1c3QgY3VycmVudFRpbWUgaWYgbm90IGVxdWFsIHRvIDBcbiAgICBpZiAoIWN1cnJlbnRUaW1lICYmIGN1cnJlbnRUaW1lICE9PSB0aGlzLnN0YXJ0UG9zaXRpb24pIHtcbiAgICAgIGxvZ2dlci5sb2coJ29uTWVkaWFNZXRhZGF0YTogYWRqdXN0IGN1cnJlbnRUaW1lIHRvIHN0YXJ0UG9zaXRpb24nKTtcbiAgICAgIG1lZGlhLmN1cnJlbnRUaW1lID0gdGhpcy5zdGFydFBvc2l0aW9uO1xuICAgIH1cbiAgICB0aGlzLmxvYWRlZG1ldGFkYXRhID0gdHJ1ZTtcbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4gIG9uTWVkaWFFbmRlZCgpIHtcbiAgICBsb2dnZXIubG9nKCdtZWRpYSBlbmRlZCcpO1xuICAgIC8vIHJlc2V0IHN0YXJ0UG9zaXRpb24gYW5kIGxhc3RDdXJyZW50VGltZSB0byByZXN0YXJ0IHBsYXliYWNrIEAgc3RyZWFtIGJlZ2lubmluZ1xuICAgIHRoaXMuc3RhcnRQb3NpdGlvbiA9IHRoaXMubGFzdEN1cnJlbnRUaW1lID0gMDtcbiAgfVxuXG5cbiAgb25NYW5pZmVzdFBhcnNlZChkYXRhKSB7XG4gICAgdmFyIGFhYyA9IGZhbHNlLCBoZWFhYyA9IGZhbHNlLCBjb2RlY3M7XG4gICAgZGF0YS5sZXZlbHMuZm9yRWFjaChsZXZlbCA9PiB7XG4gICAgICAvLyBkZXRlY3QgaWYgd2UgaGF2ZSBkaWZmZXJlbnQga2luZCBvZiBhdWRpbyBjb2RlY3MgdXNlZCBhbW9uZ3N0IHBsYXlsaXN0c1xuICAgICAgY29kZWNzID0gbGV2ZWwuY29kZWNzO1xuICAgICAgaWYgKGNvZGVjcykge1xuICAgICAgICBpZiAoY29kZWNzLmluZGV4T2YoJ21wNGEuNDAuMicpICE9PSAtMSkge1xuICAgICAgICAgIGFhYyA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvZGVjcy5pbmRleE9mKCdtcDRhLjQwLjUnKSAhPT0gLTEpIHtcbiAgICAgICAgICBoZWFhYyA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgICB0aGlzLmF1ZGlvY29kZWNzd2l0Y2ggPSAoYWFjICYmIGhlYWFjKTtcbiAgICBpZiAodGhpcy5hdWRpb2NvZGVjc3dpdGNoKSB7XG4gICAgICBsb2dnZXIubG9nKCdib3RoIEFBQy9IRS1BQUMgYXVkaW8gZm91bmQgaW4gbGV2ZWxzOyBkZWNsYXJpbmcgYXVkaW8gY29kZWMgYXMgSEUtQUFDJyk7XG4gICAgfVxuICAgIHRoaXMubGV2ZWxzID0gZGF0YS5sZXZlbHM7XG4gICAgdGhpcy5zdGFydExldmVsTG9hZGVkID0gZmFsc2U7XG4gICAgdGhpcy5zdGFydEZyYWdtZW50UmVxdWVzdGVkID0gZmFsc2U7XG4gICAgaWYgKHRoaXMubWVkaWEgJiYgdGhpcy5jb25maWcuYXV0b1N0YXJ0TG9hZCkge1xuICAgICAgdGhpcy5zdGFydExvYWQoKTtcbiAgICB9XG4gIH1cblxuICBvbkxldmVsTG9hZGVkKGRhdGEpIHtcbiAgICB2YXIgbmV3RGV0YWlscyA9IGRhdGEuZGV0YWlscyxcbiAgICAgICAgbmV3TGV2ZWxJZCA9IGRhdGEubGV2ZWwsXG4gICAgICAgIGN1ckxldmVsID0gdGhpcy5sZXZlbHNbbmV3TGV2ZWxJZF0sXG4gICAgICAgIGR1cmF0aW9uID0gbmV3RGV0YWlscy50b3RhbGR1cmF0aW9uO1xuXG4gICAgbG9nZ2VyLmxvZyhgbGV2ZWwgJHtuZXdMZXZlbElkfSBsb2FkZWQgWyR7bmV3RGV0YWlscy5zdGFydFNOfSwke25ld0RldGFpbHMuZW5kU059XSxkdXJhdGlvbjoke2R1cmF0aW9ufWApO1xuICAgIHRoaXMubGV2ZWxMYXN0TG9hZGVkID0gbmV3TGV2ZWxJZDtcblxuICAgIGlmIChuZXdEZXRhaWxzLmxpdmUpIHtcbiAgICAgIHZhciBjdXJEZXRhaWxzID0gY3VyTGV2ZWwuZGV0YWlscztcbiAgICAgIGlmIChjdXJEZXRhaWxzKSB7XG4gICAgICAgIC8vIHdlIGFscmVhZHkgaGF2ZSBkZXRhaWxzIGZvciB0aGF0IGxldmVsLCBtZXJnZSB0aGVtXG4gICAgICAgIExldmVsSGVscGVyLm1lcmdlRGV0YWlscyhjdXJEZXRhaWxzLG5ld0RldGFpbHMpO1xuICAgICAgICBpZiAobmV3RGV0YWlscy5QVFNLbm93bikge1xuICAgICAgICAgIGxvZ2dlci5sb2coYGxpdmUgcGxheWxpc3Qgc2xpZGluZzoke25ld0RldGFpbHMuZnJhZ21lbnRzWzBdLnN0YXJ0LnRvRml4ZWQoMyl9YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbG9nZ2VyLmxvZygnbGl2ZSBwbGF5bGlzdCAtIG91dGRhdGVkIFBUUywgdW5rbm93biBzbGlkaW5nJyk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5ld0RldGFpbHMuUFRTS25vd24gPSBmYWxzZTtcbiAgICAgICAgbG9nZ2VyLmxvZygnbGl2ZSBwbGF5bGlzdCAtIGZpcnN0IGxvYWQsIHVua25vd24gc2xpZGluZycpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBuZXdEZXRhaWxzLlBUU0tub3duID0gZmFsc2U7XG4gICAgfVxuICAgIC8vIG92ZXJyaWRlIGxldmVsIGluZm9cbiAgICBjdXJMZXZlbC5kZXRhaWxzID0gbmV3RGV0YWlscztcbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkxFVkVMX1VQREFURUQsIHsgZGV0YWlsczogbmV3RGV0YWlscywgbGV2ZWw6IG5ld0xldmVsSWQgfSk7XG5cbiAgICAvLyBjb21wdXRlIHN0YXJ0IHBvc2l0aW9uXG4gICAgaWYgKHRoaXMuc3RhcnRMZXZlbExvYWRlZCA9PT0gZmFsc2UpIHtcbiAgICAgIC8vIGlmIGxpdmUgcGxheWxpc3QsIHNldCBzdGFydCBwb3NpdGlvbiB0byBiZSBmcmFnbWVudCBOLXRoaXMuY29uZmlnLmxpdmVTeW5jRHVyYXRpb25Db3VudCAodXN1YWxseSAzKVxuICAgICAgaWYgKG5ld0RldGFpbHMubGl2ZSkge1xuICAgICAgICB0aGlzLnN0YXJ0UG9zaXRpb24gPSBNYXRoLm1heCgwLCBkdXJhdGlvbiAtIHRoaXMuY29uZmlnLmxpdmVTeW5jRHVyYXRpb25Db3VudCAqIG5ld0RldGFpbHMudGFyZ2V0ZHVyYXRpb24pO1xuICAgICAgfVxuICAgICAgdGhpcy5uZXh0TG9hZFBvc2l0aW9uID0gdGhpcy5zdGFydFBvc2l0aW9uO1xuICAgICAgdGhpcy5zdGFydExldmVsTG9hZGVkID0gdHJ1ZTtcbiAgICB9XG4gICAgLy8gb25seSBzd2l0Y2ggYmF0Y2sgdG8gSURMRSBzdGF0ZSBpZiB3ZSB3ZXJlIHdhaXRpbmcgZm9yIGxldmVsIHRvIHN0YXJ0IGRvd25sb2FkaW5nIGEgbmV3IGZyYWdtZW50XG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IFN0YXRlLldBSVRJTkdfTEVWRUwpIHtcbiAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgIH1cbiAgICAvL3RyaWdnZXIgaGFuZGxlciByaWdodCBub3dcbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4gIG9uS2V5TG9hZGVkKCkge1xuICAgIGlmICh0aGlzLnN0YXRlID09PSBTdGF0ZS5LRVlfTE9BRElORykge1xuICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gICAgICB0aGlzLnRpY2soKTtcbiAgICB9XG4gIH1cblxuICBvbkZyYWdMb2FkZWQoZGF0YSkge1xuICAgIHZhciBmcmFnQ3VycmVudCA9IHRoaXMuZnJhZ0N1cnJlbnQ7XG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IFN0YXRlLkZSQUdfTE9BRElORyAmJlxuICAgICAgICBmcmFnQ3VycmVudCAmJlxuICAgICAgICBkYXRhLmZyYWcubGV2ZWwgPT09IGZyYWdDdXJyZW50LmxldmVsICYmXG4gICAgICAgIGRhdGEuZnJhZy5zbiA9PT0gZnJhZ0N1cnJlbnQuc24pIHtcbiAgICAgIGlmICh0aGlzLmZyYWdCaXRyYXRlVGVzdCA9PT0gdHJ1ZSkge1xuICAgICAgICAvLyBzd2l0Y2ggYmFjayB0byBJRExFIHN0YXRlIC4uLiB3ZSBqdXN0IGxvYWRlZCBhIGZyYWdtZW50IHRvIGRldGVybWluZSBhZGVxdWF0ZSBzdGFydCBiaXRyYXRlIGFuZCBpbml0aWFsaXplIGF1dG9zd2l0Y2ggYWxnb1xuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICAgICAgdGhpcy5mcmFnQml0cmF0ZVRlc3QgPSBmYWxzZTtcbiAgICAgICAgZGF0YS5zdGF0cy50cGFyc2VkID0gZGF0YS5zdGF0cy50YnVmZmVyZWQgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5GUkFHX0JVRkZFUkVELCB7c3RhdHM6IGRhdGEuc3RhdHMsIGZyYWc6IGZyYWdDdXJyZW50fSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuUEFSU0lORztcbiAgICAgICAgLy8gdHJhbnNtdXggdGhlIE1QRUctVFMgZGF0YSB0byBJU08tQk1GRiBzZWdtZW50c1xuICAgICAgICB0aGlzLnN0YXRzID0gZGF0YS5zdGF0cztcbiAgICAgICAgdmFyIGN1cnJlbnRMZXZlbCA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdLFxuICAgICAgICAgICAgZGV0YWlscyA9IGN1cnJlbnRMZXZlbC5kZXRhaWxzLFxuICAgICAgICAgICAgZHVyYXRpb24gPSBkZXRhaWxzLnRvdGFsZHVyYXRpb24sXG4gICAgICAgICAgICBzdGFydCA9IGZyYWdDdXJyZW50LnN0YXJ0LFxuICAgICAgICAgICAgbGV2ZWwgPSBmcmFnQ3VycmVudC5sZXZlbCxcbiAgICAgICAgICAgIHNuID0gZnJhZ0N1cnJlbnQuc24sXG4gICAgICAgICAgICBhdWRpb0NvZGVjID0gY3VycmVudExldmVsLmF1ZGlvQ29kZWM7XG4gICAgICAgIGlmKHRoaXMuYXVkaW9Db2RlY1N3YXApIHtcbiAgICAgICAgICBsb2dnZXIubG9nKCdzd2FwcGluZyBwbGF5bGlzdCBhdWRpbyBjb2RlYycpO1xuICAgICAgICAgIGlmKGF1ZGlvQ29kZWMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgYXVkaW9Db2RlYyA9IHRoaXMubGFzdEF1ZGlvQ29kZWM7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmKGF1ZGlvQ29kZWMuaW5kZXhPZignbXA0YS40MC41JykgIT09LTEpIHtcbiAgICAgICAgICAgIGF1ZGlvQ29kZWMgPSAnbXA0YS40MC4yJztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXVkaW9Db2RlYyA9ICdtcDRhLjQwLjUnO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBsb2dnZXIubG9nKGBEZW11eGluZyAke3NufSBvZiBbJHtkZXRhaWxzLnN0YXJ0U059ICwke2RldGFpbHMuZW5kU059XSxsZXZlbCAke2xldmVsfWApO1xuICAgICAgICB0aGlzLmRlbXV4ZXIucHVzaChkYXRhLnBheWxvYWQsIGF1ZGlvQ29kZWMsIGN1cnJlbnRMZXZlbC52aWRlb0NvZGVjLCBzdGFydCwgZnJhZ0N1cnJlbnQuY2MsIGxldmVsLCBzbiwgZHVyYXRpb24sIGZyYWdDdXJyZW50LmRlY3J5cHRkYXRhKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5mcmFnTG9hZEVycm9yID0gMDtcbiAgfVxuXG4gIG9uRnJhZ1BhcnNpbmdJbml0U2VnbWVudChkYXRhKSB7XG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IFN0YXRlLlBBUlNJTkcpIHtcbiAgICAgIC8vIGNoZWNrIGlmIGNvZGVjcyBoYXZlIGJlZW4gZXhwbGljaXRlbHkgZGVmaW5lZCBpbiB0aGUgbWFzdGVyIHBsYXlsaXN0IGZvciB0aGlzIGxldmVsO1xuICAgICAgLy8gaWYgeWVzIHVzZSB0aGVzZSBvbmVzIGluc3RlYWQgb2YgdGhlIG9uZXMgcGFyc2VkIGZyb20gdGhlIGRlbXV4XG4gICAgICB2YXIgYXVkaW9Db2RlYyA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdLmF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMgPSB0aGlzLmxldmVsc1t0aGlzLmxldmVsXS52aWRlb0NvZGVjLCBzYjtcbiAgICAgIHRoaXMubGFzdEF1ZGlvQ29kZWMgPSBkYXRhLmF1ZGlvQ29kZWM7XG4gICAgICBpZihhdWRpb0NvZGVjICYmIHRoaXMuYXVkaW9Db2RlY1N3YXApIHtcbiAgICAgICAgbG9nZ2VyLmxvZygnc3dhcHBpbmcgcGxheWxpc3QgYXVkaW8gY29kZWMnKTtcbiAgICAgICAgaWYoYXVkaW9Db2RlYy5pbmRleE9mKCdtcDRhLjQwLjUnKSAhPT0tMSkge1xuICAgICAgICAgIGF1ZGlvQ29kZWMgPSAnbXA0YS40MC4yJztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBhdWRpb0NvZGVjID0gJ21wNGEuNDAuNSc7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGxvZ2dlci5sb2coYHBsYXlsaXN0X2xldmVsL2luaXRfc2VnbWVudCBjb2RlY3M6IHZpZGVvID0+ICR7dmlkZW9Db2RlY30vJHtkYXRhLnZpZGVvQ29kZWN9OyBhdWRpbyA9PiAke2F1ZGlvQ29kZWN9LyR7ZGF0YS5hdWRpb0NvZGVjfWApO1xuICAgICAgLy8gaWYgcGxheWxpc3QgZG9lcyBub3Qgc3BlY2lmeSBjb2RlY3MsIHVzZSBjb2RlY3MgZm91bmQgd2hpbGUgcGFyc2luZyBmcmFnbWVudFxuICAgICAgLy8gaWYgbm8gY29kZWMgZm91bmQgd2hpbGUgcGFyc2luZyBmcmFnbWVudCwgYWxzbyBzZXQgY29kZWMgdG8gdW5kZWZpbmVkIHRvIGF2b2lkIGNyZWF0aW5nIHNvdXJjZUJ1ZmZlclxuICAgICAgaWYgKGF1ZGlvQ29kZWMgPT09IHVuZGVmaW5lZCB8fCBkYXRhLmF1ZGlvQ29kZWMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBhdWRpb0NvZGVjID0gZGF0YS5hdWRpb0NvZGVjO1xuICAgICAgfVxuXG4gICAgICBpZiAodmlkZW9Db2RlYyA9PT0gdW5kZWZpbmVkICB8fCBkYXRhLnZpZGVvQ29kZWMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICB2aWRlb0NvZGVjID0gZGF0YS52aWRlb0NvZGVjO1xuICAgICAgfVxuICAgICAgLy8gaW4gY2FzZSBzZXZlcmFsIGF1ZGlvIGNvZGVjcyBtaWdodCBiZSB1c2VkLCBmb3JjZSBIRS1BQUMgZm9yIGF1ZGlvIChzb21lIGJyb3dzZXJzIGRvbid0IHN1cHBvcnQgYXVkaW8gY29kZWMgc3dpdGNoKVxuICAgICAgLy9kb24ndCBkbyBpdCBmb3IgbW9ubyBzdHJlYW1zIC4uLlxuICAgICAgdmFyIHVhID0gbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpO1xuICAgICAgaWYgKHRoaXMuYXVkaW9jb2RlY3N3aXRjaCAmJlxuICAgICAgICAgZGF0YS5hdWRpb0NoYW5uZWxDb3VudCAhPT0gMSAmJlxuICAgICAgICAgIHVhLmluZGV4T2YoJ2FuZHJvaWQnKSA9PT0gLTEgJiZcbiAgICAgICAgICB1YS5pbmRleE9mKCdmaXJlZm94JykgPT09IC0xKSB7XG4gICAgICAgIGF1ZGlvQ29kZWMgPSAnbXA0YS40MC41JztcbiAgICAgIH1cbiAgICAgIGlmICghdGhpcy5zb3VyY2VCdWZmZXIpIHtcbiAgICAgICAgdGhpcy5zb3VyY2VCdWZmZXIgPSB7fTtcbiAgICAgICAgbG9nZ2VyLmxvZyhgc2VsZWN0ZWQgQS9WIGNvZGVjcyBmb3Igc291cmNlQnVmZmVyczoke2F1ZGlvQ29kZWN9LCR7dmlkZW9Db2RlY31gKTtcbiAgICAgICAgLy8gY3JlYXRlIHNvdXJjZSBCdWZmZXIgYW5kIGxpbmsgdGhlbSB0byBNZWRpYVNvdXJjZVxuICAgICAgICBpZiAoYXVkaW9Db2RlYykge1xuICAgICAgICAgIHNiID0gdGhpcy5zb3VyY2VCdWZmZXIuYXVkaW8gPSB0aGlzLm1lZGlhU291cmNlLmFkZFNvdXJjZUJ1ZmZlcihgdmlkZW8vbXA0O2NvZGVjcz0ke2F1ZGlvQ29kZWN9YCk7XG4gICAgICAgICAgc2IuYWRkRXZlbnRMaXN0ZW5lcigndXBkYXRlZW5kJywgdGhpcy5vbnNidWUpO1xuICAgICAgICAgIHNiLmFkZEV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgdGhpcy5vbnNiZSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHZpZGVvQ29kZWMpIHtcbiAgICAgICAgICBzYiA9IHRoaXMuc291cmNlQnVmZmVyLnZpZGVvID0gdGhpcy5tZWRpYVNvdXJjZS5hZGRTb3VyY2VCdWZmZXIoYHZpZGVvL21wNDtjb2RlY3M9JHt2aWRlb0NvZGVjfWApO1xuICAgICAgICAgIHNiLmFkZEV2ZW50TGlzdGVuZXIoJ3VwZGF0ZWVuZCcsIHRoaXMub25zYnVlKTtcbiAgICAgICAgICBzYi5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsIHRoaXMub25zYmUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoYXVkaW9Db2RlYykge1xuICAgICAgICB0aGlzLm1wNHNlZ21lbnRzLnB1c2goe3R5cGU6ICdhdWRpbycsIGRhdGE6IGRhdGEuYXVkaW9Nb292fSk7XG4gICAgICB9XG4gICAgICBpZih2aWRlb0NvZGVjKSB7XG4gICAgICAgIHRoaXMubXA0c2VnbWVudHMucHVzaCh7dHlwZTogJ3ZpZGVvJywgZGF0YTogZGF0YS52aWRlb01vb3Z9KTtcbiAgICAgIH1cbiAgICAgIC8vdHJpZ2dlciBoYW5kbGVyIHJpZ2h0IG5vd1xuICAgICAgdGhpcy50aWNrKCk7XG4gICAgfVxuICB9XG5cbiAgb25GcmFnUGFyc2luZ0RhdGEoZGF0YSkge1xuICAgIGlmICh0aGlzLnN0YXRlID09PSBTdGF0ZS5QQVJTSU5HKSB7XG4gICAgICB0aGlzLnRwYXJzZTIgPSBEYXRlLm5vdygpO1xuICAgICAgdmFyIGxldmVsID0gdGhpcy5sZXZlbHNbdGhpcy5sZXZlbF0sXG4gICAgICAgICAgZnJhZyA9IHRoaXMuZnJhZ0N1cnJlbnQ7XG4gICAgICBsb2dnZXIubG9nKGBwYXJzZWQgJHtkYXRhLnR5cGV9LFBUUzpbJHtkYXRhLnN0YXJ0UFRTLnRvRml4ZWQoMyl9LCR7ZGF0YS5lbmRQVFMudG9GaXhlZCgzKX1dLERUUzpbJHtkYXRhLnN0YXJ0RFRTLnRvRml4ZWQoMyl9LyR7ZGF0YS5lbmREVFMudG9GaXhlZCgzKX1dLG5iOiR7ZGF0YS5uYn1gKTtcbiAgICAgIHZhciBkcmlmdCA9IExldmVsSGVscGVyLnVwZGF0ZUZyYWdQVFMobGV2ZWwuZGV0YWlscyxmcmFnLnNuLGRhdGEuc3RhcnRQVFMsZGF0YS5lbmRQVFMpO1xuICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5MRVZFTF9QVFNfVVBEQVRFRCwge2RldGFpbHM6IGxldmVsLmRldGFpbHMsIGxldmVsOiB0aGlzLmxldmVsLCBkcmlmdDogZHJpZnR9KTtcblxuICAgICAgdGhpcy5tcDRzZWdtZW50cy5wdXNoKHt0eXBlOiBkYXRhLnR5cGUsIGRhdGE6IGRhdGEubW9vZn0pO1xuICAgICAgdGhpcy5tcDRzZWdtZW50cy5wdXNoKHt0eXBlOiBkYXRhLnR5cGUsIGRhdGE6IGRhdGEubWRhdH0pO1xuICAgICAgdGhpcy5uZXh0TG9hZFBvc2l0aW9uID0gZGF0YS5lbmRQVFM7XG4gICAgICB0aGlzLmJ1ZmZlclJhbmdlLnB1c2goe3R5cGU6IGRhdGEudHlwZSwgc3RhcnQ6IGRhdGEuc3RhcnRQVFMsIGVuZDogZGF0YS5lbmRQVFMsIGZyYWc6IGZyYWd9KTtcblxuICAgICAgLy90cmlnZ2VyIGhhbmRsZXIgcmlnaHQgbm93XG4gICAgICB0aGlzLnRpY2soKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbG9nZ2VyLndhcm4oYG5vdCBpbiBQQVJTSU5HIHN0YXRlLCBpZ25vcmluZyBGUkFHX1BBUlNJTkdfREFUQSBldmVudGApO1xuICAgIH1cbiAgfVxuXG4gIG9uRnJhZ1BhcnNlZCgpIHtcbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gU3RhdGUuUEFSU0lORykge1xuICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLlBBUlNFRDtcbiAgICAgIHRoaXMuc3RhdHMudHBhcnNlZCA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgLy90cmlnZ2VyIGhhbmRsZXIgcmlnaHQgbm93XG4gICAgICB0aGlzLnRpY2soKTtcbiAgICB9XG4gIH1cblxuICBvbkVycm9yKGRhdGEpIHtcbiAgICBzd2l0Y2goZGF0YS5kZXRhaWxzKSB7XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5GUkFHX0xPQURfRVJST1I6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5GUkFHX0xPQURfVElNRU9VVDpcbiAgICAgICAgaWYoIWRhdGEuZmF0YWwpIHtcbiAgICAgICAgICB2YXIgbG9hZEVycm9yID0gdGhpcy5mcmFnTG9hZEVycm9yO1xuICAgICAgICAgIGlmKGxvYWRFcnJvcikge1xuICAgICAgICAgICAgbG9hZEVycm9yKys7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxvYWRFcnJvcj0xO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAobG9hZEVycm9yIDw9IHRoaXMuY29uZmlnLmZyYWdMb2FkaW5nTWF4UmV0cnkpIHtcbiAgICAgICAgICAgIHRoaXMuZnJhZ0xvYWRFcnJvciA9IGxvYWRFcnJvcjtcbiAgICAgICAgICAgIC8vIHJlc2V0IGxvYWQgY291bnRlciB0byBhdm9pZCBmcmFnIGxvb3AgbG9hZGluZyBlcnJvclxuICAgICAgICAgICAgZGF0YS5mcmFnLmxvYWRDb3VudGVyID0gMDtcbiAgICAgICAgICAgIC8vIGV4cG9uZW50aWFsIGJhY2tvZmYgY2FwcGVkIHRvIDY0c1xuICAgICAgICAgICAgdmFyIGRlbGF5ID0gTWF0aC5taW4oTWF0aC5wb3coMixsb2FkRXJyb3ItMSkqdGhpcy5jb25maWcuZnJhZ0xvYWRpbmdSZXRyeURlbGF5LDY0MDAwKTtcbiAgICAgICAgICAgIGxvZ2dlci53YXJuKGBtZWRpYUNvbnRyb2xsZXI6IGZyYWcgbG9hZGluZyBmYWlsZWQsIHJldHJ5IGluICR7ZGVsYXl9IG1zYCk7XG4gICAgICAgICAgICB0aGlzLnJldHJ5RGF0ZSA9IHBlcmZvcm1hbmNlLm5vdygpICsgZGVsYXk7XG4gICAgICAgICAgICAvLyByZXRyeSBsb2FkaW5nIHN0YXRlXG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuRlJBR19MT0FESU5HX1dBSVRJTkdfUkVUUlk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxvZ2dlci5lcnJvcihgbWVkaWFDb250cm9sbGVyOiAke2RhdGEuZGV0YWlsc30gcmVhY2hlcyBtYXggcmV0cnksIHJlZGlzcGF0Y2ggYXMgZmF0YWwgLi4uYCk7XG4gICAgICAgICAgICAvLyByZWRpc3BhdGNoIHNhbWUgZXJyb3IgYnV0IHdpdGggZmF0YWwgc2V0IHRvIHRydWVcbiAgICAgICAgICAgIGRhdGEuZmF0YWwgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwgZGF0YSk7XG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuRVJST1I7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBFcnJvckRldGFpbHMuRlJBR19MT09QX0xPQURJTkdfRVJST1I6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5MRVZFTF9MT0FEX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuTEVWRUxfTE9BRF9USU1FT1VUOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuS0VZX0xPQURfRVJST1I6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5LRVlfTE9BRF9USU1FT1VUOlxuICAgICAgICAvLyBpZiBmYXRhbCBlcnJvciwgc3RvcCBwcm9jZXNzaW5nLCBvdGhlcndpc2UgbW92ZSB0byBJRExFIHRvIHJldHJ5IGxvYWRpbmdcbiAgICAgICAgbG9nZ2VyLndhcm4oYG1lZGlhQ29udHJvbGxlcjogJHtkYXRhLmRldGFpbHN9IHdoaWxlIGxvYWRpbmcgZnJhZyxzd2l0Y2ggdG8gJHtkYXRhLmZhdGFsID8gJ0VSUk9SJyA6ICdJRExFJ30gc3RhdGUgLi4uYCk7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBkYXRhLmZhdGFsID8gU3RhdGUuRVJST1IgOiBTdGF0ZS5JRExFO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIG9uU0JVcGRhdGVFbmQoKSB7XG4gICAgLy90cmlnZ2VyIGhhbmRsZXIgcmlnaHQgbm93XG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IFN0YXRlLkFQUEVORElORyAmJiB0aGlzLm1wNHNlZ21lbnRzLmxlbmd0aCA9PT0gMCkgIHtcbiAgICAgIHZhciBmcmFnID0gdGhpcy5mcmFnQ3VycmVudCwgc3RhdHMgPSB0aGlzLnN0YXRzO1xuICAgICAgaWYgKGZyYWcpIHtcbiAgICAgICAgdGhpcy5mcmFnUHJldmlvdXMgPSBmcmFnO1xuICAgICAgICBzdGF0cy50YnVmZmVyZWQgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgdGhpcy5mcmFnTGFzdEticHMgPSBNYXRoLnJvdW5kKDggKiBzdGF0cy5sZW5ndGggLyAoc3RhdHMudGJ1ZmZlcmVkIC0gc3RhdHMudGZpcnN0KSk7XG4gICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRlJBR19CVUZGRVJFRCwge3N0YXRzOiBzdGF0cywgZnJhZzogZnJhZ30pO1xuICAgICAgICBsb2dnZXIubG9nKGBtZWRpYSBidWZmZXJlZCA6ICR7dGhpcy50aW1lUmFuZ2VzVG9TdHJpbmcodGhpcy5tZWRpYS5idWZmZXJlZCl9YCk7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG5fY2hlY2tCdWZmZXIoKSB7XG4gICAgdmFyIG1lZGlhID0gdGhpcy5tZWRpYTtcbiAgICBpZihtZWRpYSkge1xuICAgICAgLy8gY29tcGFyZSByZWFkeVN0YXRlXG4gICAgICB2YXIgcmVhZHlTdGF0ZSA9IG1lZGlhLnJlYWR5U3RhdGU7XG4gICAgICAvLyBpZiByZWFkeSBzdGF0ZSBkaWZmZXJlbnQgZnJvbSBIQVZFX05PVEhJTkcgKG51bWVyaWMgdmFsdWUgMCksIHdlIGFyZSBhbGxvd2VkIHRvIHNlZWtcbiAgICAgIGlmKHJlYWR5U3RhdGUpIHtcbiAgICAgICAgLy8gaWYgc2VlayBhZnRlciBidWZmZXJlZCBkZWZpbmVkLCBsZXQncyBzZWVrIGlmIHdpdGhpbiBhY2NlcHRhYmxlIHJhbmdlXG4gICAgICAgIHZhciBzZWVrQWZ0ZXJCdWZmZXJlZCA9IHRoaXMuc2Vla0FmdGVyQnVmZmVyZWQ7XG4gICAgICAgIGlmKHNlZWtBZnRlckJ1ZmZlcmVkKSB7XG4gICAgICAgICAgaWYobWVkaWEuZHVyYXRpb24gPj0gc2Vla0FmdGVyQnVmZmVyZWQpIHtcbiAgICAgICAgICAgIG1lZGlhLmN1cnJlbnRUaW1lID0gc2Vla0FmdGVyQnVmZmVyZWQ7XG4gICAgICAgICAgICB0aGlzLnNlZWtBZnRlckJ1ZmZlcmVkID0gdW5kZWZpbmVkO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YXIgY3VycmVudFRpbWUgPSBtZWRpYS5jdXJyZW50VGltZSxcbiAgICAgICAgICAgICAgYnVmZmVySW5mbyA9IHRoaXMuYnVmZmVySW5mbyhjdXJyZW50VGltZSwwKSxcbiAgICAgICAgICAgICAgaXNQbGF5aW5nID0gIShtZWRpYS5wYXVzZWQgfHwgbWVkaWEuZW5kZWQgfHwgbWVkaWEuc2Vla2luZyB8fCByZWFkeVN0YXRlIDwgMyksXG4gICAgICAgICAgICAgIGp1bXBUaHJlc2hvbGQgPSAwLjIsXG4gICAgICAgICAgICAgIHBsYXloZWFkTW92aW5nID0gY3VycmVudFRpbWUgPiBtZWRpYS5wbGF5YmFja1JhdGUqdGhpcy5sYXN0Q3VycmVudFRpbWU7XG5cbiAgICAgICAgICBpZiAodGhpcy5zdGFsbGVkICYmIHBsYXloZWFkTW92aW5nKSB7XG4gICAgICAgICAgICB0aGlzLnN0YWxsZWQgPSBmYWxzZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBjaGVjayBidWZmZXIgdXBmcm9udFxuICAgICAgICAgIC8vIGlmIGxlc3MgdGhhbiAyMDBtcyBpcyBidWZmZXJlZCwgYW5kIG1lZGlhIGlzIHBsYXlpbmcgYnV0IHBsYXloZWFkIGlzIG5vdCBtb3ZpbmcsXG4gICAgICAgICAgLy8gYW5kIHdlIGhhdmUgYSBuZXcgYnVmZmVyIHJhbmdlIGF2YWlsYWJsZSB1cGZyb250LCBsZXQncyBzZWVrIHRvIHRoYXQgb25lXG4gICAgICAgICAgaWYoYnVmZmVySW5mby5sZW4gPD0ganVtcFRocmVzaG9sZCkge1xuICAgICAgICAgICAgaWYocGxheWhlYWRNb3ZpbmcgfHwgIWlzUGxheWluZykge1xuICAgICAgICAgICAgICAvLyBwbGF5aGVhZCBtb3Zpbmcgb3IgbWVkaWEgbm90IHBsYXlpbmdcbiAgICAgICAgICAgICAganVtcFRocmVzaG9sZCA9IDA7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKCdwbGF5YmFjayBzZWVtcyBzdHVjaycpO1xuICAgICAgICAgICAgICBpZighdGhpcy5zdGFsbGVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5CVUZGRVJfU1RBTExFRF9FUlJPUiwgZmF0YWw6IGZhbHNlfSk7XG4gICAgICAgICAgICAgICAgdGhpcy5zdGFsbGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgfSAgIFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gaWYgd2UgYXJlIGJlbG93IHRocmVzaG9sZCwgdHJ5IHRvIGp1bXAgaWYgbmV4dCBidWZmZXIgcmFuZ2UgaXMgY2xvc2VcbiAgICAgICAgICAgIGlmKGJ1ZmZlckluZm8ubGVuIDw9IGp1bXBUaHJlc2hvbGQpIHtcbiAgICAgICAgICAgICAgLy8gbm8gYnVmZmVyIGF2YWlsYWJsZSBAIGN1cnJlbnRUaW1lLCBjaGVjayBpZiBuZXh0IGJ1ZmZlciBpcyBjbG9zZSAobW9yZSB0aGFuIDVtcyBkaWZmIGJ1dCB3aXRoaW4gYSBjb25maWcubWF4U2Vla0hvbGUgc2Vjb25kIHJhbmdlKVxuICAgICAgICAgICAgICB2YXIgbmV4dEJ1ZmZlclN0YXJ0ID0gYnVmZmVySW5mby5uZXh0U3RhcnQsIGRlbHRhID0gbmV4dEJ1ZmZlclN0YXJ0LWN1cnJlbnRUaW1lO1xuICAgICAgICAgICAgICBpZihuZXh0QnVmZmVyU3RhcnQgJiZcbiAgICAgICAgICAgICAgICAgKGRlbHRhIDwgdGhpcy5jb25maWcubWF4U2Vla0hvbGUpICYmXG4gICAgICAgICAgICAgICAgIChkZWx0YSA+IDAuMDA1KSAgJiZcbiAgICAgICAgICAgICAgICAgIW1lZGlhLnNlZWtpbmcpIHtcbiAgICAgICAgICAgICAgICAvLyBuZXh0IGJ1ZmZlciBpcyBjbG9zZSAhIGFkanVzdCBjdXJyZW50VGltZSB0byBuZXh0QnVmZmVyU3RhcnRcbiAgICAgICAgICAgICAgICAvLyB0aGlzIHdpbGwgZW5zdXJlIGVmZmVjdGl2ZSB2aWRlbyBkZWNvZGluZ1xuICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYGFkanVzdCBjdXJyZW50VGltZSBmcm9tICR7Y3VycmVudFRpbWV9IHRvICR7bmV4dEJ1ZmZlclN0YXJ0fWApO1xuICAgICAgICAgICAgICAgIG1lZGlhLmN1cnJlbnRUaW1lID0gbmV4dEJ1ZmZlclN0YXJ0O1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgc3dhcEF1ZGlvQ29kZWMoKSB7XG4gICAgdGhpcy5hdWRpb0NvZGVjU3dhcCA9ICF0aGlzLmF1ZGlvQ29kZWNTd2FwO1xuICB9XG5cbiAgb25TQlVwZGF0ZUVycm9yKGV2ZW50KSB7XG4gICAgbG9nZ2VyLmVycm9yKGBzb3VyY2VCdWZmZXIgZXJyb3I6JHtldmVudH1gKTtcbiAgICB0aGlzLnN0YXRlID0gU3RhdGUuRVJST1I7XG4gICAgLy8gYWNjb3JkaW5nIHRvIGh0dHA6Ly93d3cudzMub3JnL1RSL21lZGlhLXNvdXJjZS8jc291cmNlYnVmZmVyLWFwcGVuZC1lcnJvclxuICAgIC8vIHRoaXMgZXJyb3IgbWlnaHQgbm90IGFsd2F5cyBiZSBmYXRhbCAoaXQgaXMgZmF0YWwgaWYgZGVjb2RlIGVycm9yIGlzIHNldCwgaW4gdGhhdCBjYXNlXG4gICAgLy8gaXQgd2lsbCBiZSBmb2xsb3dlZCBieSBhIG1lZGlhRWxlbWVudCBlcnJvciAuLi4pXG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5CVUZGRVJfQVBQRU5ESU5HX0VSUk9SLCBmYXRhbDogZmFsc2UsIGZyYWc6IHRoaXMuZnJhZ0N1cnJlbnR9KTtcbiAgfVxuXG4gIHRpbWVSYW5nZXNUb1N0cmluZyhyKSB7XG4gICAgdmFyIGxvZyA9ICcnLCBsZW4gPSByLmxlbmd0aDtcbiAgICBmb3IgKHZhciBpPTA7IGk8bGVuOyBpKyspIHtcbiAgICAgIGxvZyArPSAnWycgKyByLnN0YXJ0KGkpICsgJywnICsgci5lbmQoaSkgKyAnXSc7XG4gICAgfVxuICAgIHJldHVybiBsb2c7XG4gIH1cblxuICBvbk1lZGlhU291cmNlT3BlbigpIHtcbiAgICBsb2dnZXIubG9nKCdtZWRpYSBzb3VyY2Ugb3BlbmVkJyk7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5NRURJQV9BVFRBQ0hFRCk7XG4gICAgdGhpcy5vbnZzZWVraW5nID0gdGhpcy5vbk1lZGlhU2Vla2luZy5iaW5kKHRoaXMpO1xuICAgIHRoaXMub252c2Vla2VkID0gdGhpcy5vbk1lZGlhU2Vla2VkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbnZtZXRhZGF0YSA9IHRoaXMub25NZWRpYU1ldGFkYXRhLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbnZlbmRlZCA9IHRoaXMub25NZWRpYUVuZGVkLmJpbmQodGhpcyk7XG4gICAgdmFyIG1lZGlhID0gdGhpcy5tZWRpYTtcbiAgICBtZWRpYS5hZGRFdmVudExpc3RlbmVyKCdzZWVraW5nJywgdGhpcy5vbnZzZWVraW5nKTtcbiAgICBtZWRpYS5hZGRFdmVudExpc3RlbmVyKCdzZWVrZWQnLCB0aGlzLm9udnNlZWtlZCk7XG4gICAgbWVkaWEuYWRkRXZlbnRMaXN0ZW5lcignbG9hZGVkbWV0YWRhdGEnLCB0aGlzLm9udm1ldGFkYXRhKTtcbiAgICBtZWRpYS5hZGRFdmVudExpc3RlbmVyKCdlbmRlZCcsIHRoaXMub252ZW5kZWQpO1xuICAgIGlmKHRoaXMubGV2ZWxzICYmIHRoaXMuY29uZmlnLmF1dG9TdGFydExvYWQpIHtcbiAgICAgIHRoaXMuc3RhcnRMb2FkKCk7XG4gICAgfVxuICAgIC8vIG9uY2UgcmVjZWl2ZWQsIGRvbid0IGxpc3RlbiBhbnltb3JlIHRvIHNvdXJjZW9wZW4gZXZlbnRcbiAgICB0aGlzLm1lZGlhU291cmNlLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NvdXJjZW9wZW4nLCB0aGlzLm9ubXNvKTtcbiAgfVxuXG4gIG9uTWVkaWFTb3VyY2VDbG9zZSgpIHtcbiAgICBsb2dnZXIubG9nKCdtZWRpYSBzb3VyY2UgY2xvc2VkJyk7XG4gIH1cblxuICBvbk1lZGlhU291cmNlRW5kZWQoKSB7XG4gICAgbG9nZ2VyLmxvZygnbWVkaWEgc291cmNlIGVuZGVkJyk7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IE1TRU1lZGlhQ29udHJvbGxlcjtcblxuIiwiLypcbiAqIFRpbWVsaW5lIENvbnRyb2xsZXJcbiovXG5cbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQgQ0VBNzA4SW50ZXJwcmV0ZXIgZnJvbSAnLi4vdXRpbHMvY2VhLTcwOC1pbnRlcnByZXRlcic7XG5cbmNsYXNzIFRpbWVsaW5lQ29udHJvbGxlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgdGhpcy5obHMgPSBobHM7XG4gICAgdGhpcy5jb25maWcgPSBobHMuY29uZmlnO1xuXG4gICAgaWYgKHRoaXMuY29uZmlnLmVuYWJsZUNFQTcwOENhcHRpb25zKVxuICAgIHtcbiAgICAgIHRoaXMub25tZWRpYWF0dDAgPSB0aGlzLm9uTWVkaWFBdHRhY2hpbmcuYmluZCh0aGlzKTtcbiAgICAgIHRoaXMub25tZWRpYWRldDAgPSB0aGlzLm9uTWVkaWFEZXRhY2hpbmcuYmluZCh0aGlzKTtcbiAgICAgIHRoaXMub251ZCA9IHRoaXMub25GcmFnUGFyc2luZ1VzZXJEYXRhLmJpbmQodGhpcyk7XG4gICAgICB0aGlzLm9ubWwgPSB0aGlzLm9uTWFuaWZlc3RMb2FkaW5nLmJpbmQodGhpcyk7XG4gICAgICB0aGlzLm9ubHMgPSB0aGlzLm9uTGV2ZWxTd2l0Y2guYmluZCh0aGlzKTtcbiAgICAgIGhscy5vbihFdmVudC5NRURJQV9BVFRBQ0hJTkcsIHRoaXMub25tZWRpYWF0dDApO1xuICAgICAgaGxzLm9uKEV2ZW50Lk1FRElBX0RFVEFDSElORywgdGhpcy5vbm1lZGlhZGV0MCk7XG4gICAgICBobHMub24oSGxzLkV2ZW50cy5GUkFHX1BBUlNJTkdfVVNFUkRBVEEsIHRoaXMub251ZCk7XG4gICAgICBobHMub24oRXZlbnQuTUFOSUZFU1RfTE9BRElORywgdGhpcy5vbm1sKTtcbiAgICAgIGhscy5vbihFdmVudC5MRVZFTF9TV0lUQ0gsIHRoaXMub25scyk7XG4gICAgfVxuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgfVxuXG4gIG9uTWVkaWFBdHRhY2hpbmcoZXZlbnQsIGRhdGEpIHtcbiAgICB2YXIgbWVkaWEgPSB0aGlzLm1lZGlhID0gZGF0YS5tZWRpYTtcbiAgICB0aGlzLmNlYTcwOEludGVycHJldGVyID0gbmV3IENFQTcwOEludGVycHJldGVyKHRoaXMubWVkaWEpO1xuICB9XG5cbiAgb25NZWRpYURldGFjaGluZygpIHtcbiAgfVxuXG4gIG9uTWFuaWZlc3RMb2FkaW5nKClcbiAge1xuICAgIHRoaXMubGV2ZWwgPSAtMTtcbiAgfVxuXG4gIG9uTGV2ZWxTd2l0Y2goKVxuICB7XG4gICAgdGhpcy5jZWE3MDhJbnRlcnByZXRlci5jbGVhcigpO1xuICB9XG5cbiAgb25GcmFnUGFyc2luZ1VzZXJEYXRhKGV2ZW50LCBkYXRhKSB7XG4gICAgLy8gcHVzaCBhbGwgb2YgdGhlIENFQS03MDggbWVzc2FnZXMgaW50byB0aGUgaW50ZXJwcmV0ZXJcbiAgICAvLyBpbW1lZGlhdGVseS4gSXQgd2lsbCBjcmVhdGUgdGhlIHByb3BlciB0aW1lc3RhbXBzIGJhc2VkIG9uIG91ciBQVFMgdmFsdWVcbiAgICBmb3IgKHZhciBpPTA7IGk8ZGF0YS5zYW1wbGVzLmxlbmd0aDsgaSsrKVxuICAgIHtcbiAgICAgIHRoaXMuY2VhNzA4SW50ZXJwcmV0ZXIucHVzaChkYXRhLnNhbXBsZXNbaV0ucHRzLCBkYXRhLnNhbXBsZXNbaV0uYnl0ZXMpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBUaW1lbGluZUNvbnRyb2xsZXI7IiwiLypcbiAqXG4gKiBUaGlzIGZpbGUgY29udGFpbnMgYW4gYWRhcHRhdGlvbiBvZiB0aGUgQUVTIGRlY3J5cHRpb24gYWxnb3JpdGhtXG4gKiBmcm9tIHRoZSBTdGFuZGZvcmQgSmF2YXNjcmlwdCBDcnlwdG9ncmFwaHkgTGlicmFyeS4gVGhhdCB3b3JrIGlzXG4gKiBjb3ZlcmVkIGJ5IHRoZSBmb2xsb3dpbmcgY29weXJpZ2h0IGFuZCBwZXJtaXNzaW9ucyBub3RpY2U6XG4gKlxuICogQ29weXJpZ2h0IDIwMDktMjAxMCBFbWlseSBTdGFyaywgTWlrZSBIYW1idXJnLCBEYW4gQm9uZWguXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFJlZGlzdHJpYnV0aW9uIGFuZCB1c2UgaW4gc291cmNlIGFuZCBiaW5hcnkgZm9ybXMsIHdpdGggb3Igd2l0aG91dFxuICogbW9kaWZpY2F0aW9uLCBhcmUgcGVybWl0dGVkIHByb3ZpZGVkIHRoYXQgdGhlIGZvbGxvd2luZyBjb25kaXRpb25zIGFyZVxuICogbWV0OlxuICpcbiAqIDEuIFJlZGlzdHJpYnV0aW9ucyBvZiBzb3VyY2UgY29kZSBtdXN0IHJldGFpbiB0aGUgYWJvdmUgY29weXJpZ2h0XG4gKiAgICBub3RpY2UsIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIuXG4gKlxuICogMi4gUmVkaXN0cmlidXRpb25zIGluIGJpbmFyeSBmb3JtIG11c3QgcmVwcm9kdWNlIHRoZSBhYm92ZVxuICogICAgY29weXJpZ2h0IG5vdGljZSwgdGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmdcbiAqICAgIGRpc2NsYWltZXIgaW4gdGhlIGRvY3VtZW50YXRpb24gYW5kL29yIG90aGVyIG1hdGVyaWFscyBwcm92aWRlZFxuICogICAgd2l0aCB0aGUgZGlzdHJpYnV0aW9uLlxuICpcbiAqIFRISVMgU09GVFdBUkUgSVMgUFJPVklERUQgQlkgVEhFIEFVVEhPUlMgYGBBUyBJUycnIEFORCBBTlkgRVhQUkVTUyBPUlxuICogSU1QTElFRCBXQVJSQU5USUVTLCBJTkNMVURJTkcsIEJVVCBOT1QgTElNSVRFRCBUTywgVEhFIElNUExJRURcbiAqIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZIEFORCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBUkVcbiAqIERJU0NMQUlNRUQuIElOIE5PIEVWRU5UIFNIQUxMIDxDT1BZUklHSFQgSE9MREVSPiBPUiBDT05UUklCVVRPUlMgQkVcbiAqIExJQUJMRSBGT1IgQU5ZIERJUkVDVCwgSU5ESVJFQ1QsIElOQ0lERU5UQUwsIFNQRUNJQUwsIEVYRU1QTEFSWSwgT1JcbiAqIENPTlNFUVVFTlRJQUwgREFNQUdFUyAoSU5DTFVESU5HLCBCVVQgTk9UIExJTUlURUQgVE8sIFBST0NVUkVNRU5UIE9GXG4gKiBTVUJTVElUVVRFIEdPT0RTIE9SIFNFUlZJQ0VTOyBMT1NTIE9GIFVTRSwgREFUQSwgT1IgUFJPRklUUzsgT1JcbiAqIEJVU0lORVNTIElOVEVSUlVQVElPTikgSE9XRVZFUiBDQVVTRUQgQU5EIE9OIEFOWSBUSEVPUlkgT0YgTElBQklMSVRZLFxuICogV0hFVEhFUiBJTiBDT05UUkFDVCwgU1RSSUNUIExJQUJJTElUWSwgT1IgVE9SVCAoSU5DTFVESU5HIE5FR0xJR0VOQ0VcbiAqIE9SIE9USEVSV0lTRSkgQVJJU0lORyBJTiBBTlkgV0FZIE9VVCBPRiBUSEUgVVNFIE9GIFRISVMgU09GVFdBUkUsIEVWRU5cbiAqIElGIEFEVklTRUQgT0YgVEhFIFBPU1NJQklMSVRZIE9GIFNVQ0ggREFNQUdFLlxuICpcbiAqIFRoZSB2aWV3cyBhbmQgY29uY2x1c2lvbnMgY29udGFpbmVkIGluIHRoZSBzb2Z0d2FyZSBhbmQgZG9jdW1lbnRhdGlvblxuICogYXJlIHRob3NlIG9mIHRoZSBhdXRob3JzIGFuZCBzaG91bGQgbm90IGJlIGludGVycHJldGVkIGFzIHJlcHJlc2VudGluZ1xuICogb2ZmaWNpYWwgcG9saWNpZXMsIGVpdGhlciBleHByZXNzZWQgb3IgaW1wbGllZCwgb2YgdGhlIGF1dGhvcnMuXG4gKi9cbmNsYXNzIEFFUyB7XG5cbiAgLyoqXG4gICAqIFNjaGVkdWxlIG91dCBhbiBBRVMga2V5IGZvciBib3RoIGVuY3J5cHRpb24gYW5kIGRlY3J5cHRpb24uIFRoaXNcbiAgICogaXMgYSBsb3ctbGV2ZWwgY2xhc3MuIFVzZSBhIGNpcGhlciBtb2RlIHRvIGRvIGJ1bGsgZW5jcnlwdGlvbi5cbiAgICpcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSBrZXkge0FycmF5fSBUaGUga2V5IGFzIGFuIGFycmF5IG9mIDQsIDYgb3IgOCB3b3Jkcy5cbiAgICovXG4gIGNvbnN0cnVjdG9yKGtleSkge1xuICAgIC8qKlxuICAgICAqIFRoZSBleHBhbmRlZCBTLWJveCBhbmQgaW52ZXJzZSBTLWJveCB0YWJsZXMuIFRoZXNlIHdpbGwgYmUgY29tcHV0ZWRcbiAgICAgKiBvbiB0aGUgY2xpZW50IHNvIHRoYXQgd2UgZG9uJ3QgaGF2ZSB0byBzZW5kIHRoZW0gZG93biB0aGUgd2lyZS5cbiAgICAgKlxuICAgICAqIFRoZXJlIGFyZSB0d28gdGFibGVzLCBfdGFibGVzWzBdIGlzIGZvciBlbmNyeXB0aW9uIGFuZFxuICAgICAqIF90YWJsZXNbMV0gaXMgZm9yIGRlY3J5cHRpb24uXG4gICAgICpcbiAgICAgKiBUaGUgZmlyc3QgNCBzdWItdGFibGVzIGFyZSB0aGUgZXhwYW5kZWQgUy1ib3ggd2l0aCBNaXhDb2x1bW5zLiBUaGVcbiAgICAgKiBsYXN0IChfdGFibGVzWzAxXVs0XSkgaXMgdGhlIFMtYm94IGl0c2VsZi5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgdGhpcy5fdGFibGVzID0gW1tbXSxbXSxbXSxbXSxbXV0sW1tdLFtdLFtdLFtdLFtdXV07XG5cbiAgICB0aGlzLl9wcmVjb21wdXRlKCk7XG5cbiAgICB2YXIgaSwgaiwgdG1wLFxuICAgIGVuY0tleSwgZGVjS2V5LFxuICAgIHNib3ggPSB0aGlzLl90YWJsZXNbMF1bNF0sIGRlY1RhYmxlID0gdGhpcy5fdGFibGVzWzFdLFxuICAgIGtleUxlbiA9IGtleS5sZW5ndGgsIHJjb24gPSAxO1xuXG4gICAgaWYgKGtleUxlbiAhPT0gNCAmJiBrZXlMZW4gIT09IDYgJiYga2V5TGVuICE9PSA4KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgYWVzIGtleSBzaXplPScgKyBrZXlMZW4pO1xuICAgIH1cblxuICAgIGVuY0tleSA9IGtleS5zbGljZSgwKTtcbiAgICBkZWNLZXkgPSBbXTtcbiAgICB0aGlzLl9rZXkgPSBbZW5jS2V5LCBkZWNLZXldO1xuXG4gICAgLy8gc2NoZWR1bGUgZW5jcnlwdGlvbiBrZXlzXG4gICAgZm9yIChpID0ga2V5TGVuOyBpIDwgNCAqIGtleUxlbiArIDI4OyBpKyspIHtcbiAgICAgIHRtcCA9IGVuY0tleVtpLTFdO1xuXG4gICAgICAvLyBhcHBseSBzYm94XG4gICAgICBpZiAoaSVrZXlMZW4gPT09IDAgfHwgKGtleUxlbiA9PT0gOCAmJiBpJWtleUxlbiA9PT0gNCkpIHtcbiAgICAgICAgdG1wID0gc2JveFt0bXA+Pj4yNF08PDI0IF4gc2JveFt0bXA+PjE2JjI1NV08PDE2IF4gc2JveFt0bXA+PjgmMjU1XTw8OCBeIHNib3hbdG1wJjI1NV07XG5cbiAgICAgICAgLy8gc2hpZnQgcm93cyBhbmQgYWRkIHJjb25cbiAgICAgICAgaWYgKGkla2V5TGVuID09PSAwKSB7XG4gICAgICAgICAgdG1wID0gdG1wPDw4IF4gdG1wPj4+MjQgXiByY29uPDwyNDtcbiAgICAgICAgICByY29uID0gcmNvbjw8MSBeIChyY29uPj43KSoyODM7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZW5jS2V5W2ldID0gZW5jS2V5W2kta2V5TGVuXSBeIHRtcDtcbiAgICB9XG5cbiAgICAvLyBzY2hlZHVsZSBkZWNyeXB0aW9uIGtleXNcbiAgICBmb3IgKGogPSAwOyBpOyBqKyssIGktLSkge1xuICAgICAgdG1wID0gZW5jS2V5W2omMyA/IGkgOiBpIC0gNF07XG4gICAgICBpZiAoaTw9NCB8fCBqPDQpIHtcbiAgICAgICAgZGVjS2V5W2pdID0gdG1wO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGVjS2V5W2pdID0gZGVjVGFibGVbMF1bc2JveFt0bXA+Pj4yNCAgICAgIF1dIF5cbiAgICAgICAgICBkZWNUYWJsZVsxXVtzYm94W3RtcD4+MTYgICYgMjU1XV0gXlxuICAgICAgICAgIGRlY1RhYmxlWzJdW3Nib3hbdG1wPj44ICAgJiAyNTVdXSBeXG4gICAgICAgICAgZGVjVGFibGVbM11bc2JveFt0bXAgICAgICAmIDI1NV1dO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBFeHBhbmQgdGhlIFMtYm94IHRhYmxlcy5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9wcmVjb21wdXRlKCkge1xuICAgIHZhciBlbmNUYWJsZSA9IHRoaXMuX3RhYmxlc1swXSwgZGVjVGFibGUgPSB0aGlzLl90YWJsZXNbMV0sXG4gICAgc2JveCA9IGVuY1RhYmxlWzRdLCBzYm94SW52ID0gZGVjVGFibGVbNF0sXG4gICAgaSwgeCwgeEludiwgZD1bXSwgdGg9W10sIHgyLCB4NCwgeDgsIHMsIHRFbmMsIHREZWM7XG5cbiAgICAvLyBDb21wdXRlIGRvdWJsZSBhbmQgdGhpcmQgdGFibGVzXG4gICAgZm9yIChpID0gMDsgaSA8IDI1NjsgaSsrKSB7XG4gICAgICB0aFsoIGRbaV0gPSBpPDwxIF4gKGk+PjcpKjI4MyApXmldPWk7XG4gICAgfVxuXG4gICAgZm9yICh4ID0geEludiA9IDA7ICFzYm94W3hdOyB4IF49IHgyIHx8IDEsIHhJbnYgPSB0aFt4SW52XSB8fCAxKSB7XG4gICAgICAvLyBDb21wdXRlIHNib3hcbiAgICAgIHMgPSB4SW52IF4geEludjw8MSBeIHhJbnY8PDIgXiB4SW52PDwzIF4geEludjw8NDtcbiAgICAgIHMgPSBzPj44IF4gcyYyNTUgXiA5OTtcbiAgICAgIHNib3hbeF0gPSBzO1xuICAgICAgc2JveEludltzXSA9IHg7XG5cbiAgICAgIC8vIENvbXB1dGUgTWl4Q29sdW1uc1xuICAgICAgeDggPSBkW3g0ID0gZFt4MiA9IGRbeF1dXTtcbiAgICAgIHREZWMgPSB4OCoweDEwMTAxMDEgXiB4NCoweDEwMDAxIF4geDIqMHgxMDEgXiB4KjB4MTAxMDEwMDtcbiAgICAgIHRFbmMgPSBkW3NdKjB4MTAxIF4gcyoweDEwMTAxMDA7XG5cbiAgICAgIGZvciAoaSA9IDA7IGkgPCA0OyBpKyspIHtcbiAgICAgICAgZW5jVGFibGVbaV1beF0gPSB0RW5jID0gdEVuYzw8MjQgXiB0RW5jPj4+ODtcbiAgICAgICAgZGVjVGFibGVbaV1bc10gPSB0RGVjID0gdERlYzw8MjQgXiB0RGVjPj4+ODtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDb21wYWN0aWZ5LiBDb25zaWRlcmFibGUgc3BlZWR1cCBvbiBGaXJlZm94LlxuICAgIGZvciAoaSA9IDA7IGkgPCA1OyBpKyspIHtcbiAgICAgIGVuY1RhYmxlW2ldID0gZW5jVGFibGVbaV0uc2xpY2UoMCk7XG4gICAgICBkZWNUYWJsZVtpXSA9IGRlY1RhYmxlW2ldLnNsaWNlKDApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBEZWNyeXB0IDE2IGJ5dGVzLCBzcGVjaWZpZWQgYXMgZm91ciAzMi1iaXQgd29yZHMuXG4gICAqIEBwYXJhbSBlbmNyeXB0ZWQwIHtudW1iZXJ9IHRoZSBmaXJzdCB3b3JkIHRvIGRlY3J5cHRcbiAgICogQHBhcmFtIGVuY3J5cHRlZDEge251bWJlcn0gdGhlIHNlY29uZCB3b3JkIHRvIGRlY3J5cHRcbiAgICogQHBhcmFtIGVuY3J5cHRlZDIge251bWJlcn0gdGhlIHRoaXJkIHdvcmQgdG8gZGVjcnlwdFxuICAgKiBAcGFyYW0gZW5jcnlwdGVkMyB7bnVtYmVyfSB0aGUgZm91cnRoIHdvcmQgdG8gZGVjcnlwdFxuICAgKiBAcGFyYW0gb3V0IHtJbnQzMkFycmF5fSB0aGUgYXJyYXkgdG8gd3JpdGUgdGhlIGRlY3J5cHRlZCB3b3Jkc1xuICAgKiBpbnRvXG4gICAqIEBwYXJhbSBvZmZzZXQge251bWJlcn0gdGhlIG9mZnNldCBpbnRvIHRoZSBvdXRwdXQgYXJyYXkgdG8gc3RhcnRcbiAgICogd3JpdGluZyByZXN1bHRzXG4gICAqIEByZXR1cm4ge0FycmF5fSBUaGUgcGxhaW50ZXh0LlxuICAgKi9cbiAgZGVjcnlwdChlbmNyeXB0ZWQwLCBlbmNyeXB0ZWQxLCBlbmNyeXB0ZWQyLCBlbmNyeXB0ZWQzLCBvdXQsIG9mZnNldCkge1xuICAgIHZhciBrZXkgPSB0aGlzLl9rZXlbMV0sXG4gICAgLy8gc3RhdGUgdmFyaWFibGVzIGEsYixjLGQgYXJlIGxvYWRlZCB3aXRoIHByZS13aGl0ZW5lZCBkYXRhXG4gICAgYSA9IGVuY3J5cHRlZDAgXiBrZXlbMF0sXG4gICAgYiA9IGVuY3J5cHRlZDMgXiBrZXlbMV0sXG4gICAgYyA9IGVuY3J5cHRlZDIgXiBrZXlbMl0sXG4gICAgZCA9IGVuY3J5cHRlZDEgXiBrZXlbM10sXG4gICAgYTIsIGIyLCBjMixcblxuICAgIG5Jbm5lclJvdW5kcyA9IGtleS5sZW5ndGggLyA0IC0gMiwgLy8ga2V5Lmxlbmd0aCA9PT0gMiA/XG4gICAgaSxcbiAgICBrSW5kZXggPSA0LFxuICAgIHRhYmxlID0gdGhpcy5fdGFibGVzWzFdLFxuXG4gICAgLy8gbG9hZCB1cCB0aGUgdGFibGVzXG4gICAgdGFibGUwICAgID0gdGFibGVbMF0sXG4gICAgdGFibGUxICAgID0gdGFibGVbMV0sXG4gICAgdGFibGUyICAgID0gdGFibGVbMl0sXG4gICAgdGFibGUzICAgID0gdGFibGVbM10sXG4gICAgc2JveCAgPSB0YWJsZVs0XTtcblxuICAgIC8vIElubmVyIHJvdW5kcy4gQ3JpYmJlZCBmcm9tIE9wZW5TU0wuXG4gICAgZm9yIChpID0gMDsgaSA8IG5Jbm5lclJvdW5kczsgaSsrKSB7XG4gICAgICBhMiA9IHRhYmxlMFthPj4+MjRdIF4gdGFibGUxW2I+PjE2ICYgMjU1XSBeIHRhYmxlMltjPj44ICYgMjU1XSBeIHRhYmxlM1tkICYgMjU1XSBeIGtleVtrSW5kZXhdO1xuICAgICAgYjIgPSB0YWJsZTBbYj4+PjI0XSBeIHRhYmxlMVtjPj4xNiAmIDI1NV0gXiB0YWJsZTJbZD4+OCAmIDI1NV0gXiB0YWJsZTNbYSAmIDI1NV0gXiBrZXlba0luZGV4ICsgMV07XG4gICAgICBjMiA9IHRhYmxlMFtjPj4+MjRdIF4gdGFibGUxW2Q+PjE2ICYgMjU1XSBeIHRhYmxlMlthPj44ICYgMjU1XSBeIHRhYmxlM1tiICYgMjU1XSBeIGtleVtrSW5kZXggKyAyXTtcbiAgICAgIGQgID0gdGFibGUwW2Q+Pj4yNF0gXiB0YWJsZTFbYT4+MTYgJiAyNTVdIF4gdGFibGUyW2I+PjggJiAyNTVdIF4gdGFibGUzW2MgJiAyNTVdIF4ga2V5W2tJbmRleCArIDNdO1xuICAgICAga0luZGV4ICs9IDQ7XG4gICAgICBhPWEyOyBiPWIyOyBjPWMyO1xuICAgIH1cblxuICAgIC8vIExhc3Qgcm91bmQuXG4gICAgZm9yIChpID0gMDsgaSA8IDQ7IGkrKykge1xuICAgICAgb3V0WygzICYgLWkpICsgb2Zmc2V0XSA9XG4gICAgICAgIHNib3hbYT4+PjI0ICAgICAgXTw8MjQgXlxuICAgICAgICBzYm94W2I+PjE2ICAmIDI1NV08PDE2IF5cbiAgICAgICAgc2JveFtjPj44ICAgJiAyNTVdPDw4ICBeXG4gICAgICAgIHNib3hbZCAgICAgICYgMjU1XSAgICAgXlxuICAgICAgICBrZXlba0luZGV4KytdO1xuICAgICAgYTI9YTsgYT1iOyBiPWM7IGM9ZDsgZD1hMjtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQUVTO1xuIiwiLypcbiAqXG4gKiBUaGlzIGZpbGUgY29udGFpbnMgYW4gYWRhcHRhdGlvbiBvZiB0aGUgQUVTIGRlY3J5cHRpb24gYWxnb3JpdGhtXG4gKiBmcm9tIHRoZSBTdGFuZGZvcmQgSmF2YXNjcmlwdCBDcnlwdG9ncmFwaHkgTGlicmFyeS4gVGhhdCB3b3JrIGlzXG4gKiBjb3ZlcmVkIGJ5IHRoZSBmb2xsb3dpbmcgY29weXJpZ2h0IGFuZCBwZXJtaXNzaW9ucyBub3RpY2U6XG4gKlxuICogQ29weXJpZ2h0IDIwMDktMjAxMCBFbWlseSBTdGFyaywgTWlrZSBIYW1idXJnLCBEYW4gQm9uZWguXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFJlZGlzdHJpYnV0aW9uIGFuZCB1c2UgaW4gc291cmNlIGFuZCBiaW5hcnkgZm9ybXMsIHdpdGggb3Igd2l0aG91dFxuICogbW9kaWZpY2F0aW9uLCBhcmUgcGVybWl0dGVkIHByb3ZpZGVkIHRoYXQgdGhlIGZvbGxvd2luZyBjb25kaXRpb25zIGFyZVxuICogbWV0OlxuICpcbiAqIDEuIFJlZGlzdHJpYnV0aW9ucyBvZiBzb3VyY2UgY29kZSBtdXN0IHJldGFpbiB0aGUgYWJvdmUgY29weXJpZ2h0XG4gKiAgICBub3RpY2UsIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIuXG4gKlxuICogMi4gUmVkaXN0cmlidXRpb25zIGluIGJpbmFyeSBmb3JtIG11c3QgcmVwcm9kdWNlIHRoZSBhYm92ZVxuICogICAgY29weXJpZ2h0IG5vdGljZSwgdGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmdcbiAqICAgIGRpc2NsYWltZXIgaW4gdGhlIGRvY3VtZW50YXRpb24gYW5kL29yIG90aGVyIG1hdGVyaWFscyBwcm92aWRlZFxuICogICAgd2l0aCB0aGUgZGlzdHJpYnV0aW9uLlxuICpcbiAqIFRISVMgU09GVFdBUkUgSVMgUFJPVklERUQgQlkgVEhFIEFVVEhPUlMgYGBBUyBJUycnIEFORCBBTlkgRVhQUkVTUyBPUlxuICogSU1QTElFRCBXQVJSQU5USUVTLCBJTkNMVURJTkcsIEJVVCBOT1QgTElNSVRFRCBUTywgVEhFIElNUExJRURcbiAqIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZIEFORCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBUkVcbiAqIERJU0NMQUlNRUQuIElOIE5PIEVWRU5UIFNIQUxMIDxDT1BZUklHSFQgSE9MREVSPiBPUiBDT05UUklCVVRPUlMgQkVcbiAqIExJQUJMRSBGT1IgQU5ZIERJUkVDVCwgSU5ESVJFQ1QsIElOQ0lERU5UQUwsIFNQRUNJQUwsIEVYRU1QTEFSWSwgT1JcbiAqIENPTlNFUVVFTlRJQUwgREFNQUdFUyAoSU5DTFVESU5HLCBCVVQgTk9UIExJTUlURUQgVE8sIFBST0NVUkVNRU5UIE9GXG4gKiBTVUJTVElUVVRFIEdPT0RTIE9SIFNFUlZJQ0VTOyBMT1NTIE9GIFVTRSwgREFUQSwgT1IgUFJPRklUUzsgT1JcbiAqIEJVU0lORVNTIElOVEVSUlVQVElPTikgSE9XRVZFUiBDQVVTRUQgQU5EIE9OIEFOWSBUSEVPUlkgT0YgTElBQklMSVRZLFxuICogV0hFVEhFUiBJTiBDT05UUkFDVCwgU1RSSUNUIExJQUJJTElUWSwgT1IgVE9SVCAoSU5DTFVESU5HIE5FR0xJR0VOQ0VcbiAqIE9SIE9USEVSV0lTRSkgQVJJU0lORyBJTiBBTlkgV0FZIE9VVCBPRiBUSEUgVVNFIE9GIFRISVMgU09GVFdBUkUsIEVWRU5cbiAqIElGIEFEVklTRUQgT0YgVEhFIFBPU1NJQklMSVRZIE9GIFNVQ0ggREFNQUdFLlxuICpcbiAqIFRoZSB2aWV3cyBhbmQgY29uY2x1c2lvbnMgY29udGFpbmVkIGluIHRoZSBzb2Z0d2FyZSBhbmQgZG9jdW1lbnRhdGlvblxuICogYXJlIHRob3NlIG9mIHRoZSBhdXRob3JzIGFuZCBzaG91bGQgbm90IGJlIGludGVycHJldGVkIGFzIHJlcHJlc2VudGluZ1xuICogb2ZmaWNpYWwgcG9saWNpZXMsIGVpdGhlciBleHByZXNzZWQgb3IgaW1wbGllZCwgb2YgdGhlIGF1dGhvcnMuXG4gKi9cblxuaW1wb3J0IEFFUyBmcm9tICcuL2Flcyc7XG5cbmNsYXNzIEFFUzEyOERlY3J5cHRlciB7XG5cbiAgY29uc3RydWN0b3Ioa2V5LCBpbml0VmVjdG9yKSB7XG4gICAgdGhpcy5rZXkgPSBrZXk7XG4gICAgdGhpcy5pdiA9IGluaXRWZWN0b3I7XG4gIH1cblxuICAvKipcbiAgICogQ29udmVydCBuZXR3b3JrLW9yZGVyIChiaWctZW5kaWFuKSBieXRlcyBpbnRvIHRoZWlyIGxpdHRsZS1lbmRpYW5cbiAgICogcmVwcmVzZW50YXRpb24uXG4gICAqL1xuICBudG9oKHdvcmQpIHtcbiAgICByZXR1cm4gKHdvcmQgPDwgMjQpIHxcbiAgICAgICgod29yZCAmIDB4ZmYwMCkgPDwgOCkgfFxuICAgICAgKCh3b3JkICYgMHhmZjAwMDApID4+IDgpIHxcbiAgICAgICh3b3JkID4+PiAyNCk7XG4gIH1cblxuXG4gIC8qKlxuICAgKiBEZWNyeXB0IGJ5dGVzIHVzaW5nIEFFUy0xMjggd2l0aCBDQkMgYW5kIFBLQ1MjNyBwYWRkaW5nLlxuICAgKiBAcGFyYW0gZW5jcnlwdGVkIHtVaW50OEFycmF5fSB0aGUgZW5jcnlwdGVkIGJ5dGVzXG4gICAqIEBwYXJhbSBrZXkge1VpbnQzMkFycmF5fSB0aGUgYnl0ZXMgb2YgdGhlIGRlY3J5cHRpb24ga2V5XG4gICAqIEBwYXJhbSBpbml0VmVjdG9yIHtVaW50MzJBcnJheX0gdGhlIGluaXRpYWxpemF0aW9uIHZlY3RvciAoSVYpIHRvXG4gICAqIHVzZSBmb3IgdGhlIGZpcnN0IHJvdW5kIG9mIENCQy5cbiAgICogQHJldHVybiB7VWludDhBcnJheX0gdGhlIGRlY3J5cHRlZCBieXRlc1xuICAgKlxuICAgKiBAc2VlIGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvQWR2YW5jZWRfRW5jcnlwdGlvbl9TdGFuZGFyZFxuICAgKiBAc2VlIGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvQmxvY2tfY2lwaGVyX21vZGVfb2Zfb3BlcmF0aW9uI0NpcGhlcl9CbG9ja19DaGFpbmluZ18uMjhDQkMuMjlcbiAgICogQHNlZSBodHRwczovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjMjMxNVxuICAgKi9cbiAgZG9EZWNyeXB0KGVuY3J5cHRlZCwga2V5LCBpbml0VmVjdG9yKSB7XG4gICAgdmFyXG4gICAgICAvLyB3b3JkLWxldmVsIGFjY2VzcyB0byB0aGUgZW5jcnlwdGVkIGJ5dGVzXG4gICAgICBlbmNyeXB0ZWQzMiA9IG5ldyBJbnQzMkFycmF5KGVuY3J5cHRlZC5idWZmZXIsIGVuY3J5cHRlZC5ieXRlT2Zmc2V0LCBlbmNyeXB0ZWQuYnl0ZUxlbmd0aCA+PiAyKSxcblxuICAgIGRlY2lwaGVyID0gbmV3IEFFUyhBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChrZXkpKSxcblxuICAgIC8vIGJ5dGUgYW5kIHdvcmQtbGV2ZWwgYWNjZXNzIGZvciB0aGUgZGVjcnlwdGVkIG91dHB1dFxuICAgIGRlY3J5cHRlZCA9IG5ldyBVaW50OEFycmF5KGVuY3J5cHRlZC5ieXRlTGVuZ3RoKSxcbiAgICBkZWNyeXB0ZWQzMiA9IG5ldyBJbnQzMkFycmF5KGRlY3J5cHRlZC5idWZmZXIpLFxuXG4gICAgLy8gdGVtcG9yYXJ5IHZhcmlhYmxlcyBmb3Igd29ya2luZyB3aXRoIHRoZSBJViwgZW5jcnlwdGVkLCBhbmRcbiAgICAvLyBkZWNyeXB0ZWQgZGF0YVxuICAgIGluaXQwLCBpbml0MSwgaW5pdDIsIGluaXQzLFxuICAgIGVuY3J5cHRlZDAsIGVuY3J5cHRlZDEsIGVuY3J5cHRlZDIsIGVuY3J5cHRlZDMsXG5cbiAgICAvLyBpdGVyYXRpb24gdmFyaWFibGVcbiAgICB3b3JkSXg7XG5cbiAgICAvLyBwdWxsIG91dCB0aGUgd29yZHMgb2YgdGhlIElWIHRvIGVuc3VyZSB3ZSBkb24ndCBtb2RpZnkgdGhlXG4gICAgLy8gcGFzc2VkLWluIHJlZmVyZW5jZSBhbmQgZWFzaWVyIGFjY2Vzc1xuICAgIGluaXQwID0gfn5pbml0VmVjdG9yWzBdO1xuICAgIGluaXQxID0gfn5pbml0VmVjdG9yWzFdO1xuICAgIGluaXQyID0gfn5pbml0VmVjdG9yWzJdO1xuICAgIGluaXQzID0gfn5pbml0VmVjdG9yWzNdO1xuXG4gICAgLy8gZGVjcnlwdCBmb3VyIHdvcmQgc2VxdWVuY2VzLCBhcHBseWluZyBjaXBoZXItYmxvY2sgY2hhaW5pbmcgKENCQylcbiAgICAvLyB0byBlYWNoIGRlY3J5cHRlZCBibG9ja1xuICAgIGZvciAod29yZEl4ID0gMDsgd29yZEl4IDwgZW5jcnlwdGVkMzIubGVuZ3RoOyB3b3JkSXggKz0gNCkge1xuICAgICAgLy8gY29udmVydCBiaWctZW5kaWFuIChuZXR3b3JrIG9yZGVyKSB3b3JkcyBpbnRvIGxpdHRsZS1lbmRpYW5cbiAgICAgIC8vIChqYXZhc2NyaXB0IG9yZGVyKVxuICAgICAgZW5jcnlwdGVkMCA9IH5+dGhpcy5udG9oKGVuY3J5cHRlZDMyW3dvcmRJeF0pO1xuICAgICAgZW5jcnlwdGVkMSA9IH5+dGhpcy5udG9oKGVuY3J5cHRlZDMyW3dvcmRJeCArIDFdKTtcbiAgICAgIGVuY3J5cHRlZDIgPSB+fnRoaXMubnRvaChlbmNyeXB0ZWQzMlt3b3JkSXggKyAyXSk7XG4gICAgICBlbmNyeXB0ZWQzID0gfn50aGlzLm50b2goZW5jcnlwdGVkMzJbd29yZEl4ICsgM10pO1xuXG4gICAgICAvLyBkZWNyeXB0IHRoZSBibG9ja1xuICAgICAgZGVjaXBoZXIuZGVjcnlwdChlbmNyeXB0ZWQwLFxuICAgICAgICAgIGVuY3J5cHRlZDEsXG4gICAgICAgICAgZW5jcnlwdGVkMixcbiAgICAgICAgICBlbmNyeXB0ZWQzLFxuICAgICAgICAgIGRlY3J5cHRlZDMyLFxuICAgICAgICAgIHdvcmRJeCk7XG5cbiAgICAgIC8vIFhPUiB3aXRoIHRoZSBJViwgYW5kIHJlc3RvcmUgbmV0d29yayBieXRlLW9yZGVyIHRvIG9idGFpbiB0aGVcbiAgICAgIC8vIHBsYWludGV4dFxuICAgICAgZGVjcnlwdGVkMzJbd29yZEl4XSAgICAgPSB0aGlzLm50b2goZGVjcnlwdGVkMzJbd29yZEl4XSBeIGluaXQwKTtcbiAgICAgIGRlY3J5cHRlZDMyW3dvcmRJeCArIDFdID0gdGhpcy5udG9oKGRlY3J5cHRlZDMyW3dvcmRJeCArIDFdIF4gaW5pdDEpO1xuICAgICAgZGVjcnlwdGVkMzJbd29yZEl4ICsgMl0gPSB0aGlzLm50b2goZGVjcnlwdGVkMzJbd29yZEl4ICsgMl0gXiBpbml0Mik7XG4gICAgICBkZWNyeXB0ZWQzMlt3b3JkSXggKyAzXSA9IHRoaXMubnRvaChkZWNyeXB0ZWQzMlt3b3JkSXggKyAzXSBeIGluaXQzKTtcblxuICAgICAgLy8gc2V0dXAgdGhlIElWIGZvciB0aGUgbmV4dCByb3VuZFxuICAgICAgaW5pdDAgPSBlbmNyeXB0ZWQwO1xuICAgICAgaW5pdDEgPSBlbmNyeXB0ZWQxO1xuICAgICAgaW5pdDIgPSBlbmNyeXB0ZWQyO1xuICAgICAgaW5pdDMgPSBlbmNyeXB0ZWQzO1xuICAgIH1cblxuICAgIHJldHVybiBkZWNyeXB0ZWQ7XG4gIH1cblxuICBsb2NhbERlY3J5cHQoZW5jcnlwdGVkLCBrZXksIGluaXRWZWN0b3IsIGRlY3J5cHRlZCkge1xuICAgIHZhciBieXRlcyA9IHRoaXMuZG9EZWNyeXB0KGVuY3J5cHRlZCxcbiAgICAgICAga2V5LFxuICAgICAgICBpbml0VmVjdG9yKTtcbiAgICBkZWNyeXB0ZWQuc2V0KGJ5dGVzLCBlbmNyeXB0ZWQuYnl0ZU9mZnNldCk7XG4gIH1cblxuICBkZWNyeXB0KGVuY3J5cHRlZCkge1xuICAgIHZhclxuICAgICAgc3RlcCA9IDQgKiA4MDAwLFxuICAgIC8vZW5jcnlwdGVkMzIgPSBuZXcgSW50MzJBcnJheShlbmNyeXB0ZWQuYnVmZmVyKSxcbiAgICBlbmNyeXB0ZWQzMiA9IG5ldyBJbnQzMkFycmF5KGVuY3J5cHRlZCksXG4gICAgZGVjcnlwdGVkID0gbmV3IFVpbnQ4QXJyYXkoZW5jcnlwdGVkLmJ5dGVMZW5ndGgpLFxuICAgIGkgPSAwO1xuXG4gICAgLy8gc3BsaXQgdXAgdGhlIGVuY3J5cHRpb24gam9iIGFuZCBkbyB0aGUgaW5kaXZpZHVhbCBjaHVua3MgYXN5bmNocm9ub3VzbHlcbiAgICB2YXIga2V5ID0gdGhpcy5rZXk7XG4gICAgdmFyIGluaXRWZWN0b3IgPSB0aGlzLml2O1xuICAgIHRoaXMubG9jYWxEZWNyeXB0KGVuY3J5cHRlZDMyLnN1YmFycmF5KGksIGkgKyBzdGVwKSwga2V5LCBpbml0VmVjdG9yLCBkZWNyeXB0ZWQpO1xuXG4gICAgZm9yIChpID0gc3RlcDsgaSA8IGVuY3J5cHRlZDMyLmxlbmd0aDsgaSArPSBzdGVwKSB7XG4gICAgICBpbml0VmVjdG9yID0gbmV3IFVpbnQzMkFycmF5KFtcbiAgICAgICAgICB0aGlzLm50b2goZW5jcnlwdGVkMzJbaSAtIDRdKSxcbiAgICAgICAgICB0aGlzLm50b2goZW5jcnlwdGVkMzJbaSAtIDNdKSxcbiAgICAgICAgICB0aGlzLm50b2goZW5jcnlwdGVkMzJbaSAtIDJdKSxcbiAgICAgICAgICB0aGlzLm50b2goZW5jcnlwdGVkMzJbaSAtIDFdKVxuICAgICAgXSk7XG4gICAgICB0aGlzLmxvY2FsRGVjcnlwdChlbmNyeXB0ZWQzMi5zdWJhcnJheShpLCBpICsgc3RlcCksIGtleSwgaW5pdFZlY3RvciwgZGVjcnlwdGVkKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZGVjcnlwdGVkO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEFFUzEyOERlY3J5cHRlcjtcbiIsIi8qXG4gKiBBRVMxMjggZGVjcnlwdGlvbi5cbiAqL1xuXG5pbXBvcnQgQUVTMTI4RGVjcnlwdGVyIGZyb20gJy4vYWVzMTI4LWRlY3J5cHRlcic7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG5jbGFzcyBEZWNyeXB0ZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHRoaXMuaGxzID0gaGxzO1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBicm93c2VyQ3J5cHRvID0gd2luZG93ID8gd2luZG93LmNyeXB0byA6IGNyeXB0bztcbiAgICAgIHRoaXMuc3VidGxlID0gYnJvd3NlckNyeXB0by5zdWJ0bGUgfHwgYnJvd3NlckNyeXB0by53ZWJraXRTdWJ0bGU7XG4gICAgICB0aGlzLmRpc2FibGVXZWJDcnlwdG8gPSAhdGhpcy5zdWJ0bGU7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgdGhpcy5kaXNhYmxlV2ViQ3J5cHRvID0gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICBkZXN0cm95KCkge1xuICB9XG5cbiAgZGVjcnlwdChkYXRhLCBrZXksIGl2LCBjYWxsYmFjaykge1xuICAgIGlmICh0aGlzLmRpc2FibGVXZWJDcnlwdG8gJiYgdGhpcy5obHMuY29uZmlnLmVuYWJsZVNvZnR3YXJlQUVTKSB7XG4gICAgICB0aGlzLmRlY3J5cHRCeVNvZnR3YXJlKGRhdGEsIGtleSwgaXYsIGNhbGxiYWNrKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5kZWNyeXB0QnlXZWJDcnlwdG8oZGF0YSwga2V5LCBpdiwgY2FsbGJhY2spO1xuICAgIH1cbiAgfVxuXG4gIGRlY3J5cHRCeVdlYkNyeXB0byhkYXRhLCBrZXksIGl2LCBjYWxsYmFjaykge1xuICAgIGxvZ2dlci5sb2coJ2RlY3J5cHRpbmcgYnkgV2ViQ3J5cHRvIEFQSScpO1xuXG4gICAgdGhpcy5zdWJ0bGUuaW1wb3J0S2V5KCdyYXcnLCBrZXksIHsgbmFtZSA6ICdBRVMtQ0JDJywgbGVuZ3RoIDogMTI4IH0sIGZhbHNlLCBbJ2RlY3J5cHQnXSkuXG4gICAgICB0aGVuKChpbXBvcnRlZEtleSkgPT4ge1xuICAgICAgICB0aGlzLnN1YnRsZS5kZWNyeXB0KHsgbmFtZSA6ICdBRVMtQ0JDJywgaXYgOiBpdi5idWZmZXIgfSwgaW1wb3J0ZWRLZXksIGRhdGEpLlxuICAgICAgICAgIHRoZW4oY2FsbGJhY2spLlxuICAgICAgICAgIGNhdGNoICgoZXJyKSA9PiB7XG4gICAgICAgICAgICB0aGlzLm9uV2ViQ3J5cHRvRXJyb3IoZXJyLCBkYXRhLCBrZXksIGl2LCBjYWxsYmFjayk7XG4gICAgICAgICAgfSk7XG4gICAgICB9KS5cbiAgICBjYXRjaCAoKGVycikgPT4ge1xuICAgICAgdGhpcy5vbldlYkNyeXB0b0Vycm9yKGVyciwgZGF0YSwga2V5LCBpdiwgY2FsbGJhY2spO1xuICAgIH0pO1xuICB9XG5cbiAgZGVjcnlwdEJ5U29mdHdhcmUoZGF0YSwga2V5OCwgaXY4LCBjYWxsYmFjaykge1xuICAgIGxvZ2dlci5sb2coJ2RlY3J5cHRpbmcgYnkgSmF2YVNjcmlwdCBJbXBsZW1lbnRhdGlvbicpO1xuXG4gICAgdmFyIHZpZXcgPSBuZXcgRGF0YVZpZXcoa2V5OC5idWZmZXIpO1xuICAgIHZhciBrZXkgPSBuZXcgVWludDMyQXJyYXkoW1xuICAgICAgICB2aWV3LmdldFVpbnQzMigwKSxcbiAgICAgICAgdmlldy5nZXRVaW50MzIoNCksXG4gICAgICAgIHZpZXcuZ2V0VWludDMyKDgpLFxuICAgICAgICB2aWV3LmdldFVpbnQzMigxMilcbiAgICBdKTtcblxuICAgIHZpZXcgPSBuZXcgRGF0YVZpZXcoaXY4LmJ1ZmZlcik7XG4gICAgdmFyIGl2ID0gbmV3IFVpbnQzMkFycmF5KFtcbiAgICAgICAgdmlldy5nZXRVaW50MzIoMCksXG4gICAgICAgIHZpZXcuZ2V0VWludDMyKDQpLFxuICAgICAgICB2aWV3LmdldFVpbnQzMig4KSxcbiAgICAgICAgdmlldy5nZXRVaW50MzIoMTIpXG4gICAgXSk7XG5cbiAgICB2YXIgZGVjcnlwdGVyID0gbmV3IEFFUzEyOERlY3J5cHRlcihrZXksIGl2KTtcbiAgICBjYWxsYmFjayhkZWNyeXB0ZXIuZGVjcnlwdChkYXRhKS5idWZmZXIpO1xuICB9XG5cbiAgb25XZWJDcnlwdG9FcnJvcihlcnIsIGRhdGEsIGtleSwgaXYsIGNhbGxiYWNrKSB7XG4gICAgaWYgKHRoaXMuaGxzLmNvbmZpZy5lbmFibGVTb2Z0d2FyZUFFUykge1xuICAgICAgbG9nZ2VyLmxvZygnZGlzYWJsaW5nIHRvIHVzZSBXZWJDcnlwdG8gQVBJJyk7XG4gICAgICB0aGlzLmRpc2FibGVXZWJDcnlwdG8gPSB0cnVlO1xuICAgICAgdGhpcy5kZWNyeXB0QnlTb2Z0d2FyZShkYXRhLCBrZXksIGl2LCBjYWxsYmFjayk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgbG9nZ2VyLmVycm9yKGBkZWNyeXB0aW5nIGVycm9yIDogJHtlcnIubWVzc2FnZX1gKTtcbiAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlIDogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlscyA6IEVycm9yRGV0YWlscy5GUkFHX0RFQ1JZUFRfRVJST1IsIGZhdGFsIDogdHJ1ZSwgcmVhc29uIDogZXJyLm1lc3NhZ2V9KTtcbiAgICB9XG4gIH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBEZWNyeXB0ZXI7XG4iLCIvKipcbiAqIEFBQyBkZW11eGVyXG4gKi9cbmltcG9ydCBBRFRTIGZyb20gJy4vYWR0cyc7XG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCBJRDMgZnJvbSAnLi4vZGVtdXgvaWQzJztcblxuIGNsYXNzIEFBQ0RlbXV4ZXIge1xuXG4gIGNvbnN0cnVjdG9yKG9ic2VydmVyLHJlbXV4ZXJDbGFzcykge1xuICAgIHRoaXMub2JzZXJ2ZXIgPSBvYnNlcnZlcjtcbiAgICB0aGlzLnJlbXV4ZXJDbGFzcyA9IHJlbXV4ZXJDbGFzcztcbiAgICB0aGlzLnJlbXV4ZXIgPSBuZXcgdGhpcy5yZW11eGVyQ2xhc3Mob2JzZXJ2ZXIpO1xuICAgIHRoaXMuX2FhY1RyYWNrID0ge3R5cGU6ICdhdWRpbycsIGlkIDotMSwgc2VxdWVuY2VOdW1iZXI6IDAsIHNhbXBsZXMgOiBbXSwgbGVuIDogMH07XG4gIH1cblxuICBzdGF0aWMgcHJvYmUoZGF0YSkge1xuICAgIC8vIGNoZWNrIGlmIGRhdGEgY29udGFpbnMgSUQzIHRpbWVzdGFtcCBhbmQgQURUUyBzeW5jIHdvcmNcbiAgICB2YXIgaWQzID0gbmV3IElEMyhkYXRhKSwgYWR0c1N0YXJ0T2Zmc2V0LGxlbjtcbiAgICBpZihpZDMuaGFzVGltZVN0YW1wKSB7XG4gICAgICAvLyBsb29rIGZvciBBRFRTIGhlYWRlciAoMHhGRkZ4KVxuICAgICAgZm9yIChhZHRzU3RhcnRPZmZzZXQgPSBpZDMubGVuZ3RoLCBsZW4gPSBkYXRhLmxlbmd0aDsgYWR0c1N0YXJ0T2Zmc2V0IDwgbGVuIC0gMTsgYWR0c1N0YXJ0T2Zmc2V0KyspIHtcbiAgICAgICAgaWYgKChkYXRhW2FkdHNTdGFydE9mZnNldF0gPT09IDB4ZmYpICYmIChkYXRhW2FkdHNTdGFydE9mZnNldCsxXSAmIDB4ZjApID09PSAweGYwKSB7XG4gICAgICAgICAgLy9sb2dnZXIubG9nKCdBRFRTIHN5bmMgd29yZCBmb3VuZCAhJyk7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cblxuICAvLyBmZWVkIGluY29taW5nIGRhdGEgdG8gdGhlIGZyb250IG9mIHRoZSBwYXJzaW5nIHBpcGVsaW5lXG4gIHB1c2goZGF0YSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCwgY2MsIGxldmVsLCBzbiwgZHVyYXRpb24pIHtcbiAgICB2YXIgdHJhY2sgPSB0aGlzLl9hYWNUcmFjayxcbiAgICAgICAgaWQzID0gbmV3IElEMyhkYXRhKSxcbiAgICAgICAgcHRzID0gOTAqaWQzLnRpbWVTdGFtcCxcbiAgICAgICAgY29uZmlnLCBhZHRzRnJhbWVTaXplLCBhZHRzU3RhcnRPZmZzZXQsIGFkdHNIZWFkZXJMZW4sIHN0YW1wLCBuYlNhbXBsZXMsIGxlbiwgYWFjU2FtcGxlO1xuICAgIC8vIGxvb2sgZm9yIEFEVFMgaGVhZGVyICgweEZGRngpXG4gICAgZm9yIChhZHRzU3RhcnRPZmZzZXQgPSBpZDMubGVuZ3RoLCBsZW4gPSBkYXRhLmxlbmd0aDsgYWR0c1N0YXJ0T2Zmc2V0IDwgbGVuIC0gMTsgYWR0c1N0YXJ0T2Zmc2V0KyspIHtcbiAgICAgIGlmICgoZGF0YVthZHRzU3RhcnRPZmZzZXRdID09PSAweGZmKSAmJiAoZGF0YVthZHRzU3RhcnRPZmZzZXQrMV0gJiAweGYwKSA9PT0gMHhmMCkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIXRyYWNrLmF1ZGlvc2FtcGxlcmF0ZSkge1xuICAgICAgY29uZmlnID0gQURUUy5nZXRBdWRpb0NvbmZpZyh0aGlzLm9ic2VydmVyLGRhdGEsIGFkdHNTdGFydE9mZnNldCwgYXVkaW9Db2RlYyk7XG4gICAgICB0cmFjay5jb25maWcgPSBjb25maWcuY29uZmlnO1xuICAgICAgdHJhY2suYXVkaW9zYW1wbGVyYXRlID0gY29uZmlnLnNhbXBsZXJhdGU7XG4gICAgICB0cmFjay5jaGFubmVsQ291bnQgPSBjb25maWcuY2hhbm5lbENvdW50O1xuICAgICAgdHJhY2suY29kZWMgPSBjb25maWcuY29kZWM7XG4gICAgICB0cmFjay50aW1lc2NhbGUgPSB0aGlzLnJlbXV4ZXIudGltZXNjYWxlO1xuICAgICAgdHJhY2suZHVyYXRpb24gPSB0aGlzLnJlbXV4ZXIudGltZXNjYWxlICogZHVyYXRpb247XG4gICAgICBsb2dnZXIubG9nKGBwYXJzZWQgY29kZWM6JHt0cmFjay5jb2RlY30scmF0ZToke2NvbmZpZy5zYW1wbGVyYXRlfSxuYiBjaGFubmVsOiR7Y29uZmlnLmNoYW5uZWxDb3VudH1gKTtcbiAgICB9XG4gICAgbmJTYW1wbGVzID0gMDtcbiAgICB3aGlsZSAoKGFkdHNTdGFydE9mZnNldCArIDUpIDwgbGVuKSB7XG4gICAgICAvLyByZXRyaWV2ZSBmcmFtZSBzaXplXG4gICAgICBhZHRzRnJhbWVTaXplID0gKChkYXRhW2FkdHNTdGFydE9mZnNldCArIDNdICYgMHgwMykgPDwgMTEpO1xuICAgICAgLy8gYnl0ZSA0XG4gICAgICBhZHRzRnJhbWVTaXplIHw9IChkYXRhW2FkdHNTdGFydE9mZnNldCArIDRdIDw8IDMpO1xuICAgICAgLy8gYnl0ZSA1XG4gICAgICBhZHRzRnJhbWVTaXplIHw9ICgoZGF0YVthZHRzU3RhcnRPZmZzZXQgKyA1XSAmIDB4RTApID4+PiA1KTtcbiAgICAgIGFkdHNIZWFkZXJMZW4gPSAoISEoZGF0YVthZHRzU3RhcnRPZmZzZXQgKyAxXSAmIDB4MDEpID8gNyA6IDkpO1xuICAgICAgYWR0c0ZyYW1lU2l6ZSAtPSBhZHRzSGVhZGVyTGVuO1xuICAgICAgc3RhbXAgPSBNYXRoLnJvdW5kKHB0cyArIG5iU2FtcGxlcyAqIDEwMjQgKiA5MDAwMCAvIHRyYWNrLmF1ZGlvc2FtcGxlcmF0ZSk7XG4gICAgICAvL3N0YW1wID0gcGVzLnB0cztcbiAgICAgIC8vY29uc29sZS5sb2coJ0FBQyBmcmFtZSwgb2Zmc2V0L2xlbmd0aC9wdHM6JyArIChhZHRzU3RhcnRPZmZzZXQrNykgKyAnLycgKyBhZHRzRnJhbWVTaXplICsgJy8nICsgc3RhbXAudG9GaXhlZCgwKSk7XG4gICAgICBpZiAoKGFkdHNGcmFtZVNpemUgPiAwKSAmJiAoKGFkdHNTdGFydE9mZnNldCArIGFkdHNIZWFkZXJMZW4gKyBhZHRzRnJhbWVTaXplKSA8PSBsZW4pKSB7XG4gICAgICAgIGFhY1NhbXBsZSA9IHt1bml0OiBkYXRhLnN1YmFycmF5KGFkdHNTdGFydE9mZnNldCArIGFkdHNIZWFkZXJMZW4sIGFkdHNTdGFydE9mZnNldCArIGFkdHNIZWFkZXJMZW4gKyBhZHRzRnJhbWVTaXplKSwgcHRzOiBzdGFtcCwgZHRzOiBzdGFtcH07XG4gICAgICAgIHRyYWNrLnNhbXBsZXMucHVzaChhYWNTYW1wbGUpO1xuICAgICAgICB0cmFjay5sZW4gKz0gYWR0c0ZyYW1lU2l6ZTtcbiAgICAgICAgYWR0c1N0YXJ0T2Zmc2V0ICs9IGFkdHNGcmFtZVNpemUgKyBhZHRzSGVhZGVyTGVuO1xuICAgICAgICBuYlNhbXBsZXMrKztcbiAgICAgICAgLy8gbG9vayBmb3IgQURUUyBoZWFkZXIgKDB4RkZGeClcbiAgICAgICAgZm9yICggOyBhZHRzU3RhcnRPZmZzZXQgPCAobGVuIC0gMSk7IGFkdHNTdGFydE9mZnNldCsrKSB7XG4gICAgICAgICAgaWYgKChkYXRhW2FkdHNTdGFydE9mZnNldF0gPT09IDB4ZmYpICYmICgoZGF0YVthZHRzU3RhcnRPZmZzZXQgKyAxXSAmIDB4ZjApID09PSAweGYwKSkge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5yZW11eGVyLnJlbXV4KHRoaXMuX2FhY1RyYWNrLHtzYW1wbGVzIDogW119LCB7c2FtcGxlcyA6IFsgeyBwdHM6IHB0cywgZHRzIDogcHRzLCB1bml0IDogaWQzLnBheWxvYWR9IF19LCB0aW1lT2Zmc2V0KTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gIH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBBQUNEZW11eGVyO1xuIiwiLyoqXG4gKiAgQURUUyBwYXJzZXIgaGVscGVyXG4gKi9cbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5cbiBjbGFzcyBBRFRTIHtcblxuICBzdGF0aWMgZ2V0QXVkaW9Db25maWcob2JzZXJ2ZXIsIGRhdGEsIG9mZnNldCwgYXVkaW9Db2RlYykge1xuICAgIHZhciBhZHRzT2JqZWN0VHlwZSwgLy8gOmludFxuICAgICAgICBhZHRzU2FtcGxlaW5nSW5kZXgsIC8vIDppbnRcbiAgICAgICAgYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4LCAvLyA6aW50XG4gICAgICAgIGFkdHNDaGFuZWxDb25maWcsIC8vIDppbnRcbiAgICAgICAgY29uZmlnLFxuICAgICAgICB1c2VyQWdlbnQgPSBuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCksXG4gICAgICAgIGFkdHNTYW1wbGVpbmdSYXRlcyA9IFtcbiAgICAgICAgICAgIDk2MDAwLCA4ODIwMCxcbiAgICAgICAgICAgIDY0MDAwLCA0ODAwMCxcbiAgICAgICAgICAgIDQ0MTAwLCAzMjAwMCxcbiAgICAgICAgICAgIDI0MDAwLCAyMjA1MCxcbiAgICAgICAgICAgIDE2MDAwLCAxMjAwMCxcbiAgICAgICAgICAgIDExMDI1LCA4MDAwLFxuICAgICAgICAgICAgNzM1MF07XG4gICAgLy8gYnl0ZSAyXG4gICAgYWR0c09iamVjdFR5cGUgPSAoKGRhdGFbb2Zmc2V0ICsgMl0gJiAweEMwKSA+Pj4gNikgKyAxO1xuICAgIGFkdHNTYW1wbGVpbmdJbmRleCA9ICgoZGF0YVtvZmZzZXQgKyAyXSAmIDB4M0MpID4+PiAyKTtcbiAgICBpZihhZHRzU2FtcGxlaW5nSW5kZXggPiBhZHRzU2FtcGxlaW5nUmF0ZXMubGVuZ3RoLTEpIHtcbiAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuRlJBR19QQVJTSU5HX0VSUk9SLCBmYXRhbDogdHJ1ZSwgcmVhc29uOiBgaW52YWxpZCBBRFRTIHNhbXBsaW5nIGluZGV4OiR7YWR0c1NhbXBsZWluZ0luZGV4fWB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgYWR0c0NoYW5lbENvbmZpZyA9ICgoZGF0YVtvZmZzZXQgKyAyXSAmIDB4MDEpIDw8IDIpO1xuICAgIC8vIGJ5dGUgM1xuICAgIGFkdHNDaGFuZWxDb25maWcgfD0gKChkYXRhW29mZnNldCArIDNdICYgMHhDMCkgPj4+IDYpO1xuICAgIGxvZ2dlci5sb2coYG1hbmlmZXN0IGNvZGVjOiR7YXVkaW9Db2RlY30sQURUUyBkYXRhOnR5cGU6JHthZHRzT2JqZWN0VHlwZX0sc2FtcGxlaW5nSW5kZXg6JHthZHRzU2FtcGxlaW5nSW5kZXh9WyR7YWR0c1NhbXBsZWluZ1JhdGVzW2FkdHNTYW1wbGVpbmdJbmRleF19SHpdLGNoYW5uZWxDb25maWc6JHthZHRzQ2hhbmVsQ29uZmlnfWApO1xuICAgIC8vIGZpcmVmb3g6IGZyZXEgbGVzcyB0aGFuIDI0a0h6ID0gQUFDIFNCUiAoSEUtQUFDKVxuICAgIGlmICh1c2VyQWdlbnQuaW5kZXhPZignZmlyZWZveCcpICE9PSAtMSkge1xuICAgICAgaWYgKGFkdHNTYW1wbGVpbmdJbmRleCA+PSA2KSB7XG4gICAgICAgIGFkdHNPYmplY3RUeXBlID0gNTtcbiAgICAgICAgY29uZmlnID0gbmV3IEFycmF5KDQpO1xuICAgICAgICAvLyBIRS1BQUMgdXNlcyBTQlIgKFNwZWN0cmFsIEJhbmQgUmVwbGljYXRpb24pICwgaGlnaCBmcmVxdWVuY2llcyBhcmUgY29uc3RydWN0ZWQgZnJvbSBsb3cgZnJlcXVlbmNpZXNcbiAgICAgICAgLy8gdGhlcmUgaXMgYSBmYWN0b3IgMiBiZXR3ZWVuIGZyYW1lIHNhbXBsZSByYXRlIGFuZCBvdXRwdXQgc2FtcGxlIHJhdGVcbiAgICAgICAgLy8gbXVsdGlwbHkgZnJlcXVlbmN5IGJ5IDIgKHNlZSB0YWJsZSBiZWxvdywgZXF1aXZhbGVudCB0byBzdWJzdHJhY3QgMylcbiAgICAgICAgYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ID0gYWR0c1NhbXBsZWluZ0luZGV4IC0gMztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGFkdHNPYmplY3RUeXBlID0gMjtcbiAgICAgICAgY29uZmlnID0gbmV3IEFycmF5KDIpO1xuICAgICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggPSBhZHRzU2FtcGxlaW5nSW5kZXg7XG4gICAgICB9XG4gICAgICAvLyBBbmRyb2lkIDogYWx3YXlzIHVzZSBBQUNcbiAgICB9IGVsc2UgaWYgKHVzZXJBZ2VudC5pbmRleE9mKCdhbmRyb2lkJykgIT09IC0xKSB7XG4gICAgICBhZHRzT2JqZWN0VHlwZSA9IDI7XG4gICAgICBjb25maWcgPSBuZXcgQXJyYXkoMik7XG4gICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggPSBhZHRzU2FtcGxlaW5nSW5kZXg7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8qICBmb3Igb3RoZXIgYnJvd3NlcnMgKGNocm9tZSAuLi4pXG4gICAgICAgICAgYWx3YXlzIGZvcmNlIGF1ZGlvIHR5cGUgdG8gYmUgSEUtQUFDIFNCUiwgYXMgc29tZSBicm93c2VycyBkbyBub3Qgc3VwcG9ydCBhdWRpbyBjb2RlYyBzd2l0Y2ggcHJvcGVybHkgKGxpa2UgQ2hyb21lIC4uLilcbiAgICAgICovXG4gICAgICBhZHRzT2JqZWN0VHlwZSA9IDU7XG4gICAgICBjb25maWcgPSBuZXcgQXJyYXkoNCk7XG4gICAgICAvLyBpZiAobWFuaWZlc3QgY29kZWMgaXMgSEUtQUFDIG9yIEhFLUFBQ3YyKSBPUiAobWFuaWZlc3QgY29kZWMgbm90IHNwZWNpZmllZCBBTkQgZnJlcXVlbmN5IGxlc3MgdGhhbiAyNGtIeilcbiAgICAgIGlmICgoYXVkaW9Db2RlYyAmJiAoKGF1ZGlvQ29kZWMuaW5kZXhPZignbXA0YS40MC4yOScpICE9PSAtMSkgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgKGF1ZGlvQ29kZWMuaW5kZXhPZignbXA0YS40MC41JykgIT09IC0xKSkpIHx8XG4gICAgICAgICAgKCFhdWRpb0NvZGVjICYmIGFkdHNTYW1wbGVpbmdJbmRleCA+PSA2KSkge1xuICAgICAgICAvLyBIRS1BQUMgdXNlcyBTQlIgKFNwZWN0cmFsIEJhbmQgUmVwbGljYXRpb24pICwgaGlnaCBmcmVxdWVuY2llcyBhcmUgY29uc3RydWN0ZWQgZnJvbSBsb3cgZnJlcXVlbmNpZXNcbiAgICAgICAgLy8gdGhlcmUgaXMgYSBmYWN0b3IgMiBiZXR3ZWVuIGZyYW1lIHNhbXBsZSByYXRlIGFuZCBvdXRwdXQgc2FtcGxlIHJhdGVcbiAgICAgICAgLy8gbXVsdGlwbHkgZnJlcXVlbmN5IGJ5IDIgKHNlZSB0YWJsZSBiZWxvdywgZXF1aXZhbGVudCB0byBzdWJzdHJhY3QgMylcbiAgICAgICAgYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ID0gYWR0c1NhbXBsZWluZ0luZGV4IC0gMztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGlmIChtYW5pZmVzdCBjb2RlYyBpcyBBQUMpIEFORCAoZnJlcXVlbmN5IGxlc3MgdGhhbiAyNGtIeiBPUiBuYiBjaGFubmVsIGlzIDEpIE9SIChtYW5pZmVzdCBjb2RlYyBub3Qgc3BlY2lmaWVkIGFuZCBtb25vIGF1ZGlvKVxuICAgICAgICAvLyBDaHJvbWUgZmFpbHMgdG8gcGxheSBiYWNrIHdpdGggQUFDIExDIG1vbm8gd2hlbiBpbml0aWFsaXplZCB3aXRoIEhFLUFBQy4gIFRoaXMgaXMgbm90IGEgcHJvYmxlbSB3aXRoIHN0ZXJlby5cbiAgICAgICAgaWYgKGF1ZGlvQ29kZWMgJiYgYXVkaW9Db2RlYy5pbmRleE9mKCdtcDRhLjQwLjInKSAhPT0gLTEgJiYgKGFkdHNTYW1wbGVpbmdJbmRleCA+PSA2IHx8IGFkdHNDaGFuZWxDb25maWcgPT09IDEpIHx8XG4gICAgICAgICAgICAoIWF1ZGlvQ29kZWMgJiYgYWR0c0NoYW5lbENvbmZpZyA9PT0gMSkpIHtcbiAgICAgICAgICBhZHRzT2JqZWN0VHlwZSA9IDI7XG4gICAgICAgICAgY29uZmlnID0gbmV3IEFycmF5KDIpO1xuICAgICAgICB9XG4gICAgICAgIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCA9IGFkdHNTYW1wbGVpbmdJbmRleDtcbiAgICAgIH1cbiAgICB9XG4gICAgLyogcmVmZXIgdG8gaHR0cDovL3dpa2kubXVsdGltZWRpYS5jeC9pbmRleC5waHA/dGl0bGU9TVBFRy00X0F1ZGlvI0F1ZGlvX1NwZWNpZmljX0NvbmZpZ1xuICAgICAgICBJU08gMTQ0OTYtMyAoQUFDKS5wZGYgLSBUYWJsZSAxLjEzIOKAlCBTeW50YXggb2YgQXVkaW9TcGVjaWZpY0NvbmZpZygpXG4gICAgICBBdWRpbyBQcm9maWxlIC8gQXVkaW8gT2JqZWN0IFR5cGVcbiAgICAgIDA6IE51bGxcbiAgICAgIDE6IEFBQyBNYWluXG4gICAgICAyOiBBQUMgTEMgKExvdyBDb21wbGV4aXR5KVxuICAgICAgMzogQUFDIFNTUiAoU2NhbGFibGUgU2FtcGxlIFJhdGUpXG4gICAgICA0OiBBQUMgTFRQIChMb25nIFRlcm0gUHJlZGljdGlvbilcbiAgICAgIDU6IFNCUiAoU3BlY3RyYWwgQmFuZCBSZXBsaWNhdGlvbilcbiAgICAgIDY6IEFBQyBTY2FsYWJsZVxuICAgICBzYW1wbGluZyBmcmVxXG4gICAgICAwOiA5NjAwMCBIelxuICAgICAgMTogODgyMDAgSHpcbiAgICAgIDI6IDY0MDAwIEh6XG4gICAgICAzOiA0ODAwMCBIelxuICAgICAgNDogNDQxMDAgSHpcbiAgICAgIDU6IDMyMDAwIEh6XG4gICAgICA2OiAyNDAwMCBIelxuICAgICAgNzogMjIwNTAgSHpcbiAgICAgIDg6IDE2MDAwIEh6XG4gICAgICA5OiAxMjAwMCBIelxuICAgICAgMTA6IDExMDI1IEh6XG4gICAgICAxMTogODAwMCBIelxuICAgICAgMTI6IDczNTAgSHpcbiAgICAgIDEzOiBSZXNlcnZlZFxuICAgICAgMTQ6IFJlc2VydmVkXG4gICAgICAxNTogZnJlcXVlbmN5IGlzIHdyaXR0ZW4gZXhwbGljdGx5XG4gICAgICBDaGFubmVsIENvbmZpZ3VyYXRpb25zXG4gICAgICBUaGVzZSBhcmUgdGhlIGNoYW5uZWwgY29uZmlndXJhdGlvbnM6XG4gICAgICAwOiBEZWZpbmVkIGluIEFPVCBTcGVjaWZjIENvbmZpZ1xuICAgICAgMTogMSBjaGFubmVsOiBmcm9udC1jZW50ZXJcbiAgICAgIDI6IDIgY2hhbm5lbHM6IGZyb250LWxlZnQsIGZyb250LXJpZ2h0XG4gICAgKi9cbiAgICAvLyBhdWRpb09iamVjdFR5cGUgPSBwcm9maWxlID0+IHByb2ZpbGUsIHRoZSBNUEVHLTQgQXVkaW8gT2JqZWN0IFR5cGUgbWludXMgMVxuICAgIGNvbmZpZ1swXSA9IGFkdHNPYmplY3RUeXBlIDw8IDM7XG4gICAgLy8gc2FtcGxpbmdGcmVxdWVuY3lJbmRleFxuICAgIGNvbmZpZ1swXSB8PSAoYWR0c1NhbXBsZWluZ0luZGV4ICYgMHgwRSkgPj4gMTtcbiAgICBjb25maWdbMV0gfD0gKGFkdHNTYW1wbGVpbmdJbmRleCAmIDB4MDEpIDw8IDc7XG4gICAgLy8gY2hhbm5lbENvbmZpZ3VyYXRpb25cbiAgICBjb25maWdbMV0gfD0gYWR0c0NoYW5lbENvbmZpZyA8PCAzO1xuICAgIGlmIChhZHRzT2JqZWN0VHlwZSA9PT0gNSkge1xuICAgICAgLy8gYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4XG4gICAgICBjb25maWdbMV0gfD0gKGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCAmIDB4MEUpID4+IDE7XG4gICAgICBjb25maWdbMl0gPSAoYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ICYgMHgwMSkgPDwgNztcbiAgICAgIC8vIGFkdHNPYmplY3RUeXBlIChmb3JjZSB0byAyLCBjaHJvbWUgaXMgY2hlY2tpbmcgdGhhdCBvYmplY3QgdHlwZSBpcyBsZXNzIHRoYW4gNSA/Pz9cbiAgICAgIC8vICAgIGh0dHBzOi8vY2hyb21pdW0uZ29vZ2xlc291cmNlLmNvbS9jaHJvbWl1bS9zcmMuZ2l0LysvbWFzdGVyL21lZGlhL2Zvcm1hdHMvbXA0L2FhYy5jY1xuICAgICAgY29uZmlnWzJdIHw9IDIgPDwgMjtcbiAgICAgIGNvbmZpZ1szXSA9IDA7XG4gICAgfVxuICAgIHJldHVybiB7Y29uZmlnOiBjb25maWcsIHNhbXBsZXJhdGU6IGFkdHNTYW1wbGVpbmdSYXRlc1thZHRzU2FtcGxlaW5nSW5kZXhdLCBjaGFubmVsQ291bnQ6IGFkdHNDaGFuZWxDb25maWcsIGNvZGVjOiAoJ21wNGEuNDAuJyArIGFkdHNPYmplY3RUeXBlKX07XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQURUUztcbiIsIi8qICBpbmxpbmUgZGVtdXhlci5cbiAqICAgcHJvYmUgZnJhZ21lbnRzIGFuZCBpbnN0YW50aWF0ZSBhcHByb3ByaWF0ZSBkZW11eGVyIGRlcGVuZGluZyBvbiBjb250ZW50IHR5cGUgKFRTRGVtdXhlciwgQUFDRGVtdXhlciwgLi4uKVxuICovXG5cbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5pbXBvcnQgQUFDRGVtdXhlciBmcm9tICcuLi9kZW11eC9hYWNkZW11eGVyJztcbmltcG9ydCBUU0RlbXV4ZXIgZnJvbSAnLi4vZGVtdXgvdHNkZW11eGVyJztcblxuY2xhc3MgRGVtdXhlcklubGluZSB7XG5cbiAgY29uc3RydWN0b3IoaGxzLHJlbXV4ZXIpIHtcbiAgICB0aGlzLmhscyA9IGhscztcbiAgICB0aGlzLnJlbXV4ZXIgPSByZW11eGVyO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB2YXIgZGVtdXhlciA9IHRoaXMuZGVtdXhlcjtcbiAgICBpZiAoZGVtdXhlcikge1xuICAgICAgZGVtdXhlci5kZXN0cm95KCk7XG4gICAgfVxuICB9XG5cbiAgcHVzaChkYXRhLCBhdWRpb0NvZGVjLCB2aWRlb0NvZGVjLCB0aW1lT2Zmc2V0LCBjYywgbGV2ZWwsIHNuLCBkdXJhdGlvbikge1xuICAgIHZhciBkZW11eGVyID0gdGhpcy5kZW11eGVyO1xuICAgIGlmICghZGVtdXhlcikge1xuICAgICAgLy8gcHJvYmUgZm9yIGNvbnRlbnQgdHlwZVxuICAgICAgaWYgKFRTRGVtdXhlci5wcm9iZShkYXRhKSkge1xuICAgICAgICBkZW11eGVyID0gdGhpcy5kZW11eGVyID0gbmV3IFRTRGVtdXhlcih0aGlzLmhscyx0aGlzLnJlbXV4ZXIpO1xuICAgICAgfSBlbHNlIGlmKEFBQ0RlbXV4ZXIucHJvYmUoZGF0YSkpIHtcbiAgICAgICAgZGVtdXhlciA9IHRoaXMuZGVtdXhlciA9IG5ldyBBQUNEZW11eGVyKHRoaXMuaGxzLHRoaXMucmVtdXhlcik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZSA6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5GUkFHX1BBUlNJTkdfRVJST1IsIGZhdGFsOiB0cnVlLCByZWFzb246ICdubyBkZW11eCBtYXRjaGluZyB3aXRoIGNvbnRlbnQgZm91bmQnfSk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gICAgZGVtdXhlci5wdXNoKGRhdGEsYXVkaW9Db2RlYyx2aWRlb0NvZGVjLHRpbWVPZmZzZXQsY2MsbGV2ZWwsc24sZHVyYXRpb24pO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IERlbXV4ZXJJbmxpbmU7XG4iLCIvKiBkZW11eGVyIHdlYiB3b3JrZXIuXG4gKiAgLSBsaXN0ZW4gdG8gd29ya2VyIG1lc3NhZ2UsIGFuZCB0cmlnZ2VyIERlbXV4ZXJJbmxpbmUgdXBvbiByZWNlcHRpb24gb2YgRnJhZ21lbnRzLlxuICogIC0gcHJvdmlkZXMgTVA0IEJveGVzIGJhY2sgdG8gbWFpbiB0aHJlYWQgdXNpbmcgW3RyYW5zZmVyYWJsZSBvYmplY3RzXShodHRwczovL2RldmVsb3BlcnMuZ29vZ2xlLmNvbS93ZWIvdXBkYXRlcy8yMDExLzEyL1RyYW5zZmVyYWJsZS1PYmplY3RzLUxpZ2h0bmluZy1GYXN0KSBpbiBvcmRlciB0byBtaW5pbWl6ZSBtZXNzYWdlIHBhc3Npbmcgb3ZlcmhlYWQuXG4gKi9cblxuIGltcG9ydCBEZW11eGVySW5saW5lIGZyb20gJy4uL2RlbXV4L2RlbXV4ZXItaW5saW5lJztcbiBpbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbiBpbXBvcnQgRXZlbnRFbWl0dGVyIGZyb20gJ2V2ZW50cyc7XG4gaW1wb3J0IE1QNFJlbXV4ZXIgZnJvbSAnLi4vcmVtdXgvbXA0LXJlbXV4ZXInO1xuXG52YXIgRGVtdXhlcldvcmtlciA9IGZ1bmN0aW9uIChzZWxmKSB7XG4gIC8vIG9ic2VydmVyIHNldHVwXG4gIHZhciBvYnNlcnZlciA9IG5ldyBFdmVudEVtaXR0ZXIoKTtcbiAgb2JzZXJ2ZXIudHJpZ2dlciA9IGZ1bmN0aW9uIHRyaWdnZXIgKGV2ZW50LCAuLi5kYXRhKSB7XG4gICAgb2JzZXJ2ZXIuZW1pdChldmVudCwgZXZlbnQsIC4uLmRhdGEpO1xuICB9O1xuXG4gIG9ic2VydmVyLm9mZiA9IGZ1bmN0aW9uIG9mZiAoZXZlbnQsIC4uLmRhdGEpIHtcbiAgICBvYnNlcnZlci5yZW1vdmVMaXN0ZW5lcihldmVudCwgLi4uZGF0YSk7XG4gIH07XG4gIHNlbGYuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGZ1bmN0aW9uIChldikge1xuICAgIC8vY29uc29sZS5sb2coJ2RlbXV4ZXIgY21kOicgKyBldi5kYXRhLmNtZCk7XG4gICAgc3dpdGNoIChldi5kYXRhLmNtZCkge1xuICAgICAgY2FzZSAnaW5pdCc6XG4gICAgICAgIHNlbGYuZGVtdXhlciA9IG5ldyBEZW11eGVySW5saW5lKG9ic2VydmVyLE1QNFJlbXV4ZXIpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ2RlbXV4JzpcbiAgICAgICAgdmFyIGRhdGEgPSBldi5kYXRhO1xuICAgICAgICBzZWxmLmRlbXV4ZXIucHVzaChuZXcgVWludDhBcnJheShkYXRhLmRhdGEpLCBkYXRhLmF1ZGlvQ29kZWMsIGRhdGEudmlkZW9Db2RlYywgZGF0YS50aW1lT2Zmc2V0LCBkYXRhLmNjLCBkYXRhLmxldmVsLCBkYXRhLnNuLCBkYXRhLmR1cmF0aW9uKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBicmVhaztcbiAgICB9XG4gIH0pO1xuXG4gIC8vIGxpc3RlbiB0byBldmVudHMgdHJpZ2dlcmVkIGJ5IFRTIERlbXV4ZXJcbiAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCwgZnVuY3Rpb24oZXYsIGRhdGEpIHtcbiAgICB2YXIgb2JqRGF0YSA9IHtldmVudDogZXZ9O1xuICAgIHZhciBvYmpUcmFuc2ZlcmFibGUgPSBbXTtcbiAgICBpZiAoZGF0YS5hdWRpb0NvZGVjKSB7XG4gICAgICBvYmpEYXRhLmF1ZGlvQ29kZWMgPSBkYXRhLmF1ZGlvQ29kZWM7XG4gICAgICBvYmpEYXRhLmF1ZGlvTW9vdiA9IGRhdGEuYXVkaW9Nb292LmJ1ZmZlcjtcbiAgICAgIG9iakRhdGEuYXVkaW9DaGFubmVsQ291bnQgPSBkYXRhLmF1ZGlvQ2hhbm5lbENvdW50O1xuICAgICAgb2JqVHJhbnNmZXJhYmxlLnB1c2gob2JqRGF0YS5hdWRpb01vb3YpO1xuICAgIH1cbiAgICBpZiAoZGF0YS52aWRlb0NvZGVjKSB7XG4gICAgICBvYmpEYXRhLnZpZGVvQ29kZWMgPSBkYXRhLnZpZGVvQ29kZWM7XG4gICAgICBvYmpEYXRhLnZpZGVvTW9vdiA9IGRhdGEudmlkZW9Nb292LmJ1ZmZlcjtcbiAgICAgIG9iakRhdGEudmlkZW9XaWR0aCA9IGRhdGEudmlkZW9XaWR0aDtcbiAgICAgIG9iakRhdGEudmlkZW9IZWlnaHQgPSBkYXRhLnZpZGVvSGVpZ2h0O1xuICAgICAgb2JqVHJhbnNmZXJhYmxlLnB1c2gob2JqRGF0YS52aWRlb01vb3YpO1xuICAgIH1cbiAgICAvLyBwYXNzIG1vb3YgYXMgdHJhbnNmZXJhYmxlIG9iamVjdCAobm8gY29weSlcbiAgICBzZWxmLnBvc3RNZXNzYWdlKG9iakRhdGEsb2JqVHJhbnNmZXJhYmxlKTtcbiAgfSk7XG5cbiAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19QQVJTSU5HX0RBVEEsIGZ1bmN0aW9uKGV2LCBkYXRhKSB7XG4gICAgdmFyIG9iakRhdGEgPSB7ZXZlbnQ6IGV2LCB0eXBlOiBkYXRhLnR5cGUsIHN0YXJ0UFRTOiBkYXRhLnN0YXJ0UFRTLCBlbmRQVFM6IGRhdGEuZW5kUFRTLCBzdGFydERUUzogZGF0YS5zdGFydERUUywgZW5kRFRTOiBkYXRhLmVuZERUUywgbW9vZjogZGF0YS5tb29mLmJ1ZmZlciwgbWRhdDogZGF0YS5tZGF0LmJ1ZmZlciwgbmI6IGRhdGEubmJ9O1xuICAgIC8vIHBhc3MgbW9vZi9tZGF0IGRhdGEgYXMgdHJhbnNmZXJhYmxlIG9iamVjdCAobm8gY29weSlcbiAgICBzZWxmLnBvc3RNZXNzYWdlKG9iakRhdGEsIFtvYmpEYXRhLm1vb2YsIG9iakRhdGEubWRhdF0pO1xuICB9KTtcblxuICBvYnNlcnZlci5vbihFdmVudC5GUkFHX1BBUlNFRCwgZnVuY3Rpb24oZXZlbnQpIHtcbiAgICBzZWxmLnBvc3RNZXNzYWdlKHtldmVudDogZXZlbnR9KTtcbiAgfSk7XG5cbiAgb2JzZXJ2ZXIub24oRXZlbnQuRVJST1IsIGZ1bmN0aW9uKGV2ZW50LCBkYXRhKSB7XG4gICAgc2VsZi5wb3N0TWVzc2FnZSh7ZXZlbnQ6IGV2ZW50LCBkYXRhOiBkYXRhfSk7XG4gIH0pO1xuXG4gIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0lOR19NRVRBREFUQSwgZnVuY3Rpb24oZXZlbnQsIGRhdGEpIHtcbiAgICB2YXIgb2JqRGF0YSA9IHtldmVudDogZXZlbnQsIHNhbXBsZXM6IGRhdGEuc2FtcGxlc307XG4gICAgc2VsZi5wb3N0TWVzc2FnZShvYmpEYXRhKTtcbiAgfSk7XG5cbiAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19QQVJTSU5HX1VTRVJEQVRBLCBmdW5jdGlvbihldmVudCwgZGF0YSkge1xuICAgIHZhciBvYmpEYXRhID0ge2V2ZW50OiBldmVudCwgc2FtcGxlczogZGF0YS5zYW1wbGVzfTtcbiAgICBzZWxmLnBvc3RNZXNzYWdlKG9iakRhdGEpO1xuICB9KTtcblxufTtcblxuZXhwb3J0IGRlZmF1bHQgRGVtdXhlcldvcmtlcjtcblxuIiwiaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgRGVtdXhlcklubGluZSBmcm9tICcuLi9kZW11eC9kZW11eGVyLWlubGluZSc7XG5pbXBvcnQgRGVtdXhlcldvcmtlciBmcm9tICcuLi9kZW11eC9kZW11eGVyLXdvcmtlcic7XG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCBNUDRSZW11eGVyIGZyb20gJy4uL3JlbXV4L21wNC1yZW11eGVyJztcbmltcG9ydCBEZWNyeXB0ZXIgZnJvbSAnLi4vY3J5cHQvZGVjcnlwdGVyJztcblxuY2xhc3MgRGVtdXhlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgdGhpcy5obHMgPSBobHM7XG4gICAgaWYgKGhscy5jb25maWcuZW5hYmxlV29ya2VyICYmICh0eXBlb2YoV29ya2VyKSAhPT0gJ3VuZGVmaW5lZCcpKSB7XG4gICAgICAgIGxvZ2dlci5sb2coJ2RlbXV4aW5nIGluIHdlYndvcmtlcicpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHZhciB3b3JrID0gcmVxdWlyZSgnd2Vid29ya2lmeScpO1xuICAgICAgICAgIHRoaXMudyA9IHdvcmsoRGVtdXhlcldvcmtlcik7XG4gICAgICAgICAgdGhpcy5vbndtc2cgPSB0aGlzLm9uV29ya2VyTWVzc2FnZS5iaW5kKHRoaXMpO1xuICAgICAgICAgIHRoaXMudy5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgdGhpcy5vbndtc2cpO1xuICAgICAgICAgIHRoaXMudy5wb3N0TWVzc2FnZSh7Y21kOiAnaW5pdCd9KTtcbiAgICAgICAgfSBjYXRjaChlcnIpIHtcbiAgICAgICAgICBsb2dnZXIuZXJyb3IoJ2Vycm9yIHdoaWxlIGluaXRpYWxpemluZyBEZW11eGVyV29ya2VyLCBmYWxsYmFjayBvbiBEZW11eGVySW5saW5lJyk7XG4gICAgICAgICAgdGhpcy5kZW11eGVyID0gbmV3IERlbXV4ZXJJbmxpbmUoaGxzLE1QNFJlbXV4ZXIpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmRlbXV4ZXIgPSBuZXcgRGVtdXhlcklubGluZShobHMsTVA0UmVtdXhlcik7XG4gICAgICB9XG4gICAgICB0aGlzLmRlbXV4SW5pdGlhbGl6ZWQgPSB0cnVlO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBpZiAodGhpcy53KSB7XG4gICAgICB0aGlzLncucmVtb3ZlRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIHRoaXMub253bXNnKTtcbiAgICAgIHRoaXMudy50ZXJtaW5hdGUoKTtcbiAgICAgIHRoaXMudyA9IG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZGVtdXhlci5kZXN0cm95KCk7XG4gICAgICB0aGlzLmRlbXV4ZXIgPSBudWxsO1xuICAgIH1cbiAgICBpZiAodGhpcy5kZWNyeXB0ZXIpIHtcbiAgICAgIHRoaXMuZGVjcnlwdGVyLmRlc3Ryb3koKTtcbiAgICAgIHRoaXMuZGVjcnlwdGVyID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICBwdXNoRGVjcnlwdGVkKGRhdGEsIGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQsIGNjLCBsZXZlbCwgc24sIGR1cmF0aW9uKSB7XG4gICAgaWYgKHRoaXMudykge1xuICAgICAgLy8gcG9zdCBmcmFnbWVudCBwYXlsb2FkIGFzIHRyYW5zZmVyYWJsZSBvYmplY3RzIChubyBjb3B5KVxuICAgICAgdGhpcy53LnBvc3RNZXNzYWdlKHtjbWQ6ICdkZW11eCcsIGRhdGE6IGRhdGEsIGF1ZGlvQ29kZWM6IGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWM6IHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQ6IHRpbWVPZmZzZXQsIGNjOiBjYywgbGV2ZWw6IGxldmVsLCBzbiA6IHNuLCBkdXJhdGlvbjogZHVyYXRpb259LCBbZGF0YV0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRlbXV4ZXIucHVzaChuZXcgVWludDhBcnJheShkYXRhKSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCwgY2MsIGxldmVsLCBzbiwgZHVyYXRpb24pO1xuICAgIH1cbiAgfVxuXG4gIHB1c2goZGF0YSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCwgY2MsIGxldmVsLCBzbiwgZHVyYXRpb24sIGRlY3J5cHRkYXRhKSB7XG4gICAgaWYgKChkYXRhLmJ5dGVMZW5ndGggPiAwKSAmJiAoZGVjcnlwdGRhdGEgIT0gbnVsbCkgJiYgKGRlY3J5cHRkYXRhLmtleSAhPSBudWxsKSAmJiAoZGVjcnlwdGRhdGEubWV0aG9kID09PSAnQUVTLTEyOCcpKSB7XG4gICAgICBpZiAodGhpcy5kZWNyeXB0ZXIgPT0gbnVsbCkge1xuICAgICAgICB0aGlzLmRlY3J5cHRlciA9IG5ldyBEZWNyeXB0ZXIodGhpcy5obHMpO1xuICAgICAgfVxuICAgICAgXG4gICAgICB2YXIgbG9jYWx0aGlzID0gdGhpcztcbiAgICAgIHRoaXMuZGVjcnlwdGVyLmRlY3J5cHQoZGF0YSwgZGVjcnlwdGRhdGEua2V5LCBkZWNyeXB0ZGF0YS5pdiwgZnVuY3Rpb24oZGVjcnlwdGVkRGF0YSl7XG4gICAgICAgIGxvY2FsdGhpcy5wdXNoRGVjcnlwdGVkKGRlY3J5cHRlZERhdGEsIGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQsIGNjLCBsZXZlbCwgc24sIGR1cmF0aW9uKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnB1c2hEZWNyeXB0ZWQoZGF0YSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCwgY2MsIGxldmVsLCBzbiwgZHVyYXRpb24pO1xuICAgIH1cbiAgfVxuXG4gIG9uV29ya2VyTWVzc2FnZShldikge1xuICAgIC8vY29uc29sZS5sb2coJ29uV29ya2VyTWVzc2FnZTonICsgZXYuZGF0YS5ldmVudCk7XG4gICAgc3dpdGNoKGV2LmRhdGEuZXZlbnQpIHtcbiAgICAgIGNhc2UgRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVDpcbiAgICAgICAgdmFyIG9iaiA9IHt9O1xuICAgICAgICBpZiAoZXYuZGF0YS5hdWRpb01vb3YpIHtcbiAgICAgICAgICBvYmouYXVkaW9Nb292ID0gbmV3IFVpbnQ4QXJyYXkoZXYuZGF0YS5hdWRpb01vb3YpO1xuICAgICAgICAgIG9iai5hdWRpb0NvZGVjID0gZXYuZGF0YS5hdWRpb0NvZGVjO1xuICAgICAgICAgIG9iai5hdWRpb0NoYW5uZWxDb3VudCA9IGV2LmRhdGEuYXVkaW9DaGFubmVsQ291bnQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGV2LmRhdGEudmlkZW9Nb292KSB7XG4gICAgICAgICAgb2JqLnZpZGVvTW9vdiA9IG5ldyBVaW50OEFycmF5KGV2LmRhdGEudmlkZW9Nb292KTtcbiAgICAgICAgICBvYmoudmlkZW9Db2RlYyA9IGV2LmRhdGEudmlkZW9Db2RlYztcbiAgICAgICAgICBvYmoudmlkZW9XaWR0aCA9IGV2LmRhdGEudmlkZW9XaWR0aDtcbiAgICAgICAgICBvYmoudmlkZW9IZWlnaHQgPSBldi5kYXRhLnZpZGVvSGVpZ2h0O1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCwgb2JqKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBOlxuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLHtcbiAgICAgICAgICBtb29mOiBuZXcgVWludDhBcnJheShldi5kYXRhLm1vb2YpLFxuICAgICAgICAgIG1kYXQ6IG5ldyBVaW50OEFycmF5KGV2LmRhdGEubWRhdCksXG4gICAgICAgICAgc3RhcnRQVFM6IGV2LmRhdGEuc3RhcnRQVFMsXG4gICAgICAgICAgZW5kUFRTOiBldi5kYXRhLmVuZFBUUyxcbiAgICAgICAgICBzdGFydERUUzogZXYuZGF0YS5zdGFydERUUyxcbiAgICAgICAgICBlbmREVFM6IGV2LmRhdGEuZW5kRFRTLFxuICAgICAgICAgIHR5cGU6IGV2LmRhdGEudHlwZSxcbiAgICAgICAgICBuYjogZXYuZGF0YS5uYlxuICAgICAgICB9KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgRXZlbnQuRlJBR19QQVJTSU5HX01FVEFEQVRBOlxuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19NRVRBREFUQSwge1xuICAgICAgICAgIHNhbXBsZXM6IGV2LmRhdGEuc2FtcGxlc1xuICAgICAgICB9KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgRXZlbnQuRlJBR19QQVJTSU5HX1VTRVJEQVRBOlxuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19VU0VSREFUQSwge1xuICAgICAgICAgIHNhbXBsZXM6IGV2LmRhdGEuc2FtcGxlc1xuICAgICAgICB9KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKGV2LmRhdGEuZXZlbnQsIGV2LmRhdGEuZGF0YSk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBEZW11eGVyO1xuXG4iLCIvKipcbiAqIFBhcnNlciBmb3IgZXhwb25lbnRpYWwgR29sb21iIGNvZGVzLCBhIHZhcmlhYmxlLWJpdHdpZHRoIG51bWJlciBlbmNvZGluZyBzY2hlbWUgdXNlZCBieSBoMjY0LlxuKi9cblxuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5cbmNsYXNzIEV4cEdvbG9tYiB7XG5cbiAgY29uc3RydWN0b3IoZGF0YSkge1xuICAgIHRoaXMuZGF0YSA9IGRhdGE7XG4gICAgLy8gdGhlIG51bWJlciBvZiBieXRlcyBsZWZ0IHRvIGV4YW1pbmUgaW4gdGhpcy5kYXRhXG4gICAgdGhpcy5ieXRlc0F2YWlsYWJsZSA9IHRoaXMuZGF0YS5ieXRlTGVuZ3RoO1xuICAgIC8vIHRoZSBjdXJyZW50IHdvcmQgYmVpbmcgZXhhbWluZWRcbiAgICB0aGlzLndvcmQgPSAwOyAvLyA6dWludFxuICAgIC8vIHRoZSBudW1iZXIgb2YgYml0cyBsZWZ0IHRvIGV4YW1pbmUgaW4gdGhlIGN1cnJlbnQgd29yZFxuICAgIHRoaXMuYml0c0F2YWlsYWJsZSA9IDA7IC8vIDp1aW50XG4gIH1cblxuICAvLyAoKTp2b2lkXG4gIGxvYWRXb3JkKCkge1xuICAgIHZhclxuICAgICAgcG9zaXRpb24gPSB0aGlzLmRhdGEuYnl0ZUxlbmd0aCAtIHRoaXMuYnl0ZXNBdmFpbGFibGUsXG4gICAgICB3b3JraW5nQnl0ZXMgPSBuZXcgVWludDhBcnJheSg0KSxcbiAgICAgIGF2YWlsYWJsZUJ5dGVzID0gTWF0aC5taW4oNCwgdGhpcy5ieXRlc0F2YWlsYWJsZSk7XG4gICAgaWYgKGF2YWlsYWJsZUJ5dGVzID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ25vIGJ5dGVzIGF2YWlsYWJsZScpO1xuICAgIH1cbiAgICB3b3JraW5nQnl0ZXMuc2V0KHRoaXMuZGF0YS5zdWJhcnJheShwb3NpdGlvbiwgcG9zaXRpb24gKyBhdmFpbGFibGVCeXRlcykpO1xuICAgIHRoaXMud29yZCA9IG5ldyBEYXRhVmlldyh3b3JraW5nQnl0ZXMuYnVmZmVyKS5nZXRVaW50MzIoMCk7XG4gICAgLy8gdHJhY2sgdGhlIGFtb3VudCBvZiB0aGlzLmRhdGEgdGhhdCBoYXMgYmVlbiBwcm9jZXNzZWRcbiAgICB0aGlzLmJpdHNBdmFpbGFibGUgPSBhdmFpbGFibGVCeXRlcyAqIDg7XG4gICAgdGhpcy5ieXRlc0F2YWlsYWJsZSAtPSBhdmFpbGFibGVCeXRlcztcbiAgfVxuXG4gIC8vIChjb3VudDppbnQpOnZvaWRcbiAgc2tpcEJpdHMoY291bnQpIHtcbiAgICB2YXIgc2tpcEJ5dGVzOyAvLyA6aW50XG4gICAgaWYgKHRoaXMuYml0c0F2YWlsYWJsZSA+IGNvdW50KSB7XG4gICAgICB0aGlzLndvcmQgPDw9IGNvdW50O1xuICAgICAgdGhpcy5iaXRzQXZhaWxhYmxlIC09IGNvdW50O1xuICAgIH0gZWxzZSB7XG4gICAgICBjb3VudCAtPSB0aGlzLmJpdHNBdmFpbGFibGU7XG4gICAgICBza2lwQnl0ZXMgPSBjb3VudCA+PiAzO1xuICAgICAgY291bnQgLT0gKHNraXBCeXRlcyA+PiAzKTtcbiAgICAgIHRoaXMuYnl0ZXNBdmFpbGFibGUgLT0gc2tpcEJ5dGVzO1xuICAgICAgdGhpcy5sb2FkV29yZCgpO1xuICAgICAgdGhpcy53b3JkIDw8PSBjb3VudDtcbiAgICAgIHRoaXMuYml0c0F2YWlsYWJsZSAtPSBjb3VudDtcbiAgICB9XG4gIH1cblxuICAvLyAoc2l6ZTppbnQpOnVpbnRcbiAgcmVhZEJpdHMoc2l6ZSkge1xuICAgIHZhclxuICAgICAgYml0cyA9IE1hdGgubWluKHRoaXMuYml0c0F2YWlsYWJsZSwgc2l6ZSksIC8vIDp1aW50XG4gICAgICB2YWx1ID0gdGhpcy53b3JkID4+PiAoMzIgLSBiaXRzKTsgLy8gOnVpbnRcbiAgICBpZiAoc2l6ZSA+IDMyKSB7XG4gICAgICBsb2dnZXIuZXJyb3IoJ0Nhbm5vdCByZWFkIG1vcmUgdGhhbiAzMiBiaXRzIGF0IGEgdGltZScpO1xuICAgIH1cbiAgICB0aGlzLmJpdHNBdmFpbGFibGUgLT0gYml0cztcbiAgICBpZiAodGhpcy5iaXRzQXZhaWxhYmxlID4gMCkge1xuICAgICAgdGhpcy53b3JkIDw8PSBiaXRzO1xuICAgIH0gZWxzZSBpZiAodGhpcy5ieXRlc0F2YWlsYWJsZSA+IDApIHtcbiAgICAgIHRoaXMubG9hZFdvcmQoKTtcbiAgICB9XG4gICAgYml0cyA9IHNpemUgLSBiaXRzO1xuICAgIGlmIChiaXRzID4gMCkge1xuICAgICAgcmV0dXJuIHZhbHUgPDwgYml0cyB8IHRoaXMucmVhZEJpdHMoYml0cyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB2YWx1O1xuICAgIH1cbiAgfVxuXG4gIC8vICgpOnVpbnRcbiAgc2tpcExaKCkge1xuICAgIHZhciBsZWFkaW5nWmVyb0NvdW50OyAvLyA6dWludFxuICAgIGZvciAobGVhZGluZ1plcm9Db3VudCA9IDA7IGxlYWRpbmdaZXJvQ291bnQgPCB0aGlzLmJpdHNBdmFpbGFibGU7ICsrbGVhZGluZ1plcm9Db3VudCkge1xuICAgICAgaWYgKDAgIT09ICh0aGlzLndvcmQgJiAoMHg4MDAwMDAwMCA+Pj4gbGVhZGluZ1plcm9Db3VudCkpKSB7XG4gICAgICAgIC8vIHRoZSBmaXJzdCBiaXQgb2Ygd29ya2luZyB3b3JkIGlzIDFcbiAgICAgICAgdGhpcy53b3JkIDw8PSBsZWFkaW5nWmVyb0NvdW50O1xuICAgICAgICB0aGlzLmJpdHNBdmFpbGFibGUgLT0gbGVhZGluZ1plcm9Db3VudDtcbiAgICAgICAgcmV0dXJuIGxlYWRpbmdaZXJvQ291bnQ7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIHdlIGV4aGF1c3RlZCB3b3JkIGFuZCBzdGlsbCBoYXZlIG5vdCBmb3VuZCBhIDFcbiAgICB0aGlzLmxvYWRXb3JkKCk7XG4gICAgcmV0dXJuIGxlYWRpbmdaZXJvQ291bnQgKyB0aGlzLnNraXBMWigpO1xuICB9XG5cbiAgLy8gKCk6dm9pZFxuICBza2lwVUVHKCkge1xuICAgIHRoaXMuc2tpcEJpdHMoMSArIHRoaXMuc2tpcExaKCkpO1xuICB9XG5cbiAgLy8gKCk6dm9pZFxuICBza2lwRUcoKSB7XG4gICAgdGhpcy5za2lwQml0cygxICsgdGhpcy5za2lwTFooKSk7XG4gIH1cblxuICAvLyAoKTp1aW50XG4gIHJlYWRVRUcoKSB7XG4gICAgdmFyIGNseiA9IHRoaXMuc2tpcExaKCk7IC8vIDp1aW50XG4gICAgcmV0dXJuIHRoaXMucmVhZEJpdHMoY2x6ICsgMSkgLSAxO1xuICB9XG5cbiAgLy8gKCk6aW50XG4gIHJlYWRFRygpIHtcbiAgICB2YXIgdmFsdSA9IHRoaXMucmVhZFVFRygpOyAvLyA6aW50XG4gICAgaWYgKDB4MDEgJiB2YWx1KSB7XG4gICAgICAvLyB0aGUgbnVtYmVyIGlzIG9kZCBpZiB0aGUgbG93IG9yZGVyIGJpdCBpcyBzZXRcbiAgICAgIHJldHVybiAoMSArIHZhbHUpID4+PiAxOyAvLyBhZGQgMSB0byBtYWtlIGl0IGV2ZW4sIGFuZCBkaXZpZGUgYnkgMlxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gLTEgKiAodmFsdSA+Pj4gMSk7IC8vIGRpdmlkZSBieSB0d28gdGhlbiBtYWtlIGl0IG5lZ2F0aXZlXG4gICAgfVxuICB9XG5cbiAgLy8gU29tZSBjb252ZW5pZW5jZSBmdW5jdGlvbnNcbiAgLy8gOkJvb2xlYW5cbiAgcmVhZEJvb2xlYW4oKSB7XG4gICAgcmV0dXJuIDEgPT09IHRoaXMucmVhZEJpdHMoMSk7XG4gIH1cblxuICAvLyAoKTppbnRcbiAgcmVhZFVCeXRlKCkge1xuICAgIHJldHVybiB0aGlzLnJlYWRCaXRzKDgpO1xuICB9XG5cbiAgLy8gKCk6aW50XG4gIHJlYWRVU2hvcnQoKSB7XG4gICAgcmV0dXJuIHRoaXMucmVhZEJpdHMoMTYpO1xuICB9XG4gICAgLy8gKCk6aW50XG4gIHJlYWRVSW50KCkge1xuICAgIHJldHVybiB0aGlzLnJlYWRCaXRzKDMyKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZHZhbmNlIHRoZSBFeHBHb2xvbWIgZGVjb2RlciBwYXN0IGEgc2NhbGluZyBsaXN0LiBUaGUgc2NhbGluZ1xuICAgKiBsaXN0IGlzIG9wdGlvbmFsbHkgdHJhbnNtaXR0ZWQgYXMgcGFydCBvZiBhIHNlcXVlbmNlIHBhcmFtZXRlclxuICAgKiBzZXQgYW5kIGlzIG5vdCByZWxldmFudCB0byB0cmFuc211eGluZy5cbiAgICogQHBhcmFtIGNvdW50IHtudW1iZXJ9IHRoZSBudW1iZXIgb2YgZW50cmllcyBpbiB0aGlzIHNjYWxpbmcgbGlzdFxuICAgKiBAc2VlIFJlY29tbWVuZGF0aW9uIElUVS1UIEguMjY0LCBTZWN0aW9uIDcuMy4yLjEuMS4xXG4gICAqL1xuICBza2lwU2NhbGluZ0xpc3QoY291bnQpIHtcbiAgICB2YXJcbiAgICAgIGxhc3RTY2FsZSA9IDgsXG4gICAgICBuZXh0U2NhbGUgPSA4LFxuICAgICAgaixcbiAgICAgIGRlbHRhU2NhbGU7XG4gICAgZm9yIChqID0gMDsgaiA8IGNvdW50OyBqKyspIHtcbiAgICAgIGlmIChuZXh0U2NhbGUgIT09IDApIHtcbiAgICAgICAgZGVsdGFTY2FsZSA9IHRoaXMucmVhZEVHKCk7XG4gICAgICAgIG5leHRTY2FsZSA9IChsYXN0U2NhbGUgKyBkZWx0YVNjYWxlICsgMjU2KSAlIDI1NjtcbiAgICAgIH1cbiAgICAgIGxhc3RTY2FsZSA9IChuZXh0U2NhbGUgPT09IDApID8gbGFzdFNjYWxlIDogbmV4dFNjYWxlO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZWFkIGEgc2VxdWVuY2UgcGFyYW1ldGVyIHNldCBhbmQgcmV0dXJuIHNvbWUgaW50ZXJlc3RpbmcgdmlkZW9cbiAgICogcHJvcGVydGllcy4gQSBzZXF1ZW5jZSBwYXJhbWV0ZXIgc2V0IGlzIHRoZSBIMjY0IG1ldGFkYXRhIHRoYXRcbiAgICogZGVzY3JpYmVzIHRoZSBwcm9wZXJ0aWVzIG9mIHVwY29taW5nIHZpZGVvIGZyYW1lcy5cbiAgICogQHBhcmFtIGRhdGEge1VpbnQ4QXJyYXl9IHRoZSBieXRlcyBvZiBhIHNlcXVlbmNlIHBhcmFtZXRlciBzZXRcbiAgICogQHJldHVybiB7b2JqZWN0fSBhbiBvYmplY3Qgd2l0aCBjb25maWd1cmF0aW9uIHBhcnNlZCBmcm9tIHRoZVxuICAgKiBzZXF1ZW5jZSBwYXJhbWV0ZXIgc2V0LCBpbmNsdWRpbmcgdGhlIGRpbWVuc2lvbnMgb2YgdGhlXG4gICAqIGFzc29jaWF0ZWQgdmlkZW8gZnJhbWVzLlxuICAgKi9cbiAgcmVhZFNQUygpIHtcbiAgICB2YXJcbiAgICAgIGZyYW1lQ3JvcExlZnRPZmZzZXQgPSAwLFxuICAgICAgZnJhbWVDcm9wUmlnaHRPZmZzZXQgPSAwLFxuICAgICAgZnJhbWVDcm9wVG9wT2Zmc2V0ID0gMCxcbiAgICAgIGZyYW1lQ3JvcEJvdHRvbU9mZnNldCA9IDAsXG4gICAgICBzYXJTY2FsZSA9IDEsXG4gICAgICBwcm9maWxlSWRjLHByb2ZpbGVDb21wYXQsbGV2ZWxJZGMsXG4gICAgICBudW1SZWZGcmFtZXNJblBpY09yZGVyQ250Q3ljbGUsIHBpY1dpZHRoSW5NYnNNaW51czEsXG4gICAgICBwaWNIZWlnaHRJbk1hcFVuaXRzTWludXMxLFxuICAgICAgZnJhbWVNYnNPbmx5RmxhZyxcbiAgICAgIHNjYWxpbmdMaXN0Q291bnQsXG4gICAgICBpO1xuICAgIHRoaXMucmVhZFVCeXRlKCk7XG4gICAgcHJvZmlsZUlkYyA9IHRoaXMucmVhZFVCeXRlKCk7IC8vIHByb2ZpbGVfaWRjXG4gICAgcHJvZmlsZUNvbXBhdCA9IHRoaXMucmVhZEJpdHMoNSk7IC8vIGNvbnN0cmFpbnRfc2V0WzAtNF1fZmxhZywgdSg1KVxuICAgIHRoaXMuc2tpcEJpdHMoMyk7IC8vIHJlc2VydmVkX3plcm9fM2JpdHMgdSgzKSxcbiAgICBsZXZlbElkYyA9IHRoaXMucmVhZFVCeXRlKCk7IC8vbGV2ZWxfaWRjIHUoOClcbiAgICB0aGlzLnNraXBVRUcoKTsgLy8gc2VxX3BhcmFtZXRlcl9zZXRfaWRcbiAgICAvLyBzb21lIHByb2ZpbGVzIGhhdmUgbW9yZSBvcHRpb25hbCBkYXRhIHdlIGRvbid0IG5lZWRcbiAgICBpZiAocHJvZmlsZUlkYyA9PT0gMTAwIHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDExMCB8fFxuICAgICAgICBwcm9maWxlSWRjID09PSAxMjIgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gMTQ0KSB7XG4gICAgICB2YXIgY2hyb21hRm9ybWF0SWRjID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgICBpZiAoY2hyb21hRm9ybWF0SWRjID09PSAzKSB7XG4gICAgICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIHNlcGFyYXRlX2NvbG91cl9wbGFuZV9mbGFnXG4gICAgICB9XG4gICAgICB0aGlzLnNraXBVRUcoKTsgLy8gYml0X2RlcHRoX2x1bWFfbWludXM4XG4gICAgICB0aGlzLnNraXBVRUcoKTsgLy8gYml0X2RlcHRoX2Nocm9tYV9taW51czhcbiAgICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIHFwcHJpbWVfeV96ZXJvX3RyYW5zZm9ybV9ieXBhc3NfZmxhZ1xuICAgICAgaWYgKHRoaXMucmVhZEJvb2xlYW4oKSkgeyAvLyBzZXFfc2NhbGluZ19tYXRyaXhfcHJlc2VudF9mbGFnXG4gICAgICAgIHNjYWxpbmdMaXN0Q291bnQgPSAoY2hyb21hRm9ybWF0SWRjICE9PSAzKSA/IDggOiAxMjtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHNjYWxpbmdMaXN0Q291bnQ7IGkrKykge1xuICAgICAgICAgIGlmICh0aGlzLnJlYWRCb29sZWFuKCkpIHsgLy8gc2VxX3NjYWxpbmdfbGlzdF9wcmVzZW50X2ZsYWdbIGkgXVxuICAgICAgICAgICAgaWYgKGkgPCA2KSB7XG4gICAgICAgICAgICAgIHRoaXMuc2tpcFNjYWxpbmdMaXN0KDE2KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHRoaXMuc2tpcFNjYWxpbmdMaXN0KDY0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5za2lwVUVHKCk7IC8vIGxvZzJfbWF4X2ZyYW1lX251bV9taW51czRcbiAgICB2YXIgcGljT3JkZXJDbnRUeXBlID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgaWYgKHBpY09yZGVyQ250VHlwZSA9PT0gMCkge1xuICAgICAgdGhpcy5yZWFkVUVHKCk7IC8vbG9nMl9tYXhfcGljX29yZGVyX2NudF9sc2JfbWludXM0XG4gICAgfSBlbHNlIGlmIChwaWNPcmRlckNudFR5cGUgPT09IDEpIHtcbiAgICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIGRlbHRhX3BpY19vcmRlcl9hbHdheXNfemVyb19mbGFnXG4gICAgICB0aGlzLnNraXBFRygpOyAvLyBvZmZzZXRfZm9yX25vbl9yZWZfcGljXG4gICAgICB0aGlzLnNraXBFRygpOyAvLyBvZmZzZXRfZm9yX3RvcF90b19ib3R0b21fZmllbGRcbiAgICAgIG51bVJlZkZyYW1lc0luUGljT3JkZXJDbnRDeWNsZSA9IHRoaXMucmVhZFVFRygpO1xuICAgICAgZm9yKGkgPSAwOyBpIDwgbnVtUmVmRnJhbWVzSW5QaWNPcmRlckNudEN5Y2xlOyBpKyspIHtcbiAgICAgICAgdGhpcy5za2lwRUcoKTsgLy8gb2Zmc2V0X2Zvcl9yZWZfZnJhbWVbIGkgXVxuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLnNraXBVRUcoKTsgLy8gbWF4X251bV9yZWZfZnJhbWVzXG4gICAgdGhpcy5za2lwQml0cygxKTsgLy8gZ2Fwc19pbl9mcmFtZV9udW1fdmFsdWVfYWxsb3dlZF9mbGFnXG4gICAgcGljV2lkdGhJbk1ic01pbnVzMSA9IHRoaXMucmVhZFVFRygpO1xuICAgIHBpY0hlaWdodEluTWFwVW5pdHNNaW51czEgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICBmcmFtZU1ic09ubHlGbGFnID0gdGhpcy5yZWFkQml0cygxKTtcbiAgICBpZiAoZnJhbWVNYnNPbmx5RmxhZyA9PT0gMCkge1xuICAgICAgdGhpcy5za2lwQml0cygxKTsgLy8gbWJfYWRhcHRpdmVfZnJhbWVfZmllbGRfZmxhZ1xuICAgIH1cbiAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBkaXJlY3RfOHg4X2luZmVyZW5jZV9mbGFnXG4gICAgaWYgKHRoaXMucmVhZEJvb2xlYW4oKSkgeyAvLyBmcmFtZV9jcm9wcGluZ19mbGFnXG4gICAgICBmcmFtZUNyb3BMZWZ0T2Zmc2V0ID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgICBmcmFtZUNyb3BSaWdodE9mZnNldCA9IHRoaXMucmVhZFVFRygpO1xuICAgICAgZnJhbWVDcm9wVG9wT2Zmc2V0ID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgICBmcmFtZUNyb3BCb3R0b21PZmZzZXQgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICB9XG4gICAgaWYgKHRoaXMucmVhZEJvb2xlYW4oKSkge1xuICAgICAgLy8gdnVpX3BhcmFtZXRlcnNfcHJlc2VudF9mbGFnXG4gICAgICBpZiAodGhpcy5yZWFkQm9vbGVhbigpKSB7XG4gICAgICAgIC8vIGFzcGVjdF9yYXRpb19pbmZvX3ByZXNlbnRfZmxhZ1xuICAgICAgICBsZXQgc2FyUmF0aW87XG4gICAgICAgIGNvbnN0IGFzcGVjdFJhdGlvSWRjID0gdGhpcy5yZWFkVUJ5dGUoKTtcbiAgICAgICAgc3dpdGNoIChhc3BlY3RSYXRpb0lkYykge1xuICAgICAgICAgIC8vY2FzZSAxOiBzYXJSYXRpbyA9IFsxLDFdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDI6IHNhclJhdGlvID0gWzEyLDExXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSAzOiBzYXJSYXRpbyA9IFsxMCwxMV07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgNDogc2FyUmF0aW8gPSBbMTYsMTFdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDU6IHNhclJhdGlvID0gWzQwLDMzXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSA2OiBzYXJSYXRpbyA9IFsyNCwxMV07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgNzogc2FyUmF0aW8gPSBbMjAsMTFdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDg6IHNhclJhdGlvID0gWzMyLDExXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSA5OiBzYXJSYXRpbyA9IFs4MCwzM107IGJyZWFrO1xuICAgICAgICAgIGNhc2UgMTA6IHNhclJhdGlvID0gWzE4LDExXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSAxMTogc2FyUmF0aW8gPSBbMTUsMTFdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDEyOiBzYXJSYXRpbyA9IFs2NCwzM107IGJyZWFrO1xuICAgICAgICAgIGNhc2UgMTM6IHNhclJhdGlvID0gWzE2MCw5OV07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgMTQ6IHNhclJhdGlvID0gWzQsM107IGJyZWFrO1xuICAgICAgICAgIGNhc2UgMTU6IHNhclJhdGlvID0gWzMsMl07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgMTY6IHNhclJhdGlvID0gWzIsMV07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgMjU1OiB7XG4gICAgICAgICAgICBzYXJSYXRpbyA9IFt0aGlzLnJlYWRVQnl0ZSgpIDw8IDggfCB0aGlzLnJlYWRVQnl0ZSgpLCB0aGlzLnJlYWRVQnl0ZSgpIDw8IDggfCB0aGlzLnJlYWRVQnl0ZSgpXTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoc2FyUmF0aW8pIHtcbiAgICAgICAgICBzYXJTY2FsZSA9IHNhclJhdGlvWzBdIC8gc2FyUmF0aW9bMV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIHdpZHRoOiAoKChwaWNXaWR0aEluTWJzTWludXMxICsgMSkgKiAxNikgLSBmcmFtZUNyb3BMZWZ0T2Zmc2V0ICogMiAtIGZyYW1lQ3JvcFJpZ2h0T2Zmc2V0ICogMikgKiBzYXJTY2FsZSxcbiAgICAgIGhlaWdodDogKCgyIC0gZnJhbWVNYnNPbmx5RmxhZykgKiAocGljSGVpZ2h0SW5NYXBVbml0c01pbnVzMSArIDEpICogMTYpIC0gKChmcmFtZU1ic09ubHlGbGFnPyAyIDogNCkgKiAoZnJhbWVDcm9wVG9wT2Zmc2V0ICsgZnJhbWVDcm9wQm90dG9tT2Zmc2V0KSlcbiAgICB9O1xuICB9XG5cbiAgcmVhZFNsaWNlVHlwZSgpIHtcbiAgICAvLyBza2lwIE5BTHUgdHlwZVxuICAgIHRoaXMucmVhZFVCeXRlKCk7XG4gICAgLy8gZGlzY2FyZCBmaXJzdF9tYl9pbl9zbGljZVxuICAgIHRoaXMucmVhZFVFRygpO1xuICAgIC8vIHJldHVybiBzbGljZV90eXBlXG4gICAgcmV0dXJuIHRoaXMucmVhZFVFRygpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEV4cEdvbG9tYjtcbiIsIi8qKlxuICogSUQzIHBhcnNlclxuICovXG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbi8vaW1wb3J0IEhleCBmcm9tICcuLi91dGlscy9oZXgnO1xuXG4gY2xhc3MgSUQzIHtcblxuICBjb25zdHJ1Y3RvcihkYXRhKSB7XG4gICAgdGhpcy5faGFzVGltZVN0YW1wID0gZmFsc2U7XG4gICAgdmFyIG9mZnNldCA9IDAsIGJ5dGUxLGJ5dGUyLGJ5dGUzLGJ5dGU0LHRhZ1NpemUsZW5kUG9zLGhlYWRlcixsZW47XG4gICAgICBkbyB7XG4gICAgICAgIGhlYWRlciA9IHRoaXMucmVhZFVURihkYXRhLG9mZnNldCwzKTtcbiAgICAgICAgb2Zmc2V0Kz0zO1xuICAgICAgICAgIC8vIGZpcnN0IGNoZWNrIGZvciBJRDMgaGVhZGVyXG4gICAgICAgICAgaWYgKGhlYWRlciA9PT0gJ0lEMycpIHtcbiAgICAgICAgICAgICAgLy8gc2tpcCAyNCBiaXRzXG4gICAgICAgICAgICAgIG9mZnNldCArPSAzO1xuICAgICAgICAgICAgICAvLyByZXRyaWV2ZSB0YWcocykgbGVuZ3RoXG4gICAgICAgICAgICAgIGJ5dGUxID0gZGF0YVtvZmZzZXQrK10gJiAweDdmO1xuICAgICAgICAgICAgICBieXRlMiA9IGRhdGFbb2Zmc2V0KytdICYgMHg3ZjtcbiAgICAgICAgICAgICAgYnl0ZTMgPSBkYXRhW29mZnNldCsrXSAmIDB4N2Y7XG4gICAgICAgICAgICAgIGJ5dGU0ID0gZGF0YVtvZmZzZXQrK10gJiAweDdmO1xuICAgICAgICAgICAgICB0YWdTaXplID0gKGJ5dGUxIDw8IDIxKSArIChieXRlMiA8PCAxNCkgKyAoYnl0ZTMgPDwgNykgKyBieXRlNDtcbiAgICAgICAgICAgICAgZW5kUG9zID0gb2Zmc2V0ICsgdGFnU2l6ZTtcbiAgICAgICAgICAgICAgLy9sb2dnZXIubG9nKGBJRDMgdGFnIGZvdW5kLCBzaXplL2VuZDogJHt0YWdTaXplfS8ke2VuZFBvc31gKTtcblxuICAgICAgICAgICAgICAvLyByZWFkIElEMyB0YWdzXG4gICAgICAgICAgICAgIHRoaXMuX3BhcnNlSUQzRnJhbWVzKGRhdGEsIG9mZnNldCxlbmRQb3MpO1xuICAgICAgICAgICAgICBvZmZzZXQgPSBlbmRQb3M7XG4gICAgICAgICAgfSBlbHNlIGlmIChoZWFkZXIgPT09ICczREknKSB7XG4gICAgICAgICAgICAgIC8vIGh0dHA6Ly9pZDMub3JnL2lkM3YyLjQuMC1zdHJ1Y3R1cmUgY2hhcHRlciAzLjQuICAgSUQzdjIgZm9vdGVyXG4gICAgICAgICAgICAgIG9mZnNldCArPSA3O1xuICAgICAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgM0RJIGZvb3RlciBmb3VuZCwgZW5kOiAke29mZnNldH1gKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBvZmZzZXQgLT0gMztcbiAgICAgICAgICAgICAgbGVuID0gb2Zmc2V0O1xuICAgICAgICAgICAgICAgICAgaWYgKGxlbikge1xuICAgICAgICAgICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZyhgSUQzIGxlbjogJHtsZW59YCk7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLmhhc1RpbWVTdGFtcCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBsb2dnZXIud2FybignSUQzIHRhZyBmb3VuZCwgYnV0IG5vIHRpbWVzdGFtcCcpO1xuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9sZW5ndGggPSBsZW47XG4gICAgICAgICAgICAgICAgICAgICAgdGhpcy5fcGF5bG9hZCA9IGRhdGEuc3ViYXJyYXkoMCxsZW4pO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgfSB3aGlsZSAodHJ1ZSk7XG4gIH1cblxuICByZWFkVVRGKGRhdGEsc3RhcnQsbGVuKSB7XG5cbiAgICB2YXIgcmVzdWx0ID0gJycsb2Zmc2V0ID0gc3RhcnQsIGVuZCA9IHN0YXJ0ICsgbGVuO1xuICAgIGRvIHtcbiAgICAgIHJlc3VsdCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGRhdGFbb2Zmc2V0KytdKTtcbiAgICB9IHdoaWxlKG9mZnNldCA8IGVuZCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIF9wYXJzZUlEM0ZyYW1lcyhkYXRhLG9mZnNldCxlbmRQb3MpIHtcbiAgICB2YXIgdGFnSWQsdGFnTGVuLHRhZ1N0YXJ0LHRhZ0ZsYWdzLHRpbWVzdGFtcDtcbiAgICB3aGlsZShvZmZzZXQgKyA4IDw9IGVuZFBvcykge1xuICAgICAgdGFnSWQgPSB0aGlzLnJlYWRVVEYoZGF0YSxvZmZzZXQsNCk7XG4gICAgICBvZmZzZXQgKz00O1xuXG4gICAgICB0YWdMZW4gPSBkYXRhW29mZnNldCsrXSA8PCAyNCArXG4gICAgICAgICAgICAgICAgZGF0YVtvZmZzZXQrK10gPDwgMTYgK1xuICAgICAgICAgICAgICAgIGRhdGFbb2Zmc2V0KytdIDw8IDggK1xuICAgICAgICAgICAgICAgIGRhdGFbb2Zmc2V0KytdO1xuXG4gICAgICB0YWdGbGFncyA9IGRhdGFbb2Zmc2V0KytdIDw8IDggK1xuICAgICAgICAgICAgICAgICAgZGF0YVtvZmZzZXQrK107XG5cbiAgICAgIHRhZ1N0YXJ0ID0gb2Zmc2V0O1xuICAgICAgLy9sb2dnZXIubG9nKFwiSUQzIHRhZyBpZDpcIiArIHRhZ0lkKTtcbiAgICAgIHN3aXRjaCh0YWdJZCkge1xuICAgICAgICBjYXNlICdQUklWJzpcbiAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygncGFyc2UgZnJhbWU6JyArIEhleC5oZXhEdW1wKGRhdGEuc3ViYXJyYXkob2Zmc2V0LGVuZFBvcykpKTtcbiAgICAgICAgICAgIC8vIG93bmVyIHNob3VsZCBiZSBcImNvbS5hcHBsZS5zdHJlYW1pbmcudHJhbnNwb3J0U3RyZWFtVGltZXN0YW1wXCJcbiAgICAgICAgICAgIGlmICh0aGlzLnJlYWRVVEYoZGF0YSxvZmZzZXQsNDQpID09PSAnY29tLmFwcGxlLnN0cmVhbWluZy50cmFuc3BvcnRTdHJlYW1UaW1lc3RhbXAnKSB7XG4gICAgICAgICAgICAgICAgb2Zmc2V0Kz00NDtcbiAgICAgICAgICAgICAgICAvLyBzbWVsbGluZyBldmVuIGJldHRlciAhIHdlIGZvdW5kIHRoZSByaWdodCBkZXNjcmlwdG9yXG4gICAgICAgICAgICAgICAgLy8gc2tpcCBudWxsIGNoYXJhY3RlciAoc3RyaW5nIGVuZCkgKyAzIGZpcnN0IGJ5dGVzXG4gICAgICAgICAgICAgICAgb2Zmc2V0Kz0gNDtcblxuICAgICAgICAgICAgICAgIC8vIHRpbWVzdGFtcCBpcyAzMyBiaXQgZXhwcmVzc2VkIGFzIGEgYmlnLWVuZGlhbiBlaWdodC1vY3RldCBudW1iZXIsIHdpdGggdGhlIHVwcGVyIDMxIGJpdHMgc2V0IHRvIHplcm8uXG4gICAgICAgICAgICAgICAgdmFyIHB0czMzQml0ICA9IGRhdGFbb2Zmc2V0KytdICYgMHgxO1xuICAgICAgICAgICAgICAgIHRoaXMuX2hhc1RpbWVTdGFtcCA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICB0aW1lc3RhbXAgPSAoKGRhdGFbb2Zmc2V0KytdIDw8IDIzKSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIChkYXRhW29mZnNldCsrXSA8PCAxNSkgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoZGF0YVtvZmZzZXQrK10gPDwgIDcpICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YVtvZmZzZXQrK10pIC80NTtcblxuICAgICAgICAgICAgICAgIGlmIChwdHMzM0JpdCkge1xuICAgICAgICAgICAgICAgICAgICB0aW1lc3RhbXAgICArPSA0NzcyMTg1OC44NDsgLy8gMl4zMiAvIDkwXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRpbWVzdGFtcCA9IE1hdGgucm91bmQodGltZXN0YW1wKTtcbiAgICAgICAgICAgICAgICBsb2dnZXIudHJhY2UoYElEMyB0aW1lc3RhbXAgZm91bmQ6ICR7dGltZXN0YW1wfWApO1xuICAgICAgICAgICAgICAgIHRoaXMuX3RpbWVTdGFtcCA9IHRpbWVzdGFtcDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZ2V0IGhhc1RpbWVTdGFtcCgpIHtcbiAgICByZXR1cm4gdGhpcy5faGFzVGltZVN0YW1wO1xuICB9XG5cbiAgZ2V0IHRpbWVTdGFtcCgpIHtcbiAgICByZXR1cm4gdGhpcy5fdGltZVN0YW1wO1xuICB9XG5cbiAgZ2V0IGxlbmd0aCgpIHtcbiAgICByZXR1cm4gdGhpcy5fbGVuZ3RoO1xuICB9XG5cbiAgZ2V0IHBheWxvYWQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3BheWxvYWQ7XG4gIH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBJRDM7XG5cbiIsIi8qKlxuICogaGlnaGx5IG9wdGltaXplZCBUUyBkZW11eGVyOlxuICogcGFyc2UgUEFULCBQTVRcbiAqIGV4dHJhY3QgUEVTIHBhY2tldCBmcm9tIGF1ZGlvIGFuZCB2aWRlbyBQSURzXG4gKiBleHRyYWN0IEFWQy9IMjY0IE5BTCB1bml0cyBhbmQgQUFDL0FEVFMgc2FtcGxlcyBmcm9tIFBFUyBwYWNrZXRcbiAqIHRyaWdnZXIgdGhlIHJlbXV4ZXIgdXBvbiBwYXJzaW5nIGNvbXBsZXRpb25cbiAqIGl0IGFsc28gdHJpZXMgdG8gd29ya2Fyb3VuZCBhcyBiZXN0IGFzIGl0IGNhbiBhdWRpbyBjb2RlYyBzd2l0Y2ggKEhFLUFBQyB0byBBQUMgYW5kIHZpY2UgdmVyc2EpLCB3aXRob3V0IGhhdmluZyB0byByZXN0YXJ0IHRoZSBNZWRpYVNvdXJjZS5cbiAqIGl0IGFsc28gY29udHJvbHMgdGhlIHJlbXV4aW5nIHByb2Nlc3MgOlxuICogdXBvbiBkaXNjb250aW51aXR5IG9yIGxldmVsIHN3aXRjaCBkZXRlY3Rpb24sIGl0IHdpbGwgYWxzbyBub3RpZmllcyB0aGUgcmVtdXhlciBzbyB0aGF0IGl0IGNhbiByZXNldCBpdHMgc3RhdGUuXG4qL1xuXG4gaW1wb3J0IEFEVFMgZnJvbSAnLi9hZHRzJztcbiBpbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbiBpbXBvcnQgRXhwR29sb21iIGZyb20gJy4vZXhwLWdvbG9tYic7XG4vLyBpbXBvcnQgSGV4IGZyb20gJy4uL3V0aWxzL2hleCc7XG4gaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG4gaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5cbiBjbGFzcyBUU0RlbXV4ZXIge1xuXG4gIGNvbnN0cnVjdG9yKG9ic2VydmVyLHJlbXV4ZXJDbGFzcykge1xuICAgIHRoaXMub2JzZXJ2ZXIgPSBvYnNlcnZlcjtcbiAgICB0aGlzLnJlbXV4ZXJDbGFzcyA9IHJlbXV4ZXJDbGFzcztcbiAgICB0aGlzLmxhc3RDQyA9IDA7XG4gICAgdGhpcy5yZW11eGVyID0gbmV3IHRoaXMucmVtdXhlckNsYXNzKG9ic2VydmVyKTtcbiAgICB0aGlzLl91c2VyRGF0YSA9IFtdO1xuICB9XG5cbiAgc3RhdGljIHByb2JlKGRhdGEpIHtcbiAgICAvLyBhIFRTIGZyYWdtZW50IHNob3VsZCBjb250YWluIGF0IGxlYXN0IDMgVFMgcGFja2V0cywgYSBQQVQsIGEgUE1ULCBhbmQgb25lIFBJRCwgZWFjaCBzdGFydGluZyB3aXRoIDB4NDdcbiAgICBpZiAoZGF0YS5sZW5ndGggPj0gMyoxODggJiYgZGF0YVswXSA9PT0gMHg0NyAmJiBkYXRhWzE4OF0gPT09IDB4NDcgJiYgZGF0YVsyKjE4OF0gPT09IDB4NDcpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgc3dpdGNoTGV2ZWwoKSB7XG4gICAgdGhpcy5wbXRQYXJzZWQgPSBmYWxzZTtcbiAgICB0aGlzLl9wbXRJZCA9IC0xO1xuICAgIHRoaXMuX2F2Y1RyYWNrID0ge3R5cGU6ICd2aWRlbycsIGlkIDotMSwgc2VxdWVuY2VOdW1iZXI6IDAsIHNhbXBsZXMgOiBbXSwgbGVuIDogMCwgbmJOYWx1IDogMH07XG4gICAgdGhpcy5fYWFjVHJhY2sgPSB7dHlwZTogJ2F1ZGlvJywgaWQgOi0xLCBzZXF1ZW5jZU51bWJlcjogMCwgc2FtcGxlcyA6IFtdLCBsZW4gOiAwfTtcbiAgICB0aGlzLl9pZDNUcmFjayA9IHt0eXBlOiAnaWQzJywgaWQgOi0xLCBzZXF1ZW5jZU51bWJlcjogMCwgc2FtcGxlcyA6IFtdLCBsZW4gOiAwfTtcbiAgICB0aGlzLl90eHRUcmFjayA9IHt0eXBlOiAndGV4dCcsIGlkOiAtMSwgc2VxdWVuY2VOdW1iZXI6IDAsIHNhbXBsZXM6IFtdLCBsZW46IDB9XG4gICAgdGhpcy5yZW11eGVyLnN3aXRjaExldmVsKCk7XG4gIH1cblxuICBpbnNlcnREaXNjb250aW51aXR5KCkge1xuICAgIHRoaXMuc3dpdGNoTGV2ZWwoKTtcbiAgICB0aGlzLnJlbXV4ZXIuaW5zZXJ0RGlzY29udGludWl0eSgpO1xuICB9XG5cbiAgLy8gZmVlZCBpbmNvbWluZyBkYXRhIHRvIHRoZSBmcm9udCBvZiB0aGUgcGFyc2luZyBwaXBlbGluZVxuICBwdXNoKGRhdGEsIGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQsIGNjLCBsZXZlbCwgc24sIGR1cmF0aW9uKSB7XG4gICAgdmFyIGF2Y0RhdGEsIGFhY0RhdGEsIGlkM0RhdGEsXG4gICAgICAgIHN0YXJ0LCBsZW4gPSBkYXRhLmxlbmd0aCwgc3R0LCBwaWQsIGF0Ziwgb2Zmc2V0O1xuICAgIHRoaXMuYXVkaW9Db2RlYyA9IGF1ZGlvQ29kZWM7XG4gICAgdGhpcy52aWRlb0NvZGVjID0gdmlkZW9Db2RlYztcbiAgICB0aGlzLnRpbWVPZmZzZXQgPSB0aW1lT2Zmc2V0O1xuICAgIHRoaXMuX2R1cmF0aW9uID0gZHVyYXRpb247XG4gICAgdGhpcy5jb250aWd1b3VzID0gZmFsc2U7XG4gICAgaWYgKGNjICE9PSB0aGlzLmxhc3RDQykge1xuICAgICAgbG9nZ2VyLmxvZygnZGlzY29udGludWl0eSBkZXRlY3RlZCcpO1xuICAgICAgdGhpcy5pbnNlcnREaXNjb250aW51aXR5KCk7XG4gICAgICB0aGlzLmxhc3RDQyA9IGNjO1xuICAgIH0gZWxzZSBpZiAobGV2ZWwgIT09IHRoaXMubGFzdExldmVsKSB7XG4gICAgICBsb2dnZXIubG9nKCdsZXZlbCBzd2l0Y2ggZGV0ZWN0ZWQnKTtcbiAgICAgIHRoaXMuc3dpdGNoTGV2ZWwoKTtcbiAgICAgIHRoaXMubGFzdExldmVsID0gbGV2ZWw7XG4gICAgfSBlbHNlIGlmIChzbiA9PT0gKHRoaXMubGFzdFNOKzEpKSB7XG4gICAgICB0aGlzLmNvbnRpZ3VvdXMgPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLmxhc3RTTiA9IHNuO1xuXG4gICAgaWYoIXRoaXMuY29udGlndW91cykge1xuICAgICAgLy8gZmx1c2ggYW55IHBhcnRpYWwgY29udGVudFxuICAgICAgdGhpcy5hYWNPdmVyRmxvdyA9IG51bGw7XG4gICAgfVxuXG4gICAgdmFyIHBtdFBhcnNlZCA9IHRoaXMucG10UGFyc2VkLFxuICAgICAgICBhdmNJZCA9IHRoaXMuX2F2Y1RyYWNrLmlkLFxuICAgICAgICBhYWNJZCA9IHRoaXMuX2FhY1RyYWNrLmlkLFxuICAgICAgICBpZDNJZCA9IHRoaXMuX2lkM1RyYWNrLmlkO1xuICAgIC8vIGxvb3AgdGhyb3VnaCBUUyBwYWNrZXRzXG4gICAgZm9yIChzdGFydCA9IDA7IHN0YXJ0IDwgbGVuOyBzdGFydCArPSAxODgpIHtcbiAgICAgIGlmIChkYXRhW3N0YXJ0XSA9PT0gMHg0Nykge1xuICAgICAgICBzdHQgPSAhIShkYXRhW3N0YXJ0ICsgMV0gJiAweDQwKTtcbiAgICAgICAgLy8gcGlkIGlzIGEgMTMtYml0IGZpZWxkIHN0YXJ0aW5nIGF0IHRoZSBsYXN0IGJpdCBvZiBUU1sxXVxuICAgICAgICBwaWQgPSAoKGRhdGFbc3RhcnQgKyAxXSAmIDB4MWYpIDw8IDgpICsgZGF0YVtzdGFydCArIDJdO1xuICAgICAgICBhdGYgPSAoZGF0YVtzdGFydCArIDNdICYgMHgzMCkgPj4gNDtcbiAgICAgICAgLy8gaWYgYW4gYWRhcHRpb24gZmllbGQgaXMgcHJlc2VudCwgaXRzIGxlbmd0aCBpcyBzcGVjaWZpZWQgYnkgdGhlIGZpZnRoIGJ5dGUgb2YgdGhlIFRTIHBhY2tldCBoZWFkZXIuXG4gICAgICAgIGlmIChhdGYgPiAxKSB7XG4gICAgICAgICAgb2Zmc2V0ID0gc3RhcnQgKyA1ICsgZGF0YVtzdGFydCArIDRdO1xuICAgICAgICAgIC8vIGNvbnRpbnVlIGlmIHRoZXJlIGlzIG9ubHkgYWRhcHRhdGlvbiBmaWVsZFxuICAgICAgICAgIGlmIChvZmZzZXQgPT09IChzdGFydCArIDE4OCkpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBvZmZzZXQgPSBzdGFydCArIDQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHBtdFBhcnNlZCkge1xuICAgICAgICAgIGlmIChwaWQgPT09IGF2Y0lkKSB7XG4gICAgICAgICAgICBpZiAoc3R0KSB7XG4gICAgICAgICAgICAgIGlmIChhdmNEYXRhKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcGFyc2VBVkNQRVModGhpcy5fcGFyc2VQRVMoYXZjRGF0YSkpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGF2Y0RhdGEgPSB7ZGF0YTogW10sIHNpemU6IDB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGF2Y0RhdGEpIHtcbiAgICAgICAgICAgICAgYXZjRGF0YS5kYXRhLnB1c2goZGF0YS5zdWJhcnJheShvZmZzZXQsIHN0YXJ0ICsgMTg4KSk7XG4gICAgICAgICAgICAgIGF2Y0RhdGEuc2l6ZSArPSBzdGFydCArIDE4OCAtIG9mZnNldDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgaWYgKHBpZCA9PT0gYWFjSWQpIHtcbiAgICAgICAgICAgIGlmIChzdHQpIHtcbiAgICAgICAgICAgICAgaWYgKGFhY0RhdGEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9wYXJzZUFBQ1BFUyh0aGlzLl9wYXJzZVBFUyhhYWNEYXRhKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgYWFjRGF0YSA9IHtkYXRhOiBbXSwgc2l6ZTogMH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoYWFjRGF0YSkge1xuICAgICAgICAgICAgICBhYWNEYXRhLmRhdGEucHVzaChkYXRhLnN1YmFycmF5KG9mZnNldCwgc3RhcnQgKyAxODgpKTtcbiAgICAgICAgICAgICAgYWFjRGF0YS5zaXplICs9IHN0YXJ0ICsgMTg4IC0gb2Zmc2V0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSBpZiAocGlkID09PSBpZDNJZCkge1xuICAgICAgICAgICAgaWYgKHN0dCkge1xuICAgICAgICAgICAgICBpZiAoaWQzRGF0YSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3BhcnNlSUQzUEVTKHRoaXMuX3BhcnNlUEVTKGlkM0RhdGEpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZDNEYXRhID0ge2RhdGE6IFtdLCBzaXplOiAwfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChpZDNEYXRhKSB7XG4gICAgICAgICAgICAgIGlkM0RhdGEuZGF0YS5wdXNoKGRhdGEuc3ViYXJyYXkob2Zmc2V0LCBzdGFydCArIDE4OCkpO1xuICAgICAgICAgICAgICBpZDNEYXRhLnNpemUgKz0gc3RhcnQgKyAxODggLSBvZmZzZXQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmIChzdHQpIHtcbiAgICAgICAgICAgIG9mZnNldCArPSBkYXRhW29mZnNldF0gKyAxO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAocGlkID09PSAwKSB7XG4gICAgICAgICAgICB0aGlzLl9wYXJzZVBBVChkYXRhLCBvZmZzZXQpO1xuICAgICAgICAgIH0gZWxzZSBpZiAocGlkID09PSB0aGlzLl9wbXRJZCkge1xuICAgICAgICAgICAgdGhpcy5fcGFyc2VQTVQoZGF0YSwgb2Zmc2V0KTtcbiAgICAgICAgICAgIHBtdFBhcnNlZCA9IHRoaXMucG10UGFyc2VkID0gdHJ1ZTtcbiAgICAgICAgICAgIGF2Y0lkID0gdGhpcy5fYXZjVHJhY2suaWQ7XG4gICAgICAgICAgICBhYWNJZCA9IHRoaXMuX2FhY1RyYWNrLmlkO1xuICAgICAgICAgICAgaWQzSWQgPSB0aGlzLl9pZDNUcmFjay5pZDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMub2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGUgOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuRlJBR19QQVJTSU5HX0VSUk9SLCBmYXRhbDogZmFsc2UsIHJlYXNvbjogJ1RTIHBhY2tldCBkaWQgbm90IHN0YXJ0IHdpdGggMHg0Nyd9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gcGFyc2UgbGFzdCBQRVMgcGFja2V0XG4gICAgaWYgKGF2Y0RhdGEpIHtcbiAgICAgIHRoaXMuX3BhcnNlQVZDUEVTKHRoaXMuX3BhcnNlUEVTKGF2Y0RhdGEpKTtcbiAgICB9XG4gICAgaWYgKGFhY0RhdGEpIHtcbiAgICAgIHRoaXMuX3BhcnNlQUFDUEVTKHRoaXMuX3BhcnNlUEVTKGFhY0RhdGEpKTtcbiAgICB9XG4gICAgaWYgKGlkM0RhdGEpIHtcbiAgICAgIHRoaXMuX3BhcnNlSUQzUEVTKHRoaXMuX3BhcnNlUEVTKGlkM0RhdGEpKTtcbiAgICB9XG4gICAgdGhpcy5yZW11eCgpO1xuICB9XG5cbiAgcmVtdXgoKSB7XG4gICAgdGhpcy5yZW11eGVyLnJlbXV4KHRoaXMuX2FhY1RyYWNrLCB0aGlzLl9hdmNUcmFjaywgdGhpcy5faWQzVHJhY2ssIHRoaXMuX3R4dFRyYWNrLCB0aGlzLnRpbWVPZmZzZXQsIHRoaXMuY29udGlndW91cyk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIHRoaXMuc3dpdGNoTGV2ZWwoKTtcbiAgICB0aGlzLl9pbml0UFRTID0gdGhpcy5faW5pdERUUyA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLl9kdXJhdGlvbiA9IDA7XG4gIH1cblxuICBfcGFyc2VQQVQoZGF0YSwgb2Zmc2V0KSB7XG4gICAgLy8gc2tpcCB0aGUgUFNJIGhlYWRlciBhbmQgcGFyc2UgdGhlIGZpcnN0IFBNVCBlbnRyeVxuICAgIHRoaXMuX3BtdElkICA9IChkYXRhW29mZnNldCArIDEwXSAmIDB4MUYpIDw8IDggfCBkYXRhW29mZnNldCArIDExXTtcbiAgICAvL2xvZ2dlci5sb2coJ1BNVCBQSUQ6JyAgKyB0aGlzLl9wbXRJZCk7XG4gIH1cblxuICBfcGFyc2VQTVQoZGF0YSwgb2Zmc2V0KSB7XG4gICAgdmFyIHNlY3Rpb25MZW5ndGgsIHRhYmxlRW5kLCBwcm9ncmFtSW5mb0xlbmd0aCwgcGlkO1xuICAgIHNlY3Rpb25MZW5ndGggPSAoZGF0YVtvZmZzZXQgKyAxXSAmIDB4MGYpIDw8IDggfCBkYXRhW29mZnNldCArIDJdO1xuICAgIHRhYmxlRW5kID0gb2Zmc2V0ICsgMyArIHNlY3Rpb25MZW5ndGggLSA0O1xuICAgIC8vIHRvIGRldGVybWluZSB3aGVyZSB0aGUgdGFibGUgaXMsIHdlIGhhdmUgdG8gZmlndXJlIG91dCBob3dcbiAgICAvLyBsb25nIHRoZSBwcm9ncmFtIGluZm8gZGVzY3JpcHRvcnMgYXJlXG4gICAgcHJvZ3JhbUluZm9MZW5ndGggPSAoZGF0YVtvZmZzZXQgKyAxMF0gJiAweDBmKSA8PCA4IHwgZGF0YVtvZmZzZXQgKyAxMV07XG4gICAgLy8gYWR2YW5jZSB0aGUgb2Zmc2V0IHRvIHRoZSBmaXJzdCBlbnRyeSBpbiB0aGUgbWFwcGluZyB0YWJsZVxuICAgIG9mZnNldCArPSAxMiArIHByb2dyYW1JbmZvTGVuZ3RoO1xuICAgIHdoaWxlIChvZmZzZXQgPCB0YWJsZUVuZCkge1xuICAgICAgcGlkID0gKGRhdGFbb2Zmc2V0ICsgMV0gJiAweDFGKSA8PCA4IHwgZGF0YVtvZmZzZXQgKyAyXTtcbiAgICAgIHN3aXRjaChkYXRhW29mZnNldF0pIHtcbiAgICAgICAgLy8gSVNPL0lFQyAxMzgxOC03IEFEVFMgQUFDIChNUEVHLTIgbG93ZXIgYml0LXJhdGUgYXVkaW8pXG4gICAgICAgIGNhc2UgMHgwZjpcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ0FBQyBQSUQ6JyAgKyBwaWQpO1xuICAgICAgICAgIHRoaXMuX2FhY1RyYWNrLmlkID0gcGlkO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICAvLyBQYWNrZXRpemVkIG1ldGFkYXRhIChJRDMpXG4gICAgICAgIGNhc2UgMHgxNTpcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ0lEMyBQSUQ6JyAgKyBwaWQpO1xuICAgICAgICAgIHRoaXMuX2lkM1RyYWNrLmlkID0gcGlkO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICAvLyBJVFUtVCBSZWMuIEguMjY0IGFuZCBJU08vSUVDIDE0NDk2LTEwIChsb3dlciBiaXQtcmF0ZSB2aWRlbylcbiAgICAgICAgY2FzZSAweDFiOlxuICAgICAgICAgIC8vbG9nZ2VyLmxvZygnQVZDIFBJRDonICArIHBpZCk7XG4gICAgICAgICAgdGhpcy5fYXZjVHJhY2suaWQgPSBwaWQ7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGxvZ2dlci5sb2coJ3Vua293biBzdHJlYW0gdHlwZTonICArIGRhdGFbb2Zmc2V0XSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgLy8gbW92ZSB0byB0aGUgbmV4dCB0YWJsZSBlbnRyeVxuICAgICAgLy8gc2tpcCBwYXN0IHRoZSBlbGVtZW50YXJ5IHN0cmVhbSBkZXNjcmlwdG9ycywgaWYgcHJlc2VudFxuICAgICAgb2Zmc2V0ICs9ICgoZGF0YVtvZmZzZXQgKyAzXSAmIDB4MEYpIDw8IDggfCBkYXRhW29mZnNldCArIDRdKSArIDU7XG4gICAgfVxuICB9XG5cbiAgX3BhcnNlUEVTKHN0cmVhbSkge1xuICAgIHZhciBpID0gMCwgZnJhZywgcGVzRmxhZ3MsIHBlc1ByZWZpeCwgcGVzTGVuLCBwZXNIZHJMZW4sIHBlc0RhdGEsIHBlc1B0cywgcGVzRHRzLCBwYXlsb2FkU3RhcnRPZmZzZXQ7XG4gICAgLy9yZXRyaWV2ZSBQVFMvRFRTIGZyb20gZmlyc3QgZnJhZ21lbnRcbiAgICBmcmFnID0gc3RyZWFtLmRhdGFbMF07XG4gICAgcGVzUHJlZml4ID0gKGZyYWdbMF0gPDwgMTYpICsgKGZyYWdbMV0gPDwgOCkgKyBmcmFnWzJdO1xuICAgIGlmIChwZXNQcmVmaXggPT09IDEpIHtcbiAgICAgIHBlc0xlbiA9IChmcmFnWzRdIDw8IDgpICsgZnJhZ1s1XTtcbiAgICAgIHBlc0ZsYWdzID0gZnJhZ1s3XTtcbiAgICAgIGlmIChwZXNGbGFncyAmIDB4QzApIHtcbiAgICAgICAgLyogUEVTIGhlYWRlciBkZXNjcmliZWQgaGVyZSA6IGh0dHA6Ly9kdmQuc291cmNlZm9yZ2UubmV0L2R2ZGluZm8vcGVzLWhkci5odG1sXG4gICAgICAgICAgICBhcyBQVFMgLyBEVFMgaXMgMzMgYml0IHdlIGNhbm5vdCB1c2UgYml0d2lzZSBvcGVyYXRvciBpbiBKUyxcbiAgICAgICAgICAgIGFzIEJpdHdpc2Ugb3BlcmF0b3JzIHRyZWF0IHRoZWlyIG9wZXJhbmRzIGFzIGEgc2VxdWVuY2Ugb2YgMzIgYml0cyAqL1xuICAgICAgICBwZXNQdHMgPSAoZnJhZ1s5XSAmIDB4MEUpICogNTM2ODcwOTEyICsvLyAxIDw8IDI5XG4gICAgICAgICAgKGZyYWdbMTBdICYgMHhGRikgKiA0MTk0MzA0ICsvLyAxIDw8IDIyXG4gICAgICAgICAgKGZyYWdbMTFdICYgMHhGRSkgKiAxNjM4NCArLy8gMSA8PCAxNFxuICAgICAgICAgIChmcmFnWzEyXSAmIDB4RkYpICogMTI4ICsvLyAxIDw8IDdcbiAgICAgICAgICAoZnJhZ1sxM10gJiAweEZFKSAvIDI7XG4gICAgICAgICAgLy8gY2hlY2sgaWYgZ3JlYXRlciB0aGFuIDJeMzIgLTFcbiAgICAgICAgICBpZiAocGVzUHRzID4gNDI5NDk2NzI5NSkge1xuICAgICAgICAgICAgLy8gZGVjcmVtZW50IDJeMzNcbiAgICAgICAgICAgIHBlc1B0cyAtPSA4NTg5OTM0NTkyO1xuICAgICAgICAgIH1cbiAgICAgICAgaWYgKHBlc0ZsYWdzICYgMHg0MCkge1xuICAgICAgICAgIHBlc0R0cyA9IChmcmFnWzE0XSAmIDB4MEUgKSAqIDUzNjg3MDkxMiArLy8gMSA8PCAyOVxuICAgICAgICAgICAgKGZyYWdbMTVdICYgMHhGRiApICogNDE5NDMwNCArLy8gMSA8PCAyMlxuICAgICAgICAgICAgKGZyYWdbMTZdICYgMHhGRSApICogMTYzODQgKy8vIDEgPDwgMTRcbiAgICAgICAgICAgIChmcmFnWzE3XSAmIDB4RkYgKSAqIDEyOCArLy8gMSA8PCA3XG4gICAgICAgICAgICAoZnJhZ1sxOF0gJiAweEZFICkgLyAyO1xuICAgICAgICAgIC8vIGNoZWNrIGlmIGdyZWF0ZXIgdGhhbiAyXjMyIC0xXG4gICAgICAgICAgaWYgKHBlc0R0cyA+IDQyOTQ5NjcyOTUpIHtcbiAgICAgICAgICAgIC8vIGRlY3JlbWVudCAyXjMzXG4gICAgICAgICAgICBwZXNEdHMgLT0gODU4OTkzNDU5MjtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVzRHRzID0gcGVzUHRzO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBwZXNIZHJMZW4gPSBmcmFnWzhdO1xuICAgICAgcGF5bG9hZFN0YXJ0T2Zmc2V0ID0gcGVzSGRyTGVuICsgOTtcbiAgICAgIC8vIHRyaW0gUEVTIGhlYWRlclxuICAgICAgc3RyZWFtLmRhdGFbMF0gPSBzdHJlYW0uZGF0YVswXS5zdWJhcnJheShwYXlsb2FkU3RhcnRPZmZzZXQpO1xuICAgICAgc3RyZWFtLnNpemUgLT0gcGF5bG9hZFN0YXJ0T2Zmc2V0O1xuICAgICAgLy9yZWFzc2VtYmxlIFBFUyBwYWNrZXRcbiAgICAgIHBlc0RhdGEgPSBuZXcgVWludDhBcnJheShzdHJlYW0uc2l6ZSk7XG4gICAgICAvLyByZWFzc2VtYmxlIHRoZSBwYWNrZXRcbiAgICAgIHdoaWxlIChzdHJlYW0uZGF0YS5sZW5ndGgpIHtcbiAgICAgICAgZnJhZyA9IHN0cmVhbS5kYXRhLnNoaWZ0KCk7XG4gICAgICAgIHBlc0RhdGEuc2V0KGZyYWcsIGkpO1xuICAgICAgICBpICs9IGZyYWcuYnl0ZUxlbmd0aDtcbiAgICAgIH1cbiAgICAgIHJldHVybiB7ZGF0YTogcGVzRGF0YSwgcHRzOiBwZXNQdHMsIGR0czogcGVzRHRzLCBsZW46IHBlc0xlbn07XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIF9wYXJzZUFWQ1BFUyhwZXMpIHtcbiAgICB2YXIgdHJhY2sgPSB0aGlzLl9hdmNUcmFjayxcbiAgICAgICAgc2FtcGxlcyA9IHRyYWNrLnNhbXBsZXMsXG4gICAgICAgIHVuaXRzID0gdGhpcy5fcGFyc2VBVkNOQUx1KHBlcy5kYXRhKSxcbiAgICAgICAgdW5pdHMyID0gW10sXG4gICAgICAgIGRlYnVnID0gZmFsc2UsXG4gICAgICAgIGtleSA9IGZhbHNlLFxuICAgICAgICBsZW5ndGggPSAwLFxuICAgICAgICBhdmNTYW1wbGUsXG4gICAgICAgIHB1c2g7XG4gICAgLy8gbm8gTkFMdSBmb3VuZFxuICAgIGlmICh1bml0cy5sZW5ndGggPT09IDAgJiYgc2FtcGxlcy5sZW5ndGggPiAwKSB7XG4gICAgICAvLyBhcHBlbmQgcGVzLmRhdGEgdG8gcHJldmlvdXMgTkFMIHVuaXRcbiAgICAgIHZhciBsYXN0YXZjU2FtcGxlID0gc2FtcGxlc1tzYW1wbGVzLmxlbmd0aCAtIDFdO1xuICAgICAgdmFyIGxhc3RVbml0ID0gbGFzdGF2Y1NhbXBsZS51bml0cy51bml0c1tsYXN0YXZjU2FtcGxlLnVuaXRzLnVuaXRzLmxlbmd0aCAtIDFdO1xuICAgICAgdmFyIHRtcCA9IG5ldyBVaW50OEFycmF5KGxhc3RVbml0LmRhdGEuYnl0ZUxlbmd0aCArIHBlcy5kYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgdG1wLnNldChsYXN0VW5pdC5kYXRhLCAwKTtcbiAgICAgIHRtcC5zZXQocGVzLmRhdGEsIGxhc3RVbml0LmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICBsYXN0VW5pdC5kYXRhID0gdG1wO1xuICAgICAgbGFzdGF2Y1NhbXBsZS51bml0cy5sZW5ndGggKz0gcGVzLmRhdGEuYnl0ZUxlbmd0aDtcbiAgICAgIHRyYWNrLmxlbiArPSBwZXMuZGF0YS5ieXRlTGVuZ3RoO1xuICAgIH1cbiAgICAvL2ZyZWUgcGVzLmRhdGEgdG8gc2F2ZSB1cCBzb21lIG1lbW9yeVxuICAgIHBlcy5kYXRhID0gbnVsbDtcbiAgICB2YXIgZGVidWdTdHJpbmcgPSAnJztcbiAgICB1bml0cy5mb3JFYWNoKHVuaXQgPT4ge1xuICAgICAgc3dpdGNoKHVuaXQudHlwZSkge1xuICAgICAgICAvL05EUlxuICAgICAgICAgY2FzZSAxOlxuICAgICAgICAgICBwdXNoID0gdHJ1ZTtcbiAgICAgICAgICAgaWYoZGVidWcpIHtcbiAgICAgICAgICAgIGRlYnVnU3RyaW5nICs9ICdORFIgJztcbiAgICAgICAgICAgfVxuICAgICAgICAgICBicmVhaztcbiAgICAgICAgLy9JRFJcbiAgICAgICAgY2FzZSA1OlxuICAgICAgICAgIHB1c2ggPSB0cnVlO1xuICAgICAgICAgIGlmKGRlYnVnKSB7XG4gICAgICAgICAgICBkZWJ1Z1N0cmluZyArPSAnSURSICc7XG4gICAgICAgICAgfVxuICAgICAgICAgIGtleSA9IHRydWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIC8vU0VJXG4gICAgICAgIGNhc2UgNjpcbiAgICAgICAgICBwdXNoID0gdHJ1ZTtcbiAgICAgICAgICBpZihkZWJ1Zykge1xuICAgICAgICAgICAgZGVidWdTdHJpbmcgKz0gJ1NFSSAnO1xuICAgICAgICAgIH1cbiAgICAgICAgICB2YXIgZXhwR29sb21iRGVjb2RlciA9IG5ldyBFeHBHb2xvbWIodW5pdC5kYXRhKTtcblxuICAgICAgICAgIC8vIHNraXAgZnJhbWVUeXBlXG4gICAgICAgICAgZXhwR29sb21iRGVjb2Rlci5yZWFkVUJ5dGUoKTtcblxuICAgICAgICAgIHZhciBwYXlsb2FkVHlwZSA9IGV4cEdvbG9tYkRlY29kZXIucmVhZFVCeXRlKCk7XG5cbiAgICAgICAgICAvLyBUT0RPOiB0aGVyZSBjYW4gYmUgbW9yZSB0aGFuIG9uZSBwYXlsb2FkIGluIGFuIFNFSSBwYWNrZXQuLi5cbiAgICAgICAgICAvLyBUT0RPOiBuZWVkIHRvIHJlYWQgdHlwZSBhbmQgc2l6ZSBpbiBhIHdoaWxlIGxvb3AgdG8gZ2V0IHRoZW0gYWxsXG4gICAgICAgICAgaWYgKHBheWxvYWRUeXBlID09PSA0KVxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHZhciBwYXlsb2FkU2l6ZSA9IDA7XG5cbiAgICAgICAgICAgIGRvIHtcbiAgICAgICAgICAgICAgcGF5bG9hZFNpemUgPSBleHBHb2xvbWJEZWNvZGVyLnJlYWRVQnl0ZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgd2hpbGUgKHBheWxvYWRTaXplID09PSAyNTUpXG5cbiAgICAgICAgICAgIHZhciBjb3VudHJ5Q29kZSA9IGV4cEdvbG9tYkRlY29kZXIucmVhZFVCeXRlKCk7XG5cbiAgICAgICAgICAgIGlmIChjb3VudHJ5Q29kZSA9PT0gMTgxKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICB2YXIgcHJvdmlkZXJDb2RlID0gZXhwR29sb21iRGVjb2Rlci5yZWFkVVNob3J0KCk7XG5cbiAgICAgICAgICAgICAgaWYgKHByb3ZpZGVyQ29kZSA9PT0gNDkpXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB2YXIgdXNlclN0cnVjdHVyZSA9IGV4cEdvbG9tYkRlY29kZXIucmVhZFVJbnQoKTtcblxuICAgICAgICAgICAgICAgIGlmICh1c2VyU3RydWN0dXJlID09PSAweDQ3NDEzOTM0KVxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIHZhciB1c2VyRGF0YVR5cGUgPSBleHBHb2xvbWJEZWNvZGVyLnJlYWRVQnl0ZSgpO1xuXG4gICAgICAgICAgICAgICAgICAvLyBSYXcgQ0VBLTYwOCBieXRlcyB3cmFwcGVkIGluIENFQS03MDggcGFja2V0XG4gICAgICAgICAgICAgICAgICBpZiAodXNlckRhdGFUeXBlID09PSAzKVxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZmlyc3RCeXRlID0gZXhwR29sb21iRGVjb2Rlci5yZWFkVUJ5dGUoKTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHNlY29uZEJ5dGUgPSBleHBHb2xvbWJEZWNvZGVyLnJlYWRVQnl0ZSgpO1xuXG4gICAgICAgICAgICAgICAgICAgIHZhciB0b3RhbENDcyA9IDMxICYgZmlyc3RCeXRlO1xuICAgICAgICAgICAgICAgICAgICB2YXIgc2l6ZU9mQ0NzID0gdG90YWxDQ3MgKiAzO1xuICAgICAgICAgICAgICAgICAgICB2YXIgYnl0ZUFycmF5ID0gW2ZpcnN0Qnl0ZSwgc2Vjb25kQnl0ZV07XG5cbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaT0wOyBpPHRvdGFsQ0NzOyBpKyspXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAvLyAzIGJ5dGVzIHBlciBDQ1xuICAgICAgICAgICAgICAgICAgICAgIGJ5dGVBcnJheS5wdXNoKGV4cEdvbG9tYkRlY29kZXIucmVhZFVCeXRlKCkpO1xuICAgICAgICAgICAgICAgICAgICAgIGJ5dGVBcnJheS5wdXNoKGV4cEdvbG9tYkRlY29kZXIucmVhZFVCeXRlKCkpO1xuICAgICAgICAgICAgICAgICAgICAgIGJ5dGVBcnJheS5wdXNoKGV4cEdvbG9tYkRlY29kZXIucmVhZFVCeXRlKCkpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fdHh0VHJhY2suc2FtcGxlcy5wdXNoKHt0eXBlOiAzLCBwdHM6IHBlcy5wdHMsIGxldmVsOiB0aGlzLmxhc3RMZXZlbCwgYnl0ZXM6IGJ5dGVBcnJheX0pO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgLy9TUFNcbiAgICAgICAgY2FzZSA3OlxuICAgICAgICAgIHB1c2ggPSB0cnVlO1xuICAgICAgICAgIGlmKGRlYnVnKSB7XG4gICAgICAgICAgICBkZWJ1Z1N0cmluZyArPSAnU1BTICc7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmKCF0cmFjay5zcHMpIHtcbiAgICAgICAgICAgIHZhciBleHBHb2xvbWJEZWNvZGVyID0gbmV3IEV4cEdvbG9tYih1bml0LmRhdGEpO1xuICAgICAgICAgICAgdmFyIGNvbmZpZyA9IGV4cEdvbG9tYkRlY29kZXIucmVhZFNQUygpO1xuICAgICAgICAgICAgdHJhY2sud2lkdGggPSBjb25maWcud2lkdGg7XG4gICAgICAgICAgICB0cmFjay5oZWlnaHQgPSBjb25maWcuaGVpZ2h0O1xuICAgICAgICAgICAgdHJhY2suc3BzID0gW3VuaXQuZGF0YV07XG4gICAgICAgICAgICB0cmFjay50aW1lc2NhbGUgPSB0aGlzLnJlbXV4ZXIudGltZXNjYWxlO1xuICAgICAgICAgICAgdHJhY2suZHVyYXRpb24gPSB0aGlzLnJlbXV4ZXIudGltZXNjYWxlICogdGhpcy5fZHVyYXRpb247XG4gICAgICAgICAgICB2YXIgY29kZWNhcnJheSA9IHVuaXQuZGF0YS5zdWJhcnJheSgxLCA0KTtcbiAgICAgICAgICAgIHZhciBjb2RlY3N0cmluZyA9ICdhdmMxLic7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IDM7IGkrKykge1xuICAgICAgICAgICAgICB2YXIgaCA9IGNvZGVjYXJyYXlbaV0udG9TdHJpbmcoMTYpO1xuICAgICAgICAgICAgICBpZiAoaC5sZW5ndGggPCAyKSB7XG4gICAgICAgICAgICAgICAgaCA9ICcwJyArIGg7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgY29kZWNzdHJpbmcgKz0gaDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRyYWNrLmNvZGVjID0gY29kZWNzdHJpbmc7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICAvL1BQU1xuICAgICAgICBjYXNlIDg6XG4gICAgICAgICAgcHVzaCA9IHRydWU7XG4gICAgICAgICAgaWYoZGVidWcpIHtcbiAgICAgICAgICAgIGRlYnVnU3RyaW5nICs9ICdQUFMgJztcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKCF0cmFjay5wcHMpIHtcbiAgICAgICAgICAgIHRyYWNrLnBwcyA9IFt1bml0LmRhdGFdO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSA5OlxuICAgICAgICAgIHB1c2ggPSB0cnVlO1xuICAgICAgICAgIGlmKGRlYnVnKSB7XG4gICAgICAgICAgICBkZWJ1Z1N0cmluZyArPSAnQVVEICc7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHB1c2ggPSBmYWxzZTtcbiAgICAgICAgICBkZWJ1Z1N0cmluZyArPSAndW5rbm93biBOQUwgJyArIHVuaXQudHlwZSArICcgJztcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGlmKHB1c2gpIHtcbiAgICAgICAgdW5pdHMyLnB1c2godW5pdCk7XG4gICAgICAgIGxlbmd0aCs9dW5pdC5kYXRhLmJ5dGVMZW5ndGg7XG4gICAgICB9XG4gICAgfSk7XG4gICAgaWYoZGVidWcgfHwgZGVidWdTdHJpbmcubGVuZ3RoKSB7XG4gICAgICBsb2dnZXIubG9nKGRlYnVnU3RyaW5nKTtcbiAgICB9XG4gICAgLy9idWlsZCBzYW1wbGUgZnJvbSBQRVNcbiAgICAvLyBBbm5leCBCIHRvIE1QNCBjb252ZXJzaW9uIHRvIGJlIGRvbmVcbiAgICBpZiAodW5pdHMyLmxlbmd0aCkge1xuICAgICAgLy8gb25seSBwdXNoIEFWQyBzYW1wbGUgaWYga2V5ZnJhbWUgYWxyZWFkeSBmb3VuZC4gYnJvd3NlcnMgZXhwZWN0IGEga2V5ZnJhbWUgYXQgZmlyc3QgdG8gc3RhcnQgZGVjb2RpbmdcbiAgICAgIGlmIChrZXkgPT09IHRydWUgfHwgdHJhY2suc3BzICkge1xuICAgICAgICBhdmNTYW1wbGUgPSB7dW5pdHM6IHsgdW5pdHMgOiB1bml0czIsIGxlbmd0aCA6IGxlbmd0aH0sIHB0czogcGVzLnB0cywgZHRzOiBwZXMuZHRzLCBrZXk6IGtleX07XG4gICAgICAgIHNhbXBsZXMucHVzaChhdmNTYW1wbGUpO1xuICAgICAgICB0cmFjay5sZW4gKz0gbGVuZ3RoO1xuICAgICAgICB0cmFjay5uYk5hbHUgKz0gdW5pdHMyLmxlbmd0aDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuXG4gIF9wYXJzZUFWQ05BTHUoYXJyYXkpIHtcbiAgICB2YXIgaSA9IDAsIGxlbiA9IGFycmF5LmJ5dGVMZW5ndGgsIHZhbHVlLCBvdmVyZmxvdywgc3RhdGUgPSAwO1xuICAgIHZhciB1bml0cyA9IFtdLCB1bml0LCB1bml0VHlwZSwgbGFzdFVuaXRTdGFydCwgbGFzdFVuaXRUeXBlO1xuICAgIC8vbG9nZ2VyLmxvZygnUEVTOicgKyBIZXguaGV4RHVtcChhcnJheSkpO1xuICAgIHdoaWxlIChpIDwgbGVuKSB7XG4gICAgICB2YWx1ZSA9IGFycmF5W2krK107XG4gICAgICAvLyBmaW5kaW5nIDMgb3IgNC1ieXRlIHN0YXJ0IGNvZGVzICgwMCAwMCAwMSBPUiAwMCAwMCAwMCAwMSlcbiAgICAgIHN3aXRjaCAoc3RhdGUpIHtcbiAgICAgICAgY2FzZSAwOlxuICAgICAgICAgIGlmICh2YWx1ZSA9PT0gMCkge1xuICAgICAgICAgICAgc3RhdGUgPSAxO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAxOlxuICAgICAgICAgIGlmKCB2YWx1ZSA9PT0gMCkge1xuICAgICAgICAgICAgc3RhdGUgPSAyO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzdGF0ZSA9IDA7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDI6XG4gICAgICAgIGNhc2UgMzpcbiAgICAgICAgICBpZiggdmFsdWUgPT09IDApIHtcbiAgICAgICAgICAgIHN0YXRlID0gMztcbiAgICAgICAgICB9IGVsc2UgaWYgKHZhbHVlID09PSAxKSB7XG4gICAgICAgICAgICB1bml0VHlwZSA9IGFycmF5W2ldICYgMHgxZjtcbiAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnZmluZCBOQUxVIEAgb2Zmc2V0OicgKyBpICsgJyx0eXBlOicgKyB1bml0VHlwZSk7XG4gICAgICAgICAgICBpZiAobGFzdFVuaXRTdGFydCkge1xuICAgICAgICAgICAgICB1bml0ID0ge2RhdGE6IGFycmF5LnN1YmFycmF5KGxhc3RVbml0U3RhcnQsIGkgLSBzdGF0ZSAtIDEpLCB0eXBlOiBsYXN0VW5pdFR5cGV9O1xuICAgICAgICAgICAgICAvL2xvZ2dlci5sb2coJ3B1c2hpbmcgTkFMVSwgdHlwZS9zaXplOicgKyB1bml0LnR5cGUgKyAnLycgKyB1bml0LmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICAgICAgICAgIHVuaXRzLnB1c2godW5pdCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyBJZiBOQUwgdW5pdHMgYXJlIG5vdCBzdGFydGluZyByaWdodCBhdCB0aGUgYmVnaW5uaW5nIG9mIHRoZSBQRVMgcGFja2V0LCBwdXNoIHByZWNlZGluZyBkYXRhIGludG8gcHJldmlvdXMgTkFMIHVuaXQuXG4gICAgICAgICAgICAgIG92ZXJmbG93ICA9IGkgLSBzdGF0ZSAtIDE7XG4gICAgICAgICAgICAgIGlmIChvdmVyZmxvdykge1xuICAgICAgICAgICAgICAgIHZhciB0cmFjayA9IHRoaXMuX2F2Y1RyYWNrLFxuICAgICAgICAgICAgICAgICAgICBzYW1wbGVzID0gdHJhY2suc2FtcGxlcztcbiAgICAgICAgICAgICAgICAvL2xvZ2dlci5sb2coJ2ZpcnN0IE5BTFUgZm91bmQgd2l0aCBvdmVyZmxvdzonICsgb3ZlcmZsb3cpO1xuICAgICAgICAgICAgICAgIGlmIChzYW1wbGVzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgdmFyIGxhc3RhdmNTYW1wbGUgPSBzYW1wbGVzW3NhbXBsZXMubGVuZ3RoIC0gMV0sXG4gICAgICAgICAgICAgICAgICAgICAgbGFzdFVuaXRzID0gbGFzdGF2Y1NhbXBsZS51bml0cy51bml0cyxcbiAgICAgICAgICAgICAgICAgICAgICBsYXN0VW5pdCA9IGxhc3RVbml0c1tsYXN0VW5pdHMubGVuZ3RoIC0gMV0sXG4gICAgICAgICAgICAgICAgICAgICAgdG1wID0gbmV3IFVpbnQ4QXJyYXkobGFzdFVuaXQuZGF0YS5ieXRlTGVuZ3RoICsgb3ZlcmZsb3cpO1xuICAgICAgICAgICAgICAgICAgdG1wLnNldChsYXN0VW5pdC5kYXRhLCAwKTtcbiAgICAgICAgICAgICAgICAgIHRtcC5zZXQoYXJyYXkuc3ViYXJyYXkoMCwgb3ZlcmZsb3cpLCBsYXN0VW5pdC5kYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgICAgICAgICAgICAgbGFzdFVuaXQuZGF0YSA9IHRtcDtcbiAgICAgICAgICAgICAgICAgIGxhc3RhdmNTYW1wbGUudW5pdHMubGVuZ3RoICs9IG92ZXJmbG93O1xuICAgICAgICAgICAgICAgICAgdHJhY2subGVuICs9IG92ZXJmbG93O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGFzdFVuaXRTdGFydCA9IGk7XG4gICAgICAgICAgICBsYXN0VW5pdFR5cGUgPSB1bml0VHlwZTtcbiAgICAgICAgICAgIGlmICh1bml0VHlwZSA9PT0gMSB8fCB1bml0VHlwZSA9PT0gNSkge1xuICAgICAgICAgICAgICAvLyBPUFRJICEhISBpZiBJRFIvTkRSIHVuaXQsIGNvbnNpZGVyIGl0IGlzIGxhc3QgTkFMdVxuICAgICAgICAgICAgICBpID0gbGVuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc3RhdGUgPSAwO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzdGF0ZSA9IDA7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAobGFzdFVuaXRTdGFydCkge1xuICAgICAgdW5pdCA9IHtkYXRhOiBhcnJheS5zdWJhcnJheShsYXN0VW5pdFN0YXJ0LCBsZW4pLCB0eXBlOiBsYXN0VW5pdFR5cGV9O1xuICAgICAgdW5pdHMucHVzaCh1bml0KTtcbiAgICAgIC8vbG9nZ2VyLmxvZygncHVzaGluZyBOQUxVLCB0eXBlL3NpemU6JyArIHVuaXQudHlwZSArICcvJyArIHVuaXQuZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICB9XG4gICAgcmV0dXJuIHVuaXRzO1xuICB9XG5cbiAgX3BhcnNlQUFDUEVTKHBlcykge1xuICAgIHZhciB0cmFjayA9IHRoaXMuX2FhY1RyYWNrLFxuICAgICAgICBkYXRhID0gcGVzLmRhdGEsXG4gICAgICAgIHB0cyA9IHBlcy5wdHMsXG4gICAgICAgIHN0YXJ0T2Zmc2V0ID0gMCxcbiAgICAgICAgZHVyYXRpb24gPSB0aGlzLl9kdXJhdGlvbixcbiAgICAgICAgYXVkaW9Db2RlYyA9IHRoaXMuYXVkaW9Db2RlYyxcbiAgICAgICAgY29uZmlnLCBhZHRzRnJhbWVTaXplLCBhZHRzU3RhcnRPZmZzZXQsIGFkdHNIZWFkZXJMZW4sIHN0YW1wLCBuYlNhbXBsZXMsIGxlbiwgYWFjU2FtcGxlO1xuICAgIGlmICh0aGlzLmFhY092ZXJGbG93KSB7XG4gICAgICB2YXIgdG1wID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5hYWNPdmVyRmxvdy5ieXRlTGVuZ3RoICsgZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICAgIHRtcC5zZXQodGhpcy5hYWNPdmVyRmxvdywgMCk7XG4gICAgICB0bXAuc2V0KGRhdGEsIHRoaXMuYWFjT3ZlckZsb3cuYnl0ZUxlbmd0aCk7XG4gICAgICBkYXRhID0gdG1wO1xuICAgIH1cbiAgICAvLyBsb29rIGZvciBBRFRTIGhlYWRlciAoMHhGRkZ4KVxuICAgIGZvciAoYWR0c1N0YXJ0T2Zmc2V0ID0gc3RhcnRPZmZzZXQsIGxlbiA9IGRhdGEubGVuZ3RoOyBhZHRzU3RhcnRPZmZzZXQgPCBsZW4gLSAxOyBhZHRzU3RhcnRPZmZzZXQrKykge1xuICAgICAgaWYgKChkYXRhW2FkdHNTdGFydE9mZnNldF0gPT09IDB4ZmYpICYmIChkYXRhW2FkdHNTdGFydE9mZnNldCsxXSAmIDB4ZjApID09PSAweGYwKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBpZiBBRFRTIGhlYWRlciBkb2VzIG5vdCBzdGFydCBzdHJhaWdodCBmcm9tIHRoZSBiZWdpbm5pbmcgb2YgdGhlIFBFUyBwYXlsb2FkLCByYWlzZSBhbiBlcnJvclxuICAgIGlmIChhZHRzU3RhcnRPZmZzZXQpIHtcbiAgICAgIHZhciByZWFzb24sIGZhdGFsO1xuICAgICAgaWYgKGFkdHNTdGFydE9mZnNldCA8IGxlbiAtIDEpIHtcbiAgICAgICAgcmVhc29uID0gYEFBQyBQRVMgZGlkIG5vdCBzdGFydCB3aXRoIEFEVFMgaGVhZGVyLG9mZnNldDoke2FkdHNTdGFydE9mZnNldH1gO1xuICAgICAgICBmYXRhbCA9IGZhbHNlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVhc29uID0gJ25vIEFEVFMgaGVhZGVyIGZvdW5kIGluIEFBQyBQRVMnO1xuICAgICAgICBmYXRhbCA9IHRydWU7XG4gICAgICB9XG4gICAgICB0aGlzLm9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuRlJBR19QQVJTSU5HX0VSUk9SLCBmYXRhbDogZmF0YWwsIHJlYXNvbjogcmVhc29ufSk7XG4gICAgICBpZiAoZmF0YWwpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIXRyYWNrLmF1ZGlvc2FtcGxlcmF0ZSkge1xuICAgICAgY29uZmlnID0gQURUUy5nZXRBdWRpb0NvbmZpZyh0aGlzLm9ic2VydmVyLGRhdGEsIGFkdHNTdGFydE9mZnNldCwgYXVkaW9Db2RlYyk7XG4gICAgICB0cmFjay5jb25maWcgPSBjb25maWcuY29uZmlnO1xuICAgICAgdHJhY2suYXVkaW9zYW1wbGVyYXRlID0gY29uZmlnLnNhbXBsZXJhdGU7XG4gICAgICB0cmFjay5jaGFubmVsQ291bnQgPSBjb25maWcuY2hhbm5lbENvdW50O1xuICAgICAgdHJhY2suY29kZWMgPSBjb25maWcuY29kZWM7XG4gICAgICB0cmFjay50aW1lc2NhbGUgPSB0aGlzLnJlbXV4ZXIudGltZXNjYWxlO1xuICAgICAgdHJhY2suZHVyYXRpb24gPSB0aGlzLnJlbXV4ZXIudGltZXNjYWxlICogZHVyYXRpb247XG4gICAgICBsb2dnZXIubG9nKGBwYXJzZWQgY29kZWM6JHt0cmFjay5jb2RlY30scmF0ZToke2NvbmZpZy5zYW1wbGVyYXRlfSxuYiBjaGFubmVsOiR7Y29uZmlnLmNoYW5uZWxDb3VudH1gKTtcbiAgICB9XG4gICAgbmJTYW1wbGVzID0gMDtcbiAgICB3aGlsZSAoKGFkdHNTdGFydE9mZnNldCArIDUpIDwgbGVuKSB7XG4gICAgICAvLyByZXRyaWV2ZSBmcmFtZSBzaXplXG4gICAgICBhZHRzRnJhbWVTaXplID0gKChkYXRhW2FkdHNTdGFydE9mZnNldCArIDNdICYgMHgwMykgPDwgMTEpO1xuICAgICAgLy8gYnl0ZSA0XG4gICAgICBhZHRzRnJhbWVTaXplIHw9IChkYXRhW2FkdHNTdGFydE9mZnNldCArIDRdIDw8IDMpO1xuICAgICAgLy8gYnl0ZSA1XG4gICAgICBhZHRzRnJhbWVTaXplIHw9ICgoZGF0YVthZHRzU3RhcnRPZmZzZXQgKyA1XSAmIDB4RTApID4+PiA1KTtcbiAgICAgIGFkdHNIZWFkZXJMZW4gPSAoISEoZGF0YVthZHRzU3RhcnRPZmZzZXQgKyAxXSAmIDB4MDEpID8gNyA6IDkpO1xuICAgICAgYWR0c0ZyYW1lU2l6ZSAtPSBhZHRzSGVhZGVyTGVuO1xuICAgICAgc3RhbXAgPSBNYXRoLnJvdW5kKHB0cyArIG5iU2FtcGxlcyAqIDEwMjQgKiA5MDAwMCAvIHRyYWNrLmF1ZGlvc2FtcGxlcmF0ZSk7XG4gICAgICAvL3N0YW1wID0gcGVzLnB0cztcbiAgICAgIC8vY29uc29sZS5sb2coJ0FBQyBmcmFtZSwgb2Zmc2V0L2xlbmd0aC9wdHM6JyArIChhZHRzU3RhcnRPZmZzZXQrNykgKyAnLycgKyBhZHRzRnJhbWVTaXplICsgJy8nICsgc3RhbXAudG9GaXhlZCgwKSk7XG4gICAgICBpZiAoKGFkdHNGcmFtZVNpemUgPiAwKSAmJiAoKGFkdHNTdGFydE9mZnNldCArIGFkdHNIZWFkZXJMZW4gKyBhZHRzRnJhbWVTaXplKSA8PSBsZW4pKSB7XG4gICAgICAgIGFhY1NhbXBsZSA9IHt1bml0OiBkYXRhLnN1YmFycmF5KGFkdHNTdGFydE9mZnNldCArIGFkdHNIZWFkZXJMZW4sIGFkdHNTdGFydE9mZnNldCArIGFkdHNIZWFkZXJMZW4gKyBhZHRzRnJhbWVTaXplKSwgcHRzOiBzdGFtcCwgZHRzOiBzdGFtcH07XG4gICAgICAgIHRyYWNrLnNhbXBsZXMucHVzaChhYWNTYW1wbGUpO1xuICAgICAgICB0cmFjay5sZW4gKz0gYWR0c0ZyYW1lU2l6ZTtcbiAgICAgICAgYWR0c1N0YXJ0T2Zmc2V0ICs9IGFkdHNGcmFtZVNpemUgKyBhZHRzSGVhZGVyTGVuO1xuICAgICAgICBuYlNhbXBsZXMrKztcbiAgICAgICAgLy8gbG9vayBmb3IgQURUUyBoZWFkZXIgKDB4RkZGeClcbiAgICAgICAgZm9yICggOyBhZHRzU3RhcnRPZmZzZXQgPCAobGVuIC0gMSk7IGFkdHNTdGFydE9mZnNldCsrKSB7XG4gICAgICAgICAgaWYgKChkYXRhW2FkdHNTdGFydE9mZnNldF0gPT09IDB4ZmYpICYmICgoZGF0YVthZHRzU3RhcnRPZmZzZXQgKyAxXSAmIDB4ZjApID09PSAweGYwKSkge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGFkdHNTdGFydE9mZnNldCA8IGxlbikge1xuICAgICAgdGhpcy5hYWNPdmVyRmxvdyA9IGRhdGEuc3ViYXJyYXkoYWR0c1N0YXJ0T2Zmc2V0LCBsZW4pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmFhY092ZXJGbG93ID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICBfcGFyc2VJRDNQRVMocGVzKSB7XG4gICAgdGhpcy5faWQzVHJhY2suc2FtcGxlcy5wdXNoKHBlcyk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgVFNEZW11eGVyO1xuXG4iLCJleHBvcnQgY29uc3QgRXJyb3JUeXBlcyA9IHtcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBuZXR3b3JrIGVycm9yIChsb2FkaW5nIGVycm9yIC8gdGltZW91dCAuLi4pXG4gIE5FVFdPUktfRVJST1I6ICdobHNOZXR3b3JrRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIG1lZGlhIEVycm9yICh2aWRlby9wYXJzaW5nL21lZGlhc291cmNlIGVycm9yKVxuICBNRURJQV9FUlJPUjogJ2hsc01lZGlhRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBhbGwgb3RoZXIgZXJyb3JzXG4gIE9USEVSX0VSUk9SOiAnaGxzT3RoZXJFcnJvcidcbn07XG5cbmV4cG9ydCBjb25zdCBFcnJvckRldGFpbHMgPSB7XG4gIC8vIElkZW50aWZpZXIgZm9yIGEgbWFuaWZlc3QgbG9hZCBlcnJvciAtIGRhdGE6IHsgdXJsIDogZmF1bHR5IFVSTCwgcmVzcG9uc2UgOiBYSFIgcmVzcG9uc2V9XG4gIE1BTklGRVNUX0xPQURfRVJST1I6ICdtYW5pZmVzdExvYWRFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgbWFuaWZlc3QgbG9hZCB0aW1lb3V0IC0gZGF0YTogeyB1cmwgOiBmYXVsdHkgVVJMLCByZXNwb25zZSA6IFhIUiByZXNwb25zZX1cbiAgTUFOSUZFU1RfTE9BRF9USU1FT1VUOiAnbWFuaWZlc3RMb2FkVGltZU91dCcsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgbWFuaWZlc3QgcGFyc2luZyBlcnJvciAtIGRhdGE6IHsgdXJsIDogZmF1bHR5IFVSTCwgcmVhc29uIDogZXJyb3IgcmVhc29ufVxuICBNQU5JRkVTVF9QQVJTSU5HX0VSUk9SOiAnbWFuaWZlc3RQYXJzaW5nRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBwbGF5bGlzdCBsb2FkIGVycm9yIC0gZGF0YTogeyB1cmwgOiBmYXVsdHkgVVJMLCByZXNwb25zZSA6IFhIUiByZXNwb25zZX1cbiAgTEVWRUxfTE9BRF9FUlJPUjogJ2xldmVsTG9hZEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgcGxheWxpc3QgbG9hZCB0aW1lb3V0IC0gZGF0YTogeyB1cmwgOiBmYXVsdHkgVVJMLCByZXNwb25zZSA6IFhIUiByZXNwb25zZX1cbiAgTEVWRUxfTE9BRF9USU1FT1VUOiAnbGV2ZWxMb2FkVGltZU91dCcsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgbGV2ZWwgc3dpdGNoIGVycm9yIC0gZGF0YTogeyBsZXZlbCA6IGZhdWx0eSBsZXZlbCBJZCwgZXZlbnQgOiBlcnJvciBkZXNjcmlwdGlvbn1cbiAgTEVWRUxfU1dJVENIX0VSUk9SOiAnbGV2ZWxTd2l0Y2hFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGZyYWdtZW50IGxvYWQgZXJyb3IgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBGUkFHX0xPQURfRVJST1I6ICdmcmFnTG9hZEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgZnJhZ21lbnQgbG9vcCBsb2FkaW5nIGVycm9yIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0fVxuICBGUkFHX0xPT1BfTE9BRElOR19FUlJPUjogJ2ZyYWdMb29wTG9hZGluZ0Vycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgZnJhZ21lbnQgbG9hZCB0aW1lb3V0IGVycm9yIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0fVxuICBGUkFHX0xPQURfVElNRU9VVDogJ2ZyYWdMb2FkVGltZU91dCcsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgZnJhZ21lbnQgZGVjcnlwdGlvbiBlcnJvciBldmVudCAtIGRhdGE6IHBhcnNpbmcgZXJyb3IgZGVzY3JpcHRpb25cbiAgRlJBR19ERUNSWVBUX0VSUk9SOiAnZnJhZ0RlY3J5cHRFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgZnJhZ21lbnQgcGFyc2luZyBlcnJvciBldmVudCAtIGRhdGE6IHBhcnNpbmcgZXJyb3IgZGVzY3JpcHRpb25cbiAgRlJBR19QQVJTSU5HX0VSUk9SOiAnZnJhZ1BhcnNpbmdFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGRlY3J5cHQga2V5IGxvYWQgZXJyb3IgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBLRVlfTE9BRF9FUlJPUjogJ2tleUxvYWRFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGRlY3J5cHQga2V5IGxvYWQgdGltZW91dCBlcnJvciAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdH1cbiAgS0VZX0xPQURfVElNRU9VVDogJ2tleUxvYWRUaW1lT3V0JyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBidWZmZXIgYXBwZW5kIGVycm9yIC0gZGF0YTogYXBwZW5kIGVycm9yIGRlc2NyaXB0aW9uXG4gIEJVRkZFUl9BUFBFTkRfRVJST1I6ICdidWZmZXJBcHBlbmRFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgYnVmZmVyIGFwcGVuZGluZyBlcnJvciBldmVudCAtIGRhdGE6IGFwcGVuZGluZyBlcnJvciBkZXNjcmlwdGlvblxuICBCVUZGRVJfQVBQRU5ESU5HX0VSUk9SOiAnYnVmZmVyQXBwZW5kaW5nRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIGJ1ZmZlciBzdGFsbGVkIGVycm9yIGV2ZW50XG4gIEJVRkZFUl9TVEFMTEVEX0VSUk9SOiAnYnVmZmVyU3RhbGxlZEVycm9yJ1xufTtcbiIsIi8qXG4qXG4qIEFsbCBvYmplY3RzIGluIHRoZSBldmVudCBoYW5kbGluZyBjaGFpbiBzaG91bGQgaW5oZXJpdCBmcm9tIHRoaXMgY2xhc3NcbipcbiovXG5cbi8vaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4vdXRpbHMvbG9nZ2VyJztcblxuY2xhc3MgRXZlbnRIYW5kbGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMsIC4uLmV2ZW50cykge1xuICAgIHRoaXMuaGxzID0gaGxzO1xuICAgIHRoaXMub25FdmVudCA9IHRoaXMub25FdmVudC5iaW5kKHRoaXMpO1xuICAgIHRoaXMuaGFuZGxlZEV2ZW50cyA9IGV2ZW50cztcbiAgICB0aGlzLnVzZUdlbmVyaWNIYW5kbGVyID0gdHJ1ZTtcblxuICAgIHRoaXMucmVnaXN0ZXJMaXN0ZW5lcnMoKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy51bnJlZ2lzdGVyTGlzdGVuZXJzKCk7XG4gIH1cblxuICBpc0V2ZW50SGFuZGxlcigpIHtcbiAgICByZXR1cm4gdHlwZW9mIHRoaXMuaGFuZGxlZEV2ZW50cyA9PT0gJ29iamVjdCcgJiYgdGhpcy5oYW5kbGVkRXZlbnRzLmxlbmd0aCAmJiB0eXBlb2YgdGhpcy5vbkV2ZW50ID09PSAnZnVuY3Rpb24nO1xuICB9XG5cbiAgcmVnaXN0ZXJMaXN0ZW5lcnMoKSB7XG4gICAgaWYgKHRoaXMuaXNFdmVudEhhbmRsZXIoKSkge1xuICAgICAgdGhpcy5oYW5kbGVkRXZlbnRzLmZvckVhY2goZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgaWYgKGV2ZW50ID09PSAnaGxzRXZlbnRHZW5lcmljJykge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignRm9yYmlkZGVuIGV2ZW50IG5hbWU6ICcgKyBldmVudCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5obHMub24oZXZlbnQsIHRoaXMub25FdmVudCk7XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH1cbiAgfVxuXG4gIHVucmVnaXN0ZXJMaXN0ZW5lcnMoKSB7XG4gICAgaWYgKHRoaXMuaXNFdmVudEhhbmRsZXIoKSkge1xuICAgICAgdGhpcy5oYW5kbGVkRXZlbnRzLmZvckVhY2goZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgdGhpcy5obHMub2ZmKGV2ZW50LCB0aGlzLm9uRXZlbnQpO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9XG4gIH1cblxuICAvKlxuICAqIGFyZ3VtZW50czogZXZlbnQgKHN0cmluZyksIGRhdGEgKGFueSlcbiAgKi9cbiAgb25FdmVudChldmVudCwgZGF0YSkge1xuICAgIHRoaXMub25FdmVudEdlbmVyaWMoZXZlbnQsIGRhdGEpO1xuICB9XG5cbiAgb25FdmVudEdlbmVyaWMoZXZlbnQsIGRhdGEpIHtcbiAgICB2YXIgZXZlbnRUb0Z1bmN0aW9uID0gZnVuY3Rpb24oZXZlbnQsIGRhdGEpIHtcbiAgICAgIHZhciBmdW5jTmFtZSA9ICdvbicgKyBldmVudC5yZXBsYWNlKCdobHMnLCAnJyk7XG4gICAgICBpZiAodHlwZW9mIHRoaXNbZnVuY05hbWVdICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgRXZlbnQgJHtldmVudH0gaGFzIG5vIGdlbmVyaWMgaGFuZGxlciBpbiB0aGlzICR7dGhpcy5jb25zdHJ1Y3Rvci5uYW1lfSBjbGFzcyAodHJpZWQgJHtmdW5jTmFtZX0pYCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpc1tmdW5jTmFtZV0uYmluZCh0aGlzLCBkYXRhKTtcbiAgICB9O1xuICAgIGV2ZW50VG9GdW5jdGlvbi5jYWxsKHRoaXMsIGV2ZW50LCBkYXRhKS5jYWxsKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRXZlbnRIYW5kbGVyOyIsIm1vZHVsZS5leHBvcnRzID0ge1xuICAvLyBmaXJlZCBiZWZvcmUgTWVkaWFTb3VyY2UgaXMgYXR0YWNoaW5nIHRvIG1lZGlhIGVsZW1lbnQgLSBkYXRhOiB7IG1lZGlhIH1cbiAgTUVESUFfQVRUQUNISU5HOiAnaGxzTWVkaWFBdHRhY2hpbmcnLFxuICAvLyBmaXJlZCB3aGVuIE1lZGlhU291cmNlIGhhcyBiZWVuIHN1Y2Nlc2Z1bGx5IGF0dGFjaGVkIHRvIG1lZGlhIGVsZW1lbnQgLSBkYXRhOiB7IH1cbiAgTUVESUFfQVRUQUNIRUQ6ICdobHNNZWRpYUF0dGFjaGVkJyxcbiAgLy8gZmlyZWQgYmVmb3JlIGRldGFjaGluZyBNZWRpYVNvdXJjZSBmcm9tIG1lZGlhIGVsZW1lbnQgLSBkYXRhOiB7IH1cbiAgTUVESUFfREVUQUNISU5HOiAnaGxzTWVkaWFEZXRhY2hpbmcnLFxuICAvLyBmaXJlZCB3aGVuIE1lZGlhU291cmNlIGhhcyBiZWVuIGRldGFjaGVkIGZyb20gbWVkaWEgZWxlbWVudCAtIGRhdGE6IHsgfVxuICBNRURJQV9ERVRBQ0hFRDogJ2hsc01lZGlhRGV0YWNoZWQnLFxuICAvLyBmaXJlZCB0byBzaWduYWwgdGhhdCBhIG1hbmlmZXN0IGxvYWRpbmcgc3RhcnRzIC0gZGF0YTogeyB1cmwgOiBtYW5pZmVzdFVSTH1cbiAgTUFOSUZFU1RfTE9BRElORzogJ2hsc01hbmlmZXN0TG9hZGluZycsXG4gIC8vIGZpcmVkIGFmdGVyIG1hbmlmZXN0IGhhcyBiZWVuIGxvYWRlZCAtIGRhdGE6IHsgbGV2ZWxzIDogW2F2YWlsYWJsZSBxdWFsaXR5IGxldmVsc10gLCB1cmwgOiBtYW5pZmVzdFVSTCwgc3RhdHMgOiB7IHRyZXF1ZXN0LCB0Zmlyc3QsIHRsb2FkLCBtdGltZX19XG4gIE1BTklGRVNUX0xPQURFRDogJ2hsc01hbmlmZXN0TG9hZGVkJyxcbiAgLy8gZmlyZWQgYWZ0ZXIgbWFuaWZlc3QgaGFzIGJlZW4gcGFyc2VkIC0gZGF0YTogeyBsZXZlbHMgOiBbYXZhaWxhYmxlIHF1YWxpdHkgbGV2ZWxzXSAsIGZpcnN0TGV2ZWwgOiBpbmRleCBvZiBmaXJzdCBxdWFsaXR5IGxldmVsIGFwcGVhcmluZyBpbiBNYW5pZmVzdH1cbiAgTUFOSUZFU1RfUEFSU0VEOiAnaGxzTWFuaWZlc3RQYXJzZWQnLFxuICAvLyBmaXJlZCB3aGVuIGEgbGV2ZWwgcGxheWxpc3QgbG9hZGluZyBzdGFydHMgLSBkYXRhOiB7IHVybCA6IGxldmVsIFVSTCAgbGV2ZWwgOiBpZCBvZiBsZXZlbCBiZWluZyBsb2FkZWR9XG4gIExFVkVMX0xPQURJTkc6ICdobHNMZXZlbExvYWRpbmcnLFxuICAvLyBmaXJlZCB3aGVuIGEgbGV2ZWwgcGxheWxpc3QgbG9hZGluZyBmaW5pc2hlcyAtIGRhdGE6IHsgZGV0YWlscyA6IGxldmVsRGV0YWlscyBvYmplY3QsIGxldmVsIDogaWQgb2YgbG9hZGVkIGxldmVsLCBzdGF0cyA6IHsgdHJlcXVlc3QsIHRmaXJzdCwgdGxvYWQsIG10aW1lfSB9XG4gIExFVkVMX0xPQURFRDogJ2hsc0xldmVsTG9hZGVkJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGxldmVsJ3MgZGV0YWlscyBoYXZlIGJlZW4gdXBkYXRlZCBiYXNlZCBvbiBwcmV2aW91cyBkZXRhaWxzLCBhZnRlciBpdCBoYXMgYmVlbiBsb2FkZWQuIC0gZGF0YTogeyBkZXRhaWxzIDogbGV2ZWxEZXRhaWxzIG9iamVjdCwgbGV2ZWwgOiBpZCBvZiB1cGRhdGVkIGxldmVsIH1cbiAgTEVWRUxfVVBEQVRFRDogJ2hsc0xldmVsVXBkYXRlZCcsXG4gIC8vIGZpcmVkIHdoZW4gYSBsZXZlbCdzIFBUUyBpbmZvcm1hdGlvbiBoYXMgYmVlbiB1cGRhdGVkIGFmdGVyIHBhcnNpbmcgYSBmcmFnbWVudCAtIGRhdGE6IHsgZGV0YWlscyA6IGxldmVsRGV0YWlscyBvYmplY3QsIGxldmVsIDogaWQgb2YgdXBkYXRlZCBsZXZlbCwgZHJpZnQ6IFBUUyBkcmlmdCBvYnNlcnZlZCB3aGVuIHBhcnNpbmcgbGFzdCBmcmFnbWVudCB9XG4gIExFVkVMX1BUU19VUERBVEVEOiAnaGxzTGV2ZWxQdHNVcGRhdGVkJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGxldmVsIHN3aXRjaCBpcyByZXF1ZXN0ZWQgLSBkYXRhOiB7IGxldmVsIDogaWQgb2YgbmV3IGxldmVsIH1cbiAgTEVWRUxfU1dJVENIOiAnaGxzTGV2ZWxTd2l0Y2gnLFxuICAvLyBmaXJlZCB3aGVuIGEgZnJhZ21lbnQgbG9hZGluZyBzdGFydHMgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3R9XG4gIEZSQUdfTE9BRElORzogJ2hsc0ZyYWdMb2FkaW5nJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGZyYWdtZW50IGxvYWRpbmcgaXMgcHJvZ3Jlc3NpbmcgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QsIHsgdHJlcXVlc3QsIHRmaXJzdCwgbG9hZGVkfX1cbiAgRlJBR19MT0FEX1BST0dSRVNTOiAnaGxzRnJhZ0xvYWRQcm9ncmVzcycsXG4gIC8vIElkZW50aWZpZXIgZm9yIGZyYWdtZW50IGxvYWQgYWJvcnRpbmcgZm9yIGVtZXJnZW5jeSBzd2l0Y2ggZG93biAtIGRhdGE6IHtmcmFnIDogZnJhZ21lbnQgb2JqZWN0fVxuICBGUkFHX0xPQURfRU1FUkdFTkNZX0FCT1JURUQ6ICdobHNGcmFnTG9hZEVtZXJnZW5jeUFib3J0ZWQnLFxuICAvLyBmaXJlZCB3aGVuIGEgZnJhZ21lbnQgbG9hZGluZyBpcyBjb21wbGV0ZWQgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QsIHBheWxvYWQgOiBmcmFnbWVudCBwYXlsb2FkLCBzdGF0cyA6IHsgdHJlcXVlc3QsIHRmaXJzdCwgdGxvYWQsIGxlbmd0aH19XG4gIEZSQUdfTE9BREVEOiAnaGxzRnJhZ0xvYWRlZCcsXG4gIC8vIGZpcmVkIHdoZW4gSW5pdCBTZWdtZW50IGhhcyBiZWVuIGV4dHJhY3RlZCBmcm9tIGZyYWdtZW50IC0gZGF0YTogeyBtb292IDogbW9vdiBNUDQgYm94LCBjb2RlY3MgOiBjb2RlY3MgZm91bmQgd2hpbGUgcGFyc2luZyBmcmFnbWVudH1cbiAgRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVDogJ2hsc0ZyYWdQYXJzaW5nSW5pdFNlZ21lbnQnLFxuICAvLyBmaXJlZCB3aGVuIHBhcnNpbmcgc2VpIHRleHQgaXMgY29tcGxldGVkIC0gZGF0YTogeyBzYW1wbGVzIDogWyBzZWkgc2FtcGxlcyBwZXMgXSB9XG4gIEZSQUdfUEFSU0lOR19VU0VSREFUQTogJ2hsc0ZyYVBhcnNpbmdVc2VyZGF0YScsXG4gIC8vIGZpcmVkIHdoZW4gcGFyc2luZyBpZDMgaXMgY29tcGxldGVkIC0gZGF0YTogeyBzYW1wbGVzIDogWyBpZDMgc2FtcGxlcyBwZXMgXSB9XG4gIEZSQUdfUEFSU0lOR19NRVRBREFUQTogJ2hsc0ZyYWdQYXJzaW5nTWV0YWRhdGEnLFxuICAvLyBmaXJlZCB3aGVuIG1vb2YvbWRhdCBoYXZlIGJlZW4gZXh0cmFjdGVkIGZyb20gZnJhZ21lbnQgLSBkYXRhOiB7IG1vb2YgOiBtb29mIE1QNCBib3gsIG1kYXQgOiBtZGF0IE1QNCBib3h9XG4gIEZSQUdfUEFSU0lOR19EQVRBOiAnaGxzRnJhZ1BhcnNpbmdEYXRhJyxcbiAgLy8gZmlyZWQgd2hlbiBmcmFnbWVudCBwYXJzaW5nIGlzIGNvbXBsZXRlZCAtIGRhdGE6IHVuZGVmaW5lZFxuICBGUkFHX1BBUlNFRDogJ2hsc0ZyYWdQYXJzZWQnLFxuICAvLyBmaXJlZCB3aGVuIGZyYWdtZW50IHJlbXV4ZWQgTVA0IGJveGVzIGhhdmUgYWxsIGJlZW4gYXBwZW5kZWQgaW50byBTb3VyY2VCdWZmZXIgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QsIHN0YXRzIDogeyB0cmVxdWVzdCwgdGZpcnN0LCB0bG9hZCwgdHBhcnNlZCwgdGJ1ZmZlcmVkLCBsZW5ndGh9IH1cbiAgRlJBR19CVUZGRVJFRDogJ2hsc0ZyYWdCdWZmZXJlZCcsXG4gIC8vIGZpcmVkIHdoZW4gZnJhZ21lbnQgbWF0Y2hpbmcgd2l0aCBjdXJyZW50IG1lZGlhIHBvc2l0aW9uIGlzIGNoYW5naW5nIC0gZGF0YSA6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdCB9XG4gIEZSQUdfQ0hBTkdFRDogJ2hsc0ZyYWdDaGFuZ2VkJyxcbiAgICAvLyBJZGVudGlmaWVyIGZvciBhIEZQUyBkcm9wIGV2ZW50IC0gZGF0YToge2N1cmVudERyb3BwZWQsIGN1cnJlbnREZWNvZGVkLCB0b3RhbERyb3BwZWRGcmFtZXN9XG4gIEZQU19EUk9QOiAnaGxzRnBzRHJvcCcsXG4gIC8vIElkZW50aWZpZXIgZm9yIGFuIGVycm9yIGV2ZW50IC0gZGF0YTogeyB0eXBlIDogZXJyb3IgdHlwZSwgZGV0YWlscyA6IGVycm9yIGRldGFpbHMsIGZhdGFsIDogaWYgdHJ1ZSwgaGxzLmpzIGNhbm5vdC93aWxsIG5vdCB0cnkgdG8gcmVjb3ZlciwgaWYgZmFsc2UsIGhscy5qcyB3aWxsIHRyeSB0byByZWNvdmVyLG90aGVyIGVycm9yIHNwZWNpZmljIGRhdGF9XG4gIEVSUk9SOiAnaGxzRXJyb3InLFxuICAvLyBmaXJlZCB3aGVuIGhscy5qcyBpbnN0YW5jZSBzdGFydHMgZGVzdHJveWluZy4gRGlmZmVyZW50IGZyb20gTUVESUFfREVUQUNIRUQgYXMgb25lIGNvdWxkIHdhbnQgdG8gZGV0YWNoIGFuZCByZWF0dGFjaCBhIG1lZGlhIHRvIHRoZSBpbnN0YW5jZSBvZiBobHMuanMgdG8gaGFuZGxlIG1pZC1yb2xscyBmb3IgZXhhbXBsZVxuICBERVNUUk9ZSU5HOiAnaGxzRGVzdHJveWluZycsXG4gIC8vIGZpcmVkIHdoZW4gYSBkZWNyeXB0IGtleSBsb2FkaW5nIHN0YXJ0cyAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdH1cbiAgS0VZX0xPQURJTkc6ICdobHNLZXlMb2FkaW5nJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGRlY3J5cHQga2V5IGxvYWRpbmcgaXMgY29tcGxldGVkIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0LCBwYXlsb2FkIDoga2V5IHBheWxvYWQsIHN0YXRzIDogeyB0cmVxdWVzdCwgdGZpcnN0LCB0bG9hZCwgbGVuZ3RofX1cbiAgS0VZX0xPQURFRDogJ2hsc0tleUxvYWRlZCcsXG59O1xuIiwiLyoqXG4gKiBMZXZlbCBIZWxwZXIgY2xhc3MsIHByb3ZpZGluZyBtZXRob2RzIGRlYWxpbmcgd2l0aCBwbGF5bGlzdCBzbGlkaW5nIGFuZCBkcmlmdFxuKi9cblxuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5cbmNsYXNzIExldmVsSGVscGVyIHtcblxuICBzdGF0aWMgbWVyZ2VEZXRhaWxzKG9sZERldGFpbHMsbmV3RGV0YWlscykge1xuICAgIHZhciBzdGFydCA9IE1hdGgubWF4KG9sZERldGFpbHMuc3RhcnRTTixuZXdEZXRhaWxzLnN0YXJ0U04pLW5ld0RldGFpbHMuc3RhcnRTTixcbiAgICAgICAgZW5kID0gTWF0aC5taW4ob2xkRGV0YWlscy5lbmRTTixuZXdEZXRhaWxzLmVuZFNOKS1uZXdEZXRhaWxzLnN0YXJ0U04sXG4gICAgICAgIGRlbHRhID0gbmV3RGV0YWlscy5zdGFydFNOIC0gb2xkRGV0YWlscy5zdGFydFNOLFxuICAgICAgICBvbGRmcmFnbWVudHMgPSBvbGREZXRhaWxzLmZyYWdtZW50cyxcbiAgICAgICAgbmV3ZnJhZ21lbnRzID0gbmV3RGV0YWlscy5mcmFnbWVudHMsXG4gICAgICAgIGNjT2Zmc2V0ID0wLFxuICAgICAgICBQVFNGcmFnO1xuXG4gICAgLy8gY2hlY2sgaWYgb2xkL25ldyBwbGF5bGlzdHMgaGF2ZSBmcmFnbWVudHMgaW4gY29tbW9uXG4gICAgaWYgKCBlbmQgPCBzdGFydCkge1xuICAgICAgbmV3RGV0YWlscy5QVFNLbm93biA9IGZhbHNlO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvLyBsb29wIHRocm91Z2ggb3ZlcmxhcHBpbmcgU04gYW5kIHVwZGF0ZSBzdGFydFBUUyAsIGNjLCBhbmQgZHVyYXRpb24gaWYgYW55IGZvdW5kXG4gICAgZm9yKHZhciBpID0gc3RhcnQgOyBpIDw9IGVuZCA7IGkrKykge1xuICAgICAgdmFyIG9sZEZyYWcgPSBvbGRmcmFnbWVudHNbZGVsdGEraV0sXG4gICAgICAgICAgbmV3RnJhZyA9IG5ld2ZyYWdtZW50c1tpXTtcbiAgICAgIGNjT2Zmc2V0ID0gb2xkRnJhZy5jYyAtIG5ld0ZyYWcuY2M7XG4gICAgICBpZiAoIWlzTmFOKG9sZEZyYWcuc3RhcnRQVFMpKSB7XG4gICAgICAgIG5ld0ZyYWcuc3RhcnQgPSBuZXdGcmFnLnN0YXJ0UFRTID0gb2xkRnJhZy5zdGFydFBUUztcbiAgICAgICAgbmV3RnJhZy5lbmRQVFMgPSBvbGRGcmFnLmVuZFBUUztcbiAgICAgICAgbmV3RnJhZy5kdXJhdGlvbiA9IG9sZEZyYWcuZHVyYXRpb247XG4gICAgICAgIFBUU0ZyYWcgPSBuZXdGcmFnO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmKGNjT2Zmc2V0KSB7XG4gICAgICBsb2dnZXIubG9nKGBkaXNjb250aW51aXR5IHNsaWRpbmcgZnJvbSBwbGF5bGlzdCwgdGFrZSBkcmlmdCBpbnRvIGFjY291bnRgKTtcbiAgICAgIGZvcihpID0gMCA7IGkgPCBuZXdmcmFnbWVudHMubGVuZ3RoIDsgaSsrKSB7XG4gICAgICAgIG5ld2ZyYWdtZW50c1tpXS5jYyArPSBjY09mZnNldDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBpZiBhdCBsZWFzdCBvbmUgZnJhZ21lbnQgY29udGFpbnMgUFRTIGluZm8sIHJlY29tcHV0ZSBQVFMgaW5mb3JtYXRpb24gZm9yIGFsbCBmcmFnbWVudHNcbiAgICBpZihQVFNGcmFnKSB7XG4gICAgICBMZXZlbEhlbHBlci51cGRhdGVGcmFnUFRTKG5ld0RldGFpbHMsUFRTRnJhZy5zbixQVFNGcmFnLnN0YXJ0UFRTLFBUU0ZyYWcuZW5kUFRTKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gYWRqdXN0IHN0YXJ0IGJ5IHNsaWRpbmcgb2Zmc2V0XG4gICAgICB2YXIgc2xpZGluZyA9IG9sZGZyYWdtZW50c1tkZWx0YV0uc3RhcnQ7XG4gICAgICBmb3IoaSA9IDAgOyBpIDwgbmV3ZnJhZ21lbnRzLmxlbmd0aCA7IGkrKykge1xuICAgICAgICBuZXdmcmFnbWVudHNbaV0uc3RhcnQgKz0gc2xpZGluZztcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gaWYgd2UgYXJlIGhlcmUsIGl0IG1lYW5zIHdlIGhhdmUgZnJhZ21lbnRzIG92ZXJsYXBwaW5nIGJldHdlZW5cbiAgICAvLyBvbGQgYW5kIG5ldyBsZXZlbC4gcmVsaWFibGUgUFRTIGluZm8gaXMgdGh1cyByZWx5aW5nIG9uIG9sZCBsZXZlbFxuICAgIG5ld0RldGFpbHMuUFRTS25vd24gPSBvbGREZXRhaWxzLlBUU0tub3duO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHN0YXRpYyB1cGRhdGVGcmFnUFRTKGRldGFpbHMsc24sc3RhcnRQVFMsZW5kUFRTKSB7XG4gICAgdmFyIGZyYWdJZHgsIGZyYWdtZW50cywgZnJhZywgaTtcbiAgICAvLyBleGl0IGlmIHNuIG91dCBvZiByYW5nZVxuICAgIGlmIChzbiA8IGRldGFpbHMuc3RhcnRTTiB8fCBzbiA+IGRldGFpbHMuZW5kU04pIHtcbiAgICAgIHJldHVybiAwO1xuICAgIH1cbiAgICBmcmFnSWR4ID0gc24gLSBkZXRhaWxzLnN0YXJ0U047XG4gICAgZnJhZ21lbnRzID0gZGV0YWlscy5mcmFnbWVudHM7XG4gICAgZnJhZyA9IGZyYWdtZW50c1tmcmFnSWR4XTtcbiAgICBpZighaXNOYU4oZnJhZy5zdGFydFBUUykpIHtcbiAgICAgIHN0YXJ0UFRTID0gTWF0aC5taW4oc3RhcnRQVFMsZnJhZy5zdGFydFBUUyk7XG4gICAgICBlbmRQVFMgPSBNYXRoLm1heChlbmRQVFMsIGZyYWcuZW5kUFRTKTtcbiAgICB9XG5cbiAgICB2YXIgZHJpZnQgPSBzdGFydFBUUyAtIGZyYWcuc3RhcnQ7XG5cbiAgICBmcmFnLnN0YXJ0ID0gZnJhZy5zdGFydFBUUyA9IHN0YXJ0UFRTO1xuICAgIGZyYWcuZW5kUFRTID0gZW5kUFRTO1xuICAgIGZyYWcuZHVyYXRpb24gPSBlbmRQVFMgLSBzdGFydFBUUztcbiAgICAvLyBhZGp1c3QgZnJhZ21lbnQgUFRTL2R1cmF0aW9uIGZyb20gc2VxbnVtLTEgdG8gZnJhZyAwXG4gICAgZm9yKGkgPSBmcmFnSWR4IDsgaSA+IDAgOyBpLS0pIHtcbiAgICAgIExldmVsSGVscGVyLnVwZGF0ZVBUUyhmcmFnbWVudHMsaSxpLTEpO1xuICAgIH1cblxuICAgIC8vIGFkanVzdCBmcmFnbWVudCBQVFMvZHVyYXRpb24gZnJvbSBzZXFudW0gdG8gbGFzdCBmcmFnXG4gICAgZm9yKGkgPSBmcmFnSWR4IDsgaSA8IGZyYWdtZW50cy5sZW5ndGggLSAxIDsgaSsrKSB7XG4gICAgICBMZXZlbEhlbHBlci51cGRhdGVQVFMoZnJhZ21lbnRzLGksaSsxKTtcbiAgICB9XG4gICAgZGV0YWlscy5QVFNLbm93biA9IHRydWU7XG4gICAgLy9sb2dnZXIubG9nKGAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyYWcgc3RhcnQvZW5kOiR7c3RhcnRQVFMudG9GaXhlZCgzKX0vJHtlbmRQVFMudG9GaXhlZCgzKX1gKTtcblxuICAgIHJldHVybiBkcmlmdDtcbiAgfVxuXG4gIHN0YXRpYyB1cGRhdGVQVFMoZnJhZ21lbnRzLGZyb21JZHgsIHRvSWR4KSB7XG4gICAgdmFyIGZyYWdGcm9tID0gZnJhZ21lbnRzW2Zyb21JZHhdLGZyYWdUbyA9IGZyYWdtZW50c1t0b0lkeF0sIGZyYWdUb1BUUyA9IGZyYWdUby5zdGFydFBUUztcbiAgICAvLyBpZiB3ZSBrbm93IHN0YXJ0UFRTW3RvSWR4XVxuICAgIGlmKCFpc05hTihmcmFnVG9QVFMpKSB7XG4gICAgICAvLyB1cGRhdGUgZnJhZ21lbnQgZHVyYXRpb24uXG4gICAgICAvLyBpdCBoZWxwcyB0byBmaXggZHJpZnRzIGJldHdlZW4gcGxheWxpc3QgcmVwb3J0ZWQgZHVyYXRpb24gYW5kIGZyYWdtZW50IHJlYWwgZHVyYXRpb25cbiAgICAgIGlmICh0b0lkeCA+IGZyb21JZHgpIHtcbiAgICAgICAgZnJhZ0Zyb20uZHVyYXRpb24gPSBmcmFnVG9QVFMtZnJhZ0Zyb20uc3RhcnQ7XG4gICAgICAgIGlmKGZyYWdGcm9tLmR1cmF0aW9uIDwgMCkge1xuICAgICAgICAgIGxvZ2dlci5lcnJvcihgbmVnYXRpdmUgZHVyYXRpb24gY29tcHV0ZWQgZm9yIGZyYWcgJHtmcmFnRnJvbS5zbn0sbGV2ZWwgJHtmcmFnRnJvbS5sZXZlbH0sIHRoZXJlIHNob3VsZCBiZSBzb21lIGR1cmF0aW9uIGRyaWZ0IGJldHdlZW4gcGxheWxpc3QgYW5kIGZyYWdtZW50IWApO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmcmFnVG8uZHVyYXRpb24gPSBmcmFnRnJvbS5zdGFydCAtIGZyYWdUb1BUUztcbiAgICAgICAgaWYoZnJhZ1RvLmR1cmF0aW9uIDwgMCkge1xuICAgICAgICAgIGxvZ2dlci5lcnJvcihgbmVnYXRpdmUgZHVyYXRpb24gY29tcHV0ZWQgZm9yIGZyYWcgJHtmcmFnVG8uc259LGxldmVsICR7ZnJhZ1RvLmxldmVsfSwgdGhlcmUgc2hvdWxkIGJlIHNvbWUgZHVyYXRpb24gZHJpZnQgYmV0d2VlbiBwbGF5bGlzdCBhbmQgZnJhZ21lbnQhYCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gd2UgZG9udCBrbm93IHN0YXJ0UFRTW3RvSWR4XVxuICAgICAgaWYgKHRvSWR4ID4gZnJvbUlkeCkge1xuICAgICAgICBmcmFnVG8uc3RhcnQgPSBmcmFnRnJvbS5zdGFydCArIGZyYWdGcm9tLmR1cmF0aW9uO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZnJhZ1RvLnN0YXJ0ID0gZnJhZ0Zyb20uc3RhcnQgLSBmcmFnVG8uZHVyYXRpb247XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IExldmVsSGVscGVyO1xuIiwiLyoqXG4gKiBITFMgaW50ZXJmYWNlXG4gKi9cbid1c2Ugc3RyaWN0JztcblxuaW1wb3J0IEV2ZW50IGZyb20gJy4vZXZlbnRzJztcbmltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuL2Vycm9ycyc7XG5pbXBvcnQgUGxheWxpc3RMb2FkZXIgZnJvbSAnLi9sb2FkZXIvcGxheWxpc3QtbG9hZGVyJztcbmltcG9ydCBGcmFnbWVudExvYWRlciBmcm9tICcuL2xvYWRlci9mcmFnbWVudC1sb2FkZXInO1xuaW1wb3J0IEFickNvbnRyb2xsZXIgZnJvbSAgICAnLi9jb250cm9sbGVyL2Fici1jb250cm9sbGVyJztcbmltcG9ydCBNU0VNZWRpYUNvbnRyb2xsZXIgZnJvbSAnLi9jb250cm9sbGVyL21zZS1tZWRpYS1jb250cm9sbGVyJztcbmltcG9ydCBMZXZlbENvbnRyb2xsZXIgZnJvbSAgJy4vY29udHJvbGxlci9sZXZlbC1jb250cm9sbGVyJztcbmltcG9ydCBUaW1lbGluZUNvbnRyb2xsZXIgZnJvbSAnLi9jb250cm9sbGVyL3RpbWVsaW5lLWNvbnRyb2xsZXInO1xuLy9pbXBvcnQgRlBTQ29udHJvbGxlciBmcm9tICcuL2NvbnRyb2xsZXIvZnBzLWNvbnRyb2xsZXInO1xuaW1wb3J0IHtsb2dnZXIsIGVuYWJsZUxvZ3N9IGZyb20gJy4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCBYaHJMb2FkZXIgZnJvbSAnLi91dGlscy94aHItbG9hZGVyJztcbmltcG9ydCBFdmVudEVtaXR0ZXIgZnJvbSAnZXZlbnRzJztcbmltcG9ydCBLZXlMb2FkZXIgZnJvbSAnLi9sb2FkZXIva2V5LWxvYWRlcic7XG5cbmNsYXNzIEhscyB7XG5cbiAgc3RhdGljIGlzU3VwcG9ydGVkKCkge1xuICAgIHJldHVybiAod2luZG93Lk1lZGlhU291cmNlICYmIHdpbmRvdy5NZWRpYVNvdXJjZS5pc1R5cGVTdXBwb3J0ZWQoJ3ZpZGVvL21wNDsgY29kZWNzPVwiYXZjMS40MkUwMUUsbXA0YS40MC4yXCInKSk7XG4gIH1cblxuICBzdGF0aWMgZ2V0IEV2ZW50cygpIHtcbiAgICByZXR1cm4gRXZlbnQ7XG4gIH1cblxuICBzdGF0aWMgZ2V0IEVycm9yVHlwZXMoKSB7XG4gICAgcmV0dXJuIEVycm9yVHlwZXM7XG4gIH1cblxuICBzdGF0aWMgZ2V0IEVycm9yRGV0YWlscygpIHtcbiAgICByZXR1cm4gRXJyb3JEZXRhaWxzO1xuICB9XG5cbiAgc3RhdGljIGdldCBEZWZhdWx0Q29uZmlnKCkge1xuICAgIGlmKCFIbHMuZGVmYXVsdENvbmZpZykge1xuICAgICAgIEhscy5kZWZhdWx0Q29uZmlnID0ge1xuICAgICAgICAgIGF1dG9TdGFydExvYWQ6IHRydWUsXG4gICAgICAgICAgZGVidWc6IGZhbHNlLFxuICAgICAgICAgIG1heEJ1ZmZlckxlbmd0aDogMzAsXG4gICAgICAgICAgbWF4QnVmZmVyU2l6ZTogNjAgKiAxMDAwICogMTAwMCxcbiAgICAgICAgICBtYXhCdWZmZXJIb2xlOiAwLjMsXG4gICAgICAgICAgbWF4U2Vla0hvbGU6IDIsXG4gICAgICAgICAgbGl2ZVN5bmNEdXJhdGlvbkNvdW50OjMsXG4gICAgICAgICAgbGl2ZU1heExhdGVuY3lEdXJhdGlvbkNvdW50OiBJbmZpbml0eSxcbiAgICAgICAgICBtYXhNYXhCdWZmZXJMZW5ndGg6IDYwMCxcbiAgICAgICAgICBlbmFibGVXb3JrZXI6IHRydWUsXG4gICAgICAgICAgZW5hYmxlU29mdHdhcmVBRVM6IHRydWUsXG4gICAgICAgICAgbWFuaWZlc3RMb2FkaW5nVGltZU91dDogMTAwMDAsXG4gICAgICAgICAgbWFuaWZlc3RMb2FkaW5nTWF4UmV0cnk6IDEsXG4gICAgICAgICAgbWFuaWZlc3RMb2FkaW5nUmV0cnlEZWxheTogMTAwMCxcbiAgICAgICAgICBsZXZlbExvYWRpbmdUaW1lT3V0OiAxMDAwMCxcbiAgICAgICAgICBsZXZlbExvYWRpbmdNYXhSZXRyeTogNCxcbiAgICAgICAgICBsZXZlbExvYWRpbmdSZXRyeURlbGF5OiAxMDAwLFxuICAgICAgICAgIGZyYWdMb2FkaW5nVGltZU91dDogMjAwMDAsXG4gICAgICAgICAgZnJhZ0xvYWRpbmdNYXhSZXRyeTogNixcbiAgICAgICAgICBmcmFnTG9hZGluZ1JldHJ5RGVsYXk6IDEwMDAsXG4gICAgICAgICAgZnJhZ0xvYWRpbmdMb29wVGhyZXNob2xkOiAzLFxuICAgICAgICAgIC8vIGZwc0Ryb3BwZWRNb25pdG9yaW5nUGVyaW9kOiA1MDAwLFxuICAgICAgICAgIC8vIGZwc0Ryb3BwZWRNb25pdG9yaW5nVGhyZXNob2xkOiAwLjIsXG4gICAgICAgICAgYXBwZW5kRXJyb3JNYXhSZXRyeTogMyxcbiAgICAgICAgICBsb2FkZXI6IFhockxvYWRlcixcbiAgICAgICAgICBmTG9hZGVyOiB1bmRlZmluZWQsXG4gICAgICAgICAgcExvYWRlcjogdW5kZWZpbmVkLFxuICAgICAgICAgIGFickNvbnRyb2xsZXIgOiBBYnJDb250cm9sbGVyLFxuICAgICAgICAgIG1lZGlhQ29udHJvbGxlcjogTVNFTWVkaWFDb250cm9sbGVyLFxuICAgICAgICAgIHRpbWVsaW5lQ29udHJvbGxlcjogVGltZWxpbmVDb250cm9sbGVyLFxuICAgICAgICAgIGVuYWJsZUNFQTcwOENhcHRpb25zOiB0cnVlXG4gICAgICAgIH07XG4gICAgfVxuICAgIHJldHVybiBIbHMuZGVmYXVsdENvbmZpZztcbiAgfVxuXG4gIHN0YXRpYyBzZXQgRGVmYXVsdENvbmZpZyhkZWZhdWx0Q29uZmlnKSB7XG4gICAgSGxzLmRlZmF1bHRDb25maWcgPSBkZWZhdWx0Q29uZmlnO1xuICB9XG5cbiAgY29uc3RydWN0b3IoY29uZmlnID0ge30pIHtcbiAgICB2YXIgZGVmYXVsdENvbmZpZyA9IEhscy5EZWZhdWx0Q29uZmlnO1xuICAgIGZvciAodmFyIHByb3AgaW4gZGVmYXVsdENvbmZpZykge1xuICAgICAgICBpZiAocHJvcCBpbiBjb25maWcpIHsgY29udGludWU7IH1cbiAgICAgICAgY29uZmlnW3Byb3BdID0gZGVmYXVsdENvbmZpZ1twcm9wXTtcbiAgICB9XG5cbiAgICBpZiAoY29uZmlnLmxpdmVNYXhMYXRlbmN5RHVyYXRpb25Db3VudCAhPT0gdW5kZWZpbmVkICYmIGNvbmZpZy5saXZlTWF4TGF0ZW5jeUR1cmF0aW9uQ291bnQgPD0gY29uZmlnLmxpdmVTeW5jRHVyYXRpb25Db3VudCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbGxlZ2FsIGhscy5qcyBjb25maWc6IFwibGl2ZU1heExhdGVuY3lEdXJhdGlvbkNvdW50XCIgbXVzdCBiZSBndCBcImxpdmVTeW5jRHVyYXRpb25Db3VudFwiJyk7XG4gICAgfVxuXG4gICAgZW5hYmxlTG9ncyhjb25maWcuZGVidWcpO1xuICAgIHRoaXMuY29uZmlnID0gY29uZmlnO1xuICAgIC8vIG9ic2VydmVyIHNldHVwXG4gICAgdmFyIG9ic2VydmVyID0gdGhpcy5vYnNlcnZlciA9IG5ldyBFdmVudEVtaXR0ZXIoKTtcbiAgICBvYnNlcnZlci50cmlnZ2VyID0gZnVuY3Rpb24gdHJpZ2dlciAoZXZlbnQsIC4uLmRhdGEpIHtcbiAgICAgIG9ic2VydmVyLmVtaXQoZXZlbnQsIGV2ZW50LCAuLi5kYXRhKTtcbiAgICB9O1xuXG4gICAgb2JzZXJ2ZXIub2ZmID0gZnVuY3Rpb24gb2ZmIChldmVudCwgLi4uZGF0YSkge1xuICAgICAgb2JzZXJ2ZXIucmVtb3ZlTGlzdGVuZXIoZXZlbnQsIC4uLmRhdGEpO1xuICAgIH07XG4gICAgdGhpcy5vbiA9IG9ic2VydmVyLm9uLmJpbmQob2JzZXJ2ZXIpO1xuICAgIHRoaXMub2ZmID0gb2JzZXJ2ZXIub2ZmLmJpbmQob2JzZXJ2ZXIpO1xuICAgIHRoaXMudHJpZ2dlciA9IG9ic2VydmVyLnRyaWdnZXIuYmluZChvYnNlcnZlcik7XG4gICAgdGhpcy5wbGF5bGlzdExvYWRlciA9IG5ldyBQbGF5bGlzdExvYWRlcih0aGlzKTtcbiAgICB0aGlzLmZyYWdtZW50TG9hZGVyID0gbmV3IEZyYWdtZW50TG9hZGVyKHRoaXMpO1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyID0gbmV3IExldmVsQ29udHJvbGxlcih0aGlzKTtcbiAgICB0aGlzLmFickNvbnRyb2xsZXIgPSBuZXcgY29uZmlnLmFickNvbnRyb2xsZXIodGhpcyk7XG4gICAgdGhpcy5tZWRpYUNvbnRyb2xsZXIgPSBuZXcgY29uZmlnLm1lZGlhQ29udHJvbGxlcih0aGlzKTtcbiAgICB0aGlzLnRpbWVsaW5lQ29udHJvbGxlciA9IG5ldyBjb25maWcudGltZWxpbmVDb250cm9sbGVyKHRoaXMpO1xuICAgIHRoaXMua2V5TG9hZGVyID0gbmV3IEtleUxvYWRlcih0aGlzKTtcbiAgICAvL3RoaXMuZnBzQ29udHJvbGxlciA9IG5ldyBGUFNDb250cm9sbGVyKHRoaXMpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBsb2dnZXIubG9nKCdkZXN0cm95Jyk7XG4gICAgdGhpcy50cmlnZ2VyKEV2ZW50LkRFU1RST1lJTkcpO1xuICAgIHRoaXMuZGV0YWNoTWVkaWEoKTtcbiAgICB0aGlzLnBsYXlsaXN0TG9hZGVyLmRlc3Ryb3koKTtcbiAgICB0aGlzLmZyYWdtZW50TG9hZGVyLmRlc3Ryb3koKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5kZXN0cm95KCk7XG4gICAgdGhpcy5tZWRpYUNvbnRyb2xsZXIuZGVzdHJveSgpO1xuICAgIHRoaXMudGltZWxpbmVDb250cm9sbGVyLmRlc3Ryb3koKTtcbiAgICB0aGlzLmtleUxvYWRlci5kZXN0cm95KCk7XG4gICAgLy90aGlzLmZwc0NvbnRyb2xsZXIuZGVzdHJveSgpO1xuICAgIHRoaXMudXJsID0gbnVsbDtcbiAgICB0aGlzLm9ic2VydmVyLnJlbW92ZUFsbExpc3RlbmVycygpO1xuICB9XG5cbiAgYXR0YWNoTWVkaWEobWVkaWEpIHtcbiAgICBsb2dnZXIubG9nKCdhdHRhY2hNZWRpYScpO1xuICAgIHRoaXMubWVkaWEgPSBtZWRpYTtcbiAgICB0aGlzLnRyaWdnZXIoRXZlbnQuTUVESUFfQVRUQUNISU5HLCB7bWVkaWE6IG1lZGlhfSk7XG4gIH1cblxuICBkZXRhY2hNZWRpYSgpIHtcbiAgICBsb2dnZXIubG9nKCdkZXRhY2hNZWRpYScpO1xuICAgIHRoaXMudHJpZ2dlcihFdmVudC5NRURJQV9ERVRBQ0hJTkcpO1xuICAgIHRoaXMubWVkaWEgPSBudWxsO1xuICB9XG5cbiAgbG9hZFNvdXJjZSh1cmwpIHtcbiAgICBsb2dnZXIubG9nKGBsb2FkU291cmNlOiR7dXJsfWApO1xuICAgIHRoaXMudXJsID0gdXJsO1xuICAgIC8vIHdoZW4gYXR0YWNoaW5nIHRvIGEgc291cmNlIFVSTCwgdHJpZ2dlciBhIHBsYXlsaXN0IGxvYWRcbiAgICB0aGlzLnRyaWdnZXIoRXZlbnQuTUFOSUZFU1RfTE9BRElORywge3VybDogdXJsfSk7XG4gIH1cblxuICBzdGFydExvYWQoKSB7XG4gICAgbG9nZ2VyLmxvZygnc3RhcnRMb2FkJyk7XG4gICAgdGhpcy5tZWRpYUNvbnRyb2xsZXIuc3RhcnRMb2FkKCk7XG4gIH1cblxuICBzd2FwQXVkaW9Db2RlYygpIHtcbiAgICBsb2dnZXIubG9nKCdzd2FwQXVkaW9Db2RlYycpO1xuICAgIHRoaXMubWVkaWFDb250cm9sbGVyLnN3YXBBdWRpb0NvZGVjKCk7XG4gIH1cblxuICByZWNvdmVyTWVkaWFFcnJvcigpIHtcbiAgICBsb2dnZXIubG9nKCdyZWNvdmVyTWVkaWFFcnJvcicpO1xuICAgIHZhciBtZWRpYSA9IHRoaXMubWVkaWE7XG4gICAgdGhpcy5kZXRhY2hNZWRpYSgpO1xuICAgIHRoaXMuYXR0YWNoTWVkaWEobWVkaWEpO1xuICB9XG5cbiAgLyoqIFJldHVybiBhbGwgcXVhbGl0eSBsZXZlbHMgKiovXG4gIGdldCBsZXZlbHMoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLmxldmVscztcbiAgfVxuXG4gIC8qKiBSZXR1cm4gY3VycmVudCBwbGF5YmFjayBxdWFsaXR5IGxldmVsICoqL1xuICBnZXQgY3VycmVudExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLm1lZGlhQ29udHJvbGxlci5jdXJyZW50TGV2ZWw7XG4gIH1cblxuICAvKiBzZXQgcXVhbGl0eSBsZXZlbCBpbW1lZGlhdGVseSAoLTEgZm9yIGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24pICovXG4gIHNldCBjdXJyZW50TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICBsb2dnZXIubG9nKGBzZXQgY3VycmVudExldmVsOiR7bmV3TGV2ZWx9YCk7XG4gICAgdGhpcy5sb2FkTGV2ZWwgPSBuZXdMZXZlbDtcbiAgICB0aGlzLm1lZGlhQ29udHJvbGxlci5pbW1lZGlhdGVMZXZlbFN3aXRjaCgpO1xuICB9XG5cbiAgLyoqIFJldHVybiBuZXh0IHBsYXliYWNrIHF1YWxpdHkgbGV2ZWwgKHF1YWxpdHkgbGV2ZWwgb2YgbmV4dCBmcmFnbWVudCkgKiovXG4gIGdldCBuZXh0TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubWVkaWFDb250cm9sbGVyLm5leHRMZXZlbDtcbiAgfVxuXG4gIC8qIHNldCBxdWFsaXR5IGxldmVsIGZvciBuZXh0IGZyYWdtZW50ICgtMSBmb3IgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbikgKi9cbiAgc2V0IG5leHRMZXZlbChuZXdMZXZlbCkge1xuICAgIGxvZ2dlci5sb2coYHNldCBuZXh0TGV2ZWw6JHtuZXdMZXZlbH1gKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5tYW51YWxMZXZlbCA9IG5ld0xldmVsO1xuICAgIHRoaXMubWVkaWFDb250cm9sbGVyLm5leHRMZXZlbFN3aXRjaCgpO1xuICB9XG5cbiAgLyoqIFJldHVybiB0aGUgcXVhbGl0eSBsZXZlbCBvZiBjdXJyZW50L2xhc3QgbG9hZGVkIGZyYWdtZW50ICoqL1xuICBnZXQgbG9hZExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLmxldmVsQ29udHJvbGxlci5sZXZlbDtcbiAgfVxuXG4gIC8qIHNldCBxdWFsaXR5IGxldmVsIGZvciBjdXJyZW50L25leHQgbG9hZGVkIGZyYWdtZW50ICgtMSBmb3IgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbikgKi9cbiAgc2V0IGxvYWRMZXZlbChuZXdMZXZlbCkge1xuICAgIGxvZ2dlci5sb2coYHNldCBsb2FkTGV2ZWw6JHtuZXdMZXZlbH1gKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5tYW51YWxMZXZlbCA9IG5ld0xldmVsO1xuICB9XG5cbiAgLyoqIFJldHVybiB0aGUgcXVhbGl0eSBsZXZlbCBvZiBuZXh0IGxvYWRlZCBmcmFnbWVudCAqKi9cbiAgZ2V0IG5leHRMb2FkTGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLm5leHRMb2FkTGV2ZWwoKTtcbiAgfVxuXG4gIC8qKiBzZXQgcXVhbGl0eSBsZXZlbCBvZiBuZXh0IGxvYWRlZCBmcmFnbWVudCAqKi9cbiAgc2V0IG5leHRMb2FkTGV2ZWwobGV2ZWwpIHtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5sZXZlbCA9IGxldmVsO1xuICB9XG5cbiAgLyoqIFJldHVybiBmaXJzdCBsZXZlbCAoaW5kZXggb2YgZmlyc3QgbGV2ZWwgcmVmZXJlbmNlZCBpbiBtYW5pZmVzdClcbiAgKiovXG4gIGdldCBmaXJzdExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLmxldmVsQ29udHJvbGxlci5maXJzdExldmVsO1xuICB9XG5cbiAgLyoqIHNldCBmaXJzdCBsZXZlbCAoaW5kZXggb2YgZmlyc3QgbGV2ZWwgcmVmZXJlbmNlZCBpbiBtYW5pZmVzdClcbiAgKiovXG4gIHNldCBmaXJzdExldmVsKG5ld0xldmVsKSB7XG4gICAgbG9nZ2VyLmxvZyhgc2V0IGZpcnN0TGV2ZWw6JHtuZXdMZXZlbH1gKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5maXJzdExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICAvKiogUmV0dXJuIHN0YXJ0IGxldmVsIChsZXZlbCBvZiBmaXJzdCBmcmFnbWVudCB0aGF0IHdpbGwgYmUgcGxheWVkIGJhY2spXG4gICAgICBpZiBub3Qgb3ZlcnJpZGVkIGJ5IHVzZXIsIGZpcnN0IGxldmVsIGFwcGVhcmluZyBpbiBtYW5pZmVzdCB3aWxsIGJlIHVzZWQgYXMgc3RhcnQgbGV2ZWxcbiAgICAgIGlmIC0xIDogYXV0b21hdGljIHN0YXJ0IGxldmVsIHNlbGVjdGlvbiwgcGxheWJhY2sgd2lsbCBzdGFydCBmcm9tIGxldmVsIG1hdGNoaW5nIGRvd25sb2FkIGJhbmR3aWR0aCAoZGV0ZXJtaW5lZCBmcm9tIGRvd25sb2FkIG9mIGZpcnN0IHNlZ21lbnQpXG4gICoqL1xuICBnZXQgc3RhcnRMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIuc3RhcnRMZXZlbDtcbiAgfVxuXG4gIC8qKiBzZXQgIHN0YXJ0IGxldmVsIChsZXZlbCBvZiBmaXJzdCBmcmFnbWVudCB0aGF0IHdpbGwgYmUgcGxheWVkIGJhY2spXG4gICAgICBpZiBub3Qgb3ZlcnJpZGVkIGJ5IHVzZXIsIGZpcnN0IGxldmVsIGFwcGVhcmluZyBpbiBtYW5pZmVzdCB3aWxsIGJlIHVzZWQgYXMgc3RhcnQgbGV2ZWxcbiAgICAgIGlmIC0xIDogYXV0b21hdGljIHN0YXJ0IGxldmVsIHNlbGVjdGlvbiwgcGxheWJhY2sgd2lsbCBzdGFydCBmcm9tIGxldmVsIG1hdGNoaW5nIGRvd25sb2FkIGJhbmR3aWR0aCAoZGV0ZXJtaW5lZCBmcm9tIGRvd25sb2FkIG9mIGZpcnN0IHNlZ21lbnQpXG4gICoqL1xuICBzZXQgc3RhcnRMZXZlbChuZXdMZXZlbCkge1xuICAgIGxvZ2dlci5sb2coYHNldCBzdGFydExldmVsOiR7bmV3TGV2ZWx9YCk7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIuc3RhcnRMZXZlbCA9IG5ld0xldmVsO1xuICB9XG5cbiAgLyoqIFJldHVybiB0aGUgY2FwcGluZy9tYXggbGV2ZWwgdmFsdWUgdGhhdCBjb3VsZCBiZSB1c2VkIGJ5IGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24gYWxnb3JpdGhtICoqL1xuICBnZXQgYXV0b0xldmVsQ2FwcGluZygpIHtcbiAgICByZXR1cm4gdGhpcy5hYnJDb250cm9sbGVyLmF1dG9MZXZlbENhcHBpbmc7XG4gIH1cblxuICAvKiogc2V0IHRoZSBjYXBwaW5nL21heCBsZXZlbCB2YWx1ZSB0aGF0IGNvdWxkIGJlIHVzZWQgYnkgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBhbGdvcml0aG0gKiovXG4gIHNldCBhdXRvTGV2ZWxDYXBwaW5nKG5ld0xldmVsKSB7XG4gICAgbG9nZ2VyLmxvZyhgc2V0IGF1dG9MZXZlbENhcHBpbmc6JHtuZXdMZXZlbH1gKTtcbiAgICB0aGlzLmFickNvbnRyb2xsZXIuYXV0b0xldmVsQ2FwcGluZyA9IG5ld0xldmVsO1xuICB9XG5cbiAgLyogY2hlY2sgaWYgd2UgYXJlIGluIGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24gbW9kZSAqL1xuICBnZXQgYXV0b0xldmVsRW5hYmxlZCgpIHtcbiAgICByZXR1cm4gKHRoaXMubGV2ZWxDb250cm9sbGVyLm1hbnVhbExldmVsID09PSAtMSk7XG4gIH1cblxuICAvKiByZXR1cm4gbWFudWFsIGxldmVsICovXG4gIGdldCBtYW51YWxMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIubWFudWFsTGV2ZWw7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgSGxzO1xuIiwiLypcbiAqIEZyYWdtZW50IExvYWRlclxuKi9cblxuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgRXZlbnRIYW5kbGVyIGZyb20gJy4uL2V2ZW50LWhhbmRsZXInO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5cbmNsYXNzIEZyYWdtZW50TG9hZGVyIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMpIHtcbiAgICBzdXBlcihobHMsIEV2ZW50LkZSQUdfTE9BRElORyk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIGlmICh0aGlzLmxvYWRlcikge1xuICAgICAgdGhpcy5sb2FkZXIuZGVzdHJveSgpO1xuICAgICAgdGhpcy5sb2FkZXIgPSBudWxsO1xuICAgIH1cbiAgICBFdmVudEhhbmRsZXIucHJvdG90eXBlLmRlc3Ryb3kuY2FsbCh0aGlzKTtcbiAgfVxuXG4gIG9uRnJhZ0xvYWRpbmcoZGF0YSkge1xuICAgIHZhciBmcmFnID0gZGF0YS5mcmFnO1xuICAgIHRoaXMuZnJhZyA9IGZyYWc7XG4gICAgdGhpcy5mcmFnLmxvYWRlZCA9IDA7XG4gICAgdmFyIGNvbmZpZyA9IHRoaXMuaGxzLmNvbmZpZztcbiAgICBmcmFnLmxvYWRlciA9IHRoaXMubG9hZGVyID0gdHlwZW9mKGNvbmZpZy5mTG9hZGVyKSAhPT0gJ3VuZGVmaW5lZCcgPyBuZXcgY29uZmlnLmZMb2FkZXIoY29uZmlnKSA6IG5ldyBjb25maWcubG9hZGVyKGNvbmZpZyk7XG4gICAgdGhpcy5sb2FkZXIubG9hZChmcmFnLnVybCwgJ2FycmF5YnVmZmVyJywgdGhpcy5sb2Fkc3VjY2Vzcy5iaW5kKHRoaXMpLCB0aGlzLmxvYWRlcnJvci5iaW5kKHRoaXMpLCB0aGlzLmxvYWR0aW1lb3V0LmJpbmQodGhpcyksIGNvbmZpZy5mcmFnTG9hZGluZ1RpbWVPdXQsIDEsIDAsIHRoaXMubG9hZHByb2dyZXNzLmJpbmQodGhpcyksIGZyYWcpO1xuICB9XG5cbiAgbG9hZHN1Y2Nlc3MoZXZlbnQsIHN0YXRzKSB7XG4gICAgdmFyIHBheWxvYWQgPSBldmVudC5jdXJyZW50VGFyZ2V0LnJlc3BvbnNlO1xuICAgIHN0YXRzLmxlbmd0aCA9IHBheWxvYWQuYnl0ZUxlbmd0aDtcbiAgICAvLyBkZXRhY2ggZnJhZ21lbnQgbG9hZGVyIG9uIGxvYWQgc3VjY2Vzc1xuICAgIHRoaXMuZnJhZy5sb2FkZXIgPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5GUkFHX0xPQURFRCwge3BheWxvYWQ6IHBheWxvYWQsIGZyYWc6IHRoaXMuZnJhZywgc3RhdHM6IHN0YXRzfSk7XG4gIH1cblxuICBsb2FkZXJyb3IoZXZlbnQpIHtcbiAgICB0aGlzLmxvYWRlci5hYm9ydCgpO1xuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5GUkFHX0xPQURfRVJST1IsIGZhdGFsOiBmYWxzZSwgZnJhZzogdGhpcy5mcmFnLCByZXNwb25zZTogZXZlbnR9KTtcbiAgfVxuXG4gIGxvYWR0aW1lb3V0KCkge1xuICAgIHRoaXMubG9hZGVyLmFib3J0KCk7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTkVUV09SS19FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9USU1FT1VULCBmYXRhbDogZmFsc2UsIGZyYWc6IHRoaXMuZnJhZ30pO1xuICB9XG5cbiAgbG9hZHByb2dyZXNzKGV2ZW50LCBzdGF0cykge1xuICAgIHRoaXMuZnJhZy5sb2FkZWQgPSBzdGF0cy5sb2FkZWQ7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5GUkFHX0xPQURfUFJPR1JFU1MsIHtmcmFnOiB0aGlzLmZyYWcsIHN0YXRzOiBzdGF0c30pO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEZyYWdtZW50TG9hZGVyO1xuIiwiLypcbiAqIERlY3J5cHQga2V5IExvYWRlclxuKi9cblxuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgRXZlbnRIYW5kbGVyIGZyb20gJy4uL2V2ZW50LWhhbmRsZXInO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5cbmNsYXNzIEtleUxvYWRlciBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgc3VwZXIoaGxzLCBFdmVudC5LRVlfTE9BRElORyk7XG4gICAgdGhpcy5kZWNyeXB0a2V5ID0gbnVsbDtcbiAgICB0aGlzLmRlY3J5cHR1cmwgPSBudWxsO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBpZiAodGhpcy5sb2FkZXIpIHtcbiAgICAgIHRoaXMubG9hZGVyLmRlc3Ryb3koKTtcbiAgICAgIHRoaXMubG9hZGVyID0gbnVsbDtcbiAgICB9XG4gICAgRXZlbnRIYW5kbGVyLnByb3RvdHlwZS5kZXN0cm95LmNhbGwodGhpcyk7XG4gIH1cblxuICBvbktleUxvYWRpbmcoZGF0YSkge1xuICAgIHZhciBmcmFnID0gdGhpcy5mcmFnID0gZGF0YS5mcmFnLFxuICAgICAgICBkZWNyeXB0ZGF0YSA9IGZyYWcuZGVjcnlwdGRhdGEsXG4gICAgICAgIHVyaSA9IGRlY3J5cHRkYXRhLnVyaTtcbiAgICAgICAgLy8gaWYgdXJpIGlzIGRpZmZlcmVudCBmcm9tIHByZXZpb3VzIG9uZSBvciBpZiBkZWNyeXB0IGtleSBub3QgcmV0cmlldmVkIHlldFxuICAgICAgaWYgKHVyaSAhPT0gdGhpcy5kZWNyeXB0dXJsIHx8IHRoaXMuZGVjcnlwdGtleSA9PT0gbnVsbCkge1xuICAgICAgICB2YXIgY29uZmlnID0gdGhpcy5obHMuY29uZmlnO1xuICAgICAgICBmcmFnLmxvYWRlciA9IHRoaXMubG9hZGVyID0gbmV3IGNvbmZpZy5sb2FkZXIoY29uZmlnKTtcbiAgICAgICAgdGhpcy5kZWNyeXB0dXJsID0gdXJpO1xuICAgICAgICB0aGlzLmRlY3J5cHRrZXkgPSBudWxsO1xuICAgICAgICBmcmFnLmxvYWRlci5sb2FkKHVyaSwgJ2FycmF5YnVmZmVyJywgdGhpcy5sb2Fkc3VjY2Vzcy5iaW5kKHRoaXMpLCB0aGlzLmxvYWRlcnJvci5iaW5kKHRoaXMpLCB0aGlzLmxvYWR0aW1lb3V0LmJpbmQodGhpcyksIGNvbmZpZy5mcmFnTG9hZGluZ1RpbWVPdXQsIGNvbmZpZy5mcmFnTG9hZGluZ01heFJldHJ5LCBjb25maWcuZnJhZ0xvYWRpbmdSZXRyeURlbGF5LCB0aGlzLmxvYWRwcm9ncmVzcy5iaW5kKHRoaXMpLCBmcmFnKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5kZWNyeXB0a2V5KSB7XG4gICAgICAgIC8vIHdlIGFscmVhZHkgbG9hZGVkIHRoaXMga2V5LCByZXR1cm4gaXRcbiAgICAgICAgZGVjcnlwdGRhdGEua2V5ID0gdGhpcy5kZWNyeXB0a2V5O1xuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LktFWV9MT0FERUQsIHtmcmFnOiBmcmFnfSk7XG4gICAgICB9XG4gIH1cblxuICBsb2Fkc3VjY2VzcyhldmVudCkge1xuICAgIHZhciBmcmFnID0gdGhpcy5mcmFnO1xuICAgIHRoaXMuZGVjcnlwdGtleSA9IGZyYWcuZGVjcnlwdGRhdGEua2V5ID0gbmV3IFVpbnQ4QXJyYXkoZXZlbnQuY3VycmVudFRhcmdldC5yZXNwb25zZSk7XG4gICAgLy8gZGV0YWNoIGZyYWdtZW50IGxvYWRlciBvbiBsb2FkIHN1Y2Nlc3NcbiAgICBmcmFnLmxvYWRlciA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LktFWV9MT0FERUQsIHtmcmFnOiBmcmFnfSk7XG4gIH1cblxuICBsb2FkZXJyb3IoZXZlbnQpIHtcbiAgICB0aGlzLmxvYWRlci5hYm9ydCgpO1xuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5LRVlfTE9BRF9FUlJPUiwgZmF0YWw6IGZhbHNlLCBmcmFnOiB0aGlzLmZyYWcsIHJlc3BvbnNlOiBldmVudH0pO1xuICB9XG5cbiAgbG9hZHRpbWVvdXQoKSB7XG4gICAgdGhpcy5sb2FkZXIuYWJvcnQoKTtcbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5ORVRXT1JLX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuS0VZX0xPQURfVElNRU9VVCwgZmF0YWw6IGZhbHNlLCBmcmFnOiB0aGlzLmZyYWd9KTtcbiAgfVxuXG4gIGxvYWRwcm9ncmVzcygpIHtcblxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEtleUxvYWRlcjtcbiIsIi8qKlxuICogUGxheWxpc3QgTG9hZGVyXG4qL1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBFdmVudEhhbmRsZXIgZnJvbSAnLi4vZXZlbnQtaGFuZGxlcic7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcbmltcG9ydCBVUkxIZWxwZXIgZnJvbSAnLi4vdXRpbHMvdXJsJztcbmltcG9ydCBBdHRyTGlzdCBmcm9tICcuLi91dGlscy9hdHRyLWxpc3QnO1xuLy9pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuY2xhc3MgUGxheWxpc3RMb2FkZXIgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHN1cGVyKGhscyxcbiAgICAgIEV2ZW50Lk1BTklGRVNUX0xPQURJTkcsXG4gICAgICBFdmVudC5MRVZFTF9MT0FESU5HKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgaWYgKHRoaXMubG9hZGVyKSB7XG4gICAgICB0aGlzLmxvYWRlci5kZXN0cm95KCk7XG4gICAgICB0aGlzLmxvYWRlciA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMudXJsID0gdGhpcy5pZCA9IG51bGw7XG4gICAgRXZlbnRIYW5kbGVyLnByb3RvdHlwZS5kZXN0cm95LmNhbGwodGhpcyk7XG4gIH1cblxuICBvbk1hbmlmZXN0TG9hZGluZyhkYXRhKSB7XG4gICAgdGhpcy5sb2FkKGRhdGEudXJsLCBudWxsKTtcbiAgfVxuXG4gIG9uTGV2ZWxMb2FkaW5nKGRhdGEpIHtcbiAgICB0aGlzLmxvYWQoZGF0YS51cmwsIGRhdGEubGV2ZWwsIGRhdGEuaWQpO1xuICB9XG5cbiAgbG9hZCh1cmwsIGlkMSwgaWQyKSB7XG4gICAgdmFyIGNvbmZpZyA9IHRoaXMuaGxzLmNvbmZpZyxcbiAgICAgICAgcmV0cnksXG4gICAgICAgIHRpbWVvdXQsXG4gICAgICAgIHJldHJ5RGVsYXk7XG4gICAgdGhpcy51cmwgPSB1cmw7XG4gICAgdGhpcy5pZCA9IGlkMTtcbiAgICB0aGlzLmlkMiA9IGlkMjtcbiAgICBpZih0aGlzLmlkID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHJ5ID0gY29uZmlnLm1hbmlmZXN0TG9hZGluZ01heFJldHJ5O1xuICAgICAgdGltZW91dCA9IGNvbmZpZy5tYW5pZmVzdExvYWRpbmdUaW1lT3V0O1xuICAgICAgcmV0cnlEZWxheSA9IGNvbmZpZy5tYW5pZmVzdExvYWRpbmdSZXRyeURlbGF5O1xuICAgIH0gZWxzZSB7XG4gICAgICByZXRyeSA9IGNvbmZpZy5sZXZlbExvYWRpbmdNYXhSZXRyeTtcbiAgICAgIHRpbWVvdXQgPSBjb25maWcubGV2ZWxMb2FkaW5nVGltZU91dDtcbiAgICAgIHJldHJ5RGVsYXkgPSBjb25maWcubGV2ZWxMb2FkaW5nUmV0cnlEZWxheTtcbiAgICB9XG4gICAgdGhpcy5sb2FkZXIgPSB0eXBlb2YoY29uZmlnLnBMb2FkZXIpICE9PSAndW5kZWZpbmVkJyA/IG5ldyBjb25maWcucExvYWRlcihjb25maWcpIDogbmV3IGNvbmZpZy5sb2FkZXIoY29uZmlnKTtcbiAgICB0aGlzLmxvYWRlci5sb2FkKHVybCwgJycsIHRoaXMubG9hZHN1Y2Nlc3MuYmluZCh0aGlzKSwgdGhpcy5sb2FkZXJyb3IuYmluZCh0aGlzKSwgdGhpcy5sb2FkdGltZW91dC5iaW5kKHRoaXMpLCB0aW1lb3V0LCByZXRyeSwgcmV0cnlEZWxheSk7XG4gIH1cblxuICByZXNvbHZlKHVybCwgYmFzZVVybCkge1xuICAgIHJldHVybiBVUkxIZWxwZXIuYnVpbGRBYnNvbHV0ZVVSTChiYXNlVXJsLCB1cmwpO1xuICB9XG5cbiAgcGFyc2VNYXN0ZXJQbGF5bGlzdChzdHJpbmcsIGJhc2V1cmwpIHtcbiAgICBsZXQgbGV2ZWxzID0gW10sIHJlc3VsdDtcblxuICAgIC8vIGh0dHBzOi8vcmVnZXgxMDEuY29tIGlzIHlvdXIgZnJpZW5kXG4gICAgY29uc3QgcmUgPSAvI0VYVC1YLVNUUkVBTS1JTkY6KFteXFxuXFxyXSopW1xcclxcbl0rKFteXFxyXFxuXSspL2c7XG4gICAgd2hpbGUgKChyZXN1bHQgPSByZS5leGVjKHN0cmluZykpICE9IG51bGwpe1xuICAgICAgY29uc3QgbGV2ZWwgPSB7fTtcblxuICAgICAgdmFyIGF0dHJzID0gbGV2ZWwuYXR0cnMgPSBuZXcgQXR0ckxpc3QocmVzdWx0WzFdKTtcbiAgICAgIGxldmVsLnVybCA9IHRoaXMucmVzb2x2ZShyZXN1bHRbMl0sIGJhc2V1cmwpO1xuXG4gICAgICB2YXIgcmVzb2x1dGlvbiA9IGF0dHJzLmRlY2ltYWxSZXNvbHV0aW9uKCdSRVNPTFVUSU9OJyk7XG4gICAgICBpZihyZXNvbHV0aW9uKSB7XG4gICAgICAgIGxldmVsLndpZHRoID0gcmVzb2x1dGlvbi53aWR0aDtcbiAgICAgICAgbGV2ZWwuaGVpZ2h0ID0gcmVzb2x1dGlvbi5oZWlnaHQ7XG4gICAgICB9XG4gICAgICBsZXZlbC5iaXRyYXRlID0gYXR0cnMuZGVjaW1hbEludGVnZXIoJ0JBTkRXSURUSCcpO1xuICAgICAgbGV2ZWwubmFtZSA9IGF0dHJzLk5BTUU7XG5cbiAgICAgIHZhciBjb2RlY3MgPSBhdHRycy5DT0RFQ1M7XG4gICAgICBpZihjb2RlY3MpIHtcbiAgICAgICAgY29kZWNzID0gY29kZWNzLnNwbGl0KCcsJyk7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY29kZWNzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgY29uc3QgY29kZWMgPSBjb2RlY3NbaV07XG4gICAgICAgICAgaWYgKGNvZGVjLmluZGV4T2YoJ2F2YzEnKSAhPT0gLTEpIHtcbiAgICAgICAgICAgIGxldmVsLnZpZGVvQ29kZWMgPSB0aGlzLmF2YzF0b2F2Y290aShjb2RlYyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxldmVsLmF1ZGlvQ29kZWMgPSBjb2RlYztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgbGV2ZWxzLnB1c2gobGV2ZWwpO1xuICAgIH1cbiAgICByZXR1cm4gbGV2ZWxzO1xuICB9XG5cbiAgYXZjMXRvYXZjb3RpKGNvZGVjKSB7XG4gICAgdmFyIHJlc3VsdCwgYXZjZGF0YSA9IGNvZGVjLnNwbGl0KCcuJyk7XG4gICAgaWYgKGF2Y2RhdGEubGVuZ3RoID4gMikge1xuICAgICAgcmVzdWx0ID0gYXZjZGF0YS5zaGlmdCgpICsgJy4nO1xuICAgICAgcmVzdWx0ICs9IHBhcnNlSW50KGF2Y2RhdGEuc2hpZnQoKSkudG9TdHJpbmcoMTYpO1xuICAgICAgcmVzdWx0ICs9ICgnMDAwJyArIHBhcnNlSW50KGF2Y2RhdGEuc2hpZnQoKSkudG9TdHJpbmcoMTYpKS5zdWJzdHIoLTQpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHQgPSBjb2RlYztcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIGNsb25lT2JqKG9iaikge1xuICAgIHJldHVybiBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KG9iaikpO1xuICB9XG5cbiAgcGFyc2VMZXZlbFBsYXlsaXN0KHN0cmluZywgYmFzZXVybCwgaWQpIHtcbiAgICB2YXIgY3VycmVudFNOID0gMCxcbiAgICAgICAgdG90YWxkdXJhdGlvbiA9IDAsXG4gICAgICAgIGxldmVsID0ge3VybDogYmFzZXVybCwgZnJhZ21lbnRzOiBbXSwgbGl2ZTogdHJ1ZSwgc3RhcnRTTjogMH0sXG4gICAgICAgIGxldmVsa2V5ID0ge21ldGhvZCA6IG51bGwsIGtleSA6IG51bGwsIGl2IDogbnVsbCwgdXJpIDogbnVsbH0sXG4gICAgICAgIGNjID0gMCxcbiAgICAgICAgcHJvZ3JhbURhdGVUaW1lID0gbnVsbCxcbiAgICAgICAgZnJhZyA9IG51bGwsXG4gICAgICAgIHJlc3VsdCxcbiAgICAgICAgcmVnZXhwLFxuICAgICAgICBieXRlUmFuZ2VFbmRPZmZzZXQsXG4gICAgICAgIGJ5dGVSYW5nZVN0YXJ0T2Zmc2V0O1xuXG4gICAgcmVnZXhwID0gLyg/OiNFWFQtWC0oTUVESUEtU0VRVUVOQ0UpOihcXGQrKSl8KD86I0VYVC1YLShUQVJHRVREVVJBVElPTik6KFxcZCspKXwoPzojRVhULVgtKEtFWSk6KC4qKSl8KD86I0VYVChJTkYpOihbXFxkXFwuXSspW15cXHJcXG5dKihbXFxyXFxuXStbXiN8XFxyXFxuXSspPyl8KD86I0VYVC1YLShCWVRFUkFOR0UpOihbXFxkXStbQFtcXGRdKildKltcXHJcXG5dKyhbXiN8XFxyXFxuXSspP3woPzojRVhULVgtKEVORExJU1QpKXwoPzojRVhULVgtKERJUylDT05USU5VSVRZKSl8KD86I0VYVC1YLShQUk9HUkFNLURBVEUtVElNRSk6KC4qKSkvZztcbiAgICB3aGlsZSAoKHJlc3VsdCA9IHJlZ2V4cC5leGVjKHN0cmluZykpICE9PSBudWxsKSB7XG4gICAgICByZXN1bHQuc2hpZnQoKTtcbiAgICAgIHJlc3VsdCA9IHJlc3VsdC5maWx0ZXIoZnVuY3Rpb24obikgeyByZXR1cm4gKG4gIT09IHVuZGVmaW5lZCk7IH0pO1xuICAgICAgc3dpdGNoIChyZXN1bHRbMF0pIHtcbiAgICAgICAgY2FzZSAnTUVESUEtU0VRVUVOQ0UnOlxuICAgICAgICAgIGN1cnJlbnRTTiA9IGxldmVsLnN0YXJ0U04gPSBwYXJzZUludChyZXN1bHRbMV0pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdUQVJHRVREVVJBVElPTic6XG4gICAgICAgICAgbGV2ZWwudGFyZ2V0ZHVyYXRpb24gPSBwYXJzZUZsb2F0KHJlc3VsdFsxXSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0VORExJU1QnOlxuICAgICAgICAgIGxldmVsLmxpdmUgPSBmYWxzZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnRElTJzpcbiAgICAgICAgICBjYysrO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdCWVRFUkFOR0UnOlxuICAgICAgICAgIHZhciBwYXJhbXMgPSByZXN1bHRbMV0uc3BsaXQoJ0AnKTtcbiAgICAgICAgICBpZiAocGFyYW1zLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgYnl0ZVJhbmdlU3RhcnRPZmZzZXQgPSBieXRlUmFuZ2VFbmRPZmZzZXQ7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGJ5dGVSYW5nZVN0YXJ0T2Zmc2V0ID0gcGFyc2VJbnQocGFyYW1zWzFdKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnl0ZVJhbmdlRW5kT2Zmc2V0ID0gcGFyc2VJbnQocGFyYW1zWzBdKSArIGJ5dGVSYW5nZVN0YXJ0T2Zmc2V0O1xuICAgICAgICAgIGlmIChmcmFnICYmICFmcmFnLnVybCkge1xuICAgICAgICAgICAgZnJhZy5ieXRlUmFuZ2VTdGFydE9mZnNldCA9IGJ5dGVSYW5nZVN0YXJ0T2Zmc2V0O1xuICAgICAgICAgICAgZnJhZy5ieXRlUmFuZ2VFbmRPZmZzZXQgPSBieXRlUmFuZ2VFbmRPZmZzZXQ7XG4gICAgICAgICAgICBmcmFnLnVybCA9IHRoaXMucmVzb2x2ZShyZXN1bHRbMl0sIGJhc2V1cmwpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnSU5GJzpcbiAgICAgICAgICB2YXIgZHVyYXRpb24gPSBwYXJzZUZsb2F0KHJlc3VsdFsxXSk7XG4gICAgICAgICAgaWYgKCFpc05hTihkdXJhdGlvbikpIHtcbiAgICAgICAgICAgIHZhciBmcmFnZGVjcnlwdGRhdGEsXG4gICAgICAgICAgICAgICAgc24gPSBjdXJyZW50U04rKztcbiAgICAgICAgICAgIGlmIChsZXZlbGtleS5tZXRob2QgJiYgbGV2ZWxrZXkudXJpICYmICFsZXZlbGtleS5pdikge1xuICAgICAgICAgICAgICBmcmFnZGVjcnlwdGRhdGEgPSB0aGlzLmNsb25lT2JqKGxldmVsa2V5KTtcbiAgICAgICAgICAgICAgdmFyIHVpbnQ4VmlldyA9IG5ldyBVaW50OEFycmF5KDE2KTtcbiAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDEyOyBpIDwgMTY7IGkrKykge1xuICAgICAgICAgICAgICAgIHVpbnQ4Vmlld1tpXSA9IChzbiA+PiA4KigxNS1pKSkgJiAweGZmO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGZyYWdkZWNyeXB0ZGF0YS5pdiA9IHVpbnQ4VmlldztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGZyYWdkZWNyeXB0ZGF0YSA9IGxldmVsa2V5O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIHVybCA9IHJlc3VsdFsyXSA/IHRoaXMucmVzb2x2ZShyZXN1bHRbMl0sIGJhc2V1cmwpIDogbnVsbDtcbiAgICAgICAgICAgIGZyYWcgPSB7dXJsOiB1cmwsIGR1cmF0aW9uOiBkdXJhdGlvbiwgc3RhcnQ6IHRvdGFsZHVyYXRpb24sIHNuOiBzbiwgbGV2ZWw6IGlkLCBjYzogY2MsIGJ5dGVSYW5nZVN0YXJ0T2Zmc2V0OiBieXRlUmFuZ2VTdGFydE9mZnNldCwgYnl0ZVJhbmdlRW5kT2Zmc2V0OiBieXRlUmFuZ2VFbmRPZmZzZXQsIGRlY3J5cHRkYXRhIDogZnJhZ2RlY3J5cHRkYXRhLCBwcm9ncmFtRGF0ZVRpbWU6IHByb2dyYW1EYXRlVGltZX07XG4gICAgICAgICAgICBsZXZlbC5mcmFnbWVudHMucHVzaChmcmFnKTtcbiAgICAgICAgICAgIHRvdGFsZHVyYXRpb24gKz0gZHVyYXRpb247XG4gICAgICAgICAgICBieXRlUmFuZ2VTdGFydE9mZnNldCA9IG51bGw7XG4gICAgICAgICAgICBwcm9ncmFtRGF0ZVRpbWUgPSBudWxsO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnS0VZJzpcbiAgICAgICAgICAvLyBodHRwczovL3Rvb2xzLmlldGYub3JnL2h0bWwvZHJhZnQtcGFudG9zLWh0dHAtbGl2ZS1zdHJlYW1pbmctMDgjc2VjdGlvbi0zLjQuNFxuICAgICAgICAgIHZhciBkZWNyeXB0cGFyYW1zID0gcmVzdWx0WzFdO1xuICAgICAgICAgIHZhciBrZXlBdHRycyA9IG5ldyBBdHRyTGlzdChkZWNyeXB0cGFyYW1zKTtcbiAgICAgICAgICB2YXIgZGVjcnlwdG1ldGhvZCA9IGtleUF0dHJzLmVudW1lcmF0ZWRTdHJpbmcoJ01FVEhPRCcpLFxuICAgICAgICAgICAgICBkZWNyeXB0dXJpID0ga2V5QXR0cnMuVVJJLFxuICAgICAgICAgICAgICBkZWNyeXB0aXYgPSBrZXlBdHRycy5oZXhhZGVjaW1hbEludGVnZXIoJ0lWJyk7XG4gICAgICAgICAgaWYgKGRlY3J5cHRtZXRob2QpIHtcbiAgICAgICAgICAgIGxldmVsa2V5ID0geyBtZXRob2Q6IG51bGwsIGtleTogbnVsbCwgaXY6IG51bGwsIHVyaTogbnVsbCB9O1xuICAgICAgICAgICAgaWYgKChkZWNyeXB0dXJpKSAmJiAoZGVjcnlwdG1ldGhvZCA9PT0gJ0FFUy0xMjgnKSkge1xuICAgICAgICAgICAgICBsZXZlbGtleS5tZXRob2QgPSBkZWNyeXB0bWV0aG9kO1xuICAgICAgICAgICAgICAvLyBVUkkgdG8gZ2V0IHRoZSBrZXlcbiAgICAgICAgICAgICAgbGV2ZWxrZXkudXJpID0gdGhpcy5yZXNvbHZlKGRlY3J5cHR1cmksIGJhc2V1cmwpO1xuICAgICAgICAgICAgICBsZXZlbGtleS5rZXkgPSBudWxsO1xuICAgICAgICAgICAgICAvLyBJbml0aWFsaXphdGlvbiBWZWN0b3IgKElWKVxuICAgICAgICAgICAgICBsZXZlbGtleS5pdiA9IGRlY3J5cHRpdjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ1BST0dSQU0tREFURS1USU1FJzpcbiAgICAgICAgICBwcm9ncmFtRGF0ZVRpbWUgPSBuZXcgRGF0ZShEYXRlLnBhcnNlKHJlc3VsdFsxXSkpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICAvL2xvZ2dlci5sb2coJ2ZvdW5kICcgKyBsZXZlbC5mcmFnbWVudHMubGVuZ3RoICsgJyBmcmFnbWVudHMnKTtcbiAgICBpZihmcmFnICYmICFmcmFnLnVybCkge1xuICAgICAgbGV2ZWwuZnJhZ21lbnRzLnBvcCgpO1xuICAgICAgdG90YWxkdXJhdGlvbi09ZnJhZy5kdXJhdGlvbjtcbiAgICB9XG4gICAgbGV2ZWwudG90YWxkdXJhdGlvbiA9IHRvdGFsZHVyYXRpb247XG4gICAgbGV2ZWwuZW5kU04gPSBjdXJyZW50U04gLSAxO1xuICAgIHJldHVybiBsZXZlbDtcbiAgfVxuXG4gIGxvYWRzdWNjZXNzKGV2ZW50LCBzdGF0cykge1xuICAgIHZhciB0YXJnZXQgPSBldmVudC5jdXJyZW50VGFyZ2V0LFxuICAgICAgICBzdHJpbmcgPSB0YXJnZXQucmVzcG9uc2VUZXh0LFxuICAgICAgICB1cmwgPSB0YXJnZXQucmVzcG9uc2VVUkwsXG4gICAgICAgIGlkID0gdGhpcy5pZCxcbiAgICAgICAgaWQyID0gdGhpcy5pZDIsXG4gICAgICAgIGhscyA9IHRoaXMuaGxzLFxuICAgICAgICBsZXZlbHM7XG4gICAgLy8gcmVzcG9uc2VVUkwgbm90IHN1cHBvcnRlZCBvbiBzb21lIGJyb3dzZXJzIChpdCBpcyB1c2VkIHRvIGRldGVjdCBVUkwgcmVkaXJlY3Rpb24pXG4gICAgaWYgKHVybCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBmYWxsYmFjayB0byBpbml0aWFsIFVSTFxuICAgICAgdXJsID0gdGhpcy51cmw7XG4gICAgfVxuICAgIHN0YXRzLnRsb2FkID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgc3RhdHMubXRpbWUgPSBuZXcgRGF0ZSh0YXJnZXQuZ2V0UmVzcG9uc2VIZWFkZXIoJ0xhc3QtTW9kaWZpZWQnKSk7XG4gICAgaWYgKHN0cmluZy5pbmRleE9mKCcjRVhUTTNVJykgPT09IDApIHtcbiAgICAgIGlmIChzdHJpbmcuaW5kZXhPZignI0VYVElORjonKSA+IDApIHtcbiAgICAgICAgLy8gMSBsZXZlbCBwbGF5bGlzdFxuICAgICAgICAvLyBpZiBmaXJzdCByZXF1ZXN0LCBmaXJlIG1hbmlmZXN0IGxvYWRlZCBldmVudCwgbGV2ZWwgd2lsbCBiZSByZWxvYWRlZCBhZnRlcndhcmRzXG4gICAgICAgIC8vICh0aGlzIGlzIHRvIGhhdmUgYSB1bmlmb3JtIGxvZ2ljIGZvciAxIGxldmVsL211bHRpbGV2ZWwgcGxheWxpc3RzKVxuICAgICAgICBpZiAodGhpcy5pZCA9PT0gbnVsbCkge1xuICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50Lk1BTklGRVNUX0xPQURFRCwge2xldmVsczogW3t1cmw6IHVybH1dLCB1cmw6IHVybCwgc3RhdHM6IHN0YXRzfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFyIGxldmVsRGV0YWlscyA9IHRoaXMucGFyc2VMZXZlbFBsYXlsaXN0KHN0cmluZywgdXJsLCBpZCk7XG4gICAgICAgICAgc3RhdHMudHBhcnNlZCA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkxFVkVMX0xPQURFRCwge2RldGFpbHM6IGxldmVsRGV0YWlscywgbGV2ZWw6IGlkLCBpZDogaWQyLCBzdGF0czogc3RhdHN9KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGV2ZWxzID0gdGhpcy5wYXJzZU1hc3RlclBsYXlsaXN0KHN0cmluZywgdXJsKTtcbiAgICAgICAgLy8gbXVsdGkgbGV2ZWwgcGxheWxpc3QsIHBhcnNlIGxldmVsIGluZm9cbiAgICAgICAgaWYgKGxldmVscy5sZW5ndGgpIHtcbiAgICAgICAgICBobHMudHJpZ2dlcihFdmVudC5NQU5JRkVTVF9MT0FERUQsIHtsZXZlbHM6IGxldmVscywgdXJsOiB1cmwsIHN0YXRzOiBzdGF0c30pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5ORVRXT1JLX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuTUFOSUZFU1RfUEFSU0lOR19FUlJPUiwgZmF0YWw6IHRydWUsIHVybDogdXJsLCByZWFzb246ICdubyBsZXZlbCBmb3VuZCBpbiBtYW5pZmVzdCd9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBobHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTkVUV09SS19FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLk1BTklGRVNUX1BBUlNJTkdfRVJST1IsIGZhdGFsOiB0cnVlLCB1cmw6IHVybCwgcmVhc29uOiAnbm8gRVhUTTNVIGRlbGltaXRlcid9KTtcbiAgICB9XG4gIH1cblxuICBsb2FkZXJyb3IoZXZlbnQpIHtcbiAgICB2YXIgZGV0YWlscywgZmF0YWw7XG4gICAgaWYgKHRoaXMuaWQgPT09IG51bGwpIHtcbiAgICAgIGRldGFpbHMgPSBFcnJvckRldGFpbHMuTUFOSUZFU1RfTE9BRF9FUlJPUjtcbiAgICAgIGZhdGFsID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgZGV0YWlscyA9IEVycm9yRGV0YWlscy5MRVZFTF9MT0FEX0VSUk9SO1xuICAgICAgZmF0YWwgPSBmYWxzZTtcbiAgICB9XG4gICAgdGhpcy5sb2FkZXIuYWJvcnQoKTtcbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5ORVRXT1JLX0VSUk9SLCBkZXRhaWxzOiBkZXRhaWxzLCBmYXRhbDogZmF0YWwsIHVybDogdGhpcy51cmwsIGxvYWRlcjogdGhpcy5sb2FkZXIsIHJlc3BvbnNlOiBldmVudC5jdXJyZW50VGFyZ2V0LCBsZXZlbDogdGhpcy5pZCwgaWQ6IHRoaXMuaWQyfSk7XG4gIH1cblxuICBsb2FkdGltZW91dCgpIHtcbiAgICB2YXIgZGV0YWlscywgZmF0YWw7XG4gICAgaWYgKHRoaXMuaWQgPT09IG51bGwpIHtcbiAgICAgIGRldGFpbHMgPSBFcnJvckRldGFpbHMuTUFOSUZFU1RfTE9BRF9USU1FT1VUO1xuICAgICAgZmF0YWwgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBkZXRhaWxzID0gRXJyb3JEZXRhaWxzLkxFVkVMX0xPQURfVElNRU9VVDtcbiAgICAgIGZhdGFsID0gZmFsc2U7XG4gICAgfVxuICAgdGhpcy5sb2FkZXIuYWJvcnQoKTtcbiAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHM6IGRldGFpbHMsIGZhdGFsOiBmYXRhbCwgdXJsOiB0aGlzLnVybCwgbG9hZGVyOiB0aGlzLmxvYWRlciwgbGV2ZWw6IHRoaXMuaWQsIGlkOiB0aGlzLmlkMn0pO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFBsYXlsaXN0TG9hZGVyO1xuIiwiLyoqXG4gKiBHZW5lcmF0ZSBNUDQgQm94XG4qL1xuXG4vL2ltcG9ydCBIZXggZnJvbSAnLi4vdXRpbHMvaGV4JztcbmNsYXNzIE1QNCB7XG4gIHN0YXRpYyBpbml0KCkge1xuICAgIE1QNC50eXBlcyA9IHtcbiAgICAgIGF2YzE6IFtdLCAvLyBjb2RpbmduYW1lXG4gICAgICBhdmNDOiBbXSxcbiAgICAgIGJ0cnQ6IFtdLFxuICAgICAgZGluZjogW10sXG4gICAgICBkcmVmOiBbXSxcbiAgICAgIGVzZHM6IFtdLFxuICAgICAgZnR5cDogW10sXG4gICAgICBoZGxyOiBbXSxcbiAgICAgIG1kYXQ6IFtdLFxuICAgICAgbWRoZDogW10sXG4gICAgICBtZGlhOiBbXSxcbiAgICAgIG1maGQ6IFtdLFxuICAgICAgbWluZjogW10sXG4gICAgICBtb29mOiBbXSxcbiAgICAgIG1vb3Y6IFtdLFxuICAgICAgbXA0YTogW10sXG4gICAgICBtdmV4OiBbXSxcbiAgICAgIG12aGQ6IFtdLFxuICAgICAgc2R0cDogW10sXG4gICAgICBzdGJsOiBbXSxcbiAgICAgIHN0Y286IFtdLFxuICAgICAgc3RzYzogW10sXG4gICAgICBzdHNkOiBbXSxcbiAgICAgIHN0c3o6IFtdLFxuICAgICAgc3R0czogW10sXG4gICAgICB0ZmR0OiBbXSxcbiAgICAgIHRmaGQ6IFtdLFxuICAgICAgdHJhZjogW10sXG4gICAgICB0cmFrOiBbXSxcbiAgICAgIHRydW46IFtdLFxuICAgICAgdHJleDogW10sXG4gICAgICB0a2hkOiBbXSxcbiAgICAgIHZtaGQ6IFtdLFxuICAgICAgc21oZDogW11cbiAgICB9O1xuXG4gICAgdmFyIGk7XG4gICAgZm9yIChpIGluIE1QNC50eXBlcykge1xuICAgICAgaWYgKE1QNC50eXBlcy5oYXNPd25Qcm9wZXJ0eShpKSkge1xuICAgICAgICBNUDQudHlwZXNbaV0gPSBbXG4gICAgICAgICAgaS5jaGFyQ29kZUF0KDApLFxuICAgICAgICAgIGkuY2hhckNvZGVBdCgxKSxcbiAgICAgICAgICBpLmNoYXJDb2RlQXQoMiksXG4gICAgICAgICAgaS5jaGFyQ29kZUF0KDMpXG4gICAgICAgIF07XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIHZpZGVvSGRsciA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAweDc2LCAweDY5LCAweDY0LCAweDY1LCAvLyBoYW5kbGVyX3R5cGU6ICd2aWRlJ1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHg1NiwgMHg2OSwgMHg2NCwgMHg2NSxcbiAgICAgIDB4NmYsIDB4NDgsIDB4NjEsIDB4NmUsXG4gICAgICAweDY0LCAweDZjLCAweDY1LCAweDcyLCAweDAwIC8vIG5hbWU6ICdWaWRlb0hhbmRsZXInXG4gICAgXSk7XG5cbiAgICB2YXIgYXVkaW9IZGxyID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcHJlX2RlZmluZWRcbiAgICAgIDB4NzMsIDB4NmYsIDB4NzUsIDB4NmUsIC8vIGhhbmRsZXJfdHlwZTogJ3NvdW4nXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDUzLCAweDZmLCAweDc1LCAweDZlLFxuICAgICAgMHg2NCwgMHg0OCwgMHg2MSwgMHg2ZSxcbiAgICAgIDB4NjQsIDB4NmMsIDB4NjUsIDB4NzIsIDB4MDAgLy8gbmFtZTogJ1NvdW5kSGFuZGxlcidcbiAgICBdKTtcblxuICAgIE1QNC5IRExSX1RZUEVTID0ge1xuICAgICAgJ3ZpZGVvJzogdmlkZW9IZGxyLFxuICAgICAgJ2F1ZGlvJzogYXVkaW9IZGxyXG4gICAgfTtcblxuICAgIHZhciBkcmVmID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMSwgLy8gZW50cnlfY291bnRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MGMsIC8vIGVudHJ5X3NpemVcbiAgICAgIDB4NzUsIDB4NzIsIDB4NmMsIDB4MjAsIC8vICd1cmwnIHR5cGVcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMSAvLyBlbnRyeV9mbGFnc1xuICAgIF0pO1xuXG4gICAgdmFyIHN0Y28gPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCAvLyBlbnRyeV9jb3VudFxuICAgIF0pO1xuXG4gICAgTVA0LlNUVFMgPSBNUDQuU1RTQyA9IE1QNC5TVENPID0gc3RjbztcblxuICAgIE1QNC5TVFNaID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHNhbXBsZV9zaXplXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBzYW1wbGVfY291bnRcbiAgICBdKTtcbiAgICBNUDQuVk1IRCA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDEsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAvLyBncmFwaGljc21vZGVcbiAgICAgIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCAvLyBvcGNvbG9yXG4gICAgXSk7XG4gICAgTVA0LlNNSEQgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgLy8gYmFsYW5jZVxuICAgICAgMHgwMCwgMHgwMCAvLyByZXNlcnZlZFxuICAgIF0pO1xuXG4gICAgTVA0LlNUU0QgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAxXSk7Ly8gZW50cnlfY291bnRcblxuICAgIHZhciBtYWpvckJyYW5kID0gbmV3IFVpbnQ4QXJyYXkoWzEwNSwxMTUsMTExLDEwOV0pOyAvLyBpc29tXG4gICAgdmFyIGF2YzFCcmFuZCA9IG5ldyBVaW50OEFycmF5KFs5NywxMTgsOTksNDldKTsgLy8gYXZjMVxuICAgIHZhciBtaW5vclZlcnNpb24gPSBuZXcgVWludDhBcnJheShbMCwgMCwgMCwgMV0pO1xuXG4gICAgTVA0LkZUWVAgPSBNUDQuYm94KE1QNC50eXBlcy5mdHlwLCBtYWpvckJyYW5kLCBtaW5vclZlcnNpb24sIG1ham9yQnJhbmQsIGF2YzFCcmFuZCk7XG4gICAgTVA0LkRJTkYgPSBNUDQuYm94KE1QNC50eXBlcy5kaW5mLCBNUDQuYm94KE1QNC50eXBlcy5kcmVmLCBkcmVmKSk7XG4gIH1cblxuICBzdGF0aWMgYm94KHR5cGUpIHtcbiAgdmFyXG4gICAgcGF5bG9hZCA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSksXG4gICAgc2l6ZSA9IDgsXG4gICAgaSA9IHBheWxvYWQubGVuZ3RoLFxuICAgIGxlbiA9IGksXG4gICAgcmVzdWx0O1xuICAgIC8vIGNhbGN1bGF0ZSB0aGUgdG90YWwgc2l6ZSB3ZSBuZWVkIHRvIGFsbG9jYXRlXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgc2l6ZSArPSBwYXlsb2FkW2ldLmJ5dGVMZW5ndGg7XG4gICAgfVxuICAgIHJlc3VsdCA9IG5ldyBVaW50OEFycmF5KHNpemUpO1xuICAgIHJlc3VsdFswXSA9IChzaXplID4+IDI0KSAmIDB4ZmY7XG4gICAgcmVzdWx0WzFdID0gKHNpemUgPj4gMTYpICYgMHhmZjtcbiAgICByZXN1bHRbMl0gPSAoc2l6ZSA+PiA4KSAmIDB4ZmY7XG4gICAgcmVzdWx0WzNdID0gc2l6ZSAgJiAweGZmO1xuICAgIHJlc3VsdC5zZXQodHlwZSwgNCk7XG4gICAgLy8gY29weSB0aGUgcGF5bG9hZCBpbnRvIHRoZSByZXN1bHRcbiAgICBmb3IgKGkgPSAwLCBzaXplID0gODsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAvLyBjb3B5IHBheWxvYWRbaV0gYXJyYXkgQCBvZmZzZXQgc2l6ZVxuICAgICAgcmVzdWx0LnNldChwYXlsb2FkW2ldLCBzaXplKTtcbiAgICAgIHNpemUgKz0gcGF5bG9hZFtpXS5ieXRlTGVuZ3RoO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgc3RhdGljIGhkbHIodHlwZSkge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5oZGxyLCBNUDQuSERMUl9UWVBFU1t0eXBlXSk7XG4gIH1cblxuICBzdGF0aWMgbWRhdChkYXRhKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1kYXQsIGRhdGEpO1xuICB9XG5cbiAgc3RhdGljIG1kaGQodGltZXNjYWxlLCBkdXJhdGlvbikge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tZGhkLCBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAyLCAvLyBjcmVhdGlvbl90aW1lXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAzLCAvLyBtb2RpZmljYXRpb25fdGltZVxuICAgICAgKHRpbWVzY2FsZSA+PiAyNCkgJiAweEZGLFxuICAgICAgKHRpbWVzY2FsZSA+PiAxNikgJiAweEZGLFxuICAgICAgKHRpbWVzY2FsZSA+PiAgOCkgJiAweEZGLFxuICAgICAgdGltZXNjYWxlICYgMHhGRiwgLy8gdGltZXNjYWxlXG4gICAgICAoZHVyYXRpb24gPj4gMjQpLFxuICAgICAgKGR1cmF0aW9uID4+IDE2KSAmIDB4RkYsXG4gICAgICAoZHVyYXRpb24gPj4gIDgpICYgMHhGRixcbiAgICAgIGR1cmF0aW9uICYgMHhGRiwgLy8gZHVyYXRpb25cbiAgICAgIDB4NTUsIDB4YzQsIC8vICd1bmQnIGxhbmd1YWdlICh1bmRldGVybWluZWQpXG4gICAgICAweDAwLCAweDAwXG4gICAgXSkpO1xuICB9XG5cbiAgc3RhdGljIG1kaWEodHJhY2spIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWRpYSwgTVA0Lm1kaGQodHJhY2sudGltZXNjYWxlLCB0cmFjay5kdXJhdGlvbiksIE1QNC5oZGxyKHRyYWNrLnR5cGUpLCBNUDQubWluZih0cmFjaykpO1xuICB9XG5cbiAgc3RhdGljIG1maGQoc2VxdWVuY2VOdW1iZXIpIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWZoZCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAoc2VxdWVuY2VOdW1iZXIgPj4gMjQpLFxuICAgICAgKHNlcXVlbmNlTnVtYmVyID4+IDE2KSAmIDB4RkYsXG4gICAgICAoc2VxdWVuY2VOdW1iZXIgPj4gIDgpICYgMHhGRixcbiAgICAgIHNlcXVlbmNlTnVtYmVyICYgMHhGRiwgLy8gc2VxdWVuY2VfbnVtYmVyXG4gICAgXSkpO1xuICB9XG5cbiAgc3RhdGljIG1pbmYodHJhY2spIHtcbiAgICBpZiAodHJhY2sudHlwZSA9PT0gJ2F1ZGlvJykge1xuICAgICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1pbmYsIE1QNC5ib3goTVA0LnR5cGVzLnNtaGQsIE1QNC5TTUhEKSwgTVA0LkRJTkYsIE1QNC5zdGJsKHRyYWNrKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5taW5mLCBNUDQuYm94KE1QNC50eXBlcy52bWhkLCBNUDQuVk1IRCksIE1QNC5ESU5GLCBNUDQuc3RibCh0cmFjaykpO1xuICAgIH1cbiAgfVxuXG4gIHN0YXRpYyBtb29mKHNuLCBiYXNlTWVkaWFEZWNvZGVUaW1lLCB0cmFjaykge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tb29mLCBNUDQubWZoZChzbiksIE1QNC50cmFmKHRyYWNrLGJhc2VNZWRpYURlY29kZVRpbWUpKTtcbiAgfVxuLyoqXG4gKiBAcGFyYW0gdHJhY2tzLi4uIChvcHRpb25hbCkge2FycmF5fSB0aGUgdHJhY2tzIGFzc29jaWF0ZWQgd2l0aCB0aGlzIG1vdmllXG4gKi9cbiAgc3RhdGljIG1vb3YodHJhY2tzKSB7XG4gICAgdmFyXG4gICAgICBpID0gdHJhY2tzLmxlbmd0aCxcbiAgICAgIGJveGVzID0gW107XG5cbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICBib3hlc1tpXSA9IE1QNC50cmFrKHRyYWNrc1tpXSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIE1QNC5ib3guYXBwbHkobnVsbCwgW01QNC50eXBlcy5tb292LCBNUDQubXZoZCh0cmFja3NbMF0udGltZXNjYWxlLCB0cmFja3NbMF0uZHVyYXRpb24pXS5jb25jYXQoYm94ZXMpLmNvbmNhdChNUDQubXZleCh0cmFja3MpKSk7XG4gIH1cblxuICBzdGF0aWMgbXZleCh0cmFja3MpIHtcbiAgICB2YXJcbiAgICAgIGkgPSB0cmFja3MubGVuZ3RoLFxuICAgICAgYm94ZXMgPSBbXTtcblxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIGJveGVzW2ldID0gTVA0LnRyZXgodHJhY2tzW2ldKTtcbiAgICB9XG4gICAgcmV0dXJuIE1QNC5ib3guYXBwbHkobnVsbCwgW01QNC50eXBlcy5tdmV4XS5jb25jYXQoYm94ZXMpKTtcbiAgfVxuXG4gIHN0YXRpYyBtdmhkKHRpbWVzY2FsZSxkdXJhdGlvbikge1xuICAgIHZhclxuICAgICAgYnl0ZXMgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAxLCAvLyBjcmVhdGlvbl90aW1lXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDIsIC8vIG1vZGlmaWNhdGlvbl90aW1lXG4gICAgICAgICh0aW1lc2NhbGUgPj4gMjQpICYgMHhGRixcbiAgICAgICAgKHRpbWVzY2FsZSA+PiAxNikgJiAweEZGLFxuICAgICAgICAodGltZXNjYWxlID4+ICA4KSAmIDB4RkYsXG4gICAgICAgIHRpbWVzY2FsZSAmIDB4RkYsIC8vIHRpbWVzY2FsZVxuICAgICAgICAoZHVyYXRpb24gPj4gMjQpICYgMHhGRixcbiAgICAgICAgKGR1cmF0aW9uID4+IDE2KSAmIDB4RkYsXG4gICAgICAgIChkdXJhdGlvbiA+PiAgOCkgJiAweEZGLFxuICAgICAgICBkdXJhdGlvbiAmIDB4RkYsIC8vIGR1cmF0aW9uXG4gICAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDAsIC8vIDEuMCByYXRlXG4gICAgICAgIDB4MDEsIDB4MDAsIC8vIDEuMCB2b2x1bWVcbiAgICAgICAgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHg0MCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gdHJhbnNmb3JtYXRpb246IHVuaXR5IG1hdHJpeFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBwcmVfZGVmaW5lZFxuICAgICAgICAweGZmLCAweGZmLCAweGZmLCAweGZmIC8vIG5leHRfdHJhY2tfSURcbiAgICAgIF0pO1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tdmhkLCBieXRlcyk7XG4gIH1cblxuICBzdGF0aWMgc2R0cCh0cmFjaykge1xuICAgIHZhclxuICAgICAgc2FtcGxlcyA9IHRyYWNrLnNhbXBsZXMgfHwgW10sXG4gICAgICBieXRlcyA9IG5ldyBVaW50OEFycmF5KDQgKyBzYW1wbGVzLmxlbmd0aCksXG4gICAgICBmbGFncyxcbiAgICAgIGk7XG4gICAgLy8gbGVhdmUgdGhlIGZ1bGwgYm94IGhlYWRlciAoNCBieXRlcykgYWxsIHplcm9cbiAgICAvLyB3cml0ZSB0aGUgc2FtcGxlIHRhYmxlXG4gICAgZm9yIChpID0gMDsgaSA8IHNhbXBsZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGZsYWdzID0gc2FtcGxlc1tpXS5mbGFncztcbiAgICAgIGJ5dGVzW2kgKyA0XSA9IChmbGFncy5kZXBlbmRzT24gPDwgNCkgfFxuICAgICAgICAoZmxhZ3MuaXNEZXBlbmRlZE9uIDw8IDIpIHxcbiAgICAgICAgKGZsYWdzLmhhc1JlZHVuZGFuY3kpO1xuICAgIH1cblxuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5zZHRwLCBieXRlcyk7XG4gIH1cblxuICBzdGF0aWMgc3RibCh0cmFjaykge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5zdGJsLCBNUDQuc3RzZCh0cmFjayksIE1QNC5ib3goTVA0LnR5cGVzLnN0dHMsIE1QNC5TVFRTKSwgTVA0LmJveChNUDQudHlwZXMuc3RzYywgTVA0LlNUU0MpLCBNUDQuYm94KE1QNC50eXBlcy5zdHN6LCBNUDQuU1RTWiksIE1QNC5ib3goTVA0LnR5cGVzLnN0Y28sIE1QNC5TVENPKSk7XG4gIH1cblxuICBzdGF0aWMgYXZjMSh0cmFjaykge1xuICAgIHZhciBzcHMgPSBbXSwgcHBzID0gW10sIGksIGRhdGEsIGxlbjtcbiAgICAvLyBhc3NlbWJsZSB0aGUgU1BTc1xuXG4gICAgZm9yIChpID0gMDsgaSA8IHRyYWNrLnNwcy5sZW5ndGg7IGkrKykge1xuICAgICAgZGF0YSA9IHRyYWNrLnNwc1tpXTtcbiAgICAgIGxlbiA9IGRhdGEuYnl0ZUxlbmd0aDtcbiAgICAgIHNwcy5wdXNoKChsZW4gPj4+IDgpICYgMHhGRik7XG4gICAgICBzcHMucHVzaCgobGVuICYgMHhGRikpO1xuICAgICAgc3BzID0gc3BzLmNvbmNhdChBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChkYXRhKSk7IC8vIFNQU1xuICAgIH1cblxuICAgIC8vIGFzc2VtYmxlIHRoZSBQUFNzXG4gICAgZm9yIChpID0gMDsgaSA8IHRyYWNrLnBwcy5sZW5ndGg7IGkrKykge1xuICAgICAgZGF0YSA9IHRyYWNrLnBwc1tpXTtcbiAgICAgIGxlbiA9IGRhdGEuYnl0ZUxlbmd0aDtcbiAgICAgIHBwcy5wdXNoKChsZW4gPj4+IDgpICYgMHhGRik7XG4gICAgICBwcHMucHVzaCgobGVuICYgMHhGRikpO1xuICAgICAgcHBzID0gcHBzLmNvbmNhdChBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChkYXRhKSk7XG4gICAgfVxuXG4gICAgdmFyIGF2Y2MgPSBNUDQuYm94KE1QNC50eXBlcy5hdmNDLCBuZXcgVWludDhBcnJheShbXG4gICAgICAgICAgICAweDAxLCAgIC8vIHZlcnNpb25cbiAgICAgICAgICAgIHNwc1szXSwgLy8gcHJvZmlsZVxuICAgICAgICAgICAgc3BzWzRdLCAvLyBwcm9maWxlIGNvbXBhdFxuICAgICAgICAgICAgc3BzWzVdLCAvLyBsZXZlbFxuICAgICAgICAgICAgMHhmYyB8IDMsIC8vIGxlbmd0aFNpemVNaW51c09uZSwgaGFyZC1jb2RlZCB0byA0IGJ5dGVzXG4gICAgICAgICAgICAweEUwIHwgdHJhY2suc3BzLmxlbmd0aCAvLyAzYml0IHJlc2VydmVkICgxMTEpICsgbnVtT2ZTZXF1ZW5jZVBhcmFtZXRlclNldHNcbiAgICAgICAgICBdLmNvbmNhdChzcHMpLmNvbmNhdChbXG4gICAgICAgICAgICB0cmFjay5wcHMubGVuZ3RoIC8vIG51bU9mUGljdHVyZVBhcmFtZXRlclNldHNcbiAgICAgICAgICBdKS5jb25jYXQocHBzKSkpLCAvLyBcIlBQU1wiXG4gICAgICAgIHdpZHRoID0gdHJhY2sud2lkdGgsXG4gICAgICAgIGhlaWdodCA9IHRyYWNrLmhlaWdodDtcbiAgICAvL2NvbnNvbGUubG9nKCdhdmNjOicgKyBIZXguaGV4RHVtcChhdmNjKSk7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLmF2YzEsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMSwgLy8gZGF0YV9yZWZlcmVuY2VfaW5kZXhcbiAgICAgICAgMHgwMCwgMHgwMCwgLy8gcHJlX2RlZmluZWRcbiAgICAgICAgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcHJlX2RlZmluZWRcbiAgICAgICAgKHdpZHRoID4+IDgpICYgMHhGRixcbiAgICAgICAgd2lkdGggJiAweGZmLCAvLyB3aWR0aFxuICAgICAgICAoaGVpZ2h0ID4+IDgpICYgMHhGRixcbiAgICAgICAgaGVpZ2h0ICYgMHhmZiwgLy8gaGVpZ2h0XG4gICAgICAgIDB4MDAsIDB4NDgsIDB4MDAsIDB4MDAsIC8vIGhvcml6cmVzb2x1dGlvblxuICAgICAgICAweDAwLCAweDQ4LCAweDAwLCAweDAwLCAvLyB2ZXJ0cmVzb2x1dGlvblxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAxLCAvLyBmcmFtZV9jb3VudFxuICAgICAgICAweDEzLFxuICAgICAgICAweDc2LCAweDY5LCAweDY0LCAweDY1LFxuICAgICAgICAweDZmLCAweDZhLCAweDczLCAweDJkLFxuICAgICAgICAweDYzLCAweDZmLCAweDZlLCAweDc0LFxuICAgICAgICAweDcyLCAweDY5LCAweDYyLCAweDJkLFxuICAgICAgICAweDY4LCAweDZjLCAweDczLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBjb21wcmVzc29ybmFtZVxuICAgICAgICAweDAwLCAweDE4LCAvLyBkZXB0aCA9IDI0XG4gICAgICAgIDB4MTEsIDB4MTFdKSwgLy8gcHJlX2RlZmluZWQgPSAtMVxuICAgICAgICAgIGF2Y2MsXG4gICAgICAgICAgTVA0LmJveChNUDQudHlwZXMuYnRydCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAgICAgMHgwMCwgMHgxYywgMHg5YywgMHg4MCwgLy8gYnVmZmVyU2l6ZURCXG4gICAgICAgICAgICAweDAwLCAweDJkLCAweGM2LCAweGMwLCAvLyBtYXhCaXRyYXRlXG4gICAgICAgICAgICAweDAwLCAweDJkLCAweGM2LCAweGMwXSkpIC8vIGF2Z0JpdHJhdGVcbiAgICAgICAgICApO1xuICB9XG5cbiAgc3RhdGljIGVzZHModHJhY2spIHtcbiAgICB2YXIgY29uZmlnbGVuID0gdHJhY2suY29uZmlnLmxlbmd0aDtcbiAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuXG4gICAgICAweDAzLCAvLyBkZXNjcmlwdG9yX3R5cGVcbiAgICAgIDB4MTcrY29uZmlnbGVuLCAvLyBsZW5ndGhcbiAgICAgIDB4MDAsIDB4MDEsIC8vZXNfaWRcbiAgICAgIDB4MDAsIC8vIHN0cmVhbV9wcmlvcml0eVxuXG4gICAgICAweDA0LCAvLyBkZXNjcmlwdG9yX3R5cGVcbiAgICAgIDB4MGYrY29uZmlnbGVuLCAvLyBsZW5ndGhcbiAgICAgIDB4NDAsIC8vY29kZWMgOiBtcGVnNF9hdWRpb1xuICAgICAgMHgxNSwgLy8gc3RyZWFtX3R5cGVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGJ1ZmZlcl9zaXplXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBtYXhCaXRyYXRlXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBhdmdCaXRyYXRlXG5cbiAgICAgIDB4MDUgLy8gZGVzY3JpcHRvcl90eXBlXG4gICAgICBdLmNvbmNhdChbY29uZmlnbGVuXSkuY29uY2F0KHRyYWNrLmNvbmZpZykuY29uY2F0KFsweDA2LCAweDAxLCAweDAyXSkpOyAvLyBHQVNwZWNpZmljQ29uZmlnKSk7IC8vIGxlbmd0aCArIGF1ZGlvIGNvbmZpZyBkZXNjcmlwdG9yXG4gIH1cblxuICBzdGF0aWMgbXA0YSh0cmFjaykge1xuICAgIHZhciBhdWRpb3NhbXBsZXJhdGUgPSB0cmFjay5hdWRpb3NhbXBsZXJhdGU7XG4gICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubXA0YSwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAxLCAvLyBkYXRhX3JlZmVyZW5jZV9pbmRleFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCB0cmFjay5jaGFubmVsQ291bnQsIC8vIGNoYW5uZWxjb3VudFxuICAgICAgMHgwMCwgMHgxMCwgLy8gc2FtcGxlU2l6ZToxNmJpdHNcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkMlxuICAgICAgKGF1ZGlvc2FtcGxlcmF0ZSA+PiA4KSAmIDB4RkYsXG4gICAgICBhdWRpb3NhbXBsZXJhdGUgJiAweGZmLCAvL1xuICAgICAgMHgwMCwgMHgwMF0pLFxuICAgICAgTVA0LmJveChNUDQudHlwZXMuZXNkcywgTVA0LmVzZHModHJhY2spKSk7XG4gIH1cblxuICBzdGF0aWMgc3RzZCh0cmFjaykge1xuICAgIGlmICh0cmFjay50eXBlID09PSAnYXVkaW8nKSB7XG4gICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuc3RzZCwgTVA0LlNUU0QsIE1QNC5tcDRhKHRyYWNrKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5zdHNkLCBNUDQuU1RTRCwgTVA0LmF2YzEodHJhY2spKTtcbiAgICB9XG4gIH1cblxuICBzdGF0aWMgdGtoZCh0cmFjaykge1xuICAgIHZhciBpZCA9IHRyYWNrLmlkLFxuICAgICAgICBkdXJhdGlvbiA9IHRyYWNrLmR1cmF0aW9uLFxuICAgICAgICB3aWR0aCA9IHRyYWNrLndpZHRoLFxuICAgICAgICBoZWlnaHQgPSB0cmFjay5oZWlnaHQ7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnRraGQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwNywgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGNyZWF0aW9uX3RpbWVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIG1vZGlmaWNhdGlvbl90aW1lXG4gICAgICAoaWQgPj4gMjQpICYgMHhGRixcbiAgICAgIChpZCA+PiAxNikgJiAweEZGLFxuICAgICAgKGlkID4+IDgpICYgMHhGRixcbiAgICAgIGlkICYgMHhGRiwgLy8gdHJhY2tfSURcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAoZHVyYXRpb24gPj4gMjQpLFxuICAgICAgKGR1cmF0aW9uID4+IDE2KSAmIDB4RkYsXG4gICAgICAoZHVyYXRpb24gPj4gIDgpICYgMHhGRixcbiAgICAgIGR1cmF0aW9uICYgMHhGRiwgLy8gZHVyYXRpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgLy8gbGF5ZXJcbiAgICAgIDB4MDAsIDB4MDAsIC8vIGFsdGVybmF0ZV9ncm91cFxuICAgICAgMHgwMCwgMHgwMCwgLy8gbm9uLWF1ZGlvIHRyYWNrIHZvbHVtZVxuICAgICAgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHg0MCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gdHJhbnNmb3JtYXRpb246IHVuaXR5IG1hdHJpeFxuICAgICAgKHdpZHRoID4+IDgpICYgMHhGRixcbiAgICAgIHdpZHRoICYgMHhGRixcbiAgICAgIDB4MDAsIDB4MDAsIC8vIHdpZHRoXG4gICAgICAoaGVpZ2h0ID4+IDgpICYgMHhGRixcbiAgICAgIGhlaWdodCAmIDB4RkYsXG4gICAgICAweDAwLCAweDAwIC8vIGhlaWdodFxuICAgIF0pKTtcbiAgfVxuXG4gIHN0YXRpYyB0cmFmKHRyYWNrLGJhc2VNZWRpYURlY29kZVRpbWUpIHtcbiAgICB2YXIgc2FtcGxlRGVwZW5kZW5jeVRhYmxlID0gTVA0LnNkdHAodHJhY2spLFxuICAgICAgICBpZCA9IHRyYWNrLmlkO1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50cmFmLFxuICAgICAgICAgICAgICAgTVA0LmJveChNUDQudHlwZXMudGZoZCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAgICAgICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgICAgICAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgICAgICAgICAgICAgKGlkID4+IDI0KSxcbiAgICAgICAgICAgICAgICAgKGlkID4+IDE2KSAmIDBYRkYsXG4gICAgICAgICAgICAgICAgIChpZCA+PiA4KSAmIDBYRkYsXG4gICAgICAgICAgICAgICAgIChpZCAmIDB4RkYpIC8vIHRyYWNrX0lEXG4gICAgICAgICAgICAgICBdKSksXG4gICAgICAgICAgICAgICBNUDQuYm94KE1QNC50eXBlcy50ZmR0LCBuZXcgVWludDhBcnJheShbXG4gICAgICAgICAgICAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgICAgICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgICAgICAgICAgICAoYmFzZU1lZGlhRGVjb2RlVGltZSA+PjI0KSxcbiAgICAgICAgICAgICAgICAgKGJhc2VNZWRpYURlY29kZVRpbWUgPj4gMTYpICYgMFhGRixcbiAgICAgICAgICAgICAgICAgKGJhc2VNZWRpYURlY29kZVRpbWUgPj4gOCkgJiAwWEZGLFxuICAgICAgICAgICAgICAgICAoYmFzZU1lZGlhRGVjb2RlVGltZSAmIDB4RkYpIC8vIGJhc2VNZWRpYURlY29kZVRpbWVcbiAgICAgICAgICAgICAgIF0pKSxcbiAgICAgICAgICAgICAgIE1QNC50cnVuKHRyYWNrLFxuICAgICAgICAgICAgICAgICAgICBzYW1wbGVEZXBlbmRlbmN5VGFibGUubGVuZ3RoICtcbiAgICAgICAgICAgICAgICAgICAgMTYgKyAvLyB0ZmhkXG4gICAgICAgICAgICAgICAgICAgIDE2ICsgLy8gdGZkdFxuICAgICAgICAgICAgICAgICAgICA4ICsgIC8vIHRyYWYgaGVhZGVyXG4gICAgICAgICAgICAgICAgICAgIDE2ICsgLy8gbWZoZFxuICAgICAgICAgICAgICAgICAgICA4ICsgIC8vIG1vb2YgaGVhZGVyXG4gICAgICAgICAgICAgICAgICAgIDgpLCAgLy8gbWRhdCBoZWFkZXJcbiAgICAgICAgICAgICAgIHNhbXBsZURlcGVuZGVuY3lUYWJsZSk7XG4gIH1cblxuICAvKipcbiAgICogR2VuZXJhdGUgYSB0cmFjayBib3guXG4gICAqIEBwYXJhbSB0cmFjayB7b2JqZWN0fSBhIHRyYWNrIGRlZmluaXRpb25cbiAgICogQHJldHVybiB7VWludDhBcnJheX0gdGhlIHRyYWNrIGJveFxuICAgKi9cbiAgc3RhdGljIHRyYWsodHJhY2spIHtcbiAgICB0cmFjay5kdXJhdGlvbiA9IHRyYWNrLmR1cmF0aW9uIHx8IDB4ZmZmZmZmZmY7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnRyYWssIE1QNC50a2hkKHRyYWNrKSwgTVA0Lm1kaWEodHJhY2spKTtcbiAgfVxuXG4gIHN0YXRpYyB0cmV4KHRyYWNrKSB7XG4gICAgdmFyIGlkID0gdHJhY2suaWQ7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnRyZXgsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgKGlkID4+IDI0KSxcbiAgICAgKGlkID4+IDE2KSAmIDBYRkYsXG4gICAgIChpZCA+PiA4KSAmIDBYRkYsXG4gICAgIChpZCAmIDB4RkYpLCAvLyB0cmFja19JRFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMSwgLy8gZGVmYXVsdF9zYW1wbGVfZGVzY3JpcHRpb25faW5kZXhcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGRlZmF1bHRfc2FtcGxlX2R1cmF0aW9uXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBkZWZhdWx0X3NhbXBsZV9zaXplXG4gICAgICAweDAwLCAweDAxLCAweDAwLCAweDAxIC8vIGRlZmF1bHRfc2FtcGxlX2ZsYWdzXG4gICAgXSkpO1xuICB9XG5cbiAgc3RhdGljIHRydW4odHJhY2ssIG9mZnNldCkge1xuICAgIHZhciBzYW1wbGVzPSB0cmFjay5zYW1wbGVzIHx8IFtdLFxuICAgICAgICBsZW4gPSBzYW1wbGVzLmxlbmd0aCxcbiAgICAgICAgYXJyYXlsZW4gPSAxMiArICgxNiAqIGxlbiksXG4gICAgICAgIGFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoYXJyYXlsZW4pLFxuICAgICAgICBpLHNhbXBsZSxkdXJhdGlvbixzaXplLGZsYWdzLGN0cztcbiAgICBvZmZzZXQgKz0gOCArIGFycmF5bGVuO1xuICAgIGFycmF5LnNldChbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MGYsIDB4MDEsIC8vIGZsYWdzXG4gICAgICAobGVuID4+PiAyNCkgJiAweEZGLFxuICAgICAgKGxlbiA+Pj4gMTYpICYgMHhGRixcbiAgICAgIChsZW4gPj4+IDgpICYgMHhGRixcbiAgICAgIGxlbiAmIDB4RkYsIC8vIHNhbXBsZV9jb3VudFxuICAgICAgKG9mZnNldCA+Pj4gMjQpICYgMHhGRixcbiAgICAgIChvZmZzZXQgPj4+IDE2KSAmIDB4RkYsXG4gICAgICAob2Zmc2V0ID4+PiA4KSAmIDB4RkYsXG4gICAgICBvZmZzZXQgJiAweEZGIC8vIGRhdGFfb2Zmc2V0XG4gICAgXSwwKTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIHNhbXBsZSA9IHNhbXBsZXNbaV07XG4gICAgICBkdXJhdGlvbiA9IHNhbXBsZS5kdXJhdGlvbjtcbiAgICAgIHNpemUgPSBzYW1wbGUuc2l6ZTtcbiAgICAgIGZsYWdzID0gc2FtcGxlLmZsYWdzO1xuICAgICAgY3RzID0gc2FtcGxlLmN0cztcbiAgICAgIGFycmF5LnNldChbXG4gICAgICAgIChkdXJhdGlvbiA+Pj4gMjQpICYgMHhGRixcbiAgICAgICAgKGR1cmF0aW9uID4+PiAxNikgJiAweEZGLFxuICAgICAgICAoZHVyYXRpb24gPj4+IDgpICYgMHhGRixcbiAgICAgICAgZHVyYXRpb24gJiAweEZGLCAvLyBzYW1wbGVfZHVyYXRpb25cbiAgICAgICAgKHNpemUgPj4+IDI0KSAmIDB4RkYsXG4gICAgICAgIChzaXplID4+PiAxNikgJiAweEZGLFxuICAgICAgICAoc2l6ZSA+Pj4gOCkgJiAweEZGLFxuICAgICAgICBzaXplICYgMHhGRiwgLy8gc2FtcGxlX3NpemVcbiAgICAgICAgKGZsYWdzLmlzTGVhZGluZyA8PCAyKSB8IGZsYWdzLmRlcGVuZHNPbixcbiAgICAgICAgKGZsYWdzLmlzRGVwZW5kZWRPbiA8PCA2KSB8XG4gICAgICAgICAgKGZsYWdzLmhhc1JlZHVuZGFuY3kgPDwgNCkgfFxuICAgICAgICAgIChmbGFncy5wYWRkaW5nVmFsdWUgPDwgMSkgfFxuICAgICAgICAgIGZsYWdzLmlzTm9uU3luYyxcbiAgICAgICAgZmxhZ3MuZGVncmFkUHJpbyAmIDB4RjAgPDwgOCxcbiAgICAgICAgZmxhZ3MuZGVncmFkUHJpbyAmIDB4MEYsIC8vIHNhbXBsZV9mbGFnc1xuICAgICAgICAoY3RzID4+PiAyNCkgJiAweEZGLFxuICAgICAgICAoY3RzID4+PiAxNikgJiAweEZGLFxuICAgICAgICAoY3RzID4+PiA4KSAmIDB4RkYsXG4gICAgICAgIGN0cyAmIDB4RkYgLy8gc2FtcGxlX2NvbXBvc2l0aW9uX3RpbWVfb2Zmc2V0XG4gICAgICBdLDEyKzE2KmkpO1xuICAgIH1cbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudHJ1biwgYXJyYXkpO1xuICB9XG5cbiAgc3RhdGljIGluaXRTZWdtZW50KHRyYWNrcykge1xuICAgIGlmICghTVA0LnR5cGVzKSB7XG4gICAgICBNUDQuaW5pdCgpO1xuICAgIH1cbiAgICB2YXIgbW92aWUgPSBNUDQubW9vdih0cmFja3MpLCByZXN1bHQ7XG4gICAgcmVzdWx0ID0gbmV3IFVpbnQ4QXJyYXkoTVA0LkZUWVAuYnl0ZUxlbmd0aCArIG1vdmllLmJ5dGVMZW5ndGgpO1xuICAgIHJlc3VsdC5zZXQoTVA0LkZUWVApO1xuICAgIHJlc3VsdC5zZXQobW92aWUsIE1QNC5GVFlQLmJ5dGVMZW5ndGgpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTVA0O1xuIiwiLyoqXG4gKiBmTVA0IHJlbXV4ZXJcbiovXG5cblxuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCBNUDQgZnJvbSAnLi4vcmVtdXgvbXA0LWdlbmVyYXRvcic7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcblxuY2xhc3MgTVA0UmVtdXhlciB7XG4gIGNvbnN0cnVjdG9yKG9ic2VydmVyKSB7XG4gICAgdGhpcy5vYnNlcnZlciA9IG9ic2VydmVyO1xuICAgIHRoaXMuSVNHZW5lcmF0ZWQgPSBmYWxzZTtcbiAgICB0aGlzLlBFUzJNUDRTQ0FMRUZBQ1RPUiA9IDQ7XG4gICAgdGhpcy5QRVNfVElNRVNDQUxFID0gOTAwMDA7XG4gICAgdGhpcy5NUDRfVElNRVNDQUxFID0gdGhpcy5QRVNfVElNRVNDQUxFIC8gdGhpcy5QRVMyTVA0U0NBTEVGQUNUT1I7XG4gIH1cblxuICBnZXQgdGltZXNjYWxlKCkge1xuICAgIHJldHVybiB0aGlzLk1QNF9USU1FU0NBTEU7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICB9XG5cbiAgaW5zZXJ0RGlzY29udGludWl0eSgpIHtcbiAgICB0aGlzLl9pbml0UFRTID0gdGhpcy5faW5pdERUUyA9IHRoaXMubmV4dEFhY1B0cyA9IHRoaXMubmV4dEF2Y0R0cyA9IHVuZGVmaW5lZDtcbiAgfVxuXG4gIHN3aXRjaExldmVsKCkge1xuICAgIHRoaXMuSVNHZW5lcmF0ZWQgPSBmYWxzZTtcbiAgfVxuXG4gIHJlbXV4KGF1ZGlvVHJhY2ssdmlkZW9UcmFjayxpZDNUcmFjayx0ZXh0VHJhY2ssdGltZU9mZnNldCwgY29udGlndW91cykge1xuICAgIC8vIGdlbmVyYXRlIEluaXQgU2VnbWVudCBpZiBuZWVkZWRcbiAgICBpZiAoIXRoaXMuSVNHZW5lcmF0ZWQpIHtcbiAgICAgIHRoaXMuZ2VuZXJhdGVJUyhhdWRpb1RyYWNrLHZpZGVvVHJhY2ssdGltZU9mZnNldCk7XG4gICAgfVxuICAgIC8vbG9nZ2VyLmxvZygnbmIgQVZDIHNhbXBsZXM6JyArIHZpZGVvVHJhY2suc2FtcGxlcy5sZW5ndGgpO1xuICAgIGlmICh2aWRlb1RyYWNrLnNhbXBsZXMubGVuZ3RoKSB7XG4gICAgICB0aGlzLnJlbXV4VmlkZW8odmlkZW9UcmFjayx0aW1lT2Zmc2V0LGNvbnRpZ3VvdXMpO1xuICAgIH1cbiAgICAvL2xvZ2dlci5sb2coJ25iIEFBQyBzYW1wbGVzOicgKyBhdWRpb1RyYWNrLnNhbXBsZXMubGVuZ3RoKTtcbiAgICBpZiAoYXVkaW9UcmFjay5zYW1wbGVzLmxlbmd0aCkge1xuICAgICAgdGhpcy5yZW11eEF1ZGlvKGF1ZGlvVHJhY2ssdGltZU9mZnNldCxjb250aWd1b3VzKTtcbiAgICB9XG4gICAgLy9sb2dnZXIubG9nKCduYiBJRDMgc2FtcGxlczonICsgYXVkaW9UcmFjay5zYW1wbGVzLmxlbmd0aCk7XG4gICAgaWYgKGlkM1RyYWNrLnNhbXBsZXMubGVuZ3RoKSB7XG4gICAgICB0aGlzLnJlbXV4SUQzKGlkM1RyYWNrLHRpbWVPZmZzZXQpO1xuICAgIH1cbiAgICAvL2xvZ2dlci5sb2coJ25iIElEMyBzYW1wbGVzOicgKyBhdWRpb1RyYWNrLnNhbXBsZXMubGVuZ3RoKTtcbiAgICBpZiAodGV4dFRyYWNrLnNhbXBsZXMubGVuZ3RoKSB7XG4gICAgICB0aGlzLnJlbXV4VGV4dCh0ZXh0VHJhY2ssdGltZU9mZnNldCk7XG4gICAgfVxuICAgIC8vbm90aWZ5IGVuZCBvZiBwYXJzaW5nXG4gICAgdGhpcy5vYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0VEKTtcbiAgfVxuXG4gIGdlbmVyYXRlSVMoYXVkaW9UcmFjayx2aWRlb1RyYWNrLHRpbWVPZmZzZXQpIHtcbiAgICB2YXIgb2JzZXJ2ZXIgPSB0aGlzLm9ic2VydmVyLFxuICAgICAgICBhdWRpb1NhbXBsZXMgPSBhdWRpb1RyYWNrLnNhbXBsZXMsXG4gICAgICAgIHZpZGVvU2FtcGxlcyA9IHZpZGVvVHJhY2suc2FtcGxlcyxcbiAgICAgICAgbmJBdWRpbyA9IGF1ZGlvU2FtcGxlcy5sZW5ndGgsXG4gICAgICAgIG5iVmlkZW8gPSB2aWRlb1NhbXBsZXMubGVuZ3RoLFxuICAgICAgICBwZXNUaW1lU2NhbGUgPSB0aGlzLlBFU19USU1FU0NBTEU7XG5cbiAgICBpZihuYkF1ZGlvID09PSAwICYmIG5iVmlkZW8gPT09IDApIHtcbiAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlIDogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkZSQUdfUEFSU0lOR19FUlJPUiwgZmF0YWw6IGZhbHNlLCByZWFzb246ICdubyBhdWRpby92aWRlbyBzYW1wbGVzIGZvdW5kJ30pO1xuICAgIH0gZWxzZSBpZiAobmJWaWRlbyA9PT0gMCkge1xuICAgICAgLy9hdWRpbyBvbmx5XG4gICAgICBpZiAoYXVkaW9UcmFjay5jb25maWcpIHtcbiAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCwge1xuICAgICAgICAgIGF1ZGlvTW9vdjogTVA0LmluaXRTZWdtZW50KFthdWRpb1RyYWNrXSksXG4gICAgICAgICAgYXVkaW9Db2RlYyA6IGF1ZGlvVHJhY2suY29kZWMsXG4gICAgICAgICAgYXVkaW9DaGFubmVsQ291bnQgOiBhdWRpb1RyYWNrLmNoYW5uZWxDb3VudFxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5JU0dlbmVyYXRlZCA9IHRydWU7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5faW5pdFBUUyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIC8vIHJlbWVtYmVyIGZpcnN0IFBUUyBvZiB0aGlzIGRlbXV4aW5nIGNvbnRleHRcbiAgICAgICAgdGhpcy5faW5pdFBUUyA9IGF1ZGlvU2FtcGxlc1swXS5wdHMgLSBwZXNUaW1lU2NhbGUgKiB0aW1lT2Zmc2V0O1xuICAgICAgICB0aGlzLl9pbml0RFRTID0gYXVkaW9TYW1wbGVzWzBdLmR0cyAtIHBlc1RpbWVTY2FsZSAqIHRpbWVPZmZzZXQ7XG4gICAgICB9XG4gICAgfSBlbHNlXG4gICAgaWYgKG5iQXVkaW8gPT09IDApIHtcbiAgICAgIC8vdmlkZW8gb25seVxuICAgICAgaWYgKHZpZGVvVHJhY2suc3BzICYmIHZpZGVvVHJhY2sucHBzKSB7XG4gICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQsIHtcbiAgICAgICAgICB2aWRlb01vb3Y6IE1QNC5pbml0U2VnbWVudChbdmlkZW9UcmFja10pLFxuICAgICAgICAgIHZpZGVvQ29kZWM6IHZpZGVvVHJhY2suY29kZWMsXG4gICAgICAgICAgdmlkZW9XaWR0aDogdmlkZW9UcmFjay53aWR0aCxcbiAgICAgICAgICB2aWRlb0hlaWdodDogdmlkZW9UcmFjay5oZWlnaHRcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuSVNHZW5lcmF0ZWQgPSB0cnVlO1xuICAgICAgICBpZiAodGhpcy5faW5pdFBUUyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgLy8gcmVtZW1iZXIgZmlyc3QgUFRTIG9mIHRoaXMgZGVtdXhpbmcgY29udGV4dFxuICAgICAgICAgIHRoaXMuX2luaXRQVFMgPSB2aWRlb1NhbXBsZXNbMF0ucHRzIC0gcGVzVGltZVNjYWxlICogdGltZU9mZnNldDtcbiAgICAgICAgICB0aGlzLl9pbml0RFRTID0gdmlkZW9TYW1wbGVzWzBdLmR0cyAtIHBlc1RpbWVTY2FsZSAqIHRpbWVPZmZzZXQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy9hdWRpbyBhbmQgdmlkZW9cbiAgICAgIGlmIChhdWRpb1RyYWNrLmNvbmZpZyAmJiB2aWRlb1RyYWNrLnNwcyAmJiB2aWRlb1RyYWNrLnBwcykge1xuICAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCwge1xuICAgICAgICAgIGF1ZGlvTW9vdjogTVA0LmluaXRTZWdtZW50KFthdWRpb1RyYWNrXSksXG4gICAgICAgICAgYXVkaW9Db2RlYzogYXVkaW9UcmFjay5jb2RlYyxcbiAgICAgICAgICBhdWRpb0NoYW5uZWxDb3VudDogYXVkaW9UcmFjay5jaGFubmVsQ291bnQsXG4gICAgICAgICAgdmlkZW9Nb292OiBNUDQuaW5pdFNlZ21lbnQoW3ZpZGVvVHJhY2tdKSxcbiAgICAgICAgICB2aWRlb0NvZGVjOiB2aWRlb1RyYWNrLmNvZGVjLFxuICAgICAgICAgIHZpZGVvV2lkdGg6IHZpZGVvVHJhY2sud2lkdGgsXG4gICAgICAgICAgdmlkZW9IZWlnaHQ6IHZpZGVvVHJhY2suaGVpZ2h0XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLklTR2VuZXJhdGVkID0gdHJ1ZTtcbiAgICAgICAgaWYgKHRoaXMuX2luaXRQVFMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIC8vIHJlbWVtYmVyIGZpcnN0IFBUUyBvZiB0aGlzIGRlbXV4aW5nIGNvbnRleHRcbiAgICAgICAgICB0aGlzLl9pbml0UFRTID0gTWF0aC5taW4odmlkZW9TYW1wbGVzWzBdLnB0cywgYXVkaW9TYW1wbGVzWzBdLnB0cykgLSBwZXNUaW1lU2NhbGUgKiB0aW1lT2Zmc2V0O1xuICAgICAgICAgIHRoaXMuX2luaXREVFMgPSBNYXRoLm1pbih2aWRlb1NhbXBsZXNbMF0uZHRzLCBhdWRpb1NhbXBsZXNbMF0uZHRzKSAtIHBlc1RpbWVTY2FsZSAqIHRpbWVPZmZzZXQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZW11eFZpZGVvKHRyYWNrLCB0aW1lT2Zmc2V0LCBjb250aWd1b3VzKSB7XG4gICAgdmFyIHZpZXcsXG4gICAgICAgIG9mZnNldCA9IDgsXG4gICAgICAgIHBlc1RpbWVTY2FsZSA9IHRoaXMuUEVTX1RJTUVTQ0FMRSxcbiAgICAgICAgcGVzMm1wNFNjYWxlRmFjdG9yID0gdGhpcy5QRVMyTVA0U0NBTEVGQUNUT1IsXG4gICAgICAgIGF2Y1NhbXBsZSxcbiAgICAgICAgbXA0U2FtcGxlLFxuICAgICAgICBtcDRTYW1wbGVMZW5ndGgsXG4gICAgICAgIHVuaXQsXG4gICAgICAgIG1kYXQsIG1vb2YsXG4gICAgICAgIGZpcnN0UFRTLCBmaXJzdERUUywgbGFzdERUUyxcbiAgICAgICAgcHRzLCBkdHMsIHB0c25vcm0sIGR0c25vcm0sXG4gICAgICAgIGZsYWdzLFxuICAgICAgICBzYW1wbGVzID0gW107XG4gICAgLyogY29uY2F0ZW5hdGUgdGhlIHZpZGVvIGRhdGEgYW5kIGNvbnN0cnVjdCB0aGUgbWRhdCBpbiBwbGFjZVxuICAgICAgKG5lZWQgOCBtb3JlIGJ5dGVzIHRvIGZpbGwgbGVuZ3RoIGFuZCBtcGRhdCB0eXBlKSAqL1xuICAgIG1kYXQgPSBuZXcgVWludDhBcnJheSh0cmFjay5sZW4gKyAoNCAqIHRyYWNrLm5iTmFsdSkgKyA4KTtcbiAgICB2aWV3ID0gbmV3IERhdGFWaWV3KG1kYXQuYnVmZmVyKTtcbiAgICB2aWV3LnNldFVpbnQzMigwLCBtZGF0LmJ5dGVMZW5ndGgpO1xuICAgIG1kYXQuc2V0KE1QNC50eXBlcy5tZGF0LCA0KTtcbiAgICB3aGlsZSAodHJhY2suc2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgIGF2Y1NhbXBsZSA9IHRyYWNrLnNhbXBsZXMuc2hpZnQoKTtcbiAgICAgIG1wNFNhbXBsZUxlbmd0aCA9IDA7XG4gICAgICAvLyBjb252ZXJ0IE5BTFUgYml0c3RyZWFtIHRvIE1QNCBmb3JtYXQgKHByZXBlbmQgTkFMVSB3aXRoIHNpemUgZmllbGQpXG4gICAgICB3aGlsZSAoYXZjU2FtcGxlLnVuaXRzLnVuaXRzLmxlbmd0aCkge1xuICAgICAgICB1bml0ID0gYXZjU2FtcGxlLnVuaXRzLnVuaXRzLnNoaWZ0KCk7XG4gICAgICAgIHZpZXcuc2V0VWludDMyKG9mZnNldCwgdW5pdC5kYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgICBvZmZzZXQgKz0gNDtcbiAgICAgICAgbWRhdC5zZXQodW5pdC5kYXRhLCBvZmZzZXQpO1xuICAgICAgICBvZmZzZXQgKz0gdW5pdC5kYXRhLmJ5dGVMZW5ndGg7XG4gICAgICAgIG1wNFNhbXBsZUxlbmd0aCArPSA0ICsgdW5pdC5kYXRhLmJ5dGVMZW5ndGg7XG4gICAgICB9XG4gICAgICBwdHMgPSBhdmNTYW1wbGUucHRzIC0gdGhpcy5faW5pdERUUztcbiAgICAgIGR0cyA9IGF2Y1NhbXBsZS5kdHMgLSB0aGlzLl9pbml0RFRTO1xuICAgICAgLy8gZW5zdXJlIERUUyBpcyBub3QgYmlnZ2VyIHRoYW4gUFRTXG4gICAgICBkdHMgPSBNYXRoLm1pbihwdHMsZHRzKTtcbiAgICAgIC8vbG9nZ2VyLmxvZyhgVmlkZW8vUFRTL0RUUzoke01hdGgucm91bmQocHRzLzkwKX0vJHtNYXRoLnJvdW5kKGR0cy85MCl9YCk7XG4gICAgICAvLyBpZiBub3QgZmlyc3QgQVZDIHNhbXBsZSBvZiB2aWRlbyB0cmFjaywgbm9ybWFsaXplIFBUUy9EVFMgd2l0aCBwcmV2aW91cyBzYW1wbGUgdmFsdWVcbiAgICAgIC8vIGFuZCBlbnN1cmUgdGhhdCBzYW1wbGUgZHVyYXRpb24gaXMgcG9zaXRpdmVcbiAgICAgIGlmIChsYXN0RFRTICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShwdHMsIGxhc3REVFMpO1xuICAgICAgICBkdHNub3JtID0gdGhpcy5fUFRTTm9ybWFsaXplKGR0cywgbGFzdERUUyk7XG4gICAgICAgIHZhciBzYW1wbGVEdXJhdGlvbiA9IChkdHNub3JtIC0gbGFzdERUUykgLyBwZXMybXA0U2NhbGVGYWN0b3I7XG4gICAgICAgIGlmIChzYW1wbGVEdXJhdGlvbiA8PSAwKSB7XG4gICAgICAgICAgbG9nZ2VyLmxvZyhgaW52YWxpZCBzYW1wbGUgZHVyYXRpb24gYXQgUFRTL0RUUzogJHthdmNTYW1wbGUucHRzfS8ke2F2Y1NhbXBsZS5kdHN9OiR7c2FtcGxlRHVyYXRpb259YCk7XG4gICAgICAgICAgc2FtcGxlRHVyYXRpb24gPSAxO1xuICAgICAgICB9XG4gICAgICAgIG1wNFNhbXBsZS5kdXJhdGlvbiA9IHNhbXBsZUR1cmF0aW9uO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIG5leHRBdmNEdHMgPSB0aGlzLm5leHRBdmNEdHMsZGVsdGE7XG4gICAgICAgIC8vIGZpcnN0IEFWQyBzYW1wbGUgb2YgdmlkZW8gdHJhY2ssIG5vcm1hbGl6ZSBQVFMvRFRTXG4gICAgICAgIHB0c25vcm0gPSB0aGlzLl9QVFNOb3JtYWxpemUocHRzLCBuZXh0QXZjRHRzKTtcbiAgICAgICAgZHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShkdHMsIG5leHRBdmNEdHMpO1xuICAgICAgICBkZWx0YSA9IE1hdGgucm91bmQoKGR0c25vcm0gLSBuZXh0QXZjRHRzKSAvIDkwKTtcbiAgICAgICAgLy8gaWYgZnJhZ21lbnQgYXJlIGNvbnRpZ3VvdXMsIG9yIGRlbHRhIGxlc3MgdGhhbiA2MDBtcywgZW5zdXJlIHRoZXJlIGlzIG5vIG92ZXJsYXAvaG9sZSBiZXR3ZWVuIGZyYWdtZW50c1xuICAgICAgICBpZiAoY29udGlndW91cyB8fCBNYXRoLmFicyhkZWx0YSkgPCA2MDApIHtcbiAgICAgICAgICBpZiAoZGVsdGEpIHtcbiAgICAgICAgICAgIGlmIChkZWx0YSA+IDEpIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgQVZDOiR7ZGVsdGF9IG1zIGhvbGUgYmV0d2VlbiBmcmFnbWVudHMgZGV0ZWN0ZWQsZmlsbGluZyBpdGApO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkZWx0YSA8IC0xKSB7XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coYEFWQzokeygtZGVsdGEpfSBtcyBvdmVybGFwcGluZyBiZXR3ZWVuIGZyYWdtZW50cyBkZXRlY3RlZGApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gc2V0IERUUyB0byBuZXh0IERUU1xuICAgICAgICAgICAgZHRzbm9ybSA9IG5leHRBdmNEdHM7XG4gICAgICAgICAgICAvLyBvZmZzZXQgUFRTIGFzIHdlbGwsIGVuc3VyZSB0aGF0IFBUUyBpcyBzbWFsbGVyIG9yIGVxdWFsIHRoYW4gbmV3IERUU1xuICAgICAgICAgICAgcHRzbm9ybSA9IE1hdGgubWF4KHB0c25vcm0gLSBkZWx0YSwgZHRzbm9ybSk7XG4gICAgICAgICAgICBsb2dnZXIubG9nKGBWaWRlby9QVFMvRFRTIGFkanVzdGVkOiAke3B0c25vcm19LyR7ZHRzbm9ybX0sZGVsdGE6JHtkZWx0YX1gKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gcmVtZW1iZXIgZmlyc3QgUFRTIG9mIG91ciBhdmNTYW1wbGVzLCBlbnN1cmUgdmFsdWUgaXMgcG9zaXRpdmVcbiAgICAgICAgZmlyc3RQVFMgPSBNYXRoLm1heCgwLCBwdHNub3JtKTtcbiAgICAgICAgZmlyc3REVFMgPSBNYXRoLm1heCgwLCBkdHNub3JtKTtcbiAgICAgIH1cbiAgICAgIC8vY29uc29sZS5sb2coJ1BUUy9EVFMvaW5pdERUUy9ub3JtUFRTL25vcm1EVFMvcmVsYXRpdmUgUFRTIDogJHthdmNTYW1wbGUucHRzfS8ke2F2Y1NhbXBsZS5kdHN9LyR7dGhpcy5faW5pdERUU30vJHtwdHNub3JtfS8ke2R0c25vcm19LyR7KGF2Y1NhbXBsZS5wdHMvNDI5NDk2NzI5NikudG9GaXhlZCgzKX0nKTtcbiAgICAgIG1wNFNhbXBsZSA9IHtcbiAgICAgICAgc2l6ZTogbXA0U2FtcGxlTGVuZ3RoLFxuICAgICAgICBkdXJhdGlvbjogMCxcbiAgICAgICAgY3RzOiAocHRzbm9ybSAtIGR0c25vcm0pIC8gcGVzMm1wNFNjYWxlRmFjdG9yLFxuICAgICAgICBmbGFnczoge1xuICAgICAgICAgIGlzTGVhZGluZzogMCxcbiAgICAgICAgICBpc0RlcGVuZGVkT246IDAsXG4gICAgICAgICAgaGFzUmVkdW5kYW5jeTogMCxcbiAgICAgICAgICBkZWdyYWRQcmlvOiAwXG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICBmbGFncyA9IG1wNFNhbXBsZS5mbGFncztcbiAgICAgIGlmIChhdmNTYW1wbGUua2V5ID09PSB0cnVlKSB7XG4gICAgICAgIC8vIHRoZSBjdXJyZW50IHNhbXBsZSBpcyBhIGtleSBmcmFtZVxuICAgICAgICBmbGFncy5kZXBlbmRzT24gPSAyO1xuICAgICAgICBmbGFncy5pc05vblN5bmMgPSAwO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZmxhZ3MuZGVwZW5kc09uID0gMTtcbiAgICAgICAgZmxhZ3MuaXNOb25TeW5jID0gMTtcbiAgICAgIH1cbiAgICAgIHNhbXBsZXMucHVzaChtcDRTYW1wbGUpO1xuICAgICAgbGFzdERUUyA9IGR0c25vcm07XG4gICAgfVxuICAgIHZhciBsYXN0U2FtcGxlRHVyYXRpb24gPSAwO1xuICAgIGlmIChzYW1wbGVzLmxlbmd0aCA+PSAyKSB7XG4gICAgICBsYXN0U2FtcGxlRHVyYXRpb24gPSBzYW1wbGVzW3NhbXBsZXMubGVuZ3RoIC0gMl0uZHVyYXRpb247XG4gICAgICBtcDRTYW1wbGUuZHVyYXRpb24gPSBsYXN0U2FtcGxlRHVyYXRpb247XG4gICAgfVxuICAgIC8vIG5leHQgQVZDIHNhbXBsZSBEVFMgc2hvdWxkIGJlIGVxdWFsIHRvIGxhc3Qgc2FtcGxlIERUUyArIGxhc3Qgc2FtcGxlIGR1cmF0aW9uXG4gICAgdGhpcy5uZXh0QXZjRHRzID0gZHRzbm9ybSArIGxhc3RTYW1wbGVEdXJhdGlvbiAqIHBlczJtcDRTY2FsZUZhY3RvcjtcbiAgICB0cmFjay5sZW4gPSAwO1xuICAgIHRyYWNrLm5iTmFsdSA9IDA7XG4gICAgaWYoc2FtcGxlcy5sZW5ndGggJiYgbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLmluZGV4T2YoJ2Nocm9tZScpID4gLTEpIHtcbiAgICAgIGZsYWdzID0gc2FtcGxlc1swXS5mbGFncztcbiAgICAvLyBjaHJvbWUgd29ya2Fyb3VuZCwgbWFyayBmaXJzdCBzYW1wbGUgYXMgYmVpbmcgYSBSYW5kb20gQWNjZXNzIFBvaW50IHRvIGF2b2lkIHNvdXJjZWJ1ZmZlciBhcHBlbmQgaXNzdWVcbiAgICAvLyBodHRwczovL2NvZGUuZ29vZ2xlLmNvbS9wL2Nocm9taXVtL2lzc3Vlcy9kZXRhaWw/aWQ9MjI5NDEyXG4gICAgICBmbGFncy5kZXBlbmRzT24gPSAyO1xuICAgICAgZmxhZ3MuaXNOb25TeW5jID0gMDtcbiAgICB9XG4gICAgdHJhY2suc2FtcGxlcyA9IHNhbXBsZXM7XG4gICAgbW9vZiA9IE1QNC5tb29mKHRyYWNrLnNlcXVlbmNlTnVtYmVyKyssIGZpcnN0RFRTIC8gcGVzMm1wNFNjYWxlRmFjdG9yLCB0cmFjayk7XG4gICAgdHJhY2suc2FtcGxlcyA9IFtdO1xuICAgIHRoaXMub2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfREFUQSwge1xuICAgICAgbW9vZjogbW9vZixcbiAgICAgIG1kYXQ6IG1kYXQsXG4gICAgICBzdGFydFBUUzogZmlyc3RQVFMgLyBwZXNUaW1lU2NhbGUsXG4gICAgICBlbmRQVFM6IChwdHNub3JtICsgcGVzMm1wNFNjYWxlRmFjdG9yICogbGFzdFNhbXBsZUR1cmF0aW9uKSAvIHBlc1RpbWVTY2FsZSxcbiAgICAgIHN0YXJ0RFRTOiBmaXJzdERUUyAvIHBlc1RpbWVTY2FsZSxcbiAgICAgIGVuZERUUzogdGhpcy5uZXh0QXZjRHRzIC8gcGVzVGltZVNjYWxlLFxuICAgICAgdHlwZTogJ3ZpZGVvJyxcbiAgICAgIG5iOiBzYW1wbGVzLmxlbmd0aFxuICAgIH0pO1xuICB9XG5cbiAgcmVtdXhBdWRpbyh0cmFjayx0aW1lT2Zmc2V0LCBjb250aWd1b3VzKSB7XG4gICAgdmFyIHZpZXcsXG4gICAgICAgIG9mZnNldCA9IDgsXG4gICAgICAgIHBlc1RpbWVTY2FsZSA9IHRoaXMuUEVTX1RJTUVTQ0FMRSxcbiAgICAgICAgcGVzMm1wNFNjYWxlRmFjdG9yID0gdGhpcy5QRVMyTVA0U0NBTEVGQUNUT1IsXG4gICAgICAgIGFhY1NhbXBsZSwgbXA0U2FtcGxlLFxuICAgICAgICB1bml0LFxuICAgICAgICBtZGF0LCBtb29mLFxuICAgICAgICBmaXJzdFBUUywgZmlyc3REVFMsIGxhc3REVFMsXG4gICAgICAgIHB0cywgZHRzLCBwdHNub3JtLCBkdHNub3JtLFxuICAgICAgICBzYW1wbGVzID0gW10sXG4gICAgICAgIHNhbXBsZXMwID0gW107XG5cbiAgICB0cmFjay5zYW1wbGVzLmZvckVhY2goYWFjU2FtcGxlID0+IHtcbiAgICAgIGlmKHB0cyA9PT0gdW5kZWZpbmVkIHx8IGFhY1NhbXBsZS5wdHMgPiBwdHMpIHtcbiAgICAgICAgc2FtcGxlczAucHVzaChhYWNTYW1wbGUpO1xuICAgICAgICBwdHMgPSBhYWNTYW1wbGUucHRzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbG9nZ2VyLndhcm4oJ2Ryb3BwaW5nIHBhc3QgYXVkaW8gZnJhbWUnKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHdoaWxlIChzYW1wbGVzMC5sZW5ndGgpIHtcbiAgICAgIGFhY1NhbXBsZSA9IHNhbXBsZXMwLnNoaWZ0KCk7XG4gICAgICB1bml0ID0gYWFjU2FtcGxlLnVuaXQ7XG4gICAgICBwdHMgPSBhYWNTYW1wbGUucHRzIC0gdGhpcy5faW5pdERUUztcbiAgICAgIGR0cyA9IGFhY1NhbXBsZS5kdHMgLSB0aGlzLl9pbml0RFRTO1xuICAgICAgLy9sb2dnZXIubG9nKGBBdWRpby9QVFM6JHtNYXRoLnJvdW5kKHB0cy85MCl9YCk7XG4gICAgICAvLyBpZiBub3QgZmlyc3Qgc2FtcGxlXG4gICAgICBpZiAobGFzdERUUyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHB0c25vcm0gPSB0aGlzLl9QVFNOb3JtYWxpemUocHRzLCBsYXN0RFRTKTtcbiAgICAgICAgZHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShkdHMsIGxhc3REVFMpO1xuICAgICAgICAvLyBsZXQncyBjb21wdXRlIHNhbXBsZSBkdXJhdGlvblxuICAgICAgICBtcDRTYW1wbGUuZHVyYXRpb24gPSAoZHRzbm9ybSAtIGxhc3REVFMpIC8gcGVzMm1wNFNjYWxlRmFjdG9yO1xuICAgICAgICBpZiAobXA0U2FtcGxlLmR1cmF0aW9uIDwgMCkge1xuICAgICAgICAgIC8vIG5vdCBleHBlY3RlZCB0byBoYXBwZW4gLi4uXG4gICAgICAgICAgbG9nZ2VyLmxvZyhgaW52YWxpZCBBQUMgc2FtcGxlIGR1cmF0aW9uIGF0IFBUUzoke2FhY1NhbXBsZS5wdHN9OiR7bXA0U2FtcGxlLmR1cmF0aW9ufWApO1xuICAgICAgICAgIG1wNFNhbXBsZS5kdXJhdGlvbiA9IDA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBuZXh0QWFjUHRzID0gdGhpcy5uZXh0QWFjUHRzLGRlbHRhO1xuICAgICAgICBwdHNub3JtID0gdGhpcy5fUFRTTm9ybWFsaXplKHB0cywgbmV4dEFhY1B0cyk7XG4gICAgICAgIGR0c25vcm0gPSB0aGlzLl9QVFNOb3JtYWxpemUoZHRzLCBuZXh0QWFjUHRzKTtcbiAgICAgICAgZGVsdGEgPSBNYXRoLnJvdW5kKDEwMDAgKiAocHRzbm9ybSAtIG5leHRBYWNQdHMpIC8gcGVzVGltZVNjYWxlKTtcbiAgICAgICAgLy8gaWYgZnJhZ21lbnQgYXJlIGNvbnRpZ3VvdXMsIG9yIGRlbHRhIGxlc3MgdGhhbiA2MDBtcywgZW5zdXJlIHRoZXJlIGlzIG5vIG92ZXJsYXAvaG9sZSBiZXR3ZWVuIGZyYWdtZW50c1xuICAgICAgICBpZiAoY29udGlndW91cyB8fCBNYXRoLmFicyhkZWx0YSkgPCA2MDApIHtcbiAgICAgICAgICAvLyBsb2cgZGVsdGFcbiAgICAgICAgICBpZiAoZGVsdGEpIHtcbiAgICAgICAgICAgIGlmIChkZWx0YSA+IDApIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgJHtkZWx0YX0gbXMgaG9sZSBiZXR3ZWVuIEFBQyBzYW1wbGVzIGRldGVjdGVkLGZpbGxpbmcgaXRgKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZGVsdGEgPCAwKSB7XG4gICAgICAgICAgICAgIC8vIGRyb3Agb3ZlcmxhcHBpbmcgYXVkaW8gZnJhbWVzLi4uIGJyb3dzZXIgd2lsbCBkZWFsIHdpdGggaXRcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgJHsoLWRlbHRhKX0gbXMgb3ZlcmxhcHBpbmcgYmV0d2VlbiBBQUMgc2FtcGxlcyBkZXRlY3RlZCwgZHJvcCBmcmFtZWApO1xuICAgICAgICAgICAgICB0cmFjay5sZW4gLT0gdW5pdC5ieXRlTGVuZ3RoO1xuICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIHNldCBEVFMgdG8gbmV4dCBEVFNcbiAgICAgICAgICAgIHB0c25vcm0gPSBkdHNub3JtID0gbmV4dEFhY1B0cztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gcmVtZW1iZXIgZmlyc3QgUFRTIG9mIG91ciBhYWNTYW1wbGVzLCBlbnN1cmUgdmFsdWUgaXMgcG9zaXRpdmVcbiAgICAgICAgZmlyc3RQVFMgPSBNYXRoLm1heCgwLCBwdHNub3JtKTtcbiAgICAgICAgZmlyc3REVFMgPSBNYXRoLm1heCgwLCBkdHNub3JtKTtcbiAgICAgICAgLyogY29uY2F0ZW5hdGUgdGhlIGF1ZGlvIGRhdGEgYW5kIGNvbnN0cnVjdCB0aGUgbWRhdCBpbiBwbGFjZVxuICAgICAgICAgIChuZWVkIDggbW9yZSBieXRlcyB0byBmaWxsIGxlbmd0aCBhbmQgbWRhdCB0eXBlKSAqL1xuICAgICAgICBtZGF0ID0gbmV3IFVpbnQ4QXJyYXkodHJhY2subGVuICsgOCk7XG4gICAgICAgIHZpZXcgPSBuZXcgRGF0YVZpZXcobWRhdC5idWZmZXIpO1xuICAgICAgICB2aWV3LnNldFVpbnQzMigwLCBtZGF0LmJ5dGVMZW5ndGgpO1xuICAgICAgICBtZGF0LnNldChNUDQudHlwZXMubWRhdCwgNCk7XG4gICAgICB9XG4gICAgICBtZGF0LnNldCh1bml0LCBvZmZzZXQpO1xuICAgICAgb2Zmc2V0ICs9IHVuaXQuYnl0ZUxlbmd0aDtcbiAgICAgIC8vY29uc29sZS5sb2coJ1BUUy9EVFMvaW5pdERUUy9ub3JtUFRTL25vcm1EVFMvcmVsYXRpdmUgUFRTIDogJHthYWNTYW1wbGUucHRzfS8ke2FhY1NhbXBsZS5kdHN9LyR7dGhpcy5faW5pdERUU30vJHtwdHNub3JtfS8ke2R0c25vcm19LyR7KGFhY1NhbXBsZS5wdHMvNDI5NDk2NzI5NikudG9GaXhlZCgzKX0nKTtcbiAgICAgIG1wNFNhbXBsZSA9IHtcbiAgICAgICAgc2l6ZTogdW5pdC5ieXRlTGVuZ3RoLFxuICAgICAgICBjdHM6IDAsXG4gICAgICAgIGR1cmF0aW9uOjAsXG4gICAgICAgIGZsYWdzOiB7XG4gICAgICAgICAgaXNMZWFkaW5nOiAwLFxuICAgICAgICAgIGlzRGVwZW5kZWRPbjogMCxcbiAgICAgICAgICBoYXNSZWR1bmRhbmN5OiAwLFxuICAgICAgICAgIGRlZ3JhZFByaW86IDAsXG4gICAgICAgICAgZGVwZW5kc09uOiAxLFxuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgc2FtcGxlcy5wdXNoKG1wNFNhbXBsZSk7XG4gICAgICBsYXN0RFRTID0gZHRzbm9ybTtcbiAgICB9XG4gICAgdmFyIGxhc3RTYW1wbGVEdXJhdGlvbiA9IDA7XG4gICAgdmFyIG5iU2FtcGxlcyA9IHNhbXBsZXMubGVuZ3RoO1xuICAgIC8vc2V0IGxhc3Qgc2FtcGxlIGR1cmF0aW9uIGFzIGJlaW5nIGlkZW50aWNhbCB0byBwcmV2aW91cyBzYW1wbGVcbiAgICBpZiAobmJTYW1wbGVzID49IDIpIHtcbiAgICAgIGxhc3RTYW1wbGVEdXJhdGlvbiA9IHNhbXBsZXNbbmJTYW1wbGVzIC0gMl0uZHVyYXRpb247XG4gICAgICBtcDRTYW1wbGUuZHVyYXRpb24gPSBsYXN0U2FtcGxlRHVyYXRpb247XG4gICAgfVxuICAgIGlmIChuYlNhbXBsZXMpIHtcbiAgICAgIC8vIG5leHQgYWFjIHNhbXBsZSBQVFMgc2hvdWxkIGJlIGVxdWFsIHRvIGxhc3Qgc2FtcGxlIFBUUyArIGR1cmF0aW9uXG4gICAgICB0aGlzLm5leHRBYWNQdHMgPSBwdHNub3JtICsgcGVzMm1wNFNjYWxlRmFjdG9yICogbGFzdFNhbXBsZUR1cmF0aW9uO1xuICAgICAgLy9sb2dnZXIubG9nKCdBdWRpby9QVFMvUFRTZW5kOicgKyBhYWNTYW1wbGUucHRzLnRvRml4ZWQoMCkgKyAnLycgKyB0aGlzLm5leHRBYWNEdHMudG9GaXhlZCgwKSk7XG4gICAgICB0cmFjay5sZW4gPSAwO1xuICAgICAgdHJhY2suc2FtcGxlcyA9IHNhbXBsZXM7XG4gICAgICBtb29mID0gTVA0Lm1vb2YodHJhY2suc2VxdWVuY2VOdW1iZXIrKywgZmlyc3REVFMgLyBwZXMybXA0U2NhbGVGYWN0b3IsIHRyYWNrKTtcbiAgICAgIHRyYWNrLnNhbXBsZXMgPSBbXTtcbiAgICAgIHRoaXMub2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfREFUQSwge1xuICAgICAgICBtb29mOiBtb29mLFxuICAgICAgICBtZGF0OiBtZGF0LFxuICAgICAgICBzdGFydFBUUzogZmlyc3RQVFMgLyBwZXNUaW1lU2NhbGUsXG4gICAgICAgIGVuZFBUUzogdGhpcy5uZXh0QWFjUHRzIC8gcGVzVGltZVNjYWxlLFxuICAgICAgICBzdGFydERUUzogZmlyc3REVFMgLyBwZXNUaW1lU2NhbGUsXG4gICAgICAgIGVuZERUUzogKGR0c25vcm0gKyBwZXMybXA0U2NhbGVGYWN0b3IgKiBsYXN0U2FtcGxlRHVyYXRpb24pIC8gcGVzVGltZVNjYWxlLFxuICAgICAgICB0eXBlOiAnYXVkaW8nLFxuICAgICAgICBuYjogbmJTYW1wbGVzXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICByZW11eElEMyh0cmFjayx0aW1lT2Zmc2V0KSB7XG4gICAgdmFyIGxlbmd0aCA9IHRyYWNrLnNhbXBsZXMubGVuZ3RoLCBzYW1wbGU7XG4gICAgLy8gY29uc3VtZSBzYW1wbGVzXG4gICAgaWYobGVuZ3RoKSB7XG4gICAgICBmb3IodmFyIGluZGV4ID0gMDsgaW5kZXggPCBsZW5ndGg7IGluZGV4KyspIHtcbiAgICAgICAgc2FtcGxlID0gdHJhY2suc2FtcGxlc1tpbmRleF07XG4gICAgICAgIC8vIHNldHRpbmcgaWQzIHB0cywgZHRzIHRvIHJlbGF0aXZlIHRpbWVcbiAgICAgICAgLy8gdXNpbmcgdGhpcy5faW5pdFBUUyBhbmQgdGhpcy5faW5pdERUUyB0byBjYWxjdWxhdGUgcmVsYXRpdmUgdGltZVxuICAgICAgICBzYW1wbGUucHRzID0gKChzYW1wbGUucHRzIC0gdGhpcy5faW5pdFBUUykgLyB0aGlzLlBFU19USU1FU0NBTEUpO1xuICAgICAgICBzYW1wbGUuZHRzID0gKChzYW1wbGUuZHRzIC0gdGhpcy5faW5pdERUUykgLyB0aGlzLlBFU19USU1FU0NBTEUpO1xuICAgICAgfVxuICAgICAgdGhpcy5vYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19NRVRBREFUQSwge1xuICAgICAgICBzYW1wbGVzOnRyYWNrLnNhbXBsZXNcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHRyYWNrLnNhbXBsZXMgPSBbXTtcbiAgICB0aW1lT2Zmc2V0ID0gdGltZU9mZnNldDtcbiAgfVxuXG4gIHJlbXV4VGV4dCh0cmFjayx0aW1lT2Zmc2V0KSB7XG4gICAgdHJhY2suc2FtcGxlcy5zb3J0KGZ1bmN0aW9uKGEsIGIpIHtcbiAgICAgIGlmIChhLnB0cyA8IGIucHRzKVxuICAgICAge1xuICAgICAgICByZXR1cm4gLTE7XG4gICAgICB9XG4gICAgICBlbHNlIGlmIChhLnB0cyA+IGIucHRzKVxuICAgICAge1xuICAgICAgICByZXR1cm4gMTtcbiAgICAgIH1cbiAgICAgIGVsc2VcbiAgICAgIHtcbiAgICAgICAgcmV0dXJuIDA7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICB2YXIgbGVuZ3RoID0gdHJhY2suc2FtcGxlcy5sZW5ndGgsIHNhbXBsZTtcbiAgICAvLyBjb25zdW1lIHNhbXBsZXNcbiAgICBpZihsZW5ndGgpIHtcbiAgICAgIGZvcih2YXIgaW5kZXggPSAwOyBpbmRleCA8IGxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICBzYW1wbGUgPSB0cmFjay5zYW1wbGVzW2luZGV4XTtcbiAgICAgICAgLy8gc2V0dGluZyB0ZXh0IHB0cywgZHRzIHRvIHJlbGF0aXZlIHRpbWVcbiAgICAgICAgLy8gdXNpbmcgdGhpcy5faW5pdFBUUyBhbmQgdGhpcy5faW5pdERUUyB0byBjYWxjdWxhdGUgcmVsYXRpdmUgdGltZVxuICAgICAgICBzYW1wbGUucHRzID0gKChzYW1wbGUucHRzIC0gdGhpcy5faW5pdFBUUykgLyB0aGlzLlBFU19USU1FU0NBTEUpO1xuICAgICAgfVxuICAgICAgdGhpcy5vYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19VU0VSREFUQSwge1xuICAgICAgICBzYW1wbGVzOnRyYWNrLnNhbXBsZXNcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHRyYWNrLnNhbXBsZXMgPSBbXTtcbiAgICB0aW1lT2Zmc2V0ID0gdGltZU9mZnNldDtcbiAgfVxuICBcbiAgX1BUU05vcm1hbGl6ZSh2YWx1ZSwgcmVmZXJlbmNlKSB7XG4gICAgdmFyIG9mZnNldDtcbiAgICBpZiAocmVmZXJlbmNlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG4gICAgaWYgKHJlZmVyZW5jZSA8IHZhbHVlKSB7XG4gICAgICAvLyAtIDJeMzNcbiAgICAgIG9mZnNldCA9IC04NTg5OTM0NTkyO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyArIDJeMzNcbiAgICAgIG9mZnNldCA9IDg1ODk5MzQ1OTI7XG4gICAgfVxuICAgIC8qIFBUUyBpcyAzM2JpdCAoZnJvbSAwIHRvIDJeMzMgLTEpXG4gICAgICBpZiBkaWZmIGJldHdlZW4gdmFsdWUgYW5kIHJlZmVyZW5jZSBpcyBiaWdnZXIgdGhhbiBoYWxmIG9mIHRoZSBhbXBsaXR1ZGUgKDJeMzIpIHRoZW4gaXQgbWVhbnMgdGhhdFxuICAgICAgUFRTIGxvb3Bpbmcgb2NjdXJlZC4gZmlsbCB0aGUgZ2FwICovXG4gICAgd2hpbGUgKE1hdGguYWJzKHZhbHVlIC0gcmVmZXJlbmNlKSA+IDQyOTQ5NjcyOTYpIHtcbiAgICAgICAgdmFsdWUgKz0gb2Zmc2V0O1xuICAgIH1cbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBNUDRSZW11eGVyO1xuIiwiXG4vLyBhZGFwdGVkIGZyb20gaHR0cHM6Ly9naXRodWIuY29tL2thbm9uZ2lsL25vZGUtbTN1OHBhcnNlL2Jsb2IvbWFzdGVyL2F0dHJsaXN0LmpzXG5jbGFzcyBBdHRyTGlzdCB7XG5cbiAgY29uc3RydWN0b3IoYXR0cnMpIHtcbiAgICBpZiAodHlwZW9mIGF0dHJzID09PSAnc3RyaW5nJykge1xuICAgICAgYXR0cnMgPSBBdHRyTGlzdC5wYXJzZUF0dHJMaXN0KGF0dHJzKTtcbiAgICB9XG4gICAgZm9yKHZhciBhdHRyIGluIGF0dHJzKXtcbiAgICAgIGlmKGF0dHJzLmhhc093blByb3BlcnR5KGF0dHIpKSB7XG4gICAgICAgIHRoaXNbYXR0cl0gPSBhdHRyc1thdHRyXTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBkZWNpbWFsSW50ZWdlcihhdHRyTmFtZSkge1xuICAgIGNvbnN0IGludFZhbHVlID0gcGFyc2VJbnQodGhpc1thdHRyTmFtZV0sIDEwKTtcbiAgICBpZiAoaW50VmFsdWUgPiBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUikge1xuICAgICAgcmV0dXJuIEluZmluaXR5O1xuICAgIH1cbiAgICByZXR1cm4gaW50VmFsdWU7XG4gIH1cblxuICBoZXhhZGVjaW1hbEludGVnZXIoYXR0ck5hbWUpIHtcbiAgICBpZih0aGlzW2F0dHJOYW1lXSkge1xuICAgICAgbGV0IHN0cmluZ1ZhbHVlID0gKHRoaXNbYXR0ck5hbWVdIHx8ICcweCcpLnNsaWNlKDIpO1xuICAgICAgc3RyaW5nVmFsdWUgPSAoKHN0cmluZ1ZhbHVlLmxlbmd0aCAmIDEpID8gJzAnIDogJycpICsgc3RyaW5nVmFsdWU7XG5cbiAgICAgIGNvbnN0IHZhbHVlID0gbmV3IFVpbnQ4QXJyYXkoc3RyaW5nVmFsdWUubGVuZ3RoIC8gMik7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0cmluZ1ZhbHVlLmxlbmd0aCAvIDI7IGkrKykge1xuICAgICAgICB2YWx1ZVtpXSA9IHBhcnNlSW50KHN0cmluZ1ZhbHVlLnNsaWNlKGkgKiAyLCBpICogMiArIDIpLCAxNik7XG4gICAgICB9XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGhleGFkZWNpbWFsSW50ZWdlckFzTnVtYmVyKGF0dHJOYW1lKSB7XG4gICAgY29uc3QgaW50VmFsdWUgPSBwYXJzZUludCh0aGlzW2F0dHJOYW1lXSwgMTYpO1xuICAgIGlmIChpbnRWYWx1ZSA+IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSKSB7XG4gICAgICByZXR1cm4gSW5maW5pdHk7XG4gICAgfVxuICAgIHJldHVybiBpbnRWYWx1ZTtcbiAgfVxuXG4gIGRlY2ltYWxGbG9hdGluZ1BvaW50KGF0dHJOYW1lKSB7XG4gICAgcmV0dXJuIHBhcnNlRmxvYXQodGhpc1thdHRyTmFtZV0pO1xuICB9XG5cbiAgZW51bWVyYXRlZFN0cmluZyhhdHRyTmFtZSkge1xuICAgIHJldHVybiB0aGlzW2F0dHJOYW1lXTtcbiAgfVxuXG4gIGRlY2ltYWxSZXNvbHV0aW9uKGF0dHJOYW1lKSB7XG4gICAgY29uc3QgcmVzID0gL14oXFxkKyl4KFxcZCspJC8uZXhlYyh0aGlzW2F0dHJOYW1lXSk7XG4gICAgaWYgKHJlcyA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIHdpZHRoOiBwYXJzZUludChyZXNbMV0sIDEwKSxcbiAgICAgIGhlaWdodDogcGFyc2VJbnQocmVzWzJdLCAxMClcbiAgICB9O1xuICB9XG5cbiAgc3RhdGljIHBhcnNlQXR0ckxpc3QoaW5wdXQpIHtcbiAgICBjb25zdCByZSA9IC9cXHMqKC4rPylcXHMqPSgoPzpcXFwiLio/XFxcIil8Lio/KSg/Oix8JCkvZztcbiAgICB2YXIgbWF0Y2gsIGF0dHJzID0ge307XG4gICAgd2hpbGUgKChtYXRjaCA9IHJlLmV4ZWMoaW5wdXQpKSAhPT0gbnVsbCkge1xuICAgICAgdmFyIHZhbHVlID0gbWF0Y2hbMl0sIHF1b3RlID0gJ1wiJztcblxuICAgICAgaWYgKHZhbHVlLmluZGV4T2YocXVvdGUpID09PSAwICYmXG4gICAgICAgICAgdmFsdWUubGFzdEluZGV4T2YocXVvdGUpID09PSAodmFsdWUubGVuZ3RoLTEpKSB7XG4gICAgICAgIHZhbHVlID0gdmFsdWUuc2xpY2UoMSwgLTEpO1xuICAgICAgfVxuICAgICAgYXR0cnNbbWF0Y2hbMV1dID0gdmFsdWU7XG4gICAgfVxuICAgIHJldHVybiBhdHRycztcbiAgfVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IEF0dHJMaXN0O1xuIiwidmFyIEJpbmFyeVNlYXJjaCA9IHtcbiAgICAvKipcbiAgICAgKiBTZWFyY2hlcyBmb3IgYW4gaXRlbSBpbiBhbiBhcnJheSB3aGljaCBtYXRjaGVzIGEgY2VydGFpbiBjb25kaXRpb24uXG4gICAgICogVGhpcyByZXF1aXJlcyB0aGUgY29uZGl0aW9uIHRvIG9ubHkgbWF0Y2ggb25lIGl0ZW0gaW4gdGhlIGFycmF5LFxuICAgICAqIGFuZCBmb3IgdGhlIGFycmF5IHRvIGJlIG9yZGVyZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBsaXN0IFRoZSBhcnJheSB0byBzZWFyY2guXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gY29tcGFyaXNvbkZ1bmN0aW9uXG4gICAgICogICAgICBDYWxsZWQgYW5kIHByb3ZpZGVkIGEgY2FuZGlkYXRlIGl0ZW0gYXMgdGhlIGZpcnN0IGFyZ3VtZW50LlxuICAgICAqICAgICAgU2hvdWxkIHJldHVybjpcbiAgICAgKiAgICAgICAgICA+IC0xIGlmIHRoZSBpdGVtIHNob3VsZCBiZSBsb2NhdGVkIGF0IGEgbG93ZXIgaW5kZXggdGhhbiB0aGUgcHJvdmlkZWQgaXRlbS5cbiAgICAgKiAgICAgICAgICA+IDEgaWYgdGhlIGl0ZW0gc2hvdWxkIGJlIGxvY2F0ZWQgYXQgYSBoaWdoZXIgaW5kZXggdGhhbiB0aGUgcHJvdmlkZWQgaXRlbS5cbiAgICAgKiAgICAgICAgICA+IDAgaWYgdGhlIGl0ZW0gaXMgdGhlIGl0ZW0geW91J3JlIGxvb2tpbmcgZm9yLlxuICAgICAqXG4gICAgICogQHJldHVybiB7Kn0gVGhlIG9iamVjdCBpZiBpdCBpcyBmb3VuZCBvciBudWxsIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBzZWFyY2g6IGZ1bmN0aW9uKGxpc3QsIGNvbXBhcmlzb25GdW5jdGlvbikge1xuICAgICAgICB2YXIgbWluSW5kZXggPSAwO1xuICAgICAgICB2YXIgbWF4SW5kZXggPSBsaXN0Lmxlbmd0aCAtIDE7XG4gICAgICAgIHZhciBjdXJyZW50SW5kZXggPSBudWxsO1xuICAgICAgICB2YXIgY3VycmVudEVsZW1lbnQgPSBudWxsO1xuICAgICBcbiAgICAgICAgd2hpbGUgKG1pbkluZGV4IDw9IG1heEluZGV4KSB7XG4gICAgICAgICAgICBjdXJyZW50SW5kZXggPSAobWluSW5kZXggKyBtYXhJbmRleCkgLyAyIHwgMDtcbiAgICAgICAgICAgIGN1cnJlbnRFbGVtZW50ID0gbGlzdFtjdXJyZW50SW5kZXhdO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB2YXIgY29tcGFyaXNvblJlc3VsdCA9IGNvbXBhcmlzb25GdW5jdGlvbihjdXJyZW50RWxlbWVudCk7XG4gICAgICAgICAgICBpZiAoY29tcGFyaXNvblJlc3VsdCA+IDApIHtcbiAgICAgICAgICAgICAgICBtaW5JbmRleCA9IGN1cnJlbnRJbmRleCArIDE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChjb21wYXJpc29uUmVzdWx0IDwgMCkge1xuICAgICAgICAgICAgICAgIG1heEluZGV4ID0gY3VycmVudEluZGV4IC0gMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBjdXJyZW50RWxlbWVudDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICBcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBCaW5hcnlTZWFyY2g7XG4iLCIvKlxuICogQ0VBLTcwOCBpbnRlcnByZXRlclxuKi9cblxuY2xhc3MgQ0VBNzA4SW50ZXJwcmV0ZXIge1xuXG4gIGNvbnN0cnVjdG9yKG1lZGlhKSB7XG4gICAgdGhpcy5tZWRpYSA9IG1lZGlhO1xuICAgIHRoaXMuZGlzcGxheSA9IFtdO1xuICAgIHRoaXMubWVtb3J5ID0gW107XG4gICAgdGhpcy5fY3JlYXRlQ3VlKCk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICB9XG5cbiAgX2NyZWF0ZUN1ZSgpXG4gIHtcbiAgICB0aGlzLmN1ZSA9IG5ldyBWVFRDdWUoLTEsIC0xLCBcIlwiKTtcbiAgICB0aGlzLmN1ZS50ZXh0ID0gXCJcIjtcbiAgICB0aGlzLmN1ZS5wYXVzZU9uRXhpdCA9IGZhbHNlO1xuXG4gICAgLy8gbWFrZSBzdXJlIGl0IGRvZXNuJ3Qgc2hvdyB1cCBiZWZvcmUgaXQncyByZWFkeVxuICAgIHRoaXMuc3RhcnRUaW1lID0gTnVtYmVyLk1BWF9WQUxVRTtcblxuICAgIC8vIHNob3cgaXQgJ2ZvcmV2ZXInIG9uY2Ugd2UgZG8gc2hvdyBpdFxuICAgIC8vICh3ZSdsbCBzZXQgdGhlIGVuZCB0aW1lIG9uY2Ugd2Uga25vdyBpdCBsYXRlcilcbiAgICB0aGlzLmN1ZS5lbmRUaW1lID0gTnVtYmVyLk1BWF9WQUxVRTtcblxuICAgIHRoaXMubWVtb3J5LnB1c2godGhpcy5jdWUpO1xuICB9XG5cbiAgY2xlYXIoKVxuICB7XG4gICAgaWYgKHRoaXMuX3RleHRUcmFjayAmJiB0aGlzLl90ZXh0VHJhY2suY3VlcylcbiAgICB7XG4gICAgICB3aGlsZSAodGhpcy5fdGV4dFRyYWNrLmN1ZXMubGVuZ3RoID4gMClcbiAgICAgIHtcbiAgICAgICAgdGhpcy5fdGV4dFRyYWNrLnJlbW92ZUN1ZSh0aGlzLl90ZXh0VHJhY2suY3Vlc1swXSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHVzaCh0aW1lc3RhbXAsIGJ5dGVzKVxuICB7XG4gICAgdmFyIGNvdW50ID0gYnl0ZXNbMF0gJiAzMTtcbiAgICB2YXIgcG9zaXRpb24gPSAyO1xuICAgIHZhciBieXRlLCBjY2J5dGUxLCBjY2J5dGUyLCBjY2RhdGExLCBjY2RhdGEyLCBjY1ZhbGlkLCBjY1R5cGU7XG5cbiAgICBmb3IgKHZhciBqPTA7IGo8Y291bnQ7IGorKylcbiAgICB7XG4gICAgICBieXRlID0gYnl0ZXNbcG9zaXRpb24rK107XG4gICAgICBjY2J5dGUxID0gMHg3RiAmIGJ5dGVzW3Bvc2l0aW9uKytdO1xuICAgICAgY2NieXRlMiA9IDB4N0YgJiBieXRlc1twb3NpdGlvbisrXTtcbiAgICAgIGNjVmFsaWQgPSAhKCg0ICYgYnl0ZSkgPT0gMCk7XG4gICAgICBjY1R5cGUgPSAoMyAmIGJ5dGUpO1xuXG4gICAgICBpZiAoY2NieXRlMSA9PT0gMCAmJiBjY2J5dGUyID09PSAwKVxuICAgICAge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKGNjVmFsaWQpXG4gICAgICB7XG4gICAgICAgIGlmIChjY1R5cGUgPT09IDApIC8vIHx8IGNjVHlwZSA9PT0gMVxuICAgICAgICB7XG4gICAgICAgICAgLy8gU3RhbmRhcmQgQ2hhcmFjdGVyc1xuICAgICAgICAgIGlmICgweDIwICYgY2NieXRlMSB8fCAweDQwICYgY2NieXRlMSlcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9IHRoaXMuX2Zyb21DaGFyQ29kZShjY2J5dGUxKSArIHRoaXMuX2Zyb21DaGFyQ29kZShjY2J5dGUyKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKHRoaXMuY3VlLnRleHQpO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBTcGVjaWFsIENoYXJhY3RlcnNcbiAgICAgICAgICBlbHNlIGlmICgoY2NieXRlMSA9PT0gMHgxMSB8fCBjY2J5dGUxID09PSAweDE5KSAmJiBjY2J5dGUyID49IDB4MzAgJiYgY2NieXRlMiA8PSAweDNGKVxuICAgICAgICAgIHtcbiAgICAgICAgICAgIC8vIGV4dGVuZGVkIGNoYXJzLCBlLmcuIG11c2ljYWwgbm90ZSwgYWNjZW50c1xuICAgICAgICAgICAgc3dpdGNoIChjY2J5dGUyKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBjYXNlIDQ4OlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gXCLCrlwiO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDQ5OlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gXCLCsFwiO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDUwOlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gXCLCvVwiO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDUxOlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gXCLCv1wiO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDUyOlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gXCLihKJcIjtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA1MzpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9IFwiwqJcIjtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA1NDpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9IFwiXCI7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNTU6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSBcIsKjXCI7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNTY6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSBcIuKZqlwiO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDU3OlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gXCIgXCI7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNTg6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSBcIsOoXCI7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNTk6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSBcIsOiXCI7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNjA6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSBcIsOqXCI7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNjE6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSBcIsOuXCI7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNjI6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSBcIsO0XCI7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNjM6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSBcIsO7XCI7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICgoY2NieXRlMSA9PT0gMHgxMSB8fCBjY2J5dGUxID09PSAweDE5KSAmJiBjY2J5dGUyID49IDB4MjAgJiYgY2NieXRlMiA8PSAweDJGKVxuICAgICAgICAgIHtcbiAgICAgICAgICAgIC8vIE1pZC1yb3cgY29kZXM6IGNvbG9yL3VuZGVybGluZVxuICAgICAgICAgICAgc3dpdGNoIChjY2J5dGUyKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBjYXNlIDB4MjA6XG4gICAgICAgICAgICAgICAgLy8gV2hpdGVcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDIxOlxuICAgICAgICAgICAgICAgIC8vIFdoaXRlIFVuZGVybGluZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjI6XG4gICAgICAgICAgICAgICAgLy8gR3JlZW5cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDIzOlxuICAgICAgICAgICAgICAgIC8vIEdyZWVuIFVuZGVybGluZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjQ6XG4gICAgICAgICAgICAgICAgLy8gQmx1ZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjU6XG4gICAgICAgICAgICAgICAgLy8gQmx1ZSBVbmRlcmxpbmVcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDI2OlxuICAgICAgICAgICAgICAgIC8vIEN5YW5cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDI3OlxuICAgICAgICAgICAgICAgIC8vIEN5YW4gVW5kZXJsaW5lXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyODpcbiAgICAgICAgICAgICAgICAvLyBSZWRcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDI5OlxuICAgICAgICAgICAgICAgIC8vIFJlZCBVbmRlcmxpbmVcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDJBOlxuICAgICAgICAgICAgICAgIC8vIFllbGxvd1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkI6XG4gICAgICAgICAgICAgICAgLy8gWWVsbG93IFVuZGVybGluZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkM6XG4gICAgICAgICAgICAgICAgLy8gTWFnZW50YVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkQ6XG4gICAgICAgICAgICAgICAgLy8gTWFnZW50YSBVbmRlcmxpbmVcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDJFOlxuICAgICAgICAgICAgICAgIC8vIEl0YWxpY3NcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDJGOlxuICAgICAgICAgICAgICAgIC8vIEl0YWxpY3MgVW5kZXJsaW5lXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSAgICAgICAgICBcbiAgICAgICAgICBpZiAoKGNjYnl0ZTEgPT09IDB4MTQgfHwgY2NieXRlMSA9PT0gMHgxQykgJiYgY2NieXRlMiA+PSAweDIwICYmIGNjYnl0ZTIgPD0gMHgyRilcbiAgICAgICAgICB7XG4gICAgICAgICAgICAvLyBNaWQtcm93IGNvZGVzOiBjb2xvci91bmRlcmxpbmVcbiAgICAgICAgICAgIHN3aXRjaCAoY2NieXRlMilcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgY2FzZSAweDIwOlxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiLVJDTC1cIik7XG4gICAgICAgICAgICAgICAgLy8gVE9ETzogc2hvdWxkbid0IGFmZmVjdCByb2xsLXVwcy4uLlxuICAgICAgICAgICAgICAgIHRoaXMuX2NsZWFyQWN0aXZlQ3Vlcyh0aW1lc3RhbXApO1xuICAgICAgICAgICAgICAgIC8vIFJDTDogUmVzdW1lIENhcHRpb24gTG9hZGluZ1xuICAgICAgICAgICAgICAgIC8vIGJlZ2luIHBvcCBvblxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjE6XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCItQlMtXCIpO1xuICAgICAgICAgICAgICAgIC8vIEJTOiBCYWNrc3BhY2VcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ID0gdGhpcy5jdWUudGV4dC5zdWJzdHIoMCwgdGhpcy5jdWUudGV4dC5sZW5ndGgtMSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyMjpcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIi1BT0YtXCIpO1xuICAgICAgICAgICAgICAgIC8vIEFPRjogcmVzZXJ2ZWQgKGZvcm1lcmx5IGFsYXJtIG9mZilcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDIzOlxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiLUFPTi1cIik7XG4gICAgICAgICAgICAgICAgLy8gQU9OOiByZXNlcnZlZCAoZm9ybWVybHkgYWxhcm0gb24pXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyNDpcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIi1ERVItXCIpO1xuICAgICAgICAgICAgICAgIC8vIERFUjogRGVsZXRlIHRvIGVuZCBvZiByb3dcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDI1OlxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiLVJVMi1cIik7XG4gICAgICAgICAgICAgICAgLy8gUlUyOiByb2xsLXVwIDIgcm93c1xuICAgICAgICAgICAgICAgIHRoaXMuX3JvbGx1cCgyKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDI2OlxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiLVJVMy1cIik7XG4gICAgICAgICAgICAgICAgLy8gUlUzOiByb2xsLXVwIDMgcm93c1xuICAgICAgICAgICAgICAgIHRoaXMuX3JvbGx1cCgzKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDI3OlxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiLVJVNC1cIik7XG4gICAgICAgICAgICAgICAgLy8gUlU0OiByb2xsLXVwIDQgcm93c1xuICAgICAgICAgICAgICAgIHRoaXMuX3JvbGx1cCg0KTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDI4OlxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiLUZPTi1cIik7XG4gICAgICAgICAgICAgICAgLy8gRk9OOiBGbGFzaCBvblxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4Mjk6XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCItUkRDLVwiKTtcbiAgICAgICAgICAgICAgICAvLyBSREM6IFJlc3VtZSBkaXJlY3QgY2FwdGlvbmluZ1xuICAgICAgICAgICAgICAgIHRoaXMuX2NsZWFyQWN0aXZlQ3Vlcyh0aW1lc3RhbXApO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkE6XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCItVFItXCIpO1xuICAgICAgICAgICAgICAgIC8vIFRSOiBUZXh0IFJlc3RhcnRcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDJCOlxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiLVJURC1cIik7XG4gICAgICAgICAgICAgICAgLy8gUlREOiBSZXN1bWUgVGV4dCBEaXNwbGF5XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyQzpcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIi1FRE0tXCIpO1xuICAgICAgICAgICAgICAgIC8vIEVETTogRXJhc2UgRGlzcGxheWVkIE1lbW9yeVxuICAgICAgICAgICAgICAgIHRoaXMuX2NsZWFyQWN0aXZlQ3Vlcyh0aW1lc3RhbXApO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkQ6XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCItQ1ItXCIpO1xuICAgICAgICAgICAgICAgIC8vIENSOiBDYXJyaWFnZSBSZXR1cm5cbiAgICAgICAgICAgICAgICAvLyBvbmx5IGFmZmVjdHMgcm9sbC11cFxuICAgICAgICAgICAgICAgIHRoaXMuX3JvbGx1cCgxKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDJFOlxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiLUVOTS1cIik7XG4gICAgICAgICAgICAgICAgLy8gRU5NOiBFcmFzZSBub24tZGlzcGxheWVkIG1lbW9yeVxuICAgICAgICAgICAgICAgIHRoaXMuX3RleHQgPSBcIlwiO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkY6XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCItRU9DLTogXCIgKyB0aW1lc3RhbXApO1xuICAgICAgICAgICAgICAgIHRoaXMuX2ZsaXBNZW1vcnkodGltZXN0YW1wKTtcbiAgICAgICAgICAgICAgICAvLyBFT0M6IEVuZCBvZiBjYXB0aW9uXG4gICAgICAgICAgICAgICAgLy8gaGlkZSBhbnkgZGlzcGxheWVkIGNhcHRpb25zIGFuZCBzaG93IGFueSBoaWRkZW4gb25lXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSAgIFxuICAgICAgICAgIGlmICgoY2NieXRlMSA9PT0gMHgxNyB8fCBjY2J5dGUxID09PSAweDFGKSAmJiBjY2J5dGUyID49IDB4MjEgJiYgY2NieXRlMiA8PSAweDIzKVxuICAgICAgICAgIHtcbiAgICAgICAgICAgIC8vIE1pZC1yb3cgY29kZXM6IGNvbG9yL3VuZGVybGluZVxuICAgICAgICAgICAgc3dpdGNoIChjY2J5dGUyKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBjYXNlIDB4MjE6XG4gICAgICAgICAgICAgICAgLy8gVE8xOiB0YWIgb2Zmc2V0IDEgY29sdW1uXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyMjpcbiAgICAgICAgICAgICAgICAvLyBUTzE6IHRhYiBvZmZzZXQgMiBjb2x1bW5cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDIzOlxuICAgICAgICAgICAgICAgIC8vIFRPMTogdGFiIG9mZnNldCAzIGNvbHVtblxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIC8vIFByb2JhYmx5IGEgcHJlLWFtYmxlIGFkZHJlc3MgY29kZVxuICAgICAgICAgIH0gICAgICAgIFxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSAgXG4gIH1cblxuICBfZnJvbUNoYXJDb2RlKGJ5dGUpXG4gIHtcbiAgICBpZiAoYnl0ZSA9PT0gNDIpXG4gICAge1xuICAgICAgcmV0dXJuICfDoSc7XG4gICAgfVxuICAgIGVsc2UgaWYgKGJ5dGUgPT09IDkyKVxuICAgIHtcbiAgICAgIHJldHVybiAnw6knO1xuICAgIH1cbiAgICBlbHNlIGlmIChieXRlID09PSA5NClcbiAgICB7XG4gICAgICByZXR1cm4gJ8OtJztcbiAgICB9XG4gICAgZWxzZSBpZiAoYnl0ZSA9PT0gOTUpXG4gICAge1xuICAgICAgcmV0dXJuICfDsyc7XG4gICAgfVxuICAgIGVsc2UgaWYgKGJ5dGUgPT09IDk2KVxuICAgIHtcbiAgICAgIHJldHVybiAnw7onO1xuICAgIH1cbiAgICBlbHNlIGlmIChieXRlID09PSAxMjMpXG4gICAge1xuICAgICAgcmV0dXJuICfDpyc7XG4gICAgfVxuICAgIGVsc2UgaWYgKGJ5dGUgPT09IDEyNClcbiAgICB7XG4gICAgICByZXR1cm4gJ8O3JztcbiAgICB9XG4gICAgZWxzZSBpZiAoYnl0ZSA9PT0gMTI1KVxuICAgIHtcbiAgICAgIHJldHVybiAnw5EnO1xuICAgIH1cbiAgICBlbHNlIGlmIChieXRlID09PSAxMjYpXG4gICAge1xuICAgICAgcmV0dXJuICfDsSc7XG4gICAgfVxuICAgIGVsc2UgaWYgKGJ5dGUgPT09IDEyNylcbiAgICB7XG4gICAgICByZXR1cm4gJ+KWiCc7XG4gICAgfVxuICAgIGVsc2VcbiAgICB7XG4gICAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZShieXRlKTtcbiAgICB9XG5cbiAgfVxuXG4gIF9mbGlwTWVtb3J5KHRpbWVzdGFtcClcbiAge1xuICAgIHRoaXMuX2NsZWFyQWN0aXZlQ3Vlcyh0aW1lc3RhbXApO1xuICAgIHRoaXMuX2ZsdXNoQ2FwdGlvbnModGltZXN0YW1wKTtcbiAgfVxuXG4gIF9mbHVzaENhcHRpb25zKHRpbWVzdGFtcClcbiAge1xuICAgIGlmICghdGhpcy5faGFzNzA4KVxuICAgIHtcbiAgICAgIHRoaXMuX3RleHRUcmFjayA9IHRoaXMubWVkaWEuYWRkVGV4dFRyYWNrKFwiY2FwdGlvbnNcIiwgXCJFbmdsaXNoXCIsIFwiZW5cIik7XG4gICAgICB0aGlzLl9oYXM3MDggPSB0cnVlO1xuICAgIH1cblxuICAgIGZvciAodmFyIGk9MDsgaTx0aGlzLm1lbW9yeS5sZW5ndGg7IGkrKylcbiAgICB7XG4gICAgICBjb25zb2xlLmVycm9yKHRoaXMubWVtb3J5W2ldLnRleHQpO1xuXG4gICAgICB0aGlzLm1lbW9yeVtpXS5zdGFydFRpbWUgPSB0aW1lc3RhbXA7XG4gICAgICB0aGlzLl90ZXh0VHJhY2suYWRkQ3VlKHRoaXMubWVtb3J5W2ldKTtcbiAgICAgIHRoaXMuZGlzcGxheS5wdXNoKHRoaXMubWVtb3J5W2ldKTtcbiAgICB9XG5cbiAgICB0aGlzLm1lbW9yeSA9IFtdO1xuXG4gICAgdGhpcy5fY3JlYXRlQ3VlKCk7XG4gIH1cblxuICBfY2xlYXJBY3RpdmVDdWVzKHRpbWVzdGFtcClcbiAge1xuICAgIGZvciAodmFyIGk9MDsgaTx0aGlzLmRpc3BsYXkubGVuZ3RoOyBpKyspXG4gICAge1xuICAgICAgdGhpcy5kaXNwbGF5W2ldLmVuZFRpbWUgPSB0aW1lc3RhbXA7XG4gICAgfVxuXG4gICAgdGhpcy5kaXNwbGF5ID0gW107XG4gIH1cblxuICBfcm9sbFVwKG4pXG4gIHtcbiAgICAvLyBUT0RPOiBpbXBsZW1lbnQgcm9sbC11cCBjYXB0aW9uc1xuICB9XG5cbiAgX2NsZWFyQnVmZmVyZWRDdWVzKClcbiAge1xuICAgIC8vcmVtb3ZlIHRoZW0gYWxsLi4uXG4gIH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBDRUE3MDhJbnRlcnByZXRlcjtcblxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBub29wKCkge31cblxuY29uc3QgZmFrZUxvZ2dlciA9IHtcbiAgdHJhY2U6IG5vb3AsXG4gIGRlYnVnOiBub29wLFxuICBsb2c6IG5vb3AsXG4gIHdhcm46IG5vb3AsXG4gIGluZm86IG5vb3AsXG4gIGVycm9yOiBub29wXG59O1xuXG5sZXQgZXhwb3J0ZWRMb2dnZXIgPSBmYWtlTG9nZ2VyO1xuXG4vL2xldCBsYXN0Q2FsbFRpbWU7XG4vLyBmdW5jdGlvbiBmb3JtYXRNc2dXaXRoVGltZUluZm8odHlwZSwgbXNnKSB7XG4vLyAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4vLyAgIGNvbnN0IGRpZmYgPSBsYXN0Q2FsbFRpbWUgPyAnKycgKyAobm93IC0gbGFzdENhbGxUaW1lKSA6ICcwJztcbi8vICAgbGFzdENhbGxUaW1lID0gbm93O1xuLy8gICBtc2cgPSAobmV3IERhdGUobm93KSkudG9JU09TdHJpbmcoKSArICcgfCBbJyArICB0eXBlICsgJ10gPiAnICsgbXNnICsgJyAoICcgKyBkaWZmICsgJyBtcyApJztcbi8vICAgcmV0dXJuIG1zZztcbi8vIH1cblxuZnVuY3Rpb24gZm9ybWF0TXNnKHR5cGUsIG1zZykge1xuICBtc2cgPSAnWycgKyAgdHlwZSArICddID4gJyArIG1zZztcbiAgcmV0dXJuIG1zZztcbn1cblxuZnVuY3Rpb24gY29uc29sZVByaW50Rm4odHlwZSkge1xuICBjb25zdCBmdW5jID0gd2luZG93LmNvbnNvbGVbdHlwZV07XG4gIGlmIChmdW5jKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKC4uLmFyZ3MpIHtcbiAgICAgIGlmKGFyZ3NbMF0pIHtcbiAgICAgICAgYXJnc1swXSA9IGZvcm1hdE1zZyh0eXBlLCBhcmdzWzBdKTtcbiAgICAgIH1cbiAgICAgIGZ1bmMuYXBwbHkod2luZG93LmNvbnNvbGUsIGFyZ3MpO1xuICAgIH07XG4gIH1cbiAgcmV0dXJuIG5vb3A7XG59XG5cbmZ1bmN0aW9uIGV4cG9ydExvZ2dlckZ1bmN0aW9ucyhkZWJ1Z0NvbmZpZywgLi4uZnVuY3Rpb25zKSB7XG4gIGZ1bmN0aW9ucy5mb3JFYWNoKGZ1bmN0aW9uKHR5cGUpIHtcbiAgICBleHBvcnRlZExvZ2dlclt0eXBlXSA9IGRlYnVnQ29uZmlnW3R5cGVdID8gZGVidWdDb25maWdbdHlwZV0uYmluZChkZWJ1Z0NvbmZpZykgOiBjb25zb2xlUHJpbnRGbih0eXBlKTtcbiAgfSk7XG59XG5cbmV4cG9ydCB2YXIgZW5hYmxlTG9ncyA9IGZ1bmN0aW9uKGRlYnVnQ29uZmlnKSB7XG4gIGlmIChkZWJ1Z0NvbmZpZyA9PT0gdHJ1ZSB8fCB0eXBlb2YgZGVidWdDb25maWcgPT09ICdvYmplY3QnKSB7XG4gICAgZXhwb3J0TG9nZ2VyRnVuY3Rpb25zKGRlYnVnQ29uZmlnLFxuICAgICAgLy8gUmVtb3ZlIG91dCBmcm9tIGxpc3QgaGVyZSB0byBoYXJkLWRpc2FibGUgYSBsb2ctbGV2ZWxcbiAgICAgIC8vJ3RyYWNlJyxcbiAgICAgICdkZWJ1ZycsXG4gICAgICAnbG9nJyxcbiAgICAgICdpbmZvJyxcbiAgICAgICd3YXJuJyxcbiAgICAgICdlcnJvcidcbiAgICApO1xuICAgIC8vIFNvbWUgYnJvd3NlcnMgZG9uJ3QgYWxsb3cgdG8gdXNlIGJpbmQgb24gY29uc29sZSBvYmplY3QgYW55d2F5XG4gICAgLy8gZmFsbGJhY2sgdG8gZGVmYXVsdCBpZiBuZWVkZWRcbiAgICB0cnkge1xuICAgICBleHBvcnRlZExvZ2dlci5sb2coKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBleHBvcnRlZExvZ2dlciA9IGZha2VMb2dnZXI7XG4gICAgfVxuICB9XG4gIGVsc2Uge1xuICAgIGV4cG9ydGVkTG9nZ2VyID0gZmFrZUxvZ2dlcjtcbiAgfVxufTtcblxuZXhwb3J0IHZhciBsb2dnZXIgPSBleHBvcnRlZExvZ2dlcjtcbiIsInZhciBVUkxIZWxwZXIgPSB7XG5cbiAgLy8gYnVpbGQgYW4gYWJzb2x1dGUgVVJMIGZyb20gYSByZWxhdGl2ZSBvbmUgdXNpbmcgdGhlIHByb3ZpZGVkIGJhc2VVUkxcbiAgLy8gaWYgcmVsYXRpdmVVUkwgaXMgYW4gYWJzb2x1dGUgVVJMIGl0IHdpbGwgYmUgcmV0dXJuZWQgYXMgaXMuXG4gIGJ1aWxkQWJzb2x1dGVVUkw6IGZ1bmN0aW9uKGJhc2VVUkwsIHJlbGF0aXZlVVJMKSB7XG4gICAgLy8gcmVtb3ZlIGFueSByZW1haW5pbmcgc3BhY2UgYW5kIENSTEZcbiAgICByZWxhdGl2ZVVSTCA9IHJlbGF0aXZlVVJMLnRyaW0oKTtcbiAgICBpZiAoL15bYS16XSs6L2kudGVzdChyZWxhdGl2ZVVSTCkpIHtcbiAgICAgIC8vIGNvbXBsZXRlIHVybCwgbm90IHJlbGF0aXZlXG4gICAgICByZXR1cm4gcmVsYXRpdmVVUkw7XG4gICAgfVxuXG4gICAgdmFyIHJlbGF0aXZlVVJMUXVlcnkgPSBudWxsO1xuICAgIHZhciByZWxhdGl2ZVVSTEhhc2ggPSBudWxsO1xuXG4gICAgdmFyIHJlbGF0aXZlVVJMSGFzaFNwbGl0ID0gL14oW14jXSopKC4qKSQvLmV4ZWMocmVsYXRpdmVVUkwpO1xuICAgIGlmIChyZWxhdGl2ZVVSTEhhc2hTcGxpdCkge1xuICAgICAgcmVsYXRpdmVVUkxIYXNoID0gcmVsYXRpdmVVUkxIYXNoU3BsaXRbMl07XG4gICAgICByZWxhdGl2ZVVSTCA9IHJlbGF0aXZlVVJMSGFzaFNwbGl0WzFdO1xuICAgIH1cbiAgICB2YXIgcmVsYXRpdmVVUkxRdWVyeVNwbGl0ID0gL14oW15cXD9dKikoLiopJC8uZXhlYyhyZWxhdGl2ZVVSTCk7XG4gICAgaWYgKHJlbGF0aXZlVVJMUXVlcnlTcGxpdCkge1xuICAgICAgcmVsYXRpdmVVUkxRdWVyeSA9IHJlbGF0aXZlVVJMUXVlcnlTcGxpdFsyXTtcbiAgICAgIHJlbGF0aXZlVVJMID0gcmVsYXRpdmVVUkxRdWVyeVNwbGl0WzFdO1xuICAgIH1cblxuICAgIHZhciBiYXNlVVJMSGFzaFNwbGl0ID0gL14oW14jXSopKC4qKSQvLmV4ZWMoYmFzZVVSTCk7XG4gICAgaWYgKGJhc2VVUkxIYXNoU3BsaXQpIHtcbiAgICAgIGJhc2VVUkwgPSBiYXNlVVJMSGFzaFNwbGl0WzFdO1xuICAgIH1cbiAgICB2YXIgYmFzZVVSTFF1ZXJ5U3BsaXQgPSAvXihbXlxcP10qKSguKikkLy5leGVjKGJhc2VVUkwpO1xuICAgIGlmIChiYXNlVVJMUXVlcnlTcGxpdCkge1xuICAgICAgYmFzZVVSTCA9IGJhc2VVUkxRdWVyeVNwbGl0WzFdO1xuICAgIH1cblxuICAgIHZhciBiYXNlVVJMRG9tYWluU3BsaXQgPSAvXigoKFthLXpdKyk6KT9cXC9cXC9bYS16MC05XFwuLV0rKDpbMC05XSspP1xcLykoLiopJC9pLmV4ZWMoYmFzZVVSTCk7XG4gICAgdmFyIGJhc2VVUkxQcm90b2NvbCA9IGJhc2VVUkxEb21haW5TcGxpdFszXTtcbiAgICB2YXIgYmFzZVVSTERvbWFpbiA9IGJhc2VVUkxEb21haW5TcGxpdFsxXTtcbiAgICB2YXIgYmFzZVVSTFBhdGggPSBiYXNlVVJMRG9tYWluU3BsaXRbNV07XG5cbiAgICB2YXIgYnVpbHRVUkwgPSBudWxsO1xuICAgIGlmICgvXlxcL1xcLy8udGVzdChyZWxhdGl2ZVVSTCkpIHtcbiAgICAgIGJ1aWx0VVJMID0gYmFzZVVSTFByb3RvY29sKyc6Ly8nK1VSTEhlbHBlci5idWlsZEFic29sdXRlUGF0aCgnJywgcmVsYXRpdmVVUkwuc3Vic3RyaW5nKDIpKTtcbiAgICB9XG4gICAgZWxzZSBpZiAoL15cXC8vLnRlc3QocmVsYXRpdmVVUkwpKSB7XG4gICAgICBidWlsdFVSTCA9IGJhc2VVUkxEb21haW4rVVJMSGVscGVyLmJ1aWxkQWJzb2x1dGVQYXRoKCcnLCByZWxhdGl2ZVVSTC5zdWJzdHJpbmcoMSkpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHZhciBuZXdQYXRoID0gVVJMSGVscGVyLmJ1aWxkQWJzb2x1dGVQYXRoKGJhc2VVUkxQYXRoLCByZWxhdGl2ZVVSTCk7XG4gICAgICBidWlsdFVSTCA9IGJhc2VVUkxEb21haW4gKyBuZXdQYXRoO1xuICAgIH1cblxuICAgIC8vIHB1dCB0aGUgcXVlcnkgYW5kIGhhc2ggcGFydHMgYmFja1xuICAgIGlmIChyZWxhdGl2ZVVSTFF1ZXJ5KSB7XG4gICAgICBidWlsdFVSTCArPSByZWxhdGl2ZVVSTFF1ZXJ5O1xuICAgIH1cbiAgICBpZiAocmVsYXRpdmVVUkxIYXNoKSB7XG4gICAgICBidWlsdFVSTCArPSByZWxhdGl2ZVVSTEhhc2g7XG4gICAgfVxuICAgIHJldHVybiBidWlsdFVSTDtcbiAgfSxcblxuICAvLyBidWlsZCBhbiBhYnNvbHV0ZSBwYXRoIHVzaW5nIHRoZSBwcm92aWRlZCBiYXNlUGF0aFxuICAvLyBhZGFwdGVkIGZyb20gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL2RvY3VtZW50L2Nvb2tpZSNVc2luZ19yZWxhdGl2ZV9VUkxzX2luX3RoZV9wYXRoX3BhcmFtZXRlclxuICAvLyB0aGlzIGRvZXMgbm90IGhhbmRsZSB0aGUgY2FzZSB3aGVyZSByZWxhdGl2ZVBhdGggaXMgXCIvXCIgb3IgXCIvL1wiLiBUaGVzZSBjYXNlcyBzaG91bGQgYmUgaGFuZGxlZCBvdXRzaWRlIHRoaXMuXG4gIGJ1aWxkQWJzb2x1dGVQYXRoOiBmdW5jdGlvbihiYXNlUGF0aCwgcmVsYXRpdmVQYXRoKSB7XG4gICAgdmFyIHNSZWxQYXRoID0gcmVsYXRpdmVQYXRoO1xuICAgIHZhciBuVXBMbiwgc0RpciA9ICcnLCBzUGF0aCA9IGJhc2VQYXRoLnJlcGxhY2UoL1teXFwvXSokLywgc1JlbFBhdGgucmVwbGFjZSgvKFxcL3xeKSg/OlxcLj9cXC8rKSsvZywgJyQxJykpO1xuICAgIGZvciAodmFyIG5FbmQsIG5TdGFydCA9IDA7IG5FbmQgPSBzUGF0aC5pbmRleE9mKCcvLi4vJywgblN0YXJ0KSwgbkVuZCA+IC0xOyBuU3RhcnQgPSBuRW5kICsgblVwTG4pIHtcbiAgICAgIG5VcExuID0gL15cXC8oPzpcXC5cXC5cXC8pKi8uZXhlYyhzUGF0aC5zbGljZShuRW5kKSlbMF0ubGVuZ3RoO1xuICAgICAgc0RpciA9IChzRGlyICsgc1BhdGguc3Vic3RyaW5nKG5TdGFydCwgbkVuZCkpLnJlcGxhY2UobmV3IFJlZ0V4cCgnKD86XFxcXFxcLytbXlxcXFxcXC9dKil7MCwnICsgKChuVXBMbiAtIDEpIC8gMykgKyAnfSQnKSwgJy8nKTtcbiAgICB9XG4gICAgcmV0dXJuIHNEaXIgKyBzUGF0aC5zdWJzdHIoblN0YXJ0KTtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBVUkxIZWxwZXI7XG4iLCIvKipcbiAqIFhIUiBiYXNlZCBsb2dnZXJcbiovXG5cbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG5jbGFzcyBYaHJMb2FkZXIge1xuXG4gIGNvbnN0cnVjdG9yKGNvbmZpZykge1xuICAgIGlmIChjb25maWcgJiYgY29uZmlnLnhoclNldHVwKSB7XG4gICAgICB0aGlzLnhoclNldHVwID0gY29uZmlnLnhoclNldHVwO1xuICAgIH1cbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5hYm9ydCgpO1xuICAgIHRoaXMubG9hZGVyID0gbnVsbDtcbiAgfVxuXG4gIGFib3J0KCkge1xuICAgIHZhciBsb2FkZXIgPSB0aGlzLmxvYWRlcixcbiAgICAgICAgdGltZW91dEhhbmRsZSA9IHRoaXMudGltZW91dEhhbmRsZTtcbiAgICBpZiAobG9hZGVyICYmIGxvYWRlci5yZWFkeVN0YXRlICE9PSA0KSB7XG4gICAgICB0aGlzLnN0YXRzLmFib3J0ZWQgPSB0cnVlO1xuICAgICAgbG9hZGVyLmFib3J0KCk7XG4gICAgfVxuICAgIGlmICh0aW1lb3V0SGFuZGxlKSB7XG4gICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRpbWVvdXRIYW5kbGUpO1xuICAgIH1cbiAgfVxuXG4gIGxvYWQodXJsLCByZXNwb25zZVR5cGUsIG9uU3VjY2Vzcywgb25FcnJvciwgb25UaW1lb3V0LCB0aW1lb3V0LCBtYXhSZXRyeSwgcmV0cnlEZWxheSwgb25Qcm9ncmVzcyA9IG51bGwsIGZyYWcgPSBudWxsKSB7XG4gICAgdGhpcy51cmwgPSB1cmw7XG4gICAgaWYgKGZyYWcgJiYgIWlzTmFOKGZyYWcuYnl0ZVJhbmdlU3RhcnRPZmZzZXQpICYmICFpc05hTihmcmFnLmJ5dGVSYW5nZUVuZE9mZnNldCkpIHtcbiAgICAgICAgdGhpcy5ieXRlUmFuZ2UgPSBmcmFnLmJ5dGVSYW5nZVN0YXJ0T2Zmc2V0ICsgJy0nICsgKGZyYWcuYnl0ZVJhbmdlRW5kT2Zmc2V0LTEpO1xuICAgIH1cbiAgICB0aGlzLnJlc3BvbnNlVHlwZSA9IHJlc3BvbnNlVHlwZTtcbiAgICB0aGlzLm9uU3VjY2VzcyA9IG9uU3VjY2VzcztcbiAgICB0aGlzLm9uUHJvZ3Jlc3MgPSBvblByb2dyZXNzO1xuICAgIHRoaXMub25UaW1lb3V0ID0gb25UaW1lb3V0O1xuICAgIHRoaXMub25FcnJvciA9IG9uRXJyb3I7XG4gICAgdGhpcy5zdGF0cyA9IHt0cmVxdWVzdDogcGVyZm9ybWFuY2Uubm93KCksIHJldHJ5OiAwfTtcbiAgICB0aGlzLnRpbWVvdXQgPSB0aW1lb3V0O1xuICAgIHRoaXMubWF4UmV0cnkgPSBtYXhSZXRyeTtcbiAgICB0aGlzLnJldHJ5RGVsYXkgPSByZXRyeURlbGF5O1xuICAgIHRoaXMudGltZW91dEhhbmRsZSA9IHdpbmRvdy5zZXRUaW1lb3V0KHRoaXMubG9hZHRpbWVvdXQuYmluZCh0aGlzKSwgdGltZW91dCk7XG4gICAgdGhpcy5sb2FkSW50ZXJuYWwoKTtcbiAgfVxuXG4gIGxvYWRJbnRlcm5hbCgpIHtcbiAgICB2YXIgeGhyO1xuICAgIFxuICAgIGlmICh0eXBlb2YgWERvbWFpblJlcXVlc3QgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgeGhyID0gdGhpcy5sb2FkZXIgPSBuZXcgWERvbWFpblJlcXVlc3QoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgIHhociA9IHRoaXMubG9hZGVyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgfVxuICAgIFxuICAgIHhoci5vbmxvYWRlbmQgPSB0aGlzLmxvYWRlbmQuYmluZCh0aGlzKTtcbiAgICB4aHIub25wcm9ncmVzcyA9IHRoaXMubG9hZHByb2dyZXNzLmJpbmQodGhpcyk7XG5cbiAgICB4aHIub3BlbignR0VUJywgdGhpcy51cmwsIHRydWUpO1xuICAgIGlmICh0aGlzLmJ5dGVSYW5nZSkge1xuICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoJ1JhbmdlJywgJ2J5dGVzPScgKyB0aGlzLmJ5dGVSYW5nZSk7XG4gICAgfVxuICAgIHhoci5yZXNwb25zZVR5cGUgPSB0aGlzLnJlc3BvbnNlVHlwZTtcbiAgICB0aGlzLnN0YXRzLnRmaXJzdCA9IG51bGw7XG4gICAgdGhpcy5zdGF0cy5sb2FkZWQgPSAwO1xuICAgIGlmICh0aGlzLnhoclNldHVwKSB7XG4gICAgICB0aGlzLnhoclNldHVwKHhociwgdGhpcy51cmwpO1xuICAgIH1cbiAgICB4aHIuc2VuZCgpO1xuICB9XG5cbiAgbG9hZGVuZChldmVudCkge1xuICAgIHZhciB4aHIgPSBldmVudC5jdXJyZW50VGFyZ2V0LFxuICAgICAgICBzdGF0dXMgPSB4aHIuc3RhdHVzLFxuICAgICAgICBzdGF0cyA9IHRoaXMuc3RhdHM7XG4gICAgLy8gZG9uJ3QgcHJvY2VlZCBpZiB4aHIgaGFzIGJlZW4gYWJvcnRlZFxuICAgIGlmICghc3RhdHMuYWJvcnRlZCkge1xuICAgICAgICAvLyBodHRwIHN0YXR1cyBiZXR3ZWVuIDIwMCB0byAyOTkgYXJlIGFsbCBzdWNjZXNzZnVsXG4gICAgICAgIGlmIChzdGF0dXMgPj0gMjAwICYmIHN0YXR1cyA8IDMwMCkgIHtcbiAgICAgICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMudGltZW91dEhhbmRsZSk7XG4gICAgICAgICAgc3RhdHMudGxvYWQgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgICB0aGlzLm9uU3VjY2VzcyhldmVudCwgc3RhdHMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gZXJyb3IgLi4uXG4gICAgICAgIGlmIChzdGF0cy5yZXRyeSA8IHRoaXMubWF4UmV0cnkpIHtcbiAgICAgICAgICBsb2dnZXIud2FybihgJHtzdGF0dXN9IHdoaWxlIGxvYWRpbmcgJHt0aGlzLnVybH0sIHJldHJ5aW5nIGluICR7dGhpcy5yZXRyeURlbGF5fS4uLmApO1xuICAgICAgICAgIHRoaXMuZGVzdHJveSgpO1xuICAgICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KHRoaXMubG9hZEludGVybmFsLmJpbmQodGhpcyksIHRoaXMucmV0cnlEZWxheSk7XG4gICAgICAgICAgLy8gZXhwb25lbnRpYWwgYmFja29mZlxuICAgICAgICAgIHRoaXMucmV0cnlEZWxheSA9IE1hdGgubWluKDIgKiB0aGlzLnJldHJ5RGVsYXksIDY0MDAwKTtcbiAgICAgICAgICBzdGF0cy5yZXRyeSsrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy50aW1lb3V0SGFuZGxlKTtcbiAgICAgICAgICBsb2dnZXIuZXJyb3IoYCR7c3RhdHVzfSB3aGlsZSBsb2FkaW5nICR7dGhpcy51cmx9YCApO1xuICAgICAgICAgIHRoaXMub25FcnJvcihldmVudCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBsb2FkdGltZW91dChldmVudCkge1xuICAgIGxvZ2dlci53YXJuKGB0aW1lb3V0IHdoaWxlIGxvYWRpbmcgJHt0aGlzLnVybH1gICk7XG4gICAgdGhpcy5vblRpbWVvdXQoZXZlbnQsIHRoaXMuc3RhdHMpO1xuICB9XG5cbiAgbG9hZHByb2dyZXNzKGV2ZW50KSB7XG4gICAgdmFyIHN0YXRzID0gdGhpcy5zdGF0cztcbiAgICBpZiAoc3RhdHMudGZpcnN0ID09PSBudWxsKSB7XG4gICAgICBzdGF0cy50Zmlyc3QgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICB9XG4gICAgc3RhdHMubG9hZGVkID0gZXZlbnQubG9hZGVkO1xuICAgIGlmICh0aGlzLm9uUHJvZ3Jlc3MpIHtcbiAgICAgIHRoaXMub25Qcm9ncmVzcyhldmVudCwgc3RhdHMpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBYaHJMb2FkZXI7XG4iXX0=
JsfWAgKTtcbiAgICB0aGlzLm9uVGltZW91dChldmVudCwgdGhpcy5zdGF0cyk7XG4gIH1cblxuICBsb2FkcHJvZ3Jlc3MoZXZlbnQpIHtcbiAgICB2YXIgc3RhdHMgPSB0aGlzLnN0YXRzO1xuICAgIGlmIChzdGF0cy50Zmlyc3QgPT09IG51bGwpIHtcbiAgICAgIHN0YXRzLnRmaXJzdCA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgIH1cbiAgICBzdGF0cy5sb2FkZWQgPSBldmVudC5sb2FkZWQ7XG4gICAgaWYgKHRoaXMub25Qcm9ncmVzcykge1xuICAgICAgdGhpcy5vblByb2dyZXNzKGV2ZW50LCBzdGF0cyk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFhockxvYWRlcjtcbiJdfQ==
