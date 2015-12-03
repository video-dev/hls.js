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

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var AbrController = (function () {
  function AbrController(hls) {
    _classCallCheck(this, AbrController);

    this.hls = hls;
    this.lastfetchlevel = 0;
    this._autoLevelCapping = -1;
    this._nextAutoLevel = -1;
    this.onflp = this.onFragmentLoadProgress.bind(this);
    hls.on(_events2['default'].FRAG_LOAD_PROGRESS, this.onflp);
  }

  _createClass(AbrController, [{
    key: 'destroy',
    value: function destroy() {
      this.hls.off(_events2['default'].FRAG_LOAD_PROGRESS, this.onflp);
    }
  }, {
    key: 'onFragmentLoadProgress',
    value: function onFragmentLoadProgress(event, data) {
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
})();

exports['default'] = AbrController;
module.exports = exports['default'];

},{"../events":15}],4:[function(require,module,exports){
/*
 * Level Controller
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

var _errors = require('../errors');

var LevelController = (function () {
  function LevelController(hls) {
    _classCallCheck(this, LevelController);

    this.hls = hls;
    this.onml = this.onManifestLoaded.bind(this);
    this.onll = this.onLevelLoaded.bind(this);
    this.onerr = this.onError.bind(this);
    this.ontick = this.tick.bind(this);
    hls.on(_events2['default'].MANIFEST_LOADED, this.onml);
    hls.on(_events2['default'].LEVEL_LOADED, this.onll);
    hls.on(_events2['default'].ERROR, this.onerr);
    this._manualLevel = this._autoLevelCapping = -1;
  }

  _createClass(LevelController, [{
    key: 'destroy',
    value: function destroy() {
      var hls = this.hls;
      hls.off(_events2['default'].MANIFEST_LOADED, this.onml);
      hls.off(_events2['default'].LEVEL_LOADED, this.onll);
      hls.off(_events2['default'].ERROR, this.onerr);
      if (this.timer) {
        clearInterval(this.timer);
      }
      this._manualLevel = -1;
    }
  }, {
    key: 'onManifestLoaded',
    value: function onManifestLoaded(event, data) {
      var levels0 = [],
          levels = [],
          bitrateStart,
          i,
          bitrateSet = {},
          videoCodecFound = false,
          audioCodecFound = false;

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
          bitrateSet[level.bitrate] = levels.length;
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
      this.hls.trigger(_events2['default'].MANIFEST_PARSED, { levels: this._levels, firstLevel: this._firstLevel, stats: data.stats });
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
    value: function onError(event, data) {
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
       * otherwise, we cannot recover this network error ....
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
          } else {
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
    value: function onLevelLoaded(event, data) {
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
})();

exports['default'] = LevelController;
module.exports = exports['default'];

},{"../errors":14,"../events":15,"../utils/logger":24}],5:[function(require,module,exports){
/*
 * MSE Media Controller
*/

'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _demuxDemuxer = require('../demux/demuxer');

var _demuxDemuxer2 = _interopRequireDefault(_demuxDemuxer);

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

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
  WAITING_LEVEL: 3,
  PARSING: 4,
  PARSED: 5,
  APPENDING: 6,
  BUFFER_FLUSHING: 7
};

var MSEMediaController = (function () {
  function MSEMediaController(hls) {
    _classCallCheck(this, MSEMediaController);

    this.config = hls.config;
    this.hls = hls;
    // Source Buffer listeners
    this.onsbue = this.onSBUpdateEnd.bind(this);
    this.onsbe = this.onSBUpdateError.bind(this);
    // internal listeners
    this.onmediaatt0 = this.onMediaAttaching.bind(this);
    this.onmediadet0 = this.onMediaDetaching.bind(this);
    this.onmp = this.onManifestParsed.bind(this);
    this.onll = this.onLevelLoaded.bind(this);
    this.onfl = this.onFragLoaded.bind(this);
    this.onkl = this.onKeyLoaded.bind(this);
    this.onis = this.onInitSegment.bind(this);
    this.onfpg = this.onFragParsing.bind(this);
    this.onfp = this.onFragParsed.bind(this);
    this.onerr = this.onError.bind(this);
    this.ontick = this.tick.bind(this);
    hls.on(_events2['default'].MEDIA_ATTACHING, this.onmediaatt0);
    hls.on(_events2['default'].MEDIA_DETACHING, this.onmediadet0);
    hls.on(_events2['default'].MANIFEST_PARSED, this.onmp);
  }

  _createClass(MSEMediaController, [{
    key: 'destroy',
    value: function destroy() {
      this.stop();
      var hls = this.hls;
      hls.off(_events2['default'].MEDIA_ATTACHING, this.onmediaatt0);
      hls.off(_events2['default'].MEDIA_DETACHING, this.onmediadet0);
      hls.off(_events2['default'].MANIFEST_PARSED, this.onmp);
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
      hls.on(_events2['default'].FRAG_LOADED, this.onfl);
      hls.on(_events2['default'].FRAG_PARSING_INIT_SEGMENT, this.onis);
      hls.on(_events2['default'].FRAG_PARSING_DATA, this.onfpg);
      hls.on(_events2['default'].FRAG_PARSED, this.onfp);
      hls.on(_events2['default'].ERROR, this.onerr);
      hls.on(_events2['default'].LEVEL_LOADED, this.onll);
      hls.on(_events2['default'].KEY_LOADED, this.onkl);
    }
  }, {
    key: 'stop',
    value: function stop() {
      this.mp4segments = [];
      this.flushRange = [];
      this.bufferRange = [];
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
      var hls = this.hls;
      hls.off(_events2['default'].FRAG_LOADED, this.onfl);
      hls.off(_events2['default'].FRAG_PARSED, this.onfp);
      hls.off(_events2['default'].FRAG_PARSING_DATA, this.onfpg);
      hls.off(_events2['default'].LEVEL_LOADED, this.onll);
      hls.off(_events2['default'].KEY_LOADED, this.onkl);
      hls.off(_events2['default'].FRAG_PARSING_INIT_SEGMENT, this.onis);
      hls.off(_events2['default'].ERROR, this.onerr);
    }
  }, {
    key: 'tick',
    value: function tick() {
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
          var bufferInfo = this.bufferInfo(pos, 0.3),
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
            if (typeof levelDetails === 'undefined') {
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
                  //logger.log('level/sn/sliding/start/end/bufEnd:${level}/${candidate.sn}/${sliding.toFixed(3)}/${candidate.start.toFixed(3)}/${(candidate.start+candidate.duration).toFixed(3)}/${bufferEnd.toFixed(3)}');
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
                      if (mediaSource && mediaSource.readyState === 'open') {
                        // ensure sourceBuffer are not in updating stateyes
                        var sb = this.sourceBuffer;
                        if (!(sb.audio && sb.audio.updating || sb.video && sb.video.updating)) {
                          _utilsLogger.logger.log('all media data available, signal endOfStream() to MediaSource');
                          //Notify the media element that it now has all of the media data
                          mediaSource.endOfStream();
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
              var bufferStarvationDelay = this.bufferInfo(pos, 0.3).end - pos;
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
                    //logger.error(`error while trying to append buffer:${err.message},try appending later`);
                    this.mp4segments.unshift(segment);
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
        default:
          break;
      }
      // check/update current fragment
      this._checkFragmentChanged();
      // check buffer
      this._checkBuffer();
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
          bufferEnd = end;
          bufferLen = bufferEnd - pos;
        } else if (pos + maxHoleDuration < start) {
          bufferStartNext = start;
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
    value: function onMediaAttaching(event, data) {
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
      // FIXME: this was in code before but onverror was never set! can be removed or fixed?
      //media.addEventListener('error', this.onverror);
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
          ms.endOfStream();
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
        if (this.bufferInfo(this.media.currentTime, 0.3).len === 0) {
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
      if (this.media.currentTime !== this.startPosition) {
        this.media.currentTime = this.startPosition;
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
    value: function onManifestParsed(event, data) {
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
    value: function onLevelLoaded(event, data) {
      var newDetails = data.details,
          newLevelId = data.level,
          curLevel = this.levels[newLevelId],
          duration = newDetails.totalduration;

      _utilsLogger.logger.log('level ' + newLevelId + ' loaded [' + newDetails.startSN + ',' + newDetails.endSN + '],duration:' + duration);

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
    value: function onFragLoaded(event, data) {
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
              sn = fragCurrent.sn;
          _utilsLogger.logger.log('Demuxing ' + sn + ' of [' + details.startSN + ' ,' + details.endSN + '],level ' + level);
          this.demuxer.push(data.payload, currentLevel.audioCodec, currentLevel.videoCodec, start, fragCurrent.cc, level, sn, duration, fragCurrent.decryptdata);
        }
      }
    }
  }, {
    key: 'onInitSegment',
    value: function onInitSegment(event, data) {
      if (this.state === State.PARSING) {
        // check if codecs have been explicitely defined in the master playlist for this level;
        // if yes use these ones instead of the ones parsed from the demux
        var audioCodec = this.levels[this.level].audioCodec,
            videoCodec = this.levels[this.level].videoCodec,
            sb;
        //logger.log('playlist level A/V codecs:' + audioCodec + ',' + videoCodec);
        //logger.log('playlist codecs:' + codec);
        // if playlist does not specify codecs, use codecs found while parsing fragment
        if (audioCodec === undefined || data.audiocodec === undefined) {
          audioCodec = data.audioCodec;
        }
        if (videoCodec === undefined || data.videocodec === undefined) {
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
    key: 'onFragParsing',
    value: function onFragParsing(event, data) {
      if (this.state === State.PARSING) {
        this.tparse2 = Date.now();
        var level = this.levels[this.level],
            frag = this.fragCurrent;
        _utilsLogger.logger.log('parsed data, type/startPTS/endPTS/startDTS/endDTS/nb:' + data.type + '/' + data.startPTS.toFixed(3) + '/' + data.endPTS.toFixed(3) + '/' + data.startDTS.toFixed(3) + '/' + data.endDTS.toFixed(3) + '/' + data.nb);
        var drift = _helperLevelHelper2['default'].updateFragPTS(level.details, frag.sn, data.startPTS, data.endPTS);
        this.hls.trigger(_events2['default'].LEVEL_PTS_UPDATED, { details: level.details, level: this.level, drift: drift });

        this.mp4segments.push({ type: data.type, data: data.moof });
        this.mp4segments.push({ type: data.type, data: data.mdat });
        this.nextLoadPosition = data.endPTS;
        this.bufferRange.push({ type: data.type, start: data.startPTS, end: data.endPTS, frag: frag });

        //trigger handler right now
        this.tick();
      } else {
        _utilsLogger.logger.warn('not in PARSING state, discarding ' + event);
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
    value: function onError(event, data) {
      switch (data.details) {
        // abort fragment loading on errors
        case _errors.ErrorDetails.FRAG_LOAD_ERROR:
        case _errors.ErrorDetails.FRAG_LOAD_TIMEOUT:
        case _errors.ErrorDetails.FRAG_LOOP_LOADING_ERROR:
        case _errors.ErrorDetails.LEVEL_LOAD_ERROR:
        case _errors.ErrorDetails.LEVEL_LOAD_TIMEOUT:
        case _errors.ErrorDetails.KEY_LOAD_ERROR:
        case _errors.ErrorDetails.KEY_LOAD_TIMEOUT:
          // if fatal error, stop processing, otherwise move to IDLE to retry loading
          _utilsLogger.logger.warn('buffer controller: ' + data.details + ' while loading frag,switch to ' + (data.fatal ? 'ERROR' : 'IDLE') + ' state ...');
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
        //logger.log(`readyState:${readyState}`);
        // if ready state different from HAVE_NOTHING (numeric value 0), we are allowed to seek
        if (readyState) {
          // if seek after buffered defined, let's seek if within acceptable range
          var seekAfterBuffered = this.seekAfterBuffered;
          if (seekAfterBuffered) {
            if (media.duration >= seekAfterBuffered) {
              media.currentTime = seekAfterBuffered;
              this.seekAfterBuffered = undefined;
            }
          } else if (readyState < 3) {
            // readyState = 1 or 2
            //  HAVE_METADATA (numeric value 1)     Enough of the resource has been obtained that the duration of the resource is available.
            //                                       The API will no longer throw an exception when seeking.
            // HAVE_CURRENT_DATA (numeric value 2)  Data for the immediate current playback position is available,
            //                                      but either not enough data is available that the user agent could
            //                                      successfully advance the current playback position
            var currentTime = media.currentTime;
            var bufferInfo = this.bufferInfo(currentTime, 0);
            // check if current time is buffered or not
            if (bufferInfo.len === 0) {
              // no buffer available @ currentTime, check if next buffer is close (in a 300 ms range)
              var nextBufferStart = bufferInfo.nextStart;
              if (nextBufferStart && nextBufferStart - currentTime < 0.3) {
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
  }, {
    key: 'onSBUpdateError',
    value: function onSBUpdateError(event) {
      _utilsLogger.logger.error('sourceBuffer error:' + event);
      this.state = State.ERROR;
      this.hls.trigger(_events2['default'].ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.BUFFER_APPENDING_ERROR, fatal: true, frag: this.fragCurrent });
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
})();

exports['default'] = MSEMediaController;
module.exports = exports['default'];

},{"../demux/demuxer":11,"../errors":14,"../events":15,"../helper/level-helper":16,"../utils/binary-search":23,"../utils/logger":24}],6:[function(require,module,exports){
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

},{}],7:[function(require,module,exports){
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
      init0 = initVector[0];
      init1 = initVector[1];
      init2 = initVector[2];
      init3 = initVector[3];

      // decrypt four word sequences, applying cipher-block chaining (CBC)
      // to each decrypted block
      for (wordIx = 0; wordIx < encrypted32.length; wordIx += 4) {
        // convert big-endian (network order) words into little-endian
        // (javascript order)
        encrypted0 = this.ntoh(encrypted32[wordIx]);
        encrypted1 = this.ntoh(encrypted32[wordIx + 1]);
        encrypted2 = this.ntoh(encrypted32[wordIx + 2]);
        encrypted3 = this.ntoh(encrypted32[wordIx + 3]);

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
    key: 'localDecript',
    value: function localDecript(encrypted, key, initVector, decrypted) {
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
      this.localDecript(encrypted32.subarray(i, i + step), key, initVector, decrypted);

      for (i = step; i < encrypted32.length; i += step) {
        initVector = new Uint32Array([this.ntoh(encrypted32[i - 4]), this.ntoh(encrypted32[i - 3]), this.ntoh(encrypted32[i - 2]), this.ntoh(encrypted32[i - 1])]);
        this.localDecript(encrypted32.subarray(i, i + step), key, initVector, decrypted);
      }

      return decrypted;
    }
  }]);

  return AES128Decrypter;
})();

exports['default'] = AES128Decrypter;
module.exports = exports['default'];

},{"./aes":6}],8:[function(require,module,exports){
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
    this.disableWebCrypto = false;
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
      _utilsLogger.logger.log('decrypting by WebCrypto API');

      var localthis = this;
      window.crypto.subtle.importKey('raw', key, { name: 'AES-CBC', length: 128 }, false, ['decrypt']).then(function (importedKey) {
        window.crypto.subtle.decrypt({ name: 'AES-CBC', iv: iv.buffer }, importedKey, data).then(callback)['catch'](function (err) {
          localthis.onWebCryptoError(err, data, key, iv, callback);
        });
      })['catch'](function (err) {
        localthis.onWebCryptoError(err, data, key, iv, callback);
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

},{"../errors":14,"../utils/logger":24,"./aes128-decrypter":7}],9:[function(require,module,exports){
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
        } else {
          this.hls.trigger(_events2['default'].ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.FRAG_PARSING_ERROR, fatal: true, reason: 'no demux matching with content found' });
          return;
        }
      }
      demuxer.push(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration);
    }
  }, {
    key: 'remux',
    value: function remux() {
      var demuxer = this.demuxer;
      if (demuxer) {
        demuxer.remux();
      }
    }
  }]);

  return DemuxerInline;
})();

exports['default'] = DemuxerInline;
module.exports = exports['default'];

},{"../demux/tsdemuxer":13,"../errors":14,"../events":15}],10:[function(require,module,exports){
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
};

exports['default'] = DemuxerWorker;
module.exports = exports['default'];

},{"../demux/demuxer-inline":9,"../events":15,"../remux/mp4-remuxer":22,"events":1}],11:[function(require,module,exports){
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

},{"../crypt/decrypter":8,"../demux/demuxer-inline":9,"../demux/demuxer-worker":10,"../events":15,"../remux/mp4-remuxer":22,"../utils/logger":24,"webworkify":2}],12:[function(require,module,exports){
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
      return {
        width: (picWidthInMbsMinus1 + 1) * 16 - frameCropLeftOffset * 2 - frameCropRightOffset * 2,
        height: (2 - frameMbsOnlyFlag) * (picHeightInMapUnitsMinus1 + 1) * 16 - frameCropTopOffset * 2 - frameCropBottomOffset * 2
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

},{"../utils/logger":24}],13:[function(require,module,exports){
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
    this.PES_TIMESCALE = 90000;
    this.remuxer = new this.remuxerClass(observer);
  }

  _createClass(TSDemuxer, [{
    key: 'switchLevel',
    value: function switchLevel() {
      this.pmtParsed = false;
      this._pmtId = -1;
      this._avcTrack = { type: 'video', id: -1, sequenceNumber: 0, samples: [], len: 0, nbNalu: 0 };
      this._aacTrack = { type: 'audio', id: -1, sequenceNumber: 0, samples: [], len: 0 };
      this._id3Track = { type: 'id3', id: -1, sequenceNumber: 0, samples: [], len: 0 };
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
      this.remuxer.remux(this._aacTrack, this._avcTrack, this._id3Track, this.timeOffset, this.contiguous);
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
          case 6:
            push = true;
            if (debug) {
              debugString += 'SEI ';
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
            } else if (value === 1) {
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
                  //logger.log('first NALU found with overflow:' + overflow);
                  if (this._avcTrack.samples.length) {
                    var lastavcSample = this._avcTrack.samples[this._avcTrack.samples.length - 1];
                    var lastUnit = lastavcSample.units.units[lastavcSample.units.units.length - 1];
                    var tmp = new Uint8Array(lastUnit.data.byteLength + overflow);
                    tmp.set(lastUnit.data, 0);
                    tmp.set(array.subarray(0, overflow), lastUnit.data.byteLength);
                    lastUnit.data = tmp;
                    lastavcSample.units.length += overflow;
                    this._avcTrack.len += overflow;
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
          aacSample,
          data = pes.data,
          config,
          adtsFrameSize,
          adtsStartOffset,
          adtsHeaderLen,
          stamp,
          nbSamples,
          len;
      if (this.aacOverFlow) {
        var tmp = new Uint8Array(this.aacOverFlow.byteLength + data.byteLength);
        tmp.set(this.aacOverFlow, 0);
        tmp.set(data, this.aacOverFlow.byteLength);
        data = tmp;
      }
      // look for ADTS header (0xFFFx)
      for (adtsStartOffset = 0, len = data.length; adtsStartOffset < len - 1; adtsStartOffset++) {
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
        config = this._ADTStoAudioConfig(data, adtsStartOffset, this.audioCodec);
        track.config = config.config;
        track.audiosamplerate = config.samplerate;
        track.channelCount = config.channelCount;
        track.codec = config.codec;
        track.timescale = this.remuxer.timescale;
        track.duration = this.remuxer.timescale * this._duration;
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
        stamp = Math.round(pes.pts + nbSamples * 1024 * this.PES_TIMESCALE / track.audiosamplerate);
        //stamp = pes.pts;
        //console.log('AAC frame, offset/length/pts:' + (adtsStartOffset+7) + '/' + adtsFrameSize + '/' + stamp.toFixed(0));
        if (adtsFrameSize > 0 && adtsStartOffset + adtsHeaderLen + adtsFrameSize <= len) {
          aacSample = { unit: data.subarray(adtsStartOffset + adtsHeaderLen, adtsStartOffset + adtsHeaderLen + adtsFrameSize), pts: stamp, dts: stamp };
          this._aacTrack.samples.push(aacSample);
          this._aacTrack.len += adtsFrameSize;
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
    key: '_ADTStoAudioConfig',
    value: function _ADTStoAudioConfig(data, offset, audioCodec) {
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
        this.observer.trigger(_events2['default'].ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.FRAG_PARSING_ERROR, fatal: true, reason: 'invalid ADTS sampling index:' + adtsSampleingIndex });
        return;
      }
      adtsChanelConfig = (data[offset + 2] & 0x01) << 2;
      // byte 3
      adtsChanelConfig |= (data[offset + 3] & 0xC0) >>> 6;
      _utilsLogger.logger.log('manifest codec:' + audioCodec + ',ADTS data:type:' + adtsObjectType + ',sampleingIndex:' + adtsSampleingIndex + '[' + adtsSampleingRates[adtsSampleingIndex] + 'kHz],channelConfig:' + adtsChanelConfig);
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
            // if (manifest codec is AAC) AND (frequency less than 24kHz OR nb channel is 1)
            if (audioCodec && audioCodec.indexOf('mp4a.40.2') !== -1 && (adtsSampleingIndex >= 6 || adtsChanelConfig === 1)) {
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

},{"../errors":14,"../events":15,"../utils/logger":24,"./exp-golomb":12}],14:[function(require,module,exports){
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
  BUFFER_APPENDING_ERROR: 'bufferAppendingError'
};
exports.ErrorDetails = ErrorDetails;

},{}],15:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
exports['default'] = {
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
  LEVEL_PTS_UPDATED: 'hlsPTSUpdated',
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
  // fired when parsing id3 is completed - data: { samples : [ id3 samples pes ] }
  FRAG_PARSING_METADATA: 'hlsFraParsingMetadata',
  // fired when moof/mdat have been extracted from fragment - data: { moof : moof MP4 box, mdat : mdat MP4 box}
  FRAG_PARSING_DATA: 'hlsFragParsingData',
  // fired when fragment parsing is completed - data: undefined
  FRAG_PARSED: 'hlsFragParsed',
  // fired when fragment remuxed MP4 boxes have all been appended into SourceBuffer - data: { frag : fragment object, stats : { trequest, tfirst, tload, tparsed, tbuffered, length} }
  FRAG_BUFFERED: 'hlsFragBuffered',
  // fired when fragment matching with current media position is changing - data : { frag : fragment object }
  FRAG_CHANGED: 'hlsFragChanged',
  // Identifier for a FPS drop event - data: {curentDropped, currentDecoded, totalDroppedFrames}
  FPS_DROP: 'hlsFPSDrop',
  // Identifier for an error event - data: { type : error type, details : error details, fatal : if true, hls.js cannot/will not try to recover, if false, hls.js will try to recover,other error specific data}
  ERROR: 'hlsError',
  // fired when hls.js instance starts destroying. Different from MSE_DETACHED as one could want to detach and reattach a media to the instance of hls.js to handle mid-rolls for example
  DESTROYING: 'hlsDestroying',
  // fired when a decrypt key loading starts - data: { frag : fragment object}
  KEY_LOADING: 'hlsKeyLoading',
  // fired when a decrypt key loading is completed - data: { frag : fragment object, payload : key payload, stats : { trequest, tfirst, tload, length}}
  KEY_LOADED: 'hlsKeyLoaded'
};
module.exports = exports['default'];

},{}],16:[function(require,module,exports){
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
        startPTS = Math.max(startPTS, frag.startPTS);
        endPTS = Math.min(endPTS, frag.endPTS);
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
            _utilsLogger.logger.error('negative duration computed for ' + fragFrom + ', there should be some duration drift between playlist and fragment!');
          }
        } else {
          fragTo.duration = fragFrom.start - fragToPTS;
          if (fragTo.duration < 0) {
            _utilsLogger.logger.error('negative duration computed for ' + fragTo + ', there should be some duration drift between playlist and fragment!');
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

},{"../utils/logger":24}],17:[function(require,module,exports){
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
  }]);

  function Hls() {
    var config = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, Hls);

    var configDefault = {
      autoStartLoad: true,
      debug: false,
      maxBufferLength: 30,
      maxBufferSize: 60 * 1000 * 1000,
      liveSyncDurationCount: 3,
      liveMaxLatencyDurationCount: Infinity,
      maxMaxBufferLength: 600,
      enableWorker: true,
      enableSoftwareAES: true,
      fragLoadingTimeOut: 20000,
      fragLoadingMaxRetry: 1,
      fragLoadingRetryDelay: 1000,
      fragLoadingLoopThreshold: 3,
      manifestLoadingTimeOut: 10000,
      manifestLoadingMaxRetry: 1,
      manifestLoadingRetryDelay: 1000,
      fpsDroppedMonitoringPeriod: 5000,
      fpsDroppedMonitoringThreshold: 0.2,
      appendErrorMaxRetry: 200,
      loader: _utilsXhrLoader2['default'],
      fLoader: undefined,
      pLoader: undefined,
      abrController: _controllerAbrController2['default'],
      mediaController: _controllerMseMediaController2['default']
    };
    for (var prop in configDefault) {
      if (prop in config) {
        continue;
      }
      config[prop] = configDefault[prop];
    }

    if (config.liveMaxLatencyDurationCount !== undefined && config.liveMaxLatencyDurationCount <= config.liveSyncDurationCount) {
      throw new Error('Illegal hls.js configuration: "liveMaxLatencyDurationCount" must be strictly superior to "liveSyncDurationCount" in player configuration');
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

},{"./controller/abr-controller":3,"./controller/level-controller":4,"./controller/mse-media-controller":5,"./errors":14,"./events":15,"./loader/fragment-loader":18,"./loader/key-loader":19,"./loader/playlist-loader":20,"./utils/logger":24,"./utils/xhr-loader":26,"events":1}],18:[function(require,module,exports){
/*
 * Fragment Loader
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

var FragmentLoader = (function () {
  function FragmentLoader(hls) {
    _classCallCheck(this, FragmentLoader);

    this.hls = hls;
    this.onfl = this.onFragLoading.bind(this);
    hls.on(_events2['default'].FRAG_LOADING, this.onfl);
  }

  _createClass(FragmentLoader, [{
    key: 'destroy',
    value: function destroy() {
      if (this.loader) {
        this.loader.destroy();
        this.loader = null;
      }
      this.hls.off(_events2['default'].FRAG_LOADING, this.onfl);
    }
  }, {
    key: 'onFragLoading',
    value: function onFragLoading(event, data) {
      var frag = data.frag;
      this.frag = frag;
      this.frag.loaded = 0;
      var config = this.hls.config;
      frag.loader = this.loader = typeof config.fLoader !== 'undefined' ? new config.fLoader(config) : new config.loader(config);
      this.loader.load(frag.url, 'arraybuffer', this.loadsuccess.bind(this), this.loaderror.bind(this), this.loadtimeout.bind(this), config.fragLoadingTimeOut, config.fragLoadingMaxRetry, config.fragLoadingRetryDelay, this.loadprogress.bind(this), frag);
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
})();

exports['default'] = FragmentLoader;
module.exports = exports['default'];

},{"../errors":14,"../events":15}],19:[function(require,module,exports){
/*
 * Decrypt key Loader
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

var KeyLoader = (function () {
  function KeyLoader(hls) {
    _classCallCheck(this, KeyLoader);

    this.hls = hls;
    this.decryptkey = null;
    this.decrypturl = null;
    this.ondkl = this.onDecryptKeyLoading.bind(this);
    hls.on(_events2['default'].KEY_LOADING, this.ondkl);
  }

  _createClass(KeyLoader, [{
    key: 'destroy',
    value: function destroy() {
      if (this.loader) {
        this.loader.destroy();
        this.loader = null;
      }
      this.hls.off(_events2['default'].KEY_LOADING, this.ondkl);
    }
  }, {
    key: 'onDecryptKeyLoading',
    value: function onDecryptKeyLoading(event, data) {
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
})();

exports['default'] = KeyLoader;
module.exports = exports['default'];

},{"../errors":14,"../events":15}],20:[function(require,module,exports){
/**
 * Playlist Loader
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

var _utilsUrl = require('../utils/url');

var _utilsUrl2 = _interopRequireDefault(_utilsUrl);

//import {logger} from '../utils/logger';

var PlaylistLoader = (function () {
  function PlaylistLoader(hls) {
    _classCallCheck(this, PlaylistLoader);

    this.hls = hls;
    this.onml = this.onManifestLoading.bind(this);
    this.onll = this.onLevelLoading.bind(this);
    hls.on(_events2['default'].MANIFEST_LOADING, this.onml);
    hls.on(_events2['default'].LEVEL_LOADING, this.onll);
  }

  _createClass(PlaylistLoader, [{
    key: 'destroy',
    value: function destroy() {
      if (this.loader) {
        this.loader.destroy();
        this.loader = null;
      }
      this.url = this.id = null;
      this.hls.off(_events2['default'].MANIFEST_LOADING, this.onml);
      this.hls.off(_events2['default'].LEVEL_LOADING, this.onll);
    }
  }, {
    key: 'onManifestLoading',
    value: function onManifestLoading(event, data) {
      this.load(data.url, null);
    }
  }, {
    key: 'onLevelLoading',
    value: function onLevelLoading(event, data) {
      this.load(data.url, data.level, data.id);
    }
  }, {
    key: 'load',
    value: function load(url, id1, id2) {
      var config = this.hls.config;
      this.url = url;
      this.id = id1;
      this.id2 = id2;
      this.loader = typeof config.pLoader !== 'undefined' ? new config.pLoader(config) : new config.loader(config);
      this.loader.load(url, '', this.loadsuccess.bind(this), this.loaderror.bind(this), this.loadtimeout.bind(this), config.manifestLoadingTimeOut, config.manifestLoadingMaxRetry, config.manifestLoadingRetryDelay);
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
          level = {},
          result,
          codecs,
          codec;
      // https://regex101.com is your friend
      var re = /#EXT-X-STREAM-INF:([^\n\r]*(BAND)WIDTH=(\d+))?([^\n\r]*(CODECS)=\"([^\"\n\r]*)\",?)?([^\n\r]*(RES)OLUTION=(\d+)x(\d+))?([^\n\r]*(NAME)=\"(.*)\")?[^\n\r]*[\r\n]+([^\r\n]+)/g;
      while ((result = re.exec(string)) != null) {
        result.shift();
        result = result.filter(function (n) {
          return n !== undefined;
        });
        level.url = this.resolve(result.pop(), baseurl);
        while (result.length > 0) {
          switch (result.shift()) {
            case 'RES':
              level.width = parseInt(result.shift());
              level.height = parseInt(result.shift());
              break;
            case 'BAND':
              level.bitrate = parseInt(result.shift());
              break;
            case 'NAME':
              level.name = result.shift();
              break;
            case 'CODECS':
              codecs = result.shift().split(',');
              while (codecs.length > 0) {
                codec = codecs.shift();
                if (codec.indexOf('avc1') !== -1) {
                  level.videoCodec = this.avc1toavcoti(codec);
                } else {
                  level.audioCodec = codec;
                }
              }
              break;
            default:
              break;
          }
        }
        levels.push(level);
        level = {};
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
        result += ('00' + parseInt(avcdata.shift()).toString(16)).substr(-4);
      } else {
        result = codec;
      }
      return result;
    }
  }, {
    key: 'parseKeyParamsByRegex',
    value: function parseKeyParamsByRegex(string, regexp) {
      var result = regexp.exec(string);
      if (result) {
        result.shift();
        result = result.filter(function (n) {
          return n !== undefined;
        });
        if (result.length === 2) {
          return result[1];
        }
      }
      return null;
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
          result,
          regexp,
          cc = 0,
          frag,
          byteRangeEndOffset,
          byteRangeStartOffset;
      var levelkey = { method: null, key: null, iv: null, uri: null };
      regexp = /(?:#EXT-X-(MEDIA-SEQUENCE):(\d+))|(?:#EXT-X-(TARGETDURATION):(\d+))|(?:#EXT-X-(KEY):(.*))|(?:#EXT(INF):([\d\.]+)[^\r\n]*([\r\n]+[^#|\r\n]+)?)|(?:#EXT-X-(BYTERANGE):([\d]+[@[\d]*)]*[\r\n]+([^#|\r\n]+)?|(?:#EXT-X-(ENDLIST))|(?:#EXT-X-(DIS)CONTINUITY))/g;
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
            frag = level.fragments.length ? level.fragments[level.fragments.length - 1] : null;
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
              level.fragments.push({ url: result[2] ? this.resolve(result[2], baseurl) : null, duration: duration, start: totalduration, sn: sn, level: id, cc: cc, byteRangeStartOffset: byteRangeStartOffset, byteRangeEndOffset: byteRangeEndOffset, decryptdata: fragdecryptdata });
              totalduration += duration;
              byteRangeStartOffset = null;
            }
            break;
          case 'KEY':
            // https://tools.ietf.org/html/draft-pantos-http-live-streaming-08#section-3.4.4
            var decryptparams = result[1];
            var decryptmethod = this.parseKeyParamsByRegex(decryptparams, /(METHOD)=([^,]*)/),
                decrypturi = this.parseKeyParamsByRegex(decryptparams, /(URI)=["]([^,]*)["]/),
                decryptiv = this.parseKeyParamsByRegex(decryptparams, /(IV)=([^,]*)/);
            if (decryptmethod) {
              levelkey = { method: null, key: null, iv: null, uri: null };
              if (decrypturi && decryptmethod === 'AES-128') {
                levelkey.method = decryptmethod;
                // URI to get the key
                levelkey.uri = this.resolve(decrypturi, baseurl);
                levelkey.key = null;
                // Initialization Vector (IV)
                if (decryptiv) {
                  levelkey.iv = decryptiv;
                  if (levelkey.iv.substring(0, 2) === '0x') {
                    levelkey.iv = levelkey.iv.substring(2);
                  }
                  levelkey.iv = levelkey.iv.match(/.{8}/g);
                  levelkey.iv[0] = parseInt(levelkey.iv[0], 16);
                  levelkey.iv[1] = parseInt(levelkey.iv[1], 16);
                  levelkey.iv[2] = parseInt(levelkey.iv[2], 16);
                  levelkey.iv[3] = parseInt(levelkey.iv[3], 16);
                  levelkey.iv = new Uint32Array(levelkey.iv);
                }
              }
            }
            break;
          default:
            break;
        }
      }
      //logger.log('found ' + level.fragments.length + ' fragments');
      level.totalduration = totalduration;
      level.endSN = currentSN - 1;
      return level;
    }
  }, {
    key: 'loadsuccess',
    value: function loadsuccess(event, stats) {
      var string = event.currentTarget.responseText,
          url = event.currentTarget.responseURL,
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
      stats.mtime = new Date(event.currentTarget.getResponseHeader('Last-Modified'));
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
})();

exports['default'] = PlaylistLoader;
module.exports = exports['default'];

},{"../errors":14,"../events":15,"../utils/url":25}],21:[function(require,module,exports){
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

      MP4.MAJOR_BRAND = new Uint8Array(['i'.charCodeAt(0), 's'.charCodeAt(0), 'o'.charCodeAt(0), 'm'.charCodeAt(0)]);

      MP4.AVC1_BRAND = new Uint8Array(['a'.charCodeAt(0), 'v'.charCodeAt(0), 'c'.charCodeAt(0), '1'.charCodeAt(0)]);

      MP4.MINOR_VERSION = new Uint8Array([0, 0, 0, 1]);

      MP4.VIDEO_HDLR = new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x00, // flags
      0x00, 0x00, 0x00, 0x00, // pre_defined
      0x76, 0x69, 0x64, 0x65, // handler_type: 'vide'
      0x00, 0x00, 0x00, 0x00, // reserved
      0x00, 0x00, 0x00, 0x00, // reserved
      0x00, 0x00, 0x00, 0x00, // reserved
      0x56, 0x69, 0x64, 0x65, 0x6f, 0x48, 0x61, 0x6e, 0x64, 0x6c, 0x65, 0x72, 0x00 // name: 'VideoHandler'
      ]);

      MP4.AUDIO_HDLR = new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x00, // flags
      0x00, 0x00, 0x00, 0x00, // pre_defined
      0x73, 0x6f, 0x75, 0x6e, // handler_type: 'soun'
      0x00, 0x00, 0x00, 0x00, // reserved
      0x00, 0x00, 0x00, 0x00, // reserved
      0x00, 0x00, 0x00, 0x00, // reserved
      0x53, 0x6f, 0x75, 0x6e, 0x64, 0x48, 0x61, 0x6e, 0x64, 0x6c, 0x65, 0x72, 0x00 // name: 'SoundHandler'
      ]);

      MP4.HDLR_TYPES = {
        'video': MP4.VIDEO_HDLR,
        'audio': MP4.AUDIO_HDLR
      };

      MP4.DREF = new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x00, // flags
      0x00, 0x00, 0x00, 0x01, // entry_count
      0x00, 0x00, 0x00, 0x0c, // entry_size
      0x75, 0x72, 0x6c, 0x20, // 'url' type
      0x00, // version 0
      0x00, 0x00, 0x01 // entry_flags
      ]);
      MP4.STCO = new Uint8Array([0x00, // version
      0x00, 0x00, 0x00, // flags
      0x00, 0x00, 0x00, 0x00 // entry_count
      ]);
      MP4.STSC = MP4.STCO;
      MP4.STTS = MP4.STCO;
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

      MP4.FTYP = MP4.box(MP4.types.ftyp, MP4.MAJOR_BRAND, MP4.MINOR_VERSION, MP4.MAJOR_BRAND, MP4.AVC1_BRAND);
      MP4.DINF = MP4.box(MP4.types.dinf, MP4.box(MP4.types.dref, MP4.DREF));
    }
  }, {
    key: 'box',
    value: function box(type) {
      var payload = Array.prototype.slice.call(arguments, 1),
          size = 0,
          i = payload.length,
          result,
          view;
      // calculate the total size we need to allocate
      while (i--) {
        size += payload[i].byteLength;
      }
      result = new Uint8Array(size + 8);
      view = new DataView(result.buffer);
      view.setUint32(0, result.byteLength);
      result.set(type, 4);
      // copy the payload into the result
      for (i = 0, size = 8; i < payload.length; i++) {
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
      ]).concat(pps))); // "PPS"
      //console.log('avcc:' + Hex.hexDump(avcc));
      return MP4.box(MP4.types.avc1, new Uint8Array([0x00, 0x00, 0x00, // reserved
      0x00, 0x00, 0x00, // reserved
      0x00, 0x01, // data_reference_index
      0x00, 0x00, // pre_defined
      0x00, 0x00, // reserved
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // pre_defined
      track.width >> 8 & 0xFF, track.width & 0xff, // width
      track.height >> 8 & 0xFF, track.height & 0xff, // height
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
      return new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x00, // flags

      0x03, // descriptor_type
      0x17 + track.config.length, // length
      0x00, 0x01, //es_id
      0x00, // stream_priority

      0x04, // descriptor_type
      0x0f + track.config.length, // length
      0x40, //codec : mpeg4_audio
      0x15, // stream_type
      0x00, 0x00, 0x00, // buffer_size
      0x00, 0x00, 0x00, 0x00, // maxBitrate
      0x00, 0x00, 0x00, 0x00, // avgBitrate

      0x05 // descriptor_type
      ].concat([track.config.length]).concat(track.config).concat([0x06, 0x01, 0x02])); // GASpecificConfig)); // length + audio config descriptor
    }
  }, {
    key: 'mp4a',
    value: function mp4a(track) {
      return MP4.box(MP4.types.mp4a, new Uint8Array([0x00, 0x00, 0x00, // reserved
      0x00, 0x00, 0x00, // reserved
      0x00, 0x01, // data_reference_index
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // reserved
      0x00, track.channelCount, // channelcount
      0x00, 0x10, // sampleSize:16bits
      0x00, 0x00, 0x00, 0x00, // reserved2
      track.audiosamplerate >> 8 & 0xFF, track.audiosamplerate & 0xff, //
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
      return MP4.box(MP4.types.tkhd, new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x07, // flags
      0x00, 0x00, 0x00, 0x00, // creation_time
      0x00, 0x00, 0x00, 0x00, // modification_time
      track.id >> 24 & 0xFF, track.id >> 16 & 0xFF, track.id >> 8 & 0xFF, track.id & 0xFF, // track_ID
      0x00, 0x00, 0x00, 0x00, // reserved
      track.duration >> 24, track.duration >> 16 & 0xFF, track.duration >> 8 & 0xFF, track.duration & 0xFF, // duration
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // reserved
      0x00, 0x00, // layer
      0x00, 0x00, // alternate_group
      0x00, 0x00, // non-audio track volume
      0x00, 0x00, // reserved
      0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x40, 0x00, 0x00, 0x00, // transformation: unity matrix
      track.width >> 8 & 0xFF, track.width & 0xFF, 0x00, 0x00, // width
      track.height >> 8 & 0xFF, track.height & 0xFF, 0x00, 0x00 // height
      ]));
    }
  }, {
    key: 'traf',
    value: function traf(track, baseMediaDecodeTime) {
      var sampleDependencyTable = MP4.sdtp(track);
      return MP4.box(MP4.types.traf, MP4.box(MP4.types.tfhd, new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x00, // flags
      track.id >> 24, track.id >> 16 & 0XFF, track.id >> 8 & 0XFF, track.id & 0xFF])), // track_ID
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
      return MP4.box(MP4.types.trex, new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x00, // flags
      track.id >> 24, track.id >> 16 & 0XFF, track.id >> 8 & 0XFF, track.id & 0xFF, // track_ID
      0x00, 0x00, 0x00, 0x01, // default_sample_description_index
      0x00, 0x00, 0x00, 0x00, // default_sample_duration
      0x00, 0x00, 0x00, 0x00, // default_sample_size
      0x00, 0x01, 0x00, 0x01 // default_sample_flags
      ]));
    }
  }, {
    key: 'trun',
    value: function trun(track, offset) {
      var samples, sample, i, array;
      samples = track.samples || [];
      array = new Uint8Array(12 + 16 * samples.length);
      offset += 8 + array.byteLength;
      array.set([0x00, // version 0
      0x00, 0x0f, 0x01, // flags
      samples.length >>> 24 & 0xFF, samples.length >>> 16 & 0xFF, samples.length >>> 8 & 0xFF, samples.length & 0xFF, // sample_count
      offset >>> 24 & 0xFF, offset >>> 16 & 0xFF, offset >>> 8 & 0xFF, offset & 0xFF // data_offset
      ], 0);
      for (i = 0; i < samples.length; i++) {
        sample = samples[i];
        array.set([sample.duration >>> 24 & 0xFF, sample.duration >>> 16 & 0xFF, sample.duration >>> 8 & 0xFF, sample.duration & 0xFF, // sample_duration
        sample.size >>> 24 & 0xFF, sample.size >>> 16 & 0xFF, sample.size >>> 8 & 0xFF, sample.size & 0xFF, // sample_size
        sample.flags.isLeading << 2 | sample.flags.dependsOn, sample.flags.isDependedOn << 6 | sample.flags.hasRedundancy << 4 | sample.flags.paddingValue << 1 | sample.flags.isNonSync, sample.flags.degradPrio & 0xF0 << 8, sample.flags.degradPrio & 0x0F, // sample_flags
        sample.cts >>> 24 & 0xFF, sample.cts >>> 16 & 0xFF, sample.cts >>> 8 & 0xFF, sample.cts & 0xFF // sample_composition_time_offset
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

},{}],22:[function(require,module,exports){
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
    value: function remux(audioTrack, videoTrack, id3Track, timeOffset, contiguous) {
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
          i = 8,
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
          view.setUint32(i, unit.data.byteLength);
          i += 4;
          mdat.set(unit.data, i);
          i += unit.data.byteLength;
          mp4SampleLength += 4 + unit.data.byteLength;
        }
        pts = avcSample.pts - this._initDTS;
        dts = avcSample.dts - this._initDTS;
        //logger.log('Video/PTS/DTS:' + pts + '/' + dts);
        // if not first AVC sample of video track, normalize PTS/DTS with previous sample value
        // and ensure that sample duration is positive
        if (lastDTS !== undefined) {
          ptsnorm = this._PTSNormalize(pts, lastDTS);
          dtsnorm = this._PTSNormalize(dts, lastDTS);
          mp4Sample.duration = (dtsnorm - lastDTS) / pes2mp4ScaleFactor;
          if (mp4Sample.duration < 0) {
            //logger.log('invalid sample duration at PTS/DTS::' + avcSample.pts + '/' + avcSample.dts + ':' + mp4Sample.duration);
            mp4Sample.duration = 0;
          }
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
              _utilsLogger.logger.log('Video/PTS/DTS adjusted:' + ptsnorm + '/' + dtsnorm);
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
        if (avcSample.key === true) {
          // the current sample is a key frame
          mp4Sample.flags.dependsOn = 2;
          mp4Sample.flags.isNonSync = 0;
        } else {
          mp4Sample.flags.dependsOn = 1;
          mp4Sample.flags.isNonSync = 1;
        }
        samples.push(mp4Sample);
        lastDTS = dtsnorm;
      }
      if (samples.length >= 2) {
        mp4Sample.duration = samples[samples.length - 2].duration;
      }
      // next AVC sample DTS should be equal to last sample DTS + last sample duration
      this.nextAvcDts = dtsnorm + mp4Sample.duration * pes2mp4ScaleFactor;
      track.len = 0;
      track.nbNalu = 0;
      if (navigator.userAgent.toLowerCase().indexOf('chrome') > -1) {
        // chrome workaround, mark first sample as being a Random Access Point to avoid sourcebuffer append issue
        // https://code.google.com/p/chromium/issues/detail?id=229412
        samples[0].flags.dependsOn = 2;
        samples[0].flags.isNonSync = 0;
      }
      track.samples = samples;
      moof = _remuxMp4Generator2['default'].moof(track.sequenceNumber++, firstDTS / pes2mp4ScaleFactor, track);
      track.samples = [];
      this.observer.trigger(_events2['default'].FRAG_PARSING_DATA, {
        moof: moof,
        mdat: mdat,
        startPTS: firstPTS / pesTimeScale,
        endPTS: (ptsnorm + pes2mp4ScaleFactor * mp4Sample.duration) / pesTimeScale,
        startDTS: firstDTS / pesTimeScale,
        endDTS: (dtsnorm + pes2mp4ScaleFactor * mp4Sample.duration) / pesTimeScale,
        type: 'video',
        nb: samples.length
      });
    }
  }, {
    key: 'remuxAudio',
    value: function remuxAudio(track, timeOffset, contiguous) {
      var view,
          i = 8,
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
          samples = [];
      /* concatenate the audio data and construct the mdat in place
        (need 8 more bytes to fill length and mdat type) */
      mdat = new Uint8Array(track.len + 8);
      view = new DataView(mdat.buffer);
      view.setUint32(0, mdat.byteLength);
      mdat.set(_remuxMp4Generator2['default'].types.mdat, 4);
      while (track.samples.length) {
        aacSample = track.samples.shift();
        unit = aacSample.unit;
        mdat.set(unit, i);
        i += unit.byteLength;
        pts = aacSample.pts - this._initDTS;
        dts = aacSample.dts - this._initDTS;
        //logger.log('Audio/PTS:' + aacSample.pts.toFixed(0));
        if (lastDTS !== undefined) {
          ptsnorm = this._PTSNormalize(pts, lastDTS);
          dtsnorm = this._PTSNormalize(dts, lastDTS);
          // we use DTS to compute sample duration, but we use PTS to compute initPTS which is used to sync audio and video
          mp4Sample.duration = (dtsnorm - lastDTS) / pes2mp4ScaleFactor;
          if (mp4Sample.duration < 0) {
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
              if (delta > 1) {
                _utilsLogger.logger.log(delta + ' ms hole between AAC samples detected,filling it');
                // set PTS to next PTS, and ensure PTS is greater or equal than last DTS
              } else if (delta < -1) {
                  _utilsLogger.logger.log(-delta + ' ms overlapping between AAC samples detected');
                }
              // set DTS to next DTS
              ptsnorm = dtsnorm = nextAacPts;
            }
          }
          // remember first PTS of our aacSamples, ensure value is positive
          firstPTS = Math.max(0, ptsnorm);
          firstDTS = Math.max(0, dtsnorm);
        }
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
      //set last sample duration as being identical to previous sample
      if (samples.length >= 2) {
        mp4Sample.duration = samples[samples.length - 2].duration;
      }
      // next aac sample PTS should be equal to last sample PTS + duration
      this.nextAacPts = ptsnorm + pes2mp4ScaleFactor * mp4Sample.duration;
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
        endDTS: (dtsnorm + pes2mp4ScaleFactor * mp4Sample.duration) / pesTimeScale,
        type: 'audio',
        nb: samples.length
      });
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

},{"../errors":14,"../events":15,"../remux/mp4-generator":21,"../utils/logger":24}],23:[function(require,module,exports){
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

},{}],24:[function(require,module,exports){
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

},{}],25:[function(require,module,exports){
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

},{}],26:[function(require,module,exports){
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
      if (this.loader && this.loader.readyState !== 4) {
        this.stats.aborted = true;
        this.loader.abort();
      }
      if (this.timeoutHandle) {
        window.clearTimeout(this.timeoutHandle);
      }
    }
  }, {
    key: 'load',
    value: function load(url, responseType, onSuccess, onError, onTimeout, timeout, maxRetry, retryDelay) {
      var onProgress = arguments.length <= 8 || arguments[8] === undefined ? null : arguments[8];
      var frag = arguments.length <= 9 || arguments[9] === undefined ? null : arguments[9];

      this.url = url;
      if (frag && !isNaN(frag.byteRangeStartOffset) && !isNaN(frag.byteRangeEndOffset)) {
        this.byteRange = frag.byteRangeStartOffset + '-' + frag.byteRangeEndOffset;
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
      var xhr = this.loader = new XMLHttpRequest();
      xhr.onload = this.loadsuccess.bind(this);
      xhr.onerror = this.loaderror.bind(this);
      xhr.onprogress = this.loadprogress.bind(this);
      xhr.open('GET', this.url, true);
      if (this.byteRange) {
        xhr.setRequestHeader('Range', 'bytes=' + this.byteRange);
      }
      xhr.responseType = this.responseType;
      this.stats.tfirst = null;
      this.stats.loaded = 0;
      if (this.xhrSetup) {
        this.xhrSetup(xhr);
      }
      xhr.send();
    }
  }, {
    key: 'loadsuccess',
    value: function loadsuccess(event) {
      window.clearTimeout(this.timeoutHandle);
      this.stats.tload = performance.now();
      this.onSuccess(event, this.stats);
    }
  }, {
    key: 'loaderror',
    value: function loaderror(event) {
      if (this.stats.retry < this.maxRetry) {
        _utilsLogger.logger.warn(event.type + ' while loading ' + this.url + ', retrying in ' + this.retryDelay + '...');
        this.destroy();
        window.setTimeout(this.loadInternal.bind(this), this.retryDelay);
        // exponential backoff
        this.retryDelay = Math.min(2 * this.retryDelay, 64000);
        this.stats.retry++;
      } else {
        window.clearTimeout(this.timeoutHandle);
        _utilsLogger.logger.error(event.type + ' while loading ' + this.url);
        this.onError(event);
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

},{"../utils/logger":24}]},{},[17])(17)
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwibm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwibm9kZV9tb2R1bGVzL3dlYndvcmtpZnkvaW5kZXguanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2NvbnRyb2xsZXIvYWJyLWNvbnRyb2xsZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2NvbnRyb2xsZXIvbGV2ZWwtY29udHJvbGxlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvY29udHJvbGxlci9tc2UtbWVkaWEtY29udHJvbGxlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvY3J5cHQvYWVzLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9jcnlwdC9hZXMxMjgtZGVjcnlwdGVyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9jcnlwdC9kZWNyeXB0ZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2RlbXV4L2RlbXV4ZXItaW5saW5lLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9kZW11eC9kZW11eGVyLXdvcmtlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvZGVtdXgvZGVtdXhlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvZGVtdXgvZXhwLWdvbG9tYi5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvZGVtdXgvdHNkZW11eGVyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9lcnJvcnMuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2V2ZW50cy5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvaGVscGVyL2xldmVsLWhlbHBlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvaGxzLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9sb2FkZXIvZnJhZ21lbnQtbG9hZGVyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9sb2FkZXIva2V5LWxvYWRlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvbG9hZGVyL3BsYXlsaXN0LWxvYWRlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvcmVtdXgvbXA0LWdlbmVyYXRvci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvcmVtdXgvbXA0LXJlbXV4ZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL3V0aWxzL2JpbmFyeS1zZWFyY2guanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL3V0aWxzL2xvZ2dlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvdXRpbHMvdXJsLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy91dGlscy94aHItbG9hZGVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3U0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNB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TSxHQUFHLENBQUM7VUFDVixLQUFLLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7OztBQUd2QixZQUFNLEdBQU0sS0FBSyxDQUFDLENBQUMsQ0FBQztVQUNwQixNQUFNLEdBQU0sS0FBSyxDQUFDLENBQUMsQ0FBQztVQUNwQixNQUFNLEdBQU0sS0FBSyxDQUFDLENBQUMsQ0FBQztVQUNwQixNQUFNLEdBQU0sS0FBSyxDQUFDLENBQUMsQ0FBQztVQUNwQixJQUFJLEdBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDOzs7QUFHakIsV0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxZQUFZLEVBQUUsQ0FBQyxFQUFFLEVBQUU7QUFDakMsVUFBRSxHQUFHLE1BQU0sQ0FBQyxDQUFDLEtBQUcsRUFBRSxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsSUFBRSxFQUFFLEdBQUcsR0FBRyxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsSUFBRSxDQUFDLEdBQUcsR0FBRyxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDL0YsVUFBRSxHQUFHLE1BQU0sQ0FBQyxDQUFDLEtBQUcsRUFBRSxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsSUFBRSxFQUFFLEdBQUcsR0FBRyxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsSUFBRSxDQUFDLEdBQUcsR0FBRyxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsR0FBRyxHQUFHLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ25HLFVBQUUsR0FBRyxNQUFNLENBQUMsQ0FBQyxLQUFHLEVBQUUsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLElBQUUsRUFBRSxHQUFHLEdBQUcsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLElBQUUsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLEdBQUcsR0FBRyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztBQUNuRyxTQUFDLEdBQUksTUFBTSxDQUFDLENBQUMsS0FBRyxFQUFFLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxJQUFFLEVBQUUsR0FBRyxHQUFHLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxJQUFFLENBQUMsR0FBRyxHQUFHLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDbkcsY0FBTSxJQUFJLENBQUMsQ0FBQztBQUNaLFNBQUMsR0FBQyxFQUFFLENBQUMsQUFBQyxDQUFDLEdBQUMsRUFBRSxDQUFDLEFBQUMsQ0FBQyxHQUFDLEVBQUUsQ0FBQztPQUNsQjs7O0FBR0QsV0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUU7QUFDdEIsV0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFBLEdBQUksTUFBTSxDQUFDLEdBQ3BCLElBQUksQ0FBQyxDQUFDLEtBQUcsRUFBRSxDQUFPLElBQUUsRUFBRSxHQUN0QixJQUFJLENBQUMsQ0FBQyxJQUFFLEVBQUUsR0FBSSxHQUFHLENBQUMsSUFBRSxFQUFFLEdBQ3RCLElBQUksQ0FBQyxDQUFDLElBQUUsQ0FBQyxHQUFLLEdBQUcsQ0FBQyxJQUFFLENBQUMsR0FDckIsSUFBSSxDQUFDLENBQUMsR0FBUSxHQUFHLENBQUMsR0FDbEIsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7QUFDaEIsVUFBRSxHQUFDLENBQUMsQ0FBQyxBQUFDLENBQUMsR0FBQyxDQUFDLENBQUMsQUFBQyxDQUFDLEdBQUMsQ0FBQyxDQUFDLEFBQUMsQ0FBQyxHQUFDLENBQUMsQ0FBQyxBQUFDLENBQUMsR0FBQyxFQUFFLENBQUM7T0FDM0I7S0FDRjs7O1NBcEtHLEdBQUc7OztxQkF1S00sR0FBRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7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RSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUk7QUFDdEIsVUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSTtBQUN0QixBQUFDLGVBQVMsSUFBSSxFQUFFLEdBQUksSUFBSSxFQUN4QixBQUFDLFNBQVMsSUFBSSxFQUFFLEdBQUksSUFBSSxFQUN4QixBQUFDLFNBQVMsSUFBSyxDQUFDLEdBQUksSUFBSSxFQUN4QixTQUFTLEdBQUcsSUFBSTtBQUNoQixBQUFDLGNBQVEsSUFBSSxFQUFFLEdBQUksSUFBSSxFQUN2QixBQUFDLFFBQVEsSUFBSSxFQUFFLEdBQUksSUFBSSxFQUN2QixBQUFDLFFBQVEsSUFBSyxDQUFDLEdBQUksSUFBSSxFQUN2QixRQUFRLEdBQUcsSUFBSTtBQUNmLFVBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUk7QUFDdEIsVUFBSSxFQUFFLElBQUk7QUFDVixVQUFJLEVBQUUsSUFBSTtBQUNWLFVBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUk7QUFDdEIsVUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSTtBQUN0QixVQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQ3RCLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFDdEIsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUN0QixJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQ3RCLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFDdEIsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUN0QixJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQ3RCLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFDdEIsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSTtBQUN0QixVQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQ3RCLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFDdEIsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUN0QixJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQ3RCLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFDdEIsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSTtBQUN0QixVQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJO09BQ3ZCLENBQUMsQ0FBQztBQUNMLGFBQU8sR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztLQUN2Qzs7O1dBRVUsY0FBQyxLQUFLLEVBQUU7QUFDakIsVUFDRSxPQUFPLEdBQUcsS0FBSyxDQUFDLE9BQU8sSUFBSSxFQUFFO1VBQzdCLEtBQUssR0FBRyxJQUFJLFVBQVUsQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQztVQUMxQyxLQUFLO1VBQ0wsQ0FBQyxDQUFDOzs7QUFHSixXQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7QUFDbkMsYUFBSyxHQUFHLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUM7QUFDekIsYUFBSyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxBQUFDLEtBQUssQ0FBQyxTQUFTLElBQUksQ0FBQyxHQUNqQyxLQUFLLENBQUMsWUFBWSxJQUFJLENBQUMsQUFBQyxHQUN4QixLQUFLLENBQUMsYUFBYSxBQUFDLENBQUM7T0FDekI7O0FBRUQsYUFBTyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO0tBQ3ZDOzs7V0FFVSxjQUFDLEtBQUssRUFBRTtBQUNqQixhQUFPLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0tBQzdMOzs7V0FFVSxjQUFDLEtBQUssRUFBRTtBQUNqQixVQUFJLEdBQUcsR0FBRyxFQUFFO1VBQUUsR0FBRyxHQUFHLEVBQUU7VUFBRSxDQUFDO1VBQUUsSUFBSTtVQUFFLEdBQUcsQ0FBQzs7O0FBR3JDLFdBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7QUFDckMsWUFBSSxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDcEIsV0FBRyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUM7QUFDdEIsV0FBRyxDQUFDLElBQUksQ0FBQyxBQUFDLEdBQUcsS0FBSyxDQUFDLEdBQUksSUFBSSxDQUFDLENBQUM7QUFDN0IsV0FBRyxDQUFDLElBQUksQ0FBRSxHQUFHLEdBQUcsSUFBSSxDQUFFLENBQUM7QUFDdkIsV0FBRyxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7T0FDcEQ7OztBQUdELFdBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7QUFDckMsWUFBSSxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDcEIsV0FBRyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUM7QUFDdEIsV0FBRyxDQUFDLElBQUksQ0FBQyxBQUFDLEdBQUcsS0FBSyxDQUFDLEdBQUksSUFBSSxDQUFDLENBQUM7QUFDN0IsV0FBRyxDQUFDLElBQUksQ0FBRSxHQUFHLEdBQUcsSUFBSSxDQUFFLENBQUM7QUFDdkIsV0FBRyxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7T0FDcEQ7O0FBRUQsVUFBSSxJQUFJLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLFVBQVUsQ0FBQyxDQUMxQyxJQUFJO0FBQ0osU0FBRyxDQUFDLENBQUMsQ0FBQztBQUNOLFNBQUcsQ0FBQyxDQUFDLENBQUM7QUFDTixTQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ04sVUFBSSxHQUFHLENBQUM7QUFDUixVQUFJLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxNQUFNO09BQ3hCLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUNuQixLQUFLLENBQUMsR0FBRyxDQUFDLE1BQU07T0FDakIsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7O0FBRXZCLGFBQU8sR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLFVBQVUsQ0FBQyxDQUMxQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUk7QUFDaEIsVUFBSSxFQUFFLElBQUksRUFBRSxJQUFJO0FBQ2hCLFVBQUksRUFBRSxJQUFJO0FBQ1YsVUFBSSxFQUFFLElBQUk7QUFDVixVQUFJLEVBQUUsSUFBSTtBQUNWLFVBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFDdEIsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUN0QixJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJO0FBQ3RCLEFBQUMsV0FBSyxDQUFDLEtBQUssSUFBSSxDQUFDLEdBQUksSUFBSSxFQUN6QixLQUFLLENBQUMsS0FBSyxHQUFHLElBQUk7QUFDbEIsQUFBQyxXQUFLLENBQUMsTUFBTSxJQUFJLENBQUMsR0FBSSxJQUFJLEVBQzFCLEtBQUssQ0FBQyxNQUFNLEdBQUcsSUFBSTtBQUNuQixVQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJO0FBQ3RCLFVBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUk7QUFDdEIsVUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSTtBQUN0QixVQUFJLEVBQUUsSUFBSTtBQUNWLFVBQUksRUFDSixJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQ3RCLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFDdEIsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUN0QixJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQ3RCLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFDdEIsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUN0QixJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQ3RCLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSTtBQUNoQixVQUFJLEVBQUUsSUFBSTtBQUNWLFVBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztBQUNWLFVBQUksRUFDSixHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksVUFB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QUFFLElBQUk7QUFDdEIsQUFBQyxXQUFLLENBQUMsRUFBRSxJQUFJLEVBQUUsR0FBSSxJQUFJLEVBQ3ZCLEFBQUMsS0FBSyxDQUFDLEVBQUUsSUFBSSxFQUFFLEdBQUksSUFBSSxFQUN2QixBQUFDLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQyxHQUFJLElBQUksRUFDdEIsS0FBSyxDQUFDLEVBQUUsR0FBRyxJQUFJO0FBQ2YsVUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSTtBQUNyQixXQUFLLENBQUMsUUFBUSxJQUFJLEVBQUUsRUFDckIsQUFBQyxLQUFLLENBQUMsUUFBUSxJQUFJLEVBQUUsR0FBSSxJQUFJLEVBQzdCLEFBQUMsS0FBSyxDQUFDLFFBQVEsSUFBSyxDQUFDLEdBQUksSUFBSSxFQUM3QixLQUFLLENBQUMsUUFBUSxHQUFHLElBQUk7QUFDckIsVUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUN0QixJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJO0FBQ3RCLFVBQUksRUFBRSxJQUFJO0FBQ1YsVUFBSSxFQUFFLElBQUk7QUFDVixVQUFJLEVBQUUsSUFBSTtBQUNWLFVBQUksRUFBRSxJQUFJO0FBQ1YsVUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUN0QixJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQ3RCLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFDdEIsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUN0QixJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQ3RCLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFDdEIsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUN0QixJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQ3RCLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElB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QUssRUFBRSxDQUFDO09BQ3BCLE1BQU07QUFDTCxjQUFNLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUN4Qyw0QkFBTyxLQUFLLENBQUksS0FBSyxDQUFDLElBQUksdUJBQWtCLElBQUksQ0FBQyxHQUFHLENBQUksQ0FBQztBQUN6RCxZQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO09BQ3JCO0tBQ0Y7OztXQUVVLHFCQUFDLEtBQUssRUFBRTtBQUNqQiwwQkFBTyxJQUFJLDRCQUEwQixJQUFJLENBQUMsR0FBRyxDQUFJLENBQUM7QUFDbEQsVUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0tBQ25DOzs7V0FFVyxzQkFBQyxLQUFLLEVBQUU7QUFDbEIsVUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQztBQUN2QixVQUFJLEtBQUssQ0FBQyxNQUFNLEtBQUssSUFBSSxFQUFFO0FBQ3pCLGFBQUssQ0FBQyxNQUFNLEdBQUcsV0FBVyxDQUFDLEdBQUcsRUFBRSxDQUFDO09BQ2xDO0FBQ0QsV0FBSyxDQUFDLE1BQU0sR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDO0FBQzVCLFVBQUksSUFBSSxDQUFDLFVBQVUsRUFBRTtBQUNuQixZQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQztPQUMvQjtLQUNGOzs7U0E5RkcsU0FBUzs7O3FCQWlHQSxTQUFTIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9XG4gICAgICB0aHJvdyBUeXBlRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuJyk7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG5cbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICB2YXIgbTtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2Uge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIWVtaXR0ZXIuX2V2ZW50cyB8fCAhZW1pdHRlci5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IDA7XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24oZW1pdHRlci5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSAxO1xuICBlbHNlXG4gICAgcmV0ID0gZW1pdHRlci5fZXZlbnRzW3R5cGVdLmxlbmd0aDtcbiAgcmV0dXJuIHJldDtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbiIsInZhciBidW5kbGVGbiA9IGFyZ3VtZW50c1szXTtcbnZhciBzb3VyY2VzID0gYXJndW1lbnRzWzRdO1xudmFyIGNhY2hlID0gYXJndW1lbnRzWzVdO1xuXG52YXIgc3RyaW5naWZ5ID0gSlNPTi5zdHJpbmdpZnk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGZuKSB7XG4gICAgdmFyIGtleXMgPSBbXTtcbiAgICB2YXIgd2tleTtcbiAgICB2YXIgY2FjaGVLZXlzID0gT2JqZWN0LmtleXMoY2FjaGUpO1xuICAgIFxuICAgIGZvciAodmFyIGkgPSAwLCBsID0gY2FjaGVLZXlzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICB2YXIga2V5ID0gY2FjaGVLZXlzW2ldO1xuICAgICAgICBpZiAoY2FjaGVba2V5XS5leHBvcnRzID09PSBmbikge1xuICAgICAgICAgICAgd2tleSA9IGtleTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxuICAgIFxuICAgIGlmICghd2tleSkge1xuICAgICAgICB3a2V5ID0gTWF0aC5mbG9vcihNYXRoLnBvdygxNiwgOCkgKiBNYXRoLnJhbmRvbSgpKS50b1N0cmluZygxNik7XG4gICAgICAgIHZhciB3Y2FjaGUgPSB7fTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBjYWNoZUtleXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIga2V5ID0gY2FjaGVLZXlzW2ldO1xuICAgICAgICAgICAgd2NhY2hlW2tleV0gPSBrZXk7XG4gICAgICAgIH1cbiAgICAgICAgc291cmNlc1t3a2V5XSA9IFtcbiAgICAgICAgICAgIEZ1bmN0aW9uKFsncmVxdWlyZScsJ21vZHVsZScsJ2V4cG9ydHMnXSwgJygnICsgZm4gKyAnKShzZWxmKScpLFxuICAgICAgICAgICAgd2NhY2hlXG4gICAgICAgIF07XG4gICAgfVxuICAgIHZhciBza2V5ID0gTWF0aC5mbG9vcihNYXRoLnBvdygxNiwgOCkgKiBNYXRoLnJhbmRvbSgpKS50b1N0cmluZygxNik7XG4gICAgXG4gICAgdmFyIHNjYWNoZSA9IHt9OyBzY2FjaGVbd2tleV0gPSB3a2V5O1xuICAgIHNvdXJjZXNbc2tleV0gPSBbXG4gICAgICAgIEZ1bmN0aW9uKFsncmVxdWlyZSddLCdyZXF1aXJlKCcgKyBzdHJpbmdpZnkod2tleSkgKyAnKShzZWxmKScpLFxuICAgICAgICBzY2FjaGVcbiAgICBdO1xuICAgIFxuICAgIHZhciBzcmMgPSAnKCcgKyBidW5kbGVGbiArICcpKHsnXG4gICAgICAgICsgT2JqZWN0LmtleXMoc291cmNlcykubWFwKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgIHJldHVybiBzdHJpbmdpZnkoa2V5KSArICc6WydcbiAgICAgICAgICAgICAgICArIHNvdXJjZXNba2V5XVswXVxuICAgICAgICAgICAgICAgICsgJywnICsgc3RyaW5naWZ5KHNvdXJjZXNba2V5XVsxXSkgKyAnXSdcbiAgICAgICAgICAgIDtcbiAgICAgICAgfSkuam9pbignLCcpXG4gICAgICAgICsgJ30se30sWycgKyBzdHJpbmdpZnkoc2tleSkgKyAnXSknXG4gICAgO1xuICAgIFxuICAgIHZhciBVUkwgPSB3aW5kb3cuVVJMIHx8IHdpbmRvdy53ZWJraXRVUkwgfHwgd2luZG93Lm1velVSTCB8fCB3aW5kb3cubXNVUkw7XG4gICAgXG4gICAgcmV0dXJuIG5ldyBXb3JrZXIoVVJMLmNyZWF0ZU9iamVjdFVSTChcbiAgICAgICAgbmV3IEJsb2IoW3NyY10sIHsgdHlwZTogJ3RleHQvamF2YXNjcmlwdCcgfSlcbiAgICApKTtcbn07XG4iLCIvKlxuICogc2ltcGxlIEFCUiBDb250cm9sbGVyXG4qL1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcblxuY2xhc3MgQWJyQ29udHJvbGxlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgdGhpcy5obHMgPSBobHM7XG4gICAgdGhpcy5sYXN0ZmV0Y2hsZXZlbCA9IDA7XG4gICAgdGhpcy5fYXV0b0xldmVsQ2FwcGluZyA9IC0xO1xuICAgIHRoaXMuX25leHRBdXRvTGV2ZWwgPSAtMTtcbiAgICB0aGlzLm9uZmxwID0gdGhpcy5vbkZyYWdtZW50TG9hZFByb2dyZXNzLmJpbmQodGhpcyk7XG4gICAgaGxzLm9uKEV2ZW50LkZSQUdfTE9BRF9QUk9HUkVTUywgdGhpcy5vbmZscCk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIHRoaXMuaGxzLm9mZihFdmVudC5GUkFHX0xPQURfUFJPR1JFU1MsIHRoaXMub25mbHApO1xuICB9XG5cbiAgb25GcmFnbWVudExvYWRQcm9ncmVzcyhldmVudCwgZGF0YSkge1xuICAgIHZhciBzdGF0cyA9IGRhdGEuc3RhdHM7XG4gICAgaWYgKHN0YXRzLmFib3J0ZWQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5sYXN0ZmV0Y2hkdXJhdGlvbiA9IChwZXJmb3JtYW5jZS5ub3coKSAtIHN0YXRzLnRyZXF1ZXN0KSAvIDEwMDA7XG4gICAgICB0aGlzLmxhc3RmZXRjaGxldmVsID0gZGF0YS5mcmFnLmxldmVsO1xuICAgICAgdGhpcy5sYXN0YncgPSAoc3RhdHMubG9hZGVkICogOCkgLyB0aGlzLmxhc3RmZXRjaGR1cmF0aW9uO1xuICAgICAgLy9jb25zb2xlLmxvZyhgZmV0Y2hEdXJhdGlvbjoke3RoaXMubGFzdGZldGNoZHVyYXRpb259LGJ3OiR7KHRoaXMubGFzdGJ3LzEwMDApLnRvRml4ZWQoMCl9LyR7c3RhdHMuYWJvcnRlZH1gKTtcbiAgICB9XG4gIH1cblxuICAvKiogUmV0dXJuIHRoZSBjYXBwaW5nL21heCBsZXZlbCB2YWx1ZSB0aGF0IGNvdWxkIGJlIHVzZWQgYnkgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBhbGdvcml0aG0gKiovXG4gIGdldCBhdXRvTGV2ZWxDYXBwaW5nKCkge1xuICAgIHJldHVybiB0aGlzLl9hdXRvTGV2ZWxDYXBwaW5nO1xuICB9XG5cbiAgLyoqIHNldCB0aGUgY2FwcGluZy9tYXggbGV2ZWwgdmFsdWUgdGhhdCBjb3VsZCBiZSB1c2VkIGJ5IGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24gYWxnb3JpdGhtICoqL1xuICBzZXQgYXV0b0xldmVsQ2FwcGluZyhuZXdMZXZlbCkge1xuICAgIHRoaXMuX2F1dG9MZXZlbENhcHBpbmcgPSBuZXdMZXZlbDtcbiAgfVxuXG4gIGdldCBuZXh0QXV0b0xldmVsKCkge1xuICAgIHZhciBsYXN0YncgPSB0aGlzLmxhc3RidywgaGxzID0gdGhpcy5obHMsYWRqdXN0ZWRidywgaSwgbWF4QXV0b0xldmVsO1xuICAgIGlmICh0aGlzLl9hdXRvTGV2ZWxDYXBwaW5nID09PSAtMSkge1xuICAgICAgbWF4QXV0b0xldmVsID0gaGxzLmxldmVscy5sZW5ndGggLSAxO1xuICAgIH0gZWxzZSB7XG4gICAgICBtYXhBdXRvTGV2ZWwgPSB0aGlzLl9hdXRvTGV2ZWxDYXBwaW5nO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9uZXh0QXV0b0xldmVsICE9PSAtMSkge1xuICAgICAgdmFyIG5leHRMZXZlbCA9IE1hdGgubWluKHRoaXMuX25leHRBdXRvTGV2ZWwsbWF4QXV0b0xldmVsKTtcbiAgICAgIGlmIChuZXh0TGV2ZWwgPT09IHRoaXMubGFzdGZldGNobGV2ZWwpIHtcbiAgICAgICAgdGhpcy5fbmV4dEF1dG9MZXZlbCA9IC0xO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIG5leHRMZXZlbDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBmb2xsb3cgYWxnb3JpdGhtIGNhcHR1cmVkIGZyb20gc3RhZ2VmcmlnaHQgOlxuICAgIC8vIGh0dHBzOi8vYW5kcm9pZC5nb29nbGVzb3VyY2UuY29tL3BsYXRmb3JtL2ZyYW1ld29ya3MvYXYvKy9tYXN0ZXIvbWVkaWEvbGlic3RhZ2VmcmlnaHQvaHR0cGxpdmUvTGl2ZVNlc3Npb24uY3BwXG4gICAgLy8gUGljayB0aGUgaGlnaGVzdCBiYW5kd2lkdGggc3RyZWFtIGJlbG93IG9yIGVxdWFsIHRvIGVzdGltYXRlZCBiYW5kd2lkdGguXG4gICAgZm9yIChpID0gMDsgaSA8PSBtYXhBdXRvTGV2ZWw7IGkrKykge1xuICAgIC8vIGNvbnNpZGVyIG9ubHkgODAlIG9mIHRoZSBhdmFpbGFibGUgYmFuZHdpZHRoLCBidXQgaWYgd2UgYXJlIHN3aXRjaGluZyB1cCxcbiAgICAvLyBiZSBldmVuIG1vcmUgY29uc2VydmF0aXZlICg3MCUpIHRvIGF2b2lkIG92ZXJlc3RpbWF0aW5nIGFuZCBpbW1lZGlhdGVseVxuICAgIC8vIHN3aXRjaGluZyBiYWNrLlxuICAgICAgaWYgKGkgPD0gdGhpcy5sYXN0ZmV0Y2hsZXZlbCkge1xuICAgICAgICBhZGp1c3RlZGJ3ID0gMC44ICogbGFzdGJ3O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYWRqdXN0ZWRidyA9IDAuNyAqIGxhc3RidztcbiAgICAgIH1cbiAgICAgIGlmIChhZGp1c3RlZGJ3IDwgaGxzLmxldmVsc1tpXS5iaXRyYXRlKSB7XG4gICAgICAgIHJldHVybiBNYXRoLm1heCgwLCBpIC0gMSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBpIC0gMTtcbiAgfVxuXG4gIHNldCBuZXh0QXV0b0xldmVsKG5leHRMZXZlbCkge1xuICAgIHRoaXMuX25leHRBdXRvTGV2ZWwgPSBuZXh0TGV2ZWw7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQWJyQ29udHJvbGxlcjtcblxuIiwiLypcbiAqIExldmVsIENvbnRyb2xsZXJcbiovXG5cbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcblxuY2xhc3MgTGV2ZWxDb250cm9sbGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMpIHtcbiAgICB0aGlzLmhscyA9IGhscztcbiAgICB0aGlzLm9ubWwgPSB0aGlzLm9uTWFuaWZlc3RMb2FkZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9ubGwgPSB0aGlzLm9uTGV2ZWxMb2FkZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uZXJyID0gdGhpcy5vbkVycm9yLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbnRpY2sgPSB0aGlzLnRpY2suYmluZCh0aGlzKTtcbiAgICBobHMub24oRXZlbnQuTUFOSUZFU1RfTE9BREVELCB0aGlzLm9ubWwpO1xuICAgIGhscy5vbihFdmVudC5MRVZFTF9MT0FERUQsIHRoaXMub25sbCk7XG4gICAgaGxzLm9uKEV2ZW50LkVSUk9SLCB0aGlzLm9uZXJyKTtcbiAgICB0aGlzLl9tYW51YWxMZXZlbCA9IHRoaXMuX2F1dG9MZXZlbENhcHBpbmcgPSAtMTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdmFyIGhscyA9IHRoaXMuaGxzO1xuICAgIGhscy5vZmYoRXZlbnQuTUFOSUZFU1RfTE9BREVELCB0aGlzLm9ubWwpO1xuICAgIGhscy5vZmYoRXZlbnQuTEVWRUxfTE9BREVELCB0aGlzLm9ubGwpO1xuICAgIGhscy5vZmYoRXZlbnQuRVJST1IsIHRoaXMub25lcnIpO1xuICAgIGlmICh0aGlzLnRpbWVyKSB7XG4gICAgIGNsZWFySW50ZXJ2YWwodGhpcy50aW1lcik7XG4gICAgfVxuICAgIHRoaXMuX21hbnVhbExldmVsID0gLTE7XG4gIH1cblxuICBvbk1hbmlmZXN0TG9hZGVkKGV2ZW50LCBkYXRhKSB7XG4gICAgdmFyIGxldmVsczAgPSBbXSwgbGV2ZWxzID0gW10sIGJpdHJhdGVTdGFydCwgaSwgYml0cmF0ZVNldCA9IHt9LCB2aWRlb0NvZGVjRm91bmQgPSBmYWxzZSwgYXVkaW9Db2RlY0ZvdW5kID0gZmFsc2U7XG5cbiAgICAvLyByZWdyb3VwIHJlZHVuZGFudCBsZXZlbCB0b2dldGhlclxuICAgIGRhdGEubGV2ZWxzLmZvckVhY2gobGV2ZWwgPT4ge1xuICAgICAgaWYobGV2ZWwudmlkZW9Db2RlYykge1xuICAgICAgICB2aWRlb0NvZGVjRm91bmQgPSB0cnVlO1xuICAgICAgfVxuICAgICAgaWYobGV2ZWwuYXVkaW9Db2RlYykge1xuICAgICAgICBhdWRpb0NvZGVjRm91bmQgPSB0cnVlO1xuICAgICAgfVxuICAgICAgdmFyIHJlZHVuZGFudExldmVsSWQgPSBiaXRyYXRlU2V0W2xldmVsLmJpdHJhdGVdO1xuICAgICAgaWYgKHJlZHVuZGFudExldmVsSWQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBiaXRyYXRlU2V0W2xldmVsLmJpdHJhdGVdID0gbGV2ZWxzLmxlbmd0aDtcbiAgICAgICAgbGV2ZWwudXJsID0gW2xldmVsLnVybF07XG4gICAgICAgIGxldmVsLnVybElkID0gMDtcbiAgICAgICAgbGV2ZWxzMC5wdXNoKGxldmVsKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxldmVsczBbcmVkdW5kYW50TGV2ZWxJZF0udXJsLnB1c2gobGV2ZWwudXJsKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIHJlbW92ZSBhdWRpby1vbmx5IGxldmVsIGlmIHdlIGFsc28gaGF2ZSBsZXZlbHMgd2l0aCBhdWRpbyt2aWRlbyBjb2RlY3Mgc2lnbmFsbGVkXG4gICAgaWYodmlkZW9Db2RlY0ZvdW5kICYmIGF1ZGlvQ29kZWNGb3VuZCkge1xuICAgICAgbGV2ZWxzMC5mb3JFYWNoKGxldmVsID0+IHtcbiAgICAgICAgaWYobGV2ZWwudmlkZW9Db2RlYykge1xuICAgICAgICAgIGxldmVscy5wdXNoKGxldmVsKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldmVscyA9IGxldmVsczA7XG4gICAgfVxuXG4gICAgLy8gc3RhcnQgYml0cmF0ZSBpcyB0aGUgZmlyc3QgYml0cmF0ZSBvZiB0aGUgbWFuaWZlc3RcbiAgICBiaXRyYXRlU3RhcnQgPSBsZXZlbHNbMF0uYml0cmF0ZTtcbiAgICAvLyBzb3J0IGxldmVsIG9uIGJpdHJhdGVcbiAgICBsZXZlbHMuc29ydChmdW5jdGlvbiAoYSwgYikge1xuICAgICAgcmV0dXJuIGEuYml0cmF0ZSAtIGIuYml0cmF0ZTtcbiAgICB9KTtcbiAgICB0aGlzLl9sZXZlbHMgPSBsZXZlbHM7XG4gICAgLy8gZmluZCBpbmRleCBvZiBmaXJzdCBsZXZlbCBpbiBzb3J0ZWQgbGV2ZWxzXG4gICAgZm9yIChpID0gMDsgaSA8IGxldmVscy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGxldmVsc1tpXS5iaXRyYXRlID09PSBiaXRyYXRlU3RhcnQpIHtcbiAgICAgICAgdGhpcy5fZmlyc3RMZXZlbCA9IGk7XG4gICAgICAgIGxvZ2dlci5sb2coYG1hbmlmZXN0IGxvYWRlZCwke2xldmVscy5sZW5ndGh9IGxldmVsKHMpIGZvdW5kLCBmaXJzdCBiaXRyYXRlOiR7Yml0cmF0ZVN0YXJ0fWApO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5NQU5JRkVTVF9QQVJTRUQsIHtsZXZlbHM6IHRoaXMuX2xldmVscywgZmlyc3RMZXZlbDogdGhpcy5fZmlyc3RMZXZlbCwgc3RhdHM6IGRhdGEuc3RhdHN9KTtcbiAgICByZXR1cm47XG4gIH1cblxuICBnZXQgbGV2ZWxzKCkge1xuICAgIHJldHVybiB0aGlzLl9sZXZlbHM7XG4gIH1cblxuICBnZXQgbGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2xldmVsO1xuICB9XG5cbiAgc2V0IGxldmVsKG5ld0xldmVsKSB7XG4gICAgaWYgKHRoaXMuX2xldmVsICE9PSBuZXdMZXZlbCB8fCB0aGlzLl9sZXZlbHNbbmV3TGV2ZWxdLmRldGFpbHMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5zZXRMZXZlbEludGVybmFsKG5ld0xldmVsKTtcbiAgICB9XG4gIH1cblxuIHNldExldmVsSW50ZXJuYWwobmV3TGV2ZWwpIHtcbiAgICAvLyBjaGVjayBpZiBsZXZlbCBpZHggaXMgdmFsaWRcbiAgICBpZiAobmV3TGV2ZWwgPj0gMCAmJiBuZXdMZXZlbCA8IHRoaXMuX2xldmVscy5sZW5ndGgpIHtcbiAgICAgIC8vIHN0b3BwaW5nIGxpdmUgcmVsb2FkaW5nIHRpbWVyIGlmIGFueVxuICAgICAgaWYgKHRoaXMudGltZXIpIHtcbiAgICAgICBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgICAgIHRoaXMudGltZXIgPSBudWxsO1xuICAgICAgfVxuICAgICAgdGhpcy5fbGV2ZWwgPSBuZXdMZXZlbDtcbiAgICAgIGxvZ2dlci5sb2coYHN3aXRjaGluZyB0byBsZXZlbCAke25ld0xldmVsfWApO1xuICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5MRVZFTF9TV0lUQ0gsIHtsZXZlbDogbmV3TGV2ZWx9KTtcbiAgICAgIHZhciBsZXZlbCA9IHRoaXMuX2xldmVsc1tuZXdMZXZlbF07XG4gICAgICAgLy8gY2hlY2sgaWYgd2UgbmVlZCB0byBsb2FkIHBsYXlsaXN0IGZvciB0aGlzIGxldmVsXG4gICAgICBpZiAobGV2ZWwuZGV0YWlscyA9PT0gdW5kZWZpbmVkIHx8IGxldmVsLmRldGFpbHMubGl2ZSA9PT0gdHJ1ZSkge1xuICAgICAgICAvLyBsZXZlbCBub3QgcmV0cmlldmVkIHlldCwgb3IgbGl2ZSBwbGF5bGlzdCB3ZSBuZWVkIHRvIChyZSlsb2FkIGl0XG4gICAgICAgIGxvZ2dlci5sb2coYChyZSlsb2FkaW5nIHBsYXlsaXN0IGZvciBsZXZlbCAke25ld0xldmVsfWApO1xuICAgICAgICB2YXIgdXJsSWQgPSBsZXZlbC51cmxJZDtcbiAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5MRVZFTF9MT0FESU5HLCB7dXJsOiBsZXZlbC51cmxbdXJsSWRdLCBsZXZlbDogbmV3TGV2ZWwsIGlkOiB1cmxJZH0pO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBpbnZhbGlkIGxldmVsIGlkIGdpdmVuLCB0cmlnZ2VyIGVycm9yXG4gICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZSA6IEVycm9yVHlwZXMuT1RIRVJfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5MRVZFTF9TV0lUQ0hfRVJST1IsIGxldmVsOiBuZXdMZXZlbCwgZmF0YWw6IGZhbHNlLCByZWFzb246ICdpbnZhbGlkIGxldmVsIGlkeCd9KTtcbiAgICB9XG4gfVxuXG4gIGdldCBtYW51YWxMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5fbWFudWFsTGV2ZWw7XG4gIH1cblxuICBzZXQgbWFudWFsTGV2ZWwobmV3TGV2ZWwpIHtcbiAgICB0aGlzLl9tYW51YWxMZXZlbCA9IG5ld0xldmVsO1xuICAgIGlmIChuZXdMZXZlbCAhPT0gLTEpIHtcbiAgICAgIHRoaXMubGV2ZWwgPSBuZXdMZXZlbDtcbiAgICB9XG4gIH1cblxuICBnZXQgZmlyc3RMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5fZmlyc3RMZXZlbDtcbiAgfVxuXG4gIHNldCBmaXJzdExldmVsKG5ld0xldmVsKSB7XG4gICAgdGhpcy5fZmlyc3RMZXZlbCA9IG5ld0xldmVsO1xuICB9XG5cbiAgZ2V0IHN0YXJ0TGV2ZWwoKSB7XG4gICAgaWYgKHRoaXMuX3N0YXJ0TGV2ZWwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2ZpcnN0TGV2ZWw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0aGlzLl9zdGFydExldmVsO1xuICAgIH1cbiAgfVxuXG4gIHNldCBzdGFydExldmVsKG5ld0xldmVsKSB7XG4gICAgdGhpcy5fc3RhcnRMZXZlbCA9IG5ld0xldmVsO1xuICB9XG5cbiAgb25FcnJvcihldmVudCwgZGF0YSkge1xuICAgIGlmKGRhdGEuZmF0YWwpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgZGV0YWlscyA9IGRhdGEuZGV0YWlscywgaGxzID0gdGhpcy5obHMsIGxldmVsSWQsIGxldmVsO1xuICAgIC8vIHRyeSB0byByZWNvdmVyIG5vdCBmYXRhbCBlcnJvcnNcbiAgICBzd2l0Y2goZGV0YWlscykge1xuICAgICAgY2FzZSBFcnJvckRldGFpbHMuRlJBR19MT0FEX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuRlJBR19MT0FEX1RJTUVPVVQ6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5GUkFHX0xPT1BfTE9BRElOR19FUlJPUjpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLktFWV9MT0FEX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuS0VZX0xPQURfVElNRU9VVDpcbiAgICAgICAgIGxldmVsSWQgPSBkYXRhLmZyYWcubGV2ZWw7XG4gICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkxFVkVMX0xPQURfRVJST1I6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5MRVZFTF9MT0FEX1RJTUVPVVQ6XG4gICAgICAgIGxldmVsSWQgPSBkYXRhLmxldmVsO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICAvKiB0cnkgdG8gc3dpdGNoIHRvIGEgcmVkdW5kYW50IHN0cmVhbSBpZiBhbnkgYXZhaWxhYmxlLlxuICAgICAqIGlmIG5vIHJlZHVuZGFudCBzdHJlYW0gYXZhaWxhYmxlLCBlbWVyZ2VuY3kgc3dpdGNoIGRvd24gKGlmIGluIGF1dG8gbW9kZSBhbmQgY3VycmVudCBsZXZlbCBub3QgMClcbiAgICAgKiBvdGhlcndpc2UsIHdlIGNhbm5vdCByZWNvdmVyIHRoaXMgbmV0d29yayBlcnJvciAuLi4uXG4gICAgICovXG4gICAgaWYgKGxldmVsSWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgbGV2ZWwgPSB0aGlzLl9sZXZlbHNbbGV2ZWxJZF07XG4gICAgICBpZiAobGV2ZWwudXJsSWQgPCAobGV2ZWwudXJsLmxlbmd0aCAtIDEpKSB7XG4gICAgICAgIGxldmVsLnVybElkKys7XG4gICAgICAgIGxldmVsLmRldGFpbHMgPSB1bmRlZmluZWQ7XG4gICAgICAgIGxvZ2dlci53YXJuKGBsZXZlbCBjb250cm9sbGVyLCR7ZGV0YWlsc30gZm9yIGxldmVsICR7bGV2ZWxJZH06IHN3aXRjaGluZyB0byByZWR1bmRhbnQgc3RyZWFtIGlkICR7bGV2ZWwudXJsSWR9YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyB3ZSBjb3VsZCB0cnkgdG8gcmVjb3ZlciBpZiBpbiBhdXRvIG1vZGUgYW5kIGN1cnJlbnQgbGV2ZWwgbm90IGxvd2VzdCBsZXZlbCAoMClcbiAgICAgICAgbGV0IHJlY292ZXJhYmxlID0gKCh0aGlzLl9tYW51YWxMZXZlbCA9PT0gLTEpICYmIGxldmVsSWQpO1xuICAgICAgICBpZiAocmVjb3ZlcmFibGUpIHtcbiAgICAgICAgICBsb2dnZXIud2FybihgbGV2ZWwgY29udHJvbGxlciwke2RldGFpbHN9OiBlbWVyZ2VuY3kgc3dpdGNoLWRvd24gZm9yIG5leHQgZnJhZ21lbnRgKTtcbiAgICAgICAgICBobHMuYWJyQ29udHJvbGxlci5uZXh0QXV0b0xldmVsID0gMDtcbiAgICAgICAgfSBlbHNlIGlmKGxldmVsICYmIGxldmVsLmRldGFpbHMgJiYgbGV2ZWwuZGV0YWlscy5saXZlKSB7XG4gICAgICAgICAgbG9nZ2VyLndhcm4oYGxldmVsIGNvbnRyb2xsZXIsJHtkZXRhaWxzfSBvbiBsaXZlIHN0cmVhbSwgZGlzY2FyZGApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGxvZ2dlci5lcnJvcihgY2Fubm90IHJlY292ZXIgJHtkZXRhaWxzfSBlcnJvcmApO1xuICAgICAgICAgIHRoaXMuX2xldmVsID0gdW5kZWZpbmVkO1xuICAgICAgICAgIC8vIHN0b3BwaW5nIGxpdmUgcmVsb2FkaW5nIHRpbWVyIGlmIGFueVxuICAgICAgICAgIGlmICh0aGlzLnRpbWVyKSB7XG4gICAgICAgICAgICBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgICAgICAgICAgdGhpcy50aW1lciA9IG51bGw7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIHJlZGlzcGF0Y2ggc2FtZSBlcnJvciBidXQgd2l0aCBmYXRhbCBzZXQgdG8gdHJ1ZVxuICAgICAgICAgIGRhdGEuZmF0YWwgPSB0cnVlO1xuICAgICAgICAgIGhscy50cmlnZ2VyKGV2ZW50LCBkYXRhKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIG9uTGV2ZWxMb2FkZWQoZXZlbnQsIGRhdGEpIHtcbiAgICAvLyBjaGVjayBpZiBjdXJyZW50IHBsYXlsaXN0IGlzIGEgbGl2ZSBwbGF5bGlzdFxuICAgIGlmIChkYXRhLmRldGFpbHMubGl2ZSAmJiAhdGhpcy50aW1lcikge1xuICAgICAgLy8gaWYgbGl2ZSBwbGF5bGlzdCB3ZSB3aWxsIGhhdmUgdG8gcmVsb2FkIGl0IHBlcmlvZGljYWxseVxuICAgICAgLy8gc2V0IHJlbG9hZCBwZXJpb2QgdG8gcGxheWxpc3QgdGFyZ2V0IGR1cmF0aW9uXG4gICAgICB0aGlzLnRpbWVyID0gc2V0SW50ZXJ2YWwodGhpcy5vbnRpY2ssIDEwMDAgKiBkYXRhLmRldGFpbHMudGFyZ2V0ZHVyYXRpb24pO1xuICAgIH1cbiAgICBpZiAoIWRhdGEuZGV0YWlscy5saXZlICYmIHRoaXMudGltZXIpIHtcbiAgICAgIC8vIHBsYXlsaXN0IGlzIG5vdCBsaXZlIGFuZCB0aW1lciBpcyBhcm1lZCA6IHN0b3BwaW5nIGl0XG4gICAgICBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgICAgdGhpcy50aW1lciA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgdGljaygpIHtcbiAgICB2YXIgbGV2ZWxJZCA9IHRoaXMuX2xldmVsO1xuICAgIGlmIChsZXZlbElkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHZhciBsZXZlbCA9IHRoaXMuX2xldmVsc1tsZXZlbElkXSwgdXJsSWQgPSBsZXZlbC51cmxJZDtcbiAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuTEVWRUxfTE9BRElORywge3VybDogbGV2ZWwudXJsW3VybElkXSwgbGV2ZWw6IGxldmVsSWQsIGlkOiB1cmxJZH0pO1xuICAgIH1cbiAgfVxuXG4gIG5leHRMb2FkTGV2ZWwoKSB7XG4gICAgaWYgKHRoaXMuX21hbnVhbExldmVsICE9PSAtMSkge1xuICAgICAgcmV0dXJuIHRoaXMuX21hbnVhbExldmVsO1xuICAgIH0gZWxzZSB7XG4gICAgIHJldHVybiB0aGlzLmhscy5hYnJDb250cm9sbGVyLm5leHRBdXRvTGV2ZWw7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IExldmVsQ29udHJvbGxlcjtcblxuIiwiLypcbiAqIE1TRSBNZWRpYSBDb250cm9sbGVyXG4qL1xuXG5pbXBvcnQgRGVtdXhlciBmcm9tICcuLi9kZW11eC9kZW11eGVyJztcbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQgQmluYXJ5U2VhcmNoIGZyb20gJy4uL3V0aWxzL2JpbmFyeS1zZWFyY2gnO1xuaW1wb3J0IExldmVsSGVscGVyIGZyb20gJy4uL2hlbHBlci9sZXZlbC1oZWxwZXInO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5cbmNvbnN0IFN0YXRlID0ge1xuICBFUlJPUiA6IC0yLFxuICBTVEFSVElORyA6IC0xLFxuICBJRExFIDogMCxcbiAgS0VZX0xPQURJTkcgOiAxLFxuICBGUkFHX0xPQURJTkcgOiAyLFxuICBXQUlUSU5HX0xFVkVMIDogMyxcbiAgUEFSU0lORyA6IDQsXG4gIFBBUlNFRCA6IDUsXG4gIEFQUEVORElORyA6IDYsXG4gIEJVRkZFUl9GTFVTSElORyA6IDdcbn07XG5cbmNsYXNzIE1TRU1lZGlhQ29udHJvbGxlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgdGhpcy5jb25maWcgPSBobHMuY29uZmlnO1xuICAgIHRoaXMuaGxzID0gaGxzO1xuICAgIC8vIFNvdXJjZSBCdWZmZXIgbGlzdGVuZXJzXG4gICAgdGhpcy5vbnNidWUgPSB0aGlzLm9uU0JVcGRhdGVFbmQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uc2JlICA9IHRoaXMub25TQlVwZGF0ZUVycm9yLmJpbmQodGhpcyk7XG4gICAgLy8gaW50ZXJuYWwgbGlzdGVuZXJzXG4gICAgdGhpcy5vbm1lZGlhYXR0MCA9IHRoaXMub25NZWRpYUF0dGFjaGluZy5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25tZWRpYWRldDAgPSB0aGlzLm9uTWVkaWFEZXRhY2hpbmcuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9ubXAgPSB0aGlzLm9uTWFuaWZlc3RQYXJzZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9ubGwgPSB0aGlzLm9uTGV2ZWxMb2FkZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uZmwgPSB0aGlzLm9uRnJhZ0xvYWRlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25rbCA9IHRoaXMub25LZXlMb2FkZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uaXMgPSB0aGlzLm9uSW5pdFNlZ21lbnQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uZnBnID0gdGhpcy5vbkZyYWdQYXJzaW5nLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmZwID0gdGhpcy5vbkZyYWdQYXJzZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uZXJyID0gdGhpcy5vbkVycm9yLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbnRpY2sgPSB0aGlzLnRpY2suYmluZCh0aGlzKTtcbiAgICBobHMub24oRXZlbnQuTUVESUFfQVRUQUNISU5HLCB0aGlzLm9ubWVkaWFhdHQwKTtcbiAgICBobHMub24oRXZlbnQuTUVESUFfREVUQUNISU5HLCB0aGlzLm9ubWVkaWFkZXQwKTtcbiAgICBobHMub24oRXZlbnQuTUFOSUZFU1RfUEFSU0VELCB0aGlzLm9ubXApO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLnN0b3AoKTtcbiAgICB2YXIgaGxzID0gdGhpcy5obHM7XG4gICAgaGxzLm9mZihFdmVudC5NRURJQV9BVFRBQ0hJTkcsIHRoaXMub25tZWRpYWF0dDApO1xuICAgIGhscy5vZmYoRXZlbnQuTUVESUFfREVUQUNISU5HLCB0aGlzLm9ubWVkaWFkZXQwKTtcbiAgICBobHMub2ZmKEV2ZW50Lk1BTklGRVNUX1BBUlNFRCwgdGhpcy5vbm1wKTtcbiAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgfVxuXG4gIHN0YXJ0TG9hZCgpIHtcbiAgICBpZiAodGhpcy5sZXZlbHMgJiYgdGhpcy5tZWRpYSkge1xuICAgICAgdGhpcy5zdGFydEludGVybmFsKCk7XG4gICAgICBpZiAodGhpcy5sYXN0Q3VycmVudFRpbWUpIHtcbiAgICAgICAgbG9nZ2VyLmxvZyhgc2Vla2luZyBAICR7dGhpcy5sYXN0Q3VycmVudFRpbWV9YCk7XG4gICAgICAgIGlmICghdGhpcy5sYXN0UGF1c2VkKSB7XG4gICAgICAgICAgbG9nZ2VyLmxvZygncmVzdW1pbmcgdmlkZW8nKTtcbiAgICAgICAgICB0aGlzLm1lZGlhLnBsYXkoKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMubGFzdEN1cnJlbnRUaW1lID0gMDtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLlNUQVJUSU5HO1xuICAgICAgfVxuICAgICAgdGhpcy5uZXh0TG9hZFBvc2l0aW9uID0gdGhpcy5zdGFydFBvc2l0aW9uID0gdGhpcy5sYXN0Q3VycmVudFRpbWU7XG4gICAgICB0aGlzLnRpY2soKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbG9nZ2VyLndhcm4oJ2Nhbm5vdCBzdGFydCBsb2FkaW5nIGFzIGVpdGhlciBtYW5pZmVzdCBub3QgcGFyc2VkIG9yIHZpZGVvIG5vdCBhdHRhY2hlZCcpO1xuICAgIH1cbiAgfVxuXG4gIHN0YXJ0SW50ZXJuYWwoKSB7XG4gICAgdmFyIGhscyA9IHRoaXMuaGxzO1xuICAgIHRoaXMuc3RvcCgpO1xuICAgIHRoaXMuZGVtdXhlciA9IG5ldyBEZW11eGVyKGhscyk7XG4gICAgdGhpcy50aW1lciA9IHNldEludGVydmFsKHRoaXMub250aWNrLCAxMDApO1xuICAgIHRoaXMubGV2ZWwgPSAtMTtcbiAgICBobHMub24oRXZlbnQuRlJBR19MT0FERUQsIHRoaXMub25mbCk7XG4gICAgaGxzLm9uKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQsIHRoaXMub25pcyk7XG4gICAgaGxzLm9uKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLCB0aGlzLm9uZnBnKTtcbiAgICBobHMub24oRXZlbnQuRlJBR19QQVJTRUQsIHRoaXMub25mcCk7XG4gICAgaGxzLm9uKEV2ZW50LkVSUk9SLCB0aGlzLm9uZXJyKTtcbiAgICBobHMub24oRXZlbnQuTEVWRUxfTE9BREVELCB0aGlzLm9ubGwpO1xuICAgIGhscy5vbihFdmVudC5LRVlfTE9BREVELCB0aGlzLm9ua2wpO1xuICB9XG5cbiAgc3RvcCgpIHtcbiAgICB0aGlzLm1wNHNlZ21lbnRzID0gW107XG4gICAgdGhpcy5mbHVzaFJhbmdlID0gW107XG4gICAgdGhpcy5idWZmZXJSYW5nZSA9IFtdO1xuICAgIHZhciBmcmFnID0gdGhpcy5mcmFnQ3VycmVudDtcbiAgICBpZiAoZnJhZykge1xuICAgICAgaWYgKGZyYWcubG9hZGVyKSB7XG4gICAgICAgIGZyYWcubG9hZGVyLmFib3J0KCk7XG4gICAgICB9XG4gICAgICB0aGlzLmZyYWdDdXJyZW50ID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5mcmFnUHJldmlvdXMgPSBudWxsO1xuICAgIGlmICh0aGlzLnNvdXJjZUJ1ZmZlcikge1xuICAgICAgZm9yKHZhciB0eXBlIGluIHRoaXMuc291cmNlQnVmZmVyKSB7XG4gICAgICAgIHZhciBzYiA9IHRoaXMuc291cmNlQnVmZmVyW3R5cGVdO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHRoaXMubWVkaWFTb3VyY2UucmVtb3ZlU291cmNlQnVmZmVyKHNiKTtcbiAgICAgICAgICBzYi5yZW1vdmVFdmVudExpc3RlbmVyKCd1cGRhdGVlbmQnLCB0aGlzLm9uc2J1ZSk7XG4gICAgICAgICAgc2IucmVtb3ZlRXZlbnRMaXN0ZW5lcignZXJyb3InLCB0aGlzLm9uc2JlKTtcbiAgICAgICAgfSBjYXRjaChlcnIpIHtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5zb3VyY2VCdWZmZXIgPSBudWxsO1xuICAgIH1cbiAgICBpZiAodGhpcy50aW1lcikge1xuICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnRpbWVyKTtcbiAgICAgIHRoaXMudGltZXIgPSBudWxsO1xuICAgIH1cbiAgICBpZiAodGhpcy5kZW11eGVyKSB7XG4gICAgICB0aGlzLmRlbXV4ZXIuZGVzdHJveSgpO1xuICAgICAgdGhpcy5kZW11eGVyID0gbnVsbDtcbiAgICB9XG4gICAgdmFyIGhscyA9IHRoaXMuaGxzO1xuICAgIGhscy5vZmYoRXZlbnQuRlJBR19MT0FERUQsIHRoaXMub25mbCk7XG4gICAgaGxzLm9mZihFdmVudC5GUkFHX1BBUlNFRCwgdGhpcy5vbmZwKTtcbiAgICBobHMub2ZmKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLCB0aGlzLm9uZnBnKTtcbiAgICBobHMub2ZmKEV2ZW50LkxFVkVMX0xPQURFRCwgdGhpcy5vbmxsKTtcbiAgICBobHMub2ZmKEV2ZW50LktFWV9MT0FERUQsIHRoaXMub25rbCk7XG4gICAgaGxzLm9mZihFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULCB0aGlzLm9uaXMpO1xuICAgIGhscy5vZmYoRXZlbnQuRVJST1IsIHRoaXMub25lcnIpO1xuICB9XG5cbiAgdGljaygpIHtcbiAgICB2YXIgcG9zLCBsZXZlbCwgbGV2ZWxEZXRhaWxzLCBobHMgPSB0aGlzLmhscztcbiAgICBzd2l0Y2godGhpcy5zdGF0ZSkge1xuICAgICAgY2FzZSBTdGF0ZS5FUlJPUjpcbiAgICAgICAgLy9kb24ndCBkbyBhbnl0aGluZyBpbiBlcnJvciBzdGF0ZSB0byBhdm9pZCBicmVha2luZyBmdXJ0aGVyIC4uLlxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgU3RhdGUuU1RBUlRJTkc6XG4gICAgICAgIC8vIGRldGVybWluZSBsb2FkIGxldmVsXG4gICAgICAgIHRoaXMuc3RhcnRMZXZlbCA9IGhscy5zdGFydExldmVsO1xuICAgICAgICBpZiAodGhpcy5zdGFydExldmVsID09PSAtMSkge1xuICAgICAgICAgIC8vIC0xIDogZ3Vlc3Mgc3RhcnQgTGV2ZWwgYnkgZG9pbmcgYSBiaXRyYXRlIHRlc3QgYnkgbG9hZGluZyBmaXJzdCBmcmFnbWVudCBvZiBsb3dlc3QgcXVhbGl0eSBsZXZlbFxuICAgICAgICAgIHRoaXMuc3RhcnRMZXZlbCA9IDA7XG4gICAgICAgICAgdGhpcy5mcmFnQml0cmF0ZVRlc3QgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIC8vIHNldCBuZXcgbGV2ZWwgdG8gcGxheWxpc3QgbG9hZGVyIDogdGhpcyB3aWxsIHRyaWdnZXIgc3RhcnQgbGV2ZWwgbG9hZFxuICAgICAgICB0aGlzLmxldmVsID0gaGxzLm5leHRMb2FkTGV2ZWwgPSB0aGlzLnN0YXJ0TGV2ZWw7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5XQUlUSU5HX0xFVkVMO1xuICAgICAgICB0aGlzLmxvYWRlZG1ldGFkYXRhID0gZmFsc2U7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBTdGF0ZS5JRExFOlxuICAgICAgICAvLyBpZiB2aWRlbyBkZXRhY2hlZCBvciB1bmJvdW5kIGV4aXQgbG9vcFxuICAgICAgICBpZiAoIXRoaXMubWVkaWEpIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICAvLyBkZXRlcm1pbmUgbmV4dCBjYW5kaWRhdGUgZnJhZ21lbnQgdG8gYmUgbG9hZGVkLCBiYXNlZCBvbiBjdXJyZW50IHBvc2l0aW9uIGFuZFxuICAgICAgICAvLyAgZW5kIG9mIGJ1ZmZlciBwb3NpdGlvblxuICAgICAgICAvLyAgZW5zdXJlIDYwcyBvZiBidWZmZXIgdXBmcm9udFxuICAgICAgICAvLyBpZiB3ZSBoYXZlIG5vdCB5ZXQgbG9hZGVkIGFueSBmcmFnbWVudCwgc3RhcnQgbG9hZGluZyBmcm9tIHN0YXJ0IHBvc2l0aW9uXG4gICAgICAgIGlmICh0aGlzLmxvYWRlZG1ldGFkYXRhKSB7XG4gICAgICAgICAgcG9zID0gdGhpcy5tZWRpYS5jdXJyZW50VGltZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwb3MgPSB0aGlzLm5leHRMb2FkUG9zaXRpb247XG4gICAgICAgIH1cbiAgICAgICAgLy8gZGV0ZXJtaW5lIG5leHQgbG9hZCBsZXZlbFxuICAgICAgICBpZiAodGhpcy5zdGFydEZyYWdtZW50UmVxdWVzdGVkID09PSBmYWxzZSkge1xuICAgICAgICAgIGxldmVsID0gdGhpcy5zdGFydExldmVsO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIHdlIGFyZSBub3QgYXQgcGxheWJhY2sgc3RhcnQsIGdldCBuZXh0IGxvYWQgbGV2ZWwgZnJvbSBsZXZlbCBDb250cm9sbGVyXG4gICAgICAgICAgbGV2ZWwgPSBobHMubmV4dExvYWRMZXZlbDtcbiAgICAgICAgfVxuICAgICAgICB2YXIgYnVmZmVySW5mbyA9IHRoaXMuYnVmZmVySW5mbyhwb3MsMC4zKSxcbiAgICAgICAgICAgIGJ1ZmZlckxlbiA9IGJ1ZmZlckluZm8ubGVuLFxuICAgICAgICAgICAgYnVmZmVyRW5kID0gYnVmZmVySW5mby5lbmQsXG4gICAgICAgICAgICBmcmFnUHJldmlvdXMgPSB0aGlzLmZyYWdQcmV2aW91cyxcbiAgICAgICAgICAgIG1heEJ1ZkxlbjtcbiAgICAgICAgLy8gY29tcHV0ZSBtYXggQnVmZmVyIExlbmd0aCB0aGF0IHdlIGNvdWxkIGdldCBmcm9tIHRoaXMgbG9hZCBsZXZlbCwgYmFzZWQgb24gbGV2ZWwgYml0cmF0ZS4gZG9uJ3QgYnVmZmVyIG1vcmUgdGhhbiA2MCBNQiBhbmQgbW9yZSB0aGFuIDMwc1xuICAgICAgICBpZiAoKHRoaXMubGV2ZWxzW2xldmVsXSkuaGFzT3duUHJvcGVydHkoJ2JpdHJhdGUnKSkge1xuICAgICAgICAgIG1heEJ1ZkxlbiA9IE1hdGgubWF4KDggKiB0aGlzLmNvbmZpZy5tYXhCdWZmZXJTaXplIC8gdGhpcy5sZXZlbHNbbGV2ZWxdLmJpdHJhdGUsIHRoaXMuY29uZmlnLm1heEJ1ZmZlckxlbmd0aCk7XG4gICAgICAgICAgbWF4QnVmTGVuID0gTWF0aC5taW4obWF4QnVmTGVuLCB0aGlzLmNvbmZpZy5tYXhNYXhCdWZmZXJMZW5ndGgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG1heEJ1ZkxlbiA9IHRoaXMuY29uZmlnLm1heEJ1ZmZlckxlbmd0aDtcbiAgICAgICAgfVxuICAgICAgICAvLyBpZiBidWZmZXIgbGVuZ3RoIGlzIGxlc3MgdGhhbiBtYXhCdWZMZW4gdHJ5IHRvIGxvYWQgYSBuZXcgZnJhZ21lbnRcbiAgICAgICAgaWYgKGJ1ZmZlckxlbiA8IG1heEJ1Zkxlbikge1xuICAgICAgICAgIC8vIHNldCBuZXh0IGxvYWQgbGV2ZWwgOiB0aGlzIHdpbGwgdHJpZ2dlciBhIHBsYXlsaXN0IGxvYWQgaWYgbmVlZGVkXG4gICAgICAgICAgaGxzLm5leHRMb2FkTGV2ZWwgPSBsZXZlbDtcbiAgICAgICAgICB0aGlzLmxldmVsID0gbGV2ZWw7XG4gICAgICAgICAgbGV2ZWxEZXRhaWxzID0gdGhpcy5sZXZlbHNbbGV2ZWxdLmRldGFpbHM7XG4gICAgICAgICAgLy8gaWYgbGV2ZWwgaW5mbyBub3QgcmV0cmlldmVkIHlldCwgc3dpdGNoIHN0YXRlIGFuZCB3YWl0IGZvciBsZXZlbCByZXRyaWV2YWxcbiAgICAgICAgICBpZiAodHlwZW9mIGxldmVsRGV0YWlscyA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5XQUlUSU5HX0xFVkVMO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIGZpbmQgZnJhZ21lbnQgaW5kZXgsIGNvbnRpZ3VvdXMgd2l0aCBlbmQgb2YgYnVmZmVyIHBvc2l0aW9uXG4gICAgICAgICAgbGV0IGZyYWdtZW50cyA9IGxldmVsRGV0YWlscy5mcmFnbWVudHMsXG4gICAgICAgICAgICAgIGZyYWdMZW4gPSBmcmFnbWVudHMubGVuZ3RoLFxuICAgICAgICAgICAgICBzdGFydCA9IGZyYWdtZW50c1swXS5zdGFydCxcbiAgICAgICAgICAgICAgZW5kID0gZnJhZ21lbnRzW2ZyYWdMZW4tMV0uc3RhcnQgKyBmcmFnbWVudHNbZnJhZ0xlbi0xXS5kdXJhdGlvbixcbiAgICAgICAgICAgICAgZnJhZztcblxuICAgICAgICAgICAgLy8gaW4gY2FzZSBvZiBsaXZlIHBsYXlsaXN0IHdlIG5lZWQgdG8gZW5zdXJlIHRoYXQgcmVxdWVzdGVkIHBvc2l0aW9uIGlzIG5vdCBsb2NhdGVkIGJlZm9yZSBwbGF5bGlzdCBzdGFydFxuICAgICAgICAgIGlmIChsZXZlbERldGFpbHMubGl2ZSkge1xuICAgICAgICAgICAgLy8gY2hlY2sgaWYgcmVxdWVzdGVkIHBvc2l0aW9uIGlzIHdpdGhpbiBzZWVrYWJsZSBib3VuZGFyaWVzIDpcbiAgICAgICAgICAgIC8vbG9nZ2VyLmxvZyhgc3RhcnQvcG9zL2J1ZkVuZC9zZWVraW5nOiR7c3RhcnQudG9GaXhlZCgzKX0vJHtwb3MudG9GaXhlZCgzKX0vJHtidWZmZXJFbmQudG9GaXhlZCgzKX0vJHt0aGlzLm1lZGlhLnNlZWtpbmd9YCk7XG4gICAgICAgICAgICBpZiAoYnVmZmVyRW5kIDwgTWF0aC5tYXgoc3RhcnQsZW5kLXRoaXMuY29uZmlnLmxpdmVNYXhMYXRlbmN5RHVyYXRpb25Db3VudCpsZXZlbERldGFpbHMudGFyZ2V0ZHVyYXRpb24pKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zZWVrQWZ0ZXJCdWZmZXJlZCA9IHN0YXJ0ICsgTWF0aC5tYXgoMCwgbGV2ZWxEZXRhaWxzLnRvdGFsZHVyYXRpb24gLSB0aGlzLmNvbmZpZy5saXZlU3luY0R1cmF0aW9uQ291bnQgKiBsZXZlbERldGFpbHMudGFyZ2V0ZHVyYXRpb24pO1xuICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYGJ1ZmZlciBlbmQ6ICR7YnVmZmVyRW5kfSBpcyBsb2NhdGVkIHRvbyBmYXIgZnJvbSB0aGUgZW5kIG9mIGxpdmUgc2xpZGluZyBwbGF5bGlzdCwgbWVkaWEgcG9zaXRpb24gd2lsbCBiZSByZXNldGVkIHRvOiAke3RoaXMuc2Vla0FmdGVyQnVmZmVyZWQudG9GaXhlZCgzKX1gKTtcbiAgICAgICAgICAgICAgICBidWZmZXJFbmQgPSB0aGlzLnNlZWtBZnRlckJ1ZmZlcmVkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRoaXMuc3RhcnRGcmFnbWVudFJlcXVlc3RlZCAmJiAhbGV2ZWxEZXRhaWxzLlBUU0tub3duKSB7XG4gICAgICAgICAgICAgIC8qIHdlIGFyZSBzd2l0Y2hpbmcgbGV2ZWwgb24gbGl2ZSBwbGF5bGlzdCwgYnV0IHdlIGRvbid0IGhhdmUgYW55IFBUUyBpbmZvIGZvciB0aGF0IHF1YWxpdHkgbGV2ZWwgLi4uXG4gICAgICAgICAgICAgICAgIHRyeSB0byBsb2FkIGZyYWcgbWF0Y2hpbmcgd2l0aCBuZXh0IFNOLlxuICAgICAgICAgICAgICAgICBldmVuIGlmIFNOIGFyZSBub3Qgc3luY2hyb25pemVkIGJldHdlZW4gcGxheWxpc3RzLCBsb2FkaW5nIHRoaXMgZnJhZyB3aWxsIGhlbHAgdXNcbiAgICAgICAgICAgICAgICAgY29tcHV0ZSBwbGF5bGlzdCBzbGlkaW5nIGFuZCBmaW5kIHRoZSByaWdodCBvbmUgYWZ0ZXIgaW4gY2FzZSBpdCB3YXMgbm90IHRoZSByaWdodCBjb25zZWN1dGl2ZSBvbmUgKi9cbiAgICAgICAgICAgICAgaWYgKGZyYWdQcmV2aW91cykge1xuICAgICAgICAgICAgICAgIHZhciB0YXJnZXRTTiA9IGZyYWdQcmV2aW91cy5zbiArIDE7XG4gICAgICAgICAgICAgICAgaWYgKHRhcmdldFNOID49IGxldmVsRGV0YWlscy5zdGFydFNOICYmIHRhcmdldFNOIDw9IGxldmVsRGV0YWlscy5lbmRTTikge1xuICAgICAgICAgICAgICAgICAgZnJhZyA9IGZyYWdtZW50c1t0YXJnZXRTTiAtIGxldmVsRGV0YWlscy5zdGFydFNOXTtcbiAgICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYGxpdmUgcGxheWxpc3QsIHN3aXRjaGluZyBwbGF5bGlzdCwgbG9hZCBmcmFnIHdpdGggbmV4dCBTTjogJHtmcmFnLnNufWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoIWZyYWcpIHtcbiAgICAgICAgICAgICAgICAvKiB3ZSBoYXZlIG5vIGlkZWEgYWJvdXQgd2hpY2ggZnJhZ21lbnQgc2hvdWxkIGJlIGxvYWRlZC5cbiAgICAgICAgICAgICAgICAgICBzbyBsZXQncyBsb2FkIG1pZCBmcmFnbWVudC4gaXQgd2lsbCBoZWxwIGNvbXB1dGluZyBwbGF5bGlzdCBzbGlkaW5nIGFuZCBmaW5kIHRoZSByaWdodCBvbmVcbiAgICAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgICAgIGZyYWcgPSBmcmFnbWVudHNbTWF0aC5taW4oZnJhZ0xlbiAtIDEsIE1hdGgucm91bmQoZnJhZ0xlbiAvIDIpKV07XG4gICAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgbGl2ZSBwbGF5bGlzdCwgc3dpdGNoaW5nIHBsYXlsaXN0LCB1bmtub3duLCBsb2FkIG1pZGRsZSBmcmFnIDogJHtmcmFnLnNufWApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIFZvRCBwbGF5bGlzdDogaWYgYnVmZmVyRW5kIGJlZm9yZSBzdGFydCBvZiBwbGF5bGlzdCwgbG9hZCBmaXJzdCBmcmFnbWVudFxuICAgICAgICAgICAgaWYgKGJ1ZmZlckVuZCA8IHN0YXJ0KSB7XG4gICAgICAgICAgICAgIGZyYWcgPSBmcmFnbWVudHNbMF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICghZnJhZykge1xuICAgICAgICAgICAgdmFyIGZvdW5kRnJhZztcbiAgICAgICAgICAgIGlmIChidWZmZXJFbmQgPCBlbmQpIHtcbiAgICAgICAgICAgICAgZm91bmRGcmFnID0gQmluYXJ5U2VhcmNoLnNlYXJjaChmcmFnbWVudHMsIChjYW5kaWRhdGUpID0+IHtcbiAgICAgICAgICAgICAgICAvL2xvZ2dlci5sb2coJ2xldmVsL3NuL3NsaWRpbmcvc3RhcnQvZW5kL2J1ZkVuZDoke2xldmVsfS8ke2NhbmRpZGF0ZS5zbn0vJHtzbGlkaW5nLnRvRml4ZWQoMyl9LyR7Y2FuZGlkYXRlLnN0YXJ0LnRvRml4ZWQoMyl9LyR7KGNhbmRpZGF0ZS5zdGFydCtjYW5kaWRhdGUuZHVyYXRpb24pLnRvRml4ZWQoMyl9LyR7YnVmZmVyRW5kLnRvRml4ZWQoMyl9Jyk7XG4gICAgICAgICAgICAgICAgLy8gb2Zmc2V0IHNob3VsZCBiZSB3aXRoaW4gZnJhZ21lbnQgYm91bmRhcnlcbiAgICAgICAgICAgICAgICBpZiAoKGNhbmRpZGF0ZS5zdGFydCArIGNhbmRpZGF0ZS5kdXJhdGlvbikgPD0gYnVmZmVyRW5kKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoY2FuZGlkYXRlLnN0YXJ0ID4gYnVmZmVyRW5kKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIHJlYWNoIGVuZCBvZiBwbGF5bGlzdFxuICAgICAgICAgICAgICBmb3VuZEZyYWcgPSBmcmFnbWVudHNbZnJhZ0xlbi0xXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChmb3VuZEZyYWcpIHtcbiAgICAgICAgICAgICAgZnJhZyA9IGZvdW5kRnJhZztcbiAgICAgICAgICAgICAgc3RhcnQgPSBmb3VuZEZyYWcuc3RhcnQ7XG4gICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnZmluZCBTTiBtYXRjaGluZyB3aXRoIHBvczonICsgIGJ1ZmZlckVuZCArICc6JyArIGZyYWcuc24pO1xuICAgICAgICAgICAgICBpZiAoZnJhZ1ByZXZpb3VzICYmIGZyYWcubGV2ZWwgPT09IGZyYWdQcmV2aW91cy5sZXZlbCAmJiBmcmFnLnNuID09PSBmcmFnUHJldmlvdXMuc24pIHtcbiAgICAgICAgICAgICAgICBpZiAoZnJhZy5zbiA8IGxldmVsRGV0YWlscy5lbmRTTikge1xuICAgICAgICAgICAgICAgICAgZnJhZyA9IGZyYWdtZW50c1tmcmFnLnNuICsgMSAtIGxldmVsRGV0YWlscy5zdGFydFNOXTtcbiAgICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYFNOIGp1c3QgbG9hZGVkLCBsb2FkIG5leHQgb25lOiAke2ZyYWcuc259YCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIC8vIGhhdmUgd2UgcmVhY2hlZCBlbmQgb2YgVk9EIHBsYXlsaXN0ID9cbiAgICAgICAgICAgICAgICAgIGlmICghbGV2ZWxEZXRhaWxzLmxpdmUpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG1lZGlhU291cmNlID0gdGhpcy5tZWRpYVNvdXJjZTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1lZGlhU291cmNlICYmIG1lZGlhU291cmNlLnJlYWR5U3RhdGUgPT09ICdvcGVuJykge1xuICAgICAgICAgICAgICAgICAgICAgIC8vIGVuc3VyZSBzb3VyY2VCdWZmZXIgYXJlIG5vdCBpbiB1cGRhdGluZyBzdGF0ZXllc1xuICAgICAgICAgICAgICAgICAgICAgIHZhciBzYiA9IHRoaXMuc291cmNlQnVmZmVyO1xuICAgICAgICAgICAgICAgICAgICAgIGlmICghKChzYi5hdWRpbyAmJiBzYi5hdWRpby51cGRhdGluZykgfHwgKHNiLnZpZGVvICYmIHNiLnZpZGVvLnVwZGF0aW5nKSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coJ2FsbCBtZWRpYSBkYXRhIGF2YWlsYWJsZSwgc2lnbmFsIGVuZE9mU3RyZWFtKCkgdG8gTWVkaWFTb3VyY2UnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vTm90aWZ5IHRoZSBtZWRpYSBlbGVtZW50IHRoYXQgaXQgbm93IGhhcyBhbGwgb2YgdGhlIG1lZGlhIGRhdGFcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lZGlhU291cmNlLmVuZE9mU3RyZWFtKCk7XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBmcmFnID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYoZnJhZykge1xuICAgICAgICAgICAgLy9sb2dnZXIubG9nKCcgICAgICBsb2FkaW5nIGZyYWcgJyArIGkgKycscG9zL2J1ZkVuZDonICsgcG9zLnRvRml4ZWQoMykgKyAnLycgKyBidWZmZXJFbmQudG9GaXhlZCgzKSk7XG4gICAgICAgICAgICBpZiAoKGZyYWcuZGVjcnlwdGRhdGEudXJpICE9IG51bGwpICYmIChmcmFnLmRlY3J5cHRkYXRhLmtleSA9PSBudWxsKSkge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBMb2FkaW5nIGtleSBmb3IgJHtmcmFnLnNufSBvZiBbJHtsZXZlbERldGFpbHMuc3RhcnRTTn0gLCR7bGV2ZWxEZXRhaWxzLmVuZFNOfV0sbGV2ZWwgJHtsZXZlbH1gKTtcbiAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLktFWV9MT0FESU5HO1xuICAgICAgICAgICAgICBobHMudHJpZ2dlcihFdmVudC5LRVlfTE9BRElORywge2ZyYWc6IGZyYWd9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coYExvYWRpbmcgJHtmcmFnLnNufSBvZiBbJHtsZXZlbERldGFpbHMuc3RhcnRTTn0gLCR7bGV2ZWxEZXRhaWxzLmVuZFNOfV0sbGV2ZWwgJHtsZXZlbH0sIGN1cnJlbnRUaW1lOiR7cG9zfSxidWZmZXJFbmQ6JHtidWZmZXJFbmQudG9GaXhlZCgzKX1gKTtcbiAgICAgICAgICAgICAgZnJhZy5hdXRvTGV2ZWwgPSBobHMuYXV0b0xldmVsRW5hYmxlZDtcbiAgICAgICAgICAgICAgaWYgKHRoaXMubGV2ZWxzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgICBmcmFnLmV4cGVjdGVkTGVuID0gTWF0aC5yb3VuZChmcmFnLmR1cmF0aW9uICogdGhpcy5sZXZlbHNbbGV2ZWxdLmJpdHJhdGUgLyA4KTtcbiAgICAgICAgICAgICAgICBmcmFnLnRyZXF1ZXN0ID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgLy8gZW5zdXJlIHRoYXQgd2UgYXJlIG5vdCByZWxvYWRpbmcgdGhlIHNhbWUgZnJhZ21lbnRzIGluIGxvb3AgLi4uXG4gICAgICAgICAgICAgIGlmICh0aGlzLmZyYWdMb2FkSWR4ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmZyYWdMb2FkSWR4Kys7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5mcmFnTG9hZElkeCA9IDA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKGZyYWcubG9hZENvdW50ZXIpIHtcbiAgICAgICAgICAgICAgICBmcmFnLmxvYWRDb3VudGVyKys7XG4gICAgICAgICAgICAgICAgbGV0IG1heFRocmVzaG9sZCA9IHRoaXMuY29uZmlnLmZyYWdMb2FkaW5nTG9vcFRocmVzaG9sZDtcbiAgICAgICAgICAgICAgICAvLyBpZiB0aGlzIGZyYWcgaGFzIGFscmVhZHkgYmVlbiBsb2FkZWQgMyB0aW1lcywgYW5kIGlmIGl0IGhhcyBiZWVuIHJlbG9hZGVkIHJlY2VudGx5XG4gICAgICAgICAgICAgICAgaWYgKGZyYWcubG9hZENvdW50ZXIgPiBtYXhUaHJlc2hvbGQgJiYgKE1hdGguYWJzKHRoaXMuZnJhZ0xvYWRJZHggLSBmcmFnLmxvYWRJZHgpIDwgbWF4VGhyZXNob2xkKSkge1xuICAgICAgICAgICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuRlJBR19MT09QX0xPQURJTkdfRVJST1IsIGZhdGFsOiBmYWxzZSwgZnJhZzogZnJhZ30pO1xuICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBmcmFnLmxvYWRDb3VudGVyID0gMTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBmcmFnLmxvYWRJZHggPSB0aGlzLmZyYWdMb2FkSWR4O1xuICAgICAgICAgICAgICB0aGlzLmZyYWdDdXJyZW50ID0gZnJhZztcbiAgICAgICAgICAgICAgdGhpcy5zdGFydEZyYWdtZW50UmVxdWVzdGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuRlJBR19MT0FESU5HLCB7ZnJhZzogZnJhZ30pO1xuICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuRlJBR19MT0FESU5HO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgU3RhdGUuV0FJVElOR19MRVZFTDpcbiAgICAgICAgbGV2ZWwgPSB0aGlzLmxldmVsc1t0aGlzLmxldmVsXTtcbiAgICAgICAgLy8gY2hlY2sgaWYgcGxheWxpc3QgaXMgYWxyZWFkeSBsb2FkZWRcbiAgICAgICAgaWYgKGxldmVsICYmIGxldmVsLmRldGFpbHMpIHtcbiAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgU3RhdGUuRlJBR19MT0FESU5HOlxuICAgICAgICAvKlxuICAgICAgICAgIG1vbml0b3IgZnJhZ21lbnQgcmV0cmlldmFsIHRpbWUuLi5cbiAgICAgICAgICB3ZSBjb21wdXRlIGV4cGVjdGVkIHRpbWUgb2YgYXJyaXZhbCBvZiB0aGUgY29tcGxldGUgZnJhZ21lbnQuXG4gICAgICAgICAgd2UgY29tcGFyZSBpdCB0byBleHBlY3RlZCB0aW1lIG9mIGJ1ZmZlciBzdGFydmF0aW9uXG4gICAgICAgICovXG4gICAgICAgIGxldCB2ID0gdGhpcy5tZWRpYSxmcmFnID0gdGhpcy5mcmFnQ3VycmVudDtcbiAgICAgICAgLyogb25seSBtb25pdG9yIGZyYWcgcmV0cmlldmFsIHRpbWUgaWZcbiAgICAgICAgKHZpZGVvIG5vdCBwYXVzZWQgT1IgZmlyc3QgZnJhZ21lbnQgYmVpbmcgbG9hZGVkKSBBTkQgYXV0b3N3aXRjaGluZyBlbmFibGVkIEFORCBub3QgbG93ZXN0IGxldmVsIEFORCBtdWx0aXBsZSBsZXZlbHMgKi9cbiAgICAgICAgaWYgKHYgJiYgKCF2LnBhdXNlZCB8fCB0aGlzLmxvYWRlZG1ldGFkYXRhID09PSBmYWxzZSkgJiYgZnJhZy5hdXRvTGV2ZWwgJiYgdGhpcy5sZXZlbCAmJiB0aGlzLmxldmVscy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgdmFyIHJlcXVlc3REZWxheSA9IHBlcmZvcm1hbmNlLm5vdygpIC0gZnJhZy50cmVxdWVzdDtcbiAgICAgICAgICAvLyBtb25pdG9yIGZyYWdtZW50IGxvYWQgcHJvZ3Jlc3MgYWZ0ZXIgaGFsZiBvZiBleHBlY3RlZCBmcmFnbWVudCBkdXJhdGlvbix0byBzdGFiaWxpemUgYml0cmF0ZVxuICAgICAgICAgIGlmIChyZXF1ZXN0RGVsYXkgPiAoNTAwICogZnJhZy5kdXJhdGlvbikpIHtcbiAgICAgICAgICAgIHZhciBsb2FkUmF0ZSA9IGZyYWcubG9hZGVkICogMTAwMCAvIHJlcXVlc3REZWxheTsgLy8gYnl0ZS9zXG4gICAgICAgICAgICBpZiAoZnJhZy5leHBlY3RlZExlbiA8IGZyYWcubG9hZGVkKSB7XG4gICAgICAgICAgICAgIGZyYWcuZXhwZWN0ZWRMZW4gPSBmcmFnLmxvYWRlZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHBvcyA9IHYuY3VycmVudFRpbWU7XG4gICAgICAgICAgICB2YXIgZnJhZ0xvYWRlZERlbGF5ID0gKGZyYWcuZXhwZWN0ZWRMZW4gLSBmcmFnLmxvYWRlZCkgLyBsb2FkUmF0ZTtcbiAgICAgICAgICAgIHZhciBidWZmZXJTdGFydmF0aW9uRGVsYXkgPSB0aGlzLmJ1ZmZlckluZm8ocG9zLDAuMykuZW5kIC0gcG9zO1xuICAgICAgICAgICAgdmFyIGZyYWdMZXZlbE5leHRMb2FkZWREZWxheSA9IGZyYWcuZHVyYXRpb24gKiB0aGlzLmxldmVsc1tobHMubmV4dExvYWRMZXZlbF0uYml0cmF0ZSAvICg4ICogbG9hZFJhdGUpOyAvL2Jwcy9CcHNcbiAgICAgICAgICAgIC8qIGlmIHdlIGhhdmUgbGVzcyB0aGFuIDIgZnJhZyBkdXJhdGlvbiBpbiBidWZmZXIgYW5kIGlmIGZyYWcgbG9hZGVkIGRlbGF5IGlzIGdyZWF0ZXIgdGhhbiBidWZmZXIgc3RhcnZhdGlvbiBkZWxheVxuICAgICAgICAgICAgICAuLi4gYW5kIGFsc28gYmlnZ2VyIHRoYW4gZHVyYXRpb24gbmVlZGVkIHRvIGxvYWQgZnJhZ21lbnQgYXQgbmV4dCBsZXZlbCAuLi4qL1xuICAgICAgICAgICAgaWYgKGJ1ZmZlclN0YXJ2YXRpb25EZWxheSA8ICgyICogZnJhZy5kdXJhdGlvbikgJiYgZnJhZ0xvYWRlZERlbGF5ID4gYnVmZmVyU3RhcnZhdGlvbkRlbGF5ICYmIGZyYWdMb2FkZWREZWxheSA+IGZyYWdMZXZlbE5leHRMb2FkZWREZWxheSkge1xuICAgICAgICAgICAgICAvLyBhYm9ydCBmcmFnbWVudCBsb2FkaW5nIC4uLlxuICAgICAgICAgICAgICBsb2dnZXIud2FybignbG9hZGluZyB0b28gc2xvdywgYWJvcnQgZnJhZ21lbnQgbG9hZGluZycpO1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBmcmFnTG9hZGVkRGVsYXkvYnVmZmVyU3RhcnZhdGlvbkRlbGF5L2ZyYWdMZXZlbE5leHRMb2FkZWREZWxheSA6JHtmcmFnTG9hZGVkRGVsYXkudG9GaXhlZCgxKX0vJHtidWZmZXJTdGFydmF0aW9uRGVsYXkudG9GaXhlZCgxKX0vJHtmcmFnTGV2ZWxOZXh0TG9hZGVkRGVsYXkudG9GaXhlZCgxKX1gKTtcbiAgICAgICAgICAgICAgLy9hYm9ydCBmcmFnbWVudCBsb2FkaW5nXG4gICAgICAgICAgICAgIGZyYWcubG9hZGVyLmFib3J0KCk7XG4gICAgICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkZSQUdfTE9BRF9FTUVSR0VOQ1lfQUJPUlRFRCwge2ZyYWc6IGZyYWd9KTtcbiAgICAgICAgICAgICAgLy8gc3dpdGNoIGJhY2sgdG8gSURMRSBzdGF0ZSB0byByZXF1ZXN0IG5ldyBmcmFnbWVudCBhdCBsb3dlc3QgbGV2ZWxcbiAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBTdGF0ZS5QQVJTSU5HOlxuICAgICAgICAvLyBub3RoaW5nIHRvIGRvLCB3YWl0IGZvciBmcmFnbWVudCBiZWluZyBwYXJzZWRcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFN0YXRlLlBBUlNFRDpcbiAgICAgIGNhc2UgU3RhdGUuQVBQRU5ESU5HOlxuICAgICAgICBpZiAodGhpcy5zb3VyY2VCdWZmZXIpIHtcbiAgICAgICAgICBpZiAodGhpcy5tZWRpYS5lcnJvcikge1xuICAgICAgICAgICAgbG9nZ2VyLmVycm9yKCd0cnlpbmcgdG8gYXBwZW5kIGFsdGhvdWdoIGEgbWVkaWEgZXJyb3Igb2NjdXJlZCwgc3dpdGNoIHRvIEVSUk9SIHN0YXRlJyk7XG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuRVJST1I7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIGlmIE1QNCBzZWdtZW50IGFwcGVuZGluZyBpbiBwcm9ncmVzcyBub3RoaW5nIHRvIGRvXG4gICAgICAgICAgZWxzZSBpZiAoKHRoaXMuc291cmNlQnVmZmVyLmF1ZGlvICYmIHRoaXMuc291cmNlQnVmZmVyLmF1ZGlvLnVwZGF0aW5nKSB8fFxuICAgICAgICAgICAgICh0aGlzLnNvdXJjZUJ1ZmZlci52aWRlbyAmJiB0aGlzLnNvdXJjZUJ1ZmZlci52aWRlby51cGRhdGluZykpIHtcbiAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnc2IgYXBwZW5kIGluIHByb2dyZXNzJyk7XG4gICAgICAgIC8vIGNoZWNrIGlmIGFueSBNUDQgc2VnbWVudHMgbGVmdCB0byBhcHBlbmRcbiAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMubXA0c2VnbWVudHMubGVuZ3RoKSB7XG4gICAgICAgICAgICB2YXIgc2VnbWVudCA9IHRoaXMubXA0c2VnbWVudHMuc2hpZnQoKTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZyhgYXBwZW5kaW5nICR7c2VnbWVudC50eXBlfSBTQiwgc2l6ZToke3NlZ21lbnQuZGF0YS5sZW5ndGh9KTtcbiAgICAgICAgICAgICAgdGhpcy5zb3VyY2VCdWZmZXJbc2VnbWVudC50eXBlXS5hcHBlbmRCdWZmZXIoc2VnbWVudC5kYXRhKTtcbiAgICAgICAgICAgICAgdGhpcy5hcHBlbmRFcnJvciA9IDA7XG4gICAgICAgICAgICB9IGNhdGNoKGVycikge1xuICAgICAgICAgICAgICAvLyBpbiBjYXNlIGFueSBlcnJvciBvY2N1cmVkIHdoaWxlIGFwcGVuZGluZywgcHV0IGJhY2sgc2VnbWVudCBpbiBtcDRzZWdtZW50cyB0YWJsZVxuICAgICAgICAgICAgICAvL2xvZ2dlci5lcnJvcihgZXJyb3Igd2hpbGUgdHJ5aW5nIHRvIGFwcGVuZCBidWZmZXI6JHtlcnIubWVzc2FnZX0sdHJ5IGFwcGVuZGluZyBsYXRlcmApO1xuICAgICAgICAgICAgICB0aGlzLm1wNHNlZ21lbnRzLnVuc2hpZnQoc2VnbWVudCk7XG4gICAgICAgICAgICAgIGlmICh0aGlzLmFwcGVuZEVycm9yKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hcHBlbmRFcnJvcisrO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuYXBwZW5kRXJyb3IgPSAxO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHZhciBldmVudCA9IHt0eXBlOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuQlVGRkVSX0FQUEVORF9FUlJPUiwgZnJhZzogdGhpcy5mcmFnQ3VycmVudH07XG4gICAgICAgICAgICAgIC8qIHdpdGggVUhEIGNvbnRlbnQsIHdlIGNvdWxkIGdldCBsb29wIG9mIHF1b3RhIGV4Y2VlZGVkIGVycm9yIHVudGlsXG4gICAgICAgICAgICAgICAgYnJvd3NlciBpcyBhYmxlIHRvIGV2aWN0IHNvbWUgZGF0YSBmcm9tIHNvdXJjZWJ1ZmZlci4gcmV0cnlpbmcgaGVscCByZWNvdmVyaW5nIHRoaXNcbiAgICAgICAgICAgICAgKi9cbiAgICAgICAgICAgICAgaWYgKHRoaXMuYXBwZW5kRXJyb3IgPiB0aGlzLmNvbmZpZy5hcHBlbmRFcnJvck1heFJldHJ5KSB7XG4gICAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgZmFpbCAke3RoaXMuY29uZmlnLmFwcGVuZEVycm9yTWF4UmV0cnl9IHRpbWVzIHRvIGFwcGVuZCBzZWdtZW50IGluIHNvdXJjZUJ1ZmZlcmApO1xuICAgICAgICAgICAgICAgIGV2ZW50LmZhdGFsID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBobHMudHJpZ2dlcihFdmVudC5FUlJPUiwgZXZlbnQpO1xuICAgICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5FUlJPUjtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZXZlbnQuZmF0YWwgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBobHMudHJpZ2dlcihFdmVudC5FUlJPUiwgZXZlbnQpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuQVBQRU5ESU5HO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBzb3VyY2VCdWZmZXIgdW5kZWZpbmVkLCBzd2l0Y2ggYmFjayB0byBJRExFIHN0YXRlXG4gICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFN0YXRlLkJVRkZFUl9GTFVTSElORzpcbiAgICAgICAgLy8gbG9vcCB0aHJvdWdoIGFsbCBidWZmZXIgcmFuZ2VzIHRvIGZsdXNoXG4gICAgICAgIHdoaWxlKHRoaXMuZmx1c2hSYW5nZS5sZW5ndGgpIHtcbiAgICAgICAgICB2YXIgcmFuZ2UgPSB0aGlzLmZsdXNoUmFuZ2VbMF07XG4gICAgICAgICAgLy8gZmx1c2hCdWZmZXIgd2lsbCBhYm9ydCBhbnkgYnVmZmVyIGFwcGVuZCBpbiBwcm9ncmVzcyBhbmQgZmx1c2ggQXVkaW8vVmlkZW8gQnVmZmVyXG4gICAgICAgICAgaWYgKHRoaXMuZmx1c2hCdWZmZXIocmFuZ2Uuc3RhcnQsIHJhbmdlLmVuZCkpIHtcbiAgICAgICAgICAgIC8vIHJhbmdlIGZsdXNoZWQsIHJlbW92ZSBmcm9tIGZsdXNoIGFycmF5XG4gICAgICAgICAgICB0aGlzLmZsdXNoUmFuZ2Uuc2hpZnQoKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gZmx1c2ggaW4gcHJvZ3Jlc3MsIGNvbWUgYmFjayBsYXRlclxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLmZsdXNoUmFuZ2UubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgLy8gaGFuZGxlIGVuZCBvZiBpbW1lZGlhdGUgc3dpdGNoaW5nIGlmIG5lZWRlZFxuICAgICAgICAgIGlmICh0aGlzLmltbWVkaWF0ZVN3aXRjaCkge1xuICAgICAgICAgICAgdGhpcy5pbW1lZGlhdGVMZXZlbFN3aXRjaEVuZCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBtb3ZlIHRvIElETEUgb25jZSBmbHVzaCBjb21wbGV0ZS4gdGhpcyBzaG91bGQgdHJpZ2dlciBuZXcgZnJhZ21lbnQgbG9hZGluZ1xuICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgICAgICAgIC8vIHJlc2V0IHJlZmVyZW5jZSB0byBmcmFnXG4gICAgICAgICAgdGhpcy5mcmFnUHJldmlvdXMgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgICAvKiBpZiBub3QgZXZlcnl0aGluZyBmbHVzaGVkLCBzdGF5IGluIEJVRkZFUl9GTFVTSElORyBzdGF0ZS4gd2Ugd2lsbCBjb21lIGJhY2sgaGVyZVxuICAgICAgICAgICAgZWFjaCB0aW1lIHNvdXJjZUJ1ZmZlciB1cGRhdGVlbmQoKSBjYWxsYmFjayB3aWxsIGJlIHRyaWdnZXJlZFxuICAgICAgICAgICAgKi9cbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBicmVhaztcbiAgICB9XG4gICAgLy8gY2hlY2svdXBkYXRlIGN1cnJlbnQgZnJhZ21lbnRcbiAgICB0aGlzLl9jaGVja0ZyYWdtZW50Q2hhbmdlZCgpO1xuICAgIC8vIGNoZWNrIGJ1ZmZlclxuICAgIHRoaXMuX2NoZWNrQnVmZmVyKCk7XG4gIH1cblxuXG4gIGJ1ZmZlckluZm8ocG9zLG1heEhvbGVEdXJhdGlvbikge1xuICAgIHZhciBtZWRpYSA9IHRoaXMubWVkaWEsXG4gICAgICAgIHZidWZmZXJlZCA9IG1lZGlhLmJ1ZmZlcmVkLFxuICAgICAgICBidWZmZXJlZCA9IFtdLGk7XG4gICAgZm9yIChpID0gMDsgaSA8IHZidWZmZXJlZC5sZW5ndGg7IGkrKykge1xuICAgICAgYnVmZmVyZWQucHVzaCh7c3RhcnQ6IHZidWZmZXJlZC5zdGFydChpKSwgZW5kOiB2YnVmZmVyZWQuZW5kKGkpfSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmJ1ZmZlcmVkSW5mbyhidWZmZXJlZCxwb3MsbWF4SG9sZUR1cmF0aW9uKTtcbiAgfVxuXG4gIGJ1ZmZlcmVkSW5mbyhidWZmZXJlZCxwb3MsbWF4SG9sZUR1cmF0aW9uKSB7XG4gICAgdmFyIGJ1ZmZlcmVkMiA9IFtdLFxuICAgICAgICAvLyBidWZmZXJTdGFydCBhbmQgYnVmZmVyRW5kIGFyZSBidWZmZXIgYm91bmRhcmllcyBhcm91bmQgY3VycmVudCB2aWRlbyBwb3NpdGlvblxuICAgICAgICBidWZmZXJMZW4sYnVmZmVyU3RhcnQsIGJ1ZmZlckVuZCxidWZmZXJTdGFydE5leHQsaTtcbiAgICAvLyBzb3J0IG9uIGJ1ZmZlci5zdGFydC9zbWFsbGVyIGVuZCAoSUUgZG9lcyBub3QgYWx3YXlzIHJldHVybiBzb3J0ZWQgYnVmZmVyZWQgcmFuZ2UpXG4gICAgYnVmZmVyZWQuc29ydChmdW5jdGlvbiAoYSwgYikge1xuICAgICAgdmFyIGRpZmYgPSBhLnN0YXJ0IC0gYi5zdGFydDtcbiAgICAgIGlmIChkaWZmKSB7XG4gICAgICAgIHJldHVybiBkaWZmO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGIuZW5kIC0gYS5lbmQ7XG4gICAgICB9XG4gICAgfSk7XG4gICAgLy8gdGhlcmUgbWlnaHQgYmUgc29tZSBzbWFsbCBob2xlcyBiZXR3ZWVuIGJ1ZmZlciB0aW1lIHJhbmdlXG4gICAgLy8gY29uc2lkZXIgdGhhdCBob2xlcyBzbWFsbGVyIHRoYW4gbWF4SG9sZUR1cmF0aW9uIGFyZSBpcnJlbGV2YW50IGFuZCBidWlsZCBhbm90aGVyXG4gICAgLy8gYnVmZmVyIHRpbWUgcmFuZ2UgcmVwcmVzZW50YXRpb25zIHRoYXQgZGlzY2FyZHMgdGhvc2UgaG9sZXNcbiAgICBmb3IgKGkgPSAwOyBpIDwgYnVmZmVyZWQubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBidWYybGVuID0gYnVmZmVyZWQyLmxlbmd0aDtcbiAgICAgIGlmKGJ1ZjJsZW4pIHtcbiAgICAgICAgdmFyIGJ1ZjJlbmQgPSBidWZmZXJlZDJbYnVmMmxlbiAtIDFdLmVuZDtcbiAgICAgICAgLy8gaWYgc21hbGwgaG9sZSAodmFsdWUgYmV0d2VlbiAwIG9yIG1heEhvbGVEdXJhdGlvbiApIG9yIG92ZXJsYXBwaW5nIChuZWdhdGl2ZSlcbiAgICAgICAgaWYoKGJ1ZmZlcmVkW2ldLnN0YXJ0IC0gYnVmMmVuZCkgPCBtYXhIb2xlRHVyYXRpb24pIHtcbiAgICAgICAgICAvLyBtZXJnZSBvdmVybGFwcGluZyB0aW1lIHJhbmdlc1xuICAgICAgICAgIC8vIHVwZGF0ZSBsYXN0UmFuZ2UuZW5kIG9ubHkgaWYgc21hbGxlciB0aGFuIGl0ZW0uZW5kXG4gICAgICAgICAgLy8gZS5nLiAgWyAxLCAxNV0gd2l0aCAgWyAyLDhdID0+IFsgMSwxNV0gKG5vIG5lZWQgdG8gbW9kaWZ5IGxhc3RSYW5nZS5lbmQpXG4gICAgICAgICAgLy8gd2hlcmVhcyBbIDEsIDhdIHdpdGggIFsgMiwxNV0gPT4gWyAxLDE1XSAoIGxhc3RSYW5nZSBzaG91bGQgc3dpdGNoIGZyb20gWzEsOF0gdG8gWzEsMTVdKVxuICAgICAgICAgIGlmKGJ1ZmZlcmVkW2ldLmVuZCA+IGJ1ZjJlbmQpIHtcbiAgICAgICAgICAgIGJ1ZmZlcmVkMltidWYybGVuIC0gMV0uZW5kID0gYnVmZmVyZWRbaV0uZW5kO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBiaWcgaG9sZVxuICAgICAgICAgIGJ1ZmZlcmVkMi5wdXNoKGJ1ZmZlcmVkW2ldKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gZmlyc3QgdmFsdWVcbiAgICAgICAgYnVmZmVyZWQyLnB1c2goYnVmZmVyZWRbaV0pO1xuICAgICAgfVxuICAgIH1cbiAgICBmb3IgKGkgPSAwLCBidWZmZXJMZW4gPSAwLCBidWZmZXJTdGFydCA9IGJ1ZmZlckVuZCA9IHBvczsgaSA8IGJ1ZmZlcmVkMi5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHN0YXJ0ID0gIGJ1ZmZlcmVkMltpXS5zdGFydCxcbiAgICAgICAgICBlbmQgPSBidWZmZXJlZDJbaV0uZW5kO1xuICAgICAgLy9sb2dnZXIubG9nKCdidWYgc3RhcnQvZW5kOicgKyBidWZmZXJlZC5zdGFydChpKSArICcvJyArIGJ1ZmZlcmVkLmVuZChpKSk7XG4gICAgICBpZiAoKHBvcyArIG1heEhvbGVEdXJhdGlvbikgPj0gc3RhcnQgJiYgcG9zIDwgZW5kKSB7XG4gICAgICAgIC8vIHBsYXkgcG9zaXRpb24gaXMgaW5zaWRlIHRoaXMgYnVmZmVyIFRpbWVSYW5nZSwgcmV0cmlldmUgZW5kIG9mIGJ1ZmZlciBwb3NpdGlvbiBhbmQgYnVmZmVyIGxlbmd0aFxuICAgICAgICBidWZmZXJTdGFydCA9IHN0YXJ0O1xuICAgICAgICBidWZmZXJFbmQgPSBlbmQ7XG4gICAgICAgIGJ1ZmZlckxlbiA9IGJ1ZmZlckVuZCAtIHBvcztcbiAgICAgIH0gZWxzZSBpZiAoKHBvcyArIG1heEhvbGVEdXJhdGlvbikgPCBzdGFydCkge1xuICAgICAgICBidWZmZXJTdGFydE5leHQgPSBzdGFydDtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHtsZW46IGJ1ZmZlckxlbiwgc3RhcnQ6IGJ1ZmZlclN0YXJ0LCBlbmQ6IGJ1ZmZlckVuZCwgbmV4dFN0YXJ0IDogYnVmZmVyU3RhcnROZXh0fTtcbiAgfVxuXG4gIGdldEJ1ZmZlclJhbmdlKHBvc2l0aW9uKSB7XG4gICAgdmFyIGksIHJhbmdlO1xuICAgIGZvciAoaSA9IHRoaXMuYnVmZmVyUmFuZ2UubGVuZ3RoIC0gMTsgaSA+PTA7IGktLSkge1xuICAgICAgcmFuZ2UgPSB0aGlzLmJ1ZmZlclJhbmdlW2ldO1xuICAgICAgaWYgKHBvc2l0aW9uID49IHJhbmdlLnN0YXJ0ICYmIHBvc2l0aW9uIDw9IHJhbmdlLmVuZCkge1xuICAgICAgICByZXR1cm4gcmFuZ2U7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgZ2V0IGN1cnJlbnRMZXZlbCgpIHtcbiAgICBpZiAodGhpcy5tZWRpYSkge1xuICAgICAgdmFyIHJhbmdlID0gdGhpcy5nZXRCdWZmZXJSYW5nZSh0aGlzLm1lZGlhLmN1cnJlbnRUaW1lKTtcbiAgICAgIGlmIChyYW5nZSkge1xuICAgICAgICByZXR1cm4gcmFuZ2UuZnJhZy5sZXZlbDtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIC0xO1xuICB9XG5cbiAgZ2V0IG5leHRCdWZmZXJSYW5nZSgpIHtcbiAgICBpZiAodGhpcy5tZWRpYSkge1xuICAgICAgLy8gZmlyc3QgZ2V0IGVuZCByYW5nZSBvZiBjdXJyZW50IGZyYWdtZW50XG4gICAgICByZXR1cm4gdGhpcy5mb2xsb3dpbmdCdWZmZXJSYW5nZSh0aGlzLmdldEJ1ZmZlclJhbmdlKHRoaXMubWVkaWEuY3VycmVudFRpbWUpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgZm9sbG93aW5nQnVmZmVyUmFuZ2UocmFuZ2UpIHtcbiAgICBpZiAocmFuZ2UpIHtcbiAgICAgIC8vIHRyeSB0byBnZXQgcmFuZ2Ugb2YgbmV4dCBmcmFnbWVudCAoNTAwbXMgYWZ0ZXIgdGhpcyByYW5nZSlcbiAgICAgIHJldHVybiB0aGlzLmdldEJ1ZmZlclJhbmdlKHJhbmdlLmVuZCArIDAuNSk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgZ2V0IG5leHRMZXZlbCgpIHtcbiAgICB2YXIgcmFuZ2UgPSB0aGlzLm5leHRCdWZmZXJSYW5nZTtcbiAgICBpZiAocmFuZ2UpIHtcbiAgICAgIHJldHVybiByYW5nZS5mcmFnLmxldmVsO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gLTE7XG4gICAgfVxuICB9XG5cbiAgaXNCdWZmZXJlZChwb3NpdGlvbikge1xuICAgIHZhciB2ID0gdGhpcy5tZWRpYSwgYnVmZmVyZWQgPSB2LmJ1ZmZlcmVkO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYnVmZmVyZWQubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChwb3NpdGlvbiA+PSBidWZmZXJlZC5zdGFydChpKSAmJiBwb3NpdGlvbiA8PSBidWZmZXJlZC5lbmQoaSkpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIF9jaGVja0ZyYWdtZW50Q2hhbmdlZCgpIHtcbiAgICB2YXIgcmFuZ2VDdXJyZW50LCBjdXJyZW50VGltZSwgdmlkZW8gPSB0aGlzLm1lZGlhO1xuICAgIGlmICh2aWRlbyAmJiB2aWRlby5zZWVraW5nID09PSBmYWxzZSkge1xuICAgICAgY3VycmVudFRpbWUgPSB2aWRlby5jdXJyZW50VGltZTtcbiAgICAgIC8qIGlmIHZpZGVvIGVsZW1lbnQgaXMgaW4gc2Vla2VkIHN0YXRlLCBjdXJyZW50VGltZSBjYW4gb25seSBpbmNyZWFzZS5cbiAgICAgICAgKGFzc3VtaW5nIHRoYXQgcGxheWJhY2sgcmF0ZSBpcyBwb3NpdGl2ZSAuLi4pXG4gICAgICAgIEFzIHNvbWV0aW1lcyBjdXJyZW50VGltZSBqdW1wcyBiYWNrIHRvIHplcm8gYWZ0ZXIgYVxuICAgICAgICBtZWRpYSBkZWNvZGUgZXJyb3IsIGNoZWNrIHRoaXMsIHRvIGF2b2lkIHNlZWtpbmcgYmFjayB0b1xuICAgICAgICB3cm9uZyBwb3NpdGlvbiBhZnRlciBhIG1lZGlhIGRlY29kZSBlcnJvclxuICAgICAgKi9cbiAgICAgIGlmKGN1cnJlbnRUaW1lID4gdmlkZW8ucGxheWJhY2tSYXRlKnRoaXMubGFzdEN1cnJlbnRUaW1lKSB7XG4gICAgICAgIHRoaXMubGFzdEN1cnJlbnRUaW1lID0gY3VycmVudFRpbWU7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5pc0J1ZmZlcmVkKGN1cnJlbnRUaW1lKSkge1xuICAgICAgICByYW5nZUN1cnJlbnQgPSB0aGlzLmdldEJ1ZmZlclJhbmdlKGN1cnJlbnRUaW1lKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5pc0J1ZmZlcmVkKGN1cnJlbnRUaW1lICsgMC4xKSkge1xuICAgICAgICAvKiBlbnN1cmUgdGhhdCBGUkFHX0NIQU5HRUQgZXZlbnQgaXMgdHJpZ2dlcmVkIGF0IHN0YXJ0dXAsXG4gICAgICAgICAgd2hlbiBmaXJzdCB2aWRlbyBmcmFtZSBpcyBkaXNwbGF5ZWQgYW5kIHBsYXliYWNrIGlzIHBhdXNlZC5cbiAgICAgICAgICBhZGQgYSB0b2xlcmFuY2Ugb2YgMTAwbXMsIGluIGNhc2UgY3VycmVudCBwb3NpdGlvbiBpcyBub3QgYnVmZmVyZWQsXG4gICAgICAgICAgY2hlY2sgaWYgY3VycmVudCBwb3MrMTAwbXMgaXMgYnVmZmVyZWQgYW5kIHVzZSB0aGF0IGJ1ZmZlciByYW5nZVxuICAgICAgICAgIGZvciBGUkFHX0NIQU5HRUQgZXZlbnQgcmVwb3J0aW5nICovXG4gICAgICAgIHJhbmdlQ3VycmVudCA9IHRoaXMuZ2V0QnVmZmVyUmFuZ2UoY3VycmVudFRpbWUgKyAwLjEpO1xuICAgICAgfVxuICAgICAgaWYgKHJhbmdlQ3VycmVudCkge1xuICAgICAgICB2YXIgZnJhZ1BsYXlpbmcgPSByYW5nZUN1cnJlbnQuZnJhZztcbiAgICAgICAgaWYgKGZyYWdQbGF5aW5nICE9PSB0aGlzLmZyYWdQbGF5aW5nKSB7XG4gICAgICAgICAgdGhpcy5mcmFnUGxheWluZyA9IGZyYWdQbGF5aW5nO1xuICAgICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRlJBR19DSEFOR0VELCB7ZnJhZzogZnJhZ1BsYXlpbmd9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qXG4gICAgYWJvcnQgYW55IGJ1ZmZlciBhcHBlbmQgaW4gcHJvZ3Jlc3MsIGFuZCBmbHVzaCBhbGwgYnVmZmVyZWQgZGF0YVxuICAgIHJldHVybiB0cnVlIG9uY2UgZXZlcnl0aGluZyBoYXMgYmVlbiBmbHVzaGVkLlxuICAgIHNvdXJjZUJ1ZmZlci5hYm9ydCgpIGFuZCBzb3VyY2VCdWZmZXIucmVtb3ZlKCkgYXJlIGFzeW5jaHJvbm91cyBvcGVyYXRpb25zXG4gICAgdGhlIGlkZWEgaXMgdG8gY2FsbCB0aGlzIGZ1bmN0aW9uIGZyb20gdGljaygpIHRpbWVyIGFuZCBjYWxsIGl0IGFnYWluIHVudGlsIGFsbCByZXNvdXJjZXMgaGF2ZSBiZWVuIGNsZWFuZWRcbiAgICB0aGUgdGltZXIgaXMgcmVhcm1lZCB1cG9uIHNvdXJjZUJ1ZmZlciB1cGRhdGVlbmQoKSBldmVudCwgc28gdGhpcyBzaG91bGQgYmUgb3B0aW1hbFxuICAqL1xuICBmbHVzaEJ1ZmZlcihzdGFydE9mZnNldCwgZW5kT2Zmc2V0KSB7XG4gICAgdmFyIHNiLCBpLCBidWZTdGFydCwgYnVmRW5kLCBmbHVzaFN0YXJ0LCBmbHVzaEVuZDtcbiAgICAvL2xvZ2dlci5sb2coJ2ZsdXNoQnVmZmVyLHBvcy9zdGFydC9lbmQ6ICcgKyB0aGlzLm1lZGlhLmN1cnJlbnRUaW1lICsgJy8nICsgc3RhcnRPZmZzZXQgKyAnLycgKyBlbmRPZmZzZXQpO1xuICAgIC8vIHNhZmVndWFyZCB0byBhdm9pZCBpbmZpbml0ZSBsb29waW5nXG4gICAgaWYgKHRoaXMuZmx1c2hCdWZmZXJDb3VudGVyKysgPCAoMiAqIHRoaXMuYnVmZmVyUmFuZ2UubGVuZ3RoKSAmJiB0aGlzLnNvdXJjZUJ1ZmZlcikge1xuICAgICAgZm9yICh2YXIgdHlwZSBpbiB0aGlzLnNvdXJjZUJ1ZmZlcikge1xuICAgICAgICBzYiA9IHRoaXMuc291cmNlQnVmZmVyW3R5cGVdO1xuICAgICAgICBpZiAoIXNiLnVwZGF0aW5nKSB7XG4gICAgICAgICAgZm9yIChpID0gMDsgaSA8IHNiLmJ1ZmZlcmVkLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBidWZTdGFydCA9IHNiLmJ1ZmZlcmVkLnN0YXJ0KGkpO1xuICAgICAgICAgICAgYnVmRW5kID0gc2IuYnVmZmVyZWQuZW5kKGkpO1xuICAgICAgICAgICAgLy8gd29ya2Fyb3VuZCBmaXJlZm94IG5vdCBhYmxlIHRvIHByb3Blcmx5IGZsdXNoIG11bHRpcGxlIGJ1ZmZlcmVkIHJhbmdlLlxuICAgICAgICAgICAgaWYgKG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5pbmRleE9mKCdmaXJlZm94JykgIT09IC0xICYmIGVuZE9mZnNldCA9PT0gTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZKSB7XG4gICAgICAgICAgICAgIGZsdXNoU3RhcnQgPSBzdGFydE9mZnNldDtcbiAgICAgICAgICAgICAgZmx1c2hFbmQgPSBlbmRPZmZzZXQ7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBmbHVzaFN0YXJ0ID0gTWF0aC5tYXgoYnVmU3RhcnQsIHN0YXJ0T2Zmc2V0KTtcbiAgICAgICAgICAgICAgZmx1c2hFbmQgPSBNYXRoLm1pbihidWZFbmQsIGVuZE9mZnNldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvKiBzb21ldGltZXMgc291cmNlYnVmZmVyLnJlbW92ZSgpIGRvZXMgbm90IGZsdXNoXG4gICAgICAgICAgICAgICB0aGUgZXhhY3QgZXhwZWN0ZWQgdGltZSByYW5nZS5cbiAgICAgICAgICAgICAgIHRvIGF2b2lkIHJvdW5kaW5nIGlzc3Vlcy9pbmZpbml0ZSBsb29wLFxuICAgICAgICAgICAgICAgb25seSBmbHVzaCBidWZmZXIgcmFuZ2Ugb2YgbGVuZ3RoIGdyZWF0ZXIgdGhhbiA1MDBtcy5cbiAgICAgICAgICAgICovXG4gICAgICAgICAgICBpZiAoZmx1c2hFbmQgLSBmbHVzaFN0YXJ0ID4gMC41KSB7XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coYGZsdXNoICR7dHlwZX0gWyR7Zmx1c2hTdGFydH0sJHtmbHVzaEVuZH1dLCBvZiBbJHtidWZTdGFydH0sJHtidWZFbmR9XSwgcG9zOiR7dGhpcy5tZWRpYS5jdXJyZW50VGltZX1gKTtcbiAgICAgICAgICAgICAgc2IucmVtb3ZlKGZsdXNoU3RhcnQsIGZsdXNoRW5kKTtcbiAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ2Fib3J0ICcgKyB0eXBlICsgJyBhcHBlbmQgaW4gcHJvZ3Jlc3MnKTtcbiAgICAgICAgICAvLyB0aGlzIHdpbGwgYWJvcnQgYW55IGFwcGVuZGluZyBpbiBwcm9ncmVzc1xuICAgICAgICAgIC8vc2IuYWJvcnQoKTtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvKiBhZnRlciBzdWNjZXNzZnVsIGJ1ZmZlciBmbHVzaGluZywgcmVidWlsZCBidWZmZXIgUmFuZ2UgYXJyYXlcbiAgICAgIGxvb3AgdGhyb3VnaCBleGlzdGluZyBidWZmZXIgcmFuZ2UgYW5kIGNoZWNrIGlmXG4gICAgICBjb3JyZXNwb25kaW5nIHJhbmdlIGlzIHN0aWxsIGJ1ZmZlcmVkLiBvbmx5IHB1c2ggdG8gbmV3IGFycmF5IGFscmVhZHkgYnVmZmVyZWQgcmFuZ2VcbiAgICAqL1xuICAgIHZhciBuZXdSYW5nZSA9IFtdLHJhbmdlO1xuICAgIGZvciAoaSA9IDA7IGkgPCB0aGlzLmJ1ZmZlclJhbmdlLmxlbmd0aDsgaSsrKSB7XG4gICAgICByYW5nZSA9IHRoaXMuYnVmZmVyUmFuZ2VbaV07XG4gICAgICBpZiAodGhpcy5pc0J1ZmZlcmVkKChyYW5nZS5zdGFydCArIHJhbmdlLmVuZCkgLyAyKSkge1xuICAgICAgICBuZXdSYW5nZS5wdXNoKHJhbmdlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5idWZmZXJSYW5nZSA9IG5ld1JhbmdlO1xuICAgIGxvZ2dlci5sb2coJ2J1ZmZlciBmbHVzaGVkJyk7XG4gICAgLy8gZXZlcnl0aGluZyBmbHVzaGVkICFcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8qXG4gICAgb24gaW1tZWRpYXRlIGxldmVsIHN3aXRjaCA6XG4gICAgIC0gcGF1c2UgcGxheWJhY2sgaWYgcGxheWluZ1xuICAgICAtIGNhbmNlbCBhbnkgcGVuZGluZyBsb2FkIHJlcXVlc3RcbiAgICAgLSBhbmQgdHJpZ2dlciBhIGJ1ZmZlciBmbHVzaFxuICAqL1xuICBpbW1lZGlhdGVMZXZlbFN3aXRjaCgpIHtcbiAgICBsb2dnZXIubG9nKCdpbW1lZGlhdGVMZXZlbFN3aXRjaCcpO1xuICAgIGlmICghdGhpcy5pbW1lZGlhdGVTd2l0Y2gpIHtcbiAgICAgIHRoaXMuaW1tZWRpYXRlU3dpdGNoID0gdHJ1ZTtcbiAgICAgIHRoaXMucHJldmlvdXNseVBhdXNlZCA9IHRoaXMubWVkaWEucGF1c2VkO1xuICAgICAgdGhpcy5tZWRpYS5wYXVzZSgpO1xuICAgIH1cbiAgICB2YXIgZnJhZ0N1cnJlbnQgPSB0aGlzLmZyYWdDdXJyZW50O1xuICAgIGlmIChmcmFnQ3VycmVudCAmJiBmcmFnQ3VycmVudC5sb2FkZXIpIHtcbiAgICAgIGZyYWdDdXJyZW50LmxvYWRlci5hYm9ydCgpO1xuICAgIH1cbiAgICB0aGlzLmZyYWdDdXJyZW50ID0gbnVsbDtcbiAgICAvLyBmbHVzaCBldmVyeXRoaW5nXG4gICAgdGhpcy5mbHVzaEJ1ZmZlckNvdW50ZXIgPSAwO1xuICAgIHRoaXMuZmx1c2hSYW5nZS5wdXNoKHtzdGFydDogMCwgZW5kOiBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFl9KTtcbiAgICAvLyB0cmlnZ2VyIGEgc291cmNlQnVmZmVyIGZsdXNoXG4gICAgdGhpcy5zdGF0ZSA9IFN0YXRlLkJVRkZFUl9GTFVTSElORztcbiAgICAvLyBpbmNyZWFzZSBmcmFnbWVudCBsb2FkIEluZGV4IHRvIGF2b2lkIGZyYWcgbG9vcCBsb2FkaW5nIGVycm9yIGFmdGVyIGJ1ZmZlciBmbHVzaFxuICAgIHRoaXMuZnJhZ0xvYWRJZHggKz0gMiAqIHRoaXMuY29uZmlnLmZyYWdMb2FkaW5nTG9vcFRocmVzaG9sZDtcbiAgICAvLyBzcGVlZCB1cCBzd2l0Y2hpbmcsIHRyaWdnZXIgdGltZXIgZnVuY3Rpb25cbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4gIC8qXG4gICAgIG9uIGltbWVkaWF0ZSBsZXZlbCBzd2l0Y2ggZW5kLCBhZnRlciBuZXcgZnJhZ21lbnQgaGFzIGJlZW4gYnVmZmVyZWQgOlxuICAgICAgLSBudWRnZSB2aWRlbyBkZWNvZGVyIGJ5IHNsaWdodGx5IGFkanVzdGluZyB2aWRlbyBjdXJyZW50VGltZVxuICAgICAgLSByZXN1bWUgdGhlIHBsYXliYWNrIGlmIG5lZWRlZFxuICAqL1xuICBpbW1lZGlhdGVMZXZlbFN3aXRjaEVuZCgpIHtcbiAgICB0aGlzLmltbWVkaWF0ZVN3aXRjaCA9IGZhbHNlO1xuICAgIHRoaXMubWVkaWEuY3VycmVudFRpbWUgLT0gMC4wMDAxO1xuICAgIGlmICghdGhpcy5wcmV2aW91c2x5UGF1c2VkKSB7XG4gICAgICB0aGlzLm1lZGlhLnBsYXkoKTtcbiAgICB9XG4gIH1cblxuICBuZXh0TGV2ZWxTd2l0Y2goKSB7XG4gICAgLyogdHJ5IHRvIHN3aXRjaCBBU0FQIHdpdGhvdXQgYnJlYWtpbmcgdmlkZW8gcGxheWJhY2sgOlxuICAgICAgIGluIG9yZGVyIHRvIGVuc3VyZSBzbW9vdGggYnV0IHF1aWNrIGxldmVsIHN3aXRjaGluZyxcbiAgICAgIHdlIG5lZWQgdG8gZmluZCB0aGUgbmV4dCBmbHVzaGFibGUgYnVmZmVyIHJhbmdlXG4gICAgICB3ZSBzaG91bGQgdGFrZSBpbnRvIGFjY291bnQgbmV3IHNlZ21lbnQgZmV0Y2ggdGltZVxuICAgICovXG4gICAgdmFyIGZldGNoZGVsYXksIGN1cnJlbnRSYW5nZSwgbmV4dFJhbmdlO1xuICAgIGN1cnJlbnRSYW5nZSA9IHRoaXMuZ2V0QnVmZmVyUmFuZ2UodGhpcy5tZWRpYS5jdXJyZW50VGltZSk7XG4gICAgaWYgKGN1cnJlbnRSYW5nZSkge1xuICAgIC8vIGZsdXNoIGJ1ZmZlciBwcmVjZWRpbmcgY3VycmVudCBmcmFnbWVudCAoZmx1c2ggdW50aWwgY3VycmVudCBmcmFnbWVudCBzdGFydCBvZmZzZXQpXG4gICAgLy8gbWludXMgMXMgdG8gYXZvaWQgdmlkZW8gZnJlZXppbmcsIHRoYXQgY291bGQgaGFwcGVuIGlmIHdlIGZsdXNoIGtleWZyYW1lIG9mIGN1cnJlbnQgdmlkZW8gLi4uXG4gICAgICB0aGlzLmZsdXNoUmFuZ2UucHVzaCh7c3RhcnQ6IDAsIGVuZDogY3VycmVudFJhbmdlLnN0YXJ0IC0gMX0pO1xuICAgIH1cbiAgICBpZiAoIXRoaXMubWVkaWEucGF1c2VkKSB7XG4gICAgICAvLyBhZGQgYSBzYWZldHkgZGVsYXkgb2YgMXNcbiAgICAgIHZhciBuZXh0TGV2ZWxJZCA9IHRoaXMuaGxzLm5leHRMb2FkTGV2ZWwsbmV4dExldmVsID0gdGhpcy5sZXZlbHNbbmV4dExldmVsSWRdLCBmcmFnTGFzdEticHMgPSB0aGlzLmZyYWdMYXN0S2JwcztcbiAgICAgIGlmIChmcmFnTGFzdEticHMgJiYgdGhpcy5mcmFnQ3VycmVudCkge1xuICAgICAgICBmZXRjaGRlbGF5ID0gdGhpcy5mcmFnQ3VycmVudC5kdXJhdGlvbiAqIG5leHRMZXZlbC5iaXRyYXRlIC8gKDEwMDAgKiBmcmFnTGFzdEticHMpICsgMTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZldGNoZGVsYXkgPSAwO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBmZXRjaGRlbGF5ID0gMDtcbiAgICB9XG4gICAgLy9sb2dnZXIubG9nKCdmZXRjaGRlbGF5OicrZmV0Y2hkZWxheSk7XG4gICAgLy8gZmluZCBidWZmZXIgcmFuZ2UgdGhhdCB3aWxsIGJlIHJlYWNoZWQgb25jZSBuZXcgZnJhZ21lbnQgd2lsbCBiZSBmZXRjaGVkXG4gICAgbmV4dFJhbmdlID0gdGhpcy5nZXRCdWZmZXJSYW5nZSh0aGlzLm1lZGlhLmN1cnJlbnRUaW1lICsgZmV0Y2hkZWxheSk7XG4gICAgaWYgKG5leHRSYW5nZSkge1xuICAgICAgLy8gd2UgY2FuIGZsdXNoIGJ1ZmZlciByYW5nZSBmb2xsb3dpbmcgdGhpcyBvbmUgd2l0aG91dCBzdGFsbGluZyBwbGF5YmFja1xuICAgICAgbmV4dFJhbmdlID0gdGhpcy5mb2xsb3dpbmdCdWZmZXJSYW5nZShuZXh0UmFuZ2UpO1xuICAgICAgaWYgKG5leHRSYW5nZSkge1xuICAgICAgICAvLyBmbHVzaCBwb3NpdGlvbiBpcyB0aGUgc3RhcnQgcG9zaXRpb24gb2YgdGhpcyBuZXcgYnVmZmVyXG4gICAgICAgIHRoaXMuZmx1c2hSYW5nZS5wdXNoKHtzdGFydDogbmV4dFJhbmdlLnN0YXJ0LCBlbmQ6IE51bWJlci5QT1NJVElWRV9JTkZJTklUWX0pO1xuICAgICAgICAvLyBpZiB3ZSBhcmUgaGVyZSwgd2UgY2FuIGFsc28gY2FuY2VsIGFueSBsb2FkaW5nL2RlbXV4aW5nIGluIHByb2dyZXNzLCBhcyB0aGV5IGFyZSB1c2VsZXNzXG4gICAgICAgIHZhciBmcmFnQ3VycmVudCA9IHRoaXMuZnJhZ0N1cnJlbnQ7XG4gICAgICAgIGlmIChmcmFnQ3VycmVudCAmJiBmcmFnQ3VycmVudC5sb2FkZXIpIHtcbiAgICAgICAgICBmcmFnQ3VycmVudC5sb2FkZXIuYWJvcnQoKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmZyYWdDdXJyZW50ID0gbnVsbDtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHRoaXMuZmx1c2hSYW5nZS5sZW5ndGgpIHtcbiAgICAgIHRoaXMuZmx1c2hCdWZmZXJDb3VudGVyID0gMDtcbiAgICAgIC8vIHRyaWdnZXIgYSBzb3VyY2VCdWZmZXIgZmx1c2hcbiAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5CVUZGRVJfRkxVU0hJTkc7XG4gICAgICAvLyBpbmNyZWFzZSBmcmFnbWVudCBsb2FkIEluZGV4IHRvIGF2b2lkIGZyYWcgbG9vcCBsb2FkaW5nIGVycm9yIGFmdGVyIGJ1ZmZlciBmbHVzaFxuICAgICAgdGhpcy5mcmFnTG9hZElkeCArPSAyICogdGhpcy5jb25maWcuZnJhZ0xvYWRpbmdMb29wVGhyZXNob2xkO1xuICAgICAgLy8gc3BlZWQgdXAgc3dpdGNoaW5nLCB0cmlnZ2VyIHRpbWVyIGZ1bmN0aW9uXG4gICAgICB0aGlzLnRpY2soKTtcbiAgICB9XG4gIH1cblxuICBvbk1lZGlhQXR0YWNoaW5nKGV2ZW50LCBkYXRhKSB7XG4gICAgdmFyIG1lZGlhID0gdGhpcy5tZWRpYSA9IGRhdGEubWVkaWE7XG4gICAgLy8gc2V0dXAgdGhlIG1lZGlhIHNvdXJjZVxuICAgIHZhciBtcyA9IHRoaXMubWVkaWFTb3VyY2UgPSBuZXcgTWVkaWFTb3VyY2UoKTtcbiAgICAvL01lZGlhIFNvdXJjZSBsaXN0ZW5lcnNcbiAgICB0aGlzLm9ubXNvID0gdGhpcy5vbk1lZGlhU291cmNlT3Blbi5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25tc2UgPSB0aGlzLm9uTWVkaWFTb3VyY2VFbmRlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25tc2MgPSB0aGlzLm9uTWVkaWFTb3VyY2VDbG9zZS5iaW5kKHRoaXMpO1xuICAgIG1zLmFkZEV2ZW50TGlzdGVuZXIoJ3NvdXJjZW9wZW4nLCB0aGlzLm9ubXNvKTtcbiAgICBtcy5hZGRFdmVudExpc3RlbmVyKCdzb3VyY2VlbmRlZCcsIHRoaXMub25tc2UpO1xuICAgIG1zLmFkZEV2ZW50TGlzdGVuZXIoJ3NvdXJjZWNsb3NlJywgdGhpcy5vbm1zYyk7XG4gICAgLy8gbGluayB2aWRlbyBhbmQgbWVkaWEgU291cmNlXG4gICAgbWVkaWEuc3JjID0gVVJMLmNyZWF0ZU9iamVjdFVSTChtcyk7XG4gICAgLy8gRklYTUU6IHRoaXMgd2FzIGluIGNvZGUgYmVmb3JlIGJ1dCBvbnZlcnJvciB3YXMgbmV2ZXIgc2V0ISBjYW4gYmUgcmVtb3ZlZCBvciBmaXhlZD9cbiAgICAvL21lZGlhLmFkZEV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgdGhpcy5vbnZlcnJvcik7XG4gIH1cblxuICBvbk1lZGlhRGV0YWNoaW5nKCkge1xuICAgIHZhciBtZWRpYSA9IHRoaXMubWVkaWE7XG4gICAgaWYgKG1lZGlhICYmIG1lZGlhLmVuZGVkKSB7XG4gICAgICBsb2dnZXIubG9nKCdNU0UgZGV0YWNoaW5nIGFuZCB2aWRlbyBlbmRlZCwgcmVzZXQgc3RhcnRQb3NpdGlvbicpO1xuICAgICAgdGhpcy5zdGFydFBvc2l0aW9uID0gdGhpcy5sYXN0Q3VycmVudFRpbWUgPSAwO1xuICAgIH1cblxuICAgIC8vIHJlc2V0IGZyYWdtZW50IGxvYWRpbmcgY291bnRlciBvbiBNU0UgZGV0YWNoaW5nIHRvIGF2b2lkIHJlcG9ydGluZyBGUkFHX0xPT1BfTE9BRElOR19FUlJPUiBhZnRlciBlcnJvciByZWNvdmVyeVxuICAgIHZhciBsZXZlbHMgPSB0aGlzLmxldmVscztcbiAgICBpZiAobGV2ZWxzKSB7XG4gICAgICAvLyByZXNldCBmcmFnbWVudCBsb2FkIGNvdW50ZXJcbiAgICAgICAgbGV2ZWxzLmZvckVhY2gobGV2ZWwgPT4ge1xuICAgICAgICAgIGlmKGxldmVsLmRldGFpbHMpIHtcbiAgICAgICAgICAgIGxldmVsLmRldGFpbHMuZnJhZ21lbnRzLmZvckVhY2goZnJhZ21lbnQgPT4ge1xuICAgICAgICAgICAgICBmcmFnbWVudC5sb2FkQ291bnRlciA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgICB2YXIgbXMgPSB0aGlzLm1lZGlhU291cmNlO1xuICAgIGlmIChtcykge1xuICAgICAgaWYgKG1zLnJlYWR5U3RhdGUgPT09ICdvcGVuJykge1xuICAgICAgICBtcy5lbmRPZlN0cmVhbSgpO1xuICAgICAgfVxuICAgICAgbXMucmVtb3ZlRXZlbnRMaXN0ZW5lcignc291cmNlb3BlbicsIHRoaXMub25tc28pO1xuICAgICAgbXMucmVtb3ZlRXZlbnRMaXN0ZW5lcignc291cmNlZW5kZWQnLCB0aGlzLm9ubXNlKTtcbiAgICAgIG1zLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NvdXJjZWNsb3NlJywgdGhpcy5vbm1zYyk7XG4gICAgICAvLyB1bmxpbmsgTWVkaWFTb3VyY2UgZnJvbSB2aWRlbyB0YWdcbiAgICAgIHRoaXMubWVkaWEuc3JjID0gJyc7XG4gICAgICB0aGlzLm1lZGlhU291cmNlID0gbnVsbDtcbiAgICAgIC8vIHJlbW92ZSB2aWRlbyBsaXN0ZW5lcnNcbiAgICAgIGlmIChtZWRpYSkge1xuICAgICAgICBtZWRpYS5yZW1vdmVFdmVudExpc3RlbmVyKCdzZWVraW5nJywgdGhpcy5vbnZzZWVraW5nKTtcbiAgICAgICAgbWVkaWEucmVtb3ZlRXZlbnRMaXN0ZW5lcignc2Vla2VkJywgdGhpcy5vbnZzZWVrZWQpO1xuICAgICAgICBtZWRpYS5yZW1vdmVFdmVudExpc3RlbmVyKCdsb2FkZWRtZXRhZGF0YScsIHRoaXMub252bWV0YWRhdGEpO1xuICAgICAgICBtZWRpYS5yZW1vdmVFdmVudExpc3RlbmVyKCdlbmRlZCcsIHRoaXMub252ZW5kZWQpO1xuICAgICAgICB0aGlzLm9udnNlZWtpbmcgPSB0aGlzLm9udnNlZWtlZCA9IHRoaXMub252bWV0YWRhdGEgPSBudWxsO1xuICAgICAgfVxuICAgICAgdGhpcy5tZWRpYSA9IG51bGw7XG4gICAgICB0aGlzLmxvYWRlZG1ldGFkYXRhID0gZmFsc2U7XG4gICAgICB0aGlzLnN0b3AoKTtcbiAgICB9XG4gICAgdGhpcy5vbm1zbyA9IHRoaXMub25tc2UgPSB0aGlzLm9ubXNjID0gbnVsbDtcbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50Lk1FRElBX0RFVEFDSEVEKTtcbiAgfVxuXG4gIG9uTWVkaWFTZWVraW5nKCkge1xuICAgIGlmICh0aGlzLnN0YXRlID09PSBTdGF0ZS5GUkFHX0xPQURJTkcpIHtcbiAgICAgIC8vIGNoZWNrIGlmIGN1cnJlbnRseSBsb2FkZWQgZnJhZ21lbnQgaXMgaW5zaWRlIGJ1ZmZlci5cbiAgICAgIC8vaWYgb3V0c2lkZSwgY2FuY2VsIGZyYWdtZW50IGxvYWRpbmcsIG90aGVyd2lzZSBkbyBub3RoaW5nXG4gICAgICBpZiAodGhpcy5idWZmZXJJbmZvKHRoaXMubWVkaWEuY3VycmVudFRpbWUsMC4zKS5sZW4gPT09IDApIHtcbiAgICAgICAgbG9nZ2VyLmxvZygnc2Vla2luZyBvdXRzaWRlIG9mIGJ1ZmZlciB3aGlsZSBmcmFnbWVudCBsb2FkIGluIHByb2dyZXNzLCBjYW5jZWwgZnJhZ21lbnQgbG9hZCcpO1xuICAgICAgICB2YXIgZnJhZ0N1cnJlbnQgPSB0aGlzLmZyYWdDdXJyZW50O1xuICAgICAgICBpZiAoZnJhZ0N1cnJlbnQpIHtcbiAgICAgICAgICBpZiAoZnJhZ0N1cnJlbnQubG9hZGVyKSB7XG4gICAgICAgICAgICBmcmFnQ3VycmVudC5sb2FkZXIuYWJvcnQoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5mcmFnQ3VycmVudCA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5mcmFnUHJldmlvdXMgPSBudWxsO1xuICAgICAgICAvLyBzd2l0Y2ggdG8gSURMRSBzdGF0ZSB0byBsb2FkIG5ldyBmcmFnbWVudFxuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHRoaXMubWVkaWEpIHtcbiAgICAgIHRoaXMubGFzdEN1cnJlbnRUaW1lID0gdGhpcy5tZWRpYS5jdXJyZW50VGltZTtcbiAgICB9XG4gICAgLy8gYXZvaWQgcmVwb3J0aW5nIGZyYWdtZW50IGxvb3AgbG9hZGluZyBlcnJvciBpbiBjYXNlIHVzZXIgaXMgc2Vla2luZyBzZXZlcmFsIHRpbWVzIG9uIHNhbWUgcG9zaXRpb25cbiAgICBpZiAodGhpcy5mcmFnTG9hZElkeCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLmZyYWdMb2FkSWR4ICs9IDIgKiB0aGlzLmNvbmZpZy5mcmFnTG9hZGluZ0xvb3BUaHJlc2hvbGQ7XG4gICAgfVxuICAgIC8vIHRpY2sgdG8gc3BlZWQgdXAgcHJvY2Vzc2luZ1xuICAgIHRoaXMudGljaygpO1xuICB9XG5cbiAgb25NZWRpYVNlZWtlZCgpIHtcbiAgICAvLyB0aWNrIHRvIHNwZWVkIHVwIEZSQUdNRU5UX1BMQVlJTkcgdHJpZ2dlcmluZ1xuICAgIHRoaXMudGljaygpO1xuICB9XG5cbiAgb25NZWRpYU1ldGFkYXRhKCkge1xuICAgIGlmICh0aGlzLm1lZGlhLmN1cnJlbnRUaW1lICE9PSB0aGlzLnN0YXJ0UG9zaXRpb24pIHtcbiAgICAgIHRoaXMubWVkaWEuY3VycmVudFRpbWUgPSB0aGlzLnN0YXJ0UG9zaXRpb247XG4gICAgfVxuICAgIHRoaXMubG9hZGVkbWV0YWRhdGEgPSB0cnVlO1xuICAgIHRoaXMudGljaygpO1xuICB9XG5cbiAgb25NZWRpYUVuZGVkKCkge1xuICAgIGxvZ2dlci5sb2coJ21lZGlhIGVuZGVkJyk7XG4gICAgLy8gcmVzZXQgc3RhcnRQb3NpdGlvbiBhbmQgbGFzdEN1cnJlbnRUaW1lIHRvIHJlc3RhcnQgcGxheWJhY2sgQCBzdHJlYW0gYmVnaW5uaW5nXG4gICAgdGhpcy5zdGFydFBvc2l0aW9uID0gdGhpcy5sYXN0Q3VycmVudFRpbWUgPSAwO1xuICB9XG5cblxuICBvbk1hbmlmZXN0UGFyc2VkKGV2ZW50LCBkYXRhKSB7XG4gICAgdmFyIGFhYyA9IGZhbHNlLCBoZWFhYyA9IGZhbHNlLCBjb2RlY3M7XG4gICAgZGF0YS5sZXZlbHMuZm9yRWFjaChsZXZlbCA9PiB7XG4gICAgICAvLyBkZXRlY3QgaWYgd2UgaGF2ZSBkaWZmZXJlbnQga2luZCBvZiBhdWRpbyBjb2RlY3MgdXNlZCBhbW9uZ3N0IHBsYXlsaXN0c1xuICAgICAgY29kZWNzID0gbGV2ZWwuY29kZWNzO1xuICAgICAgaWYgKGNvZGVjcykge1xuICAgICAgICBpZiAoY29kZWNzLmluZGV4T2YoJ21wNGEuNDAuMicpICE9PSAtMSkge1xuICAgICAgICAgIGFhYyA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvZGVjcy5pbmRleE9mKCdtcDRhLjQwLjUnKSAhPT0gLTEpIHtcbiAgICAgICAgICBoZWFhYyA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgICB0aGlzLmF1ZGlvY29kZWNzd2l0Y2ggPSAoYWFjICYmIGhlYWFjKTtcbiAgICBpZiAodGhpcy5hdWRpb2NvZGVjc3dpdGNoKSB7XG4gICAgICBsb2dnZXIubG9nKCdib3RoIEFBQy9IRS1BQUMgYXVkaW8gZm91bmQgaW4gbGV2ZWxzOyBkZWNsYXJpbmcgYXVkaW8gY29kZWMgYXMgSEUtQUFDJyk7XG4gICAgfVxuICAgIHRoaXMubGV2ZWxzID0gZGF0YS5sZXZlbHM7XG4gICAgdGhpcy5zdGFydExldmVsTG9hZGVkID0gZmFsc2U7XG4gICAgdGhpcy5zdGFydEZyYWdtZW50UmVxdWVzdGVkID0gZmFsc2U7XG4gICAgaWYgKHRoaXMubWVkaWEgJiYgdGhpcy5jb25maWcuYXV0b1N0YXJ0TG9hZCkge1xuICAgICAgdGhpcy5zdGFydExvYWQoKTtcbiAgICB9XG4gIH1cblxuICBvbkxldmVsTG9hZGVkKGV2ZW50LGRhdGEpIHtcbiAgICB2YXIgbmV3RGV0YWlscyA9IGRhdGEuZGV0YWlscyxcbiAgICAgICAgbmV3TGV2ZWxJZCA9IGRhdGEubGV2ZWwsXG4gICAgICAgIGN1ckxldmVsID0gdGhpcy5sZXZlbHNbbmV3TGV2ZWxJZF0sXG4gICAgICAgIGR1cmF0aW9uID0gbmV3RGV0YWlscy50b3RhbGR1cmF0aW9uO1xuXG4gICAgbG9nZ2VyLmxvZyhgbGV2ZWwgJHtuZXdMZXZlbElkfSBsb2FkZWQgWyR7bmV3RGV0YWlscy5zdGFydFNOfSwke25ld0RldGFpbHMuZW5kU059XSxkdXJhdGlvbjoke2R1cmF0aW9ufWApO1xuXG4gICAgaWYgKG5ld0RldGFpbHMubGl2ZSkge1xuICAgICAgdmFyIGN1ckRldGFpbHMgPSBjdXJMZXZlbC5kZXRhaWxzO1xuICAgICAgaWYgKGN1ckRldGFpbHMpIHtcbiAgICAgICAgLy8gd2UgYWxyZWFkeSBoYXZlIGRldGFpbHMgZm9yIHRoYXQgbGV2ZWwsIG1lcmdlIHRoZW1cbiAgICAgICAgTGV2ZWxIZWxwZXIubWVyZ2VEZXRhaWxzKGN1ckRldGFpbHMsbmV3RGV0YWlscyk7XG4gICAgICAgIGlmIChuZXdEZXRhaWxzLlBUU0tub3duKSB7XG4gICAgICAgICAgbG9nZ2VyLmxvZyhgbGl2ZSBwbGF5bGlzdCBzbGlkaW5nOiR7bmV3RGV0YWlscy5mcmFnbWVudHNbMF0uc3RhcnQudG9GaXhlZCgzKX1gKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsb2dnZXIubG9nKCdsaXZlIHBsYXlsaXN0IC0gb3V0ZGF0ZWQgUFRTLCB1bmtub3duIHNsaWRpbmcnKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbmV3RGV0YWlscy5QVFNLbm93biA9IGZhbHNlO1xuICAgICAgICBsb2dnZXIubG9nKCdsaXZlIHBsYXlsaXN0IC0gZmlyc3QgbG9hZCwgdW5rbm93biBzbGlkaW5nJyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIG5ld0RldGFpbHMuUFRTS25vd24gPSBmYWxzZTtcbiAgICB9XG4gICAgLy8gb3ZlcnJpZGUgbGV2ZWwgaW5mb1xuICAgIGN1ckxldmVsLmRldGFpbHMgPSBuZXdEZXRhaWxzO1xuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuTEVWRUxfVVBEQVRFRCwgeyBkZXRhaWxzOiBuZXdEZXRhaWxzLCBsZXZlbDogbmV3TGV2ZWxJZCB9KTtcblxuICAgIC8vIGNvbXB1dGUgc3RhcnQgcG9zaXRpb25cbiAgICBpZiAodGhpcy5zdGFydExldmVsTG9hZGVkID09PSBmYWxzZSkge1xuICAgICAgLy8gaWYgbGl2ZSBwbGF5bGlzdCwgc2V0IHN0YXJ0IHBvc2l0aW9uIHRvIGJlIGZyYWdtZW50IE4tdGhpcy5jb25maWcubGl2ZVN5bmNEdXJhdGlvbkNvdW50ICh1c3VhbGx5IDMpXG4gICAgICBpZiAobmV3RGV0YWlscy5saXZlKSB7XG4gICAgICAgIHRoaXMuc3RhcnRQb3NpdGlvbiA9IE1hdGgubWF4KDAsIGR1cmF0aW9uIC0gdGhpcy5jb25maWcubGl2ZVN5bmNEdXJhdGlvbkNvdW50ICogbmV3RGV0YWlscy50YXJnZXRkdXJhdGlvbik7XG4gICAgICB9XG4gICAgICB0aGlzLm5leHRMb2FkUG9zaXRpb24gPSB0aGlzLnN0YXJ0UG9zaXRpb247XG4gICAgICB0aGlzLnN0YXJ0TGV2ZWxMb2FkZWQgPSB0cnVlO1xuICAgIH1cbiAgICAvLyBvbmx5IHN3aXRjaCBiYXRjayB0byBJRExFIHN0YXRlIGlmIHdlIHdlcmUgd2FpdGluZyBmb3IgbGV2ZWwgdG8gc3RhcnQgZG93bmxvYWRpbmcgYSBuZXcgZnJhZ21lbnRcbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gU3RhdGUuV0FJVElOR19MRVZFTCkge1xuICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gICAgfVxuICAgIC8vdHJpZ2dlciBoYW5kbGVyIHJpZ2h0IG5vd1xuICAgIHRoaXMudGljaygpO1xuICB9XG5cbiAgb25LZXlMb2FkZWQoKSB7XG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IFN0YXRlLktFWV9MT0FESU5HKSB7XG4gICAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICAgIHRoaXMudGljaygpO1xuICAgIH1cbiAgfVxuXG4gIG9uRnJhZ0xvYWRlZChldmVudCwgZGF0YSkge1xuICAgIHZhciBmcmFnQ3VycmVudCA9IHRoaXMuZnJhZ0N1cnJlbnQ7XG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IFN0YXRlLkZSQUdfTE9BRElORyAmJlxuICAgICAgICBmcmFnQ3VycmVudCAmJlxuICAgICAgICBkYXRhLmZyYWcubGV2ZWwgPT09IGZyYWdDdXJyZW50LmxldmVsICYmXG4gICAgICAgIGRhdGEuZnJhZy5zbiA9PT0gZnJhZ0N1cnJlbnQuc24pIHtcbiAgICAgIGlmICh0aGlzLmZyYWdCaXRyYXRlVGVzdCA9PT0gdHJ1ZSkge1xuICAgICAgICAvLyBzd2l0Y2ggYmFjayB0byBJRExFIHN0YXRlIC4uLiB3ZSBqdXN0IGxvYWRlZCBhIGZyYWdtZW50IHRvIGRldGVybWluZSBhZGVxdWF0ZSBzdGFydCBiaXRyYXRlIGFuZCBpbml0aWFsaXplIGF1dG9zd2l0Y2ggYWxnb1xuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICAgICAgdGhpcy5mcmFnQml0cmF0ZVRlc3QgPSBmYWxzZTtcbiAgICAgICAgZGF0YS5zdGF0cy50cGFyc2VkID0gZGF0YS5zdGF0cy50YnVmZmVyZWQgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5GUkFHX0JVRkZFUkVELCB7c3RhdHM6IGRhdGEuc3RhdHMsIGZyYWc6IGZyYWdDdXJyZW50fSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuUEFSU0lORztcbiAgICAgICAgLy8gdHJhbnNtdXggdGhlIE1QRUctVFMgZGF0YSB0byBJU08tQk1GRiBzZWdtZW50c1xuICAgICAgICB0aGlzLnN0YXRzID0gZGF0YS5zdGF0cztcbiAgICAgICAgdmFyIGN1cnJlbnRMZXZlbCA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdLFxuICAgICAgICAgICAgZGV0YWlscyA9IGN1cnJlbnRMZXZlbC5kZXRhaWxzLFxuICAgICAgICAgICAgZHVyYXRpb24gPSBkZXRhaWxzLnRvdGFsZHVyYXRpb24sXG4gICAgICAgICAgICBzdGFydCA9IGZyYWdDdXJyZW50LnN0YXJ0LFxuICAgICAgICAgICAgbGV2ZWwgPSBmcmFnQ3VycmVudC5sZXZlbCxcbiAgICAgICAgICAgIHNuID0gZnJhZ0N1cnJlbnQuc247XG4gICAgICAgIGxvZ2dlci5sb2coYERlbXV4aW5nICR7c259IG9mIFske2RldGFpbHMuc3RhcnRTTn0gLCR7ZGV0YWlscy5lbmRTTn1dLGxldmVsICR7bGV2ZWx9YCk7XG4gICAgICAgIHRoaXMuZGVtdXhlci5wdXNoKGRhdGEucGF5bG9hZCwgY3VycmVudExldmVsLmF1ZGlvQ29kZWMsIGN1cnJlbnRMZXZlbC52aWRlb0NvZGVjLCBzdGFydCwgZnJhZ0N1cnJlbnQuY2MsIGxldmVsLCBzbiwgZHVyYXRpb24sIGZyYWdDdXJyZW50LmRlY3J5cHRkYXRhKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBvbkluaXRTZWdtZW50KGV2ZW50LCBkYXRhKSB7XG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IFN0YXRlLlBBUlNJTkcpIHtcbiAgICAgIC8vIGNoZWNrIGlmIGNvZGVjcyBoYXZlIGJlZW4gZXhwbGljaXRlbHkgZGVmaW5lZCBpbiB0aGUgbWFzdGVyIHBsYXlsaXN0IGZvciB0aGlzIGxldmVsO1xuICAgICAgLy8gaWYgeWVzIHVzZSB0aGVzZSBvbmVzIGluc3RlYWQgb2YgdGhlIG9uZXMgcGFyc2VkIGZyb20gdGhlIGRlbXV4XG4gICAgICB2YXIgYXVkaW9Db2RlYyA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdLmF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMgPSB0aGlzLmxldmVsc1t0aGlzLmxldmVsXS52aWRlb0NvZGVjLCBzYjtcbiAgICAgIC8vbG9nZ2VyLmxvZygncGxheWxpc3QgbGV2ZWwgQS9WIGNvZGVjczonICsgYXVkaW9Db2RlYyArICcsJyArIHZpZGVvQ29kZWMpO1xuICAgICAgLy9sb2dnZXIubG9nKCdwbGF5bGlzdCBjb2RlY3M6JyArIGNvZGVjKTtcbiAgICAgIC8vIGlmIHBsYXlsaXN0IGRvZXMgbm90IHNwZWNpZnkgY29kZWNzLCB1c2UgY29kZWNzIGZvdW5kIHdoaWxlIHBhcnNpbmcgZnJhZ21lbnRcbiAgICAgIGlmIChhdWRpb0NvZGVjID09PSB1bmRlZmluZWQgfHwgZGF0YS5hdWRpb2NvZGVjID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgYXVkaW9Db2RlYyA9IGRhdGEuYXVkaW9Db2RlYztcbiAgICAgIH1cbiAgICAgIGlmICh2aWRlb0NvZGVjID09PSB1bmRlZmluZWQgfHwgZGF0YS52aWRlb2NvZGVjID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdmlkZW9Db2RlYyA9IGRhdGEudmlkZW9Db2RlYztcbiAgICAgIH1cbiAgICAgIC8vIGluIGNhc2Ugc2V2ZXJhbCBhdWRpbyBjb2RlY3MgbWlnaHQgYmUgdXNlZCwgZm9yY2UgSEUtQUFDIGZvciBhdWRpbyAoc29tZSBicm93c2VycyBkb24ndCBzdXBwb3J0IGF1ZGlvIGNvZGVjIHN3aXRjaClcbiAgICAgIC8vZG9uJ3QgZG8gaXQgZm9yIG1vbm8gc3RyZWFtcyAuLi5cbiAgICAgIHZhciB1YSA9IG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKTtcbiAgICAgIGlmICh0aGlzLmF1ZGlvY29kZWNzd2l0Y2ggJiZcbiAgICAgICAgIGRhdGEuYXVkaW9DaGFubmVsQ291bnQgIT09IDEgJiZcbiAgICAgICAgICB1YS5pbmRleE9mKCdhbmRyb2lkJykgPT09IC0xICYmXG4gICAgICAgICAgdWEuaW5kZXhPZignZmlyZWZveCcpID09PSAtMSkge1xuICAgICAgICBhdWRpb0NvZGVjID0gJ21wNGEuNDAuNSc7XG4gICAgICB9XG4gICAgICBpZiAoIXRoaXMuc291cmNlQnVmZmVyKSB7XG4gICAgICAgIHRoaXMuc291cmNlQnVmZmVyID0ge307XG4gICAgICAgIGxvZ2dlci5sb2coYHNlbGVjdGVkIEEvViBjb2RlY3MgZm9yIHNvdXJjZUJ1ZmZlcnM6JHthdWRpb0NvZGVjfSwke3ZpZGVvQ29kZWN9YCk7XG4gICAgICAgIC8vIGNyZWF0ZSBzb3VyY2UgQnVmZmVyIGFuZCBsaW5rIHRoZW0gdG8gTWVkaWFTb3VyY2VcbiAgICAgICAgaWYgKGF1ZGlvQ29kZWMpIHtcbiAgICAgICAgICBzYiA9IHRoaXMuc291cmNlQnVmZmVyLmF1ZGlvID0gdGhpcy5tZWRpYVNvdXJjZS5hZGRTb3VyY2VCdWZmZXIoYHZpZGVvL21wNDtjb2RlY3M9JHthdWRpb0NvZGVjfWApO1xuICAgICAgICAgIHNiLmFkZEV2ZW50TGlzdGVuZXIoJ3VwZGF0ZWVuZCcsIHRoaXMub25zYnVlKTtcbiAgICAgICAgICBzYi5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsIHRoaXMub25zYmUpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh2aWRlb0NvZGVjKSB7XG4gICAgICAgICAgc2IgPSB0aGlzLnNvdXJjZUJ1ZmZlci52aWRlbyA9IHRoaXMubWVkaWFTb3VyY2UuYWRkU291cmNlQnVmZmVyKGB2aWRlby9tcDQ7Y29kZWNzPSR7dmlkZW9Db2RlY31gKTtcbiAgICAgICAgICBzYi5hZGRFdmVudExpc3RlbmVyKCd1cGRhdGVlbmQnLCB0aGlzLm9uc2J1ZSk7XG4gICAgICAgICAgc2IuYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLCB0aGlzLm9uc2JlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKGF1ZGlvQ29kZWMpIHtcbiAgICAgICAgdGhpcy5tcDRzZWdtZW50cy5wdXNoKHt0eXBlOiAnYXVkaW8nLCBkYXRhOiBkYXRhLmF1ZGlvTW9vdn0pO1xuICAgICAgfVxuICAgICAgaWYodmlkZW9Db2RlYykge1xuICAgICAgICB0aGlzLm1wNHNlZ21lbnRzLnB1c2goe3R5cGU6ICd2aWRlbycsIGRhdGE6IGRhdGEudmlkZW9Nb292fSk7XG4gICAgICB9XG4gICAgICAvL3RyaWdnZXIgaGFuZGxlciByaWdodCBub3dcbiAgICAgIHRoaXMudGljaygpO1xuICAgIH1cbiAgfVxuXG4gIG9uRnJhZ1BhcnNpbmcoZXZlbnQsIGRhdGEpIHtcbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gU3RhdGUuUEFSU0lORykge1xuICAgICAgdGhpcy50cGFyc2UyID0gRGF0ZS5ub3coKTtcbiAgICAgIHZhciBsZXZlbCA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdLFxuICAgICAgICAgIGZyYWcgPSB0aGlzLmZyYWdDdXJyZW50O1xuICAgICAgbG9nZ2VyLmxvZyhgcGFyc2VkIGRhdGEsIHR5cGUvc3RhcnRQVFMvZW5kUFRTL3N0YXJ0RFRTL2VuZERUUy9uYjoke2RhdGEudHlwZX0vJHtkYXRhLnN0YXJ0UFRTLnRvRml4ZWQoMyl9LyR7ZGF0YS5lbmRQVFMudG9GaXhlZCgzKX0vJHtkYXRhLnN0YXJ0RFRTLnRvRml4ZWQoMyl9LyR7ZGF0YS5lbmREVFMudG9GaXhlZCgzKX0vJHtkYXRhLm5ifWApO1xuICAgICAgdmFyIGRyaWZ0ID0gTGV2ZWxIZWxwZXIudXBkYXRlRnJhZ1BUUyhsZXZlbC5kZXRhaWxzLGZyYWcuc24sZGF0YS5zdGFydFBUUyxkYXRhLmVuZFBUUyk7XG4gICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkxFVkVMX1BUU19VUERBVEVELCB7ZGV0YWlsczogbGV2ZWwuZGV0YWlscywgbGV2ZWw6IHRoaXMubGV2ZWwsIGRyaWZ0OiBkcmlmdH0pO1xuXG4gICAgICB0aGlzLm1wNHNlZ21lbnRzLnB1c2goe3R5cGU6IGRhdGEudHlwZSwgZGF0YTogZGF0YS5tb29mfSk7XG4gICAgICB0aGlzLm1wNHNlZ21lbnRzLnB1c2goe3R5cGU6IGRhdGEudHlwZSwgZGF0YTogZGF0YS5tZGF0fSk7XG4gICAgICB0aGlzLm5leHRMb2FkUG9zaXRpb24gPSBkYXRhLmVuZFBUUztcbiAgICAgIHRoaXMuYnVmZmVyUmFuZ2UucHVzaCh7dHlwZTogZGF0YS50eXBlLCBzdGFydDogZGF0YS5zdGFydFBUUywgZW5kOiBkYXRhLmVuZFBUUywgZnJhZzogZnJhZ30pO1xuXG4gICAgICAvL3RyaWdnZXIgaGFuZGxlciByaWdodCBub3dcbiAgICAgIHRoaXMudGljaygpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsb2dnZXIud2Fybihgbm90IGluIFBBUlNJTkcgc3RhdGUsIGRpc2NhcmRpbmcgJHtldmVudH1gKTtcbiAgICB9XG4gIH1cblxuICBvbkZyYWdQYXJzZWQoKSB7XG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IFN0YXRlLlBBUlNJTkcpIHtcbiAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5QQVJTRUQ7XG4gICAgICB0aGlzLnN0YXRzLnRwYXJzZWQgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgIC8vdHJpZ2dlciBoYW5kbGVyIHJpZ2h0IG5vd1xuICAgICAgdGhpcy50aWNrKCk7XG4gICAgfVxuICB9XG5cbiAgb25FcnJvcihldmVudCwgZGF0YSkge1xuICAgIHN3aXRjaChkYXRhLmRldGFpbHMpIHtcbiAgICAgIC8vIGFib3J0IGZyYWdtZW50IGxvYWRpbmcgb24gZXJyb3JzXG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5GUkFHX0xPQURfRVJST1I6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5GUkFHX0xPQURfVElNRU9VVDpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkZSQUdfTE9PUF9MT0FESU5HX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuTEVWRUxfTE9BRF9FUlJPUjpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkxFVkVMX0xPQURfVElNRU9VVDpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLktFWV9MT0FEX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuS0VZX0xPQURfVElNRU9VVDpcbiAgICAgICAgLy8gaWYgZmF0YWwgZXJyb3IsIHN0b3AgcHJvY2Vzc2luZywgb3RoZXJ3aXNlIG1vdmUgdG8gSURMRSB0byByZXRyeSBsb2FkaW5nXG4gICAgICAgIGxvZ2dlci53YXJuKGBidWZmZXIgY29udHJvbGxlcjogJHtkYXRhLmRldGFpbHN9IHdoaWxlIGxvYWRpbmcgZnJhZyxzd2l0Y2ggdG8gJHtkYXRhLmZhdGFsID8gJ0VSUk9SJyA6ICdJRExFJ30gc3RhdGUgLi4uYCk7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBkYXRhLmZhdGFsID8gU3RhdGUuRVJST1IgOiBTdGF0ZS5JRExFO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIG9uU0JVcGRhdGVFbmQoKSB7XG4gICAgLy90cmlnZ2VyIGhhbmRsZXIgcmlnaHQgbm93XG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IFN0YXRlLkFQUEVORElORyAmJiB0aGlzLm1wNHNlZ21lbnRzLmxlbmd0aCA9PT0gMCkgIHtcbiAgICAgIHZhciBmcmFnID0gdGhpcy5mcmFnQ3VycmVudCwgc3RhdHMgPSB0aGlzLnN0YXRzO1xuICAgICAgaWYgKGZyYWcpIHtcbiAgICAgICAgdGhpcy5mcmFnUHJldmlvdXMgPSBmcmFnO1xuICAgICAgICBzdGF0cy50YnVmZmVyZWQgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgdGhpcy5mcmFnTGFzdEticHMgPSBNYXRoLnJvdW5kKDggKiBzdGF0cy5sZW5ndGggLyAoc3RhdHMudGJ1ZmZlcmVkIC0gc3RhdHMudGZpcnN0KSk7XG4gICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRlJBR19CVUZGRVJFRCwge3N0YXRzOiBzdGF0cywgZnJhZzogZnJhZ30pO1xuICAgICAgICBsb2dnZXIubG9nKGBtZWRpYSBidWZmZXJlZCA6ICR7dGhpcy50aW1lUmFuZ2VzVG9TdHJpbmcodGhpcy5tZWRpYS5idWZmZXJlZCl9YCk7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG5fY2hlY2tCdWZmZXIoKSB7XG4gICAgdmFyIG1lZGlhID0gdGhpcy5tZWRpYTtcbiAgICBpZihtZWRpYSkge1xuICAgICAgLy8gY29tcGFyZSByZWFkeVN0YXRlXG4gICAgICB2YXIgcmVhZHlTdGF0ZSA9IG1lZGlhLnJlYWR5U3RhdGU7XG4gICAgICAvL2xvZ2dlci5sb2coYHJlYWR5U3RhdGU6JHtyZWFkeVN0YXRlfWApO1xuICAgICAgLy8gaWYgcmVhZHkgc3RhdGUgZGlmZmVyZW50IGZyb20gSEFWRV9OT1RISU5HIChudW1lcmljIHZhbHVlIDApLCB3ZSBhcmUgYWxsb3dlZCB0byBzZWVrXG4gICAgICBpZihyZWFkeVN0YXRlKSB7XG4gICAgICAgIC8vIGlmIHNlZWsgYWZ0ZXIgYnVmZmVyZWQgZGVmaW5lZCwgbGV0J3Mgc2VlayBpZiB3aXRoaW4gYWNjZXB0YWJsZSByYW5nZVxuICAgICAgICB2YXIgc2Vla0FmdGVyQnVmZmVyZWQgPSB0aGlzLnNlZWtBZnRlckJ1ZmZlcmVkO1xuICAgICAgICBpZihzZWVrQWZ0ZXJCdWZmZXJlZCkge1xuICAgICAgICAgIGlmKG1lZGlhLmR1cmF0aW9uID49IHNlZWtBZnRlckJ1ZmZlcmVkKSB7XG4gICAgICAgICAgICBtZWRpYS5jdXJyZW50VGltZSA9IHNlZWtBZnRlckJ1ZmZlcmVkO1xuICAgICAgICAgICAgdGhpcy5zZWVrQWZ0ZXJCdWZmZXJlZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZihyZWFkeVN0YXRlIDwgMyApIHtcbiAgICAgICAgICAvLyByZWFkeVN0YXRlID0gMSBvciAyXG4gICAgICAgICAgLy8gIEhBVkVfTUVUQURBVEEgKG51bWVyaWMgdmFsdWUgMSkgICAgIEVub3VnaCBvZiB0aGUgcmVzb3VyY2UgaGFzIGJlZW4gb2J0YWluZWQgdGhhdCB0aGUgZHVyYXRpb24gb2YgdGhlIHJlc291cmNlIGlzIGF2YWlsYWJsZS5cbiAgICAgICAgICAvLyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFRoZSBBUEkgd2lsbCBubyBsb25nZXIgdGhyb3cgYW4gZXhjZXB0aW9uIHdoZW4gc2Vla2luZy5cbiAgICAgICAgICAvLyBIQVZFX0NVUlJFTlRfREFUQSAobnVtZXJpYyB2YWx1ZSAyKSAgRGF0YSBmb3IgdGhlIGltbWVkaWF0ZSBjdXJyZW50IHBsYXliYWNrIHBvc2l0aW9uIGlzIGF2YWlsYWJsZSxcbiAgICAgICAgICAvLyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnV0IGVpdGhlciBub3QgZW5vdWdoIGRhdGEgaXMgYXZhaWxhYmxlIHRoYXQgdGhlIHVzZXIgYWdlbnQgY291bGRcbiAgICAgICAgICAvLyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3VjY2Vzc2Z1bGx5IGFkdmFuY2UgdGhlIGN1cnJlbnQgcGxheWJhY2sgcG9zaXRpb25cbiAgICAgICAgICB2YXIgY3VycmVudFRpbWUgPSBtZWRpYS5jdXJyZW50VGltZTtcbiAgICAgICAgICB2YXIgYnVmZmVySW5mbyA9IHRoaXMuYnVmZmVySW5mbyhjdXJyZW50VGltZSwwKTtcbiAgICAgICAgICAvLyBjaGVjayBpZiBjdXJyZW50IHRpbWUgaXMgYnVmZmVyZWQgb3Igbm90XG4gICAgICAgICAgaWYoYnVmZmVySW5mby5sZW4gPT09IDApIHtcbiAgICAgICAgICAgIC8vIG5vIGJ1ZmZlciBhdmFpbGFibGUgQCBjdXJyZW50VGltZSwgY2hlY2sgaWYgbmV4dCBidWZmZXIgaXMgY2xvc2UgKGluIGEgMzAwIG1zIHJhbmdlKVxuICAgICAgICAgICAgdmFyIG5leHRCdWZmZXJTdGFydCA9IGJ1ZmZlckluZm8ubmV4dFN0YXJ0O1xuICAgICAgICAgICAgaWYobmV4dEJ1ZmZlclN0YXJ0ICYmIChuZXh0QnVmZmVyU3RhcnQgLSBjdXJyZW50VGltZSA8IDAuMykpIHtcbiAgICAgICAgICAgICAgLy8gbmV4dCBidWZmZXIgaXMgY2xvc2UgISBhZGp1c3QgY3VycmVudFRpbWUgdG8gbmV4dEJ1ZmZlclN0YXJ0XG4gICAgICAgICAgICAgIC8vIHRoaXMgd2lsbCBlbnN1cmUgZWZmZWN0aXZlIHZpZGVvIGRlY29kaW5nXG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coYGFkanVzdCBjdXJyZW50VGltZSBmcm9tICR7Y3VycmVudFRpbWV9IHRvICR7bmV4dEJ1ZmZlclN0YXJ0fWApO1xuICAgICAgICAgICAgICBtZWRpYS5jdXJyZW50VGltZSA9IG5leHRCdWZmZXJTdGFydDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBvblNCVXBkYXRlRXJyb3IoZXZlbnQpIHtcbiAgICBsb2dnZXIuZXJyb3IoYHNvdXJjZUJ1ZmZlciBlcnJvcjoke2V2ZW50fWApO1xuICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5FUlJPUjtcbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkJVRkZFUl9BUFBFTkRJTkdfRVJST1IsIGZhdGFsOiB0cnVlLCBmcmFnOiB0aGlzLmZyYWdDdXJyZW50fSk7XG4gIH1cblxuICB0aW1lUmFuZ2VzVG9TdHJpbmcocikge1xuICAgIHZhciBsb2cgPSAnJywgbGVuID0gci5sZW5ndGg7XG4gICAgZm9yICh2YXIgaT0wOyBpPGxlbjsgaSsrKSB7XG4gICAgICBsb2cgKz0gJ1snICsgci5zdGFydChpKSArICcsJyArIHIuZW5kKGkpICsgJ10nO1xuICAgIH1cbiAgICByZXR1cm4gbG9nO1xuICB9XG5cbiAgb25NZWRpYVNvdXJjZU9wZW4oKSB7XG4gICAgbG9nZ2VyLmxvZygnbWVkaWEgc291cmNlIG9wZW5lZCcpO1xuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuTUVESUFfQVRUQUNIRUQpO1xuICAgIHRoaXMub252c2Vla2luZyA9IHRoaXMub25NZWRpYVNlZWtpbmcuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9udnNlZWtlZCA9IHRoaXMub25NZWRpYVNlZWtlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub252bWV0YWRhdGEgPSB0aGlzLm9uTWVkaWFNZXRhZGF0YS5iaW5kKHRoaXMpO1xuICAgIHRoaXMub252ZW5kZWQgPSB0aGlzLm9uTWVkaWFFbmRlZC5iaW5kKHRoaXMpO1xuICAgIHZhciBtZWRpYSA9IHRoaXMubWVkaWE7XG4gICAgbWVkaWEuYWRkRXZlbnRMaXN0ZW5lcignc2Vla2luZycsIHRoaXMub252c2Vla2luZyk7XG4gICAgbWVkaWEuYWRkRXZlbnRMaXN0ZW5lcignc2Vla2VkJywgdGhpcy5vbnZzZWVrZWQpO1xuICAgIG1lZGlhLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWRlZG1ldGFkYXRhJywgdGhpcy5vbnZtZXRhZGF0YSk7XG4gICAgbWVkaWEuYWRkRXZlbnRMaXN0ZW5lcignZW5kZWQnLCB0aGlzLm9udmVuZGVkKTtcbiAgICBpZih0aGlzLmxldmVscyAmJiB0aGlzLmNvbmZpZy5hdXRvU3RhcnRMb2FkKSB7XG4gICAgICB0aGlzLnN0YXJ0TG9hZCgpO1xuICAgIH1cbiAgICAvLyBvbmNlIHJlY2VpdmVkLCBkb24ndCBsaXN0ZW4gYW55bW9yZSB0byBzb3VyY2VvcGVuIGV2ZW50XG4gICAgdGhpcy5tZWRpYVNvdXJjZS5yZW1vdmVFdmVudExpc3RlbmVyKCdzb3VyY2VvcGVuJywgdGhpcy5vbm1zbyk7XG4gIH1cblxuICBvbk1lZGlhU291cmNlQ2xvc2UoKSB7XG4gICAgbG9nZ2VyLmxvZygnbWVkaWEgc291cmNlIGNsb3NlZCcpO1xuICB9XG5cbiAgb25NZWRpYVNvdXJjZUVuZGVkKCkge1xuICAgIGxvZ2dlci5sb2coJ21lZGlhIHNvdXJjZSBlbmRlZCcpO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBNU0VNZWRpYUNvbnRyb2xsZXI7XG5cbiIsIi8qXG4gKlxuICogVGhpcyBmaWxlIGNvbnRhaW5zIGFuIGFkYXB0YXRpb24gb2YgdGhlIEFFUyBkZWNyeXB0aW9uIGFsZ29yaXRobVxuICogZnJvbSB0aGUgU3RhbmRmb3JkIEphdmFzY3JpcHQgQ3J5cHRvZ3JhcGh5IExpYnJhcnkuIFRoYXQgd29yayBpc1xuICogY292ZXJlZCBieSB0aGUgZm9sbG93aW5nIGNvcHlyaWdodCBhbmQgcGVybWlzc2lvbnMgbm90aWNlOlxuICpcbiAqIENvcHlyaWdodCAyMDA5LTIwMTAgRW1pbHkgU3RhcmssIE1pa2UgSGFtYnVyZywgRGFuIEJvbmVoLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBSZWRpc3RyaWJ1dGlvbiBhbmQgdXNlIGluIHNvdXJjZSBhbmQgYmluYXJ5IGZvcm1zLCB3aXRoIG9yIHdpdGhvdXRcbiAqIG1vZGlmaWNhdGlvbiwgYXJlIHBlcm1pdHRlZCBwcm92aWRlZCB0aGF0IHRoZSBmb2xsb3dpbmcgY29uZGl0aW9ucyBhcmVcbiAqIG1ldDpcbiAqXG4gKiAxLiBSZWRpc3RyaWJ1dGlvbnMgb2Ygc291cmNlIGNvZGUgbXVzdCByZXRhaW4gdGhlIGFib3ZlIGNvcHlyaWdodFxuICogICAgbm90aWNlLCB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZyBkaXNjbGFpbWVyLlxuICpcbiAqIDIuIFJlZGlzdHJpYnV0aW9ucyBpbiBiaW5hcnkgZm9ybSBtdXN0IHJlcHJvZHVjZSB0aGUgYWJvdmVcbiAqICAgIGNvcHlyaWdodCBub3RpY2UsIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nXG4gKiAgICBkaXNjbGFpbWVyIGluIHRoZSBkb2N1bWVudGF0aW9uIGFuZC9vciBvdGhlciBtYXRlcmlhbHMgcHJvdmlkZWRcbiAqICAgIHdpdGggdGhlIGRpc3RyaWJ1dGlvbi5cbiAqXG4gKiBUSElTIFNPRlRXQVJFIElTIFBST1ZJREVEIEJZIFRIRSBBVVRIT1JTIGBgQVMgSVMnJyBBTkQgQU5ZIEVYUFJFU1MgT1JcbiAqIElNUExJRUQgV0FSUkFOVElFUywgSU5DTFVESU5HLCBCVVQgTk9UIExJTUlURUQgVE8sIFRIRSBJTVBMSUVEXG4gKiBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSBBTkQgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQVJFXG4gKiBESVNDTEFJTUVELiBJTiBOTyBFVkVOVCBTSEFMTCA8Q09QWVJJR0hUIEhPTERFUj4gT1IgQ09OVFJJQlVUT1JTIEJFXG4gKiBMSUFCTEUgRk9SIEFOWSBESVJFQ1QsIElORElSRUNULCBJTkNJREVOVEFMLCBTUEVDSUFMLCBFWEVNUExBUlksIE9SXG4gKiBDT05TRVFVRU5USUFMIERBTUFHRVMgKElOQ0xVRElORywgQlVUIE5PVCBMSU1JVEVEIFRPLCBQUk9DVVJFTUVOVCBPRlxuICogU1VCU1RJVFVURSBHT09EUyBPUiBTRVJWSUNFUzsgTE9TUyBPRiBVU0UsIERBVEEsIE9SIFBST0ZJVFM7IE9SXG4gKiBCVVNJTkVTUyBJTlRFUlJVUFRJT04pIEhPV0VWRVIgQ0FVU0VEIEFORCBPTiBBTlkgVEhFT1JZIE9GIExJQUJJTElUWSxcbiAqIFdIRVRIRVIgSU4gQ09OVFJBQ1QsIFNUUklDVCBMSUFCSUxJVFksIE9SIFRPUlQgKElOQ0xVRElORyBORUdMSUdFTkNFXG4gKiBPUiBPVEhFUldJU0UpIEFSSVNJTkcgSU4gQU5ZIFdBWSBPVVQgT0YgVEhFIFVTRSBPRiBUSElTIFNPRlRXQVJFLCBFVkVOXG4gKiBJRiBBRFZJU0VEIE9GIFRIRSBQT1NTSUJJTElUWSBPRiBTVUNIIERBTUFHRS5cbiAqXG4gKiBUaGUgdmlld3MgYW5kIGNvbmNsdXNpb25zIGNvbnRhaW5lZCBpbiB0aGUgc29mdHdhcmUgYW5kIGRvY3VtZW50YXRpb25cbiAqIGFyZSB0aG9zZSBvZiB0aGUgYXV0aG9ycyBhbmQgc2hvdWxkIG5vdCBiZSBpbnRlcnByZXRlZCBhcyByZXByZXNlbnRpbmdcbiAqIG9mZmljaWFsIHBvbGljaWVzLCBlaXRoZXIgZXhwcmVzc2VkIG9yIGltcGxpZWQsIG9mIHRoZSBhdXRob3JzLlxuICovXG5jbGFzcyBBRVMge1xuXG4gIC8qKlxuICAgKiBTY2hlZHVsZSBvdXQgYW4gQUVTIGtleSBmb3IgYm90aCBlbmNyeXB0aW9uIGFuZCBkZWNyeXB0aW9uLiBUaGlzXG4gICAqIGlzIGEgbG93LWxldmVsIGNsYXNzLiBVc2UgYSBjaXBoZXIgbW9kZSB0byBkbyBidWxrIGVuY3J5cHRpb24uXG4gICAqXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0ga2V5IHtBcnJheX0gVGhlIGtleSBhcyBhbiBhcnJheSBvZiA0LCA2IG9yIDggd29yZHMuXG4gICAqL1xuICBjb25zdHJ1Y3RvcihrZXkpIHtcbiAgICAvKipcbiAgICAgKiBUaGUgZXhwYW5kZWQgUy1ib3ggYW5kIGludmVyc2UgUy1ib3ggdGFibGVzLiBUaGVzZSB3aWxsIGJlIGNvbXB1dGVkXG4gICAgICogb24gdGhlIGNsaWVudCBzbyB0aGF0IHdlIGRvbid0IGhhdmUgdG8gc2VuZCB0aGVtIGRvd24gdGhlIHdpcmUuXG4gICAgICpcbiAgICAgKiBUaGVyZSBhcmUgdHdvIHRhYmxlcywgX3RhYmxlc1swXSBpcyBmb3IgZW5jcnlwdGlvbiBhbmRcbiAgICAgKiBfdGFibGVzWzFdIGlzIGZvciBkZWNyeXB0aW9uLlxuICAgICAqXG4gICAgICogVGhlIGZpcnN0IDQgc3ViLXRhYmxlcyBhcmUgdGhlIGV4cGFuZGVkIFMtYm94IHdpdGggTWl4Q29sdW1ucy4gVGhlXG4gICAgICogbGFzdCAoX3RhYmxlc1swMV1bNF0pIGlzIHRoZSBTLWJveCBpdHNlbGYuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHRoaXMuX3RhYmxlcyA9IFtbW10sW10sW10sW10sW11dLFtbXSxbXSxbXSxbXSxbXV1dO1xuXG4gICAgdGhpcy5fcHJlY29tcHV0ZSgpO1xuXG4gICAgdmFyIGksIGosIHRtcCxcbiAgICBlbmNLZXksIGRlY0tleSxcbiAgICBzYm94ID0gdGhpcy5fdGFibGVzWzBdWzRdLCBkZWNUYWJsZSA9IHRoaXMuX3RhYmxlc1sxXSxcbiAgICBrZXlMZW4gPSBrZXkubGVuZ3RoLCByY29uID0gMTtcblxuICAgIGlmIChrZXlMZW4gIT09IDQgJiYga2V5TGVuICE9PSA2ICYmIGtleUxlbiAhPT0gOCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGFlcyBrZXkgc2l6ZT0nICsga2V5TGVuKTtcbiAgICB9XG5cbiAgICBlbmNLZXkgPSBrZXkuc2xpY2UoMCk7XG4gICAgZGVjS2V5ID0gW107XG4gICAgdGhpcy5fa2V5ID0gW2VuY0tleSwgZGVjS2V5XTtcblxuICAgIC8vIHNjaGVkdWxlIGVuY3J5cHRpb24ga2V5c1xuICAgIGZvciAoaSA9IGtleUxlbjsgaSA8IDQgKiBrZXlMZW4gKyAyODsgaSsrKSB7XG4gICAgICB0bXAgPSBlbmNLZXlbaS0xXTtcblxuICAgICAgLy8gYXBwbHkgc2JveFxuICAgICAgaWYgKGkla2V5TGVuID09PSAwIHx8IChrZXlMZW4gPT09IDggJiYgaSVrZXlMZW4gPT09IDQpKSB7XG4gICAgICAgIHRtcCA9IHNib3hbdG1wPj4+MjRdPDwyNCBeIHNib3hbdG1wPj4xNiYyNTVdPDwxNiBeIHNib3hbdG1wPj44JjI1NV08PDggXiBzYm94W3RtcCYyNTVdO1xuXG4gICAgICAgIC8vIHNoaWZ0IHJvd3MgYW5kIGFkZCByY29uXG4gICAgICAgIGlmIChpJWtleUxlbiA9PT0gMCkge1xuICAgICAgICAgIHRtcCA9IHRtcDw8OCBeIHRtcD4+PjI0IF4gcmNvbjw8MjQ7XG4gICAgICAgICAgcmNvbiA9IHJjb248PDEgXiAocmNvbj4+NykqMjgzO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGVuY0tleVtpXSA9IGVuY0tleVtpLWtleUxlbl0gXiB0bXA7XG4gICAgfVxuXG4gICAgLy8gc2NoZWR1bGUgZGVjcnlwdGlvbiBrZXlzXG4gICAgZm9yIChqID0gMDsgaTsgaisrLCBpLS0pIHtcbiAgICAgIHRtcCA9IGVuY0tleVtqJjMgPyBpIDogaSAtIDRdO1xuICAgICAgaWYgKGk8PTQgfHwgajw0KSB7XG4gICAgICAgIGRlY0tleVtqXSA9IHRtcDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRlY0tleVtqXSA9IGRlY1RhYmxlWzBdW3Nib3hbdG1wPj4+MjQgICAgICBdXSBeXG4gICAgICAgICAgZGVjVGFibGVbMV1bc2JveFt0bXA+PjE2ICAmIDI1NV1dIF5cbiAgICAgICAgICBkZWNUYWJsZVsyXVtzYm94W3RtcD4+OCAgICYgMjU1XV0gXlxuICAgICAgICAgIGRlY1RhYmxlWzNdW3Nib3hbdG1wICAgICAgJiAyNTVdXTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRXhwYW5kIHRoZSBTLWJveCB0YWJsZXMuXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfcHJlY29tcHV0ZSgpIHtcbiAgICB2YXIgZW5jVGFibGUgPSB0aGlzLl90YWJsZXNbMF0sIGRlY1RhYmxlID0gdGhpcy5fdGFibGVzWzFdLFxuICAgIHNib3ggPSBlbmNUYWJsZVs0XSwgc2JveEludiA9IGRlY1RhYmxlWzRdLFxuICAgIGksIHgsIHhJbnYsIGQ9W10sIHRoPVtdLCB4MiwgeDQsIHg4LCBzLCB0RW5jLCB0RGVjO1xuXG4gICAgLy8gQ29tcHV0ZSBkb3VibGUgYW5kIHRoaXJkIHRhYmxlc1xuICAgIGZvciAoaSA9IDA7IGkgPCAyNTY7IGkrKykge1xuICAgICAgdGhbKCBkW2ldID0gaTw8MSBeIChpPj43KSoyODMgKV5pXT1pO1xuICAgIH1cblxuICAgIGZvciAoeCA9IHhJbnYgPSAwOyAhc2JveFt4XTsgeCBePSB4MiB8fCAxLCB4SW52ID0gdGhbeEludl0gfHwgMSkge1xuICAgICAgLy8gQ29tcHV0ZSBzYm94XG4gICAgICBzID0geEludiBeIHhJbnY8PDEgXiB4SW52PDwyIF4geEludjw8MyBeIHhJbnY8PDQ7XG4gICAgICBzID0gcz4+OCBeIHMmMjU1IF4gOTk7XG4gICAgICBzYm94W3hdID0gcztcbiAgICAgIHNib3hJbnZbc10gPSB4O1xuXG4gICAgICAvLyBDb21wdXRlIE1peENvbHVtbnNcbiAgICAgIHg4ID0gZFt4NCA9IGRbeDIgPSBkW3hdXV07XG4gICAgICB0RGVjID0geDgqMHgxMDEwMTAxIF4geDQqMHgxMDAwMSBeIHgyKjB4MTAxIF4geCoweDEwMTAxMDA7XG4gICAgICB0RW5jID0gZFtzXSoweDEwMSBeIHMqMHgxMDEwMTAwO1xuXG4gICAgICBmb3IgKGkgPSAwOyBpIDwgNDsgaSsrKSB7XG4gICAgICAgIGVuY1RhYmxlW2ldW3hdID0gdEVuYyA9IHRFbmM8PDI0IF4gdEVuYz4+Pjg7XG4gICAgICAgIGRlY1RhYmxlW2ldW3NdID0gdERlYyA9IHREZWM8PDI0IF4gdERlYz4+Pjg7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ29tcGFjdGlmeS4gQ29uc2lkZXJhYmxlIHNwZWVkdXAgb24gRmlyZWZveC5cbiAgICBmb3IgKGkgPSAwOyBpIDwgNTsgaSsrKSB7XG4gICAgICBlbmNUYWJsZVtpXSA9IGVuY1RhYmxlW2ldLnNsaWNlKDApO1xuICAgICAgZGVjVGFibGVbaV0gPSBkZWNUYWJsZVtpXS5zbGljZSgwKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRGVjcnlwdCAxNiBieXRlcywgc3BlY2lmaWVkIGFzIGZvdXIgMzItYml0IHdvcmRzLlxuICAgKiBAcGFyYW0gZW5jcnlwdGVkMCB7bnVtYmVyfSB0aGUgZmlyc3Qgd29yZCB0byBkZWNyeXB0XG4gICAqIEBwYXJhbSBlbmNyeXB0ZWQxIHtudW1iZXJ9IHRoZSBzZWNvbmQgd29yZCB0byBkZWNyeXB0XG4gICAqIEBwYXJhbSBlbmNyeXB0ZWQyIHtudW1iZXJ9IHRoZSB0aGlyZCB3b3JkIHRvIGRlY3J5cHRcbiAgICogQHBhcmFtIGVuY3J5cHRlZDMge251bWJlcn0gdGhlIGZvdXJ0aCB3b3JkIHRvIGRlY3J5cHRcbiAgICogQHBhcmFtIG91dCB7SW50MzJBcnJheX0gdGhlIGFycmF5IHRvIHdyaXRlIHRoZSBkZWNyeXB0ZWQgd29yZHNcbiAgICogaW50b1xuICAgKiBAcGFyYW0gb2Zmc2V0IHtudW1iZXJ9IHRoZSBvZmZzZXQgaW50byB0aGUgb3V0cHV0IGFycmF5IHRvIHN0YXJ0XG4gICAqIHdyaXRpbmcgcmVzdWx0c1xuICAgKiBAcmV0dXJuIHtBcnJheX0gVGhlIHBsYWludGV4dC5cbiAgICovXG4gIGRlY3J5cHQoZW5jcnlwdGVkMCwgZW5jcnlwdGVkMSwgZW5jcnlwdGVkMiwgZW5jcnlwdGVkMywgb3V0LCBvZmZzZXQpIHtcbiAgICB2YXIga2V5ID0gdGhpcy5fa2V5WzFdLFxuICAgIC8vIHN0YXRlIHZhcmlhYmxlcyBhLGIsYyxkIGFyZSBsb2FkZWQgd2l0aCBwcmUtd2hpdGVuZWQgZGF0YVxuICAgIGEgPSBlbmNyeXB0ZWQwIF4ga2V5WzBdLFxuICAgIGIgPSBlbmNyeXB0ZWQzIF4ga2V5WzFdLFxuICAgIGMgPSBlbmNyeXB0ZWQyIF4ga2V5WzJdLFxuICAgIGQgPSBlbmNyeXB0ZWQxIF4ga2V5WzNdLFxuICAgIGEyLCBiMiwgYzIsXG5cbiAgICBuSW5uZXJSb3VuZHMgPSBrZXkubGVuZ3RoIC8gNCAtIDIsIC8vIGtleS5sZW5ndGggPT09IDIgP1xuICAgIGksXG4gICAga0luZGV4ID0gNCxcbiAgICB0YWJsZSA9IHRoaXMuX3RhYmxlc1sxXSxcblxuICAgIC8vIGxvYWQgdXAgdGhlIHRhYmxlc1xuICAgIHRhYmxlMCAgICA9IHRhYmxlWzBdLFxuICAgIHRhYmxlMSAgICA9IHRhYmxlWzFdLFxuICAgIHRhYmxlMiAgICA9IHRhYmxlWzJdLFxuICAgIHRhYmxlMyAgICA9IHRhYmxlWzNdLFxuICAgIHNib3ggID0gdGFibGVbNF07XG5cbiAgICAvLyBJbm5lciByb3VuZHMuIENyaWJiZWQgZnJvbSBPcGVuU1NMLlxuICAgIGZvciAoaSA9IDA7IGkgPCBuSW5uZXJSb3VuZHM7IGkrKykge1xuICAgICAgYTIgPSB0YWJsZTBbYT4+PjI0XSBeIHRhYmxlMVtiPj4xNiAmIDI1NV0gXiB0YWJsZTJbYz4+OCAmIDI1NV0gXiB0YWJsZTNbZCAmIDI1NV0gXiBrZXlba0luZGV4XTtcbiAgICAgIGIyID0gdGFibGUwW2I+Pj4yNF0gXiB0YWJsZTFbYz4+MTYgJiAyNTVdIF4gdGFibGUyW2Q+PjggJiAyNTVdIF4gdGFibGUzW2EgJiAyNTVdIF4ga2V5W2tJbmRleCArIDFdO1xuICAgICAgYzIgPSB0YWJsZTBbYz4+PjI0XSBeIHRhYmxlMVtkPj4xNiAmIDI1NV0gXiB0YWJsZTJbYT4+OCAmIDI1NV0gXiB0YWJsZTNbYiAmIDI1NV0gXiBrZXlba0luZGV4ICsgMl07XG4gICAgICBkICA9IHRhYmxlMFtkPj4+MjRdIF4gdGFibGUxW2E+PjE2ICYgMjU1XSBeIHRhYmxlMltiPj44ICYgMjU1XSBeIHRhYmxlM1tjICYgMjU1XSBeIGtleVtrSW5kZXggKyAzXTtcbiAgICAgIGtJbmRleCArPSA0O1xuICAgICAgYT1hMjsgYj1iMjsgYz1jMjtcbiAgICB9XG5cbiAgICAvLyBMYXN0IHJvdW5kLlxuICAgIGZvciAoaSA9IDA7IGkgPCA0OyBpKyspIHtcbiAgICAgIG91dFsoMyAmIC1pKSArIG9mZnNldF0gPVxuICAgICAgICBzYm94W2E+Pj4yNCAgICAgIF08PDI0IF5cbiAgICAgICAgc2JveFtiPj4xNiAgJiAyNTVdPDwxNiBeXG4gICAgICAgIHNib3hbYz4+OCAgICYgMjU1XTw8OCAgXlxuICAgICAgICBzYm94W2QgICAgICAmIDI1NV0gICAgIF5cbiAgICAgICAga2V5W2tJbmRleCsrXTtcbiAgICAgIGEyPWE7IGE9YjsgYj1jOyBjPWQ7IGQ9YTI7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEFFUztcbiIsIi8qXG4gKlxuICogVGhpcyBmaWxlIGNvbnRhaW5zIGFuIGFkYXB0YXRpb24gb2YgdGhlIEFFUyBkZWNyeXB0aW9uIGFsZ29yaXRobVxuICogZnJvbSB0aGUgU3RhbmRmb3JkIEphdmFzY3JpcHQgQ3J5cHRvZ3JhcGh5IExpYnJhcnkuIFRoYXQgd29yayBpc1xuICogY292ZXJlZCBieSB0aGUgZm9sbG93aW5nIGNvcHlyaWdodCBhbmQgcGVybWlzc2lvbnMgbm90aWNlOlxuICpcbiAqIENvcHlyaWdodCAyMDA5LTIwMTAgRW1pbHkgU3RhcmssIE1pa2UgSGFtYnVyZywgRGFuIEJvbmVoLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBSZWRpc3RyaWJ1dGlvbiBhbmQgdXNlIGluIHNvdXJjZSBhbmQgYmluYXJ5IGZvcm1zLCB3aXRoIG9yIHdpdGhvdXRcbiAqIG1vZGlmaWNhdGlvbiwgYXJlIHBlcm1pdHRlZCBwcm92aWRlZCB0aGF0IHRoZSBmb2xsb3dpbmcgY29uZGl0aW9ucyBhcmVcbiAqIG1ldDpcbiAqXG4gKiAxLiBSZWRpc3RyaWJ1dGlvbnMgb2Ygc291cmNlIGNvZGUgbXVzdCByZXRhaW4gdGhlIGFib3ZlIGNvcHlyaWdodFxuICogICAgbm90aWNlLCB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZyBkaXNjbGFpbWVyLlxuICpcbiAqIDIuIFJlZGlzdHJpYnV0aW9ucyBpbiBiaW5hcnkgZm9ybSBtdXN0IHJlcHJvZHVjZSB0aGUgYWJvdmVcbiAqICAgIGNvcHlyaWdodCBub3RpY2UsIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nXG4gKiAgICBkaXNjbGFpbWVyIGluIHRoZSBkb2N1bWVudGF0aW9uIGFuZC9vciBvdGhlciBtYXRlcmlhbHMgcHJvdmlkZWRcbiAqICAgIHdpdGggdGhlIGRpc3RyaWJ1dGlvbi5cbiAqXG4gKiBUSElTIFNPRlRXQVJFIElTIFBST1ZJREVEIEJZIFRIRSBBVVRIT1JTIGBgQVMgSVMnJyBBTkQgQU5ZIEVYUFJFU1MgT1JcbiAqIElNUExJRUQgV0FSUkFOVElFUywgSU5DTFVESU5HLCBCVVQgTk9UIExJTUlURUQgVE8sIFRIRSBJTVBMSUVEXG4gKiBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSBBTkQgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQVJFXG4gKiBESVNDTEFJTUVELiBJTiBOTyBFVkVOVCBTSEFMTCA8Q09QWVJJR0hUIEhPTERFUj4gT1IgQ09OVFJJQlVUT1JTIEJFXG4gKiBMSUFCTEUgRk9SIEFOWSBESVJFQ1QsIElORElSRUNULCBJTkNJREVOVEFMLCBTUEVDSUFMLCBFWEVNUExBUlksIE9SXG4gKiBDT05TRVFVRU5USUFMIERBTUFHRVMgKElOQ0xVRElORywgQlVUIE5PVCBMSU1JVEVEIFRPLCBQUk9DVVJFTUVOVCBPRlxuICogU1VCU1RJVFVURSBHT09EUyBPUiBTRVJWSUNFUzsgTE9TUyBPRiBVU0UsIERBVEEsIE9SIFBST0ZJVFM7IE9SXG4gKiBCVVNJTkVTUyBJTlRFUlJVUFRJT04pIEhPV0VWRVIgQ0FVU0VEIEFORCBPTiBBTlkgVEhFT1JZIE9GIExJQUJJTElUWSxcbiAqIFdIRVRIRVIgSU4gQ09OVFJBQ1QsIFNUUklDVCBMSUFCSUxJVFksIE9SIFRPUlQgKElOQ0xVRElORyBORUdMSUdFTkNFXG4gKiBPUiBPVEhFUldJU0UpIEFSSVNJTkcgSU4gQU5ZIFdBWSBPVVQgT0YgVEhFIFVTRSBPRiBUSElTIFNPRlRXQVJFLCBFVkVOXG4gKiBJRiBBRFZJU0VEIE9GIFRIRSBQT1NTSUJJTElUWSBPRiBTVUNIIERBTUFHRS5cbiAqXG4gKiBUaGUgdmlld3MgYW5kIGNvbmNsdXNpb25zIGNvbnRhaW5lZCBpbiB0aGUgc29mdHdhcmUgYW5kIGRvY3VtZW50YXRpb25cbiAqIGFyZSB0aG9zZSBvZiB0aGUgYXV0aG9ycyBhbmQgc2hvdWxkIG5vdCBiZSBpbnRlcnByZXRlZCBhcyByZXByZXNlbnRpbmdcbiAqIG9mZmljaWFsIHBvbGljaWVzLCBlaXRoZXIgZXhwcmVzc2VkIG9yIGltcGxpZWQsIG9mIHRoZSBhdXRob3JzLlxuICovXG5cbmltcG9ydCBBRVMgZnJvbSAnLi9hZXMnO1xuXG5jbGFzcyBBRVMxMjhEZWNyeXB0ZXIge1xuXG4gIGNvbnN0cnVjdG9yKGtleSwgaW5pdFZlY3Rvcikge1xuICAgIHRoaXMua2V5ID0ga2V5O1xuICAgIHRoaXMuaXYgPSBpbml0VmVjdG9yO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnZlcnQgbmV0d29yay1vcmRlciAoYmlnLWVuZGlhbikgYnl0ZXMgaW50byB0aGVpciBsaXR0bGUtZW5kaWFuXG4gICAqIHJlcHJlc2VudGF0aW9uLlxuICAgKi9cbiAgbnRvaCh3b3JkKSB7XG4gICAgcmV0dXJuICh3b3JkIDw8IDI0KSB8XG4gICAgICAoKHdvcmQgJiAweGZmMDApIDw8IDgpIHxcbiAgICAgICgod29yZCAmIDB4ZmYwMDAwKSA+PiA4KSB8XG4gICAgICAod29yZCA+Pj4gMjQpO1xuICB9XG5cblxuICAvKipcbiAgICogRGVjcnlwdCBieXRlcyB1c2luZyBBRVMtMTI4IHdpdGggQ0JDIGFuZCBQS0NTIzcgcGFkZGluZy5cbiAgICogQHBhcmFtIGVuY3J5cHRlZCB7VWludDhBcnJheX0gdGhlIGVuY3J5cHRlZCBieXRlc1xuICAgKiBAcGFyYW0ga2V5IHtVaW50MzJBcnJheX0gdGhlIGJ5dGVzIG9mIHRoZSBkZWNyeXB0aW9uIGtleVxuICAgKiBAcGFyYW0gaW5pdFZlY3RvciB7VWludDMyQXJyYXl9IHRoZSBpbml0aWFsaXphdGlvbiB2ZWN0b3IgKElWKSB0b1xuICAgKiB1c2UgZm9yIHRoZSBmaXJzdCByb3VuZCBvZiBDQkMuXG4gICAqIEByZXR1cm4ge1VpbnQ4QXJyYXl9IHRoZSBkZWNyeXB0ZWQgYnl0ZXNcbiAgICpcbiAgICogQHNlZSBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0FkdmFuY2VkX0VuY3J5cHRpb25fU3RhbmRhcmRcbiAgICogQHNlZSBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0Jsb2NrX2NpcGhlcl9tb2RlX29mX29wZXJhdGlvbiNDaXBoZXJfQmxvY2tfQ2hhaW5pbmdfLjI4Q0JDLjI5XG4gICAqIEBzZWUgaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzIzMTVcbiAgICovXG4gIGRvRGVjcnlwdChlbmNyeXB0ZWQsIGtleSwgaW5pdFZlY3Rvcikge1xuICAgIHZhclxuICAgICAgLy8gd29yZC1sZXZlbCBhY2Nlc3MgdG8gdGhlIGVuY3J5cHRlZCBieXRlc1xuICAgICAgZW5jcnlwdGVkMzIgPSBuZXcgSW50MzJBcnJheShlbmNyeXB0ZWQuYnVmZmVyLCBlbmNyeXB0ZWQuYnl0ZU9mZnNldCwgZW5jcnlwdGVkLmJ5dGVMZW5ndGggPj4gMiksXG5cbiAgICBkZWNpcGhlciA9IG5ldyBBRVMoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoa2V5KSksXG5cbiAgICAvLyBieXRlIGFuZCB3b3JkLWxldmVsIGFjY2VzcyBmb3IgdGhlIGRlY3J5cHRlZCBvdXRwdXRcbiAgICBkZWNyeXB0ZWQgPSBuZXcgVWludDhBcnJheShlbmNyeXB0ZWQuYnl0ZUxlbmd0aCksXG4gICAgZGVjcnlwdGVkMzIgPSBuZXcgSW50MzJBcnJheShkZWNyeXB0ZWQuYnVmZmVyKSxcblxuICAgIC8vIHRlbXBvcmFyeSB2YXJpYWJsZXMgZm9yIHdvcmtpbmcgd2l0aCB0aGUgSVYsIGVuY3J5cHRlZCwgYW5kXG4gICAgLy8gZGVjcnlwdGVkIGRhdGFcbiAgICBpbml0MCwgaW5pdDEsIGluaXQyLCBpbml0MyxcbiAgICBlbmNyeXB0ZWQwLCBlbmNyeXB0ZWQxLCBlbmNyeXB0ZWQyLCBlbmNyeXB0ZWQzLFxuXG4gICAgLy8gaXRlcmF0aW9uIHZhcmlhYmxlXG4gICAgd29yZEl4O1xuXG4gICAgLy8gcHVsbCBvdXQgdGhlIHdvcmRzIG9mIHRoZSBJViB0byBlbnN1cmUgd2UgZG9uJ3QgbW9kaWZ5IHRoZVxuICAgIC8vIHBhc3NlZC1pbiByZWZlcmVuY2UgYW5kIGVhc2llciBhY2Nlc3NcbiAgICBpbml0MCA9IGluaXRWZWN0b3JbMF07XG4gICAgaW5pdDEgPSBpbml0VmVjdG9yWzFdO1xuICAgIGluaXQyID0gaW5pdFZlY3RvclsyXTtcbiAgICBpbml0MyA9IGluaXRWZWN0b3JbM107XG5cbiAgICAvLyBkZWNyeXB0IGZvdXIgd29yZCBzZXF1ZW5jZXMsIGFwcGx5aW5nIGNpcGhlci1ibG9jayBjaGFpbmluZyAoQ0JDKVxuICAgIC8vIHRvIGVhY2ggZGVjcnlwdGVkIGJsb2NrXG4gICAgZm9yICh3b3JkSXggPSAwOyB3b3JkSXggPCBlbmNyeXB0ZWQzMi5sZW5ndGg7IHdvcmRJeCArPSA0KSB7XG4gICAgICAvLyBjb252ZXJ0IGJpZy1lbmRpYW4gKG5ldHdvcmsgb3JkZXIpIHdvcmRzIGludG8gbGl0dGxlLWVuZGlhblxuICAgICAgLy8gKGphdmFzY3JpcHQgb3JkZXIpXG4gICAgICBlbmNyeXB0ZWQwID0gdGhpcy5udG9oKGVuY3J5cHRlZDMyW3dvcmRJeF0pO1xuICAgICAgZW5jcnlwdGVkMSA9IHRoaXMubnRvaChlbmNyeXB0ZWQzMlt3b3JkSXggKyAxXSk7XG4gICAgICBlbmNyeXB0ZWQyID0gdGhpcy5udG9oKGVuY3J5cHRlZDMyW3dvcmRJeCArIDJdKTtcbiAgICAgIGVuY3J5cHRlZDMgPSB0aGlzLm50b2goZW5jcnlwdGVkMzJbd29yZEl4ICsgM10pO1xuXG4gICAgICAvLyBkZWNyeXB0IHRoZSBibG9ja1xuICAgICAgZGVjaXBoZXIuZGVjcnlwdChlbmNyeXB0ZWQwLFxuICAgICAgICAgIGVuY3J5cHRlZDEsXG4gICAgICAgICAgZW5jcnlwdGVkMixcbiAgICAgICAgICBlbmNyeXB0ZWQzLFxuICAgICAgICAgIGRlY3J5cHRlZDMyLFxuICAgICAgICAgIHdvcmRJeCk7XG5cbiAgICAgIC8vIFhPUiB3aXRoIHRoZSBJViwgYW5kIHJlc3RvcmUgbmV0d29yayBieXRlLW9yZGVyIHRvIG9idGFpbiB0aGVcbiAgICAgIC8vIHBsYWludGV4dFxuICAgICAgZGVjcnlwdGVkMzJbd29yZEl4XSAgICAgPSB0aGlzLm50b2goZGVjcnlwdGVkMzJbd29yZEl4XSBeIGluaXQwKTtcbiAgICAgIGRlY3J5cHRlZDMyW3dvcmRJeCArIDFdID0gdGhpcy5udG9oKGRlY3J5cHRlZDMyW3dvcmRJeCArIDFdIF4gaW5pdDEpO1xuICAgICAgZGVjcnlwdGVkMzJbd29yZEl4ICsgMl0gPSB0aGlzLm50b2goZGVjcnlwdGVkMzJbd29yZEl4ICsgMl0gXiBpbml0Mik7XG4gICAgICBkZWNyeXB0ZWQzMlt3b3JkSXggKyAzXSA9IHRoaXMubnRvaChkZWNyeXB0ZWQzMlt3b3JkSXggKyAzXSBeIGluaXQzKTtcblxuICAgICAgLy8gc2V0dXAgdGhlIElWIGZvciB0aGUgbmV4dCByb3VuZFxuICAgICAgaW5pdDAgPSBlbmNyeXB0ZWQwO1xuICAgICAgaW5pdDEgPSBlbmNyeXB0ZWQxO1xuICAgICAgaW5pdDIgPSBlbmNyeXB0ZWQyO1xuICAgICAgaW5pdDMgPSBlbmNyeXB0ZWQzO1xuICAgIH1cblxuICAgIHJldHVybiBkZWNyeXB0ZWQ7XG4gIH1cblxuICBsb2NhbERlY3JpcHQoZW5jcnlwdGVkLCBrZXksIGluaXRWZWN0b3IsIGRlY3J5cHRlZCkge1xuICAgIHZhciBieXRlcyA9IHRoaXMuZG9EZWNyeXB0KGVuY3J5cHRlZCxcbiAgICAgICAga2V5LFxuICAgICAgICBpbml0VmVjdG9yKTtcbiAgICBkZWNyeXB0ZWQuc2V0KGJ5dGVzLCBlbmNyeXB0ZWQuYnl0ZU9mZnNldCk7XG4gIH1cblxuICBkZWNyeXB0KGVuY3J5cHRlZCkge1xuICAgIHZhclxuICAgICAgc3RlcCA9IDQgKiA4MDAwLFxuICAgIC8vZW5jcnlwdGVkMzIgPSBuZXcgSW50MzJBcnJheShlbmNyeXB0ZWQuYnVmZmVyKSxcbiAgICBlbmNyeXB0ZWQzMiA9IG5ldyBJbnQzMkFycmF5KGVuY3J5cHRlZCksXG4gICAgZGVjcnlwdGVkID0gbmV3IFVpbnQ4QXJyYXkoZW5jcnlwdGVkLmJ5dGVMZW5ndGgpLFxuICAgIGkgPSAwO1xuXG4gICAgLy8gc3BsaXQgdXAgdGhlIGVuY3J5cHRpb24gam9iIGFuZCBkbyB0aGUgaW5kaXZpZHVhbCBjaHVua3MgYXN5bmNocm9ub3VzbHlcbiAgICB2YXIga2V5ID0gdGhpcy5rZXk7XG4gICAgdmFyIGluaXRWZWN0b3IgPSB0aGlzLml2O1xuICAgIHRoaXMubG9jYWxEZWNyaXB0KGVuY3J5cHRlZDMyLnN1YmFycmF5KGksIGkgKyBzdGVwKSwga2V5LCBpbml0VmVjdG9yLCBkZWNyeXB0ZWQpO1xuXG4gICAgZm9yIChpID0gc3RlcDsgaSA8IGVuY3J5cHRlZDMyLmxlbmd0aDsgaSArPSBzdGVwKSB7XG4gICAgICBpbml0VmVjdG9yID0gbmV3IFVpbnQzMkFycmF5KFtcbiAgICAgICAgICB0aGlzLm50b2goZW5jcnlwdGVkMzJbaSAtIDRdKSxcbiAgICAgICAgICB0aGlzLm50b2goZW5jcnlwdGVkMzJbaSAtIDNdKSxcbiAgICAgICAgICB0aGlzLm50b2goZW5jcnlwdGVkMzJbaSAtIDJdKSxcbiAgICAgICAgICB0aGlzLm50b2goZW5jcnlwdGVkMzJbaSAtIDFdKVxuICAgICAgXSk7XG4gICAgICB0aGlzLmxvY2FsRGVjcmlwdChlbmNyeXB0ZWQzMi5zdWJhcnJheShpLCBpICsgc3RlcCksIGtleSwgaW5pdFZlY3RvciwgZGVjcnlwdGVkKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZGVjcnlwdGVkO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEFFUzEyOERlY3J5cHRlcjtcbiIsIi8qXG4gKiBBRVMxMjggZGVjcnlwdGlvbi5cbiAqL1xuXG5pbXBvcnQgQUVTMTI4RGVjcnlwdGVyIGZyb20gJy4vYWVzMTI4LWRlY3J5cHRlcic7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG5jbGFzcyBEZWNyeXB0ZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHRoaXMuaGxzID0gaGxzO1xuICAgIHRoaXMuZGlzYWJsZVdlYkNyeXB0byA9IGZhbHNlO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgfVxuXG4gIGRlY3J5cHQoZGF0YSwga2V5LCBpdiwgY2FsbGJhY2spIHtcbiAgICBpZiAodGhpcy5kaXNhYmxlV2ViQ3J5cHRvICYmIHRoaXMuaGxzLmNvbmZpZy5lbmFibGVTb2Z0d2FyZUFFUykge1xuICAgICAgdGhpcy5kZWNyeXB0QnlTb2Z0d2FyZShkYXRhLCBrZXksIGl2LCBjYWxsYmFjayk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZGVjcnlwdEJ5V2ViQ3J5cHRvKGRhdGEsIGtleSwgaXYsIGNhbGxiYWNrKTtcbiAgICB9XG4gIH1cblxuICBkZWNyeXB0QnlXZWJDcnlwdG8oZGF0YSwga2V5LCBpdiwgY2FsbGJhY2spIHtcbiAgICBsb2dnZXIubG9nKCdkZWNyeXB0aW5nIGJ5IFdlYkNyeXB0byBBUEknKTtcblxuICAgIHZhciBsb2NhbHRoaXMgPSB0aGlzO1xuICAgIHdpbmRvdy5jcnlwdG8uc3VidGxlLmltcG9ydEtleSgncmF3Jywga2V5LCB7IG5hbWUgOiAnQUVTLUNCQycsIGxlbmd0aCA6IDEyOCB9LCBmYWxzZSwgWydkZWNyeXB0J10pLlxuICAgICAgdGhlbihmdW5jdGlvbiAoaW1wb3J0ZWRLZXkpIHtcbiAgICAgICAgd2luZG93LmNyeXB0by5zdWJ0bGUuZGVjcnlwdCh7IG5hbWUgOiAnQUVTLUNCQycsIGl2IDogaXYuYnVmZmVyIH0sIGltcG9ydGVkS2V5LCBkYXRhKS5cbiAgICAgICAgICB0aGVuKGNhbGxiYWNrKS5cbiAgICAgICAgICBjYXRjaCAoZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgbG9jYWx0aGlzLm9uV2ViQ3J5cHRvRXJyb3IoZXJyLCBkYXRhLCBrZXksIGl2LCBjYWxsYmFjayk7XG4gICAgICAgICAgfSk7XG4gICAgICB9KS5cbiAgICBjYXRjaCAoZnVuY3Rpb24gKGVycikge1xuICAgICAgbG9jYWx0aGlzLm9uV2ViQ3J5cHRvRXJyb3IoZXJyLCBkYXRhLCBrZXksIGl2LCBjYWxsYmFjayk7XG4gICAgfSk7XG4gIH1cblxuICBkZWNyeXB0QnlTb2Z0d2FyZShkYXRhLCBrZXk4LCBpdjgsIGNhbGxiYWNrKSB7XG4gICAgbG9nZ2VyLmxvZygnZGVjcnlwdGluZyBieSBKYXZhU2NyaXB0IEltcGxlbWVudGF0aW9uJyk7XG5cbiAgICB2YXIgdmlldyA9IG5ldyBEYXRhVmlldyhrZXk4LmJ1ZmZlcik7XG4gICAgdmFyIGtleSA9IG5ldyBVaW50MzJBcnJheShbXG4gICAgICAgIHZpZXcuZ2V0VWludDMyKDApLFxuICAgICAgICB2aWV3LmdldFVpbnQzMig0KSxcbiAgICAgICAgdmlldy5nZXRVaW50MzIoOCksXG4gICAgICAgIHZpZXcuZ2V0VWludDMyKDEyKVxuICAgIF0pO1xuXG4gICAgdmlldyA9IG5ldyBEYXRhVmlldyhpdjguYnVmZmVyKTtcbiAgICB2YXIgaXYgPSBuZXcgVWludDMyQXJyYXkoW1xuICAgICAgICB2aWV3LmdldFVpbnQzMigwKSxcbiAgICAgICAgdmlldy5nZXRVaW50MzIoNCksXG4gICAgICAgIHZpZXcuZ2V0VWludDMyKDgpLFxuICAgICAgICB2aWV3LmdldFVpbnQzMigxMilcbiAgICBdKTtcblxuICAgIHZhciBkZWNyeXB0ZXIgPSBuZXcgQUVTMTI4RGVjcnlwdGVyKGtleSwgaXYpO1xuICAgIGNhbGxiYWNrKGRlY3J5cHRlci5kZWNyeXB0KGRhdGEpLmJ1ZmZlcik7XG4gIH1cblxuICBvbldlYkNyeXB0b0Vycm9yKGVyciwgZGF0YSwga2V5LCBpdiwgY2FsbGJhY2spIHtcbiAgICBpZiAodGhpcy5obHMuY29uZmlnLmVuYWJsZVNvZnR3YXJlQUVTKSB7XG4gICAgICBsb2dnZXIubG9nKCdkaXNhYmxpbmcgdG8gdXNlIFdlYkNyeXB0byBBUEknKTtcbiAgICAgIHRoaXMuZGlzYWJsZVdlYkNyeXB0byA9IHRydWU7XG4gICAgICB0aGlzLmRlY3J5cHRCeVNvZnR3YXJlKGRhdGEsIGtleSwgaXYsIGNhbGxiYWNrKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBsb2dnZXIuZXJyb3IoYGRlY3J5cHRpbmcgZXJyb3IgOiAke2Vyci5tZXNzYWdlfWApO1xuICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGUgOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzIDogRXJyb3JEZXRhaWxzLkZSQUdfREVDUllQVF9FUlJPUiwgZmF0YWwgOiB0cnVlLCByZWFzb24gOiBlcnIubWVzc2FnZX0pO1xuICAgIH1cbiAgfVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IERlY3J5cHRlcjtcbiIsIi8qICBpbmxpbmUgZGVtdXhlci5cbiAqICAgcHJvYmUgZnJhZ21lbnRzIGFuZCBpbnN0YW50aWF0ZSBhcHByb3ByaWF0ZSBkZW11eGVyIGRlcGVuZGluZyBvbiBjb250ZW50IHR5cGUgKFRTRGVtdXhlciwgQUFDRGVtdXhlciwgLi4uKVxuICovXG5cbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5pbXBvcnQgVFNEZW11eGVyIGZyb20gJy4uL2RlbXV4L3RzZGVtdXhlcic7XG5cbmNsYXNzIERlbXV4ZXJJbmxpbmUge1xuXG4gIGNvbnN0cnVjdG9yKGhscyxyZW11eGVyKSB7XG4gICAgdGhpcy5obHMgPSBobHM7XG4gICAgdGhpcy5yZW11eGVyID0gcmVtdXhlcjtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdmFyIGRlbXV4ZXIgPSB0aGlzLmRlbXV4ZXI7XG4gICAgaWYgKGRlbXV4ZXIpIHtcbiAgICAgIGRlbXV4ZXIuZGVzdHJveSgpO1xuICAgIH1cbiAgfVxuXG4gIHB1c2goZGF0YSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCwgY2MsIGxldmVsLCBzbiwgZHVyYXRpb24pIHtcbiAgICB2YXIgZGVtdXhlciA9IHRoaXMuZGVtdXhlcjtcbiAgICBpZiAoIWRlbXV4ZXIpIHtcbiAgICAgIC8vIHByb2JlIGZvciBjb250ZW50IHR5cGVcbiAgICAgIGlmIChUU0RlbXV4ZXIucHJvYmUoZGF0YSkpIHtcbiAgICAgICAgZGVtdXhlciA9IHRoaXMuZGVtdXhlciA9IG5ldyBUU0RlbXV4ZXIodGhpcy5obHMsdGhpcy5yZW11eGVyKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlIDogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkZSQUdfUEFSU0lOR19FUlJPUiwgZmF0YWw6IHRydWUsIHJlYXNvbjogJ25vIGRlbXV4IG1hdGNoaW5nIHdpdGggY29udGVudCBmb3VuZCd9KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgICBkZW11eGVyLnB1c2goZGF0YSxhdWRpb0NvZGVjLHZpZGVvQ29kZWMsdGltZU9mZnNldCxjYyxsZXZlbCxzbixkdXJhdGlvbik7XG4gIH1cblxuICByZW11eCgpIHtcbiAgICB2YXIgZGVtdXhlciA9IHRoaXMuZGVtdXhlcjtcbiAgICBpZihkZW11eGVyKSB7XG4gICAgICBkZW11eGVyLnJlbXV4KCk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IERlbXV4ZXJJbmxpbmU7XG4iLCIvKiBkZW11eGVyIHdlYiB3b3JrZXIuXG4gKiAgLSBsaXN0ZW4gdG8gd29ya2VyIG1lc3NhZ2UsIGFuZCB0cmlnZ2VyIERlbXV4ZXJJbmxpbmUgdXBvbiByZWNlcHRpb24gb2YgRnJhZ21lbnRzLlxuICogIC0gcHJvdmlkZXMgTVA0IEJveGVzIGJhY2sgdG8gbWFpbiB0aHJlYWQgdXNpbmcgW3RyYW5zZmVyYWJsZSBvYmplY3RzXShodHRwczovL2RldmVsb3BlcnMuZ29vZ2xlLmNvbS93ZWIvdXBkYXRlcy8yMDExLzEyL1RyYW5zZmVyYWJsZS1PYmplY3RzLUxpZ2h0bmluZy1GYXN0KSBpbiBvcmRlciB0byBtaW5pbWl6ZSBtZXNzYWdlIHBhc3Npbmcgb3ZlcmhlYWQuXG4gKi9cblxuIGltcG9ydCBEZW11eGVySW5saW5lIGZyb20gJy4uL2RlbXV4L2RlbXV4ZXItaW5saW5lJztcbiBpbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbiBpbXBvcnQgRXZlbnRFbWl0dGVyIGZyb20gJ2V2ZW50cyc7XG4gaW1wb3J0IE1QNFJlbXV4ZXIgZnJvbSAnLi4vcmVtdXgvbXA0LXJlbXV4ZXInO1xuXG52YXIgRGVtdXhlcldvcmtlciA9IGZ1bmN0aW9uIChzZWxmKSB7XG4gIC8vIG9ic2VydmVyIHNldHVwXG4gIHZhciBvYnNlcnZlciA9IG5ldyBFdmVudEVtaXR0ZXIoKTtcbiAgb2JzZXJ2ZXIudHJpZ2dlciA9IGZ1bmN0aW9uIHRyaWdnZXIgKGV2ZW50LCAuLi5kYXRhKSB7XG4gICAgb2JzZXJ2ZXIuZW1pdChldmVudCwgZXZlbnQsIC4uLmRhdGEpO1xuICB9O1xuXG4gIG9ic2VydmVyLm9mZiA9IGZ1bmN0aW9uIG9mZiAoZXZlbnQsIC4uLmRhdGEpIHtcbiAgICBvYnNlcnZlci5yZW1vdmVMaXN0ZW5lcihldmVudCwgLi4uZGF0YSk7XG4gIH07XG4gIHNlbGYuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGZ1bmN0aW9uIChldikge1xuICAgIC8vY29uc29sZS5sb2coJ2RlbXV4ZXIgY21kOicgKyBldi5kYXRhLmNtZCk7XG4gICAgc3dpdGNoIChldi5kYXRhLmNtZCkge1xuICAgICAgY2FzZSAnaW5pdCc6XG4gICAgICAgIHNlbGYuZGVtdXhlciA9IG5ldyBEZW11eGVySW5saW5lKG9ic2VydmVyLE1QNFJlbXV4ZXIpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ2RlbXV4JzpcbiAgICAgICAgdmFyIGRhdGEgPSBldi5kYXRhO1xuICAgICAgICBzZWxmLmRlbXV4ZXIucHVzaChuZXcgVWludDhBcnJheShkYXRhLmRhdGEpLCBkYXRhLmF1ZGlvQ29kZWMsIGRhdGEudmlkZW9Db2RlYywgZGF0YS50aW1lT2Zmc2V0LCBkYXRhLmNjLCBkYXRhLmxldmVsLCBkYXRhLnNuLCBkYXRhLmR1cmF0aW9uKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBicmVhaztcbiAgICB9XG4gIH0pO1xuXG4gIC8vIGxpc3RlbiB0byBldmVudHMgdHJpZ2dlcmVkIGJ5IFRTIERlbXV4ZXJcbiAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCwgZnVuY3Rpb24oZXYsIGRhdGEpIHtcbiAgICB2YXIgb2JqRGF0YSA9IHtldmVudDogZXZ9O1xuICAgIHZhciBvYmpUcmFuc2ZlcmFibGUgPSBbXTtcbiAgICBpZiAoZGF0YS5hdWRpb0NvZGVjKSB7XG4gICAgICBvYmpEYXRhLmF1ZGlvQ29kZWMgPSBkYXRhLmF1ZGlvQ29kZWM7XG4gICAgICBvYmpEYXRhLmF1ZGlvTW9vdiA9IGRhdGEuYXVkaW9Nb292LmJ1ZmZlcjtcbiAgICAgIG9iakRhdGEuYXVkaW9DaGFubmVsQ291bnQgPSBkYXRhLmF1ZGlvQ2hhbm5lbENvdW50O1xuICAgICAgb2JqVHJhbnNmZXJhYmxlLnB1c2gob2JqRGF0YS5hdWRpb01vb3YpO1xuICAgIH1cbiAgICBpZiAoZGF0YS52aWRlb0NvZGVjKSB7XG4gICAgICBvYmpEYXRhLnZpZGVvQ29kZWMgPSBkYXRhLnZpZGVvQ29kZWM7XG4gICAgICBvYmpEYXRhLnZpZGVvTW9vdiA9IGRhdGEudmlkZW9Nb292LmJ1ZmZlcjtcbiAgICAgIG9iakRhdGEudmlkZW9XaWR0aCA9IGRhdGEudmlkZW9XaWR0aDtcbiAgICAgIG9iakRhdGEudmlkZW9IZWlnaHQgPSBkYXRhLnZpZGVvSGVpZ2h0O1xuICAgICAgb2JqVHJhbnNmZXJhYmxlLnB1c2gob2JqRGF0YS52aWRlb01vb3YpO1xuICAgIH1cbiAgICAvLyBwYXNzIG1vb3YgYXMgdHJhbnNmZXJhYmxlIG9iamVjdCAobm8gY29weSlcbiAgICBzZWxmLnBvc3RNZXNzYWdlKG9iakRhdGEsb2JqVHJhbnNmZXJhYmxlKTtcbiAgfSk7XG5cbiAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19QQVJTSU5HX0RBVEEsIGZ1bmN0aW9uKGV2LCBkYXRhKSB7XG4gICAgdmFyIG9iakRhdGEgPSB7ZXZlbnQ6IGV2LCB0eXBlOiBkYXRhLnR5cGUsIHN0YXJ0UFRTOiBkYXRhLnN0YXJ0UFRTLCBlbmRQVFM6IGRhdGEuZW5kUFRTLCBzdGFydERUUzogZGF0YS5zdGFydERUUywgZW5kRFRTOiBkYXRhLmVuZERUUywgbW9vZjogZGF0YS5tb29mLmJ1ZmZlciwgbWRhdDogZGF0YS5tZGF0LmJ1ZmZlciwgbmI6IGRhdGEubmJ9O1xuICAgIC8vIHBhc3MgbW9vZi9tZGF0IGRhdGEgYXMgdHJhbnNmZXJhYmxlIG9iamVjdCAobm8gY29weSlcbiAgICBzZWxmLnBvc3RNZXNzYWdlKG9iakRhdGEsIFtvYmpEYXRhLm1vb2YsIG9iakRhdGEubWRhdF0pO1xuICB9KTtcblxuICBvYnNlcnZlci5vbihFdmVudC5GUkFHX1BBUlNFRCwgZnVuY3Rpb24oZXZlbnQpIHtcbiAgICBzZWxmLnBvc3RNZXNzYWdlKHtldmVudDogZXZlbnR9KTtcbiAgfSk7XG5cbiAgb2JzZXJ2ZXIub24oRXZlbnQuRVJST1IsIGZ1bmN0aW9uKGV2ZW50LCBkYXRhKSB7XG4gICAgc2VsZi5wb3N0TWVzc2FnZSh7ZXZlbnQ6IGV2ZW50LCBkYXRhOiBkYXRhfSk7XG4gIH0pO1xuXG4gIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0lOR19NRVRBREFUQSwgZnVuY3Rpb24oZXZlbnQsIGRhdGEpIHtcbiAgICB2YXIgb2JqRGF0YSA9IHtldmVudDogZXZlbnQsIHNhbXBsZXM6IGRhdGEuc2FtcGxlc307XG4gICAgc2VsZi5wb3N0TWVzc2FnZShvYmpEYXRhKTtcbiAgfSk7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBEZW11eGVyV29ya2VyO1xuXG4iLCJpbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBEZW11eGVySW5saW5lIGZyb20gJy4uL2RlbXV4L2RlbXV4ZXItaW5saW5lJztcbmltcG9ydCBEZW11eGVyV29ya2VyIGZyb20gJy4uL2RlbXV4L2RlbXV4ZXItd29ya2VyJztcbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IE1QNFJlbXV4ZXIgZnJvbSAnLi4vcmVtdXgvbXA0LXJlbXV4ZXInO1xuaW1wb3J0IERlY3J5cHRlciBmcm9tICcuLi9jcnlwdC9kZWNyeXB0ZXInO1xuXG5jbGFzcyBEZW11eGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMpIHtcbiAgICB0aGlzLmhscyA9IGhscztcbiAgICBpZiAoaGxzLmNvbmZpZy5lbmFibGVXb3JrZXIgJiYgKHR5cGVvZihXb3JrZXIpICE9PSAndW5kZWZpbmVkJykpIHtcbiAgICAgICAgbG9nZ2VyLmxvZygnZGVtdXhpbmcgaW4gd2Vid29ya2VyJyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdmFyIHdvcmsgPSByZXF1aXJlKCd3ZWJ3b3JraWZ5Jyk7XG4gICAgICAgICAgdGhpcy53ID0gd29yayhEZW11eGVyV29ya2VyKTtcbiAgICAgICAgICB0aGlzLm9ud21zZyA9IHRoaXMub25Xb3JrZXJNZXNzYWdlLmJpbmQodGhpcyk7XG4gICAgICAgICAgdGhpcy53LmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCB0aGlzLm9ud21zZyk7XG4gICAgICAgICAgdGhpcy53LnBvc3RNZXNzYWdlKHtjbWQ6ICdpbml0J30pO1xuICAgICAgICB9IGNhdGNoKGVycikge1xuICAgICAgICAgIGxvZ2dlci5lcnJvcignZXJyb3Igd2hpbGUgaW5pdGlhbGl6aW5nIERlbXV4ZXJXb3JrZXIsIGZhbGxiYWNrIG9uIERlbXV4ZXJJbmxpbmUnKTtcbiAgICAgICAgICB0aGlzLmRlbXV4ZXIgPSBuZXcgRGVtdXhlcklubGluZShobHMsTVA0UmVtdXhlcik7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZGVtdXhlciA9IG5ldyBEZW11eGVySW5saW5lKGhscyxNUDRSZW11eGVyKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuZGVtdXhJbml0aWFsaXplZCA9IHRydWU7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIGlmICh0aGlzLncpIHtcbiAgICAgIHRoaXMudy5yZW1vdmVFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgdGhpcy5vbndtc2cpO1xuICAgICAgdGhpcy53LnRlcm1pbmF0ZSgpO1xuICAgICAgdGhpcy53ID0gbnVsbDtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5kZW11eGVyLmRlc3Ryb3koKTtcbiAgICB9XG4gIH1cblxuICBwdXNoRGVjcnlwdGVkKGRhdGEsIGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQsIGNjLCBsZXZlbCwgc24sIGR1cmF0aW9uKSB7XG4gICAgaWYgKHRoaXMudykge1xuICAgICAgLy8gcG9zdCBmcmFnbWVudCBwYXlsb2FkIGFzIHRyYW5zZmVyYWJsZSBvYmplY3RzIChubyBjb3B5KVxuICAgICAgdGhpcy53LnBvc3RNZXNzYWdlKHtjbWQ6ICdkZW11eCcsIGRhdGE6IGRhdGEsIGF1ZGlvQ29kZWM6IGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWM6IHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQ6IHRpbWVPZmZzZXQsIGNjOiBjYywgbGV2ZWw6IGxldmVsLCBzbiA6IHNuLCBkdXJhdGlvbjogZHVyYXRpb259LCBbZGF0YV0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRlbXV4ZXIucHVzaChuZXcgVWludDhBcnJheShkYXRhKSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCwgY2MsIGxldmVsLCBzbiwgZHVyYXRpb24pO1xuICAgIH1cbiAgfVxuXG4gIHB1c2goZGF0YSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCwgY2MsIGxldmVsLCBzbiwgZHVyYXRpb24sIGRlY3J5cHRkYXRhKSB7XG4gICAgaWYgKChkYXRhLmJ5dGVMZW5ndGggPiAwKSAmJiAoZGVjcnlwdGRhdGEgIT0gbnVsbCkgJiYgKGRlY3J5cHRkYXRhLmtleSAhPSBudWxsKSAmJiAoZGVjcnlwdGRhdGEubWV0aG9kID09PSAnQUVTLTEyOCcpKSB7XG4gICAgICBpZiAodGhpcy5kZWNyeXB0ZXIgPT0gbnVsbCkge1xuICAgICAgICB0aGlzLmRlY3J5cHRlciA9IG5ldyBEZWNyeXB0ZXIodGhpcy5obHMpO1xuICAgICAgfVxuICAgICAgXG4gICAgICB2YXIgbG9jYWx0aGlzID0gdGhpcztcbiAgICAgIHRoaXMuZGVjcnlwdGVyLmRlY3J5cHQoZGF0YSwgZGVjcnlwdGRhdGEua2V5LCBkZWNyeXB0ZGF0YS5pdiwgZnVuY3Rpb24oZGVjcnlwdGVkRGF0YSl7XG4gICAgICAgIGxvY2FsdGhpcy5wdXNoRGVjcnlwdGVkKGRlY3J5cHRlZERhdGEsIGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQsIGNjLCBsZXZlbCwgc24sIGR1cmF0aW9uKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnB1c2hEZWNyeXB0ZWQoZGF0YSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCwgY2MsIGxldmVsLCBzbiwgZHVyYXRpb24pO1xuICAgIH1cbiAgfVxuXG4gIG9uV29ya2VyTWVzc2FnZShldikge1xuICAgIC8vY29uc29sZS5sb2coJ29uV29ya2VyTWVzc2FnZTonICsgZXYuZGF0YS5ldmVudCk7XG4gICAgc3dpdGNoKGV2LmRhdGEuZXZlbnQpIHtcbiAgICAgIGNhc2UgRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVDpcbiAgICAgICAgdmFyIG9iaiA9IHt9O1xuICAgICAgICBpZiAoZXYuZGF0YS5hdWRpb01vb3YpIHtcbiAgICAgICAgICBvYmouYXVkaW9Nb292ID0gbmV3IFVpbnQ4QXJyYXkoZXYuZGF0YS5hdWRpb01vb3YpO1xuICAgICAgICAgIG9iai5hdWRpb0NvZGVjID0gZXYuZGF0YS5hdWRpb0NvZGVjO1xuICAgICAgICAgIG9iai5hdWRpb0NoYW5uZWxDb3VudCA9IGV2LmRhdGEuYXVkaW9DaGFubmVsQ291bnQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGV2LmRhdGEudmlkZW9Nb292KSB7XG4gICAgICAgICAgb2JqLnZpZGVvTW9vdiA9IG5ldyBVaW50OEFycmF5KGV2LmRhdGEudmlkZW9Nb292KTtcbiAgICAgICAgICBvYmoudmlkZW9Db2RlYyA9IGV2LmRhdGEudmlkZW9Db2RlYztcbiAgICAgICAgICBvYmoudmlkZW9XaWR0aCA9IGV2LmRhdGEudmlkZW9XaWR0aDtcbiAgICAgICAgICBvYmoudmlkZW9IZWlnaHQgPSBldi5kYXRhLnZpZGVvSGVpZ2h0O1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCwgb2JqKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBOlxuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLHtcbiAgICAgICAgICBtb29mOiBuZXcgVWludDhBcnJheShldi5kYXRhLm1vb2YpLFxuICAgICAgICAgIG1kYXQ6IG5ldyBVaW50OEFycmF5KGV2LmRhdGEubWRhdCksXG4gICAgICAgICAgc3RhcnRQVFM6IGV2LmRhdGEuc3RhcnRQVFMsXG4gICAgICAgICAgZW5kUFRTOiBldi5kYXRhLmVuZFBUUyxcbiAgICAgICAgICBzdGFydERUUzogZXYuZGF0YS5zdGFydERUUyxcbiAgICAgICAgICBlbmREVFM6IGV2LmRhdGEuZW5kRFRTLFxuICAgICAgICAgIHR5cGU6IGV2LmRhdGEudHlwZSxcbiAgICAgICAgICBuYjogZXYuZGF0YS5uYlxuICAgICAgICB9KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgRXZlbnQuRlJBR19QQVJTSU5HX01FVEFEQVRBOlxuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19NRVRBREFUQSwge1xuICAgICAgICAgIHNhbXBsZXM6IGV2LmRhdGEuc2FtcGxlc1xuICAgICAgICB9KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKGV2LmRhdGEuZXZlbnQsIGV2LmRhdGEuZGF0YSk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBEZW11eGVyO1xuXG4iLCIvKipcbiAqIFBhcnNlciBmb3IgZXhwb25lbnRpYWwgR29sb21iIGNvZGVzLCBhIHZhcmlhYmxlLWJpdHdpZHRoIG51bWJlciBlbmNvZGluZyBzY2hlbWUgdXNlZCBieSBoMjY0LlxuKi9cblxuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5cbmNsYXNzIEV4cEdvbG9tYiB7XG5cbiAgY29uc3RydWN0b3IoZGF0YSkge1xuICAgIHRoaXMuZGF0YSA9IGRhdGE7XG4gICAgLy8gdGhlIG51bWJlciBvZiBieXRlcyBsZWZ0IHRvIGV4YW1pbmUgaW4gdGhpcy5kYXRhXG4gICAgdGhpcy5ieXRlc0F2YWlsYWJsZSA9IHRoaXMuZGF0YS5ieXRlTGVuZ3RoO1xuICAgIC8vIHRoZSBjdXJyZW50IHdvcmQgYmVpbmcgZXhhbWluZWRcbiAgICB0aGlzLndvcmQgPSAwOyAvLyA6dWludFxuICAgIC8vIHRoZSBudW1iZXIgb2YgYml0cyBsZWZ0IHRvIGV4YW1pbmUgaW4gdGhlIGN1cnJlbnQgd29yZFxuICAgIHRoaXMuYml0c0F2YWlsYWJsZSA9IDA7IC8vIDp1aW50XG4gIH1cblxuICAvLyAoKTp2b2lkXG4gIGxvYWRXb3JkKCkge1xuICAgIHZhclxuICAgICAgcG9zaXRpb24gPSB0aGlzLmRhdGEuYnl0ZUxlbmd0aCAtIHRoaXMuYnl0ZXNBdmFpbGFibGUsXG4gICAgICB3b3JraW5nQnl0ZXMgPSBuZXcgVWludDhBcnJheSg0KSxcbiAgICAgIGF2YWlsYWJsZUJ5dGVzID0gTWF0aC5taW4oNCwgdGhpcy5ieXRlc0F2YWlsYWJsZSk7XG4gICAgaWYgKGF2YWlsYWJsZUJ5dGVzID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ25vIGJ5dGVzIGF2YWlsYWJsZScpO1xuICAgIH1cbiAgICB3b3JraW5nQnl0ZXMuc2V0KHRoaXMuZGF0YS5zdWJhcnJheShwb3NpdGlvbiwgcG9zaXRpb24gKyBhdmFpbGFibGVCeXRlcykpO1xuICAgIHRoaXMud29yZCA9IG5ldyBEYXRhVmlldyh3b3JraW5nQnl0ZXMuYnVmZmVyKS5nZXRVaW50MzIoMCk7XG4gICAgLy8gdHJhY2sgdGhlIGFtb3VudCBvZiB0aGlzLmRhdGEgdGhhdCBoYXMgYmVlbiBwcm9jZXNzZWRcbiAgICB0aGlzLmJpdHNBdmFpbGFibGUgPSBhdmFpbGFibGVCeXRlcyAqIDg7XG4gICAgdGhpcy5ieXRlc0F2YWlsYWJsZSAtPSBhdmFpbGFibGVCeXRlcztcbiAgfVxuXG4gIC8vIChjb3VudDppbnQpOnZvaWRcbiAgc2tpcEJpdHMoY291bnQpIHtcbiAgICB2YXIgc2tpcEJ5dGVzOyAvLyA6aW50XG4gICAgaWYgKHRoaXMuYml0c0F2YWlsYWJsZSA+IGNvdW50KSB7XG4gICAgICB0aGlzLndvcmQgPDw9IGNvdW50O1xuICAgICAgdGhpcy5iaXRzQXZhaWxhYmxlIC09IGNvdW50O1xuICAgIH0gZWxzZSB7XG4gICAgICBjb3VudCAtPSB0aGlzLmJpdHNBdmFpbGFibGU7XG4gICAgICBza2lwQnl0ZXMgPSBjb3VudCA+PiAzO1xuICAgICAgY291bnQgLT0gKHNraXBCeXRlcyA+PiAzKTtcbiAgICAgIHRoaXMuYnl0ZXNBdmFpbGFibGUgLT0gc2tpcEJ5dGVzO1xuICAgICAgdGhpcy5sb2FkV29yZCgpO1xuICAgICAgdGhpcy53b3JkIDw8PSBjb3VudDtcbiAgICAgIHRoaXMuYml0c0F2YWlsYWJsZSAtPSBjb3VudDtcbiAgICB9XG4gIH1cblxuICAvLyAoc2l6ZTppbnQpOnVpbnRcbiAgcmVhZEJpdHMoc2l6ZSkge1xuICAgIHZhclxuICAgICAgYml0cyA9IE1hdGgubWluKHRoaXMuYml0c0F2YWlsYWJsZSwgc2l6ZSksIC8vIDp1aW50XG4gICAgICB2YWx1ID0gdGhpcy53b3JkID4+PiAoMzIgLSBiaXRzKTsgLy8gOnVpbnRcbiAgICBpZiAoc2l6ZSA+IDMyKSB7XG4gICAgICBsb2dnZXIuZXJyb3IoJ0Nhbm5vdCByZWFkIG1vcmUgdGhhbiAzMiBiaXRzIGF0IGEgdGltZScpO1xuICAgIH1cbiAgICB0aGlzLmJpdHNBdmFpbGFibGUgLT0gYml0cztcbiAgICBpZiAodGhpcy5iaXRzQXZhaWxhYmxlID4gMCkge1xuICAgICAgdGhpcy53b3JkIDw8PSBiaXRzO1xuICAgIH0gZWxzZSBpZiAodGhpcy5ieXRlc0F2YWlsYWJsZSA+IDApIHtcbiAgICAgIHRoaXMubG9hZFdvcmQoKTtcbiAgICB9XG4gICAgYml0cyA9IHNpemUgLSBiaXRzO1xuICAgIGlmIChiaXRzID4gMCkge1xuICAgICAgcmV0dXJuIHZhbHUgPDwgYml0cyB8IHRoaXMucmVhZEJpdHMoYml0cyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB2YWx1O1xuICAgIH1cbiAgfVxuXG4gIC8vICgpOnVpbnRcbiAgc2tpcExaKCkge1xuICAgIHZhciBsZWFkaW5nWmVyb0NvdW50OyAvLyA6dWludFxuICAgIGZvciAobGVhZGluZ1plcm9Db3VudCA9IDA7IGxlYWRpbmdaZXJvQ291bnQgPCB0aGlzLmJpdHNBdmFpbGFibGU7ICsrbGVhZGluZ1plcm9Db3VudCkge1xuICAgICAgaWYgKDAgIT09ICh0aGlzLndvcmQgJiAoMHg4MDAwMDAwMCA+Pj4gbGVhZGluZ1plcm9Db3VudCkpKSB7XG4gICAgICAgIC8vIHRoZSBmaXJzdCBiaXQgb2Ygd29ya2luZyB3b3JkIGlzIDFcbiAgICAgICAgdGhpcy53b3JkIDw8PSBsZWFkaW5nWmVyb0NvdW50O1xuICAgICAgICB0aGlzLmJpdHNBdmFpbGFibGUgLT0gbGVhZGluZ1plcm9Db3VudDtcbiAgICAgICAgcmV0dXJuIGxlYWRpbmdaZXJvQ291bnQ7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIHdlIGV4aGF1c3RlZCB3b3JkIGFuZCBzdGlsbCBoYXZlIG5vdCBmb3VuZCBhIDFcbiAgICB0aGlzLmxvYWRXb3JkKCk7XG4gICAgcmV0dXJuIGxlYWRpbmdaZXJvQ291bnQgKyB0aGlzLnNraXBMWigpO1xuICB9XG5cbiAgLy8gKCk6dm9pZFxuICBza2lwVUVHKCkge1xuICAgIHRoaXMuc2tpcEJpdHMoMSArIHRoaXMuc2tpcExaKCkpO1xuICB9XG5cbiAgLy8gKCk6dm9pZFxuICBza2lwRUcoKSB7XG4gICAgdGhpcy5za2lwQml0cygxICsgdGhpcy5za2lwTFooKSk7XG4gIH1cblxuICAvLyAoKTp1aW50XG4gIHJlYWRVRUcoKSB7XG4gICAgdmFyIGNseiA9IHRoaXMuc2tpcExaKCk7IC8vIDp1aW50XG4gICAgcmV0dXJuIHRoaXMucmVhZEJpdHMoY2x6ICsgMSkgLSAxO1xuICB9XG5cbiAgLy8gKCk6aW50XG4gIHJlYWRFRygpIHtcbiAgICB2YXIgdmFsdSA9IHRoaXMucmVhZFVFRygpOyAvLyA6aW50XG4gICAgaWYgKDB4MDEgJiB2YWx1KSB7XG4gICAgICAvLyB0aGUgbnVtYmVyIGlzIG9kZCBpZiB0aGUgbG93IG9yZGVyIGJpdCBpcyBzZXRcbiAgICAgIHJldHVybiAoMSArIHZhbHUpID4+PiAxOyAvLyBhZGQgMSB0byBtYWtlIGl0IGV2ZW4sIGFuZCBkaXZpZGUgYnkgMlxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gLTEgKiAodmFsdSA+Pj4gMSk7IC8vIGRpdmlkZSBieSB0d28gdGhlbiBtYWtlIGl0IG5lZ2F0aXZlXG4gICAgfVxuICB9XG5cbiAgLy8gU29tZSBjb252ZW5pZW5jZSBmdW5jdGlvbnNcbiAgLy8gOkJvb2xlYW5cbiAgcmVhZEJvb2xlYW4oKSB7XG4gICAgcmV0dXJuIDEgPT09IHRoaXMucmVhZEJpdHMoMSk7XG4gIH1cblxuICAvLyAoKTppbnRcbiAgcmVhZFVCeXRlKCkge1xuICAgIHJldHVybiB0aGlzLnJlYWRCaXRzKDgpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkdmFuY2UgdGhlIEV4cEdvbG9tYiBkZWNvZGVyIHBhc3QgYSBzY2FsaW5nIGxpc3QuIFRoZSBzY2FsaW5nXG4gICAqIGxpc3QgaXMgb3B0aW9uYWxseSB0cmFuc21pdHRlZCBhcyBwYXJ0IG9mIGEgc2VxdWVuY2UgcGFyYW1ldGVyXG4gICAqIHNldCBhbmQgaXMgbm90IHJlbGV2YW50IHRvIHRyYW5zbXV4aW5nLlxuICAgKiBAcGFyYW0gY291bnQge251bWJlcn0gdGhlIG51bWJlciBvZiBlbnRyaWVzIGluIHRoaXMgc2NhbGluZyBsaXN0XG4gICAqIEBzZWUgUmVjb21tZW5kYXRpb24gSVRVLVQgSC4yNjQsIFNlY3Rpb24gNy4zLjIuMS4xLjFcbiAgICovXG4gIHNraXBTY2FsaW5nTGlzdChjb3VudCkge1xuICAgIHZhclxuICAgICAgbGFzdFNjYWxlID0gOCxcbiAgICAgIG5leHRTY2FsZSA9IDgsXG4gICAgICBqLFxuICAgICAgZGVsdGFTY2FsZTtcbiAgICBmb3IgKGogPSAwOyBqIDwgY291bnQ7IGorKykge1xuICAgICAgaWYgKG5leHRTY2FsZSAhPT0gMCkge1xuICAgICAgICBkZWx0YVNjYWxlID0gdGhpcy5yZWFkRUcoKTtcbiAgICAgICAgbmV4dFNjYWxlID0gKGxhc3RTY2FsZSArIGRlbHRhU2NhbGUgKyAyNTYpICUgMjU2O1xuICAgICAgfVxuICAgICAgbGFzdFNjYWxlID0gKG5leHRTY2FsZSA9PT0gMCkgPyBsYXN0U2NhbGUgOiBuZXh0U2NhbGU7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJlYWQgYSBzZXF1ZW5jZSBwYXJhbWV0ZXIgc2V0IGFuZCByZXR1cm4gc29tZSBpbnRlcmVzdGluZyB2aWRlb1xuICAgKiBwcm9wZXJ0aWVzLiBBIHNlcXVlbmNlIHBhcmFtZXRlciBzZXQgaXMgdGhlIEgyNjQgbWV0YWRhdGEgdGhhdFxuICAgKiBkZXNjcmliZXMgdGhlIHByb3BlcnRpZXMgb2YgdXBjb21pbmcgdmlkZW8gZnJhbWVzLlxuICAgKiBAcGFyYW0gZGF0YSB7VWludDhBcnJheX0gdGhlIGJ5dGVzIG9mIGEgc2VxdWVuY2UgcGFyYW1ldGVyIHNldFxuICAgKiBAcmV0dXJuIHtvYmplY3R9IGFuIG9iamVjdCB3aXRoIGNvbmZpZ3VyYXRpb24gcGFyc2VkIGZyb20gdGhlXG4gICAqIHNlcXVlbmNlIHBhcmFtZXRlciBzZXQsIGluY2x1ZGluZyB0aGUgZGltZW5zaW9ucyBvZiB0aGVcbiAgICogYXNzb2NpYXRlZCB2aWRlbyBmcmFtZXMuXG4gICAqL1xuICByZWFkU1BTKCkge1xuICAgIHZhclxuICAgICAgZnJhbWVDcm9wTGVmdE9mZnNldCA9IDAsXG4gICAgICBmcmFtZUNyb3BSaWdodE9mZnNldCA9IDAsXG4gICAgICBmcmFtZUNyb3BUb3BPZmZzZXQgPSAwLFxuICAgICAgZnJhbWVDcm9wQm90dG9tT2Zmc2V0ID0gMCxcbiAgICAgIHByb2ZpbGVJZGMscHJvZmlsZUNvbXBhdCxsZXZlbElkYyxcbiAgICAgIG51bVJlZkZyYW1lc0luUGljT3JkZXJDbnRDeWNsZSwgcGljV2lkdGhJbk1ic01pbnVzMSxcbiAgICAgIHBpY0hlaWdodEluTWFwVW5pdHNNaW51czEsXG4gICAgICBmcmFtZU1ic09ubHlGbGFnLFxuICAgICAgc2NhbGluZ0xpc3RDb3VudCxcbiAgICAgIGk7XG4gICAgdGhpcy5yZWFkVUJ5dGUoKTtcbiAgICBwcm9maWxlSWRjID0gdGhpcy5yZWFkVUJ5dGUoKTsgLy8gcHJvZmlsZV9pZGNcbiAgICBwcm9maWxlQ29tcGF0ID0gdGhpcy5yZWFkQml0cyg1KTsgLy8gY29uc3RyYWludF9zZXRbMC00XV9mbGFnLCB1KDUpXG4gICAgdGhpcy5za2lwQml0cygzKTsgLy8gcmVzZXJ2ZWRfemVyb18zYml0cyB1KDMpLFxuICAgIGxldmVsSWRjID0gdGhpcy5yZWFkVUJ5dGUoKTsgLy9sZXZlbF9pZGMgdSg4KVxuICAgIHRoaXMuc2tpcFVFRygpOyAvLyBzZXFfcGFyYW1ldGVyX3NldF9pZFxuICAgIC8vIHNvbWUgcHJvZmlsZXMgaGF2ZSBtb3JlIG9wdGlvbmFsIGRhdGEgd2UgZG9uJ3QgbmVlZFxuICAgIGlmIChwcm9maWxlSWRjID09PSAxMDAgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gMTEwIHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDEyMiB8fFxuICAgICAgICBwcm9maWxlSWRjID09PSAxNDQpIHtcbiAgICAgIHZhciBjaHJvbWFGb3JtYXRJZGMgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICAgIGlmIChjaHJvbWFGb3JtYXRJZGMgPT09IDMpIHtcbiAgICAgICAgdGhpcy5za2lwQml0cygxKTsgLy8gc2VwYXJhdGVfY29sb3VyX3BsYW5lX2ZsYWdcbiAgICAgIH1cbiAgICAgIHRoaXMuc2tpcFVFRygpOyAvLyBiaXRfZGVwdGhfbHVtYV9taW51czhcbiAgICAgIHRoaXMuc2tpcFVFRygpOyAvLyBiaXRfZGVwdGhfY2hyb21hX21pbnVzOFxuICAgICAgdGhpcy5za2lwQml0cygxKTsgLy8gcXBwcmltZV95X3plcm9fdHJhbnNmb3JtX2J5cGFzc19mbGFnXG4gICAgICBpZiAodGhpcy5yZWFkQm9vbGVhbigpKSB7IC8vIHNlcV9zY2FsaW5nX21hdHJpeF9wcmVzZW50X2ZsYWdcbiAgICAgICAgc2NhbGluZ0xpc3RDb3VudCA9IChjaHJvbWFGb3JtYXRJZGMgIT09IDMpID8gOCA6IDEyO1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgc2NhbGluZ0xpc3RDb3VudDsgaSsrKSB7XG4gICAgICAgICAgaWYgKHRoaXMucmVhZEJvb2xlYW4oKSkgeyAvLyBzZXFfc2NhbGluZ19saXN0X3ByZXNlbnRfZmxhZ1sgaSBdXG4gICAgICAgICAgICBpZiAoaSA8IDYpIHtcbiAgICAgICAgICAgICAgdGhpcy5za2lwU2NhbGluZ0xpc3QoMTYpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdGhpcy5za2lwU2NhbGluZ0xpc3QoNjQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLnNraXBVRUcoKTsgLy8gbG9nMl9tYXhfZnJhbWVfbnVtX21pbnVzNFxuICAgIHZhciBwaWNPcmRlckNudFR5cGUgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICBpZiAocGljT3JkZXJDbnRUeXBlID09PSAwKSB7XG4gICAgICB0aGlzLnJlYWRVRUcoKTsgLy9sb2cyX21heF9waWNfb3JkZXJfY250X2xzYl9taW51czRcbiAgICB9IGVsc2UgaWYgKHBpY09yZGVyQ250VHlwZSA9PT0gMSkge1xuICAgICAgdGhpcy5za2lwQml0cygxKTsgLy8gZGVsdGFfcGljX29yZGVyX2Fsd2F5c196ZXJvX2ZsYWdcbiAgICAgIHRoaXMuc2tpcEVHKCk7IC8vIG9mZnNldF9mb3Jfbm9uX3JlZl9waWNcbiAgICAgIHRoaXMuc2tpcEVHKCk7IC8vIG9mZnNldF9mb3JfdG9wX3RvX2JvdHRvbV9maWVsZFxuICAgICAgbnVtUmVmRnJhbWVzSW5QaWNPcmRlckNudEN5Y2xlID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgICBmb3IoaSA9IDA7IGkgPCBudW1SZWZGcmFtZXNJblBpY09yZGVyQ250Q3ljbGU7IGkrKykge1xuICAgICAgICB0aGlzLnNraXBFRygpOyAvLyBvZmZzZXRfZm9yX3JlZl9mcmFtZVsgaSBdXG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuc2tpcFVFRygpOyAvLyBtYXhfbnVtX3JlZl9mcmFtZXNcbiAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBnYXBzX2luX2ZyYW1lX251bV92YWx1ZV9hbGxvd2VkX2ZsYWdcbiAgICBwaWNXaWR0aEluTWJzTWludXMxID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgcGljSGVpZ2h0SW5NYXBVbml0c01pbnVzMSA9IHRoaXMucmVhZFVFRygpO1xuICAgIGZyYW1lTWJzT25seUZsYWcgPSB0aGlzLnJlYWRCaXRzKDEpO1xuICAgIGlmIChmcmFtZU1ic09ubHlGbGFnID09PSAwKSB7XG4gICAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBtYl9hZGFwdGl2ZV9mcmFtZV9maWVsZF9mbGFnXG4gICAgfVxuICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIGRpcmVjdF84eDhfaW5mZXJlbmNlX2ZsYWdcbiAgICBpZiAodGhpcy5yZWFkQm9vbGVhbigpKSB7IC8vIGZyYW1lX2Nyb3BwaW5nX2ZsYWdcbiAgICAgIGZyYW1lQ3JvcExlZnRPZmZzZXQgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICAgIGZyYW1lQ3JvcFJpZ2h0T2Zmc2V0ID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgICBmcmFtZUNyb3BUb3BPZmZzZXQgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICAgIGZyYW1lQ3JvcEJvdHRvbU9mZnNldCA9IHRoaXMucmVhZFVFRygpO1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgd2lkdGg6ICgocGljV2lkdGhJbk1ic01pbnVzMSArIDEpICogMTYpIC0gZnJhbWVDcm9wTGVmdE9mZnNldCAqIDIgLSBmcmFtZUNyb3BSaWdodE9mZnNldCAqIDIsXG4gICAgICBoZWlnaHQ6ICgoMiAtIGZyYW1lTWJzT25seUZsYWcpICogKHBpY0hlaWdodEluTWFwVW5pdHNNaW51czEgKyAxKSAqIDE2KSAtIChmcmFtZUNyb3BUb3BPZmZzZXQgKiAyKSAtIChmcmFtZUNyb3BCb3R0b21PZmZzZXQgKiAyKVxuICAgIH07XG4gIH1cblxuICByZWFkU2xpY2VUeXBlKCkge1xuICAgIC8vIHNraXAgTkFMdSB0eXBlXG4gICAgdGhpcy5yZWFkVUJ5dGUoKTtcbiAgICAvLyBkaXNjYXJkIGZpcnN0X21iX2luX3NsaWNlXG4gICAgdGhpcy5yZWFkVUVHKCk7XG4gICAgLy8gcmV0dXJuIHNsaWNlX3R5cGVcbiAgICByZXR1cm4gdGhpcy5yZWFkVUVHKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRXhwR29sb21iO1xuIiwiLyoqXG4gKiBoaWdobHkgb3B0aW1pemVkIFRTIGRlbXV4ZXI6XG4gKiBwYXJzZSBQQVQsIFBNVFxuICogZXh0cmFjdCBQRVMgcGFja2V0IGZyb20gYXVkaW8gYW5kIHZpZGVvIFBJRHNcbiAqIGV4dHJhY3QgQVZDL0gyNjQgTkFMIHVuaXRzIGFuZCBBQUMvQURUUyBzYW1wbGVzIGZyb20gUEVTIHBhY2tldFxuICogdHJpZ2dlciB0aGUgcmVtdXhlciB1cG9uIHBhcnNpbmcgY29tcGxldGlvblxuICogaXQgYWxzbyB0cmllcyB0byB3b3JrYXJvdW5kIGFzIGJlc3QgYXMgaXQgY2FuIGF1ZGlvIGNvZGVjIHN3aXRjaCAoSEUtQUFDIHRvIEFBQyBhbmQgdmljZSB2ZXJzYSksIHdpdGhvdXQgaGF2aW5nIHRvIHJlc3RhcnQgdGhlIE1lZGlhU291cmNlLlxuICogaXQgYWxzbyBjb250cm9scyB0aGUgcmVtdXhpbmcgcHJvY2VzcyA6XG4gKiB1cG9uIGRpc2NvbnRpbnVpdHkgb3IgbGV2ZWwgc3dpdGNoIGRldGVjdGlvbiwgaXQgd2lsbCBhbHNvIG5vdGlmaWVzIHRoZSByZW11eGVyIHNvIHRoYXQgaXQgY2FuIHJlc2V0IGl0cyBzdGF0ZS5cbiovXG5cbiBpbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbiBpbXBvcnQgRXhwR29sb21iIGZyb20gJy4vZXhwLWdvbG9tYic7XG4vLyBpbXBvcnQgSGV4IGZyb20gJy4uL3V0aWxzL2hleCc7XG4gaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG4gaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5cbiBjbGFzcyBUU0RlbXV4ZXIge1xuXG4gIGNvbnN0cnVjdG9yKG9ic2VydmVyLHJlbXV4ZXJDbGFzcykge1xuICAgIHRoaXMub2JzZXJ2ZXIgPSBvYnNlcnZlcjtcbiAgICB0aGlzLnJlbXV4ZXJDbGFzcyA9IHJlbXV4ZXJDbGFzcztcbiAgICB0aGlzLmxhc3RDQyA9IDA7XG4gICAgdGhpcy5QRVNfVElNRVNDQUxFID0gOTAwMDA7XG4gICAgdGhpcy5yZW11eGVyID0gbmV3IHRoaXMucmVtdXhlckNsYXNzKG9ic2VydmVyKTtcbiAgfVxuXG4gIHN0YXRpYyBwcm9iZShkYXRhKSB7XG4gICAgLy8gYSBUUyBmcmFnbWVudCBzaG91bGQgY29udGFpbiBhdCBsZWFzdCAzIFRTIHBhY2tldHMsIGEgUEFULCBhIFBNVCwgYW5kIG9uZSBQSUQsIGVhY2ggc3RhcnRpbmcgd2l0aCAweDQ3XG4gICAgaWYgKGRhdGEubGVuZ3RoID49IDMqMTg4ICYmIGRhdGFbMF0gPT09IDB4NDcgJiYgZGF0YVsxODhdID09PSAweDQ3ICYmIGRhdGFbMioxODhdID09PSAweDQ3KSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIHN3aXRjaExldmVsKCkge1xuICAgIHRoaXMucG10UGFyc2VkID0gZmFsc2U7XG4gICAgdGhpcy5fcG10SWQgPSAtMTtcbiAgICB0aGlzLl9hdmNUcmFjayA9IHt0eXBlOiAndmlkZW8nLCBpZCA6LTEsIHNlcXVlbmNlTnVtYmVyOiAwLCBzYW1wbGVzIDogW10sIGxlbiA6IDAsIG5iTmFsdSA6IDB9O1xuICAgIHRoaXMuX2FhY1RyYWNrID0ge3R5cGU6ICdhdWRpbycsIGlkIDotMSwgc2VxdWVuY2VOdW1iZXI6IDAsIHNhbXBsZXMgOiBbXSwgbGVuIDogMH07XG4gICAgdGhpcy5faWQzVHJhY2sgPSB7dHlwZTogJ2lkMycsIGlkIDotMSwgc2VxdWVuY2VOdW1iZXI6IDAsIHNhbXBsZXMgOiBbXSwgbGVuIDogMH07XG4gICAgdGhpcy5yZW11eGVyLnN3aXRjaExldmVsKCk7XG4gIH1cblxuICBpbnNlcnREaXNjb250aW51aXR5KCkge1xuICAgIHRoaXMuc3dpdGNoTGV2ZWwoKTtcbiAgICB0aGlzLnJlbXV4ZXIuaW5zZXJ0RGlzY29udGludWl0eSgpO1xuICB9XG5cbiAgLy8gZmVlZCBpbmNvbWluZyBkYXRhIHRvIHRoZSBmcm9udCBvZiB0aGUgcGFyc2luZyBwaXBlbGluZVxuICBwdXNoKGRhdGEsIGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQsIGNjLCBsZXZlbCwgc24sIGR1cmF0aW9uKSB7XG4gICAgdmFyIGF2Y0RhdGEsIGFhY0RhdGEsIGlkM0RhdGEsXG4gICAgICAgIHN0YXJ0LCBsZW4gPSBkYXRhLmxlbmd0aCwgc3R0LCBwaWQsIGF0Ziwgb2Zmc2V0O1xuICAgIHRoaXMuYXVkaW9Db2RlYyA9IGF1ZGlvQ29kZWM7XG4gICAgdGhpcy52aWRlb0NvZGVjID0gdmlkZW9Db2RlYztcbiAgICB0aGlzLnRpbWVPZmZzZXQgPSB0aW1lT2Zmc2V0O1xuICAgIHRoaXMuX2R1cmF0aW9uID0gZHVyYXRpb247XG4gICAgdGhpcy5jb250aWd1b3VzID0gZmFsc2U7XG4gICAgaWYgKGNjICE9PSB0aGlzLmxhc3RDQykge1xuICAgICAgbG9nZ2VyLmxvZygnZGlzY29udGludWl0eSBkZXRlY3RlZCcpO1xuICAgICAgdGhpcy5pbnNlcnREaXNjb250aW51aXR5KCk7XG4gICAgICB0aGlzLmxhc3RDQyA9IGNjO1xuICAgIH0gZWxzZSBpZiAobGV2ZWwgIT09IHRoaXMubGFzdExldmVsKSB7XG4gICAgICBsb2dnZXIubG9nKCdsZXZlbCBzd2l0Y2ggZGV0ZWN0ZWQnKTtcbiAgICAgIHRoaXMuc3dpdGNoTGV2ZWwoKTtcbiAgICAgIHRoaXMubGFzdExldmVsID0gbGV2ZWw7XG4gICAgfSBlbHNlIGlmIChzbiA9PT0gKHRoaXMubGFzdFNOKzEpKSB7XG4gICAgICB0aGlzLmNvbnRpZ3VvdXMgPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLmxhc3RTTiA9IHNuO1xuXG4gICAgaWYoIXRoaXMuY29udGlndW91cykge1xuICAgICAgLy8gZmx1c2ggYW55IHBhcnRpYWwgY29udGVudFxuICAgICAgdGhpcy5hYWNPdmVyRmxvdyA9IG51bGw7XG4gICAgfVxuXG4gICAgdmFyIHBtdFBhcnNlZCA9IHRoaXMucG10UGFyc2VkLFxuICAgICAgICBhdmNJZCA9IHRoaXMuX2F2Y1RyYWNrLmlkLFxuICAgICAgICBhYWNJZCA9IHRoaXMuX2FhY1RyYWNrLmlkLFxuICAgICAgICBpZDNJZCA9IHRoaXMuX2lkM1RyYWNrLmlkO1xuICAgIC8vIGxvb3AgdGhyb3VnaCBUUyBwYWNrZXRzXG4gICAgZm9yIChzdGFydCA9IDA7IHN0YXJ0IDwgbGVuOyBzdGFydCArPSAxODgpIHtcbiAgICAgIGlmIChkYXRhW3N0YXJ0XSA9PT0gMHg0Nykge1xuICAgICAgICBzdHQgPSAhIShkYXRhW3N0YXJ0ICsgMV0gJiAweDQwKTtcbiAgICAgICAgLy8gcGlkIGlzIGEgMTMtYml0IGZpZWxkIHN0YXJ0aW5nIGF0IHRoZSBsYXN0IGJpdCBvZiBUU1sxXVxuICAgICAgICBwaWQgPSAoKGRhdGFbc3RhcnQgKyAxXSAmIDB4MWYpIDw8IDgpICsgZGF0YVtzdGFydCArIDJdO1xuICAgICAgICBhdGYgPSAoZGF0YVtzdGFydCArIDNdICYgMHgzMCkgPj4gNDtcbiAgICAgICAgLy8gaWYgYW4gYWRhcHRpb24gZmllbGQgaXMgcHJlc2VudCwgaXRzIGxlbmd0aCBpcyBzcGVjaWZpZWQgYnkgdGhlIGZpZnRoIGJ5dGUgb2YgdGhlIFRTIHBhY2tldCBoZWFkZXIuXG4gICAgICAgIGlmIChhdGYgPiAxKSB7XG4gICAgICAgICAgb2Zmc2V0ID0gc3RhcnQgKyA1ICsgZGF0YVtzdGFydCArIDRdO1xuICAgICAgICAgIC8vIGNvbnRpbnVlIGlmIHRoZXJlIGlzIG9ubHkgYWRhcHRhdGlvbiBmaWVsZFxuICAgICAgICAgIGlmIChvZmZzZXQgPT09IChzdGFydCArIDE4OCkpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBvZmZzZXQgPSBzdGFydCArIDQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHBtdFBhcnNlZCkge1xuICAgICAgICAgIGlmIChwaWQgPT09IGF2Y0lkKSB7XG4gICAgICAgICAgICBpZiAoc3R0KSB7XG4gICAgICAgICAgICAgIGlmIChhdmNEYXRhKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcGFyc2VBVkNQRVModGhpcy5fcGFyc2VQRVMoYXZjRGF0YSkpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGF2Y0RhdGEgPSB7ZGF0YTogW10sIHNpemU6IDB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGF2Y0RhdGEpIHtcbiAgICAgICAgICAgICAgYXZjRGF0YS5kYXRhLnB1c2goZGF0YS5zdWJhcnJheShvZmZzZXQsIHN0YXJ0ICsgMTg4KSk7XG4gICAgICAgICAgICAgIGF2Y0RhdGEuc2l6ZSArPSBzdGFydCArIDE4OCAtIG9mZnNldDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgaWYgKHBpZCA9PT0gYWFjSWQpIHtcbiAgICAgICAgICAgIGlmIChzdHQpIHtcbiAgICAgICAgICAgICAgaWYgKGFhY0RhdGEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9wYXJzZUFBQ1BFUyh0aGlzLl9wYXJzZVBFUyhhYWNEYXRhKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgYWFjRGF0YSA9IHtkYXRhOiBbXSwgc2l6ZTogMH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoYWFjRGF0YSkge1xuICAgICAgICAgICAgICBhYWNEYXRhLmRhdGEucHVzaChkYXRhLnN1YmFycmF5KG9mZnNldCwgc3RhcnQgKyAxODgpKTtcbiAgICAgICAgICAgICAgYWFjRGF0YS5zaXplICs9IHN0YXJ0ICsgMTg4IC0gb2Zmc2V0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSBpZiAocGlkID09PSBpZDNJZCkge1xuICAgICAgICAgICAgaWYgKHN0dCkge1xuICAgICAgICAgICAgICBpZiAoaWQzRGF0YSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3BhcnNlSUQzUEVTKHRoaXMuX3BhcnNlUEVTKGlkM0RhdGEpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZDNEYXRhID0ge2RhdGE6IFtdLCBzaXplOiAwfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChpZDNEYXRhKSB7XG4gICAgICAgICAgICAgIGlkM0RhdGEuZGF0YS5wdXNoKGRhdGEuc3ViYXJyYXkob2Zmc2V0LCBzdGFydCArIDE4OCkpO1xuICAgICAgICAgICAgICBpZDNEYXRhLnNpemUgKz0gc3RhcnQgKyAxODggLSBvZmZzZXQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmIChzdHQpIHtcbiAgICAgICAgICAgIG9mZnNldCArPSBkYXRhW29mZnNldF0gKyAxO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAocGlkID09PSAwKSB7XG4gICAgICAgICAgICB0aGlzLl9wYXJzZVBBVChkYXRhLCBvZmZzZXQpO1xuICAgICAgICAgIH0gZWxzZSBpZiAocGlkID09PSB0aGlzLl9wbXRJZCkge1xuICAgICAgICAgICAgdGhpcy5fcGFyc2VQTVQoZGF0YSwgb2Zmc2V0KTtcbiAgICAgICAgICAgIHBtdFBhcnNlZCA9IHRoaXMucG10UGFyc2VkID0gdHJ1ZTtcbiAgICAgICAgICAgIGF2Y0lkID0gdGhpcy5fYXZjVHJhY2suaWQ7XG4gICAgICAgICAgICBhYWNJZCA9IHRoaXMuX2FhY1RyYWNrLmlkO1xuICAgICAgICAgICAgaWQzSWQgPSB0aGlzLl9pZDNUcmFjay5pZDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMub2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGUgOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuRlJBR19QQVJTSU5HX0VSUk9SLCBmYXRhbDogZmFsc2UsIHJlYXNvbjogJ1RTIHBhY2tldCBkaWQgbm90IHN0YXJ0IHdpdGggMHg0Nyd9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gcGFyc2UgbGFzdCBQRVMgcGFja2V0XG4gICAgaWYgKGF2Y0RhdGEpIHtcbiAgICAgIHRoaXMuX3BhcnNlQVZDUEVTKHRoaXMuX3BhcnNlUEVTKGF2Y0RhdGEpKTtcbiAgICB9XG4gICAgaWYgKGFhY0RhdGEpIHtcbiAgICAgIHRoaXMuX3BhcnNlQUFDUEVTKHRoaXMuX3BhcnNlUEVTKGFhY0RhdGEpKTtcbiAgICB9XG4gICAgaWYgKGlkM0RhdGEpIHtcbiAgICAgIHRoaXMuX3BhcnNlSUQzUEVTKHRoaXMuX3BhcnNlUEVTKGlkM0RhdGEpKTtcbiAgICB9XG4gICAgdGhpcy5yZW11eCgpO1xuICB9XG5cbiAgcmVtdXgoKSB7XG4gICAgdGhpcy5yZW11eGVyLnJlbXV4KHRoaXMuX2FhY1RyYWNrLHRoaXMuX2F2Y1RyYWNrLCB0aGlzLl9pZDNUcmFjaywgdGhpcy50aW1lT2Zmc2V0LCB0aGlzLmNvbnRpZ3VvdXMpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLnN3aXRjaExldmVsKCk7XG4gICAgdGhpcy5faW5pdFBUUyA9IHRoaXMuX2luaXREVFMgPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5fZHVyYXRpb24gPSAwO1xuICB9XG5cbiAgX3BhcnNlUEFUKGRhdGEsIG9mZnNldCkge1xuICAgIC8vIHNraXAgdGhlIFBTSSBoZWFkZXIgYW5kIHBhcnNlIHRoZSBmaXJzdCBQTVQgZW50cnlcbiAgICB0aGlzLl9wbXRJZCAgPSAoZGF0YVtvZmZzZXQgKyAxMF0gJiAweDFGKSA8PCA4IHwgZGF0YVtvZmZzZXQgKyAxMV07XG4gICAgLy9sb2dnZXIubG9nKCdQTVQgUElEOicgICsgdGhpcy5fcG10SWQpO1xuICB9XG5cbiAgX3BhcnNlUE1UKGRhdGEsIG9mZnNldCkge1xuICAgIHZhciBzZWN0aW9uTGVuZ3RoLCB0YWJsZUVuZCwgcHJvZ3JhbUluZm9MZW5ndGgsIHBpZDtcbiAgICBzZWN0aW9uTGVuZ3RoID0gKGRhdGFbb2Zmc2V0ICsgMV0gJiAweDBmKSA8PCA4IHwgZGF0YVtvZmZzZXQgKyAyXTtcbiAgICB0YWJsZUVuZCA9IG9mZnNldCArIDMgKyBzZWN0aW9uTGVuZ3RoIC0gNDtcbiAgICAvLyB0byBkZXRlcm1pbmUgd2hlcmUgdGhlIHRhYmxlIGlzLCB3ZSBoYXZlIHRvIGZpZ3VyZSBvdXQgaG93XG4gICAgLy8gbG9uZyB0aGUgcHJvZ3JhbSBpbmZvIGRlc2NyaXB0b3JzIGFyZVxuICAgIHByb2dyYW1JbmZvTGVuZ3RoID0gKGRhdGFbb2Zmc2V0ICsgMTBdICYgMHgwZikgPDwgOCB8IGRhdGFbb2Zmc2V0ICsgMTFdO1xuICAgIC8vIGFkdmFuY2UgdGhlIG9mZnNldCB0byB0aGUgZmlyc3QgZW50cnkgaW4gdGhlIG1hcHBpbmcgdGFibGVcbiAgICBvZmZzZXQgKz0gMTIgKyBwcm9ncmFtSW5mb0xlbmd0aDtcbiAgICB3aGlsZSAob2Zmc2V0IDwgdGFibGVFbmQpIHtcbiAgICAgIHBpZCA9IChkYXRhW29mZnNldCArIDFdICYgMHgxRikgPDwgOCB8IGRhdGFbb2Zmc2V0ICsgMl07XG4gICAgICBzd2l0Y2goZGF0YVtvZmZzZXRdKSB7XG4gICAgICAgIC8vIElTTy9JRUMgMTM4MTgtNyBBRFRTIEFBQyAoTVBFRy0yIGxvd2VyIGJpdC1yYXRlIGF1ZGlvKVxuICAgICAgICBjYXNlIDB4MGY6XG4gICAgICAgICAgLy9sb2dnZXIubG9nKCdBQUMgUElEOicgICsgcGlkKTtcbiAgICAgICAgICB0aGlzLl9hYWNUcmFjay5pZCA9IHBpZDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgLy8gUGFja2V0aXplZCBtZXRhZGF0YSAoSUQzKVxuICAgICAgICBjYXNlIDB4MTU6XG4gICAgICAgICAgLy9sb2dnZXIubG9nKCdJRDMgUElEOicgICsgcGlkKTtcbiAgICAgICAgICB0aGlzLl9pZDNUcmFjay5pZCA9IHBpZDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgLy8gSVRVLVQgUmVjLiBILjI2NCBhbmQgSVNPL0lFQyAxNDQ5Ni0xMCAobG93ZXIgYml0LXJhdGUgdmlkZW8pXG4gICAgICAgIGNhc2UgMHgxYjpcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ0FWQyBQSUQ6JyAgKyBwaWQpO1xuICAgICAgICAgIHRoaXMuX2F2Y1RyYWNrLmlkID0gcGlkO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICBsb2dnZXIubG9nKCd1bmtvd24gc3RyZWFtIHR5cGU6JyAgKyBkYXRhW29mZnNldF0pO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIC8vIG1vdmUgdG8gdGhlIG5leHQgdGFibGUgZW50cnlcbiAgICAgIC8vIHNraXAgcGFzdCB0aGUgZWxlbWVudGFyeSBzdHJlYW0gZGVzY3JpcHRvcnMsIGlmIHByZXNlbnRcbiAgICAgIG9mZnNldCArPSAoKGRhdGFbb2Zmc2V0ICsgM10gJiAweDBGKSA8PCA4IHwgZGF0YVtvZmZzZXQgKyA0XSkgKyA1O1xuICAgIH1cbiAgfVxuXG4gIF9wYXJzZVBFUyhzdHJlYW0pIHtcbiAgICB2YXIgaSA9IDAsIGZyYWcsIHBlc0ZsYWdzLCBwZXNQcmVmaXgsIHBlc0xlbiwgcGVzSGRyTGVuLCBwZXNEYXRhLCBwZXNQdHMsIHBlc0R0cywgcGF5bG9hZFN0YXJ0T2Zmc2V0O1xuICAgIC8vcmV0cmlldmUgUFRTL0RUUyBmcm9tIGZpcnN0IGZyYWdtZW50XG4gICAgZnJhZyA9IHN0cmVhbS5kYXRhWzBdO1xuICAgIHBlc1ByZWZpeCA9IChmcmFnWzBdIDw8IDE2KSArIChmcmFnWzFdIDw8IDgpICsgZnJhZ1syXTtcbiAgICBpZiAocGVzUHJlZml4ID09PSAxKSB7XG4gICAgICBwZXNMZW4gPSAoZnJhZ1s0XSA8PCA4KSArIGZyYWdbNV07XG4gICAgICBwZXNGbGFncyA9IGZyYWdbN107XG4gICAgICBpZiAocGVzRmxhZ3MgJiAweEMwKSB7XG4gICAgICAgIC8qIFBFUyBoZWFkZXIgZGVzY3JpYmVkIGhlcmUgOiBodHRwOi8vZHZkLnNvdXJjZWZvcmdlLm5ldC9kdmRpbmZvL3Blcy1oZHIuaHRtbFxuICAgICAgICAgICAgYXMgUFRTIC8gRFRTIGlzIDMzIGJpdCB3ZSBjYW5ub3QgdXNlIGJpdHdpc2Ugb3BlcmF0b3IgaW4gSlMsXG4gICAgICAgICAgICBhcyBCaXR3aXNlIG9wZXJhdG9ycyB0cmVhdCB0aGVpciBvcGVyYW5kcyBhcyBhIHNlcXVlbmNlIG9mIDMyIGJpdHMgKi9cbiAgICAgICAgcGVzUHRzID0gKGZyYWdbOV0gJiAweDBFKSAqIDUzNjg3MDkxMiArLy8gMSA8PCAyOVxuICAgICAgICAgIChmcmFnWzEwXSAmIDB4RkYpICogNDE5NDMwNCArLy8gMSA8PCAyMlxuICAgICAgICAgIChmcmFnWzExXSAmIDB4RkUpICogMTYzODQgKy8vIDEgPDwgMTRcbiAgICAgICAgICAoZnJhZ1sxMl0gJiAweEZGKSAqIDEyOCArLy8gMSA8PCA3XG4gICAgICAgICAgKGZyYWdbMTNdICYgMHhGRSkgLyAyO1xuICAgICAgICAgIC8vIGNoZWNrIGlmIGdyZWF0ZXIgdGhhbiAyXjMyIC0xXG4gICAgICAgICAgaWYgKHBlc1B0cyA+IDQyOTQ5NjcyOTUpIHtcbiAgICAgICAgICAgIC8vIGRlY3JlbWVudCAyXjMzXG4gICAgICAgICAgICBwZXNQdHMgLT0gODU4OTkzNDU5MjtcbiAgICAgICAgICB9XG4gICAgICAgIGlmIChwZXNGbGFncyAmIDB4NDApIHtcbiAgICAgICAgICBwZXNEdHMgPSAoZnJhZ1sxNF0gJiAweDBFICkgKiA1MzY4NzA5MTIgKy8vIDEgPDwgMjlcbiAgICAgICAgICAgIChmcmFnWzE1XSAmIDB4RkYgKSAqIDQxOTQzMDQgKy8vIDEgPDwgMjJcbiAgICAgICAgICAgIChmcmFnWzE2XSAmIDB4RkUgKSAqIDE2Mzg0ICsvLyAxIDw8IDE0XG4gICAgICAgICAgICAoZnJhZ1sxN10gJiAweEZGICkgKiAxMjggKy8vIDEgPDwgN1xuICAgICAgICAgICAgKGZyYWdbMThdICYgMHhGRSApIC8gMjtcbiAgICAgICAgICAvLyBjaGVjayBpZiBncmVhdGVyIHRoYW4gMl4zMiAtMVxuICAgICAgICAgIGlmIChwZXNEdHMgPiA0Mjk0OTY3Mjk1KSB7XG4gICAgICAgICAgICAvLyBkZWNyZW1lbnQgMl4zM1xuICAgICAgICAgICAgcGVzRHRzIC09IDg1ODk5MzQ1OTI7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlc0R0cyA9IHBlc1B0cztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcGVzSGRyTGVuID0gZnJhZ1s4XTtcbiAgICAgIHBheWxvYWRTdGFydE9mZnNldCA9IHBlc0hkckxlbiArIDk7XG4gICAgICAvLyB0cmltIFBFUyBoZWFkZXJcbiAgICAgIHN0cmVhbS5kYXRhWzBdID0gc3RyZWFtLmRhdGFbMF0uc3ViYXJyYXkocGF5bG9hZFN0YXJ0T2Zmc2V0KTtcbiAgICAgIHN0cmVhbS5zaXplIC09IHBheWxvYWRTdGFydE9mZnNldDtcbiAgICAgIC8vcmVhc3NlbWJsZSBQRVMgcGFja2V0XG4gICAgICBwZXNEYXRhID0gbmV3IFVpbnQ4QXJyYXkoc3RyZWFtLnNpemUpO1xuICAgICAgLy8gcmVhc3NlbWJsZSB0aGUgcGFja2V0XG4gICAgICB3aGlsZSAoc3RyZWFtLmRhdGEubGVuZ3RoKSB7XG4gICAgICAgIGZyYWcgPSBzdHJlYW0uZGF0YS5zaGlmdCgpO1xuICAgICAgICBwZXNEYXRhLnNldChmcmFnLCBpKTtcbiAgICAgICAgaSArPSBmcmFnLmJ5dGVMZW5ndGg7XG4gICAgICB9XG4gICAgICByZXR1cm4ge2RhdGE6IHBlc0RhdGEsIHB0czogcGVzUHRzLCBkdHM6IHBlc0R0cywgbGVuOiBwZXNMZW59O1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBfcGFyc2VBVkNQRVMocGVzKSB7XG4gICAgdmFyIHRyYWNrID0gdGhpcy5fYXZjVHJhY2ssXG4gICAgICAgIHNhbXBsZXMgPSB0cmFjay5zYW1wbGVzLFxuICAgICAgICB1bml0cyA9IHRoaXMuX3BhcnNlQVZDTkFMdShwZXMuZGF0YSksXG4gICAgICAgIHVuaXRzMiA9IFtdLFxuICAgICAgICBkZWJ1ZyA9IGZhbHNlLFxuICAgICAgICBrZXkgPSBmYWxzZSxcbiAgICAgICAgbGVuZ3RoID0gMCxcbiAgICAgICAgYXZjU2FtcGxlLFxuICAgICAgICBwdXNoO1xuICAgIC8vIG5vIE5BTHUgZm91bmRcbiAgICBpZiAodW5pdHMubGVuZ3RoID09PSAwICYmIHNhbXBsZXMubGVuZ3RoID4gMCkge1xuICAgICAgLy8gYXBwZW5kIHBlcy5kYXRhIHRvIHByZXZpb3VzIE5BTCB1bml0XG4gICAgICB2YXIgbGFzdGF2Y1NhbXBsZSA9IHNhbXBsZXNbc2FtcGxlcy5sZW5ndGggLSAxXTtcbiAgICAgIHZhciBsYXN0VW5pdCA9IGxhc3RhdmNTYW1wbGUudW5pdHMudW5pdHNbbGFzdGF2Y1NhbXBsZS51bml0cy51bml0cy5sZW5ndGggLSAxXTtcbiAgICAgIHZhciB0bXAgPSBuZXcgVWludDhBcnJheShsYXN0VW5pdC5kYXRhLmJ5dGVMZW5ndGggKyBwZXMuZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICAgIHRtcC5zZXQobGFzdFVuaXQuZGF0YSwgMCk7XG4gICAgICB0bXAuc2V0KHBlcy5kYXRhLCBsYXN0VW5pdC5kYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgbGFzdFVuaXQuZGF0YSA9IHRtcDtcbiAgICAgIGxhc3RhdmNTYW1wbGUudW5pdHMubGVuZ3RoICs9IHBlcy5kYXRhLmJ5dGVMZW5ndGg7XG4gICAgICB0cmFjay5sZW4gKz0gcGVzLmRhdGEuYnl0ZUxlbmd0aDtcbiAgICB9XG4gICAgLy9mcmVlIHBlcy5kYXRhIHRvIHNhdmUgdXAgc29tZSBtZW1vcnlcbiAgICBwZXMuZGF0YSA9IG51bGw7XG4gICAgdmFyIGRlYnVnU3RyaW5nID0gJyc7XG4gICAgdW5pdHMuZm9yRWFjaCh1bml0ID0+IHtcbiAgICAgIHN3aXRjaCh1bml0LnR5cGUpIHtcbiAgICAgICAgLy9ORFJcbiAgICAgICAgIGNhc2UgMTpcbiAgICAgICAgICAgcHVzaCA9IHRydWU7XG4gICAgICAgICAgIGlmKGRlYnVnKSB7XG4gICAgICAgICAgICBkZWJ1Z1N0cmluZyArPSAnTkRSICc7XG4gICAgICAgICAgIH1cbiAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIC8vSURSXG4gICAgICAgIGNhc2UgNTpcbiAgICAgICAgICBwdXNoID0gdHJ1ZTtcbiAgICAgICAgICBpZihkZWJ1Zykge1xuICAgICAgICAgICAgZGVidWdTdHJpbmcgKz0gJ0lEUiAnO1xuICAgICAgICAgIH1cbiAgICAgICAgICBrZXkgPSB0cnVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDY6XG4gICAgICAgICAgcHVzaCA9IHRydWU7XG4gICAgICAgICAgaWYoZGVidWcpIHtcbiAgICAgICAgICAgIGRlYnVnU3RyaW5nICs9ICdTRUkgJztcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIC8vU1BTXG4gICAgICAgIGNhc2UgNzpcbiAgICAgICAgICBwdXNoID0gdHJ1ZTtcbiAgICAgICAgICBpZihkZWJ1Zykge1xuICAgICAgICAgICAgZGVidWdTdHJpbmcgKz0gJ1NQUyAnO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZighdHJhY2suc3BzKSB7XG4gICAgICAgICAgICB2YXIgZXhwR29sb21iRGVjb2RlciA9IG5ldyBFeHBHb2xvbWIodW5pdC5kYXRhKTtcbiAgICAgICAgICAgIHZhciBjb25maWcgPSBleHBHb2xvbWJEZWNvZGVyLnJlYWRTUFMoKTtcbiAgICAgICAgICAgIHRyYWNrLndpZHRoID0gY29uZmlnLndpZHRoO1xuICAgICAgICAgICAgdHJhY2suaGVpZ2h0ID0gY29uZmlnLmhlaWdodDtcbiAgICAgICAgICAgIHRyYWNrLnNwcyA9IFt1bml0LmRhdGFdO1xuICAgICAgICAgICAgdHJhY2sudGltZXNjYWxlID0gdGhpcy5yZW11eGVyLnRpbWVzY2FsZTtcbiAgICAgICAgICAgIHRyYWNrLmR1cmF0aW9uID0gdGhpcy5yZW11eGVyLnRpbWVzY2FsZSAqIHRoaXMuX2R1cmF0aW9uO1xuICAgICAgICAgICAgdmFyIGNvZGVjYXJyYXkgPSB1bml0LmRhdGEuc3ViYXJyYXkoMSwgNCk7XG4gICAgICAgICAgICB2YXIgY29kZWNzdHJpbmcgPSAnYXZjMS4nO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCAzOyBpKyspIHtcbiAgICAgICAgICAgICAgdmFyIGggPSBjb2RlY2FycmF5W2ldLnRvU3RyaW5nKDE2KTtcbiAgICAgICAgICAgICAgaWYgKGgubGVuZ3RoIDwgMikge1xuICAgICAgICAgICAgICAgIGggPSAnMCcgKyBoO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGNvZGVjc3RyaW5nICs9IGg7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0cmFjay5jb2RlYyA9IGNvZGVjc3RyaW5nO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgLy9QUFNcbiAgICAgICAgY2FzZSA4OlxuICAgICAgICAgIHB1c2ggPSB0cnVlO1xuICAgICAgICAgIGlmKGRlYnVnKSB7XG4gICAgICAgICAgICBkZWJ1Z1N0cmluZyArPSAnUFBTICc7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICghdHJhY2sucHBzKSB7XG4gICAgICAgICAgICB0cmFjay5wcHMgPSBbdW5pdC5kYXRhXTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgOTpcbiAgICAgICAgICBwdXNoID0gdHJ1ZTtcbiAgICAgICAgICBpZihkZWJ1Zykge1xuICAgICAgICAgICAgZGVidWdTdHJpbmcgKz0gJ0FVRCAnO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBwdXNoID0gZmFsc2U7XG4gICAgICAgICAgZGVidWdTdHJpbmcgKz0gJ3Vua25vd24gTkFMICcgKyB1bml0LnR5cGUgKyAnICc7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBpZihwdXNoKSB7XG4gICAgICAgIHVuaXRzMi5wdXNoKHVuaXQpO1xuICAgICAgICBsZW5ndGgrPXVuaXQuZGF0YS5ieXRlTGVuZ3RoO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGlmKGRlYnVnIHx8IGRlYnVnU3RyaW5nLmxlbmd0aCkge1xuICAgICAgbG9nZ2VyLmxvZyhkZWJ1Z1N0cmluZyk7XG4gICAgfVxuICAgIC8vYnVpbGQgc2FtcGxlIGZyb20gUEVTXG4gICAgLy8gQW5uZXggQiB0byBNUDQgY29udmVyc2lvbiB0byBiZSBkb25lXG4gICAgaWYgKHVuaXRzMi5sZW5ndGgpIHtcbiAgICAgIC8vIG9ubHkgcHVzaCBBVkMgc2FtcGxlIGlmIGtleWZyYW1lIGFscmVhZHkgZm91bmQuIGJyb3dzZXJzIGV4cGVjdCBhIGtleWZyYW1lIGF0IGZpcnN0IHRvIHN0YXJ0IGRlY29kaW5nXG4gICAgICBpZiAoa2V5ID09PSB0cnVlIHx8IHRyYWNrLnNwcyApIHtcbiAgICAgICAgYXZjU2FtcGxlID0ge3VuaXRzOiB7IHVuaXRzIDogdW5pdHMyLCBsZW5ndGggOiBsZW5ndGh9LCBwdHM6IHBlcy5wdHMsIGR0czogcGVzLmR0cywga2V5OiBrZXl9O1xuICAgICAgICBzYW1wbGVzLnB1c2goYXZjU2FtcGxlKTtcbiAgICAgICAgdHJhY2subGVuICs9IGxlbmd0aDtcbiAgICAgICAgdHJhY2submJOYWx1ICs9IHVuaXRzMi5sZW5ndGg7XG4gICAgICB9XG4gICAgfVxuICB9XG5cblxuICBfcGFyc2VBVkNOQUx1KGFycmF5KSB7XG4gICAgdmFyIGkgPSAwLCBsZW4gPSBhcnJheS5ieXRlTGVuZ3RoLCB2YWx1ZSwgb3ZlcmZsb3csIHN0YXRlID0gMDtcbiAgICB2YXIgdW5pdHMgPSBbXSwgdW5pdCwgdW5pdFR5cGUsIGxhc3RVbml0U3RhcnQsIGxhc3RVbml0VHlwZTtcbiAgICAvL2xvZ2dlci5sb2coJ1BFUzonICsgSGV4LmhleER1bXAoYXJyYXkpKTtcbiAgICB3aGlsZSAoaSA8IGxlbikge1xuICAgICAgdmFsdWUgPSBhcnJheVtpKytdO1xuICAgICAgLy8gZmluZGluZyAzIG9yIDQtYnl0ZSBzdGFydCBjb2RlcyAoMDAgMDAgMDEgT1IgMDAgMDAgMDAgMDEpXG4gICAgICBzd2l0Y2ggKHN0YXRlKSB7XG4gICAgICAgIGNhc2UgMDpcbiAgICAgICAgICBpZiAodmFsdWUgPT09IDApIHtcbiAgICAgICAgICAgIHN0YXRlID0gMTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgMTpcbiAgICAgICAgICBpZiggdmFsdWUgPT09IDApIHtcbiAgICAgICAgICAgIHN0YXRlID0gMjtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3RhdGUgPSAwO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAyOlxuICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgaWYoIHZhbHVlID09PSAwKSB7XG4gICAgICAgICAgICBzdGF0ZSA9IDM7XG4gICAgICAgICAgfSBlbHNlIGlmICh2YWx1ZSA9PT0gMSkge1xuICAgICAgICAgICAgdW5pdFR5cGUgPSBhcnJheVtpXSAmIDB4MWY7XG4gICAgICAgICAgICAvL2xvZ2dlci5sb2coJ2ZpbmQgTkFMVSBAIG9mZnNldDonICsgaSArICcsdHlwZTonICsgdW5pdFR5cGUpO1xuICAgICAgICAgICAgaWYgKGxhc3RVbml0U3RhcnQpIHtcbiAgICAgICAgICAgICAgdW5pdCA9IHtkYXRhOiBhcnJheS5zdWJhcnJheShsYXN0VW5pdFN0YXJ0LCBpIC0gc3RhdGUgLSAxKSwgdHlwZTogbGFzdFVuaXRUeXBlfTtcbiAgICAgICAgICAgICAgLy9sb2dnZXIubG9nKCdwdXNoaW5nIE5BTFUsIHR5cGUvc2l6ZTonICsgdW5pdC50eXBlICsgJy8nICsgdW5pdC5kYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgICAgICAgICB1bml0cy5wdXNoKHVuaXQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gSWYgTkFMIHVuaXRzIGFyZSBub3Qgc3RhcnRpbmcgcmlnaHQgYXQgdGhlIGJlZ2lubmluZyBvZiB0aGUgUEVTIHBhY2tldCwgcHVzaCBwcmVjZWRpbmcgZGF0YSBpbnRvIHByZXZpb3VzIE5BTCB1bml0LlxuICAgICAgICAgICAgICBvdmVyZmxvdyAgPSBpIC0gc3RhdGUgLSAxO1xuICAgICAgICAgICAgICBpZiAob3ZlcmZsb3cpIHtcbiAgICAgICAgICAgICAgICAvL2xvZ2dlci5sb2coJ2ZpcnN0IE5BTFUgZm91bmQgd2l0aCBvdmVyZmxvdzonICsgb3ZlcmZsb3cpO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9hdmNUcmFjay5zYW1wbGVzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgdmFyIGxhc3RhdmNTYW1wbGUgPSB0aGlzLl9hdmNUcmFjay5zYW1wbGVzW3RoaXMuX2F2Y1RyYWNrLnNhbXBsZXMubGVuZ3RoIC0gMV07XG4gICAgICAgICAgICAgICAgICB2YXIgbGFzdFVuaXQgPSBsYXN0YXZjU2FtcGxlLnVuaXRzLnVuaXRzW2xhc3RhdmNTYW1wbGUudW5pdHMudW5pdHMubGVuZ3RoIC0gMV07XG4gICAgICAgICAgICAgICAgICB2YXIgdG1wID0gbmV3IFVpbnQ4QXJyYXkobGFzdFVuaXQuZGF0YS5ieXRlTGVuZ3RoICsgb3ZlcmZsb3cpO1xuICAgICAgICAgICAgICAgICAgdG1wLnNldChsYXN0VW5pdC5kYXRhLCAwKTtcbiAgICAgICAgICAgICAgICAgIHRtcC5zZXQoYXJyYXkuc3ViYXJyYXkoMCwgb3ZlcmZsb3cpLCBsYXN0VW5pdC5kYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgICAgICAgICAgICAgbGFzdFVuaXQuZGF0YSA9IHRtcDtcbiAgICAgICAgICAgICAgICAgIGxhc3RhdmNTYW1wbGUudW5pdHMubGVuZ3RoICs9IG92ZXJmbG93O1xuICAgICAgICAgICAgICAgICAgdGhpcy5fYXZjVHJhY2subGVuICs9IG92ZXJmbG93O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGFzdFVuaXRTdGFydCA9IGk7XG4gICAgICAgICAgICBsYXN0VW5pdFR5cGUgPSB1bml0VHlwZTtcbiAgICAgICAgICAgIGlmICh1bml0VHlwZSA9PT0gMSB8fCB1bml0VHlwZSA9PT0gNSkge1xuICAgICAgICAgICAgICAvLyBPUFRJICEhISBpZiBJRFIvTkRSIHVuaXQsIGNvbnNpZGVyIGl0IGlzIGxhc3QgTkFMdVxuICAgICAgICAgICAgICBpID0gbGVuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc3RhdGUgPSAwO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzdGF0ZSA9IDA7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAobGFzdFVuaXRTdGFydCkge1xuICAgICAgdW5pdCA9IHtkYXRhOiBhcnJheS5zdWJhcnJheShsYXN0VW5pdFN0YXJ0LCBsZW4pLCB0eXBlOiBsYXN0VW5pdFR5cGV9O1xuICAgICAgdW5pdHMucHVzaCh1bml0KTtcbiAgICAgIC8vbG9nZ2VyLmxvZygncHVzaGluZyBOQUxVLCB0eXBlL3NpemU6JyArIHVuaXQudHlwZSArICcvJyArIHVuaXQuZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICB9XG4gICAgcmV0dXJuIHVuaXRzO1xuICB9XG5cbiAgX3BhcnNlQUFDUEVTKHBlcykge1xuICAgIHZhciB0cmFjayA9IHRoaXMuX2FhY1RyYWNrLCBhYWNTYW1wbGUsIGRhdGEgPSBwZXMuZGF0YSwgY29uZmlnLCBhZHRzRnJhbWVTaXplLCBhZHRzU3RhcnRPZmZzZXQsIGFkdHNIZWFkZXJMZW4sIHN0YW1wLCBuYlNhbXBsZXMsIGxlbjtcbiAgICBpZiAodGhpcy5hYWNPdmVyRmxvdykge1xuICAgICAgdmFyIHRtcCA9IG5ldyBVaW50OEFycmF5KHRoaXMuYWFjT3ZlckZsb3cuYnl0ZUxlbmd0aCArIGRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICB0bXAuc2V0KHRoaXMuYWFjT3ZlckZsb3csIDApO1xuICAgICAgdG1wLnNldChkYXRhLCB0aGlzLmFhY092ZXJGbG93LmJ5dGVMZW5ndGgpO1xuICAgICAgZGF0YSA9IHRtcDtcbiAgICB9XG4gICAgLy8gbG9vayBmb3IgQURUUyBoZWFkZXIgKDB4RkZGeClcbiAgICBmb3IgKGFkdHNTdGFydE9mZnNldCA9IDAsIGxlbiA9IGRhdGEubGVuZ3RoOyBhZHRzU3RhcnRPZmZzZXQgPCBsZW4gLSAxOyBhZHRzU3RhcnRPZmZzZXQrKykge1xuICAgICAgaWYgKChkYXRhW2FkdHNTdGFydE9mZnNldF0gPT09IDB4ZmYpICYmIChkYXRhW2FkdHNTdGFydE9mZnNldCsxXSAmIDB4ZjApID09PSAweGYwKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBpZiBBRFRTIGhlYWRlciBkb2VzIG5vdCBzdGFydCBzdHJhaWdodCBmcm9tIHRoZSBiZWdpbm5pbmcgb2YgdGhlIFBFUyBwYXlsb2FkLCByYWlzZSBhbiBlcnJvclxuICAgIGlmIChhZHRzU3RhcnRPZmZzZXQpIHtcbiAgICAgIHZhciByZWFzb24sIGZhdGFsO1xuICAgICAgaWYgKGFkdHNTdGFydE9mZnNldCA8IGxlbiAtIDEpIHtcbiAgICAgICAgcmVhc29uID0gYEFBQyBQRVMgZGlkIG5vdCBzdGFydCB3aXRoIEFEVFMgaGVhZGVyLG9mZnNldDoke2FkdHNTdGFydE9mZnNldH1gO1xuICAgICAgICBmYXRhbCA9IGZhbHNlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVhc29uID0gJ25vIEFEVFMgaGVhZGVyIGZvdW5kIGluIEFBQyBQRVMnO1xuICAgICAgICBmYXRhbCA9IHRydWU7XG4gICAgICB9XG4gICAgICB0aGlzLm9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuRlJBR19QQVJTSU5HX0VSUk9SLCBmYXRhbDogZmF0YWwsIHJlYXNvbjogcmVhc29ufSk7XG4gICAgICBpZiAoZmF0YWwpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIXRyYWNrLmF1ZGlvc2FtcGxlcmF0ZSkge1xuICAgICAgY29uZmlnID0gdGhpcy5fQURUU3RvQXVkaW9Db25maWcoZGF0YSwgYWR0c1N0YXJ0T2Zmc2V0LCB0aGlzLmF1ZGlvQ29kZWMpO1xuICAgICAgdHJhY2suY29uZmlnID0gY29uZmlnLmNvbmZpZztcbiAgICAgIHRyYWNrLmF1ZGlvc2FtcGxlcmF0ZSA9IGNvbmZpZy5zYW1wbGVyYXRlO1xuICAgICAgdHJhY2suY2hhbm5lbENvdW50ID0gY29uZmlnLmNoYW5uZWxDb3VudDtcbiAgICAgIHRyYWNrLmNvZGVjID0gY29uZmlnLmNvZGVjO1xuICAgICAgdHJhY2sudGltZXNjYWxlID0gdGhpcy5yZW11eGVyLnRpbWVzY2FsZTtcbiAgICAgIHRyYWNrLmR1cmF0aW9uID0gdGhpcy5yZW11eGVyLnRpbWVzY2FsZSAqIHRoaXMuX2R1cmF0aW9uO1xuICAgICAgbG9nZ2VyLmxvZyhgcGFyc2VkIGNvZGVjOiR7dHJhY2suY29kZWN9LHJhdGU6JHtjb25maWcuc2FtcGxlcmF0ZX0sbmIgY2hhbm5lbDoke2NvbmZpZy5jaGFubmVsQ291bnR9YCk7XG4gICAgfVxuICAgIG5iU2FtcGxlcyA9IDA7XG4gICAgd2hpbGUgKChhZHRzU3RhcnRPZmZzZXQgKyA1KSA8IGxlbikge1xuICAgICAgLy8gcmV0cmlldmUgZnJhbWUgc2l6ZVxuICAgICAgYWR0c0ZyYW1lU2l6ZSA9ICgoZGF0YVthZHRzU3RhcnRPZmZzZXQgKyAzXSAmIDB4MDMpIDw8IDExKTtcbiAgICAgIC8vIGJ5dGUgNFxuICAgICAgYWR0c0ZyYW1lU2l6ZSB8PSAoZGF0YVthZHRzU3RhcnRPZmZzZXQgKyA0XSA8PCAzKTtcbiAgICAgIC8vIGJ5dGUgNVxuICAgICAgYWR0c0ZyYW1lU2l6ZSB8PSAoKGRhdGFbYWR0c1N0YXJ0T2Zmc2V0ICsgNV0gJiAweEUwKSA+Pj4gNSk7XG4gICAgICBhZHRzSGVhZGVyTGVuID0gKCEhKGRhdGFbYWR0c1N0YXJ0T2Zmc2V0ICsgMV0gJiAweDAxKSA/IDcgOiA5KTtcbiAgICAgIGFkdHNGcmFtZVNpemUgLT0gYWR0c0hlYWRlckxlbjtcbiAgICAgIHN0YW1wID0gTWF0aC5yb3VuZChwZXMucHRzICsgbmJTYW1wbGVzICogMTAyNCAqIHRoaXMuUEVTX1RJTUVTQ0FMRSAvIHRyYWNrLmF1ZGlvc2FtcGxlcmF0ZSk7XG4gICAgICAvL3N0YW1wID0gcGVzLnB0cztcbiAgICAgIC8vY29uc29sZS5sb2coJ0FBQyBmcmFtZSwgb2Zmc2V0L2xlbmd0aC9wdHM6JyArIChhZHRzU3RhcnRPZmZzZXQrNykgKyAnLycgKyBhZHRzRnJhbWVTaXplICsgJy8nICsgc3RhbXAudG9GaXhlZCgwKSk7XG4gICAgICBpZiAoKGFkdHNGcmFtZVNpemUgPiAwKSAmJiAoKGFkdHNTdGFydE9mZnNldCArIGFkdHNIZWFkZXJMZW4gKyBhZHRzRnJhbWVTaXplKSA8PSBsZW4pKSB7XG4gICAgICAgIGFhY1NhbXBsZSA9IHt1bml0OiBkYXRhLnN1YmFycmF5KGFkdHNTdGFydE9mZnNldCArIGFkdHNIZWFkZXJMZW4sIGFkdHNTdGFydE9mZnNldCArIGFkdHNIZWFkZXJMZW4gKyBhZHRzRnJhbWVTaXplKSwgcHRzOiBzdGFtcCwgZHRzOiBzdGFtcH07XG4gICAgICAgIHRoaXMuX2FhY1RyYWNrLnNhbXBsZXMucHVzaChhYWNTYW1wbGUpO1xuICAgICAgICB0aGlzLl9hYWNUcmFjay5sZW4gKz0gYWR0c0ZyYW1lU2l6ZTtcbiAgICAgICAgYWR0c1N0YXJ0T2Zmc2V0ICs9IGFkdHNGcmFtZVNpemUgKyBhZHRzSGVhZGVyTGVuO1xuICAgICAgICBuYlNhbXBsZXMrKztcbiAgICAgICAgLy8gbG9vayBmb3IgQURUUyBoZWFkZXIgKDB4RkZGeClcbiAgICAgICAgZm9yICggOyBhZHRzU3RhcnRPZmZzZXQgPCAobGVuIC0gMSk7IGFkdHNTdGFydE9mZnNldCsrKSB7XG4gICAgICAgICAgaWYgKChkYXRhW2FkdHNTdGFydE9mZnNldF0gPT09IDB4ZmYpICYmICgoZGF0YVthZHRzU3RhcnRPZmZzZXQgKyAxXSAmIDB4ZjApID09PSAweGYwKSkge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGFkdHNTdGFydE9mZnNldCA8IGxlbikge1xuICAgICAgdGhpcy5hYWNPdmVyRmxvdyA9IGRhdGEuc3ViYXJyYXkoYWR0c1N0YXJ0T2Zmc2V0LCBsZW4pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmFhY092ZXJGbG93ID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICBfQURUU3RvQXVkaW9Db25maWcoZGF0YSwgb2Zmc2V0LCBhdWRpb0NvZGVjKSB7XG4gICAgdmFyIGFkdHNPYmplY3RUeXBlLCAvLyA6aW50XG4gICAgICAgIGFkdHNTYW1wbGVpbmdJbmRleCwgLy8gOmludFxuICAgICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXgsIC8vIDppbnRcbiAgICAgICAgYWR0c0NoYW5lbENvbmZpZywgLy8gOmludFxuICAgICAgICBjb25maWcsXG4gICAgICAgIHVzZXJBZ2VudCA9IG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKSxcbiAgICAgICAgYWR0c1NhbXBsZWluZ1JhdGVzID0gW1xuICAgICAgICAgICAgOTYwMDAsIDg4MjAwLFxuICAgICAgICAgICAgNjQwMDAsIDQ4MDAwLFxuICAgICAgICAgICAgNDQxMDAsIDMyMDAwLFxuICAgICAgICAgICAgMjQwMDAsIDIyMDUwLFxuICAgICAgICAgICAgMTYwMDAsIDEyMDAwLFxuICAgICAgICAgICAgMTEwMjUsIDgwMDAsXG4gICAgICAgICAgICA3MzUwXTtcbiAgICAvLyBieXRlIDJcbiAgICBhZHRzT2JqZWN0VHlwZSA9ICgoZGF0YVtvZmZzZXQgKyAyXSAmIDB4QzApID4+PiA2KSArIDE7XG4gICAgYWR0c1NhbXBsZWluZ0luZGV4ID0gKChkYXRhW29mZnNldCArIDJdICYgMHgzQykgPj4+IDIpO1xuICAgIGlmKGFkdHNTYW1wbGVpbmdJbmRleCA+IGFkdHNTYW1wbGVpbmdSYXRlcy5sZW5ndGgtMSkge1xuICAgICAgdGhpcy5vYnNlcnZlci50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkZSQUdfUEFSU0lOR19FUlJPUiwgZmF0YWw6IHRydWUsIHJlYXNvbjogYGludmFsaWQgQURUUyBzYW1wbGluZyBpbmRleDoke2FkdHNTYW1wbGVpbmdJbmRleH1gfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGFkdHNDaGFuZWxDb25maWcgPSAoKGRhdGFbb2Zmc2V0ICsgMl0gJiAweDAxKSA8PCAyKTtcbiAgICAvLyBieXRlIDNcbiAgICBhZHRzQ2hhbmVsQ29uZmlnIHw9ICgoZGF0YVtvZmZzZXQgKyAzXSAmIDB4QzApID4+PiA2KTtcbiAgICBsb2dnZXIubG9nKGBtYW5pZmVzdCBjb2RlYzoke2F1ZGlvQ29kZWN9LEFEVFMgZGF0YTp0eXBlOiR7YWR0c09iamVjdFR5cGV9LHNhbXBsZWluZ0luZGV4OiR7YWR0c1NhbXBsZWluZ0luZGV4fVske2FkdHNTYW1wbGVpbmdSYXRlc1thZHRzU2FtcGxlaW5nSW5kZXhdfWtIel0sY2hhbm5lbENvbmZpZzoke2FkdHNDaGFuZWxDb25maWd9YCk7XG4gICAgLy8gZmlyZWZveDogZnJlcSBsZXNzIHRoYW4gMjRrSHogPSBBQUMgU0JSIChIRS1BQUMpXG4gICAgaWYgKHVzZXJBZ2VudC5pbmRleE9mKCdmaXJlZm94JykgIT09IC0xKSB7XG4gICAgICBpZiAoYWR0c1NhbXBsZWluZ0luZGV4ID49IDYpIHtcbiAgICAgICAgYWR0c09iamVjdFR5cGUgPSA1O1xuICAgICAgICBjb25maWcgPSBuZXcgQXJyYXkoNCk7XG4gICAgICAgIC8vIEhFLUFBQyB1c2VzIFNCUiAoU3BlY3RyYWwgQmFuZCBSZXBsaWNhdGlvbikgLCBoaWdoIGZyZXF1ZW5jaWVzIGFyZSBjb25zdHJ1Y3RlZCBmcm9tIGxvdyBmcmVxdWVuY2llc1xuICAgICAgICAvLyB0aGVyZSBpcyBhIGZhY3RvciAyIGJldHdlZW4gZnJhbWUgc2FtcGxlIHJhdGUgYW5kIG91dHB1dCBzYW1wbGUgcmF0ZVxuICAgICAgICAvLyBtdWx0aXBseSBmcmVxdWVuY3kgYnkgMiAoc2VlIHRhYmxlIGJlbG93LCBlcXVpdmFsZW50IHRvIHN1YnN0cmFjdCAzKVxuICAgICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggPSBhZHRzU2FtcGxlaW5nSW5kZXggLSAzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYWR0c09iamVjdFR5cGUgPSAyO1xuICAgICAgICBjb25maWcgPSBuZXcgQXJyYXkoMik7XG4gICAgICAgIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCA9IGFkdHNTYW1wbGVpbmdJbmRleDtcbiAgICAgIH1cbiAgICAgIC8vIEFuZHJvaWQgOiBhbHdheXMgdXNlIEFBQ1xuICAgIH0gZWxzZSBpZiAodXNlckFnZW50LmluZGV4T2YoJ2FuZHJvaWQnKSAhPT0gLTEpIHtcbiAgICAgIGFkdHNPYmplY3RUeXBlID0gMjtcbiAgICAgIGNvbmZpZyA9IG5ldyBBcnJheSgyKTtcbiAgICAgIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCA9IGFkdHNTYW1wbGVpbmdJbmRleDtcbiAgICB9IGVsc2Uge1xuICAgICAgLyogIGZvciBvdGhlciBicm93c2VycyAoY2hyb21lIC4uLilcbiAgICAgICAgICBhbHdheXMgZm9yY2UgYXVkaW8gdHlwZSB0byBiZSBIRS1BQUMgU0JSLCBhcyBzb21lIGJyb3dzZXJzIGRvIG5vdCBzdXBwb3J0IGF1ZGlvIGNvZGVjIHN3aXRjaCBwcm9wZXJseSAobGlrZSBDaHJvbWUgLi4uKVxuICAgICAgKi9cbiAgICAgIGFkdHNPYmplY3RUeXBlID0gNTtcbiAgICAgIGNvbmZpZyA9IG5ldyBBcnJheSg0KTtcbiAgICAgIC8vIGlmIChtYW5pZmVzdCBjb2RlYyBpcyBIRS1BQUMgb3IgSEUtQUFDdjIpIE9SIChtYW5pZmVzdCBjb2RlYyBub3Qgc3BlY2lmaWVkIEFORCBmcmVxdWVuY3kgbGVzcyB0aGFuIDI0a0h6KVxuICAgICAgaWYgKChhdWRpb0NvZGVjICYmICgoYXVkaW9Db2RlYy5pbmRleE9mKCdtcDRhLjQwLjI5JykgIT09IC0xKSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAoYXVkaW9Db2RlYy5pbmRleE9mKCdtcDRhLjQwLjUnKSAhPT0gLTEpKSkgfHxcbiAgICAgICAgICAoIWF1ZGlvQ29kZWMgJiYgYWR0c1NhbXBsZWluZ0luZGV4ID49IDYpKSB7XG4gICAgICAgIC8vIEhFLUFBQyB1c2VzIFNCUiAoU3BlY3RyYWwgQmFuZCBSZXBsaWNhdGlvbikgLCBoaWdoIGZyZXF1ZW5jaWVzIGFyZSBjb25zdHJ1Y3RlZCBmcm9tIGxvdyBmcmVxdWVuY2llc1xuICAgICAgICAvLyB0aGVyZSBpcyBhIGZhY3RvciAyIGJldHdlZW4gZnJhbWUgc2FtcGxlIHJhdGUgYW5kIG91dHB1dCBzYW1wbGUgcmF0ZVxuICAgICAgICAvLyBtdWx0aXBseSBmcmVxdWVuY3kgYnkgMiAoc2VlIHRhYmxlIGJlbG93LCBlcXVpdmFsZW50IHRvIHN1YnN0cmFjdCAzKVxuICAgICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggPSBhZHRzU2FtcGxlaW5nSW5kZXggLSAzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gaWYgKG1hbmlmZXN0IGNvZGVjIGlzIEFBQykgQU5EIChmcmVxdWVuY3kgbGVzcyB0aGFuIDI0a0h6IE9SIG5iIGNoYW5uZWwgaXMgMSlcbiAgICAgICAgaWYgKGF1ZGlvQ29kZWMgJiYgYXVkaW9Db2RlYy5pbmRleE9mKCdtcDRhLjQwLjInKSAhPT0gLTEgJiYgKGFkdHNTYW1wbGVpbmdJbmRleCA+PSA2IHx8IGFkdHNDaGFuZWxDb25maWcgPT09IDEpKSB7XG4gICAgICAgICAgYWR0c09iamVjdFR5cGUgPSAyO1xuICAgICAgICAgIGNvbmZpZyA9IG5ldyBBcnJheSgyKTtcbiAgICAgICAgfVxuICAgICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggPSBhZHRzU2FtcGxlaW5nSW5kZXg7XG4gICAgICB9XG4gICAgfVxuICAgIC8qIHJlZmVyIHRvIGh0dHA6Ly93aWtpLm11bHRpbWVkaWEuY3gvaW5kZXgucGhwP3RpdGxlPU1QRUctNF9BdWRpbyNBdWRpb19TcGVjaWZpY19Db25maWdcbiAgICAgICAgSVNPIDE0NDk2LTMgKEFBQykucGRmIC0gVGFibGUgMS4xMyDigJQgU3ludGF4IG9mIEF1ZGlvU3BlY2lmaWNDb25maWcoKVxuICAgICAgQXVkaW8gUHJvZmlsZSAvIEF1ZGlvIE9iamVjdCBUeXBlXG4gICAgICAwOiBOdWxsXG4gICAgICAxOiBBQUMgTWFpblxuICAgICAgMjogQUFDIExDIChMb3cgQ29tcGxleGl0eSlcbiAgICAgIDM6IEFBQyBTU1IgKFNjYWxhYmxlIFNhbXBsZSBSYXRlKVxuICAgICAgNDogQUFDIExUUCAoTG9uZyBUZXJtIFByZWRpY3Rpb24pXG4gICAgICA1OiBTQlIgKFNwZWN0cmFsIEJhbmQgUmVwbGljYXRpb24pXG4gICAgICA2OiBBQUMgU2NhbGFibGVcbiAgICAgc2FtcGxpbmcgZnJlcVxuICAgICAgMDogOTYwMDAgSHpcbiAgICAgIDE6IDg4MjAwIEh6XG4gICAgICAyOiA2NDAwMCBIelxuICAgICAgMzogNDgwMDAgSHpcbiAgICAgIDQ6IDQ0MTAwIEh6XG4gICAgICA1OiAzMjAwMCBIelxuICAgICAgNjogMjQwMDAgSHpcbiAgICAgIDc6IDIyMDUwIEh6XG4gICAgICA4OiAxNjAwMCBIelxuICAgICAgOTogMTIwMDAgSHpcbiAgICAgIDEwOiAxMTAyNSBIelxuICAgICAgMTE6IDgwMDAgSHpcbiAgICAgIDEyOiA3MzUwIEh6XG4gICAgICAxMzogUmVzZXJ2ZWRcbiAgICAgIDE0OiBSZXNlcnZlZFxuICAgICAgMTU6IGZyZXF1ZW5jeSBpcyB3cml0dGVuIGV4cGxpY3RseVxuICAgICAgQ2hhbm5lbCBDb25maWd1cmF0aW9uc1xuICAgICAgVGhlc2UgYXJlIHRoZSBjaGFubmVsIGNvbmZpZ3VyYXRpb25zOlxuICAgICAgMDogRGVmaW5lZCBpbiBBT1QgU3BlY2lmYyBDb25maWdcbiAgICAgIDE6IDEgY2hhbm5lbDogZnJvbnQtY2VudGVyXG4gICAgICAyOiAyIGNoYW5uZWxzOiBmcm9udC1sZWZ0LCBmcm9udC1yaWdodFxuICAgICovXG4gICAgLy8gYXVkaW9PYmplY3RUeXBlID0gcHJvZmlsZSA9PiBwcm9maWxlLCB0aGUgTVBFRy00IEF1ZGlvIE9iamVjdCBUeXBlIG1pbnVzIDFcbiAgICBjb25maWdbMF0gPSBhZHRzT2JqZWN0VHlwZSA8PCAzO1xuICAgIC8vIHNhbXBsaW5nRnJlcXVlbmN5SW5kZXhcbiAgICBjb25maWdbMF0gfD0gKGFkdHNTYW1wbGVpbmdJbmRleCAmIDB4MEUpID4+IDE7XG4gICAgY29uZmlnWzFdIHw9IChhZHRzU2FtcGxlaW5nSW5kZXggJiAweDAxKSA8PCA3O1xuICAgIC8vIGNoYW5uZWxDb25maWd1cmF0aW9uXG4gICAgY29uZmlnWzFdIHw9IGFkdHNDaGFuZWxDb25maWcgPDwgMztcbiAgICBpZiAoYWR0c09iamVjdFR5cGUgPT09IDUpIHtcbiAgICAgIC8vIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleFxuICAgICAgY29uZmlnWzFdIHw9IChhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggJiAweDBFKSA+PiAxO1xuICAgICAgY29uZmlnWzJdID0gKGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCAmIDB4MDEpIDw8IDc7XG4gICAgICAvLyBhZHRzT2JqZWN0VHlwZSAoZm9yY2UgdG8gMiwgY2hyb21lIGlzIGNoZWNraW5nIHRoYXQgb2JqZWN0IHR5cGUgaXMgbGVzcyB0aGFuIDUgPz8/XG4gICAgICAvLyAgICBodHRwczovL2Nocm9taXVtLmdvb2dsZXNvdXJjZS5jb20vY2hyb21pdW0vc3JjLmdpdC8rL21hc3Rlci9tZWRpYS9mb3JtYXRzL21wNC9hYWMuY2NcbiAgICAgIGNvbmZpZ1syXSB8PSAyIDw8IDI7XG4gICAgICBjb25maWdbM10gPSAwO1xuICAgIH1cbiAgICByZXR1cm4ge2NvbmZpZzogY29uZmlnLCBzYW1wbGVyYXRlOiBhZHRzU2FtcGxlaW5nUmF0ZXNbYWR0c1NhbXBsZWluZ0luZGV4XSwgY2hhbm5lbENvdW50OiBhZHRzQ2hhbmVsQ29uZmlnLCBjb2RlYzogKCdtcDRhLjQwLicgKyBhZHRzT2JqZWN0VHlwZSl9O1xuICB9XG5cbiAgX3BhcnNlSUQzUEVTKHBlcykge1xuICAgIHRoaXMuX2lkM1RyYWNrLnNhbXBsZXMucHVzaChwZXMpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFRTRGVtdXhlcjtcblxuIiwiZXhwb3J0IGNvbnN0IEVycm9yVHlwZXMgPSB7XG4gIC8vIElkZW50aWZpZXIgZm9yIGEgbmV0d29yayBlcnJvciAobG9hZGluZyBlcnJvciAvIHRpbWVvdXQgLi4uKVxuICBORVRXT1JLX0VSUk9SOiAnaGxzTmV0d29ya0Vycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBtZWRpYSBFcnJvciAodmlkZW8vcGFyc2luZy9tZWRpYXNvdXJjZSBlcnJvcilcbiAgTUVESUFfRVJST1I6ICdobHNNZWRpYUVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYWxsIG90aGVyIGVycm9yc1xuICBPVEhFUl9FUlJPUjogJ2hsc090aGVyRXJyb3InXG59O1xuXG5leHBvcnQgY29uc3QgRXJyb3JEZXRhaWxzID0ge1xuICAvLyBJZGVudGlmaWVyIGZvciBhIG1hbmlmZXN0IGxvYWQgZXJyb3IgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBNQU5JRkVTVF9MT0FEX0VSUk9SOiAnbWFuaWZlc3RMb2FkRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIG1hbmlmZXN0IGxvYWQgdGltZW91dCAtIGRhdGE6IHsgdXJsIDogZmF1bHR5IFVSTCwgcmVzcG9uc2UgOiBYSFIgcmVzcG9uc2V9XG4gIE1BTklGRVNUX0xPQURfVElNRU9VVDogJ21hbmlmZXN0TG9hZFRpbWVPdXQnLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIG1hbmlmZXN0IHBhcnNpbmcgZXJyb3IgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlYXNvbiA6IGVycm9yIHJlYXNvbn1cbiAgTUFOSUZFU1RfUEFSU0lOR19FUlJPUjogJ21hbmlmZXN0UGFyc2luZ0Vycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgcGxheWxpc3QgbG9hZCBlcnJvciAtIGRhdGE6IHsgdXJsIDogZmF1bHR5IFVSTCwgcmVzcG9uc2UgOiBYSFIgcmVzcG9uc2V9XG4gIExFVkVMX0xPQURfRVJST1I6ICdsZXZlbExvYWRFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIHBsYXlsaXN0IGxvYWQgdGltZW91dCAtIGRhdGE6IHsgdXJsIDogZmF1bHR5IFVSTCwgcmVzcG9uc2UgOiBYSFIgcmVzcG9uc2V9XG4gIExFVkVMX0xPQURfVElNRU9VVDogJ2xldmVsTG9hZFRpbWVPdXQnLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIGxldmVsIHN3aXRjaCBlcnJvciAtIGRhdGE6IHsgbGV2ZWwgOiBmYXVsdHkgbGV2ZWwgSWQsIGV2ZW50IDogZXJyb3IgZGVzY3JpcHRpb259XG4gIExFVkVMX1NXSVRDSF9FUlJPUjogJ2xldmVsU3dpdGNoRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBmcmFnbWVudCBsb2FkIGVycm9yIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0LCByZXNwb25zZSA6IFhIUiByZXNwb25zZX1cbiAgRlJBR19MT0FEX0VSUk9SOiAnZnJhZ0xvYWRFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGZyYWdtZW50IGxvb3AgbG9hZGluZyBlcnJvciAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdH1cbiAgRlJBR19MT09QX0xPQURJTkdfRVJST1I6ICdmcmFnTG9vcExvYWRpbmdFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGZyYWdtZW50IGxvYWQgdGltZW91dCBlcnJvciAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdH1cbiAgRlJBR19MT0FEX1RJTUVPVVQ6ICdmcmFnTG9hZFRpbWVPdXQnLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIGZyYWdtZW50IGRlY3J5cHRpb24gZXJyb3IgZXZlbnQgLSBkYXRhOiBwYXJzaW5nIGVycm9yIGRlc2NyaXB0aW9uXG4gIEZSQUdfREVDUllQVF9FUlJPUjogJ2ZyYWdEZWNyeXB0RXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIGZyYWdtZW50IHBhcnNpbmcgZXJyb3IgZXZlbnQgLSBkYXRhOiBwYXJzaW5nIGVycm9yIGRlc2NyaXB0aW9uXG4gIEZSQUdfUEFSU0lOR19FUlJPUjogJ2ZyYWdQYXJzaW5nRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBkZWNyeXB0IGtleSBsb2FkIGVycm9yIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0LCByZXNwb25zZSA6IFhIUiByZXNwb25zZX1cbiAgS0VZX0xPQURfRVJST1I6ICdrZXlMb2FkRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBkZWNyeXB0IGtleSBsb2FkIHRpbWVvdXQgZXJyb3IgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3R9XG4gIEtFWV9MT0FEX1RJTUVPVVQ6ICdrZXlMb2FkVGltZU91dCcsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgYnVmZmVyIGFwcGVuZCBlcnJvciAtIGRhdGE6IGFwcGVuZCBlcnJvciBkZXNjcmlwdGlvblxuICBCVUZGRVJfQVBQRU5EX0VSUk9SOiAnYnVmZmVyQXBwZW5kRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIGJ1ZmZlciBhcHBlbmRpbmcgZXJyb3IgZXZlbnQgLSBkYXRhOiBhcHBlbmRpbmcgZXJyb3IgZGVzY3JpcHRpb25cbiAgQlVGRkVSX0FQUEVORElOR19FUlJPUjogJ2J1ZmZlckFwcGVuZGluZ0Vycm9yJ1xufTtcbiIsImV4cG9ydCBkZWZhdWx0IHtcbiAgLy8gZmlyZWQgYmVmb3JlIE1lZGlhU291cmNlIGlzIGF0dGFjaGluZyB0byBtZWRpYSBlbGVtZW50IC0gZGF0YTogeyBtZWRpYSB9XG4gIE1FRElBX0FUVEFDSElORzogJ2hsc01lZGlhQXR0YWNoaW5nJyxcbiAgLy8gZmlyZWQgd2hlbiBNZWRpYVNvdXJjZSBoYXMgYmVlbiBzdWNjZXNmdWxseSBhdHRhY2hlZCB0byBtZWRpYSBlbGVtZW50IC0gZGF0YTogeyB9XG4gIE1FRElBX0FUVEFDSEVEOiAnaGxzTWVkaWFBdHRhY2hlZCcsXG4gIC8vIGZpcmVkIGJlZm9yZSBkZXRhY2hpbmcgTWVkaWFTb3VyY2UgZnJvbSBtZWRpYSBlbGVtZW50IC0gZGF0YTogeyB9XG4gIE1FRElBX0RFVEFDSElORzogJ2hsc01lZGlhRGV0YWNoaW5nJyxcbiAgLy8gZmlyZWQgd2hlbiBNZWRpYVNvdXJjZSBoYXMgYmVlbiBkZXRhY2hlZCBmcm9tIG1lZGlhIGVsZW1lbnQgLSBkYXRhOiB7IH1cbiAgTUVESUFfREVUQUNIRUQ6ICdobHNNZWRpYURldGFjaGVkJyxcbiAgLy8gZmlyZWQgdG8gc2lnbmFsIHRoYXQgYSBtYW5pZmVzdCBsb2FkaW5nIHN0YXJ0cyAtIGRhdGE6IHsgdXJsIDogbWFuaWZlc3RVUkx9XG4gIE1BTklGRVNUX0xPQURJTkc6ICdobHNNYW5pZmVzdExvYWRpbmcnLFxuICAvLyBmaXJlZCBhZnRlciBtYW5pZmVzdCBoYXMgYmVlbiBsb2FkZWQgLSBkYXRhOiB7IGxldmVscyA6IFthdmFpbGFibGUgcXVhbGl0eSBsZXZlbHNdICwgdXJsIDogbWFuaWZlc3RVUkwsIHN0YXRzIDogeyB0cmVxdWVzdCwgdGZpcnN0LCB0bG9hZCwgbXRpbWV9fVxuICBNQU5JRkVTVF9MT0FERUQ6ICdobHNNYW5pZmVzdExvYWRlZCcsXG4gIC8vIGZpcmVkIGFmdGVyIG1hbmlmZXN0IGhhcyBiZWVuIHBhcnNlZCAtIGRhdGE6IHsgbGV2ZWxzIDogW2F2YWlsYWJsZSBxdWFsaXR5IGxldmVsc10gLCBmaXJzdExldmVsIDogaW5kZXggb2YgZmlyc3QgcXVhbGl0eSBsZXZlbCBhcHBlYXJpbmcgaW4gTWFuaWZlc3R9XG4gIE1BTklGRVNUX1BBUlNFRDogJ2hsc01hbmlmZXN0UGFyc2VkJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGxldmVsIHBsYXlsaXN0IGxvYWRpbmcgc3RhcnRzIC0gZGF0YTogeyB1cmwgOiBsZXZlbCBVUkwgIGxldmVsIDogaWQgb2YgbGV2ZWwgYmVpbmcgbG9hZGVkfVxuICBMRVZFTF9MT0FESU5HOiAnaGxzTGV2ZWxMb2FkaW5nJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGxldmVsIHBsYXlsaXN0IGxvYWRpbmcgZmluaXNoZXMgLSBkYXRhOiB7IGRldGFpbHMgOiBsZXZlbERldGFpbHMgb2JqZWN0LCBsZXZlbCA6IGlkIG9mIGxvYWRlZCBsZXZlbCwgc3RhdHMgOiB7IHRyZXF1ZXN0LCB0Zmlyc3QsIHRsb2FkLCBtdGltZX0gfVxuICBMRVZFTF9MT0FERUQ6ICdobHNMZXZlbExvYWRlZCcsXG4gIC8vIGZpcmVkIHdoZW4gYSBsZXZlbCdzIGRldGFpbHMgaGF2ZSBiZWVuIHVwZGF0ZWQgYmFzZWQgb24gcHJldmlvdXMgZGV0YWlscywgYWZ0ZXIgaXQgaGFzIGJlZW4gbG9hZGVkLiAtIGRhdGE6IHsgZGV0YWlscyA6IGxldmVsRGV0YWlscyBvYmplY3QsIGxldmVsIDogaWQgb2YgdXBkYXRlZCBsZXZlbCB9XG4gIExFVkVMX1VQREFURUQ6ICdobHNMZXZlbFVwZGF0ZWQnLFxuICAvLyBmaXJlZCB3aGVuIGEgbGV2ZWwncyBQVFMgaW5mb3JtYXRpb24gaGFzIGJlZW4gdXBkYXRlZCBhZnRlciBwYXJzaW5nIGEgZnJhZ21lbnQgLSBkYXRhOiB7IGRldGFpbHMgOiBsZXZlbERldGFpbHMgb2JqZWN0LCBsZXZlbCA6IGlkIG9mIHVwZGF0ZWQgbGV2ZWwsIGRyaWZ0OiBQVFMgZHJpZnQgb2JzZXJ2ZWQgd2hlbiBwYXJzaW5nIGxhc3QgZnJhZ21lbnQgfVxuICBMRVZFTF9QVFNfVVBEQVRFRDogJ2hsc1BUU1VwZGF0ZWQnLFxuICAvLyBmaXJlZCB3aGVuIGEgbGV2ZWwgc3dpdGNoIGlzIHJlcXVlc3RlZCAtIGRhdGE6IHsgbGV2ZWwgOiBpZCBvZiBuZXcgbGV2ZWwgfVxuICBMRVZFTF9TV0lUQ0g6ICdobHNMZXZlbFN3aXRjaCcsXG4gIC8vIGZpcmVkIHdoZW4gYSBmcmFnbWVudCBsb2FkaW5nIHN0YXJ0cyAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdH1cbiAgRlJBR19MT0FESU5HOiAnaGxzRnJhZ0xvYWRpbmcnLFxuICAvLyBmaXJlZCB3aGVuIGEgZnJhZ21lbnQgbG9hZGluZyBpcyBwcm9ncmVzc2luZyAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdCwgeyB0cmVxdWVzdCwgdGZpcnN0LCBsb2FkZWR9fVxuICBGUkFHX0xPQURfUFJPR1JFU1M6ICdobHNGcmFnTG9hZFByb2dyZXNzJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgZnJhZ21lbnQgbG9hZCBhYm9ydGluZyBmb3IgZW1lcmdlbmN5IHN3aXRjaCBkb3duIC0gZGF0YToge2ZyYWcgOiBmcmFnbWVudCBvYmplY3R9XG4gIEZSQUdfTE9BRF9FTUVSR0VOQ1lfQUJPUlRFRDogJ2hsc0ZyYWdMb2FkRW1lcmdlbmN5QWJvcnRlZCcsXG4gIC8vIGZpcmVkIHdoZW4gYSBmcmFnbWVudCBsb2FkaW5nIGlzIGNvbXBsZXRlZCAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdCwgcGF5bG9hZCA6IGZyYWdtZW50IHBheWxvYWQsIHN0YXRzIDogeyB0cmVxdWVzdCwgdGZpcnN0LCB0bG9hZCwgbGVuZ3RofX1cbiAgRlJBR19MT0FERUQ6ICdobHNGcmFnTG9hZGVkJyxcbiAgLy8gZmlyZWQgd2hlbiBJbml0IFNlZ21lbnQgaGFzIGJlZW4gZXh0cmFjdGVkIGZyb20gZnJhZ21lbnQgLSBkYXRhOiB7IG1vb3YgOiBtb292IE1QNCBib3gsIGNvZGVjcyA6IGNvZGVjcyBmb3VuZCB3aGlsZSBwYXJzaW5nIGZyYWdtZW50fVxuICBGUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5UOiAnaGxzRnJhZ1BhcnNpbmdJbml0U2VnbWVudCcsXG4gIC8vIGZpcmVkIHdoZW4gcGFyc2luZyBpZDMgaXMgY29tcGxldGVkIC0gZGF0YTogeyBzYW1wbGVzIDogWyBpZDMgc2FtcGxlcyBwZXMgXSB9XG4gIEZSQUdfUEFSU0lOR19NRVRBREFUQTogJ2hsc0ZyYVBhcnNpbmdNZXRhZGF0YScsXG4gIC8vIGZpcmVkIHdoZW4gbW9vZi9tZGF0IGhhdmUgYmVlbiBleHRyYWN0ZWQgZnJvbSBmcmFnbWVudCAtIGRhdGE6IHsgbW9vZiA6IG1vb2YgTVA0IGJveCwgbWRhdCA6IG1kYXQgTVA0IGJveH1cbiAgRlJBR19QQVJTSU5HX0RBVEE6ICdobHNGcmFnUGFyc2luZ0RhdGEnLFxuICAvLyBmaXJlZCB3aGVuIGZyYWdtZW50IHBhcnNpbmcgaXMgY29tcGxldGVkIC0gZGF0YTogdW5kZWZpbmVkXG4gIEZSQUdfUEFSU0VEOiAnaGxzRnJhZ1BhcnNlZCcsXG4gIC8vIGZpcmVkIHdoZW4gZnJhZ21lbnQgcmVtdXhlZCBNUDQgYm94ZXMgaGF2ZSBhbGwgYmVlbiBhcHBlbmRlZCBpbnRvIFNvdXJjZUJ1ZmZlciAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdCwgc3RhdHMgOiB7IHRyZXF1ZXN0LCB0Zmlyc3QsIHRsb2FkLCB0cGFyc2VkLCB0YnVmZmVyZWQsIGxlbmd0aH0gfVxuICBGUkFHX0JVRkZFUkVEOiAnaGxzRnJhZ0J1ZmZlcmVkJyxcbiAgLy8gZmlyZWQgd2hlbiBmcmFnbWVudCBtYXRjaGluZyB3aXRoIGN1cnJlbnQgbWVkaWEgcG9zaXRpb24gaXMgY2hhbmdpbmcgLSBkYXRhIDogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0IH1cbiAgRlJBR19DSEFOR0VEOiAnaGxzRnJhZ0NoYW5nZWQnLFxuICAgIC8vIElkZW50aWZpZXIgZm9yIGEgRlBTIGRyb3AgZXZlbnQgLSBkYXRhOiB7Y3VyZW50RHJvcHBlZCwgY3VycmVudERlY29kZWQsIHRvdGFsRHJvcHBlZEZyYW1lc31cbiAgRlBTX0RST1A6ICdobHNGUFNEcm9wJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYW4gZXJyb3IgZXZlbnQgLSBkYXRhOiB7IHR5cGUgOiBlcnJvciB0eXBlLCBkZXRhaWxzIDogZXJyb3IgZGV0YWlscywgZmF0YWwgOiBpZiB0cnVlLCBobHMuanMgY2Fubm90L3dpbGwgbm90IHRyeSB0byByZWNvdmVyLCBpZiBmYWxzZSwgaGxzLmpzIHdpbGwgdHJ5IHRvIHJlY292ZXIsb3RoZXIgZXJyb3Igc3BlY2lmaWMgZGF0YX1cbiAgRVJST1I6ICdobHNFcnJvcicsXG4gIC8vIGZpcmVkIHdoZW4gaGxzLmpzIGluc3RhbmNlIHN0YXJ0cyBkZXN0cm95aW5nLiBEaWZmZXJlbnQgZnJvbSBNU0VfREVUQUNIRUQgYXMgb25lIGNvdWxkIHdhbnQgdG8gZGV0YWNoIGFuZCByZWF0dGFjaCBhIG1lZGlhIHRvIHRoZSBpbnN0YW5jZSBvZiBobHMuanMgdG8gaGFuZGxlIG1pZC1yb2xscyBmb3IgZXhhbXBsZVxuICBERVNUUk9ZSU5HOiAnaGxzRGVzdHJveWluZycsXG4gIC8vIGZpcmVkIHdoZW4gYSBkZWNyeXB0IGtleSBsb2FkaW5nIHN0YXJ0cyAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdH1cbiAgS0VZX0xPQURJTkc6ICdobHNLZXlMb2FkaW5nJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGRlY3J5cHQga2V5IGxvYWRpbmcgaXMgY29tcGxldGVkIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0LCBwYXlsb2FkIDoga2V5IHBheWxvYWQsIHN0YXRzIDogeyB0cmVxdWVzdCwgdGZpcnN0LCB0bG9hZCwgbGVuZ3RofX1cbiAgS0VZX0xPQURFRDogJ2hsc0tleUxvYWRlZCcsXG59O1xuIiwiLyoqXG4gKiBMZXZlbCBIZWxwZXIgY2xhc3MsIHByb3ZpZGluZyBtZXRob2RzIGRlYWxpbmcgd2l0aCBwbGF5bGlzdCBzbGlkaW5nIGFuZCBkcmlmdFxuKi9cblxuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5cbmNsYXNzIExldmVsSGVscGVyIHtcblxuICBzdGF0aWMgbWVyZ2VEZXRhaWxzKG9sZERldGFpbHMsbmV3RGV0YWlscykge1xuICAgIHZhciBzdGFydCA9IE1hdGgubWF4KG9sZERldGFpbHMuc3RhcnRTTixuZXdEZXRhaWxzLnN0YXJ0U04pLW5ld0RldGFpbHMuc3RhcnRTTixcbiAgICAgICAgZW5kID0gTWF0aC5taW4ob2xkRGV0YWlscy5lbmRTTixuZXdEZXRhaWxzLmVuZFNOKS1uZXdEZXRhaWxzLnN0YXJ0U04sXG4gICAgICAgIGRlbHRhID0gbmV3RGV0YWlscy5zdGFydFNOIC0gb2xkRGV0YWlscy5zdGFydFNOLFxuICAgICAgICBvbGRmcmFnbWVudHMgPSBvbGREZXRhaWxzLmZyYWdtZW50cyxcbiAgICAgICAgbmV3ZnJhZ21lbnRzID0gbmV3RGV0YWlscy5mcmFnbWVudHMsXG4gICAgICAgIGNjT2Zmc2V0ID0wLFxuICAgICAgICBQVFNGcmFnO1xuXG4gICAgLy8gY2hlY2sgaWYgb2xkL25ldyBwbGF5bGlzdHMgaGF2ZSBmcmFnbWVudHMgaW4gY29tbW9uXG4gICAgaWYgKCBlbmQgPCBzdGFydCkge1xuICAgICAgbmV3RGV0YWlscy5QVFNLbm93biA9IGZhbHNlO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvLyBsb29wIHRocm91Z2ggb3ZlcmxhcHBpbmcgU04gYW5kIHVwZGF0ZSBzdGFydFBUUyAsIGNjLCBhbmQgZHVyYXRpb24gaWYgYW55IGZvdW5kXG4gICAgZm9yKHZhciBpID0gc3RhcnQgOyBpIDw9IGVuZCA7IGkrKykge1xuICAgICAgdmFyIG9sZEZyYWcgPSBvbGRmcmFnbWVudHNbZGVsdGEraV0sXG4gICAgICAgICAgbmV3RnJhZyA9IG5ld2ZyYWdtZW50c1tpXTtcbiAgICAgIGNjT2Zmc2V0ID0gb2xkRnJhZy5jYyAtIG5ld0ZyYWcuY2M7XG4gICAgICBpZiAoIWlzTmFOKG9sZEZyYWcuc3RhcnRQVFMpKSB7XG4gICAgICAgIG5ld0ZyYWcuc3RhcnQgPSBuZXdGcmFnLnN0YXJ0UFRTID0gb2xkRnJhZy5zdGFydFBUUztcbiAgICAgICAgbmV3RnJhZy5lbmRQVFMgPSBvbGRGcmFnLmVuZFBUUztcbiAgICAgICAgbmV3RnJhZy5kdXJhdGlvbiA9IG9sZEZyYWcuZHVyYXRpb247XG4gICAgICAgIFBUU0ZyYWcgPSBuZXdGcmFnO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmKGNjT2Zmc2V0KSB7XG4gICAgICBsb2dnZXIubG9nKGBkaXNjb250aW51aXR5IHNsaWRpbmcgZnJvbSBwbGF5bGlzdCwgdGFrZSBkcmlmdCBpbnRvIGFjY291bnRgKTtcbiAgICAgIGZvcihpID0gMCA7IGkgPCBuZXdmcmFnbWVudHMubGVuZ3RoIDsgaSsrKSB7XG4gICAgICAgIG5ld2ZyYWdtZW50c1tpXS5jYyArPSBjY09mZnNldDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBpZiBhdCBsZWFzdCBvbmUgZnJhZ21lbnQgY29udGFpbnMgUFRTIGluZm8sIHJlY29tcHV0ZSBQVFMgaW5mb3JtYXRpb24gZm9yIGFsbCBmcmFnbWVudHNcbiAgICBpZihQVFNGcmFnKSB7XG4gICAgICBMZXZlbEhlbHBlci51cGRhdGVGcmFnUFRTKG5ld0RldGFpbHMsUFRTRnJhZy5zbixQVFNGcmFnLnN0YXJ0UFRTLFBUU0ZyYWcuZW5kUFRTKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gYWRqdXN0IHN0YXJ0IGJ5IHNsaWRpbmcgb2Zmc2V0XG4gICAgICB2YXIgc2xpZGluZyA9IG9sZGZyYWdtZW50c1tkZWx0YV0uc3RhcnQ7XG4gICAgICBmb3IoaSA9IDAgOyBpIDwgbmV3ZnJhZ21lbnRzLmxlbmd0aCA7IGkrKykge1xuICAgICAgICBuZXdmcmFnbWVudHNbaV0uc3RhcnQgKz0gc2xpZGluZztcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gaWYgd2UgYXJlIGhlcmUsIGl0IG1lYW5zIHdlIGhhdmUgZnJhZ21lbnRzIG92ZXJsYXBwaW5nIGJldHdlZW5cbiAgICAvLyBvbGQgYW5kIG5ldyBsZXZlbC4gcmVsaWFibGUgUFRTIGluZm8gaXMgdGh1cyByZWx5aW5nIG9uIG9sZCBsZXZlbFxuICAgIG5ld0RldGFpbHMuUFRTS25vd24gPSBvbGREZXRhaWxzLlBUU0tub3duO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHN0YXRpYyB1cGRhdGVGcmFnUFRTKGRldGFpbHMsc24sc3RhcnRQVFMsZW5kUFRTKSB7XG4gICAgdmFyIGZyYWdJZHgsIGZyYWdtZW50cywgZnJhZywgaTtcbiAgICAvLyBleGl0IGlmIHNuIG91dCBvZiByYW5nZVxuICAgIGlmIChzbiA8IGRldGFpbHMuc3RhcnRTTiB8fCBzbiA+IGRldGFpbHMuZW5kU04pIHtcbiAgICAgIHJldHVybiAwO1xuICAgIH1cbiAgICBmcmFnSWR4ID0gc24gLSBkZXRhaWxzLnN0YXJ0U047XG4gICAgZnJhZ21lbnRzID0gZGV0YWlscy5mcmFnbWVudHM7XG4gICAgZnJhZyA9IGZyYWdtZW50c1tmcmFnSWR4XTtcbiAgICBpZighaXNOYU4oZnJhZy5zdGFydFBUUykpIHtcbiAgICAgIHN0YXJ0UFRTID0gTWF0aC5tYXgoc3RhcnRQVFMsZnJhZy5zdGFydFBUUyk7XG4gICAgICBlbmRQVFMgPSBNYXRoLm1pbihlbmRQVFMsIGZyYWcuZW5kUFRTKTtcbiAgICB9XG5cbiAgICB2YXIgZHJpZnQgPSBzdGFydFBUUyAtIGZyYWcuc3RhcnQ7XG5cbiAgICBmcmFnLnN0YXJ0ID0gZnJhZy5zdGFydFBUUyA9IHN0YXJ0UFRTO1xuICAgIGZyYWcuZW5kUFRTID0gZW5kUFRTO1xuICAgIGZyYWcuZHVyYXRpb24gPSBlbmRQVFMgLSBzdGFydFBUUztcbiAgICAvLyBhZGp1c3QgZnJhZ21lbnQgUFRTL2R1cmF0aW9uIGZyb20gc2VxbnVtLTEgdG8gZnJhZyAwXG4gICAgZm9yKGkgPSBmcmFnSWR4IDsgaSA+IDAgOyBpLS0pIHtcbiAgICAgIExldmVsSGVscGVyLnVwZGF0ZVBUUyhmcmFnbWVudHMsaSxpLTEpO1xuICAgIH1cblxuICAgIC8vIGFkanVzdCBmcmFnbWVudCBQVFMvZHVyYXRpb24gZnJvbSBzZXFudW0gdG8gbGFzdCBmcmFnXG4gICAgZm9yKGkgPSBmcmFnSWR4IDsgaSA8IGZyYWdtZW50cy5sZW5ndGggLSAxIDsgaSsrKSB7XG4gICAgICBMZXZlbEhlbHBlci51cGRhdGVQVFMoZnJhZ21lbnRzLGksaSsxKTtcbiAgICB9XG4gICAgZGV0YWlscy5QVFNLbm93biA9IHRydWU7XG4gICAgLy9sb2dnZXIubG9nKGAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyYWcgc3RhcnQvZW5kOiR7c3RhcnRQVFMudG9GaXhlZCgzKX0vJHtlbmRQVFMudG9GaXhlZCgzKX1gKTtcblxuICAgIHJldHVybiBkcmlmdDtcbiAgfVxuXG4gIHN0YXRpYyB1cGRhdGVQVFMoZnJhZ21lbnRzLGZyb21JZHgsIHRvSWR4KSB7XG4gICAgdmFyIGZyYWdGcm9tID0gZnJhZ21lbnRzW2Zyb21JZHhdLGZyYWdUbyA9IGZyYWdtZW50c1t0b0lkeF0sIGZyYWdUb1BUUyA9IGZyYWdUby5zdGFydFBUUztcbiAgICAvLyBpZiB3ZSBrbm93IHN0YXJ0UFRTW3RvSWR4XVxuICAgIGlmKCFpc05hTihmcmFnVG9QVFMpKSB7XG4gICAgICAvLyB1cGRhdGUgZnJhZ21lbnQgZHVyYXRpb24uXG4gICAgICAvLyBpdCBoZWxwcyB0byBmaXggZHJpZnRzIGJldHdlZW4gcGxheWxpc3QgcmVwb3J0ZWQgZHVyYXRpb24gYW5kIGZyYWdtZW50IHJlYWwgZHVyYXRpb25cbiAgICAgIGlmICh0b0lkeCA+IGZyb21JZHgpIHtcbiAgICAgICAgZnJhZ0Zyb20uZHVyYXRpb24gPSBmcmFnVG9QVFMtZnJhZ0Zyb20uc3RhcnQ7XG4gICAgICAgIGlmKGZyYWdGcm9tLmR1cmF0aW9uIDwgMCkge1xuICAgICAgICAgIGxvZ2dlci5lcnJvcihgbmVnYXRpdmUgZHVyYXRpb24gY29tcHV0ZWQgZm9yICR7ZnJhZ0Zyb219LCB0aGVyZSBzaG91bGQgYmUgc29tZSBkdXJhdGlvbiBkcmlmdCBiZXR3ZWVuIHBsYXlsaXN0IGFuZCBmcmFnbWVudCFgKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZnJhZ1RvLmR1cmF0aW9uID0gZnJhZ0Zyb20uc3RhcnQgLSBmcmFnVG9QVFM7XG4gICAgICAgIGlmKGZyYWdUby5kdXJhdGlvbiA8IDApIHtcbiAgICAgICAgICBsb2dnZXIuZXJyb3IoYG5lZ2F0aXZlIGR1cmF0aW9uIGNvbXB1dGVkIGZvciAke2ZyYWdUb30sIHRoZXJlIHNob3VsZCBiZSBzb21lIGR1cmF0aW9uIGRyaWZ0IGJldHdlZW4gcGxheWxpc3QgYW5kIGZyYWdtZW50IWApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIHdlIGRvbnQga25vdyBzdGFydFBUU1t0b0lkeF1cbiAgICAgIGlmICh0b0lkeCA+IGZyb21JZHgpIHtcbiAgICAgICAgZnJhZ1RvLnN0YXJ0ID0gZnJhZ0Zyb20uc3RhcnQgKyBmcmFnRnJvbS5kdXJhdGlvbjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZyYWdUby5zdGFydCA9IGZyYWdGcm9tLnN0YXJ0IC0gZnJhZ1RvLmR1cmF0aW9uO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBMZXZlbEhlbHBlcjtcbiIsIi8qKlxuICogSExTIGludGVyZmFjZVxuICovXG4ndXNlIHN0cmljdCc7XG5cbmltcG9ydCBFdmVudCBmcm9tICcuL2V2ZW50cyc7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi9lcnJvcnMnO1xuaW1wb3J0IFBsYXlsaXN0TG9hZGVyIGZyb20gJy4vbG9hZGVyL3BsYXlsaXN0LWxvYWRlcic7XG5pbXBvcnQgRnJhZ21lbnRMb2FkZXIgZnJvbSAnLi9sb2FkZXIvZnJhZ21lbnQtbG9hZGVyJztcbmltcG9ydCBBYnJDb250cm9sbGVyIGZyb20gICAgJy4vY29udHJvbGxlci9hYnItY29udHJvbGxlcic7XG5pbXBvcnQgTVNFTWVkaWFDb250cm9sbGVyIGZyb20gJy4vY29udHJvbGxlci9tc2UtbWVkaWEtY29udHJvbGxlcic7XG5pbXBvcnQgTGV2ZWxDb250cm9sbGVyIGZyb20gICcuL2NvbnRyb2xsZXIvbGV2ZWwtY29udHJvbGxlcic7XG4vL2ltcG9ydCBGUFNDb250cm9sbGVyIGZyb20gJy4vY29udHJvbGxlci9mcHMtY29udHJvbGxlcic7XG5pbXBvcnQge2xvZ2dlciwgZW5hYmxlTG9nc30gZnJvbSAnLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IFhockxvYWRlciBmcm9tICcuL3V0aWxzL3hoci1sb2FkZXInO1xuaW1wb3J0IEV2ZW50RW1pdHRlciBmcm9tICdldmVudHMnO1xuaW1wb3J0IEtleUxvYWRlciBmcm9tICcuL2xvYWRlci9rZXktbG9hZGVyJztcblxuY2xhc3MgSGxzIHtcblxuICBzdGF0aWMgaXNTdXBwb3J0ZWQoKSB7XG4gICAgcmV0dXJuICh3aW5kb3cuTWVkaWFTb3VyY2UgJiYgd2luZG93Lk1lZGlhU291cmNlLmlzVHlwZVN1cHBvcnRlZCgndmlkZW8vbXA0OyBjb2RlY3M9XCJhdmMxLjQyRTAxRSxtcDRhLjQwLjJcIicpKTtcbiAgfVxuXG4gIHN0YXRpYyBnZXQgRXZlbnRzKCkge1xuICAgIHJldHVybiBFdmVudDtcbiAgfVxuXG4gIHN0YXRpYyBnZXQgRXJyb3JUeXBlcygpIHtcbiAgICByZXR1cm4gRXJyb3JUeXBlcztcbiAgfVxuXG4gIHN0YXRpYyBnZXQgRXJyb3JEZXRhaWxzKCkge1xuICAgIHJldHVybiBFcnJvckRldGFpbHM7XG4gIH1cblxuICBjb25zdHJ1Y3Rvcihjb25maWcgPSB7fSkge1xuICAgdmFyIGNvbmZpZ0RlZmF1bHQgPSB7XG4gICAgICBhdXRvU3RhcnRMb2FkOiB0cnVlLFxuICAgICAgZGVidWc6IGZhbHNlLFxuICAgICAgbWF4QnVmZmVyTGVuZ3RoOiAzMCxcbiAgICAgIG1heEJ1ZmZlclNpemU6IDYwICogMTAwMCAqIDEwMDAsXG4gICAgICBsaXZlU3luY0R1cmF0aW9uQ291bnQ6MyxcbiAgICAgIGxpdmVNYXhMYXRlbmN5RHVyYXRpb25Db3VudDogSW5maW5pdHksXG4gICAgICBtYXhNYXhCdWZmZXJMZW5ndGg6IDYwMCxcbiAgICAgIGVuYWJsZVdvcmtlcjogdHJ1ZSxcbiAgICAgIGVuYWJsZVNvZnR3YXJlQUVTOiB0cnVlLFxuICAgICAgZnJhZ0xvYWRpbmdUaW1lT3V0OiAyMDAwMCxcbiAgICAgIGZyYWdMb2FkaW5nTWF4UmV0cnk6IDEsXG4gICAgICBmcmFnTG9hZGluZ1JldHJ5RGVsYXk6IDEwMDAsXG4gICAgICBmcmFnTG9hZGluZ0xvb3BUaHJlc2hvbGQ6IDMsXG4gICAgICBtYW5pZmVzdExvYWRpbmdUaW1lT3V0OiAxMDAwMCxcbiAgICAgIG1hbmlmZXN0TG9hZGluZ01heFJldHJ5OiAxLFxuICAgICAgbWFuaWZlc3RMb2FkaW5nUmV0cnlEZWxheTogMTAwMCxcbiAgICAgIGZwc0Ryb3BwZWRNb25pdG9yaW5nUGVyaW9kOiA1MDAwLFxuICAgICAgZnBzRHJvcHBlZE1vbml0b3JpbmdUaHJlc2hvbGQ6IDAuMixcbiAgICAgIGFwcGVuZEVycm9yTWF4UmV0cnk6IDIwMCxcbiAgICAgIGxvYWRlcjogWGhyTG9hZGVyLFxuICAgICAgZkxvYWRlcjogdW5kZWZpbmVkLFxuICAgICAgcExvYWRlcjogdW5kZWZpbmVkLFxuICAgICAgYWJyQ29udHJvbGxlciA6IEFickNvbnRyb2xsZXIsXG4gICAgICBtZWRpYUNvbnRyb2xsZXI6IE1TRU1lZGlhQ29udHJvbGxlclxuICAgIH07XG4gICAgZm9yICh2YXIgcHJvcCBpbiBjb25maWdEZWZhdWx0KSB7XG4gICAgICAgIGlmIChwcm9wIGluIGNvbmZpZykgeyBjb250aW51ZTsgfVxuICAgICAgICBjb25maWdbcHJvcF0gPSBjb25maWdEZWZhdWx0W3Byb3BdO1xuICAgIH1cblxuICAgIGlmIChjb25maWcubGl2ZU1heExhdGVuY3lEdXJhdGlvbkNvdW50ICE9PSB1bmRlZmluZWQgJiYgY29uZmlnLmxpdmVNYXhMYXRlbmN5RHVyYXRpb25Db3VudCA8PSBjb25maWcubGl2ZVN5bmNEdXJhdGlvbkNvdW50KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0lsbGVnYWwgaGxzLmpzIGNvbmZpZ3VyYXRpb246IFwibGl2ZU1heExhdGVuY3lEdXJhdGlvbkNvdW50XCIgbXVzdCBiZSBzdHJpY3RseSBzdXBlcmlvciB0byBcImxpdmVTeW5jRHVyYXRpb25Db3VudFwiIGluIHBsYXllciBjb25maWd1cmF0aW9uJyk7XG4gICAgfVxuXG4gICAgZW5hYmxlTG9ncyhjb25maWcuZGVidWcpO1xuICAgIHRoaXMuY29uZmlnID0gY29uZmlnO1xuICAgIC8vIG9ic2VydmVyIHNldHVwXG4gICAgdmFyIG9ic2VydmVyID0gdGhpcy5vYnNlcnZlciA9IG5ldyBFdmVudEVtaXR0ZXIoKTtcbiAgICBvYnNlcnZlci50cmlnZ2VyID0gZnVuY3Rpb24gdHJpZ2dlciAoZXZlbnQsIC4uLmRhdGEpIHtcbiAgICAgIG9ic2VydmVyLmVtaXQoZXZlbnQsIGV2ZW50LCAuLi5kYXRhKTtcbiAgICB9O1xuXG4gICAgb2JzZXJ2ZXIub2ZmID0gZnVuY3Rpb24gb2ZmIChldmVudCwgLi4uZGF0YSkge1xuICAgICAgb2JzZXJ2ZXIucmVtb3ZlTGlzdGVuZXIoZXZlbnQsIC4uLmRhdGEpO1xuICAgIH07XG4gICAgdGhpcy5vbiA9IG9ic2VydmVyLm9uLmJpbmQob2JzZXJ2ZXIpO1xuICAgIHRoaXMub2ZmID0gb2JzZXJ2ZXIub2ZmLmJpbmQob2JzZXJ2ZXIpO1xuICAgIHRoaXMudHJpZ2dlciA9IG9ic2VydmVyLnRyaWdnZXIuYmluZChvYnNlcnZlcik7XG4gICAgdGhpcy5wbGF5bGlzdExvYWRlciA9IG5ldyBQbGF5bGlzdExvYWRlcih0aGlzKTtcbiAgICB0aGlzLmZyYWdtZW50TG9hZGVyID0gbmV3IEZyYWdtZW50TG9hZGVyKHRoaXMpO1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyID0gbmV3IExldmVsQ29udHJvbGxlcih0aGlzKTtcbiAgICB0aGlzLmFickNvbnRyb2xsZXIgPSBuZXcgY29uZmlnLmFickNvbnRyb2xsZXIodGhpcyk7XG4gICAgdGhpcy5tZWRpYUNvbnRyb2xsZXIgPSBuZXcgY29uZmlnLm1lZGlhQ29udHJvbGxlcih0aGlzKTtcbiAgICB0aGlzLmtleUxvYWRlciA9IG5ldyBLZXlMb2FkZXIodGhpcyk7XG4gICAgLy90aGlzLmZwc0NvbnRyb2xsZXIgPSBuZXcgRlBTQ29udHJvbGxlcih0aGlzKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgbG9nZ2VyLmxvZygnZGVzdHJveScpO1xuICAgIHRoaXMudHJpZ2dlcihFdmVudC5ERVNUUk9ZSU5HKTtcbiAgICB0aGlzLmRldGFjaE1lZGlhKCk7XG4gICAgdGhpcy5wbGF5bGlzdExvYWRlci5kZXN0cm95KCk7XG4gICAgdGhpcy5mcmFnbWVudExvYWRlci5kZXN0cm95KCk7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIuZGVzdHJveSgpO1xuICAgIHRoaXMubWVkaWFDb250cm9sbGVyLmRlc3Ryb3koKTtcbiAgICB0aGlzLmtleUxvYWRlci5kZXN0cm95KCk7XG4gICAgLy90aGlzLmZwc0NvbnRyb2xsZXIuZGVzdHJveSgpO1xuICAgIHRoaXMudXJsID0gbnVsbDtcbiAgICB0aGlzLm9ic2VydmVyLnJlbW92ZUFsbExpc3RlbmVycygpO1xuICB9XG5cbiAgYXR0YWNoTWVkaWEobWVkaWEpIHtcbiAgICBsb2dnZXIubG9nKCdhdHRhY2hNZWRpYScpO1xuICAgIHRoaXMubWVkaWEgPSBtZWRpYTtcbiAgICB0aGlzLnRyaWdnZXIoRXZlbnQuTUVESUFfQVRUQUNISU5HLCB7bWVkaWE6IG1lZGlhfSk7XG4gIH1cblxuICBkZXRhY2hNZWRpYSgpIHtcbiAgICBsb2dnZXIubG9nKCdkZXRhY2hNZWRpYScpO1xuICAgIHRoaXMudHJpZ2dlcihFdmVudC5NRURJQV9ERVRBQ0hJTkcpO1xuICAgIHRoaXMubWVkaWEgPSBudWxsO1xuICB9XG5cbiAgbG9hZFNvdXJjZSh1cmwpIHtcbiAgICBsb2dnZXIubG9nKGBsb2FkU291cmNlOiR7dXJsfWApO1xuICAgIHRoaXMudXJsID0gdXJsO1xuICAgIC8vIHdoZW4gYXR0YWNoaW5nIHRvIGEgc291cmNlIFVSTCwgdHJpZ2dlciBhIHBsYXlsaXN0IGxvYWRcbiAgICB0aGlzLnRyaWdnZXIoRXZlbnQuTUFOSUZFU1RfTE9BRElORywge3VybDogdXJsfSk7XG4gIH1cblxuICBzdGFydExvYWQoKSB7XG4gICAgbG9nZ2VyLmxvZygnc3RhcnRMb2FkJyk7XG4gICAgdGhpcy5tZWRpYUNvbnRyb2xsZXIuc3RhcnRMb2FkKCk7XG4gIH1cblxuICByZWNvdmVyTWVkaWFFcnJvcigpIHtcbiAgICBsb2dnZXIubG9nKCdyZWNvdmVyTWVkaWFFcnJvcicpO1xuICAgIHZhciBtZWRpYSA9IHRoaXMubWVkaWE7XG4gICAgdGhpcy5kZXRhY2hNZWRpYSgpO1xuICAgIHRoaXMuYXR0YWNoTWVkaWEobWVkaWEpO1xuICB9XG5cbiAgLyoqIFJldHVybiBhbGwgcXVhbGl0eSBsZXZlbHMgKiovXG4gIGdldCBsZXZlbHMoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLmxldmVscztcbiAgfVxuXG4gIC8qKiBSZXR1cm4gY3VycmVudCBwbGF5YmFjayBxdWFsaXR5IGxldmVsICoqL1xuICBnZXQgY3VycmVudExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLm1lZGlhQ29udHJvbGxlci5jdXJyZW50TGV2ZWw7XG4gIH1cblxuICAvKiBzZXQgcXVhbGl0eSBsZXZlbCBpbW1lZGlhdGVseSAoLTEgZm9yIGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24pICovXG4gIHNldCBjdXJyZW50TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICBsb2dnZXIubG9nKGBzZXQgY3VycmVudExldmVsOiR7bmV3TGV2ZWx9YCk7XG4gICAgdGhpcy5sb2FkTGV2ZWwgPSBuZXdMZXZlbDtcbiAgICB0aGlzLm1lZGlhQ29udHJvbGxlci5pbW1lZGlhdGVMZXZlbFN3aXRjaCgpO1xuICB9XG5cbiAgLyoqIFJldHVybiBuZXh0IHBsYXliYWNrIHF1YWxpdHkgbGV2ZWwgKHF1YWxpdHkgbGV2ZWwgb2YgbmV4dCBmcmFnbWVudCkgKiovXG4gIGdldCBuZXh0TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubWVkaWFDb250cm9sbGVyLm5leHRMZXZlbDtcbiAgfVxuXG4gIC8qIHNldCBxdWFsaXR5IGxldmVsIGZvciBuZXh0IGZyYWdtZW50ICgtMSBmb3IgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbikgKi9cbiAgc2V0IG5leHRMZXZlbChuZXdMZXZlbCkge1xuICAgIGxvZ2dlci5sb2coYHNldCBuZXh0TGV2ZWw6JHtuZXdMZXZlbH1gKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5tYW51YWxMZXZlbCA9IG5ld0xldmVsO1xuICAgIHRoaXMubWVkaWFDb250cm9sbGVyLm5leHRMZXZlbFN3aXRjaCgpO1xuICB9XG5cbiAgLyoqIFJldHVybiB0aGUgcXVhbGl0eSBsZXZlbCBvZiBjdXJyZW50L2xhc3QgbG9hZGVkIGZyYWdtZW50ICoqL1xuICBnZXQgbG9hZExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLmxldmVsQ29udHJvbGxlci5sZXZlbDtcbiAgfVxuXG4gIC8qIHNldCBxdWFsaXR5IGxldmVsIGZvciBjdXJyZW50L25leHQgbG9hZGVkIGZyYWdtZW50ICgtMSBmb3IgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbikgKi9cbiAgc2V0IGxvYWRMZXZlbChuZXdMZXZlbCkge1xuICAgIGxvZ2dlci5sb2coYHNldCBsb2FkTGV2ZWw6JHtuZXdMZXZlbH1gKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5tYW51YWxMZXZlbCA9IG5ld0xldmVsO1xuICB9XG5cbiAgLyoqIFJldHVybiB0aGUgcXVhbGl0eSBsZXZlbCBvZiBuZXh0IGxvYWRlZCBmcmFnbWVudCAqKi9cbiAgZ2V0IG5leHRMb2FkTGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLm5leHRMb2FkTGV2ZWwoKTtcbiAgfVxuXG4gIC8qKiBzZXQgcXVhbGl0eSBsZXZlbCBvZiBuZXh0IGxvYWRlZCBmcmFnbWVudCAqKi9cbiAgc2V0IG5leHRMb2FkTGV2ZWwobGV2ZWwpIHtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5sZXZlbCA9IGxldmVsO1xuICB9XG5cbiAgLyoqIFJldHVybiBmaXJzdCBsZXZlbCAoaW5kZXggb2YgZmlyc3QgbGV2ZWwgcmVmZXJlbmNlZCBpbiBtYW5pZmVzdClcbiAgKiovXG4gIGdldCBmaXJzdExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLmxldmVsQ29udHJvbGxlci5maXJzdExldmVsO1xuICB9XG5cbiAgLyoqIHNldCBmaXJzdCBsZXZlbCAoaW5kZXggb2YgZmlyc3QgbGV2ZWwgcmVmZXJlbmNlZCBpbiBtYW5pZmVzdClcbiAgKiovXG4gIHNldCBmaXJzdExldmVsKG5ld0xldmVsKSB7XG4gICAgbG9nZ2VyLmxvZyhgc2V0IGZpcnN0TGV2ZWw6JHtuZXdMZXZlbH1gKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5maXJzdExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICAvKiogUmV0dXJuIHN0YXJ0IGxldmVsIChsZXZlbCBvZiBmaXJzdCBmcmFnbWVudCB0aGF0IHdpbGwgYmUgcGxheWVkIGJhY2spXG4gICAgICBpZiBub3Qgb3ZlcnJpZGVkIGJ5IHVzZXIsIGZpcnN0IGxldmVsIGFwcGVhcmluZyBpbiBtYW5pZmVzdCB3aWxsIGJlIHVzZWQgYXMgc3RhcnQgbGV2ZWxcbiAgICAgIGlmIC0xIDogYXV0b21hdGljIHN0YXJ0IGxldmVsIHNlbGVjdGlvbiwgcGxheWJhY2sgd2lsbCBzdGFydCBmcm9tIGxldmVsIG1hdGNoaW5nIGRvd25sb2FkIGJhbmR3aWR0aCAoZGV0ZXJtaW5lZCBmcm9tIGRvd25sb2FkIG9mIGZpcnN0IHNlZ21lbnQpXG4gICoqL1xuICBnZXQgc3RhcnRMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIuc3RhcnRMZXZlbDtcbiAgfVxuXG4gIC8qKiBzZXQgIHN0YXJ0IGxldmVsIChsZXZlbCBvZiBmaXJzdCBmcmFnbWVudCB0aGF0IHdpbGwgYmUgcGxheWVkIGJhY2spXG4gICAgICBpZiBub3Qgb3ZlcnJpZGVkIGJ5IHVzZXIsIGZpcnN0IGxldmVsIGFwcGVhcmluZyBpbiBtYW5pZmVzdCB3aWxsIGJlIHVzZWQgYXMgc3RhcnQgbGV2ZWxcbiAgICAgIGlmIC0xIDogYXV0b21hdGljIHN0YXJ0IGxldmVsIHNlbGVjdGlvbiwgcGxheWJhY2sgd2lsbCBzdGFydCBmcm9tIGxldmVsIG1hdGNoaW5nIGRvd25sb2FkIGJhbmR3aWR0aCAoZGV0ZXJtaW5lZCBmcm9tIGRvd25sb2FkIG9mIGZpcnN0IHNlZ21lbnQpXG4gICoqL1xuICBzZXQgc3RhcnRMZXZlbChuZXdMZXZlbCkge1xuICAgIGxvZ2dlci5sb2coYHNldCBzdGFydExldmVsOiR7bmV3TGV2ZWx9YCk7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIuc3RhcnRMZXZlbCA9IG5ld0xldmVsO1xuICB9XG5cbiAgLyoqIFJldHVybiB0aGUgY2FwcGluZy9tYXggbGV2ZWwgdmFsdWUgdGhhdCBjb3VsZCBiZSB1c2VkIGJ5IGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24gYWxnb3JpdGhtICoqL1xuICBnZXQgYXV0b0xldmVsQ2FwcGluZygpIHtcbiAgICByZXR1cm4gdGhpcy5hYnJDb250cm9sbGVyLmF1dG9MZXZlbENhcHBpbmc7XG4gIH1cblxuICAvKiogc2V0IHRoZSBjYXBwaW5nL21heCBsZXZlbCB2YWx1ZSB0aGF0IGNvdWxkIGJlIHVzZWQgYnkgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBhbGdvcml0aG0gKiovXG4gIHNldCBhdXRvTGV2ZWxDYXBwaW5nKG5ld0xldmVsKSB7XG4gICAgbG9nZ2VyLmxvZyhgc2V0IGF1dG9MZXZlbENhcHBpbmc6JHtuZXdMZXZlbH1gKTtcbiAgICB0aGlzLmFickNvbnRyb2xsZXIuYXV0b0xldmVsQ2FwcGluZyA9IG5ld0xldmVsO1xuICB9XG5cbiAgLyogY2hlY2sgaWYgd2UgYXJlIGluIGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24gbW9kZSAqL1xuICBnZXQgYXV0b0xldmVsRW5hYmxlZCgpIHtcbiAgICByZXR1cm4gKHRoaXMubGV2ZWxDb250cm9sbGVyLm1hbnVhbExldmVsID09PSAtMSk7XG4gIH1cblxuICAvKiByZXR1cm4gbWFudWFsIGxldmVsICovXG4gIGdldCBtYW51YWxMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIubWFudWFsTGV2ZWw7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgSGxzO1xuIiwiLypcbiAqIEZyYWdtZW50IExvYWRlclxuKi9cblxuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcblxuY2xhc3MgRnJhZ21lbnRMb2FkZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHRoaXMuaGxzID0gaGxzO1xuICAgIHRoaXMub25mbCA9IHRoaXMub25GcmFnTG9hZGluZy5iaW5kKHRoaXMpO1xuICAgIGhscy5vbihFdmVudC5GUkFHX0xPQURJTkcsIHRoaXMub25mbCk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIGlmICh0aGlzLmxvYWRlcikge1xuICAgICAgdGhpcy5sb2FkZXIuZGVzdHJveSgpO1xuICAgICAgdGhpcy5sb2FkZXIgPSBudWxsO1xuICAgIH1cbiAgICB0aGlzLmhscy5vZmYoRXZlbnQuRlJBR19MT0FESU5HLCB0aGlzLm9uZmwpO1xuICB9XG5cbiAgb25GcmFnTG9hZGluZyhldmVudCwgZGF0YSkge1xuICAgIHZhciBmcmFnID0gZGF0YS5mcmFnO1xuICAgIHRoaXMuZnJhZyA9IGZyYWc7XG4gICAgdGhpcy5mcmFnLmxvYWRlZCA9IDA7XG4gICAgdmFyIGNvbmZpZyA9IHRoaXMuaGxzLmNvbmZpZztcbiAgICBmcmFnLmxvYWRlciA9IHRoaXMubG9hZGVyID0gdHlwZW9mKGNvbmZpZy5mTG9hZGVyKSAhPT0gJ3VuZGVmaW5lZCcgPyBuZXcgY29uZmlnLmZMb2FkZXIoY29uZmlnKSA6IG5ldyBjb25maWcubG9hZGVyKGNvbmZpZyk7XG4gICAgdGhpcy5sb2FkZXIubG9hZChmcmFnLnVybCwgJ2FycmF5YnVmZmVyJywgdGhpcy5sb2Fkc3VjY2Vzcy5iaW5kKHRoaXMpLCB0aGlzLmxvYWRlcnJvci5iaW5kKHRoaXMpLCB0aGlzLmxvYWR0aW1lb3V0LmJpbmQodGhpcyksIGNvbmZpZy5mcmFnTG9hZGluZ1RpbWVPdXQsIGNvbmZpZy5mcmFnTG9hZGluZ01heFJldHJ5LCBjb25maWcuZnJhZ0xvYWRpbmdSZXRyeURlbGF5LCB0aGlzLmxvYWRwcm9ncmVzcy5iaW5kKHRoaXMpLCBmcmFnKTtcbiAgfVxuICBcbiAgbG9hZHN1Y2Nlc3MoZXZlbnQsIHN0YXRzKSB7XG4gICAgdmFyIHBheWxvYWQgPSBldmVudC5jdXJyZW50VGFyZ2V0LnJlc3BvbnNlO1xuICAgIHN0YXRzLmxlbmd0aCA9IHBheWxvYWQuYnl0ZUxlbmd0aDtcbiAgICAvLyBkZXRhY2ggZnJhZ21lbnQgbG9hZGVyIG9uIGxvYWQgc3VjY2Vzc1xuICAgIHRoaXMuZnJhZy5sb2FkZXIgPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5GUkFHX0xPQURFRCwge3BheWxvYWQ6IHBheWxvYWQsIGZyYWc6IHRoaXMuZnJhZywgc3RhdHM6IHN0YXRzfSk7XG4gIH1cblxuICBsb2FkZXJyb3IoZXZlbnQpIHtcbiAgICB0aGlzLmxvYWRlci5hYm9ydCgpO1xuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5GUkFHX0xPQURfRVJST1IsIGZhdGFsOiBmYWxzZSwgZnJhZzogdGhpcy5mcmFnLCByZXNwb25zZTogZXZlbnR9KTtcbiAgfSAgXG5cbiAgbG9hZHRpbWVvdXQoKSB7XG4gICAgdGhpcy5sb2FkZXIuYWJvcnQoKTtcbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5ORVRXT1JLX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuRlJBR19MT0FEX1RJTUVPVVQsIGZhdGFsOiBmYWxzZSwgZnJhZzogdGhpcy5mcmFnfSk7XG4gIH1cblxuICBsb2FkcHJvZ3Jlc3MoZXZlbnQsIHN0YXRzKSB7XG4gICAgdGhpcy5mcmFnLmxvYWRlZCA9IHN0YXRzLmxvYWRlZDtcbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkZSQUdfTE9BRF9QUk9HUkVTUywge2ZyYWc6IHRoaXMuZnJhZywgc3RhdHM6IHN0YXRzfSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRnJhZ21lbnRMb2FkZXI7XG4iLCIvKlxuICogRGVjcnlwdCBrZXkgTG9hZGVyXG4qL1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuXG5jbGFzcyBLZXlMb2FkZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHRoaXMuaGxzID0gaGxzO1xuICAgIHRoaXMuZGVjcnlwdGtleSA9IG51bGw7XG4gICAgdGhpcy5kZWNyeXB0dXJsID0gbnVsbDtcbiAgICB0aGlzLm9uZGtsID0gdGhpcy5vbkRlY3J5cHRLZXlMb2FkaW5nLmJpbmQodGhpcyk7XG4gICAgaGxzLm9uKEV2ZW50LktFWV9MT0FESU5HLCB0aGlzLm9uZGtsKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgaWYgKHRoaXMubG9hZGVyKSB7XG4gICAgICB0aGlzLmxvYWRlci5kZXN0cm95KCk7XG4gICAgICB0aGlzLmxvYWRlciA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMuaGxzLm9mZihFdmVudC5LRVlfTE9BRElORywgdGhpcy5vbmRrbCk7XG4gIH1cblxuICBvbkRlY3J5cHRLZXlMb2FkaW5nKGV2ZW50LCBkYXRhKSB7XG4gICAgdmFyIGZyYWcgPSB0aGlzLmZyYWcgPSBkYXRhLmZyYWcsXG4gICAgICAgIGRlY3J5cHRkYXRhID0gZnJhZy5kZWNyeXB0ZGF0YSxcbiAgICAgICAgdXJpID0gZGVjcnlwdGRhdGEudXJpO1xuICAgICAgICAvLyBpZiB1cmkgaXMgZGlmZmVyZW50IGZyb20gcHJldmlvdXMgb25lIG9yIGlmIGRlY3J5cHQga2V5IG5vdCByZXRyaWV2ZWQgeWV0XG4gICAgICBpZiAodXJpICE9PSB0aGlzLmRlY3J5cHR1cmwgfHwgdGhpcy5kZWNyeXB0a2V5ID09PSBudWxsKSB7XG4gICAgICAgIHZhciBjb25maWcgPSB0aGlzLmhscy5jb25maWc7XG4gICAgICAgIGZyYWcubG9hZGVyID0gdGhpcy5sb2FkZXIgPSBuZXcgY29uZmlnLmxvYWRlcihjb25maWcpO1xuICAgICAgICB0aGlzLmRlY3J5cHR1cmwgPSB1cmk7XG4gICAgICAgIHRoaXMuZGVjcnlwdGtleSA9IG51bGw7XG4gICAgICAgIGZyYWcubG9hZGVyLmxvYWQodXJpLCAnYXJyYXlidWZmZXInLCB0aGlzLmxvYWRzdWNjZXNzLmJpbmQodGhpcyksIHRoaXMubG9hZGVycm9yLmJpbmQodGhpcyksIHRoaXMubG9hZHRpbWVvdXQuYmluZCh0aGlzKSwgY29uZmlnLmZyYWdMb2FkaW5nVGltZU91dCwgY29uZmlnLmZyYWdMb2FkaW5nTWF4UmV0cnksIGNvbmZpZy5mcmFnTG9hZGluZ1JldHJ5RGVsYXksIHRoaXMubG9hZHByb2dyZXNzLmJpbmQodGhpcyksIGZyYWcpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLmRlY3J5cHRrZXkpIHtcbiAgICAgICAgLy8gd2UgYWxyZWFkeSBsb2FkZWQgdGhpcyBrZXksIHJldHVybiBpdFxuICAgICAgICBkZWNyeXB0ZGF0YS5rZXkgPSB0aGlzLmRlY3J5cHRrZXk7XG4gICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuS0VZX0xPQURFRCwge2ZyYWc6IGZyYWd9KTtcbiAgICAgIH1cbiAgfVxuXG4gIGxvYWRzdWNjZXNzKGV2ZW50KSB7XG4gICAgdmFyIGZyYWcgPSB0aGlzLmZyYWc7XG4gICAgdGhpcy5kZWNyeXB0a2V5ID0gZnJhZy5kZWNyeXB0ZGF0YS5rZXkgPSBuZXcgVWludDhBcnJheShldmVudC5jdXJyZW50VGFyZ2V0LnJlc3BvbnNlKTtcbiAgICAvLyBkZXRhY2ggZnJhZ21lbnQgbG9hZGVyIG9uIGxvYWQgc3VjY2Vzc1xuICAgIGZyYWcubG9hZGVyID0gdW5kZWZpbmVkO1xuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuS0VZX0xPQURFRCwge2ZyYWc6IGZyYWd9KTtcbiAgfVxuXG4gIGxvYWRlcnJvcihldmVudCkge1xuICAgIHRoaXMubG9hZGVyLmFib3J0KCk7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTkVUV09SS19FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLktFWV9MT0FEX0VSUk9SLCBmYXRhbDogZmFsc2UsIGZyYWc6IHRoaXMuZnJhZywgcmVzcG9uc2U6IGV2ZW50fSk7XG4gIH1cblxuICBsb2FkdGltZW91dCgpIHtcbiAgICB0aGlzLmxvYWRlci5hYm9ydCgpO1xuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5LRVlfTE9BRF9USU1FT1VULCBmYXRhbDogZmFsc2UsIGZyYWc6IHRoaXMuZnJhZ30pO1xuICB9XG5cbiAgbG9hZHByb2dyZXNzKCkge1xuXG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgS2V5TG9hZGVyO1xuIiwiLyoqXG4gKiBQbGF5bGlzdCBMb2FkZXJcbiovXG5cbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5pbXBvcnQgVVJMSGVscGVyIGZyb20gJy4uL3V0aWxzL3VybCc7XG4vL2ltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG5jbGFzcyBQbGF5bGlzdExvYWRlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgdGhpcy5obHMgPSBobHM7XG4gICAgdGhpcy5vbm1sID0gdGhpcy5vbk1hbmlmZXN0TG9hZGluZy5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25sbCA9IHRoaXMub25MZXZlbExvYWRpbmcuYmluZCh0aGlzKTtcbiAgICBobHMub24oRXZlbnQuTUFOSUZFU1RfTE9BRElORywgdGhpcy5vbm1sKTtcbiAgICBobHMub24oRXZlbnQuTEVWRUxfTE9BRElORywgdGhpcy5vbmxsKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgaWYgKHRoaXMubG9hZGVyKSB7XG4gICAgICB0aGlzLmxvYWRlci5kZXN0cm95KCk7XG4gICAgICB0aGlzLmxvYWRlciA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMudXJsID0gdGhpcy5pZCA9IG51bGw7XG4gICAgdGhpcy5obHMub2ZmKEV2ZW50Lk1BTklGRVNUX0xPQURJTkcsIHRoaXMub25tbCk7XG4gICAgdGhpcy5obHMub2ZmKEV2ZW50LkxFVkVMX0xPQURJTkcsIHRoaXMub25sbCk7XG4gIH1cblxuICBvbk1hbmlmZXN0TG9hZGluZyhldmVudCwgZGF0YSkge1xuICAgIHRoaXMubG9hZChkYXRhLnVybCwgbnVsbCk7XG4gIH1cblxuICBvbkxldmVsTG9hZGluZyhldmVudCwgZGF0YSkge1xuICAgIHRoaXMubG9hZChkYXRhLnVybCwgZGF0YS5sZXZlbCwgZGF0YS5pZCk7XG4gIH1cblxuICBsb2FkKHVybCwgaWQxLCBpZDIpIHtcbiAgICB2YXIgY29uZmlnID0gdGhpcy5obHMuY29uZmlnO1xuICAgIHRoaXMudXJsID0gdXJsO1xuICAgIHRoaXMuaWQgPSBpZDE7XG4gICAgdGhpcy5pZDIgPSBpZDI7XG4gICAgdGhpcy5sb2FkZXIgPSB0eXBlb2YoY29uZmlnLnBMb2FkZXIpICE9PSAndW5kZWZpbmVkJyA/IG5ldyBjb25maWcucExvYWRlcihjb25maWcpIDogbmV3IGNvbmZpZy5sb2FkZXIoY29uZmlnKTtcbiAgICB0aGlzLmxvYWRlci5sb2FkKHVybCwgJycsIHRoaXMubG9hZHN1Y2Nlc3MuYmluZCh0aGlzKSwgdGhpcy5sb2FkZXJyb3IuYmluZCh0aGlzKSwgdGhpcy5sb2FkdGltZW91dC5iaW5kKHRoaXMpLCBjb25maWcubWFuaWZlc3RMb2FkaW5nVGltZU91dCwgY29uZmlnLm1hbmlmZXN0TG9hZGluZ01heFJldHJ5LCBjb25maWcubWFuaWZlc3RMb2FkaW5nUmV0cnlEZWxheSk7XG4gIH1cblxuICByZXNvbHZlKHVybCwgYmFzZVVybCkge1xuICAgIHJldHVybiBVUkxIZWxwZXIuYnVpbGRBYnNvbHV0ZVVSTChiYXNlVXJsLCB1cmwpO1xuICB9XG5cbiAgcGFyc2VNYXN0ZXJQbGF5bGlzdChzdHJpbmcsIGJhc2V1cmwpIHtcbiAgICB2YXIgbGV2ZWxzID0gW10sIGxldmVsID0gIHt9LCByZXN1bHQsIGNvZGVjcywgY29kZWM7XG4gICAgLy8gaHR0cHM6Ly9yZWdleDEwMS5jb20gaXMgeW91ciBmcmllbmRcbiAgICB2YXIgcmUgPSAvI0VYVC1YLVNUUkVBTS1JTkY6KFteXFxuXFxyXSooQkFORClXSURUSD0oXFxkKykpPyhbXlxcblxccl0qKENPREVDUyk9XFxcIihbXlxcXCJcXG5cXHJdKilcXFwiLD8pPyhbXlxcblxccl0qKFJFUylPTFVUSU9OPShcXGQrKXgoXFxkKykpPyhbXlxcblxccl0qKE5BTUUpPVxcXCIoLiopXFxcIik/W15cXG5cXHJdKltcXHJcXG5dKyhbXlxcclxcbl0rKS9nO1xuICAgIHdoaWxlICgocmVzdWx0ID0gcmUuZXhlYyhzdHJpbmcpKSAhPSBudWxsKXtcbiAgICAgIHJlc3VsdC5zaGlmdCgpO1xuICAgICAgcmVzdWx0ID0gcmVzdWx0LmZpbHRlcihmdW5jdGlvbihuKSB7IHJldHVybiAobiAhPT0gdW5kZWZpbmVkKTsgfSk7XG4gICAgICBsZXZlbC51cmwgPSB0aGlzLnJlc29sdmUocmVzdWx0LnBvcCgpLCBiYXNldXJsKTtcbiAgICAgIHdoaWxlIChyZXN1bHQubGVuZ3RoID4gMCkge1xuICAgICAgICBzd2l0Y2ggKHJlc3VsdC5zaGlmdCgpKSB7XG4gICAgICAgICAgY2FzZSAnUkVTJzpcbiAgICAgICAgICAgIGxldmVsLndpZHRoID0gcGFyc2VJbnQocmVzdWx0LnNoaWZ0KCkpO1xuICAgICAgICAgICAgbGV2ZWwuaGVpZ2h0ID0gcGFyc2VJbnQocmVzdWx0LnNoaWZ0KCkpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnQkFORCc6XG4gICAgICAgICAgICBsZXZlbC5iaXRyYXRlID0gcGFyc2VJbnQocmVzdWx0LnNoaWZ0KCkpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnTkFNRSc6XG4gICAgICAgICAgICBsZXZlbC5uYW1lID0gcmVzdWx0LnNoaWZ0KCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdDT0RFQ1MnOlxuICAgICAgICAgICAgY29kZWNzID0gcmVzdWx0LnNoaWZ0KCkuc3BsaXQoJywnKTtcbiAgICAgICAgICAgIHdoaWxlIChjb2RlY3MubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICBjb2RlYyA9IGNvZGVjcy5zaGlmdCgpO1xuICAgICAgICAgICAgICBpZiAoY29kZWMuaW5kZXhPZignYXZjMScpICE9PSAtMSkge1xuICAgICAgICAgICAgICAgIGxldmVsLnZpZGVvQ29kZWMgPSB0aGlzLmF2YzF0b2F2Y290aShjb2RlYyk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbGV2ZWwuYXVkaW9Db2RlYyA9IGNvZGVjO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGxldmVscy5wdXNoKGxldmVsKTtcbiAgICAgIGxldmVsID0ge307XG4gICAgfVxuICAgIHJldHVybiBsZXZlbHM7XG4gIH1cblxuICBhdmMxdG9hdmNvdGkoY29kZWMpIHtcbiAgICB2YXIgcmVzdWx0LCBhdmNkYXRhID0gY29kZWMuc3BsaXQoJy4nKTtcbiAgICBpZiAoYXZjZGF0YS5sZW5ndGggPiAyKSB7XG4gICAgICByZXN1bHQgPSBhdmNkYXRhLnNoaWZ0KCkgKyAnLic7XG4gICAgICByZXN1bHQgKz0gcGFyc2VJbnQoYXZjZGF0YS5zaGlmdCgpKS50b1N0cmluZygxNik7XG4gICAgICByZXN1bHQgKz0gKCcwMCcgKyBwYXJzZUludChhdmNkYXRhLnNoaWZ0KCkpLnRvU3RyaW5nKDE2KSkuc3Vic3RyKC00KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0ID0gY29kZWM7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwYXJzZUtleVBhcmFtc0J5UmVnZXgoc3RyaW5nLCByZWdleHApIHtcbiAgICB2YXIgcmVzdWx0ID0gcmVnZXhwLmV4ZWMoc3RyaW5nKTtcbiAgICBpZiAocmVzdWx0KSB7XG4gICAgICByZXN1bHQuc2hpZnQoKTtcbiAgICAgIHJlc3VsdCA9IHJlc3VsdC5maWx0ZXIoZnVuY3Rpb24obikgeyByZXR1cm4gKG4gIT09IHVuZGVmaW5lZCk7IH0pO1xuICAgICAgaWYgKHJlc3VsdC5sZW5ndGggPT09IDIpIHtcbiAgICAgICAgcmV0dXJuIHJlc3VsdFsxXTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBjbG9uZU9iaihvYmopIHtcbiAgICByZXR1cm4gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShvYmopKTtcbiAgfVxuXG4gIHBhcnNlTGV2ZWxQbGF5bGlzdChzdHJpbmcsIGJhc2V1cmwsIGlkKSB7XG4gICAgdmFyIGN1cnJlbnRTTiA9IDAsIHRvdGFsZHVyYXRpb24gPSAwLCBsZXZlbCA9IHt1cmw6IGJhc2V1cmwsIGZyYWdtZW50czogW10sIGxpdmU6IHRydWUsIHN0YXJ0U046IDB9LCByZXN1bHQsIHJlZ2V4cCwgY2MgPSAwLCBmcmFnLCBieXRlUmFuZ2VFbmRPZmZzZXQsIGJ5dGVSYW5nZVN0YXJ0T2Zmc2V0O1xuICAgIHZhciBsZXZlbGtleSA9IHttZXRob2QgOiBudWxsLCBrZXkgOiBudWxsLCBpdiA6IG51bGwsIHVyaSA6IG51bGx9O1xuICAgIHJlZ2V4cCA9IC8oPzojRVhULVgtKE1FRElBLVNFUVVFTkNFKTooXFxkKykpfCg/OiNFWFQtWC0oVEFSR0VURFVSQVRJT04pOihcXGQrKSl8KD86I0VYVC1YLShLRVkpOiguKikpfCg/OiNFWFQoSU5GKTooW1xcZFxcLl0rKVteXFxyXFxuXSooW1xcclxcbl0rW14jfFxcclxcbl0rKT8pfCg/OiNFWFQtWC0oQllURVJBTkdFKTooW1xcZF0rW0BbXFxkXSopXSpbXFxyXFxuXSsoW14jfFxcclxcbl0rKT98KD86I0VYVC1YLShFTkRMSVNUKSl8KD86I0VYVC1YLShESVMpQ09OVElOVUlUWSkpL2c7XG4gICAgd2hpbGUgKChyZXN1bHQgPSByZWdleHAuZXhlYyhzdHJpbmcpKSAhPT0gbnVsbCkge1xuICAgICAgcmVzdWx0LnNoaWZ0KCk7XG4gICAgICByZXN1bHQgPSByZXN1bHQuZmlsdGVyKGZ1bmN0aW9uKG4pIHsgcmV0dXJuIChuICE9PSB1bmRlZmluZWQpOyB9KTtcbiAgICAgIHN3aXRjaCAocmVzdWx0WzBdKSB7XG4gICAgICAgIGNhc2UgJ01FRElBLVNFUVVFTkNFJzpcbiAgICAgICAgICBjdXJyZW50U04gPSBsZXZlbC5zdGFydFNOID0gcGFyc2VJbnQocmVzdWx0WzFdKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnVEFSR0VURFVSQVRJT04nOlxuICAgICAgICAgIGxldmVsLnRhcmdldGR1cmF0aW9uID0gcGFyc2VGbG9hdChyZXN1bHRbMV0pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdFTkRMSVNUJzpcbiAgICAgICAgICBsZXZlbC5saXZlID0gZmFsc2U7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0RJUyc6XG4gICAgICAgICAgY2MrKztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnQllURVJBTkdFJzpcbiAgICAgICAgICB2YXIgcGFyYW1zID0gcmVzdWx0WzFdLnNwbGl0KCdAJyk7XG4gICAgICAgICAgaWYgKHBhcmFtcy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgIGJ5dGVSYW5nZVN0YXJ0T2Zmc2V0ID0gYnl0ZVJhbmdlRW5kT2Zmc2V0O1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBieXRlUmFuZ2VTdGFydE9mZnNldCA9IHBhcnNlSW50KHBhcmFtc1sxXSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJ5dGVSYW5nZUVuZE9mZnNldCA9IHBhcnNlSW50KHBhcmFtc1swXSkgKyBieXRlUmFuZ2VTdGFydE9mZnNldDtcbiAgICAgICAgICBmcmFnID0gbGV2ZWwuZnJhZ21lbnRzLmxlbmd0aCA/IGxldmVsLmZyYWdtZW50c1tsZXZlbC5mcmFnbWVudHMubGVuZ3RoIC0gMV0gOiBudWxsO1xuICAgICAgICAgIGlmIChmcmFnICYmICFmcmFnLnVybCkge1xuICAgICAgICAgICAgZnJhZy5ieXRlUmFuZ2VTdGFydE9mZnNldCA9IGJ5dGVSYW5nZVN0YXJ0T2Zmc2V0O1xuICAgICAgICAgICAgZnJhZy5ieXRlUmFuZ2VFbmRPZmZzZXQgPSBieXRlUmFuZ2VFbmRPZmZzZXQ7XG4gICAgICAgICAgICBmcmFnLnVybCA9IHRoaXMucmVzb2x2ZShyZXN1bHRbMl0sIGJhc2V1cmwpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnSU5GJzpcbiAgICAgICAgICB2YXIgZHVyYXRpb24gPSBwYXJzZUZsb2F0KHJlc3VsdFsxXSk7XG4gICAgICAgICAgaWYgKCFpc05hTihkdXJhdGlvbikpIHtcbiAgICAgICAgICAgIHZhciBmcmFnZGVjcnlwdGRhdGEsXG4gICAgICAgICAgICAgICAgc24gPSBjdXJyZW50U04rKztcbiAgICAgICAgICAgIGlmIChsZXZlbGtleS5tZXRob2QgJiYgbGV2ZWxrZXkudXJpICYmICFsZXZlbGtleS5pdikge1xuICAgICAgICAgICAgICBmcmFnZGVjcnlwdGRhdGEgPSB0aGlzLmNsb25lT2JqKGxldmVsa2V5KTtcbiAgICAgICAgICAgICAgdmFyIHVpbnQ4VmlldyA9IG5ldyBVaW50OEFycmF5KDE2KTtcbiAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDEyOyBpIDwgMTY7IGkrKykge1xuICAgICAgICAgICAgICAgIHVpbnQ4Vmlld1tpXSA9IChzbiA+PiA4KigxNS1pKSkgJiAweGZmO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGZyYWdkZWNyeXB0ZGF0YS5pdiA9IHVpbnQ4VmlldztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGZyYWdkZWNyeXB0ZGF0YSA9IGxldmVsa2V5O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGV2ZWwuZnJhZ21lbnRzLnB1c2goe3VybDogcmVzdWx0WzJdID8gdGhpcy5yZXNvbHZlKHJlc3VsdFsyXSwgYmFzZXVybCkgOiBudWxsLCBkdXJhdGlvbjogZHVyYXRpb24sIHN0YXJ0OiB0b3RhbGR1cmF0aW9uLCBzbjogc24sIGxldmVsOiBpZCwgY2M6IGNjLCBieXRlUmFuZ2VTdGFydE9mZnNldDogYnl0ZVJhbmdlU3RhcnRPZmZzZXQsIGJ5dGVSYW5nZUVuZE9mZnNldDogYnl0ZVJhbmdlRW5kT2Zmc2V0LCBkZWNyeXB0ZGF0YSA6IGZyYWdkZWNyeXB0ZGF0YX0pO1xuICAgICAgICAgICAgdG90YWxkdXJhdGlvbiArPSBkdXJhdGlvbjtcbiAgICAgICAgICAgIGJ5dGVSYW5nZVN0YXJ0T2Zmc2V0ID0gbnVsbDtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0tFWSc6XG4gICAgICAgICAgLy8gaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL2RyYWZ0LXBhbnRvcy1odHRwLWxpdmUtc3RyZWFtaW5nLTA4I3NlY3Rpb24tMy40LjRcbiAgICAgICAgICB2YXIgZGVjcnlwdHBhcmFtcyA9IHJlc3VsdFsxXTtcbiAgICAgICAgICB2YXIgZGVjcnlwdG1ldGhvZCA9IHRoaXMucGFyc2VLZXlQYXJhbXNCeVJlZ2V4KGRlY3J5cHRwYXJhbXMsIC8oTUVUSE9EKT0oW14sXSopLyksXG4gICAgICAgICAgICAgIGRlY3J5cHR1cmkgPSB0aGlzLnBhcnNlS2V5UGFyYW1zQnlSZWdleChkZWNyeXB0cGFyYW1zLCAvKFVSSSk9W1wiXShbXixdKilbXCJdLyksXG4gICAgICAgICAgICAgIGRlY3J5cHRpdiA9IHRoaXMucGFyc2VLZXlQYXJhbXNCeVJlZ2V4KGRlY3J5cHRwYXJhbXMsIC8oSVYpPShbXixdKikvKTtcbiAgICAgICAgICBpZiAoZGVjcnlwdG1ldGhvZCkge1xuICAgICAgICAgICAgbGV2ZWxrZXkgPSB7IG1ldGhvZDogbnVsbCwga2V5OiBudWxsLCBpdjogbnVsbCwgdXJpOiBudWxsIH07XG4gICAgICAgICAgICBpZiAoKGRlY3J5cHR1cmkpICYmIChkZWNyeXB0bWV0aG9kID09PSAnQUVTLTEyOCcpKSB7XG4gICAgICAgICAgICAgIGxldmVsa2V5Lm1ldGhvZCA9IGRlY3J5cHRtZXRob2Q7XG4gICAgICAgICAgICAgIC8vIFVSSSB0byBnZXQgdGhlIGtleVxuICAgICAgICAgICAgICBsZXZlbGtleS51cmkgPSB0aGlzLnJlc29sdmUoZGVjcnlwdHVyaSwgYmFzZXVybCk7XG4gICAgICAgICAgICAgIGxldmVsa2V5LmtleSA9IG51bGw7XG4gICAgICAgICAgICAgIC8vIEluaXRpYWxpemF0aW9uIFZlY3RvciAoSVYpXG4gICAgICAgICAgICAgIGlmIChkZWNyeXB0aXYpIHtcbiAgICAgICAgICAgICAgICBsZXZlbGtleS5pdiA9IGRlY3J5cHRpdjtcbiAgICAgICAgICAgICAgICBpZiAobGV2ZWxrZXkuaXYuc3Vic3RyaW5nKDAsIDIpID09PSAnMHgnKSB7XG4gICAgICAgICAgICAgICAgICBsZXZlbGtleS5pdiA9IGxldmVsa2V5Lml2LnN1YnN0cmluZygyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbGV2ZWxrZXkuaXYgPSBsZXZlbGtleS5pdi5tYXRjaCgvLns4fS9nKTtcbiAgICAgICAgICAgICAgICBsZXZlbGtleS5pdlswXSA9IHBhcnNlSW50KGxldmVsa2V5Lml2WzBdLCAxNik7XG4gICAgICAgICAgICAgICAgbGV2ZWxrZXkuaXZbMV0gPSBwYXJzZUludChsZXZlbGtleS5pdlsxXSwgMTYpO1xuICAgICAgICAgICAgICAgIGxldmVsa2V5Lml2WzJdID0gcGFyc2VJbnQobGV2ZWxrZXkuaXZbMl0sIDE2KTtcbiAgICAgICAgICAgICAgICBsZXZlbGtleS5pdlszXSA9IHBhcnNlSW50KGxldmVsa2V5Lml2WzNdLCAxNik7XG4gICAgICAgICAgICAgICAgbGV2ZWxrZXkuaXYgPSBuZXcgVWludDMyQXJyYXkobGV2ZWxrZXkuaXYpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICAvL2xvZ2dlci5sb2coJ2ZvdW5kICcgKyBsZXZlbC5mcmFnbWVudHMubGVuZ3RoICsgJyBmcmFnbWVudHMnKTtcbiAgICBsZXZlbC50b3RhbGR1cmF0aW9uID0gdG90YWxkdXJhdGlvbjtcbiAgICBsZXZlbC5lbmRTTiA9IGN1cnJlbnRTTiAtIDE7XG4gICAgcmV0dXJuIGxldmVsO1xuICB9XG5cbiAgbG9hZHN1Y2Nlc3MoZXZlbnQsIHN0YXRzKSB7XG4gICAgdmFyIHN0cmluZyA9IGV2ZW50LmN1cnJlbnRUYXJnZXQucmVzcG9uc2VUZXh0LCB1cmwgPSBldmVudC5jdXJyZW50VGFyZ2V0LnJlc3BvbnNlVVJMLCBpZCA9IHRoaXMuaWQsIGlkMiA9IHRoaXMuaWQyLCBobHMgPSB0aGlzLmhscywgbGV2ZWxzO1xuICAgIC8vIHJlc3BvbnNlVVJMIG5vdCBzdXBwb3J0ZWQgb24gc29tZSBicm93c2VycyAoaXQgaXMgdXNlZCB0byBkZXRlY3QgVVJMIHJlZGlyZWN0aW9uKVxuICAgIGlmICh1cmwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8gZmFsbGJhY2sgdG8gaW5pdGlhbCBVUkxcbiAgICAgIHVybCA9IHRoaXMudXJsO1xuICAgIH1cbiAgICBzdGF0cy50bG9hZCA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgIHN0YXRzLm10aW1lID0gbmV3IERhdGUoZXZlbnQuY3VycmVudFRhcmdldC5nZXRSZXNwb25zZUhlYWRlcignTGFzdC1Nb2RpZmllZCcpKTtcbiAgICBpZiAoc3RyaW5nLmluZGV4T2YoJyNFWFRNM1UnKSA9PT0gMCkge1xuICAgICAgaWYgKHN0cmluZy5pbmRleE9mKCcjRVhUSU5GOicpID4gMCkge1xuICAgICAgICAvLyAxIGxldmVsIHBsYXlsaXN0XG4gICAgICAgIC8vIGlmIGZpcnN0IHJlcXVlc3QsIGZpcmUgbWFuaWZlc3QgbG9hZGVkIGV2ZW50LCBsZXZlbCB3aWxsIGJlIHJlbG9hZGVkIGFmdGVyd2FyZHNcbiAgICAgICAgLy8gKHRoaXMgaXMgdG8gaGF2ZSBhIHVuaWZvcm0gbG9naWMgZm9yIDEgbGV2ZWwvbXVsdGlsZXZlbCBwbGF5bGlzdHMpXG4gICAgICAgIGlmICh0aGlzLmlkID09PSBudWxsKSB7XG4gICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuTUFOSUZFU1RfTE9BREVELCB7bGV2ZWxzOiBbe3VybDogdXJsfV0sIHVybDogdXJsLCBzdGF0czogc3RhdHN9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YXIgbGV2ZWxEZXRhaWxzID0gdGhpcy5wYXJzZUxldmVsUGxheWxpc3Qoc3RyaW5nLCB1cmwsIGlkKTtcbiAgICAgICAgICBzdGF0cy50cGFyc2VkID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuTEVWRUxfTE9BREVELCB7ZGV0YWlsczogbGV2ZWxEZXRhaWxzLCBsZXZlbDogaWQsIGlkOiBpZDIsIHN0YXRzOiBzdGF0c30pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsZXZlbHMgPSB0aGlzLnBhcnNlTWFzdGVyUGxheWxpc3Qoc3RyaW5nLCB1cmwpO1xuICAgICAgICAvLyBtdWx0aSBsZXZlbCBwbGF5bGlzdCwgcGFyc2UgbGV2ZWwgaW5mb1xuICAgICAgICBpZiAobGV2ZWxzLmxlbmd0aCkge1xuICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50Lk1BTklGRVNUX0xPQURFRCwge2xldmVsczogbGV2ZWxzLCB1cmw6IHVybCwgc3RhdHM6IHN0YXRzfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5NQU5JRkVTVF9QQVJTSU5HX0VSUk9SLCBmYXRhbDogdHJ1ZSwgdXJsOiB1cmwsIHJlYXNvbjogJ25vIGxldmVsIGZvdW5kIGluIG1hbmlmZXN0J30pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5ORVRXT1JLX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuTUFOSUZFU1RfUEFSU0lOR19FUlJPUiwgZmF0YWw6IHRydWUsIHVybDogdXJsLCByZWFzb246ICdubyBFWFRNM1UgZGVsaW1pdGVyJ30pO1xuICAgIH1cbiAgfVxuXG4gIGxvYWRlcnJvcihldmVudCkge1xuICAgIHZhciBkZXRhaWxzLCBmYXRhbDtcbiAgICBpZiAodGhpcy5pZCA9PT0gbnVsbCkge1xuICAgICAgZGV0YWlscyA9IEVycm9yRGV0YWlscy5NQU5JRkVTVF9MT0FEX0VSUk9SO1xuICAgICAgZmF0YWwgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBkZXRhaWxzID0gRXJyb3JEZXRhaWxzLkxFVkVMX0xPQURfRVJST1I7XG4gICAgICBmYXRhbCA9IGZhbHNlO1xuICAgIH1cbiAgICB0aGlzLmxvYWRlci5hYm9ydCgpO1xuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHM6IGRldGFpbHMsIGZhdGFsOiBmYXRhbCwgdXJsOiB0aGlzLnVybCwgbG9hZGVyOiB0aGlzLmxvYWRlciwgcmVzcG9uc2U6IGV2ZW50LmN1cnJlbnRUYXJnZXQsIGxldmVsOiB0aGlzLmlkLCBpZDogdGhpcy5pZDJ9KTtcbiAgfVxuXG4gIGxvYWR0aW1lb3V0KCkge1xuICAgIHZhciBkZXRhaWxzLCBmYXRhbDtcbiAgICBpZiAodGhpcy5pZCA9PT0gbnVsbCkge1xuICAgICAgZGV0YWlscyA9IEVycm9yRGV0YWlscy5NQU5JRkVTVF9MT0FEX1RJTUVPVVQ7XG4gICAgICBmYXRhbCA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGRldGFpbHMgPSBFcnJvckRldGFpbHMuTEVWRUxfTE9BRF9USU1FT1VUO1xuICAgICAgZmF0YWwgPSBmYWxzZTtcbiAgICB9XG4gICB0aGlzLmxvYWRlci5hYm9ydCgpO1xuICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTkVUV09SS19FUlJPUiwgZGV0YWlsczogZGV0YWlscywgZmF0YWw6IGZhdGFsLCB1cmw6IHRoaXMudXJsLCBsb2FkZXI6IHRoaXMubG9hZGVyLCBsZXZlbDogdGhpcy5pZCwgaWQ6IHRoaXMuaWQyfSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgUGxheWxpc3RMb2FkZXI7XG4iLCIvKipcbiAqIEdlbmVyYXRlIE1QNCBCb3hcbiovXG5cbi8vaW1wb3J0IEhleCBmcm9tICcuLi91dGlscy9oZXgnO1xuY2xhc3MgTVA0IHtcbiAgc3RhdGljIGluaXQoKSB7XG4gICAgTVA0LnR5cGVzID0ge1xuICAgICAgYXZjMTogW10sIC8vIGNvZGluZ25hbWVcbiAgICAgIGF2Y0M6IFtdLFxuICAgICAgYnRydDogW10sXG4gICAgICBkaW5mOiBbXSxcbiAgICAgIGRyZWY6IFtdLFxuICAgICAgZXNkczogW10sXG4gICAgICBmdHlwOiBbXSxcbiAgICAgIGhkbHI6IFtdLFxuICAgICAgbWRhdDogW10sXG4gICAgICBtZGhkOiBbXSxcbiAgICAgIG1kaWE6IFtdLFxuICAgICAgbWZoZDogW10sXG4gICAgICBtaW5mOiBbXSxcbiAgICAgIG1vb2Y6IFtdLFxuICAgICAgbW9vdjogW10sXG4gICAgICBtcDRhOiBbXSxcbiAgICAgIG12ZXg6IFtdLFxuICAgICAgbXZoZDogW10sXG4gICAgICBzZHRwOiBbXSxcbiAgICAgIHN0Ymw6IFtdLFxuICAgICAgc3RjbzogW10sXG4gICAgICBzdHNjOiBbXSxcbiAgICAgIHN0c2Q6IFtdLFxuICAgICAgc3RzejogW10sXG4gICAgICBzdHRzOiBbXSxcbiAgICAgIHRmZHQ6IFtdLFxuICAgICAgdGZoZDogW10sXG4gICAgICB0cmFmOiBbXSxcbiAgICAgIHRyYWs6IFtdLFxuICAgICAgdHJ1bjogW10sXG4gICAgICB0cmV4OiBbXSxcbiAgICAgIHRraGQ6IFtdLFxuICAgICAgdm1oZDogW10sXG4gICAgICBzbWhkOiBbXVxuICAgIH07XG5cbiAgICB2YXIgaTtcbiAgICBmb3IgKGkgaW4gTVA0LnR5cGVzKSB7XG4gICAgICBpZiAoTVA0LnR5cGVzLmhhc093blByb3BlcnR5KGkpKSB7XG4gICAgICAgIE1QNC50eXBlc1tpXSA9IFtcbiAgICAgICAgICBpLmNoYXJDb2RlQXQoMCksXG4gICAgICAgICAgaS5jaGFyQ29kZUF0KDEpLFxuICAgICAgICAgIGkuY2hhckNvZGVBdCgyKSxcbiAgICAgICAgICBpLmNoYXJDb2RlQXQoMylcbiAgICAgICAgXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBNUDQuTUFKT1JfQlJBTkQgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAnaScuY2hhckNvZGVBdCgwKSxcbiAgICAgICdzJy5jaGFyQ29kZUF0KDApLFxuICAgICAgJ28nLmNoYXJDb2RlQXQoMCksXG4gICAgICAnbScuY2hhckNvZGVBdCgwKVxuICAgIF0pO1xuXG4gICAgTVA0LkFWQzFfQlJBTkQgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAnYScuY2hhckNvZGVBdCgwKSxcbiAgICAgICd2Jy5jaGFyQ29kZUF0KDApLFxuICAgICAgJ2MnLmNoYXJDb2RlQXQoMCksXG4gICAgICAnMScuY2hhckNvZGVBdCgwKVxuICAgIF0pO1xuXG4gICAgTVA0Lk1JTk9SX1ZFUlNJT04gPSBuZXcgVWludDhBcnJheShbMCwgMCwgMCwgMV0pO1xuXG4gICAgTVA0LlZJREVPX0hETFIgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBwcmVfZGVmaW5lZFxuICAgICAgMHg3NiwgMHg2OSwgMHg2NCwgMHg2NSwgLy8gaGFuZGxlcl90eXBlOiAndmlkZSdcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4NTYsIDB4NjksIDB4NjQsIDB4NjUsXG4gICAgICAweDZmLCAweDQ4LCAweDYxLCAweDZlLFxuICAgICAgMHg2NCwgMHg2YywgMHg2NSwgMHg3MiwgMHgwMCAvLyBuYW1lOiAnVmlkZW9IYW5kbGVyJ1xuICAgIF0pO1xuXG4gICAgTVA0LkFVRElPX0hETFIgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBwcmVfZGVmaW5lZFxuICAgICAgMHg3MywgMHg2ZiwgMHg3NSwgMHg2ZSwgLy8gaGFuZGxlcl90eXBlOiAnc291bidcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4NTMsIDB4NmYsIDB4NzUsIDB4NmUsXG4gICAgICAweDY0LCAweDQ4LCAweDYxLCAweDZlLFxuICAgICAgMHg2NCwgMHg2YywgMHg2NSwgMHg3MiwgMHgwMCAvLyBuYW1lOiAnU291bmRIYW5kbGVyJ1xuICAgIF0pO1xuXG4gICAgTVA0LkhETFJfVFlQRVMgPSB7XG4gICAgICAndmlkZW8nOiBNUDQuVklERU9fSERMUixcbiAgICAgICdhdWRpbyc6IE1QNC5BVURJT19IRExSXG4gICAgfTtcblxuICAgIE1QNC5EUkVGID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMSwgLy8gZW50cnlfY291bnRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MGMsIC8vIGVudHJ5X3NpemVcbiAgICAgIDB4NzUsIDB4NzIsIDB4NmMsIDB4MjAsIC8vICd1cmwnIHR5cGVcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMSAvLyBlbnRyeV9mbGFnc1xuICAgIF0pO1xuICAgIE1QNC5TVENPID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAgLy8gZW50cnlfY291bnRcbiAgICBdKTtcbiAgICBNUDQuU1RTQyA9IE1QNC5TVENPO1xuICAgIE1QNC5TVFRTID0gTVA0LlNUQ087XG4gICAgTVA0LlNUU1ogPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gc2FtcGxlX3NpemVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHNhbXBsZV9jb3VudFxuICAgIF0pO1xuICAgIE1QNC5WTUhEID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMSwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIC8vIGdyYXBoaWNzbW9kZVxuICAgICAgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwIC8vIG9wY29sb3JcbiAgICBdKTtcbiAgICBNUDQuU01IRCA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAvLyBiYWxhbmNlXG4gICAgICAweDAwLCAweDAwIC8vIHJlc2VydmVkXG4gICAgXSk7XG5cbiAgICBNUDQuU1RTRCA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDFdKTsvLyBlbnRyeV9jb3VudFxuXG4gICAgTVA0LkZUWVAgPSBNUDQuYm94KE1QNC50eXBlcy5mdHlwLCBNUDQuTUFKT1JfQlJBTkQsIE1QNC5NSU5PUl9WRVJTSU9OLCBNUDQuTUFKT1JfQlJBTkQsIE1QNC5BVkMxX0JSQU5EKTtcbiAgICBNUDQuRElORiA9IE1QNC5ib3goTVA0LnR5cGVzLmRpbmYsIE1QNC5ib3goTVA0LnR5cGVzLmRyZWYsIE1QNC5EUkVGKSk7XG4gIH1cblxuICBzdGF0aWMgYm94KHR5cGUpIHtcbiAgdmFyXG4gICAgcGF5bG9hZCA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSksXG4gICAgc2l6ZSA9IDAsXG4gICAgaSA9IHBheWxvYWQubGVuZ3RoLFxuICAgIHJlc3VsdCxcbiAgICB2aWV3O1xuICAgIC8vIGNhbGN1bGF0ZSB0aGUgdG90YWwgc2l6ZSB3ZSBuZWVkIHRvIGFsbG9jYXRlXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgc2l6ZSArPSBwYXlsb2FkW2ldLmJ5dGVMZW5ndGg7XG4gICAgfVxuICAgIHJlc3VsdCA9IG5ldyBVaW50OEFycmF5KHNpemUgKyA4KTtcbiAgICB2aWV3ID0gbmV3IERhdGFWaWV3KHJlc3VsdC5idWZmZXIpO1xuICAgIHZpZXcuc2V0VWludDMyKDAsIHJlc3VsdC5ieXRlTGVuZ3RoKTtcbiAgICByZXN1bHQuc2V0KHR5cGUsIDQpO1xuICAgIC8vIGNvcHkgdGhlIHBheWxvYWQgaW50byB0aGUgcmVzdWx0XG4gICAgZm9yIChpID0gMCwgc2l6ZSA9IDg7IGkgPCBwYXlsb2FkLmxlbmd0aDsgaSsrKSB7XG4gICAgICByZXN1bHQuc2V0KHBheWxvYWRbaV0sIHNpemUpO1xuICAgICAgc2l6ZSArPSBwYXlsb2FkW2ldLmJ5dGVMZW5ndGg7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBzdGF0aWMgaGRscih0eXBlKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLmhkbHIsIE1QNC5IRExSX1RZUEVTW3R5cGVdKTtcbiAgfVxuXG4gIHN0YXRpYyBtZGF0KGRhdGEpIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWRhdCwgZGF0YSk7XG4gIH1cblxuICBzdGF0aWMgbWRoZCh0aW1lc2NhbGUsIGR1cmF0aW9uKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1kaGQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDIsIC8vIGNyZWF0aW9uX3RpbWVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDMsIC8vIG1vZGlmaWNhdGlvbl90aW1lXG4gICAgICAodGltZXNjYWxlID4+IDI0KSAmIDB4RkYsXG4gICAgICAodGltZXNjYWxlID4+IDE2KSAmIDB4RkYsXG4gICAgICAodGltZXNjYWxlID4+ICA4KSAmIDB4RkYsXG4gICAgICB0aW1lc2NhbGUgJiAweEZGLCAvLyB0aW1lc2NhbGVcbiAgICAgIChkdXJhdGlvbiA+PiAyNCksXG4gICAgICAoZHVyYXRpb24gPj4gMTYpICYgMHhGRixcbiAgICAgIChkdXJhdGlvbiA+PiAgOCkgJiAweEZGLFxuICAgICAgZHVyYXRpb24gJiAweEZGLCAvLyBkdXJhdGlvblxuICAgICAgMHg1NSwgMHhjNCwgLy8gJ3VuZCcgbGFuZ3VhZ2UgKHVuZGV0ZXJtaW5lZClcbiAgICAgIDB4MDAsIDB4MDBcbiAgICBdKSk7XG4gIH1cblxuICBzdGF0aWMgbWRpYSh0cmFjaykge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tZGlhLCBNUDQubWRoZCh0cmFjay50aW1lc2NhbGUsIHRyYWNrLmR1cmF0aW9uKSwgTVA0LmhkbHIodHJhY2sudHlwZSksIE1QNC5taW5mKHRyYWNrKSk7XG4gIH1cblxuICBzdGF0aWMgbWZoZChzZXF1ZW5jZU51bWJlcikge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tZmhkLCBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIChzZXF1ZW5jZU51bWJlciA+PiAyNCksXG4gICAgICAoc2VxdWVuY2VOdW1iZXIgPj4gMTYpICYgMHhGRixcbiAgICAgIChzZXF1ZW5jZU51bWJlciA+PiAgOCkgJiAweEZGLFxuICAgICAgc2VxdWVuY2VOdW1iZXIgJiAweEZGLCAvLyBzZXF1ZW5jZV9udW1iZXJcbiAgICBdKSk7XG4gIH1cblxuICBzdGF0aWMgbWluZih0cmFjaykge1xuICAgIGlmICh0cmFjay50eXBlID09PSAnYXVkaW8nKSB7XG4gICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWluZiwgTVA0LmJveChNUDQudHlwZXMuc21oZCwgTVA0LlNNSEQpLCBNUDQuRElORiwgTVA0LnN0YmwodHJhY2spKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1pbmYsIE1QNC5ib3goTVA0LnR5cGVzLnZtaGQsIE1QNC5WTUhEKSwgTVA0LkRJTkYsIE1QNC5zdGJsKHRyYWNrKSk7XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIG1vb2Yoc24sIGJhc2VNZWRpYURlY29kZVRpbWUsIHRyYWNrKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1vb2YsIE1QNC5tZmhkKHNuKSwgTVA0LnRyYWYodHJhY2ssYmFzZU1lZGlhRGVjb2RlVGltZSkpO1xuICB9XG4vKipcbiAqIEBwYXJhbSB0cmFja3MuLi4gKG9wdGlvbmFsKSB7YXJyYXl9IHRoZSB0cmFja3MgYXNzb2NpYXRlZCB3aXRoIHRoaXMgbW92aWVcbiAqL1xuICBzdGF0aWMgbW9vdih0cmFja3MpIHtcbiAgICB2YXJcbiAgICAgIGkgPSB0cmFja3MubGVuZ3RoLFxuICAgICAgYm94ZXMgPSBbXTtcblxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIGJveGVzW2ldID0gTVA0LnRyYWsodHJhY2tzW2ldKTtcbiAgICB9XG5cbiAgICByZXR1cm4gTVA0LmJveC5hcHBseShudWxsLCBbTVA0LnR5cGVzLm1vb3YsIE1QNC5tdmhkKHRyYWNrc1swXS50aW1lc2NhbGUsIHRyYWNrc1swXS5kdXJhdGlvbildLmNvbmNhdChib3hlcykuY29uY2F0KE1QNC5tdmV4KHRyYWNrcykpKTtcbiAgfVxuXG4gIHN0YXRpYyBtdmV4KHRyYWNrcykge1xuICAgIHZhclxuICAgICAgaSA9IHRyYWNrcy5sZW5ndGgsXG4gICAgICBib3hlcyA9IFtdO1xuXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgYm94ZXNbaV0gPSBNUDQudHJleCh0cmFja3NbaV0pO1xuICAgIH1cbiAgICByZXR1cm4gTVA0LmJveC5hcHBseShudWxsLCBbTVA0LnR5cGVzLm12ZXhdLmNvbmNhdChib3hlcykpO1xuICB9XG5cbiAgc3RhdGljIG12aGQodGltZXNjYWxlLGR1cmF0aW9uKSB7XG4gICAgdmFyXG4gICAgICBieXRlcyA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDEsIC8vIGNyZWF0aW9uX3RpbWVcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMiwgLy8gbW9kaWZpY2F0aW9uX3RpbWVcbiAgICAgICAgKHRpbWVzY2FsZSA+PiAyNCkgJiAweEZGLFxuICAgICAgICAodGltZXNjYWxlID4+IDE2KSAmIDB4RkYsXG4gICAgICAgICh0aW1lc2NhbGUgPj4gIDgpICYgMHhGRixcbiAgICAgICAgdGltZXNjYWxlICYgMHhGRiwgLy8gdGltZXNjYWxlXG4gICAgICAgIChkdXJhdGlvbiA+PiAyNCkgJiAweEZGLFxuICAgICAgICAoZHVyYXRpb24gPj4gMTYpICYgMHhGRixcbiAgICAgICAgKGR1cmF0aW9uID4+ICA4KSAmIDB4RkYsXG4gICAgICAgIGR1cmF0aW9uICYgMHhGRiwgLy8gZHVyYXRpb25cbiAgICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCwgLy8gMS4wIHJhdGVcbiAgICAgICAgMHgwMSwgMHgwMCwgLy8gMS4wIHZvbHVtZVxuICAgICAgICAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDQwLCAweDAwLCAweDAwLCAweDAwLCAvLyB0cmFuc2Zvcm1hdGlvbjogdW5pdHkgbWF0cml4XG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAgIDB4ZmYsIDB4ZmYsIDB4ZmYsIDB4ZmYgLy8gbmV4dF90cmFja19JRFxuICAgICAgXSk7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm12aGQsIGJ5dGVzKTtcbiAgfVxuXG4gIHN0YXRpYyBzZHRwKHRyYWNrKSB7XG4gICAgdmFyXG4gICAgICBzYW1wbGVzID0gdHJhY2suc2FtcGxlcyB8fCBbXSxcbiAgICAgIGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkoNCArIHNhbXBsZXMubGVuZ3RoKSxcbiAgICAgIGZsYWdzLFxuICAgICAgaTtcbiAgICAvLyBsZWF2ZSB0aGUgZnVsbCBib3ggaGVhZGVyICg0IGJ5dGVzKSBhbGwgemVyb1xuICAgIC8vIHdyaXRlIHRoZSBzYW1wbGUgdGFibGVcbiAgICBmb3IgKGkgPSAwOyBpIDwgc2FtcGxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgZmxhZ3MgPSBzYW1wbGVzW2ldLmZsYWdzO1xuICAgICAgYnl0ZXNbaSArIDRdID0gKGZsYWdzLmRlcGVuZHNPbiA8PCA0KSB8XG4gICAgICAgIChmbGFncy5pc0RlcGVuZGVkT24gPDwgMikgfFxuICAgICAgICAoZmxhZ3MuaGFzUmVkdW5kYW5jeSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnNkdHAsIGJ5dGVzKTtcbiAgfVxuXG4gIHN0YXRpYyBzdGJsKHRyYWNrKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnN0YmwsIE1QNC5zdHNkKHRyYWNrKSwgTVA0LmJveChNUDQudHlwZXMuc3R0cywgTVA0LlNUVFMpLCBNUDQuYm94KE1QNC50eXBlcy5zdHNjLCBNUDQuU1RTQyksIE1QNC5ib3goTVA0LnR5cGVzLnN0c3osIE1QNC5TVFNaKSwgTVA0LmJveChNUDQudHlwZXMuc3RjbywgTVA0LlNUQ08pKTtcbiAgfVxuXG4gIHN0YXRpYyBhdmMxKHRyYWNrKSB7XG4gICAgdmFyIHNwcyA9IFtdLCBwcHMgPSBbXSwgaSwgZGF0YSwgbGVuO1xuICAgIC8vIGFzc2VtYmxlIHRoZSBTUFNzXG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgdHJhY2suc3BzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBkYXRhID0gdHJhY2suc3BzW2ldO1xuICAgICAgbGVuID0gZGF0YS5ieXRlTGVuZ3RoO1xuICAgICAgc3BzLnB1c2goKGxlbiA+Pj4gOCkgJiAweEZGKTtcbiAgICAgIHNwcy5wdXNoKChsZW4gJiAweEZGKSk7XG4gICAgICBzcHMgPSBzcHMuY29uY2F0KEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGRhdGEpKTsgLy8gU1BTXG4gICAgfVxuXG4gICAgLy8gYXNzZW1ibGUgdGhlIFBQU3NcbiAgICBmb3IgKGkgPSAwOyBpIDwgdHJhY2sucHBzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBkYXRhID0gdHJhY2sucHBzW2ldO1xuICAgICAgbGVuID0gZGF0YS5ieXRlTGVuZ3RoO1xuICAgICAgcHBzLnB1c2goKGxlbiA+Pj4gOCkgJiAweEZGKTtcbiAgICAgIHBwcy5wdXNoKChsZW4gJiAweEZGKSk7XG4gICAgICBwcHMgPSBwcHMuY29uY2F0KEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGRhdGEpKTtcbiAgICB9XG5cbiAgICB2YXIgYXZjYyA9IE1QNC5ib3goTVA0LnR5cGVzLmF2Y0MsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgICAgIDB4MDEsICAgLy8gdmVyc2lvblxuICAgICAgICAgICAgc3BzWzNdLCAvLyBwcm9maWxlXG4gICAgICAgICAgICBzcHNbNF0sIC8vIHByb2ZpbGUgY29tcGF0XG4gICAgICAgICAgICBzcHNbNV0sIC8vIGxldmVsXG4gICAgICAgICAgICAweGZjIHwgMywgLy8gbGVuZ3RoU2l6ZU1pbnVzT25lLCBoYXJkLWNvZGVkIHRvIDQgYnl0ZXNcbiAgICAgICAgICAgIDB4RTAgfCB0cmFjay5zcHMubGVuZ3RoIC8vIDNiaXQgcmVzZXJ2ZWQgKDExMSkgKyBudW1PZlNlcXVlbmNlUGFyYW1ldGVyU2V0c1xuICAgICAgICAgIF0uY29uY2F0KHNwcykuY29uY2F0KFtcbiAgICAgICAgICAgIHRyYWNrLnBwcy5sZW5ndGggLy8gbnVtT2ZQaWN0dXJlUGFyYW1ldGVyU2V0c1xuICAgICAgICAgIF0pLmNvbmNhdChwcHMpKSk7IC8vIFwiUFBTXCJcbiAgICAvL2NvbnNvbGUubG9nKCdhdmNjOicgKyBIZXguaGV4RHVtcChhdmNjKSk7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLmF2YzEsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMSwgLy8gZGF0YV9yZWZlcmVuY2VfaW5kZXhcbiAgICAgICAgMHgwMCwgMHgwMCwgLy8gcHJlX2RlZmluZWRcbiAgICAgICAgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcHJlX2RlZmluZWRcbiAgICAgICAgKHRyYWNrLndpZHRoID4+IDgpICYgMHhGRixcbiAgICAgICAgdHJhY2sud2lkdGggJiAweGZmLCAvLyB3aWR0aFxuICAgICAgICAodHJhY2suaGVpZ2h0ID4+IDgpICYgMHhGRixcbiAgICAgICAgdHJhY2suaGVpZ2h0ICYgMHhmZiwgLy8gaGVpZ2h0XG4gICAgICAgIDB4MDAsIDB4NDgsIDB4MDAsIDB4MDAsIC8vIGhvcml6cmVzb2x1dGlvblxuICAgICAgICAweDAwLCAweDQ4LCAweDAwLCAweDAwLCAvLyB2ZXJ0cmVzb2x1dGlvblxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAxLCAvLyBmcmFtZV9jb3VudFxuICAgICAgICAweDEzLFxuICAgICAgICAweDc2LCAweDY5LCAweDY0LCAweDY1LFxuICAgICAgICAweDZmLCAweDZhLCAweDczLCAweDJkLFxuICAgICAgICAweDYzLCAweDZmLCAweDZlLCAweDc0LFxuICAgICAgICAweDcyLCAweDY5LCAweDYyLCAweDJkLFxuICAgICAgICAweDY4LCAweDZjLCAweDczLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBjb21wcmVzc29ybmFtZVxuICAgICAgICAweDAwLCAweDE4LCAvLyBkZXB0aCA9IDI0XG4gICAgICAgIDB4MTEsIDB4MTFdKSwgLy8gcHJlX2RlZmluZWQgPSAtMVxuICAgICAgICAgIGF2Y2MsXG4gICAgICAgICAgTVA0LmJveChNUDQudHlwZXMuYnRydCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAgICAgMHgwMCwgMHgxYywgMHg5YywgMHg4MCwgLy8gYnVmZmVyU2l6ZURCXG4gICAgICAgICAgICAweDAwLCAweDJkLCAweGM2LCAweGMwLCAvLyBtYXhCaXRyYXRlXG4gICAgICAgICAgICAweDAwLCAweDJkLCAweGM2LCAweGMwXSkpIC8vIGF2Z0JpdHJhdGVcbiAgICAgICAgICApO1xuICB9XG5cbiAgc3RhdGljIGVzZHModHJhY2spIHtcbiAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuXG4gICAgICAweDAzLCAvLyBkZXNjcmlwdG9yX3R5cGVcbiAgICAgIDB4MTcrdHJhY2suY29uZmlnLmxlbmd0aCwgLy8gbGVuZ3RoXG4gICAgICAweDAwLCAweDAxLCAvL2VzX2lkXG4gICAgICAweDAwLCAvLyBzdHJlYW1fcHJpb3JpdHlcblxuICAgICAgMHgwNCwgLy8gZGVzY3JpcHRvcl90eXBlXG4gICAgICAweDBmK3RyYWNrLmNvbmZpZy5sZW5ndGgsIC8vIGxlbmd0aFxuICAgICAgMHg0MCwgLy9jb2RlYyA6IG1wZWc0X2F1ZGlvXG4gICAgICAweDE1LCAvLyBzdHJlYW1fdHlwZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gYnVmZmVyX3NpemVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIG1heEJpdHJhdGVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGF2Z0JpdHJhdGVcblxuICAgICAgMHgwNSAvLyBkZXNjcmlwdG9yX3R5cGVcbiAgICAgIF0uY29uY2F0KFt0cmFjay5jb25maWcubGVuZ3RoXSkuY29uY2F0KHRyYWNrLmNvbmZpZykuY29uY2F0KFsweDA2LCAweDAxLCAweDAyXSkpOyAvLyBHQVNwZWNpZmljQ29uZmlnKSk7IC8vIGxlbmd0aCArIGF1ZGlvIGNvbmZpZyBkZXNjcmlwdG9yXG4gIH1cblxuICBzdGF0aWMgbXA0YSh0cmFjaykge1xuICAgICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubXA0YSwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAxLCAvLyBkYXRhX3JlZmVyZW5jZV9pbmRleFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCB0cmFjay5jaGFubmVsQ291bnQsIC8vIGNoYW5uZWxjb3VudFxuICAgICAgICAweDAwLCAweDEwLCAvLyBzYW1wbGVTaXplOjE2Yml0c1xuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZDJcbiAgICAgICAgKHRyYWNrLmF1ZGlvc2FtcGxlcmF0ZSA+PiA4KSAmIDB4RkYsXG4gICAgICAgIHRyYWNrLmF1ZGlvc2FtcGxlcmF0ZSAmIDB4ZmYsIC8vXG4gICAgICAgIDB4MDAsIDB4MDBdKSxcbiAgICAgICAgTVA0LmJveChNUDQudHlwZXMuZXNkcywgTVA0LmVzZHModHJhY2spKSk7XG4gIH1cblxuICBzdGF0aWMgc3RzZCh0cmFjaykge1xuICAgIGlmICh0cmFjay50eXBlID09PSAnYXVkaW8nKSB7XG4gICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuc3RzZCwgTVA0LlNUU0QsIE1QNC5tcDRhKHRyYWNrKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5zdHNkLCBNUDQuU1RTRCwgTVA0LmF2YzEodHJhY2spKTtcbiAgICB9XG4gIH1cblxuICBzdGF0aWMgdGtoZCh0cmFjaykge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50a2hkLCBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDcsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBjcmVhdGlvbl90aW1lXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBtb2RpZmljYXRpb25fdGltZVxuICAgICAgKHRyYWNrLmlkID4+IDI0KSAmIDB4RkYsXG4gICAgICAodHJhY2suaWQgPj4gMTYpICYgMHhGRixcbiAgICAgICh0cmFjay5pZCA+PiA4KSAmIDB4RkYsXG4gICAgICB0cmFjay5pZCAmIDB4RkYsIC8vIHRyYWNrX0lEXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgKHRyYWNrLmR1cmF0aW9uID4+IDI0KSxcbiAgICAgICh0cmFjay5kdXJhdGlvbiA+PiAxNikgJiAweEZGLFxuICAgICAgKHRyYWNrLmR1cmF0aW9uID4+ICA4KSAmIDB4RkYsXG4gICAgICB0cmFjay5kdXJhdGlvbiAmIDB4RkYsIC8vIGR1cmF0aW9uXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIC8vIGxheWVyXG4gICAgICAweDAwLCAweDAwLCAvLyBhbHRlcm5hdGVfZ3JvdXBcbiAgICAgIDB4MDAsIDB4MDAsIC8vIG5vbi1hdWRpbyB0cmFjayB2b2x1bWVcbiAgICAgIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4NDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHRyYW5zZm9ybWF0aW9uOiB1bml0eSBtYXRyaXhcbiAgICAgICh0cmFjay53aWR0aCA+PiA4KSAmIDB4RkYsXG4gICAgICB0cmFjay53aWR0aCAmIDB4RkYsXG4gICAgICAweDAwLCAweDAwLCAvLyB3aWR0aFxuICAgICAgKHRyYWNrLmhlaWdodCA+PiA4KSAmIDB4RkYsXG4gICAgICB0cmFjay5oZWlnaHQgJiAweEZGLFxuICAgICAgMHgwMCwgMHgwMCAvLyBoZWlnaHRcbiAgICBdKSk7XG4gIH1cblxuICBzdGF0aWMgdHJhZih0cmFjayxiYXNlTWVkaWFEZWNvZGVUaW1lKSB7XG4gICAgdmFyIHNhbXBsZURlcGVuZGVuY3lUYWJsZSA9IE1QNC5zZHRwKHRyYWNrKTtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudHJhZixcbiAgICAgICAgICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLnRmaGQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgICAgICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAgICAgICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAgICAgICAgICAgICh0cmFjay5pZCA+PiAyNCksXG4gICAgICAgICAgICAgICAgICh0cmFjay5pZCA+PiAxNikgJiAwWEZGLFxuICAgICAgICAgICAgICAgICAodHJhY2suaWQgPj4gOCkgJiAwWEZGLFxuICAgICAgICAgICAgICAgICAodHJhY2suaWQgJiAweEZGKSAvLyB0cmFja19JRFxuICAgICAgICAgICAgICAgXSkpLFxuICAgICAgICAgICAgICAgTVA0LmJveChNUDQudHlwZXMudGZkdCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAgICAgICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgICAgICAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgICAgICAgICAgICAgKGJhc2VNZWRpYURlY29kZVRpbWUgPj4yNCksXG4gICAgICAgICAgICAgICAgIChiYXNlTWVkaWFEZWNvZGVUaW1lID4+IDE2KSAmIDBYRkYsXG4gICAgICAgICAgICAgICAgIChiYXNlTWVkaWFEZWNvZGVUaW1lID4+IDgpICYgMFhGRixcbiAgICAgICAgICAgICAgICAgKGJhc2VNZWRpYURlY29kZVRpbWUgJiAweEZGKSAvLyBiYXNlTWVkaWFEZWNvZGVUaW1lXG4gICAgICAgICAgICAgICBdKSksXG4gICAgICAgICAgICAgICBNUDQudHJ1bih0cmFjayxcbiAgICAgICAgICAgICAgICAgICAgc2FtcGxlRGVwZW5kZW5jeVRhYmxlLmxlbmd0aCArXG4gICAgICAgICAgICAgICAgICAgIDE2ICsgLy8gdGZoZFxuICAgICAgICAgICAgICAgICAgICAxNiArIC8vIHRmZHRcbiAgICAgICAgICAgICAgICAgICAgOCArICAvLyB0cmFmIGhlYWRlclxuICAgICAgICAgICAgICAgICAgICAxNiArIC8vIG1maGRcbiAgICAgICAgICAgICAgICAgICAgOCArICAvLyBtb29mIGhlYWRlclxuICAgICAgICAgICAgICAgICAgICA4KSwgIC8vIG1kYXQgaGVhZGVyXG4gICAgICAgICAgICAgICBzYW1wbGVEZXBlbmRlbmN5VGFibGUpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdlbmVyYXRlIGEgdHJhY2sgYm94LlxuICAgKiBAcGFyYW0gdHJhY2sge29iamVjdH0gYSB0cmFjayBkZWZpbml0aW9uXG4gICAqIEByZXR1cm4ge1VpbnQ4QXJyYXl9IHRoZSB0cmFjayBib3hcbiAgICovXG4gIHN0YXRpYyB0cmFrKHRyYWNrKSB7XG4gICAgdHJhY2suZHVyYXRpb24gPSB0cmFjay5kdXJhdGlvbiB8fCAweGZmZmZmZmZmO1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50cmFrLCBNUDQudGtoZCh0cmFjayksIE1QNC5tZGlhKHRyYWNrKSk7XG4gIH1cblxuICBzdGF0aWMgdHJleCh0cmFjaykge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50cmV4LCBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICh0cmFjay5pZCA+PiAyNCksXG4gICAgICh0cmFjay5pZCA+PiAxNikgJiAwWEZGLFxuICAgICAodHJhY2suaWQgPj4gOCkgJiAwWEZGLFxuICAgICAodHJhY2suaWQgJiAweEZGKSwgLy8gdHJhY2tfSURcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDEsIC8vIGRlZmF1bHRfc2FtcGxlX2Rlc2NyaXB0aW9uX2luZGV4XG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBkZWZhdWx0X3NhbXBsZV9kdXJhdGlvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZGVmYXVsdF9zYW1wbGVfc2l6ZVxuICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMSAvLyBkZWZhdWx0X3NhbXBsZV9mbGFnc1xuICAgIF0pKTtcbiAgfVxuXG4gIHN0YXRpYyB0cnVuKHRyYWNrLCBvZmZzZXQpIHtcbiAgICB2YXIgc2FtcGxlcywgc2FtcGxlLCBpLCBhcnJheTtcbiAgICBzYW1wbGVzID0gdHJhY2suc2FtcGxlcyB8fCBbXTtcbiAgICBhcnJheSA9IG5ldyBVaW50OEFycmF5KDEyICsgKDE2ICogc2FtcGxlcy5sZW5ndGgpKTtcbiAgICBvZmZzZXQgKz0gOCArIGFycmF5LmJ5dGVMZW5ndGg7XG4gICAgYXJyYXkuc2V0KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwZiwgMHgwMSwgLy8gZmxhZ3NcbiAgICAgIChzYW1wbGVzLmxlbmd0aCA+Pj4gMjQpICYgMHhGRixcbiAgICAgIChzYW1wbGVzLmxlbmd0aCA+Pj4gMTYpICYgMHhGRixcbiAgICAgIChzYW1wbGVzLmxlbmd0aCA+Pj4gOCkgJiAweEZGLFxuICAgICAgc2FtcGxlcy5sZW5ndGggJiAweEZGLCAvLyBzYW1wbGVfY291bnRcbiAgICAgIChvZmZzZXQgPj4+IDI0KSAmIDB4RkYsXG4gICAgICAob2Zmc2V0ID4+PiAxNikgJiAweEZGLFxuICAgICAgKG9mZnNldCA+Pj4gOCkgJiAweEZGLFxuICAgICAgb2Zmc2V0ICYgMHhGRiAvLyBkYXRhX29mZnNldFxuICAgIF0sMCk7XG4gICAgZm9yIChpID0gMDsgaSA8IHNhbXBsZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHNhbXBsZSA9IHNhbXBsZXNbaV07XG4gICAgICBhcnJheS5zZXQoW1xuICAgICAgICAoc2FtcGxlLmR1cmF0aW9uID4+PiAyNCkgJiAweEZGLFxuICAgICAgICAoc2FtcGxlLmR1cmF0aW9uID4+PiAxNikgJiAweEZGLFxuICAgICAgICAoc2FtcGxlLmR1cmF0aW9uID4+PiA4KSAmIDB4RkYsXG4gICAgICAgIHNhbXBsZS5kdXJhdGlvbiAmIDB4RkYsIC8vIHNhbXBsZV9kdXJhdGlvblxuICAgICAgICAoc2FtcGxlLnNpemUgPj4+IDI0KSAmIDB4RkYsXG4gICAgICAgIChzYW1wbGUuc2l6ZSA+Pj4gMTYpICYgMHhGRixcbiAgICAgICAgKHNhbXBsZS5zaXplID4+PiA4KSAmIDB4RkYsXG4gICAgICAgIHNhbXBsZS5zaXplICYgMHhGRiwgLy8gc2FtcGxlX3NpemVcbiAgICAgICAgKHNhbXBsZS5mbGFncy5pc0xlYWRpbmcgPDwgMikgfCBzYW1wbGUuZmxhZ3MuZGVwZW5kc09uLFxuICAgICAgICAoc2FtcGxlLmZsYWdzLmlzRGVwZW5kZWRPbiA8PCA2KSB8XG4gICAgICAgICAgKHNhbXBsZS5mbGFncy5oYXNSZWR1bmRhbmN5IDw8IDQpIHxcbiAgICAgICAgICAoc2FtcGxlLmZsYWdzLnBhZGRpbmdWYWx1ZSA8PCAxKSB8XG4gICAgICAgICAgc2FtcGxlLmZsYWdzLmlzTm9uU3luYyxcbiAgICAgICAgc2FtcGxlLmZsYWdzLmRlZ3JhZFByaW8gJiAweEYwIDw8IDgsXG4gICAgICAgIHNhbXBsZS5mbGFncy5kZWdyYWRQcmlvICYgMHgwRiwgLy8gc2FtcGxlX2ZsYWdzXG4gICAgICAgIChzYW1wbGUuY3RzID4+PiAyNCkgJiAweEZGLFxuICAgICAgICAoc2FtcGxlLmN0cyA+Pj4gMTYpICYgMHhGRixcbiAgICAgICAgKHNhbXBsZS5jdHMgPj4+IDgpICYgMHhGRixcbiAgICAgICAgc2FtcGxlLmN0cyAmIDB4RkYgLy8gc2FtcGxlX2NvbXBvc2l0aW9uX3RpbWVfb2Zmc2V0XG4gICAgICBdLDEyKzE2KmkpO1xuICAgIH1cbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudHJ1biwgYXJyYXkpO1xuICB9XG5cbiAgc3RhdGljIGluaXRTZWdtZW50KHRyYWNrcykge1xuICAgIGlmICghTVA0LnR5cGVzKSB7XG4gICAgICBNUDQuaW5pdCgpO1xuICAgIH1cbiAgICB2YXIgbW92aWUgPSBNUDQubW9vdih0cmFja3MpLCByZXN1bHQ7XG4gICAgcmVzdWx0ID0gbmV3IFVpbnQ4QXJyYXkoTVA0LkZUWVAuYnl0ZUxlbmd0aCArIG1vdmllLmJ5dGVMZW5ndGgpO1xuICAgIHJlc3VsdC5zZXQoTVA0LkZUWVApO1xuICAgIHJlc3VsdC5zZXQobW92aWUsIE1QNC5GVFlQLmJ5dGVMZW5ndGgpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTVA0O1xuIiwiLyoqXG4gKiBmTVA0IHJlbXV4ZXJcbiovXG5cblxuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCBNUDQgZnJvbSAnLi4vcmVtdXgvbXA0LWdlbmVyYXRvcic7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcblxuY2xhc3MgTVA0UmVtdXhlciB7XG4gIGNvbnN0cnVjdG9yKG9ic2VydmVyKSB7XG4gICAgdGhpcy5vYnNlcnZlciA9IG9ic2VydmVyO1xuICAgIHRoaXMuSVNHZW5lcmF0ZWQgPSBmYWxzZTtcbiAgICB0aGlzLlBFUzJNUDRTQ0FMRUZBQ1RPUiA9IDQ7XG4gICAgdGhpcy5QRVNfVElNRVNDQUxFID0gOTAwMDA7XG4gICAgdGhpcy5NUDRfVElNRVNDQUxFID0gdGhpcy5QRVNfVElNRVNDQUxFIC8gdGhpcy5QRVMyTVA0U0NBTEVGQUNUT1I7XG4gIH1cblxuICBnZXQgdGltZXNjYWxlKCkge1xuICAgIHJldHVybiB0aGlzLk1QNF9USU1FU0NBTEU7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICB9XG5cbiAgaW5zZXJ0RGlzY29udGludWl0eSgpIHtcbiAgICB0aGlzLl9pbml0UFRTID0gdGhpcy5faW5pdERUUyA9IHRoaXMubmV4dEFhY1B0cyA9IHRoaXMubmV4dEF2Y0R0cyA9IHVuZGVmaW5lZDtcbiAgfVxuXG4gIHN3aXRjaExldmVsKCkge1xuICAgIHRoaXMuSVNHZW5lcmF0ZWQgPSBmYWxzZTtcbiAgfVxuXG4gIHJlbXV4KGF1ZGlvVHJhY2ssdmlkZW9UcmFjayxpZDNUcmFjayx0aW1lT2Zmc2V0LCBjb250aWd1b3VzKSB7XG4gICAgLy8gZ2VuZXJhdGUgSW5pdCBTZWdtZW50IGlmIG5lZWRlZFxuICAgIGlmICghdGhpcy5JU0dlbmVyYXRlZCkge1xuICAgICAgdGhpcy5nZW5lcmF0ZUlTKGF1ZGlvVHJhY2ssdmlkZW9UcmFjayx0aW1lT2Zmc2V0KTtcbiAgICB9XG4gICAgLy9sb2dnZXIubG9nKCduYiBBVkMgc2FtcGxlczonICsgdmlkZW9UcmFjay5zYW1wbGVzLmxlbmd0aCk7XG4gICAgaWYgKHZpZGVvVHJhY2suc2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgIHRoaXMucmVtdXhWaWRlbyh2aWRlb1RyYWNrLHRpbWVPZmZzZXQsY29udGlndW91cyk7XG4gICAgfVxuICAgIC8vbG9nZ2VyLmxvZygnbmIgQUFDIHNhbXBsZXM6JyArIGF1ZGlvVHJhY2suc2FtcGxlcy5sZW5ndGgpO1xuICAgIGlmIChhdWRpb1RyYWNrLnNhbXBsZXMubGVuZ3RoKSB7XG4gICAgICB0aGlzLnJlbXV4QXVkaW8oYXVkaW9UcmFjayx0aW1lT2Zmc2V0LGNvbnRpZ3VvdXMpO1xuICAgIH1cbiAgICAvL2xvZ2dlci5sb2coJ25iIElEMyBzYW1wbGVzOicgKyBhdWRpb1RyYWNrLnNhbXBsZXMubGVuZ3RoKTtcbiAgICBpZiAoaWQzVHJhY2suc2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgIHRoaXMucmVtdXhJRDMoaWQzVHJhY2ssdGltZU9mZnNldCk7XG4gICAgfVxuICAgIC8vbm90aWZ5IGVuZCBvZiBwYXJzaW5nXG4gICAgdGhpcy5vYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0VEKTtcbiAgfVxuXG4gIGdlbmVyYXRlSVMoYXVkaW9UcmFjayx2aWRlb1RyYWNrLHRpbWVPZmZzZXQpIHtcbiAgICB2YXIgb2JzZXJ2ZXIgPSB0aGlzLm9ic2VydmVyLFxuICAgICAgICBhdWRpb1NhbXBsZXMgPSBhdWRpb1RyYWNrLnNhbXBsZXMsXG4gICAgICAgIHZpZGVvU2FtcGxlcyA9IHZpZGVvVHJhY2suc2FtcGxlcyxcbiAgICAgICAgbmJBdWRpbyA9IGF1ZGlvU2FtcGxlcy5sZW5ndGgsXG4gICAgICAgIG5iVmlkZW8gPSB2aWRlb1NhbXBsZXMubGVuZ3RoLFxuICAgICAgICBwZXNUaW1lU2NhbGUgPSB0aGlzLlBFU19USU1FU0NBTEU7XG5cbiAgICBpZihuYkF1ZGlvID09PSAwICYmIG5iVmlkZW8gPT09IDApIHtcbiAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlIDogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkZSQUdfUEFSU0lOR19FUlJPUiwgZmF0YWw6IGZhbHNlLCByZWFzb246ICdubyBhdWRpby92aWRlbyBzYW1wbGVzIGZvdW5kJ30pO1xuICAgIH0gZWxzZSBpZiAobmJWaWRlbyA9PT0gMCkge1xuICAgICAgLy9hdWRpbyBvbmx5XG4gICAgICBpZiAoYXVkaW9UcmFjay5jb25maWcpIHtcbiAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCwge1xuICAgICAgICAgIGF1ZGlvTW9vdjogTVA0LmluaXRTZWdtZW50KFthdWRpb1RyYWNrXSksXG4gICAgICAgICAgYXVkaW9Db2RlYyA6IGF1ZGlvVHJhY2suY29kZWMsXG4gICAgICAgICAgYXVkaW9DaGFubmVsQ291bnQgOiBhdWRpb1RyYWNrLmNoYW5uZWxDb3VudFxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5JU0dlbmVyYXRlZCA9IHRydWU7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5faW5pdFBUUyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIC8vIHJlbWVtYmVyIGZpcnN0IFBUUyBvZiB0aGlzIGRlbXV4aW5nIGNvbnRleHRcbiAgICAgICAgdGhpcy5faW5pdFBUUyA9IGF1ZGlvU2FtcGxlc1swXS5wdHMgLSBwZXNUaW1lU2NhbGUgKiB0aW1lT2Zmc2V0O1xuICAgICAgICB0aGlzLl9pbml0RFRTID0gYXVkaW9TYW1wbGVzWzBdLmR0cyAtIHBlc1RpbWVTY2FsZSAqIHRpbWVPZmZzZXQ7XG4gICAgICB9XG4gICAgfSBlbHNlXG4gICAgaWYgKG5iQXVkaW8gPT09IDApIHtcbiAgICAgIC8vdmlkZW8gb25seVxuICAgICAgaWYgKHZpZGVvVHJhY2suc3BzICYmIHZpZGVvVHJhY2sucHBzKSB7XG4gICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQsIHtcbiAgICAgICAgICB2aWRlb01vb3Y6IE1QNC5pbml0U2VnbWVudChbdmlkZW9UcmFja10pLFxuICAgICAgICAgIHZpZGVvQ29kZWM6IHZpZGVvVHJhY2suY29kZWMsXG4gICAgICAgICAgdmlkZW9XaWR0aDogdmlkZW9UcmFjay53aWR0aCxcbiAgICAgICAgICB2aWRlb0hlaWdodDogdmlkZW9UcmFjay5oZWlnaHRcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuSVNHZW5lcmF0ZWQgPSB0cnVlO1xuICAgICAgICBpZiAodGhpcy5faW5pdFBUUyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgLy8gcmVtZW1iZXIgZmlyc3QgUFRTIG9mIHRoaXMgZGVtdXhpbmcgY29udGV4dFxuICAgICAgICAgIHRoaXMuX2luaXRQVFMgPSB2aWRlb1NhbXBsZXNbMF0ucHRzIC0gcGVzVGltZVNjYWxlICogdGltZU9mZnNldDtcbiAgICAgICAgICB0aGlzLl9pbml0RFRTID0gdmlkZW9TYW1wbGVzWzBdLmR0cyAtIHBlc1RpbWVTY2FsZSAqIHRpbWVPZmZzZXQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy9hdWRpbyBhbmQgdmlkZW9cbiAgICAgIGlmIChhdWRpb1RyYWNrLmNvbmZpZyAmJiB2aWRlb1RyYWNrLnNwcyAmJiB2aWRlb1RyYWNrLnBwcykge1xuICAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCwge1xuICAgICAgICAgIGF1ZGlvTW9vdjogTVA0LmluaXRTZWdtZW50KFthdWRpb1RyYWNrXSksXG4gICAgICAgICAgYXVkaW9Db2RlYzogYXVkaW9UcmFjay5jb2RlYyxcbiAgICAgICAgICBhdWRpb0NoYW5uZWxDb3VudDogYXVkaW9UcmFjay5jaGFubmVsQ291bnQsXG4gICAgICAgICAgdmlkZW9Nb292OiBNUDQuaW5pdFNlZ21lbnQoW3ZpZGVvVHJhY2tdKSxcbiAgICAgICAgICB2aWRlb0NvZGVjOiB2aWRlb1RyYWNrLmNvZGVjLFxuICAgICAgICAgIHZpZGVvV2lkdGg6IHZpZGVvVHJhY2sud2lkdGgsXG4gICAgICAgICAgdmlkZW9IZWlnaHQ6IHZpZGVvVHJhY2suaGVpZ2h0XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLklTR2VuZXJhdGVkID0gdHJ1ZTtcbiAgICAgICAgaWYgKHRoaXMuX2luaXRQVFMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIC8vIHJlbWVtYmVyIGZpcnN0IFBUUyBvZiB0aGlzIGRlbXV4aW5nIGNvbnRleHRcbiAgICAgICAgICB0aGlzLl9pbml0UFRTID0gTWF0aC5taW4odmlkZW9TYW1wbGVzWzBdLnB0cywgYXVkaW9TYW1wbGVzWzBdLnB0cykgLSBwZXNUaW1lU2NhbGUgKiB0aW1lT2Zmc2V0O1xuICAgICAgICAgIHRoaXMuX2luaXREVFMgPSBNYXRoLm1pbih2aWRlb1NhbXBsZXNbMF0uZHRzLCBhdWRpb1NhbXBsZXNbMF0uZHRzKSAtIHBlc1RpbWVTY2FsZSAqIHRpbWVPZmZzZXQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZW11eFZpZGVvKHRyYWNrLCB0aW1lT2Zmc2V0LCBjb250aWd1b3VzKSB7XG4gICAgdmFyIHZpZXcsXG4gICAgICAgIGkgPSA4LFxuICAgICAgICBwZXNUaW1lU2NhbGUgPSB0aGlzLlBFU19USU1FU0NBTEUsXG4gICAgICAgIHBlczJtcDRTY2FsZUZhY3RvciA9IHRoaXMuUEVTMk1QNFNDQUxFRkFDVE9SLFxuICAgICAgICBhdmNTYW1wbGUsXG4gICAgICAgIG1wNFNhbXBsZSxcbiAgICAgICAgbXA0U2FtcGxlTGVuZ3RoLFxuICAgICAgICB1bml0LFxuICAgICAgICBtZGF0LCBtb29mLFxuICAgICAgICBmaXJzdFBUUywgZmlyc3REVFMsIGxhc3REVFMsXG4gICAgICAgIHB0cywgZHRzLCBwdHNub3JtLCBkdHNub3JtLFxuICAgICAgICBzYW1wbGVzID0gW107XG4gICAgLyogY29uY2F0ZW5hdGUgdGhlIHZpZGVvIGRhdGEgYW5kIGNvbnN0cnVjdCB0aGUgbWRhdCBpbiBwbGFjZVxuICAgICAgKG5lZWQgOCBtb3JlIGJ5dGVzIHRvIGZpbGwgbGVuZ3RoIGFuZCBtcGRhdCB0eXBlKSAqL1xuICAgIG1kYXQgPSBuZXcgVWludDhBcnJheSh0cmFjay5sZW4gKyAoNCAqIHRyYWNrLm5iTmFsdSkgKyA4KTtcbiAgICB2aWV3ID0gbmV3IERhdGFWaWV3KG1kYXQuYnVmZmVyKTtcbiAgICB2aWV3LnNldFVpbnQzMigwLCBtZGF0LmJ5dGVMZW5ndGgpO1xuICAgIG1kYXQuc2V0KE1QNC50eXBlcy5tZGF0LCA0KTtcbiAgICB3aGlsZSAodHJhY2suc2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgIGF2Y1NhbXBsZSA9IHRyYWNrLnNhbXBsZXMuc2hpZnQoKTtcbiAgICAgIG1wNFNhbXBsZUxlbmd0aCA9IDA7XG4gICAgICAvLyBjb252ZXJ0IE5BTFUgYml0c3RyZWFtIHRvIE1QNCBmb3JtYXQgKHByZXBlbmQgTkFMVSB3aXRoIHNpemUgZmllbGQpXG4gICAgICB3aGlsZSAoYXZjU2FtcGxlLnVuaXRzLnVuaXRzLmxlbmd0aCkge1xuICAgICAgICB1bml0ID0gYXZjU2FtcGxlLnVuaXRzLnVuaXRzLnNoaWZ0KCk7XG4gICAgICAgIHZpZXcuc2V0VWludDMyKGksIHVuaXQuZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICAgICAgaSArPSA0O1xuICAgICAgICBtZGF0LnNldCh1bml0LmRhdGEsIGkpO1xuICAgICAgICBpICs9IHVuaXQuZGF0YS5ieXRlTGVuZ3RoO1xuICAgICAgICBtcDRTYW1wbGVMZW5ndGggKz0gNCArIHVuaXQuZGF0YS5ieXRlTGVuZ3RoO1xuICAgICAgfVxuICAgICAgcHRzID0gYXZjU2FtcGxlLnB0cyAtIHRoaXMuX2luaXREVFM7XG4gICAgICBkdHMgPSBhdmNTYW1wbGUuZHRzIC0gdGhpcy5faW5pdERUUztcbiAgICAgIC8vbG9nZ2VyLmxvZygnVmlkZW8vUFRTL0RUUzonICsgcHRzICsgJy8nICsgZHRzKTtcbiAgICAgIC8vIGlmIG5vdCBmaXJzdCBBVkMgc2FtcGxlIG9mIHZpZGVvIHRyYWNrLCBub3JtYWxpemUgUFRTL0RUUyB3aXRoIHByZXZpb3VzIHNhbXBsZSB2YWx1ZVxuICAgICAgLy8gYW5kIGVuc3VyZSB0aGF0IHNhbXBsZSBkdXJhdGlvbiBpcyBwb3NpdGl2ZVxuICAgICAgaWYgKGxhc3REVFMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBwdHNub3JtID0gdGhpcy5fUFRTTm9ybWFsaXplKHB0cywgbGFzdERUUyk7XG4gICAgICAgIGR0c25vcm0gPSB0aGlzLl9QVFNOb3JtYWxpemUoZHRzLCBsYXN0RFRTKTtcbiAgICAgICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gKGR0c25vcm0gLSBsYXN0RFRTKSAvIHBlczJtcDRTY2FsZUZhY3RvcjtcbiAgICAgICAgaWYgKG1wNFNhbXBsZS5kdXJhdGlvbiA8IDApIHtcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ2ludmFsaWQgc2FtcGxlIGR1cmF0aW9uIGF0IFBUUy9EVFM6OicgKyBhdmNTYW1wbGUucHRzICsgJy8nICsgYXZjU2FtcGxlLmR0cyArICc6JyArIG1wNFNhbXBsZS5kdXJhdGlvbik7XG4gICAgICAgICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIG5leHRBdmNEdHMgPSB0aGlzLm5leHRBdmNEdHMsZGVsdGE7XG4gICAgICAgIC8vIGZpcnN0IEFWQyBzYW1wbGUgb2YgdmlkZW8gdHJhY2ssIG5vcm1hbGl6ZSBQVFMvRFRTXG4gICAgICAgIHB0c25vcm0gPSB0aGlzLl9QVFNOb3JtYWxpemUocHRzLCBuZXh0QXZjRHRzKTtcbiAgICAgICAgZHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShkdHMsIG5leHRBdmNEdHMpO1xuICAgICAgICBkZWx0YSA9IE1hdGgucm91bmQoKGR0c25vcm0gLSBuZXh0QXZjRHRzKSAvIDkwKTtcbiAgICAgICAgLy8gaWYgZnJhZ21lbnQgYXJlIGNvbnRpZ3VvdXMsIG9yIGRlbHRhIGxlc3MgdGhhbiA2MDBtcywgZW5zdXJlIHRoZXJlIGlzIG5vIG92ZXJsYXAvaG9sZSBiZXR3ZWVuIGZyYWdtZW50c1xuICAgICAgICBpZiAoY29udGlndW91cyB8fCBNYXRoLmFicyhkZWx0YSkgPCA2MDApIHtcbiAgICAgICAgICBpZiAoZGVsdGEpIHtcbiAgICAgICAgICAgIGlmIChkZWx0YSA+IDEpIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgQVZDOiR7ZGVsdGF9IG1zIGhvbGUgYmV0d2VlbiBmcmFnbWVudHMgZGV0ZWN0ZWQsZmlsbGluZyBpdGApO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkZWx0YSA8IC0xKSB7XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coYEFWQzokeygtZGVsdGEpfSBtcyBvdmVybGFwcGluZyBiZXR3ZWVuIGZyYWdtZW50cyBkZXRlY3RlZGApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gc2V0IERUUyB0byBuZXh0IERUU1xuICAgICAgICAgICAgZHRzbm9ybSA9IG5leHRBdmNEdHM7XG4gICAgICAgICAgICAvLyBvZmZzZXQgUFRTIGFzIHdlbGwsIGVuc3VyZSB0aGF0IFBUUyBpcyBzbWFsbGVyIG9yIGVxdWFsIHRoYW4gbmV3IERUU1xuICAgICAgICAgICAgcHRzbm9ybSA9IE1hdGgubWF4KHB0c25vcm0gLSBkZWx0YSwgZHRzbm9ybSk7XG4gICAgICAgICAgICBsb2dnZXIubG9nKCdWaWRlby9QVFMvRFRTIGFkanVzdGVkOicgKyBwdHNub3JtICsgJy8nICsgZHRzbm9ybSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIHJlbWVtYmVyIGZpcnN0IFBUUyBvZiBvdXIgYXZjU2FtcGxlcywgZW5zdXJlIHZhbHVlIGlzIHBvc2l0aXZlXG4gICAgICAgIGZpcnN0UFRTID0gTWF0aC5tYXgoMCwgcHRzbm9ybSk7XG4gICAgICAgIGZpcnN0RFRTID0gTWF0aC5tYXgoMCwgZHRzbm9ybSk7XG4gICAgICB9XG4gICAgICAvL2NvbnNvbGUubG9nKCdQVFMvRFRTL2luaXREVFMvbm9ybVBUUy9ub3JtRFRTL3JlbGF0aXZlIFBUUyA6ICR7YXZjU2FtcGxlLnB0c30vJHthdmNTYW1wbGUuZHRzfS8ke3RoaXMuX2luaXREVFN9LyR7cHRzbm9ybX0vJHtkdHNub3JtfS8keyhhdmNTYW1wbGUucHRzLzQyOTQ5NjcyOTYpLnRvRml4ZWQoMyl9Jyk7XG4gICAgICBtcDRTYW1wbGUgPSB7XG4gICAgICAgIHNpemU6IG1wNFNhbXBsZUxlbmd0aCxcbiAgICAgICAgZHVyYXRpb246IDAsXG4gICAgICAgIGN0czogKHB0c25vcm0gLSBkdHNub3JtKSAvIHBlczJtcDRTY2FsZUZhY3RvcixcbiAgICAgICAgZmxhZ3M6IHtcbiAgICAgICAgICBpc0xlYWRpbmc6IDAsXG4gICAgICAgICAgaXNEZXBlbmRlZE9uOiAwLFxuICAgICAgICAgIGhhc1JlZHVuZGFuY3k6IDAsXG4gICAgICAgICAgZGVncmFkUHJpbzogMFxuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgaWYgKGF2Y1NhbXBsZS5rZXkgPT09IHRydWUpIHtcbiAgICAgICAgLy8gdGhlIGN1cnJlbnQgc2FtcGxlIGlzIGEga2V5IGZyYW1lXG4gICAgICAgIG1wNFNhbXBsZS5mbGFncy5kZXBlbmRzT24gPSAyO1xuICAgICAgICBtcDRTYW1wbGUuZmxhZ3MuaXNOb25TeW5jID0gMDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG1wNFNhbXBsZS5mbGFncy5kZXBlbmRzT24gPSAxO1xuICAgICAgICBtcDRTYW1wbGUuZmxhZ3MuaXNOb25TeW5jID0gMTtcbiAgICAgIH1cbiAgICAgIHNhbXBsZXMucHVzaChtcDRTYW1wbGUpO1xuICAgICAgbGFzdERUUyA9IGR0c25vcm07XG4gICAgfVxuICAgIGlmIChzYW1wbGVzLmxlbmd0aCA+PSAyKSB7XG4gICAgICBtcDRTYW1wbGUuZHVyYXRpb24gPSBzYW1wbGVzW3NhbXBsZXMubGVuZ3RoIC0gMl0uZHVyYXRpb247XG4gICAgfVxuICAgIC8vIG5leHQgQVZDIHNhbXBsZSBEVFMgc2hvdWxkIGJlIGVxdWFsIHRvIGxhc3Qgc2FtcGxlIERUUyArIGxhc3Qgc2FtcGxlIGR1cmF0aW9uXG4gICAgdGhpcy5uZXh0QXZjRHRzID0gZHRzbm9ybSArIG1wNFNhbXBsZS5kdXJhdGlvbiAqIHBlczJtcDRTY2FsZUZhY3RvcjtcbiAgICB0cmFjay5sZW4gPSAwO1xuICAgIHRyYWNrLm5iTmFsdSA9IDA7XG4gICAgaWYobmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLmluZGV4T2YoJ2Nocm9tZScpID4gLTEpIHtcbiAgICAvLyBjaHJvbWUgd29ya2Fyb3VuZCwgbWFyayBmaXJzdCBzYW1wbGUgYXMgYmVpbmcgYSBSYW5kb20gQWNjZXNzIFBvaW50IHRvIGF2b2lkIHNvdXJjZWJ1ZmZlciBhcHBlbmQgaXNzdWVcbiAgICAvLyBodHRwczovL2NvZGUuZ29vZ2xlLmNvbS9wL2Nocm9taXVtL2lzc3Vlcy9kZXRhaWw/aWQ9MjI5NDEyXG4gICAgICBzYW1wbGVzWzBdLmZsYWdzLmRlcGVuZHNPbiA9IDI7XG4gICAgICBzYW1wbGVzWzBdLmZsYWdzLmlzTm9uU3luYyA9IDA7XG4gICAgfVxuICAgIHRyYWNrLnNhbXBsZXMgPSBzYW1wbGVzO1xuICAgIG1vb2YgPSBNUDQubW9vZih0cmFjay5zZXF1ZW5jZU51bWJlcisrLCBmaXJzdERUUyAvIHBlczJtcDRTY2FsZUZhY3RvciwgdHJhY2spO1xuICAgIHRyYWNrLnNhbXBsZXMgPSBbXTtcbiAgICB0aGlzLm9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0RBVEEsIHtcbiAgICAgIG1vb2Y6IG1vb2YsXG4gICAgICBtZGF0OiBtZGF0LFxuICAgICAgc3RhcnRQVFM6IGZpcnN0UFRTIC8gcGVzVGltZVNjYWxlLFxuICAgICAgZW5kUFRTOiAocHRzbm9ybSArIHBlczJtcDRTY2FsZUZhY3RvciAqIG1wNFNhbXBsZS5kdXJhdGlvbikgLyBwZXNUaW1lU2NhbGUsXG4gICAgICBzdGFydERUUzogZmlyc3REVFMgLyBwZXNUaW1lU2NhbGUsXG4gICAgICBlbmREVFM6IChkdHNub3JtICsgcGVzMm1wNFNjYWxlRmFjdG9yICogbXA0U2FtcGxlLmR1cmF0aW9uKSAvIHBlc1RpbWVTY2FsZSxcbiAgICAgIHR5cGU6ICd2aWRlbycsXG4gICAgICBuYjogc2FtcGxlcy5sZW5ndGhcbiAgICB9KTtcbiAgfVxuXG4gIHJlbXV4QXVkaW8odHJhY2ssdGltZU9mZnNldCwgY29udGlndW91cykge1xuICAgIHZhciB2aWV3LFxuICAgICAgICBpID0gOCxcbiAgICAgICAgcGVzVGltZVNjYWxlID0gdGhpcy5QRVNfVElNRVNDQUxFLFxuICAgICAgICBwZXMybXA0U2NhbGVGYWN0b3IgPSB0aGlzLlBFUzJNUDRTQ0FMRUZBQ1RPUixcbiAgICAgICAgYWFjU2FtcGxlLCBtcDRTYW1wbGUsXG4gICAgICAgIHVuaXQsXG4gICAgICAgIG1kYXQsIG1vb2YsXG4gICAgICAgIGZpcnN0UFRTLCBmaXJzdERUUywgbGFzdERUUyxcbiAgICAgICAgcHRzLCBkdHMsIHB0c25vcm0sIGR0c25vcm0sXG4gICAgICAgIHNhbXBsZXMgPSBbXTtcbiAgICAvKiBjb25jYXRlbmF0ZSB0aGUgYXVkaW8gZGF0YSBhbmQgY29uc3RydWN0IHRoZSBtZGF0IGluIHBsYWNlXG4gICAgICAobmVlZCA4IG1vcmUgYnl0ZXMgdG8gZmlsbCBsZW5ndGggYW5kIG1kYXQgdHlwZSkgKi9cbiAgICBtZGF0ID0gbmV3IFVpbnQ4QXJyYXkodHJhY2subGVuICsgOCk7XG4gICAgdmlldyA9IG5ldyBEYXRhVmlldyhtZGF0LmJ1ZmZlcik7XG4gICAgdmlldy5zZXRVaW50MzIoMCwgbWRhdC5ieXRlTGVuZ3RoKTtcbiAgICBtZGF0LnNldChNUDQudHlwZXMubWRhdCwgNCk7XG4gICAgd2hpbGUgKHRyYWNrLnNhbXBsZXMubGVuZ3RoKSB7XG4gICAgICBhYWNTYW1wbGUgPSB0cmFjay5zYW1wbGVzLnNoaWZ0KCk7XG4gICAgICB1bml0ID0gYWFjU2FtcGxlLnVuaXQ7XG4gICAgICBtZGF0LnNldCh1bml0LCBpKTtcbiAgICAgIGkgKz0gdW5pdC5ieXRlTGVuZ3RoO1xuICAgICAgcHRzID0gYWFjU2FtcGxlLnB0cyAtIHRoaXMuX2luaXREVFM7XG4gICAgICBkdHMgPSBhYWNTYW1wbGUuZHRzIC0gdGhpcy5faW5pdERUUztcbiAgICAgIC8vbG9nZ2VyLmxvZygnQXVkaW8vUFRTOicgKyBhYWNTYW1wbGUucHRzLnRvRml4ZWQoMCkpO1xuICAgICAgaWYgKGxhc3REVFMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBwdHNub3JtID0gdGhpcy5fUFRTTm9ybWFsaXplKHB0cywgbGFzdERUUyk7XG4gICAgICAgIGR0c25vcm0gPSB0aGlzLl9QVFNOb3JtYWxpemUoZHRzLCBsYXN0RFRTKTtcbiAgICAgICAgLy8gd2UgdXNlIERUUyB0byBjb21wdXRlIHNhbXBsZSBkdXJhdGlvbiwgYnV0IHdlIHVzZSBQVFMgdG8gY29tcHV0ZSBpbml0UFRTIHdoaWNoIGlzIHVzZWQgdG8gc3luYyBhdWRpbyBhbmQgdmlkZW9cbiAgICAgICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gKGR0c25vcm0gLSBsYXN0RFRTKSAvIHBlczJtcDRTY2FsZUZhY3RvcjtcbiAgICAgICAgaWYgKG1wNFNhbXBsZS5kdXJhdGlvbiA8IDApIHtcbiAgICAgICAgICBsb2dnZXIubG9nKGBpbnZhbGlkIEFBQyBzYW1wbGUgZHVyYXRpb24gYXQgUFRTOiR7YWFjU2FtcGxlLnB0c306JHttcDRTYW1wbGUuZHVyYXRpb259YCk7XG4gICAgICAgICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIG5leHRBYWNQdHMgPSB0aGlzLm5leHRBYWNQdHMsZGVsdGE7XG4gICAgICAgIHB0c25vcm0gPSB0aGlzLl9QVFNOb3JtYWxpemUocHRzLCBuZXh0QWFjUHRzKTtcbiAgICAgICAgZHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShkdHMsIG5leHRBYWNQdHMpO1xuICAgICAgICBkZWx0YSA9IE1hdGgucm91bmQoMTAwMCAqIChwdHNub3JtIC0gbmV4dEFhY1B0cykgLyBwZXNUaW1lU2NhbGUpO1xuICAgICAgICAvLyBpZiBmcmFnbWVudCBhcmUgY29udGlndW91cywgb3IgZGVsdGEgbGVzcyB0aGFuIDYwMG1zLCBlbnN1cmUgdGhlcmUgaXMgbm8gb3ZlcmxhcC9ob2xlIGJldHdlZW4gZnJhZ21lbnRzXG4gICAgICAgIGlmIChjb250aWd1b3VzIHx8IE1hdGguYWJzKGRlbHRhKSA8IDYwMCkge1xuICAgICAgICAgIC8vIGxvZyBkZWx0YVxuICAgICAgICAgIGlmIChkZWx0YSkge1xuICAgICAgICAgICAgaWYgKGRlbHRhID4gMSkge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGAke2RlbHRhfSBtcyBob2xlIGJldHdlZW4gQUFDIHNhbXBsZXMgZGV0ZWN0ZWQsZmlsbGluZyBpdGApO1xuICAgICAgICAgICAgICAvLyBzZXQgUFRTIHRvIG5leHQgUFRTLCBhbmQgZW5zdXJlIFBUUyBpcyBncmVhdGVyIG9yIGVxdWFsIHRoYW4gbGFzdCBEVFNcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZGVsdGEgPCAtMSkge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGAkeygtZGVsdGEpfSBtcyBvdmVybGFwcGluZyBiZXR3ZWVuIEFBQyBzYW1wbGVzIGRldGVjdGVkYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBzZXQgRFRTIHRvIG5leHQgRFRTXG4gICAgICAgICAgICBwdHNub3JtID0gZHRzbm9ybSA9IG5leHRBYWNQdHM7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIHJlbWVtYmVyIGZpcnN0IFBUUyBvZiBvdXIgYWFjU2FtcGxlcywgZW5zdXJlIHZhbHVlIGlzIHBvc2l0aXZlXG4gICAgICAgIGZpcnN0UFRTID0gTWF0aC5tYXgoMCwgcHRzbm9ybSk7XG4gICAgICAgIGZpcnN0RFRTID0gTWF0aC5tYXgoMCwgZHRzbm9ybSk7XG4gICAgICB9XG4gICAgICAvL2NvbnNvbGUubG9nKCdQVFMvRFRTL2luaXREVFMvbm9ybVBUUy9ub3JtRFRTL3JlbGF0aXZlIFBUUyA6ICR7YWFjU2FtcGxlLnB0c30vJHthYWNTYW1wbGUuZHRzfS8ke3RoaXMuX2luaXREVFN9LyR7cHRzbm9ybX0vJHtkdHNub3JtfS8keyhhYWNTYW1wbGUucHRzLzQyOTQ5NjcyOTYpLnRvRml4ZWQoMyl9Jyk7XG4gICAgICBtcDRTYW1wbGUgPSB7XG4gICAgICAgIHNpemU6IHVuaXQuYnl0ZUxlbmd0aCxcbiAgICAgICAgY3RzOiAwLFxuICAgICAgICBkdXJhdGlvbjowLFxuICAgICAgICBmbGFnczoge1xuICAgICAgICAgIGlzTGVhZGluZzogMCxcbiAgICAgICAgICBpc0RlcGVuZGVkT246IDAsXG4gICAgICAgICAgaGFzUmVkdW5kYW5jeTogMCxcbiAgICAgICAgICBkZWdyYWRQcmlvOiAwLFxuICAgICAgICAgIGRlcGVuZHNPbjogMSxcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIHNhbXBsZXMucHVzaChtcDRTYW1wbGUpO1xuICAgICAgbGFzdERUUyA9IGR0c25vcm07XG4gICAgfVxuICAgIC8vc2V0IGxhc3Qgc2FtcGxlIGR1cmF0aW9uIGFzIGJlaW5nIGlkZW50aWNhbCB0byBwcmV2aW91cyBzYW1wbGVcbiAgICBpZiAoc2FtcGxlcy5sZW5ndGggPj0gMikge1xuICAgICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gc2FtcGxlc1tzYW1wbGVzLmxlbmd0aCAtIDJdLmR1cmF0aW9uO1xuICAgIH1cbiAgICAvLyBuZXh0IGFhYyBzYW1wbGUgUFRTIHNob3VsZCBiZSBlcXVhbCB0byBsYXN0IHNhbXBsZSBQVFMgKyBkdXJhdGlvblxuICAgIHRoaXMubmV4dEFhY1B0cyA9IHB0c25vcm0gKyBwZXMybXA0U2NhbGVGYWN0b3IgKiBtcDRTYW1wbGUuZHVyYXRpb247XG4gICAgLy9sb2dnZXIubG9nKCdBdWRpby9QVFMvUFRTZW5kOicgKyBhYWNTYW1wbGUucHRzLnRvRml4ZWQoMCkgKyAnLycgKyB0aGlzLm5leHRBYWNEdHMudG9GaXhlZCgwKSk7XG4gICAgdHJhY2subGVuID0gMDtcbiAgICB0cmFjay5zYW1wbGVzID0gc2FtcGxlcztcbiAgICBtb29mID0gTVA0Lm1vb2YodHJhY2suc2VxdWVuY2VOdW1iZXIrKywgZmlyc3REVFMgLyBwZXMybXA0U2NhbGVGYWN0b3IsIHRyYWNrKTtcbiAgICB0cmFjay5zYW1wbGVzID0gW107XG4gICAgdGhpcy5vYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLCB7XG4gICAgICBtb29mOiBtb29mLFxuICAgICAgbWRhdDogbWRhdCxcbiAgICAgIHN0YXJ0UFRTOiBmaXJzdFBUUyAvIHBlc1RpbWVTY2FsZSxcbiAgICAgIGVuZFBUUzogdGhpcy5uZXh0QWFjUHRzIC8gcGVzVGltZVNjYWxlLFxuICAgICAgc3RhcnREVFM6IGZpcnN0RFRTIC8gcGVzVGltZVNjYWxlLFxuICAgICAgZW5kRFRTOiAoZHRzbm9ybSArIHBlczJtcDRTY2FsZUZhY3RvciAqIG1wNFNhbXBsZS5kdXJhdGlvbikgLyBwZXNUaW1lU2NhbGUsXG4gICAgICB0eXBlOiAnYXVkaW8nLFxuICAgICAgbmI6IHNhbXBsZXMubGVuZ3RoXG4gICAgfSk7XG4gIH1cblxuICByZW11eElEMyh0cmFjayx0aW1lT2Zmc2V0KSB7XG4gICAgdmFyIGxlbmd0aCA9IHRyYWNrLnNhbXBsZXMubGVuZ3RoLCBzYW1wbGU7XG4gICAgLy8gY29uc3VtZSBzYW1wbGVzXG4gICAgaWYobGVuZ3RoKSB7XG4gICAgICBmb3IodmFyIGluZGV4ID0gMDsgaW5kZXggPCBsZW5ndGg7IGluZGV4KyspIHtcbiAgICAgICAgc2FtcGxlID0gdHJhY2suc2FtcGxlc1tpbmRleF07XG4gICAgICAgIC8vIHNldHRpbmcgaWQzIHB0cywgZHRzIHRvIHJlbGF0aXZlIHRpbWVcbiAgICAgICAgLy8gdXNpbmcgdGhpcy5faW5pdFBUUyBhbmQgdGhpcy5faW5pdERUUyB0byBjYWxjdWxhdGUgcmVsYXRpdmUgdGltZVxuICAgICAgICBzYW1wbGUucHRzID0gKChzYW1wbGUucHRzIC0gdGhpcy5faW5pdFBUUykgLyB0aGlzLlBFU19USU1FU0NBTEUpO1xuICAgICAgICBzYW1wbGUuZHRzID0gKChzYW1wbGUuZHRzIC0gdGhpcy5faW5pdERUUykgLyB0aGlzLlBFU19USU1FU0NBTEUpO1xuICAgICAgfVxuICAgICAgdGhpcy5vYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19NRVRBREFUQSwge1xuICAgICAgICBzYW1wbGVzOnRyYWNrLnNhbXBsZXNcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHRyYWNrLnNhbXBsZXMgPSBbXTtcbiAgICB0aW1lT2Zmc2V0ID0gdGltZU9mZnNldDtcbiAgfVxuXG4gIF9QVFNOb3JtYWxpemUodmFsdWUsIHJlZmVyZW5jZSkge1xuICAgIHZhciBvZmZzZXQ7XG4gICAgaWYgKHJlZmVyZW5jZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuICAgIGlmIChyZWZlcmVuY2UgPCB2YWx1ZSkge1xuICAgICAgLy8gLSAyXjMzXG4gICAgICBvZmZzZXQgPSAtODU4OTkzNDU5MjtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gKyAyXjMzXG4gICAgICBvZmZzZXQgPSA4NTg5OTM0NTkyO1xuICAgIH1cbiAgICAvKiBQVFMgaXMgMzNiaXQgKGZyb20gMCB0byAyXjMzIC0xKVxuICAgICAgaWYgZGlmZiBiZXR3ZWVuIHZhbHVlIGFuZCByZWZlcmVuY2UgaXMgYmlnZ2VyIHRoYW4gaGFsZiBvZiB0aGUgYW1wbGl0dWRlICgyXjMyKSB0aGVuIGl0IG1lYW5zIHRoYXRcbiAgICAgIFBUUyBsb29waW5nIG9jY3VyZWQuIGZpbGwgdGhlIGdhcCAqL1xuICAgIHdoaWxlIChNYXRoLmFicyh2YWx1ZSAtIHJlZmVyZW5jZSkgPiA0Mjk0OTY3Mjk2KSB7XG4gICAgICAgIHZhbHVlICs9IG9mZnNldDtcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgTVA0UmVtdXhlcjtcbiIsInZhciBCaW5hcnlTZWFyY2ggPSB7XG4gICAgLyoqXG4gICAgICogU2VhcmNoZXMgZm9yIGFuIGl0ZW0gaW4gYW4gYXJyYXkgd2hpY2ggbWF0Y2hlcyBhIGNlcnRhaW4gY29uZGl0aW9uLlxuICAgICAqIFRoaXMgcmVxdWlyZXMgdGhlIGNvbmRpdGlvbiB0byBvbmx5IG1hdGNoIG9uZSBpdGVtIGluIHRoZSBhcnJheSxcbiAgICAgKiBhbmQgZm9yIHRoZSBhcnJheSB0byBiZSBvcmRlcmVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBcnJheX0gbGlzdCBUaGUgYXJyYXkgdG8gc2VhcmNoLlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGNvbXBhcmlzb25GdW5jdGlvblxuICAgICAqICAgICAgQ2FsbGVkIGFuZCBwcm92aWRlZCBhIGNhbmRpZGF0ZSBpdGVtIGFzIHRoZSBmaXJzdCBhcmd1bWVudC5cbiAgICAgKiAgICAgIFNob3VsZCByZXR1cm46XG4gICAgICogICAgICAgICAgPiAtMSBpZiB0aGUgaXRlbSBzaG91bGQgYmUgbG9jYXRlZCBhdCBhIGxvd2VyIGluZGV4IHRoYW4gdGhlIHByb3ZpZGVkIGl0ZW0uXG4gICAgICogICAgICAgICAgPiAxIGlmIHRoZSBpdGVtIHNob3VsZCBiZSBsb2NhdGVkIGF0IGEgaGlnaGVyIGluZGV4IHRoYW4gdGhlIHByb3ZpZGVkIGl0ZW0uXG4gICAgICogICAgICAgICAgPiAwIGlmIHRoZSBpdGVtIGlzIHRoZSBpdGVtIHlvdSdyZSBsb29raW5nIGZvci5cbiAgICAgKlxuICAgICAqIEByZXR1cm4geyp9IFRoZSBvYmplY3QgaWYgaXQgaXMgZm91bmQgb3IgbnVsbCBvdGhlcndpc2UuXG4gICAgICovXG4gICAgc2VhcmNoOiBmdW5jdGlvbihsaXN0LCBjb21wYXJpc29uRnVuY3Rpb24pIHtcbiAgICAgICAgdmFyIG1pbkluZGV4ID0gMDtcbiAgICAgICAgdmFyIG1heEluZGV4ID0gbGlzdC5sZW5ndGggLSAxO1xuICAgICAgICB2YXIgY3VycmVudEluZGV4ID0gbnVsbDtcbiAgICAgICAgdmFyIGN1cnJlbnRFbGVtZW50ID0gbnVsbDtcbiAgICAgXG4gICAgICAgIHdoaWxlIChtaW5JbmRleCA8PSBtYXhJbmRleCkge1xuICAgICAgICAgICAgY3VycmVudEluZGV4ID0gKG1pbkluZGV4ICsgbWF4SW5kZXgpIC8gMiB8IDA7XG4gICAgICAgICAgICBjdXJyZW50RWxlbWVudCA9IGxpc3RbY3VycmVudEluZGV4XTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdmFyIGNvbXBhcmlzb25SZXN1bHQgPSBjb21wYXJpc29uRnVuY3Rpb24oY3VycmVudEVsZW1lbnQpO1xuICAgICAgICAgICAgaWYgKGNvbXBhcmlzb25SZXN1bHQgPiAwKSB7XG4gICAgICAgICAgICAgICAgbWluSW5kZXggPSBjdXJyZW50SW5kZXggKyAxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoY29tcGFyaXNvblJlc3VsdCA8IDApIHtcbiAgICAgICAgICAgICAgICBtYXhJbmRleCA9IGN1cnJlbnRJbmRleCAtIDE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gY3VycmVudEVsZW1lbnQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQmluYXJ5U2VhcmNoO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBub29wKCkge31cblxuY29uc3QgZmFrZUxvZ2dlciA9IHtcbiAgdHJhY2U6IG5vb3AsXG4gIGRlYnVnOiBub29wLFxuICBsb2c6IG5vb3AsXG4gIHdhcm46IG5vb3AsXG4gIGluZm86IG5vb3AsXG4gIGVycm9yOiBub29wXG59O1xuXG5sZXQgZXhwb3J0ZWRMb2dnZXIgPSBmYWtlTG9nZ2VyO1xuXG4vL2xldCBsYXN0Q2FsbFRpbWU7XG4vLyBmdW5jdGlvbiBmb3JtYXRNc2dXaXRoVGltZUluZm8odHlwZSwgbXNnKSB7XG4vLyAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4vLyAgIGNvbnN0IGRpZmYgPSBsYXN0Q2FsbFRpbWUgPyAnKycgKyAobm93IC0gbGFzdENhbGxUaW1lKSA6ICcwJztcbi8vICAgbGFzdENhbGxUaW1lID0gbm93O1xuLy8gICBtc2cgPSAobmV3IERhdGUobm93KSkudG9JU09TdHJpbmcoKSArICcgfCBbJyArICB0eXBlICsgJ10gPiAnICsgbXNnICsgJyAoICcgKyBkaWZmICsgJyBtcyApJztcbi8vICAgcmV0dXJuIG1zZztcbi8vIH1cblxuZnVuY3Rpb24gZm9ybWF0TXNnKHR5cGUsIG1zZykge1xuICBtc2cgPSAnWycgKyAgdHlwZSArICddID4gJyArIG1zZztcbiAgcmV0dXJuIG1zZztcbn1cblxuZnVuY3Rpb24gY29uc29sZVByaW50Rm4odHlwZSkge1xuICBjb25zdCBmdW5jID0gd2luZG93LmNvbnNvbGVbdHlwZV07XG4gIGlmIChmdW5jKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKC4uLmFyZ3MpIHtcbiAgICAgIGlmKGFyZ3NbMF0pIHtcbiAgICAgICAgYXJnc1swXSA9IGZvcm1hdE1zZyh0eXBlLCBhcmdzWzBdKTtcbiAgICAgIH1cbiAgICAgIGZ1bmMuYXBwbHkod2luZG93LmNvbnNvbGUsIGFyZ3MpO1xuICAgIH07XG4gIH1cbiAgcmV0dXJuIG5vb3A7XG59XG5cbmZ1bmN0aW9uIGV4cG9ydExvZ2dlckZ1bmN0aW9ucyhkZWJ1Z0NvbmZpZywgLi4uZnVuY3Rpb25zKSB7XG4gIGZ1bmN0aW9ucy5mb3JFYWNoKGZ1bmN0aW9uKHR5cGUpIHtcbiAgICBleHBvcnRlZExvZ2dlclt0eXBlXSA9IGRlYnVnQ29uZmlnW3R5cGVdID8gZGVidWdDb25maWdbdHlwZV0uYmluZChkZWJ1Z0NvbmZpZykgOiBjb25zb2xlUHJpbnRGbih0eXBlKTtcbiAgfSk7XG59XG5cbmV4cG9ydCB2YXIgZW5hYmxlTG9ncyA9IGZ1bmN0aW9uKGRlYnVnQ29uZmlnKSB7XG4gIGlmIChkZWJ1Z0NvbmZpZyA9PT0gdHJ1ZSB8fCB0eXBlb2YgZGVidWdDb25maWcgPT09ICdvYmplY3QnKSB7XG4gICAgZXhwb3J0TG9nZ2VyRnVuY3Rpb25zKGRlYnVnQ29uZmlnLFxuICAgICAgLy8gUmVtb3ZlIG91dCBmcm9tIGxpc3QgaGVyZSB0byBoYXJkLWRpc2FibGUgYSBsb2ctbGV2ZWxcbiAgICAgIC8vJ3RyYWNlJyxcbiAgICAgICdkZWJ1ZycsXG4gICAgICAnbG9nJyxcbiAgICAgICdpbmZvJyxcbiAgICAgICd3YXJuJyxcbiAgICAgICdlcnJvcidcbiAgICApO1xuICAgIC8vIFNvbWUgYnJvd3NlcnMgZG9uJ3QgYWxsb3cgdG8gdXNlIGJpbmQgb24gY29uc29sZSBvYmplY3QgYW55d2F5XG4gICAgLy8gZmFsbGJhY2sgdG8gZGVmYXVsdCBpZiBuZWVkZWRcbiAgICB0cnkge1xuICAgICBleHBvcnRlZExvZ2dlci5sb2coKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBleHBvcnRlZExvZ2dlciA9IGZha2VMb2dnZXI7XG4gICAgfVxuICB9XG4gIGVsc2Uge1xuICAgIGV4cG9ydGVkTG9nZ2VyID0gZmFrZUxvZ2dlcjtcbiAgfVxufTtcblxuZXhwb3J0IHZhciBsb2dnZXIgPSBleHBvcnRlZExvZ2dlcjtcbiIsInZhciBVUkxIZWxwZXIgPSB7XG5cbiAgLy8gYnVpbGQgYW4gYWJzb2x1dGUgVVJMIGZyb20gYSByZWxhdGl2ZSBvbmUgdXNpbmcgdGhlIHByb3ZpZGVkIGJhc2VVUkxcbiAgLy8gaWYgcmVsYXRpdmVVUkwgaXMgYW4gYWJzb2x1dGUgVVJMIGl0IHdpbGwgYmUgcmV0dXJuZWQgYXMgaXMuXG4gIGJ1aWxkQWJzb2x1dGVVUkw6IGZ1bmN0aW9uKGJhc2VVUkwsIHJlbGF0aXZlVVJMKSB7XG4gICAgLy8gcmVtb3ZlIGFueSByZW1haW5pbmcgc3BhY2UgYW5kIENSTEZcbiAgICByZWxhdGl2ZVVSTCA9IHJlbGF0aXZlVVJMLnRyaW0oKTtcbiAgICBpZiAoL15bYS16XSs6L2kudGVzdChyZWxhdGl2ZVVSTCkpIHtcbiAgICAgIC8vIGNvbXBsZXRlIHVybCwgbm90IHJlbGF0aXZlXG4gICAgICByZXR1cm4gcmVsYXRpdmVVUkw7XG4gICAgfVxuXG4gICAgdmFyIHJlbGF0aXZlVVJMUXVlcnkgPSBudWxsO1xuICAgIHZhciByZWxhdGl2ZVVSTEhhc2ggPSBudWxsO1xuXG4gICAgdmFyIHJlbGF0aXZlVVJMSGFzaFNwbGl0ID0gL14oW14jXSopKC4qKSQvLmV4ZWMocmVsYXRpdmVVUkwpO1xuICAgIGlmIChyZWxhdGl2ZVVSTEhhc2hTcGxpdCkge1xuICAgICAgcmVsYXRpdmVVUkxIYXNoID0gcmVsYXRpdmVVUkxIYXNoU3BsaXRbMl07XG4gICAgICByZWxhdGl2ZVVSTCA9IHJlbGF0aXZlVVJMSGFzaFNwbGl0WzFdO1xuICAgIH1cbiAgICB2YXIgcmVsYXRpdmVVUkxRdWVyeVNwbGl0ID0gL14oW15cXD9dKikoLiopJC8uZXhlYyhyZWxhdGl2ZVVSTCk7XG4gICAgaWYgKHJlbGF0aXZlVVJMUXVlcnlTcGxpdCkge1xuICAgICAgcmVsYXRpdmVVUkxRdWVyeSA9IHJlbGF0aXZlVVJMUXVlcnlTcGxpdFsyXTtcbiAgICAgIHJlbGF0aXZlVVJMID0gcmVsYXRpdmVVUkxRdWVyeVNwbGl0WzFdO1xuICAgIH1cblxuICAgIHZhciBiYXNlVVJMSGFzaFNwbGl0ID0gL14oW14jXSopKC4qKSQvLmV4ZWMoYmFzZVVSTCk7XG4gICAgaWYgKGJhc2VVUkxIYXNoU3BsaXQpIHtcbiAgICAgIGJhc2VVUkwgPSBiYXNlVVJMSGFzaFNwbGl0WzFdO1xuICAgIH1cbiAgICB2YXIgYmFzZVVSTFF1ZXJ5U3BsaXQgPSAvXihbXlxcP10qKSguKikkLy5leGVjKGJhc2VVUkwpO1xuICAgIGlmIChiYXNlVVJMUXVlcnlTcGxpdCkge1xuICAgICAgYmFzZVVSTCA9IGJhc2VVUkxRdWVyeVNwbGl0WzFdO1xuICAgIH1cblxuICAgIHZhciBiYXNlVVJMRG9tYWluU3BsaXQgPSAvXigoKFthLXpdKyk6KT9cXC9cXC9bYS16MC05XFwuLV0rKDpbMC05XSspP1xcLykoLiopJC9pLmV4ZWMoYmFzZVVSTCk7XG4gICAgdmFyIGJhc2VVUkxQcm90b2NvbCA9IGJhc2VVUkxEb21haW5TcGxpdFszXTtcbiAgICB2YXIgYmFzZVVSTERvbWFpbiA9IGJhc2VVUkxEb21haW5TcGxpdFsxXTtcbiAgICB2YXIgYmFzZVVSTFBhdGggPSBiYXNlVVJMRG9tYWluU3BsaXRbNV07XG5cbiAgICB2YXIgYnVpbHRVUkwgPSBudWxsO1xuICAgIGlmICgvXlxcL1xcLy8udGVzdChyZWxhdGl2ZVVSTCkpIHtcbiAgICAgIGJ1aWx0VVJMID0gYmFzZVVSTFByb3RvY29sKyc6Ly8nK1VSTEhlbHBlci5idWlsZEFic29sdXRlUGF0aCgnJywgcmVsYXRpdmVVUkwuc3Vic3RyaW5nKDIpKTtcbiAgICB9XG4gICAgZWxzZSBpZiAoL15cXC8vLnRlc3QocmVsYXRpdmVVUkwpKSB7XG4gICAgICBidWlsdFVSTCA9IGJhc2VVUkxEb21haW4rVVJMSGVscGVyLmJ1aWxkQWJzb2x1dGVQYXRoKCcnLCByZWxhdGl2ZVVSTC5zdWJzdHJpbmcoMSkpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHZhciBuZXdQYXRoID0gVVJMSGVscGVyLmJ1aWxkQWJzb2x1dGVQYXRoKGJhc2VVUkxQYXRoLCByZWxhdGl2ZVVSTCk7XG4gICAgICBidWlsdFVSTCA9IGJhc2VVUkxEb21haW4gKyBuZXdQYXRoO1xuICAgIH1cblxuICAgIC8vIHB1dCB0aGUgcXVlcnkgYW5kIGhhc2ggcGFydHMgYmFja1xuICAgIGlmIChyZWxhdGl2ZVVSTFF1ZXJ5KSB7XG4gICAgICBidWlsdFVSTCArPSByZWxhdGl2ZVVSTFF1ZXJ5O1xuICAgIH1cbiAgICBpZiAocmVsYXRpdmVVUkxIYXNoKSB7XG4gICAgICBidWlsdFVSTCArPSByZWxhdGl2ZVVSTEhhc2g7XG4gICAgfVxuICAgIHJldHVybiBidWlsdFVSTDtcbiAgfSxcblxuICAvLyBidWlsZCBhbiBhYnNvbHV0ZSBwYXRoIHVzaW5nIHRoZSBwcm92aWRlZCBiYXNlUGF0aFxuICAvLyBhZGFwdGVkIGZyb20gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL2RvY3VtZW50L2Nvb2tpZSNVc2luZ19yZWxhdGl2ZV9VUkxzX2luX3RoZV9wYXRoX3BhcmFtZXRlclxuICAvLyB0aGlzIGRvZXMgbm90IGhhbmRsZSB0aGUgY2FzZSB3aGVyZSByZWxhdGl2ZVBhdGggaXMgXCIvXCIgb3IgXCIvL1wiLiBUaGVzZSBjYXNlcyBzaG91bGQgYmUgaGFuZGxlZCBvdXRzaWRlIHRoaXMuXG4gIGJ1aWxkQWJzb2x1dGVQYXRoOiBmdW5jdGlvbihiYXNlUGF0aCwgcmVsYXRpdmVQYXRoKSB7XG4gICAgdmFyIHNSZWxQYXRoID0gcmVsYXRpdmVQYXRoO1xuICAgIHZhciBuVXBMbiwgc0RpciA9ICcnLCBzUGF0aCA9IGJhc2VQYXRoLnJlcGxhY2UoL1teXFwvXSokLywgc1JlbFBhdGgucmVwbGFjZSgvKFxcL3xeKSg/OlxcLj9cXC8rKSsvZywgJyQxJykpO1xuICAgIGZvciAodmFyIG5FbmQsIG5TdGFydCA9IDA7IG5FbmQgPSBzUGF0aC5pbmRleE9mKCcvLi4vJywgblN0YXJ0KSwgbkVuZCA+IC0xOyBuU3RhcnQgPSBuRW5kICsgblVwTG4pIHtcbiAgICAgIG5VcExuID0gL15cXC8oPzpcXC5cXC5cXC8pKi8uZXhlYyhzUGF0aC5zbGljZShuRW5kKSlbMF0ubGVuZ3RoO1xuICAgICAgc0RpciA9IChzRGlyICsgc1BhdGguc3Vic3RyaW5nKG5TdGFydCwgbkVuZCkpLnJlcGxhY2UobmV3IFJlZ0V4cCgnKD86XFxcXFxcLytbXlxcXFxcXC9dKil7MCwnICsgKChuVXBMbiAtIDEpIC8gMykgKyAnfSQnKSwgJy8nKTtcbiAgICB9XG4gICAgcmV0dXJuIHNEaXIgKyBzUGF0aC5zdWJzdHIoblN0YXJ0KTtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBVUkxIZWxwZXI7XG4iLCIvKipcbiAqIFhIUiBiYXNlZCBsb2dnZXJcbiovXG5cbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG5jbGFzcyBYaHJMb2FkZXIge1xuXG4gIGNvbnN0cnVjdG9yKGNvbmZpZykge1xuICAgIGlmIChjb25maWcgJiYgY29uZmlnLnhoclNldHVwKSB7XG4gICAgICB0aGlzLnhoclNldHVwID0gY29uZmlnLnhoclNldHVwO1xuICAgIH1cbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5hYm9ydCgpO1xuICAgIHRoaXMubG9hZGVyID0gbnVsbDtcbiAgfVxuXG4gIGFib3J0KCkge1xuICAgIGlmICh0aGlzLmxvYWRlciAmJiB0aGlzLmxvYWRlci5yZWFkeVN0YXRlICE9PSA0KSB7XG4gICAgICB0aGlzLnN0YXRzLmFib3J0ZWQgPSB0cnVlO1xuICAgICAgdGhpcy5sb2FkZXIuYWJvcnQoKTtcbiAgICB9XG4gICAgaWYgKHRoaXMudGltZW91dEhhbmRsZSkge1xuICAgICAgd2luZG93LmNsZWFyVGltZW91dCh0aGlzLnRpbWVvdXRIYW5kbGUpO1xuICAgIH1cbiAgfVxuXG4gIGxvYWQodXJsLCByZXNwb25zZVR5cGUsIG9uU3VjY2Vzcywgb25FcnJvciwgb25UaW1lb3V0LCB0aW1lb3V0LCBtYXhSZXRyeSwgcmV0cnlEZWxheSwgb25Qcm9ncmVzcyA9IG51bGwsIGZyYWcgPSBudWxsKSB7XG4gICAgdGhpcy51cmwgPSB1cmw7XG4gICAgaWYgKGZyYWcgJiYgIWlzTmFOKGZyYWcuYnl0ZVJhbmdlU3RhcnRPZmZzZXQpICYmICFpc05hTihmcmFnLmJ5dGVSYW5nZUVuZE9mZnNldCkpIHtcbiAgICAgICAgdGhpcy5ieXRlUmFuZ2UgPSBmcmFnLmJ5dGVSYW5nZVN0YXJ0T2Zmc2V0ICsgJy0nICsgZnJhZy5ieXRlUmFuZ2VFbmRPZmZzZXQ7XG4gICAgfVxuICAgIHRoaXMucmVzcG9uc2VUeXBlID0gcmVzcG9uc2VUeXBlO1xuICAgIHRoaXMub25TdWNjZXNzID0gb25TdWNjZXNzO1xuICAgIHRoaXMub25Qcm9ncmVzcyA9IG9uUHJvZ3Jlc3M7XG4gICAgdGhpcy5vblRpbWVvdXQgPSBvblRpbWVvdXQ7XG4gICAgdGhpcy5vbkVycm9yID0gb25FcnJvcjtcbiAgICB0aGlzLnN0YXRzID0ge3RyZXF1ZXN0OiBwZXJmb3JtYW5jZS5ub3coKSwgcmV0cnk6IDB9O1xuICAgIHRoaXMudGltZW91dCA9IHRpbWVvdXQ7XG4gICAgdGhpcy5tYXhSZXRyeSA9IG1heFJldHJ5O1xuICAgIHRoaXMucmV0cnlEZWxheSA9IHJldHJ5RGVsYXk7XG4gICAgdGhpcy50aW1lb3V0SGFuZGxlID0gd2luZG93LnNldFRpbWVvdXQodGhpcy5sb2FkdGltZW91dC5iaW5kKHRoaXMpLCB0aW1lb3V0KTtcbiAgICB0aGlzLmxvYWRJbnRlcm5hbCgpO1xuICB9XG5cbiAgbG9hZEludGVybmFsKCkge1xuICAgIHZhciB4aHIgPSB0aGlzLmxvYWRlciA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgIHhoci5vbmxvYWQgPSAgdGhpcy5sb2Fkc3VjY2Vzcy5iaW5kKHRoaXMpO1xuICAgIHhoci5vbmVycm9yID0gdGhpcy5sb2FkZXJyb3IuYmluZCh0aGlzKTtcbiAgICB4aHIub25wcm9ncmVzcyA9IHRoaXMubG9hZHByb2dyZXNzLmJpbmQodGhpcyk7XG4gICAgeGhyLm9wZW4oJ0dFVCcsIHRoaXMudXJsLCB0cnVlKTtcbiAgICBpZiAodGhpcy5ieXRlUmFuZ2UpIHtcbiAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKCdSYW5nZScsICdieXRlcz0nICsgdGhpcy5ieXRlUmFuZ2UpO1xuICAgIH1cbiAgICB4aHIucmVzcG9uc2VUeXBlID0gdGhpcy5yZXNwb25zZVR5cGU7XG4gICAgdGhpcy5zdGF0cy50Zmlyc3QgPSBudWxsO1xuICAgIHRoaXMuc3RhdHMubG9hZGVkID0gMDtcbiAgICBpZiAodGhpcy54aHJTZXR1cCkge1xuICAgICAgdGhpcy54aHJTZXR1cCh4aHIpO1xuICAgIH1cbiAgICB4aHIuc2VuZCgpO1xuICB9XG5cbiAgbG9hZHN1Y2Nlc3MoZXZlbnQpIHtcbiAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMudGltZW91dEhhbmRsZSk7XG4gICAgdGhpcy5zdGF0cy50bG9hZCA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgIHRoaXMub25TdWNjZXNzKGV2ZW50LCB0aGlzLnN0YXRzKTtcbiAgfVxuXG4gIGxvYWRlcnJvcihldmVudCkge1xuICAgIGlmICh0aGlzLnN0YXRzLnJldHJ5IDwgdGhpcy5tYXhSZXRyeSkge1xuICAgICAgbG9nZ2VyLndhcm4oYCR7ZXZlbnQudHlwZX0gd2hpbGUgbG9hZGluZyAke3RoaXMudXJsfSwgcmV0cnlpbmcgaW4gJHt0aGlzLnJldHJ5RGVsYXl9Li4uYCk7XG4gICAgICB0aGlzLmRlc3Ryb3koKTtcbiAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KHRoaXMubG9hZEludGVybmFsLmJpbmQodGhpcyksIHRoaXMucmV0cnlEZWxheSk7XG4gICAgICAvLyBleHBvbmVudGlhbCBiYWNrb2ZmXG4gICAgICB0aGlzLnJldHJ5RGVsYXkgPSBNYXRoLm1pbigyICogdGhpcy5yZXRyeURlbGF5LCA2NDAwMCk7XG4gICAgICB0aGlzLnN0YXRzLnJldHJ5Kys7XG4gICAgfSBlbHNlIHtcbiAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy50aW1lb3V0SGFuZGxlKTtcbiAgICAgIGxvZ2dlci5lcnJvcihgJHtldmVudC50eXBlfSB3aGlsZSBsb2FkaW5nICR7dGhpcy51cmx9YCApO1xuICAgICAgdGhpcy5vbkVycm9yKGV2ZW50KTtcbiAgICB9XG4gIH1cblxuICBsb2FkdGltZW91dChldmVudCkge1xuICAgIGxvZ2dlci53YXJuKGB0aW1lb3V0IHdoaWxlIGxvYWRpbmcgJHt0aGlzLnVybH1gICk7XG4gICAgdGhpcy5vblRpbWVvdXQoZXZlbnQsIHRoaXMuc3RhdHMpO1xuICB9XG5cbiAgbG9hZHByb2dyZXNzKGV2ZW50KSB7XG4gICAgdmFyIHN0YXRzID0gdGhpcy5zdGF0cztcbiAgICBpZiAoc3RhdHMudGZpcnN0ID09PSBudWxsKSB7XG4gICAgICBzdGF0cy50Zmlyc3QgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICB9XG4gICAgc3RhdHMubG9hZGVkID0gZXZlbnQubG9hZGVkO1xuICAgIGlmICh0aGlzLm9uUHJvZ3Jlc3MpIHtcbiAgICAgIHRoaXMub25Qcm9ncmVzcyhldmVudCwgc3RhdHMpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBYaHJMb2FkZXI7XG4iXX0=
