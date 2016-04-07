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
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
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
  } else if (listeners) {
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

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
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
        var exp = cache[key].exports;
        // Using babel as a transpiler to use esmodule, the export will always
        // be an object with the default export as a property of it. To ensure
        // the existing api and babel esmodule exports are both supported we
        // check for both
        if (exp === fn || exp.default === fn) {
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
        Function(['require'], (
            // try to call default if defined to also support babel esmodule
            // exports
            'var f = require(' + stringify(wkey) + ');' +
            '(f.default ? f.default : f)(self);'
        )),
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
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _eventHandler = require('../event-handler');

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _bufferHelper = require('../helper/buffer-helper');

var _bufferHelper2 = _interopRequireDefault(_bufferHelper);

var _errors = require('../errors');

var _logger = require('../utils/logger');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * simple ABR Controller
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                *  - compute next level based on last fragment bw heuristics
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                *  - implement an abandon rules triggered if we have less than 2 frag buffered and if computed bw shows that we risk buffer stalling
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                */

var AbrController = function (_EventHandler) {
  _inherits(AbrController, _EventHandler);

  function AbrController(hls) {
    _classCallCheck(this, AbrController);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(AbrController).call(this, hls, _events2.default.FRAG_LOADING, _events2.default.FRAG_LOAD_PROGRESS, _events2.default.FRAG_LOADED, _events2.default.ERROR));

    _this.lastfetchlevel = 0;
    _this._autoLevelCapping = -1;
    _this._nextAutoLevel = -1;
    _this.hls = hls;
    _this.onCheck = _this.abandonRulesCheck.bind(_this);
    return _this;
  }

  _createClass(AbrController, [{
    key: 'destroy',
    value: function destroy() {
      this.clearTimer();
      _eventHandler2.default.prototype.destroy.call(this);
    }
  }, {
    key: 'onFragLoading',
    value: function onFragLoading(data) {
      this.timer = setInterval(this.onCheck, 100);
      this.fragCurrent = data.frag;
    }
  }, {
    key: 'onFragLoadProgress',
    value: function onFragLoadProgress(data) {
      var stats = data.stats;
      // only update stats if first frag loading
      // if same frag is loaded multiple times, it might be in browser cache, and loaded quickly
      // and leading to wrong bw estimation
      if (stats.aborted === undefined && data.frag.loadCounter === 1) {
        this.lastfetchduration = (performance.now() - stats.trequest) / 1000;
        this.lastfetchlevel = data.frag.level;
        this.lastbw = stats.loaded * 8 / this.lastfetchduration;
        //console.log(`fetchDuration:${this.lastfetchduration},bw:${(this.lastbw/1000).toFixed(0)}/${stats.aborted}`);
      }
    }
  }, {
    key: 'abandonRulesCheck',
    value: function abandonRulesCheck() {
      /*
        monitor fragment retrieval time...
        we compute expected time of arrival of the complete fragment.
        we compare it to expected time of buffer starvation
      */
      var hls = this.hls,
          v = hls.media,
          frag = this.fragCurrent;
      /* only monitor frag retrieval time if
      (video not paused OR first fragment being loaded(ready state === HAVE_NOTHING = 0)) AND autoswitching enabled AND not lowest level (=> means that we have several levels) */
      if (v && (!v.paused || !v.readyState) && frag.autoLevel && frag.level) {
        var requestDelay = performance.now() - frag.trequest;
        // monitor fragment load progress after half of expected fragment duration,to stabilize bitrate
        if (requestDelay > 500 * frag.duration) {
          var loadRate = Math.max(1, frag.loaded * 1000 / requestDelay); // byte/s; at least 1 byte/s to avoid division by zero
          if (frag.expectedLen < frag.loaded) {
            frag.expectedLen = frag.loaded;
          }
          var pos = v.currentTime;
          var fragLoadedDelay = (frag.expectedLen - frag.loaded) / loadRate;
          var bufferStarvationDelay = _bufferHelper2.default.bufferInfo(v, pos, hls.config.maxBufferHole).end - pos;
          // consider emergency switch down only if we have less than 2 frag buffered AND
          // time to finish loading current fragment is bigger than buffer starvation delay
          // ie if we risk buffer starvation if bw does not increase quickly
          if (bufferStarvationDelay < 2 * frag.duration && fragLoadedDelay > bufferStarvationDelay) {
            var fragLevelNextLoadedDelay = void 0,
                nextLoadLevel = void 0;
            // lets iterate through lower level and try to find the biggest one that could avoid rebuffering
            // we start from current level - 1 and we step down , until we find a matching level
            for (nextLoadLevel = frag.level - 1; nextLoadLevel >= 0; nextLoadLevel--) {
              // compute time to load next fragment at lower level
              // 0.8 : consider only 80% of current bw to be conservative
              // 8 = bits per byte (bps/Bps)
              fragLevelNextLoadedDelay = frag.duration * hls.levels[nextLoadLevel].bitrate / (8 * 0.8 * loadRate);
              _logger.logger.log('fragLoadedDelay/bufferStarvationDelay/fragLevelNextLoadedDelay[' + nextLoadLevel + '] :' + fragLoadedDelay.toFixed(1) + '/' + bufferStarvationDelay.toFixed(1) + '/' + fragLevelNextLoadedDelay.toFixed(1));
              if (fragLevelNextLoadedDelay < bufferStarvationDelay) {
                // we found a lower level that be rebuffering free with current estimated bw !
                break;
              }
            }
            // only emergency switch down if it takes less time to load new fragment at lowest level instead
            // of finishing loading current one ...
            if (fragLevelNextLoadedDelay < fragLoadedDelay) {
              // ensure nextLoadLevel is not negative
              nextLoadLevel = Math.max(0, nextLoadLevel);
              // force next load level in auto mode
              hls.nextLoadLevel = nextLoadLevel;
              // abort fragment loading ...
              _logger.logger.warn('loading too slow, abort fragment loading and switch to level ' + nextLoadLevel);
              //abort fragment loading
              frag.loader.abort();
              this.clearTimer();
              hls.trigger(_events2.default.FRAG_LOAD_EMERGENCY_ABORTED, { frag: frag });
            }
          }
        }
      }
    }
  }, {
    key: 'onFragLoaded',
    value: function onFragLoaded() {
      // stop monitoring bw once frag loaded
      this.clearTimer();
    }
  }, {
    key: 'onError',
    value: function onError(data) {
      // stop timer in case of frag loading error
      switch (data.details) {
        case _errors.ErrorDetails.FRAG_LOAD_ERROR:
        case _errors.ErrorDetails.FRAG_LOAD_TIMEOUT:
          this.clearTimer();
          break;
        default:
          break;
      }
    }
  }, {
    key: 'clearTimer',
    value: function clearTimer() {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    }

    /** Return the capping/max level value that could be used by automatic level selection algorithm **/

  }, {
    key: 'autoLevelCapping',
    get: function get() {
      return this._autoLevelCapping;
    }

    /** set the capping/max level value that could be used by automatic level selection algorithm **/
    ,
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
}(_eventHandler2.default);

exports.default = AbrController;

},{"../errors":20,"../event-handler":21,"../events":22,"../helper/buffer-helper":23,"../utils/logger":36}],4:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _eventHandler = require('../event-handler');

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _logger = require('../utils/logger');

var _errors = require('../errors');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Buffer Controller
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               */

var BufferController = function (_EventHandler) {
  _inherits(BufferController, _EventHandler);

  function BufferController(hls) {
    _classCallCheck(this, BufferController);

    // Source Buffer listeners

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(BufferController).call(this, hls, _events2.default.MEDIA_ATTACHING, _events2.default.MEDIA_DETACHING, _events2.default.BUFFER_RESET, _events2.default.BUFFER_APPENDING, _events2.default.BUFFER_CODECS, _events2.default.BUFFER_EOS, _events2.default.BUFFER_FLUSHING));

    _this.onsbue = _this.onSBUpdateEnd.bind(_this);
    _this.onsbe = _this.onSBUpdateError.bind(_this);
    return _this;
  }

  _createClass(BufferController, [{
    key: 'destroy',
    value: function destroy() {
      _eventHandler2.default.prototype.destroy.call(this);
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
            _logger.logger.warn('onMediaDetaching:' + err.message + ' while calling endOfStream');
          }
        }
        ms.removeEventListener('sourceopen', this.onmso);
        ms.removeEventListener('sourceended', this.onmse);
        ms.removeEventListener('sourceclose', this.onmsc);
        // unlink MediaSource from video tag
        this.media.src = '';
        this.media.removeAttribute('src');
        this.mediaSource = null;
        this.media = null;
        this.pendingTracks = null;
        this.sourceBuffer = null;
      }
      this.onmso = this.onmse = this.onmsc = null;
      this.hls.trigger(_events2.default.MEDIA_DETACHED);
    }
  }, {
    key: 'onMediaSourceOpen',
    value: function onMediaSourceOpen() {
      _logger.logger.log('media source opened');
      this.hls.trigger(_events2.default.MEDIA_ATTACHED, { media: this.media });
      // once received, don't listen anymore to sourceopen event
      this.mediaSource.removeEventListener('sourceopen', this.onmso);
      // if any buffer codecs pending, treat it here.
      var pendingTracks = this.pendingTracks;
      if (pendingTracks) {
        this.onBufferCodecs(pendingTracks);
        this.pendingTracks = null;
        this.doAppending();
      }
    }
  }, {
    key: 'onMediaSourceClose',
    value: function onMediaSourceClose() {
      _logger.logger.log('media source closed');
    }
  }, {
    key: 'onMediaSourceEnded',
    value: function onMediaSourceEnded() {
      _logger.logger.log('media source ended');
    }
  }, {
    key: 'onSBUpdateEnd',
    value: function onSBUpdateEnd() {

      if (this._needsFlush) {
        this.doFlush();
      }

      if (this._needsEos) {
        this.onBufferEos();
      }

      this.hls.trigger(_events2.default.BUFFER_APPENDED);

      this.doAppending();
    }
  }, {
    key: 'onSBUpdateError',
    value: function onSBUpdateError(event) {
      _logger.logger.error('sourceBuffer error:' + event);
      // according to http://www.w3.org/TR/media-source/#sourcebuffer-append-error
      // this error might not always be fatal (it is fatal if decode error is set, in that case
      // it will be followed by a mediaElement error ...)
      this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.BUFFER_APPENDING_ERROR, fatal: false });
      // we don't need to do more than that, as accordin to the spec, updateend will be fired just after
    }
  }, {
    key: 'onBufferReset',
    value: function onBufferReset() {
      var sourceBuffer = this.sourceBuffer;
      if (sourceBuffer) {
        for (var type in sourceBuffer) {
          var sb = sourceBuffer[type];
          try {
            this.mediaSource.removeSourceBuffer(sb);
            sb.removeEventListener('updateend', this.onsbue);
            sb.removeEventListener('error', this.onsbe);
          } catch (err) {}
        }
        this.sourceBuffer = null;
      }
      this.flushRange = [];
      this.appended = 0;
    }
  }, {
    key: 'onBufferCodecs',
    value: function onBufferCodecs(tracks) {
      var sb, trackName, track, codec, mimeType;

      if (!this.media) {
        this.pendingTracks = tracks;
        return;
      }

      if (!this.sourceBuffer) {
        var sourceBuffer = {},
            mediaSource = this.mediaSource;
        for (trackName in tracks) {
          track = tracks[trackName];
          // use levelCodec as first priority
          codec = track.levelCodec || track.codec;
          mimeType = track.container + ';codecs=' + codec;
          _logger.logger.log('creating sourceBuffer with mimeType:' + mimeType);
          sb = sourceBuffer[trackName] = mediaSource.addSourceBuffer(mimeType);
          sb.addEventListener('updateend', this.onsbue);
          sb.addEventListener('error', this.onsbe);
        }
        this.sourceBuffer = sourceBuffer;
      }
    }
  }, {
    key: 'onBufferAppending',
    value: function onBufferAppending(data) {
      if (!this.segments) {
        this.segments = [data];
      } else {
        this.segments.push(data);
      }
      this.doAppending();
    }
  }, {
    key: 'onBufferAppendFail',
    value: function onBufferAppendFail(data) {
      _logger.logger.error('sourceBuffer error:' + data.event);
      // according to http://www.w3.org/TR/media-source/#sourcebuffer-append-error
      // this error might not always be fatal (it is fatal if decode error is set, in that case
      // it will be followed by a mediaElement error ...)
      this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.BUFFER_APPENDING_ERROR, fatal: false, frag: this.fragCurrent });
    }
  }, {
    key: 'onBufferEos',
    value: function onBufferEos() {
      var sb = this.sourceBuffer,
          mediaSource = this.mediaSource;
      if (!mediaSource || mediaSource.readyState !== 'open') {
        return;
      }
      if (!(sb.audio && sb.audio.updating || sb.video && sb.video.updating)) {
        _logger.logger.log('all media data available, signal endOfStream() to MediaSource and stop loading fragment');
        //Notify the media element that it now has all of the media data
        mediaSource.endOfStream();
        this._needsEos = false;
      } else {
        this._needsEos = true;
      }
    }
  }, {
    key: 'onBufferFlushing',
    value: function onBufferFlushing(data) {
      this.flushRange.push({ start: data.startOffset, end: data.endOffset });
      // attempt flush immediatly
      this.flushBufferCounter = 0;
      this.doFlush();
    }
  }, {
    key: 'doFlush',
    value: function doFlush() {
      // loop through all buffer ranges to flush
      while (this.flushRange.length) {
        var range = this.flushRange[0];
        // flushBuffer will abort any buffer append in progress and flush Audio/Video Buffer
        if (this.flushBuffer(range.start, range.end)) {
          // range flushed, remove from flush array
          this.flushRange.shift();
          this.flushBufferCounter = 0;
        } else {
          this._needsFlush = true;
          // avoid looping, wait for SB update end to retrigger a flush
          return;
        }
      }
      if (this.flushRange.length === 0) {
        // everything flushed
        this._needsFlush = false;

        // let's recompute this.appended, which is used to avoid flush looping
        var appended = 0;
        var sourceBuffer = this.sourceBuffer;
        if (sourceBuffer) {
          for (var type in sourceBuffer) {
            appended += sourceBuffer[type].buffered.length;
          }
        }
        this.appended = appended;
        this.hls.trigger(_events2.default.BUFFER_FLUSHED);
      }
    }
  }, {
    key: 'doAppending',
    value: function doAppending() {
      var hls = this.hls,
          sourceBuffer = this.sourceBuffer,
          segments = this.segments;
      if (sourceBuffer) {
        if (this.media.error) {
          segments = [];
          _logger.logger.error('trying to append although a media error occured, flush segment and abort');
          return;
        }
        for (var type in sourceBuffer) {
          if (sourceBuffer[type].updating) {
            //logger.log('sb update in progress');
            return;
          }
        }
        if (segments.length) {
          var segment = segments.shift();
          try {
            //logger.log(`appending ${segment.type} SB, size:${segment.data.length});
            // if (sourceBuffer.firstLoaded && !sourceBuffer.video.updating) {
            // sourceBuffer[segment.type].timestampOffset += 10;
            // }
            sourceBuffer[segment.type].appendBuffer(segment.data);
            sourceBuffer.firstLoaded = true;

            // setTimeout( function() {
            // 	sourceBuffer[segment.type].timestampOffset = 15;
            // }, 5);

            console.info(segment);
            this.appendError = 0;
            this.appended++;
          } catch (err) {
            // in case any error occured while appending, put back segment in segments table
            _logger.logger.error('error while trying to append buffer:' + err.message);
            segments.unshift(segment);
            var event = { type: _errors.ErrorTypes.MEDIA_ERROR };
            if (err.code !== 22) {
              if (this.appendError) {
                this.appendError++;
              } else {
                this.appendError = 1;
              }
              event.details = _errors.ErrorDetails.BUFFER_APPEND_ERROR;
              event.frag = this.fragCurrent;
              /* with UHD content, we could get loop of quota exceeded error until
                browser is able to evict some data from sourcebuffer. retrying help recovering this
              */
              if (this.appendError > hls.config.appendErrorMaxRetry) {
                _logger.logger.log('fail ' + hls.config.appendErrorMaxRetry + ' times to append segment in sourceBuffer');
                segments = [];
                event.fatal = true;
                hls.trigger(_events2.default.ERROR, event);
                return;
              } else {
                event.fatal = false;
                hls.trigger(_events2.default.ERROR, event);
              }
            } else {
              // QuotaExceededError: http://www.w3.org/TR/html5/infrastructure.html#quotaexceedederror
              // let's stop appending any segments, and report BUFFER_FULL_ERROR error
              segments = [];
              event.details = _errors.ErrorDetails.BUFFER_FULL_ERROR;
              hls.trigger(_events2.default.ERROR, event);
            }
          }
        }
      }
    }

    /*
      flush specified buffered range,
      return true once range has been flushed.
      as sourceBuffer.remove() is asynchronous, flushBuffer will be retriggered on sourceBuffer update end
    */

  }, {
    key: 'flushBuffer',
    value: function flushBuffer(startOffset, endOffset) {
      var sb, i, bufStart, bufEnd, flushStart, flushEnd;
      //logger.log('flushBuffer,pos/start/end: ' + this.media.currentTime + '/' + startOffset + '/' + endOffset);
      // safeguard to avoid infinite looping : don't try to flush more than the nb of appended segments
      if (this.flushBufferCounter < this.appended && this.sourceBuffer) {
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
              if (Math.min(flushEnd, bufEnd) - flushStart > 0.5) {
                this.flushBufferCounter++;
                _logger.logger.log('flush ' + type + ' [' + flushStart + ',' + flushEnd + '], of [' + bufStart + ',' + bufEnd + '], pos:' + this.media.currentTime);
                sb.remove(flushStart, flushEnd);
                return false;
              }
            }
          } else {
            //logger.log('abort ' + type + ' append in progress');
            // this will abort any appending in progress
            //sb.abort();
            _logger.logger.warn('cannot flush, sb updating in progress');
            return false;
          }
        }
      } else {
        _logger.logger.warn('abort flushing too many retries');
      }
      _logger.logger.log('buffer flushed');
      // everything flushed !
      return true;
    }
  }]);

  return BufferController;
}(_eventHandler2.default);

exports.default = BufferController;

},{"../errors":20,"../event-handler":21,"../events":22,"../utils/logger":36}],5:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _eventHandler = require('../event-handler');

var _eventHandler2 = _interopRequireDefault(_eventHandler);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * cap stream level to media size dimension controller
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               */

var CapLevelController = function (_EventHandler) {
  _inherits(CapLevelController, _EventHandler);

  function CapLevelController(hls) {
    _classCallCheck(this, CapLevelController);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(CapLevelController).call(this, hls, _events2.default.MEDIA_ATTACHING, _events2.default.MANIFEST_PARSED));
  }

  _createClass(CapLevelController, [{
    key: 'destroy',
    value: function destroy() {
      if (this.hls.config.capLevelToPlayerSize) {
        this.media = null;
        this.autoLevelCapping = Number.POSITIVE_INFINITY;
        if (this.timer) {
          this.timer = clearInterval(this.timer);
        }
      }
    }
  }, {
    key: 'onMediaAttaching',
    value: function onMediaAttaching(data) {
      this.media = data.media instanceof HTMLVideoElement ? data.media : null;
    }
  }, {
    key: 'onManifestParsed',
    value: function onManifestParsed(data) {
      if (this.hls.config.capLevelToPlayerSize) {
        this.autoLevelCapping = Number.POSITIVE_INFINITY;
        this.levels = data.levels;
        this.hls.firstLevel = this.getMaxLevel(data.firstLevel);
        clearInterval(this.timer);
        this.timer = setInterval(this.detectPlayerSize.bind(this), 1000);
        this.detectPlayerSize();
      }
    }
  }, {
    key: 'detectPlayerSize',
    value: function detectPlayerSize() {
      if (this.media) {
        var levelsLength = this.levels ? this.levels.length : 0;
        if (levelsLength) {
          this.hls.autoLevelCapping = this.getMaxLevel(levelsLength - 1);
          if (this.hls.autoLevelCapping > this.autoLevelCapping) {
            // if auto level capping has a higher value for the previous one, flush the buffer using nextLevelSwitch
            // usually happen when the user go to the fullscreen mode.
            this.hls.streamController.nextLevelSwitch();
          }
          this.autoLevelCapping = this.hls.autoLevelCapping;
        }
      }
    }

    /*
    * returns level should be the one with the dimensions equal or greater than the media (player) dimensions (so the video will be downscaled)
    */

  }, {
    key: 'getMaxLevel',
    value: function getMaxLevel(capLevelIndex) {
      var result = void 0,
          i = void 0,
          level = void 0,
          mWidth = this.mediaWidth,
          mHeight = this.mediaHeight,
          lWidth = 0,
          lHeight = 0;

      for (i = 0; i <= capLevelIndex; i++) {
        level = this.levels[i];
        result = i;
        lWidth = level.width;
        lHeight = level.height;
        if (mWidth <= lWidth || mHeight <= lHeight) {
          break;
        }
      }
      return result;
    }
  }, {
    key: 'contentScaleFactor',
    get: function get() {
      var pixelRatio = 1;
      try {
        pixelRatio = window.devicePixelRatio;
      } catch (e) {}
      return pixelRatio;
    }
  }, {
    key: 'mediaWidth',
    get: function get() {
      var width = void 0;
      if (this.media) {
        width = this.media.width || this.media.clientWidth || this.media.offsetWidth;
        width *= this.contentScaleFactor;
      }
      return width;
    }
  }, {
    key: 'mediaHeight',
    get: function get() {
      var height = void 0;
      if (this.media) {
        height = this.media.height || this.media.clientHeight || this.media.offsetHeight;
        height *= this.contentScaleFactor;
      }
      return height;
    }
  }]);

  return CapLevelController;
}(_eventHandler2.default);

exports.default = CapLevelController;

},{"../event-handler":21,"../events":22}],6:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _eventHandler = require('../event-handler');

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _logger = require('../utils/logger');

var _errors = require('../errors');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Level Controller
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               */

var LevelController = function (_EventHandler) {
  _inherits(LevelController, _EventHandler);

  function LevelController(hls) {
    _classCallCheck(this, LevelController);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(LevelController).call(this, hls, _events2.default.MANIFEST_LOADED, _events2.default.LEVEL_LOADED, _events2.default.ERROR));

    _this.ontick = _this.tick.bind(_this);
    _this._manualLevel = _this._autoLevelCapping = -1;
    return _this;
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
    key: 'startLoad',
    value: function startLoad() {
      this.canload = true;
      // speed up live playlist refresh if timer exists
      if (this.timer) {
        this.tick();
      }
    }
  }, {
    key: 'stopLoad',
    value: function stopLoad() {
      this.canload = false;
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
        var checkSupportedAudio = function checkSupportedAudio(codec) {
          return MediaSource.isTypeSupported('audio/mp4;codecs=' + codec);
        };
        var checkSupportedVideo = function checkSupportedVideo(codec) {
          return MediaSource.isTypeSupported('video/mp4;codecs=' + codec);
        };
        var audioCodec = level.audioCodec,
            videoCodec = level.videoCodec;

        return (!audioCodec || checkSupportedAudio(audioCodec)) && (!videoCodec || checkSupportedVideo(videoCodec));
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
            _logger.logger.log('manifest loaded,' + levels.length + ' level(s) found, first bitrate:' + bitrateStart);
            break;
          }
        }
        hls.trigger(_events2.default.MANIFEST_PARSED, { levels: this._levels, firstLevel: this._firstLevel, stats: data.stats });
      } else {
        hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.MANIFEST_INCOMPATIBLE_CODECS_ERROR, fatal: true, url: hls.url, reason: 'no level with compatible codecs found in manifest' });
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
        _logger.logger.log('switching to level ' + newLevel);
        this.hls.trigger(_events2.default.LEVEL_SWITCH, { level: newLevel });
        var level = this._levels[newLevel];
        // check if we need to load playlist for this level
        if (level.details === undefined || level.details.live === true) {
          // level not retrieved yet, or live playlist we need to (re)load it
          _logger.logger.log('(re)loading playlist for level ' + newLevel);
          var urlId = level.urlId;
          this.hls.trigger(_events2.default.LEVEL_LOADING, { url: level.url[urlId], level: newLevel, id: urlId });
        }
      } else {
        // invalid level id given, trigger error
        this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.OTHER_ERROR, details: _errors.ErrorDetails.LEVEL_SWITCH_ERROR, level: newLevel, fatal: false, reason: 'invalid level idx' });
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
          _logger.logger.warn('level controller,' + details + ' for level ' + levelId + ': switching to redundant stream id ' + level.urlId);
        } else {
          // we could try to recover if in auto mode and current level not lowest level (0)
          var recoverable = this._manualLevel === -1 && levelId;
          if (recoverable) {
            _logger.logger.warn('level controller,' + details + ': emergency switch-down for next fragment');
            hls.abrController.nextAutoLevel = 0;
          } else if (level && level.details && level.details.live) {
            _logger.logger.warn('level controller,' + details + ' on live stream, discard');
            // FRAG_LOAD_ERROR and FRAG_LOAD_TIMEOUT are handled by mediaController
          } else if (details !== _errors.ErrorDetails.FRAG_LOAD_ERROR && details !== _errors.ErrorDetails.FRAG_LOAD_TIMEOUT) {
              _logger.logger.error('cannot recover ' + details + ' error');
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
      if (levelId !== undefined && this.canload) {
        var level = this._levels[levelId],
            urlId = level.urlId;
        this.hls.trigger(_events2.default.LEVEL_LOADING, { url: level.url[urlId], level: levelId, id: urlId });
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
  }, {
    key: 'nextLoadLevel',
    get: function get() {
      if (this._manualLevel !== -1) {
        return this._manualLevel;
      } else {
        return this.hls.abrController.nextAutoLevel;
      }
    },
    set: function set(nextLevel) {
      this.level = nextLevel;
      if (this._manualLevel === -1) {
        this.hls.abrController.nextAutoLevel = nextLevel;
      }
    }
  }]);

  return LevelController;
}(_eventHandler2.default);

exports.default = LevelController;

},{"../errors":20,"../event-handler":21,"../events":22,"../utils/logger":36}],7:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _demuxer = require('../demux/demuxer');

var _demuxer2 = _interopRequireDefault(_demuxer);

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _eventHandler = require('../event-handler');

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _logger = require('../utils/logger');

var _binarySearch = require('../utils/binary-search');

var _binarySearch2 = _interopRequireDefault(_binarySearch);

var _bufferHelper = require('../helper/buffer-helper');

var _bufferHelper2 = _interopRequireDefault(_bufferHelper);

var _levelHelper = require('../helper/level-helper');

var _levelHelper2 = _interopRequireDefault(_levelHelper);

var _errors = require('../errors');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Stream Controller
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               */

var State = {
  STOPPED: 'STOPPED',
  STARTING: 'STARTING',
  IDLE: 'IDLE',
  PAUSED: 'PAUSED',
  KEY_LOADING: 'KEY_LOADING',
  FRAG_LOADING: 'FRAG_LOADING',
  FRAG_LOADING_WAITING_RETRY: 'FRAG_LOADING_WAITING_RETRY',
  WAITING_LEVEL: 'WAITING_LEVEL',
  PARSING: 'PARSING',
  PARSED: 'PARSED',
  ENDED: 'ENDED',
  ERROR: 'ERROR'
};

var StreamController = function (_EventHandler) {
  _inherits(StreamController, _EventHandler);

  function StreamController(hls) {
    _classCallCheck(this, StreamController);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(StreamController).call(this, hls, _events2.default.MEDIA_ATTACHED, _events2.default.MEDIA_DETACHING, _events2.default.MANIFEST_LOADING, _events2.default.MANIFEST_PARSED, _events2.default.LEVEL_LOADED, _events2.default.KEY_LOADED, _events2.default.FRAG_LOADED, _events2.default.FRAG_LOAD_EMERGENCY_ABORTED, _events2.default.FRAG_PARSING_INIT_SEGMENT, _events2.default.FRAG_PARSING_DATA, _events2.default.FRAG_PARSED, _events2.default.ERROR, _events2.default.BUFFER_APPENDED, _events2.default.BUFFER_FLUSHED));

    _this.config = hls.config;
    _this.audioCodecSwap = false;
    _this.ticks = 0;
    _this.ontick = _this.tick.bind(_this);
    return _this;
  }

  _createClass(StreamController, [{
    key: 'destroy',
    value: function destroy() {
      this.stopLoad();
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
      _eventHandler2.default.prototype.destroy.call(this);
      this.state = State.STOPPED;
    }
  }, {
    key: 'startLoad',
    value: function startLoad() {
      var startPosition = arguments.length <= 0 || arguments[0] === undefined ? 0 : arguments[0];

      if (this.levels) {
        var media = this.media,
            lastCurrentTime = this.lastCurrentTime;
        this.stopLoad();
        this.demuxer = new _demuxer2.default(this.hls);
        if (!this.timer) {
          this.timer = setInterval(this.ontick, 100);
        }
        this.level = -1;
        this.fragLoadError = 0;
        if (media && lastCurrentTime) {
          _logger.logger.log('configure startPosition @' + lastCurrentTime);
          if (!this.lastPaused) {
            _logger.logger.log('resuming video');
            media.play();
          }
          this.state = State.IDLE;
        } else {
          this.lastCurrentTime = this.startPosition ? this.startPosition : startPosition;
          this.state = State.STARTING;
        }
        this.nextLoadPosition = this.startPosition = this.lastCurrentTime;
        this.tick();
      } else {
        _logger.logger.warn('cannot start loading as manifest not parsed yet');
        this.state = State.STOPPED;
      }
    }
  }, {
    key: 'stopLoad',
    value: function stopLoad() {
      var frag = this.fragCurrent;
      if (frag) {
        if (frag.loader) {
          frag.loader.abort();
        }
        this.fragCurrent = null;
      }
      this.fragPrevious = null;
      if (this.demuxer) {
        this.demuxer.destroy();
        this.demuxer = null;
      }
      this.state = State.STOPPED;
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
      var _this2 = this;

      var pos,
          level,
          levelDetails,
          hls = this.hls,
          config = hls.config;
      switch (this.state) {
        case State.ERROR:
        //don't do anything in error state to avoid breaking further ...
        case State.PAUSED:
          //don't do anything in paused state either ...
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
          // if video not attached AND
          // start fragment already requested OR start frag prefetch disable
          // exit loop
          // => if media not attached but start frag prefetch is enabled and start frag not requested yet, we will not exit loop
          if (!this.media && (this.startFragRequested || !config.startFragPrefetch)) {
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
          if (this.startFragRequested === false) {
            level = this.startLevel;
          } else {
            // we are not at playback start, get next load level from level Controller
            level = hls.nextLoadLevel;
          }
          var bufferInfo = _bufferHelper2.default.bufferInfo(this.media, pos, config.maxBufferHole),
              bufferLen = bufferInfo.len,
              bufferEnd = bufferInfo.end,
              fragPrevious = this.fragPrevious,
              maxBufLen;
          // console.info(bufferInfo);
          // compute max Buffer Length that we could get from this load level, based on level bitrate. don't buffer more than 60 MB and more than 30s
          if (this.levels[level].hasOwnProperty('bitrate')) {
            maxBufLen = Math.max(8 * config.maxBufferSize / this.levels[level].bitrate, config.maxBufferLength);
            maxBufLen = Math.min(maxBufLen, config.maxMaxBufferLength);
          } else {
            maxBufLen = config.maxBufferLength;
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
                frag = void 0;

            // in case of live playlist we need to ensure that requested position is not located before playlist start
            if (levelDetails.live) {
              // check if requested position is within seekable boundaries :
              //logger.log(`start/pos/bufEnd/seeking:${start.toFixed(3)}/${pos.toFixed(3)}/${bufferEnd.toFixed(3)}/${this.media.seeking}`);
              var maxLatency = config.liveMaxLatencyDuration !== undefined ? config.liveMaxLatencyDuration : config.liveMaxLatencyDurationCount * levelDetails.targetduration;

              if (bufferEnd < Math.max(start, end - maxLatency)) {
                var targetLatency = config.liveSyncDuration !== undefined ? config.liveSyncDuration : config.liveSyncDurationCount * levelDetails.targetduration;
                this.seekAfterBuffered = start + Math.max(0, levelDetails.totalduration - targetLatency);
                _logger.logger.log('buffer end: ' + bufferEnd + ' is located too far from the end of live sliding playlist, media position will be reseted to: ' + this.seekAfterBuffered.toFixed(3));
                bufferEnd = this.seekAfterBuffered;
              }
              if (this.startFragRequested && !levelDetails.PTSKnown) {
                /* we are switching level on live playlist, but we don't have any PTS info for that quality level ...
                   try to load frag matching with next SN.
                   even if SN are not synchronized between playlists, loading this frag will help us
                   compute playlist sliding and find the right one after in case it was not the right consecutive one */
                if (fragPrevious) {
                  var targetSN = fragPrevious.sn + 1;
                  if (targetSN >= levelDetails.startSN && targetSN <= levelDetails.endSN) {
                    frag = fragments[targetSN - levelDetails.startSN];
                    _logger.logger.log('live playlist, switching playlist, load frag with next SN: ' + frag.sn);
                  }
                }
                if (!frag) {
                  /* we have no idea about which fragment should be loaded.
                     so let's load mid fragment. it will help computing playlist sliding and find the right one
                  */
                  frag = fragments[Math.min(fragLen - 1, Math.round(fragLen / 2))];
                  _logger.logger.log('live playlist, switching playlist, unknown, load middle frag : ' + frag.sn);
                }
              }
            } else {
              // VoD playlist: if bufferEnd before start of playlist, load first fragment
              if (bufferEnd < start) {
                frag = fragments[0];
              }
            }
            if (!frag) {
              (function () {
                var foundFrag = void 0;
                var maxFragLookUpTolerance = config.maxFragLookUpTolerance;
                if (bufferEnd < end) {
                  if (bufferEnd > end - maxFragLookUpTolerance) {
                    maxFragLookUpTolerance = 0;
                  }
                  foundFrag = _binarySearch2.default.search(fragments, function (candidate) {
                    // offset should be within fragment boundary - config.maxFragLookUpTolerance
                    // this is to cope with situations like
                    // bufferEnd = 9.991
                    // frag[Ø] : [0,10]
                    // frag[1] : [10,20]
                    // bufferEnd is within frag[0] range ... although what we are expecting is to return frag[1] here
                    //              frag start               frag start+duration
                    //                  |-----------------------------|
                    //              <--->                         <--->
                    //  ...--------><-----------------------------><---------....
                    // previous frag         matching fragment         next frag
                    //  return -1             return 0                 return 1
                    // logger.log(`level/sn/start/end/bufEnd:${level}/${candidate.sn}/${candidate.start - maxFragLookUpTolerance}/${(candidate.start+candidate.duration - maxFragLookUpTolerance)}/${bufferEnd}`);
                    if (candidate.start + candidate.duration - maxFragLookUpTolerance <= bufferEnd) {
                      return 1;
                    } else if (candidate.start - maxFragLookUpTolerance > bufferEnd) {
                      return -1;
                    }
                    // console.info(candidate);
                    return 0;
                  });
                  // console.info(foundFrag);
                } else {
                    // reach end of playlist
                    foundFrag = fragments[fragLen - 1];
                  }
                if (foundFrag) {
                  frag = foundFrag;
                  start = foundFrag.start;
                  //logger.log('find SN matching with pos:' +  bufferEnd + ':' + frag.sn);
                  if (fragPrevious && frag.level === fragPrevious.level && frag.sn === fragPrevious.sn) {
                    if (frag.sn < levelDetails.endSN) {
                      frag = fragments[frag.sn + 1 - levelDetails.startSN];
                      _logger.logger.log('SN just loaded, load next one: ' + frag.sn);
                    } else {
                      // have we reached end of VOD playlist ?
                      if (!levelDetails.live) {
                        _this2.hls.trigger(_events2.default.BUFFER_EOS);
                        _this2.state = State.ENDED;
                      }
                      frag = null;
                    }
                  }
                }
              })();
            }
            if (frag) {
              //logger.log('      loading frag ' + i +',pos/bufEnd:' + pos.toFixed(3) + '/' + bufferEnd.toFixed(3));
              if (frag.decryptdata.uri != null && frag.decryptdata.key == null) {
                _logger.logger.log('Loading key for ' + frag.sn + ' of [' + levelDetails.startSN + ' ,' + levelDetails.endSN + '],level ' + level);
                this.state = State.KEY_LOADING;
                hls.trigger(_events2.default.KEY_LOADING, { frag: frag });
              } else {
                _logger.logger.log('Loading ' + frag.sn + ' of [' + levelDetails.startSN + ' ,' + levelDetails.endSN + '],level ' + level + ', currentTime:' + pos + ',bufferEnd:' + bufferEnd.toFixed(3));
                frag.autoLevel = hls.autoLevelEnabled;
                if (this.levels.length > 1) {
                  frag.expectedLen = Math.round(frag.duration * this.levels[level].bitrate / 8);
                  frag.trequest = performance.now();
                }
                // ensure that we are not reloading the same fragments in loop ...
                if (this.fragLoadIdx !== undefined) {
                  this.fragLoadIdx++;
                } else {
                  this.fragLoadIdx = 0;
                }
                if (frag.loadCounter) {
                  frag.loadCounter++;
                  var maxThreshold = config.fragLoadingLoopThreshold;
                  // if this frag has already been loaded 3 times, and if it has been reloaded recently
                  if (frag.loadCounter > maxThreshold && Math.abs(this.fragLoadIdx - frag.loadIdx) < maxThreshold) {
                    hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.FRAG_LOOP_LOADING_ERROR, fatal: false, frag: frag });
                    return;
                  }
                } else {
                  frag.loadCounter = 1;
                }
                frag.loadIdx = this.fragLoadIdx;
                this.fragCurrent = frag;
                this.startFragRequested = true;
                hls.trigger(_events2.default.FRAG_LOADING, { frag: frag });
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
        case State.FRAG_LOADING_WAITING_RETRY:
          var now = performance.now();
          var retryDate = this.retryDate;
          var media = this.media;
          var isSeeking = media && media.seeking;
          // if current time is gt than retryDate, or if media seeking let's switch to IDLE state to retry loading
          if (!retryDate || now >= retryDate || isSeeking) {
            _logger.logger.log('mediaController: retryDate reached, switch back to IDLE state');
            this.state = State.IDLE;
          }
          break;
        case State.STOPPED:
        case State.FRAG_LOADING:
        case State.PARSING:
        case State.PARSED:
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
    key: 'getBufferRange',
    value: function getBufferRange(position) {
      var i,
          range,
          bufferRange = this.bufferRange;
      if (bufferRange) {
        for (i = bufferRange.length - 1; i >= 0; i--) {
          range = bufferRange[i];
          if (position >= range.start && position <= range.end) {
            return range;
          }
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
            this.hls.trigger(_events2.default.FRAG_CHANGED, { frag: fragPlaying });
          }
        }
      }
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
      _logger.logger.log('immediateLevelSwitch');
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
      this.hls.trigger(_events2.default.BUFFER_FLUSHING, { startOffset: 0, endOffset: Number.POSITIVE_INFINITY });
      this.state = State.PAUSED;
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
      if (currentRange && currentRange.start > 1) {
        // flush buffer preceding current fragment (flush until current fragment start offset)
        // minus 1s to avoid video freezing, that could happen if we flush keyframe of current video ...
        this.hls.trigger(_events2.default.BUFFER_FLUSHING, { startOffset: 0, endOffset: currentRange.start - 1 });
        this.state = State.PAUSED;
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
          this.hls.trigger(_events2.default.BUFFER_FLUSHING, { startOffset: nextRange.start, endOffset: Number.POSITIVE_INFINITY });
          this.state = State.PAUSED;
          // if we are here, we can also cancel any loading/demuxing in progress, as they are useless
          var fragCurrent = this.fragCurrent;
          if (fragCurrent && fragCurrent.loader) {
            fragCurrent.loader.abort();
          }
          this.fragCurrent = null;
          // increase fragment load Index to avoid frag loop loading error after buffer flush
          this.fragLoadIdx += 2 * this.config.fragLoadingLoopThreshold;
        }
      }
    }
  }, {
    key: 'onMediaAttached',
    value: function onMediaAttached(data) {
      var media = this.media = data.media;
      this.onvseeking = this.onMediaSeeking.bind(this);
      this.onvseeked = this.onMediaSeeked.bind(this);
      this.onvended = this.onMediaEnded.bind(this);
      media.addEventListener('seeking', this.onvseeking);
      media.addEventListener('seeked', this.onvseeked);
      media.addEventListener('ended', this.onvended);
      if (this.levels && this.config.autoStartLoad) {
        this.hls.startLoad();
      }
    }
  }, {
    key: 'onMediaDetaching',
    value: function onMediaDetaching() {
      var media = this.media;
      if (media && media.ended) {
        _logger.logger.log('MSE detaching and video ended, reset startPosition');
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
      // remove video listeners
      if (media) {
        media.removeEventListener('seeking', this.onvseeking);
        media.removeEventListener('seeked', this.onvseeked);
        media.removeEventListener('ended', this.onvended);
        this.onvseeking = this.onvseeked = this.onvended = null;
      }
      this.media = null;
      this.loadedmetadata = false;
      this.stopLoad();
    }
  }, {
    key: 'onMediaSeeking',
    value: function onMediaSeeking() {
      if (this.state === State.FRAG_LOADING) {
        // check if currently loaded fragment is inside buffer.
        //if outside, cancel fragment loading, otherwise do nothing
        if (_bufferHelper2.default.bufferInfo(this.media, this.media.currentTime, this.config.maxBufferHole).len === 0) {
          _logger.logger.log('seeking outside of buffer while fragment load in progress, cancel fragment load');
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
    key: 'onMediaEnded',
    value: function onMediaEnded() {
      _logger.logger.log('media ended');
      // reset startPosition and lastCurrentTime to restart playback @ stream beginning
      this.startPosition = this.lastCurrentTime = 0;
    }
  }, {
    key: 'onManifestLoading',
    value: function onManifestLoading() {
      // reset buffer on manifest loading
      _logger.logger.log('trigger BUFFER_RESET');
      this.hls.trigger(_events2.default.BUFFER_RESET);
      this.bufferRange = [];
      this.stalled = false;
    }
  }, {
    key: 'onManifestParsed',
    value: function onManifestParsed(data) {
      var aac = false,
          heaac = false,
          codec;
      data.levels.forEach(function (level) {
        // detect if we have different kind of audio codecs used amongst playlists
        codec = level.audioCodec;
        if (codec) {
          if (codec.indexOf('mp4a.40.2') !== -1) {
            aac = true;
          }
          if (codec.indexOf('mp4a.40.5') !== -1) {
            heaac = true;
          }
        }
      });
      this.audioCodecSwitch = aac && heaac;
      if (this.audioCodecSwitch) {
        _logger.logger.log('both AAC/HE-AAC audio found in levels; declaring level codec as HE-AAC');
      }
      this.levels = data.levels;
      this.startLevelLoaded = false;
      this.startFragRequested = false;
      if (this.config.autoStartLoad) {
        this.hls.startLoad();
      }
    }
  }, {
    key: 'onLevelLoaded',
    value: function onLevelLoaded(data) {
      var newDetails = data.details,
          newLevelId = data.level,
          curLevel = this.levels[newLevelId],
          duration = newDetails.totalduration,
          sliding = 0;

      _logger.logger.log('level ' + newLevelId + ' loaded [' + newDetails.startSN + ',' + newDetails.endSN + '],duration:' + duration);
      this.levelLastLoaded = newLevelId;

      if (newDetails.live) {
        var curDetails = curLevel.details;
        if (curDetails) {
          // we already have details for that level, merge them
          _levelHelper2.default.mergeDetails(curDetails, newDetails);
          sliding = newDetails.fragments[0].start;
          if (newDetails.PTSKnown) {
            _logger.logger.log('live playlist sliding:' + sliding.toFixed(3));
          } else {
            _logger.logger.log('live playlist - outdated PTS, unknown sliding');
          }
        } else {
          newDetails.PTSKnown = false;
          _logger.logger.log('live playlist - first load, unknown sliding');
        }
      } else {
        newDetails.PTSKnown = false;
      }
      // override level info
      curLevel.details = newDetails;
      this.hls.trigger(_events2.default.LEVEL_UPDATED, { details: newDetails, level: newLevelId });

      // compute start position
      if (this.startFragRequested === false) {
        // if live playlist, set start position to be fragment N-this.config.liveSyncDurationCount (usually 3)
        if (newDetails.live) {
          var targetLatency = this.config.liveSyncDuration !== undefined ? this.config.liveSyncDuration : this.config.liveSyncDurationCount * newDetails.targetduration;
          this.startPosition = Math.max(0, sliding + duration - targetLatency);
        }
        this.nextLoadPosition = this.startPosition;
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
          this.hls.trigger(_events2.default.FRAG_BUFFERED, { stats: data.stats, frag: fragCurrent });
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
              audioCodec = currentLevel.audioCodec || this.config.defaultAudioCodec;
          if (this.audioCodecSwap) {
            _logger.logger.log('swapping playlist audio codec');
            if (audioCodec === undefined) {
              audioCodec = this.lastAudioCodec;
            }
            if (audioCodec) {
              if (audioCodec.indexOf('mp4a.40.5') !== -1) {
                audioCodec = 'mp4a.40.2';
              } else {
                audioCodec = 'mp4a.40.5';
              }
            }
          }
          this.pendingAppending = 0;
          // logger.log(`Demuxing ${sn} of [${details.startSN} ,${details.endSN}],level ${level}`);
          // 		var re = /(\d+)_\d+.ts/;
          // 		var t0 = 0;
          // 		var m = re.exec(fragCurrent.url);
          // 		var t0 = (m && m[1]) ? parseInt( m[1] )/1000 : 0;
          //
          this.demuxer.push(data.payload, audioCodec, currentLevel.videoCodec, start, fragCurrent.cc, level, sn, duration, fragCurrent.decryptdata, start);
        }
      }
      this.fragLoadError = 0;
    }
  }, {
    key: 'onFragParsingInitSegment',
    value: function onFragParsingInitSegment(data) {
      if (this.state === State.PARSING) {
        var tracks = data.tracks,
            trackName,
            track;

        // include levelCodec in audio and video tracks
        track = tracks.audio;
        if (track) {
          var audioCodec = this.levels[this.level].audioCodec,
              ua = navigator.userAgent.toLowerCase();
          if (audioCodec && this.audioCodecSwap) {
            _logger.logger.log('swapping playlist audio codec');
            if (audioCodec.indexOf('mp4a.40.5') !== -1) {
              audioCodec = 'mp4a.40.2';
            } else {
              audioCodec = 'mp4a.40.5';
            }
          }
          // in case AAC and HE-AAC audio codecs are signalled in manifest
          // force HE-AAC , as it seems that most browsers prefers that way,
          // except for mono streams OR on FF
          // these conditions might need to be reviewed ...
          if (this.audioCodecSwitch) {
            // don't force HE-AAC if mono stream
            if (track.metadata.channelCount !== 1 &&
            // don't force HE-AAC if firefox
            ua.indexOf('firefox') === -1) {
              audioCodec = 'mp4a.40.5';
            }
          }
          // HE-AAC is broken on Android, always signal audio codec as AAC even if variant manifest states otherwise
          if (ua.indexOf('android') !== -1) {
            audioCodec = 'mp4a.40.2';
            _logger.logger.log('Android: force audio codec to' + audioCodec);
          }
          track.levelCodec = audioCodec;
        }
        track = tracks.video;
        if (track) {
          track.levelCodec = this.levels[this.level].videoCodec;
        }

        // if remuxer specify that a unique track needs to generated,
        // let's merge all tracks together
        if (data.unique) {
          var mergedTrack = {
            codec: '',
            levelCodec: ''
          };
          for (trackName in data.tracks) {
            track = tracks[trackName];
            mergedTrack.container = track.container;
            if (mergedTrack.codec) {
              mergedTrack.codec += ',';
              mergedTrack.levelCodec += ',';
            }
            if (track.codec) {
              mergedTrack.codec += track.codec;
            }
            if (track.levelCodec) {
              mergedTrack.levelCodec += track.levelCodec;
            }
          }
          tracks = { audiovideo: mergedTrack };
        }
        this.hls.trigger(_events2.default.BUFFER_CODECS, tracks);
        // loop through tracks that are going to be provided to bufferController
        for (trackName in tracks) {
          track = tracks[trackName];
          _logger.logger.log('track:' + trackName + ',container:' + track.container + ',codecs[level/parsed]=[' + track.levelCodec + '/' + track.codec + ']');
          var initSegment = track.initSegment;
          if (initSegment) {
            this.pendingAppending++;
            this.hls.trigger(_events2.default.BUFFER_APPENDING, { type: trackName, data: initSegment });
          }
        }
        //trigger handler right now
        this.tick();
      }
    }
  }, {
    key: 'onFragParsingData',
    value: function onFragParsingData(data) {
      var _this3 = this;

      if (this.state === State.PARSING) {
        this.tparse2 = Date.now();
        var level = this.levels[this.level],
            frag = this.fragCurrent;

        _logger.logger.log('parsed ' + data.type + ',PTS:[' + data.startPTS.toFixed(3) + ',' + data.endPTS.toFixed(3) + '],DTS:[' + data.startDTS.toFixed(3) + '/' + data.endDTS.toFixed(3) + '],nb:' + data.nb);

        var drift = _levelHelper2.default.updateFragPTS(level.details, frag.sn, data.startPTS, data.endPTS),
            hls = this.hls;
        hls.trigger(_events2.default.LEVEL_PTS_UPDATED, { details: level.details, level: this.level, drift: drift });

        [data.data1, data.data2].forEach(function (buffer) {
          if (buffer) {
            _this3.pendingAppending++;
            hls.trigger(_events2.default.BUFFER_APPENDING, { type: data.type, data: buffer });
          }
        });

        this.nextLoadPosition = data.endPTS;
        this.bufferRange.push({ type: data.type, start: data.startPTS, end: data.endPTS, frag: frag });

        //trigger handler right now
        this.tick();
      } else {
        _logger.logger.warn('not in PARSING state but ' + this.state + ', ignoring FRAG_PARSING_DATA event');
      }
    }
  }, {
    key: 'onFragParsed',
    value: function onFragParsed() {
      if (this.state === State.PARSING) {
        this.stats.tparsed = performance.now();
        this.state = State.PARSED;
        this._checkAppendedParsed();
      }
    }
  }, {
    key: 'onBufferAppended',
    value: function onBufferAppended() {
      switch (this.state) {
        case State.PARSING:
        case State.PARSED:
          this.pendingAppending--;
          this._checkAppendedParsed();
          break;
        default:
          break;
      }
    }
  }, {
    key: '_checkAppendedParsed',
    value: function _checkAppendedParsed() {
      //trigger handler right now
      if (this.state === State.PARSED && this.pendingAppending === 0) {
        var frag = this.fragCurrent,
            stats = this.stats;
        if (frag) {
          this.fragPrevious = frag;
          stats.tbuffered = performance.now();
          this.fragLastKbps = Math.round(8 * stats.length / (stats.tbuffered - stats.tfirst));
          this.hls.trigger(_events2.default.FRAG_BUFFERED, { stats: stats, frag: frag });
          // console.info(stats);
          // console.info(frag);
          _logger.logger.log('media buffered : ' + this.timeRangesToString(this.media.buffered));
          this.state = State.IDLE;
        }
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
              _logger.logger.warn('mediaController: frag loading failed, retry in ' + delay + ' ms');
              this.retryDate = performance.now() + delay;
              // retry loading state
              this.state = State.FRAG_LOADING_WAITING_RETRY;
            } else {
              _logger.logger.error('mediaController: ' + data.details + ' reaches max retry, redispatch as fatal ...');
              // redispatch same error but with fatal set to true
              data.fatal = true;
              this.hls.trigger(_events2.default.ERROR, data);
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
          _logger.logger.warn('mediaController: ' + data.details + ' while loading frag,switch to ' + (data.fatal ? 'ERROR' : 'IDLE') + ' state ...');
          this.state = data.fatal ? State.ERROR : State.IDLE;
          break;
        case _errors.ErrorDetails.BUFFER_FULL_ERROR:
          // trigger a smooth level switch to empty buffers
          // also reduce max buffer length as it might be too high. we do this to avoid loop flushing ...
          this.config.maxMaxBufferLength /= 2;
          _logger.logger.warn('reduce max buffer length to ' + this.config.maxMaxBufferLength + 's and trigger a nextLevelSwitch to flush old buffer and fix QuotaExceededError');
          this.nextLevelSwitch();
          break;
        default:
          break;
      }
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
          var targetSeekPosition, currentTime;
          // if seek after buffered defined, let's seek if within acceptable range
          var seekAfterBuffered = this.seekAfterBuffered;
          if (seekAfterBuffered) {
            if (media.duration >= seekAfterBuffered) {
              targetSeekPosition = seekAfterBuffered;
              this.seekAfterBuffered = undefined;
            }
          } else {
            currentTime = media.currentTime;
            var loadedmetadata = this.loadedmetadata;

            // adjust currentTime to start position on loaded metadata
            if (!loadedmetadata && media.buffered.length) {
              this.loadedmetadata = true;
              // only adjust currentTime if not equal to 0
              if (!currentTime && currentTime !== this.startPosition) {
                targetSeekPosition = this.startPosition;
              }
            }
          }
          if (targetSeekPosition) {
            currentTime = targetSeekPosition;
            _logger.logger.log('target seek position:' + targetSeekPosition);
          }
          var bufferInfo = _bufferHelper2.default.bufferInfo(media, currentTime, 0),
              expectedPlaying = !(media.paused || media.ended || media.seeking || readyState < 2),
              jumpThreshold = 0.4,
              // tolerance needed as some browsers stalls playback before reaching buffered range end
          playheadMoving = currentTime > media.playbackRate * this.lastCurrentTime;

          if (this.stalled && playheadMoving) {
            this.stalled = false;
            _logger.logger.log('playback not stuck anymore @' + currentTime);
          }
          // check buffer upfront
          // if less than 200ms is buffered, and media is expected to play but playhead is not moving,
          // and we have a new buffer range available upfront, let's seek to that one
          if (bufferInfo.len <= jumpThreshold) {
            if (playheadMoving || !expectedPlaying) {
              // playhead moving or media not playing
              jumpThreshold = 0;
            } else {
              // playhead not moving AND media expected to play
              if (!this.stalled) {
                _logger.logger.log('playback seems stuck @' + currentTime);
                this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.BUFFER_STALLED_ERROR, fatal: false });
                this.stalled = true;
              }
            }
            // if we are below threshold, try to jump if next buffer range is close
            if (bufferInfo.len <= jumpThreshold) {
              // no buffer available @ currentTime, check if next buffer is close (within a config.maxSeekHole second range)
              var nextBufferStart = bufferInfo.nextStart,
                  delta = nextBufferStart - currentTime;
              if (nextBufferStart && delta < this.config.maxSeekHole && delta > 0 && !media.seeking) {
                // next buffer is close ! adjust currentTime to nextBufferStart
                // this will ensure effective video decoding
                _logger.logger.log('adjust currentTime from ' + media.currentTime + ' to next buffered @ ' + nextBufferStart);
                media.currentTime = nextBufferStart;
                this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.BUFFER_SEEK_OVER_HOLE, fatal: false });
              }
            }
          } else {
            if (targetSeekPosition && media.currentTime !== targetSeekPosition) {
              _logger.logger.log('adjust currentTime from ' + media.currentTime + ' to ' + targetSeekPosition);
              media.currentTime = targetSeekPosition;
            }
          }
        }
      }
    }
  }, {
    key: 'onFragLoadEmergencyAborted',
    value: function onFragLoadEmergencyAborted() {
      debugger;
      this.state = State.IDLE;
      this.tick();
    }
  }, {
    key: 'onBufferFlushed',
    value: function onBufferFlushed() {
      /* after successful buffer flushing, rebuild buffer Range array
        loop through existing buffer range and check if
        corresponding range is still buffered. only push to new array already buffered range
      */
      var newRange = [],
          range,
          i;
      for (i = 0; i < this.bufferRange.length; i++) {
        range = this.bufferRange[i];
        if (this.isBuffered((range.start + range.end) / 2)) {
          newRange.push(range);
        }
      }
      this.bufferRange = newRange;

      // handle end of immediate switching if needed
      if (this.immediateSwitch) {
        this.immediateLevelSwitchEnd();
      }
      // move to IDLE once flush complete. this should trigger new fragment loading
      this.state = State.IDLE;
      // reset reference to frag
      this.fragPrevious = null;
    }
  }, {
    key: 'swapAudioCodec',
    value: function swapAudioCodec() {
      this.audioCodecSwap = !this.audioCodecSwap;
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

  return StreamController;
}(_eventHandler2.default);

exports.default = StreamController;

},{"../demux/demuxer":16,"../errors":20,"../event-handler":21,"../events":22,"../helper/buffer-helper":23,"../helper/level-helper":24,"../utils/binary-search":34,"../utils/logger":36}],8:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _eventHandler = require('../event-handler');

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _cea708Interpreter = require('../utils/cea-708-interpreter');

var _cea708Interpreter2 = _interopRequireDefault(_cea708Interpreter);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Timeline Controller
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               */

var TimelineController = function (_EventHandler) {
  _inherits(TimelineController, _EventHandler);

  function TimelineController(hls) {
    _classCallCheck(this, TimelineController);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(TimelineController).call(this, hls, _events2.default.MEDIA_ATTACHING, _events2.default.MEDIA_DETACHING, _events2.default.FRAG_PARSING_USERDATA, _events2.default.MANIFEST_LOADING, _events2.default.FRAG_LOADED));

    _this.hls = hls;
    _this.config = hls.config;

    if (_this.config.enableCEA708Captions) {
      _this.cea708Interpreter = new _cea708Interpreter2.default();
    }
    return _this;
  }

  _createClass(TimelineController, [{
    key: 'destroy',
    value: function destroy() {
      _eventHandler2.default.prototype.destroy.call(this);
    }
  }, {
    key: 'onMediaAttaching',
    value: function onMediaAttaching(data) {
      var media = this.media = data.media;
      this.cea708Interpreter.attach(media);
    }
  }, {
    key: 'onMediaDetaching',
    value: function onMediaDetaching() {
      this.cea708Interpreter.detach();
    }
  }, {
    key: 'onManifestLoading',
    value: function onManifestLoading() {
      this.lastPts = Number.POSITIVE_INFINITY;
    }
  }, {
    key: 'onFragLoaded',
    value: function onFragLoaded(data) {
      var pts = data.frag.start; //Number.POSITIVE_INFINITY;

      // if this is a frag for a previously loaded timerange, remove all captions
      // TODO: consider just removing captions for the timerange
      if (pts <= this.lastPts) {
        this.cea708Interpreter.clear();
      }

      this.lastPts = pts;
    }
  }, {
    key: 'onFragParsingUserdata',
    value: function onFragParsingUserdata(data) {
      // push all of the CEA-708 messages into the interpreter
      // immediately. It will create the proper timestamps based on our PTS value
      for (var i = 0; i < data.samples.length; i++) {
        this.cea708Interpreter.push(data.samples[i].pts, data.samples[i].bytes);
      }
    }
  }]);

  return TimelineController;
}(_eventHandler2.default);

exports.default = TimelineController;

},{"../event-handler":21,"../events":22,"../utils/cea-708-interpreter":35}],9:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

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

var AES = function () {

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
}();

exports.default = AES;

},{}],10:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /*
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

var _aes = require('./aes');

var _aes2 = _interopRequireDefault(_aes);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var AES128Decrypter = function () {
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
          decipher = new _aes2.default(Array.prototype.slice.call(key)),


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
}();

exports.default = AES128Decrypter;

},{"./aes":9}],11:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * AES128 decryption.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */

var _aes128Decrypter = require('./aes128-decrypter');

var _aes128Decrypter2 = _interopRequireDefault(_aes128Decrypter);

var _errors = require('../errors');

var _logger = require('../utils/logger');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Decrypter = function () {
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

      _logger.logger.log('decrypting by WebCrypto API');

      this.subtle.importKey('raw', key, { name: 'AES-CBC', length: 128 }, false, ['decrypt']).then(function (importedKey) {
        _this.subtle.decrypt({ name: 'AES-CBC', iv: iv.buffer }, importedKey, data).then(callback).catch(function (err) {
          _this.onWebCryptoError(err, data, key, iv, callback);
        });
      }).catch(function (err) {
        _this.onWebCryptoError(err, data, key, iv, callback);
      });
    }
  }, {
    key: 'decryptBySoftware',
    value: function decryptBySoftware(data, key8, iv8, callback) {
      _logger.logger.log('decrypting by JavaScript Implementation');

      var view = new DataView(key8.buffer);
      var key = new Uint32Array([view.getUint32(0), view.getUint32(4), view.getUint32(8), view.getUint32(12)]);

      view = new DataView(iv8.buffer);
      var iv = new Uint32Array([view.getUint32(0), view.getUint32(4), view.getUint32(8), view.getUint32(12)]);

      var decrypter = new _aes128Decrypter2.default(key, iv);
      callback(decrypter.decrypt(data).buffer);
    }
  }, {
    key: 'onWebCryptoError',
    value: function onWebCryptoError(err, data, key, iv, callback) {
      if (this.hls.config.enableSoftwareAES) {
        _logger.logger.log('disabling to use WebCrypto API');
        this.disableWebCrypto = true;
        this.decryptBySoftware(data, key, iv, callback);
      } else {
        _logger.logger.error('decrypting error : ' + err.message);
        this.hls.trigger(Event.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.FRAG_DECRYPT_ERROR, fatal: true, reason: err.message });
      }
    }
  }]);

  return Decrypter;
}();

exports.default = Decrypter;

},{"../errors":20,"../utils/logger":36,"./aes128-decrypter":10}],12:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * AAC demuxer
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */


var _adts = require('./adts');

var _adts2 = _interopRequireDefault(_adts);

var _logger = require('../utils/logger');

var _id = require('../demux/id3');

var _id2 = _interopRequireDefault(_id);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var AACDemuxer = function () {
  function AACDemuxer(observer, remuxerClass) {
    _classCallCheck(this, AACDemuxer);

    this.observer = observer;
    this.remuxerClass = remuxerClass;
    this.remuxer = new this.remuxerClass(observer);
    this._aacTrack = { container: 'audio/adts', type: 'audio', id: -1, sequenceNumber: 0, samples: [], len: 0 };
  }

  _createClass(AACDemuxer, [{
    key: 'push',


    // feed incoming data to the front of the parsing pipeline
    value: function push(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration) {
      var track = this._aacTrack,
          id3 = new _id2.default(data),
          pts = 90 * id3.timeStamp,
          config,
          frameLength,
          frameDuration,
          frameIndex,
          offset,
          headerLength,
          stamp,
          len,
          aacSample;
      // look for ADTS header (0xFFFx)
      for (offset = id3.length, len = data.length; offset < len - 1; offset++) {
        if (data[offset] === 0xff && (data[offset + 1] & 0xf0) === 0xf0) {
          break;
        }
      }

      if (!track.audiosamplerate) {
        config = _adts2.default.getAudioConfig(this.observer, data, offset, audioCodec);
        track.config = config.config;
        track.audiosamplerate = config.samplerate;
        track.channelCount = config.channelCount;
        track.codec = config.codec;
        track.duration = duration;
        _logger.logger.log('parsed codec:' + track.codec + ',rate:' + config.samplerate + ',nb channel:' + config.channelCount);
      }
      frameIndex = 0;
      frameDuration = 1024 * 90000 / track.audiosamplerate;
      while (offset + 5 < len) {
        // The protection skip bit tells us if we have 2 bytes of CRC data at the end of the ADTS header
        headerLength = !!(data[offset + 1] & 0x01) ? 7 : 9;
        // retrieve frame size
        frameLength = (data[offset + 3] & 0x03) << 11 | data[offset + 4] << 3 | (data[offset + 5] & 0xE0) >>> 5;
        frameLength -= headerLength;
        //stamp = pes.pts;

        if (frameLength > 0 && offset + headerLength + frameLength <= len) {
          stamp = pts + frameIndex * frameDuration;
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
      this.remuxer.remux(this._aacTrack, { samples: [] }, { samples: [{ pts: pts, dts: pts, unit: id3.payload }] }, { samples: [] }, timeOffset);
    }
  }, {
    key: 'destroy',
    value: function destroy() {}
  }], [{
    key: 'probe',
    value: function probe(data) {
      // check if data contains ID3 timestamp and ADTS sync worc
      var id3 = new _id2.default(data),
          offset,
          len;
      if (id3.hasTimeStamp) {
        // look for ADTS header (0xFFFx)
        for (offset = id3.length, len = data.length; offset < len - 1; offset++) {
          if (data[offset] === 0xff && (data[offset + 1] & 0xf0) === 0xf0) {
            //logger.log('ADTS sync word found !');
            return true;
          }
        }
      }
      return false;
    }
  }]);

  return AACDemuxer;
}();

exports.default = AACDemuxer;

},{"../demux/id3":18,"../utils/logger":36,"./adts":13}],13:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *  ADTS parser helper
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */


var _logger = require('../utils/logger');

var _errors = require('../errors');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ADTS = function () {
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
      _logger.logger.log('manifest codec:' + audioCodec + ',ADTS data:type:' + adtsObjectType + ',sampleingIndex:' + adtsSampleingIndex + '[' + adtsSampleingRates[adtsSampleingIndex] + 'Hz],channelConfig:' + adtsChanelConfig);
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
            // if (manifest codec is AAC) AND (frequency less than 24kHz AND nb channel is 1) OR (manifest codec not specified and mono audio)
            // Chrome fails to play back with low frequency AAC LC mono when initialized with HE-AAC.  This is not a problem with stereo.
            if (audioCodec && audioCodec.indexOf('mp4a.40.2') !== -1 && adtsSampleingIndex >= 6 && adtsChanelConfig === 1 || !audioCodec && adtsChanelConfig === 1) {
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
}();

exports.default = ADTS;

},{"../errors":20,"../utils/logger":36}],14:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /*  inline demuxer.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *   probe fragments and instantiate appropriate demuxer depending on content type (TSDemuxer, AACDemuxer, ...)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _errors = require('../errors');

var _aacdemuxer = require('../demux/aacdemuxer');

var _aacdemuxer2 = _interopRequireDefault(_aacdemuxer);

var _tsdemuxer = require('../demux/tsdemuxer');

var _tsdemuxer2 = _interopRequireDefault(_tsdemuxer);

var _mp4Remuxer = require('../remux/mp4-remuxer');

var _mp4Remuxer2 = _interopRequireDefault(_mp4Remuxer);

var _passthroughRemuxer = require('../remux/passthrough-remuxer');

var _passthroughRemuxer2 = _interopRequireDefault(_passthroughRemuxer);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var DemuxerInline = function () {
  function DemuxerInline(hls, typeSupported) {
    _classCallCheck(this, DemuxerInline);

    this.hls = hls;
    this.typeSupported = typeSupported;
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
    value: function push(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration, t0) {
      var demuxer = this.demuxer;
      if (!demuxer) {
        var hls = this.hls;
        // probe for content type
        if (_tsdemuxer2.default.probe(data)) {
          if (this.typeSupported.mp2t === true) {
            demuxer = new _tsdemuxer2.default(hls, _passthroughRemuxer2.default);
          } else {
            demuxer = new _tsdemuxer2.default(hls, _mp4Remuxer2.default);
          }
        } else if (_aacdemuxer2.default.probe(data)) {
          demuxer = new _aacdemuxer2.default(hls, _mp4Remuxer2.default);
        } else {
          hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.FRAG_PARSING_ERROR, fatal: true, reason: 'no demux matching with content found' });
          return;
        }
        this.demuxer = demuxer;
      }
      demuxer.push(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration, t0);
    }
  }]);

  return DemuxerInline;
}();

exports.default = DemuxerInline;

},{"../demux/aacdemuxer":12,"../demux/tsdemuxer":19,"../errors":20,"../events":22,"../remux/mp4-remuxer":31,"../remux/passthrough-remuxer":32}],15:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _demuxerInline = require('../demux/demuxer-inline');

var _demuxerInline2 = _interopRequireDefault(_demuxerInline);

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _events3 = require('events');

var _events4 = _interopRequireDefault(_events3);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var DemuxerWorker = function DemuxerWorker(self) {
  // observer setup
  var observer = new _events4.default();
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
    var data = ev.data;
    //console.log('demuxer cmd:' + data.cmd);
    switch (data.cmd) {
      case 'init':
        self.demuxer = new _demuxerInline2.default(observer, data.typeSupported);
        break;
      case 'demux':
        self.demuxer.push(new Uint8Array(data.data), data.audioCodec, data.videoCodec, data.timeOffset, data.cc, data.level, data.sn, data.duration);
        break;
      default:
        break;
    }
  });

  // listen to events triggered by Demuxer
  observer.on(_events2.default.FRAG_PARSING_INIT_SEGMENT, function (ev, data) {
    self.postMessage({ event: ev, tracks: data.tracks, unique: data.unique });
  });

  observer.on(_events2.default.FRAG_PARSING_DATA, function (ev, data) {
    var objData = { event: ev, type: data.type, startPTS: data.startPTS, endPTS: data.endPTS, startDTS: data.startDTS, endDTS: data.endDTS, data1: data.data1.buffer, data2: data.data2.buffer, nb: data.nb };
    // pass data1/data2 as transferable object (no copy)
    self.postMessage(objData, [objData.data1, objData.data2]);
  });

  observer.on(_events2.default.FRAG_PARSED, function (event) {
    self.postMessage({ event: event });
  });

  observer.on(_events2.default.ERROR, function (event, data) {
    self.postMessage({ event: event, data: data });
  });

  observer.on(_events2.default.FRAG_PARSING_METADATA, function (event, data) {
    var objData = { event: event, samples: data.samples };
    self.postMessage(objData);
  });

  observer.on(_events2.default.FRAG_PARSING_USERDATA, function (event, data) {
    var objData = { event: event, samples: data.samples };
    self.postMessage(objData);
  });
}; /* demuxer web worker.
    *  - listen to worker message, and trigger DemuxerInline upon reception of Fragments.
    *  - provides MP4 Boxes back to main thread using [transferable objects](https://developers.google.com/web/updates/2011/12/Transferable-Objects-Lightning-Fast) in order to minimize message passing overhead.
    */

exports.default = DemuxerWorker;

},{"../demux/demuxer-inline":14,"../events":22,"events":1}],16:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _demuxerInline = require('../demux/demuxer-inline');

var _demuxerInline2 = _interopRequireDefault(_demuxerInline);

var _demuxerWorker = require('../demux/demuxer-worker');

var _demuxerWorker2 = _interopRequireDefault(_demuxerWorker);

var _logger = require('../utils/logger');

var _decrypter = require('../crypt/decrypter');

var _decrypter2 = _interopRequireDefault(_decrypter);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Demuxer = function () {
  function Demuxer(hls) {
    _classCallCheck(this, Demuxer);

    this.hls = hls;
    var typeSupported = {
      mp4: MediaSource.isTypeSupported('video/mp4'),
      mp2t: hls.config.enableMP2TPassThrough && MediaSource.isTypeSupported('video/mp2t')
    };
    if (hls.config.enableWorker && typeof Worker !== 'undefined') {
      _logger.logger.log('demuxing in webworker');
      try {
        var work = require('webworkify');
        this.w = work(_demuxerWorker2.default);
        this.onwmsg = this.onWorkerMessage.bind(this);
        this.w.addEventListener('message', this.onwmsg);
        this.w.postMessage({ cmd: 'init', typeSupported: typeSupported });
      } catch (err) {
        _logger.logger.error('error while initializing DemuxerWorker, fallback on DemuxerInline');
        this.demuxer = new _demuxerInline2.default(hls, typeSupported);
      }
    } else {
      this.demuxer = new _demuxerInline2.default(hls, typeSupported);
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
    value: function pushDecrypted(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration, t0) {
      console.log('pushDecrypted t0: ' + t0);
      if (this.w) {
        // post fragment payload as transferable objects (no copy)
        this.w.postMessage({ cmd: 'demux', data: data, audioCodec: audioCodec, videoCodec: videoCodec, timeOffset: timeOffset, cc: cc, level: level, sn: sn, duration: duration }, [data]);
      } else {
        this.demuxer.push(new Uint8Array(data), audioCodec, videoCodec, timeOffset, cc, level, sn, duration, t0);
      }
    }
  }, {
    key: 'push',
    value: function push(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration, decryptdata, t0) {
      if (data.byteLength > 0 && decryptdata != null && decryptdata.key != null && decryptdata.method === 'AES-128') {
        if (this.decrypter == null) {
          this.decrypter = new _decrypter2.default(this.hls);
        }

        var localthis = this;
        this.decrypter.decrypt(data, decryptdata.key, decryptdata.iv, function (decryptedData) {
          localthis.pushDecrypted(decryptedData, audioCodec, videoCodec, timeOffset, cc, level, sn, duration, t0);
        });
      } else {
        this.pushDecrypted(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration, t0);
      }
    }
  }, {
    key: 'onWorkerMessage',
    value: function onWorkerMessage(ev) {
      var data = ev.data;
      //console.log('onWorkerMessage:' + data.event);
      switch (data.event) {
        case _events2.default.FRAG_PARSING_INIT_SEGMENT:
          var obj = {};
          obj.tracks = data.tracks;
          obj.unique = data.unique;
          this.hls.trigger(_events2.default.FRAG_PARSING_INIT_SEGMENT, obj);
          break;
        case _events2.default.FRAG_PARSING_DATA:
          this.hls.trigger(_events2.default.FRAG_PARSING_DATA, {
            data1: new Uint8Array(data.data1),
            data2: new Uint8Array(data.data2),
            startPTS: data.startPTS,
            endPTS: data.endPTS,
            startDTS: data.startDTS,
            endDTS: data.endDTS,
            type: data.type,
            nb: data.nb
          });
          break;
        case _events2.default.FRAG_PARSING_METADATA:
          this.hls.trigger(_events2.default.FRAG_PARSING_METADATA, {
            samples: data.samples
          });
          break;
        case _events2.default.FRAG_PARSING_USERDATA:
          this.hls.trigger(_events2.default.FRAG_PARSING_USERDATA, {
            samples: data.samples
          });
          break;
        default:
          this.hls.trigger(data.event, data.data);
          break;
      }
    }
  }]);

  return Demuxer;
}();

exports.default = Demuxer;

},{"../crypt/decrypter":11,"../demux/demuxer-inline":14,"../demux/demuxer-worker":15,"../events":22,"../utils/logger":36,"webworkify":2}],17:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Parser for exponential Golomb codes, a variable-bitwidth number encoding scheme used by h264.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     */

var _logger = require('../utils/logger');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ExpGolomb = function () {
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
        _logger.logger.error('Cannot read more than 32 bits at a time');
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
          var sarRatio = void 0;
          var aspectRatioIdc = this.readUByte();
          switch (aspectRatioIdc) {
            case 1:
              sarRatio = [1, 1];break;
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
        width: Math.ceil(((picWidthInMbsMinus1 + 1) * 16 - frameCropLeftOffset * 2 - frameCropRightOffset * 2) * sarScale),
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
}();

exports.default = ExpGolomb;

},{"../utils/logger":36}],18:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * ID3 parser
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */


var _logger = require('../utils/logger');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

//import Hex from '../utils/hex';

var ID3 = function () {
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
        _logger.logger.log('3DI footer found, end: ' + offset);
      } else {
        offset -= 3;
        len = offset;
        if (len) {
          //logger.log(`ID3 len: ${len}`);
          if (!this.hasTimeStamp) {
            _logger.logger.warn('ID3 tag found, but no timestamp');
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
              _logger.logger.trace('ID3 timestamp found: ' + timestamp);
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
}();

exports.default = ID3;

},{"../utils/logger":36}],19:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * highly optimized TS demuxer:
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * parse PAT, PMT
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * extract PES packet from audio and video PIDs
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * extract AVC/H264 NAL units and AAC/ADTS samples from PES packet
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * trigger the remuxer upon parsing completion
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * it also tries to workaround as best as it can audio codec switch (HE-AAC to AAC and vice versa), without having to restart the MediaSource.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * it also controls the remuxing process :
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * upon discontinuity or level switch detection, it will also notifies the remuxer so that it can reset its state.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     */

// import Hex from '../utils/hex';


var _adts = require('./adts');

var _adts2 = _interopRequireDefault(_adts);

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _expGolomb = require('./exp-golomb');

var _expGolomb2 = _interopRequireDefault(_expGolomb);

var _logger = require('../utils/logger');

var _errors = require('../errors');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var TSDemuxer = function () {
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
      this.lastAacPTS = null;
      this.aacOverFlow = null;
      this._avcTrack = { container: 'video/mp2t', type: 'video', id: -1, sequenceNumber: 0, samples: [], len: 0, nbNalu: 0 };
      this._aacTrack = { container: 'video/mp2t', type: 'audio', id: -1, sequenceNumber: 0, samples: [], len: 0 };
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
    value: function push(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration, t0) {
      console.log('tsdemuxer t0: ' + t0);
      var avcData,
          aacData,
          id3Data,
          start,
          len = data.length,
          stt,
          pid,
          atf,
          offset,
          codecsOnly = this.remuxer.passthrough;

      this.audioCodec = audioCodec;
      this.videoCodec = videoCodec;
      this.timeOffset = timeOffset;
      this._duration = duration;
      this.contiguous = false;
      if (cc !== this.lastCC) {
        _logger.logger.log('discontinuity detected');
        this.insertDiscontinuity();
        this.lastCC = cc;
      } else if (level !== this.lastLevel) {
        _logger.logger.log('level switch detected');
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

      // don't parse last TS packet if incomplete
      len -= len % 188;
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
                  if (codecsOnly) {
                    // if we have video codec info AND
                    // if audio PID is undefined OR if we have audio codec info,
                    // we have all codec info !
                    if (this._avcTrack.codec && (aacId === -1 || this._aacTrack.codec)) {
                      this.remux(data, t0);
                      return;
                    }
                  }
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
                  if (codecsOnly) {
                    // here we now that we have audio codec info
                    // if video PID is undefined OR if we have video codec info,
                    // we have all codec infos !
                    if (this._aacTrack.codec && (avcId === -1 || this._avcTrack.codec)) {
                      this.remux(data, t0);
                      return;
                    }
                  }
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
          this.observer.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.FRAG_PARSING_ERROR, fatal: false, reason: 'TS packet did not start with 0x47' });
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
      this.remux(null, t0);
    }
  }, {
    key: 'remux',
    value: function remux(data, t0) {
      console.log('tsdemuxer passing t0 to remux: ' + t0);
      this.remuxer.remux(this._aacTrack, this._avcTrack, this._id3Track, this._txtTrack, this.timeOffset, this.contiguous, data, t0);
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
            _logger.logger.log('unkown stream type:' + data[offset]);
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
          payloadStartOffset,
          data = stream.data;
      //retrieve PTS/DTS from first fragment
      frag = data[0];
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

        stream.size -= payloadStartOffset;
        //reassemble PES packet
        pesData = new Uint8Array(stream.size);
        while (data.length) {
          frag = data.shift();
          var len = frag.byteLength;
          if (payloadStartOffset) {
            if (payloadStartOffset > len) {
              // trim full frag if PES header bigger than frag
              payloadStartOffset -= len;
              continue;
            } else {
              // trim partial frag if PES header smaller than frag
              frag = frag.subarray(payloadStartOffset);
              len -= payloadStartOffset;
              payloadStartOffset = 0;
            }
          }
          pesData.set(frag, i);
          i += len;
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
            expGolombDecoder = new _expGolomb2.default(unit.data);

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
              expGolombDecoder = new _expGolomb2.default(unit.data);
              var config = expGolombDecoder.readSPS();
              track.width = config.width;
              track.height = config.height;
              track.sps = [unit.data];
              track.duration = _this._duration;
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
            push = false;
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
        _logger.logger.log(debugString);
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
        this.observer.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.FRAG_PARSING_ERROR, fatal: fatal, reason: reason });
        if (fatal) {
          return;
        }
      }
      if (!track.audiosamplerate) {
        config = _adts2.default.getAudioConfig(this.observer, data, offset, audioCodec);
        track.config = config.config;
        track.audiosamplerate = config.samplerate;
        track.channelCount = config.channelCount;
        track.codec = config.codec;
        track.duration = duration;
        _logger.logger.log('parsed codec:' + track.codec + ',rate:' + config.samplerate + ',nb channel:' + config.channelCount);
      }
      frameIndex = 0;
      frameDuration = 1024 * 90000 / track.audiosamplerate;

      // if last AAC frame is overflowing, we should ensure timestamps are contiguous:
      // first sample PTS should be equal to last sample PTS + frameDuration
      if (aacOverFlow && lastAacPTS) {
        var newPTS = lastAacPTS + frameDuration;
        if (Math.abs(newPTS - pts) > 1) {
          _logger.logger.log('AAC: align PTS for overlapping frames by ' + Math.round((newPTS - pts) / 90));
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
          stamp = pts + frameIndex * frameDuration;
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
}();

exports.default = TSDemuxer;

},{"../errors":20,"../events":22,"../utils/logger":36,"./adts":13,"./exp-golomb":17}],20:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
var ErrorTypes = exports.ErrorTypes = {
  // Identifier for a network error (loading error / timeout ...)
  NETWORK_ERROR: 'networkError',
  // Identifier for a media Error (video/parsing/mediasource error)
  MEDIA_ERROR: 'mediaError',
  // Identifier for all other errors
  OTHER_ERROR: 'otherError'
};

var ErrorDetails = exports.ErrorDetails = {
  // Identifier for a manifest load error - data: { url : faulty URL, response : XHR response}
  MANIFEST_LOAD_ERROR: 'manifestLoadError',
  // Identifier for a manifest load timeout - data: { url : faulty URL, response : XHR response}
  MANIFEST_LOAD_TIMEOUT: 'manifestLoadTimeOut',
  // Identifier for a manifest parsing error - data: { url : faulty URL, reason : error reason}
  MANIFEST_PARSING_ERROR: 'manifestParsingError',
  // Identifier for a manifest with only incompatible codecs error - data: { url : faulty URL, reason : error reason}
  MANIFEST_INCOMPATIBLE_CODECS_ERROR: 'manifestIncompatibleCodecsError',
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
  BUFFER_STALLED_ERROR: 'bufferStalledError',
  // Identifier for a buffer full event
  BUFFER_FULL_ERROR: 'bufferFullError',
  // Identifier for a buffer seek over hole event
  BUFFER_SEEK_OVER_HOLE: 'bufferSeekOverHole'
};

},{}],21:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/*
*
* All objects in the event handling chain should inherit from this class
*
*/

//import {logger} from './utils/logger';

var EventHandler = function () {
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
      return _typeof(this.handledEvents) === 'object' && this.handledEvents.length && typeof this.onEvent === 'function';
    }
  }, {
    key: 'registerListeners',
    value: function registerListeners() {
      if (this.isEventHandler()) {
        this.handledEvents.forEach(function (event) {
          if (event === 'hlsEventGeneric') {
            throw new Error('Forbidden event name: ' + event);
          }
          this.hls.on(event, this.onEvent);
        }.bind(this));
      }
    }
  }, {
    key: 'unregisterListeners',
    value: function unregisterListeners() {
      if (this.isEventHandler()) {
        this.handledEvents.forEach(function (event) {
          this.hls.off(event, this.onEvent);
        }.bind(this));
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
}();

exports.default = EventHandler;

},{}],22:[function(require,module,exports){
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
  // fired when we buffer is going to be resetted
  BUFFER_RESET: 'hlsBufferReset',
  // fired when we know about the codecs that we need buffers for to push into - data: {tracks : { container, codec, levelCodec, initSegment, metadata }}
  BUFFER_CODECS: 'hlsBufferCodecs',
  // fired when we append a segment to the buffer - data: { segment: segment object }
  BUFFER_APPENDING: 'hlsBufferAppending',
  // fired when we are done with appending a media segment to the buffer
  BUFFER_APPENDED: 'hlsBufferAppended',
  // fired when the stream is finished and we want to notify the media buffer that there will be no more data
  BUFFER_EOS: 'hlsBufferEos',
  // fired when the media buffer should be flushed - data {startOffset, endOffset}
  BUFFER_FLUSHING: 'hlsBufferFlushing',
  // fired when the media has been flushed
  BUFFER_FLUSHED: 'hlsBufferFlushed',
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
  FRAG_PARSING_USERDATA: 'hlsFragParsingUserdata',
  // fired when parsing id3 is completed - data: { samples : [ id3 samples pes ] }
  FRAG_PARSING_METADATA: 'hlsFragParsingMetadata',
  // fired when data have been extracted from fragment - data: { data1 : moof MP4 box or TS fragments, data2 : mdat MP4 box or null}
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

},{}],23:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Buffer Helper class, providing methods dealing buffer length retrieval
*/

var BufferHelper = function () {
  function BufferHelper() {
    _classCallCheck(this, BufferHelper);
  }

  _createClass(BufferHelper, null, [{
    key: "bufferInfo",
    value: function bufferInfo(media, pos, maxHoleDuration) {
      if (media) {
        var vbuffered = media.buffered,
            buffered = [],
            i;
        for (i = 0; i < vbuffered.length; i++) {
          buffered.push({ start: vbuffered.start(i), end: vbuffered.end(i) });
        }
        return this.bufferedInfo(buffered, pos, maxHoleDuration);
      } else {
        return { len: 0, start: 0, end: 0, nextStart: undefined };
      }
    }
  }, {
    key: "bufferedInfo",
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
          break;
        }
      }
      // if( bufferStart == bufferEnd && bufferEnd != 0) { debugger; }
      return { len: bufferLen, start: bufferStart, end: bufferEnd, nextStart: bufferStartNext };
    }
  }]);

  return BufferHelper;
}();

exports.default = BufferHelper;

},{}],24:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Level Helper class, providing methods dealing with playlist sliding and drift
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     */

var _logger = require('../utils/logger');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var LevelHelper = function () {
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
        _logger.logger.log('discontinuity sliding from playlist, take drift into account');
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

      var prevFrag = fragments[fragIdx - 1];
      var nextFrag = fragments[fragIdx + 1];

      if (!isNaN(frag.startPTS)) {
        startPTS = Math.min(startPTS, frag.startPTS);
        endPTS = Math.max(endPTS, frag.endPTS);
      }

      if (prevFrag && Math.abs(prevFrag.start - startPTS) > 100) {
        startPTS = prevFrag.start + prevFrag.duration;
        // if (frag.duration > 100) debugger;
        endPTS = startPTS + frag.duration;
        console.info(frag.sn + ':  ' + startPTS + ' -> ' + endPTS + ' | ' + frag.duration);
        // debugger;
      } else if (nextFrag && Math.abs(nextFrag.start - startPTS) > 100) {
          // startPTS = nextFrag.start + nextFrag.duration;
          // endPTS = startPTS + frag.duration;
          // console.log(frag.sn + ':  ' + startPTS + ' -> ' + endPTS + ' | ' + frag.duration);
          // debugger;
        }

      if (Math.abs(startPTS - endPTS) > 100) {
        var old_endPTS = endPTS;
        endPTS = startPTS + frag.duration;
        console.info('adjusting endPTS: ' + old_endPTS + ' -> ' + endPTS);
      }

      var drift = startPTS - frag.start;

      frag.start = frag.startPTS = startPTS;
      frag.endPTS = endPTS;
      frag.duration = endPTS - startPTS;

      // if (frag.duration > 100) debugger;

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
            _logger.logger.error('negative duration computed for frag ' + fragFrom.sn + ',level ' + fragFrom.level + ', there should be some duration drift between playlist and fragment!');
            debugger;
          }
        } else {
          fragTo.duration = fragFrom.start - fragToPTS;
          if (fragTo.duration < 0) {
            _logger.logger.error('negative duration computed for frag ' + fragTo.sn + ',level ' + fragTo.level + ', there should be some duration drift between playlist and fragment!');
            debugger;
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
}();

exports.default = LevelHelper;

},{"../utils/logger":36}],25:[function(require,module,exports){
/**
 * HLS interface
 */
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
//import FPSController from './controller/fps-controller';


var _events = require('./events');

var _events2 = _interopRequireDefault(_events);

var _errors = require('./errors');

var _playlistLoader = require('./loader/playlist-loader');

var _playlistLoader2 = _interopRequireDefault(_playlistLoader);

var _fragmentLoader = require('./loader/fragment-loader');

var _fragmentLoader2 = _interopRequireDefault(_fragmentLoader);

var _abrController = require('./controller/abr-controller');

var _abrController2 = _interopRequireDefault(_abrController);

var _bufferController = require('./controller/buffer-controller');

var _bufferController2 = _interopRequireDefault(_bufferController);

var _capLevelController = require('./controller/cap-level-controller');

var _capLevelController2 = _interopRequireDefault(_capLevelController);

var _streamController = require('./controller/stream-controller');

var _streamController2 = _interopRequireDefault(_streamController);

var _levelController = require('./controller/level-controller');

var _levelController2 = _interopRequireDefault(_levelController);

var _timelineController = require('./controller/timeline-controller');

var _timelineController2 = _interopRequireDefault(_timelineController);

var _logger = require('./utils/logger');

var _xhrLoader = require('./utils/xhr-loader');

var _xhrLoader2 = _interopRequireDefault(_xhrLoader);

var _events3 = require('events');

var _events4 = _interopRequireDefault(_events3);

var _keyLoader = require('./loader/key-loader');

var _keyLoader2 = _interopRequireDefault(_keyLoader);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Hls = function () {
  _createClass(Hls, null, [{
    key: 'isSupported',
    value: function isSupported() {
      return window.MediaSource && window.MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E,mp4a.40.2"');
    }
  }, {
    key: 'Events',
    get: function get() {
      return _events2.default;
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
          debug: true,
          capLevelToPlayerSize: false,
          maxBufferLength: 30,
          maxBufferSize: 60 * 1000 * 1000,
          maxBufferHole: 5,
          maxSeekHole: 2,
          maxFragLookUpTolerance: 0.2,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: Infinity,
          liveSyncDuration: undefined,
          liveMaxLatencyDuration: undefined,
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
          fragLoadingMaxRetry: 20,
          fragLoadingRetryDelay: 1000,
          fragLoadingLoopThreshold: 3,
          startFragPrefetch: false,
          // fpsDroppedMonitoringPeriod: 5000,
          // fpsDroppedMonitoringThreshold: 0.2,
          appendErrorMaxRetry: 3,
          loader: _xhrLoader2.default,
          fLoader: undefined,
          pLoader: undefined,
          abrController: _abrController2.default,
          bufferController: _bufferController2.default,
          capLevelController: _capLevelController2.default,
          streamController: _streamController2.default,
          timelineController: _timelineController2.default,
          enableCEA708Captions: true,
          enableMP2TPassThrough: false
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

    if ((config.liveSyncDurationCount || config.liveMaxLatencyDurationCount) && (config.liveSyncDuration || config.liveMaxLatencyDuration)) {
      throw new Error('Illegal hls.js config: don\'t mix up liveSyncDurationCount/liveMaxLatencyDurationCount and liveSyncDuration/liveMaxLatencyDuration');
    }

    for (var prop in defaultConfig) {
      if (prop in config) {
        continue;
      }
      config[prop] = defaultConfig[prop];
    }

    if (config.liveMaxLatencyDurationCount !== undefined && config.liveMaxLatencyDurationCount <= config.liveSyncDurationCount) {
      throw new Error('Illegal hls.js config: "liveMaxLatencyDurationCount" must be gt "liveSyncDurationCount"');
    }

    if (config.liveMaxLatencyDuration !== undefined && (config.liveMaxLatencyDuration <= config.liveSyncDuration || config.liveSyncDuration === undefined)) {
      throw new Error('Illegal hls.js config: "liveMaxLatencyDuration" must be gt "liveSyncDuration"');
    }

    (0, _logger.enableLogs)(config.debug);
    this.config = config;
    // observer setup
    var observer = this.observer = new _events4.default();
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
    this.playlistLoader = new _playlistLoader2.default(this);
    this.fragmentLoader = new _fragmentLoader2.default(this);
    this.levelController = new _levelController2.default(this);
    this.abrController = new config.abrController(this);
    this.bufferController = new config.bufferController(this);
    this.capLevelController = new config.capLevelController(this);
    this.streamController = new config.streamController(this);
    this.timelineController = new config.timelineController(this);
    this.keyLoader = new _keyLoader2.default(this);
    //this.fpsController = new FPSController(this);
  }

  _createClass(Hls, [{
    key: 'destroy',
    value: function destroy() {
      _logger.logger.log('destroy');
      this.trigger(_events2.default.DESTROYING);
      this.detachMedia();
      this.playlistLoader.destroy();
      this.fragmentLoader.destroy();
      this.levelController.destroy();
      this.bufferController.destroy();
      this.capLevelController.destroy();
      this.streamController.destroy();
      this.timelineController.destroy();
      this.keyLoader.destroy();
      //this.fpsController.destroy();
      this.url = null;
      this.observer.removeAllListeners();
    }
  }, {
    key: 'attachMedia',
    value: function attachMedia(media) {
      _logger.logger.log('attachMedia');
      this.media = media;
      this.trigger(_events2.default.MEDIA_ATTACHING, { media: media });
    }
  }, {
    key: 'detachMedia',
    value: function detachMedia() {
      _logger.logger.log('detachMedia');
      this.trigger(_events2.default.MEDIA_DETACHING);
      this.media = null;
    }
  }, {
    key: 'loadSource',
    value: function loadSource(url) {
      _logger.logger.log('loadSource:' + url);
      this.url = url;
      // when attaching to a source URL, trigger a playlist load
      this.trigger(_events2.default.MANIFEST_LOADING, { url: url });
    }
  }, {
    key: 'startLoad',
    value: function startLoad() {
      var startPosition = arguments.length <= 0 || arguments[0] === undefined ? 0 : arguments[0];

      _logger.logger.log('startLoad');
      this.levelController.startLoad();
      this.streamController.startLoad(startPosition);
    }
  }, {
    key: 'stopLoad',
    value: function stopLoad() {
      _logger.logger.log('stopLoad');
      this.levelController.stopLoad();
      this.streamController.stopLoad();
    }
  }, {
    key: 'swapAudioCodec',
    value: function swapAudioCodec() {
      _logger.logger.log('swapAudioCodec');
      this.streamController.swapAudioCodec();
    }
  }, {
    key: 'recoverMediaError',
    value: function recoverMediaError() {
      _logger.logger.log('recoverMediaError');
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
      return this.streamController.currentLevel;
    }

    /* set quality level immediately (-1 for automatic level selection) */
    ,
    set: function set(newLevel) {
      _logger.logger.log('set currentLevel:' + newLevel);
      this.loadLevel = newLevel;
      this.streamController.immediateLevelSwitch();
    }

    /** Return next playback quality level (quality level of next fragment) **/

  }, {
    key: 'nextLevel',
    get: function get() {
      return this.streamController.nextLevel;
    }

    /* set quality level for next fragment (-1 for automatic level selection) */
    ,
    set: function set(newLevel) {
      _logger.logger.log('set nextLevel:' + newLevel);
      this.levelController.manualLevel = newLevel;
      this.streamController.nextLevelSwitch();
    }

    /** Return the quality level of current/last loaded fragment **/

  }, {
    key: 'loadLevel',
    get: function get() {
      return this.levelController.level;
    }

    /* set quality level for current/next loaded fragment (-1 for automatic level selection) */
    ,
    set: function set(newLevel) {
      _logger.logger.log('set loadLevel:' + newLevel);
      this.levelController.manualLevel = newLevel;
    }

    /** Return the quality level of next loaded fragment **/

  }, {
    key: 'nextLoadLevel',
    get: function get() {
      return this.levelController.nextLoadLevel;
    }

    /** set quality level of next loaded fragment **/
    ,
    set: function set(level) {
      this.levelController.nextLoadLevel = level;
    }

    /** Return first level (index of first level referenced in manifest)
    **/

  }, {
    key: 'firstLevel',
    get: function get() {
      return this.levelController.firstLevel;
    }

    /** set first level (index of first level referenced in manifest)
    **/
    ,
    set: function set(newLevel) {
      _logger.logger.log('set firstLevel:' + newLevel);
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
    }

    /** set  start level (level of first fragment that will be played back)
        if not overrided by user, first level appearing in manifest will be used as start level
        if -1 : automatic start level selection, playback will start from level matching download bandwidth (determined from download of first segment)
    **/
    ,
    set: function set(newLevel) {
      _logger.logger.log('set startLevel:' + newLevel);
      this.levelController.startLevel = newLevel;
    }

    /** Return the capping/max level value that could be used by automatic level selection algorithm **/

  }, {
    key: 'autoLevelCapping',
    get: function get() {
      return this.abrController.autoLevelCapping;
    }

    /** set the capping/max level value that could be used by automatic level selection algorithm **/
    ,
    set: function set(newLevel) {
      _logger.logger.log('set autoLevelCapping:' + newLevel);
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
}();

exports.default = Hls;

},{"./controller/abr-controller":3,"./controller/buffer-controller":4,"./controller/cap-level-controller":5,"./controller/level-controller":6,"./controller/stream-controller":7,"./controller/timeline-controller":8,"./errors":20,"./events":22,"./loader/fragment-loader":27,"./loader/key-loader":28,"./loader/playlist-loader":29,"./utils/logger":36,"./utils/xhr-loader":38,"events":1}],26:[function(require,module,exports){
'use strict';

// This is mostly for support of the es6 module export
// syntax with the babel compiler, it looks like it doesnt support
// function exports like we are used to in node/commonjs
module.exports = require('./hls.js').default;

},{"./hls.js":25}],27:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _eventHandler = require('../event-handler');

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _errors = require('../errors');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Fragment Loader
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               */

var FragmentLoader = function (_EventHandler) {
  _inherits(FragmentLoader, _EventHandler);

  function FragmentLoader(hls) {
    _classCallCheck(this, FragmentLoader);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(FragmentLoader).call(this, hls, _events2.default.FRAG_LOADING));
  }

  _createClass(FragmentLoader, [{
    key: 'destroy',
    value: function destroy() {
      if (this.loader) {
        this.loader.destroy();
        this.loader = null;
      }
      _eventHandler2.default.prototype.destroy.call(this);
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
      this.hls.trigger(_events2.default.FRAG_LOADED, { payload: payload, frag: this.frag, stats: stats });
    }
  }, {
    key: 'loaderror',
    value: function loaderror(event) {
      if (this.loader) {
        this.loader.abort();
      }
      this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: _errors.ErrorDetails.FRAG_LOAD_ERROR, fatal: false, frag: this.frag, response: event });
    }
  }, {
    key: 'loadtimeout',
    value: function loadtimeout() {
      if (this.loader) {
        this.loader.abort();
      }
      this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: _errors.ErrorDetails.FRAG_LOAD_TIMEOUT, fatal: false, frag: this.frag });
    }
  }, {
    key: 'loadprogress',
    value: function loadprogress(event, stats) {
      this.frag.loaded = stats.loaded;
      this.hls.trigger(_events2.default.FRAG_LOAD_PROGRESS, { frag: this.frag, stats: stats });
    }
  }]);

  return FragmentLoader;
}(_eventHandler2.default);

exports.default = FragmentLoader;

},{"../errors":20,"../event-handler":21,"../events":22}],28:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _eventHandler = require('../event-handler');

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _errors = require('../errors');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Decrypt key Loader
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               */

var KeyLoader = function (_EventHandler) {
  _inherits(KeyLoader, _EventHandler);

  function KeyLoader(hls) {
    _classCallCheck(this, KeyLoader);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(KeyLoader).call(this, hls, _events2.default.KEY_LOADING));

    _this.decryptkey = null;
    _this.decrypturl = null;
    return _this;
  }

  _createClass(KeyLoader, [{
    key: 'destroy',
    value: function destroy() {
      if (this.loader) {
        this.loader.destroy();
        this.loader = null;
      }
      _eventHandler2.default.prototype.destroy.call(this);
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
        this.hls.trigger(_events2.default.KEY_LOADED, { frag: frag });
      }
    }
  }, {
    key: 'loadsuccess',
    value: function loadsuccess(event) {
      var frag = this.frag;
      this.decryptkey = frag.decryptdata.key = new Uint8Array(event.currentTarget.response);
      // detach fragment loader on load success
      frag.loader = undefined;
      this.hls.trigger(_events2.default.KEY_LOADED, { frag: frag });
    }
  }, {
    key: 'loaderror',
    value: function loaderror(event) {
      if (this.loader) {
        this.loader.abort();
      }
      this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: _errors.ErrorDetails.KEY_LOAD_ERROR, fatal: false, frag: this.frag, response: event });
    }
  }, {
    key: 'loadtimeout',
    value: function loadtimeout() {
      if (this.loader) {
        this.loader.abort();
      }
      this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: _errors.ErrorDetails.KEY_LOAD_TIMEOUT, fatal: false, frag: this.frag });
    }
  }, {
    key: 'loadprogress',
    value: function loadprogress() {}
  }]);

  return KeyLoader;
}(_eventHandler2.default);

exports.default = KeyLoader;

},{"../errors":20,"../event-handler":21,"../events":22}],29:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _eventHandler = require('../event-handler');

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _errors = require('../errors');

var _url = require('../utils/url');

var _url2 = _interopRequireDefault(_url);

var _attrList = require('../utils/attr-list');

var _attrList2 = _interopRequireDefault(_attrList);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Playlist Loader
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               */

//import {logger} from '../utils/logger';

var PlaylistLoader = function (_EventHandler) {
  _inherits(PlaylistLoader, _EventHandler);

  function PlaylistLoader(hls) {
    _classCallCheck(this, PlaylistLoader);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(PlaylistLoader).call(this, hls, _events2.default.MANIFEST_LOADING, _events2.default.LEVEL_LOADING));
  }

  _createClass(PlaylistLoader, [{
    key: 'destroy',
    value: function destroy() {
      if (this.loader) {
        this.loader.destroy();
        this.loader = null;
      }
      this.url = this.id = null;
      _eventHandler2.default.prototype.destroy.call(this);
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
      if (this.id === null) {
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
      return _url2.default.buildAbsoluteURL(baseUrl, url);
    }
  }, {
    key: 'parseMasterPlaylist',
    value: function parseMasterPlaylist(string, baseurl) {
      var levels = [],
          result = void 0;

      // https://regex101.com is your friend
      var re = /#EXT-X-STREAM-INF:([^\n\r]*)[\r\n]+([^\r\n]+)/g;
      while ((result = re.exec(string)) != null) {
        var level = {};

        var attrs = level.attrs = new _attrList2.default(result[1]);
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
          byteRangeStartOffset,
          nextTimestamp;

      var re = /(\d+)_\d+.ts/;

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

              var match = re.exec(url);
              var timestamp = match && match[1] ? match[1] : null;

              // if (timestamp && nextTimestamp) {
              // 	timestamp = parseInt( timestamp );
              // 	if ( timestamp - nextTimestamp > 2000 ) {
              // 		console.log( timestamp + ' ' + nextTimestamp + ' ' + url );
              // 		cc++;
              // 	}
              // }

              nextTimestamp = timestamp + duration * 1000;

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
            var keyAttrs = new _attrList2.default(decryptparams);
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
            hls.trigger(_events2.default.MANIFEST_LOADED, { levels: [{ url: url }], url: url, stats: stats });
          } else {
            var levelDetails = this.parseLevelPlaylist(string, url, id);
            stats.tparsed = performance.now();
            hls.trigger(_events2.default.LEVEL_LOADED, { details: levelDetails, level: id, id: id2, stats: stats });
          }
        } else {
          levels = this.parseMasterPlaylist(string, url);
          // multi level playlist, parse level info
          if (levels.length) {
            hls.trigger(_events2.default.MANIFEST_LOADED, { levels: levels, url: url, stats: stats });
          } else {
            hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: _errors.ErrorDetails.MANIFEST_PARSING_ERROR, fatal: true, url: url, reason: 'no level found in manifest' });
          }
        }
      } else {
        hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: _errors.ErrorDetails.MANIFEST_PARSING_ERROR, fatal: true, url: url, reason: 'no EXTM3U delimiter' });
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
      if (this.loader) {
        this.loader.abort();
      }
      this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: details, fatal: fatal, url: this.url, loader: this.loader, response: event.currentTarget, level: this.id, id: this.id2 });
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
      if (this.loader) {
        this.loader.abort();
      }
      this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: details, fatal: fatal, url: this.url, loader: this.loader, level: this.id, id: this.id2 });
    }
  }]);

  return PlaylistLoader;
}(_eventHandler2.default);

exports.default = PlaylistLoader;

},{"../errors":20,"../event-handler":21,"../events":22,"../utils/attr-list":33,"../utils/url":37}],30:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Generate MP4 Box
*/

//import Hex from '../utils/hex';

var MP4 = function () {
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
      duration *= timescale;
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
      duration *= timescale;
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
      0x12, 0x64, 0x61, 0x69, 0x6C, //dailymotion/hls.js
      0x79, 0x6D, 0x6F, 0x74, 0x69, 0x6F, 0x6E, 0x2F, 0x68, 0x6C, 0x73, 0x2E, 0x6A, 0x73, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // compressorname
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
          duration = track.duration * track.timescale,
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
}();

exports.default = MP4;

},{}],31:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * fMP4 remuxer
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     */

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _logger = require('../utils/logger');

var _mp4Generator = require('../remux/mp4-generator');

var _mp4Generator2 = _interopRequireDefault(_mp4Generator);

var _errors = require('../errors');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var MP4Remuxer = function () {
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
    value: function remux(audioTrack, videoTrack, id3Track, textTrack, timeOffset, contiguous, data, t0) {
      // generate Init Segment if needed
      if (!this.ISGenerated) {
        this.generateIS(audioTrack, videoTrack, timeOffset, t0);
      }
      if (this.ISGenerated) {
        //logger.log('nb AVC samples:' + videoTrack.samples.length);
        if (videoTrack.samples.length) {
          this.remuxVideo(videoTrack, timeOffset, contiguous, t0);
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
      }
      //notify end of parsing
      this.observer.trigger(_events2.default.FRAG_PARSED);
    }
  }, {
    key: 'generateIS',
    value: function generateIS(audioTrack, videoTrack, timeOffset, t0) {
      var observer = this.observer,
          audioSamples = audioTrack.samples,
          videoSamples = videoTrack.samples,
          pesTimeScale = this.PES_TIMESCALE,
          tracks = {},
          data = { tracks: tracks, unique: false },
          computePTSDTS = this._initPTS === undefined,
          initPTS,
          initDTS;

      if (computePTSDTS) {
        initPTS = initDTS = Infinity;
      }
      if (audioTrack.config && audioSamples.length) {
        audioTrack.timescale = audioTrack.audiosamplerate;
        // MP4 duration (track duration in seconds multiplied by timescale) is coded on 32 bits
        // we know that each AAC sample contains 1024 frames....
        // in order to avoid overflowing the 32 bit counter for large duration, we use smaller timescale (timescale/gcd)
        // we just need to ensure that AAC sample duration will still be an integer (will be 1024/gcd)
        if (audioTrack.timescale * audioTrack.duration > Math.pow(2, 32)) {
          (function () {
            var greatestCommonDivisor = function greatestCommonDivisor(a, b) {
              if (!b) {
                return a;
              }
              return greatestCommonDivisor(b, a % b);
            };
            audioTrack.timescale = audioTrack.audiosamplerate / greatestCommonDivisor(audioTrack.audiosamplerate, 1024);
          })();
        }
        _logger.logger.log('audio mp4 timescale :' + audioTrack.timescale);
        tracks.audio = {
          container: 'audio/mp4',
          codec: audioTrack.codec,
          initSegment: _mp4Generator2.default.initSegment([audioTrack]),
          metadata: {
            channelCount: audioTrack.channelCount
          }
        };
        if (computePTSDTS) {
          // remember first PTS of this demuxing context. for audio, PTS + DTS ...
          // initPTS = initDTS = audioSamples[0].pts - pesTimeScale * timeOffset;
          initPTS = initDTS = t0 * pesTimeScale;
          // if (timeOffset != t0) debugger;
        }
      }

      if (videoTrack.sps && videoTrack.pps && videoSamples.length) {
        videoTrack.timescale = this.MP4_TIMESCALE;
        tracks.video = {
          container: 'video/mp4',
          codec: videoTrack.codec,
          initSegment: _mp4Generator2.default.initSegment([videoTrack]),
          metadata: {
            width: videoTrack.width,
            height: videoTrack.height
          }
        };
        if (computePTSDTS) {
          initPTS = Math.min(initPTS, videoSamples[0].pts - pesTimeScale * timeOffset);
          initDTS = Math.min(initDTS, videoSamples[0].dts - pesTimeScale * timeOffset);
        }
      }

      if (!Object.keys(tracks)) {
        observer.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.FRAG_PARSING_ERROR, fatal: false, reason: 'no audio/video samples found' });
      } else {
        observer.trigger(_events2.default.FRAG_PARSING_INIT_SEGMENT, data);
        this.ISGenerated = true;
        if (computePTSDTS) {
          // this._initPTS = t0*pesTimeScale;//initPTS;
          // this._initDTS = t0*pesTimeScale;//initDTS;

          console.info("!!");
          this._initPTS = initPTS;
          this._initDTS = initDTS;
          console.info('initPTS: ' + initPTS + ' t0*90000: ' + t0 * 90000);
        }
      }
    }
  }, {
    key: 'remuxVideo',
    value: function remuxVideo(track, timeOffset, contiguous, t0) {
      var offset = 8,
          pesTimeScale = this.PES_TIMESCALE,
          pes2mp4ScaleFactor = this.PES2MP4SCALEFACTOR,
          mp4SampleDuration,
          mdat,
          moof,
          firstPTS,
          firstDTS,
          lastPTS,
          lastDTS,
          inputSamples = track.samples,
          outputSamples = [];

      // PTS is coded on 33bits, and can loop from -2^32 to 2^32
      // PTSNormalize will make PTS/DTS value monotonic, we use last known DTS value as reference value
      var nextAvcDts = void 0;
      if (contiguous) {
        // if parsed fragment is contiguous with last one, let's use last DTS value as reference
        nextAvcDts = this.nextAvcDts;
      } else {
        // if not contiguous, let's use target timeOffset
        nextAvcDts = t0 * pesTimeScale;
      }

      // compute first DTS and last DTS, normalize them against reference value
      var sample = inputSamples[0];
      // firstDTS =  Math.max(this._PTSNormalize(sample.dts,nextAvcDts) - this._initDTS,0);
      // firstPTS =  Math.max(this._PTSNormalize(sample.pts,nextAvcDts) - this._initDTS,0);

      firstDTS = Math.max(this._PTSNormalize(sample.dts, nextAvcDts) - this._initDTS, 0);
      firstPTS = Math.max(this._PTSNormalize(sample.pts, nextAvcDts) - this._initDTS, 0);

      var firstSampleDTS = sample.dts;
      firstPTS = firstDTS = Math.round(t0 * pesTimeScale);
      console.info('firstPTS #1: ' + firstPTS);

      // check timestamp continuity accross consecutive fragments (this is to remove inter-fragment gap/hole)
      //     let delta = Math.round((firstDTS - nextAvcDts) / 90);
      //
      //     // if fragment are contiguous, or delta less than 600ms, ensure there is no overlap/hole between fragments
      //     if (contiguous || Math.abs(delta) < 600) {
      //       if (delta) {
      //         if (delta > 1) {
      //           logger.log(`AVC:${delta} ms hole between fragments detected,filling it`);
      //         } else if (delta < -1) {
      //           logger.log(`AVC:${(-delta)} ms overlapping between fragments detected`);
      //         }
      //         // remove hole/gap : set DTS to next expected DTS
      //         firstDTS = inputSamples[0].dts = nextAvcDts;
      //         // offset PTS as well, ensure that PTS is smaller or equal than new DTS
      //         firstPTS = inputSamples[0].pts = Math.max(firstPTS - delta, nextAvcDts);
      //         logger.log(`Video/PTS/DTS adjusted: ${firstPTS}/${firstDTS},delta:${delta}`);
      //       }
      //     }
      // 	console.info( 'firstPTS #2: ' + firstPTS );

      // sample duration (as expected by trun MP4 boxes), should be the delta between sample DTS
      // let's signal the same sample duration for all samples
      // set this constant duration as being the avg delta between consecutive DTS.
      sample = inputSamples[inputSamples.length - 1];
      lastDTS = Math.max(this._PTSNormalize(sample.dts, nextAvcDts) - this._initDTS, 0);

      lastDTS = sample.dts - firstSampleDTS + firstPTS;
      mp4SampleDuration = Math.round((lastDTS - firstDTS) / (pes2mp4ScaleFactor * (inputSamples.length - 1)));

      if (lastDTS <= firstDTS) {
        debugger;
        lastDTS = firstDTS;
        mp4SampleDuration = 0;
        console.warn('lastDTS < firstDTS');
      };
      console.info('( lastDTS - firstDTS ) / 90000 : ' + (lastDTS - firstDTS) / 90000);
      var oldPTS = firstPTS;
      // firstPTS = firstDTS = Math.round(t0*90000);
      console.log('firstPTS: ' + oldPTS + ' -> ' + t0 * 90000);
      if (Math.abs(oldPTS - firstPTS) > 10000) console.warn('this could have caused a fragLoop error');

      // normalize all PTS/DTS now ...
      for (var i = 0; i < inputSamples.length; i++) {
        var _sample = inputSamples[i];
        // sample DTS is computed using a constant decoding offset (mp4SampleDuration) between samples
        _sample.dts = firstDTS + i * pes2mp4ScaleFactor * mp4SampleDuration;
        // we normalize PTS against nextAvcDts, we also substract initDTS (some streams don't start @ PTS O)
        // and we ensure that computed value is greater or equal than sample DTS
        // sample.pts = Math.max(this._PTSNormalize(sample.pts,nextAvcDts) - this._initDTS, sample.dts);
        _sample.pts = _sample.dts;
      }
      lastPTS = inputSamples[inputSamples.length - 1].pts;

      /* concatenate the video data and construct the mdat in place
        (need 8 more bytes to fill length and mpdat type) */
      mdat = new Uint8Array(track.len + 4 * track.nbNalu + 8);
      var view = new DataView(mdat.buffer);
      view.setUint32(0, mdat.byteLength);
      mdat.set(_mp4Generator2.default.types.mdat, 4);
      while (inputSamples.length) {
        var avcSample = inputSamples.shift(),
            mp4SampleLength = 0;
        // convert NALU bitstream to MP4 format (prepend NALU with size field)
        while (avcSample.units.units.length) {
          var unit = avcSample.units.units.shift();
          view.setUint32(offset, unit.data.byteLength);
          offset += 4;
          mdat.set(unit.data, offset);
          offset += unit.data.byteLength;
          mp4SampleLength += 4 + unit.data.byteLength;
        }
        //console.log('PTS/DTS/initDTS/normPTS/normDTS/relative PTS : ${avcSample.pts}/${avcSample.dts}/${this._initDTS}/${ptsnorm}/${dtsnorm}/${(avcSample.pts/4294967296).toFixed(3)}');
        outputSamples.push({
          size: mp4SampleLength,
          // constant duration
          duration: mp4SampleDuration,
          // set composition time offset as a multiple of sample duration
          cts: Math.max(0, mp4SampleDuration * Math.round((avcSample.pts - avcSample.dts) / (pes2mp4ScaleFactor * mp4SampleDuration))),
          flags: {
            isLeading: 0,
            isDependedOn: 0,
            hasRedundancy: 0,
            degradPrio: 0,
            dependsOn: avcSample.key ? 2 : 1,
            isNonSync: avcSample.key ? 0 : 1
          }
        });
      }
      // next AVC sample DTS should be equal to last sample DTS + last sample duration (in PES timescale)
      this.nextAvcDts = lastDTS + mp4SampleDuration * pes2mp4ScaleFactor;
      track.len = 0;
      track.nbNalu = 0;
      if (outputSamples.length && navigator.userAgent.toLowerCase().indexOf('chrome') > -1) {
        var flags = outputSamples[0].flags;
        // chrome workaround, mark first sample as being a Random Access Point to avoid sourcebuffer append issue
        // https://code.google.com/p/chromium/issues/detail?id=229412
        flags.dependsOn = 2;
        flags.isNonSync = 0;
      }
      track.samples = outputSamples;
      // if (firstDTS/pesTimeScale > 100000) { debugger; }
      moof = _mp4Generator2.default.moof(track.sequenceNumber++, firstDTS / pes2mp4ScaleFactor, track);
      track.samples = [];
      this.observer.trigger(_events2.default.FRAG_PARSING_DATA, {
        data1: moof,
        data2: mdat,
        startPTS: firstPTS / pesTimeScale,
        endPTS: (lastPTS + pes2mp4ScaleFactor * mp4SampleDuration) / pesTimeScale,
        startDTS: firstDTS / pesTimeScale,
        endDTS: this.nextAvcDts / pesTimeScale,
        type: 'video',
        nb: outputSamples.length
      });
    }
  }, {
    key: 'remuxAudio',
    value: function remuxAudio(track, timeOffset, contiguous) {
      var view,
          offset = 8,
          pesTimeScale = this.PES_TIMESCALE,
          expectedSampleDuration = track.timescale * 1024 / track.audiosamplerate,
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

      track.samples.sort(function (a, b) {
        return a.pts - b.pts;
      });
      samples0 = track.samples;

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
          // let's compute sample duration.
          // sample Duration should be close to expectedSampleDuration
          mp4Sample.duration = (dtsnorm - lastDTS) / pes2mp4ScaleFactor;
          if (Math.abs(mp4Sample.duration - expectedSampleDuration) > expectedSampleDuration / 10) {
            // more than 10% diff between sample duration and expectedSampleDuration .... lets log that
            _logger.logger.trace('invalid AAC sample duration at PTS ' + Math.round(pts / 90) + ',should be 1024,found :' + Math.round(mp4Sample.duration * track.audiosamplerate / track.timescale));
          }
          // always adjust sample duration to avoid av sync issue
          mp4Sample.duration = expectedSampleDuration;
          dtsnorm = expectedSampleDuration * pes2mp4ScaleFactor + lastDTS;
        } else {
          var nextAacPts = void 0,
              delta = void 0;
          if (contiguous) {
            nextAacPts = this.nextAacPts;
          } else {
            nextAacPts = timeOffset * pesTimeScale;
          }
          ptsnorm = this._PTSNormalize(pts, nextAacPts);
          dtsnorm = this._PTSNormalize(dts, nextAacPts);
          delta = Math.round(1000 * (ptsnorm - nextAacPts) / pesTimeScale);
          // if fragment are contiguous, or delta less than 600ms, ensure there is no overlap/hole between fragments
          if (contiguous || Math.abs(delta) < 600) {
            // log delta
            if (delta) {
              if (delta > 0) {
                _logger.logger.log(delta + ' ms hole between AAC samples detected,filling it');
                // if we have frame overlap, overlapping for more than half a frame duraion
              } else if (delta < -12) {
                  // drop overlapping audio frames... browser will deal with it
                  _logger.logger.log(-delta + ' ms overlapping between AAC samples detected, drop frame');
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
          if (track.len > 0) {
            /* concatenate the audio data and construct the mdat in place
              (need 8 more bytes to fill length and mdat type) */
            mdat = new Uint8Array(track.len + 8);
            view = new DataView(mdat.buffer);
            view.setUint32(0, mdat.byteLength);
            mdat.set(_mp4Generator2.default.types.mdat, 4);
          } else {
            // no audio samples
            return;
          }
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
        moof = _mp4Generator2.default.moof(track.sequenceNumber++, firstDTS / pes2mp4ScaleFactor, track);
        track.samples = [];
        this.observer.trigger(_events2.default.FRAG_PARSING_DATA, {
          data1: moof,
          data2: mdat,
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
        this.observer.trigger(_events2.default.FRAG_PARSING_METADATA, {
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
        return a.pts - b.pts;
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
        this.observer.trigger(_events2.default.FRAG_PARSING_USERDATA, {
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
    key: 'passthrough',
    get: function get() {
      return false;
    }
  }]);

  return MP4Remuxer;
}();

exports.default = MP4Remuxer;

},{"../errors":20,"../events":22,"../remux/mp4-generator":30,"../utils/logger":36}],32:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * passthrough remuxer
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     */


var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var PassThroughRemuxer = function () {
  function PassThroughRemuxer(observer) {
    _classCallCheck(this, PassThroughRemuxer);

    this.observer = observer;
    this.ISGenerated = false;
  }

  _createClass(PassThroughRemuxer, [{
    key: 'destroy',
    value: function destroy() {}
  }, {
    key: 'insertDiscontinuity',
    value: function insertDiscontinuity() {}
  }, {
    key: 'switchLevel',
    value: function switchLevel() {
      this.ISGenerated = false;
    }
  }, {
    key: 'remux',
    value: function remux(audioTrack, videoTrack, id3Track, textTrack, timeOffset, rawData) {
      var observer = this.observer;
      // generate Init Segment if needed
      if (!this.ISGenerated) {
        var tracks = {},
            data = { tracks: tracks, unique: true },
            track = videoTrack,
            codec = track.codec;

        if (codec) {
          data.tracks.video = {
            container: track.container,
            codec: codec,
            metadata: {
              width: track.width,
              height: track.height
            }
          };
        }

        track = audioTrack;
        codec = track.codec;
        if (codec) {
          data.tracks.audio = {
            container: track.container,
            codec: codec,
            metadata: {
              channelCount: track.channelCount
            }
          };
        }
        this.ISGenerated = true;
        observer.trigger(_events2.default.FRAG_PARSING_INIT_SEGMENT, data);
      }
      observer.trigger(_events2.default.FRAG_PARSING_DATA, {
        data1: rawData,
        startPTS: timeOffset,
        startDTS: timeOffset,
        type: 'audiovideo',
        nb: 1
      });
    }
  }, {
    key: 'passthrough',
    get: function get() {
      return true;
    }
  }]);

  return PassThroughRemuxer;
}();

exports.default = PassThroughRemuxer;

},{"../events":22}],33:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// adapted from https://github.com/kanongil/node-m3u8parse/blob/master/attrlist.js

var AttrList = function () {
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
}();

exports.default = AttrList;

},{}],34:[function(require,module,exports){
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

},{}],35:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/*
 * CEA-708 interpreter
*/

var CEA708Interpreter = function () {
  function CEA708Interpreter() {
    _classCallCheck(this, CEA708Interpreter);
  }

  _createClass(CEA708Interpreter, [{
    key: 'attach',
    value: function attach(media) {
      this.media = media;
      this.display = [];
      this.memory = [];
    }
  }, {
    key: 'detach',
    value: function detach() {
      this.clear();
    }
  }, {
    key: 'destroy',
    value: function destroy() {}
  }, {
    key: '_createCue',
    value: function _createCue() {
      var VTTCue = window.VTTCue || window.TextTrackCue;

      var cue = this.cue = new VTTCue(-1, -1, '');
      cue.text = '';
      cue.pauseOnExit = false;

      // make sure it doesn't show up before it's ready
      cue.startTime = Number.MAX_VALUE;

      // show it 'forever' once we do show it
      // (we'll set the end time once we know it later)
      cue.endTime = Number.MAX_VALUE;

      this.memory.push(cue);
    }
  }, {
    key: 'clear',
    value: function clear() {
      var textTrack = this._textTrack;
      if (textTrack && textTrack.cues) {
        while (textTrack.cues.length > 0) {
          textTrack.removeCue(textTrack.cues[0]);
        }
      }
    }
  }, {
    key: 'push',
    value: function push(timestamp, bytes) {
      if (!this.cue) {
        this._createCue();
      }

      var count = bytes[0] & 31;
      var position = 2;
      var tmpByte, ccbyte1, ccbyte2, ccValid, ccType;

      for (var j = 0; j < count; j++) {
        tmpByte = bytes[position++];
        ccbyte1 = 0x7F & bytes[position++];
        ccbyte2 = 0x7F & bytes[position++];
        ccValid = (4 & tmpByte) === 0 ? false : true;
        ccType = 3 & tmpByte;

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
    value: function _fromCharCode(tmpByte) {
      switch (tmpByte) {
        case 42:
          return 'á';

        case 2:
          return 'á';

        case 2:
          return 'é';

        case 4:
          return 'í';

        case 5:
          return 'ó';

        case 6:
          return 'ú';

        case 3:
          return 'ç';

        case 4:
          return '÷';

        case 5:
          return 'Ñ';

        case 6:
          return 'ñ';

        case 7:
          return '█';

        default:
          return String.fromCharCode(tmpByte);
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

      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = this.memory[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var memoryItem = _step.value;

          memoryItem.startTime = timestamp;
          this._textTrack.addCue(memoryItem);
          this.display.push(memoryItem);
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      this.memory = [];
      this.cue = null;
    }
  }, {
    key: '_clearActiveCues',
    value: function _clearActiveCues(timestamp) {
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = this.display[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var displayItem = _step2.value;

          displayItem.endTime = timestamp;
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return) {
            _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
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
}();

exports.default = CEA708Interpreter;

},{}],36:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

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

var enableLogs = exports.enableLogs = function enableLogs(debugConfig) {
  if (debugConfig === true || (typeof debugConfig === 'undefined' ? 'undefined' : _typeof(debugConfig)) === 'object') {
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

var logger = exports.logger = exportedLogger;

},{}],37:[function(require,module,exports){
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

    var baseURLDomainSplit = /^((([a-z]+):)?\/\/[a-z0-9\.\-_~]+(:[0-9]+)?\/)(.*)$/i.exec(baseURL);
    var baseURLProtocol = baseURLDomainSplit[3];
    var baseURLDomain = baseURLDomainSplit[1];
    var baseURLPath = baseURLDomainSplit[5];

    var builtURL = null;
    if (/^\/\//.test(relativeURL)) {
      builtURL = baseURLProtocol + '://' + URLHelper.buildAbsolutePath('', relativeURL.substring(2));
    } else if (/^\//.test(relativeURL)) {
      builtURL = baseURLDomain + URLHelper.buildAbsolutePath('', relativeURL.substring(1));
    } else {
      builtURL = URLHelper.buildAbsolutePath(baseURLDomain + baseURLPath, relativeURL);
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

},{}],38:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * XHR based logger
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     */

var _logger = require('../utils/logger');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var XhrLoader = function () {
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
      this.timeoutHandle = window.setTimeout(this.loadtimeout.bind(this), this.timeout);
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
            _logger.logger.warn(status + ' while loading ' + this.url + ', retrying in ' + this.retryDelay + '...');
            this.destroy();
            window.setTimeout(this.loadInternal.bind(this), this.retryDelay);
            // exponential backoff
            this.retryDelay = Math.min(2 * this.retryDelay, 64000);
            stats.retry++;
          } else {
            window.clearTimeout(this.timeoutHandle);
            _logger.logger.error(status + ' while loading ' + this.url);
            this.onError(event);
          }
        }
      }
    }
  }, {
    key: 'loadtimeout',
    value: function loadtimeout(event) {
      _logger.logger.warn('timeout while loading ' + this.url);
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
}();

exports.default = XhrLoader;

},{"../utils/logger":36}]},{},[26])(26)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy93ZWJ3b3JraWZ5L2luZGV4LmpzIiwic3JjL2NvbnRyb2xsZXIvYWJyLWNvbnRyb2xsZXIuanMiLCJzcmMvY29udHJvbGxlci9idWZmZXItY29udHJvbGxlci5qcyIsInNyYy9jb250cm9sbGVyL2NhcC1sZXZlbC1jb250cm9sbGVyLmpzIiwic3JjL2NvbnRyb2xsZXIvbGV2ZWwtY29udHJvbGxlci5qcyIsInNyYy9jb250cm9sbGVyL3N0cmVhbS1jb250cm9sbGVyLmpzIiwic3JjL2NvbnRyb2xsZXIvdGltZWxpbmUtY29udHJvbGxlci5qcyIsInNyYy9jcnlwdC9hZXMuanMiLCJzcmMvY3J5cHQvYWVzMTI4LWRlY3J5cHRlci5qcyIsInNyYy9jcnlwdC9kZWNyeXB0ZXIuanMiLCJzcmMvZGVtdXgvYWFjZGVtdXhlci5qcyIsInNyYy9kZW11eC9hZHRzLmpzIiwic3JjL2RlbXV4L2RlbXV4ZXItaW5saW5lLmpzIiwic3JjL2RlbXV4L2RlbXV4ZXItd29ya2VyLmpzIiwic3JjL2RlbXV4L2RlbXV4ZXIuanMiLCJzcmMvZGVtdXgvZXhwLWdvbG9tYi5qcyIsInNyYy9kZW11eC9pZDMuanMiLCJzcmMvZGVtdXgvdHNkZW11eGVyLmpzIiwic3JjL2Vycm9ycy5qcyIsInNyYy9ldmVudC1oYW5kbGVyLmpzIiwic3JjL2V2ZW50cy5qcyIsInNyYy9oZWxwZXIvYnVmZmVyLWhlbHBlci5qcyIsInNyYy9oZWxwZXIvbGV2ZWwtaGVscGVyLmpzIiwic3JjL2hscy5qcyIsInNyYy9pbmRleC5qcyIsInNyYy9sb2FkZXIvZnJhZ21lbnQtbG9hZGVyLmpzIiwic3JjL2xvYWRlci9rZXktbG9hZGVyLmpzIiwic3JjL2xvYWRlci9wbGF5bGlzdC1sb2FkZXIuanMiLCJzcmMvcmVtdXgvbXA0LWdlbmVyYXRvci5qcyIsInNyYy9yZW11eC9tcDQtcmVtdXhlci5qcyIsInNyYy9yZW11eC9wYXNzdGhyb3VnaC1yZW11eGVyLmpzIiwic3JjL3V0aWxzL2F0dHItbGlzdC5qcyIsInNyYy91dGlscy9iaW5hcnktc2VhcmNoLmpzIiwic3JjL3V0aWxzL2NlYS03MDgtaW50ZXJwcmV0ZXIuanMiLCJzcmMvdXRpbHMvbG9nZ2VyLmpzIiwic3JjL3V0aWxzL3VybC5qcyIsInNyYy91dGlscy94aHItbG9hZGVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxU0E7QUFDQTtB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O0FBRS9CLGlCQUFLLE9BQUwsR0FGK0I7QUFHL0IsbUJBQU8sVUFBUCxDQUFrQixLQUFLLFlBQUwsQ0FBa0IsSUFBbEIsQ0FBdUIsSUFBdkIsQ0FBbEIsRUFBZ0QsS0FBSyxVQUFMLENBQWhEOztBQUgrQixnQkFLL0IsQ0FBSyxVQUFMLEdBQWtCLEtBQUssR0FBTCxDQUFTLElBQUksS0FBSyxVQUFMLEVBQWlCLEtBQTlCLENBQWxCLENBTCtCO0FBTS9CLGtCQUFNLEtBQU4sR0FOK0I7V0FBakMsTUFPTztBQUNMLG1CQUFPLFlBQVAsQ0FBb0IsS0FBSyxhQUFMLENBQXBCLENBREs7QUFFTCwyQkFBTyxLQUFQLENBQWdCLDZCQUF3QixLQUFLLEdBQUwsQ0FBeEMsQ0FGSztBQUdMLGlCQUFLLE9BQUwsQ0FBYSxLQUFiLEVBSEs7V0FQUDtTQU5BO09BRko7Ozs7Z0NBd0JVLE9BQU87QUFDakIscUJBQU8sSUFBUCw0QkFBcUMsS0FBSyxHQUFMLENBQXJDLENBRGlCO0FBRWpCLFdBQUssU0FBTCxDQUFlLEtBQWYsRUFBc0IsS0FBSyxLQUFMLENBQXRCLENBRmlCOzs7O2lDQUtOLE9BQU87QUFDbEIsVUFBSSxRQUFRLEtBQUssS0FBTCxDQURNO0FBRWxCLFVBQUksTUFBTSxNQUFOLEtBQWlCLElBQWpCLEVBQXVCO0FBQ3pCLGNBQU0sTUFBTixHQUFlLFlBQVksR0FBWixFQUFmLENBRHlCO09BQTNCO0FBR0EsWUFBTSxNQUFOLEdBQWUsTUFBTSxNQUFOLENBTEc7QUFNbEIsVUFBSSxLQUFLLFVBQUwsRUFBaUI7QUFDbkIsYUFBSyxVQUFMLENBQWdCLEtBQWhCLEVBQXVCLEtBQXZCLEVBRG1CO09BQXJCOzs7O1NBNUdFOzs7a0JBa0hTIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9XG4gICAgICB0aHJvdyBUeXBlRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuJyk7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICBoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChpc09iamVjdChoYW5kbGVyKSkge1xuICAgIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIGxpc3RlbmVycyA9IGhhbmRsZXIuc2xpY2UoKTtcbiAgICBsZW4gPSBsaXN0ZW5lcnMubGVuZ3RoO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIGxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBtO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBUbyBhdm9pZCByZWN1cnNpb24gaW4gdGhlIGNhc2UgdGhhdCB0eXBlID09PSBcIm5ld0xpc3RlbmVyXCIhIEJlZm9yZVxuICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyXCIuXG4gIGlmICh0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpXG4gICAgdGhpcy5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsXG4gICAgICAgICAgICAgIGlzRnVuY3Rpb24obGlzdGVuZXIubGlzdGVuZXIpID9cbiAgICAgICAgICAgICAgbGlzdGVuZXIubGlzdGVuZXIgOiBsaXN0ZW5lcik7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgLy8gT3B0aW1pemUgdGhlIGNhc2Ugb2Ygb25lIGxpc3RlbmVyLiBEb24ndCBuZWVkIHRoZSBleHRyYSBhcnJheSBvYmplY3QuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbGlzdGVuZXI7XG4gIGVsc2UgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcbiAgZWxzZVxuICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV0sIGxpc3RlbmVyXTtcblxuICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xuICBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSAmJiAhdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCkge1xuICAgIGlmICghaXNVbmRlZmluZWQodGhpcy5fbWF4TGlzdGVuZXJzKSkge1xuICAgICAgbSA9IHRoaXMuX21heExpc3RlbmVycztcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IEV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzO1xuICAgIH1cblxuICAgIGlmIChtICYmIG0gPiAwICYmIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGggPiBtKSB7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkID0gdHJ1ZTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO1xuICAgICAgaWYgKHR5cGVvZiBjb25zb2xlLnRyYWNlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIC8vIG5vdCBzdXBwb3J0ZWQgaW4gSUUgMTBcbiAgICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICB2YXIgZmlyZWQgPSBmYWxzZTtcblxuICBmdW5jdGlvbiBnKCkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgZyk7XG5cbiAgICBpZiAoIWZpcmVkKSB7XG4gICAgICBmaXJlZCA9IHRydWU7XG4gICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgfVxuXG4gIGcubGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgdGhpcy5vbih0eXBlLCBnKTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIGVtaXRzIGEgJ3JlbW92ZUxpc3RlbmVyJyBldmVudCBpZmYgdGhlIGxpc3RlbmVyIHdhcyByZW1vdmVkXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIGxpc3QsIHBvc2l0aW9uLCBsZW5ndGgsIGk7XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgbGlzdCA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgbGVuZ3RoID0gbGlzdC5sZW5ndGg7XG4gIHBvc2l0aW9uID0gLTE7XG5cbiAgaWYgKGxpc3QgPT09IGxpc3RlbmVyIHx8XG4gICAgICAoaXNGdW5jdGlvbihsaXN0Lmxpc3RlbmVyKSAmJiBsaXN0Lmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuXG4gIH0gZWxzZSBpZiAoaXNPYmplY3QobGlzdCkpIHtcbiAgICBmb3IgKGkgPSBsZW5ndGg7IGktLSA+IDA7KSB7XG4gICAgICBpZiAobGlzdFtpXSA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgICAobGlzdFtpXS5saXN0ZW5lciAmJiBsaXN0W2ldLmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgcG9zaXRpb24gPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9zaXRpb24gPCAwKVxuICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICAgIGxpc3QubGVuZ3RoID0gMDtcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3Quc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBrZXksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICByZXR1cm4gdGhpcztcblxuICAvLyBub3QgbGlzdGVuaW5nIGZvciByZW1vdmVMaXN0ZW5lciwgbm8gbmVlZCB0byBlbWl0XG4gIGlmICghdGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApXG4gICAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICBlbHNlIGlmICh0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gZW1pdCByZW1vdmVMaXN0ZW5lciBmb3IgYWxsIGxpc3RlbmVycyBvbiBhbGwgZXZlbnRzXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgZm9yIChrZXkgaW4gdGhpcy5fZXZlbnRzKSB7XG4gICAgICBpZiAoa2V5ID09PSAncmVtb3ZlTGlzdGVuZXInKSBjb250aW51ZTtcbiAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKGtleSk7XG4gICAgfVxuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdyZW1vdmVMaXN0ZW5lcicpO1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgbGlzdGVuZXJzID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGxpc3RlbmVycykpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVycyk7XG4gIH0gZWxzZSBpZiAobGlzdGVuZXJzKSB7XG4gICAgLy8gTElGTyBvcmRlclxuICAgIHdoaWxlIChsaXN0ZW5lcnMubGVuZ3RoKVxuICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnNbbGlzdGVuZXJzLmxlbmd0aCAtIDFdKTtcbiAgfVxuICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gW107XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24odGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcbiAgZWxzZVxuICAgIHJldCA9IHRoaXMuX2V2ZW50c1t0eXBlXS5zbGljZSgpO1xuICByZXR1cm4gcmV0O1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24odHlwZSkge1xuICBpZiAodGhpcy5fZXZlbnRzKSB7XG4gICAgdmFyIGV2bGlzdGVuZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgICBpZiAoaXNGdW5jdGlvbihldmxpc3RlbmVyKSlcbiAgICAgIHJldHVybiAxO1xuICAgIGVsc2UgaWYgKGV2bGlzdGVuZXIpXG4gICAgICByZXR1cm4gZXZsaXN0ZW5lci5sZW5ndGg7XG4gIH1cbiAgcmV0dXJuIDA7XG59O1xuXG5FdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgcmV0dXJuIGVtaXR0ZXIubGlzdGVuZXJDb3VudCh0eXBlKTtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbiIsInZhciBidW5kbGVGbiA9IGFyZ3VtZW50c1szXTtcbnZhciBzb3VyY2VzID0gYXJndW1lbnRzWzRdO1xudmFyIGNhY2hlID0gYXJndW1lbnRzWzVdO1xuXG52YXIgc3RyaW5naWZ5ID0gSlNPTi5zdHJpbmdpZnk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGZuKSB7XG4gICAgdmFyIGtleXMgPSBbXTtcbiAgICB2YXIgd2tleTtcbiAgICB2YXIgY2FjaGVLZXlzID0gT2JqZWN0LmtleXMoY2FjaGUpO1xuXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSBjYWNoZUtleXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIHZhciBrZXkgPSBjYWNoZUtleXNbaV07XG4gICAgICAgIHZhciBleHAgPSBjYWNoZVtrZXldLmV4cG9ydHM7XG4gICAgICAgIC8vIFVzaW5nIGJhYmVsIGFzIGEgdHJhbnNwaWxlciB0byB1c2UgZXNtb2R1bGUsIHRoZSBleHBvcnQgd2lsbCBhbHdheXNcbiAgICAgICAgLy8gYmUgYW4gb2JqZWN0IHdpdGggdGhlIGRlZmF1bHQgZXhwb3J0IGFzIGEgcHJvcGVydHkgb2YgaXQuIFRvIGVuc3VyZVxuICAgICAgICAvLyB0aGUgZXhpc3RpbmcgYXBpIGFuZCBiYWJlbCBlc21vZHVsZSBleHBvcnRzIGFyZSBib3RoIHN1cHBvcnRlZCB3ZVxuICAgICAgICAvLyBjaGVjayBmb3IgYm90aFxuICAgICAgICBpZiAoZXhwID09PSBmbiB8fCBleHAuZGVmYXVsdCA9PT0gZm4pIHtcbiAgICAgICAgICAgIHdrZXkgPSBrZXk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmICghd2tleSkge1xuICAgICAgICB3a2V5ID0gTWF0aC5mbG9vcihNYXRoLnBvdygxNiwgOCkgKiBNYXRoLnJhbmRvbSgpKS50b1N0cmluZygxNik7XG4gICAgICAgIHZhciB3Y2FjaGUgPSB7fTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBjYWNoZUtleXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIga2V5ID0gY2FjaGVLZXlzW2ldO1xuICAgICAgICAgICAgd2NhY2hlW2tleV0gPSBrZXk7XG4gICAgICAgIH1cbiAgICAgICAgc291cmNlc1t3a2V5XSA9IFtcbiAgICAgICAgICAgIEZ1bmN0aW9uKFsncmVxdWlyZScsJ21vZHVsZScsJ2V4cG9ydHMnXSwgJygnICsgZm4gKyAnKShzZWxmKScpLFxuICAgICAgICAgICAgd2NhY2hlXG4gICAgICAgIF07XG4gICAgfVxuICAgIHZhciBza2V5ID0gTWF0aC5mbG9vcihNYXRoLnBvdygxNiwgOCkgKiBNYXRoLnJhbmRvbSgpKS50b1N0cmluZygxNik7XG5cbiAgICB2YXIgc2NhY2hlID0ge307IHNjYWNoZVt3a2V5XSA9IHdrZXk7XG4gICAgc291cmNlc1tza2V5XSA9IFtcbiAgICAgICAgRnVuY3Rpb24oWydyZXF1aXJlJ10sIChcbiAgICAgICAgICAgIC8vIHRyeSB0byBjYWxsIGRlZmF1bHQgaWYgZGVmaW5lZCB0byBhbHNvIHN1cHBvcnQgYmFiZWwgZXNtb2R1bGVcbiAgICAgICAgICAgIC8vIGV4cG9ydHNcbiAgICAgICAgICAgICd2YXIgZiA9IHJlcXVpcmUoJyArIHN0cmluZ2lmeSh3a2V5KSArICcpOycgK1xuICAgICAgICAgICAgJyhmLmRlZmF1bHQgPyBmLmRlZmF1bHQgOiBmKShzZWxmKTsnXG4gICAgICAgICkpLFxuICAgICAgICBzY2FjaGVcbiAgICBdO1xuXG4gICAgdmFyIHNyYyA9ICcoJyArIGJ1bmRsZUZuICsgJykoeydcbiAgICAgICAgKyBPYmplY3Qua2V5cyhzb3VyY2VzKS5tYXAoZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgcmV0dXJuIHN0cmluZ2lmeShrZXkpICsgJzpbJ1xuICAgICAgICAgICAgICAgICsgc291cmNlc1trZXldWzBdXG4gICAgICAgICAgICAgICAgKyAnLCcgKyBzdHJpbmdpZnkoc291cmNlc1trZXldWzFdKSArICddJ1xuICAgICAgICAgICAgO1xuICAgICAgICB9KS5qb2luKCcsJylcbiAgICAgICAgKyAnfSx7fSxbJyArIHN0cmluZ2lmeShza2V5KSArICddKSdcbiAgICA7XG5cbiAgICB2YXIgVVJMID0gd2luZG93LlVSTCB8fCB3aW5kb3cud2Via2l0VVJMIHx8IHdpbmRvdy5tb3pVUkwgfHwgd2luZG93Lm1zVVJMO1xuXG4gICAgcmV0dXJuIG5ldyBXb3JrZXIoVVJMLmNyZWF0ZU9iamVjdFVSTChcbiAgICAgICAgbmV3IEJsb2IoW3NyY10sIHsgdHlwZTogJ3RleHQvamF2YXNjcmlwdCcgfSlcbiAgICApKTtcbn07XG4iLCIvKlxuICogc2ltcGxlIEFCUiBDb250cm9sbGVyXG4gKiAgLSBjb21wdXRlIG5leHQgbGV2ZWwgYmFzZWQgb24gbGFzdCBmcmFnbWVudCBidyBoZXVyaXN0aWNzXG4gKiAgLSBpbXBsZW1lbnQgYW4gYWJhbmRvbiBydWxlcyB0cmlnZ2VyZWQgaWYgd2UgaGF2ZSBsZXNzIHRoYW4gMiBmcmFnIGJ1ZmZlcmVkIGFuZCBpZiBjb21wdXRlZCBidyBzaG93cyB0aGF0IHdlIHJpc2sgYnVmZmVyIHN0YWxsaW5nXG4gKi9cblxuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgRXZlbnRIYW5kbGVyIGZyb20gJy4uL2V2ZW50LWhhbmRsZXInO1xuaW1wb3J0IEJ1ZmZlckhlbHBlciBmcm9tICcuLi9oZWxwZXIvYnVmZmVyLWhlbHBlcic7XG5pbXBvcnQge0Vycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG5jbGFzcyBBYnJDb250cm9sbGVyIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMpIHtcbiAgICBzdXBlcihobHMsIEV2ZW50LkZSQUdfTE9BRElORyxcbiAgICAgICAgICAgICAgIEV2ZW50LkZSQUdfTE9BRF9QUk9HUkVTUyxcbiAgICAgICAgICAgICAgIEV2ZW50LkZSQUdfTE9BREVELFxuICAgICAgICAgICAgICAgRXZlbnQuRVJST1IpO1xuICAgIHRoaXMubGFzdGZldGNobGV2ZWwgPSAwO1xuICAgIHRoaXMuX2F1dG9MZXZlbENhcHBpbmcgPSAtMTtcbiAgICB0aGlzLl9uZXh0QXV0b0xldmVsID0gLTE7XG4gICAgdGhpcy5obHMgPSBobHM7XG4gICAgdGhpcy5vbkNoZWNrID0gdGhpcy5hYmFuZG9uUnVsZXNDaGVjay5iaW5kKHRoaXMpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLmNsZWFyVGltZXIoKTtcbiAgICBFdmVudEhhbmRsZXIucHJvdG90eXBlLmRlc3Ryb3kuY2FsbCh0aGlzKTtcbiAgfVxuXG4gIG9uRnJhZ0xvYWRpbmcoZGF0YSkge1xuICAgIHRoaXMudGltZXIgPSBzZXRJbnRlcnZhbCh0aGlzLm9uQ2hlY2ssIDEwMCk7XG4gICAgdGhpcy5mcmFnQ3VycmVudCA9IGRhdGEuZnJhZztcbiAgfVxuXG4gIG9uRnJhZ0xvYWRQcm9ncmVzcyhkYXRhKSB7XG4gICAgdmFyIHN0YXRzID0gZGF0YS5zdGF0cztcbiAgICAvLyBvbmx5IHVwZGF0ZSBzdGF0cyBpZiBmaXJzdCBmcmFnIGxvYWRpbmdcbiAgICAvLyBpZiBzYW1lIGZyYWcgaXMgbG9hZGVkIG11bHRpcGxlIHRpbWVzLCBpdCBtaWdodCBiZSBpbiBicm93c2VyIGNhY2hlLCBhbmQgbG9hZGVkIHF1aWNrbHlcbiAgICAvLyBhbmQgbGVhZGluZyB0byB3cm9uZyBidyBlc3RpbWF0aW9uXG4gICAgaWYgKHN0YXRzLmFib3J0ZWQgPT09IHVuZGVmaW5lZCAmJiBkYXRhLmZyYWcubG9hZENvdW50ZXIgPT09IDEpIHtcbiAgICAgIHRoaXMubGFzdGZldGNoZHVyYXRpb24gPSAocGVyZm9ybWFuY2Uubm93KCkgLSBzdGF0cy50cmVxdWVzdCkgLyAxMDAwO1xuICAgICAgdGhpcy5sYXN0ZmV0Y2hsZXZlbCA9IGRhdGEuZnJhZy5sZXZlbDtcbiAgICAgIHRoaXMubGFzdGJ3ID0gKHN0YXRzLmxvYWRlZCAqIDgpIC8gdGhpcy5sYXN0ZmV0Y2hkdXJhdGlvbjtcbiAgICAgIC8vY29uc29sZS5sb2coYGZldGNoRHVyYXRpb246JHt0aGlzLmxhc3RmZXRjaGR1cmF0aW9ufSxidzokeyh0aGlzLmxhc3Ridy8xMDAwKS50b0ZpeGVkKDApfS8ke3N0YXRzLmFib3J0ZWR9YCk7XG4gICAgfVxuICB9XG5cbiAgYWJhbmRvblJ1bGVzQ2hlY2soKSB7XG4gICAgLypcbiAgICAgIG1vbml0b3IgZnJhZ21lbnQgcmV0cmlldmFsIHRpbWUuLi5cbiAgICAgIHdlIGNvbXB1dGUgZXhwZWN0ZWQgdGltZSBvZiBhcnJpdmFsIG9mIHRoZSBjb21wbGV0ZSBmcmFnbWVudC5cbiAgICAgIHdlIGNvbXBhcmUgaXQgdG8gZXhwZWN0ZWQgdGltZSBvZiBidWZmZXIgc3RhcnZhdGlvblxuICAgICovXG4gICAgbGV0IGhscyA9IHRoaXMuaGxzLCB2ID0gaGxzLm1lZGlhLGZyYWcgPSB0aGlzLmZyYWdDdXJyZW50O1xuICAgIC8qIG9ubHkgbW9uaXRvciBmcmFnIHJldHJpZXZhbCB0aW1lIGlmXG4gICAgKHZpZGVvIG5vdCBwYXVzZWQgT1IgZmlyc3QgZnJhZ21lbnQgYmVpbmcgbG9hZGVkKHJlYWR5IHN0YXRlID09PSBIQVZFX05PVEhJTkcgPSAwKSkgQU5EIGF1dG9zd2l0Y2hpbmcgZW5hYmxlZCBBTkQgbm90IGxvd2VzdCBsZXZlbCAoPT4gbWVhbnMgdGhhdCB3ZSBoYXZlIHNldmVyYWwgbGV2ZWxzKSAqL1xuICAgIGlmICh2ICYmICghdi5wYXVzZWQgfHwgIXYucmVhZHlTdGF0ZSkgJiYgZnJhZy5hdXRvTGV2ZWwgJiYgZnJhZy5sZXZlbCkge1xuICAgICAgbGV0IHJlcXVlc3REZWxheSA9IHBlcmZvcm1hbmNlLm5vdygpIC0gZnJhZy50cmVxdWVzdDtcbiAgICAgIC8vIG1vbml0b3IgZnJhZ21lbnQgbG9hZCBwcm9ncmVzcyBhZnRlciBoYWxmIG9mIGV4cGVjdGVkIGZyYWdtZW50IGR1cmF0aW9uLHRvIHN0YWJpbGl6ZSBiaXRyYXRlXG4gICAgICBpZiAocmVxdWVzdERlbGF5ID4gKDUwMCAqIGZyYWcuZHVyYXRpb24pKSB7XG4gICAgICAgIGxldCBsb2FkUmF0ZSA9IE1hdGgubWF4KDEsZnJhZy5sb2FkZWQgKiAxMDAwIC8gcmVxdWVzdERlbGF5KTsgLy8gYnl0ZS9zOyBhdCBsZWFzdCAxIGJ5dGUvcyB0byBhdm9pZCBkaXZpc2lvbiBieSB6ZXJvXG4gICAgICAgIGlmIChmcmFnLmV4cGVjdGVkTGVuIDwgZnJhZy5sb2FkZWQpIHtcbiAgICAgICAgICBmcmFnLmV4cGVjdGVkTGVuID0gZnJhZy5sb2FkZWQ7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IHBvcyA9IHYuY3VycmVudFRpbWU7XG4gICAgICAgIGxldCBmcmFnTG9hZGVkRGVsYXkgPSAoZnJhZy5leHBlY3RlZExlbiAtIGZyYWcubG9hZGVkKSAvIGxvYWRSYXRlO1xuICAgICAgICBsZXQgYnVmZmVyU3RhcnZhdGlvbkRlbGF5ID0gQnVmZmVySGVscGVyLmJ1ZmZlckluZm8odixwb3MsaGxzLmNvbmZpZy5tYXhCdWZmZXJIb2xlKS5lbmQgLSBwb3M7XG4gICAgICAgIC8vIGNvbnNpZGVyIGVtZXJnZW5jeSBzd2l0Y2ggZG93biBvbmx5IGlmIHdlIGhhdmUgbGVzcyB0aGFuIDIgZnJhZyBidWZmZXJlZCBBTkRcbiAgICAgICAgLy8gdGltZSB0byBmaW5pc2ggbG9hZGluZyBjdXJyZW50IGZyYWdtZW50IGlzIGJpZ2dlciB0aGFuIGJ1ZmZlciBzdGFydmF0aW9uIGRlbGF5XG4gICAgICAgIC8vIGllIGlmIHdlIHJpc2sgYnVmZmVyIHN0YXJ2YXRpb24gaWYgYncgZG9lcyBub3QgaW5jcmVhc2UgcXVpY2tseVxuICAgICAgICBpZiAoYnVmZmVyU3RhcnZhdGlvbkRlbGF5IDwgMipmcmFnLmR1cmF0aW9uICYmIGZyYWdMb2FkZWREZWxheSA+IGJ1ZmZlclN0YXJ2YXRpb25EZWxheSkge1xuICAgICAgICAgIGxldCBmcmFnTGV2ZWxOZXh0TG9hZGVkRGVsYXksIG5leHRMb2FkTGV2ZWw7XG4gICAgICAgICAgLy8gbGV0cyBpdGVyYXRlIHRocm91Z2ggbG93ZXIgbGV2ZWwgYW5kIHRyeSB0byBmaW5kIHRoZSBiaWdnZXN0IG9uZSB0aGF0IGNvdWxkIGF2b2lkIHJlYnVmZmVyaW5nXG4gICAgICAgICAgLy8gd2Ugc3RhcnQgZnJvbSBjdXJyZW50IGxldmVsIC0gMSBhbmQgd2Ugc3RlcCBkb3duICwgdW50aWwgd2UgZmluZCBhIG1hdGNoaW5nIGxldmVsXG4gICAgICAgICAgZm9yIChuZXh0TG9hZExldmVsID0gZnJhZy5sZXZlbCAtIDEgOyBuZXh0TG9hZExldmVsID49MCA7IG5leHRMb2FkTGV2ZWwtLSkge1xuICAgICAgICAgICAgLy8gY29tcHV0ZSB0aW1lIHRvIGxvYWQgbmV4dCBmcmFnbWVudCBhdCBsb3dlciBsZXZlbFxuICAgICAgICAgICAgLy8gMC44IDogY29uc2lkZXIgb25seSA4MCUgb2YgY3VycmVudCBidyB0byBiZSBjb25zZXJ2YXRpdmVcbiAgICAgICAgICAgIC8vIDggPSBiaXRzIHBlciBieXRlIChicHMvQnBzKVxuICAgICAgICAgICAgZnJhZ0xldmVsTmV4dExvYWRlZERlbGF5ID0gZnJhZy5kdXJhdGlvbiAqIGhscy5sZXZlbHNbbmV4dExvYWRMZXZlbF0uYml0cmF0ZSAvICg4ICogMC44ICogbG9hZFJhdGUpO1xuICAgICAgICAgICAgbG9nZ2VyLmxvZyhgZnJhZ0xvYWRlZERlbGF5L2J1ZmZlclN0YXJ2YXRpb25EZWxheS9mcmFnTGV2ZWxOZXh0TG9hZGVkRGVsYXlbJHtuZXh0TG9hZExldmVsfV0gOiR7ZnJhZ0xvYWRlZERlbGF5LnRvRml4ZWQoMSl9LyR7YnVmZmVyU3RhcnZhdGlvbkRlbGF5LnRvRml4ZWQoMSl9LyR7ZnJhZ0xldmVsTmV4dExvYWRlZERlbGF5LnRvRml4ZWQoMSl9YCk7XG4gICAgICAgICAgICBpZiAoZnJhZ0xldmVsTmV4dExvYWRlZERlbGF5IDwgYnVmZmVyU3RhcnZhdGlvbkRlbGF5KSB7XG4gICAgICAgICAgICAgIC8vIHdlIGZvdW5kIGEgbG93ZXIgbGV2ZWwgdGhhdCBiZSByZWJ1ZmZlcmluZyBmcmVlIHdpdGggY3VycmVudCBlc3RpbWF0ZWQgYncgIVxuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gb25seSBlbWVyZ2VuY3kgc3dpdGNoIGRvd24gaWYgaXQgdGFrZXMgbGVzcyB0aW1lIHRvIGxvYWQgbmV3IGZyYWdtZW50IGF0IGxvd2VzdCBsZXZlbCBpbnN0ZWFkXG4gICAgICAgICAgLy8gb2YgZmluaXNoaW5nIGxvYWRpbmcgY3VycmVudCBvbmUgLi4uXG4gICAgICAgICAgaWYgKGZyYWdMZXZlbE5leHRMb2FkZWREZWxheSA8IGZyYWdMb2FkZWREZWxheSkge1xuICAgICAgICAgICAgLy8gZW5zdXJlIG5leHRMb2FkTGV2ZWwgaXMgbm90IG5lZ2F0aXZlXG4gICAgICAgICAgICBuZXh0TG9hZExldmVsID0gTWF0aC5tYXgoMCxuZXh0TG9hZExldmVsKTtcbiAgICAgICAgICAgIC8vIGZvcmNlIG5leHQgbG9hZCBsZXZlbCBpbiBhdXRvIG1vZGVcbiAgICAgICAgICAgIGhscy5uZXh0TG9hZExldmVsID0gbmV4dExvYWRMZXZlbDtcbiAgICAgICAgICAgIC8vIGFib3J0IGZyYWdtZW50IGxvYWRpbmcgLi4uXG4gICAgICAgICAgICBsb2dnZXIud2FybihgbG9hZGluZyB0b28gc2xvdywgYWJvcnQgZnJhZ21lbnQgbG9hZGluZyBhbmQgc3dpdGNoIHRvIGxldmVsICR7bmV4dExvYWRMZXZlbH1gKTtcbiAgICAgICAgICAgIC8vYWJvcnQgZnJhZ21lbnQgbG9hZGluZ1xuICAgICAgICAgICAgZnJhZy5sb2FkZXIuYWJvcnQoKTtcbiAgICAgICAgICAgIHRoaXMuY2xlYXJUaW1lcigpO1xuICAgICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuRlJBR19MT0FEX0VNRVJHRU5DWV9BQk9SVEVELCB7ZnJhZzogZnJhZ30pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIG9uRnJhZ0xvYWRlZCgpIHtcbiAgICAvLyBzdG9wIG1vbml0b3JpbmcgYncgb25jZSBmcmFnIGxvYWRlZFxuICAgIHRoaXMuY2xlYXJUaW1lcigpO1xuICB9XG5cbiAgb25FcnJvcihkYXRhKSB7XG4gICAgLy8gc3RvcCB0aW1lciBpbiBjYXNlIG9mIGZyYWcgbG9hZGluZyBlcnJvclxuICAgIHN3aXRjaChkYXRhLmRldGFpbHMpIHtcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9FUlJPUjpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9USU1FT1VUOlxuICAgICAgICB0aGlzLmNsZWFyVGltZXIoKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuIGNsZWFyVGltZXIoKSB7XG4gICAgaWYgKHRoaXMudGltZXIpIHtcbiAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy50aW1lcik7XG4gICAgICB0aGlzLnRpbWVyID0gbnVsbDtcbiAgICB9XG4gfVxuXG4gIC8qKiBSZXR1cm4gdGhlIGNhcHBpbmcvbWF4IGxldmVsIHZhbHVlIHRoYXQgY291bGQgYmUgdXNlZCBieSBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uIGFsZ29yaXRobSAqKi9cbiAgZ2V0IGF1dG9MZXZlbENhcHBpbmcoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2F1dG9MZXZlbENhcHBpbmc7XG4gIH1cblxuICAvKiogc2V0IHRoZSBjYXBwaW5nL21heCBsZXZlbCB2YWx1ZSB0aGF0IGNvdWxkIGJlIHVzZWQgYnkgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBhbGdvcml0aG0gKiovXG4gIHNldCBhdXRvTGV2ZWxDYXBwaW5nKG5ld0xldmVsKSB7XG4gICAgdGhpcy5fYXV0b0xldmVsQ2FwcGluZyA9IG5ld0xldmVsO1xuICB9XG5cbiAgZ2V0IG5leHRBdXRvTGV2ZWwoKSB7XG4gICAgdmFyIGxhc3RidyA9IHRoaXMubGFzdGJ3LCBobHMgPSB0aGlzLmhscyxhZGp1c3RlZGJ3LCBpLCBtYXhBdXRvTGV2ZWw7XG4gICAgaWYgKHRoaXMuX2F1dG9MZXZlbENhcHBpbmcgPT09IC0xKSB7XG4gICAgICBtYXhBdXRvTGV2ZWwgPSBobHMubGV2ZWxzLmxlbmd0aCAtIDE7XG4gICAgfSBlbHNlIHtcbiAgICAgIG1heEF1dG9MZXZlbCA9IHRoaXMuX2F1dG9MZXZlbENhcHBpbmc7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX25leHRBdXRvTGV2ZWwgIT09IC0xKSB7XG4gICAgICB2YXIgbmV4dExldmVsID0gTWF0aC5taW4odGhpcy5fbmV4dEF1dG9MZXZlbCxtYXhBdXRvTGV2ZWwpO1xuICAgICAgaWYgKG5leHRMZXZlbCA9PT0gdGhpcy5sYXN0ZmV0Y2hsZXZlbCkge1xuICAgICAgICB0aGlzLl9uZXh0QXV0b0xldmVsID0gLTE7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gbmV4dExldmVsO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGZvbGxvdyBhbGdvcml0aG0gY2FwdHVyZWQgZnJvbSBzdGFnZWZyaWdodCA6XG4gICAgLy8gaHR0cHM6Ly9hbmRyb2lkLmdvb2dsZXNvdXJjZS5jb20vcGxhdGZvcm0vZnJhbWV3b3Jrcy9hdi8rL21hc3Rlci9tZWRpYS9saWJzdGFnZWZyaWdodC9odHRwbGl2ZS9MaXZlU2Vzc2lvbi5jcHBcbiAgICAvLyBQaWNrIHRoZSBoaWdoZXN0IGJhbmR3aWR0aCBzdHJlYW0gYmVsb3cgb3IgZXF1YWwgdG8gZXN0aW1hdGVkIGJhbmR3aWR0aC5cbiAgICBmb3IgKGkgPSAwOyBpIDw9IG1heEF1dG9MZXZlbDsgaSsrKSB7XG4gICAgLy8gY29uc2lkZXIgb25seSA4MCUgb2YgdGhlIGF2YWlsYWJsZSBiYW5kd2lkdGgsIGJ1dCBpZiB3ZSBhcmUgc3dpdGNoaW5nIHVwLFxuICAgIC8vIGJlIGV2ZW4gbW9yZSBjb25zZXJ2YXRpdmUgKDcwJSkgdG8gYXZvaWQgb3ZlcmVzdGltYXRpbmcgYW5kIGltbWVkaWF0ZWx5XG4gICAgLy8gc3dpdGNoaW5nIGJhY2suXG4gICAgICBpZiAoaSA8PSB0aGlzLmxhc3RmZXRjaGxldmVsKSB7XG4gICAgICAgIGFkanVzdGVkYncgPSAwLjggKiBsYXN0Ync7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhZGp1c3RlZGJ3ID0gMC43ICogbGFzdGJ3O1xuICAgICAgfVxuICAgICAgaWYgKGFkanVzdGVkYncgPCBobHMubGV2ZWxzW2ldLmJpdHJhdGUpIHtcbiAgICAgICAgcmV0dXJuIE1hdGgubWF4KDAsIGkgLSAxKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGkgLSAxO1xuICB9XG5cbiAgc2V0IG5leHRBdXRvTGV2ZWwobmV4dExldmVsKSB7XG4gICAgdGhpcy5fbmV4dEF1dG9MZXZlbCA9IG5leHRMZXZlbDtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBBYnJDb250cm9sbGVyO1xuXG4iLCIvKlxuICogQnVmZmVyIENvbnRyb2xsZXJcbiovXG5cbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IEV2ZW50SGFuZGxlciBmcm9tICcuLi9ldmVudC1oYW5kbGVyJztcbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5cblxuY2xhc3MgQnVmZmVyQ29udHJvbGxlciBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgc3VwZXIoaGxzLFxuICAgICAgRXZlbnQuTUVESUFfQVRUQUNISU5HLFxuICAgICAgRXZlbnQuTUVESUFfREVUQUNISU5HLFxuICAgICAgRXZlbnQuQlVGRkVSX1JFU0VULFxuICAgICAgRXZlbnQuQlVGRkVSX0FQUEVORElORyxcbiAgICAgIEV2ZW50LkJVRkZFUl9DT0RFQ1MsXG4gICAgICBFdmVudC5CVUZGRVJfRU9TLFxuICAgICAgRXZlbnQuQlVGRkVSX0ZMVVNISU5HKTtcblxuICAgIC8vIFNvdXJjZSBCdWZmZXIgbGlzdGVuZXJzXG4gICAgdGhpcy5vbnNidWUgPSB0aGlzLm9uU0JVcGRhdGVFbmQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uc2JlICA9IHRoaXMub25TQlVwZGF0ZUVycm9yLmJpbmQodGhpcyk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIEV2ZW50SGFuZGxlci5wcm90b3R5cGUuZGVzdHJveS5jYWxsKHRoaXMpO1xuICB9XG5cbiAgb25NZWRpYUF0dGFjaGluZyhkYXRhKSB7XG4gICAgdmFyIG1lZGlhID0gdGhpcy5tZWRpYSA9IGRhdGEubWVkaWE7XG4gICAgLy8gc2V0dXAgdGhlIG1lZGlhIHNvdXJjZVxuICAgIHZhciBtcyA9IHRoaXMubWVkaWFTb3VyY2UgPSBuZXcgTWVkaWFTb3VyY2UoKTtcbiAgICAvL01lZGlhIFNvdXJjZSBsaXN0ZW5lcnNcbiAgICB0aGlzLm9ubXNvID0gdGhpcy5vbk1lZGlhU291cmNlT3Blbi5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25tc2UgPSB0aGlzLm9uTWVkaWFTb3VyY2VFbmRlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25tc2MgPSB0aGlzLm9uTWVkaWFTb3VyY2VDbG9zZS5iaW5kKHRoaXMpO1xuICAgIG1zLmFkZEV2ZW50TGlzdGVuZXIoJ3NvdXJjZW9wZW4nLCB0aGlzLm9ubXNvKTtcbiAgICBtcy5hZGRFdmVudExpc3RlbmVyKCdzb3VyY2VlbmRlZCcsIHRoaXMub25tc2UpO1xuICAgIG1zLmFkZEV2ZW50TGlzdGVuZXIoJ3NvdXJjZWNsb3NlJywgdGhpcy5vbm1zYyk7XG4gICAgLy8gbGluayB2aWRlbyBhbmQgbWVkaWEgU291cmNlXG4gICAgbWVkaWEuc3JjID0gVVJMLmNyZWF0ZU9iamVjdFVSTChtcyk7XG4gIH1cblxuICBvbk1lZGlhRGV0YWNoaW5nKCkge1xuICAgIHZhciBtcyA9IHRoaXMubWVkaWFTb3VyY2U7XG4gICAgaWYgKG1zKSB7XG4gICAgICBpZiAobXMucmVhZHlTdGF0ZSA9PT0gJ29wZW4nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgLy8gZW5kT2ZTdHJlYW0gY291bGQgdHJpZ2dlciBleGNlcHRpb24gaWYgYW55IHNvdXJjZWJ1ZmZlciBpcyBpbiB1cGRhdGluZyBzdGF0ZVxuICAgICAgICAgIC8vIHdlIGRvbid0IHJlYWxseSBjYXJlIGFib3V0IGNoZWNraW5nIHNvdXJjZWJ1ZmZlciBzdGF0ZSBoZXJlLFxuICAgICAgICAgIC8vIGFzIHdlIGFyZSBhbnl3YXkgZGV0YWNoaW5nIHRoZSBNZWRpYVNvdXJjZVxuICAgICAgICAgIC8vIGxldCdzIGp1c3QgYXZvaWQgdGhpcyBleGNlcHRpb24gdG8gcHJvcGFnYXRlXG4gICAgICAgICAgbXMuZW5kT2ZTdHJlYW0oKTtcbiAgICAgICAgfSBjYXRjaChlcnIpIHtcbiAgICAgICAgICBsb2dnZXIud2Fybihgb25NZWRpYURldGFjaGluZzoke2Vyci5tZXNzYWdlfSB3aGlsZSBjYWxsaW5nIGVuZE9mU3RyZWFtYCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIG1zLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NvdXJjZW9wZW4nLCB0aGlzLm9ubXNvKTtcbiAgICAgIG1zLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NvdXJjZWVuZGVkJywgdGhpcy5vbm1zZSk7XG4gICAgICBtcy5yZW1vdmVFdmVudExpc3RlbmVyKCdzb3VyY2VjbG9zZScsIHRoaXMub25tc2MpO1xuICAgICAgLy8gdW5saW5rIE1lZGlhU291cmNlIGZyb20gdmlkZW8gdGFnXG4gICAgICB0aGlzLm1lZGlhLnNyYyA9ICcnO1xuICAgICAgdGhpcy5tZWRpYS5yZW1vdmVBdHRyaWJ1dGUoJ3NyYycpO1xuICAgICAgdGhpcy5tZWRpYVNvdXJjZSA9IG51bGw7XG4gICAgICB0aGlzLm1lZGlhID0gbnVsbDtcbiAgICAgIHRoaXMucGVuZGluZ1RyYWNrcyA9IG51bGw7XG4gICAgICB0aGlzLnNvdXJjZUJ1ZmZlciA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMub25tc28gPSB0aGlzLm9ubXNlID0gdGhpcy5vbm1zYyA9IG51bGw7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5NRURJQV9ERVRBQ0hFRCk7XG4gIH1cblxuICBvbk1lZGlhU291cmNlT3BlbigpIHtcbiAgICBsb2dnZXIubG9nKCdtZWRpYSBzb3VyY2Ugb3BlbmVkJyk7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5NRURJQV9BVFRBQ0hFRCwgeyBtZWRpYSA6IHRoaXMubWVkaWEgfSk7XG4gICAgLy8gb25jZSByZWNlaXZlZCwgZG9uJ3QgbGlzdGVuIGFueW1vcmUgdG8gc291cmNlb3BlbiBldmVudFxuICAgIHRoaXMubWVkaWFTb3VyY2UucmVtb3ZlRXZlbnRMaXN0ZW5lcignc291cmNlb3BlbicsIHRoaXMub25tc28pO1xuICAgIC8vIGlmIGFueSBidWZmZXIgY29kZWNzIHBlbmRpbmcsIHRyZWF0IGl0IGhlcmUuXG4gICAgdmFyIHBlbmRpbmdUcmFja3MgPSB0aGlzLnBlbmRpbmdUcmFja3M7XG4gICAgaWYgKHBlbmRpbmdUcmFja3MpIHtcbiAgICAgIHRoaXMub25CdWZmZXJDb2RlY3MocGVuZGluZ1RyYWNrcyk7XG4gICAgICB0aGlzLnBlbmRpbmdUcmFja3MgPSBudWxsO1xuICAgICAgdGhpcy5kb0FwcGVuZGluZygpO1xuICAgIH1cbiAgfVxuXG4gIG9uTWVkaWFTb3VyY2VDbG9zZSgpIHtcbiAgICBsb2dnZXIubG9nKCdtZWRpYSBzb3VyY2UgY2xvc2VkJyk7XG4gIH1cblxuICBvbk1lZGlhU291cmNlRW5kZWQoKSB7XG4gICAgbG9nZ2VyLmxvZygnbWVkaWEgc291cmNlIGVuZGVkJyk7XG4gIH1cblxuXG4gIG9uU0JVcGRhdGVFbmQoKSB7XG5cbiAgICBpZiAodGhpcy5fbmVlZHNGbHVzaCkge1xuICAgICAgdGhpcy5kb0ZsdXNoKCk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX25lZWRzRW9zKSB7XG4gICAgICB0aGlzLm9uQnVmZmVyRW9zKCk7XG4gICAgfVxuXG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5CVUZGRVJfQVBQRU5ERUQpO1xuXG4gICAgdGhpcy5kb0FwcGVuZGluZygpO1xuICB9XG5cbiAgb25TQlVwZGF0ZUVycm9yKGV2ZW50KSB7XG4gICAgbG9nZ2VyLmVycm9yKGBzb3VyY2VCdWZmZXIgZXJyb3I6JHtldmVudH1gKTtcbiAgICAvLyBhY2NvcmRpbmcgdG8gaHR0cDovL3d3dy53My5vcmcvVFIvbWVkaWEtc291cmNlLyNzb3VyY2VidWZmZXItYXBwZW5kLWVycm9yXG4gICAgLy8gdGhpcyBlcnJvciBtaWdodCBub3QgYWx3YXlzIGJlIGZhdGFsIChpdCBpcyBmYXRhbCBpZiBkZWNvZGUgZXJyb3IgaXMgc2V0LCBpbiB0aGF0IGNhc2VcbiAgICAvLyBpdCB3aWxsIGJlIGZvbGxvd2VkIGJ5IGEgbWVkaWFFbGVtZW50IGVycm9yIC4uLilcbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkJVRkZFUl9BUFBFTkRJTkdfRVJST1IsIGZhdGFsOiBmYWxzZX0pO1xuICAgIC8vIHdlIGRvbid0IG5lZWQgdG8gZG8gbW9yZSB0aGFuIHRoYXQsIGFzIGFjY29yZGluIHRvIHRoZSBzcGVjLCB1cGRhdGVlbmQgd2lsbCBiZSBmaXJlZCBqdXN0IGFmdGVyXG4gIH1cblxuICBvbkJ1ZmZlclJlc2V0KCkge1xuICAgIHZhciBzb3VyY2VCdWZmZXIgPSB0aGlzLnNvdXJjZUJ1ZmZlcjtcbiAgICBpZiAoc291cmNlQnVmZmVyKSB7XG4gICAgICBmb3IodmFyIHR5cGUgaW4gc291cmNlQnVmZmVyKSB7XG4gICAgICAgIHZhciBzYiA9IHNvdXJjZUJ1ZmZlclt0eXBlXTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB0aGlzLm1lZGlhU291cmNlLnJlbW92ZVNvdXJjZUJ1ZmZlcihzYik7XG4gICAgICAgICAgc2IucmVtb3ZlRXZlbnRMaXN0ZW5lcigndXBkYXRlZW5kJywgdGhpcy5vbnNidWUpO1xuICAgICAgICAgIHNiLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgdGhpcy5vbnNiZSk7XG4gICAgICAgIH0gY2F0Y2goZXJyKSB7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMuc291cmNlQnVmZmVyID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5mbHVzaFJhbmdlID0gW107XG4gICAgdGhpcy5hcHBlbmRlZCA9IDA7XG4gIH1cblxuICBvbkJ1ZmZlckNvZGVjcyh0cmFja3MpIHtcbiAgICB2YXIgc2IsdHJhY2tOYW1lLHRyYWNrLCBjb2RlYywgbWltZVR5cGU7XG5cbiAgICBpZiAoIXRoaXMubWVkaWEpIHtcbiAgICAgIHRoaXMucGVuZGluZ1RyYWNrcyA9IHRyYWNrcztcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuc291cmNlQnVmZmVyKSB7XG4gICAgICB2YXIgc291cmNlQnVmZmVyID0ge30sIG1lZGlhU291cmNlID0gdGhpcy5tZWRpYVNvdXJjZTtcbiAgICAgIGZvciAodHJhY2tOYW1lIGluIHRyYWNrcykge1xuICAgICAgICB0cmFjayA9IHRyYWNrc1t0cmFja05hbWVdO1xuICAgICAgICAvLyB1c2UgbGV2ZWxDb2RlYyBhcyBmaXJzdCBwcmlvcml0eVxuICAgICAgICBjb2RlYyA9IHRyYWNrLmxldmVsQ29kZWMgfHwgdHJhY2suY29kZWM7XG4gICAgICAgIG1pbWVUeXBlID0gYCR7dHJhY2suY29udGFpbmVyfTtjb2RlY3M9JHtjb2RlY31gO1xuICAgICAgICBsb2dnZXIubG9nKGBjcmVhdGluZyBzb3VyY2VCdWZmZXIgd2l0aCBtaW1lVHlwZToke21pbWVUeXBlfWApO1xuICAgICAgICBzYiA9IHNvdXJjZUJ1ZmZlclt0cmFja05hbWVdID0gbWVkaWFTb3VyY2UuYWRkU291cmNlQnVmZmVyKG1pbWVUeXBlKTtcbiAgICAgICAgc2IuYWRkRXZlbnRMaXN0ZW5lcigndXBkYXRlZW5kJywgdGhpcy5vbnNidWUpO1xuICAgICAgICBzYi5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsIHRoaXMub25zYmUpO1xuICAgICAgfVxuICAgICAgdGhpcy5zb3VyY2VCdWZmZXIgPSBzb3VyY2VCdWZmZXI7XG4gICAgfVxuICB9XG5cbiAgb25CdWZmZXJBcHBlbmRpbmcoZGF0YSkge1xuICAgIGlmICghdGhpcy5zZWdtZW50cykge1xuICAgICAgdGhpcy5zZWdtZW50cyA9IFsgZGF0YSBdO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnNlZ21lbnRzLnB1c2goZGF0YSk7XG4gICAgfVxuICAgIHRoaXMuZG9BcHBlbmRpbmcoKTtcbiAgfVxuXG4gIG9uQnVmZmVyQXBwZW5kRmFpbChkYXRhKSB7XG4gICAgbG9nZ2VyLmVycm9yKGBzb3VyY2VCdWZmZXIgZXJyb3I6JHtkYXRhLmV2ZW50fWApO1xuICAgIC8vIGFjY29yZGluZyB0byBodHRwOi8vd3d3LnczLm9yZy9UUi9tZWRpYS1zb3VyY2UvI3NvdXJjZWJ1ZmZlci1hcHBlbmQtZXJyb3JcbiAgICAvLyB0aGlzIGVycm9yIG1pZ2h0IG5vdCBhbHdheXMgYmUgZmF0YWwgKGl0IGlzIGZhdGFsIGlmIGRlY29kZSBlcnJvciBpcyBzZXQsIGluIHRoYXQgY2FzZVxuICAgIC8vIGl0IHdpbGwgYmUgZm9sbG93ZWQgYnkgYSBtZWRpYUVsZW1lbnQgZXJyb3IgLi4uKVxuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuQlVGRkVSX0FQUEVORElOR19FUlJPUiwgZmF0YWw6IGZhbHNlLCBmcmFnOiB0aGlzLmZyYWdDdXJyZW50fSk7XG4gIH1cblxuICBvbkJ1ZmZlckVvcygpIHtcbiAgICB2YXIgc2IgPSB0aGlzLnNvdXJjZUJ1ZmZlciwgbWVkaWFTb3VyY2UgPSB0aGlzLm1lZGlhU291cmNlO1xuICAgIGlmICghbWVkaWFTb3VyY2UgfHwgbWVkaWFTb3VyY2UucmVhZHlTdGF0ZSAhPT0gJ29wZW4nKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmICghKChzYi5hdWRpbyAmJiBzYi5hdWRpby51cGRhdGluZykgfHwgKHNiLnZpZGVvICYmIHNiLnZpZGVvLnVwZGF0aW5nKSkpIHtcbiAgICAgIGxvZ2dlci5sb2coJ2FsbCBtZWRpYSBkYXRhIGF2YWlsYWJsZSwgc2lnbmFsIGVuZE9mU3RyZWFtKCkgdG8gTWVkaWFTb3VyY2UgYW5kIHN0b3AgbG9hZGluZyBmcmFnbWVudCcpO1xuICAgICAgLy9Ob3RpZnkgdGhlIG1lZGlhIGVsZW1lbnQgdGhhdCBpdCBub3cgaGFzIGFsbCBvZiB0aGUgbWVkaWEgZGF0YVxuICAgICAgbWVkaWFTb3VyY2UuZW5kT2ZTdHJlYW0oKTtcbiAgICAgIHRoaXMuX25lZWRzRW9zID0gZmFsc2U7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX25lZWRzRW9zID0gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICBvbkJ1ZmZlckZsdXNoaW5nKGRhdGEpIHtcbiAgICB0aGlzLmZsdXNoUmFuZ2UucHVzaCh7c3RhcnQ6IGRhdGEuc3RhcnRPZmZzZXQsIGVuZDogZGF0YS5lbmRPZmZzZXR9KTtcbiAgICAvLyBhdHRlbXB0IGZsdXNoIGltbWVkaWF0bHlcbiAgICB0aGlzLmZsdXNoQnVmZmVyQ291bnRlciA9IDA7XG4gICAgdGhpcy5kb0ZsdXNoKCk7XG4gIH1cblxuICBkb0ZsdXNoKCkge1xuICAgIC8vIGxvb3AgdGhyb3VnaCBhbGwgYnVmZmVyIHJhbmdlcyB0byBmbHVzaFxuICAgIHdoaWxlKHRoaXMuZmx1c2hSYW5nZS5sZW5ndGgpIHtcbiAgICAgIHZhciByYW5nZSA9IHRoaXMuZmx1c2hSYW5nZVswXTtcbiAgICAgIC8vIGZsdXNoQnVmZmVyIHdpbGwgYWJvcnQgYW55IGJ1ZmZlciBhcHBlbmQgaW4gcHJvZ3Jlc3MgYW5kIGZsdXNoIEF1ZGlvL1ZpZGVvIEJ1ZmZlclxuICAgICAgaWYgKHRoaXMuZmx1c2hCdWZmZXIocmFuZ2Uuc3RhcnQsIHJhbmdlLmVuZCkpIHtcbiAgICAgICAgLy8gcmFuZ2UgZmx1c2hlZCwgcmVtb3ZlIGZyb20gZmx1c2ggYXJyYXlcbiAgICAgICAgdGhpcy5mbHVzaFJhbmdlLnNoaWZ0KCk7XG4gICAgICAgIHRoaXMuZmx1c2hCdWZmZXJDb3VudGVyID0gMDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX25lZWRzRmx1c2ggPSB0cnVlO1xuICAgICAgICAvLyBhdm9pZCBsb29waW5nLCB3YWl0IGZvciBTQiB1cGRhdGUgZW5kIHRvIHJldHJpZ2dlciBhIGZsdXNoXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHRoaXMuZmx1c2hSYW5nZS5sZW5ndGggPT09IDApIHtcbiAgICAgIC8vIGV2ZXJ5dGhpbmcgZmx1c2hlZFxuICAgICAgdGhpcy5fbmVlZHNGbHVzaCA9IGZhbHNlO1xuXG4gICAgICAvLyBsZXQncyByZWNvbXB1dGUgdGhpcy5hcHBlbmRlZCwgd2hpY2ggaXMgdXNlZCB0byBhdm9pZCBmbHVzaCBsb29waW5nXG4gICAgICB2YXIgYXBwZW5kZWQgPSAwO1xuICAgICAgdmFyIHNvdXJjZUJ1ZmZlciA9IHRoaXMuc291cmNlQnVmZmVyO1xuICAgICAgaWYgKHNvdXJjZUJ1ZmZlcikge1xuICAgICAgICBmb3IgKHZhciB0eXBlIGluIHNvdXJjZUJ1ZmZlcikge1xuICAgICAgICAgIGFwcGVuZGVkICs9IHNvdXJjZUJ1ZmZlclt0eXBlXS5idWZmZXJlZC5sZW5ndGg7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMuYXBwZW5kZWQgPSBhcHBlbmRlZDtcbiAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuQlVGRkVSX0ZMVVNIRUQpO1xuICAgIH1cbiAgfVxuXG4gIGRvQXBwZW5kaW5nKCkge1xuICAgIHZhciBobHMgPSB0aGlzLmhscywgc291cmNlQnVmZmVyID0gdGhpcy5zb3VyY2VCdWZmZXIsIHNlZ21lbnRzID0gdGhpcy5zZWdtZW50cztcbiAgICBpZiAoc291cmNlQnVmZmVyKSB7XG4gICAgICBpZiAodGhpcy5tZWRpYS5lcnJvcikge1xuICAgICAgICBzZWdtZW50cyA9IFtdO1xuICAgICAgICBsb2dnZXIuZXJyb3IoJ3RyeWluZyB0byBhcHBlbmQgYWx0aG91Z2ggYSBtZWRpYSBlcnJvciBvY2N1cmVkLCBmbHVzaCBzZWdtZW50IGFuZCBhYm9ydCcpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBmb3IgKHZhciB0eXBlIGluIHNvdXJjZUJ1ZmZlcikge1xuICAgICAgICBpZiAoc291cmNlQnVmZmVyW3R5cGVdLnVwZGF0aW5nKSB7XG4gICAgICAgICAgLy9sb2dnZXIubG9nKCdzYiB1cGRhdGUgaW4gcHJvZ3Jlc3MnKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChzZWdtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgdmFyIHNlZ21lbnQgPSBzZWdtZW50cy5zaGlmdCgpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIC8vbG9nZ2VyLmxvZyhgYXBwZW5kaW5nICR7c2VnbWVudC50eXBlfSBTQiwgc2l6ZToke3NlZ21lbnQuZGF0YS5sZW5ndGh9KTtcblx0XHQgIC8vIGlmIChzb3VyY2VCdWZmZXIuZmlyc3RMb2FkZWQgJiYgIXNvdXJjZUJ1ZmZlci52aWRlby51cGRhdGluZykgeyBcblx0XHQgIFx0Ly8gc291cmNlQnVmZmVyW3NlZ21lbnQudHlwZV0udGltZXN0YW1wT2Zmc2V0ICs9IDEwO1xuXHRcdCAgLy8gfVxuICAgICAgICAgIHNvdXJjZUJ1ZmZlcltzZWdtZW50LnR5cGVdLmFwcGVuZEJ1ZmZlcihzZWdtZW50LmRhdGEpO1xuXHRcdCAgc291cmNlQnVmZmVyLmZpcnN0TG9hZGVkID0gdHJ1ZTtcblxuXHRcdCAgLy8gc2V0VGltZW91dCggZnVuY3Rpb24oKSB7XG5cdFx0ICAvLyBcdHNvdXJjZUJ1ZmZlcltzZWdtZW50LnR5cGVdLnRpbWVzdGFtcE9mZnNldCA9IDE1O1xuXHRcdCAgLy8gfSwgNSk7XG5cblx0XHQgIGNvbnNvbGUuaW5mbyhzZWdtZW50KTtcbiAgICAgICAgICB0aGlzLmFwcGVuZEVycm9yID0gMDtcbiAgICAgICAgICB0aGlzLmFwcGVuZGVkKys7XG4gICAgICAgIH0gY2F0Y2goZXJyKSB7XG4gICAgICAgICAgLy8gaW4gY2FzZSBhbnkgZXJyb3Igb2NjdXJlZCB3aGlsZSBhcHBlbmRpbmcsIHB1dCBiYWNrIHNlZ21lbnQgaW4gc2VnbWVudHMgdGFibGVcbiAgICAgICAgICBsb2dnZXIuZXJyb3IoYGVycm9yIHdoaWxlIHRyeWluZyB0byBhcHBlbmQgYnVmZmVyOiR7ZXJyLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgc2VnbWVudHMudW5zaGlmdChzZWdtZW50KTtcbiAgICAgICAgICB2YXIgZXZlbnQgPSB7dHlwZTogRXJyb3JUeXBlcy5NRURJQV9FUlJPUn07XG4gICAgICAgICAgaWYoZXJyLmNvZGUgIT09IDIyKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5hcHBlbmRFcnJvcikge1xuICAgICAgICAgICAgICB0aGlzLmFwcGVuZEVycm9yKys7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB0aGlzLmFwcGVuZEVycm9yID0gMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGV2ZW50LmRldGFpbHMgPSBFcnJvckRldGFpbHMuQlVGRkVSX0FQUEVORF9FUlJPUjtcbiAgICAgICAgICAgIGV2ZW50LmZyYWcgPSB0aGlzLmZyYWdDdXJyZW50O1xuICAgICAgICAgICAgLyogd2l0aCBVSEQgY29udGVudCwgd2UgY291bGQgZ2V0IGxvb3Agb2YgcXVvdGEgZXhjZWVkZWQgZXJyb3IgdW50aWxcbiAgICAgICAgICAgICAgYnJvd3NlciBpcyBhYmxlIHRvIGV2aWN0IHNvbWUgZGF0YSBmcm9tIHNvdXJjZWJ1ZmZlci4gcmV0cnlpbmcgaGVscCByZWNvdmVyaW5nIHRoaXNcbiAgICAgICAgICAgICovXG4gICAgICAgICAgICBpZiAodGhpcy5hcHBlbmRFcnJvciA+IGhscy5jb25maWcuYXBwZW5kRXJyb3JNYXhSZXRyeSkge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBmYWlsICR7aGxzLmNvbmZpZy5hcHBlbmRFcnJvck1heFJldHJ5fSB0aW1lcyB0byBhcHBlbmQgc2VnbWVudCBpbiBzb3VyY2VCdWZmZXJgKTtcbiAgICAgICAgICAgICAgc2VnbWVudHMgPSBbXTtcbiAgICAgICAgICAgICAgZXZlbnQuZmF0YWwgPSB0cnVlO1xuICAgICAgICAgICAgICBobHMudHJpZ2dlcihFdmVudC5FUlJPUiwgZXZlbnQpO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBldmVudC5mYXRhbCA9IGZhbHNlO1xuICAgICAgICAgICAgICBobHMudHJpZ2dlcihFdmVudC5FUlJPUiwgZXZlbnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBRdW90YUV4Y2VlZGVkRXJyb3I6IGh0dHA6Ly93d3cudzMub3JnL1RSL2h0bWw1L2luZnJhc3RydWN0dXJlLmh0bWwjcXVvdGFleGNlZWRlZGVycm9yXG4gICAgICAgICAgICAvLyBsZXQncyBzdG9wIGFwcGVuZGluZyBhbnkgc2VnbWVudHMsIGFuZCByZXBvcnQgQlVGRkVSX0ZVTExfRVJST1IgZXJyb3JcbiAgICAgICAgICAgIHNlZ21lbnRzID0gW107XG4gICAgICAgICAgICBldmVudC5kZXRhaWxzID0gRXJyb3JEZXRhaWxzLkJVRkZFUl9GVUxMX0VSUk9SO1xuICAgICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsZXZlbnQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qXG4gICAgZmx1c2ggc3BlY2lmaWVkIGJ1ZmZlcmVkIHJhbmdlLFxuICAgIHJldHVybiB0cnVlIG9uY2UgcmFuZ2UgaGFzIGJlZW4gZmx1c2hlZC5cbiAgICBhcyBzb3VyY2VCdWZmZXIucmVtb3ZlKCkgaXMgYXN5bmNocm9ub3VzLCBmbHVzaEJ1ZmZlciB3aWxsIGJlIHJldHJpZ2dlcmVkIG9uIHNvdXJjZUJ1ZmZlciB1cGRhdGUgZW5kXG4gICovXG4gIGZsdXNoQnVmZmVyKHN0YXJ0T2Zmc2V0LCBlbmRPZmZzZXQpIHtcbiAgICB2YXIgc2IsIGksIGJ1ZlN0YXJ0LCBidWZFbmQsIGZsdXNoU3RhcnQsIGZsdXNoRW5kO1xuICAgIC8vbG9nZ2VyLmxvZygnZmx1c2hCdWZmZXIscG9zL3N0YXJ0L2VuZDogJyArIHRoaXMubWVkaWEuY3VycmVudFRpbWUgKyAnLycgKyBzdGFydE9mZnNldCArICcvJyArIGVuZE9mZnNldCk7XG4gICAgLy8gc2FmZWd1YXJkIHRvIGF2b2lkIGluZmluaXRlIGxvb3BpbmcgOiBkb24ndCB0cnkgdG8gZmx1c2ggbW9yZSB0aGFuIHRoZSBuYiBvZiBhcHBlbmRlZCBzZWdtZW50c1xuICAgIGlmICh0aGlzLmZsdXNoQnVmZmVyQ291bnRlciA8IHRoaXMuYXBwZW5kZWQgJiYgdGhpcy5zb3VyY2VCdWZmZXIpIHtcbiAgICAgIGZvciAodmFyIHR5cGUgaW4gdGhpcy5zb3VyY2VCdWZmZXIpIHtcbiAgICAgICAgc2IgPSB0aGlzLnNvdXJjZUJ1ZmZlclt0eXBlXTtcbiAgICAgICAgaWYgKCFzYi51cGRhdGluZykge1xuICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBzYi5idWZmZXJlZC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYnVmU3RhcnQgPSBzYi5idWZmZXJlZC5zdGFydChpKTtcbiAgICAgICAgICAgIGJ1ZkVuZCA9IHNiLmJ1ZmZlcmVkLmVuZChpKTtcbiAgICAgICAgICAgIC8vIHdvcmthcm91bmQgZmlyZWZveCBub3QgYWJsZSB0byBwcm9wZXJseSBmbHVzaCBtdWx0aXBsZSBidWZmZXJlZCByYW5nZS5cbiAgICAgICAgICAgIGlmIChuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkuaW5kZXhPZignZmlyZWZveCcpICE9PSAtMSAmJiBlbmRPZmZzZXQgPT09IE51bWJlci5QT1NJVElWRV9JTkZJTklUWSkge1xuICAgICAgICAgICAgICBmbHVzaFN0YXJ0ID0gc3RhcnRPZmZzZXQ7XG4gICAgICAgICAgICAgIGZsdXNoRW5kID0gZW5kT2Zmc2V0O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgZmx1c2hTdGFydCA9IE1hdGgubWF4KGJ1ZlN0YXJ0LCBzdGFydE9mZnNldCk7XG4gICAgICAgICAgICAgIGZsdXNoRW5kID0gTWF0aC5taW4oYnVmRW5kLCBlbmRPZmZzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLyogc29tZXRpbWVzIHNvdXJjZWJ1ZmZlci5yZW1vdmUoKSBkb2VzIG5vdCBmbHVzaFxuICAgICAgICAgICAgICAgdGhlIGV4YWN0IGV4cGVjdGVkIHRpbWUgcmFuZ2UuXG4gICAgICAgICAgICAgICB0byBhdm9pZCByb3VuZGluZyBpc3N1ZXMvaW5maW5pdGUgbG9vcCxcbiAgICAgICAgICAgICAgIG9ubHkgZmx1c2ggYnVmZmVyIHJhbmdlIG9mIGxlbmd0aCBncmVhdGVyIHRoYW4gNTAwbXMuXG4gICAgICAgICAgICAqL1xuICAgICAgICAgICAgaWYgKE1hdGgubWluKGZsdXNoRW5kLGJ1ZkVuZCkgLSBmbHVzaFN0YXJ0ID4gMC41ICkge1xuICAgICAgICAgICAgICB0aGlzLmZsdXNoQnVmZmVyQ291bnRlcisrO1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBmbHVzaCAke3R5cGV9IFske2ZsdXNoU3RhcnR9LCR7Zmx1c2hFbmR9XSwgb2YgWyR7YnVmU3RhcnR9LCR7YnVmRW5kfV0sIHBvczoke3RoaXMubWVkaWEuY3VycmVudFRpbWV9YCk7XG4gICAgICAgICAgICAgIHNiLnJlbW92ZShmbHVzaFN0YXJ0LCBmbHVzaEVuZCk7XG4gICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy9sb2dnZXIubG9nKCdhYm9ydCAnICsgdHlwZSArICcgYXBwZW5kIGluIHByb2dyZXNzJyk7XG4gICAgICAgICAgLy8gdGhpcyB3aWxsIGFib3J0IGFueSBhcHBlbmRpbmcgaW4gcHJvZ3Jlc3NcbiAgICAgICAgICAvL3NiLmFib3J0KCk7XG4gICAgICAgICAgbG9nZ2VyLndhcm4oJ2Nhbm5vdCBmbHVzaCwgc2IgdXBkYXRpbmcgaW4gcHJvZ3Jlc3MnKTtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgbG9nZ2VyLndhcm4oJ2Fib3J0IGZsdXNoaW5nIHRvbyBtYW55IHJldHJpZXMnKTtcbiAgICB9XG4gICAgbG9nZ2VyLmxvZygnYnVmZmVyIGZsdXNoZWQnKTtcbiAgICAvLyBldmVyeXRoaW5nIGZsdXNoZWQgIVxuICAgIHJldHVybiB0cnVlO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEJ1ZmZlckNvbnRyb2xsZXI7XG4iLCIvKlxuICogY2FwIHN0cmVhbSBsZXZlbCB0byBtZWRpYSBzaXplIGRpbWVuc2lvbiBjb250cm9sbGVyXG4qL1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBFdmVudEhhbmRsZXIgZnJvbSAnLi4vZXZlbnQtaGFuZGxlcic7XG5cbmNsYXNzIENhcExldmVsQ29udHJvbGxlciBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG5cdGNvbnN0cnVjdG9yKGhscykge1xuICAgIHN1cGVyKGhscyxcbiAgICAgIEV2ZW50Lk1FRElBX0FUVEFDSElORyxcbiAgICAgIEV2ZW50Lk1BTklGRVNUX1BBUlNFRCk7ICAgXG5cdH1cblx0XG5cdGRlc3Ryb3koKSB7XG4gICAgaWYgKHRoaXMuaGxzLmNvbmZpZy5jYXBMZXZlbFRvUGxheWVyU2l6ZSkge1xuICAgICAgdGhpcy5tZWRpYSA9IG51bGw7XG4gICAgICB0aGlzLmF1dG9MZXZlbENhcHBpbmcgPSBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7XG4gICAgICBpZiAodGhpcy50aW1lcikge1xuICAgICAgICB0aGlzLnRpbWVyID0gY2xlYXJJbnRlcnZhbCh0aGlzLnRpbWVyKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblx0ICBcblx0b25NZWRpYUF0dGFjaGluZyhkYXRhKSB7XG4gICAgdGhpcy5tZWRpYSA9IGRhdGEubWVkaWEgaW5zdGFuY2VvZiBIVE1MVmlkZW9FbGVtZW50ID8gZGF0YS5tZWRpYSA6IG51bGw7ICBcbiAgfVxuXG4gIG9uTWFuaWZlc3RQYXJzZWQoZGF0YSkge1xuICAgIGlmICh0aGlzLmhscy5jb25maWcuY2FwTGV2ZWxUb1BsYXllclNpemUpIHtcbiAgICAgIHRoaXMuYXV0b0xldmVsQ2FwcGluZyA9IE51bWJlci5QT1NJVElWRV9JTkZJTklUWTtcbiAgICAgIHRoaXMubGV2ZWxzID0gZGF0YS5sZXZlbHM7XG4gICAgICB0aGlzLmhscy5maXJzdExldmVsID0gdGhpcy5nZXRNYXhMZXZlbChkYXRhLmZpcnN0TGV2ZWwpO1xuICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnRpbWVyKTtcbiAgICAgIHRoaXMudGltZXIgPSBzZXRJbnRlcnZhbCh0aGlzLmRldGVjdFBsYXllclNpemUuYmluZCh0aGlzKSwgMTAwMCk7XG4gICAgICB0aGlzLmRldGVjdFBsYXllclNpemUoKTtcbiAgICB9XG4gIH1cbiAgXG4gIGRldGVjdFBsYXllclNpemUoKSB7XG4gICAgaWYgKHRoaXMubWVkaWEpIHtcbiAgICAgIGxldCBsZXZlbHNMZW5ndGggPSB0aGlzLmxldmVscyA/IHRoaXMubGV2ZWxzLmxlbmd0aCA6IDA7XG4gICAgICBpZiAobGV2ZWxzTGVuZ3RoKSB7XG4gICAgICAgIHRoaXMuaGxzLmF1dG9MZXZlbENhcHBpbmcgPSB0aGlzLmdldE1heExldmVsKGxldmVsc0xlbmd0aCAtIDEpO1xuICAgICAgICBpZiAodGhpcy5obHMuYXV0b0xldmVsQ2FwcGluZyA+IHRoaXMuYXV0b0xldmVsQ2FwcGluZykge1xuICAgICAgICAgIC8vIGlmIGF1dG8gbGV2ZWwgY2FwcGluZyBoYXMgYSBoaWdoZXIgdmFsdWUgZm9yIHRoZSBwcmV2aW91cyBvbmUsIGZsdXNoIHRoZSBidWZmZXIgdXNpbmcgbmV4dExldmVsU3dpdGNoXG4gICAgICAgICAgLy8gdXN1YWxseSBoYXBwZW4gd2hlbiB0aGUgdXNlciBnbyB0byB0aGUgZnVsbHNjcmVlbiBtb2RlLlxuICAgICAgICAgIHRoaXMuaGxzLnN0cmVhbUNvbnRyb2xsZXIubmV4dExldmVsU3dpdGNoKCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5hdXRvTGV2ZWxDYXBwaW5nID0gdGhpcy5obHMuYXV0b0xldmVsQ2FwcGluZzsgICAgICAgIFxuICAgICAgfSAgXG4gICAgfVxuICB9XG4gIFxuICAvKlxuICAqIHJldHVybnMgbGV2ZWwgc2hvdWxkIGJlIHRoZSBvbmUgd2l0aCB0aGUgZGltZW5zaW9ucyBlcXVhbCBvciBncmVhdGVyIHRoYW4gdGhlIG1lZGlhIChwbGF5ZXIpIGRpbWVuc2lvbnMgKHNvIHRoZSB2aWRlbyB3aWxsIGJlIGRvd25zY2FsZWQpXG4gICovXG4gIGdldE1heExldmVsKGNhcExldmVsSW5kZXgpIHtcbiAgICBsZXQgcmVzdWx0LFxuICAgICAgICBpLFxuICAgICAgICBsZXZlbCxcbiAgICAgICAgbVdpZHRoID0gdGhpcy5tZWRpYVdpZHRoLFxuICAgICAgICBtSGVpZ2h0ID0gdGhpcy5tZWRpYUhlaWdodCxcbiAgICAgICAgbFdpZHRoID0gMCxcbiAgICAgICAgbEhlaWdodCA9IDA7XG4gICAgICAgIFxuICAgIGZvciAoaSA9IDA7IGkgPD0gY2FwTGV2ZWxJbmRleDsgaSsrKSB7XG4gICAgICBsZXZlbCA9IHRoaXMubGV2ZWxzW2ldO1xuICAgICAgcmVzdWx0ID0gaTtcbiAgICAgIGxXaWR0aCA9IGxldmVsLndpZHRoO1xuICAgICAgbEhlaWdodCA9IGxldmVsLmhlaWdodDtcbiAgICAgIGlmIChtV2lkdGggPD0gbFdpZHRoIHx8IG1IZWlnaHQgPD0gbEhlaWdodCkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9ICBcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIFxuICBnZXQgY29udGVudFNjYWxlRmFjdG9yKCkge1xuICAgIGxldCBwaXhlbFJhdGlvID0gMTtcbiAgICB0cnkge1xuICAgICAgcGl4ZWxSYXRpbyA9ICB3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbztcbiAgICB9IGNhdGNoKGUpIHt9XG4gICAgcmV0dXJuIHBpeGVsUmF0aW87XG4gIH1cbiAgXG4gIGdldCBtZWRpYVdpZHRoKCkge1xuICAgIGxldCB3aWR0aDtcbiAgICBpZiAodGhpcy5tZWRpYSkge1xuICAgICAgd2lkdGggPSB0aGlzLm1lZGlhLndpZHRoIHx8IHRoaXMubWVkaWEuY2xpZW50V2lkdGggfHwgdGhpcy5tZWRpYS5vZmZzZXRXaWR0aDtcbiAgICAgIHdpZHRoICo9IHRoaXMuY29udGVudFNjYWxlRmFjdG9yO1xuICAgIH1cbiAgICByZXR1cm4gd2lkdGg7XG4gIH1cbiAgXG4gIGdldCBtZWRpYUhlaWdodCgpIHtcbiAgICBsZXQgaGVpZ2h0O1xuICAgIGlmICh0aGlzLm1lZGlhKSB7XG4gICAgICBoZWlnaHQgPSB0aGlzLm1lZGlhLmhlaWdodCB8fCB0aGlzLm1lZGlhLmNsaWVudEhlaWdodCB8fCB0aGlzLm1lZGlhLm9mZnNldEhlaWdodDtcbiAgICAgIGhlaWdodCAqPSB0aGlzLmNvbnRlbnRTY2FsZUZhY3RvcjsgXG4gICAgfVxuICAgIHJldHVybiBoZWlnaHQ7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQ2FwTGV2ZWxDb250cm9sbGVyOyIsIi8qXG4gKiBMZXZlbCBDb250cm9sbGVyXG4qL1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBFdmVudEhhbmRsZXIgZnJvbSAnLi4vZXZlbnQtaGFuZGxlcic7XG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuXG5jbGFzcyBMZXZlbENvbnRyb2xsZXIgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHN1cGVyKGhscyxcbiAgICAgIEV2ZW50Lk1BTklGRVNUX0xPQURFRCxcbiAgICAgIEV2ZW50LkxFVkVMX0xPQURFRCxcbiAgICAgIEV2ZW50LkVSUk9SKTtcbiAgICB0aGlzLm9udGljayA9IHRoaXMudGljay5iaW5kKHRoaXMpO1xuICAgIHRoaXMuX21hbnVhbExldmVsID0gdGhpcy5fYXV0b0xldmVsQ2FwcGluZyA9IC0xO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBpZiAodGhpcy50aW1lcikge1xuICAgICBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgIH1cbiAgICB0aGlzLl9tYW51YWxMZXZlbCA9IC0xO1xuICB9XG5cbiAgc3RhcnRMb2FkKCkge1xuICAgIHRoaXMuY2FubG9hZCA9IHRydWU7XG4gICAgLy8gc3BlZWQgdXAgbGl2ZSBwbGF5bGlzdCByZWZyZXNoIGlmIHRpbWVyIGV4aXN0c1xuICAgIGlmICh0aGlzLnRpbWVyKSB7XG4gICAgICB0aGlzLnRpY2soKTtcbiAgICB9XG4gIH1cblxuICBzdG9wTG9hZCgpIHtcbiAgICB0aGlzLmNhbmxvYWQgPSBmYWxzZTtcbiAgfVxuXG4gIG9uTWFuaWZlc3RMb2FkZWQoZGF0YSkge1xuICAgIHZhciBsZXZlbHMwID0gW10sIGxldmVscyA9IFtdLCBiaXRyYXRlU3RhcnQsIGksIGJpdHJhdGVTZXQgPSB7fSwgdmlkZW9Db2RlY0ZvdW5kID0gZmFsc2UsIGF1ZGlvQ29kZWNGb3VuZCA9IGZhbHNlLCBobHMgPSB0aGlzLmhscztcblxuICAgIC8vIHJlZ3JvdXAgcmVkdW5kYW50IGxldmVsIHRvZ2V0aGVyXG4gICAgZGF0YS5sZXZlbHMuZm9yRWFjaChsZXZlbCA9PiB7XG4gICAgICBpZihsZXZlbC52aWRlb0NvZGVjKSB7XG4gICAgICAgIHZpZGVvQ29kZWNGb3VuZCA9IHRydWU7XG4gICAgICB9XG4gICAgICBpZihsZXZlbC5hdWRpb0NvZGVjKSB7XG4gICAgICAgIGF1ZGlvQ29kZWNGb3VuZCA9IHRydWU7XG4gICAgICB9XG4gICAgICB2YXIgcmVkdW5kYW50TGV2ZWxJZCA9IGJpdHJhdGVTZXRbbGV2ZWwuYml0cmF0ZV07XG4gICAgICBpZiAocmVkdW5kYW50TGV2ZWxJZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGJpdHJhdGVTZXRbbGV2ZWwuYml0cmF0ZV0gPSBsZXZlbHMwLmxlbmd0aDtcbiAgICAgICAgbGV2ZWwudXJsID0gW2xldmVsLnVybF07XG4gICAgICAgIGxldmVsLnVybElkID0gMDtcbiAgICAgICAgbGV2ZWxzMC5wdXNoKGxldmVsKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxldmVsczBbcmVkdW5kYW50TGV2ZWxJZF0udXJsLnB1c2gobGV2ZWwudXJsKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIHJlbW92ZSBhdWRpby1vbmx5IGxldmVsIGlmIHdlIGFsc28gaGF2ZSBsZXZlbHMgd2l0aCBhdWRpbyt2aWRlbyBjb2RlY3Mgc2lnbmFsbGVkXG4gICAgaWYodmlkZW9Db2RlY0ZvdW5kICYmIGF1ZGlvQ29kZWNGb3VuZCkge1xuICAgICAgbGV2ZWxzMC5mb3JFYWNoKGxldmVsID0+IHtcbiAgICAgICAgaWYobGV2ZWwudmlkZW9Db2RlYykge1xuICAgICAgICAgIGxldmVscy5wdXNoKGxldmVsKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldmVscyA9IGxldmVsczA7XG4gICAgfVxuXG4gICAgLy8gb25seSBrZWVwIGxldmVsIHdpdGggc3VwcG9ydGVkIGF1ZGlvL3ZpZGVvIGNvZGVjc1xuICAgIGxldmVscyA9IGxldmVscy5maWx0ZXIoZnVuY3Rpb24obGV2ZWwpIHtcbiAgICAgIHZhciBjaGVja1N1cHBvcnRlZEF1ZGlvID0gZnVuY3Rpb24oY29kZWMpIHsgcmV0dXJuIE1lZGlhU291cmNlLmlzVHlwZVN1cHBvcnRlZChgYXVkaW8vbXA0O2NvZGVjcz0ke2NvZGVjfWApO307XG4gICAgICB2YXIgY2hlY2tTdXBwb3J0ZWRWaWRlbyA9IGZ1bmN0aW9uKGNvZGVjKSB7IHJldHVybiBNZWRpYVNvdXJjZS5pc1R5cGVTdXBwb3J0ZWQoYHZpZGVvL21wNDtjb2RlY3M9JHtjb2RlY31gKTt9O1xuICAgICAgdmFyIGF1ZGlvQ29kZWMgPSBsZXZlbC5hdWRpb0NvZGVjLCB2aWRlb0NvZGVjID0gbGV2ZWwudmlkZW9Db2RlYztcblxuICAgICAgcmV0dXJuICghYXVkaW9Db2RlYyB8fCBjaGVja1N1cHBvcnRlZEF1ZGlvKGF1ZGlvQ29kZWMpKSAmJlxuICAgICAgICAgICAgICghdmlkZW9Db2RlYyB8fCBjaGVja1N1cHBvcnRlZFZpZGVvKHZpZGVvQ29kZWMpKTtcbiAgICB9KTtcblxuICAgIGlmKGxldmVscy5sZW5ndGgpIHtcbiAgICAgIC8vIHN0YXJ0IGJpdHJhdGUgaXMgdGhlIGZpcnN0IGJpdHJhdGUgb2YgdGhlIG1hbmlmZXN0XG4gICAgICBiaXRyYXRlU3RhcnQgPSBsZXZlbHNbMF0uYml0cmF0ZTtcbiAgICAgIC8vIHNvcnQgbGV2ZWwgb24gYml0cmF0ZVxuICAgICAgbGV2ZWxzLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgICAgcmV0dXJuIGEuYml0cmF0ZSAtIGIuYml0cmF0ZTtcbiAgICAgIH0pO1xuICAgICAgdGhpcy5fbGV2ZWxzID0gbGV2ZWxzO1xuICAgICAgLy8gZmluZCBpbmRleCBvZiBmaXJzdCBsZXZlbCBpbiBzb3J0ZWQgbGV2ZWxzXG4gICAgICBmb3IgKGkgPSAwOyBpIDwgbGV2ZWxzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChsZXZlbHNbaV0uYml0cmF0ZSA9PT0gYml0cmF0ZVN0YXJ0KSB7XG4gICAgICAgICAgdGhpcy5fZmlyc3RMZXZlbCA9IGk7XG4gICAgICAgICAgbG9nZ2VyLmxvZyhgbWFuaWZlc3QgbG9hZGVkLCR7bGV2ZWxzLmxlbmd0aH0gbGV2ZWwocykgZm91bmQsIGZpcnN0IGJpdHJhdGU6JHtiaXRyYXRlU3RhcnR9YCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGhscy50cmlnZ2VyKEV2ZW50Lk1BTklGRVNUX1BBUlNFRCwge2xldmVsczogdGhpcy5fbGV2ZWxzLCBmaXJzdExldmVsOiB0aGlzLl9maXJzdExldmVsLCBzdGF0czogZGF0YS5zdGF0c30pO1xuICAgIH0gZWxzZSB7XG4gICAgICBobHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5NQU5JRkVTVF9JTkNPTVBBVElCTEVfQ09ERUNTX0VSUk9SLCBmYXRhbDogdHJ1ZSwgdXJsOiBobHMudXJsLCByZWFzb246ICdubyBsZXZlbCB3aXRoIGNvbXBhdGlibGUgY29kZWNzIGZvdW5kIGluIG1hbmlmZXN0J30pO1xuICAgIH1cbiAgICByZXR1cm47XG4gIH1cblxuICBnZXQgbGV2ZWxzKCkge1xuICAgIHJldHVybiB0aGlzLl9sZXZlbHM7XG4gIH1cblxuICBnZXQgbGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2xldmVsO1xuICB9XG5cbiAgc2V0IGxldmVsKG5ld0xldmVsKSB7XG4gICAgaWYgKHRoaXMuX2xldmVsICE9PSBuZXdMZXZlbCB8fCB0aGlzLl9sZXZlbHNbbmV3TGV2ZWxdLmRldGFpbHMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5zZXRMZXZlbEludGVybmFsKG5ld0xldmVsKTtcbiAgICB9XG4gIH1cblxuIHNldExldmVsSW50ZXJuYWwobmV3TGV2ZWwpIHtcbiAgICAvLyBjaGVjayBpZiBsZXZlbCBpZHggaXMgdmFsaWRcbiAgICBpZiAobmV3TGV2ZWwgPj0gMCAmJiBuZXdMZXZlbCA8IHRoaXMuX2xldmVscy5sZW5ndGgpIHtcbiAgICAgIC8vIHN0b3BwaW5nIGxpdmUgcmVsb2FkaW5nIHRpbWVyIGlmIGFueVxuICAgICAgaWYgKHRoaXMudGltZXIpIHtcbiAgICAgICBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgICAgIHRoaXMudGltZXIgPSBudWxsO1xuICAgICAgfVxuICAgICAgdGhpcy5fbGV2ZWwgPSBuZXdMZXZlbDtcbiAgICAgIGxvZ2dlci5sb2coYHN3aXRjaGluZyB0byBsZXZlbCAke25ld0xldmVsfWApO1xuICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5MRVZFTF9TV0lUQ0gsIHtsZXZlbDogbmV3TGV2ZWx9KTtcbiAgICAgIHZhciBsZXZlbCA9IHRoaXMuX2xldmVsc1tuZXdMZXZlbF07XG4gICAgICAgLy8gY2hlY2sgaWYgd2UgbmVlZCB0byBsb2FkIHBsYXlsaXN0IGZvciB0aGlzIGxldmVsXG4gICAgICBpZiAobGV2ZWwuZGV0YWlscyA9PT0gdW5kZWZpbmVkIHx8IGxldmVsLmRldGFpbHMubGl2ZSA9PT0gdHJ1ZSkge1xuICAgICAgICAvLyBsZXZlbCBub3QgcmV0cmlldmVkIHlldCwgb3IgbGl2ZSBwbGF5bGlzdCB3ZSBuZWVkIHRvIChyZSlsb2FkIGl0XG4gICAgICAgIGxvZ2dlci5sb2coYChyZSlsb2FkaW5nIHBsYXlsaXN0IGZvciBsZXZlbCAke25ld0xldmVsfWApO1xuICAgICAgICB2YXIgdXJsSWQgPSBsZXZlbC51cmxJZDtcbiAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5MRVZFTF9MT0FESU5HLCB7dXJsOiBsZXZlbC51cmxbdXJsSWRdLCBsZXZlbDogbmV3TGV2ZWwsIGlkOiB1cmxJZH0pO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBpbnZhbGlkIGxldmVsIGlkIGdpdmVuLCB0cmlnZ2VyIGVycm9yXG4gICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZSA6IEVycm9yVHlwZXMuT1RIRVJfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5MRVZFTF9TV0lUQ0hfRVJST1IsIGxldmVsOiBuZXdMZXZlbCwgZmF0YWw6IGZhbHNlLCByZWFzb246ICdpbnZhbGlkIGxldmVsIGlkeCd9KTtcbiAgICB9XG4gfVxuXG4gIGdldCBtYW51YWxMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5fbWFudWFsTGV2ZWw7XG4gIH1cblxuICBzZXQgbWFudWFsTGV2ZWwobmV3TGV2ZWwpIHtcbiAgICB0aGlzLl9tYW51YWxMZXZlbCA9IG5ld0xldmVsO1xuICAgIGlmIChuZXdMZXZlbCAhPT0gLTEpIHtcbiAgICAgIHRoaXMubGV2ZWwgPSBuZXdMZXZlbDtcbiAgICB9XG4gIH1cblxuICBnZXQgZmlyc3RMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5fZmlyc3RMZXZlbDtcbiAgfVxuXG4gIHNldCBmaXJzdExldmVsKG5ld0xldmVsKSB7XG4gICAgdGhpcy5fZmlyc3RMZXZlbCA9IG5ld0xldmVsO1xuICB9XG5cbiAgZ2V0IHN0YXJ0TGV2ZWwoKSB7XG4gICAgaWYgKHRoaXMuX3N0YXJ0TGV2ZWwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2ZpcnN0TGV2ZWw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0aGlzLl9zdGFydExldmVsO1xuICAgIH1cbiAgfVxuXG4gIHNldCBzdGFydExldmVsKG5ld0xldmVsKSB7XG4gICAgdGhpcy5fc3RhcnRMZXZlbCA9IG5ld0xldmVsO1xuICB9XG5cbiAgb25FcnJvcihkYXRhKSB7XG4gICAgaWYoZGF0YS5mYXRhbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBkZXRhaWxzID0gZGF0YS5kZXRhaWxzLCBobHMgPSB0aGlzLmhscywgbGV2ZWxJZCwgbGV2ZWw7XG4gICAgLy8gdHJ5IHRvIHJlY292ZXIgbm90IGZhdGFsIGVycm9yc1xuICAgIHN3aXRjaChkZXRhaWxzKSB7XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5GUkFHX0xPQURfRVJST1I6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5GUkFHX0xPQURfVElNRU9VVDpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkZSQUdfTE9PUF9MT0FESU5HX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuS0VZX0xPQURfRVJST1I6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5LRVlfTE9BRF9USU1FT1VUOlxuICAgICAgICAgbGV2ZWxJZCA9IGRhdGEuZnJhZy5sZXZlbDtcbiAgICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBFcnJvckRldGFpbHMuTEVWRUxfTE9BRF9FUlJPUjpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkxFVkVMX0xPQURfVElNRU9VVDpcbiAgICAgICAgbGV2ZWxJZCA9IGRhdGEubGV2ZWw7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIC8qIHRyeSB0byBzd2l0Y2ggdG8gYSByZWR1bmRhbnQgc3RyZWFtIGlmIGFueSBhdmFpbGFibGUuXG4gICAgICogaWYgbm8gcmVkdW5kYW50IHN0cmVhbSBhdmFpbGFibGUsIGVtZXJnZW5jeSBzd2l0Y2ggZG93biAoaWYgaW4gYXV0byBtb2RlIGFuZCBjdXJyZW50IGxldmVsIG5vdCAwKVxuICAgICAqIG90aGVyd2lzZSwgd2UgY2Fubm90IHJlY292ZXIgdGhpcyBuZXR3b3JrIGVycm9yIC4uLlxuICAgICAqIGRvbid0IHJhaXNlIEZSQUdfTE9BRF9FUlJPUiBhbmQgRlJBR19MT0FEX1RJTUVPVVQgYXMgZmF0YWwsIGFzIGl0IGlzIGhhbmRsZWQgYnkgbWVkaWFDb250cm9sbGVyXG4gICAgICovXG4gICAgaWYgKGxldmVsSWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgbGV2ZWwgPSB0aGlzLl9sZXZlbHNbbGV2ZWxJZF07XG4gICAgICBpZiAobGV2ZWwudXJsSWQgPCAobGV2ZWwudXJsLmxlbmd0aCAtIDEpKSB7XG4gICAgICAgIGxldmVsLnVybElkKys7XG4gICAgICAgIGxldmVsLmRldGFpbHMgPSB1bmRlZmluZWQ7XG4gICAgICAgIGxvZ2dlci53YXJuKGBsZXZlbCBjb250cm9sbGVyLCR7ZGV0YWlsc30gZm9yIGxldmVsICR7bGV2ZWxJZH06IHN3aXRjaGluZyB0byByZWR1bmRhbnQgc3RyZWFtIGlkICR7bGV2ZWwudXJsSWR9YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyB3ZSBjb3VsZCB0cnkgdG8gcmVjb3ZlciBpZiBpbiBhdXRvIG1vZGUgYW5kIGN1cnJlbnQgbGV2ZWwgbm90IGxvd2VzdCBsZXZlbCAoMClcbiAgICAgICAgbGV0IHJlY292ZXJhYmxlID0gKCh0aGlzLl9tYW51YWxMZXZlbCA9PT0gLTEpICYmIGxldmVsSWQpO1xuICAgICAgICBpZiAocmVjb3ZlcmFibGUpIHtcbiAgICAgICAgICBsb2dnZXIud2FybihgbGV2ZWwgY29udHJvbGxlciwke2RldGFpbHN9OiBlbWVyZ2VuY3kgc3dpdGNoLWRvd24gZm9yIG5leHQgZnJhZ21lbnRgKTtcbiAgICAgICAgICBobHMuYWJyQ29udHJvbGxlci5uZXh0QXV0b0xldmVsID0gMDtcbiAgICAgICAgfSBlbHNlIGlmKGxldmVsICYmIGxldmVsLmRldGFpbHMgJiYgbGV2ZWwuZGV0YWlscy5saXZlKSB7XG4gICAgICAgICAgbG9nZ2VyLndhcm4oYGxldmVsIGNvbnRyb2xsZXIsJHtkZXRhaWxzfSBvbiBsaXZlIHN0cmVhbSwgZGlzY2FyZGApO1xuICAgICAgICAvLyBGUkFHX0xPQURfRVJST1IgYW5kIEZSQUdfTE9BRF9USU1FT1VUIGFyZSBoYW5kbGVkIGJ5IG1lZGlhQ29udHJvbGxlclxuICAgICAgICB9IGVsc2UgaWYgKGRldGFpbHMgIT09IEVycm9yRGV0YWlscy5GUkFHX0xPQURfRVJST1IgJiYgZGV0YWlscyAhPT0gRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9USU1FT1VUKSB7XG4gICAgICAgICAgbG9nZ2VyLmVycm9yKGBjYW5ub3QgcmVjb3ZlciAke2RldGFpbHN9IGVycm9yYCk7XG4gICAgICAgICAgdGhpcy5fbGV2ZWwgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgLy8gc3RvcHBpbmcgbGl2ZSByZWxvYWRpbmcgdGltZXIgaWYgYW55XG4gICAgICAgICAgaWYgKHRoaXMudGltZXIpIHtcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy50aW1lcik7XG4gICAgICAgICAgICB0aGlzLnRpbWVyID0gbnVsbDtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gcmVkaXNwYXRjaCBzYW1lIGVycm9yIGJ1dCB3aXRoIGZhdGFsIHNldCB0byB0cnVlXG4gICAgICAgICAgZGF0YS5mYXRhbCA9IHRydWU7XG4gICAgICAgICAgaGxzLnRyaWdnZXIoZXZlbnQsIGRhdGEpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgb25MZXZlbExvYWRlZChkYXRhKSB7XG4gICAgLy8gY2hlY2sgaWYgY3VycmVudCBwbGF5bGlzdCBpcyBhIGxpdmUgcGxheWxpc3RcbiAgICBpZiAoZGF0YS5kZXRhaWxzLmxpdmUgJiYgIXRoaXMudGltZXIpIHtcbiAgICAgIC8vIGlmIGxpdmUgcGxheWxpc3Qgd2Ugd2lsbCBoYXZlIHRvIHJlbG9hZCBpdCBwZXJpb2RpY2FsbHlcbiAgICAgIC8vIHNldCByZWxvYWQgcGVyaW9kIHRvIHBsYXlsaXN0IHRhcmdldCBkdXJhdGlvblxuICAgICAgdGhpcy50aW1lciA9IHNldEludGVydmFsKHRoaXMub250aWNrLCAxMDAwICogZGF0YS5kZXRhaWxzLnRhcmdldGR1cmF0aW9uKTtcbiAgICB9XG4gICAgaWYgKCFkYXRhLmRldGFpbHMubGl2ZSAmJiB0aGlzLnRpbWVyKSB7XG4gICAgICAvLyBwbGF5bGlzdCBpcyBub3QgbGl2ZSBhbmQgdGltZXIgaXMgYXJtZWQgOiBzdG9wcGluZyBpdFxuICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnRpbWVyKTtcbiAgICAgIHRoaXMudGltZXIgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIHRpY2soKSB7XG4gICAgdmFyIGxldmVsSWQgPSB0aGlzLl9sZXZlbDtcbiAgICBpZiAobGV2ZWxJZCAhPT0gdW5kZWZpbmVkICYmIHRoaXMuY2FubG9hZCkge1xuICAgICAgdmFyIGxldmVsID0gdGhpcy5fbGV2ZWxzW2xldmVsSWRdLCB1cmxJZCA9IGxldmVsLnVybElkO1xuICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5MRVZFTF9MT0FESU5HLCB7dXJsOiBsZXZlbC51cmxbdXJsSWRdLCBsZXZlbDogbGV2ZWxJZCwgaWQ6IHVybElkfSk7XG4gICAgfVxuICB9XG5cbiAgZ2V0IG5leHRMb2FkTGV2ZWwoKSB7XG4gICAgaWYgKHRoaXMuX21hbnVhbExldmVsICE9PSAtMSkge1xuICAgICAgcmV0dXJuIHRoaXMuX21hbnVhbExldmVsO1xuICAgIH0gZWxzZSB7XG4gICAgIHJldHVybiB0aGlzLmhscy5hYnJDb250cm9sbGVyLm5leHRBdXRvTGV2ZWw7XG4gICAgfVxuICB9XG5cbiAgc2V0IG5leHRMb2FkTGV2ZWwobmV4dExldmVsKSB7XG4gICAgdGhpcy5sZXZlbCA9IG5leHRMZXZlbDtcbiAgICBpZiAodGhpcy5fbWFudWFsTGV2ZWwgPT09IC0xKSB7XG4gICAgICB0aGlzLmhscy5hYnJDb250cm9sbGVyLm5leHRBdXRvTGV2ZWwgPSBuZXh0TGV2ZWw7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IExldmVsQ29udHJvbGxlcjtcblxuIiwiLypcbiAqIFN0cmVhbSBDb250cm9sbGVyXG4qL1xuXG5pbXBvcnQgRGVtdXhlciBmcm9tICcuLi9kZW11eC9kZW11eGVyJztcbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IEV2ZW50SGFuZGxlciBmcm9tICcuLi9ldmVudC1oYW5kbGVyJztcbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IEJpbmFyeVNlYXJjaCBmcm9tICcuLi91dGlscy9iaW5hcnktc2VhcmNoJztcbmltcG9ydCBCdWZmZXJIZWxwZXIgZnJvbSAnLi4vaGVscGVyL2J1ZmZlci1oZWxwZXInO1xuaW1wb3J0IExldmVsSGVscGVyIGZyb20gJy4uL2hlbHBlci9sZXZlbC1oZWxwZXInO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5cbmNvbnN0IFN0YXRlID0ge1xuICBTVE9QUEVEIDogJ1NUT1BQRUQnLFxuICBTVEFSVElORyA6ICdTVEFSVElORycsXG4gIElETEUgOiAnSURMRScsXG4gIFBBVVNFRCA6ICdQQVVTRUQnLFxuICBLRVlfTE9BRElORyA6ICdLRVlfTE9BRElORycsXG4gIEZSQUdfTE9BRElORyA6ICdGUkFHX0xPQURJTkcnLFxuICBGUkFHX0xPQURJTkdfV0FJVElOR19SRVRSWSA6ICdGUkFHX0xPQURJTkdfV0FJVElOR19SRVRSWScsXG4gIFdBSVRJTkdfTEVWRUwgOiAnV0FJVElOR19MRVZFTCcsXG4gIFBBUlNJTkcgOiAnUEFSU0lORycsXG4gIFBBUlNFRCA6ICdQQVJTRUQnLFxuICBFTkRFRCA6ICdFTkRFRCcsXG4gIEVSUk9SIDogJ0VSUk9SJ1xufTtcblxuY2xhc3MgU3RyZWFtQ29udHJvbGxlciBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgc3VwZXIoaGxzLFxuICAgICAgRXZlbnQuTUVESUFfQVRUQUNIRUQsXG4gICAgICBFdmVudC5NRURJQV9ERVRBQ0hJTkcsXG4gICAgICBFdmVudC5NQU5JRkVTVF9MT0FESU5HLFxuICAgICAgRXZlbnQuTUFOSUZFU1RfUEFSU0VELFxuICAgICAgRXZlbnQuTEVWRUxfTE9BREVELFxuICAgICAgRXZlbnQuS0VZX0xPQURFRCxcbiAgICAgIEV2ZW50LkZSQUdfTE9BREVELFxuICAgICAgRXZlbnQuRlJBR19MT0FEX0VNRVJHRU5DWV9BQk9SVEVELFxuICAgICAgRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCxcbiAgICAgIEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLFxuICAgICAgRXZlbnQuRlJBR19QQVJTRUQsXG4gICAgICBFdmVudC5FUlJPUixcbiAgICAgIEV2ZW50LkJVRkZFUl9BUFBFTkRFRCxcbiAgICAgIEV2ZW50LkJVRkZFUl9GTFVTSEVEKTtcblxuICAgIHRoaXMuY29uZmlnID0gaGxzLmNvbmZpZztcbiAgICB0aGlzLmF1ZGlvQ29kZWNTd2FwID0gZmFsc2U7XG4gICAgdGhpcy50aWNrcyA9IDA7XG4gICAgdGhpcy5vbnRpY2sgPSB0aGlzLnRpY2suYmluZCh0aGlzKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5zdG9wTG9hZCgpO1xuICAgIGlmICh0aGlzLnRpbWVyKSB7XG4gICAgICBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgICAgdGhpcy50aW1lciA9IG51bGw7XG4gICAgfVxuICAgIEV2ZW50SGFuZGxlci5wcm90b3R5cGUuZGVzdHJveS5jYWxsKHRoaXMpO1xuICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5TVE9QUEVEO1xuICB9XG5cbiAgc3RhcnRMb2FkKHN0YXJ0UG9zaXRpb249MCkge1xuICAgIGlmICh0aGlzLmxldmVscykge1xuICAgICAgdmFyIG1lZGlhID0gdGhpcy5tZWRpYSwgbGFzdEN1cnJlbnRUaW1lID0gdGhpcy5sYXN0Q3VycmVudFRpbWU7XG4gICAgICB0aGlzLnN0b3BMb2FkKCk7XG4gICAgICB0aGlzLmRlbXV4ZXIgPSBuZXcgRGVtdXhlcih0aGlzLmhscyk7XG4gICAgICBpZiAoIXRoaXMudGltZXIpIHtcbiAgICAgICAgdGhpcy50aW1lciA9IHNldEludGVydmFsKHRoaXMub250aWNrLCAxMDApO1xuICAgICAgfVxuICAgICAgdGhpcy5sZXZlbCA9IC0xO1xuICAgICAgdGhpcy5mcmFnTG9hZEVycm9yID0gMDtcbiAgICAgIGlmIChtZWRpYSAmJiBsYXN0Q3VycmVudFRpbWUpIHtcbiAgICAgICAgbG9nZ2VyLmxvZyhgY29uZmlndXJlIHN0YXJ0UG9zaXRpb24gQCR7bGFzdEN1cnJlbnRUaW1lfWApO1xuICAgICAgICBpZiAoIXRoaXMubGFzdFBhdXNlZCkge1xuICAgICAgICAgIGxvZ2dlci5sb2coJ3Jlc3VtaW5nIHZpZGVvJyk7XG4gICAgICAgICAgbWVkaWEucGxheSgpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5sYXN0Q3VycmVudFRpbWUgPSB0aGlzLnN0YXJ0UG9zaXRpb24gPyB0aGlzLnN0YXJ0UG9zaXRpb24gOiBzdGFydFBvc2l0aW9uO1xuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuU1RBUlRJTkc7XG4gICAgICB9XG4gICAgICB0aGlzLm5leHRMb2FkUG9zaXRpb24gPSB0aGlzLnN0YXJ0UG9zaXRpb24gPSB0aGlzLmxhc3RDdXJyZW50VGltZTtcbiAgICAgIHRoaXMudGljaygpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsb2dnZXIud2FybignY2Fubm90IHN0YXJ0IGxvYWRpbmcgYXMgbWFuaWZlc3Qgbm90IHBhcnNlZCB5ZXQnKTtcbiAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5TVE9QUEVEO1xuICAgIH1cbiAgfVxuXG4gIHN0b3BMb2FkKCkge1xuICAgIHZhciBmcmFnID0gdGhpcy5mcmFnQ3VycmVudDtcbiAgICBpZiAoZnJhZykge1xuICAgICAgaWYgKGZyYWcubG9hZGVyKSB7XG4gICAgICAgIGZyYWcubG9hZGVyLmFib3J0KCk7XG4gICAgICB9XG4gICAgICB0aGlzLmZyYWdDdXJyZW50ID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5mcmFnUHJldmlvdXMgPSBudWxsO1xuICAgIGlmICh0aGlzLmRlbXV4ZXIpIHtcbiAgICAgIHRoaXMuZGVtdXhlci5kZXN0cm95KCk7XG4gICAgICB0aGlzLmRlbXV4ZXIgPSBudWxsO1xuICAgIH1cbiAgICB0aGlzLnN0YXRlID0gU3RhdGUuU1RPUFBFRDtcbiAgfVxuXG4gIHRpY2soKSB7XG4gICAgdGhpcy50aWNrcysrO1xuICAgIGlmICh0aGlzLnRpY2tzID09PSAxKSB7XG4gICAgICB0aGlzLmRvVGljaygpO1xuICAgICAgaWYgKHRoaXMudGlja3MgPiAxKSB7XG4gICAgICAgIHNldFRpbWVvdXQodGhpcy50aWNrLCAxKTtcbiAgICAgIH1cbiAgICAgIHRoaXMudGlja3MgPSAwO1xuICAgIH1cbiAgfVxuXG4gIGRvVGljaygpIHtcbiAgICB2YXIgcG9zLCBsZXZlbCwgbGV2ZWxEZXRhaWxzLCBobHMgPSB0aGlzLmhscywgY29uZmlnID0gaGxzLmNvbmZpZztcbiAgICBzd2l0Y2godGhpcy5zdGF0ZSkge1xuICAgICAgY2FzZSBTdGF0ZS5FUlJPUjpcbiAgICAgICAgLy9kb24ndCBkbyBhbnl0aGluZyBpbiBlcnJvciBzdGF0ZSB0byBhdm9pZCBicmVha2luZyBmdXJ0aGVyIC4uLlxuICAgICAgY2FzZSBTdGF0ZS5QQVVTRUQ6XG4gICAgICAgIC8vZG9uJ3QgZG8gYW55dGhpbmcgaW4gcGF1c2VkIHN0YXRlIGVpdGhlciAuLi5cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFN0YXRlLlNUQVJUSU5HOlxuICAgICAgICAvLyBkZXRlcm1pbmUgbG9hZCBsZXZlbFxuICAgICAgICB0aGlzLnN0YXJ0TGV2ZWwgPSBobHMuc3RhcnRMZXZlbDtcbiAgICAgICAgaWYgKHRoaXMuc3RhcnRMZXZlbCA9PT0gLTEpIHtcbiAgICAgICAgICAvLyAtMSA6IGd1ZXNzIHN0YXJ0IExldmVsIGJ5IGRvaW5nIGEgYml0cmF0ZSB0ZXN0IGJ5IGxvYWRpbmcgZmlyc3QgZnJhZ21lbnQgb2YgbG93ZXN0IHF1YWxpdHkgbGV2ZWxcbiAgICAgICAgICB0aGlzLnN0YXJ0TGV2ZWwgPSAwO1xuICAgICAgICAgIHRoaXMuZnJhZ0JpdHJhdGVUZXN0ID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICAvLyBzZXQgbmV3IGxldmVsIHRvIHBsYXlsaXN0IGxvYWRlciA6IHRoaXMgd2lsbCB0cmlnZ2VyIHN0YXJ0IGxldmVsIGxvYWRcbiAgICAgICAgdGhpcy5sZXZlbCA9IGhscy5uZXh0TG9hZExldmVsID0gdGhpcy5zdGFydExldmVsO1xuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuV0FJVElOR19MRVZFTDtcbiAgICAgICAgdGhpcy5sb2FkZWRtZXRhZGF0YSA9IGZhbHNlO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgU3RhdGUuSURMRTpcbiAgICAgICAgLy8gaWYgdmlkZW8gbm90IGF0dGFjaGVkIEFORFxuICAgICAgICAvLyBzdGFydCBmcmFnbWVudCBhbHJlYWR5IHJlcXVlc3RlZCBPUiBzdGFydCBmcmFnIHByZWZldGNoIGRpc2FibGVcbiAgICAgICAgLy8gZXhpdCBsb29wXG4gICAgICAgIC8vID0+IGlmIG1lZGlhIG5vdCBhdHRhY2hlZCBidXQgc3RhcnQgZnJhZyBwcmVmZXRjaCBpcyBlbmFibGVkIGFuZCBzdGFydCBmcmFnIG5vdCByZXF1ZXN0ZWQgeWV0LCB3ZSB3aWxsIG5vdCBleGl0IGxvb3BcbiAgICAgICAgaWYgKCF0aGlzLm1lZGlhICYmXG4gICAgICAgICAgKHRoaXMuc3RhcnRGcmFnUmVxdWVzdGVkIHx8ICFjb25maWcuc3RhcnRGcmFnUHJlZmV0Y2gpKSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgLy8gZGV0ZXJtaW5lIG5leHQgY2FuZGlkYXRlIGZyYWdtZW50IHRvIGJlIGxvYWRlZCwgYmFzZWQgb24gY3VycmVudCBwb3NpdGlvbiBhbmRcbiAgICAgICAgLy8gIGVuZCBvZiBidWZmZXIgcG9zaXRpb25cbiAgICAgICAgLy8gIGVuc3VyZSA2MHMgb2YgYnVmZmVyIHVwZnJvbnRcbiAgICAgICAgLy8gaWYgd2UgaGF2ZSBub3QgeWV0IGxvYWRlZCBhbnkgZnJhZ21lbnQsIHN0YXJ0IGxvYWRpbmcgZnJvbSBzdGFydCBwb3NpdGlvblxuICAgICAgICBpZiAodGhpcy5sb2FkZWRtZXRhZGF0YSkge1xuICAgICAgICAgIHBvcyA9IHRoaXMubWVkaWEuY3VycmVudFRpbWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcG9zID0gdGhpcy5uZXh0TG9hZFBvc2l0aW9uO1xuICAgICAgICB9XG4gICAgICAgIC8vIGRldGVybWluZSBuZXh0IGxvYWQgbGV2ZWxcbiAgICAgICAgaWYgKHRoaXMuc3RhcnRGcmFnUmVxdWVzdGVkID09PSBmYWxzZSkge1xuICAgICAgICAgIGxldmVsID0gdGhpcy5zdGFydExldmVsO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIHdlIGFyZSBub3QgYXQgcGxheWJhY2sgc3RhcnQsIGdldCBuZXh0IGxvYWQgbGV2ZWwgZnJvbSBsZXZlbCBDb250cm9sbGVyXG4gICAgICAgICAgbGV2ZWwgPSBobHMubmV4dExvYWRMZXZlbDtcbiAgICAgICAgfVxuICAgICAgICB2YXIgYnVmZmVySW5mbyA9IEJ1ZmZlckhlbHBlci5idWZmZXJJbmZvKHRoaXMubWVkaWEscG9zLGNvbmZpZy5tYXhCdWZmZXJIb2xlKSxcbiAgICAgICAgICAgIGJ1ZmZlckxlbiA9IGJ1ZmZlckluZm8ubGVuLFxuICAgICAgICAgICAgYnVmZmVyRW5kID0gYnVmZmVySW5mby5lbmQsXG4gICAgICAgICAgICBmcmFnUHJldmlvdXMgPSB0aGlzLmZyYWdQcmV2aW91cyxcbiAgICAgICAgICAgIG1heEJ1Zkxlbjtcblx0XHQvLyBjb25zb2xlLmluZm8oYnVmZmVySW5mbyk7XG4gICAgICAgIC8vIGNvbXB1dGUgbWF4IEJ1ZmZlciBMZW5ndGggdGhhdCB3ZSBjb3VsZCBnZXQgZnJvbSB0aGlzIGxvYWQgbGV2ZWwsIGJhc2VkIG9uIGxldmVsIGJpdHJhdGUuIGRvbid0IGJ1ZmZlciBtb3JlIHRoYW4gNjAgTUIgYW5kIG1vcmUgdGhhbiAzMHNcbiAgICAgICAgaWYgKCh0aGlzLmxldmVsc1tsZXZlbF0pLmhhc093blByb3BlcnR5KCdiaXRyYXRlJykpIHtcbiAgICAgICAgICBtYXhCdWZMZW4gPSBNYXRoLm1heCg4ICogY29uZmlnLm1heEJ1ZmZlclNpemUgLyB0aGlzLmxldmVsc1tsZXZlbF0uYml0cmF0ZSwgY29uZmlnLm1heEJ1ZmZlckxlbmd0aCk7XG4gICAgICAgICAgbWF4QnVmTGVuID0gTWF0aC5taW4obWF4QnVmTGVuLCBjb25maWcubWF4TWF4QnVmZmVyTGVuZ3RoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBtYXhCdWZMZW4gPSBjb25maWcubWF4QnVmZmVyTGVuZ3RoO1xuICAgICAgICB9XG4gICAgICAgIC8vIGlmIGJ1ZmZlciBsZW5ndGggaXMgbGVzcyB0aGFuIG1heEJ1ZkxlbiB0cnkgdG8gbG9hZCBhIG5ldyBmcmFnbWVudFxuICAgICAgICBpZiAoYnVmZmVyTGVuIDwgbWF4QnVmTGVuKSB7XG4gICAgICAgICAgLy8gc2V0IG5leHQgbG9hZCBsZXZlbCA6IHRoaXMgd2lsbCB0cmlnZ2VyIGEgcGxheWxpc3QgbG9hZCBpZiBuZWVkZWRcbiAgICAgICAgICBobHMubmV4dExvYWRMZXZlbCA9IGxldmVsO1xuICAgICAgICAgIHRoaXMubGV2ZWwgPSBsZXZlbDtcbiAgICAgICAgICBsZXZlbERldGFpbHMgPSB0aGlzLmxldmVsc1tsZXZlbF0uZGV0YWlscztcbiAgICAgICAgICAvLyBpZiBsZXZlbCBpbmZvIG5vdCByZXRyaWV2ZWQgeWV0LCBzd2l0Y2ggc3RhdGUgYW5kIHdhaXQgZm9yIGxldmVsIHJldHJpZXZhbFxuICAgICAgICAgIC8vIGlmIGxpdmUgcGxheWxpc3QsIGVuc3VyZSB0aGF0IG5ldyBwbGF5bGlzdCBoYXMgYmVlbiByZWZyZXNoZWQgdG8gYXZvaWQgbG9hZGluZy90cnkgdG8gbG9hZFxuICAgICAgICAgIC8vIGEgdXNlbGVzcyBhbmQgb3V0ZGF0ZWQgZnJhZ21lbnQgKHRoYXQgbWlnaHQgZXZlbiBpbnRyb2R1Y2UgbG9hZCBlcnJvciBpZiBpdCBpcyBhbHJlYWR5IG91dCBvZiB0aGUgbGl2ZSBwbGF5bGlzdClcbiAgICAgICAgICBpZiAodHlwZW9mIGxldmVsRGV0YWlscyA9PT0gJ3VuZGVmaW5lZCcgfHwgbGV2ZWxEZXRhaWxzLmxpdmUgJiYgdGhpcy5sZXZlbExhc3RMb2FkZWQgIT09IGxldmVsKSB7XG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuV0FJVElOR19MRVZFTDtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBmaW5kIGZyYWdtZW50IGluZGV4LCBjb250aWd1b3VzIHdpdGggZW5kIG9mIGJ1ZmZlciBwb3NpdGlvblxuICAgICAgICAgIGxldCBmcmFnbWVudHMgPSBsZXZlbERldGFpbHMuZnJhZ21lbnRzLFxuICAgICAgICAgICAgICBmcmFnTGVuID0gZnJhZ21lbnRzLmxlbmd0aCxcbiAgICAgICAgICAgICAgc3RhcnQgPSBmcmFnbWVudHNbMF0uc3RhcnQsXG4gICAgICAgICAgICAgIGVuZCA9IGZyYWdtZW50c1tmcmFnTGVuLTFdLnN0YXJ0ICsgZnJhZ21lbnRzW2ZyYWdMZW4tMV0uZHVyYXRpb24sXG4gICAgICAgICAgICAgIGZyYWc7XG5cbiAgICAgICAgICAgIC8vIGluIGNhc2Ugb2YgbGl2ZSBwbGF5bGlzdCB3ZSBuZWVkIHRvIGVuc3VyZSB0aGF0IHJlcXVlc3RlZCBwb3NpdGlvbiBpcyBub3QgbG9jYXRlZCBiZWZvcmUgcGxheWxpc3Qgc3RhcnRcbiAgICAgICAgICBpZiAobGV2ZWxEZXRhaWxzLmxpdmUpIHtcbiAgICAgICAgICAgIC8vIGNoZWNrIGlmIHJlcXVlc3RlZCBwb3NpdGlvbiBpcyB3aXRoaW4gc2Vla2FibGUgYm91bmRhcmllcyA6XG4gICAgICAgICAgICAvL2xvZ2dlci5sb2coYHN0YXJ0L3Bvcy9idWZFbmQvc2Vla2luZzoke3N0YXJ0LnRvRml4ZWQoMyl9LyR7cG9zLnRvRml4ZWQoMyl9LyR7YnVmZmVyRW5kLnRvRml4ZWQoMyl9LyR7dGhpcy5tZWRpYS5zZWVraW5nfWApO1xuICAgICAgICAgICAgbGV0IG1heExhdGVuY3kgPSBjb25maWcubGl2ZU1heExhdGVuY3lEdXJhdGlvbiAhPT0gdW5kZWZpbmVkID8gY29uZmlnLmxpdmVNYXhMYXRlbmN5RHVyYXRpb24gOiBjb25maWcubGl2ZU1heExhdGVuY3lEdXJhdGlvbkNvdW50KmxldmVsRGV0YWlscy50YXJnZXRkdXJhdGlvbjtcblxuICAgICAgICAgICAgaWYgKGJ1ZmZlckVuZCA8IE1hdGgubWF4KHN0YXJ0LCBlbmQgLSBtYXhMYXRlbmN5KSkge1xuICAgICAgICAgICAgICAgIGxldCB0YXJnZXRMYXRlbmN5ID0gY29uZmlnLmxpdmVTeW5jRHVyYXRpb24gIT09IHVuZGVmaW5lZCA/IGNvbmZpZy5saXZlU3luY0R1cmF0aW9uIDogY29uZmlnLmxpdmVTeW5jRHVyYXRpb25Db3VudCAqIGxldmVsRGV0YWlscy50YXJnZXRkdXJhdGlvbjtcbiAgICAgICAgICAgICAgICB0aGlzLnNlZWtBZnRlckJ1ZmZlcmVkID0gc3RhcnQgKyBNYXRoLm1heCgwLCBsZXZlbERldGFpbHMudG90YWxkdXJhdGlvbiAtIHRhcmdldExhdGVuY3kpO1xuICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYGJ1ZmZlciBlbmQ6ICR7YnVmZmVyRW5kfSBpcyBsb2NhdGVkIHRvbyBmYXIgZnJvbSB0aGUgZW5kIG9mIGxpdmUgc2xpZGluZyBwbGF5bGlzdCwgbWVkaWEgcG9zaXRpb24gd2lsbCBiZSByZXNldGVkIHRvOiAke3RoaXMuc2Vla0FmdGVyQnVmZmVyZWQudG9GaXhlZCgzKX1gKTtcbiAgICAgICAgICAgICAgICBidWZmZXJFbmQgPSB0aGlzLnNlZWtBZnRlckJ1ZmZlcmVkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRoaXMuc3RhcnRGcmFnUmVxdWVzdGVkICYmICFsZXZlbERldGFpbHMuUFRTS25vd24pIHtcbiAgICAgICAgICAgICAgLyogd2UgYXJlIHN3aXRjaGluZyBsZXZlbCBvbiBsaXZlIHBsYXlsaXN0LCBidXQgd2UgZG9uJ3QgaGF2ZSBhbnkgUFRTIGluZm8gZm9yIHRoYXQgcXVhbGl0eSBsZXZlbCAuLi5cbiAgICAgICAgICAgICAgICAgdHJ5IHRvIGxvYWQgZnJhZyBtYXRjaGluZyB3aXRoIG5leHQgU04uXG4gICAgICAgICAgICAgICAgIGV2ZW4gaWYgU04gYXJlIG5vdCBzeW5jaHJvbml6ZWQgYmV0d2VlbiBwbGF5bGlzdHMsIGxvYWRpbmcgdGhpcyBmcmFnIHdpbGwgaGVscCB1c1xuICAgICAgICAgICAgICAgICBjb21wdXRlIHBsYXlsaXN0IHNsaWRpbmcgYW5kIGZpbmQgdGhlIHJpZ2h0IG9uZSBhZnRlciBpbiBjYXNlIGl0IHdhcyBub3QgdGhlIHJpZ2h0IGNvbnNlY3V0aXZlIG9uZSAqL1xuICAgICAgICAgICAgICBpZiAoZnJhZ1ByZXZpb3VzKSB7XG4gICAgICAgICAgICAgICAgdmFyIHRhcmdldFNOID0gZnJhZ1ByZXZpb3VzLnNuICsgMTtcbiAgICAgICAgICAgICAgICBpZiAodGFyZ2V0U04gPj0gbGV2ZWxEZXRhaWxzLnN0YXJ0U04gJiYgdGFyZ2V0U04gPD0gbGV2ZWxEZXRhaWxzLmVuZFNOKSB7XG4gICAgICAgICAgICAgICAgICBmcmFnID0gZnJhZ21lbnRzW3RhcmdldFNOIC0gbGV2ZWxEZXRhaWxzLnN0YXJ0U05dO1xuICAgICAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgbGl2ZSBwbGF5bGlzdCwgc3dpdGNoaW5nIHBsYXlsaXN0LCBsb2FkIGZyYWcgd2l0aCBuZXh0IFNOOiAke2ZyYWcuc259YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmICghZnJhZykge1xuICAgICAgICAgICAgICAgIC8qIHdlIGhhdmUgbm8gaWRlYSBhYm91dCB3aGljaCBmcmFnbWVudCBzaG91bGQgYmUgbG9hZGVkLlxuICAgICAgICAgICAgICAgICAgIHNvIGxldCdzIGxvYWQgbWlkIGZyYWdtZW50LiBpdCB3aWxsIGhlbHAgY29tcHV0aW5nIHBsYXlsaXN0IHNsaWRpbmcgYW5kIGZpbmQgdGhlIHJpZ2h0IG9uZVxuICAgICAgICAgICAgICAgICovXG4gICAgICAgICAgICAgICAgZnJhZyA9IGZyYWdtZW50c1tNYXRoLm1pbihmcmFnTGVuIC0gMSwgTWF0aC5yb3VuZChmcmFnTGVuIC8gMikpXTtcbiAgICAgICAgICAgICAgICBsb2dnZXIubG9nKGBsaXZlIHBsYXlsaXN0LCBzd2l0Y2hpbmcgcGxheWxpc3QsIHVua25vd24sIGxvYWQgbWlkZGxlIGZyYWcgOiAke2ZyYWcuc259YCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gVm9EIHBsYXlsaXN0OiBpZiBidWZmZXJFbmQgYmVmb3JlIHN0YXJ0IG9mIHBsYXlsaXN0LCBsb2FkIGZpcnN0IGZyYWdtZW50XG4gICAgICAgICAgICBpZiAoYnVmZmVyRW5kIDwgc3RhcnQpIHtcbiAgICAgICAgICAgICAgZnJhZyA9IGZyYWdtZW50c1swXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKCFmcmFnKSB7XG4gICAgICAgICAgICBsZXQgZm91bmRGcmFnO1xuICAgICAgICAgICAgbGV0IG1heEZyYWdMb29rVXBUb2xlcmFuY2UgPSBjb25maWcubWF4RnJhZ0xvb2tVcFRvbGVyYW5jZTtcbiAgICAgICAgICAgIGlmIChidWZmZXJFbmQgPCBlbmQpIHtcbiAgICAgICAgICAgICAgaWYgKGJ1ZmZlckVuZCA+IGVuZCAtIG1heEZyYWdMb29rVXBUb2xlcmFuY2UpIHtcbiAgICAgICAgICAgICAgICBtYXhGcmFnTG9va1VwVG9sZXJhbmNlID0gMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBmb3VuZEZyYWcgPSBCaW5hcnlTZWFyY2guc2VhcmNoKGZyYWdtZW50cywgKGNhbmRpZGF0ZSkgPT4ge1xuICAgICAgICAgICAgICAgIC8vIG9mZnNldCBzaG91bGQgYmUgd2l0aGluIGZyYWdtZW50IGJvdW5kYXJ5IC0gY29uZmlnLm1heEZyYWdMb29rVXBUb2xlcmFuY2VcbiAgICAgICAgICAgICAgICAvLyB0aGlzIGlzIHRvIGNvcGUgd2l0aCBzaXR1YXRpb25zIGxpa2VcbiAgICAgICAgICAgICAgICAvLyBidWZmZXJFbmQgPSA5Ljk5MVxuICAgICAgICAgICAgICAgIC8vIGZyYWdbw5hdIDogWzAsMTBdXG4gICAgICAgICAgICAgICAgLy8gZnJhZ1sxXSA6IFsxMCwyMF1cbiAgICAgICAgICAgICAgICAvLyBidWZmZXJFbmQgaXMgd2l0aGluIGZyYWdbMF0gcmFuZ2UgLi4uIGFsdGhvdWdoIHdoYXQgd2UgYXJlIGV4cGVjdGluZyBpcyB0byByZXR1cm4gZnJhZ1sxXSBoZXJlXG4gICAgICAgICAgICAgICAgICAgIC8vICAgICAgICAgICAgICBmcmFnIHN0YXJ0ICAgICAgICAgICAgICAgZnJhZyBzdGFydCtkdXJhdGlvblxuICAgICAgICAgICAgICAgICAgICAvLyAgICAgICAgICAgICAgICAgIHwtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLXxcbiAgICAgICAgICAgICAgICAgICAgLy8gICAgICAgICAgICAgIDwtLS0+ICAgICAgICAgICAgICAgICAgICAgICAgIDwtLS0+XG4gICAgICAgICAgICAgICAgICAgIC8vICAuLi4tLS0tLS0tLT48LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0+PC0tLS0tLS0tLS4uLi5cbiAgICAgICAgICAgICAgICAgICAgLy8gcHJldmlvdXMgZnJhZyAgICAgICAgIG1hdGNoaW5nIGZyYWdtZW50ICAgICAgICAgbmV4dCBmcmFnXG4gICAgICAgICAgICAgICAgICAgIC8vICByZXR1cm4gLTEgICAgICAgICAgICAgcmV0dXJuIDAgICAgICAgICAgICAgICAgIHJldHVybiAxXG4gICAgICAgICAgICAgICAgLy8gbG9nZ2VyLmxvZyhgbGV2ZWwvc24vc3RhcnQvZW5kL2J1ZkVuZDoke2xldmVsfS8ke2NhbmRpZGF0ZS5zbn0vJHtjYW5kaWRhdGUuc3RhcnQgLSBtYXhGcmFnTG9va1VwVG9sZXJhbmNlfS8keyhjYW5kaWRhdGUuc3RhcnQrY2FuZGlkYXRlLmR1cmF0aW9uIC0gbWF4RnJhZ0xvb2tVcFRvbGVyYW5jZSl9LyR7YnVmZmVyRW5kfWApO1xuICAgICAgICAgICAgICAgIGlmICgoY2FuZGlkYXRlLnN0YXJ0ICsgY2FuZGlkYXRlLmR1cmF0aW9uIC0gbWF4RnJhZ0xvb2tVcFRvbGVyYW5jZSkgPD0gYnVmZmVyRW5kKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoY2FuZGlkYXRlLnN0YXJ0IC0gbWF4RnJhZ0xvb2tVcFRvbGVyYW5jZSA+IGJ1ZmZlckVuZCkge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICAgICAgICAgIH1cblx0XHRcdCAgXHQvLyBjb25zb2xlLmluZm8oY2FuZGlkYXRlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgICAgICAgfSk7XG5cdFx0XHQgIC8vIGNvbnNvbGUuaW5mbyhmb3VuZEZyYWcpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gcmVhY2ggZW5kIG9mIHBsYXlsaXN0XG4gICAgICAgICAgICAgIGZvdW5kRnJhZyA9IGZyYWdtZW50c1tmcmFnTGVuLTFdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGZvdW5kRnJhZykge1xuICAgICAgICAgICAgICBmcmFnID0gZm91bmRGcmFnO1xuICAgICAgICAgICAgICBzdGFydCA9IGZvdW5kRnJhZy5zdGFydDtcbiAgICAgICAgICAgICAgLy9sb2dnZXIubG9nKCdmaW5kIFNOIG1hdGNoaW5nIHdpdGggcG9zOicgKyAgYnVmZmVyRW5kICsgJzonICsgZnJhZy5zbik7XG4gICAgICAgICAgICAgIGlmIChmcmFnUHJldmlvdXMgJiYgZnJhZy5sZXZlbCA9PT0gZnJhZ1ByZXZpb3VzLmxldmVsICYmIGZyYWcuc24gPT09IGZyYWdQcmV2aW91cy5zbikge1xuICAgICAgICAgICAgICAgIGlmIChmcmFnLnNuIDwgbGV2ZWxEZXRhaWxzLmVuZFNOKSB7XG4gICAgICAgICAgICAgICAgICBmcmFnID0gZnJhZ21lbnRzW2ZyYWcuc24gKyAxIC0gbGV2ZWxEZXRhaWxzLnN0YXJ0U05dO1xuICAgICAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgU04ganVzdCBsb2FkZWQsIGxvYWQgbmV4dCBvbmU6ICR7ZnJhZy5zbn1gKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgLy8gaGF2ZSB3ZSByZWFjaGVkIGVuZCBvZiBWT0QgcGxheWxpc3QgP1xuICAgICAgICAgICAgICAgICAgaWYgKCFsZXZlbERldGFpbHMubGl2ZSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkJVRkZFUl9FT1MpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuRU5ERUQ7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBmcmFnID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYoZnJhZykge1xuICAgICAgICAgICAgLy9sb2dnZXIubG9nKCcgICAgICBsb2FkaW5nIGZyYWcgJyArIGkgKycscG9zL2J1ZkVuZDonICsgcG9zLnRvRml4ZWQoMykgKyAnLycgKyBidWZmZXJFbmQudG9GaXhlZCgzKSk7XG4gICAgICAgICAgICBpZiAoKGZyYWcuZGVjcnlwdGRhdGEudXJpICE9IG51bGwpICYmIChmcmFnLmRlY3J5cHRkYXRhLmtleSA9PSBudWxsKSkge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBMb2FkaW5nIGtleSBmb3IgJHtmcmFnLnNufSBvZiBbJHtsZXZlbERldGFpbHMuc3RhcnRTTn0gLCR7bGV2ZWxEZXRhaWxzLmVuZFNOfV0sbGV2ZWwgJHtsZXZlbH1gKTtcbiAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLktFWV9MT0FESU5HO1xuICAgICAgICAgICAgICBobHMudHJpZ2dlcihFdmVudC5LRVlfTE9BRElORywge2ZyYWc6IGZyYWd9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coYExvYWRpbmcgJHtmcmFnLnNufSBvZiBbJHtsZXZlbERldGFpbHMuc3RhcnRTTn0gLCR7bGV2ZWxEZXRhaWxzLmVuZFNOfV0sbGV2ZWwgJHtsZXZlbH0sIGN1cnJlbnRUaW1lOiR7cG9zfSxidWZmZXJFbmQ6JHtidWZmZXJFbmQudG9GaXhlZCgzKX1gKTtcbiAgICAgICAgICAgICAgZnJhZy5hdXRvTGV2ZWwgPSBobHMuYXV0b0xldmVsRW5hYmxlZDtcbiAgICAgICAgICAgICAgaWYgKHRoaXMubGV2ZWxzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgICBmcmFnLmV4cGVjdGVkTGVuID0gTWF0aC5yb3VuZChmcmFnLmR1cmF0aW9uICogdGhpcy5sZXZlbHNbbGV2ZWxdLmJpdHJhdGUgLyA4KTtcbiAgICAgICAgICAgICAgICBmcmFnLnRyZXF1ZXN0ID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgLy8gZW5zdXJlIHRoYXQgd2UgYXJlIG5vdCByZWxvYWRpbmcgdGhlIHNhbWUgZnJhZ21lbnRzIGluIGxvb3AgLi4uXG4gICAgICAgICAgICAgIGlmICh0aGlzLmZyYWdMb2FkSWR4ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmZyYWdMb2FkSWR4Kys7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5mcmFnTG9hZElkeCA9IDA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKGZyYWcubG9hZENvdW50ZXIpIHtcbiAgICAgICAgICAgICAgICBmcmFnLmxvYWRDb3VudGVyKys7XG4gICAgICAgICAgICAgICAgbGV0IG1heFRocmVzaG9sZCA9IGNvbmZpZy5mcmFnTG9hZGluZ0xvb3BUaHJlc2hvbGQ7XG4gICAgICAgICAgICAgICAgLy8gaWYgdGhpcyBmcmFnIGhhcyBhbHJlYWR5IGJlZW4gbG9hZGVkIDMgdGltZXMsIGFuZCBpZiBpdCBoYXMgYmVlbiByZWxvYWRlZCByZWNlbnRseVxuICAgICAgICAgICAgICAgIGlmIChmcmFnLmxvYWRDb3VudGVyID4gbWF4VGhyZXNob2xkICYmIChNYXRoLmFicyh0aGlzLmZyYWdMb2FkSWR4IC0gZnJhZy5sb2FkSWR4KSA8IG1heFRocmVzaG9sZCkpIHtcbiAgICAgICAgICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkZSQUdfTE9PUF9MT0FESU5HX0VSUk9SLCBmYXRhbDogZmFsc2UsIGZyYWc6IGZyYWd9KTtcbiAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZnJhZy5sb2FkQ291bnRlciA9IDE7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZnJhZy5sb2FkSWR4ID0gdGhpcy5mcmFnTG9hZElkeDtcbiAgICAgICAgICAgICAgdGhpcy5mcmFnQ3VycmVudCA9IGZyYWc7XG4gICAgICAgICAgICAgIHRoaXMuc3RhcnRGcmFnUmVxdWVzdGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuRlJBR19MT0FESU5HLCB7ZnJhZzogZnJhZ30pO1xuICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuRlJBR19MT0FESU5HO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgU3RhdGUuV0FJVElOR19MRVZFTDpcbiAgICAgICAgbGV2ZWwgPSB0aGlzLmxldmVsc1t0aGlzLmxldmVsXTtcbiAgICAgICAgLy8gY2hlY2sgaWYgcGxheWxpc3QgaXMgYWxyZWFkeSBsb2FkZWRcbiAgICAgICAgaWYgKGxldmVsICYmIGxldmVsLmRldGFpbHMpIHtcbiAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgU3RhdGUuRlJBR19MT0FESU5HX1dBSVRJTkdfUkVUUlk6XG4gICAgICAgIHZhciBub3cgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgdmFyIHJldHJ5RGF0ZSA9IHRoaXMucmV0cnlEYXRlO1xuICAgICAgICB2YXIgbWVkaWEgPSB0aGlzLm1lZGlhO1xuICAgICAgICB2YXIgaXNTZWVraW5nID0gbWVkaWEgJiYgbWVkaWEuc2Vla2luZztcbiAgICAgICAgLy8gaWYgY3VycmVudCB0aW1lIGlzIGd0IHRoYW4gcmV0cnlEYXRlLCBvciBpZiBtZWRpYSBzZWVraW5nIGxldCdzIHN3aXRjaCB0byBJRExFIHN0YXRlIHRvIHJldHJ5IGxvYWRpbmdcbiAgICAgICAgaWYoIXJldHJ5RGF0ZSB8fCAobm93ID49IHJldHJ5RGF0ZSkgfHwgaXNTZWVraW5nKSB7XG4gICAgICAgICAgbG9nZ2VyLmxvZyhgbWVkaWFDb250cm9sbGVyOiByZXRyeURhdGUgcmVhY2hlZCwgc3dpdGNoIGJhY2sgdG8gSURMRSBzdGF0ZWApO1xuICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBTdGF0ZS5TVE9QUEVEOlxuICAgICAgY2FzZSBTdGF0ZS5GUkFHX0xPQURJTkc6XG4gICAgICBjYXNlIFN0YXRlLlBBUlNJTkc6XG4gICAgICBjYXNlIFN0YXRlLlBBUlNFRDpcbiAgICAgIGNhc2UgU3RhdGUuRU5ERUQ6XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIC8vIGNoZWNrIGJ1ZmZlclxuICAgIHRoaXMuX2NoZWNrQnVmZmVyKCk7XG4gICAgLy8gY2hlY2svdXBkYXRlIGN1cnJlbnQgZnJhZ21lbnRcbiAgICB0aGlzLl9jaGVja0ZyYWdtZW50Q2hhbmdlZCgpO1xuICB9XG5cblxuXG5cbiAgZ2V0QnVmZmVyUmFuZ2UocG9zaXRpb24pIHtcbiAgICB2YXIgaSwgcmFuZ2UsXG4gICAgICAgIGJ1ZmZlclJhbmdlID0gdGhpcy5idWZmZXJSYW5nZTtcbiAgICBpZiAoYnVmZmVyUmFuZ2UpIHtcbiAgICAgIGZvciAoaSA9IGJ1ZmZlclJhbmdlLmxlbmd0aCAtIDE7IGkgPj0wOyBpLS0pIHtcbiAgICAgICAgcmFuZ2UgPSBidWZmZXJSYW5nZVtpXTtcbiAgICAgICAgaWYgKHBvc2l0aW9uID49IHJhbmdlLnN0YXJ0ICYmIHBvc2l0aW9uIDw9IHJhbmdlLmVuZCkge1xuICAgICAgICAgIHJldHVybiByYW5nZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGdldCBjdXJyZW50TGV2ZWwoKSB7XG4gICAgaWYgKHRoaXMubWVkaWEpIHtcbiAgICAgIHZhciByYW5nZSA9IHRoaXMuZ2V0QnVmZmVyUmFuZ2UodGhpcy5tZWRpYS5jdXJyZW50VGltZSk7XG4gICAgICBpZiAocmFuZ2UpIHtcbiAgICAgICAgcmV0dXJuIHJhbmdlLmZyYWcubGV2ZWw7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiAtMTtcbiAgfVxuXG4gIGdldCBuZXh0QnVmZmVyUmFuZ2UoKSB7XG4gICAgaWYgKHRoaXMubWVkaWEpIHtcbiAgICAgIC8vIGZpcnN0IGdldCBlbmQgcmFuZ2Ugb2YgY3VycmVudCBmcmFnbWVudFxuICAgICAgcmV0dXJuIHRoaXMuZm9sbG93aW5nQnVmZmVyUmFuZ2UodGhpcy5nZXRCdWZmZXJSYW5nZSh0aGlzLm1lZGlhLmN1cnJlbnRUaW1lKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGZvbGxvd2luZ0J1ZmZlclJhbmdlKHJhbmdlKSB7XG4gICAgaWYgKHJhbmdlKSB7XG4gICAgICAvLyB0cnkgdG8gZ2V0IHJhbmdlIG9mIG5leHQgZnJhZ21lbnQgKDUwMG1zIGFmdGVyIHRoaXMgcmFuZ2UpXG4gICAgICByZXR1cm4gdGhpcy5nZXRCdWZmZXJSYW5nZShyYW5nZS5lbmQgKyAwLjUpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGdldCBuZXh0TGV2ZWwoKSB7XG4gICAgdmFyIHJhbmdlID0gdGhpcy5uZXh0QnVmZmVyUmFuZ2U7XG4gICAgaWYgKHJhbmdlKSB7XG4gICAgICByZXR1cm4gcmFuZ2UuZnJhZy5sZXZlbDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIC0xO1xuICAgIH1cbiAgfVxuXG4gIGlzQnVmZmVyZWQocG9zaXRpb24pIHtcbiAgICB2YXIgdiA9IHRoaXMubWVkaWEsIGJ1ZmZlcmVkID0gdi5idWZmZXJlZDtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGJ1ZmZlcmVkLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAocG9zaXRpb24gPj0gYnVmZmVyZWQuc3RhcnQoaSkgJiYgcG9zaXRpb24gPD0gYnVmZmVyZWQuZW5kKGkpKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBfY2hlY2tGcmFnbWVudENoYW5nZWQoKSB7XG4gICAgdmFyIHJhbmdlQ3VycmVudCwgY3VycmVudFRpbWUsIHZpZGVvID0gdGhpcy5tZWRpYTtcbiAgICBpZiAodmlkZW8gJiYgdmlkZW8uc2Vla2luZyA9PT0gZmFsc2UpIHtcbiAgICAgIGN1cnJlbnRUaW1lID0gdmlkZW8uY3VycmVudFRpbWU7XG4gICAgICAvKiBpZiB2aWRlbyBlbGVtZW50IGlzIGluIHNlZWtlZCBzdGF0ZSwgY3VycmVudFRpbWUgY2FuIG9ubHkgaW5jcmVhc2UuXG4gICAgICAgIChhc3N1bWluZyB0aGF0IHBsYXliYWNrIHJhdGUgaXMgcG9zaXRpdmUgLi4uKVxuICAgICAgICBBcyBzb21ldGltZXMgY3VycmVudFRpbWUganVtcHMgYmFjayB0byB6ZXJvIGFmdGVyIGFcbiAgICAgICAgbWVkaWEgZGVjb2RlIGVycm9yLCBjaGVjayB0aGlzLCB0byBhdm9pZCBzZWVraW5nIGJhY2sgdG9cbiAgICAgICAgd3JvbmcgcG9zaXRpb24gYWZ0ZXIgYSBtZWRpYSBkZWNvZGUgZXJyb3JcbiAgICAgICovXG4gICAgICBpZihjdXJyZW50VGltZSA+IHZpZGVvLnBsYXliYWNrUmF0ZSp0aGlzLmxhc3RDdXJyZW50VGltZSkge1xuICAgICAgICB0aGlzLmxhc3RDdXJyZW50VGltZSA9IGN1cnJlbnRUaW1lO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMuaXNCdWZmZXJlZChjdXJyZW50VGltZSkpIHtcbiAgICAgICAgcmFuZ2VDdXJyZW50ID0gdGhpcy5nZXRCdWZmZXJSYW5nZShjdXJyZW50VGltZSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuaXNCdWZmZXJlZChjdXJyZW50VGltZSArIDAuMSkpIHtcbiAgICAgICAgLyogZW5zdXJlIHRoYXQgRlJBR19DSEFOR0VEIGV2ZW50IGlzIHRyaWdnZXJlZCBhdCBzdGFydHVwLFxuICAgICAgICAgIHdoZW4gZmlyc3QgdmlkZW8gZnJhbWUgaXMgZGlzcGxheWVkIGFuZCBwbGF5YmFjayBpcyBwYXVzZWQuXG4gICAgICAgICAgYWRkIGEgdG9sZXJhbmNlIG9mIDEwMG1zLCBpbiBjYXNlIGN1cnJlbnQgcG9zaXRpb24gaXMgbm90IGJ1ZmZlcmVkLFxuICAgICAgICAgIGNoZWNrIGlmIGN1cnJlbnQgcG9zKzEwMG1zIGlzIGJ1ZmZlcmVkIGFuZCB1c2UgdGhhdCBidWZmZXIgcmFuZ2VcbiAgICAgICAgICBmb3IgRlJBR19DSEFOR0VEIGV2ZW50IHJlcG9ydGluZyAqL1xuICAgICAgICByYW5nZUN1cnJlbnQgPSB0aGlzLmdldEJ1ZmZlclJhbmdlKGN1cnJlbnRUaW1lICsgMC4xKTtcbiAgICAgIH1cbiAgICAgIGlmIChyYW5nZUN1cnJlbnQpIHtcbiAgICAgICAgdmFyIGZyYWdQbGF5aW5nID0gcmFuZ2VDdXJyZW50LmZyYWc7XG4gICAgICAgIGlmIChmcmFnUGxheWluZyAhPT0gdGhpcy5mcmFnUGxheWluZykge1xuICAgICAgICAgIHRoaXMuZnJhZ1BsYXlpbmcgPSBmcmFnUGxheWluZztcbiAgICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkZSQUdfQ0hBTkdFRCwge2ZyYWc6IGZyYWdQbGF5aW5nfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKlxuICAgIG9uIGltbWVkaWF0ZSBsZXZlbCBzd2l0Y2ggOlxuICAgICAtIHBhdXNlIHBsYXliYWNrIGlmIHBsYXlpbmdcbiAgICAgLSBjYW5jZWwgYW55IHBlbmRpbmcgbG9hZCByZXF1ZXN0XG4gICAgIC0gYW5kIHRyaWdnZXIgYSBidWZmZXIgZmx1c2hcbiAgKi9cbiAgaW1tZWRpYXRlTGV2ZWxTd2l0Y2goKSB7XG4gICAgbG9nZ2VyLmxvZygnaW1tZWRpYXRlTGV2ZWxTd2l0Y2gnKTtcbiAgICBpZiAoIXRoaXMuaW1tZWRpYXRlU3dpdGNoKSB7XG4gICAgICB0aGlzLmltbWVkaWF0ZVN3aXRjaCA9IHRydWU7XG4gICAgICB0aGlzLnByZXZpb3VzbHlQYXVzZWQgPSB0aGlzLm1lZGlhLnBhdXNlZDtcbiAgICAgIHRoaXMubWVkaWEucGF1c2UoKTtcbiAgICB9XG4gICAgdmFyIGZyYWdDdXJyZW50ID0gdGhpcy5mcmFnQ3VycmVudDtcbiAgICBpZiAoZnJhZ0N1cnJlbnQgJiYgZnJhZ0N1cnJlbnQubG9hZGVyKSB7XG4gICAgICBmcmFnQ3VycmVudC5sb2FkZXIuYWJvcnQoKTtcbiAgICB9XG4gICAgdGhpcy5mcmFnQ3VycmVudCA9IG51bGw7XG4gICAgLy8gZmx1c2ggZXZlcnl0aGluZ1xuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuQlVGRkVSX0ZMVVNISU5HLCB7c3RhcnRPZmZzZXQ6IDAsIGVuZE9mZnNldDogTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZfSk7XG4gICAgdGhpcy5zdGF0ZSA9IFN0YXRlLlBBVVNFRDtcbiAgICAvLyBpbmNyZWFzZSBmcmFnbWVudCBsb2FkIEluZGV4IHRvIGF2b2lkIGZyYWcgbG9vcCBsb2FkaW5nIGVycm9yIGFmdGVyIGJ1ZmZlciBmbHVzaFxuICAgIHRoaXMuZnJhZ0xvYWRJZHggKz0gMiAqIHRoaXMuY29uZmlnLmZyYWdMb2FkaW5nTG9vcFRocmVzaG9sZDtcbiAgICAvLyBzcGVlZCB1cCBzd2l0Y2hpbmcsIHRyaWdnZXIgdGltZXIgZnVuY3Rpb25cbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4gIC8qXG4gICAgIG9uIGltbWVkaWF0ZSBsZXZlbCBzd2l0Y2ggZW5kLCBhZnRlciBuZXcgZnJhZ21lbnQgaGFzIGJlZW4gYnVmZmVyZWQgOlxuICAgICAgLSBudWRnZSB2aWRlbyBkZWNvZGVyIGJ5IHNsaWdodGx5IGFkanVzdGluZyB2aWRlbyBjdXJyZW50VGltZVxuICAgICAgLSByZXN1bWUgdGhlIHBsYXliYWNrIGlmIG5lZWRlZFxuICAqL1xuICBpbW1lZGlhdGVMZXZlbFN3aXRjaEVuZCgpIHtcbiAgICB0aGlzLmltbWVkaWF0ZVN3aXRjaCA9IGZhbHNlO1xuICAgIHRoaXMubWVkaWEuY3VycmVudFRpbWUgLT0gMC4wMDAxO1xuICAgIGlmICghdGhpcy5wcmV2aW91c2x5UGF1c2VkKSB7XG4gICAgICB0aGlzLm1lZGlhLnBsYXkoKTtcbiAgICB9XG4gIH1cblxuICBuZXh0TGV2ZWxTd2l0Y2goKSB7XG4gICAgLyogdHJ5IHRvIHN3aXRjaCBBU0FQIHdpdGhvdXQgYnJlYWtpbmcgdmlkZW8gcGxheWJhY2sgOlxuICAgICAgIGluIG9yZGVyIHRvIGVuc3VyZSBzbW9vdGggYnV0IHF1aWNrIGxldmVsIHN3aXRjaGluZyxcbiAgICAgIHdlIG5lZWQgdG8gZmluZCB0aGUgbmV4dCBmbHVzaGFibGUgYnVmZmVyIHJhbmdlXG4gICAgICB3ZSBzaG91bGQgdGFrZSBpbnRvIGFjY291bnQgbmV3IHNlZ21lbnQgZmV0Y2ggdGltZVxuICAgICovXG4gICAgdmFyIGZldGNoZGVsYXksIGN1cnJlbnRSYW5nZSwgbmV4dFJhbmdlO1xuICAgIGN1cnJlbnRSYW5nZSA9IHRoaXMuZ2V0QnVmZmVyUmFuZ2UodGhpcy5tZWRpYS5jdXJyZW50VGltZSk7XG4gICAgaWYgKGN1cnJlbnRSYW5nZSAmJiBjdXJyZW50UmFuZ2Uuc3RhcnQgPiAxKSB7XG4gICAgLy8gZmx1c2ggYnVmZmVyIHByZWNlZGluZyBjdXJyZW50IGZyYWdtZW50IChmbHVzaCB1bnRpbCBjdXJyZW50IGZyYWdtZW50IHN0YXJ0IG9mZnNldClcbiAgICAvLyBtaW51cyAxcyB0byBhdm9pZCB2aWRlbyBmcmVlemluZywgdGhhdCBjb3VsZCBoYXBwZW4gaWYgd2UgZmx1c2gga2V5ZnJhbWUgb2YgY3VycmVudCB2aWRlbyAuLi5cbiAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuQlVGRkVSX0ZMVVNISU5HLCB7c3RhcnRPZmZzZXQ6IDAsIGVuZE9mZnNldDogY3VycmVudFJhbmdlLnN0YXJ0IC0gMX0pO1xuICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLlBBVVNFRDtcbiAgICB9XG4gICAgaWYgKCF0aGlzLm1lZGlhLnBhdXNlZCkge1xuICAgICAgLy8gYWRkIGEgc2FmZXR5IGRlbGF5IG9mIDFzXG4gICAgICB2YXIgbmV4dExldmVsSWQgPSB0aGlzLmhscy5uZXh0TG9hZExldmVsLG5leHRMZXZlbCA9IHRoaXMubGV2ZWxzW25leHRMZXZlbElkXSwgZnJhZ0xhc3RLYnBzID0gdGhpcy5mcmFnTGFzdEticHM7XG4gICAgICBpZiAoZnJhZ0xhc3RLYnBzICYmIHRoaXMuZnJhZ0N1cnJlbnQpIHtcbiAgICAgICAgZmV0Y2hkZWxheSA9IHRoaXMuZnJhZ0N1cnJlbnQuZHVyYXRpb24gKiBuZXh0TGV2ZWwuYml0cmF0ZSAvICgxMDAwICogZnJhZ0xhc3RLYnBzKSArIDE7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmZXRjaGRlbGF5ID0gMDtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgZmV0Y2hkZWxheSA9IDA7XG4gICAgfVxuICAgIC8vbG9nZ2VyLmxvZygnZmV0Y2hkZWxheTonK2ZldGNoZGVsYXkpO1xuICAgIC8vIGZpbmQgYnVmZmVyIHJhbmdlIHRoYXQgd2lsbCBiZSByZWFjaGVkIG9uY2UgbmV3IGZyYWdtZW50IHdpbGwgYmUgZmV0Y2hlZFxuICAgIG5leHRSYW5nZSA9IHRoaXMuZ2V0QnVmZmVyUmFuZ2UodGhpcy5tZWRpYS5jdXJyZW50VGltZSArIGZldGNoZGVsYXkpO1xuICAgIGlmIChuZXh0UmFuZ2UpIHtcbiAgICAgIC8vIHdlIGNhbiBmbHVzaCBidWZmZXIgcmFuZ2UgZm9sbG93aW5nIHRoaXMgb25lIHdpdGhvdXQgc3RhbGxpbmcgcGxheWJhY2tcbiAgICAgIG5leHRSYW5nZSA9IHRoaXMuZm9sbG93aW5nQnVmZmVyUmFuZ2UobmV4dFJhbmdlKTtcbiAgICAgIGlmIChuZXh0UmFuZ2UpIHtcbiAgICAgICAgLy8gZmx1c2ggcG9zaXRpb24gaXMgdGhlIHN0YXJ0IHBvc2l0aW9uIG9mIHRoaXMgbmV3IGJ1ZmZlclxuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkJVRkZFUl9GTFVTSElORywge3N0YXJ0T2Zmc2V0OiBuZXh0UmFuZ2Uuc3RhcnQsIGVuZE9mZnNldDogTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZfSk7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5QQVVTRUQ7XG4gICAgICAgIC8vIGlmIHdlIGFyZSBoZXJlLCB3ZSBjYW4gYWxzbyBjYW5jZWwgYW55IGxvYWRpbmcvZGVtdXhpbmcgaW4gcHJvZ3Jlc3MsIGFzIHRoZXkgYXJlIHVzZWxlc3NcbiAgICAgICAgdmFyIGZyYWdDdXJyZW50ID0gdGhpcy5mcmFnQ3VycmVudDtcbiAgICAgICAgaWYgKGZyYWdDdXJyZW50ICYmIGZyYWdDdXJyZW50LmxvYWRlcikge1xuICAgICAgICAgIGZyYWdDdXJyZW50LmxvYWRlci5hYm9ydCgpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZnJhZ0N1cnJlbnQgPSBudWxsO1xuICAgICAgICAvLyBpbmNyZWFzZSBmcmFnbWVudCBsb2FkIEluZGV4IHRvIGF2b2lkIGZyYWcgbG9vcCBsb2FkaW5nIGVycm9yIGFmdGVyIGJ1ZmZlciBmbHVzaFxuICAgICAgICB0aGlzLmZyYWdMb2FkSWR4ICs9IDIgKiB0aGlzLmNvbmZpZy5mcmFnTG9hZGluZ0xvb3BUaHJlc2hvbGQ7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgb25NZWRpYUF0dGFjaGVkKGRhdGEpIHtcbiAgICB2YXIgbWVkaWEgPSB0aGlzLm1lZGlhID0gZGF0YS5tZWRpYTtcbiAgICB0aGlzLm9udnNlZWtpbmcgPSB0aGlzLm9uTWVkaWFTZWVraW5nLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbnZzZWVrZWQgPSB0aGlzLm9uTWVkaWFTZWVrZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9udmVuZGVkID0gdGhpcy5vbk1lZGlhRW5kZWQuYmluZCh0aGlzKTtcbiAgICBtZWRpYS5hZGRFdmVudExpc3RlbmVyKCdzZWVraW5nJywgdGhpcy5vbnZzZWVraW5nKTtcbiAgICBtZWRpYS5hZGRFdmVudExpc3RlbmVyKCdzZWVrZWQnLCB0aGlzLm9udnNlZWtlZCk7XG4gICAgbWVkaWEuYWRkRXZlbnRMaXN0ZW5lcignZW5kZWQnLCB0aGlzLm9udmVuZGVkKTtcbiAgICBpZih0aGlzLmxldmVscyAmJiB0aGlzLmNvbmZpZy5hdXRvU3RhcnRMb2FkKSB7XG4gICAgICB0aGlzLmhscy5zdGFydExvYWQoKTtcbiAgICB9XG4gIH1cblxuICBvbk1lZGlhRGV0YWNoaW5nKCkge1xuICAgIHZhciBtZWRpYSA9IHRoaXMubWVkaWE7XG4gICAgaWYgKG1lZGlhICYmIG1lZGlhLmVuZGVkKSB7XG4gICAgICBsb2dnZXIubG9nKCdNU0UgZGV0YWNoaW5nIGFuZCB2aWRlbyBlbmRlZCwgcmVzZXQgc3RhcnRQb3NpdGlvbicpO1xuICAgICAgdGhpcy5zdGFydFBvc2l0aW9uID0gdGhpcy5sYXN0Q3VycmVudFRpbWUgPSAwO1xuICAgIH1cblxuICAgIC8vIHJlc2V0IGZyYWdtZW50IGxvYWRpbmcgY291bnRlciBvbiBNU0UgZGV0YWNoaW5nIHRvIGF2b2lkIHJlcG9ydGluZyBGUkFHX0xPT1BfTE9BRElOR19FUlJPUiBhZnRlciBlcnJvciByZWNvdmVyeVxuICAgIHZhciBsZXZlbHMgPSB0aGlzLmxldmVscztcbiAgICBpZiAobGV2ZWxzKSB7XG4gICAgICAvLyByZXNldCBmcmFnbWVudCBsb2FkIGNvdW50ZXJcbiAgICAgICAgbGV2ZWxzLmZvckVhY2gobGV2ZWwgPT4ge1xuICAgICAgICAgIGlmKGxldmVsLmRldGFpbHMpIHtcbiAgICAgICAgICAgIGxldmVsLmRldGFpbHMuZnJhZ21lbnRzLmZvckVhY2goZnJhZ21lbnQgPT4ge1xuICAgICAgICAgICAgICBmcmFnbWVudC5sb2FkQ291bnRlciA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgICAvLyByZW1vdmUgdmlkZW8gbGlzdGVuZXJzXG4gICAgaWYgKG1lZGlhKSB7XG4gICAgICBtZWRpYS5yZW1vdmVFdmVudExpc3RlbmVyKCdzZWVraW5nJywgdGhpcy5vbnZzZWVraW5nKTtcbiAgICAgIG1lZGlhLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NlZWtlZCcsIHRoaXMub252c2Vla2VkKTtcbiAgICAgIG1lZGlhLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2VuZGVkJywgdGhpcy5vbnZlbmRlZCk7XG4gICAgICB0aGlzLm9udnNlZWtpbmcgPSB0aGlzLm9udnNlZWtlZCAgPSB0aGlzLm9udmVuZGVkID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5tZWRpYSA9IG51bGw7XG4gICAgdGhpcy5sb2FkZWRtZXRhZGF0YSA9IGZhbHNlO1xuICAgIHRoaXMuc3RvcExvYWQoKTtcbiAgfVxuXG4gIG9uTWVkaWFTZWVraW5nKCkge1xuICAgIGlmICh0aGlzLnN0YXRlID09PSBTdGF0ZS5GUkFHX0xPQURJTkcpIHtcbiAgICAgIC8vIGNoZWNrIGlmIGN1cnJlbnRseSBsb2FkZWQgZnJhZ21lbnQgaXMgaW5zaWRlIGJ1ZmZlci5cbiAgICAgIC8vaWYgb3V0c2lkZSwgY2FuY2VsIGZyYWdtZW50IGxvYWRpbmcsIG90aGVyd2lzZSBkbyBub3RoaW5nXG4gICAgICBpZiAoQnVmZmVySGVscGVyLmJ1ZmZlckluZm8odGhpcy5tZWRpYSx0aGlzLm1lZGlhLmN1cnJlbnRUaW1lLHRoaXMuY29uZmlnLm1heEJ1ZmZlckhvbGUpLmxlbiA9PT0gMCkge1xuICAgICAgICBsb2dnZXIubG9nKCdzZWVraW5nIG91dHNpZGUgb2YgYnVmZmVyIHdoaWxlIGZyYWdtZW50IGxvYWQgaW4gcHJvZ3Jlc3MsIGNhbmNlbCBmcmFnbWVudCBsb2FkJyk7XG4gICAgICAgIHZhciBmcmFnQ3VycmVudCA9IHRoaXMuZnJhZ0N1cnJlbnQ7XG4gICAgICAgIGlmIChmcmFnQ3VycmVudCkge1xuICAgICAgICAgIGlmIChmcmFnQ3VycmVudC5sb2FkZXIpIHtcbiAgICAgICAgICAgIGZyYWdDdXJyZW50LmxvYWRlci5hYm9ydCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLmZyYWdDdXJyZW50ID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmZyYWdQcmV2aW91cyA9IG51bGw7XG4gICAgICAgIC8vIHN3aXRjaCB0byBJRExFIHN0YXRlIHRvIGxvYWQgbmV3IGZyYWdtZW50XG4gICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAodGhpcy5zdGF0ZSA9PT0gU3RhdGUuRU5ERUQpIHtcbiAgICAgICAgLy8gc3dpdGNoIHRvIElETEUgc3RhdGUgdG8gY2hlY2sgZm9yIHBvdGVudGlhbCBuZXcgZnJhZ21lbnRcbiAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gICAgfVxuICAgIGlmICh0aGlzLm1lZGlhKSB7XG4gICAgICB0aGlzLmxhc3RDdXJyZW50VGltZSA9IHRoaXMubWVkaWEuY3VycmVudFRpbWU7XG4gICAgfVxuICAgIC8vIGF2b2lkIHJlcG9ydGluZyBmcmFnbWVudCBsb29wIGxvYWRpbmcgZXJyb3IgaW4gY2FzZSB1c2VyIGlzIHNlZWtpbmcgc2V2ZXJhbCB0aW1lcyBvbiBzYW1lIHBvc2l0aW9uXG4gICAgaWYgKHRoaXMuZnJhZ0xvYWRJZHggIT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5mcmFnTG9hZElkeCArPSAyICogdGhpcy5jb25maWcuZnJhZ0xvYWRpbmdMb29wVGhyZXNob2xkO1xuICAgIH1cbiAgICAvLyB0aWNrIHRvIHNwZWVkIHVwIHByb2Nlc3NpbmdcbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4gIG9uTWVkaWFTZWVrZWQoKSB7XG4gICAgLy8gdGljayB0byBzcGVlZCB1cCBGUkFHTUVOVF9QTEFZSU5HIHRyaWdnZXJpbmdcbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4gIG9uTWVkaWFFbmRlZCgpIHtcbiAgICBsb2dnZXIubG9nKCdtZWRpYSBlbmRlZCcpO1xuICAgIC8vIHJlc2V0IHN0YXJ0UG9zaXRpb24gYW5kIGxhc3RDdXJyZW50VGltZSB0byByZXN0YXJ0IHBsYXliYWNrIEAgc3RyZWFtIGJlZ2lubmluZ1xuICAgIHRoaXMuc3RhcnRQb3NpdGlvbiA9IHRoaXMubGFzdEN1cnJlbnRUaW1lID0gMDtcbiAgfVxuXG5cbiAgb25NYW5pZmVzdExvYWRpbmcoKSB7XG4gICAgLy8gcmVzZXQgYnVmZmVyIG9uIG1hbmlmZXN0IGxvYWRpbmdcbiAgICBsb2dnZXIubG9nKCd0cmlnZ2VyIEJVRkZFUl9SRVNFVCcpO1xuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuQlVGRkVSX1JFU0VUKTtcbiAgICB0aGlzLmJ1ZmZlclJhbmdlID0gW107XG4gICAgdGhpcy5zdGFsbGVkID0gZmFsc2U7XG4gIH1cblxuICBvbk1hbmlmZXN0UGFyc2VkKGRhdGEpIHtcbiAgICB2YXIgYWFjID0gZmFsc2UsIGhlYWFjID0gZmFsc2UsIGNvZGVjO1xuICAgIGRhdGEubGV2ZWxzLmZvckVhY2gobGV2ZWwgPT4ge1xuICAgICAgLy8gZGV0ZWN0IGlmIHdlIGhhdmUgZGlmZmVyZW50IGtpbmQgb2YgYXVkaW8gY29kZWNzIHVzZWQgYW1vbmdzdCBwbGF5bGlzdHNcbiAgICAgIGNvZGVjID0gbGV2ZWwuYXVkaW9Db2RlYztcbiAgICAgIGlmIChjb2RlYykge1xuICAgICAgICBpZiAoY29kZWMuaW5kZXhPZignbXA0YS40MC4yJykgIT09IC0xKSB7XG4gICAgICAgICAgYWFjID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY29kZWMuaW5kZXhPZignbXA0YS40MC41JykgIT09IC0xKSB7XG4gICAgICAgICAgaGVhYWMgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gICAgdGhpcy5hdWRpb0NvZGVjU3dpdGNoID0gKGFhYyAmJiBoZWFhYyk7XG4gICAgaWYgKHRoaXMuYXVkaW9Db2RlY1N3aXRjaCkge1xuICAgICAgbG9nZ2VyLmxvZygnYm90aCBBQUMvSEUtQUFDIGF1ZGlvIGZvdW5kIGluIGxldmVsczsgZGVjbGFyaW5nIGxldmVsIGNvZGVjIGFzIEhFLUFBQycpO1xuICAgIH1cbiAgICB0aGlzLmxldmVscyA9IGRhdGEubGV2ZWxzO1xuICAgIHRoaXMuc3RhcnRMZXZlbExvYWRlZCA9IGZhbHNlO1xuICAgIHRoaXMuc3RhcnRGcmFnUmVxdWVzdGVkID0gZmFsc2U7XG4gICAgaWYgKHRoaXMuY29uZmlnLmF1dG9TdGFydExvYWQpIHtcbiAgICAgIHRoaXMuaGxzLnN0YXJ0TG9hZCgpO1xuICAgIH1cbiAgfVxuXG4gIG9uTGV2ZWxMb2FkZWQoZGF0YSkge1xuICAgIHZhciBuZXdEZXRhaWxzID0gZGF0YS5kZXRhaWxzLFxuICAgICAgICBuZXdMZXZlbElkID0gZGF0YS5sZXZlbCxcbiAgICAgICAgY3VyTGV2ZWwgPSB0aGlzLmxldmVsc1tuZXdMZXZlbElkXSxcbiAgICAgICAgZHVyYXRpb24gPSBuZXdEZXRhaWxzLnRvdGFsZHVyYXRpb24sXG4gICAgICAgIHNsaWRpbmcgPSAwO1xuXG4gICAgbG9nZ2VyLmxvZyhgbGV2ZWwgJHtuZXdMZXZlbElkfSBsb2FkZWQgWyR7bmV3RGV0YWlscy5zdGFydFNOfSwke25ld0RldGFpbHMuZW5kU059XSxkdXJhdGlvbjoke2R1cmF0aW9ufWApO1xuICAgIHRoaXMubGV2ZWxMYXN0TG9hZGVkID0gbmV3TGV2ZWxJZDtcblxuICAgIGlmIChuZXdEZXRhaWxzLmxpdmUpIHtcbiAgICAgIHZhciBjdXJEZXRhaWxzID0gY3VyTGV2ZWwuZGV0YWlscztcbiAgICAgIGlmIChjdXJEZXRhaWxzKSB7XG4gICAgICAgIC8vIHdlIGFscmVhZHkgaGF2ZSBkZXRhaWxzIGZvciB0aGF0IGxldmVsLCBtZXJnZSB0aGVtXG4gICAgICAgIExldmVsSGVscGVyLm1lcmdlRGV0YWlscyhjdXJEZXRhaWxzLG5ld0RldGFpbHMpO1xuICAgICAgICBzbGlkaW5nID0gbmV3RGV0YWlscy5mcmFnbWVudHNbMF0uc3RhcnQ7XG4gICAgICAgIGlmIChuZXdEZXRhaWxzLlBUU0tub3duKSB7XG4gICAgICAgICAgbG9nZ2VyLmxvZyhgbGl2ZSBwbGF5bGlzdCBzbGlkaW5nOiR7c2xpZGluZy50b0ZpeGVkKDMpfWApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGxvZ2dlci5sb2coJ2xpdmUgcGxheWxpc3QgLSBvdXRkYXRlZCBQVFMsIHVua25vd24gc2xpZGluZycpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBuZXdEZXRhaWxzLlBUU0tub3duID0gZmFsc2U7XG4gICAgICAgIGxvZ2dlci5sb2coJ2xpdmUgcGxheWxpc3QgLSBmaXJzdCBsb2FkLCB1bmtub3duIHNsaWRpbmcnKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgbmV3RGV0YWlscy5QVFNLbm93biA9IGZhbHNlO1xuICAgIH1cbiAgICAvLyBvdmVycmlkZSBsZXZlbCBpbmZvXG4gICAgY3VyTGV2ZWwuZGV0YWlscyA9IG5ld0RldGFpbHM7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5MRVZFTF9VUERBVEVELCB7IGRldGFpbHM6IG5ld0RldGFpbHMsIGxldmVsOiBuZXdMZXZlbElkIH0pO1xuXG4gICAgLy8gY29tcHV0ZSBzdGFydCBwb3NpdGlvblxuICAgIGlmICh0aGlzLnN0YXJ0RnJhZ1JlcXVlc3RlZCA9PT0gZmFsc2UpIHtcbiAgICAgIC8vIGlmIGxpdmUgcGxheWxpc3QsIHNldCBzdGFydCBwb3NpdGlvbiB0byBiZSBmcmFnbWVudCBOLXRoaXMuY29uZmlnLmxpdmVTeW5jRHVyYXRpb25Db3VudCAodXN1YWxseSAzKVxuICAgICAgaWYgKG5ld0RldGFpbHMubGl2ZSkge1xuICAgICAgICBsZXQgdGFyZ2V0TGF0ZW5jeSA9IHRoaXMuY29uZmlnLmxpdmVTeW5jRHVyYXRpb24gIT09IHVuZGVmaW5lZCA/IHRoaXMuY29uZmlnLmxpdmVTeW5jRHVyYXRpb24gOiB0aGlzLmNvbmZpZy5saXZlU3luY0R1cmF0aW9uQ291bnQgKiBuZXdEZXRhaWxzLnRhcmdldGR1cmF0aW9uO1xuICAgICAgICB0aGlzLnN0YXJ0UG9zaXRpb24gPSBNYXRoLm1heCgwLCBzbGlkaW5nICsgZHVyYXRpb24gLSB0YXJnZXRMYXRlbmN5KTtcbiAgICAgIH1cbiAgICAgIHRoaXMubmV4dExvYWRQb3NpdGlvbiA9IHRoaXMuc3RhcnRQb3NpdGlvbjtcbiAgICB9XG4gICAgLy8gb25seSBzd2l0Y2ggYmF0Y2sgdG8gSURMRSBzdGF0ZSBpZiB3ZSB3ZXJlIHdhaXRpbmcgZm9yIGxldmVsIHRvIHN0YXJ0IGRvd25sb2FkaW5nIGEgbmV3IGZyYWdtZW50XG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IFN0YXRlLldBSVRJTkdfTEVWRUwpIHtcbiAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgIH1cbiAgICAvL3RyaWdnZXIgaGFuZGxlciByaWdodCBub3dcbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4gIG9uS2V5TG9hZGVkKCkge1xuICAgIGlmICh0aGlzLnN0YXRlID09PSBTdGF0ZS5LRVlfTE9BRElORykge1xuICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gICAgICB0aGlzLnRpY2soKTtcbiAgICB9XG4gIH1cblxuICBvbkZyYWdMb2FkZWQoZGF0YSkge1xuICAgIHZhciBmcmFnQ3VycmVudCA9IHRoaXMuZnJhZ0N1cnJlbnQ7XG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IFN0YXRlLkZSQUdfTE9BRElORyAmJlxuICAgICAgICBmcmFnQ3VycmVudCAmJlxuICAgICAgICBkYXRhLmZyYWcubGV2ZWwgPT09IGZyYWdDdXJyZW50LmxldmVsICYmXG4gICAgICAgIGRhdGEuZnJhZy5zbiA9PT0gZnJhZ0N1cnJlbnQuc24pIHtcbiAgICAgIGlmICh0aGlzLmZyYWdCaXRyYXRlVGVzdCA9PT0gdHJ1ZSkge1xuICAgICAgICAvLyBzd2l0Y2ggYmFjayB0byBJRExFIHN0YXRlIC4uLiB3ZSBqdXN0IGxvYWRlZCBhIGZyYWdtZW50IHRvIGRldGVybWluZSBhZGVxdWF0ZSBzdGFydCBiaXRyYXRlIGFuZCBpbml0aWFsaXplIGF1dG9zd2l0Y2ggYWxnb1xuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICAgICAgdGhpcy5mcmFnQml0cmF0ZVRlc3QgPSBmYWxzZTtcbiAgICAgICAgZGF0YS5zdGF0cy50cGFyc2VkID0gZGF0YS5zdGF0cy50YnVmZmVyZWQgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5GUkFHX0JVRkZFUkVELCB7c3RhdHM6IGRhdGEuc3RhdHMsIGZyYWc6IGZyYWdDdXJyZW50fSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuUEFSU0lORztcbiAgICAgICAgLy8gdHJhbnNtdXggdGhlIE1QRUctVFMgZGF0YSB0byBJU08tQk1GRiBzZWdtZW50c1xuICAgICAgICB0aGlzLnN0YXRzID0gZGF0YS5zdGF0cztcbiAgICAgICAgdmFyIGN1cnJlbnRMZXZlbCA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdLFxuICAgICAgICAgICAgZGV0YWlscyA9IGN1cnJlbnRMZXZlbC5kZXRhaWxzLFxuICAgICAgICAgICAgZHVyYXRpb24gPSBkZXRhaWxzLnRvdGFsZHVyYXRpb24sXG4gICAgICAgICAgICBzdGFydCA9IGZyYWdDdXJyZW50LnN0YXJ0LFxuICAgICAgICAgICAgbGV2ZWwgPSBmcmFnQ3VycmVudC5sZXZlbCxcbiAgICAgICAgICAgIHNuID0gZnJhZ0N1cnJlbnQuc24sXG4gICAgICAgICAgICBhdWRpb0NvZGVjID0gY3VycmVudExldmVsLmF1ZGlvQ29kZWMgfHwgdGhpcy5jb25maWcuZGVmYXVsdEF1ZGlvQ29kZWM7XG4gICAgICAgIGlmKHRoaXMuYXVkaW9Db2RlY1N3YXApIHtcbiAgICAgICAgICBsb2dnZXIubG9nKCdzd2FwcGluZyBwbGF5bGlzdCBhdWRpbyBjb2RlYycpO1xuICAgICAgICAgIGlmKGF1ZGlvQ29kZWMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgYXVkaW9Db2RlYyA9IHRoaXMubGFzdEF1ZGlvQ29kZWM7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmKGF1ZGlvQ29kZWMpIHtcbiAgICAgICAgICAgIGlmKGF1ZGlvQ29kZWMuaW5kZXhPZignbXA0YS40MC41JykgIT09LTEpIHtcbiAgICAgICAgICAgICAgYXVkaW9Db2RlYyA9ICdtcDRhLjQwLjInO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgYXVkaW9Db2RlYyA9ICdtcDRhLjQwLjUnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLnBlbmRpbmdBcHBlbmRpbmcgPSAwO1xuICAgICAgICAvLyBsb2dnZXIubG9nKGBEZW11eGluZyAke3NufSBvZiBbJHtkZXRhaWxzLnN0YXJ0U059ICwke2RldGFpbHMuZW5kU059XSxsZXZlbCAke2xldmVsfWApO1xuLy8gXHRcdHZhciByZSA9IC8oXFxkKylfXFxkKy50cy87XG4vLyBcdFx0dmFyIHQwID0gMDtcbi8vIFx0XHR2YXIgbSA9IHJlLmV4ZWMoZnJhZ0N1cnJlbnQudXJsKTtcbi8vIFx0XHR2YXIgdDAgPSAobSAmJiBtWzFdKSA/IHBhcnNlSW50KCBtWzFdICkvMTAwMCA6IDA7XG4vL1xuICAgICAgICB0aGlzLmRlbXV4ZXIucHVzaChkYXRhLnBheWxvYWQsIGF1ZGlvQ29kZWMsIGN1cnJlbnRMZXZlbC52aWRlb0NvZGVjLCBzdGFydCwgZnJhZ0N1cnJlbnQuY2MsIGxldmVsLCBzbiwgZHVyYXRpb24sIGZyYWdDdXJyZW50LmRlY3J5cHRkYXRhLCBzdGFydCk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuZnJhZ0xvYWRFcnJvciA9IDA7XG4gIH1cblxuICBvbkZyYWdQYXJzaW5nSW5pdFNlZ21lbnQoZGF0YSkge1xuICAgIGlmICh0aGlzLnN0YXRlID09PSBTdGF0ZS5QQVJTSU5HKSB7XG4gICAgICB2YXIgdHJhY2tzID0gZGF0YS50cmFja3MsIHRyYWNrTmFtZSwgdHJhY2s7XG5cbiAgICAgIC8vIGluY2x1ZGUgbGV2ZWxDb2RlYyBpbiBhdWRpbyBhbmQgdmlkZW8gdHJhY2tzXG4gICAgICB0cmFjayA9IHRyYWNrcy5hdWRpbztcbiAgICAgIGlmKHRyYWNrKSB7XG4gICAgICAgIHZhciBhdWRpb0NvZGVjID0gdGhpcy5sZXZlbHNbdGhpcy5sZXZlbF0uYXVkaW9Db2RlYyxcbiAgICAgICAgICAgIHVhID0gbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBpZihhdWRpb0NvZGVjICYmIHRoaXMuYXVkaW9Db2RlY1N3YXApIHtcbiAgICAgICAgICBsb2dnZXIubG9nKCdzd2FwcGluZyBwbGF5bGlzdCBhdWRpbyBjb2RlYycpO1xuICAgICAgICAgIGlmKGF1ZGlvQ29kZWMuaW5kZXhPZignbXA0YS40MC41JykgIT09LTEpIHtcbiAgICAgICAgICAgIGF1ZGlvQ29kZWMgPSAnbXA0YS40MC4yJztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXVkaW9Db2RlYyA9ICdtcDRhLjQwLjUnO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBpbiBjYXNlIEFBQyBhbmQgSEUtQUFDIGF1ZGlvIGNvZGVjcyBhcmUgc2lnbmFsbGVkIGluIG1hbmlmZXN0XG4gICAgICAgIC8vIGZvcmNlIEhFLUFBQyAsIGFzIGl0IHNlZW1zIHRoYXQgbW9zdCBicm93c2VycyBwcmVmZXJzIHRoYXQgd2F5LFxuICAgICAgICAvLyBleGNlcHQgZm9yIG1vbm8gc3RyZWFtcyBPUiBvbiBGRlxuICAgICAgICAvLyB0aGVzZSBjb25kaXRpb25zIG1pZ2h0IG5lZWQgdG8gYmUgcmV2aWV3ZWQgLi4uXG4gICAgICAgIGlmICh0aGlzLmF1ZGlvQ29kZWNTd2l0Y2gpIHtcbiAgICAgICAgICAgIC8vIGRvbid0IGZvcmNlIEhFLUFBQyBpZiBtb25vIHN0cmVhbVxuICAgICAgICAgICBpZih0cmFjay5tZXRhZGF0YS5jaGFubmVsQ291bnQgIT09IDEgJiZcbiAgICAgICAgICAgIC8vIGRvbid0IGZvcmNlIEhFLUFBQyBpZiBmaXJlZm94XG4gICAgICAgICAgICB1YS5pbmRleE9mKCdmaXJlZm94JykgPT09IC0xKSB7XG4gICAgICAgICAgICAgIGF1ZGlvQ29kZWMgPSAnbXA0YS40MC41JztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gSEUtQUFDIGlzIGJyb2tlbiBvbiBBbmRyb2lkLCBhbHdheXMgc2lnbmFsIGF1ZGlvIGNvZGVjIGFzIEFBQyBldmVuIGlmIHZhcmlhbnQgbWFuaWZlc3Qgc3RhdGVzIG90aGVyd2lzZVxuICAgICAgICBpZih1YS5pbmRleE9mKCdhbmRyb2lkJykgIT09IC0xKSB7XG4gICAgICAgICAgYXVkaW9Db2RlYyA9ICdtcDRhLjQwLjInO1xuICAgICAgICAgIGxvZ2dlci5sb2coYEFuZHJvaWQ6IGZvcmNlIGF1ZGlvIGNvZGVjIHRvYCArIGF1ZGlvQ29kZWMpO1xuICAgICAgICB9XG4gICAgICAgIHRyYWNrLmxldmVsQ29kZWMgPSBhdWRpb0NvZGVjO1xuICAgICAgfVxuICAgICAgdHJhY2sgPSB0cmFja3MudmlkZW87XG4gICAgICBpZih0cmFjaykge1xuICAgICAgICB0cmFjay5sZXZlbENvZGVjID0gdGhpcy5sZXZlbHNbdGhpcy5sZXZlbF0udmlkZW9Db2RlYztcbiAgICAgIH1cblxuICAgICAgLy8gaWYgcmVtdXhlciBzcGVjaWZ5IHRoYXQgYSB1bmlxdWUgdHJhY2sgbmVlZHMgdG8gZ2VuZXJhdGVkLFxuICAgICAgLy8gbGV0J3MgbWVyZ2UgYWxsIHRyYWNrcyB0b2dldGhlclxuICAgICAgaWYgKGRhdGEudW5pcXVlKSB7XG4gICAgICAgIHZhciBtZXJnZWRUcmFjayA9IHtcbiAgICAgICAgICAgIGNvZGVjIDogJycsXG4gICAgICAgICAgICBsZXZlbENvZGVjIDogJydcbiAgICAgICAgICB9O1xuICAgICAgICBmb3IgKHRyYWNrTmFtZSBpbiBkYXRhLnRyYWNrcykge1xuICAgICAgICAgIHRyYWNrID0gdHJhY2tzW3RyYWNrTmFtZV07XG4gICAgICAgICAgbWVyZ2VkVHJhY2suY29udGFpbmVyID0gdHJhY2suY29udGFpbmVyO1xuICAgICAgICAgIGlmIChtZXJnZWRUcmFjay5jb2RlYykge1xuICAgICAgICAgICAgbWVyZ2VkVHJhY2suY29kZWMgKz0gICcsJztcbiAgICAgICAgICAgIG1lcmdlZFRyYWNrLmxldmVsQ29kZWMgKz0gICcsJztcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYodHJhY2suY29kZWMpIHtcbiAgICAgICAgICAgIG1lcmdlZFRyYWNrLmNvZGVjICs9ICB0cmFjay5jb2RlYztcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHRyYWNrLmxldmVsQ29kZWMpIHtcbiAgICAgICAgICAgIG1lcmdlZFRyYWNrLmxldmVsQ29kZWMgKz0gIHRyYWNrLmxldmVsQ29kZWM7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRyYWNrcyA9IHsgYXVkaW92aWRlbyA6IG1lcmdlZFRyYWNrIH07XG4gICAgICB9XG4gICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkJVRkZFUl9DT0RFQ1MsdHJhY2tzKTtcbiAgICAgIC8vIGxvb3AgdGhyb3VnaCB0cmFja3MgdGhhdCBhcmUgZ29pbmcgdG8gYmUgcHJvdmlkZWQgdG8gYnVmZmVyQ29udHJvbGxlclxuICAgICAgZm9yICh0cmFja05hbWUgaW4gdHJhY2tzKSB7XG4gICAgICAgIHRyYWNrID0gdHJhY2tzW3RyYWNrTmFtZV07XG4gICAgICAgIGxvZ2dlci5sb2coYHRyYWNrOiR7dHJhY2tOYW1lfSxjb250YWluZXI6JHt0cmFjay5jb250YWluZXJ9LGNvZGVjc1tsZXZlbC9wYXJzZWRdPVske3RyYWNrLmxldmVsQ29kZWN9LyR7dHJhY2suY29kZWN9XWApO1xuICAgICAgICB2YXIgaW5pdFNlZ21lbnQgPSB0cmFjay5pbml0U2VnbWVudDtcbiAgICAgICAgaWYgKGluaXRTZWdtZW50KSB7XG4gICAgICAgICAgdGhpcy5wZW5kaW5nQXBwZW5kaW5nKys7XG4gICAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5CVUZGRVJfQVBQRU5ESU5HLCB7dHlwZTogdHJhY2tOYW1lLCBkYXRhOiBpbml0U2VnbWVudH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvL3RyaWdnZXIgaGFuZGxlciByaWdodCBub3dcbiAgICAgIHRoaXMudGljaygpO1xuICAgIH1cbiAgfVxuXG4gIG9uRnJhZ1BhcnNpbmdEYXRhKGRhdGEpIHtcbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gU3RhdGUuUEFSU0lORykge1xuICAgICAgdGhpcy50cGFyc2UyID0gRGF0ZS5ub3coKTtcbiAgICAgIHZhciBsZXZlbCA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdLFxuICAgICAgICAgIGZyYWcgPSB0aGlzLmZyYWdDdXJyZW50O1xuXG4gICAgICBsb2dnZXIubG9nKGBwYXJzZWQgJHtkYXRhLnR5cGV9LFBUUzpbJHtkYXRhLnN0YXJ0UFRTLnRvRml4ZWQoMyl9LCR7ZGF0YS5lbmRQVFMudG9GaXhlZCgzKX1dLERUUzpbJHtkYXRhLnN0YXJ0RFRTLnRvRml4ZWQoMyl9LyR7ZGF0YS5lbmREVFMudG9GaXhlZCgzKX1dLG5iOiR7ZGF0YS5uYn1gKTtcblxuICAgICAgdmFyIGRyaWZ0ID0gTGV2ZWxIZWxwZXIudXBkYXRlRnJhZ1BUUyhsZXZlbC5kZXRhaWxzLGZyYWcuc24sZGF0YS5zdGFydFBUUyxkYXRhLmVuZFBUUyksXG4gICAgICAgICAgaGxzID0gdGhpcy5obHM7XG4gICAgICBobHMudHJpZ2dlcihFdmVudC5MRVZFTF9QVFNfVVBEQVRFRCwge2RldGFpbHM6IGxldmVsLmRldGFpbHMsIGxldmVsOiB0aGlzLmxldmVsLCBkcmlmdDogZHJpZnR9KTtcblxuICAgICAgW2RhdGEuZGF0YTEsIGRhdGEuZGF0YTJdLmZvckVhY2goYnVmZmVyID0+IHtcbiAgICAgICAgaWYgKGJ1ZmZlcikge1xuICAgICAgICAgIHRoaXMucGVuZGluZ0FwcGVuZGluZysrO1xuICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkJVRkZFUl9BUFBFTkRJTkcsIHt0eXBlOiBkYXRhLnR5cGUsIGRhdGE6IGJ1ZmZlcn0pO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgdGhpcy5uZXh0TG9hZFBvc2l0aW9uID0gZGF0YS5lbmRQVFM7XG4gICAgICB0aGlzLmJ1ZmZlclJhbmdlLnB1c2goe3R5cGU6IGRhdGEudHlwZSwgc3RhcnQ6IGRhdGEuc3RhcnRQVFMsIGVuZDogZGF0YS5lbmRQVFMsIGZyYWc6IGZyYWd9KTtcblxuICAgICAgLy90cmlnZ2VyIGhhbmRsZXIgcmlnaHQgbm93XG4gICAgICB0aGlzLnRpY2soKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbG9nZ2VyLndhcm4oYG5vdCBpbiBQQVJTSU5HIHN0YXRlIGJ1dCAke3RoaXMuc3RhdGV9LCBpZ25vcmluZyBGUkFHX1BBUlNJTkdfREFUQSBldmVudGApO1xuICAgIH1cbiAgfVxuXG4gIG9uRnJhZ1BhcnNlZCgpIHtcbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gU3RhdGUuUEFSU0lORykge1xuICAgICAgdGhpcy5zdGF0cy50cGFyc2VkID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICB0aGlzLnN0YXRlID0gU3RhdGUuUEFSU0VEO1xuICAgICAgdGhpcy5fY2hlY2tBcHBlbmRlZFBhcnNlZCgpO1xuICAgIH1cbiAgfVxuXG4gIG9uQnVmZmVyQXBwZW5kZWQoKSB7XG4gICAgc3dpdGNoICh0aGlzLnN0YXRlKSB7XG4gICAgICBjYXNlIFN0YXRlLlBBUlNJTkc6XG4gICAgICBjYXNlIFN0YXRlLlBBUlNFRDpcbiAgICAgICAgdGhpcy5wZW5kaW5nQXBwZW5kaW5nLS07XG4gICAgICAgIHRoaXMuX2NoZWNrQXBwZW5kZWRQYXJzZWQoKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICBfY2hlY2tBcHBlbmRlZFBhcnNlZCgpIHtcbiAgICAvL3RyaWdnZXIgaGFuZGxlciByaWdodCBub3dcbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gU3RhdGUuUEFSU0VEICYmIHRoaXMucGVuZGluZ0FwcGVuZGluZyA9PT0gMCkgIHtcbiAgICAgIHZhciBmcmFnID0gdGhpcy5mcmFnQ3VycmVudCwgc3RhdHMgPSB0aGlzLnN0YXRzO1xuICAgICAgaWYgKGZyYWcpIHtcbiAgICAgICAgdGhpcy5mcmFnUHJldmlvdXMgPSBmcmFnO1xuICAgICAgICBzdGF0cy50YnVmZmVyZWQgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgdGhpcy5mcmFnTGFzdEticHMgPSBNYXRoLnJvdW5kKDggKiBzdGF0cy5sZW5ndGggLyAoc3RhdHMudGJ1ZmZlcmVkIC0gc3RhdHMudGZpcnN0KSk7XG4gICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRlJBR19CVUZGRVJFRCwge3N0YXRzOiBzdGF0cywgZnJhZzogZnJhZ30pO1xuXHRcdC8vIGNvbnNvbGUuaW5mbyhzdGF0cyk7XG5cdFx0Ly8gY29uc29sZS5pbmZvKGZyYWcpO1xuICAgICAgICBsb2dnZXIubG9nKGBtZWRpYSBidWZmZXJlZCA6ICR7dGhpcy50aW1lUmFuZ2VzVG9TdHJpbmcodGhpcy5tZWRpYS5idWZmZXJlZCl9YCk7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgICAgfVxuICAgICAgdGhpcy50aWNrKCk7XG4gICAgfVxuICB9XG5cbiAgb25FcnJvcihkYXRhKSB7XG4gICAgc3dpdGNoKGRhdGEuZGV0YWlscykge1xuICAgICAgY2FzZSBFcnJvckRldGFpbHMuRlJBR19MT0FEX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuRlJBR19MT0FEX1RJTUVPVVQ6XG4gICAgICAgIGlmKCFkYXRhLmZhdGFsKSB7XG4gICAgICAgICAgdmFyIGxvYWRFcnJvciA9IHRoaXMuZnJhZ0xvYWRFcnJvcjtcbiAgICAgICAgICBpZihsb2FkRXJyb3IpIHtcbiAgICAgICAgICAgIGxvYWRFcnJvcisrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsb2FkRXJyb3I9MTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGxvYWRFcnJvciA8PSB0aGlzLmNvbmZpZy5mcmFnTG9hZGluZ01heFJldHJ5KSB7XG4gICAgICAgICAgICB0aGlzLmZyYWdMb2FkRXJyb3IgPSBsb2FkRXJyb3I7XG4gICAgICAgICAgICAvLyByZXNldCBsb2FkIGNvdW50ZXIgdG8gYXZvaWQgZnJhZyBsb29wIGxvYWRpbmcgZXJyb3JcbiAgICAgICAgICAgIGRhdGEuZnJhZy5sb2FkQ291bnRlciA9IDA7XG4gICAgICAgICAgICAvLyBleHBvbmVudGlhbCBiYWNrb2ZmIGNhcHBlZCB0byA2NHNcbiAgICAgICAgICAgIHZhciBkZWxheSA9IE1hdGgubWluKE1hdGgucG93KDIsbG9hZEVycm9yLTEpKnRoaXMuY29uZmlnLmZyYWdMb2FkaW5nUmV0cnlEZWxheSw2NDAwMCk7XG4gICAgICAgICAgICBsb2dnZXIud2FybihgbWVkaWFDb250cm9sbGVyOiBmcmFnIGxvYWRpbmcgZmFpbGVkLCByZXRyeSBpbiAke2RlbGF5fSBtc2ApO1xuICAgICAgICAgICAgdGhpcy5yZXRyeURhdGUgPSBwZXJmb3JtYW5jZS5ub3coKSArIGRlbGF5O1xuICAgICAgICAgICAgLy8gcmV0cnkgbG9hZGluZyBzdGF0ZVxuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLkZSQUdfTE9BRElOR19XQUlUSU5HX1JFVFJZO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsb2dnZXIuZXJyb3IoYG1lZGlhQ29udHJvbGxlcjogJHtkYXRhLmRldGFpbHN9IHJlYWNoZXMgbWF4IHJldHJ5LCByZWRpc3BhdGNoIGFzIGZhdGFsIC4uLmApO1xuICAgICAgICAgICAgLy8gcmVkaXNwYXRjaCBzYW1lIGVycm9yIGJ1dCB3aXRoIGZhdGFsIHNldCB0byB0cnVlXG4gICAgICAgICAgICBkYXRhLmZhdGFsID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIGRhdGEpO1xuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLkVSUk9SO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkZSQUdfTE9PUF9MT0FESU5HX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuTEVWRUxfTE9BRF9FUlJPUjpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkxFVkVMX0xPQURfVElNRU9VVDpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLktFWV9MT0FEX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuS0VZX0xPQURfVElNRU9VVDpcbiAgICAgICAgLy8gaWYgZmF0YWwgZXJyb3IsIHN0b3AgcHJvY2Vzc2luZywgb3RoZXJ3aXNlIG1vdmUgdG8gSURMRSB0byByZXRyeSBsb2FkaW5nXG4gICAgICAgIGxvZ2dlci53YXJuKGBtZWRpYUNvbnRyb2xsZXI6ICR7ZGF0YS5kZXRhaWxzfSB3aGlsZSBsb2FkaW5nIGZyYWcsc3dpdGNoIHRvICR7ZGF0YS5mYXRhbCA/ICdFUlJPUicgOiAnSURMRSd9IHN0YXRlIC4uLmApO1xuICAgICAgICB0aGlzLnN0YXRlID0gZGF0YS5mYXRhbCA/IFN0YXRlLkVSUk9SIDogU3RhdGUuSURMRTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5CVUZGRVJfRlVMTF9FUlJPUjpcbiAgICAgICAgLy8gdHJpZ2dlciBhIHNtb290aCBsZXZlbCBzd2l0Y2ggdG8gZW1wdHkgYnVmZmVyc1xuICAgICAgICAvLyBhbHNvIHJlZHVjZSBtYXggYnVmZmVyIGxlbmd0aCBhcyBpdCBtaWdodCBiZSB0b28gaGlnaC4gd2UgZG8gdGhpcyB0byBhdm9pZCBsb29wIGZsdXNoaW5nIC4uLlxuICAgICAgICB0aGlzLmNvbmZpZy5tYXhNYXhCdWZmZXJMZW5ndGgvPTI7XG4gICAgICAgIGxvZ2dlci53YXJuKGByZWR1Y2UgbWF4IGJ1ZmZlciBsZW5ndGggdG8gJHt0aGlzLmNvbmZpZy5tYXhNYXhCdWZmZXJMZW5ndGh9cyBhbmQgdHJpZ2dlciBhIG5leHRMZXZlbFN3aXRjaCB0byBmbHVzaCBvbGQgYnVmZmVyIGFuZCBmaXggUXVvdGFFeGNlZWRlZEVycm9yYCk7XG4gICAgICAgIHRoaXMubmV4dExldmVsU3dpdGNoKCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbl9jaGVja0J1ZmZlcigpIHtcbiAgICB2YXIgbWVkaWEgPSB0aGlzLm1lZGlhO1xuICAgIGlmKG1lZGlhKSB7XG4gICAgICAvLyBjb21wYXJlIHJlYWR5U3RhdGVcbiAgICAgIHZhciByZWFkeVN0YXRlID0gbWVkaWEucmVhZHlTdGF0ZTtcbiAgICAgIC8vIGlmIHJlYWR5IHN0YXRlIGRpZmZlcmVudCBmcm9tIEhBVkVfTk9USElORyAobnVtZXJpYyB2YWx1ZSAwKSwgd2UgYXJlIGFsbG93ZWQgdG8gc2Vla1xuICAgICAgaWYocmVhZHlTdGF0ZSkge1xuICAgICAgICB2YXIgdGFyZ2V0U2Vla1Bvc2l0aW9uLCBjdXJyZW50VGltZTtcbiAgICAgICAgLy8gaWYgc2VlayBhZnRlciBidWZmZXJlZCBkZWZpbmVkLCBsZXQncyBzZWVrIGlmIHdpdGhpbiBhY2NlcHRhYmxlIHJhbmdlXG4gICAgICAgIHZhciBzZWVrQWZ0ZXJCdWZmZXJlZCA9IHRoaXMuc2Vla0FmdGVyQnVmZmVyZWQ7XG4gICAgICAgIGlmKHNlZWtBZnRlckJ1ZmZlcmVkKSB7XG4gICAgICAgICAgaWYobWVkaWEuZHVyYXRpb24gPj0gc2Vla0FmdGVyQnVmZmVyZWQpIHtcbiAgICAgICAgICAgIHRhcmdldFNlZWtQb3NpdGlvbiA9IHNlZWtBZnRlckJ1ZmZlcmVkO1xuICAgICAgICAgICAgdGhpcy5zZWVrQWZ0ZXJCdWZmZXJlZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY3VycmVudFRpbWUgPSBtZWRpYS5jdXJyZW50VGltZTtcbiAgICAgICAgICB2YXIgbG9hZGVkbWV0YWRhdGEgPSB0aGlzLmxvYWRlZG1ldGFkYXRhO1xuXG4gICAgICAgICAgLy8gYWRqdXN0IGN1cnJlbnRUaW1lIHRvIHN0YXJ0IHBvc2l0aW9uIG9uIGxvYWRlZCBtZXRhZGF0YVxuICAgICAgICAgIGlmKCFsb2FkZWRtZXRhZGF0YSAmJiBtZWRpYS5idWZmZXJlZC5sZW5ndGgpIHtcbiAgICAgICAgICAgIHRoaXMubG9hZGVkbWV0YWRhdGEgPSB0cnVlO1xuICAgICAgICAgICAgLy8gb25seSBhZGp1c3QgY3VycmVudFRpbWUgaWYgbm90IGVxdWFsIHRvIDBcbiAgICAgICAgICAgIGlmICghY3VycmVudFRpbWUgJiYgY3VycmVudFRpbWUgIT09IHRoaXMuc3RhcnRQb3NpdGlvbikge1xuICAgICAgICAgICAgICB0YXJnZXRTZWVrUG9zaXRpb24gPSB0aGlzLnN0YXJ0UG9zaXRpb247XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICh0YXJnZXRTZWVrUG9zaXRpb24pIHtcbiAgICAgICAgICBjdXJyZW50VGltZSA9IHRhcmdldFNlZWtQb3NpdGlvbjtcbiAgICAgICAgICBsb2dnZXIubG9nKGB0YXJnZXQgc2VlayBwb3NpdGlvbjoke3RhcmdldFNlZWtQb3NpdGlvbn1gKTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgYnVmZmVySW5mbyA9IEJ1ZmZlckhlbHBlci5idWZmZXJJbmZvKG1lZGlhLGN1cnJlbnRUaW1lLDApLFxuICAgICAgICAgICAgZXhwZWN0ZWRQbGF5aW5nID0gIShtZWRpYS5wYXVzZWQgfHwgbWVkaWEuZW5kZWQgfHwgbWVkaWEuc2Vla2luZyB8fCByZWFkeVN0YXRlIDwgMiksXG4gICAgICAgICAgICBqdW1wVGhyZXNob2xkID0gMC40LCAvLyB0b2xlcmFuY2UgbmVlZGVkIGFzIHNvbWUgYnJvd3NlcnMgc3RhbGxzIHBsYXliYWNrIGJlZm9yZSByZWFjaGluZyBidWZmZXJlZCByYW5nZSBlbmRcbiAgICAgICAgICAgIHBsYXloZWFkTW92aW5nID0gY3VycmVudFRpbWUgPiBtZWRpYS5wbGF5YmFja1JhdGUqdGhpcy5sYXN0Q3VycmVudFRpbWU7XG5cbiAgICAgICAgaWYgKHRoaXMuc3RhbGxlZCAmJiBwbGF5aGVhZE1vdmluZykge1xuICAgICAgICAgIHRoaXMuc3RhbGxlZCA9IGZhbHNlO1xuICAgICAgICAgIGxvZ2dlci5sb2coYHBsYXliYWNrIG5vdCBzdHVjayBhbnltb3JlIEAke2N1cnJlbnRUaW1lfWApO1xuICAgICAgICB9XG4gICAgICAgIC8vIGNoZWNrIGJ1ZmZlciB1cGZyb250XG4gICAgICAgIC8vIGlmIGxlc3MgdGhhbiAyMDBtcyBpcyBidWZmZXJlZCwgYW5kIG1lZGlhIGlzIGV4cGVjdGVkIHRvIHBsYXkgYnV0IHBsYXloZWFkIGlzIG5vdCBtb3ZpbmcsXG4gICAgICAgIC8vIGFuZCB3ZSBoYXZlIGEgbmV3IGJ1ZmZlciByYW5nZSBhdmFpbGFibGUgdXBmcm9udCwgbGV0J3Mgc2VlayB0byB0aGF0IG9uZVxuICAgICAgICBpZihidWZmZXJJbmZvLmxlbiA8PSBqdW1wVGhyZXNob2xkKSB7XG4gICAgICAgICAgaWYocGxheWhlYWRNb3ZpbmcgfHwgIWV4cGVjdGVkUGxheWluZykge1xuICAgICAgICAgICAgLy8gcGxheWhlYWQgbW92aW5nIG9yIG1lZGlhIG5vdCBwbGF5aW5nXG4gICAgICAgICAgICBqdW1wVGhyZXNob2xkID0gMDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gcGxheWhlYWQgbm90IG1vdmluZyBBTkQgbWVkaWEgZXhwZWN0ZWQgdG8gcGxheVxuICAgICAgICAgICAgaWYoIXRoaXMuc3RhbGxlZCkge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBwbGF5YmFjayBzZWVtcyBzdHVjayBAJHtjdXJyZW50VGltZX1gKTtcbiAgICAgICAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5CVUZGRVJfU1RBTExFRF9FUlJPUiwgZmF0YWw6IGZhbHNlfSk7XG4gICAgICAgICAgICAgIHRoaXMuc3RhbGxlZCA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIGlmIHdlIGFyZSBiZWxvdyB0aHJlc2hvbGQsIHRyeSB0byBqdW1wIGlmIG5leHQgYnVmZmVyIHJhbmdlIGlzIGNsb3NlXG4gICAgICAgICAgaWYoYnVmZmVySW5mby5sZW4gPD0ganVtcFRocmVzaG9sZCkge1xuICAgICAgICAgICAgLy8gbm8gYnVmZmVyIGF2YWlsYWJsZSBAIGN1cnJlbnRUaW1lLCBjaGVjayBpZiBuZXh0IGJ1ZmZlciBpcyBjbG9zZSAod2l0aGluIGEgY29uZmlnLm1heFNlZWtIb2xlIHNlY29uZCByYW5nZSlcbiAgICAgICAgICAgIHZhciBuZXh0QnVmZmVyU3RhcnQgPSBidWZmZXJJbmZvLm5leHRTdGFydCwgZGVsdGEgPSBuZXh0QnVmZmVyU3RhcnQtY3VycmVudFRpbWU7XG4gICAgICAgICAgICBpZihuZXh0QnVmZmVyU3RhcnQgJiZcbiAgICAgICAgICAgICAgIChkZWx0YSA8IHRoaXMuY29uZmlnLm1heFNlZWtIb2xlKSAmJlxuICAgICAgICAgICAgICAgKGRlbHRhID4gMCkgICYmXG4gICAgICAgICAgICAgICAhbWVkaWEuc2Vla2luZykge1xuICAgICAgICAgICAgICAvLyBuZXh0IGJ1ZmZlciBpcyBjbG9zZSAhIGFkanVzdCBjdXJyZW50VGltZSB0byBuZXh0QnVmZmVyU3RhcnRcbiAgICAgICAgICAgICAgLy8gdGhpcyB3aWxsIGVuc3VyZSBlZmZlY3RpdmUgdmlkZW8gZGVjb2RpbmdcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgYWRqdXN0IGN1cnJlbnRUaW1lIGZyb20gJHttZWRpYS5jdXJyZW50VGltZX0gdG8gbmV4dCBidWZmZXJlZCBAICR7bmV4dEJ1ZmZlclN0YXJ0fWApO1xuICAgICAgICAgICAgICBtZWRpYS5jdXJyZW50VGltZSA9IG5leHRCdWZmZXJTdGFydDtcbiAgICAgICAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5CVUZGRVJfU0VFS19PVkVSX0hPTEUsIGZhdGFsOiBmYWxzZX0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpZiAodGFyZ2V0U2Vla1Bvc2l0aW9uICYmIG1lZGlhLmN1cnJlbnRUaW1lICE9PSB0YXJnZXRTZWVrUG9zaXRpb24pIHtcbiAgICAgICAgICAgIGxvZ2dlci5sb2coYGFkanVzdCBjdXJyZW50VGltZSBmcm9tICR7bWVkaWEuY3VycmVudFRpbWV9IHRvICR7dGFyZ2V0U2Vla1Bvc2l0aW9ufWApO1xuICAgICAgICAgICAgbWVkaWEuY3VycmVudFRpbWUgPSB0YXJnZXRTZWVrUG9zaXRpb247XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgb25GcmFnTG9hZEVtZXJnZW5jeUFib3J0ZWQoKSB7XG5cdCAgZGVidWdnZXI7XG4gICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvbkJ1ZmZlckZsdXNoZWQoKSB7XG4gICAgLyogYWZ0ZXIgc3VjY2Vzc2Z1bCBidWZmZXIgZmx1c2hpbmcsIHJlYnVpbGQgYnVmZmVyIFJhbmdlIGFycmF5XG4gICAgICBsb29wIHRocm91Z2ggZXhpc3RpbmcgYnVmZmVyIHJhbmdlIGFuZCBjaGVjayBpZlxuICAgICAgY29ycmVzcG9uZGluZyByYW5nZSBpcyBzdGlsbCBidWZmZXJlZC4gb25seSBwdXNoIHRvIG5ldyBhcnJheSBhbHJlYWR5IGJ1ZmZlcmVkIHJhbmdlXG4gICAgKi9cbiAgICB2YXIgbmV3UmFuZ2UgPSBbXSxyYW5nZSxpO1xuICAgIGZvciAoaSA9IDA7IGkgPCB0aGlzLmJ1ZmZlclJhbmdlLmxlbmd0aDsgaSsrKSB7XG4gICAgICByYW5nZSA9IHRoaXMuYnVmZmVyUmFuZ2VbaV07XG4gICAgICBpZiAodGhpcy5pc0J1ZmZlcmVkKChyYW5nZS5zdGFydCArIHJhbmdlLmVuZCkgLyAyKSkge1xuICAgICAgICBuZXdSYW5nZS5wdXNoKHJhbmdlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5idWZmZXJSYW5nZSA9IG5ld1JhbmdlO1xuXG4gICAgLy8gaGFuZGxlIGVuZCBvZiBpbW1lZGlhdGUgc3dpdGNoaW5nIGlmIG5lZWRlZFxuICAgIGlmICh0aGlzLmltbWVkaWF0ZVN3aXRjaCkge1xuICAgICAgdGhpcy5pbW1lZGlhdGVMZXZlbFN3aXRjaEVuZCgpO1xuICAgIH1cbiAgICAvLyBtb3ZlIHRvIElETEUgb25jZSBmbHVzaCBjb21wbGV0ZS4gdGhpcyBzaG91bGQgdHJpZ2dlciBuZXcgZnJhZ21lbnQgbG9hZGluZ1xuICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgIC8vIHJlc2V0IHJlZmVyZW5jZSB0byBmcmFnXG4gICAgdGhpcy5mcmFnUHJldmlvdXMgPSBudWxsO1xuICB9XG5cbiAgc3dhcEF1ZGlvQ29kZWMoKSB7XG4gICAgdGhpcy5hdWRpb0NvZGVjU3dhcCA9ICF0aGlzLmF1ZGlvQ29kZWNTd2FwO1xuICB9XG5cbiAgdGltZVJhbmdlc1RvU3RyaW5nKHIpIHtcbiAgICB2YXIgbG9nID0gJycsIGxlbiA9IHIubGVuZ3RoO1xuICAgIGZvciAodmFyIGk9MDsgaTxsZW47IGkrKykge1xuICAgICAgbG9nICs9ICdbJyArIHIuc3RhcnQoaSkgKyAnLCcgKyByLmVuZChpKSArICddJztcbiAgICB9XG4gICAgcmV0dXJuIGxvZztcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgU3RyZWFtQ29udHJvbGxlcjtcblxuIiwiLypcbiAqIFRpbWVsaW5lIENvbnRyb2xsZXJcbiovXG5cbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IEV2ZW50SGFuZGxlciBmcm9tICcuLi9ldmVudC1oYW5kbGVyJztcbmltcG9ydCBDRUE3MDhJbnRlcnByZXRlciBmcm9tICcuLi91dGlscy9jZWEtNzA4LWludGVycHJldGVyJztcblxuY2xhc3MgVGltZWxpbmVDb250cm9sbGVyIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMpIHtcbiAgICBzdXBlcihobHMsIEV2ZW50Lk1FRElBX0FUVEFDSElORyxcbiAgICAgICAgICAgICAgICBFdmVudC5NRURJQV9ERVRBQ0hJTkcsXG4gICAgICAgICAgICAgICAgRXZlbnQuRlJBR19QQVJTSU5HX1VTRVJEQVRBLFxuICAgICAgICAgICAgICAgIEV2ZW50Lk1BTklGRVNUX0xPQURJTkcsXG4gICAgICAgICAgICAgICAgRXZlbnQuRlJBR19MT0FERUQpO1xuXG4gICAgdGhpcy5obHMgPSBobHM7XG4gICAgdGhpcy5jb25maWcgPSBobHMuY29uZmlnO1xuXG4gICAgaWYgKHRoaXMuY29uZmlnLmVuYWJsZUNFQTcwOENhcHRpb25zKVxuICAgIHtcbiAgICAgIHRoaXMuY2VhNzA4SW50ZXJwcmV0ZXIgPSBuZXcgQ0VBNzA4SW50ZXJwcmV0ZXIoKTtcbiAgICB9XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIEV2ZW50SGFuZGxlci5wcm90b3R5cGUuZGVzdHJveS5jYWxsKHRoaXMpO1xuICB9XG5cbiAgb25NZWRpYUF0dGFjaGluZyhkYXRhKSB7XG4gICAgdmFyIG1lZGlhID0gdGhpcy5tZWRpYSA9IGRhdGEubWVkaWE7XG4gICAgdGhpcy5jZWE3MDhJbnRlcnByZXRlci5hdHRhY2gobWVkaWEpO1xuICB9XG5cbiAgb25NZWRpYURldGFjaGluZygpIHtcbiAgICB0aGlzLmNlYTcwOEludGVycHJldGVyLmRldGFjaCgpO1xuICB9XG5cbiAgb25NYW5pZmVzdExvYWRpbmcoKVxuICB7XG4gICAgdGhpcy5sYXN0UHRzID0gTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZO1xuICB9XG5cbiAgb25GcmFnTG9hZGVkKGRhdGEpXG4gIHtcbiAgICB2YXIgcHRzID0gZGF0YS5mcmFnLnN0YXJ0OyAvL051bWJlci5QT1NJVElWRV9JTkZJTklUWTtcblxuICAgIC8vIGlmIHRoaXMgaXMgYSBmcmFnIGZvciBhIHByZXZpb3VzbHkgbG9hZGVkIHRpbWVyYW5nZSwgcmVtb3ZlIGFsbCBjYXB0aW9uc1xuICAgIC8vIFRPRE86IGNvbnNpZGVyIGp1c3QgcmVtb3ZpbmcgY2FwdGlvbnMgZm9yIHRoZSB0aW1lcmFuZ2VcbiAgICBpZiAocHRzIDw9IHRoaXMubGFzdFB0cylcbiAgICB7XG4gICAgICB0aGlzLmNlYTcwOEludGVycHJldGVyLmNsZWFyKCk7XG4gICAgfVxuXG4gICAgdGhpcy5sYXN0UHRzID0gcHRzO1xuICB9XG5cbiAgb25GcmFnUGFyc2luZ1VzZXJkYXRhKGRhdGEpIHtcbiAgICAvLyBwdXNoIGFsbCBvZiB0aGUgQ0VBLTcwOCBtZXNzYWdlcyBpbnRvIHRoZSBpbnRlcnByZXRlclxuICAgIC8vIGltbWVkaWF0ZWx5LiBJdCB3aWxsIGNyZWF0ZSB0aGUgcHJvcGVyIHRpbWVzdGFtcHMgYmFzZWQgb24gb3VyIFBUUyB2YWx1ZVxuICAgIGZvciAodmFyIGk9MDsgaTxkYXRhLnNhbXBsZXMubGVuZ3RoOyBpKyspXG4gICAge1xuICAgICAgdGhpcy5jZWE3MDhJbnRlcnByZXRlci5wdXNoKGRhdGEuc2FtcGxlc1tpXS5wdHMsIGRhdGEuc2FtcGxlc1tpXS5ieXRlcyk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFRpbWVsaW5lQ29udHJvbGxlcjtcbiIsIi8qXG4gKlxuICogVGhpcyBmaWxlIGNvbnRhaW5zIGFuIGFkYXB0YXRpb24gb2YgdGhlIEFFUyBkZWNyeXB0aW9uIGFsZ29yaXRobVxuICogZnJvbSB0aGUgU3RhbmRmb3JkIEphdmFzY3JpcHQgQ3J5cHRvZ3JhcGh5IExpYnJhcnkuIFRoYXQgd29yayBpc1xuICogY292ZXJlZCBieSB0aGUgZm9sbG93aW5nIGNvcHlyaWdodCBhbmQgcGVybWlzc2lvbnMgbm90aWNlOlxuICpcbiAqIENvcHlyaWdodCAyMDA5LTIwMTAgRW1pbHkgU3RhcmssIE1pa2UgSGFtYnVyZywgRGFuIEJvbmVoLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBSZWRpc3RyaWJ1dGlvbiBhbmQgdXNlIGluIHNvdXJjZSBhbmQgYmluYXJ5IGZvcm1zLCB3aXRoIG9yIHdpdGhvdXRcbiAqIG1vZGlmaWNhdGlvbiwgYXJlIHBlcm1pdHRlZCBwcm92aWRlZCB0aGF0IHRoZSBmb2xsb3dpbmcgY29uZGl0aW9ucyBhcmVcbiAqIG1ldDpcbiAqXG4gKiAxLiBSZWRpc3RyaWJ1dGlvbnMgb2Ygc291cmNlIGNvZGUgbXVzdCByZXRhaW4gdGhlIGFib3ZlIGNvcHlyaWdodFxuICogICAgbm90aWNlLCB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZyBkaXNjbGFpbWVyLlxuICpcbiAqIDIuIFJlZGlzdHJpYnV0aW9ucyBpbiBiaW5hcnkgZm9ybSBtdXN0IHJlcHJvZHVjZSB0aGUgYWJvdmVcbiAqICAgIGNvcHlyaWdodCBub3RpY2UsIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nXG4gKiAgICBkaXNjbGFpbWVyIGluIHRoZSBkb2N1bWVudGF0aW9uIGFuZC9vciBvdGhlciBtYXRlcmlhbHMgcHJvdmlkZWRcbiAqICAgIHdpdGggdGhlIGRpc3RyaWJ1dGlvbi5cbiAqXG4gKiBUSElTIFNPRlRXQVJFIElTIFBST1ZJREVEIEJZIFRIRSBBVVRIT1JTIGBgQVMgSVMnJyBBTkQgQU5ZIEVYUFJFU1MgT1JcbiAqIElNUExJRUQgV0FSUkFOVElFUywgSU5DTFVESU5HLCBCVVQgTk9UIExJTUlURUQgVE8sIFRIRSBJTVBMSUVEXG4gKiBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSBBTkQgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQVJFXG4gKiBESVNDTEFJTUVELiBJTiBOTyBFVkVOVCBTSEFMTCA8Q09QWVJJR0hUIEhPTERFUj4gT1IgQ09OVFJJQlVUT1JTIEJFXG4gKiBMSUFCTEUgRk9SIEFOWSBESVJFQ1QsIElORElSRUNULCBJTkNJREVOVEFMLCBTUEVDSUFMLCBFWEVNUExBUlksIE9SXG4gKiBDT05TRVFVRU5USUFMIERBTUFHRVMgKElOQ0xVRElORywgQlVUIE5PVCBMSU1JVEVEIFRPLCBQUk9DVVJFTUVOVCBPRlxuICogU1VCU1RJVFVURSBHT09EUyBPUiBTRVJWSUNFUzsgTE9TUyBPRiBVU0UsIERBVEEsIE9SIFBST0ZJVFM7IE9SXG4gKiBCVVNJTkVTUyBJTlRFUlJVUFRJT04pIEhPV0VWRVIgQ0FVU0VEIEFORCBPTiBBTlkgVEhFT1JZIE9GIExJQUJJTElUWSxcbiAqIFdIRVRIRVIgSU4gQ09OVFJBQ1QsIFNUUklDVCBMSUFCSUxJVFksIE9SIFRPUlQgKElOQ0xVRElORyBORUdMSUdFTkNFXG4gKiBPUiBPVEhFUldJU0UpIEFSSVNJTkcgSU4gQU5ZIFdBWSBPVVQgT0YgVEhFIFVTRSBPRiBUSElTIFNPRlRXQVJFLCBFVkVOXG4gKiBJRiBBRFZJU0VEIE9GIFRIRSBQT1NTSUJJTElUWSBPRiBTVUNIIERBTUFHRS5cbiAqXG4gKiBUaGUgdmlld3MgYW5kIGNvbmNsdXNpb25zIGNvbnRhaW5lZCBpbiB0aGUgc29mdHdhcmUgYW5kIGRvY3VtZW50YXRpb25cbiAqIGFyZSB0aG9zZSBvZiB0aGUgYXV0aG9ycyBhbmQgc2hvdWxkIG5vdCBiZSBpbnRlcnByZXRlZCBhcyByZXByZXNlbnRpbmdcbiAqIG9mZmljaWFsIHBvbGljaWVzLCBlaXRoZXIgZXhwcmVzc2VkIG9yIGltcGxpZWQsIG9mIHRoZSBhdXRob3JzLlxuICovXG5jbGFzcyBBRVMge1xuXG4gIC8qKlxuICAgKiBTY2hlZHVsZSBvdXQgYW4gQUVTIGtleSBmb3IgYm90aCBlbmNyeXB0aW9uIGFuZCBkZWNyeXB0aW9uLiBUaGlzXG4gICAqIGlzIGEgbG93LWxldmVsIGNsYXNzLiBVc2UgYSBjaXBoZXIgbW9kZSB0byBkbyBidWxrIGVuY3J5cHRpb24uXG4gICAqXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0ga2V5IHtBcnJheX0gVGhlIGtleSBhcyBhbiBhcnJheSBvZiA0LCA2IG9yIDggd29yZHMuXG4gICAqL1xuICBjb25zdHJ1Y3RvcihrZXkpIHtcbiAgICAvKipcbiAgICAgKiBUaGUgZXhwYW5kZWQgUy1ib3ggYW5kIGludmVyc2UgUy1ib3ggdGFibGVzLiBUaGVzZSB3aWxsIGJlIGNvbXB1dGVkXG4gICAgICogb24gdGhlIGNsaWVudCBzbyB0aGF0IHdlIGRvbid0IGhhdmUgdG8gc2VuZCB0aGVtIGRvd24gdGhlIHdpcmUuXG4gICAgICpcbiAgICAgKiBUaGVyZSBhcmUgdHdvIHRhYmxlcywgX3RhYmxlc1swXSBpcyBmb3IgZW5jcnlwdGlvbiBhbmRcbiAgICAgKiBfdGFibGVzWzFdIGlzIGZvciBkZWNyeXB0aW9uLlxuICAgICAqXG4gICAgICogVGhlIGZpcnN0IDQgc3ViLXRhYmxlcyBhcmUgdGhlIGV4cGFuZGVkIFMtYm94IHdpdGggTWl4Q29sdW1ucy4gVGhlXG4gICAgICogbGFzdCAoX3RhYmxlc1swMV1bNF0pIGlzIHRoZSBTLWJveCBpdHNlbGYuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHRoaXMuX3RhYmxlcyA9IFtbW10sW10sW10sW10sW11dLFtbXSxbXSxbXSxbXSxbXV1dO1xuXG4gICAgdGhpcy5fcHJlY29tcHV0ZSgpO1xuXG4gICAgdmFyIGksIGosIHRtcCxcbiAgICBlbmNLZXksIGRlY0tleSxcbiAgICBzYm94ID0gdGhpcy5fdGFibGVzWzBdWzRdLCBkZWNUYWJsZSA9IHRoaXMuX3RhYmxlc1sxXSxcbiAgICBrZXlMZW4gPSBrZXkubGVuZ3RoLCByY29uID0gMTtcblxuICAgIGlmIChrZXlMZW4gIT09IDQgJiYga2V5TGVuICE9PSA2ICYmIGtleUxlbiAhPT0gOCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGFlcyBrZXkgc2l6ZT0nICsga2V5TGVuKTtcbiAgICB9XG5cbiAgICBlbmNLZXkgPSBrZXkuc2xpY2UoMCk7XG4gICAgZGVjS2V5ID0gW107XG4gICAgdGhpcy5fa2V5ID0gW2VuY0tleSwgZGVjS2V5XTtcblxuICAgIC8vIHNjaGVkdWxlIGVuY3J5cHRpb24ga2V5c1xuICAgIGZvciAoaSA9IGtleUxlbjsgaSA8IDQgKiBrZXlMZW4gKyAyODsgaSsrKSB7XG4gICAgICB0bXAgPSBlbmNLZXlbaS0xXTtcblxuICAgICAgLy8gYXBwbHkgc2JveFxuICAgICAgaWYgKGkla2V5TGVuID09PSAwIHx8IChrZXlMZW4gPT09IDggJiYgaSVrZXlMZW4gPT09IDQpKSB7XG4gICAgICAgIHRtcCA9IHNib3hbdG1wPj4+MjRdPDwyNCBeIHNib3hbdG1wPj4xNiYyNTVdPDwxNiBeIHNib3hbdG1wPj44JjI1NV08PDggXiBzYm94W3RtcCYyNTVdO1xuXG4gICAgICAgIC8vIHNoaWZ0IHJvd3MgYW5kIGFkZCByY29uXG4gICAgICAgIGlmIChpJWtleUxlbiA9PT0gMCkge1xuICAgICAgICAgIHRtcCA9IHRtcDw8OCBeIHRtcD4+PjI0IF4gcmNvbjw8MjQ7XG4gICAgICAgICAgcmNvbiA9IHJjb248PDEgXiAocmNvbj4+NykqMjgzO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGVuY0tleVtpXSA9IGVuY0tleVtpLWtleUxlbl0gXiB0bXA7XG4gICAgfVxuXG4gICAgLy8gc2NoZWR1bGUgZGVjcnlwdGlvbiBrZXlzXG4gICAgZm9yIChqID0gMDsgaTsgaisrLCBpLS0pIHtcbiAgICAgIHRtcCA9IGVuY0tleVtqJjMgPyBpIDogaSAtIDRdO1xuICAgICAgaWYgKGk8PTQgfHwgajw0KSB7XG4gICAgICAgIGRlY0tleVtqXSA9IHRtcDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRlY0tleVtqXSA9IGRlY1RhYmxlWzBdW3Nib3hbdG1wPj4+MjQgICAgICBdXSBeXG4gICAgICAgICAgZGVjVGFibGVbMV1bc2JveFt0bXA+PjE2ICAmIDI1NV1dIF5cbiAgICAgICAgICBkZWNUYWJsZVsyXVtzYm94W3RtcD4+OCAgICYgMjU1XV0gXlxuICAgICAgICAgIGRlY1RhYmxlWzNdW3Nib3hbdG1wICAgICAgJiAyNTVdXTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRXhwYW5kIHRoZSBTLWJveCB0YWJsZXMuXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfcHJlY29tcHV0ZSgpIHtcbiAgICB2YXIgZW5jVGFibGUgPSB0aGlzLl90YWJsZXNbMF0sIGRlY1RhYmxlID0gdGhpcy5fdGFibGVzWzFdLFxuICAgIHNib3ggPSBlbmNUYWJsZVs0XSwgc2JveEludiA9IGRlY1RhYmxlWzRdLFxuICAgIGksIHgsIHhJbnYsIGQ9W10sIHRoPVtdLCB4MiwgeDQsIHg4LCBzLCB0RW5jLCB0RGVjO1xuXG4gICAgLy8gQ29tcHV0ZSBkb3VibGUgYW5kIHRoaXJkIHRhYmxlc1xuICAgIGZvciAoaSA9IDA7IGkgPCAyNTY7IGkrKykge1xuICAgICAgdGhbKCBkW2ldID0gaTw8MSBeIChpPj43KSoyODMgKV5pXT1pO1xuICAgIH1cblxuICAgIGZvciAoeCA9IHhJbnYgPSAwOyAhc2JveFt4XTsgeCBePSB4MiB8fCAxLCB4SW52ID0gdGhbeEludl0gfHwgMSkge1xuICAgICAgLy8gQ29tcHV0ZSBzYm94XG4gICAgICBzID0geEludiBeIHhJbnY8PDEgXiB4SW52PDwyIF4geEludjw8MyBeIHhJbnY8PDQ7XG4gICAgICBzID0gcz4+OCBeIHMmMjU1IF4gOTk7XG4gICAgICBzYm94W3hdID0gcztcbiAgICAgIHNib3hJbnZbc10gPSB4O1xuXG4gICAgICAvLyBDb21wdXRlIE1peENvbHVtbnNcbiAgICAgIHg4ID0gZFt4NCA9IGRbeDIgPSBkW3hdXV07XG4gICAgICB0RGVjID0geDgqMHgxMDEwMTAxIF4geDQqMHgxMDAwMSBeIHgyKjB4MTAxIF4geCoweDEwMTAxMDA7XG4gICAgICB0RW5jID0gZFtzXSoweDEwMSBeIHMqMHgxMDEwMTAwO1xuXG4gICAgICBmb3IgKGkgPSAwOyBpIDwgNDsgaSsrKSB7XG4gICAgICAgIGVuY1RhYmxlW2ldW3hdID0gdEVuYyA9IHRFbmM8PDI0IF4gdEVuYz4+Pjg7XG4gICAgICAgIGRlY1RhYmxlW2ldW3NdID0gdERlYyA9IHREZWM8PDI0IF4gdERlYz4+Pjg7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ29tcGFjdGlmeS4gQ29uc2lkZXJhYmxlIHNwZWVkdXAgb24gRmlyZWZveC5cbiAgICBmb3IgKGkgPSAwOyBpIDwgNTsgaSsrKSB7XG4gICAgICBlbmNUYWJsZVtpXSA9IGVuY1RhYmxlW2ldLnNsaWNlKDApO1xuICAgICAgZGVjVGFibGVbaV0gPSBkZWNUYWJsZVtpXS5zbGljZSgwKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRGVjcnlwdCAxNiBieXRlcywgc3BlY2lmaWVkIGFzIGZvdXIgMzItYml0IHdvcmRzLlxuICAgKiBAcGFyYW0gZW5jcnlwdGVkMCB7bnVtYmVyfSB0aGUgZmlyc3Qgd29yZCB0byBkZWNyeXB0XG4gICAqIEBwYXJhbSBlbmNyeXB0ZWQxIHtudW1iZXJ9IHRoZSBzZWNvbmQgd29yZCB0byBkZWNyeXB0XG4gICAqIEBwYXJhbSBlbmNyeXB0ZWQyIHtudW1iZXJ9IHRoZSB0aGlyZCB3b3JkIHRvIGRlY3J5cHRcbiAgICogQHBhcmFtIGVuY3J5cHRlZDMge251bWJlcn0gdGhlIGZvdXJ0aCB3b3JkIHRvIGRlY3J5cHRcbiAgICogQHBhcmFtIG91dCB7SW50MzJBcnJheX0gdGhlIGFycmF5IHRvIHdyaXRlIHRoZSBkZWNyeXB0ZWQgd29yZHNcbiAgICogaW50b1xuICAgKiBAcGFyYW0gb2Zmc2V0IHtudW1iZXJ9IHRoZSBvZmZzZXQgaW50byB0aGUgb3V0cHV0IGFycmF5IHRvIHN0YXJ0XG4gICAqIHdyaXRpbmcgcmVzdWx0c1xuICAgKiBAcmV0dXJuIHtBcnJheX0gVGhlIHBsYWludGV4dC5cbiAgICovXG4gIGRlY3J5cHQoZW5jcnlwdGVkMCwgZW5jcnlwdGVkMSwgZW5jcnlwdGVkMiwgZW5jcnlwdGVkMywgb3V0LCBvZmZzZXQpIHtcbiAgICB2YXIga2V5ID0gdGhpcy5fa2V5WzFdLFxuICAgIC8vIHN0YXRlIHZhcmlhYmxlcyBhLGIsYyxkIGFyZSBsb2FkZWQgd2l0aCBwcmUtd2hpdGVuZWQgZGF0YVxuICAgIGEgPSBlbmNyeXB0ZWQwIF4ga2V5WzBdLFxuICAgIGIgPSBlbmNyeXB0ZWQzIF4ga2V5WzFdLFxuICAgIGMgPSBlbmNyeXB0ZWQyIF4ga2V5WzJdLFxuICAgIGQgPSBlbmNyeXB0ZWQxIF4ga2V5WzNdLFxuICAgIGEyLCBiMiwgYzIsXG5cbiAgICBuSW5uZXJSb3VuZHMgPSBrZXkubGVuZ3RoIC8gNCAtIDIsIC8vIGtleS5sZW5ndGggPT09IDIgP1xuICAgIGksXG4gICAga0luZGV4ID0gNCxcbiAgICB0YWJsZSA9IHRoaXMuX3RhYmxlc1sxXSxcblxuICAgIC8vIGxvYWQgdXAgdGhlIHRhYmxlc1xuICAgIHRhYmxlMCAgICA9IHRhYmxlWzBdLFxuICAgIHRhYmxlMSAgICA9IHRhYmxlWzFdLFxuICAgIHRhYmxlMiAgICA9IHRhYmxlWzJdLFxuICAgIHRhYmxlMyAgICA9IHRhYmxlWzNdLFxuICAgIHNib3ggID0gdGFibGVbNF07XG5cbiAgICAvLyBJbm5lciByb3VuZHMuIENyaWJiZWQgZnJvbSBPcGVuU1NMLlxuICAgIGZvciAoaSA9IDA7IGkgPCBuSW5uZXJSb3VuZHM7IGkrKykge1xuICAgICAgYTIgPSB0YWJsZTBbYT4+PjI0XSBeIHRhYmxlMVtiPj4xNiAmIDI1NV0gXiB0YWJsZTJbYz4+OCAmIDI1NV0gXiB0YWJsZTNbZCAmIDI1NV0gXiBrZXlba0luZGV4XTtcbiAgICAgIGIyID0gdGFibGUwW2I+Pj4yNF0gXiB0YWJsZTFbYz4+MTYgJiAyNTVdIF4gdGFibGUyW2Q+PjggJiAyNTVdIF4gdGFibGUzW2EgJiAyNTVdIF4ga2V5W2tJbmRleCArIDFdO1xuICAgICAgYzIgPSB0YWJsZTBbYz4+PjI0XSBeIHRhYmxlMVtkPj4xNiAmIDI1NV0gXiB0YWJsZTJbYT4+OCAmIDI1NV0gXiB0YWJsZTNbYiAmIDI1NV0gXiBrZXlba0luZGV4ICsgMl07XG4gICAgICBkICA9IHRhYmxlMFtkPj4+MjRdIF4gdGFibGUxW2E+PjE2ICYgMjU1XSBeIHRhYmxlMltiPj44ICYgMjU1XSBeIHRhYmxlM1tjICYgMjU1XSBeIGtleVtrSW5kZXggKyAzXTtcbiAgICAgIGtJbmRleCArPSA0O1xuICAgICAgYT1hMjsgYj1iMjsgYz1jMjtcbiAgICB9XG5cbiAgICAvLyBMYXN0IHJvdW5kLlxuICAgIGZvciAoaSA9IDA7IGkgPCA0OyBpKyspIHtcbiAgICAgIG91dFsoMyAmIC1pKSArIG9mZnNldF0gPVxuICAgICAgICBzYm94W2E+Pj4yNCAgICAgIF08PDI0IF5cbiAgICAgICAgc2JveFtiPj4xNiAgJiAyNTVdPDwxNiBeXG4gICAgICAgIHNib3hbYz4+OCAgICYgMjU1XTw8OCAgXlxuICAgICAgICBzYm94W2QgICAgICAmIDI1NV0gICAgIF5cbiAgICAgICAga2V5W2tJbmRleCsrXTtcbiAgICAgIGEyPWE7IGE9YjsgYj1jOyBjPWQ7IGQ9YTI7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEFFUztcbiIsIi8qXG4gKlxuICogVGhpcyBmaWxlIGNvbnRhaW5zIGFuIGFkYXB0YXRpb24gb2YgdGhlIEFFUyBkZWNyeXB0aW9uIGFsZ29yaXRobVxuICogZnJvbSB0aGUgU3RhbmRmb3JkIEphdmFzY3JpcHQgQ3J5cHRvZ3JhcGh5IExpYnJhcnkuIFRoYXQgd29yayBpc1xuICogY292ZXJlZCBieSB0aGUgZm9sbG93aW5nIGNvcHlyaWdodCBhbmQgcGVybWlzc2lvbnMgbm90aWNlOlxuICpcbiAqIENvcHlyaWdodCAyMDA5LTIwMTAgRW1pbHkgU3RhcmssIE1pa2UgSGFtYnVyZywgRGFuIEJvbmVoLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBSZWRpc3RyaWJ1dGlvbiBhbmQgdXNlIGluIHNvdXJjZSBhbmQgYmluYXJ5IGZvcm1zLCB3aXRoIG9yIHdpdGhvdXRcbiAqIG1vZGlmaWNhdGlvbiwgYXJlIHBlcm1pdHRlZCBwcm92aWRlZCB0aGF0IHRoZSBmb2xsb3dpbmcgY29uZGl0aW9ucyBhcmVcbiAqIG1ldDpcbiAqXG4gKiAxLiBSZWRpc3RyaWJ1dGlvbnMgb2Ygc291cmNlIGNvZGUgbXVzdCByZXRhaW4gdGhlIGFib3ZlIGNvcHlyaWdodFxuICogICAgbm90aWNlLCB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZyBkaXNjbGFpbWVyLlxuICpcbiAqIDIuIFJlZGlzdHJpYnV0aW9ucyBpbiBiaW5hcnkgZm9ybSBtdXN0IHJlcHJvZHVjZSB0aGUgYWJvdmVcbiAqICAgIGNvcHlyaWdodCBub3RpY2UsIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nXG4gKiAgICBkaXNjbGFpbWVyIGluIHRoZSBkb2N1bWVudGF0aW9uIGFuZC9vciBvdGhlciBtYXRlcmlhbHMgcHJvdmlkZWRcbiAqICAgIHdpdGggdGhlIGRpc3RyaWJ1dGlvbi5cbiAqXG4gKiBUSElTIFNPRlRXQVJFIElTIFBST1ZJREVEIEJZIFRIRSBBVVRIT1JTIGBgQVMgSVMnJyBBTkQgQU5ZIEVYUFJFU1MgT1JcbiAqIElNUExJRUQgV0FSUkFOVElFUywgSU5DTFVESU5HLCBCVVQgTk9UIExJTUlURUQgVE8sIFRIRSBJTVBMSUVEXG4gKiBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSBBTkQgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQVJFXG4gKiBESVNDTEFJTUVELiBJTiBOTyBFVkVOVCBTSEFMTCA8Q09QWVJJR0hUIEhPTERFUj4gT1IgQ09OVFJJQlVUT1JTIEJFXG4gKiBMSUFCTEUgRk9SIEFOWSBESVJFQ1QsIElORElSRUNULCBJTkNJREVOVEFMLCBTUEVDSUFMLCBFWEVNUExBUlksIE9SXG4gKiBDT05TRVFVRU5USUFMIERBTUFHRVMgKElOQ0xVRElORywgQlVUIE5PVCBMSU1JVEVEIFRPLCBQUk9DVVJFTUVOVCBPRlxuICogU1VCU1RJVFVURSBHT09EUyBPUiBTRVJWSUNFUzsgTE9TUyBPRiBVU0UsIERBVEEsIE9SIFBST0ZJVFM7IE9SXG4gKiBCVVNJTkVTUyBJTlRFUlJVUFRJT04pIEhPV0VWRVIgQ0FVU0VEIEFORCBPTiBBTlkgVEhFT1JZIE9GIExJQUJJTElUWSxcbiAqIFdIRVRIRVIgSU4gQ09OVFJBQ1QsIFNUUklDVCBMSUFCSUxJVFksIE9SIFRPUlQgKElOQ0xVRElORyBORUdMSUdFTkNFXG4gKiBPUiBPVEhFUldJU0UpIEFSSVNJTkcgSU4gQU5ZIFdBWSBPVVQgT0YgVEhFIFVTRSBPRiBUSElTIFNPRlRXQVJFLCBFVkVOXG4gKiBJRiBBRFZJU0VEIE9GIFRIRSBQT1NTSUJJTElUWSBPRiBTVUNIIERBTUFHRS5cbiAqXG4gKiBUaGUgdmlld3MgYW5kIGNvbmNsdXNpb25zIGNvbnRhaW5lZCBpbiB0aGUgc29mdHdhcmUgYW5kIGRvY3VtZW50YXRpb25cbiAqIGFyZSB0aG9zZSBvZiB0aGUgYXV0aG9ycyBhbmQgc2hvdWxkIG5vdCBiZSBpbnRlcnByZXRlZCBhcyByZXByZXNlbnRpbmdcbiAqIG9mZmljaWFsIHBvbGljaWVzLCBlaXRoZXIgZXhwcmVzc2VkIG9yIGltcGxpZWQsIG9mIHRoZSBhdXRob3JzLlxuICovXG5cbmltcG9ydCBBRVMgZnJvbSAnLi9hZXMnO1xuXG5jbGFzcyBBRVMxMjhEZWNyeXB0ZXIge1xuXG4gIGNvbnN0cnVjdG9yKGtleSwgaW5pdFZlY3Rvcikge1xuICAgIHRoaXMua2V5ID0ga2V5O1xuICAgIHRoaXMuaXYgPSBpbml0VmVjdG9yO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnZlcnQgbmV0d29yay1vcmRlciAoYmlnLWVuZGlhbikgYnl0ZXMgaW50byB0aGVpciBsaXR0bGUtZW5kaWFuXG4gICAqIHJlcHJlc2VudGF0aW9uLlxuICAgKi9cbiAgbnRvaCh3b3JkKSB7XG4gICAgcmV0dXJuICh3b3JkIDw8IDI0KSB8XG4gICAgICAoKHdvcmQgJiAweGZmMDApIDw8IDgpIHxcbiAgICAgICgod29yZCAmIDB4ZmYwMDAwKSA+PiA4KSB8XG4gICAgICAod29yZCA+Pj4gMjQpO1xuICB9XG5cblxuICAvKipcbiAgICogRGVjcnlwdCBieXRlcyB1c2luZyBBRVMtMTI4IHdpdGggQ0JDIGFuZCBQS0NTIzcgcGFkZGluZy5cbiAgICogQHBhcmFtIGVuY3J5cHRlZCB7VWludDhBcnJheX0gdGhlIGVuY3J5cHRlZCBieXRlc1xuICAgKiBAcGFyYW0ga2V5IHtVaW50MzJBcnJheX0gdGhlIGJ5dGVzIG9mIHRoZSBkZWNyeXB0aW9uIGtleVxuICAgKiBAcGFyYW0gaW5pdFZlY3RvciB7VWludDMyQXJyYXl9IHRoZSBpbml0aWFsaXphdGlvbiB2ZWN0b3IgKElWKSB0b1xuICAgKiB1c2UgZm9yIHRoZSBmaXJzdCByb3VuZCBvZiBDQkMuXG4gICAqIEByZXR1cm4ge1VpbnQ4QXJyYXl9IHRoZSBkZWNyeXB0ZWQgYnl0ZXNcbiAgICpcbiAgICogQHNlZSBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0FkdmFuY2VkX0VuY3J5cHRpb25fU3RhbmRhcmRcbiAgICogQHNlZSBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0Jsb2NrX2NpcGhlcl9tb2RlX29mX29wZXJhdGlvbiNDaXBoZXJfQmxvY2tfQ2hhaW5pbmdfLjI4Q0JDLjI5XG4gICAqIEBzZWUgaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzIzMTVcbiAgICovXG4gIGRvRGVjcnlwdChlbmNyeXB0ZWQsIGtleSwgaW5pdFZlY3Rvcikge1xuICAgIHZhclxuICAgICAgLy8gd29yZC1sZXZlbCBhY2Nlc3MgdG8gdGhlIGVuY3J5cHRlZCBieXRlc1xuICAgICAgZW5jcnlwdGVkMzIgPSBuZXcgSW50MzJBcnJheShlbmNyeXB0ZWQuYnVmZmVyLCBlbmNyeXB0ZWQuYnl0ZU9mZnNldCwgZW5jcnlwdGVkLmJ5dGVMZW5ndGggPj4gMiksXG5cbiAgICBkZWNpcGhlciA9IG5ldyBBRVMoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoa2V5KSksXG5cbiAgICAvLyBieXRlIGFuZCB3b3JkLWxldmVsIGFjY2VzcyBmb3IgdGhlIGRlY3J5cHRlZCBvdXRwdXRcbiAgICBkZWNyeXB0ZWQgPSBuZXcgVWludDhBcnJheShlbmNyeXB0ZWQuYnl0ZUxlbmd0aCksXG4gICAgZGVjcnlwdGVkMzIgPSBuZXcgSW50MzJBcnJheShkZWNyeXB0ZWQuYnVmZmVyKSxcblxuICAgIC8vIHRlbXBvcmFyeSB2YXJpYWJsZXMgZm9yIHdvcmtpbmcgd2l0aCB0aGUgSVYsIGVuY3J5cHRlZCwgYW5kXG4gICAgLy8gZGVjcnlwdGVkIGRhdGFcbiAgICBpbml0MCwgaW5pdDEsIGluaXQyLCBpbml0MyxcbiAgICBlbmNyeXB0ZWQwLCBlbmNyeXB0ZWQxLCBlbmNyeXB0ZWQyLCBlbmNyeXB0ZWQzLFxuXG4gICAgLy8gaXRlcmF0aW9uIHZhcmlhYmxlXG4gICAgd29yZEl4O1xuXG4gICAgLy8gcHVsbCBvdXQgdGhlIHdvcmRzIG9mIHRoZSBJViB0byBlbnN1cmUgd2UgZG9uJ3QgbW9kaWZ5IHRoZVxuICAgIC8vIHBhc3NlZC1pbiByZWZlcmVuY2UgYW5kIGVhc2llciBhY2Nlc3NcbiAgICBpbml0MCA9IH5+aW5pdFZlY3RvclswXTtcbiAgICBpbml0MSA9IH5+aW5pdFZlY3RvclsxXTtcbiAgICBpbml0MiA9IH5+aW5pdFZlY3RvclsyXTtcbiAgICBpbml0MyA9IH5+aW5pdFZlY3RvclszXTtcblxuICAgIC8vIGRlY3J5cHQgZm91ciB3b3JkIHNlcXVlbmNlcywgYXBwbHlpbmcgY2lwaGVyLWJsb2NrIGNoYWluaW5nIChDQkMpXG4gICAgLy8gdG8gZWFjaCBkZWNyeXB0ZWQgYmxvY2tcbiAgICBmb3IgKHdvcmRJeCA9IDA7IHdvcmRJeCA8IGVuY3J5cHRlZDMyLmxlbmd0aDsgd29yZEl4ICs9IDQpIHtcbiAgICAgIC8vIGNvbnZlcnQgYmlnLWVuZGlhbiAobmV0d29yayBvcmRlcikgd29yZHMgaW50byBsaXR0bGUtZW5kaWFuXG4gICAgICAvLyAoamF2YXNjcmlwdCBvcmRlcilcbiAgICAgIGVuY3J5cHRlZDAgPSB+fnRoaXMubnRvaChlbmNyeXB0ZWQzMlt3b3JkSXhdKTtcbiAgICAgIGVuY3J5cHRlZDEgPSB+fnRoaXMubnRvaChlbmNyeXB0ZWQzMlt3b3JkSXggKyAxXSk7XG4gICAgICBlbmNyeXB0ZWQyID0gfn50aGlzLm50b2goZW5jcnlwdGVkMzJbd29yZEl4ICsgMl0pO1xuICAgICAgZW5jcnlwdGVkMyA9IH5+dGhpcy5udG9oKGVuY3J5cHRlZDMyW3dvcmRJeCArIDNdKTtcblxuICAgICAgLy8gZGVjcnlwdCB0aGUgYmxvY2tcbiAgICAgIGRlY2lwaGVyLmRlY3J5cHQoZW5jcnlwdGVkMCxcbiAgICAgICAgICBlbmNyeXB0ZWQxLFxuICAgICAgICAgIGVuY3J5cHRlZDIsXG4gICAgICAgICAgZW5jcnlwdGVkMyxcbiAgICAgICAgICBkZWNyeXB0ZWQzMixcbiAgICAgICAgICB3b3JkSXgpO1xuXG4gICAgICAvLyBYT1Igd2l0aCB0aGUgSVYsIGFuZCByZXN0b3JlIG5ldHdvcmsgYnl0ZS1vcmRlciB0byBvYnRhaW4gdGhlXG4gICAgICAvLyBwbGFpbnRleHRcbiAgICAgIGRlY3J5cHRlZDMyW3dvcmRJeF0gICAgID0gdGhpcy5udG9oKGRlY3J5cHRlZDMyW3dvcmRJeF0gXiBpbml0MCk7XG4gICAgICBkZWNyeXB0ZWQzMlt3b3JkSXggKyAxXSA9IHRoaXMubnRvaChkZWNyeXB0ZWQzMlt3b3JkSXggKyAxXSBeIGluaXQxKTtcbiAgICAgIGRlY3J5cHRlZDMyW3dvcmRJeCArIDJdID0gdGhpcy5udG9oKGRlY3J5cHRlZDMyW3dvcmRJeCArIDJdIF4gaW5pdDIpO1xuICAgICAgZGVjcnlwdGVkMzJbd29yZEl4ICsgM10gPSB0aGlzLm50b2goZGVjcnlwdGVkMzJbd29yZEl4ICsgM10gXiBpbml0Myk7XG5cbiAgICAgIC8vIHNldHVwIHRoZSBJViBmb3IgdGhlIG5leHQgcm91bmRcbiAgICAgIGluaXQwID0gZW5jcnlwdGVkMDtcbiAgICAgIGluaXQxID0gZW5jcnlwdGVkMTtcbiAgICAgIGluaXQyID0gZW5jcnlwdGVkMjtcbiAgICAgIGluaXQzID0gZW5jcnlwdGVkMztcbiAgICB9XG5cbiAgICByZXR1cm4gZGVjcnlwdGVkO1xuICB9XG5cbiAgbG9jYWxEZWNyeXB0KGVuY3J5cHRlZCwga2V5LCBpbml0VmVjdG9yLCBkZWNyeXB0ZWQpIHtcbiAgICB2YXIgYnl0ZXMgPSB0aGlzLmRvRGVjcnlwdChlbmNyeXB0ZWQsXG4gICAgICAgIGtleSxcbiAgICAgICAgaW5pdFZlY3Rvcik7XG4gICAgZGVjcnlwdGVkLnNldChieXRlcywgZW5jcnlwdGVkLmJ5dGVPZmZzZXQpO1xuICB9XG5cbiAgZGVjcnlwdChlbmNyeXB0ZWQpIHtcbiAgICB2YXJcbiAgICAgIHN0ZXAgPSA0ICogODAwMCxcbiAgICAvL2VuY3J5cHRlZDMyID0gbmV3IEludDMyQXJyYXkoZW5jcnlwdGVkLmJ1ZmZlciksXG4gICAgZW5jcnlwdGVkMzIgPSBuZXcgSW50MzJBcnJheShlbmNyeXB0ZWQpLFxuICAgIGRlY3J5cHRlZCA9IG5ldyBVaW50OEFycmF5KGVuY3J5cHRlZC5ieXRlTGVuZ3RoKSxcbiAgICBpID0gMDtcblxuICAgIC8vIHNwbGl0IHVwIHRoZSBlbmNyeXB0aW9uIGpvYiBhbmQgZG8gdGhlIGluZGl2aWR1YWwgY2h1bmtzIGFzeW5jaHJvbm91c2x5XG4gICAgdmFyIGtleSA9IHRoaXMua2V5O1xuICAgIHZhciBpbml0VmVjdG9yID0gdGhpcy5pdjtcbiAgICB0aGlzLmxvY2FsRGVjcnlwdChlbmNyeXB0ZWQzMi5zdWJhcnJheShpLCBpICsgc3RlcCksIGtleSwgaW5pdFZlY3RvciwgZGVjcnlwdGVkKTtcblxuICAgIGZvciAoaSA9IHN0ZXA7IGkgPCBlbmNyeXB0ZWQzMi5sZW5ndGg7IGkgKz0gc3RlcCkge1xuICAgICAgaW5pdFZlY3RvciA9IG5ldyBVaW50MzJBcnJheShbXG4gICAgICAgICAgdGhpcy5udG9oKGVuY3J5cHRlZDMyW2kgLSA0XSksXG4gICAgICAgICAgdGhpcy5udG9oKGVuY3J5cHRlZDMyW2kgLSAzXSksXG4gICAgICAgICAgdGhpcy5udG9oKGVuY3J5cHRlZDMyW2kgLSAyXSksXG4gICAgICAgICAgdGhpcy5udG9oKGVuY3J5cHRlZDMyW2kgLSAxXSlcbiAgICAgIF0pO1xuICAgICAgdGhpcy5sb2NhbERlY3J5cHQoZW5jcnlwdGVkMzIuc3ViYXJyYXkoaSwgaSArIHN0ZXApLCBrZXksIGluaXRWZWN0b3IsIGRlY3J5cHRlZCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRlY3J5cHRlZDtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBBRVMxMjhEZWNyeXB0ZXI7XG4iLCIvKlxuICogQUVTMTI4IGRlY3J5cHRpb24uXG4gKi9cblxuaW1wb3J0IEFFUzEyOERlY3J5cHRlciBmcm9tICcuL2FlczEyOC1kZWNyeXB0ZXInO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuY2xhc3MgRGVjcnlwdGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMpIHtcbiAgICB0aGlzLmhscyA9IGhscztcbiAgICB0cnkge1xuICAgICAgY29uc3QgYnJvd3NlckNyeXB0byA9IHdpbmRvdyA/IHdpbmRvdy5jcnlwdG8gOiBjcnlwdG87XG4gICAgICB0aGlzLnN1YnRsZSA9IGJyb3dzZXJDcnlwdG8uc3VidGxlIHx8IGJyb3dzZXJDcnlwdG8ud2Via2l0U3VidGxlO1xuICAgICAgdGhpcy5kaXNhYmxlV2ViQ3J5cHRvID0gIXRoaXMuc3VidGxlO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHRoaXMuZGlzYWJsZVdlYkNyeXB0byA9IHRydWU7XG4gICAgfVxuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgfVxuXG4gIGRlY3J5cHQoZGF0YSwga2V5LCBpdiwgY2FsbGJhY2spIHtcbiAgICBpZiAodGhpcy5kaXNhYmxlV2ViQ3J5cHRvICYmIHRoaXMuaGxzLmNvbmZpZy5lbmFibGVTb2Z0d2FyZUFFUykge1xuICAgICAgdGhpcy5kZWNyeXB0QnlTb2Z0d2FyZShkYXRhLCBrZXksIGl2LCBjYWxsYmFjayk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZGVjcnlwdEJ5V2ViQ3J5cHRvKGRhdGEsIGtleSwgaXYsIGNhbGxiYWNrKTtcbiAgICB9XG4gIH1cblxuICBkZWNyeXB0QnlXZWJDcnlwdG8oZGF0YSwga2V5LCBpdiwgY2FsbGJhY2spIHtcbiAgICBsb2dnZXIubG9nKCdkZWNyeXB0aW5nIGJ5IFdlYkNyeXB0byBBUEknKTtcblxuICAgIHRoaXMuc3VidGxlLmltcG9ydEtleSgncmF3Jywga2V5LCB7IG5hbWUgOiAnQUVTLUNCQycsIGxlbmd0aCA6IDEyOCB9LCBmYWxzZSwgWydkZWNyeXB0J10pLlxuICAgICAgdGhlbigoaW1wb3J0ZWRLZXkpID0+IHtcbiAgICAgICAgdGhpcy5zdWJ0bGUuZGVjcnlwdCh7IG5hbWUgOiAnQUVTLUNCQycsIGl2IDogaXYuYnVmZmVyIH0sIGltcG9ydGVkS2V5LCBkYXRhKS5cbiAgICAgICAgICB0aGVuKGNhbGxiYWNrKS5cbiAgICAgICAgICBjYXRjaCAoKGVycikgPT4ge1xuICAgICAgICAgICAgdGhpcy5vbldlYkNyeXB0b0Vycm9yKGVyciwgZGF0YSwga2V5LCBpdiwgY2FsbGJhY2spO1xuICAgICAgICAgIH0pO1xuICAgICAgfSkuXG4gICAgY2F0Y2ggKChlcnIpID0+IHtcbiAgICAgIHRoaXMub25XZWJDcnlwdG9FcnJvcihlcnIsIGRhdGEsIGtleSwgaXYsIGNhbGxiYWNrKTtcbiAgICB9KTtcbiAgfVxuXG4gIGRlY3J5cHRCeVNvZnR3YXJlKGRhdGEsIGtleTgsIGl2OCwgY2FsbGJhY2spIHtcbiAgICBsb2dnZXIubG9nKCdkZWNyeXB0aW5nIGJ5IEphdmFTY3JpcHQgSW1wbGVtZW50YXRpb24nKTtcblxuICAgIHZhciB2aWV3ID0gbmV3IERhdGFWaWV3KGtleTguYnVmZmVyKTtcbiAgICB2YXIga2V5ID0gbmV3IFVpbnQzMkFycmF5KFtcbiAgICAgICAgdmlldy5nZXRVaW50MzIoMCksXG4gICAgICAgIHZpZXcuZ2V0VWludDMyKDQpLFxuICAgICAgICB2aWV3LmdldFVpbnQzMig4KSxcbiAgICAgICAgdmlldy5nZXRVaW50MzIoMTIpXG4gICAgXSk7XG5cbiAgICB2aWV3ID0gbmV3IERhdGFWaWV3KGl2OC5idWZmZXIpO1xuICAgIHZhciBpdiA9IG5ldyBVaW50MzJBcnJheShbXG4gICAgICAgIHZpZXcuZ2V0VWludDMyKDApLFxuICAgICAgICB2aWV3LmdldFVpbnQzMig0KSxcbiAgICAgICAgdmlldy5nZXRVaW50MzIoOCksXG4gICAgICAgIHZpZXcuZ2V0VWludDMyKDEyKVxuICAgIF0pO1xuXG4gICAgdmFyIGRlY3J5cHRlciA9IG5ldyBBRVMxMjhEZWNyeXB0ZXIoa2V5LCBpdik7XG4gICAgY2FsbGJhY2soZGVjcnlwdGVyLmRlY3J5cHQoZGF0YSkuYnVmZmVyKTtcbiAgfVxuXG4gIG9uV2ViQ3J5cHRvRXJyb3IoZXJyLCBkYXRhLCBrZXksIGl2LCBjYWxsYmFjaykge1xuICAgIGlmICh0aGlzLmhscy5jb25maWcuZW5hYmxlU29mdHdhcmVBRVMpIHtcbiAgICAgIGxvZ2dlci5sb2coJ2Rpc2FibGluZyB0byB1c2UgV2ViQ3J5cHRvIEFQSScpO1xuICAgICAgdGhpcy5kaXNhYmxlV2ViQ3J5cHRvID0gdHJ1ZTtcbiAgICAgIHRoaXMuZGVjcnlwdEJ5U29mdHdhcmUoZGF0YSwga2V5LCBpdiwgY2FsbGJhY2spO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGxvZ2dlci5lcnJvcihgZGVjcnlwdGluZyBlcnJvciA6ICR7ZXJyLm1lc3NhZ2V9YCk7XG4gICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZSA6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHMgOiBFcnJvckRldGFpbHMuRlJBR19ERUNSWVBUX0VSUk9SLCBmYXRhbCA6IHRydWUsIHJlYXNvbiA6IGVyci5tZXNzYWdlfSk7XG4gICAgfVxuICB9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgRGVjcnlwdGVyO1xuIiwiLyoqXG4gKiBBQUMgZGVtdXhlclxuICovXG5pbXBvcnQgQURUUyBmcm9tICcuL2FkdHMnO1xuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQgSUQzIGZyb20gJy4uL2RlbXV4L2lkMyc7XG5cbiBjbGFzcyBBQUNEZW11eGVyIHtcblxuICBjb25zdHJ1Y3RvcihvYnNlcnZlcixyZW11eGVyQ2xhc3MpIHtcbiAgICB0aGlzLm9ic2VydmVyID0gb2JzZXJ2ZXI7XG4gICAgdGhpcy5yZW11eGVyQ2xhc3MgPSByZW11eGVyQ2xhc3M7XG4gICAgdGhpcy5yZW11eGVyID0gbmV3IHRoaXMucmVtdXhlckNsYXNzKG9ic2VydmVyKTtcbiAgICB0aGlzLl9hYWNUcmFjayA9IHtjb250YWluZXIgOiAnYXVkaW8vYWR0cycsIHR5cGU6ICdhdWRpbycsIGlkIDotMSwgc2VxdWVuY2VOdW1iZXI6IDAsIHNhbXBsZXMgOiBbXSwgbGVuIDogMH07XG4gIH1cblxuICBzdGF0aWMgcHJvYmUoZGF0YSkge1xuICAgIC8vIGNoZWNrIGlmIGRhdGEgY29udGFpbnMgSUQzIHRpbWVzdGFtcCBhbmQgQURUUyBzeW5jIHdvcmNcbiAgICB2YXIgaWQzID0gbmV3IElEMyhkYXRhKSwgb2Zmc2V0LGxlbjtcbiAgICBpZihpZDMuaGFzVGltZVN0YW1wKSB7XG4gICAgICAvLyBsb29rIGZvciBBRFRTIGhlYWRlciAoMHhGRkZ4KVxuICAgICAgZm9yIChvZmZzZXQgPSBpZDMubGVuZ3RoLCBsZW4gPSBkYXRhLmxlbmd0aDsgb2Zmc2V0IDwgbGVuIC0gMTsgb2Zmc2V0KyspIHtcbiAgICAgICAgaWYgKChkYXRhW29mZnNldF0gPT09IDB4ZmYpICYmIChkYXRhW29mZnNldCsxXSAmIDB4ZjApID09PSAweGYwKSB7XG4gICAgICAgICAgLy9sb2dnZXIubG9nKCdBRFRTIHN5bmMgd29yZCBmb3VuZCAhJyk7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cblxuICAvLyBmZWVkIGluY29taW5nIGRhdGEgdG8gdGhlIGZyb250IG9mIHRoZSBwYXJzaW5nIHBpcGVsaW5lXG4gIHB1c2goZGF0YSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCwgY2MsIGxldmVsLCBzbiwgZHVyYXRpb24pIHtcbiAgICB2YXIgdHJhY2sgPSB0aGlzLl9hYWNUcmFjayxcbiAgICAgICAgaWQzID0gbmV3IElEMyhkYXRhKSxcbiAgICAgICAgcHRzID0gOTAqaWQzLnRpbWVTdGFtcCxcbiAgICAgICAgY29uZmlnLCBmcmFtZUxlbmd0aCwgZnJhbWVEdXJhdGlvbiwgZnJhbWVJbmRleCwgb2Zmc2V0LCBoZWFkZXJMZW5ndGgsIHN0YW1wLCBsZW4sIGFhY1NhbXBsZTtcbiAgICAvLyBsb29rIGZvciBBRFRTIGhlYWRlciAoMHhGRkZ4KVxuICAgIGZvciAob2Zmc2V0ID0gaWQzLmxlbmd0aCwgbGVuID0gZGF0YS5sZW5ndGg7IG9mZnNldCA8IGxlbiAtIDE7IG9mZnNldCsrKSB7XG4gICAgICBpZiAoKGRhdGFbb2Zmc2V0XSA9PT0gMHhmZikgJiYgKGRhdGFbb2Zmc2V0KzFdICYgMHhmMCkgPT09IDB4ZjApIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCF0cmFjay5hdWRpb3NhbXBsZXJhdGUpIHtcbiAgICAgIGNvbmZpZyA9IEFEVFMuZ2V0QXVkaW9Db25maWcodGhpcy5vYnNlcnZlcixkYXRhLCBvZmZzZXQsIGF1ZGlvQ29kZWMpO1xuICAgICAgdHJhY2suY29uZmlnID0gY29uZmlnLmNvbmZpZztcbiAgICAgIHRyYWNrLmF1ZGlvc2FtcGxlcmF0ZSA9IGNvbmZpZy5zYW1wbGVyYXRlO1xuICAgICAgdHJhY2suY2hhbm5lbENvdW50ID0gY29uZmlnLmNoYW5uZWxDb3VudDtcbiAgICAgIHRyYWNrLmNvZGVjID0gY29uZmlnLmNvZGVjO1xuICAgICAgdHJhY2suZHVyYXRpb24gPSBkdXJhdGlvbjtcbiAgICAgIGxvZ2dlci5sb2coYHBhcnNlZCBjb2RlYzoke3RyYWNrLmNvZGVjfSxyYXRlOiR7Y29uZmlnLnNhbXBsZXJhdGV9LG5iIGNoYW5uZWw6JHtjb25maWcuY2hhbm5lbENvdW50fWApO1xuICAgIH1cbiAgICBmcmFtZUluZGV4ID0gMDtcbiAgICBmcmFtZUR1cmF0aW9uID0gMTAyNCAqIDkwMDAwIC8gdHJhY2suYXVkaW9zYW1wbGVyYXRlO1xuICAgIHdoaWxlICgob2Zmc2V0ICsgNSkgPCBsZW4pIHtcbiAgICAgIC8vIFRoZSBwcm90ZWN0aW9uIHNraXAgYml0IHRlbGxzIHVzIGlmIHdlIGhhdmUgMiBieXRlcyBvZiBDUkMgZGF0YSBhdCB0aGUgZW5kIG9mIHRoZSBBRFRTIGhlYWRlclxuICAgICAgaGVhZGVyTGVuZ3RoID0gKCEhKGRhdGFbb2Zmc2V0ICsgMV0gJiAweDAxKSA/IDcgOiA5KTtcbiAgICAgIC8vIHJldHJpZXZlIGZyYW1lIHNpemVcbiAgICAgIGZyYW1lTGVuZ3RoID0gKChkYXRhW29mZnNldCArIDNdICYgMHgwMykgPDwgMTEpIHxcbiAgICAgICAgICAgICAgICAgICAgIChkYXRhW29mZnNldCArIDRdIDw8IDMpIHxcbiAgICAgICAgICAgICAgICAgICAgKChkYXRhW29mZnNldCArIDVdICYgMHhFMCkgPj4+IDUpO1xuICAgICAgZnJhbWVMZW5ndGggIC09IGhlYWRlckxlbmd0aDtcbiAgICAgIC8vc3RhbXAgPSBwZXMucHRzO1xuXG4gICAgICBpZiAoKGZyYW1lTGVuZ3RoID4gMCkgJiYgKChvZmZzZXQgKyBoZWFkZXJMZW5ndGggKyBmcmFtZUxlbmd0aCkgPD0gbGVuKSkge1xuICAgICAgICBzdGFtcCA9IHB0cyArIGZyYW1lSW5kZXggKiBmcmFtZUR1cmF0aW9uO1xuICAgICAgICAvL2xvZ2dlci5sb2coYEFBQyBmcmFtZSwgb2Zmc2V0L2xlbmd0aC90b3RhbC9wdHM6JHtvZmZzZXQraGVhZGVyTGVuZ3RofS8ke2ZyYW1lTGVuZ3RofS8ke2RhdGEuYnl0ZUxlbmd0aH0vJHsoc3RhbXAvOTApLnRvRml4ZWQoMCl9YCk7XG4gICAgICAgIGFhY1NhbXBsZSA9IHt1bml0OiBkYXRhLnN1YmFycmF5KG9mZnNldCArIGhlYWRlckxlbmd0aCwgb2Zmc2V0ICsgaGVhZGVyTGVuZ3RoICsgZnJhbWVMZW5ndGgpLCBwdHM6IHN0YW1wLCBkdHM6IHN0YW1wfTtcbiAgICAgICAgdHJhY2suc2FtcGxlcy5wdXNoKGFhY1NhbXBsZSk7XG4gICAgICAgIHRyYWNrLmxlbiArPSBmcmFtZUxlbmd0aDtcbiAgICAgICAgb2Zmc2V0ICs9IGZyYW1lTGVuZ3RoICsgaGVhZGVyTGVuZ3RoO1xuICAgICAgICBmcmFtZUluZGV4Kys7XG4gICAgICAgIC8vIGxvb2sgZm9yIEFEVFMgaGVhZGVyICgweEZGRngpXG4gICAgICAgIGZvciAoIDsgb2Zmc2V0IDwgKGxlbiAtIDEpOyBvZmZzZXQrKykge1xuICAgICAgICAgIGlmICgoZGF0YVtvZmZzZXRdID09PSAweGZmKSAmJiAoKGRhdGFbb2Zmc2V0ICsgMV0gJiAweGYwKSA9PT0gMHhmMCkpIHtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMucmVtdXhlci5yZW11eCh0aGlzLl9hYWNUcmFjayx7c2FtcGxlcyA6IFtdfSwge3NhbXBsZXMgOiBbIHsgcHRzOiBwdHMsIGR0cyA6IHB0cywgdW5pdCA6IGlkMy5wYXlsb2FkfSBdfSwgeyBzYW1wbGVzOiBbXSB9LCB0aW1lT2Zmc2V0KTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gIH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBBQUNEZW11eGVyO1xuIiwiLyoqXG4gKiAgQURUUyBwYXJzZXIgaGVscGVyXG4gKi9cbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5cbiBjbGFzcyBBRFRTIHtcblxuICBzdGF0aWMgZ2V0QXVkaW9Db25maWcob2JzZXJ2ZXIsIGRhdGEsIG9mZnNldCwgYXVkaW9Db2RlYykge1xuICAgIHZhciBhZHRzT2JqZWN0VHlwZSwgLy8gOmludFxuICAgICAgICBhZHRzU2FtcGxlaW5nSW5kZXgsIC8vIDppbnRcbiAgICAgICAgYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4LCAvLyA6aW50XG4gICAgICAgIGFkdHNDaGFuZWxDb25maWcsIC8vIDppbnRcbiAgICAgICAgY29uZmlnLFxuICAgICAgICB1c2VyQWdlbnQgPSBuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCksXG4gICAgICAgIGFkdHNTYW1wbGVpbmdSYXRlcyA9IFtcbiAgICAgICAgICAgIDk2MDAwLCA4ODIwMCxcbiAgICAgICAgICAgIDY0MDAwLCA0ODAwMCxcbiAgICAgICAgICAgIDQ0MTAwLCAzMjAwMCxcbiAgICAgICAgICAgIDI0MDAwLCAyMjA1MCxcbiAgICAgICAgICAgIDE2MDAwLCAxMjAwMCxcbiAgICAgICAgICAgIDExMDI1LCA4MDAwLFxuICAgICAgICAgICAgNzM1MF07XG4gICAgLy8gYnl0ZSAyXG4gICAgYWR0c09iamVjdFR5cGUgPSAoKGRhdGFbb2Zmc2V0ICsgMl0gJiAweEMwKSA+Pj4gNikgKyAxO1xuICAgIGFkdHNTYW1wbGVpbmdJbmRleCA9ICgoZGF0YVtvZmZzZXQgKyAyXSAmIDB4M0MpID4+PiAyKTtcbiAgICBpZihhZHRzU2FtcGxlaW5nSW5kZXggPiBhZHRzU2FtcGxlaW5nUmF0ZXMubGVuZ3RoLTEpIHtcbiAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuRlJBR19QQVJTSU5HX0VSUk9SLCBmYXRhbDogdHJ1ZSwgcmVhc29uOiBgaW52YWxpZCBBRFRTIHNhbXBsaW5nIGluZGV4OiR7YWR0c1NhbXBsZWluZ0luZGV4fWB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgYWR0c0NoYW5lbENvbmZpZyA9ICgoZGF0YVtvZmZzZXQgKyAyXSAmIDB4MDEpIDw8IDIpO1xuICAgIC8vIGJ5dGUgM1xuICAgIGFkdHNDaGFuZWxDb25maWcgfD0gKChkYXRhW29mZnNldCArIDNdICYgMHhDMCkgPj4+IDYpO1xuICAgIGxvZ2dlci5sb2coYG1hbmlmZXN0IGNvZGVjOiR7YXVkaW9Db2RlY30sQURUUyBkYXRhOnR5cGU6JHthZHRzT2JqZWN0VHlwZX0sc2FtcGxlaW5nSW5kZXg6JHthZHRzU2FtcGxlaW5nSW5kZXh9WyR7YWR0c1NhbXBsZWluZ1JhdGVzW2FkdHNTYW1wbGVpbmdJbmRleF19SHpdLGNoYW5uZWxDb25maWc6JHthZHRzQ2hhbmVsQ29uZmlnfWApO1xuICAgIC8vIGZpcmVmb3g6IGZyZXEgbGVzcyB0aGFuIDI0a0h6ID0gQUFDIFNCUiAoSEUtQUFDKVxuICAgIGlmICh1c2VyQWdlbnQuaW5kZXhPZignZmlyZWZveCcpICE9PSAtMSkge1xuICAgICAgaWYgKGFkdHNTYW1wbGVpbmdJbmRleCA+PSA2KSB7XG4gICAgICAgIGFkdHNPYmplY3RUeXBlID0gNTtcbiAgICAgICAgY29uZmlnID0gbmV3IEFycmF5KDQpO1xuICAgICAgICAvLyBIRS1BQUMgdXNlcyBTQlIgKFNwZWN0cmFsIEJhbmQgUmVwbGljYXRpb24pICwgaGlnaCBmcmVxdWVuY2llcyBhcmUgY29uc3RydWN0ZWQgZnJvbSBsb3cgZnJlcXVlbmNpZXNcbiAgICAgICAgLy8gdGhlcmUgaXMgYSBmYWN0b3IgMiBiZXR3ZWVuIGZyYW1lIHNhbXBsZSByYXRlIGFuZCBvdXRwdXQgc2FtcGxlIHJhdGVcbiAgICAgICAgLy8gbXVsdGlwbHkgZnJlcXVlbmN5IGJ5IDIgKHNlZSB0YWJsZSBiZWxvdywgZXF1aXZhbGVudCB0byBzdWJzdHJhY3QgMylcbiAgICAgICAgYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ID0gYWR0c1NhbXBsZWluZ0luZGV4IC0gMztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGFkdHNPYmplY3RUeXBlID0gMjtcbiAgICAgICAgY29uZmlnID0gbmV3IEFycmF5KDIpO1xuICAgICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggPSBhZHRzU2FtcGxlaW5nSW5kZXg7XG4gICAgICB9XG4gICAgICAvLyBBbmRyb2lkIDogYWx3YXlzIHVzZSBBQUNcbiAgICB9IGVsc2UgaWYgKHVzZXJBZ2VudC5pbmRleE9mKCdhbmRyb2lkJykgIT09IC0xKSB7XG4gICAgICBhZHRzT2JqZWN0VHlwZSA9IDI7XG4gICAgICBjb25maWcgPSBuZXcgQXJyYXkoMik7XG4gICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggPSBhZHRzU2FtcGxlaW5nSW5kZXg7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8qICBmb3Igb3RoZXIgYnJvd3NlcnMgKGNocm9tZSAuLi4pXG4gICAgICAgICAgYWx3YXlzIGZvcmNlIGF1ZGlvIHR5cGUgdG8gYmUgSEUtQUFDIFNCUiwgYXMgc29tZSBicm93c2VycyBkbyBub3Qgc3VwcG9ydCBhdWRpbyBjb2RlYyBzd2l0Y2ggcHJvcGVybHkgKGxpa2UgQ2hyb21lIC4uLilcbiAgICAgICovXG4gICAgICBhZHRzT2JqZWN0VHlwZSA9IDU7XG4gICAgICBjb25maWcgPSBuZXcgQXJyYXkoNCk7XG4gICAgICAvLyBpZiAobWFuaWZlc3QgY29kZWMgaXMgSEUtQUFDIG9yIEhFLUFBQ3YyKSBPUiAobWFuaWZlc3QgY29kZWMgbm90IHNwZWNpZmllZCBBTkQgZnJlcXVlbmN5IGxlc3MgdGhhbiAyNGtIeilcbiAgICAgIGlmICgoYXVkaW9Db2RlYyAmJiAoKGF1ZGlvQ29kZWMuaW5kZXhPZignbXA0YS40MC4yOScpICE9PSAtMSkgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgKGF1ZGlvQ29kZWMuaW5kZXhPZignbXA0YS40MC41JykgIT09IC0xKSkpIHx8XG4gICAgICAgICAgKCFhdWRpb0NvZGVjICYmIGFkdHNTYW1wbGVpbmdJbmRleCA+PSA2KSkge1xuICAgICAgICAvLyBIRS1BQUMgdXNlcyBTQlIgKFNwZWN0cmFsIEJhbmQgUmVwbGljYXRpb24pICwgaGlnaCBmcmVxdWVuY2llcyBhcmUgY29uc3RydWN0ZWQgZnJvbSBsb3cgZnJlcXVlbmNpZXNcbiAgICAgICAgLy8gdGhlcmUgaXMgYSBmYWN0b3IgMiBiZXR3ZWVuIGZyYW1lIHNhbXBsZSByYXRlIGFuZCBvdXRwdXQgc2FtcGxlIHJhdGVcbiAgICAgICAgLy8gbXVsdGlwbHkgZnJlcXVlbmN5IGJ5IDIgKHNlZSB0YWJsZSBiZWxvdywgZXF1aXZhbGVudCB0byBzdWJzdHJhY3QgMylcbiAgICAgICAgYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ID0gYWR0c1NhbXBsZWluZ0luZGV4IC0gMztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGlmIChtYW5pZmVzdCBjb2RlYyBpcyBBQUMpIEFORCAoZnJlcXVlbmN5IGxlc3MgdGhhbiAyNGtIeiBBTkQgbmIgY2hhbm5lbCBpcyAxKSBPUiAobWFuaWZlc3QgY29kZWMgbm90IHNwZWNpZmllZCBhbmQgbW9ubyBhdWRpbylcbiAgICAgICAgLy8gQ2hyb21lIGZhaWxzIHRvIHBsYXkgYmFjayB3aXRoIGxvdyBmcmVxdWVuY3kgQUFDIExDIG1vbm8gd2hlbiBpbml0aWFsaXplZCB3aXRoIEhFLUFBQy4gIFRoaXMgaXMgbm90IGEgcHJvYmxlbSB3aXRoIHN0ZXJlby5cbiAgICAgICAgaWYgKGF1ZGlvQ29kZWMgJiYgYXVkaW9Db2RlYy5pbmRleE9mKCdtcDRhLjQwLjInKSAhPT0gLTEgJiYgKGFkdHNTYW1wbGVpbmdJbmRleCA+PSA2ICYmIGFkdHNDaGFuZWxDb25maWcgPT09IDEpIHx8XG4gICAgICAgICAgICAoIWF1ZGlvQ29kZWMgJiYgYWR0c0NoYW5lbENvbmZpZyA9PT0gMSkpIHtcbiAgICAgICAgICBhZHRzT2JqZWN0VHlwZSA9IDI7XG4gICAgICAgICAgY29uZmlnID0gbmV3IEFycmF5KDIpO1xuICAgICAgICB9XG4gICAgICAgIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCA9IGFkdHNTYW1wbGVpbmdJbmRleDtcbiAgICAgIH1cbiAgICB9XG4gICAgLyogcmVmZXIgdG8gaHR0cDovL3dpa2kubXVsdGltZWRpYS5jeC9pbmRleC5waHA/dGl0bGU9TVBFRy00X0F1ZGlvI0F1ZGlvX1NwZWNpZmljX0NvbmZpZ1xuICAgICAgICBJU08gMTQ0OTYtMyAoQUFDKS5wZGYgLSBUYWJsZSAxLjEzIOKAlCBTeW50YXggb2YgQXVkaW9TcGVjaWZpY0NvbmZpZygpXG4gICAgICBBdWRpbyBQcm9maWxlIC8gQXVkaW8gT2JqZWN0IFR5cGVcbiAgICAgIDA6IE51bGxcbiAgICAgIDE6IEFBQyBNYWluXG4gICAgICAyOiBBQUMgTEMgKExvdyBDb21wbGV4aXR5KVxuICAgICAgMzogQUFDIFNTUiAoU2NhbGFibGUgU2FtcGxlIFJhdGUpXG4gICAgICA0OiBBQUMgTFRQIChMb25nIFRlcm0gUHJlZGljdGlvbilcbiAgICAgIDU6IFNCUiAoU3BlY3RyYWwgQmFuZCBSZXBsaWNhdGlvbilcbiAgICAgIDY6IEFBQyBTY2FsYWJsZVxuICAgICBzYW1wbGluZyBmcmVxXG4gICAgICAwOiA5NjAwMCBIelxuICAgICAgMTogODgyMDAgSHpcbiAgICAgIDI6IDY0MDAwIEh6XG4gICAgICAzOiA0ODAwMCBIelxuICAgICAgNDogNDQxMDAgSHpcbiAgICAgIDU6IDMyMDAwIEh6XG4gICAgICA2OiAyNDAwMCBIelxuICAgICAgNzogMjIwNTAgSHpcbiAgICAgIDg6IDE2MDAwIEh6XG4gICAgICA5OiAxMjAwMCBIelxuICAgICAgMTA6IDExMDI1IEh6XG4gICAgICAxMTogODAwMCBIelxuICAgICAgMTI6IDczNTAgSHpcbiAgICAgIDEzOiBSZXNlcnZlZFxuICAgICAgMTQ6IFJlc2VydmVkXG4gICAgICAxNTogZnJlcXVlbmN5IGlzIHdyaXR0ZW4gZXhwbGljdGx5XG4gICAgICBDaGFubmVsIENvbmZpZ3VyYXRpb25zXG4gICAgICBUaGVzZSBhcmUgdGhlIGNoYW5uZWwgY29uZmlndXJhdGlvbnM6XG4gICAgICAwOiBEZWZpbmVkIGluIEFPVCBTcGVjaWZjIENvbmZpZ1xuICAgICAgMTogMSBjaGFubmVsOiBmcm9udC1jZW50ZXJcbiAgICAgIDI6IDIgY2hhbm5lbHM6IGZyb250LWxlZnQsIGZyb250LXJpZ2h0XG4gICAgKi9cbiAgICAvLyBhdWRpb09iamVjdFR5cGUgPSBwcm9maWxlID0+IHByb2ZpbGUsIHRoZSBNUEVHLTQgQXVkaW8gT2JqZWN0IFR5cGUgbWludXMgMVxuICAgIGNvbmZpZ1swXSA9IGFkdHNPYmplY3RUeXBlIDw8IDM7XG4gICAgLy8gc2FtcGxpbmdGcmVxdWVuY3lJbmRleFxuICAgIGNvbmZpZ1swXSB8PSAoYWR0c1NhbXBsZWluZ0luZGV4ICYgMHgwRSkgPj4gMTtcbiAgICBjb25maWdbMV0gfD0gKGFkdHNTYW1wbGVpbmdJbmRleCAmIDB4MDEpIDw8IDc7XG4gICAgLy8gY2hhbm5lbENvbmZpZ3VyYXRpb25cbiAgICBjb25maWdbMV0gfD0gYWR0c0NoYW5lbENvbmZpZyA8PCAzO1xuICAgIGlmIChhZHRzT2JqZWN0VHlwZSA9PT0gNSkge1xuICAgICAgLy8gYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4XG4gICAgICBjb25maWdbMV0gfD0gKGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCAmIDB4MEUpID4+IDE7XG4gICAgICBjb25maWdbMl0gPSAoYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ICYgMHgwMSkgPDwgNztcbiAgICAgIC8vIGFkdHNPYmplY3RUeXBlIChmb3JjZSB0byAyLCBjaHJvbWUgaXMgY2hlY2tpbmcgdGhhdCBvYmplY3QgdHlwZSBpcyBsZXNzIHRoYW4gNSA/Pz9cbiAgICAgIC8vICAgIGh0dHBzOi8vY2hyb21pdW0uZ29vZ2xlc291cmNlLmNvbS9jaHJvbWl1bS9zcmMuZ2l0LysvbWFzdGVyL21lZGlhL2Zvcm1hdHMvbXA0L2FhYy5jY1xuICAgICAgY29uZmlnWzJdIHw9IDIgPDwgMjtcbiAgICAgIGNvbmZpZ1szXSA9IDA7XG4gICAgfVxuICAgIHJldHVybiB7Y29uZmlnOiBjb25maWcsIHNhbXBsZXJhdGU6IGFkdHNTYW1wbGVpbmdSYXRlc1thZHRzU2FtcGxlaW5nSW5kZXhdLCBjaGFubmVsQ291bnQ6IGFkdHNDaGFuZWxDb25maWcsIGNvZGVjOiAoJ21wNGEuNDAuJyArIGFkdHNPYmplY3RUeXBlKX07XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQURUUztcbiIsIi8qICBpbmxpbmUgZGVtdXhlci5cbiAqICAgcHJvYmUgZnJhZ21lbnRzIGFuZCBpbnN0YW50aWF0ZSBhcHByb3ByaWF0ZSBkZW11eGVyIGRlcGVuZGluZyBvbiBjb250ZW50IHR5cGUgKFRTRGVtdXhlciwgQUFDRGVtdXhlciwgLi4uKVxuICovXG5cbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5pbXBvcnQgQUFDRGVtdXhlciBmcm9tICcuLi9kZW11eC9hYWNkZW11eGVyJztcbmltcG9ydCBUU0RlbXV4ZXIgZnJvbSAnLi4vZGVtdXgvdHNkZW11eGVyJztcbmltcG9ydCBNUDRSZW11eGVyIGZyb20gJy4uL3JlbXV4L21wNC1yZW11eGVyJztcbmltcG9ydCBQYXNzVGhyb3VnaFJlbXV4ZXIgZnJvbSAnLi4vcmVtdXgvcGFzc3Rocm91Z2gtcmVtdXhlcic7XG5cbmNsYXNzIERlbXV4ZXJJbmxpbmUge1xuXG4gIGNvbnN0cnVjdG9yKGhscyx0eXBlU3VwcG9ydGVkKSB7XG4gICAgdGhpcy5obHMgPSBobHM7XG4gICAgdGhpcy50eXBlU3VwcG9ydGVkID0gdHlwZVN1cHBvcnRlZDtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdmFyIGRlbXV4ZXIgPSB0aGlzLmRlbXV4ZXI7XG4gICAgaWYgKGRlbXV4ZXIpIHtcbiAgICAgIGRlbXV4ZXIuZGVzdHJveSgpO1xuICAgIH1cbiAgfVxuXG4gIHB1c2goZGF0YSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCwgY2MsIGxldmVsLCBzbiwgZHVyYXRpb24sIHQwKSB7XG4gICAgdmFyIGRlbXV4ZXIgPSB0aGlzLmRlbXV4ZXI7XG4gICAgaWYgKCFkZW11eGVyKSB7XG4gICAgICB2YXIgaGxzID0gdGhpcy5obHM7XG4gICAgICAvLyBwcm9iZSBmb3IgY29udGVudCB0eXBlXG4gICAgICBpZiAoVFNEZW11eGVyLnByb2JlKGRhdGEpKSB7XG4gICAgICAgIGlmICh0aGlzLnR5cGVTdXBwb3J0ZWQubXAydCA9PT0gdHJ1ZSkge1xuICAgICAgICAgIGRlbXV4ZXIgPSBuZXcgVFNEZW11eGVyKGhscyxQYXNzVGhyb3VnaFJlbXV4ZXIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGRlbXV4ZXIgPSBuZXcgVFNEZW11eGVyKGhscyxNUDRSZW11eGVyKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmKEFBQ0RlbXV4ZXIucHJvYmUoZGF0YSkpIHtcbiAgICAgICAgZGVtdXhlciA9IG5ldyBBQUNEZW11eGVyKGhscyxNUDRSZW11eGVyKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZSA6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5GUkFHX1BBUlNJTkdfRVJST1IsIGZhdGFsOiB0cnVlLCByZWFzb246ICdubyBkZW11eCBtYXRjaGluZyB3aXRoIGNvbnRlbnQgZm91bmQnfSk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHRoaXMuZGVtdXhlciA9IGRlbXV4ZXI7XG4gICAgfVxuICAgIGRlbXV4ZXIucHVzaChkYXRhLGF1ZGlvQ29kZWMsdmlkZW9Db2RlYyx0aW1lT2Zmc2V0LGNjLGxldmVsLHNuLGR1cmF0aW9uLCB0MCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRGVtdXhlcklubGluZTtcbiIsIi8qIGRlbXV4ZXIgd2ViIHdvcmtlci5cbiAqICAtIGxpc3RlbiB0byB3b3JrZXIgbWVzc2FnZSwgYW5kIHRyaWdnZXIgRGVtdXhlcklubGluZSB1cG9uIHJlY2VwdGlvbiBvZiBGcmFnbWVudHMuXG4gKiAgLSBwcm92aWRlcyBNUDQgQm94ZXMgYmFjayB0byBtYWluIHRocmVhZCB1c2luZyBbdHJhbnNmZXJhYmxlIG9iamVjdHNdKGh0dHBzOi8vZGV2ZWxvcGVycy5nb29nbGUuY29tL3dlYi91cGRhdGVzLzIwMTEvMTIvVHJhbnNmZXJhYmxlLU9iamVjdHMtTGlnaHRuaW5nLUZhc3QpIGluIG9yZGVyIHRvIG1pbmltaXplIG1lc3NhZ2UgcGFzc2luZyBvdmVyaGVhZC5cbiAqL1xuXG4gaW1wb3J0IERlbXV4ZXJJbmxpbmUgZnJvbSAnLi4vZGVtdXgvZGVtdXhlci1pbmxpbmUnO1xuIGltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuIGltcG9ydCBFdmVudEVtaXR0ZXIgZnJvbSAnZXZlbnRzJztcblxudmFyIERlbXV4ZXJXb3JrZXIgPSBmdW5jdGlvbiAoc2VsZikge1xuICAvLyBvYnNlcnZlciBzZXR1cFxuICB2YXIgb2JzZXJ2ZXIgPSBuZXcgRXZlbnRFbWl0dGVyKCk7XG4gIG9ic2VydmVyLnRyaWdnZXIgPSBmdW5jdGlvbiB0cmlnZ2VyIChldmVudCwgLi4uZGF0YSkge1xuICAgIG9ic2VydmVyLmVtaXQoZXZlbnQsIGV2ZW50LCAuLi5kYXRhKTtcbiAgfTtcblxuICBvYnNlcnZlci5vZmYgPSBmdW5jdGlvbiBvZmYgKGV2ZW50LCAuLi5kYXRhKSB7XG4gICAgb2JzZXJ2ZXIucmVtb3ZlTGlzdGVuZXIoZXZlbnQsIC4uLmRhdGEpO1xuICB9O1xuICBzZWxmLmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBmdW5jdGlvbiAoZXYpIHtcbiAgICB2YXIgZGF0YSA9IGV2LmRhdGE7XG4gICAgLy9jb25zb2xlLmxvZygnZGVtdXhlciBjbWQ6JyArIGRhdGEuY21kKTtcbiAgICBzd2l0Y2ggKGRhdGEuY21kKSB7XG4gICAgICBjYXNlICdpbml0JzpcbiAgICAgICAgc2VsZi5kZW11eGVyID0gbmV3IERlbXV4ZXJJbmxpbmUob2JzZXJ2ZXIsIGRhdGEudHlwZVN1cHBvcnRlZCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnZGVtdXgnOlxuICAgICAgICBzZWxmLmRlbXV4ZXIucHVzaChuZXcgVWludDhBcnJheShkYXRhLmRhdGEpLCBkYXRhLmF1ZGlvQ29kZWMsIGRhdGEudmlkZW9Db2RlYywgZGF0YS50aW1lT2Zmc2V0LCBkYXRhLmNjLCBkYXRhLmxldmVsLCBkYXRhLnNuLCBkYXRhLmR1cmF0aW9uKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBicmVhaztcbiAgICB9XG4gIH0pO1xuXG4gIC8vIGxpc3RlbiB0byBldmVudHMgdHJpZ2dlcmVkIGJ5IERlbXV4ZXJcbiAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCwgZnVuY3Rpb24oZXYsIGRhdGEpIHtcbiAgICBzZWxmLnBvc3RNZXNzYWdlKHtldmVudDogZXYsIHRyYWNrcyA6IGRhdGEudHJhY2tzLCB1bmlxdWUgOiBkYXRhLnVuaXF1ZSB9KTtcbiAgfSk7XG5cbiAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19QQVJTSU5HX0RBVEEsIGZ1bmN0aW9uKGV2LCBkYXRhKSB7XG4gICAgdmFyIG9iakRhdGEgPSB7ZXZlbnQ6IGV2LCB0eXBlOiBkYXRhLnR5cGUsIHN0YXJ0UFRTOiBkYXRhLnN0YXJ0UFRTLCBlbmRQVFM6IGRhdGEuZW5kUFRTLCBzdGFydERUUzogZGF0YS5zdGFydERUUywgZW5kRFRTOiBkYXRhLmVuZERUUywgZGF0YTE6IGRhdGEuZGF0YTEuYnVmZmVyLCBkYXRhMjogZGF0YS5kYXRhMi5idWZmZXIsIG5iOiBkYXRhLm5ifTtcbiAgICAvLyBwYXNzIGRhdGExL2RhdGEyIGFzIHRyYW5zZmVyYWJsZSBvYmplY3QgKG5vIGNvcHkpXG4gICAgc2VsZi5wb3N0TWVzc2FnZShvYmpEYXRhLCBbb2JqRGF0YS5kYXRhMSwgb2JqRGF0YS5kYXRhMl0pO1xuICB9KTtcblxuICBvYnNlcnZlci5vbihFdmVudC5GUkFHX1BBUlNFRCwgZnVuY3Rpb24oZXZlbnQpIHtcbiAgICBzZWxmLnBvc3RNZXNzYWdlKHtldmVudDogZXZlbnR9KTtcbiAgfSk7XG5cbiAgb2JzZXJ2ZXIub24oRXZlbnQuRVJST1IsIGZ1bmN0aW9uKGV2ZW50LCBkYXRhKSB7XG4gICAgc2VsZi5wb3N0TWVzc2FnZSh7ZXZlbnQ6IGV2ZW50LCBkYXRhOiBkYXRhfSk7XG4gIH0pO1xuXG4gIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0lOR19NRVRBREFUQSwgZnVuY3Rpb24oZXZlbnQsIGRhdGEpIHtcbiAgICB2YXIgb2JqRGF0YSA9IHtldmVudDogZXZlbnQsIHNhbXBsZXM6IGRhdGEuc2FtcGxlc307XG4gICAgc2VsZi5wb3N0TWVzc2FnZShvYmpEYXRhKTtcbiAgfSk7XG5cbiAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19QQVJTSU5HX1VTRVJEQVRBLCBmdW5jdGlvbihldmVudCwgZGF0YSkge1xuICAgIHZhciBvYmpEYXRhID0ge2V2ZW50OiBldmVudCwgc2FtcGxlczogZGF0YS5zYW1wbGVzfTtcbiAgICBzZWxmLnBvc3RNZXNzYWdlKG9iakRhdGEpO1xuICB9KTtcblxufTtcblxuZXhwb3J0IGRlZmF1bHQgRGVtdXhlcldvcmtlcjtcblxuIiwiaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgRGVtdXhlcklubGluZSBmcm9tICcuLi9kZW11eC9kZW11eGVyLWlubGluZSc7XG5pbXBvcnQgRGVtdXhlcldvcmtlciBmcm9tICcuLi9kZW11eC9kZW11eGVyLXdvcmtlcic7XG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCBEZWNyeXB0ZXIgZnJvbSAnLi4vY3J5cHQvZGVjcnlwdGVyJztcblxuY2xhc3MgRGVtdXhlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgdGhpcy5obHMgPSBobHM7XG4gICAgdmFyIHR5cGVTdXBwb3J0ZWQgPSB7XG4gICAgICBtcDQgOiBNZWRpYVNvdXJjZS5pc1R5cGVTdXBwb3J0ZWQoJ3ZpZGVvL21wNCcpLFxuICAgICAgbXAydCA6IGhscy5jb25maWcuZW5hYmxlTVAyVFBhc3NUaHJvdWdoICYmIE1lZGlhU291cmNlLmlzVHlwZVN1cHBvcnRlZCgndmlkZW8vbXAydCcpXG4gICAgfTtcbiAgICBpZiAoaGxzLmNvbmZpZy5lbmFibGVXb3JrZXIgJiYgKHR5cGVvZihXb3JrZXIpICE9PSAndW5kZWZpbmVkJykpIHtcbiAgICAgICAgbG9nZ2VyLmxvZygnZGVtdXhpbmcgaW4gd2Vid29ya2VyJyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdmFyIHdvcmsgPSByZXF1aXJlKCd3ZWJ3b3JraWZ5Jyk7XG4gICAgICAgICAgdGhpcy53ID0gd29yayhEZW11eGVyV29ya2VyKTtcbiAgICAgICAgICB0aGlzLm9ud21zZyA9IHRoaXMub25Xb3JrZXJNZXNzYWdlLmJpbmQodGhpcyk7XG4gICAgICAgICAgdGhpcy53LmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCB0aGlzLm9ud21zZyk7XG4gICAgICAgICAgdGhpcy53LnBvc3RNZXNzYWdlKHtjbWQ6ICdpbml0JywgdHlwZVN1cHBvcnRlZCA6IHR5cGVTdXBwb3J0ZWR9KTtcbiAgICAgICAgfSBjYXRjaChlcnIpIHtcbiAgICAgICAgICBsb2dnZXIuZXJyb3IoJ2Vycm9yIHdoaWxlIGluaXRpYWxpemluZyBEZW11eGVyV29ya2VyLCBmYWxsYmFjayBvbiBEZW11eGVySW5saW5lJyk7XG4gICAgICAgICAgdGhpcy5kZW11eGVyID0gbmV3IERlbXV4ZXJJbmxpbmUoaGxzLHR5cGVTdXBwb3J0ZWQpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmRlbXV4ZXIgPSBuZXcgRGVtdXhlcklubGluZShobHMsdHlwZVN1cHBvcnRlZCk7XG4gICAgICB9XG4gICAgICB0aGlzLmRlbXV4SW5pdGlhbGl6ZWQgPSB0cnVlO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBpZiAodGhpcy53KSB7XG4gICAgICB0aGlzLncucmVtb3ZlRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIHRoaXMub253bXNnKTtcbiAgICAgIHRoaXMudy50ZXJtaW5hdGUoKTtcbiAgICAgIHRoaXMudyA9IG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZGVtdXhlci5kZXN0cm95KCk7XG4gICAgICB0aGlzLmRlbXV4ZXIgPSBudWxsO1xuICAgIH1cbiAgICBpZiAodGhpcy5kZWNyeXB0ZXIpIHtcbiAgICAgIHRoaXMuZGVjcnlwdGVyLmRlc3Ryb3koKTtcbiAgICAgIHRoaXMuZGVjcnlwdGVyID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICBwdXNoRGVjcnlwdGVkKGRhdGEsIGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQsIGNjLCBsZXZlbCwgc24sIGR1cmF0aW9uLCB0MCkge1xuXHQgIGNvbnNvbGUubG9nKCdwdXNoRGVjcnlwdGVkIHQwOiAnICsgdDApO1xuICAgIGlmICh0aGlzLncpIHtcbiAgICAgIC8vIHBvc3QgZnJhZ21lbnQgcGF5bG9hZCBhcyB0cmFuc2ZlcmFibGUgb2JqZWN0cyAobm8gY29weSlcbiAgICAgIHRoaXMudy5wb3N0TWVzc2FnZSh7Y21kOiAnZGVtdXgnLCBkYXRhOiBkYXRhLCBhdWRpb0NvZGVjOiBhdWRpb0NvZGVjLCB2aWRlb0NvZGVjOiB2aWRlb0NvZGVjLCB0aW1lT2Zmc2V0OiB0aW1lT2Zmc2V0LCBjYzogY2MsIGxldmVsOiBsZXZlbCwgc24gOiBzbiwgZHVyYXRpb246IGR1cmF0aW9ufSwgW2RhdGFdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5kZW11eGVyLnB1c2gobmV3IFVpbnQ4QXJyYXkoZGF0YSksIGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQsIGNjLCBsZXZlbCwgc24sIGR1cmF0aW9uLCB0MCk7XG4gICAgfVxuICB9XG5cbiAgcHVzaChkYXRhLCBhdWRpb0NvZGVjLCB2aWRlb0NvZGVjLCB0aW1lT2Zmc2V0LCBjYywgbGV2ZWwsIHNuLCBkdXJhdGlvbiwgZGVjcnlwdGRhdGEsIHQwKSB7XG4gICAgaWYgKChkYXRhLmJ5dGVMZW5ndGggPiAwKSAmJiAoZGVjcnlwdGRhdGEgIT0gbnVsbCkgJiYgKGRlY3J5cHRkYXRhLmtleSAhPSBudWxsKSAmJiAoZGVjcnlwdGRhdGEubWV0aG9kID09PSAnQUVTLTEyOCcpKSB7XG4gICAgICBpZiAodGhpcy5kZWNyeXB0ZXIgPT0gbnVsbCkge1xuICAgICAgICB0aGlzLmRlY3J5cHRlciA9IG5ldyBEZWNyeXB0ZXIodGhpcy5obHMpO1xuICAgICAgfVxuXG4gICAgICB2YXIgbG9jYWx0aGlzID0gdGhpcztcbiAgICAgIHRoaXMuZGVjcnlwdGVyLmRlY3J5cHQoZGF0YSwgZGVjcnlwdGRhdGEua2V5LCBkZWNyeXB0ZGF0YS5pdiwgZnVuY3Rpb24oZGVjcnlwdGVkRGF0YSl7XG4gICAgICAgIGxvY2FsdGhpcy5wdXNoRGVjcnlwdGVkKGRlY3J5cHRlZERhdGEsIGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQsIGNjLCBsZXZlbCwgc24sIGR1cmF0aW9uLCB0MCk7XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5wdXNoRGVjcnlwdGVkKGRhdGEsIGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQsIGNjLCBsZXZlbCwgc24sIGR1cmF0aW9uLCB0MCk7XG4gICAgfVxuICB9XG5cbiAgb25Xb3JrZXJNZXNzYWdlKGV2KSB7XG4gICAgdmFyIGRhdGEgPSBldi5kYXRhO1xuICAgIC8vY29uc29sZS5sb2coJ29uV29ya2VyTWVzc2FnZTonICsgZGF0YS5ldmVudCk7XG4gICAgc3dpdGNoKGRhdGEuZXZlbnQpIHtcbiAgICAgIGNhc2UgRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVDpcbiAgICAgICAgdmFyIG9iaiA9IHt9O1xuICAgICAgICBvYmoudHJhY2tzID0gZGF0YS50cmFja3M7XG4gICAgICAgIG9iai51bmlxdWUgPSBkYXRhLnVuaXF1ZTtcbiAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULCBvYmopO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgRXZlbnQuRlJBR19QQVJTSU5HX0RBVEE6XG4gICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0RBVEEse1xuICAgICAgICAgIGRhdGExOiBuZXcgVWludDhBcnJheShkYXRhLmRhdGExKSxcbiAgICAgICAgICBkYXRhMjogbmV3IFVpbnQ4QXJyYXkoZGF0YS5kYXRhMiksXG4gICAgICAgICAgc3RhcnRQVFM6IGRhdGEuc3RhcnRQVFMsXG4gICAgICAgICAgZW5kUFRTOiBkYXRhLmVuZFBUUyxcbiAgICAgICAgICBzdGFydERUUzogZGF0YS5zdGFydERUUyxcbiAgICAgICAgICBlbmREVFM6IGRhdGEuZW5kRFRTLFxuICAgICAgICAgIHR5cGU6IGRhdGEudHlwZSxcbiAgICAgICAgICBuYjogZGF0YS5uYlxuICAgICAgICB9KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgRXZlbnQuRlJBR19QQVJTSU5HX01FVEFEQVRBOlxuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19NRVRBREFUQSwge1xuICAgICAgICAgIHNhbXBsZXM6IGRhdGEuc2FtcGxlc1xuICAgICAgICB9KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgRXZlbnQuRlJBR19QQVJTSU5HX1VTRVJEQVRBOlxuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19VU0VSREFUQSwge1xuICAgICAgICAgIHNhbXBsZXM6IGRhdGEuc2FtcGxlc1xuICAgICAgICB9KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKGRhdGEuZXZlbnQsIGRhdGEuZGF0YSk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBEZW11eGVyO1xuXG4iLCIvKipcbiAqIFBhcnNlciBmb3IgZXhwb25lbnRpYWwgR29sb21iIGNvZGVzLCBhIHZhcmlhYmxlLWJpdHdpZHRoIG51bWJlciBlbmNvZGluZyBzY2hlbWUgdXNlZCBieSBoMjY0LlxuKi9cblxuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5cbmNsYXNzIEV4cEdvbG9tYiB7XG5cbiAgY29uc3RydWN0b3IoZGF0YSkge1xuICAgIHRoaXMuZGF0YSA9IGRhdGE7XG4gICAgLy8gdGhlIG51bWJlciBvZiBieXRlcyBsZWZ0IHRvIGV4YW1pbmUgaW4gdGhpcy5kYXRhXG4gICAgdGhpcy5ieXRlc0F2YWlsYWJsZSA9IHRoaXMuZGF0YS5ieXRlTGVuZ3RoO1xuICAgIC8vIHRoZSBjdXJyZW50IHdvcmQgYmVpbmcgZXhhbWluZWRcbiAgICB0aGlzLndvcmQgPSAwOyAvLyA6dWludFxuICAgIC8vIHRoZSBudW1iZXIgb2YgYml0cyBsZWZ0IHRvIGV4YW1pbmUgaW4gdGhlIGN1cnJlbnQgd29yZFxuICAgIHRoaXMuYml0c0F2YWlsYWJsZSA9IDA7IC8vIDp1aW50XG4gIH1cblxuICAvLyAoKTp2b2lkXG4gIGxvYWRXb3JkKCkge1xuICAgIHZhclxuICAgICAgcG9zaXRpb24gPSB0aGlzLmRhdGEuYnl0ZUxlbmd0aCAtIHRoaXMuYnl0ZXNBdmFpbGFibGUsXG4gICAgICB3b3JraW5nQnl0ZXMgPSBuZXcgVWludDhBcnJheSg0KSxcbiAgICAgIGF2YWlsYWJsZUJ5dGVzID0gTWF0aC5taW4oNCwgdGhpcy5ieXRlc0F2YWlsYWJsZSk7XG4gICAgaWYgKGF2YWlsYWJsZUJ5dGVzID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ25vIGJ5dGVzIGF2YWlsYWJsZScpO1xuICAgIH1cbiAgICB3b3JraW5nQnl0ZXMuc2V0KHRoaXMuZGF0YS5zdWJhcnJheShwb3NpdGlvbiwgcG9zaXRpb24gKyBhdmFpbGFibGVCeXRlcykpO1xuICAgIHRoaXMud29yZCA9IG5ldyBEYXRhVmlldyh3b3JraW5nQnl0ZXMuYnVmZmVyKS5nZXRVaW50MzIoMCk7XG4gICAgLy8gdHJhY2sgdGhlIGFtb3VudCBvZiB0aGlzLmRhdGEgdGhhdCBoYXMgYmVlbiBwcm9jZXNzZWRcbiAgICB0aGlzLmJpdHNBdmFpbGFibGUgPSBhdmFpbGFibGVCeXRlcyAqIDg7XG4gICAgdGhpcy5ieXRlc0F2YWlsYWJsZSAtPSBhdmFpbGFibGVCeXRlcztcbiAgfVxuXG4gIC8vIChjb3VudDppbnQpOnZvaWRcbiAgc2tpcEJpdHMoY291bnQpIHtcbiAgICB2YXIgc2tpcEJ5dGVzOyAvLyA6aW50XG4gICAgaWYgKHRoaXMuYml0c0F2YWlsYWJsZSA+IGNvdW50KSB7XG4gICAgICB0aGlzLndvcmQgPDw9IGNvdW50O1xuICAgICAgdGhpcy5iaXRzQXZhaWxhYmxlIC09IGNvdW50O1xuICAgIH0gZWxzZSB7XG4gICAgICBjb3VudCAtPSB0aGlzLmJpdHNBdmFpbGFibGU7XG4gICAgICBza2lwQnl0ZXMgPSBjb3VudCA+PiAzO1xuICAgICAgY291bnQgLT0gKHNraXBCeXRlcyA+PiAzKTtcbiAgICAgIHRoaXMuYnl0ZXNBdmFpbGFibGUgLT0gc2tpcEJ5dGVzO1xuICAgICAgdGhpcy5sb2FkV29yZCgpO1xuICAgICAgdGhpcy53b3JkIDw8PSBjb3VudDtcbiAgICAgIHRoaXMuYml0c0F2YWlsYWJsZSAtPSBjb3VudDtcbiAgICB9XG4gIH1cblxuICAvLyAoc2l6ZTppbnQpOnVpbnRcbiAgcmVhZEJpdHMoc2l6ZSkge1xuICAgIHZhclxuICAgICAgYml0cyA9IE1hdGgubWluKHRoaXMuYml0c0F2YWlsYWJsZSwgc2l6ZSksIC8vIDp1aW50XG4gICAgICB2YWx1ID0gdGhpcy53b3JkID4+PiAoMzIgLSBiaXRzKTsgLy8gOnVpbnRcbiAgICBpZiAoc2l6ZSA+IDMyKSB7XG4gICAgICBsb2dnZXIuZXJyb3IoJ0Nhbm5vdCByZWFkIG1vcmUgdGhhbiAzMiBiaXRzIGF0IGEgdGltZScpO1xuICAgIH1cbiAgICB0aGlzLmJpdHNBdmFpbGFibGUgLT0gYml0cztcbiAgICBpZiAodGhpcy5iaXRzQXZhaWxhYmxlID4gMCkge1xuICAgICAgdGhpcy53b3JkIDw8PSBiaXRzO1xuICAgIH0gZWxzZSBpZiAodGhpcy5ieXRlc0F2YWlsYWJsZSA+IDApIHtcbiAgICAgIHRoaXMubG9hZFdvcmQoKTtcbiAgICB9XG4gICAgYml0cyA9IHNpemUgLSBiaXRzO1xuICAgIGlmIChiaXRzID4gMCkge1xuICAgICAgcmV0dXJuIHZhbHUgPDwgYml0cyB8IHRoaXMucmVhZEJpdHMoYml0cyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB2YWx1O1xuICAgIH1cbiAgfVxuXG4gIC8vICgpOnVpbnRcbiAgc2tpcExaKCkge1xuICAgIHZhciBsZWFkaW5nWmVyb0NvdW50OyAvLyA6dWludFxuICAgIGZvciAobGVhZGluZ1plcm9Db3VudCA9IDA7IGxlYWRpbmdaZXJvQ291bnQgPCB0aGlzLmJpdHNBdmFpbGFibGU7ICsrbGVhZGluZ1plcm9Db3VudCkge1xuICAgICAgaWYgKDAgIT09ICh0aGlzLndvcmQgJiAoMHg4MDAwMDAwMCA+Pj4gbGVhZGluZ1plcm9Db3VudCkpKSB7XG4gICAgICAgIC8vIHRoZSBmaXJzdCBiaXQgb2Ygd29ya2luZyB3b3JkIGlzIDFcbiAgICAgICAgdGhpcy53b3JkIDw8PSBsZWFkaW5nWmVyb0NvdW50O1xuICAgICAgICB0aGlzLmJpdHNBdmFpbGFibGUgLT0gbGVhZGluZ1plcm9Db3VudDtcbiAgICAgICAgcmV0dXJuIGxlYWRpbmdaZXJvQ291bnQ7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIHdlIGV4aGF1c3RlZCB3b3JkIGFuZCBzdGlsbCBoYXZlIG5vdCBmb3VuZCBhIDFcbiAgICB0aGlzLmxvYWRXb3JkKCk7XG4gICAgcmV0dXJuIGxlYWRpbmdaZXJvQ291bnQgKyB0aGlzLnNraXBMWigpO1xuICB9XG5cbiAgLy8gKCk6dm9pZFxuICBza2lwVUVHKCkge1xuICAgIHRoaXMuc2tpcEJpdHMoMSArIHRoaXMuc2tpcExaKCkpO1xuICB9XG5cbiAgLy8gKCk6dm9pZFxuICBza2lwRUcoKSB7XG4gICAgdGhpcy5za2lwQml0cygxICsgdGhpcy5za2lwTFooKSk7XG4gIH1cblxuICAvLyAoKTp1aW50XG4gIHJlYWRVRUcoKSB7XG4gICAgdmFyIGNseiA9IHRoaXMuc2tpcExaKCk7IC8vIDp1aW50XG4gICAgcmV0dXJuIHRoaXMucmVhZEJpdHMoY2x6ICsgMSkgLSAxO1xuICB9XG5cbiAgLy8gKCk6aW50XG4gIHJlYWRFRygpIHtcbiAgICB2YXIgdmFsdSA9IHRoaXMucmVhZFVFRygpOyAvLyA6aW50XG4gICAgaWYgKDB4MDEgJiB2YWx1KSB7XG4gICAgICAvLyB0aGUgbnVtYmVyIGlzIG9kZCBpZiB0aGUgbG93IG9yZGVyIGJpdCBpcyBzZXRcbiAgICAgIHJldHVybiAoMSArIHZhbHUpID4+PiAxOyAvLyBhZGQgMSB0byBtYWtlIGl0IGV2ZW4sIGFuZCBkaXZpZGUgYnkgMlxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gLTEgKiAodmFsdSA+Pj4gMSk7IC8vIGRpdmlkZSBieSB0d28gdGhlbiBtYWtlIGl0IG5lZ2F0aXZlXG4gICAgfVxuICB9XG5cbiAgLy8gU29tZSBjb252ZW5pZW5jZSBmdW5jdGlvbnNcbiAgLy8gOkJvb2xlYW5cbiAgcmVhZEJvb2xlYW4oKSB7XG4gICAgcmV0dXJuIDEgPT09IHRoaXMucmVhZEJpdHMoMSk7XG4gIH1cblxuICAvLyAoKTppbnRcbiAgcmVhZFVCeXRlKCkge1xuICAgIHJldHVybiB0aGlzLnJlYWRCaXRzKDgpO1xuICB9XG5cbiAgLy8gKCk6aW50XG4gIHJlYWRVU2hvcnQoKSB7XG4gICAgcmV0dXJuIHRoaXMucmVhZEJpdHMoMTYpO1xuICB9XG4gICAgLy8gKCk6aW50XG4gIHJlYWRVSW50KCkge1xuICAgIHJldHVybiB0aGlzLnJlYWRCaXRzKDMyKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZHZhbmNlIHRoZSBFeHBHb2xvbWIgZGVjb2RlciBwYXN0IGEgc2NhbGluZyBsaXN0LiBUaGUgc2NhbGluZ1xuICAgKiBsaXN0IGlzIG9wdGlvbmFsbHkgdHJhbnNtaXR0ZWQgYXMgcGFydCBvZiBhIHNlcXVlbmNlIHBhcmFtZXRlclxuICAgKiBzZXQgYW5kIGlzIG5vdCByZWxldmFudCB0byB0cmFuc211eGluZy5cbiAgICogQHBhcmFtIGNvdW50IHtudW1iZXJ9IHRoZSBudW1iZXIgb2YgZW50cmllcyBpbiB0aGlzIHNjYWxpbmcgbGlzdFxuICAgKiBAc2VlIFJlY29tbWVuZGF0aW9uIElUVS1UIEguMjY0LCBTZWN0aW9uIDcuMy4yLjEuMS4xXG4gICAqL1xuICBza2lwU2NhbGluZ0xpc3QoY291bnQpIHtcbiAgICB2YXJcbiAgICAgIGxhc3RTY2FsZSA9IDgsXG4gICAgICBuZXh0U2NhbGUgPSA4LFxuICAgICAgaixcbiAgICAgIGRlbHRhU2NhbGU7XG4gICAgZm9yIChqID0gMDsgaiA8IGNvdW50OyBqKyspIHtcbiAgICAgIGlmIChuZXh0U2NhbGUgIT09IDApIHtcbiAgICAgICAgZGVsdGFTY2FsZSA9IHRoaXMucmVhZEVHKCk7XG4gICAgICAgIG5leHRTY2FsZSA9IChsYXN0U2NhbGUgKyBkZWx0YVNjYWxlICsgMjU2KSAlIDI1NjtcbiAgICAgIH1cbiAgICAgIGxhc3RTY2FsZSA9IChuZXh0U2NhbGUgPT09IDApID8gbGFzdFNjYWxlIDogbmV4dFNjYWxlO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZWFkIGEgc2VxdWVuY2UgcGFyYW1ldGVyIHNldCBhbmQgcmV0dXJuIHNvbWUgaW50ZXJlc3RpbmcgdmlkZW9cbiAgICogcHJvcGVydGllcy4gQSBzZXF1ZW5jZSBwYXJhbWV0ZXIgc2V0IGlzIHRoZSBIMjY0IG1ldGFkYXRhIHRoYXRcbiAgICogZGVzY3JpYmVzIHRoZSBwcm9wZXJ0aWVzIG9mIHVwY29taW5nIHZpZGVvIGZyYW1lcy5cbiAgICogQHBhcmFtIGRhdGEge1VpbnQ4QXJyYXl9IHRoZSBieXRlcyBvZiBhIHNlcXVlbmNlIHBhcmFtZXRlciBzZXRcbiAgICogQHJldHVybiB7b2JqZWN0fSBhbiBvYmplY3Qgd2l0aCBjb25maWd1cmF0aW9uIHBhcnNlZCBmcm9tIHRoZVxuICAgKiBzZXF1ZW5jZSBwYXJhbWV0ZXIgc2V0LCBpbmNsdWRpbmcgdGhlIGRpbWVuc2lvbnMgb2YgdGhlXG4gICAqIGFzc29jaWF0ZWQgdmlkZW8gZnJhbWVzLlxuICAgKi9cbiAgcmVhZFNQUygpIHtcbiAgICB2YXJcbiAgICAgIGZyYW1lQ3JvcExlZnRPZmZzZXQgPSAwLFxuICAgICAgZnJhbWVDcm9wUmlnaHRPZmZzZXQgPSAwLFxuICAgICAgZnJhbWVDcm9wVG9wT2Zmc2V0ID0gMCxcbiAgICAgIGZyYW1lQ3JvcEJvdHRvbU9mZnNldCA9IDAsXG4gICAgICBzYXJTY2FsZSA9IDEsXG4gICAgICBwcm9maWxlSWRjLHByb2ZpbGVDb21wYXQsbGV2ZWxJZGMsXG4gICAgICBudW1SZWZGcmFtZXNJblBpY09yZGVyQ250Q3ljbGUsIHBpY1dpZHRoSW5NYnNNaW51czEsXG4gICAgICBwaWNIZWlnaHRJbk1hcFVuaXRzTWludXMxLFxuICAgICAgZnJhbWVNYnNPbmx5RmxhZyxcbiAgICAgIHNjYWxpbmdMaXN0Q291bnQsXG4gICAgICBpO1xuICAgIHRoaXMucmVhZFVCeXRlKCk7XG4gICAgcHJvZmlsZUlkYyA9IHRoaXMucmVhZFVCeXRlKCk7IC8vIHByb2ZpbGVfaWRjXG4gICAgcHJvZmlsZUNvbXBhdCA9IHRoaXMucmVhZEJpdHMoNSk7IC8vIGNvbnN0cmFpbnRfc2V0WzAtNF1fZmxhZywgdSg1KVxuICAgIHRoaXMuc2tpcEJpdHMoMyk7IC8vIHJlc2VydmVkX3plcm9fM2JpdHMgdSgzKSxcbiAgICBsZXZlbElkYyA9IHRoaXMucmVhZFVCeXRlKCk7IC8vbGV2ZWxfaWRjIHUoOClcbiAgICB0aGlzLnNraXBVRUcoKTsgLy8gc2VxX3BhcmFtZXRlcl9zZXRfaWRcbiAgICAvLyBzb21lIHByb2ZpbGVzIGhhdmUgbW9yZSBvcHRpb25hbCBkYXRhIHdlIGRvbid0IG5lZWRcbiAgICBpZiAocHJvZmlsZUlkYyA9PT0gMTAwIHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDExMCB8fFxuICAgICAgICBwcm9maWxlSWRjID09PSAxMjIgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gMjQ0IHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDQ0ICB8fFxuICAgICAgICBwcm9maWxlSWRjID09PSA4MyAgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gODYgIHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDExOCB8fFxuICAgICAgICBwcm9maWxlSWRjID09PSAxMjgpIHtcbiAgICAgIHZhciBjaHJvbWFGb3JtYXRJZGMgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICAgIGlmIChjaHJvbWFGb3JtYXRJZGMgPT09IDMpIHtcbiAgICAgICAgdGhpcy5za2lwQml0cygxKTsgLy8gc2VwYXJhdGVfY29sb3VyX3BsYW5lX2ZsYWdcbiAgICAgIH1cbiAgICAgIHRoaXMuc2tpcFVFRygpOyAvLyBiaXRfZGVwdGhfbHVtYV9taW51czhcbiAgICAgIHRoaXMuc2tpcFVFRygpOyAvLyBiaXRfZGVwdGhfY2hyb21hX21pbnVzOFxuICAgICAgdGhpcy5za2lwQml0cygxKTsgLy8gcXBwcmltZV95X3plcm9fdHJhbnNmb3JtX2J5cGFzc19mbGFnXG4gICAgICBpZiAodGhpcy5yZWFkQm9vbGVhbigpKSB7IC8vIHNlcV9zY2FsaW5nX21hdHJpeF9wcmVzZW50X2ZsYWdcbiAgICAgICAgc2NhbGluZ0xpc3RDb3VudCA9IChjaHJvbWFGb3JtYXRJZGMgIT09IDMpID8gOCA6IDEyO1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgc2NhbGluZ0xpc3RDb3VudDsgaSsrKSB7XG4gICAgICAgICAgaWYgKHRoaXMucmVhZEJvb2xlYW4oKSkgeyAvLyBzZXFfc2NhbGluZ19saXN0X3ByZXNlbnRfZmxhZ1sgaSBdXG4gICAgICAgICAgICBpZiAoaSA8IDYpIHtcbiAgICAgICAgICAgICAgdGhpcy5za2lwU2NhbGluZ0xpc3QoMTYpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdGhpcy5za2lwU2NhbGluZ0xpc3QoNjQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLnNraXBVRUcoKTsgLy8gbG9nMl9tYXhfZnJhbWVfbnVtX21pbnVzNFxuICAgIHZhciBwaWNPcmRlckNudFR5cGUgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICBpZiAocGljT3JkZXJDbnRUeXBlID09PSAwKSB7XG4gICAgICB0aGlzLnJlYWRVRUcoKTsgLy9sb2cyX21heF9waWNfb3JkZXJfY250X2xzYl9taW51czRcbiAgICB9IGVsc2UgaWYgKHBpY09yZGVyQ250VHlwZSA9PT0gMSkge1xuICAgICAgdGhpcy5za2lwQml0cygxKTsgLy8gZGVsdGFfcGljX29yZGVyX2Fsd2F5c196ZXJvX2ZsYWdcbiAgICAgIHRoaXMuc2tpcEVHKCk7IC8vIG9mZnNldF9mb3Jfbm9uX3JlZl9waWNcbiAgICAgIHRoaXMuc2tpcEVHKCk7IC8vIG9mZnNldF9mb3JfdG9wX3RvX2JvdHRvbV9maWVsZFxuICAgICAgbnVtUmVmRnJhbWVzSW5QaWNPcmRlckNudEN5Y2xlID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgICBmb3IoaSA9IDA7IGkgPCBudW1SZWZGcmFtZXNJblBpY09yZGVyQ250Q3ljbGU7IGkrKykge1xuICAgICAgICB0aGlzLnNraXBFRygpOyAvLyBvZmZzZXRfZm9yX3JlZl9mcmFtZVsgaSBdXG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuc2tpcFVFRygpOyAvLyBtYXhfbnVtX3JlZl9mcmFtZXNcbiAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBnYXBzX2luX2ZyYW1lX251bV92YWx1ZV9hbGxvd2VkX2ZsYWdcbiAgICBwaWNXaWR0aEluTWJzTWludXMxID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgcGljSGVpZ2h0SW5NYXBVbml0c01pbnVzMSA9IHRoaXMucmVhZFVFRygpO1xuICAgIGZyYW1lTWJzT25seUZsYWcgPSB0aGlzLnJlYWRCaXRzKDEpO1xuICAgIGlmIChmcmFtZU1ic09ubHlGbGFnID09PSAwKSB7XG4gICAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBtYl9hZGFwdGl2ZV9mcmFtZV9maWVsZF9mbGFnXG4gICAgfVxuICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIGRpcmVjdF84eDhfaW5mZXJlbmNlX2ZsYWdcbiAgICBpZiAodGhpcy5yZWFkQm9vbGVhbigpKSB7IC8vIGZyYW1lX2Nyb3BwaW5nX2ZsYWdcbiAgICAgIGZyYW1lQ3JvcExlZnRPZmZzZXQgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICAgIGZyYW1lQ3JvcFJpZ2h0T2Zmc2V0ID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgICBmcmFtZUNyb3BUb3BPZmZzZXQgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICAgIGZyYW1lQ3JvcEJvdHRvbU9mZnNldCA9IHRoaXMucmVhZFVFRygpO1xuICAgIH1cbiAgICBpZiAodGhpcy5yZWFkQm9vbGVhbigpKSB7XG4gICAgICAvLyB2dWlfcGFyYW1ldGVyc19wcmVzZW50X2ZsYWdcbiAgICAgIGlmICh0aGlzLnJlYWRCb29sZWFuKCkpIHtcbiAgICAgICAgLy8gYXNwZWN0X3JhdGlvX2luZm9fcHJlc2VudF9mbGFnXG4gICAgICAgIGxldCBzYXJSYXRpbztcbiAgICAgICAgY29uc3QgYXNwZWN0UmF0aW9JZGMgPSB0aGlzLnJlYWRVQnl0ZSgpO1xuICAgICAgICBzd2l0Y2ggKGFzcGVjdFJhdGlvSWRjKSB7XG4gICAgICAgICAgY2FzZSAxOiBzYXJSYXRpbyA9IFsxLDFdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDI6IHNhclJhdGlvID0gWzEyLDExXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSAzOiBzYXJSYXRpbyA9IFsxMCwxMV07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgNDogc2FyUmF0aW8gPSBbMTYsMTFdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDU6IHNhclJhdGlvID0gWzQwLDMzXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSA2OiBzYXJSYXRpbyA9IFsyNCwxMV07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgNzogc2FyUmF0aW8gPSBbMjAsMTFdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDg6IHNhclJhdGlvID0gWzMyLDExXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSA5OiBzYXJSYXRpbyA9IFs4MCwzM107IGJyZWFrO1xuICAgICAgICAgIGNhc2UgMTA6IHNhclJhdGlvID0gWzE4LDExXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSAxMTogc2FyUmF0aW8gPSBbMTUsMTFdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDEyOiBzYXJSYXRpbyA9IFs2NCwzM107IGJyZWFrO1xuICAgICAgICAgIGNhc2UgMTM6IHNhclJhdGlvID0gWzE2MCw5OV07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgMTQ6IHNhclJhdGlvID0gWzQsM107IGJyZWFrO1xuICAgICAgICAgIGNhc2UgMTU6IHNhclJhdGlvID0gWzMsMl07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgMTY6IHNhclJhdGlvID0gWzIsMV07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgMjU1OiB7XG4gICAgICAgICAgICBzYXJSYXRpbyA9IFt0aGlzLnJlYWRVQnl0ZSgpIDw8IDggfCB0aGlzLnJlYWRVQnl0ZSgpLCB0aGlzLnJlYWRVQnl0ZSgpIDw8IDggfCB0aGlzLnJlYWRVQnl0ZSgpXTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoc2FyUmF0aW8pIHtcbiAgICAgICAgICBzYXJTY2FsZSA9IHNhclJhdGlvWzBdIC8gc2FyUmF0aW9bMV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIHdpZHRoOiBNYXRoLmNlaWwoKCgocGljV2lkdGhJbk1ic01pbnVzMSArIDEpICogMTYpIC0gZnJhbWVDcm9wTGVmdE9mZnNldCAqIDIgLSBmcmFtZUNyb3BSaWdodE9mZnNldCAqIDIpICogc2FyU2NhbGUpLFxuICAgICAgaGVpZ2h0OiAoKDIgLSBmcmFtZU1ic09ubHlGbGFnKSAqIChwaWNIZWlnaHRJbk1hcFVuaXRzTWludXMxICsgMSkgKiAxNikgLSAoKGZyYW1lTWJzT25seUZsYWc/IDIgOiA0KSAqIChmcmFtZUNyb3BUb3BPZmZzZXQgKyBmcmFtZUNyb3BCb3R0b21PZmZzZXQpKVxuICAgIH07XG4gIH1cblxuICByZWFkU2xpY2VUeXBlKCkge1xuICAgIC8vIHNraXAgTkFMdSB0eXBlXG4gICAgdGhpcy5yZWFkVUJ5dGUoKTtcbiAgICAvLyBkaXNjYXJkIGZpcnN0X21iX2luX3NsaWNlXG4gICAgdGhpcy5yZWFkVUVHKCk7XG4gICAgLy8gcmV0dXJuIHNsaWNlX3R5cGVcbiAgICByZXR1cm4gdGhpcy5yZWFkVUVHKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRXhwR29sb21iO1xuIiwiLyoqXG4gKiBJRDMgcGFyc2VyXG4gKi9cbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuLy9pbXBvcnQgSGV4IGZyb20gJy4uL3V0aWxzL2hleCc7XG5cbiBjbGFzcyBJRDMge1xuXG4gIGNvbnN0cnVjdG9yKGRhdGEpIHtcbiAgICB0aGlzLl9oYXNUaW1lU3RhbXAgPSBmYWxzZTtcbiAgICB2YXIgb2Zmc2V0ID0gMCwgYnl0ZTEsYnl0ZTIsYnl0ZTMsYnl0ZTQsdGFnU2l6ZSxlbmRQb3MsaGVhZGVyLGxlbjtcbiAgICAgIGRvIHtcbiAgICAgICAgaGVhZGVyID0gdGhpcy5yZWFkVVRGKGRhdGEsb2Zmc2V0LDMpO1xuICAgICAgICBvZmZzZXQrPTM7XG4gICAgICAgICAgLy8gZmlyc3QgY2hlY2sgZm9yIElEMyBoZWFkZXJcbiAgICAgICAgICBpZiAoaGVhZGVyID09PSAnSUQzJykge1xuICAgICAgICAgICAgICAvLyBza2lwIDI0IGJpdHNcbiAgICAgICAgICAgICAgb2Zmc2V0ICs9IDM7XG4gICAgICAgICAgICAgIC8vIHJldHJpZXZlIHRhZyhzKSBsZW5ndGhcbiAgICAgICAgICAgICAgYnl0ZTEgPSBkYXRhW29mZnNldCsrXSAmIDB4N2Y7XG4gICAgICAgICAgICAgIGJ5dGUyID0gZGF0YVtvZmZzZXQrK10gJiAweDdmO1xuICAgICAgICAgICAgICBieXRlMyA9IGRhdGFbb2Zmc2V0KytdICYgMHg3ZjtcbiAgICAgICAgICAgICAgYnl0ZTQgPSBkYXRhW29mZnNldCsrXSAmIDB4N2Y7XG4gICAgICAgICAgICAgIHRhZ1NpemUgPSAoYnl0ZTEgPDwgMjEpICsgKGJ5dGUyIDw8IDE0KSArIChieXRlMyA8PCA3KSArIGJ5dGU0O1xuICAgICAgICAgICAgICBlbmRQb3MgPSBvZmZzZXQgKyB0YWdTaXplO1xuICAgICAgICAgICAgICAvL2xvZ2dlci5sb2coYElEMyB0YWcgZm91bmQsIHNpemUvZW5kOiAke3RhZ1NpemV9LyR7ZW5kUG9zfWApO1xuXG4gICAgICAgICAgICAgIC8vIHJlYWQgSUQzIHRhZ3NcbiAgICAgICAgICAgICAgdGhpcy5fcGFyc2VJRDNGcmFtZXMoZGF0YSwgb2Zmc2V0LGVuZFBvcyk7XG4gICAgICAgICAgICAgIG9mZnNldCA9IGVuZFBvcztcbiAgICAgICAgICB9IGVsc2UgaWYgKGhlYWRlciA9PT0gJzNESScpIHtcbiAgICAgICAgICAgICAgLy8gaHR0cDovL2lkMy5vcmcvaWQzdjIuNC4wLXN0cnVjdHVyZSBjaGFwdGVyIDMuNC4gICBJRDN2MiBmb290ZXJcbiAgICAgICAgICAgICAgb2Zmc2V0ICs9IDc7XG4gICAgICAgICAgICAgICAgICBsb2dnZXIubG9nKGAzREkgZm9vdGVyIGZvdW5kLCBlbmQ6ICR7b2Zmc2V0fWApO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIG9mZnNldCAtPSAzO1xuICAgICAgICAgICAgICBsZW4gPSBvZmZzZXQ7XG4gICAgICAgICAgICAgICAgICBpZiAobGVuKSB7XG4gICAgICAgICAgICAgICAgICAgICAgLy9sb2dnZXIubG9nKGBJRDMgbGVuOiAke2xlbn1gKTtcbiAgICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuaGFzVGltZVN0YW1wKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGxvZ2dlci53YXJuKCdJRDMgdGFnIGZvdW5kLCBidXQgbm8gdGltZXN0YW1wJyk7XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2xlbmd0aCA9IGxlbjtcbiAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9wYXlsb2FkID0gZGF0YS5zdWJhcnJheSgwLGxlbik7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICB9IHdoaWxlICh0cnVlKTtcbiAgfVxuXG4gIHJlYWRVVEYoZGF0YSxzdGFydCxsZW4pIHtcblxuICAgIHZhciByZXN1bHQgPSAnJyxvZmZzZXQgPSBzdGFydCwgZW5kID0gc3RhcnQgKyBsZW47XG4gICAgZG8ge1xuICAgICAgcmVzdWx0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoZGF0YVtvZmZzZXQrK10pO1xuICAgIH0gd2hpbGUob2Zmc2V0IDwgZW5kKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgX3BhcnNlSUQzRnJhbWVzKGRhdGEsb2Zmc2V0LGVuZFBvcykge1xuICAgIHZhciB0YWdJZCx0YWdMZW4sdGFnU3RhcnQsdGFnRmxhZ3MsdGltZXN0YW1wO1xuICAgIHdoaWxlKG9mZnNldCArIDggPD0gZW5kUG9zKSB7XG4gICAgICB0YWdJZCA9IHRoaXMucmVhZFVURihkYXRhLG9mZnNldCw0KTtcbiAgICAgIG9mZnNldCArPTQ7XG5cbiAgICAgIHRhZ0xlbiA9IGRhdGFbb2Zmc2V0KytdIDw8IDI0ICtcbiAgICAgICAgICAgICAgICBkYXRhW29mZnNldCsrXSA8PCAxNiArXG4gICAgICAgICAgICAgICAgZGF0YVtvZmZzZXQrK10gPDwgOCArXG4gICAgICAgICAgICAgICAgZGF0YVtvZmZzZXQrK107XG5cbiAgICAgIHRhZ0ZsYWdzID0gZGF0YVtvZmZzZXQrK10gPDwgOCArXG4gICAgICAgICAgICAgICAgICBkYXRhW29mZnNldCsrXTtcblxuICAgICAgdGFnU3RhcnQgPSBvZmZzZXQ7XG4gICAgICAvL2xvZ2dlci5sb2coXCJJRDMgdGFnIGlkOlwiICsgdGFnSWQpO1xuICAgICAgc3dpdGNoKHRhZ0lkKSB7XG4gICAgICAgIGNhc2UgJ1BSSVYnOlxuICAgICAgICAgICAgLy9sb2dnZXIubG9nKCdwYXJzZSBmcmFtZTonICsgSGV4LmhleER1bXAoZGF0YS5zdWJhcnJheShvZmZzZXQsZW5kUG9zKSkpO1xuICAgICAgICAgICAgLy8gb3duZXIgc2hvdWxkIGJlIFwiY29tLmFwcGxlLnN0cmVhbWluZy50cmFuc3BvcnRTdHJlYW1UaW1lc3RhbXBcIlxuICAgICAgICAgICAgaWYgKHRoaXMucmVhZFVURihkYXRhLG9mZnNldCw0NCkgPT09ICdjb20uYXBwbGUuc3RyZWFtaW5nLnRyYW5zcG9ydFN0cmVhbVRpbWVzdGFtcCcpIHtcbiAgICAgICAgICAgICAgICBvZmZzZXQrPTQ0O1xuICAgICAgICAgICAgICAgIC8vIHNtZWxsaW5nIGV2ZW4gYmV0dGVyICEgd2UgZm91bmQgdGhlIHJpZ2h0IGRlc2NyaXB0b3JcbiAgICAgICAgICAgICAgICAvLyBza2lwIG51bGwgY2hhcmFjdGVyIChzdHJpbmcgZW5kKSArIDMgZmlyc3QgYnl0ZXNcbiAgICAgICAgICAgICAgICBvZmZzZXQrPSA0O1xuXG4gICAgICAgICAgICAgICAgLy8gdGltZXN0YW1wIGlzIDMzIGJpdCBleHByZXNzZWQgYXMgYSBiaWctZW5kaWFuIGVpZ2h0LW9jdGV0IG51bWJlciwgd2l0aCB0aGUgdXBwZXIgMzEgYml0cyBzZXQgdG8gemVyby5cbiAgICAgICAgICAgICAgICB2YXIgcHRzMzNCaXQgID0gZGF0YVtvZmZzZXQrK10gJiAweDE7XG4gICAgICAgICAgICAgICAgdGhpcy5faGFzVGltZVN0YW1wID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgIHRpbWVzdGFtcCA9ICgoZGF0YVtvZmZzZXQrK10gPDwgMjMpICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKGRhdGFbb2Zmc2V0KytdIDw8IDE1KSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIChkYXRhW29mZnNldCsrXSA8PCAgNykgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhW29mZnNldCsrXSkgLzQ1O1xuXG4gICAgICAgICAgICAgICAgaWYgKHB0czMzQml0KSB7XG4gICAgICAgICAgICAgICAgICAgIHRpbWVzdGFtcCAgICs9IDQ3NzIxODU4Ljg0OyAvLyAyXjMyIC8gOTBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGltZXN0YW1wID0gTWF0aC5yb3VuZCh0aW1lc3RhbXApO1xuICAgICAgICAgICAgICAgIGxvZ2dlci50cmFjZShgSUQzIHRpbWVzdGFtcCBmb3VuZDogJHt0aW1lc3RhbXB9YCk7XG4gICAgICAgICAgICAgICAgdGhpcy5fdGltZVN0YW1wID0gdGltZXN0YW1wO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBnZXQgaGFzVGltZVN0YW1wKCkge1xuICAgIHJldHVybiB0aGlzLl9oYXNUaW1lU3RhbXA7XG4gIH1cblxuICBnZXQgdGltZVN0YW1wKCkge1xuICAgIHJldHVybiB0aGlzLl90aW1lU3RhbXA7XG4gIH1cblxuICBnZXQgbGVuZ3RoKCkge1xuICAgIHJldHVybiB0aGlzLl9sZW5ndGg7XG4gIH1cblxuICBnZXQgcGF5bG9hZCgpIHtcbiAgICByZXR1cm4gdGhpcy5fcGF5bG9hZDtcbiAgfVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IElEMztcblxuIiwiLyoqXG4gKiBoaWdobHkgb3B0aW1pemVkIFRTIGRlbXV4ZXI6XG4gKiBwYXJzZSBQQVQsIFBNVFxuICogZXh0cmFjdCBQRVMgcGFja2V0IGZyb20gYXVkaW8gYW5kIHZpZGVvIFBJRHNcbiAqIGV4dHJhY3QgQVZDL0gyNjQgTkFMIHVuaXRzIGFuZCBBQUMvQURUUyBzYW1wbGVzIGZyb20gUEVTIHBhY2tldFxuICogdHJpZ2dlciB0aGUgcmVtdXhlciB1cG9uIHBhcnNpbmcgY29tcGxldGlvblxuICogaXQgYWxzbyB0cmllcyB0byB3b3JrYXJvdW5kIGFzIGJlc3QgYXMgaXQgY2FuIGF1ZGlvIGNvZGVjIHN3aXRjaCAoSEUtQUFDIHRvIEFBQyBhbmQgdmljZSB2ZXJzYSksIHdpdGhvdXQgaGF2aW5nIHRvIHJlc3RhcnQgdGhlIE1lZGlhU291cmNlLlxuICogaXQgYWxzbyBjb250cm9scyB0aGUgcmVtdXhpbmcgcHJvY2VzcyA6XG4gKiB1cG9uIGRpc2NvbnRpbnVpdHkgb3IgbGV2ZWwgc3dpdGNoIGRldGVjdGlvbiwgaXQgd2lsbCBhbHNvIG5vdGlmaWVzIHRoZSByZW11eGVyIHNvIHRoYXQgaXQgY2FuIHJlc2V0IGl0cyBzdGF0ZS5cbiovXG5cbiBpbXBvcnQgQURUUyBmcm9tICcuL2FkdHMnO1xuIGltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuIGltcG9ydCBFeHBHb2xvbWIgZnJvbSAnLi9leHAtZ29sb21iJztcbi8vIGltcG9ydCBIZXggZnJvbSAnLi4vdXRpbHMvaGV4JztcbiBpbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbiBpbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcblxuIGNsYXNzIFRTRGVtdXhlciB7XG5cbiAgY29uc3RydWN0b3Iob2JzZXJ2ZXIscmVtdXhlckNsYXNzKSB7XG4gICAgdGhpcy5vYnNlcnZlciA9IG9ic2VydmVyO1xuICAgIHRoaXMucmVtdXhlckNsYXNzID0gcmVtdXhlckNsYXNzO1xuICAgIHRoaXMubGFzdENDID0gMDtcbiAgICB0aGlzLnJlbXV4ZXIgPSBuZXcgdGhpcy5yZW11eGVyQ2xhc3Mob2JzZXJ2ZXIpO1xuICB9XG5cbiAgc3RhdGljIHByb2JlKGRhdGEpIHtcbiAgICAvLyBhIFRTIGZyYWdtZW50IHNob3VsZCBjb250YWluIGF0IGxlYXN0IDMgVFMgcGFja2V0cywgYSBQQVQsIGEgUE1ULCBhbmQgb25lIFBJRCwgZWFjaCBzdGFydGluZyB3aXRoIDB4NDdcbiAgICBpZiAoZGF0YS5sZW5ndGggPj0gMyoxODggJiYgZGF0YVswXSA9PT0gMHg0NyAmJiBkYXRhWzE4OF0gPT09IDB4NDcgJiYgZGF0YVsyKjE4OF0gPT09IDB4NDcpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgc3dpdGNoTGV2ZWwoKSB7XG4gICAgdGhpcy5wbXRQYXJzZWQgPSBmYWxzZTtcbiAgICB0aGlzLl9wbXRJZCA9IC0xO1xuICAgIHRoaXMubGFzdEFhY1BUUyA9IG51bGw7XG4gICAgdGhpcy5hYWNPdmVyRmxvdyA9IG51bGw7XG4gICAgdGhpcy5fYXZjVHJhY2sgPSB7Y29udGFpbmVyIDogJ3ZpZGVvL21wMnQnLCB0eXBlOiAndmlkZW8nLCBpZCA6LTEsIHNlcXVlbmNlTnVtYmVyOiAwLCBzYW1wbGVzIDogW10sIGxlbiA6IDAsIG5iTmFsdSA6IDB9O1xuICAgIHRoaXMuX2FhY1RyYWNrID0ge2NvbnRhaW5lciA6ICd2aWRlby9tcDJ0JywgdHlwZTogJ2F1ZGlvJywgaWQgOi0xLCBzZXF1ZW5jZU51bWJlcjogMCwgc2FtcGxlcyA6IFtdLCBsZW4gOiAwfTtcbiAgICB0aGlzLl9pZDNUcmFjayA9IHt0eXBlOiAnaWQzJywgaWQgOi0xLCBzZXF1ZW5jZU51bWJlcjogMCwgc2FtcGxlcyA6IFtdLCBsZW4gOiAwfTtcbiAgICB0aGlzLl90eHRUcmFjayA9IHt0eXBlOiAndGV4dCcsIGlkOiAtMSwgc2VxdWVuY2VOdW1iZXI6IDAsIHNhbXBsZXM6IFtdLCBsZW46IDB9O1xuICAgIHRoaXMucmVtdXhlci5zd2l0Y2hMZXZlbCgpO1xuICB9XG5cbiAgaW5zZXJ0RGlzY29udGludWl0eSgpIHtcbiAgICB0aGlzLnN3aXRjaExldmVsKCk7XG4gICAgdGhpcy5yZW11eGVyLmluc2VydERpc2NvbnRpbnVpdHkoKTtcbiAgfVxuXG4gIC8vIGZlZWQgaW5jb21pbmcgZGF0YSB0byB0aGUgZnJvbnQgb2YgdGhlIHBhcnNpbmcgcGlwZWxpbmVcbiAgcHVzaChkYXRhLCBhdWRpb0NvZGVjLCB2aWRlb0NvZGVjLCB0aW1lT2Zmc2V0LCBjYywgbGV2ZWwsIHNuLCBkdXJhdGlvbiwgdDApIHtcblx0ICBjb25zb2xlLmxvZygndHNkZW11eGVyIHQwOiAnICsgdDApO1xuICAgIHZhciBhdmNEYXRhLCBhYWNEYXRhLCBpZDNEYXRhLFxuICAgICAgICBzdGFydCwgbGVuID0gZGF0YS5sZW5ndGgsIHN0dCwgcGlkLCBhdGYsIG9mZnNldCxcbiAgICAgICAgY29kZWNzT25seSA9IHRoaXMucmVtdXhlci5wYXNzdGhyb3VnaDtcblxuICAgIHRoaXMuYXVkaW9Db2RlYyA9IGF1ZGlvQ29kZWM7XG4gICAgdGhpcy52aWRlb0NvZGVjID0gdmlkZW9Db2RlYztcbiAgICB0aGlzLnRpbWVPZmZzZXQgPSB0aW1lT2Zmc2V0O1xuICAgIHRoaXMuX2R1cmF0aW9uID0gZHVyYXRpb247XG4gICAgdGhpcy5jb250aWd1b3VzID0gZmFsc2U7XG4gICAgaWYgKGNjICE9PSB0aGlzLmxhc3RDQykge1xuICAgICAgbG9nZ2VyLmxvZygnZGlzY29udGludWl0eSBkZXRlY3RlZCcpO1xuICAgICAgdGhpcy5pbnNlcnREaXNjb250aW51aXR5KCk7XG4gICAgICB0aGlzLmxhc3RDQyA9IGNjO1xuICAgIH0gZWxzZSBpZiAobGV2ZWwgIT09IHRoaXMubGFzdExldmVsKSB7XG4gICAgICBsb2dnZXIubG9nKCdsZXZlbCBzd2l0Y2ggZGV0ZWN0ZWQnKTtcbiAgICAgIHRoaXMuc3dpdGNoTGV2ZWwoKTtcbiAgICAgIHRoaXMubGFzdExldmVsID0gbGV2ZWw7XG4gICAgfSBlbHNlIGlmIChzbiA9PT0gKHRoaXMubGFzdFNOKzEpKSB7XG4gICAgICB0aGlzLmNvbnRpZ3VvdXMgPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLmxhc3RTTiA9IHNuO1xuXG4gICAgaWYoIXRoaXMuY29udGlndW91cykge1xuICAgICAgLy8gZmx1c2ggYW55IHBhcnRpYWwgY29udGVudFxuICAgICAgdGhpcy5hYWNPdmVyRmxvdyA9IG51bGw7XG4gICAgfVxuXG4gICAgdmFyIHBtdFBhcnNlZCA9IHRoaXMucG10UGFyc2VkLFxuICAgICAgICBhdmNJZCA9IHRoaXMuX2F2Y1RyYWNrLmlkLFxuICAgICAgICBhYWNJZCA9IHRoaXMuX2FhY1RyYWNrLmlkLFxuICAgICAgICBpZDNJZCA9IHRoaXMuX2lkM1RyYWNrLmlkO1xuXG4gICAgLy8gZG9uJ3QgcGFyc2UgbGFzdCBUUyBwYWNrZXQgaWYgaW5jb21wbGV0ZVxuICAgIGxlbiAtPSBsZW4gJSAxODg7XG4gICAgLy8gbG9vcCB0aHJvdWdoIFRTIHBhY2tldHNcbiAgICBmb3IgKHN0YXJ0ID0gMDsgc3RhcnQgPCBsZW47IHN0YXJ0ICs9IDE4OCkge1xuICAgICAgaWYgKGRhdGFbc3RhcnRdID09PSAweDQ3KSB7XG4gICAgICAgIHN0dCA9ICEhKGRhdGFbc3RhcnQgKyAxXSAmIDB4NDApO1xuICAgICAgICAvLyBwaWQgaXMgYSAxMy1iaXQgZmllbGQgc3RhcnRpbmcgYXQgdGhlIGxhc3QgYml0IG9mIFRTWzFdXG4gICAgICAgIHBpZCA9ICgoZGF0YVtzdGFydCArIDFdICYgMHgxZikgPDwgOCkgKyBkYXRhW3N0YXJ0ICsgMl07XG4gICAgICAgIGF0ZiA9IChkYXRhW3N0YXJ0ICsgM10gJiAweDMwKSA+PiA0O1xuICAgICAgICAvLyBpZiBhbiBhZGFwdGlvbiBmaWVsZCBpcyBwcmVzZW50LCBpdHMgbGVuZ3RoIGlzIHNwZWNpZmllZCBieSB0aGUgZmlmdGggYnl0ZSBvZiB0aGUgVFMgcGFja2V0IGhlYWRlci5cbiAgICAgICAgaWYgKGF0ZiA+IDEpIHtcbiAgICAgICAgICBvZmZzZXQgPSBzdGFydCArIDUgKyBkYXRhW3N0YXJ0ICsgNF07XG4gICAgICAgICAgLy8gY29udGludWUgaWYgdGhlcmUgaXMgb25seSBhZGFwdGF0aW9uIGZpZWxkXG4gICAgICAgICAgaWYgKG9mZnNldCA9PT0gKHN0YXJ0ICsgMTg4KSkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG9mZnNldCA9IHN0YXJ0ICsgNDtcbiAgICAgICAgfVxuICAgICAgICBpZiAocG10UGFyc2VkKSB7XG4gICAgICAgICAgaWYgKHBpZCA9PT0gYXZjSWQpIHtcbiAgICAgICAgICAgIGlmIChzdHQpIHtcbiAgICAgICAgICAgICAgaWYgKGF2Y0RhdGEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9wYXJzZUFWQ1BFUyh0aGlzLl9wYXJzZVBFUyhhdmNEYXRhKSk7XG4gICAgICAgICAgICAgICAgaWYgKGNvZGVjc09ubHkpIHtcbiAgICAgICAgICAgICAgICAgIC8vIGlmIHdlIGhhdmUgdmlkZW8gY29kZWMgaW5mbyBBTkRcbiAgICAgICAgICAgICAgICAgIC8vIGlmIGF1ZGlvIFBJRCBpcyB1bmRlZmluZWQgT1IgaWYgd2UgaGF2ZSBhdWRpbyBjb2RlYyBpbmZvLFxuICAgICAgICAgICAgICAgICAgLy8gd2UgaGF2ZSBhbGwgY29kZWMgaW5mbyAhXG4gICAgICAgICAgICAgICAgICBpZiAodGhpcy5fYXZjVHJhY2suY29kZWMgJiYgKGFhY0lkID09PSAtMSB8fCB0aGlzLl9hYWNUcmFjay5jb2RlYykpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW11eChkYXRhLCB0MCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgYXZjRGF0YSA9IHtkYXRhOiBbXSwgc2l6ZTogMH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoYXZjRGF0YSkge1xuICAgICAgICAgICAgICBhdmNEYXRhLmRhdGEucHVzaChkYXRhLnN1YmFycmF5KG9mZnNldCwgc3RhcnQgKyAxODgpKTtcbiAgICAgICAgICAgICAgYXZjRGF0YS5zaXplICs9IHN0YXJ0ICsgMTg4IC0gb2Zmc2V0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSBpZiAocGlkID09PSBhYWNJZCkge1xuICAgICAgICAgICAgaWYgKHN0dCkge1xuICAgICAgICAgICAgICBpZiAoYWFjRGF0YSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3BhcnNlQUFDUEVTKHRoaXMuX3BhcnNlUEVTKGFhY0RhdGEpKTtcbiAgICAgICAgICAgICAgICBpZiAoY29kZWNzT25seSkge1xuICAgICAgICAgICAgICAgICAgLy8gaGVyZSB3ZSBub3cgdGhhdCB3ZSBoYXZlIGF1ZGlvIGNvZGVjIGluZm9cbiAgICAgICAgICAgICAgICAgIC8vIGlmIHZpZGVvIFBJRCBpcyB1bmRlZmluZWQgT1IgaWYgd2UgaGF2ZSB2aWRlbyBjb2RlYyBpbmZvLFxuICAgICAgICAgICAgICAgICAgLy8gd2UgaGF2ZSBhbGwgY29kZWMgaW5mb3MgIVxuICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuX2FhY1RyYWNrLmNvZGVjICYmIChhdmNJZCA9PT0gLTEgfHwgdGhpcy5fYXZjVHJhY2suY29kZWMpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVtdXgoZGF0YSwgdDApO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGFhY0RhdGEgPSB7ZGF0YTogW10sIHNpemU6IDB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGFhY0RhdGEpIHtcbiAgICAgICAgICAgICAgYWFjRGF0YS5kYXRhLnB1c2goZGF0YS5zdWJhcnJheShvZmZzZXQsIHN0YXJ0ICsgMTg4KSk7XG4gICAgICAgICAgICAgIGFhY0RhdGEuc2l6ZSArPSBzdGFydCArIDE4OCAtIG9mZnNldDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgaWYgKHBpZCA9PT0gaWQzSWQpIHtcbiAgICAgICAgICAgIGlmIChzdHQpIHtcbiAgICAgICAgICAgICAgaWYgKGlkM0RhdGEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9wYXJzZUlEM1BFUyh0aGlzLl9wYXJzZVBFUyhpZDNEYXRhKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWQzRGF0YSA9IHtkYXRhOiBbXSwgc2l6ZTogMH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoaWQzRGF0YSkge1xuICAgICAgICAgICAgICBpZDNEYXRhLmRhdGEucHVzaChkYXRhLnN1YmFycmF5KG9mZnNldCwgc3RhcnQgKyAxODgpKTtcbiAgICAgICAgICAgICAgaWQzRGF0YS5zaXplICs9IHN0YXJ0ICsgMTg4IC0gb2Zmc2V0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpZiAoc3R0KSB7XG4gICAgICAgICAgICBvZmZzZXQgKz0gZGF0YVtvZmZzZXRdICsgMTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHBpZCA9PT0gMCkge1xuICAgICAgICAgICAgdGhpcy5fcGFyc2VQQVQoZGF0YSwgb2Zmc2V0KTtcbiAgICAgICAgICB9IGVsc2UgaWYgKHBpZCA9PT0gdGhpcy5fcG10SWQpIHtcbiAgICAgICAgICAgIHRoaXMuX3BhcnNlUE1UKGRhdGEsIG9mZnNldCk7XG4gICAgICAgICAgICBwbXRQYXJzZWQgPSB0aGlzLnBtdFBhcnNlZCA9IHRydWU7XG4gICAgICAgICAgICBhdmNJZCA9IHRoaXMuX2F2Y1RyYWNrLmlkO1xuICAgICAgICAgICAgYWFjSWQgPSB0aGlzLl9hYWNUcmFjay5pZDtcbiAgICAgICAgICAgIGlkM0lkID0gdGhpcy5faWQzVHJhY2suaWQ7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLm9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlIDogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkZSQUdfUEFSU0lOR19FUlJPUiwgZmF0YWw6IGZhbHNlLCByZWFzb246ICdUUyBwYWNrZXQgZGlkIG5vdCBzdGFydCB3aXRoIDB4NDcnfSk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIHBhcnNlIGxhc3QgUEVTIHBhY2tldFxuICAgIGlmIChhdmNEYXRhKSB7XG4gICAgICB0aGlzLl9wYXJzZUFWQ1BFUyh0aGlzLl9wYXJzZVBFUyhhdmNEYXRhKSk7XG4gICAgfVxuICAgIGlmIChhYWNEYXRhKSB7XG4gICAgICB0aGlzLl9wYXJzZUFBQ1BFUyh0aGlzLl9wYXJzZVBFUyhhYWNEYXRhKSk7XG4gICAgfVxuICAgIGlmIChpZDNEYXRhKSB7XG4gICAgICB0aGlzLl9wYXJzZUlEM1BFUyh0aGlzLl9wYXJzZVBFUyhpZDNEYXRhKSk7XG4gICAgfVxuICAgIHRoaXMucmVtdXgobnVsbCwgdDApO1xuICB9XG5cbiAgcmVtdXgoZGF0YSwgdDApIHtcblx0ICBjb25zb2xlLmxvZygndHNkZW11eGVyIHBhc3NpbmcgdDAgdG8gcmVtdXg6ICcgKyB0MCk7XG4gICAgdGhpcy5yZW11eGVyLnJlbXV4KHRoaXMuX2FhY1RyYWNrLCB0aGlzLl9hdmNUcmFjaywgdGhpcy5faWQzVHJhY2ssIHRoaXMuX3R4dFRyYWNrLCB0aGlzLnRpbWVPZmZzZXQsIHRoaXMuY29udGlndW91cywgZGF0YSwgdDApO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLnN3aXRjaExldmVsKCk7XG4gICAgdGhpcy5faW5pdFBUUyA9IHRoaXMuX2luaXREVFMgPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5fZHVyYXRpb24gPSAwO1xuICB9XG5cbiAgX3BhcnNlUEFUKGRhdGEsIG9mZnNldCkge1xuICAgIC8vIHNraXAgdGhlIFBTSSBoZWFkZXIgYW5kIHBhcnNlIHRoZSBmaXJzdCBQTVQgZW50cnlcbiAgICB0aGlzLl9wbXRJZCAgPSAoZGF0YVtvZmZzZXQgKyAxMF0gJiAweDFGKSA8PCA4IHwgZGF0YVtvZmZzZXQgKyAxMV07XG4gICAgLy9sb2dnZXIubG9nKCdQTVQgUElEOicgICsgdGhpcy5fcG10SWQpO1xuICB9XG5cbiAgX3BhcnNlUE1UKGRhdGEsIG9mZnNldCkge1xuICAgIHZhciBzZWN0aW9uTGVuZ3RoLCB0YWJsZUVuZCwgcHJvZ3JhbUluZm9MZW5ndGgsIHBpZDtcbiAgICBzZWN0aW9uTGVuZ3RoID0gKGRhdGFbb2Zmc2V0ICsgMV0gJiAweDBmKSA8PCA4IHwgZGF0YVtvZmZzZXQgKyAyXTtcbiAgICB0YWJsZUVuZCA9IG9mZnNldCArIDMgKyBzZWN0aW9uTGVuZ3RoIC0gNDtcbiAgICAvLyB0byBkZXRlcm1pbmUgd2hlcmUgdGhlIHRhYmxlIGlzLCB3ZSBoYXZlIHRvIGZpZ3VyZSBvdXQgaG93XG4gICAgLy8gbG9uZyB0aGUgcHJvZ3JhbSBpbmZvIGRlc2NyaXB0b3JzIGFyZVxuICAgIHByb2dyYW1JbmZvTGVuZ3RoID0gKGRhdGFbb2Zmc2V0ICsgMTBdICYgMHgwZikgPDwgOCB8IGRhdGFbb2Zmc2V0ICsgMTFdO1xuICAgIC8vIGFkdmFuY2UgdGhlIG9mZnNldCB0byB0aGUgZmlyc3QgZW50cnkgaW4gdGhlIG1hcHBpbmcgdGFibGVcbiAgICBvZmZzZXQgKz0gMTIgKyBwcm9ncmFtSW5mb0xlbmd0aDtcbiAgICB3aGlsZSAob2Zmc2V0IDwgdGFibGVFbmQpIHtcbiAgICAgIHBpZCA9IChkYXRhW29mZnNldCArIDFdICYgMHgxRikgPDwgOCB8IGRhdGFbb2Zmc2V0ICsgMl07XG4gICAgICBzd2l0Y2goZGF0YVtvZmZzZXRdKSB7XG4gICAgICAgIC8vIElTTy9JRUMgMTM4MTgtNyBBRFRTIEFBQyAoTVBFRy0yIGxvd2VyIGJpdC1yYXRlIGF1ZGlvKVxuICAgICAgICBjYXNlIDB4MGY6XG4gICAgICAgICAgLy9sb2dnZXIubG9nKCdBQUMgUElEOicgICsgcGlkKTtcbiAgICAgICAgICB0aGlzLl9hYWNUcmFjay5pZCA9IHBpZDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgLy8gUGFja2V0aXplZCBtZXRhZGF0YSAoSUQzKVxuICAgICAgICBjYXNlIDB4MTU6XG4gICAgICAgICAgLy9sb2dnZXIubG9nKCdJRDMgUElEOicgICsgcGlkKTtcbiAgICAgICAgICB0aGlzLl9pZDNUcmFjay5pZCA9IHBpZDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgLy8gSVRVLVQgUmVjLiBILjI2NCBhbmQgSVNPL0lFQyAxNDQ5Ni0xMCAobG93ZXIgYml0LXJhdGUgdmlkZW8pXG4gICAgICAgIGNhc2UgMHgxYjpcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ0FWQyBQSUQ6JyAgKyBwaWQpO1xuICAgICAgICAgIHRoaXMuX2F2Y1RyYWNrLmlkID0gcGlkO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICBsb2dnZXIubG9nKCd1bmtvd24gc3RyZWFtIHR5cGU6JyAgKyBkYXRhW29mZnNldF0pO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIC8vIG1vdmUgdG8gdGhlIG5leHQgdGFibGUgZW50cnlcbiAgICAgIC8vIHNraXAgcGFzdCB0aGUgZWxlbWVudGFyeSBzdHJlYW0gZGVzY3JpcHRvcnMsIGlmIHByZXNlbnRcbiAgICAgIG9mZnNldCArPSAoKGRhdGFbb2Zmc2V0ICsgM10gJiAweDBGKSA8PCA4IHwgZGF0YVtvZmZzZXQgKyA0XSkgKyA1O1xuICAgIH1cbiAgfVxuXG4gIF9wYXJzZVBFUyhzdHJlYW0pIHtcbiAgICB2YXIgaSA9IDAsIGZyYWcsIHBlc0ZsYWdzLCBwZXNQcmVmaXgsIHBlc0xlbiwgcGVzSGRyTGVuLCBwZXNEYXRhLCBwZXNQdHMsIHBlc0R0cywgcGF5bG9hZFN0YXJ0T2Zmc2V0LCBkYXRhID0gc3RyZWFtLmRhdGE7XG4gICAgLy9yZXRyaWV2ZSBQVFMvRFRTIGZyb20gZmlyc3QgZnJhZ21lbnRcbiAgICBmcmFnID0gZGF0YVswXTtcbiAgICBwZXNQcmVmaXggPSAoZnJhZ1swXSA8PCAxNikgKyAoZnJhZ1sxXSA8PCA4KSArIGZyYWdbMl07XG4gICAgaWYgKHBlc1ByZWZpeCA9PT0gMSkge1xuICAgICAgcGVzTGVuID0gKGZyYWdbNF0gPDwgOCkgKyBmcmFnWzVdO1xuICAgICAgcGVzRmxhZ3MgPSBmcmFnWzddO1xuICAgICAgaWYgKHBlc0ZsYWdzICYgMHhDMCkge1xuICAgICAgICAvKiBQRVMgaGVhZGVyIGRlc2NyaWJlZCBoZXJlIDogaHR0cDovL2R2ZC5zb3VyY2Vmb3JnZS5uZXQvZHZkaW5mby9wZXMtaGRyLmh0bWxcbiAgICAgICAgICAgIGFzIFBUUyAvIERUUyBpcyAzMyBiaXQgd2UgY2Fubm90IHVzZSBiaXR3aXNlIG9wZXJhdG9yIGluIEpTLFxuICAgICAgICAgICAgYXMgQml0d2lzZSBvcGVyYXRvcnMgdHJlYXQgdGhlaXIgb3BlcmFuZHMgYXMgYSBzZXF1ZW5jZSBvZiAzMiBiaXRzICovXG4gICAgICAgIHBlc1B0cyA9IChmcmFnWzldICYgMHgwRSkgKiA1MzY4NzA5MTIgKy8vIDEgPDwgMjlcbiAgICAgICAgICAoZnJhZ1sxMF0gJiAweEZGKSAqIDQxOTQzMDQgKy8vIDEgPDwgMjJcbiAgICAgICAgICAoZnJhZ1sxMV0gJiAweEZFKSAqIDE2Mzg0ICsvLyAxIDw8IDE0XG4gICAgICAgICAgKGZyYWdbMTJdICYgMHhGRikgKiAxMjggKy8vIDEgPDwgN1xuICAgICAgICAgIChmcmFnWzEzXSAmIDB4RkUpIC8gMjtcbiAgICAgICAgICAvLyBjaGVjayBpZiBncmVhdGVyIHRoYW4gMl4zMiAtMVxuICAgICAgICAgIGlmIChwZXNQdHMgPiA0Mjk0OTY3Mjk1KSB7XG4gICAgICAgICAgICAvLyBkZWNyZW1lbnQgMl4zM1xuICAgICAgICAgICAgcGVzUHRzIC09IDg1ODk5MzQ1OTI7XG4gICAgICAgICAgfVxuICAgICAgICBpZiAocGVzRmxhZ3MgJiAweDQwKSB7XG4gICAgICAgICAgcGVzRHRzID0gKGZyYWdbMTRdICYgMHgwRSApICogNTM2ODcwOTEyICsvLyAxIDw8IDI5XG4gICAgICAgICAgICAoZnJhZ1sxNV0gJiAweEZGICkgKiA0MTk0MzA0ICsvLyAxIDw8IDIyXG4gICAgICAgICAgICAoZnJhZ1sxNl0gJiAweEZFICkgKiAxNjM4NCArLy8gMSA8PCAxNFxuICAgICAgICAgICAgKGZyYWdbMTddICYgMHhGRiApICogMTI4ICsvLyAxIDw8IDdcbiAgICAgICAgICAgIChmcmFnWzE4XSAmIDB4RkUgKSAvIDI7XG4gICAgICAgICAgLy8gY2hlY2sgaWYgZ3JlYXRlciB0aGFuIDJeMzIgLTFcbiAgICAgICAgICBpZiAocGVzRHRzID4gNDI5NDk2NzI5NSkge1xuICAgICAgICAgICAgLy8gZGVjcmVtZW50IDJeMzNcbiAgICAgICAgICAgIHBlc0R0cyAtPSA4NTg5OTM0NTkyO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZXNEdHMgPSBwZXNQdHM7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHBlc0hkckxlbiA9IGZyYWdbOF07XG4gICAgICBwYXlsb2FkU3RhcnRPZmZzZXQgPSBwZXNIZHJMZW4gKyA5O1xuXG4gICAgICBzdHJlYW0uc2l6ZSAtPSBwYXlsb2FkU3RhcnRPZmZzZXQ7XG4gICAgICAvL3JlYXNzZW1ibGUgUEVTIHBhY2tldFxuICAgICAgcGVzRGF0YSA9IG5ldyBVaW50OEFycmF5KHN0cmVhbS5zaXplKTtcbiAgICAgIHdoaWxlIChkYXRhLmxlbmd0aCkge1xuICAgICAgICBmcmFnID0gZGF0YS5zaGlmdCgpO1xuICAgICAgICB2YXIgbGVuID0gZnJhZy5ieXRlTGVuZ3RoO1xuICAgICAgICBpZiAocGF5bG9hZFN0YXJ0T2Zmc2V0KSB7XG4gICAgICAgICAgaWYgKHBheWxvYWRTdGFydE9mZnNldCA+IGxlbikge1xuICAgICAgICAgICAgLy8gdHJpbSBmdWxsIGZyYWcgaWYgUEVTIGhlYWRlciBiaWdnZXIgdGhhbiBmcmFnXG4gICAgICAgICAgICBwYXlsb2FkU3RhcnRPZmZzZXQtPWxlbjtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyB0cmltIHBhcnRpYWwgZnJhZyBpZiBQRVMgaGVhZGVyIHNtYWxsZXIgdGhhbiBmcmFnXG4gICAgICAgICAgICBmcmFnID0gZnJhZy5zdWJhcnJheShwYXlsb2FkU3RhcnRPZmZzZXQpO1xuICAgICAgICAgICAgbGVuLT1wYXlsb2FkU3RhcnRPZmZzZXQ7XG4gICAgICAgICAgICBwYXlsb2FkU3RhcnRPZmZzZXQgPSAwO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBwZXNEYXRhLnNldChmcmFnLCBpKTtcbiAgICAgICAgaSs9bGVuO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHtkYXRhOiBwZXNEYXRhLCBwdHM6IHBlc1B0cywgZHRzOiBwZXNEdHMsIGxlbjogcGVzTGVufTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgX3BhcnNlQVZDUEVTKHBlcykge1xuICAgIHZhciB0cmFjayA9IHRoaXMuX2F2Y1RyYWNrLFxuICAgICAgICBzYW1wbGVzID0gdHJhY2suc2FtcGxlcyxcbiAgICAgICAgdW5pdHMgPSB0aGlzLl9wYXJzZUFWQ05BTHUocGVzLmRhdGEpLFxuICAgICAgICB1bml0czIgPSBbXSxcbiAgICAgICAgZGVidWcgPSBmYWxzZSxcbiAgICAgICAga2V5ID0gZmFsc2UsXG4gICAgICAgIGxlbmd0aCA9IDAsXG4gICAgICAgIGV4cEdvbG9tYkRlY29kZXIsXG4gICAgICAgIGF2Y1NhbXBsZSxcbiAgICAgICAgcHVzaCxcbiAgICAgICAgaTtcbiAgICAvLyBubyBOQUx1IGZvdW5kXG4gICAgaWYgKHVuaXRzLmxlbmd0aCA9PT0gMCAmJiBzYW1wbGVzLmxlbmd0aCA+IDApIHtcbiAgICAgIC8vIGFwcGVuZCBwZXMuZGF0YSB0byBwcmV2aW91cyBOQUwgdW5pdFxuICAgICAgdmFyIGxhc3RhdmNTYW1wbGUgPSBzYW1wbGVzW3NhbXBsZXMubGVuZ3RoIC0gMV07XG4gICAgICB2YXIgbGFzdFVuaXQgPSBsYXN0YXZjU2FtcGxlLnVuaXRzLnVuaXRzW2xhc3RhdmNTYW1wbGUudW5pdHMudW5pdHMubGVuZ3RoIC0gMV07XG4gICAgICB2YXIgdG1wID0gbmV3IFVpbnQ4QXJyYXkobGFzdFVuaXQuZGF0YS5ieXRlTGVuZ3RoICsgcGVzLmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICB0bXAuc2V0KGxhc3RVbml0LmRhdGEsIDApO1xuICAgICAgdG1wLnNldChwZXMuZGF0YSwgbGFzdFVuaXQuZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICAgIGxhc3RVbml0LmRhdGEgPSB0bXA7XG4gICAgICBsYXN0YXZjU2FtcGxlLnVuaXRzLmxlbmd0aCArPSBwZXMuZGF0YS5ieXRlTGVuZ3RoO1xuICAgICAgdHJhY2subGVuICs9IHBlcy5kYXRhLmJ5dGVMZW5ndGg7XG4gICAgfVxuICAgIC8vZnJlZSBwZXMuZGF0YSB0byBzYXZlIHVwIHNvbWUgbWVtb3J5XG4gICAgcGVzLmRhdGEgPSBudWxsO1xuICAgIHZhciBkZWJ1Z1N0cmluZyA9ICcnO1xuXG4gICAgdW5pdHMuZm9yRWFjaCh1bml0ID0+IHtcbiAgICAgIHN3aXRjaCh1bml0LnR5cGUpIHtcbiAgICAgICAgLy9ORFJcbiAgICAgICAgIGNhc2UgMTpcbiAgICAgICAgICAgcHVzaCA9IHRydWU7XG4gICAgICAgICAgIGlmKGRlYnVnKSB7XG4gICAgICAgICAgICBkZWJ1Z1N0cmluZyArPSAnTkRSICc7XG4gICAgICAgICAgIH1cbiAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIC8vSURSXG4gICAgICAgIGNhc2UgNTpcbiAgICAgICAgICBwdXNoID0gdHJ1ZTtcbiAgICAgICAgICBpZihkZWJ1Zykge1xuICAgICAgICAgICAgZGVidWdTdHJpbmcgKz0gJ0lEUiAnO1xuICAgICAgICAgIH1cbiAgICAgICAgICBrZXkgPSB0cnVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICAvL1NFSVxuICAgICAgICBjYXNlIDY6XG4gICAgICAgICAgcHVzaCA9IHRydWU7XG4gICAgICAgICAgaWYoZGVidWcpIHtcbiAgICAgICAgICAgIGRlYnVnU3RyaW5nICs9ICdTRUkgJztcbiAgICAgICAgICB9XG4gICAgICAgICAgZXhwR29sb21iRGVjb2RlciA9IG5ldyBFeHBHb2xvbWIodW5pdC5kYXRhKTtcblxuICAgICAgICAgIC8vIHNraXAgZnJhbWVUeXBlXG4gICAgICAgICAgZXhwR29sb21iRGVjb2Rlci5yZWFkVUJ5dGUoKTtcblxuICAgICAgICAgIHZhciBwYXlsb2FkVHlwZSA9IGV4cEdvbG9tYkRlY29kZXIucmVhZFVCeXRlKCk7XG5cbiAgICAgICAgICAvLyBUT0RPOiB0aGVyZSBjYW4gYmUgbW9yZSB0aGFuIG9uZSBwYXlsb2FkIGluIGFuIFNFSSBwYWNrZXQuLi5cbiAgICAgICAgICAvLyBUT0RPOiBuZWVkIHRvIHJlYWQgdHlwZSBhbmQgc2l6ZSBpbiBhIHdoaWxlIGxvb3AgdG8gZ2V0IHRoZW0gYWxsXG4gICAgICAgICAgaWYgKHBheWxvYWRUeXBlID09PSA0KVxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHZhciBwYXlsb2FkU2l6ZSA9IDA7XG5cbiAgICAgICAgICAgIGRvIHtcbiAgICAgICAgICAgICAgcGF5bG9hZFNpemUgPSBleHBHb2xvbWJEZWNvZGVyLnJlYWRVQnl0ZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgd2hpbGUgKHBheWxvYWRTaXplID09PSAyNTUpO1xuXG4gICAgICAgICAgICB2YXIgY291bnRyeUNvZGUgPSBleHBHb2xvbWJEZWNvZGVyLnJlYWRVQnl0ZSgpO1xuXG4gICAgICAgICAgICBpZiAoY291bnRyeUNvZGUgPT09IDE4MSlcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgdmFyIHByb3ZpZGVyQ29kZSA9IGV4cEdvbG9tYkRlY29kZXIucmVhZFVTaG9ydCgpO1xuXG4gICAgICAgICAgICAgIGlmIChwcm92aWRlckNvZGUgPT09IDQ5KVxuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdmFyIHVzZXJTdHJ1Y3R1cmUgPSBleHBHb2xvbWJEZWNvZGVyLnJlYWRVSW50KCk7XG5cbiAgICAgICAgICAgICAgICBpZiAodXNlclN0cnVjdHVyZSA9PT0gMHg0NzQxMzkzNClcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICB2YXIgdXNlckRhdGFUeXBlID0gZXhwR29sb21iRGVjb2Rlci5yZWFkVUJ5dGUoKTtcblxuICAgICAgICAgICAgICAgICAgLy8gUmF3IENFQS02MDggYnl0ZXMgd3JhcHBlZCBpbiBDRUEtNzA4IHBhY2tldFxuICAgICAgICAgICAgICAgICAgaWYgKHVzZXJEYXRhVHlwZSA9PT0gMylcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGZpcnN0Qnl0ZSA9IGV4cEdvbG9tYkRlY29kZXIucmVhZFVCeXRlKCk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBzZWNvbmRCeXRlID0gZXhwR29sb21iRGVjb2Rlci5yZWFkVUJ5dGUoKTtcblxuICAgICAgICAgICAgICAgICAgICB2YXIgdG90YWxDQ3MgPSAzMSAmIGZpcnN0Qnl0ZTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGJ5dGVBcnJheSA9IFtmaXJzdEJ5dGUsIHNlY29uZEJ5dGVdO1xuXG4gICAgICAgICAgICAgICAgICAgIGZvciAoaT0wOyBpPHRvdGFsQ0NzOyBpKyspXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAvLyAzIGJ5dGVzIHBlciBDQ1xuICAgICAgICAgICAgICAgICAgICAgIGJ5dGVBcnJheS5wdXNoKGV4cEdvbG9tYkRlY29kZXIucmVhZFVCeXRlKCkpO1xuICAgICAgICAgICAgICAgICAgICAgIGJ5dGVBcnJheS5wdXNoKGV4cEdvbG9tYkRlY29kZXIucmVhZFVCeXRlKCkpO1xuICAgICAgICAgICAgICAgICAgICAgIGJ5dGVBcnJheS5wdXNoKGV4cEdvbG9tYkRlY29kZXIucmVhZFVCeXRlKCkpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fdHh0VHJhY2suc2FtcGxlcy5wdXNoKHt0eXBlOiAzLCBwdHM6IHBlcy5wdHMsIGJ5dGVzOiBieXRlQXJyYXl9KTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIC8vU1BTXG4gICAgICAgIGNhc2UgNzpcbiAgICAgICAgICBwdXNoID0gdHJ1ZTtcbiAgICAgICAgICBpZihkZWJ1Zykge1xuICAgICAgICAgICAgZGVidWdTdHJpbmcgKz0gJ1NQUyAnO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZighdHJhY2suc3BzKSB7XG4gICAgICAgICAgICBleHBHb2xvbWJEZWNvZGVyID0gbmV3IEV4cEdvbG9tYih1bml0LmRhdGEpO1xuICAgICAgICAgICAgdmFyIGNvbmZpZyA9IGV4cEdvbG9tYkRlY29kZXIucmVhZFNQUygpO1xuICAgICAgICAgICAgdHJhY2sud2lkdGggPSBjb25maWcud2lkdGg7XG4gICAgICAgICAgICB0cmFjay5oZWlnaHQgPSBjb25maWcuaGVpZ2h0O1xuICAgICAgICAgICAgdHJhY2suc3BzID0gW3VuaXQuZGF0YV07XG4gICAgICAgICAgICB0cmFjay5kdXJhdGlvbiA9IHRoaXMuX2R1cmF0aW9uO1xuICAgICAgICAgICAgdmFyIGNvZGVjYXJyYXkgPSB1bml0LmRhdGEuc3ViYXJyYXkoMSwgNCk7XG4gICAgICAgICAgICB2YXIgY29kZWNzdHJpbmcgPSAnYXZjMS4nO1xuICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IDM7IGkrKykge1xuICAgICAgICAgICAgICB2YXIgaCA9IGNvZGVjYXJyYXlbaV0udG9TdHJpbmcoMTYpO1xuICAgICAgICAgICAgICBpZiAoaC5sZW5ndGggPCAyKSB7XG4gICAgICAgICAgICAgICAgaCA9ICcwJyArIGg7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgY29kZWNzdHJpbmcgKz0gaDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRyYWNrLmNvZGVjID0gY29kZWNzdHJpbmc7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICAvL1BQU1xuICAgICAgICBjYXNlIDg6XG4gICAgICAgICAgcHVzaCA9IHRydWU7XG4gICAgICAgICAgaWYoZGVidWcpIHtcbiAgICAgICAgICAgIGRlYnVnU3RyaW5nICs9ICdQUFMgJztcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKCF0cmFjay5wcHMpIHtcbiAgICAgICAgICAgIHRyYWNrLnBwcyA9IFt1bml0LmRhdGFdO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSA5OlxuICAgICAgICAgIHB1c2ggPSBmYWxzZTtcbiAgICAgICAgICBpZihkZWJ1Zykge1xuICAgICAgICAgICAgZGVidWdTdHJpbmcgKz0gJ0FVRCAnO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBwdXNoID0gZmFsc2U7XG4gICAgICAgICAgZGVidWdTdHJpbmcgKz0gJ3Vua25vd24gTkFMICcgKyB1bml0LnR5cGUgKyAnICc7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBpZihwdXNoKSB7XG4gICAgICAgIHVuaXRzMi5wdXNoKHVuaXQpO1xuICAgICAgICBsZW5ndGgrPXVuaXQuZGF0YS5ieXRlTGVuZ3RoO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGlmKGRlYnVnIHx8IGRlYnVnU3RyaW5nLmxlbmd0aCkge1xuICAgICAgbG9nZ2VyLmxvZyhkZWJ1Z1N0cmluZyk7XG4gICAgfVxuICAgIC8vYnVpbGQgc2FtcGxlIGZyb20gUEVTXG4gICAgLy8gQW5uZXggQiB0byBNUDQgY29udmVyc2lvbiB0byBiZSBkb25lXG4gICAgaWYgKHVuaXRzMi5sZW5ndGgpIHtcbiAgICAgIC8vIG9ubHkgcHVzaCBBVkMgc2FtcGxlIGlmIGtleWZyYW1lIGFscmVhZHkgZm91bmQuIGJyb3dzZXJzIGV4cGVjdCBhIGtleWZyYW1lIGF0IGZpcnN0IHRvIHN0YXJ0IGRlY29kaW5nXG4gICAgICBpZiAoa2V5ID09PSB0cnVlIHx8IHRyYWNrLnNwcyApIHtcbiAgICAgICAgYXZjU2FtcGxlID0ge3VuaXRzOiB7IHVuaXRzIDogdW5pdHMyLCBsZW5ndGggOiBsZW5ndGh9LCBwdHM6IHBlcy5wdHMsIGR0czogcGVzLmR0cywga2V5OiBrZXl9O1xuICAgICAgICBzYW1wbGVzLnB1c2goYXZjU2FtcGxlKTtcbiAgICAgICAgdHJhY2subGVuICs9IGxlbmd0aDtcbiAgICAgICAgdHJhY2submJOYWx1ICs9IHVuaXRzMi5sZW5ndGg7XG4gICAgICB9XG4gICAgfVxuICB9XG5cblxuICBfcGFyc2VBVkNOQUx1KGFycmF5KSB7XG4gICAgdmFyIGkgPSAwLCBsZW4gPSBhcnJheS5ieXRlTGVuZ3RoLCB2YWx1ZSwgb3ZlcmZsb3csIHN0YXRlID0gMDtcbiAgICB2YXIgdW5pdHMgPSBbXSwgdW5pdCwgdW5pdFR5cGUsIGxhc3RVbml0U3RhcnQsIGxhc3RVbml0VHlwZTtcbiAgICAvL2xvZ2dlci5sb2coJ1BFUzonICsgSGV4LmhleER1bXAoYXJyYXkpKTtcbiAgICB3aGlsZSAoaSA8IGxlbikge1xuICAgICAgdmFsdWUgPSBhcnJheVtpKytdO1xuICAgICAgLy8gZmluZGluZyAzIG9yIDQtYnl0ZSBzdGFydCBjb2RlcyAoMDAgMDAgMDEgT1IgMDAgMDAgMDAgMDEpXG4gICAgICBzd2l0Y2ggKHN0YXRlKSB7XG4gICAgICAgIGNhc2UgMDpcbiAgICAgICAgICBpZiAodmFsdWUgPT09IDApIHtcbiAgICAgICAgICAgIHN0YXRlID0gMTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgMTpcbiAgICAgICAgICBpZiggdmFsdWUgPT09IDApIHtcbiAgICAgICAgICAgIHN0YXRlID0gMjtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3RhdGUgPSAwO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAyOlxuICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgaWYoIHZhbHVlID09PSAwKSB7XG4gICAgICAgICAgICBzdGF0ZSA9IDM7XG4gICAgICAgICAgfSBlbHNlIGlmICh2YWx1ZSA9PT0gMSAmJiBpIDwgbGVuKSB7XG4gICAgICAgICAgICB1bml0VHlwZSA9IGFycmF5W2ldICYgMHgxZjtcbiAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnZmluZCBOQUxVIEAgb2Zmc2V0OicgKyBpICsgJyx0eXBlOicgKyB1bml0VHlwZSk7XG4gICAgICAgICAgICBpZiAobGFzdFVuaXRTdGFydCkge1xuICAgICAgICAgICAgICB1bml0ID0ge2RhdGE6IGFycmF5LnN1YmFycmF5KGxhc3RVbml0U3RhcnQsIGkgLSBzdGF0ZSAtIDEpLCB0eXBlOiBsYXN0VW5pdFR5cGV9O1xuICAgICAgICAgICAgICAvL2xvZ2dlci5sb2coJ3B1c2hpbmcgTkFMVSwgdHlwZS9zaXplOicgKyB1bml0LnR5cGUgKyAnLycgKyB1bml0LmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICAgICAgICAgIHVuaXRzLnB1c2godW5pdCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyBJZiBOQUwgdW5pdHMgYXJlIG5vdCBzdGFydGluZyByaWdodCBhdCB0aGUgYmVnaW5uaW5nIG9mIHRoZSBQRVMgcGFja2V0LCBwdXNoIHByZWNlZGluZyBkYXRhIGludG8gcHJldmlvdXMgTkFMIHVuaXQuXG4gICAgICAgICAgICAgIG92ZXJmbG93ICA9IGkgLSBzdGF0ZSAtIDE7XG4gICAgICAgICAgICAgIGlmIChvdmVyZmxvdykge1xuICAgICAgICAgICAgICAgIHZhciB0cmFjayA9IHRoaXMuX2F2Y1RyYWNrLFxuICAgICAgICAgICAgICAgICAgICBzYW1wbGVzID0gdHJhY2suc2FtcGxlcztcbiAgICAgICAgICAgICAgICAvL2xvZ2dlci5sb2coJ2ZpcnN0IE5BTFUgZm91bmQgd2l0aCBvdmVyZmxvdzonICsgb3ZlcmZsb3cpO1xuICAgICAgICAgICAgICAgIGlmIChzYW1wbGVzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgdmFyIGxhc3RhdmNTYW1wbGUgPSBzYW1wbGVzW3NhbXBsZXMubGVuZ3RoIC0gMV0sXG4gICAgICAgICAgICAgICAgICAgICAgbGFzdFVuaXRzID0gbGFzdGF2Y1NhbXBsZS51bml0cy51bml0cyxcbiAgICAgICAgICAgICAgICAgICAgICBsYXN0VW5pdCA9IGxhc3RVbml0c1tsYXN0VW5pdHMubGVuZ3RoIC0gMV0sXG4gICAgICAgICAgICAgICAgICAgICAgdG1wID0gbmV3IFVpbnQ4QXJyYXkobGFzdFVuaXQuZGF0YS5ieXRlTGVuZ3RoICsgb3ZlcmZsb3cpO1xuICAgICAgICAgICAgICAgICAgdG1wLnNldChsYXN0VW5pdC5kYXRhLCAwKTtcbiAgICAgICAgICAgICAgICAgIHRtcC5zZXQoYXJyYXkuc3ViYXJyYXkoMCwgb3ZlcmZsb3cpLCBsYXN0VW5pdC5kYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgICAgICAgICAgICAgbGFzdFVuaXQuZGF0YSA9IHRtcDtcbiAgICAgICAgICAgICAgICAgIGxhc3RhdmNTYW1wbGUudW5pdHMubGVuZ3RoICs9IG92ZXJmbG93O1xuICAgICAgICAgICAgICAgICAgdHJhY2subGVuICs9IG92ZXJmbG93O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGFzdFVuaXRTdGFydCA9IGk7XG4gICAgICAgICAgICBsYXN0VW5pdFR5cGUgPSB1bml0VHlwZTtcbiAgICAgICAgICAgIHN0YXRlID0gMDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3RhdGUgPSAwO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGxhc3RVbml0U3RhcnQpIHtcbiAgICAgIHVuaXQgPSB7ZGF0YTogYXJyYXkuc3ViYXJyYXkobGFzdFVuaXRTdGFydCwgbGVuKSwgdHlwZTogbGFzdFVuaXRUeXBlfTtcbiAgICAgIHVuaXRzLnB1c2godW5pdCk7XG4gICAgICAvL2xvZ2dlci5sb2coJ3B1c2hpbmcgTkFMVSwgdHlwZS9zaXplOicgKyB1bml0LnR5cGUgKyAnLycgKyB1bml0LmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgfVxuICAgIHJldHVybiB1bml0cztcbiAgfVxuXG4gIF9wYXJzZUFBQ1BFUyhwZXMpIHtcbiAgICB2YXIgdHJhY2sgPSB0aGlzLl9hYWNUcmFjayxcbiAgICAgICAgZGF0YSA9IHBlcy5kYXRhLFxuICAgICAgICBwdHMgPSBwZXMucHRzLFxuICAgICAgICBzdGFydE9mZnNldCA9IDAsXG4gICAgICAgIGR1cmF0aW9uID0gdGhpcy5fZHVyYXRpb24sXG4gICAgICAgIGF1ZGlvQ29kZWMgPSB0aGlzLmF1ZGlvQ29kZWMsXG4gICAgICAgIGFhY092ZXJGbG93ID0gdGhpcy5hYWNPdmVyRmxvdyxcbiAgICAgICAgbGFzdEFhY1BUUyA9IHRoaXMubGFzdEFhY1BUUyxcbiAgICAgICAgY29uZmlnLCBmcmFtZUxlbmd0aCwgZnJhbWVEdXJhdGlvbiwgZnJhbWVJbmRleCwgb2Zmc2V0LCBoZWFkZXJMZW5ndGgsIHN0YW1wLCBsZW4sIGFhY1NhbXBsZTtcbiAgICBpZiAoYWFjT3ZlckZsb3cpIHtcbiAgICAgIHZhciB0bXAgPSBuZXcgVWludDhBcnJheShhYWNPdmVyRmxvdy5ieXRlTGVuZ3RoICsgZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICAgIHRtcC5zZXQoYWFjT3ZlckZsb3csIDApO1xuICAgICAgdG1wLnNldChkYXRhLCBhYWNPdmVyRmxvdy5ieXRlTGVuZ3RoKTtcbiAgICAgIC8vbG9nZ2VyLmxvZyhgQUFDOiBhcHBlbmQgb3ZlcmZsb3dpbmcgJHthYWNPdmVyRmxvdy5ieXRlTGVuZ3RofSBieXRlcyB0byBiZWdpbm5pbmcgb2YgbmV3IFBFU2ApO1xuICAgICAgZGF0YSA9IHRtcDtcbiAgICB9XG4gICAgLy8gbG9vayBmb3IgQURUUyBoZWFkZXIgKDB4RkZGeClcbiAgICBmb3IgKG9mZnNldCA9IHN0YXJ0T2Zmc2V0LCBsZW4gPSBkYXRhLmxlbmd0aDsgb2Zmc2V0IDwgbGVuIC0gMTsgb2Zmc2V0KyspIHtcbiAgICAgIGlmICgoZGF0YVtvZmZzZXRdID09PSAweGZmKSAmJiAoZGF0YVtvZmZzZXQrMV0gJiAweGYwKSA9PT0gMHhmMCkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gaWYgQURUUyBoZWFkZXIgZG9lcyBub3Qgc3RhcnQgc3RyYWlnaHQgZnJvbSB0aGUgYmVnaW5uaW5nIG9mIHRoZSBQRVMgcGF5bG9hZCwgcmFpc2UgYW4gZXJyb3JcbiAgICBpZiAob2Zmc2V0KSB7XG4gICAgICB2YXIgcmVhc29uLCBmYXRhbDtcbiAgICAgIGlmIChvZmZzZXQgPCBsZW4gLSAxKSB7XG4gICAgICAgIHJlYXNvbiA9IGBBQUMgUEVTIGRpZCBub3Qgc3RhcnQgd2l0aCBBRFRTIGhlYWRlcixvZmZzZXQ6JHtvZmZzZXR9YDtcbiAgICAgICAgZmF0YWwgPSBmYWxzZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlYXNvbiA9ICdubyBBRFRTIGhlYWRlciBmb3VuZCBpbiBBQUMgUEVTJztcbiAgICAgICAgZmF0YWwgPSB0cnVlO1xuICAgICAgfVxuICAgICAgdGhpcy5vYnNlcnZlci50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkZSQUdfUEFSU0lOR19FUlJPUiwgZmF0YWw6IGZhdGFsLCByZWFzb246IHJlYXNvbn0pO1xuICAgICAgaWYgKGZhdGFsKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKCF0cmFjay5hdWRpb3NhbXBsZXJhdGUpIHtcbiAgICAgIGNvbmZpZyA9IEFEVFMuZ2V0QXVkaW9Db25maWcodGhpcy5vYnNlcnZlcixkYXRhLCBvZmZzZXQsIGF1ZGlvQ29kZWMpO1xuICAgICAgdHJhY2suY29uZmlnID0gY29uZmlnLmNvbmZpZztcbiAgICAgIHRyYWNrLmF1ZGlvc2FtcGxlcmF0ZSA9IGNvbmZpZy5zYW1wbGVyYXRlO1xuICAgICAgdHJhY2suY2hhbm5lbENvdW50ID0gY29uZmlnLmNoYW5uZWxDb3VudDtcbiAgICAgIHRyYWNrLmNvZGVjID0gY29uZmlnLmNvZGVjO1xuICAgICAgdHJhY2suZHVyYXRpb24gPSBkdXJhdGlvbjtcbiAgICAgIGxvZ2dlci5sb2coYHBhcnNlZCBjb2RlYzoke3RyYWNrLmNvZGVjfSxyYXRlOiR7Y29uZmlnLnNhbXBsZXJhdGV9LG5iIGNoYW5uZWw6JHtjb25maWcuY2hhbm5lbENvdW50fWApO1xuICAgIH1cbiAgICBmcmFtZUluZGV4ID0gMDtcbiAgICBmcmFtZUR1cmF0aW9uID0gMTAyNCAqIDkwMDAwIC8gdHJhY2suYXVkaW9zYW1wbGVyYXRlO1xuXG4gICAgLy8gaWYgbGFzdCBBQUMgZnJhbWUgaXMgb3ZlcmZsb3dpbmcsIHdlIHNob3VsZCBlbnN1cmUgdGltZXN0YW1wcyBhcmUgY29udGlndW91czpcbiAgICAvLyBmaXJzdCBzYW1wbGUgUFRTIHNob3VsZCBiZSBlcXVhbCB0byBsYXN0IHNhbXBsZSBQVFMgKyBmcmFtZUR1cmF0aW9uXG4gICAgaWYoYWFjT3ZlckZsb3cgJiYgbGFzdEFhY1BUUykge1xuICAgICAgdmFyIG5ld1BUUyA9IGxhc3RBYWNQVFMrZnJhbWVEdXJhdGlvbjtcbiAgICAgIGlmKE1hdGguYWJzKG5ld1BUUy1wdHMpID4gMSkge1xuICAgICAgICBsb2dnZXIubG9nKGBBQUM6IGFsaWduIFBUUyBmb3Igb3ZlcmxhcHBpbmcgZnJhbWVzIGJ5ICR7TWF0aC5yb3VuZCgobmV3UFRTLXB0cykvOTApfWApO1xuICAgICAgICBwdHM9bmV3UFRTO1xuICAgICAgfVxuICAgIH1cblxuICAgIHdoaWxlICgob2Zmc2V0ICsgNSkgPCBsZW4pIHtcbiAgICAgIC8vIFRoZSBwcm90ZWN0aW9uIHNraXAgYml0IHRlbGxzIHVzIGlmIHdlIGhhdmUgMiBieXRlcyBvZiBDUkMgZGF0YSBhdCB0aGUgZW5kIG9mIHRoZSBBRFRTIGhlYWRlclxuICAgICAgaGVhZGVyTGVuZ3RoID0gKCEhKGRhdGFbb2Zmc2V0ICsgMV0gJiAweDAxKSA/IDcgOiA5KTtcbiAgICAgIC8vIHJldHJpZXZlIGZyYW1lIHNpemVcbiAgICAgIGZyYW1lTGVuZ3RoID0gKChkYXRhW29mZnNldCArIDNdICYgMHgwMykgPDwgMTEpIHxcbiAgICAgICAgICAgICAgICAgICAgIChkYXRhW29mZnNldCArIDRdIDw8IDMpIHxcbiAgICAgICAgICAgICAgICAgICAgKChkYXRhW29mZnNldCArIDVdICYgMHhFMCkgPj4+IDUpO1xuICAgICAgZnJhbWVMZW5ndGggIC09IGhlYWRlckxlbmd0aDtcbiAgICAgIC8vc3RhbXAgPSBwZXMucHRzO1xuXG4gICAgICBpZiAoKGZyYW1lTGVuZ3RoID4gMCkgJiYgKChvZmZzZXQgKyBoZWFkZXJMZW5ndGggKyBmcmFtZUxlbmd0aCkgPD0gbGVuKSkge1xuICAgICAgICBzdGFtcCA9IHB0cyArIGZyYW1lSW5kZXggKiBmcmFtZUR1cmF0aW9uO1xuICAgICAgICAvL2xvZ2dlci5sb2coYEFBQyBmcmFtZSwgb2Zmc2V0L2xlbmd0aC90b3RhbC9wdHM6JHtvZmZzZXQraGVhZGVyTGVuZ3RofS8ke2ZyYW1lTGVuZ3RofS8ke2RhdGEuYnl0ZUxlbmd0aH0vJHsoc3RhbXAvOTApLnRvRml4ZWQoMCl9YCk7XG4gICAgICAgIGFhY1NhbXBsZSA9IHt1bml0OiBkYXRhLnN1YmFycmF5KG9mZnNldCArIGhlYWRlckxlbmd0aCwgb2Zmc2V0ICsgaGVhZGVyTGVuZ3RoICsgZnJhbWVMZW5ndGgpLCBwdHM6IHN0YW1wLCBkdHM6IHN0YW1wfTtcbiAgICAgICAgdHJhY2suc2FtcGxlcy5wdXNoKGFhY1NhbXBsZSk7XG4gICAgICAgIHRyYWNrLmxlbiArPSBmcmFtZUxlbmd0aDtcbiAgICAgICAgb2Zmc2V0ICs9IGZyYW1lTGVuZ3RoICsgaGVhZGVyTGVuZ3RoO1xuICAgICAgICBmcmFtZUluZGV4Kys7XG4gICAgICAgIC8vIGxvb2sgZm9yIEFEVFMgaGVhZGVyICgweEZGRngpXG4gICAgICAgIGZvciAoIDsgb2Zmc2V0IDwgKGxlbiAtIDEpOyBvZmZzZXQrKykge1xuICAgICAgICAgIGlmICgoZGF0YVtvZmZzZXRdID09PSAweGZmKSAmJiAoKGRhdGFbb2Zmc2V0ICsgMV0gJiAweGYwKSA9PT0gMHhmMCkpIHtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChvZmZzZXQgPCBsZW4pIHtcbiAgICAgIGFhY092ZXJGbG93ID0gZGF0YS5zdWJhcnJheShvZmZzZXQsIGxlbik7XG4gICAgICAvL2xvZ2dlci5sb2coYEFBQzogb3ZlcmZsb3cgZGV0ZWN0ZWQ6JHtsZW4tb2Zmc2V0fWApO1xuICAgIH0gZWxzZSB7XG4gICAgICBhYWNPdmVyRmxvdyA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMuYWFjT3ZlckZsb3cgPSBhYWNPdmVyRmxvdztcbiAgICB0aGlzLmxhc3RBYWNQVFMgPSBzdGFtcDtcbiAgfVxuXG4gIF9wYXJzZUlEM1BFUyhwZXMpIHtcbiAgICB0aGlzLl9pZDNUcmFjay5zYW1wbGVzLnB1c2gocGVzKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBUU0RlbXV4ZXI7XG5cbiIsImV4cG9ydCBjb25zdCBFcnJvclR5cGVzID0ge1xuICAvLyBJZGVudGlmaWVyIGZvciBhIG5ldHdvcmsgZXJyb3IgKGxvYWRpbmcgZXJyb3IgLyB0aW1lb3V0IC4uLilcbiAgTkVUV09SS19FUlJPUjogJ25ldHdvcmtFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgbWVkaWEgRXJyb3IgKHZpZGVvL3BhcnNpbmcvbWVkaWFzb3VyY2UgZXJyb3IpXG4gIE1FRElBX0VSUk9SOiAnbWVkaWFFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGFsbCBvdGhlciBlcnJvcnNcbiAgT1RIRVJfRVJST1I6ICdvdGhlckVycm9yJ1xufTtcblxuZXhwb3J0IGNvbnN0IEVycm9yRGV0YWlscyA9IHtcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBtYW5pZmVzdCBsb2FkIGVycm9yIC0gZGF0YTogeyB1cmwgOiBmYXVsdHkgVVJMLCByZXNwb25zZSA6IFhIUiByZXNwb25zZX1cbiAgTUFOSUZFU1RfTE9BRF9FUlJPUjogJ21hbmlmZXN0TG9hZEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBtYW5pZmVzdCBsb2FkIHRpbWVvdXQgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBNQU5JRkVTVF9MT0FEX1RJTUVPVVQ6ICdtYW5pZmVzdExvYWRUaW1lT3V0JyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBtYW5pZmVzdCBwYXJzaW5nIGVycm9yIC0gZGF0YTogeyB1cmwgOiBmYXVsdHkgVVJMLCByZWFzb24gOiBlcnJvciByZWFzb259XG4gIE1BTklGRVNUX1BBUlNJTkdfRVJST1I6ICdtYW5pZmVzdFBhcnNpbmdFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgbWFuaWZlc3Qgd2l0aCBvbmx5IGluY29tcGF0aWJsZSBjb2RlY3MgZXJyb3IgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlYXNvbiA6IGVycm9yIHJlYXNvbn1cbiAgTUFOSUZFU1RfSU5DT01QQVRJQkxFX0NPREVDU19FUlJPUjogJ21hbmlmZXN0SW5jb21wYXRpYmxlQ29kZWNzRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBwbGF5bGlzdCBsb2FkIGVycm9yIC0gZGF0YTogeyB1cmwgOiBmYXVsdHkgVVJMLCByZXNwb25zZSA6IFhIUiByZXNwb25zZX1cbiAgTEVWRUxfTE9BRF9FUlJPUjogJ2xldmVsTG9hZEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgcGxheWxpc3QgbG9hZCB0aW1lb3V0IC0gZGF0YTogeyB1cmwgOiBmYXVsdHkgVVJMLCByZXNwb25zZSA6IFhIUiByZXNwb25zZX1cbiAgTEVWRUxfTE9BRF9USU1FT1VUOiAnbGV2ZWxMb2FkVGltZU91dCcsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgbGV2ZWwgc3dpdGNoIGVycm9yIC0gZGF0YTogeyBsZXZlbCA6IGZhdWx0eSBsZXZlbCBJZCwgZXZlbnQgOiBlcnJvciBkZXNjcmlwdGlvbn1cbiAgTEVWRUxfU1dJVENIX0VSUk9SOiAnbGV2ZWxTd2l0Y2hFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGZyYWdtZW50IGxvYWQgZXJyb3IgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBGUkFHX0xPQURfRVJST1I6ICdmcmFnTG9hZEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgZnJhZ21lbnQgbG9vcCBsb2FkaW5nIGVycm9yIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0fVxuICBGUkFHX0xPT1BfTE9BRElOR19FUlJPUjogJ2ZyYWdMb29wTG9hZGluZ0Vycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgZnJhZ21lbnQgbG9hZCB0aW1lb3V0IGVycm9yIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0fVxuICBGUkFHX0xPQURfVElNRU9VVDogJ2ZyYWdMb2FkVGltZU91dCcsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgZnJhZ21lbnQgZGVjcnlwdGlvbiBlcnJvciBldmVudCAtIGRhdGE6IHBhcnNpbmcgZXJyb3IgZGVzY3JpcHRpb25cbiAgRlJBR19ERUNSWVBUX0VSUk9SOiAnZnJhZ0RlY3J5cHRFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgZnJhZ21lbnQgcGFyc2luZyBlcnJvciBldmVudCAtIGRhdGE6IHBhcnNpbmcgZXJyb3IgZGVzY3JpcHRpb25cbiAgRlJBR19QQVJTSU5HX0VSUk9SOiAnZnJhZ1BhcnNpbmdFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGRlY3J5cHQga2V5IGxvYWQgZXJyb3IgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBLRVlfTE9BRF9FUlJPUjogJ2tleUxvYWRFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGRlY3J5cHQga2V5IGxvYWQgdGltZW91dCBlcnJvciAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdH1cbiAgS0VZX0xPQURfVElNRU9VVDogJ2tleUxvYWRUaW1lT3V0JyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBidWZmZXIgYXBwZW5kIGVycm9yIC0gZGF0YTogYXBwZW5kIGVycm9yIGRlc2NyaXB0aW9uXG4gIEJVRkZFUl9BUFBFTkRfRVJST1I6ICdidWZmZXJBcHBlbmRFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgYnVmZmVyIGFwcGVuZGluZyBlcnJvciBldmVudCAtIGRhdGE6IGFwcGVuZGluZyBlcnJvciBkZXNjcmlwdGlvblxuICBCVUZGRVJfQVBQRU5ESU5HX0VSUk9SOiAnYnVmZmVyQXBwZW5kaW5nRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIGJ1ZmZlciBzdGFsbGVkIGVycm9yIGV2ZW50XG4gIEJVRkZFUl9TVEFMTEVEX0VSUk9SOiAnYnVmZmVyU3RhbGxlZEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBidWZmZXIgZnVsbCBldmVudFxuICBCVUZGRVJfRlVMTF9FUlJPUjogJ2J1ZmZlckZ1bGxFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgYnVmZmVyIHNlZWsgb3ZlciBob2xlIGV2ZW50XG4gIEJVRkZFUl9TRUVLX09WRVJfSE9MRTogJ2J1ZmZlclNlZWtPdmVySG9sZSdcbn07XG4iLCIvKlxuKlxuKiBBbGwgb2JqZWN0cyBpbiB0aGUgZXZlbnQgaGFuZGxpbmcgY2hhaW4gc2hvdWxkIGluaGVyaXQgZnJvbSB0aGlzIGNsYXNzXG4qXG4qL1xuXG4vL2ltcG9ydCB7bG9nZ2VyfSBmcm9tICcuL3V0aWxzL2xvZ2dlcic7XG5cbmNsYXNzIEV2ZW50SGFuZGxlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzLCAuLi5ldmVudHMpIHtcbiAgICB0aGlzLmhscyA9IGhscztcbiAgICB0aGlzLm9uRXZlbnQgPSB0aGlzLm9uRXZlbnQuYmluZCh0aGlzKTtcbiAgICB0aGlzLmhhbmRsZWRFdmVudHMgPSBldmVudHM7XG4gICAgdGhpcy51c2VHZW5lcmljSGFuZGxlciA9IHRydWU7XG5cbiAgICB0aGlzLnJlZ2lzdGVyTGlzdGVuZXJzKCk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIHRoaXMudW5yZWdpc3Rlckxpc3RlbmVycygpO1xuICB9XG5cbiAgaXNFdmVudEhhbmRsZXIoKSB7XG4gICAgcmV0dXJuIHR5cGVvZiB0aGlzLmhhbmRsZWRFdmVudHMgPT09ICdvYmplY3QnICYmIHRoaXMuaGFuZGxlZEV2ZW50cy5sZW5ndGggJiYgdHlwZW9mIHRoaXMub25FdmVudCA9PT0gJ2Z1bmN0aW9uJztcbiAgfVxuXG4gIHJlZ2lzdGVyTGlzdGVuZXJzKCkge1xuICAgIGlmICh0aGlzLmlzRXZlbnRIYW5kbGVyKCkpIHtcbiAgICAgIHRoaXMuaGFuZGxlZEV2ZW50cy5mb3JFYWNoKGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgIGlmIChldmVudCA9PT0gJ2hsc0V2ZW50R2VuZXJpYycpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZvcmJpZGRlbiBldmVudCBuYW1lOiAnICsgZXZlbnQpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuaGxzLm9uKGV2ZW50LCB0aGlzLm9uRXZlbnQpO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9XG4gIH1cblxuICB1bnJlZ2lzdGVyTGlzdGVuZXJzKCkge1xuICAgIGlmICh0aGlzLmlzRXZlbnRIYW5kbGVyKCkpIHtcbiAgICAgIHRoaXMuaGFuZGxlZEV2ZW50cy5mb3JFYWNoKGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgIHRoaXMuaGxzLm9mZihldmVudCwgdGhpcy5vbkV2ZW50KTtcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfVxuICB9XG5cbiAgLypcbiAgKiBhcmd1bWVudHM6IGV2ZW50IChzdHJpbmcpLCBkYXRhIChhbnkpXG4gICovXG4gIG9uRXZlbnQoZXZlbnQsIGRhdGEpIHtcbiAgICB0aGlzLm9uRXZlbnRHZW5lcmljKGV2ZW50LCBkYXRhKTtcbiAgfVxuXG4gIG9uRXZlbnRHZW5lcmljKGV2ZW50LCBkYXRhKSB7XG4gICAgdmFyIGV2ZW50VG9GdW5jdGlvbiA9IGZ1bmN0aW9uKGV2ZW50LCBkYXRhKSB7XG4gICAgICB2YXIgZnVuY05hbWUgPSAnb24nICsgZXZlbnQucmVwbGFjZSgnaGxzJywgJycpO1xuICAgICAgaWYgKHR5cGVvZiB0aGlzW2Z1bmNOYW1lXSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEV2ZW50ICR7ZXZlbnR9IGhhcyBubyBnZW5lcmljIGhhbmRsZXIgaW4gdGhpcyAke3RoaXMuY29uc3RydWN0b3IubmFtZX0gY2xhc3MgKHRyaWVkICR7ZnVuY05hbWV9KWApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXNbZnVuY05hbWVdLmJpbmQodGhpcywgZGF0YSk7XG4gICAgfTtcbiAgICBldmVudFRvRnVuY3Rpb24uY2FsbCh0aGlzLCBldmVudCwgZGF0YSkuY2FsbCgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEV2ZW50SGFuZGxlcjsiLCJtb2R1bGUuZXhwb3J0cyA9IHtcbiAgLy8gZmlyZWQgYmVmb3JlIE1lZGlhU291cmNlIGlzIGF0dGFjaGluZyB0byBtZWRpYSBlbGVtZW50IC0gZGF0YTogeyBtZWRpYSB9XG4gIE1FRElBX0FUVEFDSElORzogJ2hsc01lZGlhQXR0YWNoaW5nJyxcbiAgLy8gZmlyZWQgd2hlbiBNZWRpYVNvdXJjZSBoYXMgYmVlbiBzdWNjZXNmdWxseSBhdHRhY2hlZCB0byBtZWRpYSBlbGVtZW50IC0gZGF0YTogeyB9XG4gIE1FRElBX0FUVEFDSEVEOiAnaGxzTWVkaWFBdHRhY2hlZCcsXG4gIC8vIGZpcmVkIGJlZm9yZSBkZXRhY2hpbmcgTWVkaWFTb3VyY2UgZnJvbSBtZWRpYSBlbGVtZW50IC0gZGF0YTogeyB9XG4gIE1FRElBX0RFVEFDSElORzogJ2hsc01lZGlhRGV0YWNoaW5nJyxcbiAgLy8gZmlyZWQgd2hlbiBNZWRpYVNvdXJjZSBoYXMgYmVlbiBkZXRhY2hlZCBmcm9tIG1lZGlhIGVsZW1lbnQgLSBkYXRhOiB7IH1cbiAgTUVESUFfREVUQUNIRUQ6ICdobHNNZWRpYURldGFjaGVkJyxcbiAgLy8gZmlyZWQgd2hlbiB3ZSBidWZmZXIgaXMgZ29pbmcgdG8gYmUgcmVzZXR0ZWRcbiAgQlVGRkVSX1JFU0VUOiAnaGxzQnVmZmVyUmVzZXQnLFxuICAvLyBmaXJlZCB3aGVuIHdlIGtub3cgYWJvdXQgdGhlIGNvZGVjcyB0aGF0IHdlIG5lZWQgYnVmZmVycyBmb3IgdG8gcHVzaCBpbnRvIC0gZGF0YToge3RyYWNrcyA6IHsgY29udGFpbmVyLCBjb2RlYywgbGV2ZWxDb2RlYywgaW5pdFNlZ21lbnQsIG1ldGFkYXRhIH19XG4gIEJVRkZFUl9DT0RFQ1M6ICdobHNCdWZmZXJDb2RlY3MnLFxuICAvLyBmaXJlZCB3aGVuIHdlIGFwcGVuZCBhIHNlZ21lbnQgdG8gdGhlIGJ1ZmZlciAtIGRhdGE6IHsgc2VnbWVudDogc2VnbWVudCBvYmplY3QgfVxuICBCVUZGRVJfQVBQRU5ESU5HOiAnaGxzQnVmZmVyQXBwZW5kaW5nJyxcbiAgLy8gZmlyZWQgd2hlbiB3ZSBhcmUgZG9uZSB3aXRoIGFwcGVuZGluZyBhIG1lZGlhIHNlZ21lbnQgdG8gdGhlIGJ1ZmZlclxuICBCVUZGRVJfQVBQRU5ERUQ6ICdobHNCdWZmZXJBcHBlbmRlZCcsXG4gIC8vIGZpcmVkIHdoZW4gdGhlIHN0cmVhbSBpcyBmaW5pc2hlZCBhbmQgd2Ugd2FudCB0byBub3RpZnkgdGhlIG1lZGlhIGJ1ZmZlciB0aGF0IHRoZXJlIHdpbGwgYmUgbm8gbW9yZSBkYXRhXG4gIEJVRkZFUl9FT1M6ICdobHNCdWZmZXJFb3MnLFxuICAvLyBmaXJlZCB3aGVuIHRoZSBtZWRpYSBidWZmZXIgc2hvdWxkIGJlIGZsdXNoZWQgLSBkYXRhIHtzdGFydE9mZnNldCwgZW5kT2Zmc2V0fVxuICBCVUZGRVJfRkxVU0hJTkc6ICdobHNCdWZmZXJGbHVzaGluZycsXG4gIC8vIGZpcmVkIHdoZW4gdGhlIG1lZGlhIGhhcyBiZWVuIGZsdXNoZWRcbiAgQlVGRkVSX0ZMVVNIRUQ6ICdobHNCdWZmZXJGbHVzaGVkJyxcbiAgLy8gZmlyZWQgdG8gc2lnbmFsIHRoYXQgYSBtYW5pZmVzdCBsb2FkaW5nIHN0YXJ0cyAtIGRhdGE6IHsgdXJsIDogbWFuaWZlc3RVUkx9XG4gIE1BTklGRVNUX0xPQURJTkc6ICdobHNNYW5pZmVzdExvYWRpbmcnLFxuICAvLyBmaXJlZCBhZnRlciBtYW5pZmVzdCBoYXMgYmVlbiBsb2FkZWQgLSBkYXRhOiB7IGxldmVscyA6IFthdmFpbGFibGUgcXVhbGl0eSBsZXZlbHNdICwgdXJsIDogbWFuaWZlc3RVUkwsIHN0YXRzIDogeyB0cmVxdWVzdCwgdGZpcnN0LCB0bG9hZCwgbXRpbWV9fVxuICBNQU5JRkVTVF9MT0FERUQ6ICdobHNNYW5pZmVzdExvYWRlZCcsXG4gIC8vIGZpcmVkIGFmdGVyIG1hbmlmZXN0IGhhcyBiZWVuIHBhcnNlZCAtIGRhdGE6IHsgbGV2ZWxzIDogW2F2YWlsYWJsZSBxdWFsaXR5IGxldmVsc10gLCBmaXJzdExldmVsIDogaW5kZXggb2YgZmlyc3QgcXVhbGl0eSBsZXZlbCBhcHBlYXJpbmcgaW4gTWFuaWZlc3R9XG4gIE1BTklGRVNUX1BBUlNFRDogJ2hsc01hbmlmZXN0UGFyc2VkJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGxldmVsIHBsYXlsaXN0IGxvYWRpbmcgc3RhcnRzIC0gZGF0YTogeyB1cmwgOiBsZXZlbCBVUkwgIGxldmVsIDogaWQgb2YgbGV2ZWwgYmVpbmcgbG9hZGVkfVxuICBMRVZFTF9MT0FESU5HOiAnaGxzTGV2ZWxMb2FkaW5nJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGxldmVsIHBsYXlsaXN0IGxvYWRpbmcgZmluaXNoZXMgLSBkYXRhOiB7IGRldGFpbHMgOiBsZXZlbERldGFpbHMgb2JqZWN0LCBsZXZlbCA6IGlkIG9mIGxvYWRlZCBsZXZlbCwgc3RhdHMgOiB7IHRyZXF1ZXN0LCB0Zmlyc3QsIHRsb2FkLCBtdGltZX0gfVxuICBMRVZFTF9MT0FERUQ6ICdobHNMZXZlbExvYWRlZCcsXG4gIC8vIGZpcmVkIHdoZW4gYSBsZXZlbCdzIGRldGFpbHMgaGF2ZSBiZWVuIHVwZGF0ZWQgYmFzZWQgb24gcHJldmlvdXMgZGV0YWlscywgYWZ0ZXIgaXQgaGFzIGJlZW4gbG9hZGVkLiAtIGRhdGE6IHsgZGV0YWlscyA6IGxldmVsRGV0YWlscyBvYmplY3QsIGxldmVsIDogaWQgb2YgdXBkYXRlZCBsZXZlbCB9XG4gIExFVkVMX1VQREFURUQ6ICdobHNMZXZlbFVwZGF0ZWQnLFxuICAvLyBmaXJlZCB3aGVuIGEgbGV2ZWwncyBQVFMgaW5mb3JtYXRpb24gaGFzIGJlZW4gdXBkYXRlZCBhZnRlciBwYXJzaW5nIGEgZnJhZ21lbnQgLSBkYXRhOiB7IGRldGFpbHMgOiBsZXZlbERldGFpbHMgb2JqZWN0LCBsZXZlbCA6IGlkIG9mIHVwZGF0ZWQgbGV2ZWwsIGRyaWZ0OiBQVFMgZHJpZnQgb2JzZXJ2ZWQgd2hlbiBwYXJzaW5nIGxhc3QgZnJhZ21lbnQgfVxuICBMRVZFTF9QVFNfVVBEQVRFRDogJ2hsc0xldmVsUHRzVXBkYXRlZCcsXG4gIC8vIGZpcmVkIHdoZW4gYSBsZXZlbCBzd2l0Y2ggaXMgcmVxdWVzdGVkIC0gZGF0YTogeyBsZXZlbCA6IGlkIG9mIG5ldyBsZXZlbCB9XG4gIExFVkVMX1NXSVRDSDogJ2hsc0xldmVsU3dpdGNoJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGZyYWdtZW50IGxvYWRpbmcgc3RhcnRzIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0fVxuICBGUkFHX0xPQURJTkc6ICdobHNGcmFnTG9hZGluZycsXG4gIC8vIGZpcmVkIHdoZW4gYSBmcmFnbWVudCBsb2FkaW5nIGlzIHByb2dyZXNzaW5nIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0LCB7IHRyZXF1ZXN0LCB0Zmlyc3QsIGxvYWRlZH19XG4gIEZSQUdfTE9BRF9QUk9HUkVTUzogJ2hsc0ZyYWdMb2FkUHJvZ3Jlc3MnLFxuICAvLyBJZGVudGlmaWVyIGZvciBmcmFnbWVudCBsb2FkIGFib3J0aW5nIGZvciBlbWVyZ2VuY3kgc3dpdGNoIGRvd24gLSBkYXRhOiB7ZnJhZyA6IGZyYWdtZW50IG9iamVjdH1cbiAgRlJBR19MT0FEX0VNRVJHRU5DWV9BQk9SVEVEOiAnaGxzRnJhZ0xvYWRFbWVyZ2VuY3lBYm9ydGVkJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGZyYWdtZW50IGxvYWRpbmcgaXMgY29tcGxldGVkIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0LCBwYXlsb2FkIDogZnJhZ21lbnQgcGF5bG9hZCwgc3RhdHMgOiB7IHRyZXF1ZXN0LCB0Zmlyc3QsIHRsb2FkLCBsZW5ndGh9fVxuICBGUkFHX0xPQURFRDogJ2hsc0ZyYWdMb2FkZWQnLFxuICAvLyBmaXJlZCB3aGVuIEluaXQgU2VnbWVudCBoYXMgYmVlbiBleHRyYWN0ZWQgZnJvbSBmcmFnbWVudCAtIGRhdGE6IHsgbW9vdiA6IG1vb3YgTVA0IGJveCwgY29kZWNzIDogY29kZWNzIGZvdW5kIHdoaWxlIHBhcnNpbmcgZnJhZ21lbnR9XG4gIEZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQ6ICdobHNGcmFnUGFyc2luZ0luaXRTZWdtZW50JyxcbiAgLy8gZmlyZWQgd2hlbiBwYXJzaW5nIHNlaSB0ZXh0IGlzIGNvbXBsZXRlZCAtIGRhdGE6IHsgc2FtcGxlcyA6IFsgc2VpIHNhbXBsZXMgcGVzIF0gfVxuICBGUkFHX1BBUlNJTkdfVVNFUkRBVEE6ICdobHNGcmFnUGFyc2luZ1VzZXJkYXRhJyxcbiAgLy8gZmlyZWQgd2hlbiBwYXJzaW5nIGlkMyBpcyBjb21wbGV0ZWQgLSBkYXRhOiB7IHNhbXBsZXMgOiBbIGlkMyBzYW1wbGVzIHBlcyBdIH1cbiAgRlJBR19QQVJTSU5HX01FVEFEQVRBOiAnaGxzRnJhZ1BhcnNpbmdNZXRhZGF0YScsXG4gIC8vIGZpcmVkIHdoZW4gZGF0YSBoYXZlIGJlZW4gZXh0cmFjdGVkIGZyb20gZnJhZ21lbnQgLSBkYXRhOiB7IGRhdGExIDogbW9vZiBNUDQgYm94IG9yIFRTIGZyYWdtZW50cywgZGF0YTIgOiBtZGF0IE1QNCBib3ggb3IgbnVsbH1cbiAgRlJBR19QQVJTSU5HX0RBVEE6ICdobHNGcmFnUGFyc2luZ0RhdGEnLFxuICAvLyBmaXJlZCB3aGVuIGZyYWdtZW50IHBhcnNpbmcgaXMgY29tcGxldGVkIC0gZGF0YTogdW5kZWZpbmVkXG4gIEZSQUdfUEFSU0VEOiAnaGxzRnJhZ1BhcnNlZCcsXG4gIC8vIGZpcmVkIHdoZW4gZnJhZ21lbnQgcmVtdXhlZCBNUDQgYm94ZXMgaGF2ZSBhbGwgYmVlbiBhcHBlbmRlZCBpbnRvIFNvdXJjZUJ1ZmZlciAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdCwgc3RhdHMgOiB7IHRyZXF1ZXN0LCB0Zmlyc3QsIHRsb2FkLCB0cGFyc2VkLCB0YnVmZmVyZWQsIGxlbmd0aH0gfVxuICBGUkFHX0JVRkZFUkVEOiAnaGxzRnJhZ0J1ZmZlcmVkJyxcbiAgLy8gZmlyZWQgd2hlbiBmcmFnbWVudCBtYXRjaGluZyB3aXRoIGN1cnJlbnQgbWVkaWEgcG9zaXRpb24gaXMgY2hhbmdpbmcgLSBkYXRhIDogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0IH1cbiAgRlJBR19DSEFOR0VEOiAnaGxzRnJhZ0NoYW5nZWQnLFxuICAgIC8vIElkZW50aWZpZXIgZm9yIGEgRlBTIGRyb3AgZXZlbnQgLSBkYXRhOiB7Y3VyZW50RHJvcHBlZCwgY3VycmVudERlY29kZWQsIHRvdGFsRHJvcHBlZEZyYW1lc31cbiAgRlBTX0RST1A6ICdobHNGcHNEcm9wJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYW4gZXJyb3IgZXZlbnQgLSBkYXRhOiB7IHR5cGUgOiBlcnJvciB0eXBlLCBkZXRhaWxzIDogZXJyb3IgZGV0YWlscywgZmF0YWwgOiBpZiB0cnVlLCBobHMuanMgY2Fubm90L3dpbGwgbm90IHRyeSB0byByZWNvdmVyLCBpZiBmYWxzZSwgaGxzLmpzIHdpbGwgdHJ5IHRvIHJlY292ZXIsb3RoZXIgZXJyb3Igc3BlY2lmaWMgZGF0YX1cbiAgRVJST1I6ICdobHNFcnJvcicsXG4gIC8vIGZpcmVkIHdoZW4gaGxzLmpzIGluc3RhbmNlIHN0YXJ0cyBkZXN0cm95aW5nLiBEaWZmZXJlbnQgZnJvbSBNRURJQV9ERVRBQ0hFRCBhcyBvbmUgY291bGQgd2FudCB0byBkZXRhY2ggYW5kIHJlYXR0YWNoIGEgbWVkaWEgdG8gdGhlIGluc3RhbmNlIG9mIGhscy5qcyB0byBoYW5kbGUgbWlkLXJvbGxzIGZvciBleGFtcGxlXG4gIERFU1RST1lJTkc6ICdobHNEZXN0cm95aW5nJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGRlY3J5cHQga2V5IGxvYWRpbmcgc3RhcnRzIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0fVxuICBLRVlfTE9BRElORzogJ2hsc0tleUxvYWRpbmcnLFxuICAvLyBmaXJlZCB3aGVuIGEgZGVjcnlwdCBrZXkgbG9hZGluZyBpcyBjb21wbGV0ZWQgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QsIHBheWxvYWQgOiBrZXkgcGF5bG9hZCwgc3RhdHMgOiB7IHRyZXF1ZXN0LCB0Zmlyc3QsIHRsb2FkLCBsZW5ndGh9fVxuICBLRVlfTE9BREVEOiAnaGxzS2V5TG9hZGVkJyxcbn07XG4iLCIvKipcbiAqIEJ1ZmZlciBIZWxwZXIgY2xhc3MsIHByb3ZpZGluZyBtZXRob2RzIGRlYWxpbmcgYnVmZmVyIGxlbmd0aCByZXRyaWV2YWxcbiovXG5cblxuY2xhc3MgQnVmZmVySGVscGVyIHtcblxuICBzdGF0aWMgYnVmZmVySW5mbyhtZWRpYSwgcG9zLG1heEhvbGVEdXJhdGlvbikge1xuICAgIGlmIChtZWRpYSkge1xuICAgICAgdmFyIHZidWZmZXJlZCA9IG1lZGlhLmJ1ZmZlcmVkLCBidWZmZXJlZCA9IFtdLGk7XG4gICAgICBmb3IgKGkgPSAwOyBpIDwgdmJ1ZmZlcmVkLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGJ1ZmZlcmVkLnB1c2goe3N0YXJ0OiB2YnVmZmVyZWQuc3RhcnQoaSksIGVuZDogdmJ1ZmZlcmVkLmVuZChpKX0pO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuYnVmZmVyZWRJbmZvKGJ1ZmZlcmVkLHBvcyxtYXhIb2xlRHVyYXRpb24pO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4ge2xlbjogMCwgc3RhcnQ6IDAsIGVuZDogMCwgbmV4dFN0YXJ0IDogdW5kZWZpbmVkfSA7XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIGJ1ZmZlcmVkSW5mbyhidWZmZXJlZCxwb3MsbWF4SG9sZUR1cmF0aW9uKSB7XG4gICAgdmFyIGJ1ZmZlcmVkMiA9IFtdLFxuICAgICAgICAvLyBidWZmZXJTdGFydCBhbmQgYnVmZmVyRW5kIGFyZSBidWZmZXIgYm91bmRhcmllcyBhcm91bmQgY3VycmVudCB2aWRlbyBwb3NpdGlvblxuICAgICAgICBidWZmZXJMZW4sYnVmZmVyU3RhcnQsIGJ1ZmZlckVuZCxidWZmZXJTdGFydE5leHQsaTtcbiAgICAvLyBzb3J0IG9uIGJ1ZmZlci5zdGFydC9zbWFsbGVyIGVuZCAoSUUgZG9lcyBub3QgYWx3YXlzIHJldHVybiBzb3J0ZWQgYnVmZmVyZWQgcmFuZ2UpXG4gICAgYnVmZmVyZWQuc29ydChmdW5jdGlvbiAoYSwgYikge1xuICAgICAgdmFyIGRpZmYgPSBhLnN0YXJ0IC0gYi5zdGFydDtcbiAgICAgIGlmIChkaWZmKSB7XG4gICAgICAgIHJldHVybiBkaWZmO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGIuZW5kIC0gYS5lbmQ7XG4gICAgICB9XG4gICAgfSk7XG4gICAgLy8gdGhlcmUgbWlnaHQgYmUgc29tZSBzbWFsbCBob2xlcyBiZXR3ZWVuIGJ1ZmZlciB0aW1lIHJhbmdlXG4gICAgLy8gY29uc2lkZXIgdGhhdCBob2xlcyBzbWFsbGVyIHRoYW4gbWF4SG9sZUR1cmF0aW9uIGFyZSBpcnJlbGV2YW50IGFuZCBidWlsZCBhbm90aGVyXG4gICAgLy8gYnVmZmVyIHRpbWUgcmFuZ2UgcmVwcmVzZW50YXRpb25zIHRoYXQgZGlzY2FyZHMgdGhvc2UgaG9sZXNcbiAgICBmb3IgKGkgPSAwOyBpIDwgYnVmZmVyZWQubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBidWYybGVuID0gYnVmZmVyZWQyLmxlbmd0aDtcbiAgICAgIGlmKGJ1ZjJsZW4pIHtcbiAgICAgICAgdmFyIGJ1ZjJlbmQgPSBidWZmZXJlZDJbYnVmMmxlbiAtIDFdLmVuZDtcbiAgICAgICAgLy8gaWYgc21hbGwgaG9sZSAodmFsdWUgYmV0d2VlbiAwIG9yIG1heEhvbGVEdXJhdGlvbiApIG9yIG92ZXJsYXBwaW5nIChuZWdhdGl2ZSlcbiAgICAgICAgaWYoKGJ1ZmZlcmVkW2ldLnN0YXJ0IC0gYnVmMmVuZCkgPCBtYXhIb2xlRHVyYXRpb24pIHtcbiAgICAgICAgICAvLyBtZXJnZSBvdmVybGFwcGluZyB0aW1lIHJhbmdlc1xuICAgICAgICAgIC8vIHVwZGF0ZSBsYXN0UmFuZ2UuZW5kIG9ubHkgaWYgc21hbGxlciB0aGFuIGl0ZW0uZW5kXG4gICAgICAgICAgLy8gZS5nLiAgWyAxLCAxNV0gd2l0aCAgWyAyLDhdID0+IFsgMSwxNV0gKG5vIG5lZWQgdG8gbW9kaWZ5IGxhc3RSYW5nZS5lbmQpXG4gICAgICAgICAgLy8gd2hlcmVhcyBbIDEsIDhdIHdpdGggIFsgMiwxNV0gPT4gWyAxLDE1XSAoIGxhc3RSYW5nZSBzaG91bGQgc3dpdGNoIGZyb20gWzEsOF0gdG8gWzEsMTVdKVxuICAgICAgICAgIGlmKGJ1ZmZlcmVkW2ldLmVuZCA+IGJ1ZjJlbmQpIHtcbiAgICAgICAgICAgIGJ1ZmZlcmVkMltidWYybGVuIC0gMV0uZW5kID0gYnVmZmVyZWRbaV0uZW5kO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBiaWcgaG9sZVxuICAgICAgICAgIGJ1ZmZlcmVkMi5wdXNoKGJ1ZmZlcmVkW2ldKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gZmlyc3QgdmFsdWVcbiAgICAgICAgYnVmZmVyZWQyLnB1c2goYnVmZmVyZWRbaV0pO1xuICAgICAgfVxuICAgIH1cbiAgICBmb3IgKGkgPSAwLCBidWZmZXJMZW4gPSAwLCBidWZmZXJTdGFydCA9IGJ1ZmZlckVuZCA9IHBvczsgaSA8IGJ1ZmZlcmVkMi5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHN0YXJ0ID0gIGJ1ZmZlcmVkMltpXS5zdGFydCxcbiAgICAgICAgICBlbmQgPSBidWZmZXJlZDJbaV0uZW5kO1xuICAgICAgLy9sb2dnZXIubG9nKCdidWYgc3RhcnQvZW5kOicgKyBidWZmZXJlZC5zdGFydChpKSArICcvJyArIGJ1ZmZlcmVkLmVuZChpKSk7XG4gICAgICBpZiAoKHBvcyArIG1heEhvbGVEdXJhdGlvbikgPj0gc3RhcnQgJiYgcG9zIDwgZW5kKSB7XG4gICAgICAgIC8vIHBsYXkgcG9zaXRpb24gaXMgaW5zaWRlIHRoaXMgYnVmZmVyIFRpbWVSYW5nZSwgcmV0cmlldmUgZW5kIG9mIGJ1ZmZlciBwb3NpdGlvbiBhbmQgYnVmZmVyIGxlbmd0aFxuICAgICAgICBidWZmZXJTdGFydCA9IHN0YXJ0O1xuICAgICAgICBidWZmZXJFbmQgPSBlbmQ7XG4gICAgICAgIGJ1ZmZlckxlbiA9IGJ1ZmZlckVuZCAtIHBvcztcbiAgICAgIH0gZWxzZSBpZiAoKHBvcyArIG1heEhvbGVEdXJhdGlvbikgPCBzdGFydCkge1xuICAgICAgICBidWZmZXJTdGFydE5leHQgPSBzdGFydDtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXHQvLyBpZiggYnVmZmVyU3RhcnQgPT0gYnVmZmVyRW5kICYmIGJ1ZmZlckVuZCAhPSAwKSB7IGRlYnVnZ2VyOyB9XG4gICAgcmV0dXJuIHtsZW46IGJ1ZmZlckxlbiwgc3RhcnQ6IGJ1ZmZlclN0YXJ0LCBlbmQ6IGJ1ZmZlckVuZCwgbmV4dFN0YXJ0IDogYnVmZmVyU3RhcnROZXh0fTtcbiAgfVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IEJ1ZmZlckhlbHBlcjtcbiIsIi8qKlxuICogTGV2ZWwgSGVscGVyIGNsYXNzLCBwcm92aWRpbmcgbWV0aG9kcyBkZWFsaW5nIHdpdGggcGxheWxpc3Qgc2xpZGluZyBhbmQgZHJpZnRcbiovXG5cbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG5jbGFzcyBMZXZlbEhlbHBlciB7XG5cbiAgc3RhdGljIG1lcmdlRGV0YWlscyhvbGREZXRhaWxzLG5ld0RldGFpbHMpIHtcbiAgICB2YXIgc3RhcnQgPSBNYXRoLm1heChvbGREZXRhaWxzLnN0YXJ0U04sbmV3RGV0YWlscy5zdGFydFNOKS1uZXdEZXRhaWxzLnN0YXJ0U04sXG4gICAgICAgIGVuZCA9IE1hdGgubWluKG9sZERldGFpbHMuZW5kU04sbmV3RGV0YWlscy5lbmRTTiktbmV3RGV0YWlscy5zdGFydFNOLFxuICAgICAgICBkZWx0YSA9IG5ld0RldGFpbHMuc3RhcnRTTiAtIG9sZERldGFpbHMuc3RhcnRTTixcbiAgICAgICAgb2xkZnJhZ21lbnRzID0gb2xkRGV0YWlscy5mcmFnbWVudHMsXG4gICAgICAgIG5ld2ZyYWdtZW50cyA9IG5ld0RldGFpbHMuZnJhZ21lbnRzLFxuICAgICAgICBjY09mZnNldCA9MCxcbiAgICAgICAgUFRTRnJhZztcblxuICAgIC8vIGNoZWNrIGlmIG9sZC9uZXcgcGxheWxpc3RzIGhhdmUgZnJhZ21lbnRzIGluIGNvbW1vblxuICAgIGlmICggZW5kIDwgc3RhcnQpIHtcbiAgICAgIG5ld0RldGFpbHMuUFRTS25vd24gPSBmYWxzZTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLy8gbG9vcCB0aHJvdWdoIG92ZXJsYXBwaW5nIFNOIGFuZCB1cGRhdGUgc3RhcnRQVFMgLCBjYywgYW5kIGR1cmF0aW9uIGlmIGFueSBmb3VuZFxuICAgIGZvcih2YXIgaSA9IHN0YXJ0IDsgaSA8PSBlbmQgOyBpKyspIHtcbiAgICAgIHZhciBvbGRGcmFnID0gb2xkZnJhZ21lbnRzW2RlbHRhK2ldLFxuICAgICAgICAgIG5ld0ZyYWcgPSBuZXdmcmFnbWVudHNbaV07XG4gICAgICBjY09mZnNldCA9IG9sZEZyYWcuY2MgLSBuZXdGcmFnLmNjO1xuICAgICAgaWYgKCFpc05hTihvbGRGcmFnLnN0YXJ0UFRTKSkge1xuICAgICAgICBuZXdGcmFnLnN0YXJ0ID0gbmV3RnJhZy5zdGFydFBUUyA9IG9sZEZyYWcuc3RhcnRQVFM7XG4gICAgICAgIG5ld0ZyYWcuZW5kUFRTID0gb2xkRnJhZy5lbmRQVFM7XG4gICAgICAgIG5ld0ZyYWcuZHVyYXRpb24gPSBvbGRGcmFnLmR1cmF0aW9uO1xuICAgICAgICBQVFNGcmFnID0gbmV3RnJhZztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZihjY09mZnNldCkge1xuICAgICAgbG9nZ2VyLmxvZyhgZGlzY29udGludWl0eSBzbGlkaW5nIGZyb20gcGxheWxpc3QsIHRha2UgZHJpZnQgaW50byBhY2NvdW50YCk7XG4gICAgICBmb3IoaSA9IDAgOyBpIDwgbmV3ZnJhZ21lbnRzLmxlbmd0aCA7IGkrKykge1xuICAgICAgICBuZXdmcmFnbWVudHNbaV0uY2MgKz0gY2NPZmZzZXQ7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gaWYgYXQgbGVhc3Qgb25lIGZyYWdtZW50IGNvbnRhaW5zIFBUUyBpbmZvLCByZWNvbXB1dGUgUFRTIGluZm9ybWF0aW9uIGZvciBhbGwgZnJhZ21lbnRzXG4gICAgaWYoUFRTRnJhZykge1xuICAgICAgTGV2ZWxIZWxwZXIudXBkYXRlRnJhZ1BUUyhuZXdEZXRhaWxzLFBUU0ZyYWcuc24sUFRTRnJhZy5zdGFydFBUUyxQVFNGcmFnLmVuZFBUUyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGFkanVzdCBzdGFydCBieSBzbGlkaW5nIG9mZnNldFxuICAgICAgdmFyIHNsaWRpbmcgPSBvbGRmcmFnbWVudHNbZGVsdGFdLnN0YXJ0O1xuICAgICAgZm9yKGkgPSAwIDsgaSA8IG5ld2ZyYWdtZW50cy5sZW5ndGggOyBpKyspIHtcbiAgICAgICAgbmV3ZnJhZ21lbnRzW2ldLnN0YXJ0ICs9IHNsaWRpbmc7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGlmIHdlIGFyZSBoZXJlLCBpdCBtZWFucyB3ZSBoYXZlIGZyYWdtZW50cyBvdmVybGFwcGluZyBiZXR3ZWVuXG4gICAgLy8gb2xkIGFuZCBuZXcgbGV2ZWwuIHJlbGlhYmxlIFBUUyBpbmZvIGlzIHRodXMgcmVseWluZyBvbiBvbGQgbGV2ZWxcbiAgICBuZXdEZXRhaWxzLlBUU0tub3duID0gb2xkRGV0YWlscy5QVFNLbm93bjtcbiAgICByZXR1cm47XG4gIH1cblxuICBzdGF0aWMgdXBkYXRlRnJhZ1BUUyhkZXRhaWxzLHNuLHN0YXJ0UFRTLGVuZFBUUykge1xuICAgIHZhciBmcmFnSWR4LCBmcmFnbWVudHMsIGZyYWcsIGk7XG4gICAgLy8gZXhpdCBpZiBzbiBvdXQgb2YgcmFuZ2VcbiAgICBpZiAoc24gPCBkZXRhaWxzLnN0YXJ0U04gfHwgc24gPiBkZXRhaWxzLmVuZFNOKSB7XG4gICAgICByZXR1cm4gMDtcbiAgICB9XG4gICAgZnJhZ0lkeCA9IHNuIC0gZGV0YWlscy5zdGFydFNOO1xuICAgIGZyYWdtZW50cyA9IGRldGFpbHMuZnJhZ21lbnRzO1xuICAgIGZyYWcgPSBmcmFnbWVudHNbZnJhZ0lkeF07XG5cblx0dmFyIHByZXZGcmFnID0gZnJhZ21lbnRzW2ZyYWdJZHggLSAxXTtcblx0dmFyIG5leHRGcmFnID0gZnJhZ21lbnRzW2ZyYWdJZHggKyAxXTtcblxuICAgIGlmKCFpc05hTihmcmFnLnN0YXJ0UFRTKSkge1xuICAgICAgc3RhcnRQVFMgPSBNYXRoLm1pbihzdGFydFBUUyxmcmFnLnN0YXJ0UFRTKTtcbiAgICAgIGVuZFBUUyA9IE1hdGgubWF4KGVuZFBUUywgZnJhZy5lbmRQVFMpO1xuICAgIH1cblxuXHRpZiggcHJldkZyYWcgJiYgTWF0aC5hYnMocHJldkZyYWcuc3RhcnQgLSBzdGFydFBUUykgPiAxMDApIHtcblx0XHRzdGFydFBUUyA9IHByZXZGcmFnLnN0YXJ0ICsgcHJldkZyYWcuZHVyYXRpb247XG5cdFx0Ly8gaWYgKGZyYWcuZHVyYXRpb24gPiAxMDApIGRlYnVnZ2VyO1xuXHRcdGVuZFBUUyA9IHN0YXJ0UFRTICsgZnJhZy5kdXJhdGlvbjtcblx0XHRjb25zb2xlLmluZm8oZnJhZy5zbiArICc6ICAnICsgc3RhcnRQVFMgKyAnIC0+ICcgKyBlbmRQVFMgKyAnIHwgJyArIGZyYWcuZHVyYXRpb24pO1xuXHRcdC8vIGRlYnVnZ2VyO1xuXHR9IGVsc2UgaWYoIG5leHRGcmFnICYmIE1hdGguYWJzKG5leHRGcmFnLnN0YXJ0IC0gc3RhcnRQVFMpID4gMTAwKSB7XG5cdFx0Ly8gc3RhcnRQVFMgPSBuZXh0RnJhZy5zdGFydCArIG5leHRGcmFnLmR1cmF0aW9uO1xuXHRcdC8vIGVuZFBUUyA9IHN0YXJ0UFRTICsgZnJhZy5kdXJhdGlvbjtcblx0XHQvLyBjb25zb2xlLmxvZyhmcmFnLnNuICsgJzogICcgKyBzdGFydFBUUyArICcgLT4gJyArIGVuZFBUUyArICcgfCAnICsgZnJhZy5kdXJhdGlvbik7XG5cdFx0Ly8gZGVidWdnZXI7XG5cdH1cblxuICAgaWYoIE1hdGguYWJzKHN0YXJ0UFRTIC0gZW5kUFRTKSA+IDEwMCkge1xuXHQgICB2YXIgb2xkX2VuZFBUUyA9IGVuZFBUUztcblx0ICAgZW5kUFRTID0gc3RhcnRQVFMgKyBmcmFnLmR1cmF0aW9uO1xuXHQgICBjb25zb2xlLmluZm8oJ2FkanVzdGluZyBlbmRQVFM6ICcgKyBvbGRfZW5kUFRTICsgJyAtPiAnICsgZW5kUFRTKTtcbiAgIH1cblxuICAgIHZhciBkcmlmdCA9IHN0YXJ0UFRTIC0gZnJhZy5zdGFydDtcblxuICAgIGZyYWcuc3RhcnQgPSBmcmFnLnN0YXJ0UFRTID0gc3RhcnRQVFM7XG4gICAgZnJhZy5lbmRQVFMgPSBlbmRQVFM7XG4gICAgZnJhZy5kdXJhdGlvbiA9IGVuZFBUUyAtIHN0YXJ0UFRTO1xuXG5cdC8vIGlmIChmcmFnLmR1cmF0aW9uID4gMTAwKSBkZWJ1Z2dlcjtcblx0XG4gICAgLy8gYWRqdXN0IGZyYWdtZW50IFBUUy9kdXJhdGlvbiBmcm9tIHNlcW51bS0xIHRvIGZyYWcgMFxuICAgIGZvcihpID0gZnJhZ0lkeCA7IGkgPiAwIDsgaS0tKSB7XG4gICAgICBMZXZlbEhlbHBlci51cGRhdGVQVFMoZnJhZ21lbnRzLGksaS0xKTtcbiAgICB9XG5cbiAgICAvLyBhZGp1c3QgZnJhZ21lbnQgUFRTL2R1cmF0aW9uIGZyb20gc2VxbnVtIHRvIGxhc3QgZnJhZ1xuICAgIGZvcihpID0gZnJhZ0lkeCA7IGkgPCBmcmFnbWVudHMubGVuZ3RoIC0gMSA7IGkrKykge1xuICAgICAgTGV2ZWxIZWxwZXIudXBkYXRlUFRTKGZyYWdtZW50cyxpLGkrMSk7XG4gICAgfVxuICAgIGRldGFpbHMuUFRTS25vd24gPSB0cnVlO1xuICAgIC8vbG9nZ2VyLmxvZyhgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcmFnIHN0YXJ0L2VuZDoke3N0YXJ0UFRTLnRvRml4ZWQoMyl9LyR7ZW5kUFRTLnRvRml4ZWQoMyl9YCk7XG5cbiAgICByZXR1cm4gZHJpZnQ7XG4gIH1cblxuICBzdGF0aWMgdXBkYXRlUFRTKGZyYWdtZW50cyxmcm9tSWR4LCB0b0lkeCkge1xuICAgIHZhciBmcmFnRnJvbSA9IGZyYWdtZW50c1tmcm9tSWR4XSxmcmFnVG8gPSBmcmFnbWVudHNbdG9JZHhdLCBmcmFnVG9QVFMgPSBmcmFnVG8uc3RhcnRQVFM7XG4gICAgLy8gaWYgd2Uga25vdyBzdGFydFBUU1t0b0lkeF1cbiAgICBpZighaXNOYU4oZnJhZ1RvUFRTKSkge1xuICAgICAgLy8gdXBkYXRlIGZyYWdtZW50IGR1cmF0aW9uLlxuICAgICAgLy8gaXQgaGVscHMgdG8gZml4IGRyaWZ0cyBiZXR3ZWVuIHBsYXlsaXN0IHJlcG9ydGVkIGR1cmF0aW9uIGFuZCBmcmFnbWVudCByZWFsIGR1cmF0aW9uXG4gICAgICBpZiAodG9JZHggPiBmcm9tSWR4KSB7XG4gICAgICAgIGZyYWdGcm9tLmR1cmF0aW9uID0gZnJhZ1RvUFRTLWZyYWdGcm9tLnN0YXJ0O1xuICAgICAgICBpZihmcmFnRnJvbS5kdXJhdGlvbiA8IDApIHtcbiAgICAgICAgICBsb2dnZXIuZXJyb3IoYG5lZ2F0aXZlIGR1cmF0aW9uIGNvbXB1dGVkIGZvciBmcmFnICR7ZnJhZ0Zyb20uc259LGxldmVsICR7ZnJhZ0Zyb20ubGV2ZWx9LCB0aGVyZSBzaG91bGQgYmUgc29tZSBkdXJhdGlvbiBkcmlmdCBiZXR3ZWVuIHBsYXlsaXN0IGFuZCBmcmFnbWVudCFgKTtcblx0XHQgIGRlYnVnZ2VyO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmcmFnVG8uZHVyYXRpb24gPSBmcmFnRnJvbS5zdGFydCAtIGZyYWdUb1BUUztcbiAgICAgICAgaWYoZnJhZ1RvLmR1cmF0aW9uIDwgMCkge1xuICAgICAgICAgIGxvZ2dlci5lcnJvcihgbmVnYXRpdmUgZHVyYXRpb24gY29tcHV0ZWQgZm9yIGZyYWcgJHtmcmFnVG8uc259LGxldmVsICR7ZnJhZ1RvLmxldmVsfSwgdGhlcmUgc2hvdWxkIGJlIHNvbWUgZHVyYXRpb24gZHJpZnQgYmV0d2VlbiBwbGF5bGlzdCBhbmQgZnJhZ21lbnQhYCk7XG5cdFx0ICBkZWJ1Z2dlcjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyB3ZSBkb250IGtub3cgc3RhcnRQVFNbdG9JZHhdXG4gICAgICBpZiAodG9JZHggPiBmcm9tSWR4KSB7XG4gICAgICAgIGZyYWdUby5zdGFydCA9IGZyYWdGcm9tLnN0YXJ0ICsgZnJhZ0Zyb20uZHVyYXRpb247XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmcmFnVG8uc3RhcnQgPSBmcmFnRnJvbS5zdGFydCAtIGZyYWdUby5kdXJhdGlvbjtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTGV2ZWxIZWxwZXI7XG4iLCIvKipcbiAqIEhMUyBpbnRlcmZhY2VcbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi9ldmVudHMnO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4vZXJyb3JzJztcbmltcG9ydCBQbGF5bGlzdExvYWRlciBmcm9tICcuL2xvYWRlci9wbGF5bGlzdC1sb2FkZXInO1xuaW1wb3J0IEZyYWdtZW50TG9hZGVyIGZyb20gJy4vbG9hZGVyL2ZyYWdtZW50LWxvYWRlcic7XG5pbXBvcnQgQWJyQ29udHJvbGxlciBmcm9tICAgICcuL2NvbnRyb2xsZXIvYWJyLWNvbnRyb2xsZXInO1xuaW1wb3J0IEJ1ZmZlckNvbnRyb2xsZXIgZnJvbSAgJy4vY29udHJvbGxlci9idWZmZXItY29udHJvbGxlcic7XG5pbXBvcnQgQ2FwTGV2ZWxDb250cm9sbGVyIGZyb20gICcuL2NvbnRyb2xsZXIvY2FwLWxldmVsLWNvbnRyb2xsZXInO1xuaW1wb3J0IFN0cmVhbUNvbnRyb2xsZXIgZnJvbSAgJy4vY29udHJvbGxlci9zdHJlYW0tY29udHJvbGxlcic7XG5pbXBvcnQgTGV2ZWxDb250cm9sbGVyIGZyb20gICcuL2NvbnRyb2xsZXIvbGV2ZWwtY29udHJvbGxlcic7XG5pbXBvcnQgVGltZWxpbmVDb250cm9sbGVyIGZyb20gJy4vY29udHJvbGxlci90aW1lbGluZS1jb250cm9sbGVyJztcbi8vaW1wb3J0IEZQU0NvbnRyb2xsZXIgZnJvbSAnLi9jb250cm9sbGVyL2Zwcy1jb250cm9sbGVyJztcbmltcG9ydCB7bG9nZ2VyLCBlbmFibGVMb2dzfSBmcm9tICcuL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQgWGhyTG9hZGVyIGZyb20gJy4vdXRpbHMveGhyLWxvYWRlcic7XG5pbXBvcnQgRXZlbnRFbWl0dGVyIGZyb20gJ2V2ZW50cyc7XG5pbXBvcnQgS2V5TG9hZGVyIGZyb20gJy4vbG9hZGVyL2tleS1sb2FkZXInO1xuXG5jbGFzcyBIbHMge1xuXG4gIHN0YXRpYyBpc1N1cHBvcnRlZCgpIHtcbiAgICByZXR1cm4gKHdpbmRvdy5NZWRpYVNvdXJjZSAmJiB3aW5kb3cuTWVkaWFTb3VyY2UuaXNUeXBlU3VwcG9ydGVkKCd2aWRlby9tcDQ7IGNvZGVjcz1cImF2YzEuNDJFMDFFLG1wNGEuNDAuMlwiJykpO1xuICB9XG5cbiAgc3RhdGljIGdldCBFdmVudHMoKSB7XG4gICAgcmV0dXJuIEV2ZW50O1xuICB9XG5cbiAgc3RhdGljIGdldCBFcnJvclR5cGVzKCkge1xuICAgIHJldHVybiBFcnJvclR5cGVzO1xuICB9XG5cbiAgc3RhdGljIGdldCBFcnJvckRldGFpbHMoKSB7XG4gICAgcmV0dXJuIEVycm9yRGV0YWlscztcbiAgfVxuXG4gIHN0YXRpYyBnZXQgRGVmYXVsdENvbmZpZygpIHtcbiAgICBpZighSGxzLmRlZmF1bHRDb25maWcpIHtcbiAgICAgICBIbHMuZGVmYXVsdENvbmZpZyA9IHtcbiAgICAgICAgICBhdXRvU3RhcnRMb2FkOiB0cnVlLFxuICAgICAgICAgIGRlYnVnOiB0cnVlLFxuICAgICAgICAgIGNhcExldmVsVG9QbGF5ZXJTaXplOiBmYWxzZSxcbiAgICAgICAgICBtYXhCdWZmZXJMZW5ndGg6IDMwLFxuICAgICAgICAgIG1heEJ1ZmZlclNpemU6IDYwICogMTAwMCAqIDEwMDAsXG4gICAgICAgICAgbWF4QnVmZmVySG9sZTogNSxcbiAgICAgICAgICBtYXhTZWVrSG9sZTogMixcbiAgICAgICAgICBtYXhGcmFnTG9va1VwVG9sZXJhbmNlIDogMC4yLFxuICAgICAgICAgIGxpdmVTeW5jRHVyYXRpb25Db3VudDozLFxuICAgICAgICAgIGxpdmVNYXhMYXRlbmN5RHVyYXRpb25Db3VudDogSW5maW5pdHksXG4gICAgICAgICAgbGl2ZVN5bmNEdXJhdGlvbjogdW5kZWZpbmVkLFxuICAgICAgICAgIGxpdmVNYXhMYXRlbmN5RHVyYXRpb246IHVuZGVmaW5lZCxcbiAgICAgICAgICBtYXhNYXhCdWZmZXJMZW5ndGg6IDYwMCxcbiAgICAgICAgICBlbmFibGVXb3JrZXI6IHRydWUsXG4gICAgICAgICAgZW5hYmxlU29mdHdhcmVBRVM6IHRydWUsXG4gICAgICAgICAgbWFuaWZlc3RMb2FkaW5nVGltZU91dDogMTAwMDAsXG4gICAgICAgICAgbWFuaWZlc3RMb2FkaW5nTWF4UmV0cnk6IDEsXG4gICAgICAgICAgbWFuaWZlc3RMb2FkaW5nUmV0cnlEZWxheTogMTAwMCxcbiAgICAgICAgICBsZXZlbExvYWRpbmdUaW1lT3V0OiAxMDAwMCxcbiAgICAgICAgICBsZXZlbExvYWRpbmdNYXhSZXRyeTogNCxcbiAgICAgICAgICBsZXZlbExvYWRpbmdSZXRyeURlbGF5OiAxMDAwLFxuICAgICAgICAgIGZyYWdMb2FkaW5nVGltZU91dDogMjAwMDAsXG4gICAgICAgICAgZnJhZ0xvYWRpbmdNYXhSZXRyeTogMjAsXG4gICAgICAgICAgZnJhZ0xvYWRpbmdSZXRyeURlbGF5OiAxMDAwLFxuICAgICAgICAgIGZyYWdMb2FkaW5nTG9vcFRocmVzaG9sZDogMyxcbiAgICAgICAgICBzdGFydEZyYWdQcmVmZXRjaCA6IGZhbHNlLFxuICAgICAgICAgIC8vIGZwc0Ryb3BwZWRNb25pdG9yaW5nUGVyaW9kOiA1MDAwLFxuICAgICAgICAgIC8vIGZwc0Ryb3BwZWRNb25pdG9yaW5nVGhyZXNob2xkOiAwLjIsXG4gICAgICAgICAgYXBwZW5kRXJyb3JNYXhSZXRyeTogMyxcbiAgICAgICAgICBsb2FkZXI6IFhockxvYWRlcixcbiAgICAgICAgICBmTG9hZGVyOiB1bmRlZmluZWQsXG4gICAgICAgICAgcExvYWRlcjogdW5kZWZpbmVkLFxuICAgICAgICAgIGFickNvbnRyb2xsZXIgOiBBYnJDb250cm9sbGVyLFxuICAgICAgICAgIGJ1ZmZlckNvbnRyb2xsZXIgOiBCdWZmZXJDb250cm9sbGVyLFxuICAgICAgICAgIGNhcExldmVsQ29udHJvbGxlciA6IENhcExldmVsQ29udHJvbGxlcixcbiAgICAgICAgICBzdHJlYW1Db250cm9sbGVyOiBTdHJlYW1Db250cm9sbGVyLFxuICAgICAgICAgIHRpbWVsaW5lQ29udHJvbGxlcjogVGltZWxpbmVDb250cm9sbGVyLFxuICAgICAgICAgIGVuYWJsZUNFQTcwOENhcHRpb25zOiB0cnVlLFxuICAgICAgICAgIGVuYWJsZU1QMlRQYXNzVGhyb3VnaCA6IGZhbHNlXG4gICAgICAgIH07XG4gICAgfVxuICAgIHJldHVybiBIbHMuZGVmYXVsdENvbmZpZztcbiAgfVxuXG4gIHN0YXRpYyBzZXQgRGVmYXVsdENvbmZpZyhkZWZhdWx0Q29uZmlnKSB7XG4gICAgSGxzLmRlZmF1bHRDb25maWcgPSBkZWZhdWx0Q29uZmlnO1xuICB9XG5cbiAgY29uc3RydWN0b3IoY29uZmlnID0ge30pIHtcbiAgICB2YXIgZGVmYXVsdENvbmZpZyA9IEhscy5EZWZhdWx0Q29uZmlnO1xuXG4gICAgaWYgKChjb25maWcubGl2ZVN5bmNEdXJhdGlvbkNvdW50IHx8IGNvbmZpZy5saXZlTWF4TGF0ZW5jeUR1cmF0aW9uQ291bnQpICYmIChjb25maWcubGl2ZVN5bmNEdXJhdGlvbiB8fCBjb25maWcubGl2ZU1heExhdGVuY3lEdXJhdGlvbikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSWxsZWdhbCBobHMuanMgY29uZmlnOiBkb25cXCd0IG1peCB1cCBsaXZlU3luY0R1cmF0aW9uQ291bnQvbGl2ZU1heExhdGVuY3lEdXJhdGlvbkNvdW50IGFuZCBsaXZlU3luY0R1cmF0aW9uL2xpdmVNYXhMYXRlbmN5RHVyYXRpb24nKTtcbiAgICB9XG5cbiAgICBmb3IgKHZhciBwcm9wIGluIGRlZmF1bHRDb25maWcpIHtcbiAgICAgICAgaWYgKHByb3AgaW4gY29uZmlnKSB7IGNvbnRpbnVlOyB9XG4gICAgICAgIGNvbmZpZ1twcm9wXSA9IGRlZmF1bHRDb25maWdbcHJvcF07XG4gICAgfVxuXG4gICAgaWYgKGNvbmZpZy5saXZlTWF4TGF0ZW5jeUR1cmF0aW9uQ291bnQgIT09IHVuZGVmaW5lZCAmJiBjb25maWcubGl2ZU1heExhdGVuY3lEdXJhdGlvbkNvdW50IDw9IGNvbmZpZy5saXZlU3luY0R1cmF0aW9uQ291bnQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSWxsZWdhbCBobHMuanMgY29uZmlnOiBcImxpdmVNYXhMYXRlbmN5RHVyYXRpb25Db3VudFwiIG11c3QgYmUgZ3QgXCJsaXZlU3luY0R1cmF0aW9uQ291bnRcIicpO1xuICAgIH1cblxuICAgIGlmIChjb25maWcubGl2ZU1heExhdGVuY3lEdXJhdGlvbiAhPT0gdW5kZWZpbmVkICYmIChjb25maWcubGl2ZU1heExhdGVuY3lEdXJhdGlvbiA8PSBjb25maWcubGl2ZVN5bmNEdXJhdGlvbiB8fCBjb25maWcubGl2ZVN5bmNEdXJhdGlvbiA9PT0gdW5kZWZpbmVkKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbGxlZ2FsIGhscy5qcyBjb25maWc6IFwibGl2ZU1heExhdGVuY3lEdXJhdGlvblwiIG11c3QgYmUgZ3QgXCJsaXZlU3luY0R1cmF0aW9uXCInKTtcbiAgICB9XG5cbiAgICBlbmFibGVMb2dzKGNvbmZpZy5kZWJ1Zyk7XG4gICAgdGhpcy5jb25maWcgPSBjb25maWc7XG4gICAgLy8gb2JzZXJ2ZXIgc2V0dXBcbiAgICB2YXIgb2JzZXJ2ZXIgPSB0aGlzLm9ic2VydmVyID0gbmV3IEV2ZW50RW1pdHRlcigpO1xuICAgIG9ic2VydmVyLnRyaWdnZXIgPSBmdW5jdGlvbiB0cmlnZ2VyIChldmVudCwgLi4uZGF0YSkge1xuICAgICAgb2JzZXJ2ZXIuZW1pdChldmVudCwgZXZlbnQsIC4uLmRhdGEpO1xuICAgIH07XG5cbiAgICBvYnNlcnZlci5vZmYgPSBmdW5jdGlvbiBvZmYgKGV2ZW50LCAuLi5kYXRhKSB7XG4gICAgICBvYnNlcnZlci5yZW1vdmVMaXN0ZW5lcihldmVudCwgLi4uZGF0YSk7XG4gICAgfTtcbiAgICB0aGlzLm9uID0gb2JzZXJ2ZXIub24uYmluZChvYnNlcnZlcik7XG4gICAgdGhpcy5vZmYgPSBvYnNlcnZlci5vZmYuYmluZChvYnNlcnZlcik7XG4gICAgdGhpcy50cmlnZ2VyID0gb2JzZXJ2ZXIudHJpZ2dlci5iaW5kKG9ic2VydmVyKTtcbiAgICB0aGlzLnBsYXlsaXN0TG9hZGVyID0gbmV3IFBsYXlsaXN0TG9hZGVyKHRoaXMpO1xuICAgIHRoaXMuZnJhZ21lbnRMb2FkZXIgPSBuZXcgRnJhZ21lbnRMb2FkZXIodGhpcyk7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIgPSBuZXcgTGV2ZWxDb250cm9sbGVyKHRoaXMpO1xuICAgIHRoaXMuYWJyQ29udHJvbGxlciA9IG5ldyBjb25maWcuYWJyQ29udHJvbGxlcih0aGlzKTtcbiAgICB0aGlzLmJ1ZmZlckNvbnRyb2xsZXIgPSBuZXcgY29uZmlnLmJ1ZmZlckNvbnRyb2xsZXIodGhpcyk7XG4gICAgdGhpcy5jYXBMZXZlbENvbnRyb2xsZXIgPSBuZXcgY29uZmlnLmNhcExldmVsQ29udHJvbGxlcih0aGlzKTtcbiAgICB0aGlzLnN0cmVhbUNvbnRyb2xsZXIgPSBuZXcgY29uZmlnLnN0cmVhbUNvbnRyb2xsZXIodGhpcyk7XG4gICAgdGhpcy50aW1lbGluZUNvbnRyb2xsZXIgPSBuZXcgY29uZmlnLnRpbWVsaW5lQ29udHJvbGxlcih0aGlzKTtcbiAgICB0aGlzLmtleUxvYWRlciA9IG5ldyBLZXlMb2FkZXIodGhpcyk7XG4gICAgLy90aGlzLmZwc0NvbnRyb2xsZXIgPSBuZXcgRlBTQ29udHJvbGxlcih0aGlzKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgbG9nZ2VyLmxvZygnZGVzdHJveScpO1xuICAgIHRoaXMudHJpZ2dlcihFdmVudC5ERVNUUk9ZSU5HKTtcbiAgICB0aGlzLmRldGFjaE1lZGlhKCk7XG4gICAgdGhpcy5wbGF5bGlzdExvYWRlci5kZXN0cm95KCk7XG4gICAgdGhpcy5mcmFnbWVudExvYWRlci5kZXN0cm95KCk7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIuZGVzdHJveSgpO1xuICAgIHRoaXMuYnVmZmVyQ29udHJvbGxlci5kZXN0cm95KCk7XG4gICAgdGhpcy5jYXBMZXZlbENvbnRyb2xsZXIuZGVzdHJveSgpO1xuICAgIHRoaXMuc3RyZWFtQ29udHJvbGxlci5kZXN0cm95KCk7XG4gICAgdGhpcy50aW1lbGluZUNvbnRyb2xsZXIuZGVzdHJveSgpO1xuICAgIHRoaXMua2V5TG9hZGVyLmRlc3Ryb3koKTtcbiAgICAvL3RoaXMuZnBzQ29udHJvbGxlci5kZXN0cm95KCk7XG4gICAgdGhpcy51cmwgPSBudWxsO1xuICAgIHRoaXMub2JzZXJ2ZXIucmVtb3ZlQWxsTGlzdGVuZXJzKCk7XG4gIH1cblxuICBhdHRhY2hNZWRpYShtZWRpYSkge1xuICAgIGxvZ2dlci5sb2coJ2F0dGFjaE1lZGlhJyk7XG4gICAgdGhpcy5tZWRpYSA9IG1lZGlhO1xuICAgIHRoaXMudHJpZ2dlcihFdmVudC5NRURJQV9BVFRBQ0hJTkcsIHttZWRpYTogbWVkaWF9KTtcbiAgfVxuXG4gIGRldGFjaE1lZGlhKCkge1xuICAgIGxvZ2dlci5sb2coJ2RldGFjaE1lZGlhJyk7XG4gICAgdGhpcy50cmlnZ2VyKEV2ZW50Lk1FRElBX0RFVEFDSElORyk7XG4gICAgdGhpcy5tZWRpYSA9IG51bGw7XG4gIH1cblxuICBsb2FkU291cmNlKHVybCkge1xuICAgIGxvZ2dlci5sb2coYGxvYWRTb3VyY2U6JHt1cmx9YCk7XG4gICAgdGhpcy51cmwgPSB1cmw7XG4gICAgLy8gd2hlbiBhdHRhY2hpbmcgdG8gYSBzb3VyY2UgVVJMLCB0cmlnZ2VyIGEgcGxheWxpc3QgbG9hZFxuICAgIHRoaXMudHJpZ2dlcihFdmVudC5NQU5JRkVTVF9MT0FESU5HLCB7dXJsOiB1cmx9KTtcbiAgfVxuXG4gIHN0YXJ0TG9hZChzdGFydFBvc2l0aW9uPTApIHtcbiAgICBsb2dnZXIubG9nKCdzdGFydExvYWQnKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5zdGFydExvYWQoKTtcbiAgICB0aGlzLnN0cmVhbUNvbnRyb2xsZXIuc3RhcnRMb2FkKHN0YXJ0UG9zaXRpb24pO1xuICB9XG5cbiAgc3RvcExvYWQoKSB7XG4gICAgbG9nZ2VyLmxvZygnc3RvcExvYWQnKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5zdG9wTG9hZCgpO1xuICAgIHRoaXMuc3RyZWFtQ29udHJvbGxlci5zdG9wTG9hZCgpO1xuICB9XG5cbiAgc3dhcEF1ZGlvQ29kZWMoKSB7XG4gICAgbG9nZ2VyLmxvZygnc3dhcEF1ZGlvQ29kZWMnKTtcbiAgICB0aGlzLnN0cmVhbUNvbnRyb2xsZXIuc3dhcEF1ZGlvQ29kZWMoKTtcbiAgfVxuXG4gIHJlY292ZXJNZWRpYUVycm9yKCkge1xuICAgIGxvZ2dlci5sb2coJ3JlY292ZXJNZWRpYUVycm9yJyk7XG4gICAgdmFyIG1lZGlhID0gdGhpcy5tZWRpYTtcbiAgICB0aGlzLmRldGFjaE1lZGlhKCk7XG4gICAgdGhpcy5hdHRhY2hNZWRpYShtZWRpYSk7XG4gIH1cblxuICAvKiogUmV0dXJuIGFsbCBxdWFsaXR5IGxldmVscyAqKi9cbiAgZ2V0IGxldmVscygpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIubGV2ZWxzO1xuICB9XG5cbiAgLyoqIFJldHVybiBjdXJyZW50IHBsYXliYWNrIHF1YWxpdHkgbGV2ZWwgKiovXG4gIGdldCBjdXJyZW50TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RyZWFtQ29udHJvbGxlci5jdXJyZW50TGV2ZWw7XG4gIH1cblxuICAvKiBzZXQgcXVhbGl0eSBsZXZlbCBpbW1lZGlhdGVseSAoLTEgZm9yIGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24pICovXG4gIHNldCBjdXJyZW50TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICBsb2dnZXIubG9nKGBzZXQgY3VycmVudExldmVsOiR7bmV3TGV2ZWx9YCk7XG4gICAgdGhpcy5sb2FkTGV2ZWwgPSBuZXdMZXZlbDtcbiAgICB0aGlzLnN0cmVhbUNvbnRyb2xsZXIuaW1tZWRpYXRlTGV2ZWxTd2l0Y2goKTtcbiAgfVxuXG4gIC8qKiBSZXR1cm4gbmV4dCBwbGF5YmFjayBxdWFsaXR5IGxldmVsIChxdWFsaXR5IGxldmVsIG9mIG5leHQgZnJhZ21lbnQpICoqL1xuICBnZXQgbmV4dExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLnN0cmVhbUNvbnRyb2xsZXIubmV4dExldmVsO1xuICB9XG5cbiAgLyogc2V0IHF1YWxpdHkgbGV2ZWwgZm9yIG5leHQgZnJhZ21lbnQgKC0xIGZvciBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uKSAqL1xuICBzZXQgbmV4dExldmVsKG5ld0xldmVsKSB7XG4gICAgbG9nZ2VyLmxvZyhgc2V0IG5leHRMZXZlbDoke25ld0xldmVsfWApO1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLm1hbnVhbExldmVsID0gbmV3TGV2ZWw7XG4gICAgdGhpcy5zdHJlYW1Db250cm9sbGVyLm5leHRMZXZlbFN3aXRjaCgpO1xuICB9XG5cbiAgLyoqIFJldHVybiB0aGUgcXVhbGl0eSBsZXZlbCBvZiBjdXJyZW50L2xhc3QgbG9hZGVkIGZyYWdtZW50ICoqL1xuICBnZXQgbG9hZExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLmxldmVsQ29udHJvbGxlci5sZXZlbDtcbiAgfVxuXG4gIC8qIHNldCBxdWFsaXR5IGxldmVsIGZvciBjdXJyZW50L25leHQgbG9hZGVkIGZyYWdtZW50ICgtMSBmb3IgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbikgKi9cbiAgc2V0IGxvYWRMZXZlbChuZXdMZXZlbCkge1xuICAgIGxvZ2dlci5sb2coYHNldCBsb2FkTGV2ZWw6JHtuZXdMZXZlbH1gKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5tYW51YWxMZXZlbCA9IG5ld0xldmVsO1xuICB9XG5cbiAgLyoqIFJldHVybiB0aGUgcXVhbGl0eSBsZXZlbCBvZiBuZXh0IGxvYWRlZCBmcmFnbWVudCAqKi9cbiAgZ2V0IG5leHRMb2FkTGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLm5leHRMb2FkTGV2ZWw7XG4gIH1cblxuICAvKiogc2V0IHF1YWxpdHkgbGV2ZWwgb2YgbmV4dCBsb2FkZWQgZnJhZ21lbnQgKiovXG4gIHNldCBuZXh0TG9hZExldmVsKGxldmVsKSB7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIubmV4dExvYWRMZXZlbCA9IGxldmVsO1xuICB9XG5cbiAgLyoqIFJldHVybiBmaXJzdCBsZXZlbCAoaW5kZXggb2YgZmlyc3QgbGV2ZWwgcmVmZXJlbmNlZCBpbiBtYW5pZmVzdClcbiAgKiovXG4gIGdldCBmaXJzdExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLmxldmVsQ29udHJvbGxlci5maXJzdExldmVsO1xuICB9XG5cbiAgLyoqIHNldCBmaXJzdCBsZXZlbCAoaW5kZXggb2YgZmlyc3QgbGV2ZWwgcmVmZXJlbmNlZCBpbiBtYW5pZmVzdClcbiAgKiovXG4gIHNldCBmaXJzdExldmVsKG5ld0xldmVsKSB7XG4gICAgbG9nZ2VyLmxvZyhgc2V0IGZpcnN0TGV2ZWw6JHtuZXdMZXZlbH1gKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5maXJzdExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICAvKiogUmV0dXJuIHN0YXJ0IGxldmVsIChsZXZlbCBvZiBmaXJzdCBmcmFnbWVudCB0aGF0IHdpbGwgYmUgcGxheWVkIGJhY2spXG4gICAgICBpZiBub3Qgb3ZlcnJpZGVkIGJ5IHVzZXIsIGZpcnN0IGxldmVsIGFwcGVhcmluZyBpbiBtYW5pZmVzdCB3aWxsIGJlIHVzZWQgYXMgc3RhcnQgbGV2ZWxcbiAgICAgIGlmIC0xIDogYXV0b21hdGljIHN0YXJ0IGxldmVsIHNlbGVjdGlvbiwgcGxheWJhY2sgd2lsbCBzdGFydCBmcm9tIGxldmVsIG1hdGNoaW5nIGRvd25sb2FkIGJhbmR3aWR0aCAoZGV0ZXJtaW5lZCBmcm9tIGRvd25sb2FkIG9mIGZpcnN0IHNlZ21lbnQpXG4gICoqL1xuICBnZXQgc3RhcnRMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIuc3RhcnRMZXZlbDtcbiAgfVxuXG4gIC8qKiBzZXQgIHN0YXJ0IGxldmVsIChsZXZlbCBvZiBmaXJzdCBmcmFnbWVudCB0aGF0IHdpbGwgYmUgcGxheWVkIGJhY2spXG4gICAgICBpZiBub3Qgb3ZlcnJpZGVkIGJ5IHVzZXIsIGZpcnN0IGxldmVsIGFwcGVhcmluZyBpbiBtYW5pZmVzdCB3aWxsIGJlIHVzZWQgYXMgc3RhcnQgbGV2ZWxcbiAgICAgIGlmIC0xIDogYXV0b21hdGljIHN0YXJ0IGxldmVsIHNlbGVjdGlvbiwgcGxheWJhY2sgd2lsbCBzdGFydCBmcm9tIGxldmVsIG1hdGNoaW5nIGRvd25sb2FkIGJhbmR3aWR0aCAoZGV0ZXJtaW5lZCBmcm9tIGRvd25sb2FkIG9mIGZpcnN0IHNlZ21lbnQpXG4gICoqL1xuICBzZXQgc3RhcnRMZXZlbChuZXdMZXZlbCkge1xuICAgIGxvZ2dlci5sb2coYHNldCBzdGFydExldmVsOiR7bmV3TGV2ZWx9YCk7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIuc3RhcnRMZXZlbCA9IG5ld0xldmVsO1xuICB9XG5cbiAgLyoqIFJldHVybiB0aGUgY2FwcGluZy9tYXggbGV2ZWwgdmFsdWUgdGhhdCBjb3VsZCBiZSB1c2VkIGJ5IGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24gYWxnb3JpdGhtICoqL1xuICBnZXQgYXV0b0xldmVsQ2FwcGluZygpIHtcbiAgICByZXR1cm4gdGhpcy5hYnJDb250cm9sbGVyLmF1dG9MZXZlbENhcHBpbmc7XG4gIH1cblxuICAvKiogc2V0IHRoZSBjYXBwaW5nL21heCBsZXZlbCB2YWx1ZSB0aGF0IGNvdWxkIGJlIHVzZWQgYnkgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBhbGdvcml0aG0gKiovXG4gIHNldCBhdXRvTGV2ZWxDYXBwaW5nKG5ld0xldmVsKSB7XG4gICAgbG9nZ2VyLmxvZyhgc2V0IGF1dG9MZXZlbENhcHBpbmc6JHtuZXdMZXZlbH1gKTtcbiAgICB0aGlzLmFickNvbnRyb2xsZXIuYXV0b0xldmVsQ2FwcGluZyA9IG5ld0xldmVsO1xuICB9XG5cbiAgLyogY2hlY2sgaWYgd2UgYXJlIGluIGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24gbW9kZSAqL1xuICBnZXQgYXV0b0xldmVsRW5hYmxlZCgpIHtcbiAgICByZXR1cm4gKHRoaXMubGV2ZWxDb250cm9sbGVyLm1hbnVhbExldmVsID09PSAtMSk7XG4gIH1cblxuICAvKiByZXR1cm4gbWFudWFsIGxldmVsICovXG4gIGdldCBtYW51YWxMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIubWFudWFsTGV2ZWw7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgSGxzO1xuIiwiLy8gVGhpcyBpcyBtb3N0bHkgZm9yIHN1cHBvcnQgb2YgdGhlIGVzNiBtb2R1bGUgZXhwb3J0XG4vLyBzeW50YXggd2l0aCB0aGUgYmFiZWwgY29tcGlsZXIsIGl0IGxvb2tzIGxpa2UgaXQgZG9lc250IHN1cHBvcnRcbi8vIGZ1bmN0aW9uIGV4cG9ydHMgbGlrZSB3ZSBhcmUgdXNlZCB0byBpbiBub2RlL2NvbW1vbmpzXG5tb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vaGxzLmpzJykuZGVmYXVsdDtcblxuIiwiLypcbiAqIEZyYWdtZW50IExvYWRlclxuKi9cblxuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgRXZlbnRIYW5kbGVyIGZyb20gJy4uL2V2ZW50LWhhbmRsZXInO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5cbmNsYXNzIEZyYWdtZW50TG9hZGVyIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMpIHtcbiAgICBzdXBlcihobHMsIEV2ZW50LkZSQUdfTE9BRElORyk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIGlmICh0aGlzLmxvYWRlcikge1xuICAgICAgdGhpcy5sb2FkZXIuZGVzdHJveSgpO1xuICAgICAgdGhpcy5sb2FkZXIgPSBudWxsO1xuICAgIH1cbiAgICBFdmVudEhhbmRsZXIucHJvdG90eXBlLmRlc3Ryb3kuY2FsbCh0aGlzKTtcbiAgfVxuXG4gIG9uRnJhZ0xvYWRpbmcoZGF0YSkge1xuICAgIHZhciBmcmFnID0gZGF0YS5mcmFnO1xuICAgIHRoaXMuZnJhZyA9IGZyYWc7XG4gICAgdGhpcy5mcmFnLmxvYWRlZCA9IDA7XG4gICAgdmFyIGNvbmZpZyA9IHRoaXMuaGxzLmNvbmZpZztcbiAgICBmcmFnLmxvYWRlciA9IHRoaXMubG9hZGVyID0gdHlwZW9mKGNvbmZpZy5mTG9hZGVyKSAhPT0gJ3VuZGVmaW5lZCcgPyBuZXcgY29uZmlnLmZMb2FkZXIoY29uZmlnKSA6IG5ldyBjb25maWcubG9hZGVyKGNvbmZpZyk7XG4gICAgdGhpcy5sb2FkZXIubG9hZChmcmFnLnVybCwgJ2FycmF5YnVmZmVyJywgdGhpcy5sb2Fkc3VjY2Vzcy5iaW5kKHRoaXMpLCB0aGlzLmxvYWRlcnJvci5iaW5kKHRoaXMpLCB0aGlzLmxvYWR0aW1lb3V0LmJpbmQodGhpcyksIGNvbmZpZy5mcmFnTG9hZGluZ1RpbWVPdXQsIDEsIDAsIHRoaXMubG9hZHByb2dyZXNzLmJpbmQodGhpcyksIGZyYWcpO1xuICB9XG5cbiAgbG9hZHN1Y2Nlc3MoZXZlbnQsIHN0YXRzKSB7XG4gICAgdmFyIHBheWxvYWQgPSBldmVudC5jdXJyZW50VGFyZ2V0LnJlc3BvbnNlO1xuICAgIHN0YXRzLmxlbmd0aCA9IHBheWxvYWQuYnl0ZUxlbmd0aDtcbiAgICAvLyBkZXRhY2ggZnJhZ21lbnQgbG9hZGVyIG9uIGxvYWQgc3VjY2Vzc1xuICAgIHRoaXMuZnJhZy5sb2FkZXIgPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5GUkFHX0xPQURFRCwge3BheWxvYWQ6IHBheWxvYWQsIGZyYWc6IHRoaXMuZnJhZywgc3RhdHM6IHN0YXRzfSk7XG4gIH1cblxuICBsb2FkZXJyb3IoZXZlbnQpIHtcbiAgICBpZiAodGhpcy5sb2FkZXIpIHtcbiAgICAgIHRoaXMubG9hZGVyLmFib3J0KCk7XG4gICAgfVxuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5GUkFHX0xPQURfRVJST1IsIGZhdGFsOiBmYWxzZSwgZnJhZzogdGhpcy5mcmFnLCByZXNwb25zZTogZXZlbnR9KTtcbiAgfVxuXG4gIGxvYWR0aW1lb3V0KCkge1xuICAgIGlmICh0aGlzLmxvYWRlcikge1xuICAgICAgdGhpcy5sb2FkZXIuYWJvcnQoKTtcbiAgICB9XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTkVUV09SS19FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9USU1FT1VULCBmYXRhbDogZmFsc2UsIGZyYWc6IHRoaXMuZnJhZ30pO1xuICB9XG5cbiAgbG9hZHByb2dyZXNzKGV2ZW50LCBzdGF0cykge1xuICAgIHRoaXMuZnJhZy5sb2FkZWQgPSBzdGF0cy5sb2FkZWQ7XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5GUkFHX0xPQURfUFJPR1JFU1MsIHtmcmFnOiB0aGlzLmZyYWcsIHN0YXRzOiBzdGF0c30pO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEZyYWdtZW50TG9hZGVyO1xuIiwiLypcbiAqIERlY3J5cHQga2V5IExvYWRlclxuKi9cblxuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgRXZlbnRIYW5kbGVyIGZyb20gJy4uL2V2ZW50LWhhbmRsZXInO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5cbmNsYXNzIEtleUxvYWRlciBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgc3VwZXIoaGxzLCBFdmVudC5LRVlfTE9BRElORyk7XG4gICAgdGhpcy5kZWNyeXB0a2V5ID0gbnVsbDtcbiAgICB0aGlzLmRlY3J5cHR1cmwgPSBudWxsO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBpZiAodGhpcy5sb2FkZXIpIHtcbiAgICAgIHRoaXMubG9hZGVyLmRlc3Ryb3koKTtcbiAgICAgIHRoaXMubG9hZGVyID0gbnVsbDtcbiAgICB9XG4gICAgRXZlbnRIYW5kbGVyLnByb3RvdHlwZS5kZXN0cm95LmNhbGwodGhpcyk7XG4gIH1cblxuICBvbktleUxvYWRpbmcoZGF0YSkge1xuICAgIHZhciBmcmFnID0gdGhpcy5mcmFnID0gZGF0YS5mcmFnLFxuICAgICAgICBkZWNyeXB0ZGF0YSA9IGZyYWcuZGVjcnlwdGRhdGEsXG4gICAgICAgIHVyaSA9IGRlY3J5cHRkYXRhLnVyaTtcbiAgICAgICAgLy8gaWYgdXJpIGlzIGRpZmZlcmVudCBmcm9tIHByZXZpb3VzIG9uZSBvciBpZiBkZWNyeXB0IGtleSBub3QgcmV0cmlldmVkIHlldFxuICAgICAgaWYgKHVyaSAhPT0gdGhpcy5kZWNyeXB0dXJsIHx8IHRoaXMuZGVjcnlwdGtleSA9PT0gbnVsbCkge1xuICAgICAgICB2YXIgY29uZmlnID0gdGhpcy5obHMuY29uZmlnO1xuICAgICAgICBmcmFnLmxvYWRlciA9IHRoaXMubG9hZGVyID0gbmV3IGNvbmZpZy5sb2FkZXIoY29uZmlnKTtcbiAgICAgICAgdGhpcy5kZWNyeXB0dXJsID0gdXJpO1xuICAgICAgICB0aGlzLmRlY3J5cHRrZXkgPSBudWxsO1xuICAgICAgICBmcmFnLmxvYWRlci5sb2FkKHVyaSwgJ2FycmF5YnVmZmVyJywgdGhpcy5sb2Fkc3VjY2Vzcy5iaW5kKHRoaXMpLCB0aGlzLmxvYWRlcnJvci5iaW5kKHRoaXMpLCB0aGlzLmxvYWR0aW1lb3V0LmJpbmQodGhpcyksIGNvbmZpZy5mcmFnTG9hZGluZ1RpbWVPdXQsIGNvbmZpZy5mcmFnTG9hZGluZ01heFJldHJ5LCBjb25maWcuZnJhZ0xvYWRpbmdSZXRyeURlbGF5LCB0aGlzLmxvYWRwcm9ncmVzcy5iaW5kKHRoaXMpLCBmcmFnKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5kZWNyeXB0a2V5KSB7XG4gICAgICAgIC8vIHdlIGFscmVhZHkgbG9hZGVkIHRoaXMga2V5LCByZXR1cm4gaXRcbiAgICAgICAgZGVjcnlwdGRhdGEua2V5ID0gdGhpcy5kZWNyeXB0a2V5O1xuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LktFWV9MT0FERUQsIHtmcmFnOiBmcmFnfSk7XG4gICAgICB9XG4gIH1cblxuICBsb2Fkc3VjY2VzcyhldmVudCkge1xuICAgIHZhciBmcmFnID0gdGhpcy5mcmFnO1xuICAgIHRoaXMuZGVjcnlwdGtleSA9IGZyYWcuZGVjcnlwdGRhdGEua2V5ID0gbmV3IFVpbnQ4QXJyYXkoZXZlbnQuY3VycmVudFRhcmdldC5yZXNwb25zZSk7XG4gICAgLy8gZGV0YWNoIGZyYWdtZW50IGxvYWRlciBvbiBsb2FkIHN1Y2Nlc3NcbiAgICBmcmFnLmxvYWRlciA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LktFWV9MT0FERUQsIHtmcmFnOiBmcmFnfSk7XG4gIH1cblxuICBsb2FkZXJyb3IoZXZlbnQpIHtcbiAgICBpZiAodGhpcy5sb2FkZXIpIHtcbiAgICAgIHRoaXMubG9hZGVyLmFib3J0KCk7XG4gICAgfVxuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5LRVlfTE9BRF9FUlJPUiwgZmF0YWw6IGZhbHNlLCBmcmFnOiB0aGlzLmZyYWcsIHJlc3BvbnNlOiBldmVudH0pO1xuICB9XG5cbiAgbG9hZHRpbWVvdXQoKSB7XG4gICAgaWYgKHRoaXMubG9hZGVyKSB7XG4gICAgICB0aGlzLmxvYWRlci5hYm9ydCgpO1xuICAgIH1cbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5ORVRXT1JLX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuS0VZX0xPQURfVElNRU9VVCwgZmF0YWw6IGZhbHNlLCBmcmFnOiB0aGlzLmZyYWd9KTtcbiAgfVxuXG4gIGxvYWRwcm9ncmVzcygpIHtcblxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEtleUxvYWRlcjtcbiIsIi8qKlxuICogUGxheWxpc3QgTG9hZGVyXG4qL1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBFdmVudEhhbmRsZXIgZnJvbSAnLi4vZXZlbnQtaGFuZGxlcic7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcbmltcG9ydCBVUkxIZWxwZXIgZnJvbSAnLi4vdXRpbHMvdXJsJztcbmltcG9ydCBBdHRyTGlzdCBmcm9tICcuLi91dGlscy9hdHRyLWxpc3QnO1xuLy9pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuY2xhc3MgUGxheWxpc3RMb2FkZXIgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHN1cGVyKGhscyxcbiAgICAgIEV2ZW50Lk1BTklGRVNUX0xPQURJTkcsXG4gICAgICBFdmVudC5MRVZFTF9MT0FESU5HKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgaWYgKHRoaXMubG9hZGVyKSB7XG4gICAgICB0aGlzLmxvYWRlci5kZXN0cm95KCk7XG4gICAgICB0aGlzLmxvYWRlciA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMudXJsID0gdGhpcy5pZCA9IG51bGw7XG4gICAgRXZlbnRIYW5kbGVyLnByb3RvdHlwZS5kZXN0cm95LmNhbGwodGhpcyk7XG4gIH1cblxuICBvbk1hbmlmZXN0TG9hZGluZyhkYXRhKSB7XG4gICAgdGhpcy5sb2FkKGRhdGEudXJsLCBudWxsKTtcbiAgfVxuXG4gIG9uTGV2ZWxMb2FkaW5nKGRhdGEpIHtcbiAgICB0aGlzLmxvYWQoZGF0YS51cmwsIGRhdGEubGV2ZWwsIGRhdGEuaWQpO1xuICB9XG5cbiAgbG9hZCh1cmwsIGlkMSwgaWQyKSB7XG4gICAgdmFyIGNvbmZpZyA9IHRoaXMuaGxzLmNvbmZpZyxcbiAgICAgICAgcmV0cnksXG4gICAgICAgIHRpbWVvdXQsXG4gICAgICAgIHJldHJ5RGVsYXk7XG4gICAgdGhpcy51cmwgPSB1cmw7XG4gICAgdGhpcy5pZCA9IGlkMTtcbiAgICB0aGlzLmlkMiA9IGlkMjtcbiAgICBpZih0aGlzLmlkID09PSBudWxsKSB7XG4gICAgICByZXRyeSA9IGNvbmZpZy5tYW5pZmVzdExvYWRpbmdNYXhSZXRyeTtcbiAgICAgIHRpbWVvdXQgPSBjb25maWcubWFuaWZlc3RMb2FkaW5nVGltZU91dDtcbiAgICAgIHJldHJ5RGVsYXkgPSBjb25maWcubWFuaWZlc3RMb2FkaW5nUmV0cnlEZWxheTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0cnkgPSBjb25maWcubGV2ZWxMb2FkaW5nTWF4UmV0cnk7XG4gICAgICB0aW1lb3V0ID0gY29uZmlnLmxldmVsTG9hZGluZ1RpbWVPdXQ7XG4gICAgICByZXRyeURlbGF5ID0gY29uZmlnLmxldmVsTG9hZGluZ1JldHJ5RGVsYXk7XG4gICAgfVxuICAgIHRoaXMubG9hZGVyID0gdHlwZW9mKGNvbmZpZy5wTG9hZGVyKSAhPT0gJ3VuZGVmaW5lZCcgPyBuZXcgY29uZmlnLnBMb2FkZXIoY29uZmlnKSA6IG5ldyBjb25maWcubG9hZGVyKGNvbmZpZyk7XG4gICAgdGhpcy5sb2FkZXIubG9hZCh1cmwsICcnLCB0aGlzLmxvYWRzdWNjZXNzLmJpbmQodGhpcyksIHRoaXMubG9hZGVycm9yLmJpbmQodGhpcyksIHRoaXMubG9hZHRpbWVvdXQuYmluZCh0aGlzKSwgdGltZW91dCwgcmV0cnksIHJldHJ5RGVsYXkpO1xuICB9XG5cbiAgcmVzb2x2ZSh1cmwsIGJhc2VVcmwpIHtcbiAgICByZXR1cm4gVVJMSGVscGVyLmJ1aWxkQWJzb2x1dGVVUkwoYmFzZVVybCwgdXJsKTtcbiAgfVxuXG4gIHBhcnNlTWFzdGVyUGxheWxpc3Qoc3RyaW5nLCBiYXNldXJsKSB7XG4gICAgbGV0IGxldmVscyA9IFtdLCByZXN1bHQ7XG5cbiAgICAvLyBodHRwczovL3JlZ2V4MTAxLmNvbSBpcyB5b3VyIGZyaWVuZFxuICAgIGNvbnN0IHJlID0gLyNFWFQtWC1TVFJFQU0tSU5GOihbXlxcblxccl0qKVtcXHJcXG5dKyhbXlxcclxcbl0rKS9nO1xuICAgIHdoaWxlICgocmVzdWx0ID0gcmUuZXhlYyhzdHJpbmcpKSAhPSBudWxsKXtcbiAgICAgIGNvbnN0IGxldmVsID0ge307XG5cbiAgICAgIHZhciBhdHRycyA9IGxldmVsLmF0dHJzID0gbmV3IEF0dHJMaXN0KHJlc3VsdFsxXSk7XG4gICAgICBsZXZlbC51cmwgPSB0aGlzLnJlc29sdmUocmVzdWx0WzJdLCBiYXNldXJsKTtcblxuICAgICAgdmFyIHJlc29sdXRpb24gPSBhdHRycy5kZWNpbWFsUmVzb2x1dGlvbignUkVTT0xVVElPTicpO1xuICAgICAgaWYocmVzb2x1dGlvbikge1xuICAgICAgICBsZXZlbC53aWR0aCA9IHJlc29sdXRpb24ud2lkdGg7XG4gICAgICAgIGxldmVsLmhlaWdodCA9IHJlc29sdXRpb24uaGVpZ2h0O1xuICAgICAgfVxuICAgICAgbGV2ZWwuYml0cmF0ZSA9IGF0dHJzLmRlY2ltYWxJbnRlZ2VyKCdCQU5EV0lEVEgnKTtcbiAgICAgIGxldmVsLm5hbWUgPSBhdHRycy5OQU1FO1xuXG4gICAgICB2YXIgY29kZWNzID0gYXR0cnMuQ09ERUNTO1xuICAgICAgaWYoY29kZWNzKSB7XG4gICAgICAgIGNvZGVjcyA9IGNvZGVjcy5zcGxpdCgnLCcpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvZGVjcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGNvbnN0IGNvZGVjID0gY29kZWNzW2ldO1xuICAgICAgICAgIGlmIChjb2RlYy5pbmRleE9mKCdhdmMxJykgIT09IC0xKSB7XG4gICAgICAgICAgICBsZXZlbC52aWRlb0NvZGVjID0gdGhpcy5hdmMxdG9hdmNvdGkoY29kZWMpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsZXZlbC5hdWRpb0NvZGVjID0gY29kZWM7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGxldmVscy5wdXNoKGxldmVsKTtcbiAgICB9XG4gICAgcmV0dXJuIGxldmVscztcbiAgfVxuXG4gIGF2YzF0b2F2Y290aShjb2RlYykge1xuICAgIHZhciByZXN1bHQsIGF2Y2RhdGEgPSBjb2RlYy5zcGxpdCgnLicpO1xuICAgIGlmIChhdmNkYXRhLmxlbmd0aCA+IDIpIHtcbiAgICAgIHJlc3VsdCA9IGF2Y2RhdGEuc2hpZnQoKSArICcuJztcbiAgICAgIHJlc3VsdCArPSBwYXJzZUludChhdmNkYXRhLnNoaWZ0KCkpLnRvU3RyaW5nKDE2KTtcbiAgICAgIHJlc3VsdCArPSAoJzAwMCcgKyBwYXJzZUludChhdmNkYXRhLnNoaWZ0KCkpLnRvU3RyaW5nKDE2KSkuc3Vic3RyKC00KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0ID0gY29kZWM7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBjbG9uZU9iaihvYmopIHtcbiAgICByZXR1cm4gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShvYmopKTtcbiAgfVxuXG4gIHBhcnNlTGV2ZWxQbGF5bGlzdChzdHJpbmcsIGJhc2V1cmwsIGlkKSB7XG4gICAgdmFyIGN1cnJlbnRTTiA9IDAsXG4gICAgICAgIHRvdGFsZHVyYXRpb24gPSAwLFxuICAgICAgICBsZXZlbCA9IHt1cmw6IGJhc2V1cmwsIGZyYWdtZW50czogW10sIGxpdmU6IHRydWUsIHN0YXJ0U046IDB9LFxuICAgICAgICBsZXZlbGtleSA9IHttZXRob2QgOiBudWxsLCBrZXkgOiBudWxsLCBpdiA6IG51bGwsIHVyaSA6IG51bGx9LFxuICAgICAgICBjYyA9IDAsXG4gICAgICAgIHByb2dyYW1EYXRlVGltZSA9IG51bGwsXG4gICAgICAgIGZyYWcgPSBudWxsLFxuICAgICAgICByZXN1bHQsXG4gICAgICAgIHJlZ2V4cCxcbiAgICAgICAgYnl0ZVJhbmdlRW5kT2Zmc2V0LFxuICAgICAgICBieXRlUmFuZ2VTdGFydE9mZnNldCxcblx0XHRuZXh0VGltZXN0YW1wO1xuXG5cdHZhciByZSA9ICAvKFxcZCspX1xcZCsudHMvO1xuXG4gICAgcmVnZXhwID0gLyg/OiNFWFQtWC0oTUVESUEtU0VRVUVOQ0UpOihcXGQrKSl8KD86I0VYVC1YLShUQVJHRVREVVJBVElPTik6KFxcZCspKXwoPzojRVhULVgtKEtFWSk6KC4qKSl8KD86I0VYVChJTkYpOihbXFxkXFwuXSspW15cXHJcXG5dKihbXFxyXFxuXStbXiN8XFxyXFxuXSspPyl8KD86I0VYVC1YLShCWVRFUkFOR0UpOihbXFxkXStbQFtcXGRdKildKltcXHJcXG5dKyhbXiN8XFxyXFxuXSspP3woPzojRVhULVgtKEVORExJU1QpKXwoPzojRVhULVgtKERJUylDT05USU5VSVRZKSl8KD86I0VYVC1YLShQUk9HUkFNLURBVEUtVElNRSk6KC4qKSkvZztcbiAgICB3aGlsZSAoKHJlc3VsdCA9IHJlZ2V4cC5leGVjKHN0cmluZykpICE9PSBudWxsKSB7XG4gICAgICByZXN1bHQuc2hpZnQoKTtcbiAgICAgIHJlc3VsdCA9IHJlc3VsdC5maWx0ZXIoZnVuY3Rpb24obikgeyByZXR1cm4gKG4gIT09IHVuZGVmaW5lZCk7IH0pO1xuICAgICAgc3dpdGNoIChyZXN1bHRbMF0pIHtcbiAgICAgICAgY2FzZSAnTUVESUEtU0VRVUVOQ0UnOlxuICAgICAgICAgIGN1cnJlbnRTTiA9IGxldmVsLnN0YXJ0U04gPSBwYXJzZUludChyZXN1bHRbMV0pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdUQVJHRVREVVJBVElPTic6XG4gICAgICAgICAgbGV2ZWwudGFyZ2V0ZHVyYXRpb24gPSBwYXJzZUZsb2F0KHJlc3VsdFsxXSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0VORExJU1QnOlxuICAgICAgICAgIGxldmVsLmxpdmUgPSBmYWxzZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnRElTJzpcbiAgICAgICAgICBjYysrO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdCWVRFUkFOR0UnOlxuICAgICAgICAgIHZhciBwYXJhbXMgPSByZXN1bHRbMV0uc3BsaXQoJ0AnKTtcbiAgICAgICAgICBpZiAocGFyYW1zLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgYnl0ZVJhbmdlU3RhcnRPZmZzZXQgPSBieXRlUmFuZ2VFbmRPZmZzZXQ7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGJ5dGVSYW5nZVN0YXJ0T2Zmc2V0ID0gcGFyc2VJbnQocGFyYW1zWzFdKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnl0ZVJhbmdlRW5kT2Zmc2V0ID0gcGFyc2VJbnQocGFyYW1zWzBdKSArIGJ5dGVSYW5nZVN0YXJ0T2Zmc2V0O1xuICAgICAgICAgIGlmIChmcmFnICYmICFmcmFnLnVybCkge1xuICAgICAgICAgICAgZnJhZy5ieXRlUmFuZ2VTdGFydE9mZnNldCA9IGJ5dGVSYW5nZVN0YXJ0T2Zmc2V0O1xuICAgICAgICAgICAgZnJhZy5ieXRlUmFuZ2VFbmRPZmZzZXQgPSBieXRlUmFuZ2VFbmRPZmZzZXQ7XG4gICAgICAgICAgICBmcmFnLnVybCA9IHRoaXMucmVzb2x2ZShyZXN1bHRbMl0sIGJhc2V1cmwpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnSU5GJzpcbiAgICAgICAgICB2YXIgZHVyYXRpb24gPSBwYXJzZUZsb2F0KHJlc3VsdFsxXSk7XG4gICAgICAgICAgaWYgKCFpc05hTihkdXJhdGlvbikpIHtcbiAgICAgICAgICAgIHZhciBmcmFnZGVjcnlwdGRhdGEsXG4gICAgICAgICAgICAgICAgc24gPSBjdXJyZW50U04rKztcbiAgICAgICAgICAgIGlmIChsZXZlbGtleS5tZXRob2QgJiYgbGV2ZWxrZXkudXJpICYmICFsZXZlbGtleS5pdikge1xuICAgICAgICAgICAgICBmcmFnZGVjcnlwdGRhdGEgPSB0aGlzLmNsb25lT2JqKGxldmVsa2V5KTtcbiAgICAgICAgICAgICAgdmFyIHVpbnQ4VmlldyA9IG5ldyBVaW50OEFycmF5KDE2KTtcbiAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDEyOyBpIDwgMTY7IGkrKykge1xuICAgICAgICAgICAgICAgIHVpbnQ4Vmlld1tpXSA9IChzbiA+PiA4KigxNS1pKSkgJiAweGZmO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGZyYWdkZWNyeXB0ZGF0YS5pdiA9IHVpbnQ4VmlldztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGZyYWdkZWNyeXB0ZGF0YSA9IGxldmVsa2V5O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIHVybCA9IHJlc3VsdFsyXSA/IHRoaXMucmVzb2x2ZShyZXN1bHRbMl0sIGJhc2V1cmwpIDogbnVsbDtcblxuXHRcdFx0dmFyIG1hdGNoID0gcmUuZXhlYyggdXJsICk7XG5cdFx0XHR2YXIgdGltZXN0YW1wID0gKG1hdGNoICYmIG1hdGNoWzFdKSA/IG1hdGNoWzFdIDogbnVsbDtcblxuXHRcdFx0Ly8gaWYgKHRpbWVzdGFtcCAmJiBuZXh0VGltZXN0YW1wKSB7XG5cdFx0XHQvLyBcdHRpbWVzdGFtcCA9IHBhcnNlSW50KCB0aW1lc3RhbXAgKTtcblx0XHRcdC8vIFx0aWYgKCB0aW1lc3RhbXAgLSBuZXh0VGltZXN0YW1wID4gMjAwMCApIHtcblx0XHRcdC8vIFx0XHRjb25zb2xlLmxvZyggdGltZXN0YW1wICsgJyAnICsgbmV4dFRpbWVzdGFtcCArICcgJyArIHVybCApO1xuXHRcdFx0Ly8gXHRcdGNjKys7XG5cdFx0XHQvLyBcdH1cblx0XHRcdC8vIH1cblxuXHRcdFx0bmV4dFRpbWVzdGFtcCA9IHRpbWVzdGFtcCArIGR1cmF0aW9uKjEwMDA7XG5cbiAgICAgICAgICAgIGZyYWcgPSB7dXJsOiB1cmwsIGR1cmF0aW9uOiBkdXJhdGlvbiwgc3RhcnQ6IHRvdGFsZHVyYXRpb24sIHNuOiBzbiwgbGV2ZWw6IGlkLCBjYzogY2MsIGJ5dGVSYW5nZVN0YXJ0T2Zmc2V0OiBieXRlUmFuZ2VTdGFydE9mZnNldCwgYnl0ZVJhbmdlRW5kT2Zmc2V0OiBieXRlUmFuZ2VFbmRPZmZzZXQsIGRlY3J5cHRkYXRhIDogZnJhZ2RlY3J5cHRkYXRhLCBwcm9ncmFtRGF0ZVRpbWU6IHByb2dyYW1EYXRlVGltZX07XG4gICAgICAgICAgICBsZXZlbC5mcmFnbWVudHMucHVzaChmcmFnKTtcbiAgICAgICAgICAgIHRvdGFsZHVyYXRpb24gKz0gZHVyYXRpb247XG4gICAgICAgICAgICBieXRlUmFuZ2VTdGFydE9mZnNldCA9IG51bGw7XG4gICAgICAgICAgICBwcm9ncmFtRGF0ZVRpbWUgPSBudWxsO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnS0VZJzpcbiAgICAgICAgICAvLyBodHRwczovL3Rvb2xzLmlldGYub3JnL2h0bWwvZHJhZnQtcGFudG9zLWh0dHAtbGl2ZS1zdHJlYW1pbmctMDgjc2VjdGlvbi0zLjQuNFxuICAgICAgICAgIHZhciBkZWNyeXB0cGFyYW1zID0gcmVzdWx0WzFdO1xuICAgICAgICAgIHZhciBrZXlBdHRycyA9IG5ldyBBdHRyTGlzdChkZWNyeXB0cGFyYW1zKTtcbiAgICAgICAgICB2YXIgZGVjcnlwdG1ldGhvZCA9IGtleUF0dHJzLmVudW1lcmF0ZWRTdHJpbmcoJ01FVEhPRCcpLFxuICAgICAgICAgICAgICBkZWNyeXB0dXJpID0ga2V5QXR0cnMuVVJJLFxuICAgICAgICAgICAgICBkZWNyeXB0aXYgPSBrZXlBdHRycy5oZXhhZGVjaW1hbEludGVnZXIoJ0lWJyk7XG4gICAgICAgICAgaWYgKGRlY3J5cHRtZXRob2QpIHtcbiAgICAgICAgICAgIGxldmVsa2V5ID0geyBtZXRob2Q6IG51bGwsIGtleTogbnVsbCwgaXY6IG51bGwsIHVyaTogbnVsbCB9O1xuICAgICAgICAgICAgaWYgKChkZWNyeXB0dXJpKSAmJiAoZGVjcnlwdG1ldGhvZCA9PT0gJ0FFUy0xMjgnKSkge1xuICAgICAgICAgICAgICBsZXZlbGtleS5tZXRob2QgPSBkZWNyeXB0bWV0aG9kO1xuICAgICAgICAgICAgICAvLyBVUkkgdG8gZ2V0IHRoZSBrZXlcbiAgICAgICAgICAgICAgbGV2ZWxrZXkudXJpID0gdGhpcy5yZXNvbHZlKGRlY3J5cHR1cmksIGJhc2V1cmwpO1xuICAgICAgICAgICAgICBsZXZlbGtleS5rZXkgPSBudWxsO1xuICAgICAgICAgICAgICAvLyBJbml0aWFsaXphdGlvbiBWZWN0b3IgKElWKVxuICAgICAgICAgICAgICBsZXZlbGtleS5pdiA9IGRlY3J5cHRpdjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ1BST0dSQU0tREFURS1USU1FJzpcbiAgICAgICAgICBwcm9ncmFtRGF0ZVRpbWUgPSBuZXcgRGF0ZShEYXRlLnBhcnNlKHJlc3VsdFsxXSkpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICAvL2xvZ2dlci5sb2coJ2ZvdW5kICcgKyBsZXZlbC5mcmFnbWVudHMubGVuZ3RoICsgJyBmcmFnbWVudHMnKTtcbiAgICBpZihmcmFnICYmICFmcmFnLnVybCkge1xuICAgICAgbGV2ZWwuZnJhZ21lbnRzLnBvcCgpO1xuICAgICAgdG90YWxkdXJhdGlvbi09ZnJhZy5kdXJhdGlvbjtcbiAgICB9XG4gICAgbGV2ZWwudG90YWxkdXJhdGlvbiA9IHRvdGFsZHVyYXRpb247XG4gICAgbGV2ZWwuZW5kU04gPSBjdXJyZW50U04gLSAxO1xuICAgIHJldHVybiBsZXZlbDtcbiAgfVxuXG4gIGxvYWRzdWNjZXNzKGV2ZW50LCBzdGF0cykge1xuICAgIHZhciB0YXJnZXQgPSBldmVudC5jdXJyZW50VGFyZ2V0LFxuICAgICAgICBzdHJpbmcgPSB0YXJnZXQucmVzcG9uc2VUZXh0LFxuICAgICAgICB1cmwgPSB0YXJnZXQucmVzcG9uc2VVUkwsXG4gICAgICAgIGlkID0gdGhpcy5pZCxcbiAgICAgICAgaWQyID0gdGhpcy5pZDIsXG4gICAgICAgIGhscyA9IHRoaXMuaGxzLFxuICAgICAgICBsZXZlbHM7XG4gICAgLy8gcmVzcG9uc2VVUkwgbm90IHN1cHBvcnRlZCBvbiBzb21lIGJyb3dzZXJzIChpdCBpcyB1c2VkIHRvIGRldGVjdCBVUkwgcmVkaXJlY3Rpb24pXG4gICAgaWYgKHVybCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBmYWxsYmFjayB0byBpbml0aWFsIFVSTFxuICAgICAgdXJsID0gdGhpcy51cmw7XG4gICAgfVxuICAgIHN0YXRzLnRsb2FkID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgc3RhdHMubXRpbWUgPSBuZXcgRGF0ZSh0YXJnZXQuZ2V0UmVzcG9uc2VIZWFkZXIoJ0xhc3QtTW9kaWZpZWQnKSk7XG4gICAgaWYgKHN0cmluZy5pbmRleE9mKCcjRVhUTTNVJykgPT09IDApIHtcbiAgICAgIGlmIChzdHJpbmcuaW5kZXhPZignI0VYVElORjonKSA+IDApIHtcbiAgICAgICAgLy8gMSBsZXZlbCBwbGF5bGlzdFxuICAgICAgICAvLyBpZiBmaXJzdCByZXF1ZXN0LCBmaXJlIG1hbmlmZXN0IGxvYWRlZCBldmVudCwgbGV2ZWwgd2lsbCBiZSByZWxvYWRlZCBhZnRlcndhcmRzXG4gICAgICAgIC8vICh0aGlzIGlzIHRvIGhhdmUgYSB1bmlmb3JtIGxvZ2ljIGZvciAxIGxldmVsL211bHRpbGV2ZWwgcGxheWxpc3RzKVxuICAgICAgICBpZiAodGhpcy5pZCA9PT0gbnVsbCkge1xuICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50Lk1BTklGRVNUX0xPQURFRCwge2xldmVsczogW3t1cmw6IHVybH1dLCB1cmw6IHVybCwgc3RhdHM6IHN0YXRzfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFyIGxldmVsRGV0YWlscyA9IHRoaXMucGFyc2VMZXZlbFBsYXlsaXN0KHN0cmluZywgdXJsLCBpZCk7XG4gICAgICAgICAgc3RhdHMudHBhcnNlZCA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkxFVkVMX0xPQURFRCwge2RldGFpbHM6IGxldmVsRGV0YWlscywgbGV2ZWw6IGlkLCBpZDogaWQyLCBzdGF0czogc3RhdHN9KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGV2ZWxzID0gdGhpcy5wYXJzZU1hc3RlclBsYXlsaXN0KHN0cmluZywgdXJsKTtcbiAgICAgICAgLy8gbXVsdGkgbGV2ZWwgcGxheWxpc3QsIHBhcnNlIGxldmVsIGluZm9cbiAgICAgICAgaWYgKGxldmVscy5sZW5ndGgpIHtcbiAgICAgICAgICBobHMudHJpZ2dlcihFdmVudC5NQU5JRkVTVF9MT0FERUQsIHtsZXZlbHM6IGxldmVscywgdXJsOiB1cmwsIHN0YXRzOiBzdGF0c30pO1xuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5NQU5JRkVTVF9QQVJTSU5HX0VSUk9SLCBmYXRhbDogdHJ1ZSwgdXJsOiB1cmwsIHJlYXNvbjogJ25vIGxldmVsIGZvdW5kIGluIG1hbmlmZXN0J30pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5ORVRXT1JLX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuTUFOSUZFU1RfUEFSU0lOR19FUlJPUiwgZmF0YWw6IHRydWUsIHVybDogdXJsLCByZWFzb246ICdubyBFWFRNM1UgZGVsaW1pdGVyJ30pO1xuICAgIH1cbiAgfVxuXG4gIGxvYWRlcnJvcihldmVudCkge1xuICAgIHZhciBkZXRhaWxzLCBmYXRhbDtcbiAgICBpZiAodGhpcy5pZCA9PT0gbnVsbCkge1xuICAgICAgZGV0YWlscyA9IEVycm9yRGV0YWlscy5NQU5JRkVTVF9MT0FEX0VSUk9SO1xuICAgICAgZmF0YWwgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBkZXRhaWxzID0gRXJyb3JEZXRhaWxzLkxFVkVMX0xPQURfRVJST1I7XG4gICAgICBmYXRhbCA9IGZhbHNlO1xuICAgIH1cbiAgICBpZiAodGhpcy5sb2FkZXIpIHtcbiAgICAgIHRoaXMubG9hZGVyLmFib3J0KCk7XG4gICAgfVxuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHM6IGRldGFpbHMsIGZhdGFsOiBmYXRhbCwgdXJsOiB0aGlzLnVybCwgbG9hZGVyOiB0aGlzLmxvYWRlciwgcmVzcG9uc2U6IGV2ZW50LmN1cnJlbnRUYXJnZXQsIGxldmVsOiB0aGlzLmlkLCBpZDogdGhpcy5pZDJ9KTtcbiAgfVxuXG4gIGxvYWR0aW1lb3V0KCkge1xuICAgIHZhciBkZXRhaWxzLCBmYXRhbDtcbiAgICBpZiAodGhpcy5pZCA9PT0gbnVsbCkge1xuICAgICAgZGV0YWlscyA9IEVycm9yRGV0YWlscy5NQU5JRkVTVF9MT0FEX1RJTUVPVVQ7XG4gICAgICBmYXRhbCA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGRldGFpbHMgPSBFcnJvckRldGFpbHMuTEVWRUxfTE9BRF9USU1FT1VUO1xuICAgICAgZmF0YWwgPSBmYWxzZTtcbiAgICB9XG4gICAgaWYgKHRoaXMubG9hZGVyKSB7XG4gICAgICB0aGlzLmxvYWRlci5hYm9ydCgpO1xuICAgIH1cbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5ORVRXT1JLX0VSUk9SLCBkZXRhaWxzOiBkZXRhaWxzLCBmYXRhbDogZmF0YWwsIHVybDogdGhpcy51cmwsIGxvYWRlcjogdGhpcy5sb2FkZXIsIGxldmVsOiB0aGlzLmlkLCBpZDogdGhpcy5pZDJ9KTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBQbGF5bGlzdExvYWRlcjtcbiIsIi8qKlxuICogR2VuZXJhdGUgTVA0IEJveFxuKi9cblxuLy9pbXBvcnQgSGV4IGZyb20gJy4uL3V0aWxzL2hleCc7XG5jbGFzcyBNUDQge1xuICBzdGF0aWMgaW5pdCgpIHtcbiAgICBNUDQudHlwZXMgPSB7XG4gICAgICBhdmMxOiBbXSwgLy8gY29kaW5nbmFtZVxuICAgICAgYXZjQzogW10sXG4gICAgICBidHJ0OiBbXSxcbiAgICAgIGRpbmY6IFtdLFxuICAgICAgZHJlZjogW10sXG4gICAgICBlc2RzOiBbXSxcbiAgICAgIGZ0eXA6IFtdLFxuICAgICAgaGRscjogW10sXG4gICAgICBtZGF0OiBbXSxcbiAgICAgIG1kaGQ6IFtdLFxuICAgICAgbWRpYTogW10sXG4gICAgICBtZmhkOiBbXSxcbiAgICAgIG1pbmY6IFtdLFxuICAgICAgbW9vZjogW10sXG4gICAgICBtb292OiBbXSxcbiAgICAgIG1wNGE6IFtdLFxuICAgICAgbXZleDogW10sXG4gICAgICBtdmhkOiBbXSxcbiAgICAgIHNkdHA6IFtdLFxuICAgICAgc3RibDogW10sXG4gICAgICBzdGNvOiBbXSxcbiAgICAgIHN0c2M6IFtdLFxuICAgICAgc3RzZDogW10sXG4gICAgICBzdHN6OiBbXSxcbiAgICAgIHN0dHM6IFtdLFxuICAgICAgdGZkdDogW10sXG4gICAgICB0ZmhkOiBbXSxcbiAgICAgIHRyYWY6IFtdLFxuICAgICAgdHJhazogW10sXG4gICAgICB0cnVuOiBbXSxcbiAgICAgIHRyZXg6IFtdLFxuICAgICAgdGtoZDogW10sXG4gICAgICB2bWhkOiBbXSxcbiAgICAgIHNtaGQ6IFtdXG4gICAgfTtcblxuICAgIHZhciBpO1xuICAgIGZvciAoaSBpbiBNUDQudHlwZXMpIHtcbiAgICAgIGlmIChNUDQudHlwZXMuaGFzT3duUHJvcGVydHkoaSkpIHtcbiAgICAgICAgTVA0LnR5cGVzW2ldID0gW1xuICAgICAgICAgIGkuY2hhckNvZGVBdCgwKSxcbiAgICAgICAgICBpLmNoYXJDb2RlQXQoMSksXG4gICAgICAgICAgaS5jaGFyQ29kZUF0KDIpLFxuICAgICAgICAgIGkuY2hhckNvZGVBdCgzKVxuICAgICAgICBdO1xuICAgICAgfVxuICAgIH1cblxuICAgIHZhciB2aWRlb0hkbHIgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBwcmVfZGVmaW5lZFxuICAgICAgMHg3NiwgMHg2OSwgMHg2NCwgMHg2NSwgLy8gaGFuZGxlcl90eXBlOiAndmlkZSdcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4NTYsIDB4NjksIDB4NjQsIDB4NjUsXG4gICAgICAweDZmLCAweDQ4LCAweDYxLCAweDZlLFxuICAgICAgMHg2NCwgMHg2YywgMHg2NSwgMHg3MiwgMHgwMCAvLyBuYW1lOiAnVmlkZW9IYW5kbGVyJ1xuICAgIF0pO1xuXG4gICAgdmFyIGF1ZGlvSGRsciA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAweDczLCAweDZmLCAweDc1LCAweDZlLCAvLyBoYW5kbGVyX3R5cGU6ICdzb3VuJ1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHg1MywgMHg2ZiwgMHg3NSwgMHg2ZSxcbiAgICAgIDB4NjQsIDB4NDgsIDB4NjEsIDB4NmUsXG4gICAgICAweDY0LCAweDZjLCAweDY1LCAweDcyLCAweDAwIC8vIG5hbWU6ICdTb3VuZEhhbmRsZXInXG4gICAgXSk7XG5cbiAgICBNUDQuSERMUl9UWVBFUyA9IHtcbiAgICAgICd2aWRlbyc6IHZpZGVvSGRscixcbiAgICAgICdhdWRpbyc6IGF1ZGlvSGRsclxuICAgIH07XG5cbiAgICB2YXIgZHJlZiA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDEsIC8vIGVudHJ5X2NvdW50XG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDBjLCAvLyBlbnRyeV9zaXplXG4gICAgICAweDc1LCAweDcyLCAweDZjLCAweDIwLCAvLyAndXJsJyB0eXBlXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDEgLy8gZW50cnlfZmxhZ3NcbiAgICBdKTtcblxuICAgIHZhciBzdGNvID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAgLy8gZW50cnlfY291bnRcbiAgICBdKTtcblxuICAgIE1QNC5TVFRTID0gTVA0LlNUU0MgPSBNUDQuU1RDTyA9IHN0Y287XG5cbiAgICBNUDQuU1RTWiA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBzYW1wbGVfc2l6ZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gc2FtcGxlX2NvdW50XG4gICAgXSk7XG4gICAgTVA0LlZNSEQgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uXG4gICAgICAweDAwLCAweDAwLCAweDAxLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgLy8gZ3JhcGhpY3Ntb2RlXG4gICAgICAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAgLy8gb3Bjb2xvclxuICAgIF0pO1xuICAgIE1QNC5TTUhEID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIC8vIGJhbGFuY2VcbiAgICAgIDB4MDAsIDB4MDAgLy8gcmVzZXJ2ZWRcbiAgICBdKTtcblxuICAgIE1QNC5TVFNEID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMV0pOy8vIGVudHJ5X2NvdW50XG5cbiAgICB2YXIgbWFqb3JCcmFuZCA9IG5ldyBVaW50OEFycmF5KFsxMDUsMTE1LDExMSwxMDldKTsgLy8gaXNvbVxuICAgIHZhciBhdmMxQnJhbmQgPSBuZXcgVWludDhBcnJheShbOTcsMTE4LDk5LDQ5XSk7IC8vIGF2YzFcbiAgICB2YXIgbWlub3JWZXJzaW9uID0gbmV3IFVpbnQ4QXJyYXkoWzAsIDAsIDAsIDFdKTtcblxuICAgIE1QNC5GVFlQID0gTVA0LmJveChNUDQudHlwZXMuZnR5cCwgbWFqb3JCcmFuZCwgbWlub3JWZXJzaW9uLCBtYWpvckJyYW5kLCBhdmMxQnJhbmQpO1xuICAgIE1QNC5ESU5GID0gTVA0LmJveChNUDQudHlwZXMuZGluZiwgTVA0LmJveChNUDQudHlwZXMuZHJlZiwgZHJlZikpO1xuICB9XG5cbiAgc3RhdGljIGJveCh0eXBlKSB7XG4gIHZhclxuICAgIHBheWxvYWQgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpLFxuICAgIHNpemUgPSA4LFxuICAgIGkgPSBwYXlsb2FkLmxlbmd0aCxcbiAgICBsZW4gPSBpLFxuICAgIHJlc3VsdDtcbiAgICAvLyBjYWxjdWxhdGUgdGhlIHRvdGFsIHNpemUgd2UgbmVlZCB0byBhbGxvY2F0ZVxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIHNpemUgKz0gcGF5bG9hZFtpXS5ieXRlTGVuZ3RoO1xuICAgIH1cbiAgICByZXN1bHQgPSBuZXcgVWludDhBcnJheShzaXplKTtcbiAgICByZXN1bHRbMF0gPSAoc2l6ZSA+PiAyNCkgJiAweGZmO1xuICAgIHJlc3VsdFsxXSA9IChzaXplID4+IDE2KSAmIDB4ZmY7XG4gICAgcmVzdWx0WzJdID0gKHNpemUgPj4gOCkgJiAweGZmO1xuICAgIHJlc3VsdFszXSA9IHNpemUgICYgMHhmZjtcbiAgICByZXN1bHQuc2V0KHR5cGUsIDQpO1xuICAgIC8vIGNvcHkgdGhlIHBheWxvYWQgaW50byB0aGUgcmVzdWx0XG4gICAgZm9yIChpID0gMCwgc2l6ZSA9IDg7IGkgPCBsZW47IGkrKykge1xuICAgICAgLy8gY29weSBwYXlsb2FkW2ldIGFycmF5IEAgb2Zmc2V0IHNpemVcbiAgICAgIHJlc3VsdC5zZXQocGF5bG9hZFtpXSwgc2l6ZSk7XG4gICAgICBzaXplICs9IHBheWxvYWRbaV0uYnl0ZUxlbmd0aDtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHN0YXRpYyBoZGxyKHR5cGUpIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuaGRsciwgTVA0LkhETFJfVFlQRVNbdHlwZV0pO1xuICB9XG5cbiAgc3RhdGljIG1kYXQoZGF0YSkge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tZGF0LCBkYXRhKTtcbiAgfVxuXG4gIHN0YXRpYyBtZGhkKHRpbWVzY2FsZSwgZHVyYXRpb24pIHtcbiAgICBkdXJhdGlvbiAqPSB0aW1lc2NhbGU7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1kaGQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDIsIC8vIGNyZWF0aW9uX3RpbWVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDMsIC8vIG1vZGlmaWNhdGlvbl90aW1lXG4gICAgICAodGltZXNjYWxlID4+IDI0KSAmIDB4RkYsXG4gICAgICAodGltZXNjYWxlID4+IDE2KSAmIDB4RkYsXG4gICAgICAodGltZXNjYWxlID4+ICA4KSAmIDB4RkYsXG4gICAgICB0aW1lc2NhbGUgJiAweEZGLCAvLyB0aW1lc2NhbGVcbiAgICAgIChkdXJhdGlvbiA+PiAyNCksXG4gICAgICAoZHVyYXRpb24gPj4gMTYpICYgMHhGRixcbiAgICAgIChkdXJhdGlvbiA+PiAgOCkgJiAweEZGLFxuICAgICAgZHVyYXRpb24gJiAweEZGLCAvLyBkdXJhdGlvblxuICAgICAgMHg1NSwgMHhjNCwgLy8gJ3VuZCcgbGFuZ3VhZ2UgKHVuZGV0ZXJtaW5lZClcbiAgICAgIDB4MDAsIDB4MDBcbiAgICBdKSk7XG4gIH1cblxuICBzdGF0aWMgbWRpYSh0cmFjaykge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tZGlhLCBNUDQubWRoZCh0cmFjay50aW1lc2NhbGUsIHRyYWNrLmR1cmF0aW9uKSwgTVA0LmhkbHIodHJhY2sudHlwZSksIE1QNC5taW5mKHRyYWNrKSk7XG4gIH1cblxuICBzdGF0aWMgbWZoZChzZXF1ZW5jZU51bWJlcikge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tZmhkLCBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIChzZXF1ZW5jZU51bWJlciA+PiAyNCksXG4gICAgICAoc2VxdWVuY2VOdW1iZXIgPj4gMTYpICYgMHhGRixcbiAgICAgIChzZXF1ZW5jZU51bWJlciA+PiAgOCkgJiAweEZGLFxuICAgICAgc2VxdWVuY2VOdW1iZXIgJiAweEZGLCAvLyBzZXF1ZW5jZV9udW1iZXJcbiAgICBdKSk7XG4gIH1cblxuICBzdGF0aWMgbWluZih0cmFjaykge1xuICAgIGlmICh0cmFjay50eXBlID09PSAnYXVkaW8nKSB7XG4gICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWluZiwgTVA0LmJveChNUDQudHlwZXMuc21oZCwgTVA0LlNNSEQpLCBNUDQuRElORiwgTVA0LnN0YmwodHJhY2spKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1pbmYsIE1QNC5ib3goTVA0LnR5cGVzLnZtaGQsIE1QNC5WTUhEKSwgTVA0LkRJTkYsIE1QNC5zdGJsKHRyYWNrKSk7XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIG1vb2Yoc24sIGJhc2VNZWRpYURlY29kZVRpbWUsIHRyYWNrKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1vb2YsIE1QNC5tZmhkKHNuKSwgTVA0LnRyYWYodHJhY2ssYmFzZU1lZGlhRGVjb2RlVGltZSkpO1xuICB9XG4vKipcbiAqIEBwYXJhbSB0cmFja3MuLi4gKG9wdGlvbmFsKSB7YXJyYXl9IHRoZSB0cmFja3MgYXNzb2NpYXRlZCB3aXRoIHRoaXMgbW92aWVcbiAqL1xuICBzdGF0aWMgbW9vdih0cmFja3MpIHtcbiAgICB2YXJcbiAgICAgIGkgPSB0cmFja3MubGVuZ3RoLFxuICAgICAgYm94ZXMgPSBbXTtcblxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIGJveGVzW2ldID0gTVA0LnRyYWsodHJhY2tzW2ldKTtcbiAgICB9XG5cbiAgICByZXR1cm4gTVA0LmJveC5hcHBseShudWxsLCBbTVA0LnR5cGVzLm1vb3YsIE1QNC5tdmhkKHRyYWNrc1swXS50aW1lc2NhbGUsIHRyYWNrc1swXS5kdXJhdGlvbildLmNvbmNhdChib3hlcykuY29uY2F0KE1QNC5tdmV4KHRyYWNrcykpKTtcbiAgfVxuXG4gIHN0YXRpYyBtdmV4KHRyYWNrcykge1xuICAgIHZhclxuICAgICAgaSA9IHRyYWNrcy5sZW5ndGgsXG4gICAgICBib3hlcyA9IFtdO1xuXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgYm94ZXNbaV0gPSBNUDQudHJleCh0cmFja3NbaV0pO1xuICAgIH1cbiAgICByZXR1cm4gTVA0LmJveC5hcHBseShudWxsLCBbTVA0LnR5cGVzLm12ZXhdLmNvbmNhdChib3hlcykpO1xuICB9XG5cbiAgc3RhdGljIG12aGQodGltZXNjYWxlLGR1cmF0aW9uKSB7XG4gICAgZHVyYXRpb24qPXRpbWVzY2FsZTtcbiAgICB2YXJcbiAgICAgIGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMSwgLy8gY3JlYXRpb25fdGltZVxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAyLCAvLyBtb2RpZmljYXRpb25fdGltZVxuICAgICAgICAodGltZXNjYWxlID4+IDI0KSAmIDB4RkYsXG4gICAgICAgICh0aW1lc2NhbGUgPj4gMTYpICYgMHhGRixcbiAgICAgICAgKHRpbWVzY2FsZSA+PiAgOCkgJiAweEZGLFxuICAgICAgICB0aW1lc2NhbGUgJiAweEZGLCAvLyB0aW1lc2NhbGVcbiAgICAgICAgKGR1cmF0aW9uID4+IDI0KSAmIDB4RkYsXG4gICAgICAgIChkdXJhdGlvbiA+PiAxNikgJiAweEZGLFxuICAgICAgICAoZHVyYXRpb24gPj4gIDgpICYgMHhGRixcbiAgICAgICAgZHVyYXRpb24gJiAweEZGLCAvLyBkdXJhdGlvblxuICAgICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLCAvLyAxLjAgcmF0ZVxuICAgICAgICAweDAxLCAweDAwLCAvLyAxLjAgdm9sdW1lXG4gICAgICAgIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4NDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHRyYW5zZm9ybWF0aW9uOiB1bml0eSBtYXRyaXhcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcHJlX2RlZmluZWRcbiAgICAgICAgMHhmZiwgMHhmZiwgMHhmZiwgMHhmZiAvLyBuZXh0X3RyYWNrX0lEXG4gICAgICBdKTtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubXZoZCwgYnl0ZXMpO1xuICB9XG5cbiAgc3RhdGljIHNkdHAodHJhY2spIHtcbiAgICB2YXJcbiAgICAgIHNhbXBsZXMgPSB0cmFjay5zYW1wbGVzIHx8IFtdLFxuICAgICAgYnl0ZXMgPSBuZXcgVWludDhBcnJheSg0ICsgc2FtcGxlcy5sZW5ndGgpLFxuICAgICAgZmxhZ3MsXG4gICAgICBpO1xuICAgIC8vIGxlYXZlIHRoZSBmdWxsIGJveCBoZWFkZXIgKDQgYnl0ZXMpIGFsbCB6ZXJvXG4gICAgLy8gd3JpdGUgdGhlIHNhbXBsZSB0YWJsZVxuICAgIGZvciAoaSA9IDA7IGkgPCBzYW1wbGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBmbGFncyA9IHNhbXBsZXNbaV0uZmxhZ3M7XG4gICAgICBieXRlc1tpICsgNF0gPSAoZmxhZ3MuZGVwZW5kc09uIDw8IDQpIHxcbiAgICAgICAgKGZsYWdzLmlzRGVwZW5kZWRPbiA8PCAyKSB8XG4gICAgICAgIChmbGFncy5oYXNSZWR1bmRhbmN5KTtcbiAgICB9XG5cbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuc2R0cCwgYnl0ZXMpO1xuICB9XG5cbiAgc3RhdGljIHN0YmwodHJhY2spIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuc3RibCwgTVA0LnN0c2QodHJhY2spLCBNUDQuYm94KE1QNC50eXBlcy5zdHRzLCBNUDQuU1RUUyksIE1QNC5ib3goTVA0LnR5cGVzLnN0c2MsIE1QNC5TVFNDKSwgTVA0LmJveChNUDQudHlwZXMuc3RzeiwgTVA0LlNUU1opLCBNUDQuYm94KE1QNC50eXBlcy5zdGNvLCBNUDQuU1RDTykpO1xuICB9XG5cbiAgc3RhdGljIGF2YzEodHJhY2spIHtcbiAgICB2YXIgc3BzID0gW10sIHBwcyA9IFtdLCBpLCBkYXRhLCBsZW47XG4gICAgLy8gYXNzZW1ibGUgdGhlIFNQU3NcblxuICAgIGZvciAoaSA9IDA7IGkgPCB0cmFjay5zcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGRhdGEgPSB0cmFjay5zcHNbaV07XG4gICAgICBsZW4gPSBkYXRhLmJ5dGVMZW5ndGg7XG4gICAgICBzcHMucHVzaCgobGVuID4+PiA4KSAmIDB4RkYpO1xuICAgICAgc3BzLnB1c2goKGxlbiAmIDB4RkYpKTtcbiAgICAgIHNwcyA9IHNwcy5jb25jYXQoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZGF0YSkpOyAvLyBTUFNcbiAgICB9XG5cbiAgICAvLyBhc3NlbWJsZSB0aGUgUFBTc1xuICAgIGZvciAoaSA9IDA7IGkgPCB0cmFjay5wcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGRhdGEgPSB0cmFjay5wcHNbaV07XG4gICAgICBsZW4gPSBkYXRhLmJ5dGVMZW5ndGg7XG4gICAgICBwcHMucHVzaCgobGVuID4+PiA4KSAmIDB4RkYpO1xuICAgICAgcHBzLnB1c2goKGxlbiAmIDB4RkYpKTtcbiAgICAgIHBwcyA9IHBwcy5jb25jYXQoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZGF0YSkpO1xuICAgIH1cblxuICAgIHZhciBhdmNjID0gTVA0LmJveChNUDQudHlwZXMuYXZjQywgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAgICAgMHgwMSwgICAvLyB2ZXJzaW9uXG4gICAgICAgICAgICBzcHNbM10sIC8vIHByb2ZpbGVcbiAgICAgICAgICAgIHNwc1s0XSwgLy8gcHJvZmlsZSBjb21wYXRcbiAgICAgICAgICAgIHNwc1s1XSwgLy8gbGV2ZWxcbiAgICAgICAgICAgIDB4ZmMgfCAzLCAvLyBsZW5ndGhTaXplTWludXNPbmUsIGhhcmQtY29kZWQgdG8gNCBieXRlc1xuICAgICAgICAgICAgMHhFMCB8IHRyYWNrLnNwcy5sZW5ndGggLy8gM2JpdCByZXNlcnZlZCAoMTExKSArIG51bU9mU2VxdWVuY2VQYXJhbWV0ZXJTZXRzXG4gICAgICAgICAgXS5jb25jYXQoc3BzKS5jb25jYXQoW1xuICAgICAgICAgICAgdHJhY2sucHBzLmxlbmd0aCAvLyBudW1PZlBpY3R1cmVQYXJhbWV0ZXJTZXRzXG4gICAgICAgICAgXSkuY29uY2F0KHBwcykpKSwgLy8gXCJQUFNcIlxuICAgICAgICB3aWR0aCA9IHRyYWNrLndpZHRoLFxuICAgICAgICBoZWlnaHQgPSB0cmFjay5oZWlnaHQ7XG4gICAgLy9jb25zb2xlLmxvZygnYXZjYzonICsgSGV4LmhleER1bXAoYXZjYykpO1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5hdmMxLCBuZXcgVWludDhBcnJheShbXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDEsIC8vIGRhdGFfcmVmZXJlbmNlX2luZGV4XG4gICAgICAgIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAgICh3aWR0aCA+PiA4KSAmIDB4RkYsXG4gICAgICAgIHdpZHRoICYgMHhmZiwgLy8gd2lkdGhcbiAgICAgICAgKGhlaWdodCA+PiA4KSAmIDB4RkYsXG4gICAgICAgIGhlaWdodCAmIDB4ZmYsIC8vIGhlaWdodFxuICAgICAgICAweDAwLCAweDQ4LCAweDAwLCAweDAwLCAvLyBob3JpenJlc29sdXRpb25cbiAgICAgICAgMHgwMCwgMHg0OCwgMHgwMCwgMHgwMCwgLy8gdmVydHJlc29sdXRpb25cbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMSwgLy8gZnJhbWVfY291bnRcbiAgICAgICAgMHgxMixcbiAgICAgICAgMHg2NCwgMHg2MSwgMHg2OSwgMHg2QywgLy9kYWlseW1vdGlvbi9obHMuanNcbiAgICAgICAgMHg3OSwgMHg2RCwgMHg2RiwgMHg3NCxcbiAgICAgICAgMHg2OSwgMHg2RiwgMHg2RSwgMHgyRixcbiAgICAgICAgMHg2OCwgMHg2QywgMHg3MywgMHgyRSxcbiAgICAgICAgMHg2QSwgMHg3MywgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gY29tcHJlc3Nvcm5hbWVcbiAgICAgICAgMHgwMCwgMHgxOCwgICAvLyBkZXB0aCA9IDI0XG4gICAgICAgIDB4MTEsIDB4MTFdKSwgLy8gcHJlX2RlZmluZWQgPSAtMVxuICAgICAgICAgIGF2Y2MsXG4gICAgICAgICAgTVA0LmJveChNUDQudHlwZXMuYnRydCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAgICAgMHgwMCwgMHgxYywgMHg5YywgMHg4MCwgLy8gYnVmZmVyU2l6ZURCXG4gICAgICAgICAgICAweDAwLCAweDJkLCAweGM2LCAweGMwLCAvLyBtYXhCaXRyYXRlXG4gICAgICAgICAgICAweDAwLCAweDJkLCAweGM2LCAweGMwXSkpIC8vIGF2Z0JpdHJhdGVcbiAgICAgICAgICApO1xuICB9XG5cbiAgc3RhdGljIGVzZHModHJhY2spIHtcbiAgICB2YXIgY29uZmlnbGVuID0gdHJhY2suY29uZmlnLmxlbmd0aDtcbiAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuXG4gICAgICAweDAzLCAvLyBkZXNjcmlwdG9yX3R5cGVcbiAgICAgIDB4MTcrY29uZmlnbGVuLCAvLyBsZW5ndGhcbiAgICAgIDB4MDAsIDB4MDEsIC8vZXNfaWRcbiAgICAgIDB4MDAsIC8vIHN0cmVhbV9wcmlvcml0eVxuXG4gICAgICAweDA0LCAvLyBkZXNjcmlwdG9yX3R5cGVcbiAgICAgIDB4MGYrY29uZmlnbGVuLCAvLyBsZW5ndGhcbiAgICAgIDB4NDAsIC8vY29kZWMgOiBtcGVnNF9hdWRpb1xuICAgICAgMHgxNSwgLy8gc3RyZWFtX3R5cGVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGJ1ZmZlcl9zaXplXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBtYXhCaXRyYXRlXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBhdmdCaXRyYXRlXG5cbiAgICAgIDB4MDUgLy8gZGVzY3JpcHRvcl90eXBlXG4gICAgICBdLmNvbmNhdChbY29uZmlnbGVuXSkuY29uY2F0KHRyYWNrLmNvbmZpZykuY29uY2F0KFsweDA2LCAweDAxLCAweDAyXSkpOyAvLyBHQVNwZWNpZmljQ29uZmlnKSk7IC8vIGxlbmd0aCArIGF1ZGlvIGNvbmZpZyBkZXNjcmlwdG9yXG4gIH1cblxuICBzdGF0aWMgbXA0YSh0cmFjaykge1xuICAgIHZhciBhdWRpb3NhbXBsZXJhdGUgPSB0cmFjay5hdWRpb3NhbXBsZXJhdGU7XG4gICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubXA0YSwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAxLCAvLyBkYXRhX3JlZmVyZW5jZV9pbmRleFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCB0cmFjay5jaGFubmVsQ291bnQsIC8vIGNoYW5uZWxjb3VudFxuICAgICAgMHgwMCwgMHgxMCwgLy8gc2FtcGxlU2l6ZToxNmJpdHNcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkMlxuICAgICAgKGF1ZGlvc2FtcGxlcmF0ZSA+PiA4KSAmIDB4RkYsXG4gICAgICBhdWRpb3NhbXBsZXJhdGUgJiAweGZmLCAvL1xuICAgICAgMHgwMCwgMHgwMF0pLFxuICAgICAgTVA0LmJveChNUDQudHlwZXMuZXNkcywgTVA0LmVzZHModHJhY2spKSk7XG4gIH1cblxuICBzdGF0aWMgc3RzZCh0cmFjaykge1xuICAgIGlmICh0cmFjay50eXBlID09PSAnYXVkaW8nKSB7XG4gICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuc3RzZCwgTVA0LlNUU0QsIE1QNC5tcDRhKHRyYWNrKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5zdHNkLCBNUDQuU1RTRCwgTVA0LmF2YzEodHJhY2spKTtcbiAgICB9XG4gIH1cblxuICBzdGF0aWMgdGtoZCh0cmFjaykge1xuICAgIHZhciBpZCA9IHRyYWNrLmlkLFxuICAgICAgICBkdXJhdGlvbiA9IHRyYWNrLmR1cmF0aW9uKnRyYWNrLnRpbWVzY2FsZSxcbiAgICAgICAgd2lkdGggPSB0cmFjay53aWR0aCxcbiAgICAgICAgaGVpZ2h0ID0gdHJhY2suaGVpZ2h0O1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50a2hkLCBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDcsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBjcmVhdGlvbl90aW1lXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBtb2RpZmljYXRpb25fdGltZVxuICAgICAgKGlkID4+IDI0KSAmIDB4RkYsXG4gICAgICAoaWQgPj4gMTYpICYgMHhGRixcbiAgICAgIChpZCA+PiA4KSAmIDB4RkYsXG4gICAgICBpZCAmIDB4RkYsIC8vIHRyYWNrX0lEXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgKGR1cmF0aW9uID4+IDI0KSxcbiAgICAgIChkdXJhdGlvbiA+PiAxNikgJiAweEZGLFxuICAgICAgKGR1cmF0aW9uID4+ICA4KSAmIDB4RkYsXG4gICAgICBkdXJhdGlvbiAmIDB4RkYsIC8vIGR1cmF0aW9uXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIC8vIGxheWVyXG4gICAgICAweDAwLCAweDAwLCAvLyBhbHRlcm5hdGVfZ3JvdXBcbiAgICAgIDB4MDAsIDB4MDAsIC8vIG5vbi1hdWRpbyB0cmFjayB2b2x1bWVcbiAgICAgIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4NDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHRyYW5zZm9ybWF0aW9uOiB1bml0eSBtYXRyaXhcbiAgICAgICh3aWR0aCA+PiA4KSAmIDB4RkYsXG4gICAgICB3aWR0aCAmIDB4RkYsXG4gICAgICAweDAwLCAweDAwLCAvLyB3aWR0aFxuICAgICAgKGhlaWdodCA+PiA4KSAmIDB4RkYsXG4gICAgICBoZWlnaHQgJiAweEZGLFxuICAgICAgMHgwMCwgMHgwMCAvLyBoZWlnaHRcbiAgICBdKSk7XG4gIH1cblxuICBzdGF0aWMgdHJhZih0cmFjayxiYXNlTWVkaWFEZWNvZGVUaW1lKSB7XG4gICAgdmFyIHNhbXBsZURlcGVuZGVuY3lUYWJsZSA9IE1QNC5zZHRwKHRyYWNrKSxcbiAgICAgICAgaWQgPSB0cmFjay5pZDtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudHJhZixcbiAgICAgICAgICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLnRmaGQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgICAgICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAgICAgICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAgICAgICAgICAgIChpZCA+PiAyNCksXG4gICAgICAgICAgICAgICAgIChpZCA+PiAxNikgJiAwWEZGLFxuICAgICAgICAgICAgICAgICAoaWQgPj4gOCkgJiAwWEZGLFxuICAgICAgICAgICAgICAgICAoaWQgJiAweEZGKSAvLyB0cmFja19JRFxuICAgICAgICAgICAgICAgXSkpLFxuICAgICAgICAgICAgICAgTVA0LmJveChNUDQudHlwZXMudGZkdCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAgICAgICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgICAgICAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgICAgICAgICAgICAgKGJhc2VNZWRpYURlY29kZVRpbWUgPj4yNCksXG4gICAgICAgICAgICAgICAgIChiYXNlTWVkaWFEZWNvZGVUaW1lID4+IDE2KSAmIDBYRkYsXG4gICAgICAgICAgICAgICAgIChiYXNlTWVkaWFEZWNvZGVUaW1lID4+IDgpICYgMFhGRixcbiAgICAgICAgICAgICAgICAgKGJhc2VNZWRpYURlY29kZVRpbWUgJiAweEZGKSAvLyBiYXNlTWVkaWFEZWNvZGVUaW1lXG4gICAgICAgICAgICAgICBdKSksXG4gICAgICAgICAgICAgICBNUDQudHJ1bih0cmFjayxcbiAgICAgICAgICAgICAgICAgICAgc2FtcGxlRGVwZW5kZW5jeVRhYmxlLmxlbmd0aCArXG4gICAgICAgICAgICAgICAgICAgIDE2ICsgLy8gdGZoZFxuICAgICAgICAgICAgICAgICAgICAxNiArIC8vIHRmZHRcbiAgICAgICAgICAgICAgICAgICAgOCArICAvLyB0cmFmIGhlYWRlclxuICAgICAgICAgICAgICAgICAgICAxNiArIC8vIG1maGRcbiAgICAgICAgICAgICAgICAgICAgOCArICAvLyBtb29mIGhlYWRlclxuICAgICAgICAgICAgICAgICAgICA4KSwgIC8vIG1kYXQgaGVhZGVyXG4gICAgICAgICAgICAgICBzYW1wbGVEZXBlbmRlbmN5VGFibGUpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdlbmVyYXRlIGEgdHJhY2sgYm94LlxuICAgKiBAcGFyYW0gdHJhY2sge29iamVjdH0gYSB0cmFjayBkZWZpbml0aW9uXG4gICAqIEByZXR1cm4ge1VpbnQ4QXJyYXl9IHRoZSB0cmFjayBib3hcbiAgICovXG4gIHN0YXRpYyB0cmFrKHRyYWNrKSB7XG4gICAgdHJhY2suZHVyYXRpb24gPSB0cmFjay5kdXJhdGlvbiB8fCAweGZmZmZmZmZmO1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50cmFrLCBNUDQudGtoZCh0cmFjayksIE1QNC5tZGlhKHRyYWNrKSk7XG4gIH1cblxuICBzdGF0aWMgdHJleCh0cmFjaykge1xuICAgIHZhciBpZCA9IHRyYWNrLmlkO1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50cmV4LCBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgIChpZCA+PiAyNCksXG4gICAgIChpZCA+PiAxNikgJiAwWEZGLFxuICAgICAoaWQgPj4gOCkgJiAwWEZGLFxuICAgICAoaWQgJiAweEZGKSwgLy8gdHJhY2tfSURcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDEsIC8vIGRlZmF1bHRfc2FtcGxlX2Rlc2NyaXB0aW9uX2luZGV4XG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBkZWZhdWx0X3NhbXBsZV9kdXJhdGlvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZGVmYXVsdF9zYW1wbGVfc2l6ZVxuICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMSAvLyBkZWZhdWx0X3NhbXBsZV9mbGFnc1xuICAgIF0pKTtcbiAgfVxuXG4gIHN0YXRpYyB0cnVuKHRyYWNrLCBvZmZzZXQpIHtcbiAgICB2YXIgc2FtcGxlcz0gdHJhY2suc2FtcGxlcyB8fCBbXSxcbiAgICAgICAgbGVuID0gc2FtcGxlcy5sZW5ndGgsXG4gICAgICAgIGFycmF5bGVuID0gMTIgKyAoMTYgKiBsZW4pLFxuICAgICAgICBhcnJheSA9IG5ldyBVaW50OEFycmF5KGFycmF5bGVuKSxcbiAgICAgICAgaSxzYW1wbGUsZHVyYXRpb24sc2l6ZSxmbGFncyxjdHM7XG4gICAgb2Zmc2V0ICs9IDggKyBhcnJheWxlbjtcbiAgICBhcnJheS5zZXQoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDBmLCAweDAxLCAvLyBmbGFnc1xuICAgICAgKGxlbiA+Pj4gMjQpICYgMHhGRixcbiAgICAgIChsZW4gPj4+IDE2KSAmIDB4RkYsXG4gICAgICAobGVuID4+PiA4KSAmIDB4RkYsXG4gICAgICBsZW4gJiAweEZGLCAvLyBzYW1wbGVfY291bnRcbiAgICAgIChvZmZzZXQgPj4+IDI0KSAmIDB4RkYsXG4gICAgICAob2Zmc2V0ID4+PiAxNikgJiAweEZGLFxuICAgICAgKG9mZnNldCA+Pj4gOCkgJiAweEZGLFxuICAgICAgb2Zmc2V0ICYgMHhGRiAvLyBkYXRhX29mZnNldFxuICAgIF0sMCk7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBzYW1wbGUgPSBzYW1wbGVzW2ldO1xuICAgICAgZHVyYXRpb24gPSBzYW1wbGUuZHVyYXRpb247XG4gICAgICBzaXplID0gc2FtcGxlLnNpemU7XG4gICAgICBmbGFncyA9IHNhbXBsZS5mbGFncztcbiAgICAgIGN0cyA9IHNhbXBsZS5jdHM7XG4gICAgICBhcnJheS5zZXQoW1xuICAgICAgICAoZHVyYXRpb24gPj4+IDI0KSAmIDB4RkYsXG4gICAgICAgIChkdXJhdGlvbiA+Pj4gMTYpICYgMHhGRixcbiAgICAgICAgKGR1cmF0aW9uID4+PiA4KSAmIDB4RkYsXG4gICAgICAgIGR1cmF0aW9uICYgMHhGRiwgLy8gc2FtcGxlX2R1cmF0aW9uXG4gICAgICAgIChzaXplID4+PiAyNCkgJiAweEZGLFxuICAgICAgICAoc2l6ZSA+Pj4gMTYpICYgMHhGRixcbiAgICAgICAgKHNpemUgPj4+IDgpICYgMHhGRixcbiAgICAgICAgc2l6ZSAmIDB4RkYsIC8vIHNhbXBsZV9zaXplXG4gICAgICAgIChmbGFncy5pc0xlYWRpbmcgPDwgMikgfCBmbGFncy5kZXBlbmRzT24sXG4gICAgICAgIChmbGFncy5pc0RlcGVuZGVkT24gPDwgNikgfFxuICAgICAgICAgIChmbGFncy5oYXNSZWR1bmRhbmN5IDw8IDQpIHxcbiAgICAgICAgICAoZmxhZ3MucGFkZGluZ1ZhbHVlIDw8IDEpIHxcbiAgICAgICAgICBmbGFncy5pc05vblN5bmMsXG4gICAgICAgIGZsYWdzLmRlZ3JhZFByaW8gJiAweEYwIDw8IDgsXG4gICAgICAgIGZsYWdzLmRlZ3JhZFByaW8gJiAweDBGLCAvLyBzYW1wbGVfZmxhZ3NcbiAgICAgICAgKGN0cyA+Pj4gMjQpICYgMHhGRixcbiAgICAgICAgKGN0cyA+Pj4gMTYpICYgMHhGRixcbiAgICAgICAgKGN0cyA+Pj4gOCkgJiAweEZGLFxuICAgICAgICBjdHMgJiAweEZGIC8vIHNhbXBsZV9jb21wb3NpdGlvbl90aW1lX29mZnNldFxuICAgICAgXSwxMisxNippKTtcbiAgICB9XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnRydW4sIGFycmF5KTtcbiAgfVxuXG4gIHN0YXRpYyBpbml0U2VnbWVudCh0cmFja3MpIHtcbiAgICBpZiAoIU1QNC50eXBlcykge1xuICAgICAgTVA0LmluaXQoKTtcbiAgICB9XG4gICAgdmFyIG1vdmllID0gTVA0Lm1vb3YodHJhY2tzKSwgcmVzdWx0O1xuICAgIHJlc3VsdCA9IG5ldyBVaW50OEFycmF5KE1QNC5GVFlQLmJ5dGVMZW5ndGggKyBtb3ZpZS5ieXRlTGVuZ3RoKTtcbiAgICByZXN1bHQuc2V0KE1QNC5GVFlQKTtcbiAgICByZXN1bHQuc2V0KG1vdmllLCBNUDQuRlRZUC5ieXRlTGVuZ3RoKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE1QNDtcbiIsIi8qKlxuICogZk1QNCByZW11eGVyXG4qL1xuXG5cbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQgTVA0IGZyb20gJy4uL3JlbXV4L21wNC1nZW5lcmF0b3InO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5cbmNsYXNzIE1QNFJlbXV4ZXIge1xuICBjb25zdHJ1Y3RvcihvYnNlcnZlcikge1xuICAgIHRoaXMub2JzZXJ2ZXIgPSBvYnNlcnZlcjtcbiAgICB0aGlzLklTR2VuZXJhdGVkID0gZmFsc2U7XG4gICAgdGhpcy5QRVMyTVA0U0NBTEVGQUNUT1IgPSA0O1xuICAgIHRoaXMuUEVTX1RJTUVTQ0FMRSA9IDkwMDAwO1xuICAgIHRoaXMuTVA0X1RJTUVTQ0FMRSA9IHRoaXMuUEVTX1RJTUVTQ0FMRSAvIHRoaXMuUEVTMk1QNFNDQUxFRkFDVE9SO1xuICB9XG5cbiAgZ2V0IHBhc3N0aHJvdWdoKCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gIH1cblxuICBpbnNlcnREaXNjb250aW51aXR5KCkge1xuICAgIHRoaXMuX2luaXRQVFMgPSB0aGlzLl9pbml0RFRTID0gdGhpcy5uZXh0QWFjUHRzID0gdGhpcy5uZXh0QXZjRHRzID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgc3dpdGNoTGV2ZWwoKSB7XG4gICAgdGhpcy5JU0dlbmVyYXRlZCA9IGZhbHNlO1xuICB9XG5cbiAgcmVtdXgoYXVkaW9UcmFjayx2aWRlb1RyYWNrLGlkM1RyYWNrLHRleHRUcmFjayx0aW1lT2Zmc2V0LCBjb250aWd1b3VzLCBkYXRhLCB0MCkge1xuICAgIC8vIGdlbmVyYXRlIEluaXQgU2VnbWVudCBpZiBuZWVkZWRcbiAgICBpZiAoIXRoaXMuSVNHZW5lcmF0ZWQpIHtcbiAgICAgIHRoaXMuZ2VuZXJhdGVJUyhhdWRpb1RyYWNrLHZpZGVvVHJhY2ssdGltZU9mZnNldCwgdDApO1xuXHR9XG5cdGlmICh0aGlzLklTR2VuZXJhdGVkKSB7XG5cdFx0Ly9sb2dnZXIubG9nKCduYiBBVkMgc2FtcGxlczonICsgdmlkZW9UcmFjay5zYW1wbGVzLmxlbmd0aCk7XG5cdFx0aWYgKHZpZGVvVHJhY2suc2FtcGxlcy5sZW5ndGgpIHtcblx0XHQgIHRoaXMucmVtdXhWaWRlbyh2aWRlb1RyYWNrLHRpbWVPZmZzZXQsY29udGlndW91cywgdDApO1xuXHRcdH1cblx0XHQvL2xvZ2dlci5sb2coJ25iIEFBQyBzYW1wbGVzOicgKyBhdWRpb1RyYWNrLnNhbXBsZXMubGVuZ3RoKTtcblx0XHRpZiAoYXVkaW9UcmFjay5zYW1wbGVzLmxlbmd0aCkge1xuXHRcdCAgdGhpcy5yZW11eEF1ZGlvKGF1ZGlvVHJhY2ssdGltZU9mZnNldCxjb250aWd1b3VzKTtcblx0XHR9XG5cdFx0Ly9sb2dnZXIubG9nKCduYiBJRDMgc2FtcGxlczonICsgYXVkaW9UcmFjay5zYW1wbGVzLmxlbmd0aCk7XG5cdFx0aWYgKGlkM1RyYWNrLnNhbXBsZXMubGVuZ3RoKSB7XG5cdFx0ICB0aGlzLnJlbXV4SUQzKGlkM1RyYWNrLHRpbWVPZmZzZXQpO1xuXHRcdH1cblx0XHQvL2xvZ2dlci5sb2coJ25iIElEMyBzYW1wbGVzOicgKyBhdWRpb1RyYWNrLnNhbXBsZXMubGVuZ3RoKTtcblx0XHRpZiAodGV4dFRyYWNrLnNhbXBsZXMubGVuZ3RoKSB7XG5cdFx0ICB0aGlzLnJlbXV4VGV4dCh0ZXh0VHJhY2ssdGltZU9mZnNldCk7XG5cdFx0fVxuXHR9XG4gICAgLy9ub3RpZnkgZW5kIG9mIHBhcnNpbmdcbiAgICB0aGlzLm9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTRUQpO1xuICB9XG5cbiAgZ2VuZXJhdGVJUyhhdWRpb1RyYWNrLHZpZGVvVHJhY2ssdGltZU9mZnNldCwgdDApIHtcbiAgICB2YXIgb2JzZXJ2ZXIgPSB0aGlzLm9ic2VydmVyLFxuICAgICAgICBhdWRpb1NhbXBsZXMgPSBhdWRpb1RyYWNrLnNhbXBsZXMsXG4gICAgICAgIHZpZGVvU2FtcGxlcyA9IHZpZGVvVHJhY2suc2FtcGxlcyxcbiAgICAgICAgcGVzVGltZVNjYWxlID0gdGhpcy5QRVNfVElNRVNDQUxFLFxuICAgICAgICB0cmFja3MgPSB7fSxcbiAgICAgICAgZGF0YSA9IHsgdHJhY2tzIDogdHJhY2tzLCB1bmlxdWUgOiBmYWxzZSB9LFxuICAgICAgICBjb21wdXRlUFRTRFRTID0gKHRoaXMuX2luaXRQVFMgPT09IHVuZGVmaW5lZCksXG4gICAgICAgIGluaXRQVFMsIGluaXREVFM7XG5cbiAgICBpZiAoY29tcHV0ZVBUU0RUUykge1xuICAgICAgaW5pdFBUUyA9IGluaXREVFMgPSBJbmZpbml0eTtcbiAgICB9XG4gICAgaWYgKGF1ZGlvVHJhY2suY29uZmlnICYmIGF1ZGlvU2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgIGF1ZGlvVHJhY2sudGltZXNjYWxlID0gYXVkaW9UcmFjay5hdWRpb3NhbXBsZXJhdGU7XG4gICAgICAvLyBNUDQgZHVyYXRpb24gKHRyYWNrIGR1cmF0aW9uIGluIHNlY29uZHMgbXVsdGlwbGllZCBieSB0aW1lc2NhbGUpIGlzIGNvZGVkIG9uIDMyIGJpdHNcbiAgICAgIC8vIHdlIGtub3cgdGhhdCBlYWNoIEFBQyBzYW1wbGUgY29udGFpbnMgMTAyNCBmcmFtZXMuLi4uXG4gICAgICAvLyBpbiBvcmRlciB0byBhdm9pZCBvdmVyZmxvd2luZyB0aGUgMzIgYml0IGNvdW50ZXIgZm9yIGxhcmdlIGR1cmF0aW9uLCB3ZSB1c2Ugc21hbGxlciB0aW1lc2NhbGUgKHRpbWVzY2FsZS9nY2QpXG4gICAgICAvLyB3ZSBqdXN0IG5lZWQgdG8gZW5zdXJlIHRoYXQgQUFDIHNhbXBsZSBkdXJhdGlvbiB3aWxsIHN0aWxsIGJlIGFuIGludGVnZXIgKHdpbGwgYmUgMTAyNC9nY2QpXG4gICAgICBpZiAoYXVkaW9UcmFjay50aW1lc2NhbGUgKiBhdWRpb1RyYWNrLmR1cmF0aW9uID4gTWF0aC5wb3coMiwgMzIpKSB7XG4gICAgICAgIGxldCBncmVhdGVzdENvbW1vbkRpdmlzb3IgPSBmdW5jdGlvbihhLCBiKSB7XG4gICAgICAgICAgICBpZiAoICEgYikge1xuICAgICAgICAgICAgICAgIHJldHVybiBhO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGdyZWF0ZXN0Q29tbW9uRGl2aXNvcihiLCBhICUgYik7XG4gICAgICAgIH07XG4gICAgICAgIGF1ZGlvVHJhY2sudGltZXNjYWxlID0gYXVkaW9UcmFjay5hdWRpb3NhbXBsZXJhdGUgLyBncmVhdGVzdENvbW1vbkRpdmlzb3IoYXVkaW9UcmFjay5hdWRpb3NhbXBsZXJhdGUsMTAyNCk7XG4gICAgICB9XG4gICAgICBsb2dnZXIubG9nICgnYXVkaW8gbXA0IHRpbWVzY2FsZSA6JysgYXVkaW9UcmFjay50aW1lc2NhbGUpO1xuICAgICAgdHJhY2tzLmF1ZGlvID0ge1xuICAgICAgICBjb250YWluZXIgOiAnYXVkaW8vbXA0JyxcbiAgICAgICAgY29kZWMgOiAgYXVkaW9UcmFjay5jb2RlYyxcbiAgICAgICAgaW5pdFNlZ21lbnQgOiBNUDQuaW5pdFNlZ21lbnQoW2F1ZGlvVHJhY2tdKSxcbiAgICAgICAgbWV0YWRhdGEgOiB7XG4gICAgICAgICAgY2hhbm5lbENvdW50IDogYXVkaW9UcmFjay5jaGFubmVsQ291bnRcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIGlmIChjb21wdXRlUFRTRFRTKSB7XG4gICAgICAgIC8vIHJlbWVtYmVyIGZpcnN0IFBUUyBvZiB0aGlzIGRlbXV4aW5nIGNvbnRleHQuIGZvciBhdWRpbywgUFRTICsgRFRTIC4uLlxuICAgICAgICAvLyBpbml0UFRTID0gaW5pdERUUyA9IGF1ZGlvU2FtcGxlc1swXS5wdHMgLSBwZXNUaW1lU2NhbGUgKiB0aW1lT2Zmc2V0O1xuICAgICAgICBpbml0UFRTID0gaW5pdERUUyA9IHQwICogcGVzVGltZVNjYWxlO1xuXHRcdC8vIGlmICh0aW1lT2Zmc2V0ICE9IHQwKSBkZWJ1Z2dlcjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodmlkZW9UcmFjay5zcHMgJiYgdmlkZW9UcmFjay5wcHMgJiYgdmlkZW9TYW1wbGVzLmxlbmd0aCkge1xuICAgICAgdmlkZW9UcmFjay50aW1lc2NhbGUgPSB0aGlzLk1QNF9USU1FU0NBTEU7XG4gICAgICB0cmFja3MudmlkZW8gPSB7XG4gICAgICAgIGNvbnRhaW5lciA6ICd2aWRlby9tcDQnLFxuICAgICAgICBjb2RlYyA6ICB2aWRlb1RyYWNrLmNvZGVjLFxuICAgICAgICBpbml0U2VnbWVudCA6IE1QNC5pbml0U2VnbWVudChbdmlkZW9UcmFja10pLFxuICAgICAgICBtZXRhZGF0YSA6IHtcbiAgICAgICAgICB3aWR0aCA6IHZpZGVvVHJhY2sud2lkdGgsXG4gICAgICAgICAgaGVpZ2h0IDogdmlkZW9UcmFjay5oZWlnaHRcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIGlmIChjb21wdXRlUFRTRFRTKSB7XG4gICAgICAgIGluaXRQVFMgPSBNYXRoLm1pbihpbml0UFRTLHZpZGVvU2FtcGxlc1swXS5wdHMgLSBwZXNUaW1lU2NhbGUgKiB0aW1lT2Zmc2V0KTtcbiAgICAgICAgaW5pdERUUyA9IE1hdGgubWluKGluaXREVFMsdmlkZW9TYW1wbGVzWzBdLmR0cyAtIHBlc1RpbWVTY2FsZSAqIHRpbWVPZmZzZXQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmKCFPYmplY3Qua2V5cyh0cmFja3MpKSB7XG4gICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZSA6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5GUkFHX1BBUlNJTkdfRVJST1IsIGZhdGFsOiBmYWxzZSwgcmVhc29uOiAnbm8gYXVkaW8vdmlkZW8gc2FtcGxlcyBmb3VuZCd9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULGRhdGEpO1xuICAgICAgdGhpcy5JU0dlbmVyYXRlZCA9IHRydWU7XG4gICAgICBpZiAoY29tcHV0ZVBUU0RUUykge1xuICAgICAgICAvLyB0aGlzLl9pbml0UFRTID0gdDAqcGVzVGltZVNjYWxlOy8vaW5pdFBUUztcbiAgICAgICAgLy8gdGhpcy5faW5pdERUUyA9IHQwKnBlc1RpbWVTY2FsZTsvL2luaXREVFM7XG5cblx0XHQgIGNvbnNvbGUuaW5mbyhcIiEhXCIpO1xuICAgICAgICB0aGlzLl9pbml0UFRTID0gaW5pdFBUUztcbiAgICAgICAgdGhpcy5faW5pdERUUyA9IGluaXREVFM7XG5cdFx0Y29uc29sZS5pbmZvKCdpbml0UFRTOiAnICsgaW5pdFBUUyArICcgdDAqOTAwMDA6ICcgKyB0MCo5MDAwMCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmVtdXhWaWRlbyh0cmFjaywgdGltZU9mZnNldCwgY29udGlndW91cywgdDApIHtcbiAgICB2YXIgb2Zmc2V0ID0gOCxcbiAgICAgICAgcGVzVGltZVNjYWxlID0gdGhpcy5QRVNfVElNRVNDQUxFLFxuICAgICAgICBwZXMybXA0U2NhbGVGYWN0b3IgPSB0aGlzLlBFUzJNUDRTQ0FMRUZBQ1RPUixcbiAgICAgICAgbXA0U2FtcGxlRHVyYXRpb24sXG4gICAgICAgIG1kYXQsIG1vb2YsXG4gICAgICAgIGZpcnN0UFRTLCBmaXJzdERUUyxcbiAgICAgICAgbGFzdFBUUywgbGFzdERUUyxcbiAgICAgICAgaW5wdXRTYW1wbGVzID0gdHJhY2suc2FtcGxlcyxcbiAgICAgICAgb3V0cHV0U2FtcGxlcyA9IFtdO1xuXG4gIC8vIFBUUyBpcyBjb2RlZCBvbiAzM2JpdHMsIGFuZCBjYW4gbG9vcCBmcm9tIC0yXjMyIHRvIDJeMzJcbiAgLy8gUFRTTm9ybWFsaXplIHdpbGwgbWFrZSBQVFMvRFRTIHZhbHVlIG1vbm90b25pYywgd2UgdXNlIGxhc3Qga25vd24gRFRTIHZhbHVlIGFzIHJlZmVyZW5jZSB2YWx1ZVxuICAgbGV0IG5leHRBdmNEdHM7XG4gICAgaWYgKGNvbnRpZ3VvdXMpIHtcbiAgICAgIC8vIGlmIHBhcnNlZCBmcmFnbWVudCBpcyBjb250aWd1b3VzIHdpdGggbGFzdCBvbmUsIGxldCdzIHVzZSBsYXN0IERUUyB2YWx1ZSBhcyByZWZlcmVuY2VcbiAgICAgIG5leHRBdmNEdHMgPSB0aGlzLm5leHRBdmNEdHM7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGlmIG5vdCBjb250aWd1b3VzLCBsZXQncyB1c2UgdGFyZ2V0IHRpbWVPZmZzZXRcbiAgICAgIG5leHRBdmNEdHMgPSB0MCpwZXNUaW1lU2NhbGU7XG4gICAgfVxuXG4gICAgLy8gY29tcHV0ZSBmaXJzdCBEVFMgYW5kIGxhc3QgRFRTLCBub3JtYWxpemUgdGhlbSBhZ2FpbnN0IHJlZmVyZW5jZSB2YWx1ZVxuICAgIGxldCBzYW1wbGUgPSBpbnB1dFNhbXBsZXNbMF07XG4gICAgLy8gZmlyc3REVFMgPSAgTWF0aC5tYXgodGhpcy5fUFRTTm9ybWFsaXplKHNhbXBsZS5kdHMsbmV4dEF2Y0R0cykgLSB0aGlzLl9pbml0RFRTLDApO1xuICAgIC8vIGZpcnN0UFRTID0gIE1hdGgubWF4KHRoaXMuX1BUU05vcm1hbGl6ZShzYW1wbGUucHRzLG5leHRBdmNEdHMpIC0gdGhpcy5faW5pdERUUywwKTtcblxuICAgIGZpcnN0RFRTID0gIE1hdGgubWF4KHRoaXMuX1BUU05vcm1hbGl6ZShzYW1wbGUuZHRzLG5leHRBdmNEdHMpIC0gdGhpcy5faW5pdERUUywwKTtcbiAgICBmaXJzdFBUUyA9ICBNYXRoLm1heCh0aGlzLl9QVFNOb3JtYWxpemUoc2FtcGxlLnB0cyxuZXh0QXZjRHRzKSAtIHRoaXMuX2luaXREVFMsMCk7XG5cblx0dmFyIGZpcnN0U2FtcGxlRFRTID0gc2FtcGxlLmR0cztcblx0Zmlyc3RQVFMgPSBmaXJzdERUUyA9IE1hdGgucm91bmQodDAgKiBwZXNUaW1lU2NhbGUpO1xuXHRjb25zb2xlLmluZm8oICdmaXJzdFBUUyAjMTogJyArIGZpcnN0UFRTICk7XG5cbiAgICAvLyBjaGVjayB0aW1lc3RhbXAgY29udGludWl0eSBhY2Nyb3NzIGNvbnNlY3V0aXZlIGZyYWdtZW50cyAodGhpcyBpcyB0byByZW1vdmUgaW50ZXItZnJhZ21lbnQgZ2FwL2hvbGUpXG4vLyAgICAgbGV0IGRlbHRhID0gTWF0aC5yb3VuZCgoZmlyc3REVFMgLSBuZXh0QXZjRHRzKSAvIDkwKTtcbi8vXG4vLyAgICAgLy8gaWYgZnJhZ21lbnQgYXJlIGNvbnRpZ3VvdXMsIG9yIGRlbHRhIGxlc3MgdGhhbiA2MDBtcywgZW5zdXJlIHRoZXJlIGlzIG5vIG92ZXJsYXAvaG9sZSBiZXR3ZWVuIGZyYWdtZW50c1xuLy8gICAgIGlmIChjb250aWd1b3VzIHx8IE1hdGguYWJzKGRlbHRhKSA8IDYwMCkge1xuLy8gICAgICAgaWYgKGRlbHRhKSB7XG4vLyAgICAgICAgIGlmIChkZWx0YSA+IDEpIHtcbi8vICAgICAgICAgICBsb2dnZXIubG9nKGBBVkM6JHtkZWx0YX0gbXMgaG9sZSBiZXR3ZWVuIGZyYWdtZW50cyBkZXRlY3RlZCxmaWxsaW5nIGl0YCk7XG4vLyAgICAgICAgIH0gZWxzZSBpZiAoZGVsdGEgPCAtMSkge1xuLy8gICAgICAgICAgIGxvZ2dlci5sb2coYEFWQzokeygtZGVsdGEpfSBtcyBvdmVybGFwcGluZyBiZXR3ZWVuIGZyYWdtZW50cyBkZXRlY3RlZGApO1xuLy8gICAgICAgICB9XG4vLyAgICAgICAgIC8vIHJlbW92ZSBob2xlL2dhcCA6IHNldCBEVFMgdG8gbmV4dCBleHBlY3RlZCBEVFNcbi8vICAgICAgICAgZmlyc3REVFMgPSBpbnB1dFNhbXBsZXNbMF0uZHRzID0gbmV4dEF2Y0R0cztcbi8vICAgICAgICAgLy8gb2Zmc2V0IFBUUyBhcyB3ZWxsLCBlbnN1cmUgdGhhdCBQVFMgaXMgc21hbGxlciBvciBlcXVhbCB0aGFuIG5ldyBEVFNcbi8vICAgICAgICAgZmlyc3RQVFMgPSBpbnB1dFNhbXBsZXNbMF0ucHRzID0gTWF0aC5tYXgoZmlyc3RQVFMgLSBkZWx0YSwgbmV4dEF2Y0R0cyk7XG4vLyAgICAgICAgIGxvZ2dlci5sb2coYFZpZGVvL1BUUy9EVFMgYWRqdXN0ZWQ6ICR7Zmlyc3RQVFN9LyR7Zmlyc3REVFN9LGRlbHRhOiR7ZGVsdGF9YCk7XG4vLyAgICAgICB9XG4vLyAgICAgfVxuLy8gXHRjb25zb2xlLmluZm8oICdmaXJzdFBUUyAjMjogJyArIGZpcnN0UFRTICk7XG5cblx0Ly8gc2FtcGxlIGR1cmF0aW9uIChhcyBleHBlY3RlZCBieSB0cnVuIE1QNCBib3hlcyksIHNob3VsZCBiZSB0aGUgZGVsdGEgYmV0d2VlbiBzYW1wbGUgRFRTXG4gICAgLy8gbGV0J3Mgc2lnbmFsIHRoZSBzYW1lIHNhbXBsZSBkdXJhdGlvbiBmb3IgYWxsIHNhbXBsZXNcbiAgICAvLyBzZXQgdGhpcyBjb25zdGFudCBkdXJhdGlvbiBhcyBiZWluZyB0aGUgYXZnIGRlbHRhIGJldHdlZW4gY29uc2VjdXRpdmUgRFRTLlxuICAgIHNhbXBsZSA9IGlucHV0U2FtcGxlc1tpbnB1dFNhbXBsZXMubGVuZ3RoLTFdO1xuICAgIGxhc3REVFMgPSBNYXRoLm1heCh0aGlzLl9QVFNOb3JtYWxpemUoc2FtcGxlLmR0cyxuZXh0QXZjRHRzKSAtIHRoaXMuX2luaXREVFMsMCk7XG5cblx0bGFzdERUUyA9IChzYW1wbGUuZHRzIC0gZmlyc3RTYW1wbGVEVFMpICsgZmlyc3RQVFM7XG4gICAgbXA0U2FtcGxlRHVyYXRpb24gPSBNYXRoLnJvdW5kKChsYXN0RFRTLWZpcnN0RFRTKS8ocGVzMm1wNFNjYWxlRmFjdG9yKihpbnB1dFNhbXBsZXMubGVuZ3RoLTEpKSk7XG5cblx0aWYgKGxhc3REVFMgPD0gZmlyc3REVFMpIHtcblx0XHRkZWJ1Z2dlcjtcblx0XHRsYXN0RFRTID0gZmlyc3REVFM7XG5cdFx0bXA0U2FtcGxlRHVyYXRpb24gPSAwO1xuXHRcdGNvbnNvbGUud2FybignbGFzdERUUyA8IGZpcnN0RFRTJyk7XG5cdH07XG5cdGNvbnNvbGUuaW5mbyggJyggbGFzdERUUyAtIGZpcnN0RFRTICkgLyA5MDAwMCA6ICcgKyAobGFzdERUUyAtIGZpcnN0RFRTKS85MDAwMCk7XG5cdHZhciBvbGRQVFMgPSBmaXJzdFBUUztcblx0Ly8gZmlyc3RQVFMgPSBmaXJzdERUUyA9IE1hdGgucm91bmQodDAqOTAwMDApO1xuXHRjb25zb2xlLmxvZygnZmlyc3RQVFM6ICcgICsgb2xkUFRTICsgJyAtPiAnICsgdDAqOTAwMDApO1xuXHRpZiAoIE1hdGguYWJzKG9sZFBUUyAtIGZpcnN0UFRTKSA+IDEwMDAwICkgY29uc29sZS53YXJuKCd0aGlzIGNvdWxkIGhhdmUgY2F1c2VkIGEgZnJhZ0xvb3AgZXJyb3InKTtcblxuXG4gICAgLy8gbm9ybWFsaXplIGFsbCBQVFMvRFRTIG5vdyAuLi5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGlucHV0U2FtcGxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgbGV0IHNhbXBsZSA9IGlucHV0U2FtcGxlc1tpXTtcbiAgICAgIC8vIHNhbXBsZSBEVFMgaXMgY29tcHV0ZWQgdXNpbmcgYSBjb25zdGFudCBkZWNvZGluZyBvZmZzZXQgKG1wNFNhbXBsZUR1cmF0aW9uKSBiZXR3ZWVuIHNhbXBsZXNcbiAgICAgIHNhbXBsZS5kdHMgPSBmaXJzdERUUyArIGkqcGVzMm1wNFNjYWxlRmFjdG9yKm1wNFNhbXBsZUR1cmF0aW9uO1xuICAgICAgLy8gd2Ugbm9ybWFsaXplIFBUUyBhZ2FpbnN0IG5leHRBdmNEdHMsIHdlIGFsc28gc3Vic3RyYWN0IGluaXREVFMgKHNvbWUgc3RyZWFtcyBkb24ndCBzdGFydCBAIFBUUyBPKVxuICAgICAgLy8gYW5kIHdlIGVuc3VyZSB0aGF0IGNvbXB1dGVkIHZhbHVlIGlzIGdyZWF0ZXIgb3IgZXF1YWwgdGhhbiBzYW1wbGUgRFRTXG4gICAgICAvLyBzYW1wbGUucHRzID0gTWF0aC5tYXgodGhpcy5fUFRTTm9ybWFsaXplKHNhbXBsZS5wdHMsbmV4dEF2Y0R0cykgLSB0aGlzLl9pbml0RFRTLCBzYW1wbGUuZHRzKTtcblx0ICBzYW1wbGUucHRzID0gc2FtcGxlLmR0cztcbiAgICB9XG4gICAgbGFzdFBUUyA9IGlucHV0U2FtcGxlc1tpbnB1dFNhbXBsZXMubGVuZ3RoLTFdLnB0cztcblxuICAgIC8qIGNvbmNhdGVuYXRlIHRoZSB2aWRlbyBkYXRhIGFuZCBjb25zdHJ1Y3QgdGhlIG1kYXQgaW4gcGxhY2VcbiAgICAgIChuZWVkIDggbW9yZSBieXRlcyB0byBmaWxsIGxlbmd0aCBhbmQgbXBkYXQgdHlwZSkgKi9cbiAgICBtZGF0ID0gbmV3IFVpbnQ4QXJyYXkodHJhY2subGVuICsgKDQgKiB0cmFjay5uYk5hbHUpICsgOCk7XG4gICAgbGV0IHZpZXcgPSBuZXcgRGF0YVZpZXcobWRhdC5idWZmZXIpO1xuICAgIHZpZXcuc2V0VWludDMyKDAsIG1kYXQuYnl0ZUxlbmd0aCk7XG4gICAgbWRhdC5zZXQoTVA0LnR5cGVzLm1kYXQsIDQpO1xuICAgIHdoaWxlIChpbnB1dFNhbXBsZXMubGVuZ3RoKSB7XG4gICAgICBsZXQgYXZjU2FtcGxlID0gaW5wdXRTYW1wbGVzLnNoaWZ0KCksXG4gICAgICAgICAgbXA0U2FtcGxlTGVuZ3RoID0gMDtcbiAgICAgIC8vIGNvbnZlcnQgTkFMVSBiaXRzdHJlYW0gdG8gTVA0IGZvcm1hdCAocHJlcGVuZCBOQUxVIHdpdGggc2l6ZSBmaWVsZClcbiAgICAgIHdoaWxlIChhdmNTYW1wbGUudW5pdHMudW5pdHMubGVuZ3RoKSB7XG4gICAgICAgIGxldCB1bml0ID0gYXZjU2FtcGxlLnVuaXRzLnVuaXRzLnNoaWZ0KCk7XG4gICAgICAgIHZpZXcuc2V0VWludDMyKG9mZnNldCwgdW5pdC5kYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgICBvZmZzZXQgKz0gNDtcbiAgICAgICAgbWRhdC5zZXQodW5pdC5kYXRhLCBvZmZzZXQpO1xuICAgICAgICBvZmZzZXQgKz0gdW5pdC5kYXRhLmJ5dGVMZW5ndGg7XG4gICAgICAgIG1wNFNhbXBsZUxlbmd0aCArPSA0ICsgdW5pdC5kYXRhLmJ5dGVMZW5ndGg7XG4gICAgICB9XG4gICAgICAvL2NvbnNvbGUubG9nKCdQVFMvRFRTL2luaXREVFMvbm9ybVBUUy9ub3JtRFRTL3JlbGF0aXZlIFBUUyA6ICR7YXZjU2FtcGxlLnB0c30vJHthdmNTYW1wbGUuZHRzfS8ke3RoaXMuX2luaXREVFN9LyR7cHRzbm9ybX0vJHtkdHNub3JtfS8keyhhdmNTYW1wbGUucHRzLzQyOTQ5NjcyOTYpLnRvRml4ZWQoMyl9Jyk7XG4gICAgICBvdXRwdXRTYW1wbGVzLnB1c2goe1xuICAgICAgICBzaXplOiBtcDRTYW1wbGVMZW5ndGgsXG4gICAgICAgICAvLyBjb25zdGFudCBkdXJhdGlvblxuICAgICAgICBkdXJhdGlvbjogbXA0U2FtcGxlRHVyYXRpb24sXG4gICAgICAgIC8vIHNldCBjb21wb3NpdGlvbiB0aW1lIG9mZnNldCBhcyBhIG11bHRpcGxlIG9mIHNhbXBsZSBkdXJhdGlvblxuICAgICAgICBjdHM6IE1hdGgubWF4KDAsbXA0U2FtcGxlRHVyYXRpb24qTWF0aC5yb3VuZCgoYXZjU2FtcGxlLnB0cyAtIGF2Y1NhbXBsZS5kdHMpLyhwZXMybXA0U2NhbGVGYWN0b3IqbXA0U2FtcGxlRHVyYXRpb24pKSksXG4gICAgICAgIGZsYWdzOiB7XG4gICAgICAgICAgaXNMZWFkaW5nOiAwLFxuICAgICAgICAgIGlzRGVwZW5kZWRPbjogMCxcbiAgICAgICAgICBoYXNSZWR1bmRhbmN5OiAwLFxuICAgICAgICAgIGRlZ3JhZFByaW86IDAsXG4gICAgICAgICAgZGVwZW5kc09uIDogYXZjU2FtcGxlLmtleSA/IDIgOiAxLFxuICAgICAgICAgIGlzTm9uU3luYyA6IGF2Y1NhbXBsZS5rZXkgPyAwIDogMVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gICAgLy8gbmV4dCBBVkMgc2FtcGxlIERUUyBzaG91bGQgYmUgZXF1YWwgdG8gbGFzdCBzYW1wbGUgRFRTICsgbGFzdCBzYW1wbGUgZHVyYXRpb24gKGluIFBFUyB0aW1lc2NhbGUpXG4gICAgdGhpcy5uZXh0QXZjRHRzID0gbGFzdERUUyArIG1wNFNhbXBsZUR1cmF0aW9uKnBlczJtcDRTY2FsZUZhY3RvcjtcbiAgICB0cmFjay5sZW4gPSAwO1xuICAgIHRyYWNrLm5iTmFsdSA9IDA7XG4gICAgaWYob3V0cHV0U2FtcGxlcy5sZW5ndGggJiYgbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLmluZGV4T2YoJ2Nocm9tZScpID4gLTEpIHtcbiAgICAgIGxldCBmbGFncyA9IG91dHB1dFNhbXBsZXNbMF0uZmxhZ3M7XG4gICAgLy8gY2hyb21lIHdvcmthcm91bmQsIG1hcmsgZmlyc3Qgc2FtcGxlIGFzIGJlaW5nIGEgUmFuZG9tIEFjY2VzcyBQb2ludCB0byBhdm9pZCBzb3VyY2VidWZmZXIgYXBwZW5kIGlzc3VlXG4gICAgLy8gaHR0cHM6Ly9jb2RlLmdvb2dsZS5jb20vcC9jaHJvbWl1bS9pc3N1ZXMvZGV0YWlsP2lkPTIyOTQxMlxuICAgICAgZmxhZ3MuZGVwZW5kc09uID0gMjtcbiAgICAgIGZsYWdzLmlzTm9uU3luYyA9IDA7XG4gICAgfVxuICAgIHRyYWNrLnNhbXBsZXMgPSBvdXRwdXRTYW1wbGVzO1xuXHQvLyBpZiAoZmlyc3REVFMvcGVzVGltZVNjYWxlID4gMTAwMDAwKSB7IGRlYnVnZ2VyOyB9XG4gICAgbW9vZiA9IE1QNC5tb29mKHRyYWNrLnNlcXVlbmNlTnVtYmVyKyssIGZpcnN0RFRTIC8gcGVzMm1wNFNjYWxlRmFjdG9yLCB0cmFjayk7XG4gICAgdHJhY2suc2FtcGxlcyA9IFtdO1xuICAgIHRoaXMub2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfREFUQSwge1xuICAgICAgZGF0YTE6IG1vb2YsXG4gICAgICBkYXRhMjogbWRhdCxcbiAgICAgIHN0YXJ0UFRTOiBmaXJzdFBUUyAvIHBlc1RpbWVTY2FsZSxcbiAgICAgIGVuZFBUUzogKGxhc3RQVFMgKyBwZXMybXA0U2NhbGVGYWN0b3IgKiBtcDRTYW1wbGVEdXJhdGlvbikgLyBwZXNUaW1lU2NhbGUsXG4gICAgICBzdGFydERUUzogZmlyc3REVFMgLyBwZXNUaW1lU2NhbGUsXG4gICAgICBlbmREVFM6IHRoaXMubmV4dEF2Y0R0cyAvIHBlc1RpbWVTY2FsZSxcbiAgICAgIHR5cGU6ICd2aWRlbycsXG4gICAgICBuYjogb3V0cHV0U2FtcGxlcy5sZW5ndGhcbiAgICB9KTtcbiAgfVxuXG4gIHJlbXV4QXVkaW8odHJhY2ssdGltZU9mZnNldCwgY29udGlndW91cykge1xuICAgIHZhciB2aWV3LFxuICAgICAgICBvZmZzZXQgPSA4LFxuICAgICAgICBwZXNUaW1lU2NhbGUgPSB0aGlzLlBFU19USU1FU0NBTEUsXG4gICAgICAgIGV4cGVjdGVkU2FtcGxlRHVyYXRpb24gPSB0cmFjay50aW1lc2NhbGUgKiAxMDI0IC8gdHJhY2suYXVkaW9zYW1wbGVyYXRlLFxuICAgICAgICBhYWNTYW1wbGUsIG1wNFNhbXBsZSxcbiAgICAgICAgdW5pdCxcbiAgICAgICAgbWRhdCwgbW9vZixcbiAgICAgICAgZmlyc3RQVFMsIGZpcnN0RFRTLCBsYXN0RFRTLFxuICAgICAgICBwdHMsIGR0cywgcHRzbm9ybSwgZHRzbm9ybSxcbiAgICAgICAgc2FtcGxlcyA9IFtdLFxuICAgICAgICBzYW1wbGVzMCA9IFtdO1xuXG4gICAgdHJhY2suc2FtcGxlcy5zb3J0KGZ1bmN0aW9uKGEsIGIpIHtcbiAgICAgIHJldHVybiAoYS5wdHMtYi5wdHMpO1xuICAgIH0pO1xuICAgIHNhbXBsZXMwID0gdHJhY2suc2FtcGxlcztcblxuICAgIHdoaWxlIChzYW1wbGVzMC5sZW5ndGgpIHtcbiAgICAgIGFhY1NhbXBsZSA9IHNhbXBsZXMwLnNoaWZ0KCk7XG4gICAgICB1bml0ID0gYWFjU2FtcGxlLnVuaXQ7XG4gICAgICBwdHMgPSBhYWNTYW1wbGUucHRzIC0gdGhpcy5faW5pdERUUztcbiAgICAgIGR0cyA9IGFhY1NhbXBsZS5kdHMgLSB0aGlzLl9pbml0RFRTO1xuICAgICAgLy9sb2dnZXIubG9nKGBBdWRpby9QVFM6JHtNYXRoLnJvdW5kKHB0cy85MCl9YCk7XG4gICAgICAvLyBpZiBub3QgZmlyc3Qgc2FtcGxlXG4gICAgICBpZiAobGFzdERUUyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHB0c25vcm0gPSB0aGlzLl9QVFNOb3JtYWxpemUocHRzLCBsYXN0RFRTKTtcbiAgICAgICAgZHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShkdHMsIGxhc3REVFMpO1xuICAgICAgICAvLyBsZXQncyBjb21wdXRlIHNhbXBsZSBkdXJhdGlvbi5cbiAgICAgICAgLy8gc2FtcGxlIER1cmF0aW9uIHNob3VsZCBiZSBjbG9zZSB0byBleHBlY3RlZFNhbXBsZUR1cmF0aW9uXG4gICAgICAgIG1wNFNhbXBsZS5kdXJhdGlvbiA9IChkdHNub3JtIC0gbGFzdERUUykgLyBwZXMybXA0U2NhbGVGYWN0b3I7XG4gICAgICAgIGlmKE1hdGguYWJzKG1wNFNhbXBsZS5kdXJhdGlvbiAtIGV4cGVjdGVkU2FtcGxlRHVyYXRpb24pID4gZXhwZWN0ZWRTYW1wbGVEdXJhdGlvbi8xMCkge1xuICAgICAgICAgIC8vIG1vcmUgdGhhbiAxMCUgZGlmZiBiZXR3ZWVuIHNhbXBsZSBkdXJhdGlvbiBhbmQgZXhwZWN0ZWRTYW1wbGVEdXJhdGlvbiAuLi4uIGxldHMgbG9nIHRoYXRcbiAgICAgICAgICBsb2dnZXIudHJhY2UoYGludmFsaWQgQUFDIHNhbXBsZSBkdXJhdGlvbiBhdCBQVFMgJHtNYXRoLnJvdW5kKHB0cy85MCl9LHNob3VsZCBiZSAxMDI0LGZvdW5kIDoke01hdGgucm91bmQobXA0U2FtcGxlLmR1cmF0aW9uKnRyYWNrLmF1ZGlvc2FtcGxlcmF0ZS90cmFjay50aW1lc2NhbGUpfWApO1xuICAgICAgICB9XG4gICAgICAgIC8vIGFsd2F5cyBhZGp1c3Qgc2FtcGxlIGR1cmF0aW9uIHRvIGF2b2lkIGF2IHN5bmMgaXNzdWVcbiAgICAgICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gZXhwZWN0ZWRTYW1wbGVEdXJhdGlvbjtcbiAgICAgICAgZHRzbm9ybSA9IGV4cGVjdGVkU2FtcGxlRHVyYXRpb24gKiBwZXMybXA0U2NhbGVGYWN0b3IgKyBsYXN0RFRTO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGV0IG5leHRBYWNQdHMsIGRlbHRhO1xuICAgICAgICBpZiAoY29udGlndW91cykge1xuICAgICAgICAgIG5leHRBYWNQdHMgPSB0aGlzLm5leHRBYWNQdHM7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbmV4dEFhY1B0cyA9IHRpbWVPZmZzZXQqcGVzVGltZVNjYWxlO1xuICAgICAgICB9XG4gICAgICAgIHB0c25vcm0gPSB0aGlzLl9QVFNOb3JtYWxpemUocHRzLCBuZXh0QWFjUHRzKTtcbiAgICAgICAgZHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShkdHMsIG5leHRBYWNQdHMpO1xuICAgICAgICBkZWx0YSA9IE1hdGgucm91bmQoMTAwMCAqIChwdHNub3JtIC0gbmV4dEFhY1B0cykgLyBwZXNUaW1lU2NhbGUpO1xuICAgICAgICAvLyBpZiBmcmFnbWVudCBhcmUgY29udGlndW91cywgb3IgZGVsdGEgbGVzcyB0aGFuIDYwMG1zLCBlbnN1cmUgdGhlcmUgaXMgbm8gb3ZlcmxhcC9ob2xlIGJldHdlZW4gZnJhZ21lbnRzXG4gICAgICAgIGlmIChjb250aWd1b3VzIHx8IE1hdGguYWJzKGRlbHRhKSA8IDYwMCkge1xuICAgICAgICAgIC8vIGxvZyBkZWx0YVxuICAgICAgICAgIGlmIChkZWx0YSkge1xuICAgICAgICAgICAgaWYgKGRlbHRhID4gMCkge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGAke2RlbHRhfSBtcyBob2xlIGJldHdlZW4gQUFDIHNhbXBsZXMgZGV0ZWN0ZWQsZmlsbGluZyBpdGApO1xuICAgICAgICAgICAgICAvLyBpZiB3ZSBoYXZlIGZyYW1lIG92ZXJsYXAsIG92ZXJsYXBwaW5nIGZvciBtb3JlIHRoYW4gaGFsZiBhIGZyYW1lIGR1cmFpb25cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZGVsdGEgPCAtMTIpIHtcbiAgICAgICAgICAgICAgLy8gZHJvcCBvdmVybGFwcGluZyBhdWRpbyBmcmFtZXMuLi4gYnJvd3NlciB3aWxsIGRlYWwgd2l0aCBpdFxuICAgICAgICAgICAgICBsb2dnZXIubG9nKGAkeygtZGVsdGEpfSBtcyBvdmVybGFwcGluZyBiZXR3ZWVuIEFBQyBzYW1wbGVzIGRldGVjdGVkLCBkcm9wIGZyYW1lYCk7XG4gICAgICAgICAgICAgIHRyYWNrLmxlbiAtPSB1bml0LmJ5dGVMZW5ndGg7XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gc2V0IERUUyB0byBuZXh0IERUU1xuICAgICAgICAgICAgcHRzbm9ybSA9IGR0c25vcm0gPSBuZXh0QWFjUHRzO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyByZW1lbWJlciBmaXJzdCBQVFMgb2Ygb3VyIGFhY1NhbXBsZXMsIGVuc3VyZSB2YWx1ZSBpcyBwb3NpdGl2ZVxuICAgICAgICBmaXJzdFBUUyA9IE1hdGgubWF4KDAsIHB0c25vcm0pO1xuICAgICAgICBmaXJzdERUUyA9IE1hdGgubWF4KDAsIGR0c25vcm0pO1xuICAgICAgICBpZih0cmFjay5sZW4gPiAwKSB7XG4gICAgICAgICAgLyogY29uY2F0ZW5hdGUgdGhlIGF1ZGlvIGRhdGEgYW5kIGNvbnN0cnVjdCB0aGUgbWRhdCBpbiBwbGFjZVxuICAgICAgICAgICAgKG5lZWQgOCBtb3JlIGJ5dGVzIHRvIGZpbGwgbGVuZ3RoIGFuZCBtZGF0IHR5cGUpICovXG4gICAgICAgICAgbWRhdCA9IG5ldyBVaW50OEFycmF5KHRyYWNrLmxlbiArIDgpO1xuICAgICAgICAgIHZpZXcgPSBuZXcgRGF0YVZpZXcobWRhdC5idWZmZXIpO1xuICAgICAgICAgIHZpZXcuc2V0VWludDMyKDAsIG1kYXQuYnl0ZUxlbmd0aCk7XG4gICAgICAgICAgbWRhdC5zZXQoTVA0LnR5cGVzLm1kYXQsIDQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIG5vIGF1ZGlvIHNhbXBsZXNcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIG1kYXQuc2V0KHVuaXQsIG9mZnNldCk7XG4gICAgICBvZmZzZXQgKz0gdW5pdC5ieXRlTGVuZ3RoO1xuICAgICAgLy9jb25zb2xlLmxvZygnUFRTL0RUUy9pbml0RFRTL25vcm1QVFMvbm9ybURUUy9yZWxhdGl2ZSBQVFMgOiAke2FhY1NhbXBsZS5wdHN9LyR7YWFjU2FtcGxlLmR0c30vJHt0aGlzLl9pbml0RFRTfS8ke3B0c25vcm19LyR7ZHRzbm9ybX0vJHsoYWFjU2FtcGxlLnB0cy80Mjk0OTY3Mjk2KS50b0ZpeGVkKDMpfScpO1xuICAgICAgbXA0U2FtcGxlID0ge1xuICAgICAgICBzaXplOiB1bml0LmJ5dGVMZW5ndGgsXG4gICAgICAgIGN0czogMCxcbiAgICAgICAgZHVyYXRpb246MCxcbiAgICAgICAgZmxhZ3M6IHtcbiAgICAgICAgICBpc0xlYWRpbmc6IDAsXG4gICAgICAgICAgaXNEZXBlbmRlZE9uOiAwLFxuICAgICAgICAgIGhhc1JlZHVuZGFuY3k6IDAsXG4gICAgICAgICAgZGVncmFkUHJpbzogMCxcbiAgICAgICAgICBkZXBlbmRzT246IDEsXG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICBzYW1wbGVzLnB1c2gobXA0U2FtcGxlKTtcbiAgICAgIGxhc3REVFMgPSBkdHNub3JtO1xuICAgIH1cbiAgICB2YXIgbGFzdFNhbXBsZUR1cmF0aW9uID0gMDtcbiAgICB2YXIgbmJTYW1wbGVzID0gc2FtcGxlcy5sZW5ndGg7XG4gICAgLy9zZXQgbGFzdCBzYW1wbGUgZHVyYXRpb24gYXMgYmVpbmcgaWRlbnRpY2FsIHRvIHByZXZpb3VzIHNhbXBsZVxuICAgIGlmIChuYlNhbXBsZXMgPj0gMikge1xuICAgICAgbGFzdFNhbXBsZUR1cmF0aW9uID0gc2FtcGxlc1tuYlNhbXBsZXMgLSAyXS5kdXJhdGlvbjtcbiAgICAgIG1wNFNhbXBsZS5kdXJhdGlvbiA9IGxhc3RTYW1wbGVEdXJhdGlvbjtcbiAgICB9XG4gICAgaWYgKG5iU2FtcGxlcykge1xuICAgICAgLy8gbmV4dCBhYWMgc2FtcGxlIFBUUyBzaG91bGQgYmUgZXF1YWwgdG8gbGFzdCBzYW1wbGUgUFRTICsgZHVyYXRpb25cbiAgICAgIHRoaXMubmV4dEFhY1B0cyA9IHB0c25vcm0gKyBwZXMybXA0U2NhbGVGYWN0b3IgKiBsYXN0U2FtcGxlRHVyYXRpb247XG4gICAgICAvL2xvZ2dlci5sb2coJ0F1ZGlvL1BUUy9QVFNlbmQ6JyArIGFhY1NhbXBsZS5wdHMudG9GaXhlZCgwKSArICcvJyArIHRoaXMubmV4dEFhY0R0cy50b0ZpeGVkKDApKTtcbiAgICAgIHRyYWNrLmxlbiA9IDA7XG4gICAgICB0cmFjay5zYW1wbGVzID0gc2FtcGxlcztcbiAgICAgIG1vb2YgPSBNUDQubW9vZih0cmFjay5zZXF1ZW5jZU51bWJlcisrLCBmaXJzdERUUyAvIHBlczJtcDRTY2FsZUZhY3RvciwgdHJhY2spO1xuICAgICAgdHJhY2suc2FtcGxlcyA9IFtdO1xuICAgICAgdGhpcy5vYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLCB7XG4gICAgICAgIGRhdGExOiBtb29mLFxuICAgICAgICBkYXRhMjogbWRhdCxcbiAgICAgICAgc3RhcnRQVFM6IGZpcnN0UFRTIC8gcGVzVGltZVNjYWxlLFxuICAgICAgICBlbmRQVFM6IHRoaXMubmV4dEFhY1B0cyAvIHBlc1RpbWVTY2FsZSxcbiAgICAgICAgc3RhcnREVFM6IGZpcnN0RFRTIC8gcGVzVGltZVNjYWxlLFxuICAgICAgICBlbmREVFM6IChkdHNub3JtICsgcGVzMm1wNFNjYWxlRmFjdG9yICogbGFzdFNhbXBsZUR1cmF0aW9uKSAvIHBlc1RpbWVTY2FsZSxcbiAgICAgICAgdHlwZTogJ2F1ZGlvJyxcbiAgICAgICAgbmI6IG5iU2FtcGxlc1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgcmVtdXhJRDModHJhY2ssdGltZU9mZnNldCkge1xuICAgIHZhciBsZW5ndGggPSB0cmFjay5zYW1wbGVzLmxlbmd0aCwgc2FtcGxlO1xuICAgIC8vIGNvbnN1bWUgc2FtcGxlc1xuICAgIGlmKGxlbmd0aCkge1xuICAgICAgZm9yKHZhciBpbmRleCA9IDA7IGluZGV4IDwgbGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgIHNhbXBsZSA9IHRyYWNrLnNhbXBsZXNbaW5kZXhdO1xuICAgICAgICAvLyBzZXR0aW5nIGlkMyBwdHMsIGR0cyB0byByZWxhdGl2ZSB0aW1lXG4gICAgICAgIC8vIHVzaW5nIHRoaXMuX2luaXRQVFMgYW5kIHRoaXMuX2luaXREVFMgdG8gY2FsY3VsYXRlIHJlbGF0aXZlIHRpbWVcbiAgICAgICAgc2FtcGxlLnB0cyA9ICgoc2FtcGxlLnB0cyAtIHRoaXMuX2luaXRQVFMpIC8gdGhpcy5QRVNfVElNRVNDQUxFKTtcbiAgICAgICAgc2FtcGxlLmR0cyA9ICgoc2FtcGxlLmR0cyAtIHRoaXMuX2luaXREVFMpIC8gdGhpcy5QRVNfVElNRVNDQUxFKTtcbiAgICAgIH1cbiAgICAgIHRoaXMub2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfTUVUQURBVEEsIHtcbiAgICAgICAgc2FtcGxlczp0cmFjay5zYW1wbGVzXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICB0cmFjay5zYW1wbGVzID0gW107XG4gICAgdGltZU9mZnNldCA9IHRpbWVPZmZzZXQ7XG4gIH1cblxuICByZW11eFRleHQodHJhY2ssdGltZU9mZnNldCkge1xuICAgIHRyYWNrLnNhbXBsZXMuc29ydChmdW5jdGlvbihhLCBiKSB7XG4gICAgICByZXR1cm4gKGEucHRzLWIucHRzKTtcbiAgICB9KTtcblxuICAgIHZhciBsZW5ndGggPSB0cmFjay5zYW1wbGVzLmxlbmd0aCwgc2FtcGxlO1xuICAgIC8vIGNvbnN1bWUgc2FtcGxlc1xuICAgIGlmKGxlbmd0aCkge1xuICAgICAgZm9yKHZhciBpbmRleCA9IDA7IGluZGV4IDwgbGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgIHNhbXBsZSA9IHRyYWNrLnNhbXBsZXNbaW5kZXhdO1xuICAgICAgICAvLyBzZXR0aW5nIHRleHQgcHRzLCBkdHMgdG8gcmVsYXRpdmUgdGltZVxuICAgICAgICAvLyB1c2luZyB0aGlzLl9pbml0UFRTIGFuZCB0aGlzLl9pbml0RFRTIHRvIGNhbGN1bGF0ZSByZWxhdGl2ZSB0aW1lXG4gICAgICAgIHNhbXBsZS5wdHMgPSAoKHNhbXBsZS5wdHMgLSB0aGlzLl9pbml0UFRTKSAvIHRoaXMuUEVTX1RJTUVTQ0FMRSk7XG4gICAgICB9XG4gICAgICB0aGlzLm9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX1VTRVJEQVRBLCB7XG4gICAgICAgIHNhbXBsZXM6dHJhY2suc2FtcGxlc1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgdHJhY2suc2FtcGxlcyA9IFtdO1xuICAgIHRpbWVPZmZzZXQgPSB0aW1lT2Zmc2V0O1xuICB9XG5cbiAgX1BUU05vcm1hbGl6ZSh2YWx1ZSwgcmVmZXJlbmNlKSB7XG4gICAgdmFyIG9mZnNldDtcbiAgICBpZiAocmVmZXJlbmNlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG4gICAgaWYgKHJlZmVyZW5jZSA8IHZhbHVlKSB7XG4gICAgICAvLyAtIDJeMzNcbiAgICAgIG9mZnNldCA9IC04NTg5OTM0NTkyO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyArIDJeMzNcbiAgICAgIG9mZnNldCA9IDg1ODk5MzQ1OTI7XG4gICAgfVxuICAgIC8qIFBUUyBpcyAzM2JpdCAoZnJvbSAwIHRvIDJeMzMgLTEpXG4gICAgICBpZiBkaWZmIGJldHdlZW4gdmFsdWUgYW5kIHJlZmVyZW5jZSBpcyBiaWdnZXIgdGhhbiBoYWxmIG9mIHRoZSBhbXBsaXR1ZGUgKDJeMzIpIHRoZW4gaXQgbWVhbnMgdGhhdFxuICAgICAgUFRTIGxvb3Bpbmcgb2NjdXJlZC4gZmlsbCB0aGUgZ2FwICovXG4gICAgd2hpbGUgKE1hdGguYWJzKHZhbHVlIC0gcmVmZXJlbmNlKSA+IDQyOTQ5NjcyOTYpIHtcbiAgICAgICAgdmFsdWUgKz0gb2Zmc2V0O1xuICAgIH1cbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBNUDRSZW11eGVyO1xuIiwiLyoqXG4gKiBwYXNzdGhyb3VnaCByZW11eGVyXG4qL1xuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5cbmNsYXNzIFBhc3NUaHJvdWdoUmVtdXhlciB7XG4gIGNvbnN0cnVjdG9yKG9ic2VydmVyKSB7XG4gICAgdGhpcy5vYnNlcnZlciA9IG9ic2VydmVyO1xuICAgIHRoaXMuSVNHZW5lcmF0ZWQgPSBmYWxzZTtcbiAgfVxuXG4gIGdldCBwYXNzdGhyb3VnaCgpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gIH1cblxuICBpbnNlcnREaXNjb250aW51aXR5KCkge1xuICB9XG5cbiAgc3dpdGNoTGV2ZWwoKSB7XG4gICAgdGhpcy5JU0dlbmVyYXRlZCA9IGZhbHNlO1xuICB9XG5cbiAgcmVtdXgoYXVkaW9UcmFjayx2aWRlb1RyYWNrLGlkM1RyYWNrLHRleHRUcmFjayx0aW1lT2Zmc2V0LHJhd0RhdGEpIHtcbiAgICB2YXIgb2JzZXJ2ZXIgPSB0aGlzLm9ic2VydmVyO1xuICAgIC8vIGdlbmVyYXRlIEluaXQgU2VnbWVudCBpZiBuZWVkZWRcbiAgICBpZiAoIXRoaXMuSVNHZW5lcmF0ZWQpIHtcbiAgICAgIHZhciB0cmFja3MgPSB7fSxcbiAgICAgICAgICBkYXRhID0geyB0cmFja3MgOiB0cmFja3MsIHVuaXF1ZSA6IHRydWUgfSxcbiAgICAgICAgICB0cmFjayA9IHZpZGVvVHJhY2ssXG4gICAgICAgICAgY29kZWMgPSB0cmFjay5jb2RlYztcblxuICAgICAgaWYgKGNvZGVjKSB7XG4gICAgICAgIGRhdGEudHJhY2tzLnZpZGVvID0ge1xuICAgICAgICAgIGNvbnRhaW5lciA6IHRyYWNrLmNvbnRhaW5lcixcbiAgICAgICAgICBjb2RlYyA6ICBjb2RlYyxcbiAgICAgICAgICBtZXRhZGF0YSA6IHtcbiAgICAgICAgICAgIHdpZHRoIDogdHJhY2sud2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQgOiB0cmFjay5oZWlnaHRcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9XG5cbiAgICAgIHRyYWNrID0gYXVkaW9UcmFjaztcbiAgICAgIGNvZGVjID0gdHJhY2suY29kZWM7XG4gICAgICBpZiAoY29kZWMpIHtcbiAgICAgICAgZGF0YS50cmFja3MuYXVkaW8gPSB7XG4gICAgICAgICAgY29udGFpbmVyIDogdHJhY2suY29udGFpbmVyLFxuICAgICAgICAgIGNvZGVjIDogIGNvZGVjLFxuICAgICAgICAgIG1ldGFkYXRhIDoge1xuICAgICAgICAgICAgY2hhbm5lbENvdW50IDogdHJhY2suY2hhbm5lbENvdW50XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgdGhpcy5JU0dlbmVyYXRlZCA9IHRydWU7XG4gICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQsZGF0YSk7XG4gICAgfVxuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0RBVEEsIHtcbiAgICAgIGRhdGExOiByYXdEYXRhLFxuICAgICAgc3RhcnRQVFM6IHRpbWVPZmZzZXQsXG4gICAgICBzdGFydERUUzogdGltZU9mZnNldCxcbiAgICAgIHR5cGU6ICdhdWRpb3ZpZGVvJyxcbiAgICAgIG5iOiAxXG4gICAgfSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgUGFzc1Rocm91Z2hSZW11eGVyO1xuIiwiXG4vLyBhZGFwdGVkIGZyb20gaHR0cHM6Ly9naXRodWIuY29tL2thbm9uZ2lsL25vZGUtbTN1OHBhcnNlL2Jsb2IvbWFzdGVyL2F0dHJsaXN0LmpzXG5jbGFzcyBBdHRyTGlzdCB7XG5cbiAgY29uc3RydWN0b3IoYXR0cnMpIHtcbiAgICBpZiAodHlwZW9mIGF0dHJzID09PSAnc3RyaW5nJykge1xuICAgICAgYXR0cnMgPSBBdHRyTGlzdC5wYXJzZUF0dHJMaXN0KGF0dHJzKTtcbiAgICB9XG4gICAgZm9yKHZhciBhdHRyIGluIGF0dHJzKXtcbiAgICAgIGlmKGF0dHJzLmhhc093blByb3BlcnR5KGF0dHIpKSB7XG4gICAgICAgIHRoaXNbYXR0cl0gPSBhdHRyc1thdHRyXTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBkZWNpbWFsSW50ZWdlcihhdHRyTmFtZSkge1xuICAgIGNvbnN0IGludFZhbHVlID0gcGFyc2VJbnQodGhpc1thdHRyTmFtZV0sIDEwKTtcbiAgICBpZiAoaW50VmFsdWUgPiBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUikge1xuICAgICAgcmV0dXJuIEluZmluaXR5O1xuICAgIH1cbiAgICByZXR1cm4gaW50VmFsdWU7XG4gIH1cblxuICBoZXhhZGVjaW1hbEludGVnZXIoYXR0ck5hbWUpIHtcbiAgICBpZih0aGlzW2F0dHJOYW1lXSkge1xuICAgICAgbGV0IHN0cmluZ1ZhbHVlID0gKHRoaXNbYXR0ck5hbWVdIHx8ICcweCcpLnNsaWNlKDIpO1xuICAgICAgc3RyaW5nVmFsdWUgPSAoKHN0cmluZ1ZhbHVlLmxlbmd0aCAmIDEpID8gJzAnIDogJycpICsgc3RyaW5nVmFsdWU7XG5cbiAgICAgIGNvbnN0IHZhbHVlID0gbmV3IFVpbnQ4QXJyYXkoc3RyaW5nVmFsdWUubGVuZ3RoIC8gMik7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0cmluZ1ZhbHVlLmxlbmd0aCAvIDI7IGkrKykge1xuICAgICAgICB2YWx1ZVtpXSA9IHBhcnNlSW50KHN0cmluZ1ZhbHVlLnNsaWNlKGkgKiAyLCBpICogMiArIDIpLCAxNik7XG4gICAgICB9XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGhleGFkZWNpbWFsSW50ZWdlckFzTnVtYmVyKGF0dHJOYW1lKSB7XG4gICAgY29uc3QgaW50VmFsdWUgPSBwYXJzZUludCh0aGlzW2F0dHJOYW1lXSwgMTYpO1xuICAgIGlmIChpbnRWYWx1ZSA+IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSKSB7XG4gICAgICByZXR1cm4gSW5maW5pdHk7XG4gICAgfVxuICAgIHJldHVybiBpbnRWYWx1ZTtcbiAgfVxuXG4gIGRlY2ltYWxGbG9hdGluZ1BvaW50KGF0dHJOYW1lKSB7XG4gICAgcmV0dXJuIHBhcnNlRmxvYXQodGhpc1thdHRyTmFtZV0pO1xuICB9XG5cbiAgZW51bWVyYXRlZFN0cmluZyhhdHRyTmFtZSkge1xuICAgIHJldHVybiB0aGlzW2F0dHJOYW1lXTtcbiAgfVxuXG4gIGRlY2ltYWxSZXNvbHV0aW9uKGF0dHJOYW1lKSB7XG4gICAgY29uc3QgcmVzID0gL14oXFxkKyl4KFxcZCspJC8uZXhlYyh0aGlzW2F0dHJOYW1lXSk7XG4gICAgaWYgKHJlcyA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIHdpZHRoOiBwYXJzZUludChyZXNbMV0sIDEwKSxcbiAgICAgIGhlaWdodDogcGFyc2VJbnQocmVzWzJdLCAxMClcbiAgICB9O1xuICB9XG5cbiAgc3RhdGljIHBhcnNlQXR0ckxpc3QoaW5wdXQpIHtcbiAgICBjb25zdCByZSA9IC9cXHMqKC4rPylcXHMqPSgoPzpcXFwiLio/XFxcIil8Lio/KSg/Oix8JCkvZztcbiAgICB2YXIgbWF0Y2gsIGF0dHJzID0ge307XG4gICAgd2hpbGUgKChtYXRjaCA9IHJlLmV4ZWMoaW5wdXQpKSAhPT0gbnVsbCkge1xuICAgICAgdmFyIHZhbHVlID0gbWF0Y2hbMl0sIHF1b3RlID0gJ1wiJztcblxuICAgICAgaWYgKHZhbHVlLmluZGV4T2YocXVvdGUpID09PSAwICYmXG4gICAgICAgICAgdmFsdWUubGFzdEluZGV4T2YocXVvdGUpID09PSAodmFsdWUubGVuZ3RoLTEpKSB7XG4gICAgICAgIHZhbHVlID0gdmFsdWUuc2xpY2UoMSwgLTEpO1xuICAgICAgfVxuICAgICAgYXR0cnNbbWF0Y2hbMV1dID0gdmFsdWU7XG4gICAgfVxuICAgIHJldHVybiBhdHRycztcbiAgfVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IEF0dHJMaXN0O1xuIiwidmFyIEJpbmFyeVNlYXJjaCA9IHtcbiAgICAvKipcbiAgICAgKiBTZWFyY2hlcyBmb3IgYW4gaXRlbSBpbiBhbiBhcnJheSB3aGljaCBtYXRjaGVzIGEgY2VydGFpbiBjb25kaXRpb24uXG4gICAgICogVGhpcyByZXF1aXJlcyB0aGUgY29uZGl0aW9uIHRvIG9ubHkgbWF0Y2ggb25lIGl0ZW0gaW4gdGhlIGFycmF5LFxuICAgICAqIGFuZCBmb3IgdGhlIGFycmF5IHRvIGJlIG9yZGVyZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBsaXN0IFRoZSBhcnJheSB0byBzZWFyY2guXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gY29tcGFyaXNvbkZ1bmN0aW9uXG4gICAgICogICAgICBDYWxsZWQgYW5kIHByb3ZpZGVkIGEgY2FuZGlkYXRlIGl0ZW0gYXMgdGhlIGZpcnN0IGFyZ3VtZW50LlxuICAgICAqICAgICAgU2hvdWxkIHJldHVybjpcbiAgICAgKiAgICAgICAgICA+IC0xIGlmIHRoZSBpdGVtIHNob3VsZCBiZSBsb2NhdGVkIGF0IGEgbG93ZXIgaW5kZXggdGhhbiB0aGUgcHJvdmlkZWQgaXRlbS5cbiAgICAgKiAgICAgICAgICA+IDEgaWYgdGhlIGl0ZW0gc2hvdWxkIGJlIGxvY2F0ZWQgYXQgYSBoaWdoZXIgaW5kZXggdGhhbiB0aGUgcHJvdmlkZWQgaXRlbS5cbiAgICAgKiAgICAgICAgICA+IDAgaWYgdGhlIGl0ZW0gaXMgdGhlIGl0ZW0geW91J3JlIGxvb2tpbmcgZm9yLlxuICAgICAqXG4gICAgICogQHJldHVybiB7Kn0gVGhlIG9iamVjdCBpZiBpdCBpcyBmb3VuZCBvciBudWxsIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBzZWFyY2g6IGZ1bmN0aW9uKGxpc3QsIGNvbXBhcmlzb25GdW5jdGlvbikge1xuICAgICAgICB2YXIgbWluSW5kZXggPSAwO1xuICAgICAgICB2YXIgbWF4SW5kZXggPSBsaXN0Lmxlbmd0aCAtIDE7XG4gICAgICAgIHZhciBjdXJyZW50SW5kZXggPSBudWxsO1xuICAgICAgICB2YXIgY3VycmVudEVsZW1lbnQgPSBudWxsO1xuICAgICBcbiAgICAgICAgd2hpbGUgKG1pbkluZGV4IDw9IG1heEluZGV4KSB7XG4gICAgICAgICAgICBjdXJyZW50SW5kZXggPSAobWluSW5kZXggKyBtYXhJbmRleCkgLyAyIHwgMDtcbiAgICAgICAgICAgIGN1cnJlbnRFbGVtZW50ID0gbGlzdFtjdXJyZW50SW5kZXhdO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB2YXIgY29tcGFyaXNvblJlc3VsdCA9IGNvbXBhcmlzb25GdW5jdGlvbihjdXJyZW50RWxlbWVudCk7XG4gICAgICAgICAgICBpZiAoY29tcGFyaXNvblJlc3VsdCA+IDApIHtcbiAgICAgICAgICAgICAgICBtaW5JbmRleCA9IGN1cnJlbnRJbmRleCArIDE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChjb21wYXJpc29uUmVzdWx0IDwgMCkge1xuICAgICAgICAgICAgICAgIG1heEluZGV4ID0gY3VycmVudEluZGV4IC0gMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBjdXJyZW50RWxlbWVudDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICBcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBCaW5hcnlTZWFyY2g7XG4iLCIvKlxuICogQ0VBLTcwOCBpbnRlcnByZXRlclxuKi9cblxuY2xhc3MgQ0VBNzA4SW50ZXJwcmV0ZXIge1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICB9XG5cbiAgYXR0YWNoKG1lZGlhKSB7XG4gICAgdGhpcy5tZWRpYSA9IG1lZGlhO1xuICAgIHRoaXMuZGlzcGxheSA9IFtdO1xuICAgIHRoaXMubWVtb3J5ID0gW107XG4gIH1cblxuICBkZXRhY2goKVxuICB7XG4gICAgdGhpcy5jbGVhcigpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgfVxuXG4gIF9jcmVhdGVDdWUoKVxuICB7XG4gICAgdmFyIFZUVEN1ZSA9IHdpbmRvdy5WVFRDdWUgfHwgd2luZG93LlRleHRUcmFja0N1ZTtcblxuICAgIHZhciBjdWUgPSB0aGlzLmN1ZSA9IG5ldyBWVFRDdWUoLTEsIC0xLCAnJyk7XG4gICAgY3VlLnRleHQgPSAnJztcbiAgICBjdWUucGF1c2VPbkV4aXQgPSBmYWxzZTtcblxuICAgIC8vIG1ha2Ugc3VyZSBpdCBkb2Vzbid0IHNob3cgdXAgYmVmb3JlIGl0J3MgcmVhZHlcbiAgICBjdWUuc3RhcnRUaW1lID0gTnVtYmVyLk1BWF9WQUxVRTtcblxuICAgIC8vIHNob3cgaXQgJ2ZvcmV2ZXInIG9uY2Ugd2UgZG8gc2hvdyBpdFxuICAgIC8vICh3ZSdsbCBzZXQgdGhlIGVuZCB0aW1lIG9uY2Ugd2Uga25vdyBpdCBsYXRlcilcbiAgICBjdWUuZW5kVGltZSA9IE51bWJlci5NQVhfVkFMVUU7XG5cbiAgICB0aGlzLm1lbW9yeS5wdXNoKGN1ZSk7XG4gIH1cblxuICBjbGVhcigpXG4gIHtcbiAgICB2YXIgdGV4dFRyYWNrID0gdGhpcy5fdGV4dFRyYWNrO1xuICAgIGlmICh0ZXh0VHJhY2sgJiYgdGV4dFRyYWNrLmN1ZXMpXG4gICAge1xuICAgICAgd2hpbGUgKHRleHRUcmFjay5jdWVzLmxlbmd0aCA+IDApXG4gICAgICB7XG4gICAgICAgIHRleHRUcmFjay5yZW1vdmVDdWUodGV4dFRyYWNrLmN1ZXNbMF0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHB1c2godGltZXN0YW1wLCBieXRlcylcbiAge1xuICAgIGlmICghdGhpcy5jdWUpXG4gICAge1xuICAgICAgdGhpcy5fY3JlYXRlQ3VlKCk7XG4gICAgfVxuXG4gICAgdmFyIGNvdW50ID0gYnl0ZXNbMF0gJiAzMTtcbiAgICB2YXIgcG9zaXRpb24gPSAyO1xuICAgIHZhciB0bXBCeXRlLCBjY2J5dGUxLCBjY2J5dGUyLCBjY1ZhbGlkLCBjY1R5cGU7XG5cbiAgICBmb3IgKHZhciBqPTA7IGo8Y291bnQ7IGorKylcbiAgICB7XG4gICAgICB0bXBCeXRlID0gYnl0ZXNbcG9zaXRpb24rK107XG4gICAgICBjY2J5dGUxID0gMHg3RiAmIGJ5dGVzW3Bvc2l0aW9uKytdO1xuICAgICAgY2NieXRlMiA9IDB4N0YgJiBieXRlc1twb3NpdGlvbisrXTtcbiAgICAgIGNjVmFsaWQgPSAoKDQgJiB0bXBCeXRlKSA9PT0gMCA/IGZhbHNlIDogdHJ1ZSk7XG4gICAgICBjY1R5cGUgPSAoMyAmIHRtcEJ5dGUpO1xuXG4gICAgICBpZiAoY2NieXRlMSA9PT0gMCAmJiBjY2J5dGUyID09PSAwKVxuICAgICAge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKGNjVmFsaWQpXG4gICAgICB7XG4gICAgICAgIGlmIChjY1R5cGUgPT09IDApIC8vIHx8IGNjVHlwZSA9PT0gMVxuICAgICAgICB7XG4gICAgICAgICAgLy8gU3RhbmRhcmQgQ2hhcmFjdGVyc1xuICAgICAgICAgIGlmICgweDIwICYgY2NieXRlMSB8fCAweDQwICYgY2NieXRlMSlcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9IHRoaXMuX2Zyb21DaGFyQ29kZShjY2J5dGUxKSArIHRoaXMuX2Zyb21DaGFyQ29kZShjY2J5dGUyKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gU3BlY2lhbCBDaGFyYWN0ZXJzXG4gICAgICAgICAgZWxzZSBpZiAoKGNjYnl0ZTEgPT09IDB4MTEgfHwgY2NieXRlMSA9PT0gMHgxOSkgJiYgY2NieXRlMiA+PSAweDMwICYmIGNjYnl0ZTIgPD0gMHgzRilcbiAgICAgICAgICB7XG4gICAgICAgICAgICAvLyBleHRlbmRlZCBjaGFycywgZS5nLiBtdXNpY2FsIG5vdGUsIGFjY2VudHNcbiAgICAgICAgICAgIHN3aXRjaCAoY2NieXRlMilcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgY2FzZSA0ODpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICfCric7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNDk6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAnwrAnO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDUwOlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gJ8K9JztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA1MTpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICfCvyc7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNTI6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAn4oSiJztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA1MzpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICfCoic7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNTQ6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAnJztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA1NTpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICfCoyc7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNTY6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAn4pmqJztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA1NzpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICcgJztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA1ODpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICfDqCc7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNTk6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAnw6InO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDYwOlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gJ8OqJztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA2MTpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICfDric7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNjI6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAnw7QnO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDYzOlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gJ8O7JztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKChjY2J5dGUxID09PSAweDExIHx8IGNjYnl0ZTEgPT09IDB4MTkpICYmIGNjYnl0ZTIgPj0gMHgyMCAmJiBjY2J5dGUyIDw9IDB4MkYpXG4gICAgICAgICAge1xuICAgICAgICAgICAgLy8gTWlkLXJvdyBjb2RlczogY29sb3IvdW5kZXJsaW5lXG4gICAgICAgICAgICBzd2l0Y2ggKGNjYnl0ZTIpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGNhc2UgMHgyMDpcbiAgICAgICAgICAgICAgICAvLyBXaGl0ZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjE6XG4gICAgICAgICAgICAgICAgLy8gV2hpdGUgVW5kZXJsaW5lXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyMjpcbiAgICAgICAgICAgICAgICAvLyBHcmVlblxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjM6XG4gICAgICAgICAgICAgICAgLy8gR3JlZW4gVW5kZXJsaW5lXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyNDpcbiAgICAgICAgICAgICAgICAvLyBCbHVlXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyNTpcbiAgICAgICAgICAgICAgICAvLyBCbHVlIFVuZGVybGluZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjY6XG4gICAgICAgICAgICAgICAgLy8gQ3lhblxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4Mjc6XG4gICAgICAgICAgICAgICAgLy8gQ3lhbiBVbmRlcmxpbmVcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDI4OlxuICAgICAgICAgICAgICAgIC8vIFJlZFxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4Mjk6XG4gICAgICAgICAgICAgICAgLy8gUmVkIFVuZGVybGluZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkE6XG4gICAgICAgICAgICAgICAgLy8gWWVsbG93XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyQjpcbiAgICAgICAgICAgICAgICAvLyBZZWxsb3cgVW5kZXJsaW5lXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyQzpcbiAgICAgICAgICAgICAgICAvLyBNYWdlbnRhXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyRDpcbiAgICAgICAgICAgICAgICAvLyBNYWdlbnRhIFVuZGVybGluZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkU6XG4gICAgICAgICAgICAgICAgLy8gSXRhbGljc1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkY6XG4gICAgICAgICAgICAgICAgLy8gSXRhbGljcyBVbmRlcmxpbmVcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKChjY2J5dGUxID09PSAweDE0IHx8IGNjYnl0ZTEgPT09IDB4MUMpICYmIGNjYnl0ZTIgPj0gMHgyMCAmJiBjY2J5dGUyIDw9IDB4MkYpXG4gICAgICAgICAge1xuICAgICAgICAgICAgLy8gTWlkLXJvdyBjb2RlczogY29sb3IvdW5kZXJsaW5lXG4gICAgICAgICAgICBzd2l0Y2ggKGNjYnl0ZTIpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGNhc2UgMHgyMDpcbiAgICAgICAgICAgICAgICAvLyBUT0RPOiBzaG91bGRuJ3QgYWZmZWN0IHJvbGwtdXBzLi4uXG4gICAgICAgICAgICAgICAgdGhpcy5fY2xlYXJBY3RpdmVDdWVzKHRpbWVzdGFtcCk7XG4gICAgICAgICAgICAgICAgLy8gUkNMOiBSZXN1bWUgQ2FwdGlvbiBMb2FkaW5nXG4gICAgICAgICAgICAgICAgLy8gYmVnaW4gcG9wIG9uXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyMTpcbiAgICAgICAgICAgICAgICAvLyBCUzogQmFja3NwYWNlXG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCA9IHRoaXMuY3VlLnRleHQuc3Vic3RyKDAsIHRoaXMuY3VlLnRleHQubGVuZ3RoLTEpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjI6XG4gICAgICAgICAgICAgICAgLy8gQU9GOiByZXNlcnZlZCAoZm9ybWVybHkgYWxhcm0gb2ZmKVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjM6XG4gICAgICAgICAgICAgICAgLy8gQU9OOiByZXNlcnZlZCAoZm9ybWVybHkgYWxhcm0gb24pXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyNDpcbiAgICAgICAgICAgICAgICAvLyBERVI6IERlbGV0ZSB0byBlbmQgb2Ygcm93XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyNTpcbiAgICAgICAgICAgICAgICAvLyBSVTI6IHJvbGwtdXAgMiByb3dzXG4gICAgICAgICAgICAgICAgLy90aGlzLl9yb2xsdXAoMik7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyNjpcbiAgICAgICAgICAgICAgICAvLyBSVTM6IHJvbGwtdXAgMyByb3dzXG4gICAgICAgICAgICAgICAgLy90aGlzLl9yb2xsdXAoMyk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyNzpcbiAgICAgICAgICAgICAgICAvLyBSVTQ6IHJvbGwtdXAgNCByb3dzXG4gICAgICAgICAgICAgICAgLy90aGlzLl9yb2xsdXAoNCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyODpcbiAgICAgICAgICAgICAgICAvLyBGT046IEZsYXNoIG9uXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyOTpcbiAgICAgICAgICAgICAgICAvLyBSREM6IFJlc3VtZSBkaXJlY3QgY2FwdGlvbmluZ1xuICAgICAgICAgICAgICAgIHRoaXMuX2NsZWFyQWN0aXZlQ3Vlcyh0aW1lc3RhbXApO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkE6XG4gICAgICAgICAgICAgICAgLy8gVFI6IFRleHQgUmVzdGFydFxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkI6XG4gICAgICAgICAgICAgICAgLy8gUlREOiBSZXN1bWUgVGV4dCBEaXNwbGF5XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyQzpcbiAgICAgICAgICAgICAgICAvLyBFRE06IEVyYXNlIERpc3BsYXllZCBNZW1vcnlcbiAgICAgICAgICAgICAgICB0aGlzLl9jbGVhckFjdGl2ZUN1ZXModGltZXN0YW1wKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDJEOlxuICAgICAgICAgICAgICAgIC8vIENSOiBDYXJyaWFnZSBSZXR1cm5cbiAgICAgICAgICAgICAgICAvLyBvbmx5IGFmZmVjdHMgcm9sbC11cFxuICAgICAgICAgICAgICAgIC8vdGhpcy5fcm9sbHVwKDEpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkU6XG4gICAgICAgICAgICAgICAgLy8gRU5NOiBFcmFzZSBub24tZGlzcGxheWVkIG1lbW9yeVxuICAgICAgICAgICAgICAgIHRoaXMuX3RleHQgPSAnJztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDJGOlxuICAgICAgICAgICAgICAgIHRoaXMuX2ZsaXBNZW1vcnkodGltZXN0YW1wKTtcbiAgICAgICAgICAgICAgICAvLyBFT0M6IEVuZCBvZiBjYXB0aW9uXG4gICAgICAgICAgICAgICAgLy8gaGlkZSBhbnkgZGlzcGxheWVkIGNhcHRpb25zIGFuZCBzaG93IGFueSBoaWRkZW4gb25lXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICgoY2NieXRlMSA9PT0gMHgxNyB8fCBjY2J5dGUxID09PSAweDFGKSAmJiBjY2J5dGUyID49IDB4MjEgJiYgY2NieXRlMiA8PSAweDIzKVxuICAgICAgICAgIHtcbiAgICAgICAgICAgIC8vIE1pZC1yb3cgY29kZXM6IGNvbG9yL3VuZGVybGluZVxuICAgICAgICAgICAgc3dpdGNoIChjY2J5dGUyKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBjYXNlIDB4MjE6XG4gICAgICAgICAgICAgICAgLy8gVE8xOiB0YWIgb2Zmc2V0IDEgY29sdW1uXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyMjpcbiAgICAgICAgICAgICAgICAvLyBUTzE6IHRhYiBvZmZzZXQgMiBjb2x1bW5cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDIzOlxuICAgICAgICAgICAgICAgIC8vIFRPMTogdGFiIG9mZnNldCAzIGNvbHVtblxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIC8vIFByb2JhYmx5IGEgcHJlLWFtYmxlIGFkZHJlc3MgY29kZVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIF9mcm9tQ2hhckNvZGUodG1wQnl0ZSlcbiAge1xuICAgIHN3aXRjaCAodG1wQnl0ZSlcbiAgICB7XG4gICAgICBjYXNlIDQyOlxuICAgICAgICByZXR1cm4gJ8OhJztcblxuICAgICAgY2FzZSAyOlxuICAgICAgICByZXR1cm4gJ8OhJztcblxuICAgICAgY2FzZSAyOlxuICAgICAgICByZXR1cm4gJ8OpJztcblxuICAgICAgY2FzZSA0OlxuICAgICAgICByZXR1cm4gJ8OtJztcblxuICAgICAgY2FzZSA1OlxuICAgICAgICByZXR1cm4gJ8OzJztcblxuICAgICAgY2FzZSA2OlxuICAgICAgICByZXR1cm4gJ8O6JztcblxuICAgICAgY2FzZSAzOlxuICAgICAgICByZXR1cm4gJ8OnJztcblxuICAgICAgY2FzZSA0OlxuICAgICAgICByZXR1cm4gJ8O3JztcblxuICAgICAgY2FzZSA1OlxuICAgICAgICByZXR1cm4gJ8ORJztcblxuICAgICAgY2FzZSA2OlxuICAgICAgICByZXR1cm4gJ8OxJztcblxuICAgICAgY2FzZSA3OlxuICAgICAgICByZXR1cm4gJ+KWiCc7XG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKHRtcEJ5dGUpO1xuICAgIH1cbiAgfVxuXG4gIF9mbGlwTWVtb3J5KHRpbWVzdGFtcClcbiAge1xuICAgIHRoaXMuX2NsZWFyQWN0aXZlQ3Vlcyh0aW1lc3RhbXApO1xuICAgIHRoaXMuX2ZsdXNoQ2FwdGlvbnModGltZXN0YW1wKTtcbiAgfVxuXG4gIF9mbHVzaENhcHRpb25zKHRpbWVzdGFtcClcbiAge1xuICAgIGlmICghdGhpcy5faGFzNzA4KVxuICAgIHtcbiAgICAgIHRoaXMuX3RleHRUcmFjayA9IHRoaXMubWVkaWEuYWRkVGV4dFRyYWNrKCdjYXB0aW9ucycsICdFbmdsaXNoJywgJ2VuJyk7XG4gICAgICB0aGlzLl9oYXM3MDggPSB0cnVlO1xuICAgIH1cblxuICAgIGZvcihsZXQgbWVtb3J5SXRlbSBvZiB0aGlzLm1lbW9yeSlcbiAgICB7XG4gICAgICBtZW1vcnlJdGVtLnN0YXJ0VGltZSA9IHRpbWVzdGFtcDtcbiAgICAgIHRoaXMuX3RleHRUcmFjay5hZGRDdWUobWVtb3J5SXRlbSk7XG4gICAgICB0aGlzLmRpc3BsYXkucHVzaChtZW1vcnlJdGVtKTtcbiAgICB9XG5cbiAgICB0aGlzLm1lbW9yeSA9IFtdO1xuICAgIHRoaXMuY3VlID0gbnVsbDtcbiAgfVxuXG4gIF9jbGVhckFjdGl2ZUN1ZXModGltZXN0YW1wKVxuICB7XG4gICAgZm9yIChsZXQgZGlzcGxheUl0ZW0gb2YgdGhpcy5kaXNwbGF5KVxuICAgIHtcbiAgICAgIGRpc3BsYXlJdGVtLmVuZFRpbWUgPSB0aW1lc3RhbXA7XG4gICAgfVxuXG4gICAgdGhpcy5kaXNwbGF5ID0gW107XG4gIH1cblxuLyogIF9yb2xsVXAobilcbiAge1xuICAgIC8vIFRPRE86IGltcGxlbWVudCByb2xsLXVwIGNhcHRpb25zXG4gIH1cbiovXG4gIF9jbGVhckJ1ZmZlcmVkQ3VlcygpXG4gIHtcbiAgICAvL3JlbW92ZSB0aGVtIGFsbC4uLlxuICB9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgQ0VBNzA4SW50ZXJwcmV0ZXI7XG5cbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbmNvbnN0IGZha2VMb2dnZXIgPSB7XG4gIHRyYWNlOiBub29wLFxuICBkZWJ1Zzogbm9vcCxcbiAgbG9nOiBub29wLFxuICB3YXJuOiBub29wLFxuICBpbmZvOiBub29wLFxuICBlcnJvcjogbm9vcFxufTtcblxubGV0IGV4cG9ydGVkTG9nZ2VyID0gZmFrZUxvZ2dlcjtcblxuLy9sZXQgbGFzdENhbGxUaW1lO1xuLy8gZnVuY3Rpb24gZm9ybWF0TXNnV2l0aFRpbWVJbmZvKHR5cGUsIG1zZykge1xuLy8gICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuLy8gICBjb25zdCBkaWZmID0gbGFzdENhbGxUaW1lID8gJysnICsgKG5vdyAtIGxhc3RDYWxsVGltZSkgOiAnMCc7XG4vLyAgIGxhc3RDYWxsVGltZSA9IG5vdztcbi8vICAgbXNnID0gKG5ldyBEYXRlKG5vdykpLnRvSVNPU3RyaW5nKCkgKyAnIHwgWycgKyAgdHlwZSArICddID4gJyArIG1zZyArICcgKCAnICsgZGlmZiArICcgbXMgKSc7XG4vLyAgIHJldHVybiBtc2c7XG4vLyB9XG5cbmZ1bmN0aW9uIGZvcm1hdE1zZyh0eXBlLCBtc2cpIHtcbiAgbXNnID0gJ1snICsgIHR5cGUgKyAnXSA+ICcgKyBtc2c7XG4gIHJldHVybiBtc2c7XG59XG5cbmZ1bmN0aW9uIGNvbnNvbGVQcmludEZuKHR5cGUpIHtcbiAgY29uc3QgZnVuYyA9IHdpbmRvdy5jb25zb2xlW3R5cGVdO1xuICBpZiAoZnVuYykge1xuICAgIHJldHVybiBmdW5jdGlvbiguLi5hcmdzKSB7XG4gICAgICBpZihhcmdzWzBdKSB7XG4gICAgICAgIGFyZ3NbMF0gPSBmb3JtYXRNc2codHlwZSwgYXJnc1swXSk7XG4gICAgICB9XG4gICAgICBmdW5jLmFwcGx5KHdpbmRvdy5jb25zb2xlLCBhcmdzKTtcbiAgICB9O1xuICB9XG4gIHJldHVybiBub29wO1xufVxuXG5mdW5jdGlvbiBleHBvcnRMb2dnZXJGdW5jdGlvbnMoZGVidWdDb25maWcsIC4uLmZ1bmN0aW9ucykge1xuICBmdW5jdGlvbnMuZm9yRWFjaChmdW5jdGlvbih0eXBlKSB7XG4gICAgZXhwb3J0ZWRMb2dnZXJbdHlwZV0gPSBkZWJ1Z0NvbmZpZ1t0eXBlXSA/IGRlYnVnQ29uZmlnW3R5cGVdLmJpbmQoZGVidWdDb25maWcpIDogY29uc29sZVByaW50Rm4odHlwZSk7XG4gIH0pO1xufVxuXG5leHBvcnQgdmFyIGVuYWJsZUxvZ3MgPSBmdW5jdGlvbihkZWJ1Z0NvbmZpZykge1xuICBpZiAoZGVidWdDb25maWcgPT09IHRydWUgfHwgdHlwZW9mIGRlYnVnQ29uZmlnID09PSAnb2JqZWN0Jykge1xuICAgIGV4cG9ydExvZ2dlckZ1bmN0aW9ucyhkZWJ1Z0NvbmZpZyxcbiAgICAgIC8vIFJlbW92ZSBvdXQgZnJvbSBsaXN0IGhlcmUgdG8gaGFyZC1kaXNhYmxlIGEgbG9nLWxldmVsXG4gICAgICAvLyd0cmFjZScsXG4gICAgICAnZGVidWcnLFxuICAgICAgJ2xvZycsXG4gICAgICAnaW5mbycsXG4gICAgICAnd2FybicsXG4gICAgICAnZXJyb3InXG4gICAgKTtcbiAgICAvLyBTb21lIGJyb3dzZXJzIGRvbid0IGFsbG93IHRvIHVzZSBiaW5kIG9uIGNvbnNvbGUgb2JqZWN0IGFueXdheVxuICAgIC8vIGZhbGxiYWNrIHRvIGRlZmF1bHQgaWYgbmVlZGVkXG4gICAgdHJ5IHtcbiAgICAgZXhwb3J0ZWRMb2dnZXIubG9nKCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgZXhwb3J0ZWRMb2dnZXIgPSBmYWtlTG9nZ2VyO1xuICAgIH1cbiAgfVxuICBlbHNlIHtcbiAgICBleHBvcnRlZExvZ2dlciA9IGZha2VMb2dnZXI7XG4gIH1cbn07XG5cbmV4cG9ydCB2YXIgbG9nZ2VyID0gZXhwb3J0ZWRMb2dnZXI7XG4iLCJ2YXIgVVJMSGVscGVyID0ge1xuXG4gIC8vIGJ1aWxkIGFuIGFic29sdXRlIFVSTCBmcm9tIGEgcmVsYXRpdmUgb25lIHVzaW5nIHRoZSBwcm92aWRlZCBiYXNlVVJMXG4gIC8vIGlmIHJlbGF0aXZlVVJMIGlzIGFuIGFic29sdXRlIFVSTCBpdCB3aWxsIGJlIHJldHVybmVkIGFzIGlzLlxuICBidWlsZEFic29sdXRlVVJMOiBmdW5jdGlvbihiYXNlVVJMLCByZWxhdGl2ZVVSTCkge1xuICAgIC8vIHJlbW92ZSBhbnkgcmVtYWluaW5nIHNwYWNlIGFuZCBDUkxGXG4gICAgcmVsYXRpdmVVUkwgPSByZWxhdGl2ZVVSTC50cmltKCk7XG4gICAgaWYgKC9eW2Etel0rOi9pLnRlc3QocmVsYXRpdmVVUkwpKSB7XG4gICAgICAvLyBjb21wbGV0ZSB1cmwsIG5vdCByZWxhdGl2ZVxuICAgICAgcmV0dXJuIHJlbGF0aXZlVVJMO1xuICAgIH1cblxuICAgIHZhciByZWxhdGl2ZVVSTFF1ZXJ5ID0gbnVsbDtcbiAgICB2YXIgcmVsYXRpdmVVUkxIYXNoID0gbnVsbDtcblxuICAgIHZhciByZWxhdGl2ZVVSTEhhc2hTcGxpdCA9IC9eKFteI10qKSguKikkLy5leGVjKHJlbGF0aXZlVVJMKTtcbiAgICBpZiAocmVsYXRpdmVVUkxIYXNoU3BsaXQpIHtcbiAgICAgIHJlbGF0aXZlVVJMSGFzaCA9IHJlbGF0aXZlVVJMSGFzaFNwbGl0WzJdO1xuICAgICAgcmVsYXRpdmVVUkwgPSByZWxhdGl2ZVVSTEhhc2hTcGxpdFsxXTtcbiAgICB9XG4gICAgdmFyIHJlbGF0aXZlVVJMUXVlcnlTcGxpdCA9IC9eKFteXFw/XSopKC4qKSQvLmV4ZWMocmVsYXRpdmVVUkwpO1xuICAgIGlmIChyZWxhdGl2ZVVSTFF1ZXJ5U3BsaXQpIHtcbiAgICAgIHJlbGF0aXZlVVJMUXVlcnkgPSByZWxhdGl2ZVVSTFF1ZXJ5U3BsaXRbMl07XG4gICAgICByZWxhdGl2ZVVSTCA9IHJlbGF0aXZlVVJMUXVlcnlTcGxpdFsxXTtcbiAgICB9XG5cbiAgICB2YXIgYmFzZVVSTEhhc2hTcGxpdCA9IC9eKFteI10qKSguKikkLy5leGVjKGJhc2VVUkwpO1xuICAgIGlmIChiYXNlVVJMSGFzaFNwbGl0KSB7XG4gICAgICBiYXNlVVJMID0gYmFzZVVSTEhhc2hTcGxpdFsxXTtcbiAgICB9XG4gICAgdmFyIGJhc2VVUkxRdWVyeVNwbGl0ID0gL14oW15cXD9dKikoLiopJC8uZXhlYyhiYXNlVVJMKTtcbiAgICBpZiAoYmFzZVVSTFF1ZXJ5U3BsaXQpIHtcbiAgICAgIGJhc2VVUkwgPSBiYXNlVVJMUXVlcnlTcGxpdFsxXTtcbiAgICB9XG5cbiAgICB2YXIgYmFzZVVSTERvbWFpblNwbGl0ID0gL14oKChbYS16XSspOik/XFwvXFwvW2EtejAtOVxcLlxcLV9+XSsoOlswLTldKyk/XFwvKSguKikkL2kuZXhlYyhiYXNlVVJMKTtcbiAgICB2YXIgYmFzZVVSTFByb3RvY29sID0gYmFzZVVSTERvbWFpblNwbGl0WzNdO1xuICAgIHZhciBiYXNlVVJMRG9tYWluID0gYmFzZVVSTERvbWFpblNwbGl0WzFdO1xuICAgIHZhciBiYXNlVVJMUGF0aCA9IGJhc2VVUkxEb21haW5TcGxpdFs1XTtcblxuICAgIHZhciBidWlsdFVSTCA9IG51bGw7XG4gICAgaWYgKC9eXFwvXFwvLy50ZXN0KHJlbGF0aXZlVVJMKSkge1xuICAgICAgYnVpbHRVUkwgPSBiYXNlVVJMUHJvdG9jb2wrJzovLycrVVJMSGVscGVyLmJ1aWxkQWJzb2x1dGVQYXRoKCcnLCByZWxhdGl2ZVVSTC5zdWJzdHJpbmcoMikpO1xuICAgIH1cbiAgICBlbHNlIGlmICgvXlxcLy8udGVzdChyZWxhdGl2ZVVSTCkpIHtcbiAgICAgIGJ1aWx0VVJMID0gYmFzZVVSTERvbWFpbitVUkxIZWxwZXIuYnVpbGRBYnNvbHV0ZVBhdGgoJycsIHJlbGF0aXZlVVJMLnN1YnN0cmluZygxKSk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgYnVpbHRVUkwgPSBVUkxIZWxwZXIuYnVpbGRBYnNvbHV0ZVBhdGgoYmFzZVVSTERvbWFpbitiYXNlVVJMUGF0aCwgcmVsYXRpdmVVUkwpO1xuICAgIH1cblxuICAgIC8vIHB1dCB0aGUgcXVlcnkgYW5kIGhhc2ggcGFydHMgYmFja1xuICAgIGlmIChyZWxhdGl2ZVVSTFF1ZXJ5KSB7XG4gICAgICBidWlsdFVSTCArPSByZWxhdGl2ZVVSTFF1ZXJ5O1xuICAgIH1cbiAgICBpZiAocmVsYXRpdmVVUkxIYXNoKSB7XG4gICAgICBidWlsdFVSTCArPSByZWxhdGl2ZVVSTEhhc2g7XG4gICAgfVxuICAgIHJldHVybiBidWlsdFVSTDtcbiAgfSxcblxuICAvLyBidWlsZCBhbiBhYnNvbHV0ZSBwYXRoIHVzaW5nIHRoZSBwcm92aWRlZCBiYXNlUGF0aFxuICAvLyBhZGFwdGVkIGZyb20gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL2RvY3VtZW50L2Nvb2tpZSNVc2luZ19yZWxhdGl2ZV9VUkxzX2luX3RoZV9wYXRoX3BhcmFtZXRlclxuICAvLyB0aGlzIGRvZXMgbm90IGhhbmRsZSB0aGUgY2FzZSB3aGVyZSByZWxhdGl2ZVBhdGggaXMgXCIvXCIgb3IgXCIvL1wiLiBUaGVzZSBjYXNlcyBzaG91bGQgYmUgaGFuZGxlZCBvdXRzaWRlIHRoaXMuXG4gIGJ1aWxkQWJzb2x1dGVQYXRoOiBmdW5jdGlvbihiYXNlUGF0aCwgcmVsYXRpdmVQYXRoKSB7XG4gICAgdmFyIHNSZWxQYXRoID0gcmVsYXRpdmVQYXRoO1xuICAgIHZhciBuVXBMbiwgc0RpciA9ICcnLCBzUGF0aCA9IGJhc2VQYXRoLnJlcGxhY2UoL1teXFwvXSokLywgc1JlbFBhdGgucmVwbGFjZSgvKFxcL3xeKSg/OlxcLj9cXC8rKSsvZywgJyQxJykpO1xuICAgIGZvciAodmFyIG5FbmQsIG5TdGFydCA9IDA7IG5FbmQgPSBzUGF0aC5pbmRleE9mKCcvLi4vJywgblN0YXJ0KSwgbkVuZCA+IC0xOyBuU3RhcnQgPSBuRW5kICsgblVwTG4pIHtcbiAgICAgIG5VcExuID0gL15cXC8oPzpcXC5cXC5cXC8pKi8uZXhlYyhzUGF0aC5zbGljZShuRW5kKSlbMF0ubGVuZ3RoO1xuICAgICAgc0RpciA9IChzRGlyICsgc1BhdGguc3Vic3RyaW5nKG5TdGFydCwgbkVuZCkpLnJlcGxhY2UobmV3IFJlZ0V4cCgnKD86XFxcXFxcLytbXlxcXFxcXC9dKil7MCwnICsgKChuVXBMbiAtIDEpIC8gMykgKyAnfSQnKSwgJy8nKTtcbiAgICB9XG4gICAgcmV0dXJuIHNEaXIgKyBzUGF0aC5zdWJzdHIoblN0YXJ0KTtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBVUkxIZWxwZXI7XG4iLCIvKipcbiAqIFhIUiBiYXNlZCBsb2dnZXJcbiovXG5cbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG5jbGFzcyBYaHJMb2FkZXIge1xuXG4gIGNvbnN0cnVjdG9yKGNvbmZpZykge1xuICAgIGlmIChjb25maWcgJiYgY29uZmlnLnhoclNldHVwKSB7XG4gICAgICB0aGlzLnhoclNldHVwID0gY29uZmlnLnhoclNldHVwO1xuICAgIH1cbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5hYm9ydCgpO1xuICAgIHRoaXMubG9hZGVyID0gbnVsbDtcbiAgfVxuXG4gIGFib3J0KCkge1xuICAgIHZhciBsb2FkZXIgPSB0aGlzLmxvYWRlcixcbiAgICAgICAgdGltZW91dEhhbmRsZSA9IHRoaXMudGltZW91dEhhbmRsZTtcbiAgICBpZiAobG9hZGVyICYmIGxvYWRlci5yZWFkeVN0YXRlICE9PSA0KSB7XG4gICAgICB0aGlzLnN0YXRzLmFib3J0ZWQgPSB0cnVlO1xuICAgICAgbG9hZGVyLmFib3J0KCk7XG4gICAgfVxuICAgIGlmICh0aW1lb3V0SGFuZGxlKSB7XG4gICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRpbWVvdXRIYW5kbGUpO1xuICAgIH1cbiAgfVxuXG4gIGxvYWQodXJsLCByZXNwb25zZVR5cGUsIG9uU3VjY2Vzcywgb25FcnJvciwgb25UaW1lb3V0LCB0aW1lb3V0LCBtYXhSZXRyeSwgcmV0cnlEZWxheSwgb25Qcm9ncmVzcyA9IG51bGwsIGZyYWcgPSBudWxsKSB7XG4gICAgdGhpcy51cmwgPSB1cmw7XG4gICAgaWYgKGZyYWcgJiYgIWlzTmFOKGZyYWcuYnl0ZVJhbmdlU3RhcnRPZmZzZXQpICYmICFpc05hTihmcmFnLmJ5dGVSYW5nZUVuZE9mZnNldCkpIHtcbiAgICAgICAgdGhpcy5ieXRlUmFuZ2UgPSBmcmFnLmJ5dGVSYW5nZVN0YXJ0T2Zmc2V0ICsgJy0nICsgKGZyYWcuYnl0ZVJhbmdlRW5kT2Zmc2V0LTEpO1xuICAgIH1cbiAgICB0aGlzLnJlc3BvbnNlVHlwZSA9IHJlc3BvbnNlVHlwZTtcbiAgICB0aGlzLm9uU3VjY2VzcyA9IG9uU3VjY2VzcztcbiAgICB0aGlzLm9uUHJvZ3Jlc3MgPSBvblByb2dyZXNzO1xuICAgIHRoaXMub25UaW1lb3V0ID0gb25UaW1lb3V0O1xuICAgIHRoaXMub25FcnJvciA9IG9uRXJyb3I7XG4gICAgdGhpcy5zdGF0cyA9IHt0cmVxdWVzdDogcGVyZm9ybWFuY2Uubm93KCksIHJldHJ5OiAwfTtcbiAgICB0aGlzLnRpbWVvdXQgPSB0aW1lb3V0O1xuICAgIHRoaXMubWF4UmV0cnkgPSBtYXhSZXRyeTtcbiAgICB0aGlzLnJldHJ5RGVsYXkgPSByZXRyeURlbGF5O1xuICAgIHRoaXMubG9hZEludGVybmFsKCk7XG4gIH1cblxuICBsb2FkSW50ZXJuYWwoKSB7XG4gICAgdmFyIHhocjtcblxuICAgIGlmICh0eXBlb2YgWERvbWFpblJlcXVlc3QgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgeGhyID0gdGhpcy5sb2FkZXIgPSBuZXcgWERvbWFpblJlcXVlc3QoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgIHhociA9IHRoaXMubG9hZGVyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgfVxuXG4gICAgeGhyLm9ubG9hZGVuZCA9IHRoaXMubG9hZGVuZC5iaW5kKHRoaXMpO1xuICAgIHhoci5vbnByb2dyZXNzID0gdGhpcy5sb2FkcHJvZ3Jlc3MuYmluZCh0aGlzKTtcblxuICAgIHhoci5vcGVuKCdHRVQnLCB0aGlzLnVybCwgdHJ1ZSk7XG4gICAgaWYgKHRoaXMuYnl0ZVJhbmdlKSB7XG4gICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcignUmFuZ2UnLCAnYnl0ZXM9JyArIHRoaXMuYnl0ZVJhbmdlKTtcbiAgICB9XG4gICAgeGhyLnJlc3BvbnNlVHlwZSA9IHRoaXMucmVzcG9uc2VUeXBlO1xuICAgIHRoaXMuc3RhdHMudGZpcnN0ID0gbnVsbDtcbiAgICB0aGlzLnN0YXRzLmxvYWRlZCA9IDA7XG4gICAgaWYgKHRoaXMueGhyU2V0dXApIHtcbiAgICAgIHRoaXMueGhyU2V0dXAoeGhyLCB0aGlzLnVybCk7XG4gICAgfVxuICAgIHRoaXMudGltZW91dEhhbmRsZSA9IHdpbmRvdy5zZXRUaW1lb3V0KHRoaXMubG9hZHRpbWVvdXQuYmluZCh0aGlzKSwgdGhpcy50aW1lb3V0KTtcbiAgICB4aHIuc2VuZCgpO1xuICB9XG5cbiAgbG9hZGVuZChldmVudCkge1xuICAgIHZhciB4aHIgPSBldmVudC5jdXJyZW50VGFyZ2V0LFxuICAgICAgICBzdGF0dXMgPSB4aHIuc3RhdHVzLFxuICAgICAgICBzdGF0cyA9IHRoaXMuc3RhdHM7XG4gICAgLy8gZG9uJ3QgcHJvY2VlZCBpZiB4aHIgaGFzIGJlZW4gYWJvcnRlZFxuICAgIGlmICghc3RhdHMuYWJvcnRlZCkge1xuICAgICAgICAvLyBodHRwIHN0YXR1cyBiZXR3ZWVuIDIwMCB0byAyOTkgYXJlIGFsbCBzdWNjZXNzZnVsXG4gICAgICAgIGlmIChzdGF0dXMgPj0gMjAwICYmIHN0YXR1cyA8IDMwMCkgIHtcbiAgICAgICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMudGltZW91dEhhbmRsZSk7XG4gICAgICAgICAgc3RhdHMudGxvYWQgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgICB0aGlzLm9uU3VjY2VzcyhldmVudCwgc3RhdHMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gZXJyb3IgLi4uXG4gICAgICAgIGlmIChzdGF0cy5yZXRyeSA8IHRoaXMubWF4UmV0cnkpIHtcbiAgICAgICAgICBsb2dnZXIud2FybihgJHtzdGF0dXN9IHdoaWxlIGxvYWRpbmcgJHt0aGlzLnVybH0sIHJldHJ5aW5nIGluICR7dGhpcy5yZXRyeURlbGF5fS4uLmApO1xuICAgICAgICAgIHRoaXMuZGVzdHJveSgpO1xuICAgICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KHRoaXMubG9hZEludGVybmFsLmJpbmQodGhpcyksIHRoaXMucmV0cnlEZWxheSk7XG4gICAgICAgICAgLy8gZXhwb25lbnRpYWwgYmFja29mZlxuICAgICAgICAgIHRoaXMucmV0cnlEZWxheSA9IE1hdGgubWluKDIgKiB0aGlzLnJldHJ5RGVsYXksIDY0MDAwKTtcbiAgICAgICAgICBzdGF0cy5yZXRyeSsrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy50aW1lb3V0SGFuZGxlKTtcbiAgICAgICAgICBsb2dnZXIuZXJyb3IoYCR7c3RhdHVzfSB3aGlsZSBsb2FkaW5nICR7dGhpcy51cmx9YCApO1xuICAgICAgICAgIHRoaXMub25FcnJvcihldmVudCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBsb2FkdGltZW91dChldmVudCkge1xuICAgIGxvZ2dlci53YXJuKGB0aW1lb3V0IHdoaWxlIGxvYWRpbmcgJHt0aGlzLnVybH1gICk7XG4gICAgdGhpcy5vblRpbWVvdXQoZXZlbnQsIHRoaXMuc3RhdHMpO1xuICB9XG5cbiAgbG9hZHByb2dyZXNzKGV2ZW50KSB7XG4gICAgdmFyIHN0YXRzID0gdGhpcy5zdGF0cztcbiAgICBpZiAoc3RhdHMudGZpcnN0ID09PSBudWxsKSB7XG4gICAgICBzdGF0cy50Zmlyc3QgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICB9XG4gICAgc3RhdHMubG9hZGVkID0gZXZlbnQubG9hZGVkO1xuICAgIGlmICh0aGlzLm9uUHJvZ3Jlc3MpIHtcbiAgICAgIHRoaXMub25Qcm9ncmVzcyhldmVudCwgc3RhdHMpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBYaHJMb2FkZXI7XG4iXX0=
