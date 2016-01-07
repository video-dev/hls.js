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

},{"../events":18}],4:[function(require,module,exports){
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

},{"../errors":17,"../events":18,"../utils/logger":28}],5:[function(require,module,exports){
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
  FRAG_LOADING_WAITING_RETRY: 3,
  WAITING_LEVEL: 4,
  PARSING: 5,
  PARSED: 6,
  APPENDING: 7,
  BUFFER_FLUSHING: 8
};

var MSEMediaController = (function () {
  function MSEMediaController(hls) {
    _classCallCheck(this, MSEMediaController);

    this.config = hls.config;
    this.audioCodecSwap = false;
    this.hls = hls;
    this.ticks = 0;
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
      this.fragLoadError = 0;
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
                      if (mediaSource && mediaSource.readyState === 'open') {
                        // ensure sourceBuffer are not in updating states
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
              sn = fragCurrent.sn,
              audioCodec = currentLevel.audioCodec;
          if (audioCodec && this.audioCodecSwap) {
            _utilsLogger.logger.log('swapping playlist audio codec');
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
    key: 'onInitSegment',
    value: function onInitSegment(event, data) {
      if (this.state === State.PARSING) {
        // check if codecs have been explicitely defined in the master playlist for this level;
        // if yes use these ones instead of the ones parsed from the demux
        var audioCodec = this.levels[this.level].audioCodec,
            videoCodec = this.levels[this.level].videoCodec,
            sb;
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
    key: 'onFragParsing',
    value: function onFragParsing(event, data) {
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
              this.hls.trigger(event, data);
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
                jumpThreshold = 0.2;

            // check buffer upfront
            // if less than 200ms is buffered, and media is playing but playhead is not moving,
            // and we have a new buffer range available upfront, let's seek to that one
            if (bufferInfo.len <= jumpThreshold) {
              if (currentTime > media.playbackRate * this.lastCurrentTime || !isPlaying) {
                // playhead moving or media not playing
                jumpThreshold = 0;
              } else {
                _utilsLogger.logger.trace('playback seems stuck');
              }
              // if we are below threshold, try to jump if next buffer range is close
              if (bufferInfo.len <= jumpThreshold) {
                // no buffer available @ currentTime, check if next buffer is close (more than 5ms diff but within a 300 ms range)
                var nextBufferStart = bufferInfo.nextStart,
                    delta = nextBufferStart - currentTime;
                if (nextBufferStart && delta < 0.3 && delta > 0.005 && !media.seeking) {
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
})();

exports['default'] = MSEMediaController;
module.exports = exports['default'];

},{"../demux/demuxer":13,"../errors":17,"../events":18,"../helper/level-helper":19,"../utils/binary-search":27,"../utils/logger":28}],6:[function(require,module,exports){
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

},{"../errors":17,"../utils/logger":28,"./aes128-decrypter":7}],9:[function(require,module,exports){
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

},{"../demux/id3":15,"../utils/logger":28,"./adts":10}],10:[function(require,module,exports){
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

},{"../errors":17,"../utils/logger":28}],11:[function(require,module,exports){
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

},{"../demux/aacdemuxer":9,"../demux/tsdemuxer":16,"../errors":17,"../events":18}],12:[function(require,module,exports){
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

},{"../demux/demuxer-inline":11,"../events":18,"../remux/mp4-remuxer":25,"events":1}],13:[function(require,module,exports){
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

},{"../crypt/decrypter":8,"../demux/demuxer-inline":11,"../demux/demuxer-worker":12,"../events":18,"../remux/mp4-remuxer":25,"../utils/logger":28,"webworkify":2}],14:[function(require,module,exports){
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

},{"../utils/logger":28}],15:[function(require,module,exports){
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

},{"../utils/logger":28}],16:[function(require,module,exports){
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

},{"../errors":17,"../events":18,"../utils/logger":28,"./adts":10,"./exp-golomb":14}],17:[function(require,module,exports){
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

},{}],18:[function(require,module,exports){
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
  // fired when hls.js instance starts destroying. Different from MEDIA_DETACHED as one could want to detach and reattach a media to the instance of hls.js to handle mid-rolls for example
  DESTROYING: 'hlsDestroying',
  // fired when a decrypt key loading starts - data: { frag : fragment object}
  KEY_LOADING: 'hlsKeyLoading',
  // fired when a decrypt key loading is completed - data: { frag : fragment object, payload : key payload, stats : { trequest, tfirst, tload, length}}
  KEY_LOADED: 'hlsKeyLoaded'
};
module.exports = exports['default'];

},{}],19:[function(require,module,exports){
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

},{"../utils/logger":28}],20:[function(require,module,exports){
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
  }, {
    key: 'DefaultConfig',
    get: function get() {
      if (!Hls.defaultConfig) {
        Hls.defaultConfig = {
          autoStartLoad: true,
          debug: false,
          maxBufferLength: 30,
          maxBufferSize: 60 * 1000 * 1000,
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
          mediaController: _controllerMseMediaController2['default']
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

},{"./controller/abr-controller":3,"./controller/level-controller":4,"./controller/mse-media-controller":5,"./errors":17,"./events":18,"./loader/fragment-loader":21,"./loader/key-loader":22,"./loader/playlist-loader":23,"./utils/logger":28,"./utils/xhr-loader":30,"events":1}],21:[function(require,module,exports){
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
})();

exports['default'] = FragmentLoader;
module.exports = exports['default'];

},{"../errors":17,"../events":18}],22:[function(require,module,exports){
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

},{"../errors":17,"../events":18}],23:[function(require,module,exports){
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

var _utilsAttrList = require('../utils/attr-list');

var _utilsAttrList2 = _interopRequireDefault(_utilsAttrList);

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

},{"../errors":17,"../events":18,"../utils/attr-list":26,"../utils/url":29}],24:[function(require,module,exports){
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

},{}],25:[function(require,module,exports){
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
        //logger.log(`Video/PTS/DTS:${pts}/${dts}`);
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
        var flags = samples[0].flags;
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
          samples = [];

      while (track.samples.length) {
        aacSample = track.samples.shift();
        unit = aacSample.unit;
        pts = aacSample.pts - this._initDTS;
        dts = aacSample.dts - this._initDTS;
        //logger.log('Audio/PTS:' + aacSample.pts.toFixed(0));
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
              } else if (delta < 0) {
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
      //set last sample duration as being identical to previous sample
      if (samples.length >= 2) {
        lastSampleDuration = samples[samples.length - 2].duration;
        mp4Sample.duration = lastSampleDuration;
      }
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

},{"../errors":17,"../events":18,"../remux/mp4-generator":24,"../utils/logger":28}],26:[function(require,module,exports){

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
      var re = /(.+?)=((?:\".*?\")|.*?)(?:,|$)/g;
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

},{}],27:[function(require,module,exports){
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

},{}],28:[function(require,module,exports){
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

},{}],29:[function(require,module,exports){
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

},{}],30:[function(require,module,exports){
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
      xhr.onreadystatechange = this.statechange.bind(this);
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
    key: 'statechange',
    value: function statechange(event) {
      var xhr = event.currentTarget,
          status = xhr.status,
          stats = this.stats;
      // don't proceed if xhr has been aborted
      // 4 = Response from server has been completely loaded.
      if (!stats.aborted && xhr.readyState === 4) {
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

},{"../utils/logger":28}]},{},[20])(20)
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwibm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwibm9kZV9tb2R1bGVzL3dlYndvcmtpZnkvaW5kZXguanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2NvbnRyb2xsZXIvYWJyLWNvbnRyb2xsZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2NvbnRyb2xsZXIvbGV2ZWwtY29udHJvbGxlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvY29udHJvbGxlci9tc2UtbWVkaWEtY29udHJvbGxlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvY3J5cHQvYWVzLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9jcnlwdC9hZXMxMjgtZGVjcnlwdGVyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9jcnlwdC9kZWNyeXB0ZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2RlbXV4L2FhY2RlbXV4ZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2RlbXV4L2FkdHMuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2RlbXV4L2RlbXV4ZXItaW5saW5lLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9kZW11eC9kZW11eGVyLXdvcmtlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvZGVtdXgvZGVtdXhlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvZGVtdXgvZXhwLWdvbG9tYi5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvZGVtdXgvaWQzLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9kZW11eC90c2RlbXV4ZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2Vycm9ycy5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvZXZlbnRzLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9oZWxwZXIvbGV2ZWwtaGVscGVyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9obHMuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2xvYWRlci9mcmFnbWVudC1sb2FkZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2xvYWRlci9rZXktbG9hZGVyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9sb2FkZXIvcGxheWxpc3QtbG9hZGVyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9yZW11eC9tcDQtZ2VuZXJhdG9yLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9yZW11eC9tcDQtcmVtdXhlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvdXRpbHMvYXR0ci1saXN0LmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy91dGlscy9iaW5hcnktc2VhcmNoLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy91dGlscy9sb2dnZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL3V0aWxzL3VybC5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvdXRpbHMveGhyLWxvYWRlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNB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R0FBRyxDQUFDLEdBQUcsR0FBRyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztBQUNuRyxVQUFFLEdBQUcsTUFBTSxDQUFDLENBQUMsS0FBRyxFQUFFLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxJQUFFLEVBQUUsR0FBRyxHQUFHLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxJQUFFLENBQUMsR0FBRyxHQUFHLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDbkcsU0FBQyxHQUFJLE1BQU0sQ0FBQyxDQUFDLEtBQUcsRUFBRSxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsSUFBRSxFQUFFLEdBQUcsR0FBRyxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsSUFBRSxDQUFDLEdBQUcsR0FBRyxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsR0FBRyxHQUFHLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ25HLGNBQU0sSUFBSSxDQUFDLENBQUM7QUFDWixTQUFDLEdBQUMsRUFBRSxDQUFDLEFBQUMsQ0FBQyxHQUFDLEVBQUUsQ0FBQyxBQUFDLENBQUMsR0FBQyxFQUFFLENBQUM7T0FDbEI7OztBQUdELFdBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQ3RCLFdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQSxHQUFJLE1BQU0sQ0FBQyxHQUNwQixJQUFJLENBQUMsQ0FBQyxLQUFHLEVBQUUsQ0FBTyxJQUFFLEVBQUUsR0FDdEIsSUFBSSxDQUFDLENBQUMsSUFBRSxFQUFFLEdBQUksR0FBRyxDQUFDLElBQUUsRUFBRSxHQUN0QixJQUFJLENBQUMsQ0FBQyxJQUFFLENBQUMsR0FBSyxHQUFHLENBQUMsSUFBRSxDQUFDLEdBQ3JCLElBQUksQ0FBQyxDQUFDLEdBQVEsR0FBRyxDQUFD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aUJBQUssQ0FBQztBQUFFLHNCQUFRLEdBQUcsQ0FBQyxFQUFFLEVBQUMsRUFBRSxDQUFDLENBQUMsQUFBQyxNQUFNO0FBQUEsQUFDbEMsaUJBQUssQ0FBQztBQUFFLHNCQUFRLEdBQUcsQ0FBQyxFQUFFLEVBQUMsRUFBRSxDQUFDLENBQUMsQUFBQyxNQUFNO0FBQUEsQUFDbEMsaUJBQUssQ0FBQztBQUFFLHNCQUFRLEdBQUcsQ0FBQyxFQUFFLEVBQUMsRUFBRSxDQUFDLENBQUMsQUFBQyxNQUFNO0FBQUEsQUFDbEMsaUJBQUssQ0FBQztBQUFFLHNCQUFRLEdBQUcsQ0FBQyxFQUFFLEVBQUMsRUFBRSxDQUFDLENBQUMsQUFBQyxNQUFNO0FBQUEsQUFDbEMsaUJBQUssQ0FBQztBQUFFLHNCQUFRLEdBQUcsQ0FBQyxFQUFFLEVBQUMsRUFBRSxDQUFDLENBQUMsQUFBQyxNQUFNO0FBQUEsQUFDbEMsaUJBQUssQ0FBQztBQUFFLHNCQUFRLEdBQUcsQ0FBQyxFQUFFLEVBQUMsRUFBRSxDQUFDLENBQUMsQUFBQyxNQUFNO0FBQUEsQUFDbEMsaUJBQUssQ0FBQztBQUFFLHNCQUFRLEdBQUcsQ0FBQyxFQUFFLEVBQUMsRUFBRSxDQUFDLENBQUMsQUFBQyxNQUFNO0FBQUEsQUFDbEMsaUJBQUssRUFBRTtBQUFFLHNCQUFRLEdBQUcsQ0FBQyxFQUFFLEVBQUMsRUFBRSxDQUFDLENBQUMsQUFBQyxNQUFNO0FBQUEsQUFDbkMsaUJBQUssRUFBRTtBQUFFLHNCQUFRLEdBQUcsQ0FBQyxFQUFFLEVBQUMsRUFBRSxDQUFDLENBQUMsQUFBQyxNQUFNO0FBQUEsQUFDbkMsaUJBQUssRUFBRTtBQUFFLHNCQUFRLEdBQUcsQ0FBQyxFQUFFLEVBQUMsRUFBRSxDQUFDLENBQUMsQUFBQyxNQUFNO0FBQUEsQUFDbkMsaUJBQUssRUFBRTtBQUFFLHNCQUFRLEdBQUcsQ0FBQyxHQUFHLEVBQUMsRUFBRSxDQUFDLENBQUMsQUFBQyxNQUFNO0FBQUEsQUFDcEMsaUJBQUssRUFBRTtBQUFFLHNCQUFRLEdBQUcsQ0FBQyxDQUFDLEVBQUMs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Q0FBQyxFQUFFLEVBQUU7QUFDckMsWUFBSSxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDcEIsV0FBRyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUM7QUFDdEIsV0FBRyxDQUFDLElBQUksQ0FBQyxBQUFDLEdBQUcsS0FBSyxDQUFDLEdBQUksSUFBSSxDQUFDLENBQUM7QUFDN0IsV0FBRyxDQUFDLElBQUksQ0FBRSxHQUFHLEdBQUcsSUFBSSxDQUFFLENBQUM7QUFDdkIsV0FBRyxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7T0FDcEQ7OztBQUdELFdBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7QUFDckMsWUFBSSxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDcEIsV0FBRyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUM7QUFDdEIsV0FBRyxDQUFDLElBQUksQ0FBQyxBQUFDLEdBQUcsS0FBSyxDQUFDLEdBQUksSUFBSSxDQUFDLENBQUM7QUFDN0IsV0FBRyxDQUFDLElBQUksQ0FBRSxHQUFHLEdBQUcsSUFBSSxDQUFFLENBQUM7QUFDdkIsV0FBRyxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7T0FDcEQ7O0FBRUQsVUFBSSxJQUFJLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLFVBQVUsQ0FBQyxDQUMxQyxJQUFJO0FBQ0osU0FBRyxDQUFDLENBQUMsQ0FBQztBQUNOLFNBQUcsQ0FBQyxDQUFDLENBQUM7QUFDTixTQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ04sVUFBSSxHQUFH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VUFBVSxFQUFFO0FBQ25CLFlBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDO09BQy9CO0tBQ0Y7OztTQXpHRyxTQUFTOzs7cUJBNEdBLFNBQVMiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkO1xufVxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4vLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3Ncbi8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gIGlmICghaXNOdW1iZXIobikgfHwgbiA8IDAgfHwgaXNOYU4obikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCduIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXInKTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBlciwgaGFuZGxlciwgbGVuLCBhcmdzLCBpLCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgIGlmICghdGhpcy5fZXZlbnRzLmVycm9yIHx8XG4gICAgICAgIChpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpICYmICF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKSkge1xuICAgICAgZXIgPSBhcmd1bWVudHNbMV07XG4gICAgICBpZiAoZXIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICB0aHJvdyBlcjsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgIH1cbiAgICAgIHRocm93IFR5cGVFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4nKTtcbiAgICB9XG4gIH1cblxuICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc1VuZGVmaW5lZChoYW5kbGVyKSlcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlcikpIHtcbiAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIC8vIGZhc3QgY2FzZXNcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICBicmVhaztcbiAgICAgIC8vIHNsb3dlclxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICAgICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICBoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChpc09iamVjdChoYW5kbGVyKSkge1xuICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcblxuICAgIGxpc3RlbmVycyA9IGhhbmRsZXIuc2xpY2UoKTtcbiAgICBsZW4gPSBsaXN0ZW5lcnMubGVuZ3RoO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIGxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBtO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBUbyBhdm9pZCByZWN1cnNpb24gaW4gdGhlIGNhc2UgdGhhdCB0eXBlID09PSBcIm5ld0xpc3RlbmVyXCIhIEJlZm9yZVxuICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyXCIuXG4gIGlmICh0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpXG4gICAgdGhpcy5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsXG4gICAgICAgICAgICAgIGlzRnVuY3Rpb24obGlzdGVuZXIubGlzdGVuZXIpID9cbiAgICAgICAgICAgICAgbGlzdGVuZXIubGlzdGVuZXIgOiBsaXN0ZW5lcik7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgLy8gT3B0aW1pemUgdGhlIGNhc2Ugb2Ygb25lIGxpc3RlbmVyLiBEb24ndCBuZWVkIHRoZSBleHRyYSBhcnJheSBvYmplY3QuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbGlzdGVuZXI7XG4gIGVsc2UgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcbiAgZWxzZVxuICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV0sIGxpc3RlbmVyXTtcblxuICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xuICBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSAmJiAhdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCkge1xuICAgIHZhciBtO1xuICAgIGlmICghaXNVbmRlZmluZWQodGhpcy5fbWF4TGlzdGVuZXJzKSkge1xuICAgICAgbSA9IHRoaXMuX21heExpc3RlbmVycztcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IEV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzO1xuICAgIH1cblxuICAgIGlmIChtICYmIG0gPiAwICYmIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGggPiBtKSB7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkID0gdHJ1ZTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO1xuICAgICAgaWYgKHR5cGVvZiBjb25zb2xlLnRyYWNlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIC8vIG5vdCBzdXBwb3J0ZWQgaW4gSUUgMTBcbiAgICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICB2YXIgZmlyZWQgPSBmYWxzZTtcblxuICBmdW5jdGlvbiBnKCkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgZyk7XG5cbiAgICBpZiAoIWZpcmVkKSB7XG4gICAgICBmaXJlZCA9IHRydWU7XG4gICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgfVxuXG4gIGcubGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgdGhpcy5vbih0eXBlLCBnKTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIGVtaXRzIGEgJ3JlbW92ZUxpc3RlbmVyJyBldmVudCBpZmYgdGhlIGxpc3RlbmVyIHdhcyByZW1vdmVkXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIGxpc3QsIHBvc2l0aW9uLCBsZW5ndGgsIGk7XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgbGlzdCA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgbGVuZ3RoID0gbGlzdC5sZW5ndGg7XG4gIHBvc2l0aW9uID0gLTE7XG5cbiAgaWYgKGxpc3QgPT09IGxpc3RlbmVyIHx8XG4gICAgICAoaXNGdW5jdGlvbihsaXN0Lmxpc3RlbmVyKSAmJiBsaXN0Lmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuXG4gIH0gZWxzZSBpZiAoaXNPYmplY3QobGlzdCkpIHtcbiAgICBmb3IgKGkgPSBsZW5ndGg7IGktLSA+IDA7KSB7XG4gICAgICBpZiAobGlzdFtpXSA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgICAobGlzdFtpXS5saXN0ZW5lciAmJiBsaXN0W2ldLmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgcG9zaXRpb24gPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9zaXRpb24gPCAwKVxuICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICAgIGxpc3QubGVuZ3RoID0gMDtcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3Quc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBrZXksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICByZXR1cm4gdGhpcztcblxuICAvLyBub3QgbGlzdGVuaW5nIGZvciByZW1vdmVMaXN0ZW5lciwgbm8gbmVlZCB0byBlbWl0XG4gIGlmICghdGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApXG4gICAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICBlbHNlIGlmICh0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gZW1pdCByZW1vdmVMaXN0ZW5lciBmb3IgYWxsIGxpc3RlbmVycyBvbiBhbGwgZXZlbnRzXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgZm9yIChrZXkgaW4gdGhpcy5fZXZlbnRzKSB7XG4gICAgICBpZiAoa2V5ID09PSAncmVtb3ZlTGlzdGVuZXInKSBjb250aW51ZTtcbiAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKGtleSk7XG4gICAgfVxuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdyZW1vdmVMaXN0ZW5lcicpO1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgbGlzdGVuZXJzID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGxpc3RlbmVycykpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVycyk7XG4gIH0gZWxzZSB7XG4gICAgLy8gTElGTyBvcmRlclxuICAgIHdoaWxlIChsaXN0ZW5lcnMubGVuZ3RoKVxuICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnNbbGlzdGVuZXJzLmxlbmd0aCAtIDFdKTtcbiAgfVxuICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gW107XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24odGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcbiAgZWxzZVxuICAgIHJldCA9IHRoaXMuX2V2ZW50c1t0eXBlXS5zbGljZSgpO1xuICByZXR1cm4gcmV0O1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghZW1pdHRlci5fZXZlbnRzIHx8ICFlbWl0dGVyLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gMDtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbihlbWl0dGVyLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IDE7XG4gIGVsc2VcbiAgICByZXQgPSBlbWl0dGVyLl9ldmVudHNbdHlwZV0ubGVuZ3RoO1xuICByZXR1cm4gcmV0O1xufTtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuIiwidmFyIGJ1bmRsZUZuID0gYXJndW1lbnRzWzNdO1xudmFyIHNvdXJjZXMgPSBhcmd1bWVudHNbNF07XG52YXIgY2FjaGUgPSBhcmd1bWVudHNbNV07XG5cbnZhciBzdHJpbmdpZnkgPSBKU09OLnN0cmluZ2lmeTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoZm4pIHtcbiAgICB2YXIga2V5cyA9IFtdO1xuICAgIHZhciB3a2V5O1xuICAgIHZhciBjYWNoZUtleXMgPSBPYmplY3Qua2V5cyhjYWNoZSk7XG4gICAgXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSBjYWNoZUtleXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIHZhciBrZXkgPSBjYWNoZUtleXNbaV07XG4gICAgICAgIGlmIChjYWNoZVtrZXldLmV4cG9ydHMgPT09IGZuKSB7XG4gICAgICAgICAgICB3a2V5ID0ga2V5O1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgaWYgKCF3a2V5KSB7XG4gICAgICAgIHdrZXkgPSBNYXRoLmZsb29yKE1hdGgucG93KDE2LCA4KSAqIE1hdGgucmFuZG9tKCkpLnRvU3RyaW5nKDE2KTtcbiAgICAgICAgdmFyIHdjYWNoZSA9IHt9O1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGNhY2hlS2V5cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBrZXkgPSBjYWNoZUtleXNbaV07XG4gICAgICAgICAgICB3Y2FjaGVba2V5XSA9IGtleTtcbiAgICAgICAgfVxuICAgICAgICBzb3VyY2VzW3drZXldID0gW1xuICAgICAgICAgICAgRnVuY3Rpb24oWydyZXF1aXJlJywnbW9kdWxlJywnZXhwb3J0cyddLCAnKCcgKyBmbiArICcpKHNlbGYpJyksXG4gICAgICAgICAgICB3Y2FjaGVcbiAgICAgICAgXTtcbiAgICB9XG4gICAgdmFyIHNrZXkgPSBNYXRoLmZsb29yKE1hdGgucG93KDE2LCA4KSAqIE1hdGgucmFuZG9tKCkpLnRvU3RyaW5nKDE2KTtcbiAgICBcbiAgICB2YXIgc2NhY2hlID0ge307IHNjYWNoZVt3a2V5XSA9IHdrZXk7XG4gICAgc291cmNlc1tza2V5XSA9IFtcbiAgICAgICAgRnVuY3Rpb24oWydyZXF1aXJlJ10sJ3JlcXVpcmUoJyArIHN0cmluZ2lmeSh3a2V5KSArICcpKHNlbGYpJyksXG4gICAgICAgIHNjYWNoZVxuICAgIF07XG4gICAgXG4gICAgdmFyIHNyYyA9ICcoJyArIGJ1bmRsZUZuICsgJykoeydcbiAgICAgICAgKyBPYmplY3Qua2V5cyhzb3VyY2VzKS5tYXAoZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgcmV0dXJuIHN0cmluZ2lmeShrZXkpICsgJzpbJ1xuICAgICAgICAgICAgICAgICsgc291cmNlc1trZXldWzBdXG4gICAgICAgICAgICAgICAgKyAnLCcgKyBzdHJpbmdpZnkoc291cmNlc1trZXldWzFdKSArICddJ1xuICAgICAgICAgICAgO1xuICAgICAgICB9KS5qb2luKCcsJylcbiAgICAgICAgKyAnfSx7fSxbJyArIHN0cmluZ2lmeShza2V5KSArICddKSdcbiAgICA7XG4gICAgXG4gICAgdmFyIFVSTCA9IHdpbmRvdy5VUkwgfHwgd2luZG93LndlYmtpdFVSTCB8fCB3aW5kb3cubW96VVJMIHx8IHdpbmRvdy5tc1VSTDtcbiAgICBcbiAgICByZXR1cm4gbmV3IFdvcmtlcihVUkwuY3JlYXRlT2JqZWN0VVJMKFxuICAgICAgICBuZXcgQmxvYihbc3JjXSwgeyB0eXBlOiAndGV4dC9qYXZhc2NyaXB0JyB9KVxuICAgICkpO1xufTtcbiIsIi8qXG4gKiBzaW1wbGUgQUJSIENvbnRyb2xsZXJcbiovXG5cbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuXG5jbGFzcyBBYnJDb250cm9sbGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMpIHtcbiAgICB0aGlzLmhscyA9IGhscztcbiAgICB0aGlzLmxhc3RmZXRjaGxldmVsID0gMDtcbiAgICB0aGlzLl9hdXRvTGV2ZWxDYXBwaW5nID0gLTE7XG4gICAgdGhpcy5fbmV4dEF1dG9MZXZlbCA9IC0xO1xuICAgIHRoaXMub25mbHAgPSB0aGlzLm9uRnJhZ21lbnRMb2FkUHJvZ3Jlc3MuYmluZCh0aGlzKTtcbiAgICBobHMub24oRXZlbnQuRlJBR19MT0FEX1BST0dSRVNTLCB0aGlzLm9uZmxwKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5obHMub2ZmKEV2ZW50LkZSQUdfTE9BRF9QUk9HUkVTUywgdGhpcy5vbmZscCk7XG4gIH1cblxuICBvbkZyYWdtZW50TG9hZFByb2dyZXNzKGV2ZW50LCBkYXRhKSB7XG4gICAgdmFyIHN0YXRzID0gZGF0YS5zdGF0cztcbiAgICBpZiAoc3RhdHMuYWJvcnRlZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLmxhc3RmZXRjaGR1cmF0aW9uID0gKHBlcmZvcm1hbmNlLm5vdygpIC0gc3RhdHMudHJlcXVlc3QpIC8gMTAwMDtcbiAgICAgIHRoaXMubGFzdGZldGNobGV2ZWwgPSBkYXRhLmZyYWcubGV2ZWw7XG4gICAgICB0aGlzLmxhc3RidyA9IChzdGF0cy5sb2FkZWQgKiA4KSAvIHRoaXMubGFzdGZldGNoZHVyYXRpb247XG4gICAgICAvL2NvbnNvbGUubG9nKGBmZXRjaER1cmF0aW9uOiR7dGhpcy5sYXN0ZmV0Y2hkdXJhdGlvbn0sYnc6JHsodGhpcy5sYXN0YncvMTAwMCkudG9GaXhlZCgwKX0vJHtzdGF0cy5hYm9ydGVkfWApO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBSZXR1cm4gdGhlIGNhcHBpbmcvbWF4IGxldmVsIHZhbHVlIHRoYXQgY291bGQgYmUgdXNlZCBieSBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uIGFsZ29yaXRobSAqKi9cbiAgZ2V0IGF1dG9MZXZlbENhcHBpbmcoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2F1dG9MZXZlbENhcHBpbmc7XG4gIH1cblxuICAvKiogc2V0IHRoZSBjYXBwaW5nL21heCBsZXZlbCB2YWx1ZSB0aGF0IGNvdWxkIGJlIHVzZWQgYnkgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBhbGdvcml0aG0gKiovXG4gIHNldCBhdXRvTGV2ZWxDYXBwaW5nKG5ld0xldmVsKSB7XG4gICAgdGhpcy5fYXV0b0xldmVsQ2FwcGluZyA9IG5ld0xldmVsO1xuICB9XG5cbiAgZ2V0IG5leHRBdXRvTGV2ZWwoKSB7XG4gICAgdmFyIGxhc3RidyA9IHRoaXMubGFzdGJ3LCBobHMgPSB0aGlzLmhscyxhZGp1c3RlZGJ3LCBpLCBtYXhBdXRvTGV2ZWw7XG4gICAgaWYgKHRoaXMuX2F1dG9MZXZlbENhcHBpbmcgPT09IC0xKSB7XG4gICAgICBtYXhBdXRvTGV2ZWwgPSBobHMubGV2ZWxzLmxlbmd0aCAtIDE7XG4gICAgfSBlbHNlIHtcbiAgICAgIG1heEF1dG9MZXZlbCA9IHRoaXMuX2F1dG9MZXZlbENhcHBpbmc7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX25leHRBdXRvTGV2ZWwgIT09IC0xKSB7XG4gICAgICB2YXIgbmV4dExldmVsID0gTWF0aC5taW4odGhpcy5fbmV4dEF1dG9MZXZlbCxtYXhBdXRvTGV2ZWwpO1xuICAgICAgaWYgKG5leHRMZXZlbCA9PT0gdGhpcy5sYXN0ZmV0Y2hsZXZlbCkge1xuICAgICAgICB0aGlzLl9uZXh0QXV0b0xldmVsID0gLTE7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gbmV4dExldmVsO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGZvbGxvdyBhbGdvcml0aG0gY2FwdHVyZWQgZnJvbSBzdGFnZWZyaWdodCA6XG4gICAgLy8gaHR0cHM6Ly9hbmRyb2lkLmdvb2dsZXNvdXJjZS5jb20vcGxhdGZvcm0vZnJhbWV3b3Jrcy9hdi8rL21hc3Rlci9tZWRpYS9saWJzdGFnZWZyaWdodC9odHRwbGl2ZS9MaXZlU2Vzc2lvbi5jcHBcbiAgICAvLyBQaWNrIHRoZSBoaWdoZXN0IGJhbmR3aWR0aCBzdHJlYW0gYmVsb3cgb3IgZXF1YWwgdG8gZXN0aW1hdGVkIGJhbmR3aWR0aC5cbiAgICBmb3IgKGkgPSAwOyBpIDw9IG1heEF1dG9MZXZlbDsgaSsrKSB7XG4gICAgLy8gY29uc2lkZXIgb25seSA4MCUgb2YgdGhlIGF2YWlsYWJsZSBiYW5kd2lkdGgsIGJ1dCBpZiB3ZSBhcmUgc3dpdGNoaW5nIHVwLFxuICAgIC8vIGJlIGV2ZW4gbW9yZSBjb25zZXJ2YXRpdmUgKDcwJSkgdG8gYXZvaWQgb3ZlcmVzdGltYXRpbmcgYW5kIGltbWVkaWF0ZWx5XG4gICAgLy8gc3dpdGNoaW5nIGJhY2suXG4gICAgICBpZiAoaSA8PSB0aGlzLmxhc3RmZXRjaGxldmVsKSB7XG4gICAgICAgIGFkanVzdGVkYncgPSAwLjggKiBsYXN0Ync7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhZGp1c3RlZGJ3ID0gMC43ICogbGFzdGJ3O1xuICAgICAgfVxuICAgICAgaWYgKGFkanVzdGVkYncgPCBobHMubGV2ZWxzW2ldLmJpdHJhdGUpIHtcbiAgICAgICAgcmV0dXJuIE1hdGgubWF4KDAsIGkgLSAxKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGkgLSAxO1xuICB9XG5cbiAgc2V0IG5leHRBdXRvTGV2ZWwobmV4dExldmVsKSB7XG4gICAgdGhpcy5fbmV4dEF1dG9MZXZlbCA9IG5leHRMZXZlbDtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBBYnJDb250cm9sbGVyO1xuXG4iLCIvKlxuICogTGV2ZWwgQ29udHJvbGxlclxuKi9cblxuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuXG5jbGFzcyBMZXZlbENvbnRyb2xsZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHRoaXMuaGxzID0gaGxzO1xuICAgIHRoaXMub25tbCA9IHRoaXMub25NYW5pZmVzdExvYWRlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25sbCA9IHRoaXMub25MZXZlbExvYWRlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25lcnIgPSB0aGlzLm9uRXJyb3IuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9udGljayA9IHRoaXMudGljay5iaW5kKHRoaXMpO1xuICAgIGhscy5vbihFdmVudC5NQU5JRkVTVF9MT0FERUQsIHRoaXMub25tbCk7XG4gICAgaGxzLm9uKEV2ZW50LkxFVkVMX0xPQURFRCwgdGhpcy5vbmxsKTtcbiAgICBobHMub24oRXZlbnQuRVJST1IsIHRoaXMub25lcnIpO1xuICAgIHRoaXMuX21hbnVhbExldmVsID0gdGhpcy5fYXV0b0xldmVsQ2FwcGluZyA9IC0xO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB2YXIgaGxzID0gdGhpcy5obHM7XG4gICAgaGxzLm9mZihFdmVudC5NQU5JRkVTVF9MT0FERUQsIHRoaXMub25tbCk7XG4gICAgaGxzLm9mZihFdmVudC5MRVZFTF9MT0FERUQsIHRoaXMub25sbCk7XG4gICAgaGxzLm9mZihFdmVudC5FUlJPUiwgdGhpcy5vbmVycik7XG4gICAgaWYgKHRoaXMudGltZXIpIHtcbiAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnRpbWVyKTtcbiAgICB9XG4gICAgdGhpcy5fbWFudWFsTGV2ZWwgPSAtMTtcbiAgfVxuXG4gIG9uTWFuaWZlc3RMb2FkZWQoZXZlbnQsIGRhdGEpIHtcbiAgICB2YXIgbGV2ZWxzMCA9IFtdLCBsZXZlbHMgPSBbXSwgYml0cmF0ZVN0YXJ0LCBpLCBiaXRyYXRlU2V0ID0ge30sIHZpZGVvQ29kZWNGb3VuZCA9IGZhbHNlLCBhdWRpb0NvZGVjRm91bmQgPSBmYWxzZSwgaGxzID0gdGhpcy5obHM7XG5cbiAgICAvLyByZWdyb3VwIHJlZHVuZGFudCBsZXZlbCB0b2dldGhlclxuICAgIGRhdGEubGV2ZWxzLmZvckVhY2gobGV2ZWwgPT4ge1xuICAgICAgaWYobGV2ZWwudmlkZW9Db2RlYykge1xuICAgICAgICB2aWRlb0NvZGVjRm91bmQgPSB0cnVlO1xuICAgICAgfVxuICAgICAgaWYobGV2ZWwuYXVkaW9Db2RlYykge1xuICAgICAgICBhdWRpb0NvZGVjRm91bmQgPSB0cnVlO1xuICAgICAgfVxuICAgICAgdmFyIHJlZHVuZGFudExldmVsSWQgPSBiaXRyYXRlU2V0W2xldmVsLmJpdHJhdGVdO1xuICAgICAgaWYgKHJlZHVuZGFudExldmVsSWQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBiaXRyYXRlU2V0W2xldmVsLmJpdHJhdGVdID0gbGV2ZWxzMC5sZW5ndGg7XG4gICAgICAgIGxldmVsLnVybCA9IFtsZXZlbC51cmxdO1xuICAgICAgICBsZXZlbC51cmxJZCA9IDA7XG4gICAgICAgIGxldmVsczAucHVzaChsZXZlbCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsZXZlbHMwW3JlZHVuZGFudExldmVsSWRdLnVybC5wdXNoKGxldmVsLnVybCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyByZW1vdmUgYXVkaW8tb25seSBsZXZlbCBpZiB3ZSBhbHNvIGhhdmUgbGV2ZWxzIHdpdGggYXVkaW8rdmlkZW8gY29kZWNzIHNpZ25hbGxlZFxuICAgIGlmKHZpZGVvQ29kZWNGb3VuZCAmJiBhdWRpb0NvZGVjRm91bmQpIHtcbiAgICAgIGxldmVsczAuZm9yRWFjaChsZXZlbCA9PiB7XG4gICAgICAgIGlmKGxldmVsLnZpZGVvQ29kZWMpIHtcbiAgICAgICAgICBsZXZlbHMucHVzaChsZXZlbCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBsZXZlbHMgPSBsZXZlbHMwO1xuICAgIH1cblxuICAgIC8vIG9ubHkga2VlcCBsZXZlbCB3aXRoIHN1cHBvcnRlZCBhdWRpby92aWRlbyBjb2RlY3NcbiAgICBsZXZlbHMgPSBsZXZlbHMuZmlsdGVyKGZ1bmN0aW9uKGxldmVsKSB7XG4gICAgICB2YXIgY2hlY2tTdXBwb3J0ZWQgPSBmdW5jdGlvbihjb2RlYykgeyByZXR1cm4gTWVkaWFTb3VyY2UuaXNUeXBlU3VwcG9ydGVkKGB2aWRlby9tcDQ7Y29kZWNzPSR7Y29kZWN9YCk7fTtcbiAgICAgIHZhciBhdWRpb0NvZGVjID0gbGV2ZWwuYXVkaW9Db2RlYywgdmlkZW9Db2RlYyA9IGxldmVsLnZpZGVvQ29kZWM7XG5cbiAgICAgIHJldHVybiAoIWF1ZGlvQ29kZWMgfHwgY2hlY2tTdXBwb3J0ZWQoYXVkaW9Db2RlYykpICYmXG4gICAgICAgICAgICAgKCF2aWRlb0NvZGVjIHx8IGNoZWNrU3VwcG9ydGVkKHZpZGVvQ29kZWMpKTtcbiAgICB9KTtcblxuICAgIGlmKGxldmVscy5sZW5ndGgpIHtcbiAgICAgIC8vIHN0YXJ0IGJpdHJhdGUgaXMgdGhlIGZpcnN0IGJpdHJhdGUgb2YgdGhlIG1hbmlmZXN0XG4gICAgICBiaXRyYXRlU3RhcnQgPSBsZXZlbHNbMF0uYml0cmF0ZTtcbiAgICAgIC8vIHNvcnQgbGV2ZWwgb24gYml0cmF0ZVxuICAgICAgbGV2ZWxzLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgICAgcmV0dXJuIGEuYml0cmF0ZSAtIGIuYml0cmF0ZTtcbiAgICAgIH0pO1xuICAgICAgdGhpcy5fbGV2ZWxzID0gbGV2ZWxzO1xuICAgICAgLy8gZmluZCBpbmRleCBvZiBmaXJzdCBsZXZlbCBpbiBzb3J0ZWQgbGV2ZWxzXG4gICAgICBmb3IgKGkgPSAwOyBpIDwgbGV2ZWxzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChsZXZlbHNbaV0uYml0cmF0ZSA9PT0gYml0cmF0ZVN0YXJ0KSB7XG4gICAgICAgICAgdGhpcy5fZmlyc3RMZXZlbCA9IGk7XG4gICAgICAgICAgbG9nZ2VyLmxvZyhgbWFuaWZlc3QgbG9hZGVkLCR7bGV2ZWxzLmxlbmd0aH0gbGV2ZWwocykgZm91bmQsIGZpcnN0IGJpdHJhdGU6JHtiaXRyYXRlU3RhcnR9YCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGhscy50cmlnZ2VyKEV2ZW50Lk1BTklGRVNUX1BBUlNFRCwge2xldmVsczogdGhpcy5fbGV2ZWxzLCBmaXJzdExldmVsOiB0aGlzLl9maXJzdExldmVsLCBzdGF0czogZGF0YS5zdGF0c30pO1xuICAgIH0gZWxzZSB7XG4gICAgICBobHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTkVUV09SS19FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLk1BTklGRVNUX1BBUlNJTkdfRVJST1IsIGZhdGFsOiB0cnVlLCB1cmw6IGhscy51cmwsIHJlYXNvbjogJ25vIGNvbXBhdGlibGUgbGV2ZWwgZm91bmQgaW4gbWFuaWZlc3QnfSk7XG4gICAgfVxuICAgIHJldHVybjtcbiAgfVxuXG4gIGdldCBsZXZlbHMoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2xldmVscztcbiAgfVxuXG4gIGdldCBsZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5fbGV2ZWw7XG4gIH1cblxuICBzZXQgbGV2ZWwobmV3TGV2ZWwpIHtcbiAgICBpZiAodGhpcy5fbGV2ZWwgIT09IG5ld0xldmVsIHx8IHRoaXMuX2xldmVsc1tuZXdMZXZlbF0uZGV0YWlscyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLnNldExldmVsSW50ZXJuYWwobmV3TGV2ZWwpO1xuICAgIH1cbiAgfVxuXG4gc2V0TGV2ZWxJbnRlcm5hbChuZXdMZXZlbCkge1xuICAgIC8vIGNoZWNrIGlmIGxldmVsIGlkeCBpcyB2YWxpZFxuICAgIGlmIChuZXdMZXZlbCA+PSAwICYmIG5ld0xldmVsIDwgdGhpcy5fbGV2ZWxzLmxlbmd0aCkge1xuICAgICAgLy8gc3RvcHBpbmcgbGl2ZSByZWxvYWRpbmcgdGltZXIgaWYgYW55XG4gICAgICBpZiAodGhpcy50aW1lcikge1xuICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy50aW1lcik7XG4gICAgICAgdGhpcy50aW1lciA9IG51bGw7XG4gICAgICB9XG4gICAgICB0aGlzLl9sZXZlbCA9IG5ld0xldmVsO1xuICAgICAgbG9nZ2VyLmxvZyhgc3dpdGNoaW5nIHRvIGxldmVsICR7bmV3TGV2ZWx9YCk7XG4gICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkxFVkVMX1NXSVRDSCwge2xldmVsOiBuZXdMZXZlbH0pO1xuICAgICAgdmFyIGxldmVsID0gdGhpcy5fbGV2ZWxzW25ld0xldmVsXTtcbiAgICAgICAvLyBjaGVjayBpZiB3ZSBuZWVkIHRvIGxvYWQgcGxheWxpc3QgZm9yIHRoaXMgbGV2ZWxcbiAgICAgIGlmIChsZXZlbC5kZXRhaWxzID09PSB1bmRlZmluZWQgfHwgbGV2ZWwuZGV0YWlscy5saXZlID09PSB0cnVlKSB7XG4gICAgICAgIC8vIGxldmVsIG5vdCByZXRyaWV2ZWQgeWV0LCBvciBsaXZlIHBsYXlsaXN0IHdlIG5lZWQgdG8gKHJlKWxvYWQgaXRcbiAgICAgICAgbG9nZ2VyLmxvZyhgKHJlKWxvYWRpbmcgcGxheWxpc3QgZm9yIGxldmVsICR7bmV3TGV2ZWx9YCk7XG4gICAgICAgIHZhciB1cmxJZCA9IGxldmVsLnVybElkO1xuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkxFVkVMX0xPQURJTkcsIHt1cmw6IGxldmVsLnVybFt1cmxJZF0sIGxldmVsOiBuZXdMZXZlbCwgaWQ6IHVybElkfSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGludmFsaWQgbGV2ZWwgaWQgZ2l2ZW4sIHRyaWdnZXIgZXJyb3JcbiAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlIDogRXJyb3JUeXBlcy5PVEhFUl9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkxFVkVMX1NXSVRDSF9FUlJPUiwgbGV2ZWw6IG5ld0xldmVsLCBmYXRhbDogZmFsc2UsIHJlYXNvbjogJ2ludmFsaWQgbGV2ZWwgaWR4J30pO1xuICAgIH1cbiB9XG5cbiAgZ2V0IG1hbnVhbExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLl9tYW51YWxMZXZlbDtcbiAgfVxuXG4gIHNldCBtYW51YWxMZXZlbChuZXdMZXZlbCkge1xuICAgIHRoaXMuX21hbnVhbExldmVsID0gbmV3TGV2ZWw7XG4gICAgaWYgKG5ld0xldmVsICE9PSAtMSkge1xuICAgICAgdGhpcy5sZXZlbCA9IG5ld0xldmVsO1xuICAgIH1cbiAgfVxuXG4gIGdldCBmaXJzdExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLl9maXJzdExldmVsO1xuICB9XG5cbiAgc2V0IGZpcnN0TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICB0aGlzLl9maXJzdExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICBnZXQgc3RhcnRMZXZlbCgpIHtcbiAgICBpZiAodGhpcy5fc3RhcnRMZXZlbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gdGhpcy5fZmlyc3RMZXZlbDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRoaXMuX3N0YXJ0TGV2ZWw7XG4gICAgfVxuICB9XG5cbiAgc2V0IHN0YXJ0TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICB0aGlzLl9zdGFydExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICBvbkVycm9yKGV2ZW50LCBkYXRhKSB7XG4gICAgaWYoZGF0YS5mYXRhbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBkZXRhaWxzID0gZGF0YS5kZXRhaWxzLCBobHMgPSB0aGlzLmhscywgbGV2ZWxJZCwgbGV2ZWw7XG4gICAgLy8gdHJ5IHRvIHJlY292ZXIgbm90IGZhdGFsIGVycm9yc1xuICAgIHN3aXRjaChkZXRhaWxzKSB7XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5GUkFHX0xPQURfRVJST1I6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5GUkFHX0xPQURfVElNRU9VVDpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkZSQUdfTE9PUF9MT0FESU5HX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuS0VZX0xPQURfRVJST1I6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5LRVlfTE9BRF9USU1FT1VUOlxuICAgICAgICAgbGV2ZWxJZCA9IGRhdGEuZnJhZy5sZXZlbDtcbiAgICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBFcnJvckRldGFpbHMuTEVWRUxfTE9BRF9FUlJPUjpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkxFVkVMX0xPQURfVElNRU9VVDpcbiAgICAgICAgbGV2ZWxJZCA9IGRhdGEubGV2ZWw7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIC8qIHRyeSB0byBzd2l0Y2ggdG8gYSByZWR1bmRhbnQgc3RyZWFtIGlmIGFueSBhdmFpbGFibGUuXG4gICAgICogaWYgbm8gcmVkdW5kYW50IHN0cmVhbSBhdmFpbGFibGUsIGVtZXJnZW5jeSBzd2l0Y2ggZG93biAoaWYgaW4gYXV0byBtb2RlIGFuZCBjdXJyZW50IGxldmVsIG5vdCAwKVxuICAgICAqIG90aGVyd2lzZSwgd2UgY2Fubm90IHJlY292ZXIgdGhpcyBuZXR3b3JrIGVycm9yIC4uLlxuICAgICAqIGRvbid0IHJhaXNlIEZSQUdfTE9BRF9FUlJPUiBhbmQgRlJBR19MT0FEX1RJTUVPVVQgYXMgZmF0YWwsIGFzIGl0IGlzIGhhbmRsZWQgYnkgbWVkaWFDb250cm9sbGVyXG4gICAgICovXG4gICAgaWYgKGxldmVsSWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgbGV2ZWwgPSB0aGlzLl9sZXZlbHNbbGV2ZWxJZF07XG4gICAgICBpZiAobGV2ZWwudXJsSWQgPCAobGV2ZWwudXJsLmxlbmd0aCAtIDEpKSB7XG4gICAgICAgIGxldmVsLnVybElkKys7XG4gICAgICAgIGxldmVsLmRldGFpbHMgPSB1bmRlZmluZWQ7XG4gICAgICAgIGxvZ2dlci53YXJuKGBsZXZlbCBjb250cm9sbGVyLCR7ZGV0YWlsc30gZm9yIGxldmVsICR7bGV2ZWxJZH06IHN3aXRjaGluZyB0byByZWR1bmRhbnQgc3RyZWFtIGlkICR7bGV2ZWwudXJsSWR9YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyB3ZSBjb3VsZCB0cnkgdG8gcmVjb3ZlciBpZiBpbiBhdXRvIG1vZGUgYW5kIGN1cnJlbnQgbGV2ZWwgbm90IGxvd2VzdCBsZXZlbCAoMClcbiAgICAgICAgbGV0IHJlY292ZXJhYmxlID0gKCh0aGlzLl9tYW51YWxMZXZlbCA9PT0gLTEpICYmIGxldmVsSWQpO1xuICAgICAgICBpZiAocmVjb3ZlcmFibGUpIHtcbiAgICAgICAgICBsb2dnZXIud2FybihgbGV2ZWwgY29udHJvbGxlciwke2RldGFpbHN9OiBlbWVyZ2VuY3kgc3dpdGNoLWRvd24gZm9yIG5leHQgZnJhZ21lbnRgKTtcbiAgICAgICAgICBobHMuYWJyQ29udHJvbGxlci5uZXh0QXV0b0xldmVsID0gMDtcbiAgICAgICAgfSBlbHNlIGlmKGxldmVsICYmIGxldmVsLmRldGFpbHMgJiYgbGV2ZWwuZGV0YWlscy5saXZlKSB7XG4gICAgICAgICAgbG9nZ2VyLndhcm4oYGxldmVsIGNvbnRyb2xsZXIsJHtkZXRhaWxzfSBvbiBsaXZlIHN0cmVhbSwgZGlzY2FyZGApO1xuICAgICAgICAvLyBGUkFHX0xPQURfRVJST1IgYW5kIEZSQUdfTE9BRF9USU1FT1VUIGFyZSBoYW5kbGVkIGJ5IG1lZGlhQ29udHJvbGxlclxuICAgICAgICB9IGVsc2UgaWYgKGRldGFpbHMgIT09IEVycm9yRGV0YWlscy5GUkFHX0xPQURfRVJST1IgJiYgZGV0YWlscyAhPT0gRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9USU1FT1VUKSB7XG4gICAgICAgICAgbG9nZ2VyLmVycm9yKGBjYW5ub3QgcmVjb3ZlciAke2RldGFpbHN9IGVycm9yYCk7XG4gICAgICAgICAgdGhpcy5fbGV2ZWwgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgLy8gc3RvcHBpbmcgbGl2ZSByZWxvYWRpbmcgdGltZXIgaWYgYW55XG4gICAgICAgICAgaWYgKHRoaXMudGltZXIpIHtcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy50aW1lcik7XG4gICAgICAgICAgICB0aGlzLnRpbWVyID0gbnVsbDtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gcmVkaXNwYXRjaCBzYW1lIGVycm9yIGJ1dCB3aXRoIGZhdGFsIHNldCB0byB0cnVlXG4gICAgICAgICAgZGF0YS5mYXRhbCA9IHRydWU7XG4gICAgICAgICAgaGxzLnRyaWdnZXIoZXZlbnQsIGRhdGEpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgb25MZXZlbExvYWRlZChldmVudCwgZGF0YSkge1xuICAgIC8vIGNoZWNrIGlmIGN1cnJlbnQgcGxheWxpc3QgaXMgYSBsaXZlIHBsYXlsaXN0XG4gICAgaWYgKGRhdGEuZGV0YWlscy5saXZlICYmICF0aGlzLnRpbWVyKSB7XG4gICAgICAvLyBpZiBsaXZlIHBsYXlsaXN0IHdlIHdpbGwgaGF2ZSB0byByZWxvYWQgaXQgcGVyaW9kaWNhbGx5XG4gICAgICAvLyBzZXQgcmVsb2FkIHBlcmlvZCB0byBwbGF5bGlzdCB0YXJnZXQgZHVyYXRpb25cbiAgICAgIHRoaXMudGltZXIgPSBzZXRJbnRlcnZhbCh0aGlzLm9udGljaywgMTAwMCAqIGRhdGEuZGV0YWlscy50YXJnZXRkdXJhdGlvbik7XG4gICAgfVxuICAgIGlmICghZGF0YS5kZXRhaWxzLmxpdmUgJiYgdGhpcy50aW1lcikge1xuICAgICAgLy8gcGxheWxpc3QgaXMgbm90IGxpdmUgYW5kIHRpbWVyIGlzIGFybWVkIDogc3RvcHBpbmcgaXRcbiAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy50aW1lcik7XG4gICAgICB0aGlzLnRpbWVyID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICB0aWNrKCkge1xuICAgIHZhciBsZXZlbElkID0gdGhpcy5fbGV2ZWw7XG4gICAgaWYgKGxldmVsSWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdmFyIGxldmVsID0gdGhpcy5fbGV2ZWxzW2xldmVsSWRdLCB1cmxJZCA9IGxldmVsLnVybElkO1xuICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5MRVZFTF9MT0FESU5HLCB7dXJsOiBsZXZlbC51cmxbdXJsSWRdLCBsZXZlbDogbGV2ZWxJZCwgaWQ6IHVybElkfSk7XG4gICAgfVxuICB9XG5cbiAgbmV4dExvYWRMZXZlbCgpIHtcbiAgICBpZiAodGhpcy5fbWFudWFsTGV2ZWwgIT09IC0xKSB7XG4gICAgICByZXR1cm4gdGhpcy5fbWFudWFsTGV2ZWw7XG4gICAgfSBlbHNlIHtcbiAgICAgcmV0dXJuIHRoaXMuaGxzLmFickNvbnRyb2xsZXIubmV4dEF1dG9MZXZlbDtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTGV2ZWxDb250cm9sbGVyO1xuXG4iLCIvKlxuICogTVNFIE1lZGlhIENvbnRyb2xsZXJcbiovXG5cbmltcG9ydCBEZW11eGVyIGZyb20gJy4uL2RlbXV4L2RlbXV4ZXInO1xuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCBCaW5hcnlTZWFyY2ggZnJvbSAnLi4vdXRpbHMvYmluYXJ5LXNlYXJjaCc7XG5pbXBvcnQgTGV2ZWxIZWxwZXIgZnJvbSAnLi4vaGVscGVyL2xldmVsLWhlbHBlcic7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcblxuY29uc3QgU3RhdGUgPSB7XG4gIEVSUk9SIDogLTIsXG4gIFNUQVJUSU5HIDogLTEsXG4gIElETEUgOiAwLFxuICBLRVlfTE9BRElORyA6IDEsXG4gIEZSQUdfTE9BRElORyA6IDIsXG4gIEZSQUdfTE9BRElOR19XQUlUSU5HX1JFVFJZIDogMyxcbiAgV0FJVElOR19MRVZFTCA6IDQsXG4gIFBBUlNJTkcgOiA1LFxuICBQQVJTRUQgOiA2LFxuICBBUFBFTkRJTkcgOiA3LFxuICBCVUZGRVJfRkxVU0hJTkcgOiA4XG59O1xuXG5jbGFzcyBNU0VNZWRpYUNvbnRyb2xsZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHRoaXMuY29uZmlnID0gaGxzLmNvbmZpZztcbiAgICB0aGlzLmF1ZGlvQ29kZWNTd2FwID0gZmFsc2U7XG4gICAgdGhpcy5obHMgPSBobHM7XG4gICAgdGhpcy50aWNrcyA9IDA7XG4gICAgLy8gU291cmNlIEJ1ZmZlciBsaXN0ZW5lcnNcbiAgICB0aGlzLm9uc2J1ZSA9IHRoaXMub25TQlVwZGF0ZUVuZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25zYmUgID0gdGhpcy5vblNCVXBkYXRlRXJyb3IuYmluZCh0aGlzKTtcbiAgICAvLyBpbnRlcm5hbCBsaXN0ZW5lcnNcbiAgICB0aGlzLm9ubWVkaWFhdHQwID0gdGhpcy5vbk1lZGlhQXR0YWNoaW5nLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbm1lZGlhZGV0MCA9IHRoaXMub25NZWRpYURldGFjaGluZy5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25tcCA9IHRoaXMub25NYW5pZmVzdFBhcnNlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25sbCA9IHRoaXMub25MZXZlbExvYWRlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25mbCA9IHRoaXMub25GcmFnTG9hZGVkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmtsID0gdGhpcy5vbktleUxvYWRlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25pcyA9IHRoaXMub25Jbml0U2VnbWVudC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25mcGcgPSB0aGlzLm9uRnJhZ1BhcnNpbmcuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uZnAgPSB0aGlzLm9uRnJhZ1BhcnNlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25lcnIgPSB0aGlzLm9uRXJyb3IuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9udGljayA9IHRoaXMudGljay5iaW5kKHRoaXMpO1xuICAgIGhscy5vbihFdmVudC5NRURJQV9BVFRBQ0hJTkcsIHRoaXMub25tZWRpYWF0dDApO1xuICAgIGhscy5vbihFdmVudC5NRURJQV9ERVRBQ0hJTkcsIHRoaXMub25tZWRpYWRldDApO1xuICAgIGhscy5vbihFdmVudC5NQU5JRkVTVF9QQVJTRUQsIHRoaXMub25tcCk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIHRoaXMuc3RvcCgpO1xuICAgIHZhciBobHMgPSB0aGlzLmhscztcbiAgICBobHMub2ZmKEV2ZW50Lk1FRElBX0FUVEFDSElORywgdGhpcy5vbm1lZGlhYXR0MCk7XG4gICAgaGxzLm9mZihFdmVudC5NRURJQV9ERVRBQ0hJTkcsIHRoaXMub25tZWRpYWRldDApO1xuICAgIGhscy5vZmYoRXZlbnQuTUFOSUZFU1RfUEFSU0VELCB0aGlzLm9ubXApO1xuICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICB9XG5cbiAgc3RhcnRMb2FkKCkge1xuICAgIGlmICh0aGlzLmxldmVscyAmJiB0aGlzLm1lZGlhKSB7XG4gICAgICB0aGlzLnN0YXJ0SW50ZXJuYWwoKTtcbiAgICAgIGlmICh0aGlzLmxhc3RDdXJyZW50VGltZSkge1xuICAgICAgICBsb2dnZXIubG9nKGBzZWVraW5nIEAgJHt0aGlzLmxhc3RDdXJyZW50VGltZX1gKTtcbiAgICAgICAgaWYgKCF0aGlzLmxhc3RQYXVzZWQpIHtcbiAgICAgICAgICBsb2dnZXIubG9nKCdyZXN1bWluZyB2aWRlbycpO1xuICAgICAgICAgIHRoaXMubWVkaWEucGxheSgpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5sYXN0Q3VycmVudFRpbWUgPSAwO1xuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuU1RBUlRJTkc7XG4gICAgICB9XG4gICAgICB0aGlzLm5leHRMb2FkUG9zaXRpb24gPSB0aGlzLnN0YXJ0UG9zaXRpb24gPSB0aGlzLmxhc3RDdXJyZW50VGltZTtcbiAgICAgIHRoaXMudGljaygpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsb2dnZXIud2FybignY2Fubm90IHN0YXJ0IGxvYWRpbmcgYXMgZWl0aGVyIG1hbmlmZXN0IG5vdCBwYXJzZWQgb3IgdmlkZW8gbm90IGF0dGFjaGVkJyk7XG4gICAgfVxuICB9XG5cbiAgc3RhcnRJbnRlcm5hbCgpIHtcbiAgICB2YXIgaGxzID0gdGhpcy5obHM7XG4gICAgdGhpcy5zdG9wKCk7XG4gICAgdGhpcy5kZW11eGVyID0gbmV3IERlbXV4ZXIoaGxzKTtcbiAgICB0aGlzLnRpbWVyID0gc2V0SW50ZXJ2YWwodGhpcy5vbnRpY2ssIDEwMCk7XG4gICAgdGhpcy5sZXZlbCA9IC0xO1xuICAgIHRoaXMuZnJhZ0xvYWRFcnJvciA9IDA7XG4gICAgaGxzLm9uKEV2ZW50LkZSQUdfTE9BREVELCB0aGlzLm9uZmwpO1xuICAgIGhscy5vbihFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULCB0aGlzLm9uaXMpO1xuICAgIGhscy5vbihFdmVudC5GUkFHX1BBUlNJTkdfREFUQSwgdGhpcy5vbmZwZyk7XG4gICAgaGxzLm9uKEV2ZW50LkZSQUdfUEFSU0VELCB0aGlzLm9uZnApO1xuICAgIGhscy5vbihFdmVudC5FUlJPUiwgdGhpcy5vbmVycik7XG4gICAgaGxzLm9uKEV2ZW50LkxFVkVMX0xPQURFRCwgdGhpcy5vbmxsKTtcbiAgICBobHMub24oRXZlbnQuS0VZX0xPQURFRCwgdGhpcy5vbmtsKTtcbiAgfVxuXG4gIHN0b3AoKSB7XG4gICAgdGhpcy5tcDRzZWdtZW50cyA9IFtdO1xuICAgIHRoaXMuZmx1c2hSYW5nZSA9IFtdO1xuICAgIHRoaXMuYnVmZmVyUmFuZ2UgPSBbXTtcbiAgICB2YXIgZnJhZyA9IHRoaXMuZnJhZ0N1cnJlbnQ7XG4gICAgaWYgKGZyYWcpIHtcbiAgICAgIGlmIChmcmFnLmxvYWRlcikge1xuICAgICAgICBmcmFnLmxvYWRlci5hYm9ydCgpO1xuICAgICAgfVxuICAgICAgdGhpcy5mcmFnQ3VycmVudCA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMuZnJhZ1ByZXZpb3VzID0gbnVsbDtcbiAgICBpZiAodGhpcy5zb3VyY2VCdWZmZXIpIHtcbiAgICAgIGZvcih2YXIgdHlwZSBpbiB0aGlzLnNvdXJjZUJ1ZmZlcikge1xuICAgICAgICB2YXIgc2IgPSB0aGlzLnNvdXJjZUJ1ZmZlclt0eXBlXTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB0aGlzLm1lZGlhU291cmNlLnJlbW92ZVNvdXJjZUJ1ZmZlcihzYik7XG4gICAgICAgICAgc2IucmVtb3ZlRXZlbnRMaXN0ZW5lcigndXBkYXRlZW5kJywgdGhpcy5vbnNidWUpO1xuICAgICAgICAgIHNiLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgdGhpcy5vbnNiZSk7XG4gICAgICAgIH0gY2F0Y2goZXJyKSB7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMuc291cmNlQnVmZmVyID0gbnVsbDtcbiAgICB9XG4gICAgaWYgKHRoaXMudGltZXIpIHtcbiAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy50aW1lcik7XG4gICAgICB0aGlzLnRpbWVyID0gbnVsbDtcbiAgICB9XG4gICAgaWYgKHRoaXMuZGVtdXhlcikge1xuICAgICAgdGhpcy5kZW11eGVyLmRlc3Ryb3koKTtcbiAgICAgIHRoaXMuZGVtdXhlciA9IG51bGw7XG4gICAgfVxuICAgIHZhciBobHMgPSB0aGlzLmhscztcbiAgICBobHMub2ZmKEV2ZW50LkZSQUdfTE9BREVELCB0aGlzLm9uZmwpO1xuICAgIGhscy5vZmYoRXZlbnQuRlJBR19QQVJTRUQsIHRoaXMub25mcCk7XG4gICAgaGxzLm9mZihFdmVudC5GUkFHX1BBUlNJTkdfREFUQSwgdGhpcy5vbmZwZyk7XG4gICAgaGxzLm9mZihFdmVudC5MRVZFTF9MT0FERUQsIHRoaXMub25sbCk7XG4gICAgaGxzLm9mZihFdmVudC5LRVlfTE9BREVELCB0aGlzLm9ua2wpO1xuICAgIGhscy5vZmYoRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCwgdGhpcy5vbmlzKTtcbiAgICBobHMub2ZmKEV2ZW50LkVSUk9SLCB0aGlzLm9uZXJyKTtcbiAgfVxuXG4gIHRpY2soKSB7XG4gICAgdGhpcy50aWNrcysrO1xuICAgIGlmICh0aGlzLnRpY2tzID09PSAxKSB7XG4gICAgICB0aGlzLmRvVGljaygpO1xuICAgICAgaWYgKHRoaXMudGlja3MgPiAxKSB7XG4gICAgICAgIHNldFRpbWVvdXQodGhpcy50aWNrLCAxKTtcbiAgICAgIH1cbiAgICAgIHRoaXMudGlja3MgPSAwO1xuICAgIH1cbiAgfVxuXG4gIGRvVGljaygpIHtcbiAgICB2YXIgcG9zLCBsZXZlbCwgbGV2ZWxEZXRhaWxzLCBobHMgPSB0aGlzLmhscztcbiAgICBzd2l0Y2godGhpcy5zdGF0ZSkge1xuICAgICAgY2FzZSBTdGF0ZS5FUlJPUjpcbiAgICAgICAgLy9kb24ndCBkbyBhbnl0aGluZyBpbiBlcnJvciBzdGF0ZSB0byBhdm9pZCBicmVha2luZyBmdXJ0aGVyIC4uLlxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgU3RhdGUuU1RBUlRJTkc6XG4gICAgICAgIC8vIGRldGVybWluZSBsb2FkIGxldmVsXG4gICAgICAgIHRoaXMuc3RhcnRMZXZlbCA9IGhscy5zdGFydExldmVsO1xuICAgICAgICBpZiAodGhpcy5zdGFydExldmVsID09PSAtMSkge1xuICAgICAgICAgIC8vIC0xIDogZ3Vlc3Mgc3RhcnQgTGV2ZWwgYnkgZG9pbmcgYSBiaXRyYXRlIHRlc3QgYnkgbG9hZGluZyBmaXJzdCBmcmFnbWVudCBvZiBsb3dlc3QgcXVhbGl0eSBsZXZlbFxuICAgICAgICAgIHRoaXMuc3RhcnRMZXZlbCA9IDA7XG4gICAgICAgICAgdGhpcy5mcmFnQml0cmF0ZVRlc3QgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIC8vIHNldCBuZXcgbGV2ZWwgdG8gcGxheWxpc3QgbG9hZGVyIDogdGhpcyB3aWxsIHRyaWdnZXIgc3RhcnQgbGV2ZWwgbG9hZFxuICAgICAgICB0aGlzLmxldmVsID0gaGxzLm5leHRMb2FkTGV2ZWwgPSB0aGlzLnN0YXJ0TGV2ZWw7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5XQUlUSU5HX0xFVkVMO1xuICAgICAgICB0aGlzLmxvYWRlZG1ldGFkYXRhID0gZmFsc2U7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBTdGF0ZS5JRExFOlxuICAgICAgICAvLyBpZiB2aWRlbyBkZXRhY2hlZCBvciB1bmJvdW5kIGV4aXQgbG9vcFxuICAgICAgICBpZiAoIXRoaXMubWVkaWEpIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICAvLyBkZXRlcm1pbmUgbmV4dCBjYW5kaWRhdGUgZnJhZ21lbnQgdG8gYmUgbG9hZGVkLCBiYXNlZCBvbiBjdXJyZW50IHBvc2l0aW9uIGFuZFxuICAgICAgICAvLyAgZW5kIG9mIGJ1ZmZlciBwb3NpdGlvblxuICAgICAgICAvLyAgZW5zdXJlIDYwcyBvZiBidWZmZXIgdXBmcm9udFxuICAgICAgICAvLyBpZiB3ZSBoYXZlIG5vdCB5ZXQgbG9hZGVkIGFueSBmcmFnbWVudCwgc3RhcnQgbG9hZGluZyBmcm9tIHN0YXJ0IHBvc2l0aW9uXG4gICAgICAgIGlmICh0aGlzLmxvYWRlZG1ldGFkYXRhKSB7XG4gICAgICAgICAgcG9zID0gdGhpcy5tZWRpYS5jdXJyZW50VGltZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwb3MgPSB0aGlzLm5leHRMb2FkUG9zaXRpb247XG4gICAgICAgIH1cbiAgICAgICAgLy8gZGV0ZXJtaW5lIG5leHQgbG9hZCBsZXZlbFxuICAgICAgICBpZiAodGhpcy5zdGFydEZyYWdtZW50UmVxdWVzdGVkID09PSBmYWxzZSkge1xuICAgICAgICAgIGxldmVsID0gdGhpcy5zdGFydExldmVsO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIHdlIGFyZSBub3QgYXQgcGxheWJhY2sgc3RhcnQsIGdldCBuZXh0IGxvYWQgbGV2ZWwgZnJvbSBsZXZlbCBDb250cm9sbGVyXG4gICAgICAgICAgbGV2ZWwgPSBobHMubmV4dExvYWRMZXZlbDtcbiAgICAgICAgfVxuICAgICAgICB2YXIgYnVmZmVySW5mbyA9IHRoaXMuYnVmZmVySW5mbyhwb3MsMC4zKSxcbiAgICAgICAgICAgIGJ1ZmZlckxlbiA9IGJ1ZmZlckluZm8ubGVuLFxuICAgICAgICAgICAgYnVmZmVyRW5kID0gYnVmZmVySW5mby5lbmQsXG4gICAgICAgICAgICBmcmFnUHJldmlvdXMgPSB0aGlzLmZyYWdQcmV2aW91cyxcbiAgICAgICAgICAgIG1heEJ1ZkxlbjtcbiAgICAgICAgLy8gY29tcHV0ZSBtYXggQnVmZmVyIExlbmd0aCB0aGF0IHdlIGNvdWxkIGdldCBmcm9tIHRoaXMgbG9hZCBsZXZlbCwgYmFzZWQgb24gbGV2ZWwgYml0cmF0ZS4gZG9uJ3QgYnVmZmVyIG1vcmUgdGhhbiA2MCBNQiBhbmQgbW9yZSB0aGFuIDMwc1xuICAgICAgICBpZiAoKHRoaXMubGV2ZWxzW2xldmVsXSkuaGFzT3duUHJvcGVydHkoJ2JpdHJhdGUnKSkge1xuICAgICAgICAgIG1heEJ1ZkxlbiA9IE1hdGgubWF4KDggKiB0aGlzLmNvbmZpZy5tYXhCdWZmZXJTaXplIC8gdGhpcy5sZXZlbHNbbGV2ZWxdLmJpdHJhdGUsIHRoaXMuY29uZmlnLm1heEJ1ZmZlckxlbmd0aCk7XG4gICAgICAgICAgbWF4QnVmTGVuID0gTWF0aC5taW4obWF4QnVmTGVuLCB0aGlzLmNvbmZpZy5tYXhNYXhCdWZmZXJMZW5ndGgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG1heEJ1ZkxlbiA9IHRoaXMuY29uZmlnLm1heEJ1ZmZlckxlbmd0aDtcbiAgICAgICAgfVxuICAgICAgICAvLyBpZiBidWZmZXIgbGVuZ3RoIGlzIGxlc3MgdGhhbiBtYXhCdWZMZW4gdHJ5IHRvIGxvYWQgYSBuZXcgZnJhZ21lbnRcbiAgICAgICAgaWYgKGJ1ZmZlckxlbiA8IG1heEJ1Zkxlbikge1xuICAgICAgICAgIC8vIHNldCBuZXh0IGxvYWQgbGV2ZWwgOiB0aGlzIHdpbGwgdHJpZ2dlciBhIHBsYXlsaXN0IGxvYWQgaWYgbmVlZGVkXG4gICAgICAgICAgaGxzLm5leHRMb2FkTGV2ZWwgPSBsZXZlbDtcbiAgICAgICAgICB0aGlzLmxldmVsID0gbGV2ZWw7XG4gICAgICAgICAgbGV2ZWxEZXRhaWxzID0gdGhpcy5sZXZlbHNbbGV2ZWxdLmRldGFpbHM7XG4gICAgICAgICAgLy8gaWYgbGV2ZWwgaW5mbyBub3QgcmV0cmlldmVkIHlldCwgc3dpdGNoIHN0YXRlIGFuZCB3YWl0IGZvciBsZXZlbCByZXRyaWV2YWxcbiAgICAgICAgICBpZiAodHlwZW9mIGxldmVsRGV0YWlscyA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5XQUlUSU5HX0xFVkVMO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIGZpbmQgZnJhZ21lbnQgaW5kZXgsIGNvbnRpZ3VvdXMgd2l0aCBlbmQgb2YgYnVmZmVyIHBvc2l0aW9uXG4gICAgICAgICAgbGV0IGZyYWdtZW50cyA9IGxldmVsRGV0YWlscy5mcmFnbWVudHMsXG4gICAgICAgICAgICAgIGZyYWdMZW4gPSBmcmFnbWVudHMubGVuZ3RoLFxuICAgICAgICAgICAgICBzdGFydCA9IGZyYWdtZW50c1swXS5zdGFydCxcbiAgICAgICAgICAgICAgZW5kID0gZnJhZ21lbnRzW2ZyYWdMZW4tMV0uc3RhcnQgKyBmcmFnbWVudHNbZnJhZ0xlbi0xXS5kdXJhdGlvbixcbiAgICAgICAgICAgICAgZnJhZztcblxuICAgICAgICAgICAgLy8gaW4gY2FzZSBvZiBsaXZlIHBsYXlsaXN0IHdlIG5lZWQgdG8gZW5zdXJlIHRoYXQgcmVxdWVzdGVkIHBvc2l0aW9uIGlzIG5vdCBsb2NhdGVkIGJlZm9yZSBwbGF5bGlzdCBzdGFydFxuICAgICAgICAgIGlmIChsZXZlbERldGFpbHMubGl2ZSkge1xuICAgICAgICAgICAgLy8gY2hlY2sgaWYgcmVxdWVzdGVkIHBvc2l0aW9uIGlzIHdpdGhpbiBzZWVrYWJsZSBib3VuZGFyaWVzIDpcbiAgICAgICAgICAgIC8vbG9nZ2VyLmxvZyhgc3RhcnQvcG9zL2J1ZkVuZC9zZWVraW5nOiR7c3RhcnQudG9GaXhlZCgzKX0vJHtwb3MudG9GaXhlZCgzKX0vJHtidWZmZXJFbmQudG9GaXhlZCgzKX0vJHt0aGlzLm1lZGlhLnNlZWtpbmd9YCk7XG4gICAgICAgICAgICBpZiAoYnVmZmVyRW5kIDwgTWF0aC5tYXgoc3RhcnQsZW5kLXRoaXMuY29uZmlnLmxpdmVNYXhMYXRlbmN5RHVyYXRpb25Db3VudCpsZXZlbERldGFpbHMudGFyZ2V0ZHVyYXRpb24pKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zZWVrQWZ0ZXJCdWZmZXJlZCA9IHN0YXJ0ICsgTWF0aC5tYXgoMCwgbGV2ZWxEZXRhaWxzLnRvdGFsZHVyYXRpb24gLSB0aGlzLmNvbmZpZy5saXZlU3luY0R1cmF0aW9uQ291bnQgKiBsZXZlbERldGFpbHMudGFyZ2V0ZHVyYXRpb24pO1xuICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYGJ1ZmZlciBlbmQ6ICR7YnVmZmVyRW5kfSBpcyBsb2NhdGVkIHRvbyBmYXIgZnJvbSB0aGUgZW5kIG9mIGxpdmUgc2xpZGluZyBwbGF5bGlzdCwgbWVkaWEgcG9zaXRpb24gd2lsbCBiZSByZXNldGVkIHRvOiAke3RoaXMuc2Vla0FmdGVyQnVmZmVyZWQudG9GaXhlZCgzKX1gKTtcbiAgICAgICAgICAgICAgICBidWZmZXJFbmQgPSB0aGlzLnNlZWtBZnRlckJ1ZmZlcmVkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRoaXMuc3RhcnRGcmFnbWVudFJlcXVlc3RlZCAmJiAhbGV2ZWxEZXRhaWxzLlBUU0tub3duKSB7XG4gICAgICAgICAgICAgIC8qIHdlIGFyZSBzd2l0Y2hpbmcgbGV2ZWwgb24gbGl2ZSBwbGF5bGlzdCwgYnV0IHdlIGRvbid0IGhhdmUgYW55IFBUUyBpbmZvIGZvciB0aGF0IHF1YWxpdHkgbGV2ZWwgLi4uXG4gICAgICAgICAgICAgICAgIHRyeSB0byBsb2FkIGZyYWcgbWF0Y2hpbmcgd2l0aCBuZXh0IFNOLlxuICAgICAgICAgICAgICAgICBldmVuIGlmIFNOIGFyZSBub3Qgc3luY2hyb25pemVkIGJldHdlZW4gcGxheWxpc3RzLCBsb2FkaW5nIHRoaXMgZnJhZyB3aWxsIGhlbHAgdXNcbiAgICAgICAgICAgICAgICAgY29tcHV0ZSBwbGF5bGlzdCBzbGlkaW5nIGFuZCBmaW5kIHRoZSByaWdodCBvbmUgYWZ0ZXIgaW4gY2FzZSBpdCB3YXMgbm90IHRoZSByaWdodCBjb25zZWN1dGl2ZSBvbmUgKi9cbiAgICAgICAgICAgICAgaWYgKGZyYWdQcmV2aW91cykge1xuICAgICAgICAgICAgICAgIHZhciB0YXJnZXRTTiA9IGZyYWdQcmV2aW91cy5zbiArIDE7XG4gICAgICAgICAgICAgICAgaWYgKHRhcmdldFNOID49IGxldmVsRGV0YWlscy5zdGFydFNOICYmIHRhcmdldFNOIDw9IGxldmVsRGV0YWlscy5lbmRTTikge1xuICAgICAgICAgICAgICAgICAgZnJhZyA9IGZyYWdtZW50c1t0YXJnZXRTTiAtIGxldmVsRGV0YWlscy5zdGFydFNOXTtcbiAgICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYGxpdmUgcGxheWxpc3QsIHN3aXRjaGluZyBwbGF5bGlzdCwgbG9hZCBmcmFnIHdpdGggbmV4dCBTTjogJHtmcmFnLnNufWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoIWZyYWcpIHtcbiAgICAgICAgICAgICAgICAvKiB3ZSBoYXZlIG5vIGlkZWEgYWJvdXQgd2hpY2ggZnJhZ21lbnQgc2hvdWxkIGJlIGxvYWRlZC5cbiAgICAgICAgICAgICAgICAgICBzbyBsZXQncyBsb2FkIG1pZCBmcmFnbWVudC4gaXQgd2lsbCBoZWxwIGNvbXB1dGluZyBwbGF5bGlzdCBzbGlkaW5nIGFuZCBmaW5kIHRoZSByaWdodCBvbmVcbiAgICAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgICAgIGZyYWcgPSBmcmFnbWVudHNbTWF0aC5taW4oZnJhZ0xlbiAtIDEsIE1hdGgucm91bmQoZnJhZ0xlbiAvIDIpKV07XG4gICAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgbGl2ZSBwbGF5bGlzdCwgc3dpdGNoaW5nIHBsYXlsaXN0LCB1bmtub3duLCBsb2FkIG1pZGRsZSBmcmFnIDogJHtmcmFnLnNufWApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIFZvRCBwbGF5bGlzdDogaWYgYnVmZmVyRW5kIGJlZm9yZSBzdGFydCBvZiBwbGF5bGlzdCwgbG9hZCBmaXJzdCBmcmFnbWVudFxuICAgICAgICAgICAgaWYgKGJ1ZmZlckVuZCA8IHN0YXJ0KSB7XG4gICAgICAgICAgICAgIGZyYWcgPSBmcmFnbWVudHNbMF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICghZnJhZykge1xuICAgICAgICAgICAgdmFyIGZvdW5kRnJhZztcbiAgICAgICAgICAgIGlmIChidWZmZXJFbmQgPCBlbmQpIHtcbiAgICAgICAgICAgICAgZm91bmRGcmFnID0gQmluYXJ5U2VhcmNoLnNlYXJjaChmcmFnbWVudHMsIChjYW5kaWRhdGUpID0+IHtcbiAgICAgICAgICAgICAgICAvL2xvZ2dlci5sb2coYGxldmVsL3NuL3N0YXJ0L2VuZC9idWZFbmQ6JHtsZXZlbH0vJHtjYW5kaWRhdGUuc259LyR7Y2FuZGlkYXRlLnN0YXJ0fS8keyhjYW5kaWRhdGUuc3RhcnQrY2FuZGlkYXRlLmR1cmF0aW9uKX0vJHtidWZmZXJFbmR9YCk7XG4gICAgICAgICAgICAgICAgLy8gb2Zmc2V0IHNob3VsZCBiZSB3aXRoaW4gZnJhZ21lbnQgYm91bmRhcnlcbiAgICAgICAgICAgICAgICBpZiAoKGNhbmRpZGF0ZS5zdGFydCArIGNhbmRpZGF0ZS5kdXJhdGlvbikgPD0gYnVmZmVyRW5kKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoY2FuZGlkYXRlLnN0YXJ0ID4gYnVmZmVyRW5kKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIHJlYWNoIGVuZCBvZiBwbGF5bGlzdFxuICAgICAgICAgICAgICBmb3VuZEZyYWcgPSBmcmFnbWVudHNbZnJhZ0xlbi0xXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChmb3VuZEZyYWcpIHtcbiAgICAgICAgICAgICAgZnJhZyA9IGZvdW5kRnJhZztcbiAgICAgICAgICAgICAgc3RhcnQgPSBmb3VuZEZyYWcuc3RhcnQ7XG4gICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnZmluZCBTTiBtYXRjaGluZyB3aXRoIHBvczonICsgIGJ1ZmZlckVuZCArICc6JyArIGZyYWcuc24pO1xuICAgICAgICAgICAgICBpZiAoZnJhZ1ByZXZpb3VzICYmIGZyYWcubGV2ZWwgPT09IGZyYWdQcmV2aW91cy5sZXZlbCAmJiBmcmFnLnNuID09PSBmcmFnUHJldmlvdXMuc24pIHtcbiAgICAgICAgICAgICAgICBpZiAoZnJhZy5zbiA8IGxldmVsRGV0YWlscy5lbmRTTikge1xuICAgICAgICAgICAgICAgICAgZnJhZyA9IGZyYWdtZW50c1tmcmFnLnNuICsgMSAtIGxldmVsRGV0YWlscy5zdGFydFNOXTtcbiAgICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYFNOIGp1c3QgbG9hZGVkLCBsb2FkIG5leHQgb25lOiAke2ZyYWcuc259YCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIC8vIGhhdmUgd2UgcmVhY2hlZCBlbmQgb2YgVk9EIHBsYXlsaXN0ID9cbiAgICAgICAgICAgICAgICAgIGlmICghbGV2ZWxEZXRhaWxzLmxpdmUpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG1lZGlhU291cmNlID0gdGhpcy5tZWRpYVNvdXJjZTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1lZGlhU291cmNlICYmIG1lZGlhU291cmNlLnJlYWR5U3RhdGUgPT09ICdvcGVuJykge1xuICAgICAgICAgICAgICAgICAgICAgICAvLyBlbnN1cmUgc291cmNlQnVmZmVyIGFyZSBub3QgaW4gdXBkYXRpbmcgc3RhdGVzXG4gICAgICAgICAgICAgICAgICAgICAgdmFyIHNiID0gdGhpcy5zb3VyY2VCdWZmZXI7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKCEoKHNiLmF1ZGlvICYmIHNiLmF1ZGlvLnVwZGF0aW5nKSB8fCAoc2IudmlkZW8gJiYgc2IudmlkZW8udXBkYXRpbmcpKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nZ2VyLmxvZygnYWxsIG1lZGlhIGRhdGEgYXZhaWxhYmxlLCBzaWduYWwgZW5kT2ZTdHJlYW0oKSB0byBNZWRpYVNvdXJjZScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy9Ob3RpZnkgdGhlIG1lZGlhIGVsZW1lbnQgdGhhdCBpdCBub3cgaGFzIGFsbCBvZiB0aGUgbWVkaWEgZGF0YVxuICAgICAgICAgICAgICAgICAgICAgICAgbWVkaWFTb3VyY2UuZW5kT2ZTdHJlYW0oKTtcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIGZyYWcgPSBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZihmcmFnKSB7XG4gICAgICAgICAgICAvL2xvZ2dlci5sb2coJyAgICAgIGxvYWRpbmcgZnJhZyAnICsgaSArJyxwb3MvYnVmRW5kOicgKyBwb3MudG9GaXhlZCgzKSArICcvJyArIGJ1ZmZlckVuZC50b0ZpeGVkKDMpKTtcbiAgICAgICAgICAgIGlmICgoZnJhZy5kZWNyeXB0ZGF0YS51cmkgIT0gbnVsbCkgJiYgKGZyYWcuZGVjcnlwdGRhdGEua2V5ID09IG51bGwpKSB7XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coYExvYWRpbmcga2V5IGZvciAke2ZyYWcuc259IG9mIFske2xldmVsRGV0YWlscy5zdGFydFNOfSAsJHtsZXZlbERldGFpbHMuZW5kU059XSxsZXZlbCAke2xldmVsfWApO1xuICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuS0VZX0xPQURJTkc7XG4gICAgICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50LktFWV9MT0FESU5HLCB7ZnJhZzogZnJhZ30pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgTG9hZGluZyAke2ZyYWcuc259IG9mIFske2xldmVsRGV0YWlscy5zdGFydFNOfSAsJHtsZXZlbERldGFpbHMuZW5kU059XSxsZXZlbCAke2xldmVsfSwgY3VycmVudFRpbWU6JHtwb3N9LGJ1ZmZlckVuZDoke2J1ZmZlckVuZC50b0ZpeGVkKDMpfWApO1xuICAgICAgICAgICAgICBmcmFnLmF1dG9MZXZlbCA9IGhscy5hdXRvTGV2ZWxFbmFibGVkO1xuICAgICAgICAgICAgICBpZiAodGhpcy5sZXZlbHMubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgIGZyYWcuZXhwZWN0ZWRMZW4gPSBNYXRoLnJvdW5kKGZyYWcuZHVyYXRpb24gKiB0aGlzLmxldmVsc1tsZXZlbF0uYml0cmF0ZSAvIDgpO1xuICAgICAgICAgICAgICAgIGZyYWcudHJlcXVlc3QgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAvLyBlbnN1cmUgdGhhdCB3ZSBhcmUgbm90IHJlbG9hZGluZyB0aGUgc2FtZSBmcmFnbWVudHMgaW4gbG9vcCAuLi5cbiAgICAgICAgICAgICAgaWYgKHRoaXMuZnJhZ0xvYWRJZHggIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZnJhZ0xvYWRJZHgrKztcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmZyYWdMb2FkSWR4ID0gMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoZnJhZy5sb2FkQ291bnRlcikge1xuICAgICAgICAgICAgICAgIGZyYWcubG9hZENvdW50ZXIrKztcbiAgICAgICAgICAgICAgICBsZXQgbWF4VGhyZXNob2xkID0gdGhpcy5jb25maWcuZnJhZ0xvYWRpbmdMb29wVGhyZXNob2xkO1xuICAgICAgICAgICAgICAgIC8vIGlmIHRoaXMgZnJhZyBoYXMgYWxyZWFkeSBiZWVuIGxvYWRlZCAzIHRpbWVzLCBhbmQgaWYgaXQgaGFzIGJlZW4gcmVsb2FkZWQgcmVjZW50bHlcbiAgICAgICAgICAgICAgICBpZiAoZnJhZy5sb2FkQ291bnRlciA+IG1heFRocmVzaG9sZCAmJiAoTWF0aC5hYnModGhpcy5mcmFnTG9hZElkeCAtIGZyYWcubG9hZElkeCkgPCBtYXhUaHJlc2hvbGQpKSB7XG4gICAgICAgICAgICAgICAgICBobHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5GUkFHX0xPT1BfTE9BRElOR19FUlJPUiwgZmF0YWw6IGZhbHNlLCBmcmFnOiBmcmFnfSk7XG4gICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGZyYWcubG9hZENvdW50ZXIgPSAxO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGZyYWcubG9hZElkeCA9IHRoaXMuZnJhZ0xvYWRJZHg7XG4gICAgICAgICAgICAgIHRoaXMuZnJhZ0N1cnJlbnQgPSBmcmFnO1xuICAgICAgICAgICAgICB0aGlzLnN0YXJ0RnJhZ21lbnRSZXF1ZXN0ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICBobHMudHJpZ2dlcihFdmVudC5GUkFHX0xPQURJTkcsIHtmcmFnOiBmcmFnfSk7XG4gICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5GUkFHX0xPQURJTkc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBTdGF0ZS5XQUlUSU5HX0xFVkVMOlxuICAgICAgICBsZXZlbCA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdO1xuICAgICAgICAvLyBjaGVjayBpZiBwbGF5bGlzdCBpcyBhbHJlYWR5IGxvYWRlZFxuICAgICAgICBpZiAobGV2ZWwgJiYgbGV2ZWwuZGV0YWlscykge1xuICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBTdGF0ZS5GUkFHX0xPQURJTkc6XG4gICAgICAgIC8qXG4gICAgICAgICAgbW9uaXRvciBmcmFnbWVudCByZXRyaWV2YWwgdGltZS4uLlxuICAgICAgICAgIHdlIGNvbXB1dGUgZXhwZWN0ZWQgdGltZSBvZiBhcnJpdmFsIG9mIHRoZSBjb21wbGV0ZSBmcmFnbWVudC5cbiAgICAgICAgICB3ZSBjb21wYXJlIGl0IHRvIGV4cGVjdGVkIHRpbWUgb2YgYnVmZmVyIHN0YXJ2YXRpb25cbiAgICAgICAgKi9cbiAgICAgICAgbGV0IHYgPSB0aGlzLm1lZGlhLGZyYWcgPSB0aGlzLmZyYWdDdXJyZW50O1xuICAgICAgICAvKiBvbmx5IG1vbml0b3IgZnJhZyByZXRyaWV2YWwgdGltZSBpZlxuICAgICAgICAodmlkZW8gbm90IHBhdXNlZCBPUiBmaXJzdCBmcmFnbWVudCBiZWluZyBsb2FkZWQpIEFORCBhdXRvc3dpdGNoaW5nIGVuYWJsZWQgQU5EIG5vdCBsb3dlc3QgbGV2ZWwgQU5EIG11bHRpcGxlIGxldmVscyAqL1xuICAgICAgICBpZiAodiAmJiAoIXYucGF1c2VkIHx8IHRoaXMubG9hZGVkbWV0YWRhdGEgPT09IGZhbHNlKSAmJiBmcmFnLmF1dG9MZXZlbCAmJiB0aGlzLmxldmVsICYmIHRoaXMubGV2ZWxzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICB2YXIgcmVxdWVzdERlbGF5ID0gcGVyZm9ybWFuY2Uubm93KCkgLSBmcmFnLnRyZXF1ZXN0O1xuICAgICAgICAgIC8vIG1vbml0b3IgZnJhZ21lbnQgbG9hZCBwcm9ncmVzcyBhZnRlciBoYWxmIG9mIGV4cGVjdGVkIGZyYWdtZW50IGR1cmF0aW9uLHRvIHN0YWJpbGl6ZSBiaXRyYXRlXG4gICAgICAgICAgaWYgKHJlcXVlc3REZWxheSA+ICg1MDAgKiBmcmFnLmR1cmF0aW9uKSkge1xuICAgICAgICAgICAgdmFyIGxvYWRSYXRlID0gZnJhZy5sb2FkZWQgKiAxMDAwIC8gcmVxdWVzdERlbGF5OyAvLyBieXRlL3NcbiAgICAgICAgICAgIGlmIChmcmFnLmV4cGVjdGVkTGVuIDwgZnJhZy5sb2FkZWQpIHtcbiAgICAgICAgICAgICAgZnJhZy5leHBlY3RlZExlbiA9IGZyYWcubG9hZGVkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcG9zID0gdi5jdXJyZW50VGltZTtcbiAgICAgICAgICAgIHZhciBmcmFnTG9hZGVkRGVsYXkgPSAoZnJhZy5leHBlY3RlZExlbiAtIGZyYWcubG9hZGVkKSAvIGxvYWRSYXRlO1xuICAgICAgICAgICAgdmFyIGJ1ZmZlclN0YXJ2YXRpb25EZWxheSA9IHRoaXMuYnVmZmVySW5mbyhwb3MsMC4zKS5lbmQgLSBwb3M7XG4gICAgICAgICAgICB2YXIgZnJhZ0xldmVsTmV4dExvYWRlZERlbGF5ID0gZnJhZy5kdXJhdGlvbiAqIHRoaXMubGV2ZWxzW2hscy5uZXh0TG9hZExldmVsXS5iaXRyYXRlIC8gKDggKiBsb2FkUmF0ZSk7IC8vYnBzL0Jwc1xuICAgICAgICAgICAgLyogaWYgd2UgaGF2ZSBsZXNzIHRoYW4gMiBmcmFnIGR1cmF0aW9uIGluIGJ1ZmZlciBhbmQgaWYgZnJhZyBsb2FkZWQgZGVsYXkgaXMgZ3JlYXRlciB0aGFuIGJ1ZmZlciBzdGFydmF0aW9uIGRlbGF5XG4gICAgICAgICAgICAgIC4uLiBhbmQgYWxzbyBiaWdnZXIgdGhhbiBkdXJhdGlvbiBuZWVkZWQgdG8gbG9hZCBmcmFnbWVudCBhdCBuZXh0IGxldmVsIC4uLiovXG4gICAgICAgICAgICBpZiAoYnVmZmVyU3RhcnZhdGlvbkRlbGF5IDwgKDIgKiBmcmFnLmR1cmF0aW9uKSAmJiBmcmFnTG9hZGVkRGVsYXkgPiBidWZmZXJTdGFydmF0aW9uRGVsYXkgJiYgZnJhZ0xvYWRlZERlbGF5ID4gZnJhZ0xldmVsTmV4dExvYWRlZERlbGF5KSB7XG4gICAgICAgICAgICAgIC8vIGFib3J0IGZyYWdtZW50IGxvYWRpbmcgLi4uXG4gICAgICAgICAgICAgIGxvZ2dlci53YXJuKCdsb2FkaW5nIHRvbyBzbG93LCBhYm9ydCBmcmFnbWVudCBsb2FkaW5nJyk7XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coYGZyYWdMb2FkZWREZWxheS9idWZmZXJTdGFydmF0aW9uRGVsYXkvZnJhZ0xldmVsTmV4dExvYWRlZERlbGF5IDoke2ZyYWdMb2FkZWREZWxheS50b0ZpeGVkKDEpfS8ke2J1ZmZlclN0YXJ2YXRpb25EZWxheS50b0ZpeGVkKDEpfS8ke2ZyYWdMZXZlbE5leHRMb2FkZWREZWxheS50b0ZpeGVkKDEpfWApO1xuICAgICAgICAgICAgICAvL2Fib3J0IGZyYWdtZW50IGxvYWRpbmdcbiAgICAgICAgICAgICAgZnJhZy5sb2FkZXIuYWJvcnQoKTtcbiAgICAgICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuRlJBR19MT0FEX0VNRVJHRU5DWV9BQk9SVEVELCB7ZnJhZzogZnJhZ30pO1xuICAgICAgICAgICAgICAvLyBzd2l0Y2ggYmFjayB0byBJRExFIHN0YXRlIHRvIHJlcXVlc3QgbmV3IGZyYWdtZW50IGF0IGxvd2VzdCBsZXZlbFxuICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFN0YXRlLkZSQUdfTE9BRElOR19XQUlUSU5HX1JFVFJZOlxuICAgICAgICB2YXIgbm93ID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICAgIHZhciByZXRyeURhdGUgPSB0aGlzLnJldHJ5RGF0ZTtcbiAgICAgICAgdmFyIG1lZGlhID0gdGhpcy5tZWRpYTtcbiAgICAgICAgdmFyIGlzU2Vla2luZyA9IG1lZGlhICYmIG1lZGlhLnNlZWtpbmc7XG4gICAgICAgIC8vIGlmIGN1cnJlbnQgdGltZSBpcyBndCB0aGFuIHJldHJ5RGF0ZSwgb3IgaWYgbWVkaWEgc2Vla2luZyBsZXQncyBzd2l0Y2ggdG8gSURMRSBzdGF0ZSB0byByZXRyeSBsb2FkaW5nXG4gICAgICAgIGlmKCFyZXRyeURhdGUgfHwgKG5vdyA+PSByZXRyeURhdGUpIHx8IGlzU2Vla2luZykge1xuICAgICAgICAgIGxvZ2dlci5sb2coYG1lZGlhQ29udHJvbGxlcjogcmV0cnlEYXRlIHJlYWNoZWQsIHN3aXRjaCBiYWNrIHRvIElETEUgc3RhdGVgKTtcbiAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgU3RhdGUuUEFSU0lORzpcbiAgICAgICAgLy8gbm90aGluZyB0byBkbywgd2FpdCBmb3IgZnJhZ21lbnQgYmVpbmcgcGFyc2VkXG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBTdGF0ZS5QQVJTRUQ6XG4gICAgICBjYXNlIFN0YXRlLkFQUEVORElORzpcbiAgICAgICAgaWYgKHRoaXMuc291cmNlQnVmZmVyKSB7XG4gICAgICAgICAgaWYgKHRoaXMubWVkaWEuZXJyb3IpIHtcbiAgICAgICAgICAgIGxvZ2dlci5lcnJvcigndHJ5aW5nIHRvIGFwcGVuZCBhbHRob3VnaCBhIG1lZGlhIGVycm9yIG9jY3VyZWQsIHN3aXRjaCB0byBFUlJPUiBzdGF0ZScpO1xuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLkVSUk9SO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBpZiBNUDQgc2VnbWVudCBhcHBlbmRpbmcgaW4gcHJvZ3Jlc3Mgbm90aGluZyB0byBkb1xuICAgICAgICAgIGVsc2UgaWYgKCh0aGlzLnNvdXJjZUJ1ZmZlci5hdWRpbyAmJiB0aGlzLnNvdXJjZUJ1ZmZlci5hdWRpby51cGRhdGluZykgfHxcbiAgICAgICAgICAgICAodGhpcy5zb3VyY2VCdWZmZXIudmlkZW8gJiYgdGhpcy5zb3VyY2VCdWZmZXIudmlkZW8udXBkYXRpbmcpKSB7XG4gICAgICAgICAgICAvL2xvZ2dlci5sb2coJ3NiIGFwcGVuZCBpbiBwcm9ncmVzcycpO1xuICAgICAgICAvLyBjaGVjayBpZiBhbnkgTVA0IHNlZ21lbnRzIGxlZnQgdG8gYXBwZW5kXG4gICAgICAgICAgfSBlbHNlIGlmICh0aGlzLm1wNHNlZ21lbnRzLmxlbmd0aCkge1xuICAgICAgICAgICAgdmFyIHNlZ21lbnQgPSB0aGlzLm1wNHNlZ21lbnRzLnNoaWZ0KCk7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAvL2xvZ2dlci5sb2coYGFwcGVuZGluZyAke3NlZ21lbnQudHlwZX0gU0IsIHNpemU6JHtzZWdtZW50LmRhdGEubGVuZ3RofSk7XG4gICAgICAgICAgICAgIHRoaXMuc291cmNlQnVmZmVyW3NlZ21lbnQudHlwZV0uYXBwZW5kQnVmZmVyKHNlZ21lbnQuZGF0YSk7XG4gICAgICAgICAgICAgIHRoaXMuYXBwZW5kRXJyb3IgPSAwO1xuICAgICAgICAgICAgfSBjYXRjaChlcnIpIHtcbiAgICAgICAgICAgICAgLy8gaW4gY2FzZSBhbnkgZXJyb3Igb2NjdXJlZCB3aGlsZSBhcHBlbmRpbmcsIHB1dCBiYWNrIHNlZ21lbnQgaW4gbXA0c2VnbWVudHMgdGFibGVcbiAgICAgICAgICAgICAgbG9nZ2VyLmVycm9yKGBlcnJvciB3aGlsZSB0cnlpbmcgdG8gYXBwZW5kIGJ1ZmZlcjoke2Vyci5tZXNzYWdlfSx0cnkgYXBwZW5kaW5nIGxhdGVyYCk7XG4gICAgICAgICAgICAgIHRoaXMubXA0c2VnbWVudHMudW5zaGlmdChzZWdtZW50KTtcbiAgICAgICAgICAgICAgICAvLyBqdXN0IGRpc2NhcmQgUXVvdGFFeGNlZWRlZEVycm9yIGZvciBub3csIGFuZCB3YWl0IGZvciB0aGUgbmF0dXJhbCBicm93c2VyIGJ1ZmZlciBldmljdGlvblxuICAgICAgICAgICAgICAvL2h0dHA6Ly93d3cudzMub3JnL1RSL2h0bWw1L2luZnJhc3RydWN0dXJlLmh0bWwjcXVvdGFleGNlZWRlZGVycm9yXG4gICAgICAgICAgICAgIGlmKGVyci5jb2RlICE9PSAyMikge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmFwcGVuZEVycm9yKSB7XG4gICAgICAgICAgICAgICAgICB0aGlzLmFwcGVuZEVycm9yKys7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHRoaXMuYXBwZW5kRXJyb3IgPSAxO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB2YXIgZXZlbnQgPSB7dHlwZTogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkJVRkZFUl9BUFBFTkRfRVJST1IsIGZyYWc6IHRoaXMuZnJhZ0N1cnJlbnR9O1xuICAgICAgICAgICAgICAgIC8qIHdpdGggVUhEIGNvbnRlbnQsIHdlIGNvdWxkIGdldCBsb29wIG9mIHF1b3RhIGV4Y2VlZGVkIGVycm9yIHVudGlsXG4gICAgICAgICAgICAgICAgICBicm93c2VyIGlzIGFibGUgdG8gZXZpY3Qgc29tZSBkYXRhIGZyb20gc291cmNlYnVmZmVyLiByZXRyeWluZyBoZWxwIHJlY292ZXJpbmcgdGhpc1xuICAgICAgICAgICAgICAgICovXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuYXBwZW5kRXJyb3IgPiB0aGlzLmNvbmZpZy5hcHBlbmRFcnJvck1heFJldHJ5KSB7XG4gICAgICAgICAgICAgICAgICBsb2dnZXIubG9nKGBmYWlsICR7dGhpcy5jb25maWcuYXBwZW5kRXJyb3JNYXhSZXRyeX0gdGltZXMgdG8gYXBwZW5kIHNlZ21lbnQgaW4gc291cmNlQnVmZmVyYCk7XG4gICAgICAgICAgICAgICAgICBldmVudC5mYXRhbCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICBobHMudHJpZ2dlcihFdmVudC5FUlJPUiwgZXZlbnQpO1xuICAgICAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLkVSUk9SO1xuICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBldmVudC5mYXRhbCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIGV2ZW50KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5BUFBFTkRJTkc7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIHNvdXJjZUJ1ZmZlciB1bmRlZmluZWQsIHN3aXRjaCBiYWNrIHRvIElETEUgc3RhdGVcbiAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgU3RhdGUuQlVGRkVSX0ZMVVNISU5HOlxuICAgICAgICAvLyBsb29wIHRocm91Z2ggYWxsIGJ1ZmZlciByYW5nZXMgdG8gZmx1c2hcbiAgICAgICAgd2hpbGUodGhpcy5mbHVzaFJhbmdlLmxlbmd0aCkge1xuICAgICAgICAgIHZhciByYW5nZSA9IHRoaXMuZmx1c2hSYW5nZVswXTtcbiAgICAgICAgICAvLyBmbHVzaEJ1ZmZlciB3aWxsIGFib3J0IGFueSBidWZmZXIgYXBwZW5kIGluIHByb2dyZXNzIGFuZCBmbHVzaCBBdWRpby9WaWRlbyBCdWZmZXJcbiAgICAgICAgICBpZiAodGhpcy5mbHVzaEJ1ZmZlcihyYW5nZS5zdGFydCwgcmFuZ2UuZW5kKSkge1xuICAgICAgICAgICAgLy8gcmFuZ2UgZmx1c2hlZCwgcmVtb3ZlIGZyb20gZmx1c2ggYXJyYXlcbiAgICAgICAgICAgIHRoaXMuZmx1c2hSYW5nZS5zaGlmdCgpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBmbHVzaCBpbiBwcm9ncmVzcywgY29tZSBiYWNrIGxhdGVyXG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuZmx1c2hSYW5nZS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAvLyBoYW5kbGUgZW5kIG9mIGltbWVkaWF0ZSBzd2l0Y2hpbmcgaWYgbmVlZGVkXG4gICAgICAgICAgaWYgKHRoaXMuaW1tZWRpYXRlU3dpdGNoKSB7XG4gICAgICAgICAgICB0aGlzLmltbWVkaWF0ZUxldmVsU3dpdGNoRW5kKCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIG1vdmUgdG8gSURMRSBvbmNlIGZsdXNoIGNvbXBsZXRlLiB0aGlzIHNob3VsZCB0cmlnZ2VyIG5ldyBmcmFnbWVudCBsb2FkaW5nXG4gICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gICAgICAgICAgLy8gcmVzZXQgcmVmZXJlbmNlIHRvIGZyYWdcbiAgICAgICAgICB0aGlzLmZyYWdQcmV2aW91cyA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgIC8qIGlmIG5vdCBldmVyeXRoaW5nIGZsdXNoZWQsIHN0YXkgaW4gQlVGRkVSX0ZMVVNISU5HIHN0YXRlLiB3ZSB3aWxsIGNvbWUgYmFjayBoZXJlXG4gICAgICAgICAgICBlYWNoIHRpbWUgc291cmNlQnVmZmVyIHVwZGF0ZWVuZCgpIGNhbGxiYWNrIHdpbGwgYmUgdHJpZ2dlcmVkXG4gICAgICAgICAgICAqL1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICAvLyBjaGVjayBidWZmZXJcbiAgICB0aGlzLl9jaGVja0J1ZmZlcigpO1xuICAgIC8vIGNoZWNrL3VwZGF0ZSBjdXJyZW50IGZyYWdtZW50XG4gICAgdGhpcy5fY2hlY2tGcmFnbWVudENoYW5nZWQoKTtcbiAgfVxuXG5cbiAgYnVmZmVySW5mbyhwb3MsbWF4SG9sZUR1cmF0aW9uKSB7XG4gICAgdmFyIG1lZGlhID0gdGhpcy5tZWRpYSxcbiAgICAgICAgdmJ1ZmZlcmVkID0gbWVkaWEuYnVmZmVyZWQsXG4gICAgICAgIGJ1ZmZlcmVkID0gW10saTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgdmJ1ZmZlcmVkLmxlbmd0aDsgaSsrKSB7XG4gICAgICBidWZmZXJlZC5wdXNoKHtzdGFydDogdmJ1ZmZlcmVkLnN0YXJ0KGkpLCBlbmQ6IHZidWZmZXJlZC5lbmQoaSl9KTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuYnVmZmVyZWRJbmZvKGJ1ZmZlcmVkLHBvcyxtYXhIb2xlRHVyYXRpb24pO1xuICB9XG5cbiAgYnVmZmVyZWRJbmZvKGJ1ZmZlcmVkLHBvcyxtYXhIb2xlRHVyYXRpb24pIHtcbiAgICB2YXIgYnVmZmVyZWQyID0gW10sXG4gICAgICAgIC8vIGJ1ZmZlclN0YXJ0IGFuZCBidWZmZXJFbmQgYXJlIGJ1ZmZlciBib3VuZGFyaWVzIGFyb3VuZCBjdXJyZW50IHZpZGVvIHBvc2l0aW9uXG4gICAgICAgIGJ1ZmZlckxlbixidWZmZXJTdGFydCwgYnVmZmVyRW5kLGJ1ZmZlclN0YXJ0TmV4dCxpO1xuICAgIC8vIHNvcnQgb24gYnVmZmVyLnN0YXJ0L3NtYWxsZXIgZW5kIChJRSBkb2VzIG5vdCBhbHdheXMgcmV0dXJuIHNvcnRlZCBidWZmZXJlZCByYW5nZSlcbiAgICBidWZmZXJlZC5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICB2YXIgZGlmZiA9IGEuc3RhcnQgLSBiLnN0YXJ0O1xuICAgICAgaWYgKGRpZmYpIHtcbiAgICAgICAgcmV0dXJuIGRpZmY7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gYi5lbmQgLSBhLmVuZDtcbiAgICAgIH1cbiAgICB9KTtcbiAgICAvLyB0aGVyZSBtaWdodCBiZSBzb21lIHNtYWxsIGhvbGVzIGJldHdlZW4gYnVmZmVyIHRpbWUgcmFuZ2VcbiAgICAvLyBjb25zaWRlciB0aGF0IGhvbGVzIHNtYWxsZXIgdGhhbiBtYXhIb2xlRHVyYXRpb24gYXJlIGlycmVsZXZhbnQgYW5kIGJ1aWxkIGFub3RoZXJcbiAgICAvLyBidWZmZXIgdGltZSByYW5nZSByZXByZXNlbnRhdGlvbnMgdGhhdCBkaXNjYXJkcyB0aG9zZSBob2xlc1xuICAgIGZvciAoaSA9IDA7IGkgPCBidWZmZXJlZC5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGJ1ZjJsZW4gPSBidWZmZXJlZDIubGVuZ3RoO1xuICAgICAgaWYoYnVmMmxlbikge1xuICAgICAgICB2YXIgYnVmMmVuZCA9IGJ1ZmZlcmVkMltidWYybGVuIC0gMV0uZW5kO1xuICAgICAgICAvLyBpZiBzbWFsbCBob2xlICh2YWx1ZSBiZXR3ZWVuIDAgb3IgbWF4SG9sZUR1cmF0aW9uICkgb3Igb3ZlcmxhcHBpbmcgKG5lZ2F0aXZlKVxuICAgICAgICBpZigoYnVmZmVyZWRbaV0uc3RhcnQgLSBidWYyZW5kKSA8IG1heEhvbGVEdXJhdGlvbikge1xuICAgICAgICAgIC8vIG1lcmdlIG92ZXJsYXBwaW5nIHRpbWUgcmFuZ2VzXG4gICAgICAgICAgLy8gdXBkYXRlIGxhc3RSYW5nZS5lbmQgb25seSBpZiBzbWFsbGVyIHRoYW4gaXRlbS5lbmRcbiAgICAgICAgICAvLyBlLmcuICBbIDEsIDE1XSB3aXRoICBbIDIsOF0gPT4gWyAxLDE1XSAobm8gbmVlZCB0byBtb2RpZnkgbGFzdFJhbmdlLmVuZClcbiAgICAgICAgICAvLyB3aGVyZWFzIFsgMSwgOF0gd2l0aCAgWyAyLDE1XSA9PiBbIDEsMTVdICggbGFzdFJhbmdlIHNob3VsZCBzd2l0Y2ggZnJvbSBbMSw4XSB0byBbMSwxNV0pXG4gICAgICAgICAgaWYoYnVmZmVyZWRbaV0uZW5kID4gYnVmMmVuZCkge1xuICAgICAgICAgICAgYnVmZmVyZWQyW2J1ZjJsZW4gLSAxXS5lbmQgPSBidWZmZXJlZFtpXS5lbmQ7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIGJpZyBob2xlXG4gICAgICAgICAgYnVmZmVyZWQyLnB1c2goYnVmZmVyZWRbaV0pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBmaXJzdCB2YWx1ZVxuICAgICAgICBidWZmZXJlZDIucHVzaChidWZmZXJlZFtpXSk7XG4gICAgICB9XG4gICAgfVxuICAgIGZvciAoaSA9IDAsIGJ1ZmZlckxlbiA9IDAsIGJ1ZmZlclN0YXJ0ID0gYnVmZmVyRW5kID0gcG9zOyBpIDwgYnVmZmVyZWQyLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgc3RhcnQgPSAgYnVmZmVyZWQyW2ldLnN0YXJ0LFxuICAgICAgICAgIGVuZCA9IGJ1ZmZlcmVkMltpXS5lbmQ7XG4gICAgICAvL2xvZ2dlci5sb2coJ2J1ZiBzdGFydC9lbmQ6JyArIGJ1ZmZlcmVkLnN0YXJ0KGkpICsgJy8nICsgYnVmZmVyZWQuZW5kKGkpKTtcbiAgICAgIGlmICgocG9zICsgbWF4SG9sZUR1cmF0aW9uKSA+PSBzdGFydCAmJiBwb3MgPCBlbmQpIHtcbiAgICAgICAgLy8gcGxheSBwb3NpdGlvbiBpcyBpbnNpZGUgdGhpcyBidWZmZXIgVGltZVJhbmdlLCByZXRyaWV2ZSBlbmQgb2YgYnVmZmVyIHBvc2l0aW9uIGFuZCBidWZmZXIgbGVuZ3RoXG4gICAgICAgIGJ1ZmZlclN0YXJ0ID0gc3RhcnQ7XG4gICAgICAgIGJ1ZmZlckVuZCA9IGVuZCArIG1heEhvbGVEdXJhdGlvbjtcbiAgICAgICAgYnVmZmVyTGVuID0gYnVmZmVyRW5kIC0gcG9zO1xuICAgICAgfSBlbHNlIGlmICgocG9zICsgbWF4SG9sZUR1cmF0aW9uKSA8IHN0YXJ0KSB7XG4gICAgICAgIGJ1ZmZlclN0YXJ0TmV4dCA9IHN0YXJ0O1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4ge2xlbjogYnVmZmVyTGVuLCBzdGFydDogYnVmZmVyU3RhcnQsIGVuZDogYnVmZmVyRW5kLCBuZXh0U3RhcnQgOiBidWZmZXJTdGFydE5leHR9O1xuICB9XG5cbiAgZ2V0QnVmZmVyUmFuZ2UocG9zaXRpb24pIHtcbiAgICB2YXIgaSwgcmFuZ2U7XG4gICAgZm9yIChpID0gdGhpcy5idWZmZXJSYW5nZS5sZW5ndGggLSAxOyBpID49MDsgaS0tKSB7XG4gICAgICByYW5nZSA9IHRoaXMuYnVmZmVyUmFuZ2VbaV07XG4gICAgICBpZiAocG9zaXRpb24gPj0gcmFuZ2Uuc3RhcnQgJiYgcG9zaXRpb24gPD0gcmFuZ2UuZW5kKSB7XG4gICAgICAgIHJldHVybiByYW5nZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBnZXQgY3VycmVudExldmVsKCkge1xuICAgIGlmICh0aGlzLm1lZGlhKSB7XG4gICAgICB2YXIgcmFuZ2UgPSB0aGlzLmdldEJ1ZmZlclJhbmdlKHRoaXMubWVkaWEuY3VycmVudFRpbWUpO1xuICAgICAgaWYgKHJhbmdlKSB7XG4gICAgICAgIHJldHVybiByYW5nZS5mcmFnLmxldmVsO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gLTE7XG4gIH1cblxuICBnZXQgbmV4dEJ1ZmZlclJhbmdlKCkge1xuICAgIGlmICh0aGlzLm1lZGlhKSB7XG4gICAgICAvLyBmaXJzdCBnZXQgZW5kIHJhbmdlIG9mIGN1cnJlbnQgZnJhZ21lbnRcbiAgICAgIHJldHVybiB0aGlzLmZvbGxvd2luZ0J1ZmZlclJhbmdlKHRoaXMuZ2V0QnVmZmVyUmFuZ2UodGhpcy5tZWRpYS5jdXJyZW50VGltZSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBmb2xsb3dpbmdCdWZmZXJSYW5nZShyYW5nZSkge1xuICAgIGlmIChyYW5nZSkge1xuICAgICAgLy8gdHJ5IHRvIGdldCByYW5nZSBvZiBuZXh0IGZyYWdtZW50ICg1MDBtcyBhZnRlciB0aGlzIHJhbmdlKVxuICAgICAgcmV0dXJuIHRoaXMuZ2V0QnVmZmVyUmFuZ2UocmFuZ2UuZW5kICsgMC41KTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBnZXQgbmV4dExldmVsKCkge1xuICAgIHZhciByYW5nZSA9IHRoaXMubmV4dEJ1ZmZlclJhbmdlO1xuICAgIGlmIChyYW5nZSkge1xuICAgICAgcmV0dXJuIHJhbmdlLmZyYWcubGV2ZWw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiAtMTtcbiAgICB9XG4gIH1cblxuICBpc0J1ZmZlcmVkKHBvc2l0aW9uKSB7XG4gICAgdmFyIHYgPSB0aGlzLm1lZGlhLCBidWZmZXJlZCA9IHYuYnVmZmVyZWQ7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBidWZmZXJlZC5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHBvc2l0aW9uID49IGJ1ZmZlcmVkLnN0YXJ0KGkpICYmIHBvc2l0aW9uIDw9IGJ1ZmZlcmVkLmVuZChpKSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgX2NoZWNrRnJhZ21lbnRDaGFuZ2VkKCkge1xuICAgIHZhciByYW5nZUN1cnJlbnQsIGN1cnJlbnRUaW1lLCB2aWRlbyA9IHRoaXMubWVkaWE7XG4gICAgaWYgKHZpZGVvICYmIHZpZGVvLnNlZWtpbmcgPT09IGZhbHNlKSB7XG4gICAgICBjdXJyZW50VGltZSA9IHZpZGVvLmN1cnJlbnRUaW1lO1xuICAgICAgLyogaWYgdmlkZW8gZWxlbWVudCBpcyBpbiBzZWVrZWQgc3RhdGUsIGN1cnJlbnRUaW1lIGNhbiBvbmx5IGluY3JlYXNlLlxuICAgICAgICAoYXNzdW1pbmcgdGhhdCBwbGF5YmFjayByYXRlIGlzIHBvc2l0aXZlIC4uLilcbiAgICAgICAgQXMgc29tZXRpbWVzIGN1cnJlbnRUaW1lIGp1bXBzIGJhY2sgdG8gemVybyBhZnRlciBhXG4gICAgICAgIG1lZGlhIGRlY29kZSBlcnJvciwgY2hlY2sgdGhpcywgdG8gYXZvaWQgc2Vla2luZyBiYWNrIHRvXG4gICAgICAgIHdyb25nIHBvc2l0aW9uIGFmdGVyIGEgbWVkaWEgZGVjb2RlIGVycm9yXG4gICAgICAqL1xuICAgICAgaWYoY3VycmVudFRpbWUgPiB2aWRlby5wbGF5YmFja1JhdGUqdGhpcy5sYXN0Q3VycmVudFRpbWUpIHtcbiAgICAgICAgdGhpcy5sYXN0Q3VycmVudFRpbWUgPSBjdXJyZW50VGltZTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLmlzQnVmZmVyZWQoY3VycmVudFRpbWUpKSB7XG4gICAgICAgIHJhbmdlQ3VycmVudCA9IHRoaXMuZ2V0QnVmZmVyUmFuZ2UoY3VycmVudFRpbWUpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLmlzQnVmZmVyZWQoY3VycmVudFRpbWUgKyAwLjEpKSB7XG4gICAgICAgIC8qIGVuc3VyZSB0aGF0IEZSQUdfQ0hBTkdFRCBldmVudCBpcyB0cmlnZ2VyZWQgYXQgc3RhcnR1cCxcbiAgICAgICAgICB3aGVuIGZpcnN0IHZpZGVvIGZyYW1lIGlzIGRpc3BsYXllZCBhbmQgcGxheWJhY2sgaXMgcGF1c2VkLlxuICAgICAgICAgIGFkZCBhIHRvbGVyYW5jZSBvZiAxMDBtcywgaW4gY2FzZSBjdXJyZW50IHBvc2l0aW9uIGlzIG5vdCBidWZmZXJlZCxcbiAgICAgICAgICBjaGVjayBpZiBjdXJyZW50IHBvcysxMDBtcyBpcyBidWZmZXJlZCBhbmQgdXNlIHRoYXQgYnVmZmVyIHJhbmdlXG4gICAgICAgICAgZm9yIEZSQUdfQ0hBTkdFRCBldmVudCByZXBvcnRpbmcgKi9cbiAgICAgICAgcmFuZ2VDdXJyZW50ID0gdGhpcy5nZXRCdWZmZXJSYW5nZShjdXJyZW50VGltZSArIDAuMSk7XG4gICAgICB9XG4gICAgICBpZiAocmFuZ2VDdXJyZW50KSB7XG4gICAgICAgIHZhciBmcmFnUGxheWluZyA9IHJhbmdlQ3VycmVudC5mcmFnO1xuICAgICAgICBpZiAoZnJhZ1BsYXlpbmcgIT09IHRoaXMuZnJhZ1BsYXlpbmcpIHtcbiAgICAgICAgICB0aGlzLmZyYWdQbGF5aW5nID0gZnJhZ1BsYXlpbmc7XG4gICAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5GUkFHX0NIQU5HRUQsIHtmcmFnOiBmcmFnUGxheWluZ30pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLypcbiAgICBhYm9ydCBhbnkgYnVmZmVyIGFwcGVuZCBpbiBwcm9ncmVzcywgYW5kIGZsdXNoIGFsbCBidWZmZXJlZCBkYXRhXG4gICAgcmV0dXJuIHRydWUgb25jZSBldmVyeXRoaW5nIGhhcyBiZWVuIGZsdXNoZWQuXG4gICAgc291cmNlQnVmZmVyLmFib3J0KCkgYW5kIHNvdXJjZUJ1ZmZlci5yZW1vdmUoKSBhcmUgYXN5bmNocm9ub3VzIG9wZXJhdGlvbnNcbiAgICB0aGUgaWRlYSBpcyB0byBjYWxsIHRoaXMgZnVuY3Rpb24gZnJvbSB0aWNrKCkgdGltZXIgYW5kIGNhbGwgaXQgYWdhaW4gdW50aWwgYWxsIHJlc291cmNlcyBoYXZlIGJlZW4gY2xlYW5lZFxuICAgIHRoZSB0aW1lciBpcyByZWFybWVkIHVwb24gc291cmNlQnVmZmVyIHVwZGF0ZWVuZCgpIGV2ZW50LCBzbyB0aGlzIHNob3VsZCBiZSBvcHRpbWFsXG4gICovXG4gIGZsdXNoQnVmZmVyKHN0YXJ0T2Zmc2V0LCBlbmRPZmZzZXQpIHtcbiAgICB2YXIgc2IsIGksIGJ1ZlN0YXJ0LCBidWZFbmQsIGZsdXNoU3RhcnQsIGZsdXNoRW5kO1xuICAgIC8vbG9nZ2VyLmxvZygnZmx1c2hCdWZmZXIscG9zL3N0YXJ0L2VuZDogJyArIHRoaXMubWVkaWEuY3VycmVudFRpbWUgKyAnLycgKyBzdGFydE9mZnNldCArICcvJyArIGVuZE9mZnNldCk7XG4gICAgLy8gc2FmZWd1YXJkIHRvIGF2b2lkIGluZmluaXRlIGxvb3BpbmdcbiAgICBpZiAodGhpcy5mbHVzaEJ1ZmZlckNvdW50ZXIrKyA8ICgyICogdGhpcy5idWZmZXJSYW5nZS5sZW5ndGgpICYmIHRoaXMuc291cmNlQnVmZmVyKSB7XG4gICAgICBmb3IgKHZhciB0eXBlIGluIHRoaXMuc291cmNlQnVmZmVyKSB7XG4gICAgICAgIHNiID0gdGhpcy5zb3VyY2VCdWZmZXJbdHlwZV07XG4gICAgICAgIGlmICghc2IudXBkYXRpbmcpIHtcbiAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgc2IuYnVmZmVyZWQubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGJ1ZlN0YXJ0ID0gc2IuYnVmZmVyZWQuc3RhcnQoaSk7XG4gICAgICAgICAgICBidWZFbmQgPSBzYi5idWZmZXJlZC5lbmQoaSk7XG4gICAgICAgICAgICAvLyB3b3JrYXJvdW5kIGZpcmVmb3ggbm90IGFibGUgdG8gcHJvcGVybHkgZmx1c2ggbXVsdGlwbGUgYnVmZmVyZWQgcmFuZ2UuXG4gICAgICAgICAgICBpZiAobmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLmluZGV4T2YoJ2ZpcmVmb3gnKSAhPT0gLTEgJiYgZW5kT2Zmc2V0ID09PSBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFkpIHtcbiAgICAgICAgICAgICAgZmx1c2hTdGFydCA9IHN0YXJ0T2Zmc2V0O1xuICAgICAgICAgICAgICBmbHVzaEVuZCA9IGVuZE9mZnNldDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGZsdXNoU3RhcnQgPSBNYXRoLm1heChidWZTdGFydCwgc3RhcnRPZmZzZXQpO1xuICAgICAgICAgICAgICBmbHVzaEVuZCA9IE1hdGgubWluKGJ1ZkVuZCwgZW5kT2Zmc2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8qIHNvbWV0aW1lcyBzb3VyY2VidWZmZXIucmVtb3ZlKCkgZG9lcyBub3QgZmx1c2hcbiAgICAgICAgICAgICAgIHRoZSBleGFjdCBleHBlY3RlZCB0aW1lIHJhbmdlLlxuICAgICAgICAgICAgICAgdG8gYXZvaWQgcm91bmRpbmcgaXNzdWVzL2luZmluaXRlIGxvb3AsXG4gICAgICAgICAgICAgICBvbmx5IGZsdXNoIGJ1ZmZlciByYW5nZSBvZiBsZW5ndGggZ3JlYXRlciB0aGFuIDUwMG1zLlxuICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGlmIChmbHVzaEVuZCAtIGZsdXNoU3RhcnQgPiAwLjUpIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgZmx1c2ggJHt0eXBlfSBbJHtmbHVzaFN0YXJ0fSwke2ZsdXNoRW5kfV0sIG9mIFske2J1ZlN0YXJ0fSwke2J1ZkVuZH1dLCBwb3M6JHt0aGlzLm1lZGlhLmN1cnJlbnRUaW1lfWApO1xuICAgICAgICAgICAgICBzYi5yZW1vdmUoZmx1c2hTdGFydCwgZmx1c2hFbmQpO1xuICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vbG9nZ2VyLmxvZygnYWJvcnQgJyArIHR5cGUgKyAnIGFwcGVuZCBpbiBwcm9ncmVzcycpO1xuICAgICAgICAgIC8vIHRoaXMgd2lsbCBhYm9ydCBhbnkgYXBwZW5kaW5nIGluIHByb2dyZXNzXG4gICAgICAgICAgLy9zYi5hYm9ydCgpO1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8qIGFmdGVyIHN1Y2Nlc3NmdWwgYnVmZmVyIGZsdXNoaW5nLCByZWJ1aWxkIGJ1ZmZlciBSYW5nZSBhcnJheVxuICAgICAgbG9vcCB0aHJvdWdoIGV4aXN0aW5nIGJ1ZmZlciByYW5nZSBhbmQgY2hlY2sgaWZcbiAgICAgIGNvcnJlc3BvbmRpbmcgcmFuZ2UgaXMgc3RpbGwgYnVmZmVyZWQuIG9ubHkgcHVzaCB0byBuZXcgYXJyYXkgYWxyZWFkeSBidWZmZXJlZCByYW5nZVxuICAgICovXG4gICAgdmFyIG5ld1JhbmdlID0gW10scmFuZ2U7XG4gICAgZm9yIChpID0gMDsgaSA8IHRoaXMuYnVmZmVyUmFuZ2UubGVuZ3RoOyBpKyspIHtcbiAgICAgIHJhbmdlID0gdGhpcy5idWZmZXJSYW5nZVtpXTtcbiAgICAgIGlmICh0aGlzLmlzQnVmZmVyZWQoKHJhbmdlLnN0YXJ0ICsgcmFuZ2UuZW5kKSAvIDIpKSB7XG4gICAgICAgIG5ld1JhbmdlLnB1c2gocmFuZ2UpO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmJ1ZmZlclJhbmdlID0gbmV3UmFuZ2U7XG4gICAgbG9nZ2VyLmxvZygnYnVmZmVyIGZsdXNoZWQnKTtcbiAgICAvLyBldmVyeXRoaW5nIGZsdXNoZWQgIVxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLypcbiAgICBvbiBpbW1lZGlhdGUgbGV2ZWwgc3dpdGNoIDpcbiAgICAgLSBwYXVzZSBwbGF5YmFjayBpZiBwbGF5aW5nXG4gICAgIC0gY2FuY2VsIGFueSBwZW5kaW5nIGxvYWQgcmVxdWVzdFxuICAgICAtIGFuZCB0cmlnZ2VyIGEgYnVmZmVyIGZsdXNoXG4gICovXG4gIGltbWVkaWF0ZUxldmVsU3dpdGNoKCkge1xuICAgIGxvZ2dlci5sb2coJ2ltbWVkaWF0ZUxldmVsU3dpdGNoJyk7XG4gICAgaWYgKCF0aGlzLmltbWVkaWF0ZVN3aXRjaCkge1xuICAgICAgdGhpcy5pbW1lZGlhdGVTd2l0Y2ggPSB0cnVlO1xuICAgICAgdGhpcy5wcmV2aW91c2x5UGF1c2VkID0gdGhpcy5tZWRpYS5wYXVzZWQ7XG4gICAgICB0aGlzLm1lZGlhLnBhdXNlKCk7XG4gICAgfVxuICAgIHZhciBmcmFnQ3VycmVudCA9IHRoaXMuZnJhZ0N1cnJlbnQ7XG4gICAgaWYgKGZyYWdDdXJyZW50ICYmIGZyYWdDdXJyZW50LmxvYWRlcikge1xuICAgICAgZnJhZ0N1cnJlbnQubG9hZGVyLmFib3J0KCk7XG4gICAgfVxuICAgIHRoaXMuZnJhZ0N1cnJlbnQgPSBudWxsO1xuICAgIC8vIGZsdXNoIGV2ZXJ5dGhpbmdcbiAgICB0aGlzLmZsdXNoQnVmZmVyQ291bnRlciA9IDA7XG4gICAgdGhpcy5mbHVzaFJhbmdlLnB1c2goe3N0YXJ0OiAwLCBlbmQ6IE51bWJlci5QT1NJVElWRV9JTkZJTklUWX0pO1xuICAgIC8vIHRyaWdnZXIgYSBzb3VyY2VCdWZmZXIgZmx1c2hcbiAgICB0aGlzLnN0YXRlID0gU3RhdGUuQlVGRkVSX0ZMVVNISU5HO1xuICAgIC8vIGluY3JlYXNlIGZyYWdtZW50IGxvYWQgSW5kZXggdG8gYXZvaWQgZnJhZyBsb29wIGxvYWRpbmcgZXJyb3IgYWZ0ZXIgYnVmZmVyIGZsdXNoXG4gICAgdGhpcy5mcmFnTG9hZElkeCArPSAyICogdGhpcy5jb25maWcuZnJhZ0xvYWRpbmdMb29wVGhyZXNob2xkO1xuICAgIC8vIHNwZWVkIHVwIHN3aXRjaGluZywgdHJpZ2dlciB0aW1lciBmdW5jdGlvblxuICAgIHRoaXMudGljaygpO1xuICB9XG5cbiAgLypcbiAgICAgb24gaW1tZWRpYXRlIGxldmVsIHN3aXRjaCBlbmQsIGFmdGVyIG5ldyBmcmFnbWVudCBoYXMgYmVlbiBidWZmZXJlZCA6XG4gICAgICAtIG51ZGdlIHZpZGVvIGRlY29kZXIgYnkgc2xpZ2h0bHkgYWRqdXN0aW5nIHZpZGVvIGN1cnJlbnRUaW1lXG4gICAgICAtIHJlc3VtZSB0aGUgcGxheWJhY2sgaWYgbmVlZGVkXG4gICovXG4gIGltbWVkaWF0ZUxldmVsU3dpdGNoRW5kKCkge1xuICAgIHRoaXMuaW1tZWRpYXRlU3dpdGNoID0gZmFsc2U7XG4gICAgdGhpcy5tZWRpYS5jdXJyZW50VGltZSAtPSAwLjAwMDE7XG4gICAgaWYgKCF0aGlzLnByZXZpb3VzbHlQYXVzZWQpIHtcbiAgICAgIHRoaXMubWVkaWEucGxheSgpO1xuICAgIH1cbiAgfVxuXG4gIG5leHRMZXZlbFN3aXRjaCgpIHtcbiAgICAvKiB0cnkgdG8gc3dpdGNoIEFTQVAgd2l0aG91dCBicmVha2luZyB2aWRlbyBwbGF5YmFjayA6XG4gICAgICAgaW4gb3JkZXIgdG8gZW5zdXJlIHNtb290aCBidXQgcXVpY2sgbGV2ZWwgc3dpdGNoaW5nLFxuICAgICAgd2UgbmVlZCB0byBmaW5kIHRoZSBuZXh0IGZsdXNoYWJsZSBidWZmZXIgcmFuZ2VcbiAgICAgIHdlIHNob3VsZCB0YWtlIGludG8gYWNjb3VudCBuZXcgc2VnbWVudCBmZXRjaCB0aW1lXG4gICAgKi9cbiAgICB2YXIgZmV0Y2hkZWxheSwgY3VycmVudFJhbmdlLCBuZXh0UmFuZ2U7XG4gICAgY3VycmVudFJhbmdlID0gdGhpcy5nZXRCdWZmZXJSYW5nZSh0aGlzLm1lZGlhLmN1cnJlbnRUaW1lKTtcbiAgICBpZiAoY3VycmVudFJhbmdlKSB7XG4gICAgLy8gZmx1c2ggYnVmZmVyIHByZWNlZGluZyBjdXJyZW50IGZyYWdtZW50IChmbHVzaCB1bnRpbCBjdXJyZW50IGZyYWdtZW50IHN0YXJ0IG9mZnNldClcbiAgICAvLyBtaW51cyAxcyB0byBhdm9pZCB2aWRlbyBmcmVlemluZywgdGhhdCBjb3VsZCBoYXBwZW4gaWYgd2UgZmx1c2gga2V5ZnJhbWUgb2YgY3VycmVudCB2aWRlbyAuLi5cbiAgICAgIHRoaXMuZmx1c2hSYW5nZS5wdXNoKHtzdGFydDogMCwgZW5kOiBjdXJyZW50UmFuZ2Uuc3RhcnQgLSAxfSk7XG4gICAgfVxuICAgIGlmICghdGhpcy5tZWRpYS5wYXVzZWQpIHtcbiAgICAgIC8vIGFkZCBhIHNhZmV0eSBkZWxheSBvZiAxc1xuICAgICAgdmFyIG5leHRMZXZlbElkID0gdGhpcy5obHMubmV4dExvYWRMZXZlbCxuZXh0TGV2ZWwgPSB0aGlzLmxldmVsc1tuZXh0TGV2ZWxJZF0sIGZyYWdMYXN0S2JwcyA9IHRoaXMuZnJhZ0xhc3RLYnBzO1xuICAgICAgaWYgKGZyYWdMYXN0S2JwcyAmJiB0aGlzLmZyYWdDdXJyZW50KSB7XG4gICAgICAgIGZldGNoZGVsYXkgPSB0aGlzLmZyYWdDdXJyZW50LmR1cmF0aW9uICogbmV4dExldmVsLmJpdHJhdGUgLyAoMTAwMCAqIGZyYWdMYXN0S2JwcykgKyAxO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZmV0Y2hkZWxheSA9IDA7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGZldGNoZGVsYXkgPSAwO1xuICAgIH1cbiAgICAvL2xvZ2dlci5sb2coJ2ZldGNoZGVsYXk6JytmZXRjaGRlbGF5KTtcbiAgICAvLyBmaW5kIGJ1ZmZlciByYW5nZSB0aGF0IHdpbGwgYmUgcmVhY2hlZCBvbmNlIG5ldyBmcmFnbWVudCB3aWxsIGJlIGZldGNoZWRcbiAgICBuZXh0UmFuZ2UgPSB0aGlzLmdldEJ1ZmZlclJhbmdlKHRoaXMubWVkaWEuY3VycmVudFRpbWUgKyBmZXRjaGRlbGF5KTtcbiAgICBpZiAobmV4dFJhbmdlKSB7XG4gICAgICAvLyB3ZSBjYW4gZmx1c2ggYnVmZmVyIHJhbmdlIGZvbGxvd2luZyB0aGlzIG9uZSB3aXRob3V0IHN0YWxsaW5nIHBsYXliYWNrXG4gICAgICBuZXh0UmFuZ2UgPSB0aGlzLmZvbGxvd2luZ0J1ZmZlclJhbmdlKG5leHRSYW5nZSk7XG4gICAgICBpZiAobmV4dFJhbmdlKSB7XG4gICAgICAgIC8vIGZsdXNoIHBvc2l0aW9uIGlzIHRoZSBzdGFydCBwb3NpdGlvbiBvZiB0aGlzIG5ldyBidWZmZXJcbiAgICAgICAgdGhpcy5mbHVzaFJhbmdlLnB1c2goe3N0YXJ0OiBuZXh0UmFuZ2Uuc3RhcnQsIGVuZDogTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZfSk7XG4gICAgICAgIC8vIGlmIHdlIGFyZSBoZXJlLCB3ZSBjYW4gYWxzbyBjYW5jZWwgYW55IGxvYWRpbmcvZGVtdXhpbmcgaW4gcHJvZ3Jlc3MsIGFzIHRoZXkgYXJlIHVzZWxlc3NcbiAgICAgICAgdmFyIGZyYWdDdXJyZW50ID0gdGhpcy5mcmFnQ3VycmVudDtcbiAgICAgICAgaWYgKGZyYWdDdXJyZW50ICYmIGZyYWdDdXJyZW50LmxvYWRlcikge1xuICAgICAgICAgIGZyYWdDdXJyZW50LmxvYWRlci5hYm9ydCgpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZnJhZ0N1cnJlbnQgPSBudWxsO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAodGhpcy5mbHVzaFJhbmdlLmxlbmd0aCkge1xuICAgICAgdGhpcy5mbHVzaEJ1ZmZlckNvdW50ZXIgPSAwO1xuICAgICAgLy8gdHJpZ2dlciBhIHNvdXJjZUJ1ZmZlciBmbHVzaFxuICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLkJVRkZFUl9GTFVTSElORztcbiAgICAgIC8vIGluY3JlYXNlIGZyYWdtZW50IGxvYWQgSW5kZXggdG8gYXZvaWQgZnJhZyBsb29wIGxvYWRpbmcgZXJyb3IgYWZ0ZXIgYnVmZmVyIGZsdXNoXG4gICAgICB0aGlzLmZyYWdMb2FkSWR4ICs9IDIgKiB0aGlzLmNvbmZpZy5mcmFnTG9hZGluZ0xvb3BUaHJlc2hvbGQ7XG4gICAgICAvLyBzcGVlZCB1cCBzd2l0Y2hpbmcsIHRyaWdnZXIgdGltZXIgZnVuY3Rpb25cbiAgICAgIHRoaXMudGljaygpO1xuICAgIH1cbiAgfVxuXG4gIG9uTWVkaWFBdHRhY2hpbmcoZXZlbnQsIGRhdGEpIHtcbiAgICB2YXIgbWVkaWEgPSB0aGlzLm1lZGlhID0gZGF0YS5tZWRpYTtcbiAgICAvLyBzZXR1cCB0aGUgbWVkaWEgc291cmNlXG4gICAgdmFyIG1zID0gdGhpcy5tZWRpYVNvdXJjZSA9IG5ldyBNZWRpYVNvdXJjZSgpO1xuICAgIC8vTWVkaWEgU291cmNlIGxpc3RlbmVyc1xuICAgIHRoaXMub25tc28gPSB0aGlzLm9uTWVkaWFTb3VyY2VPcGVuLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbm1zZSA9IHRoaXMub25NZWRpYVNvdXJjZUVuZGVkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbm1zYyA9IHRoaXMub25NZWRpYVNvdXJjZUNsb3NlLmJpbmQodGhpcyk7XG4gICAgbXMuYWRkRXZlbnRMaXN0ZW5lcignc291cmNlb3BlbicsIHRoaXMub25tc28pO1xuICAgIG1zLmFkZEV2ZW50TGlzdGVuZXIoJ3NvdXJjZWVuZGVkJywgdGhpcy5vbm1zZSk7XG4gICAgbXMuYWRkRXZlbnRMaXN0ZW5lcignc291cmNlY2xvc2UnLCB0aGlzLm9ubXNjKTtcbiAgICAvLyBsaW5rIHZpZGVvIGFuZCBtZWRpYSBTb3VyY2VcbiAgICBtZWRpYS5zcmMgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKG1zKTtcbiAgfVxuXG4gIG9uTWVkaWFEZXRhY2hpbmcoKSB7XG4gICAgdmFyIG1lZGlhID0gdGhpcy5tZWRpYTtcbiAgICBpZiAobWVkaWEgJiYgbWVkaWEuZW5kZWQpIHtcbiAgICAgIGxvZ2dlci5sb2coJ01TRSBkZXRhY2hpbmcgYW5kIHZpZGVvIGVuZGVkLCByZXNldCBzdGFydFBvc2l0aW9uJyk7XG4gICAgICB0aGlzLnN0YXJ0UG9zaXRpb24gPSB0aGlzLmxhc3RDdXJyZW50VGltZSA9IDA7XG4gICAgfVxuXG4gICAgLy8gcmVzZXQgZnJhZ21lbnQgbG9hZGluZyBjb3VudGVyIG9uIE1TRSBkZXRhY2hpbmcgdG8gYXZvaWQgcmVwb3J0aW5nIEZSQUdfTE9PUF9MT0FESU5HX0VSUk9SIGFmdGVyIGVycm9yIHJlY292ZXJ5XG4gICAgdmFyIGxldmVscyA9IHRoaXMubGV2ZWxzO1xuICAgIGlmIChsZXZlbHMpIHtcbiAgICAgIC8vIHJlc2V0IGZyYWdtZW50IGxvYWQgY291bnRlclxuICAgICAgICBsZXZlbHMuZm9yRWFjaChsZXZlbCA9PiB7XG4gICAgICAgICAgaWYobGV2ZWwuZGV0YWlscykge1xuICAgICAgICAgICAgbGV2ZWwuZGV0YWlscy5mcmFnbWVudHMuZm9yRWFjaChmcmFnbWVudCA9PiB7XG4gICAgICAgICAgICAgIGZyYWdtZW50LmxvYWRDb3VudGVyID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICAgIHZhciBtcyA9IHRoaXMubWVkaWFTb3VyY2U7XG4gICAgaWYgKG1zKSB7XG4gICAgICBpZiAobXMucmVhZHlTdGF0ZSA9PT0gJ29wZW4nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgLy8gZW5kT2ZTdHJlYW0gY291bGQgdHJpZ2dlciBleGNlcHRpb24gaWYgYW55IHNvdXJjZWJ1ZmZlciBpcyBpbiB1cGRhdGluZyBzdGF0ZVxuICAgICAgICAgIC8vIHdlIGRvbid0IHJlYWxseSBjYXJlIGFib3V0IGNoZWNraW5nIHNvdXJjZWJ1ZmZlciBzdGF0ZSBoZXJlLFxuICAgICAgICAgIC8vIGFzIHdlIGFyZSBhbnl3YXkgZGV0YWNoaW5nIHRoZSBNZWRpYVNvdXJjZVxuICAgICAgICAgIC8vIGxldCdzIGp1c3QgYXZvaWQgdGhpcyBleGNlcHRpb24gdG8gcHJvcGFnYXRlXG4gICAgICAgICAgbXMuZW5kT2ZTdHJlYW0oKTtcbiAgICAgICAgfSBjYXRjaChlcnIpIHtcbiAgICAgICAgICBsb2dnZXIud2Fybihgb25NZWRpYURldGFjaGluZzoke2Vyci5tZXNzYWdlfSB3aGlsZSBjYWxsaW5nIGVuZE9mU3RyZWFtYCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIG1zLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NvdXJjZW9wZW4nLCB0aGlzLm9ubXNvKTtcbiAgICAgIG1zLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NvdXJjZWVuZGVkJywgdGhpcy5vbm1zZSk7XG4gICAgICBtcy5yZW1vdmVFdmVudExpc3RlbmVyKCdzb3VyY2VjbG9zZScsIHRoaXMub25tc2MpO1xuICAgICAgLy8gdW5saW5rIE1lZGlhU291cmNlIGZyb20gdmlkZW8gdGFnXG4gICAgICB0aGlzLm1lZGlhLnNyYyA9ICcnO1xuICAgICAgdGhpcy5tZWRpYVNvdXJjZSA9IG51bGw7XG4gICAgICAvLyByZW1vdmUgdmlkZW8gbGlzdGVuZXJzXG4gICAgICBpZiAobWVkaWEpIHtcbiAgICAgICAgbWVkaWEucmVtb3ZlRXZlbnRMaXN0ZW5lcignc2Vla2luZycsIHRoaXMub252c2Vla2luZyk7XG4gICAgICAgIG1lZGlhLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NlZWtlZCcsIHRoaXMub252c2Vla2VkKTtcbiAgICAgICAgbWVkaWEucmVtb3ZlRXZlbnRMaXN0ZW5lcignbG9hZGVkbWV0YWRhdGEnLCB0aGlzLm9udm1ldGFkYXRhKTtcbiAgICAgICAgbWVkaWEucmVtb3ZlRXZlbnRMaXN0ZW5lcignZW5kZWQnLCB0aGlzLm9udmVuZGVkKTtcbiAgICAgICAgdGhpcy5vbnZzZWVraW5nID0gdGhpcy5vbnZzZWVrZWQgPSB0aGlzLm9udm1ldGFkYXRhID0gbnVsbDtcbiAgICAgIH1cbiAgICAgIHRoaXMubWVkaWEgPSBudWxsO1xuICAgICAgdGhpcy5sb2FkZWRtZXRhZGF0YSA9IGZhbHNlO1xuICAgICAgdGhpcy5zdG9wKCk7XG4gICAgfVxuICAgIHRoaXMub25tc28gPSB0aGlzLm9ubXNlID0gdGhpcy5vbm1zYyA9IG51bGw7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5NRURJQV9ERVRBQ0hFRCk7XG4gIH1cblxuICBvbk1lZGlhU2Vla2luZygpIHtcbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gU3RhdGUuRlJBR19MT0FESU5HKSB7XG4gICAgICAvLyBjaGVjayBpZiBjdXJyZW50bHkgbG9hZGVkIGZyYWdtZW50IGlzIGluc2lkZSBidWZmZXIuXG4gICAgICAvL2lmIG91dHNpZGUsIGNhbmNlbCBmcmFnbWVudCBsb2FkaW5nLCBvdGhlcndpc2UgZG8gbm90aGluZ1xuICAgICAgaWYgKHRoaXMuYnVmZmVySW5mbyh0aGlzLm1lZGlhLmN1cnJlbnRUaW1lLDAuMykubGVuID09PSAwKSB7XG4gICAgICAgIGxvZ2dlci5sb2coJ3NlZWtpbmcgb3V0c2lkZSBvZiBidWZmZXIgd2hpbGUgZnJhZ21lbnQgbG9hZCBpbiBwcm9ncmVzcywgY2FuY2VsIGZyYWdtZW50IGxvYWQnKTtcbiAgICAgICAgdmFyIGZyYWdDdXJyZW50ID0gdGhpcy5mcmFnQ3VycmVudDtcbiAgICAgICAgaWYgKGZyYWdDdXJyZW50KSB7XG4gICAgICAgICAgaWYgKGZyYWdDdXJyZW50LmxvYWRlcikge1xuICAgICAgICAgICAgZnJhZ0N1cnJlbnQubG9hZGVyLmFib3J0KCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMuZnJhZ0N1cnJlbnQgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZnJhZ1ByZXZpb3VzID0gbnVsbDtcbiAgICAgICAgLy8gc3dpdGNoIHRvIElETEUgc3RhdGUgdG8gbG9hZCBuZXcgZnJhZ21lbnRcbiAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0aGlzLm1lZGlhKSB7XG4gICAgICB0aGlzLmxhc3RDdXJyZW50VGltZSA9IHRoaXMubWVkaWEuY3VycmVudFRpbWU7XG4gICAgfVxuICAgIC8vIGF2b2lkIHJlcG9ydGluZyBmcmFnbWVudCBsb29wIGxvYWRpbmcgZXJyb3IgaW4gY2FzZSB1c2VyIGlzIHNlZWtpbmcgc2V2ZXJhbCB0aW1lcyBvbiBzYW1lIHBvc2l0aW9uXG4gICAgaWYgKHRoaXMuZnJhZ0xvYWRJZHggIT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5mcmFnTG9hZElkeCArPSAyICogdGhpcy5jb25maWcuZnJhZ0xvYWRpbmdMb29wVGhyZXNob2xkO1xuICAgIH1cbiAgICAvLyB0aWNrIHRvIHNwZWVkIHVwIHByb2Nlc3NpbmdcbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4gIG9uTWVkaWFTZWVrZWQoKSB7XG4gICAgLy8gdGljayB0byBzcGVlZCB1cCBGUkFHTUVOVF9QTEFZSU5HIHRyaWdnZXJpbmdcbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4gIG9uTWVkaWFNZXRhZGF0YSgpIHtcbiAgICB2YXIgbWVkaWEgPSB0aGlzLm1lZGlhLFxuICAgICAgICBjdXJyZW50VGltZSA9IG1lZGlhLmN1cnJlbnRUaW1lO1xuICAgIC8vIG9ubHkgYWRqdXN0IGN1cnJlbnRUaW1lIGlmIG5vdCBlcXVhbCB0byAwXG4gICAgaWYgKCFjdXJyZW50VGltZSAmJiBjdXJyZW50VGltZSAhPT0gdGhpcy5zdGFydFBvc2l0aW9uKSB7XG4gICAgICBsb2dnZXIubG9nKCdvbk1lZGlhTWV0YWRhdGE6IGFkanVzdCBjdXJyZW50VGltZSB0byBzdGFydFBvc2l0aW9uJyk7XG4gICAgICBtZWRpYS5jdXJyZW50VGltZSA9IHRoaXMuc3RhcnRQb3NpdGlvbjtcbiAgICB9XG4gICAgdGhpcy5sb2FkZWRtZXRhZGF0YSA9IHRydWU7XG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvbk1lZGlhRW5kZWQoKSB7XG4gICAgbG9nZ2VyLmxvZygnbWVkaWEgZW5kZWQnKTtcbiAgICAvLyByZXNldCBzdGFydFBvc2l0aW9uIGFuZCBsYXN0Q3VycmVudFRpbWUgdG8gcmVzdGFydCBwbGF5YmFjayBAIHN0cmVhbSBiZWdpbm5pbmdcbiAgICB0aGlzLnN0YXJ0UG9zaXRpb24gPSB0aGlzLmxhc3RDdXJyZW50VGltZSA9IDA7XG4gIH1cblxuXG4gIG9uTWFuaWZlc3RQYXJzZWQoZXZlbnQsIGRhdGEpIHtcbiAgICB2YXIgYWFjID0gZmFsc2UsIGhlYWFjID0gZmFsc2UsIGNvZGVjcztcbiAgICBkYXRhLmxldmVscy5mb3JFYWNoKGxldmVsID0+IHtcbiAgICAgIC8vIGRldGVjdCBpZiB3ZSBoYXZlIGRpZmZlcmVudCBraW5kIG9mIGF1ZGlvIGNvZGVjcyB1c2VkIGFtb25nc3QgcGxheWxpc3RzXG4gICAgICBjb2RlY3MgPSBsZXZlbC5jb2RlY3M7XG4gICAgICBpZiAoY29kZWNzKSB7XG4gICAgICAgIGlmIChjb2RlY3MuaW5kZXhPZignbXA0YS40MC4yJykgIT09IC0xKSB7XG4gICAgICAgICAgYWFjID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY29kZWNzLmluZGV4T2YoJ21wNGEuNDAuNScpICE9PSAtMSkge1xuICAgICAgICAgIGhlYWFjID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICAgIHRoaXMuYXVkaW9jb2RlY3N3aXRjaCA9IChhYWMgJiYgaGVhYWMpO1xuICAgIGlmICh0aGlzLmF1ZGlvY29kZWNzd2l0Y2gpIHtcbiAgICAgIGxvZ2dlci5sb2coJ2JvdGggQUFDL0hFLUFBQyBhdWRpbyBmb3VuZCBpbiBsZXZlbHM7IGRlY2xhcmluZyBhdWRpbyBjb2RlYyBhcyBIRS1BQUMnKTtcbiAgICB9XG4gICAgdGhpcy5sZXZlbHMgPSBkYXRhLmxldmVscztcbiAgICB0aGlzLnN0YXJ0TGV2ZWxMb2FkZWQgPSBmYWxzZTtcbiAgICB0aGlzLnN0YXJ0RnJhZ21lbnRSZXF1ZXN0ZWQgPSBmYWxzZTtcbiAgICBpZiAodGhpcy5tZWRpYSAmJiB0aGlzLmNvbmZpZy5hdXRvU3RhcnRMb2FkKSB7XG4gICAgICB0aGlzLnN0YXJ0TG9hZCgpO1xuICAgIH1cbiAgfVxuXG4gIG9uTGV2ZWxMb2FkZWQoZXZlbnQsZGF0YSkge1xuICAgIHZhciBuZXdEZXRhaWxzID0gZGF0YS5kZXRhaWxzLFxuICAgICAgICBuZXdMZXZlbElkID0gZGF0YS5sZXZlbCxcbiAgICAgICAgY3VyTGV2ZWwgPSB0aGlzLmxldmVsc1tuZXdMZXZlbElkXSxcbiAgICAgICAgZHVyYXRpb24gPSBuZXdEZXRhaWxzLnRvdGFsZHVyYXRpb247XG5cbiAgICBsb2dnZXIubG9nKGBsZXZlbCAke25ld0xldmVsSWR9IGxvYWRlZCBbJHtuZXdEZXRhaWxzLnN0YXJ0U059LCR7bmV3RGV0YWlscy5lbmRTTn1dLGR1cmF0aW9uOiR7ZHVyYXRpb259YCk7XG5cbiAgICBpZiAobmV3RGV0YWlscy5saXZlKSB7XG4gICAgICB2YXIgY3VyRGV0YWlscyA9IGN1ckxldmVsLmRldGFpbHM7XG4gICAgICBpZiAoY3VyRGV0YWlscykge1xuICAgICAgICAvLyB3ZSBhbHJlYWR5IGhhdmUgZGV0YWlscyBmb3IgdGhhdCBsZXZlbCwgbWVyZ2UgdGhlbVxuICAgICAgICBMZXZlbEhlbHBlci5tZXJnZURldGFpbHMoY3VyRGV0YWlscyxuZXdEZXRhaWxzKTtcbiAgICAgICAgaWYgKG5ld0RldGFpbHMuUFRTS25vd24pIHtcbiAgICAgICAgICBsb2dnZXIubG9nKGBsaXZlIHBsYXlsaXN0IHNsaWRpbmc6JHtuZXdEZXRhaWxzLmZyYWdtZW50c1swXS5zdGFydC50b0ZpeGVkKDMpfWApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGxvZ2dlci5sb2coJ2xpdmUgcGxheWxpc3QgLSBvdXRkYXRlZCBQVFMsIHVua25vd24gc2xpZGluZycpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBuZXdEZXRhaWxzLlBUU0tub3duID0gZmFsc2U7XG4gICAgICAgIGxvZ2dlci5sb2coJ2xpdmUgcGxheWxpc3QgLSBmaXJzdCBsb2FkLCB1bmtub3duIHNsaWRpbmcnKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgbmV3RGV0YWlscy5QVFNLbm93biA9IGZhbHNlO1xuICAgIH1cbiAgICAvLyBvdmVycmlkZSBsZXZlbCBpbmZvXG4gICAgY3VyTGV2ZWwuZGV0YWlscyA9IG5ld0RldGFpbHM7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5MRVZFTF9VUERBVEVELCB7IGRldGFpbHM6IG5ld0RldGFpbHMsIGxldmVsOiBuZXdMZXZlbElkIH0pO1xuXG4gICAgLy8gY29tcHV0ZSBzdGFydCBwb3NpdGlvblxuICAgIGlmICh0aGlzLnN0YXJ0TGV2ZWxMb2FkZWQgPT09IGZhbHNlKSB7XG4gICAgICAvLyBpZiBsaXZlIHBsYXlsaXN0LCBzZXQgc3RhcnQgcG9zaXRpb24gdG8gYmUgZnJhZ21lbnQgTi10aGlzLmNvbmZpZy5saXZlU3luY0R1cmF0aW9uQ291bnQgKHVzdWFsbHkgMylcbiAgICAgIGlmIChuZXdEZXRhaWxzLmxpdmUpIHtcbiAgICAgICAgdGhpcy5zdGFydFBvc2l0aW9uID0gTWF0aC5tYXgoMCwgZHVyYXRpb24gLSB0aGlzLmNvbmZpZy5saXZlU3luY0R1cmF0aW9uQ291bnQgKiBuZXdEZXRhaWxzLnRhcmdldGR1cmF0aW9uKTtcbiAgICAgIH1cbiAgICAgIHRoaXMubmV4dExvYWRQb3NpdGlvbiA9IHRoaXMuc3RhcnRQb3NpdGlvbjtcbiAgICAgIHRoaXMuc3RhcnRMZXZlbExvYWRlZCA9IHRydWU7XG4gICAgfVxuICAgIC8vIG9ubHkgc3dpdGNoIGJhdGNrIHRvIElETEUgc3RhdGUgaWYgd2Ugd2VyZSB3YWl0aW5nIGZvciBsZXZlbCB0byBzdGFydCBkb3dubG9hZGluZyBhIG5ldyBmcmFnbWVudFxuICAgIGlmICh0aGlzLnN0YXRlID09PSBTdGF0ZS5XQUlUSU5HX0xFVkVMKSB7XG4gICAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICB9XG4gICAgLy90cmlnZ2VyIGhhbmRsZXIgcmlnaHQgbm93XG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvbktleUxvYWRlZCgpIHtcbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gU3RhdGUuS0VZX0xPQURJTkcpIHtcbiAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgICAgdGhpcy50aWNrKCk7XG4gICAgfVxuICB9XG5cbiAgb25GcmFnTG9hZGVkKGV2ZW50LCBkYXRhKSB7XG4gICAgdmFyIGZyYWdDdXJyZW50ID0gdGhpcy5mcmFnQ3VycmVudDtcbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gU3RhdGUuRlJBR19MT0FESU5HICYmXG4gICAgICAgIGZyYWdDdXJyZW50ICYmXG4gICAgICAgIGRhdGEuZnJhZy5sZXZlbCA9PT0gZnJhZ0N1cnJlbnQubGV2ZWwgJiZcbiAgICAgICAgZGF0YS5mcmFnLnNuID09PSBmcmFnQ3VycmVudC5zbikge1xuICAgICAgaWYgKHRoaXMuZnJhZ0JpdHJhdGVUZXN0ID09PSB0cnVlKSB7XG4gICAgICAgIC8vIHN3aXRjaCBiYWNrIHRvIElETEUgc3RhdGUgLi4uIHdlIGp1c3QgbG9hZGVkIGEgZnJhZ21lbnQgdG8gZGV0ZXJtaW5lIGFkZXF1YXRlIHN0YXJ0IGJpdHJhdGUgYW5kIGluaXRpYWxpemUgYXV0b3N3aXRjaCBhbGdvXG4gICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgICAgICB0aGlzLmZyYWdCaXRyYXRlVGVzdCA9IGZhbHNlO1xuICAgICAgICBkYXRhLnN0YXRzLnRwYXJzZWQgPSBkYXRhLnN0YXRzLnRidWZmZXJlZCA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkZSQUdfQlVGRkVSRUQsIHtzdGF0czogZGF0YS5zdGF0cywgZnJhZzogZnJhZ0N1cnJlbnR9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5QQVJTSU5HO1xuICAgICAgICAvLyB0cmFuc211eCB0aGUgTVBFRy1UUyBkYXRhIHRvIElTTy1CTUZGIHNlZ21lbnRzXG4gICAgICAgIHRoaXMuc3RhdHMgPSBkYXRhLnN0YXRzO1xuICAgICAgICB2YXIgY3VycmVudExldmVsID0gdGhpcy5sZXZlbHNbdGhpcy5sZXZlbF0sXG4gICAgICAgICAgICBkZXRhaWxzID0gY3VycmVudExldmVsLmRldGFpbHMsXG4gICAgICAgICAgICBkdXJhdGlvbiA9IGRldGFpbHMudG90YWxkdXJhdGlvbixcbiAgICAgICAgICAgIHN0YXJ0ID0gZnJhZ0N1cnJlbnQuc3RhcnQsXG4gICAgICAgICAgICBsZXZlbCA9IGZyYWdDdXJyZW50LmxldmVsLFxuICAgICAgICAgICAgc24gPSBmcmFnQ3VycmVudC5zbixcbiAgICAgICAgICAgIGF1ZGlvQ29kZWMgPSBjdXJyZW50TGV2ZWwuYXVkaW9Db2RlYztcbiAgICAgICAgaWYoYXVkaW9Db2RlYyAmJiB0aGlzLmF1ZGlvQ29kZWNTd2FwKSB7XG4gICAgICAgICAgbG9nZ2VyLmxvZygnc3dhcHBpbmcgcGxheWxpc3QgYXVkaW8gY29kZWMnKTtcbiAgICAgICAgICBpZihhdWRpb0NvZGVjLmluZGV4T2YoJ21wNGEuNDAuNScpICE9PS0xKSB7XG4gICAgICAgICAgICBhdWRpb0NvZGVjID0gJ21wNGEuNDAuMic7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGF1ZGlvQ29kZWMgPSAnbXA0YS40MC41JztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgbG9nZ2VyLmxvZyhgRGVtdXhpbmcgJHtzbn0gb2YgWyR7ZGV0YWlscy5zdGFydFNOfSAsJHtkZXRhaWxzLmVuZFNOfV0sbGV2ZWwgJHtsZXZlbH1gKTtcbiAgICAgICAgdGhpcy5kZW11eGVyLnB1c2goZGF0YS5wYXlsb2FkLCBhdWRpb0NvZGVjLCBjdXJyZW50TGV2ZWwudmlkZW9Db2RlYywgc3RhcnQsIGZyYWdDdXJyZW50LmNjLCBsZXZlbCwgc24sIGR1cmF0aW9uLCBmcmFnQ3VycmVudC5kZWNyeXB0ZGF0YSk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuZnJhZ0xvYWRFcnJvciA9IDA7XG4gIH1cblxuICBvbkluaXRTZWdtZW50KGV2ZW50LCBkYXRhKSB7XG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IFN0YXRlLlBBUlNJTkcpIHtcbiAgICAgIC8vIGNoZWNrIGlmIGNvZGVjcyBoYXZlIGJlZW4gZXhwbGljaXRlbHkgZGVmaW5lZCBpbiB0aGUgbWFzdGVyIHBsYXlsaXN0IGZvciB0aGlzIGxldmVsO1xuICAgICAgLy8gaWYgeWVzIHVzZSB0aGVzZSBvbmVzIGluc3RlYWQgb2YgdGhlIG9uZXMgcGFyc2VkIGZyb20gdGhlIGRlbXV4XG4gICAgICB2YXIgYXVkaW9Db2RlYyA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdLmF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMgPSB0aGlzLmxldmVsc1t0aGlzLmxldmVsXS52aWRlb0NvZGVjLCBzYjtcbiAgICAgIGlmKGF1ZGlvQ29kZWMgJiYgdGhpcy5hdWRpb0NvZGVjU3dhcCkge1xuICAgICAgICBsb2dnZXIubG9nKCdzd2FwcGluZyBwbGF5bGlzdCBhdWRpbyBjb2RlYycpO1xuICAgICAgICBpZihhdWRpb0NvZGVjLmluZGV4T2YoJ21wNGEuNDAuNScpICE9PS0xKSB7XG4gICAgICAgICAgYXVkaW9Db2RlYyA9ICdtcDRhLjQwLjInO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGF1ZGlvQ29kZWMgPSAnbXA0YS40MC41JztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgbG9nZ2VyLmxvZyhgcGxheWxpc3RfbGV2ZWwvaW5pdF9zZWdtZW50IGNvZGVjczogdmlkZW8gPT4gJHt2aWRlb0NvZGVjfS8ke2RhdGEudmlkZW9Db2RlY307IGF1ZGlvID0+ICR7YXVkaW9Db2RlY30vJHtkYXRhLmF1ZGlvQ29kZWN9YCk7XG4gICAgICAvLyBpZiBwbGF5bGlzdCBkb2VzIG5vdCBzcGVjaWZ5IGNvZGVjcywgdXNlIGNvZGVjcyBmb3VuZCB3aGlsZSBwYXJzaW5nIGZyYWdtZW50XG4gICAgICAvLyBpZiBubyBjb2RlYyBmb3VuZCB3aGlsZSBwYXJzaW5nIGZyYWdtZW50LCBhbHNvIHNldCBjb2RlYyB0byB1bmRlZmluZWQgdG8gYXZvaWQgY3JlYXRpbmcgc291cmNlQnVmZmVyXG4gICAgICBpZiAoYXVkaW9Db2RlYyA9PT0gdW5kZWZpbmVkIHx8IGRhdGEuYXVkaW9Db2RlYyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGF1ZGlvQ29kZWMgPSBkYXRhLmF1ZGlvQ29kZWM7XG4gICAgICB9XG5cbiAgICAgIGlmICh2aWRlb0NvZGVjID09PSB1bmRlZmluZWQgIHx8IGRhdGEudmlkZW9Db2RlYyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHZpZGVvQ29kZWMgPSBkYXRhLnZpZGVvQ29kZWM7XG4gICAgICB9XG4gICAgICAvLyBpbiBjYXNlIHNldmVyYWwgYXVkaW8gY29kZWNzIG1pZ2h0IGJlIHVzZWQsIGZvcmNlIEhFLUFBQyBmb3IgYXVkaW8gKHNvbWUgYnJvd3NlcnMgZG9uJ3Qgc3VwcG9ydCBhdWRpbyBjb2RlYyBzd2l0Y2gpXG4gICAgICAvL2Rvbid0IGRvIGl0IGZvciBtb25vIHN0cmVhbXMgLi4uXG4gICAgICB2YXIgdWEgPSBuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCk7XG4gICAgICBpZiAodGhpcy5hdWRpb2NvZGVjc3dpdGNoICYmXG4gICAgICAgICBkYXRhLmF1ZGlvQ2hhbm5lbENvdW50ICE9PSAxICYmXG4gICAgICAgICAgdWEuaW5kZXhPZignYW5kcm9pZCcpID09PSAtMSAmJlxuICAgICAgICAgIHVhLmluZGV4T2YoJ2ZpcmVmb3gnKSA9PT0gLTEpIHtcbiAgICAgICAgYXVkaW9Db2RlYyA9ICdtcDRhLjQwLjUnO1xuICAgICAgfVxuICAgICAgaWYgKCF0aGlzLnNvdXJjZUJ1ZmZlcikge1xuICAgICAgICB0aGlzLnNvdXJjZUJ1ZmZlciA9IHt9O1xuICAgICAgICBsb2dnZXIubG9nKGBzZWxlY3RlZCBBL1YgY29kZWNzIGZvciBzb3VyY2VCdWZmZXJzOiR7YXVkaW9Db2RlY30sJHt2aWRlb0NvZGVjfWApO1xuICAgICAgICAvLyBjcmVhdGUgc291cmNlIEJ1ZmZlciBhbmQgbGluayB0aGVtIHRvIE1lZGlhU291cmNlXG4gICAgICAgIGlmIChhdWRpb0NvZGVjKSB7XG4gICAgICAgICAgc2IgPSB0aGlzLnNvdXJjZUJ1ZmZlci5hdWRpbyA9IHRoaXMubWVkaWFTb3VyY2UuYWRkU291cmNlQnVmZmVyKGB2aWRlby9tcDQ7Y29kZWNzPSR7YXVkaW9Db2RlY31gKTtcbiAgICAgICAgICBzYi5hZGRFdmVudExpc3RlbmVyKCd1cGRhdGVlbmQnLCB0aGlzLm9uc2J1ZSk7XG4gICAgICAgICAgc2IuYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLCB0aGlzLm9uc2JlKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodmlkZW9Db2RlYykge1xuICAgICAgICAgIHNiID0gdGhpcy5zb3VyY2VCdWZmZXIudmlkZW8gPSB0aGlzLm1lZGlhU291cmNlLmFkZFNvdXJjZUJ1ZmZlcihgdmlkZW8vbXA0O2NvZGVjcz0ke3ZpZGVvQ29kZWN9YCk7XG4gICAgICAgICAgc2IuYWRkRXZlbnRMaXN0ZW5lcigndXBkYXRlZW5kJywgdGhpcy5vbnNidWUpO1xuICAgICAgICAgIHNiLmFkZEV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgdGhpcy5vbnNiZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChhdWRpb0NvZGVjKSB7XG4gICAgICAgIHRoaXMubXA0c2VnbWVudHMucHVzaCh7dHlwZTogJ2F1ZGlvJywgZGF0YTogZGF0YS5hdWRpb01vb3Z9KTtcbiAgICAgIH1cbiAgICAgIGlmKHZpZGVvQ29kZWMpIHtcbiAgICAgICAgdGhpcy5tcDRzZWdtZW50cy5wdXNoKHt0eXBlOiAndmlkZW8nLCBkYXRhOiBkYXRhLnZpZGVvTW9vdn0pO1xuICAgICAgfVxuICAgICAgLy90cmlnZ2VyIGhhbmRsZXIgcmlnaHQgbm93XG4gICAgICB0aGlzLnRpY2soKTtcbiAgICB9XG4gIH1cblxuICBvbkZyYWdQYXJzaW5nKGV2ZW50LCBkYXRhKSB7XG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IFN0YXRlLlBBUlNJTkcpIHtcbiAgICAgIHRoaXMudHBhcnNlMiA9IERhdGUubm93KCk7XG4gICAgICB2YXIgbGV2ZWwgPSB0aGlzLmxldmVsc1t0aGlzLmxldmVsXSxcbiAgICAgICAgICBmcmFnID0gdGhpcy5mcmFnQ3VycmVudDtcbiAgICAgIGxvZ2dlci5sb2coYHBhcnNlZCAke2RhdGEudHlwZX0sUFRTOlske2RhdGEuc3RhcnRQVFMudG9GaXhlZCgzKX0sJHtkYXRhLmVuZFBUUy50b0ZpeGVkKDMpfV0sRFRTOlske2RhdGEuc3RhcnREVFMudG9GaXhlZCgzKX0vJHtkYXRhLmVuZERUUy50b0ZpeGVkKDMpfV0sbmI6JHtkYXRhLm5ifWApO1xuICAgICAgdmFyIGRyaWZ0ID0gTGV2ZWxIZWxwZXIudXBkYXRlRnJhZ1BUUyhsZXZlbC5kZXRhaWxzLGZyYWcuc24sZGF0YS5zdGFydFBUUyxkYXRhLmVuZFBUUyk7XG4gICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkxFVkVMX1BUU19VUERBVEVELCB7ZGV0YWlsczogbGV2ZWwuZGV0YWlscywgbGV2ZWw6IHRoaXMubGV2ZWwsIGRyaWZ0OiBkcmlmdH0pO1xuXG4gICAgICB0aGlzLm1wNHNlZ21lbnRzLnB1c2goe3R5cGU6IGRhdGEudHlwZSwgZGF0YTogZGF0YS5tb29mfSk7XG4gICAgICB0aGlzLm1wNHNlZ21lbnRzLnB1c2goe3R5cGU6IGRhdGEudHlwZSwgZGF0YTogZGF0YS5tZGF0fSk7XG4gICAgICB0aGlzLm5leHRMb2FkUG9zaXRpb24gPSBkYXRhLmVuZFBUUztcbiAgICAgIHRoaXMuYnVmZmVyUmFuZ2UucHVzaCh7dHlwZTogZGF0YS50eXBlLCBzdGFydDogZGF0YS5zdGFydFBUUywgZW5kOiBkYXRhLmVuZFBUUywgZnJhZzogZnJhZ30pO1xuXG4gICAgICAvL3RyaWdnZXIgaGFuZGxlciByaWdodCBub3dcbiAgICAgIHRoaXMudGljaygpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsb2dnZXIud2Fybihgbm90IGluIFBBUlNJTkcgc3RhdGUsIGRpc2NhcmRpbmcgJHtldmVudH1gKTtcbiAgICB9XG4gIH1cblxuICBvbkZyYWdQYXJzZWQoKSB7XG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IFN0YXRlLlBBUlNJTkcpIHtcbiAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5QQVJTRUQ7XG4gICAgICB0aGlzLnN0YXRzLnRwYXJzZWQgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgIC8vdHJpZ2dlciBoYW5kbGVyIHJpZ2h0IG5vd1xuICAgICAgdGhpcy50aWNrKCk7XG4gICAgfVxuICB9XG5cbiAgb25FcnJvcihldmVudCwgZGF0YSkge1xuICAgIHN3aXRjaChkYXRhLmRldGFpbHMpIHtcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9FUlJPUjpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9USU1FT1VUOlxuICAgICAgICBpZighZGF0YS5mYXRhbCkge1xuICAgICAgICAgIHZhciBsb2FkRXJyb3IgPSB0aGlzLmZyYWdMb2FkRXJyb3I7XG4gICAgICAgICAgaWYobG9hZEVycm9yKSB7XG4gICAgICAgICAgICBsb2FkRXJyb3IrKztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbG9hZEVycm9yPTE7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChsb2FkRXJyb3IgPD0gdGhpcy5jb25maWcuZnJhZ0xvYWRpbmdNYXhSZXRyeSkge1xuICAgICAgICAgICAgdGhpcy5mcmFnTG9hZEVycm9yID0gbG9hZEVycm9yO1xuICAgICAgICAgICAgLy8gcmVzZXQgbG9hZCBjb3VudGVyIHRvIGF2b2lkIGZyYWcgbG9vcCBsb2FkaW5nIGVycm9yXG4gICAgICAgICAgICBkYXRhLmZyYWcubG9hZENvdW50ZXIgPSAwO1xuICAgICAgICAgICAgLy8gZXhwb25lbnRpYWwgYmFja29mZiBjYXBwZWQgdG8gNjRzXG4gICAgICAgICAgICB2YXIgZGVsYXkgPSBNYXRoLm1pbihNYXRoLnBvdygyLGxvYWRFcnJvci0xKSp0aGlzLmNvbmZpZy5mcmFnTG9hZGluZ1JldHJ5RGVsYXksNjQwMDApO1xuICAgICAgICAgICAgbG9nZ2VyLndhcm4oYG1lZGlhQ29udHJvbGxlcjogZnJhZyBsb2FkaW5nIGZhaWxlZCwgcmV0cnkgaW4gJHtkZWxheX0gbXNgKTtcbiAgICAgICAgICAgIHRoaXMucmV0cnlEYXRlID0gcGVyZm9ybWFuY2Uubm93KCkgKyBkZWxheTtcbiAgICAgICAgICAgIC8vIHJldHJ5IGxvYWRpbmcgc3RhdGVcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5GUkFHX0xPQURJTkdfV0FJVElOR19SRVRSWTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbG9nZ2VyLmVycm9yKGBtZWRpYUNvbnRyb2xsZXI6ICR7ZGF0YS5kZXRhaWxzfSByZWFjaGVzIG1heCByZXRyeSwgcmVkaXNwYXRjaCBhcyBmYXRhbCAuLi5gKTtcbiAgICAgICAgICAgIC8vIHJlZGlzcGF0Y2ggc2FtZSBlcnJvciBidXQgd2l0aCBmYXRhbCBzZXQgdG8gdHJ1ZVxuICAgICAgICAgICAgZGF0YS5mYXRhbCA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmhscy50cmlnZ2VyKGV2ZW50LCBkYXRhKTtcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5FUlJPUjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5GUkFHX0xPT1BfTE9BRElOR19FUlJPUjpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkxFVkVMX0xPQURfRVJST1I6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5MRVZFTF9MT0FEX1RJTUVPVVQ6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5LRVlfTE9BRF9FUlJPUjpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLktFWV9MT0FEX1RJTUVPVVQ6XG4gICAgICAgIC8vIGlmIGZhdGFsIGVycm9yLCBzdG9wIHByb2Nlc3NpbmcsIG90aGVyd2lzZSBtb3ZlIHRvIElETEUgdG8gcmV0cnkgbG9hZGluZ1xuICAgICAgICBsb2dnZXIud2FybihgbWVkaWFDb250cm9sbGVyOiAke2RhdGEuZGV0YWlsc30gd2hpbGUgbG9hZGluZyBmcmFnLHN3aXRjaCB0byAke2RhdGEuZmF0YWwgPyAnRVJST1InIDogJ0lETEUnfSBzdGF0ZSAuLi5gKTtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IGRhdGEuZmF0YWwgPyBTdGF0ZS5FUlJPUiA6IFN0YXRlLklETEU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgb25TQlVwZGF0ZUVuZCgpIHtcbiAgICAvL3RyaWdnZXIgaGFuZGxlciByaWdodCBub3dcbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gU3RhdGUuQVBQRU5ESU5HICYmIHRoaXMubXA0c2VnbWVudHMubGVuZ3RoID09PSAwKSAge1xuICAgICAgdmFyIGZyYWcgPSB0aGlzLmZyYWdDdXJyZW50LCBzdGF0cyA9IHRoaXMuc3RhdHM7XG4gICAgICBpZiAoZnJhZykge1xuICAgICAgICB0aGlzLmZyYWdQcmV2aW91cyA9IGZyYWc7XG4gICAgICAgIHN0YXRzLnRidWZmZXJlZCA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgICB0aGlzLmZyYWdMYXN0S2JwcyA9IE1hdGgucm91bmQoOCAqIHN0YXRzLmxlbmd0aCAvIChzdGF0cy50YnVmZmVyZWQgLSBzdGF0cy50Zmlyc3QpKTtcbiAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5GUkFHX0JVRkZFUkVELCB7c3RhdHM6IHN0YXRzLCBmcmFnOiBmcmFnfSk7XG4gICAgICAgIGxvZ2dlci5sb2coYG1lZGlhIGJ1ZmZlcmVkIDogJHt0aGlzLnRpbWVSYW5nZXNUb1N0cmluZyh0aGlzLm1lZGlhLmJ1ZmZlcmVkKX1gKTtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMudGljaygpO1xuICB9XG5cbl9jaGVja0J1ZmZlcigpIHtcbiAgICB2YXIgbWVkaWEgPSB0aGlzLm1lZGlhO1xuICAgIGlmKG1lZGlhKSB7XG4gICAgICAvLyBjb21wYXJlIHJlYWR5U3RhdGVcbiAgICAgIHZhciByZWFkeVN0YXRlID0gbWVkaWEucmVhZHlTdGF0ZTtcbiAgICAgIC8vIGlmIHJlYWR5IHN0YXRlIGRpZmZlcmVudCBmcm9tIEhBVkVfTk9USElORyAobnVtZXJpYyB2YWx1ZSAwKSwgd2UgYXJlIGFsbG93ZWQgdG8gc2Vla1xuICAgICAgaWYocmVhZHlTdGF0ZSkge1xuICAgICAgICAvLyBpZiBzZWVrIGFmdGVyIGJ1ZmZlcmVkIGRlZmluZWQsIGxldCdzIHNlZWsgaWYgd2l0aGluIGFjY2VwdGFibGUgcmFuZ2VcbiAgICAgICAgdmFyIHNlZWtBZnRlckJ1ZmZlcmVkID0gdGhpcy5zZWVrQWZ0ZXJCdWZmZXJlZDtcbiAgICAgICAgaWYoc2Vla0FmdGVyQnVmZmVyZWQpIHtcbiAgICAgICAgICBpZihtZWRpYS5kdXJhdGlvbiA+PSBzZWVrQWZ0ZXJCdWZmZXJlZCkge1xuICAgICAgICAgICAgbWVkaWEuY3VycmVudFRpbWUgPSBzZWVrQWZ0ZXJCdWZmZXJlZDtcbiAgICAgICAgICAgIHRoaXMuc2Vla0FmdGVyQnVmZmVyZWQgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhciBjdXJyZW50VGltZSA9IG1lZGlhLmN1cnJlbnRUaW1lLFxuICAgICAgICAgICAgICBidWZmZXJJbmZvID0gdGhpcy5idWZmZXJJbmZvKGN1cnJlbnRUaW1lLDApLFxuICAgICAgICAgICAgICBpc1BsYXlpbmcgPSAhKG1lZGlhLnBhdXNlZCB8fCBtZWRpYS5lbmRlZCB8fCBtZWRpYS5zZWVraW5nIHx8IHJlYWR5U3RhdGUgPCAzKSxcbiAgICAgICAgICAgICAganVtcFRocmVzaG9sZCA9IDAuMjtcblxuICAgICAgICAgIC8vIGNoZWNrIGJ1ZmZlciB1cGZyb250XG4gICAgICAgICAgLy8gaWYgbGVzcyB0aGFuIDIwMG1zIGlzIGJ1ZmZlcmVkLCBhbmQgbWVkaWEgaXMgcGxheWluZyBidXQgcGxheWhlYWQgaXMgbm90IG1vdmluZyxcbiAgICAgICAgICAvLyBhbmQgd2UgaGF2ZSBhIG5ldyBidWZmZXIgcmFuZ2UgYXZhaWxhYmxlIHVwZnJvbnQsIGxldCdzIHNlZWsgdG8gdGhhdCBvbmVcbiAgICAgICAgICBpZihidWZmZXJJbmZvLmxlbiA8PSBqdW1wVGhyZXNob2xkKSB7XG4gICAgICAgICAgICBpZihjdXJyZW50VGltZSA+IG1lZGlhLnBsYXliYWNrUmF0ZSp0aGlzLmxhc3RDdXJyZW50VGltZSB8fCAhaXNQbGF5aW5nKSB7XG4gICAgICAgICAgICAgIC8vIHBsYXloZWFkIG1vdmluZyBvciBtZWRpYSBub3QgcGxheWluZ1xuICAgICAgICAgICAgICBqdW1wVGhyZXNob2xkID0gMDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGxvZ2dlci50cmFjZSgncGxheWJhY2sgc2VlbXMgc3R1Y2snKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIGlmIHdlIGFyZSBiZWxvdyB0aHJlc2hvbGQsIHRyeSB0byBqdW1wIGlmIG5leHQgYnVmZmVyIHJhbmdlIGlzIGNsb3NlXG4gICAgICAgICAgICBpZihidWZmZXJJbmZvLmxlbiA8PSBqdW1wVGhyZXNob2xkKSB7XG4gICAgICAgICAgICAgIC8vIG5vIGJ1ZmZlciBhdmFpbGFibGUgQCBjdXJyZW50VGltZSwgY2hlY2sgaWYgbmV4dCBidWZmZXIgaXMgY2xvc2UgKG1vcmUgdGhhbiA1bXMgZGlmZiBidXQgd2l0aGluIGEgMzAwIG1zIHJhbmdlKVxuICAgICAgICAgICAgICB2YXIgbmV4dEJ1ZmZlclN0YXJ0ID0gYnVmZmVySW5mby5uZXh0U3RhcnQsIGRlbHRhID0gbmV4dEJ1ZmZlclN0YXJ0LWN1cnJlbnRUaW1lO1xuICAgICAgICAgICAgICBpZihuZXh0QnVmZmVyU3RhcnQgJiZcbiAgICAgICAgICAgICAgICAgKGRlbHRhIDwgMC4zKSAmJlxuICAgICAgICAgICAgICAgICAoZGVsdGEgPiAwLjAwNSkgICYmXG4gICAgICAgICAgICAgICAgICFtZWRpYS5zZWVraW5nKSB7XG4gICAgICAgICAgICAgICAgLy8gbmV4dCBidWZmZXIgaXMgY2xvc2UgISBhZGp1c3QgY3VycmVudFRpbWUgdG8gbmV4dEJ1ZmZlclN0YXJ0XG4gICAgICAgICAgICAgICAgLy8gdGhpcyB3aWxsIGVuc3VyZSBlZmZlY3RpdmUgdmlkZW8gZGVjb2RpbmdcbiAgICAgICAgICAgICAgICBsb2dnZXIubG9nKGBhZGp1c3QgY3VycmVudFRpbWUgZnJvbSAke2N1cnJlbnRUaW1lfSB0byAke25leHRCdWZmZXJTdGFydH1gKTtcbiAgICAgICAgICAgICAgICBtZWRpYS5jdXJyZW50VGltZSA9IG5leHRCdWZmZXJTdGFydDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHN3YXBBdWRpb0NvZGVjKCkge1xuICAgIHRoaXMuYXVkaW9Db2RlY1N3YXAgPSAhdGhpcy5hdWRpb0NvZGVjU3dhcDtcbiAgfVxuXG4gIG9uU0JVcGRhdGVFcnJvcihldmVudCkge1xuICAgIGxvZ2dlci5lcnJvcihgc291cmNlQnVmZmVyIGVycm9yOiR7ZXZlbnR9YCk7XG4gICAgdGhpcy5zdGF0ZSA9IFN0YXRlLkVSUk9SO1xuICAgIC8vIGFjY29yZGluZyB0byBodHRwOi8vd3d3LnczLm9yZy9UUi9tZWRpYS1zb3VyY2UvI3NvdXJjZWJ1ZmZlci1hcHBlbmQtZXJyb3JcbiAgICAvLyB0aGlzIGVycm9yIG1pZ2h0IG5vdCBhbHdheXMgYmUgZmF0YWwgKGl0IGlzIGZhdGFsIGlmIGRlY29kZSBlcnJvciBpcyBzZXQsIGluIHRoYXQgY2FzZVxuICAgIC8vIGl0IHdpbGwgYmUgZm9sbG93ZWQgYnkgYSBtZWRpYUVsZW1lbnQgZXJyb3IgLi4uKVxuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuQlVGRkVSX0FQUEVORElOR19FUlJPUiwgZmF0YWw6IGZhbHNlLCBmcmFnOiB0aGlzLmZyYWdDdXJyZW50fSk7XG4gIH1cblxuICB0aW1lUmFuZ2VzVG9TdHJpbmcocikge1xuICAgIHZhciBsb2cgPSAnJywgbGVuID0gci5sZW5ndGg7XG4gICAgZm9yICh2YXIgaT0wOyBpPGxlbjsgaSsrKSB7XG4gICAgICBsb2cgKz0gJ1snICsgci5zdGFydChpKSArICcsJyArIHIuZW5kKGkpICsgJ10nO1xuICAgIH1cbiAgICByZXR1cm4gbG9nO1xuICB9XG5cbiAgb25NZWRpYVNvdXJjZU9wZW4oKSB7XG4gICAgbG9nZ2VyLmxvZygnbWVkaWEgc291cmNlIG9wZW5lZCcpO1xuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuTUVESUFfQVRUQUNIRUQpO1xuICAgIHRoaXMub252c2Vla2luZyA9IHRoaXMub25NZWRpYVNlZWtpbmcuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9udnNlZWtlZCA9IHRoaXMub25NZWRpYVNlZWtlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub252bWV0YWRhdGEgPSB0aGlzLm9uTWVkaWFNZXRhZGF0YS5iaW5kKHRoaXMpO1xuICAgIHRoaXMub252ZW5kZWQgPSB0aGlzLm9uTWVkaWFFbmRlZC5iaW5kKHRoaXMpO1xuICAgIHZhciBtZWRpYSA9IHRoaXMubWVkaWE7XG4gICAgbWVkaWEuYWRkRXZlbnRMaXN0ZW5lcignc2Vla2luZycsIHRoaXMub252c2Vla2luZyk7XG4gICAgbWVkaWEuYWRkRXZlbnRMaXN0ZW5lcignc2Vla2VkJywgdGhpcy5vbnZzZWVrZWQpO1xuICAgIG1lZGlhLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWRlZG1ldGFkYXRhJywgdGhpcy5vbnZtZXRhZGF0YSk7XG4gICAgbWVkaWEuYWRkRXZlbnRMaXN0ZW5lcignZW5kZWQnLCB0aGlzLm9udmVuZGVkKTtcbiAgICBpZih0aGlzLmxldmVscyAmJiB0aGlzLmNvbmZpZy5hdXRvU3RhcnRMb2FkKSB7XG4gICAgICB0aGlzLnN0YXJ0TG9hZCgpO1xuICAgIH1cbiAgICAvLyBvbmNlIHJlY2VpdmVkLCBkb24ndCBsaXN0ZW4gYW55bW9yZSB0byBzb3VyY2VvcGVuIGV2ZW50XG4gICAgdGhpcy5tZWRpYVNvdXJjZS5yZW1vdmVFdmVudExpc3RlbmVyKCdzb3VyY2VvcGVuJywgdGhpcy5vbm1zbyk7XG4gIH1cblxuICBvbk1lZGlhU291cmNlQ2xvc2UoKSB7XG4gICAgbG9nZ2VyLmxvZygnbWVkaWEgc291cmNlIGNsb3NlZCcpO1xuICB9XG5cbiAgb25NZWRpYVNvdXJjZUVuZGVkKCkge1xuICAgIGxvZ2dlci5sb2coJ21lZGlhIHNvdXJjZSBlbmRlZCcpO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBNU0VNZWRpYUNvbnRyb2xsZXI7XG5cbiIsIi8qXG4gKlxuICogVGhpcyBmaWxlIGNvbnRhaW5zIGFuIGFkYXB0YXRpb24gb2YgdGhlIEFFUyBkZWNyeXB0aW9uIGFsZ29yaXRobVxuICogZnJvbSB0aGUgU3RhbmRmb3JkIEphdmFzY3JpcHQgQ3J5cHRvZ3JhcGh5IExpYnJhcnkuIFRoYXQgd29yayBpc1xuICogY292ZXJlZCBieSB0aGUgZm9sbG93aW5nIGNvcHlyaWdodCBhbmQgcGVybWlzc2lvbnMgbm90aWNlOlxuICpcbiAqIENvcHlyaWdodCAyMDA5LTIwMTAgRW1pbHkgU3RhcmssIE1pa2UgSGFtYnVyZywgRGFuIEJvbmVoLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBSZWRpc3RyaWJ1dGlvbiBhbmQgdXNlIGluIHNvdXJjZSBhbmQgYmluYXJ5IGZvcm1zLCB3aXRoIG9yIHdpdGhvdXRcbiAqIG1vZGlmaWNhdGlvbiwgYXJlIHBlcm1pdHRlZCBwcm92aWRlZCB0aGF0IHRoZSBmb2xsb3dpbmcgY29uZGl0aW9ucyBhcmVcbiAqIG1ldDpcbiAqXG4gKiAxLiBSZWRpc3RyaWJ1dGlvbnMgb2Ygc291cmNlIGNvZGUgbXVzdCByZXRhaW4gdGhlIGFib3ZlIGNvcHlyaWdodFxuICogICAgbm90aWNlLCB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZyBkaXNjbGFpbWVyLlxuICpcbiAqIDIuIFJlZGlzdHJpYnV0aW9ucyBpbiBiaW5hcnkgZm9ybSBtdXN0IHJlcHJvZHVjZSB0aGUgYWJvdmVcbiAqICAgIGNvcHlyaWdodCBub3RpY2UsIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nXG4gKiAgICBkaXNjbGFpbWVyIGluIHRoZSBkb2N1bWVudGF0aW9uIGFuZC9vciBvdGhlciBtYXRlcmlhbHMgcHJvdmlkZWRcbiAqICAgIHdpdGggdGhlIGRpc3RyaWJ1dGlvbi5cbiAqXG4gKiBUSElTIFNPRlRXQVJFIElTIFBST1ZJREVEIEJZIFRIRSBBVVRIT1JTIGBgQVMgSVMnJyBBTkQgQU5ZIEVYUFJFU1MgT1JcbiAqIElNUExJRUQgV0FSUkFOVElFUywgSU5DTFVESU5HLCBCVVQgTk9UIExJTUlURUQgVE8sIFRIRSBJTVBMSUVEXG4gKiBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSBBTkQgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQVJFXG4gKiBESVNDTEFJTUVELiBJTiBOTyBFVkVOVCBTSEFMTCA8Q09QWVJJR0hUIEhPTERFUj4gT1IgQ09OVFJJQlVUT1JTIEJFXG4gKiBMSUFCTEUgRk9SIEFOWSBESVJFQ1QsIElORElSRUNULCBJTkNJREVOVEFMLCBTUEVDSUFMLCBFWEVNUExBUlksIE9SXG4gKiBDT05TRVFVRU5USUFMIERBTUFHRVMgKElOQ0xVRElORywgQlVUIE5PVCBMSU1JVEVEIFRPLCBQUk9DVVJFTUVOVCBPRlxuICogU1VCU1RJVFVURSBHT09EUyBPUiBTRVJWSUNFUzsgTE9TUyBPRiBVU0UsIERBVEEsIE9SIFBST0ZJVFM7IE9SXG4gKiBCVVNJTkVTUyBJTlRFUlJVUFRJT04pIEhPV0VWRVIgQ0FVU0VEIEFORCBPTiBBTlkgVEhFT1JZIE9GIExJQUJJTElUWSxcbiAqIFdIRVRIRVIgSU4gQ09OVFJBQ1QsIFNUUklDVCBMSUFCSUxJVFksIE9SIFRPUlQgKElOQ0xVRElORyBORUdMSUdFTkNFXG4gKiBPUiBPVEhFUldJU0UpIEFSSVNJTkcgSU4gQU5ZIFdBWSBPVVQgT0YgVEhFIFVTRSBPRiBUSElTIFNPRlRXQVJFLCBFVkVOXG4gKiBJRiBBRFZJU0VEIE9GIFRIRSBQT1NTSUJJTElUWSBPRiBTVUNIIERBTUFHRS5cbiAqXG4gKiBUaGUgdmlld3MgYW5kIGNvbmNsdXNpb25zIGNvbnRhaW5lZCBpbiB0aGUgc29mdHdhcmUgYW5kIGRvY3VtZW50YXRpb25cbiAqIGFyZSB0aG9zZSBvZiB0aGUgYXV0aG9ycyBhbmQgc2hvdWxkIG5vdCBiZSBpbnRlcnByZXRlZCBhcyByZXByZXNlbnRpbmdcbiAqIG9mZmljaWFsIHBvbGljaWVzLCBlaXRoZXIgZXhwcmVzc2VkIG9yIGltcGxpZWQsIG9mIHRoZSBhdXRob3JzLlxuICovXG5jbGFzcyBBRVMge1xuXG4gIC8qKlxuICAgKiBTY2hlZHVsZSBvdXQgYW4gQUVTIGtleSBmb3IgYm90aCBlbmNyeXB0aW9uIGFuZCBkZWNyeXB0aW9uLiBUaGlzXG4gICAqIGlzIGEgbG93LWxldmVsIGNsYXNzLiBVc2UgYSBjaXBoZXIgbW9kZSB0byBkbyBidWxrIGVuY3J5cHRpb24uXG4gICAqXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0ga2V5IHtBcnJheX0gVGhlIGtleSBhcyBhbiBhcnJheSBvZiA0LCA2IG9yIDggd29yZHMuXG4gICAqL1xuICBjb25zdHJ1Y3RvcihrZXkpIHtcbiAgICAvKipcbiAgICAgKiBUaGUgZXhwYW5kZWQgUy1ib3ggYW5kIGludmVyc2UgUy1ib3ggdGFibGVzLiBUaGVzZSB3aWxsIGJlIGNvbXB1dGVkXG4gICAgICogb24gdGhlIGNsaWVudCBzbyB0aGF0IHdlIGRvbid0IGhhdmUgdG8gc2VuZCB0aGVtIGRvd24gdGhlIHdpcmUuXG4gICAgICpcbiAgICAgKiBUaGVyZSBhcmUgdHdvIHRhYmxlcywgX3RhYmxlc1swXSBpcyBmb3IgZW5jcnlwdGlvbiBhbmRcbiAgICAgKiBfdGFibGVzWzFdIGlzIGZvciBkZWNyeXB0aW9uLlxuICAgICAqXG4gICAgICogVGhlIGZpcnN0IDQgc3ViLXRhYmxlcyBhcmUgdGhlIGV4cGFuZGVkIFMtYm94IHdpdGggTWl4Q29sdW1ucy4gVGhlXG4gICAgICogbGFzdCAoX3RhYmxlc1swMV1bNF0pIGlzIHRoZSBTLWJveCBpdHNlbGYuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHRoaXMuX3RhYmxlcyA9IFtbW10sW10sW10sW10sW11dLFtbXSxbXSxbXSxbXSxbXV1dO1xuXG4gICAgdGhpcy5fcHJlY29tcHV0ZSgpO1xuXG4gICAgdmFyIGksIGosIHRtcCxcbiAgICBlbmNLZXksIGRlY0tleSxcbiAgICBzYm94ID0gdGhpcy5fdGFibGVzWzBdWzRdLCBkZWNUYWJsZSA9IHRoaXMuX3RhYmxlc1sxXSxcbiAgICBrZXlMZW4gPSBrZXkubGVuZ3RoLCByY29uID0gMTtcblxuICAgIGlmIChrZXlMZW4gIT09IDQgJiYga2V5TGVuICE9PSA2ICYmIGtleUxlbiAhPT0gOCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGFlcyBrZXkgc2l6ZT0nICsga2V5TGVuKTtcbiAgICB9XG5cbiAgICBlbmNLZXkgPSBrZXkuc2xpY2UoMCk7XG4gICAgZGVjS2V5ID0gW107XG4gICAgdGhpcy5fa2V5ID0gW2VuY0tleSwgZGVjS2V5XTtcblxuICAgIC8vIHNjaGVkdWxlIGVuY3J5cHRpb24ga2V5c1xuICAgIGZvciAoaSA9IGtleUxlbjsgaSA8IDQgKiBrZXlMZW4gKyAyODsgaSsrKSB7XG4gICAgICB0bXAgPSBlbmNLZXlbaS0xXTtcblxuICAgICAgLy8gYXBwbHkgc2JveFxuICAgICAgaWYgKGkla2V5TGVuID09PSAwIHx8IChrZXlMZW4gPT09IDggJiYgaSVrZXlMZW4gPT09IDQpKSB7XG4gICAgICAgIHRtcCA9IHNib3hbdG1wPj4+MjRdPDwyNCBeIHNib3hbdG1wPj4xNiYyNTVdPDwxNiBeIHNib3hbdG1wPj44JjI1NV08PDggXiBzYm94W3RtcCYyNTVdO1xuXG4gICAgICAgIC8vIHNoaWZ0IHJvd3MgYW5kIGFkZCByY29uXG4gICAgICAgIGlmIChpJWtleUxlbiA9PT0gMCkge1xuICAgICAgICAgIHRtcCA9IHRtcDw8OCBeIHRtcD4+PjI0IF4gcmNvbjw8MjQ7XG4gICAgICAgICAgcmNvbiA9IHJjb248PDEgXiAocmNvbj4+NykqMjgzO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGVuY0tleVtpXSA9IGVuY0tleVtpLWtleUxlbl0gXiB0bXA7XG4gICAgfVxuXG4gICAgLy8gc2NoZWR1bGUgZGVjcnlwdGlvbiBrZXlzXG4gICAgZm9yIChqID0gMDsgaTsgaisrLCBpLS0pIHtcbiAgICAgIHRtcCA9IGVuY0tleVtqJjMgPyBpIDogaSAtIDRdO1xuICAgICAgaWYgKGk8PTQgfHwgajw0KSB7XG4gICAgICAgIGRlY0tleVtqXSA9IHRtcDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRlY0tleVtqXSA9IGRlY1RhYmxlWzBdW3Nib3hbdG1wPj4+MjQgICAgICBdXSBeXG4gICAgICAgICAgZGVjVGFibGVbMV1bc2JveFt0bXA+PjE2ICAmIDI1NV1dIF5cbiAgICAgICAgICBkZWNUYWJsZVsyXVtzYm94W3RtcD4+OCAgICYgMjU1XV0gXlxuICAgICAgICAgIGRlY1RhYmxlWzNdW3Nib3hbdG1wICAgICAgJiAyNTVdXTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRXhwYW5kIHRoZSBTLWJveCB0YWJsZXMuXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfcHJlY29tcHV0ZSgpIHtcbiAgICB2YXIgZW5jVGFibGUgPSB0aGlzLl90YWJsZXNbMF0sIGRlY1RhYmxlID0gdGhpcy5fdGFibGVzWzFdLFxuICAgIHNib3ggPSBlbmNUYWJsZVs0XSwgc2JveEludiA9IGRlY1RhYmxlWzRdLFxuICAgIGksIHgsIHhJbnYsIGQ9W10sIHRoPVtdLCB4MiwgeDQsIHg4LCBzLCB0RW5jLCB0RGVjO1xuXG4gICAgLy8gQ29tcHV0ZSBkb3VibGUgYW5kIHRoaXJkIHRhYmxlc1xuICAgIGZvciAoaSA9IDA7IGkgPCAyNTY7IGkrKykge1xuICAgICAgdGhbKCBkW2ldID0gaTw8MSBeIChpPj43KSoyODMgKV5pXT1pO1xuICAgIH1cblxuICAgIGZvciAoeCA9IHhJbnYgPSAwOyAhc2JveFt4XTsgeCBePSB4MiB8fCAxLCB4SW52ID0gdGhbeEludl0gfHwgMSkge1xuICAgICAgLy8gQ29tcHV0ZSBzYm94XG4gICAgICBzID0geEludiBeIHhJbnY8PDEgXiB4SW52PDwyIF4geEludjw8MyBeIHhJbnY8PDQ7XG4gICAgICBzID0gcz4+OCBeIHMmMjU1IF4gOTk7XG4gICAgICBzYm94W3hdID0gcztcbiAgICAgIHNib3hJbnZbc10gPSB4O1xuXG4gICAgICAvLyBDb21wdXRlIE1peENvbHVtbnNcbiAgICAgIHg4ID0gZFt4NCA9IGRbeDIgPSBkW3hdXV07XG4gICAgICB0RGVjID0geDgqMHgxMDEwMTAxIF4geDQqMHgxMDAwMSBeIHgyKjB4MTAxIF4geCoweDEwMTAxMDA7XG4gICAgICB0RW5jID0gZFtzXSoweDEwMSBeIHMqMHgxMDEwMTAwO1xuXG4gICAgICBmb3IgKGkgPSAwOyBpIDwgNDsgaSsrKSB7XG4gICAgICAgIGVuY1RhYmxlW2ldW3hdID0gdEVuYyA9IHRFbmM8PDI0IF4gdEVuYz4+Pjg7XG4gICAgICAgIGRlY1RhYmxlW2ldW3NdID0gdERlYyA9IHREZWM8PDI0IF4gdERlYz4+Pjg7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ29tcGFjdGlmeS4gQ29uc2lkZXJhYmxlIHNwZWVkdXAgb24gRmlyZWZveC5cbiAgICBmb3IgKGkgPSAwOyBpIDwgNTsgaSsrKSB7XG4gICAgICBlbmNUYWJsZVtpXSA9IGVuY1RhYmxlW2ldLnNsaWNlKDApO1xuICAgICAgZGVjVGFibGVbaV0gPSBkZWNUYWJsZVtpXS5zbGljZSgwKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRGVjcnlwdCAxNiBieXRlcywgc3BlY2lmaWVkIGFzIGZvdXIgMzItYml0IHdvcmRzLlxuICAgKiBAcGFyYW0gZW5jcnlwdGVkMCB7bnVtYmVyfSB0aGUgZmlyc3Qgd29yZCB0byBkZWNyeXB0XG4gICAqIEBwYXJhbSBlbmNyeXB0ZWQxIHtudW1iZXJ9IHRoZSBzZWNvbmQgd29yZCB0byBkZWNyeXB0XG4gICAqIEBwYXJhbSBlbmNyeXB0ZWQyIHtudW1iZXJ9IHRoZSB0aGlyZCB3b3JkIHRvIGRlY3J5cHRcbiAgICogQHBhcmFtIGVuY3J5cHRlZDMge251bWJlcn0gdGhlIGZvdXJ0aCB3b3JkIHRvIGRlY3J5cHRcbiAgICogQHBhcmFtIG91dCB7SW50MzJBcnJheX0gdGhlIGFycmF5IHRvIHdyaXRlIHRoZSBkZWNyeXB0ZWQgd29yZHNcbiAgICogaW50b1xuICAgKiBAcGFyYW0gb2Zmc2V0IHtudW1iZXJ9IHRoZSBvZmZzZXQgaW50byB0aGUgb3V0cHV0IGFycmF5IHRvIHN0YXJ0XG4gICAqIHdyaXRpbmcgcmVzdWx0c1xuICAgKiBAcmV0dXJuIHtBcnJheX0gVGhlIHBsYWludGV4dC5cbiAgICovXG4gIGRlY3J5cHQoZW5jcnlwdGVkMCwgZW5jcnlwdGVkMSwgZW5jcnlwdGVkMiwgZW5jcnlwdGVkMywgb3V0LCBvZmZzZXQpIHtcbiAgICB2YXIga2V5ID0gdGhpcy5fa2V5WzFdLFxuICAgIC8vIHN0YXRlIHZhcmlhYmxlcyBhLGIsYyxkIGFyZSBsb2FkZWQgd2l0aCBwcmUtd2hpdGVuZWQgZGF0YVxuICAgIGEgPSBlbmNyeXB0ZWQwIF4ga2V5WzBdLFxuICAgIGIgPSBlbmNyeXB0ZWQzIF4ga2V5WzFdLFxuICAgIGMgPSBlbmNyeXB0ZWQyIF4ga2V5WzJdLFxuICAgIGQgPSBlbmNyeXB0ZWQxIF4ga2V5WzNdLFxuICAgIGEyLCBiMiwgYzIsXG5cbiAgICBuSW5uZXJSb3VuZHMgPSBrZXkubGVuZ3RoIC8gNCAtIDIsIC8vIGtleS5sZW5ndGggPT09IDIgP1xuICAgIGksXG4gICAga0luZGV4ID0gNCxcbiAgICB0YWJsZSA9IHRoaXMuX3RhYmxlc1sxXSxcblxuICAgIC8vIGxvYWQgdXAgdGhlIHRhYmxlc1xuICAgIHRhYmxlMCAgICA9IHRhYmxlWzBdLFxuICAgIHRhYmxlMSAgICA9IHRhYmxlWzFdLFxuICAgIHRhYmxlMiAgICA9IHRhYmxlWzJdLFxuICAgIHRhYmxlMyAgICA9IHRhYmxlWzNdLFxuICAgIHNib3ggID0gdGFibGVbNF07XG5cbiAgICAvLyBJbm5lciByb3VuZHMuIENyaWJiZWQgZnJvbSBPcGVuU1NMLlxuICAgIGZvciAoaSA9IDA7IGkgPCBuSW5uZXJSb3VuZHM7IGkrKykge1xuICAgICAgYTIgPSB0YWJsZTBbYT4+PjI0XSBeIHRhYmxlMVtiPj4xNiAmIDI1NV0gXiB0YWJsZTJbYz4+OCAmIDI1NV0gXiB0YWJsZTNbZCAmIDI1NV0gXiBrZXlba0luZGV4XTtcbiAgICAgIGIyID0gdGFibGUwW2I+Pj4yNF0gXiB0YWJsZTFbYz4+MTYgJiAyNTVdIF4gdGFibGUyW2Q+PjggJiAyNTVdIF4gdGFibGUzW2EgJiAyNTVdIF4ga2V5W2tJbmRleCArIDFdO1xuICAgICAgYzIgPSB0YWJsZTBbYz4+PjI0XSBeIHRhYmxlMVtkPj4xNiAmIDI1NV0gXiB0YWJsZTJbYT4+OCAmIDI1NV0gXiB0YWJsZTNbYiAmIDI1NV0gXiBrZXlba0luZGV4ICsgMl07XG4gICAgICBkICA9IHRhYmxlMFtkPj4+MjRdIF4gdGFibGUxW2E+PjE2ICYgMjU1XSBeIHRhYmxlMltiPj44ICYgMjU1XSBeIHRhYmxlM1tjICYgMjU1XSBeIGtleVtrSW5kZXggKyAzXTtcbiAgICAgIGtJbmRleCArPSA0O1xuICAgICAgYT1hMjsgYj1iMjsgYz1jMjtcbiAgICB9XG5cbiAgICAvLyBMYXN0IHJvdW5kLlxuICAgIGZvciAoaSA9IDA7IGkgPCA0OyBpKyspIHtcbiAgICAgIG91dFsoMyAmIC1pKSArIG9mZnNldF0gPVxuICAgICAgICBzYm94W2E+Pj4yNCAgICAgIF08PDI0IF5cbiAgICAgICAgc2JveFtiPj4xNiAgJiAyNTVdPDwxNiBeXG4gICAgICAgIHNib3hbYz4+OCAgICYgMjU1XTw8OCAgXlxuICAgICAgICBzYm94W2QgICAgICAmIDI1NV0gICAgIF5cbiAgICAgICAga2V5W2tJbmRleCsrXTtcbiAgICAgIGEyPWE7IGE9YjsgYj1jOyBjPWQ7IGQ9YTI7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEFFUztcbiIsIi8qXG4gKlxuICogVGhpcyBmaWxlIGNvbnRhaW5zIGFuIGFkYXB0YXRpb24gb2YgdGhlIEFFUyBkZWNyeXB0aW9uIGFsZ29yaXRobVxuICogZnJvbSB0aGUgU3RhbmRmb3JkIEphdmFzY3JpcHQgQ3J5cHRvZ3JhcGh5IExpYnJhcnkuIFRoYXQgd29yayBpc1xuICogY292ZXJlZCBieSB0aGUgZm9sbG93aW5nIGNvcHlyaWdodCBhbmQgcGVybWlzc2lvbnMgbm90aWNlOlxuICpcbiAqIENvcHlyaWdodCAyMDA5LTIwMTAgRW1pbHkgU3RhcmssIE1pa2UgSGFtYnVyZywgRGFuIEJvbmVoLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBSZWRpc3RyaWJ1dGlvbiBhbmQgdXNlIGluIHNvdXJjZSBhbmQgYmluYXJ5IGZvcm1zLCB3aXRoIG9yIHdpdGhvdXRcbiAqIG1vZGlmaWNhdGlvbiwgYXJlIHBlcm1pdHRlZCBwcm92aWRlZCB0aGF0IHRoZSBmb2xsb3dpbmcgY29uZGl0aW9ucyBhcmVcbiAqIG1ldDpcbiAqXG4gKiAxLiBSZWRpc3RyaWJ1dGlvbnMgb2Ygc291cmNlIGNvZGUgbXVzdCByZXRhaW4gdGhlIGFib3ZlIGNvcHlyaWdodFxuICogICAgbm90aWNlLCB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZyBkaXNjbGFpbWVyLlxuICpcbiAqIDIuIFJlZGlzdHJpYnV0aW9ucyBpbiBiaW5hcnkgZm9ybSBtdXN0IHJlcHJvZHVjZSB0aGUgYWJvdmVcbiAqICAgIGNvcHlyaWdodCBub3RpY2UsIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nXG4gKiAgICBkaXNjbGFpbWVyIGluIHRoZSBkb2N1bWVudGF0aW9uIGFuZC9vciBvdGhlciBtYXRlcmlhbHMgcHJvdmlkZWRcbiAqICAgIHdpdGggdGhlIGRpc3RyaWJ1dGlvbi5cbiAqXG4gKiBUSElTIFNPRlRXQVJFIElTIFBST1ZJREVEIEJZIFRIRSBBVVRIT1JTIGBgQVMgSVMnJyBBTkQgQU5ZIEVYUFJFU1MgT1JcbiAqIElNUExJRUQgV0FSUkFOVElFUywgSU5DTFVESU5HLCBCVVQgTk9UIExJTUlURUQgVE8sIFRIRSBJTVBMSUVEXG4gKiBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSBBTkQgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQVJFXG4gKiBESVNDTEFJTUVELiBJTiBOTyBFVkVOVCBTSEFMTCA8Q09QWVJJR0hUIEhPTERFUj4gT1IgQ09OVFJJQlVUT1JTIEJFXG4gKiBMSUFCTEUgRk9SIEFOWSBESVJFQ1QsIElORElSRUNULCBJTkNJREVOVEFMLCBTUEVDSUFMLCBFWEVNUExBUlksIE9SXG4gKiBDT05TRVFVRU5USUFMIERBTUFHRVMgKElOQ0xVRElORywgQlVUIE5PVCBMSU1JVEVEIFRPLCBQUk9DVVJFTUVOVCBPRlxuICogU1VCU1RJVFVURSBHT09EUyBPUiBTRVJWSUNFUzsgTE9TUyBPRiBVU0UsIERBVEEsIE9SIFBST0ZJVFM7IE9SXG4gKiBCVVNJTkVTUyBJTlRFUlJVUFRJT04pIEhPV0VWRVIgQ0FVU0VEIEFORCBPTiBBTlkgVEhFT1JZIE9GIExJQUJJTElUWSxcbiAqIFdIRVRIRVIgSU4gQ09OVFJBQ1QsIFNUUklDVCBMSUFCSUxJVFksIE9SIFRPUlQgKElOQ0xVRElORyBORUdMSUdFTkNFXG4gKiBPUiBPVEhFUldJU0UpIEFSSVNJTkcgSU4gQU5ZIFdBWSBPVVQgT0YgVEhFIFVTRSBPRiBUSElTIFNPRlRXQVJFLCBFVkVOXG4gKiBJRiBBRFZJU0VEIE9GIFRIRSBQT1NTSUJJTElUWSBPRiBTVUNIIERBTUFHRS5cbiAqXG4gKiBUaGUgdmlld3MgYW5kIGNvbmNsdXNpb25zIGNvbnRhaW5lZCBpbiB0aGUgc29mdHdhcmUgYW5kIGRvY3VtZW50YXRpb25cbiAqIGFyZSB0aG9zZSBvZiB0aGUgYXV0aG9ycyBhbmQgc2hvdWxkIG5vdCBiZSBpbnRlcnByZXRlZCBhcyByZXByZXNlbnRpbmdcbiAqIG9mZmljaWFsIHBvbGljaWVzLCBlaXRoZXIgZXhwcmVzc2VkIG9yIGltcGxpZWQsIG9mIHRoZSBhdXRob3JzLlxuICovXG5cbmltcG9ydCBBRVMgZnJvbSAnLi9hZXMnO1xuXG5jbGFzcyBBRVMxMjhEZWNyeXB0ZXIge1xuXG4gIGNvbnN0cnVjdG9yKGtleSwgaW5pdFZlY3Rvcikge1xuICAgIHRoaXMua2V5ID0ga2V5O1xuICAgIHRoaXMuaXYgPSBpbml0VmVjdG9yO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnZlcnQgbmV0d29yay1vcmRlciAoYmlnLWVuZGlhbikgYnl0ZXMgaW50byB0aGVpciBsaXR0bGUtZW5kaWFuXG4gICAqIHJlcHJlc2VudGF0aW9uLlxuICAgKi9cbiAgbnRvaCh3b3JkKSB7XG4gICAgcmV0dXJuICh3b3JkIDw8IDI0KSB8XG4gICAgICAoKHdvcmQgJiAweGZmMDApIDw8IDgpIHxcbiAgICAgICgod29yZCAmIDB4ZmYwMDAwKSA+PiA4KSB8XG4gICAgICAod29yZCA+Pj4gMjQpO1xuICB9XG5cblxuICAvKipcbiAgICogRGVjcnlwdCBieXRlcyB1c2luZyBBRVMtMTI4IHdpdGggQ0JDIGFuZCBQS0NTIzcgcGFkZGluZy5cbiAgICogQHBhcmFtIGVuY3J5cHRlZCB7VWludDhBcnJheX0gdGhlIGVuY3J5cHRlZCBieXRlc1xuICAgKiBAcGFyYW0ga2V5IHtVaW50MzJBcnJheX0gdGhlIGJ5dGVzIG9mIHRoZSBkZWNyeXB0aW9uIGtleVxuICAgKiBAcGFyYW0gaW5pdFZlY3RvciB7VWludDMyQXJyYXl9IHRoZSBpbml0aWFsaXphdGlvbiB2ZWN0b3IgKElWKSB0b1xuICAgKiB1c2UgZm9yIHRoZSBmaXJzdCByb3VuZCBvZiBDQkMuXG4gICAqIEByZXR1cm4ge1VpbnQ4QXJyYXl9IHRoZSBkZWNyeXB0ZWQgYnl0ZXNcbiAgICpcbiAgICogQHNlZSBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0FkdmFuY2VkX0VuY3J5cHRpb25fU3RhbmRhcmRcbiAgICogQHNlZSBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0Jsb2NrX2NpcGhlcl9tb2RlX29mX29wZXJhdGlvbiNDaXBoZXJfQmxvY2tfQ2hhaW5pbmdfLjI4Q0JDLjI5XG4gICAqIEBzZWUgaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzIzMTVcbiAgICovXG4gIGRvRGVjcnlwdChlbmNyeXB0ZWQsIGtleSwgaW5pdFZlY3Rvcikge1xuICAgIHZhclxuICAgICAgLy8gd29yZC1sZXZlbCBhY2Nlc3MgdG8gdGhlIGVuY3J5cHRlZCBieXRlc1xuICAgICAgZW5jcnlwdGVkMzIgPSBuZXcgSW50MzJBcnJheShlbmNyeXB0ZWQuYnVmZmVyLCBlbmNyeXB0ZWQuYnl0ZU9mZnNldCwgZW5jcnlwdGVkLmJ5dGVMZW5ndGggPj4gMiksXG5cbiAgICBkZWNpcGhlciA9IG5ldyBBRVMoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoa2V5KSksXG5cbiAgICAvLyBieXRlIGFuZCB3b3JkLWxldmVsIGFjY2VzcyBmb3IgdGhlIGRlY3J5cHRlZCBvdXRwdXRcbiAgICBkZWNyeXB0ZWQgPSBuZXcgVWludDhBcnJheShlbmNyeXB0ZWQuYnl0ZUxlbmd0aCksXG4gICAgZGVjcnlwdGVkMzIgPSBuZXcgSW50MzJBcnJheShkZWNyeXB0ZWQuYnVmZmVyKSxcblxuICAgIC8vIHRlbXBvcmFyeSB2YXJpYWJsZXMgZm9yIHdvcmtpbmcgd2l0aCB0aGUgSVYsIGVuY3J5cHRlZCwgYW5kXG4gICAgLy8gZGVjcnlwdGVkIGRhdGFcbiAgICBpbml0MCwgaW5pdDEsIGluaXQyLCBpbml0MyxcbiAgICBlbmNyeXB0ZWQwLCBlbmNyeXB0ZWQxLCBlbmNyeXB0ZWQyLCBlbmNyeXB0ZWQzLFxuXG4gICAgLy8gaXRlcmF0aW9uIHZhcmlhYmxlXG4gICAgd29yZEl4O1xuXG4gICAgLy8gcHVsbCBvdXQgdGhlIHdvcmRzIG9mIHRoZSBJViB0byBlbnN1cmUgd2UgZG9uJ3QgbW9kaWZ5IHRoZVxuICAgIC8vIHBhc3NlZC1pbiByZWZlcmVuY2UgYW5kIGVhc2llciBhY2Nlc3NcbiAgICBpbml0MCA9IH5+aW5pdFZlY3RvclswXTtcbiAgICBpbml0MSA9IH5+aW5pdFZlY3RvclsxXTtcbiAgICBpbml0MiA9IH5+aW5pdFZlY3RvclsyXTtcbiAgICBpbml0MyA9IH5+aW5pdFZlY3RvclszXTtcblxuICAgIC8vIGRlY3J5cHQgZm91ciB3b3JkIHNlcXVlbmNlcywgYXBwbHlpbmcgY2lwaGVyLWJsb2NrIGNoYWluaW5nIChDQkMpXG4gICAgLy8gdG8gZWFjaCBkZWNyeXB0ZWQgYmxvY2tcbiAgICBmb3IgKHdvcmRJeCA9IDA7IHdvcmRJeCA8IGVuY3J5cHRlZDMyLmxlbmd0aDsgd29yZEl4ICs9IDQpIHtcbiAgICAgIC8vIGNvbnZlcnQgYmlnLWVuZGlhbiAobmV0d29yayBvcmRlcikgd29yZHMgaW50byBsaXR0bGUtZW5kaWFuXG4gICAgICAvLyAoamF2YXNjcmlwdCBvcmRlcilcbiAgICAgIGVuY3J5cHRlZDAgPSB+fnRoaXMubnRvaChlbmNyeXB0ZWQzMlt3b3JkSXhdKTtcbiAgICAgIGVuY3J5cHRlZDEgPSB+fnRoaXMubnRvaChlbmNyeXB0ZWQzMlt3b3JkSXggKyAxXSk7XG4gICAgICBlbmNyeXB0ZWQyID0gfn50aGlzLm50b2goZW5jcnlwdGVkMzJbd29yZEl4ICsgMl0pO1xuICAgICAgZW5jcnlwdGVkMyA9IH5+dGhpcy5udG9oKGVuY3J5cHRlZDMyW3dvcmRJeCArIDNdKTtcblxuICAgICAgLy8gZGVjcnlwdCB0aGUgYmxvY2tcbiAgICAgIGRlY2lwaGVyLmRlY3J5cHQoZW5jcnlwdGVkMCxcbiAgICAgICAgICBlbmNyeXB0ZWQxLFxuICAgICAgICAgIGVuY3J5cHRlZDIsXG4gICAgICAgICAgZW5jcnlwdGVkMyxcbiAgICAgICAgICBkZWNyeXB0ZWQzMixcbiAgICAgICAgICB3b3JkSXgpO1xuXG4gICAgICAvLyBYT1Igd2l0aCB0aGUgSVYsIGFuZCByZXN0b3JlIG5ldHdvcmsgYnl0ZS1vcmRlciB0byBvYnRhaW4gdGhlXG4gICAgICAvLyBwbGFpbnRleHRcbiAgICAgIGRlY3J5cHRlZDMyW3dvcmRJeF0gICAgID0gdGhpcy5udG9oKGRlY3J5cHRlZDMyW3dvcmRJeF0gXiBpbml0MCk7XG4gICAgICBkZWNyeXB0ZWQzMlt3b3JkSXggKyAxXSA9IHRoaXMubnRvaChkZWNyeXB0ZWQzMlt3b3JkSXggKyAxXSBeIGluaXQxKTtcbiAgICAgIGRlY3J5cHRlZDMyW3dvcmRJeCArIDJdID0gdGhpcy5udG9oKGRlY3J5cHRlZDMyW3dvcmRJeCArIDJdIF4gaW5pdDIpO1xuICAgICAgZGVjcnlwdGVkMzJbd29yZEl4ICsgM10gPSB0aGlzLm50b2goZGVjcnlwdGVkMzJbd29yZEl4ICsgM10gXiBpbml0Myk7XG5cbiAgICAgIC8vIHNldHVwIHRoZSBJViBmb3IgdGhlIG5leHQgcm91bmRcbiAgICAgIGluaXQwID0gZW5jcnlwdGVkMDtcbiAgICAgIGluaXQxID0gZW5jcnlwdGVkMTtcbiAgICAgIGluaXQyID0gZW5jcnlwdGVkMjtcbiAgICAgIGluaXQzID0gZW5jcnlwdGVkMztcbiAgICB9XG5cbiAgICByZXR1cm4gZGVjcnlwdGVkO1xuICB9XG5cbiAgbG9jYWxEZWNyeXB0KGVuY3J5cHRlZCwga2V5LCBpbml0VmVjdG9yLCBkZWNyeXB0ZWQpIHtcbiAgICB2YXIgYnl0ZXMgPSB0aGlzLmRvRGVjcnlwdChlbmNyeXB0ZWQsXG4gICAgICAgIGtleSxcbiAgICAgICAgaW5pdFZlY3Rvcik7XG4gICAgZGVjcnlwdGVkLnNldChieXRlcywgZW5jcnlwdGVkLmJ5dGVPZmZzZXQpO1xuICB9XG5cbiAgZGVjcnlwdChlbmNyeXB0ZWQpIHtcbiAgICB2YXJcbiAgICAgIHN0ZXAgPSA0ICogODAwMCxcbiAgICAvL2VuY3J5cHRlZDMyID0gbmV3IEludDMyQXJyYXkoZW5jcnlwdGVkLmJ1ZmZlciksXG4gICAgZW5jcnlwdGVkMzIgPSBuZXcgSW50MzJBcnJheShlbmNyeXB0ZWQpLFxuICAgIGRlY3J5cHRlZCA9IG5ldyBVaW50OEFycmF5KGVuY3J5cHRlZC5ieXRlTGVuZ3RoKSxcbiAgICBpID0gMDtcblxuICAgIC8vIHNwbGl0IHVwIHRoZSBlbmNyeXB0aW9uIGpvYiBhbmQgZG8gdGhlIGluZGl2aWR1YWwgY2h1bmtzIGFzeW5jaHJvbm91c2x5XG4gICAgdmFyIGtleSA9IHRoaXMua2V5O1xuICAgIHZhciBpbml0VmVjdG9yID0gdGhpcy5pdjtcbiAgICB0aGlzLmxvY2FsRGVjcnlwdChlbmNyeXB0ZWQzMi5zdWJhcnJheShpLCBpICsgc3RlcCksIGtleSwgaW5pdFZlY3RvciwgZGVjcnlwdGVkKTtcblxuICAgIGZvciAoaSA9IHN0ZXA7IGkgPCBlbmNyeXB0ZWQzMi5sZW5ndGg7IGkgKz0gc3RlcCkge1xuICAgICAgaW5pdFZlY3RvciA9IG5ldyBVaW50MzJBcnJheShbXG4gICAgICAgICAgdGhpcy5udG9oKGVuY3J5cHRlZDMyW2kgLSA0XSksXG4gICAgICAgICAgdGhpcy5udG9oKGVuY3J5cHRlZDMyW2kgLSAzXSksXG4gICAgICAgICAgdGhpcy5udG9oKGVuY3J5cHRlZDMyW2kgLSAyXSksXG4gICAgICAgICAgdGhpcy5udG9oKGVuY3J5cHRlZDMyW2kgLSAxXSlcbiAgICAgIF0pO1xuICAgICAgdGhpcy5sb2NhbERlY3J5cHQoZW5jcnlwdGVkMzIuc3ViYXJyYXkoaSwgaSArIHN0ZXApLCBrZXksIGluaXRWZWN0b3IsIGRlY3J5cHRlZCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRlY3J5cHRlZDtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBBRVMxMjhEZWNyeXB0ZXI7XG4iLCIvKlxuICogQUVTMTI4IGRlY3J5cHRpb24uXG4gKi9cblxuaW1wb3J0IEFFUzEyOERlY3J5cHRlciBmcm9tICcuL2FlczEyOC1kZWNyeXB0ZXInO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuY2xhc3MgRGVjcnlwdGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMpIHtcbiAgICB0aGlzLmhscyA9IGhscztcbiAgICB0cnkge1xuICAgICAgY29uc3QgYnJvd3NlckNyeXB0byA9IHdpbmRvdyA/IHdpbmRvdy5jcnlwdG8gOiBjcnlwdG87XG4gICAgICB0aGlzLnN1YnRsZSA9IGJyb3dzZXJDcnlwdG8uc3VidGxlIHx8IGJyb3dzZXJDcnlwdG8ud2Via2l0U3VidGxlO1xuICAgICAgdGhpcy5kaXNhYmxlV2ViQ3J5cHRvID0gIXRoaXMuc3VidGxlO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHRoaXMuZGlzYWJsZVdlYkNyeXB0byA9IHRydWU7XG4gICAgfVxuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgfVxuXG4gIGRlY3J5cHQoZGF0YSwga2V5LCBpdiwgY2FsbGJhY2spIHtcbiAgICBpZiAodGhpcy5kaXNhYmxlV2ViQ3J5cHRvICYmIHRoaXMuaGxzLmNvbmZpZy5lbmFibGVTb2Z0d2FyZUFFUykge1xuICAgICAgdGhpcy5kZWNyeXB0QnlTb2Z0d2FyZShkYXRhLCBrZXksIGl2LCBjYWxsYmFjayk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZGVjcnlwdEJ5V2ViQ3J5cHRvKGRhdGEsIGtleSwgaXYsIGNhbGxiYWNrKTtcbiAgICB9XG4gIH1cblxuICBkZWNyeXB0QnlXZWJDcnlwdG8oZGF0YSwga2V5LCBpdiwgY2FsbGJhY2spIHtcbiAgICBsb2dnZXIubG9nKCdkZWNyeXB0aW5nIGJ5IFdlYkNyeXB0byBBUEknKTtcblxuICAgIHRoaXMuc3VidGxlLmltcG9ydEtleSgncmF3Jywga2V5LCB7IG5hbWUgOiAnQUVTLUNCQycsIGxlbmd0aCA6IDEyOCB9LCBmYWxzZSwgWydkZWNyeXB0J10pLlxuICAgICAgdGhlbigoaW1wb3J0ZWRLZXkpID0+IHtcbiAgICAgICAgdGhpcy5zdWJ0bGUuZGVjcnlwdCh7IG5hbWUgOiAnQUVTLUNCQycsIGl2IDogaXYuYnVmZmVyIH0sIGltcG9ydGVkS2V5LCBkYXRhKS5cbiAgICAgICAgICB0aGVuKGNhbGxiYWNrKS5cbiAgICAgICAgICBjYXRjaCAoKGVycikgPT4ge1xuICAgICAgICAgICAgdGhpcy5vbldlYkNyeXB0b0Vycm9yKGVyciwgZGF0YSwga2V5LCBpdiwgY2FsbGJhY2spO1xuICAgICAgICAgIH0pO1xuICAgICAgfSkuXG4gICAgY2F0Y2ggKChlcnIpID0+IHtcbiAgICAgIHRoaXMub25XZWJDcnlwdG9FcnJvcihlcnIsIGRhdGEsIGtleSwgaXYsIGNhbGxiYWNrKTtcbiAgICB9KTtcbiAgfVxuXG4gIGRlY3J5cHRCeVNvZnR3YXJlKGRhdGEsIGtleTgsIGl2OCwgY2FsbGJhY2spIHtcbiAgICBsb2dnZXIubG9nKCdkZWNyeXB0aW5nIGJ5IEphdmFTY3JpcHQgSW1wbGVtZW50YXRpb24nKTtcblxuICAgIHZhciB2aWV3ID0gbmV3IERhdGFWaWV3KGtleTguYnVmZmVyKTtcbiAgICB2YXIga2V5ID0gbmV3IFVpbnQzMkFycmF5KFtcbiAgICAgICAgdmlldy5nZXRVaW50MzIoMCksXG4gICAgICAgIHZpZXcuZ2V0VWludDMyKDQpLFxuICAgICAgICB2aWV3LmdldFVpbnQzMig4KSxcbiAgICAgICAgdmlldy5nZXRVaW50MzIoMTIpXG4gICAgXSk7XG5cbiAgICB2aWV3ID0gbmV3IERhdGFWaWV3KGl2OC5idWZmZXIpO1xuICAgIHZhciBpdiA9IG5ldyBVaW50MzJBcnJheShbXG4gICAgICAgIHZpZXcuZ2V0VWludDMyKDApLFxuICAgICAgICB2aWV3LmdldFVpbnQzMig0KSxcbiAgICAgICAgdmlldy5nZXRVaW50MzIoOCksXG4gICAgICAgIHZpZXcuZ2V0VWludDMyKDEyKVxuICAgIF0pO1xuXG4gICAgdmFyIGRlY3J5cHRlciA9IG5ldyBBRVMxMjhEZWNyeXB0ZXIoa2V5LCBpdik7XG4gICAgY2FsbGJhY2soZGVjcnlwdGVyLmRlY3J5cHQoZGF0YSkuYnVmZmVyKTtcbiAgfVxuXG4gIG9uV2ViQ3J5cHRvRXJyb3IoZXJyLCBkYXRhLCBrZXksIGl2LCBjYWxsYmFjaykge1xuICAgIGlmICh0aGlzLmhscy5jb25maWcuZW5hYmxlU29mdHdhcmVBRVMpIHtcbiAgICAgIGxvZ2dlci5sb2coJ2Rpc2FibGluZyB0byB1c2UgV2ViQ3J5cHRvIEFQSScpO1xuICAgICAgdGhpcy5kaXNhYmxlV2ViQ3J5cHRvID0gdHJ1ZTtcbiAgICAgIHRoaXMuZGVjcnlwdEJ5U29mdHdhcmUoZGF0YSwga2V5LCBpdiwgY2FsbGJhY2spO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGxvZ2dlci5lcnJvcihgZGVjcnlwdGluZyBlcnJvciA6ICR7ZXJyLm1lc3NhZ2V9YCk7XG4gICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZSA6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHMgOiBFcnJvckRldGFpbHMuRlJBR19ERUNSWVBUX0VSUk9SLCBmYXRhbCA6IHRydWUsIHJlYXNvbiA6IGVyci5tZXNzYWdlfSk7XG4gICAgfVxuICB9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgRGVjcnlwdGVyO1xuIiwiLyoqXG4gKiBBQUMgZGVtdXhlclxuICovXG5pbXBvcnQgQURUUyBmcm9tICcuL2FkdHMnO1xuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQgSUQzIGZyb20gJy4uL2RlbXV4L2lkMyc7XG5cbiBjbGFzcyBBQUNEZW11eGVyIHtcblxuICBjb25zdHJ1Y3RvcihvYnNlcnZlcixyZW11eGVyQ2xhc3MpIHtcbiAgICB0aGlzLm9ic2VydmVyID0gb2JzZXJ2ZXI7XG4gICAgdGhpcy5yZW11eGVyQ2xhc3MgPSByZW11eGVyQ2xhc3M7XG4gICAgdGhpcy5yZW11eGVyID0gbmV3IHRoaXMucmVtdXhlckNsYXNzKG9ic2VydmVyKTtcbiAgICB0aGlzLl9hYWNUcmFjayA9IHt0eXBlOiAnYXVkaW8nLCBpZCA6LTEsIHNlcXVlbmNlTnVtYmVyOiAwLCBzYW1wbGVzIDogW10sIGxlbiA6IDB9O1xuICB9XG5cbiAgc3RhdGljIHByb2JlKGRhdGEpIHtcbiAgICAvLyBjaGVjayBpZiBkYXRhIGNvbnRhaW5zIElEMyB0aW1lc3RhbXAgYW5kIEFEVFMgc3luYyB3b3JjXG4gICAgdmFyIGlkMyA9IG5ldyBJRDMoZGF0YSksIGFkdHNTdGFydE9mZnNldCxsZW47XG4gICAgaWYoaWQzLmhhc1RpbWVTdGFtcCkge1xuICAgICAgLy8gbG9vayBmb3IgQURUUyBoZWFkZXIgKDB4RkZGeClcbiAgICAgIGZvciAoYWR0c1N0YXJ0T2Zmc2V0ID0gaWQzLmxlbmd0aCwgbGVuID0gZGF0YS5sZW5ndGg7IGFkdHNTdGFydE9mZnNldCA8IGxlbiAtIDE7IGFkdHNTdGFydE9mZnNldCsrKSB7XG4gICAgICAgIGlmICgoZGF0YVthZHRzU3RhcnRPZmZzZXRdID09PSAweGZmKSAmJiAoZGF0YVthZHRzU3RhcnRPZmZzZXQrMV0gJiAweGYwKSA9PT0gMHhmMCkge1xuICAgICAgICAgIC8vbG9nZ2VyLmxvZygnQURUUyBzeW5jIHdvcmQgZm91bmQgIScpO1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG5cbiAgLy8gZmVlZCBpbmNvbWluZyBkYXRhIHRvIHRoZSBmcm9udCBvZiB0aGUgcGFyc2luZyBwaXBlbGluZVxuICBwdXNoKGRhdGEsIGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQsIGNjLCBsZXZlbCwgc24sIGR1cmF0aW9uKSB7XG4gICAgdmFyIHRyYWNrID0gdGhpcy5fYWFjVHJhY2ssXG4gICAgICAgIGlkMyA9IG5ldyBJRDMoZGF0YSksXG4gICAgICAgIHB0cyA9IDkwKmlkMy50aW1lU3RhbXAsXG4gICAgICAgIGNvbmZpZywgYWR0c0ZyYW1lU2l6ZSwgYWR0c1N0YXJ0T2Zmc2V0LCBhZHRzSGVhZGVyTGVuLCBzdGFtcCwgbmJTYW1wbGVzLCBsZW4sIGFhY1NhbXBsZTtcbiAgICAvLyBsb29rIGZvciBBRFRTIGhlYWRlciAoMHhGRkZ4KVxuICAgIGZvciAoYWR0c1N0YXJ0T2Zmc2V0ID0gaWQzLmxlbmd0aCwgbGVuID0gZGF0YS5sZW5ndGg7IGFkdHNTdGFydE9mZnNldCA8IGxlbiAtIDE7IGFkdHNTdGFydE9mZnNldCsrKSB7XG4gICAgICBpZiAoKGRhdGFbYWR0c1N0YXJ0T2Zmc2V0XSA9PT0gMHhmZikgJiYgKGRhdGFbYWR0c1N0YXJ0T2Zmc2V0KzFdICYgMHhmMCkgPT09IDB4ZjApIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCF0cmFjay5hdWRpb3NhbXBsZXJhdGUpIHtcbiAgICAgIGNvbmZpZyA9IEFEVFMuZ2V0QXVkaW9Db25maWcodGhpcy5vYnNlcnZlcixkYXRhLCBhZHRzU3RhcnRPZmZzZXQsIGF1ZGlvQ29kZWMpO1xuICAgICAgdHJhY2suY29uZmlnID0gY29uZmlnLmNvbmZpZztcbiAgICAgIHRyYWNrLmF1ZGlvc2FtcGxlcmF0ZSA9IGNvbmZpZy5zYW1wbGVyYXRlO1xuICAgICAgdHJhY2suY2hhbm5lbENvdW50ID0gY29uZmlnLmNoYW5uZWxDb3VudDtcbiAgICAgIHRyYWNrLmNvZGVjID0gY29uZmlnLmNvZGVjO1xuICAgICAgdHJhY2sudGltZXNjYWxlID0gdGhpcy5yZW11eGVyLnRpbWVzY2FsZTtcbiAgICAgIHRyYWNrLmR1cmF0aW9uID0gdGhpcy5yZW11eGVyLnRpbWVzY2FsZSAqIGR1cmF0aW9uO1xuICAgICAgbG9nZ2VyLmxvZyhgcGFyc2VkIGNvZGVjOiR7dHJhY2suY29kZWN9LHJhdGU6JHtjb25maWcuc2FtcGxlcmF0ZX0sbmIgY2hhbm5lbDoke2NvbmZpZy5jaGFubmVsQ291bnR9YCk7XG4gICAgfVxuICAgIG5iU2FtcGxlcyA9IDA7XG4gICAgd2hpbGUgKChhZHRzU3RhcnRPZmZzZXQgKyA1KSA8IGxlbikge1xuICAgICAgLy8gcmV0cmlldmUgZnJhbWUgc2l6ZVxuICAgICAgYWR0c0ZyYW1lU2l6ZSA9ICgoZGF0YVthZHRzU3RhcnRPZmZzZXQgKyAzXSAmIDB4MDMpIDw8IDExKTtcbiAgICAgIC8vIGJ5dGUgNFxuICAgICAgYWR0c0ZyYW1lU2l6ZSB8PSAoZGF0YVthZHRzU3RhcnRPZmZzZXQgKyA0XSA8PCAzKTtcbiAgICAgIC8vIGJ5dGUgNVxuICAgICAgYWR0c0ZyYW1lU2l6ZSB8PSAoKGRhdGFbYWR0c1N0YXJ0T2Zmc2V0ICsgNV0gJiAweEUwKSA+Pj4gNSk7XG4gICAgICBhZHRzSGVhZGVyTGVuID0gKCEhKGRhdGFbYWR0c1N0YXJ0T2Zmc2V0ICsgMV0gJiAweDAxKSA/IDcgOiA5KTtcbiAgICAgIGFkdHNGcmFtZVNpemUgLT0gYWR0c0hlYWRlckxlbjtcbiAgICAgIHN0YW1wID0gTWF0aC5yb3VuZChwdHMgKyBuYlNhbXBsZXMgKiAxMDI0ICogOTAwMDAgLyB0cmFjay5hdWRpb3NhbXBsZXJhdGUpO1xuICAgICAgLy9zdGFtcCA9IHBlcy5wdHM7XG4gICAgICAvL2NvbnNvbGUubG9nKCdBQUMgZnJhbWUsIG9mZnNldC9sZW5ndGgvcHRzOicgKyAoYWR0c1N0YXJ0T2Zmc2V0KzcpICsgJy8nICsgYWR0c0ZyYW1lU2l6ZSArICcvJyArIHN0YW1wLnRvRml4ZWQoMCkpO1xuICAgICAgaWYgKChhZHRzRnJhbWVTaXplID4gMCkgJiYgKChhZHRzU3RhcnRPZmZzZXQgKyBhZHRzSGVhZGVyTGVuICsgYWR0c0ZyYW1lU2l6ZSkgPD0gbGVuKSkge1xuICAgICAgICBhYWNTYW1wbGUgPSB7dW5pdDogZGF0YS5zdWJhcnJheShhZHRzU3RhcnRPZmZzZXQgKyBhZHRzSGVhZGVyTGVuLCBhZHRzU3RhcnRPZmZzZXQgKyBhZHRzSGVhZGVyTGVuICsgYWR0c0ZyYW1lU2l6ZSksIHB0czogc3RhbXAsIGR0czogc3RhbXB9O1xuICAgICAgICB0cmFjay5zYW1wbGVzLnB1c2goYWFjU2FtcGxlKTtcbiAgICAgICAgdHJhY2subGVuICs9IGFkdHNGcmFtZVNpemU7XG4gICAgICAgIGFkdHNTdGFydE9mZnNldCArPSBhZHRzRnJhbWVTaXplICsgYWR0c0hlYWRlckxlbjtcbiAgICAgICAgbmJTYW1wbGVzKys7XG4gICAgICAgIC8vIGxvb2sgZm9yIEFEVFMgaGVhZGVyICgweEZGRngpXG4gICAgICAgIGZvciAoIDsgYWR0c1N0YXJ0T2Zmc2V0IDwgKGxlbiAtIDEpOyBhZHRzU3RhcnRPZmZzZXQrKykge1xuICAgICAgICAgIGlmICgoZGF0YVthZHRzU3RhcnRPZmZzZXRdID09PSAweGZmKSAmJiAoKGRhdGFbYWR0c1N0YXJ0T2Zmc2V0ICsgMV0gJiAweGYwKSA9PT0gMHhmMCkpIHtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMucmVtdXhlci5yZW11eCh0aGlzLl9hYWNUcmFjayx7c2FtcGxlcyA6IFtdfSwge3NhbXBsZXMgOiBbIHsgcHRzOiBwdHMsIGR0cyA6IHB0cywgdW5pdCA6IGlkMy5wYXlsb2FkfSBdfSwgdGltZU9mZnNldCk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICB9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgQUFDRGVtdXhlcjtcbiIsIi8qKlxuICogIEFEVFMgcGFyc2VyIGhlbHBlclxuICovXG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuXG4gY2xhc3MgQURUUyB7XG5cbiAgc3RhdGljIGdldEF1ZGlvQ29uZmlnKG9ic2VydmVyLCBkYXRhLCBvZmZzZXQsIGF1ZGlvQ29kZWMpIHtcbiAgICB2YXIgYWR0c09iamVjdFR5cGUsIC8vIDppbnRcbiAgICAgICAgYWR0c1NhbXBsZWluZ0luZGV4LCAvLyA6aW50XG4gICAgICAgIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCwgLy8gOmludFxuICAgICAgICBhZHRzQ2hhbmVsQ29uZmlnLCAvLyA6aW50XG4gICAgICAgIGNvbmZpZyxcbiAgICAgICAgdXNlckFnZW50ID0gbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLFxuICAgICAgICBhZHRzU2FtcGxlaW5nUmF0ZXMgPSBbXG4gICAgICAgICAgICA5NjAwMCwgODgyMDAsXG4gICAgICAgICAgICA2NDAwMCwgNDgwMDAsXG4gICAgICAgICAgICA0NDEwMCwgMzIwMDAsXG4gICAgICAgICAgICAyNDAwMCwgMjIwNTAsXG4gICAgICAgICAgICAxNjAwMCwgMTIwMDAsXG4gICAgICAgICAgICAxMTAyNSwgODAwMCxcbiAgICAgICAgICAgIDczNTBdO1xuICAgIC8vIGJ5dGUgMlxuICAgIGFkdHNPYmplY3RUeXBlID0gKChkYXRhW29mZnNldCArIDJdICYgMHhDMCkgPj4+IDYpICsgMTtcbiAgICBhZHRzU2FtcGxlaW5nSW5kZXggPSAoKGRhdGFbb2Zmc2V0ICsgMl0gJiAweDNDKSA+Pj4gMik7XG4gICAgaWYoYWR0c1NhbXBsZWluZ0luZGV4ID4gYWR0c1NhbXBsZWluZ1JhdGVzLmxlbmd0aC0xKSB7XG4gICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkZSQUdfUEFSU0lOR19FUlJPUiwgZmF0YWw6IHRydWUsIHJlYXNvbjogYGludmFsaWQgQURUUyBzYW1wbGluZyBpbmRleDoke2FkdHNTYW1wbGVpbmdJbmRleH1gfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGFkdHNDaGFuZWxDb25maWcgPSAoKGRhdGFbb2Zmc2V0ICsgMl0gJiAweDAxKSA8PCAyKTtcbiAgICAvLyBieXRlIDNcbiAgICBhZHRzQ2hhbmVsQ29uZmlnIHw9ICgoZGF0YVtvZmZzZXQgKyAzXSAmIDB4QzApID4+PiA2KTtcbiAgICBsb2dnZXIubG9nKGBtYW5pZmVzdCBjb2RlYzoke2F1ZGlvQ29kZWN9LEFEVFMgZGF0YTp0eXBlOiR7YWR0c09iamVjdFR5cGV9LHNhbXBsZWluZ0luZGV4OiR7YWR0c1NhbXBsZWluZ0luZGV4fVske2FkdHNTYW1wbGVpbmdSYXRlc1thZHRzU2FtcGxlaW5nSW5kZXhdfUh6XSxjaGFubmVsQ29uZmlnOiR7YWR0c0NoYW5lbENvbmZpZ31gKTtcbiAgICAvLyBmaXJlZm94OiBmcmVxIGxlc3MgdGhhbiAyNGtIeiA9IEFBQyBTQlIgKEhFLUFBQylcbiAgICBpZiAodXNlckFnZW50LmluZGV4T2YoJ2ZpcmVmb3gnKSAhPT0gLTEpIHtcbiAgICAgIGlmIChhZHRzU2FtcGxlaW5nSW5kZXggPj0gNikge1xuICAgICAgICBhZHRzT2JqZWN0VHlwZSA9IDU7XG4gICAgICAgIGNvbmZpZyA9IG5ldyBBcnJheSg0KTtcbiAgICAgICAgLy8gSEUtQUFDIHVzZXMgU0JSIChTcGVjdHJhbCBCYW5kIFJlcGxpY2F0aW9uKSAsIGhpZ2ggZnJlcXVlbmNpZXMgYXJlIGNvbnN0cnVjdGVkIGZyb20gbG93IGZyZXF1ZW5jaWVzXG4gICAgICAgIC8vIHRoZXJlIGlzIGEgZmFjdG9yIDIgYmV0d2VlbiBmcmFtZSBzYW1wbGUgcmF0ZSBhbmQgb3V0cHV0IHNhbXBsZSByYXRlXG4gICAgICAgIC8vIG11bHRpcGx5IGZyZXF1ZW5jeSBieSAyIChzZWUgdGFibGUgYmVsb3csIGVxdWl2YWxlbnQgdG8gc3Vic3RyYWN0IDMpXG4gICAgICAgIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCA9IGFkdHNTYW1wbGVpbmdJbmRleCAtIDM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhZHRzT2JqZWN0VHlwZSA9IDI7XG4gICAgICAgIGNvbmZpZyA9IG5ldyBBcnJheSgyKTtcbiAgICAgICAgYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ID0gYWR0c1NhbXBsZWluZ0luZGV4O1xuICAgICAgfVxuICAgICAgLy8gQW5kcm9pZCA6IGFsd2F5cyB1c2UgQUFDXG4gICAgfSBlbHNlIGlmICh1c2VyQWdlbnQuaW5kZXhPZignYW5kcm9pZCcpICE9PSAtMSkge1xuICAgICAgYWR0c09iamVjdFR5cGUgPSAyO1xuICAgICAgY29uZmlnID0gbmV3IEFycmF5KDIpO1xuICAgICAgYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ID0gYWR0c1NhbXBsZWluZ0luZGV4O1xuICAgIH0gZWxzZSB7XG4gICAgICAvKiAgZm9yIG90aGVyIGJyb3dzZXJzIChjaHJvbWUgLi4uKVxuICAgICAgICAgIGFsd2F5cyBmb3JjZSBhdWRpbyB0eXBlIHRvIGJlIEhFLUFBQyBTQlIsIGFzIHNvbWUgYnJvd3NlcnMgZG8gbm90IHN1cHBvcnQgYXVkaW8gY29kZWMgc3dpdGNoIHByb3Blcmx5IChsaWtlIENocm9tZSAuLi4pXG4gICAgICAqL1xuICAgICAgYWR0c09iamVjdFR5cGUgPSA1O1xuICAgICAgY29uZmlnID0gbmV3IEFycmF5KDQpO1xuICAgICAgLy8gaWYgKG1hbmlmZXN0IGNvZGVjIGlzIEhFLUFBQyBvciBIRS1BQUN2MikgT1IgKG1hbmlmZXN0IGNvZGVjIG5vdCBzcGVjaWZpZWQgQU5EIGZyZXF1ZW5jeSBsZXNzIHRoYW4gMjRrSHopXG4gICAgICBpZiAoKGF1ZGlvQ29kZWMgJiYgKChhdWRpb0NvZGVjLmluZGV4T2YoJ21wNGEuNDAuMjknKSAhPT0gLTEpIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgIChhdWRpb0NvZGVjLmluZGV4T2YoJ21wNGEuNDAuNScpICE9PSAtMSkpKSB8fFxuICAgICAgICAgICghYXVkaW9Db2RlYyAmJiBhZHRzU2FtcGxlaW5nSW5kZXggPj0gNikpIHtcbiAgICAgICAgLy8gSEUtQUFDIHVzZXMgU0JSIChTcGVjdHJhbCBCYW5kIFJlcGxpY2F0aW9uKSAsIGhpZ2ggZnJlcXVlbmNpZXMgYXJlIGNvbnN0cnVjdGVkIGZyb20gbG93IGZyZXF1ZW5jaWVzXG4gICAgICAgIC8vIHRoZXJlIGlzIGEgZmFjdG9yIDIgYmV0d2VlbiBmcmFtZSBzYW1wbGUgcmF0ZSBhbmQgb3V0cHV0IHNhbXBsZSByYXRlXG4gICAgICAgIC8vIG11bHRpcGx5IGZyZXF1ZW5jeSBieSAyIChzZWUgdGFibGUgYmVsb3csIGVxdWl2YWxlbnQgdG8gc3Vic3RyYWN0IDMpXG4gICAgICAgIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCA9IGFkdHNTYW1wbGVpbmdJbmRleCAtIDM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBpZiAobWFuaWZlc3QgY29kZWMgaXMgQUFDKSBBTkQgKGZyZXF1ZW5jeSBsZXNzIHRoYW4gMjRrSHogT1IgbmIgY2hhbm5lbCBpcyAxKSBPUiAobWFuaWZlc3QgY29kZWMgbm90IHNwZWNpZmllZCBhbmQgbW9ubyBhdWRpbylcbiAgICAgICAgLy8gQ2hyb21lIGZhaWxzIHRvIHBsYXkgYmFjayB3aXRoIEFBQyBMQyBtb25vIHdoZW4gaW5pdGlhbGl6ZWQgd2l0aCBIRS1BQUMuICBUaGlzIGlzIG5vdCBhIHByb2JsZW0gd2l0aCBzdGVyZW8uXG4gICAgICAgIGlmIChhdWRpb0NvZGVjICYmIGF1ZGlvQ29kZWMuaW5kZXhPZignbXA0YS40MC4yJykgIT09IC0xICYmIChhZHRzU2FtcGxlaW5nSW5kZXggPj0gNiB8fCBhZHRzQ2hhbmVsQ29uZmlnID09PSAxKSB8fFxuICAgICAgICAgICAgKCFhdWRpb0NvZGVjICYmIGFkdHNDaGFuZWxDb25maWcgPT09IDEpKSB7XG4gICAgICAgICAgYWR0c09iamVjdFR5cGUgPSAyO1xuICAgICAgICAgIGNvbmZpZyA9IG5ldyBBcnJheSgyKTtcbiAgICAgICAgfVxuICAgICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggPSBhZHRzU2FtcGxlaW5nSW5kZXg7XG4gICAgICB9XG4gICAgfVxuICAgIC8qIHJlZmVyIHRvIGh0dHA6Ly93aWtpLm11bHRpbWVkaWEuY3gvaW5kZXgucGhwP3RpdGxlPU1QRUctNF9BdWRpbyNBdWRpb19TcGVjaWZpY19Db25maWdcbiAgICAgICAgSVNPIDE0NDk2LTMgKEFBQykucGRmIC0gVGFibGUgMS4xMyDigJQgU3ludGF4IG9mIEF1ZGlvU3BlY2lmaWNDb25maWcoKVxuICAgICAgQXVkaW8gUHJvZmlsZSAvIEF1ZGlvIE9iamVjdCBUeXBlXG4gICAgICAwOiBOdWxsXG4gICAgICAxOiBBQUMgTWFpblxuICAgICAgMjogQUFDIExDIChMb3cgQ29tcGxleGl0eSlcbiAgICAgIDM6IEFBQyBTU1IgKFNjYWxhYmxlIFNhbXBsZSBSYXRlKVxuICAgICAgNDogQUFDIExUUCAoTG9uZyBUZXJtIFByZWRpY3Rpb24pXG4gICAgICA1OiBTQlIgKFNwZWN0cmFsIEJhbmQgUmVwbGljYXRpb24pXG4gICAgICA2OiBBQUMgU2NhbGFibGVcbiAgICAgc2FtcGxpbmcgZnJlcVxuICAgICAgMDogOTYwMDAgSHpcbiAgICAgIDE6IDg4MjAwIEh6XG4gICAgICAyOiA2NDAwMCBIelxuICAgICAgMzogNDgwMDAgSHpcbiAgICAgIDQ6IDQ0MTAwIEh6XG4gICAgICA1OiAzMjAwMCBIelxuICAgICAgNjogMjQwMDAgSHpcbiAgICAgIDc6IDIyMDUwIEh6XG4gICAgICA4OiAxNjAwMCBIelxuICAgICAgOTogMTIwMDAgSHpcbiAgICAgIDEwOiAxMTAyNSBIelxuICAgICAgMTE6IDgwMDAgSHpcbiAgICAgIDEyOiA3MzUwIEh6XG4gICAgICAxMzogUmVzZXJ2ZWRcbiAgICAgIDE0OiBSZXNlcnZlZFxuICAgICAgMTU6IGZyZXF1ZW5jeSBpcyB3cml0dGVuIGV4cGxpY3RseVxuICAgICAgQ2hhbm5lbCBDb25maWd1cmF0aW9uc1xuICAgICAgVGhlc2UgYXJlIHRoZSBjaGFubmVsIGNvbmZpZ3VyYXRpb25zOlxuICAgICAgMDogRGVmaW5lZCBpbiBBT1QgU3BlY2lmYyBDb25maWdcbiAgICAgIDE6IDEgY2hhbm5lbDogZnJvbnQtY2VudGVyXG4gICAgICAyOiAyIGNoYW5uZWxzOiBmcm9udC1sZWZ0LCBmcm9udC1yaWdodFxuICAgICovXG4gICAgLy8gYXVkaW9PYmplY3RUeXBlID0gcHJvZmlsZSA9PiBwcm9maWxlLCB0aGUgTVBFRy00IEF1ZGlvIE9iamVjdCBUeXBlIG1pbnVzIDFcbiAgICBjb25maWdbMF0gPSBhZHRzT2JqZWN0VHlwZSA8PCAzO1xuICAgIC8vIHNhbXBsaW5nRnJlcXVlbmN5SW5kZXhcbiAgICBjb25maWdbMF0gfD0gKGFkdHNTYW1wbGVpbmdJbmRleCAmIDB4MEUpID4+IDE7XG4gICAgY29uZmlnWzFdIHw9IChhZHRzU2FtcGxlaW5nSW5kZXggJiAweDAxKSA8PCA3O1xuICAgIC8vIGNoYW5uZWxDb25maWd1cmF0aW9uXG4gICAgY29uZmlnWzFdIHw9IGFkdHNDaGFuZWxDb25maWcgPDwgMztcbiAgICBpZiAoYWR0c09iamVjdFR5cGUgPT09IDUpIHtcbiAgICAgIC8vIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleFxuICAgICAgY29uZmlnWzFdIHw9IChhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggJiAweDBFKSA+PiAxO1xuICAgICAgY29uZmlnWzJdID0gKGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCAmIDB4MDEpIDw8IDc7XG4gICAgICAvLyBhZHRzT2JqZWN0VHlwZSAoZm9yY2UgdG8gMiwgY2hyb21lIGlzIGNoZWNraW5nIHRoYXQgb2JqZWN0IHR5cGUgaXMgbGVzcyB0aGFuIDUgPz8/XG4gICAgICAvLyAgICBodHRwczovL2Nocm9taXVtLmdvb2dsZXNvdXJjZS5jb20vY2hyb21pdW0vc3JjLmdpdC8rL21hc3Rlci9tZWRpYS9mb3JtYXRzL21wNC9hYWMuY2NcbiAgICAgIGNvbmZpZ1syXSB8PSAyIDw8IDI7XG4gICAgICBjb25maWdbM10gPSAwO1xuICAgIH1cbiAgICByZXR1cm4ge2NvbmZpZzogY29uZmlnLCBzYW1wbGVyYXRlOiBhZHRzU2FtcGxlaW5nUmF0ZXNbYWR0c1NhbXBsZWluZ0luZGV4XSwgY2hhbm5lbENvdW50OiBhZHRzQ2hhbmVsQ29uZmlnLCBjb2RlYzogKCdtcDRhLjQwLicgKyBhZHRzT2JqZWN0VHlwZSl9O1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEFEVFM7XG4iLCIvKiAgaW5saW5lIGRlbXV4ZXIuXG4gKiAgIHByb2JlIGZyYWdtZW50cyBhbmQgaW5zdGFudGlhdGUgYXBwcm9wcmlhdGUgZGVtdXhlciBkZXBlbmRpbmcgb24gY29udGVudCB0eXBlIChUU0RlbXV4ZXIsIEFBQ0RlbXV4ZXIsIC4uLilcbiAqL1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuaW1wb3J0IEFBQ0RlbXV4ZXIgZnJvbSAnLi4vZGVtdXgvYWFjZGVtdXhlcic7XG5pbXBvcnQgVFNEZW11eGVyIGZyb20gJy4uL2RlbXV4L3RzZGVtdXhlcic7XG5cbmNsYXNzIERlbXV4ZXJJbmxpbmUge1xuXG4gIGNvbnN0cnVjdG9yKGhscyxyZW11eGVyKSB7XG4gICAgdGhpcy5obHMgPSBobHM7XG4gICAgdGhpcy5yZW11eGVyID0gcmVtdXhlcjtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdmFyIGRlbXV4ZXIgPSB0aGlzLmRlbXV4ZXI7XG4gICAgaWYgKGRlbXV4ZXIpIHtcbiAgICAgIGRlbXV4ZXIuZGVzdHJveSgpO1xuICAgIH1cbiAgfVxuXG4gIHB1c2goZGF0YSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCwgY2MsIGxldmVsLCBzbiwgZHVyYXRpb24pIHtcbiAgICB2YXIgZGVtdXhlciA9IHRoaXMuZGVtdXhlcjtcbiAgICBpZiAoIWRlbXV4ZXIpIHtcbiAgICAgIC8vIHByb2JlIGZvciBjb250ZW50IHR5cGVcbiAgICAgIGlmIChUU0RlbXV4ZXIucHJvYmUoZGF0YSkpIHtcbiAgICAgICAgZGVtdXhlciA9IHRoaXMuZGVtdXhlciA9IG5ldyBUU0RlbXV4ZXIodGhpcy5obHMsdGhpcy5yZW11eGVyKTtcbiAgICAgIH0gZWxzZSBpZihBQUNEZW11eGVyLnByb2JlKGRhdGEpKSB7XG4gICAgICAgIGRlbXV4ZXIgPSB0aGlzLmRlbXV4ZXIgPSBuZXcgQUFDRGVtdXhlcih0aGlzLmhscyx0aGlzLnJlbXV4ZXIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGUgOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuRlJBR19QQVJTSU5HX0VSUk9SLCBmYXRhbDogdHJ1ZSwgcmVhc29uOiAnbm8gZGVtdXggbWF0Y2hpbmcgd2l0aCBjb250ZW50IGZvdW5kJ30pO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuICAgIGRlbXV4ZXIucHVzaChkYXRhLGF1ZGlvQ29kZWMsdmlkZW9Db2RlYyx0aW1lT2Zmc2V0LGNjLGxldmVsLHNuLGR1cmF0aW9uKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBEZW11eGVySW5saW5lO1xuIiwiLyogZGVtdXhlciB3ZWIgd29ya2VyLlxuICogIC0gbGlzdGVuIHRvIHdvcmtlciBtZXNzYWdlLCBhbmQgdHJpZ2dlciBEZW11eGVySW5saW5lIHVwb24gcmVjZXB0aW9uIG9mIEZyYWdtZW50cy5cbiAqICAtIHByb3ZpZGVzIE1QNCBCb3hlcyBiYWNrIHRvIG1haW4gdGhyZWFkIHVzaW5nIFt0cmFuc2ZlcmFibGUgb2JqZWN0c10oaHR0cHM6Ly9kZXZlbG9wZXJzLmdvb2dsZS5jb20vd2ViL3VwZGF0ZXMvMjAxMS8xMi9UcmFuc2ZlcmFibGUtT2JqZWN0cy1MaWdodG5pbmctRmFzdCkgaW4gb3JkZXIgdG8gbWluaW1pemUgbWVzc2FnZSBwYXNzaW5nIG92ZXJoZWFkLlxuICovXG5cbiBpbXBvcnQgRGVtdXhlcklubGluZSBmcm9tICcuLi9kZW11eC9kZW11eGVyLWlubGluZSc7XG4gaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG4gaW1wb3J0IEV2ZW50RW1pdHRlciBmcm9tICdldmVudHMnO1xuIGltcG9ydCBNUDRSZW11eGVyIGZyb20gJy4uL3JlbXV4L21wNC1yZW11eGVyJztcblxudmFyIERlbXV4ZXJXb3JrZXIgPSBmdW5jdGlvbiAoc2VsZikge1xuICAvLyBvYnNlcnZlciBzZXR1cFxuICB2YXIgb2JzZXJ2ZXIgPSBuZXcgRXZlbnRFbWl0dGVyKCk7XG4gIG9ic2VydmVyLnRyaWdnZXIgPSBmdW5jdGlvbiB0cmlnZ2VyIChldmVudCwgLi4uZGF0YSkge1xuICAgIG9ic2VydmVyLmVtaXQoZXZlbnQsIGV2ZW50LCAuLi5kYXRhKTtcbiAgfTtcblxuICBvYnNlcnZlci5vZmYgPSBmdW5jdGlvbiBvZmYgKGV2ZW50LCAuLi5kYXRhKSB7XG4gICAgb2JzZXJ2ZXIucmVtb3ZlTGlzdGVuZXIoZXZlbnQsIC4uLmRhdGEpO1xuICB9O1xuICBzZWxmLmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBmdW5jdGlvbiAoZXYpIHtcbiAgICAvL2NvbnNvbGUubG9nKCdkZW11eGVyIGNtZDonICsgZXYuZGF0YS5jbWQpO1xuICAgIHN3aXRjaCAoZXYuZGF0YS5jbWQpIHtcbiAgICAgIGNhc2UgJ2luaXQnOlxuICAgICAgICBzZWxmLmRlbXV4ZXIgPSBuZXcgRGVtdXhlcklubGluZShvYnNlcnZlcixNUDRSZW11eGVyKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdkZW11eCc6XG4gICAgICAgIHZhciBkYXRhID0gZXYuZGF0YTtcbiAgICAgICAgc2VsZi5kZW11eGVyLnB1c2gobmV3IFVpbnQ4QXJyYXkoZGF0YS5kYXRhKSwgZGF0YS5hdWRpb0NvZGVjLCBkYXRhLnZpZGVvQ29kZWMsIGRhdGEudGltZU9mZnNldCwgZGF0YS5jYywgZGF0YS5sZXZlbCwgZGF0YS5zbiwgZGF0YS5kdXJhdGlvbik7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9KTtcblxuICAvLyBsaXN0ZW4gdG8gZXZlbnRzIHRyaWdnZXJlZCBieSBUUyBEZW11eGVyXG4gIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQsIGZ1bmN0aW9uKGV2LCBkYXRhKSB7XG4gICAgdmFyIG9iakRhdGEgPSB7ZXZlbnQ6IGV2fTtcbiAgICB2YXIgb2JqVHJhbnNmZXJhYmxlID0gW107XG4gICAgaWYgKGRhdGEuYXVkaW9Db2RlYykge1xuICAgICAgb2JqRGF0YS5hdWRpb0NvZGVjID0gZGF0YS5hdWRpb0NvZGVjO1xuICAgICAgb2JqRGF0YS5hdWRpb01vb3YgPSBkYXRhLmF1ZGlvTW9vdi5idWZmZXI7XG4gICAgICBvYmpEYXRhLmF1ZGlvQ2hhbm5lbENvdW50ID0gZGF0YS5hdWRpb0NoYW5uZWxDb3VudDtcbiAgICAgIG9ialRyYW5zZmVyYWJsZS5wdXNoKG9iakRhdGEuYXVkaW9Nb292KTtcbiAgICB9XG4gICAgaWYgKGRhdGEudmlkZW9Db2RlYykge1xuICAgICAgb2JqRGF0YS52aWRlb0NvZGVjID0gZGF0YS52aWRlb0NvZGVjO1xuICAgICAgb2JqRGF0YS52aWRlb01vb3YgPSBkYXRhLnZpZGVvTW9vdi5idWZmZXI7XG4gICAgICBvYmpEYXRhLnZpZGVvV2lkdGggPSBkYXRhLnZpZGVvV2lkdGg7XG4gICAgICBvYmpEYXRhLnZpZGVvSGVpZ2h0ID0gZGF0YS52aWRlb0hlaWdodDtcbiAgICAgIG9ialRyYW5zZmVyYWJsZS5wdXNoKG9iakRhdGEudmlkZW9Nb292KTtcbiAgICB9XG4gICAgLy8gcGFzcyBtb292IGFzIHRyYW5zZmVyYWJsZSBvYmplY3QgKG5vIGNvcHkpXG4gICAgc2VsZi5wb3N0TWVzc2FnZShvYmpEYXRhLG9ialRyYW5zZmVyYWJsZSk7XG4gIH0pO1xuXG4gIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLCBmdW5jdGlvbihldiwgZGF0YSkge1xuICAgIHZhciBvYmpEYXRhID0ge2V2ZW50OiBldiwgdHlwZTogZGF0YS50eXBlLCBzdGFydFBUUzogZGF0YS5zdGFydFBUUywgZW5kUFRTOiBkYXRhLmVuZFBUUywgc3RhcnREVFM6IGRhdGEuc3RhcnREVFMsIGVuZERUUzogZGF0YS5lbmREVFMsIG1vb2Y6IGRhdGEubW9vZi5idWZmZXIsIG1kYXQ6IGRhdGEubWRhdC5idWZmZXIsIG5iOiBkYXRhLm5ifTtcbiAgICAvLyBwYXNzIG1vb2YvbWRhdCBkYXRhIGFzIHRyYW5zZmVyYWJsZSBvYmplY3QgKG5vIGNvcHkpXG4gICAgc2VsZi5wb3N0TWVzc2FnZShvYmpEYXRhLCBbb2JqRGF0YS5tb29mLCBvYmpEYXRhLm1kYXRdKTtcbiAgfSk7XG5cbiAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19QQVJTRUQsIGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgc2VsZi5wb3N0TWVzc2FnZSh7ZXZlbnQ6IGV2ZW50fSk7XG4gIH0pO1xuXG4gIG9ic2VydmVyLm9uKEV2ZW50LkVSUk9SLCBmdW5jdGlvbihldmVudCwgZGF0YSkge1xuICAgIHNlbGYucG9zdE1lc3NhZ2Uoe2V2ZW50OiBldmVudCwgZGF0YTogZGF0YX0pO1xuICB9KTtcblxuICBvYnNlcnZlci5vbihFdmVudC5GUkFHX1BBUlNJTkdfTUVUQURBVEEsIGZ1bmN0aW9uKGV2ZW50LCBkYXRhKSB7XG4gICAgdmFyIG9iakRhdGEgPSB7ZXZlbnQ6IGV2ZW50LCBzYW1wbGVzOiBkYXRhLnNhbXBsZXN9O1xuICAgIHNlbGYucG9zdE1lc3NhZ2Uob2JqRGF0YSk7XG4gIH0pO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgRGVtdXhlcldvcmtlcjtcblxuIiwiaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgRGVtdXhlcklubGluZSBmcm9tICcuLi9kZW11eC9kZW11eGVyLWlubGluZSc7XG5pbXBvcnQgRGVtdXhlcldvcmtlciBmcm9tICcuLi9kZW11eC9kZW11eGVyLXdvcmtlcic7XG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCBNUDRSZW11eGVyIGZyb20gJy4uL3JlbXV4L21wNC1yZW11eGVyJztcbmltcG9ydCBEZWNyeXB0ZXIgZnJvbSAnLi4vY3J5cHQvZGVjcnlwdGVyJztcblxuY2xhc3MgRGVtdXhlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgdGhpcy5obHMgPSBobHM7XG4gICAgaWYgKGhscy5jb25maWcuZW5hYmxlV29ya2VyICYmICh0eXBlb2YoV29ya2VyKSAhPT0gJ3VuZGVmaW5lZCcpKSB7XG4gICAgICAgIGxvZ2dlci5sb2coJ2RlbXV4aW5nIGluIHdlYndvcmtlcicpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHZhciB3b3JrID0gcmVxdWlyZSgnd2Vid29ya2lmeScpO1xuICAgICAgICAgIHRoaXMudyA9IHdvcmsoRGVtdXhlcldvcmtlcik7XG4gICAgICAgICAgdGhpcy5vbndtc2cgPSB0aGlzLm9uV29ya2VyTWVzc2FnZS5iaW5kKHRoaXMpO1xuICAgICAgICAgIHRoaXMudy5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgdGhpcy5vbndtc2cpO1xuICAgICAgICAgIHRoaXMudy5wb3N0TWVzc2FnZSh7Y21kOiAnaW5pdCd9KTtcbiAgICAgICAgfSBjYXRjaChlcnIpIHtcbiAgICAgICAgICBsb2dnZXIuZXJyb3IoJ2Vycm9yIHdoaWxlIGluaXRpYWxpemluZyBEZW11eGVyV29ya2VyLCBmYWxsYmFjayBvbiBEZW11eGVySW5saW5lJyk7XG4gICAgICAgICAgdGhpcy5kZW11eGVyID0gbmV3IERlbXV4ZXJJbmxpbmUoaGxzLE1QNFJlbXV4ZXIpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmRlbXV4ZXIgPSBuZXcgRGVtdXhlcklubGluZShobHMsTVA0UmVtdXhlcik7XG4gICAgICB9XG4gICAgICB0aGlzLmRlbXV4SW5pdGlhbGl6ZWQgPSB0cnVlO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBpZiAodGhpcy53KSB7XG4gICAgICB0aGlzLncucmVtb3ZlRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIHRoaXMub253bXNnKTtcbiAgICAgIHRoaXMudy50ZXJtaW5hdGUoKTtcbiAgICAgIHRoaXMudyA9IG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZGVtdXhlci5kZXN0cm95KCk7XG4gICAgICB0aGlzLmRlbXV4ZXIgPSBudWxsO1xuICAgIH1cbiAgICBpZiAodGhpcy5kZWNyeXB0ZXIpIHtcbiAgICAgIHRoaXMuZGVjcnlwdGVyLmRlc3Ryb3koKTtcbiAgICAgIHRoaXMuZGVjcnlwdGVyID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICBwdXNoRGVjcnlwdGVkKGRhdGEsIGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQsIGNjLCBsZXZlbCwgc24sIGR1cmF0aW9uKSB7XG4gICAgaWYgKHRoaXMudykge1xuICAgICAgLy8gcG9zdCBmcmFnbWVudCBwYXlsb2FkIGFzIHRyYW5zZmVyYWJsZSBvYmplY3RzIChubyBjb3B5KVxuICAgICAgdGhpcy53LnBvc3RNZXNzYWdlKHtjbWQ6ICdkZW11eCcsIGRhdGE6IGRhdGEsIGF1ZGlvQ29kZWM6IGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWM6IHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQ6IHRpbWVPZmZzZXQsIGNjOiBjYywgbGV2ZWw6IGxldmVsLCBzbiA6IHNuLCBkdXJhdGlvbjogZHVyYXRpb259LCBbZGF0YV0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRlbXV4ZXIucHVzaChuZXcgVWludDhBcnJheShkYXRhKSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCwgY2MsIGxldmVsLCBzbiwgZHVyYXRpb24pO1xuICAgIH1cbiAgfVxuXG4gIHB1c2goZGF0YSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCwgY2MsIGxldmVsLCBzbiwgZHVyYXRpb24sIGRlY3J5cHRkYXRhKSB7XG4gICAgaWYgKChkYXRhLmJ5dGVMZW5ndGggPiAwKSAmJiAoZGVjcnlwdGRhdGEgIT0gbnVsbCkgJiYgKGRlY3J5cHRkYXRhLmtleSAhPSBudWxsKSAmJiAoZGVjcnlwdGRhdGEubWV0aG9kID09PSAnQUVTLTEyOCcpKSB7XG4gICAgICBpZiAodGhpcy5kZWNyeXB0ZXIgPT0gbnVsbCkge1xuICAgICAgICB0aGlzLmRlY3J5cHRlciA9IG5ldyBEZWNyeXB0ZXIodGhpcy5obHMpO1xuICAgICAgfVxuICAgICAgXG4gICAgICB2YXIgbG9jYWx0aGlzID0gdGhpcztcbiAgICAgIHRoaXMuZGVjcnlwdGVyLmRlY3J5cHQoZGF0YSwgZGVjcnlwdGRhdGEua2V5LCBkZWNyeXB0ZGF0YS5pdiwgZnVuY3Rpb24oZGVjcnlwdGVkRGF0YSl7XG4gICAgICAgIGxvY2FsdGhpcy5wdXNoRGVjcnlwdGVkKGRlY3J5cHRlZERhdGEsIGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQsIGNjLCBsZXZlbCwgc24sIGR1cmF0aW9uKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnB1c2hEZWNyeXB0ZWQoZGF0YSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCwgY2MsIGxldmVsLCBzbiwgZHVyYXRpb24pO1xuICAgIH1cbiAgfVxuXG4gIG9uV29ya2VyTWVzc2FnZShldikge1xuICAgIC8vY29uc29sZS5sb2coJ29uV29ya2VyTWVzc2FnZTonICsgZXYuZGF0YS5ldmVudCk7XG4gICAgc3dpdGNoKGV2LmRhdGEuZXZlbnQpIHtcbiAgICAgIGNhc2UgRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVDpcbiAgICAgICAgdmFyIG9iaiA9IHt9O1xuICAgICAgICBpZiAoZXYuZGF0YS5hdWRpb01vb3YpIHtcbiAgICAgICAgICBvYmouYXVkaW9Nb292ID0gbmV3IFVpbnQ4QXJyYXkoZXYuZGF0YS5hdWRpb01vb3YpO1xuICAgICAgICAgIG9iai5hdWRpb0NvZGVjID0gZXYuZGF0YS5hdWRpb0NvZGVjO1xuICAgICAgICAgIG9iai5hdWRpb0NoYW5uZWxDb3VudCA9IGV2LmRhdGEuYXVkaW9DaGFubmVsQ291bnQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGV2LmRhdGEudmlkZW9Nb292KSB7XG4gICAgICAgICAgb2JqLnZpZGVvTW9vdiA9IG5ldyBVaW50OEFycmF5KGV2LmRhdGEudmlkZW9Nb292KTtcbiAgICAgICAgICBvYmoudmlkZW9Db2RlYyA9IGV2LmRhdGEudmlkZW9Db2RlYztcbiAgICAgICAgICBvYmoudmlkZW9XaWR0aCA9IGV2LmRhdGEudmlkZW9XaWR0aDtcbiAgICAgICAgICBvYmoudmlkZW9IZWlnaHQgPSBldi5kYXRhLnZpZGVvSGVpZ2h0O1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCwgb2JqKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBOlxuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLHtcbiAgICAgICAgICBtb29mOiBuZXcgVWludDhBcnJheShldi5kYXRhLm1vb2YpLFxuICAgICAgICAgIG1kYXQ6IG5ldyBVaW50OEFycmF5KGV2LmRhdGEubWRhdCksXG4gICAgICAgICAgc3RhcnRQVFM6IGV2LmRhdGEuc3RhcnRQVFMsXG4gICAgICAgICAgZW5kUFRTOiBldi5kYXRhLmVuZFBUUyxcbiAgICAgICAgICBzdGFydERUUzogZXYuZGF0YS5zdGFydERUUyxcbiAgICAgICAgICBlbmREVFM6IGV2LmRhdGEuZW5kRFRTLFxuICAgICAgICAgIHR5cGU6IGV2LmRhdGEudHlwZSxcbiAgICAgICAgICBuYjogZXYuZGF0YS5uYlxuICAgICAgICB9KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgRXZlbnQuRlJBR19QQVJTSU5HX01FVEFEQVRBOlxuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19NRVRBREFUQSwge1xuICAgICAgICAgIHNhbXBsZXM6IGV2LmRhdGEuc2FtcGxlc1xuICAgICAgICB9KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKGV2LmRhdGEuZXZlbnQsIGV2LmRhdGEuZGF0YSk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBEZW11eGVyO1xuXG4iLCIvKipcbiAqIFBhcnNlciBmb3IgZXhwb25lbnRpYWwgR29sb21iIGNvZGVzLCBhIHZhcmlhYmxlLWJpdHdpZHRoIG51bWJlciBlbmNvZGluZyBzY2hlbWUgdXNlZCBieSBoMjY0LlxuKi9cblxuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5cbmNsYXNzIEV4cEdvbG9tYiB7XG5cbiAgY29uc3RydWN0b3IoZGF0YSkge1xuICAgIHRoaXMuZGF0YSA9IGRhdGE7XG4gICAgLy8gdGhlIG51bWJlciBvZiBieXRlcyBsZWZ0IHRvIGV4YW1pbmUgaW4gdGhpcy5kYXRhXG4gICAgdGhpcy5ieXRlc0F2YWlsYWJsZSA9IHRoaXMuZGF0YS5ieXRlTGVuZ3RoO1xuICAgIC8vIHRoZSBjdXJyZW50IHdvcmQgYmVpbmcgZXhhbWluZWRcbiAgICB0aGlzLndvcmQgPSAwOyAvLyA6dWludFxuICAgIC8vIHRoZSBudW1iZXIgb2YgYml0cyBsZWZ0IHRvIGV4YW1pbmUgaW4gdGhlIGN1cnJlbnQgd29yZFxuICAgIHRoaXMuYml0c0F2YWlsYWJsZSA9IDA7IC8vIDp1aW50XG4gIH1cblxuICAvLyAoKTp2b2lkXG4gIGxvYWRXb3JkKCkge1xuICAgIHZhclxuICAgICAgcG9zaXRpb24gPSB0aGlzLmRhdGEuYnl0ZUxlbmd0aCAtIHRoaXMuYnl0ZXNBdmFpbGFibGUsXG4gICAgICB3b3JraW5nQnl0ZXMgPSBuZXcgVWludDhBcnJheSg0KSxcbiAgICAgIGF2YWlsYWJsZUJ5dGVzID0gTWF0aC5taW4oNCwgdGhpcy5ieXRlc0F2YWlsYWJsZSk7XG4gICAgaWYgKGF2YWlsYWJsZUJ5dGVzID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ25vIGJ5dGVzIGF2YWlsYWJsZScpO1xuICAgIH1cbiAgICB3b3JraW5nQnl0ZXMuc2V0KHRoaXMuZGF0YS5zdWJhcnJheShwb3NpdGlvbiwgcG9zaXRpb24gKyBhdmFpbGFibGVCeXRlcykpO1xuICAgIHRoaXMud29yZCA9IG5ldyBEYXRhVmlldyh3b3JraW5nQnl0ZXMuYnVmZmVyKS5nZXRVaW50MzIoMCk7XG4gICAgLy8gdHJhY2sgdGhlIGFtb3VudCBvZiB0aGlzLmRhdGEgdGhhdCBoYXMgYmVlbiBwcm9jZXNzZWRcbiAgICB0aGlzLmJpdHNBdmFpbGFibGUgPSBhdmFpbGFibGVCeXRlcyAqIDg7XG4gICAgdGhpcy5ieXRlc0F2YWlsYWJsZSAtPSBhdmFpbGFibGVCeXRlcztcbiAgfVxuXG4gIC8vIChjb3VudDppbnQpOnZvaWRcbiAgc2tpcEJpdHMoY291bnQpIHtcbiAgICB2YXIgc2tpcEJ5dGVzOyAvLyA6aW50XG4gICAgaWYgKHRoaXMuYml0c0F2YWlsYWJsZSA+IGNvdW50KSB7XG4gICAgICB0aGlzLndvcmQgPDw9IGNvdW50O1xuICAgICAgdGhpcy5iaXRzQXZhaWxhYmxlIC09IGNvdW50O1xuICAgIH0gZWxzZSB7XG4gICAgICBjb3VudCAtPSB0aGlzLmJpdHNBdmFpbGFibGU7XG4gICAgICBza2lwQnl0ZXMgPSBjb3VudCA+PiAzO1xuICAgICAgY291bnQgLT0gKHNraXBCeXRlcyA+PiAzKTtcbiAgICAgIHRoaXMuYnl0ZXNBdmFpbGFibGUgLT0gc2tpcEJ5dGVzO1xuICAgICAgdGhpcy5sb2FkV29yZCgpO1xuICAgICAgdGhpcy53b3JkIDw8PSBjb3VudDtcbiAgICAgIHRoaXMuYml0c0F2YWlsYWJsZSAtPSBjb3VudDtcbiAgICB9XG4gIH1cblxuICAvLyAoc2l6ZTppbnQpOnVpbnRcbiAgcmVhZEJpdHMoc2l6ZSkge1xuICAgIHZhclxuICAgICAgYml0cyA9IE1hdGgubWluKHRoaXMuYml0c0F2YWlsYWJsZSwgc2l6ZSksIC8vIDp1aW50XG4gICAgICB2YWx1ID0gdGhpcy53b3JkID4+PiAoMzIgLSBiaXRzKTsgLy8gOnVpbnRcbiAgICBpZiAoc2l6ZSA+IDMyKSB7XG4gICAgICBsb2dnZXIuZXJyb3IoJ0Nhbm5vdCByZWFkIG1vcmUgdGhhbiAzMiBiaXRzIGF0IGEgdGltZScpO1xuICAgIH1cbiAgICB0aGlzLmJpdHNBdmFpbGFibGUgLT0gYml0cztcbiAgICBpZiAodGhpcy5iaXRzQXZhaWxhYmxlID4gMCkge1xuICAgICAgdGhpcy53b3JkIDw8PSBiaXRzO1xuICAgIH0gZWxzZSBpZiAodGhpcy5ieXRlc0F2YWlsYWJsZSA+IDApIHtcbiAgICAgIHRoaXMubG9hZFdvcmQoKTtcbiAgICB9XG4gICAgYml0cyA9IHNpemUgLSBiaXRzO1xuICAgIGlmIChiaXRzID4gMCkge1xuICAgICAgcmV0dXJuIHZhbHUgPDwgYml0cyB8IHRoaXMucmVhZEJpdHMoYml0cyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB2YWx1O1xuICAgIH1cbiAgfVxuXG4gIC8vICgpOnVpbnRcbiAgc2tpcExaKCkge1xuICAgIHZhciBsZWFkaW5nWmVyb0NvdW50OyAvLyA6dWludFxuICAgIGZvciAobGVhZGluZ1plcm9Db3VudCA9IDA7IGxlYWRpbmdaZXJvQ291bnQgPCB0aGlzLmJpdHNBdmFpbGFibGU7ICsrbGVhZGluZ1plcm9Db3VudCkge1xuICAgICAgaWYgKDAgIT09ICh0aGlzLndvcmQgJiAoMHg4MDAwMDAwMCA+Pj4gbGVhZGluZ1plcm9Db3VudCkpKSB7XG4gICAgICAgIC8vIHRoZSBmaXJzdCBiaXQgb2Ygd29ya2luZyB3b3JkIGlzIDFcbiAgICAgICAgdGhpcy53b3JkIDw8PSBsZWFkaW5nWmVyb0NvdW50O1xuICAgICAgICB0aGlzLmJpdHNBdmFpbGFibGUgLT0gbGVhZGluZ1plcm9Db3VudDtcbiAgICAgICAgcmV0dXJuIGxlYWRpbmdaZXJvQ291bnQ7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIHdlIGV4aGF1c3RlZCB3b3JkIGFuZCBzdGlsbCBoYXZlIG5vdCBmb3VuZCBhIDFcbiAgICB0aGlzLmxvYWRXb3JkKCk7XG4gICAgcmV0dXJuIGxlYWRpbmdaZXJvQ291bnQgKyB0aGlzLnNraXBMWigpO1xuICB9XG5cbiAgLy8gKCk6dm9pZFxuICBza2lwVUVHKCkge1xuICAgIHRoaXMuc2tpcEJpdHMoMSArIHRoaXMuc2tpcExaKCkpO1xuICB9XG5cbiAgLy8gKCk6dm9pZFxuICBza2lwRUcoKSB7XG4gICAgdGhpcy5za2lwQml0cygxICsgdGhpcy5za2lwTFooKSk7XG4gIH1cblxuICAvLyAoKTp1aW50XG4gIHJlYWRVRUcoKSB7XG4gICAgdmFyIGNseiA9IHRoaXMuc2tpcExaKCk7IC8vIDp1aW50XG4gICAgcmV0dXJuIHRoaXMucmVhZEJpdHMoY2x6ICsgMSkgLSAxO1xuICB9XG5cbiAgLy8gKCk6aW50XG4gIHJlYWRFRygpIHtcbiAgICB2YXIgdmFsdSA9IHRoaXMucmVhZFVFRygpOyAvLyA6aW50XG4gICAgaWYgKDB4MDEgJiB2YWx1KSB7XG4gICAgICAvLyB0aGUgbnVtYmVyIGlzIG9kZCBpZiB0aGUgbG93IG9yZGVyIGJpdCBpcyBzZXRcbiAgICAgIHJldHVybiAoMSArIHZhbHUpID4+PiAxOyAvLyBhZGQgMSB0byBtYWtlIGl0IGV2ZW4sIGFuZCBkaXZpZGUgYnkgMlxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gLTEgKiAodmFsdSA+Pj4gMSk7IC8vIGRpdmlkZSBieSB0d28gdGhlbiBtYWtlIGl0IG5lZ2F0aXZlXG4gICAgfVxuICB9XG5cbiAgLy8gU29tZSBjb252ZW5pZW5jZSBmdW5jdGlvbnNcbiAgLy8gOkJvb2xlYW5cbiAgcmVhZEJvb2xlYW4oKSB7XG4gICAgcmV0dXJuIDEgPT09IHRoaXMucmVhZEJpdHMoMSk7XG4gIH1cblxuICAvLyAoKTppbnRcbiAgcmVhZFVCeXRlKCkge1xuICAgIHJldHVybiB0aGlzLnJlYWRCaXRzKDgpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkdmFuY2UgdGhlIEV4cEdvbG9tYiBkZWNvZGVyIHBhc3QgYSBzY2FsaW5nIGxpc3QuIFRoZSBzY2FsaW5nXG4gICAqIGxpc3QgaXMgb3B0aW9uYWxseSB0cmFuc21pdHRlZCBhcyBwYXJ0IG9mIGEgc2VxdWVuY2UgcGFyYW1ldGVyXG4gICAqIHNldCBhbmQgaXMgbm90IHJlbGV2YW50IHRvIHRyYW5zbXV4aW5nLlxuICAgKiBAcGFyYW0gY291bnQge251bWJlcn0gdGhlIG51bWJlciBvZiBlbnRyaWVzIGluIHRoaXMgc2NhbGluZyBsaXN0XG4gICAqIEBzZWUgUmVjb21tZW5kYXRpb24gSVRVLVQgSC4yNjQsIFNlY3Rpb24gNy4zLjIuMS4xLjFcbiAgICovXG4gIHNraXBTY2FsaW5nTGlzdChjb3VudCkge1xuICAgIHZhclxuICAgICAgbGFzdFNjYWxlID0gOCxcbiAgICAgIG5leHRTY2FsZSA9IDgsXG4gICAgICBqLFxuICAgICAgZGVsdGFTY2FsZTtcbiAgICBmb3IgKGogPSAwOyBqIDwgY291bnQ7IGorKykge1xuICAgICAgaWYgKG5leHRTY2FsZSAhPT0gMCkge1xuICAgICAgICBkZWx0YVNjYWxlID0gdGhpcy5yZWFkRUcoKTtcbiAgICAgICAgbmV4dFNjYWxlID0gKGxhc3RTY2FsZSArIGRlbHRhU2NhbGUgKyAyNTYpICUgMjU2O1xuICAgICAgfVxuICAgICAgbGFzdFNjYWxlID0gKG5leHRTY2FsZSA9PT0gMCkgPyBsYXN0U2NhbGUgOiBuZXh0U2NhbGU7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJlYWQgYSBzZXF1ZW5jZSBwYXJhbWV0ZXIgc2V0IGFuZCByZXR1cm4gc29tZSBpbnRlcmVzdGluZyB2aWRlb1xuICAgKiBwcm9wZXJ0aWVzLiBBIHNlcXVlbmNlIHBhcmFtZXRlciBzZXQgaXMgdGhlIEgyNjQgbWV0YWRhdGEgdGhhdFxuICAgKiBkZXNjcmliZXMgdGhlIHByb3BlcnRpZXMgb2YgdXBjb21pbmcgdmlkZW8gZnJhbWVzLlxuICAgKiBAcGFyYW0gZGF0YSB7VWludDhBcnJheX0gdGhlIGJ5dGVzIG9mIGEgc2VxdWVuY2UgcGFyYW1ldGVyIHNldFxuICAgKiBAcmV0dXJuIHtvYmplY3R9IGFuIG9iamVjdCB3aXRoIGNvbmZpZ3VyYXRpb24gcGFyc2VkIGZyb20gdGhlXG4gICAqIHNlcXVlbmNlIHBhcmFtZXRlciBzZXQsIGluY2x1ZGluZyB0aGUgZGltZW5zaW9ucyBvZiB0aGVcbiAgICogYXNzb2NpYXRlZCB2aWRlbyBmcmFtZXMuXG4gICAqL1xuICByZWFkU1BTKCkge1xuICAgIHZhclxuICAgICAgZnJhbWVDcm9wTGVmdE9mZnNldCA9IDAsXG4gICAgICBmcmFtZUNyb3BSaWdodE9mZnNldCA9IDAsXG4gICAgICBmcmFtZUNyb3BUb3BPZmZzZXQgPSAwLFxuICAgICAgZnJhbWVDcm9wQm90dG9tT2Zmc2V0ID0gMCxcbiAgICAgIHNhclNjYWxlID0gMSxcbiAgICAgIHByb2ZpbGVJZGMscHJvZmlsZUNvbXBhdCxsZXZlbElkYyxcbiAgICAgIG51bVJlZkZyYW1lc0luUGljT3JkZXJDbnRDeWNsZSwgcGljV2lkdGhJbk1ic01pbnVzMSxcbiAgICAgIHBpY0hlaWdodEluTWFwVW5pdHNNaW51czEsXG4gICAgICBmcmFtZU1ic09ubHlGbGFnLFxuICAgICAgc2NhbGluZ0xpc3RDb3VudCxcbiAgICAgIGk7XG4gICAgdGhpcy5yZWFkVUJ5dGUoKTtcbiAgICBwcm9maWxlSWRjID0gdGhpcy5yZWFkVUJ5dGUoKTsgLy8gcHJvZmlsZV9pZGNcbiAgICBwcm9maWxlQ29tcGF0ID0gdGhpcy5yZWFkQml0cyg1KTsgLy8gY29uc3RyYWludF9zZXRbMC00XV9mbGFnLCB1KDUpXG4gICAgdGhpcy5za2lwQml0cygzKTsgLy8gcmVzZXJ2ZWRfemVyb18zYml0cyB1KDMpLFxuICAgIGxldmVsSWRjID0gdGhpcy5yZWFkVUJ5dGUoKTsgLy9sZXZlbF9pZGMgdSg4KVxuICAgIHRoaXMuc2tpcFVFRygpOyAvLyBzZXFfcGFyYW1ldGVyX3NldF9pZFxuICAgIC8vIHNvbWUgcHJvZmlsZXMgaGF2ZSBtb3JlIG9wdGlvbmFsIGRhdGEgd2UgZG9uJ3QgbmVlZFxuICAgIGlmIChwcm9maWxlSWRjID09PSAxMDAgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gMTEwIHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDEyMiB8fFxuICAgICAgICBwcm9maWxlSWRjID09PSAyNDQgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gNDQgIHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDgzICB8fFxuICAgICAgICBwcm9maWxlSWRjID09PSA4NiAgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gMTE4IHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDEyOCkge1xuICAgICAgdmFyIGNocm9tYUZvcm1hdElkYyA9IHRoaXMucmVhZFVFRygpO1xuICAgICAgaWYgKGNocm9tYUZvcm1hdElkYyA9PT0gMykge1xuICAgICAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBzZXBhcmF0ZV9jb2xvdXJfcGxhbmVfZmxhZ1xuICAgICAgfVxuICAgICAgdGhpcy5za2lwVUVHKCk7IC8vIGJpdF9kZXB0aF9sdW1hX21pbnVzOFxuICAgICAgdGhpcy5za2lwVUVHKCk7IC8vIGJpdF9kZXB0aF9jaHJvbWFfbWludXM4XG4gICAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBxcHByaW1lX3lfemVyb190cmFuc2Zvcm1fYnlwYXNzX2ZsYWdcbiAgICAgIGlmICh0aGlzLnJlYWRCb29sZWFuKCkpIHsgLy8gc2VxX3NjYWxpbmdfbWF0cml4X3ByZXNlbnRfZmxhZ1xuICAgICAgICBzY2FsaW5nTGlzdENvdW50ID0gKGNocm9tYUZvcm1hdElkYyAhPT0gMykgPyA4IDogMTI7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBzY2FsaW5nTGlzdENvdW50OyBpKyspIHtcbiAgICAgICAgICBpZiAodGhpcy5yZWFkQm9vbGVhbigpKSB7IC8vIHNlcV9zY2FsaW5nX2xpc3RfcHJlc2VudF9mbGFnWyBpIF1cbiAgICAgICAgICAgIGlmIChpIDwgNikge1xuICAgICAgICAgICAgICB0aGlzLnNraXBTY2FsaW5nTGlzdCgxNik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB0aGlzLnNraXBTY2FsaW5nTGlzdCg2NCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuc2tpcFVFRygpOyAvLyBsb2cyX21heF9mcmFtZV9udW1fbWludXM0XG4gICAgdmFyIHBpY09yZGVyQ250VHlwZSA9IHRoaXMucmVhZFVFRygpO1xuICAgIGlmIChwaWNPcmRlckNudFR5cGUgPT09IDApIHtcbiAgICAgIHRoaXMucmVhZFVFRygpOyAvL2xvZzJfbWF4X3BpY19vcmRlcl9jbnRfbHNiX21pbnVzNFxuICAgIH0gZWxzZSBpZiAocGljT3JkZXJDbnRUeXBlID09PSAxKSB7XG4gICAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBkZWx0YV9waWNfb3JkZXJfYWx3YXlzX3plcm9fZmxhZ1xuICAgICAgdGhpcy5za2lwRUcoKTsgLy8gb2Zmc2V0X2Zvcl9ub25fcmVmX3BpY1xuICAgICAgdGhpcy5za2lwRUcoKTsgLy8gb2Zmc2V0X2Zvcl90b3BfdG9fYm90dG9tX2ZpZWxkXG4gICAgICBudW1SZWZGcmFtZXNJblBpY09yZGVyQ250Q3ljbGUgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICAgIGZvcihpID0gMDsgaSA8IG51bVJlZkZyYW1lc0luUGljT3JkZXJDbnRDeWNsZTsgaSsrKSB7XG4gICAgICAgIHRoaXMuc2tpcEVHKCk7IC8vIG9mZnNldF9mb3JfcmVmX2ZyYW1lWyBpIF1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5za2lwVUVHKCk7IC8vIG1heF9udW1fcmVmX2ZyYW1lc1xuICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIGdhcHNfaW5fZnJhbWVfbnVtX3ZhbHVlX2FsbG93ZWRfZmxhZ1xuICAgIHBpY1dpZHRoSW5NYnNNaW51czEgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICBwaWNIZWlnaHRJbk1hcFVuaXRzTWludXMxID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgZnJhbWVNYnNPbmx5RmxhZyA9IHRoaXMucmVhZEJpdHMoMSk7XG4gICAgaWYgKGZyYW1lTWJzT25seUZsYWcgPT09IDApIHtcbiAgICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIG1iX2FkYXB0aXZlX2ZyYW1lX2ZpZWxkX2ZsYWdcbiAgICB9XG4gICAgdGhpcy5za2lwQml0cygxKTsgLy8gZGlyZWN0Xzh4OF9pbmZlcmVuY2VfZmxhZ1xuICAgIGlmICh0aGlzLnJlYWRCb29sZWFuKCkpIHsgLy8gZnJhbWVfY3JvcHBpbmdfZmxhZ1xuICAgICAgZnJhbWVDcm9wTGVmdE9mZnNldCA9IHRoaXMucmVhZFVFRygpO1xuICAgICAgZnJhbWVDcm9wUmlnaHRPZmZzZXQgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICAgIGZyYW1lQ3JvcFRvcE9mZnNldCA9IHRoaXMucmVhZFVFRygpO1xuICAgICAgZnJhbWVDcm9wQm90dG9tT2Zmc2V0ID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgfVxuICAgIGlmICh0aGlzLnJlYWRCb29sZWFuKCkpIHtcbiAgICAgIC8vIHZ1aV9wYXJhbWV0ZXJzX3ByZXNlbnRfZmxhZ1xuICAgICAgaWYgKHRoaXMucmVhZEJvb2xlYW4oKSkge1xuICAgICAgICAvLyBhc3BlY3RfcmF0aW9faW5mb19wcmVzZW50X2ZsYWdcbiAgICAgICAgbGV0IHNhclJhdGlvO1xuICAgICAgICBjb25zdCBhc3BlY3RSYXRpb0lkYyA9IHRoaXMucmVhZFVCeXRlKCk7XG4gICAgICAgIHN3aXRjaCAoYXNwZWN0UmF0aW9JZGMpIHtcbiAgICAgICAgICAvL2Nhc2UgMTogc2FyUmF0aW8gPSBbMSwxXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSAyOiBzYXJSYXRpbyA9IFsxMiwxMV07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgMzogc2FyUmF0aW8gPSBbMTAsMTFdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDQ6IHNhclJhdGlvID0gWzE2LDExXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSA1OiBzYXJSYXRpbyA9IFs0MCwzM107IGJyZWFrO1xuICAgICAgICAgIGNhc2UgNjogc2FyUmF0aW8gPSBbMjQsMTFdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDc6IHNhclJhdGlvID0gWzIwLDExXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSA4OiBzYXJSYXRpbyA9IFszMiwxMV07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgOTogc2FyUmF0aW8gPSBbODAsMzNdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDEwOiBzYXJSYXRpbyA9IFsxOCwxMV07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgMTE6IHNhclJhdGlvID0gWzE1LDExXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSAxMjogc2FyUmF0aW8gPSBbNjQsMzNdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDEzOiBzYXJSYXRpbyA9IFsxNjAsOTldOyBicmVhaztcbiAgICAgICAgICBjYXNlIDE0OiBzYXJSYXRpbyA9IFs0LDNdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDE1OiBzYXJSYXRpbyA9IFszLDJdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDE2OiBzYXJSYXRpbyA9IFsyLDFdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDI1NToge1xuICAgICAgICAgICAgc2FyUmF0aW8gPSBbdGhpcy5yZWFkVUJ5dGUoKSA8PCA4IHwgdGhpcy5yZWFkVUJ5dGUoKSwgdGhpcy5yZWFkVUJ5dGUoKSA8PCA4IHwgdGhpcy5yZWFkVUJ5dGUoKV07XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHNhclJhdGlvKSB7XG4gICAgICAgICAgc2FyU2NhbGUgPSBzYXJSYXRpb1swXSAvIHNhclJhdGlvWzFdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICB3aWR0aDogKCgocGljV2lkdGhJbk1ic01pbnVzMSArIDEpICogMTYpIC0gZnJhbWVDcm9wTGVmdE9mZnNldCAqIDIgLSBmcmFtZUNyb3BSaWdodE9mZnNldCAqIDIpICogc2FyU2NhbGUsXG4gICAgICBoZWlnaHQ6ICgoMiAtIGZyYW1lTWJzT25seUZsYWcpICogKHBpY0hlaWdodEluTWFwVW5pdHNNaW51czEgKyAxKSAqIDE2KSAtICgoZnJhbWVNYnNPbmx5RmxhZz8gMiA6IDQpICogKGZyYW1lQ3JvcFRvcE9mZnNldCArIGZyYW1lQ3JvcEJvdHRvbU9mZnNldCkpXG4gICAgfTtcbiAgfVxuXG4gIHJlYWRTbGljZVR5cGUoKSB7XG4gICAgLy8gc2tpcCBOQUx1IHR5cGVcbiAgICB0aGlzLnJlYWRVQnl0ZSgpO1xuICAgIC8vIGRpc2NhcmQgZmlyc3RfbWJfaW5fc2xpY2VcbiAgICB0aGlzLnJlYWRVRUcoKTtcbiAgICAvLyByZXR1cm4gc2xpY2VfdHlwZVxuICAgIHJldHVybiB0aGlzLnJlYWRVRUcoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFeHBHb2xvbWI7XG4iLCIvKipcbiAqIElEMyBwYXJzZXJcbiAqL1xuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG4vL2ltcG9ydCBIZXggZnJvbSAnLi4vdXRpbHMvaGV4JztcblxuIGNsYXNzIElEMyB7XG5cbiAgY29uc3RydWN0b3IoZGF0YSkge1xuICAgIHRoaXMuX2hhc1RpbWVTdGFtcCA9IGZhbHNlO1xuICAgIHZhciBvZmZzZXQgPSAwLCBieXRlMSxieXRlMixieXRlMyxieXRlNCx0YWdTaXplLGVuZFBvcyxoZWFkZXIsbGVuO1xuICAgICAgZG8ge1xuICAgICAgICBoZWFkZXIgPSB0aGlzLnJlYWRVVEYoZGF0YSxvZmZzZXQsMyk7XG4gICAgICAgIG9mZnNldCs9MztcbiAgICAgICAgICAvLyBmaXJzdCBjaGVjayBmb3IgSUQzIGhlYWRlclxuICAgICAgICAgIGlmIChoZWFkZXIgPT09ICdJRDMnKSB7XG4gICAgICAgICAgICAgIC8vIHNraXAgMjQgYml0c1xuICAgICAgICAgICAgICBvZmZzZXQgKz0gMztcbiAgICAgICAgICAgICAgLy8gcmV0cmlldmUgdGFnKHMpIGxlbmd0aFxuICAgICAgICAgICAgICBieXRlMSA9IGRhdGFbb2Zmc2V0KytdICYgMHg3ZjtcbiAgICAgICAgICAgICAgYnl0ZTIgPSBkYXRhW29mZnNldCsrXSAmIDB4N2Y7XG4gICAgICAgICAgICAgIGJ5dGUzID0gZGF0YVtvZmZzZXQrK10gJiAweDdmO1xuICAgICAgICAgICAgICBieXRlNCA9IGRhdGFbb2Zmc2V0KytdICYgMHg3ZjtcbiAgICAgICAgICAgICAgdGFnU2l6ZSA9IChieXRlMSA8PCAyMSkgKyAoYnl0ZTIgPDwgMTQpICsgKGJ5dGUzIDw8IDcpICsgYnl0ZTQ7XG4gICAgICAgICAgICAgIGVuZFBvcyA9IG9mZnNldCArIHRhZ1NpemU7XG4gICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZyhgSUQzIHRhZyBmb3VuZCwgc2l6ZS9lbmQ6ICR7dGFnU2l6ZX0vJHtlbmRQb3N9YCk7XG5cbiAgICAgICAgICAgICAgLy8gcmVhZCBJRDMgdGFnc1xuICAgICAgICAgICAgICB0aGlzLl9wYXJzZUlEM0ZyYW1lcyhkYXRhLCBvZmZzZXQsZW5kUG9zKTtcbiAgICAgICAgICAgICAgb2Zmc2V0ID0gZW5kUG9zO1xuICAgICAgICAgIH0gZWxzZSBpZiAoaGVhZGVyID09PSAnM0RJJykge1xuICAgICAgICAgICAgICAvLyBodHRwOi8vaWQzLm9yZy9pZDN2Mi40LjAtc3RydWN0dXJlIGNoYXB0ZXIgMy40LiAgIElEM3YyIGZvb3RlclxuICAgICAgICAgICAgICBvZmZzZXQgKz0gNztcbiAgICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYDNESSBmb290ZXIgZm91bmQsIGVuZDogJHtvZmZzZXR9YCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgb2Zmc2V0IC09IDM7XG4gICAgICAgICAgICAgIGxlbiA9IG9mZnNldDtcbiAgICAgICAgICAgICAgICAgIGlmIChsZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgICAvL2xvZ2dlci5sb2coYElEMyBsZW46ICR7bGVufWApO1xuICAgICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5oYXNUaW1lU3RhbXApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nZ2VyLndhcm4oJ0lEMyB0YWcgZm91bmQsIGJ1dCBubyB0aW1lc3RhbXAnKTtcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGVuZ3RoID0gbGVuO1xuICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3BheWxvYWQgPSBkYXRhLnN1YmFycmF5KDAsbGVuKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgIH0gd2hpbGUgKHRydWUpO1xuICB9XG5cbiAgcmVhZFVURihkYXRhLHN0YXJ0LGxlbikge1xuXG4gICAgdmFyIHJlc3VsdCA9ICcnLG9mZnNldCA9IHN0YXJ0LCBlbmQgPSBzdGFydCArIGxlbjtcbiAgICBkbyB7XG4gICAgICByZXN1bHQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShkYXRhW29mZnNldCsrXSk7XG4gICAgfSB3aGlsZShvZmZzZXQgPCBlbmQpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBfcGFyc2VJRDNGcmFtZXMoZGF0YSxvZmZzZXQsZW5kUG9zKSB7XG4gICAgdmFyIHRhZ0lkLHRhZ0xlbix0YWdTdGFydCx0YWdGbGFncyx0aW1lc3RhbXA7XG4gICAgd2hpbGUob2Zmc2V0ICsgOCA8PSBlbmRQb3MpIHtcbiAgICAgIHRhZ0lkID0gdGhpcy5yZWFkVVRGKGRhdGEsb2Zmc2V0LDQpO1xuICAgICAgb2Zmc2V0ICs9NDtcblxuICAgICAgdGFnTGVuID0gZGF0YVtvZmZzZXQrK10gPDwgMjQgK1xuICAgICAgICAgICAgICAgIGRhdGFbb2Zmc2V0KytdIDw8IDE2ICtcbiAgICAgICAgICAgICAgICBkYXRhW29mZnNldCsrXSA8PCA4ICtcbiAgICAgICAgICAgICAgICBkYXRhW29mZnNldCsrXTtcblxuICAgICAgdGFnRmxhZ3MgPSBkYXRhW29mZnNldCsrXSA8PCA4ICtcbiAgICAgICAgICAgICAgICAgIGRhdGFbb2Zmc2V0KytdO1xuXG4gICAgICB0YWdTdGFydCA9IG9mZnNldDtcbiAgICAgIC8vbG9nZ2VyLmxvZyhcIklEMyB0YWcgaWQ6XCIgKyB0YWdJZCk7XG4gICAgICBzd2l0Y2godGFnSWQpIHtcbiAgICAgICAgY2FzZSAnUFJJVic6XG4gICAgICAgICAgICAvL2xvZ2dlci5sb2coJ3BhcnNlIGZyYW1lOicgKyBIZXguaGV4RHVtcChkYXRhLnN1YmFycmF5KG9mZnNldCxlbmRQb3MpKSk7XG4gICAgICAgICAgICAvLyBvd25lciBzaG91bGQgYmUgXCJjb20uYXBwbGUuc3RyZWFtaW5nLnRyYW5zcG9ydFN0cmVhbVRpbWVzdGFtcFwiXG4gICAgICAgICAgICBpZiAodGhpcy5yZWFkVVRGKGRhdGEsb2Zmc2V0LDQ0KSA9PT0gJ2NvbS5hcHBsZS5zdHJlYW1pbmcudHJhbnNwb3J0U3RyZWFtVGltZXN0YW1wJykge1xuICAgICAgICAgICAgICAgIG9mZnNldCs9NDQ7XG4gICAgICAgICAgICAgICAgLy8gc21lbGxpbmcgZXZlbiBiZXR0ZXIgISB3ZSBmb3VuZCB0aGUgcmlnaHQgZGVzY3JpcHRvclxuICAgICAgICAgICAgICAgIC8vIHNraXAgbnVsbCBjaGFyYWN0ZXIgKHN0cmluZyBlbmQpICsgMyBmaXJzdCBieXRlc1xuICAgICAgICAgICAgICAgIG9mZnNldCs9IDQ7XG5cbiAgICAgICAgICAgICAgICAvLyB0aW1lc3RhbXAgaXMgMzMgYml0IGV4cHJlc3NlZCBhcyBhIGJpZy1lbmRpYW4gZWlnaHQtb2N0ZXQgbnVtYmVyLCB3aXRoIHRoZSB1cHBlciAzMSBiaXRzIHNldCB0byB6ZXJvLlxuICAgICAgICAgICAgICAgIHZhciBwdHMzM0JpdCAgPSBkYXRhW29mZnNldCsrXSAmIDB4MTtcbiAgICAgICAgICAgICAgICB0aGlzLl9oYXNUaW1lU3RhbXAgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgdGltZXN0YW1wID0gKChkYXRhW29mZnNldCsrXSA8PCAyMykgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoZGF0YVtvZmZzZXQrK10gPDwgMTUpICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKGRhdGFbb2Zmc2V0KytdIDw8ICA3KSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFbb2Zmc2V0KytdKSAvNDU7XG5cbiAgICAgICAgICAgICAgICBpZiAocHRzMzNCaXQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGltZXN0YW1wICAgKz0gNDc3MjE4NTguODQ7IC8vIDJeMzIgLyA5MFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aW1lc3RhbXAgPSBNYXRoLnJvdW5kKHRpbWVzdGFtcCk7XG4gICAgICAgICAgICAgICAgbG9nZ2VyLnRyYWNlKGBJRDMgdGltZXN0YW1wIGZvdW5kOiAke3RpbWVzdGFtcH1gKTtcbiAgICAgICAgICAgICAgICB0aGlzLl90aW1lU3RhbXAgPSB0aW1lc3RhbXA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGdldCBoYXNUaW1lU3RhbXAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2hhc1RpbWVTdGFtcDtcbiAgfVxuXG4gIGdldCB0aW1lU3RhbXAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3RpbWVTdGFtcDtcbiAgfVxuXG4gIGdldCBsZW5ndGgoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2xlbmd0aDtcbiAgfVxuXG4gIGdldCBwYXlsb2FkKCkge1xuICAgIHJldHVybiB0aGlzLl9wYXlsb2FkO1xuICB9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgSUQzO1xuXG4iLCIvKipcbiAqIGhpZ2hseSBvcHRpbWl6ZWQgVFMgZGVtdXhlcjpcbiAqIHBhcnNlIFBBVCwgUE1UXG4gKiBleHRyYWN0IFBFUyBwYWNrZXQgZnJvbSBhdWRpbyBhbmQgdmlkZW8gUElEc1xuICogZXh0cmFjdCBBVkMvSDI2NCBOQUwgdW5pdHMgYW5kIEFBQy9BRFRTIHNhbXBsZXMgZnJvbSBQRVMgcGFja2V0XG4gKiB0cmlnZ2VyIHRoZSByZW11eGVyIHVwb24gcGFyc2luZyBjb21wbGV0aW9uXG4gKiBpdCBhbHNvIHRyaWVzIHRvIHdvcmthcm91bmQgYXMgYmVzdCBhcyBpdCBjYW4gYXVkaW8gY29kZWMgc3dpdGNoIChIRS1BQUMgdG8gQUFDIGFuZCB2aWNlIHZlcnNhKSwgd2l0aG91dCBoYXZpbmcgdG8gcmVzdGFydCB0aGUgTWVkaWFTb3VyY2UuXG4gKiBpdCBhbHNvIGNvbnRyb2xzIHRoZSByZW11eGluZyBwcm9jZXNzIDpcbiAqIHVwb24gZGlzY29udGludWl0eSBvciBsZXZlbCBzd2l0Y2ggZGV0ZWN0aW9uLCBpdCB3aWxsIGFsc28gbm90aWZpZXMgdGhlIHJlbXV4ZXIgc28gdGhhdCBpdCBjYW4gcmVzZXQgaXRzIHN0YXRlLlxuKi9cblxuIGltcG9ydCBBRFRTIGZyb20gJy4vYWR0cyc7XG4gaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG4gaW1wb3J0IEV4cEdvbG9tYiBmcm9tICcuL2V4cC1nb2xvbWInO1xuLy8gaW1wb3J0IEhleCBmcm9tICcuLi91dGlscy9oZXgnO1xuIGltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuIGltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuXG4gY2xhc3MgVFNEZW11eGVyIHtcblxuICBjb25zdHJ1Y3RvcihvYnNlcnZlcixyZW11eGVyQ2xhc3MpIHtcbiAgICB0aGlzLm9ic2VydmVyID0gb2JzZXJ2ZXI7XG4gICAgdGhpcy5yZW11eGVyQ2xhc3MgPSByZW11eGVyQ2xhc3M7XG4gICAgdGhpcy5sYXN0Q0MgPSAwO1xuICAgIHRoaXMucmVtdXhlciA9IG5ldyB0aGlzLnJlbXV4ZXJDbGFzcyhvYnNlcnZlcik7XG4gIH1cblxuICBzdGF0aWMgcHJvYmUoZGF0YSkge1xuICAgIC8vIGEgVFMgZnJhZ21lbnQgc2hvdWxkIGNvbnRhaW4gYXQgbGVhc3QgMyBUUyBwYWNrZXRzLCBhIFBBVCwgYSBQTVQsIGFuZCBvbmUgUElELCBlYWNoIHN0YXJ0aW5nIHdpdGggMHg0N1xuICAgIGlmIChkYXRhLmxlbmd0aCA+PSAzKjE4OCAmJiBkYXRhWzBdID09PSAweDQ3ICYmIGRhdGFbMTg4XSA9PT0gMHg0NyAmJiBkYXRhWzIqMTg4XSA9PT0gMHg0Nykge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBzd2l0Y2hMZXZlbCgpIHtcbiAgICB0aGlzLnBtdFBhcnNlZCA9IGZhbHNlO1xuICAgIHRoaXMuX3BtdElkID0gLTE7XG4gICAgdGhpcy5fYXZjVHJhY2sgPSB7dHlwZTogJ3ZpZGVvJywgaWQgOi0xLCBzZXF1ZW5jZU51bWJlcjogMCwgc2FtcGxlcyA6IFtdLCBsZW4gOiAwLCBuYk5hbHUgOiAwfTtcbiAgICB0aGlzLl9hYWNUcmFjayA9IHt0eXBlOiAnYXVkaW8nLCBpZCA6LTEsIHNlcXVlbmNlTnVtYmVyOiAwLCBzYW1wbGVzIDogW10sIGxlbiA6IDB9O1xuICAgIHRoaXMuX2lkM1RyYWNrID0ge3R5cGU6ICdpZDMnLCBpZCA6LTEsIHNlcXVlbmNlTnVtYmVyOiAwLCBzYW1wbGVzIDogW10sIGxlbiA6IDB9O1xuICAgIHRoaXMucmVtdXhlci5zd2l0Y2hMZXZlbCgpO1xuICB9XG5cbiAgaW5zZXJ0RGlzY29udGludWl0eSgpIHtcbiAgICB0aGlzLnN3aXRjaExldmVsKCk7XG4gICAgdGhpcy5yZW11eGVyLmluc2VydERpc2NvbnRpbnVpdHkoKTtcbiAgfVxuXG4gIC8vIGZlZWQgaW5jb21pbmcgZGF0YSB0byB0aGUgZnJvbnQgb2YgdGhlIHBhcnNpbmcgcGlwZWxpbmVcbiAgcHVzaChkYXRhLCBhdWRpb0NvZGVjLCB2aWRlb0NvZGVjLCB0aW1lT2Zmc2V0LCBjYywgbGV2ZWwsIHNuLCBkdXJhdGlvbikge1xuICAgIHZhciBhdmNEYXRhLCBhYWNEYXRhLCBpZDNEYXRhLFxuICAgICAgICBzdGFydCwgbGVuID0gZGF0YS5sZW5ndGgsIHN0dCwgcGlkLCBhdGYsIG9mZnNldDtcbiAgICB0aGlzLmF1ZGlvQ29kZWMgPSBhdWRpb0NvZGVjO1xuICAgIHRoaXMudmlkZW9Db2RlYyA9IHZpZGVvQ29kZWM7XG4gICAgdGhpcy50aW1lT2Zmc2V0ID0gdGltZU9mZnNldDtcbiAgICB0aGlzLl9kdXJhdGlvbiA9IGR1cmF0aW9uO1xuICAgIHRoaXMuY29udGlndW91cyA9IGZhbHNlO1xuICAgIGlmIChjYyAhPT0gdGhpcy5sYXN0Q0MpIHtcbiAgICAgIGxvZ2dlci5sb2coJ2Rpc2NvbnRpbnVpdHkgZGV0ZWN0ZWQnKTtcbiAgICAgIHRoaXMuaW5zZXJ0RGlzY29udGludWl0eSgpO1xuICAgICAgdGhpcy5sYXN0Q0MgPSBjYztcbiAgICB9IGVsc2UgaWYgKGxldmVsICE9PSB0aGlzLmxhc3RMZXZlbCkge1xuICAgICAgbG9nZ2VyLmxvZygnbGV2ZWwgc3dpdGNoIGRldGVjdGVkJyk7XG4gICAgICB0aGlzLnN3aXRjaExldmVsKCk7XG4gICAgICB0aGlzLmxhc3RMZXZlbCA9IGxldmVsO1xuICAgIH0gZWxzZSBpZiAoc24gPT09ICh0aGlzLmxhc3RTTisxKSkge1xuICAgICAgdGhpcy5jb250aWd1b3VzID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5sYXN0U04gPSBzbjtcblxuICAgIGlmKCF0aGlzLmNvbnRpZ3VvdXMpIHtcbiAgICAgIC8vIGZsdXNoIGFueSBwYXJ0aWFsIGNvbnRlbnRcbiAgICAgIHRoaXMuYWFjT3ZlckZsb3cgPSBudWxsO1xuICAgIH1cblxuICAgIHZhciBwbXRQYXJzZWQgPSB0aGlzLnBtdFBhcnNlZCxcbiAgICAgICAgYXZjSWQgPSB0aGlzLl9hdmNUcmFjay5pZCxcbiAgICAgICAgYWFjSWQgPSB0aGlzLl9hYWNUcmFjay5pZCxcbiAgICAgICAgaWQzSWQgPSB0aGlzLl9pZDNUcmFjay5pZDtcbiAgICAvLyBsb29wIHRocm91Z2ggVFMgcGFja2V0c1xuICAgIGZvciAoc3RhcnQgPSAwOyBzdGFydCA8IGxlbjsgc3RhcnQgKz0gMTg4KSB7XG4gICAgICBpZiAoZGF0YVtzdGFydF0gPT09IDB4NDcpIHtcbiAgICAgICAgc3R0ID0gISEoZGF0YVtzdGFydCArIDFdICYgMHg0MCk7XG4gICAgICAgIC8vIHBpZCBpcyBhIDEzLWJpdCBmaWVsZCBzdGFydGluZyBhdCB0aGUgbGFzdCBiaXQgb2YgVFNbMV1cbiAgICAgICAgcGlkID0gKChkYXRhW3N0YXJ0ICsgMV0gJiAweDFmKSA8PCA4KSArIGRhdGFbc3RhcnQgKyAyXTtcbiAgICAgICAgYXRmID0gKGRhdGFbc3RhcnQgKyAzXSAmIDB4MzApID4+IDQ7XG4gICAgICAgIC8vIGlmIGFuIGFkYXB0aW9uIGZpZWxkIGlzIHByZXNlbnQsIGl0cyBsZW5ndGggaXMgc3BlY2lmaWVkIGJ5IHRoZSBmaWZ0aCBieXRlIG9mIHRoZSBUUyBwYWNrZXQgaGVhZGVyLlxuICAgICAgICBpZiAoYXRmID4gMSkge1xuICAgICAgICAgIG9mZnNldCA9IHN0YXJ0ICsgNSArIGRhdGFbc3RhcnQgKyA0XTtcbiAgICAgICAgICAvLyBjb250aW51ZSBpZiB0aGVyZSBpcyBvbmx5IGFkYXB0YXRpb24gZmllbGRcbiAgICAgICAgICBpZiAob2Zmc2V0ID09PSAoc3RhcnQgKyAxODgpKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgb2Zmc2V0ID0gc3RhcnQgKyA0O1xuICAgICAgICB9XG4gICAgICAgIGlmIChwbXRQYXJzZWQpIHtcbiAgICAgICAgICBpZiAocGlkID09PSBhdmNJZCkge1xuICAgICAgICAgICAgaWYgKHN0dCkge1xuICAgICAgICAgICAgICBpZiAoYXZjRGF0YSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3BhcnNlQVZDUEVTKHRoaXMuX3BhcnNlUEVTKGF2Y0RhdGEpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBhdmNEYXRhID0ge2RhdGE6IFtdLCBzaXplOiAwfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChhdmNEYXRhKSB7XG4gICAgICAgICAgICAgIGF2Y0RhdGEuZGF0YS5wdXNoKGRhdGEuc3ViYXJyYXkob2Zmc2V0LCBzdGFydCArIDE4OCkpO1xuICAgICAgICAgICAgICBhdmNEYXRhLnNpemUgKz0gc3RhcnQgKyAxODggLSBvZmZzZXQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGlmIChwaWQgPT09IGFhY0lkKSB7XG4gICAgICAgICAgICBpZiAoc3R0KSB7XG4gICAgICAgICAgICAgIGlmIChhYWNEYXRhKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcGFyc2VBQUNQRVModGhpcy5fcGFyc2VQRVMoYWFjRGF0YSkpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGFhY0RhdGEgPSB7ZGF0YTogW10sIHNpemU6IDB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGFhY0RhdGEpIHtcbiAgICAgICAgICAgICAgYWFjRGF0YS5kYXRhLnB1c2goZGF0YS5zdWJhcnJheShvZmZzZXQsIHN0YXJ0ICsgMTg4KSk7XG4gICAgICAgICAgICAgIGFhY0RhdGEuc2l6ZSArPSBzdGFydCArIDE4OCAtIG9mZnNldDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgaWYgKHBpZCA9PT0gaWQzSWQpIHtcbiAgICAgICAgICAgIGlmIChzdHQpIHtcbiAgICAgICAgICAgICAgaWYgKGlkM0RhdGEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9wYXJzZUlEM1BFUyh0aGlzLl9wYXJzZVBFUyhpZDNEYXRhKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWQzRGF0YSA9IHtkYXRhOiBbXSwgc2l6ZTogMH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoaWQzRGF0YSkge1xuICAgICAgICAgICAgICBpZDNEYXRhLmRhdGEucHVzaChkYXRhLnN1YmFycmF5KG9mZnNldCwgc3RhcnQgKyAxODgpKTtcbiAgICAgICAgICAgICAgaWQzRGF0YS5zaXplICs9IHN0YXJ0ICsgMTg4IC0gb2Zmc2V0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpZiAoc3R0KSB7XG4gICAgICAgICAgICBvZmZzZXQgKz0gZGF0YVtvZmZzZXRdICsgMTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHBpZCA9PT0gMCkge1xuICAgICAgICAgICAgdGhpcy5fcGFyc2VQQVQoZGF0YSwgb2Zmc2V0KTtcbiAgICAgICAgICB9IGVsc2UgaWYgKHBpZCA9PT0gdGhpcy5fcG10SWQpIHtcbiAgICAgICAgICAgIHRoaXMuX3BhcnNlUE1UKGRhdGEsIG9mZnNldCk7XG4gICAgICAgICAgICBwbXRQYXJzZWQgPSB0aGlzLnBtdFBhcnNlZCA9IHRydWU7XG4gICAgICAgICAgICBhdmNJZCA9IHRoaXMuX2F2Y1RyYWNrLmlkO1xuICAgICAgICAgICAgYWFjSWQgPSB0aGlzLl9hYWNUcmFjay5pZDtcbiAgICAgICAgICAgIGlkM0lkID0gdGhpcy5faWQzVHJhY2suaWQ7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLm9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlIDogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkZSQUdfUEFSU0lOR19FUlJPUiwgZmF0YWw6IGZhbHNlLCByZWFzb246ICdUUyBwYWNrZXQgZGlkIG5vdCBzdGFydCB3aXRoIDB4NDcnfSk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIHBhcnNlIGxhc3QgUEVTIHBhY2tldFxuICAgIGlmIChhdmNEYXRhKSB7XG4gICAgICB0aGlzLl9wYXJzZUFWQ1BFUyh0aGlzLl9wYXJzZVBFUyhhdmNEYXRhKSk7XG4gICAgfVxuICAgIGlmIChhYWNEYXRhKSB7XG4gICAgICB0aGlzLl9wYXJzZUFBQ1BFUyh0aGlzLl9wYXJzZVBFUyhhYWNEYXRhKSk7XG4gICAgfVxuICAgIGlmIChpZDNEYXRhKSB7XG4gICAgICB0aGlzLl9wYXJzZUlEM1BFUyh0aGlzLl9wYXJzZVBFUyhpZDNEYXRhKSk7XG4gICAgfVxuICAgIHRoaXMucmVtdXgoKTtcbiAgfVxuXG4gIHJlbXV4KCkge1xuICAgIHRoaXMucmVtdXhlci5yZW11eCh0aGlzLl9hYWNUcmFjayx0aGlzLl9hdmNUcmFjaywgdGhpcy5faWQzVHJhY2ssIHRoaXMudGltZU9mZnNldCwgdGhpcy5jb250aWd1b3VzKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5zd2l0Y2hMZXZlbCgpO1xuICAgIHRoaXMuX2luaXRQVFMgPSB0aGlzLl9pbml0RFRTID0gdW5kZWZpbmVkO1xuICAgIHRoaXMuX2R1cmF0aW9uID0gMDtcbiAgfVxuXG4gIF9wYXJzZVBBVChkYXRhLCBvZmZzZXQpIHtcbiAgICAvLyBza2lwIHRoZSBQU0kgaGVhZGVyIGFuZCBwYXJzZSB0aGUgZmlyc3QgUE1UIGVudHJ5XG4gICAgdGhpcy5fcG10SWQgID0gKGRhdGFbb2Zmc2V0ICsgMTBdICYgMHgxRikgPDwgOCB8IGRhdGFbb2Zmc2V0ICsgMTFdO1xuICAgIC8vbG9nZ2VyLmxvZygnUE1UIFBJRDonICArIHRoaXMuX3BtdElkKTtcbiAgfVxuXG4gIF9wYXJzZVBNVChkYXRhLCBvZmZzZXQpIHtcbiAgICB2YXIgc2VjdGlvbkxlbmd0aCwgdGFibGVFbmQsIHByb2dyYW1JbmZvTGVuZ3RoLCBwaWQ7XG4gICAgc2VjdGlvbkxlbmd0aCA9IChkYXRhW29mZnNldCArIDFdICYgMHgwZikgPDwgOCB8IGRhdGFbb2Zmc2V0ICsgMl07XG4gICAgdGFibGVFbmQgPSBvZmZzZXQgKyAzICsgc2VjdGlvbkxlbmd0aCAtIDQ7XG4gICAgLy8gdG8gZGV0ZXJtaW5lIHdoZXJlIHRoZSB0YWJsZSBpcywgd2UgaGF2ZSB0byBmaWd1cmUgb3V0IGhvd1xuICAgIC8vIGxvbmcgdGhlIHByb2dyYW0gaW5mbyBkZXNjcmlwdG9ycyBhcmVcbiAgICBwcm9ncmFtSW5mb0xlbmd0aCA9IChkYXRhW29mZnNldCArIDEwXSAmIDB4MGYpIDw8IDggfCBkYXRhW29mZnNldCArIDExXTtcbiAgICAvLyBhZHZhbmNlIHRoZSBvZmZzZXQgdG8gdGhlIGZpcnN0IGVudHJ5IGluIHRoZSBtYXBwaW5nIHRhYmxlXG4gICAgb2Zmc2V0ICs9IDEyICsgcHJvZ3JhbUluZm9MZW5ndGg7XG4gICAgd2hpbGUgKG9mZnNldCA8IHRhYmxlRW5kKSB7XG4gICAgICBwaWQgPSAoZGF0YVtvZmZzZXQgKyAxXSAmIDB4MUYpIDw8IDggfCBkYXRhW29mZnNldCArIDJdO1xuICAgICAgc3dpdGNoKGRhdGFbb2Zmc2V0XSkge1xuICAgICAgICAvLyBJU08vSUVDIDEzODE4LTcgQURUUyBBQUMgKE1QRUctMiBsb3dlciBiaXQtcmF0ZSBhdWRpbylcbiAgICAgICAgY2FzZSAweDBmOlxuICAgICAgICAgIC8vbG9nZ2VyLmxvZygnQUFDIFBJRDonICArIHBpZCk7XG4gICAgICAgICAgdGhpcy5fYWFjVHJhY2suaWQgPSBwaWQ7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIC8vIFBhY2tldGl6ZWQgbWV0YWRhdGEgKElEMylcbiAgICAgICAgY2FzZSAweDE1OlxuICAgICAgICAgIC8vbG9nZ2VyLmxvZygnSUQzIFBJRDonICArIHBpZCk7XG4gICAgICAgICAgdGhpcy5faWQzVHJhY2suaWQgPSBwaWQ7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIC8vIElUVS1UIFJlYy4gSC4yNjQgYW5kIElTTy9JRUMgMTQ0OTYtMTAgKGxvd2VyIGJpdC1yYXRlIHZpZGVvKVxuICAgICAgICBjYXNlIDB4MWI6XG4gICAgICAgICAgLy9sb2dnZXIubG9nKCdBVkMgUElEOicgICsgcGlkKTtcbiAgICAgICAgICB0aGlzLl9hdmNUcmFjay5pZCA9IHBpZDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgbG9nZ2VyLmxvZygndW5rb3duIHN0cmVhbSB0eXBlOicgICsgZGF0YVtvZmZzZXRdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICAvLyBtb3ZlIHRvIHRoZSBuZXh0IHRhYmxlIGVudHJ5XG4gICAgICAvLyBza2lwIHBhc3QgdGhlIGVsZW1lbnRhcnkgc3RyZWFtIGRlc2NyaXB0b3JzLCBpZiBwcmVzZW50XG4gICAgICBvZmZzZXQgKz0gKChkYXRhW29mZnNldCArIDNdICYgMHgwRikgPDwgOCB8IGRhdGFbb2Zmc2V0ICsgNF0pICsgNTtcbiAgICB9XG4gIH1cblxuICBfcGFyc2VQRVMoc3RyZWFtKSB7XG4gICAgdmFyIGkgPSAwLCBmcmFnLCBwZXNGbGFncywgcGVzUHJlZml4LCBwZXNMZW4sIHBlc0hkckxlbiwgcGVzRGF0YSwgcGVzUHRzLCBwZXNEdHMsIHBheWxvYWRTdGFydE9mZnNldDtcbiAgICAvL3JldHJpZXZlIFBUUy9EVFMgZnJvbSBmaXJzdCBmcmFnbWVudFxuICAgIGZyYWcgPSBzdHJlYW0uZGF0YVswXTtcbiAgICBwZXNQcmVmaXggPSAoZnJhZ1swXSA8PCAxNikgKyAoZnJhZ1sxXSA8PCA4KSArIGZyYWdbMl07XG4gICAgaWYgKHBlc1ByZWZpeCA9PT0gMSkge1xuICAgICAgcGVzTGVuID0gKGZyYWdbNF0gPDwgOCkgKyBmcmFnWzVdO1xuICAgICAgcGVzRmxhZ3MgPSBmcmFnWzddO1xuICAgICAgaWYgKHBlc0ZsYWdzICYgMHhDMCkge1xuICAgICAgICAvKiBQRVMgaGVhZGVyIGRlc2NyaWJlZCBoZXJlIDogaHR0cDovL2R2ZC5zb3VyY2Vmb3JnZS5uZXQvZHZkaW5mby9wZXMtaGRyLmh0bWxcbiAgICAgICAgICAgIGFzIFBUUyAvIERUUyBpcyAzMyBiaXQgd2UgY2Fubm90IHVzZSBiaXR3aXNlIG9wZXJhdG9yIGluIEpTLFxuICAgICAgICAgICAgYXMgQml0d2lzZSBvcGVyYXRvcnMgdHJlYXQgdGhlaXIgb3BlcmFuZHMgYXMgYSBzZXF1ZW5jZSBvZiAzMiBiaXRzICovXG4gICAgICAgIHBlc1B0cyA9IChmcmFnWzldICYgMHgwRSkgKiA1MzY4NzA5MTIgKy8vIDEgPDwgMjlcbiAgICAgICAgICAoZnJhZ1sxMF0gJiAweEZGKSAqIDQxOTQzMDQgKy8vIDEgPDwgMjJcbiAgICAgICAgICAoZnJhZ1sxMV0gJiAweEZFKSAqIDE2Mzg0ICsvLyAxIDw8IDE0XG4gICAgICAgICAgKGZyYWdbMTJdICYgMHhGRikgKiAxMjggKy8vIDEgPDwgN1xuICAgICAgICAgIChmcmFnWzEzXSAmIDB4RkUpIC8gMjtcbiAgICAgICAgICAvLyBjaGVjayBpZiBncmVhdGVyIHRoYW4gMl4zMiAtMVxuICAgICAgICAgIGlmIChwZXNQdHMgPiA0Mjk0OTY3Mjk1KSB7XG4gICAgICAgICAgICAvLyBkZWNyZW1lbnQgMl4zM1xuICAgICAgICAgICAgcGVzUHRzIC09IDg1ODk5MzQ1OTI7XG4gICAgICAgICAgfVxuICAgICAgICBpZiAocGVzRmxhZ3MgJiAweDQwKSB7XG4gICAgICAgICAgcGVzRHRzID0gKGZyYWdbMTRdICYgMHgwRSApICogNTM2ODcwOTEyICsvLyAxIDw8IDI5XG4gICAgICAgICAgICAoZnJhZ1sxNV0gJiAweEZGICkgKiA0MTk0MzA0ICsvLyAxIDw8IDIyXG4gICAgICAgICAgICAoZnJhZ1sxNl0gJiAweEZFICkgKiAxNjM4NCArLy8gMSA8PCAxNFxuICAgICAgICAgICAgKGZyYWdbMTddICYgMHhGRiApICogMTI4ICsvLyAxIDw8IDdcbiAgICAgICAgICAgIChmcmFnWzE4XSAmIDB4RkUgKSAvIDI7XG4gICAgICAgICAgLy8gY2hlY2sgaWYgZ3JlYXRlciB0aGFuIDJeMzIgLTFcbiAgICAgICAgICBpZiAocGVzRHRzID4gNDI5NDk2NzI5NSkge1xuICAgICAgICAgICAgLy8gZGVjcmVtZW50IDJeMzNcbiAgICAgICAgICAgIHBlc0R0cyAtPSA4NTg5OTM0NTkyO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZXNEdHMgPSBwZXNQdHM7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHBlc0hkckxlbiA9IGZyYWdbOF07XG4gICAgICBwYXlsb2FkU3RhcnRPZmZzZXQgPSBwZXNIZHJMZW4gKyA5O1xuICAgICAgLy8gdHJpbSBQRVMgaGVhZGVyXG4gICAgICBzdHJlYW0uZGF0YVswXSA9IHN0cmVhbS5kYXRhWzBdLnN1YmFycmF5KHBheWxvYWRTdGFydE9mZnNldCk7XG4gICAgICBzdHJlYW0uc2l6ZSAtPSBwYXlsb2FkU3RhcnRPZmZzZXQ7XG4gICAgICAvL3JlYXNzZW1ibGUgUEVTIHBhY2tldFxuICAgICAgcGVzRGF0YSA9IG5ldyBVaW50OEFycmF5KHN0cmVhbS5zaXplKTtcbiAgICAgIC8vIHJlYXNzZW1ibGUgdGhlIHBhY2tldFxuICAgICAgd2hpbGUgKHN0cmVhbS5kYXRhLmxlbmd0aCkge1xuICAgICAgICBmcmFnID0gc3RyZWFtLmRhdGEuc2hpZnQoKTtcbiAgICAgICAgcGVzRGF0YS5zZXQoZnJhZywgaSk7XG4gICAgICAgIGkgKz0gZnJhZy5ieXRlTGVuZ3RoO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHtkYXRhOiBwZXNEYXRhLCBwdHM6IHBlc1B0cywgZHRzOiBwZXNEdHMsIGxlbjogcGVzTGVufTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgX3BhcnNlQVZDUEVTKHBlcykge1xuICAgIHZhciB0cmFjayA9IHRoaXMuX2F2Y1RyYWNrLFxuICAgICAgICBzYW1wbGVzID0gdHJhY2suc2FtcGxlcyxcbiAgICAgICAgdW5pdHMgPSB0aGlzLl9wYXJzZUFWQ05BTHUocGVzLmRhdGEpLFxuICAgICAgICB1bml0czIgPSBbXSxcbiAgICAgICAgZGVidWcgPSBmYWxzZSxcbiAgICAgICAga2V5ID0gZmFsc2UsXG4gICAgICAgIGxlbmd0aCA9IDAsXG4gICAgICAgIGF2Y1NhbXBsZSxcbiAgICAgICAgcHVzaDtcbiAgICAvLyBubyBOQUx1IGZvdW5kXG4gICAgaWYgKHVuaXRzLmxlbmd0aCA9PT0gMCAmJiBzYW1wbGVzLmxlbmd0aCA+IDApIHtcbiAgICAgIC8vIGFwcGVuZCBwZXMuZGF0YSB0byBwcmV2aW91cyBOQUwgdW5pdFxuICAgICAgdmFyIGxhc3RhdmNTYW1wbGUgPSBzYW1wbGVzW3NhbXBsZXMubGVuZ3RoIC0gMV07XG4gICAgICB2YXIgbGFzdFVuaXQgPSBsYXN0YXZjU2FtcGxlLnVuaXRzLnVuaXRzW2xhc3RhdmNTYW1wbGUudW5pdHMudW5pdHMubGVuZ3RoIC0gMV07XG4gICAgICB2YXIgdG1wID0gbmV3IFVpbnQ4QXJyYXkobGFzdFVuaXQuZGF0YS5ieXRlTGVuZ3RoICsgcGVzLmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICB0bXAuc2V0KGxhc3RVbml0LmRhdGEsIDApO1xuICAgICAgdG1wLnNldChwZXMuZGF0YSwgbGFzdFVuaXQuZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICAgIGxhc3RVbml0LmRhdGEgPSB0bXA7XG4gICAgICBsYXN0YXZjU2FtcGxlLnVuaXRzLmxlbmd0aCArPSBwZXMuZGF0YS5ieXRlTGVuZ3RoO1xuICAgICAgdHJhY2subGVuICs9IHBlcy5kYXRhLmJ5dGVMZW5ndGg7XG4gICAgfVxuICAgIC8vZnJlZSBwZXMuZGF0YSB0byBzYXZlIHVwIHNvbWUgbWVtb3J5XG4gICAgcGVzLmRhdGEgPSBudWxsO1xuICAgIHZhciBkZWJ1Z1N0cmluZyA9ICcnO1xuICAgIHVuaXRzLmZvckVhY2godW5pdCA9PiB7XG4gICAgICBzd2l0Y2godW5pdC50eXBlKSB7XG4gICAgICAgIC8vTkRSXG4gICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgIHB1c2ggPSB0cnVlO1xuICAgICAgICAgICBpZihkZWJ1Zykge1xuICAgICAgICAgICAgZGVidWdTdHJpbmcgKz0gJ05EUiAnO1xuICAgICAgICAgICB9XG4gICAgICAgICAgIGJyZWFrO1xuICAgICAgICAvL0lEUlxuICAgICAgICBjYXNlIDU6XG4gICAgICAgICAgcHVzaCA9IHRydWU7XG4gICAgICAgICAgaWYoZGVidWcpIHtcbiAgICAgICAgICAgIGRlYnVnU3RyaW5nICs9ICdJRFIgJztcbiAgICAgICAgICB9XG4gICAgICAgICAga2V5ID0gdHJ1ZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSA2OlxuICAgICAgICAgIHB1c2ggPSB0cnVlO1xuICAgICAgICAgIGlmKGRlYnVnKSB7XG4gICAgICAgICAgICBkZWJ1Z1N0cmluZyArPSAnU0VJICc7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICAvL1NQU1xuICAgICAgICBjYXNlIDc6XG4gICAgICAgICAgcHVzaCA9IHRydWU7XG4gICAgICAgICAgaWYoZGVidWcpIHtcbiAgICAgICAgICAgIGRlYnVnU3RyaW5nICs9ICdTUFMgJztcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYoIXRyYWNrLnNwcykge1xuICAgICAgICAgICAgdmFyIGV4cEdvbG9tYkRlY29kZXIgPSBuZXcgRXhwR29sb21iKHVuaXQuZGF0YSk7XG4gICAgICAgICAgICB2YXIgY29uZmlnID0gZXhwR29sb21iRGVjb2Rlci5yZWFkU1BTKCk7XG4gICAgICAgICAgICB0cmFjay53aWR0aCA9IGNvbmZpZy53aWR0aDtcbiAgICAgICAgICAgIHRyYWNrLmhlaWdodCA9IGNvbmZpZy5oZWlnaHQ7XG4gICAgICAgICAgICB0cmFjay5zcHMgPSBbdW5pdC5kYXRhXTtcbiAgICAgICAgICAgIHRyYWNrLnRpbWVzY2FsZSA9IHRoaXMucmVtdXhlci50aW1lc2NhbGU7XG4gICAgICAgICAgICB0cmFjay5kdXJhdGlvbiA9IHRoaXMucmVtdXhlci50aW1lc2NhbGUgKiB0aGlzLl9kdXJhdGlvbjtcbiAgICAgICAgICAgIHZhciBjb2RlY2FycmF5ID0gdW5pdC5kYXRhLnN1YmFycmF5KDEsIDQpO1xuICAgICAgICAgICAgdmFyIGNvZGVjc3RyaW5nID0gJ2F2YzEuJztcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgMzsgaSsrKSB7XG4gICAgICAgICAgICAgIHZhciBoID0gY29kZWNhcnJheVtpXS50b1N0cmluZygxNik7XG4gICAgICAgICAgICAgIGlmIChoLmxlbmd0aCA8IDIpIHtcbiAgICAgICAgICAgICAgICBoID0gJzAnICsgaDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBjb2RlY3N0cmluZyArPSBoO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdHJhY2suY29kZWMgPSBjb2RlY3N0cmluZztcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIC8vUFBTXG4gICAgICAgIGNhc2UgODpcbiAgICAgICAgICBwdXNoID0gdHJ1ZTtcbiAgICAgICAgICBpZihkZWJ1Zykge1xuICAgICAgICAgICAgZGVidWdTdHJpbmcgKz0gJ1BQUyAnO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoIXRyYWNrLnBwcykge1xuICAgICAgICAgICAgdHJhY2sucHBzID0gW3VuaXQuZGF0YV07XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDk6XG4gICAgICAgICAgcHVzaCA9IHRydWU7XG4gICAgICAgICAgaWYoZGVidWcpIHtcbiAgICAgICAgICAgIGRlYnVnU3RyaW5nICs9ICdBVUQgJztcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgcHVzaCA9IGZhbHNlO1xuICAgICAgICAgIGRlYnVnU3RyaW5nICs9ICd1bmtub3duIE5BTCAnICsgdW5pdC50eXBlICsgJyAnO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgaWYocHVzaCkge1xuICAgICAgICB1bml0czIucHVzaCh1bml0KTtcbiAgICAgICAgbGVuZ3RoKz11bml0LmRhdGEuYnl0ZUxlbmd0aDtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBpZihkZWJ1ZyB8fCBkZWJ1Z1N0cmluZy5sZW5ndGgpIHtcbiAgICAgIGxvZ2dlci5sb2coZGVidWdTdHJpbmcpO1xuICAgIH1cbiAgICAvL2J1aWxkIHNhbXBsZSBmcm9tIFBFU1xuICAgIC8vIEFubmV4IEIgdG8gTVA0IGNvbnZlcnNpb24gdG8gYmUgZG9uZVxuICAgIGlmICh1bml0czIubGVuZ3RoKSB7XG4gICAgICAvLyBvbmx5IHB1c2ggQVZDIHNhbXBsZSBpZiBrZXlmcmFtZSBhbHJlYWR5IGZvdW5kLiBicm93c2VycyBleHBlY3QgYSBrZXlmcmFtZSBhdCBmaXJzdCB0byBzdGFydCBkZWNvZGluZ1xuICAgICAgaWYgKGtleSA9PT0gdHJ1ZSB8fCB0cmFjay5zcHMgKSB7XG4gICAgICAgIGF2Y1NhbXBsZSA9IHt1bml0czogeyB1bml0cyA6IHVuaXRzMiwgbGVuZ3RoIDogbGVuZ3RofSwgcHRzOiBwZXMucHRzLCBkdHM6IHBlcy5kdHMsIGtleToga2V5fTtcbiAgICAgICAgc2FtcGxlcy5wdXNoKGF2Y1NhbXBsZSk7XG4gICAgICAgIHRyYWNrLmxlbiArPSBsZW5ndGg7XG4gICAgICAgIHRyYWNrLm5iTmFsdSArPSB1bml0czIubGVuZ3RoO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG5cbiAgX3BhcnNlQVZDTkFMdShhcnJheSkge1xuICAgIHZhciBpID0gMCwgbGVuID0gYXJyYXkuYnl0ZUxlbmd0aCwgdmFsdWUsIG92ZXJmbG93LCBzdGF0ZSA9IDA7XG4gICAgdmFyIHVuaXRzID0gW10sIHVuaXQsIHVuaXRUeXBlLCBsYXN0VW5pdFN0YXJ0LCBsYXN0VW5pdFR5cGU7XG4gICAgLy9sb2dnZXIubG9nKCdQRVM6JyArIEhleC5oZXhEdW1wKGFycmF5KSk7XG4gICAgd2hpbGUgKGkgPCBsZW4pIHtcbiAgICAgIHZhbHVlID0gYXJyYXlbaSsrXTtcbiAgICAgIC8vIGZpbmRpbmcgMyBvciA0LWJ5dGUgc3RhcnQgY29kZXMgKDAwIDAwIDAxIE9SIDAwIDAwIDAwIDAxKVxuICAgICAgc3dpdGNoIChzdGF0ZSkge1xuICAgICAgICBjYXNlIDA6XG4gICAgICAgICAgaWYgKHZhbHVlID09PSAwKSB7XG4gICAgICAgICAgICBzdGF0ZSA9IDE7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgaWYoIHZhbHVlID09PSAwKSB7XG4gICAgICAgICAgICBzdGF0ZSA9IDI7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHN0YXRlID0gMDtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgMjpcbiAgICAgICAgY2FzZSAzOlxuICAgICAgICAgIGlmKCB2YWx1ZSA9PT0gMCkge1xuICAgICAgICAgICAgc3RhdGUgPSAzO1xuICAgICAgICAgIH0gZWxzZSBpZiAodmFsdWUgPT09IDEpIHtcbiAgICAgICAgICAgIHVuaXRUeXBlID0gYXJyYXlbaV0gJiAweDFmO1xuICAgICAgICAgICAgLy9sb2dnZXIubG9nKCdmaW5kIE5BTFUgQCBvZmZzZXQ6JyArIGkgKyAnLHR5cGU6JyArIHVuaXRUeXBlKTtcbiAgICAgICAgICAgIGlmIChsYXN0VW5pdFN0YXJ0KSB7XG4gICAgICAgICAgICAgIHVuaXQgPSB7ZGF0YTogYXJyYXkuc3ViYXJyYXkobGFzdFVuaXRTdGFydCwgaSAtIHN0YXRlIC0gMSksIHR5cGU6IGxhc3RVbml0VHlwZX07XG4gICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygncHVzaGluZyBOQUxVLCB0eXBlL3NpemU6JyArIHVuaXQudHlwZSArICcvJyArIHVuaXQuZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICAgICAgICAgICAgdW5pdHMucHVzaCh1bml0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIElmIE5BTCB1bml0cyBhcmUgbm90IHN0YXJ0aW5nIHJpZ2h0IGF0IHRoZSBiZWdpbm5pbmcgb2YgdGhlIFBFUyBwYWNrZXQsIHB1c2ggcHJlY2VkaW5nIGRhdGEgaW50byBwcmV2aW91cyBOQUwgdW5pdC5cbiAgICAgICAgICAgICAgb3ZlcmZsb3cgID0gaSAtIHN0YXRlIC0gMTtcbiAgICAgICAgICAgICAgaWYgKG92ZXJmbG93KSB7XG4gICAgICAgICAgICAgICAgdmFyIHRyYWNrID0gdGhpcy5fYXZjVHJhY2ssXG4gICAgICAgICAgICAgICAgICAgIHNhbXBsZXMgPSB0cmFjay5zYW1wbGVzO1xuICAgICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnZmlyc3QgTkFMVSBmb3VuZCB3aXRoIG92ZXJmbG93OicgKyBvdmVyZmxvdyk7XG4gICAgICAgICAgICAgICAgaWYgKHNhbXBsZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICB2YXIgbGFzdGF2Y1NhbXBsZSA9IHNhbXBsZXNbc2FtcGxlcy5sZW5ndGggLSAxXSxcbiAgICAgICAgICAgICAgICAgICAgICBsYXN0VW5pdHMgPSBsYXN0YXZjU2FtcGxlLnVuaXRzLnVuaXRzLFxuICAgICAgICAgICAgICAgICAgICAgIGxhc3RVbml0ID0gbGFzdFVuaXRzW2xhc3RVbml0cy5sZW5ndGggLSAxXSxcbiAgICAgICAgICAgICAgICAgICAgICB0bXAgPSBuZXcgVWludDhBcnJheShsYXN0VW5pdC5kYXRhLmJ5dGVMZW5ndGggKyBvdmVyZmxvdyk7XG4gICAgICAgICAgICAgICAgICB0bXAuc2V0KGxhc3RVbml0LmRhdGEsIDApO1xuICAgICAgICAgICAgICAgICAgdG1wLnNldChhcnJheS5zdWJhcnJheSgwLCBvdmVyZmxvdyksIGxhc3RVbml0LmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICAgICAgICAgICAgICBsYXN0VW5pdC5kYXRhID0gdG1wO1xuICAgICAgICAgICAgICAgICAgbGFzdGF2Y1NhbXBsZS51bml0cy5sZW5ndGggKz0gb3ZlcmZsb3c7XG4gICAgICAgICAgICAgICAgICB0cmFjay5sZW4gKz0gb3ZlcmZsb3c7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsYXN0VW5pdFN0YXJ0ID0gaTtcbiAgICAgICAgICAgIGxhc3RVbml0VHlwZSA9IHVuaXRUeXBlO1xuICAgICAgICAgICAgaWYgKHVuaXRUeXBlID09PSAxIHx8IHVuaXRUeXBlID09PSA1KSB7XG4gICAgICAgICAgICAgIC8vIE9QVEkgISEhIGlmIElEUi9ORFIgdW5pdCwgY29uc2lkZXIgaXQgaXMgbGFzdCBOQUx1XG4gICAgICAgICAgICAgIGkgPSBsZW47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzdGF0ZSA9IDA7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHN0YXRlID0gMDtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChsYXN0VW5pdFN0YXJ0KSB7XG4gICAgICB1bml0ID0ge2RhdGE6IGFycmF5LnN1YmFycmF5KGxhc3RVbml0U3RhcnQsIGxlbiksIHR5cGU6IGxhc3RVbml0VHlwZX07XG4gICAgICB1bml0cy5wdXNoKHVuaXQpO1xuICAgICAgLy9sb2dnZXIubG9nKCdwdXNoaW5nIE5BTFUsIHR5cGUvc2l6ZTonICsgdW5pdC50eXBlICsgJy8nICsgdW5pdC5kYXRhLmJ5dGVMZW5ndGgpO1xuICAgIH1cbiAgICByZXR1cm4gdW5pdHM7XG4gIH1cblxuICBfcGFyc2VBQUNQRVMocGVzKSB7XG4gICAgdmFyIHRyYWNrID0gdGhpcy5fYWFjVHJhY2ssXG4gICAgICAgIGRhdGEgPSBwZXMuZGF0YSxcbiAgICAgICAgcHRzID0gcGVzLnB0cyxcbiAgICAgICAgc3RhcnRPZmZzZXQgPSAwLFxuICAgICAgICBkdXJhdGlvbiA9IHRoaXMuX2R1cmF0aW9uLFxuICAgICAgICBhdWRpb0NvZGVjID0gdGhpcy5hdWRpb0NvZGVjLFxuICAgICAgICBjb25maWcsIGFkdHNGcmFtZVNpemUsIGFkdHNTdGFydE9mZnNldCwgYWR0c0hlYWRlckxlbiwgc3RhbXAsIG5iU2FtcGxlcywgbGVuLCBhYWNTYW1wbGU7XG4gICAgaWYgKHRoaXMuYWFjT3ZlckZsb3cpIHtcbiAgICAgIHZhciB0bXAgPSBuZXcgVWludDhBcnJheSh0aGlzLmFhY092ZXJGbG93LmJ5dGVMZW5ndGggKyBkYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgdG1wLnNldCh0aGlzLmFhY092ZXJGbG93LCAwKTtcbiAgICAgIHRtcC5zZXQoZGF0YSwgdGhpcy5hYWNPdmVyRmxvdy5ieXRlTGVuZ3RoKTtcbiAgICAgIGRhdGEgPSB0bXA7XG4gICAgfVxuICAgIC8vIGxvb2sgZm9yIEFEVFMgaGVhZGVyICgweEZGRngpXG4gICAgZm9yIChhZHRzU3RhcnRPZmZzZXQgPSBzdGFydE9mZnNldCwgbGVuID0gZGF0YS5sZW5ndGg7IGFkdHNTdGFydE9mZnNldCA8IGxlbiAtIDE7IGFkdHNTdGFydE9mZnNldCsrKSB7XG4gICAgICBpZiAoKGRhdGFbYWR0c1N0YXJ0T2Zmc2V0XSA9PT0gMHhmZikgJiYgKGRhdGFbYWR0c1N0YXJ0T2Zmc2V0KzFdICYgMHhmMCkgPT09IDB4ZjApIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGlmIEFEVFMgaGVhZGVyIGRvZXMgbm90IHN0YXJ0IHN0cmFpZ2h0IGZyb20gdGhlIGJlZ2lubmluZyBvZiB0aGUgUEVTIHBheWxvYWQsIHJhaXNlIGFuIGVycm9yXG4gICAgaWYgKGFkdHNTdGFydE9mZnNldCkge1xuICAgICAgdmFyIHJlYXNvbiwgZmF0YWw7XG4gICAgICBpZiAoYWR0c1N0YXJ0T2Zmc2V0IDwgbGVuIC0gMSkge1xuICAgICAgICByZWFzb24gPSBgQUFDIFBFUyBkaWQgbm90IHN0YXJ0IHdpdGggQURUUyBoZWFkZXIsb2Zmc2V0OiR7YWR0c1N0YXJ0T2Zmc2V0fWA7XG4gICAgICAgIGZhdGFsID0gZmFsc2U7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZWFzb24gPSAnbm8gQURUUyBoZWFkZXIgZm91bmQgaW4gQUFDIFBFUyc7XG4gICAgICAgIGZhdGFsID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHRoaXMub2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5GUkFHX1BBUlNJTkdfRVJST1IsIGZhdGFsOiBmYXRhbCwgcmVhc29uOiByZWFzb259KTtcbiAgICAgIGlmIChmYXRhbCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuICAgIGlmICghdHJhY2suYXVkaW9zYW1wbGVyYXRlKSB7XG4gICAgICBjb25maWcgPSBBRFRTLmdldEF1ZGlvQ29uZmlnKHRoaXMub2JzZXJ2ZXIsZGF0YSwgYWR0c1N0YXJ0T2Zmc2V0LCBhdWRpb0NvZGVjKTtcbiAgICAgIHRyYWNrLmNvbmZpZyA9IGNvbmZpZy5jb25maWc7XG4gICAgICB0cmFjay5hdWRpb3NhbXBsZXJhdGUgPSBjb25maWcuc2FtcGxlcmF0ZTtcbiAgICAgIHRyYWNrLmNoYW5uZWxDb3VudCA9IGNvbmZpZy5jaGFubmVsQ291bnQ7XG4gICAgICB0cmFjay5jb2RlYyA9IGNvbmZpZy5jb2RlYztcbiAgICAgIHRyYWNrLnRpbWVzY2FsZSA9IHRoaXMucmVtdXhlci50aW1lc2NhbGU7XG4gICAgICB0cmFjay5kdXJhdGlvbiA9IHRoaXMucmVtdXhlci50aW1lc2NhbGUgKiBkdXJhdGlvbjtcbiAgICAgIGxvZ2dlci5sb2coYHBhcnNlZCBjb2RlYzoke3RyYWNrLmNvZGVjfSxyYXRlOiR7Y29uZmlnLnNhbXBsZXJhdGV9LG5iIGNoYW5uZWw6JHtjb25maWcuY2hhbm5lbENvdW50fWApO1xuICAgIH1cbiAgICBuYlNhbXBsZXMgPSAwO1xuICAgIHdoaWxlICgoYWR0c1N0YXJ0T2Zmc2V0ICsgNSkgPCBsZW4pIHtcbiAgICAgIC8vIHJldHJpZXZlIGZyYW1lIHNpemVcbiAgICAgIGFkdHNGcmFtZVNpemUgPSAoKGRhdGFbYWR0c1N0YXJ0T2Zmc2V0ICsgM10gJiAweDAzKSA8PCAxMSk7XG4gICAgICAvLyBieXRlIDRcbiAgICAgIGFkdHNGcmFtZVNpemUgfD0gKGRhdGFbYWR0c1N0YXJ0T2Zmc2V0ICsgNF0gPDwgMyk7XG4gICAgICAvLyBieXRlIDVcbiAgICAgIGFkdHNGcmFtZVNpemUgfD0gKChkYXRhW2FkdHNTdGFydE9mZnNldCArIDVdICYgMHhFMCkgPj4+IDUpO1xuICAgICAgYWR0c0hlYWRlckxlbiA9ICghIShkYXRhW2FkdHNTdGFydE9mZnNldCArIDFdICYgMHgwMSkgPyA3IDogOSk7XG4gICAgICBhZHRzRnJhbWVTaXplIC09IGFkdHNIZWFkZXJMZW47XG4gICAgICBzdGFtcCA9IE1hdGgucm91bmQocHRzICsgbmJTYW1wbGVzICogMTAyNCAqIDkwMDAwIC8gdHJhY2suYXVkaW9zYW1wbGVyYXRlKTtcbiAgICAgIC8vc3RhbXAgPSBwZXMucHRzO1xuICAgICAgLy9jb25zb2xlLmxvZygnQUFDIGZyYW1lLCBvZmZzZXQvbGVuZ3RoL3B0czonICsgKGFkdHNTdGFydE9mZnNldCs3KSArICcvJyArIGFkdHNGcmFtZVNpemUgKyAnLycgKyBzdGFtcC50b0ZpeGVkKDApKTtcbiAgICAgIGlmICgoYWR0c0ZyYW1lU2l6ZSA+IDApICYmICgoYWR0c1N0YXJ0T2Zmc2V0ICsgYWR0c0hlYWRlckxlbiArIGFkdHNGcmFtZVNpemUpIDw9IGxlbikpIHtcbiAgICAgICAgYWFjU2FtcGxlID0ge3VuaXQ6IGRhdGEuc3ViYXJyYXkoYWR0c1N0YXJ0T2Zmc2V0ICsgYWR0c0hlYWRlckxlbiwgYWR0c1N0YXJ0T2Zmc2V0ICsgYWR0c0hlYWRlckxlbiArIGFkdHNGcmFtZVNpemUpLCBwdHM6IHN0YW1wLCBkdHM6IHN0YW1wfTtcbiAgICAgICAgdHJhY2suc2FtcGxlcy5wdXNoKGFhY1NhbXBsZSk7XG4gICAgICAgIHRyYWNrLmxlbiArPSBhZHRzRnJhbWVTaXplO1xuICAgICAgICBhZHRzU3RhcnRPZmZzZXQgKz0gYWR0c0ZyYW1lU2l6ZSArIGFkdHNIZWFkZXJMZW47XG4gICAgICAgIG5iU2FtcGxlcysrO1xuICAgICAgICAvLyBsb29rIGZvciBBRFRTIGhlYWRlciAoMHhGRkZ4KVxuICAgICAgICBmb3IgKCA7IGFkdHNTdGFydE9mZnNldCA8IChsZW4gLSAxKTsgYWR0c1N0YXJ0T2Zmc2V0KyspIHtcbiAgICAgICAgICBpZiAoKGRhdGFbYWR0c1N0YXJ0T2Zmc2V0XSA9PT0gMHhmZikgJiYgKChkYXRhW2FkdHNTdGFydE9mZnNldCArIDFdICYgMHhmMCkgPT09IDB4ZjApKSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoYWR0c1N0YXJ0T2Zmc2V0IDwgbGVuKSB7XG4gICAgICB0aGlzLmFhY092ZXJGbG93ID0gZGF0YS5zdWJhcnJheShhZHRzU3RhcnRPZmZzZXQsIGxlbik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuYWFjT3ZlckZsb3cgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIF9wYXJzZUlEM1BFUyhwZXMpIHtcbiAgICB0aGlzLl9pZDNUcmFjay5zYW1wbGVzLnB1c2gocGVzKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBUU0RlbXV4ZXI7XG5cbiIsImV4cG9ydCBjb25zdCBFcnJvclR5cGVzID0ge1xuICAvLyBJZGVudGlmaWVyIGZvciBhIG5ldHdvcmsgZXJyb3IgKGxvYWRpbmcgZXJyb3IgLyB0aW1lb3V0IC4uLilcbiAgTkVUV09SS19FUlJPUjogJ2hsc05ldHdvcmtFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgbWVkaWEgRXJyb3IgKHZpZGVvL3BhcnNpbmcvbWVkaWFzb3VyY2UgZXJyb3IpXG4gIE1FRElBX0VSUk9SOiAnaGxzTWVkaWFFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGFsbCBvdGhlciBlcnJvcnNcbiAgT1RIRVJfRVJST1I6ICdobHNPdGhlckVycm9yJ1xufTtcblxuZXhwb3J0IGNvbnN0IEVycm9yRGV0YWlscyA9IHtcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBtYW5pZmVzdCBsb2FkIGVycm9yIC0gZGF0YTogeyB1cmwgOiBmYXVsdHkgVVJMLCByZXNwb25zZSA6IFhIUiByZXNwb25zZX1cbiAgTUFOSUZFU1RfTE9BRF9FUlJPUjogJ21hbmlmZXN0TG9hZEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBtYW5pZmVzdCBsb2FkIHRpbWVvdXQgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBNQU5JRkVTVF9MT0FEX1RJTUVPVVQ6ICdtYW5pZmVzdExvYWRUaW1lT3V0JyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBtYW5pZmVzdCBwYXJzaW5nIGVycm9yIC0gZGF0YTogeyB1cmwgOiBmYXVsdHkgVVJMLCByZWFzb24gOiBlcnJvciByZWFzb259XG4gIE1BTklGRVNUX1BBUlNJTkdfRVJST1I6ICdtYW5pZmVzdFBhcnNpbmdFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIHBsYXlsaXN0IGxvYWQgZXJyb3IgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBMRVZFTF9MT0FEX0VSUk9SOiAnbGV2ZWxMb2FkRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBwbGF5bGlzdCBsb2FkIHRpbWVvdXQgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBMRVZFTF9MT0FEX1RJTUVPVVQ6ICdsZXZlbExvYWRUaW1lT3V0JyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBsZXZlbCBzd2l0Y2ggZXJyb3IgLSBkYXRhOiB7IGxldmVsIDogZmF1bHR5IGxldmVsIElkLCBldmVudCA6IGVycm9yIGRlc2NyaXB0aW9ufVxuICBMRVZFTF9TV0lUQ0hfRVJST1I6ICdsZXZlbFN3aXRjaEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgZnJhZ21lbnQgbG9hZCBlcnJvciAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdCwgcmVzcG9uc2UgOiBYSFIgcmVzcG9uc2V9XG4gIEZSQUdfTE9BRF9FUlJPUjogJ2ZyYWdMb2FkRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBmcmFnbWVudCBsb29wIGxvYWRpbmcgZXJyb3IgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3R9XG4gIEZSQUdfTE9PUF9MT0FESU5HX0VSUk9SOiAnZnJhZ0xvb3BMb2FkaW5nRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBmcmFnbWVudCBsb2FkIHRpbWVvdXQgZXJyb3IgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3R9XG4gIEZSQUdfTE9BRF9USU1FT1VUOiAnZnJhZ0xvYWRUaW1lT3V0JyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBmcmFnbWVudCBkZWNyeXB0aW9uIGVycm9yIGV2ZW50IC0gZGF0YTogcGFyc2luZyBlcnJvciBkZXNjcmlwdGlvblxuICBGUkFHX0RFQ1JZUFRfRVJST1I6ICdmcmFnRGVjcnlwdEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBmcmFnbWVudCBwYXJzaW5nIGVycm9yIGV2ZW50IC0gZGF0YTogcGFyc2luZyBlcnJvciBkZXNjcmlwdGlvblxuICBGUkFHX1BBUlNJTkdfRVJST1I6ICdmcmFnUGFyc2luZ0Vycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgZGVjcnlwdCBrZXkgbG9hZCBlcnJvciAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdCwgcmVzcG9uc2UgOiBYSFIgcmVzcG9uc2V9XG4gIEtFWV9MT0FEX0VSUk9SOiAna2V5TG9hZEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgZGVjcnlwdCBrZXkgbG9hZCB0aW1lb3V0IGVycm9yIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0fVxuICBLRVlfTE9BRF9USU1FT1VUOiAna2V5TG9hZFRpbWVPdXQnLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIGJ1ZmZlciBhcHBlbmQgZXJyb3IgLSBkYXRhOiBhcHBlbmQgZXJyb3IgZGVzY3JpcHRpb25cbiAgQlVGRkVSX0FQUEVORF9FUlJPUjogJ2J1ZmZlckFwcGVuZEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBidWZmZXIgYXBwZW5kaW5nIGVycm9yIGV2ZW50IC0gZGF0YTogYXBwZW5kaW5nIGVycm9yIGRlc2NyaXB0aW9uXG4gIEJVRkZFUl9BUFBFTkRJTkdfRVJST1I6ICdidWZmZXJBcHBlbmRpbmdFcnJvcidcbn07XG4iLCJleHBvcnQgZGVmYXVsdCB7XG4gIC8vIGZpcmVkIGJlZm9yZSBNZWRpYVNvdXJjZSBpcyBhdHRhY2hpbmcgdG8gbWVkaWEgZWxlbWVudCAtIGRhdGE6IHsgbWVkaWEgfVxuICBNRURJQV9BVFRBQ0hJTkc6ICdobHNNZWRpYUF0dGFjaGluZycsXG4gIC8vIGZpcmVkIHdoZW4gTWVkaWFTb3VyY2UgaGFzIGJlZW4gc3VjY2VzZnVsbHkgYXR0YWNoZWQgdG8gbWVkaWEgZWxlbWVudCAtIGRhdGE6IHsgfVxuICBNRURJQV9BVFRBQ0hFRDogJ2hsc01lZGlhQXR0YWNoZWQnLFxuICAvLyBmaXJlZCBiZWZvcmUgZGV0YWNoaW5nIE1lZGlhU291cmNlIGZyb20gbWVkaWEgZWxlbWVudCAtIGRhdGE6IHsgfVxuICBNRURJQV9ERVRBQ0hJTkc6ICdobHNNZWRpYURldGFjaGluZycsXG4gIC8vIGZpcmVkIHdoZW4gTWVkaWFTb3VyY2UgaGFzIGJlZW4gZGV0YWNoZWQgZnJvbSBtZWRpYSBlbGVtZW50IC0gZGF0YTogeyB9XG4gIE1FRElBX0RFVEFDSEVEOiAnaGxzTWVkaWFEZXRhY2hlZCcsXG4gIC8vIGZpcmVkIHRvIHNpZ25hbCB0aGF0IGEgbWFuaWZlc3QgbG9hZGluZyBzdGFydHMgLSBkYXRhOiB7IHVybCA6IG1hbmlmZXN0VVJMfVxuICBNQU5JRkVTVF9MT0FESU5HOiAnaGxzTWFuaWZlc3RMb2FkaW5nJyxcbiAgLy8gZmlyZWQgYWZ0ZXIgbWFuaWZlc3QgaGFzIGJlZW4gbG9hZGVkIC0gZGF0YTogeyBsZXZlbHMgOiBbYXZhaWxhYmxlIHF1YWxpdHkgbGV2ZWxzXSAsIHVybCA6IG1hbmlmZXN0VVJMLCBzdGF0cyA6IHsgdHJlcXVlc3QsIHRmaXJzdCwgdGxvYWQsIG10aW1lfX1cbiAgTUFOSUZFU1RfTE9BREVEOiAnaGxzTWFuaWZlc3RMb2FkZWQnLFxuICAvLyBmaXJlZCBhZnRlciBtYW5pZmVzdCBoYXMgYmVlbiBwYXJzZWQgLSBkYXRhOiB7IGxldmVscyA6IFthdmFpbGFibGUgcXVhbGl0eSBsZXZlbHNdICwgZmlyc3RMZXZlbCA6IGluZGV4IG9mIGZpcnN0IHF1YWxpdHkgbGV2ZWwgYXBwZWFyaW5nIGluIE1hbmlmZXN0fVxuICBNQU5JRkVTVF9QQVJTRUQ6ICdobHNNYW5pZmVzdFBhcnNlZCcsXG4gIC8vIGZpcmVkIHdoZW4gYSBsZXZlbCBwbGF5bGlzdCBsb2FkaW5nIHN0YXJ0cyAtIGRhdGE6IHsgdXJsIDogbGV2ZWwgVVJMICBsZXZlbCA6IGlkIG9mIGxldmVsIGJlaW5nIGxvYWRlZH1cbiAgTEVWRUxfTE9BRElORzogJ2hsc0xldmVsTG9hZGluZycsXG4gIC8vIGZpcmVkIHdoZW4gYSBsZXZlbCBwbGF5bGlzdCBsb2FkaW5nIGZpbmlzaGVzIC0gZGF0YTogeyBkZXRhaWxzIDogbGV2ZWxEZXRhaWxzIG9iamVjdCwgbGV2ZWwgOiBpZCBvZiBsb2FkZWQgbGV2ZWwsIHN0YXRzIDogeyB0cmVxdWVzdCwgdGZpcnN0LCB0bG9hZCwgbXRpbWV9IH1cbiAgTEVWRUxfTE9BREVEOiAnaGxzTGV2ZWxMb2FkZWQnLFxuICAvLyBmaXJlZCB3aGVuIGEgbGV2ZWwncyBkZXRhaWxzIGhhdmUgYmVlbiB1cGRhdGVkIGJhc2VkIG9uIHByZXZpb3VzIGRldGFpbHMsIGFmdGVyIGl0IGhhcyBiZWVuIGxvYWRlZC4gLSBkYXRhOiB7IGRldGFpbHMgOiBsZXZlbERldGFpbHMgb2JqZWN0LCBsZXZlbCA6IGlkIG9mIHVwZGF0ZWQgbGV2ZWwgfVxuICBMRVZFTF9VUERBVEVEOiAnaGxzTGV2ZWxVcGRhdGVkJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGxldmVsJ3MgUFRTIGluZm9ybWF0aW9uIGhhcyBiZWVuIHVwZGF0ZWQgYWZ0ZXIgcGFyc2luZyBhIGZyYWdtZW50IC0gZGF0YTogeyBkZXRhaWxzIDogbGV2ZWxEZXRhaWxzIG9iamVjdCwgbGV2ZWwgOiBpZCBvZiB1cGRhdGVkIGxldmVsLCBkcmlmdDogUFRTIGRyaWZ0IG9ic2VydmVkIHdoZW4gcGFyc2luZyBsYXN0IGZyYWdtZW50IH1cbiAgTEVWRUxfUFRTX1VQREFURUQ6ICdobHNQVFNVcGRhdGVkJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGxldmVsIHN3aXRjaCBpcyByZXF1ZXN0ZWQgLSBkYXRhOiB7IGxldmVsIDogaWQgb2YgbmV3IGxldmVsIH1cbiAgTEVWRUxfU1dJVENIOiAnaGxzTGV2ZWxTd2l0Y2gnLFxuICAvLyBmaXJlZCB3aGVuIGEgZnJhZ21lbnQgbG9hZGluZyBzdGFydHMgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3R9XG4gIEZSQUdfTE9BRElORzogJ2hsc0ZyYWdMb2FkaW5nJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGZyYWdtZW50IGxvYWRpbmcgaXMgcHJvZ3Jlc3NpbmcgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QsIHsgdHJlcXVlc3QsIHRmaXJzdCwgbG9hZGVkfX1cbiAgRlJBR19MT0FEX1BST0dSRVNTOiAnaGxzRnJhZ0xvYWRQcm9ncmVzcycsXG4gIC8vIElkZW50aWZpZXIgZm9yIGZyYWdtZW50IGxvYWQgYWJvcnRpbmcgZm9yIGVtZXJnZW5jeSBzd2l0Y2ggZG93biAtIGRhdGE6IHtmcmFnIDogZnJhZ21lbnQgb2JqZWN0fVxuICBGUkFHX0xPQURfRU1FUkdFTkNZX0FCT1JURUQ6ICdobHNGcmFnTG9hZEVtZXJnZW5jeUFib3J0ZWQnLFxuICAvLyBmaXJlZCB3aGVuIGEgZnJhZ21lbnQgbG9hZGluZyBpcyBjb21wbGV0ZWQgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QsIHBheWxvYWQgOiBmcmFnbWVudCBwYXlsb2FkLCBzdGF0cyA6IHsgdHJlcXVlc3QsIHRmaXJzdCwgdGxvYWQsIGxlbmd0aH19XG4gIEZSQUdfTE9BREVEOiAnaGxzRnJhZ0xvYWRlZCcsXG4gIC8vIGZpcmVkIHdoZW4gSW5pdCBTZWdtZW50IGhhcyBiZWVuIGV4dHJhY3RlZCBmcm9tIGZyYWdtZW50IC0gZGF0YTogeyBtb292IDogbW9vdiBNUDQgYm94LCBjb2RlY3MgOiBjb2RlY3MgZm91bmQgd2hpbGUgcGFyc2luZyBmcmFnbWVudH1cbiAgRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVDogJ2hsc0ZyYWdQYXJzaW5nSW5pdFNlZ21lbnQnLFxuICAvLyBmaXJlZCB3aGVuIHBhcnNpbmcgaWQzIGlzIGNvbXBsZXRlZCAtIGRhdGE6IHsgc2FtcGxlcyA6IFsgaWQzIHNhbXBsZXMgcGVzIF0gfVxuICBGUkFHX1BBUlNJTkdfTUVUQURBVEE6ICdobHNGcmFQYXJzaW5nTWV0YWRhdGEnLFxuICAvLyBmaXJlZCB3aGVuIG1vb2YvbWRhdCBoYXZlIGJlZW4gZXh0cmFjdGVkIGZyb20gZnJhZ21lbnQgLSBkYXRhOiB7IG1vb2YgOiBtb29mIE1QNCBib3gsIG1kYXQgOiBtZGF0IE1QNCBib3h9XG4gIEZSQUdfUEFSU0lOR19EQVRBOiAnaGxzRnJhZ1BhcnNpbmdEYXRhJyxcbiAgLy8gZmlyZWQgd2hlbiBmcmFnbWVudCBwYXJzaW5nIGlzIGNvbXBsZXRlZCAtIGRhdGE6IHVuZGVmaW5lZFxuICBGUkFHX1BBUlNFRDogJ2hsc0ZyYWdQYXJzZWQnLFxuICAvLyBmaXJlZCB3aGVuIGZyYWdtZW50IHJlbXV4ZWQgTVA0IGJveGVzIGhhdmUgYWxsIGJlZW4gYXBwZW5kZWQgaW50byBTb3VyY2VCdWZmZXIgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QsIHN0YXRzIDogeyB0cmVxdWVzdCwgdGZpcnN0LCB0bG9hZCwgdHBhcnNlZCwgdGJ1ZmZlcmVkLCBsZW5ndGh9IH1cbiAgRlJBR19CVUZGRVJFRDogJ2hsc0ZyYWdCdWZmZXJlZCcsXG4gIC8vIGZpcmVkIHdoZW4gZnJhZ21lbnQgbWF0Y2hpbmcgd2l0aCBjdXJyZW50IG1lZGlhIHBvc2l0aW9uIGlzIGNoYW5naW5nIC0gZGF0YSA6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdCB9XG4gIEZSQUdfQ0hBTkdFRDogJ2hsc0ZyYWdDaGFuZ2VkJyxcbiAgICAvLyBJZGVudGlmaWVyIGZvciBhIEZQUyBkcm9wIGV2ZW50IC0gZGF0YToge2N1cmVudERyb3BwZWQsIGN1cnJlbnREZWNvZGVkLCB0b3RhbERyb3BwZWRGcmFtZXN9XG4gIEZQU19EUk9QOiAnaGxzRlBTRHJvcCcsXG4gIC8vIElkZW50aWZpZXIgZm9yIGFuIGVycm9yIGV2ZW50IC0gZGF0YTogeyB0eXBlIDogZXJyb3IgdHlwZSwgZGV0YWlscyA6IGVycm9yIGRldGFpbHMsIGZhdGFsIDogaWYgdHJ1ZSwgaGxzLmpzIGNhbm5vdC93aWxsIG5vdCB0cnkgdG8gcmVjb3ZlciwgaWYgZmFsc2UsIGhscy5qcyB3aWxsIHRyeSB0byByZWNvdmVyLG90aGVyIGVycm9yIHNwZWNpZmljIGRhdGF9XG4gIEVSUk9SOiAnaGxzRXJyb3InLFxuICAvLyBmaXJlZCB3aGVuIGhscy5qcyBpbnN0YW5jZSBzdGFydHMgZGVzdHJveWluZy4gRGlmZmVyZW50IGZyb20gTUVESUFfREVUQUNIRUQgYXMgb25lIGNvdWxkIHdhbnQgdG8gZGV0YWNoIGFuZCByZWF0dGFjaCBhIG1lZGlhIHRvIHRoZSBpbnN0YW5jZSBvZiBobHMuanMgdG8gaGFuZGxlIG1pZC1yb2xscyBmb3IgZXhhbXBsZVxuICBERVNUUk9ZSU5HOiAnaGxzRGVzdHJveWluZycsXG4gIC8vIGZpcmVkIHdoZW4gYSBkZWNyeXB0IGtleSBsb2FkaW5nIHN0YXJ0cyAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdH1cbiAgS0VZX0xPQURJTkc6ICdobHNLZXlMb2FkaW5nJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGRlY3J5cHQga2V5IGxvYWRpbmcgaXMgY29tcGxldGVkIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0LCBwYXlsb2FkIDoga2V5IHBheWxvYWQsIHN0YXRzIDogeyB0cmVxdWVzdCwgdGZpcnN0LCB0bG9hZCwgbGVuZ3RofX1cbiAgS0VZX0xPQURFRDogJ2hsc0tleUxvYWRlZCcsXG59O1xuIiwiLyoqXG4gKiBMZXZlbCBIZWxwZXIgY2xhc3MsIHByb3ZpZGluZyBtZXRob2RzIGRlYWxpbmcgd2l0aCBwbGF5bGlzdCBzbGlkaW5nIGFuZCBkcmlmdFxuKi9cblxuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5cbmNsYXNzIExldmVsSGVscGVyIHtcblxuICBzdGF0aWMgbWVyZ2VEZXRhaWxzKG9sZERldGFpbHMsbmV3RGV0YWlscykge1xuICAgIHZhciBzdGFydCA9IE1hdGgubWF4KG9sZERldGFpbHMuc3RhcnRTTixuZXdEZXRhaWxzLnN0YXJ0U04pLW5ld0RldGFpbHMuc3RhcnRTTixcbiAgICAgICAgZW5kID0gTWF0aC5taW4ob2xkRGV0YWlscy5lbmRTTixuZXdEZXRhaWxzLmVuZFNOKS1uZXdEZXRhaWxzLnN0YXJ0U04sXG4gICAgICAgIGRlbHRhID0gbmV3RGV0YWlscy5zdGFydFNOIC0gb2xkRGV0YWlscy5zdGFydFNOLFxuICAgICAgICBvbGRmcmFnbWVudHMgPSBvbGREZXRhaWxzLmZyYWdtZW50cyxcbiAgICAgICAgbmV3ZnJhZ21lbnRzID0gbmV3RGV0YWlscy5mcmFnbWVudHMsXG4gICAgICAgIGNjT2Zmc2V0ID0wLFxuICAgICAgICBQVFNGcmFnO1xuXG4gICAgLy8gY2hlY2sgaWYgb2xkL25ldyBwbGF5bGlzdHMgaGF2ZSBmcmFnbWVudHMgaW4gY29tbW9uXG4gICAgaWYgKCBlbmQgPCBzdGFydCkge1xuICAgICAgbmV3RGV0YWlscy5QVFNLbm93biA9IGZhbHNlO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvLyBsb29wIHRocm91Z2ggb3ZlcmxhcHBpbmcgU04gYW5kIHVwZGF0ZSBzdGFydFBUUyAsIGNjLCBhbmQgZHVyYXRpb24gaWYgYW55IGZvdW5kXG4gICAgZm9yKHZhciBpID0gc3RhcnQgOyBpIDw9IGVuZCA7IGkrKykge1xuICAgICAgdmFyIG9sZEZyYWcgPSBvbGRmcmFnbWVudHNbZGVsdGEraV0sXG4gICAgICAgICAgbmV3RnJhZyA9IG5ld2ZyYWdtZW50c1tpXTtcbiAgICAgIGNjT2Zmc2V0ID0gb2xkRnJhZy5jYyAtIG5ld0ZyYWcuY2M7XG4gICAgICBpZiAoIWlzTmFOKG9sZEZyYWcuc3RhcnRQVFMpKSB7XG4gICAgICAgIG5ld0ZyYWcuc3RhcnQgPSBuZXdGcmFnLnN0YXJ0UFRTID0gb2xkRnJhZy5zdGFydFBUUztcbiAgICAgICAgbmV3RnJhZy5lbmRQVFMgPSBvbGRGcmFnLmVuZFBUUztcbiAgICAgICAgbmV3RnJhZy5kdXJhdGlvbiA9IG9sZEZyYWcuZHVyYXRpb247XG4gICAgICAgIFBUU0ZyYWcgPSBuZXdGcmFnO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmKGNjT2Zmc2V0KSB7XG4gICAgICBsb2dnZXIubG9nKGBkaXNjb250aW51aXR5IHNsaWRpbmcgZnJvbSBwbGF5bGlzdCwgdGFrZSBkcmlmdCBpbnRvIGFjY291bnRgKTtcbiAgICAgIGZvcihpID0gMCA7IGkgPCBuZXdmcmFnbWVudHMubGVuZ3RoIDsgaSsrKSB7XG4gICAgICAgIG5ld2ZyYWdtZW50c1tpXS5jYyArPSBjY09mZnNldDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBpZiBhdCBsZWFzdCBvbmUgZnJhZ21lbnQgY29udGFpbnMgUFRTIGluZm8sIHJlY29tcHV0ZSBQVFMgaW5mb3JtYXRpb24gZm9yIGFsbCBmcmFnbWVudHNcbiAgICBpZihQVFNGcmFnKSB7XG4gICAgICBMZXZlbEhlbHBlci51cGRhdGVGcmFnUFRTKG5ld0RldGFpbHMsUFRTRnJhZy5zbixQVFNGcmFnLnN0YXJ0UFRTLFBUU0ZyYWcuZW5kUFRTKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gYWRqdXN0IHN0YXJ0IGJ5IHNsaWRpbmcgb2Zmc2V0XG4gICAgICB2YXIgc2xpZGluZyA9IG9sZGZyYWdtZW50c1tkZWx0YV0uc3RhcnQ7XG4gICAgICBmb3IoaSA9IDAgOyBpIDwgbmV3ZnJhZ21lbnRzLmxlbmd0aCA7IGkrKykge1xuICAgICAgICBuZXdmcmFnbWVudHNbaV0uc3RhcnQgKz0gc2xpZGluZztcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gaWYgd2UgYXJlIGhlcmUsIGl0IG1lYW5zIHdlIGhhdmUgZnJhZ21lbnRzIG92ZXJsYXBwaW5nIGJldHdlZW5cbiAgICAvLyBvbGQgYW5kIG5ldyBsZXZlbC4gcmVsaWFibGUgUFRTIGluZm8gaXMgdGh1cyByZWx5aW5nIG9uIG9sZCBsZXZlbFxuICAgIG5ld0RldGFpbHMuUFRTS25vd24gPSBvbGREZXRhaWxzLlBUU0tub3duO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHN0YXRpYyB1cGRhdGVGcmFnUFRTKGRldGFpbHMsc24sc3RhcnRQVFMsZW5kUFRTKSB7XG4gICAgdmFyIGZyYWdJZHgsIGZyYWdtZW50cywgZnJhZywgaTtcbiAgICAvLyBleGl0IGlmIHNuIG91dCBvZiByYW5nZVxuICAgIGlmIChzbiA8IGRldGFpbHMuc3RhcnRTTiB8fCBzbiA+IGRldGFpbHMuZW5kU04pIHtcbiAgICAgIHJldHVybiAwO1xuICAgIH1cbiAgICBmcmFnSWR4ID0gc24gLSBkZXRhaWxzLnN0YXJ0U047XG4gICAgZnJhZ21lbnRzID0gZGV0YWlscy5mcmFnbWVudHM7XG4gICAgZnJhZyA9IGZyYWdtZW50c1tmcmFnSWR4XTtcbiAgICBpZighaXNOYU4oZnJhZy5zdGFydFBUUykpIHtcbiAgICAgIHN0YXJ0UFRTID0gTWF0aC5taW4oc3RhcnRQVFMsZnJhZy5zdGFydFBUUyk7XG4gICAgICBlbmRQVFMgPSBNYXRoLm1heChlbmRQVFMsIGZyYWcuZW5kUFRTKTtcbiAgICB9XG5cbiAgICB2YXIgZHJpZnQgPSBzdGFydFBUUyAtIGZyYWcuc3RhcnQ7XG5cbiAgICBmcmFnLnN0YXJ0ID0gZnJhZy5zdGFydFBUUyA9IHN0YXJ0UFRTO1xuICAgIGZyYWcuZW5kUFRTID0gZW5kUFRTO1xuICAgIGZyYWcuZHVyYXRpb24gPSBlbmRQVFMgLSBzdGFydFBUUztcbiAgICAvLyBhZGp1c3QgZnJhZ21lbnQgUFRTL2R1cmF0aW9uIGZyb20gc2VxbnVtLTEgdG8gZnJhZyAwXG4gICAgZm9yKGkgPSBmcmFnSWR4IDsgaSA+IDAgOyBpLS0pIHtcbiAgICAgIExldmVsSGVscGVyLnVwZGF0ZVBUUyhmcmFnbWVudHMsaSxpLTEpO1xuICAgIH1cblxuICAgIC8vIGFkanVzdCBmcmFnbWVudCBQVFMvZHVyYXRpb24gZnJvbSBzZXFudW0gdG8gbGFzdCBmcmFnXG4gICAgZm9yKGkgPSBmcmFnSWR4IDsgaSA8IGZyYWdtZW50cy5sZW5ndGggLSAxIDsgaSsrKSB7XG4gICAgICBMZXZlbEhlbHBlci51cGRhdGVQVFMoZnJhZ21lbnRzLGksaSsxKTtcbiAgICB9XG4gICAgZGV0YWlscy5QVFNLbm93biA9IHRydWU7XG4gICAgLy9sb2dnZXIubG9nKGAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyYWcgc3RhcnQvZW5kOiR7c3RhcnRQVFMudG9GaXhlZCgzKX0vJHtlbmRQVFMudG9GaXhlZCgzKX1gKTtcblxuICAgIHJldHVybiBkcmlmdDtcbiAgfVxuXG4gIHN0YXRpYyB1cGRhdGVQVFMoZnJhZ21lbnRzLGZyb21JZHgsIHRvSWR4KSB7XG4gICAgdmFyIGZyYWdGcm9tID0gZnJhZ21lbnRzW2Zyb21JZHhdLGZyYWdUbyA9IGZyYWdtZW50c1t0b0lkeF0sIGZyYWdUb1BUUyA9IGZyYWdUby5zdGFydFBUUztcbiAgICAvLyBpZiB3ZSBrbm93IHN0YXJ0UFRTW3RvSWR4XVxuICAgIGlmKCFpc05hTihmcmFnVG9QVFMpKSB7XG4gICAgICAvLyB1cGRhdGUgZnJhZ21lbnQgZHVyYXRpb24uXG4gICAgICAvLyBpdCBoZWxwcyB0byBmaXggZHJpZnRzIGJldHdlZW4gcGxheWxpc3QgcmVwb3J0ZWQgZHVyYXRpb24gYW5kIGZyYWdtZW50IHJlYWwgZHVyYXRpb25cbiAgICAgIGlmICh0b0lkeCA+IGZyb21JZHgpIHtcbiAgICAgICAgZnJhZ0Zyb20uZHVyYXRpb24gPSBmcmFnVG9QVFMtZnJhZ0Zyb20uc3RhcnQ7XG4gICAgICAgIGlmKGZyYWdGcm9tLmR1cmF0aW9uIDwgMCkge1xuICAgICAgICAgIGxvZ2dlci5lcnJvcihgbmVnYXRpdmUgZHVyYXRpb24gY29tcHV0ZWQgZm9yIGZyYWcgJHtmcmFnRnJvbS5zbn0sbGV2ZWwgJHtmcmFnRnJvbS5sZXZlbH0sIHRoZXJlIHNob3VsZCBiZSBzb21lIGR1cmF0aW9uIGRyaWZ0IGJldHdlZW4gcGxheWxpc3QgYW5kIGZyYWdtZW50IWApO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmcmFnVG8uZHVyYXRpb24gPSBmcmFnRnJvbS5zdGFydCAtIGZyYWdUb1BUUztcbiAgICAgICAgaWYoZnJhZ1RvLmR1cmF0aW9uIDwgMCkge1xuICAgICAgICAgIGxvZ2dlci5lcnJvcihgbmVnYXRpdmUgZHVyYXRpb24gY29tcHV0ZWQgZm9yIGZyYWcgJHtmcmFnVG8uc259LGxldmVsICR7ZnJhZ1RvLmxldmVsfSwgdGhlcmUgc2hvdWxkIGJlIHNvbWUgZHVyYXRpb24gZHJpZnQgYmV0d2VlbiBwbGF5bGlzdCBhbmQgZnJhZ21lbnQhYCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gd2UgZG9udCBrbm93IHN0YXJ0UFRTW3RvSWR4XVxuICAgICAgaWYgKHRvSWR4ID4gZnJvbUlkeCkge1xuICAgICAgICBmcmFnVG8uc3RhcnQgPSBmcmFnRnJvbS5zdGFydCArIGZyYWdGcm9tLmR1cmF0aW9uO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZnJhZ1RvLnN0YXJ0ID0gZnJhZ0Zyb20uc3RhcnQgLSBmcmFnVG8uZHVyYXRpb247XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IExldmVsSGVscGVyO1xuIiwiLyoqXG4gKiBITFMgaW50ZXJmYWNlXG4gKi9cbid1c2Ugc3RyaWN0JztcblxuaW1wb3J0IEV2ZW50IGZyb20gJy4vZXZlbnRzJztcbmltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuL2Vycm9ycyc7XG5pbXBvcnQgUGxheWxpc3RMb2FkZXIgZnJvbSAnLi9sb2FkZXIvcGxheWxpc3QtbG9hZGVyJztcbmltcG9ydCBGcmFnbWVudExvYWRlciBmcm9tICcuL2xvYWRlci9mcmFnbWVudC1sb2FkZXInO1xuaW1wb3J0IEFickNvbnRyb2xsZXIgZnJvbSAgICAnLi9jb250cm9sbGVyL2Fici1jb250cm9sbGVyJztcbmltcG9ydCBNU0VNZWRpYUNvbnRyb2xsZXIgZnJvbSAnLi9jb250cm9sbGVyL21zZS1tZWRpYS1jb250cm9sbGVyJztcbmltcG9ydCBMZXZlbENvbnRyb2xsZXIgZnJvbSAgJy4vY29udHJvbGxlci9sZXZlbC1jb250cm9sbGVyJztcbi8vaW1wb3J0IEZQU0NvbnRyb2xsZXIgZnJvbSAnLi9jb250cm9sbGVyL2Zwcy1jb250cm9sbGVyJztcbmltcG9ydCB7bG9nZ2VyLCBlbmFibGVMb2dzfSBmcm9tICcuL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQgWGhyTG9hZGVyIGZyb20gJy4vdXRpbHMveGhyLWxvYWRlcic7XG5pbXBvcnQgRXZlbnRFbWl0dGVyIGZyb20gJ2V2ZW50cyc7XG5pbXBvcnQgS2V5TG9hZGVyIGZyb20gJy4vbG9hZGVyL2tleS1sb2FkZXInO1xuXG5jbGFzcyBIbHMge1xuXG4gIHN0YXRpYyBpc1N1cHBvcnRlZCgpIHtcbiAgICByZXR1cm4gKHdpbmRvdy5NZWRpYVNvdXJjZSAmJiB3aW5kb3cuTWVkaWFTb3VyY2UuaXNUeXBlU3VwcG9ydGVkKCd2aWRlby9tcDQ7IGNvZGVjcz1cImF2YzEuNDJFMDFFLG1wNGEuNDAuMlwiJykpO1xuICB9XG5cbiAgc3RhdGljIGdldCBFdmVudHMoKSB7XG4gICAgcmV0dXJuIEV2ZW50O1xuICB9XG5cbiAgc3RhdGljIGdldCBFcnJvclR5cGVzKCkge1xuICAgIHJldHVybiBFcnJvclR5cGVzO1xuICB9XG5cbiAgc3RhdGljIGdldCBFcnJvckRldGFpbHMoKSB7XG4gICAgcmV0dXJuIEVycm9yRGV0YWlscztcbiAgfVxuXG4gIHN0YXRpYyBnZXQgRGVmYXVsdENvbmZpZygpIHtcbiAgICBpZighSGxzLmRlZmF1bHRDb25maWcpIHtcbiAgICAgICBIbHMuZGVmYXVsdENvbmZpZyA9IHtcbiAgICAgICAgICBhdXRvU3RhcnRMb2FkOiB0cnVlLFxuICAgICAgICAgIGRlYnVnOiBmYWxzZSxcbiAgICAgICAgICBtYXhCdWZmZXJMZW5ndGg6IDMwLFxuICAgICAgICAgIG1heEJ1ZmZlclNpemU6IDYwICogMTAwMCAqIDEwMDAsXG4gICAgICAgICAgbGl2ZVN5bmNEdXJhdGlvbkNvdW50OjMsXG4gICAgICAgICAgbGl2ZU1heExhdGVuY3lEdXJhdGlvbkNvdW50OiBJbmZpbml0eSxcbiAgICAgICAgICBtYXhNYXhCdWZmZXJMZW5ndGg6IDYwMCxcbiAgICAgICAgICBlbmFibGVXb3JrZXI6IHRydWUsXG4gICAgICAgICAgZW5hYmxlU29mdHdhcmVBRVM6IHRydWUsXG4gICAgICAgICAgbWFuaWZlc3RMb2FkaW5nVGltZU91dDogMTAwMDAsXG4gICAgICAgICAgbWFuaWZlc3RMb2FkaW5nTWF4UmV0cnk6IDEsXG4gICAgICAgICAgbWFuaWZlc3RMb2FkaW5nUmV0cnlEZWxheTogMTAwMCxcbiAgICAgICAgICBsZXZlbExvYWRpbmdUaW1lT3V0OiAxMDAwMCxcbiAgICAgICAgICBsZXZlbExvYWRpbmdNYXhSZXRyeTogNCxcbiAgICAgICAgICBsZXZlbExvYWRpbmdSZXRyeURlbGF5OiAxMDAwLFxuICAgICAgICAgIGZyYWdMb2FkaW5nVGltZU91dDogMjAwMDAsXG4gICAgICAgICAgZnJhZ0xvYWRpbmdNYXhSZXRyeTogNixcbiAgICAgICAgICBmcmFnTG9hZGluZ1JldHJ5RGVsYXk6IDEwMDAsXG4gICAgICAgICAgZnJhZ0xvYWRpbmdMb29wVGhyZXNob2xkOiAzLFxuICAgICAgICAgIC8vIGZwc0Ryb3BwZWRNb25pdG9yaW5nUGVyaW9kOiA1MDAwLFxuICAgICAgICAgIC8vIGZwc0Ryb3BwZWRNb25pdG9yaW5nVGhyZXNob2xkOiAwLjIsXG4gICAgICAgICAgYXBwZW5kRXJyb3JNYXhSZXRyeTogMyxcbiAgICAgICAgICBsb2FkZXI6IFhockxvYWRlcixcbiAgICAgICAgICBmTG9hZGVyOiB1bmRlZmluZWQsXG4gICAgICAgICAgcExvYWRlcjogdW5kZWZpbmVkLFxuICAgICAgICAgIGFickNvbnRyb2xsZXIgOiBBYnJDb250cm9sbGVyLFxuICAgICAgICAgIG1lZGlhQ29udHJvbGxlcjogTVNFTWVkaWFDb250cm9sbGVyXG4gICAgICAgIH07XG4gICAgfVxuICAgIHJldHVybiBIbHMuZGVmYXVsdENvbmZpZztcbiAgfVxuXG4gIHN0YXRpYyBzZXQgRGVmYXVsdENvbmZpZyhkZWZhdWx0Q29uZmlnKSB7XG4gICAgSGxzLmRlZmF1bHRDb25maWcgPSBkZWZhdWx0Q29uZmlnO1xuICB9XG5cbiAgY29uc3RydWN0b3IoY29uZmlnID0ge30pIHtcbiAgICB2YXIgZGVmYXVsdENvbmZpZyA9IEhscy5EZWZhdWx0Q29uZmlnO1xuICAgIGZvciAodmFyIHByb3AgaW4gZGVmYXVsdENvbmZpZykge1xuICAgICAgICBpZiAocHJvcCBpbiBjb25maWcpIHsgY29udGludWU7IH1cbiAgICAgICAgY29uZmlnW3Byb3BdID0gZGVmYXVsdENvbmZpZ1twcm9wXTtcbiAgICB9XG5cbiAgICBpZiAoY29uZmlnLmxpdmVNYXhMYXRlbmN5RHVyYXRpb25Db3VudCAhPT0gdW5kZWZpbmVkICYmIGNvbmZpZy5saXZlTWF4TGF0ZW5jeUR1cmF0aW9uQ291bnQgPD0gY29uZmlnLmxpdmVTeW5jRHVyYXRpb25Db3VudCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbGxlZ2FsIGhscy5qcyBjb25maWc6IFwibGl2ZU1heExhdGVuY3lEdXJhdGlvbkNvdW50XCIgbXVzdCBiZSBndCBcImxpdmVTeW5jRHVyYXRpb25Db3VudFwiJyk7XG4gICAgfVxuXG4gICAgZW5hYmxlTG9ncyhjb25maWcuZGVidWcpO1xuICAgIHRoaXMuY29uZmlnID0gY29uZmlnO1xuICAgIC8vIG9ic2VydmVyIHNldHVwXG4gICAgdmFyIG9ic2VydmVyID0gdGhpcy5vYnNlcnZlciA9IG5ldyBFdmVudEVtaXR0ZXIoKTtcbiAgICBvYnNlcnZlci50cmlnZ2VyID0gZnVuY3Rpb24gdHJpZ2dlciAoZXZlbnQsIC4uLmRhdGEpIHtcbiAgICAgIG9ic2VydmVyLmVtaXQoZXZlbnQsIGV2ZW50LCAuLi5kYXRhKTtcbiAgICB9O1xuXG4gICAgb2JzZXJ2ZXIub2ZmID0gZnVuY3Rpb24gb2ZmIChldmVudCwgLi4uZGF0YSkge1xuICAgICAgb2JzZXJ2ZXIucmVtb3ZlTGlzdGVuZXIoZXZlbnQsIC4uLmRhdGEpO1xuICAgIH07XG4gICAgdGhpcy5vbiA9IG9ic2VydmVyLm9uLmJpbmQob2JzZXJ2ZXIpO1xuICAgIHRoaXMub2ZmID0gb2JzZXJ2ZXIub2ZmLmJpbmQob2JzZXJ2ZXIpO1xuICAgIHRoaXMudHJpZ2dlciA9IG9ic2VydmVyLnRyaWdnZXIuYmluZChvYnNlcnZlcik7XG4gICAgdGhpcy5wbGF5bGlzdExvYWRlciA9IG5ldyBQbGF5bGlzdExvYWRlcih0aGlzKTtcbiAgICB0aGlzLmZyYWdtZW50TG9hZGVyID0gbmV3IEZyYWdtZW50TG9hZGVyKHRoaXMpO1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyID0gbmV3IExldmVsQ29udHJvbGxlcih0aGlzKTtcbiAgICB0aGlzLmFickNvbnRyb2xsZXIgPSBuZXcgY29uZmlnLmFickNvbnRyb2xsZXIodGhpcyk7XG4gICAgdGhpcy5tZWRpYUNvbnRyb2xsZXIgPSBuZXcgY29uZmlnLm1lZGlhQ29udHJvbGxlcih0aGlzKTtcbiAgICB0aGlzLmtleUxvYWRlciA9IG5ldyBLZXlMb2FkZXIodGhpcyk7XG4gICAgLy90aGlzLmZwc0NvbnRyb2xsZXIgPSBuZXcgRlBTQ29udHJvbGxlcih0aGlzKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgbG9nZ2VyLmxvZygnZGVzdHJveScpO1xuICAgIHRoaXMudHJpZ2dlcihFdmVudC5ERVNUUk9ZSU5HKTtcbiAgICB0aGlzLmRldGFjaE1lZGlhKCk7XG4gICAgdGhpcy5wbGF5bGlzdExvYWRlci5kZXN0cm95KCk7XG4gICAgdGhpcy5mcmFnbWVudExvYWRlci5kZXN0cm95KCk7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIuZGVzdHJveSgpO1xuICAgIHRoaXMubWVkaWFDb250cm9sbGVyLmRlc3Ryb3koKTtcbiAgICB0aGlzLmtleUxvYWRlci5kZXN0cm95KCk7XG4gICAgLy90aGlzLmZwc0NvbnRyb2xsZXIuZGVzdHJveSgpO1xuICAgIHRoaXMudXJsID0gbnVsbDtcbiAgICB0aGlzLm9ic2VydmVyLnJlbW92ZUFsbExpc3RlbmVycygpO1xuICB9XG5cbiAgYXR0YWNoTWVkaWEobWVkaWEpIHtcbiAgICBsb2dnZXIubG9nKCdhdHRhY2hNZWRpYScpO1xuICAgIHRoaXMubWVkaWEgPSBtZWRpYTtcbiAgICB0aGlzLnRyaWdnZXIoRXZlbnQuTUVESUFfQVRUQUNISU5HLCB7bWVkaWE6IG1lZGlhfSk7XG4gIH1cblxuICBkZXRhY2hNZWRpYSgpIHtcbiAgICBsb2dnZXIubG9nKCdkZXRhY2hNZWRpYScpO1xuICAgIHRoaXMudHJpZ2dlcihFdmVudC5NRURJQV9ERVRBQ0hJTkcpO1xuICAgIHRoaXMubWVkaWEgPSBudWxsO1xuICB9XG5cbiAgbG9hZFNvdXJjZSh1cmwpIHtcbiAgICBsb2dnZXIubG9nKGBsb2FkU291cmNlOiR7dXJsfWApO1xuICAgIHRoaXMudXJsID0gdXJsO1xuICAgIC8vIHdoZW4gYXR0YWNoaW5nIHRvIGEgc291cmNlIFVSTCwgdHJpZ2dlciBhIHBsYXlsaXN0IGxvYWRcbiAgICB0aGlzLnRyaWdnZXIoRXZlbnQuTUFOSUZFU1RfTE9BRElORywge3VybDogdXJsfSk7XG4gIH1cblxuICBzdGFydExvYWQoKSB7XG4gICAgbG9nZ2VyLmxvZygnc3RhcnRMb2FkJyk7XG4gICAgdGhpcy5tZWRpYUNvbnRyb2xsZXIuc3RhcnRMb2FkKCk7XG4gIH1cblxuICBzd2FwQXVkaW9Db2RlYygpIHtcbiAgICBsb2dnZXIubG9nKCdzd2FwQXVkaW9Db2RlYycpO1xuICAgIHRoaXMubWVkaWFDb250cm9sbGVyLnN3YXBBdWRpb0NvZGVjKCk7XG4gIH1cblxuICByZWNvdmVyTWVkaWFFcnJvcigpIHtcbiAgICBsb2dnZXIubG9nKCdyZWNvdmVyTWVkaWFFcnJvcicpO1xuICAgIHZhciBtZWRpYSA9IHRoaXMubWVkaWE7XG4gICAgdGhpcy5kZXRhY2hNZWRpYSgpO1xuICAgIHRoaXMuYXR0YWNoTWVkaWEobWVkaWEpO1xuICB9XG5cbiAgLyoqIFJldHVybiBhbGwgcXVhbGl0eSBsZXZlbHMgKiovXG4gIGdldCBsZXZlbHMoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLmxldmVscztcbiAgfVxuXG4gIC8qKiBSZXR1cm4gY3VycmVudCBwbGF5YmFjayBxdWFsaXR5IGxldmVsICoqL1xuICBnZXQgY3VycmVudExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLm1lZGlhQ29udHJvbGxlci5jdXJyZW50TGV2ZWw7XG4gIH1cblxuICAvKiBzZXQgcXVhbGl0eSBsZXZlbCBpbW1lZGlhdGVseSAoLTEgZm9yIGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24pICovXG4gIHNldCBjdXJyZW50TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICBsb2dnZXIubG9nKGBzZXQgY3VycmVudExldmVsOiR7bmV3TGV2ZWx9YCk7XG4gICAgdGhpcy5sb2FkTGV2ZWwgPSBuZXdMZXZlbDtcbiAgICB0aGlzLm1lZGlhQ29udHJvbGxlci5pbW1lZGlhdGVMZXZlbFN3aXRjaCgpO1xuICB9XG5cbiAgLyoqIFJldHVybiBuZXh0IHBsYXliYWNrIHF1YWxpdHkgbGV2ZWwgKHF1YWxpdHkgbGV2ZWwgb2YgbmV4dCBmcmFnbWVudCkgKiovXG4gIGdldCBuZXh0TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubWVkaWFDb250cm9sbGVyLm5leHRMZXZlbDtcbiAgfVxuXG4gIC8qIHNldCBxdWFsaXR5IGxldmVsIGZvciBuZXh0IGZyYWdtZW50ICgtMSBmb3IgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbikgKi9cbiAgc2V0IG5leHRMZXZlbChuZXdMZXZlbCkge1xuICAgIGxvZ2dlci5sb2coYHNldCBuZXh0TGV2ZWw6JHtuZXdMZXZlbH1gKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5tYW51YWxMZXZlbCA9IG5ld0xldmVsO1xuICAgIHRoaXMubWVkaWFDb250cm9sbGVyLm5leHRMZXZlbFN3aXRjaCgpO1xuICB9XG5cbiAgLyoqIFJldHVybiB0aGUgcXVhbGl0eSBsZXZlbCBvZiBjdXJyZW50L2xhc3QgbG9hZGVkIGZyYWdtZW50ICoqL1xuICBnZXQgbG9hZExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLmxldmVsQ29udHJvbGxlci5sZXZlbDtcbiAgfVxuXG4gIC8qIHNldCBxdWFsaXR5IGxldmVsIGZvciBjdXJyZW50L25leHQgbG9hZGVkIGZyYWdtZW50ICgtMSBmb3IgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbikgKi9cbiAgc2V0IGxvYWRMZXZlbChuZXdMZXZlbCkge1xuICAgIGxvZ2dlci5sb2coYHNldCBsb2FkTGV2ZWw6JHtuZXdMZXZlbH1gKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5tYW51YWxMZXZlbCA9IG5ld0xldmVsO1xuICB9XG5cbiAgLyoqIFJldHVybiB0aGUgcXVhbGl0eSBsZXZlbCBvZiBuZXh0IGxvYWRlZCBmcmFnbWVudCAqKi9cbiAgZ2V0IG5leHRMb2FkTGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLm5leHRMb2FkTGV2ZWwoKTtcbiAgfVxuXG4gIC8qKiBzZXQgcXVhbGl0eSBsZXZlbCBvZiBuZXh0IGxvYWRlZCBmcmFnbWVudCAqKi9cbiAgc2V0IG5leHRMb2FkTGV2ZWwobGV2ZWwpIHtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5sZXZlbCA9IGxldmVsO1xuICB9XG5cbiAgLyoqIFJldHVybiBmaXJzdCBsZXZlbCAoaW5kZXggb2YgZmlyc3QgbGV2ZWwgcmVmZXJlbmNlZCBpbiBtYW5pZmVzdClcbiAgKiovXG4gIGdldCBmaXJzdExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLmxldmVsQ29udHJvbGxlci5maXJzdExldmVsO1xuICB9XG5cbiAgLyoqIHNldCBmaXJzdCBsZXZlbCAoaW5kZXggb2YgZmlyc3QgbGV2ZWwgcmVmZXJlbmNlZCBpbiBtYW5pZmVzdClcbiAgKiovXG4gIHNldCBmaXJzdExldmVsKG5ld0xldmVsKSB7XG4gICAgbG9nZ2VyLmxvZyhgc2V0IGZpcnN0TGV2ZWw6JHtuZXdMZXZlbH1gKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5maXJzdExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICAvKiogUmV0dXJuIHN0YXJ0IGxldmVsIChsZXZlbCBvZiBmaXJzdCBmcmFnbWVudCB0aGF0IHdpbGwgYmUgcGxheWVkIGJhY2spXG4gICAgICBpZiBub3Qgb3ZlcnJpZGVkIGJ5IHVzZXIsIGZpcnN0IGxldmVsIGFwcGVhcmluZyBpbiBtYW5pZmVzdCB3aWxsIGJlIHVzZWQgYXMgc3RhcnQgbGV2ZWxcbiAgICAgIGlmIC0xIDogYXV0b21hdGljIHN0YXJ0IGxldmVsIHNlbGVjdGlvbiwgcGxheWJhY2sgd2lsbCBzdGFydCBmcm9tIGxldmVsIG1hdGNoaW5nIGRvd25sb2FkIGJhbmR3aWR0aCAoZGV0ZXJtaW5lZCBmcm9tIGRvd25sb2FkIG9mIGZpcnN0IHNlZ21lbnQpXG4gICoqL1xuICBnZXQgc3RhcnRMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIuc3RhcnRMZXZlbDtcbiAgfVxuXG4gIC8qKiBzZXQgIHN0YXJ0IGxldmVsIChsZXZlbCBvZiBmaXJzdCBmcmFnbWVudCB0aGF0IHdpbGwgYmUgcGxheWVkIGJhY2spXG4gICAgICBpZiBub3Qgb3ZlcnJpZGVkIGJ5IHVzZXIsIGZpcnN0IGxldmVsIGFwcGVhcmluZyBpbiBtYW5pZmVzdCB3aWxsIGJlIHVzZWQgYXMgc3RhcnQgbGV2ZWxcbiAgICAgIGlmIC0xIDogYXV0b21hdGljIHN0YXJ0IGxldmVsIHNlbGVjdGlvbiwgcGxheWJhY2sgd2lsbCBzdGFydCBmcm9tIGxldmVsIG1hdGNoaW5nIGRvd25sb2FkIGJhbmR3aWR0aCAoZGV0ZXJtaW5lZCBmcm9tIGRvd25sb2FkIG9mIGZpcnN0IHNlZ21lbnQpXG4gICoqL1xuICBzZXQgc3RhcnRMZXZlbChuZXdMZXZlbCkge1xuICAgIGxvZ2dlci5sb2coYHNldCBzdGFydExldmVsOiR7bmV3TGV2ZWx9YCk7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIuc3RhcnRMZXZlbCA9IG5ld0xldmVsO1xuICB9XG5cbiAgLyoqIFJldHVybiB0aGUgY2FwcGluZy9tYXggbGV2ZWwgdmFsdWUgdGhhdCBjb3VsZCBiZSB1c2VkIGJ5IGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24gYWxnb3JpdGhtICoqL1xuICBnZXQgYXV0b0xldmVsQ2FwcGluZygpIHtcbiAgICByZXR1cm4gdGhpcy5hYnJDb250cm9sbGVyLmF1dG9MZXZlbENhcHBpbmc7XG4gIH1cblxuICAvKiogc2V0IHRoZSBjYXBwaW5nL21heCBsZXZlbCB2YWx1ZSB0aGF0IGNvdWxkIGJlIHVzZWQgYnkgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBhbGdvcml0aG0gKiovXG4gIHNldCBhdXRvTGV2ZWxDYXBwaW5nKG5ld0xldmVsKSB7XG4gICAgbG9nZ2VyLmxvZyhgc2V0IGF1dG9MZXZlbENhcHBpbmc6JHtuZXdMZXZlbH1gKTtcbiAgICB0aGlzLmFickNvbnRyb2xsZXIuYXV0b0xldmVsQ2FwcGluZyA9IG5ld0xldmVsO1xuICB9XG5cbiAgLyogY2hlY2sgaWYgd2UgYXJlIGluIGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24gbW9kZSAqL1xuICBnZXQgYXV0b0xldmVsRW5hYmxlZCgpIHtcbiAgICByZXR1cm4gKHRoaXMubGV2ZWxDb250cm9sbGVyLm1hbnVhbExldmVsID09PSAtMSk7XG4gIH1cblxuICAvKiByZXR1cm4gbWFudWFsIGxldmVsICovXG4gIGdldCBtYW51YWxMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIubWFudWFsTGV2ZWw7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgSGxzO1xuIiwiLypcbiAqIEZyYWdtZW50IExvYWRlclxuKi9cblxuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcblxuY2xhc3MgRnJhZ21lbnRMb2FkZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHRoaXMuaGxzID0gaGxzO1xuICAgIHRoaXMub25mbCA9IHRoaXMub25GcmFnTG9hZGluZy5iaW5kKHRoaXMpO1xuICAgIGhscy5vbihFdmVudC5GUkFHX0xPQURJTkcsIHRoaXMub25mbCk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIGlmICh0aGlzLmxvYWRlcikge1xuICAgICAgdGhpcy5sb2FkZXIuZGVzdHJveSgpO1xuICAgICAgdGhpcy5sb2FkZXIgPSBudWxsO1xuICAgIH1cbiAgICB0aGlzLmhscy5vZmYoRXZlbnQuRlJBR19MT0FESU5HLCB0aGlzLm9uZmwpO1xuICB9XG5cbiAgb25GcmFnTG9hZGluZyhldmVudCwgZGF0YSkge1xuICAgIHZhciBmcmFnID0gZGF0YS5mcmFnO1xuICAgIHRoaXMuZnJhZyA9IGZyYWc7XG4gICAgdGhpcy5mcmFnLmxvYWRlZCA9IDA7XG4gICAgdmFyIGNvbmZpZyA9IHRoaXMuaGxzLmNvbmZpZztcbiAgICBmcmFnLmxvYWRlciA9IHRoaXMubG9hZGVyID0gdHlwZW9mKGNvbmZpZy5mTG9hZGVyKSAhPT0gJ3VuZGVmaW5lZCcgPyBuZXcgY29uZmlnLmZMb2FkZXIoY29uZmlnKSA6IG5ldyBjb25maWcubG9hZGVyKGNvbmZpZyk7XG4gICAgdGhpcy5sb2FkZXIubG9hZChmcmFnLnVybCwgJ2FycmF5YnVmZmVyJywgdGhpcy5sb2Fkc3VjY2Vzcy5iaW5kKHRoaXMpLCB0aGlzLmxvYWRlcnJvci5iaW5kKHRoaXMpLCB0aGlzLmxvYWR0aW1lb3V0LmJpbmQodGhpcyksIGNvbmZpZy5mcmFnTG9hZGluZ1RpbWVPdXQsIDEsIDAsIHRoaXMubG9hZHByb2dyZXNzLmJpbmQodGhpcyksIGZyYWcpO1xuICB9XG5cbiAgbG9hZHN1Y2Nlc3MoZXZlbnQsIHN0YXRzKSB7XG4gICAgdmFyIHBheWxvYWQgPSBldmVudC5jdXJyZW50VGFyZ2V0LnJlc3BvbnNlO1xuICAgIHN0YXRzLmxlbmd0aCA9IHBheWxvYWQuYnl0ZUxlbmd0aDtcbiAgICAvLyBkZXRhY2ggZnJhZ21lbnQgbG9hZGVyIG9uIGxvYWQgc3VjY2Vzc1xuICAgIHRoaXMuZnJhZy5sb2FkZXIgPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5GUkFHX0xPQURFRCwge3BheWxvYWQ6IHBheWxvYWQsIGZyYWc6IHRoaXMuZnJhZywgc3RhdHM6IHN0YXRzfSk7XG4gIH1cblxuICBsb2FkZXJyb3IoZXZlbnQpIHtcbiAgICB0aGlzLmxvYWRlci5hYm9ydCgpO1xuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5GUkFHX0xPQURfRVJST1IsIGZhdGFsOiBmYWxzZSwgZnJhZzogdGhpcy5mcmFnLCByZXNwb25zZTogZXZlbnR9KTtcbiAgfVxuXG4gIGxvYWR0aW1lb3V0KCkge1xuICAgIHRoaXMubG9hZGVyLmFib3J0KCk7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTkVUV09SS19FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9USU1FT1VULCBmYXRhbDogZmFsc2UsIGZyYWc6IHRoaXMuZnJhZ30pO1xuICB9XG5cbiAgbG9hZHByb2dyZXNzKGV2ZW50LCBzdGF0cykge1xuICAgIHRoaXMuZnJhZy5sb2FkZWQgPSBzdGF0cy5sb2FkZWQ7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5GUkFHX0xPQURfUFJPR1JFU1MsIHtmcmFnOiB0aGlzLmZyYWcsIHN0YXRzOiBzdGF0c30pO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEZyYWdtZW50TG9hZGVyO1xuIiwiLypcbiAqIERlY3J5cHQga2V5IExvYWRlclxuKi9cblxuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcblxuY2xhc3MgS2V5TG9hZGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMpIHtcbiAgICB0aGlzLmhscyA9IGhscztcbiAgICB0aGlzLmRlY3J5cHRrZXkgPSBudWxsO1xuICAgIHRoaXMuZGVjcnlwdHVybCA9IG51bGw7XG4gICAgdGhpcy5vbmRrbCA9IHRoaXMub25EZWNyeXB0S2V5TG9hZGluZy5iaW5kKHRoaXMpO1xuICAgIGhscy5vbihFdmVudC5LRVlfTE9BRElORywgdGhpcy5vbmRrbCk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIGlmICh0aGlzLmxvYWRlcikge1xuICAgICAgdGhpcy5sb2FkZXIuZGVzdHJveSgpO1xuICAgICAgdGhpcy5sb2FkZXIgPSBudWxsO1xuICAgIH1cbiAgICB0aGlzLmhscy5vZmYoRXZlbnQuS0VZX0xPQURJTkcsIHRoaXMub25ka2wpO1xuICB9XG5cbiAgb25EZWNyeXB0S2V5TG9hZGluZyhldmVudCwgZGF0YSkge1xuICAgIHZhciBmcmFnID0gdGhpcy5mcmFnID0gZGF0YS5mcmFnLFxuICAgICAgICBkZWNyeXB0ZGF0YSA9IGZyYWcuZGVjcnlwdGRhdGEsXG4gICAgICAgIHVyaSA9IGRlY3J5cHRkYXRhLnVyaTtcbiAgICAgICAgLy8gaWYgdXJpIGlzIGRpZmZlcmVudCBmcm9tIHByZXZpb3VzIG9uZSBvciBpZiBkZWNyeXB0IGtleSBub3QgcmV0cmlldmVkIHlldFxuICAgICAgaWYgKHVyaSAhPT0gdGhpcy5kZWNyeXB0dXJsIHx8IHRoaXMuZGVjcnlwdGtleSA9PT0gbnVsbCkge1xuICAgICAgICB2YXIgY29uZmlnID0gdGhpcy5obHMuY29uZmlnO1xuICAgICAgICBmcmFnLmxvYWRlciA9IHRoaXMubG9hZGVyID0gbmV3IGNvbmZpZy5sb2FkZXIoY29uZmlnKTtcbiAgICAgICAgdGhpcy5kZWNyeXB0dXJsID0gdXJpO1xuICAgICAgICB0aGlzLmRlY3J5cHRrZXkgPSBudWxsO1xuICAgICAgICBmcmFnLmxvYWRlci5sb2FkKHVyaSwgJ2FycmF5YnVmZmVyJywgdGhpcy5sb2Fkc3VjY2Vzcy5iaW5kKHRoaXMpLCB0aGlzLmxvYWRlcnJvci5iaW5kKHRoaXMpLCB0aGlzLmxvYWR0aW1lb3V0LmJpbmQodGhpcyksIGNvbmZpZy5mcmFnTG9hZGluZ1RpbWVPdXQsIGNvbmZpZy5mcmFnTG9hZGluZ01heFJldHJ5LCBjb25maWcuZnJhZ0xvYWRpbmdSZXRyeURlbGF5LCB0aGlzLmxvYWRwcm9ncmVzcy5iaW5kKHRoaXMpLCBmcmFnKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5kZWNyeXB0a2V5KSB7XG4gICAgICAgIC8vIHdlIGFscmVhZHkgbG9hZGVkIHRoaXMga2V5LCByZXR1cm4gaXRcbiAgICAgICAgZGVjcnlwdGRhdGEua2V5ID0gdGhpcy5kZWNyeXB0a2V5O1xuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LktFWV9MT0FERUQsIHtmcmFnOiBmcmFnfSk7XG4gICAgICB9XG4gIH1cblxuICBsb2Fkc3VjY2VzcyhldmVudCkge1xuICAgIHZhciBmcmFnID0gdGhpcy5mcmFnO1xuICAgIHRoaXMuZGVjcnlwdGtleSA9IGZyYWcuZGVjcnlwdGRhdGEua2V5ID0gbmV3IFVpbnQ4QXJyYXkoZXZlbnQuY3VycmVudFRhcmdldC5yZXNwb25zZSk7XG4gICAgLy8gZGV0YWNoIGZyYWdtZW50IGxvYWRlciBvbiBsb2FkIHN1Y2Nlc3NcbiAgICBmcmFnLmxvYWRlciA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LktFWV9MT0FERUQsIHtmcmFnOiBmcmFnfSk7XG4gIH1cblxuICBsb2FkZXJyb3IoZXZlbnQpIHtcbiAgICB0aGlzLmxvYWRlci5hYm9ydCgpO1xuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5LRVlfTE9BRF9FUlJPUiwgZmF0YWw6IGZhbHNlLCBmcmFnOiB0aGlzLmZyYWcsIHJlc3BvbnNlOiBldmVudH0pO1xuICB9XG5cbiAgbG9hZHRpbWVvdXQoKSB7XG4gICAgdGhpcy5sb2FkZXIuYWJvcnQoKTtcbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5ORVRXT1JLX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuS0VZX0xPQURfVElNRU9VVCwgZmF0YWw6IGZhbHNlLCBmcmFnOiB0aGlzLmZyYWd9KTtcbiAgfVxuXG4gIGxvYWRwcm9ncmVzcygpIHtcblxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEtleUxvYWRlcjtcbiIsIi8qKlxuICogUGxheWxpc3QgTG9hZGVyXG4qL1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuaW1wb3J0IFVSTEhlbHBlciBmcm9tICcuLi91dGlscy91cmwnO1xuaW1wb3J0IEF0dHJMaXN0IGZyb20gJy4uL3V0aWxzL2F0dHItbGlzdCc7XG4vL2ltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG5jbGFzcyBQbGF5bGlzdExvYWRlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgdGhpcy5obHMgPSBobHM7XG4gICAgdGhpcy5vbm1sID0gdGhpcy5vbk1hbmlmZXN0TG9hZGluZy5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25sbCA9IHRoaXMub25MZXZlbExvYWRpbmcuYmluZCh0aGlzKTtcbiAgICBobHMub24oRXZlbnQuTUFOSUZFU1RfTE9BRElORywgdGhpcy5vbm1sKTtcbiAgICBobHMub24oRXZlbnQuTEVWRUxfTE9BRElORywgdGhpcy5vbmxsKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgaWYgKHRoaXMubG9hZGVyKSB7XG4gICAgICB0aGlzLmxvYWRlci5kZXN0cm95KCk7XG4gICAgICB0aGlzLmxvYWRlciA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMudXJsID0gdGhpcy5pZCA9IG51bGw7XG4gICAgdGhpcy5obHMub2ZmKEV2ZW50Lk1BTklGRVNUX0xPQURJTkcsIHRoaXMub25tbCk7XG4gICAgdGhpcy5obHMub2ZmKEV2ZW50LkxFVkVMX0xPQURJTkcsIHRoaXMub25sbCk7XG4gIH1cblxuICBvbk1hbmlmZXN0TG9hZGluZyhldmVudCwgZGF0YSkge1xuICAgIHRoaXMubG9hZChkYXRhLnVybCwgbnVsbCk7XG4gIH1cblxuICBvbkxldmVsTG9hZGluZyhldmVudCwgZGF0YSkge1xuICAgIHRoaXMubG9hZChkYXRhLnVybCwgZGF0YS5sZXZlbCwgZGF0YS5pZCk7XG4gIH1cblxuICBsb2FkKHVybCwgaWQxLCBpZDIpIHtcbiAgICB2YXIgY29uZmlnID0gdGhpcy5obHMuY29uZmlnLFxuICAgICAgICByZXRyeSxcbiAgICAgICAgdGltZW91dCxcbiAgICAgICAgcmV0cnlEZWxheTtcbiAgICB0aGlzLnVybCA9IHVybDtcbiAgICB0aGlzLmlkID0gaWQxO1xuICAgIHRoaXMuaWQyID0gaWQyO1xuICAgIGlmKHRoaXMuaWQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0cnkgPSBjb25maWcubWFuaWZlc3RMb2FkaW5nTWF4UmV0cnk7XG4gICAgICB0aW1lb3V0ID0gY29uZmlnLm1hbmlmZXN0TG9hZGluZ1RpbWVPdXQ7XG4gICAgICByZXRyeURlbGF5ID0gY29uZmlnLm1hbmlmZXN0TG9hZGluZ1JldHJ5RGVsYXk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHJ5ID0gY29uZmlnLmxldmVsTG9hZGluZ01heFJldHJ5O1xuICAgICAgdGltZW91dCA9IGNvbmZpZy5sZXZlbExvYWRpbmdUaW1lT3V0O1xuICAgICAgcmV0cnlEZWxheSA9IGNvbmZpZy5sZXZlbExvYWRpbmdSZXRyeURlbGF5O1xuICAgIH1cbiAgICB0aGlzLmxvYWRlciA9IHR5cGVvZihjb25maWcucExvYWRlcikgIT09ICd1bmRlZmluZWQnID8gbmV3IGNvbmZpZy5wTG9hZGVyKGNvbmZpZykgOiBuZXcgY29uZmlnLmxvYWRlcihjb25maWcpO1xuICAgIHRoaXMubG9hZGVyLmxvYWQodXJsLCAnJywgdGhpcy5sb2Fkc3VjY2Vzcy5iaW5kKHRoaXMpLCB0aGlzLmxvYWRlcnJvci5iaW5kKHRoaXMpLCB0aGlzLmxvYWR0aW1lb3V0LmJpbmQodGhpcyksIHRpbWVvdXQsIHJldHJ5LCByZXRyeURlbGF5KTtcbiAgfVxuXG4gIHJlc29sdmUodXJsLCBiYXNlVXJsKSB7XG4gICAgcmV0dXJuIFVSTEhlbHBlci5idWlsZEFic29sdXRlVVJMKGJhc2VVcmwsIHVybCk7XG4gIH1cblxuICBwYXJzZU1hc3RlclBsYXlsaXN0KHN0cmluZywgYmFzZXVybCkge1xuICAgIGxldCBsZXZlbHMgPSBbXSwgcmVzdWx0O1xuXG4gICAgLy8gaHR0cHM6Ly9yZWdleDEwMS5jb20gaXMgeW91ciBmcmllbmRcbiAgICBjb25zdCByZSA9IC8jRVhULVgtU1RSRUFNLUlORjooW15cXG5cXHJdKilbXFxyXFxuXSsoW15cXHJcXG5dKykvZztcbiAgICB3aGlsZSAoKHJlc3VsdCA9IHJlLmV4ZWMoc3RyaW5nKSkgIT0gbnVsbCl7XG4gICAgICBjb25zdCBsZXZlbCA9IHt9O1xuXG4gICAgICB2YXIgYXR0cnMgPSBsZXZlbC5hdHRycyA9IG5ldyBBdHRyTGlzdChyZXN1bHRbMV0pO1xuICAgICAgbGV2ZWwudXJsID0gdGhpcy5yZXNvbHZlKHJlc3VsdFsyXSwgYmFzZXVybCk7XG5cbiAgICAgIHZhciByZXNvbHV0aW9uID0gYXR0cnMuZGVjaW1hbFJlc29sdXRpb24oJ1JFU09MVVRJT04nKTtcbiAgICAgIGlmKHJlc29sdXRpb24pIHtcbiAgICAgICAgbGV2ZWwud2lkdGggPSByZXNvbHV0aW9uLndpZHRoO1xuICAgICAgICBsZXZlbC5oZWlnaHQgPSByZXNvbHV0aW9uLmhlaWdodDtcbiAgICAgIH1cbiAgICAgIGxldmVsLmJpdHJhdGUgPSBhdHRycy5kZWNpbWFsSW50ZWdlcignQkFORFdJRFRIJyk7XG4gICAgICBsZXZlbC5uYW1lID0gYXR0cnMuTkFNRTtcblxuICAgICAgdmFyIGNvZGVjcyA9IGF0dHJzLkNPREVDUztcbiAgICAgIGlmKGNvZGVjcykge1xuICAgICAgICBjb2RlY3MgPSBjb2RlY3Muc3BsaXQoJywnKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb2RlY3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBjb25zdCBjb2RlYyA9IGNvZGVjc1tpXTtcbiAgICAgICAgICBpZiAoY29kZWMuaW5kZXhPZignYXZjMScpICE9PSAtMSkge1xuICAgICAgICAgICAgbGV2ZWwudmlkZW9Db2RlYyA9IHRoaXMuYXZjMXRvYXZjb3RpKGNvZGVjKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGV2ZWwuYXVkaW9Db2RlYyA9IGNvZGVjO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBsZXZlbHMucHVzaChsZXZlbCk7XG4gICAgfVxuICAgIHJldHVybiBsZXZlbHM7XG4gIH1cblxuICBhdmMxdG9hdmNvdGkoY29kZWMpIHtcbiAgICB2YXIgcmVzdWx0LCBhdmNkYXRhID0gY29kZWMuc3BsaXQoJy4nKTtcbiAgICBpZiAoYXZjZGF0YS5sZW5ndGggPiAyKSB7XG4gICAgICByZXN1bHQgPSBhdmNkYXRhLnNoaWZ0KCkgKyAnLic7XG4gICAgICByZXN1bHQgKz0gcGFyc2VJbnQoYXZjZGF0YS5zaGlmdCgpKS50b1N0cmluZygxNik7XG4gICAgICByZXN1bHQgKz0gKCcwMDAnICsgcGFyc2VJbnQoYXZjZGF0YS5zaGlmdCgpKS50b1N0cmluZygxNikpLnN1YnN0cigtNCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdCA9IGNvZGVjO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgY2xvbmVPYmoob2JqKSB7XG4gICAgcmV0dXJuIEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkob2JqKSk7XG4gIH1cblxuICBwYXJzZUxldmVsUGxheWxpc3Qoc3RyaW5nLCBiYXNldXJsLCBpZCkge1xuICAgIHZhciBjdXJyZW50U04gPSAwLFxuICAgICAgICB0b3RhbGR1cmF0aW9uID0gMCxcbiAgICAgICAgbGV2ZWwgPSB7dXJsOiBiYXNldXJsLCBmcmFnbWVudHM6IFtdLCBsaXZlOiB0cnVlLCBzdGFydFNOOiAwfSxcbiAgICAgICAgbGV2ZWxrZXkgPSB7bWV0aG9kIDogbnVsbCwga2V5IDogbnVsbCwgaXYgOiBudWxsLCB1cmkgOiBudWxsfSxcbiAgICAgICAgY2MgPSAwLFxuICAgICAgICBwcm9ncmFtRGF0ZVRpbWUgPSBudWxsLFxuICAgICAgICBmcmFnID0gbnVsbCxcbiAgICAgICAgcmVzdWx0LFxuICAgICAgICByZWdleHAsXG4gICAgICAgIGJ5dGVSYW5nZUVuZE9mZnNldCxcbiAgICAgICAgYnl0ZVJhbmdlU3RhcnRPZmZzZXQ7XG5cbiAgICByZWdleHAgPSAvKD86I0VYVC1YLShNRURJQS1TRVFVRU5DRSk6KFxcZCspKXwoPzojRVhULVgtKFRBUkdFVERVUkFUSU9OKTooXFxkKykpfCg/OiNFWFQtWC0oS0VZKTooLiopKXwoPzojRVhUKElORik6KFtcXGRcXC5dKylbXlxcclxcbl0qKFtcXHJcXG5dK1teI3xcXHJcXG5dKyk/KXwoPzojRVhULVgtKEJZVEVSQU5HRSk6KFtcXGRdK1tAW1xcZF0qKV0qW1xcclxcbl0rKFteI3xcXHJcXG5dKyk/fCg/OiNFWFQtWC0oRU5ETElTVCkpfCg/OiNFWFQtWC0oRElTKUNPTlRJTlVJVFkpKXwoPzojRVhULVgtKFBST0dSQU0tREFURS1USU1FKTooLiopKS9nO1xuICAgIHdoaWxlICgocmVzdWx0ID0gcmVnZXhwLmV4ZWMoc3RyaW5nKSkgIT09IG51bGwpIHtcbiAgICAgIHJlc3VsdC5zaGlmdCgpO1xuICAgICAgcmVzdWx0ID0gcmVzdWx0LmZpbHRlcihmdW5jdGlvbihuKSB7IHJldHVybiAobiAhPT0gdW5kZWZpbmVkKTsgfSk7XG4gICAgICBzd2l0Y2ggKHJlc3VsdFswXSkge1xuICAgICAgICBjYXNlICdNRURJQS1TRVFVRU5DRSc6XG4gICAgICAgICAgY3VycmVudFNOID0gbGV2ZWwuc3RhcnRTTiA9IHBhcnNlSW50KHJlc3VsdFsxXSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ1RBUkdFVERVUkFUSU9OJzpcbiAgICAgICAgICBsZXZlbC50YXJnZXRkdXJhdGlvbiA9IHBhcnNlRmxvYXQocmVzdWx0WzFdKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnRU5ETElTVCc6XG4gICAgICAgICAgbGV2ZWwubGl2ZSA9IGZhbHNlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdESVMnOlxuICAgICAgICAgIGNjKys7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0JZVEVSQU5HRSc6XG4gICAgICAgICAgdmFyIHBhcmFtcyA9IHJlc3VsdFsxXS5zcGxpdCgnQCcpO1xuICAgICAgICAgIGlmIChwYXJhbXMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgICBieXRlUmFuZ2VTdGFydE9mZnNldCA9IGJ5dGVSYW5nZUVuZE9mZnNldDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYnl0ZVJhbmdlU3RhcnRPZmZzZXQgPSBwYXJzZUludChwYXJhbXNbMV0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBieXRlUmFuZ2VFbmRPZmZzZXQgPSBwYXJzZUludChwYXJhbXNbMF0pICsgYnl0ZVJhbmdlU3RhcnRPZmZzZXQ7XG4gICAgICAgICAgaWYgKGZyYWcgJiYgIWZyYWcudXJsKSB7XG4gICAgICAgICAgICBmcmFnLmJ5dGVSYW5nZVN0YXJ0T2Zmc2V0ID0gYnl0ZVJhbmdlU3RhcnRPZmZzZXQ7XG4gICAgICAgICAgICBmcmFnLmJ5dGVSYW5nZUVuZE9mZnNldCA9IGJ5dGVSYW5nZUVuZE9mZnNldDtcbiAgICAgICAgICAgIGZyYWcudXJsID0gdGhpcy5yZXNvbHZlKHJlc3VsdFsyXSwgYmFzZXVybCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdJTkYnOlxuICAgICAgICAgIHZhciBkdXJhdGlvbiA9IHBhcnNlRmxvYXQocmVzdWx0WzFdKTtcbiAgICAgICAgICBpZiAoIWlzTmFOKGR1cmF0aW9uKSkge1xuICAgICAgICAgICAgdmFyIGZyYWdkZWNyeXB0ZGF0YSxcbiAgICAgICAgICAgICAgICBzbiA9IGN1cnJlbnRTTisrO1xuICAgICAgICAgICAgaWYgKGxldmVsa2V5Lm1ldGhvZCAmJiBsZXZlbGtleS51cmkgJiYgIWxldmVsa2V5Lml2KSB7XG4gICAgICAgICAgICAgIGZyYWdkZWNyeXB0ZGF0YSA9IHRoaXMuY2xvbmVPYmoobGV2ZWxrZXkpO1xuICAgICAgICAgICAgICB2YXIgdWludDhWaWV3ID0gbmV3IFVpbnQ4QXJyYXkoMTYpO1xuICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMTI7IGkgPCAxNjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdWludDhWaWV3W2ldID0gKHNuID4+IDgqKDE1LWkpKSAmIDB4ZmY7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZnJhZ2RlY3J5cHRkYXRhLml2ID0gdWludDhWaWV3O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgZnJhZ2RlY3J5cHRkYXRhID0gbGV2ZWxrZXk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgdXJsID0gcmVzdWx0WzJdID8gdGhpcy5yZXNvbHZlKHJlc3VsdFsyXSwgYmFzZXVybCkgOiBudWxsO1xuICAgICAgICAgICAgZnJhZyA9IHt1cmw6IHVybCwgZHVyYXRpb246IGR1cmF0aW9uLCBzdGFydDogdG90YWxkdXJhdGlvbiwgc246IHNuLCBsZXZlbDogaWQsIGNjOiBjYywgYnl0ZVJhbmdlU3RhcnRPZmZzZXQ6IGJ5dGVSYW5nZVN0YXJ0T2Zmc2V0LCBieXRlUmFuZ2VFbmRPZmZzZXQ6IGJ5dGVSYW5nZUVuZE9mZnNldCwgZGVjcnlwdGRhdGEgOiBmcmFnZGVjcnlwdGRhdGEsIHByb2dyYW1EYXRlVGltZTogcHJvZ3JhbURhdGVUaW1lfTtcbiAgICAgICAgICAgIGxldmVsLmZyYWdtZW50cy5wdXNoKGZyYWcpO1xuICAgICAgICAgICAgdG90YWxkdXJhdGlvbiArPSBkdXJhdGlvbjtcbiAgICAgICAgICAgIGJ5dGVSYW5nZVN0YXJ0T2Zmc2V0ID0gbnVsbDtcbiAgICAgICAgICAgIHByb2dyYW1EYXRlVGltZSA9IG51bGw7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdLRVknOlxuICAgICAgICAgIC8vIGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9kcmFmdC1wYW50b3MtaHR0cC1saXZlLXN0cmVhbWluZy0wOCNzZWN0aW9uLTMuNC40XG4gICAgICAgICAgdmFyIGRlY3J5cHRwYXJhbXMgPSByZXN1bHRbMV07XG4gICAgICAgICAgdmFyIGtleUF0dHJzID0gbmV3IEF0dHJMaXN0KGRlY3J5cHRwYXJhbXMpO1xuICAgICAgICAgIHZhciBkZWNyeXB0bWV0aG9kID0ga2V5QXR0cnMuZW51bWVyYXRlZFN0cmluZygnTUVUSE9EJyksXG4gICAgICAgICAgICAgIGRlY3J5cHR1cmkgPSBrZXlBdHRycy5VUkksXG4gICAgICAgICAgICAgIGRlY3J5cHRpdiA9IGtleUF0dHJzLmhleGFkZWNpbWFsSW50ZWdlcignSVYnKTtcbiAgICAgICAgICBpZiAoZGVjcnlwdG1ldGhvZCkge1xuICAgICAgICAgICAgbGV2ZWxrZXkgPSB7IG1ldGhvZDogbnVsbCwga2V5OiBudWxsLCBpdjogbnVsbCwgdXJpOiBudWxsIH07XG4gICAgICAgICAgICBpZiAoKGRlY3J5cHR1cmkpICYmIChkZWNyeXB0bWV0aG9kID09PSAnQUVTLTEyOCcpKSB7XG4gICAgICAgICAgICAgIGxldmVsa2V5Lm1ldGhvZCA9IGRlY3J5cHRtZXRob2Q7XG4gICAgICAgICAgICAgIC8vIFVSSSB0byBnZXQgdGhlIGtleVxuICAgICAgICAgICAgICBsZXZlbGtleS51cmkgPSB0aGlzLnJlc29sdmUoZGVjcnlwdHVyaSwgYmFzZXVybCk7XG4gICAgICAgICAgICAgIGxldmVsa2V5LmtleSA9IG51bGw7XG4gICAgICAgICAgICAgIC8vIEluaXRpYWxpemF0aW9uIFZlY3RvciAoSVYpXG4gICAgICAgICAgICAgIGxldmVsa2V5Lml2ID0gZGVjcnlwdGl2O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnUFJPR1JBTS1EQVRFLVRJTUUnOlxuICAgICAgICAgIHByb2dyYW1EYXRlVGltZSA9IG5ldyBEYXRlKERhdGUucGFyc2UocmVzdWx0WzFdKSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIC8vbG9nZ2VyLmxvZygnZm91bmQgJyArIGxldmVsLmZyYWdtZW50cy5sZW5ndGggKyAnIGZyYWdtZW50cycpO1xuICAgIGlmKGZyYWcgJiYgIWZyYWcudXJsKSB7XG4gICAgICBsZXZlbC5mcmFnbWVudHMucG9wKCk7XG4gICAgICB0b3RhbGR1cmF0aW9uLT1mcmFnLmR1cmF0aW9uO1xuICAgIH1cbiAgICBsZXZlbC50b3RhbGR1cmF0aW9uID0gdG90YWxkdXJhdGlvbjtcbiAgICBsZXZlbC5lbmRTTiA9IGN1cnJlbnRTTiAtIDE7XG4gICAgcmV0dXJuIGxldmVsO1xuICB9XG5cbiAgbG9hZHN1Y2Nlc3MoZXZlbnQsIHN0YXRzKSB7XG4gICAgdmFyIHN0cmluZyA9IGV2ZW50LmN1cnJlbnRUYXJnZXQucmVzcG9uc2VUZXh0LCB1cmwgPSBldmVudC5jdXJyZW50VGFyZ2V0LnJlc3BvbnNlVVJMLCBpZCA9IHRoaXMuaWQsIGlkMiA9IHRoaXMuaWQyLCBobHMgPSB0aGlzLmhscywgbGV2ZWxzO1xuICAgIC8vIHJlc3BvbnNlVVJMIG5vdCBzdXBwb3J0ZWQgb24gc29tZSBicm93c2VycyAoaXQgaXMgdXNlZCB0byBkZXRlY3QgVVJMIHJlZGlyZWN0aW9uKVxuICAgIGlmICh1cmwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8gZmFsbGJhY2sgdG8gaW5pdGlhbCBVUkxcbiAgICAgIHVybCA9IHRoaXMudXJsO1xuICAgIH1cbiAgICBzdGF0cy50bG9hZCA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgIHN0YXRzLm10aW1lID0gbmV3IERhdGUoZXZlbnQuY3VycmVudFRhcmdldC5nZXRSZXNwb25zZUhlYWRlcignTGFzdC1Nb2RpZmllZCcpKTtcbiAgICBpZiAoc3RyaW5nLmluZGV4T2YoJyNFWFRNM1UnKSA9PT0gMCkge1xuICAgICAgaWYgKHN0cmluZy5pbmRleE9mKCcjRVhUSU5GOicpID4gMCkge1xuICAgICAgICAvLyAxIGxldmVsIHBsYXlsaXN0XG4gICAgICAgIC8vIGlmIGZpcnN0IHJlcXVlc3QsIGZpcmUgbWFuaWZlc3QgbG9hZGVkIGV2ZW50LCBsZXZlbCB3aWxsIGJlIHJlbG9hZGVkIGFmdGVyd2FyZHNcbiAgICAgICAgLy8gKHRoaXMgaXMgdG8gaGF2ZSBhIHVuaWZvcm0gbG9naWMgZm9yIDEgbGV2ZWwvbXVsdGlsZXZlbCBwbGF5bGlzdHMpXG4gICAgICAgIGlmICh0aGlzLmlkID09PSBudWxsKSB7XG4gICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuTUFOSUZFU1RfTE9BREVELCB7bGV2ZWxzOiBbe3VybDogdXJsfV0sIHVybDogdXJsLCBzdGF0czogc3RhdHN9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YXIgbGV2ZWxEZXRhaWxzID0gdGhpcy5wYXJzZUxldmVsUGxheWxpc3Qoc3RyaW5nLCB1cmwsIGlkKTtcbiAgICAgICAgICBzdGF0cy50cGFyc2VkID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuTEVWRUxfTE9BREVELCB7ZGV0YWlsczogbGV2ZWxEZXRhaWxzLCBsZXZlbDogaWQsIGlkOiBpZDIsIHN0YXRzOiBzdGF0c30pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsZXZlbHMgPSB0aGlzLnBhcnNlTWFzdGVyUGxheWxpc3Qoc3RyaW5nLCB1cmwpO1xuICAgICAgICAvLyBtdWx0aSBsZXZlbCBwbGF5bGlzdCwgcGFyc2UgbGV2ZWwgaW5mb1xuICAgICAgICBpZiAobGV2ZWxzLmxlbmd0aCkge1xuICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50Lk1BTklGRVNUX0xPQURFRCwge2xldmVsczogbGV2ZWxzLCB1cmw6IHVybCwgc3RhdHM6IHN0YXRzfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5NQU5JRkVTVF9QQVJTSU5HX0VSUk9SLCBmYXRhbDogdHJ1ZSwgdXJsOiB1cmwsIHJlYXNvbjogJ25vIGxldmVsIGZvdW5kIGluIG1hbmlmZXN0J30pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5ORVRXT1JLX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuTUFOSUZFU1RfUEFSU0lOR19FUlJPUiwgZmF0YWw6IHRydWUsIHVybDogdXJsLCByZWFzb246ICdubyBFWFRNM1UgZGVsaW1pdGVyJ30pO1xuICAgIH1cbiAgfVxuXG4gIGxvYWRlcnJvcihldmVudCkge1xuICAgIHZhciBkZXRhaWxzLCBmYXRhbDtcbiAgICBpZiAodGhpcy5pZCA9PT0gbnVsbCkge1xuICAgICAgZGV0YWlscyA9IEVycm9yRGV0YWlscy5NQU5JRkVTVF9MT0FEX0VSUk9SO1xuICAgICAgZmF0YWwgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBkZXRhaWxzID0gRXJyb3JEZXRhaWxzLkxFVkVMX0xPQURfRVJST1I7XG4gICAgICBmYXRhbCA9IGZhbHNlO1xuICAgIH1cbiAgICB0aGlzLmxvYWRlci5hYm9ydCgpO1xuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHM6IGRldGFpbHMsIGZhdGFsOiBmYXRhbCwgdXJsOiB0aGlzLnVybCwgbG9hZGVyOiB0aGlzLmxvYWRlciwgcmVzcG9uc2U6IGV2ZW50LmN1cnJlbnRUYXJnZXQsIGxldmVsOiB0aGlzLmlkLCBpZDogdGhpcy5pZDJ9KTtcbiAgfVxuXG4gIGxvYWR0aW1lb3V0KCkge1xuICAgIHZhciBkZXRhaWxzLCBmYXRhbDtcbiAgICBpZiAodGhpcy5pZCA9PT0gbnVsbCkge1xuICAgICAgZGV0YWlscyA9IEVycm9yRGV0YWlscy5NQU5JRkVTVF9MT0FEX1RJTUVPVVQ7XG4gICAgICBmYXRhbCA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGRldGFpbHMgPSBFcnJvckRldGFpbHMuTEVWRUxfTE9BRF9USU1FT1VUO1xuICAgICAgZmF0YWwgPSBmYWxzZTtcbiAgICB9XG4gICB0aGlzLmxvYWRlci5hYm9ydCgpO1xuICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTkVUV09SS19FUlJPUiwgZGV0YWlsczogZGV0YWlscywgZmF0YWw6IGZhdGFsLCB1cmw6IHRoaXMudXJsLCBsb2FkZXI6IHRoaXMubG9hZGVyLCBsZXZlbDogdGhpcy5pZCwgaWQ6IHRoaXMuaWQyfSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgUGxheWxpc3RMb2FkZXI7XG4iLCIvKipcbiAqIEdlbmVyYXRlIE1QNCBCb3hcbiovXG5cbi8vaW1wb3J0IEhleCBmcm9tICcuLi91dGlscy9oZXgnO1xuY2xhc3MgTVA0IHtcbiAgc3RhdGljIGluaXQoKSB7XG4gICAgTVA0LnR5cGVzID0ge1xuICAgICAgYXZjMTogW10sIC8vIGNvZGluZ25hbWVcbiAgICAgIGF2Y0M6IFtdLFxuICAgICAgYnRydDogW10sXG4gICAgICBkaW5mOiBbXSxcbiAgICAgIGRyZWY6IFtdLFxuICAgICAgZXNkczogW10sXG4gICAgICBmdHlwOiBbXSxcbiAgICAgIGhkbHI6IFtdLFxuICAgICAgbWRhdDogW10sXG4gICAgICBtZGhkOiBbXSxcbiAgICAgIG1kaWE6IFtdLFxuICAgICAgbWZoZDogW10sXG4gICAgICBtaW5mOiBbXSxcbiAgICAgIG1vb2Y6IFtdLFxuICAgICAgbW9vdjogW10sXG4gICAgICBtcDRhOiBbXSxcbiAgICAgIG12ZXg6IFtdLFxuICAgICAgbXZoZDogW10sXG4gICAgICBzZHRwOiBbXSxcbiAgICAgIHN0Ymw6IFtdLFxuICAgICAgc3RjbzogW10sXG4gICAgICBzdHNjOiBbXSxcbiAgICAgIHN0c2Q6IFtdLFxuICAgICAgc3RzejogW10sXG4gICAgICBzdHRzOiBbXSxcbiAgICAgIHRmZHQ6IFtdLFxuICAgICAgdGZoZDogW10sXG4gICAgICB0cmFmOiBbXSxcbiAgICAgIHRyYWs6IFtdLFxuICAgICAgdHJ1bjogW10sXG4gICAgICB0cmV4OiBbXSxcbiAgICAgIHRraGQ6IFtdLFxuICAgICAgdm1oZDogW10sXG4gICAgICBzbWhkOiBbXVxuICAgIH07XG5cbiAgICB2YXIgaTtcbiAgICBmb3IgKGkgaW4gTVA0LnR5cGVzKSB7XG4gICAgICBpZiAoTVA0LnR5cGVzLmhhc093blByb3BlcnR5KGkpKSB7XG4gICAgICAgIE1QNC50eXBlc1tpXSA9IFtcbiAgICAgICAgICBpLmNoYXJDb2RlQXQoMCksXG4gICAgICAgICAgaS5jaGFyQ29kZUF0KDEpLFxuICAgICAgICAgIGkuY2hhckNvZGVBdCgyKSxcbiAgICAgICAgICBpLmNoYXJDb2RlQXQoMylcbiAgICAgICAgXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgdmlkZW9IZGxyID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcHJlX2RlZmluZWRcbiAgICAgIDB4NzYsIDB4NjksIDB4NjQsIDB4NjUsIC8vIGhhbmRsZXJfdHlwZTogJ3ZpZGUnXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDU2LCAweDY5LCAweDY0LCAweDY1LFxuICAgICAgMHg2ZiwgMHg0OCwgMHg2MSwgMHg2ZSxcbiAgICAgIDB4NjQsIDB4NmMsIDB4NjUsIDB4NzIsIDB4MDAgLy8gbmFtZTogJ1ZpZGVvSGFuZGxlcidcbiAgICBdKTtcblxuICAgIHZhciBhdWRpb0hkbHIgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBwcmVfZGVmaW5lZFxuICAgICAgMHg3MywgMHg2ZiwgMHg3NSwgMHg2ZSwgLy8gaGFuZGxlcl90eXBlOiAnc291bidcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4NTMsIDB4NmYsIDB4NzUsIDB4NmUsXG4gICAgICAweDY0LCAweDQ4LCAweDYxLCAweDZlLFxuICAgICAgMHg2NCwgMHg2YywgMHg2NSwgMHg3MiwgMHgwMCAvLyBuYW1lOiAnU291bmRIYW5kbGVyJ1xuICAgIF0pO1xuXG4gICAgTVA0LkhETFJfVFlQRVMgPSB7XG4gICAgICAndmlkZW8nOiB2aWRlb0hkbHIsXG4gICAgICAnYXVkaW8nOiBhdWRpb0hkbHJcbiAgICB9O1xuXG4gICAgdmFyIGRyZWYgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAxLCAvLyBlbnRyeV9jb3VudFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwYywgLy8gZW50cnlfc2l6ZVxuICAgICAgMHg3NSwgMHg3MiwgMHg2YywgMHgyMCwgLy8gJ3VybCcgdHlwZVxuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAxIC8vIGVudHJ5X2ZsYWdzXG4gICAgXSk7XG5cbiAgICB2YXIgc3RjbyA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwIC8vIGVudHJ5X2NvdW50XG4gICAgXSk7XG5cbiAgICBNUDQuU1RUUyA9IE1QNC5TVFNDID0gTVA0LlNUQ08gPSBzdGNvO1xuXG4gICAgTVA0LlNUU1ogPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gc2FtcGxlX3NpemVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHNhbXBsZV9jb3VudFxuICAgIF0pO1xuICAgIE1QNC5WTUhEID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMSwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIC8vIGdyYXBoaWNzbW9kZVxuICAgICAgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwIC8vIG9wY29sb3JcbiAgICBdKTtcbiAgICBNUDQuU01IRCA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAvLyBiYWxhbmNlXG4gICAgICAweDAwLCAweDAwIC8vIHJlc2VydmVkXG4gICAgXSk7XG5cbiAgICBNUDQuU1RTRCA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDFdKTsvLyBlbnRyeV9jb3VudFxuXG4gICAgdmFyIG1ham9yQnJhbmQgPSBuZXcgVWludDhBcnJheShbMTA1LDExNSwxMTEsMTA5XSk7IC8vIGlzb21cbiAgICB2YXIgYXZjMUJyYW5kID0gbmV3IFVpbnQ4QXJyYXkoWzk3LDExOCw5OSw0OV0pOyAvLyBhdmMxXG4gICAgdmFyIG1pbm9yVmVyc2lvbiA9IG5ldyBVaW50OEFycmF5KFswLCAwLCAwLCAxXSk7XG5cbiAgICBNUDQuRlRZUCA9IE1QNC5ib3goTVA0LnR5cGVzLmZ0eXAsIG1ham9yQnJhbmQsIG1pbm9yVmVyc2lvbiwgbWFqb3JCcmFuZCwgYXZjMUJyYW5kKTtcbiAgICBNUDQuRElORiA9IE1QNC5ib3goTVA0LnR5cGVzLmRpbmYsIE1QNC5ib3goTVA0LnR5cGVzLmRyZWYsIGRyZWYpKTtcbiAgfVxuXG4gIHN0YXRpYyBib3godHlwZSkge1xuICB2YXJcbiAgICBwYXlsb2FkID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSxcbiAgICBzaXplID0gOCxcbiAgICBpID0gcGF5bG9hZC5sZW5ndGgsXG4gICAgbGVuID0gaSxcbiAgICByZXN1bHQ7XG4gICAgLy8gY2FsY3VsYXRlIHRoZSB0b3RhbCBzaXplIHdlIG5lZWQgdG8gYWxsb2NhdGVcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICBzaXplICs9IHBheWxvYWRbaV0uYnl0ZUxlbmd0aDtcbiAgICB9XG4gICAgcmVzdWx0ID0gbmV3IFVpbnQ4QXJyYXkoc2l6ZSk7XG4gICAgcmVzdWx0WzBdID0gKHNpemUgPj4gMjQpICYgMHhmZjtcbiAgICByZXN1bHRbMV0gPSAoc2l6ZSA+PiAxNikgJiAweGZmO1xuICAgIHJlc3VsdFsyXSA9IChzaXplID4+IDgpICYgMHhmZjtcbiAgICByZXN1bHRbM10gPSBzaXplICAmIDB4ZmY7XG4gICAgcmVzdWx0LnNldCh0eXBlLCA0KTtcbiAgICAvLyBjb3B5IHRoZSBwYXlsb2FkIGludG8gdGhlIHJlc3VsdFxuICAgIGZvciAoaSA9IDAsIHNpemUgPSA4OyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIC8vIGNvcHkgcGF5bG9hZFtpXSBhcnJheSBAIG9mZnNldCBzaXplXG4gICAgICByZXN1bHQuc2V0KHBheWxvYWRbaV0sIHNpemUpO1xuICAgICAgc2l6ZSArPSBwYXlsb2FkW2ldLmJ5dGVMZW5ndGg7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBzdGF0aWMgaGRscih0eXBlKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLmhkbHIsIE1QNC5IRExSX1RZUEVTW3R5cGVdKTtcbiAgfVxuXG4gIHN0YXRpYyBtZGF0KGRhdGEpIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWRhdCwgZGF0YSk7XG4gIH1cblxuICBzdGF0aWMgbWRoZCh0aW1lc2NhbGUsIGR1cmF0aW9uKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1kaGQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDIsIC8vIGNyZWF0aW9uX3RpbWVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDMsIC8vIG1vZGlmaWNhdGlvbl90aW1lXG4gICAgICAodGltZXNjYWxlID4+IDI0KSAmIDB4RkYsXG4gICAgICAodGltZXNjYWxlID4+IDE2KSAmIDB4RkYsXG4gICAgICAodGltZXNjYWxlID4+ICA4KSAmIDB4RkYsXG4gICAgICB0aW1lc2NhbGUgJiAweEZGLCAvLyB0aW1lc2NhbGVcbiAgICAgIChkdXJhdGlvbiA+PiAyNCksXG4gICAgICAoZHVyYXRpb24gPj4gMTYpICYgMHhGRixcbiAgICAgIChkdXJhdGlvbiA+PiAgOCkgJiAweEZGLFxuICAgICAgZHVyYXRpb24gJiAweEZGLCAvLyBkdXJhdGlvblxuICAgICAgMHg1NSwgMHhjNCwgLy8gJ3VuZCcgbGFuZ3VhZ2UgKHVuZGV0ZXJtaW5lZClcbiAgICAgIDB4MDAsIDB4MDBcbiAgICBdKSk7XG4gIH1cblxuICBzdGF0aWMgbWRpYSh0cmFjaykge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tZGlhLCBNUDQubWRoZCh0cmFjay50aW1lc2NhbGUsIHRyYWNrLmR1cmF0aW9uKSwgTVA0LmhkbHIodHJhY2sudHlwZSksIE1QNC5taW5mKHRyYWNrKSk7XG4gIH1cblxuICBzdGF0aWMgbWZoZChzZXF1ZW5jZU51bWJlcikge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tZmhkLCBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIChzZXF1ZW5jZU51bWJlciA+PiAyNCksXG4gICAgICAoc2VxdWVuY2VOdW1iZXIgPj4gMTYpICYgMHhGRixcbiAgICAgIChzZXF1ZW5jZU51bWJlciA+PiAgOCkgJiAweEZGLFxuICAgICAgc2VxdWVuY2VOdW1iZXIgJiAweEZGLCAvLyBzZXF1ZW5jZV9udW1iZXJcbiAgICBdKSk7XG4gIH1cblxuICBzdGF0aWMgbWluZih0cmFjaykge1xuICAgIGlmICh0cmFjay50eXBlID09PSAnYXVkaW8nKSB7XG4gICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWluZiwgTVA0LmJveChNUDQudHlwZXMuc21oZCwgTVA0LlNNSEQpLCBNUDQuRElORiwgTVA0LnN0YmwodHJhY2spKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1pbmYsIE1QNC5ib3goTVA0LnR5cGVzLnZtaGQsIE1QNC5WTUhEKSwgTVA0LkRJTkYsIE1QNC5zdGJsKHRyYWNrKSk7XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIG1vb2Yoc24sIGJhc2VNZWRpYURlY29kZVRpbWUsIHRyYWNrKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1vb2YsIE1QNC5tZmhkKHNuKSwgTVA0LnRyYWYodHJhY2ssYmFzZU1lZGlhRGVjb2RlVGltZSkpO1xuICB9XG4vKipcbiAqIEBwYXJhbSB0cmFja3MuLi4gKG9wdGlvbmFsKSB7YXJyYXl9IHRoZSB0cmFja3MgYXNzb2NpYXRlZCB3aXRoIHRoaXMgbW92aWVcbiAqL1xuICBzdGF0aWMgbW9vdih0cmFja3MpIHtcbiAgICB2YXJcbiAgICAgIGkgPSB0cmFja3MubGVuZ3RoLFxuICAgICAgYm94ZXMgPSBbXTtcblxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIGJveGVzW2ldID0gTVA0LnRyYWsodHJhY2tzW2ldKTtcbiAgICB9XG5cbiAgICByZXR1cm4gTVA0LmJveC5hcHBseShudWxsLCBbTVA0LnR5cGVzLm1vb3YsIE1QNC5tdmhkKHRyYWNrc1swXS50aW1lc2NhbGUsIHRyYWNrc1swXS5kdXJhdGlvbildLmNvbmNhdChib3hlcykuY29uY2F0KE1QNC5tdmV4KHRyYWNrcykpKTtcbiAgfVxuXG4gIHN0YXRpYyBtdmV4KHRyYWNrcykge1xuICAgIHZhclxuICAgICAgaSA9IHRyYWNrcy5sZW5ndGgsXG4gICAgICBib3hlcyA9IFtdO1xuXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgYm94ZXNbaV0gPSBNUDQudHJleCh0cmFja3NbaV0pO1xuICAgIH1cbiAgICByZXR1cm4gTVA0LmJveC5hcHBseShudWxsLCBbTVA0LnR5cGVzLm12ZXhdLmNvbmNhdChib3hlcykpO1xuICB9XG5cbiAgc3RhdGljIG12aGQodGltZXNjYWxlLGR1cmF0aW9uKSB7XG4gICAgdmFyXG4gICAgICBieXRlcyA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDEsIC8vIGNyZWF0aW9uX3RpbWVcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMiwgLy8gbW9kaWZpY2F0aW9uX3RpbWVcbiAgICAgICAgKHRpbWVzY2FsZSA+PiAyNCkgJiAweEZGLFxuICAgICAgICAodGltZXNjYWxlID4+IDE2KSAmIDB4RkYsXG4gICAgICAgICh0aW1lc2NhbGUgPj4gIDgpICYgMHhGRixcbiAgICAgICAgdGltZXNjYWxlICYgMHhGRiwgLy8gdGltZXNjYWxlXG4gICAgICAgIChkdXJhdGlvbiA+PiAyNCkgJiAweEZGLFxuICAgICAgICAoZHVyYXRpb24gPj4gMTYpICYgMHhGRixcbiAgICAgICAgKGR1cmF0aW9uID4+ICA4KSAmIDB4RkYsXG4gICAgICAgIGR1cmF0aW9uICYgMHhGRiwgLy8gZHVyYXRpb25cbiAgICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCwgLy8gMS4wIHJhdGVcbiAgICAgICAgMHgwMSwgMHgwMCwgLy8gMS4wIHZvbHVtZVxuICAgICAgICAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDQwLCAweDAwLCAweDAwLCAweDAwLCAvLyB0cmFuc2Zvcm1hdGlvbjogdW5pdHkgbWF0cml4XG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAgIDB4ZmYsIDB4ZmYsIDB4ZmYsIDB4ZmYgLy8gbmV4dF90cmFja19JRFxuICAgICAgXSk7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm12aGQsIGJ5dGVzKTtcbiAgfVxuXG4gIHN0YXRpYyBzZHRwKHRyYWNrKSB7XG4gICAgdmFyXG4gICAgICBzYW1wbGVzID0gdHJhY2suc2FtcGxlcyB8fCBbXSxcbiAgICAgIGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkoNCArIHNhbXBsZXMubGVuZ3RoKSxcbiAgICAgIGZsYWdzLFxuICAgICAgaTtcbiAgICAvLyBsZWF2ZSB0aGUgZnVsbCBib3ggaGVhZGVyICg0IGJ5dGVzKSBhbGwgemVyb1xuICAgIC8vIHdyaXRlIHRoZSBzYW1wbGUgdGFibGVcbiAgICBmb3IgKGkgPSAwOyBpIDwgc2FtcGxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgZmxhZ3MgPSBzYW1wbGVzW2ldLmZsYWdzO1xuICAgICAgYnl0ZXNbaSArIDRdID0gKGZsYWdzLmRlcGVuZHNPbiA8PCA0KSB8XG4gICAgICAgIChmbGFncy5pc0RlcGVuZGVkT24gPDwgMikgfFxuICAgICAgICAoZmxhZ3MuaGFzUmVkdW5kYW5jeSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnNkdHAsIGJ5dGVzKTtcbiAgfVxuXG4gIHN0YXRpYyBzdGJsKHRyYWNrKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnN0YmwsIE1QNC5zdHNkKHRyYWNrKSwgTVA0LmJveChNUDQudHlwZXMuc3R0cywgTVA0LlNUVFMpLCBNUDQuYm94KE1QNC50eXBlcy5zdHNjLCBNUDQuU1RTQyksIE1QNC5ib3goTVA0LnR5cGVzLnN0c3osIE1QNC5TVFNaKSwgTVA0LmJveChNUDQudHlwZXMuc3RjbywgTVA0LlNUQ08pKTtcbiAgfVxuXG4gIHN0YXRpYyBhdmMxKHRyYWNrKSB7XG4gICAgdmFyIHNwcyA9IFtdLCBwcHMgPSBbXSwgaSwgZGF0YSwgbGVuO1xuICAgIC8vIGFzc2VtYmxlIHRoZSBTUFNzXG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgdHJhY2suc3BzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBkYXRhID0gdHJhY2suc3BzW2ldO1xuICAgICAgbGVuID0gZGF0YS5ieXRlTGVuZ3RoO1xuICAgICAgc3BzLnB1c2goKGxlbiA+Pj4gOCkgJiAweEZGKTtcbiAgICAgIHNwcy5wdXNoKChsZW4gJiAweEZGKSk7XG4gICAgICBzcHMgPSBzcHMuY29uY2F0KEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGRhdGEpKTsgLy8gU1BTXG4gICAgfVxuXG4gICAgLy8gYXNzZW1ibGUgdGhlIFBQU3NcbiAgICBmb3IgKGkgPSAwOyBpIDwgdHJhY2sucHBzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBkYXRhID0gdHJhY2sucHBzW2ldO1xuICAgICAgbGVuID0gZGF0YS5ieXRlTGVuZ3RoO1xuICAgICAgcHBzLnB1c2goKGxlbiA+Pj4gOCkgJiAweEZGKTtcbiAgICAgIHBwcy5wdXNoKChsZW4gJiAweEZGKSk7XG4gICAgICBwcHMgPSBwcHMuY29uY2F0KEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGRhdGEpKTtcbiAgICB9XG5cbiAgICB2YXIgYXZjYyA9IE1QNC5ib3goTVA0LnR5cGVzLmF2Y0MsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgICAgIDB4MDEsICAgLy8gdmVyc2lvblxuICAgICAgICAgICAgc3BzWzNdLCAvLyBwcm9maWxlXG4gICAgICAgICAgICBzcHNbNF0sIC8vIHByb2ZpbGUgY29tcGF0XG4gICAgICAgICAgICBzcHNbNV0sIC8vIGxldmVsXG4gICAgICAgICAgICAweGZjIHwgMywgLy8gbGVuZ3RoU2l6ZU1pbnVzT25lLCBoYXJkLWNvZGVkIHRvIDQgYnl0ZXNcbiAgICAgICAgICAgIDB4RTAgfCB0cmFjay5zcHMubGVuZ3RoIC8vIDNiaXQgcmVzZXJ2ZWQgKDExMSkgKyBudW1PZlNlcXVlbmNlUGFyYW1ldGVyU2V0c1xuICAgICAgICAgIF0uY29uY2F0KHNwcykuY29uY2F0KFtcbiAgICAgICAgICAgIHRyYWNrLnBwcy5sZW5ndGggLy8gbnVtT2ZQaWN0dXJlUGFyYW1ldGVyU2V0c1xuICAgICAgICAgIF0pLmNvbmNhdChwcHMpKSksIC8vIFwiUFBTXCJcbiAgICAgICAgd2lkdGggPSB0cmFjay53aWR0aCxcbiAgICAgICAgaGVpZ2h0ID0gdHJhY2suaGVpZ2h0O1xuICAgIC8vY29uc29sZS5sb2coJ2F2Y2M6JyArIEhleC5oZXhEdW1wKGF2Y2MpKTtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuYXZjMSwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAxLCAvLyBkYXRhX3JlZmVyZW5jZV9pbmRleFxuICAgICAgICAweDAwLCAweDAwLCAvLyBwcmVfZGVmaW5lZFxuICAgICAgICAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBwcmVfZGVmaW5lZFxuICAgICAgICAod2lkdGggPj4gOCkgJiAweEZGLFxuICAgICAgICB3aWR0aCAmIDB4ZmYsIC8vIHdpZHRoXG4gICAgICAgIChoZWlnaHQgPj4gOCkgJiAweEZGLFxuICAgICAgICBoZWlnaHQgJiAweGZmLCAvLyBoZWlnaHRcbiAgICAgICAgMHgwMCwgMHg0OCwgMHgwMCwgMHgwMCwgLy8gaG9yaXpyZXNvbHV0aW9uXG4gICAgICAgIDB4MDAsIDB4NDgsIDB4MDAsIDB4MDAsIC8vIHZlcnRyZXNvbHV0aW9uXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDEsIC8vIGZyYW1lX2NvdW50XG4gICAgICAgIDB4MTMsXG4gICAgICAgIDB4NzYsIDB4NjksIDB4NjQsIDB4NjUsXG4gICAgICAgIDB4NmYsIDB4NmEsIDB4NzMsIDB4MmQsXG4gICAgICAgIDB4NjMsIDB4NmYsIDB4NmUsIDB4NzQsXG4gICAgICAgIDB4NzIsIDB4NjksIDB4NjIsIDB4MmQsXG4gICAgICAgIDB4NjgsIDB4NmMsIDB4NzMsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGNvbXByZXNzb3JuYW1lXG4gICAgICAgIDB4MDAsIDB4MTgsIC8vIGRlcHRoID0gMjRcbiAgICAgICAgMHgxMSwgMHgxMV0pLCAvLyBwcmVfZGVmaW5lZCA9IC0xXG4gICAgICAgICAgYXZjYyxcbiAgICAgICAgICBNUDQuYm94KE1QNC50eXBlcy5idHJ0LCBuZXcgVWludDhBcnJheShbXG4gICAgICAgICAgICAweDAwLCAweDFjLCAweDljLCAweDgwLCAvLyBidWZmZXJTaXplREJcbiAgICAgICAgICAgIDB4MDAsIDB4MmQsIDB4YzYsIDB4YzAsIC8vIG1heEJpdHJhdGVcbiAgICAgICAgICAgIDB4MDAsIDB4MmQsIDB4YzYsIDB4YzBdKSkgLy8gYXZnQml0cmF0ZVxuICAgICAgICAgICk7XG4gIH1cblxuICBzdGF0aWMgZXNkcyh0cmFjaykge1xuICAgIHZhciBjb25maWdsZW4gPSB0cmFjay5jb25maWcubGVuZ3RoO1xuICAgIHJldHVybiBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG5cbiAgICAgIDB4MDMsIC8vIGRlc2NyaXB0b3JfdHlwZVxuICAgICAgMHgxNytjb25maWdsZW4sIC8vIGxlbmd0aFxuICAgICAgMHgwMCwgMHgwMSwgLy9lc19pZFxuICAgICAgMHgwMCwgLy8gc3RyZWFtX3ByaW9yaXR5XG5cbiAgICAgIDB4MDQsIC8vIGRlc2NyaXB0b3JfdHlwZVxuICAgICAgMHgwZitjb25maWdsZW4sIC8vIGxlbmd0aFxuICAgICAgMHg0MCwgLy9jb2RlYyA6IG1wZWc0X2F1ZGlvXG4gICAgICAweDE1LCAvLyBzdHJlYW1fdHlwZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gYnVmZmVyX3NpemVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIG1heEJpdHJhdGVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGF2Z0JpdHJhdGVcblxuICAgICAgMHgwNSAvLyBkZXNjcmlwdG9yX3R5cGVcbiAgICAgIF0uY29uY2F0KFtjb25maWdsZW5dKS5jb25jYXQodHJhY2suY29uZmlnKS5jb25jYXQoWzB4MDYsIDB4MDEsIDB4MDJdKSk7IC8vIEdBU3BlY2lmaWNDb25maWcpKTsgLy8gbGVuZ3RoICsgYXVkaW8gY29uZmlnIGRlc2NyaXB0b3JcbiAgfVxuXG4gIHN0YXRpYyBtcDRhKHRyYWNrKSB7XG4gICAgdmFyIGF1ZGlvc2FtcGxlcmF0ZSA9IHRyYWNrLmF1ZGlvc2FtcGxlcmF0ZTtcbiAgICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tcDRhLCBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDEsIC8vIGRhdGFfcmVmZXJlbmNlX2luZGV4XG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIHRyYWNrLmNoYW5uZWxDb3VudCwgLy8gY2hhbm5lbGNvdW50XG4gICAgICAweDAwLCAweDEwLCAvLyBzYW1wbGVTaXplOjE2Yml0c1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWQyXG4gICAgICAoYXVkaW9zYW1wbGVyYXRlID4+IDgpICYgMHhGRixcbiAgICAgIGF1ZGlvc2FtcGxlcmF0ZSAmIDB4ZmYsIC8vXG4gICAgICAweDAwLCAweDAwXSksXG4gICAgICBNUDQuYm94KE1QNC50eXBlcy5lc2RzLCBNUDQuZXNkcyh0cmFjaykpKTtcbiAgfVxuXG4gIHN0YXRpYyBzdHNkKHRyYWNrKSB7XG4gICAgaWYgKHRyYWNrLnR5cGUgPT09ICdhdWRpbycpIHtcbiAgICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5zdHNkLCBNUDQuU1RTRCwgTVA0Lm1wNGEodHJhY2spKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnN0c2QsIE1QNC5TVFNELCBNUDQuYXZjMSh0cmFjaykpO1xuICAgIH1cbiAgfVxuXG4gIHN0YXRpYyB0a2hkKHRyYWNrKSB7XG4gICAgdmFyIGlkID0gdHJhY2suaWQsXG4gICAgICAgIGR1cmF0aW9uID0gdHJhY2suZHVyYXRpb24sXG4gICAgICAgIHdpZHRoID0gdHJhY2sud2lkdGgsXG4gICAgICAgIGhlaWdodCA9IHRyYWNrLmhlaWdodDtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudGtoZCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDA3LCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gY3JlYXRpb25fdGltZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gbW9kaWZpY2F0aW9uX3RpbWVcbiAgICAgIChpZCA+PiAyNCkgJiAweEZGLFxuICAgICAgKGlkID4+IDE2KSAmIDB4RkYsXG4gICAgICAoaWQgPj4gOCkgJiAweEZGLFxuICAgICAgaWQgJiAweEZGLCAvLyB0cmFja19JRFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIChkdXJhdGlvbiA+PiAyNCksXG4gICAgICAoZHVyYXRpb24gPj4gMTYpICYgMHhGRixcbiAgICAgIChkdXJhdGlvbiA+PiAgOCkgJiAweEZGLFxuICAgICAgZHVyYXRpb24gJiAweEZGLCAvLyBkdXJhdGlvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAvLyBsYXllclxuICAgICAgMHgwMCwgMHgwMCwgLy8gYWx0ZXJuYXRlX2dyb3VwXG4gICAgICAweDAwLCAweDAwLCAvLyBub24tYXVkaW8gdHJhY2sgdm9sdW1lXG4gICAgICAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDQwLCAweDAwLCAweDAwLCAweDAwLCAvLyB0cmFuc2Zvcm1hdGlvbjogdW5pdHkgbWF0cml4XG4gICAgICAod2lkdGggPj4gOCkgJiAweEZGLFxuICAgICAgd2lkdGggJiAweEZGLFxuICAgICAgMHgwMCwgMHgwMCwgLy8gd2lkdGhcbiAgICAgIChoZWlnaHQgPj4gOCkgJiAweEZGLFxuICAgICAgaGVpZ2h0ICYgMHhGRixcbiAgICAgIDB4MDAsIDB4MDAgLy8gaGVpZ2h0XG4gICAgXSkpO1xuICB9XG5cbiAgc3RhdGljIHRyYWYodHJhY2ssYmFzZU1lZGlhRGVjb2RlVGltZSkge1xuICAgIHZhciBzYW1wbGVEZXBlbmRlbmN5VGFibGUgPSBNUDQuc2R0cCh0cmFjayksXG4gICAgICAgIGlkID0gdHJhY2suaWQ7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnRyYWYsXG4gICAgICAgICAgICAgICBNUDQuYm94KE1QNC50eXBlcy50ZmhkLCBuZXcgVWludDhBcnJheShbXG4gICAgICAgICAgICAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgICAgICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgICAgICAgICAgICAoaWQgPj4gMjQpLFxuICAgICAgICAgICAgICAgICAoaWQgPj4gMTYpICYgMFhGRixcbiAgICAgICAgICAgICAgICAgKGlkID4+IDgpICYgMFhGRixcbiAgICAgICAgICAgICAgICAgKGlkICYgMHhGRikgLy8gdHJhY2tfSURcbiAgICAgICAgICAgICAgIF0pKSxcbiAgICAgICAgICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLnRmZHQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgICAgICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAgICAgICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAgICAgICAgICAgIChiYXNlTWVkaWFEZWNvZGVUaW1lID4+MjQpLFxuICAgICAgICAgICAgICAgICAoYmFzZU1lZGlhRGVjb2RlVGltZSA+PiAxNikgJiAwWEZGLFxuICAgICAgICAgICAgICAgICAoYmFzZU1lZGlhRGVjb2RlVGltZSA+PiA4KSAmIDBYRkYsXG4gICAgICAgICAgICAgICAgIChiYXNlTWVkaWFEZWNvZGVUaW1lICYgMHhGRikgLy8gYmFzZU1lZGlhRGVjb2RlVGltZVxuICAgICAgICAgICAgICAgXSkpLFxuICAgICAgICAgICAgICAgTVA0LnRydW4odHJhY2ssXG4gICAgICAgICAgICAgICAgICAgIHNhbXBsZURlcGVuZGVuY3lUYWJsZS5sZW5ndGggK1xuICAgICAgICAgICAgICAgICAgICAxNiArIC8vIHRmaGRcbiAgICAgICAgICAgICAgICAgICAgMTYgKyAvLyB0ZmR0XG4gICAgICAgICAgICAgICAgICAgIDggKyAgLy8gdHJhZiBoZWFkZXJcbiAgICAgICAgICAgICAgICAgICAgMTYgKyAvLyBtZmhkXG4gICAgICAgICAgICAgICAgICAgIDggKyAgLy8gbW9vZiBoZWFkZXJcbiAgICAgICAgICAgICAgICAgICAgOCksICAvLyBtZGF0IGhlYWRlclxuICAgICAgICAgICAgICAgc2FtcGxlRGVwZW5kZW5jeVRhYmxlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZW5lcmF0ZSBhIHRyYWNrIGJveC5cbiAgICogQHBhcmFtIHRyYWNrIHtvYmplY3R9IGEgdHJhY2sgZGVmaW5pdGlvblxuICAgKiBAcmV0dXJuIHtVaW50OEFycmF5fSB0aGUgdHJhY2sgYm94XG4gICAqL1xuICBzdGF0aWMgdHJhayh0cmFjaykge1xuICAgIHRyYWNrLmR1cmF0aW9uID0gdHJhY2suZHVyYXRpb24gfHwgMHhmZmZmZmZmZjtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudHJhaywgTVA0LnRraGQodHJhY2spLCBNUDQubWRpYSh0cmFjaykpO1xuICB9XG5cbiAgc3RhdGljIHRyZXgodHJhY2spIHtcbiAgICB2YXIgaWQgPSB0cmFjay5pZDtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudHJleCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAoaWQgPj4gMjQpLFxuICAgICAoaWQgPj4gMTYpICYgMFhGRixcbiAgICAgKGlkID4+IDgpICYgMFhGRixcbiAgICAgKGlkICYgMHhGRiksIC8vIHRyYWNrX0lEXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAxLCAvLyBkZWZhdWx0X3NhbXBsZV9kZXNjcmlwdGlvbl9pbmRleFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZGVmYXVsdF9zYW1wbGVfZHVyYXRpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGRlZmF1bHRfc2FtcGxlX3NpemVcbiAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDEgLy8gZGVmYXVsdF9zYW1wbGVfZmxhZ3NcbiAgICBdKSk7XG4gIH1cblxuICBzdGF0aWMgdHJ1bih0cmFjaywgb2Zmc2V0KSB7XG4gICAgdmFyIHNhbXBsZXM9IHRyYWNrLnNhbXBsZXMgfHwgW10sXG4gICAgICAgIGxlbiA9IHNhbXBsZXMubGVuZ3RoLFxuICAgICAgICBhcnJheWxlbiA9IDEyICsgKDE2ICogbGVuKSxcbiAgICAgICAgYXJyYXkgPSBuZXcgVWludDhBcnJheShhcnJheWxlbiksXG4gICAgICAgIGksc2FtcGxlLGR1cmF0aW9uLHNpemUsZmxhZ3MsY3RzO1xuICAgIG9mZnNldCArPSA4ICsgYXJyYXlsZW47XG4gICAgYXJyYXkuc2V0KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwZiwgMHgwMSwgLy8gZmxhZ3NcbiAgICAgIChsZW4gPj4+IDI0KSAmIDB4RkYsXG4gICAgICAobGVuID4+PiAxNikgJiAweEZGLFxuICAgICAgKGxlbiA+Pj4gOCkgJiAweEZGLFxuICAgICAgbGVuICYgMHhGRiwgLy8gc2FtcGxlX2NvdW50XG4gICAgICAob2Zmc2V0ID4+PiAyNCkgJiAweEZGLFxuICAgICAgKG9mZnNldCA+Pj4gMTYpICYgMHhGRixcbiAgICAgIChvZmZzZXQgPj4+IDgpICYgMHhGRixcbiAgICAgIG9mZnNldCAmIDB4RkYgLy8gZGF0YV9vZmZzZXRcbiAgICBdLDApO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgc2FtcGxlID0gc2FtcGxlc1tpXTtcbiAgICAgIGR1cmF0aW9uID0gc2FtcGxlLmR1cmF0aW9uO1xuICAgICAgc2l6ZSA9IHNhbXBsZS5zaXplO1xuICAgICAgZmxhZ3MgPSBzYW1wbGUuZmxhZ3M7XG4gICAgICBjdHMgPSBzYW1wbGUuY3RzO1xuICAgICAgYXJyYXkuc2V0KFtcbiAgICAgICAgKGR1cmF0aW9uID4+PiAyNCkgJiAweEZGLFxuICAgICAgICAoZHVyYXRpb24gPj4+IDE2KSAmIDB4RkYsXG4gICAgICAgIChkdXJhdGlvbiA+Pj4gOCkgJiAweEZGLFxuICAgICAgICBkdXJhdGlvbiAmIDB4RkYsIC8vIHNhbXBsZV9kdXJhdGlvblxuICAgICAgICAoc2l6ZSA+Pj4gMjQpICYgMHhGRixcbiAgICAgICAgKHNpemUgPj4+IDE2KSAmIDB4RkYsXG4gICAgICAgIChzaXplID4+PiA4KSAmIDB4RkYsXG4gICAgICAgIHNpemUgJiAweEZGLCAvLyBzYW1wbGVfc2l6ZVxuICAgICAgICAoZmxhZ3MuaXNMZWFkaW5nIDw8IDIpIHwgZmxhZ3MuZGVwZW5kc09uLFxuICAgICAgICAoZmxhZ3MuaXNEZXBlbmRlZE9uIDw8IDYpIHxcbiAgICAgICAgICAoZmxhZ3MuaGFzUmVkdW5kYW5jeSA8PCA0KSB8XG4gICAgICAgICAgKGZsYWdzLnBhZGRpbmdWYWx1ZSA8PCAxKSB8XG4gICAgICAgICAgZmxhZ3MuaXNOb25TeW5jLFxuICAgICAgICBmbGFncy5kZWdyYWRQcmlvICYgMHhGMCA8PCA4LFxuICAgICAgICBmbGFncy5kZWdyYWRQcmlvICYgMHgwRiwgLy8gc2FtcGxlX2ZsYWdzXG4gICAgICAgIChjdHMgPj4+IDI0KSAmIDB4RkYsXG4gICAgICAgIChjdHMgPj4+IDE2KSAmIDB4RkYsXG4gICAgICAgIChjdHMgPj4+IDgpICYgMHhGRixcbiAgICAgICAgY3RzICYgMHhGRiAvLyBzYW1wbGVfY29tcG9zaXRpb25fdGltZV9vZmZzZXRcbiAgICAgIF0sMTIrMTYqaSk7XG4gICAgfVxuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50cnVuLCBhcnJheSk7XG4gIH1cblxuICBzdGF0aWMgaW5pdFNlZ21lbnQodHJhY2tzKSB7XG4gICAgaWYgKCFNUDQudHlwZXMpIHtcbiAgICAgIE1QNC5pbml0KCk7XG4gICAgfVxuICAgIHZhciBtb3ZpZSA9IE1QNC5tb292KHRyYWNrcyksIHJlc3VsdDtcbiAgICByZXN1bHQgPSBuZXcgVWludDhBcnJheShNUDQuRlRZUC5ieXRlTGVuZ3RoICsgbW92aWUuYnl0ZUxlbmd0aCk7XG4gICAgcmVzdWx0LnNldChNUDQuRlRZUCk7XG4gICAgcmVzdWx0LnNldChtb3ZpZSwgTVA0LkZUWVAuYnl0ZUxlbmd0aCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBNUDQ7XG4iLCIvKipcbiAqIGZNUDQgcmVtdXhlclxuKi9cblxuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IE1QNCBmcm9tICcuLi9yZW11eC9tcDQtZ2VuZXJhdG9yJztcbmltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuXG5jbGFzcyBNUDRSZW11eGVyIHtcbiAgY29uc3RydWN0b3Iob2JzZXJ2ZXIpIHtcbiAgICB0aGlzLm9ic2VydmVyID0gb2JzZXJ2ZXI7XG4gICAgdGhpcy5JU0dlbmVyYXRlZCA9IGZhbHNlO1xuICAgIHRoaXMuUEVTMk1QNFNDQUxFRkFDVE9SID0gNDtcbiAgICB0aGlzLlBFU19USU1FU0NBTEUgPSA5MDAwMDtcbiAgICB0aGlzLk1QNF9USU1FU0NBTEUgPSB0aGlzLlBFU19USU1FU0NBTEUgLyB0aGlzLlBFUzJNUDRTQ0FMRUZBQ1RPUjtcbiAgfVxuXG4gIGdldCB0aW1lc2NhbGUoKSB7XG4gICAgcmV0dXJuIHRoaXMuTVA0X1RJTUVTQ0FMRTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gIH1cblxuICBpbnNlcnREaXNjb250aW51aXR5KCkge1xuICAgIHRoaXMuX2luaXRQVFMgPSB0aGlzLl9pbml0RFRTID0gdGhpcy5uZXh0QWFjUHRzID0gdGhpcy5uZXh0QXZjRHRzID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgc3dpdGNoTGV2ZWwoKSB7XG4gICAgdGhpcy5JU0dlbmVyYXRlZCA9IGZhbHNlO1xuICB9XG5cbiAgcmVtdXgoYXVkaW9UcmFjayx2aWRlb1RyYWNrLGlkM1RyYWNrLHRpbWVPZmZzZXQsIGNvbnRpZ3VvdXMpIHtcbiAgICAvLyBnZW5lcmF0ZSBJbml0IFNlZ21lbnQgaWYgbmVlZGVkXG4gICAgaWYgKCF0aGlzLklTR2VuZXJhdGVkKSB7XG4gICAgICB0aGlzLmdlbmVyYXRlSVMoYXVkaW9UcmFjayx2aWRlb1RyYWNrLHRpbWVPZmZzZXQpO1xuICAgIH1cbiAgICAvL2xvZ2dlci5sb2coJ25iIEFWQyBzYW1wbGVzOicgKyB2aWRlb1RyYWNrLnNhbXBsZXMubGVuZ3RoKTtcbiAgICBpZiAodmlkZW9UcmFjay5zYW1wbGVzLmxlbmd0aCkge1xuICAgICAgdGhpcy5yZW11eFZpZGVvKHZpZGVvVHJhY2ssdGltZU9mZnNldCxjb250aWd1b3VzKTtcbiAgICB9XG4gICAgLy9sb2dnZXIubG9nKCduYiBBQUMgc2FtcGxlczonICsgYXVkaW9UcmFjay5zYW1wbGVzLmxlbmd0aCk7XG4gICAgaWYgKGF1ZGlvVHJhY2suc2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgIHRoaXMucmVtdXhBdWRpbyhhdWRpb1RyYWNrLHRpbWVPZmZzZXQsY29udGlndW91cyk7XG4gICAgfVxuICAgIC8vbG9nZ2VyLmxvZygnbmIgSUQzIHNhbXBsZXM6JyArIGF1ZGlvVHJhY2suc2FtcGxlcy5sZW5ndGgpO1xuICAgIGlmIChpZDNUcmFjay5zYW1wbGVzLmxlbmd0aCkge1xuICAgICAgdGhpcy5yZW11eElEMyhpZDNUcmFjayx0aW1lT2Zmc2V0KTtcbiAgICB9XG4gICAgLy9ub3RpZnkgZW5kIG9mIHBhcnNpbmdcbiAgICB0aGlzLm9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTRUQpO1xuICB9XG5cbiAgZ2VuZXJhdGVJUyhhdWRpb1RyYWNrLHZpZGVvVHJhY2ssdGltZU9mZnNldCkge1xuICAgIHZhciBvYnNlcnZlciA9IHRoaXMub2JzZXJ2ZXIsXG4gICAgICAgIGF1ZGlvU2FtcGxlcyA9IGF1ZGlvVHJhY2suc2FtcGxlcyxcbiAgICAgICAgdmlkZW9TYW1wbGVzID0gdmlkZW9UcmFjay5zYW1wbGVzLFxuICAgICAgICBuYkF1ZGlvID0gYXVkaW9TYW1wbGVzLmxlbmd0aCxcbiAgICAgICAgbmJWaWRlbyA9IHZpZGVvU2FtcGxlcy5sZW5ndGgsXG4gICAgICAgIHBlc1RpbWVTY2FsZSA9IHRoaXMuUEVTX1RJTUVTQ0FMRTtcblxuICAgIGlmKG5iQXVkaW8gPT09IDAgJiYgbmJWaWRlbyA9PT0gMCkge1xuICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGUgOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuRlJBR19QQVJTSU5HX0VSUk9SLCBmYXRhbDogZmFsc2UsIHJlYXNvbjogJ25vIGF1ZGlvL3ZpZGVvIHNhbXBsZXMgZm91bmQnfSk7XG4gICAgfSBlbHNlIGlmIChuYlZpZGVvID09PSAwKSB7XG4gICAgICAvL2F1ZGlvIG9ubHlcbiAgICAgIGlmIChhdWRpb1RyYWNrLmNvbmZpZykge1xuICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULCB7XG4gICAgICAgICAgYXVkaW9Nb292OiBNUDQuaW5pdFNlZ21lbnQoW2F1ZGlvVHJhY2tdKSxcbiAgICAgICAgICBhdWRpb0NvZGVjIDogYXVkaW9UcmFjay5jb2RlYyxcbiAgICAgICAgICBhdWRpb0NoYW5uZWxDb3VudCA6IGF1ZGlvVHJhY2suY2hhbm5lbENvdW50XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLklTR2VuZXJhdGVkID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLl9pbml0UFRTID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgLy8gcmVtZW1iZXIgZmlyc3QgUFRTIG9mIHRoaXMgZGVtdXhpbmcgY29udGV4dFxuICAgICAgICB0aGlzLl9pbml0UFRTID0gYXVkaW9TYW1wbGVzWzBdLnB0cyAtIHBlc1RpbWVTY2FsZSAqIHRpbWVPZmZzZXQ7XG4gICAgICAgIHRoaXMuX2luaXREVFMgPSBhdWRpb1NhbXBsZXNbMF0uZHRzIC0gcGVzVGltZVNjYWxlICogdGltZU9mZnNldDtcbiAgICAgIH1cbiAgICB9IGVsc2VcbiAgICBpZiAobmJBdWRpbyA9PT0gMCkge1xuICAgICAgLy92aWRlbyBvbmx5XG4gICAgICBpZiAodmlkZW9UcmFjay5zcHMgJiYgdmlkZW9UcmFjay5wcHMpIHtcbiAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCwge1xuICAgICAgICAgIHZpZGVvTW9vdjogTVA0LmluaXRTZWdtZW50KFt2aWRlb1RyYWNrXSksXG4gICAgICAgICAgdmlkZW9Db2RlYzogdmlkZW9UcmFjay5jb2RlYyxcbiAgICAgICAgICB2aWRlb1dpZHRoOiB2aWRlb1RyYWNrLndpZHRoLFxuICAgICAgICAgIHZpZGVvSGVpZ2h0OiB2aWRlb1RyYWNrLmhlaWdodFxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5JU0dlbmVyYXRlZCA9IHRydWU7XG4gICAgICAgIGlmICh0aGlzLl9pbml0UFRTID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAvLyByZW1lbWJlciBmaXJzdCBQVFMgb2YgdGhpcyBkZW11eGluZyBjb250ZXh0XG4gICAgICAgICAgdGhpcy5faW5pdFBUUyA9IHZpZGVvU2FtcGxlc1swXS5wdHMgLSBwZXNUaW1lU2NhbGUgKiB0aW1lT2Zmc2V0O1xuICAgICAgICAgIHRoaXMuX2luaXREVFMgPSB2aWRlb1NhbXBsZXNbMF0uZHRzIC0gcGVzVGltZVNjYWxlICogdGltZU9mZnNldDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvL2F1ZGlvIGFuZCB2aWRlb1xuICAgICAgaWYgKGF1ZGlvVHJhY2suY29uZmlnICYmIHZpZGVvVHJhY2suc3BzICYmIHZpZGVvVHJhY2sucHBzKSB7XG4gICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULCB7XG4gICAgICAgICAgYXVkaW9Nb292OiBNUDQuaW5pdFNlZ21lbnQoW2F1ZGlvVHJhY2tdKSxcbiAgICAgICAgICBhdWRpb0NvZGVjOiBhdWRpb1RyYWNrLmNvZGVjLFxuICAgICAgICAgIGF1ZGlvQ2hhbm5lbENvdW50OiBhdWRpb1RyYWNrLmNoYW5uZWxDb3VudCxcbiAgICAgICAgICB2aWRlb01vb3Y6IE1QNC5pbml0U2VnbWVudChbdmlkZW9UcmFja10pLFxuICAgICAgICAgIHZpZGVvQ29kZWM6IHZpZGVvVHJhY2suY29kZWMsXG4gICAgICAgICAgdmlkZW9XaWR0aDogdmlkZW9UcmFjay53aWR0aCxcbiAgICAgICAgICB2aWRlb0hlaWdodDogdmlkZW9UcmFjay5oZWlnaHRcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuSVNHZW5lcmF0ZWQgPSB0cnVlO1xuICAgICAgICBpZiAodGhpcy5faW5pdFBUUyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgLy8gcmVtZW1iZXIgZmlyc3QgUFRTIG9mIHRoaXMgZGVtdXhpbmcgY29udGV4dFxuICAgICAgICAgIHRoaXMuX2luaXRQVFMgPSBNYXRoLm1pbih2aWRlb1NhbXBsZXNbMF0ucHRzLCBhdWRpb1NhbXBsZXNbMF0ucHRzKSAtIHBlc1RpbWVTY2FsZSAqIHRpbWVPZmZzZXQ7XG4gICAgICAgICAgdGhpcy5faW5pdERUUyA9IE1hdGgubWluKHZpZGVvU2FtcGxlc1swXS5kdHMsIGF1ZGlvU2FtcGxlc1swXS5kdHMpIC0gcGVzVGltZVNjYWxlICogdGltZU9mZnNldDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJlbXV4VmlkZW8odHJhY2ssIHRpbWVPZmZzZXQsIGNvbnRpZ3VvdXMpIHtcbiAgICB2YXIgdmlldyxcbiAgICAgICAgb2Zmc2V0ID0gOCxcbiAgICAgICAgcGVzVGltZVNjYWxlID0gdGhpcy5QRVNfVElNRVNDQUxFLFxuICAgICAgICBwZXMybXA0U2NhbGVGYWN0b3IgPSB0aGlzLlBFUzJNUDRTQ0FMRUZBQ1RPUixcbiAgICAgICAgYXZjU2FtcGxlLFxuICAgICAgICBtcDRTYW1wbGUsXG4gICAgICAgIG1wNFNhbXBsZUxlbmd0aCxcbiAgICAgICAgdW5pdCxcbiAgICAgICAgbWRhdCwgbW9vZixcbiAgICAgICAgZmlyc3RQVFMsIGZpcnN0RFRTLCBsYXN0RFRTLFxuICAgICAgICBwdHMsIGR0cywgcHRzbm9ybSwgZHRzbm9ybSxcbiAgICAgICAgc2FtcGxlcyA9IFtdO1xuICAgIC8qIGNvbmNhdGVuYXRlIHRoZSB2aWRlbyBkYXRhIGFuZCBjb25zdHJ1Y3QgdGhlIG1kYXQgaW4gcGxhY2VcbiAgICAgIChuZWVkIDggbW9yZSBieXRlcyB0byBmaWxsIGxlbmd0aCBhbmQgbXBkYXQgdHlwZSkgKi9cbiAgICBtZGF0ID0gbmV3IFVpbnQ4QXJyYXkodHJhY2subGVuICsgKDQgKiB0cmFjay5uYk5hbHUpICsgOCk7XG4gICAgdmlldyA9IG5ldyBEYXRhVmlldyhtZGF0LmJ1ZmZlcik7XG4gICAgdmlldy5zZXRVaW50MzIoMCwgbWRhdC5ieXRlTGVuZ3RoKTtcbiAgICBtZGF0LnNldChNUDQudHlwZXMubWRhdCwgNCk7XG4gICAgd2hpbGUgKHRyYWNrLnNhbXBsZXMubGVuZ3RoKSB7XG4gICAgICBhdmNTYW1wbGUgPSB0cmFjay5zYW1wbGVzLnNoaWZ0KCk7XG4gICAgICBtcDRTYW1wbGVMZW5ndGggPSAwO1xuICAgICAgLy8gY29udmVydCBOQUxVIGJpdHN0cmVhbSB0byBNUDQgZm9ybWF0IChwcmVwZW5kIE5BTFUgd2l0aCBzaXplIGZpZWxkKVxuICAgICAgd2hpbGUgKGF2Y1NhbXBsZS51bml0cy51bml0cy5sZW5ndGgpIHtcbiAgICAgICAgdW5pdCA9IGF2Y1NhbXBsZS51bml0cy51bml0cy5zaGlmdCgpO1xuICAgICAgICB2aWV3LnNldFVpbnQzMihvZmZzZXQsIHVuaXQuZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICAgICAgb2Zmc2V0ICs9IDQ7XG4gICAgICAgIG1kYXQuc2V0KHVuaXQuZGF0YSwgb2Zmc2V0KTtcbiAgICAgICAgb2Zmc2V0ICs9IHVuaXQuZGF0YS5ieXRlTGVuZ3RoO1xuICAgICAgICBtcDRTYW1wbGVMZW5ndGggKz0gNCArIHVuaXQuZGF0YS5ieXRlTGVuZ3RoO1xuICAgICAgfVxuICAgICAgcHRzID0gYXZjU2FtcGxlLnB0cyAtIHRoaXMuX2luaXREVFM7XG4gICAgICBkdHMgPSBhdmNTYW1wbGUuZHRzIC0gdGhpcy5faW5pdERUUztcbiAgICAgIC8vIGVuc3VyZSBEVFMgaXMgbm90IGJpZ2dlciB0aGFuIFBUU1xuICAgICAgZHRzID0gTWF0aC5taW4ocHRzLGR0cyk7XG4gICAgICAvL2xvZ2dlci5sb2coYFZpZGVvL1BUUy9EVFM6JHtwdHN9LyR7ZHRzfWApO1xuICAgICAgLy8gaWYgbm90IGZpcnN0IEFWQyBzYW1wbGUgb2YgdmlkZW8gdHJhY2ssIG5vcm1hbGl6ZSBQVFMvRFRTIHdpdGggcHJldmlvdXMgc2FtcGxlIHZhbHVlXG4gICAgICAvLyBhbmQgZW5zdXJlIHRoYXQgc2FtcGxlIGR1cmF0aW9uIGlzIHBvc2l0aXZlXG4gICAgICBpZiAobGFzdERUUyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHB0c25vcm0gPSB0aGlzLl9QVFNOb3JtYWxpemUocHRzLCBsYXN0RFRTKTtcbiAgICAgICAgZHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShkdHMsIGxhc3REVFMpO1xuICAgICAgICB2YXIgc2FtcGxlRHVyYXRpb24gPSAoZHRzbm9ybSAtIGxhc3REVFMpIC8gcGVzMm1wNFNjYWxlRmFjdG9yO1xuICAgICAgICBpZiAoc2FtcGxlRHVyYXRpb24gPD0gMCkge1xuICAgICAgICAgIGxvZ2dlci5sb2coYGludmFsaWQgc2FtcGxlIGR1cmF0aW9uIGF0IFBUUy9EVFM6ICR7YXZjU2FtcGxlLnB0c30vJHthdmNTYW1wbGUuZHRzfToke3NhbXBsZUR1cmF0aW9ufWApO1xuICAgICAgICAgIHNhbXBsZUR1cmF0aW9uID0gMTtcbiAgICAgICAgfVxuICAgICAgICBtcDRTYW1wbGUuZHVyYXRpb24gPSBzYW1wbGVEdXJhdGlvbjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBuZXh0QXZjRHRzID0gdGhpcy5uZXh0QXZjRHRzLGRlbHRhO1xuICAgICAgICAvLyBmaXJzdCBBVkMgc2FtcGxlIG9mIHZpZGVvIHRyYWNrLCBub3JtYWxpemUgUFRTL0RUU1xuICAgICAgICBwdHNub3JtID0gdGhpcy5fUFRTTm9ybWFsaXplKHB0cywgbmV4dEF2Y0R0cyk7XG4gICAgICAgIGR0c25vcm0gPSB0aGlzLl9QVFNOb3JtYWxpemUoZHRzLCBuZXh0QXZjRHRzKTtcbiAgICAgICAgZGVsdGEgPSBNYXRoLnJvdW5kKChkdHNub3JtIC0gbmV4dEF2Y0R0cykgLyA5MCk7XG4gICAgICAgIC8vIGlmIGZyYWdtZW50IGFyZSBjb250aWd1b3VzLCBvciBkZWx0YSBsZXNzIHRoYW4gNjAwbXMsIGVuc3VyZSB0aGVyZSBpcyBubyBvdmVybGFwL2hvbGUgYmV0d2VlbiBmcmFnbWVudHNcbiAgICAgICAgaWYgKGNvbnRpZ3VvdXMgfHwgTWF0aC5hYnMoZGVsdGEpIDwgNjAwKSB7XG4gICAgICAgICAgaWYgKGRlbHRhKSB7XG4gICAgICAgICAgICBpZiAoZGVsdGEgPiAxKSB7XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coYEFWQzoke2RlbHRhfSBtcyBob2xlIGJldHdlZW4gZnJhZ21lbnRzIGRldGVjdGVkLGZpbGxpbmcgaXRgKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZGVsdGEgPCAtMSkge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBBVkM6JHsoLWRlbHRhKX0gbXMgb3ZlcmxhcHBpbmcgYmV0d2VlbiBmcmFnbWVudHMgZGV0ZWN0ZWRgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIHNldCBEVFMgdG8gbmV4dCBEVFNcbiAgICAgICAgICAgIGR0c25vcm0gPSBuZXh0QXZjRHRzO1xuICAgICAgICAgICAgLy8gb2Zmc2V0IFBUUyBhcyB3ZWxsLCBlbnN1cmUgdGhhdCBQVFMgaXMgc21hbGxlciBvciBlcXVhbCB0aGFuIG5ldyBEVFNcbiAgICAgICAgICAgIHB0c25vcm0gPSBNYXRoLm1heChwdHNub3JtIC0gZGVsdGEsIGR0c25vcm0pO1xuICAgICAgICAgICAgbG9nZ2VyLmxvZyhgVmlkZW8vUFRTL0RUUyBhZGp1c3RlZDogJHtwdHNub3JtfS8ke2R0c25vcm19LGRlbHRhOiR7ZGVsdGF9YCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIHJlbWVtYmVyIGZpcnN0IFBUUyBvZiBvdXIgYXZjU2FtcGxlcywgZW5zdXJlIHZhbHVlIGlzIHBvc2l0aXZlXG4gICAgICAgIGZpcnN0UFRTID0gTWF0aC5tYXgoMCwgcHRzbm9ybSk7XG4gICAgICAgIGZpcnN0RFRTID0gTWF0aC5tYXgoMCwgZHRzbm9ybSk7XG4gICAgICB9XG4gICAgICAvL2NvbnNvbGUubG9nKCdQVFMvRFRTL2luaXREVFMvbm9ybVBUUy9ub3JtRFRTL3JlbGF0aXZlIFBUUyA6ICR7YXZjU2FtcGxlLnB0c30vJHthdmNTYW1wbGUuZHRzfS8ke3RoaXMuX2luaXREVFN9LyR7cHRzbm9ybX0vJHtkdHNub3JtfS8keyhhdmNTYW1wbGUucHRzLzQyOTQ5NjcyOTYpLnRvRml4ZWQoMyl9Jyk7XG4gICAgICBtcDRTYW1wbGUgPSB7XG4gICAgICAgIHNpemU6IG1wNFNhbXBsZUxlbmd0aCxcbiAgICAgICAgZHVyYXRpb246IDAsXG4gICAgICAgIGN0czogKHB0c25vcm0gLSBkdHNub3JtKSAvIHBlczJtcDRTY2FsZUZhY3RvcixcbiAgICAgICAgZmxhZ3M6IHtcbiAgICAgICAgICBpc0xlYWRpbmc6IDAsXG4gICAgICAgICAgaXNEZXBlbmRlZE9uOiAwLFxuICAgICAgICAgIGhhc1JlZHVuZGFuY3k6IDAsXG4gICAgICAgICAgZGVncmFkUHJpbzogMFxuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgaWYgKGF2Y1NhbXBsZS5rZXkgPT09IHRydWUpIHtcbiAgICAgICAgLy8gdGhlIGN1cnJlbnQgc2FtcGxlIGlzIGEga2V5IGZyYW1lXG4gICAgICAgIG1wNFNhbXBsZS5mbGFncy5kZXBlbmRzT24gPSAyO1xuICAgICAgICBtcDRTYW1wbGUuZmxhZ3MuaXNOb25TeW5jID0gMDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG1wNFNhbXBsZS5mbGFncy5kZXBlbmRzT24gPSAxO1xuICAgICAgICBtcDRTYW1wbGUuZmxhZ3MuaXNOb25TeW5jID0gMTtcbiAgICAgIH1cbiAgICAgIHNhbXBsZXMucHVzaChtcDRTYW1wbGUpO1xuICAgICAgbGFzdERUUyA9IGR0c25vcm07XG4gICAgfVxuICAgIHZhciBsYXN0U2FtcGxlRHVyYXRpb24gPSAwO1xuICAgIGlmIChzYW1wbGVzLmxlbmd0aCA+PSAyKSB7XG4gICAgICBsYXN0U2FtcGxlRHVyYXRpb24gPSBzYW1wbGVzW3NhbXBsZXMubGVuZ3RoIC0gMl0uZHVyYXRpb247XG4gICAgICBtcDRTYW1wbGUuZHVyYXRpb24gPSBsYXN0U2FtcGxlRHVyYXRpb247XG4gICAgfVxuICAgIC8vIG5leHQgQVZDIHNhbXBsZSBEVFMgc2hvdWxkIGJlIGVxdWFsIHRvIGxhc3Qgc2FtcGxlIERUUyArIGxhc3Qgc2FtcGxlIGR1cmF0aW9uXG4gICAgdGhpcy5uZXh0QXZjRHRzID0gZHRzbm9ybSArIGxhc3RTYW1wbGVEdXJhdGlvbiAqIHBlczJtcDRTY2FsZUZhY3RvcjtcbiAgICB0cmFjay5sZW4gPSAwO1xuICAgIHRyYWNrLm5iTmFsdSA9IDA7XG4gICAgaWYoc2FtcGxlcy5sZW5ndGggJiYgbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLmluZGV4T2YoJ2Nocm9tZScpID4gLTEpIHtcbiAgICAgIHZhciBmbGFncyA9IHNhbXBsZXNbMF0uZmxhZ3M7XG4gICAgLy8gY2hyb21lIHdvcmthcm91bmQsIG1hcmsgZmlyc3Qgc2FtcGxlIGFzIGJlaW5nIGEgUmFuZG9tIEFjY2VzcyBQb2ludCB0byBhdm9pZCBzb3VyY2VidWZmZXIgYXBwZW5kIGlzc3VlXG4gICAgLy8gaHR0cHM6Ly9jb2RlLmdvb2dsZS5jb20vcC9jaHJvbWl1bS9pc3N1ZXMvZGV0YWlsP2lkPTIyOTQxMlxuICAgICAgZmxhZ3MuZGVwZW5kc09uID0gMjtcbiAgICAgIGZsYWdzLmlzTm9uU3luYyA9IDA7XG4gICAgfVxuICAgIHRyYWNrLnNhbXBsZXMgPSBzYW1wbGVzO1xuICAgIG1vb2YgPSBNUDQubW9vZih0cmFjay5zZXF1ZW5jZU51bWJlcisrLCBmaXJzdERUUyAvIHBlczJtcDRTY2FsZUZhY3RvciwgdHJhY2spO1xuICAgIHRyYWNrLnNhbXBsZXMgPSBbXTtcbiAgICB0aGlzLm9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0RBVEEsIHtcbiAgICAgIG1vb2Y6IG1vb2YsXG4gICAgICBtZGF0OiBtZGF0LFxuICAgICAgc3RhcnRQVFM6IGZpcnN0UFRTIC8gcGVzVGltZVNjYWxlLFxuICAgICAgZW5kUFRTOiAocHRzbm9ybSArIHBlczJtcDRTY2FsZUZhY3RvciAqIGxhc3RTYW1wbGVEdXJhdGlvbikgLyBwZXNUaW1lU2NhbGUsXG4gICAgICBzdGFydERUUzogZmlyc3REVFMgLyBwZXNUaW1lU2NhbGUsXG4gICAgICBlbmREVFM6IHRoaXMubmV4dEF2Y0R0cyAvIHBlc1RpbWVTY2FsZSxcbiAgICAgIHR5cGU6ICd2aWRlbycsXG4gICAgICBuYjogc2FtcGxlcy5sZW5ndGhcbiAgICB9KTtcbiAgfVxuXG4gIHJlbXV4QXVkaW8odHJhY2ssdGltZU9mZnNldCwgY29udGlndW91cykge1xuICAgIHZhciB2aWV3LFxuICAgICAgICBvZmZzZXQgPSA4LFxuICAgICAgICBwZXNUaW1lU2NhbGUgPSB0aGlzLlBFU19USU1FU0NBTEUsXG4gICAgICAgIHBlczJtcDRTY2FsZUZhY3RvciA9IHRoaXMuUEVTMk1QNFNDQUxFRkFDVE9SLFxuICAgICAgICBhYWNTYW1wbGUsIG1wNFNhbXBsZSxcbiAgICAgICAgdW5pdCxcbiAgICAgICAgbWRhdCwgbW9vZixcbiAgICAgICAgZmlyc3RQVFMsIGZpcnN0RFRTLCBsYXN0RFRTLFxuICAgICAgICBwdHMsIGR0cywgcHRzbm9ybSwgZHRzbm9ybSxcbiAgICAgICAgc2FtcGxlcyA9IFtdO1xuXG4gICAgd2hpbGUgKHRyYWNrLnNhbXBsZXMubGVuZ3RoKSB7XG4gICAgICBhYWNTYW1wbGUgPSB0cmFjay5zYW1wbGVzLnNoaWZ0KCk7XG4gICAgICB1bml0ID0gYWFjU2FtcGxlLnVuaXQ7XG4gICAgICBwdHMgPSBhYWNTYW1wbGUucHRzIC0gdGhpcy5faW5pdERUUztcbiAgICAgIGR0cyA9IGFhY1NhbXBsZS5kdHMgLSB0aGlzLl9pbml0RFRTO1xuICAgICAgLy9sb2dnZXIubG9nKCdBdWRpby9QVFM6JyArIGFhY1NhbXBsZS5wdHMudG9GaXhlZCgwKSk7XG4gICAgICAvLyBpZiBub3QgZmlyc3Qgc2FtcGxlXG4gICAgICBpZiAobGFzdERUUyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHB0c25vcm0gPSB0aGlzLl9QVFNOb3JtYWxpemUocHRzLCBsYXN0RFRTKTtcbiAgICAgICAgZHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShkdHMsIGxhc3REVFMpO1xuICAgICAgICAvLyBsZXQncyBjb21wdXRlIHNhbXBsZSBkdXJhdGlvblxuICAgICAgICBtcDRTYW1wbGUuZHVyYXRpb24gPSAoZHRzbm9ybSAtIGxhc3REVFMpIC8gcGVzMm1wNFNjYWxlRmFjdG9yO1xuICAgICAgICBpZiAobXA0U2FtcGxlLmR1cmF0aW9uIDwgMCkge1xuICAgICAgICAgIC8vIG5vdCBleHBlY3RlZCB0byBoYXBwZW4gLi4uXG4gICAgICAgICAgbG9nZ2VyLmxvZyhgaW52YWxpZCBBQUMgc2FtcGxlIGR1cmF0aW9uIGF0IFBUUzoke2FhY1NhbXBsZS5wdHN9OiR7bXA0U2FtcGxlLmR1cmF0aW9ufWApO1xuICAgICAgICAgIG1wNFNhbXBsZS5kdXJhdGlvbiA9IDA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBuZXh0QWFjUHRzID0gdGhpcy5uZXh0QWFjUHRzLGRlbHRhO1xuICAgICAgICBwdHNub3JtID0gdGhpcy5fUFRTTm9ybWFsaXplKHB0cywgbmV4dEFhY1B0cyk7XG4gICAgICAgIGR0c25vcm0gPSB0aGlzLl9QVFNOb3JtYWxpemUoZHRzLCBuZXh0QWFjUHRzKTtcbiAgICAgICAgZGVsdGEgPSBNYXRoLnJvdW5kKDEwMDAgKiAocHRzbm9ybSAtIG5leHRBYWNQdHMpIC8gcGVzVGltZVNjYWxlKTtcbiAgICAgICAgLy8gaWYgZnJhZ21lbnQgYXJlIGNvbnRpZ3VvdXMsIG9yIGRlbHRhIGxlc3MgdGhhbiA2MDBtcywgZW5zdXJlIHRoZXJlIGlzIG5vIG92ZXJsYXAvaG9sZSBiZXR3ZWVuIGZyYWdtZW50c1xuICAgICAgICBpZiAoY29udGlndW91cyB8fCBNYXRoLmFicyhkZWx0YSkgPCA2MDApIHtcbiAgICAgICAgICAvLyBsb2cgZGVsdGFcbiAgICAgICAgICBpZiAoZGVsdGEpIHtcbiAgICAgICAgICAgIGlmIChkZWx0YSA+IDApIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgJHtkZWx0YX0gbXMgaG9sZSBiZXR3ZWVuIEFBQyBzYW1wbGVzIGRldGVjdGVkLGZpbGxpbmcgaXRgKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZGVsdGEgPCAwKSB7XG4gICAgICAgICAgICAgIC8vIGRyb3Agb3ZlcmxhcHBpbmcgYXVkaW8gZnJhbWVzLi4uIGJyb3dzZXIgd2lsbCBkZWFsIHdpdGggaXRcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgJHsoLWRlbHRhKX0gbXMgb3ZlcmxhcHBpbmcgYmV0d2VlbiBBQUMgc2FtcGxlcyBkZXRlY3RlZCwgZHJvcCBmcmFtZWApO1xuICAgICAgICAgICAgICB0cmFjay5sZW4gLT0gdW5pdC5ieXRlTGVuZ3RoO1xuICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIHNldCBEVFMgdG8gbmV4dCBEVFNcbiAgICAgICAgICAgIHB0c25vcm0gPSBkdHNub3JtID0gbmV4dEFhY1B0cztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gcmVtZW1iZXIgZmlyc3QgUFRTIG9mIG91ciBhYWNTYW1wbGVzLCBlbnN1cmUgdmFsdWUgaXMgcG9zaXRpdmVcbiAgICAgICAgZmlyc3RQVFMgPSBNYXRoLm1heCgwLCBwdHNub3JtKTtcbiAgICAgICAgZmlyc3REVFMgPSBNYXRoLm1heCgwLCBkdHNub3JtKTtcbiAgICAgICAgLyogY29uY2F0ZW5hdGUgdGhlIGF1ZGlvIGRhdGEgYW5kIGNvbnN0cnVjdCB0aGUgbWRhdCBpbiBwbGFjZVxuICAgICAgICAgIChuZWVkIDggbW9yZSBieXRlcyB0byBmaWxsIGxlbmd0aCBhbmQgbWRhdCB0eXBlKSAqL1xuICAgICAgICBtZGF0ID0gbmV3IFVpbnQ4QXJyYXkodHJhY2subGVuICsgOCk7XG4gICAgICAgIHZpZXcgPSBuZXcgRGF0YVZpZXcobWRhdC5idWZmZXIpO1xuICAgICAgICB2aWV3LnNldFVpbnQzMigwLCBtZGF0LmJ5dGVMZW5ndGgpO1xuICAgICAgICBtZGF0LnNldChNUDQudHlwZXMubWRhdCwgNCk7XG4gICAgICB9XG4gICAgICBtZGF0LnNldCh1bml0LCBvZmZzZXQpO1xuICAgICAgb2Zmc2V0ICs9IHVuaXQuYnl0ZUxlbmd0aDtcbiAgICAgIC8vY29uc29sZS5sb2coJ1BUUy9EVFMvaW5pdERUUy9ub3JtUFRTL25vcm1EVFMvcmVsYXRpdmUgUFRTIDogJHthYWNTYW1wbGUucHRzfS8ke2FhY1NhbXBsZS5kdHN9LyR7dGhpcy5faW5pdERUU30vJHtwdHNub3JtfS8ke2R0c25vcm19LyR7KGFhY1NhbXBsZS5wdHMvNDI5NDk2NzI5NikudG9GaXhlZCgzKX0nKTtcbiAgICAgIG1wNFNhbXBsZSA9IHtcbiAgICAgICAgc2l6ZTogdW5pdC5ieXRlTGVuZ3RoLFxuICAgICAgICBjdHM6IDAsXG4gICAgICAgIGR1cmF0aW9uOjAsXG4gICAgICAgIGZsYWdzOiB7XG4gICAgICAgICAgaXNMZWFkaW5nOiAwLFxuICAgICAgICAgIGlzRGVwZW5kZWRPbjogMCxcbiAgICAgICAgICBoYXNSZWR1bmRhbmN5OiAwLFxuICAgICAgICAgIGRlZ3JhZFByaW86IDAsXG4gICAgICAgICAgZGVwZW5kc09uOiAxLFxuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgc2FtcGxlcy5wdXNoKG1wNFNhbXBsZSk7XG4gICAgICBsYXN0RFRTID0gZHRzbm9ybTtcbiAgICB9XG4gICAgdmFyIGxhc3RTYW1wbGVEdXJhdGlvbiA9IDA7XG4gICAgLy9zZXQgbGFzdCBzYW1wbGUgZHVyYXRpb24gYXMgYmVpbmcgaWRlbnRpY2FsIHRvIHByZXZpb3VzIHNhbXBsZVxuICAgIGlmIChzYW1wbGVzLmxlbmd0aCA+PSAyKSB7XG4gICAgICBsYXN0U2FtcGxlRHVyYXRpb24gPSBzYW1wbGVzW3NhbXBsZXMubGVuZ3RoIC0gMl0uZHVyYXRpb247XG4gICAgICBtcDRTYW1wbGUuZHVyYXRpb24gPSBsYXN0U2FtcGxlRHVyYXRpb247XG4gICAgfVxuICAgIC8vIG5leHQgYWFjIHNhbXBsZSBQVFMgc2hvdWxkIGJlIGVxdWFsIHRvIGxhc3Qgc2FtcGxlIFBUUyArIGR1cmF0aW9uXG4gICAgdGhpcy5uZXh0QWFjUHRzID0gcHRzbm9ybSArIHBlczJtcDRTY2FsZUZhY3RvciAqIGxhc3RTYW1wbGVEdXJhdGlvbjtcbiAgICAvL2xvZ2dlci5sb2coJ0F1ZGlvL1BUUy9QVFNlbmQ6JyArIGFhY1NhbXBsZS5wdHMudG9GaXhlZCgwKSArICcvJyArIHRoaXMubmV4dEFhY0R0cy50b0ZpeGVkKDApKTtcbiAgICB0cmFjay5sZW4gPSAwO1xuICAgIHRyYWNrLnNhbXBsZXMgPSBzYW1wbGVzO1xuICAgIG1vb2YgPSBNUDQubW9vZih0cmFjay5zZXF1ZW5jZU51bWJlcisrLCBmaXJzdERUUyAvIHBlczJtcDRTY2FsZUZhY3RvciwgdHJhY2spO1xuICAgIHRyYWNrLnNhbXBsZXMgPSBbXTtcbiAgICB0aGlzLm9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0RBVEEsIHtcbiAgICAgIG1vb2Y6IG1vb2YsXG4gICAgICBtZGF0OiBtZGF0LFxuICAgICAgc3RhcnRQVFM6IGZpcnN0UFRTIC8gcGVzVGltZVNjYWxlLFxuICAgICAgZW5kUFRTOiB0aGlzLm5leHRBYWNQdHMgLyBwZXNUaW1lU2NhbGUsXG4gICAgICBzdGFydERUUzogZmlyc3REVFMgLyBwZXNUaW1lU2NhbGUsXG4gICAgICBlbmREVFM6IChkdHNub3JtICsgcGVzMm1wNFNjYWxlRmFjdG9yICogbGFzdFNhbXBsZUR1cmF0aW9uKSAvIHBlc1RpbWVTY2FsZSxcbiAgICAgIHR5cGU6ICdhdWRpbycsXG4gICAgICBuYjogc2FtcGxlcy5sZW5ndGhcbiAgICB9KTtcbiAgfVxuXG4gIHJlbXV4SUQzKHRyYWNrLHRpbWVPZmZzZXQpIHtcbiAgICB2YXIgbGVuZ3RoID0gdHJhY2suc2FtcGxlcy5sZW5ndGgsIHNhbXBsZTtcbiAgICAvLyBjb25zdW1lIHNhbXBsZXNcbiAgICBpZihsZW5ndGgpIHtcbiAgICAgIGZvcih2YXIgaW5kZXggPSAwOyBpbmRleCA8IGxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICBzYW1wbGUgPSB0cmFjay5zYW1wbGVzW2luZGV4XTtcbiAgICAgICAgLy8gc2V0dGluZyBpZDMgcHRzLCBkdHMgdG8gcmVsYXRpdmUgdGltZVxuICAgICAgICAvLyB1c2luZyB0aGlzLl9pbml0UFRTIGFuZCB0aGlzLl9pbml0RFRTIHRvIGNhbGN1bGF0ZSByZWxhdGl2ZSB0aW1lXG4gICAgICAgIHNhbXBsZS5wdHMgPSAoKHNhbXBsZS5wdHMgLSB0aGlzLl9pbml0UFRTKSAvIHRoaXMuUEVTX1RJTUVTQ0FMRSk7XG4gICAgICAgIHNhbXBsZS5kdHMgPSAoKHNhbXBsZS5kdHMgLSB0aGlzLl9pbml0RFRTKSAvIHRoaXMuUEVTX1RJTUVTQ0FMRSk7XG4gICAgICB9XG4gICAgICB0aGlzLm9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX01FVEFEQVRBLCB7XG4gICAgICAgIHNhbXBsZXM6dHJhY2suc2FtcGxlc1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgdHJhY2suc2FtcGxlcyA9IFtdO1xuICAgIHRpbWVPZmZzZXQgPSB0aW1lT2Zmc2V0O1xuICB9XG5cbiAgX1BUU05vcm1hbGl6ZSh2YWx1ZSwgcmVmZXJlbmNlKSB7XG4gICAgdmFyIG9mZnNldDtcbiAgICBpZiAocmVmZXJlbmNlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG4gICAgaWYgKHJlZmVyZW5jZSA8IHZhbHVlKSB7XG4gICAgICAvLyAtIDJeMzNcbiAgICAgIG9mZnNldCA9IC04NTg5OTM0NTkyO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyArIDJeMzNcbiAgICAgIG9mZnNldCA9IDg1ODk5MzQ1OTI7XG4gICAgfVxuICAgIC8qIFBUUyBpcyAzM2JpdCAoZnJvbSAwIHRvIDJeMzMgLTEpXG4gICAgICBpZiBkaWZmIGJldHdlZW4gdmFsdWUgYW5kIHJlZmVyZW5jZSBpcyBiaWdnZXIgdGhhbiBoYWxmIG9mIHRoZSBhbXBsaXR1ZGUgKDJeMzIpIHRoZW4gaXQgbWVhbnMgdGhhdFxuICAgICAgUFRTIGxvb3Bpbmcgb2NjdXJlZC4gZmlsbCB0aGUgZ2FwICovXG4gICAgd2hpbGUgKE1hdGguYWJzKHZhbHVlIC0gcmVmZXJlbmNlKSA+IDQyOTQ5NjcyOTYpIHtcbiAgICAgICAgdmFsdWUgKz0gb2Zmc2V0O1xuICAgIH1cbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBNUDRSZW11eGVyO1xuIiwiXG4vLyBhZGFwdGVkIGZyb20gaHR0cHM6Ly9naXRodWIuY29tL2thbm9uZ2lsL25vZGUtbTN1OHBhcnNlL2Jsb2IvbWFzdGVyL2F0dHJsaXN0LmpzXG5jbGFzcyBBdHRyTGlzdCB7XG5cbiAgY29uc3RydWN0b3IoYXR0cnMpIHtcbiAgICBpZiAodHlwZW9mIGF0dHJzID09PSAnc3RyaW5nJykge1xuICAgICAgYXR0cnMgPSBBdHRyTGlzdC5wYXJzZUF0dHJMaXN0KGF0dHJzKTtcbiAgICB9XG4gICAgZm9yKHZhciBhdHRyIGluIGF0dHJzKXtcbiAgICAgIGlmKGF0dHJzLmhhc093blByb3BlcnR5KGF0dHIpKSB7XG4gICAgICAgIHRoaXNbYXR0cl0gPSBhdHRyc1thdHRyXTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBkZWNpbWFsSW50ZWdlcihhdHRyTmFtZSkge1xuICAgIGNvbnN0IGludFZhbHVlID0gcGFyc2VJbnQodGhpc1thdHRyTmFtZV0sIDEwKTtcbiAgICBpZiAoaW50VmFsdWUgPiBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUikge1xuICAgICAgcmV0dXJuIEluZmluaXR5O1xuICAgIH1cbiAgICByZXR1cm4gaW50VmFsdWU7XG4gIH1cblxuICBoZXhhZGVjaW1hbEludGVnZXIoYXR0ck5hbWUpIHtcbiAgICBpZih0aGlzW2F0dHJOYW1lXSkge1xuICAgICAgbGV0IHN0cmluZ1ZhbHVlID0gKHRoaXNbYXR0ck5hbWVdIHx8ICcweCcpLnNsaWNlKDIpO1xuICAgICAgc3RyaW5nVmFsdWUgPSAoKHN0cmluZ1ZhbHVlLmxlbmd0aCAmIDEpID8gJzAnIDogJycpICsgc3RyaW5nVmFsdWU7XG5cbiAgICAgIGNvbnN0IHZhbHVlID0gbmV3IFVpbnQ4QXJyYXkoc3RyaW5nVmFsdWUubGVuZ3RoIC8gMik7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0cmluZ1ZhbHVlLmxlbmd0aCAvIDI7IGkrKykge1xuICAgICAgICB2YWx1ZVtpXSA9IHBhcnNlSW50KHN0cmluZ1ZhbHVlLnNsaWNlKGkgKiAyLCBpICogMiArIDIpLCAxNik7XG4gICAgICB9XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGhleGFkZWNpbWFsSW50ZWdlckFzTnVtYmVyKGF0dHJOYW1lKSB7XG4gICAgY29uc3QgaW50VmFsdWUgPSBwYXJzZUludCh0aGlzW2F0dHJOYW1lXSwgMTYpO1xuICAgIGlmIChpbnRWYWx1ZSA+IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSKSB7XG4gICAgICByZXR1cm4gSW5maW5pdHk7XG4gICAgfVxuICAgIHJldHVybiBpbnRWYWx1ZTtcbiAgfVxuXG4gIGRlY2ltYWxGbG9hdGluZ1BvaW50KGF0dHJOYW1lKSB7XG4gICAgcmV0dXJuIHBhcnNlRmxvYXQodGhpc1thdHRyTmFtZV0pO1xuICB9XG5cbiAgZW51bWVyYXRlZFN0cmluZyhhdHRyTmFtZSkge1xuICAgIHJldHVybiB0aGlzW2F0dHJOYW1lXTtcbiAgfVxuXG4gIGRlY2ltYWxSZXNvbHV0aW9uKGF0dHJOYW1lKSB7XG4gICAgY29uc3QgcmVzID0gL14oXFxkKyl4KFxcZCspJC8uZXhlYyh0aGlzW2F0dHJOYW1lXSk7XG4gICAgaWYgKHJlcyA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIHdpZHRoOiBwYXJzZUludChyZXNbMV0sIDEwKSxcbiAgICAgIGhlaWdodDogcGFyc2VJbnQocmVzWzJdLCAxMClcbiAgICB9O1xuICB9XG5cbiAgc3RhdGljIHBhcnNlQXR0ckxpc3QoaW5wdXQpIHtcbiAgICBjb25zdCByZSA9IC8oLis/KT0oKD86XFxcIi4qP1xcXCIpfC4qPykoPzosfCQpL2c7XG4gICAgdmFyIG1hdGNoLCBhdHRycyA9IHt9O1xuICAgIHdoaWxlICgobWF0Y2ggPSByZS5leGVjKGlucHV0KSkgIT09IG51bGwpIHtcbiAgICAgIHZhciB2YWx1ZSA9IG1hdGNoWzJdLCBxdW90ZSA9ICdcIic7XG5cbiAgICAgIGlmICh2YWx1ZS5pbmRleE9mKHF1b3RlKSA9PT0gMCAmJlxuICAgICAgICAgIHZhbHVlLmxhc3RJbmRleE9mKHF1b3RlKSA9PT0gKHZhbHVlLmxlbmd0aC0xKSkge1xuICAgICAgICB2YWx1ZSA9IHZhbHVlLnNsaWNlKDEsIC0xKTtcbiAgICAgIH1cbiAgICAgIGF0dHJzW21hdGNoWzFdXSA9IHZhbHVlO1xuICAgIH1cbiAgICByZXR1cm4gYXR0cnM7XG4gIH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBBdHRyTGlzdDtcbiIsInZhciBCaW5hcnlTZWFyY2ggPSB7XG4gICAgLyoqXG4gICAgICogU2VhcmNoZXMgZm9yIGFuIGl0ZW0gaW4gYW4gYXJyYXkgd2hpY2ggbWF0Y2hlcyBhIGNlcnRhaW4gY29uZGl0aW9uLlxuICAgICAqIFRoaXMgcmVxdWlyZXMgdGhlIGNvbmRpdGlvbiB0byBvbmx5IG1hdGNoIG9uZSBpdGVtIGluIHRoZSBhcnJheSxcbiAgICAgKiBhbmQgZm9yIHRoZSBhcnJheSB0byBiZSBvcmRlcmVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBcnJheX0gbGlzdCBUaGUgYXJyYXkgdG8gc2VhcmNoLlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGNvbXBhcmlzb25GdW5jdGlvblxuICAgICAqICAgICAgQ2FsbGVkIGFuZCBwcm92aWRlZCBhIGNhbmRpZGF0ZSBpdGVtIGFzIHRoZSBmaXJzdCBhcmd1bWVudC5cbiAgICAgKiAgICAgIFNob3VsZCByZXR1cm46XG4gICAgICogICAgICAgICAgPiAtMSBpZiB0aGUgaXRlbSBzaG91bGQgYmUgbG9jYXRlZCBhdCBhIGxvd2VyIGluZGV4IHRoYW4gdGhlIHByb3ZpZGVkIGl0ZW0uXG4gICAgICogICAgICAgICAgPiAxIGlmIHRoZSBpdGVtIHNob3VsZCBiZSBsb2NhdGVkIGF0IGEgaGlnaGVyIGluZGV4IHRoYW4gdGhlIHByb3ZpZGVkIGl0ZW0uXG4gICAgICogICAgICAgICAgPiAwIGlmIHRoZSBpdGVtIGlzIHRoZSBpdGVtIHlvdSdyZSBsb29raW5nIGZvci5cbiAgICAgKlxuICAgICAqIEByZXR1cm4geyp9IFRoZSBvYmplY3QgaWYgaXQgaXMgZm91bmQgb3IgbnVsbCBvdGhlcndpc2UuXG4gICAgICovXG4gICAgc2VhcmNoOiBmdW5jdGlvbihsaXN0LCBjb21wYXJpc29uRnVuY3Rpb24pIHtcbiAgICAgICAgdmFyIG1pbkluZGV4ID0gMDtcbiAgICAgICAgdmFyIG1heEluZGV4ID0gbGlzdC5sZW5ndGggLSAxO1xuICAgICAgICB2YXIgY3VycmVudEluZGV4ID0gbnVsbDtcbiAgICAgICAgdmFyIGN1cnJlbnRFbGVtZW50ID0gbnVsbDtcbiAgICAgXG4gICAgICAgIHdoaWxlIChtaW5JbmRleCA8PSBtYXhJbmRleCkge1xuICAgICAgICAgICAgY3VycmVudEluZGV4ID0gKG1pbkluZGV4ICsgbWF4SW5kZXgpIC8gMiB8IDA7XG4gICAgICAgICAgICBjdXJyZW50RWxlbWVudCA9IGxpc3RbY3VycmVudEluZGV4XTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdmFyIGNvbXBhcmlzb25SZXN1bHQgPSBjb21wYXJpc29uRnVuY3Rpb24oY3VycmVudEVsZW1lbnQpO1xuICAgICAgICAgICAgaWYgKGNvbXBhcmlzb25SZXN1bHQgPiAwKSB7XG4gICAgICAgICAgICAgICAgbWluSW5kZXggPSBjdXJyZW50SW5kZXggKyAxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoY29tcGFyaXNvblJlc3VsdCA8IDApIHtcbiAgICAgICAgICAgICAgICBtYXhJbmRleCA9IGN1cnJlbnRJbmRleCAtIDE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gY3VycmVudEVsZW1lbnQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQmluYXJ5U2VhcmNoO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBub29wKCkge31cblxuY29uc3QgZmFrZUxvZ2dlciA9IHtcbiAgdHJhY2U6IG5vb3AsXG4gIGRlYnVnOiBub29wLFxuICBsb2c6IG5vb3AsXG4gIHdhcm46IG5vb3AsXG4gIGluZm86IG5vb3AsXG4gIGVycm9yOiBub29wXG59O1xuXG5sZXQgZXhwb3J0ZWRMb2dnZXIgPSBmYWtlTG9nZ2VyO1xuXG4vL2xldCBsYXN0Q2FsbFRpbWU7XG4vLyBmdW5jdGlvbiBmb3JtYXRNc2dXaXRoVGltZUluZm8odHlwZSwgbXNnKSB7XG4vLyAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4vLyAgIGNvbnN0IGRpZmYgPSBsYXN0Q2FsbFRpbWUgPyAnKycgKyAobm93IC0gbGFzdENhbGxUaW1lKSA6ICcwJztcbi8vICAgbGFzdENhbGxUaW1lID0gbm93O1xuLy8gICBtc2cgPSAobmV3IERhdGUobm93KSkudG9JU09TdHJpbmcoKSArICcgfCBbJyArICB0eXBlICsgJ10gPiAnICsgbXNnICsgJyAoICcgKyBkaWZmICsgJyBtcyApJztcbi8vICAgcmV0dXJuIG1zZztcbi8vIH1cblxuZnVuY3Rpb24gZm9ybWF0TXNnKHR5cGUsIG1zZykge1xuICBtc2cgPSAnWycgKyAgdHlwZSArICddID4gJyArIG1zZztcbiAgcmV0dXJuIG1zZztcbn1cblxuZnVuY3Rpb24gY29uc29sZVByaW50Rm4odHlwZSkge1xuICBjb25zdCBmdW5jID0gd2luZG93LmNvbnNvbGVbdHlwZV07XG4gIGlmIChmdW5jKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKC4uLmFyZ3MpIHtcbiAgICAgIGlmKGFyZ3NbMF0pIHtcbiAgICAgICAgYXJnc1swXSA9IGZvcm1hdE1zZyh0eXBlLCBhcmdzWzBdKTtcbiAgICAgIH1cbiAgICAgIGZ1bmMuYXBwbHkod2luZG93LmNvbnNvbGUsIGFyZ3MpO1xuICAgIH07XG4gIH1cbiAgcmV0dXJuIG5vb3A7XG59XG5cbmZ1bmN0aW9uIGV4cG9ydExvZ2dlckZ1bmN0aW9ucyhkZWJ1Z0NvbmZpZywgLi4uZnVuY3Rpb25zKSB7XG4gIGZ1bmN0aW9ucy5mb3JFYWNoKGZ1bmN0aW9uKHR5cGUpIHtcbiAgICBleHBvcnRlZExvZ2dlclt0eXBlXSA9IGRlYnVnQ29uZmlnW3R5cGVdID8gZGVidWdDb25maWdbdHlwZV0uYmluZChkZWJ1Z0NvbmZpZykgOiBjb25zb2xlUHJpbnRGbih0eXBlKTtcbiAgfSk7XG59XG5cbmV4cG9ydCB2YXIgZW5hYmxlTG9ncyA9IGZ1bmN0aW9uKGRlYnVnQ29uZmlnKSB7XG4gIGlmIChkZWJ1Z0NvbmZpZyA9PT0gdHJ1ZSB8fCB0eXBlb2YgZGVidWdDb25maWcgPT09ICdvYmplY3QnKSB7XG4gICAgZXhwb3J0TG9nZ2VyRnVuY3Rpb25zKGRlYnVnQ29uZmlnLFxuICAgICAgLy8gUmVtb3ZlIG91dCBmcm9tIGxpc3QgaGVyZSB0byBoYXJkLWRpc2FibGUgYSBsb2ctbGV2ZWxcbiAgICAgIC8vJ3RyYWNlJyxcbiAgICAgICdkZWJ1ZycsXG4gICAgICAnbG9nJyxcbiAgICAgICdpbmZvJyxcbiAgICAgICd3YXJuJyxcbiAgICAgICdlcnJvcidcbiAgICApO1xuICAgIC8vIFNvbWUgYnJvd3NlcnMgZG9uJ3QgYWxsb3cgdG8gdXNlIGJpbmQgb24gY29uc29sZSBvYmplY3QgYW55d2F5XG4gICAgLy8gZmFsbGJhY2sgdG8gZGVmYXVsdCBpZiBuZWVkZWRcbiAgICB0cnkge1xuICAgICBleHBvcnRlZExvZ2dlci5sb2coKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBleHBvcnRlZExvZ2dlciA9IGZha2VMb2dnZXI7XG4gICAgfVxuICB9XG4gIGVsc2Uge1xuICAgIGV4cG9ydGVkTG9nZ2VyID0gZmFrZUxvZ2dlcjtcbiAgfVxufTtcblxuZXhwb3J0IHZhciBsb2dnZXIgPSBleHBvcnRlZExvZ2dlcjtcbiIsInZhciBVUkxIZWxwZXIgPSB7XG5cbiAgLy8gYnVpbGQgYW4gYWJzb2x1dGUgVVJMIGZyb20gYSByZWxhdGl2ZSBvbmUgdXNpbmcgdGhlIHByb3ZpZGVkIGJhc2VVUkxcbiAgLy8gaWYgcmVsYXRpdmVVUkwgaXMgYW4gYWJzb2x1dGUgVVJMIGl0IHdpbGwgYmUgcmV0dXJuZWQgYXMgaXMuXG4gIGJ1aWxkQWJzb2x1dGVVUkw6IGZ1bmN0aW9uKGJhc2VVUkwsIHJlbGF0aXZlVVJMKSB7XG4gICAgLy8gcmVtb3ZlIGFueSByZW1haW5pbmcgc3BhY2UgYW5kIENSTEZcbiAgICByZWxhdGl2ZVVSTCA9IHJlbGF0aXZlVVJMLnRyaW0oKTtcbiAgICBpZiAoL15bYS16XSs6L2kudGVzdChyZWxhdGl2ZVVSTCkpIHtcbiAgICAgIC8vIGNvbXBsZXRlIHVybCwgbm90IHJlbGF0aXZlXG4gICAgICByZXR1cm4gcmVsYXRpdmVVUkw7XG4gICAgfVxuXG4gICAgdmFyIHJlbGF0aXZlVVJMUXVlcnkgPSBudWxsO1xuICAgIHZhciByZWxhdGl2ZVVSTEhhc2ggPSBudWxsO1xuXG4gICAgdmFyIHJlbGF0aXZlVVJMSGFzaFNwbGl0ID0gL14oW14jXSopKC4qKSQvLmV4ZWMocmVsYXRpdmVVUkwpO1xuICAgIGlmIChyZWxhdGl2ZVVSTEhhc2hTcGxpdCkge1xuICAgICAgcmVsYXRpdmVVUkxIYXNoID0gcmVsYXRpdmVVUkxIYXNoU3BsaXRbMl07XG4gICAgICByZWxhdGl2ZVVSTCA9IHJlbGF0aXZlVVJMSGFzaFNwbGl0WzFdO1xuICAgIH1cbiAgICB2YXIgcmVsYXRpdmVVUkxRdWVyeVNwbGl0ID0gL14oW15cXD9dKikoLiopJC8uZXhlYyhyZWxhdGl2ZVVSTCk7XG4gICAgaWYgKHJlbGF0aXZlVVJMUXVlcnlTcGxpdCkge1xuICAgICAgcmVsYXRpdmVVUkxRdWVyeSA9IHJlbGF0aXZlVVJMUXVlcnlTcGxpdFsyXTtcbiAgICAgIHJlbGF0aXZlVVJMID0gcmVsYXRpdmVVUkxRdWVyeVNwbGl0WzFdO1xuICAgIH1cblxuICAgIHZhciBiYXNlVVJMSGFzaFNwbGl0ID0gL14oW14jXSopKC4qKSQvLmV4ZWMoYmFzZVVSTCk7XG4gICAgaWYgKGJhc2VVUkxIYXNoU3BsaXQpIHtcbiAgICAgIGJhc2VVUkwgPSBiYXNlVVJMSGFzaFNwbGl0WzFdO1xuICAgIH1cbiAgICB2YXIgYmFzZVVSTFF1ZXJ5U3BsaXQgPSAvXihbXlxcP10qKSguKikkLy5leGVjKGJhc2VVUkwpO1xuICAgIGlmIChiYXNlVVJMUXVlcnlTcGxpdCkge1xuICAgICAgYmFzZVVSTCA9IGJhc2VVUkxRdWVyeVNwbGl0WzFdO1xuICAgIH1cblxuICAgIHZhciBiYXNlVVJMRG9tYWluU3BsaXQgPSAvXigoKFthLXpdKyk6KT9cXC9cXC9bYS16MC05XFwuLV0rKDpbMC05XSspP1xcLykoLiopJC9pLmV4ZWMoYmFzZVVSTCk7XG4gICAgdmFyIGJhc2VVUkxQcm90b2NvbCA9IGJhc2VVUkxEb21haW5TcGxpdFszXTtcbiAgICB2YXIgYmFzZVVSTERvbWFpbiA9IGJhc2VVUkxEb21haW5TcGxpdFsxXTtcbiAgICB2YXIgYmFzZVVSTFBhdGggPSBiYXNlVVJMRG9tYWluU3BsaXRbNV07XG5cbiAgICB2YXIgYnVpbHRVUkwgPSBudWxsO1xuICAgIGlmICgvXlxcL1xcLy8udGVzdChyZWxhdGl2ZVVSTCkpIHtcbiAgICAgIGJ1aWx0VVJMID0gYmFzZVVSTFByb3RvY29sKyc6Ly8nK1VSTEhlbHBlci5idWlsZEFic29sdXRlUGF0aCgnJywgcmVsYXRpdmVVUkwuc3Vic3RyaW5nKDIpKTtcbiAgICB9XG4gICAgZWxzZSBpZiAoL15cXC8vLnRlc3QocmVsYXRpdmVVUkwpKSB7XG4gICAgICBidWlsdFVSTCA9IGJhc2VVUkxEb21haW4rVVJMSGVscGVyLmJ1aWxkQWJzb2x1dGVQYXRoKCcnLCByZWxhdGl2ZVVSTC5zdWJzdHJpbmcoMSkpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHZhciBuZXdQYXRoID0gVVJMSGVscGVyLmJ1aWxkQWJzb2x1dGVQYXRoKGJhc2VVUkxQYXRoLCByZWxhdGl2ZVVSTCk7XG4gICAgICBidWlsdFVSTCA9IGJhc2VVUkxEb21haW4gKyBuZXdQYXRoO1xuICAgIH1cblxuICAgIC8vIHB1dCB0aGUgcXVlcnkgYW5kIGhhc2ggcGFydHMgYmFja1xuICAgIGlmIChyZWxhdGl2ZVVSTFF1ZXJ5KSB7XG4gICAgICBidWlsdFVSTCArPSByZWxhdGl2ZVVSTFF1ZXJ5O1xuICAgIH1cbiAgICBpZiAocmVsYXRpdmVVUkxIYXNoKSB7XG4gICAgICBidWlsdFVSTCArPSByZWxhdGl2ZVVSTEhhc2g7XG4gICAgfVxuICAgIHJldHVybiBidWlsdFVSTDtcbiAgfSxcblxuICAvLyBidWlsZCBhbiBhYnNvbHV0ZSBwYXRoIHVzaW5nIHRoZSBwcm92aWRlZCBiYXNlUGF0aFxuICAvLyBhZGFwdGVkIGZyb20gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL2RvY3VtZW50L2Nvb2tpZSNVc2luZ19yZWxhdGl2ZV9VUkxzX2luX3RoZV9wYXRoX3BhcmFtZXRlclxuICAvLyB0aGlzIGRvZXMgbm90IGhhbmRsZSB0aGUgY2FzZSB3aGVyZSByZWxhdGl2ZVBhdGggaXMgXCIvXCIgb3IgXCIvL1wiLiBUaGVzZSBjYXNlcyBzaG91bGQgYmUgaGFuZGxlZCBvdXRzaWRlIHRoaXMuXG4gIGJ1aWxkQWJzb2x1dGVQYXRoOiBmdW5jdGlvbihiYXNlUGF0aCwgcmVsYXRpdmVQYXRoKSB7XG4gICAgdmFyIHNSZWxQYXRoID0gcmVsYXRpdmVQYXRoO1xuICAgIHZhciBuVXBMbiwgc0RpciA9ICcnLCBzUGF0aCA9IGJhc2VQYXRoLnJlcGxhY2UoL1teXFwvXSokLywgc1JlbFBhdGgucmVwbGFjZSgvKFxcL3xeKSg/OlxcLj9cXC8rKSsvZywgJyQxJykpO1xuICAgIGZvciAodmFyIG5FbmQsIG5TdGFydCA9IDA7IG5FbmQgPSBzUGF0aC5pbmRleE9mKCcvLi4vJywgblN0YXJ0KSwgbkVuZCA+IC0xOyBuU3RhcnQgPSBuRW5kICsgblVwTG4pIHtcbiAgICAgIG5VcExuID0gL15cXC8oPzpcXC5cXC5cXC8pKi8uZXhlYyhzUGF0aC5zbGljZShuRW5kKSlbMF0ubGVuZ3RoO1xuICAgICAgc0RpciA9IChzRGlyICsgc1BhdGguc3Vic3RyaW5nKG5TdGFydCwgbkVuZCkpLnJlcGxhY2UobmV3IFJlZ0V4cCgnKD86XFxcXFxcLytbXlxcXFxcXC9dKil7MCwnICsgKChuVXBMbiAtIDEpIC8gMykgKyAnfSQnKSwgJy8nKTtcbiAgICB9XG4gICAgcmV0dXJuIHNEaXIgKyBzUGF0aC5zdWJzdHIoblN0YXJ0KTtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBVUkxIZWxwZXI7XG4iLCIvKipcbiAqIFhIUiBiYXNlZCBsb2dnZXJcbiovXG5cbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG5jbGFzcyBYaHJMb2FkZXIge1xuXG4gIGNvbnN0cnVjdG9yKGNvbmZpZykge1xuICAgIGlmIChjb25maWcgJiYgY29uZmlnLnhoclNldHVwKSB7XG4gICAgICB0aGlzLnhoclNldHVwID0gY29uZmlnLnhoclNldHVwO1xuICAgIH1cbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5hYm9ydCgpO1xuICAgIHRoaXMubG9hZGVyID0gbnVsbDtcbiAgfVxuXG4gIGFib3J0KCkge1xuICAgIHZhciBsb2FkZXIgPSB0aGlzLmxvYWRlcixcbiAgICAgICAgdGltZW91dEhhbmRsZSA9IHRoaXMudGltZW91dEhhbmRsZTtcbiAgICBpZiAobG9hZGVyICYmIGxvYWRlci5yZWFkeVN0YXRlICE9PSA0KSB7XG4gICAgICB0aGlzLnN0YXRzLmFib3J0ZWQgPSB0cnVlO1xuICAgICAgbG9hZGVyLmFib3J0KCk7XG4gICAgfVxuICAgIGlmICh0aW1lb3V0SGFuZGxlKSB7XG4gICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRpbWVvdXRIYW5kbGUpO1xuICAgIH1cbiAgfVxuXG4gIGxvYWQodXJsLCByZXNwb25zZVR5cGUsIG9uU3VjY2Vzcywgb25FcnJvciwgb25UaW1lb3V0LCB0aW1lb3V0LCBtYXhSZXRyeSwgcmV0cnlEZWxheSwgb25Qcm9ncmVzcyA9IG51bGwsIGZyYWcgPSBudWxsKSB7XG4gICAgdGhpcy51cmwgPSB1cmw7XG4gICAgaWYgKGZyYWcgJiYgIWlzTmFOKGZyYWcuYnl0ZVJhbmdlU3RhcnRPZmZzZXQpICYmICFpc05hTihmcmFnLmJ5dGVSYW5nZUVuZE9mZnNldCkpIHtcbiAgICAgICAgdGhpcy5ieXRlUmFuZ2UgPSBmcmFnLmJ5dGVSYW5nZVN0YXJ0T2Zmc2V0ICsgJy0nICsgZnJhZy5ieXRlUmFuZ2VFbmRPZmZzZXQ7XG4gICAgfVxuICAgIHRoaXMucmVzcG9uc2VUeXBlID0gcmVzcG9uc2VUeXBlO1xuICAgIHRoaXMub25TdWNjZXNzID0gb25TdWNjZXNzO1xuICAgIHRoaXMub25Qcm9ncmVzcyA9IG9uUHJvZ3Jlc3M7XG4gICAgdGhpcy5vblRpbWVvdXQgPSBvblRpbWVvdXQ7XG4gICAgdGhpcy5vbkVycm9yID0gb25FcnJvcjtcbiAgICB0aGlzLnN0YXRzID0ge3RyZXF1ZXN0OiBwZXJmb3JtYW5jZS5ub3coKSwgcmV0cnk6IDB9O1xuICAgIHRoaXMudGltZW91dCA9IHRpbWVvdXQ7XG4gICAgdGhpcy5tYXhSZXRyeSA9IG1heFJldHJ5O1xuICAgIHRoaXMucmV0cnlEZWxheSA9IHJldHJ5RGVsYXk7XG4gICAgdGhpcy50aW1lb3V0SGFuZGxlID0gd2luZG93LnNldFRpbWVvdXQodGhpcy5sb2FkdGltZW91dC5iaW5kKHRoaXMpLCB0aW1lb3V0KTtcbiAgICB0aGlzLmxvYWRJbnRlcm5hbCgpO1xuICB9XG5cbiAgbG9hZEludGVybmFsKCkge1xuICAgIHZhciB4aHIgPSB0aGlzLmxvYWRlciA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgIHhoci5vbnJlYWR5c3RhdGVjaGFuZ2UgPSB0aGlzLnN0YXRlY2hhbmdlLmJpbmQodGhpcyk7XG4gICAgeGhyLm9ucHJvZ3Jlc3MgPSB0aGlzLmxvYWRwcm9ncmVzcy5iaW5kKHRoaXMpO1xuXG4gICAgeGhyLm9wZW4oJ0dFVCcsIHRoaXMudXJsLCB0cnVlKTtcbiAgICBpZiAodGhpcy5ieXRlUmFuZ2UpIHtcbiAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKCdSYW5nZScsICdieXRlcz0nICsgdGhpcy5ieXRlUmFuZ2UpO1xuICAgIH1cbiAgICB4aHIucmVzcG9uc2VUeXBlID0gdGhpcy5yZXNwb25zZVR5cGU7XG4gICAgdGhpcy5zdGF0cy50Zmlyc3QgPSBudWxsO1xuICAgIHRoaXMuc3RhdHMubG9hZGVkID0gMDtcbiAgICBpZiAodGhpcy54aHJTZXR1cCkge1xuICAgICAgdGhpcy54aHJTZXR1cCh4aHIsIHRoaXMudXJsKTtcbiAgICB9XG4gICAgeGhyLnNlbmQoKTtcbiAgfVxuXG4gIHN0YXRlY2hhbmdlKGV2ZW50KSB7XG4gICAgdmFyIHhociA9IGV2ZW50LmN1cnJlbnRUYXJnZXQsXG4gICAgICAgIHN0YXR1cyA9IHhoci5zdGF0dXMsXG4gICAgICAgIHN0YXRzID0gdGhpcy5zdGF0cztcbiAgICAvLyBkb24ndCBwcm9jZWVkIGlmIHhociBoYXMgYmVlbiBhYm9ydGVkXG4gICAgLy8gNCA9IFJlc3BvbnNlIGZyb20gc2VydmVyIGhhcyBiZWVuIGNvbXBsZXRlbHkgbG9hZGVkLlxuICAgIGlmICghc3RhdHMuYWJvcnRlZCAmJiB4aHIucmVhZHlTdGF0ZSA9PT0gNCkge1xuICAgICAgICAvLyBodHRwIHN0YXR1cyBiZXR3ZWVuIDIwMCB0byAyOTkgYXJlIGFsbCBzdWNjZXNzZnVsXG4gICAgICAgIGlmIChzdGF0dXMgPj0gMjAwICYmIHN0YXR1cyA8IDMwMCkgIHtcbiAgICAgICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMudGltZW91dEhhbmRsZSk7XG4gICAgICAgICAgc3RhdHMudGxvYWQgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgICB0aGlzLm9uU3VjY2VzcyhldmVudCwgc3RhdHMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gZXJyb3IgLi4uXG4gICAgICAgIGlmIChzdGF0cy5yZXRyeSA8IHRoaXMubWF4UmV0cnkpIHtcbiAgICAgICAgICBsb2dnZXIud2FybihgJHtzdGF0dXN9IHdoaWxlIGxvYWRpbmcgJHt0aGlzLnVybH0sIHJldHJ5aW5nIGluICR7dGhpcy5yZXRyeURlbGF5fS4uLmApO1xuICAgICAgICAgIHRoaXMuZGVzdHJveSgpO1xuICAgICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KHRoaXMubG9hZEludGVybmFsLmJpbmQodGhpcyksIHRoaXMucmV0cnlEZWxheSk7XG4gICAgICAgICAgLy8gZXhwb25lbnRpYWwgYmFja29mZlxuICAgICAgICAgIHRoaXMucmV0cnlEZWxheSA9IE1hdGgubWluKDIgKiB0aGlzLnJldHJ5RGVsYXksIDY0MDAwKTtcbiAgICAgICAgICBzdGF0cy5yZXRyeSsrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy50aW1lb3V0SGFuZGxlKTtcbiAgICAgICAgICBsb2dnZXIuZXJyb3IoYCR7c3RhdHVzfSB3aGlsZSBsb2FkaW5nICR7dGhpcy51cmx9YCApO1xuICAgICAgICAgIHRoaXMub25FcnJvcihldmVudCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBsb2FkdGltZW91dChldmVudCkge1xuICAgIGxvZ2dlci53YXJuKGB0aW1lb3V0IHdoaWxlIGxvYWRpbmcgJHt0aGlzLnVybH1gICk7XG4gICAgdGhpcy5vblRpbWVvdXQoZXZlbnQsIHRoaXMuc3RhdHMpO1xuICB9XG5cbiAgbG9hZHByb2dyZXNzKGV2ZW50KSB7XG4gICAgdmFyIHN0YXRzID0gdGhpcy5zdGF0cztcbiAgICBpZiAoc3RhdHMudGZpcnN0ID09PSBudWxsKSB7XG4gICAgICBzdGF0cy50Zmlyc3QgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICB9XG4gICAgc3RhdHMubG9hZGVkID0gZXZlbnQubG9hZGVkO1xuICAgIGlmICh0aGlzLm9uUHJvZ3Jlc3MpIHtcbiAgICAgIHRoaXMub25Qcm9ncmVzcyhldmVudCwgc3RhdHMpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBYaHJMb2FkZXI7XG4iXX0=
