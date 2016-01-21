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

},{"../events":19}],4:[function(require,module,exports){
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

},{"../errors":18,"../events":19,"../utils/logger":30}],5:[function(require,module,exports){
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
      var currentTime = this.media.currentTime;
      // only adjust currentTime if not equal to 0
      if (!currentTime && currentTime !== this.startPosition) {
        _utilsLogger.logger.log('onMediaMetadata: adjust currentTime to startPosition');
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

},{"../demux/demuxer":14,"../errors":18,"../events":19,"../helper/level-helper":20,"../utils/binary-search":28,"../utils/logger":30}],6:[function(require,module,exports){
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

},{"../events":19,"../utils/cea-708-interpreter":29,"../utils/logger":30}],7:[function(require,module,exports){
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

},{"../errors":18,"../utils/logger":30,"./aes128-decrypter":8}],10:[function(require,module,exports){
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

},{"../demux/id3":16,"../utils/logger":30,"./adts":11}],11:[function(require,module,exports){
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

},{"../errors":18,"../utils/logger":30}],12:[function(require,module,exports){
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

},{"../demux/aacdemuxer":10,"../demux/tsdemuxer":17,"../errors":18,"../events":19}],13:[function(require,module,exports){
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

},{"../demux/demuxer-inline":12,"../events":19,"../remux/mp4-remuxer":26,"events":1}],14:[function(require,module,exports){
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

},{"../crypt/decrypter":9,"../demux/demuxer-inline":12,"../demux/demuxer-worker":13,"../events":19,"../remux/mp4-remuxer":26,"../utils/logger":30,"webworkify":2}],15:[function(require,module,exports){
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

},{"../utils/logger":30}],16:[function(require,module,exports){
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

},{"../utils/logger":30}],17:[function(require,module,exports){
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

},{"../errors":18,"../events":19,"../utils/logger":30,"./adts":11,"./exp-golomb":15}],18:[function(require,module,exports){
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

},{}],19:[function(require,module,exports){
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
  // fired when parsing sei text is completed - data: { samples : [ sei samples pes ] }
  FRAG_PARSING_USERDATA: 'hlsFraParsingUserdata',
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

},{}],20:[function(require,module,exports){
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

},{"../utils/logger":30}],21:[function(require,module,exports){
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

},{"./controller/abr-controller":3,"./controller/level-controller":4,"./controller/mse-media-controller":5,"./controller/timeline-controller":6,"./errors":18,"./events":19,"./loader/fragment-loader":22,"./loader/key-loader":23,"./loader/playlist-loader":24,"./utils/logger":30,"./utils/xhr-loader":32,"events":1}],22:[function(require,module,exports){
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

},{"../errors":18,"../events":19}],23:[function(require,module,exports){
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

},{"../errors":18,"../events":19}],24:[function(require,module,exports){
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

},{"../errors":18,"../events":19,"../utils/attr-list":27,"../utils/url":31}],25:[function(require,module,exports){
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

},{}],26:[function(require,module,exports){
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

},{"../errors":18,"../events":19,"../remux/mp4-generator":25,"../utils/logger":30}],27:[function(require,module,exports){

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

},{}],28:[function(require,module,exports){
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

},{}],29:[function(require,module,exports){
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

},{}],30:[function(require,module,exports){
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

},{}],31:[function(require,module,exports){
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

},{}],32:[function(require,module,exports){
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

},{"../utils/logger":30}]},{},[21])(21)
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwibm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwibm9kZV9tb2R1bGVzL3dlYndvcmtpZnkvaW5kZXguanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL2NvbnRyb2xsZXIvYWJyLWNvbnRyb2xsZXIuanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL2NvbnRyb2xsZXIvbGV2ZWwtY29udHJvbGxlci5qcyIsIi9Vc2Vycy9qZXJlbXkubGFjaXZpdGEvR2l0SHViL2hscy5qcy9zcmMvY29udHJvbGxlci9tc2UtbWVkaWEtY29udHJvbGxlci5qcyIsIi9Vc2Vycy9qZXJlbXkubGFjaXZpdGEvR2l0SHViL2hscy5qcy9zcmMvY29udHJvbGxlci90aW1lbGluZS1jb250cm9sbGVyLmpzIiwiL1VzZXJzL2plcmVteS5sYWNpdml0YS9HaXRIdWIvaGxzLmpzL3NyYy9jcnlwdC9hZXMuanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL2NyeXB0L2FlczEyOC1kZWNyeXB0ZXIuanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL2NyeXB0L2RlY3J5cHRlci5qcyIsIi9Vc2Vycy9qZXJlbXkubGFjaXZpdGEvR2l0SHViL2hscy5qcy9zcmMvZGVtdXgvYWFjZGVtdXhlci5qcyIsIi9Vc2Vycy9qZXJlbXkubGFjaXZpdGEvR2l0SHViL2hscy5qcy9zcmMvZGVtdXgvYWR0cy5qcyIsIi9Vc2Vycy9qZXJlbXkubGFjaXZpdGEvR2l0SHViL2hscy5qcy9zcmMvZGVtdXgvZGVtdXhlci1pbmxpbmUuanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL2RlbXV4L2RlbXV4ZXItd29ya2VyLmpzIiwiL1VzZXJzL2plcmVteS5sYWNpdml0YS9HaXRIdWIvaGxzLmpzL3NyYy9kZW11eC9kZW11eGVyLmpzIiwiL1VzZXJzL2plcmVteS5sYWNpdml0YS9HaXRIdWIvaGxzLmpzL3NyYy9kZW11eC9leHAtZ29sb21iLmpzIiwiL1VzZXJzL2plcmVteS5sYWNpdml0YS9HaXRIdWIvaGxzLmpzL3NyYy9kZW11eC9pZDMuanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL2RlbXV4L3RzZGVtdXhlci5qcyIsIi9Vc2Vycy9qZXJlbXkubGFjaXZpdGEvR2l0SHViL2hscy5qcy9zcmMvZXJyb3JzLmpzIiwiL1VzZXJzL2plcmVteS5sYWNpdml0YS9HaXRIdWIvaGxzLmpzL3NyYy9ldmVudHMuanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL2hlbHBlci9sZXZlbC1oZWxwZXIuanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL2hscy5qcyIsIi9Vc2Vycy9qZXJlbXkubGFjaXZpdGEvR2l0SHViL2hscy5qcy9zcmMvbG9hZGVyL2ZyYWdtZW50LWxvYWRlci5qcyIsIi9Vc2Vycy9qZXJlbXkubGFjaXZpdGEvR2l0SHViL2hscy5qcy9zcmMvbG9hZGVyL2tleS1sb2FkZXIuanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL2xvYWRlci9wbGF5bGlzdC1sb2FkZXIuanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL3JlbXV4L21wNC1nZW5lcmF0b3IuanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL3JlbXV4L21wNC1yZW11eGVyLmpzIiwiL1VzZXJzL2plcmVteS5sYWNpdml0YS9HaXRIdWIvaGxzLmpzL3NyYy91dGlscy9hdHRyLWxpc3QuanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL3V0aWxzL2JpbmFyeS1zZWFyY2guanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL3V0aWxzL2NlYS03MDgtaW50ZXJwcmV0ZXIuanMiLCIvVXNlcnMvamVyZW15LmxhY2l2aXRhL0dpdEh1Yi9obHMuanMvc3JjL3V0aWxzL2xvZ2dlci5qcyIsIi9Vc2Vycy9qZXJlbXkubGFjaXZpdGEvR2l0SHViL2hscy5qcy9zcmMvdXRpbHMvdXJsLmpzIiwiL1VzZXJzL2plcmVteS5sYWNpdml0YS9HaXRIdWIvaGxzLmpzL3NyYy91dGlscy94aHItbG9hZGVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFD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QixZQUFNLEdBQU0sS0FBSyxDQUFDLENBQUMsQ0FBQztVQUNwQixNQUFNLEdBQU0sS0FBSyxDQUFDLENBQUMsQ0FBQztVQUNwQixNQUFNLEdBQU0sS0FBSyxDQUFDLENBQUMsQ0FBQztVQUNwQixNQUFNLEdBQU0sS0FBSyxDQUFDLENBQUMsQ0FBQztVQUNwQixJQUFJLEdBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDOzs7QUFHakIsV0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxZQUFZLEVBQUUsQ0FBQyxFQUFFLEVBQUU7QUFDakMsVUFBRSxHQUFHLE1BQU0sQ0FBQyxDQUFDLEtBQUcsRUFBRSxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsSUFBRSxFQUFFLEdBQUcsR0FBRyxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsSUFBRSxDQUFDLEdBQUcsR0FBRyxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDL0YsVUFBRSxHQUFHLE1BQU0sQ0FBQyxDQUFDLEtBQUcsRUFBRSxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsSUFBRSxFQUFFLEdBQUcsR0FBRyxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsSUFBRSxDQUFDLEdBQUcsR0FBRyxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsR0FBRyxHQUFHLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ25HLFVBQUUsR0FBRyxNQUFNLENBQUMsQ0FBQyxLQUFHLEVBQUUsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLElBQUUsRUFBRSxHQUFHLEdBQUcsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLElBQUUsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLEdBQUcsR0FBRyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztBQUNuRyxTQUFDLEdBQUksTUFBTSxDQUFDLENB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SSxJQUFJLENBQUMsV0FBVyxFQUFFLEVBQUU7O0FBRXRCLGNBQUksUUFBUSxZQUFBLENBQUM7QUFDYixjQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7QUFDeEMsa0JBQVEsY0FBYzs7QUFFcEIsaUJBQUssQ0FBQztBQUFFLHNCQUFRLEdBQUcsQ0FBQyxFQUFFLEVBQUMsRUFBRSxDQUFDLENBQUMsQUFBQyxNQUFNO0FBQUEsQUFDbEMsaUJBQUssQ0FBQztBQUFFLHNCQUFRLEdBQUcsQ0FBQyxFQUFFLEVBQUMsRUFBRSxDQUFDLENBQUMsQUFBQyxNQUFNO0FBQUEsQUFDbEMsaUJBQUssQ0FBQztBQUFFLHNCQUFRLEdBQUcsQ0FBQyxFQUFFLEVBQUMsRUFBRSxDQUFDLENBQUMsQUFBQyxNQUFNO0FBQUEsQUFDbEMsaUJBQUssQ0FBQztBQUFFLHNCQUFRLEdBQUcsQ0FBQyxFQUFFLEVBQUMsRUFBRSxDQUFDLENBQUMsQUFBQyxNQUFNO0FBQUEsQUFDbEMsaUJBQUssQ0FBQztBQUFFLHNCQUFRLEdBQUcsQ0FBQyxFQUFFLEVBQUMsRUFBRSxDQUFDLENBQUMsQUFBQyxNQUFNO0FBQUEsQUFDbEMsaUJBQUssQ0FBQztBQUFFLHNCQUFRLEdBQUcsQ0FBQyxFQUFFLEVBQUMsRUFBRSxDQUFDLENBQUMsQUFBQyxNQUFNO0FBQUEsQUFDbEMsaUJBQUssQ0FBQztBQUFFLHNCQUFRLEdBQUcsQ0FBQyxFQUFFLEVBQUMsRUFBRSxDQUFDLENBQUMsQUFBQyxNQUFNO0FBQUEsQUFDbEMsaUJBQUssQ0FBQztBQUFFLHNCQUFRLEdBQUcsQ0FBQyxFQUFFLEVBQUMsRUFBRSxDQUFDLENBQUMsQUFBQyxNQUFNO0FBQUEsQUFDbEMsaUJBQUssRUFBRTtBQUFFLHNCQUFRLEdBQUcsQ0FBQyxFQUFFLEVBQUMsRUFBRSxDQUFDLENBQUMsQUFBQyxNQUFNO0FBQUEsQUFDbkMsaUJBQUssRUFBRTtBQUFFLHNCQUFRLEdBQUcsQ0FBQyxFQUFFLEVBQUMsRUFBRSxDQUFDLENBQUMsQUFBQyxNQUFNO0FBQUEsQUFD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QUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQ3JDLFlBQUksR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3BCLFdBQUcsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDO0FBQ3RCLFdBQUcsQ0FBQyxJQUFJLENBQUMsQUFBQyxHQUFHLEtBQUssQ0FBQyxHQUFJLElBQUksQ0FBQyxDQUFDO0FBQzdCLFdBQUcsQ0FBQyxJQUFJLENBQUUsR0FBRyxHQUFHLElBQUksQ0FBRSxDQUFDO0FBQ3ZCLFdBQUcsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO09BQ3BEOzs7QUFHRCxXQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQ3JDLFlBQUksR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3BCLFdBQUcsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDO0FBQ3RCLFdBQUcsQ0FBQyxJQUFJLENBQUMsQUFBQyxHQUFHLEtBQUssQ0FBQyxHQUFJLElBQUksQ0FBQyxDQUFDO0FBQzdCLFdBQUcsQ0FBQyxJQUFJLENBQUUsR0FBRyxHQUFHLElBQUksQ0FBRSxDQUFDO0FBQ3ZCLFdBQUcsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO09BQ3BEOztBQUVELFVBQUksSUFBSSxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsSUFBSSxVQUFVLENBQUMsQ0FDMUMsSUFBSTtBQUNKLFNBQUcsQ0FBQyxDQUFDLENBQUM7QUFDTixTQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ04s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LENBQUM7QUFDckIsNEJBQU07QUFBQSxBQUNSLHlCQUFLLEVBQUU7QUFDTCwwQkFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksR0FBRyxDQUFDO0FBQ3JCLDRCQUFNO0FBQUEsQUFDUix5QkFBSyxFQUFFO0FBQ0wsMEJBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLEdBQUcsQ0FBQztBQUNyQiw0QkFBTTtBQUFBLEFBQ1IseUJBQUssRUFBRTtBQUNMLDBCQUFJLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxHQUFHLENBQUM7QUFDckIsNEJBQU07QUFBQSxBQUNSLHlCQUFLLEVBQUU7QUFDTCwwQkFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksR0FBRyxDQUFDO0FBQ3JCLDRCQUFNO0FBQUEsQUFDUix5QkFBSyxFQUFFO0FBQ0wsMEJBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLEdBQUcsQ0FBQztBQUNyQiw0QkFBTTtBQUFBLEFBQ1IseUJBQUssRUFBRTtBQUNMLDBCQUFJLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxFQUFFLENBQUM7QUFDcEIsNEJBQU07QUFBQSxBQUNSLHlCQUFLLEVBQUU7QUFDTCwwQkFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksR0FBRyxDQUFDO0FBQ3JCLDRCQUFNO0FBQUEsQUFDUix5QkFBSyxFQUFFO0FBQ0wsMEJBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLEdBQUcsQ0FBQztBQUNyQiw0QkFBTTtBQUFBLEFBQ1IseUJBQUssRUFBRTtBQUNMLDBCQUFJLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxHQUFHLENBQUM7QUFDckIsNEJBQU07QUFBQSxBQUNSLHlCQUFLLEVBQUU7QUFDTCwwQkFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksR0FBRyxDQUFDO0FBQ3JCLDRCQUFNO0FBQUEsQUFDUix5QkFBSyxFQUFFO0FBQ0wsMEJBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLEdBQUcsQ0FBQztBQUNyQiw0QkFBTTtBQUFBLEFBQ1IseUJB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Q0Y7T0FDRjtLQUNGOzs7V0FFVSxxQkFBQyxLQUFLLEVBQUU7QUFDakIsMEJBQU8sSUFBSSw0QkFBMEIsSUFBSSxDQUFDLEdBQUcsQ0FBSSxDQUFDO0FBQ2xELFVBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztLQUNuQzs7O1dBRVcsc0JBQUMsS0FBSyxFQUFFO0FBQ2xCLFVBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7QUFDdkIsVUFBSSxLQUFLLENBQUMsTUFBTSxLQUFLLElBQUksRUFBRTtBQUN6QixhQUFLLENBQUMsTUFBTSxHQUFHLFdBQVcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztPQUNsQztBQUNELFdBQUssQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQztBQUM1QixVQUFJLElBQUksQ0FBQyxVQUFVLEVBQUU7QUFDbkIsWUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUM7T0FDL0I7S0FDRjs7O1NBekdHLFNBQVM7OztxQkE0R0EsU0FBUyIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfVxuICAgICAgdGhyb3cgVHlwZUVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LicpO1xuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgICAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgICAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGhhbmRsZXIpKSB7XG4gICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuXG4gICAgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIG07XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJcIi5cbiAgaWYgKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcilcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSxcbiAgICAgICAgICAgICAgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICBlbHNlXG4gICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuXG4gIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pICYmICF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgdmFyIG07XG4gICAgaWYgKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUudHJhY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBpbiBJRSAxMFxuICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIHZhciBmaXJlZCA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGcoKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBnKTtcblxuICAgIGlmICghZmlyZWQpIHtcbiAgICAgIGZpcmVkID0gdHJ1ZTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICB0aGlzLm9uKHR5cGUsIGcpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbGlzdCwgcG9zaXRpb24sIGxlbmd0aCwgaTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXR1cm4gdGhpcztcblxuICBsaXN0ID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBsZW5ndGggPSBsaXN0Lmxlbmd0aDtcbiAgcG9zaXRpb24gPSAtMTtcblxuICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHxcbiAgICAgIChpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmIChpc09iamVjdChsaXN0KSkge1xuICAgIGZvciAoaSA9IGxlbmd0aDsgaS0tID4gMDspIHtcbiAgICAgIGlmIChsaXN0W2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgIChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGlzdC5sZW5ndGggPSAwO1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGtleSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgaWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgIGlmIChrZXkgPT09ICdyZW1vdmVMaXN0ZW5lcicpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICB9XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJyk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzRnVuY3Rpb24obGlzdGVuZXJzKSkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBMSUZPIG9yZGVyXG4gICAgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpXG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoIC0gMV0pO1xuICB9XG4gIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSBbXTtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCFlbWl0dGVyLl9ldmVudHMgfHwgIWVtaXR0ZXIuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSAwO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKGVtaXR0ZXIuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gMTtcbiAgZWxzZVxuICAgIHJldCA9IGVtaXR0ZXIuX2V2ZW50c1t0eXBlXS5sZW5ndGg7XG4gIHJldHVybiByZXQ7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iLCJ2YXIgYnVuZGxlRm4gPSBhcmd1bWVudHNbM107XG52YXIgc291cmNlcyA9IGFyZ3VtZW50c1s0XTtcbnZhciBjYWNoZSA9IGFyZ3VtZW50c1s1XTtcblxudmFyIHN0cmluZ2lmeSA9IEpTT04uc3RyaW5naWZ5O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChmbikge1xuICAgIHZhciBrZXlzID0gW107XG4gICAgdmFyIHdrZXk7XG4gICAgdmFyIGNhY2hlS2V5cyA9IE9iamVjdC5rZXlzKGNhY2hlKTtcbiAgICBcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IGNhY2hlS2V5cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgdmFyIGtleSA9IGNhY2hlS2V5c1tpXTtcbiAgICAgICAgaWYgKGNhY2hlW2tleV0uZXhwb3J0cyA9PT0gZm4pIHtcbiAgICAgICAgICAgIHdrZXkgPSBrZXk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cbiAgICBcbiAgICBpZiAoIXdrZXkpIHtcbiAgICAgICAgd2tleSA9IE1hdGguZmxvb3IoTWF0aC5wb3coMTYsIDgpICogTWF0aC5yYW5kb20oKSkudG9TdHJpbmcoMTYpO1xuICAgICAgICB2YXIgd2NhY2hlID0ge307XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gY2FjaGVLZXlzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgdmFyIGtleSA9IGNhY2hlS2V5c1tpXTtcbiAgICAgICAgICAgIHdjYWNoZVtrZXldID0ga2V5O1xuICAgICAgICB9XG4gICAgICAgIHNvdXJjZXNbd2tleV0gPSBbXG4gICAgICAgICAgICBGdW5jdGlvbihbJ3JlcXVpcmUnLCdtb2R1bGUnLCdleHBvcnRzJ10sICcoJyArIGZuICsgJykoc2VsZiknKSxcbiAgICAgICAgICAgIHdjYWNoZVxuICAgICAgICBdO1xuICAgIH1cbiAgICB2YXIgc2tleSA9IE1hdGguZmxvb3IoTWF0aC5wb3coMTYsIDgpICogTWF0aC5yYW5kb20oKSkudG9TdHJpbmcoMTYpO1xuICAgIFxuICAgIHZhciBzY2FjaGUgPSB7fTsgc2NhY2hlW3drZXldID0gd2tleTtcbiAgICBzb3VyY2VzW3NrZXldID0gW1xuICAgICAgICBGdW5jdGlvbihbJ3JlcXVpcmUnXSwncmVxdWlyZSgnICsgc3RyaW5naWZ5KHdrZXkpICsgJykoc2VsZiknKSxcbiAgICAgICAgc2NhY2hlXG4gICAgXTtcbiAgICBcbiAgICB2YXIgc3JjID0gJygnICsgYnVuZGxlRm4gKyAnKSh7J1xuICAgICAgICArIE9iamVjdC5rZXlzKHNvdXJjZXMpLm1hcChmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgICAgICByZXR1cm4gc3RyaW5naWZ5KGtleSkgKyAnOlsnXG4gICAgICAgICAgICAgICAgKyBzb3VyY2VzW2tleV1bMF1cbiAgICAgICAgICAgICAgICArICcsJyArIHN0cmluZ2lmeShzb3VyY2VzW2tleV1bMV0pICsgJ10nXG4gICAgICAgICAgICA7XG4gICAgICAgIH0pLmpvaW4oJywnKVxuICAgICAgICArICd9LHt9LFsnICsgc3RyaW5naWZ5KHNrZXkpICsgJ10pJ1xuICAgIDtcbiAgICBcbiAgICB2YXIgVVJMID0gd2luZG93LlVSTCB8fCB3aW5kb3cud2Via2l0VVJMIHx8IHdpbmRvdy5tb3pVUkwgfHwgd2luZG93Lm1zVVJMO1xuICAgIFxuICAgIHJldHVybiBuZXcgV29ya2VyKFVSTC5jcmVhdGVPYmplY3RVUkwoXG4gICAgICAgIG5ldyBCbG9iKFtzcmNdLCB7IHR5cGU6ICd0ZXh0L2phdmFzY3JpcHQnIH0pXG4gICAgKSk7XG59O1xuIiwiLypcbiAqIHNpbXBsZSBBQlIgQ29udHJvbGxlclxuKi9cblxuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5cbmNsYXNzIEFickNvbnRyb2xsZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHRoaXMuaGxzID0gaGxzO1xuICAgIHRoaXMubGFzdGZldGNobGV2ZWwgPSAwO1xuICAgIHRoaXMuX2F1dG9MZXZlbENhcHBpbmcgPSAtMTtcbiAgICB0aGlzLl9uZXh0QXV0b0xldmVsID0gLTE7XG4gICAgdGhpcy5vbmZscCA9IHRoaXMub25GcmFnbWVudExvYWRQcm9ncmVzcy5iaW5kKHRoaXMpO1xuICAgIGhscy5vbihFdmVudC5GUkFHX0xPQURfUFJPR1JFU1MsIHRoaXMub25mbHApO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLmhscy5vZmYoRXZlbnQuRlJBR19MT0FEX1BST0dSRVNTLCB0aGlzLm9uZmxwKTtcbiAgfVxuXG4gIG9uRnJhZ21lbnRMb2FkUHJvZ3Jlc3MoZXZlbnQsIGRhdGEpIHtcbiAgICB2YXIgc3RhdHMgPSBkYXRhLnN0YXRzO1xuICAgIGlmIChzdGF0cy5hYm9ydGVkID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMubGFzdGZldGNoZHVyYXRpb24gPSAocGVyZm9ybWFuY2Uubm93KCkgLSBzdGF0cy50cmVxdWVzdCkgLyAxMDAwO1xuICAgICAgdGhpcy5sYXN0ZmV0Y2hsZXZlbCA9IGRhdGEuZnJhZy5sZXZlbDtcbiAgICAgIHRoaXMubGFzdGJ3ID0gKHN0YXRzLmxvYWRlZCAqIDgpIC8gdGhpcy5sYXN0ZmV0Y2hkdXJhdGlvbjtcbiAgICAgIC8vY29uc29sZS5sb2coYGZldGNoRHVyYXRpb246JHt0aGlzLmxhc3RmZXRjaGR1cmF0aW9ufSxidzokeyh0aGlzLmxhc3Ridy8xMDAwKS50b0ZpeGVkKDApfS8ke3N0YXRzLmFib3J0ZWR9YCk7XG4gICAgfVxuICB9XG5cbiAgLyoqIFJldHVybiB0aGUgY2FwcGluZy9tYXggbGV2ZWwgdmFsdWUgdGhhdCBjb3VsZCBiZSB1c2VkIGJ5IGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24gYWxnb3JpdGhtICoqL1xuICBnZXQgYXV0b0xldmVsQ2FwcGluZygpIHtcbiAgICByZXR1cm4gdGhpcy5fYXV0b0xldmVsQ2FwcGluZztcbiAgfVxuXG4gIC8qKiBzZXQgdGhlIGNhcHBpbmcvbWF4IGxldmVsIHZhbHVlIHRoYXQgY291bGQgYmUgdXNlZCBieSBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uIGFsZ29yaXRobSAqKi9cbiAgc2V0IGF1dG9MZXZlbENhcHBpbmcobmV3TGV2ZWwpIHtcbiAgICB0aGlzLl9hdXRvTGV2ZWxDYXBwaW5nID0gbmV3TGV2ZWw7XG4gIH1cblxuICBnZXQgbmV4dEF1dG9MZXZlbCgpIHtcbiAgICB2YXIgbGFzdGJ3ID0gdGhpcy5sYXN0YncsIGhscyA9IHRoaXMuaGxzLGFkanVzdGVkYncsIGksIG1heEF1dG9MZXZlbDtcbiAgICBpZiAodGhpcy5fYXV0b0xldmVsQ2FwcGluZyA9PT0gLTEpIHtcbiAgICAgIG1heEF1dG9MZXZlbCA9IGhscy5sZXZlbHMubGVuZ3RoIC0gMTtcbiAgICB9IGVsc2Uge1xuICAgICAgbWF4QXV0b0xldmVsID0gdGhpcy5fYXV0b0xldmVsQ2FwcGluZztcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fbmV4dEF1dG9MZXZlbCAhPT0gLTEpIHtcbiAgICAgIHZhciBuZXh0TGV2ZWwgPSBNYXRoLm1pbih0aGlzLl9uZXh0QXV0b0xldmVsLG1heEF1dG9MZXZlbCk7XG4gICAgICBpZiAobmV4dExldmVsID09PSB0aGlzLmxhc3RmZXRjaGxldmVsKSB7XG4gICAgICAgIHRoaXMuX25leHRBdXRvTGV2ZWwgPSAtMTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBuZXh0TGV2ZWw7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gZm9sbG93IGFsZ29yaXRobSBjYXB0dXJlZCBmcm9tIHN0YWdlZnJpZ2h0IDpcbiAgICAvLyBodHRwczovL2FuZHJvaWQuZ29vZ2xlc291cmNlLmNvbS9wbGF0Zm9ybS9mcmFtZXdvcmtzL2F2LysvbWFzdGVyL21lZGlhL2xpYnN0YWdlZnJpZ2h0L2h0dHBsaXZlL0xpdmVTZXNzaW9uLmNwcFxuICAgIC8vIFBpY2sgdGhlIGhpZ2hlc3QgYmFuZHdpZHRoIHN0cmVhbSBiZWxvdyBvciBlcXVhbCB0byBlc3RpbWF0ZWQgYmFuZHdpZHRoLlxuICAgIGZvciAoaSA9IDA7IGkgPD0gbWF4QXV0b0xldmVsOyBpKyspIHtcbiAgICAvLyBjb25zaWRlciBvbmx5IDgwJSBvZiB0aGUgYXZhaWxhYmxlIGJhbmR3aWR0aCwgYnV0IGlmIHdlIGFyZSBzd2l0Y2hpbmcgdXAsXG4gICAgLy8gYmUgZXZlbiBtb3JlIGNvbnNlcnZhdGl2ZSAoNzAlKSB0byBhdm9pZCBvdmVyZXN0aW1hdGluZyBhbmQgaW1tZWRpYXRlbHlcbiAgICAvLyBzd2l0Y2hpbmcgYmFjay5cbiAgICAgIGlmIChpIDw9IHRoaXMubGFzdGZldGNobGV2ZWwpIHtcbiAgICAgICAgYWRqdXN0ZWRidyA9IDAuOCAqIGxhc3RidztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGFkanVzdGVkYncgPSAwLjcgKiBsYXN0Ync7XG4gICAgICB9XG4gICAgICBpZiAoYWRqdXN0ZWRidyA8IGhscy5sZXZlbHNbaV0uYml0cmF0ZSkge1xuICAgICAgICByZXR1cm4gTWF0aC5tYXgoMCwgaSAtIDEpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gaSAtIDE7XG4gIH1cblxuICBzZXQgbmV4dEF1dG9MZXZlbChuZXh0TGV2ZWwpIHtcbiAgICB0aGlzLl9uZXh0QXV0b0xldmVsID0gbmV4dExldmVsO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEFickNvbnRyb2xsZXI7XG5cbiIsIi8qXG4gKiBMZXZlbCBDb250cm9sbGVyXG4qL1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5cbmNsYXNzIExldmVsQ29udHJvbGxlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgdGhpcy5obHMgPSBobHM7XG4gICAgdGhpcy5vbm1sID0gdGhpcy5vbk1hbmlmZXN0TG9hZGVkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmxsID0gdGhpcy5vbkxldmVsTG9hZGVkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmVyciA9IHRoaXMub25FcnJvci5iaW5kKHRoaXMpO1xuICAgIHRoaXMub250aWNrID0gdGhpcy50aWNrLmJpbmQodGhpcyk7XG4gICAgaGxzLm9uKEV2ZW50Lk1BTklGRVNUX0xPQURFRCwgdGhpcy5vbm1sKTtcbiAgICBobHMub24oRXZlbnQuTEVWRUxfTE9BREVELCB0aGlzLm9ubGwpO1xuICAgIGhscy5vbihFdmVudC5FUlJPUiwgdGhpcy5vbmVycik7XG4gICAgdGhpcy5fbWFudWFsTGV2ZWwgPSB0aGlzLl9hdXRvTGV2ZWxDYXBwaW5nID0gLTE7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIHZhciBobHMgPSB0aGlzLmhscztcbiAgICBobHMub2ZmKEV2ZW50Lk1BTklGRVNUX0xPQURFRCwgdGhpcy5vbm1sKTtcbiAgICBobHMub2ZmKEV2ZW50LkxFVkVMX0xPQURFRCwgdGhpcy5vbmxsKTtcbiAgICBobHMub2ZmKEV2ZW50LkVSUk9SLCB0aGlzLm9uZXJyKTtcbiAgICBpZiAodGhpcy50aW1lcikge1xuICAgICBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgIH1cbiAgICB0aGlzLl9tYW51YWxMZXZlbCA9IC0xO1xuICB9XG5cbiAgb25NYW5pZmVzdExvYWRlZChldmVudCwgZGF0YSkge1xuICAgIHZhciBsZXZlbHMwID0gW10sIGxldmVscyA9IFtdLCBiaXRyYXRlU3RhcnQsIGksIGJpdHJhdGVTZXQgPSB7fSwgdmlkZW9Db2RlY0ZvdW5kID0gZmFsc2UsIGF1ZGlvQ29kZWNGb3VuZCA9IGZhbHNlLCBobHMgPSB0aGlzLmhscztcblxuICAgIC8vIHJlZ3JvdXAgcmVkdW5kYW50IGxldmVsIHRvZ2V0aGVyXG4gICAgZGF0YS5sZXZlbHMuZm9yRWFjaChsZXZlbCA9PiB7XG4gICAgICBpZihsZXZlbC52aWRlb0NvZGVjKSB7XG4gICAgICAgIHZpZGVvQ29kZWNGb3VuZCA9IHRydWU7XG4gICAgICB9XG4gICAgICBpZihsZXZlbC5hdWRpb0NvZGVjKSB7XG4gICAgICAgIGF1ZGlvQ29kZWNGb3VuZCA9IHRydWU7XG4gICAgICB9XG4gICAgICB2YXIgcmVkdW5kYW50TGV2ZWxJZCA9IGJpdHJhdGVTZXRbbGV2ZWwuYml0cmF0ZV07XG4gICAgICBpZiAocmVkdW5kYW50TGV2ZWxJZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGJpdHJhdGVTZXRbbGV2ZWwuYml0cmF0ZV0gPSBsZXZlbHMwLmxlbmd0aDtcbiAgICAgICAgbGV2ZWwudXJsID0gW2xldmVsLnVybF07XG4gICAgICAgIGxldmVsLnVybElkID0gMDtcbiAgICAgICAgbGV2ZWxzMC5wdXNoKGxldmVsKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxldmVsczBbcmVkdW5kYW50TGV2ZWxJZF0udXJsLnB1c2gobGV2ZWwudXJsKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIHJlbW92ZSBhdWRpby1vbmx5IGxldmVsIGlmIHdlIGFsc28gaGF2ZSBsZXZlbHMgd2l0aCBhdWRpbyt2aWRlbyBjb2RlY3Mgc2lnbmFsbGVkXG4gICAgaWYodmlkZW9Db2RlY0ZvdW5kICYmIGF1ZGlvQ29kZWNGb3VuZCkge1xuICAgICAgbGV2ZWxzMC5mb3JFYWNoKGxldmVsID0+IHtcbiAgICAgICAgaWYobGV2ZWwudmlkZW9Db2RlYykge1xuICAgICAgICAgIGxldmVscy5wdXNoKGxldmVsKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldmVscyA9IGxldmVsczA7XG4gICAgfVxuXG4gICAgLy8gb25seSBrZWVwIGxldmVsIHdpdGggc3VwcG9ydGVkIGF1ZGlvL3ZpZGVvIGNvZGVjc1xuICAgIGxldmVscyA9IGxldmVscy5maWx0ZXIoZnVuY3Rpb24obGV2ZWwpIHtcbiAgICAgIHZhciBjaGVja1N1cHBvcnRlZCA9IGZ1bmN0aW9uKGNvZGVjKSB7IHJldHVybiBNZWRpYVNvdXJjZS5pc1R5cGVTdXBwb3J0ZWQoYHZpZGVvL21wNDtjb2RlY3M9JHtjb2RlY31gKTt9O1xuICAgICAgdmFyIGF1ZGlvQ29kZWMgPSBsZXZlbC5hdWRpb0NvZGVjLCB2aWRlb0NvZGVjID0gbGV2ZWwudmlkZW9Db2RlYztcblxuICAgICAgcmV0dXJuICghYXVkaW9Db2RlYyB8fCBjaGVja1N1cHBvcnRlZChhdWRpb0NvZGVjKSkgJiZcbiAgICAgICAgICAgICAoIXZpZGVvQ29kZWMgfHwgY2hlY2tTdXBwb3J0ZWQodmlkZW9Db2RlYykpO1xuICAgIH0pO1xuXG4gICAgaWYobGV2ZWxzLmxlbmd0aCkge1xuICAgICAgLy8gc3RhcnQgYml0cmF0ZSBpcyB0aGUgZmlyc3QgYml0cmF0ZSBvZiB0aGUgbWFuaWZlc3RcbiAgICAgIGJpdHJhdGVTdGFydCA9IGxldmVsc1swXS5iaXRyYXRlO1xuICAgICAgLy8gc29ydCBsZXZlbCBvbiBiaXRyYXRlXG4gICAgICBsZXZlbHMuc29ydChmdW5jdGlvbiAoYSwgYikge1xuICAgICAgICByZXR1cm4gYS5iaXRyYXRlIC0gYi5iaXRyYXRlO1xuICAgICAgfSk7XG4gICAgICB0aGlzLl9sZXZlbHMgPSBsZXZlbHM7XG4gICAgICAvLyBmaW5kIGluZGV4IG9mIGZpcnN0IGxldmVsIGluIHNvcnRlZCBsZXZlbHNcbiAgICAgIGZvciAoaSA9IDA7IGkgPCBsZXZlbHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKGxldmVsc1tpXS5iaXRyYXRlID09PSBiaXRyYXRlU3RhcnQpIHtcbiAgICAgICAgICB0aGlzLl9maXJzdExldmVsID0gaTtcbiAgICAgICAgICBsb2dnZXIubG9nKGBtYW5pZmVzdCBsb2FkZWQsJHtsZXZlbHMubGVuZ3RofSBsZXZlbChzKSBmb3VuZCwgZmlyc3QgYml0cmF0ZToke2JpdHJhdGVTdGFydH1gKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuTUFOSUZFU1RfUEFSU0VELCB7bGV2ZWxzOiB0aGlzLl9sZXZlbHMsIGZpcnN0TGV2ZWw6IHRoaXMuX2ZpcnN0TGV2ZWwsIHN0YXRzOiBkYXRhLnN0YXRzfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5ORVRXT1JLX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuTUFOSUZFU1RfUEFSU0lOR19FUlJPUiwgZmF0YWw6IHRydWUsIHVybDogaGxzLnVybCwgcmVhc29uOiAnbm8gY29tcGF0aWJsZSBsZXZlbCBmb3VuZCBpbiBtYW5pZmVzdCd9KTtcbiAgICB9XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgZ2V0IGxldmVscygpIHtcbiAgICByZXR1cm4gdGhpcy5fbGV2ZWxzO1xuICB9XG5cbiAgZ2V0IGxldmVsKCkge1xuICAgIHJldHVybiB0aGlzLl9sZXZlbDtcbiAgfVxuXG4gIHNldCBsZXZlbChuZXdMZXZlbCkge1xuICAgIGlmICh0aGlzLl9sZXZlbCAhPT0gbmV3TGV2ZWwgfHwgdGhpcy5fbGV2ZWxzW25ld0xldmVsXS5kZXRhaWxzID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMuc2V0TGV2ZWxJbnRlcm5hbChuZXdMZXZlbCk7XG4gICAgfVxuICB9XG5cbiBzZXRMZXZlbEludGVybmFsKG5ld0xldmVsKSB7XG4gICAgLy8gY2hlY2sgaWYgbGV2ZWwgaWR4IGlzIHZhbGlkXG4gICAgaWYgKG5ld0xldmVsID49IDAgJiYgbmV3TGV2ZWwgPCB0aGlzLl9sZXZlbHMubGVuZ3RoKSB7XG4gICAgICAvLyBzdG9wcGluZyBsaXZlIHJlbG9hZGluZyB0aW1lciBpZiBhbnlcbiAgICAgIGlmICh0aGlzLnRpbWVyKSB7XG4gICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnRpbWVyKTtcbiAgICAgICB0aGlzLnRpbWVyID0gbnVsbDtcbiAgICAgIH1cbiAgICAgIHRoaXMuX2xldmVsID0gbmV3TGV2ZWw7XG4gICAgICBsb2dnZXIubG9nKGBzd2l0Y2hpbmcgdG8gbGV2ZWwgJHtuZXdMZXZlbH1gKTtcbiAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuTEVWRUxfU1dJVENILCB7bGV2ZWw6IG5ld0xldmVsfSk7XG4gICAgICB2YXIgbGV2ZWwgPSB0aGlzLl9sZXZlbHNbbmV3TGV2ZWxdO1xuICAgICAgIC8vIGNoZWNrIGlmIHdlIG5lZWQgdG8gbG9hZCBwbGF5bGlzdCBmb3IgdGhpcyBsZXZlbFxuICAgICAgaWYgKGxldmVsLmRldGFpbHMgPT09IHVuZGVmaW5lZCB8fCBsZXZlbC5kZXRhaWxzLmxpdmUgPT09IHRydWUpIHtcbiAgICAgICAgLy8gbGV2ZWwgbm90IHJldHJpZXZlZCB5ZXQsIG9yIGxpdmUgcGxheWxpc3Qgd2UgbmVlZCB0byAocmUpbG9hZCBpdFxuICAgICAgICBsb2dnZXIubG9nKGAocmUpbG9hZGluZyBwbGF5bGlzdCBmb3IgbGV2ZWwgJHtuZXdMZXZlbH1gKTtcbiAgICAgICAgdmFyIHVybElkID0gbGV2ZWwudXJsSWQ7XG4gICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuTEVWRUxfTE9BRElORywge3VybDogbGV2ZWwudXJsW3VybElkXSwgbGV2ZWw6IG5ld0xldmVsLCBpZDogdXJsSWR9KTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gaW52YWxpZCBsZXZlbCBpZCBnaXZlbiwgdHJpZ2dlciBlcnJvclxuICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGUgOiBFcnJvclR5cGVzLk9USEVSX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuTEVWRUxfU1dJVENIX0VSUk9SLCBsZXZlbDogbmV3TGV2ZWwsIGZhdGFsOiBmYWxzZSwgcmVhc29uOiAnaW52YWxpZCBsZXZlbCBpZHgnfSk7XG4gICAgfVxuIH1cblxuICBnZXQgbWFudWFsTGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuX21hbnVhbExldmVsO1xuICB9XG5cbiAgc2V0IG1hbnVhbExldmVsKG5ld0xldmVsKSB7XG4gICAgdGhpcy5fbWFudWFsTGV2ZWwgPSBuZXdMZXZlbDtcbiAgICBpZiAobmV3TGV2ZWwgIT09IC0xKSB7XG4gICAgICB0aGlzLmxldmVsID0gbmV3TGV2ZWw7XG4gICAgfVxuICB9XG5cbiAgZ2V0IGZpcnN0TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2ZpcnN0TGV2ZWw7XG4gIH1cblxuICBzZXQgZmlyc3RMZXZlbChuZXdMZXZlbCkge1xuICAgIHRoaXMuX2ZpcnN0TGV2ZWwgPSBuZXdMZXZlbDtcbiAgfVxuXG4gIGdldCBzdGFydExldmVsKCkge1xuICAgIGlmICh0aGlzLl9zdGFydExldmVsID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB0aGlzLl9maXJzdExldmVsO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdGhpcy5fc3RhcnRMZXZlbDtcbiAgICB9XG4gIH1cblxuICBzZXQgc3RhcnRMZXZlbChuZXdMZXZlbCkge1xuICAgIHRoaXMuX3N0YXJ0TGV2ZWwgPSBuZXdMZXZlbDtcbiAgfVxuXG4gIG9uRXJyb3IoZXZlbnQsIGRhdGEpIHtcbiAgICBpZihkYXRhLmZhdGFsKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGRldGFpbHMgPSBkYXRhLmRldGFpbHMsIGhscyA9IHRoaXMuaGxzLCBsZXZlbElkLCBsZXZlbDtcbiAgICAvLyB0cnkgdG8gcmVjb3ZlciBub3QgZmF0YWwgZXJyb3JzXG4gICAgc3dpdGNoKGRldGFpbHMpIHtcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9FUlJPUjpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9USU1FT1VUOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuRlJBR19MT09QX0xPQURJTkdfRVJST1I6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5LRVlfTE9BRF9FUlJPUjpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLktFWV9MT0FEX1RJTUVPVVQ6XG4gICAgICAgICBsZXZlbElkID0gZGF0YS5mcmFnLmxldmVsO1xuICAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5MRVZFTF9MT0FEX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuTEVWRUxfTE9BRF9USU1FT1VUOlxuICAgICAgICBsZXZlbElkID0gZGF0YS5sZXZlbDtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBicmVhaztcbiAgICB9XG4gICAgLyogdHJ5IHRvIHN3aXRjaCB0byBhIHJlZHVuZGFudCBzdHJlYW0gaWYgYW55IGF2YWlsYWJsZS5cbiAgICAgKiBpZiBubyByZWR1bmRhbnQgc3RyZWFtIGF2YWlsYWJsZSwgZW1lcmdlbmN5IHN3aXRjaCBkb3duIChpZiBpbiBhdXRvIG1vZGUgYW5kIGN1cnJlbnQgbGV2ZWwgbm90IDApXG4gICAgICogb3RoZXJ3aXNlLCB3ZSBjYW5ub3QgcmVjb3ZlciB0aGlzIG5ldHdvcmsgZXJyb3IgLi4uXG4gICAgICogZG9uJ3QgcmFpc2UgRlJBR19MT0FEX0VSUk9SIGFuZCBGUkFHX0xPQURfVElNRU9VVCBhcyBmYXRhbCwgYXMgaXQgaXMgaGFuZGxlZCBieSBtZWRpYUNvbnRyb2xsZXJcbiAgICAgKi9cbiAgICBpZiAobGV2ZWxJZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBsZXZlbCA9IHRoaXMuX2xldmVsc1tsZXZlbElkXTtcbiAgICAgIGlmIChsZXZlbC51cmxJZCA8IChsZXZlbC51cmwubGVuZ3RoIC0gMSkpIHtcbiAgICAgICAgbGV2ZWwudXJsSWQrKztcbiAgICAgICAgbGV2ZWwuZGV0YWlscyA9IHVuZGVmaW5lZDtcbiAgICAgICAgbG9nZ2VyLndhcm4oYGxldmVsIGNvbnRyb2xsZXIsJHtkZXRhaWxzfSBmb3IgbGV2ZWwgJHtsZXZlbElkfTogc3dpdGNoaW5nIHRvIHJlZHVuZGFudCBzdHJlYW0gaWQgJHtsZXZlbC51cmxJZH1gKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHdlIGNvdWxkIHRyeSB0byByZWNvdmVyIGlmIGluIGF1dG8gbW9kZSBhbmQgY3VycmVudCBsZXZlbCBub3QgbG93ZXN0IGxldmVsICgwKVxuICAgICAgICBsZXQgcmVjb3ZlcmFibGUgPSAoKHRoaXMuX21hbnVhbExldmVsID09PSAtMSkgJiYgbGV2ZWxJZCk7XG4gICAgICAgIGlmIChyZWNvdmVyYWJsZSkge1xuICAgICAgICAgIGxvZ2dlci53YXJuKGBsZXZlbCBjb250cm9sbGVyLCR7ZGV0YWlsc306IGVtZXJnZW5jeSBzd2l0Y2gtZG93biBmb3IgbmV4dCBmcmFnbWVudGApO1xuICAgICAgICAgIGhscy5hYnJDb250cm9sbGVyLm5leHRBdXRvTGV2ZWwgPSAwO1xuICAgICAgICB9IGVsc2UgaWYobGV2ZWwgJiYgbGV2ZWwuZGV0YWlscyAmJiBsZXZlbC5kZXRhaWxzLmxpdmUpIHtcbiAgICAgICAgICBsb2dnZXIud2FybihgbGV2ZWwgY29udHJvbGxlciwke2RldGFpbHN9IG9uIGxpdmUgc3RyZWFtLCBkaXNjYXJkYCk7XG4gICAgICAgIC8vIEZSQUdfTE9BRF9FUlJPUiBhbmQgRlJBR19MT0FEX1RJTUVPVVQgYXJlIGhhbmRsZWQgYnkgbWVkaWFDb250cm9sbGVyXG4gICAgICAgIH0gZWxzZSBpZiAoZGV0YWlscyAhPT0gRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9FUlJPUiAmJiBkZXRhaWxzICE9PSBFcnJvckRldGFpbHMuRlJBR19MT0FEX1RJTUVPVVQpIHtcbiAgICAgICAgICBsb2dnZXIuZXJyb3IoYGNhbm5vdCByZWNvdmVyICR7ZGV0YWlsc30gZXJyb3JgKTtcbiAgICAgICAgICB0aGlzLl9sZXZlbCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAvLyBzdG9wcGluZyBsaXZlIHJlbG9hZGluZyB0aW1lciBpZiBhbnlcbiAgICAgICAgICBpZiAodGhpcy50aW1lcikge1xuICAgICAgICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnRpbWVyKTtcbiAgICAgICAgICAgIHRoaXMudGltZXIgPSBudWxsO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyByZWRpc3BhdGNoIHNhbWUgZXJyb3IgYnV0IHdpdGggZmF0YWwgc2V0IHRvIHRydWVcbiAgICAgICAgICBkYXRhLmZhdGFsID0gdHJ1ZTtcbiAgICAgICAgICBobHMudHJpZ2dlcihldmVudCwgZGF0YSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBvbkxldmVsTG9hZGVkKGV2ZW50LCBkYXRhKSB7XG4gICAgLy8gY2hlY2sgaWYgY3VycmVudCBwbGF5bGlzdCBpcyBhIGxpdmUgcGxheWxpc3RcbiAgICBpZiAoZGF0YS5kZXRhaWxzLmxpdmUgJiYgIXRoaXMudGltZXIpIHtcbiAgICAgIC8vIGlmIGxpdmUgcGxheWxpc3Qgd2Ugd2lsbCBoYXZlIHRvIHJlbG9hZCBpdCBwZXJpb2RpY2FsbHlcbiAgICAgIC8vIHNldCByZWxvYWQgcGVyaW9kIHRvIHBsYXlsaXN0IHRhcmdldCBkdXJhdGlvblxuICAgICAgdGhpcy50aW1lciA9IHNldEludGVydmFsKHRoaXMub250aWNrLCAxMDAwICogZGF0YS5kZXRhaWxzLnRhcmdldGR1cmF0aW9uKTtcbiAgICB9XG4gICAgaWYgKCFkYXRhLmRldGFpbHMubGl2ZSAmJiB0aGlzLnRpbWVyKSB7XG4gICAgICAvLyBwbGF5bGlzdCBpcyBub3QgbGl2ZSBhbmQgdGltZXIgaXMgYXJtZWQgOiBzdG9wcGluZyBpdFxuICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnRpbWVyKTtcbiAgICAgIHRoaXMudGltZXIgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIHRpY2soKSB7XG4gICAgdmFyIGxldmVsSWQgPSB0aGlzLl9sZXZlbDtcbiAgICBpZiAobGV2ZWxJZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB2YXIgbGV2ZWwgPSB0aGlzLl9sZXZlbHNbbGV2ZWxJZF0sIHVybElkID0gbGV2ZWwudXJsSWQ7XG4gICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkxFVkVMX0xPQURJTkcsIHt1cmw6IGxldmVsLnVybFt1cmxJZF0sIGxldmVsOiBsZXZlbElkLCBpZDogdXJsSWR9KTtcbiAgICB9XG4gIH1cblxuICBuZXh0TG9hZExldmVsKCkge1xuICAgIGlmICh0aGlzLl9tYW51YWxMZXZlbCAhPT0gLTEpIHtcbiAgICAgIHJldHVybiB0aGlzLl9tYW51YWxMZXZlbDtcbiAgICB9IGVsc2Uge1xuICAgICByZXR1cm4gdGhpcy5obHMuYWJyQ29udHJvbGxlci5uZXh0QXV0b0xldmVsO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBMZXZlbENvbnRyb2xsZXI7XG5cbiIsIi8qXG4gKiBNU0UgTWVkaWEgQ29udHJvbGxlclxuKi9cblxuaW1wb3J0IERlbXV4ZXIgZnJvbSAnLi4vZGVtdXgvZGVtdXhlcic7XG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IEJpbmFyeVNlYXJjaCBmcm9tICcuLi91dGlscy9iaW5hcnktc2VhcmNoJztcbmltcG9ydCBMZXZlbEhlbHBlciBmcm9tICcuLi9oZWxwZXIvbGV2ZWwtaGVscGVyJztcbmltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuXG5jb25zdCBTdGF0ZSA9IHtcbiAgRVJST1IgOiAtMixcbiAgU1RBUlRJTkcgOiAtMSxcbiAgSURMRSA6IDAsXG4gIEtFWV9MT0FESU5HIDogMSxcbiAgRlJBR19MT0FESU5HIDogMixcbiAgRlJBR19MT0FESU5HX1dBSVRJTkdfUkVUUlkgOiAzLFxuICBXQUlUSU5HX0xFVkVMIDogNCxcbiAgUEFSU0lORyA6IDUsXG4gIFBBUlNFRCA6IDYsXG4gIEFQUEVORElORyA6IDcsXG4gIEJVRkZFUl9GTFVTSElORyA6IDhcbn07XG5cbmNsYXNzIE1TRU1lZGlhQ29udHJvbGxlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgdGhpcy5jb25maWcgPSBobHMuY29uZmlnO1xuICAgIHRoaXMuYXVkaW9Db2RlY1N3YXAgPSBmYWxzZTtcbiAgICB0aGlzLmhscyA9IGhscztcbiAgICB0aGlzLnRpY2tzID0gMDtcbiAgICAvLyBTb3VyY2UgQnVmZmVyIGxpc3RlbmVyc1xuICAgIHRoaXMub25zYnVlID0gdGhpcy5vblNCVXBkYXRlRW5kLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbnNiZSAgPSB0aGlzLm9uU0JVcGRhdGVFcnJvci5iaW5kKHRoaXMpO1xuICAgIC8vIGludGVybmFsIGxpc3RlbmVyc1xuICAgIHRoaXMub25tZWRpYWF0dDAgPSB0aGlzLm9uTWVkaWFBdHRhY2hpbmcuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9ubWVkaWFkZXQwID0gdGhpcy5vbk1lZGlhRGV0YWNoaW5nLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbm1wID0gdGhpcy5vbk1hbmlmZXN0UGFyc2VkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmxsID0gdGhpcy5vbkxldmVsTG9hZGVkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmZsID0gdGhpcy5vbkZyYWdMb2FkZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9ua2wgPSB0aGlzLm9uS2V5TG9hZGVkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmlzID0gdGhpcy5vbkluaXRTZWdtZW50LmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmZwZyA9IHRoaXMub25GcmFnUGFyc2luZy5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25mcCA9IHRoaXMub25GcmFnUGFyc2VkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmVyciA9IHRoaXMub25FcnJvci5iaW5kKHRoaXMpO1xuICAgIHRoaXMub250aWNrID0gdGhpcy50aWNrLmJpbmQodGhpcyk7XG4gICAgaGxzLm9uKEV2ZW50Lk1FRElBX0FUVEFDSElORywgdGhpcy5vbm1lZGlhYXR0MCk7XG4gICAgaGxzLm9uKEV2ZW50Lk1FRElBX0RFVEFDSElORywgdGhpcy5vbm1lZGlhZGV0MCk7XG4gICAgaGxzLm9uKEV2ZW50Lk1BTklGRVNUX1BBUlNFRCwgdGhpcy5vbm1wKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5zdG9wKCk7XG4gICAgdmFyIGhscyA9IHRoaXMuaGxzO1xuICAgIGhscy5vZmYoRXZlbnQuTUVESUFfQVRUQUNISU5HLCB0aGlzLm9ubWVkaWFhdHQwKTtcbiAgICBobHMub2ZmKEV2ZW50Lk1FRElBX0RFVEFDSElORywgdGhpcy5vbm1lZGlhZGV0MCk7XG4gICAgaGxzLm9mZihFdmVudC5NQU5JRkVTVF9QQVJTRUQsIHRoaXMub25tcCk7XG4gICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gIH1cblxuICBzdGFydExvYWQoKSB7XG4gICAgaWYgKHRoaXMubGV2ZWxzICYmIHRoaXMubWVkaWEpIHtcbiAgICAgIHRoaXMuc3RhcnRJbnRlcm5hbCgpO1xuICAgICAgaWYgKHRoaXMubGFzdEN1cnJlbnRUaW1lKSB7XG4gICAgICAgIGxvZ2dlci5sb2coYHNlZWtpbmcgQCAke3RoaXMubGFzdEN1cnJlbnRUaW1lfWApO1xuICAgICAgICBpZiAoIXRoaXMubGFzdFBhdXNlZCkge1xuICAgICAgICAgIGxvZ2dlci5sb2coJ3Jlc3VtaW5nIHZpZGVvJyk7XG4gICAgICAgICAgdGhpcy5tZWRpYS5wbGF5KCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmxhc3RDdXJyZW50VGltZSA9IDA7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5TVEFSVElORztcbiAgICAgIH1cbiAgICAgIHRoaXMubmV4dExvYWRQb3NpdGlvbiA9IHRoaXMuc3RhcnRQb3NpdGlvbiA9IHRoaXMubGFzdEN1cnJlbnRUaW1lO1xuICAgICAgdGhpcy50aWNrKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvZ2dlci53YXJuKCdjYW5ub3Qgc3RhcnQgbG9hZGluZyBhcyBlaXRoZXIgbWFuaWZlc3Qgbm90IHBhcnNlZCBvciB2aWRlbyBub3QgYXR0YWNoZWQnKTtcbiAgICB9XG4gIH1cblxuICBzdGFydEludGVybmFsKCkge1xuICAgIHZhciBobHMgPSB0aGlzLmhscztcbiAgICB0aGlzLnN0b3AoKTtcbiAgICB0aGlzLmRlbXV4ZXIgPSBuZXcgRGVtdXhlcihobHMpO1xuICAgIHRoaXMudGltZXIgPSBzZXRJbnRlcnZhbCh0aGlzLm9udGljaywgMTAwKTtcbiAgICB0aGlzLmxldmVsID0gLTE7XG4gICAgdGhpcy5mcmFnTG9hZEVycm9yID0gMDtcbiAgICBobHMub24oRXZlbnQuRlJBR19MT0FERUQsIHRoaXMub25mbCk7XG4gICAgaGxzLm9uKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQsIHRoaXMub25pcyk7XG4gICAgaGxzLm9uKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLCB0aGlzLm9uZnBnKTtcbiAgICBobHMub24oRXZlbnQuRlJBR19QQVJTRUQsIHRoaXMub25mcCk7XG4gICAgaGxzLm9uKEV2ZW50LkVSUk9SLCB0aGlzLm9uZXJyKTtcbiAgICBobHMub24oRXZlbnQuTEVWRUxfTE9BREVELCB0aGlzLm9ubGwpO1xuICAgIGhscy5vbihFdmVudC5LRVlfTE9BREVELCB0aGlzLm9ua2wpO1xuICB9XG5cbiAgc3RvcCgpIHtcbiAgICB0aGlzLm1wNHNlZ21lbnRzID0gW107XG4gICAgdGhpcy5mbHVzaFJhbmdlID0gW107XG4gICAgdGhpcy5idWZmZXJSYW5nZSA9IFtdO1xuICAgIHZhciBmcmFnID0gdGhpcy5mcmFnQ3VycmVudDtcbiAgICBpZiAoZnJhZykge1xuICAgICAgaWYgKGZyYWcubG9hZGVyKSB7XG4gICAgICAgIGZyYWcubG9hZGVyLmFib3J0KCk7XG4gICAgICB9XG4gICAgICB0aGlzLmZyYWdDdXJyZW50ID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5mcmFnUHJldmlvdXMgPSBudWxsO1xuICAgIGlmICh0aGlzLnNvdXJjZUJ1ZmZlcikge1xuICAgICAgZm9yKHZhciB0eXBlIGluIHRoaXMuc291cmNlQnVmZmVyKSB7XG4gICAgICAgIHZhciBzYiA9IHRoaXMuc291cmNlQnVmZmVyW3R5cGVdO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHRoaXMubWVkaWFTb3VyY2UucmVtb3ZlU291cmNlQnVmZmVyKHNiKTtcbiAgICAgICAgICBzYi5yZW1vdmVFdmVudExpc3RlbmVyKCd1cGRhdGVlbmQnLCB0aGlzLm9uc2J1ZSk7XG4gICAgICAgICAgc2IucmVtb3ZlRXZlbnRMaXN0ZW5lcignZXJyb3InLCB0aGlzLm9uc2JlKTtcbiAgICAgICAgfSBjYXRjaChlcnIpIHtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5zb3VyY2VCdWZmZXIgPSBudWxsO1xuICAgIH1cbiAgICBpZiAodGhpcy50aW1lcikge1xuICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnRpbWVyKTtcbiAgICAgIHRoaXMudGltZXIgPSBudWxsO1xuICAgIH1cbiAgICBpZiAodGhpcy5kZW11eGVyKSB7XG4gICAgICB0aGlzLmRlbXV4ZXIuZGVzdHJveSgpO1xuICAgICAgdGhpcy5kZW11eGVyID0gbnVsbDtcbiAgICB9XG4gICAgdmFyIGhscyA9IHRoaXMuaGxzO1xuICAgIGhscy5vZmYoRXZlbnQuRlJBR19MT0FERUQsIHRoaXMub25mbCk7XG4gICAgaGxzLm9mZihFdmVudC5GUkFHX1BBUlNFRCwgdGhpcy5vbmZwKTtcbiAgICBobHMub2ZmKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLCB0aGlzLm9uZnBnKTtcbiAgICBobHMub2ZmKEV2ZW50LkxFVkVMX0xPQURFRCwgdGhpcy5vbmxsKTtcbiAgICBobHMub2ZmKEV2ZW50LktFWV9MT0FERUQsIHRoaXMub25rbCk7XG4gICAgaGxzLm9mZihFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULCB0aGlzLm9uaXMpO1xuICAgIGhscy5vZmYoRXZlbnQuRVJST1IsIHRoaXMub25lcnIpO1xuICB9XG5cbiAgdGljaygpIHtcbiAgICB0aGlzLnRpY2tzKys7XG4gICAgaWYgKHRoaXMudGlja3MgPT09IDEpIHtcbiAgICAgIHRoaXMuZG9UaWNrKCk7XG4gICAgICBpZiAodGhpcy50aWNrcyA+IDEpIHtcbiAgICAgICAgc2V0VGltZW91dCh0aGlzLnRpY2ssIDEpO1xuICAgICAgfVxuICAgICAgdGhpcy50aWNrcyA9IDA7XG4gICAgfVxuICB9XG5cbiAgZG9UaWNrKCkge1xuICAgIHZhciBwb3MsIGxldmVsLCBsZXZlbERldGFpbHMsIGhscyA9IHRoaXMuaGxzO1xuICAgIHN3aXRjaCh0aGlzLnN0YXRlKSB7XG4gICAgICBjYXNlIFN0YXRlLkVSUk9SOlxuICAgICAgICAvL2Rvbid0IGRvIGFueXRoaW5nIGluIGVycm9yIHN0YXRlIHRvIGF2b2lkIGJyZWFraW5nIGZ1cnRoZXIgLi4uXG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBTdGF0ZS5TVEFSVElORzpcbiAgICAgICAgLy8gZGV0ZXJtaW5lIGxvYWQgbGV2ZWxcbiAgICAgICAgdGhpcy5zdGFydExldmVsID0gaGxzLnN0YXJ0TGV2ZWw7XG4gICAgICAgIGlmICh0aGlzLnN0YXJ0TGV2ZWwgPT09IC0xKSB7XG4gICAgICAgICAgLy8gLTEgOiBndWVzcyBzdGFydCBMZXZlbCBieSBkb2luZyBhIGJpdHJhdGUgdGVzdCBieSBsb2FkaW5nIGZpcnN0IGZyYWdtZW50IG9mIGxvd2VzdCBxdWFsaXR5IGxldmVsXG4gICAgICAgICAgdGhpcy5zdGFydExldmVsID0gMDtcbiAgICAgICAgICB0aGlzLmZyYWdCaXRyYXRlVGVzdCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgLy8gc2V0IG5ldyBsZXZlbCB0byBwbGF5bGlzdCBsb2FkZXIgOiB0aGlzIHdpbGwgdHJpZ2dlciBzdGFydCBsZXZlbCBsb2FkXG4gICAgICAgIHRoaXMubGV2ZWwgPSBobHMubmV4dExvYWRMZXZlbCA9IHRoaXMuc3RhcnRMZXZlbDtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLldBSVRJTkdfTEVWRUw7XG4gICAgICAgIHRoaXMubG9hZGVkbWV0YWRhdGEgPSBmYWxzZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFN0YXRlLklETEU6XG4gICAgICAgIC8vIGlmIHZpZGVvIGRldGFjaGVkIG9yIHVuYm91bmQgZXhpdCBsb29wXG4gICAgICAgIGlmICghdGhpcy5tZWRpYSkge1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIC8vIGRldGVybWluZSBuZXh0IGNhbmRpZGF0ZSBmcmFnbWVudCB0byBiZSBsb2FkZWQsIGJhc2VkIG9uIGN1cnJlbnQgcG9zaXRpb24gYW5kXG4gICAgICAgIC8vICBlbmQgb2YgYnVmZmVyIHBvc2l0aW9uXG4gICAgICAgIC8vICBlbnN1cmUgNjBzIG9mIGJ1ZmZlciB1cGZyb250XG4gICAgICAgIC8vIGlmIHdlIGhhdmUgbm90IHlldCBsb2FkZWQgYW55IGZyYWdtZW50LCBzdGFydCBsb2FkaW5nIGZyb20gc3RhcnQgcG9zaXRpb25cbiAgICAgICAgaWYgKHRoaXMubG9hZGVkbWV0YWRhdGEpIHtcbiAgICAgICAgICBwb3MgPSB0aGlzLm1lZGlhLmN1cnJlbnRUaW1lO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBvcyA9IHRoaXMubmV4dExvYWRQb3NpdGlvbjtcbiAgICAgICAgfVxuICAgICAgICAvLyBkZXRlcm1pbmUgbmV4dCBsb2FkIGxldmVsXG4gICAgICAgIGlmICh0aGlzLnN0YXJ0RnJhZ21lbnRSZXF1ZXN0ZWQgPT09IGZhbHNlKSB7XG4gICAgICAgICAgbGV2ZWwgPSB0aGlzLnN0YXJ0TGV2ZWw7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gd2UgYXJlIG5vdCBhdCBwbGF5YmFjayBzdGFydCwgZ2V0IG5leHQgbG9hZCBsZXZlbCBmcm9tIGxldmVsIENvbnRyb2xsZXJcbiAgICAgICAgICBsZXZlbCA9IGhscy5uZXh0TG9hZExldmVsO1xuICAgICAgICB9XG4gICAgICAgIHZhciBidWZmZXJJbmZvID0gdGhpcy5idWZmZXJJbmZvKHBvcywwLjMpLFxuICAgICAgICAgICAgYnVmZmVyTGVuID0gYnVmZmVySW5mby5sZW4sXG4gICAgICAgICAgICBidWZmZXJFbmQgPSBidWZmZXJJbmZvLmVuZCxcbiAgICAgICAgICAgIGZyYWdQcmV2aW91cyA9IHRoaXMuZnJhZ1ByZXZpb3VzLFxuICAgICAgICAgICAgbWF4QnVmTGVuO1xuICAgICAgICAvLyBjb21wdXRlIG1heCBCdWZmZXIgTGVuZ3RoIHRoYXQgd2UgY291bGQgZ2V0IGZyb20gdGhpcyBsb2FkIGxldmVsLCBiYXNlZCBvbiBsZXZlbCBiaXRyYXRlLiBkb24ndCBidWZmZXIgbW9yZSB0aGFuIDYwIE1CIGFuZCBtb3JlIHRoYW4gMzBzXG4gICAgICAgIGlmICgodGhpcy5sZXZlbHNbbGV2ZWxdKS5oYXNPd25Qcm9wZXJ0eSgnYml0cmF0ZScpKSB7XG4gICAgICAgICAgbWF4QnVmTGVuID0gTWF0aC5tYXgoOCAqIHRoaXMuY29uZmlnLm1heEJ1ZmZlclNpemUgLyB0aGlzLmxldmVsc1tsZXZlbF0uYml0cmF0ZSwgdGhpcy5jb25maWcubWF4QnVmZmVyTGVuZ3RoKTtcbiAgICAgICAgICBtYXhCdWZMZW4gPSBNYXRoLm1pbihtYXhCdWZMZW4sIHRoaXMuY29uZmlnLm1heE1heEJ1ZmZlckxlbmd0aCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbWF4QnVmTGVuID0gdGhpcy5jb25maWcubWF4QnVmZmVyTGVuZ3RoO1xuICAgICAgICB9XG4gICAgICAgIC8vIGlmIGJ1ZmZlciBsZW5ndGggaXMgbGVzcyB0aGFuIG1heEJ1ZkxlbiB0cnkgdG8gbG9hZCBhIG5ldyBmcmFnbWVudFxuICAgICAgICBpZiAoYnVmZmVyTGVuIDwgbWF4QnVmTGVuKSB7XG4gICAgICAgICAgLy8gc2V0IG5leHQgbG9hZCBsZXZlbCA6IHRoaXMgd2lsbCB0cmlnZ2VyIGEgcGxheWxpc3QgbG9hZCBpZiBuZWVkZWRcbiAgICAgICAgICBobHMubmV4dExvYWRMZXZlbCA9IGxldmVsO1xuICAgICAgICAgIHRoaXMubGV2ZWwgPSBsZXZlbDtcbiAgICAgICAgICBsZXZlbERldGFpbHMgPSB0aGlzLmxldmVsc1tsZXZlbF0uZGV0YWlscztcbiAgICAgICAgICAvLyBpZiBsZXZlbCBpbmZvIG5vdCByZXRyaWV2ZWQgeWV0LCBzd2l0Y2ggc3RhdGUgYW5kIHdhaXQgZm9yIGxldmVsIHJldHJpZXZhbFxuICAgICAgICAgIGlmICh0eXBlb2YgbGV2ZWxEZXRhaWxzID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLldBSVRJTkdfTEVWRUw7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gZmluZCBmcmFnbWVudCBpbmRleCwgY29udGlndW91cyB3aXRoIGVuZCBvZiBidWZmZXIgcG9zaXRpb25cbiAgICAgICAgICBsZXQgZnJhZ21lbnRzID0gbGV2ZWxEZXRhaWxzLmZyYWdtZW50cyxcbiAgICAgICAgICAgICAgZnJhZ0xlbiA9IGZyYWdtZW50cy5sZW5ndGgsXG4gICAgICAgICAgICAgIHN0YXJ0ID0gZnJhZ21lbnRzWzBdLnN0YXJ0LFxuICAgICAgICAgICAgICBlbmQgPSBmcmFnbWVudHNbZnJhZ0xlbi0xXS5zdGFydCArIGZyYWdtZW50c1tmcmFnTGVuLTFdLmR1cmF0aW9uLFxuICAgICAgICAgICAgICBmcmFnO1xuXG4gICAgICAgICAgICAvLyBpbiBjYXNlIG9mIGxpdmUgcGxheWxpc3Qgd2UgbmVlZCB0byBlbnN1cmUgdGhhdCByZXF1ZXN0ZWQgcG9zaXRpb24gaXMgbm90IGxvY2F0ZWQgYmVmb3JlIHBsYXlsaXN0IHN0YXJ0XG4gICAgICAgICAgaWYgKGxldmVsRGV0YWlscy5saXZlKSB7XG4gICAgICAgICAgICAvLyBjaGVjayBpZiByZXF1ZXN0ZWQgcG9zaXRpb24gaXMgd2l0aGluIHNlZWthYmxlIGJvdW5kYXJpZXMgOlxuICAgICAgICAgICAgLy9sb2dnZXIubG9nKGBzdGFydC9wb3MvYnVmRW5kL3NlZWtpbmc6JHtzdGFydC50b0ZpeGVkKDMpfS8ke3Bvcy50b0ZpeGVkKDMpfS8ke2J1ZmZlckVuZC50b0ZpeGVkKDMpfS8ke3RoaXMubWVkaWEuc2Vla2luZ31gKTtcbiAgICAgICAgICAgIGlmIChidWZmZXJFbmQgPCBNYXRoLm1heChzdGFydCxlbmQtdGhpcy5jb25maWcubGl2ZU1heExhdGVuY3lEdXJhdGlvbkNvdW50KmxldmVsRGV0YWlscy50YXJnZXRkdXJhdGlvbikpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnNlZWtBZnRlckJ1ZmZlcmVkID0gc3RhcnQgKyBNYXRoLm1heCgwLCBsZXZlbERldGFpbHMudG90YWxkdXJhdGlvbiAtIHRoaXMuY29uZmlnLmxpdmVTeW5jRHVyYXRpb25Db3VudCAqIGxldmVsRGV0YWlscy50YXJnZXRkdXJhdGlvbik7XG4gICAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgYnVmZmVyIGVuZDogJHtidWZmZXJFbmR9IGlzIGxvY2F0ZWQgdG9vIGZhciBmcm9tIHRoZSBlbmQgb2YgbGl2ZSBzbGlkaW5nIHBsYXlsaXN0LCBtZWRpYSBwb3NpdGlvbiB3aWxsIGJlIHJlc2V0ZWQgdG86ICR7dGhpcy5zZWVrQWZ0ZXJCdWZmZXJlZC50b0ZpeGVkKDMpfWApO1xuICAgICAgICAgICAgICAgIGJ1ZmZlckVuZCA9IHRoaXMuc2Vla0FmdGVyQnVmZmVyZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy5zdGFydEZyYWdtZW50UmVxdWVzdGVkICYmICFsZXZlbERldGFpbHMuUFRTS25vd24pIHtcbiAgICAgICAgICAgICAgLyogd2UgYXJlIHN3aXRjaGluZyBsZXZlbCBvbiBsaXZlIHBsYXlsaXN0LCBidXQgd2UgZG9uJ3QgaGF2ZSBhbnkgUFRTIGluZm8gZm9yIHRoYXQgcXVhbGl0eSBsZXZlbCAuLi5cbiAgICAgICAgICAgICAgICAgdHJ5IHRvIGxvYWQgZnJhZyBtYXRjaGluZyB3aXRoIG5leHQgU04uXG4gICAgICAgICAgICAgICAgIGV2ZW4gaWYgU04gYXJlIG5vdCBzeW5jaHJvbml6ZWQgYmV0d2VlbiBwbGF5bGlzdHMsIGxvYWRpbmcgdGhpcyBmcmFnIHdpbGwgaGVscCB1c1xuICAgICAgICAgICAgICAgICBjb21wdXRlIHBsYXlsaXN0IHNsaWRpbmcgYW5kIGZpbmQgdGhlIHJpZ2h0IG9uZSBhZnRlciBpbiBjYXNlIGl0IHdhcyBub3QgdGhlIHJpZ2h0IGNvbnNlY3V0aXZlIG9uZSAqL1xuICAgICAgICAgICAgICBpZiAoZnJhZ1ByZXZpb3VzKSB7XG4gICAgICAgICAgICAgICAgdmFyIHRhcmdldFNOID0gZnJhZ1ByZXZpb3VzLnNuICsgMTtcbiAgICAgICAgICAgICAgICBpZiAodGFyZ2V0U04gPj0gbGV2ZWxEZXRhaWxzLnN0YXJ0U04gJiYgdGFyZ2V0U04gPD0gbGV2ZWxEZXRhaWxzLmVuZFNOKSB7XG4gICAgICAgICAgICAgICAgICBmcmFnID0gZnJhZ21lbnRzW3RhcmdldFNOIC0gbGV2ZWxEZXRhaWxzLnN0YXJ0U05dO1xuICAgICAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgbGl2ZSBwbGF5bGlzdCwgc3dpdGNoaW5nIHBsYXlsaXN0LCBsb2FkIGZyYWcgd2l0aCBuZXh0IFNOOiAke2ZyYWcuc259YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmICghZnJhZykge1xuICAgICAgICAgICAgICAgIC8qIHdlIGhhdmUgbm8gaWRlYSBhYm91dCB3aGljaCBmcmFnbWVudCBzaG91bGQgYmUgbG9hZGVkLlxuICAgICAgICAgICAgICAgICAgIHNvIGxldCdzIGxvYWQgbWlkIGZyYWdtZW50LiBpdCB3aWxsIGhlbHAgY29tcHV0aW5nIHBsYXlsaXN0IHNsaWRpbmcgYW5kIGZpbmQgdGhlIHJpZ2h0IG9uZVxuICAgICAgICAgICAgICAgICovXG4gICAgICAgICAgICAgICAgZnJhZyA9IGZyYWdtZW50c1tNYXRoLm1pbihmcmFnTGVuIC0gMSwgTWF0aC5yb3VuZChmcmFnTGVuIC8gMikpXTtcbiAgICAgICAgICAgICAgICBsb2dnZXIubG9nKGBsaXZlIHBsYXlsaXN0LCBzd2l0Y2hpbmcgcGxheWxpc3QsIHVua25vd24sIGxvYWQgbWlkZGxlIGZyYWcgOiAke2ZyYWcuc259YCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gVm9EIHBsYXlsaXN0OiBpZiBidWZmZXJFbmQgYmVmb3JlIHN0YXJ0IG9mIHBsYXlsaXN0LCBsb2FkIGZpcnN0IGZyYWdtZW50XG4gICAgICAgICAgICBpZiAoYnVmZmVyRW5kIDwgc3RhcnQpIHtcbiAgICAgICAgICAgICAgZnJhZyA9IGZyYWdtZW50c1swXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKCFmcmFnKSB7XG4gICAgICAgICAgICB2YXIgZm91bmRGcmFnO1xuICAgICAgICAgICAgaWYgKGJ1ZmZlckVuZCA8IGVuZCkge1xuICAgICAgICAgICAgICBmb3VuZEZyYWcgPSBCaW5hcnlTZWFyY2guc2VhcmNoKGZyYWdtZW50cywgKGNhbmRpZGF0ZSkgPT4ge1xuICAgICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZyhgbGV2ZWwvc24vc3RhcnQvZW5kL2J1ZkVuZDoke2xldmVsfS8ke2NhbmRpZGF0ZS5zbn0vJHtjYW5kaWRhdGUuc3RhcnR9LyR7KGNhbmRpZGF0ZS5zdGFydCtjYW5kaWRhdGUuZHVyYXRpb24pfS8ke2J1ZmZlckVuZH1gKTtcbiAgICAgICAgICAgICAgICAvLyBvZmZzZXQgc2hvdWxkIGJlIHdpdGhpbiBmcmFnbWVudCBib3VuZGFyeVxuICAgICAgICAgICAgICAgIGlmICgoY2FuZGlkYXRlLnN0YXJ0ICsgY2FuZGlkYXRlLmR1cmF0aW9uKSA8PSBidWZmZXJFbmQpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmIChjYW5kaWRhdGUuc3RhcnQgPiBidWZmZXJFbmQpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gcmVhY2ggZW5kIG9mIHBsYXlsaXN0XG4gICAgICAgICAgICAgIGZvdW5kRnJhZyA9IGZyYWdtZW50c1tmcmFnTGVuLTFdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGZvdW5kRnJhZykge1xuICAgICAgICAgICAgICBmcmFnID0gZm91bmRGcmFnO1xuICAgICAgICAgICAgICBzdGFydCA9IGZvdW5kRnJhZy5zdGFydDtcbiAgICAgICAgICAgICAgLy9sb2dnZXIubG9nKCdmaW5kIFNOIG1hdGNoaW5nIHdpdGggcG9zOicgKyAgYnVmZmVyRW5kICsgJzonICsgZnJhZy5zbik7XG4gICAgICAgICAgICAgIGlmIChmcmFnUHJldmlvdXMgJiYgZnJhZy5sZXZlbCA9PT0gZnJhZ1ByZXZpb3VzLmxldmVsICYmIGZyYWcuc24gPT09IGZyYWdQcmV2aW91cy5zbikge1xuICAgICAgICAgICAgICAgIGlmIChmcmFnLnNuIDwgbGV2ZWxEZXRhaWxzLmVuZFNOKSB7XG4gICAgICAgICAgICAgICAgICBmcmFnID0gZnJhZ21lbnRzW2ZyYWcuc24gKyAxIC0gbGV2ZWxEZXRhaWxzLnN0YXJ0U05dO1xuICAgICAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgU04ganVzdCBsb2FkZWQsIGxvYWQgbmV4dCBvbmU6ICR7ZnJhZy5zbn1gKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgLy8gaGF2ZSB3ZSByZWFjaGVkIGVuZCBvZiBWT0QgcGxheWxpc3QgP1xuICAgICAgICAgICAgICAgICAgaWYgKCFsZXZlbERldGFpbHMubGl2ZSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgbWVkaWFTb3VyY2UgPSB0aGlzLm1lZGlhU291cmNlO1xuICAgICAgICAgICAgICAgICAgICBpZiAobWVkaWFTb3VyY2UgJiYgbWVkaWFTb3VyY2UucmVhZHlTdGF0ZSA9PT0gJ29wZW4nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgIC8vIGVuc3VyZSBzb3VyY2VCdWZmZXIgYXJlIG5vdCBpbiB1cGRhdGluZyBzdGF0ZXNcbiAgICAgICAgICAgICAgICAgICAgICB2YXIgc2IgPSB0aGlzLnNvdXJjZUJ1ZmZlcjtcbiAgICAgICAgICAgICAgICAgICAgICBpZiAoISgoc2IuYXVkaW8gJiYgc2IuYXVkaW8udXBkYXRpbmcpIHx8IChzYi52aWRlbyAmJiBzYi52aWRlby51cGRhdGluZykpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2dnZXIubG9nKCdhbGwgbWVkaWEgZGF0YSBhdmFpbGFibGUsIHNpZ25hbCBlbmRPZlN0cmVhbSgpIHRvIE1lZGlhU291cmNlJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAvL05vdGlmeSB0aGUgbWVkaWEgZWxlbWVudCB0aGF0IGl0IG5vdyBoYXMgYWxsIG9mIHRoZSBtZWRpYSBkYXRhXG4gICAgICAgICAgICAgICAgICAgICAgICBtZWRpYVNvdXJjZS5lbmRPZlN0cmVhbSgpO1xuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgZnJhZyA9IG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmKGZyYWcpIHtcbiAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnICAgICAgbG9hZGluZyBmcmFnICcgKyBpICsnLHBvcy9idWZFbmQ6JyArIHBvcy50b0ZpeGVkKDMpICsgJy8nICsgYnVmZmVyRW5kLnRvRml4ZWQoMykpO1xuICAgICAgICAgICAgaWYgKChmcmFnLmRlY3J5cHRkYXRhLnVyaSAhPSBudWxsKSAmJiAoZnJhZy5kZWNyeXB0ZGF0YS5rZXkgPT0gbnVsbCkpIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgTG9hZGluZyBrZXkgZm9yICR7ZnJhZy5zbn0gb2YgWyR7bGV2ZWxEZXRhaWxzLnN0YXJ0U059ICwke2xldmVsRGV0YWlscy5lbmRTTn1dLGxldmVsICR7bGV2ZWx9YCk7XG4gICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5LRVlfTE9BRElORztcbiAgICAgICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuS0VZX0xPQURJTkcsIHtmcmFnOiBmcmFnfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBMb2FkaW5nICR7ZnJhZy5zbn0gb2YgWyR7bGV2ZWxEZXRhaWxzLnN0YXJ0U059ICwke2xldmVsRGV0YWlscy5lbmRTTn1dLGxldmVsICR7bGV2ZWx9LCBjdXJyZW50VGltZToke3Bvc30sYnVmZmVyRW5kOiR7YnVmZmVyRW5kLnRvRml4ZWQoMyl9YCk7XG4gICAgICAgICAgICAgIGZyYWcuYXV0b0xldmVsID0gaGxzLmF1dG9MZXZlbEVuYWJsZWQ7XG4gICAgICAgICAgICAgIGlmICh0aGlzLmxldmVscy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgICAgZnJhZy5leHBlY3RlZExlbiA9IE1hdGgucm91bmQoZnJhZy5kdXJhdGlvbiAqIHRoaXMubGV2ZWxzW2xldmVsXS5iaXRyYXRlIC8gOCk7XG4gICAgICAgICAgICAgICAgZnJhZy50cmVxdWVzdCA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIC8vIGVuc3VyZSB0aGF0IHdlIGFyZSBub3QgcmVsb2FkaW5nIHRoZSBzYW1lIGZyYWdtZW50cyBpbiBsb29wIC4uLlxuICAgICAgICAgICAgICBpZiAodGhpcy5mcmFnTG9hZElkeCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5mcmFnTG9hZElkeCsrO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuZnJhZ0xvYWRJZHggPSAwO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChmcmFnLmxvYWRDb3VudGVyKSB7XG4gICAgICAgICAgICAgICAgZnJhZy5sb2FkQ291bnRlcisrO1xuICAgICAgICAgICAgICAgIGxldCBtYXhUaHJlc2hvbGQgPSB0aGlzLmNvbmZpZy5mcmFnTG9hZGluZ0xvb3BUaHJlc2hvbGQ7XG4gICAgICAgICAgICAgICAgLy8gaWYgdGhpcyBmcmFnIGhhcyBhbHJlYWR5IGJlZW4gbG9hZGVkIDMgdGltZXMsIGFuZCBpZiBpdCBoYXMgYmVlbiByZWxvYWRlZCByZWNlbnRseVxuICAgICAgICAgICAgICAgIGlmIChmcmFnLmxvYWRDb3VudGVyID4gbWF4VGhyZXNob2xkICYmIChNYXRoLmFicyh0aGlzLmZyYWdMb2FkSWR4IC0gZnJhZy5sb2FkSWR4KSA8IG1heFRocmVzaG9sZCkpIHtcbiAgICAgICAgICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkZSQUdfTE9PUF9MT0FESU5HX0VSUk9SLCBmYXRhbDogZmFsc2UsIGZyYWc6IGZyYWd9KTtcbiAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZnJhZy5sb2FkQ291bnRlciA9IDE7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZnJhZy5sb2FkSWR4ID0gdGhpcy5mcmFnTG9hZElkeDtcbiAgICAgICAgICAgICAgdGhpcy5mcmFnQ3VycmVudCA9IGZyYWc7XG4gICAgICAgICAgICAgIHRoaXMuc3RhcnRGcmFnbWVudFJlcXVlc3RlZCA9IHRydWU7XG4gICAgICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkZSQUdfTE9BRElORywge2ZyYWc6IGZyYWd9KTtcbiAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLkZSQUdfTE9BRElORztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFN0YXRlLldBSVRJTkdfTEVWRUw6XG4gICAgICAgIGxldmVsID0gdGhpcy5sZXZlbHNbdGhpcy5sZXZlbF07XG4gICAgICAgIC8vIGNoZWNrIGlmIHBsYXlsaXN0IGlzIGFscmVhZHkgbG9hZGVkXG4gICAgICAgIGlmIChsZXZlbCAmJiBsZXZlbC5kZXRhaWxzKSB7XG4gICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFN0YXRlLkZSQUdfTE9BRElORzpcbiAgICAgICAgLypcbiAgICAgICAgICBtb25pdG9yIGZyYWdtZW50IHJldHJpZXZhbCB0aW1lLi4uXG4gICAgICAgICAgd2UgY29tcHV0ZSBleHBlY3RlZCB0aW1lIG9mIGFycml2YWwgb2YgdGhlIGNvbXBsZXRlIGZyYWdtZW50LlxuICAgICAgICAgIHdlIGNvbXBhcmUgaXQgdG8gZXhwZWN0ZWQgdGltZSBvZiBidWZmZXIgc3RhcnZhdGlvblxuICAgICAgICAqL1xuICAgICAgICBsZXQgdiA9IHRoaXMubWVkaWEsZnJhZyA9IHRoaXMuZnJhZ0N1cnJlbnQ7XG4gICAgICAgIC8qIG9ubHkgbW9uaXRvciBmcmFnIHJldHJpZXZhbCB0aW1lIGlmXG4gICAgICAgICh2aWRlbyBub3QgcGF1c2VkIE9SIGZpcnN0IGZyYWdtZW50IGJlaW5nIGxvYWRlZCkgQU5EIGF1dG9zd2l0Y2hpbmcgZW5hYmxlZCBBTkQgbm90IGxvd2VzdCBsZXZlbCBBTkQgbXVsdGlwbGUgbGV2ZWxzICovXG4gICAgICAgIGlmICh2ICYmICghdi5wYXVzZWQgfHwgdGhpcy5sb2FkZWRtZXRhZGF0YSA9PT0gZmFsc2UpICYmIGZyYWcuYXV0b0xldmVsICYmIHRoaXMubGV2ZWwgJiYgdGhpcy5sZXZlbHMubGVuZ3RoID4gMSkge1xuICAgICAgICAgIHZhciByZXF1ZXN0RGVsYXkgPSBwZXJmb3JtYW5jZS5ub3coKSAtIGZyYWcudHJlcXVlc3Q7XG4gICAgICAgICAgLy8gbW9uaXRvciBmcmFnbWVudCBsb2FkIHByb2dyZXNzIGFmdGVyIGhhbGYgb2YgZXhwZWN0ZWQgZnJhZ21lbnQgZHVyYXRpb24sdG8gc3RhYmlsaXplIGJpdHJhdGVcbiAgICAgICAgICBpZiAocmVxdWVzdERlbGF5ID4gKDUwMCAqIGZyYWcuZHVyYXRpb24pKSB7XG4gICAgICAgICAgICB2YXIgbG9hZFJhdGUgPSBmcmFnLmxvYWRlZCAqIDEwMDAgLyByZXF1ZXN0RGVsYXk7IC8vIGJ5dGUvc1xuICAgICAgICAgICAgaWYgKGZyYWcuZXhwZWN0ZWRMZW4gPCBmcmFnLmxvYWRlZCkge1xuICAgICAgICAgICAgICBmcmFnLmV4cGVjdGVkTGVuID0gZnJhZy5sb2FkZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwb3MgPSB2LmN1cnJlbnRUaW1lO1xuICAgICAgICAgICAgdmFyIGZyYWdMb2FkZWREZWxheSA9IChmcmFnLmV4cGVjdGVkTGVuIC0gZnJhZy5sb2FkZWQpIC8gbG9hZFJhdGU7XG4gICAgICAgICAgICB2YXIgYnVmZmVyU3RhcnZhdGlvbkRlbGF5ID0gdGhpcy5idWZmZXJJbmZvKHBvcywwLjMpLmVuZCAtIHBvcztcbiAgICAgICAgICAgIHZhciBmcmFnTGV2ZWxOZXh0TG9hZGVkRGVsYXkgPSBmcmFnLmR1cmF0aW9uICogdGhpcy5sZXZlbHNbaGxzLm5leHRMb2FkTGV2ZWxdLmJpdHJhdGUgLyAoOCAqIGxvYWRSYXRlKTsgLy9icHMvQnBzXG4gICAgICAgICAgICAvKiBpZiB3ZSBoYXZlIGxlc3MgdGhhbiAyIGZyYWcgZHVyYXRpb24gaW4gYnVmZmVyIGFuZCBpZiBmcmFnIGxvYWRlZCBkZWxheSBpcyBncmVhdGVyIHRoYW4gYnVmZmVyIHN0YXJ2YXRpb24gZGVsYXlcbiAgICAgICAgICAgICAgLi4uIGFuZCBhbHNvIGJpZ2dlciB0aGFuIGR1cmF0aW9uIG5lZWRlZCB0byBsb2FkIGZyYWdtZW50IGF0IG5leHQgbGV2ZWwgLi4uKi9cbiAgICAgICAgICAgIGlmIChidWZmZXJTdGFydmF0aW9uRGVsYXkgPCAoMiAqIGZyYWcuZHVyYXRpb24pICYmIGZyYWdMb2FkZWREZWxheSA+IGJ1ZmZlclN0YXJ2YXRpb25EZWxheSAmJiBmcmFnTG9hZGVkRGVsYXkgPiBmcmFnTGV2ZWxOZXh0TG9hZGVkRGVsYXkpIHtcbiAgICAgICAgICAgICAgLy8gYWJvcnQgZnJhZ21lbnQgbG9hZGluZyAuLi5cbiAgICAgICAgICAgICAgbG9nZ2VyLndhcm4oJ2xvYWRpbmcgdG9vIHNsb3csIGFib3J0IGZyYWdtZW50IGxvYWRpbmcnKTtcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgZnJhZ0xvYWRlZERlbGF5L2J1ZmZlclN0YXJ2YXRpb25EZWxheS9mcmFnTGV2ZWxOZXh0TG9hZGVkRGVsYXkgOiR7ZnJhZ0xvYWRlZERlbGF5LnRvRml4ZWQoMSl9LyR7YnVmZmVyU3RhcnZhdGlvbkRlbGF5LnRvRml4ZWQoMSl9LyR7ZnJhZ0xldmVsTmV4dExvYWRlZERlbGF5LnRvRml4ZWQoMSl9YCk7XG4gICAgICAgICAgICAgIC8vYWJvcnQgZnJhZ21lbnQgbG9hZGluZ1xuICAgICAgICAgICAgICBmcmFnLmxvYWRlci5hYm9ydCgpO1xuICAgICAgICAgICAgICBobHMudHJpZ2dlcihFdmVudC5GUkFHX0xPQURfRU1FUkdFTkNZX0FCT1JURUQsIHtmcmFnOiBmcmFnfSk7XG4gICAgICAgICAgICAgIC8vIHN3aXRjaCBiYWNrIHRvIElETEUgc3RhdGUgdG8gcmVxdWVzdCBuZXcgZnJhZ21lbnQgYXQgbG93ZXN0IGxldmVsXG4gICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgU3RhdGUuRlJBR19MT0FESU5HX1dBSVRJTkdfUkVUUlk6XG4gICAgICAgIHZhciBub3cgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgdmFyIHJldHJ5RGF0ZSA9IHRoaXMucmV0cnlEYXRlO1xuICAgICAgICB2YXIgbWVkaWEgPSB0aGlzLm1lZGlhO1xuICAgICAgICB2YXIgaXNTZWVraW5nID0gbWVkaWEgJiYgbWVkaWEuc2Vla2luZztcbiAgICAgICAgLy8gaWYgY3VycmVudCB0aW1lIGlzIGd0IHRoYW4gcmV0cnlEYXRlLCBvciBpZiBtZWRpYSBzZWVraW5nIGxldCdzIHN3aXRjaCB0byBJRExFIHN0YXRlIHRvIHJldHJ5IGxvYWRpbmdcbiAgICAgICAgaWYoIXJldHJ5RGF0ZSB8fCAobm93ID49IHJldHJ5RGF0ZSkgfHwgaXNTZWVraW5nKSB7XG4gICAgICAgICAgbG9nZ2VyLmxvZyhgbWVkaWFDb250cm9sbGVyOiByZXRyeURhdGUgcmVhY2hlZCwgc3dpdGNoIGJhY2sgdG8gSURMRSBzdGF0ZWApO1xuICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBTdGF0ZS5QQVJTSU5HOlxuICAgICAgICAvLyBub3RoaW5nIHRvIGRvLCB3YWl0IGZvciBmcmFnbWVudCBiZWluZyBwYXJzZWRcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFN0YXRlLlBBUlNFRDpcbiAgICAgIGNhc2UgU3RhdGUuQVBQRU5ESU5HOlxuICAgICAgICBpZiAodGhpcy5zb3VyY2VCdWZmZXIpIHtcbiAgICAgICAgICBpZiAodGhpcy5tZWRpYS5lcnJvcikge1xuICAgICAgICAgICAgbG9nZ2VyLmVycm9yKCd0cnlpbmcgdG8gYXBwZW5kIGFsdGhvdWdoIGEgbWVkaWEgZXJyb3Igb2NjdXJlZCwgc3dpdGNoIHRvIEVSUk9SIHN0YXRlJyk7XG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuRVJST1I7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIGlmIE1QNCBzZWdtZW50IGFwcGVuZGluZyBpbiBwcm9ncmVzcyBub3RoaW5nIHRvIGRvXG4gICAgICAgICAgZWxzZSBpZiAoKHRoaXMuc291cmNlQnVmZmVyLmF1ZGlvICYmIHRoaXMuc291cmNlQnVmZmVyLmF1ZGlvLnVwZGF0aW5nKSB8fFxuICAgICAgICAgICAgICh0aGlzLnNvdXJjZUJ1ZmZlci52aWRlbyAmJiB0aGlzLnNvdXJjZUJ1ZmZlci52aWRlby51cGRhdGluZykpIHtcbiAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnc2IgYXBwZW5kIGluIHByb2dyZXNzJyk7XG4gICAgICAgIC8vIGNoZWNrIGlmIGFueSBNUDQgc2VnbWVudHMgbGVmdCB0byBhcHBlbmRcbiAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMubXA0c2VnbWVudHMubGVuZ3RoKSB7XG4gICAgICAgICAgICB2YXIgc2VnbWVudCA9IHRoaXMubXA0c2VnbWVudHMuc2hpZnQoKTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZyhgYXBwZW5kaW5nICR7c2VnbWVudC50eXBlfSBTQiwgc2l6ZToke3NlZ21lbnQuZGF0YS5sZW5ndGh9KTtcbiAgICAgICAgICAgICAgdGhpcy5zb3VyY2VCdWZmZXJbc2VnbWVudC50eXBlXS5hcHBlbmRCdWZmZXIoc2VnbWVudC5kYXRhKTtcbiAgICAgICAgICAgICAgdGhpcy5hcHBlbmRFcnJvciA9IDA7XG4gICAgICAgICAgICB9IGNhdGNoKGVycikge1xuICAgICAgICAgICAgICAvLyBpbiBjYXNlIGFueSBlcnJvciBvY2N1cmVkIHdoaWxlIGFwcGVuZGluZywgcHV0IGJhY2sgc2VnbWVudCBpbiBtcDRzZWdtZW50cyB0YWJsZVxuICAgICAgICAgICAgICBsb2dnZXIuZXJyb3IoYGVycm9yIHdoaWxlIHRyeWluZyB0byBhcHBlbmQgYnVmZmVyOiR7ZXJyLm1lc3NhZ2V9LHRyeSBhcHBlbmRpbmcgbGF0ZXJgKTtcbiAgICAgICAgICAgICAgdGhpcy5tcDRzZWdtZW50cy51bnNoaWZ0KHNlZ21lbnQpO1xuICAgICAgICAgICAgICAgIC8vIGp1c3QgZGlzY2FyZCBRdW90YUV4Y2VlZGVkRXJyb3IgZm9yIG5vdywgYW5kIHdhaXQgZm9yIHRoZSBuYXR1cmFsIGJyb3dzZXIgYnVmZmVyIGV2aWN0aW9uXG4gICAgICAgICAgICAgIC8vaHR0cDovL3d3dy53My5vcmcvVFIvaHRtbDUvaW5mcmFzdHJ1Y3R1cmUuaHRtbCNxdW90YWV4Y2VlZGVkZXJyb3JcbiAgICAgICAgICAgICAgaWYoZXJyLmNvZGUgIT09IDIyKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuYXBwZW5kRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgIHRoaXMuYXBwZW5kRXJyb3IrKztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgdGhpcy5hcHBlbmRFcnJvciA9IDE7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHZhciBldmVudCA9IHt0eXBlOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuQlVGRkVSX0FQUEVORF9FUlJPUiwgZnJhZzogdGhpcy5mcmFnQ3VycmVudH07XG4gICAgICAgICAgICAgICAgLyogd2l0aCBVSEQgY29udGVudCwgd2UgY291bGQgZ2V0IGxvb3Agb2YgcXVvdGEgZXhjZWVkZWQgZXJyb3IgdW50aWxcbiAgICAgICAgICAgICAgICAgIGJyb3dzZXIgaXMgYWJsZSB0byBldmljdCBzb21lIGRhdGEgZnJvbSBzb3VyY2VidWZmZXIuIHJldHJ5aW5nIGhlbHAgcmVjb3ZlcmluZyB0aGlzXG4gICAgICAgICAgICAgICAgKi9cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5hcHBlbmRFcnJvciA+IHRoaXMuY29uZmlnLmFwcGVuZEVycm9yTWF4UmV0cnkpIHtcbiAgICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYGZhaWwgJHt0aGlzLmNvbmZpZy5hcHBlbmRFcnJvck1heFJldHJ5fSB0aW1lcyB0byBhcHBlbmQgc2VnbWVudCBpbiBzb3VyY2VCdWZmZXJgKTtcbiAgICAgICAgICAgICAgICAgIGV2ZW50LmZhdGFsID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCBldmVudCk7XG4gICAgICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuRVJST1I7XG4gICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIGV2ZW50LmZhdGFsID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICBobHMudHJpZ2dlcihFdmVudC5FUlJPUiwgZXZlbnQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLkFQUEVORElORztcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gc291cmNlQnVmZmVyIHVuZGVmaW5lZCwgc3dpdGNoIGJhY2sgdG8gSURMRSBzdGF0ZVxuICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBTdGF0ZS5CVUZGRVJfRkxVU0hJTkc6XG4gICAgICAgIC8vIGxvb3AgdGhyb3VnaCBhbGwgYnVmZmVyIHJhbmdlcyB0byBmbHVzaFxuICAgICAgICB3aGlsZSh0aGlzLmZsdXNoUmFuZ2UubGVuZ3RoKSB7XG4gICAgICAgICAgdmFyIHJhbmdlID0gdGhpcy5mbHVzaFJhbmdlWzBdO1xuICAgICAgICAgIC8vIGZsdXNoQnVmZmVyIHdpbGwgYWJvcnQgYW55IGJ1ZmZlciBhcHBlbmQgaW4gcHJvZ3Jlc3MgYW5kIGZsdXNoIEF1ZGlvL1ZpZGVvIEJ1ZmZlclxuICAgICAgICAgIGlmICh0aGlzLmZsdXNoQnVmZmVyKHJhbmdlLnN0YXJ0LCByYW5nZS5lbmQpKSB7XG4gICAgICAgICAgICAvLyByYW5nZSBmbHVzaGVkLCByZW1vdmUgZnJvbSBmbHVzaCBhcnJheVxuICAgICAgICAgICAgdGhpcy5mbHVzaFJhbmdlLnNoaWZ0KCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGZsdXNoIGluIHByb2dyZXNzLCBjb21lIGJhY2sgbGF0ZXJcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5mbHVzaFJhbmdlLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIC8vIGhhbmRsZSBlbmQgb2YgaW1tZWRpYXRlIHN3aXRjaGluZyBpZiBuZWVkZWRcbiAgICAgICAgICBpZiAodGhpcy5pbW1lZGlhdGVTd2l0Y2gpIHtcbiAgICAgICAgICAgIHRoaXMuaW1tZWRpYXRlTGV2ZWxTd2l0Y2hFbmQoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gbW92ZSB0byBJRExFIG9uY2UgZmx1c2ggY29tcGxldGUuIHRoaXMgc2hvdWxkIHRyaWdnZXIgbmV3IGZyYWdtZW50IGxvYWRpbmdcbiAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICAgICAgICAvLyByZXNldCByZWZlcmVuY2UgdG8gZnJhZ1xuICAgICAgICAgIHRoaXMuZnJhZ1ByZXZpb3VzID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICAgLyogaWYgbm90IGV2ZXJ5dGhpbmcgZmx1c2hlZCwgc3RheSBpbiBCVUZGRVJfRkxVU0hJTkcgc3RhdGUuIHdlIHdpbGwgY29tZSBiYWNrIGhlcmVcbiAgICAgICAgICAgIGVhY2ggdGltZSBzb3VyY2VCdWZmZXIgdXBkYXRlZW5kKCkgY2FsbGJhY2sgd2lsbCBiZSB0cmlnZ2VyZWRcbiAgICAgICAgICAgICovXG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIC8vIGNoZWNrIGJ1ZmZlclxuICAgIHRoaXMuX2NoZWNrQnVmZmVyKCk7XG4gICAgLy8gY2hlY2svdXBkYXRlIGN1cnJlbnQgZnJhZ21lbnRcbiAgICB0aGlzLl9jaGVja0ZyYWdtZW50Q2hhbmdlZCgpO1xuICB9XG5cblxuICBidWZmZXJJbmZvKHBvcyxtYXhIb2xlRHVyYXRpb24pIHtcbiAgICB2YXIgbWVkaWEgPSB0aGlzLm1lZGlhLFxuICAgICAgICB2YnVmZmVyZWQgPSBtZWRpYS5idWZmZXJlZCxcbiAgICAgICAgYnVmZmVyZWQgPSBbXSxpO1xuICAgIGZvciAoaSA9IDA7IGkgPCB2YnVmZmVyZWQubGVuZ3RoOyBpKyspIHtcbiAgICAgIGJ1ZmZlcmVkLnB1c2goe3N0YXJ0OiB2YnVmZmVyZWQuc3RhcnQoaSksIGVuZDogdmJ1ZmZlcmVkLmVuZChpKX0pO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5idWZmZXJlZEluZm8oYnVmZmVyZWQscG9zLG1heEhvbGVEdXJhdGlvbik7XG4gIH1cblxuICBidWZmZXJlZEluZm8oYnVmZmVyZWQscG9zLG1heEhvbGVEdXJhdGlvbikge1xuICAgIHZhciBidWZmZXJlZDIgPSBbXSxcbiAgICAgICAgLy8gYnVmZmVyU3RhcnQgYW5kIGJ1ZmZlckVuZCBhcmUgYnVmZmVyIGJvdW5kYXJpZXMgYXJvdW5kIGN1cnJlbnQgdmlkZW8gcG9zaXRpb25cbiAgICAgICAgYnVmZmVyTGVuLGJ1ZmZlclN0YXJ0LCBidWZmZXJFbmQsYnVmZmVyU3RhcnROZXh0LGk7XG4gICAgLy8gc29ydCBvbiBidWZmZXIuc3RhcnQvc21hbGxlciBlbmQgKElFIGRvZXMgbm90IGFsd2F5cyByZXR1cm4gc29ydGVkIGJ1ZmZlcmVkIHJhbmdlKVxuICAgIGJ1ZmZlcmVkLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgIHZhciBkaWZmID0gYS5zdGFydCAtIGIuc3RhcnQ7XG4gICAgICBpZiAoZGlmZikge1xuICAgICAgICByZXR1cm4gZGlmZjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBiLmVuZCAtIGEuZW5kO1xuICAgICAgfVxuICAgIH0pO1xuICAgIC8vIHRoZXJlIG1pZ2h0IGJlIHNvbWUgc21hbGwgaG9sZXMgYmV0d2VlbiBidWZmZXIgdGltZSByYW5nZVxuICAgIC8vIGNvbnNpZGVyIHRoYXQgaG9sZXMgc21hbGxlciB0aGFuIG1heEhvbGVEdXJhdGlvbiBhcmUgaXJyZWxldmFudCBhbmQgYnVpbGQgYW5vdGhlclxuICAgIC8vIGJ1ZmZlciB0aW1lIHJhbmdlIHJlcHJlc2VudGF0aW9ucyB0aGF0IGRpc2NhcmRzIHRob3NlIGhvbGVzXG4gICAgZm9yIChpID0gMDsgaSA8IGJ1ZmZlcmVkLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgYnVmMmxlbiA9IGJ1ZmZlcmVkMi5sZW5ndGg7XG4gICAgICBpZihidWYybGVuKSB7XG4gICAgICAgIHZhciBidWYyZW5kID0gYnVmZmVyZWQyW2J1ZjJsZW4gLSAxXS5lbmQ7XG4gICAgICAgIC8vIGlmIHNtYWxsIGhvbGUgKHZhbHVlIGJldHdlZW4gMCBvciBtYXhIb2xlRHVyYXRpb24gKSBvciBvdmVybGFwcGluZyAobmVnYXRpdmUpXG4gICAgICAgIGlmKChidWZmZXJlZFtpXS5zdGFydCAtIGJ1ZjJlbmQpIDwgbWF4SG9sZUR1cmF0aW9uKSB7XG4gICAgICAgICAgLy8gbWVyZ2Ugb3ZlcmxhcHBpbmcgdGltZSByYW5nZXNcbiAgICAgICAgICAvLyB1cGRhdGUgbGFzdFJhbmdlLmVuZCBvbmx5IGlmIHNtYWxsZXIgdGhhbiBpdGVtLmVuZFxuICAgICAgICAgIC8vIGUuZy4gIFsgMSwgMTVdIHdpdGggIFsgMiw4XSA9PiBbIDEsMTVdIChubyBuZWVkIHRvIG1vZGlmeSBsYXN0UmFuZ2UuZW5kKVxuICAgICAgICAgIC8vIHdoZXJlYXMgWyAxLCA4XSB3aXRoICBbIDIsMTVdID0+IFsgMSwxNV0gKCBsYXN0UmFuZ2Ugc2hvdWxkIHN3aXRjaCBmcm9tIFsxLDhdIHRvIFsxLDE1XSlcbiAgICAgICAgICBpZihidWZmZXJlZFtpXS5lbmQgPiBidWYyZW5kKSB7XG4gICAgICAgICAgICBidWZmZXJlZDJbYnVmMmxlbiAtIDFdLmVuZCA9IGJ1ZmZlcmVkW2ldLmVuZDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gYmlnIGhvbGVcbiAgICAgICAgICBidWZmZXJlZDIucHVzaChidWZmZXJlZFtpXSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGZpcnN0IHZhbHVlXG4gICAgICAgIGJ1ZmZlcmVkMi5wdXNoKGJ1ZmZlcmVkW2ldKTtcbiAgICAgIH1cbiAgICB9XG4gICAgZm9yIChpID0gMCwgYnVmZmVyTGVuID0gMCwgYnVmZmVyU3RhcnQgPSBidWZmZXJFbmQgPSBwb3M7IGkgPCBidWZmZXJlZDIubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBzdGFydCA9ICBidWZmZXJlZDJbaV0uc3RhcnQsXG4gICAgICAgICAgZW5kID0gYnVmZmVyZWQyW2ldLmVuZDtcbiAgICAgIC8vbG9nZ2VyLmxvZygnYnVmIHN0YXJ0L2VuZDonICsgYnVmZmVyZWQuc3RhcnQoaSkgKyAnLycgKyBidWZmZXJlZC5lbmQoaSkpO1xuICAgICAgaWYgKChwb3MgKyBtYXhIb2xlRHVyYXRpb24pID49IHN0YXJ0ICYmIHBvcyA8IGVuZCkge1xuICAgICAgICAvLyBwbGF5IHBvc2l0aW9uIGlzIGluc2lkZSB0aGlzIGJ1ZmZlciBUaW1lUmFuZ2UsIHJldHJpZXZlIGVuZCBvZiBidWZmZXIgcG9zaXRpb24gYW5kIGJ1ZmZlciBsZW5ndGhcbiAgICAgICAgYnVmZmVyU3RhcnQgPSBzdGFydDtcbiAgICAgICAgYnVmZmVyRW5kID0gZW5kICsgbWF4SG9sZUR1cmF0aW9uO1xuICAgICAgICBidWZmZXJMZW4gPSBidWZmZXJFbmQgLSBwb3M7XG4gICAgICB9IGVsc2UgaWYgKChwb3MgKyBtYXhIb2xlRHVyYXRpb24pIDwgc3RhcnQpIHtcbiAgICAgICAgYnVmZmVyU3RhcnROZXh0ID0gc3RhcnQ7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7bGVuOiBidWZmZXJMZW4sIHN0YXJ0OiBidWZmZXJTdGFydCwgZW5kOiBidWZmZXJFbmQsIG5leHRTdGFydCA6IGJ1ZmZlclN0YXJ0TmV4dH07XG4gIH1cblxuICBnZXRCdWZmZXJSYW5nZShwb3NpdGlvbikge1xuICAgIHZhciBpLCByYW5nZTtcbiAgICBmb3IgKGkgPSB0aGlzLmJ1ZmZlclJhbmdlLmxlbmd0aCAtIDE7IGkgPj0wOyBpLS0pIHtcbiAgICAgIHJhbmdlID0gdGhpcy5idWZmZXJSYW5nZVtpXTtcbiAgICAgIGlmIChwb3NpdGlvbiA+PSByYW5nZS5zdGFydCAmJiBwb3NpdGlvbiA8PSByYW5nZS5lbmQpIHtcbiAgICAgICAgcmV0dXJuIHJhbmdlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGdldCBjdXJyZW50TGV2ZWwoKSB7XG4gICAgaWYgKHRoaXMubWVkaWEpIHtcbiAgICAgIHZhciByYW5nZSA9IHRoaXMuZ2V0QnVmZmVyUmFuZ2UodGhpcy5tZWRpYS5jdXJyZW50VGltZSk7XG4gICAgICBpZiAocmFuZ2UpIHtcbiAgICAgICAgcmV0dXJuIHJhbmdlLmZyYWcubGV2ZWw7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiAtMTtcbiAgfVxuXG4gIGdldCBuZXh0QnVmZmVyUmFuZ2UoKSB7XG4gICAgaWYgKHRoaXMubWVkaWEpIHtcbiAgICAgIC8vIGZpcnN0IGdldCBlbmQgcmFuZ2Ugb2YgY3VycmVudCBmcmFnbWVudFxuICAgICAgcmV0dXJuIHRoaXMuZm9sbG93aW5nQnVmZmVyUmFuZ2UodGhpcy5nZXRCdWZmZXJSYW5nZSh0aGlzLm1lZGlhLmN1cnJlbnRUaW1lKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGZvbGxvd2luZ0J1ZmZlclJhbmdlKHJhbmdlKSB7XG4gICAgaWYgKHJhbmdlKSB7XG4gICAgICAvLyB0cnkgdG8gZ2V0IHJhbmdlIG9mIG5leHQgZnJhZ21lbnQgKDUwMG1zIGFmdGVyIHRoaXMgcmFuZ2UpXG4gICAgICByZXR1cm4gdGhpcy5nZXRCdWZmZXJSYW5nZShyYW5nZS5lbmQgKyAwLjUpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGdldCBuZXh0TGV2ZWwoKSB7XG4gICAgdmFyIHJhbmdlID0gdGhpcy5uZXh0QnVmZmVyUmFuZ2U7XG4gICAgaWYgKHJhbmdlKSB7XG4gICAgICByZXR1cm4gcmFuZ2UuZnJhZy5sZXZlbDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIC0xO1xuICAgIH1cbiAgfVxuXG4gIGlzQnVmZmVyZWQocG9zaXRpb24pIHtcbiAgICB2YXIgdiA9IHRoaXMubWVkaWEsIGJ1ZmZlcmVkID0gdi5idWZmZXJlZDtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGJ1ZmZlcmVkLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAocG9zaXRpb24gPj0gYnVmZmVyZWQuc3RhcnQoaSkgJiYgcG9zaXRpb24gPD0gYnVmZmVyZWQuZW5kKGkpKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBfY2hlY2tGcmFnbWVudENoYW5nZWQoKSB7XG4gICAgdmFyIHJhbmdlQ3VycmVudCwgY3VycmVudFRpbWUsIHZpZGVvID0gdGhpcy5tZWRpYTtcbiAgICBpZiAodmlkZW8gJiYgdmlkZW8uc2Vla2luZyA9PT0gZmFsc2UpIHtcbiAgICAgIGN1cnJlbnRUaW1lID0gdmlkZW8uY3VycmVudFRpbWU7XG4gICAgICAvKiBpZiB2aWRlbyBlbGVtZW50IGlzIGluIHNlZWtlZCBzdGF0ZSwgY3VycmVudFRpbWUgY2FuIG9ubHkgaW5jcmVhc2UuXG4gICAgICAgIChhc3N1bWluZyB0aGF0IHBsYXliYWNrIHJhdGUgaXMgcG9zaXRpdmUgLi4uKVxuICAgICAgICBBcyBzb21ldGltZXMgY3VycmVudFRpbWUganVtcHMgYmFjayB0byB6ZXJvIGFmdGVyIGFcbiAgICAgICAgbWVkaWEgZGVjb2RlIGVycm9yLCBjaGVjayB0aGlzLCB0byBhdm9pZCBzZWVraW5nIGJhY2sgdG9cbiAgICAgICAgd3JvbmcgcG9zaXRpb24gYWZ0ZXIgYSBtZWRpYSBkZWNvZGUgZXJyb3JcbiAgICAgICovXG4gICAgICBpZihjdXJyZW50VGltZSA+IHZpZGVvLnBsYXliYWNrUmF0ZSp0aGlzLmxhc3RDdXJyZW50VGltZSkge1xuICAgICAgICB0aGlzLmxhc3RDdXJyZW50VGltZSA9IGN1cnJlbnRUaW1lO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMuaXNCdWZmZXJlZChjdXJyZW50VGltZSkpIHtcbiAgICAgICAgcmFuZ2VDdXJyZW50ID0gdGhpcy5nZXRCdWZmZXJSYW5nZShjdXJyZW50VGltZSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuaXNCdWZmZXJlZChjdXJyZW50VGltZSArIDAuMSkpIHtcbiAgICAgICAgLyogZW5zdXJlIHRoYXQgRlJBR19DSEFOR0VEIGV2ZW50IGlzIHRyaWdnZXJlZCBhdCBzdGFydHVwLFxuICAgICAgICAgIHdoZW4gZmlyc3QgdmlkZW8gZnJhbWUgaXMgZGlzcGxheWVkIGFuZCBwbGF5YmFjayBpcyBwYXVzZWQuXG4gICAgICAgICAgYWRkIGEgdG9sZXJhbmNlIG9mIDEwMG1zLCBpbiBjYXNlIGN1cnJlbnQgcG9zaXRpb24gaXMgbm90IGJ1ZmZlcmVkLFxuICAgICAgICAgIGNoZWNrIGlmIGN1cnJlbnQgcG9zKzEwMG1zIGlzIGJ1ZmZlcmVkIGFuZCB1c2UgdGhhdCBidWZmZXIgcmFuZ2VcbiAgICAgICAgICBmb3IgRlJBR19DSEFOR0VEIGV2ZW50IHJlcG9ydGluZyAqL1xuICAgICAgICByYW5nZUN1cnJlbnQgPSB0aGlzLmdldEJ1ZmZlclJhbmdlKGN1cnJlbnRUaW1lICsgMC4xKTtcbiAgICAgIH1cbiAgICAgIGlmIChyYW5nZUN1cnJlbnQpIHtcbiAgICAgICAgdmFyIGZyYWdQbGF5aW5nID0gcmFuZ2VDdXJyZW50LmZyYWc7XG4gICAgICAgIGlmIChmcmFnUGxheWluZyAhPT0gdGhpcy5mcmFnUGxheWluZykge1xuICAgICAgICAgIHRoaXMuZnJhZ1BsYXlpbmcgPSBmcmFnUGxheWluZztcbiAgICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkZSQUdfQ0hBTkdFRCwge2ZyYWc6IGZyYWdQbGF5aW5nfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKlxuICAgIGFib3J0IGFueSBidWZmZXIgYXBwZW5kIGluIHByb2dyZXNzLCBhbmQgZmx1c2ggYWxsIGJ1ZmZlcmVkIGRhdGFcbiAgICByZXR1cm4gdHJ1ZSBvbmNlIGV2ZXJ5dGhpbmcgaGFzIGJlZW4gZmx1c2hlZC5cbiAgICBzb3VyY2VCdWZmZXIuYWJvcnQoKSBhbmQgc291cmNlQnVmZmVyLnJlbW92ZSgpIGFyZSBhc3luY2hyb25vdXMgb3BlcmF0aW9uc1xuICAgIHRoZSBpZGVhIGlzIHRvIGNhbGwgdGhpcyBmdW5jdGlvbiBmcm9tIHRpY2soKSB0aW1lciBhbmQgY2FsbCBpdCBhZ2FpbiB1bnRpbCBhbGwgcmVzb3VyY2VzIGhhdmUgYmVlbiBjbGVhbmVkXG4gICAgdGhlIHRpbWVyIGlzIHJlYXJtZWQgdXBvbiBzb3VyY2VCdWZmZXIgdXBkYXRlZW5kKCkgZXZlbnQsIHNvIHRoaXMgc2hvdWxkIGJlIG9wdGltYWxcbiAgKi9cbiAgZmx1c2hCdWZmZXIoc3RhcnRPZmZzZXQsIGVuZE9mZnNldCkge1xuICAgIHZhciBzYiwgaSwgYnVmU3RhcnQsIGJ1ZkVuZCwgZmx1c2hTdGFydCwgZmx1c2hFbmQ7XG4gICAgLy9sb2dnZXIubG9nKCdmbHVzaEJ1ZmZlcixwb3Mvc3RhcnQvZW5kOiAnICsgdGhpcy5tZWRpYS5jdXJyZW50VGltZSArICcvJyArIHN0YXJ0T2Zmc2V0ICsgJy8nICsgZW5kT2Zmc2V0KTtcbiAgICAvLyBzYWZlZ3VhcmQgdG8gYXZvaWQgaW5maW5pdGUgbG9vcGluZ1xuICAgIGlmICh0aGlzLmZsdXNoQnVmZmVyQ291bnRlcisrIDwgKDIgKiB0aGlzLmJ1ZmZlclJhbmdlLmxlbmd0aCkgJiYgdGhpcy5zb3VyY2VCdWZmZXIpIHtcbiAgICAgIGZvciAodmFyIHR5cGUgaW4gdGhpcy5zb3VyY2VCdWZmZXIpIHtcbiAgICAgICAgc2IgPSB0aGlzLnNvdXJjZUJ1ZmZlclt0eXBlXTtcbiAgICAgICAgaWYgKCFzYi51cGRhdGluZykge1xuICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBzYi5idWZmZXJlZC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYnVmU3RhcnQgPSBzYi5idWZmZXJlZC5zdGFydChpKTtcbiAgICAgICAgICAgIGJ1ZkVuZCA9IHNiLmJ1ZmZlcmVkLmVuZChpKTtcbiAgICAgICAgICAgIC8vIHdvcmthcm91bmQgZmlyZWZveCBub3QgYWJsZSB0byBwcm9wZXJseSBmbHVzaCBtdWx0aXBsZSBidWZmZXJlZCByYW5nZS5cbiAgICAgICAgICAgIGlmIChuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkuaW5kZXhPZignZmlyZWZveCcpICE9PSAtMSAmJiBlbmRPZmZzZXQgPT09IE51bWJlci5QT1NJVElWRV9JTkZJTklUWSkge1xuICAgICAgICAgICAgICBmbHVzaFN0YXJ0ID0gc3RhcnRPZmZzZXQ7XG4gICAgICAgICAgICAgIGZsdXNoRW5kID0gZW5kT2Zmc2V0O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgZmx1c2hTdGFydCA9IE1hdGgubWF4KGJ1ZlN0YXJ0LCBzdGFydE9mZnNldCk7XG4gICAgICAgICAgICAgIGZsdXNoRW5kID0gTWF0aC5taW4oYnVmRW5kLCBlbmRPZmZzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLyogc29tZXRpbWVzIHNvdXJjZWJ1ZmZlci5yZW1vdmUoKSBkb2VzIG5vdCBmbHVzaFxuICAgICAgICAgICAgICAgdGhlIGV4YWN0IGV4cGVjdGVkIHRpbWUgcmFuZ2UuXG4gICAgICAgICAgICAgICB0byBhdm9pZCByb3VuZGluZyBpc3N1ZXMvaW5maW5pdGUgbG9vcCxcbiAgICAgICAgICAgICAgIG9ubHkgZmx1c2ggYnVmZmVyIHJhbmdlIG9mIGxlbmd0aCBncmVhdGVyIHRoYW4gNTAwbXMuXG4gICAgICAgICAgICAqL1xuICAgICAgICAgICAgaWYgKGZsdXNoRW5kIC0gZmx1c2hTdGFydCA+IDAuNSkge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBmbHVzaCAke3R5cGV9IFske2ZsdXNoU3RhcnR9LCR7Zmx1c2hFbmR9XSwgb2YgWyR7YnVmU3RhcnR9LCR7YnVmRW5kfV0sIHBvczoke3RoaXMubWVkaWEuY3VycmVudFRpbWV9YCk7XG4gICAgICAgICAgICAgIHNiLnJlbW92ZShmbHVzaFN0YXJ0LCBmbHVzaEVuZCk7XG4gICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy9sb2dnZXIubG9nKCdhYm9ydCAnICsgdHlwZSArICcgYXBwZW5kIGluIHByb2dyZXNzJyk7XG4gICAgICAgICAgLy8gdGhpcyB3aWxsIGFib3J0IGFueSBhcHBlbmRpbmcgaW4gcHJvZ3Jlc3NcbiAgICAgICAgICAvL3NiLmFib3J0KCk7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLyogYWZ0ZXIgc3VjY2Vzc2Z1bCBidWZmZXIgZmx1c2hpbmcsIHJlYnVpbGQgYnVmZmVyIFJhbmdlIGFycmF5XG4gICAgICBsb29wIHRocm91Z2ggZXhpc3RpbmcgYnVmZmVyIHJhbmdlIGFuZCBjaGVjayBpZlxuICAgICAgY29ycmVzcG9uZGluZyByYW5nZSBpcyBzdGlsbCBidWZmZXJlZC4gb25seSBwdXNoIHRvIG5ldyBhcnJheSBhbHJlYWR5IGJ1ZmZlcmVkIHJhbmdlXG4gICAgKi9cbiAgICB2YXIgbmV3UmFuZ2UgPSBbXSxyYW5nZTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5idWZmZXJSYW5nZS5sZW5ndGg7IGkrKykge1xuICAgICAgcmFuZ2UgPSB0aGlzLmJ1ZmZlclJhbmdlW2ldO1xuICAgICAgaWYgKHRoaXMuaXNCdWZmZXJlZCgocmFuZ2Uuc3RhcnQgKyByYW5nZS5lbmQpIC8gMikpIHtcbiAgICAgICAgbmV3UmFuZ2UucHVzaChyYW5nZSk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuYnVmZmVyUmFuZ2UgPSBuZXdSYW5nZTtcbiAgICBsb2dnZXIubG9nKCdidWZmZXIgZmx1c2hlZCcpO1xuICAgIC8vIGV2ZXJ5dGhpbmcgZmx1c2hlZCAhXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvKlxuICAgIG9uIGltbWVkaWF0ZSBsZXZlbCBzd2l0Y2ggOlxuICAgICAtIHBhdXNlIHBsYXliYWNrIGlmIHBsYXlpbmdcbiAgICAgLSBjYW5jZWwgYW55IHBlbmRpbmcgbG9hZCByZXF1ZXN0XG4gICAgIC0gYW5kIHRyaWdnZXIgYSBidWZmZXIgZmx1c2hcbiAgKi9cbiAgaW1tZWRpYXRlTGV2ZWxTd2l0Y2goKSB7XG4gICAgbG9nZ2VyLmxvZygnaW1tZWRpYXRlTGV2ZWxTd2l0Y2gnKTtcbiAgICBpZiAoIXRoaXMuaW1tZWRpYXRlU3dpdGNoKSB7XG4gICAgICB0aGlzLmltbWVkaWF0ZVN3aXRjaCA9IHRydWU7XG4gICAgICB0aGlzLnByZXZpb3VzbHlQYXVzZWQgPSB0aGlzLm1lZGlhLnBhdXNlZDtcbiAgICAgIHRoaXMubWVkaWEucGF1c2UoKTtcbiAgICB9XG4gICAgdmFyIGZyYWdDdXJyZW50ID0gdGhpcy5mcmFnQ3VycmVudDtcbiAgICBpZiAoZnJhZ0N1cnJlbnQgJiYgZnJhZ0N1cnJlbnQubG9hZGVyKSB7XG4gICAgICBmcmFnQ3VycmVudC5sb2FkZXIuYWJvcnQoKTtcbiAgICB9XG4gICAgdGhpcy5mcmFnQ3VycmVudCA9IG51bGw7XG4gICAgLy8gZmx1c2ggZXZlcnl0aGluZ1xuICAgIHRoaXMuZmx1c2hCdWZmZXJDb3VudGVyID0gMDtcbiAgICB0aGlzLmZsdXNoUmFuZ2UucHVzaCh7c3RhcnQ6IDAsIGVuZDogTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZfSk7XG4gICAgLy8gdHJpZ2dlciBhIHNvdXJjZUJ1ZmZlciBmbHVzaFxuICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5CVUZGRVJfRkxVU0hJTkc7XG4gICAgLy8gaW5jcmVhc2UgZnJhZ21lbnQgbG9hZCBJbmRleCB0byBhdm9pZCBmcmFnIGxvb3AgbG9hZGluZyBlcnJvciBhZnRlciBidWZmZXIgZmx1c2hcbiAgICB0aGlzLmZyYWdMb2FkSWR4ICs9IDIgKiB0aGlzLmNvbmZpZy5mcmFnTG9hZGluZ0xvb3BUaHJlc2hvbGQ7XG4gICAgLy8gc3BlZWQgdXAgc3dpdGNoaW5nLCB0cmlnZ2VyIHRpbWVyIGZ1bmN0aW9uXG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICAvKlxuICAgICBvbiBpbW1lZGlhdGUgbGV2ZWwgc3dpdGNoIGVuZCwgYWZ0ZXIgbmV3IGZyYWdtZW50IGhhcyBiZWVuIGJ1ZmZlcmVkIDpcbiAgICAgIC0gbnVkZ2UgdmlkZW8gZGVjb2RlciBieSBzbGlnaHRseSBhZGp1c3RpbmcgdmlkZW8gY3VycmVudFRpbWVcbiAgICAgIC0gcmVzdW1lIHRoZSBwbGF5YmFjayBpZiBuZWVkZWRcbiAgKi9cbiAgaW1tZWRpYXRlTGV2ZWxTd2l0Y2hFbmQoKSB7XG4gICAgdGhpcy5pbW1lZGlhdGVTd2l0Y2ggPSBmYWxzZTtcbiAgICB0aGlzLm1lZGlhLmN1cnJlbnRUaW1lIC09IDAuMDAwMTtcbiAgICBpZiAoIXRoaXMucHJldmlvdXNseVBhdXNlZCkge1xuICAgICAgdGhpcy5tZWRpYS5wbGF5KCk7XG4gICAgfVxuICB9XG5cbiAgbmV4dExldmVsU3dpdGNoKCkge1xuICAgIC8qIHRyeSB0byBzd2l0Y2ggQVNBUCB3aXRob3V0IGJyZWFraW5nIHZpZGVvIHBsYXliYWNrIDpcbiAgICAgICBpbiBvcmRlciB0byBlbnN1cmUgc21vb3RoIGJ1dCBxdWljayBsZXZlbCBzd2l0Y2hpbmcsXG4gICAgICB3ZSBuZWVkIHRvIGZpbmQgdGhlIG5leHQgZmx1c2hhYmxlIGJ1ZmZlciByYW5nZVxuICAgICAgd2Ugc2hvdWxkIHRha2UgaW50byBhY2NvdW50IG5ldyBzZWdtZW50IGZldGNoIHRpbWVcbiAgICAqL1xuICAgIHZhciBmZXRjaGRlbGF5LCBjdXJyZW50UmFuZ2UsIG5leHRSYW5nZTtcbiAgICBjdXJyZW50UmFuZ2UgPSB0aGlzLmdldEJ1ZmZlclJhbmdlKHRoaXMubWVkaWEuY3VycmVudFRpbWUpO1xuICAgIGlmIChjdXJyZW50UmFuZ2UpIHtcbiAgICAvLyBmbHVzaCBidWZmZXIgcHJlY2VkaW5nIGN1cnJlbnQgZnJhZ21lbnQgKGZsdXNoIHVudGlsIGN1cnJlbnQgZnJhZ21lbnQgc3RhcnQgb2Zmc2V0KVxuICAgIC8vIG1pbnVzIDFzIHRvIGF2b2lkIHZpZGVvIGZyZWV6aW5nLCB0aGF0IGNvdWxkIGhhcHBlbiBpZiB3ZSBmbHVzaCBrZXlmcmFtZSBvZiBjdXJyZW50IHZpZGVvIC4uLlxuICAgICAgdGhpcy5mbHVzaFJhbmdlLnB1c2goe3N0YXJ0OiAwLCBlbmQ6IGN1cnJlbnRSYW5nZS5zdGFydCAtIDF9KTtcbiAgICB9XG4gICAgaWYgKCF0aGlzLm1lZGlhLnBhdXNlZCkge1xuICAgICAgLy8gYWRkIGEgc2FmZXR5IGRlbGF5IG9mIDFzXG4gICAgICB2YXIgbmV4dExldmVsSWQgPSB0aGlzLmhscy5uZXh0TG9hZExldmVsLG5leHRMZXZlbCA9IHRoaXMubGV2ZWxzW25leHRMZXZlbElkXSwgZnJhZ0xhc3RLYnBzID0gdGhpcy5mcmFnTGFzdEticHM7XG4gICAgICBpZiAoZnJhZ0xhc3RLYnBzICYmIHRoaXMuZnJhZ0N1cnJlbnQpIHtcbiAgICAgICAgZmV0Y2hkZWxheSA9IHRoaXMuZnJhZ0N1cnJlbnQuZHVyYXRpb24gKiBuZXh0TGV2ZWwuYml0cmF0ZSAvICgxMDAwICogZnJhZ0xhc3RLYnBzKSArIDE7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmZXRjaGRlbGF5ID0gMDtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgZmV0Y2hkZWxheSA9IDA7XG4gICAgfVxuICAgIC8vbG9nZ2VyLmxvZygnZmV0Y2hkZWxheTonK2ZldGNoZGVsYXkpO1xuICAgIC8vIGZpbmQgYnVmZmVyIHJhbmdlIHRoYXQgd2lsbCBiZSByZWFjaGVkIG9uY2UgbmV3IGZyYWdtZW50IHdpbGwgYmUgZmV0Y2hlZFxuICAgIG5leHRSYW5nZSA9IHRoaXMuZ2V0QnVmZmVyUmFuZ2UodGhpcy5tZWRpYS5jdXJyZW50VGltZSArIGZldGNoZGVsYXkpO1xuICAgIGlmIChuZXh0UmFuZ2UpIHtcbiAgICAgIC8vIHdlIGNhbiBmbHVzaCBidWZmZXIgcmFuZ2UgZm9sbG93aW5nIHRoaXMgb25lIHdpdGhvdXQgc3RhbGxpbmcgcGxheWJhY2tcbiAgICAgIG5leHRSYW5nZSA9IHRoaXMuZm9sbG93aW5nQnVmZmVyUmFuZ2UobmV4dFJhbmdlKTtcbiAgICAgIGlmIChuZXh0UmFuZ2UpIHtcbiAgICAgICAgLy8gZmx1c2ggcG9zaXRpb24gaXMgdGhlIHN0YXJ0IHBvc2l0aW9uIG9mIHRoaXMgbmV3IGJ1ZmZlclxuICAgICAgICB0aGlzLmZsdXNoUmFuZ2UucHVzaCh7c3RhcnQ6IG5leHRSYW5nZS5zdGFydCwgZW5kOiBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFl9KTtcbiAgICAgICAgLy8gaWYgd2UgYXJlIGhlcmUsIHdlIGNhbiBhbHNvIGNhbmNlbCBhbnkgbG9hZGluZy9kZW11eGluZyBpbiBwcm9ncmVzcywgYXMgdGhleSBhcmUgdXNlbGVzc1xuICAgICAgICB2YXIgZnJhZ0N1cnJlbnQgPSB0aGlzLmZyYWdDdXJyZW50O1xuICAgICAgICBpZiAoZnJhZ0N1cnJlbnQgJiYgZnJhZ0N1cnJlbnQubG9hZGVyKSB7XG4gICAgICAgICAgZnJhZ0N1cnJlbnQubG9hZGVyLmFib3J0KCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5mcmFnQ3VycmVudCA9IG51bGw7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0aGlzLmZsdXNoUmFuZ2UubGVuZ3RoKSB7XG4gICAgICB0aGlzLmZsdXNoQnVmZmVyQ291bnRlciA9IDA7XG4gICAgICAvLyB0cmlnZ2VyIGEgc291cmNlQnVmZmVyIGZsdXNoXG4gICAgICB0aGlzLnN0YXRlID0gU3RhdGUuQlVGRkVSX0ZMVVNISU5HO1xuICAgICAgLy8gaW5jcmVhc2UgZnJhZ21lbnQgbG9hZCBJbmRleCB0byBhdm9pZCBmcmFnIGxvb3AgbG9hZGluZyBlcnJvciBhZnRlciBidWZmZXIgZmx1c2hcbiAgICAgIHRoaXMuZnJhZ0xvYWRJZHggKz0gMiAqIHRoaXMuY29uZmlnLmZyYWdMb2FkaW5nTG9vcFRocmVzaG9sZDtcbiAgICAgIC8vIHNwZWVkIHVwIHN3aXRjaGluZywgdHJpZ2dlciB0aW1lciBmdW5jdGlvblxuICAgICAgdGhpcy50aWNrKCk7XG4gICAgfVxuICB9XG5cbiAgb25NZWRpYUF0dGFjaGluZyhldmVudCwgZGF0YSkge1xuICAgIHZhciBtZWRpYSA9IHRoaXMubWVkaWEgPSBkYXRhLm1lZGlhO1xuICAgIC8vIHNldHVwIHRoZSBtZWRpYSBzb3VyY2VcbiAgICB2YXIgbXMgPSB0aGlzLm1lZGlhU291cmNlID0gbmV3IE1lZGlhU291cmNlKCk7XG4gICAgLy9NZWRpYSBTb3VyY2UgbGlzdGVuZXJzXG4gICAgdGhpcy5vbm1zbyA9IHRoaXMub25NZWRpYVNvdXJjZU9wZW4uYmluZCh0aGlzKTtcbiAgICB0aGlzLm9ubXNlID0gdGhpcy5vbk1lZGlhU291cmNlRW5kZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9ubXNjID0gdGhpcy5vbk1lZGlhU291cmNlQ2xvc2UuYmluZCh0aGlzKTtcbiAgICBtcy5hZGRFdmVudExpc3RlbmVyKCdzb3VyY2VvcGVuJywgdGhpcy5vbm1zbyk7XG4gICAgbXMuYWRkRXZlbnRMaXN0ZW5lcignc291cmNlZW5kZWQnLCB0aGlzLm9ubXNlKTtcbiAgICBtcy5hZGRFdmVudExpc3RlbmVyKCdzb3VyY2VjbG9zZScsIHRoaXMub25tc2MpO1xuICAgIC8vIGxpbmsgdmlkZW8gYW5kIG1lZGlhIFNvdXJjZVxuICAgIG1lZGlhLnNyYyA9IFVSTC5jcmVhdGVPYmplY3RVUkwobXMpO1xuICB9XG5cbiAgb25NZWRpYURldGFjaGluZygpIHtcbiAgICB2YXIgbWVkaWEgPSB0aGlzLm1lZGlhO1xuICAgIGlmIChtZWRpYSAmJiBtZWRpYS5lbmRlZCkge1xuICAgICAgbG9nZ2VyLmxvZygnTVNFIGRldGFjaGluZyBhbmQgdmlkZW8gZW5kZWQsIHJlc2V0IHN0YXJ0UG9zaXRpb24nKTtcbiAgICAgIHRoaXMuc3RhcnRQb3NpdGlvbiA9IHRoaXMubGFzdEN1cnJlbnRUaW1lID0gMDtcbiAgICB9XG5cbiAgICAvLyByZXNldCBmcmFnbWVudCBsb2FkaW5nIGNvdW50ZXIgb24gTVNFIGRldGFjaGluZyB0byBhdm9pZCByZXBvcnRpbmcgRlJBR19MT09QX0xPQURJTkdfRVJST1IgYWZ0ZXIgZXJyb3IgcmVjb3ZlcnlcbiAgICB2YXIgbGV2ZWxzID0gdGhpcy5sZXZlbHM7XG4gICAgaWYgKGxldmVscykge1xuICAgICAgLy8gcmVzZXQgZnJhZ21lbnQgbG9hZCBjb3VudGVyXG4gICAgICAgIGxldmVscy5mb3JFYWNoKGxldmVsID0+IHtcbiAgICAgICAgICBpZihsZXZlbC5kZXRhaWxzKSB7XG4gICAgICAgICAgICBsZXZlbC5kZXRhaWxzLmZyYWdtZW50cy5mb3JFYWNoKGZyYWdtZW50ID0+IHtcbiAgICAgICAgICAgICAgZnJhZ21lbnQubG9hZENvdW50ZXIgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gICAgdmFyIG1zID0gdGhpcy5tZWRpYVNvdXJjZTtcbiAgICBpZiAobXMpIHtcbiAgICAgIGlmIChtcy5yZWFkeVN0YXRlID09PSAnb3BlbicpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAvLyBlbmRPZlN0cmVhbSBjb3VsZCB0cmlnZ2VyIGV4Y2VwdGlvbiBpZiBhbnkgc291cmNlYnVmZmVyIGlzIGluIHVwZGF0aW5nIHN0YXRlXG4gICAgICAgICAgLy8gd2UgZG9uJ3QgcmVhbGx5IGNhcmUgYWJvdXQgY2hlY2tpbmcgc291cmNlYnVmZmVyIHN0YXRlIGhlcmUsXG4gICAgICAgICAgLy8gYXMgd2UgYXJlIGFueXdheSBkZXRhY2hpbmcgdGhlIE1lZGlhU291cmNlXG4gICAgICAgICAgLy8gbGV0J3MganVzdCBhdm9pZCB0aGlzIGV4Y2VwdGlvbiB0byBwcm9wYWdhdGVcbiAgICAgICAgICBtcy5lbmRPZlN0cmVhbSgpO1xuICAgICAgICB9IGNhdGNoKGVycikge1xuICAgICAgICAgIGxvZ2dlci53YXJuKGBvbk1lZGlhRGV0YWNoaW5nOiR7ZXJyLm1lc3NhZ2V9IHdoaWxlIGNhbGxpbmcgZW5kT2ZTdHJlYW1gKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgbXMucmVtb3ZlRXZlbnRMaXN0ZW5lcignc291cmNlb3BlbicsIHRoaXMub25tc28pO1xuICAgICAgbXMucmVtb3ZlRXZlbnRMaXN0ZW5lcignc291cmNlZW5kZWQnLCB0aGlzLm9ubXNlKTtcbiAgICAgIG1zLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NvdXJjZWNsb3NlJywgdGhpcy5vbm1zYyk7XG4gICAgICAvLyB1bmxpbmsgTWVkaWFTb3VyY2UgZnJvbSB2aWRlbyB0YWdcbiAgICAgIHRoaXMubWVkaWEuc3JjID0gJyc7XG4gICAgICB0aGlzLm1lZGlhU291cmNlID0gbnVsbDtcbiAgICAgIC8vIHJlbW92ZSB2aWRlbyBsaXN0ZW5lcnNcbiAgICAgIGlmIChtZWRpYSkge1xuICAgICAgICBtZWRpYS5yZW1vdmVFdmVudExpc3RlbmVyKCdzZWVraW5nJywgdGhpcy5vbnZzZWVraW5nKTtcbiAgICAgICAgbWVkaWEucmVtb3ZlRXZlbnRMaXN0ZW5lcignc2Vla2VkJywgdGhpcy5vbnZzZWVrZWQpO1xuICAgICAgICBtZWRpYS5yZW1vdmVFdmVudExpc3RlbmVyKCdsb2FkZWRtZXRhZGF0YScsIHRoaXMub252bWV0YWRhdGEpO1xuICAgICAgICBtZWRpYS5yZW1vdmVFdmVudExpc3RlbmVyKCdlbmRlZCcsIHRoaXMub252ZW5kZWQpO1xuICAgICAgICB0aGlzLm9udnNlZWtpbmcgPSB0aGlzLm9udnNlZWtlZCA9IHRoaXMub252bWV0YWRhdGEgPSBudWxsO1xuICAgICAgfVxuICAgICAgdGhpcy5tZWRpYSA9IG51bGw7XG4gICAgICB0aGlzLmxvYWRlZG1ldGFkYXRhID0gZmFsc2U7XG4gICAgICB0aGlzLnN0b3AoKTtcbiAgICB9XG4gICAgdGhpcy5vbm1zbyA9IHRoaXMub25tc2UgPSB0aGlzLm9ubXNjID0gbnVsbDtcbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50Lk1FRElBX0RFVEFDSEVEKTtcbiAgfVxuXG4gIG9uTWVkaWFTZWVraW5nKCkge1xuICAgIGlmICh0aGlzLnN0YXRlID09PSBTdGF0ZS5GUkFHX0xPQURJTkcpIHtcbiAgICAgIC8vIGNoZWNrIGlmIGN1cnJlbnRseSBsb2FkZWQgZnJhZ21lbnQgaXMgaW5zaWRlIGJ1ZmZlci5cbiAgICAgIC8vaWYgb3V0c2lkZSwgY2FuY2VsIGZyYWdtZW50IGxvYWRpbmcsIG90aGVyd2lzZSBkbyBub3RoaW5nXG4gICAgICBpZiAodGhpcy5idWZmZXJJbmZvKHRoaXMubWVkaWEuY3VycmVudFRpbWUsMC4zKS5sZW4gPT09IDApIHtcbiAgICAgICAgbG9nZ2VyLmxvZygnc2Vla2luZyBvdXRzaWRlIG9mIGJ1ZmZlciB3aGlsZSBmcmFnbWVudCBsb2FkIGluIHByb2dyZXNzLCBjYW5jZWwgZnJhZ21lbnQgbG9hZCcpO1xuICAgICAgICB2YXIgZnJhZ0N1cnJlbnQgPSB0aGlzLmZyYWdDdXJyZW50O1xuICAgICAgICBpZiAoZnJhZ0N1cnJlbnQpIHtcbiAgICAgICAgICBpZiAoZnJhZ0N1cnJlbnQubG9hZGVyKSB7XG4gICAgICAgICAgICBmcmFnQ3VycmVudC5sb2FkZXIuYWJvcnQoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5mcmFnQ3VycmVudCA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5mcmFnUHJldmlvdXMgPSBudWxsO1xuICAgICAgICAvLyBzd2l0Y2ggdG8gSURMRSBzdGF0ZSB0byBsb2FkIG5ldyBmcmFnbWVudFxuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHRoaXMubWVkaWEpIHtcbiAgICAgIHRoaXMubGFzdEN1cnJlbnRUaW1lID0gdGhpcy5tZWRpYS5jdXJyZW50VGltZTtcbiAgICB9XG4gICAgLy8gYXZvaWQgcmVwb3J0aW5nIGZyYWdtZW50IGxvb3AgbG9hZGluZyBlcnJvciBpbiBjYXNlIHVzZXIgaXMgc2Vla2luZyBzZXZlcmFsIHRpbWVzIG9uIHNhbWUgcG9zaXRpb25cbiAgICBpZiAodGhpcy5mcmFnTG9hZElkeCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLmZyYWdMb2FkSWR4ICs9IDIgKiB0aGlzLmNvbmZpZy5mcmFnTG9hZGluZ0xvb3BUaHJlc2hvbGQ7XG4gICAgfVxuICAgIC8vIHRpY2sgdG8gc3BlZWQgdXAgcHJvY2Vzc2luZ1xuICAgIHRoaXMudGljaygpO1xuICB9XG5cbiAgb25NZWRpYVNlZWtlZCgpIHtcbiAgICAvLyB0aWNrIHRvIHNwZWVkIHVwIEZSQUdNRU5UX1BMQVlJTkcgdHJpZ2dlcmluZ1xuICAgIHRoaXMudGljaygpO1xuICB9XG5cbiAgb25NZWRpYU1ldGFkYXRhKCkge1xuICAgIHZhciBjdXJyZW50VGltZSA9IHRoaXMubWVkaWEuY3VycmVudFRpbWU7XG4gICAgLy8gb25seSBhZGp1c3QgY3VycmVudFRpbWUgaWYgbm90IGVxdWFsIHRvIDBcbiAgICBpZiAoIWN1cnJlbnRUaW1lICYmIGN1cnJlbnRUaW1lICE9PSB0aGlzLnN0YXJ0UG9zaXRpb24pIHtcbiAgICAgIGxvZ2dlci5sb2coJ29uTWVkaWFNZXRhZGF0YTogYWRqdXN0IGN1cnJlbnRUaW1lIHRvIHN0YXJ0UG9zaXRpb24nKTtcbiAgICAgIHRoaXMubWVkaWEuY3VycmVudFRpbWUgPSB0aGlzLnN0YXJ0UG9zaXRpb247XG4gICAgfVxuICAgIHRoaXMubG9hZGVkbWV0YWRhdGEgPSB0cnVlO1xuICAgIHRoaXMudGljaygpO1xuICB9XG5cbiAgb25NZWRpYUVuZGVkKCkge1xuICAgIGxvZ2dlci5sb2coJ21lZGlhIGVuZGVkJyk7XG4gICAgLy8gcmVzZXQgc3RhcnRQb3NpdGlvbiBhbmQgbGFzdEN1cnJlbnRUaW1lIHRvIHJlc3RhcnQgcGxheWJhY2sgQCBzdHJlYW0gYmVnaW5uaW5nXG4gICAgdGhpcy5zdGFydFBvc2l0aW9uID0gdGhpcy5sYXN0Q3VycmVudFRpbWUgPSAwO1xuICB9XG5cblxuICBvbk1hbmlmZXN0UGFyc2VkKGV2ZW50LCBkYXRhKSB7XG4gICAgdmFyIGFhYyA9IGZhbHNlLCBoZWFhYyA9IGZhbHNlLCBjb2RlY3M7XG4gICAgZGF0YS5sZXZlbHMuZm9yRWFjaChsZXZlbCA9PiB7XG4gICAgICAvLyBkZXRlY3QgaWYgd2UgaGF2ZSBkaWZmZXJlbnQga2luZCBvZiBhdWRpbyBjb2RlY3MgdXNlZCBhbW9uZ3N0IHBsYXlsaXN0c1xuICAgICAgY29kZWNzID0gbGV2ZWwuY29kZWNzO1xuICAgICAgaWYgKGNvZGVjcykge1xuICAgICAgICBpZiAoY29kZWNzLmluZGV4T2YoJ21wNGEuNDAuMicpICE9PSAtMSkge1xuICAgICAgICAgIGFhYyA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvZGVjcy5pbmRleE9mKCdtcDRhLjQwLjUnKSAhPT0gLTEpIHtcbiAgICAgICAgICBoZWFhYyA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgICB0aGlzLmF1ZGlvY29kZWNzd2l0Y2ggPSAoYWFjICYmIGhlYWFjKTtcbiAgICBpZiAodGhpcy5hdWRpb2NvZGVjc3dpdGNoKSB7XG4gICAgICBsb2dnZXIubG9nKCdib3RoIEFBQy9IRS1BQUMgYXVkaW8gZm91bmQgaW4gbGV2ZWxzOyBkZWNsYXJpbmcgYXVkaW8gY29kZWMgYXMgSEUtQUFDJyk7XG4gICAgfVxuICAgIHRoaXMubGV2ZWxzID0gZGF0YS5sZXZlbHM7XG4gICAgdGhpcy5zdGFydExldmVsTG9hZGVkID0gZmFsc2U7XG4gICAgdGhpcy5zdGFydEZyYWdtZW50UmVxdWVzdGVkID0gZmFsc2U7XG4gICAgaWYgKHRoaXMubWVkaWEgJiYgdGhpcy5jb25maWcuYXV0b1N0YXJ0TG9hZCkge1xuICAgICAgdGhpcy5zdGFydExvYWQoKTtcbiAgICB9XG4gIH1cblxuICBvbkxldmVsTG9hZGVkKGV2ZW50LGRhdGEpIHtcbiAgICB2YXIgbmV3RGV0YWlscyA9IGRhdGEuZGV0YWlscyxcbiAgICAgICAgbmV3TGV2ZWxJZCA9IGRhdGEubGV2ZWwsXG4gICAgICAgIGN1ckxldmVsID0gdGhpcy5sZXZlbHNbbmV3TGV2ZWxJZF0sXG4gICAgICAgIGR1cmF0aW9uID0gbmV3RGV0YWlscy50b3RhbGR1cmF0aW9uO1xuXG4gICAgbG9nZ2VyLmxvZyhgbGV2ZWwgJHtuZXdMZXZlbElkfSBsb2FkZWQgWyR7bmV3RGV0YWlscy5zdGFydFNOfSwke25ld0RldGFpbHMuZW5kU059XSxkdXJhdGlvbjoke2R1cmF0aW9ufWApO1xuXG4gICAgaWYgKG5ld0RldGFpbHMubGl2ZSkge1xuICAgICAgdmFyIGN1ckRldGFpbHMgPSBjdXJMZXZlbC5kZXRhaWxzO1xuICAgICAgaWYgKGN1ckRldGFpbHMpIHtcbiAgICAgICAgLy8gd2UgYWxyZWFkeSBoYXZlIGRldGFpbHMgZm9yIHRoYXQgbGV2ZWwsIG1lcmdlIHRoZW1cbiAgICAgICAgTGV2ZWxIZWxwZXIubWVyZ2VEZXRhaWxzKGN1ckRldGFpbHMsbmV3RGV0YWlscyk7XG4gICAgICAgIGlmIChuZXdEZXRhaWxzLlBUU0tub3duKSB7XG4gICAgICAgICAgbG9nZ2VyLmxvZyhgbGl2ZSBwbGF5bGlzdCBzbGlkaW5nOiR7bmV3RGV0YWlscy5mcmFnbWVudHNbMF0uc3RhcnQudG9GaXhlZCgzKX1gKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsb2dnZXIubG9nKCdsaXZlIHBsYXlsaXN0IC0gb3V0ZGF0ZWQgUFRTLCB1bmtub3duIHNsaWRpbmcnKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbmV3RGV0YWlscy5QVFNLbm93biA9IGZhbHNlO1xuICAgICAgICBsb2dnZXIubG9nKCdsaXZlIHBsYXlsaXN0IC0gZmlyc3QgbG9hZCwgdW5rbm93biBzbGlkaW5nJyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIG5ld0RldGFpbHMuUFRTS25vd24gPSBmYWxzZTtcbiAgICB9XG4gICAgLy8gb3ZlcnJpZGUgbGV2ZWwgaW5mb1xuICAgIGN1ckxldmVsLmRldGFpbHMgPSBuZXdEZXRhaWxzO1xuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuTEVWRUxfVVBEQVRFRCwgeyBkZXRhaWxzOiBuZXdEZXRhaWxzLCBsZXZlbDogbmV3TGV2ZWxJZCB9KTtcblxuICAgIC8vIGNvbXB1dGUgc3RhcnQgcG9zaXRpb25cbiAgICBpZiAodGhpcy5zdGFydExldmVsTG9hZGVkID09PSBmYWxzZSkge1xuICAgICAgLy8gaWYgbGl2ZSBwbGF5bGlzdCwgc2V0IHN0YXJ0IHBvc2l0aW9uIHRvIGJlIGZyYWdtZW50IE4tdGhpcy5jb25maWcubGl2ZVN5bmNEdXJhdGlvbkNvdW50ICh1c3VhbGx5IDMpXG4gICAgICBpZiAobmV3RGV0YWlscy5saXZlKSB7XG4gICAgICAgIHRoaXMuc3RhcnRQb3NpdGlvbiA9IE1hdGgubWF4KDAsIGR1cmF0aW9uIC0gdGhpcy5jb25maWcubGl2ZVN5bmNEdXJhdGlvbkNvdW50ICogbmV3RGV0YWlscy50YXJnZXRkdXJhdGlvbik7XG4gICAgICB9XG4gICAgICB0aGlzLm5leHRMb2FkUG9zaXRpb24gPSB0aGlzLnN0YXJ0UG9zaXRpb247XG4gICAgICB0aGlzLnN0YXJ0TGV2ZWxMb2FkZWQgPSB0cnVlO1xuICAgIH1cbiAgICAvLyBvbmx5IHN3aXRjaCBiYXRjayB0byBJRExFIHN0YXRlIGlmIHdlIHdlcmUgd2FpdGluZyBmb3IgbGV2ZWwgdG8gc3RhcnQgZG93bmxvYWRpbmcgYSBuZXcgZnJhZ21lbnRcbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gU3RhdGUuV0FJVElOR19MRVZFTCkge1xuICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gICAgfVxuICAgIC8vdHJpZ2dlciBoYW5kbGVyIHJpZ2h0IG5vd1xuICAgIHRoaXMudGljaygpO1xuICB9XG5cbiAgb25LZXlMb2FkZWQoKSB7XG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IFN0YXRlLktFWV9MT0FESU5HKSB7XG4gICAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICAgIHRoaXMudGljaygpO1xuICAgIH1cbiAgfVxuXG4gIG9uRnJhZ0xvYWRlZChldmVudCwgZGF0YSkge1xuICAgIHZhciBmcmFnQ3VycmVudCA9IHRoaXMuZnJhZ0N1cnJlbnQ7XG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IFN0YXRlLkZSQUdfTE9BRElORyAmJlxuICAgICAgICBmcmFnQ3VycmVudCAmJlxuICAgICAgICBkYXRhLmZyYWcubGV2ZWwgPT09IGZyYWdDdXJyZW50LmxldmVsICYmXG4gICAgICAgIGRhdGEuZnJhZy5zbiA9PT0gZnJhZ0N1cnJlbnQuc24pIHtcbiAgICAgIGlmICh0aGlzLmZyYWdCaXRyYXRlVGVzdCA9PT0gdHJ1ZSkge1xuICAgICAgICAvLyBzd2l0Y2ggYmFjayB0byBJRExFIHN0YXRlIC4uLiB3ZSBqdXN0IGxvYWRlZCBhIGZyYWdtZW50IHRvIGRldGVybWluZSBhZGVxdWF0ZSBzdGFydCBiaXRyYXRlIGFuZCBpbml0aWFsaXplIGF1dG9zd2l0Y2ggYWxnb1xuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICAgICAgdGhpcy5mcmFnQml0cmF0ZVRlc3QgPSBmYWxzZTtcbiAgICAgICAgZGF0YS5zdGF0cy50cGFyc2VkID0gZGF0YS5zdGF0cy50YnVmZmVyZWQgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5GUkFHX0JVRkZFUkVELCB7c3RhdHM6IGRhdGEuc3RhdHMsIGZyYWc6IGZyYWdDdXJyZW50fSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuUEFSU0lORztcbiAgICAgICAgLy8gdHJhbnNtdXggdGhlIE1QRUctVFMgZGF0YSB0byBJU08tQk1GRiBzZWdtZW50c1xuICAgICAgICB0aGlzLnN0YXRzID0gZGF0YS5zdGF0cztcbiAgICAgICAgdmFyIGN1cnJlbnRMZXZlbCA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdLFxuICAgICAgICAgICAgZGV0YWlscyA9IGN1cnJlbnRMZXZlbC5kZXRhaWxzLFxuICAgICAgICAgICAgZHVyYXRpb24gPSBkZXRhaWxzLnRvdGFsZHVyYXRpb24sXG4gICAgICAgICAgICBzdGFydCA9IGZyYWdDdXJyZW50LnN0YXJ0LFxuICAgICAgICAgICAgbGV2ZWwgPSBmcmFnQ3VycmVudC5sZXZlbCxcbiAgICAgICAgICAgIHNuID0gZnJhZ0N1cnJlbnQuc24sXG4gICAgICAgICAgICBhdWRpb0NvZGVjID0gY3VycmVudExldmVsLmF1ZGlvQ29kZWM7XG4gICAgICAgIGlmKGF1ZGlvQ29kZWMgJiYgdGhpcy5hdWRpb0NvZGVjU3dhcCkge1xuICAgICAgICAgIGxvZ2dlci5sb2coJ3N3YXBwaW5nIHBsYXlsaXN0IGF1ZGlvIGNvZGVjJyk7XG4gICAgICAgICAgaWYoYXVkaW9Db2RlYy5pbmRleE9mKCdtcDRhLjQwLjUnKSAhPT0tMSkge1xuICAgICAgICAgICAgYXVkaW9Db2RlYyA9ICdtcDRhLjQwLjInO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhdWRpb0NvZGVjID0gJ21wNGEuNDAuNSc7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGxvZ2dlci5sb2coYERlbXV4aW5nICR7c259IG9mIFske2RldGFpbHMuc3RhcnRTTn0gLCR7ZGV0YWlscy5lbmRTTn1dLGxldmVsICR7bGV2ZWx9YCk7XG4gICAgICAgIHRoaXMuZGVtdXhlci5wdXNoKGRhdGEucGF5bG9hZCwgYXVkaW9Db2RlYywgY3VycmVudExldmVsLnZpZGVvQ29kZWMsIHN0YXJ0LCBmcmFnQ3VycmVudC5jYywgbGV2ZWwsIHNuLCBkdXJhdGlvbiwgZnJhZ0N1cnJlbnQuZGVjcnlwdGRhdGEpO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmZyYWdMb2FkRXJyb3IgPSAwO1xuICB9XG5cbiAgb25Jbml0U2VnbWVudChldmVudCwgZGF0YSkge1xuICAgIGlmICh0aGlzLnN0YXRlID09PSBTdGF0ZS5QQVJTSU5HKSB7XG4gICAgICAvLyBjaGVjayBpZiBjb2RlY3MgaGF2ZSBiZWVuIGV4cGxpY2l0ZWx5IGRlZmluZWQgaW4gdGhlIG1hc3RlciBwbGF5bGlzdCBmb3IgdGhpcyBsZXZlbDtcbiAgICAgIC8vIGlmIHllcyB1c2UgdGhlc2Ugb25lcyBpbnN0ZWFkIG9mIHRoZSBvbmVzIHBhcnNlZCBmcm9tIHRoZSBkZW11eFxuICAgICAgdmFyIGF1ZGlvQ29kZWMgPSB0aGlzLmxldmVsc1t0aGlzLmxldmVsXS5hdWRpb0NvZGVjLCB2aWRlb0NvZGVjID0gdGhpcy5sZXZlbHNbdGhpcy5sZXZlbF0udmlkZW9Db2RlYywgc2I7XG4gICAgICBpZihhdWRpb0NvZGVjICYmIHRoaXMuYXVkaW9Db2RlY1N3YXApIHtcbiAgICAgICAgbG9nZ2VyLmxvZygnc3dhcHBpbmcgcGxheWxpc3QgYXVkaW8gY29kZWMnKTtcbiAgICAgICAgaWYoYXVkaW9Db2RlYy5pbmRleE9mKCdtcDRhLjQwLjUnKSAhPT0tMSkge1xuICAgICAgICAgIGF1ZGlvQ29kZWMgPSAnbXA0YS40MC4yJztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBhdWRpb0NvZGVjID0gJ21wNGEuNDAuNSc7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGxvZ2dlci5sb2coYHBsYXlsaXN0X2xldmVsL2luaXRfc2VnbWVudCBjb2RlY3M6IHZpZGVvID0+ICR7dmlkZW9Db2RlY30vJHtkYXRhLnZpZGVvQ29kZWN9OyBhdWRpbyA9PiAke2F1ZGlvQ29kZWN9LyR7ZGF0YS5hdWRpb0NvZGVjfWApO1xuICAgICAgLy8gaWYgcGxheWxpc3QgZG9lcyBub3Qgc3BlY2lmeSBjb2RlY3MsIHVzZSBjb2RlY3MgZm91bmQgd2hpbGUgcGFyc2luZyBmcmFnbWVudFxuICAgICAgLy8gaWYgbm8gY29kZWMgZm91bmQgd2hpbGUgcGFyc2luZyBmcmFnbWVudCwgYWxzbyBzZXQgY29kZWMgdG8gdW5kZWZpbmVkIHRvIGF2b2lkIGNyZWF0aW5nIHNvdXJjZUJ1ZmZlclxuICAgICAgaWYgKGF1ZGlvQ29kZWMgPT09IHVuZGVmaW5lZCB8fCBkYXRhLmF1ZGlvQ29kZWMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBhdWRpb0NvZGVjID0gZGF0YS5hdWRpb0NvZGVjO1xuICAgICAgfVxuXG4gICAgICBpZiAodmlkZW9Db2RlYyA9PT0gdW5kZWZpbmVkICB8fCBkYXRhLnZpZGVvQ29kZWMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICB2aWRlb0NvZGVjID0gZGF0YS52aWRlb0NvZGVjO1xuICAgICAgfVxuICAgICAgLy8gaW4gY2FzZSBzZXZlcmFsIGF1ZGlvIGNvZGVjcyBtaWdodCBiZSB1c2VkLCBmb3JjZSBIRS1BQUMgZm9yIGF1ZGlvIChzb21lIGJyb3dzZXJzIGRvbid0IHN1cHBvcnQgYXVkaW8gY29kZWMgc3dpdGNoKVxuICAgICAgLy9kb24ndCBkbyBpdCBmb3IgbW9ubyBzdHJlYW1zIC4uLlxuICAgICAgdmFyIHVhID0gbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpO1xuICAgICAgaWYgKHRoaXMuYXVkaW9jb2RlY3N3aXRjaCAmJlxuICAgICAgICAgZGF0YS5hdWRpb0NoYW5uZWxDb3VudCAhPT0gMSAmJlxuICAgICAgICAgIHVhLmluZGV4T2YoJ2FuZHJvaWQnKSA9PT0gLTEgJiZcbiAgICAgICAgICB1YS5pbmRleE9mKCdmaXJlZm94JykgPT09IC0xKSB7XG4gICAgICAgIGF1ZGlvQ29kZWMgPSAnbXA0YS40MC41JztcbiAgICAgIH1cbiAgICAgIGlmICghdGhpcy5zb3VyY2VCdWZmZXIpIHtcbiAgICAgICAgdGhpcy5zb3VyY2VCdWZmZXIgPSB7fTtcbiAgICAgICAgbG9nZ2VyLmxvZyhgc2VsZWN0ZWQgQS9WIGNvZGVjcyBmb3Igc291cmNlQnVmZmVyczoke2F1ZGlvQ29kZWN9LCR7dmlkZW9Db2RlY31gKTtcbiAgICAgICAgLy8gY3JlYXRlIHNvdXJjZSBCdWZmZXIgYW5kIGxpbmsgdGhlbSB0byBNZWRpYVNvdXJjZVxuICAgICAgICBpZiAoYXVkaW9Db2RlYykge1xuICAgICAgICAgIHNiID0gdGhpcy5zb3VyY2VCdWZmZXIuYXVkaW8gPSB0aGlzLm1lZGlhU291cmNlLmFkZFNvdXJjZUJ1ZmZlcihgdmlkZW8vbXA0O2NvZGVjcz0ke2F1ZGlvQ29kZWN9YCk7XG4gICAgICAgICAgc2IuYWRkRXZlbnRMaXN0ZW5lcigndXBkYXRlZW5kJywgdGhpcy5vbnNidWUpO1xuICAgICAgICAgIHNiLmFkZEV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgdGhpcy5vbnNiZSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHZpZGVvQ29kZWMpIHtcbiAgICAgICAgICBzYiA9IHRoaXMuc291cmNlQnVmZmVyLnZpZGVvID0gdGhpcy5tZWRpYVNvdXJjZS5hZGRTb3VyY2VCdWZmZXIoYHZpZGVvL21wNDtjb2RlY3M9JHt2aWRlb0NvZGVjfWApO1xuICAgICAgICAgIHNiLmFkZEV2ZW50TGlzdGVuZXIoJ3VwZGF0ZWVuZCcsIHRoaXMub25zYnVlKTtcbiAgICAgICAgICBzYi5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsIHRoaXMub25zYmUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoYXVkaW9Db2RlYykge1xuICAgICAgICB0aGlzLm1wNHNlZ21lbnRzLnB1c2goe3R5cGU6ICdhdWRpbycsIGRhdGE6IGRhdGEuYXVkaW9Nb292fSk7XG4gICAgICB9XG4gICAgICBpZih2aWRlb0NvZGVjKSB7XG4gICAgICAgIHRoaXMubXA0c2VnbWVudHMucHVzaCh7dHlwZTogJ3ZpZGVvJywgZGF0YTogZGF0YS52aWRlb01vb3Z9KTtcbiAgICAgIH1cbiAgICAgIC8vdHJpZ2dlciBoYW5kbGVyIHJpZ2h0IG5vd1xuICAgICAgdGhpcy50aWNrKCk7XG4gICAgfVxuICB9XG5cbiAgb25GcmFnUGFyc2luZyhldmVudCwgZGF0YSkge1xuICAgIGlmICh0aGlzLnN0YXRlID09PSBTdGF0ZS5QQVJTSU5HKSB7XG4gICAgICB0aGlzLnRwYXJzZTIgPSBEYXRlLm5vdygpO1xuICAgICAgdmFyIGxldmVsID0gdGhpcy5sZXZlbHNbdGhpcy5sZXZlbF0sXG4gICAgICAgICAgZnJhZyA9IHRoaXMuZnJhZ0N1cnJlbnQ7XG4gICAgICBsb2dnZXIubG9nKGBwYXJzZWQgZGF0YSwgdHlwZS9zdGFydFBUUy9lbmRQVFMvc3RhcnREVFMvZW5kRFRTL25iOiR7ZGF0YS50eXBlfS8ke2RhdGEuc3RhcnRQVFMudG9GaXhlZCgzKX0vJHtkYXRhLmVuZFBUUy50b0ZpeGVkKDMpfS8ke2RhdGEuc3RhcnREVFMudG9GaXhlZCgzKX0vJHtkYXRhLmVuZERUUy50b0ZpeGVkKDMpfS8ke2RhdGEubmJ9YCk7XG4gICAgICB2YXIgZHJpZnQgPSBMZXZlbEhlbHBlci51cGRhdGVGcmFnUFRTKGxldmVsLmRldGFpbHMsZnJhZy5zbixkYXRhLnN0YXJ0UFRTLGRhdGEuZW5kUFRTKTtcbiAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuTEVWRUxfUFRTX1VQREFURUQsIHtkZXRhaWxzOiBsZXZlbC5kZXRhaWxzLCBsZXZlbDogdGhpcy5sZXZlbCwgZHJpZnQ6IGRyaWZ0fSk7XG5cbiAgICAgIHRoaXMubXA0c2VnbWVudHMucHVzaCh7dHlwZTogZGF0YS50eXBlLCBkYXRhOiBkYXRhLm1vb2Z9KTtcbiAgICAgIHRoaXMubXA0c2VnbWVudHMucHVzaCh7dHlwZTogZGF0YS50eXBlLCBkYXRhOiBkYXRhLm1kYXR9KTtcbiAgICAgIHRoaXMubmV4dExvYWRQb3NpdGlvbiA9IGRhdGEuZW5kUFRTO1xuICAgICAgdGhpcy5idWZmZXJSYW5nZS5wdXNoKHt0eXBlOiBkYXRhLnR5cGUsIHN0YXJ0OiBkYXRhLnN0YXJ0UFRTLCBlbmQ6IGRhdGEuZW5kUFRTLCBmcmFnOiBmcmFnfSk7XG5cbiAgICAgIC8vdHJpZ2dlciBoYW5kbGVyIHJpZ2h0IG5vd1xuICAgICAgdGhpcy50aWNrKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvZ2dlci53YXJuKGBub3QgaW4gUEFSU0lORyBzdGF0ZSwgZGlzY2FyZGluZyAke2V2ZW50fWApO1xuICAgIH1cbiAgfVxuXG4gIG9uRnJhZ1BhcnNlZCgpIHtcbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gU3RhdGUuUEFSU0lORykge1xuICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLlBBUlNFRDtcbiAgICAgIHRoaXMuc3RhdHMudHBhcnNlZCA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgLy90cmlnZ2VyIGhhbmRsZXIgcmlnaHQgbm93XG4gICAgICB0aGlzLnRpY2soKTtcbiAgICB9XG4gIH1cblxuICBvbkVycm9yKGV2ZW50LCBkYXRhKSB7XG4gICAgc3dpdGNoKGRhdGEuZGV0YWlscykge1xuICAgICAgY2FzZSBFcnJvckRldGFpbHMuRlJBR19MT0FEX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuRlJBR19MT0FEX1RJTUVPVVQ6XG4gICAgICAgIGlmKCFkYXRhLmZhdGFsKSB7XG4gICAgICAgICAgdmFyIGxvYWRFcnJvciA9IHRoaXMuZnJhZ0xvYWRFcnJvcjtcbiAgICAgICAgICBpZihsb2FkRXJyb3IpIHtcbiAgICAgICAgICAgIGxvYWRFcnJvcisrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsb2FkRXJyb3I9MTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGxvYWRFcnJvciA8PSB0aGlzLmNvbmZpZy5mcmFnTG9hZGluZ01heFJldHJ5KSB7XG4gICAgICAgICAgICB0aGlzLmZyYWdMb2FkRXJyb3IgPSBsb2FkRXJyb3I7XG4gICAgICAgICAgICAvLyByZXNldCBsb2FkIGNvdW50ZXIgdG8gYXZvaWQgZnJhZyBsb29wIGxvYWRpbmcgZXJyb3JcbiAgICAgICAgICAgIGRhdGEuZnJhZy5sb2FkQ291bnRlciA9IDA7XG4gICAgICAgICAgICAvLyBleHBvbmVudGlhbCBiYWNrb2ZmIGNhcHBlZCB0byA2NHNcbiAgICAgICAgICAgIHZhciBkZWxheSA9IE1hdGgubWluKE1hdGgucG93KDIsbG9hZEVycm9yLTEpKnRoaXMuY29uZmlnLmZyYWdMb2FkaW5nUmV0cnlEZWxheSw2NDAwMCk7XG4gICAgICAgICAgICBsb2dnZXIud2FybihgbWVkaWFDb250cm9sbGVyOiBmcmFnIGxvYWRpbmcgZmFpbGVkLCByZXRyeSBpbiAke2RlbGF5fSBtc2ApO1xuICAgICAgICAgICAgdGhpcy5yZXRyeURhdGUgPSBwZXJmb3JtYW5jZS5ub3coKSArIGRlbGF5O1xuICAgICAgICAgICAgLy8gcmV0cnkgbG9hZGluZyBzdGF0ZVxuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLkZSQUdfTE9BRElOR19XQUlUSU5HX1JFVFJZO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsb2dnZXIuZXJyb3IoYG1lZGlhQ29udHJvbGxlcjogJHtkYXRhLmRldGFpbHN9IHJlYWNoZXMgbWF4IHJldHJ5LCByZWRpc3BhdGNoIGFzIGZhdGFsIC4uLmApO1xuICAgICAgICAgICAgLy8gcmVkaXNwYXRjaCBzYW1lIGVycm9yIGJ1dCB3aXRoIGZhdGFsIHNldCB0byB0cnVlXG4gICAgICAgICAgICBkYXRhLmZhdGFsID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoZXZlbnQsIGRhdGEpO1xuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLkVSUk9SO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkZSQUdfTE9PUF9MT0FESU5HX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuTEVWRUxfTE9BRF9FUlJPUjpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkxFVkVMX0xPQURfVElNRU9VVDpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLktFWV9MT0FEX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuS0VZX0xPQURfVElNRU9VVDpcbiAgICAgICAgLy8gaWYgZmF0YWwgZXJyb3IsIHN0b3AgcHJvY2Vzc2luZywgb3RoZXJ3aXNlIG1vdmUgdG8gSURMRSB0byByZXRyeSBsb2FkaW5nXG4gICAgICAgIGxvZ2dlci53YXJuKGBtZWRpYUNvbnRyb2xsZXI6ICR7ZGF0YS5kZXRhaWxzfSB3aGlsZSBsb2FkaW5nIGZyYWcsc3dpdGNoIHRvICR7ZGF0YS5mYXRhbCA/ICdFUlJPUicgOiAnSURMRSd9IHN0YXRlIC4uLmApO1xuICAgICAgICB0aGlzLnN0YXRlID0gZGF0YS5mYXRhbCA/IFN0YXRlLkVSUk9SIDogU3RhdGUuSURMRTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICBvblNCVXBkYXRlRW5kKCkge1xuICAgIC8vdHJpZ2dlciBoYW5kbGVyIHJpZ2h0IG5vd1xuICAgIGlmICh0aGlzLnN0YXRlID09PSBTdGF0ZS5BUFBFTkRJTkcgJiYgdGhpcy5tcDRzZWdtZW50cy5sZW5ndGggPT09IDApICB7XG4gICAgICB2YXIgZnJhZyA9IHRoaXMuZnJhZ0N1cnJlbnQsIHN0YXRzID0gdGhpcy5zdGF0cztcbiAgICAgIGlmIChmcmFnKSB7XG4gICAgICAgIHRoaXMuZnJhZ1ByZXZpb3VzID0gZnJhZztcbiAgICAgICAgc3RhdHMudGJ1ZmZlcmVkID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICAgIHRoaXMuZnJhZ0xhc3RLYnBzID0gTWF0aC5yb3VuZCg4ICogc3RhdHMubGVuZ3RoIC8gKHN0YXRzLnRidWZmZXJlZCAtIHN0YXRzLnRmaXJzdCkpO1xuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkZSQUdfQlVGRkVSRUQsIHtzdGF0czogc3RhdHMsIGZyYWc6IGZyYWd9KTtcbiAgICAgICAgbG9nZ2VyLmxvZyhgbWVkaWEgYnVmZmVyZWQgOiAke3RoaXMudGltZVJhbmdlc1RvU3RyaW5nKHRoaXMubWVkaWEuYnVmZmVyZWQpfWApO1xuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuX2NoZWNrQnVmZmVyKCkge1xuICAgIHZhciBtZWRpYSA9IHRoaXMubWVkaWE7XG4gICAgaWYobWVkaWEpIHtcbiAgICAgIC8vIGNvbXBhcmUgcmVhZHlTdGF0ZVxuICAgICAgdmFyIHJlYWR5U3RhdGUgPSBtZWRpYS5yZWFkeVN0YXRlO1xuICAgICAgLy8gaWYgcmVhZHkgc3RhdGUgZGlmZmVyZW50IGZyb20gSEFWRV9OT1RISU5HIChudW1lcmljIHZhbHVlIDApLCB3ZSBhcmUgYWxsb3dlZCB0byBzZWVrXG4gICAgICBpZihyZWFkeVN0YXRlKSB7XG4gICAgICAgIC8vIGlmIHNlZWsgYWZ0ZXIgYnVmZmVyZWQgZGVmaW5lZCwgbGV0J3Mgc2VlayBpZiB3aXRoaW4gYWNjZXB0YWJsZSByYW5nZVxuICAgICAgICB2YXIgc2Vla0FmdGVyQnVmZmVyZWQgPSB0aGlzLnNlZWtBZnRlckJ1ZmZlcmVkO1xuICAgICAgICBpZihzZWVrQWZ0ZXJCdWZmZXJlZCkge1xuICAgICAgICAgIGlmKG1lZGlhLmR1cmF0aW9uID49IHNlZWtBZnRlckJ1ZmZlcmVkKSB7XG4gICAgICAgICAgICBtZWRpYS5jdXJyZW50VGltZSA9IHNlZWtBZnRlckJ1ZmZlcmVkO1xuICAgICAgICAgICAgdGhpcy5zZWVrQWZ0ZXJCdWZmZXJlZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFyIGN1cnJlbnRUaW1lID0gbWVkaWEuY3VycmVudFRpbWUsXG4gICAgICAgICAgICAgIGJ1ZmZlckluZm8gPSB0aGlzLmJ1ZmZlckluZm8oY3VycmVudFRpbWUsMCksXG4gICAgICAgICAgICAgIGlzUGxheWluZyA9ICEobWVkaWEucGF1c2VkIHx8IG1lZGlhLmVuZGVkIHx8IG1lZGlhLnNlZWtpbmcgfHwgcmVhZHlTdGF0ZSA8IDMpLFxuICAgICAgICAgICAgICBqdW1wVGhyZXNob2xkID0gMC4yO1xuXG4gICAgICAgICAgLy8gY2hlY2sgYnVmZmVyIHVwZnJvbnRcbiAgICAgICAgICAvLyBpZiBsZXNzIHRoYW4gMjAwbXMgaXMgYnVmZmVyZWQsIGFuZCBtZWRpYSBpcyBwbGF5aW5nIGJ1dCBwbGF5aGVhZCBpcyBub3QgbW92aW5nLFxuICAgICAgICAgIC8vIGFuZCB3ZSBoYXZlIGEgbmV3IGJ1ZmZlciByYW5nZSBhdmFpbGFibGUgdXBmcm9udCwgbGV0J3Mgc2VlayB0byB0aGF0IG9uZVxuICAgICAgICAgIGlmKGJ1ZmZlckluZm8ubGVuIDw9IGp1bXBUaHJlc2hvbGQpIHtcbiAgICAgICAgICAgIGlmKGN1cnJlbnRUaW1lID4gbWVkaWEucGxheWJhY2tSYXRlKnRoaXMubGFzdEN1cnJlbnRUaW1lIHx8ICFpc1BsYXlpbmcpIHtcbiAgICAgICAgICAgICAgLy8gcGxheWhlYWQgbW92aW5nIG9yIG1lZGlhIG5vdCBwbGF5aW5nXG4gICAgICAgICAgICAgIGp1bXBUaHJlc2hvbGQgPSAwO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLnRyYWNlKCdwbGF5YmFjayBzZWVtcyBzdHVjaycpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gaWYgd2UgYXJlIGJlbG93IHRocmVzaG9sZCwgdHJ5IHRvIGp1bXAgaWYgbmV4dCBidWZmZXIgcmFuZ2UgaXMgY2xvc2VcbiAgICAgICAgICAgIGlmKGJ1ZmZlckluZm8ubGVuIDw9IGp1bXBUaHJlc2hvbGQpIHtcbiAgICAgICAgICAgICAgLy8gbm8gYnVmZmVyIGF2YWlsYWJsZSBAIGN1cnJlbnRUaW1lLCBjaGVjayBpZiBuZXh0IGJ1ZmZlciBpcyBjbG9zZSAoaW4gYSAzMDAgbXMgcmFuZ2UpXG4gICAgICAgICAgICAgIHZhciBuZXh0QnVmZmVyU3RhcnQgPSBidWZmZXJJbmZvLm5leHRTdGFydDtcbiAgICAgICAgICAgICAgaWYobmV4dEJ1ZmZlclN0YXJ0ICYmIChuZXh0QnVmZmVyU3RhcnQgLSBjdXJyZW50VGltZSA8IDAuMykpIHtcbiAgICAgICAgICAgICAgICAvLyBuZXh0IGJ1ZmZlciBpcyBjbG9zZSAhIGFkanVzdCBjdXJyZW50VGltZSB0byBuZXh0QnVmZmVyU3RhcnRcbiAgICAgICAgICAgICAgICAvLyB0aGlzIHdpbGwgZW5zdXJlIGVmZmVjdGl2ZSB2aWRlbyBkZWNvZGluZ1xuICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYGFkanVzdCBjdXJyZW50VGltZSBmcm9tICR7Y3VycmVudFRpbWV9IHRvICR7bmV4dEJ1ZmZlclN0YXJ0fWApO1xuICAgICAgICAgICAgICAgIG1lZGlhLmN1cnJlbnRUaW1lID0gbmV4dEJ1ZmZlclN0YXJ0O1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgc3dhcEF1ZGlvQ29kZWMoKSB7XG4gICAgdGhpcy5hdWRpb0NvZGVjU3dhcCA9ICF0aGlzLmF1ZGlvQ29kZWNTd2FwO1xuICB9XG5cbiAgb25TQlVwZGF0ZUVycm9yKGV2ZW50KSB7XG4gICAgbG9nZ2VyLmVycm9yKGBzb3VyY2VCdWZmZXIgZXJyb3I6JHtldmVudH1gKTtcbiAgICB0aGlzLnN0YXRlID0gU3RhdGUuRVJST1I7XG4gICAgLy8gYWNjb3JkaW5nIHRvIGh0dHA6Ly93d3cudzMub3JnL1RSL21lZGlhLXNvdXJjZS8jc291cmNlYnVmZmVyLWFwcGVuZC1lcnJvclxuICAgIC8vIHRoaXMgZXJyb3IgbWlnaHQgbm90IGFsd2F5cyBiZSBmYXRhbCAoaXQgaXMgZmF0YWwgaWYgZGVjb2RlIGVycm9yIGlzIHNldCwgaW4gdGhhdCBjYXNlXG4gICAgLy8gaXQgd2lsbCBiZSBmb2xsb3dlZCBieSBhIG1lZGlhRWxlbWVudCBlcnJvciAuLi4pXG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5CVUZGRVJfQVBQRU5ESU5HX0VSUk9SLCBmYXRhbDogZmFsc2UsIGZyYWc6IHRoaXMuZnJhZ0N1cnJlbnR9KTtcbiAgfVxuXG4gIHRpbWVSYW5nZXNUb1N0cmluZyhyKSB7XG4gICAgdmFyIGxvZyA9ICcnLCBsZW4gPSByLmxlbmd0aDtcbiAgICBmb3IgKHZhciBpPTA7IGk8bGVuOyBpKyspIHtcbiAgICAgIGxvZyArPSAnWycgKyByLnN0YXJ0KGkpICsgJywnICsgci5lbmQoaSkgKyAnXSc7XG4gICAgfVxuICAgIHJldHVybiBsb2c7XG4gIH1cblxuICBvbk1lZGlhU291cmNlT3BlbigpIHtcbiAgICBsb2dnZXIubG9nKCdtZWRpYSBzb3VyY2Ugb3BlbmVkJyk7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5NRURJQV9BVFRBQ0hFRCk7XG4gICAgdGhpcy5vbnZzZWVraW5nID0gdGhpcy5vbk1lZGlhU2Vla2luZy5iaW5kKHRoaXMpO1xuICAgIHRoaXMub252c2Vla2VkID0gdGhpcy5vbk1lZGlhU2Vla2VkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbnZtZXRhZGF0YSA9IHRoaXMub25NZWRpYU1ldGFkYXRhLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbnZlbmRlZCA9IHRoaXMub25NZWRpYUVuZGVkLmJpbmQodGhpcyk7XG4gICAgdmFyIG1lZGlhID0gdGhpcy5tZWRpYTtcbiAgICBtZWRpYS5hZGRFdmVudExpc3RlbmVyKCdzZWVraW5nJywgdGhpcy5vbnZzZWVraW5nKTtcbiAgICBtZWRpYS5hZGRFdmVudExpc3RlbmVyKCdzZWVrZWQnLCB0aGlzLm9udnNlZWtlZCk7XG4gICAgbWVkaWEuYWRkRXZlbnRMaXN0ZW5lcignbG9hZGVkbWV0YWRhdGEnLCB0aGlzLm9udm1ldGFkYXRhKTtcbiAgICBtZWRpYS5hZGRFdmVudExpc3RlbmVyKCdlbmRlZCcsIHRoaXMub252ZW5kZWQpO1xuICAgIGlmKHRoaXMubGV2ZWxzICYmIHRoaXMuY29uZmlnLmF1dG9TdGFydExvYWQpIHtcbiAgICAgIHRoaXMuc3RhcnRMb2FkKCk7XG4gICAgfVxuICAgIC8vIG9uY2UgcmVjZWl2ZWQsIGRvbid0IGxpc3RlbiBhbnltb3JlIHRvIHNvdXJjZW9wZW4gZXZlbnRcbiAgICB0aGlzLm1lZGlhU291cmNlLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NvdXJjZW9wZW4nLCB0aGlzLm9ubXNvKTtcbiAgfVxuXG4gIG9uTWVkaWFTb3VyY2VDbG9zZSgpIHtcbiAgICBsb2dnZXIubG9nKCdtZWRpYSBzb3VyY2UgY2xvc2VkJyk7XG4gIH1cblxuICBvbk1lZGlhU291cmNlRW5kZWQoKSB7XG4gICAgbG9nZ2VyLmxvZygnbWVkaWEgc291cmNlIGVuZGVkJyk7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IE1TRU1lZGlhQ29udHJvbGxlcjtcblxuIiwiLypcbiAqIFRpbWVsaW5lIENvbnRyb2xsZXJcbiovXG5cbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQgQ0VBNzA4SW50ZXJwcmV0ZXIgZnJvbSAnLi4vdXRpbHMvY2VhLTcwOC1pbnRlcnByZXRlcic7XG5cbmNsYXNzIFRpbWVsaW5lQ29udHJvbGxlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgdGhpcy5obHMgPSBobHM7XG4gICAgdGhpcy5jb25maWcgPSBobHMuY29uZmlnO1xuXG4gICAgaWYgKHRoaXMuY29uZmlnLmVuYWJsZUNFQTcwOENhcHRpb25zKVxuICAgIHtcbiAgICAgIHRoaXMub25tZWRpYWF0dDAgPSB0aGlzLm9uTWVkaWFBdHRhY2hpbmcuYmluZCh0aGlzKTtcbiAgICAgIHRoaXMub25tZWRpYWRldDAgPSB0aGlzLm9uTWVkaWFEZXRhY2hpbmcuYmluZCh0aGlzKTtcbiAgICAgIHRoaXMub251ZCA9IHRoaXMub25GcmFnUGFyc2luZ1VzZXJEYXRhLmJpbmQodGhpcyk7XG4gICAgICB0aGlzLm9ubWwgPSB0aGlzLm9uTWFuaWZlc3RMb2FkaW5nLmJpbmQodGhpcyk7XG4gICAgICB0aGlzLm9ubHMgPSB0aGlzLm9uTGV2ZWxTd2l0Y2guYmluZCh0aGlzKTtcbiAgICAgIGhscy5vbihFdmVudC5NRURJQV9BVFRBQ0hJTkcsIHRoaXMub25tZWRpYWF0dDApO1xuICAgICAgaGxzLm9uKEV2ZW50Lk1FRElBX0RFVEFDSElORywgdGhpcy5vbm1lZGlhZGV0MCk7XG4gICAgICBobHMub24oSGxzLkV2ZW50cy5GUkFHX1BBUlNJTkdfVVNFUkRBVEEsIHRoaXMub251ZCk7XG4gICAgICBobHMub24oRXZlbnQuTUFOSUZFU1RfTE9BRElORywgdGhpcy5vbm1sKTtcbiAgICAgIGhscy5vbihFdmVudC5MRVZFTF9TV0lUQ0gsIHRoaXMub25scyk7XG4gICAgfVxuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgfVxuXG4gIG9uTWVkaWFBdHRhY2hpbmcoZXZlbnQsIGRhdGEpIHtcbiAgICB2YXIgbWVkaWEgPSB0aGlzLm1lZGlhID0gZGF0YS5tZWRpYTtcbiAgICB0aGlzLmNlYTcwOEludGVycHJldGVyID0gbmV3IENFQTcwOEludGVycHJldGVyKHRoaXMubWVkaWEpO1xuICB9XG5cbiAgb25NZWRpYURldGFjaGluZygpIHtcbiAgfVxuXG4gIG9uTWFuaWZlc3RMb2FkaW5nKClcbiAge1xuICAgIHRoaXMubGV2ZWwgPSAtMTtcbiAgfVxuXG4gIG9uTGV2ZWxTd2l0Y2goKVxuICB7XG4gICAgdGhpcy5jZWE3MDhJbnRlcnByZXRlci5jbGVhcigpO1xuICB9XG5cbiAgb25GcmFnUGFyc2luZ1VzZXJEYXRhKGV2ZW50LCBkYXRhKSB7XG4gICAgLy8gcHVzaCBhbGwgb2YgdGhlIENFQS03MDggbWVzc2FnZXMgaW50byB0aGUgaW50ZXJwcmV0ZXJcbiAgICAvLyBpbW1lZGlhdGVseS4gSXQgd2lsbCBjcmVhdGUgdGhlIHByb3BlciB0aW1lc3RhbXBzIGJhc2VkIG9uIG91ciBQVFMgdmFsdWVcbiAgICBmb3IgKHZhciBpPTA7IGk8ZGF0YS5zYW1wbGVzLmxlbmd0aDsgaSsrKVxuICAgIHtcbiAgICAgIHRoaXMuY2VhNzA4SW50ZXJwcmV0ZXIucHVzaChkYXRhLnNhbXBsZXNbaV0ucHRzLCBkYXRhLnNhbXBsZXNbaV0uYnl0ZXMpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBUaW1lbGluZUNvbnRyb2xsZXI7IiwiLypcbiAqXG4gKiBUaGlzIGZpbGUgY29udGFpbnMgYW4gYWRhcHRhdGlvbiBvZiB0aGUgQUVTIGRlY3J5cHRpb24gYWxnb3JpdGhtXG4gKiBmcm9tIHRoZSBTdGFuZGZvcmQgSmF2YXNjcmlwdCBDcnlwdG9ncmFwaHkgTGlicmFyeS4gVGhhdCB3b3JrIGlzXG4gKiBjb3ZlcmVkIGJ5IHRoZSBmb2xsb3dpbmcgY29weXJpZ2h0IGFuZCBwZXJtaXNzaW9ucyBub3RpY2U6XG4gKlxuICogQ29weXJpZ2h0IDIwMDktMjAxMCBFbWlseSBTdGFyaywgTWlrZSBIYW1idXJnLCBEYW4gQm9uZWguXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFJlZGlzdHJpYnV0aW9uIGFuZCB1c2UgaW4gc291cmNlIGFuZCBiaW5hcnkgZm9ybXMsIHdpdGggb3Igd2l0aG91dFxuICogbW9kaWZpY2F0aW9uLCBhcmUgcGVybWl0dGVkIHByb3ZpZGVkIHRoYXQgdGhlIGZvbGxvd2luZyBjb25kaXRpb25zIGFyZVxuICogbWV0OlxuICpcbiAqIDEuIFJlZGlzdHJpYnV0aW9ucyBvZiBzb3VyY2UgY29kZSBtdXN0IHJldGFpbiB0aGUgYWJvdmUgY29weXJpZ2h0XG4gKiAgICBub3RpY2UsIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIuXG4gKlxuICogMi4gUmVkaXN0cmlidXRpb25zIGluIGJpbmFyeSBmb3JtIG11c3QgcmVwcm9kdWNlIHRoZSBhYm92ZVxuICogICAgY29weXJpZ2h0IG5vdGljZSwgdGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmdcbiAqICAgIGRpc2NsYWltZXIgaW4gdGhlIGRvY3VtZW50YXRpb24gYW5kL29yIG90aGVyIG1hdGVyaWFscyBwcm92aWRlZFxuICogICAgd2l0aCB0aGUgZGlzdHJpYnV0aW9uLlxuICpcbiAqIFRISVMgU09GVFdBUkUgSVMgUFJPVklERUQgQlkgVEhFIEFVVEhPUlMgYGBBUyBJUycnIEFORCBBTlkgRVhQUkVTUyBPUlxuICogSU1QTElFRCBXQVJSQU5USUVTLCBJTkNMVURJTkcsIEJVVCBOT1QgTElNSVRFRCBUTywgVEhFIElNUExJRURcbiAqIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZIEFORCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBUkVcbiAqIERJU0NMQUlNRUQuIElOIE5PIEVWRU5UIFNIQUxMIDxDT1BZUklHSFQgSE9MREVSPiBPUiBDT05UUklCVVRPUlMgQkVcbiAqIExJQUJMRSBGT1IgQU5ZIERJUkVDVCwgSU5ESVJFQ1QsIElOQ0lERU5UQUwsIFNQRUNJQUwsIEVYRU1QTEFSWSwgT1JcbiAqIENPTlNFUVVFTlRJQUwgREFNQUdFUyAoSU5DTFVESU5HLCBCVVQgTk9UIExJTUlURUQgVE8sIFBST0NVUkVNRU5UIE9GXG4gKiBTVUJTVElUVVRFIEdPT0RTIE9SIFNFUlZJQ0VTOyBMT1NTIE9GIFVTRSwgREFUQSwgT1IgUFJPRklUUzsgT1JcbiAqIEJVU0lORVNTIElOVEVSUlVQVElPTikgSE9XRVZFUiBDQVVTRUQgQU5EIE9OIEFOWSBUSEVPUlkgT0YgTElBQklMSVRZLFxuICogV0hFVEhFUiBJTiBDT05UUkFDVCwgU1RSSUNUIExJQUJJTElUWSwgT1IgVE9SVCAoSU5DTFVESU5HIE5FR0xJR0VOQ0VcbiAqIE9SIE9USEVSV0lTRSkgQVJJU0lORyBJTiBBTlkgV0FZIE9VVCBPRiBUSEUgVVNFIE9GIFRISVMgU09GVFdBUkUsIEVWRU5cbiAqIElGIEFEVklTRUQgT0YgVEhFIFBPU1NJQklMSVRZIE9GIFNVQ0ggREFNQUdFLlxuICpcbiAqIFRoZSB2aWV3cyBhbmQgY29uY2x1c2lvbnMgY29udGFpbmVkIGluIHRoZSBzb2Z0d2FyZSBhbmQgZG9jdW1lbnRhdGlvblxuICogYXJlIHRob3NlIG9mIHRoZSBhdXRob3JzIGFuZCBzaG91bGQgbm90IGJlIGludGVycHJldGVkIGFzIHJlcHJlc2VudGluZ1xuICogb2ZmaWNpYWwgcG9saWNpZXMsIGVpdGhlciBleHByZXNzZWQgb3IgaW1wbGllZCwgb2YgdGhlIGF1dGhvcnMuXG4gKi9cbmNsYXNzIEFFUyB7XG5cbiAgLyoqXG4gICAqIFNjaGVkdWxlIG91dCBhbiBBRVMga2V5IGZvciBib3RoIGVuY3J5cHRpb24gYW5kIGRlY3J5cHRpb24uIFRoaXNcbiAgICogaXMgYSBsb3ctbGV2ZWwgY2xhc3MuIFVzZSBhIGNpcGhlciBtb2RlIHRvIGRvIGJ1bGsgZW5jcnlwdGlvbi5cbiAgICpcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSBrZXkge0FycmF5fSBUaGUga2V5IGFzIGFuIGFycmF5IG9mIDQsIDYgb3IgOCB3b3Jkcy5cbiAgICovXG4gIGNvbnN0cnVjdG9yKGtleSkge1xuICAgIC8qKlxuICAgICAqIFRoZSBleHBhbmRlZCBTLWJveCBhbmQgaW52ZXJzZSBTLWJveCB0YWJsZXMuIFRoZXNlIHdpbGwgYmUgY29tcHV0ZWRcbiAgICAgKiBvbiB0aGUgY2xpZW50IHNvIHRoYXQgd2UgZG9uJ3QgaGF2ZSB0byBzZW5kIHRoZW0gZG93biB0aGUgd2lyZS5cbiAgICAgKlxuICAgICAqIFRoZXJlIGFyZSB0d28gdGFibGVzLCBfdGFibGVzWzBdIGlzIGZvciBlbmNyeXB0aW9uIGFuZFxuICAgICAqIF90YWJsZXNbMV0gaXMgZm9yIGRlY3J5cHRpb24uXG4gICAgICpcbiAgICAgKiBUaGUgZmlyc3QgNCBzdWItdGFibGVzIGFyZSB0aGUgZXhwYW5kZWQgUy1ib3ggd2l0aCBNaXhDb2x1bW5zLiBUaGVcbiAgICAgKiBsYXN0IChfdGFibGVzWzAxXVs0XSkgaXMgdGhlIFMtYm94IGl0c2VsZi5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgdGhpcy5fdGFibGVzID0gW1tbXSxbXSxbXSxbXSxbXV0sW1tdLFtdLFtdLFtdLFtdXV07XG5cbiAgICB0aGlzLl9wcmVjb21wdXRlKCk7XG5cbiAgICB2YXIgaSwgaiwgdG1wLFxuICAgIGVuY0tleSwgZGVjS2V5LFxuICAgIHNib3ggPSB0aGlzLl90YWJsZXNbMF1bNF0sIGRlY1RhYmxlID0gdGhpcy5fdGFibGVzWzFdLFxuICAgIGtleUxlbiA9IGtleS5sZW5ndGgsIHJjb24gPSAxO1xuXG4gICAgaWYgKGtleUxlbiAhPT0gNCAmJiBrZXlMZW4gIT09IDYgJiYga2V5TGVuICE9PSA4KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgYWVzIGtleSBzaXplPScgKyBrZXlMZW4pO1xuICAgIH1cblxuICAgIGVuY0tleSA9IGtleS5zbGljZSgwKTtcbiAgICBkZWNLZXkgPSBbXTtcbiAgICB0aGlzLl9rZXkgPSBbZW5jS2V5LCBkZWNLZXldO1xuXG4gICAgLy8gc2NoZWR1bGUgZW5jcnlwdGlvbiBrZXlzXG4gICAgZm9yIChpID0ga2V5TGVuOyBpIDwgNCAqIGtleUxlbiArIDI4OyBpKyspIHtcbiAgICAgIHRtcCA9IGVuY0tleVtpLTFdO1xuXG4gICAgICAvLyBhcHBseSBzYm94XG4gICAgICBpZiAoaSVrZXlMZW4gPT09IDAgfHwgKGtleUxlbiA9PT0gOCAmJiBpJWtleUxlbiA9PT0gNCkpIHtcbiAgICAgICAgdG1wID0gc2JveFt0bXA+Pj4yNF08PDI0IF4gc2JveFt0bXA+PjE2JjI1NV08PDE2IF4gc2JveFt0bXA+PjgmMjU1XTw8OCBeIHNib3hbdG1wJjI1NV07XG5cbiAgICAgICAgLy8gc2hpZnQgcm93cyBhbmQgYWRkIHJjb25cbiAgICAgICAgaWYgKGkla2V5TGVuID09PSAwKSB7XG4gICAgICAgICAgdG1wID0gdG1wPDw4IF4gdG1wPj4+MjQgXiByY29uPDwyNDtcbiAgICAgICAgICByY29uID0gcmNvbjw8MSBeIChyY29uPj43KSoyODM7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZW5jS2V5W2ldID0gZW5jS2V5W2kta2V5TGVuXSBeIHRtcDtcbiAgICB9XG5cbiAgICAvLyBzY2hlZHVsZSBkZWNyeXB0aW9uIGtleXNcbiAgICBmb3IgKGogPSAwOyBpOyBqKyssIGktLSkge1xuICAgICAgdG1wID0gZW5jS2V5W2omMyA/IGkgOiBpIC0gNF07XG4gICAgICBpZiAoaTw9NCB8fCBqPDQpIHtcbiAgICAgICAgZGVjS2V5W2pdID0gdG1wO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGVjS2V5W2pdID0gZGVjVGFibGVbMF1bc2JveFt0bXA+Pj4yNCAgICAgIF1dIF5cbiAgICAgICAgICBkZWNUYWJsZVsxXVtzYm94W3RtcD4+MTYgICYgMjU1XV0gXlxuICAgICAgICAgIGRlY1RhYmxlWzJdW3Nib3hbdG1wPj44ICAgJiAyNTVdXSBeXG4gICAgICAgICAgZGVjVGFibGVbM11bc2JveFt0bXAgICAgICAmIDI1NV1dO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBFeHBhbmQgdGhlIFMtYm94IHRhYmxlcy5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9wcmVjb21wdXRlKCkge1xuICAgIHZhciBlbmNUYWJsZSA9IHRoaXMuX3RhYmxlc1swXSwgZGVjVGFibGUgPSB0aGlzLl90YWJsZXNbMV0sXG4gICAgc2JveCA9IGVuY1RhYmxlWzRdLCBzYm94SW52ID0gZGVjVGFibGVbNF0sXG4gICAgaSwgeCwgeEludiwgZD1bXSwgdGg9W10sIHgyLCB4NCwgeDgsIHMsIHRFbmMsIHREZWM7XG5cbiAgICAvLyBDb21wdXRlIGRvdWJsZSBhbmQgdGhpcmQgdGFibGVzXG4gICAgZm9yIChpID0gMDsgaSA8IDI1NjsgaSsrKSB7XG4gICAgICB0aFsoIGRbaV0gPSBpPDwxIF4gKGk+PjcpKjI4MyApXmldPWk7XG4gICAgfVxuXG4gICAgZm9yICh4ID0geEludiA9IDA7ICFzYm94W3hdOyB4IF49IHgyIHx8IDEsIHhJbnYgPSB0aFt4SW52XSB8fCAxKSB7XG4gICAgICAvLyBDb21wdXRlIHNib3hcbiAgICAgIHMgPSB4SW52IF4geEludjw8MSBeIHhJbnY8PDIgXiB4SW52PDwzIF4geEludjw8NDtcbiAgICAgIHMgPSBzPj44IF4gcyYyNTUgXiA5OTtcbiAgICAgIHNib3hbeF0gPSBzO1xuICAgICAgc2JveEludltzXSA9IHg7XG5cbiAgICAgIC8vIENvbXB1dGUgTWl4Q29sdW1uc1xuICAgICAgeDggPSBkW3g0ID0gZFt4MiA9IGRbeF1dXTtcbiAgICAgIHREZWMgPSB4OCoweDEwMTAxMDEgXiB4NCoweDEwMDAxIF4geDIqMHgxMDEgXiB4KjB4MTAxMDEwMDtcbiAgICAgIHRFbmMgPSBkW3NdKjB4MTAxIF4gcyoweDEwMTAxMDA7XG5cbiAgICAgIGZvciAoaSA9IDA7IGkgPCA0OyBpKyspIHtcbiAgICAgICAgZW5jVGFibGVbaV1beF0gPSB0RW5jID0gdEVuYzw8MjQgXiB0RW5jPj4+ODtcbiAgICAgICAgZGVjVGFibGVbaV1bc10gPSB0RGVjID0gdERlYzw8MjQgXiB0RGVjPj4+ODtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDb21wYWN0aWZ5LiBDb25zaWRlcmFibGUgc3BlZWR1cCBvbiBGaXJlZm94LlxuICAgIGZvciAoaSA9IDA7IGkgPCA1OyBpKyspIHtcbiAgICAgIGVuY1RhYmxlW2ldID0gZW5jVGFibGVbaV0uc2xpY2UoMCk7XG4gICAgICBkZWNUYWJsZVtpXSA9IGRlY1RhYmxlW2ldLnNsaWNlKDApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBEZWNyeXB0IDE2IGJ5dGVzLCBzcGVjaWZpZWQgYXMgZm91ciAzMi1iaXQgd29yZHMuXG4gICAqIEBwYXJhbSBlbmNyeXB0ZWQwIHtudW1iZXJ9IHRoZSBmaXJzdCB3b3JkIHRvIGRlY3J5cHRcbiAgICogQHBhcmFtIGVuY3J5cHRlZDEge251bWJlcn0gdGhlIHNlY29uZCB3b3JkIHRvIGRlY3J5cHRcbiAgICogQHBhcmFtIGVuY3J5cHRlZDIge251bWJlcn0gdGhlIHRoaXJkIHdvcmQgdG8gZGVjcnlwdFxuICAgKiBAcGFyYW0gZW5jcnlwdGVkMyB7bnVtYmVyfSB0aGUgZm91cnRoIHdvcmQgdG8gZGVjcnlwdFxuICAgKiBAcGFyYW0gb3V0IHtJbnQzMkFycmF5fSB0aGUgYXJyYXkgdG8gd3JpdGUgdGhlIGRlY3J5cHRlZCB3b3Jkc1xuICAgKiBpbnRvXG4gICAqIEBwYXJhbSBvZmZzZXQge251bWJlcn0gdGhlIG9mZnNldCBpbnRvIHRoZSBvdXRwdXQgYXJyYXkgdG8gc3RhcnRcbiAgICogd3JpdGluZyByZXN1bHRzXG4gICAqIEByZXR1cm4ge0FycmF5fSBUaGUgcGxhaW50ZXh0LlxuICAgKi9cbiAgZGVjcnlwdChlbmNyeXB0ZWQwLCBlbmNyeXB0ZWQxLCBlbmNyeXB0ZWQyLCBlbmNyeXB0ZWQzLCBvdXQsIG9mZnNldCkge1xuICAgIHZhciBrZXkgPSB0aGlzLl9rZXlbMV0sXG4gICAgLy8gc3RhdGUgdmFyaWFibGVzIGEsYixjLGQgYXJlIGxvYWRlZCB3aXRoIHByZS13aGl0ZW5lZCBkYXRhXG4gICAgYSA9IGVuY3J5cHRlZDAgXiBrZXlbMF0sXG4gICAgYiA9IGVuY3J5cHRlZDMgXiBrZXlbMV0sXG4gICAgYyA9IGVuY3J5cHRlZDIgXiBrZXlbMl0sXG4gICAgZCA9IGVuY3J5cHRlZDEgXiBrZXlbM10sXG4gICAgYTIsIGIyLCBjMixcblxuICAgIG5Jbm5lclJvdW5kcyA9IGtleS5sZW5ndGggLyA0IC0gMiwgLy8ga2V5Lmxlbmd0aCA9PT0gMiA/XG4gICAgaSxcbiAgICBrSW5kZXggPSA0LFxuICAgIHRhYmxlID0gdGhpcy5fdGFibGVzWzFdLFxuXG4gICAgLy8gbG9hZCB1cCB0aGUgdGFibGVzXG4gICAgdGFibGUwICAgID0gdGFibGVbMF0sXG4gICAgdGFibGUxICAgID0gdGFibGVbMV0sXG4gICAgdGFibGUyICAgID0gdGFibGVbMl0sXG4gICAgdGFibGUzICAgID0gdGFibGVbM10sXG4gICAgc2JveCAgPSB0YWJsZVs0XTtcblxuICAgIC8vIElubmVyIHJvdW5kcy4gQ3JpYmJlZCBmcm9tIE9wZW5TU0wuXG4gICAgZm9yIChpID0gMDsgaSA8IG5Jbm5lclJvdW5kczsgaSsrKSB7XG4gICAgICBhMiA9IHRhYmxlMFthPj4+MjRdIF4gdGFibGUxW2I+PjE2ICYgMjU1XSBeIHRhYmxlMltjPj44ICYgMjU1XSBeIHRhYmxlM1tkICYgMjU1XSBeIGtleVtrSW5kZXhdO1xuICAgICAgYjIgPSB0YWJsZTBbYj4+PjI0XSBeIHRhYmxlMVtjPj4xNiAmIDI1NV0gXiB0YWJsZTJbZD4+OCAmIDI1NV0gXiB0YWJsZTNbYSAmIDI1NV0gXiBrZXlba0luZGV4ICsgMV07XG4gICAgICBjMiA9IHRhYmxlMFtjPj4+MjRdIF4gdGFibGUxW2Q+PjE2ICYgMjU1XSBeIHRhYmxlMlthPj44ICYgMjU1XSBeIHRhYmxlM1tiICYgMjU1XSBeIGtleVtrSW5kZXggKyAyXTtcbiAgICAgIGQgID0gdGFibGUwW2Q+Pj4yNF0gXiB0YWJsZTFbYT4+MTYgJiAyNTVdIF4gdGFibGUyW2I+PjggJiAyNTVdIF4gdGFibGUzW2MgJiAyNTVdIF4ga2V5W2tJbmRleCArIDNdO1xuICAgICAga0luZGV4ICs9IDQ7XG4gICAgICBhPWEyOyBiPWIyOyBjPWMyO1xuICAgIH1cblxuICAgIC8vIExhc3Qgcm91bmQuXG4gICAgZm9yIChpID0gMDsgaSA8IDQ7IGkrKykge1xuICAgICAgb3V0WygzICYgLWkpICsgb2Zmc2V0XSA9XG4gICAgICAgIHNib3hbYT4+PjI0ICAgICAgXTw8MjQgXlxuICAgICAgICBzYm94W2I+PjE2ICAmIDI1NV08PDE2IF5cbiAgICAgICAgc2JveFtjPj44ICAgJiAyNTVdPDw4ICBeXG4gICAgICAgIHNib3hbZCAgICAgICYgMjU1XSAgICAgXlxuICAgICAgICBrZXlba0luZGV4KytdO1xuICAgICAgYTI9YTsgYT1iOyBiPWM7IGM9ZDsgZD1hMjtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQUVTO1xuIiwiLypcbiAqXG4gKiBUaGlzIGZpbGUgY29udGFpbnMgYW4gYWRhcHRhdGlvbiBvZiB0aGUgQUVTIGRlY3J5cHRpb24gYWxnb3JpdGhtXG4gKiBmcm9tIHRoZSBTdGFuZGZvcmQgSmF2YXNjcmlwdCBDcnlwdG9ncmFwaHkgTGlicmFyeS4gVGhhdCB3b3JrIGlzXG4gKiBjb3ZlcmVkIGJ5IHRoZSBmb2xsb3dpbmcgY29weXJpZ2h0IGFuZCBwZXJtaXNzaW9ucyBub3RpY2U6XG4gKlxuICogQ29weXJpZ2h0IDIwMDktMjAxMCBFbWlseSBTdGFyaywgTWlrZSBIYW1idXJnLCBEYW4gQm9uZWguXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFJlZGlzdHJpYnV0aW9uIGFuZCB1c2UgaW4gc291cmNlIGFuZCBiaW5hcnkgZm9ybXMsIHdpdGggb3Igd2l0aG91dFxuICogbW9kaWZpY2F0aW9uLCBhcmUgcGVybWl0dGVkIHByb3ZpZGVkIHRoYXQgdGhlIGZvbGxvd2luZyBjb25kaXRpb25zIGFyZVxuICogbWV0OlxuICpcbiAqIDEuIFJlZGlzdHJpYnV0aW9ucyBvZiBzb3VyY2UgY29kZSBtdXN0IHJldGFpbiB0aGUgYWJvdmUgY29weXJpZ2h0XG4gKiAgICBub3RpY2UsIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIuXG4gKlxuICogMi4gUmVkaXN0cmlidXRpb25zIGluIGJpbmFyeSBmb3JtIG11c3QgcmVwcm9kdWNlIHRoZSBhYm92ZVxuICogICAgY29weXJpZ2h0IG5vdGljZSwgdGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmdcbiAqICAgIGRpc2NsYWltZXIgaW4gdGhlIGRvY3VtZW50YXRpb24gYW5kL29yIG90aGVyIG1hdGVyaWFscyBwcm92aWRlZFxuICogICAgd2l0aCB0aGUgZGlzdHJpYnV0aW9uLlxuICpcbiAqIFRISVMgU09GVFdBUkUgSVMgUFJPVklERUQgQlkgVEhFIEFVVEhPUlMgYGBBUyBJUycnIEFORCBBTlkgRVhQUkVTUyBPUlxuICogSU1QTElFRCBXQVJSQU5USUVTLCBJTkNMVURJTkcsIEJVVCBOT1QgTElNSVRFRCBUTywgVEhFIElNUExJRURcbiAqIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZIEFORCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBUkVcbiAqIERJU0NMQUlNRUQuIElOIE5PIEVWRU5UIFNIQUxMIDxDT1BZUklHSFQgSE9MREVSPiBPUiBDT05UUklCVVRPUlMgQkVcbiAqIExJQUJMRSBGT1IgQU5ZIERJUkVDVCwgSU5ESVJFQ1QsIElOQ0lERU5UQUwsIFNQRUNJQUwsIEVYRU1QTEFSWSwgT1JcbiAqIENPTlNFUVVFTlRJQUwgREFNQUdFUyAoSU5DTFVESU5HLCBCVVQgTk9UIExJTUlURUQgVE8sIFBST0NVUkVNRU5UIE9GXG4gKiBTVUJTVElUVVRFIEdPT0RTIE9SIFNFUlZJQ0VTOyBMT1NTIE9GIFVTRSwgREFUQSwgT1IgUFJPRklUUzsgT1JcbiAqIEJVU0lORVNTIElOVEVSUlVQVElPTikgSE9XRVZFUiBDQVVTRUQgQU5EIE9OIEFOWSBUSEVPUlkgT0YgTElBQklMSVRZLFxuICogV0hFVEhFUiBJTiBDT05UUkFDVCwgU1RSSUNUIExJQUJJTElUWSwgT1IgVE9SVCAoSU5DTFVESU5HIE5FR0xJR0VOQ0VcbiAqIE9SIE9USEVSV0lTRSkgQVJJU0lORyBJTiBBTlkgV0FZIE9VVCBPRiBUSEUgVVNFIE9GIFRISVMgU09GVFdBUkUsIEVWRU5cbiAqIElGIEFEVklTRUQgT0YgVEhFIFBPU1NJQklMSVRZIE9GIFNVQ0ggREFNQUdFLlxuICpcbiAqIFRoZSB2aWV3cyBhbmQgY29uY2x1c2lvbnMgY29udGFpbmVkIGluIHRoZSBzb2Z0d2FyZSBhbmQgZG9jdW1lbnRhdGlvblxuICogYXJlIHRob3NlIG9mIHRoZSBhdXRob3JzIGFuZCBzaG91bGQgbm90IGJlIGludGVycHJldGVkIGFzIHJlcHJlc2VudGluZ1xuICogb2ZmaWNpYWwgcG9saWNpZXMsIGVpdGhlciBleHByZXNzZWQgb3IgaW1wbGllZCwgb2YgdGhlIGF1dGhvcnMuXG4gKi9cblxuaW1wb3J0IEFFUyBmcm9tICcuL2Flcyc7XG5cbmNsYXNzIEFFUzEyOERlY3J5cHRlciB7XG5cbiAgY29uc3RydWN0b3Ioa2V5LCBpbml0VmVjdG9yKSB7XG4gICAgdGhpcy5rZXkgPSBrZXk7XG4gICAgdGhpcy5pdiA9IGluaXRWZWN0b3I7XG4gIH1cblxuICAvKipcbiAgICogQ29udmVydCBuZXR3b3JrLW9yZGVyIChiaWctZW5kaWFuKSBieXRlcyBpbnRvIHRoZWlyIGxpdHRsZS1lbmRpYW5cbiAgICogcmVwcmVzZW50YXRpb24uXG4gICAqL1xuICBudG9oKHdvcmQpIHtcbiAgICByZXR1cm4gKHdvcmQgPDwgMjQpIHxcbiAgICAgICgod29yZCAmIDB4ZmYwMCkgPDwgOCkgfFxuICAgICAgKCh3b3JkICYgMHhmZjAwMDApID4+IDgpIHxcbiAgICAgICh3b3JkID4+PiAyNCk7XG4gIH1cblxuXG4gIC8qKlxuICAgKiBEZWNyeXB0IGJ5dGVzIHVzaW5nIEFFUy0xMjggd2l0aCBDQkMgYW5kIFBLQ1MjNyBwYWRkaW5nLlxuICAgKiBAcGFyYW0gZW5jcnlwdGVkIHtVaW50OEFycmF5fSB0aGUgZW5jcnlwdGVkIGJ5dGVzXG4gICAqIEBwYXJhbSBrZXkge1VpbnQzMkFycmF5fSB0aGUgYnl0ZXMgb2YgdGhlIGRlY3J5cHRpb24ga2V5XG4gICAqIEBwYXJhbSBpbml0VmVjdG9yIHtVaW50MzJBcnJheX0gdGhlIGluaXRpYWxpemF0aW9uIHZlY3RvciAoSVYpIHRvXG4gICAqIHVzZSBmb3IgdGhlIGZpcnN0IHJvdW5kIG9mIENCQy5cbiAgICogQHJldHVybiB7VWludDhBcnJheX0gdGhlIGRlY3J5cHRlZCBieXRlc1xuICAgKlxuICAgKiBAc2VlIGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvQWR2YW5jZWRfRW5jcnlwdGlvbl9TdGFuZGFyZFxuICAgKiBAc2VlIGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvQmxvY2tfY2lwaGVyX21vZGVfb2Zfb3BlcmF0aW9uI0NpcGhlcl9CbG9ja19DaGFpbmluZ18uMjhDQkMuMjlcbiAgICogQHNlZSBodHRwczovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjMjMxNVxuICAgKi9cbiAgZG9EZWNyeXB0KGVuY3J5cHRlZCwga2V5LCBpbml0VmVjdG9yKSB7XG4gICAgdmFyXG4gICAgICAvLyB3b3JkLWxldmVsIGFjY2VzcyB0byB0aGUgZW5jcnlwdGVkIGJ5dGVzXG4gICAgICBlbmNyeXB0ZWQzMiA9IG5ldyBJbnQzMkFycmF5KGVuY3J5cHRlZC5idWZmZXIsIGVuY3J5cHRlZC5ieXRlT2Zmc2V0LCBlbmNyeXB0ZWQuYnl0ZUxlbmd0aCA+PiAyKSxcblxuICAgIGRlY2lwaGVyID0gbmV3IEFFUyhBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChrZXkpKSxcblxuICAgIC8vIGJ5dGUgYW5kIHdvcmQtbGV2ZWwgYWNjZXNzIGZvciB0aGUgZGVjcnlwdGVkIG91dHB1dFxuICAgIGRlY3J5cHRlZCA9IG5ldyBVaW50OEFycmF5KGVuY3J5cHRlZC5ieXRlTGVuZ3RoKSxcbiAgICBkZWNyeXB0ZWQzMiA9IG5ldyBJbnQzMkFycmF5KGRlY3J5cHRlZC5idWZmZXIpLFxuXG4gICAgLy8gdGVtcG9yYXJ5IHZhcmlhYmxlcyBmb3Igd29ya2luZyB3aXRoIHRoZSBJViwgZW5jcnlwdGVkLCBhbmRcbiAgICAvLyBkZWNyeXB0ZWQgZGF0YVxuICAgIGluaXQwLCBpbml0MSwgaW5pdDIsIGluaXQzLFxuICAgIGVuY3J5cHRlZDAsIGVuY3J5cHRlZDEsIGVuY3J5cHRlZDIsIGVuY3J5cHRlZDMsXG5cbiAgICAvLyBpdGVyYXRpb24gdmFyaWFibGVcbiAgICB3b3JkSXg7XG5cbiAgICAvLyBwdWxsIG91dCB0aGUgd29yZHMgb2YgdGhlIElWIHRvIGVuc3VyZSB3ZSBkb24ndCBtb2RpZnkgdGhlXG4gICAgLy8gcGFzc2VkLWluIHJlZmVyZW5jZSBhbmQgZWFzaWVyIGFjY2Vzc1xuICAgIGluaXQwID0gfn5pbml0VmVjdG9yWzBdO1xuICAgIGluaXQxID0gfn5pbml0VmVjdG9yWzFdO1xuICAgIGluaXQyID0gfn5pbml0VmVjdG9yWzJdO1xuICAgIGluaXQzID0gfn5pbml0VmVjdG9yWzNdO1xuXG4gICAgLy8gZGVjcnlwdCBmb3VyIHdvcmQgc2VxdWVuY2VzLCBhcHBseWluZyBjaXBoZXItYmxvY2sgY2hhaW5pbmcgKENCQylcbiAgICAvLyB0byBlYWNoIGRlY3J5cHRlZCBibG9ja1xuICAgIGZvciAod29yZEl4ID0gMDsgd29yZEl4IDwgZW5jcnlwdGVkMzIubGVuZ3RoOyB3b3JkSXggKz0gNCkge1xuICAgICAgLy8gY29udmVydCBiaWctZW5kaWFuIChuZXR3b3JrIG9yZGVyKSB3b3JkcyBpbnRvIGxpdHRsZS1lbmRpYW5cbiAgICAgIC8vIChqYXZhc2NyaXB0IG9yZGVyKVxuICAgICAgZW5jcnlwdGVkMCA9IH5+dGhpcy5udG9oKGVuY3J5cHRlZDMyW3dvcmRJeF0pO1xuICAgICAgZW5jcnlwdGVkMSA9IH5+dGhpcy5udG9oKGVuY3J5cHRlZDMyW3dvcmRJeCArIDFdKTtcbiAgICAgIGVuY3J5cHRlZDIgPSB+fnRoaXMubnRvaChlbmNyeXB0ZWQzMlt3b3JkSXggKyAyXSk7XG4gICAgICBlbmNyeXB0ZWQzID0gfn50aGlzLm50b2goZW5jcnlwdGVkMzJbd29yZEl4ICsgM10pO1xuXG4gICAgICAvLyBkZWNyeXB0IHRoZSBibG9ja1xuICAgICAgZGVjaXBoZXIuZGVjcnlwdChlbmNyeXB0ZWQwLFxuICAgICAgICAgIGVuY3J5cHRlZDEsXG4gICAgICAgICAgZW5jcnlwdGVkMixcbiAgICAgICAgICBlbmNyeXB0ZWQzLFxuICAgICAgICAgIGRlY3J5cHRlZDMyLFxuICAgICAgICAgIHdvcmRJeCk7XG5cbiAgICAgIC8vIFhPUiB3aXRoIHRoZSBJViwgYW5kIHJlc3RvcmUgbmV0d29yayBieXRlLW9yZGVyIHRvIG9idGFpbiB0aGVcbiAgICAgIC8vIHBsYWludGV4dFxuICAgICAgZGVjcnlwdGVkMzJbd29yZEl4XSAgICAgPSB0aGlzLm50b2goZGVjcnlwdGVkMzJbd29yZEl4XSBeIGluaXQwKTtcbiAgICAgIGRlY3J5cHRlZDMyW3dvcmRJeCArIDFdID0gdGhpcy5udG9oKGRlY3J5cHRlZDMyW3dvcmRJeCArIDFdIF4gaW5pdDEpO1xuICAgICAgZGVjcnlwdGVkMzJbd29yZEl4ICsgMl0gPSB0aGlzLm50b2goZGVjcnlwdGVkMzJbd29yZEl4ICsgMl0gXiBpbml0Mik7XG4gICAgICBkZWNyeXB0ZWQzMlt3b3JkSXggKyAzXSA9IHRoaXMubnRvaChkZWNyeXB0ZWQzMlt3b3JkSXggKyAzXSBeIGluaXQzKTtcblxuICAgICAgLy8gc2V0dXAgdGhlIElWIGZvciB0aGUgbmV4dCByb3VuZFxuICAgICAgaW5pdDAgPSBlbmNyeXB0ZWQwO1xuICAgICAgaW5pdDEgPSBlbmNyeXB0ZWQxO1xuICAgICAgaW5pdDIgPSBlbmNyeXB0ZWQyO1xuICAgICAgaW5pdDMgPSBlbmNyeXB0ZWQzO1xuICAgIH1cblxuICAgIHJldHVybiBkZWNyeXB0ZWQ7XG4gIH1cblxuICBsb2NhbERlY3J5cHQoZW5jcnlwdGVkLCBrZXksIGluaXRWZWN0b3IsIGRlY3J5cHRlZCkge1xuICAgIHZhciBieXRlcyA9IHRoaXMuZG9EZWNyeXB0KGVuY3J5cHRlZCxcbiAgICAgICAga2V5LFxuICAgICAgICBpbml0VmVjdG9yKTtcbiAgICBkZWNyeXB0ZWQuc2V0KGJ5dGVzLCBlbmNyeXB0ZWQuYnl0ZU9mZnNldCk7XG4gIH1cblxuICBkZWNyeXB0KGVuY3J5cHRlZCkge1xuICAgIHZhclxuICAgICAgc3RlcCA9IDQgKiA4MDAwLFxuICAgIC8vZW5jcnlwdGVkMzIgPSBuZXcgSW50MzJBcnJheShlbmNyeXB0ZWQuYnVmZmVyKSxcbiAgICBlbmNyeXB0ZWQzMiA9IG5ldyBJbnQzMkFycmF5KGVuY3J5cHRlZCksXG4gICAgZGVjcnlwdGVkID0gbmV3IFVpbnQ4QXJyYXkoZW5jcnlwdGVkLmJ5dGVMZW5ndGgpLFxuICAgIGkgPSAwO1xuXG4gICAgLy8gc3BsaXQgdXAgdGhlIGVuY3J5cHRpb24gam9iIGFuZCBkbyB0aGUgaW5kaXZpZHVhbCBjaHVua3MgYXN5bmNocm9ub3VzbHlcbiAgICB2YXIga2V5ID0gdGhpcy5rZXk7XG4gICAgdmFyIGluaXRWZWN0b3IgPSB0aGlzLml2O1xuICAgIHRoaXMubG9jYWxEZWNyeXB0KGVuY3J5cHRlZDMyLnN1YmFycmF5KGksIGkgKyBzdGVwKSwga2V5LCBpbml0VmVjdG9yLCBkZWNyeXB0ZWQpO1xuXG4gICAgZm9yIChpID0gc3RlcDsgaSA8IGVuY3J5cHRlZDMyLmxlbmd0aDsgaSArPSBzdGVwKSB7XG4gICAgICBpbml0VmVjdG9yID0gbmV3IFVpbnQzMkFycmF5KFtcbiAgICAgICAgICB0aGlzLm50b2goZW5jcnlwdGVkMzJbaSAtIDRdKSxcbiAgICAgICAgICB0aGlzLm50b2goZW5jcnlwdGVkMzJbaSAtIDNdKSxcbiAgICAgICAgICB0aGlzLm50b2goZW5jcnlwdGVkMzJbaSAtIDJdKSxcbiAgICAgICAgICB0aGlzLm50b2goZW5jcnlwdGVkMzJbaSAtIDFdKVxuICAgICAgXSk7XG4gICAgICB0aGlzLmxvY2FsRGVjcnlwdChlbmNyeXB0ZWQzMi5zdWJhcnJheShpLCBpICsgc3RlcCksIGtleSwgaW5pdFZlY3RvciwgZGVjcnlwdGVkKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZGVjcnlwdGVkO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEFFUzEyOERlY3J5cHRlcjtcbiIsIi8qXG4gKiBBRVMxMjggZGVjcnlwdGlvbi5cbiAqL1xuXG5pbXBvcnQgQUVTMTI4RGVjcnlwdGVyIGZyb20gJy4vYWVzMTI4LWRlY3J5cHRlcic7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG5jbGFzcyBEZWNyeXB0ZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHRoaXMuaGxzID0gaGxzO1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBicm93c2VyQ3J5cHRvID0gd2luZG93ID8gd2luZG93LmNyeXB0byA6IGNyeXB0bztcbiAgICAgIHRoaXMuc3VidGxlID0gYnJvd3NlckNyeXB0by5zdWJ0bGUgfHwgYnJvd3NlckNyeXB0by53ZWJraXRTdWJ0bGU7XG4gICAgICB0aGlzLmRpc2FibGVXZWJDcnlwdG8gPSAhdGhpcy5zdWJ0bGU7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgdGhpcy5kaXNhYmxlV2ViQ3J5cHRvID0gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICBkZXN0cm95KCkge1xuICB9XG5cbiAgZGVjcnlwdChkYXRhLCBrZXksIGl2LCBjYWxsYmFjaykge1xuICAgIGlmICh0aGlzLmRpc2FibGVXZWJDcnlwdG8gJiYgdGhpcy5obHMuY29uZmlnLmVuYWJsZVNvZnR3YXJlQUVTKSB7XG4gICAgICB0aGlzLmRlY3J5cHRCeVNvZnR3YXJlKGRhdGEsIGtleSwgaXYsIGNhbGxiYWNrKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5kZWNyeXB0QnlXZWJDcnlwdG8oZGF0YSwga2V5LCBpdiwgY2FsbGJhY2spO1xuICAgIH1cbiAgfVxuXG4gIGRlY3J5cHRCeVdlYkNyeXB0byhkYXRhLCBrZXksIGl2LCBjYWxsYmFjaykge1xuICAgIGxvZ2dlci5sb2coJ2RlY3J5cHRpbmcgYnkgV2ViQ3J5cHRvIEFQSScpO1xuXG4gICAgdGhpcy5zdWJ0bGUuaW1wb3J0S2V5KCdyYXcnLCBrZXksIHsgbmFtZSA6ICdBRVMtQ0JDJywgbGVuZ3RoIDogMTI4IH0sIGZhbHNlLCBbJ2RlY3J5cHQnXSkuXG4gICAgICB0aGVuKChpbXBvcnRlZEtleSkgPT4ge1xuICAgICAgICB0aGlzLnN1YnRsZS5kZWNyeXB0KHsgbmFtZSA6ICdBRVMtQ0JDJywgaXYgOiBpdi5idWZmZXIgfSwgaW1wb3J0ZWRLZXksIGRhdGEpLlxuICAgICAgICAgIHRoZW4oY2FsbGJhY2spLlxuICAgICAgICAgIGNhdGNoICgoZXJyKSA9PiB7XG4gICAgICAgICAgICB0aGlzLm9uV2ViQ3J5cHRvRXJyb3IoZXJyLCBkYXRhLCBrZXksIGl2LCBjYWxsYmFjayk7XG4gICAgICAgICAgfSk7XG4gICAgICB9KS5cbiAgICBjYXRjaCAoKGVycikgPT4ge1xuICAgICAgdGhpcy5vbldlYkNyeXB0b0Vycm9yKGVyciwgZGF0YSwga2V5LCBpdiwgY2FsbGJhY2spO1xuICAgIH0pO1xuICB9XG5cbiAgZGVjcnlwdEJ5U29mdHdhcmUoZGF0YSwga2V5OCwgaXY4LCBjYWxsYmFjaykge1xuICAgIGxvZ2dlci5sb2coJ2RlY3J5cHRpbmcgYnkgSmF2YVNjcmlwdCBJbXBsZW1lbnRhdGlvbicpO1xuXG4gICAgdmFyIHZpZXcgPSBuZXcgRGF0YVZpZXcoa2V5OC5idWZmZXIpO1xuICAgIHZhciBrZXkgPSBuZXcgVWludDMyQXJyYXkoW1xuICAgICAgICB2aWV3LmdldFVpbnQzMigwKSxcbiAgICAgICAgdmlldy5nZXRVaW50MzIoNCksXG4gICAgICAgIHZpZXcuZ2V0VWludDMyKDgpLFxuICAgICAgICB2aWV3LmdldFVpbnQzMigxMilcbiAgICBdKTtcblxuICAgIHZpZXcgPSBuZXcgRGF0YVZpZXcoaXY4LmJ1ZmZlcik7XG4gICAgdmFyIGl2ID0gbmV3IFVpbnQzMkFycmF5KFtcbiAgICAgICAgdmlldy5nZXRVaW50MzIoMCksXG4gICAgICAgIHZpZXcuZ2V0VWludDMyKDQpLFxuICAgICAgICB2aWV3LmdldFVpbnQzMig4KSxcbiAgICAgICAgdmlldy5nZXRVaW50MzIoMTIpXG4gICAgXSk7XG5cbiAgICB2YXIgZGVjcnlwdGVyID0gbmV3IEFFUzEyOERlY3J5cHRlcihrZXksIGl2KTtcbiAgICBjYWxsYmFjayhkZWNyeXB0ZXIuZGVjcnlwdChkYXRhKS5idWZmZXIpO1xuICB9XG5cbiAgb25XZWJDcnlwdG9FcnJvcihlcnIsIGRhdGEsIGtleSwgaXYsIGNhbGxiYWNrKSB7XG4gICAgaWYgKHRoaXMuaGxzLmNvbmZpZy5lbmFibGVTb2Z0d2FyZUFFUykge1xuICAgICAgbG9nZ2VyLmxvZygnZGlzYWJsaW5nIHRvIHVzZSBXZWJDcnlwdG8gQVBJJyk7XG4gICAgICB0aGlzLmRpc2FibGVXZWJDcnlwdG8gPSB0cnVlO1xuICAgICAgdGhpcy5kZWNyeXB0QnlTb2Z0d2FyZShkYXRhLCBrZXksIGl2LCBjYWxsYmFjayk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgbG9nZ2VyLmVycm9yKGBkZWNyeXB0aW5nIGVycm9yIDogJHtlcnIubWVzc2FnZX1gKTtcbiAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlIDogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlscyA6IEVycm9yRGV0YWlscy5GUkFHX0RFQ1JZUFRfRVJST1IsIGZhdGFsIDogdHJ1ZSwgcmVhc29uIDogZXJyLm1lc3NhZ2V9KTtcbiAgICB9XG4gIH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBEZWNyeXB0ZXI7XG4iLCIvKipcbiAqIEFBQyBkZW11eGVyXG4gKi9cbmltcG9ydCBBRFRTIGZyb20gJy4vYWR0cyc7XG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCBJRDMgZnJvbSAnLi4vZGVtdXgvaWQzJztcblxuIGNsYXNzIEFBQ0RlbXV4ZXIge1xuXG4gIGNvbnN0cnVjdG9yKG9ic2VydmVyLHJlbXV4ZXJDbGFzcykge1xuICAgIHRoaXMub2JzZXJ2ZXIgPSBvYnNlcnZlcjtcbiAgICB0aGlzLnJlbXV4ZXJDbGFzcyA9IHJlbXV4ZXJDbGFzcztcbiAgICB0aGlzLnJlbXV4ZXIgPSBuZXcgdGhpcy5yZW11eGVyQ2xhc3Mob2JzZXJ2ZXIpO1xuICAgIHRoaXMuX2FhY1RyYWNrID0ge3R5cGU6ICdhdWRpbycsIGlkIDotMSwgc2VxdWVuY2VOdW1iZXI6IDAsIHNhbXBsZXMgOiBbXSwgbGVuIDogMH07XG4gIH1cblxuICBzdGF0aWMgcHJvYmUoZGF0YSkge1xuICAgIC8vIGNoZWNrIGlmIGRhdGEgY29udGFpbnMgSUQzIHRpbWVzdGFtcCBhbmQgQURUUyBzeW5jIHdvcmNcbiAgICB2YXIgaWQzID0gbmV3IElEMyhkYXRhKSwgYWR0c1N0YXJ0T2Zmc2V0LGxlbjtcbiAgICBpZihpZDMuaGFzVGltZVN0YW1wKSB7XG4gICAgICAvLyBsb29rIGZvciBBRFRTIGhlYWRlciAoMHhGRkZ4KVxuICAgICAgZm9yIChhZHRzU3RhcnRPZmZzZXQgPSBpZDMubGVuZ3RoLCBsZW4gPSBkYXRhLmxlbmd0aDsgYWR0c1N0YXJ0T2Zmc2V0IDwgbGVuIC0gMTsgYWR0c1N0YXJ0T2Zmc2V0KyspIHtcbiAgICAgICAgaWYgKChkYXRhW2FkdHNTdGFydE9mZnNldF0gPT09IDB4ZmYpICYmIChkYXRhW2FkdHNTdGFydE9mZnNldCsxXSAmIDB4ZjApID09PSAweGYwKSB7XG4gICAgICAgICAgLy9sb2dnZXIubG9nKCdBRFRTIHN5bmMgd29yZCBmb3VuZCAhJyk7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cblxuICAvLyBmZWVkIGluY29taW5nIGRhdGEgdG8gdGhlIGZyb250IG9mIHRoZSBwYXJzaW5nIHBpcGVsaW5lXG4gIHB1c2goZGF0YSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCwgY2MsIGxldmVsLCBzbiwgZHVyYXRpb24pIHtcbiAgICB2YXIgdHJhY2sgPSB0aGlzLl9hYWNUcmFjayxcbiAgICAgICAgaWQzID0gbmV3IElEMyhkYXRhKSxcbiAgICAgICAgcHRzID0gOTAqaWQzLnRpbWVTdGFtcCxcbiAgICAgICAgY29uZmlnLCBhZHRzRnJhbWVTaXplLCBhZHRzU3RhcnRPZmZzZXQsIGFkdHNIZWFkZXJMZW4sIHN0YW1wLCBuYlNhbXBsZXMsIGxlbiwgYWFjU2FtcGxlO1xuICAgIC8vIGxvb2sgZm9yIEFEVFMgaGVhZGVyICgweEZGRngpXG4gICAgZm9yIChhZHRzU3RhcnRPZmZzZXQgPSBpZDMubGVuZ3RoLCBsZW4gPSBkYXRhLmxlbmd0aDsgYWR0c1N0YXJ0T2Zmc2V0IDwgbGVuIC0gMTsgYWR0c1N0YXJ0T2Zmc2V0KyspIHtcbiAgICAgIGlmICgoZGF0YVthZHRzU3RhcnRPZmZzZXRdID09PSAweGZmKSAmJiAoZGF0YVthZHRzU3RhcnRPZmZzZXQrMV0gJiAweGYwKSA9PT0gMHhmMCkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIXRyYWNrLmF1ZGlvc2FtcGxlcmF0ZSkge1xuICAgICAgY29uZmlnID0gQURUUy5nZXRBdWRpb0NvbmZpZyh0aGlzLm9ic2VydmVyLGRhdGEsIGFkdHNTdGFydE9mZnNldCwgYXVkaW9Db2RlYyk7XG4gICAgICB0cmFjay5jb25maWcgPSBjb25maWcuY29uZmlnO1xuICAgICAgdHJhY2suYXVkaW9zYW1wbGVyYXRlID0gY29uZmlnLnNhbXBsZXJhdGU7XG4gICAgICB0cmFjay5jaGFubmVsQ291bnQgPSBjb25maWcuY2hhbm5lbENvdW50O1xuICAgICAgdHJhY2suY29kZWMgPSBjb25maWcuY29kZWM7XG4gICAgICB0cmFjay50aW1lc2NhbGUgPSB0aGlzLnJlbXV4ZXIudGltZXNjYWxlO1xuICAgICAgdHJhY2suZHVyYXRpb24gPSB0aGlzLnJlbXV4ZXIudGltZXNjYWxlICogZHVyYXRpb247XG4gICAgICBsb2dnZXIubG9nKGBwYXJzZWQgY29kZWM6JHt0cmFjay5jb2RlY30scmF0ZToke2NvbmZpZy5zYW1wbGVyYXRlfSxuYiBjaGFubmVsOiR7Y29uZmlnLmNoYW5uZWxDb3VudH1gKTtcbiAgICB9XG4gICAgbmJTYW1wbGVzID0gMDtcbiAgICB3aGlsZSAoKGFkdHNTdGFydE9mZnNldCArIDUpIDwgbGVuKSB7XG4gICAgICAvLyByZXRyaWV2ZSBmcmFtZSBzaXplXG4gICAgICBhZHRzRnJhbWVTaXplID0gKChkYXRhW2FkdHNTdGFydE9mZnNldCArIDNdICYgMHgwMykgPDwgMTEpO1xuICAgICAgLy8gYnl0ZSA0XG4gICAgICBhZHRzRnJhbWVTaXplIHw9IChkYXRhW2FkdHNTdGFydE9mZnNldCArIDRdIDw8IDMpO1xuICAgICAgLy8gYnl0ZSA1XG4gICAgICBhZHRzRnJhbWVTaXplIHw9ICgoZGF0YVthZHRzU3RhcnRPZmZzZXQgKyA1XSAmIDB4RTApID4+PiA1KTtcbiAgICAgIGFkdHNIZWFkZXJMZW4gPSAoISEoZGF0YVthZHRzU3RhcnRPZmZzZXQgKyAxXSAmIDB4MDEpID8gNyA6IDkpO1xuICAgICAgYWR0c0ZyYW1lU2l6ZSAtPSBhZHRzSGVhZGVyTGVuO1xuICAgICAgc3RhbXAgPSBNYXRoLnJvdW5kKHB0cyArIG5iU2FtcGxlcyAqIDEwMjQgKiA5MDAwMCAvIHRyYWNrLmF1ZGlvc2FtcGxlcmF0ZSk7XG4gICAgICAvL3N0YW1wID0gcGVzLnB0cztcbiAgICAgIC8vY29uc29sZS5sb2coJ0FBQyBmcmFtZSwgb2Zmc2V0L2xlbmd0aC9wdHM6JyArIChhZHRzU3RhcnRPZmZzZXQrNykgKyAnLycgKyBhZHRzRnJhbWVTaXplICsgJy8nICsgc3RhbXAudG9GaXhlZCgwKSk7XG4gICAgICBpZiAoKGFkdHNGcmFtZVNpemUgPiAwKSAmJiAoKGFkdHNTdGFydE9mZnNldCArIGFkdHNIZWFkZXJMZW4gKyBhZHRzRnJhbWVTaXplKSA8PSBsZW4pKSB7XG4gICAgICAgIGFhY1NhbXBsZSA9IHt1bml0OiBkYXRhLnN1YmFycmF5KGFkdHNTdGFydE9mZnNldCArIGFkdHNIZWFkZXJMZW4sIGFkdHNTdGFydE9mZnNldCArIGFkdHNIZWFkZXJMZW4gKyBhZHRzRnJhbWVTaXplKSwgcHRzOiBzdGFtcCwgZHRzOiBzdGFtcH07XG4gICAgICAgIHRyYWNrLnNhbXBsZXMucHVzaChhYWNTYW1wbGUpO1xuICAgICAgICB0cmFjay5sZW4gKz0gYWR0c0ZyYW1lU2l6ZTtcbiAgICAgICAgYWR0c1N0YXJ0T2Zmc2V0ICs9IGFkdHNGcmFtZVNpemUgKyBhZHRzSGVhZGVyTGVuO1xuICAgICAgICBuYlNhbXBsZXMrKztcbiAgICAgICAgLy8gbG9vayBmb3IgQURUUyBoZWFkZXIgKDB4RkZGeClcbiAgICAgICAgZm9yICggOyBhZHRzU3RhcnRPZmZzZXQgPCAobGVuIC0gMSk7IGFkdHNTdGFydE9mZnNldCsrKSB7XG4gICAgICAgICAgaWYgKChkYXRhW2FkdHNTdGFydE9mZnNldF0gPT09IDB4ZmYpICYmICgoZGF0YVthZHRzU3RhcnRPZmZzZXQgKyAxXSAmIDB4ZjApID09PSAweGYwKSkge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5yZW11eGVyLnJlbXV4KHRoaXMuX2FhY1RyYWNrLHtzYW1wbGVzIDogW119LCB7c2FtcGxlcyA6IFsgeyBwdHM6IHB0cywgZHRzIDogcHRzLCB1bml0IDogaWQzLnBheWxvYWR9IF19LCB0aW1lT2Zmc2V0KTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gIH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBBQUNEZW11eGVyO1xuIiwiLyoqXG4gKiAgQURUUyBwYXJzZXIgaGVscGVyXG4gKi9cbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5cbiBjbGFzcyBBRFRTIHtcblxuICBzdGF0aWMgZ2V0QXVkaW9Db25maWcob2JzZXJ2ZXIsIGRhdGEsIG9mZnNldCwgYXVkaW9Db2RlYykge1xuICAgIHZhciBhZHRzT2JqZWN0VHlwZSwgLy8gOmludFxuICAgICAgICBhZHRzU2FtcGxlaW5nSW5kZXgsIC8vIDppbnRcbiAgICAgICAgYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4LCAvLyA6aW50XG4gICAgICAgIGFkdHNDaGFuZWxDb25maWcsIC8vIDppbnRcbiAgICAgICAgY29uZmlnLFxuICAgICAgICB1c2VyQWdlbnQgPSBuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCksXG4gICAgICAgIGFkdHNTYW1wbGVpbmdSYXRlcyA9IFtcbiAgICAgICAgICAgIDk2MDAwLCA4ODIwMCxcbiAgICAgICAgICAgIDY0MDAwLCA0ODAwMCxcbiAgICAgICAgICAgIDQ0MTAwLCAzMjAwMCxcbiAgICAgICAgICAgIDI0MDAwLCAyMjA1MCxcbiAgICAgICAgICAgIDE2MDAwLCAxMjAwMCxcbiAgICAgICAgICAgIDExMDI1LCA4MDAwLFxuICAgICAgICAgICAgNzM1MF07XG4gICAgLy8gYnl0ZSAyXG4gICAgYWR0c09iamVjdFR5cGUgPSAoKGRhdGFbb2Zmc2V0ICsgMl0gJiAweEMwKSA+Pj4gNikgKyAxO1xuICAgIGFkdHNTYW1wbGVpbmdJbmRleCA9ICgoZGF0YVtvZmZzZXQgKyAyXSAmIDB4M0MpID4+PiAyKTtcbiAgICBpZihhZHRzU2FtcGxlaW5nSW5kZXggPiBhZHRzU2FtcGxlaW5nUmF0ZXMubGVuZ3RoLTEpIHtcbiAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuRlJBR19QQVJTSU5HX0VSUk9SLCBmYXRhbDogdHJ1ZSwgcmVhc29uOiBgaW52YWxpZCBBRFRTIHNhbXBsaW5nIGluZGV4OiR7YWR0c1NhbXBsZWluZ0luZGV4fWB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgYWR0c0NoYW5lbENvbmZpZyA9ICgoZGF0YVtvZmZzZXQgKyAyXSAmIDB4MDEpIDw8IDIpO1xuICAgIC8vIGJ5dGUgM1xuICAgIGFkdHNDaGFuZWxDb25maWcgfD0gKChkYXRhW29mZnNldCArIDNdICYgMHhDMCkgPj4+IDYpO1xuICAgIGxvZ2dlci5sb2coYG1hbmlmZXN0IGNvZGVjOiR7YXVkaW9Db2RlY30sQURUUyBkYXRhOnR5cGU6JHthZHRzT2JqZWN0VHlwZX0sc2FtcGxlaW5nSW5kZXg6JHthZHRzU2FtcGxlaW5nSW5kZXh9WyR7YWR0c1NhbXBsZWluZ1JhdGVzW2FkdHNTYW1wbGVpbmdJbmRleF19SHpdLGNoYW5uZWxDb25maWc6JHthZHRzQ2hhbmVsQ29uZmlnfWApO1xuICAgIC8vIGZpcmVmb3g6IGZyZXEgbGVzcyB0aGFuIDI0a0h6ID0gQUFDIFNCUiAoSEUtQUFDKVxuICAgIGlmICh1c2VyQWdlbnQuaW5kZXhPZignZmlyZWZveCcpICE9PSAtMSkge1xuICAgICAgaWYgKGFkdHNTYW1wbGVpbmdJbmRleCA+PSA2KSB7XG4gICAgICAgIGFkdHNPYmplY3RUeXBlID0gNTtcbiAgICAgICAgY29uZmlnID0gbmV3IEFycmF5KDQpO1xuICAgICAgICAvLyBIRS1BQUMgdXNlcyBTQlIgKFNwZWN0cmFsIEJhbmQgUmVwbGljYXRpb24pICwgaGlnaCBmcmVxdWVuY2llcyBhcmUgY29uc3RydWN0ZWQgZnJvbSBsb3cgZnJlcXVlbmNpZXNcbiAgICAgICAgLy8gdGhlcmUgaXMgYSBmYWN0b3IgMiBiZXR3ZWVuIGZyYW1lIHNhbXBsZSByYXRlIGFuZCBvdXRwdXQgc2FtcGxlIHJhdGVcbiAgICAgICAgLy8gbXVsdGlwbHkgZnJlcXVlbmN5IGJ5IDIgKHNlZSB0YWJsZSBiZWxvdywgZXF1aXZhbGVudCB0byBzdWJzdHJhY3QgMylcbiAgICAgICAgYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ID0gYWR0c1NhbXBsZWluZ0luZGV4IC0gMztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGFkdHNPYmplY3RUeXBlID0gMjtcbiAgICAgICAgY29uZmlnID0gbmV3IEFycmF5KDIpO1xuICAgICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggPSBhZHRzU2FtcGxlaW5nSW5kZXg7XG4gICAgICB9XG4gICAgICAvLyBBbmRyb2lkIDogYWx3YXlzIHVzZSBBQUNcbiAgICB9IGVsc2UgaWYgKHVzZXJBZ2VudC5pbmRleE9mKCdhbmRyb2lkJykgIT09IC0xKSB7XG4gICAgICBhZHRzT2JqZWN0VHlwZSA9IDI7XG4gICAgICBjb25maWcgPSBuZXcgQXJyYXkoMik7XG4gICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggPSBhZHRzU2FtcGxlaW5nSW5kZXg7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8qICBmb3Igb3RoZXIgYnJvd3NlcnMgKGNocm9tZSAuLi4pXG4gICAgICAgICAgYWx3YXlzIGZvcmNlIGF1ZGlvIHR5cGUgdG8gYmUgSEUtQUFDIFNCUiwgYXMgc29tZSBicm93c2VycyBkbyBub3Qgc3VwcG9ydCBhdWRpbyBjb2RlYyBzd2l0Y2ggcHJvcGVybHkgKGxpa2UgQ2hyb21lIC4uLilcbiAgICAgICovXG4gICAgICBhZHRzT2JqZWN0VHlwZSA9IDU7XG4gICAgICBjb25maWcgPSBuZXcgQXJyYXkoNCk7XG4gICAgICAvLyBpZiAobWFuaWZlc3QgY29kZWMgaXMgSEUtQUFDIG9yIEhFLUFBQ3YyKSBPUiAobWFuaWZlc3QgY29kZWMgbm90IHNwZWNpZmllZCBBTkQgZnJlcXVlbmN5IGxlc3MgdGhhbiAyNGtIeilcbiAgICAgIGlmICgoYXVkaW9Db2RlYyAmJiAoKGF1ZGlvQ29kZWMuaW5kZXhPZignbXA0YS40MC4yOScpICE9PSAtMSkgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgKGF1ZGlvQ29kZWMuaW5kZXhPZignbXA0YS40MC41JykgIT09IC0xKSkpIHx8XG4gICAgICAgICAgKCFhdWRpb0NvZGVjICYmIGFkdHNTYW1wbGVpbmdJbmRleCA+PSA2KSkge1xuICAgICAgICAvLyBIRS1BQUMgdXNlcyBTQlIgKFNwZWN0cmFsIEJhbmQgUmVwbGljYXRpb24pICwgaGlnaCBmcmVxdWVuY2llcyBhcmUgY29uc3RydWN0ZWQgZnJvbSBsb3cgZnJlcXVlbmNpZXNcbiAgICAgICAgLy8gdGhlcmUgaXMgYSBmYWN0b3IgMiBiZXR3ZWVuIGZyYW1lIHNhbXBsZSByYXRlIGFuZCBvdXRwdXQgc2FtcGxlIHJhdGVcbiAgICAgICAgLy8gbXVsdGlwbHkgZnJlcXVlbmN5IGJ5IDIgKHNlZSB0YWJsZSBiZWxvdywgZXF1aXZhbGVudCB0byBzdWJzdHJhY3QgMylcbiAgICAgICAgYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ID0gYWR0c1NhbXBsZWluZ0luZGV4IC0gMztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGlmIChtYW5pZmVzdCBjb2RlYyBpcyBBQUMpIEFORCAoZnJlcXVlbmN5IGxlc3MgdGhhbiAyNGtIeiBPUiBuYiBjaGFubmVsIGlzIDEpIE9SIChtYW5pZmVzdCBjb2RlYyBub3Qgc3BlY2lmaWVkIGFuZCBtb25vIGF1ZGlvKVxuICAgICAgICAvLyBDaHJvbWUgZmFpbHMgdG8gcGxheSBiYWNrIHdpdGggQUFDIExDIG1vbm8gd2hlbiBpbml0aWFsaXplZCB3aXRoIEhFLUFBQy4gIFRoaXMgaXMgbm90IGEgcHJvYmxlbSB3aXRoIHN0ZXJlby5cbiAgICAgICAgaWYgKGF1ZGlvQ29kZWMgJiYgYXVkaW9Db2RlYy5pbmRleE9mKCdtcDRhLjQwLjInKSAhPT0gLTEgJiYgKGFkdHNTYW1wbGVpbmdJbmRleCA+PSA2IHx8IGFkdHNDaGFuZWxDb25maWcgPT09IDEpIHx8XG4gICAgICAgICAgICAoIWF1ZGlvQ29kZWMgJiYgYWR0c0NoYW5lbENvbmZpZyA9PT0gMSkpIHtcbiAgICAgICAgICBhZHRzT2JqZWN0VHlwZSA9IDI7XG4gICAgICAgICAgY29uZmlnID0gbmV3IEFycmF5KDIpO1xuICAgICAgICB9XG4gICAgICAgIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCA9IGFkdHNTYW1wbGVpbmdJbmRleDtcbiAgICAgIH1cbiAgICB9XG4gICAgLyogcmVmZXIgdG8gaHR0cDovL3dpa2kubXVsdGltZWRpYS5jeC9pbmRleC5waHA/dGl0bGU9TVBFRy00X0F1ZGlvI0F1ZGlvX1NwZWNpZmljX0NvbmZpZ1xuICAgICAgICBJU08gMTQ0OTYtMyAoQUFDKS5wZGYgLSBUYWJsZSAxLjEzIOKAlCBTeW50YXggb2YgQXVkaW9TcGVjaWZpY0NvbmZpZygpXG4gICAgICBBdWRpbyBQcm9maWxlIC8gQXVkaW8gT2JqZWN0IFR5cGVcbiAgICAgIDA6IE51bGxcbiAgICAgIDE6IEFBQyBNYWluXG4gICAgICAyOiBBQUMgTEMgKExvdyBDb21wbGV4aXR5KVxuICAgICAgMzogQUFDIFNTUiAoU2NhbGFibGUgU2FtcGxlIFJhdGUpXG4gICAgICA0OiBBQUMgTFRQIChMb25nIFRlcm0gUHJlZGljdGlvbilcbiAgICAgIDU6IFNCUiAoU3BlY3RyYWwgQmFuZCBSZXBsaWNhdGlvbilcbiAgICAgIDY6IEFBQyBTY2FsYWJsZVxuICAgICBzYW1wbGluZyBmcmVxXG4gICAgICAwOiA5NjAwMCBIelxuICAgICAgMTogODgyMDAgSHpcbiAgICAgIDI6IDY0MDAwIEh6XG4gICAgICAzOiA0ODAwMCBIelxuICAgICAgNDogNDQxMDAgSHpcbiAgICAgIDU6IDMyMDAwIEh6XG4gICAgICA2OiAyNDAwMCBIelxuICAgICAgNzogMjIwNTAgSHpcbiAgICAgIDg6IDE2MDAwIEh6XG4gICAgICA5OiAxMjAwMCBIelxuICAgICAgMTA6IDExMDI1IEh6XG4gICAgICAxMTogODAwMCBIelxuICAgICAgMTI6IDczNTAgSHpcbiAgICAgIDEzOiBSZXNlcnZlZFxuICAgICAgMTQ6IFJlc2VydmVkXG4gICAgICAxNTogZnJlcXVlbmN5IGlzIHdyaXR0ZW4gZXhwbGljdGx5XG4gICAgICBDaGFubmVsIENvbmZpZ3VyYXRpb25zXG4gICAgICBUaGVzZSBhcmUgdGhlIGNoYW5uZWwgY29uZmlndXJhdGlvbnM6XG4gICAgICAwOiBEZWZpbmVkIGluIEFPVCBTcGVjaWZjIENvbmZpZ1xuICAgICAgMTogMSBjaGFubmVsOiBmcm9udC1jZW50ZXJcbiAgICAgIDI6IDIgY2hhbm5lbHM6IGZyb250LWxlZnQsIGZyb250LXJpZ2h0XG4gICAgKi9cbiAgICAvLyBhdWRpb09iamVjdFR5cGUgPSBwcm9maWxlID0+IHByb2ZpbGUsIHRoZSBNUEVHLTQgQXVkaW8gT2JqZWN0IFR5cGUgbWludXMgMVxuICAgIGNvbmZpZ1swXSA9IGFkdHNPYmplY3RUeXBlIDw8IDM7XG4gICAgLy8gc2FtcGxpbmdGcmVxdWVuY3lJbmRleFxuICAgIGNvbmZpZ1swXSB8PSAoYWR0c1NhbXBsZWluZ0luZGV4ICYgMHgwRSkgPj4gMTtcbiAgICBjb25maWdbMV0gfD0gKGFkdHNTYW1wbGVpbmdJbmRleCAmIDB4MDEpIDw8IDc7XG4gICAgLy8gY2hhbm5lbENvbmZpZ3VyYXRpb25cbiAgICBjb25maWdbMV0gfD0gYWR0c0NoYW5lbENvbmZpZyA8PCAzO1xuICAgIGlmIChhZHRzT2JqZWN0VHlwZSA9PT0gNSkge1xuICAgICAgLy8gYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4XG4gICAgICBjb25maWdbMV0gfD0gKGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCAmIDB4MEUpID4+IDE7XG4gICAgICBjb25maWdbMl0gPSAoYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ICYgMHgwMSkgPDwgNztcbiAgICAgIC8vIGFkdHNPYmplY3RUeXBlIChmb3JjZSB0byAyLCBjaHJvbWUgaXMgY2hlY2tpbmcgdGhhdCBvYmplY3QgdHlwZSBpcyBsZXNzIHRoYW4gNSA/Pz9cbiAgICAgIC8vICAgIGh0dHBzOi8vY2hyb21pdW0uZ29vZ2xlc291cmNlLmNvbS9jaHJvbWl1bS9zcmMuZ2l0LysvbWFzdGVyL21lZGlhL2Zvcm1hdHMvbXA0L2FhYy5jY1xuICAgICAgY29uZmlnWzJdIHw9IDIgPDwgMjtcbiAgICAgIGNvbmZpZ1szXSA9IDA7XG4gICAgfVxuICAgIHJldHVybiB7Y29uZmlnOiBjb25maWcsIHNhbXBsZXJhdGU6IGFkdHNTYW1wbGVpbmdSYXRlc1thZHRzU2FtcGxlaW5nSW5kZXhdLCBjaGFubmVsQ291bnQ6IGFkdHNDaGFuZWxDb25maWcsIGNvZGVjOiAoJ21wNGEuNDAuJyArIGFkdHNPYmplY3RUeXBlKX07XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQURUUztcbiIsIi8qICBpbmxpbmUgZGVtdXhlci5cbiAqICAgcHJvYmUgZnJhZ21lbnRzIGFuZCBpbnN0YW50aWF0ZSBhcHByb3ByaWF0ZSBkZW11eGVyIGRlcGVuZGluZyBvbiBjb250ZW50IHR5cGUgKFRTRGVtdXhlciwgQUFDRGVtdXhlciwgLi4uKVxuICovXG5cbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5pbXBvcnQgQUFDRGVtdXhlciBmcm9tICcuLi9kZW11eC9hYWNkZW11eGVyJztcbmltcG9ydCBUU0RlbXV4ZXIgZnJvbSAnLi4vZGVtdXgvdHNkZW11eGVyJztcblxuY2xhc3MgRGVtdXhlcklubGluZSB7XG5cbiAgY29uc3RydWN0b3IoaGxzLHJlbXV4ZXIpIHtcbiAgICB0aGlzLmhscyA9IGhscztcbiAgICB0aGlzLnJlbXV4ZXIgPSByZW11eGVyO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB2YXIgZGVtdXhlciA9IHRoaXMuZGVtdXhlcjtcbiAgICBpZiAoZGVtdXhlcikge1xuICAgICAgZGVtdXhlci5kZXN0cm95KCk7XG4gICAgfVxuICB9XG5cbiAgcHVzaChkYXRhLCBhdWRpb0NvZGVjLCB2aWRlb0NvZGVjLCB0aW1lT2Zmc2V0LCBjYywgbGV2ZWwsIHNuLCBkdXJhdGlvbikge1xuICAgIHZhciBkZW11eGVyID0gdGhpcy5kZW11eGVyO1xuICAgIGlmICghZGVtdXhlcikge1xuICAgICAgLy8gcHJvYmUgZm9yIGNvbnRlbnQgdHlwZVxuICAgICAgaWYgKFRTRGVtdXhlci5wcm9iZShkYXRhKSkge1xuICAgICAgICBkZW11eGVyID0gdGhpcy5kZW11eGVyID0gbmV3IFRTRGVtdXhlcih0aGlzLmhscyx0aGlzLnJlbXV4ZXIpO1xuICAgICAgfSBlbHNlIGlmKEFBQ0RlbXV4ZXIucHJvYmUoZGF0YSkpIHtcbiAgICAgICAgZGVtdXhlciA9IHRoaXMuZGVtdXhlciA9IG5ldyBBQUNEZW11eGVyKHRoaXMuaGxzLHRoaXMucmVtdXhlcik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZSA6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5GUkFHX1BBUlNJTkdfRVJST1IsIGZhdGFsOiB0cnVlLCByZWFzb246ICdubyBkZW11eCBtYXRjaGluZyB3aXRoIGNvbnRlbnQgZm91bmQnfSk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gICAgZGVtdXhlci5wdXNoKGRhdGEsYXVkaW9Db2RlYyx2aWRlb0NvZGVjLHRpbWVPZmZzZXQsY2MsbGV2ZWwsc24sZHVyYXRpb24pO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IERlbXV4ZXJJbmxpbmU7XG4iLCIvKiBkZW11eGVyIHdlYiB3b3JrZXIuXG4gKiAgLSBsaXN0ZW4gdG8gd29ya2VyIG1lc3NhZ2UsIGFuZCB0cmlnZ2VyIERlbXV4ZXJJbmxpbmUgdXBvbiByZWNlcHRpb24gb2YgRnJhZ21lbnRzLlxuICogIC0gcHJvdmlkZXMgTVA0IEJveGVzIGJhY2sgdG8gbWFpbiB0aHJlYWQgdXNpbmcgW3RyYW5zZmVyYWJsZSBvYmplY3RzXShodHRwczovL2RldmVsb3BlcnMuZ29vZ2xlLmNvbS93ZWIvdXBkYXRlcy8yMDExLzEyL1RyYW5zZmVyYWJsZS1PYmplY3RzLUxpZ2h0bmluZy1GYXN0KSBpbiBvcmRlciB0byBtaW5pbWl6ZSBtZXNzYWdlIHBhc3Npbmcgb3ZlcmhlYWQuXG4gKi9cblxuIGltcG9ydCBEZW11eGVySW5saW5lIGZyb20gJy4uL2RlbXV4L2RlbXV4ZXItaW5saW5lJztcbiBpbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbiBpbXBvcnQgRXZlbnRFbWl0dGVyIGZyb20gJ2V2ZW50cyc7XG4gaW1wb3J0IE1QNFJlbXV4ZXIgZnJvbSAnLi4vcmVtdXgvbXA0LXJlbXV4ZXInO1xuXG52YXIgRGVtdXhlcldvcmtlciA9IGZ1bmN0aW9uIChzZWxmKSB7XG4gIC8vIG9ic2VydmVyIHNldHVwXG4gIHZhciBvYnNlcnZlciA9IG5ldyBFdmVudEVtaXR0ZXIoKTtcbiAgb2JzZXJ2ZXIudHJpZ2dlciA9IGZ1bmN0aW9uIHRyaWdnZXIgKGV2ZW50LCAuLi5kYXRhKSB7XG4gICAgb2JzZXJ2ZXIuZW1pdChldmVudCwgZXZlbnQsIC4uLmRhdGEpO1xuICB9O1xuXG4gIG9ic2VydmVyLm9mZiA9IGZ1bmN0aW9uIG9mZiAoZXZlbnQsIC4uLmRhdGEpIHtcbiAgICBvYnNlcnZlci5yZW1vdmVMaXN0ZW5lcihldmVudCwgLi4uZGF0YSk7XG4gIH07XG4gIHNlbGYuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGZ1bmN0aW9uIChldikge1xuICAgIC8vY29uc29sZS5sb2coJ2RlbXV4ZXIgY21kOicgKyBldi5kYXRhLmNtZCk7XG4gICAgc3dpdGNoIChldi5kYXRhLmNtZCkge1xuICAgICAgY2FzZSAnaW5pdCc6XG4gICAgICAgIHNlbGYuZGVtdXhlciA9IG5ldyBEZW11eGVySW5saW5lKG9ic2VydmVyLE1QNFJlbXV4ZXIpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ2RlbXV4JzpcbiAgICAgICAgdmFyIGRhdGEgPSBldi5kYXRhO1xuICAgICAgICBzZWxmLmRlbXV4ZXIucHVzaChuZXcgVWludDhBcnJheShkYXRhLmRhdGEpLCBkYXRhLmF1ZGlvQ29kZWMsIGRhdGEudmlkZW9Db2RlYywgZGF0YS50aW1lT2Zmc2V0LCBkYXRhLmNjLCBkYXRhLmxldmVsLCBkYXRhLnNuLCBkYXRhLmR1cmF0aW9uKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBicmVhaztcbiAgICB9XG4gIH0pO1xuXG4gIC8vIGxpc3RlbiB0byBldmVudHMgdHJpZ2dlcmVkIGJ5IFRTIERlbXV4ZXJcbiAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCwgZnVuY3Rpb24oZXYsIGRhdGEpIHtcbiAgICB2YXIgb2JqRGF0YSA9IHtldmVudDogZXZ9O1xuICAgIHZhciBvYmpUcmFuc2ZlcmFibGUgPSBbXTtcbiAgICBpZiAoZGF0YS5hdWRpb0NvZGVjKSB7XG4gICAgICBvYmpEYXRhLmF1ZGlvQ29kZWMgPSBkYXRhLmF1ZGlvQ29kZWM7XG4gICAgICBvYmpEYXRhLmF1ZGlvTW9vdiA9IGRhdGEuYXVkaW9Nb292LmJ1ZmZlcjtcbiAgICAgIG9iakRhdGEuYXVkaW9DaGFubmVsQ291bnQgPSBkYXRhLmF1ZGlvQ2hhbm5lbENvdW50O1xuICAgICAgb2JqVHJhbnNmZXJhYmxlLnB1c2gob2JqRGF0YS5hdWRpb01vb3YpO1xuICAgIH1cbiAgICBpZiAoZGF0YS52aWRlb0NvZGVjKSB7XG4gICAgICBvYmpEYXRhLnZpZGVvQ29kZWMgPSBkYXRhLnZpZGVvQ29kZWM7XG4gICAgICBvYmpEYXRhLnZpZGVvTW9vdiA9IGRhdGEudmlkZW9Nb292LmJ1ZmZlcjtcbiAgICAgIG9iakRhdGEudmlkZW9XaWR0aCA9IGRhdGEudmlkZW9XaWR0aDtcbiAgICAgIG9iakRhdGEudmlkZW9IZWlnaHQgPSBkYXRhLnZpZGVvSGVpZ2h0O1xuICAgICAgb2JqVHJhbnNmZXJhYmxlLnB1c2gob2JqRGF0YS52aWRlb01vb3YpO1xuICAgIH1cbiAgICAvLyBwYXNzIG1vb3YgYXMgdHJhbnNmZXJhYmxlIG9iamVjdCAobm8gY29weSlcbiAgICBzZWxmLnBvc3RNZXNzYWdlKG9iakRhdGEsb2JqVHJhbnNmZXJhYmxlKTtcbiAgfSk7XG5cbiAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19QQVJTSU5HX0RBVEEsIGZ1bmN0aW9uKGV2LCBkYXRhKSB7XG4gICAgdmFyIG9iakRhdGEgPSB7ZXZlbnQ6IGV2LCB0eXBlOiBkYXRhLnR5cGUsIHN0YXJ0UFRTOiBkYXRhLnN0YXJ0UFRTLCBlbmRQVFM6IGRhdGEuZW5kUFRTLCBzdGFydERUUzogZGF0YS5zdGFydERUUywgZW5kRFRTOiBkYXRhLmVuZERUUywgbW9vZjogZGF0YS5tb29mLmJ1ZmZlciwgbWRhdDogZGF0YS5tZGF0LmJ1ZmZlciwgbmI6IGRhdGEubmJ9O1xuICAgIC8vIHBhc3MgbW9vZi9tZGF0IGRhdGEgYXMgdHJhbnNmZXJhYmxlIG9iamVjdCAobm8gY29weSlcbiAgICBzZWxmLnBvc3RNZXNzYWdlKG9iakRhdGEsIFtvYmpEYXRhLm1vb2YsIG9iakRhdGEubWRhdF0pO1xuICB9KTtcblxuICBvYnNlcnZlci5vbihFdmVudC5GUkFHX1BBUlNFRCwgZnVuY3Rpb24oZXZlbnQpIHtcbiAgICBzZWxmLnBvc3RNZXNzYWdlKHtldmVudDogZXZlbnR9KTtcbiAgfSk7XG5cbiAgb2JzZXJ2ZXIub24oRXZlbnQuRVJST1IsIGZ1bmN0aW9uKGV2ZW50LCBkYXRhKSB7XG4gICAgc2VsZi5wb3N0TWVzc2FnZSh7ZXZlbnQ6IGV2ZW50LCBkYXRhOiBkYXRhfSk7XG4gIH0pO1xuXG4gIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0lOR19NRVRBREFUQSwgZnVuY3Rpb24oZXZlbnQsIGRhdGEpIHtcbiAgICB2YXIgb2JqRGF0YSA9IHtldmVudDogZXZlbnQsIHNhbXBsZXM6IGRhdGEuc2FtcGxlc307XG4gICAgc2VsZi5wb3N0TWVzc2FnZShvYmpEYXRhKTtcbiAgfSk7XG5cbiAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19QQVJTSU5HX1VTRVJEQVRBLCBmdW5jdGlvbihldmVudCwgZGF0YSkge1xuICAgIHZhciBvYmpEYXRhID0ge2V2ZW50OiBldmVudCwgc2FtcGxlczogZGF0YS5zYW1wbGVzfTtcbiAgICBzZWxmLnBvc3RNZXNzYWdlKG9iakRhdGEpO1xuICB9KTtcblxufTtcblxuZXhwb3J0IGRlZmF1bHQgRGVtdXhlcldvcmtlcjtcblxuIiwiaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgRGVtdXhlcklubGluZSBmcm9tICcuLi9kZW11eC9kZW11eGVyLWlubGluZSc7XG5pbXBvcnQgRGVtdXhlcldvcmtlciBmcm9tICcuLi9kZW11eC9kZW11eGVyLXdvcmtlcic7XG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCBNUDRSZW11eGVyIGZyb20gJy4uL3JlbXV4L21wNC1yZW11eGVyJztcbmltcG9ydCBEZWNyeXB0ZXIgZnJvbSAnLi4vY3J5cHQvZGVjcnlwdGVyJztcblxuY2xhc3MgRGVtdXhlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgdGhpcy5obHMgPSBobHM7XG4gICAgaWYgKGhscy5jb25maWcuZW5hYmxlV29ya2VyICYmICh0eXBlb2YoV29ya2VyKSAhPT0gJ3VuZGVmaW5lZCcpKSB7XG4gICAgICAgIGxvZ2dlci5sb2coJ2RlbXV4aW5nIGluIHdlYndvcmtlcicpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHZhciB3b3JrID0gcmVxdWlyZSgnd2Vid29ya2lmeScpO1xuICAgICAgICAgIHRoaXMudyA9IHdvcmsoRGVtdXhlcldvcmtlcik7XG4gICAgICAgICAgdGhpcy5vbndtc2cgPSB0aGlzLm9uV29ya2VyTWVzc2FnZS5iaW5kKHRoaXMpO1xuICAgICAgICAgIHRoaXMudy5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgdGhpcy5vbndtc2cpO1xuICAgICAgICAgIHRoaXMudy5wb3N0TWVzc2FnZSh7Y21kOiAnaW5pdCd9KTtcbiAgICAgICAgfSBjYXRjaChlcnIpIHtcbiAgICAgICAgICBsb2dnZXIuZXJyb3IoJ2Vycm9yIHdoaWxlIGluaXRpYWxpemluZyBEZW11eGVyV29ya2VyLCBmYWxsYmFjayBvbiBEZW11eGVySW5saW5lJyk7XG4gICAgICAgICAgdGhpcy5kZW11eGVyID0gbmV3IERlbXV4ZXJJbmxpbmUoaGxzLE1QNFJlbXV4ZXIpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmRlbXV4ZXIgPSBuZXcgRGVtdXhlcklubGluZShobHMsTVA0UmVtdXhlcik7XG4gICAgICB9XG4gICAgICB0aGlzLmRlbXV4SW5pdGlhbGl6ZWQgPSB0cnVlO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBpZiAodGhpcy53KSB7XG4gICAgICB0aGlzLncucmVtb3ZlRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIHRoaXMub253bXNnKTtcbiAgICAgIHRoaXMudy50ZXJtaW5hdGUoKTtcbiAgICAgIHRoaXMudyA9IG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZGVtdXhlci5kZXN0cm95KCk7XG4gICAgICB0aGlzLmRlbXV4ZXIgPSBudWxsO1xuICAgIH1cbiAgICBpZiAodGhpcy5kZWNyeXB0ZXIpIHtcbiAgICAgIHRoaXMuZGVjcnlwdGVyLmRlc3Ryb3koKTtcbiAgICAgIHRoaXMuZGVjcnlwdGVyID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICBwdXNoRGVjcnlwdGVkKGRhdGEsIGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQsIGNjLCBsZXZlbCwgc24sIGR1cmF0aW9uKSB7XG4gICAgaWYgKHRoaXMudykge1xuICAgICAgLy8gcG9zdCBmcmFnbWVudCBwYXlsb2FkIGFzIHRyYW5zZmVyYWJsZSBvYmplY3RzIChubyBjb3B5KVxuICAgICAgdGhpcy53LnBvc3RNZXNzYWdlKHtjbWQ6ICdkZW11eCcsIGRhdGE6IGRhdGEsIGF1ZGlvQ29kZWM6IGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWM6IHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQ6IHRpbWVPZmZzZXQsIGNjOiBjYywgbGV2ZWw6IGxldmVsLCBzbiA6IHNuLCBkdXJhdGlvbjogZHVyYXRpb259LCBbZGF0YV0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRlbXV4ZXIucHVzaChuZXcgVWludDhBcnJheShkYXRhKSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCwgY2MsIGxldmVsLCBzbiwgZHVyYXRpb24pO1xuICAgIH1cbiAgfVxuXG4gIHB1c2goZGF0YSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCwgY2MsIGxldmVsLCBzbiwgZHVyYXRpb24sIGRlY3J5cHRkYXRhKSB7XG4gICAgaWYgKChkYXRhLmJ5dGVMZW5ndGggPiAwKSAmJiAoZGVjcnlwdGRhdGEgIT0gbnVsbCkgJiYgKGRlY3J5cHRkYXRhLmtleSAhPSBudWxsKSAmJiAoZGVjcnlwdGRhdGEubWV0aG9kID09PSAnQUVTLTEyOCcpKSB7XG4gICAgICBpZiAodGhpcy5kZWNyeXB0ZXIgPT0gbnVsbCkge1xuICAgICAgICB0aGlzLmRlY3J5cHRlciA9IG5ldyBEZWNyeXB0ZXIodGhpcy5obHMpO1xuICAgICAgfVxuICAgICAgXG4gICAgICB2YXIgbG9jYWx0aGlzID0gdGhpcztcbiAgICAgIHRoaXMuZGVjcnlwdGVyLmRlY3J5cHQoZGF0YSwgZGVjcnlwdGRhdGEua2V5LCBkZWNyeXB0ZGF0YS5pdiwgZnVuY3Rpb24oZGVjcnlwdGVkRGF0YSl7XG4gICAgICAgIGxvY2FsdGhpcy5wdXNoRGVjcnlwdGVkKGRlY3J5cHRlZERhdGEsIGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQsIGNjLCBsZXZlbCwgc24sIGR1cmF0aW9uKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnB1c2hEZWNyeXB0ZWQoZGF0YSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCwgY2MsIGxldmVsLCBzbiwgZHVyYXRpb24pO1xuICAgIH1cbiAgfVxuXG4gIG9uV29ya2VyTWVzc2FnZShldikge1xuICAgIC8vY29uc29sZS5sb2coJ29uV29ya2VyTWVzc2FnZTonICsgZXYuZGF0YS5ldmVudCk7XG4gICAgc3dpdGNoKGV2LmRhdGEuZXZlbnQpIHtcbiAgICAgIGNhc2UgRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVDpcbiAgICAgICAgdmFyIG9iaiA9IHt9O1xuICAgICAgICBpZiAoZXYuZGF0YS5hdWRpb01vb3YpIHtcbiAgICAgICAgICBvYmouYXVkaW9Nb292ID0gbmV3IFVpbnQ4QXJyYXkoZXYuZGF0YS5hdWRpb01vb3YpO1xuICAgICAgICAgIG9iai5hdWRpb0NvZGVjID0gZXYuZGF0YS5hdWRpb0NvZGVjO1xuICAgICAgICAgIG9iai5hdWRpb0NoYW5uZWxDb3VudCA9IGV2LmRhdGEuYXVkaW9DaGFubmVsQ291bnQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGV2LmRhdGEudmlkZW9Nb292KSB7XG4gICAgICAgICAgb2JqLnZpZGVvTW9vdiA9IG5ldyBVaW50OEFycmF5KGV2LmRhdGEudmlkZW9Nb292KTtcbiAgICAgICAgICBvYmoudmlkZW9Db2RlYyA9IGV2LmRhdGEudmlkZW9Db2RlYztcbiAgICAgICAgICBvYmoudmlkZW9XaWR0aCA9IGV2LmRhdGEudmlkZW9XaWR0aDtcbiAgICAgICAgICBvYmoudmlkZW9IZWlnaHQgPSBldi5kYXRhLnZpZGVvSGVpZ2h0O1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCwgb2JqKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBOlxuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLHtcbiAgICAgICAgICBtb29mOiBuZXcgVWludDhBcnJheShldi5kYXRhLm1vb2YpLFxuICAgICAgICAgIG1kYXQ6IG5ldyBVaW50OEFycmF5KGV2LmRhdGEubWRhdCksXG4gICAgICAgICAgc3RhcnRQVFM6IGV2LmRhdGEuc3RhcnRQVFMsXG4gICAgICAgICAgZW5kUFRTOiBldi5kYXRhLmVuZFBUUyxcbiAgICAgICAgICBzdGFydERUUzogZXYuZGF0YS5zdGFydERUUyxcbiAgICAgICAgICBlbmREVFM6IGV2LmRhdGEuZW5kRFRTLFxuICAgICAgICAgIHR5cGU6IGV2LmRhdGEudHlwZSxcbiAgICAgICAgICBuYjogZXYuZGF0YS5uYlxuICAgICAgICB9KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgRXZlbnQuRlJBR19QQVJTSU5HX01FVEFEQVRBOlxuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19NRVRBREFUQSwge1xuICAgICAgICAgIHNhbXBsZXM6IGV2LmRhdGEuc2FtcGxlc1xuICAgICAgICB9KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgRXZlbnQuRlJBR19QQVJTSU5HX1VTRVJEQVRBOlxuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19VU0VSREFUQSwge1xuICAgICAgICAgIHNhbXBsZXM6IGV2LmRhdGEuc2FtcGxlc1xuICAgICAgICB9KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKGV2LmRhdGEuZXZlbnQsIGV2LmRhdGEuZGF0YSk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBEZW11eGVyO1xuXG4iLCIvKipcbiAqIFBhcnNlciBmb3IgZXhwb25lbnRpYWwgR29sb21iIGNvZGVzLCBhIHZhcmlhYmxlLWJpdHdpZHRoIG51bWJlciBlbmNvZGluZyBzY2hlbWUgdXNlZCBieSBoMjY0LlxuKi9cblxuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5cbmNsYXNzIEV4cEdvbG9tYiB7XG5cbiAgY29uc3RydWN0b3IoZGF0YSkge1xuICAgIHRoaXMuZGF0YSA9IGRhdGE7XG4gICAgLy8gdGhlIG51bWJlciBvZiBieXRlcyBsZWZ0IHRvIGV4YW1pbmUgaW4gdGhpcy5kYXRhXG4gICAgdGhpcy5ieXRlc0F2YWlsYWJsZSA9IHRoaXMuZGF0YS5ieXRlTGVuZ3RoO1xuICAgIC8vIHRoZSBjdXJyZW50IHdvcmQgYmVpbmcgZXhhbWluZWRcbiAgICB0aGlzLndvcmQgPSAwOyAvLyA6dWludFxuICAgIC8vIHRoZSBudW1iZXIgb2YgYml0cyBsZWZ0IHRvIGV4YW1pbmUgaW4gdGhlIGN1cnJlbnQgd29yZFxuICAgIHRoaXMuYml0c0F2YWlsYWJsZSA9IDA7IC8vIDp1aW50XG4gIH1cblxuICAvLyAoKTp2b2lkXG4gIGxvYWRXb3JkKCkge1xuICAgIHZhclxuICAgICAgcG9zaXRpb24gPSB0aGlzLmRhdGEuYnl0ZUxlbmd0aCAtIHRoaXMuYnl0ZXNBdmFpbGFibGUsXG4gICAgICB3b3JraW5nQnl0ZXMgPSBuZXcgVWludDhBcnJheSg0KSxcbiAgICAgIGF2YWlsYWJsZUJ5dGVzID0gTWF0aC5taW4oNCwgdGhpcy5ieXRlc0F2YWlsYWJsZSk7XG4gICAgaWYgKGF2YWlsYWJsZUJ5dGVzID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ25vIGJ5dGVzIGF2YWlsYWJsZScpO1xuICAgIH1cbiAgICB3b3JraW5nQnl0ZXMuc2V0KHRoaXMuZGF0YS5zdWJhcnJheShwb3NpdGlvbiwgcG9zaXRpb24gKyBhdmFpbGFibGVCeXRlcykpO1xuICAgIHRoaXMud29yZCA9IG5ldyBEYXRhVmlldyh3b3JraW5nQnl0ZXMuYnVmZmVyKS5nZXRVaW50MzIoMCk7XG4gICAgLy8gdHJhY2sgdGhlIGFtb3VudCBvZiB0aGlzLmRhdGEgdGhhdCBoYXMgYmVlbiBwcm9jZXNzZWRcbiAgICB0aGlzLmJpdHNBdmFpbGFibGUgPSBhdmFpbGFibGVCeXRlcyAqIDg7XG4gICAgdGhpcy5ieXRlc0F2YWlsYWJsZSAtPSBhdmFpbGFibGVCeXRlcztcbiAgfVxuXG4gIC8vIChjb3VudDppbnQpOnZvaWRcbiAgc2tpcEJpdHMoY291bnQpIHtcbiAgICB2YXIgc2tpcEJ5dGVzOyAvLyA6aW50XG4gICAgaWYgKHRoaXMuYml0c0F2YWlsYWJsZSA+IGNvdW50KSB7XG4gICAgICB0aGlzLndvcmQgPDw9IGNvdW50O1xuICAgICAgdGhpcy5iaXRzQXZhaWxhYmxlIC09IGNvdW50O1xuICAgIH0gZWxzZSB7XG4gICAgICBjb3VudCAtPSB0aGlzLmJpdHNBdmFpbGFibGU7XG4gICAgICBza2lwQnl0ZXMgPSBjb3VudCA+PiAzO1xuICAgICAgY291bnQgLT0gKHNraXBCeXRlcyA+PiAzKTtcbiAgICAgIHRoaXMuYnl0ZXNBdmFpbGFibGUgLT0gc2tpcEJ5dGVzO1xuICAgICAgdGhpcy5sb2FkV29yZCgpO1xuICAgICAgdGhpcy53b3JkIDw8PSBjb3VudDtcbiAgICAgIHRoaXMuYml0c0F2YWlsYWJsZSAtPSBjb3VudDtcbiAgICB9XG4gIH1cblxuICAvLyAoc2l6ZTppbnQpOnVpbnRcbiAgcmVhZEJpdHMoc2l6ZSkge1xuICAgIHZhclxuICAgICAgYml0cyA9IE1hdGgubWluKHRoaXMuYml0c0F2YWlsYWJsZSwgc2l6ZSksIC8vIDp1aW50XG4gICAgICB2YWx1ID0gdGhpcy53b3JkID4+PiAoMzIgLSBiaXRzKTsgLy8gOnVpbnRcbiAgICBpZiAoc2l6ZSA+IDMyKSB7XG4gICAgICBsb2dnZXIuZXJyb3IoJ0Nhbm5vdCByZWFkIG1vcmUgdGhhbiAzMiBiaXRzIGF0IGEgdGltZScpO1xuICAgIH1cbiAgICB0aGlzLmJpdHNBdmFpbGFibGUgLT0gYml0cztcbiAgICBpZiAodGhpcy5iaXRzQXZhaWxhYmxlID4gMCkge1xuICAgICAgdGhpcy53b3JkIDw8PSBiaXRzO1xuICAgIH0gZWxzZSBpZiAodGhpcy5ieXRlc0F2YWlsYWJsZSA+IDApIHtcbiAgICAgIHRoaXMubG9hZFdvcmQoKTtcbiAgICB9XG4gICAgYml0cyA9IHNpemUgLSBiaXRzO1xuICAgIGlmIChiaXRzID4gMCkge1xuICAgICAgcmV0dXJuIHZhbHUgPDwgYml0cyB8IHRoaXMucmVhZEJpdHMoYml0cyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB2YWx1O1xuICAgIH1cbiAgfVxuXG4gIC8vICgpOnVpbnRcbiAgc2tpcExaKCkge1xuICAgIHZhciBsZWFkaW5nWmVyb0NvdW50OyAvLyA6dWludFxuICAgIGZvciAobGVhZGluZ1plcm9Db3VudCA9IDA7IGxlYWRpbmdaZXJvQ291bnQgPCB0aGlzLmJpdHNBdmFpbGFibGU7ICsrbGVhZGluZ1plcm9Db3VudCkge1xuICAgICAgaWYgKDAgIT09ICh0aGlzLndvcmQgJiAoMHg4MDAwMDAwMCA+Pj4gbGVhZGluZ1plcm9Db3VudCkpKSB7XG4gICAgICAgIC8vIHRoZSBmaXJzdCBiaXQgb2Ygd29ya2luZyB3b3JkIGlzIDFcbiAgICAgICAgdGhpcy53b3JkIDw8PSBsZWFkaW5nWmVyb0NvdW50O1xuICAgICAgICB0aGlzLmJpdHNBdmFpbGFibGUgLT0gbGVhZGluZ1plcm9Db3VudDtcbiAgICAgICAgcmV0dXJuIGxlYWRpbmdaZXJvQ291bnQ7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIHdlIGV4aGF1c3RlZCB3b3JkIGFuZCBzdGlsbCBoYXZlIG5vdCBmb3VuZCBhIDFcbiAgICB0aGlzLmxvYWRXb3JkKCk7XG4gICAgcmV0dXJuIGxlYWRpbmdaZXJvQ291bnQgKyB0aGlzLnNraXBMWigpO1xuICB9XG5cbiAgLy8gKCk6dm9pZFxuICBza2lwVUVHKCkge1xuICAgIHRoaXMuc2tpcEJpdHMoMSArIHRoaXMuc2tpcExaKCkpO1xuICB9XG5cbiAgLy8gKCk6dm9pZFxuICBza2lwRUcoKSB7XG4gICAgdGhpcy5za2lwQml0cygxICsgdGhpcy5za2lwTFooKSk7XG4gIH1cblxuICAvLyAoKTp1aW50XG4gIHJlYWRVRUcoKSB7XG4gICAgdmFyIGNseiA9IHRoaXMuc2tpcExaKCk7IC8vIDp1aW50XG4gICAgcmV0dXJuIHRoaXMucmVhZEJpdHMoY2x6ICsgMSkgLSAxO1xuICB9XG5cbiAgLy8gKCk6aW50XG4gIHJlYWRFRygpIHtcbiAgICB2YXIgdmFsdSA9IHRoaXMucmVhZFVFRygpOyAvLyA6aW50XG4gICAgaWYgKDB4MDEgJiB2YWx1KSB7XG4gICAgICAvLyB0aGUgbnVtYmVyIGlzIG9kZCBpZiB0aGUgbG93IG9yZGVyIGJpdCBpcyBzZXRcbiAgICAgIHJldHVybiAoMSArIHZhbHUpID4+PiAxOyAvLyBhZGQgMSB0byBtYWtlIGl0IGV2ZW4sIGFuZCBkaXZpZGUgYnkgMlxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gLTEgKiAodmFsdSA+Pj4gMSk7IC8vIGRpdmlkZSBieSB0d28gdGhlbiBtYWtlIGl0IG5lZ2F0aXZlXG4gICAgfVxuICB9XG5cbiAgLy8gU29tZSBjb252ZW5pZW5jZSBmdW5jdGlvbnNcbiAgLy8gOkJvb2xlYW5cbiAgcmVhZEJvb2xlYW4oKSB7XG4gICAgcmV0dXJuIDEgPT09IHRoaXMucmVhZEJpdHMoMSk7XG4gIH1cblxuICAvLyAoKTppbnRcbiAgcmVhZFVCeXRlKCkge1xuICAgIHJldHVybiB0aGlzLnJlYWRCaXRzKDgpO1xuICB9XG5cbiAgLy8gKCk6aW50XG4gIHJlYWRVU2hvcnQoKSB7XG4gICAgcmV0dXJuIHRoaXMucmVhZEJpdHMoMTYpO1xuICB9XG4gICAgLy8gKCk6aW50XG4gIHJlYWRVSW50KCkge1xuICAgIHJldHVybiB0aGlzLnJlYWRCaXRzKDMyKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZHZhbmNlIHRoZSBFeHBHb2xvbWIgZGVjb2RlciBwYXN0IGEgc2NhbGluZyBsaXN0LiBUaGUgc2NhbGluZ1xuICAgKiBsaXN0IGlzIG9wdGlvbmFsbHkgdHJhbnNtaXR0ZWQgYXMgcGFydCBvZiBhIHNlcXVlbmNlIHBhcmFtZXRlclxuICAgKiBzZXQgYW5kIGlzIG5vdCByZWxldmFudCB0byB0cmFuc211eGluZy5cbiAgICogQHBhcmFtIGNvdW50IHtudW1iZXJ9IHRoZSBudW1iZXIgb2YgZW50cmllcyBpbiB0aGlzIHNjYWxpbmcgbGlzdFxuICAgKiBAc2VlIFJlY29tbWVuZGF0aW9uIElUVS1UIEguMjY0LCBTZWN0aW9uIDcuMy4yLjEuMS4xXG4gICAqL1xuICBza2lwU2NhbGluZ0xpc3QoY291bnQpIHtcbiAgICB2YXJcbiAgICAgIGxhc3RTY2FsZSA9IDgsXG4gICAgICBuZXh0U2NhbGUgPSA4LFxuICAgICAgaixcbiAgICAgIGRlbHRhU2NhbGU7XG4gICAgZm9yIChqID0gMDsgaiA8IGNvdW50OyBqKyspIHtcbiAgICAgIGlmIChuZXh0U2NhbGUgIT09IDApIHtcbiAgICAgICAgZGVsdGFTY2FsZSA9IHRoaXMucmVhZEVHKCk7XG4gICAgICAgIG5leHRTY2FsZSA9IChsYXN0U2NhbGUgKyBkZWx0YVNjYWxlICsgMjU2KSAlIDI1NjtcbiAgICAgIH1cbiAgICAgIGxhc3RTY2FsZSA9IChuZXh0U2NhbGUgPT09IDApID8gbGFzdFNjYWxlIDogbmV4dFNjYWxlO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZWFkIGEgc2VxdWVuY2UgcGFyYW1ldGVyIHNldCBhbmQgcmV0dXJuIHNvbWUgaW50ZXJlc3RpbmcgdmlkZW9cbiAgICogcHJvcGVydGllcy4gQSBzZXF1ZW5jZSBwYXJhbWV0ZXIgc2V0IGlzIHRoZSBIMjY0IG1ldGFkYXRhIHRoYXRcbiAgICogZGVzY3JpYmVzIHRoZSBwcm9wZXJ0aWVzIG9mIHVwY29taW5nIHZpZGVvIGZyYW1lcy5cbiAgICogQHBhcmFtIGRhdGEge1VpbnQ4QXJyYXl9IHRoZSBieXRlcyBvZiBhIHNlcXVlbmNlIHBhcmFtZXRlciBzZXRcbiAgICogQHJldHVybiB7b2JqZWN0fSBhbiBvYmplY3Qgd2l0aCBjb25maWd1cmF0aW9uIHBhcnNlZCBmcm9tIHRoZVxuICAgKiBzZXF1ZW5jZSBwYXJhbWV0ZXIgc2V0LCBpbmNsdWRpbmcgdGhlIGRpbWVuc2lvbnMgb2YgdGhlXG4gICAqIGFzc29jaWF0ZWQgdmlkZW8gZnJhbWVzLlxuICAgKi9cbiAgcmVhZFNQUygpIHtcbiAgICB2YXJcbiAgICAgIGZyYW1lQ3JvcExlZnRPZmZzZXQgPSAwLFxuICAgICAgZnJhbWVDcm9wUmlnaHRPZmZzZXQgPSAwLFxuICAgICAgZnJhbWVDcm9wVG9wT2Zmc2V0ID0gMCxcbiAgICAgIGZyYW1lQ3JvcEJvdHRvbU9mZnNldCA9IDAsXG4gICAgICBzYXJTY2FsZSA9IDEsXG4gICAgICBwcm9maWxlSWRjLHByb2ZpbGVDb21wYXQsbGV2ZWxJZGMsXG4gICAgICBudW1SZWZGcmFtZXNJblBpY09yZGVyQ250Q3ljbGUsIHBpY1dpZHRoSW5NYnNNaW51czEsXG4gICAgICBwaWNIZWlnaHRJbk1hcFVuaXRzTWludXMxLFxuICAgICAgZnJhbWVNYnNPbmx5RmxhZyxcbiAgICAgIHNjYWxpbmdMaXN0Q291bnQsXG4gICAgICBpO1xuICAgIHRoaXMucmVhZFVCeXRlKCk7XG4gICAgcHJvZmlsZUlkYyA9IHRoaXMucmVhZFVCeXRlKCk7IC8vIHByb2ZpbGVfaWRjXG4gICAgcHJvZmlsZUNvbXBhdCA9IHRoaXMucmVhZEJpdHMoNSk7IC8vIGNvbnN0cmFpbnRfc2V0WzAtNF1fZmxhZywgdSg1KVxuICAgIHRoaXMuc2tpcEJpdHMoMyk7IC8vIHJlc2VydmVkX3plcm9fM2JpdHMgdSgzKSxcbiAgICBsZXZlbElkYyA9IHRoaXMucmVhZFVCeXRlKCk7IC8vbGV2ZWxfaWRjIHUoOClcbiAgICB0aGlzLnNraXBVRUcoKTsgLy8gc2VxX3BhcmFtZXRlcl9zZXRfaWRcbiAgICAvLyBzb21lIHByb2ZpbGVzIGhhdmUgbW9yZSBvcHRpb25hbCBkYXRhIHdlIGRvbid0IG5lZWRcbiAgICBpZiAocHJvZmlsZUlkYyA9PT0gMTAwIHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDExMCB8fFxuICAgICAgICBwcm9maWxlSWRjID09PSAxMjIgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gMjQ0IHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDQ0ICB8fFxuICAgICAgICBwcm9maWxlSWRjID09PSA4MyAgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gODYgIHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDExOCB8fFxuICAgICAgICBwcm9maWxlSWRjID09PSAxMjgpIHtcbiAgICAgIHZhciBjaHJvbWFGb3JtYXRJZGMgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICAgIGlmIChjaHJvbWFGb3JtYXRJZGMgPT09IDMpIHtcbiAgICAgICAgdGhpcy5za2lwQml0cygxKTsgLy8gc2VwYXJhdGVfY29sb3VyX3BsYW5lX2ZsYWdcbiAgICAgIH1cbiAgICAgIHRoaXMuc2tpcFVFRygpOyAvLyBiaXRfZGVwdGhfbHVtYV9taW51czhcbiAgICAgIHRoaXMuc2tpcFVFRygpOyAvLyBiaXRfZGVwdGhfY2hyb21hX21pbnVzOFxuICAgICAgdGhpcy5za2lwQml0cygxKTsgLy8gcXBwcmltZV95X3plcm9fdHJhbnNmb3JtX2J5cGFzc19mbGFnXG4gICAgICBpZiAodGhpcy5yZWFkQm9vbGVhbigpKSB7IC8vIHNlcV9zY2FsaW5nX21hdHJpeF9wcmVzZW50X2ZsYWdcbiAgICAgICAgc2NhbGluZ0xpc3RDb3VudCA9IChjaHJvbWFGb3JtYXRJZGMgIT09IDMpID8gOCA6IDEyO1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgc2NhbGluZ0xpc3RDb3VudDsgaSsrKSB7XG4gICAgICAgICAgaWYgKHRoaXMucmVhZEJvb2xlYW4oKSkgeyAvLyBzZXFfc2NhbGluZ19saXN0X3ByZXNlbnRfZmxhZ1sgaSBdXG4gICAgICAgICAgICBpZiAoaSA8IDYpIHtcbiAgICAgICAgICAgICAgdGhpcy5za2lwU2NhbGluZ0xpc3QoMTYpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdGhpcy5za2lwU2NhbGluZ0xpc3QoNjQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLnNraXBVRUcoKTsgLy8gbG9nMl9tYXhfZnJhbWVfbnVtX21pbnVzNFxuICAgIHZhciBwaWNPcmRlckNudFR5cGUgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICBpZiAocGljT3JkZXJDbnRUeXBlID09PSAwKSB7XG4gICAgICB0aGlzLnJlYWRVRUcoKTsgLy9sb2cyX21heF9waWNfb3JkZXJfY250X2xzYl9taW51czRcbiAgICB9IGVsc2UgaWYgKHBpY09yZGVyQ250VHlwZSA9PT0gMSkge1xuICAgICAgdGhpcy5za2lwQml0cygxKTsgLy8gZGVsdGFfcGljX29yZGVyX2Fsd2F5c196ZXJvX2ZsYWdcbiAgICAgIHRoaXMuc2tpcEVHKCk7IC8vIG9mZnNldF9mb3Jfbm9uX3JlZl9waWNcbiAgICAgIHRoaXMuc2tpcEVHKCk7IC8vIG9mZnNldF9mb3JfdG9wX3RvX2JvdHRvbV9maWVsZFxuICAgICAgbnVtUmVmRnJhbWVzSW5QaWNPcmRlckNudEN5Y2xlID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgICBmb3IoaSA9IDA7IGkgPCBudW1SZWZGcmFtZXNJblBpY09yZGVyQ250Q3ljbGU7IGkrKykge1xuICAgICAgICB0aGlzLnNraXBFRygpOyAvLyBvZmZzZXRfZm9yX3JlZl9mcmFtZVsgaSBdXG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuc2tpcFVFRygpOyAvLyBtYXhfbnVtX3JlZl9mcmFtZXNcbiAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBnYXBzX2luX2ZyYW1lX251bV92YWx1ZV9hbGxvd2VkX2ZsYWdcbiAgICBwaWNXaWR0aEluTWJzTWludXMxID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgcGljSGVpZ2h0SW5NYXBVbml0c01pbnVzMSA9IHRoaXMucmVhZFVFRygpO1xuICAgIGZyYW1lTWJzT25seUZsYWcgPSB0aGlzLnJlYWRCaXRzKDEpO1xuICAgIGlmIChmcmFtZU1ic09ubHlGbGFnID09PSAwKSB7XG4gICAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBtYl9hZGFwdGl2ZV9mcmFtZV9maWVsZF9mbGFnXG4gICAgfVxuICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIGRpcmVjdF84eDhfaW5mZXJlbmNlX2ZsYWdcbiAgICBpZiAodGhpcy5yZWFkQm9vbGVhbigpKSB7IC8vIGZyYW1lX2Nyb3BwaW5nX2ZsYWdcbiAgICAgIGZyYW1lQ3JvcExlZnRPZmZzZXQgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICAgIGZyYW1lQ3JvcFJpZ2h0T2Zmc2V0ID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgICBmcmFtZUNyb3BUb3BPZmZzZXQgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICAgIGZyYW1lQ3JvcEJvdHRvbU9mZnNldCA9IHRoaXMucmVhZFVFRygpO1xuICAgIH1cbiAgICBpZiAodGhpcy5yZWFkQm9vbGVhbigpKSB7XG4gICAgICAvLyB2dWlfcGFyYW1ldGVyc19wcmVzZW50X2ZsYWdcbiAgICAgIGlmICh0aGlzLnJlYWRCb29sZWFuKCkpIHtcbiAgICAgICAgLy8gYXNwZWN0X3JhdGlvX2luZm9fcHJlc2VudF9mbGFnXG4gICAgICAgIGxldCBzYXJSYXRpbztcbiAgICAgICAgY29uc3QgYXNwZWN0UmF0aW9JZGMgPSB0aGlzLnJlYWRVQnl0ZSgpO1xuICAgICAgICBzd2l0Y2ggKGFzcGVjdFJhdGlvSWRjKSB7XG4gICAgICAgICAgLy9jYXNlIDE6IHNhclJhdGlvID0gWzEsMV07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgMjogc2FyUmF0aW8gPSBbMTIsMTFdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDM6IHNhclJhdGlvID0gWzEwLDExXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSA0OiBzYXJSYXRpbyA9IFsxNiwxMV07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgNTogc2FyUmF0aW8gPSBbNDAsMzNdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDY6IHNhclJhdGlvID0gWzI0LDExXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSA3OiBzYXJSYXRpbyA9IFsyMCwxMV07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgODogc2FyUmF0aW8gPSBbMzIsMTFdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDk6IHNhclJhdGlvID0gWzgwLDMzXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSAxMDogc2FyUmF0aW8gPSBbMTgsMTFdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDExOiBzYXJSYXRpbyA9IFsxNSwxMV07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgMTI6IHNhclJhdGlvID0gWzY0LDMzXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSAxMzogc2FyUmF0aW8gPSBbMTYwLDk5XTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSAxNDogc2FyUmF0aW8gPSBbNCwzXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSAxNTogc2FyUmF0aW8gPSBbMywyXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSAxNjogc2FyUmF0aW8gPSBbMiwxXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSAyNTU6IHtcbiAgICAgICAgICAgIHNhclJhdGlvID0gW3RoaXMucmVhZFVCeXRlKCkgPDwgOCB8IHRoaXMucmVhZFVCeXRlKCksIHRoaXMucmVhZFVCeXRlKCkgPDwgOCB8IHRoaXMucmVhZFVCeXRlKCldO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzYXJSYXRpbykge1xuICAgICAgICAgIHNhclNjYWxlID0gc2FyUmF0aW9bMF0gLyBzYXJSYXRpb1sxXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgd2lkdGg6ICgoKHBpY1dpZHRoSW5NYnNNaW51czEgKyAxKSAqIDE2KSAtIGZyYW1lQ3JvcExlZnRPZmZzZXQgKiAyIC0gZnJhbWVDcm9wUmlnaHRPZmZzZXQgKiAyKSAqIHNhclNjYWxlLFxuICAgICAgaGVpZ2h0OiAoKDIgLSBmcmFtZU1ic09ubHlGbGFnKSAqIChwaWNIZWlnaHRJbk1hcFVuaXRzTWludXMxICsgMSkgKiAxNikgLSAoKGZyYW1lTWJzT25seUZsYWc/IDIgOiA0KSAqIChmcmFtZUNyb3BUb3BPZmZzZXQgKyBmcmFtZUNyb3BCb3R0b21PZmZzZXQpKVxuICAgIH07XG4gIH1cblxuICByZWFkU2xpY2VUeXBlKCkge1xuICAgIC8vIHNraXAgTkFMdSB0eXBlXG4gICAgdGhpcy5yZWFkVUJ5dGUoKTtcbiAgICAvLyBkaXNjYXJkIGZpcnN0X21iX2luX3NsaWNlXG4gICAgdGhpcy5yZWFkVUVHKCk7XG4gICAgLy8gcmV0dXJuIHNsaWNlX3R5cGVcbiAgICByZXR1cm4gdGhpcy5yZWFkVUVHKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRXhwR29sb21iO1xuIiwiLyoqXG4gKiBJRDMgcGFyc2VyXG4gKi9cbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuLy9pbXBvcnQgSGV4IGZyb20gJy4uL3V0aWxzL2hleCc7XG5cbiBjbGFzcyBJRDMge1xuXG4gIGNvbnN0cnVjdG9yKGRhdGEpIHtcbiAgICB0aGlzLl9oYXNUaW1lU3RhbXAgPSBmYWxzZTtcbiAgICB2YXIgb2Zmc2V0ID0gMCwgYnl0ZTEsYnl0ZTIsYnl0ZTMsYnl0ZTQsdGFnU2l6ZSxlbmRQb3MsaGVhZGVyLGxlbjtcbiAgICAgIGRvIHtcbiAgICAgICAgaGVhZGVyID0gdGhpcy5yZWFkVVRGKGRhdGEsb2Zmc2V0LDMpO1xuICAgICAgICBvZmZzZXQrPTM7XG4gICAgICAgICAgLy8gZmlyc3QgY2hlY2sgZm9yIElEMyBoZWFkZXJcbiAgICAgICAgICBpZiAoaGVhZGVyID09PSAnSUQzJykge1xuICAgICAgICAgICAgICAvLyBza2lwIDI0IGJpdHNcbiAgICAgICAgICAgICAgb2Zmc2V0ICs9IDM7XG4gICAgICAgICAgICAgIC8vIHJldHJpZXZlIHRhZyhzKSBsZW5ndGhcbiAgICAgICAgICAgICAgYnl0ZTEgPSBkYXRhW29mZnNldCsrXSAmIDB4N2Y7XG4gICAgICAgICAgICAgIGJ5dGUyID0gZGF0YVtvZmZzZXQrK10gJiAweDdmO1xuICAgICAgICAgICAgICBieXRlMyA9IGRhdGFbb2Zmc2V0KytdICYgMHg3ZjtcbiAgICAgICAgICAgICAgYnl0ZTQgPSBkYXRhW29mZnNldCsrXSAmIDB4N2Y7XG4gICAgICAgICAgICAgIHRhZ1NpemUgPSAoYnl0ZTEgPDwgMjEpICsgKGJ5dGUyIDw8IDE0KSArIChieXRlMyA8PCA3KSArIGJ5dGU0O1xuICAgICAgICAgICAgICBlbmRQb3MgPSBvZmZzZXQgKyB0YWdTaXplO1xuICAgICAgICAgICAgICAvL2xvZ2dlci5sb2coYElEMyB0YWcgZm91bmQsIHNpemUvZW5kOiAke3RhZ1NpemV9LyR7ZW5kUG9zfWApO1xuXG4gICAgICAgICAgICAgIC8vIHJlYWQgSUQzIHRhZ3NcbiAgICAgICAgICAgICAgdGhpcy5fcGFyc2VJRDNGcmFtZXMoZGF0YSwgb2Zmc2V0LGVuZFBvcyk7XG4gICAgICAgICAgICAgIG9mZnNldCA9IGVuZFBvcztcbiAgICAgICAgICB9IGVsc2UgaWYgKGhlYWRlciA9PT0gJzNESScpIHtcbiAgICAgICAgICAgICAgLy8gaHR0cDovL2lkMy5vcmcvaWQzdjIuNC4wLXN0cnVjdHVyZSBjaGFwdGVyIDMuNC4gICBJRDN2MiBmb290ZXJcbiAgICAgICAgICAgICAgb2Zmc2V0ICs9IDc7XG4gICAgICAgICAgICAgICAgICBsb2dnZXIubG9nKGAzREkgZm9vdGVyIGZvdW5kLCBlbmQ6ICR7b2Zmc2V0fWApO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIG9mZnNldCAtPSAzO1xuICAgICAgICAgICAgICBsZW4gPSBvZmZzZXQ7XG4gICAgICAgICAgICAgICAgICBpZiAobGVuKSB7XG4gICAgICAgICAgICAgICAgICAgICAgLy9sb2dnZXIubG9nKGBJRDMgbGVuOiAke2xlbn1gKTtcbiAgICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuaGFzVGltZVN0YW1wKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGxvZ2dlci53YXJuKCdJRDMgdGFnIGZvdW5kLCBidXQgbm8gdGltZXN0YW1wJyk7XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2xlbmd0aCA9IGxlbjtcbiAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9wYXlsb2FkID0gZGF0YS5zdWJhcnJheSgwLGxlbik7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICB9IHdoaWxlICh0cnVlKTtcbiAgfVxuXG4gIHJlYWRVVEYoZGF0YSxzdGFydCxsZW4pIHtcblxuICAgIHZhciByZXN1bHQgPSAnJyxvZmZzZXQgPSBzdGFydCwgZW5kID0gc3RhcnQgKyBsZW47XG4gICAgZG8ge1xuICAgICAgcmVzdWx0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoZGF0YVtvZmZzZXQrK10pO1xuICAgIH0gd2hpbGUob2Zmc2V0IDwgZW5kKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgX3BhcnNlSUQzRnJhbWVzKGRhdGEsb2Zmc2V0LGVuZFBvcykge1xuICAgIHZhciB0YWdJZCx0YWdMZW4sdGFnU3RhcnQsdGFnRmxhZ3MsdGltZXN0YW1wO1xuICAgIHdoaWxlKG9mZnNldCArIDggPD0gZW5kUG9zKSB7XG4gICAgICB0YWdJZCA9IHRoaXMucmVhZFVURihkYXRhLG9mZnNldCw0KTtcbiAgICAgIG9mZnNldCArPTQ7XG5cbiAgICAgIHRhZ0xlbiA9IGRhdGFbb2Zmc2V0KytdIDw8IDI0ICtcbiAgICAgICAgICAgICAgICBkYXRhW29mZnNldCsrXSA8PCAxNiArXG4gICAgICAgICAgICAgICAgZGF0YVtvZmZzZXQrK10gPDwgOCArXG4gICAgICAgICAgICAgICAgZGF0YVtvZmZzZXQrK107XG5cbiAgICAgIHRhZ0ZsYWdzID0gZGF0YVtvZmZzZXQrK10gPDwgOCArXG4gICAgICAgICAgICAgICAgICBkYXRhW29mZnNldCsrXTtcblxuICAgICAgdGFnU3RhcnQgPSBvZmZzZXQ7XG4gICAgICAvL2xvZ2dlci5sb2coXCJJRDMgdGFnIGlkOlwiICsgdGFnSWQpO1xuICAgICAgc3dpdGNoKHRhZ0lkKSB7XG4gICAgICAgIGNhc2UgJ1BSSVYnOlxuICAgICAgICAgICAgLy9sb2dnZXIubG9nKCdwYXJzZSBmcmFtZTonICsgSGV4LmhleER1bXAoZGF0YS5zdWJhcnJheShvZmZzZXQsZW5kUG9zKSkpO1xuICAgICAgICAgICAgLy8gb3duZXIgc2hvdWxkIGJlIFwiY29tLmFwcGxlLnN0cmVhbWluZy50cmFuc3BvcnRTdHJlYW1UaW1lc3RhbXBcIlxuICAgICAgICAgICAgaWYgKHRoaXMucmVhZFVURihkYXRhLG9mZnNldCw0NCkgPT09ICdjb20uYXBwbGUuc3RyZWFtaW5nLnRyYW5zcG9ydFN0cmVhbVRpbWVzdGFtcCcpIHtcbiAgICAgICAgICAgICAgICBvZmZzZXQrPTQ0O1xuICAgICAgICAgICAgICAgIC8vIHNtZWxsaW5nIGV2ZW4gYmV0dGVyICEgd2UgZm91bmQgdGhlIHJpZ2h0IGRlc2NyaXB0b3JcbiAgICAgICAgICAgICAgICAvLyBza2lwIG51bGwgY2hhcmFjdGVyIChzdHJpbmcgZW5kKSArIDMgZmlyc3QgYnl0ZXNcbiAgICAgICAgICAgICAgICBvZmZzZXQrPSA0O1xuXG4gICAgICAgICAgICAgICAgLy8gdGltZXN0YW1wIGlzIDMzIGJpdCBleHByZXNzZWQgYXMgYSBiaWctZW5kaWFuIGVpZ2h0LW9jdGV0IG51bWJlciwgd2l0aCB0aGUgdXBwZXIgMzEgYml0cyBzZXQgdG8gemVyby5cbiAgICAgICAgICAgICAgICB2YXIgcHRzMzNCaXQgID0gZGF0YVtvZmZzZXQrK10gJiAweDE7XG4gICAgICAgICAgICAgICAgdGhpcy5faGFzVGltZVN0YW1wID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgIHRpbWVzdGFtcCA9ICgoZGF0YVtvZmZzZXQrK10gPDwgMjMpICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKGRhdGFbb2Zmc2V0KytdIDw8IDE1KSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIChkYXRhW29mZnNldCsrXSA8PCAgNykgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhW29mZnNldCsrXSkgLzQ1O1xuXG4gICAgICAgICAgICAgICAgaWYgKHB0czMzQml0KSB7XG4gICAgICAgICAgICAgICAgICAgIHRpbWVzdGFtcCAgICs9IDQ3NzIxODU4Ljg0OyAvLyAyXjMyIC8gOTBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGltZXN0YW1wID0gTWF0aC5yb3VuZCh0aW1lc3RhbXApO1xuICAgICAgICAgICAgICAgIGxvZ2dlci50cmFjZShgSUQzIHRpbWVzdGFtcCBmb3VuZDogJHt0aW1lc3RhbXB9YCk7XG4gICAgICAgICAgICAgICAgdGhpcy5fdGltZVN0YW1wID0gdGltZXN0YW1wO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBnZXQgaGFzVGltZVN0YW1wKCkge1xuICAgIHJldHVybiB0aGlzLl9oYXNUaW1lU3RhbXA7XG4gIH1cblxuICBnZXQgdGltZVN0YW1wKCkge1xuICAgIHJldHVybiB0aGlzLl90aW1lU3RhbXA7XG4gIH1cblxuICBnZXQgbGVuZ3RoKCkge1xuICAgIHJldHVybiB0aGlzLl9sZW5ndGg7XG4gIH1cblxuICBnZXQgcGF5bG9hZCgpIHtcbiAgICByZXR1cm4gdGhpcy5fcGF5bG9hZDtcbiAgfVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IElEMztcblxuIiwiLyoqXG4gKiBoaWdobHkgb3B0aW1pemVkIFRTIGRlbXV4ZXI6XG4gKiBwYXJzZSBQQVQsIFBNVFxuICogZXh0cmFjdCBQRVMgcGFja2V0IGZyb20gYXVkaW8gYW5kIHZpZGVvIFBJRHNcbiAqIGV4dHJhY3QgQVZDL0gyNjQgTkFMIHVuaXRzIGFuZCBBQUMvQURUUyBzYW1wbGVzIGZyb20gUEVTIHBhY2tldFxuICogdHJpZ2dlciB0aGUgcmVtdXhlciB1cG9uIHBhcnNpbmcgY29tcGxldGlvblxuICogaXQgYWxzbyB0cmllcyB0byB3b3JrYXJvdW5kIGFzIGJlc3QgYXMgaXQgY2FuIGF1ZGlvIGNvZGVjIHN3aXRjaCAoSEUtQUFDIHRvIEFBQyBhbmQgdmljZSB2ZXJzYSksIHdpdGhvdXQgaGF2aW5nIHRvIHJlc3RhcnQgdGhlIE1lZGlhU291cmNlLlxuICogaXQgYWxzbyBjb250cm9scyB0aGUgcmVtdXhpbmcgcHJvY2VzcyA6XG4gKiB1cG9uIGRpc2NvbnRpbnVpdHkgb3IgbGV2ZWwgc3dpdGNoIGRldGVjdGlvbiwgaXQgd2lsbCBhbHNvIG5vdGlmaWVzIHRoZSByZW11eGVyIHNvIHRoYXQgaXQgY2FuIHJlc2V0IGl0cyBzdGF0ZS5cbiovXG5cbiBpbXBvcnQgQURUUyBmcm9tICcuL2FkdHMnO1xuIGltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuIGltcG9ydCBFeHBHb2xvbWIgZnJvbSAnLi9leHAtZ29sb21iJztcbi8vIGltcG9ydCBIZXggZnJvbSAnLi4vdXRpbHMvaGV4JztcbiBpbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbiBpbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcblxuIGNsYXNzIFRTRGVtdXhlciB7XG5cbiAgY29uc3RydWN0b3Iob2JzZXJ2ZXIscmVtdXhlckNsYXNzKSB7XG4gICAgdGhpcy5vYnNlcnZlciA9IG9ic2VydmVyO1xuICAgIHRoaXMucmVtdXhlckNsYXNzID0gcmVtdXhlckNsYXNzO1xuICAgIHRoaXMubGFzdENDID0gMDtcbiAgICB0aGlzLnJlbXV4ZXIgPSBuZXcgdGhpcy5yZW11eGVyQ2xhc3Mob2JzZXJ2ZXIpO1xuICAgIHRoaXMuX3VzZXJEYXRhID0gW107XG4gIH1cblxuICBzdGF0aWMgcHJvYmUoZGF0YSkge1xuICAgIC8vIGEgVFMgZnJhZ21lbnQgc2hvdWxkIGNvbnRhaW4gYXQgbGVhc3QgMyBUUyBwYWNrZXRzLCBhIFBBVCwgYSBQTVQsIGFuZCBvbmUgUElELCBlYWNoIHN0YXJ0aW5nIHdpdGggMHg0N1xuICAgIGlmIChkYXRhLmxlbmd0aCA+PSAzKjE4OCAmJiBkYXRhWzBdID09PSAweDQ3ICYmIGRhdGFbMTg4XSA9PT0gMHg0NyAmJiBkYXRhWzIqMTg4XSA9PT0gMHg0Nykge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBzd2l0Y2hMZXZlbCgpIHtcbiAgICB0aGlzLnBtdFBhcnNlZCA9IGZhbHNlO1xuICAgIHRoaXMuX3BtdElkID0gLTE7XG4gICAgdGhpcy5fYXZjVHJhY2sgPSB7dHlwZTogJ3ZpZGVvJywgaWQgOi0xLCBzZXF1ZW5jZU51bWJlcjogMCwgc2FtcGxlcyA6IFtdLCBsZW4gOiAwLCBuYk5hbHUgOiAwfTtcbiAgICB0aGlzLl9hYWNUcmFjayA9IHt0eXBlOiAnYXVkaW8nLCBpZCA6LTEsIHNlcXVlbmNlTnVtYmVyOiAwLCBzYW1wbGVzIDogW10sIGxlbiA6IDB9O1xuICAgIHRoaXMuX2lkM1RyYWNrID0ge3R5cGU6ICdpZDMnLCBpZCA6LTEsIHNlcXVlbmNlTnVtYmVyOiAwLCBzYW1wbGVzIDogW10sIGxlbiA6IDB9O1xuICAgIHRoaXMuX3R4dFRyYWNrID0ge3R5cGU6ICd0ZXh0JywgaWQ6IC0xLCBzZXF1ZW5jZU51bWJlcjogMCwgc2FtcGxlczogW10sIGxlbjogMH1cbiAgICB0aGlzLnJlbXV4ZXIuc3dpdGNoTGV2ZWwoKTtcbiAgfVxuXG4gIGluc2VydERpc2NvbnRpbnVpdHkoKSB7XG4gICAgdGhpcy5zd2l0Y2hMZXZlbCgpO1xuICAgIHRoaXMucmVtdXhlci5pbnNlcnREaXNjb250aW51aXR5KCk7XG4gIH1cblxuICAvLyBmZWVkIGluY29taW5nIGRhdGEgdG8gdGhlIGZyb250IG9mIHRoZSBwYXJzaW5nIHBpcGVsaW5lXG4gIHB1c2goZGF0YSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCwgY2MsIGxldmVsLCBzbiwgZHVyYXRpb24pIHtcbiAgICB2YXIgYXZjRGF0YSwgYWFjRGF0YSwgaWQzRGF0YSxcbiAgICAgICAgc3RhcnQsIGxlbiA9IGRhdGEubGVuZ3RoLCBzdHQsIHBpZCwgYXRmLCBvZmZzZXQ7XG4gICAgdGhpcy5hdWRpb0NvZGVjID0gYXVkaW9Db2RlYztcbiAgICB0aGlzLnZpZGVvQ29kZWMgPSB2aWRlb0NvZGVjO1xuICAgIHRoaXMudGltZU9mZnNldCA9IHRpbWVPZmZzZXQ7XG4gICAgdGhpcy5fZHVyYXRpb24gPSBkdXJhdGlvbjtcbiAgICB0aGlzLmNvbnRpZ3VvdXMgPSBmYWxzZTtcbiAgICBpZiAoY2MgIT09IHRoaXMubGFzdENDKSB7XG4gICAgICBsb2dnZXIubG9nKCdkaXNjb250aW51aXR5IGRldGVjdGVkJyk7XG4gICAgICB0aGlzLmluc2VydERpc2NvbnRpbnVpdHkoKTtcbiAgICAgIHRoaXMubGFzdENDID0gY2M7XG4gICAgfSBlbHNlIGlmIChsZXZlbCAhPT0gdGhpcy5sYXN0TGV2ZWwpIHtcbiAgICAgIGxvZ2dlci5sb2coJ2xldmVsIHN3aXRjaCBkZXRlY3RlZCcpO1xuICAgICAgdGhpcy5zd2l0Y2hMZXZlbCgpO1xuICAgICAgdGhpcy5sYXN0TGV2ZWwgPSBsZXZlbDtcbiAgICB9IGVsc2UgaWYgKHNuID09PSAodGhpcy5sYXN0U04rMSkpIHtcbiAgICAgIHRoaXMuY29udGlndW91cyA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMubGFzdFNOID0gc247XG5cbiAgICBpZighdGhpcy5jb250aWd1b3VzKSB7XG4gICAgICAvLyBmbHVzaCBhbnkgcGFydGlhbCBjb250ZW50XG4gICAgICB0aGlzLmFhY092ZXJGbG93ID0gbnVsbDtcbiAgICB9XG5cbiAgICB2YXIgcG10UGFyc2VkID0gdGhpcy5wbXRQYXJzZWQsXG4gICAgICAgIGF2Y0lkID0gdGhpcy5fYXZjVHJhY2suaWQsXG4gICAgICAgIGFhY0lkID0gdGhpcy5fYWFjVHJhY2suaWQsXG4gICAgICAgIGlkM0lkID0gdGhpcy5faWQzVHJhY2suaWQ7XG4gICAgLy8gbG9vcCB0aHJvdWdoIFRTIHBhY2tldHNcbiAgICBmb3IgKHN0YXJ0ID0gMDsgc3RhcnQgPCBsZW47IHN0YXJ0ICs9IDE4OCkge1xuICAgICAgaWYgKGRhdGFbc3RhcnRdID09PSAweDQ3KSB7XG4gICAgICAgIHN0dCA9ICEhKGRhdGFbc3RhcnQgKyAxXSAmIDB4NDApO1xuICAgICAgICAvLyBwaWQgaXMgYSAxMy1iaXQgZmllbGQgc3RhcnRpbmcgYXQgdGhlIGxhc3QgYml0IG9mIFRTWzFdXG4gICAgICAgIHBpZCA9ICgoZGF0YVtzdGFydCArIDFdICYgMHgxZikgPDwgOCkgKyBkYXRhW3N0YXJ0ICsgMl07XG4gICAgICAgIGF0ZiA9IChkYXRhW3N0YXJ0ICsgM10gJiAweDMwKSA+PiA0O1xuICAgICAgICAvLyBpZiBhbiBhZGFwdGlvbiBmaWVsZCBpcyBwcmVzZW50LCBpdHMgbGVuZ3RoIGlzIHNwZWNpZmllZCBieSB0aGUgZmlmdGggYnl0ZSBvZiB0aGUgVFMgcGFja2V0IGhlYWRlci5cbiAgICAgICAgaWYgKGF0ZiA+IDEpIHtcbiAgICAgICAgICBvZmZzZXQgPSBzdGFydCArIDUgKyBkYXRhW3N0YXJ0ICsgNF07XG4gICAgICAgICAgLy8gY29udGludWUgaWYgdGhlcmUgaXMgb25seSBhZGFwdGF0aW9uIGZpZWxkXG4gICAgICAgICAgaWYgKG9mZnNldCA9PT0gKHN0YXJ0ICsgMTg4KSkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG9mZnNldCA9IHN0YXJ0ICsgNDtcbiAgICAgICAgfVxuICAgICAgICBpZiAocG10UGFyc2VkKSB7XG4gICAgICAgICAgaWYgKHBpZCA9PT0gYXZjSWQpIHtcbiAgICAgICAgICAgIGlmIChzdHQpIHtcbiAgICAgICAgICAgICAgaWYgKGF2Y0RhdGEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9wYXJzZUFWQ1BFUyh0aGlzLl9wYXJzZVBFUyhhdmNEYXRhKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgYXZjRGF0YSA9IHtkYXRhOiBbXSwgc2l6ZTogMH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoYXZjRGF0YSkge1xuICAgICAgICAgICAgICBhdmNEYXRhLmRhdGEucHVzaChkYXRhLnN1YmFycmF5KG9mZnNldCwgc3RhcnQgKyAxODgpKTtcbiAgICAgICAgICAgICAgYXZjRGF0YS5zaXplICs9IHN0YXJ0ICsgMTg4IC0gb2Zmc2V0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSBpZiAocGlkID09PSBhYWNJZCkge1xuICAgICAgICAgICAgaWYgKHN0dCkge1xuICAgICAgICAgICAgICBpZiAoYWFjRGF0YSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3BhcnNlQUFDUEVTKHRoaXMuX3BhcnNlUEVTKGFhY0RhdGEpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBhYWNEYXRhID0ge2RhdGE6IFtdLCBzaXplOiAwfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChhYWNEYXRhKSB7XG4gICAgICAgICAgICAgIGFhY0RhdGEuZGF0YS5wdXNoKGRhdGEuc3ViYXJyYXkob2Zmc2V0LCBzdGFydCArIDE4OCkpO1xuICAgICAgICAgICAgICBhYWNEYXRhLnNpemUgKz0gc3RhcnQgKyAxODggLSBvZmZzZXQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGlmIChwaWQgPT09IGlkM0lkKSB7XG4gICAgICAgICAgICBpZiAoc3R0KSB7XG4gICAgICAgICAgICAgIGlmIChpZDNEYXRhKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcGFyc2VJRDNQRVModGhpcy5fcGFyc2VQRVMoaWQzRGF0YSkpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlkM0RhdGEgPSB7ZGF0YTogW10sIHNpemU6IDB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGlkM0RhdGEpIHtcbiAgICAgICAgICAgICAgaWQzRGF0YS5kYXRhLnB1c2goZGF0YS5zdWJhcnJheShvZmZzZXQsIHN0YXJ0ICsgMTg4KSk7XG4gICAgICAgICAgICAgIGlkM0RhdGEuc2l6ZSArPSBzdGFydCArIDE4OCAtIG9mZnNldDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKHN0dCkge1xuICAgICAgICAgICAgb2Zmc2V0ICs9IGRhdGFbb2Zmc2V0XSArIDE7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChwaWQgPT09IDApIHtcbiAgICAgICAgICAgIHRoaXMuX3BhcnNlUEFUKGRhdGEsIG9mZnNldCk7XG4gICAgICAgICAgfSBlbHNlIGlmIChwaWQgPT09IHRoaXMuX3BtdElkKSB7XG4gICAgICAgICAgICB0aGlzLl9wYXJzZVBNVChkYXRhLCBvZmZzZXQpO1xuICAgICAgICAgICAgcG10UGFyc2VkID0gdGhpcy5wbXRQYXJzZWQgPSB0cnVlO1xuICAgICAgICAgICAgYXZjSWQgPSB0aGlzLl9hdmNUcmFjay5pZDtcbiAgICAgICAgICAgIGFhY0lkID0gdGhpcy5fYWFjVHJhY2suaWQ7XG4gICAgICAgICAgICBpZDNJZCA9IHRoaXMuX2lkM1RyYWNrLmlkO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5vYnNlcnZlci50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZSA6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5GUkFHX1BBUlNJTkdfRVJST1IsIGZhdGFsOiBmYWxzZSwgcmVhc29uOiAnVFMgcGFja2V0IGRpZCBub3Qgc3RhcnQgd2l0aCAweDQ3J30pO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBwYXJzZSBsYXN0IFBFUyBwYWNrZXRcbiAgICBpZiAoYXZjRGF0YSkge1xuICAgICAgdGhpcy5fcGFyc2VBVkNQRVModGhpcy5fcGFyc2VQRVMoYXZjRGF0YSkpO1xuICAgIH1cbiAgICBpZiAoYWFjRGF0YSkge1xuICAgICAgdGhpcy5fcGFyc2VBQUNQRVModGhpcy5fcGFyc2VQRVMoYWFjRGF0YSkpO1xuICAgIH1cbiAgICBpZiAoaWQzRGF0YSkge1xuICAgICAgdGhpcy5fcGFyc2VJRDNQRVModGhpcy5fcGFyc2VQRVMoaWQzRGF0YSkpO1xuICAgIH1cbiAgICB0aGlzLnJlbXV4KCk7XG4gIH1cblxuICByZW11eCgpIHtcbiAgICB0aGlzLnJlbXV4ZXIucmVtdXgodGhpcy5fYWFjVHJhY2ssIHRoaXMuX2F2Y1RyYWNrLCB0aGlzLl9pZDNUcmFjaywgdGhpcy5fdHh0VHJhY2ssIHRoaXMudGltZU9mZnNldCwgdGhpcy5jb250aWd1b3VzKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5zd2l0Y2hMZXZlbCgpO1xuICAgIHRoaXMuX2luaXRQVFMgPSB0aGlzLl9pbml0RFRTID0gdW5kZWZpbmVkO1xuICAgIHRoaXMuX2R1cmF0aW9uID0gMDtcbiAgfVxuXG4gIF9wYXJzZVBBVChkYXRhLCBvZmZzZXQpIHtcbiAgICAvLyBza2lwIHRoZSBQU0kgaGVhZGVyIGFuZCBwYXJzZSB0aGUgZmlyc3QgUE1UIGVudHJ5XG4gICAgdGhpcy5fcG10SWQgID0gKGRhdGFbb2Zmc2V0ICsgMTBdICYgMHgxRikgPDwgOCB8IGRhdGFbb2Zmc2V0ICsgMTFdO1xuICAgIC8vbG9nZ2VyLmxvZygnUE1UIFBJRDonICArIHRoaXMuX3BtdElkKTtcbiAgfVxuXG4gIF9wYXJzZVBNVChkYXRhLCBvZmZzZXQpIHtcbiAgICB2YXIgc2VjdGlvbkxlbmd0aCwgdGFibGVFbmQsIHByb2dyYW1JbmZvTGVuZ3RoLCBwaWQ7XG4gICAgc2VjdGlvbkxlbmd0aCA9IChkYXRhW29mZnNldCArIDFdICYgMHgwZikgPDwgOCB8IGRhdGFbb2Zmc2V0ICsgMl07XG4gICAgdGFibGVFbmQgPSBvZmZzZXQgKyAzICsgc2VjdGlvbkxlbmd0aCAtIDQ7XG4gICAgLy8gdG8gZGV0ZXJtaW5lIHdoZXJlIHRoZSB0YWJsZSBpcywgd2UgaGF2ZSB0byBmaWd1cmUgb3V0IGhvd1xuICAgIC8vIGxvbmcgdGhlIHByb2dyYW0gaW5mbyBkZXNjcmlwdG9ycyBhcmVcbiAgICBwcm9ncmFtSW5mb0xlbmd0aCA9IChkYXRhW29mZnNldCArIDEwXSAmIDB4MGYpIDw8IDggfCBkYXRhW29mZnNldCArIDExXTtcbiAgICAvLyBhZHZhbmNlIHRoZSBvZmZzZXQgdG8gdGhlIGZpcnN0IGVudHJ5IGluIHRoZSBtYXBwaW5nIHRhYmxlXG4gICAgb2Zmc2V0ICs9IDEyICsgcHJvZ3JhbUluZm9MZW5ndGg7XG4gICAgd2hpbGUgKG9mZnNldCA8IHRhYmxlRW5kKSB7XG4gICAgICBwaWQgPSAoZGF0YVtvZmZzZXQgKyAxXSAmIDB4MUYpIDw8IDggfCBkYXRhW29mZnNldCArIDJdO1xuICAgICAgc3dpdGNoKGRhdGFbb2Zmc2V0XSkge1xuICAgICAgICAvLyBJU08vSUVDIDEzODE4LTcgQURUUyBBQUMgKE1QRUctMiBsb3dlciBiaXQtcmF0ZSBhdWRpbylcbiAgICAgICAgY2FzZSAweDBmOlxuICAgICAgICAgIC8vbG9nZ2VyLmxvZygnQUFDIFBJRDonICArIHBpZCk7XG4gICAgICAgICAgdGhpcy5fYWFjVHJhY2suaWQgPSBwaWQ7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIC8vIFBhY2tldGl6ZWQgbWV0YWRhdGEgKElEMylcbiAgICAgICAgY2FzZSAweDE1OlxuICAgICAgICAgIC8vbG9nZ2VyLmxvZygnSUQzIFBJRDonICArIHBpZCk7XG4gICAgICAgICAgdGhpcy5faWQzVHJhY2suaWQgPSBwaWQ7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIC8vIElUVS1UIFJlYy4gSC4yNjQgYW5kIElTTy9JRUMgMTQ0OTYtMTAgKGxvd2VyIGJpdC1yYXRlIHZpZGVvKVxuICAgICAgICBjYXNlIDB4MWI6XG4gICAgICAgICAgLy9sb2dnZXIubG9nKCdBVkMgUElEOicgICsgcGlkKTtcbiAgICAgICAgICB0aGlzLl9hdmNUcmFjay5pZCA9IHBpZDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgbG9nZ2VyLmxvZygndW5rb3duIHN0cmVhbSB0eXBlOicgICsgZGF0YVtvZmZzZXRdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICAvLyBtb3ZlIHRvIHRoZSBuZXh0IHRhYmxlIGVudHJ5XG4gICAgICAvLyBza2lwIHBhc3QgdGhlIGVsZW1lbnRhcnkgc3RyZWFtIGRlc2NyaXB0b3JzLCBpZiBwcmVzZW50XG4gICAgICBvZmZzZXQgKz0gKChkYXRhW29mZnNldCArIDNdICYgMHgwRikgPDwgOCB8IGRhdGFbb2Zmc2V0ICsgNF0pICsgNTtcbiAgICB9XG4gIH1cblxuICBfcGFyc2VQRVMoc3RyZWFtKSB7XG4gICAgdmFyIGkgPSAwLCBmcmFnLCBwZXNGbGFncywgcGVzUHJlZml4LCBwZXNMZW4sIHBlc0hkckxlbiwgcGVzRGF0YSwgcGVzUHRzLCBwZXNEdHMsIHBheWxvYWRTdGFydE9mZnNldDtcbiAgICAvL3JldHJpZXZlIFBUUy9EVFMgZnJvbSBmaXJzdCBmcmFnbWVudFxuICAgIGZyYWcgPSBzdHJlYW0uZGF0YVswXTtcbiAgICBwZXNQcmVmaXggPSAoZnJhZ1swXSA8PCAxNikgKyAoZnJhZ1sxXSA8PCA4KSArIGZyYWdbMl07XG4gICAgaWYgKHBlc1ByZWZpeCA9PT0gMSkge1xuICAgICAgcGVzTGVuID0gKGZyYWdbNF0gPDwgOCkgKyBmcmFnWzVdO1xuICAgICAgcGVzRmxhZ3MgPSBmcmFnWzddO1xuICAgICAgaWYgKHBlc0ZsYWdzICYgMHhDMCkge1xuICAgICAgICAvKiBQRVMgaGVhZGVyIGRlc2NyaWJlZCBoZXJlIDogaHR0cDovL2R2ZC5zb3VyY2Vmb3JnZS5uZXQvZHZkaW5mby9wZXMtaGRyLmh0bWxcbiAgICAgICAgICAgIGFzIFBUUyAvIERUUyBpcyAzMyBiaXQgd2UgY2Fubm90IHVzZSBiaXR3aXNlIG9wZXJhdG9yIGluIEpTLFxuICAgICAgICAgICAgYXMgQml0d2lzZSBvcGVyYXRvcnMgdHJlYXQgdGhlaXIgb3BlcmFuZHMgYXMgYSBzZXF1ZW5jZSBvZiAzMiBiaXRzICovXG4gICAgICAgIHBlc1B0cyA9IChmcmFnWzldICYgMHgwRSkgKiA1MzY4NzA5MTIgKy8vIDEgPDwgMjlcbiAgICAgICAgICAoZnJhZ1sxMF0gJiAweEZGKSAqIDQxOTQzMDQgKy8vIDEgPDwgMjJcbiAgICAgICAgICAoZnJhZ1sxMV0gJiAweEZFKSAqIDE2Mzg0ICsvLyAxIDw8IDE0XG4gICAgICAgICAgKGZyYWdbMTJdICYgMHhGRikgKiAxMjggKy8vIDEgPDwgN1xuICAgICAgICAgIChmcmFnWzEzXSAmIDB4RkUpIC8gMjtcbiAgICAgICAgICAvLyBjaGVjayBpZiBncmVhdGVyIHRoYW4gMl4zMiAtMVxuICAgICAgICAgIGlmIChwZXNQdHMgPiA0Mjk0OTY3Mjk1KSB7XG4gICAgICAgICAgICAvLyBkZWNyZW1lbnQgMl4zM1xuICAgICAgICAgICAgcGVzUHRzIC09IDg1ODk5MzQ1OTI7XG4gICAgICAgICAgfVxuICAgICAgICBpZiAocGVzRmxhZ3MgJiAweDQwKSB7XG4gICAgICAgICAgcGVzRHRzID0gKGZyYWdbMTRdICYgMHgwRSApICogNTM2ODcwOTEyICsvLyAxIDw8IDI5XG4gICAgICAgICAgICAoZnJhZ1sxNV0gJiAweEZGICkgKiA0MTk0MzA0ICsvLyAxIDw8IDIyXG4gICAgICAgICAgICAoZnJhZ1sxNl0gJiAweEZFICkgKiAxNjM4NCArLy8gMSA8PCAxNFxuICAgICAgICAgICAgKGZyYWdbMTddICYgMHhGRiApICogMTI4ICsvLyAxIDw8IDdcbiAgICAgICAgICAgIChmcmFnWzE4XSAmIDB4RkUgKSAvIDI7XG4gICAgICAgICAgLy8gY2hlY2sgaWYgZ3JlYXRlciB0aGFuIDJeMzIgLTFcbiAgICAgICAgICBpZiAocGVzRHRzID4gNDI5NDk2NzI5NSkge1xuICAgICAgICAgICAgLy8gZGVjcmVtZW50IDJeMzNcbiAgICAgICAgICAgIHBlc0R0cyAtPSA4NTg5OTM0NTkyO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZXNEdHMgPSBwZXNQdHM7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHBlc0hkckxlbiA9IGZyYWdbOF07XG4gICAgICBwYXlsb2FkU3RhcnRPZmZzZXQgPSBwZXNIZHJMZW4gKyA5O1xuICAgICAgLy8gdHJpbSBQRVMgaGVhZGVyXG4gICAgICBzdHJlYW0uZGF0YVswXSA9IHN0cmVhbS5kYXRhWzBdLnN1YmFycmF5KHBheWxvYWRTdGFydE9mZnNldCk7XG4gICAgICBzdHJlYW0uc2l6ZSAtPSBwYXlsb2FkU3RhcnRPZmZzZXQ7XG4gICAgICAvL3JlYXNzZW1ibGUgUEVTIHBhY2tldFxuICAgICAgcGVzRGF0YSA9IG5ldyBVaW50OEFycmF5KHN0cmVhbS5zaXplKTtcbiAgICAgIC8vIHJlYXNzZW1ibGUgdGhlIHBhY2tldFxuICAgICAgd2hpbGUgKHN0cmVhbS5kYXRhLmxlbmd0aCkge1xuICAgICAgICBmcmFnID0gc3RyZWFtLmRhdGEuc2hpZnQoKTtcbiAgICAgICAgcGVzRGF0YS5zZXQoZnJhZywgaSk7XG4gICAgICAgIGkgKz0gZnJhZy5ieXRlTGVuZ3RoO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHtkYXRhOiBwZXNEYXRhLCBwdHM6IHBlc1B0cywgZHRzOiBwZXNEdHMsIGxlbjogcGVzTGVufTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgX3BhcnNlQVZDUEVTKHBlcykge1xuICAgIHZhciB0cmFjayA9IHRoaXMuX2F2Y1RyYWNrLFxuICAgICAgICBzYW1wbGVzID0gdHJhY2suc2FtcGxlcyxcbiAgICAgICAgdW5pdHMgPSB0aGlzLl9wYXJzZUFWQ05BTHUocGVzLmRhdGEpLFxuICAgICAgICB1bml0czIgPSBbXSxcbiAgICAgICAgZGVidWcgPSBmYWxzZSxcbiAgICAgICAga2V5ID0gZmFsc2UsXG4gICAgICAgIGxlbmd0aCA9IDAsXG4gICAgICAgIGF2Y1NhbXBsZSxcbiAgICAgICAgcHVzaDtcbiAgICAvLyBubyBOQUx1IGZvdW5kXG4gICAgaWYgKHVuaXRzLmxlbmd0aCA9PT0gMCAmJiBzYW1wbGVzLmxlbmd0aCA+IDApIHtcbiAgICAgIC8vIGFwcGVuZCBwZXMuZGF0YSB0byBwcmV2aW91cyBOQUwgdW5pdFxuICAgICAgdmFyIGxhc3RhdmNTYW1wbGUgPSBzYW1wbGVzW3NhbXBsZXMubGVuZ3RoIC0gMV07XG4gICAgICB2YXIgbGFzdFVuaXQgPSBsYXN0YXZjU2FtcGxlLnVuaXRzLnVuaXRzW2xhc3RhdmNTYW1wbGUudW5pdHMudW5pdHMubGVuZ3RoIC0gMV07XG4gICAgICB2YXIgdG1wID0gbmV3IFVpbnQ4QXJyYXkobGFzdFVuaXQuZGF0YS5ieXRlTGVuZ3RoICsgcGVzLmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICB0bXAuc2V0KGxhc3RVbml0LmRhdGEsIDApO1xuICAgICAgdG1wLnNldChwZXMuZGF0YSwgbGFzdFVuaXQuZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICAgIGxhc3RVbml0LmRhdGEgPSB0bXA7XG4gICAgICBsYXN0YXZjU2FtcGxlLnVuaXRzLmxlbmd0aCArPSBwZXMuZGF0YS5ieXRlTGVuZ3RoO1xuICAgICAgdHJhY2subGVuICs9IHBlcy5kYXRhLmJ5dGVMZW5ndGg7XG4gICAgfVxuICAgIC8vZnJlZSBwZXMuZGF0YSB0byBzYXZlIHVwIHNvbWUgbWVtb3J5XG4gICAgcGVzLmRhdGEgPSBudWxsO1xuICAgIHZhciBkZWJ1Z1N0cmluZyA9ICcnO1xuICAgIHVuaXRzLmZvckVhY2godW5pdCA9PiB7XG4gICAgICBzd2l0Y2godW5pdC50eXBlKSB7XG4gICAgICAgIC8vTkRSXG4gICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgIHB1c2ggPSB0cnVlO1xuICAgICAgICAgICBpZihkZWJ1Zykge1xuICAgICAgICAgICAgZGVidWdTdHJpbmcgKz0gJ05EUiAnO1xuICAgICAgICAgICB9XG4gICAgICAgICAgIGJyZWFrO1xuICAgICAgICAvL0lEUlxuICAgICAgICBjYXNlIDU6XG4gICAgICAgICAgcHVzaCA9IHRydWU7XG4gICAgICAgICAgaWYoZGVidWcpIHtcbiAgICAgICAgICAgIGRlYnVnU3RyaW5nICs9ICdJRFIgJztcbiAgICAgICAgICB9XG4gICAgICAgICAga2V5ID0gdHJ1ZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgLy9TRUlcbiAgICAgICAgY2FzZSA2OlxuICAgICAgICAgIHB1c2ggPSB0cnVlO1xuICAgICAgICAgIGlmKGRlYnVnKSB7XG4gICAgICAgICAgICBkZWJ1Z1N0cmluZyArPSAnU0VJICc7XG4gICAgICAgICAgfVxuICAgICAgICAgIHZhciBleHBHb2xvbWJEZWNvZGVyID0gbmV3IEV4cEdvbG9tYih1bml0LmRhdGEpO1xuXG4gICAgICAgICAgLy8gc2tpcCBmcmFtZVR5cGVcbiAgICAgICAgICBleHBHb2xvbWJEZWNvZGVyLnJlYWRVQnl0ZSgpO1xuXG4gICAgICAgICAgdmFyIHBheWxvYWRUeXBlID0gZXhwR29sb21iRGVjb2Rlci5yZWFkVUJ5dGUoKTtcblxuICAgICAgICAgIC8vIFRPRE86IHRoZXJlIGNhbiBiZSBtb3JlIHRoYW4gb25lIHBheWxvYWQgaW4gYW4gU0VJIHBhY2tldC4uLlxuICAgICAgICAgIC8vIFRPRE86IG5lZWQgdG8gcmVhZCB0eXBlIGFuZCBzaXplIGluIGEgd2hpbGUgbG9vcCB0byBnZXQgdGhlbSBhbGxcbiAgICAgICAgICBpZiAocGF5bG9hZFR5cGUgPT09IDQpXG4gICAgICAgICAge1xuICAgICAgICAgICAgdmFyIHBheWxvYWRTaXplID0gMDtcblxuICAgICAgICAgICAgZG8ge1xuICAgICAgICAgICAgICBwYXlsb2FkU2l6ZSA9IGV4cEdvbG9tYkRlY29kZXIucmVhZFVCeXRlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB3aGlsZSAocGF5bG9hZFNpemUgPT09IDI1NSlcblxuICAgICAgICAgICAgdmFyIGNvdW50cnlDb2RlID0gZXhwR29sb21iRGVjb2Rlci5yZWFkVUJ5dGUoKTtcblxuICAgICAgICAgICAgaWYgKGNvdW50cnlDb2RlID09PSAxODEpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHZhciBwcm92aWRlckNvZGUgPSBleHBHb2xvbWJEZWNvZGVyLnJlYWRVU2hvcnQoKTtcblxuICAgICAgICAgICAgICBpZiAocHJvdmlkZXJDb2RlID09PSA0OSlcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHZhciB1c2VyU3RydWN0dXJlID0gZXhwR29sb21iRGVjb2Rlci5yZWFkVUludCgpO1xuXG4gICAgICAgICAgICAgICAgaWYgKHVzZXJTdHJ1Y3R1cmUgPT09IDB4NDc0MTM5MzQpXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgdmFyIHVzZXJEYXRhVHlwZSA9IGV4cEdvbG9tYkRlY29kZXIucmVhZFVCeXRlKCk7XG5cbiAgICAgICAgICAgICAgICAgIC8vIFJhdyBDRUEtNjA4IGJ5dGVzIHdyYXBwZWQgaW4gQ0VBLTcwOCBwYWNrZXRcbiAgICAgICAgICAgICAgICAgIGlmICh1c2VyRGF0YVR5cGUgPT09IDMpXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBmaXJzdEJ5dGUgPSBleHBHb2xvbWJEZWNvZGVyLnJlYWRVQnl0ZSgpO1xuICAgICAgICAgICAgICAgICAgICB2YXIgc2Vjb25kQnl0ZSA9IGV4cEdvbG9tYkRlY29kZXIucmVhZFVCeXRlKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgdmFyIHRvdGFsQ0NzID0gMzEgJiBmaXJzdEJ5dGU7XG4gICAgICAgICAgICAgICAgICAgIHZhciBzaXplT2ZDQ3MgPSB0b3RhbENDcyAqIDM7XG4gICAgICAgICAgICAgICAgICAgIHZhciBieXRlQXJyYXkgPSBbZmlyc3RCeXRlLCBzZWNvbmRCeXRlXTtcblxuICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpPTA7IGk8dG90YWxDQ3M7IGkrKylcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgIC8vIDMgYnl0ZXMgcGVyIENDXG4gICAgICAgICAgICAgICAgICAgICAgYnl0ZUFycmF5LnB1c2goZXhwR29sb21iRGVjb2Rlci5yZWFkVUJ5dGUoKSk7XG4gICAgICAgICAgICAgICAgICAgICAgYnl0ZUFycmF5LnB1c2goZXhwR29sb21iRGVjb2Rlci5yZWFkVUJ5dGUoKSk7XG4gICAgICAgICAgICAgICAgICAgICAgYnl0ZUFycmF5LnB1c2goZXhwR29sb21iRGVjb2Rlci5yZWFkVUJ5dGUoKSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICB0aGlzLl90eHRUcmFjay5zYW1wbGVzLnB1c2goe3R5cGU6IDMsIHB0czogcGVzLnB0cywgbGV2ZWw6IHRoaXMubGFzdExldmVsLCBieXRlczogYnl0ZUFycmF5fSk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICAvL1NQU1xuICAgICAgICBjYXNlIDc6XG4gICAgICAgICAgcHVzaCA9IHRydWU7XG4gICAgICAgICAgaWYoZGVidWcpIHtcbiAgICAgICAgICAgIGRlYnVnU3RyaW5nICs9ICdTUFMgJztcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYoIXRyYWNrLnNwcykge1xuICAgICAgICAgICAgdmFyIGV4cEdvbG9tYkRlY29kZXIgPSBuZXcgRXhwR29sb21iKHVuaXQuZGF0YSk7XG4gICAgICAgICAgICB2YXIgY29uZmlnID0gZXhwR29sb21iRGVjb2Rlci5yZWFkU1BTKCk7XG4gICAgICAgICAgICB0cmFjay53aWR0aCA9IGNvbmZpZy53aWR0aDtcbiAgICAgICAgICAgIHRyYWNrLmhlaWdodCA9IGNvbmZpZy5oZWlnaHQ7XG4gICAgICAgICAgICB0cmFjay5zcHMgPSBbdW5pdC5kYXRhXTtcbiAgICAgICAgICAgIHRyYWNrLnRpbWVzY2FsZSA9IHRoaXMucmVtdXhlci50aW1lc2NhbGU7XG4gICAgICAgICAgICB0cmFjay5kdXJhdGlvbiA9IHRoaXMucmVtdXhlci50aW1lc2NhbGUgKiB0aGlzLl9kdXJhdGlvbjtcbiAgICAgICAgICAgIHZhciBjb2RlY2FycmF5ID0gdW5pdC5kYXRhLnN1YmFycmF5KDEsIDQpO1xuICAgICAgICAgICAgdmFyIGNvZGVjc3RyaW5nID0gJ2F2YzEuJztcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgMzsgaSsrKSB7XG4gICAgICAgICAgICAgIHZhciBoID0gY29kZWNhcnJheVtpXS50b1N0cmluZygxNik7XG4gICAgICAgICAgICAgIGlmIChoLmxlbmd0aCA8IDIpIHtcbiAgICAgICAgICAgICAgICBoID0gJzAnICsgaDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBjb2RlY3N0cmluZyArPSBoO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdHJhY2suY29kZWMgPSBjb2RlY3N0cmluZztcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIC8vUFBTXG4gICAgICAgIGNhc2UgODpcbiAgICAgICAgICBwdXNoID0gdHJ1ZTtcbiAgICAgICAgICBpZihkZWJ1Zykge1xuICAgICAgICAgICAgZGVidWdTdHJpbmcgKz0gJ1BQUyAnO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoIXRyYWNrLnBwcykge1xuICAgICAgICAgICAgdHJhY2sucHBzID0gW3VuaXQuZGF0YV07XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDk6XG4gICAgICAgICAgcHVzaCA9IHRydWU7XG4gICAgICAgICAgaWYoZGVidWcpIHtcbiAgICAgICAgICAgIGRlYnVnU3RyaW5nICs9ICdBVUQgJztcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgcHVzaCA9IGZhbHNlO1xuICAgICAgICAgIGRlYnVnU3RyaW5nICs9ICd1bmtub3duIE5BTCAnICsgdW5pdC50eXBlICsgJyAnO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgaWYocHVzaCkge1xuICAgICAgICB1bml0czIucHVzaCh1bml0KTtcbiAgICAgICAgbGVuZ3RoKz11bml0LmRhdGEuYnl0ZUxlbmd0aDtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBpZihkZWJ1ZyB8fCBkZWJ1Z1N0cmluZy5sZW5ndGgpIHtcbiAgICAgIGxvZ2dlci5sb2coZGVidWdTdHJpbmcpO1xuICAgIH1cbiAgICAvL2J1aWxkIHNhbXBsZSBmcm9tIFBFU1xuICAgIC8vIEFubmV4IEIgdG8gTVA0IGNvbnZlcnNpb24gdG8gYmUgZG9uZVxuICAgIGlmICh1bml0czIubGVuZ3RoKSB7XG4gICAgICAvLyBvbmx5IHB1c2ggQVZDIHNhbXBsZSBpZiBrZXlmcmFtZSBhbHJlYWR5IGZvdW5kLiBicm93c2VycyBleHBlY3QgYSBrZXlmcmFtZSBhdCBmaXJzdCB0byBzdGFydCBkZWNvZGluZ1xuICAgICAgaWYgKGtleSA9PT0gdHJ1ZSB8fCB0cmFjay5zcHMgKSB7XG4gICAgICAgIGF2Y1NhbXBsZSA9IHt1bml0czogeyB1bml0cyA6IHVuaXRzMiwgbGVuZ3RoIDogbGVuZ3RofSwgcHRzOiBwZXMucHRzLCBkdHM6IHBlcy5kdHMsIGtleToga2V5fTtcbiAgICAgICAgc2FtcGxlcy5wdXNoKGF2Y1NhbXBsZSk7XG4gICAgICAgIHRyYWNrLmxlbiArPSBsZW5ndGg7XG4gICAgICAgIHRyYWNrLm5iTmFsdSArPSB1bml0czIubGVuZ3RoO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG5cbiAgX3BhcnNlQVZDTkFMdShhcnJheSkge1xuICAgIHZhciBpID0gMCwgbGVuID0gYXJyYXkuYnl0ZUxlbmd0aCwgdmFsdWUsIG92ZXJmbG93LCBzdGF0ZSA9IDA7XG4gICAgdmFyIHVuaXRzID0gW10sIHVuaXQsIHVuaXRUeXBlLCBsYXN0VW5pdFN0YXJ0LCBsYXN0VW5pdFR5cGU7XG4gICAgLy9sb2dnZXIubG9nKCdQRVM6JyArIEhleC5oZXhEdW1wKGFycmF5KSk7XG4gICAgd2hpbGUgKGkgPCBsZW4pIHtcbiAgICAgIHZhbHVlID0gYXJyYXlbaSsrXTtcbiAgICAgIC8vIGZpbmRpbmcgMyBvciA0LWJ5dGUgc3RhcnQgY29kZXMgKDAwIDAwIDAxIE9SIDAwIDAwIDAwIDAxKVxuICAgICAgc3dpdGNoIChzdGF0ZSkge1xuICAgICAgICBjYXNlIDA6XG4gICAgICAgICAgaWYgKHZhbHVlID09PSAwKSB7XG4gICAgICAgICAgICBzdGF0ZSA9IDE7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgaWYoIHZhbHVlID09PSAwKSB7XG4gICAgICAgICAgICBzdGF0ZSA9IDI7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHN0YXRlID0gMDtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgMjpcbiAgICAgICAgY2FzZSAzOlxuICAgICAgICAgIGlmKCB2YWx1ZSA9PT0gMCkge1xuICAgICAgICAgICAgc3RhdGUgPSAzO1xuICAgICAgICAgIH0gZWxzZSBpZiAodmFsdWUgPT09IDEpIHtcbiAgICAgICAgICAgIHVuaXRUeXBlID0gYXJyYXlbaV0gJiAweDFmO1xuICAgICAgICAgICAgLy9sb2dnZXIubG9nKCdmaW5kIE5BTFUgQCBvZmZzZXQ6JyArIGkgKyAnLHR5cGU6JyArIHVuaXRUeXBlKTtcbiAgICAgICAgICAgIGlmIChsYXN0VW5pdFN0YXJ0KSB7XG4gICAgICAgICAgICAgIHVuaXQgPSB7ZGF0YTogYXJyYXkuc3ViYXJyYXkobGFzdFVuaXRTdGFydCwgaSAtIHN0YXRlIC0gMSksIHR5cGU6IGxhc3RVbml0VHlwZX07XG4gICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygncHVzaGluZyBOQUxVLCB0eXBlL3NpemU6JyArIHVuaXQudHlwZSArICcvJyArIHVuaXQuZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICAgICAgICAgICAgdW5pdHMucHVzaCh1bml0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIElmIE5BTCB1bml0cyBhcmUgbm90IHN0YXJ0aW5nIHJpZ2h0IGF0IHRoZSBiZWdpbm5pbmcgb2YgdGhlIFBFUyBwYWNrZXQsIHB1c2ggcHJlY2VkaW5nIGRhdGEgaW50byBwcmV2aW91cyBOQUwgdW5pdC5cbiAgICAgICAgICAgICAgb3ZlcmZsb3cgID0gaSAtIHN0YXRlIC0gMTtcbiAgICAgICAgICAgICAgaWYgKG92ZXJmbG93KSB7XG4gICAgICAgICAgICAgICAgdmFyIHRyYWNrID0gdGhpcy5fYXZjVHJhY2ssXG4gICAgICAgICAgICAgICAgICAgIHNhbXBsZXMgPSB0cmFjay5zYW1wbGVzO1xuICAgICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnZmlyc3QgTkFMVSBmb3VuZCB3aXRoIG92ZXJmbG93OicgKyBvdmVyZmxvdyk7XG4gICAgICAgICAgICAgICAgaWYgKHNhbXBsZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICB2YXIgbGFzdGF2Y1NhbXBsZSA9IHNhbXBsZXNbc2FtcGxlcy5sZW5ndGggLSAxXSxcbiAgICAgICAgICAgICAgICAgICAgICBsYXN0VW5pdHMgPSBsYXN0YXZjU2FtcGxlLnVuaXRzLnVuaXRzLFxuICAgICAgICAgICAgICAgICAgICAgIGxhc3RVbml0ID0gbGFzdFVuaXRzW2xhc3RVbml0cy5sZW5ndGggLSAxXSxcbiAgICAgICAgICAgICAgICAgICAgICB0bXAgPSBuZXcgVWludDhBcnJheShsYXN0VW5pdC5kYXRhLmJ5dGVMZW5ndGggKyBvdmVyZmxvdyk7XG4gICAgICAgICAgICAgICAgICB0bXAuc2V0KGxhc3RVbml0LmRhdGEsIDApO1xuICAgICAgICAgICAgICAgICAgdG1wLnNldChhcnJheS5zdWJhcnJheSgwLCBvdmVyZmxvdyksIGxhc3RVbml0LmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICAgICAgICAgICAgICBsYXN0VW5pdC5kYXRhID0gdG1wO1xuICAgICAgICAgICAgICAgICAgbGFzdGF2Y1NhbXBsZS51bml0cy5sZW5ndGggKz0gb3ZlcmZsb3c7XG4gICAgICAgICAgICAgICAgICB0cmFjay5sZW4gKz0gb3ZlcmZsb3c7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsYXN0VW5pdFN0YXJ0ID0gaTtcbiAgICAgICAgICAgIGxhc3RVbml0VHlwZSA9IHVuaXRUeXBlO1xuICAgICAgICAgICAgaWYgKHVuaXRUeXBlID09PSAxIHx8IHVuaXRUeXBlID09PSA1KSB7XG4gICAgICAgICAgICAgIC8vIE9QVEkgISEhIGlmIElEUi9ORFIgdW5pdCwgY29uc2lkZXIgaXQgaXMgbGFzdCBOQUx1XG4gICAgICAgICAgICAgIGkgPSBsZW47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzdGF0ZSA9IDA7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHN0YXRlID0gMDtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChsYXN0VW5pdFN0YXJ0KSB7XG4gICAgICB1bml0ID0ge2RhdGE6IGFycmF5LnN1YmFycmF5KGxhc3RVbml0U3RhcnQsIGxlbiksIHR5cGU6IGxhc3RVbml0VHlwZX07XG4gICAgICB1bml0cy5wdXNoKHVuaXQpO1xuICAgICAgLy9sb2dnZXIubG9nKCdwdXNoaW5nIE5BTFUsIHR5cGUvc2l6ZTonICsgdW5pdC50eXBlICsgJy8nICsgdW5pdC5kYXRhLmJ5dGVMZW5ndGgpO1xuICAgIH1cbiAgICByZXR1cm4gdW5pdHM7XG4gIH1cblxuICBfcGFyc2VBQUNQRVMocGVzKSB7XG4gICAgdmFyIHRyYWNrID0gdGhpcy5fYWFjVHJhY2ssXG4gICAgICAgIGRhdGEgPSBwZXMuZGF0YSxcbiAgICAgICAgcHRzID0gcGVzLnB0cyxcbiAgICAgICAgc3RhcnRPZmZzZXQgPSAwLFxuICAgICAgICBkdXJhdGlvbiA9IHRoaXMuX2R1cmF0aW9uLFxuICAgICAgICBhdWRpb0NvZGVjID0gdGhpcy5hdWRpb0NvZGVjLFxuICAgICAgICBjb25maWcsIGFkdHNGcmFtZVNpemUsIGFkdHNTdGFydE9mZnNldCwgYWR0c0hlYWRlckxlbiwgc3RhbXAsIG5iU2FtcGxlcywgbGVuLCBhYWNTYW1wbGU7XG4gICAgaWYgKHRoaXMuYWFjT3ZlckZsb3cpIHtcbiAgICAgIHZhciB0bXAgPSBuZXcgVWludDhBcnJheSh0aGlzLmFhY092ZXJGbG93LmJ5dGVMZW5ndGggKyBkYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgdG1wLnNldCh0aGlzLmFhY092ZXJGbG93LCAwKTtcbiAgICAgIHRtcC5zZXQoZGF0YSwgdGhpcy5hYWNPdmVyRmxvdy5ieXRlTGVuZ3RoKTtcbiAgICAgIGRhdGEgPSB0bXA7XG4gICAgfVxuICAgIC8vIGxvb2sgZm9yIEFEVFMgaGVhZGVyICgweEZGRngpXG4gICAgZm9yIChhZHRzU3RhcnRPZmZzZXQgPSBzdGFydE9mZnNldCwgbGVuID0gZGF0YS5sZW5ndGg7IGFkdHNTdGFydE9mZnNldCA8IGxlbiAtIDE7IGFkdHNTdGFydE9mZnNldCsrKSB7XG4gICAgICBpZiAoKGRhdGFbYWR0c1N0YXJ0T2Zmc2V0XSA9PT0gMHhmZikgJiYgKGRhdGFbYWR0c1N0YXJ0T2Zmc2V0KzFdICYgMHhmMCkgPT09IDB4ZjApIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGlmIEFEVFMgaGVhZGVyIGRvZXMgbm90IHN0YXJ0IHN0cmFpZ2h0IGZyb20gdGhlIGJlZ2lubmluZyBvZiB0aGUgUEVTIHBheWxvYWQsIHJhaXNlIGFuIGVycm9yXG4gICAgaWYgKGFkdHNTdGFydE9mZnNldCkge1xuICAgICAgdmFyIHJlYXNvbiwgZmF0YWw7XG4gICAgICBpZiAoYWR0c1N0YXJ0T2Zmc2V0IDwgbGVuIC0gMSkge1xuICAgICAgICByZWFzb24gPSBgQUFDIFBFUyBkaWQgbm90IHN0YXJ0IHdpdGggQURUUyBoZWFkZXIsb2Zmc2V0OiR7YWR0c1N0YXJ0T2Zmc2V0fWA7XG4gICAgICAgIGZhdGFsID0gZmFsc2U7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZWFzb24gPSAnbm8gQURUUyBoZWFkZXIgZm91bmQgaW4gQUFDIFBFUyc7XG4gICAgICAgIGZhdGFsID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHRoaXMub2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5GUkFHX1BBUlNJTkdfRVJST1IsIGZhdGFsOiBmYXRhbCwgcmVhc29uOiByZWFzb259KTtcbiAgICAgIGlmIChmYXRhbCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuICAgIGlmICghdHJhY2suYXVkaW9zYW1wbGVyYXRlKSB7XG4gICAgICBjb25maWcgPSBBRFRTLmdldEF1ZGlvQ29uZmlnKHRoaXMub2JzZXJ2ZXIsZGF0YSwgYWR0c1N0YXJ0T2Zmc2V0LCBhdWRpb0NvZGVjKTtcbiAgICAgIHRyYWNrLmNvbmZpZyA9IGNvbmZpZy5jb25maWc7XG4gICAgICB0cmFjay5hdWRpb3NhbXBsZXJhdGUgPSBjb25maWcuc2FtcGxlcmF0ZTtcbiAgICAgIHRyYWNrLmNoYW5uZWxDb3VudCA9IGNvbmZpZy5jaGFubmVsQ291bnQ7XG4gICAgICB0cmFjay5jb2RlYyA9IGNvbmZpZy5jb2RlYztcbiAgICAgIHRyYWNrLnRpbWVzY2FsZSA9IHRoaXMucmVtdXhlci50aW1lc2NhbGU7XG4gICAgICB0cmFjay5kdXJhdGlvbiA9IHRoaXMucmVtdXhlci50aW1lc2NhbGUgKiBkdXJhdGlvbjtcbiAgICAgIGxvZ2dlci5sb2coYHBhcnNlZCBjb2RlYzoke3RyYWNrLmNvZGVjfSxyYXRlOiR7Y29uZmlnLnNhbXBsZXJhdGV9LG5iIGNoYW5uZWw6JHtjb25maWcuY2hhbm5lbENvdW50fWApO1xuICAgIH1cbiAgICBuYlNhbXBsZXMgPSAwO1xuICAgIHdoaWxlICgoYWR0c1N0YXJ0T2Zmc2V0ICsgNSkgPCBsZW4pIHtcbiAgICAgIC8vIHJldHJpZXZlIGZyYW1lIHNpemVcbiAgICAgIGFkdHNGcmFtZVNpemUgPSAoKGRhdGFbYWR0c1N0YXJ0T2Zmc2V0ICsgM10gJiAweDAzKSA8PCAxMSk7XG4gICAgICAvLyBieXRlIDRcbiAgICAgIGFkdHNGcmFtZVNpemUgfD0gKGRhdGFbYWR0c1N0YXJ0T2Zmc2V0ICsgNF0gPDwgMyk7XG4gICAgICAvLyBieXRlIDVcbiAgICAgIGFkdHNGcmFtZVNpemUgfD0gKChkYXRhW2FkdHNTdGFydE9mZnNldCArIDVdICYgMHhFMCkgPj4+IDUpO1xuICAgICAgYWR0c0hlYWRlckxlbiA9ICghIShkYXRhW2FkdHNTdGFydE9mZnNldCArIDFdICYgMHgwMSkgPyA3IDogOSk7XG4gICAgICBhZHRzRnJhbWVTaXplIC09IGFkdHNIZWFkZXJMZW47XG4gICAgICBzdGFtcCA9IE1hdGgucm91bmQocHRzICsgbmJTYW1wbGVzICogMTAyNCAqIDkwMDAwIC8gdHJhY2suYXVkaW9zYW1wbGVyYXRlKTtcbiAgICAgIC8vc3RhbXAgPSBwZXMucHRzO1xuICAgICAgLy9jb25zb2xlLmxvZygnQUFDIGZyYW1lLCBvZmZzZXQvbGVuZ3RoL3B0czonICsgKGFkdHNTdGFydE9mZnNldCs3KSArICcvJyArIGFkdHNGcmFtZVNpemUgKyAnLycgKyBzdGFtcC50b0ZpeGVkKDApKTtcbiAgICAgIGlmICgoYWR0c0ZyYW1lU2l6ZSA+IDApICYmICgoYWR0c1N0YXJ0T2Zmc2V0ICsgYWR0c0hlYWRlckxlbiArIGFkdHNGcmFtZVNpemUpIDw9IGxlbikpIHtcbiAgICAgICAgYWFjU2FtcGxlID0ge3VuaXQ6IGRhdGEuc3ViYXJyYXkoYWR0c1N0YXJ0T2Zmc2V0ICsgYWR0c0hlYWRlckxlbiwgYWR0c1N0YXJ0T2Zmc2V0ICsgYWR0c0hlYWRlckxlbiArIGFkdHNGcmFtZVNpemUpLCBwdHM6IHN0YW1wLCBkdHM6IHN0YW1wfTtcbiAgICAgICAgdHJhY2suc2FtcGxlcy5wdXNoKGFhY1NhbXBsZSk7XG4gICAgICAgIHRyYWNrLmxlbiArPSBhZHRzRnJhbWVTaXplO1xuICAgICAgICBhZHRzU3RhcnRPZmZzZXQgKz0gYWR0c0ZyYW1lU2l6ZSArIGFkdHNIZWFkZXJMZW47XG4gICAgICAgIG5iU2FtcGxlcysrO1xuICAgICAgICAvLyBsb29rIGZvciBBRFRTIGhlYWRlciAoMHhGRkZ4KVxuICAgICAgICBmb3IgKCA7IGFkdHNTdGFydE9mZnNldCA8IChsZW4gLSAxKTsgYWR0c1N0YXJ0T2Zmc2V0KyspIHtcbiAgICAgICAgICBpZiAoKGRhdGFbYWR0c1N0YXJ0T2Zmc2V0XSA9PT0gMHhmZikgJiYgKChkYXRhW2FkdHNTdGFydE9mZnNldCArIDFdICYgMHhmMCkgPT09IDB4ZjApKSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoYWR0c1N0YXJ0T2Zmc2V0IDwgbGVuKSB7XG4gICAgICB0aGlzLmFhY092ZXJGbG93ID0gZGF0YS5zdWJhcnJheShhZHRzU3RhcnRPZmZzZXQsIGxlbik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuYWFjT3ZlckZsb3cgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIF9wYXJzZUlEM1BFUyhwZXMpIHtcbiAgICB0aGlzLl9pZDNUcmFjay5zYW1wbGVzLnB1c2gocGVzKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBUU0RlbXV4ZXI7XG5cbiIsImV4cG9ydCBjb25zdCBFcnJvclR5cGVzID0ge1xuICAvLyBJZGVudGlmaWVyIGZvciBhIG5ldHdvcmsgZXJyb3IgKGxvYWRpbmcgZXJyb3IgLyB0aW1lb3V0IC4uLilcbiAgTkVUV09SS19FUlJPUjogJ2hsc05ldHdvcmtFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgbWVkaWEgRXJyb3IgKHZpZGVvL3BhcnNpbmcvbWVkaWFzb3VyY2UgZXJyb3IpXG4gIE1FRElBX0VSUk9SOiAnaGxzTWVkaWFFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGFsbCBvdGhlciBlcnJvcnNcbiAgT1RIRVJfRVJST1I6ICdobHNPdGhlckVycm9yJ1xufTtcblxuZXhwb3J0IGNvbnN0IEVycm9yRGV0YWlscyA9IHtcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBtYW5pZmVzdCBsb2FkIGVycm9yIC0gZGF0YTogeyB1cmwgOiBmYXVsdHkgVVJMLCByZXNwb25zZSA6IFhIUiByZXNwb25zZX1cbiAgTUFOSUZFU1RfTE9BRF9FUlJPUjogJ21hbmlmZXN0TG9hZEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBtYW5pZmVzdCBsb2FkIHRpbWVvdXQgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBNQU5JRkVTVF9MT0FEX1RJTUVPVVQ6ICdtYW5pZmVzdExvYWRUaW1lT3V0JyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBtYW5pZmVzdCBwYXJzaW5nIGVycm9yIC0gZGF0YTogeyB1cmwgOiBmYXVsdHkgVVJMLCByZWFzb24gOiBlcnJvciByZWFzb259XG4gIE1BTklGRVNUX1BBUlNJTkdfRVJST1I6ICdtYW5pZmVzdFBhcnNpbmdFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIHBsYXlsaXN0IGxvYWQgZXJyb3IgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBMRVZFTF9MT0FEX0VSUk9SOiAnbGV2ZWxMb2FkRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBwbGF5bGlzdCBsb2FkIHRpbWVvdXQgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBMRVZFTF9MT0FEX1RJTUVPVVQ6ICdsZXZlbExvYWRUaW1lT3V0JyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBsZXZlbCBzd2l0Y2ggZXJyb3IgLSBkYXRhOiB7IGxldmVsIDogZmF1bHR5IGxldmVsIElkLCBldmVudCA6IGVycm9yIGRlc2NyaXB0aW9ufVxuICBMRVZFTF9TV0lUQ0hfRVJST1I6ICdsZXZlbFN3aXRjaEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgZnJhZ21lbnQgbG9hZCBlcnJvciAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdCwgcmVzcG9uc2UgOiBYSFIgcmVzcG9uc2V9XG4gIEZSQUdfTE9BRF9FUlJPUjogJ2ZyYWdMb2FkRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBmcmFnbWVudCBsb29wIGxvYWRpbmcgZXJyb3IgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3R9XG4gIEZSQUdfTE9PUF9MT0FESU5HX0VSUk9SOiAnZnJhZ0xvb3BMb2FkaW5nRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBmcmFnbWVudCBsb2FkIHRpbWVvdXQgZXJyb3IgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3R9XG4gIEZSQUdfTE9BRF9USU1FT1VUOiAnZnJhZ0xvYWRUaW1lT3V0JyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBmcmFnbWVudCBkZWNyeXB0aW9uIGVycm9yIGV2ZW50IC0gZGF0YTogcGFyc2luZyBlcnJvciBkZXNjcmlwdGlvblxuICBGUkFHX0RFQ1JZUFRfRVJST1I6ICdmcmFnRGVjcnlwdEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBmcmFnbWVudCBwYXJzaW5nIGVycm9yIGV2ZW50IC0gZGF0YTogcGFyc2luZyBlcnJvciBkZXNjcmlwdGlvblxuICBGUkFHX1BBUlNJTkdfRVJST1I6ICdmcmFnUGFyc2luZ0Vycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgZGVjcnlwdCBrZXkgbG9hZCBlcnJvciAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdCwgcmVzcG9uc2UgOiBYSFIgcmVzcG9uc2V9XG4gIEtFWV9MT0FEX0VSUk9SOiAna2V5TG9hZEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgZGVjcnlwdCBrZXkgbG9hZCB0aW1lb3V0IGVycm9yIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0fVxuICBLRVlfTE9BRF9USU1FT1VUOiAna2V5TG9hZFRpbWVPdXQnLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIGJ1ZmZlciBhcHBlbmQgZXJyb3IgLSBkYXRhOiBhcHBlbmQgZXJyb3IgZGVzY3JpcHRpb25cbiAgQlVGRkVSX0FQUEVORF9FUlJPUjogJ2J1ZmZlckFwcGVuZEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBidWZmZXIgYXBwZW5kaW5nIGVycm9yIGV2ZW50IC0gZGF0YTogYXBwZW5kaW5nIGVycm9yIGRlc2NyaXB0aW9uXG4gIEJVRkZFUl9BUFBFTkRJTkdfRVJST1I6ICdidWZmZXJBcHBlbmRpbmdFcnJvcidcbn07XG4iLCJleHBvcnQgZGVmYXVsdCB7XG4gIC8vIGZpcmVkIGJlZm9yZSBNZWRpYVNvdXJjZSBpcyBhdHRhY2hpbmcgdG8gbWVkaWEgZWxlbWVudCAtIGRhdGE6IHsgbWVkaWEgfVxuICBNRURJQV9BVFRBQ0hJTkc6ICdobHNNZWRpYUF0dGFjaGluZycsXG4gIC8vIGZpcmVkIHdoZW4gTWVkaWFTb3VyY2UgaGFzIGJlZW4gc3VjY2VzZnVsbHkgYXR0YWNoZWQgdG8gbWVkaWEgZWxlbWVudCAtIGRhdGE6IHsgfVxuICBNRURJQV9BVFRBQ0hFRDogJ2hsc01lZGlhQXR0YWNoZWQnLFxuICAvLyBmaXJlZCBiZWZvcmUgZGV0YWNoaW5nIE1lZGlhU291cmNlIGZyb20gbWVkaWEgZWxlbWVudCAtIGRhdGE6IHsgfVxuICBNRURJQV9ERVRBQ0hJTkc6ICdobHNNZWRpYURldGFjaGluZycsXG4gIC8vIGZpcmVkIHdoZW4gTWVkaWFTb3VyY2UgaGFzIGJlZW4gZGV0YWNoZWQgZnJvbSBtZWRpYSBlbGVtZW50IC0gZGF0YTogeyB9XG4gIE1FRElBX0RFVEFDSEVEOiAnaGxzTWVkaWFEZXRhY2hlZCcsXG4gIC8vIGZpcmVkIHRvIHNpZ25hbCB0aGF0IGEgbWFuaWZlc3QgbG9hZGluZyBzdGFydHMgLSBkYXRhOiB7IHVybCA6IG1hbmlmZXN0VVJMfVxuICBNQU5JRkVTVF9MT0FESU5HOiAnaGxzTWFuaWZlc3RMb2FkaW5nJyxcbiAgLy8gZmlyZWQgYWZ0ZXIgbWFuaWZlc3QgaGFzIGJlZW4gbG9hZGVkIC0gZGF0YTogeyBsZXZlbHMgOiBbYXZhaWxhYmxlIHF1YWxpdHkgbGV2ZWxzXSAsIHVybCA6IG1hbmlmZXN0VVJMLCBzdGF0cyA6IHsgdHJlcXVlc3QsIHRmaXJzdCwgdGxvYWQsIG10aW1lfX1cbiAgTUFOSUZFU1RfTE9BREVEOiAnaGxzTWFuaWZlc3RMb2FkZWQnLFxuICAvLyBmaXJlZCBhZnRlciBtYW5pZmVzdCBoYXMgYmVlbiBwYXJzZWQgLSBkYXRhOiB7IGxldmVscyA6IFthdmFpbGFibGUgcXVhbGl0eSBsZXZlbHNdICwgZmlyc3RMZXZlbCA6IGluZGV4IG9mIGZpcnN0IHF1YWxpdHkgbGV2ZWwgYXBwZWFyaW5nIGluIE1hbmlmZXN0fVxuICBNQU5JRkVTVF9QQVJTRUQ6ICdobHNNYW5pZmVzdFBhcnNlZCcsXG4gIC8vIGZpcmVkIHdoZW4gYSBsZXZlbCBwbGF5bGlzdCBsb2FkaW5nIHN0YXJ0cyAtIGRhdGE6IHsgdXJsIDogbGV2ZWwgVVJMICBsZXZlbCA6IGlkIG9mIGxldmVsIGJlaW5nIGxvYWRlZH1cbiAgTEVWRUxfTE9BRElORzogJ2hsc0xldmVsTG9hZGluZycsXG4gIC8vIGZpcmVkIHdoZW4gYSBsZXZlbCBwbGF5bGlzdCBsb2FkaW5nIGZpbmlzaGVzIC0gZGF0YTogeyBkZXRhaWxzIDogbGV2ZWxEZXRhaWxzIG9iamVjdCwgbGV2ZWwgOiBpZCBvZiBsb2FkZWQgbGV2ZWwsIHN0YXRzIDogeyB0cmVxdWVzdCwgdGZpcnN0LCB0bG9hZCwgbXRpbWV9IH1cbiAgTEVWRUxfTE9BREVEOiAnaGxzTGV2ZWxMb2FkZWQnLFxuICAvLyBmaXJlZCB3aGVuIGEgbGV2ZWwncyBkZXRhaWxzIGhhdmUgYmVlbiB1cGRhdGVkIGJhc2VkIG9uIHByZXZpb3VzIGRldGFpbHMsIGFmdGVyIGl0IGhhcyBiZWVuIGxvYWRlZC4gLSBkYXRhOiB7IGRldGFpbHMgOiBsZXZlbERldGFpbHMgb2JqZWN0LCBsZXZlbCA6IGlkIG9mIHVwZGF0ZWQgbGV2ZWwgfVxuICBMRVZFTF9VUERBVEVEOiAnaGxzTGV2ZWxVcGRhdGVkJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGxldmVsJ3MgUFRTIGluZm9ybWF0aW9uIGhhcyBiZWVuIHVwZGF0ZWQgYWZ0ZXIgcGFyc2luZyBhIGZyYWdtZW50IC0gZGF0YTogeyBkZXRhaWxzIDogbGV2ZWxEZXRhaWxzIG9iamVjdCwgbGV2ZWwgOiBpZCBvZiB1cGRhdGVkIGxldmVsLCBkcmlmdDogUFRTIGRyaWZ0IG9ic2VydmVkIHdoZW4gcGFyc2luZyBsYXN0IGZyYWdtZW50IH1cbiAgTEVWRUxfUFRTX1VQREFURUQ6ICdobHNQVFNVcGRhdGVkJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGxldmVsIHN3aXRjaCBpcyByZXF1ZXN0ZWQgLSBkYXRhOiB7IGxldmVsIDogaWQgb2YgbmV3IGxldmVsIH1cbiAgTEVWRUxfU1dJVENIOiAnaGxzTGV2ZWxTd2l0Y2gnLFxuICAvLyBmaXJlZCB3aGVuIGEgZnJhZ21lbnQgbG9hZGluZyBzdGFydHMgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3R9XG4gIEZSQUdfTE9BRElORzogJ2hsc0ZyYWdMb2FkaW5nJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGZyYWdtZW50IGxvYWRpbmcgaXMgcHJvZ3Jlc3NpbmcgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QsIHsgdHJlcXVlc3QsIHRmaXJzdCwgbG9hZGVkfX1cbiAgRlJBR19MT0FEX1BST0dSRVNTOiAnaGxzRnJhZ0xvYWRQcm9ncmVzcycsXG4gIC8vIElkZW50aWZpZXIgZm9yIGZyYWdtZW50IGxvYWQgYWJvcnRpbmcgZm9yIGVtZXJnZW5jeSBzd2l0Y2ggZG93biAtIGRhdGE6IHtmcmFnIDogZnJhZ21lbnQgb2JqZWN0fVxuICBGUkFHX0xPQURfRU1FUkdFTkNZX0FCT1JURUQ6ICdobHNGcmFnTG9hZEVtZXJnZW5jeUFib3J0ZWQnLFxuICAvLyBmaXJlZCB3aGVuIGEgZnJhZ21lbnQgbG9hZGluZyBpcyBjb21wbGV0ZWQgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QsIHBheWxvYWQgOiBmcmFnbWVudCBwYXlsb2FkLCBzdGF0cyA6IHsgdHJlcXVlc3QsIHRmaXJzdCwgdGxvYWQsIGxlbmd0aH19XG4gIEZSQUdfTE9BREVEOiAnaGxzRnJhZ0xvYWRlZCcsXG4gIC8vIGZpcmVkIHdoZW4gSW5pdCBTZWdtZW50IGhhcyBiZWVuIGV4dHJhY3RlZCBmcm9tIGZyYWdtZW50IC0gZGF0YTogeyBtb292IDogbW9vdiBNUDQgYm94LCBjb2RlY3MgOiBjb2RlY3MgZm91bmQgd2hpbGUgcGFyc2luZyBmcmFnbWVudH1cbiAgRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVDogJ2hsc0ZyYWdQYXJzaW5nSW5pdFNlZ21lbnQnLFxuICAvLyBmaXJlZCB3aGVuIHBhcnNpbmcgc2VpIHRleHQgaXMgY29tcGxldGVkIC0gZGF0YTogeyBzYW1wbGVzIDogWyBzZWkgc2FtcGxlcyBwZXMgXSB9XG4gIEZSQUdfUEFSU0lOR19VU0VSREFUQTogJ2hsc0ZyYVBhcnNpbmdVc2VyZGF0YScsXG4gIC8vIGZpcmVkIHdoZW4gcGFyc2luZyBpZDMgaXMgY29tcGxldGVkIC0gZGF0YTogeyBzYW1wbGVzIDogWyBpZDMgc2FtcGxlcyBwZXMgXSB9XG4gIEZSQUdfUEFSU0lOR19NRVRBREFUQTogJ2hsc0ZyYVBhcnNpbmdNZXRhZGF0YScsXG4gIC8vIGZpcmVkIHdoZW4gbW9vZi9tZGF0IGhhdmUgYmVlbiBleHRyYWN0ZWQgZnJvbSBmcmFnbWVudCAtIGRhdGE6IHsgbW9vZiA6IG1vb2YgTVA0IGJveCwgbWRhdCA6IG1kYXQgTVA0IGJveH1cbiAgRlJBR19QQVJTSU5HX0RBVEE6ICdobHNGcmFnUGFyc2luZ0RhdGEnLFxuICAvLyBmaXJlZCB3aGVuIGZyYWdtZW50IHBhcnNpbmcgaXMgY29tcGxldGVkIC0gZGF0YTogdW5kZWZpbmVkXG4gIEZSQUdfUEFSU0VEOiAnaGxzRnJhZ1BhcnNlZCcsXG4gIC8vIGZpcmVkIHdoZW4gZnJhZ21lbnQgcmVtdXhlZCBNUDQgYm94ZXMgaGF2ZSBhbGwgYmVlbiBhcHBlbmRlZCBpbnRvIFNvdXJjZUJ1ZmZlciAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdCwgc3RhdHMgOiB7IHRyZXF1ZXN0LCB0Zmlyc3QsIHRsb2FkLCB0cGFyc2VkLCB0YnVmZmVyZWQsIGxlbmd0aH0gfVxuICBGUkFHX0JVRkZFUkVEOiAnaGxzRnJhZ0J1ZmZlcmVkJyxcbiAgLy8gZmlyZWQgd2hlbiBmcmFnbWVudCBtYXRjaGluZyB3aXRoIGN1cnJlbnQgbWVkaWEgcG9zaXRpb24gaXMgY2hhbmdpbmcgLSBkYXRhIDogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0IH1cbiAgRlJBR19DSEFOR0VEOiAnaGxzRnJhZ0NoYW5nZWQnLFxuICAgIC8vIElkZW50aWZpZXIgZm9yIGEgRlBTIGRyb3AgZXZlbnQgLSBkYXRhOiB7Y3VyZW50RHJvcHBlZCwgY3VycmVudERlY29kZWQsIHRvdGFsRHJvcHBlZEZyYW1lc31cbiAgRlBTX0RST1A6ICdobHNGUFNEcm9wJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYW4gZXJyb3IgZXZlbnQgLSBkYXRhOiB7IHR5cGUgOiBlcnJvciB0eXBlLCBkZXRhaWxzIDogZXJyb3IgZGV0YWlscywgZmF0YWwgOiBpZiB0cnVlLCBobHMuanMgY2Fubm90L3dpbGwgbm90IHRyeSB0byByZWNvdmVyLCBpZiBmYWxzZSwgaGxzLmpzIHdpbGwgdHJ5IHRvIHJlY292ZXIsb3RoZXIgZXJyb3Igc3BlY2lmaWMgZGF0YX1cbiAgRVJST1I6ICdobHNFcnJvcicsXG4gIC8vIGZpcmVkIHdoZW4gaGxzLmpzIGluc3RhbmNlIHN0YXJ0cyBkZXN0cm95aW5nLiBEaWZmZXJlbnQgZnJvbSBNRURJQV9ERVRBQ0hFRCBhcyBvbmUgY291bGQgd2FudCB0byBkZXRhY2ggYW5kIHJlYXR0YWNoIGEgbWVkaWEgdG8gdGhlIGluc3RhbmNlIG9mIGhscy5qcyB0byBoYW5kbGUgbWlkLXJvbGxzIGZvciBleGFtcGxlXG4gIERFU1RST1lJTkc6ICdobHNEZXN0cm95aW5nJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGRlY3J5cHQga2V5IGxvYWRpbmcgc3RhcnRzIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0fVxuICBLRVlfTE9BRElORzogJ2hsc0tleUxvYWRpbmcnLFxuICAvLyBmaXJlZCB3aGVuIGEgZGVjcnlwdCBrZXkgbG9hZGluZyBpcyBjb21wbGV0ZWQgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QsIHBheWxvYWQgOiBrZXkgcGF5bG9hZCwgc3RhdHMgOiB7IHRyZXF1ZXN0LCB0Zmlyc3QsIHRsb2FkLCBsZW5ndGh9fVxuICBLRVlfTE9BREVEOiAnaGxzS2V5TG9hZGVkJyxcbn07XG4iLCIvKipcbiAqIExldmVsIEhlbHBlciBjbGFzcywgcHJvdmlkaW5nIG1ldGhvZHMgZGVhbGluZyB3aXRoIHBsYXlsaXN0IHNsaWRpbmcgYW5kIGRyaWZ0XG4qL1xuXG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuY2xhc3MgTGV2ZWxIZWxwZXIge1xuXG4gIHN0YXRpYyBtZXJnZURldGFpbHMob2xkRGV0YWlscyxuZXdEZXRhaWxzKSB7XG4gICAgdmFyIHN0YXJ0ID0gTWF0aC5tYXgob2xkRGV0YWlscy5zdGFydFNOLG5ld0RldGFpbHMuc3RhcnRTTiktbmV3RGV0YWlscy5zdGFydFNOLFxuICAgICAgICBlbmQgPSBNYXRoLm1pbihvbGREZXRhaWxzLmVuZFNOLG5ld0RldGFpbHMuZW5kU04pLW5ld0RldGFpbHMuc3RhcnRTTixcbiAgICAgICAgZGVsdGEgPSBuZXdEZXRhaWxzLnN0YXJ0U04gLSBvbGREZXRhaWxzLnN0YXJ0U04sXG4gICAgICAgIG9sZGZyYWdtZW50cyA9IG9sZERldGFpbHMuZnJhZ21lbnRzLFxuICAgICAgICBuZXdmcmFnbWVudHMgPSBuZXdEZXRhaWxzLmZyYWdtZW50cyxcbiAgICAgICAgY2NPZmZzZXQgPTAsXG4gICAgICAgIFBUU0ZyYWc7XG5cbiAgICAvLyBjaGVjayBpZiBvbGQvbmV3IHBsYXlsaXN0cyBoYXZlIGZyYWdtZW50cyBpbiBjb21tb25cbiAgICBpZiAoIGVuZCA8IHN0YXJ0KSB7XG4gICAgICBuZXdEZXRhaWxzLlBUU0tub3duID0gZmFsc2U7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIC8vIGxvb3AgdGhyb3VnaCBvdmVybGFwcGluZyBTTiBhbmQgdXBkYXRlIHN0YXJ0UFRTICwgY2MsIGFuZCBkdXJhdGlvbiBpZiBhbnkgZm91bmRcbiAgICBmb3IodmFyIGkgPSBzdGFydCA7IGkgPD0gZW5kIDsgaSsrKSB7XG4gICAgICB2YXIgb2xkRnJhZyA9IG9sZGZyYWdtZW50c1tkZWx0YStpXSxcbiAgICAgICAgICBuZXdGcmFnID0gbmV3ZnJhZ21lbnRzW2ldO1xuICAgICAgY2NPZmZzZXQgPSBvbGRGcmFnLmNjIC0gbmV3RnJhZy5jYztcbiAgICAgIGlmICghaXNOYU4ob2xkRnJhZy5zdGFydFBUUykpIHtcbiAgICAgICAgbmV3RnJhZy5zdGFydCA9IG5ld0ZyYWcuc3RhcnRQVFMgPSBvbGRGcmFnLnN0YXJ0UFRTO1xuICAgICAgICBuZXdGcmFnLmVuZFBUUyA9IG9sZEZyYWcuZW5kUFRTO1xuICAgICAgICBuZXdGcmFnLmR1cmF0aW9uID0gb2xkRnJhZy5kdXJhdGlvbjtcbiAgICAgICAgUFRTRnJhZyA9IG5ld0ZyYWc7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYoY2NPZmZzZXQpIHtcbiAgICAgIGxvZ2dlci5sb2coYGRpc2NvbnRpbnVpdHkgc2xpZGluZyBmcm9tIHBsYXlsaXN0LCB0YWtlIGRyaWZ0IGludG8gYWNjb3VudGApO1xuICAgICAgZm9yKGkgPSAwIDsgaSA8IG5ld2ZyYWdtZW50cy5sZW5ndGggOyBpKyspIHtcbiAgICAgICAgbmV3ZnJhZ21lbnRzW2ldLmNjICs9IGNjT2Zmc2V0O1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGlmIGF0IGxlYXN0IG9uZSBmcmFnbWVudCBjb250YWlucyBQVFMgaW5mbywgcmVjb21wdXRlIFBUUyBpbmZvcm1hdGlvbiBmb3IgYWxsIGZyYWdtZW50c1xuICAgIGlmKFBUU0ZyYWcpIHtcbiAgICAgIExldmVsSGVscGVyLnVwZGF0ZUZyYWdQVFMobmV3RGV0YWlscyxQVFNGcmFnLnNuLFBUU0ZyYWcuc3RhcnRQVFMsUFRTRnJhZy5lbmRQVFMpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBhZGp1c3Qgc3RhcnQgYnkgc2xpZGluZyBvZmZzZXRcbiAgICAgIHZhciBzbGlkaW5nID0gb2xkZnJhZ21lbnRzW2RlbHRhXS5zdGFydDtcbiAgICAgIGZvcihpID0gMCA7IGkgPCBuZXdmcmFnbWVudHMubGVuZ3RoIDsgaSsrKSB7XG4gICAgICAgIG5ld2ZyYWdtZW50c1tpXS5zdGFydCArPSBzbGlkaW5nO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBpZiB3ZSBhcmUgaGVyZSwgaXQgbWVhbnMgd2UgaGF2ZSBmcmFnbWVudHMgb3ZlcmxhcHBpbmcgYmV0d2VlblxuICAgIC8vIG9sZCBhbmQgbmV3IGxldmVsLiByZWxpYWJsZSBQVFMgaW5mbyBpcyB0aHVzIHJlbHlpbmcgb24gb2xkIGxldmVsXG4gICAgbmV3RGV0YWlscy5QVFNLbm93biA9IG9sZERldGFpbHMuUFRTS25vd247XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgc3RhdGljIHVwZGF0ZUZyYWdQVFMoZGV0YWlscyxzbixzdGFydFBUUyxlbmRQVFMpIHtcbiAgICB2YXIgZnJhZ0lkeCwgZnJhZ21lbnRzLCBmcmFnLCBpO1xuICAgIC8vIGV4aXQgaWYgc24gb3V0IG9mIHJhbmdlXG4gICAgaWYgKHNuIDwgZGV0YWlscy5zdGFydFNOIHx8IHNuID4gZGV0YWlscy5lbmRTTikge1xuICAgICAgcmV0dXJuIDA7XG4gICAgfVxuICAgIGZyYWdJZHggPSBzbiAtIGRldGFpbHMuc3RhcnRTTjtcbiAgICBmcmFnbWVudHMgPSBkZXRhaWxzLmZyYWdtZW50cztcbiAgICBmcmFnID0gZnJhZ21lbnRzW2ZyYWdJZHhdO1xuICAgIGlmKCFpc05hTihmcmFnLnN0YXJ0UFRTKSkge1xuICAgICAgc3RhcnRQVFMgPSBNYXRoLm1heChzdGFydFBUUyxmcmFnLnN0YXJ0UFRTKTtcbiAgICAgIGVuZFBUUyA9IE1hdGgubWluKGVuZFBUUywgZnJhZy5lbmRQVFMpO1xuICAgIH1cblxuICAgIHZhciBkcmlmdCA9IHN0YXJ0UFRTIC0gZnJhZy5zdGFydDtcblxuICAgIGZyYWcuc3RhcnQgPSBmcmFnLnN0YXJ0UFRTID0gc3RhcnRQVFM7XG4gICAgZnJhZy5lbmRQVFMgPSBlbmRQVFM7XG4gICAgZnJhZy5kdXJhdGlvbiA9IGVuZFBUUyAtIHN0YXJ0UFRTO1xuICAgIC8vIGFkanVzdCBmcmFnbWVudCBQVFMvZHVyYXRpb24gZnJvbSBzZXFudW0tMSB0byBmcmFnIDBcbiAgICBmb3IoaSA9IGZyYWdJZHggOyBpID4gMCA7IGktLSkge1xuICAgICAgTGV2ZWxIZWxwZXIudXBkYXRlUFRTKGZyYWdtZW50cyxpLGktMSk7XG4gICAgfVxuXG4gICAgLy8gYWRqdXN0IGZyYWdtZW50IFBUUy9kdXJhdGlvbiBmcm9tIHNlcW51bSB0byBsYXN0IGZyYWdcbiAgICBmb3IoaSA9IGZyYWdJZHggOyBpIDwgZnJhZ21lbnRzLmxlbmd0aCAtIDEgOyBpKyspIHtcbiAgICAgIExldmVsSGVscGVyLnVwZGF0ZVBUUyhmcmFnbWVudHMsaSxpKzEpO1xuICAgIH1cbiAgICBkZXRhaWxzLlBUU0tub3duID0gdHJ1ZTtcbiAgICAvL2xvZ2dlci5sb2coYCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnJhZyBzdGFydC9lbmQ6JHtzdGFydFBUUy50b0ZpeGVkKDMpfS8ke2VuZFBUUy50b0ZpeGVkKDMpfWApO1xuXG4gICAgcmV0dXJuIGRyaWZ0O1xuICB9XG5cbiAgc3RhdGljIHVwZGF0ZVBUUyhmcmFnbWVudHMsZnJvbUlkeCwgdG9JZHgpIHtcbiAgICB2YXIgZnJhZ0Zyb20gPSBmcmFnbWVudHNbZnJvbUlkeF0sZnJhZ1RvID0gZnJhZ21lbnRzW3RvSWR4XSwgZnJhZ1RvUFRTID0gZnJhZ1RvLnN0YXJ0UFRTO1xuICAgIC8vIGlmIHdlIGtub3cgc3RhcnRQVFNbdG9JZHhdXG4gICAgaWYoIWlzTmFOKGZyYWdUb1BUUykpIHtcbiAgICAgIC8vIHVwZGF0ZSBmcmFnbWVudCBkdXJhdGlvbi5cbiAgICAgIC8vIGl0IGhlbHBzIHRvIGZpeCBkcmlmdHMgYmV0d2VlbiBwbGF5bGlzdCByZXBvcnRlZCBkdXJhdGlvbiBhbmQgZnJhZ21lbnQgcmVhbCBkdXJhdGlvblxuICAgICAgaWYgKHRvSWR4ID4gZnJvbUlkeCkge1xuICAgICAgICBmcmFnRnJvbS5kdXJhdGlvbiA9IGZyYWdUb1BUUy1mcmFnRnJvbS5zdGFydDtcbiAgICAgICAgaWYoZnJhZ0Zyb20uZHVyYXRpb24gPCAwKSB7XG4gICAgICAgICAgbG9nZ2VyLmVycm9yKGBuZWdhdGl2ZSBkdXJhdGlvbiBjb21wdXRlZCBmb3IgJHtmcmFnRnJvbX0sIHRoZXJlIHNob3VsZCBiZSBzb21lIGR1cmF0aW9uIGRyaWZ0IGJldHdlZW4gcGxheWxpc3QgYW5kIGZyYWdtZW50IWApO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmcmFnVG8uZHVyYXRpb24gPSBmcmFnRnJvbS5zdGFydCAtIGZyYWdUb1BUUztcbiAgICAgICAgaWYoZnJhZ1RvLmR1cmF0aW9uIDwgMCkge1xuICAgICAgICAgIGxvZ2dlci5lcnJvcihgbmVnYXRpdmUgZHVyYXRpb24gY29tcHV0ZWQgZm9yICR7ZnJhZ1RvfSwgdGhlcmUgc2hvdWxkIGJlIHNvbWUgZHVyYXRpb24gZHJpZnQgYmV0d2VlbiBwbGF5bGlzdCBhbmQgZnJhZ21lbnQhYCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gd2UgZG9udCBrbm93IHN0YXJ0UFRTW3RvSWR4XVxuICAgICAgaWYgKHRvSWR4ID4gZnJvbUlkeCkge1xuICAgICAgICBmcmFnVG8uc3RhcnQgPSBmcmFnRnJvbS5zdGFydCArIGZyYWdGcm9tLmR1cmF0aW9uO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZnJhZ1RvLnN0YXJ0ID0gZnJhZ0Zyb20uc3RhcnQgLSBmcmFnVG8uZHVyYXRpb247XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IExldmVsSGVscGVyO1xuIiwiLyoqXG4gKiBITFMgaW50ZXJmYWNlXG4gKi9cbid1c2Ugc3RyaWN0JztcblxuaW1wb3J0IEV2ZW50IGZyb20gJy4vZXZlbnRzJztcbmltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuL2Vycm9ycyc7XG5pbXBvcnQgUGxheWxpc3RMb2FkZXIgZnJvbSAnLi9sb2FkZXIvcGxheWxpc3QtbG9hZGVyJztcbmltcG9ydCBGcmFnbWVudExvYWRlciBmcm9tICcuL2xvYWRlci9mcmFnbWVudC1sb2FkZXInO1xuaW1wb3J0IEFickNvbnRyb2xsZXIgZnJvbSAgICAnLi9jb250cm9sbGVyL2Fici1jb250cm9sbGVyJztcbmltcG9ydCBNU0VNZWRpYUNvbnRyb2xsZXIgZnJvbSAnLi9jb250cm9sbGVyL21zZS1tZWRpYS1jb250cm9sbGVyJztcbmltcG9ydCBMZXZlbENvbnRyb2xsZXIgZnJvbSAgJy4vY29udHJvbGxlci9sZXZlbC1jb250cm9sbGVyJztcbmltcG9ydCBUaW1lbGluZUNvbnRyb2xsZXIgZnJvbSAnLi9jb250cm9sbGVyL3RpbWVsaW5lLWNvbnRyb2xsZXInO1xuLy9pbXBvcnQgRlBTQ29udHJvbGxlciBmcm9tICcuL2NvbnRyb2xsZXIvZnBzLWNvbnRyb2xsZXInO1xuaW1wb3J0IHtsb2dnZXIsIGVuYWJsZUxvZ3N9IGZyb20gJy4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCBYaHJMb2FkZXIgZnJvbSAnLi91dGlscy94aHItbG9hZGVyJztcbmltcG9ydCBFdmVudEVtaXR0ZXIgZnJvbSAnZXZlbnRzJztcbmltcG9ydCBLZXlMb2FkZXIgZnJvbSAnLi9sb2FkZXIva2V5LWxvYWRlcic7XG5cbmNsYXNzIEhscyB7XG5cbiAgc3RhdGljIGlzU3VwcG9ydGVkKCkge1xuICAgIHJldHVybiAod2luZG93Lk1lZGlhU291cmNlICYmIHdpbmRvdy5NZWRpYVNvdXJjZS5pc1R5cGVTdXBwb3J0ZWQoJ3ZpZGVvL21wNDsgY29kZWNzPVwiYXZjMS40MkUwMUUsbXA0YS40MC4yXCInKSk7XG4gIH1cblxuICBzdGF0aWMgZ2V0IEV2ZW50cygpIHtcbiAgICByZXR1cm4gRXZlbnQ7XG4gIH1cblxuICBzdGF0aWMgZ2V0IEVycm9yVHlwZXMoKSB7XG4gICAgcmV0dXJuIEVycm9yVHlwZXM7XG4gIH1cblxuICBzdGF0aWMgZ2V0IEVycm9yRGV0YWlscygpIHtcbiAgICByZXR1cm4gRXJyb3JEZXRhaWxzO1xuICB9XG5cbiAgc3RhdGljIGdldCBEZWZhdWx0Q29uZmlnKCkge1xuICAgIGlmKCFIbHMuZGVmYXVsdENvbmZpZykge1xuICAgICAgIEhscy5kZWZhdWx0Q29uZmlnID0ge1xuICAgICAgICAgIGF1dG9TdGFydExvYWQ6IHRydWUsXG4gICAgICAgICAgZGVidWc6IGZhbHNlLFxuICAgICAgICAgIG1heEJ1ZmZlckxlbmd0aDogMzAsXG4gICAgICAgICAgbWF4QnVmZmVyU2l6ZTogNjAgKiAxMDAwICogMTAwMCxcbiAgICAgICAgICBsaXZlU3luY0R1cmF0aW9uQ291bnQ6MyxcbiAgICAgICAgICBsaXZlTWF4TGF0ZW5jeUR1cmF0aW9uQ291bnQ6IEluZmluaXR5LFxuICAgICAgICAgIG1heE1heEJ1ZmZlckxlbmd0aDogNjAwLFxuICAgICAgICAgIGVuYWJsZVdvcmtlcjogdHJ1ZSxcbiAgICAgICAgICBlbmFibGVTb2Z0d2FyZUFFUzogdHJ1ZSxcbiAgICAgICAgICBtYW5pZmVzdExvYWRpbmdUaW1lT3V0OiAxMDAwMCxcbiAgICAgICAgICBtYW5pZmVzdExvYWRpbmdNYXhSZXRyeTogMSxcbiAgICAgICAgICBtYW5pZmVzdExvYWRpbmdSZXRyeURlbGF5OiAxMDAwLFxuICAgICAgICAgIGxldmVsTG9hZGluZ1RpbWVPdXQ6IDEwMDAwLFxuICAgICAgICAgIGxldmVsTG9hZGluZ01heFJldHJ5OiA0LFxuICAgICAgICAgIGxldmVsTG9hZGluZ1JldHJ5RGVsYXk6IDEwMDAsXG4gICAgICAgICAgZnJhZ0xvYWRpbmdUaW1lT3V0OiAyMDAwMCxcbiAgICAgICAgICBmcmFnTG9hZGluZ01heFJldHJ5OiA2LFxuICAgICAgICAgIGZyYWdMb2FkaW5nUmV0cnlEZWxheTogMTAwMCxcbiAgICAgICAgICBmcmFnTG9hZGluZ0xvb3BUaHJlc2hvbGQ6IDMsXG4gICAgICAgICAgLy8gZnBzRHJvcHBlZE1vbml0b3JpbmdQZXJpb2Q6IDUwMDAsXG4gICAgICAgICAgLy8gZnBzRHJvcHBlZE1vbml0b3JpbmdUaHJlc2hvbGQ6IDAuMixcbiAgICAgICAgICBhcHBlbmRFcnJvck1heFJldHJ5OiAzLFxuICAgICAgICAgIGxvYWRlcjogWGhyTG9hZGVyLFxuICAgICAgICAgIGZMb2FkZXI6IHVuZGVmaW5lZCxcbiAgICAgICAgICBwTG9hZGVyOiB1bmRlZmluZWQsXG4gICAgICAgICAgYWJyQ29udHJvbGxlciA6IEFickNvbnRyb2xsZXIsXG4gICAgICAgICAgbWVkaWFDb250cm9sbGVyOiBNU0VNZWRpYUNvbnRyb2xsZXIsXG4gICAgICAgICAgdGltZWxpbmVDb250cm9sbGVyOiBUaW1lbGluZUNvbnRyb2xsZXIsXG4gICAgICAgICAgZW5hYmxlQ0VBNzA4Q2FwdGlvbnM6IHRydWVcbiAgICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIEhscy5kZWZhdWx0Q29uZmlnO1xuICB9XG5cbiAgc3RhdGljIHNldCBEZWZhdWx0Q29uZmlnKGRlZmF1bHRDb25maWcpIHtcbiAgICBIbHMuZGVmYXVsdENvbmZpZyA9IGRlZmF1bHRDb25maWc7XG4gIH1cblxuICBjb25zdHJ1Y3Rvcihjb25maWcgPSB7fSkge1xuICAgIHZhciBkZWZhdWx0Q29uZmlnID0gSGxzLkRlZmF1bHRDb25maWc7XG4gICAgZm9yICh2YXIgcHJvcCBpbiBkZWZhdWx0Q29uZmlnKSB7XG4gICAgICAgIGlmIChwcm9wIGluIGNvbmZpZykgeyBjb250aW51ZTsgfVxuICAgICAgICBjb25maWdbcHJvcF0gPSBkZWZhdWx0Q29uZmlnW3Byb3BdO1xuICAgIH1cblxuICAgIGlmIChjb25maWcubGl2ZU1heExhdGVuY3lEdXJhdGlvbkNvdW50ICE9PSB1bmRlZmluZWQgJiYgY29uZmlnLmxpdmVNYXhMYXRlbmN5RHVyYXRpb25Db3VudCA8PSBjb25maWcubGl2ZVN5bmNEdXJhdGlvbkNvdW50KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0lsbGVnYWwgaGxzLmpzIGNvbmZpZzogXCJsaXZlTWF4TGF0ZW5jeUR1cmF0aW9uQ291bnRcIiBtdXN0IGJlIGd0IFwibGl2ZVN5bmNEdXJhdGlvbkNvdW50XCInKTtcbiAgICB9XG5cbiAgICBlbmFibGVMb2dzKGNvbmZpZy5kZWJ1Zyk7XG4gICAgdGhpcy5jb25maWcgPSBjb25maWc7XG4gICAgLy8gb2JzZXJ2ZXIgc2V0dXBcbiAgICB2YXIgb2JzZXJ2ZXIgPSB0aGlzLm9ic2VydmVyID0gbmV3IEV2ZW50RW1pdHRlcigpO1xuICAgIG9ic2VydmVyLnRyaWdnZXIgPSBmdW5jdGlvbiB0cmlnZ2VyIChldmVudCwgLi4uZGF0YSkge1xuICAgICAgb2JzZXJ2ZXIuZW1pdChldmVudCwgZXZlbnQsIC4uLmRhdGEpO1xuICAgIH07XG5cbiAgICBvYnNlcnZlci5vZmYgPSBmdW5jdGlvbiBvZmYgKGV2ZW50LCAuLi5kYXRhKSB7XG4gICAgICBvYnNlcnZlci5yZW1vdmVMaXN0ZW5lcihldmVudCwgLi4uZGF0YSk7XG4gICAgfTtcbiAgICB0aGlzLm9uID0gb2JzZXJ2ZXIub24uYmluZChvYnNlcnZlcik7XG4gICAgdGhpcy5vZmYgPSBvYnNlcnZlci5vZmYuYmluZChvYnNlcnZlcik7XG4gICAgdGhpcy50cmlnZ2VyID0gb2JzZXJ2ZXIudHJpZ2dlci5iaW5kKG9ic2VydmVyKTtcbiAgICB0aGlzLnBsYXlsaXN0TG9hZGVyID0gbmV3IFBsYXlsaXN0TG9hZGVyKHRoaXMpO1xuICAgIHRoaXMuZnJhZ21lbnRMb2FkZXIgPSBuZXcgRnJhZ21lbnRMb2FkZXIodGhpcyk7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIgPSBuZXcgTGV2ZWxDb250cm9sbGVyKHRoaXMpO1xuICAgIHRoaXMuYWJyQ29udHJvbGxlciA9IG5ldyBjb25maWcuYWJyQ29udHJvbGxlcih0aGlzKTtcbiAgICB0aGlzLm1lZGlhQ29udHJvbGxlciA9IG5ldyBjb25maWcubWVkaWFDb250cm9sbGVyKHRoaXMpO1xuICAgIHRoaXMudGltZWxpbmVDb250cm9sbGVyID0gbmV3IGNvbmZpZy50aW1lbGluZUNvbnRyb2xsZXIodGhpcyk7XG4gICAgdGhpcy5rZXlMb2FkZXIgPSBuZXcgS2V5TG9hZGVyKHRoaXMpO1xuICAgIC8vdGhpcy5mcHNDb250cm9sbGVyID0gbmV3IEZQU0NvbnRyb2xsZXIodGhpcyk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIGxvZ2dlci5sb2coJ2Rlc3Ryb3knKTtcbiAgICB0aGlzLnRyaWdnZXIoRXZlbnQuREVTVFJPWUlORyk7XG4gICAgdGhpcy5kZXRhY2hNZWRpYSgpO1xuICAgIHRoaXMucGxheWxpc3RMb2FkZXIuZGVzdHJveSgpO1xuICAgIHRoaXMuZnJhZ21lbnRMb2FkZXIuZGVzdHJveSgpO1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLmRlc3Ryb3koKTtcbiAgICB0aGlzLm1lZGlhQ29udHJvbGxlci5kZXN0cm95KCk7XG4gICAgdGhpcy50aW1lbGluZUNvbnRyb2xsZXIuZGVzdHJveSgpO1xuICAgIHRoaXMua2V5TG9hZGVyLmRlc3Ryb3koKTtcbiAgICAvL3RoaXMuZnBzQ29udHJvbGxlci5kZXN0cm95KCk7XG4gICAgdGhpcy51cmwgPSBudWxsO1xuICAgIHRoaXMub2JzZXJ2ZXIucmVtb3ZlQWxsTGlzdGVuZXJzKCk7XG4gIH1cblxuICBhdHRhY2hNZWRpYShtZWRpYSkge1xuICAgIGxvZ2dlci5sb2coJ2F0dGFjaE1lZGlhJyk7XG4gICAgdGhpcy5tZWRpYSA9IG1lZGlhO1xuICAgIHRoaXMudHJpZ2dlcihFdmVudC5NRURJQV9BVFRBQ0hJTkcsIHttZWRpYTogbWVkaWF9KTtcbiAgfVxuXG4gIGRldGFjaE1lZGlhKCkge1xuICAgIGxvZ2dlci5sb2coJ2RldGFjaE1lZGlhJyk7XG4gICAgdGhpcy50cmlnZ2VyKEV2ZW50Lk1FRElBX0RFVEFDSElORyk7XG4gICAgdGhpcy5tZWRpYSA9IG51bGw7XG4gIH1cblxuICBsb2FkU291cmNlKHVybCkge1xuICAgIGxvZ2dlci5sb2coYGxvYWRTb3VyY2U6JHt1cmx9YCk7XG4gICAgdGhpcy51cmwgPSB1cmw7XG4gICAgLy8gd2hlbiBhdHRhY2hpbmcgdG8gYSBzb3VyY2UgVVJMLCB0cmlnZ2VyIGEgcGxheWxpc3QgbG9hZFxuICAgIHRoaXMudHJpZ2dlcihFdmVudC5NQU5JRkVTVF9MT0FESU5HLCB7dXJsOiB1cmx9KTtcbiAgfVxuXG4gIHN0YXJ0TG9hZCgpIHtcbiAgICBsb2dnZXIubG9nKCdzdGFydExvYWQnKTtcbiAgICB0aGlzLm1lZGlhQ29udHJvbGxlci5zdGFydExvYWQoKTtcbiAgfVxuXG4gIHN3YXBBdWRpb0NvZGVjKCkge1xuICAgIGxvZ2dlci5sb2coJ3N3YXBBdWRpb0NvZGVjJyk7XG4gICAgdGhpcy5tZWRpYUNvbnRyb2xsZXIuc3dhcEF1ZGlvQ29kZWMoKTtcbiAgfVxuXG4gIHJlY292ZXJNZWRpYUVycm9yKCkge1xuICAgIGxvZ2dlci5sb2coJ3JlY292ZXJNZWRpYUVycm9yJyk7XG4gICAgdmFyIG1lZGlhID0gdGhpcy5tZWRpYTtcbiAgICB0aGlzLmRldGFjaE1lZGlhKCk7XG4gICAgdGhpcy5hdHRhY2hNZWRpYShtZWRpYSk7XG4gIH1cblxuICAvKiogUmV0dXJuIGFsbCBxdWFsaXR5IGxldmVscyAqKi9cbiAgZ2V0IGxldmVscygpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIubGV2ZWxzO1xuICB9XG5cbiAgLyoqIFJldHVybiBjdXJyZW50IHBsYXliYWNrIHF1YWxpdHkgbGV2ZWwgKiovXG4gIGdldCBjdXJyZW50TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubWVkaWFDb250cm9sbGVyLmN1cnJlbnRMZXZlbDtcbiAgfVxuXG4gIC8qIHNldCBxdWFsaXR5IGxldmVsIGltbWVkaWF0ZWx5ICgtMSBmb3IgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbikgKi9cbiAgc2V0IGN1cnJlbnRMZXZlbChuZXdMZXZlbCkge1xuICAgIGxvZ2dlci5sb2coYHNldCBjdXJyZW50TGV2ZWw6JHtuZXdMZXZlbH1gKTtcbiAgICB0aGlzLmxvYWRMZXZlbCA9IG5ld0xldmVsO1xuICAgIHRoaXMubWVkaWFDb250cm9sbGVyLmltbWVkaWF0ZUxldmVsU3dpdGNoKCk7XG4gIH1cblxuICAvKiogUmV0dXJuIG5leHQgcGxheWJhY2sgcXVhbGl0eSBsZXZlbCAocXVhbGl0eSBsZXZlbCBvZiBuZXh0IGZyYWdtZW50KSAqKi9cbiAgZ2V0IG5leHRMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5tZWRpYUNvbnRyb2xsZXIubmV4dExldmVsO1xuICB9XG5cbiAgLyogc2V0IHF1YWxpdHkgbGV2ZWwgZm9yIG5leHQgZnJhZ21lbnQgKC0xIGZvciBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uKSAqL1xuICBzZXQgbmV4dExldmVsKG5ld0xldmVsKSB7XG4gICAgbG9nZ2VyLmxvZyhgc2V0IG5leHRMZXZlbDoke25ld0xldmVsfWApO1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLm1hbnVhbExldmVsID0gbmV3TGV2ZWw7XG4gICAgdGhpcy5tZWRpYUNvbnRyb2xsZXIubmV4dExldmVsU3dpdGNoKCk7XG4gIH1cblxuICAvKiogUmV0dXJuIHRoZSBxdWFsaXR5IGxldmVsIG9mIGN1cnJlbnQvbGFzdCBsb2FkZWQgZnJhZ21lbnQgKiovXG4gIGdldCBsb2FkTGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLmxldmVsO1xuICB9XG5cbiAgLyogc2V0IHF1YWxpdHkgbGV2ZWwgZm9yIGN1cnJlbnQvbmV4dCBsb2FkZWQgZnJhZ21lbnQgKC0xIGZvciBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uKSAqL1xuICBzZXQgbG9hZExldmVsKG5ld0xldmVsKSB7XG4gICAgbG9nZ2VyLmxvZyhgc2V0IGxvYWRMZXZlbDoke25ld0xldmVsfWApO1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLm1hbnVhbExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICAvKiogUmV0dXJuIHRoZSBxdWFsaXR5IGxldmVsIG9mIG5leHQgbG9hZGVkIGZyYWdtZW50ICoqL1xuICBnZXQgbmV4dExvYWRMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIubmV4dExvYWRMZXZlbCgpO1xuICB9XG5cbiAgLyoqIHNldCBxdWFsaXR5IGxldmVsIG9mIG5leHQgbG9hZGVkIGZyYWdtZW50ICoqL1xuICBzZXQgbmV4dExvYWRMZXZlbChsZXZlbCkge1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLmxldmVsID0gbGV2ZWw7XG4gIH1cblxuICAvKiogUmV0dXJuIGZpcnN0IGxldmVsIChpbmRleCBvZiBmaXJzdCBsZXZlbCByZWZlcmVuY2VkIGluIG1hbmlmZXN0KVxuICAqKi9cbiAgZ2V0IGZpcnN0TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLmZpcnN0TGV2ZWw7XG4gIH1cblxuICAvKiogc2V0IGZpcnN0IGxldmVsIChpbmRleCBvZiBmaXJzdCBsZXZlbCByZWZlcmVuY2VkIGluIG1hbmlmZXN0KVxuICAqKi9cbiAgc2V0IGZpcnN0TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICBsb2dnZXIubG9nKGBzZXQgZmlyc3RMZXZlbDoke25ld0xldmVsfWApO1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLmZpcnN0TGV2ZWwgPSBuZXdMZXZlbDtcbiAgfVxuXG4gIC8qKiBSZXR1cm4gc3RhcnQgbGV2ZWwgKGxldmVsIG9mIGZpcnN0IGZyYWdtZW50IHRoYXQgd2lsbCBiZSBwbGF5ZWQgYmFjaylcbiAgICAgIGlmIG5vdCBvdmVycmlkZWQgYnkgdXNlciwgZmlyc3QgbGV2ZWwgYXBwZWFyaW5nIGluIG1hbmlmZXN0IHdpbGwgYmUgdXNlZCBhcyBzdGFydCBsZXZlbFxuICAgICAgaWYgLTEgOiBhdXRvbWF0aWMgc3RhcnQgbGV2ZWwgc2VsZWN0aW9uLCBwbGF5YmFjayB3aWxsIHN0YXJ0IGZyb20gbGV2ZWwgbWF0Y2hpbmcgZG93bmxvYWQgYmFuZHdpZHRoIChkZXRlcm1pbmVkIGZyb20gZG93bmxvYWQgb2YgZmlyc3Qgc2VnbWVudClcbiAgKiovXG4gIGdldCBzdGFydExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLmxldmVsQ29udHJvbGxlci5zdGFydExldmVsO1xuICB9XG5cbiAgLyoqIHNldCAgc3RhcnQgbGV2ZWwgKGxldmVsIG9mIGZpcnN0IGZyYWdtZW50IHRoYXQgd2lsbCBiZSBwbGF5ZWQgYmFjaylcbiAgICAgIGlmIG5vdCBvdmVycmlkZWQgYnkgdXNlciwgZmlyc3QgbGV2ZWwgYXBwZWFyaW5nIGluIG1hbmlmZXN0IHdpbGwgYmUgdXNlZCBhcyBzdGFydCBsZXZlbFxuICAgICAgaWYgLTEgOiBhdXRvbWF0aWMgc3RhcnQgbGV2ZWwgc2VsZWN0aW9uLCBwbGF5YmFjayB3aWxsIHN0YXJ0IGZyb20gbGV2ZWwgbWF0Y2hpbmcgZG93bmxvYWQgYmFuZHdpZHRoIChkZXRlcm1pbmVkIGZyb20gZG93bmxvYWQgb2YgZmlyc3Qgc2VnbWVudClcbiAgKiovXG4gIHNldCBzdGFydExldmVsKG5ld0xldmVsKSB7XG4gICAgbG9nZ2VyLmxvZyhgc2V0IHN0YXJ0TGV2ZWw6JHtuZXdMZXZlbH1gKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5zdGFydExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICAvKiogUmV0dXJuIHRoZSBjYXBwaW5nL21heCBsZXZlbCB2YWx1ZSB0aGF0IGNvdWxkIGJlIHVzZWQgYnkgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBhbGdvcml0aG0gKiovXG4gIGdldCBhdXRvTGV2ZWxDYXBwaW5nKCkge1xuICAgIHJldHVybiB0aGlzLmFickNvbnRyb2xsZXIuYXV0b0xldmVsQ2FwcGluZztcbiAgfVxuXG4gIC8qKiBzZXQgdGhlIGNhcHBpbmcvbWF4IGxldmVsIHZhbHVlIHRoYXQgY291bGQgYmUgdXNlZCBieSBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uIGFsZ29yaXRobSAqKi9cbiAgc2V0IGF1dG9MZXZlbENhcHBpbmcobmV3TGV2ZWwpIHtcbiAgICBsb2dnZXIubG9nKGBzZXQgYXV0b0xldmVsQ2FwcGluZzoke25ld0xldmVsfWApO1xuICAgIHRoaXMuYWJyQ29udHJvbGxlci5hdXRvTGV2ZWxDYXBwaW5nID0gbmV3TGV2ZWw7XG4gIH1cblxuICAvKiBjaGVjayBpZiB3ZSBhcmUgaW4gYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBtb2RlICovXG4gIGdldCBhdXRvTGV2ZWxFbmFibGVkKCkge1xuICAgIHJldHVybiAodGhpcy5sZXZlbENvbnRyb2xsZXIubWFudWFsTGV2ZWwgPT09IC0xKTtcbiAgfVxuXG4gIC8qIHJldHVybiBtYW51YWwgbGV2ZWwgKi9cbiAgZ2V0IG1hbnVhbExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLmxldmVsQ29udHJvbGxlci5tYW51YWxMZXZlbDtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBIbHM7XG4iLCIvKlxuICogRnJhZ21lbnQgTG9hZGVyXG4qL1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuXG5jbGFzcyBGcmFnbWVudExvYWRlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgdGhpcy5obHMgPSBobHM7XG4gICAgdGhpcy5vbmZsID0gdGhpcy5vbkZyYWdMb2FkaW5nLmJpbmQodGhpcyk7XG4gICAgaGxzLm9uKEV2ZW50LkZSQUdfTE9BRElORywgdGhpcy5vbmZsKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgaWYgKHRoaXMubG9hZGVyKSB7XG4gICAgICB0aGlzLmxvYWRlci5kZXN0cm95KCk7XG4gICAgICB0aGlzLmxvYWRlciA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMuaGxzLm9mZihFdmVudC5GUkFHX0xPQURJTkcsIHRoaXMub25mbCk7XG4gIH1cblxuICBvbkZyYWdMb2FkaW5nKGV2ZW50LCBkYXRhKSB7XG4gICAgdmFyIGZyYWcgPSBkYXRhLmZyYWc7XG4gICAgdGhpcy5mcmFnID0gZnJhZztcbiAgICB0aGlzLmZyYWcubG9hZGVkID0gMDtcbiAgICB2YXIgY29uZmlnID0gdGhpcy5obHMuY29uZmlnO1xuICAgIGZyYWcubG9hZGVyID0gdGhpcy5sb2FkZXIgPSB0eXBlb2YoY29uZmlnLmZMb2FkZXIpICE9PSAndW5kZWZpbmVkJyA/IG5ldyBjb25maWcuZkxvYWRlcihjb25maWcpIDogbmV3IGNvbmZpZy5sb2FkZXIoY29uZmlnKTtcbiAgICB0aGlzLmxvYWRlci5sb2FkKGZyYWcudXJsLCAnYXJyYXlidWZmZXInLCB0aGlzLmxvYWRzdWNjZXNzLmJpbmQodGhpcyksIHRoaXMubG9hZGVycm9yLmJpbmQodGhpcyksIHRoaXMubG9hZHRpbWVvdXQuYmluZCh0aGlzKSwgY29uZmlnLmZyYWdMb2FkaW5nVGltZU91dCwgMSwgMCwgdGhpcy5sb2FkcHJvZ3Jlc3MuYmluZCh0aGlzKSwgZnJhZyk7XG4gIH1cblxuICBsb2Fkc3VjY2VzcyhldmVudCwgc3RhdHMpIHtcbiAgICB2YXIgcGF5bG9hZCA9IGV2ZW50LmN1cnJlbnRUYXJnZXQucmVzcG9uc2U7XG4gICAgc3RhdHMubGVuZ3RoID0gcGF5bG9hZC5ieXRlTGVuZ3RoO1xuICAgIC8vIGRldGFjaCBmcmFnbWVudCBsb2FkZXIgb24gbG9hZCBzdWNjZXNzXG4gICAgdGhpcy5mcmFnLmxvYWRlciA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkZSQUdfTE9BREVELCB7cGF5bG9hZDogcGF5bG9hZCwgZnJhZzogdGhpcy5mcmFnLCBzdGF0czogc3RhdHN9KTtcbiAgfVxuXG4gIGxvYWRlcnJvcihldmVudCkge1xuICAgIHRoaXMubG9hZGVyLmFib3J0KCk7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTkVUV09SS19FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9FUlJPUiwgZmF0YWw6IGZhbHNlLCBmcmFnOiB0aGlzLmZyYWcsIHJlc3BvbnNlOiBldmVudH0pO1xuICB9XG5cbiAgbG9hZHRpbWVvdXQoKSB7XG4gICAgdGhpcy5sb2FkZXIuYWJvcnQoKTtcbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5ORVRXT1JLX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuRlJBR19MT0FEX1RJTUVPVVQsIGZhdGFsOiBmYWxzZSwgZnJhZzogdGhpcy5mcmFnfSk7XG4gIH1cblxuICBsb2FkcHJvZ3Jlc3MoZXZlbnQsIHN0YXRzKSB7XG4gICAgdGhpcy5mcmFnLmxvYWRlZCA9IHN0YXRzLmxvYWRlZDtcbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkZSQUdfTE9BRF9QUk9HUkVTUywge2ZyYWc6IHRoaXMuZnJhZywgc3RhdHM6IHN0YXRzfSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRnJhZ21lbnRMb2FkZXI7XG4iLCIvKlxuICogRGVjcnlwdCBrZXkgTG9hZGVyXG4qL1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuXG5jbGFzcyBLZXlMb2FkZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHRoaXMuaGxzID0gaGxzO1xuICAgIHRoaXMuZGVjcnlwdGtleSA9IG51bGw7XG4gICAgdGhpcy5kZWNyeXB0dXJsID0gbnVsbDtcbiAgICB0aGlzLm9uZGtsID0gdGhpcy5vbkRlY3J5cHRLZXlMb2FkaW5nLmJpbmQodGhpcyk7XG4gICAgaGxzLm9uKEV2ZW50LktFWV9MT0FESU5HLCB0aGlzLm9uZGtsKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgaWYgKHRoaXMubG9hZGVyKSB7XG4gICAgICB0aGlzLmxvYWRlci5kZXN0cm95KCk7XG4gICAgICB0aGlzLmxvYWRlciA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMuaGxzLm9mZihFdmVudC5LRVlfTE9BRElORywgdGhpcy5vbmRrbCk7XG4gIH1cblxuICBvbkRlY3J5cHRLZXlMb2FkaW5nKGV2ZW50LCBkYXRhKSB7XG4gICAgdmFyIGZyYWcgPSB0aGlzLmZyYWcgPSBkYXRhLmZyYWcsXG4gICAgICAgIGRlY3J5cHRkYXRhID0gZnJhZy5kZWNyeXB0ZGF0YSxcbiAgICAgICAgdXJpID0gZGVjcnlwdGRhdGEudXJpO1xuICAgICAgICAvLyBpZiB1cmkgaXMgZGlmZmVyZW50IGZyb20gcHJldmlvdXMgb25lIG9yIGlmIGRlY3J5cHQga2V5IG5vdCByZXRyaWV2ZWQgeWV0XG4gICAgICBpZiAodXJpICE9PSB0aGlzLmRlY3J5cHR1cmwgfHwgdGhpcy5kZWNyeXB0a2V5ID09PSBudWxsKSB7XG4gICAgICAgIHZhciBjb25maWcgPSB0aGlzLmhscy5jb25maWc7XG4gICAgICAgIGZyYWcubG9hZGVyID0gdGhpcy5sb2FkZXIgPSBuZXcgY29uZmlnLmxvYWRlcihjb25maWcpO1xuICAgICAgICB0aGlzLmRlY3J5cHR1cmwgPSB1cmk7XG4gICAgICAgIHRoaXMuZGVjcnlwdGtleSA9IG51bGw7XG4gICAgICAgIGZyYWcubG9hZGVyLmxvYWQodXJpLCAnYXJyYXlidWZmZXInLCB0aGlzLmxvYWRzdWNjZXNzLmJpbmQodGhpcyksIHRoaXMubG9hZGVycm9yLmJpbmQodGhpcyksIHRoaXMubG9hZHRpbWVvdXQuYmluZCh0aGlzKSwgY29uZmlnLmZyYWdMb2FkaW5nVGltZU91dCwgY29uZmlnLmZyYWdMb2FkaW5nTWF4UmV0cnksIGNvbmZpZy5mcmFnTG9hZGluZ1JldHJ5RGVsYXksIHRoaXMubG9hZHByb2dyZXNzLmJpbmQodGhpcyksIGZyYWcpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLmRlY3J5cHRrZXkpIHtcbiAgICAgICAgLy8gd2UgYWxyZWFkeSBsb2FkZWQgdGhpcyBrZXksIHJldHVybiBpdFxuICAgICAgICBkZWNyeXB0ZGF0YS5rZXkgPSB0aGlzLmRlY3J5cHRrZXk7XG4gICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuS0VZX0xPQURFRCwge2ZyYWc6IGZyYWd9KTtcbiAgICAgIH1cbiAgfVxuXG4gIGxvYWRzdWNjZXNzKGV2ZW50KSB7XG4gICAgdmFyIGZyYWcgPSB0aGlzLmZyYWc7XG4gICAgdGhpcy5kZWNyeXB0a2V5ID0gZnJhZy5kZWNyeXB0ZGF0YS5rZXkgPSBuZXcgVWludDhBcnJheShldmVudC5jdXJyZW50VGFyZ2V0LnJlc3BvbnNlKTtcbiAgICAvLyBkZXRhY2ggZnJhZ21lbnQgbG9hZGVyIG9uIGxvYWQgc3VjY2Vzc1xuICAgIGZyYWcubG9hZGVyID0gdW5kZWZpbmVkO1xuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuS0VZX0xPQURFRCwge2ZyYWc6IGZyYWd9KTtcbiAgfVxuXG4gIGxvYWRlcnJvcihldmVudCkge1xuICAgIHRoaXMubG9hZGVyLmFib3J0KCk7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTkVUV09SS19FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLktFWV9MT0FEX0VSUk9SLCBmYXRhbDogZmFsc2UsIGZyYWc6IHRoaXMuZnJhZywgcmVzcG9uc2U6IGV2ZW50fSk7XG4gIH1cblxuICBsb2FkdGltZW91dCgpIHtcbiAgICB0aGlzLmxvYWRlci5hYm9ydCgpO1xuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5LRVlfTE9BRF9USU1FT1VULCBmYXRhbDogZmFsc2UsIGZyYWc6IHRoaXMuZnJhZ30pO1xuICB9XG5cbiAgbG9hZHByb2dyZXNzKCkge1xuXG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgS2V5TG9hZGVyO1xuIiwiLyoqXG4gKiBQbGF5bGlzdCBMb2FkZXJcbiovXG5cbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5pbXBvcnQgVVJMSGVscGVyIGZyb20gJy4uL3V0aWxzL3VybCc7XG5pbXBvcnQgQXR0ckxpc3QgZnJvbSAnLi4vdXRpbHMvYXR0ci1saXN0Jztcbi8vaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5cbmNsYXNzIFBsYXlsaXN0TG9hZGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMpIHtcbiAgICB0aGlzLmhscyA9IGhscztcbiAgICB0aGlzLm9ubWwgPSB0aGlzLm9uTWFuaWZlc3RMb2FkaW5nLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmxsID0gdGhpcy5vbkxldmVsTG9hZGluZy5iaW5kKHRoaXMpO1xuICAgIGhscy5vbihFdmVudC5NQU5JRkVTVF9MT0FESU5HLCB0aGlzLm9ubWwpO1xuICAgIGhscy5vbihFdmVudC5MRVZFTF9MT0FESU5HLCB0aGlzLm9ubGwpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBpZiAodGhpcy5sb2FkZXIpIHtcbiAgICAgIHRoaXMubG9hZGVyLmRlc3Ryb3koKTtcbiAgICAgIHRoaXMubG9hZGVyID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy51cmwgPSB0aGlzLmlkID0gbnVsbDtcbiAgICB0aGlzLmhscy5vZmYoRXZlbnQuTUFOSUZFU1RfTE9BRElORywgdGhpcy5vbm1sKTtcbiAgICB0aGlzLmhscy5vZmYoRXZlbnQuTEVWRUxfTE9BRElORywgdGhpcy5vbmxsKTtcbiAgfVxuXG4gIG9uTWFuaWZlc3RMb2FkaW5nKGV2ZW50LCBkYXRhKSB7XG4gICAgdGhpcy5sb2FkKGRhdGEudXJsLCBudWxsKTtcbiAgfVxuXG4gIG9uTGV2ZWxMb2FkaW5nKGV2ZW50LCBkYXRhKSB7XG4gICAgdGhpcy5sb2FkKGRhdGEudXJsLCBkYXRhLmxldmVsLCBkYXRhLmlkKTtcbiAgfVxuXG4gIGxvYWQodXJsLCBpZDEsIGlkMikge1xuICAgIHZhciBjb25maWcgPSB0aGlzLmhscy5jb25maWcsXG4gICAgICAgIHJldHJ5LFxuICAgICAgICB0aW1lb3V0LFxuICAgICAgICByZXRyeURlbGF5O1xuICAgIHRoaXMudXJsID0gdXJsO1xuICAgIHRoaXMuaWQgPSBpZDE7XG4gICAgdGhpcy5pZDIgPSBpZDI7XG4gICAgaWYodGhpcy5pZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXRyeSA9IGNvbmZpZy5tYW5pZmVzdExvYWRpbmdNYXhSZXRyeTtcbiAgICAgIHRpbWVvdXQgPSBjb25maWcubWFuaWZlc3RMb2FkaW5nVGltZU91dDtcbiAgICAgIHJldHJ5RGVsYXkgPSBjb25maWcubWFuaWZlc3RMb2FkaW5nUmV0cnlEZWxheTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0cnkgPSBjb25maWcubGV2ZWxMb2FkaW5nTWF4UmV0cnk7XG4gICAgICB0aW1lb3V0ID0gY29uZmlnLmxldmVsTG9hZGluZ1RpbWVPdXQ7XG4gICAgICByZXRyeURlbGF5ID0gY29uZmlnLmxldmVsTG9hZGluZ1JldHJ5RGVsYXk7XG4gICAgfVxuICAgIHRoaXMubG9hZGVyID0gdHlwZW9mKGNvbmZpZy5wTG9hZGVyKSAhPT0gJ3VuZGVmaW5lZCcgPyBuZXcgY29uZmlnLnBMb2FkZXIoY29uZmlnKSA6IG5ldyBjb25maWcubG9hZGVyKGNvbmZpZyk7XG4gICAgdGhpcy5sb2FkZXIubG9hZCh1cmwsICcnLCB0aGlzLmxvYWRzdWNjZXNzLmJpbmQodGhpcyksIHRoaXMubG9hZGVycm9yLmJpbmQodGhpcyksIHRoaXMubG9hZHRpbWVvdXQuYmluZCh0aGlzKSwgdGltZW91dCwgcmV0cnksIHJldHJ5RGVsYXkpO1xuICB9XG5cbiAgcmVzb2x2ZSh1cmwsIGJhc2VVcmwpIHtcbiAgICByZXR1cm4gVVJMSGVscGVyLmJ1aWxkQWJzb2x1dGVVUkwoYmFzZVVybCwgdXJsKTtcbiAgfVxuXG4gIHBhcnNlTWFzdGVyUGxheWxpc3Qoc3RyaW5nLCBiYXNldXJsKSB7XG4gICAgbGV0IGxldmVscyA9IFtdLCByZXN1bHQ7XG5cbiAgICAvLyBodHRwczovL3JlZ2V4MTAxLmNvbSBpcyB5b3VyIGZyaWVuZFxuICAgIGNvbnN0IHJlID0gLyNFWFQtWC1TVFJFQU0tSU5GOihbXlxcblxccl0qKVtcXHJcXG5dKyhbXlxcclxcbl0rKS9nO1xuICAgIHdoaWxlICgocmVzdWx0ID0gcmUuZXhlYyhzdHJpbmcpKSAhPSBudWxsKXtcbiAgICAgIGNvbnN0IGxldmVsID0ge307XG5cbiAgICAgIHZhciBhdHRycyA9IGxldmVsLmF0dHJzID0gbmV3IEF0dHJMaXN0KHJlc3VsdFsxXSk7XG4gICAgICBsZXZlbC51cmwgPSB0aGlzLnJlc29sdmUocmVzdWx0WzJdLCBiYXNldXJsKTtcblxuICAgICAgdmFyIHJlc29sdXRpb24gPSBhdHRycy5kZWNpbWFsUmVzb2x1dGlvbignUkVTT0xVVElPTicpO1xuICAgICAgaWYocmVzb2x1dGlvbikge1xuICAgICAgICBsZXZlbC53aWR0aCA9IHJlc29sdXRpb24ud2lkdGg7XG4gICAgICAgIGxldmVsLmhlaWdodCA9IHJlc29sdXRpb24uaGVpZ2h0O1xuICAgICAgfVxuICAgICAgbGV2ZWwuYml0cmF0ZSA9IGF0dHJzLmRlY2ltYWxJbnRlZ2VyKCdCQU5EV0lEVEgnKTtcbiAgICAgIGxldmVsLm5hbWUgPSBhdHRycy5OQU1FO1xuXG4gICAgICB2YXIgY29kZWNzID0gYXR0cnMuQ09ERUNTO1xuICAgICAgaWYoY29kZWNzKSB7XG4gICAgICAgIGNvZGVjcyA9IGNvZGVjcy5zcGxpdCgnLCcpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvZGVjcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGNvbnN0IGNvZGVjID0gY29kZWNzW2ldO1xuICAgICAgICAgIGlmIChjb2RlYy5pbmRleE9mKCdhdmMxJykgIT09IC0xKSB7XG4gICAgICAgICAgICBsZXZlbC52aWRlb0NvZGVjID0gdGhpcy5hdmMxdG9hdmNvdGkoY29kZWMpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsZXZlbC5hdWRpb0NvZGVjID0gY29kZWM7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGxldmVscy5wdXNoKGxldmVsKTtcbiAgICB9XG4gICAgcmV0dXJuIGxldmVscztcbiAgfVxuXG4gIGF2YzF0b2F2Y290aShjb2RlYykge1xuICAgIHZhciByZXN1bHQsIGF2Y2RhdGEgPSBjb2RlYy5zcGxpdCgnLicpO1xuICAgIGlmIChhdmNkYXRhLmxlbmd0aCA+IDIpIHtcbiAgICAgIHJlc3VsdCA9IGF2Y2RhdGEuc2hpZnQoKSArICcuJztcbiAgICAgIHJlc3VsdCArPSBwYXJzZUludChhdmNkYXRhLnNoaWZ0KCkpLnRvU3RyaW5nKDE2KTtcbiAgICAgIHJlc3VsdCArPSAoJzAwMCcgKyBwYXJzZUludChhdmNkYXRhLnNoaWZ0KCkpLnRvU3RyaW5nKDE2KSkuc3Vic3RyKC00KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0ID0gY29kZWM7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBjbG9uZU9iaihvYmopIHtcbiAgICByZXR1cm4gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShvYmopKTtcbiAgfVxuXG4gIHBhcnNlTGV2ZWxQbGF5bGlzdChzdHJpbmcsIGJhc2V1cmwsIGlkKSB7XG4gICAgdmFyIGN1cnJlbnRTTiA9IDAsXG4gICAgICAgIHRvdGFsZHVyYXRpb24gPSAwLFxuICAgICAgICBsZXZlbCA9IHt1cmw6IGJhc2V1cmwsIGZyYWdtZW50czogW10sIGxpdmU6IHRydWUsIHN0YXJ0U046IDB9LFxuICAgICAgICBsZXZlbGtleSA9IHttZXRob2QgOiBudWxsLCBrZXkgOiBudWxsLCBpdiA6IG51bGwsIHVyaSA6IG51bGx9LFxuICAgICAgICBjYyA9IDAsXG4gICAgICAgIHByb2dyYW1EYXRlVGltZSA9IG51bGwsXG4gICAgICAgIGZyYWcgPSBudWxsLFxuICAgICAgICByZXN1bHQsXG4gICAgICAgIHJlZ2V4cCxcbiAgICAgICAgYnl0ZVJhbmdlRW5kT2Zmc2V0LFxuICAgICAgICBieXRlUmFuZ2VTdGFydE9mZnNldDtcblxuICAgIHJlZ2V4cCA9IC8oPzojRVhULVgtKE1FRElBLVNFUVVFTkNFKTooXFxkKykpfCg/OiNFWFQtWC0oVEFSR0VURFVSQVRJT04pOihcXGQrKSl8KD86I0VYVC1YLShLRVkpOiguKikpfCg/OiNFWFQoSU5GKTooW1xcZFxcLl0rKVteXFxyXFxuXSooW1xcclxcbl0rW14jfFxcclxcbl0rKT8pfCg/OiNFWFQtWC0oQllURVJBTkdFKTooW1xcZF0rW0BbXFxkXSopXSpbXFxyXFxuXSsoW14jfFxcclxcbl0rKT98KD86I0VYVC1YLShFTkRMSVNUKSl8KD86I0VYVC1YLShESVMpQ09OVElOVUlUWSkpfCg/OiNFWFQtWC0oUFJPR1JBTS1EQVRFLVRJTUUpOiguKikpL2c7XG4gICAgd2hpbGUgKChyZXN1bHQgPSByZWdleHAuZXhlYyhzdHJpbmcpKSAhPT0gbnVsbCkge1xuICAgICAgcmVzdWx0LnNoaWZ0KCk7XG4gICAgICByZXN1bHQgPSByZXN1bHQuZmlsdGVyKGZ1bmN0aW9uKG4pIHsgcmV0dXJuIChuICE9PSB1bmRlZmluZWQpOyB9KTtcbiAgICAgIHN3aXRjaCAocmVzdWx0WzBdKSB7XG4gICAgICAgIGNhc2UgJ01FRElBLVNFUVVFTkNFJzpcbiAgICAgICAgICBjdXJyZW50U04gPSBsZXZlbC5zdGFydFNOID0gcGFyc2VJbnQocmVzdWx0WzFdKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnVEFSR0VURFVSQVRJT04nOlxuICAgICAgICAgIGxldmVsLnRhcmdldGR1cmF0aW9uID0gcGFyc2VGbG9hdChyZXN1bHRbMV0pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdFTkRMSVNUJzpcbiAgICAgICAgICBsZXZlbC5saXZlID0gZmFsc2U7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0RJUyc6XG4gICAgICAgICAgY2MrKztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnQllURVJBTkdFJzpcbiAgICAgICAgICB2YXIgcGFyYW1zID0gcmVzdWx0WzFdLnNwbGl0KCdAJyk7XG4gICAgICAgICAgaWYgKHBhcmFtcy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgIGJ5dGVSYW5nZVN0YXJ0T2Zmc2V0ID0gYnl0ZVJhbmdlRW5kT2Zmc2V0O1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBieXRlUmFuZ2VTdGFydE9mZnNldCA9IHBhcnNlSW50KHBhcmFtc1sxXSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJ5dGVSYW5nZUVuZE9mZnNldCA9IHBhcnNlSW50KHBhcmFtc1swXSkgKyBieXRlUmFuZ2VTdGFydE9mZnNldDtcbiAgICAgICAgICBpZiAoZnJhZyAmJiAhZnJhZy51cmwpIHtcbiAgICAgICAgICAgIGZyYWcuYnl0ZVJhbmdlU3RhcnRPZmZzZXQgPSBieXRlUmFuZ2VTdGFydE9mZnNldDtcbiAgICAgICAgICAgIGZyYWcuYnl0ZVJhbmdlRW5kT2Zmc2V0ID0gYnl0ZVJhbmdlRW5kT2Zmc2V0O1xuICAgICAgICAgICAgZnJhZy51cmwgPSB0aGlzLnJlc29sdmUocmVzdWx0WzJdLCBiYXNldXJsKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0lORic6XG4gICAgICAgICAgdmFyIGR1cmF0aW9uID0gcGFyc2VGbG9hdChyZXN1bHRbMV0pO1xuICAgICAgICAgIGlmICghaXNOYU4oZHVyYXRpb24pKSB7XG4gICAgICAgICAgICB2YXIgZnJhZ2RlY3J5cHRkYXRhLFxuICAgICAgICAgICAgICAgIHNuID0gY3VycmVudFNOKys7XG4gICAgICAgICAgICBpZiAobGV2ZWxrZXkubWV0aG9kICYmIGxldmVsa2V5LnVyaSAmJiAhbGV2ZWxrZXkuaXYpIHtcbiAgICAgICAgICAgICAgZnJhZ2RlY3J5cHRkYXRhID0gdGhpcy5jbG9uZU9iaihsZXZlbGtleSk7XG4gICAgICAgICAgICAgIHZhciB1aW50OFZpZXcgPSBuZXcgVWludDhBcnJheSgxNik7XG4gICAgICAgICAgICAgIGZvciAodmFyIGkgPSAxMjsgaSA8IDE2OyBpKyspIHtcbiAgICAgICAgICAgICAgICB1aW50OFZpZXdbaV0gPSAoc24gPj4gOCooMTUtaSkpICYgMHhmZjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBmcmFnZGVjcnlwdGRhdGEuaXYgPSB1aW50OFZpZXc7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBmcmFnZGVjcnlwdGRhdGEgPSBsZXZlbGtleTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhciB1cmwgPSByZXN1bHRbMl0gPyB0aGlzLnJlc29sdmUocmVzdWx0WzJdLCBiYXNldXJsKSA6IG51bGw7XG4gICAgICAgICAgICBmcmFnID0ge3VybDogdXJsLCBkdXJhdGlvbjogZHVyYXRpb24sIHN0YXJ0OiB0b3RhbGR1cmF0aW9uLCBzbjogc24sIGxldmVsOiBpZCwgY2M6IGNjLCBieXRlUmFuZ2VTdGFydE9mZnNldDogYnl0ZVJhbmdlU3RhcnRPZmZzZXQsIGJ5dGVSYW5nZUVuZE9mZnNldDogYnl0ZVJhbmdlRW5kT2Zmc2V0LCBkZWNyeXB0ZGF0YSA6IGZyYWdkZWNyeXB0ZGF0YSwgcHJvZ3JhbURhdGVUaW1lOiBwcm9ncmFtRGF0ZVRpbWV9O1xuICAgICAgICAgICAgbGV2ZWwuZnJhZ21lbnRzLnB1c2goZnJhZyk7XG4gICAgICAgICAgICB0b3RhbGR1cmF0aW9uICs9IGR1cmF0aW9uO1xuICAgICAgICAgICAgYnl0ZVJhbmdlU3RhcnRPZmZzZXQgPSBudWxsO1xuICAgICAgICAgICAgcHJvZ3JhbURhdGVUaW1lID0gbnVsbDtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0tFWSc6XG4gICAgICAgICAgLy8gaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL2RyYWZ0LXBhbnRvcy1odHRwLWxpdmUtc3RyZWFtaW5nLTA4I3NlY3Rpb24tMy40LjRcbiAgICAgICAgICB2YXIgZGVjcnlwdHBhcmFtcyA9IHJlc3VsdFsxXTtcbiAgICAgICAgICB2YXIga2V5QXR0cnMgPSBuZXcgQXR0ckxpc3QoZGVjcnlwdHBhcmFtcyk7XG4gICAgICAgICAgdmFyIGRlY3J5cHRtZXRob2QgPSBrZXlBdHRycy5lbnVtZXJhdGVkU3RyaW5nKCdNRVRIT0QnKSxcbiAgICAgICAgICAgICAgZGVjcnlwdHVyaSA9IGtleUF0dHJzLlVSSSxcbiAgICAgICAgICAgICAgZGVjcnlwdGl2ID0ga2V5QXR0cnMuaGV4YWRlY2ltYWxJbnRlZ2VyKCdJVicpO1xuICAgICAgICAgIGlmIChkZWNyeXB0bWV0aG9kKSB7XG4gICAgICAgICAgICBsZXZlbGtleSA9IHsgbWV0aG9kOiBudWxsLCBrZXk6IG51bGwsIGl2OiBudWxsLCB1cmk6IG51bGwgfTtcbiAgICAgICAgICAgIGlmICgoZGVjcnlwdHVyaSkgJiYgKGRlY3J5cHRtZXRob2QgPT09ICdBRVMtMTI4JykpIHtcbiAgICAgICAgICAgICAgbGV2ZWxrZXkubWV0aG9kID0gZGVjcnlwdG1ldGhvZDtcbiAgICAgICAgICAgICAgLy8gVVJJIHRvIGdldCB0aGUga2V5XG4gICAgICAgICAgICAgIGxldmVsa2V5LnVyaSA9IHRoaXMucmVzb2x2ZShkZWNyeXB0dXJpLCBiYXNldXJsKTtcbiAgICAgICAgICAgICAgbGV2ZWxrZXkua2V5ID0gbnVsbDtcbiAgICAgICAgICAgICAgLy8gSW5pdGlhbGl6YXRpb24gVmVjdG9yIChJVilcbiAgICAgICAgICAgICAgbGV2ZWxrZXkuaXYgPSBkZWNyeXB0aXY7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdQUk9HUkFNLURBVEUtVElNRSc6XG4gICAgICAgICAgcHJvZ3JhbURhdGVUaW1lID0gbmV3IERhdGUoRGF0ZS5wYXJzZShyZXN1bHRbMV0pKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgLy9sb2dnZXIubG9nKCdmb3VuZCAnICsgbGV2ZWwuZnJhZ21lbnRzLmxlbmd0aCArICcgZnJhZ21lbnRzJyk7XG4gICAgaWYoZnJhZyAmJiAhZnJhZy51cmwpIHtcbiAgICAgIGxldmVsLmZyYWdtZW50cy5wb3AoKTtcbiAgICAgIHRvdGFsZHVyYXRpb24tPWZyYWcuZHVyYXRpb247XG4gICAgfVxuICAgIGxldmVsLnRvdGFsZHVyYXRpb24gPSB0b3RhbGR1cmF0aW9uO1xuICAgIGxldmVsLmVuZFNOID0gY3VycmVudFNOIC0gMTtcbiAgICByZXR1cm4gbGV2ZWw7XG4gIH1cblxuICBsb2Fkc3VjY2VzcyhldmVudCwgc3RhdHMpIHtcbiAgICB2YXIgc3RyaW5nID0gZXZlbnQuY3VycmVudFRhcmdldC5yZXNwb25zZVRleHQsIHVybCA9IGV2ZW50LmN1cnJlbnRUYXJnZXQucmVzcG9uc2VVUkwsIGlkID0gdGhpcy5pZCwgaWQyID0gdGhpcy5pZDIsIGhscyA9IHRoaXMuaGxzLCBsZXZlbHM7XG4gICAgLy8gcmVzcG9uc2VVUkwgbm90IHN1cHBvcnRlZCBvbiBzb21lIGJyb3dzZXJzIChpdCBpcyB1c2VkIHRvIGRldGVjdCBVUkwgcmVkaXJlY3Rpb24pXG4gICAgaWYgKHVybCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBmYWxsYmFjayB0byBpbml0aWFsIFVSTFxuICAgICAgdXJsID0gdGhpcy51cmw7XG4gICAgfVxuICAgIHN0YXRzLnRsb2FkID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgc3RhdHMubXRpbWUgPSBuZXcgRGF0ZShldmVudC5jdXJyZW50VGFyZ2V0LmdldFJlc3BvbnNlSGVhZGVyKCdMYXN0LU1vZGlmaWVkJykpO1xuICAgIGlmIChzdHJpbmcuaW5kZXhPZignI0VYVE0zVScpID09PSAwKSB7XG4gICAgICBpZiAoc3RyaW5nLmluZGV4T2YoJyNFWFRJTkY6JykgPiAwKSB7XG4gICAgICAgIC8vIDEgbGV2ZWwgcGxheWxpc3RcbiAgICAgICAgLy8gaWYgZmlyc3QgcmVxdWVzdCwgZmlyZSBtYW5pZmVzdCBsb2FkZWQgZXZlbnQsIGxldmVsIHdpbGwgYmUgcmVsb2FkZWQgYWZ0ZXJ3YXJkc1xuICAgICAgICAvLyAodGhpcyBpcyB0byBoYXZlIGEgdW5pZm9ybSBsb2dpYyBmb3IgMSBsZXZlbC9tdWx0aWxldmVsIHBsYXlsaXN0cylcbiAgICAgICAgaWYgKHRoaXMuaWQgPT09IG51bGwpIHtcbiAgICAgICAgICBobHMudHJpZ2dlcihFdmVudC5NQU5JRkVTVF9MT0FERUQsIHtsZXZlbHM6IFt7dXJsOiB1cmx9XSwgdXJsOiB1cmwsIHN0YXRzOiBzdGF0c30pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhciBsZXZlbERldGFpbHMgPSB0aGlzLnBhcnNlTGV2ZWxQbGF5bGlzdChzdHJpbmcsIHVybCwgaWQpO1xuICAgICAgICAgIHN0YXRzLnRwYXJzZWQgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgICBobHMudHJpZ2dlcihFdmVudC5MRVZFTF9MT0FERUQsIHtkZXRhaWxzOiBsZXZlbERldGFpbHMsIGxldmVsOiBpZCwgaWQ6IGlkMiwgc3RhdHM6IHN0YXRzfSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxldmVscyA9IHRoaXMucGFyc2VNYXN0ZXJQbGF5bGlzdChzdHJpbmcsIHVybCk7XG4gICAgICAgIC8vIG11bHRpIGxldmVsIHBsYXlsaXN0LCBwYXJzZSBsZXZlbCBpbmZvXG4gICAgICAgIGlmIChsZXZlbHMubGVuZ3RoKSB7XG4gICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuTUFOSUZFU1RfTE9BREVELCB7bGV2ZWxzOiBsZXZlbHMsIHVybDogdXJsLCBzdGF0czogc3RhdHN9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBobHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTkVUV09SS19FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLk1BTklGRVNUX1BBUlNJTkdfRVJST1IsIGZhdGFsOiB0cnVlLCB1cmw6IHVybCwgcmVhc29uOiAnbm8gbGV2ZWwgZm91bmQgaW4gbWFuaWZlc3QnfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5NQU5JRkVTVF9QQVJTSU5HX0VSUk9SLCBmYXRhbDogdHJ1ZSwgdXJsOiB1cmwsIHJlYXNvbjogJ25vIEVYVE0zVSBkZWxpbWl0ZXInfSk7XG4gICAgfVxuICB9XG5cbiAgbG9hZGVycm9yKGV2ZW50KSB7XG4gICAgdmFyIGRldGFpbHMsIGZhdGFsO1xuICAgIGlmICh0aGlzLmlkID09PSBudWxsKSB7XG4gICAgICBkZXRhaWxzID0gRXJyb3JEZXRhaWxzLk1BTklGRVNUX0xPQURfRVJST1I7XG4gICAgICBmYXRhbCA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGRldGFpbHMgPSBFcnJvckRldGFpbHMuTEVWRUxfTE9BRF9FUlJPUjtcbiAgICAgIGZhdGFsID0gZmFsc2U7XG4gICAgfVxuICAgIHRoaXMubG9hZGVyLmFib3J0KCk7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTkVUV09SS19FUlJPUiwgZGV0YWlsczogZGV0YWlscywgZmF0YWw6IGZhdGFsLCB1cmw6IHRoaXMudXJsLCBsb2FkZXI6IHRoaXMubG9hZGVyLCByZXNwb25zZTogZXZlbnQuY3VycmVudFRhcmdldCwgbGV2ZWw6IHRoaXMuaWQsIGlkOiB0aGlzLmlkMn0pO1xuICB9XG5cbiAgbG9hZHRpbWVvdXQoKSB7XG4gICAgdmFyIGRldGFpbHMsIGZhdGFsO1xuICAgIGlmICh0aGlzLmlkID09PSBudWxsKSB7XG4gICAgICBkZXRhaWxzID0gRXJyb3JEZXRhaWxzLk1BTklGRVNUX0xPQURfVElNRU9VVDtcbiAgICAgIGZhdGFsID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgZGV0YWlscyA9IEVycm9yRGV0YWlscy5MRVZFTF9MT0FEX1RJTUVPVVQ7XG4gICAgICBmYXRhbCA9IGZhbHNlO1xuICAgIH1cbiAgIHRoaXMubG9hZGVyLmFib3J0KCk7XG4gICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5ORVRXT1JLX0VSUk9SLCBkZXRhaWxzOiBkZXRhaWxzLCBmYXRhbDogZmF0YWwsIHVybDogdGhpcy51cmwsIGxvYWRlcjogdGhpcy5sb2FkZXIsIGxldmVsOiB0aGlzLmlkLCBpZDogdGhpcy5pZDJ9KTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBQbGF5bGlzdExvYWRlcjtcbiIsIi8qKlxuICogR2VuZXJhdGUgTVA0IEJveFxuKi9cblxuLy9pbXBvcnQgSGV4IGZyb20gJy4uL3V0aWxzL2hleCc7XG5jbGFzcyBNUDQge1xuICBzdGF0aWMgaW5pdCgpIHtcbiAgICBNUDQudHlwZXMgPSB7XG4gICAgICBhdmMxOiBbXSwgLy8gY29kaW5nbmFtZVxuICAgICAgYXZjQzogW10sXG4gICAgICBidHJ0OiBbXSxcbiAgICAgIGRpbmY6IFtdLFxuICAgICAgZHJlZjogW10sXG4gICAgICBlc2RzOiBbXSxcbiAgICAgIGZ0eXA6IFtdLFxuICAgICAgaGRscjogW10sXG4gICAgICBtZGF0OiBbXSxcbiAgICAgIG1kaGQ6IFtdLFxuICAgICAgbWRpYTogW10sXG4gICAgICBtZmhkOiBbXSxcbiAgICAgIG1pbmY6IFtdLFxuICAgICAgbW9vZjogW10sXG4gICAgICBtb292OiBbXSxcbiAgICAgIG1wNGE6IFtdLFxuICAgICAgbXZleDogW10sXG4gICAgICBtdmhkOiBbXSxcbiAgICAgIHNkdHA6IFtdLFxuICAgICAgc3RibDogW10sXG4gICAgICBzdGNvOiBbXSxcbiAgICAgIHN0c2M6IFtdLFxuICAgICAgc3RzZDogW10sXG4gICAgICBzdHN6OiBbXSxcbiAgICAgIHN0dHM6IFtdLFxuICAgICAgdGZkdDogW10sXG4gICAgICB0ZmhkOiBbXSxcbiAgICAgIHRyYWY6IFtdLFxuICAgICAgdHJhazogW10sXG4gICAgICB0cnVuOiBbXSxcbiAgICAgIHRyZXg6IFtdLFxuICAgICAgdGtoZDogW10sXG4gICAgICB2bWhkOiBbXSxcbiAgICAgIHNtaGQ6IFtdXG4gICAgfTtcblxuICAgIHZhciBpO1xuICAgIGZvciAoaSBpbiBNUDQudHlwZXMpIHtcbiAgICAgIGlmIChNUDQudHlwZXMuaGFzT3duUHJvcGVydHkoaSkpIHtcbiAgICAgICAgTVA0LnR5cGVzW2ldID0gW1xuICAgICAgICAgIGkuY2hhckNvZGVBdCgwKSxcbiAgICAgICAgICBpLmNoYXJDb2RlQXQoMSksXG4gICAgICAgICAgaS5jaGFyQ29kZUF0KDIpLFxuICAgICAgICAgIGkuY2hhckNvZGVBdCgzKVxuICAgICAgICBdO1xuICAgICAgfVxuICAgIH1cblxuICAgIHZhciB2aWRlb0hkbHIgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBwcmVfZGVmaW5lZFxuICAgICAgMHg3NiwgMHg2OSwgMHg2NCwgMHg2NSwgLy8gaGFuZGxlcl90eXBlOiAndmlkZSdcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4NTYsIDB4NjksIDB4NjQsIDB4NjUsXG4gICAgICAweDZmLCAweDQ4LCAweDYxLCAweDZlLFxuICAgICAgMHg2NCwgMHg2YywgMHg2NSwgMHg3MiwgMHgwMCAvLyBuYW1lOiAnVmlkZW9IYW5kbGVyJ1xuICAgIF0pO1xuXG4gICAgdmFyIGF1ZGlvSGRsciA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAweDczLCAweDZmLCAweDc1LCAweDZlLCAvLyBoYW5kbGVyX3R5cGU6ICdzb3VuJ1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHg1MywgMHg2ZiwgMHg3NSwgMHg2ZSxcbiAgICAgIDB4NjQsIDB4NDgsIDB4NjEsIDB4NmUsXG4gICAgICAweDY0LCAweDZjLCAweDY1LCAweDcyLCAweDAwIC8vIG5hbWU6ICdTb3VuZEhhbmRsZXInXG4gICAgXSk7XG5cbiAgICBNUDQuSERMUl9UWVBFUyA9IHtcbiAgICAgICd2aWRlbyc6IHZpZGVvSGRscixcbiAgICAgICdhdWRpbyc6IGF1ZGlvSGRsclxuICAgIH07XG5cbiAgICB2YXIgZHJlZiA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDEsIC8vIGVudHJ5X2NvdW50XG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDBjLCAvLyBlbnRyeV9zaXplXG4gICAgICAweDc1LCAweDcyLCAweDZjLCAweDIwLCAvLyAndXJsJyB0eXBlXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDEgLy8gZW50cnlfZmxhZ3NcbiAgICBdKTtcblxuICAgIHZhciBzdGNvID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAgLy8gZW50cnlfY291bnRcbiAgICBdKTtcblxuICAgIE1QNC5TVFRTID0gTVA0LlNUU0MgPSBNUDQuU1RDTyA9IHN0Y287XG5cbiAgICBNUDQuU1RTWiA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBzYW1wbGVfc2l6ZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gc2FtcGxlX2NvdW50XG4gICAgXSk7XG4gICAgTVA0LlZNSEQgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uXG4gICAgICAweDAwLCAweDAwLCAweDAxLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgLy8gZ3JhcGhpY3Ntb2RlXG4gICAgICAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAgLy8gb3Bjb2xvclxuICAgIF0pO1xuICAgIE1QNC5TTUhEID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIC8vIGJhbGFuY2VcbiAgICAgIDB4MDAsIDB4MDAgLy8gcmVzZXJ2ZWRcbiAgICBdKTtcblxuICAgIE1QNC5TVFNEID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMV0pOy8vIGVudHJ5X2NvdW50XG5cbiAgICB2YXIgbWFqb3JCcmFuZCA9IG5ldyBVaW50OEFycmF5KFsxMDUsMTE1LDExMSwxMDldKTsgLy8gaXNvbVxuICAgIHZhciBhdmMxQnJhbmQgPSBuZXcgVWludDhBcnJheShbOTcsMTE4LDk5LDQ5XSk7IC8vIGF2YzFcbiAgICB2YXIgbWlub3JWZXJzaW9uID0gbmV3IFVpbnQ4QXJyYXkoWzAsIDAsIDAsIDFdKTtcblxuICAgIE1QNC5GVFlQID0gTVA0LmJveChNUDQudHlwZXMuZnR5cCwgbWFqb3JCcmFuZCwgbWlub3JWZXJzaW9uLCBtYWpvckJyYW5kLCBhdmMxQnJhbmQpO1xuICAgIE1QNC5ESU5GID0gTVA0LmJveChNUDQudHlwZXMuZGluZiwgTVA0LmJveChNUDQudHlwZXMuZHJlZiwgZHJlZikpO1xuICB9XG5cbiAgc3RhdGljIGJveCh0eXBlKSB7XG4gIHZhclxuICAgIHBheWxvYWQgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpLFxuICAgIHNpemUgPSA4LFxuICAgIGkgPSBwYXlsb2FkLmxlbmd0aCxcbiAgICBsZW4gPSBpLFxuICAgIHJlc3VsdDtcbiAgICAvLyBjYWxjdWxhdGUgdGhlIHRvdGFsIHNpemUgd2UgbmVlZCB0byBhbGxvY2F0ZVxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIHNpemUgKz0gcGF5bG9hZFtpXS5ieXRlTGVuZ3RoO1xuICAgIH1cbiAgICByZXN1bHQgPSBuZXcgVWludDhBcnJheShzaXplKTtcbiAgICByZXN1bHRbMF0gPSAoc2l6ZSA+PiAyNCkgJiAweGZmO1xuICAgIHJlc3VsdFsxXSA9IChzaXplID4+IDE2KSAmIDB4ZmY7XG4gICAgcmVzdWx0WzJdID0gKHNpemUgPj4gOCkgJiAweGZmO1xuICAgIHJlc3VsdFszXSA9IHNpemUgICYgMHhmZjtcbiAgICByZXN1bHQuc2V0KHR5cGUsIDQpO1xuICAgIC8vIGNvcHkgdGhlIHBheWxvYWQgaW50byB0aGUgcmVzdWx0XG4gICAgZm9yIChpID0gMCwgc2l6ZSA9IDg7IGkgPCBsZW47IGkrKykge1xuICAgICAgLy8gY29weSBwYXlsb2FkW2ldIGFycmF5IEAgb2Zmc2V0IHNpemVcbiAgICAgIHJlc3VsdC5zZXQocGF5bG9hZFtpXSwgc2l6ZSk7XG4gICAgICBzaXplICs9IHBheWxvYWRbaV0uYnl0ZUxlbmd0aDtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHN0YXRpYyBoZGxyKHR5cGUpIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuaGRsciwgTVA0LkhETFJfVFlQRVNbdHlwZV0pO1xuICB9XG5cbiAgc3RhdGljIG1kYXQoZGF0YSkge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tZGF0LCBkYXRhKTtcbiAgfVxuXG4gIHN0YXRpYyBtZGhkKHRpbWVzY2FsZSwgZHVyYXRpb24pIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWRoZCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMiwgLy8gY3JlYXRpb25fdGltZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMywgLy8gbW9kaWZpY2F0aW9uX3RpbWVcbiAgICAgICh0aW1lc2NhbGUgPj4gMjQpICYgMHhGRixcbiAgICAgICh0aW1lc2NhbGUgPj4gMTYpICYgMHhGRixcbiAgICAgICh0aW1lc2NhbGUgPj4gIDgpICYgMHhGRixcbiAgICAgIHRpbWVzY2FsZSAmIDB4RkYsIC8vIHRpbWVzY2FsZVxuICAgICAgKGR1cmF0aW9uID4+IDI0KSxcbiAgICAgIChkdXJhdGlvbiA+PiAxNikgJiAweEZGLFxuICAgICAgKGR1cmF0aW9uID4+ICA4KSAmIDB4RkYsXG4gICAgICBkdXJhdGlvbiAmIDB4RkYsIC8vIGR1cmF0aW9uXG4gICAgICAweDU1LCAweGM0LCAvLyAndW5kJyBsYW5ndWFnZSAodW5kZXRlcm1pbmVkKVxuICAgICAgMHgwMCwgMHgwMFxuICAgIF0pKTtcbiAgfVxuXG4gIHN0YXRpYyBtZGlhKHRyYWNrKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1kaWEsIE1QNC5tZGhkKHRyYWNrLnRpbWVzY2FsZSwgdHJhY2suZHVyYXRpb24pLCBNUDQuaGRscih0cmFjay50eXBlKSwgTVA0Lm1pbmYodHJhY2spKTtcbiAgfVxuXG4gIHN0YXRpYyBtZmhkKHNlcXVlbmNlTnVtYmVyKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1maGQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgKHNlcXVlbmNlTnVtYmVyID4+IDI0KSxcbiAgICAgIChzZXF1ZW5jZU51bWJlciA+PiAxNikgJiAweEZGLFxuICAgICAgKHNlcXVlbmNlTnVtYmVyID4+ICA4KSAmIDB4RkYsXG4gICAgICBzZXF1ZW5jZU51bWJlciAmIDB4RkYsIC8vIHNlcXVlbmNlX251bWJlclxuICAgIF0pKTtcbiAgfVxuXG4gIHN0YXRpYyBtaW5mKHRyYWNrKSB7XG4gICAgaWYgKHRyYWNrLnR5cGUgPT09ICdhdWRpbycpIHtcbiAgICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5taW5mLCBNUDQuYm94KE1QNC50eXBlcy5zbWhkLCBNUDQuU01IRCksIE1QNC5ESU5GLCBNUDQuc3RibCh0cmFjaykpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWluZiwgTVA0LmJveChNUDQudHlwZXMudm1oZCwgTVA0LlZNSEQpLCBNUDQuRElORiwgTVA0LnN0YmwodHJhY2spKTtcbiAgICB9XG4gIH1cblxuICBzdGF0aWMgbW9vZihzbiwgYmFzZU1lZGlhRGVjb2RlVGltZSwgdHJhY2spIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubW9vZiwgTVA0Lm1maGQoc24pLCBNUDQudHJhZih0cmFjayxiYXNlTWVkaWFEZWNvZGVUaW1lKSk7XG4gIH1cbi8qKlxuICogQHBhcmFtIHRyYWNrcy4uLiAob3B0aW9uYWwpIHthcnJheX0gdGhlIHRyYWNrcyBhc3NvY2lhdGVkIHdpdGggdGhpcyBtb3ZpZVxuICovXG4gIHN0YXRpYyBtb292KHRyYWNrcykge1xuICAgIHZhclxuICAgICAgaSA9IHRyYWNrcy5sZW5ndGgsXG4gICAgICBib3hlcyA9IFtdO1xuXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgYm94ZXNbaV0gPSBNUDQudHJhayh0cmFja3NbaV0pO1xuICAgIH1cblxuICAgIHJldHVybiBNUDQuYm94LmFwcGx5KG51bGwsIFtNUDQudHlwZXMubW9vdiwgTVA0Lm12aGQodHJhY2tzWzBdLnRpbWVzY2FsZSwgdHJhY2tzWzBdLmR1cmF0aW9uKV0uY29uY2F0KGJveGVzKS5jb25jYXQoTVA0Lm12ZXgodHJhY2tzKSkpO1xuICB9XG5cbiAgc3RhdGljIG12ZXgodHJhY2tzKSB7XG4gICAgdmFyXG4gICAgICBpID0gdHJhY2tzLmxlbmd0aCxcbiAgICAgIGJveGVzID0gW107XG5cbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICBib3hlc1tpXSA9IE1QNC50cmV4KHRyYWNrc1tpXSk7XG4gICAgfVxuICAgIHJldHVybiBNUDQuYm94LmFwcGx5KG51bGwsIFtNUDQudHlwZXMubXZleF0uY29uY2F0KGJveGVzKSk7XG4gIH1cblxuICBzdGF0aWMgbXZoZCh0aW1lc2NhbGUsZHVyYXRpb24pIHtcbiAgICB2YXJcbiAgICAgIGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMSwgLy8gY3JlYXRpb25fdGltZVxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAyLCAvLyBtb2RpZmljYXRpb25fdGltZVxuICAgICAgICAodGltZXNjYWxlID4+IDI0KSAmIDB4RkYsXG4gICAgICAgICh0aW1lc2NhbGUgPj4gMTYpICYgMHhGRixcbiAgICAgICAgKHRpbWVzY2FsZSA+PiAgOCkgJiAweEZGLFxuICAgICAgICB0aW1lc2NhbGUgJiAweEZGLCAvLyB0aW1lc2NhbGVcbiAgICAgICAgKGR1cmF0aW9uID4+IDI0KSAmIDB4RkYsXG4gICAgICAgIChkdXJhdGlvbiA+PiAxNikgJiAweEZGLFxuICAgICAgICAoZHVyYXRpb24gPj4gIDgpICYgMHhGRixcbiAgICAgICAgZHVyYXRpb24gJiAweEZGLCAvLyBkdXJhdGlvblxuICAgICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLCAvLyAxLjAgcmF0ZVxuICAgICAgICAweDAxLCAweDAwLCAvLyAxLjAgdm9sdW1lXG4gICAgICAgIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4NDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHRyYW5zZm9ybWF0aW9uOiB1bml0eSBtYXRyaXhcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcHJlX2RlZmluZWRcbiAgICAgICAgMHhmZiwgMHhmZiwgMHhmZiwgMHhmZiAvLyBuZXh0X3RyYWNrX0lEXG4gICAgICBdKTtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubXZoZCwgYnl0ZXMpO1xuICB9XG5cbiAgc3RhdGljIHNkdHAodHJhY2spIHtcbiAgICB2YXJcbiAgICAgIHNhbXBsZXMgPSB0cmFjay5zYW1wbGVzIHx8IFtdLFxuICAgICAgYnl0ZXMgPSBuZXcgVWludDhBcnJheSg0ICsgc2FtcGxlcy5sZW5ndGgpLFxuICAgICAgZmxhZ3MsXG4gICAgICBpO1xuICAgIC8vIGxlYXZlIHRoZSBmdWxsIGJveCBoZWFkZXIgKDQgYnl0ZXMpIGFsbCB6ZXJvXG4gICAgLy8gd3JpdGUgdGhlIHNhbXBsZSB0YWJsZVxuICAgIGZvciAoaSA9IDA7IGkgPCBzYW1wbGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBmbGFncyA9IHNhbXBsZXNbaV0uZmxhZ3M7XG4gICAgICBieXRlc1tpICsgNF0gPSAoZmxhZ3MuZGVwZW5kc09uIDw8IDQpIHxcbiAgICAgICAgKGZsYWdzLmlzRGVwZW5kZWRPbiA8PCAyKSB8XG4gICAgICAgIChmbGFncy5oYXNSZWR1bmRhbmN5KTtcbiAgICB9XG5cbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuc2R0cCwgYnl0ZXMpO1xuICB9XG5cbiAgc3RhdGljIHN0YmwodHJhY2spIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuc3RibCwgTVA0LnN0c2QodHJhY2spLCBNUDQuYm94KE1QNC50eXBlcy5zdHRzLCBNUDQuU1RUUyksIE1QNC5ib3goTVA0LnR5cGVzLnN0c2MsIE1QNC5TVFNDKSwgTVA0LmJveChNUDQudHlwZXMuc3RzeiwgTVA0LlNUU1opLCBNUDQuYm94KE1QNC50eXBlcy5zdGNvLCBNUDQuU1RDTykpO1xuICB9XG5cbiAgc3RhdGljIGF2YzEodHJhY2spIHtcbiAgICB2YXIgc3BzID0gW10sIHBwcyA9IFtdLCBpLCBkYXRhLCBsZW47XG4gICAgLy8gYXNzZW1ibGUgdGhlIFNQU3NcblxuICAgIGZvciAoaSA9IDA7IGkgPCB0cmFjay5zcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGRhdGEgPSB0cmFjay5zcHNbaV07XG4gICAgICBsZW4gPSBkYXRhLmJ5dGVMZW5ndGg7XG4gICAgICBzcHMucHVzaCgobGVuID4+PiA4KSAmIDB4RkYpO1xuICAgICAgc3BzLnB1c2goKGxlbiAmIDB4RkYpKTtcbiAgICAgIHNwcyA9IHNwcy5jb25jYXQoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZGF0YSkpOyAvLyBTUFNcbiAgICB9XG5cbiAgICAvLyBhc3NlbWJsZSB0aGUgUFBTc1xuICAgIGZvciAoaSA9IDA7IGkgPCB0cmFjay5wcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGRhdGEgPSB0cmFjay5wcHNbaV07XG4gICAgICBsZW4gPSBkYXRhLmJ5dGVMZW5ndGg7XG4gICAgICBwcHMucHVzaCgobGVuID4+PiA4KSAmIDB4RkYpO1xuICAgICAgcHBzLnB1c2goKGxlbiAmIDB4RkYpKTtcbiAgICAgIHBwcyA9IHBwcy5jb25jYXQoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZGF0YSkpO1xuICAgIH1cblxuICAgIHZhciBhdmNjID0gTVA0LmJveChNUDQudHlwZXMuYXZjQywgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAgICAgMHgwMSwgICAvLyB2ZXJzaW9uXG4gICAgICAgICAgICBzcHNbM10sIC8vIHByb2ZpbGVcbiAgICAgICAgICAgIHNwc1s0XSwgLy8gcHJvZmlsZSBjb21wYXRcbiAgICAgICAgICAgIHNwc1s1XSwgLy8gbGV2ZWxcbiAgICAgICAgICAgIDB4ZmMgfCAzLCAvLyBsZW5ndGhTaXplTWludXNPbmUsIGhhcmQtY29kZWQgdG8gNCBieXRlc1xuICAgICAgICAgICAgMHhFMCB8IHRyYWNrLnNwcy5sZW5ndGggLy8gM2JpdCByZXNlcnZlZCAoMTExKSArIG51bU9mU2VxdWVuY2VQYXJhbWV0ZXJTZXRzXG4gICAgICAgICAgXS5jb25jYXQoc3BzKS5jb25jYXQoW1xuICAgICAgICAgICAgdHJhY2sucHBzLmxlbmd0aCAvLyBudW1PZlBpY3R1cmVQYXJhbWV0ZXJTZXRzXG4gICAgICAgICAgXSkuY29uY2F0KHBwcykpKSwgLy8gXCJQUFNcIlxuICAgICAgICB3aWR0aCA9IHRyYWNrLndpZHRoLFxuICAgICAgICBoZWlnaHQgPSB0cmFjay5oZWlnaHQ7XG4gICAgLy9jb25zb2xlLmxvZygnYXZjYzonICsgSGV4LmhleER1bXAoYXZjYykpO1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5hdmMxLCBuZXcgVWludDhBcnJheShbXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDEsIC8vIGRhdGFfcmVmZXJlbmNlX2luZGV4XG4gICAgICAgIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAgICh3aWR0aCA+PiA4KSAmIDB4RkYsXG4gICAgICAgIHdpZHRoICYgMHhmZiwgLy8gd2lkdGhcbiAgICAgICAgKGhlaWdodCA+PiA4KSAmIDB4RkYsXG4gICAgICAgIGhlaWdodCAmIDB4ZmYsIC8vIGhlaWdodFxuICAgICAgICAweDAwLCAweDQ4LCAweDAwLCAweDAwLCAvLyBob3JpenJlc29sdXRpb25cbiAgICAgICAgMHgwMCwgMHg0OCwgMHgwMCwgMHgwMCwgLy8gdmVydHJlc29sdXRpb25cbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMSwgLy8gZnJhbWVfY291bnRcbiAgICAgICAgMHgxMyxcbiAgICAgICAgMHg3NiwgMHg2OSwgMHg2NCwgMHg2NSxcbiAgICAgICAgMHg2ZiwgMHg2YSwgMHg3MywgMHgyZCxcbiAgICAgICAgMHg2MywgMHg2ZiwgMHg2ZSwgMHg3NCxcbiAgICAgICAgMHg3MiwgMHg2OSwgMHg2MiwgMHgyZCxcbiAgICAgICAgMHg2OCwgMHg2YywgMHg3MywgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gY29tcHJlc3Nvcm5hbWVcbiAgICAgICAgMHgwMCwgMHgxOCwgLy8gZGVwdGggPSAyNFxuICAgICAgICAweDExLCAweDExXSksIC8vIHByZV9kZWZpbmVkID0gLTFcbiAgICAgICAgICBhdmNjLFxuICAgICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLmJ0cnQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgICAgIDB4MDAsIDB4MWMsIDB4OWMsIDB4ODAsIC8vIGJ1ZmZlclNpemVEQlxuICAgICAgICAgICAgMHgwMCwgMHgyZCwgMHhjNiwgMHhjMCwgLy8gbWF4Qml0cmF0ZVxuICAgICAgICAgICAgMHgwMCwgMHgyZCwgMHhjNiwgMHhjMF0pKSAvLyBhdmdCaXRyYXRlXG4gICAgICAgICAgKTtcbiAgfVxuXG4gIHN0YXRpYyBlc2RzKHRyYWNrKSB7XG4gICAgdmFyIGNvbmZpZ2xlbiA9IHRyYWNrLmNvbmZpZy5sZW5ndGg7XG4gICAgcmV0dXJuIG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcblxuICAgICAgMHgwMywgLy8gZGVzY3JpcHRvcl90eXBlXG4gICAgICAweDE3K2NvbmZpZ2xlbiwgLy8gbGVuZ3RoXG4gICAgICAweDAwLCAweDAxLCAvL2VzX2lkXG4gICAgICAweDAwLCAvLyBzdHJlYW1fcHJpb3JpdHlcblxuICAgICAgMHgwNCwgLy8gZGVzY3JpcHRvcl90eXBlXG4gICAgICAweDBmK2NvbmZpZ2xlbiwgLy8gbGVuZ3RoXG4gICAgICAweDQwLCAvL2NvZGVjIDogbXBlZzRfYXVkaW9cbiAgICAgIDB4MTUsIC8vIHN0cmVhbV90eXBlXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBidWZmZXJfc2l6ZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gbWF4Qml0cmF0ZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gYXZnQml0cmF0ZVxuXG4gICAgICAweDA1IC8vIGRlc2NyaXB0b3JfdHlwZVxuICAgICAgXS5jb25jYXQoW2NvbmZpZ2xlbl0pLmNvbmNhdCh0cmFjay5jb25maWcpLmNvbmNhdChbMHgwNiwgMHgwMSwgMHgwMl0pKTsgLy8gR0FTcGVjaWZpY0NvbmZpZykpOyAvLyBsZW5ndGggKyBhdWRpbyBjb25maWcgZGVzY3JpcHRvclxuICB9XG5cbiAgc3RhdGljIG1wNGEodHJhY2spIHtcbiAgICB2YXIgYXVkaW9zYW1wbGVyYXRlID0gdHJhY2suYXVkaW9zYW1wbGVyYXRlO1xuICAgICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1wNGEsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMSwgLy8gZGF0YV9yZWZlcmVuY2VfaW5kZXhcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgdHJhY2suY2hhbm5lbENvdW50LCAvLyBjaGFubmVsY291bnRcbiAgICAgIDB4MDAsIDB4MTAsIC8vIHNhbXBsZVNpemU6MTZiaXRzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZDJcbiAgICAgIChhdWRpb3NhbXBsZXJhdGUgPj4gOCkgJiAweEZGLFxuICAgICAgYXVkaW9zYW1wbGVyYXRlICYgMHhmZiwgLy9cbiAgICAgIDB4MDAsIDB4MDBdKSxcbiAgICAgIE1QNC5ib3goTVA0LnR5cGVzLmVzZHMsIE1QNC5lc2RzKHRyYWNrKSkpO1xuICB9XG5cbiAgc3RhdGljIHN0c2QodHJhY2spIHtcbiAgICBpZiAodHJhY2sudHlwZSA9PT0gJ2F1ZGlvJykge1xuICAgICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnN0c2QsIE1QNC5TVFNELCBNUDQubXA0YSh0cmFjaykpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuc3RzZCwgTVA0LlNUU0QsIE1QNC5hdmMxKHRyYWNrKSk7XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIHRraGQodHJhY2spIHtcbiAgICB2YXIgaWQgPSB0cmFjay5pZCxcbiAgICAgICAgZHVyYXRpb24gPSB0cmFjay5kdXJhdGlvbixcbiAgICAgICAgd2lkdGggPSB0cmFjay53aWR0aCxcbiAgICAgICAgaGVpZ2h0ID0gdHJhY2suaGVpZ2h0O1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50a2hkLCBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDcsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBjcmVhdGlvbl90aW1lXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBtb2RpZmljYXRpb25fdGltZVxuICAgICAgKGlkID4+IDI0KSAmIDB4RkYsXG4gICAgICAoaWQgPj4gMTYpICYgMHhGRixcbiAgICAgIChpZCA+PiA4KSAmIDB4RkYsXG4gICAgICBpZCAmIDB4RkYsIC8vIHRyYWNrX0lEXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgKGR1cmF0aW9uID4+IDI0KSxcbiAgICAgIChkdXJhdGlvbiA+PiAxNikgJiAweEZGLFxuICAgICAgKGR1cmF0aW9uID4+ICA4KSAmIDB4RkYsXG4gICAgICBkdXJhdGlvbiAmIDB4RkYsIC8vIGR1cmF0aW9uXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIC8vIGxheWVyXG4gICAgICAweDAwLCAweDAwLCAvLyBhbHRlcm5hdGVfZ3JvdXBcbiAgICAgIDB4MDAsIDB4MDAsIC8vIG5vbi1hdWRpbyB0cmFjayB2b2x1bWVcbiAgICAgIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4NDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHRyYW5zZm9ybWF0aW9uOiB1bml0eSBtYXRyaXhcbiAgICAgICh3aWR0aCA+PiA4KSAmIDB4RkYsXG4gICAgICB3aWR0aCAmIDB4RkYsXG4gICAgICAweDAwLCAweDAwLCAvLyB3aWR0aFxuICAgICAgKGhlaWdodCA+PiA4KSAmIDB4RkYsXG4gICAgICBoZWlnaHQgJiAweEZGLFxuICAgICAgMHgwMCwgMHgwMCAvLyBoZWlnaHRcbiAgICBdKSk7XG4gIH1cblxuICBzdGF0aWMgdHJhZih0cmFjayxiYXNlTWVkaWFEZWNvZGVUaW1lKSB7XG4gICAgdmFyIHNhbXBsZURlcGVuZGVuY3lUYWJsZSA9IE1QNC5zZHRwKHRyYWNrKSxcbiAgICAgICAgaWQgPSB0cmFjay5pZDtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudHJhZixcbiAgICAgICAgICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLnRmaGQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgICAgICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAgICAgICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAgICAgICAgICAgIChpZCA+PiAyNCksXG4gICAgICAgICAgICAgICAgIChpZCA+PiAxNikgJiAwWEZGLFxuICAgICAgICAgICAgICAgICAoaWQgPj4gOCkgJiAwWEZGLFxuICAgICAgICAgICAgICAgICAoaWQgJiAweEZGKSAvLyB0cmFja19JRFxuICAgICAgICAgICAgICAgXSkpLFxuICAgICAgICAgICAgICAgTVA0LmJveChNUDQudHlwZXMudGZkdCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAgICAgICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgICAgICAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgICAgICAgICAgICAgKGJhc2VNZWRpYURlY29kZVRpbWUgPj4yNCksXG4gICAgICAgICAgICAgICAgIChiYXNlTWVkaWFEZWNvZGVUaW1lID4+IDE2KSAmIDBYRkYsXG4gICAgICAgICAgICAgICAgIChiYXNlTWVkaWFEZWNvZGVUaW1lID4+IDgpICYgMFhGRixcbiAgICAgICAgICAgICAgICAgKGJhc2VNZWRpYURlY29kZVRpbWUgJiAweEZGKSAvLyBiYXNlTWVkaWFEZWNvZGVUaW1lXG4gICAgICAgICAgICAgICBdKSksXG4gICAgICAgICAgICAgICBNUDQudHJ1bih0cmFjayxcbiAgICAgICAgICAgICAgICAgICAgc2FtcGxlRGVwZW5kZW5jeVRhYmxlLmxlbmd0aCArXG4gICAgICAgICAgICAgICAgICAgIDE2ICsgLy8gdGZoZFxuICAgICAgICAgICAgICAgICAgICAxNiArIC8vIHRmZHRcbiAgICAgICAgICAgICAgICAgICAgOCArICAvLyB0cmFmIGhlYWRlclxuICAgICAgICAgICAgICAgICAgICAxNiArIC8vIG1maGRcbiAgICAgICAgICAgICAgICAgICAgOCArICAvLyBtb29mIGhlYWRlclxuICAgICAgICAgICAgICAgICAgICA4KSwgIC8vIG1kYXQgaGVhZGVyXG4gICAgICAgICAgICAgICBzYW1wbGVEZXBlbmRlbmN5VGFibGUpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdlbmVyYXRlIGEgdHJhY2sgYm94LlxuICAgKiBAcGFyYW0gdHJhY2sge29iamVjdH0gYSB0cmFjayBkZWZpbml0aW9uXG4gICAqIEByZXR1cm4ge1VpbnQ4QXJyYXl9IHRoZSB0cmFjayBib3hcbiAgICovXG4gIHN0YXRpYyB0cmFrKHRyYWNrKSB7XG4gICAgdHJhY2suZHVyYXRpb24gPSB0cmFjay5kdXJhdGlvbiB8fCAweGZmZmZmZmZmO1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50cmFrLCBNUDQudGtoZCh0cmFjayksIE1QNC5tZGlhKHRyYWNrKSk7XG4gIH1cblxuICBzdGF0aWMgdHJleCh0cmFjaykge1xuICAgIHZhciBpZCA9IHRyYWNrLmlkO1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50cmV4LCBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgIChpZCA+PiAyNCksXG4gICAgIChpZCA+PiAxNikgJiAwWEZGLFxuICAgICAoaWQgPj4gOCkgJiAwWEZGLFxuICAgICAoaWQgJiAweEZGKSwgLy8gdHJhY2tfSURcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDEsIC8vIGRlZmF1bHRfc2FtcGxlX2Rlc2NyaXB0aW9uX2luZGV4XG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBkZWZhdWx0X3NhbXBsZV9kdXJhdGlvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZGVmYXVsdF9zYW1wbGVfc2l6ZVxuICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMSAvLyBkZWZhdWx0X3NhbXBsZV9mbGFnc1xuICAgIF0pKTtcbiAgfVxuXG4gIHN0YXRpYyB0cnVuKHRyYWNrLCBvZmZzZXQpIHtcbiAgICB2YXIgc2FtcGxlcz0gdHJhY2suc2FtcGxlcyB8fCBbXSxcbiAgICAgICAgbGVuID0gc2FtcGxlcy5sZW5ndGgsXG4gICAgICAgIGFycmF5bGVuID0gMTIgKyAoMTYgKiBsZW4pLFxuICAgICAgICBhcnJheSA9IG5ldyBVaW50OEFycmF5KGFycmF5bGVuKSxcbiAgICAgICAgaSxzYW1wbGUsZHVyYXRpb24sc2l6ZSxmbGFncyxjdHM7XG4gICAgb2Zmc2V0ICs9IDggKyBhcnJheWxlbjtcbiAgICBhcnJheS5zZXQoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDBmLCAweDAxLCAvLyBmbGFnc1xuICAgICAgKGxlbiA+Pj4gMjQpICYgMHhGRixcbiAgICAgIChsZW4gPj4+IDE2KSAmIDB4RkYsXG4gICAgICAobGVuID4+PiA4KSAmIDB4RkYsXG4gICAgICBsZW4gJiAweEZGLCAvLyBzYW1wbGVfY291bnRcbiAgICAgIChvZmZzZXQgPj4+IDI0KSAmIDB4RkYsXG4gICAgICAob2Zmc2V0ID4+PiAxNikgJiAweEZGLFxuICAgICAgKG9mZnNldCA+Pj4gOCkgJiAweEZGLFxuICAgICAgb2Zmc2V0ICYgMHhGRiAvLyBkYXRhX29mZnNldFxuICAgIF0sMCk7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBzYW1wbGUgPSBzYW1wbGVzW2ldO1xuICAgICAgZHVyYXRpb24gPSBzYW1wbGUuZHVyYXRpb247XG4gICAgICBzaXplID0gc2FtcGxlLnNpemU7XG4gICAgICBmbGFncyA9IHNhbXBsZS5mbGFncztcbiAgICAgIGN0cyA9IHNhbXBsZS5jdHM7XG4gICAgICBhcnJheS5zZXQoW1xuICAgICAgICAoZHVyYXRpb24gPj4+IDI0KSAmIDB4RkYsXG4gICAgICAgIChkdXJhdGlvbiA+Pj4gMTYpICYgMHhGRixcbiAgICAgICAgKGR1cmF0aW9uID4+PiA4KSAmIDB4RkYsXG4gICAgICAgIGR1cmF0aW9uICYgMHhGRiwgLy8gc2FtcGxlX2R1cmF0aW9uXG4gICAgICAgIChzaXplID4+PiAyNCkgJiAweEZGLFxuICAgICAgICAoc2l6ZSA+Pj4gMTYpICYgMHhGRixcbiAgICAgICAgKHNpemUgPj4+IDgpICYgMHhGRixcbiAgICAgICAgc2l6ZSAmIDB4RkYsIC8vIHNhbXBsZV9zaXplXG4gICAgICAgIChmbGFncy5pc0xlYWRpbmcgPDwgMikgfCBmbGFncy5kZXBlbmRzT24sXG4gICAgICAgIChmbGFncy5pc0RlcGVuZGVkT24gPDwgNikgfFxuICAgICAgICAgIChmbGFncy5oYXNSZWR1bmRhbmN5IDw8IDQpIHxcbiAgICAgICAgICAoZmxhZ3MucGFkZGluZ1ZhbHVlIDw8IDEpIHxcbiAgICAgICAgICBmbGFncy5pc05vblN5bmMsXG4gICAgICAgIGZsYWdzLmRlZ3JhZFByaW8gJiAweEYwIDw8IDgsXG4gICAgICAgIGZsYWdzLmRlZ3JhZFByaW8gJiAweDBGLCAvLyBzYW1wbGVfZmxhZ3NcbiAgICAgICAgKGN0cyA+Pj4gMjQpICYgMHhGRixcbiAgICAgICAgKGN0cyA+Pj4gMTYpICYgMHhGRixcbiAgICAgICAgKGN0cyA+Pj4gOCkgJiAweEZGLFxuICAgICAgICBjdHMgJiAweEZGIC8vIHNhbXBsZV9jb21wb3NpdGlvbl90aW1lX29mZnNldFxuICAgICAgXSwxMisxNippKTtcbiAgICB9XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnRydW4sIGFycmF5KTtcbiAgfVxuXG4gIHN0YXRpYyBpbml0U2VnbWVudCh0cmFja3MpIHtcbiAgICBpZiAoIU1QNC50eXBlcykge1xuICAgICAgTVA0LmluaXQoKTtcbiAgICB9XG4gICAgdmFyIG1vdmllID0gTVA0Lm1vb3YodHJhY2tzKSwgcmVzdWx0O1xuICAgIHJlc3VsdCA9IG5ldyBVaW50OEFycmF5KE1QNC5GVFlQLmJ5dGVMZW5ndGggKyBtb3ZpZS5ieXRlTGVuZ3RoKTtcbiAgICByZXN1bHQuc2V0KE1QNC5GVFlQKTtcbiAgICByZXN1bHQuc2V0KG1vdmllLCBNUDQuRlRZUC5ieXRlTGVuZ3RoKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE1QNDtcbiIsIi8qKlxuICogZk1QNCByZW11eGVyXG4qL1xuXG5cbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQgTVA0IGZyb20gJy4uL3JlbXV4L21wNC1nZW5lcmF0b3InO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5cbmNsYXNzIE1QNFJlbXV4ZXIge1xuICBjb25zdHJ1Y3RvcihvYnNlcnZlcikge1xuICAgIHRoaXMub2JzZXJ2ZXIgPSBvYnNlcnZlcjtcbiAgICB0aGlzLklTR2VuZXJhdGVkID0gZmFsc2U7XG4gICAgdGhpcy5QRVMyTVA0U0NBTEVGQUNUT1IgPSA0O1xuICAgIHRoaXMuUEVTX1RJTUVTQ0FMRSA9IDkwMDAwO1xuICAgIHRoaXMuTVA0X1RJTUVTQ0FMRSA9IHRoaXMuUEVTX1RJTUVTQ0FMRSAvIHRoaXMuUEVTMk1QNFNDQUxFRkFDVE9SO1xuICB9XG5cbiAgZ2V0IHRpbWVzY2FsZSgpIHtcbiAgICByZXR1cm4gdGhpcy5NUDRfVElNRVNDQUxFO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgfVxuXG4gIGluc2VydERpc2NvbnRpbnVpdHkoKSB7XG4gICAgdGhpcy5faW5pdFBUUyA9IHRoaXMuX2luaXREVFMgPSB0aGlzLm5leHRBYWNQdHMgPSB0aGlzLm5leHRBdmNEdHMgPSB1bmRlZmluZWQ7XG4gIH1cblxuICBzd2l0Y2hMZXZlbCgpIHtcbiAgICB0aGlzLklTR2VuZXJhdGVkID0gZmFsc2U7XG4gIH1cblxuICByZW11eChhdWRpb1RyYWNrLHZpZGVvVHJhY2ssaWQzVHJhY2ssdGV4dFRyYWNrLHRpbWVPZmZzZXQsIGNvbnRpZ3VvdXMpIHtcbiAgICAvLyBnZW5lcmF0ZSBJbml0IFNlZ21lbnQgaWYgbmVlZGVkXG4gICAgaWYgKCF0aGlzLklTR2VuZXJhdGVkKSB7XG4gICAgICB0aGlzLmdlbmVyYXRlSVMoYXVkaW9UcmFjayx2aWRlb1RyYWNrLHRpbWVPZmZzZXQpO1xuICAgIH1cbiAgICAvL2xvZ2dlci5sb2coJ25iIEFWQyBzYW1wbGVzOicgKyB2aWRlb1RyYWNrLnNhbXBsZXMubGVuZ3RoKTtcbiAgICBpZiAodmlkZW9UcmFjay5zYW1wbGVzLmxlbmd0aCkge1xuICAgICAgdGhpcy5yZW11eFZpZGVvKHZpZGVvVHJhY2ssdGltZU9mZnNldCxjb250aWd1b3VzKTtcbiAgICB9XG4gICAgLy9sb2dnZXIubG9nKCduYiBBQUMgc2FtcGxlczonICsgYXVkaW9UcmFjay5zYW1wbGVzLmxlbmd0aCk7XG4gICAgaWYgKGF1ZGlvVHJhY2suc2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgIHRoaXMucmVtdXhBdWRpbyhhdWRpb1RyYWNrLHRpbWVPZmZzZXQsY29udGlndW91cyk7XG4gICAgfVxuICAgIC8vbG9nZ2VyLmxvZygnbmIgSUQzIHNhbXBsZXM6JyArIGF1ZGlvVHJhY2suc2FtcGxlcy5sZW5ndGgpO1xuICAgIGlmIChpZDNUcmFjay5zYW1wbGVzLmxlbmd0aCkge1xuICAgICAgdGhpcy5yZW11eElEMyhpZDNUcmFjayx0aW1lT2Zmc2V0KTtcbiAgICB9XG4gICAgLy9sb2dnZXIubG9nKCduYiBJRDMgc2FtcGxlczonICsgYXVkaW9UcmFjay5zYW1wbGVzLmxlbmd0aCk7XG4gICAgaWYgKHRleHRUcmFjay5zYW1wbGVzLmxlbmd0aCkge1xuICAgICAgdGhpcy5yZW11eFRleHQodGV4dFRyYWNrLHRpbWVPZmZzZXQpO1xuICAgIH1cbiAgICAvL25vdGlmeSBlbmQgb2YgcGFyc2luZ1xuICAgIHRoaXMub2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNFRCk7XG4gIH1cblxuICBnZW5lcmF0ZUlTKGF1ZGlvVHJhY2ssdmlkZW9UcmFjayx0aW1lT2Zmc2V0KSB7XG4gICAgdmFyIG9ic2VydmVyID0gdGhpcy5vYnNlcnZlcixcbiAgICAgICAgYXVkaW9TYW1wbGVzID0gYXVkaW9UcmFjay5zYW1wbGVzLFxuICAgICAgICB2aWRlb1NhbXBsZXMgPSB2aWRlb1RyYWNrLnNhbXBsZXMsXG4gICAgICAgIG5iQXVkaW8gPSBhdWRpb1NhbXBsZXMubGVuZ3RoLFxuICAgICAgICBuYlZpZGVvID0gdmlkZW9TYW1wbGVzLmxlbmd0aCxcbiAgICAgICAgcGVzVGltZVNjYWxlID0gdGhpcy5QRVNfVElNRVNDQUxFO1xuXG4gICAgaWYobmJBdWRpbyA9PT0gMCAmJiBuYlZpZGVvID09PSAwKSB7XG4gICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZSA6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5GUkFHX1BBUlNJTkdfRVJST1IsIGZhdGFsOiBmYWxzZSwgcmVhc29uOiAnbm8gYXVkaW8vdmlkZW8gc2FtcGxlcyBmb3VuZCd9KTtcbiAgICB9IGVsc2UgaWYgKG5iVmlkZW8gPT09IDApIHtcbiAgICAgIC8vYXVkaW8gb25seVxuICAgICAgaWYgKGF1ZGlvVHJhY2suY29uZmlnKSB7XG4gICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQsIHtcbiAgICAgICAgICBhdWRpb01vb3Y6IE1QNC5pbml0U2VnbWVudChbYXVkaW9UcmFja10pLFxuICAgICAgICAgIGF1ZGlvQ29kZWMgOiBhdWRpb1RyYWNrLmNvZGVjLFxuICAgICAgICAgIGF1ZGlvQ2hhbm5lbENvdW50IDogYXVkaW9UcmFjay5jaGFubmVsQ291bnRcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuSVNHZW5lcmF0ZWQgPSB0cnVlO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMuX2luaXRQVFMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAvLyByZW1lbWJlciBmaXJzdCBQVFMgb2YgdGhpcyBkZW11eGluZyBjb250ZXh0XG4gICAgICAgIHRoaXMuX2luaXRQVFMgPSBhdWRpb1NhbXBsZXNbMF0ucHRzIC0gcGVzVGltZVNjYWxlICogdGltZU9mZnNldDtcbiAgICAgICAgdGhpcy5faW5pdERUUyA9IGF1ZGlvU2FtcGxlc1swXS5kdHMgLSBwZXNUaW1lU2NhbGUgKiB0aW1lT2Zmc2V0O1xuICAgICAgfVxuICAgIH0gZWxzZVxuICAgIGlmIChuYkF1ZGlvID09PSAwKSB7XG4gICAgICAvL3ZpZGVvIG9ubHlcbiAgICAgIGlmICh2aWRlb1RyYWNrLnNwcyAmJiB2aWRlb1RyYWNrLnBwcykge1xuICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULCB7XG4gICAgICAgICAgdmlkZW9Nb292OiBNUDQuaW5pdFNlZ21lbnQoW3ZpZGVvVHJhY2tdKSxcbiAgICAgICAgICB2aWRlb0NvZGVjOiB2aWRlb1RyYWNrLmNvZGVjLFxuICAgICAgICAgIHZpZGVvV2lkdGg6IHZpZGVvVHJhY2sud2lkdGgsXG4gICAgICAgICAgdmlkZW9IZWlnaHQ6IHZpZGVvVHJhY2suaGVpZ2h0XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLklTR2VuZXJhdGVkID0gdHJ1ZTtcbiAgICAgICAgaWYgKHRoaXMuX2luaXRQVFMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIC8vIHJlbWVtYmVyIGZpcnN0IFBUUyBvZiB0aGlzIGRlbXV4aW5nIGNvbnRleHRcbiAgICAgICAgICB0aGlzLl9pbml0UFRTID0gdmlkZW9TYW1wbGVzWzBdLnB0cyAtIHBlc1RpbWVTY2FsZSAqIHRpbWVPZmZzZXQ7XG4gICAgICAgICAgdGhpcy5faW5pdERUUyA9IHZpZGVvU2FtcGxlc1swXS5kdHMgLSBwZXNUaW1lU2NhbGUgKiB0aW1lT2Zmc2V0O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vYXVkaW8gYW5kIHZpZGVvXG4gICAgICBpZiAoYXVkaW9UcmFjay5jb25maWcgJiYgdmlkZW9UcmFjay5zcHMgJiYgdmlkZW9UcmFjay5wcHMpIHtcbiAgICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQsIHtcbiAgICAgICAgICBhdWRpb01vb3Y6IE1QNC5pbml0U2VnbWVudChbYXVkaW9UcmFja10pLFxuICAgICAgICAgIGF1ZGlvQ29kZWM6IGF1ZGlvVHJhY2suY29kZWMsXG4gICAgICAgICAgYXVkaW9DaGFubmVsQ291bnQ6IGF1ZGlvVHJhY2suY2hhbm5lbENvdW50LFxuICAgICAgICAgIHZpZGVvTW9vdjogTVA0LmluaXRTZWdtZW50KFt2aWRlb1RyYWNrXSksXG4gICAgICAgICAgdmlkZW9Db2RlYzogdmlkZW9UcmFjay5jb2RlYyxcbiAgICAgICAgICB2aWRlb1dpZHRoOiB2aWRlb1RyYWNrLndpZHRoLFxuICAgICAgICAgIHZpZGVvSGVpZ2h0OiB2aWRlb1RyYWNrLmhlaWdodFxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5JU0dlbmVyYXRlZCA9IHRydWU7XG4gICAgICAgIGlmICh0aGlzLl9pbml0UFRTID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAvLyByZW1lbWJlciBmaXJzdCBQVFMgb2YgdGhpcyBkZW11eGluZyBjb250ZXh0XG4gICAgICAgICAgdGhpcy5faW5pdFBUUyA9IE1hdGgubWluKHZpZGVvU2FtcGxlc1swXS5wdHMsIGF1ZGlvU2FtcGxlc1swXS5wdHMpIC0gcGVzVGltZVNjYWxlICogdGltZU9mZnNldDtcbiAgICAgICAgICB0aGlzLl9pbml0RFRTID0gTWF0aC5taW4odmlkZW9TYW1wbGVzWzBdLmR0cywgYXVkaW9TYW1wbGVzWzBdLmR0cykgLSBwZXNUaW1lU2NhbGUgKiB0aW1lT2Zmc2V0O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmVtdXhWaWRlbyh0cmFjaywgdGltZU9mZnNldCwgY29udGlndW91cykge1xuICAgIHZhciB2aWV3LFxuICAgICAgICBvZmZzZXQgPSA4LFxuICAgICAgICBwZXNUaW1lU2NhbGUgPSB0aGlzLlBFU19USU1FU0NBTEUsXG4gICAgICAgIHBlczJtcDRTY2FsZUZhY3RvciA9IHRoaXMuUEVTMk1QNFNDQUxFRkFDVE9SLFxuICAgICAgICBhdmNTYW1wbGUsXG4gICAgICAgIG1wNFNhbXBsZSxcbiAgICAgICAgbXA0U2FtcGxlTGVuZ3RoLFxuICAgICAgICB1bml0LFxuICAgICAgICBtZGF0LCBtb29mLFxuICAgICAgICBmaXJzdFBUUywgZmlyc3REVFMsIGxhc3REVFMsXG4gICAgICAgIHB0cywgZHRzLCBwdHNub3JtLCBkdHNub3JtLFxuICAgICAgICBzYW1wbGVzID0gW107XG4gICAgLyogY29uY2F0ZW5hdGUgdGhlIHZpZGVvIGRhdGEgYW5kIGNvbnN0cnVjdCB0aGUgbWRhdCBpbiBwbGFjZVxuICAgICAgKG5lZWQgOCBtb3JlIGJ5dGVzIHRvIGZpbGwgbGVuZ3RoIGFuZCBtcGRhdCB0eXBlKSAqL1xuICAgIG1kYXQgPSBuZXcgVWludDhBcnJheSh0cmFjay5sZW4gKyAoNCAqIHRyYWNrLm5iTmFsdSkgKyA4KTtcbiAgICB2aWV3ID0gbmV3IERhdGFWaWV3KG1kYXQuYnVmZmVyKTtcbiAgICB2aWV3LnNldFVpbnQzMigwLCBtZGF0LmJ5dGVMZW5ndGgpO1xuICAgIG1kYXQuc2V0KE1QNC50eXBlcy5tZGF0LCA0KTtcbiAgICB3aGlsZSAodHJhY2suc2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgIGF2Y1NhbXBsZSA9IHRyYWNrLnNhbXBsZXMuc2hpZnQoKTtcbiAgICAgIG1wNFNhbXBsZUxlbmd0aCA9IDA7XG4gICAgICAvLyBjb252ZXJ0IE5BTFUgYml0c3RyZWFtIHRvIE1QNCBmb3JtYXQgKHByZXBlbmQgTkFMVSB3aXRoIHNpemUgZmllbGQpXG4gICAgICB3aGlsZSAoYXZjU2FtcGxlLnVuaXRzLnVuaXRzLmxlbmd0aCkge1xuICAgICAgICB1bml0ID0gYXZjU2FtcGxlLnVuaXRzLnVuaXRzLnNoaWZ0KCk7XG4gICAgICAgIHZpZXcuc2V0VWludDMyKG9mZnNldCwgdW5pdC5kYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgICBvZmZzZXQgKz0gNDtcbiAgICAgICAgbWRhdC5zZXQodW5pdC5kYXRhLCBvZmZzZXQpO1xuICAgICAgICBvZmZzZXQgKz0gdW5pdC5kYXRhLmJ5dGVMZW5ndGg7XG4gICAgICAgIG1wNFNhbXBsZUxlbmd0aCArPSA0ICsgdW5pdC5kYXRhLmJ5dGVMZW5ndGg7XG4gICAgICB9XG4gICAgICBwdHMgPSBhdmNTYW1wbGUucHRzIC0gdGhpcy5faW5pdERUUztcbiAgICAgIGR0cyA9IGF2Y1NhbXBsZS5kdHMgLSB0aGlzLl9pbml0RFRTO1xuICAgICAgLy8gZW5zdXJlIERUUyBpcyBub3QgYmlnZ2VyIHRoYW4gUFRTXG4gICAgICBkdHMgPSBNYXRoLm1pbihwdHMsZHRzKTtcbiAgICAgIC8vbG9nZ2VyLmxvZyhgVmlkZW8vUFRTL0RUUzoke3B0c30vJHtkdHN9YCk7XG4gICAgICAvLyBpZiBub3QgZmlyc3QgQVZDIHNhbXBsZSBvZiB2aWRlbyB0cmFjaywgbm9ybWFsaXplIFBUUy9EVFMgd2l0aCBwcmV2aW91cyBzYW1wbGUgdmFsdWVcbiAgICAgIC8vIGFuZCBlbnN1cmUgdGhhdCBzYW1wbGUgZHVyYXRpb24gaXMgcG9zaXRpdmVcbiAgICAgIGlmIChsYXN0RFRTICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShwdHMsIGxhc3REVFMpO1xuICAgICAgICBkdHNub3JtID0gdGhpcy5fUFRTTm9ybWFsaXplKGR0cywgbGFzdERUUyk7XG4gICAgICAgIHZhciBzYW1wbGVEdXJhdGlvbiA9IChkdHNub3JtIC0gbGFzdERUUykgLyBwZXMybXA0U2NhbGVGYWN0b3I7XG4gICAgICAgIGlmIChzYW1wbGVEdXJhdGlvbiA8PSAwKSB7XG4gICAgICAgICAgbG9nZ2VyLmxvZyhgaW52YWxpZCBzYW1wbGUgZHVyYXRpb24gYXQgUFRTL0RUUzogJHthdmNTYW1wbGUucHRzfS8ke2F2Y1NhbXBsZS5kdHN9OiR7c2FtcGxlRHVyYXRpb259YCk7XG4gICAgICAgICAgc2FtcGxlRHVyYXRpb24gPSAxO1xuICAgICAgICB9XG4gICAgICAgIG1wNFNhbXBsZS5kdXJhdGlvbiA9IHNhbXBsZUR1cmF0aW9uO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIG5leHRBdmNEdHMgPSB0aGlzLm5leHRBdmNEdHMsZGVsdGE7XG4gICAgICAgIC8vIGZpcnN0IEFWQyBzYW1wbGUgb2YgdmlkZW8gdHJhY2ssIG5vcm1hbGl6ZSBQVFMvRFRTXG4gICAgICAgIHB0c25vcm0gPSB0aGlzLl9QVFNOb3JtYWxpemUocHRzLCBuZXh0QXZjRHRzKTtcbiAgICAgICAgZHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShkdHMsIG5leHRBdmNEdHMpO1xuICAgICAgICBkZWx0YSA9IE1hdGgucm91bmQoKGR0c25vcm0gLSBuZXh0QXZjRHRzKSAvIDkwKTtcbiAgICAgICAgLy8gaWYgZnJhZ21lbnQgYXJlIGNvbnRpZ3VvdXMsIG9yIGRlbHRhIGxlc3MgdGhhbiA2MDBtcywgZW5zdXJlIHRoZXJlIGlzIG5vIG92ZXJsYXAvaG9sZSBiZXR3ZWVuIGZyYWdtZW50c1xuICAgICAgICBpZiAoY29udGlndW91cyB8fCBNYXRoLmFicyhkZWx0YSkgPCA2MDApIHtcbiAgICAgICAgICBpZiAoZGVsdGEpIHtcbiAgICAgICAgICAgIGlmIChkZWx0YSA+IDEpIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgQVZDOiR7ZGVsdGF9IG1zIGhvbGUgYmV0d2VlbiBmcmFnbWVudHMgZGV0ZWN0ZWQsZmlsbGluZyBpdGApO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkZWx0YSA8IC0xKSB7XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coYEFWQzokeygtZGVsdGEpfSBtcyBvdmVybGFwcGluZyBiZXR3ZWVuIGZyYWdtZW50cyBkZXRlY3RlZGApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gc2V0IERUUyB0byBuZXh0IERUU1xuICAgICAgICAgICAgZHRzbm9ybSA9IG5leHRBdmNEdHM7XG4gICAgICAgICAgICAvLyBvZmZzZXQgUFRTIGFzIHdlbGwsIGVuc3VyZSB0aGF0IFBUUyBpcyBzbWFsbGVyIG9yIGVxdWFsIHRoYW4gbmV3IERUU1xuICAgICAgICAgICAgcHRzbm9ybSA9IE1hdGgubWF4KHB0c25vcm0gLSBkZWx0YSwgZHRzbm9ybSk7XG4gICAgICAgICAgICBsb2dnZXIubG9nKGBWaWRlby9QVFMvRFRTIGFkanVzdGVkOiAke3B0c25vcm19LyR7ZHRzbm9ybX0sZGVsdGE6JHtkZWx0YX1gKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gcmVtZW1iZXIgZmlyc3QgUFRTIG9mIG91ciBhdmNTYW1wbGVzLCBlbnN1cmUgdmFsdWUgaXMgcG9zaXRpdmVcbiAgICAgICAgZmlyc3RQVFMgPSBNYXRoLm1heCgwLCBwdHNub3JtKTtcbiAgICAgICAgZmlyc3REVFMgPSBNYXRoLm1heCgwLCBkdHNub3JtKTtcbiAgICAgIH1cbiAgICAgIC8vY29uc29sZS5sb2coJ1BUUy9EVFMvaW5pdERUUy9ub3JtUFRTL25vcm1EVFMvcmVsYXRpdmUgUFRTIDogJHthdmNTYW1wbGUucHRzfS8ke2F2Y1NhbXBsZS5kdHN9LyR7dGhpcy5faW5pdERUU30vJHtwdHNub3JtfS8ke2R0c25vcm19LyR7KGF2Y1NhbXBsZS5wdHMvNDI5NDk2NzI5NikudG9GaXhlZCgzKX0nKTtcbiAgICAgIG1wNFNhbXBsZSA9IHtcbiAgICAgICAgc2l6ZTogbXA0U2FtcGxlTGVuZ3RoLFxuICAgICAgICBkdXJhdGlvbjogMCxcbiAgICAgICAgY3RzOiAocHRzbm9ybSAtIGR0c25vcm0pIC8gcGVzMm1wNFNjYWxlRmFjdG9yLFxuICAgICAgICBmbGFnczoge1xuICAgICAgICAgIGlzTGVhZGluZzogMCxcbiAgICAgICAgICBpc0RlcGVuZGVkT246IDAsXG4gICAgICAgICAgaGFzUmVkdW5kYW5jeTogMCxcbiAgICAgICAgICBkZWdyYWRQcmlvOiAwXG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICBpZiAoYXZjU2FtcGxlLmtleSA9PT0gdHJ1ZSkge1xuICAgICAgICAvLyB0aGUgY3VycmVudCBzYW1wbGUgaXMgYSBrZXkgZnJhbWVcbiAgICAgICAgbXA0U2FtcGxlLmZsYWdzLmRlcGVuZHNPbiA9IDI7XG4gICAgICAgIG1wNFNhbXBsZS5mbGFncy5pc05vblN5bmMgPSAwO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbXA0U2FtcGxlLmZsYWdzLmRlcGVuZHNPbiA9IDE7XG4gICAgICAgIG1wNFNhbXBsZS5mbGFncy5pc05vblN5bmMgPSAxO1xuICAgICAgfVxuICAgICAgc2FtcGxlcy5wdXNoKG1wNFNhbXBsZSk7XG4gICAgICBsYXN0RFRTID0gZHRzbm9ybTtcbiAgICB9XG4gICAgaWYgKHNhbXBsZXMubGVuZ3RoID49IDIpIHtcbiAgICAgIG1wNFNhbXBsZS5kdXJhdGlvbiA9IHNhbXBsZXNbc2FtcGxlcy5sZW5ndGggLSAyXS5kdXJhdGlvbjtcbiAgICB9XG4gICAgLy8gbmV4dCBBVkMgc2FtcGxlIERUUyBzaG91bGQgYmUgZXF1YWwgdG8gbGFzdCBzYW1wbGUgRFRTICsgbGFzdCBzYW1wbGUgZHVyYXRpb25cbiAgICB0aGlzLm5leHRBdmNEdHMgPSBkdHNub3JtICsgbXA0U2FtcGxlLmR1cmF0aW9uICogcGVzMm1wNFNjYWxlRmFjdG9yO1xuICAgIHRyYWNrLmxlbiA9IDA7XG4gICAgdHJhY2submJOYWx1ID0gMDtcbiAgICBpZihuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkuaW5kZXhPZignY2hyb21lJykgPiAtMSkge1xuICAgIC8vIGNocm9tZSB3b3JrYXJvdW5kLCBtYXJrIGZpcnN0IHNhbXBsZSBhcyBiZWluZyBhIFJhbmRvbSBBY2Nlc3MgUG9pbnQgdG8gYXZvaWQgc291cmNlYnVmZmVyIGFwcGVuZCBpc3N1ZVxuICAgIC8vIGh0dHBzOi8vY29kZS5nb29nbGUuY29tL3AvY2hyb21pdW0vaXNzdWVzL2RldGFpbD9pZD0yMjk0MTJcbiAgICAgIHNhbXBsZXNbMF0uZmxhZ3MuZGVwZW5kc09uID0gMjtcbiAgICAgIHNhbXBsZXNbMF0uZmxhZ3MuaXNOb25TeW5jID0gMDtcbiAgICB9XG4gICAgdHJhY2suc2FtcGxlcyA9IHNhbXBsZXM7XG4gICAgbW9vZiA9IE1QNC5tb29mKHRyYWNrLnNlcXVlbmNlTnVtYmVyKyssIGZpcnN0RFRTIC8gcGVzMm1wNFNjYWxlRmFjdG9yLCB0cmFjayk7XG4gICAgdHJhY2suc2FtcGxlcyA9IFtdO1xuICAgIHRoaXMub2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfREFUQSwge1xuICAgICAgbW9vZjogbW9vZixcbiAgICAgIG1kYXQ6IG1kYXQsXG4gICAgICBzdGFydFBUUzogZmlyc3RQVFMgLyBwZXNUaW1lU2NhbGUsXG4gICAgICBlbmRQVFM6IChwdHNub3JtICsgcGVzMm1wNFNjYWxlRmFjdG9yICogbXA0U2FtcGxlLmR1cmF0aW9uKSAvIHBlc1RpbWVTY2FsZSxcbiAgICAgIHN0YXJ0RFRTOiBmaXJzdERUUyAvIHBlc1RpbWVTY2FsZSxcbiAgICAgIGVuZERUUzogKGR0c25vcm0gKyBwZXMybXA0U2NhbGVGYWN0b3IgKiBtcDRTYW1wbGUuZHVyYXRpb24pIC8gcGVzVGltZVNjYWxlLFxuICAgICAgdHlwZTogJ3ZpZGVvJyxcbiAgICAgIG5iOiBzYW1wbGVzLmxlbmd0aFxuICAgIH0pO1xuICB9XG5cbiAgcmVtdXhBdWRpbyh0cmFjayx0aW1lT2Zmc2V0LCBjb250aWd1b3VzKSB7XG4gICAgdmFyIHZpZXcsXG4gICAgICAgIG9mZnNldCA9IDgsXG4gICAgICAgIHBlc1RpbWVTY2FsZSA9IHRoaXMuUEVTX1RJTUVTQ0FMRSxcbiAgICAgICAgcGVzMm1wNFNjYWxlRmFjdG9yID0gdGhpcy5QRVMyTVA0U0NBTEVGQUNUT1IsXG4gICAgICAgIGFhY1NhbXBsZSwgbXA0U2FtcGxlLFxuICAgICAgICB1bml0LFxuICAgICAgICBtZGF0LCBtb29mLFxuICAgICAgICBmaXJzdFBUUywgZmlyc3REVFMsIGxhc3REVFMsXG4gICAgICAgIHB0cywgZHRzLCBwdHNub3JtLCBkdHNub3JtLFxuICAgICAgICBzYW1wbGVzID0gW107XG5cbiAgICB3aGlsZSAodHJhY2suc2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgIGFhY1NhbXBsZSA9IHRyYWNrLnNhbXBsZXMuc2hpZnQoKTtcbiAgICAgIHVuaXQgPSBhYWNTYW1wbGUudW5pdDtcbiAgICAgIHB0cyA9IGFhY1NhbXBsZS5wdHMgLSB0aGlzLl9pbml0RFRTO1xuICAgICAgZHRzID0gYWFjU2FtcGxlLmR0cyAtIHRoaXMuX2luaXREVFM7XG4gICAgICAvL2xvZ2dlci5sb2coJ0F1ZGlvL1BUUzonICsgYWFjU2FtcGxlLnB0cy50b0ZpeGVkKDApKTtcbiAgICAgIC8vIGlmIG5vdCBmaXJzdCBzYW1wbGVcbiAgICAgIGlmIChsYXN0RFRTICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShwdHMsIGxhc3REVFMpO1xuICAgICAgICBkdHNub3JtID0gdGhpcy5fUFRTTm9ybWFsaXplKGR0cywgbGFzdERUUyk7XG4gICAgICAgIC8vIGxldCdzIGNvbXB1dGUgc2FtcGxlIGR1cmF0aW9uXG4gICAgICAgIG1wNFNhbXBsZS5kdXJhdGlvbiA9IChkdHNub3JtIC0gbGFzdERUUykgLyBwZXMybXA0U2NhbGVGYWN0b3I7XG4gICAgICAgIGlmIChtcDRTYW1wbGUuZHVyYXRpb24gPCAwKSB7XG4gICAgICAgICAgLy8gbm90IGV4cGVjdGVkIHRvIGhhcHBlbiAuLi5cbiAgICAgICAgICBsb2dnZXIubG9nKGBpbnZhbGlkIEFBQyBzYW1wbGUgZHVyYXRpb24gYXQgUFRTOiR7YWFjU2FtcGxlLnB0c306JHttcDRTYW1wbGUuZHVyYXRpb259YCk7XG4gICAgICAgICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIG5leHRBYWNQdHMgPSB0aGlzLm5leHRBYWNQdHMsZGVsdGE7XG4gICAgICAgIHB0c25vcm0gPSB0aGlzLl9QVFNOb3JtYWxpemUocHRzLCBuZXh0QWFjUHRzKTtcbiAgICAgICAgZHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShkdHMsIG5leHRBYWNQdHMpO1xuICAgICAgICBkZWx0YSA9IE1hdGgucm91bmQoMTAwMCAqIChwdHNub3JtIC0gbmV4dEFhY1B0cykgLyBwZXNUaW1lU2NhbGUpO1xuICAgICAgICAvLyBpZiBmcmFnbWVudCBhcmUgY29udGlndW91cywgb3IgZGVsdGEgbGVzcyB0aGFuIDYwMG1zLCBlbnN1cmUgdGhlcmUgaXMgbm8gb3ZlcmxhcC9ob2xlIGJldHdlZW4gZnJhZ21lbnRzXG4gICAgICAgIGlmIChjb250aWd1b3VzIHx8IE1hdGguYWJzKGRlbHRhKSA8IDYwMCkge1xuICAgICAgICAgIC8vIGxvZyBkZWx0YVxuICAgICAgICAgIGlmIChkZWx0YSkge1xuICAgICAgICAgICAgaWYgKGRlbHRhID4gMCkge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGAke2RlbHRhfSBtcyBob2xlIGJldHdlZW4gQUFDIHNhbXBsZXMgZGV0ZWN0ZWQsZmlsbGluZyBpdGApO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkZWx0YSA8IDApIHtcbiAgICAgICAgICAgICAgLy8gZHJvcCBvdmVybGFwcGluZyBhdWRpbyBmcmFtZXMuLi4gYnJvd3NlciB3aWxsIGRlYWwgd2l0aCBpdFxuICAgICAgICAgICAgICBsb2dnZXIubG9nKGAkeygtZGVsdGEpfSBtcyBvdmVybGFwcGluZyBiZXR3ZWVuIEFBQyBzYW1wbGVzIGRldGVjdGVkLCBkcm9wIGZyYW1lYCk7XG4gICAgICAgICAgICAgIHRyYWNrLmxlbiAtPSB1bml0LmJ5dGVMZW5ndGg7XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gc2V0IERUUyB0byBuZXh0IERUU1xuICAgICAgICAgICAgcHRzbm9ybSA9IGR0c25vcm0gPSBuZXh0QWFjUHRzO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyByZW1lbWJlciBmaXJzdCBQVFMgb2Ygb3VyIGFhY1NhbXBsZXMsIGVuc3VyZSB2YWx1ZSBpcyBwb3NpdGl2ZVxuICAgICAgICBmaXJzdFBUUyA9IE1hdGgubWF4KDAsIHB0c25vcm0pO1xuICAgICAgICBmaXJzdERUUyA9IE1hdGgubWF4KDAsIGR0c25vcm0pO1xuICAgICAgICAvKiBjb25jYXRlbmF0ZSB0aGUgYXVkaW8gZGF0YSBhbmQgY29uc3RydWN0IHRoZSBtZGF0IGluIHBsYWNlXG4gICAgICAgICAgKG5lZWQgOCBtb3JlIGJ5dGVzIHRvIGZpbGwgbGVuZ3RoIGFuZCBtZGF0IHR5cGUpICovXG4gICAgICAgIG1kYXQgPSBuZXcgVWludDhBcnJheSh0cmFjay5sZW4gKyA4KTtcbiAgICAgICAgdmlldyA9IG5ldyBEYXRhVmlldyhtZGF0LmJ1ZmZlcik7XG4gICAgICAgIHZpZXcuc2V0VWludDMyKDAsIG1kYXQuYnl0ZUxlbmd0aCk7XG4gICAgICAgIG1kYXQuc2V0KE1QNC50eXBlcy5tZGF0LCA0KTtcbiAgICAgIH1cbiAgICAgIG1kYXQuc2V0KHVuaXQsIG9mZnNldCk7XG4gICAgICBvZmZzZXQgKz0gdW5pdC5ieXRlTGVuZ3RoO1xuICAgICAgLy9jb25zb2xlLmxvZygnUFRTL0RUUy9pbml0RFRTL25vcm1QVFMvbm9ybURUUy9yZWxhdGl2ZSBQVFMgOiAke2FhY1NhbXBsZS5wdHN9LyR7YWFjU2FtcGxlLmR0c30vJHt0aGlzLl9pbml0RFRTfS8ke3B0c25vcm19LyR7ZHRzbm9ybX0vJHsoYWFjU2FtcGxlLnB0cy80Mjk0OTY3Mjk2KS50b0ZpeGVkKDMpfScpO1xuICAgICAgbXA0U2FtcGxlID0ge1xuICAgICAgICBzaXplOiB1bml0LmJ5dGVMZW5ndGgsXG4gICAgICAgIGN0czogMCxcbiAgICAgICAgZHVyYXRpb246MCxcbiAgICAgICAgZmxhZ3M6IHtcbiAgICAgICAgICBpc0xlYWRpbmc6IDAsXG4gICAgICAgICAgaXNEZXBlbmRlZE9uOiAwLFxuICAgICAgICAgIGhhc1JlZHVuZGFuY3k6IDAsXG4gICAgICAgICAgZGVncmFkUHJpbzogMCxcbiAgICAgICAgICBkZXBlbmRzT246IDEsXG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICBzYW1wbGVzLnB1c2gobXA0U2FtcGxlKTtcbiAgICAgIGxhc3REVFMgPSBkdHNub3JtO1xuICAgIH1cbiAgICAvL3NldCBsYXN0IHNhbXBsZSBkdXJhdGlvbiBhcyBiZWluZyBpZGVudGljYWwgdG8gcHJldmlvdXMgc2FtcGxlXG4gICAgaWYgKHNhbXBsZXMubGVuZ3RoID49IDIpIHtcbiAgICAgIG1wNFNhbXBsZS5kdXJhdGlvbiA9IHNhbXBsZXNbc2FtcGxlcy5sZW5ndGggLSAyXS5kdXJhdGlvbjtcbiAgICB9XG4gICAgLy8gbmV4dCBhYWMgc2FtcGxlIFBUUyBzaG91bGQgYmUgZXF1YWwgdG8gbGFzdCBzYW1wbGUgUFRTICsgZHVyYXRpb25cbiAgICB0aGlzLm5leHRBYWNQdHMgPSBwdHNub3JtICsgcGVzMm1wNFNjYWxlRmFjdG9yICogbXA0U2FtcGxlLmR1cmF0aW9uO1xuICAgIC8vbG9nZ2VyLmxvZygnQXVkaW8vUFRTL1BUU2VuZDonICsgYWFjU2FtcGxlLnB0cy50b0ZpeGVkKDApICsgJy8nICsgdGhpcy5uZXh0QWFjRHRzLnRvRml4ZWQoMCkpO1xuICAgIHRyYWNrLmxlbiA9IDA7XG4gICAgdHJhY2suc2FtcGxlcyA9IHNhbXBsZXM7XG4gICAgbW9vZiA9IE1QNC5tb29mKHRyYWNrLnNlcXVlbmNlTnVtYmVyKyssIGZpcnN0RFRTIC8gcGVzMm1wNFNjYWxlRmFjdG9yLCB0cmFjayk7XG4gICAgdHJhY2suc2FtcGxlcyA9IFtdO1xuICAgIHRoaXMub2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfREFUQSwge1xuICAgICAgbW9vZjogbW9vZixcbiAgICAgIG1kYXQ6IG1kYXQsXG4gICAgICBzdGFydFBUUzogZmlyc3RQVFMgLyBwZXNUaW1lU2NhbGUsXG4gICAgICBlbmRQVFM6IHRoaXMubmV4dEFhY1B0cyAvIHBlc1RpbWVTY2FsZSxcbiAgICAgIHN0YXJ0RFRTOiBmaXJzdERUUyAvIHBlc1RpbWVTY2FsZSxcbiAgICAgIGVuZERUUzogKGR0c25vcm0gKyBwZXMybXA0U2NhbGVGYWN0b3IgKiBtcDRTYW1wbGUuZHVyYXRpb24pIC8gcGVzVGltZVNjYWxlLFxuICAgICAgdHlwZTogJ2F1ZGlvJyxcbiAgICAgIG5iOiBzYW1wbGVzLmxlbmd0aFxuICAgIH0pO1xuICB9XG5cbiAgcmVtdXhJRDModHJhY2ssdGltZU9mZnNldCkge1xuICAgIHZhciBsZW5ndGggPSB0cmFjay5zYW1wbGVzLmxlbmd0aCwgc2FtcGxlO1xuICAgIC8vIGNvbnN1bWUgc2FtcGxlc1xuICAgIGlmKGxlbmd0aCkge1xuICAgICAgZm9yKHZhciBpbmRleCA9IDA7IGluZGV4IDwgbGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgIHNhbXBsZSA9IHRyYWNrLnNhbXBsZXNbaW5kZXhdO1xuICAgICAgICAvLyBzZXR0aW5nIGlkMyBwdHMsIGR0cyB0byByZWxhdGl2ZSB0aW1lXG4gICAgICAgIC8vIHVzaW5nIHRoaXMuX2luaXRQVFMgYW5kIHRoaXMuX2luaXREVFMgdG8gY2FsY3VsYXRlIHJlbGF0aXZlIHRpbWVcbiAgICAgICAgc2FtcGxlLnB0cyA9ICgoc2FtcGxlLnB0cyAtIHRoaXMuX2luaXRQVFMpIC8gdGhpcy5QRVNfVElNRVNDQUxFKTtcbiAgICAgICAgc2FtcGxlLmR0cyA9ICgoc2FtcGxlLmR0cyAtIHRoaXMuX2luaXREVFMpIC8gdGhpcy5QRVNfVElNRVNDQUxFKTtcbiAgICAgIH1cbiAgICAgIHRoaXMub2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfTUVUQURBVEEsIHtcbiAgICAgICAgc2FtcGxlczp0cmFjay5zYW1wbGVzXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICB0cmFjay5zYW1wbGVzID0gW107XG4gICAgdGltZU9mZnNldCA9IHRpbWVPZmZzZXQ7XG4gIH1cblxuICByZW11eFRleHQodHJhY2ssdGltZU9mZnNldCkge1xuICAgIHRyYWNrLnNhbXBsZXMuc29ydChmdW5jdGlvbihhLCBiKSB7XG4gICAgICBpZiAoYS5wdHMgPCBiLnB0cylcbiAgICAgIHtcbiAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgfVxuICAgICAgZWxzZSBpZiAoYS5wdHMgPiBiLnB0cylcbiAgICAgIHtcbiAgICAgICAgcmV0dXJuIDE7XG4gICAgICB9XG4gICAgICBlbHNlXG4gICAgICB7XG4gICAgICAgIHJldHVybiAwO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdmFyIGxlbmd0aCA9IHRyYWNrLnNhbXBsZXMubGVuZ3RoLCBzYW1wbGU7XG4gICAgLy8gY29uc3VtZSBzYW1wbGVzXG4gICAgaWYobGVuZ3RoKSB7XG4gICAgICBmb3IodmFyIGluZGV4ID0gMDsgaW5kZXggPCBsZW5ndGg7IGluZGV4KyspIHtcbiAgICAgICAgc2FtcGxlID0gdHJhY2suc2FtcGxlc1tpbmRleF07XG4gICAgICAgIC8vIHNldHRpbmcgdGV4dCBwdHMsIGR0cyB0byByZWxhdGl2ZSB0aW1lXG4gICAgICAgIC8vIHVzaW5nIHRoaXMuX2luaXRQVFMgYW5kIHRoaXMuX2luaXREVFMgdG8gY2FsY3VsYXRlIHJlbGF0aXZlIHRpbWVcbiAgICAgICAgc2FtcGxlLnB0cyA9ICgoc2FtcGxlLnB0cyAtIHRoaXMuX2luaXRQVFMpIC8gdGhpcy5QRVNfVElNRVNDQUxFKTtcbiAgICAgIH1cbiAgICAgIHRoaXMub2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfVVNFUkRBVEEsIHtcbiAgICAgICAgc2FtcGxlczp0cmFjay5zYW1wbGVzXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICB0cmFjay5zYW1wbGVzID0gW107XG4gICAgdGltZU9mZnNldCA9IHRpbWVPZmZzZXQ7XG4gIH1cbiAgXG4gIF9QVFNOb3JtYWxpemUodmFsdWUsIHJlZmVyZW5jZSkge1xuICAgIHZhciBvZmZzZXQ7XG4gICAgaWYgKHJlZmVyZW5jZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuICAgIGlmIChyZWZlcmVuY2UgPCB2YWx1ZSkge1xuICAgICAgLy8gLSAyXjMzXG4gICAgICBvZmZzZXQgPSAtODU4OTkzNDU5MjtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gKyAyXjMzXG4gICAgICBvZmZzZXQgPSA4NTg5OTM0NTkyO1xuICAgIH1cbiAgICAvKiBQVFMgaXMgMzNiaXQgKGZyb20gMCB0byAyXjMzIC0xKVxuICAgICAgaWYgZGlmZiBiZXR3ZWVuIHZhbHVlIGFuZCByZWZlcmVuY2UgaXMgYmlnZ2VyIHRoYW4gaGFsZiBvZiB0aGUgYW1wbGl0dWRlICgyXjMyKSB0aGVuIGl0IG1lYW5zIHRoYXRcbiAgICAgIFBUUyBsb29waW5nIG9jY3VyZWQuIGZpbGwgdGhlIGdhcCAqL1xuICAgIHdoaWxlIChNYXRoLmFicyh2YWx1ZSAtIHJlZmVyZW5jZSkgPiA0Mjk0OTY3Mjk2KSB7XG4gICAgICAgIHZhbHVlICs9IG9mZnNldDtcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgTVA0UmVtdXhlcjtcbiIsIlxuLy8gYWRhcHRlZCBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS9rYW5vbmdpbC9ub2RlLW0zdThwYXJzZS9ibG9iL21hc3Rlci9hdHRybGlzdC5qc1xuY2xhc3MgQXR0ckxpc3Qge1xuXG4gIGNvbnN0cnVjdG9yKGF0dHJzKSB7XG4gICAgaWYgKHR5cGVvZiBhdHRycyA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGF0dHJzID0gQXR0ckxpc3QucGFyc2VBdHRyTGlzdChhdHRycyk7XG4gICAgfVxuICAgIGZvcih2YXIgYXR0ciBpbiBhdHRycyl7XG4gICAgICBpZihhdHRycy5oYXNPd25Qcm9wZXJ0eShhdHRyKSkge1xuICAgICAgICB0aGlzW2F0dHJdID0gYXR0cnNbYXR0cl07XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZGVjaW1hbEludGVnZXIoYXR0ck5hbWUpIHtcbiAgICBjb25zdCBpbnRWYWx1ZSA9IHBhcnNlSW50KHRoaXNbYXR0ck5hbWVdLCAxMCk7XG4gICAgaWYgKGludFZhbHVlID4gTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIpIHtcbiAgICAgIHJldHVybiBJbmZpbml0eTtcbiAgICB9XG4gICAgcmV0dXJuIGludFZhbHVlO1xuICB9XG5cbiAgaGV4YWRlY2ltYWxJbnRlZ2VyKGF0dHJOYW1lKSB7XG4gICAgaWYodGhpc1thdHRyTmFtZV0pIHtcbiAgICAgIGxldCBzdHJpbmdWYWx1ZSA9ICh0aGlzW2F0dHJOYW1lXSB8fCAnMHgnKS5zbGljZSgyKTtcbiAgICAgIHN0cmluZ1ZhbHVlID0gKChzdHJpbmdWYWx1ZS5sZW5ndGggJiAxKSA/ICcwJyA6ICcnKSArIHN0cmluZ1ZhbHVlO1xuXG4gICAgICBjb25zdCB2YWx1ZSA9IG5ldyBVaW50OEFycmF5KHN0cmluZ1ZhbHVlLmxlbmd0aCAvIDIpO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdHJpbmdWYWx1ZS5sZW5ndGggLyAyOyBpKyspIHtcbiAgICAgICAgdmFsdWVbaV0gPSBwYXJzZUludChzdHJpbmdWYWx1ZS5zbGljZShpICogMiwgaSAqIDIgKyAyKSwgMTYpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBoZXhhZGVjaW1hbEludGVnZXJBc051bWJlcihhdHRyTmFtZSkge1xuICAgIGNvbnN0IGludFZhbHVlID0gcGFyc2VJbnQodGhpc1thdHRyTmFtZV0sIDE2KTtcbiAgICBpZiAoaW50VmFsdWUgPiBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUikge1xuICAgICAgcmV0dXJuIEluZmluaXR5O1xuICAgIH1cbiAgICByZXR1cm4gaW50VmFsdWU7XG4gIH1cblxuICBkZWNpbWFsRmxvYXRpbmdQb2ludChhdHRyTmFtZSkge1xuICAgIHJldHVybiBwYXJzZUZsb2F0KHRoaXNbYXR0ck5hbWVdKTtcbiAgfVxuXG4gIGVudW1lcmF0ZWRTdHJpbmcoYXR0ck5hbWUpIHtcbiAgICByZXR1cm4gdGhpc1thdHRyTmFtZV07XG4gIH1cblxuICBkZWNpbWFsUmVzb2x1dGlvbihhdHRyTmFtZSkge1xuICAgIGNvbnN0IHJlcyA9IC9eKFxcZCspeChcXGQrKSQvLmV4ZWModGhpc1thdHRyTmFtZV0pO1xuICAgIGlmIChyZXMgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICB3aWR0aDogcGFyc2VJbnQocmVzWzFdLCAxMCksXG4gICAgICBoZWlnaHQ6IHBhcnNlSW50KHJlc1syXSwgMTApXG4gICAgfTtcbiAgfVxuXG4gIHN0YXRpYyBwYXJzZUF0dHJMaXN0KGlucHV0KSB7XG4gICAgY29uc3QgcmUgPSAvKC4rPyk9KCg/OlxcXCIuKj9cXFwiKXwuKj8pKD86LHwkKS9nO1xuICAgIHZhciBtYXRjaCwgYXR0cnMgPSB7fTtcbiAgICB3aGlsZSAoKG1hdGNoID0gcmUuZXhlYyhpbnB1dCkpICE9PSBudWxsKSB7XG4gICAgICB2YXIgdmFsdWUgPSBtYXRjaFsyXSwgcXVvdGUgPSAnXCInO1xuXG4gICAgICBpZiAodmFsdWUuaW5kZXhPZihxdW90ZSkgPT09IDAgJiZcbiAgICAgICAgICB2YWx1ZS5sYXN0SW5kZXhPZihxdW90ZSkgPT09ICh2YWx1ZS5sZW5ndGgtMSkpIHtcbiAgICAgICAgdmFsdWUgPSB2YWx1ZS5zbGljZSgxLCAtMSk7XG4gICAgICB9XG4gICAgICBhdHRyc1ttYXRjaFsxXV0gPSB2YWx1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGF0dHJzO1xuICB9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgQXR0ckxpc3Q7XG4iLCJ2YXIgQmluYXJ5U2VhcmNoID0ge1xuICAgIC8qKlxuICAgICAqIFNlYXJjaGVzIGZvciBhbiBpdGVtIGluIGFuIGFycmF5IHdoaWNoIG1hdGNoZXMgYSBjZXJ0YWluIGNvbmRpdGlvbi5cbiAgICAgKiBUaGlzIHJlcXVpcmVzIHRoZSBjb25kaXRpb24gdG8gb25seSBtYXRjaCBvbmUgaXRlbSBpbiB0aGUgYXJyYXksXG4gICAgICogYW5kIGZvciB0aGUgYXJyYXkgdG8gYmUgb3JkZXJlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXJyYXl9IGxpc3QgVGhlIGFycmF5IHRvIHNlYXJjaC5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjb21wYXJpc29uRnVuY3Rpb25cbiAgICAgKiAgICAgIENhbGxlZCBhbmQgcHJvdmlkZWQgYSBjYW5kaWRhdGUgaXRlbSBhcyB0aGUgZmlyc3QgYXJndW1lbnQuXG4gICAgICogICAgICBTaG91bGQgcmV0dXJuOlxuICAgICAqICAgICAgICAgID4gLTEgaWYgdGhlIGl0ZW0gc2hvdWxkIGJlIGxvY2F0ZWQgYXQgYSBsb3dlciBpbmRleCB0aGFuIHRoZSBwcm92aWRlZCBpdGVtLlxuICAgICAqICAgICAgICAgID4gMSBpZiB0aGUgaXRlbSBzaG91bGQgYmUgbG9jYXRlZCBhdCBhIGhpZ2hlciBpbmRleCB0aGFuIHRoZSBwcm92aWRlZCBpdGVtLlxuICAgICAqICAgICAgICAgID4gMCBpZiB0aGUgaXRlbSBpcyB0aGUgaXRlbSB5b3UncmUgbG9va2luZyBmb3IuXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHsqfSBUaGUgb2JqZWN0IGlmIGl0IGlzIGZvdW5kIG9yIG51bGwgb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIHNlYXJjaDogZnVuY3Rpb24obGlzdCwgY29tcGFyaXNvbkZ1bmN0aW9uKSB7XG4gICAgICAgIHZhciBtaW5JbmRleCA9IDA7XG4gICAgICAgIHZhciBtYXhJbmRleCA9IGxpc3QubGVuZ3RoIC0gMTtcbiAgICAgICAgdmFyIGN1cnJlbnRJbmRleCA9IG51bGw7XG4gICAgICAgIHZhciBjdXJyZW50RWxlbWVudCA9IG51bGw7XG4gICAgIFxuICAgICAgICB3aGlsZSAobWluSW5kZXggPD0gbWF4SW5kZXgpIHtcbiAgICAgICAgICAgIGN1cnJlbnRJbmRleCA9IChtaW5JbmRleCArIG1heEluZGV4KSAvIDIgfCAwO1xuICAgICAgICAgICAgY3VycmVudEVsZW1lbnQgPSBsaXN0W2N1cnJlbnRJbmRleF07XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHZhciBjb21wYXJpc29uUmVzdWx0ID0gY29tcGFyaXNvbkZ1bmN0aW9uKGN1cnJlbnRFbGVtZW50KTtcbiAgICAgICAgICAgIGlmIChjb21wYXJpc29uUmVzdWx0ID4gMCkge1xuICAgICAgICAgICAgICAgIG1pbkluZGV4ID0gY3VycmVudEluZGV4ICsgMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGNvbXBhcmlzb25SZXN1bHQgPCAwKSB7XG4gICAgICAgICAgICAgICAgbWF4SW5kZXggPSBjdXJyZW50SW5kZXggLSAxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGN1cnJlbnRFbGVtZW50O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgIFxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEJpbmFyeVNlYXJjaDtcbiIsIi8qXG4gKiBDRUEtNzA4IGludGVycHJldGVyXG4qL1xuXG5jbGFzcyBDRUE3MDhJbnRlcnByZXRlciB7XG5cbiAgY29uc3RydWN0b3IobWVkaWEpIHtcbiAgICB0aGlzLm1lZGlhID0gbWVkaWE7XG4gICAgdGhpcy5kaXNwbGF5ID0gW107XG4gICAgdGhpcy5tZW1vcnkgPSBbXTtcbiAgICB0aGlzLl9jcmVhdGVDdWUoKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gIH1cblxuICBfY3JlYXRlQ3VlKClcbiAge1xuICAgIHRoaXMuY3VlID0gbmV3IFZUVEN1ZSgtMSwgLTEsIFwiXCIpO1xuICAgIHRoaXMuY3VlLnRleHQgPSBcIlwiO1xuICAgIHRoaXMuY3VlLnBhdXNlT25FeGl0ID0gZmFsc2U7XG5cbiAgICAvLyBtYWtlIHN1cmUgaXQgZG9lc24ndCBzaG93IHVwIGJlZm9yZSBpdCdzIHJlYWR5XG4gICAgdGhpcy5zdGFydFRpbWUgPSBOdW1iZXIuTUFYX1ZBTFVFO1xuXG4gICAgLy8gc2hvdyBpdCAnZm9yZXZlcicgb25jZSB3ZSBkbyBzaG93IGl0XG4gICAgLy8gKHdlJ2xsIHNldCB0aGUgZW5kIHRpbWUgb25jZSB3ZSBrbm93IGl0IGxhdGVyKVxuICAgIHRoaXMuY3VlLmVuZFRpbWUgPSBOdW1iZXIuTUFYX1ZBTFVFO1xuXG4gICAgdGhpcy5tZW1vcnkucHVzaCh0aGlzLmN1ZSk7XG4gIH1cblxuICBjbGVhcigpXG4gIHtcbiAgICBpZiAodGhpcy5fdGV4dFRyYWNrICYmIHRoaXMuX3RleHRUcmFjay5jdWVzKVxuICAgIHtcbiAgICAgIHdoaWxlICh0aGlzLl90ZXh0VHJhY2suY3Vlcy5sZW5ndGggPiAwKVxuICAgICAge1xuICAgICAgICB0aGlzLl90ZXh0VHJhY2sucmVtb3ZlQ3VlKHRoaXMuX3RleHRUcmFjay5jdWVzWzBdKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwdXNoKHRpbWVzdGFtcCwgYnl0ZXMpXG4gIHtcbiAgICB2YXIgY291bnQgPSBieXRlc1swXSAmIDMxO1xuICAgIHZhciBwb3NpdGlvbiA9IDI7XG4gICAgdmFyIGJ5dGUsIGNjYnl0ZTEsIGNjYnl0ZTIsIGNjZGF0YTEsIGNjZGF0YTIsIGNjVmFsaWQsIGNjVHlwZTtcblxuICAgIGZvciAodmFyIGo9MDsgajxjb3VudDsgaisrKVxuICAgIHtcbiAgICAgIGJ5dGUgPSBieXRlc1twb3NpdGlvbisrXTtcbiAgICAgIGNjYnl0ZTEgPSAweDdGICYgYnl0ZXNbcG9zaXRpb24rK107XG4gICAgICBjY2J5dGUyID0gMHg3RiAmIGJ5dGVzW3Bvc2l0aW9uKytdO1xuICAgICAgY2NWYWxpZCA9ICEoKDQgJiBieXRlKSA9PSAwKTtcbiAgICAgIGNjVHlwZSA9ICgzICYgYnl0ZSk7XG5cbiAgICAgIGlmIChjY2J5dGUxID09PSAwICYmIGNjYnl0ZTIgPT09IDApXG4gICAgICB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoY2NWYWxpZClcbiAgICAgIHtcbiAgICAgICAgaWYgKGNjVHlwZSA9PT0gMCkgLy8gfHwgY2NUeXBlID09PSAxXG4gICAgICAgIHtcbiAgICAgICAgICAvLyBTdGFuZGFyZCBDaGFyYWN0ZXJzXG4gICAgICAgICAgaWYgKDB4MjAgJiBjY2J5dGUxIHx8IDB4NDAgJiBjY2J5dGUxKVxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gdGhpcy5fZnJvbUNoYXJDb2RlKGNjYnl0ZTEpICsgdGhpcy5fZnJvbUNoYXJDb2RlKGNjYnl0ZTIpO1xuICAgICAgICAgICAgY29uc29sZS5sb2codGhpcy5jdWUudGV4dCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIFNwZWNpYWwgQ2hhcmFjdGVyc1xuICAgICAgICAgIGVsc2UgaWYgKChjY2J5dGUxID09PSAweDExIHx8IGNjYnl0ZTEgPT09IDB4MTkpICYmIGNjYnl0ZTIgPj0gMHgzMCAmJiBjY2J5dGUyIDw9IDB4M0YpXG4gICAgICAgICAge1xuICAgICAgICAgICAgLy8gZXh0ZW5kZWQgY2hhcnMsIGUuZy4gbXVzaWNhbCBub3RlLCBhY2NlbnRzXG4gICAgICAgICAgICBzd2l0Y2ggKGNjYnl0ZTIpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGNhc2UgNDg6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSBcIsKuXCI7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNDk6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSBcIsKwXCI7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNTA6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSBcIsK9XCI7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNTE6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSBcIsK/XCI7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNTI6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSBcIuKEolwiO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDUzOlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gXCLColwiO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDU0OlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gXCJcIjtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA1NTpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9IFwiwqNcIjtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA1NjpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9IFwi4pmqXCI7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNTc6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSBcIiBcIjtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA1ODpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9IFwiw6hcIjtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA1OTpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9IFwiw6JcIjtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA2MDpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9IFwiw6pcIjtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA2MTpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9IFwiw65cIjtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA2MjpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9IFwiw7RcIjtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA2MzpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9IFwiw7tcIjtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKChjY2J5dGUxID09PSAweDExIHx8IGNjYnl0ZTEgPT09IDB4MTkpICYmIGNjYnl0ZTIgPj0gMHgyMCAmJiBjY2J5dGUyIDw9IDB4MkYpXG4gICAgICAgICAge1xuICAgICAgICAgICAgLy8gTWlkLXJvdyBjb2RlczogY29sb3IvdW5kZXJsaW5lXG4gICAgICAgICAgICBzd2l0Y2ggKGNjYnl0ZTIpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGNhc2UgMHgyMDpcbiAgICAgICAgICAgICAgICAvLyBXaGl0ZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjE6XG4gICAgICAgICAgICAgICAgLy8gV2hpdGUgVW5kZXJsaW5lXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyMjpcbiAgICAgICAgICAgICAgICAvLyBHcmVlblxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjM6XG4gICAgICAgICAgICAgICAgLy8gR3JlZW4gVW5kZXJsaW5lXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyNDpcbiAgICAgICAgICAgICAgICAvLyBCbHVlXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyNTpcbiAgICAgICAgICAgICAgICAvLyBCbHVlIFVuZGVybGluZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjY6XG4gICAgICAgICAgICAgICAgLy8gQ3lhblxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4Mjc6XG4gICAgICAgICAgICAgICAgLy8gQ3lhbiBVbmRlcmxpbmVcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDI4OlxuICAgICAgICAgICAgICAgIC8vIFJlZFxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4Mjk6XG4gICAgICAgICAgICAgICAgLy8gUmVkIFVuZGVybGluZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkE6XG4gICAgICAgICAgICAgICAgLy8gWWVsbG93XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyQjpcbiAgICAgICAgICAgICAgICAvLyBZZWxsb3cgVW5kZXJsaW5lXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyQzpcbiAgICAgICAgICAgICAgICAvLyBNYWdlbnRhXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyRDpcbiAgICAgICAgICAgICAgICAvLyBNYWdlbnRhIFVuZGVybGluZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkU6XG4gICAgICAgICAgICAgICAgLy8gSXRhbGljc1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkY6XG4gICAgICAgICAgICAgICAgLy8gSXRhbGljcyBVbmRlcmxpbmVcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9ICAgICAgICAgIFxuICAgICAgICAgIGlmICgoY2NieXRlMSA9PT0gMHgxNCB8fCBjY2J5dGUxID09PSAweDFDKSAmJiBjY2J5dGUyID49IDB4MjAgJiYgY2NieXRlMiA8PSAweDJGKVxuICAgICAgICAgIHtcbiAgICAgICAgICAgIC8vIE1pZC1yb3cgY29kZXM6IGNvbG9yL3VuZGVybGluZVxuICAgICAgICAgICAgc3dpdGNoIChjY2J5dGUyKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBjYXNlIDB4MjA6XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCItUkNMLVwiKTtcbiAgICAgICAgICAgICAgICAvLyBUT0RPOiBzaG91bGRuJ3QgYWZmZWN0IHJvbGwtdXBzLi4uXG4gICAgICAgICAgICAgICAgdGhpcy5fY2xlYXJBY3RpdmVDdWVzKHRpbWVzdGFtcCk7XG4gICAgICAgICAgICAgICAgLy8gUkNMOiBSZXN1bWUgQ2FwdGlvbiBMb2FkaW5nXG4gICAgICAgICAgICAgICAgLy8gYmVnaW4gcG9wIG9uXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyMTpcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIi1CUy1cIik7XG4gICAgICAgICAgICAgICAgLy8gQlM6IEJhY2tzcGFjZVxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgPSB0aGlzLmN1ZS50ZXh0LnN1YnN0cigwLCB0aGlzLmN1ZS50ZXh0Lmxlbmd0aC0xKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDIyOlxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiLUFPRi1cIik7XG4gICAgICAgICAgICAgICAgLy8gQU9GOiByZXNlcnZlZCAoZm9ybWVybHkgYWxhcm0gb2ZmKVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjM6XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCItQU9OLVwiKTtcbiAgICAgICAgICAgICAgICAvLyBBT046IHJlc2VydmVkIChmb3JtZXJseSBhbGFybSBvbilcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDI0OlxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiLURFUi1cIik7XG4gICAgICAgICAgICAgICAgLy8gREVSOiBEZWxldGUgdG8gZW5kIG9mIHJvd1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjU6XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCItUlUyLVwiKTtcbiAgICAgICAgICAgICAgICAvLyBSVTI6IHJvbGwtdXAgMiByb3dzXG4gICAgICAgICAgICAgICAgdGhpcy5fcm9sbHVwKDIpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjY6XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCItUlUzLVwiKTtcbiAgICAgICAgICAgICAgICAvLyBSVTM6IHJvbGwtdXAgMyByb3dzXG4gICAgICAgICAgICAgICAgdGhpcy5fcm9sbHVwKDMpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4Mjc6XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCItUlU0LVwiKTtcbiAgICAgICAgICAgICAgICAvLyBSVTQ6IHJvbGwtdXAgNCByb3dzXG4gICAgICAgICAgICAgICAgdGhpcy5fcm9sbHVwKDQpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4Mjg6XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCItRk9OLVwiKTtcbiAgICAgICAgICAgICAgICAvLyBGT046IEZsYXNoIG9uXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyOTpcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIi1SREMtXCIpO1xuICAgICAgICAgICAgICAgIC8vIFJEQzogUmVzdW1lIGRpcmVjdCBjYXB0aW9uaW5nXG4gICAgICAgICAgICAgICAgdGhpcy5fY2xlYXJBY3RpdmVDdWVzKHRpbWVzdGFtcCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyQTpcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIi1UUi1cIik7XG4gICAgICAgICAgICAgICAgLy8gVFI6IFRleHQgUmVzdGFydFxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkI6XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCItUlRELVwiKTtcbiAgICAgICAgICAgICAgICAvLyBSVEQ6IFJlc3VtZSBUZXh0IERpc3BsYXlcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDJDOlxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiLUVETS1cIik7XG4gICAgICAgICAgICAgICAgLy8gRURNOiBFcmFzZSBEaXNwbGF5ZWQgTWVtb3J5XG4gICAgICAgICAgICAgICAgdGhpcy5fY2xlYXJBY3RpdmVDdWVzKHRpbWVzdGFtcCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyRDpcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIi1DUi1cIik7XG4gICAgICAgICAgICAgICAgLy8gQ1I6IENhcnJpYWdlIFJldHVyblxuICAgICAgICAgICAgICAgIC8vIG9ubHkgYWZmZWN0cyByb2xsLXVwXG4gICAgICAgICAgICAgICAgdGhpcy5fcm9sbHVwKDEpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkU6XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCItRU5NLVwiKTtcbiAgICAgICAgICAgICAgICAvLyBFTk06IEVyYXNlIG5vbi1kaXNwbGF5ZWQgbWVtb3J5XG4gICAgICAgICAgICAgICAgdGhpcy5fdGV4dCA9IFwiXCI7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyRjpcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIi1FT0MtOiBcIiArIHRpbWVzdGFtcCk7XG4gICAgICAgICAgICAgICAgdGhpcy5fZmxpcE1lbW9yeSh0aW1lc3RhbXApO1xuICAgICAgICAgICAgICAgIC8vIEVPQzogRW5kIG9mIGNhcHRpb25cbiAgICAgICAgICAgICAgICAvLyBoaWRlIGFueSBkaXNwbGF5ZWQgY2FwdGlvbnMgYW5kIHNob3cgYW55IGhpZGRlbiBvbmVcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9ICAgXG4gICAgICAgICAgaWYgKChjY2J5dGUxID09PSAweDE3IHx8IGNjYnl0ZTEgPT09IDB4MUYpICYmIGNjYnl0ZTIgPj0gMHgyMSAmJiBjY2J5dGUyIDw9IDB4MjMpXG4gICAgICAgICAge1xuICAgICAgICAgICAgLy8gTWlkLXJvdyBjb2RlczogY29sb3IvdW5kZXJsaW5lXG4gICAgICAgICAgICBzd2l0Y2ggKGNjYnl0ZTIpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGNhc2UgMHgyMTpcbiAgICAgICAgICAgICAgICAvLyBUTzE6IHRhYiBvZmZzZXQgMSBjb2x1bW5cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDIyOlxuICAgICAgICAgICAgICAgIC8vIFRPMTogdGFiIG9mZnNldCAyIGNvbHVtblxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjM6XG4gICAgICAgICAgICAgICAgLy8gVE8xOiB0YWIgb2Zmc2V0IDMgY29sdW1uXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgLy8gUHJvYmFibHkgYSBwcmUtYW1ibGUgYWRkcmVzcyBjb2RlXG4gICAgICAgICAgfSAgICAgICAgXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9ICBcbiAgfVxuXG4gIF9mcm9tQ2hhckNvZGUoYnl0ZSlcbiAge1xuICAgIGlmIChieXRlID09PSA0MilcbiAgICB7XG4gICAgICByZXR1cm4gJ8OhJztcbiAgICB9XG4gICAgZWxzZSBpZiAoYnl0ZSA9PT0gOTIpXG4gICAge1xuICAgICAgcmV0dXJuICfDqSc7XG4gICAgfVxuICAgIGVsc2UgaWYgKGJ5dGUgPT09IDk0KVxuICAgIHtcbiAgICAgIHJldHVybiAnw60nO1xuICAgIH1cbiAgICBlbHNlIGlmIChieXRlID09PSA5NSlcbiAgICB7XG4gICAgICByZXR1cm4gJ8OzJztcbiAgICB9XG4gICAgZWxzZSBpZiAoYnl0ZSA9PT0gOTYpXG4gICAge1xuICAgICAgcmV0dXJuICfDuic7XG4gICAgfVxuICAgIGVsc2UgaWYgKGJ5dGUgPT09IDEyMylcbiAgICB7XG4gICAgICByZXR1cm4gJ8OnJztcbiAgICB9XG4gICAgZWxzZSBpZiAoYnl0ZSA9PT0gMTI0KVxuICAgIHtcbiAgICAgIHJldHVybiAnw7cnO1xuICAgIH1cbiAgICBlbHNlIGlmIChieXRlID09PSAxMjUpXG4gICAge1xuICAgICAgcmV0dXJuICfDkSc7XG4gICAgfVxuICAgIGVsc2UgaWYgKGJ5dGUgPT09IDEyNilcbiAgICB7XG4gICAgICByZXR1cm4gJ8OxJztcbiAgICB9XG4gICAgZWxzZSBpZiAoYnl0ZSA9PT0gMTI3KVxuICAgIHtcbiAgICAgIHJldHVybiAn4paIJztcbiAgICB9XG4gICAgZWxzZVxuICAgIHtcbiAgICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ5dGUpO1xuICAgIH1cblxuICB9XG5cbiAgX2ZsaXBNZW1vcnkodGltZXN0YW1wKVxuICB7XG4gICAgdGhpcy5fY2xlYXJBY3RpdmVDdWVzKHRpbWVzdGFtcCk7XG4gICAgdGhpcy5fZmx1c2hDYXB0aW9ucyh0aW1lc3RhbXApO1xuICB9XG5cbiAgX2ZsdXNoQ2FwdGlvbnModGltZXN0YW1wKVxuICB7XG4gICAgaWYgKCF0aGlzLl9oYXM3MDgpXG4gICAge1xuICAgICAgdGhpcy5fdGV4dFRyYWNrID0gdGhpcy5tZWRpYS5hZGRUZXh0VHJhY2soXCJjYXB0aW9uc1wiLCBcIkVuZ2xpc2hcIiwgXCJlblwiKTtcbiAgICAgIHRoaXMuX2hhczcwOCA9IHRydWU7XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaT0wOyBpPHRoaXMubWVtb3J5Lmxlbmd0aDsgaSsrKVxuICAgIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IodGhpcy5tZW1vcnlbaV0udGV4dCk7XG5cbiAgICAgIHRoaXMubWVtb3J5W2ldLnN0YXJ0VGltZSA9IHRpbWVzdGFtcDtcbiAgICAgIHRoaXMuX3RleHRUcmFjay5hZGRDdWUodGhpcy5tZW1vcnlbaV0pO1xuICAgICAgdGhpcy5kaXNwbGF5LnB1c2godGhpcy5tZW1vcnlbaV0pO1xuICAgIH1cblxuICAgIHRoaXMubWVtb3J5ID0gW107XG5cbiAgICB0aGlzLl9jcmVhdGVDdWUoKTtcbiAgfVxuXG4gIF9jbGVhckFjdGl2ZUN1ZXModGltZXN0YW1wKVxuICB7XG4gICAgZm9yICh2YXIgaT0wOyBpPHRoaXMuZGlzcGxheS5sZW5ndGg7IGkrKylcbiAgICB7XG4gICAgICB0aGlzLmRpc3BsYXlbaV0uZW5kVGltZSA9IHRpbWVzdGFtcDtcbiAgICB9XG5cbiAgICB0aGlzLmRpc3BsYXkgPSBbXTtcbiAgfVxuXG4gIF9yb2xsVXAobilcbiAge1xuICAgIC8vIFRPRE86IGltcGxlbWVudCByb2xsLXVwIGNhcHRpb25zXG4gIH1cblxuICBfY2xlYXJCdWZmZXJlZEN1ZXMoKVxuICB7XG4gICAgLy9yZW1vdmUgdGhlbSBhbGwuLi5cbiAgfVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IENFQTcwOEludGVycHJldGVyO1xuXG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5jb25zdCBmYWtlTG9nZ2VyID0ge1xuICB0cmFjZTogbm9vcCxcbiAgZGVidWc6IG5vb3AsXG4gIGxvZzogbm9vcCxcbiAgd2Fybjogbm9vcCxcbiAgaW5mbzogbm9vcCxcbiAgZXJyb3I6IG5vb3Bcbn07XG5cbmxldCBleHBvcnRlZExvZ2dlciA9IGZha2VMb2dnZXI7XG5cbi8vbGV0IGxhc3RDYWxsVGltZTtcbi8vIGZ1bmN0aW9uIGZvcm1hdE1zZ1dpdGhUaW1lSW5mbyh0eXBlLCBtc2cpIHtcbi8vICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbi8vICAgY29uc3QgZGlmZiA9IGxhc3RDYWxsVGltZSA/ICcrJyArIChub3cgLSBsYXN0Q2FsbFRpbWUpIDogJzAnO1xuLy8gICBsYXN0Q2FsbFRpbWUgPSBub3c7XG4vLyAgIG1zZyA9IChuZXcgRGF0ZShub3cpKS50b0lTT1N0cmluZygpICsgJyB8IFsnICsgIHR5cGUgKyAnXSA+ICcgKyBtc2cgKyAnICggJyArIGRpZmYgKyAnIG1zICknO1xuLy8gICByZXR1cm4gbXNnO1xuLy8gfVxuXG5mdW5jdGlvbiBmb3JtYXRNc2codHlwZSwgbXNnKSB7XG4gIG1zZyA9ICdbJyArICB0eXBlICsgJ10gPiAnICsgbXNnO1xuICByZXR1cm4gbXNnO1xufVxuXG5mdW5jdGlvbiBjb25zb2xlUHJpbnRGbih0eXBlKSB7XG4gIGNvbnN0IGZ1bmMgPSB3aW5kb3cuY29uc29sZVt0eXBlXTtcbiAgaWYgKGZ1bmMpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oLi4uYXJncykge1xuICAgICAgaWYoYXJnc1swXSkge1xuICAgICAgICBhcmdzWzBdID0gZm9ybWF0TXNnKHR5cGUsIGFyZ3NbMF0pO1xuICAgICAgfVxuICAgICAgZnVuYy5hcHBseSh3aW5kb3cuY29uc29sZSwgYXJncyk7XG4gICAgfTtcbiAgfVxuICByZXR1cm4gbm9vcDtcbn1cblxuZnVuY3Rpb24gZXhwb3J0TG9nZ2VyRnVuY3Rpb25zKGRlYnVnQ29uZmlnLCAuLi5mdW5jdGlvbnMpIHtcbiAgZnVuY3Rpb25zLmZvckVhY2goZnVuY3Rpb24odHlwZSkge1xuICAgIGV4cG9ydGVkTG9nZ2VyW3R5cGVdID0gZGVidWdDb25maWdbdHlwZV0gPyBkZWJ1Z0NvbmZpZ1t0eXBlXS5iaW5kKGRlYnVnQ29uZmlnKSA6IGNvbnNvbGVQcmludEZuKHR5cGUpO1xuICB9KTtcbn1cblxuZXhwb3J0IHZhciBlbmFibGVMb2dzID0gZnVuY3Rpb24oZGVidWdDb25maWcpIHtcbiAgaWYgKGRlYnVnQ29uZmlnID09PSB0cnVlIHx8IHR5cGVvZiBkZWJ1Z0NvbmZpZyA9PT0gJ29iamVjdCcpIHtcbiAgICBleHBvcnRMb2dnZXJGdW5jdGlvbnMoZGVidWdDb25maWcsXG4gICAgICAvLyBSZW1vdmUgb3V0IGZyb20gbGlzdCBoZXJlIHRvIGhhcmQtZGlzYWJsZSBhIGxvZy1sZXZlbFxuICAgICAgLy8ndHJhY2UnLFxuICAgICAgJ2RlYnVnJyxcbiAgICAgICdsb2cnLFxuICAgICAgJ2luZm8nLFxuICAgICAgJ3dhcm4nLFxuICAgICAgJ2Vycm9yJ1xuICAgICk7XG4gICAgLy8gU29tZSBicm93c2VycyBkb24ndCBhbGxvdyB0byB1c2UgYmluZCBvbiBjb25zb2xlIG9iamVjdCBhbnl3YXlcbiAgICAvLyBmYWxsYmFjayB0byBkZWZhdWx0IGlmIG5lZWRlZFxuICAgIHRyeSB7XG4gICAgIGV4cG9ydGVkTG9nZ2VyLmxvZygpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGV4cG9ydGVkTG9nZ2VyID0gZmFrZUxvZ2dlcjtcbiAgICB9XG4gIH1cbiAgZWxzZSB7XG4gICAgZXhwb3J0ZWRMb2dnZXIgPSBmYWtlTG9nZ2VyO1xuICB9XG59O1xuXG5leHBvcnQgdmFyIGxvZ2dlciA9IGV4cG9ydGVkTG9nZ2VyO1xuIiwidmFyIFVSTEhlbHBlciA9IHtcblxuICAvLyBidWlsZCBhbiBhYnNvbHV0ZSBVUkwgZnJvbSBhIHJlbGF0aXZlIG9uZSB1c2luZyB0aGUgcHJvdmlkZWQgYmFzZVVSTFxuICAvLyBpZiByZWxhdGl2ZVVSTCBpcyBhbiBhYnNvbHV0ZSBVUkwgaXQgd2lsbCBiZSByZXR1cm5lZCBhcyBpcy5cbiAgYnVpbGRBYnNvbHV0ZVVSTDogZnVuY3Rpb24oYmFzZVVSTCwgcmVsYXRpdmVVUkwpIHtcbiAgICAvLyByZW1vdmUgYW55IHJlbWFpbmluZyBzcGFjZSBhbmQgQ1JMRlxuICAgIHJlbGF0aXZlVVJMID0gcmVsYXRpdmVVUkwudHJpbSgpO1xuICAgIGlmICgvXlthLXpdKzovaS50ZXN0KHJlbGF0aXZlVVJMKSkge1xuICAgICAgLy8gY29tcGxldGUgdXJsLCBub3QgcmVsYXRpdmVcbiAgICAgIHJldHVybiByZWxhdGl2ZVVSTDtcbiAgICB9XG5cbiAgICB2YXIgcmVsYXRpdmVVUkxRdWVyeSA9IG51bGw7XG4gICAgdmFyIHJlbGF0aXZlVVJMSGFzaCA9IG51bGw7XG5cbiAgICB2YXIgcmVsYXRpdmVVUkxIYXNoU3BsaXQgPSAvXihbXiNdKikoLiopJC8uZXhlYyhyZWxhdGl2ZVVSTCk7XG4gICAgaWYgKHJlbGF0aXZlVVJMSGFzaFNwbGl0KSB7XG4gICAgICByZWxhdGl2ZVVSTEhhc2ggPSByZWxhdGl2ZVVSTEhhc2hTcGxpdFsyXTtcbiAgICAgIHJlbGF0aXZlVVJMID0gcmVsYXRpdmVVUkxIYXNoU3BsaXRbMV07XG4gICAgfVxuICAgIHZhciByZWxhdGl2ZVVSTFF1ZXJ5U3BsaXQgPSAvXihbXlxcP10qKSguKikkLy5leGVjKHJlbGF0aXZlVVJMKTtcbiAgICBpZiAocmVsYXRpdmVVUkxRdWVyeVNwbGl0KSB7XG4gICAgICByZWxhdGl2ZVVSTFF1ZXJ5ID0gcmVsYXRpdmVVUkxRdWVyeVNwbGl0WzJdO1xuICAgICAgcmVsYXRpdmVVUkwgPSByZWxhdGl2ZVVSTFF1ZXJ5U3BsaXRbMV07XG4gICAgfVxuXG4gICAgdmFyIGJhc2VVUkxIYXNoU3BsaXQgPSAvXihbXiNdKikoLiopJC8uZXhlYyhiYXNlVVJMKTtcbiAgICBpZiAoYmFzZVVSTEhhc2hTcGxpdCkge1xuICAgICAgYmFzZVVSTCA9IGJhc2VVUkxIYXNoU3BsaXRbMV07XG4gICAgfVxuICAgIHZhciBiYXNlVVJMUXVlcnlTcGxpdCA9IC9eKFteXFw/XSopKC4qKSQvLmV4ZWMoYmFzZVVSTCk7XG4gICAgaWYgKGJhc2VVUkxRdWVyeVNwbGl0KSB7XG4gICAgICBiYXNlVVJMID0gYmFzZVVSTFF1ZXJ5U3BsaXRbMV07XG4gICAgfVxuXG4gICAgdmFyIGJhc2VVUkxEb21haW5TcGxpdCA9IC9eKCgoW2Etel0rKTopP1xcL1xcL1thLXowLTlcXC4tXSsoOlswLTldKyk/XFwvKSguKikkL2kuZXhlYyhiYXNlVVJMKTtcbiAgICB2YXIgYmFzZVVSTFByb3RvY29sID0gYmFzZVVSTERvbWFpblNwbGl0WzNdO1xuICAgIHZhciBiYXNlVVJMRG9tYWluID0gYmFzZVVSTERvbWFpblNwbGl0WzFdO1xuICAgIHZhciBiYXNlVVJMUGF0aCA9IGJhc2VVUkxEb21haW5TcGxpdFs1XTtcblxuICAgIHZhciBidWlsdFVSTCA9IG51bGw7XG4gICAgaWYgKC9eXFwvXFwvLy50ZXN0KHJlbGF0aXZlVVJMKSkge1xuICAgICAgYnVpbHRVUkwgPSBiYXNlVVJMUHJvdG9jb2wrJzovLycrVVJMSGVscGVyLmJ1aWxkQWJzb2x1dGVQYXRoKCcnLCByZWxhdGl2ZVVSTC5zdWJzdHJpbmcoMikpO1xuICAgIH1cbiAgICBlbHNlIGlmICgvXlxcLy8udGVzdChyZWxhdGl2ZVVSTCkpIHtcbiAgICAgIGJ1aWx0VVJMID0gYmFzZVVSTERvbWFpbitVUkxIZWxwZXIuYnVpbGRBYnNvbHV0ZVBhdGgoJycsIHJlbGF0aXZlVVJMLnN1YnN0cmluZygxKSk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdmFyIG5ld1BhdGggPSBVUkxIZWxwZXIuYnVpbGRBYnNvbHV0ZVBhdGgoYmFzZVVSTFBhdGgsIHJlbGF0aXZlVVJMKTtcbiAgICAgIGJ1aWx0VVJMID0gYmFzZVVSTERvbWFpbiArIG5ld1BhdGg7XG4gICAgfVxuXG4gICAgLy8gcHV0IHRoZSBxdWVyeSBhbmQgaGFzaCBwYXJ0cyBiYWNrXG4gICAgaWYgKHJlbGF0aXZlVVJMUXVlcnkpIHtcbiAgICAgIGJ1aWx0VVJMICs9IHJlbGF0aXZlVVJMUXVlcnk7XG4gICAgfVxuICAgIGlmIChyZWxhdGl2ZVVSTEhhc2gpIHtcbiAgICAgIGJ1aWx0VVJMICs9IHJlbGF0aXZlVVJMSGFzaDtcbiAgICB9XG4gICAgcmV0dXJuIGJ1aWx0VVJMO1xuICB9LFxuXG4gIC8vIGJ1aWxkIGFuIGFic29sdXRlIHBhdGggdXNpbmcgdGhlIHByb3ZpZGVkIGJhc2VQYXRoXG4gIC8vIGFkYXB0ZWQgZnJvbSBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvZG9jdW1lbnQvY29va2llI1VzaW5nX3JlbGF0aXZlX1VSTHNfaW5fdGhlX3BhdGhfcGFyYW1ldGVyXG4gIC8vIHRoaXMgZG9lcyBub3QgaGFuZGxlIHRoZSBjYXNlIHdoZXJlIHJlbGF0aXZlUGF0aCBpcyBcIi9cIiBvciBcIi8vXCIuIFRoZXNlIGNhc2VzIHNob3VsZCBiZSBoYW5kbGVkIG91dHNpZGUgdGhpcy5cbiAgYnVpbGRBYnNvbHV0ZVBhdGg6IGZ1bmN0aW9uKGJhc2VQYXRoLCByZWxhdGl2ZVBhdGgpIHtcbiAgICB2YXIgc1JlbFBhdGggPSByZWxhdGl2ZVBhdGg7XG4gICAgdmFyIG5VcExuLCBzRGlyID0gJycsIHNQYXRoID0gYmFzZVBhdGgucmVwbGFjZSgvW15cXC9dKiQvLCBzUmVsUGF0aC5yZXBsYWNlKC8oXFwvfF4pKD86XFwuP1xcLyspKy9nLCAnJDEnKSk7XG4gICAgZm9yICh2YXIgbkVuZCwgblN0YXJ0ID0gMDsgbkVuZCA9IHNQYXRoLmluZGV4T2YoJy8uLi8nLCBuU3RhcnQpLCBuRW5kID4gLTE7IG5TdGFydCA9IG5FbmQgKyBuVXBMbikge1xuICAgICAgblVwTG4gPSAvXlxcLyg/OlxcLlxcLlxcLykqLy5leGVjKHNQYXRoLnNsaWNlKG5FbmQpKVswXS5sZW5ndGg7XG4gICAgICBzRGlyID0gKHNEaXIgKyBzUGF0aC5zdWJzdHJpbmcoblN0YXJ0LCBuRW5kKSkucmVwbGFjZShuZXcgUmVnRXhwKCcoPzpcXFxcXFwvK1teXFxcXFxcL10qKXswLCcgKyAoKG5VcExuIC0gMSkgLyAzKSArICd9JCcpLCAnLycpO1xuICAgIH1cbiAgICByZXR1cm4gc0RpciArIHNQYXRoLnN1YnN0cihuU3RhcnQpO1xuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFVSTEhlbHBlcjtcbiIsIi8qKlxuICogWEhSIGJhc2VkIGxvZ2dlclxuKi9cblxuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5cbmNsYXNzIFhockxvYWRlciB7XG5cbiAgY29uc3RydWN0b3IoY29uZmlnKSB7XG4gICAgaWYgKGNvbmZpZyAmJiBjb25maWcueGhyU2V0dXApIHtcbiAgICAgIHRoaXMueGhyU2V0dXAgPSBjb25maWcueGhyU2V0dXA7XG4gICAgfVxuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLmFib3J0KCk7XG4gICAgdGhpcy5sb2FkZXIgPSBudWxsO1xuICB9XG5cbiAgYWJvcnQoKSB7XG4gICAgdmFyIGxvYWRlciA9IHRoaXMubG9hZGVyLFxuICAgICAgICB0aW1lb3V0SGFuZGxlID0gdGhpcy50aW1lb3V0SGFuZGxlO1xuICAgIGlmIChsb2FkZXIgJiYgbG9hZGVyLnJlYWR5U3RhdGUgIT09IDQpIHtcbiAgICAgIHRoaXMuc3RhdHMuYWJvcnRlZCA9IHRydWU7XG4gICAgICBsb2FkZXIuYWJvcnQoKTtcbiAgICB9XG4gICAgaWYgKHRpbWVvdXRIYW5kbGUpIHtcbiAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGltZW91dEhhbmRsZSk7XG4gICAgfVxuICB9XG5cbiAgbG9hZCh1cmwsIHJlc3BvbnNlVHlwZSwgb25TdWNjZXNzLCBvbkVycm9yLCBvblRpbWVvdXQsIHRpbWVvdXQsIG1heFJldHJ5LCByZXRyeURlbGF5LCBvblByb2dyZXNzID0gbnVsbCwgZnJhZyA9IG51bGwpIHtcbiAgICB0aGlzLnVybCA9IHVybDtcbiAgICBpZiAoZnJhZyAmJiAhaXNOYU4oZnJhZy5ieXRlUmFuZ2VTdGFydE9mZnNldCkgJiYgIWlzTmFOKGZyYWcuYnl0ZVJhbmdlRW5kT2Zmc2V0KSkge1xuICAgICAgICB0aGlzLmJ5dGVSYW5nZSA9IGZyYWcuYnl0ZVJhbmdlU3RhcnRPZmZzZXQgKyAnLScgKyBmcmFnLmJ5dGVSYW5nZUVuZE9mZnNldDtcbiAgICB9XG4gICAgdGhpcy5yZXNwb25zZVR5cGUgPSByZXNwb25zZVR5cGU7XG4gICAgdGhpcy5vblN1Y2Nlc3MgPSBvblN1Y2Nlc3M7XG4gICAgdGhpcy5vblByb2dyZXNzID0gb25Qcm9ncmVzcztcbiAgICB0aGlzLm9uVGltZW91dCA9IG9uVGltZW91dDtcbiAgICB0aGlzLm9uRXJyb3IgPSBvbkVycm9yO1xuICAgIHRoaXMuc3RhdHMgPSB7dHJlcXVlc3Q6IHBlcmZvcm1hbmNlLm5vdygpLCByZXRyeTogMH07XG4gICAgdGhpcy50aW1lb3V0ID0gdGltZW91dDtcbiAgICB0aGlzLm1heFJldHJ5ID0gbWF4UmV0cnk7XG4gICAgdGhpcy5yZXRyeURlbGF5ID0gcmV0cnlEZWxheTtcbiAgICB0aGlzLnRpbWVvdXRIYW5kbGUgPSB3aW5kb3cuc2V0VGltZW91dCh0aGlzLmxvYWR0aW1lb3V0LmJpbmQodGhpcyksIHRpbWVvdXQpO1xuICAgIHRoaXMubG9hZEludGVybmFsKCk7XG4gIH1cblxuICBsb2FkSW50ZXJuYWwoKSB7XG4gICAgdmFyIHhociA9IHRoaXMubG9hZGVyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgeGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IHRoaXMuc3RhdGVjaGFuZ2UuYmluZCh0aGlzKTtcbiAgICB4aHIub25wcm9ncmVzcyA9IHRoaXMubG9hZHByb2dyZXNzLmJpbmQodGhpcyk7XG5cbiAgICB4aHIub3BlbignR0VUJywgdGhpcy51cmwsIHRydWUpO1xuICAgIGlmICh0aGlzLmJ5dGVSYW5nZSkge1xuICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoJ1JhbmdlJywgJ2J5dGVzPScgKyB0aGlzLmJ5dGVSYW5nZSk7XG4gICAgfVxuICAgIHhoci5yZXNwb25zZVR5cGUgPSB0aGlzLnJlc3BvbnNlVHlwZTtcbiAgICB0aGlzLnN0YXRzLnRmaXJzdCA9IG51bGw7XG4gICAgdGhpcy5zdGF0cy5sb2FkZWQgPSAwO1xuICAgIGlmICh0aGlzLnhoclNldHVwKSB7XG4gICAgICB0aGlzLnhoclNldHVwKHhociwgdGhpcy51cmwpO1xuICAgIH1cbiAgICB4aHIuc2VuZCgpO1xuICB9XG5cbiAgc3RhdGVjaGFuZ2UoZXZlbnQpIHtcbiAgICB2YXIgeGhyID0gZXZlbnQuY3VycmVudFRhcmdldCxcbiAgICAgICAgc3RhdHVzID0geGhyLnN0YXR1cyxcbiAgICAgICAgc3RhdHMgPSB0aGlzLnN0YXRzO1xuICAgIC8vIGRvbid0IHByb2NlZWQgaWYgeGhyIGhhcyBiZWVuIGFib3J0ZWRcbiAgICAvLyA0ID0gUmVzcG9uc2UgZnJvbSBzZXJ2ZXIgaGFzIGJlZW4gY29tcGxldGVseSBsb2FkZWQuXG4gICAgaWYgKCFzdGF0cy5hYm9ydGVkICYmIHhoci5yZWFkeVN0YXRlID09PSA0KSB7XG4gICAgICAgIC8vIGh0dHAgc3RhdHVzIGJldHdlZW4gMjAwIHRvIDI5OSBhcmUgYWxsIHN1Y2Nlc3NmdWxcbiAgICAgICAgaWYgKHN0YXR1cyA+PSAyMDAgJiYgc3RhdHVzIDwgMzAwKSAge1xuICAgICAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy50aW1lb3V0SGFuZGxlKTtcbiAgICAgICAgICBzdGF0cy50bG9hZCA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgICAgIHRoaXMub25TdWNjZXNzKGV2ZW50LCBzdGF0cyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBlcnJvciAuLi5cbiAgICAgICAgaWYgKHN0YXRzLnJldHJ5IDwgdGhpcy5tYXhSZXRyeSkge1xuICAgICAgICAgIGxvZ2dlci53YXJuKGAke3N0YXR1c30gd2hpbGUgbG9hZGluZyAke3RoaXMudXJsfSwgcmV0cnlpbmcgaW4gJHt0aGlzLnJldHJ5RGVsYXl9Li4uYCk7XG4gICAgICAgICAgdGhpcy5kZXN0cm95KCk7XG4gICAgICAgICAgd2luZG93LnNldFRpbWVvdXQodGhpcy5sb2FkSW50ZXJuYWwuYmluZCh0aGlzKSwgdGhpcy5yZXRyeURlbGF5KTtcbiAgICAgICAgICAvLyBleHBvbmVudGlhbCBiYWNrb2ZmXG4gICAgICAgICAgdGhpcy5yZXRyeURlbGF5ID0gTWF0aC5taW4oMiAqIHRoaXMucmV0cnlEZWxheSwgNjQwMDApO1xuICAgICAgICAgIHN0YXRzLnJldHJ5Kys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgd2luZG93LmNsZWFyVGltZW91dCh0aGlzLnRpbWVvdXRIYW5kbGUpO1xuICAgICAgICAgIGxvZ2dlci5lcnJvcihgJHtzdGF0dXN9IHdoaWxlIGxvYWRpbmcgJHt0aGlzLnVybH1gICk7XG4gICAgICAgICAgdGhpcy5vbkVycm9yKGV2ZW50KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGxvYWR0aW1lb3V0KGV2ZW50KSB7XG4gICAgbG9nZ2VyLndhcm4oYHRpbWVvdXQgd2hpbGUgbG9hZGluZyAke3RoaXMudXJsfWAgKTtcbiAgICB0aGlzLm9uVGltZW91dChldmVudCwgdGhpcy5zdGF0cyk7XG4gIH1cblxuICBsb2FkcHJvZ3Jlc3MoZXZlbnQpIHtcbiAgICB2YXIgc3RhdHMgPSB0aGlzLnN0YXRzO1xuICAgIGlmIChzdGF0cy50Zmlyc3QgPT09IG51bGwpIHtcbiAgICAgIHN0YXRzLnRmaXJzdCA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgIH1cbiAgICBzdGF0cy5sb2FkZWQgPSBldmVudC5sb2FkZWQ7XG4gICAgaWYgKHRoaXMub25Qcm9ncmVzcykge1xuICAgICAgdGhpcy5vblByb2dyZXNzKGV2ZW50LCBzdGF0cyk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFhockxvYWRlcjtcbiJdfQ==
