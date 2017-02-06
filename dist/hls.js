(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Hls = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
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
      } else {
        // At least give some kind of context to the user
        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
        err.context = er;
        throw err;
      }
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

},{}],2:[function(_dereq_,module,exports){
/* jshint ignore:start */
(function(root) { 
/* jshint ignore:end */

  var HASH_SPLIT = /^([^#]*)(.*)$/;
  var QUERY_SPLIT = /^([^\?]*)(.*)$/;
  var DOMAIN_SPLIT = /^(([a-z]+:\/\/)?[^:\/]+(?::[0-9]+)?)?(\/?.*)$/i;

  var URLToolkit = {
    // build an absolute URL from a relative one using the provided baseURL
    // if relativeURL is an absolute URL it will be returned as is.
    buildAbsoluteURL: function(baseURL, relativeURL) {
      // remove any remaining space and CRLF
      relativeURL = relativeURL.trim();
      if (/^[a-z]+:/i.test(relativeURL)) {
        // complete url, not relative
        return relativeURL;
      }

      var relativeURLQuery = null;
      var relativeURLHash = null;

      var relativeURLHashSplit = HASH_SPLIT.exec(relativeURL);
      if (relativeURLHashSplit) {
        relativeURLHash = relativeURLHashSplit[2];
        relativeURL = relativeURLHashSplit[1];
      }
      var relativeURLQuerySplit = QUERY_SPLIT.exec(relativeURL);
      if (relativeURLQuerySplit) {
        relativeURLQuery = relativeURLQuerySplit[2];
        relativeURL = relativeURLQuerySplit[1];
      }

      var baseURLHashSplit = HASH_SPLIT.exec(baseURL);
      if (baseURLHashSplit) {
        baseURL = baseURLHashSplit[1];
      }
      var baseURLQuerySplit = QUERY_SPLIT.exec(baseURL);
      if (baseURLQuerySplit) {
        baseURL = baseURLQuerySplit[1];
      }

      var baseURLDomainSplit = DOMAIN_SPLIT.exec(baseURL);
      if (!baseURLDomainSplit) {
        throw new Error('Error trying to parse base URL.');
      }
      
      // e.g. 'http://', 'https://', ''
      var baseURLProtocol = baseURLDomainSplit[2] || '';
      // e.g. 'http://example.com', '//example.com', 'example.com', ''
      var baseURLProtocolDomain = baseURLDomainSplit[1] || '';
      // e.g. '/a/b/c/playlist.m3u8', 'a/b/c/playlist.m3u8'
      var baseURLPath = baseURLDomainSplit[3];
      if (baseURLPath.indexOf('/') !== 0 && baseURLProtocolDomain !== '') {
        // this handles a base url of http://example.com (missing last slash)
        baseURLPath = '/'+baseURLPath;
      }

      var builtURL = null;
      if (/^\/\//.test(relativeURL)) {
        // relative url starts wth '//' so copy protocol (which may be '' if baseUrl didn't provide one)
        builtURL = baseURLProtocol+URLToolkit.buildAbsolutePath('', relativeURL.substring(2));
      }
      else if (/^\//.test(relativeURL)) {
        // relative url starts with '/' so start from root of domain
        builtURL = baseURLProtocolDomain+'/'+URLToolkit.buildAbsolutePath('', relativeURL.substring(1));
      }
      else {
        builtURL = URLToolkit.buildAbsolutePath(baseURLProtocolDomain+baseURLPath, relativeURL);
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
    buildAbsolutePath: function(basePath, relativePath) {
      var sRelPath = relativePath;
      var nUpLn, sDir = '', sPath = basePath.replace(/[^\/]*$/, sRelPath.replace(/(\/|^)(?:\.?\/+)+/g, '$1'));
      for (var nEnd, nStart = 0; nEnd = sPath.indexOf('/../', nStart), nEnd > -1; nStart = nEnd + nUpLn) {
        nUpLn = /^\/(?:\.\.\/)*/.exec(sPath.slice(nEnd))[0].length;
        sDir = (sDir + sPath.substring(nStart, nEnd)).replace(new RegExp('(?:\\\/+[^\\\/]*){0,' + ((nUpLn - 1) / 3) + '}$'), '/');
      }
      return sDir + sPath.substr(nStart);
    }
  };

/* jshint ignore:start */
  if(typeof exports === 'object' && typeof module === 'object')
    module.exports = URLToolkit;
  else if(typeof define === 'function' && define.amd)
    define([], function() { return URLToolkit; });
  else if(typeof exports === 'object')
    exports["URLToolkit"] = URLToolkit;
  else
    root["URLToolkit"] = URLToolkit;
})(this);
/* jshint ignore:end */

},{}],3:[function(_dereq_,module,exports){
var bundleFn = arguments[3];
var sources = arguments[4];
var cache = arguments[5];

var stringify = JSON.stringify;

module.exports = function (fn, options) {
    var wkey;
    var cacheKeys = Object.keys(cache);

    for (var i = 0, l = cacheKeys.length; i < l; i++) {
        var key = cacheKeys[i];
        var exp = cache[key].exports;
        // Using babel as a transpiler to use esmodule, the export will always
        // be an object with the default export as a property of it. To ensure
        // the existing api and babel esmodule exports are both supported we
        // check for both
        if (exp === fn || exp && exp.default === fn) {
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

    var workerSources = {};
    resolveSources(skey);

    function resolveSources(key) {
        workerSources[key] = true;

        for (var depPath in sources[key][1]) {
            var depKey = sources[key][1][depPath];
            if (!workerSources[depKey]) {
                resolveSources(depKey);
            }
        }
    }

    var src = '(' + bundleFn + ')({'
        + Object.keys(workerSources).map(function (key) {
            return stringify(key) + ':['
                + sources[key][0]
                + ',' + stringify(sources[key][1]) + ']'
            ;
        }).join(',')
        + '},{},[' + stringify(skey) + '])'
    ;

    var URL = window.URL || window.webkitURL || window.mozURL || window.msURL;

    var blob = new Blob([src], { type: 'text/javascript' });
    if (options && options.bare) { return blob; }
    var workerUrl = URL.createObjectURL(blob);
    var worker = new Worker(workerUrl);
    worker.objectURL = workerUrl;
    return worker;
};

},{}],4:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = _dereq_(28);

var _events2 = _interopRequireDefault(_events);

var _eventHandler = _dereq_(27);

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _bufferHelper = _dereq_(30);

var _bufferHelper2 = _interopRequireDefault(_bufferHelper);

var _errors = _dereq_(26);

var _logger = _dereq_(45);

var _ewmaBandwidthEstimator = _dereq_(9);

var _ewmaBandwidthEstimator2 = _interopRequireDefault(_ewmaBandwidthEstimator);

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

    var _this = _possibleConstructorReturn(this, (AbrController.__proto__ || Object.getPrototypeOf(AbrController)).call(this, hls, _events2.default.FRAG_LOADING, _events2.default.FRAG_LOADED, _events2.default.FRAG_BUFFERED, _events2.default.ERROR));

    _this.lastLoadedFragLevel = 0;
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
      var frag = data.frag;
      if (frag.type === 'main') {
        if (!this.timer) {
          this.timer = setInterval(this.onCheck, 100);
        }
        // lazy init of bw Estimator, rationale is that we use different params for Live/VoD
        // so we need to wait for stream manifest / playlist type to instantiate it.
        if (!this.bwEstimator) {
          var hls = this.hls,
              level = data.frag.level,
              isLive = hls.levels[level].details.live,
              config = hls.config,
              ewmaFast = void 0,
              ewmaSlow = void 0;

          if (isLive) {
            ewmaFast = config.abrEwmaFastLive;
            ewmaSlow = config.abrEwmaSlowLive;
          } else {
            ewmaFast = config.abrEwmaFastVoD;
            ewmaSlow = config.abrEwmaSlowVoD;
          }
          this.bwEstimator = new _ewmaBandwidthEstimator2.default(hls, ewmaSlow, ewmaFast, config.abrEwmaDefaultEstimate);
        }
        this.fragCurrent = frag;
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
          frag = this.fragCurrent,
          loader = frag.loader,
          minAutoLevel = this.minAutoLevel;

      // if loader has been destroyed or loading has been aborted, stop timer and return
      if (!loader || loader.stats && loader.stats.aborted) {
        _logger.logger.warn('frag loader destroy or aborted, disarm abandonRules');
        this.clearTimer();
        return;
      }
      var stats = loader.stats;
      /* only monitor frag retrieval time if
      (video not paused OR first fragment being loaded(ready state === HAVE_NOTHING = 0)) AND autoswitching enabled AND not lowest level (=> means that we have several levels) */
      if (v && (!v.paused && v.playbackRate !== 0 || !v.readyState) && frag.autoLevel && frag.level) {
        var requestDelay = performance.now() - stats.trequest,
            playbackRate = Math.abs(v.playbackRate);
        // monitor fragment load progress after half of expected fragment duration,to stabilize bitrate
        if (requestDelay > 500 * frag.duration / playbackRate) {
          var levels = hls.levels,
              loadRate = Math.max(1, stats.bw ? stats.bw / 8 : stats.loaded * 1000 / requestDelay),
              // byte/s; at least 1 byte/s to avoid division by zero
          // compute expected fragment length using frag duration and level bitrate. also ensure that expected len is gte than already loaded size
          level = levels[frag.level],
              levelBitrate = level.realBitrate ? Math.max(level.realBitrate, level.bitrate) : level.bitrate,
              expectedLen = stats.total ? stats.total : Math.max(stats.loaded, Math.round(frag.duration * levelBitrate / 8)),
              pos = v.currentTime,
              fragLoadedDelay = (expectedLen - stats.loaded) / loadRate,
              bufferStarvationDelay = (_bufferHelper2.default.bufferInfo(v, pos, hls.config.maxBufferHole).end - pos) / playbackRate;
          // consider emergency switch down only if we have less than 2 frag buffered AND
          // time to finish loading current fragment is bigger than buffer starvation delay
          // ie if we risk buffer starvation if bw does not increase quickly
          if (bufferStarvationDelay < 2 * frag.duration / playbackRate && fragLoadedDelay > bufferStarvationDelay) {
            var fragLevelNextLoadedDelay = void 0,
                nextLoadLevel = void 0;
            // lets iterate through lower level and try to find the biggest one that could avoid rebuffering
            // we start from current level - 1 and we step down , until we find a matching level
            for (nextLoadLevel = frag.level - 1; nextLoadLevel > minAutoLevel; nextLoadLevel--) {
              // compute time to load next fragment at lower level
              // 0.8 : consider only 80% of current bw to be conservative
              // 8 = bits per byte (bps/Bps)
              var levelNextBitrate = levels[nextLoadLevel].realBitrate ? Math.max(levels[nextLoadLevel].realBitrate, levels[nextLoadLevel].bitrate) : levels[nextLoadLevel].bitrate;
              fragLevelNextLoadedDelay = frag.duration * levelNextBitrate / (8 * 0.8 * loadRate);
              if (fragLevelNextLoadedDelay < bufferStarvationDelay) {
                // we found a lower level that be rebuffering free with current estimated bw !
                break;
              }
            }
            // only emergency switch down if it takes less time to load new fragment at lowest level instead
            // of finishing loading current one ...
            if (fragLevelNextLoadedDelay < fragLoadedDelay) {
              _logger.logger.warn('loading too slow, abort fragment loading and switch to level ' + nextLoadLevel + ':fragLoadedDelay[' + nextLoadLevel + ']<fragLoadedDelay[' + (frag.level - 1) + '];bufferStarvationDelay:' + fragLevelNextLoadedDelay.toFixed(1) + '<' + fragLoadedDelay.toFixed(1) + ':' + bufferStarvationDelay.toFixed(1));
              // force next load level in auto mode
              hls.nextLoadLevel = nextLoadLevel;
              // update bw estimate for this fragment before cancelling load (this will help reducing the bw)
              this.bwEstimator.sample(requestDelay, stats.loaded);
              //abort fragment loading
              loader.abort();
              // stop abandon rules timer
              this.clearTimer();
              hls.trigger(_events2.default.FRAG_LOAD_EMERGENCY_ABORTED, { frag: frag, stats: stats });
            }
          }
        }
      }
    }
  }, {
    key: 'onFragLoaded',
    value: function onFragLoaded(data) {
      var frag = data.frag;
      if (frag.type === 'main') {
        // stop monitoring bw once frag loaded
        this.clearTimer();
        // store level id after successful fragment load
        this.lastLoadedFragLevel = frag.level;
        // reset forced auto level value so that next level will be selected
        this._nextAutoLevel = -1;

        // compute level average bitrate
        var level = this.hls.levels[frag.level];
        var loadedBytes = (level.loaded ? level.loaded.bytes : 0) + data.stats.loaded;
        var loadedDuration = (level.loaded ? level.loaded.duration : 0) + data.frag.duration;
        level.loaded = { bytes: loadedBytes, duration: loadedDuration };
        level.realBitrate = Math.round(8 * loadedBytes / loadedDuration);
        // if fragment has been loaded to perform a bitrate test,
        if (data.frag.bitrateTest) {
          var stats = data.stats;
          stats.tparsed = stats.tbuffered = stats.tload;
          this.onFragBuffered(data);
        }
      }
    }
  }, {
    key: 'onFragBuffered',
    value: function onFragBuffered(data) {
      var stats = data.stats,
          frag = data.frag;
      // only update stats on first frag buffering
      // if same frag is loaded multiple times, it might be in browser cache, and loaded quickly
      // and leading to wrong bw estimation
      // on bitrate test, also only update stats once (if tload = tbuffered == on FRAG_LOADED)
      if (stats.aborted !== true && frag.loadCounter === 1 && frag.type === 'main' && (!frag.bitrateTest || stats.tload === stats.tbuffered)) {
        // use tparsed-trequest instead of tbuffered-trequest to compute fragLoadingProcessing; rationale is that  buffer appending only happens once media is attached
        // in case we use config.startFragPrefetch while media is not attached yet, fragment might be parsed while media not attached yet, but it will only be buffered on media attached
        // as a consequence it could happen really late in the process. meaning that appending duration might appears huge ... leading to underestimated throughput estimation
        var fragLoadingProcessingMs = stats.tparsed - stats.trequest;
        _logger.logger.log('latency/loading/parsing/append/kbps:' + Math.round(stats.tfirst - stats.trequest) + '/' + Math.round(stats.tload - stats.tfirst) + '/' + Math.round(stats.tparsed - stats.tload) + '/' + Math.round(stats.tbuffered - stats.tparsed) + '/' + Math.round(8 * stats.loaded / (stats.tbuffered - stats.trequest)));
        this.bwEstimator.sample(fragLoadingProcessingMs, stats.loaded);
        // if fragment has been loaded to perform a bitrate test, (hls.startLevel = -1), store bitrate test delay duration
        if (frag.bitrateTest) {
          this.bitrateTestDelay = fragLoadingProcessingMs / 1000;
        } else {
          this.bitrateTestDelay = 0;
        }
      }
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
    key: 'findBestLevel',
    value: function findBestLevel(currentLevel, currentFragDuration, currentBw, minAutoLevel, maxAutoLevel, maxFetchDuration, bwFactor, bwUpFactor, levels) {
      for (var i = maxAutoLevel; i >= minAutoLevel; i--) {
        var levelInfo = levels[i],
            levelDetails = levelInfo.details,
            avgDuration = levelDetails ? levelDetails.totalduration / levelDetails.fragments.length : currentFragDuration,
            live = levelDetails ? levelDetails.live : false,
            adjustedbw = void 0;
        // follow algorithm captured from stagefright :
        // https://android.googlesource.com/platform/frameworks/av/+/master/media/libstagefright/httplive/LiveSession.cpp
        // Pick the highest bandwidth stream below or equal to estimated bandwidth.
        // consider only 80% of the available bandwidth, but if we are switching up,
        // be even more conservative (70%) to avoid overestimating and immediately
        // switching back.
        if (i <= currentLevel) {
          adjustedbw = bwFactor * currentBw;
        } else {
          adjustedbw = bwUpFactor * currentBw;
        }
        var bitrate = levels[i].realBitrate ? Math.max(levels[i].realBitrate, levels[i].bitrate) : levels[i].bitrate,
            fetchDuration = bitrate * avgDuration / adjustedbw;

        _logger.logger.trace('level/adjustedbw/bitrate/avgDuration/maxFetchDuration/fetchDuration: ' + i + '/' + Math.round(adjustedbw) + '/' + bitrate + '/' + avgDuration + '/' + maxFetchDuration + '/' + fetchDuration);
        // if adjusted bw is greater than level bitrate AND
        if (adjustedbw > bitrate && (
        // fragment fetchDuration unknown OR live stream OR fragment fetchDuration less than max allowed fetch duration, then this level matches
        // we don't account for max Fetch Duration for live streams, this is to avoid switching down when near the edge of live sliding window ...
        !fetchDuration || live || fetchDuration < maxFetchDuration)) {
          // as we are looping from highest to lowest, this will return the best achievable quality level

          return i;
        }
      }
      // not enough time budget even with quality level 0 ... rebuffering might happen
      return -1;
    }
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
      var nextAutoLevel = this._nextAutoLevel,
          bwEstimator = this.bwEstimator,
          hls = this.hls,
          levels = hls.levels,
          minAutoBitrate = hls.config.minAutoBitrate;
      // in case next auto level has been forced, and bw not available or not reliable
      if (nextAutoLevel !== -1 && (!bwEstimator || !bwEstimator.canEstimate())) {
        // cap next auto level by max auto level
        return Math.min(nextAutoLevel, this.maxAutoLevel);
      }
      // compute next level using ABR logic
      var nextABRAutoLevel = this.nextABRAutoLevel;
      if (nextAutoLevel !== -1) {
        // nextAutoLevel is defined, use it to cap ABR computed quality level
        nextABRAutoLevel = Math.min(nextAutoLevel, nextABRAutoLevel);
      }
      if (minAutoBitrate !== undefined) {
        var levelNextBitrate = levels[nextABRAutoLevel].realBitrate ? Math.max(levels[nextABRAutoLevel].realBitrate, levels[nextABRAutoLevel].bitrate) : levels[nextABRAutoLevel].bitrate;
        while (levelNextBitrate < minAutoBitrate) {
          nextABRAutoLevel++;
        }
      }
      return nextABRAutoLevel;
    },
    set: function set(nextLevel) {
      this._nextAutoLevel = nextLevel;
    }
  }, {
    key: 'minAutoLevel',
    get: function get() {
      var hls = this.hls,
          levels = hls.levels,
          minAutoBitrate = hls.config.minAutoBitrate,
          len = levels ? levels.length : 0;
      for (var i = 0; i < len; i++) {
        var levelNextBitrate = levels[i].realBitrate ? Math.max(levels[i].realBitrate, levels[i].bitrate) : levels[i].bitrate;
        if (levelNextBitrate > minAutoBitrate) {
          return i;
        }
      }
      return 0;
    }
  }, {
    key: 'maxAutoLevel',
    get: function get() {
      var levels = this.hls.levels,
          autoLevelCapping = this._autoLevelCapping,
          maxAutoLevel;
      if (autoLevelCapping === -1 && levels && levels.length) {
        maxAutoLevel = levels.length - 1;
      } else {
        maxAutoLevel = autoLevelCapping;
      }
      return maxAutoLevel;
    }
  }, {
    key: 'nextABRAutoLevel',
    get: function get() {
      var hls = this.hls,
          maxAutoLevel = this.maxAutoLevel,
          levels = hls.levels,
          config = hls.config,
          minAutoLevel = this.minAutoLevel;
      var v = hls.media,
          currentLevel = this.lastLoadedFragLevel,
          currentFragDuration = this.fragCurrent ? this.fragCurrent.duration : 0,
          pos = v ? v.currentTime : 0,

      // playbackRate is the absolute value of the playback rate; if v.playbackRate is 0, we use 1 to load as
      // if we're playing back at the normal rate.
      playbackRate = v && v.playbackRate !== 0 ? Math.abs(v.playbackRate) : 1.0,
          avgbw = this.bwEstimator ? this.bwEstimator.getEstimate() : config.abrEwmaDefaultEstimate,

      // bufferStarvationDelay is the wall-clock time left until the playback buffer is exhausted.
      bufferStarvationDelay = (_bufferHelper2.default.bufferInfo(v, pos, config.maxBufferHole).end - pos) / playbackRate;

      // First, look to see if we can find a level matching with our avg bandwidth AND that could also guarantee no rebuffering at all
      var bestLevel = this.findBestLevel(currentLevel, currentFragDuration, avgbw, minAutoLevel, maxAutoLevel, bufferStarvationDelay, config.abrBandWidthFactor, config.abrBandWidthUpFactor, levels);
      if (bestLevel >= 0) {
        return bestLevel;
      } else {
        _logger.logger.trace('rebuffering expected to happen, lets try to find a quality level minimizing the rebuffering');
        // not possible to get rid of rebuffering ... let's try to find level that will guarantee less than maxStarvationDelay of rebuffering
        // if no matching level found, logic will return 0
        var maxStarvationDelay = config.maxStarvationDelay,
            bwFactor = config.abrBandWidthFactor,
            bwUpFactor = config.abrBandWidthUpFactor;
        if (bufferStarvationDelay === 0) {
          // in case buffer is empty, let's check if previous fragment was loaded to perform a bitrate test
          var bitrateTestDelay = this.bitrateTestDelay;
          if (bitrateTestDelay) {
            // if it is the case, then we need to adjust our max starvation delay using maxLoadingDelay config value
            // max video loading delay used in  automatic start level selection :
            // in that mode ABR controller will ensure that video loading time (ie the time to fetch the first fragment at lowest quality level +
            // the time to fetch the fragment at the appropriate quality level is less than ```maxLoadingDelay``` )
            // cap maxLoadingDelay and ensure it is not bigger 'than bitrate test' frag duration
            var maxLoadingDelay = currentFragDuration ? Math.min(currentFragDuration, config.maxLoadingDelay) : config.maxLoadingDelay;
            maxStarvationDelay = maxLoadingDelay - bitrateTestDelay;
            _logger.logger.trace('bitrate test took ' + Math.round(1000 * bitrateTestDelay) + 'ms, set first fragment max fetchDuration to ' + Math.round(1000 * maxStarvationDelay) + ' ms');
            // don't use conservative factor on bitrate test
            bwFactor = bwUpFactor = 1;
          }
        }
        bestLevel = this.findBestLevel(currentLevel, currentFragDuration, avgbw, minAutoLevel, maxAutoLevel, bufferStarvationDelay + maxStarvationDelay, bwFactor, bwUpFactor, levels);
        return Math.max(bestLevel, 0);
      }
    }
  }]);

  return AbrController;
}(_eventHandler2.default);

exports.default = AbrController;

},{"26":26,"27":27,"28":28,"30":30,"45":45,"9":9}],5:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _binarySearch = _dereq_(41);

var _binarySearch2 = _interopRequireDefault(_binarySearch);

var _bufferHelper = _dereq_(30);

var _bufferHelper2 = _interopRequireDefault(_bufferHelper);

var _demuxer = _dereq_(22);

var _demuxer2 = _interopRequireDefault(_demuxer);

var _events = _dereq_(28);

var _events2 = _interopRequireDefault(_events);

var _eventHandler = _dereq_(27);

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _levelHelper = _dereq_(31);

var _levelHelper2 = _interopRequireDefault(_levelHelper);

var _timeRanges = _dereq_(46);

var _timeRanges2 = _interopRequireDefault(_timeRanges);

var _errors = _dereq_(26);

var _logger = _dereq_(45);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Audio Stream Controller
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               */

var State = {
  STOPPED: 'STOPPED',
  STARTING: 'STARTING',
  IDLE: 'IDLE',
  PAUSED: 'PAUSED',
  KEY_LOADING: 'KEY_LOADING',
  FRAG_LOADING: 'FRAG_LOADING',
  FRAG_LOADING_WAITING_RETRY: 'FRAG_LOADING_WAITING_RETRY',
  WAITING_TRACK: 'WAITING_TRACK',
  PARSING: 'PARSING',
  PARSED: 'PARSED',
  BUFFER_FLUSHING: 'BUFFER_FLUSHING',
  ENDED: 'ENDED',
  ERROR: 'ERROR',
  WAITING_INIT_PTS: 'WAITING_INIT_PTS'
};

var AudioStreamController = function (_EventHandler) {
  _inherits(AudioStreamController, _EventHandler);

  function AudioStreamController(hls) {
    _classCallCheck(this, AudioStreamController);

    var _this = _possibleConstructorReturn(this, (AudioStreamController.__proto__ || Object.getPrototypeOf(AudioStreamController)).call(this, hls, _events2.default.MEDIA_ATTACHED, _events2.default.MEDIA_DETACHING, _events2.default.AUDIO_TRACKS_UPDATED, _events2.default.AUDIO_TRACK_SWITCHING, _events2.default.AUDIO_TRACK_LOADED, _events2.default.KEY_LOADED, _events2.default.FRAG_LOADED, _events2.default.FRAG_PARSING_INIT_SEGMENT, _events2.default.FRAG_PARSING_DATA, _events2.default.FRAG_PARSED, _events2.default.ERROR, _events2.default.BUFFER_CREATED, _events2.default.BUFFER_APPENDED, _events2.default.BUFFER_FLUSHED, _events2.default.INIT_PTS_FOUND));

    _this.config = hls.config;
    _this.audioCodecSwap = false;
    _this.ticks = 0;
    _this._state = State.STOPPED;
    _this.ontick = _this.tick.bind(_this);
    _this.initPTS = [];
    _this.waitingFragment = null;
    return _this;
  }

  _createClass(AudioStreamController, [{
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

    //Signal that video PTS was found

  }, {
    key: 'onInitPtsFound',
    value: function onInitPtsFound(data) {
      var demuxerId = data.id,
          cc = data.cc,
          initPTS = data.initPTS;
      if (demuxerId === 'main') {
        //Always update the new INIT PTS
        //Can change due level switch
        this.initPTS[cc] = initPTS;
        _logger.logger.log('InitPTS for cc:' + cc + ' found from video track:' + initPTS);

        //If we are waiting we need to demux/remux the waiting frag
        //With the new initPTS
        if (this.state === State.WAITING_INIT_PTS) {
          _logger.logger.log('sending pending audio frag to demuxer');
          this.state = State.FRAG_LOADING;
          //We have audio frag waiting or video pts
          //Let process it
          this.onFragLoaded(this.waitingFragment);
          //Lets clean the waiting frag
          this.waitingFragment = null;
        }
      }
    }
  }, {
    key: 'startLoad',
    value: function startLoad(startPosition) {
      if (this.tracks) {
        var lastCurrentTime = this.lastCurrentTime;
        this.stopLoad();
        if (!this.timer) {
          this.timer = setInterval(this.ontick, 100);
        }
        this.fragLoadError = 0;
        if (lastCurrentTime > 0 && startPosition === -1) {
          _logger.logger.log('audio:override startPosition with lastCurrentTime @' + lastCurrentTime.toFixed(3));
          this.state = State.IDLE;
        } else {
          this.lastCurrentTime = this.startPosition ? this.startPosition : startPosition;
          this.state = State.STARTING;
        }
        this.nextLoadPosition = this.startPosition = this.lastCurrentTime;
        this.tick();
      } else {
        this.startPosition = startPosition;
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
          track,
          trackDetails,
          hls = this.hls,
          config = hls.config;
      //logger.log('audioStream:' + this.state);
      var now;
      var retryDate;
      var isSeeking;

      var _ret = function () {
        switch (_this2.state) {
          case State.ERROR:
          //don't do anything in error state to avoid breaking further ...
          case State.PAUSED:
          //don't do anything in paused state either ...
          case State.BUFFER_FLUSHING:
            break;
          case State.STARTING:
            _this2.state = State.WAITING_TRACK;
            _this2.loadedmetadata = false;
            break;
          case State.IDLE:
            var tracks = _this2.tracks;
            // audio tracks not received => exit loop
            if (!tracks) {
              break;
            }
            // if video not attached AND
            // start fragment already requested OR start frag prefetch disable
            // exit loop
            // => if media not attached but start frag prefetch is enabled and start frag not requested yet, we will not exit loop
            if (!_this2.media && (_this2.startFragRequested || !config.startFragPrefetch)) {
              break;
            }
            // determine next candidate fragment to be loaded, based on current position and
            //  end of buffer position
            // if we have not yet loaded any fragment, start loading from start position
            if (_this2.loadedmetadata) {
              pos = _this2.media.currentTime;
            } else {
              pos = _this2.nextLoadPosition;
            }
            var media = _this2.mediaBuffer ? _this2.mediaBuffer : _this2.media,
                bufferInfo = _bufferHelper2.default.bufferInfo(media, pos, config.maxBufferHole),
                bufferLen = bufferInfo.len,
                bufferEnd = bufferInfo.end,
                fragPrevious = _this2.fragPrevious,
                maxBufLen = config.maxMaxBufferLength,
                audioSwitch = _this2.audioSwitch,
                trackId = _this2.trackId;

            // if buffer length is less than maxBufLen try to load a new fragment
            if (bufferLen < maxBufLen && trackId < tracks.length) {
              trackDetails = tracks[trackId].details;
              // if track info not retrieved yet, switch state and wait for track retrieval
              if (typeof trackDetails === 'undefined') {
                _this2.state = State.WAITING_TRACK;
                break;
              }

              // we just got done loading the final fragment, check if we need to finalize media stream
              if (!audioSwitch && !trackDetails.live && fragPrevious && fragPrevious.sn === trackDetails.endSN) {
                // if we are not seeking or if we are seeking but everything (almost) til the end is buffered, let's signal eos
                // we don't compare exactly media.duration === bufferInfo.end as there could be some subtle media duration difference when switching
                // between different renditions. using half frag duration should help cope with these cases.
                if (!_this2.media.seeking || _this2.media.duration - bufferEnd < fragPrevious.duration / 2) {
                  // Finalize the media stream
                  _this2.hls.trigger(_events2.default.BUFFER_EOS, { type: 'audio' });
                  _this2.state = State.ENDED;
                  break;
                }
              }

              // find fragment index, contiguous with end of buffer position
              var fragments = trackDetails.fragments,
                  fragLen = fragments.length,
                  start = fragments[0].start,
                  end = fragments[fragLen - 1].start + fragments[fragLen - 1].duration,
                  frag = void 0;

              // When switching audio track, reload audio as close as possible to currentTime
              if (audioSwitch) {
                if (trackDetails.live && !trackDetails.PTSKnown) {
                  _logger.logger.log('switching audiotrack, live stream, unknown PTS,load first fragment');
                  bufferEnd = 0;
                } else {
                  bufferEnd = pos;
                  // if currentTime (pos) is less than alt audio playlist start time, it means that alt audio is ahead of currentTime
                  if (trackDetails.PTSKnown && pos < start) {
                    // if everything is buffered from pos to start or if audio buffer upfront, let's seek to start
                    if (bufferInfo.end > start || bufferInfo.nextStart) {
                      _logger.logger.log('alt audio track ahead of main track, seek to start of alt audio track');
                      _this2.media.currentTime = start + 0.05;
                    } else {
                      return {
                        v: void 0
                      };
                    }
                  }
                }
              }

              // if bufferEnd before start of playlist, load first fragment
              if (bufferEnd <= start) {
                frag = fragments[0];
                if (trackDetails.live && frag.loadIdx && frag.loadIdx === _this2.fragLoadIdx) {
                  // we just loaded this first fragment, and we are still lagging behind the start of the live playlist
                  // let's force seek to start
                  var nextBuffered = bufferInfo.nextStart ? bufferInfo.nextStart : start;
                  _logger.logger.log('no alt audio available @currentTime:' + _this2.media.currentTime + ', seeking @' + (nextBuffered + 0.05));
                  _this2.media.currentTime = nextBuffered + 0.05;
                  return {
                    v: void 0
                  };
                }
              } else {
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
                      //logger.log(`level/sn/start/end/bufEnd:${level}/${candidate.sn}/${candidate.start}/${(candidate.start+candidate.duration)}/${bufferEnd}`);
                      if (candidate.start + candidate.duration - maxFragLookUpTolerance <= bufferEnd) {
                        return 1;
                      } else if (candidate.start - maxFragLookUpTolerance > bufferEnd) {
                        return -1;
                      }
                      return 0;
                    });
                    if (!foundFrag) {
                      _logger.logger.log('frag not found @bufferEnd/start:' + bufferEnd + '/' + start);
                    }
                  } else {
                    // reach end of playlist
                    foundFrag = fragments[fragLen - 1];
                  }
                  if (foundFrag) {
                    frag = foundFrag;
                    start = foundFrag.start;
                    //logger.log('find SN matching with pos:' +  bufferEnd + ':' + frag.sn);
                    if (fragPrevious && frag.level === fragPrevious.level && frag.sn === fragPrevious.sn) {
                      if (frag.sn < trackDetails.endSN) {
                        frag = fragments[frag.sn + 1 - trackDetails.startSN];
                        _logger.logger.log('SN just loaded, load next one: ' + frag.sn);
                      } else {
                        frag = null;
                      }
                    }
                  }
                })();
              }
              if (frag) {
                //logger.log('      loading frag ' + i +',pos/bufEnd:' + pos.toFixed(3) + '/' + bufferEnd.toFixed(3));
                if (frag.decryptdata.uri != null && frag.decryptdata.key == null) {
                  _logger.logger.log('Loading key for ' + frag.sn + ' of [' + trackDetails.startSN + ' ,' + trackDetails.endSN + '],track ' + trackId);
                  _this2.state = State.KEY_LOADING;
                  hls.trigger(_events2.default.KEY_LOADING, { frag: frag });
                } else {
                  _logger.logger.log('Loading ' + frag.sn + ' of [' + trackDetails.startSN + ' ,' + trackDetails.endSN + '],track ' + trackId + ', currentTime:' + pos + ',bufferEnd:' + bufferEnd.toFixed(3));
                  // ensure that we are not reloading the same fragments in loop ...
                  if (_this2.fragLoadIdx !== undefined) {
                    _this2.fragLoadIdx++;
                  } else {
                    _this2.fragLoadIdx = 0;
                  }
                  if (frag.loadCounter) {
                    frag.loadCounter++;
                    var maxThreshold = config.fragLoadingLoopThreshold;
                    // if this frag has already been loaded 3 times, and if it has been reloaded recently
                    if (frag.loadCounter > maxThreshold && Math.abs(_this2.fragLoadIdx - frag.loadIdx) < maxThreshold) {
                      hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.FRAG_LOOP_LOADING_ERROR, fatal: false, frag: frag });
                      return {
                        v: void 0
                      };
                    }
                  } else {
                    frag.loadCounter = 1;
                  }
                  frag.loadIdx = _this2.fragLoadIdx;
                  _this2.fragCurrent = frag;
                  _this2.startFragRequested = true;
                  _this2.nextLoadPosition = frag.start + frag.duration;
                  hls.trigger(_events2.default.FRAG_LOADING, { frag: frag });
                  _this2.state = State.FRAG_LOADING;
                }
              }
            }
            break;
          case State.WAITING_TRACK:
            track = _this2.tracks[_this2.trackId];
            // check if playlist is already loaded
            if (track && track.details) {
              _this2.state = State.IDLE;
            }
            break;
          case State.FRAG_LOADING_WAITING_RETRY:
            now = performance.now();
            retryDate = _this2.retryDate;

            media = _this2.media;
            isSeeking = media && media.seeking;
            // if current time is gt than retryDate, or if media seeking let's switch to IDLE state to retry loading

            if (!retryDate || now >= retryDate || isSeeking) {
              _logger.logger.log('audioStreamController: retryDate reached, switch back to IDLE state');
              _this2.state = State.IDLE;
            }
            break;
          case State.WAITING_INIT_PTS:
          case State.STOPPED:
          case State.FRAG_LOADING:
          case State.PARSING:
          case State.PARSED:
          case State.ENDED:
            break;
          default:
            break;
        }
      }();

      if ((typeof _ret === 'undefined' ? 'undefined' : _typeof(_ret)) === "object") return _ret.v;
    }
  }, {
    key: 'onMediaAttached',
    value: function onMediaAttached(data) {
      var media = this.media = this.mediaBuffer = data.media;
      this.onvseeking = this.onMediaSeeking.bind(this);
      this.onvended = this.onMediaEnded.bind(this);
      media.addEventListener('seeking', this.onvseeking);
      media.addEventListener('ended', this.onvended);
      var config = this.config;
      if (this.tracks && config.autoStartLoad) {
        this.startLoad(config.startPosition);
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
      var tracks = this.tracks;
      if (tracks) {
        // reset fragment load counter
        tracks.forEach(function (track) {
          if (track.details) {
            track.details.fragments.forEach(function (fragment) {
              fragment.loadCounter = undefined;
            });
          }
        });
      }
      // remove video listeners
      if (media) {
        media.removeEventListener('seeking', this.onvseeking);
        media.removeEventListener('ended', this.onvended);
        this.onvseeking = this.onvseeked = this.onvended = null;
      }
      this.media = this.mediaBuffer = null;
      this.loadedmetadata = false;
      this.stopLoad();
    }
  }, {
    key: 'onMediaSeeking',
    value: function onMediaSeeking() {
      if (this.state === State.ENDED) {
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
    key: 'onMediaEnded',
    value: function onMediaEnded() {
      // reset startPosition and lastCurrentTime to restart playback @ stream beginning
      this.startPosition = this.lastCurrentTime = 0;
    }
  }, {
    key: 'onAudioTracksUpdated',
    value: function onAudioTracksUpdated(data) {
      _logger.logger.log('audio tracks updated');
      this.tracks = data.audioTracks;
    }
  }, {
    key: 'onAudioTrackSwitching',
    value: function onAudioTrackSwitching(data) {
      // if any URL found on new audio track, it is an alternate audio track
      var altAudio = !!data.url;
      this.trackId = data.id;
      this.state = State.IDLE;

      this.fragCurrent = null;
      this.state = State.PAUSED;
      this.waitingFragment = null;
      // destroy useless demuxer when switching audio to main
      if (!altAudio) {
        if (this.demuxer) {
          this.demuxer.destroy();
          this.demuxer = null;
        }
      } else {
        // switching to audio track, start timer if not already started
        if (!this.timer) {
          this.timer = setInterval(this.ontick, 100);
        }
      }

      //should we switch tracks ?
      if (altAudio) {
        this.audioSwitch = true;
        //main audio track are handled by stream-controller, just do something if switching to alt audio track
        this.state = State.IDLE;
        // increase fragment load Index to avoid frag loop loading error after buffer flush
        if (this.fragLoadIdx !== undefined) {
          this.fragLoadIdx += 2 * this.config.fragLoadingLoopThreshold;
        }
      }
      this.tick();
    }
  }, {
    key: 'onAudioTrackLoaded',
    value: function onAudioTrackLoaded(data) {
      var newDetails = data.details,
          trackId = data.id,
          track = this.tracks[trackId],
          duration = newDetails.totalduration,
          sliding = 0;

      _logger.logger.log('track ' + trackId + ' loaded [' + newDetails.startSN + ',' + newDetails.endSN + '],duration:' + duration);

      if (newDetails.live) {
        var curDetails = track.details;
        if (curDetails && newDetails.fragments.length > 0) {
          // we already have details for that level, merge them
          _levelHelper2.default.mergeDetails(curDetails, newDetails);
          sliding = newDetails.fragments[0].start;
          // TODO
          //this.liveSyncPosition = this.computeLivePosition(sliding, curDetails);
          if (newDetails.PTSKnown) {
            _logger.logger.log('live audio playlist sliding:' + sliding.toFixed(3));
          } else {
            _logger.logger.log('live audio playlist - outdated PTS, unknown sliding');
          }
        } else {
          newDetails.PTSKnown = false;
          _logger.logger.log('live audio playlist - first load, unknown sliding');
        }
      } else {
        newDetails.PTSKnown = false;
      }
      track.details = newDetails;

      // compute start position
      if (!this.startFragRequested) {
        // compute start position if set to -1. use it straight away if value is defined
        if (this.startPosition === -1) {
          // first, check if start time offset has been set in playlist, if yes, use this value
          var startTimeOffset = newDetails.startTimeOffset;
          if (!isNaN(startTimeOffset)) {
            _logger.logger.log('start time offset found in playlist, adjust startPosition to ' + startTimeOffset);
            this.startPosition = startTimeOffset;
          } else {
            this.startPosition = 0;
          }
        }
        this.nextLoadPosition = this.startPosition;
      }
      // only switch batck to IDLE state if we were waiting for track to start downloading a new fragment
      if (this.state === State.WAITING_TRACK) {
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
      if (this.state === State.FRAG_LOADING && fragCurrent && data.frag.type === 'audio' && data.frag.level === fragCurrent.level && data.frag.sn === fragCurrent.sn) {
        this.state = State.PARSING;
        // transmux the MPEG-TS data to ISO-BMFF segments
        this.stats = data.stats;
        var track = this.tracks[this.trackId],
            details = track.details,
            duration = details.totalduration,
            start = fragCurrent.start,
            trackId = fragCurrent.level,
            sn = fragCurrent.sn,
            cc = fragCurrent.cc,
            audioCodec = this.config.defaultAudioCodec || track.audioCodec;
        this.appended = false;
        if (!this.demuxer) {
          this.demuxer = new _demuxer2.default(this.hls, 'audio');
        }
        //Check if we have video initPTS
        // If not we need to wait for it
        var initPTS = this.initPTS[cc];
        if (initPTS !== undefined) {
          this.pendingBuffering = true;
          _logger.logger.log('Demuxing ' + sn + ' of [' + details.startSN + ' ,' + details.endSN + '],track ' + trackId);
          // time Offset is accurate if level PTS is known, or if playlist is not sliding (not live)
          var accurateTimeOffset = false; //details.PTSKnown || !details.live;
          this.demuxer.push(data.payload, audioCodec, null, start, cc, trackId, sn, duration, fragCurrent.decryptdata, accurateTimeOffset, initPTS);
        } else {
          _logger.logger.log('unknown video PTS for continuity counter ' + cc + ', waiting for video PTS before demuxing audio frag ' + sn + ' of [' + details.startSN + ' ,' + details.endSN + '],track ' + trackId);
          this.waitingFragment = data;
          this.state = State.WAITING_INIT_PTS;
        }
      }
      this.fragLoadError = 0;
    }
  }, {
    key: 'onFragParsingInitSegment',
    value: function onFragParsingInitSegment(data) {
      var fragCurrent = this.fragCurrent;
      if (fragCurrent && data.id === 'audio' && data.sn === fragCurrent.sn && data.level === fragCurrent.level && this.state === State.PARSING) {
        var tracks = data.tracks,
            track = void 0;

        // delete any video track found on audio demuxer
        if (tracks.video) {
          delete tracks.video;
        }

        // include levelCodec in audio and video tracks
        track = tracks.audio;
        if (track) {
          track.levelCodec = 'mp4a.40.2';
          track.id = data.id;
          this.hls.trigger(_events2.default.BUFFER_CODECS, tracks);
          _logger.logger.log('audio track:audio,container:' + track.container + ',codecs[level/parsed]=[' + track.levelCodec + '/' + track.codec + ']');
          var initSegment = track.initSegment;
          if (initSegment) {
            var appendObj = { type: 'audio', data: initSegment, parent: 'audio', content: 'initSegment' };
            if (this.audioSwitch) {
              this.pendingData = [appendObj];
            } else {
              this.appended = true;
              // arm pending Buffering flag before appending a segment
              this.pendingBuffering = true;
              this.hls.trigger(_events2.default.BUFFER_APPENDING, appendObj);
            }
          }
          //trigger handler right now
          this.tick();
        }
      }
    }
  }, {
    key: 'onFragParsingData',
    value: function onFragParsingData(data) {
      var _this3 = this;

      var fragCurrent = this.fragCurrent;
      if (fragCurrent && data.id === 'audio' && data.type === 'audio' && data.sn === fragCurrent.sn && data.level === fragCurrent.level && this.state === State.PARSING) {
        (function () {
          var trackId = _this3.trackId,
              track = _this3.tracks[trackId],
              frag = _this3.fragCurrent,
              hls = _this3.hls;

          _logger.logger.log('parsed ' + data.type + ',PTS:[' + data.startPTS.toFixed(3) + ',' + data.endPTS.toFixed(3) + '],DTS:[' + data.startDTS.toFixed(3) + '/' + data.endDTS.toFixed(3) + '],nb:' + data.nb);
          _levelHelper2.default.updateFragPTSDTS(track.details, frag.sn, data.startPTS, data.endPTS);

          var audioSwitch = _this3.audioSwitch,
              media = _this3.media,
              appendOnBufferFlush = false;
          //Only flush audio from old audio tracks when PTS is known on new audio track
          if (audioSwitch && media) {
            if (media.readyState) {
              var currentTime = media.currentTime;
              _logger.logger.log('switching audio track : currentTime:' + currentTime);
              if (currentTime >= data.startPTS) {
                _logger.logger.log('switching audio track : flushing all audio');
                _this3.state = State.BUFFER_FLUSHING;
                hls.trigger(_events2.default.BUFFER_FLUSHING, { startOffset: 0, endOffset: Number.POSITIVE_INFINITY, type: 'audio' });
                appendOnBufferFlush = true;
                //Lets announce that the initial audio track switch flush occur
                _this3.audioSwitch = false;
                hls.trigger(_events2.default.AUDIO_TRACK_SWITCHED, { id: trackId });
              }
            } else {
              //Lets announce that the initial audio track switch flush occur
              _this3.audioSwitch = false;
              hls.trigger(_events2.default.AUDIO_TRACK_SWITCHED, { id: trackId });
            }
          }

          var pendingData = _this3.pendingData;
          if (!_this3.audioSwitch) {
            [data.data1, data.data2].forEach(function (buffer) {
              if (buffer) {
                pendingData.push({ type: data.type, data: buffer, parent: 'audio', content: 'data' });
              }
            });
            if (!appendOnBufferFlush && pendingData.length) {
              pendingData.forEach(function (appendObj) {
                // arm pending Buffering flag before appending a segment
                _this3.pendingBuffering = true;
                _this3.hls.trigger(_events2.default.BUFFER_APPENDING, appendObj);
              });
              _this3.pendingData = [];
              _this3.appended = true;
            }
          }
          //trigger handler right now
          _this3.tick();
        })();
      }
    }
  }, {
    key: 'onFragParsed',
    value: function onFragParsed(data) {
      var fragCurrent = this.fragCurrent;
      if (fragCurrent && data.id === 'audio' && data.sn === fragCurrent.sn && data.level === fragCurrent.level && this.state === State.PARSING) {
        this.stats.tparsed = performance.now();
        this.state = State.PARSED;
        this._checkAppendedParsed();
      }
    }
  }, {
    key: 'onBufferCreated',
    value: function onBufferCreated(data) {
      var audioTrack = data.tracks.audio;
      if (audioTrack) {
        this.mediaBuffer = audioTrack.buffer;
        this.loadedmetadata = true;
      }
    }
  }, {
    key: 'onBufferAppended',
    value: function onBufferAppended(data) {
      if (data.parent === 'audio') {
        var state = this.state;
        if (state === State.PARSING || state === State.PARSED) {
          // check if all buffers have been appended
          this.pendingBuffering = data.pending > 0;
          this._checkAppendedParsed();
        }
      }
    }
  }, {
    key: '_checkAppendedParsed',
    value: function _checkAppendedParsed() {
      //trigger handler right now
      if (this.state === State.PARSED && (!this.appended || !this.pendingBuffering)) {
        var frag = this.fragCurrent,
            stats = this.stats,
            hls = this.hls;
        if (frag) {
          this.fragPrevious = frag;
          stats.tbuffered = performance.now();
          hls.trigger(_events2.default.FRAG_BUFFERED, { stats: stats, frag: frag, id: 'audio' });
          var media = this.mediaBuffer ? this.mediaBuffer : this.media;
          _logger.logger.log('audio buffered : ' + _timeRanges2.default.toString(media.buffered));
          if (this.audioSwitch && this.appended) {
            this.audioSwitch = false;
            hls.trigger(_events2.default.AUDIO_TRACK_SWITCHED, { id: this.trackId });
          }
          this.state = State.IDLE;
        }
        this.tick();
      }
    }
  }, {
    key: 'onError',
    value: function onError(data) {
      var frag = data.frag;
      // don't handle frag error not related to audio fragment
      if (frag && frag.type !== 'audio') {
        return;
      }
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
            var config = this.config;
            if (loadError <= config.fragLoadingMaxRetry) {
              this.fragLoadError = loadError;
              // reset load counter to avoid frag loop loading error
              frag.loadCounter = 0;
              // exponential backoff capped to config.fragLoadingMaxRetryTimeout
              var delay = Math.min(Math.pow(2, loadError - 1) * config.fragLoadingRetryDelay, config.fragLoadingMaxRetryTimeout);
              _logger.logger.warn('audioStreamController: frag loading failed, retry in ' + delay + ' ms');
              this.retryDate = performance.now() + delay;
              // retry loading state
              this.state = State.FRAG_LOADING_WAITING_RETRY;
            } else {
              _logger.logger.error('audioStreamController: ' + data.details + ' reaches max retry, redispatch as fatal ...');
              // redispatch same error but with fatal set to true
              data.fatal = true;
              this.hls.trigger(_events2.default.ERROR, data);
              this.state = State.ERROR;
            }
          }
          break;
        case _errors.ErrorDetails.FRAG_LOOP_LOADING_ERROR:
        case _errors.ErrorDetails.AUDIO_TRACK_LOAD_ERROR:
        case _errors.ErrorDetails.AUDIO_TRACK_LOAD_TIMEOUT:
        case _errors.ErrorDetails.KEY_LOAD_ERROR:
        case _errors.ErrorDetails.KEY_LOAD_TIMEOUT:
          //  when in ERROR state, don't switch back to IDLE state in case a non-fatal error is received
          if (this.state !== State.ERROR) {
            // if fatal error, stop processing, otherwise move to IDLE to retry loading
            this.state = data.fatal ? State.ERROR : State.IDLE;
            _logger.logger.warn('audioStreamController: ' + data.details + ' while loading frag,switch to ' + this.state + ' state ...');
          }
          break;
        default:
          break;
      }
    }
  }, {
    key: 'onBufferFlushed',
    value: function onBufferFlushed() {
      var _this4 = this;

      var pendingData = this.pendingData;
      if (pendingData && pendingData.length) {
        _logger.logger.log('appending pending audio data on Buffer Flushed');
        pendingData.forEach(function (appendObj) {
          _this4.hls.trigger(_events2.default.BUFFER_APPENDING, appendObj);
        });
        this.appended = true;
        this.pendingData = [];
        this.state = State.PARSED;
      } else {
        // move to IDLE once flush complete. this should trigger new fragment loading
        this.state = State.IDLE;
        // reset reference to frag
        this.fragPrevious = null;
        this.tick();
      }
    }
  }, {
    key: 'state',
    set: function set(nextState) {
      if (this.state !== nextState) {
        var previousState = this.state;
        this._state = nextState;
        _logger.logger.log('audio stream:' + previousState + '->' + nextState);
      }
    },
    get: function get() {
      return this._state;
    }
  }]);

  return AudioStreamController;
}(_eventHandler2.default);

exports.default = AudioStreamController;

},{"22":22,"26":26,"27":27,"28":28,"30":30,"31":31,"41":41,"45":45,"46":46}],6:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = _dereq_(28);

var _events2 = _interopRequireDefault(_events);

var _eventHandler = _dereq_(27);

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _logger = _dereq_(45);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * audio track controller
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               */

var AudioTrackController = function (_EventHandler) {
  _inherits(AudioTrackController, _EventHandler);

  function AudioTrackController(hls) {
    _classCallCheck(this, AudioTrackController);

    var _this = _possibleConstructorReturn(this, (AudioTrackController.__proto__ || Object.getPrototypeOf(AudioTrackController)).call(this, hls, _events2.default.MANIFEST_LOADING, _events2.default.MANIFEST_LOADED, _events2.default.AUDIO_TRACK_LOADED));

    _this.ticks = 0;
    _this.ontick = _this.tick.bind(_this);
    return _this;
  }

  _createClass(AudioTrackController, [{
    key: 'destroy',
    value: function destroy() {
      _eventHandler2.default.prototype.destroy.call(this);
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
      this.updateTrack(this.trackId);
    }
  }, {
    key: 'onManifestLoading',
    value: function onManifestLoading() {
      // reset audio tracks on manifest loading
      this.tracks = [];
      this.trackId = -1;
    }
  }, {
    key: 'onManifestLoaded',
    value: function onManifestLoaded(data) {
      var _this2 = this;

      var tracks = data.audioTracks || [];
      var defaultFound = false;
      this.tracks = tracks;
      this.hls.trigger(_events2.default.AUDIO_TRACKS_UPDATED, { audioTracks: tracks });
      // loop through available audio tracks and autoselect default if needed
      var id = 0;
      tracks.forEach(function (track) {
        if (track.default) {
          _this2.audioTrack = id;
          defaultFound = true;
          return;
        }
        id++;
      });
      if (defaultFound === false && tracks.length) {
        _logger.logger.log('no default audio track defined, use first audio track as default');
        this.audioTrack = 0;
      }
    }
  }, {
    key: 'onAudioTrackLoaded',
    value: function onAudioTrackLoaded(data) {
      if (data.id < this.tracks.length) {
        _logger.logger.log('audioTrack ' + data.id + ' loaded');
        this.tracks[data.id].details = data.details;
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
    }

    /** get alternate audio tracks list from playlist **/

  }, {
    key: 'setAudioTrackInternal',
    value: function setAudioTrackInternal(newId) {
      // check if level idx is valid
      if (newId >= 0 && newId < this.tracks.length) {
        // stopping live reloading timer if any
        if (this.timer) {
          clearInterval(this.timer);
          this.timer = null;
        }
        this.trackId = newId;
        _logger.logger.log('switching to audioTrack ' + newId);
        var audioTrack = this.tracks[newId],
            hls = this.hls,
            type = audioTrack.type,
            url = audioTrack.url,
            eventObj = { id: newId, type: type, url: url };
        // keep AUDIO_TRACK_SWITCH for legacy reason
        hls.trigger(_events2.default.AUDIO_TRACK_SWITCH, eventObj);
        hls.trigger(_events2.default.AUDIO_TRACK_SWITCHING, eventObj);
        // check if we need to load playlist for this audio Track
        var details = audioTrack.details;
        if (url && (details === undefined || details.live === true)) {
          // track not retrieved yet, or live playlist we need to (re)load it
          _logger.logger.log('(re)loading playlist for audioTrack ' + newId);
          hls.trigger(_events2.default.AUDIO_TRACK_LOADING, { url: url, id: newId });
        }
      }
    }
  }, {
    key: 'updateTrack',
    value: function updateTrack(newId) {
      // check if level idx is valid
      if (newId >= 0 && newId < this.tracks.length) {
        // stopping live reloading timer if any
        if (this.timer) {
          clearInterval(this.timer);
          this.timer = null;
        }
        this.trackId = newId;
        _logger.logger.log('updating audioTrack ' + newId);
        var audioTrack = this.tracks[newId],
            url = audioTrack.url;
        // check if we need to load playlist for this audio Track
        var details = audioTrack.details;
        if (url && (details === undefined || details.live === true)) {
          // track not retrieved yet, or live playlist we need to (re)load it
          _logger.logger.log('(re)loading playlist for audioTrack ' + newId);
          this.hls.trigger(_events2.default.AUDIO_TRACK_LOADING, { url: url, id: newId });
        }
      }
    }
  }, {
    key: 'audioTracks',
    get: function get() {
      return this.tracks;
    }

    /** get index of the selected audio track (index in audio track lists) **/

  }, {
    key: 'audioTrack',
    get: function get() {
      return this.trackId;
    }

    /** select an audio track, based on its index in audio track lists**/
    ,
    set: function set(audioTrackId) {
      if (this.trackId !== audioTrackId || this.tracks[audioTrackId].details === undefined) {
        this.setAudioTrackInternal(audioTrackId);
      }
    }
  }]);

  return AudioTrackController;
}(_eventHandler2.default);

exports.default = AudioTrackController;

},{"27":27,"28":28,"45":45}],7:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = _dereq_(28);

var _events2 = _interopRequireDefault(_events);

var _eventHandler = _dereq_(27);

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _logger = _dereq_(45);

var _errors = _dereq_(26);

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

    // the value that we have set mediasource.duration to
    // (the actual duration may be tweaked slighly by the browser)
    var _this = _possibleConstructorReturn(this, (BufferController.__proto__ || Object.getPrototypeOf(BufferController)).call(this, hls, _events2.default.MEDIA_ATTACHING, _events2.default.MEDIA_DETACHING, _events2.default.MANIFEST_PARSED, _events2.default.BUFFER_RESET, _events2.default.BUFFER_APPENDING, _events2.default.BUFFER_CODECS, _events2.default.BUFFER_EOS, _events2.default.BUFFER_FLUSHING, _events2.default.LEVEL_PTS_UPDATED, _events2.default.LEVEL_UPDATED));

    _this._msDuration = null;
    // the value that we want to set mediaSource.duration to
    _this._levelDuration = null;

    // Source Buffer listeners
    _this.onsbue = _this.onSBUpdateEnd.bind(_this);
    _this.onsbe = _this.onSBUpdateError.bind(_this);
    _this.pendingTracks = {};
    _this.tracks = {};
    return _this;
  }

  _createClass(BufferController, [{
    key: 'destroy',
    value: function destroy() {
      _eventHandler2.default.prototype.destroy.call(this);
    }
  }, {
    key: 'onLevelPtsUpdated',
    value: function onLevelPtsUpdated(data) {
      var type = data.type;
      var audioTrack = this.tracks.audio;

      // Adjusting `SourceBuffer.timestampOffset` (desired point in the timeline where the next frames should be appended)
      // in Chrome browser when we detect MPEG audio container and time delta between level PTS and `SourceBuffer.timestampOffset`
      // is greater than 100ms (this is enough to handle seek for VOD or level change for LIVE videos). At the time of change we issue
      // `SourceBuffer.abort()` and adjusting `SourceBuffer.timestampOffset` if `SourceBuffer.updating` is false or awaiting `updateend`
      // event if SB is in updating state.
      // More info here: https://github.com/dailymotion/hls.js/issues/332#issuecomment-257986486

      if (type === 'audio' && audioTrack && audioTrack.container === 'audio/mpeg') {
        // Chrome audio mp3 track
        var audioBuffer = this.sourceBuffer.audio;
        var delta = Math.abs(audioBuffer.timestampOffset - data.start);

        // adjust timestamp offset if time delta is greater than 100ms
        if (delta > 0.1) {
          var updating = audioBuffer.updating;

          try {
            audioBuffer.abort();
          } catch (err) {
            updating = true;
            _logger.logger.warn('can not abort audio buffer: ' + err);
          }

          if (!updating) {
            _logger.logger.warn('change mpeg audio timestamp offset from ' + audioBuffer.timestampOffset + ' to ' + data.start);
            audioBuffer.timestampOffset = data.start;
          } else {
            this.audioTimestampOffset = data.start;
          }
        }
      }
    }
  }, {
    key: 'onManifestParsed',
    value: function onManifestParsed(data) {
      var audioExpected = data.audio,
          videoExpected = data.video,
          sourceBufferNb = 0;
      // in case of alt audio 2 BUFFER_CODECS events will be triggered, one per stream controller
      // sourcebuffers will be created all at once when the expected nb of tracks will be reached
      // in case alt audio is not used, only one BUFFER_CODEC event will be fired from main stream controller
      // it will contain the expected nb of source buffers, no need to compute it
      if (data.altAudio && (audioExpected || videoExpected)) {
        sourceBufferNb = (audioExpected ? 1 : 0) + (videoExpected ? 1 : 0);
        _logger.logger.log(sourceBufferNb + ' sourceBuffer(s) expected');
      }
      this.sourceBufferNb = sourceBufferNb;
    }
  }, {
    key: 'onMediaAttaching',
    value: function onMediaAttaching(data) {
      var media = this.media = data.media;
      if (media) {
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
    }
  }, {
    key: 'onMediaDetaching',
    value: function onMediaDetaching() {
      _logger.logger.log('media source detaching');
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

        // Detach properly the MediaSource from the HTMLMediaElement as
        // suggested in https://github.com/w3c/media-source/issues/53.
        if (this.media) {
          URL.revokeObjectURL(this.media.src);
          this.media.removeAttribute('src');
          this.media.load();
        }

        this.mediaSource = null;
        this.media = null;
        this.pendingTracks = {};
        this.tracks = {};
        this.sourceBuffer = {};
        this.flushRange = [];
        this.segments = [];
        this.appended = 0;
      }
      this.onmso = this.onmse = this.onmsc = null;
      this.hls.trigger(_events2.default.MEDIA_DETACHED);
    }
  }, {
    key: 'onMediaSourceOpen',
    value: function onMediaSourceOpen() {
      _logger.logger.log('media source opened');
      this.hls.trigger(_events2.default.MEDIA_ATTACHED, { media: this.media });
      var mediaSource = this.mediaSource;
      if (mediaSource) {
        // once received, don't listen anymore to sourceopen event
        mediaSource.removeEventListener('sourceopen', this.onmso);
      }
      this.checkPendingTracks();
    }
  }, {
    key: 'checkPendingTracks',
    value: function checkPendingTracks() {
      // if any buffer codecs pending, check if we have enough to create sourceBuffers
      var pendingTracks = this.pendingTracks,
          pendingTracksNb = Object.keys(pendingTracks).length;
      // if any pending tracks and (if nb of pending tracks gt or equal than expected nb or if unknown expected nb)
      if (pendingTracksNb && (this.sourceBufferNb <= pendingTracksNb || this.sourceBufferNb === 0)) {
        // ok, let's create them now !
        this.createSourceBuffers(pendingTracks);
        this.pendingTracks = {};
        // append any pending segments now !
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
      // update timestampOffset
      if (this.audioTimestampOffset) {
        var audioBuffer = this.sourceBuffer.audio;
        _logger.logger.warn('change mpeg audio timestamp offset from ' + audioBuffer.timestampOffset + ' to ' + this.audioTimestampOffset);
        audioBuffer.timestampOffset = this.audioTimestampOffset;
        delete this.audioTimestampOffset;
      }

      if (this._needsFlush) {
        this.doFlush();
      }

      if (this._needsEos) {
        this.checkEos();
      }
      this.appending = false;
      var parent = this.parent;
      // count nb of pending segments waiting for appending on this sourcebuffer
      var pending = this.segments.reduce(function (counter, segment) {
        return segment.parent === parent ? counter + 1 : counter;
      }, 0);
      this.hls.trigger(_events2.default.BUFFER_APPENDED, { parent: parent, pending: pending });

      // don't append in flushing mode
      if (!this._needsFlush) {
        this.doAppending();
      }

      this.updateMediaElementDuration();
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
      for (var type in sourceBuffer) {
        var sb = sourceBuffer[type];
        try {
          this.mediaSource.removeSourceBuffer(sb);
          sb.removeEventListener('updateend', this.onsbue);
          sb.removeEventListener('error', this.onsbe);
        } catch (err) {}
      }
      this.sourceBuffer = {};
      this.flushRange = [];
      this.segments = [];
      this.appended = 0;
    }
  }, {
    key: 'onBufferCodecs',
    value: function onBufferCodecs(tracks) {
      // if source buffer(s) not created yet, appended buffer tracks in this.pendingTracks
      // if sourcebuffers already created, do nothing ...
      if (Object.keys(this.sourceBuffer).length === 0) {
        for (var trackName in tracks) {
          this.pendingTracks[trackName] = tracks[trackName];
        }
        var mediaSource = this.mediaSource;
        if (mediaSource && mediaSource.readyState === 'open') {
          // try to create sourcebuffers if mediasource opened
          this.checkPendingTracks();
        }
      }
    }
  }, {
    key: 'createSourceBuffers',
    value: function createSourceBuffers(tracks) {
      var sourceBuffer = this.sourceBuffer,
          mediaSource = this.mediaSource;

      for (var trackName in tracks) {
        if (!sourceBuffer[trackName]) {
          var track = tracks[trackName];
          // use levelCodec as first priority
          var codec = track.levelCodec || track.codec;
          var mimeType = track.container + ';codecs=' + codec;
          _logger.logger.log('creating sourceBuffer(' + mimeType + ')');
          try {
            var sb = sourceBuffer[trackName] = mediaSource.addSourceBuffer(mimeType);
            sb.addEventListener('updateend', this.onsbue);
            sb.addEventListener('error', this.onsbe);
            this.tracks[trackName] = { codec: codec, container: track.container };
            track.buffer = sb;
          } catch (err) {
            _logger.logger.error('error while trying to add sourceBuffer:' + err.message);
            this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.BUFFER_ADD_CODEC_ERROR, fatal: false, err: err, mimeType: mimeType });
          }
        }
      }
      this.hls.trigger(_events2.default.BUFFER_CREATED, { tracks: tracks });
    }
  }, {
    key: 'onBufferAppending',
    value: function onBufferAppending(data) {
      if (!this._needsFlush) {
        if (!this.segments) {
          this.segments = [data];
        } else {
          this.segments.push(data);
        }
        this.doAppending();
      }
    }
  }, {
    key: 'onBufferAppendFail',
    value: function onBufferAppendFail(data) {
      _logger.logger.error('sourceBuffer error:', data.event);
      // according to http://www.w3.org/TR/media-source/#sourcebuffer-append-error
      // this error might not always be fatal (it is fatal if decode error is set, in that case
      // it will be followed by a mediaElement error ...)
      this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.BUFFER_APPENDING_ERROR, fatal: false, frag: this.fragCurrent });
    }

    // on BUFFER_EOS mark matching sourcebuffer(s) as ended and trigger checkEos()

  }, {
    key: 'onBufferEos',
    value: function onBufferEos(data) {
      var sb = this.sourceBuffer;
      var dataType = data.type;
      for (var type in sb) {
        if (!dataType || type === dataType) {
          if (!sb[type].ended) {
            sb[type].ended = true;
            _logger.logger.log(type + ' sourceBuffer now EOS');
          }
        }
      }
      this.checkEos();
    }

    // if all source buffers are marked as ended, signal endOfStream() to MediaSource.

  }, {
    key: 'checkEos',
    value: function checkEos() {
      var sb = this.sourceBuffer,
          mediaSource = this.mediaSource;
      if (!mediaSource || mediaSource.readyState !== 'open') {
        this._needsEos = false;
        return;
      }
      for (var type in sb) {
        var sbobj = sb[type];
        if (!sbobj.ended) {
          return;
        }
        if (sbobj.updating) {
          this._needsEos = true;
          return;
        }
      }
      _logger.logger.log('all media data available, signal endOfStream() to MediaSource and stop loading fragment');
      //Notify the media element that it now has all of the media data
      try {
        mediaSource.endOfStream();
      } catch (e) {
        _logger.logger.warn('exception while calling mediaSource.endOfStream()');
      }
      this._needsEos = false;
    }
  }, {
    key: 'onBufferFlushing',
    value: function onBufferFlushing(data) {
      this.flushRange.push({ start: data.startOffset, end: data.endOffset, type: data.type });
      // attempt flush immediatly
      this.flushBufferCounter = 0;
      this.doFlush();
    }
  }, {
    key: 'onLevelUpdated',
    value: function onLevelUpdated(event) {
      var details = event.details;
      if (details.fragments.length === 0) {
        return;
      }
      this._levelDuration = details.totalduration + details.fragments[0].start;
      this.updateMediaElementDuration();
    }

    // https://github.com/dailymotion/hls.js/issues/355

  }, {
    key: 'updateMediaElementDuration',
    value: function updateMediaElementDuration() {
      var media = this.media,
          mediaSource = this.mediaSource,
          sourceBuffer = this.sourceBuffer,
          levelDuration = this._levelDuration;
      if (levelDuration === null || !media || !mediaSource || !sourceBuffer || media.readyState === 0 || mediaSource.readyState !== 'open') {
        return;
      }
      for (var type in sourceBuffer) {
        if (sourceBuffer[type].updating) {
          // can't set duration whilst a buffer is updating
          return;
        }
      }
      if (this._msDuration === null) {
        // initialise to the value that the media source is reporting
        this._msDuration = mediaSource.duration;
      }
      var duration = media.duration;
      // levelDuration was the last value we set.
      // not using mediaSource.duration as the browser may tweak this value
      // only update mediasource duration if its value increase, this is to avoid
      // flushing already buffered portion when switching between quality level
      if (levelDuration > this._msDuration && levelDuration > duration || duration === Infinity || isNaN(duration)) {
        _logger.logger.log('Updating mediasource duration to ' + levelDuration.toFixed(3));
        this._msDuration = mediaSource.duration = levelDuration;
      }
    }
  }, {
    key: 'doFlush',
    value: function doFlush() {
      // loop through all buffer ranges to flush
      while (this.flushRange.length) {
        var range = this.flushRange[0];
        // flushBuffer will abort any buffer append in progress and flush Audio/Video Buffer
        if (this.flushBuffer(range.start, range.end, range.type)) {
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
        try {
          for (var type in sourceBuffer) {
            appended += sourceBuffer[type].buffered.length;
          }
        } catch (error) {
          // error could be thrown while accessing buffered, in case sourcebuffer has already been removed from MediaSource
          // this is harmess at this stage, catch this to avoid reporting an internal exception
          _logger.logger.error('error while accessing sourceBuffer.buffered');
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
      if (Object.keys(sourceBuffer).length) {
        if (this.media.error) {
          this.segments = [];
          _logger.logger.error('trying to append although a media error occured, flush segment and abort');
          return;
        }
        if (this.appending) {
          //logger.log(`sb appending in progress`);
          return;
        }
        if (segments && segments.length) {
          var segment = segments.shift();
          try {
            var type = segment.type,
                sb = sourceBuffer[type];
            if (sb) {
              if (!sb.updating) {
                // reset sourceBuffer ended flag before appending segment
                sb.ended = false;
                //logger.log(`appending ${segment.content} ${type} SB, size:${segment.data.length}, ${segment.parent}`);
                this.parent = segment.parent;
                sb.appendBuffer(segment.data);
                this.appendError = 0;
                this.appended++;
                this.appending = true;
              } else {
                segments.unshift(segment);
              }
            } else {
              // in case we don't have any source buffer matching with this segment type,
              // it means that Mediasource fails to create sourcebuffer
              // discard this segment, and trigger update end
              this.onSBUpdateEnd();
            }
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
              this.segments = [];
              event.details = _errors.ErrorDetails.BUFFER_FULL_ERROR;
              event.fatal = false;
              hls.trigger(_events2.default.ERROR, event);
              return;
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
    value: function flushBuffer(startOffset, endOffset, typeIn) {
      var sb,
          i,
          bufStart,
          bufEnd,
          flushStart,
          flushEnd,
          sourceBuffer = this.sourceBuffer;
      if (Object.keys(sourceBuffer).length) {
        _logger.logger.log('flushBuffer,pos/start/end: ' + this.media.currentTime.toFixed(3) + '/' + startOffset + '/' + endOffset);
        // safeguard to avoid infinite looping : don't try to flush more than the nb of appended segments
        if (this.flushBufferCounter < this.appended) {
          for (var type in sourceBuffer) {
            // check if sourcebuffer type is defined (typeIn): if yes, let's only flush this one
            // if no, let's flush all sourcebuffers
            if (typeIn && type !== typeIn) {
              continue;
            }
            sb = sourceBuffer[type];
            // we are going to flush buffer, mark source buffer as 'not ended'
            sb.ended = false;
            if (!sb.updating) {
              try {
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
              } catch (e) {
                _logger.logger.warn('exception while accessing sourcebuffer, it might have been removed from MediaSource');
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
      }
      // everything flushed !
      return true;
    }
  }]);

  return BufferController;
}(_eventHandler2.default);

exports.default = BufferController;

},{"26":26,"27":27,"28":28,"45":45}],8:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = _dereq_(28);

var _events2 = _interopRequireDefault(_events);

var _eventHandler = _dereq_(27);

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

    return _possibleConstructorReturn(this, (CapLevelController.__proto__ || Object.getPrototypeOf(CapLevelController)).call(this, hls, _events2.default.FPS_DROP_LEVEL_CAPPING, _events2.default.MEDIA_ATTACHING, _events2.default.MANIFEST_PARSED));
  }

  _createClass(CapLevelController, [{
    key: 'destroy',
    value: function destroy() {
      if (this.hls.config.capLevelToPlayerSize) {
        this.media = this.restrictedLevels = null;
        this.autoLevelCapping = Number.POSITIVE_INFINITY;
        if (this.timer) {
          this.timer = clearInterval(this.timer);
        }
      }
    }
  }, {
    key: 'onFpsDropLevelCapping',
    value: function onFpsDropLevelCapping(data) {
      if (!this.restrictedLevels) {
        this.restrictedLevels = [];
      }
      if (!this.isLevelRestricted(data.droppedLevel)) {
        this.restrictedLevels.push(data.droppedLevel);
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
      var hls = this.hls;
      if (hls.config.capLevelToPlayerSize) {
        this.autoLevelCapping = Number.POSITIVE_INFINITY;
        this.levels = data.levels;
        hls.firstLevel = this.getMaxLevel(data.firstLevel);
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
          var hls = this.hls;
          hls.autoLevelCapping = this.getMaxLevel(levelsLength - 1);
          if (hls.autoLevelCapping > this.autoLevelCapping) {
            // if auto level capping has a higher value for the previous one, flush the buffer using nextLevelSwitch
            // usually happen when the user go to the fullscreen mode.
            hls.streamController.nextLevelSwitch();
          }
          this.autoLevelCapping = hls.autoLevelCapping;
        }
      }
    }

    /*
    * returns level should be the one with the dimensions equal or greater than the media (player) dimensions (so the video will be downscaled)
    */

  }, {
    key: 'getMaxLevel',
    value: function getMaxLevel(capLevelIndex) {
      var result = 0,
          i = void 0,
          level = void 0,
          mWidth = this.mediaWidth,
          mHeight = this.mediaHeight,
          lWidth = 0,
          lHeight = 0;

      for (i = 0; i <= capLevelIndex; i++) {
        level = this.levels[i];
        if (this.isLevelRestricted(i)) {
          break;
        }
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
    key: 'isLevelRestricted',
    value: function isLevelRestricted(level) {
      return this.restrictedLevels && this.restrictedLevels.indexOf(level) !== -1 ? true : false;
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
      var media = this.media;
      if (media) {
        width = media.width || media.clientWidth || media.offsetWidth;
        width *= this.contentScaleFactor;
      }
      return width;
    }
  }, {
    key: 'mediaHeight',
    get: function get() {
      var height = void 0;
      var media = this.media;
      if (media) {
        height = media.height || media.clientHeight || media.offsetHeight;
        height *= this.contentScaleFactor;
      }
      return height;
    }
  }]);

  return CapLevelController;
}(_eventHandler2.default);

exports.default = CapLevelController;

},{"27":27,"28":28}],9:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * EWMA Bandwidth Estimator
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *  - heavily inspired from shaka-player
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Tracks bandwidth samples and estimates available bandwidth.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Based on the minimum of two exponentially-weighted moving averages with
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * different half-lives.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */

var _ewma = _dereq_(44);

var _ewma2 = _interopRequireDefault(_ewma);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var EwmaBandWidthEstimator = function () {
  function EwmaBandWidthEstimator(hls, slow, fast, defaultEstimate) {
    _classCallCheck(this, EwmaBandWidthEstimator);

    this.hls = hls;
    this.defaultEstimate_ = defaultEstimate;
    this.minWeight_ = 0.001;
    this.minDelayMs_ = 50;
    this.slow_ = new _ewma2.default(slow);
    this.fast_ = new _ewma2.default(fast);
  }

  _createClass(EwmaBandWidthEstimator, [{
    key: 'sample',
    value: function sample(durationMs, numBytes) {
      durationMs = Math.max(durationMs, this.minDelayMs_);
      var bandwidth = 8000 * numBytes / durationMs,

      //console.log('instant bw:'+ Math.round(bandwidth));
      // we weight sample using loading duration....
      weight = durationMs / 1000;
      this.fast_.sample(weight, bandwidth);
      this.slow_.sample(weight, bandwidth);
    }
  }, {
    key: 'canEstimate',
    value: function canEstimate() {
      var fast = this.fast_;
      return fast && fast.getTotalWeight() >= this.minWeight_;
    }
  }, {
    key: 'getEstimate',
    value: function getEstimate() {
      if (this.canEstimate()) {
        //console.log('slow estimate:'+ Math.round(this.slow_.getEstimate()));
        //console.log('fast estimate:'+ Math.round(this.fast_.getEstimate()));
        // Take the minimum of these two estimates.  This should have the effect of
        // adapting down quickly, but up more slowly.
        return Math.min(this.fast_.getEstimate(), this.slow_.getEstimate());
      } else {
        return this.defaultEstimate_;
      }
    }
  }, {
    key: 'destroy',
    value: function destroy() {}
  }]);

  return EwmaBandWidthEstimator;
}();

exports.default = EwmaBandWidthEstimator;

},{"44":44}],10:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = _dereq_(28);

var _events2 = _interopRequireDefault(_events);

var _eventHandler = _dereq_(27);

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _logger = _dereq_(45);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * FPS Controller
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               */

var FPSController = function (_EventHandler) {
  _inherits(FPSController, _EventHandler);

  function FPSController(hls) {
    _classCallCheck(this, FPSController);

    return _possibleConstructorReturn(this, (FPSController.__proto__ || Object.getPrototypeOf(FPSController)).call(this, hls, _events2.default.MEDIA_ATTACHING));
  }

  _createClass(FPSController, [{
    key: 'destroy',
    value: function destroy() {
      if (this.timer) {
        clearInterval(this.timer);
      }
      this.isVideoPlaybackQualityAvailable = false;
    }
  }, {
    key: 'onMediaAttaching',
    value: function onMediaAttaching(data) {
      var config = this.hls.config;
      if (config.capLevelOnFPSDrop) {
        var video = this.video = data.media instanceof HTMLVideoElement ? data.media : null;
        if (typeof video.getVideoPlaybackQuality === 'function') {
          this.isVideoPlaybackQualityAvailable = true;
        }
        clearInterval(this.timer);
        this.timer = setInterval(this.checkFPSInterval.bind(this), config.fpsDroppedMonitoringPeriod);
      }
    }
  }, {
    key: 'checkFPS',
    value: function checkFPS(video, decodedFrames, droppedFrames) {
      var currentTime = performance.now();
      if (decodedFrames) {
        if (this.lastTime) {
          var currentPeriod = currentTime - this.lastTime,
              currentDropped = droppedFrames - this.lastDroppedFrames,
              currentDecoded = decodedFrames - this.lastDecodedFrames,
              droppedFPS = 1000 * currentDropped / currentPeriod,
              hls = this.hls;
          hls.trigger(_events2.default.FPS_DROP, { currentDropped: currentDropped, currentDecoded: currentDecoded, totalDroppedFrames: droppedFrames });
          if (droppedFPS > 0) {
            //logger.log('checkFPS : droppedFPS/decodedFPS:' + droppedFPS/(1000 * currentDecoded / currentPeriod));
            if (currentDropped > hls.config.fpsDroppedMonitoringThreshold * currentDecoded) {
              var currentLevel = hls.currentLevel;
              _logger.logger.warn('drop FPS ratio greater than max allowed value for currentLevel: ' + currentLevel);
              if (currentLevel > 0 && (hls.autoLevelCapping === -1 || hls.autoLevelCapping >= currentLevel)) {
                currentLevel = currentLevel - 1;
                hls.trigger(_events2.default.FPS_DROP_LEVEL_CAPPING, { level: currentLevel, droppedLevel: hls.currentLevel });
                hls.autoLevelCapping = currentLevel;
                hls.streamController.nextLevelSwitch();
              }
            }
          }
        }
        this.lastTime = currentTime;
        this.lastDroppedFrames = droppedFrames;
        this.lastDecodedFrames = decodedFrames;
      }
    }
  }, {
    key: 'checkFPSInterval',
    value: function checkFPSInterval() {
      var video = this.video;
      if (video) {
        if (this.isVideoPlaybackQualityAvailable) {
          var videoPlaybackQuality = video.getVideoPlaybackQuality();
          this.checkFPS(video, videoPlaybackQuality.totalVideoFrames, videoPlaybackQuality.droppedVideoFrames);
        } else {
          this.checkFPS(video, video.webkitDecodedFrameCount, video.webkitDroppedFrameCount);
        }
      }
    }
  }]);

  return FPSController;
}(_eventHandler2.default);

exports.default = FPSController;

},{"27":27,"28":28,"45":45}],11:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = _dereq_(28);

var _events2 = _interopRequireDefault(_events);

var _eventHandler = _dereq_(27);

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _logger = _dereq_(45);

var _errors = _dereq_(26);

var _bufferHelper = _dereq_(30);

var _bufferHelper2 = _interopRequireDefault(_bufferHelper);

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

    var _this = _possibleConstructorReturn(this, (LevelController.__proto__ || Object.getPrototypeOf(LevelController)).call(this, hls, _events2.default.MANIFEST_LOADED, _events2.default.LEVEL_LOADED, _events2.default.FRAG_LOADED, _events2.default.ERROR));

    _this.ontick = _this.tick.bind(_this);
    _this._manualLevel = _this._autoLevelCapping = -1;
    return _this;
  }

  _createClass(LevelController, [{
    key: 'destroy',
    value: function destroy() {
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
      this._manualLevel = -1;
    }
  }, {
    key: 'startLoad',
    value: function startLoad() {
      this.canload = true;
      var levels = this._levels;
      // clean up live level details to force reload them, and reset load errors
      if (levels) {
        levels.forEach(function (level) {
          level.loadError = 0;
          var levelDetails = level.details;
          if (levelDetails && levelDetails.live) {
            level.details = undefined;
          }
        });
      }
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
          bitrateSet = {},
          videoCodecFound = false,
          audioCodecFound = false,
          hls = this.hls,
          brokenmp4inmp3 = /chrome|firefox/.test(navigator.userAgent.toLowerCase()),
          checkSupported = function checkSupported(type, codec) {
        return MediaSource.isTypeSupported(type + '/mp4;codecs=' + codec);
      };

      // regroup redundant level together
      data.levels.forEach(function (level) {
        if (level.videoCodec) {
          videoCodecFound = true;
        }
        // erase audio codec info if browser does not support mp4a.40.34. demuxer will autodetect codec and fallback to mpeg/audio
        if (brokenmp4inmp3 && level.audioCodec && level.audioCodec.indexOf('mp4a.40.34') !== -1) {
          level.audioCodec = undefined;
        }
        if (level.audioCodec || level.attrs && level.attrs.AUDIO) {
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
        var audioCodec = level.audioCodec,
            videoCodec = level.videoCodec;
        return (!audioCodec || checkSupported('audio', audioCodec)) && (!videoCodec || checkSupported('video', videoCodec));
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
        for (var i = 0; i < levels.length; i++) {
          if (levels[i].bitrate === bitrateStart) {
            this._firstLevel = i;
            _logger.logger.log('manifest loaded,' + levels.length + ' level(s) found, first bitrate:' + bitrateStart);
            break;
          }
        }
        hls.trigger(_events2.default.MANIFEST_PARSED, { levels: levels, firstLevel: this._firstLevel, stats: data.stats, audio: audioCodecFound, video: videoCodecFound, altAudio: data.audioTracks.length > 0 });
      } else {
        hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.MANIFEST_INCOMPATIBLE_CODECS_ERROR, fatal: true, url: hls.url, reason: 'no level with compatible codecs found in manifest' });
      }
      return;
    }
  }, {
    key: 'setLevelInternal',
    value: function setLevelInternal(newLevel) {
      var levels = this._levels;
      // check if level idx is valid
      if (newLevel >= 0 && newLevel < levels.length) {
        // stopping live reloading timer if any
        if (this.timer) {
          clearTimeout(this.timer);
          this.timer = null;
        }
        if (this._level !== newLevel) {
          _logger.logger.log('switching to level ' + newLevel);
          this._level = newLevel;
          this.hls.trigger(_events2.default.LEVEL_SWITCH, { level: newLevel });
        }
        var level = levels[newLevel],
            levelDetails = level.details;
        // check if we need to load playlist for this level
        if (!levelDetails || levelDetails.live === true) {
          // level not retrieved yet, or live playlist we need to (re)load it
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
          levelId = void 0,
          level = void 0,
          levelError = false,
          abrController = hls.abrController,
          minAutoLevel = abrController.minAutoLevel;
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
          levelId = data.context.level;
          levelError = true;
          break;
        case _errors.ErrorDetails.REMUX_ALLOC_ERROR:
          levelId = data.level;
          break;
        default:
          break;
      }
      /* try to switch to a redundant stream if any available.
       * if no redundant stream available, emergency switch down (if in auto mode and current level not 0)
       * otherwise, we cannot recover this network error ...
       */
      if (levelId !== undefined) {
        level = this._levels[levelId];
        if (!level.loadError) {
          level.loadError = 1;
        } else {
          level.loadError++;
        }
        // if any redundant streams available and if we haven't try them all (level.loadError is reseted on successful frag/level load.
        // if level.loadError reaches nbRedundantLevel it means that we tried them all, no hope  => let's switch down
        var nbRedundantLevel = level.url.length;
        if (nbRedundantLevel > 1 && level.loadError < nbRedundantLevel) {
          level.urlId = (level.urlId + 1) % nbRedundantLevel;
          level.details = undefined;
          _logger.logger.warn('level controller,' + details + ' for level ' + levelId + ': switching to redundant stream id ' + level.urlId);
        } else {
          // we could try to recover if in auto mode and current level not lowest level (0)
          var recoverable = this._manualLevel === -1 && levelId;
          if (recoverable) {
            _logger.logger.warn('level controller,' + details + ': switch-down for next fragment');
            abrController.nextAutoLevel = Math.max(minAutoLevel, levelId - 1);
          } else if (level && level.details && level.details.live) {
            _logger.logger.warn('level controller,' + details + ' on live stream, discard');
            if (levelError) {
              // reset this._level so that another call to set level() will retrigger a frag load
              this._level = undefined;
            }
            // other errors are handled by stream controller
          } else if (details === _errors.ErrorDetails.LEVEL_LOAD_ERROR || details === _errors.ErrorDetails.LEVEL_LOAD_TIMEOUT) {
            var media = hls.media,

            // 0.5 : tolerance needed as some browsers stalls playback before reaching buffered end
            mediaBuffered = media && _bufferHelper2.default.isBuffered(media, media.currentTime) && _bufferHelper2.default.isBuffered(media, media.currentTime + 0.5);
            if (mediaBuffered) {
              var retryDelay = hls.config.levelLoadingRetryDelay;
              _logger.logger.warn('level controller,' + details + ', but media buffered, retry in ' + retryDelay + 'ms');
              this.timer = setTimeout(this.ontick, retryDelay);
            } else {
              _logger.logger.error('cannot recover ' + details + ' error');
              this._level = undefined;
              // stopping live reloading timer if any
              if (this.timer) {
                clearTimeout(this.timer);
                this.timer = null;
              }
              // redispatch same error but with fatal set to true
              data.fatal = true;
              hls.trigger(_events2.default.ERROR, data);
            }
          }
        }
      }
    }

    // reset level load error counter on successful frag loaded

  }, {
    key: 'onFragLoaded',
    value: function onFragLoaded(data) {
      var fragLoaded = data.frag;
      if (fragLoaded && fragLoaded.type === 'main') {
        var level = this._levels[fragLoaded.level];
        if (level) {
          level.loadError = 0;
        }
      }
    }
  }, {
    key: 'onLevelLoaded',
    value: function onLevelLoaded(data) {
      var levelId = data.level;
      // only process level loaded events matching with expected level
      if (levelId === this._level) {
        var curLevel = this._levels[levelId];
        // reset level load error counter on successful level loaded
        curLevel.loadError = 0;
        var newDetails = data.details;
        // if current playlist is a live playlist, arm a timer to reload it
        if (newDetails.live) {
          var reloadInterval = 1000 * (newDetails.averagetargetduration ? newDetails.averagetargetduration : newDetails.targetduration),
              curDetails = curLevel.details;
          if (curDetails && newDetails.endSN === curDetails.endSN) {
            // follow HLS Spec, If the client reloads a Playlist file and finds that it has not
            // changed then it MUST wait for a period of one-half the target
            // duration before retrying.
            reloadInterval /= 2;
            _logger.logger.log('same live playlist, reload twice faster');
          }
          // decrement reloadInterval with level loading delay
          reloadInterval -= performance.now() - data.stats.trequest;
          // in any case, don't reload more than every second
          reloadInterval = Math.max(1000, Math.round(reloadInterval));
          _logger.logger.log('live playlist, reload in ' + reloadInterval + ' ms');
          this.timer = setTimeout(this.ontick, reloadInterval);
        } else {
          this.timer = null;
        }
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
      var levels = this._levels;
      if (levels && levels.length > newLevel) {
        if (this._level !== newLevel || levels[newLevel].details === undefined) {
          this.setLevelInternal(newLevel);
        }
      }
    }
  }, {
    key: 'manualLevel',
    get: function get() {
      return this._manualLevel;
    },
    set: function set(newLevel) {
      this._manualLevel = newLevel;
      if (this._startLevel === undefined) {
        this._startLevel = newLevel;
      }
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
      // hls.startLevel takes precedence over config.startLevel
      // if none of these values are defined, fallback on this._firstLevel (first quality level appearing in variant manifest)
      if (this._startLevel === undefined) {
        var configStartLevel = this.hls.config.startLevel;
        if (configStartLevel !== undefined) {
          return configStartLevel;
        } else {
          return this._firstLevel;
        }
      } else {
        return this._startLevel;
      }
    },
    set: function set(newLevel) {
      // if not in autostart level, ensure startLevel is greater than minAutoLevel
      if (newLevel !== -1) {
        newLevel = Math.max(newLevel, this.hls.abrController.minAutoLevel);
      }
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

},{"26":26,"27":27,"28":28,"30":30,"45":45}],12:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _binarySearch = _dereq_(41);

var _binarySearch2 = _interopRequireDefault(_binarySearch);

var _bufferHelper = _dereq_(30);

var _bufferHelper2 = _interopRequireDefault(_bufferHelper);

var _demuxer = _dereq_(22);

var _demuxer2 = _interopRequireDefault(_demuxer);

var _events = _dereq_(28);

var _events2 = _interopRequireDefault(_events);

var _eventHandler = _dereq_(27);

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _levelHelper = _dereq_(31);

var _levelHelper2 = _interopRequireDefault(_levelHelper);

var _timeRanges = _dereq_(46);

var _timeRanges2 = _interopRequireDefault(_timeRanges);

var _errors = _dereq_(26);

var _logger = _dereq_(45);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Stream Controller
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               */

var State = {
  STOPPED: 'STOPPED',
  IDLE: 'IDLE',
  KEY_LOADING: 'KEY_LOADING',
  FRAG_LOADING: 'FRAG_LOADING',
  FRAG_LOADING_WAITING_RETRY: 'FRAG_LOADING_WAITING_RETRY',
  WAITING_LEVEL: 'WAITING_LEVEL',
  PARSING: 'PARSING',
  PARSED: 'PARSED',
  BUFFER_FLUSHING: 'BUFFER_FLUSHING',
  ENDED: 'ENDED',
  ERROR: 'ERROR'
};

var StreamController = function (_EventHandler) {
  _inherits(StreamController, _EventHandler);

  function StreamController(hls) {
    _classCallCheck(this, StreamController);

    var _this = _possibleConstructorReturn(this, (StreamController.__proto__ || Object.getPrototypeOf(StreamController)).call(this, hls, _events2.default.MEDIA_ATTACHED, _events2.default.MEDIA_DETACHING, _events2.default.MANIFEST_LOADING, _events2.default.MANIFEST_PARSED, _events2.default.LEVEL_LOADED, _events2.default.KEY_LOADED, _events2.default.FRAG_LOADED, _events2.default.FRAG_LOAD_EMERGENCY_ABORTED, _events2.default.FRAG_PARSING_INIT_SEGMENT, _events2.default.FRAG_PARSING_DATA, _events2.default.FRAG_PARSED, _events2.default.ERROR, _events2.default.AUDIO_TRACK_SWITCHING, _events2.default.AUDIO_TRACK_SWITCHED, _events2.default.BUFFER_CREATED, _events2.default.BUFFER_APPENDED, _events2.default.BUFFER_FLUSHED));

    _this.config = hls.config;
    _this.audioCodecSwap = false;
    _this.ticks = 0;
    _this._state = State.STOPPED;
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
    value: function startLoad(startPosition) {
      if (this.levels) {
        var lastCurrentTime = this.lastCurrentTime,
            hls = this.hls;
        this.stopLoad();
        if (!this.timer) {
          this.timer = setInterval(this.ontick, 100);
        }
        this.level = -1;
        this.fragLoadError = 0;
        if (!this.startFragRequested) {
          // determine load level
          var startLevel = hls.startLevel;
          if (startLevel === -1) {
            // -1 : guess start Level by doing a bitrate test by loading first fragment of lowest quality level
            startLevel = 0;
            this.bitrateTest = true;
          }
          // set new level to playlist loader : this will trigger start level load
          // hls.nextLoadLevel remains until it is set to a new value or until a new frag is successfully loaded
          this.level = hls.nextLoadLevel = startLevel;
          this.loadedmetadata = false;
        }
        // if startPosition undefined but lastCurrentTime set, set startPosition to last currentTime
        if (lastCurrentTime > 0 && startPosition === -1) {
          _logger.logger.log('override startPosition with lastCurrentTime @' + lastCurrentTime.toFixed(3));
          startPosition = lastCurrentTime;
        }
        this.state = State.IDLE;
        this.nextLoadPosition = this.startPosition = this.lastCurrentTime = startPosition;
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
      switch (this.state) {
        case State.ERROR:
          //don't do anything in error state to avoid breaking further ...
          break;
        case State.BUFFER_FLUSHING:
          // in buffer flushing state, reset fragLoadError counter
          this.fragLoadError = 0;
          break;
        case State.IDLE:
          // when this returns false there was an error and we shall return immediatly
          // from current tick
          if (!this._doTickIdle()) {
            return;
          }
          break;
        case State.WAITING_LEVEL:
          var level = this.levels[this.level];
          // check if playlist is already loaded
          if (level && level.details) {
            this.state = State.IDLE;
          }
          break;
        case State.FRAG_LOADING_WAITING_RETRY:
          var now = performance.now();
          var retryDate = this.retryDate;
          // if current time is gt than retryDate, or if media seeking let's switch to IDLE state to retry loading
          if (!retryDate || now >= retryDate || this.media && this.media.seeking) {
            _logger.logger.log('mediaController: retryDate reached, switch back to IDLE state');
            this.state = State.IDLE;
          }
          break;
        case State.ERROR:
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

    // Ironically the "idle" state is the on we do the most logic in it seems ....
    // NOTE: Maybe we could rather schedule a check for buffer length after half of the currently
    //       played segment, or on pause/play/seek instead of naively checking every 100ms?

  }, {
    key: '_doTickIdle',
    value: function _doTickIdle() {
      var hls = this.hls,
          config = hls.config,
          media = this.media;

      // if video not attached AND
      // start fragment already requested OR start frag prefetch disable
      // exit loop
      // => if start level loaded and media not attached but start frag prefetch is enabled and start frag not requested yet, we will not exit loop
      if (this.levelLastLoaded !== undefined && !media && (this.startFragRequested || !config.startFragPrefetch)) {
        return true;
      }

      // if we have not yet loaded any fragment, start loading from start position
      var pos = void 0;
      if (this.loadedmetadata) {
        pos = media.currentTime;
      } else {
        pos = this.nextLoadPosition;
      }
      // determine next load level
      var level = hls.nextLoadLevel,
          levelInfo = this.levels[level],
          levelBitrate = levelInfo.bitrate,
          maxBufLen = void 0;

      // compute max Buffer Length that we could get from this load level, based on level bitrate. don't buffer more than 60 MB and more than 30s
      if (levelBitrate) {
        maxBufLen = Math.max(8 * config.maxBufferSize / levelBitrate, config.maxBufferLength);
      } else {
        maxBufLen = config.maxBufferLength;
      }
      maxBufLen = Math.min(maxBufLen, config.maxMaxBufferLength);

      // determine next candidate fragment to be loaded, based on current position and end of buffer position
      // ensure up to `config.maxMaxBufferLength` of buffer upfront

      var bufferInfo = _bufferHelper2.default.bufferInfo(this.mediaBuffer ? this.mediaBuffer : media, pos, config.maxBufferHole),
          bufferLen = bufferInfo.len;
      // Stay idle if we are still with buffer margins
      if (bufferLen >= maxBufLen) {
        return true;
      }

      // if buffer length is less than maxBufLen try to load a new fragment ...
      _logger.logger.trace('buffer length of ' + bufferLen.toFixed(3) + ' is below max of ' + maxBufLen.toFixed(3) + '. checking for more payload ...');

      // set next load level : this will trigger a playlist load if needed
      this.level = hls.nextLoadLevel = level;

      var levelDetails = levelInfo.details;
      // if level info not retrieved yet, switch state and wait for level retrieval
      // if live playlist, ensure that new playlist has been refreshed to avoid loading/try to load
      // a useless and outdated fragment (that might even introduce load error if it is already out of the live playlist)
      if (typeof levelDetails === 'undefined' || levelDetails.live && this.levelLastLoaded !== level) {
        this.state = State.WAITING_LEVEL;
        return true;
      }

      // we just got done loading the final fragment, check if we need to finalize media stream
      var fragPrevious = this.fragPrevious;
      if (!levelDetails.live && fragPrevious && fragPrevious.sn === levelDetails.endSN) {
        // if everything (almost) til the end is buffered, let's signal eos
        // we don't compare exactly media.duration === bufferInfo.end as there could be some subtle media duration difference
        // using half frag duration should help cope with these cases.
        // also cope with almost zero last frag duration (max last frag duration with 200ms) refer to https://github.com/dailymotion/hls.js/pull/657
        if (media.duration - Math.max(bufferInfo.end, fragPrevious.start) <= Math.max(0.2, fragPrevious.duration / 2)) {
          // Finalize the media stream
          var data = {};
          if (this.altAudio) {
            data.type = 'video';
          }
          this.hls.trigger(_events2.default.BUFFER_EOS, data);
          this.state = State.ENDED;
          return true;
        }
      }

      // if we have the levelDetails for the selected variant, lets continue enrichen our stream (load keys/fragments or trigger EOS, etc..)
      return this._fetchPayloadOrEos(pos, bufferInfo, levelDetails);
    }
  }, {
    key: '_fetchPayloadOrEos',
    value: function _fetchPayloadOrEos(pos, bufferInfo, levelDetails) {
      var fragPrevious = this.fragPrevious,
          level = this.level,
          fragments = levelDetails.fragments,
          fragLen = fragments.length;

      // empty playlist
      if (fragLen === 0) {
        return false;
      }

      // find fragment index, contiguous with end of buffer position
      var start = fragments[0].start,
          end = fragments[fragLen - 1].start + fragments[fragLen - 1].duration,
          bufferEnd = bufferInfo.end,
          frag = void 0;

      // in case of live playlist we need to ensure that requested position is not located before playlist start
      if (levelDetails.live) {
        var initialLiveManifestSize = this.config.initialLiveManifestSize;
        if (fragLen < initialLiveManifestSize) {
          _logger.logger.warn('Can not start playback of a level, reason: not enough fragments ' + fragLen + ' < ' + initialLiveManifestSize);
          return false;
        }

        frag = this._ensureFragmentAtLivePoint(levelDetails, bufferEnd, start, end, fragPrevious, fragments, fragLen);
        // if it explicitely returns null don't load any fragment and exit function now
        if (frag === null) {
          return false;
        }
      } else {
        // VoD playlist: if bufferEnd before start of playlist, load first fragment
        if (bufferEnd < start) {
          frag = fragments[0];
        }
      }
      if (!frag) {
        frag = this._findFragment(start, fragPrevious, fragLen, fragments, bufferEnd, end, levelDetails);
      }
      if (frag) {
        return this._loadFragmentOrKey(frag, level, levelDetails, pos, bufferEnd);
      }
      return true;
    }
  }, {
    key: '_ensureFragmentAtLivePoint',
    value: function _ensureFragmentAtLivePoint(levelDetails, bufferEnd, start, end, fragPrevious, fragments, fragLen) {
      var config = this.hls.config,
          media = this.media;

      var frag = void 0;

      // check if requested position is within seekable boundaries :
      //logger.log(`start/pos/bufEnd/seeking:${start.toFixed(3)}/${pos.toFixed(3)}/${bufferEnd.toFixed(3)}/${this.media.seeking}`);
      var maxLatency = config.liveMaxLatencyDuration !== undefined ? config.liveMaxLatencyDuration : config.liveMaxLatencyDurationCount * levelDetails.targetduration;

      if (bufferEnd < Math.max(start - config.maxFragLookUpTolerance, end - maxLatency)) {
        var liveSyncPosition = this.liveSyncPosition = this.computeLivePosition(start, levelDetails);
        _logger.logger.log('buffer end: ' + bufferEnd.toFixed(3) + ' is located too far from the end of live sliding playlist, reset currentTime to : ' + liveSyncPosition.toFixed(3));
        bufferEnd = liveSyncPosition;
        if (media && media.readyState && media.duration > liveSyncPosition) {
          media.currentTime = liveSyncPosition;
        }
      }

      // if end of buffer greater than live edge, don't load any fragment
      // this could happen if live playlist intermittently slides in the past.
      // level 1 loaded [182580161,182580167]
      // level 1 loaded [182580162,182580169]
      // Loading 182580168 of [182580162 ,182580169],level 1 ..
      // Loading 182580169 of [182580162 ,182580169],level 1 ..
      // level 1 loaded [182580162,182580168] <============= here we should have bufferEnd > end. in that case break to avoid reloading 182580168
      // level 1 loaded [182580164,182580171]
      //
      // don't return null in case media not loaded yet (readystate === 0)
      if (levelDetails.PTSKnown && bufferEnd > end && media && media.readyState) {
        return null;
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
      return frag;
    }
  }, {
    key: '_findFragment',
    value: function _findFragment(start, fragPrevious, fragLen, fragments, bufferEnd, end, levelDetails) {
      var config = this.hls.config;

      var frag = void 0,
          foundFrag = void 0,
          maxFragLookUpTolerance = config.maxFragLookUpTolerance;

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
          //logger.log(`level/sn/start/end/bufEnd:${level}/${candidate.sn}/${candidate.start}/${(candidate.start+candidate.duration)}/${bufferEnd}`);
          if (candidate.start + candidate.duration - maxFragLookUpTolerance <= bufferEnd) {
            return 1;
          } // if maxFragLookUpTolerance will have negative value then don't return -1 for first element
          else if (candidate.start - maxFragLookUpTolerance > bufferEnd && candidate.start) {
              return -1;
            }
          return 0;
        });
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
            var deltaPTS = fragPrevious.deltaPTS,
                curSNIdx = frag.sn - levelDetails.startSN;
            // if there is a significant delta between audio and video, larger than max allowed hole,
            // and if previous remuxed fragment did not start with a keyframe. (fragPrevious.dropped)
            // let's try to load previous fragment again to get last keyframe
            // then we will reload again current fragment (that way we should be able to fill the buffer hole ...)
            if (deltaPTS && deltaPTS > config.maxBufferHole && fragPrevious.dropped && curSNIdx) {
              frag = fragments[curSNIdx - 1];
              _logger.logger.warn('SN just loaded, with large PTS gap between audio and video, maybe frag is not starting with a keyframe ? load previous one to try to overcome this');
              // decrement previous frag load counter to avoid frag loop loading error when next fragment will get reloaded
              fragPrevious.loadCounter--;
            } else {
              frag = fragments[curSNIdx + 1];
              _logger.logger.log('SN just loaded, load next one: ' + frag.sn);
            }
          } else {
            frag = null;
          }
        }
      }
      return frag;
    }
  }, {
    key: '_loadFragmentOrKey',
    value: function _loadFragmentOrKey(frag, level, levelDetails, pos, bufferEnd) {
      var hls = this.hls,
          config = hls.config;

      //logger.log('loading frag ' + i +',pos/bufEnd:' + pos.toFixed(3) + '/' + bufferEnd.toFixed(3));
      if (frag.decryptdata.uri != null && frag.decryptdata.key == null) {
        _logger.logger.log('Loading key for ' + frag.sn + ' of [' + levelDetails.startSN + ' ,' + levelDetails.endSN + '],level ' + level);
        this.state = State.KEY_LOADING;
        hls.trigger(_events2.default.KEY_LOADING, { frag: frag });
      } else {
        _logger.logger.log('Loading ' + frag.sn + ' of [' + levelDetails.startSN + ' ,' + levelDetails.endSN + '],level ' + level + ', currentTime:' + pos.toFixed(3) + ',bufferEnd:' + bufferEnd.toFixed(3));
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
            return false;
          }
        } else {
          frag.loadCounter = 1;
        }
        frag.loadIdx = this.fragLoadIdx;
        this.fragCurrent = frag;
        this.startFragRequested = true;
        this.nextLoadPosition = frag.start + frag.duration;
        frag.autoLevel = hls.autoLevelEnabled;
        frag.bitrateTest = this.bitrateTest;
        hls.trigger(_events2.default.FRAG_LOADING, { frag: frag });
        // lazy demuxer init, as this could take some time ... do it during frag loading
        if (!this.demuxer) {
          this.demuxer = new _demuxer2.default(hls, 'main');
        }
        this.state = State.FRAG_LOADING;
        return true;
      }
    }
  }, {
    key: 'getBufferRange',
    value: function getBufferRange(position) {
      return _binarySearch2.default.search(this.bufferRange, function (range) {
        if (position < range.start) {
          return -1;
        } else if (position > range.end) {
          return 1;
        }
        return 0;
      });
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
    key: '_checkFragmentChanged',
    value: function _checkFragmentChanged() {
      var rangeCurrent,
          currentTime,
          video = this.media;
      if (video && video.readyState && video.seeking === false) {
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
        if (_bufferHelper2.default.isBuffered(video, currentTime)) {
          rangeCurrent = this.getBufferRange(currentTime);
        } else if (_bufferHelper2.default.isBuffered(video, currentTime + 0.1)) {
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
        var media = this.media,
            previouslyPaused = void 0;
        if (media) {
          previouslyPaused = media.paused;
          media.pause();
        } else {
          // don't restart playback after instant level switch in case media not attached
          previouslyPaused = true;
        }
        this.previouslyPaused = previouslyPaused;
      }
      var fragCurrent = this.fragCurrent;
      if (fragCurrent && fragCurrent.loader) {
        fragCurrent.loader.abort();
      }
      this.fragCurrent = null;
      // increase fragment load Index to avoid frag loop loading error after buffer flush
      this.fragLoadIdx += 2 * this.config.fragLoadingLoopThreshold;
      // flush everything
      this.flushMainBuffer(0, Number.POSITIVE_INFINITY);
    }

    /*
       on immediate level switch end, after new fragment has been buffered :
        - nudge video decoder by slightly adjusting video currentTime (if currentTime buffered)
        - resume the playback if needed
    */

  }, {
    key: 'immediateLevelSwitchEnd',
    value: function immediateLevelSwitchEnd() {
      var media = this.media;
      if (media && media.buffered.length) {
        this.immediateSwitch = false;
        if (_bufferHelper2.default.isBuffered(media, media.currentTime)) {
          // only nudge if currentTime is buffered
          media.currentTime -= 0.0001;
        }
        if (!this.previouslyPaused) {
          media.play();
        }
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
      var media = this.media;
      // ensure that media is defined and that metadata are available (to retrieve currentTime)
      if (media && media.readyState) {
        var fetchdelay = void 0,
            currentRange = void 0,
            nextRange = void 0;
        // increase fragment load Index to avoid frag loop loading error after buffer flush
        this.fragLoadIdx += 2 * this.config.fragLoadingLoopThreshold;
        currentRange = this.getBufferRange(media.currentTime);
        if (currentRange && currentRange.start > 1) {
          // flush buffer preceding current fragment (flush until current fragment start offset)
          // minus 1s to avoid video freezing, that could happen if we flush keyframe of current video ...
          this.flushMainBuffer(0, currentRange.start - 1);
        }
        if (!media.paused) {
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
        nextRange = this.getBufferRange(media.currentTime + fetchdelay);
        if (nextRange) {
          // we can flush buffer range following this one without stalling playback
          nextRange = this.followingBufferRange(nextRange);
          if (nextRange) {
            // if we are here, we can also cancel any loading/demuxing in progress, as they are useless
            var fragCurrent = this.fragCurrent;
            if (fragCurrent && fragCurrent.loader) {
              fragCurrent.loader.abort();
            }
            this.fragCurrent = null;
            // flush position is the start position of this new buffer
            this.flushMainBuffer(nextRange.start, Number.POSITIVE_INFINITY);
          }
        }
      }
    }
  }, {
    key: 'flushMainBuffer',
    value: function flushMainBuffer(startOffset, endOffset) {
      this.state = State.BUFFER_FLUSHING;
      var flushScope = { startOffset: startOffset, endOffset: endOffset };
      // if alternate audio tracks are used, only flush video, otherwise flush everything
      if (this.altAudio) {
        flushScope.type = 'video';
      }
      this.hls.trigger(_events2.default.BUFFER_FLUSHING, flushScope);
    }
  }, {
    key: 'onMediaAttached',
    value: function onMediaAttached(data) {
      var media = this.media = this.mediaBuffer = data.media;
      this.onvseeking = this.onMediaSeeking.bind(this);
      this.onvseeked = this.onMediaSeeked.bind(this);
      this.onvended = this.onMediaEnded.bind(this);
      media.addEventListener('seeking', this.onvseeking);
      media.addEventListener('seeked', this.onvseeked);
      media.addEventListener('ended', this.onvended);
      var config = this.config;
      if (this.levels && config.autoStartLoad) {
        this.hls.startLoad(config.startPosition);
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
      this.media = this.mediaBuffer = null;
      this.loadedmetadata = false;
      this.stopLoad();
    }
  }, {
    key: 'onMediaSeeking',
    value: function onMediaSeeking() {
      var media = this.media,
          currentTime = media ? media.currentTime : undefined,
          config = this.config;
      _logger.logger.log('media seeking to ' + currentTime.toFixed(3));
      if (this.state === State.FRAG_LOADING) {
        var mediaBuffer = this.mediaBuffer ? this.mediaBuffer : media;
        var bufferInfo = _bufferHelper2.default.bufferInfo(mediaBuffer, currentTime, this.config.maxBufferHole),
            fragCurrent = this.fragCurrent;
        // check if we are seeking to a unbuffered area AND if frag loading is in progress
        if (bufferInfo.len === 0 && fragCurrent) {
          var tolerance = config.maxFragLookUpTolerance,
              fragStartOffset = fragCurrent.start - tolerance,
              fragEndOffset = fragCurrent.start + fragCurrent.duration + tolerance;
          // check if we seek position will be out of currently loaded frag range : if out cancel frag load, if in, don't do anything
          if (currentTime < fragStartOffset || currentTime > fragEndOffset) {
            if (fragCurrent.loader) {
              _logger.logger.log('seeking outside of buffer while fragment load in progress, cancel fragment load');
              fragCurrent.loader.abort();
            }
            this.fragCurrent = null;
            this.fragPrevious = null;
            // switch to IDLE state to load new fragment
            this.state = State.IDLE;
          } else {
            _logger.logger.log('seeking outside of buffer but within currently loaded fragment range');
          }
        }
      } else if (this.state === State.ENDED) {
        // switch to IDLE state to check for potential new fragment
        this.state = State.IDLE;
      }
      if (media) {
        this.lastCurrentTime = currentTime;
      }
      // avoid reporting fragment loop loading error in case user is seeking several times on same position
      if (this.state !== State.FRAG_LOADING && this.fragLoadIdx !== undefined) {
        this.fragLoadIdx += 2 * config.fragLoadingLoopThreshold;
      }
      // in case seeking occurs although no media buffered, adjust startPosition and nextLoadPosition to seek target
      if (!this.loadedmetadata) {
        this.nextLoadPosition = this.startPosition = currentTime;
      }
      // tick to speed up processing
      this.tick();
    }
  }, {
    key: 'onMediaSeeked',
    value: function onMediaSeeked() {
      _logger.logger.log('media seeked to ' + this.media.currentTime.toFixed(3));
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
      this.startPosition = this.lastCurrentTime = 0;
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
      var config = this.config;
      if (config.autoStartLoad) {
        this.hls.startLoad(config.startPosition);
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
        if (curDetails && newDetails.fragments.length > 0) {
          // we already have details for that level, merge them
          _levelHelper2.default.mergeDetails(curDetails, newDetails);
          sliding = newDetails.fragments[0].start;
          this.liveSyncPosition = this.computeLivePosition(sliding, curDetails);
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

      if (this.startFragRequested === false) {
        // compute start position if set to -1. use it straight away if value is defined
        if (this.startPosition === -1 || this.lastCurrentTime === -1) {
          // first, check if start time offset has been set in playlist, if yes, use this value
          var startTimeOffset = newDetails.startTimeOffset;
          if (!isNaN(startTimeOffset)) {
            if (startTimeOffset < 0) {
              _logger.logger.log('negative start time offset ' + startTimeOffset + ', count from end of last fragment');
              startTimeOffset = sliding + duration + startTimeOffset;
            }
            _logger.logger.log('start time offset found in playlist, adjust startPosition to ' + startTimeOffset);
            this.startPosition = startTimeOffset;
          } else {
            // if live playlist, set start position to be fragment N-this.config.liveSyncDurationCount (usually 3)
            if (newDetails.live) {
              this.startPosition = this.computeLivePosition(sliding, newDetails);
              _logger.logger.log('configure startPosition to ' + this.startPosition);
            } else {
              this.startPosition = 0;
            }
          }
          this.lastCurrentTime = this.startPosition;
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
      var fragCurrent = this.fragCurrent,
          fragLoaded = data.frag;
      if (this.state === State.FRAG_LOADING && fragCurrent && fragLoaded.type === 'main' && fragLoaded.level === fragCurrent.level && fragLoaded.sn === fragCurrent.sn) {
        var stats = data.stats,
            currentLevel = this.levels[fragCurrent.level],
            details = currentLevel.details;
        _logger.logger.log('Loaded  ' + fragCurrent.sn + ' of [' + details.startSN + ' ,' + details.endSN + '],level ' + fragCurrent.level);
        // reset frag bitrate test in any case after frag loaded event
        this.bitrateTest = false;
        // if this frag was loaded to perform a bitrate test AND if hls.nextLoadLevel is greater than 0
        // then this means that we should be able to load a fragment at a higher quality level
        if (fragLoaded.bitrateTest === true && this.hls.nextLoadLevel) {
          // switch back to IDLE state ... we just loaded a fragment to determine adequate start bitrate and initialize autoswitch algo
          this.state = State.IDLE;
          this.startFragRequested = false;
          stats.tparsed = stats.tbuffered = performance.now();
          this.hls.trigger(_events2.default.FRAG_BUFFERED, { stats: stats, frag: fragCurrent, id: 'main' });
          this.tick();
        } else {
          this.state = State.PARSING;
          // transmux the MPEG-TS data to ISO-BMFF segments
          this.stats = stats;
          var duration = details.totalduration,
              start = !isNaN(fragCurrent.startDTS) ? fragCurrent.startDTS : fragCurrent.start,
              level = fragCurrent.level,
              sn = fragCurrent.sn,
              audioCodec = this.config.defaultAudioCodec || currentLevel.audioCodec;
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
          this.pendingBuffering = true;
          this.appended = false;
          _logger.logger.log('Parsing ' + sn + ' of [' + details.startSN + ' ,' + details.endSN + '],level ' + level + ', cc ' + fragCurrent.cc);
          var demuxer = this.demuxer;
          if (!demuxer) {
            demuxer = this.demuxer = new _demuxer2.default(this.hls, 'main');
          }
          // time Offset is accurate if level PTS is known, or if playlist is not sliding (not live) and if media is not seeking (this is to overcome potential timestamp drifts between playlists and fragments)
          var media = this.media;
          var mediaSeeking = media && media.seeking;
          var accurateTimeOffset = !mediaSeeking && (details.PTSKnown || !details.live);
          demuxer.push(data.payload, audioCodec, currentLevel.videoCodec, start, fragCurrent.cc, level, sn, duration, fragCurrent.decryptdata, accurateTimeOffset, null);
        }
      }
      this.fragLoadError = 0;
    }
  }, {
    key: 'onFragParsingInitSegment',
    value: function onFragParsingInitSegment(data) {
      var fragCurrent = this.fragCurrent;
      if (fragCurrent && data.id === 'main' && data.sn === fragCurrent.sn && data.level === fragCurrent.level && this.state === State.PARSING) {
        var tracks = data.tracks,
            trackName,
            track;

        // if audio track is expected to come from audio stream controller, discard any coming from main
        if (tracks.audio && this.altAudio) {
          delete tracks.audio;
        }
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
          if (ua.indexOf('android') !== -1 && track.container !== 'audio/mpeg') {
            // Exclude mpeg audio
            audioCodec = 'mp4a.40.2';
            _logger.logger.log('Android: force audio codec to ' + audioCodec);
          }
          track.levelCodec = audioCodec;
          track.id = data.id;
        }
        track = tracks.video;
        if (track) {
          track.levelCodec = this.levels[this.level].videoCodec;
          track.id = data.id;
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
          _logger.logger.log('main track:' + trackName + ',container:' + track.container + ',codecs[level/parsed]=[' + track.levelCodec + '/' + track.codec + ']');
          var initSegment = track.initSegment;
          if (initSegment) {
            this.appended = true;
            // arm pending Buffering flag before appending a segment
            this.pendingBuffering = true;
            this.hls.trigger(_events2.default.BUFFER_APPENDING, { type: trackName, data: initSegment, parent: 'main', content: 'initSegment' });
          }
        }
        //trigger handler right now
        this.tick();
      }
    }
  }, {
    key: 'onFragParsingData',
    value: function onFragParsingData(data) {
      var _this2 = this;

      var fragCurrent = this.fragCurrent;
      if (fragCurrent && data.id === 'main' && data.sn === fragCurrent.sn && data.level === fragCurrent.level && !(data.type === 'audio' && this.altAudio) && // filter out main audio if audio track is loaded through audio stream controller
      this.state === State.PARSING) {
        var level = this.levels[this.level],
            frag = this.fragCurrent;

        _logger.logger.log('Parsed ' + data.type + ',PTS:[' + data.startPTS.toFixed(3) + ',' + data.endPTS.toFixed(3) + '],DTS:[' + data.startDTS.toFixed(3) + '/' + data.endDTS.toFixed(3) + '],nb:' + data.nb + ',dropped:' + (data.dropped || 0));

        var drift = _levelHelper2.default.updateFragPTSDTS(level.details, frag.sn, data.startPTS, data.endPTS, data.startDTS, data.endDTS),
            hls = this.hls;
        hls.trigger(_events2.default.LEVEL_PTS_UPDATED, { details: level.details, level: this.level, drift: drift, type: data.type, start: data.startPTS, end: data.endPTS });

        // has remuxer dropped video frames located before first keyframe ?
        if (data.type === 'video') {
          frag.dropped = data.dropped;
        }

        [data.data1, data.data2].forEach(function (buffer) {
          if (buffer) {
            _this2.appended = true;
            // arm pending Buffering flag before appending a segment
            _this2.pendingBuffering = true;
            hls.trigger(_events2.default.BUFFER_APPENDING, { type: data.type, data: buffer, parent: 'main', content: 'data' });
          }
        });
        //trigger handler right now
        this.tick();
      }
    }
  }, {
    key: 'onFragParsed',
    value: function onFragParsed(data) {
      var fragCurrent = this.fragCurrent;
      if (fragCurrent && data.id === 'main' && data.sn === fragCurrent.sn && data.level === fragCurrent.level && this.state === State.PARSING) {
        this.stats.tparsed = performance.now();
        this.state = State.PARSED;
        this._checkAppendedParsed();
      }
    }
  }, {
    key: 'onAudioTrackSwitching',
    value: function onAudioTrackSwitching(data) {
      // if any URL found on new audio track, it is an alternate audio track
      var altAudio = !!data.url,
          trackId = data.id;
      // if we switch on main audio, ensure that main fragment scheduling is synced with media.buffered
      // don't do anything if we switch to alt audio: audio stream controller is handling it.
      // we will just have to change buffer scheduling on audioTrackSwitched
      if (!altAudio) {
        if (this.mediaBuffer !== this.media) {
          _logger.logger.log('switching on main audio, use media.buffered to schedule main fragment loading');
          this.mediaBuffer = this.media;
          var fragCurrent = this.fragCurrent;
          // we need to refill audio buffer from main: cancel any frag loading to speed up audio switch
          if (fragCurrent.loader) {
            _logger.logger.log('switching to main audio track, cancel main fragment load');
            fragCurrent.loader.abort();
          }
          this.fragCurrent = null;
          this.fragPrevious = null;
          // destroy demuxer to force init segment generation (following audio switch)
          if (this.demuxer) {
            this.demuxer.destroy();
            this.demuxer = null;
          }
          // switch to IDLE state to load new fragment
          this.state = State.IDLE;
        }
        var hls = this.hls;
        // switching to main audio, flush all audio and trigger track switched
        hls.trigger(_events2.default.BUFFER_FLUSHING, { startOffset: 0, endOffset: Number.POSITIVE_INFINITY, type: 'audio' });
        hls.trigger(_events2.default.AUDIO_TRACK_SWITCHED, { id: trackId });
        this.altAudio = false;
      }
    }
  }, {
    key: 'onAudioTrackSwitched',
    value: function onAudioTrackSwitched(data) {
      var trackId = data.id,
          altAudio = !!this.hls.audioTracks[trackId].url;
      if (altAudio) {
        var videoBuffer = this.videoBuffer;
        // if we switched on alternate audio, ensure that main fragment scheduling is synced with video sourcebuffer buffered
        if (videoBuffer && this.mediaBuffer !== videoBuffer) {
          _logger.logger.log('switching on alternate audio, use video.buffered to schedule main fragment loading');
          this.mediaBuffer = videoBuffer;
        }
      }
      this.altAudio = altAudio;
      this.tick();
    }
  }, {
    key: 'onBufferCreated',
    value: function onBufferCreated(data) {
      var tracks = data.tracks,
          mediaTrack = void 0,
          name = void 0,
          alternate = false;
      for (var type in tracks) {
        var track = tracks[type];
        if (track.id === 'main') {
          name = type;
          mediaTrack = track;
          // keep video source buffer reference
          if (type === 'video') {
            this.videoBuffer = tracks[type].buffer;
          }
        } else {
          alternate = true;
        }
      }
      if (alternate && mediaTrack) {
        _logger.logger.log('alternate track found, use ' + name + '.buffered to schedule main fragment loading');
        this.mediaBuffer = mediaTrack.buffer;
      } else {
        this.mediaBuffer = this.media;
      }
    }
  }, {
    key: 'onBufferAppended',
    value: function onBufferAppended(data) {
      if (data.parent === 'main') {
        var state = this.state;
        if (state === State.PARSING || state === State.PARSED) {
          // check if all buffers have been appended
          this.pendingBuffering = data.pending > 0;
          this._checkAppendedParsed();
        }
      }
    }
  }, {
    key: '_checkAppendedParsed',
    value: function _checkAppendedParsed() {
      var _this3 = this;

      //trigger handler right now
      if (this.state === State.PARSED && (!this.appended || !this.pendingBuffering)) {
        var frag = this.fragCurrent;
        if (frag) {
          (function () {
            var media = _this3.mediaBuffer ? _this3.mediaBuffer : _this3.media;
            _logger.logger.log('main buffered : ' + _timeRanges2.default.toString(media.buffered));
            // filter potentially evicted bufferRange. this is to avoid memleak on live streams
            var bufferRange = _this3.bufferRange.filter(function (range) {
              return _bufferHelper2.default.isBuffered(media, (range.start + range.end) / 2);
            });
            // push new range
            bufferRange.push({ type: frag.type, start: frag.startPTS, end: frag.endPTS, frag: frag });
            // sort, as we use BinarySearch for lookup in getBufferRange ...
            _this3.bufferRange = bufferRange.sort(function (a, b) {
              return a.start - b.start;
            });
            _this3.fragPrevious = frag;
            var stats = _this3.stats;
            stats.tbuffered = performance.now();
            // we should get rid of this.fragLastKbps
            _this3.fragLastKbps = Math.round(8 * stats.total / (stats.tbuffered - stats.tfirst));
            _this3.hls.trigger(_events2.default.FRAG_BUFFERED, { stats: stats, frag: frag, id: 'main' });
            _this3.state = State.IDLE;
          })();
        }
        this.tick();
      }
    }
  }, {
    key: 'onError',
    value: function onError(data) {
      var frag = data.frag || this.fragCurrent;
      // don't handle frag error not related to main fragment
      if (frag && frag.type !== 'main') {
        return;
      }
      var media = this.media,

      // 0.5 : tolerance needed as some browsers stalls playback before reaching buffered end
      mediaBuffered = media && _bufferHelper2.default.isBuffered(media, media.currentTime) && _bufferHelper2.default.isBuffered(media, media.currentTime + 0.5);
      switch (data.details) {
        case _errors.ErrorDetails.FRAG_LOAD_ERROR:
        case _errors.ErrorDetails.FRAG_LOAD_TIMEOUT:
        case _errors.ErrorDetails.KEY_LOAD_ERROR:
        case _errors.ErrorDetails.KEY_LOAD_TIMEOUT:
          if (!data.fatal) {
            var loadError = this.fragLoadError;
            if (loadError) {
              loadError++;
            } else {
              loadError = 1;
            }
            var config = this.config;
            // keep retrying / don't raise fatal network error if current position is buffered or if in automode with current level not 0
            if (loadError <= config.fragLoadingMaxRetry || mediaBuffered || frag.autoLevel && frag.level) {
              this.fragLoadError = loadError;
              // reset load counter to avoid frag loop loading error
              frag.loadCounter = 0;
              // exponential backoff capped to config.fragLoadingMaxRetryTimeout
              var delay = Math.min(Math.pow(2, loadError - 1) * config.fragLoadingRetryDelay, config.fragLoadingMaxRetryTimeout);
              _logger.logger.warn('mediaController: frag loading failed, retry in ' + delay + ' ms');
              this.retryDate = performance.now() + delay;
              // retry loading state
              // if loadedmetadata is not set, it means that we are emergency switch down on first frag
              // in that case, reset startFragRequested flag
              if (!this.loadedmetadata) {
                this.startFragRequested = false;
                this.nextLoadPosition = this.startPosition;
              }
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
          if (!data.fatal) {
            // if buffer is not empty
            if (mediaBuffered) {
              // try to reduce max buffer length : rationale is that we could get
              // frag loop loading error because of buffer eviction
              this._reduceMaxBufferLength(frag.duration);
              this.state = State.IDLE;
            } else {
              // buffer empty. report as fatal if in manual mode or if lowest level.
              // level controller takes care of emergency switch down logic
              if (!frag.autoLevel || frag.level === 0) {
                // redispatch same error but with fatal set to true
                data.fatal = true;
                this.hls.trigger(_events2.default.ERROR, data);
                this.state = State.ERROR;
              }
            }
          }
          break;
        case _errors.ErrorDetails.LEVEL_LOAD_ERROR:
        case _errors.ErrorDetails.LEVEL_LOAD_TIMEOUT:
          if (this.state !== State.ERROR) {
            if (data.fatal) {
              // if fatal error, stop processing
              this.state = State.ERROR;
              _logger.logger.warn('streamController: ' + data.details + ',switch to ' + this.state + ' state ...');
            } else {
              // in cas of non fatal error while waiting level load to be completed, switch back to IDLE
              if (this.state === State.WAITING_LEVEL) {
                this.state = State.IDLE;
              }
            }
          }
          break;
        case _errors.ErrorDetails.BUFFER_FULL_ERROR:
          // if in appending state
          if (this.state === State.PARSING || this.state === State.PARSED) {
            // reduce max buf len if current position is buffered
            if (mediaBuffered) {
              this._reduceMaxBufferLength(frag.duration);
              this.state = State.IDLE;
            } else {
              // current position is not buffered, but browser is still complaining about buffer full error
              // this happens on IE/Edge, refer to https://github.com/dailymotion/hls.js/pull/708
              // in that case flush the whole buffer to recover
              _logger.logger.warn('buffer full error also media.currentTime is not buffered, flush everything');
              this.fragCurrent = null;
              // flush everything
              this.flushMainBuffer(0, Number.POSITIVE_INFINITY);
            }
          }
          break;
        default:
          break;
      }
    }
  }, {
    key: '_reduceMaxBufferLength',
    value: function _reduceMaxBufferLength(minLength) {
      var config = this.config;
      if (config.maxMaxBufferLength >= minLength) {
        // reduce max buffer length as it might be too high. we do this to avoid loop flushing ...
        config.maxMaxBufferLength /= 2;
        _logger.logger.warn('reduce max buffer length to ' + config.maxMaxBufferLength + 's and switch to IDLE state');
        // increase fragment load Index to avoid frag loop loading error after buffer flush
        this.fragLoadIdx += 2 * config.fragLoadingLoopThreshold;
      }
    }
  }, {
    key: '_checkBuffer',
    value: function _checkBuffer() {
      var media = this.media;
      // if ready state different from HAVE_NOTHING (numeric value 0), we are allowed to seek
      if (media && media.readyState) {
        var currentTime = media.currentTime,
            mediaBuffer = this.mediaBuffer ? this.mediaBuffer : media,
            buffered = mediaBuffer.buffered;
        // adjust currentTime to start position on loaded metadata
        if (!this.loadedmetadata && buffered.length && !media.seeking) {
          this.loadedmetadata = true;
          // only adjust currentTime if different from startPosition or if startPosition not buffered
          // at that stage, there should be only one buffered range, as we reach that code after first fragment has been buffered
          var startPosition = this.startPosition,
              startPositionBuffered = _bufferHelper2.default.isBuffered(mediaBuffer, startPosition);
          // if currentTime not matching with expected startPosition or startPosition not buffered
          if (currentTime !== startPosition || !startPositionBuffered) {
            _logger.logger.log('target start position:' + startPosition);
            // if startPosition not buffered, let's seek to buffered.start(0)
            if (!startPositionBuffered) {
              startPosition = buffered.start(0);
              _logger.logger.log('target start position not buffered, seek to buffered.start(0) ' + startPosition);
            }
            _logger.logger.log('adjust currentTime from ' + currentTime + ' to ' + startPosition);
            media.currentTime = startPosition;
          }
        } else if (this.immediateSwitch) {
          this.immediateLevelSwitchEnd();
        } else {
          var bufferInfo = _bufferHelper2.default.bufferInfo(media, currentTime, 0),
              expectedPlaying = !(media.paused || // not playing when media is paused
          media.ended || // not playing when media is ended
          media.buffered.length === 0),
              // not playing if nothing buffered
          jumpThreshold = 0.5,
              // tolerance needed as some browsers stalls playback before reaching buffered range end
          playheadMoving = currentTime !== this.lastCurrentTime,
              config = this.config;

          if (playheadMoving) {
            // played moving, but was previously stalled => now not stuck anymore
            if (this.stallReported) {
              _logger.logger.warn('playback not stuck anymore @' + currentTime + ', after ' + Math.round(performance.now() - this.stalled) + 'ms');
              this.stallReported = false;
            }
            this.stalled = undefined;
            this.nudgeRetry = 0;
          } else {
            // playhead not moving
            if (expectedPlaying) {
              // playhead not moving BUT media expected to play
              var tnow = performance.now();
              var hls = this.hls;
              if (!this.stalled) {
                // stall just detected, store current time
                this.stalled = tnow;
                this.stallReported = false;
              } else {
                // playback already stalled, check stalling duration
                // if stalling for more than a given threshold, let's try to recover
                var stalledDuration = tnow - this.stalled;
                var bufferLen = bufferInfo.len;
                var nudgeRetry = this.nudgeRetry || 0;
                // have we reached stall deadline ?
                if (bufferLen <= jumpThreshold && stalledDuration > config.lowBufferWatchdogPeriod * 1000) {
                  // report stalled error once
                  if (!this.stallReported) {
                    this.stallReported = true;
                    _logger.logger.warn('playback stalling in low buffer @' + currentTime);
                    hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.BUFFER_STALLED_ERROR, fatal: false, buffer: bufferLen });
                  }
                  // if buffer len is below threshold, try to jump to start of next buffer range if close
                  // no buffer available @ currentTime, check if next buffer is close (within a config.maxSeekHole second range)
                  var nextBufferStart = bufferInfo.nextStart,
                      delta = nextBufferStart - currentTime;
                  if (nextBufferStart && delta < config.maxSeekHole && delta > 0) {
                    this.nudgeRetry = ++nudgeRetry;
                    var nudgeOffset = nudgeRetry * config.nudgeOffset;
                    // next buffer is close ! adjust currentTime to nextBufferStart
                    // this will ensure effective video decoding
                    _logger.logger.log('adjust currentTime from ' + media.currentTime + ' to next buffered @ ' + nextBufferStart + ' + nudge ' + nudgeOffset);
                    media.currentTime = nextBufferStart + nudgeOffset;
                    // reset stalled so to rearm watchdog timer
                    this.stalled = undefined;
                    hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.BUFFER_SEEK_OVER_HOLE, fatal: false, hole: nextBufferStart + nudgeOffset - currentTime });
                  }
                } else if (bufferLen > jumpThreshold && stalledDuration > config.highBufferWatchdogPeriod * 1000) {
                  // report stalled error once
                  if (!this.stallReported) {
                    this.stallReported = true;
                    _logger.logger.warn('playback stalling in high buffer @' + currentTime);
                    hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.BUFFER_STALLED_ERROR, fatal: false, buffer: bufferLen });
                  }
                  // reset stalled so to rearm watchdog timer
                  this.stalled = undefined;
                  this.nudgeRetry = ++nudgeRetry;
                  if (nudgeRetry < config.nudgeMaxRetry) {
                    var _currentTime = media.currentTime;
                    var targetTime = _currentTime + nudgeRetry * config.nudgeOffset;
                    _logger.logger.log('adjust currentTime from ' + _currentTime + ' to ' + targetTime);
                    // playback stalled in buffered area ... let's nudge currentTime to try to overcome this
                    media.currentTime = targetTime;
                    hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.BUFFER_NUDGE_ON_STALL, fatal: false });
                  } else {
                    _logger.logger.error('still stuck in high buffer @' + currentTime + ' after ' + config.nudgeMaxRetry + ', raise fatal error');
                    hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.BUFFER_STALLED_ERROR, fatal: true });
                  }
                }
              }
            }
          }
        }
      }
    }
  }, {
    key: 'onFragLoadEmergencyAborted',
    value: function onFragLoadEmergencyAborted() {
      this.state = State.IDLE;
      // if loadedmetadata is not set, it means that we are emergency switch down on first frag
      // in that case, reset startFragRequested flag
      if (!this.loadedmetadata) {
        this.startFragRequested = false;
        this.nextLoadPosition = this.startPosition;
      }
      this.tick();
    }
  }, {
    key: 'onBufferFlushed',
    value: function onBufferFlushed() {
      /* after successful buffer flushing, filter flushed fragments from bufferRange
        use mediaBuffered instead of media (so that we will check against video.buffered ranges in case of alt audio track)
      */
      var media = this.mediaBuffer ? this.mediaBuffer : this.media;
      this.bufferRange = this.bufferRange.filter(function (range) {
        return _bufferHelper2.default.isBuffered(media, (range.start + range.end) / 2);
      });

      // increase fragment load Index to avoid frag loop loading error after buffer flush
      this.fragLoadIdx += 2 * this.config.fragLoadingLoopThreshold;
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
    key: 'computeLivePosition',
    value: function computeLivePosition(sliding, levelDetails) {
      var targetLatency = this.config.liveSyncDuration !== undefined ? this.config.liveSyncDuration : this.config.liveSyncDurationCount * levelDetails.targetduration;
      return sliding + Math.max(0, levelDetails.totalduration - targetLatency);
    }
  }, {
    key: 'state',
    set: function set(nextState) {
      if (this.state !== nextState) {
        var previousState = this.state;
        this._state = nextState;
        _logger.logger.log('main stream:' + previousState + '->' + nextState);
        this.hls.trigger(_events2.default.STREAM_STATE_TRANSITION, { previousState: previousState, nextState: nextState });
      }
    },
    get: function get() {
      return this._state;
    }
  }, {
    key: 'currentLevel',
    get: function get() {
      var media = this.media;
      if (media) {
        var range = this.getBufferRange(media.currentTime);
        if (range) {
          return range.frag.level;
        }
      }
      return -1;
    }
  }, {
    key: 'nextBufferRange',
    get: function get() {
      var media = this.media;
      if (media) {
        // first get end range of current fragment
        return this.followingBufferRange(this.getBufferRange(media.currentTime));
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
  }, {
    key: 'liveSyncPosition',
    get: function get() {
      return this._liveSyncPosition;
    },
    set: function set(value) {
      this._liveSyncPosition = value;
    }
  }]);

  return StreamController;
}(_eventHandler2.default);

exports.default = StreamController;

},{"22":22,"26":26,"27":27,"28":28,"30":30,"31":31,"41":41,"45":45,"46":46}],13:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = _dereq_(28);

var _events2 = _interopRequireDefault(_events);

var _eventHandler = _dereq_(27);

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _cea608Parser = _dereq_(42);

var _cea608Parser2 = _interopRequireDefault(_cea608Parser);

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

    var _this = _possibleConstructorReturn(this, (TimelineController.__proto__ || Object.getPrototypeOf(TimelineController)).call(this, hls, _events2.default.MEDIA_ATTACHING, _events2.default.MEDIA_DETACHING, _events2.default.FRAG_PARSING_USERDATA, _events2.default.MANIFEST_LOADING, _events2.default.FRAG_LOADED, _events2.default.LEVEL_SWITCH));

    _this.hls = hls;
    _this.config = hls.config;
    _this.enabled = true;
    _this.Cues = hls.config.cueHandler;

    if (_this.config.enableCEA708Captions) {
      var self = _this;
      var sendAddTrackEvent = function sendAddTrackEvent(track, media) {
        var e = null;
        try {
          e = new window.Event('addtrack');
        } catch (err) {
          //for IE11
          e = document.createEvent('Event');
          e.initEvent('addtrack', false, false);
        }
        e.track = track;
        media.dispatchEvent(e);
      };

      var channel1 = {
        'newCue': function newCue(startTime, endTime, screen) {
          if (!self.textTrack1) {
            //Enable reuse of existing text track.
            var existingTrack1 = self.getExistingTrack('1');
            if (!existingTrack1) {
              self.textTrack1 = self.createTextTrack('captions', 'English', 'en');
              self.textTrack1.textTrack1 = true;
            } else {
              self.textTrack1 = existingTrack1;
              self.clearCurrentCues(self.textTrack1);

              sendAddTrackEvent(self.textTrack1, self.media);
            }
          }

          self.Cues.newCue(self.textTrack1, startTime, endTime, screen);
        }
      };

      var channel2 = {
        'newCue': function newCue(startTime, endTime, screen) {
          if (!self.textTrack2) {
            //Enable reuse of existing text track.
            var existingTrack2 = self.getExistingTrack('2');
            if (!existingTrack2) {
              self.textTrack2 = self.createTextTrack('captions', 'Spanish', 'es');
              self.textTrack2.textTrack2 = true;
            } else {
              self.textTrack2 = existingTrack2;
              self.clearCurrentCues(self.textTrack2);

              sendAddTrackEvent(self.textTrack2, self.media);
            }
          }

          self.Cues.newCue(self.textTrack2, startTime, endTime, screen);
        }
      };

      _this.cea608Parser = new _cea608Parser2.default(0, channel1, channel2);
    }
    return _this;
  }

  _createClass(TimelineController, [{
    key: 'clearCurrentCues',
    value: function clearCurrentCues(track) {
      if (track && track.cues) {
        while (track.cues.length > 0) {
          track.removeCue(track.cues[0]);
        }
      }
    }
  }, {
    key: 'getExistingTrack',
    value: function getExistingTrack(channelNumber) {
      var media = this.media;
      if (media) {
        for (var i = 0; i < media.textTracks.length; i++) {
          var textTrack = media.textTracks[i];
          var propName = 'textTrack' + channelNumber;
          if (textTrack[propName] === true) {
            return textTrack;
          }
        }
      }
      return null;
    }
  }, {
    key: 'createTextTrack',
    value: function createTextTrack(kind, label, lang) {
      if (this.media) {
        return this.media.addTextTrack(kind, label, lang);
      }
    }
  }, {
    key: 'destroy',
    value: function destroy() {
      _eventHandler2.default.prototype.destroy.call(this);
    }
  }, {
    key: 'onMediaAttaching',
    value: function onMediaAttaching(data) {
      this.media = data.media;
    }
  }, {
    key: 'onMediaDetaching',
    value: function onMediaDetaching() {
      this.clearCurrentCues(this.textTrack1);
      this.clearCurrentCues(this.textTrack2);
    }
  }, {
    key: 'onManifestLoading',
    value: function onManifestLoading() {
      this.lastPts = Number.NEGATIVE_INFINITY;
    }
  }, {
    key: 'onLevelSwitch',
    value: function onLevelSwitch() {
      if (this.hls.currentLevel.closedCaptions === 'NONE') {
        this.enabled = false;
      } else {
        this.enabled = true;
      }
    }
  }, {
    key: 'onFragLoaded',
    value: function onFragLoaded(data) {
      if (data.frag.type === 'main') {
        var pts = data.frag.start; //Number.POSITIVE_INFINITY;
        // if this is a frag for a previously loaded timerange, remove all captions
        // TODO: consider just removing captions for the timerange
        if (pts <= this.lastPts) {
          this.clearCurrentCues(this.textTrack1);
          this.clearCurrentCues(this.textTrack2);
        }
        this.lastPts = pts;
      }
    }
  }, {
    key: 'onFragParsingUserdata',
    value: function onFragParsingUserdata(data) {
      // push all of the CEA-708 messages into the interpreter
      // immediately. It will create the proper timestamps based on our PTS value
      if (this.enabled && this.config.enableCEA708Captions) {
        for (var i = 0; i < data.samples.length; i++) {
          var ccdatas = this.extractCea608Data(data.samples[i].bytes);
          this.cea608Parser.addData(data.samples[i].pts, ccdatas);
        }
      }
    }
  }, {
    key: 'extractCea608Data',
    value: function extractCea608Data(byteArray) {
      var count = byteArray[0] & 31;
      var position = 2;
      var tmpByte, ccbyte1, ccbyte2, ccValid, ccType;
      var actualCCBytes = [];

      for (var j = 0; j < count; j++) {
        tmpByte = byteArray[position++];
        ccbyte1 = 0x7F & byteArray[position++];
        ccbyte2 = 0x7F & byteArray[position++];
        ccValid = (4 & tmpByte) === 0 ? false : true;
        ccType = 3 & tmpByte;

        if (ccbyte1 === 0 && ccbyte2 === 0) {
          continue;
        }

        if (ccValid) {
          if (ccType === 0) // || ccType === 1
            {
              actualCCBytes.push(ccbyte1);
              actualCCBytes.push(ccbyte2);
            }
        }
      }
      return actualCCBytes;
    }
  }]);

  return TimelineController;
}(_eventHandler2.default);

exports.default = TimelineController;

},{"27":27,"28":28,"42":42}],14:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var AESCrypto = function () {
  function AESCrypto(subtle, iv) {
    _classCallCheck(this, AESCrypto);

    this.subtle = subtle;
    this.aesIV = iv;
  }

  _createClass(AESCrypto, [{
    key: 'decrypt',
    value: function decrypt(data, key) {
      return this.subtle.decrypt({ name: 'AES-CBC', iv: this.aesIV }, key, data);
    }
  }]);

  return AESCrypto;
}();

exports.default = AESCrypto;

},{}],15:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var AESDecryptor = function () {
  function AESDecryptor() {
    _classCallCheck(this, AESDecryptor);

    // Static after running initTable
    this.rcon = [0x0, 0x1, 0x2, 0x4, 0x8, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

    this.subMix = [];
    this.subMix[0] = new Uint32Array(256);
    this.subMix[1] = new Uint32Array(256);
    this.subMix[2] = new Uint32Array(256);
    this.subMix[3] = new Uint32Array(256);

    this.invSubMix = [];
    this.invSubMix[0] = new Uint32Array(256);
    this.invSubMix[1] = new Uint32Array(256);
    this.invSubMix[2] = new Uint32Array(256);
    this.invSubMix[3] = new Uint32Array(256);

    this.sBox = new Uint32Array(256);
    this.invSBox = new Uint32Array(256);

    // Changes during runtime
    this.key = new Uint32Array(0);

    this.initTable();
  }

  // Using view.getUint32() also swaps the byte order.


  _createClass(AESDecryptor, [{
    key: 'uint8ArrayToUint32Array_',
    value: function uint8ArrayToUint32Array_(arrayBuffer) {
      var view = new DataView(arrayBuffer);
      var newArray = new Uint32Array(4);
      for (var i = 0; i < newArray.length; i++) {
        newArray[i] = view.getUint32(i * 4);
      }
      return newArray;
    }
  }, {
    key: 'initTable',
    value: function initTable() {
      var sBox = this.sBox;
      var invSBox = this.invSBox;
      var subMix0 = this.subMix[0];
      var subMix1 = this.subMix[1];
      var subMix2 = this.subMix[2];
      var subMix3 = this.subMix[3];
      var invSubMix0 = this.invSubMix[0];
      var invSubMix1 = this.invSubMix[1];
      var invSubMix2 = this.invSubMix[2];
      var invSubMix3 = this.invSubMix[3];

      var d = new Uint32Array(256);
      var x = 0;
      var xi = 0;
      var i = 0;
      for (i = 0; i < 256; i++) {
        if (i < 128) {
          d[i] = i << 1;
        } else {
          d[i] = i << 1 ^ 0x11b;
        }
      }

      for (i = 0; i < 256; i++) {
        var sx = xi ^ xi << 1 ^ xi << 2 ^ xi << 3 ^ xi << 4;
        sx = sx >>> 8 ^ sx & 0xff ^ 0x63;
        sBox[x] = sx;
        invSBox[sx] = x;

        // Compute multiplication
        var x2 = d[x];
        var x4 = d[x2];
        var x8 = d[x4];

        // Compute sub/invSub bytes, mix columns tables
        var t = d[sx] * 0x101 ^ sx * 0x1010100;
        subMix0[x] = t << 24 | t >>> 8;
        subMix1[x] = t << 16 | t >>> 16;
        subMix2[x] = t << 8 | t >>> 24;
        subMix3[x] = t;

        // Compute inv sub bytes, inv mix columns tables
        t = x8 * 0x1010101 ^ x4 * 0x10001 ^ x2 * 0x101 ^ x * 0x1010100;
        invSubMix0[sx] = t << 24 | t >>> 8;
        invSubMix1[sx] = t << 16 | t >>> 16;
        invSubMix2[sx] = t << 8 | t >>> 24;
        invSubMix3[sx] = t;

        // Compute next counter
        if (!x) {
          x = xi = 1;
        } else {
          x = x2 ^ d[d[d[x8 ^ x2]]];
          xi ^= d[d[xi]];
        }
      }
    }
  }, {
    key: 'expandKey',
    value: function expandKey(keyBuffer) {
      // convert keyBuffer to Uint32Array
      var key = this.uint8ArrayToUint32Array_(keyBuffer);
      var sameKey = true;
      var offset = 0;

      while (offset < key.length && sameKey) {
        sameKey = key[offset] === this.key[offset];
        offset++;
      }

      if (sameKey) {
        return;
      }

      this.key = key;
      var keySize = this.keySize = key.length;

      if (keySize !== 4 && keySize !== 6 && keySize !== 8) {
        throw new Error('Invalid aes key size=' + keySize);
      }

      var ksRows = this.ksRows = (keySize + 6 + 1) * 4;
      var ksRow = void 0;
      var invKsRow = void 0;

      var keySchedule = this.keySchedule = new Uint32Array(this.ksRows);
      var invKeySchedule = this.invKeySchedule = new Uint32Array(this.ksRows);
      var sbox = this.sBox;
      var rcon = this.rcon;

      var invSubMix0 = this.invSubMix[0];
      var invSubMix1 = this.invSubMix[1];
      var invSubMix2 = this.invSubMix[2];
      var invSubMix3 = this.invSubMix[3];

      var prev = void 0;
      var t = void 0;

      for (ksRow = 0; ksRow < ksRows; ksRow++) {
        if (ksRow < keySize) {
          prev = keySchedule[ksRow] = key[ksRow];
          continue;
        }
        t = prev;

        if (ksRow % keySize === 0) {
          // Rot word
          t = t << 8 | t >>> 24;

          // Sub word
          t = sbox[t >>> 24] << 24 | sbox[t >>> 16 & 0xff] << 16 | sbox[t >>> 8 & 0xff] << 8 | sbox[t & 0xff];

          // Mix Rcon
          t ^= rcon[ksRow / keySize | 0] << 24;
        } else if (keySize > 6 && ksRow % keySize === 4) {
          // Sub word
          t = sbox[t >>> 24] << 24 | sbox[t >>> 16 & 0xff] << 16 | sbox[t >>> 8 & 0xff] << 8 | sbox[t & 0xff];
        }

        keySchedule[ksRow] = prev = (keySchedule[ksRow - keySize] ^ t) >>> 0;
      }

      for (invKsRow = 0; invKsRow < ksRows; invKsRow++) {
        ksRow = ksRows - invKsRow;
        if (invKsRow & 3) {
          t = keySchedule[ksRow];
        } else {
          t = keySchedule[ksRow - 4];
        }

        if (invKsRow < 4 || ksRow <= 4) {
          invKeySchedule[invKsRow] = t;
        } else {
          invKeySchedule[invKsRow] = invSubMix0[sbox[t >>> 24]] ^ invSubMix1[sbox[t >>> 16 & 0xff]] ^ invSubMix2[sbox[t >>> 8 & 0xff]] ^ invSubMix3[sbox[t & 0xff]];
        }

        invKeySchedule[invKsRow] = invKeySchedule[invKsRow] >>> 0;
      }
    }

    // Adding this as a method greatly improves performance.

  }, {
    key: 'networkToHostOrderSwap',
    value: function networkToHostOrderSwap(word) {
      return word << 24 | (word & 0xff00) << 8 | (word & 0xff0000) >> 8 | word >>> 24;
    }
  }, {
    key: 'decrypt',
    value: function decrypt(inputArrayBuffer, offset, aesIV) {
      var nRounds = this.keySize + 6;
      var invKeySchedule = this.invKeySchedule;
      var invSBOX = this.invSBox;

      var invSubMix0 = this.invSubMix[0];
      var invSubMix1 = this.invSubMix[1];
      var invSubMix2 = this.invSubMix[2];
      var invSubMix3 = this.invSubMix[3];

      var initVector = this.uint8ArrayToUint32Array_(aesIV);
      var initVector0 = initVector[0];
      var initVector1 = initVector[1];
      var initVector2 = initVector[2];
      var initVector3 = initVector[3];

      var inputInt32 = new Int32Array(inputArrayBuffer);
      var outputInt32 = new Int32Array(inputInt32.length);

      var t0 = void 0,
          t1 = void 0,
          t2 = void 0,
          t3 = void 0;
      var s0 = void 0,
          s1 = void 0,
          s2 = void 0,
          s3 = void 0;
      var inputWords0 = void 0,
          inputWords1 = void 0,
          inputWords2 = void 0,
          inputWords3 = void 0;

      var ksRow, i;

      while (offset < inputInt32.length) {
        inputWords0 = this.networkToHostOrderSwap(inputInt32[offset]);
        inputWords1 = this.networkToHostOrderSwap(inputInt32[offset + 1]);
        inputWords2 = this.networkToHostOrderSwap(inputInt32[offset + 2]);
        inputWords3 = this.networkToHostOrderSwap(inputInt32[offset + 3]);

        s0 = inputWords0 ^ invKeySchedule[0];
        s1 = inputWords3 ^ invKeySchedule[1];
        s2 = inputWords2 ^ invKeySchedule[2];
        s3 = inputWords1 ^ invKeySchedule[3];

        ksRow = 4;

        // Iterate through the rounds of decryption
        for (i = 1; i < nRounds; i++) {
          t0 = invSubMix0[s0 >>> 24] ^ invSubMix1[s1 >> 16 & 0xff] ^ invSubMix2[s2 >> 8 & 0xff] ^ invSubMix3[s3 & 0xff] ^ invKeySchedule[ksRow];
          t1 = invSubMix0[s1 >>> 24] ^ invSubMix1[s2 >> 16 & 0xff] ^ invSubMix2[s3 >> 8 & 0xff] ^ invSubMix3[s0 & 0xff] ^ invKeySchedule[ksRow + 1];
          t2 = invSubMix0[s2 >>> 24] ^ invSubMix1[s3 >> 16 & 0xff] ^ invSubMix2[s0 >> 8 & 0xff] ^ invSubMix3[s1 & 0xff] ^ invKeySchedule[ksRow + 2];
          t3 = invSubMix0[s3 >>> 24] ^ invSubMix1[s0 >> 16 & 0xff] ^ invSubMix2[s1 >> 8 & 0xff] ^ invSubMix3[s2 & 0xff] ^ invKeySchedule[ksRow + 3];
          // Update state
          s0 = t0;
          s1 = t1;
          s2 = t2;
          s3 = t3;

          ksRow = ksRow + 4;
        }

        // Shift rows, sub bytes, add round key
        t0 = invSBOX[s0 >>> 24] << 24 ^ invSBOX[s1 >> 16 & 0xff] << 16 ^ invSBOX[s2 >> 8 & 0xff] << 8 ^ invSBOX[s3 & 0xff] ^ invKeySchedule[ksRow];
        t1 = invSBOX[s1 >>> 24] << 24 ^ invSBOX[s2 >> 16 & 0xff] << 16 ^ invSBOX[s3 >> 8 & 0xff] << 8 ^ invSBOX[s0 & 0xff] ^ invKeySchedule[ksRow + 1];
        t2 = invSBOX[s2 >>> 24] << 24 ^ invSBOX[s3 >> 16 & 0xff] << 16 ^ invSBOX[s0 >> 8 & 0xff] << 8 ^ invSBOX[s1 & 0xff] ^ invKeySchedule[ksRow + 2];
        t3 = invSBOX[s3 >>> 24] << 24 ^ invSBOX[s0 >> 16 & 0xff] << 16 ^ invSBOX[s1 >> 8 & 0xff] << 8 ^ invSBOX[s2 & 0xff] ^ invKeySchedule[ksRow + 3];
        ksRow = ksRow + 3;

        // Write
        outputInt32[offset] = this.networkToHostOrderSwap(t0 ^ initVector0);
        outputInt32[offset + 1] = this.networkToHostOrderSwap(t3 ^ initVector1);
        outputInt32[offset + 2] = this.networkToHostOrderSwap(t2 ^ initVector2);
        outputInt32[offset + 3] = this.networkToHostOrderSwap(t1 ^ initVector3);

        // reset initVector to last 4 unsigned int
        initVector0 = inputWords0;
        initVector1 = inputWords1;
        initVector2 = inputWords2;
        initVector3 = inputWords3;

        offset = offset + 4;
      }

      return outputInt32.buffer;
    }
  }, {
    key: 'destroy',
    value: function destroy() {
      this.key = undefined;
      this.keySize = undefined;
      this.ksRows = undefined;

      this.sBox = undefined;
      this.invSBox = undefined;
      this.subMix = undefined;
      this.invSubMix = undefined;
      this.keySchedule = undefined;
      this.invKeySchedule = undefined;

      this.rcon = undefined;
    }
  }]);

  return AESDecryptor;
}();

exports.default = AESDecryptor;

},{}],16:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _aesCrypto = _dereq_(14);

var _aesCrypto2 = _interopRequireDefault(_aesCrypto);

var _fastAesKey = _dereq_(17);

var _fastAesKey2 = _interopRequireDefault(_fastAesKey);

var _aesDecryptor = _dereq_(15);

var _aesDecryptor2 = _interopRequireDefault(_aesDecryptor);

var _errors = _dereq_(26);

var _logger = _dereq_(45);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/*globals self: false */

var Decrypter = function () {
  function Decrypter(observer, config) {
    _classCallCheck(this, Decrypter);

    this.observer = observer;
    this.config = config;
    try {
      var browserCrypto = crypto ? crypto : self.crypto;
      this.subtle = browserCrypto.subtle || browserCrypto.webkitSubtle;
    } catch (e) {}
    this.disableWebCrypto = !this.subtle;
  }

  _createClass(Decrypter, [{
    key: 'decrypt',
    value: function decrypt(data, key, iv, callback) {
      var _this = this;

      if (this.disableWebCrypto && this.config.enableSoftwareAES) {
        _logger.logger.log('JS AES decrypt');
        var decryptor = this.decryptor;
        if (!decryptor) {
          this.decryptor = decryptor = new _aesDecryptor2.default();
        }
        decryptor.expandKey(key);
        callback(decryptor.decrypt(data, 0, iv));
      } else {
        (function () {
          _logger.logger.log('WebCrypto AES decrypt');
          var subtle = _this.subtle;
          if (_this.key !== key) {
            _this.key = key;
            _this.fastAesKey = new _fastAesKey2.default(subtle, key);
          }

          _this.fastAesKey.expandKey().then(function (aesKey) {
            // decrypt using web crypto
            var crypto = new _aesCrypto2.default(subtle, iv);
            crypto.decrypt(data, aesKey).then(function (result) {
              callback(result);
            });
          }).catch(function (err) {
            _this.onWebCryptoError(err, data, key, iv, callback);
          });
        })();
      }
    }
  }, {
    key: 'onWebCryptoError',
    value: function onWebCryptoError(err, data, key, iv, callback) {
      if (this.config.enableSoftwareAES) {
        _logger.logger.log('WebCrypto Error, disable WebCrypto API');
        this.disableWebCrypto = true;
        this.decrypt(data, key, iv, callback);
      } else {
        _logger.logger.error('decrypting error : ' + err.message);
        this.observer.trigger(Event.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.FRAG_DECRYPT_ERROR, fatal: true, reason: err.message });
      }
    }
  }, {
    key: 'destroy',
    value: function destroy() {
      var decryptor = this.decryptor;
      if (decryptor) {
        decryptor.destroy();
        this.decryptor = undefined;
      }
    }
  }]);

  return Decrypter;
}();

exports.default = Decrypter;

},{"14":14,"15":15,"17":17,"26":26,"45":45}],17:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var FastAESKey = function () {
  function FastAESKey(subtle, key) {
    _classCallCheck(this, FastAESKey);

    this.subtle = subtle;
    this.key = key;
  }

  _createClass(FastAESKey, [{
    key: 'expandKey',
    value: function expandKey() {
      return this.subtle.importKey('raw', this.key, { name: 'AES-CBC' }, false, ['encrypt', 'decrypt']);
    }
  }]);

  return FastAESKey;
}();

exports.default = FastAESKey;

},{}],18:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * AAC demuxer
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */


var _adts = _dereq_(19);

var _adts2 = _interopRequireDefault(_adts);

var _logger = _dereq_(45);

var _id = _dereq_(24);

var _id2 = _interopRequireDefault(_id);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var AACDemuxer = function () {
  function AACDemuxer(observer, id, remuxerClass, config, typeSupported) {
    _classCallCheck(this, AACDemuxer);

    this.observer = observer;
    this.id = id;
    this.remuxerClass = remuxerClass;
    this.config = config;
    this.remuxer = new this.remuxerClass(observer, id, config, typeSupported);
    this.insertDiscontinuity();
  }

  _createClass(AACDemuxer, [{
    key: 'insertDiscontinuity',
    value: function insertDiscontinuity() {
      this._aacTrack = { container: 'audio/adts', type: 'audio', id: -1, sequenceNumber: 0, isAAC: true, samples: [], len: 0 };
    }
  }, {
    key: 'push',


    // feed incoming data to the front of the parsing pipeline
    value: function push(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration, accurateTimeOffset, defaultInitPTS) {
      var track,
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

      var contiguous = false;
      if (cc !== this.lastCC) {
        _logger.logger.log(this.id + ' discontinuity detected');
        this.lastCC = cc;
        this.insertDiscontinuity();
        this.remuxer.switchLevel();
        this.remuxer.insertDiscontinuity();
      } else if (level !== this.lastLevel) {
        _logger.logger.log('audio track switch detected');
        this.lastLevel = level;
        this.remuxer.switchLevel();
        this.insertDiscontinuity();
      } else if (sn === this.lastSN + 1) {
        contiguous = true;
      }
      track = this._aacTrack;
      this.lastSN = sn;
      this.lastLevel = level;

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
        track.manifestCodec = config.manifestCodec;
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
      this.remuxer.remux(level, sn, cc, track, { samples: [] }, { samples: [{ pts: pts, dts: pts, unit: id3.payload }] }, { samples: [] }, timeOffset, contiguous, accurateTimeOffset, defaultInitPTS);
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

},{"19":19,"24":24,"45":45}],19:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *  ADTS parser helper
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */


var _logger = _dereq_(45);

var _errors = _dereq_(26);

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
          manifestCodec = audioCodec,
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
      if (/firefox/i.test(userAgent)) {
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
        /*  for other browsers (Chrome/Vivaldi/Opera ...)
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
      return { config: config, samplerate: adtsSampleingRates[adtsSampleingIndex], channelCount: adtsChanelConfig, codec: 'mp4a.40.' + adtsObjectType, manifestCodec: manifestCodec };
    }
  }]);

  return ADTS;
}();

exports.default = ADTS;

},{"26":26,"45":45}],20:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /*  inline demuxer.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *   probe fragments and instantiate appropriate demuxer depending on content type (TSDemuxer, AACDemuxer, ...)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */

var _events = _dereq_(28);

var _events2 = _interopRequireDefault(_events);

var _errors = _dereq_(26);

var _decrypter = _dereq_(16);

var _decrypter2 = _interopRequireDefault(_decrypter);

var _aacdemuxer = _dereq_(18);

var _aacdemuxer2 = _interopRequireDefault(_aacdemuxer);

var _tsdemuxer = _dereq_(25);

var _tsdemuxer2 = _interopRequireDefault(_tsdemuxer);

var _mp4Remuxer = _dereq_(38);

var _mp4Remuxer2 = _interopRequireDefault(_mp4Remuxer);

var _passthroughRemuxer = _dereq_(39);

var _passthroughRemuxer2 = _interopRequireDefault(_passthroughRemuxer);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var DemuxerInline = function () {
  function DemuxerInline(hls, id, typeSupported) {
    var config = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : null;

    _classCallCheck(this, DemuxerInline);

    this.hls = hls;
    this.id = id;
    this.config = this.hls.config || config;
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
    value: function push(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration, decryptdata, accurateTimeOffset, defaultInitPTS) {
      if (data.byteLength > 0 && decryptdata != null && decryptdata.key != null && decryptdata.method === 'AES-128') {
        if (this.decrypter == null) {
          this.decrypter = new _decrypter2.default(this.hls, this.config);
        }
        var localthis = this;
        // performance.now() not available on WebWorker, at least on Safari Desktop
        var startTime;
        try {
          startTime = performance.now();
        } catch (error) {
          startTime = Date.now();
        }
        this.decrypter.decrypt(data, decryptdata.key.buffer, decryptdata.iv.buffer, function (decryptedData) {
          var endTime;
          try {
            endTime = performance.now();
          } catch (error) {
            endTime = Date.now();
          }
          localthis.hls.trigger(_events2.default.FRAG_DECRYPTED, { level: level, sn: sn, stats: { tstart: startTime, tdecrypt: endTime } });
          localthis.pushDecrypted(new Uint8Array(decryptedData), audioCodec, videoCodec, timeOffset, cc, level, sn, duration, accurateTimeOffset, defaultInitPTS);
        });
      } else {
        this.pushDecrypted(new Uint8Array(data), audioCodec, videoCodec, timeOffset, cc, level, sn, duration, accurateTimeOffset, defaultInitPTS);
      }
    }
  }, {
    key: 'pushDecrypted',
    value: function pushDecrypted(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration, accurateTimeOffset, defaultInitPTS) {
      var demuxer = this.demuxer;
      if (!demuxer ||
      // in case of continuity change, we might switch from content type (AAC container to TS container for example)
      // so let's check that current demuxer is still valid
      cc !== this.cc && !demuxer.probe(data)) {
        var hls = this.hls,
            id = this.id,
            config = this.config,
            typeSupported = this.typeSupported;
        // probe for content type
        if (_tsdemuxer2.default.probe(data)) {
          if (this.typeSupported.mp2t === true) {
            demuxer = new _tsdemuxer2.default(hls, id, _passthroughRemuxer2.default, config, typeSupported);
          } else {
            demuxer = new _tsdemuxer2.default(hls, id, _mp4Remuxer2.default, config, typeSupported);
          }
          demuxer.probe = _tsdemuxer2.default.probe;
        } else if (_aacdemuxer2.default.probe(data)) {
          demuxer = new _aacdemuxer2.default(hls, id, _mp4Remuxer2.default, config, typeSupported);
          demuxer.probe = _aacdemuxer2.default.probe;
        } else {
          hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, id: id, details: _errors.ErrorDetails.FRAG_PARSING_ERROR, fatal: true, reason: 'no demux matching with content found' });
          return;
        }
        this.demuxer = demuxer;
      }
      demuxer.push(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration, accurateTimeOffset, defaultInitPTS);
      this.cc = cc;
    }
  }]);

  return DemuxerInline;
}();

exports.default = DemuxerInline;

},{"16":16,"18":18,"25":25,"26":26,"28":28,"38":38,"39":39}],21:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _demuxerInline = _dereq_(20);

var _demuxerInline2 = _interopRequireDefault(_demuxerInline);

var _events = _dereq_(28);

var _events2 = _interopRequireDefault(_events);

var _logger = _dereq_(45);

var _events3 = _dereq_(1);

var _events4 = _interopRequireDefault(_events3);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* demuxer web worker.
 *  - listen to worker message, and trigger DemuxerInline upon reception of Fragments.
 *  - provides MP4 Boxes back to main thread using [transferable objects](https://developers.google.com/web/updates/2011/12/Transferable-Objects-Lightning-Fast) in order to minimize message passing overhead.
 */

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

  var forwardMessage = function forwardMessage(ev, data) {
    self.postMessage({ event: ev, data: data });
  };

  self.addEventListener('message', function (ev) {
    var data = ev.data;
    //console.log('demuxer cmd:' + data.cmd);
    switch (data.cmd) {
      case 'init':
        var config = JSON.parse(data.config);
        self.demuxer = new _demuxerInline2.default(observer, data.id, data.typeSupported, config);
        try {
          (0, _logger.enableLogs)(config.debug === true);
        } catch (err) {
          console.warn('demuxerWorker: unable to enable logs');
        }
        // signal end of worker init
        forwardMessage('init', null);
        break;
      case 'demux':
        self.demuxer.push(data.data, data.audioCodec, data.videoCodec, data.timeOffset, data.cc, data.level, data.sn, data.duration, data.decryptdata, data.accurateTimeOffset, data.defaultInitPTS);
        break;
      default:
        break;
    }
  });

  // forward events to main thread
  observer.on(_events2.default.FRAG_DECRYPTED, forwardMessage);
  observer.on(_events2.default.FRAG_PARSING_INIT_SEGMENT, forwardMessage);
  observer.on(_events2.default.FRAG_PARSED, forwardMessage);
  observer.on(_events2.default.ERROR, forwardMessage);
  observer.on(_events2.default.FRAG_PARSING_METADATA, forwardMessage);
  observer.on(_events2.default.FRAG_PARSING_USERDATA, forwardMessage);
  observer.on(_events2.default.INIT_PTS_FOUND, forwardMessage);

  // special case for FRAG_PARSING_DATA: pass data1/data2 as transferable object (no copy)
  observer.on(_events2.default.FRAG_PARSING_DATA, function (ev, data) {
    var data1 = data.data1.buffer,
        data2 = data.data2.buffer;
    // remove data1 and data2 reference from data to avoid copying them ...
    delete data.data1;
    delete data.data2;
    self.postMessage({ event: ev, data: data, data1: data1, data2: data2 }, [data1, data2]);
  });
};

exports.default = DemuxerWorker;

},{"1":1,"20":20,"28":28,"45":45}],22:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = _dereq_(28);

var _events2 = _interopRequireDefault(_events);

var _demuxerInline = _dereq_(20);

var _demuxerInline2 = _interopRequireDefault(_demuxerInline);

var _demuxerWorker = _dereq_(21);

var _demuxerWorker2 = _interopRequireDefault(_demuxerWorker);

var _logger = _dereq_(45);

var _errors = _dereq_(26);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Demuxer = function () {
  function Demuxer(hls, id) {
    _classCallCheck(this, Demuxer);

    this.hls = hls;
    this.id = id;
    var typeSupported = {
      mp4: MediaSource.isTypeSupported('video/mp4'),
      mp2t: hls.config.enableMP2TPassThrough && MediaSource.isTypeSupported('video/mp2t'),
      mpeg: MediaSource.isTypeSupported('audio/mpeg'),
      mp3: MediaSource.isTypeSupported('audio/mp4; codecs="mp3"')
    };
    if (hls.config.enableWorker && typeof Worker !== 'undefined') {
      _logger.logger.log('demuxing in webworker');
      var w = void 0;
      try {
        var work = _dereq_(3);
        w = this.w = work(_demuxerWorker2.default);
        this.onwmsg = this.onWorkerMessage.bind(this);
        w.addEventListener('message', this.onwmsg);
        w.onerror = function (event) {
          hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.OTHER_ERROR, details: _errors.ErrorDetails.INTERNAL_EXCEPTION, fatal: true, event: 'demuxerWorker', err: { message: event.message + ' (' + event.filename + ':' + event.lineno + ')' } });
        };
        w.postMessage({ cmd: 'init', typeSupported: typeSupported, id: id, config: JSON.stringify(hls.config) });
      } catch (err) {
        _logger.logger.error('error while initializing DemuxerWorker, fallback on DemuxerInline');
        if (w) {
          // revoke the Object URL that was used to create demuxer worker, so as not to leak it
          URL.revokeObjectURL(w.objectURL);
        }
        this.demuxer = new _demuxerInline2.default(hls, id, typeSupported);
        this.w = undefined;
      }
    } else {
      this.demuxer = new _demuxerInline2.default(hls, id, typeSupported);
    }
    this.demuxInitialized = true;
  }

  _createClass(Demuxer, [{
    key: 'destroy',
    value: function destroy() {
      var w = this.w;
      if (w) {
        w.removeEventListener('message', this.onwmsg);
        w.terminate();
        this.w = null;
      } else {
        var demuxer = this.demuxer;
        if (demuxer) {
          demuxer.destroy();
          this.demuxer = null;
        }
      }
    }
  }, {
    key: 'push',
    value: function push(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration, decryptdata, accurateTimeOffset, defaultInitPTS) {
      var w = this.w;
      if (w) {
        // post fragment payload as transferable objects (no copy)
        w.postMessage({ cmd: 'demux', data: data, audioCodec: audioCodec, videoCodec: videoCodec, timeOffset: timeOffset, cc: cc, level: level, sn: sn, duration: duration, decryptdata: decryptdata, accurateTimeOffset: accurateTimeOffset, defaultInitPTS: defaultInitPTS }, [data]);
      } else {
        var demuxer = this.demuxer;
        if (demuxer) {
          demuxer.push(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration, decryptdata, accurateTimeOffset, defaultInitPTS);
        }
      }
    }
  }, {
    key: 'onWorkerMessage',
    value: function onWorkerMessage(ev) {
      var data = ev.data,
          hls = this.hls;
      //console.log('onWorkerMessage:' + data.event);
      switch (data.event) {
        case 'init':
          // revoke the Object URL that was used to create demuxer worker, so as not to leak it
          URL.revokeObjectURL(this.w.objectURL);
          break;
        // special case for FRAG_PARSING_DATA: data1 and data2 are transferable objects
        case _events2.default.FRAG_PARSING_DATA:
          data.data.data1 = new Uint8Array(data.data1);
          data.data.data2 = new Uint8Array(data.data2);
        /* falls through */
        default:
          hls.trigger(data.event, data.data);
          break;
      }
    }
  }]);

  return Demuxer;
}();

exports.default = Demuxer;

},{"20":20,"21":21,"26":26,"28":28,"3":3,"45":45}],23:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Parser for exponential Golomb codes, a variable-bitwidth number encoding scheme used by h264.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     */

var _logger = _dereq_(45);

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ExpGolomb = function () {
  function ExpGolomb(data) {
    _classCallCheck(this, ExpGolomb);

    this.data = data;
    // the number of bytes left to examine in this.data
    this.bytesAvailable = data.byteLength;
    // the current word being examined
    this.word = 0; // :uint
    // the number of bits left to examine in the current word
    this.bitsAvailable = 0; // :uint
  }

  // ():void


  _createClass(ExpGolomb, [{
    key: 'loadWord',
    value: function loadWord() {
      var data = this.data,
          bytesAvailable = this.bytesAvailable,
          position = data.byteLength - bytesAvailable,
          workingBytes = new Uint8Array(4),
          availableBytes = Math.min(4, bytesAvailable);
      if (availableBytes === 0) {
        throw new Error('no bytes available');
      }
      workingBytes.set(data.subarray(position, position + availableBytes));
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
      if (bits > 0 && this.bitsAvailable) {
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
          profileIdc,
          profileCompat,
          levelIdc,
          numRefFramesInPicOrderCntCycle,
          picWidthInMbsMinus1,
          picHeightInMapUnitsMinus1,
          frameMbsOnlyFlag,
          scalingListCount,
          i,
          readUByte = this.readUByte.bind(this),
          readBits = this.readBits.bind(this),
          readUEG = this.readUEG.bind(this),
          readBoolean = this.readBoolean.bind(this),
          skipBits = this.skipBits.bind(this),
          skipEG = this.skipEG.bind(this),
          skipUEG = this.skipUEG.bind(this),
          skipScalingList = this.skipScalingList.bind(this);

      readUByte();
      profileIdc = readUByte(); // profile_idc
      profileCompat = readBits(5); // constraint_set[0-4]_flag, u(5)
      skipBits(3); // reserved_zero_3bits u(3),
      levelIdc = readUByte(); //level_idc u(8)
      skipUEG(); // seq_parameter_set_id
      // some profiles have more optional data we don't need
      if (profileIdc === 100 || profileIdc === 110 || profileIdc === 122 || profileIdc === 244 || profileIdc === 44 || profileIdc === 83 || profileIdc === 86 || profileIdc === 118 || profileIdc === 128) {
        var chromaFormatIdc = readUEG();
        if (chromaFormatIdc === 3) {
          skipBits(1); // separate_colour_plane_flag
        }
        skipUEG(); // bit_depth_luma_minus8
        skipUEG(); // bit_depth_chroma_minus8
        skipBits(1); // qpprime_y_zero_transform_bypass_flag
        if (readBoolean()) {
          // seq_scaling_matrix_present_flag
          scalingListCount = chromaFormatIdc !== 3 ? 8 : 12;
          for (i = 0; i < scalingListCount; i++) {
            if (readBoolean()) {
              // seq_scaling_list_present_flag[ i ]
              if (i < 6) {
                skipScalingList(16);
              } else {
                skipScalingList(64);
              }
            }
          }
        }
      }
      skipUEG(); // log2_max_frame_num_minus4
      var picOrderCntType = readUEG();
      if (picOrderCntType === 0) {
        readUEG(); //log2_max_pic_order_cnt_lsb_minus4
      } else if (picOrderCntType === 1) {
        skipBits(1); // delta_pic_order_always_zero_flag
        skipEG(); // offset_for_non_ref_pic
        skipEG(); // offset_for_top_to_bottom_field
        numRefFramesInPicOrderCntCycle = readUEG();
        for (i = 0; i < numRefFramesInPicOrderCntCycle; i++) {
          skipEG(); // offset_for_ref_frame[ i ]
        }
      }
      skipUEG(); // max_num_ref_frames
      skipBits(1); // gaps_in_frame_num_value_allowed_flag
      picWidthInMbsMinus1 = readUEG();
      picHeightInMapUnitsMinus1 = readUEG();
      frameMbsOnlyFlag = readBits(1);
      if (frameMbsOnlyFlag === 0) {
        skipBits(1); // mb_adaptive_frame_field_flag
      }
      skipBits(1); // direct_8x8_inference_flag
      if (readBoolean()) {
        // frame_cropping_flag
        frameCropLeftOffset = readUEG();
        frameCropRightOffset = readUEG();
        frameCropTopOffset = readUEG();
        frameCropBottomOffset = readUEG();
      }
      var pixelRatio = [1, 1];
      if (readBoolean()) {
        // vui_parameters_present_flag
        if (readBoolean()) {
          // aspect_ratio_info_present_flag
          var aspectRatioIdc = readUByte();
          switch (aspectRatioIdc) {
            case 1:
              pixelRatio = [1, 1];break;
            case 2:
              pixelRatio = [12, 11];break;
            case 3:
              pixelRatio = [10, 11];break;
            case 4:
              pixelRatio = [16, 11];break;
            case 5:
              pixelRatio = [40, 33];break;
            case 6:
              pixelRatio = [24, 11];break;
            case 7:
              pixelRatio = [20, 11];break;
            case 8:
              pixelRatio = [32, 11];break;
            case 9:
              pixelRatio = [80, 33];break;
            case 10:
              pixelRatio = [18, 11];break;
            case 11:
              pixelRatio = [15, 11];break;
            case 12:
              pixelRatio = [64, 33];break;
            case 13:
              pixelRatio = [160, 99];break;
            case 14:
              pixelRatio = [4, 3];break;
            case 15:
              pixelRatio = [3, 2];break;
            case 16:
              pixelRatio = [2, 1];break;
            case 255:
              {
                pixelRatio = [readUByte() << 8 | readUByte(), readUByte() << 8 | readUByte()];
                break;
              }
          }
        }
      }
      return {
        width: Math.ceil((picWidthInMbsMinus1 + 1) * 16 - frameCropLeftOffset * 2 - frameCropRightOffset * 2),
        height: (2 - frameMbsOnlyFlag) * (picHeightInMapUnitsMinus1 + 1) * 16 - (frameMbsOnlyFlag ? 2 : 4) * (frameCropTopOffset + frameCropBottomOffset),
        pixelRatio: pixelRatio
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

},{"45":45}],24:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * ID3 parser
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */


var _logger = _dereq_(45);

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

},{"45":45}],25:[function(_dereq_,module,exports){
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


var _adts = _dereq_(19);

var _adts2 = _interopRequireDefault(_adts);

var _events = _dereq_(28);

var _events2 = _interopRequireDefault(_events);

var _expGolomb = _dereq_(23);

var _expGolomb2 = _interopRequireDefault(_expGolomb);

var _logger = _dereq_(45);

var _errors = _dereq_(26);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var TSDemuxer = function () {
  function TSDemuxer(observer, id, remuxerClass, config, typeSupported) {
    _classCallCheck(this, TSDemuxer);

    this.observer = observer;
    this.id = id;
    this.remuxerClass = remuxerClass;
    this.config = config;
    this.typeSupported = typeSupported;
    this.lastCC = 0;
    this.remuxer = new this.remuxerClass(observer, id, config, typeSupported);
  }

  _createClass(TSDemuxer, [{
    key: 'switchLevel',
    value: function switchLevel() {
      this.pmtParsed = false;
      this._pmtId = -1;
      this._avcTrack = { container: 'video/mp2t', type: 'video', id: -1, sequenceNumber: 0, samples: [], len: 0, dropped: 0 };
      this._audioTrack = { container: 'video/mp2t', type: 'audio', id: -1, sequenceNumber: 0, samples: [], len: 0, isAAC: true };
      this._id3Track = { type: 'id3', id: -1, sequenceNumber: 0, samples: [], len: 0 };
      this._txtTrack = { type: 'text', id: -1, sequenceNumber: 0, samples: [], len: 0 };
      // flush any partial content
      this.aacOverFlow = null;
      this.aacLastPTS = null;
      this.avcSample = null;
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
    value: function push(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration, accurateTimeOffset, defaultInitPTS) {
      var start,
          len = data.length,
          stt,
          pid,
          atf,
          offset,
          pes,
          codecsOnly = this.remuxer.passthrough,
          unknownPIDs = false;

      this.audioCodec = audioCodec;
      this.videoCodec = videoCodec;
      this._duration = duration;
      this.contiguous = false;
      this.accurateTimeOffset = accurateTimeOffset;
      if (cc !== this.lastCC) {
        _logger.logger.log('discontinuity detected');
        this.insertDiscontinuity();
        this.lastCC = cc;
      }
      if (level !== this.lastLevel) {
        _logger.logger.log('level switch detected');
        this.switchLevel();
        this.lastLevel = level;
      } else if (sn === this.lastSN + 1) {
        this.contiguous = true;
      }
      this.lastSN = sn;

      var pmtParsed = this.pmtParsed,
          avcTrack = this._avcTrack,
          audioTrack = this._audioTrack,
          id3Track = this._id3Track,
          avcId = avcTrack.id,
          audioId = audioTrack.id,
          id3Id = id3Track.id,
          pmtId = this._pmtId,
          avcData = avcTrack.pesData,
          audioData = audioTrack.pesData,
          id3Data = id3Track.pesData,
          parsePAT = this._parsePAT,
          parsePMT = this._parsePMT,
          parsePES = this._parsePES,
          parseAVCPES = this._parseAVCPES.bind(this),
          parseAACPES = this._parseAACPES.bind(this),
          parseMPEGPES = this._parseMPEGPES.bind(this),
          parseID3PES = this._parseID3PES.bind(this);

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
          switch (pid) {
            case avcId:
              if (stt) {
                if (avcData && (pes = parsePES(avcData))) {
                  parseAVCPES(pes, false);
                  if (codecsOnly) {
                    // if we have video codec info AND
                    // if audio PID is undefined OR if we have audio codec info,
                    // we have all codec info !
                    if (avcTrack.codec && (audioId === -1 || audioTrack.codec)) {
                      this.remux(level, sn, cc, data, timeOffset);
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
              break;
            case audioId:
              if (stt) {
                if (audioData && (pes = parsePES(audioData))) {
                  if (audioTrack.isAAC) {
                    parseAACPES(pes);
                  } else {
                    parseMPEGPES(pes);
                  }
                  if (codecsOnly) {
                    // here we now that we have audio codec info
                    // if video PID is undefined OR if we have video codec info,
                    // we have all codec infos !
                    if (audioTrack.codec && (avcId === -1 || avcTrack.codec)) {
                      this.remux(level, sn, cc, data, timeOffset);
                      return;
                    }
                  }
                }
                audioData = { data: [], size: 0 };
              }
              if (audioData) {
                audioData.data.push(data.subarray(offset, start + 188));
                audioData.size += start + 188 - offset;
              }
              break;
            case id3Id:
              if (stt) {
                if (id3Data && (pes = parsePES(id3Data))) {
                  parseID3PES(pes);
                }
                id3Data = { data: [], size: 0 };
              }
              if (id3Data) {
                id3Data.data.push(data.subarray(offset, start + 188));
                id3Data.size += start + 188 - offset;
              }
              break;
            case 0:
              if (stt) {
                offset += data[offset] + 1;
              }
              pmtId = this._pmtId = parsePAT(data, offset);
              break;
            case pmtId:
              if (stt) {
                offset += data[offset] + 1;
              }
              var parsedPIDs = parsePMT(data, offset, this.typeSupported.mpeg === true || this.typeSupported.mp3 === true);

              // only update track id if track PID found while parsing PMT
              // this is to avoid resetting the PID to -1 in case
              // track PID transiently disappears from the stream
              // this could happen in case of transient missing audio samples for example
              avcId = parsedPIDs.avc;
              if (avcId > 0) {
                avcTrack.id = avcId;
              }
              audioId = parsedPIDs.audio;
              if (audioId > 0) {
                audioTrack.id = audioId;
                audioTrack.isAAC = parsedPIDs.isAAC;
              }
              id3Id = parsedPIDs.id3;
              if (id3Id > 0) {
                id3Track.id = id3Id;
              }
              if (unknownPIDs && !pmtParsed) {
                _logger.logger.log('reparse from beginning');
                unknownPIDs = false;
                // we set it to -188, the += 188 in the for loop will reset start to 0
                start = -188;
              }
              pmtParsed = this.pmtParsed = true;
              break;
            case 17:
            case 0x1fff:
              break;
            default:
              unknownPIDs = true;
              break;
          }
        } else {
          this.observer.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, id: this.id, details: _errors.ErrorDetails.FRAG_PARSING_ERROR, fatal: false, reason: 'TS packet did not start with 0x47' });
        }
      }
      // try to parse last PES packets
      if (avcData && (pes = parsePES(avcData))) {
        parseAVCPES(pes, true);
        avcTrack.pesData = null;
      } else {
        // either avcData null or PES truncated, keep it for next frag parsing
        avcTrack.pesData = avcData;
      }

      if (audioData && (pes = parsePES(audioData))) {
        if (audioTrack.isAAC) {
          parseAACPES(pes);
        } else {
          parseMPEGPES(pes);
        }
        audioTrack.pesData = null;
      } else {
        if (audioData && audioData.size) {
          _logger.logger.log('last AAC PES packet truncated,might overlap between fragments');
        }
        // either audioData null or PES truncated, keep it for next frag parsing
        audioTrack.pesData = audioData;
      }

      if (id3Data && (pes = parsePES(id3Data))) {
        parseID3PES(pes);
        id3Track.pesData = null;
      } else {
        // either id3Data null or PES truncated, keep it for next frag parsing
        id3Track.pesData = id3Data;
      }
      this.remux(level, sn, cc, null, timeOffset, defaultInitPTS);
    }
  }, {
    key: 'remux',
    value: function remux(level, sn, cc, data, timeOffset, defaultInitPTS) {
      var avcTrack = this._avcTrack,
          samples = avcTrack.samples,
          nbNalu = 0,
          naluLen = 0;

      // compute total/avc sample length and nb of NAL units
      for (var i = 0; i < samples.length; i++) {
        var sample = samples[i],
            units = sample.units.units,
            nbUnits = units.length,
            sampleLen = 0;
        for (var j = 0; j < nbUnits; j++) {
          sampleLen += units[j].data.length;
        }
        naluLen += sampleLen;
        nbNalu += nbUnits;
        sample.length = sampleLen;
      }
      avcTrack.len = naluLen;
      avcTrack.nbNalu = nbNalu;
      this.remuxer.remux(level, sn, cc, this._audioTrack, this._avcTrack, this._id3Track, this._txtTrack, timeOffset, this.contiguous, this.accurateTimeOffset, defaultInitPTS, data);
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
      return (data[offset + 10] & 0x1F) << 8 | data[offset + 11];
      //logger.log('PMT PID:'  + this._pmtId);
    }
  }, {
    key: '_parsePMT',
    value: function _parsePMT(data, offset, mpegSupported) {
      var sectionLength,
          tableEnd,
          programInfoLength,
          pid,
          result = { audio: -1, avc: -1, id3: -1, isAAC: true };
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
            if (result.audio === -1) {
              result.audio = pid;
            }
            break;
          // Packetized metadata (ID3)
          case 0x15:
            //logger.log('ID3 PID:'  + pid);
            if (result.id3 === -1) {
              result.id3 = pid;
            }
            break;
          // ITU-T Rec. H.264 and ISO/IEC 14496-10 (lower bit-rate video)
          case 0x1b:
            //logger.log('AVC PID:'  + pid);
            if (result.avc === -1) {
              result.avc = pid;
            }
            break;
          // ISO/IEC 11172-3 (MPEG-1 audio)
          // or ISO/IEC 13818-3 (MPEG-2 halved sample rate audio)
          case 0x03:
          case 0x04:
            //logger.log('MPEG PID:'  + pid);
            if (!mpegSupported) {
              _logger.logger.log('MPEG audio found, not supported in this browser for now');
            } else if (result.audio === -1) {
              result.audio = pid;
              result.isAAC = false;
            }
            break;
          case 0x24:
            _logger.logger.warn('HEVC stream type found, not supported for now');
            break;
          default:
            _logger.logger.log('unkown stream type:' + data[offset]);
            break;
        }
        // move to the next table entry
        // skip past the elementary stream descriptors, if present
        offset += ((data[offset + 3] & 0x0F) << 8 | data[offset + 4]) + 5;
      }
      return result;
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
      // safety check
      if (!stream || stream.size === 0) {
        return null;
      }

      // we might need up to 19 bytes to read PES header
      // if first chunk of data is less than 19 bytes, let's merge it with following ones until we get 19 bytes
      // usually only one merge is needed (and this is rare ...)
      while (data[0].length < 19 && data.length > 1) {
        var newData = new Uint8Array(data[0].length + data[1].length);
        newData.set(data[0]);
        newData.set(data[1], data[0].length);
        data[0] = newData;
        data.splice(1, 1);
      }
      //retrieve PTS/DTS from first fragment
      frag = data[0];
      pesPrefix = (frag[0] << 16) + (frag[1] << 8) + frag[2];
      if (pesPrefix === 1) {
        pesLen = (frag[4] << 8) + frag[5];
        // if PES parsed length is not zero and greater than total received length, stop parsing. PES might be truncated
        // minus 6 : PES header size
        if (pesLen && pesLen > stream.size - 6) {
          return null;
        }
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
            if (pesPts - pesDts > 60 * 90000) {
              _logger.logger.warn(Math.round((pesPts - pesDts) / 90000) + 's delta between PTS and DTS, align them');
              pesPts = pesDts;
            }
          } else {
            pesDts = pesPts;
          }
        }
        pesHdrLen = frag[8];
        // 9 bytes : 6 bytes for PES header + 3 bytes for PES extension
        payloadStartOffset = pesHdrLen + 9;

        stream.size -= payloadStartOffset;
        //reassemble PES packet
        pesData = new Uint8Array(stream.size);
        for (var j = 0, dataLen = data.length; j < dataLen; j++) {
          frag = data[j];
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
        if (pesLen) {
          // payload size : remove PES header + PES extension
          pesLen -= pesHdrLen + 3;
        }
        return { data: pesData, pts: pesPts, dts: pesDts, len: pesLen };
      } else {
        return null;
      }
    }
  }, {
    key: 'pushAccesUnit',
    value: function pushAccesUnit(avcSample, avcTrack) {
      if (avcSample.units.units.length && avcSample.frame) {
        // only push AVC sample if starting with a keyframe is not mandatory OR
        //    if keyframe already found in this fragment OR
        //       keyframe found in last fragment (track.sps) AND
        //          samples already appended (we already found a keyframe in this fragment) OR fragment is contiguous
        if (!this.config.forceKeyFrameOnDiscontinuity || avcSample.key === true || avcTrack.sps && (avcTrack.samples.length || this.contiguous)) {
          avcTrack.samples.push(avcSample);
        } else {
          // dropped samples, track it
          avcTrack.dropped++;
        }
      }
      if (avcSample.debug.length) {
        _logger.logger.log(avcSample.pts + '/' + avcSample.dts + ':' + avcSample.debug + ',' + avcSample.units.length);
      }
    }
  }, {
    key: '_parseAVCPES',
    value: function _parseAVCPES(pes, last) {
      var _this = this;

      //logger.log('parse new PES');
      var track = this._avcTrack,
          units = this._parseAVCNALu(pes.data),
          debug = false,
          expGolombDecoder,
          avcSample = this.avcSample,
          push,
          i;
      //free pes.data to save up some memory
      pes.data = null;

      units.forEach(function (unit) {
        switch (unit.type) {
          //NDR
          case 1:
            push = true;
            if (debug && avcSample) {
              avcSample.debug += 'NDR ';
            }
            avcSample.frame = true;
            // retrieve slice type by parsing beginning of NAL unit (follow H264 spec, slice_header definition) to detect keyframe embedded in NDR
            var data = unit.data;
            if (data.length > 4) {
              var sliceType = new _expGolomb2.default(data).readSliceType();
              // 2 : I slice, 4 : SI slice, 7 : I slice, 9: SI slice
              // SI slice : A slice that is coded using intra prediction only and using quantisation of the prediction samples.
              // An SI slice can be coded such that its decoded samples can be constructed identically to an SP slice.
              // I slice: A slice that is not an SI slice that is decoded using intra prediction only.
              //if (sliceType === 2 || sliceType === 7) {
              if (sliceType === 2 || sliceType === 4 || sliceType === 7 || sliceType === 9) {
                avcSample.key = true;
              }
            }
            break;
          //IDR
          case 5:
            push = true;
            // handle PES not starting with AUD
            if (!avcSample) {
              avcSample = _this.avcSample = _this._createAVCSample(true, pes.pts, pes.dts, '');
            }
            if (debug) {
              avcSample.debug += 'IDR ';
            }
            avcSample.key = true;
            avcSample.frame = true;
            break;
          //SEI
          case 6:
            push = true;
            if (debug && avcSample) {
              avcSample.debug += 'SEI ';
            }
            expGolombDecoder = new _expGolomb2.default(_this.discardEPB(unit.data));

            // skip frameType
            expGolombDecoder.readUByte();

            var payloadType = 0;
            var payloadSize = 0;
            var endOfCaptions = false;
            var b = 0;

            while (!endOfCaptions && expGolombDecoder.bytesAvailable > 1) {
              payloadType = 0;
              do {
                b = expGolombDecoder.readUByte();
                payloadType += b;
              } while (b === 0xFF);

              // Parse payload size.
              payloadSize = 0;
              do {
                b = expGolombDecoder.readUByte();
                payloadSize += b;
              } while (b === 0xFF);

              // TODO: there can be more than one payload in an SEI packet...
              // TODO: need to read type and size in a while loop to get them all
              if (payloadType === 4 && expGolombDecoder.bytesAvailable !== 0) {

                endOfCaptions = true;

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

                        _this._insertSampleInOrder(_this._txtTrack.samples, { type: 3, pts: pes.pts, bytes: byteArray });
                      }
                    }
                  }
                }
              } else if (payloadSize < expGolombDecoder.bytesAvailable) {
                for (i = 0; i < payloadSize; i++) {
                  expGolombDecoder.readUByte();
                }
              }
            }
            break;
          //SPS
          case 7:
            push = true;
            if (debug && avcSample) {
              avcSample.debug += 'SPS ';
            }
            if (!track.sps) {
              expGolombDecoder = new _expGolomb2.default(unit.data);
              var config = expGolombDecoder.readSPS();
              track.width = config.width;
              track.height = config.height;
              track.pixelRatio = config.pixelRatio;
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
            if (debug && avcSample) {
              avcSample.debug += 'PPS ';
            }
            if (!track.pps) {
              track.pps = [unit.data];
            }
            break;
          // AUD
          case 9:
            push = false;
            if (avcSample) {
              _this.pushAccesUnit(avcSample, track);
            }
            avcSample = _this.avcSample = _this._createAVCSample(false, pes.pts, pes.dts, debug ? 'AUD ' : '');
            break;
          // Filler Data
          case 12:
            push = false;
            break;
          default:
            push = false;
            if (avcSample) {
              avcSample.debug += 'unknown NAL ' + unit.type + ' ';
            }
            break;
        }
        if (avcSample && push) {
          var _units = avcSample.units;
          _units.units.push(unit);
        }
      });
      // if last PES packet, push samples
      if (last && avcSample) {
        this.pushAccesUnit(avcSample, track);
        this.avcSample = null;
      }
    }
  }, {
    key: '_createAVCSample',
    value: function _createAVCSample(key, pts, dts, debug) {
      return { key: key, pts: pts, dts: dts, units: { units: [], length: 0 }, debug: debug };
    }
  }, {
    key: '_insertSampleInOrder',
    value: function _insertSampleInOrder(arr, data) {
      var len = arr.length;
      if (len > 0) {
        if (data.pts >= arr[len - 1].pts) {
          arr.push(data);
        } else {
          for (var pos = len - 1; pos >= 0; pos--) {
            if (data.pts < arr[pos].pts) {
              arr.splice(pos, 0, data);
              break;
            }
          }
        }
      } else {
        arr.push(data);
      }
    }
  }, {
    key: '_getLastNalUnit',
    value: function _getLastNalUnit() {
      var avcSample = this.avcSample,
          lastUnit = void 0;
      // try to fallback to previous sample if current one is empty
      if (!avcSample || avcSample.units.units.length === 0) {
        var track = this._avcTrack,
            samples = track.samples;
        avcSample = samples[samples.length - 1];
      }
      if (avcSample) {
        var units = avcSample.units.units;
        lastUnit = units[units.length - 1];
      }
      return lastUnit;
    }
  }, {
    key: '_parseAVCNALu',
    value: function _parseAVCNALu(array) {
      var i = 0,
          len = array.byteLength,
          value,
          overflow,
          track = this._avcTrack,
          state = track.naluState || 0,
          lastState = state;
      var units = [],
          unit,
          unitType,
          lastUnitStart = -1,
          lastUnitType;
      //logger.log('PES:' + Hex.hexDump(array));

      if (state === -1) {
        // special use case where we found 3 or 4-byte start codes exactly at the end of previous PES packet
        lastUnitStart = 0;
        // NALu type is value read from offset 0
        lastUnitType = array[0] & 0x1f;
        state = 0;
        i = 1;
      }

      while (i < len) {
        value = array[i++];
        // optimization. state 0 and 1 are the predominant case. let's handle them outside of the switch/case
        if (!state) {
          state = value ? 0 : 1;
          continue;
        }
        if (state === 1) {
          state = value ? 0 : 2;
          continue;
        }
        // here we have state either equal to 2 or 3
        if (!value) {
          state = 3;
        } else if (value === 1) {
          if (lastUnitStart >= 0) {
            unit = { data: array.subarray(lastUnitStart, i - state - 1), type: lastUnitType };
            //logger.log('pushing NALU, type/size:' + unit.type + '/' + unit.data.byteLength);
            units.push(unit);
          } else {
            // lastUnitStart is undefined => this is the first start code found in this PES packet
            // first check if start code delimiter is overlapping between 2 PES packets,
            // ie it started in last packet (lastState not zero)
            // and ended at the beginning of this PES packet (i <= 4 - lastState)
            var lastUnit = this._getLastNalUnit();
            if (lastUnit) {
              if (lastState && i <= 4 - lastState) {
                // start delimiter overlapping between PES packets
                // strip start delimiter bytes from the end of last NAL unit
                // check if lastUnit had a state different from zero
                if (lastUnit.state) {
                  // strip last bytes
                  lastUnit.data = lastUnit.data.subarray(0, lastUnit.data.byteLength - lastState);
                }
              }
              // If NAL units are not starting right at the beginning of the PES packet, push preceding data into previous NAL unit.
              overflow = i - state - 1;
              if (overflow > 0) {
                //logger.log('first NALU found with overflow:' + overflow);
                var tmp = new Uint8Array(lastUnit.data.byteLength + overflow);
                tmp.set(lastUnit.data, 0);
                tmp.set(array.subarray(0, overflow), lastUnit.data.byteLength);
                lastUnit.data = tmp;
              }
            }
          }
          // check if we can read unit type
          if (i < len) {
            unitType = array[i] & 0x1f;
            //logger.log('find NALU @ offset:' + i + ',type:' + unitType);
            lastUnitStart = i;
            lastUnitType = unitType;
            state = 0;
          } else {
            // not enough byte to read unit type. let's read it on next PES parsing
            state = -1;
          }
        } else {
          state = 0;
        }
      }
      if (lastUnitStart >= 0 && state >= 0) {
        unit = { data: array.subarray(lastUnitStart, len), type: lastUnitType, state: state };
        units.push(unit);
        //logger.log('pushing NALU, type/size/state:' + unit.type + '/' + unit.data.byteLength + '/' + state);
      }
      // no NALu found
      if (units.length === 0) {
        // append pes.data to previous NAL unit
        var _lastUnit = this._getLastNalUnit();
        if (_lastUnit) {
          var _tmp = new Uint8Array(_lastUnit.data.byteLength + array.byteLength);
          _tmp.set(_lastUnit.data, 0);
          _tmp.set(array, _lastUnit.data.byteLength);
          _lastUnit.data = _tmp;
        }
      }
      track.naluState = state;
      return units;
    }

    /**
     * remove Emulation Prevention bytes from a RBSP
     */

  }, {
    key: 'discardEPB',
    value: function discardEPB(data) {
      var length = data.byteLength,
          EPBPositions = [],
          i = 1,
          newLength,
          newData;

      // Find all `Emulation Prevention Bytes`
      while (i < length - 2) {
        if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0x03) {
          EPBPositions.push(i + 2);
          i += 2;
        } else {
          i++;
        }
      }

      // If no Emulation Prevention Bytes were found just return the original
      // array
      if (EPBPositions.length === 0) {
        return data;
      }

      // Create a new array to hold the NAL unit data
      newLength = length - EPBPositions.length;
      newData = new Uint8Array(newLength);
      var sourceIndex = 0;

      for (i = 0; i < newLength; sourceIndex++, i++) {
        if (sourceIndex === EPBPositions[0]) {
          // Skip this byte
          sourceIndex++;
          // Remove this position index
          EPBPositions.shift();
        }
        newData[i] = data[sourceIndex];
      }
      return newData;
    }
  }, {
    key: '_parseAACPES',
    value: function _parseAACPES(pes) {
      var track = this._audioTrack,
          data = pes.data,
          pts = pes.pts,
          startOffset = 0,
          aacOverFlow = this.aacOverFlow,
          aacLastPTS = this.aacLastPTS,
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
        _logger.logger.warn('parsing error:' + reason);
        this.observer.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, id: this.id, details: _errors.ErrorDetails.FRAG_PARSING_ERROR, fatal: fatal, reason: reason });
        if (fatal) {
          return;
        }
      }
      if (!track.audiosamplerate) {
        var audioCodec = this.audioCodec;
        config = _adts2.default.getAudioConfig(this.observer, data, offset, audioCodec);
        track.config = config.config;
        track.audiosamplerate = config.samplerate;
        track.channelCount = config.channelCount;
        track.codec = config.codec;
        track.manifestCodec = config.manifestCodec;
        track.duration = this._duration;
        _logger.logger.log('parsed codec:' + track.codec + ',rate:' + config.samplerate + ',nb channel:' + config.channelCount);
      }
      frameIndex = 0;
      frameDuration = 1024 * 90000 / track.audiosamplerate;

      // if last AAC frame is overflowing, we should ensure timestamps are contiguous:
      // first sample PTS should be equal to last sample PTS + frameDuration
      if (aacOverFlow && aacLastPTS) {
        var newPTS = aacLastPTS + frameDuration;
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
      this.aacLastPTS = stamp;
    }
  }, {
    key: '_parseMPEGPES',
    value: function _parseMPEGPES(pes) {
      var data = pes.data;
      var pts = pes.pts;
      var length = data.length;
      var frameIndex = 0;
      var offset = 0;
      var parsed;

      while (offset < length && (parsed = this._parseMpeg(data, offset, length, frameIndex++, pts)) > 0) {
        offset += parsed;
      }
    }
  }, {
    key: '_onMpegFrame',
    value: function _onMpegFrame(data, bitRate, sampleRate, channelCount, frameIndex, pts) {
      var frameDuration = 1152 / sampleRate * 1000;
      var stamp = pts + frameIndex * frameDuration;
      var track = this._audioTrack;

      track.config = [];
      track.channelCount = channelCount;
      track.audiosamplerate = sampleRate;
      track.duration = this._duration;
      track.samples.push({ unit: data, pts: stamp, dts: stamp });
      track.len += data.length;
    }
  }, {
    key: '_onMpegNoise',
    value: function _onMpegNoise(data) {
      _logger.logger.warn('mpeg audio has noise: ' + data.length + ' bytes');
    }
  }, {
    key: '_parseMpeg',
    value: function _parseMpeg(data, start, end, frameIndex, pts) {
      var BitratesMap = [32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
      var SamplingRateMap = [44100, 48000, 32000, 22050, 24000, 16000, 11025, 12000, 8000];

      if (start + 2 > end) {
        return -1; // we need at least 2 bytes to detect sync pattern
      }
      if (data[start] === 0xFF || (data[start + 1] & 0xE0) === 0xE0) {
        // Using http://www.datavoyage.com/mpgscript/mpeghdr.htm as a reference
        if (start + 24 > end) {
          return -1;
        }
        var headerB = data[start + 1] >> 3 & 3;
        var headerC = data[start + 1] >> 1 & 3;
        var headerE = data[start + 2] >> 4 & 15;
        var headerF = data[start + 2] >> 2 & 3;
        var headerG = !!(data[start + 2] & 2);
        if (headerB !== 1 && headerE !== 0 && headerE !== 15 && headerF !== 3) {
          var columnInBitrates = headerB === 3 ? 3 - headerC : headerC === 3 ? 3 : 4;
          var bitRate = BitratesMap[columnInBitrates * 14 + headerE - 1] * 1000;
          var columnInSampleRates = headerB === 3 ? 0 : headerB === 2 ? 1 : 2;
          var sampleRate = SamplingRateMap[columnInSampleRates * 3 + headerF];
          var padding = headerG ? 1 : 0;
          var channelCount = data[start + 3] >> 6 === 3 ? 1 : 2; // If bits of channel mode are `11` then it is a single channel (Mono)
          var frameLength = headerC === 3 ? (headerB === 3 ? 12 : 6) * bitRate / sampleRate + padding << 2 : (headerB === 3 ? 144 : 72) * bitRate / sampleRate + padding | 0;
          if (start + frameLength > end) {
            return -1;
          }
          if (this._onMpegFrame) {
            this._onMpegFrame(data.subarray(start, start + frameLength), bitRate, sampleRate, channelCount, frameIndex, pts);
          }
          return frameLength;
        }
      }
      // noise or ID3, trying to skip
      var offset = start + 2;
      while (offset < end) {
        if (data[offset - 1] === 0xFF && (data[offset] & 0xE0) === 0xE0) {
          // sync pattern is found
          if (this._onMpegNoise) {
            this._onMpegNoise(data.subarray(start, offset - 1));
          }
          return offset - start - 1;
        }
        offset++;
      }
      return -1;
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

},{"19":19,"23":23,"26":26,"28":28,"45":45}],26:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
var ErrorTypes = exports.ErrorTypes = {
  // Identifier for a network error (loading error / timeout ...)
  NETWORK_ERROR: 'networkError',
  // Identifier for a media Error (video/parsing/mediasource error)
  MEDIA_ERROR: 'mediaError',
  // Identifier for a mux Error (demuxing/remuxing)
  MUX_ERROR: 'muxError',
  // Identifier for all other errors
  OTHER_ERROR: 'otherError'
};

var ErrorDetails = exports.ErrorDetails = {
  // Identifier for a manifest load error - data: { url : faulty URL, response : { code: error code, text: error text }}
  MANIFEST_LOAD_ERROR: 'manifestLoadError',
  // Identifier for a manifest load timeout - data: { url : faulty URL, response : { code: error code, text: error text }}
  MANIFEST_LOAD_TIMEOUT: 'manifestLoadTimeOut',
  // Identifier for a manifest parsing error - data: { url : faulty URL, reason : error reason}
  MANIFEST_PARSING_ERROR: 'manifestParsingError',
  // Identifier for a manifest with only incompatible codecs error - data: { url : faulty URL, reason : error reason}
  MANIFEST_INCOMPATIBLE_CODECS_ERROR: 'manifestIncompatibleCodecsError',
  // Identifier for a level load error - data: { url : faulty URL, response : { code: error code, text: error text }}
  LEVEL_LOAD_ERROR: 'levelLoadError',
  // Identifier for a level load timeout - data: { url : faulty URL, response : { code: error code, text: error text }}
  LEVEL_LOAD_TIMEOUT: 'levelLoadTimeOut',
  // Identifier for a level switch error - data: { level : faulty level Id, event : error description}
  LEVEL_SWITCH_ERROR: 'levelSwitchError',
  // Identifier for an audio track load error - data: { url : faulty URL, response : { code: error code, text: error text }}
  AUDIO_TRACK_LOAD_ERROR: 'audioTrackLoadError',
  // Identifier for an audio track load timeout - data: { url : faulty URL, response : { code: error code, text: error text }}
  AUDIO_TRACK_LOAD_TIMEOUT: 'audioTrackLoadTimeOut',
  // Identifier for fragment load error - data: { frag : fragment object, response : { code: error code, text: error text }}
  FRAG_LOAD_ERROR: 'fragLoadError',
  // Identifier for fragment loop loading error - data: { frag : fragment object}
  FRAG_LOOP_LOADING_ERROR: 'fragLoopLoadingError',
  // Identifier for fragment load timeout error - data: { frag : fragment object}
  FRAG_LOAD_TIMEOUT: 'fragLoadTimeOut',
  // Identifier for a fragment decryption error event - data: parsing error description
  FRAG_DECRYPT_ERROR: 'fragDecryptError',
  // Identifier for a fragment parsing error event - data: { id : demuxer Id, reason : parsing error description }
  // will be renamed DEMUX_PARSING_ERROR and switched to MUX_ERROR in the next major release
  FRAG_PARSING_ERROR: 'fragParsingError',
  // Identifier for a remux alloc error event - data: { id : demuxer Id, bytes : nb of bytes on which allocation failed , reason : error text }
  REMUX_ALLOC_ERROR: 'remuxAllocError',
  // Identifier for decrypt key load error - data: { frag : fragment object, response : { code: error code, text: error text }}
  KEY_LOAD_ERROR: 'keyLoadError',
  // Identifier for decrypt key load timeout error - data: { frag : fragment object}
  KEY_LOAD_TIMEOUT: 'keyLoadTimeOut',
  // Triggered when an exception occurs while adding a sourceBuffer to MediaSource - data : {  err : exception , mimeType : mimeType }
  BUFFER_ADD_CODEC_ERROR: 'bufferAddCodecError',
  // Identifier for a buffer append error - data: append error description
  BUFFER_APPEND_ERROR: 'bufferAppendError',
  // Identifier for a buffer appending error event - data: appending error description
  BUFFER_APPENDING_ERROR: 'bufferAppendingError',
  // Identifier for a buffer stalled error event
  BUFFER_STALLED_ERROR: 'bufferStalledError',
  // Identifier for a buffer full event
  BUFFER_FULL_ERROR: 'bufferFullError',
  // Identifier for a buffer seek over hole event
  BUFFER_SEEK_OVER_HOLE: 'bufferSeekOverHole',
  // Identifier for a buffer nudge on stall (playback is stuck although currentTime is in a buffered area)
  BUFFER_NUDGE_ON_STALL: 'bufferNudgeOnStall',
  // Identifier for an internal exception happening inside hls.js while handling an event
  INTERNAL_EXCEPTION: 'internalException'
};

},{}],27:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     * All objects in the event handling chain should inherit from this class
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     */

var _logger = _dereq_(45);

var _errors = _dereq_(26);

var _events = _dereq_(28);

var _events2 = _interopRequireDefault(_events);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

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

    /**
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
      try {
        eventToFunction.call(this, event, data).call();
      } catch (err) {
        _logger.logger.error('internal error happened while processing ' + event + ':' + err.message);
        this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.OTHER_ERROR, details: _errors.ErrorDetails.INTERNAL_EXCEPTION, fatal: false, event: event, err: err });
      }
    }
  }]);

  return EventHandler;
}();

exports.default = EventHandler;

},{"26":26,"28":28,"45":45}],28:[function(_dereq_,module,exports){
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
  // fired when sourcebuffers have been created data: { tracks : tracks}
  BUFFER_CREATED: 'hlsBufferCreated',
  // fired when we append a segment to the buffer - data: { segment: segment object }
  BUFFER_APPENDING: 'hlsBufferAppending',
  // fired when we are done with appending a media segment to the buffer data : { parent : segment parent that triggered BUFFER_APPENDING , pending : nb of segments waiting for appending for this segment parent}
  BUFFER_APPENDED: 'hlsBufferAppended',
  // fired when the stream is finished and we want to notify the media buffer that there will be no more data
  BUFFER_EOS: 'hlsBufferEos',
  // fired when the media buffer should be flushed - data {startOffset, endOffset}
  BUFFER_FLUSHING: 'hlsBufferFlushing',
  // fired when the media has been flushed
  BUFFER_FLUSHED: 'hlsBufferFlushed',
  // fired to signal that a manifest loading starts - data: { url : manifestURL}
  MANIFEST_LOADING: 'hlsManifestLoading',
  // fired after manifest has been loaded - data: { levels : [available quality levels] , audioTracks : [ available audio tracks], url : manifestURL, stats : { trequest, tfirst, tload, mtime}}
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
  // fired to notify that audio track lists has been updated data: { audioTracks : audioTracks}
  AUDIO_TRACKS_UPDATED: 'hlsAudioTracksUpdated',
  // fired when an audio track switch occurs - data: {  id : audio track id} // deprecated
  AUDIO_TRACK_SWITCH: 'hlsAudioTrackSwitch',
  // fired when an audio track switching is requested - data: {  id : audio track id}
  AUDIO_TRACK_SWITCHING: 'hlsAudioTrackSwitching',
  // fired when an audio track switch actually occurs - data: {  id : audio track id}
  AUDIO_TRACK_SWITCHED: 'hlsAudioTrackSwitched',
  // fired when an audio track loading starts - data: { url : audio track URL  id : audio track id}
  AUDIO_TRACK_LOADING: 'hlsAudioTrackLoading',
  // fired when an audio track loading  finishes - data: { details : levelDetails object, id : audio track id, stats : { trequest, tfirst, tload, mtime} }
  AUDIO_TRACK_LOADED: 'hlsAudioTrackLoaded',
  // fired when the first timestamp is found. - data: { id : demuxer id, initPTS: initPTS }
  INIT_PTS_FOUND: 'hlsInitPtsFound',
  // fired when a fragment loading starts - data: { frag : fragment object}
  FRAG_LOADING: 'hlsFragLoading',
  // fired when a fragment loading is progressing - data: { frag : fragment object, { trequest, tfirst, loaded}}
  FRAG_LOAD_PROGRESS: 'hlsFragLoadProgress',
  // Identifier for fragment load aborting for emergency switch down - data: {frag : fragment object}
  FRAG_LOAD_EMERGENCY_ABORTED: 'hlsFragLoadEmergencyAborted',
  // fired when a fragment loading is completed - data: { frag : fragment object, payload : fragment payload, stats : { trequest, tfirst, tload, length}}
  FRAG_LOADED: 'hlsFragLoaded',
  // fired when a fragment has finished decrypting - data: { level : levelId, sn : sequence number }
  FRAG_DECRYPTED: 'hlsFragDecrypted',
  // fired when Init Segment has been extracted from fragment - data: { id : demuxer id, level : levelId, sn : sequence number, moov : moov MP4 box, codecs : codecs found while parsing fragment}
  FRAG_PARSING_INIT_SEGMENT: 'hlsFragParsingInitSegment',
  // fired when parsing sei text is completed - data: { id : demuxer id, , level : levelId, sn : sequence number, samples : [ sei samples pes ] }
  FRAG_PARSING_USERDATA: 'hlsFragParsingUserdata',
  // fired when parsing id3 is completed - data: { id : demuxer id, , level : levelId, sn : sequence number, samples : [ id3 samples pes ] }
  FRAG_PARSING_METADATA: 'hlsFragParsingMetadata',
  // fired when data have been extracted from fragment - data: { id : demuxer id, level : levelId, sn : sequence number, data1 : moof MP4 box or TS fragments, data2 : mdat MP4 box or null}
  FRAG_PARSING_DATA: 'hlsFragParsingData',
  // fired when fragment parsing is completed - data: { id : demuxer id; level : levelId, sn : sequence number, }
  FRAG_PARSED: 'hlsFragParsed',
  // fired when fragment remuxed MP4 boxes have all been appended into SourceBuffer - data: { id : demuxer id,frag : fragment object, stats : { trequest, tfirst, tload, tparsed, tbuffered, length} }
  FRAG_BUFFERED: 'hlsFragBuffered',
  // fired when fragment matching with current media position is changing - data : { id : demuxer id, frag : fragment object }
  FRAG_CHANGED: 'hlsFragChanged',
  // Identifier for a FPS drop event - data: {curentDropped, currentDecoded, totalDroppedFrames}
  FPS_DROP: 'hlsFpsDrop',
  //triggered when FPS drop triggers auto level capping - data: {level, droppedlevel}
  FPS_DROP_LEVEL_CAPPING: 'hlsFpsDropLevelCapping',
  // Identifier for an error event - data: { type : error type, details : error details, fatal : if true, hls.js cannot/will not try to recover, if false, hls.js will try to recover,other error specific data}
  ERROR: 'hlsError',
  // fired when hls.js instance starts destroying. Different from MEDIA_DETACHED as one could want to detach and reattach a media to the instance of hls.js to handle mid-rolls for example
  DESTROYING: 'hlsDestroying',
  // fired when a decrypt key loading starts - data: { frag : fragment object}
  KEY_LOADING: 'hlsKeyLoading',
  // fired when a decrypt key loading is completed - data: { frag : fragment object, payload : key payload, stats : { trequest, tfirst, tload, length}}
  KEY_LOADED: 'hlsKeyLoaded',
  // fired upon stream controller state transitions - data: {previousState, nextState}
  STREAM_STATE_TRANSITION: 'hlsStreamStateTransition'
};

},{}],29:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 *  AAC helper
 */

var AAC = function () {
  function AAC() {
    _classCallCheck(this, AAC);
  }

  _createClass(AAC, null, [{
    key: 'getSilentFrame',
    value: function getSilentFrame(codec, channelCount) {
      switch (codec) {
        case 'mp4a.40.2':
          if (channelCount === 1) {
            return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x23, 0x80]);
          } else if (channelCount === 2) {
            return new Uint8Array([0x21, 0x00, 0x49, 0x90, 0x02, 0x19, 0x00, 0x23, 0x80]);
          } else if (channelCount === 3) {
            return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x8e]);
          } else if (channelCount === 4) {
            return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x80, 0x2c, 0x80, 0x08, 0x02, 0x38]);
          } else if (channelCount === 5) {
            return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x82, 0x30, 0x04, 0x99, 0x00, 0x21, 0x90, 0x02, 0x38]);
          } else if (channelCount === 6) {
            return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x82, 0x30, 0x04, 0x99, 0x00, 0x21, 0x90, 0x02, 0x00, 0xb2, 0x00, 0x20, 0x08, 0xe0]);
          }
          break;
        // handle HE-AAC below (mp4a.40.5 / mp4a.40.29)
        default:
          if (channelCount === 1) {
            // ffmpeg -y -f lavfi -i "aevalsrc=0:d=0.05" -c:a libfdk_aac -profile:a aac_he -b:a 4k output.aac && hexdump -v -e '16/1 "0x%x," "\n"' -v output.aac
            return new Uint8Array([0x1, 0x40, 0x22, 0x80, 0xa3, 0x4e, 0xe6, 0x80, 0xba, 0x8, 0x0, 0x0, 0x0, 0x1c, 0x6, 0xf1, 0xc1, 0xa, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5e]);
          } else if (channelCount === 2) {
            // ffmpeg -y -f lavfi -i "aevalsrc=0|0:d=0.05" -c:a libfdk_aac -profile:a aac_he_v2 -b:a 4k output.aac && hexdump -v -e '16/1 "0x%x," "\n"' -v output.aac
            return new Uint8Array([0x1, 0x40, 0x22, 0x80, 0xa3, 0x5e, 0xe6, 0x80, 0xba, 0x8, 0x0, 0x0, 0x0, 0x0, 0x95, 0x0, 0x6, 0xf1, 0xa1, 0xa, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5e]);
          } else if (channelCount === 3) {
            // ffmpeg -y -f lavfi -i "aevalsrc=0|0|0:d=0.05" -c:a libfdk_aac -profile:a aac_he_v2 -b:a 4k output.aac && hexdump -v -e '16/1 "0x%x," "\n"' -v output.aac
            return new Uint8Array([0x1, 0x40, 0x22, 0x80, 0xa3, 0x5e, 0xe6, 0x80, 0xba, 0x8, 0x0, 0x0, 0x0, 0x0, 0x95, 0x0, 0x6, 0xf1, 0xa1, 0xa, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5e]);
          }
          break;
      }
      return null;
    }
  }]);

  return AAC;
}();

exports.default = AAC;

},{}],30:[function(_dereq_,module,exports){
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
    key: "isBuffered",
    value: function isBuffered(media, position) {
      if (media) {
        var buffered = media.buffered;
        for (var i = 0; i < buffered.length; i++) {
          if (position >= buffered.start(i) && position <= buffered.end(i)) {
            return true;
          }
        }
      }
      return false;
    }
  }, {
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
      return { len: bufferLen, start: bufferStart, end: bufferEnd, nextStart: bufferStartNext };
    }
  }]);

  return BufferHelper;
}();

exports.default = BufferHelper;

},{}],31:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Level Helper class, providing methods dealing with playlist sliding and drift
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     */

var _logger = _dereq_(45);

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
        if (newFrag && oldFrag) {
          ccOffset = oldFrag.cc - newFrag.cc;
          if (!isNaN(oldFrag.startPTS)) {
            newFrag.start = newFrag.startPTS = oldFrag.startPTS;
            newFrag.endPTS = oldFrag.endPTS;
            newFrag.duration = oldFrag.duration;
            PTSFrag = newFrag;
          }
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
        LevelHelper.updateFragPTSDTS(newDetails, PTSFrag.sn, PTSFrag.startPTS, PTSFrag.endPTS, PTSFrag.startDTS, PTSFrag.endDTS);
      } else {
        // ensure that delta is within oldfragments range
        // also adjust sliding in case delta is 0 (we could have old=[50-60] and new=old=[50-61])
        // in that case we also need to adjust start offset of all fragments
        if (delta >= 0 && delta < oldfragments.length) {
          // adjust start by sliding offset
          var sliding = oldfragments[delta].start;
          for (i = 0; i < newfragments.length; i++) {
            newfragments[i].start += sliding;
          }
        }
      }
      // if we are here, it means we have fragments overlapping between
      // old and new level. reliable PTS info is thus relying on old level
      newDetails.PTSKnown = oldDetails.PTSKnown;
      return;
    }
  }, {
    key: 'updateFragPTSDTS',
    value: function updateFragPTSDTS(details, sn, startPTS, endPTS, startDTS, endDTS) {
      var fragIdx, fragments, frag, i;
      // exit if sn out of range
      if (!details || sn < details.startSN || sn > details.endSN) {
        return 0;
      }
      fragIdx = sn - details.startSN;
      fragments = details.fragments;
      frag = fragments[fragIdx];
      if (!isNaN(frag.startPTS)) {
        // delta PTS between audio and video
        var deltaPTS = Math.abs(frag.startPTS - startPTS);
        if (isNaN(frag.deltaPTS)) {
          frag.deltaPTS = deltaPTS;
        } else {
          frag.deltaPTS = Math.max(deltaPTS, frag.deltaPTS);
        }
        startPTS = Math.min(startPTS, frag.startPTS);
        endPTS = Math.max(endPTS, frag.endPTS);
        startDTS = Math.min(startDTS, frag.startDTS);
        endDTS = Math.max(endDTS, frag.endDTS);
      }

      var drift = startPTS - frag.start;

      frag.start = frag.startPTS = startPTS;
      frag.endPTS = endPTS;
      frag.startDTS = startDTS;
      frag.endDTS = endDTS;
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
            _logger.logger.warn('negative duration computed for frag ' + fragFrom.sn + ',level ' + fragFrom.level + ', there should be some duration drift between playlist and fragment!');
          }
        } else {
          fragTo.duration = fragFrom.start - fragToPTS;
          if (fragTo.duration < 0) {
            _logger.logger.warn('negative duration computed for frag ' + fragTo.sn + ',level ' + fragTo.level + ', there should be some duration drift between playlist and fragment!');
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

},{"45":45}],32:[function(_dereq_,module,exports){
/**
 * HLS interface
 */
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
//import FetchLoader from './utils/fetch-loader';


var _events = _dereq_(28);

var _events2 = _interopRequireDefault(_events);

var _errors = _dereq_(26);

var _playlistLoader = _dereq_(36);

var _playlistLoader2 = _interopRequireDefault(_playlistLoader);

var _fragmentLoader = _dereq_(34);

var _fragmentLoader2 = _interopRequireDefault(_fragmentLoader);

var _abrController = _dereq_(4);

var _abrController2 = _interopRequireDefault(_abrController);

var _bufferController = _dereq_(7);

var _bufferController2 = _interopRequireDefault(_bufferController);

var _capLevelController = _dereq_(8);

var _capLevelController2 = _interopRequireDefault(_capLevelController);

var _audioStreamController = _dereq_(5);

var _audioStreamController2 = _interopRequireDefault(_audioStreamController);

var _streamController = _dereq_(12);

var _streamController2 = _interopRequireDefault(_streamController);

var _levelController = _dereq_(11);

var _levelController2 = _interopRequireDefault(_levelController);

var _timelineController = _dereq_(13);

var _timelineController2 = _interopRequireDefault(_timelineController);

var _fpsController = _dereq_(10);

var _fpsController2 = _interopRequireDefault(_fpsController);

var _audioTrackController = _dereq_(6);

var _audioTrackController2 = _interopRequireDefault(_audioTrackController);

var _logger = _dereq_(45);

var _xhrLoader = _dereq_(47);

var _xhrLoader2 = _interopRequireDefault(_xhrLoader);

var _events3 = _dereq_(1);

var _events4 = _interopRequireDefault(_events3);

var _keyLoader = _dereq_(35);

var _keyLoader2 = _interopRequireDefault(_keyLoader);

var _cues = _dereq_(43);

var _cues2 = _interopRequireDefault(_cues);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Hls = function () {
  _createClass(Hls, null, [{
    key: 'isSupported',
    value: function isSupported() {
      window.MediaSource = window.MediaSource || window.WebKitMediaSource;
      return window.MediaSource && typeof window.MediaSource.isTypeSupported === 'function' && window.MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E,mp4a.40.2"');
    }
  }, {
    key: 'version',
    get: function get() {
      // replaced with browserify-versionify transform
      return '0.6.20';
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
          startPosition: -1,
          defaultAudioCodec: undefined,
          debug: false,
          capLevelOnFPSDrop: false,
          capLevelToPlayerSize: false,
          initialLiveManifestSize: 1,
          maxBufferLength: 30,
          maxBufferSize: 60 * 1000 * 1000,
          maxBufferHole: 0.5,
          maxMaxBufferLength: 600,
          maxSeekHole: 2,
          lowBufferWatchdogPeriod: 0.5,
          highBufferWatchdogPeriod: 3,
          nudgeOffset: 0.1,
          nudgeMaxRetry: 3,
          maxFragLookUpTolerance: 0.2,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: Infinity,
          liveSyncDuration: undefined,
          liveMaxLatencyDuration: undefined,
          enableWorker: true,
          enableSoftwareAES: true,
          manifestLoadingTimeOut: 10000,
          manifestLoadingMaxRetry: 1,
          manifestLoadingRetryDelay: 1000,
          manifestLoadingMaxRetryTimeout: 64000,
          startLevel: undefined,
          levelLoadingTimeOut: 10000,
          levelLoadingMaxRetry: 4,
          levelLoadingRetryDelay: 1000,
          levelLoadingMaxRetryTimeout: 64000,
          fragLoadingTimeOut: 20000,
          fragLoadingMaxRetry: 6,
          fragLoadingRetryDelay: 1000,
          fragLoadingMaxRetryTimeout: 64000,
          fragLoadingLoopThreshold: 3,
          startFragPrefetch: false,
          fpsDroppedMonitoringPeriod: 5000,
          fpsDroppedMonitoringThreshold: 0.2,
          appendErrorMaxRetry: 3,
          loader: _xhrLoader2.default,
          //loader: FetchLoader,
          fLoader: undefined,
          pLoader: undefined,
          xhrSetup: undefined,
          fetchSetup: undefined,
          abrController: _abrController2.default,
          bufferController: _bufferController2.default,
          capLevelController: _capLevelController2.default,
          fpsController: _fpsController2.default,
          streamController: _streamController2.default,
          audioStreamController: _audioStreamController2.default,
          timelineController: _timelineController2.default,
          cueHandler: _cues2.default,
          enableCEA708Captions: true,
          enableMP2TPassThrough: false,
          stretchShortVideoTrack: false,
          forceKeyFrameOnDiscontinuity: true,
          abrEwmaFastLive: 3,
          abrEwmaSlowLive: 9,
          abrEwmaFastVoD: 3,
          abrEwmaSlowVoD: 9,
          abrEwmaDefaultEstimate: 5e5, // 500 kbps
          abrBandWidthFactor: 0.95,
          abrBandWidthUpFactor: 0.7,
          maxStarvationDelay: 4,
          maxLoadingDelay: 4,
          minAutoBitrate: 0
        };
      }
      return Hls.defaultConfig;
    },
    set: function set(defaultConfig) {
      Hls.defaultConfig = defaultConfig;
    }
  }]);

  function Hls() {
    var config = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

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
    this.fpsController = new config.fpsController(this);
    this.streamController = new config.streamController(this);
    this.audioStreamController = new config.audioStreamController(this);
    this.timelineController = new config.timelineController(this);
    this.audioTrackController = new _audioTrackController2.default(this);
    this.keyLoader = new _keyLoader2.default(this);
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
      this.abrController.destroy();
      this.bufferController.destroy();
      this.capLevelController.destroy();
      this.fpsController.destroy();
      this.streamController.destroy();
      this.audioStreamController.destroy();
      this.timelineController.destroy();
      this.audioTrackController.destroy();
      this.keyLoader.destroy();
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
      var startPosition = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : -1;

      _logger.logger.log('startLoad(' + startPosition + ')');
      this.levelController.startLoad();
      this.streamController.startLoad(startPosition);
      this.audioStreamController.startLoad(startPosition);
    }
  }, {
    key: 'stopLoad',
    value: function stopLoad() {
      _logger.logger.log('stopLoad');
      this.levelController.stopLoad();
      this.streamController.stopLoad();
      this.audioStreamController.stopLoad();
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
      return Math.max(this.levelController.firstLevel, this.abrController.minAutoLevel);
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

    /** get alternate audio tracks list from playlist **/

  }, {
    key: 'audioTracks',
    get: function get() {
      return this.audioTrackController.audioTracks;
    }

    /** get index of the selected audio track (index in audio track lists) **/

  }, {
    key: 'audioTrack',
    get: function get() {
      return this.audioTrackController.audioTrack;
    }

    /** select an audio track, based on its index in audio track lists**/
    ,
    set: function set(audioTrackId) {
      this.audioTrackController.audioTrack = audioTrackId;
    }
  }, {
    key: 'liveSyncPosition',
    get: function get() {
      return this.streamController.liveSyncPosition;
    }
  }]);

  return Hls;
}();

exports.default = Hls;

},{"1":1,"10":10,"11":11,"12":12,"13":13,"26":26,"28":28,"34":34,"35":35,"36":36,"4":4,"43":43,"45":45,"47":47,"5":5,"6":6,"7":7,"8":8}],33:[function(_dereq_,module,exports){
'use strict';

// This is mostly for support of the es6 module export
// syntax with the babel compiler, it looks like it doesnt support
// function exports like we are used to in node/commonjs
module.exports = _dereq_(32).default;

},{"32":32}],34:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = _dereq_(28);

var _events2 = _interopRequireDefault(_events);

var _eventHandler = _dereq_(27);

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _errors = _dereq_(26);

var _logger = _dereq_(45);

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

    var _this = _possibleConstructorReturn(this, (FragmentLoader.__proto__ || Object.getPrototypeOf(FragmentLoader)).call(this, hls, _events2.default.FRAG_LOADING));

    _this.loaders = {};
    return _this;
  }

  _createClass(FragmentLoader, [{
    key: 'destroy',
    value: function destroy() {
      var loaders = this.loaders;
      for (var loaderName in loaders) {
        var loader = loaders[loaderName];
        if (loader) {
          loader.destroy();
        }
      }
      this.loaders = {};
      _eventHandler2.default.prototype.destroy.call(this);
    }
  }, {
    key: 'onFragLoading',
    value: function onFragLoading(data) {
      var frag = data.frag,
          type = frag.type,
          loader = this.loaders[type],
          config = this.hls.config;

      frag.loaded = 0;
      if (loader) {
        _logger.logger.warn('abort previous fragment loader for type:' + type);
        loader.abort();
      }
      loader = this.loaders[type] = frag.loader = typeof config.fLoader !== 'undefined' ? new config.fLoader(config) : new config.loader(config);

      var loaderContext = void 0,
          loaderConfig = void 0,
          loaderCallbacks = void 0;
      loaderContext = { url: frag.url, frag: frag, responseType: 'arraybuffer', progressData: false };
      var start = frag.byteRangeStartOffset,
          end = frag.byteRangeEndOffset;
      if (!isNaN(start) && !isNaN(end)) {
        loaderContext.rangeStart = start;
        loaderContext.rangeEnd = end;
      }
      loaderConfig = { timeout: config.fragLoadingTimeOut, maxRetry: 0, retryDelay: 0, maxRetryDelay: config.fragLoadingMaxRetryTimeout };
      loaderCallbacks = { onSuccess: this.loadsuccess.bind(this), onError: this.loaderror.bind(this), onTimeout: this.loadtimeout.bind(this), onProgress: this.loadprogress.bind(this) };
      loader.load(loaderContext, loaderConfig, loaderCallbacks);
    }
  }, {
    key: 'loadsuccess',
    value: function loadsuccess(response, stats, context) {
      var payload = response.data,
          frag = context.frag;
      // detach fragment loader on load success
      frag.loader = undefined;
      this.loaders[frag.type] = undefined;
      this.hls.trigger(_events2.default.FRAG_LOADED, { payload: payload, frag: frag, stats: stats });
    }
  }, {
    key: 'loaderror',
    value: function loaderror(response, context) {
      var loader = context.loader;
      if (loader) {
        loader.abort();
      }
      this.loaders[context.type] = undefined;
      this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: _errors.ErrorDetails.FRAG_LOAD_ERROR, fatal: false, frag: context.frag, response: response });
    }
  }, {
    key: 'loadtimeout',
    value: function loadtimeout(stats, context) {
      var loader = context.loader;
      if (loader) {
        loader.abort();
      }
      this.loaders[context.type] = undefined;
      this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: _errors.ErrorDetails.FRAG_LOAD_TIMEOUT, fatal: false, frag: context.frag });
    }

    // data will be used for progressive parsing

  }, {
    key: 'loadprogress',
    value: function loadprogress(stats, context, data) {
      // jshint ignore:line
      var frag = context.frag;
      frag.loaded = stats.loaded;
      this.hls.trigger(_events2.default.FRAG_LOAD_PROGRESS, { frag: frag, stats: stats });
    }
  }]);

  return FragmentLoader;
}(_eventHandler2.default);

exports.default = FragmentLoader;

},{"26":26,"27":27,"28":28,"45":45}],35:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = _dereq_(28);

var _events2 = _interopRequireDefault(_events);

var _eventHandler = _dereq_(27);

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _errors = _dereq_(26);

var _logger = _dereq_(45);

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

    var _this = _possibleConstructorReturn(this, (KeyLoader.__proto__ || Object.getPrototypeOf(KeyLoader)).call(this, hls, _events2.default.KEY_LOADING));

    _this.loaders = {};
    _this.decryptkey = null;
    _this.decrypturl = null;
    return _this;
  }

  _createClass(KeyLoader, [{
    key: 'destroy',
    value: function destroy() {
      for (var loaderName in this.loaders) {
        var loader = this.loaders[loaderName];
        if (loader) {
          loader.destroy();
        }
      }
      this.loaders = {};
      _eventHandler2.default.prototype.destroy.call(this);
    }
  }, {
    key: 'onKeyLoading',
    value: function onKeyLoading(data) {
      var frag = data.frag,
          type = frag.type,
          loader = this.loaders[type],
          decryptdata = frag.decryptdata,
          uri = decryptdata.uri;
      // if uri is different from previous one or if decrypt key not retrieved yet
      if (uri !== this.decrypturl || this.decryptkey === null) {
        var config = this.hls.config;

        if (loader) {
          _logger.logger.warn('abort previous key loader for type:' + type);
          loader.abort();
        }
        frag.loader = this.loaders[type] = new config.loader(config);
        this.decrypturl = uri;
        this.decryptkey = null;

        var loaderContext = void 0,
            loaderConfig = void 0,
            loaderCallbacks = void 0;
        loaderContext = { url: uri, frag: frag, responseType: 'arraybuffer' };
        loaderConfig = { timeout: config.fragLoadingTimeOut, maxRetry: config.fragLoadingMaxRetry, retryDelay: config.fragLoadingRetryDelay, maxRetryDelay: config.fragLoadingMaxRetryTimeout };
        loaderCallbacks = { onSuccess: this.loadsuccess.bind(this), onError: this.loaderror.bind(this), onTimeout: this.loadtimeout.bind(this) };
        frag.loader.load(loaderContext, loaderConfig, loaderCallbacks);
      } else if (this.decryptkey) {
        // we already loaded this key, return it
        decryptdata.key = this.decryptkey;
        this.hls.trigger(_events2.default.KEY_LOADED, { frag: frag });
      }
    }
  }, {
    key: 'loadsuccess',
    value: function loadsuccess(response, stats, context) {
      var frag = context.frag;
      this.decryptkey = frag.decryptdata.key = new Uint8Array(response.data);
      // detach fragment loader on load success
      frag.loader = undefined;
      this.loaders[frag.type] = undefined;
      this.hls.trigger(_events2.default.KEY_LOADED, { frag: frag });
    }
  }, {
    key: 'loaderror',
    value: function loaderror(response, context) {
      var frag = context.frag,
          loader = frag.loader;
      if (loader) {
        loader.abort();
      }
      this.loaders[context.type] = undefined;
      this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: _errors.ErrorDetails.KEY_LOAD_ERROR, fatal: false, frag: frag, response: response });
    }
  }, {
    key: 'loadtimeout',
    value: function loadtimeout(stats, context) {
      var frag = context.frag,
          loader = frag.loader;
      if (loader) {
        loader.abort();
      }
      this.loaders[context.type] = undefined;
      this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: _errors.ErrorDetails.KEY_LOAD_TIMEOUT, fatal: false, frag: frag });
    }
  }]);

  return KeyLoader;
}(_eventHandler2.default);

exports.default = KeyLoader;

},{"26":26,"27":27,"28":28,"45":45}],36:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Playlist Loader
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     */

var _urlToolkit = _dereq_(2);

var _urlToolkit2 = _interopRequireDefault(_urlToolkit);

var _events = _dereq_(28);

var _events2 = _interopRequireDefault(_events);

var _eventHandler = _dereq_(27);

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _errors = _dereq_(26);

var _attrList = _dereq_(40);

var _attrList2 = _interopRequireDefault(_attrList);

var _logger = _dereq_(45);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// https://regex101.com is your friend
var MASTER_PLAYLIST_REGEX = /#EXT-X-STREAM-INF:([^\n\r]*)[\r\n]+([^\r\n]+)/g;
var MASTER_PLAYLIST_MEDIA_REGEX = /#EXT-X-MEDIA:(.*)/g;
var LEVEL_PLAYLIST_REGEX_FAST = /#EXTINF:(\d*(?:\.\d+)?)(?:,(.*))?|(?!#)(\S.+)|#EXT-X-BYTERANGE: *(.+)|#EXT-X-PROGRAM-DATE-TIME:(.+)|#.*/g;
var LEVEL_PLAYLIST_REGEX_SLOW = /(?:(?:#(EXTM3U))|(?:#EXT-X-(PLAYLIST-TYPE):(.+))|(?:#EXT-X-(MEDIA-SEQUENCE): *(\d+))|(?:#EXT-X-(TARGETDURATION): *(\d+))|(?:#EXT-X-(KEY):(.+))|(?:#EXT-X-(START):(.+))|(?:#EXT-X-(ENDLIST))|(?:#EXT-X-(DISCONTINUITY-SEQ)UENCE:(\d+))|(?:#EXT-X-(DIS)CONTINUITY))|(?:#EXT-X-(VERSION):(\d+))|(?:(#)(.*):(.*))|(?:(#)(.*))(?:.*)\r?\n?/;

var LevelKey = function () {
  function LevelKey() {
    _classCallCheck(this, LevelKey);

    this.method = null;
    this.key = null;
    this.iv = null;
    this._uri = null;
  }

  _createClass(LevelKey, [{
    key: 'uri',
    get: function get() {
      if (!this._uri && this.reluri) {
        this._uri = _urlToolkit2.default.buildAbsoluteURL(this.baseuri, this.reluri);
      }
      return this._uri;
    }
  }]);

  return LevelKey;
}();

var Fragment = function () {
  function Fragment() {
    _classCallCheck(this, Fragment);

    this._url = null;
    this._byteRange = null;
    this._decryptdata = null;
  }

  _createClass(Fragment, [{
    key: 'createInitializationVector',


    /**
     * Utility method for parseLevelPlaylist to create an initialization vector for a given segment
     * @returns {Uint8Array}
     */
    value: function createInitializationVector(segmentNumber) {
      var uint8View = new Uint8Array(16);

      for (var i = 12; i < 16; i++) {
        uint8View[i] = segmentNumber >> 8 * (15 - i) & 0xff;
      }

      return uint8View;
    }

    /**
     * Utility method for parseLevelPlaylist to get a fragment's decryption data from the currently parsed encryption key data
     * @param levelkey - a playlist's encryption info
     * @param segmentNumber - the fragment's segment number
     * @returns {*} - an object to be applied as a fragment's decryptdata
     */

  }, {
    key: 'fragmentDecryptdataFromLevelkey',
    value: function fragmentDecryptdataFromLevelkey(levelkey, segmentNumber) {
      var decryptdata = levelkey;

      if (levelkey && levelkey.method && levelkey.uri && !levelkey.iv) {
        decryptdata = new LevelKey();
        decryptdata.method = levelkey.method;
        decryptdata.baseuri = levelkey.baseuri;
        decryptdata.reluri = levelkey.reluri;
        decryptdata.iv = this.createInitializationVector(segmentNumber);
      }

      return decryptdata;
    }
  }, {
    key: 'cloneObj',
    value: function cloneObj(obj) {
      return JSON.parse(JSON.stringify(obj));
    }
  }, {
    key: 'url',
    get: function get() {
      if (!this._url && this.relurl) {
        this._url = _urlToolkit2.default.buildAbsoluteURL(this.baseurl, this.relurl);
      }
      return this._url;
    },
    set: function set(value) {
      this._url = value;
    }
  }, {
    key: 'programDateTime',
    get: function get() {
      if (!this._programDateTime && this.rawProgramDateTime) {
        this._programDateTime = new Date(Date.parse(this.rawProgramDateTime));
      }
      return this._programDateTime;
    }
  }, {
    key: 'byteRange',
    get: function get() {
      if (!this._byteRange) {
        var byteRange = this._byteRange = [];
        if (this.rawByteRange) {
          var params = this.rawByteRange.split('@', 2);
          if (params.length === 1) {
            var lastByteRangeEndOffset = this.lastByteRangeEndOffset;
            byteRange[0] = lastByteRangeEndOffset ? lastByteRangeEndOffset : 0;
          } else {
            byteRange[0] = parseInt(params[1]);
          }
          byteRange[1] = parseInt(params[0]) + byteRange[0];
        }
      }
      return this._byteRange;
    }
  }, {
    key: 'byteRangeStartOffset',
    get: function get() {
      return this.byteRange[0];
    }
  }, {
    key: 'byteRangeEndOffset',
    get: function get() {
      return this.byteRange[1];
    }
  }, {
    key: 'decryptdata',
    get: function get() {
      if (!this._decryptdata) {
        this._decryptdata = this.fragmentDecryptdataFromLevelkey(this.levelkey, this.sn);
      }
      return this._decryptdata;
    }
  }]);

  return Fragment;
}();

var PlaylistLoader = function (_EventHandler) {
  _inherits(PlaylistLoader, _EventHandler);

  function PlaylistLoader(hls) {
    _classCallCheck(this, PlaylistLoader);

    var _this = _possibleConstructorReturn(this, (PlaylistLoader.__proto__ || Object.getPrototypeOf(PlaylistLoader)).call(this, hls, _events2.default.MANIFEST_LOADING, _events2.default.LEVEL_LOADING, _events2.default.AUDIO_TRACK_LOADING));

    _this.loaders = {};
    return _this;
  }

  _createClass(PlaylistLoader, [{
    key: 'destroy',
    value: function destroy() {
      for (var loaderName in this.loaders) {
        var loader = this.loaders[loaderName];
        if (loader) {
          loader.destroy();
        }
      }
      this.loaders = {};
      _eventHandler2.default.prototype.destroy.call(this);
    }
  }, {
    key: 'onManifestLoading',
    value: function onManifestLoading(data) {
      this.load(data.url, { type: 'manifest' });
    }
  }, {
    key: 'onLevelLoading',
    value: function onLevelLoading(data) {
      this.load(data.url, { type: 'level', level: data.level, id: data.id });
    }
  }, {
    key: 'onAudioTrackLoading',
    value: function onAudioTrackLoading(data) {
      this.load(data.url, { type: 'audioTrack', id: data.id });
    }
  }, {
    key: 'load',
    value: function load(url, context) {
      var loader = this.loaders[context.type];
      if (loader) {
        var loaderContext = loader.context;
        if (loaderContext && loaderContext.url === url) {
          _logger.logger.trace('playlist request ongoing');
          return;
        } else {
          _logger.logger.warn('abort previous loader for type:' + context.type);
          loader.abort();
        }
      }
      var config = this.hls.config,
          retry = void 0,
          timeout = void 0,
          retryDelay = void 0,
          maxRetryDelay = void 0;
      if (context.type === 'manifest') {
        retry = config.manifestLoadingMaxRetry;
        timeout = config.manifestLoadingTimeOut;
        retryDelay = config.manifestLoadingRetryDelay;
        maxRetryDelay = config.manifestLoadingMaxRetryTimeout;
      } else {
        retry = config.levelLoadingMaxRetry;
        timeout = config.levelLoadingTimeOut;
        retryDelay = config.levelLoadingRetryDelay;
        maxRetryDelay = config.levelLoadingMaxRetryTimeout;
        _logger.logger.log('loading playlist for ' + context.type + ' ' + (context.level || context.id));
      }
      loader = this.loaders[context.type] = context.loader = typeof config.pLoader !== 'undefined' ? new config.pLoader(config) : new config.loader(config);
      context.url = url;
      context.responseType = '';

      var loaderConfig = void 0,
          loaderCallbacks = void 0;
      loaderConfig = { timeout: timeout, maxRetry: retry, retryDelay: retryDelay, maxRetryDelay: maxRetryDelay };
      loaderCallbacks = { onSuccess: this.loadsuccess.bind(this), onError: this.loaderror.bind(this), onTimeout: this.loadtimeout.bind(this) };
      loader.load(context, loaderConfig, loaderCallbacks);
    }
  }, {
    key: 'resolve',
    value: function resolve(url, baseUrl) {
      return _urlToolkit2.default.buildAbsoluteURL(baseUrl, url);
    }
  }, {
    key: 'parseMasterPlaylist',
    value: function parseMasterPlaylist(string, baseurl) {
      var levels = [],
          result = void 0;
      MASTER_PLAYLIST_REGEX.lastIndex = 0;
      while ((result = MASTER_PLAYLIST_REGEX.exec(string)) != null) {
        var level = {};

        var attrs = level.attrs = new _attrList2.default(result[1]);
        level.url = this.resolve(result[2], baseurl);

        var resolution = attrs.decimalResolution('RESOLUTION');
        if (resolution) {
          level.width = resolution.width;
          level.height = resolution.height;
        }
        level.bitrate = attrs.decimalInteger('AVERAGE-BANDWIDTH') || attrs.decimalInteger('BANDWIDTH');
        level.name = attrs.NAME;

        var codecs = attrs.CODECS;
        if (codecs) {
          codecs = codecs.split(/[ ,]+/);
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
    key: 'parseMasterPlaylistMedia',
    value: function parseMasterPlaylistMedia(string, baseurl, type) {
      var result = void 0,
          medias = [];
      MASTER_PLAYLIST_MEDIA_REGEX.lastIndex = 0;
      while ((result = MASTER_PLAYLIST_MEDIA_REGEX.exec(string)) != null) {
        var media = {};
        var attrs = new _attrList2.default(result[1]);
        if (attrs.TYPE === type) {
          media.groupId = attrs['GROUP-ID'];
          media.name = attrs.NAME;
          media.type = type;
          media.default = attrs.DEFAULT === 'YES';
          media.autoselect = attrs.AUTOSELECT === 'YES';
          media.forced = attrs.FORCED === 'YES';
          if (attrs.URI) {
            media.url = this.resolve(attrs.URI, baseurl);
          }
          media.lang = attrs.LANGUAGE;
          if (!media.name) {
            media.name = media.lang;
          }
          medias.push(media);
        }
      }
      return medias;
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
    key: 'parseLevelPlaylist',
    value: function parseLevelPlaylist(string, baseurl, id, type) {
      var currentSN = 0,
          totalduration = 0,
          level = { type: null, version: null, url: baseurl, fragments: [], live: true, startSN: 0 },
          levelkey = new LevelKey(),
          cc = 0,
          prevFrag = null,
          frag = new Fragment(),
          result,
          i;

      frag.tagList = [];

      LEVEL_PLAYLIST_REGEX_FAST.lastIndex = 0;

      while ((result = LEVEL_PLAYLIST_REGEX_FAST.exec(string)) !== null) {
        var duration = result[1];
        if (duration) {
          // INF
          frag.duration = parseFloat(duration);
          // avoid sliced strings    https://github.com/dailymotion/hls.js/issues/939
          var title = (' ' + result[2]).slice(1);
          frag.title = title ? title : null;
          frag.tagList.push(title ? ['INF', duration, title] : ['INF', duration]);
        } else if (result[3]) {
          // url
          if (!isNaN(frag.duration)) {
            var sn = currentSN++;
            frag.type = type;
            frag.start = totalduration;
            frag.levelkey = levelkey;
            frag.sn = sn;
            frag.level = id;
            frag.cc = cc;
            frag.baseurl = baseurl;
            // avoid sliced strings    https://github.com/dailymotion/hls.js/issues/939
            frag.relurl = (' ' + result[3]).slice(1);

            level.fragments.push(frag);
            prevFrag = frag;
            totalduration += frag.duration;

            frag = new Fragment();
            frag.tagList = [];
          }
        } else if (result[4]) {
          // X-BYTERANGE
          frag.rawByteRange = (' ' + result[4]).slice(1);
          if (prevFrag) {
            var lastByteRangeEndOffset = prevFrag.byteRangeEndOffset;
            if (lastByteRangeEndOffset) {
              frag.lastByteRangeEndOffset = lastByteRangeEndOffset;
            }
          }
        } else if (result[5]) {
          // PROGRAM-DATE-TIME
          // avoid sliced strings    https://github.com/dailymotion/hls.js/issues/939
          frag.rawProgramDateTime = (' ' + result[5]).slice(1);
          frag.tagList.push(['PROGRAM-DATE-TIME', frag.rawProgramDateTime]);
        } else {
          result = result[0].match(LEVEL_PLAYLIST_REGEX_SLOW);
          for (i = 1; i < result.length; i++) {
            if (result[i] !== undefined) {
              break;
            }
          }

          // avoid sliced strings    https://github.com/dailymotion/hls.js/issues/939
          var value1 = (' ' + result[i + 1]).slice(1);
          var value2 = (' ' + result[i + 2]).slice(1);

          switch (result[i]) {
            case '#':
              frag.tagList.push(value2 ? [value1, value2] : [value1]);
              break;
            case 'PLAYLIST-TYPE':
              level.type = value1.toUpperCase();
              break;
            case 'MEDIA-SEQUENCE':
              currentSN = level.startSN = parseInt(value1);
              break;
            case 'TARGETDURATION':
              level.targetduration = parseFloat(value1);
              break;
            case 'VERSION':
              level.version = parseInt(value1);
              break;
            case 'EXTM3U':
              break;
            case 'ENDLIST':
              level.live = false;
              break;
            case 'DIS':
              cc++;
              frag.tagList.push(['DIS']);
              break;
            case 'DISCONTINUITY-SEQ':
              cc = parseInt(value1);
              break;
            case 'KEY':
              // https://tools.ietf.org/html/draft-pantos-http-live-streaming-08#section-3.4.4
              var decryptparams = value1;
              var keyAttrs = new _attrList2.default(decryptparams);
              var decryptmethod = keyAttrs.enumeratedString('METHOD'),
                  decrypturi = keyAttrs.URI,
                  decryptiv = keyAttrs.hexadecimalInteger('IV');
              if (decryptmethod) {
                levelkey = new LevelKey();
                if (decrypturi && decryptmethod === 'AES-128') {
                  levelkey.method = decryptmethod;
                  // URI to get the key
                  levelkey.baseuri = baseurl;
                  levelkey.reluri = decrypturi;
                  levelkey.key = null;
                  // Initialization Vector (IV)
                  levelkey.iv = decryptiv;
                }
              }
              break;
            case 'START':
              var startParams = value1;
              var startAttrs = new _attrList2.default(startParams);
              var startTimeOffset = startAttrs.decimalFloatingPoint('TIME-OFFSET');
              //TIME-OFFSET can be 0
              if (!isNaN(startTimeOffset)) {
                level.startTimeOffset = startTimeOffset;
              }
              break;
            default:
              _logger.logger.warn('line parsed but not handled: ' + result);
              break;
          }
        }
      }
      frag = prevFrag;
      //logger.log('found ' + level.fragments.length + ' fragments');
      if (frag && !frag.relurl) {
        level.fragments.pop();
        totalduration -= frag.duration;
      }
      level.totalduration = totalduration;
      level.averagetargetduration = totalduration / level.fragments.length;
      level.endSN = currentSN - 1;
      return level;
    }
  }, {
    key: 'loadsuccess',
    value: function loadsuccess(response, stats, context) {
      var string = response.data,
          url = response.url,
          type = context.type,
          id = context.id,
          level = context.level,
          hls = this.hls;

      this.loaders[type] = undefined;
      // responseURL not supported on some browsers (it is used to detect URL redirection)
      // data-uri mode also not supported (but no need to detect redirection)
      if (url === undefined || url.indexOf('data:') === 0) {
        // fallback to initial URL
        url = context.url;
      }
      stats.tload = performance.now();
      //stats.mtime = new Date(target.getResponseHeader('Last-Modified'));
      if (string.indexOf('#EXTM3U') === 0) {
        if (string.indexOf('#EXTINF:') > 0) {
          var isLevel = type !== 'audioTrack',
              levelDetails = this.parseLevelPlaylist(string, url, (isLevel ? level : id) || 0, isLevel ? 'main' : 'audio');
          if (type === 'manifest') {
            // first request, stream manifest (no master playlist), fire manifest loaded event with level details
            hls.trigger(_events2.default.MANIFEST_LOADED, { levels: [{ url: url, details: levelDetails }], audioTracks: [], url: url, stats: stats });
          }
          stats.tparsed = performance.now();
          if (levelDetails.targetduration) {
            if (isLevel) {
              hls.trigger(_events2.default.LEVEL_LOADED, { details: levelDetails, level: level || 0, id: id || 0, stats: stats });
            } else {
              hls.trigger(_events2.default.AUDIO_TRACK_LOADED, { details: levelDetails, id: id, stats: stats });
            }
          } else {
            hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: _errors.ErrorDetails.MANIFEST_PARSING_ERROR, fatal: true, url: url, reason: 'invalid targetduration' });
          }
        } else {
          var levels = this.parseMasterPlaylist(string, url);
          // multi level playlist, parse level info
          if (levels.length) {
            var audiotracks = this.parseMasterPlaylistMedia(string, url, 'AUDIO');
            if (audiotracks.length) {
              // check if we have found an audio track embedded in main playlist (audio track without URI attribute)
              var embeddedAudioFound = false;
              audiotracks.forEach(function (audioTrack) {
                if (!audioTrack.url) {
                  embeddedAudioFound = true;
                }
              });
              // if no embedded audio track defined, but audio codec signaled in quality level, we need to signal this main audio track
              // this could happen with playlists with alt audio rendition in which quality levels (main) contains both audio+video. but with mixed audio track not signaled
              if (embeddedAudioFound === false && levels[0].audioCodec && !levels[0].attrs.AUDIO) {
                _logger.logger.log('audio codec signaled in quality level, but no embedded audio track signaled, create one');
                audiotracks.unshift({ type: 'main', name: 'main' });
              }
            }
            hls.trigger(_events2.default.MANIFEST_LOADED, { levels: levels, audioTracks: audiotracks, url: url, stats: stats });
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
    value: function loaderror(response, context) {
      var details,
          fatal,
          loader = context.loader;
      switch (context.type) {
        case 'manifest':
          details = _errors.ErrorDetails.MANIFEST_LOAD_ERROR;
          fatal = true;
          break;
        case 'level':
          details = _errors.ErrorDetails.LEVEL_LOAD_ERROR;
          fatal = false;
          break;
        case 'audioTrack':
          details = _errors.ErrorDetails.AUDIO_TRACK_LOAD_ERROR;
          fatal = false;
          break;
      }
      if (loader) {
        loader.abort();
        this.loaders[context.type] = undefined;
      }
      this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: details, fatal: fatal, url: loader.url, loader: loader, response: response, context: context });
    }
  }, {
    key: 'loadtimeout',
    value: function loadtimeout(stats, context) {
      var details,
          fatal,
          loader = context.loader;
      switch (context.type) {
        case 'manifest':
          details = _errors.ErrorDetails.MANIFEST_LOAD_TIMEOUT;
          fatal = true;
          break;
        case 'level':
          details = _errors.ErrorDetails.LEVEL_LOAD_TIMEOUT;
          fatal = false;
          break;
        case 'audioTrack':
          details = _errors.ErrorDetails.AUDIO_TRACK_LOAD_TIMEOUT;
          fatal = false;
          break;
      }
      if (loader) {
        loader.abort();
        this.loaders[context.type] = undefined;
      }
      this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: details, fatal: fatal, url: loader.url, loader: loader, context: context });
    }
  }]);

  return PlaylistLoader;
}(_eventHandler2.default);

exports.default = PlaylistLoader;

},{"2":2,"26":26,"27":27,"28":28,"40":40,"45":45}],37:[function(_dereq_,module,exports){
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
        '.mp3': [],
        mvex: [],
        mvhd: [],
        pasp: [],
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
          height = track.height,
          hSpacing = track.pixelRatio[0],
          vSpacing = track.pixelRatio[1];
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
      0x00, 0x2d, 0xc6, 0xc0])), // avgBitrate
      MP4.box(MP4.types.pasp, new Uint8Array([hSpacing >> 24, // hSpacing
      hSpacing >> 16 & 0xFF, hSpacing >> 8 & 0xFF, hSpacing & 0xFF, vSpacing >> 24, // vSpacing
      vSpacing >> 16 & 0xFF, vSpacing >> 8 & 0xFF, vSpacing & 0xFF])));
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
    key: 'mp3',
    value: function mp3(track) {
      var audiosamplerate = track.audiosamplerate;
      return MP4.box(MP4.types['.mp3'], new Uint8Array([0x00, 0x00, 0x00, // reserved
      0x00, 0x00, 0x00, // reserved
      0x00, 0x01, // data_reference_index
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // reserved
      0x00, track.channelCount, // channelcount
      0x00, 0x10, // sampleSize:16bits
      0x00, 0x00, 0x00, 0x00, // reserved2
      audiosamplerate >> 8 & 0xFF, audiosamplerate & 0xff, //
      0x00, 0x00]));
    }
  }, {
    key: 'stsd',
    value: function stsd(track) {
      if (track.type === 'audio') {
        if (!track.isAAC && track.codec === 'mp3') {
          return MP4.box(MP4.types.stsd, MP4.STSD, MP4.mp3(track));
        }
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
      id >> 24, id >> 16 & 0XFF, id >> 8 & 0XFF, id & 0xFF])), MP4.box(MP4.types.tfdt, new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x00, // flags
      baseMediaDecodeTime >> 24, baseMediaDecodeTime >> 16 & 0XFF, baseMediaDecodeTime >> 8 & 0XFF, baseMediaDecodeTime & 0xFF])), MP4.trun(track, sampleDependencyTable.length + 16 + // tfhd
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

},{}],38:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * fMP4 remuxer
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     */

var _aac = _dereq_(29);

var _aac2 = _interopRequireDefault(_aac);

var _events = _dereq_(28);

var _events2 = _interopRequireDefault(_events);

var _logger = _dereq_(45);

var _mp4Generator = _dereq_(37);

var _mp4Generator2 = _interopRequireDefault(_mp4Generator);

var _errors = _dereq_(26);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var MP4Remuxer = function () {
  function MP4Remuxer(observer, id, config, typeSupported) {
    _classCallCheck(this, MP4Remuxer);

    this.observer = observer;
    this.id = id;
    this.config = config;
    this.typeSupported = typeSupported;
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
      this._initPTS = this._initDTS = undefined;
    }
  }, {
    key: 'switchLevel',
    value: function switchLevel() {
      this.ISGenerated = false;
    }
  }, {
    key: 'remux',
    value: function remux(level, sn, cc, audioTrack, videoTrack, id3Track, textTrack, timeOffset, contiguous, accurateTimeOffset, defaultInitPTS) {
      this.level = level;
      this.sn = sn;
      // generate Init Segment if needed
      if (!this.ISGenerated) {
        this.generateIS(audioTrack, videoTrack, timeOffset, cc);
      }

      if (defaultInitPTS !== null) {
        this._initPTS = this._initDTS = defaultInitPTS;
      }

      if (this.ISGenerated) {
        // Purposefully remuxing audio before video, so that remuxVideo can use nextAudioPts, which is
        // calculated in remuxAudio.
        //logger.log('nb AAC samples:' + audioTrack.samples.length);
        if (audioTrack.samples.length) {
          var audioData = this.remuxAudio(audioTrack, timeOffset, contiguous, accurateTimeOffset);
          //logger.log('nb AVC samples:' + videoTrack.samples.length);
          if (videoTrack.samples.length) {
            var audioTrackLength = void 0;
            if (audioData) {
              audioTrackLength = audioData.endPTS - audioData.startPTS;
            }
            this.remuxVideo(videoTrack, timeOffset, contiguous, audioTrackLength);
          }
        } else {
          var videoData = void 0;
          //logger.log('nb AVC samples:' + videoTrack.samples.length);
          if (videoTrack.samples.length) {
            videoData = this.remuxVideo(videoTrack, timeOffset, contiguous);
          }
          if (videoData && audioTrack.codec) {
            this.remuxEmptyAudio(audioTrack, timeOffset, contiguous, videoData);
          }
        }
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
      this.observer.trigger(_events2.default.FRAG_PARSED, { id: this.id, level: this.level, sn: this.sn });
    }
  }, {
    key: 'generateIS',
    value: function generateIS(audioTrack, videoTrack, timeOffset, cc) {
      var observer = this.observer,
          audioSamples = audioTrack.samples,
          videoSamples = videoTrack.samples,
          pesTimeScale = this.PES_TIMESCALE,
          typeSupported = this.typeSupported,
          container = 'audio/mp4',
          tracks = {},
          data = { id: this.id, level: this.level, sn: this.sn, tracks: tracks, unique: false },
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
            audioTrack.timescale = audioTrack.audiosamplerate / greatestCommonDivisor(audioTrack.audiosamplerate, audioTrack.isAAC ? 1024 : 1152);
          })();
        }
        _logger.logger.log('audio mp4 timescale :' + audioTrack.timescale);
        if (!audioTrack.isAAC) {
          if (typeSupported.mpeg) {
            // Chrome and Safari
            container = 'audio/mpeg';
            audioTrack.codec = '';
          } else if (typeSupported.mp3) {
            // Firefox
            audioTrack.codec = 'mp3';
          }
        }
        tracks.audio = {
          container: container,
          codec: audioTrack.codec,
          initSegment: !audioTrack.isAAC && typeSupported.mpeg ? new Uint8Array() : _mp4Generator2.default.initSegment([audioTrack]),
          metadata: {
            channelCount: audioTrack.channelCount
          }
        };
        if (computePTSDTS) {
          // remember first PTS of this demuxing context. for audio, PTS = DTS
          initPTS = initDTS = audioSamples[0].pts - pesTimeScale * timeOffset;
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
          this.observer.trigger(_events2.default.INIT_PTS_FOUND, { id: this.id, initPTS: initPTS, cc: cc });
        }
      }

      if (Object.keys(tracks).length) {
        observer.trigger(_events2.default.FRAG_PARSING_INIT_SEGMENT, data);
        this.ISGenerated = true;
        if (computePTSDTS) {
          this._initPTS = initPTS;
          this._initDTS = initDTS;
        }
      } else {
        observer.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, id: this.id, details: _errors.ErrorDetails.FRAG_PARSING_ERROR, fatal: false, reason: 'no audio/video samples found' });
      }
    }
  }, {
    key: 'remuxVideo',
    value: function remuxVideo(track, timeOffset, contiguous, audioTrackLength) {
      var offset = 8,
          pesTimeScale = this.PES_TIMESCALE,
          pes2mp4ScaleFactor = this.PES2MP4SCALEFACTOR,
          mp4SampleDuration,
          mdat,
          moof,
          firstPTS,
          firstDTS,
          nextDTS,
          lastPTS,
          lastDTS,
          inputSamples = track.samples,
          outputSamples = [],
          nbSamples = inputSamples.length,
          ptsNormalize = this._PTSNormalize,
          initDTS = this._initDTS;

      // for (let i = 0; i < track.samples.length; i++) {
      //   let avcSample = track.samples[i];
      //   let units = avcSample.units.units;
      //   let unitsString = '';
      //   for (let j = 0; j < units.length ; j++) {
      //     unitsString += units[j].type + ',';
      //     if (units[j].data.length < 500) {
      //       unitsString += Hex.hexDump(units[j].data);
      //     }
      //   }
      //   logger.log(avcSample.pts + '/' + avcSample.dts + ',' + unitsString + avcSample.units.length);
      // }

      // sort video samples by DTS then PTS order
      inputSamples.sort(function (a, b) {
        var deltadts = a.dts - b.dts;
        return deltadts ? deltadts : a.pts - b.pts;
      });

      // handle broken streams with PTS < DTS, tolerance up 200ms (18000 in 90kHz timescale)
      var PTSDTSshift = inputSamples.reduce(function (prev, curr) {
        return Math.max(Math.min(prev, curr.pts - curr.dts), -18000);
      }, 0);
      if (PTSDTSshift < 0) {
        _logger.logger.warn('PTS < DTS detected in video samples, shifting DTS by ' + Math.round(PTSDTSshift / 90) + ' ms to overcome this issue');
        for (var i = 0; i < inputSamples.length; i++) {
          inputSamples[i].dts += PTSDTSshift;
        }
      }

      // PTS is coded on 33bits, and can loop from -2^32 to 2^32
      // ptsNormalize will make PTS/DTS value monotonic, we use last known DTS value as reference value
      var nextAvcDts = void 0;
      // contiguous fragments are consecutive fragments from same quality level (same level, new SN = old SN + 1)
      if (contiguous) {
        // if parsed fragment is contiguous with last one, let's use last DTS value as reference
        nextAvcDts = this.nextAvcDts;
      } else {
        // if not contiguous, let's use target timeOffset
        nextAvcDts = timeOffset * pesTimeScale;
      }

      // compute first DTS and last DTS, normalize them against reference value
      var sample = inputSamples[0];
      firstDTS = Math.max(ptsNormalize(sample.dts - initDTS, nextAvcDts), 0);
      firstPTS = Math.max(ptsNormalize(sample.pts - initDTS, nextAvcDts), 0);

      // check timestamp continuity accross consecutive fragments (this is to remove inter-fragment gap/hole)
      var delta = Math.round((firstDTS - nextAvcDts) / 90);
      // if fragment are contiguous, detect hole/overlapping between fragments
      if (contiguous) {
        if (delta) {
          if (delta > 1) {
            _logger.logger.log('AVC:' + delta + ' ms hole between fragments detected,filling it');
          } else if (delta < -1) {
            _logger.logger.log('AVC:' + -delta + ' ms overlapping between fragments detected');
          }
          // remove hole/gap : set DTS to next expected DTS
          firstDTS = nextAvcDts;
          inputSamples[0].dts = firstDTS + initDTS;
          // offset PTS as well, ensure that PTS is smaller or equal than new DTS
          firstPTS = Math.max(firstPTS - delta, nextAvcDts);
          inputSamples[0].pts = firstPTS + initDTS;
          _logger.logger.log('Video/PTS/DTS adjusted: ' + Math.round(firstPTS / 90) + '/' + Math.round(firstDTS / 90) + ',delta:' + delta + ' ms');
        }
      }
      nextDTS = firstDTS;

      // compute lastPTS/lastDTS
      sample = inputSamples[inputSamples.length - 1];
      lastDTS = Math.max(ptsNormalize(sample.dts - initDTS, nextAvcDts), 0);
      lastPTS = Math.max(ptsNormalize(sample.pts - initDTS, nextAvcDts), 0);
      lastPTS = Math.max(lastPTS, lastDTS);

      var vendor = navigator.vendor,
          userAgent = navigator.userAgent,
          isSafari = vendor && vendor.indexOf('Apple') > -1 && userAgent && !userAgent.match('CriOS');

      // on Safari let's signal the same sample duration for all samples
      // sample duration (as expected by trun MP4 boxes), should be the delta between sample DTS
      // set this constant duration as being the avg delta between consecutive DTS.
      if (isSafari) {
        mp4SampleDuration = Math.round((lastDTS - firstDTS) / (pes2mp4ScaleFactor * (inputSamples.length - 1)));
      }

      // normalize all PTS/DTS now ...
      for (var _i = 0; _i < nbSamples; _i++) {
        var _sample = inputSamples[_i];
        if (isSafari) {
          // sample DTS is computed using a constant decoding offset (mp4SampleDuration) between samples
          _sample.dts = firstDTS + _i * pes2mp4ScaleFactor * mp4SampleDuration;
        } else {
          // ensure sample monotonic DTS
          _sample.dts = Math.max(ptsNormalize(_sample.dts - initDTS, nextAvcDts), firstDTS);
          // ensure dts is a multiple of scale factor to avoid rounding issues
          _sample.dts = Math.round(_sample.dts / pes2mp4ScaleFactor) * pes2mp4ScaleFactor;
        }
        // we normalize PTS against nextAvcDts, we also substract initDTS (some streams don't start @ PTS O)
        // and we ensure that computed value is greater or equal than sample DTS
        _sample.pts = Math.max(ptsNormalize(_sample.pts - initDTS, nextAvcDts), _sample.dts);
        // ensure pts is a multiple of scale factor to avoid rounding issues
        _sample.pts = Math.round(_sample.pts / pes2mp4ScaleFactor) * pes2mp4ScaleFactor;
      }

      /* concatenate the video data and construct the mdat in place
        (need 8 more bytes to fill length and mpdat type) */
      var mdatSize = track.len + 4 * track.nbNalu + 8;
      try {
        mdat = new Uint8Array(mdatSize);
      } catch (err) {
        this.observer.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MUX_ERROR, level: this.level, id: this.id, details: _errors.ErrorDetails.REMUX_ALLOC_ERROR, fatal: false, bytes: mdatSize, reason: 'fail allocating video mdat ' + mdatSize });
        return;
      }
      var view = new DataView(mdat.buffer);
      view.setUint32(0, mdatSize);
      mdat.set(_mp4Generator2.default.types.mdat, 4);

      for (var _i2 = 0; _i2 < nbSamples; _i2++) {
        var avcSample = inputSamples[_i2],
            avcSampleUnits = avcSample.units.units,
            mp4SampleLength = 0,
            compositionTimeOffset = void 0;
        // convert NALU bitstream to MP4 format (prepend NALU with size field)
        for (var j = 0, nbUnits = avcSampleUnits.length; j < nbUnits; j++) {
          var unit = avcSampleUnits[j],
              unitData = unit.data,
              unitDataLen = unit.data.byteLength;
          view.setUint32(offset, unitDataLen);
          offset += 4;
          mdat.set(unitData, offset);
          offset += unitDataLen;
          mp4SampleLength += 4 + unitDataLen;
        }

        if (!isSafari) {
          // expected sample duration is the Decoding Timestamp diff of consecutive samples
          if (_i2 < nbSamples - 1) {
            mp4SampleDuration = inputSamples[_i2 + 1].dts - avcSample.dts;
          } else {
            var config = this.config,
                lastFrameDuration = avcSample.dts - inputSamples[_i2 > 0 ? _i2 - 1 : _i2].dts;
            if (config.stretchShortVideoTrack) {
              // In some cases, a segment's audio track duration may exceed the video track duration.
              // Since we've already remuxed audio, and we know how long the audio track is, we look to
              // see if the delta to the next segment is longer than the minimum of maxBufferHole and
              // maxSeekHole. If so, playback would potentially get stuck, so we artificially inflate
              // the duration of the last frame to minimize any potential gap between segments.
              var maxBufferHole = config.maxBufferHole,
                  maxSeekHole = config.maxSeekHole,
                  gapTolerance = Math.floor(Math.min(maxBufferHole, maxSeekHole) * pesTimeScale),
                  deltaToFrameEnd = (audioTrackLength ? firstPTS + audioTrackLength * pesTimeScale : this.nextAudioPts) - avcSample.pts;
              if (deltaToFrameEnd > gapTolerance) {
                // We subtract lastFrameDuration from deltaToFrameEnd to try to prevent any video
                // frame overlap. maxBufferHole/maxSeekHole should be >> lastFrameDuration anyway.
                mp4SampleDuration = deltaToFrameEnd - lastFrameDuration;
                if (mp4SampleDuration < 0) {
                  mp4SampleDuration = lastFrameDuration;
                }
                _logger.logger.log('It is approximately ' + deltaToFrameEnd / 90 + ' ms to the next segment; using duration ' + mp4SampleDuration / 90 + ' ms for the last video frame.');
              } else {
                mp4SampleDuration = lastFrameDuration;
              }
            } else {
              mp4SampleDuration = lastFrameDuration;
            }
          }
          mp4SampleDuration /= pes2mp4ScaleFactor;
          compositionTimeOffset = Math.round((avcSample.pts - avcSample.dts) / pes2mp4ScaleFactor);
        } else {
          compositionTimeOffset = Math.max(0, mp4SampleDuration * Math.round((avcSample.pts - avcSample.dts) / (pes2mp4ScaleFactor * mp4SampleDuration)));
        }

        //console.log('PTS/DTS/initDTS/normPTS/normDTS/relative PTS : ${avcSample.pts}/${avcSample.dts}/${initDTS}/${ptsnorm}/${dtsnorm}/${(avcSample.pts/4294967296).toFixed(3)}');
        outputSamples.push({
          size: mp4SampleLength,
          // constant duration
          duration: mp4SampleDuration,
          cts: compositionTimeOffset,
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
      var dropped = track.dropped;
      track.len = 0;
      track.nbNalu = 0;
      track.dropped = 0;
      if (outputSamples.length && navigator.userAgent.toLowerCase().indexOf('chrome') > -1) {
        var flags = outputSamples[0].flags;
        // chrome workaround, mark first sample as being a Random Access Point to avoid sourcebuffer append issue
        // https://code.google.com/p/chromium/issues/detail?id=229412
        flags.dependsOn = 2;
        flags.isNonSync = 0;
      }
      track.samples = outputSamples;
      moof = _mp4Generator2.default.moof(track.sequenceNumber++, firstDTS / pes2mp4ScaleFactor, track);
      track.samples = [];

      var data = {
        id: this.id,
        level: this.level,
        sn: this.sn,
        data1: moof,
        data2: mdat,
        startPTS: firstPTS / pesTimeScale,
        endPTS: (lastPTS + pes2mp4ScaleFactor * mp4SampleDuration) / pesTimeScale,
        startDTS: firstDTS / pesTimeScale,
        endDTS: this.nextAvcDts / pesTimeScale,
        type: 'video',
        nb: outputSamples.length,
        dropped: dropped
      };
      this.observer.trigger(_events2.default.FRAG_PARSING_DATA, data);
      return data;
    }
  }, {
    key: 'remuxAudio',
    value: function remuxAudio(track, timeOffset, contiguous, accurateTimeOffset) {
      var pesTimeScale = this.PES_TIMESCALE,
          mp4timeScale = track.timescale,
          pes2mp4ScaleFactor = pesTimeScale / mp4timeScale,
          expectedSampleDuration = track.timescale * (track.isAAC ? 1024 : 1152) / track.audiosamplerate,
          pesFrameDuration = expectedSampleDuration * pes2mp4ScaleFactor,
          ptsNormalize = this._PTSNormalize,
          initDTS = this._initDTS,
          rawMPEG = !track.isAAC && this.typeSupported.mpeg;

      var view,
          offset = rawMPEG ? 0 : 8,
          audioSample,
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
          outputSamples = [],
          inputSamples = [],
          fillFrame,
          newStamp,
          nextAudioPts;

      track.samples.sort(function (a, b) {
        return a.pts - b.pts;
      });
      inputSamples = track.samples;

      // for audio samples, also consider consecutive fragments as being contiguous (even if a level switch occurs),
      // for sake of clarity:
      // consecutive fragments are frags with
      //  - less than 100ms gaps between new time offset and next expected PTS OR
      //  - less than 20 audio frames distance
      // contiguous fragments are consecutive fragments from same quality level (same level, new SN = old SN + 1)
      // this helps ensuring audio continuity
      // and this also avoids audio glitches/cut when switching quality, or reporting wrong duration on first audio frame

      nextAudioPts = this.nextAudioPts;
      contiguous |= inputSamples.length && nextAudioPts && (Math.abs(timeOffset - nextAudioPts / pesTimeScale) < 0.1 || Math.abs(inputSamples[0].pts - nextAudioPts - this._initDTS) < 20 * pesFrameDuration);

      if (!contiguous) {
        // if fragments are not contiguous, let's use timeOffset to compute next Audio PTS
        nextAudioPts = timeOffset * pesTimeScale;
      }
      // If the audio track is missing samples, the frames seem to get "left-shifted" within the
      // resulting mp4 segment, causing sync issues and leaving gaps at the end of the audio segment.
      // In an effort to prevent this from happening, we inject frames here where there are gaps.
      // When possible, we inject a silent frame; when that's not possible, we duplicate the last
      // frame.

      // only inject/drop audio frames in case time offset is accurate
      if (accurateTimeOffset && track.isAAC) {
        for (var i = 0, nextPtsNorm = nextAudioPts; i < inputSamples.length;) {
          // First, let's see how far off this frame is from where we expect it to be
          var sample = inputSamples[i],
              ptsNorm = ptsNormalize(sample.pts - initDTS, nextAudioPts),
              delta = ptsNorm - nextPtsNorm;

          // If we're overlapping by more than a duration, drop this sample
          if (delta <= -pesFrameDuration) {
            _logger.logger.warn('Dropping 1 audio frame @ ' + Math.round(nextPtsNorm / 90) / 1000 + 's due to ' + Math.round(Math.abs(delta / 90)) + ' ms overlap.');
            inputSamples.splice(i, 1);
            track.len -= sample.unit.length;
            // Don't touch nextPtsNorm or i
          }
          // Otherwise, if we're more than a frame away from where we should be, insert missing frames
          // also only inject silent audio frames if currentTime !== 0 (nextPtsNorm !== 0)
          else if (delta >= pesFrameDuration && nextPtsNorm) {
              var missing = Math.round(delta / pesFrameDuration);
              _logger.logger.warn('Injecting ' + missing + ' audio frame @ ' + Math.round(nextPtsNorm / 90) / 1000 + 's due to ' + Math.round(delta / 90) + ' ms gap.');
              for (var j = 0; j < missing; j++) {
                newStamp = nextPtsNorm + initDTS;
                newStamp = Math.max(newStamp, initDTS);
                fillFrame = _aac2.default.getSilentFrame(track.manifestCodec || track.codec, track.channelCount);
                if (!fillFrame) {
                  _logger.logger.log('Unable to get silent frame for given audio codec; duplicating last frame instead.');
                  fillFrame = sample.unit.subarray();
                }
                inputSamples.splice(i, 0, { unit: fillFrame, pts: newStamp, dts: newStamp });
                track.len += fillFrame.length;
                nextPtsNorm += pesFrameDuration;
                i += 1;
              }

              // Adjust sample to next expected pts
              sample.pts = sample.dts = nextPtsNorm + initDTS;
              nextPtsNorm += pesFrameDuration;
              i += 1;
            }
            // Otherwise, we're within half a frame duration, so just adjust pts
            else {
                if (Math.abs(delta) > 0.1 * pesFrameDuration) {
                  //logger.log(`Invalid frame delta ${Math.round(ptsNorm - nextPtsNorm + pesFrameDuration)} at PTS ${Math.round(ptsNorm / 90)} (should be ${Math.round(pesFrameDuration)}).`);
                }
                nextPtsNorm += pesFrameDuration;
                if (i === 0) {
                  sample.pts = sample.dts = initDTS + nextAudioPts;
                } else {
                  sample.pts = sample.dts = inputSamples[i - 1].pts + pesFrameDuration;
                }
                i += 1;
              }
        }
      }

      for (var _j = 0, _nbSamples = inputSamples.length; _j < _nbSamples; _j++) {
        audioSample = inputSamples[_j];
        unit = audioSample.unit;
        pts = audioSample.pts - initDTS;
        dts = audioSample.dts - initDTS;
        //logger.log(`Audio/PTS:${Math.round(pts/90)}`);
        // if not first sample
        if (lastDTS !== undefined) {
          ptsnorm = ptsNormalize(pts, lastDTS);
          dtsnorm = ptsNormalize(dts, lastDTS);
          mp4Sample.duration = Math.round((dtsnorm - lastDTS) / pes2mp4ScaleFactor);
        } else {
          ptsnorm = ptsNormalize(pts, nextAudioPts);
          dtsnorm = ptsNormalize(dts, nextAudioPts);
          var _delta = Math.round(1000 * (ptsnorm - nextAudioPts) / pesTimeScale),
              numMissingFrames = 0;
          // if fragment are contiguous, detect hole/overlapping between fragments
          // contiguous fragments are consecutive fragments from same quality level (same level, new SN = old SN + 1)
          if (contiguous && track.isAAC) {
            // log delta
            if (_delta) {
              if (_delta > 0) {
                numMissingFrames = Math.round((ptsnorm - nextAudioPts) / pesFrameDuration);
                _logger.logger.log(_delta + ' ms hole between AAC samples detected,filling it');
                if (numMissingFrames > 0) {
                  fillFrame = _aac2.default.getSilentFrame(track.manifestCodec || track.codec, track.channelCount);
                  if (!fillFrame) {
                    fillFrame = unit.subarray();
                  }
                  track.len += numMissingFrames * fillFrame.length;
                }
                // if we have frame overlap, overlapping for more than half a frame duraion
              } else if (_delta < -12) {
                // drop overlapping audio frames... browser will deal with it
                _logger.logger.log(-_delta + ' ms overlapping between AAC samples detected, drop frame');
                track.len -= unit.byteLength;
                continue;
              }
              // set PTS/DTS to expected PTS/DTS
              ptsnorm = dtsnorm = nextAudioPts;
            }
          }
          // remember first PTS of our audioSamples, ensure value is positive
          firstPTS = Math.max(0, ptsnorm);
          firstDTS = Math.max(0, dtsnorm);
          if (track.len > 0) {
            /* concatenate the audio data and construct the mdat in place
              (need 8 more bytes to fill length and mdat type) */

            var mdatSize = rawMPEG ? track.len : track.len + 8;
            try {
              mdat = new Uint8Array(mdatSize);
            } catch (err) {
              this.observer.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MUX_ERROR, level: this.level, id: this.id, details: _errors.ErrorDetails.REMUX_ALLOC_ERROR, fatal: false, bytes: mdatSize, reason: 'fail allocating audio mdat ' + mdatSize });
              return;
            }
            if (!rawMPEG) {
              view = new DataView(mdat.buffer);
              view.setUint32(0, mdatSize);
              mdat.set(_mp4Generator2.default.types.mdat, 4);
            }
          } else {
            // no audio samples
            return;
          }
          for (var _i3 = 0; _i3 < numMissingFrames; _i3++) {
            newStamp = ptsnorm - (numMissingFrames - _i3) * pesFrameDuration;
            fillFrame = _aac2.default.getSilentFrame(track.manifestCodec || track.codec, track.channelCount);
            if (!fillFrame) {
              _logger.logger.log('Unable to get silent frame for given audio codec; duplicating this frame instead.');
              fillFrame = unit.subarray();
            }
            mdat.set(fillFrame, offset);
            offset += fillFrame.byteLength;
            mp4Sample = {
              size: fillFrame.byteLength,
              cts: 0,
              duration: 1024,
              flags: {
                isLeading: 0,
                isDependedOn: 0,
                hasRedundancy: 0,
                degradPrio: 0,
                dependsOn: 1
              }
            };
            outputSamples.push(mp4Sample);
          }
        }
        mdat.set(unit, offset);
        var unitLen = unit.byteLength;
        offset += unitLen;
        //console.log('PTS/DTS/initDTS/normPTS/normDTS/relative PTS : ${audioSample.pts}/${audioSample.dts}/${initDTS}/${ptsnorm}/${dtsnorm}/${(audioSample.pts/4294967296).toFixed(3)}');
        mp4Sample = {
          size: unitLen,
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
        outputSamples.push(mp4Sample);
        lastDTS = dtsnorm;
      }
      var lastSampleDuration = 0;
      var nbSamples = outputSamples.length;
      //set last sample duration as being identical to previous sample
      if (nbSamples >= 2) {
        lastSampleDuration = outputSamples[nbSamples - 2].duration;
        mp4Sample.duration = lastSampleDuration;
      }
      if (nbSamples) {
        // next audio sample PTS should be equal to last sample PTS + duration
        this.nextAudioPts = ptsnorm + pes2mp4ScaleFactor * lastSampleDuration;
        //logger.log('Audio/PTS/PTSend:' + audioSample.pts.toFixed(0) + '/' + this.nextAacDts.toFixed(0));
        track.len = 0;
        track.samples = outputSamples;
        if (rawMPEG) {
          moof = new Uint8Array();
        } else {
          moof = _mp4Generator2.default.moof(track.sequenceNumber++, firstDTS / pes2mp4ScaleFactor, track);
        }
        track.samples = [];
        var audioData = {
          id: this.id,
          level: this.level,
          sn: this.sn,
          data1: moof,
          data2: mdat,
          startPTS: firstPTS / pesTimeScale,
          endPTS: this.nextAudioPts / pesTimeScale,
          startDTS: firstDTS / pesTimeScale,
          endDTS: (dtsnorm + pes2mp4ScaleFactor * lastSampleDuration) / pesTimeScale,
          type: 'audio',
          nb: nbSamples
        };
        this.observer.trigger(_events2.default.FRAG_PARSING_DATA, audioData);
        return audioData;
      }
      return null;
    }
  }, {
    key: 'remuxEmptyAudio',
    value: function remuxEmptyAudio(track, timeOffset, contiguous, videoData) {
      var pesTimeScale = this.PES_TIMESCALE,
          mp4timeScale = track.timescale ? track.timescale : track.audiosamplerate,
          pes2mp4ScaleFactor = pesTimeScale / mp4timeScale,
          nextAudioPts = this.nextAudioPts,


      // sync with video's timestamp
      startDTS = (nextAudioPts !== undefined ? nextAudioPts : videoData.startDTS * pesTimeScale) + this._initDTS,
          endDTS = videoData.endDTS * pesTimeScale + this._initDTS,

      // one sample's duration value
      sampleDuration = 1024,
          frameDuration = pes2mp4ScaleFactor * sampleDuration,


      // samples count of this segment's duration
      nbSamples = Math.ceil((endDTS - startDTS) / frameDuration),


      // silent frame
      silentFrame = _aac2.default.getSilentFrame(track.manifestCodec || track.codec, track.channelCount);

      _logger.logger.warn('remux empty Audio');
      // Can't remux if we can't generate a silent frame...
      if (!silentFrame) {
        _logger.logger.trace('Unable to remuxEmptyAudio since we were unable to get a silent frame for given audio codec!');
        return;
      }

      var samples = [];
      for (var i = 0; i < nbSamples; i++) {
        var stamp = startDTS + i * frameDuration;
        samples.push({ unit: silentFrame, pts: stamp, dts: stamp });
        track.len += silentFrame.length;
      }
      track.samples = samples;

      this.remuxAudio(track, timeOffset, contiguous);
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
          id: this.id,
          level: this.level,
          sn: this.sn,
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
          id: this.id,
          level: this.level,
          sn: this.sn,
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

},{"26":26,"28":28,"29":29,"37":37,"45":45}],39:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * passthrough remuxer
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     */


var _events = _dereq_(28);

var _events2 = _interopRequireDefault(_events);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var PassThroughRemuxer = function () {
  function PassThroughRemuxer(observer, id) {
    _classCallCheck(this, PassThroughRemuxer);

    this.observer = observer;
    this.id = id;
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
            data = { id: this.id, tracks: tracks, unique: true },
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
        id: this.id,
        data1: rawData,
        startPTS: timeOffset,
        startDTS: timeOffset,
        type: 'audiovideo',
        nb: 1,
        dropped: 0
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

},{"28":28}],40:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var DECIMAL_RESOLUTION_REGEX = /^(\d+)x(\d+)$/;
var ATTR_LIST_REGEX = /\s*(.+?)\s*=((?:\".*?\")|.*?)(?:,|$)/g;

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
      var res = DECIMAL_RESOLUTION_REGEX.exec(this[attrName]);
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
      var match,
          attrs = {};
      ATTR_LIST_REGEX.lastIndex = 0;
      while ((match = ATTR_LIST_REGEX.exec(input)) !== null) {
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

},{}],41:[function(_dereq_,module,exports){
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

},{}],42:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 *
 * This code was ported from the dash.js project at:
 *   https://github.com/Dash-Industry-Forum/dash.js/blob/development/externals/cea608-parser.js
 *   https://github.com/Dash-Industry-Forum/dash.js/commit/8269b26a761e0853bb21d78780ed945144ecdd4d#diff-71bc295a2d6b6b7093a1d3290d53a4b2
 *
 * The original copyright appears below:
 *
 * The copyright in this software is being made available under the BSD License,
 * included below. This software may be subject to other third party and contributor
 * rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2015-2016, DASH Industry Forum.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *  1. Redistributions of source code must retain the above copyright notice, this
 *  list of conditions and the following disclaimer.
 *  * Redistributions in binary form must reproduce the above copyright notice,
 *  this list of conditions and the following disclaimer in the documentation and/or
 *  other materials provided with the distribution.
 *  2. Neither the name of Dash Industry Forum nor the names of its
 *  contributors may be used to endorse or promote products derived from this software
 *  without specific prior written permission.
 *
 *  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS AS IS AND ANY
 *  EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 *  WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
 *  IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
 *  INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT
 *  NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 *  PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 *  WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 *  ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 *  POSSIBILITY OF SUCH DAMAGE.
 */
/**
 *  Exceptions from regular ASCII. CodePoints are mapped to UTF-16 codes
 */

var specialCea608CharsCodes = {
    0x2a: 0xe1, // lowercase a, acute accent
    0x5c: 0xe9, // lowercase e, acute accent
    0x5e: 0xed, // lowercase i, acute accent
    0x5f: 0xf3, // lowercase o, acute accent
    0x60: 0xfa, // lowercase u, acute accent
    0x7b: 0xe7, // lowercase c with cedilla
    0x7c: 0xf7, // division symbol
    0x7d: 0xd1, // uppercase N tilde
    0x7e: 0xf1, // lowercase n tilde
    0x7f: 0x2588, // Full block
    // THIS BLOCK INCLUDES THE 16 EXTENDED (TWO-BYTE) LINE 21 CHARACTERS
    // THAT COME FROM HI BYTE=0x11 AND LOW BETWEEN 0x30 AND 0x3F
    // THIS MEANS THAT \x50 MUST BE ADDED TO THE VALUES
    0x80: 0xae, // Registered symbol (R)
    0x81: 0xb0, // degree sign
    0x82: 0xbd, // 1/2 symbol
    0x83: 0xbf, // Inverted (open) question mark
    0x84: 0x2122, // Trademark symbol (TM)
    0x85: 0xa2, // Cents symbol
    0x86: 0xa3, // Pounds sterling
    0x87: 0x266a, // Music 8'th note
    0x88: 0xe0, // lowercase a, grave accent
    0x89: 0x20, // transparent space (regular)
    0x8a: 0xe8, // lowercase e, grave accent
    0x8b: 0xe2, // lowercase a, circumflex accent
    0x8c: 0xea, // lowercase e, circumflex accent
    0x8d: 0xee, // lowercase i, circumflex accent
    0x8e: 0xf4, // lowercase o, circumflex accent
    0x8f: 0xfb, // lowercase u, circumflex accent
    // THIS BLOCK INCLUDES THE 32 EXTENDED (TWO-BYTE) LINE 21 CHARACTERS
    // THAT COME FROM HI BYTE=0x12 AND LOW BETWEEN 0x20 AND 0x3F
    0x90: 0xc1, // capital letter A with acute
    0x91: 0xc9, // capital letter E with acute
    0x92: 0xd3, // capital letter O with acute
    0x93: 0xda, // capital letter U with acute
    0x94: 0xdc, // capital letter U with diaresis
    0x95: 0xfc, // lowercase letter U with diaeresis
    0x96: 0x2018, // opening single quote
    0x97: 0xa1, // inverted exclamation mark
    0x98: 0x2a, // asterisk
    0x99: 0x2019, // closing single quote
    0x9a: 0x2501, // box drawings heavy horizontal
    0x9b: 0xa9, // copyright sign
    0x9c: 0x2120, // Service mark
    0x9d: 0x2022, // (round) bullet
    0x9e: 0x201c, // Left double quotation mark
    0x9f: 0x201d, // Right double quotation mark
    0xa0: 0xc0, // uppercase A, grave accent
    0xa1: 0xc2, // uppercase A, circumflex
    0xa2: 0xc7, // uppercase C with cedilla
    0xa3: 0xc8, // uppercase E, grave accent
    0xa4: 0xca, // uppercase E, circumflex
    0xa5: 0xcb, // capital letter E with diaresis
    0xa6: 0xeb, // lowercase letter e with diaresis
    0xa7: 0xce, // uppercase I, circumflex
    0xa8: 0xcf, // uppercase I, with diaresis
    0xa9: 0xef, // lowercase i, with diaresis
    0xaa: 0xd4, // uppercase O, circumflex
    0xab: 0xd9, // uppercase U, grave accent
    0xac: 0xf9, // lowercase u, grave accent
    0xad: 0xdb, // uppercase U, circumflex
    0xae: 0xab, // left-pointing double angle quotation mark
    0xaf: 0xbb, // right-pointing double angle quotation mark
    // THIS BLOCK INCLUDES THE 32 EXTENDED (TWO-BYTE) LINE 21 CHARACTERS
    // THAT COME FROM HI BYTE=0x13 AND LOW BETWEEN 0x20 AND 0x3F
    0xb0: 0xc3, // Uppercase A, tilde
    0xb1: 0xe3, // Lowercase a, tilde
    0xb2: 0xcd, // Uppercase I, acute accent
    0xb3: 0xcc, // Uppercase I, grave accent
    0xb4: 0xec, // Lowercase i, grave accent
    0xb5: 0xd2, // Uppercase O, grave accent
    0xb6: 0xf2, // Lowercase o, grave accent
    0xb7: 0xd5, // Uppercase O, tilde
    0xb8: 0xf5, // Lowercase o, tilde
    0xb9: 0x7b, // Open curly brace
    0xba: 0x7d, // Closing curly brace
    0xbb: 0x5c, // Backslash
    0xbc: 0x5e, // Caret
    0xbd: 0x5f, // Underscore
    0xbe: 0x7c, // Pipe (vertical line)
    0xbf: 0x223c, // Tilde operator
    0xc0: 0xc4, // Uppercase A, umlaut
    0xc1: 0xe4, // Lowercase A, umlaut
    0xc2: 0xd6, // Uppercase O, umlaut
    0xc3: 0xf6, // Lowercase o, umlaut
    0xc4: 0xdf, // Esszett (sharp S)
    0xc5: 0xa5, // Yen symbol
    0xc6: 0xa4, // Generic currency sign
    0xc7: 0x2503, // Box drawings heavy vertical
    0xc8: 0xc5, // Uppercase A, ring
    0xc9: 0xe5, // Lowercase A, ring
    0xca: 0xd8, // Uppercase O, stroke
    0xcb: 0xf8, // Lowercase o, strok
    0xcc: 0x250f, // Box drawings heavy down and right
    0xcd: 0x2513, // Box drawings heavy down and left
    0xce: 0x2517, // Box drawings heavy up and right
    0xcf: 0x251b // Box drawings heavy up and left
};

/**
 * Utils
 */
var getCharForByte = function getCharForByte(byte) {
    var charCode = byte;
    if (specialCea608CharsCodes.hasOwnProperty(byte)) {
        charCode = specialCea608CharsCodes[byte];
    }
    return String.fromCharCode(charCode);
};

var NR_ROWS = 15,
    NR_COLS = 32;
// Tables to look up row from PAC data
var rowsLowCh1 = { 0x11: 1, 0x12: 3, 0x15: 5, 0x16: 7, 0x17: 9, 0x10: 11, 0x13: 12, 0x14: 14 };
var rowsHighCh1 = { 0x11: 2, 0x12: 4, 0x15: 6, 0x16: 8, 0x17: 10, 0x13: 13, 0x14: 15 };
var rowsLowCh2 = { 0x19: 1, 0x1A: 3, 0x1D: 5, 0x1E: 7, 0x1F: 9, 0x18: 11, 0x1B: 12, 0x1C: 14 };
var rowsHighCh2 = { 0x19: 2, 0x1A: 4, 0x1D: 6, 0x1E: 8, 0x1F: 10, 0x1B: 13, 0x1C: 15 };

var backgroundColors = ['white', 'green', 'blue', 'cyan', 'red', 'yellow', 'magenta', 'black', 'transparent'];

/**
 * Simple logger class to be able to write with time-stamps and filter on level.
 */
var logger = {
    verboseFilter: { 'DATA': 3, 'DEBUG': 3, 'INFO': 2, 'WARNING': 2, 'TEXT': 1, 'ERROR': 0 },
    time: null,
    verboseLevel: 0, // Only write errors
    setTime: function setTime(newTime) {
        this.time = newTime;
    },
    log: function log(severity, msg) {
        var minLevel = this.verboseFilter[severity];
        if (this.verboseLevel >= minLevel) {
            console.log(this.time + ' [' + severity + '] ' + msg);
        }
    }
};

var numArrayToHexArray = function numArrayToHexArray(numArray) {
    var hexArray = [];
    for (var j = 0; j < numArray.length; j++) {
        hexArray.push(numArray[j].toString(16));
    }
    return hexArray;
};

var PenState = function () {
    function PenState(foreground, underline, italics, background, flash) {
        _classCallCheck(this, PenState);

        this.foreground = foreground || 'white';
        this.underline = underline || false;
        this.italics = italics || false;
        this.background = background || 'black';
        this.flash = flash || false;
    }

    _createClass(PenState, [{
        key: 'reset',
        value: function reset() {
            this.foreground = 'white';
            this.underline = false;
            this.italics = false;
            this.background = 'black';
            this.flash = false;
        }
    }, {
        key: 'setStyles',
        value: function setStyles(styles) {
            var attribs = ['foreground', 'underline', 'italics', 'background', 'flash'];
            for (var i = 0; i < attribs.length; i++) {
                var style = attribs[i];
                if (styles.hasOwnProperty(style)) {
                    this[style] = styles[style];
                }
            }
        }
    }, {
        key: 'isDefault',
        value: function isDefault() {
            return this.foreground === 'white' && !this.underline && !this.italics && this.background === 'black' && !this.flash;
        }
    }, {
        key: 'equals',
        value: function equals(other) {
            return this.foreground === other.foreground && this.underline === other.underline && this.italics === other.italics && this.background === other.background && this.flash === other.flash;
        }
    }, {
        key: 'copy',
        value: function copy(newPenState) {
            this.foreground = newPenState.foreground;
            this.underline = newPenState.underline;
            this.italics = newPenState.italics;
            this.background = newPenState.background;
            this.flash = newPenState.flash;
        }
    }, {
        key: 'toString',
        value: function toString() {
            return 'color=' + this.foreground + ', underline=' + this.underline + ', italics=' + this.italics + ', background=' + this.background + ', flash=' + this.flash;
        }
    }]);

    return PenState;
}();

/**
 * Unicode character with styling and background.
 * @constructor
 */


var StyledUnicodeChar = function () {
    function StyledUnicodeChar(uchar, foreground, underline, italics, background, flash) {
        _classCallCheck(this, StyledUnicodeChar);

        this.uchar = uchar || ' '; // unicode character
        this.penState = new PenState(foreground, underline, italics, background, flash);
    }

    _createClass(StyledUnicodeChar, [{
        key: 'reset',
        value: function reset() {
            this.uchar = ' ';
            this.penState.reset();
        }
    }, {
        key: 'setChar',
        value: function setChar(uchar, newPenState) {
            this.uchar = uchar;
            this.penState.copy(newPenState);
        }
    }, {
        key: 'setPenState',
        value: function setPenState(newPenState) {
            this.penState.copy(newPenState);
        }
    }, {
        key: 'equals',
        value: function equals(other) {
            return this.uchar === other.uchar && this.penState.equals(other.penState);
        }
    }, {
        key: 'copy',
        value: function copy(newChar) {
            this.uchar = newChar.uchar;
            this.penState.copy(newChar.penState);
        }
    }, {
        key: 'isEmpty',
        value: function isEmpty() {
            return this.uchar === ' ' && this.penState.isDefault();
        }
    }]);

    return StyledUnicodeChar;
}();

/**
 * CEA-608 row consisting of NR_COLS instances of StyledUnicodeChar.
 * @constructor
 */


var Row = function () {
    function Row() {
        _classCallCheck(this, Row);

        this.chars = [];
        for (var i = 0; i < NR_COLS; i++) {
            this.chars.push(new StyledUnicodeChar());
        }
        this.pos = 0;
        this.currPenState = new PenState();
    }

    _createClass(Row, [{
        key: 'equals',
        value: function equals(other) {
            var equal = true;
            for (var i = 0; i < NR_COLS; i++) {
                if (!this.chars[i].equals(other.chars[i])) {
                    equal = false;
                    break;
                }
            }
            return equal;
        }
    }, {
        key: 'copy',
        value: function copy(other) {
            for (var i = 0; i < NR_COLS; i++) {
                this.chars[i].copy(other.chars[i]);
            }
        }
    }, {
        key: 'isEmpty',
        value: function isEmpty() {
            var empty = true;
            for (var i = 0; i < NR_COLS; i++) {
                if (!this.chars[i].isEmpty()) {
                    empty = false;
                    break;
                }
            }
            return empty;
        }

        /**
         *  Set the cursor to a valid column.
         */

    }, {
        key: 'setCursor',
        value: function setCursor(absPos) {
            if (this.pos !== absPos) {
                this.pos = absPos;
            }
            if (this.pos < 0) {
                logger.log('ERROR', 'Negative cursor position ' + this.pos);
                this.pos = 0;
            } else if (this.pos > NR_COLS) {
                logger.log('ERROR', 'Too large cursor position ' + this.pos);
                this.pos = NR_COLS;
            }
        }

        /**
         * Move the cursor relative to current position.
         */

    }, {
        key: 'moveCursor',
        value: function moveCursor(relPos) {
            var newPos = this.pos + relPos;
            if (relPos > 1) {
                for (var i = this.pos + 1; i < newPos + 1; i++) {
                    this.chars[i].setPenState(this.currPenState);
                }
            }
            this.setCursor(newPos);
        }

        /**
         * Backspace, move one step back and clear character.
         */

    }, {
        key: 'backSpace',
        value: function backSpace() {
            this.moveCursor(-1);
            this.chars[this.pos].setChar(' ', this.currPenState);
        }
    }, {
        key: 'insertChar',
        value: function insertChar(byte) {
            if (byte >= 0x90) {
                //Extended char
                this.backSpace();
            }
            var char = getCharForByte(byte);
            if (this.pos >= NR_COLS) {
                logger.log('ERROR', 'Cannot insert ' + byte.toString(16) + ' (' + char + ') at position ' + this.pos + '. Skipping it!');
                return;
            }
            this.chars[this.pos].setChar(char, this.currPenState);
            this.moveCursor(1);
        }
    }, {
        key: 'clearFromPos',
        value: function clearFromPos(startPos) {
            var i;
            for (i = startPos; i < NR_COLS; i++) {
                this.chars[i].reset();
            }
        }
    }, {
        key: 'clear',
        value: function clear() {
            this.clearFromPos(0);
            this.pos = 0;
            this.currPenState.reset();
        }
    }, {
        key: 'clearToEndOfRow',
        value: function clearToEndOfRow() {
            this.clearFromPos(this.pos);
        }
    }, {
        key: 'getTextString',
        value: function getTextString() {
            var chars = [];
            var empty = true;
            for (var i = 0; i < NR_COLS; i++) {
                var char = this.chars[i].uchar;
                if (char !== ' ') {
                    empty = false;
                }
                chars.push(char);
            }
            if (empty) {
                return '';
            } else {
                return chars.join('');
            }
        }
    }, {
        key: 'setPenStyles',
        value: function setPenStyles(styles) {
            this.currPenState.setStyles(styles);
            var currChar = this.chars[this.pos];
            currChar.setPenState(this.currPenState);
        }
    }]);

    return Row;
}();

/**
 * Keep a CEA-608 screen of 32x15 styled characters
 * @constructor
*/


var CaptionScreen = function () {
    function CaptionScreen() {
        _classCallCheck(this, CaptionScreen);

        this.rows = [];
        for (var i = 0; i < NR_ROWS; i++) {
            this.rows.push(new Row()); // Note that we use zero-based numbering (0-14)
        }
        this.currRow = NR_ROWS - 1;
        this.nrRollUpRows = null;
        this.reset();
    }

    _createClass(CaptionScreen, [{
        key: 'reset',
        value: function reset() {
            for (var i = 0; i < NR_ROWS; i++) {
                this.rows[i].clear();
            }
            this.currRow = NR_ROWS - 1;
        }
    }, {
        key: 'equals',
        value: function equals(other) {
            var equal = true;
            for (var i = 0; i < NR_ROWS; i++) {
                if (!this.rows[i].equals(other.rows[i])) {
                    equal = false;
                    break;
                }
            }
            return equal;
        }
    }, {
        key: 'copy',
        value: function copy(other) {
            for (var i = 0; i < NR_ROWS; i++) {
                this.rows[i].copy(other.rows[i]);
            }
        }
    }, {
        key: 'isEmpty',
        value: function isEmpty() {
            var empty = true;
            for (var i = 0; i < NR_ROWS; i++) {
                if (!this.rows[i].isEmpty()) {
                    empty = false;
                    break;
                }
            }
            return empty;
        }
    }, {
        key: 'backSpace',
        value: function backSpace() {
            var row = this.rows[this.currRow];
            row.backSpace();
        }
    }, {
        key: 'clearToEndOfRow',
        value: function clearToEndOfRow() {
            var row = this.rows[this.currRow];
            row.clearToEndOfRow();
        }

        /**
         * Insert a character (without styling) in the current row.
         */

    }, {
        key: 'insertChar',
        value: function insertChar(char) {
            var row = this.rows[this.currRow];
            row.insertChar(char);
        }
    }, {
        key: 'setPen',
        value: function setPen(styles) {
            var row = this.rows[this.currRow];
            row.setPenStyles(styles);
        }
    }, {
        key: 'moveCursor',
        value: function moveCursor(relPos) {
            var row = this.rows[this.currRow];
            row.moveCursor(relPos);
        }
    }, {
        key: 'setCursor',
        value: function setCursor(absPos) {
            logger.log('INFO', 'setCursor: ' + absPos);
            var row = this.rows[this.currRow];
            row.setCursor(absPos);
        }
    }, {
        key: 'setPAC',
        value: function setPAC(pacData, lastOutputScreen) {
            logger.log('INFO', 'pacData = ' + JSON.stringify(pacData));
            var newRow = pacData.row - 1;
            if (this.nrRollUpRows && newRow < this.nrRollUpRows - 1) {
                newRow = this.nrRollUpRows - 1;
            }

            //Make sure this only affects Roll-up Captions by checking this.nrRollUpRows
            if (this.nrRollUpRows && this.currRow !== newRow) {
                //clear all rows first
                for (var i = 0; i < NR_ROWS; i++) {
                    this.rows[i].clear();
                }

                //Copy this.nrRollUpRows rows from lastOutputScreen and place it in the newRow location
                //topRowIndex - the start of rows to copy (inclusive index)
                var topRowIndex = this.currRow + 1 - this.nrRollUpRows;
                //We only copy if the last position was already shown.
                //We use the cueStartTime value to check this.
                var prevLineTime = lastOutputScreen.rows[topRowIndex].cueStartTime;
                if (prevLineTime && prevLineTime < logger.time) {
                    for (i = 0; i < this.nrRollUpRows; i++) {
                        this.rows[newRow - this.nrRollUpRows + i + 1].copy(lastOutputScreen.rows[topRowIndex + i]);
                    }
                }
            }

            this.currRow = newRow;
            var row = this.rows[this.currRow];
            if (pacData.indent !== null) {
                var indent = pacData.indent;
                var prevPos = Math.max(indent - 1, 0);
                row.setCursor(pacData.indent);
                pacData.color = row.chars[prevPos].penState.foreground;
            }
            var styles = { foreground: pacData.color, underline: pacData.underline, italics: pacData.italics, background: 'black', flash: false };
            this.setPen(styles);
        }

        /**
         * Set background/extra foreground, but first do back_space, and then insert space (backwards compatibility).
         */

    }, {
        key: 'setBkgData',
        value: function setBkgData(bkgData) {

            logger.log('INFO', 'bkgData = ' + JSON.stringify(bkgData));
            this.backSpace();
            this.setPen(bkgData);
            this.insertChar(0x20); //Space
        }
    }, {
        key: 'setRollUpRows',
        value: function setRollUpRows(nrRows) {
            this.nrRollUpRows = nrRows;
        }
    }, {
        key: 'rollUp',
        value: function rollUp() {
            if (this.nrRollUpRows === null) {
                logger.log('DEBUG', 'roll_up but nrRollUpRows not set yet');
                return; //Not properly setup
            }
            logger.log('TEXT', this.getDisplayText());
            var topRowIndex = this.currRow + 1 - this.nrRollUpRows;
            var topRow = this.rows.splice(topRowIndex, 1)[0];
            topRow.clear();
            this.rows.splice(this.currRow, 0, topRow);
            logger.log('INFO', 'Rolling up');
            //logger.log('TEXT', this.get_display_text())
        }

        /**
         * Get all non-empty rows with as unicode text.
         */

    }, {
        key: 'getDisplayText',
        value: function getDisplayText(asOneRow) {
            asOneRow = asOneRow || false;
            var displayText = [];
            var text = '';
            var rowNr = -1;
            for (var i = 0; i < NR_ROWS; i++) {
                var rowText = this.rows[i].getTextString();
                if (rowText) {
                    rowNr = i + 1;
                    if (asOneRow) {
                        displayText.push('Row ' + rowNr + ': \'' + rowText + '\'');
                    } else {
                        displayText.push(rowText.trim());
                    }
                }
            }
            if (displayText.length > 0) {
                if (asOneRow) {
                    text = '[' + displayText.join(' | ') + ']';
                } else {
                    text = displayText.join('\n');
                }
            }
            return text;
        }
    }, {
        key: 'getTextAndFormat',
        value: function getTextAndFormat() {
            return this.rows;
        }
    }]);

    return CaptionScreen;
}();

//var modes = ['MODE_ROLL-UP', 'MODE_POP-ON', 'MODE_PAINT-ON', 'MODE_TEXT'];

var Cea608Channel = function () {
    function Cea608Channel(channelNumber, outputFilter) {
        _classCallCheck(this, Cea608Channel);

        this.chNr = channelNumber;
        this.outputFilter = outputFilter;
        this.mode = null;
        this.verbose = 0;
        this.displayedMemory = new CaptionScreen();
        this.nonDisplayedMemory = new CaptionScreen();
        this.lastOutputScreen = new CaptionScreen();
        this.currRollUpRow = this.displayedMemory.rows[NR_ROWS - 1];
        this.writeScreen = this.displayedMemory;
        this.mode = null;
        this.cueStartTime = null; // Keeps track of where a cue started.
    }

    _createClass(Cea608Channel, [{
        key: 'reset',
        value: function reset() {
            this.mode = null;
            this.displayedMemory.reset();
            this.nonDisplayedMemory.reset();
            this.lastOutputScreen.reset();
            this.currRollUpRow = this.displayedMemory.rows[NR_ROWS - 1];
            this.writeScreen = this.displayedMemory;
            this.mode = null;
            this.cueStartTime = null;
            this.lastCueEndTime = null;
        }
    }, {
        key: 'getHandler',
        value: function getHandler() {
            return this.outputFilter;
        }
    }, {
        key: 'setHandler',
        value: function setHandler(newHandler) {
            this.outputFilter = newHandler;
        }
    }, {
        key: 'setPAC',
        value: function setPAC(pacData) {
            this.writeScreen.setPAC(pacData, this.lastOutputScreen);
        }
    }, {
        key: 'setBkgData',
        value: function setBkgData(bkgData) {
            this.writeScreen.setBkgData(bkgData);
        }
    }, {
        key: 'setMode',
        value: function setMode(newMode) {
            if (newMode === this.mode) {
                return;
            }
            this.mode = newMode;
            logger.log('INFO', 'MODE=' + newMode);
            if (this.mode === 'MODE_POP-ON') {
                this.writeScreen = this.nonDisplayedMemory;
            } else {
                this.writeScreen = this.displayedMemory;
                this.writeScreen.reset();
                this.lastOutputScreen.reset();
            }
            if (this.mode !== 'MODE_ROLL-UP') {
                this.displayedMemory.nrRollUpRows = null;
                this.nonDisplayedMemory.nrRollUpRows = null;
            }
            this.mode = newMode;
        }
    }, {
        key: 'insertChars',
        value: function insertChars(chars) {
            for (var i = 0; i < chars.length; i++) {
                this.writeScreen.insertChar(chars[i]);
            }
            var screen = this.writeScreen === this.displayedMemory ? 'DISP' : 'NON_DISP';
            logger.log('INFO', screen + ': ' + this.writeScreen.getDisplayText(true));
            if (this.mode === 'MODE_PAINT-ON' || this.mode === 'MODE_ROLL-UP') {
                logger.log('TEXT', 'DISPLAYED: ' + this.displayedMemory.getDisplayText(true));
                this.outputDataUpdate();
            }
        }
    }, {
        key: 'ccRCL',
        value: function ccRCL() {
            // Resume Caption Loading (switch mode to Pop On)
            logger.log('INFO', 'RCL - Resume Caption Loading');
            this.setMode('MODE_POP-ON');
        }
    }, {
        key: 'ccBS',
        value: function ccBS() {
            // BackSpace
            logger.log('INFO', 'BS - BackSpace');
            if (this.mode === 'MODE_TEXT') {
                return;
            }
            this.writeScreen.backSpace();
            if (this.writeScreen === this.displayedMemory) {
                this.outputDataUpdate();
            }
        }
    }, {
        key: 'ccAOF',
        value: function ccAOF() {
            // Reserved (formerly Alarm Off)
            return;
        }
    }, {
        key: 'ccAON',
        value: function ccAON() {
            // Reserved (formerly Alarm On)
            return;
        }
    }, {
        key: 'ccDER',
        value: function ccDER() {
            // Delete to End of Row
            logger.log('INFO', 'DER- Delete to End of Row');
            this.writeScreen.clearToEndOfRow();
            this.outputDataUpdate();
        }
    }, {
        key: 'ccRU',
        value: function ccRU(nrRows) {
            //Roll-Up Captions-2,3,or 4 Rows
            logger.log('INFO', 'RU(' + nrRows + ') - Roll Up');
            this.writeScreen = this.displayedMemory;
            this.setMode('MODE_ROLL-UP');
            this.writeScreen.setRollUpRows(nrRows);
        }
    }, {
        key: 'ccFON',
        value: function ccFON() {
            //Flash On
            logger.log('INFO', 'FON - Flash On');
            this.writeScreen.setPen({ flash: true });
        }
    }, {
        key: 'ccRDC',
        value: function ccRDC() {
            // Resume Direct Captioning (switch mode to PaintOn)
            logger.log('INFO', 'RDC - Resume Direct Captioning');
            this.setMode('MODE_PAINT-ON');
        }
    }, {
        key: 'ccTR',
        value: function ccTR() {
            // Text Restart in text mode (not supported, however)
            logger.log('INFO', 'TR');
            this.setMode('MODE_TEXT');
        }
    }, {
        key: 'ccRTD',
        value: function ccRTD() {
            // Resume Text Display in Text mode (not supported, however)
            logger.log('INFO', 'RTD');
            this.setMode('MODE_TEXT');
        }
    }, {
        key: 'ccEDM',
        value: function ccEDM() {
            // Erase Displayed Memory
            logger.log('INFO', 'EDM - Erase Displayed Memory');
            this.displayedMemory.reset();
            this.outputDataUpdate();
        }
    }, {
        key: 'ccCR',
        value: function ccCR() {
            // Carriage Return
            logger.log('CR - Carriage Return');
            this.writeScreen.rollUp();
            this.outputDataUpdate();
        }
    }, {
        key: 'ccENM',
        value: function ccENM() {
            //Erase Non-Displayed Memory
            logger.log('INFO', 'ENM - Erase Non-displayed Memory');
            this.nonDisplayedMemory.reset();
        }
    }, {
        key: 'ccEOC',
        value: function ccEOC() {
            //End of Caption (Flip Memories)
            logger.log('INFO', 'EOC - End Of Caption');
            if (this.mode === 'MODE_POP-ON') {
                var tmp = this.displayedMemory;
                this.displayedMemory = this.nonDisplayedMemory;
                this.nonDisplayedMemory = tmp;
                this.writeScreen = this.nonDisplayedMemory;
                logger.log('TEXT', 'DISP: ' + this.displayedMemory.getDisplayText());
            }
            this.outputDataUpdate();
        }
    }, {
        key: 'ccTO',
        value: function ccTO(nrCols) {
            // Tab Offset 1,2, or 3 columns
            logger.log('INFO', 'TO(' + nrCols + ') - Tab Offset');
            this.writeScreen.moveCursor(nrCols);
        }
    }, {
        key: 'ccMIDROW',
        value: function ccMIDROW(secondByte) {
            // Parse MIDROW command
            var styles = { flash: false };
            styles.underline = secondByte % 2 === 1;
            styles.italics = secondByte >= 0x2e;
            if (!styles.italics) {
                var colorIndex = Math.floor(secondByte / 2) - 0x10;
                var colors = ['white', 'green', 'blue', 'cyan', 'red', 'yellow', 'magenta'];
                styles.foreground = colors[colorIndex];
            } else {
                styles.foreground = 'white';
            }
            logger.log('INFO', 'MIDROW: ' + JSON.stringify(styles));
            this.writeScreen.setPen(styles);
        }
    }, {
        key: 'outputDataUpdate',
        value: function outputDataUpdate() {
            var t = logger.time;
            if (t === null) {
                return;
            }
            if (this.outputFilter) {
                if (this.outputFilter.updateData) {
                    this.outputFilter.updateData(t, this.displayedMemory);
                }
                if (this.cueStartTime === null && !this.displayedMemory.isEmpty()) {
                    // Start of a new cue
                    this.cueStartTime = t;
                } else {
                    if (!this.displayedMemory.equals(this.lastOutputScreen)) {
                        if (this.outputFilter.newCue) {
                            this.outputFilter.newCue(this.cueStartTime, t, this.lastOutputScreen);
                        }
                        this.cueStartTime = this.displayedMemory.isEmpty() ? null : t;
                    }
                }
                this.lastOutputScreen.copy(this.displayedMemory);
            }
        }
    }, {
        key: 'cueSplitAtTime',
        value: function cueSplitAtTime(t) {
            if (this.outputFilter) {
                if (!this.displayedMemory.isEmpty()) {
                    if (this.outputFilter.newCue) {
                        this.outputFilter.newCue(this.cueStartTime, t, this.displayedMemory);
                    }
                    this.cueStartTime = t;
                }
            }
        }
    }]);

    return Cea608Channel;
}();

var Cea608Parser = function () {
    function Cea608Parser(field, out1, out2) {
        _classCallCheck(this, Cea608Parser);

        this.field = field || 1;
        this.outputs = [out1, out2];
        this.channels = [new Cea608Channel(1, out1), new Cea608Channel(2, out2)];
        this.currChNr = -1; // Will be 1 or 2
        this.lastCmdA = null; // First byte of last command
        this.lastCmdB = null; // Second byte of last command
        this.bufferedData = [];
        this.startTime = null;
        this.lastTime = null;
        this.dataCounters = { 'padding': 0, 'char': 0, 'cmd': 0, 'other': 0 };
    }

    _createClass(Cea608Parser, [{
        key: 'getHandler',
        value: function getHandler(index) {
            return this.channels[index].getHandler();
        }
    }, {
        key: 'setHandler',
        value: function setHandler(index, newHandler) {
            this.channels[index].setHandler(newHandler);
        }

        /**
         * Add data for time t in forms of list of bytes (unsigned ints). The bytes are treated as pairs.
         */

    }, {
        key: 'addData',
        value: function addData(t, byteList) {
            var cmdFound,
                a,
                b,
                charsFound = false;

            this.lastTime = t;
            logger.setTime(t);

            for (var i = 0; i < byteList.length; i += 2) {
                a = byteList[i] & 0x7f;
                b = byteList[i + 1] & 0x7f;
                if (a === 0 && b === 0) {
                    this.dataCounters.padding += 2;
                    continue;
                } else {
                    logger.log('DATA', '[' + numArrayToHexArray([byteList[i], byteList[i + 1]]) + '] -> (' + numArrayToHexArray([a, b]) + ')');
                }
                cmdFound = this.parseCmd(a, b);
                if (!cmdFound) {
                    cmdFound = this.parseMidrow(a, b);
                }
                if (!cmdFound) {
                    cmdFound = this.parsePAC(a, b);
                }
                if (!cmdFound) {
                    cmdFound = this.parseBackgroundAttributes(a, b);
                }
                if (!cmdFound) {
                    charsFound = this.parseChars(a, b);
                    if (charsFound) {
                        if (this.currChNr && this.currChNr >= 0) {
                            var channel = this.channels[this.currChNr - 1];
                            channel.insertChars(charsFound);
                        } else {
                            logger.log('WARNING', 'No channel found yet. TEXT-MODE?');
                        }
                    }
                }
                if (cmdFound) {
                    this.dataCounters.cmd += 2;
                } else if (charsFound) {
                    this.dataCounters.char += 2;
                } else {
                    this.dataCounters.other += 2;
                    logger.log('WARNING', 'Couldn\'t parse cleaned data ' + numArrayToHexArray([a, b]) + ' orig: ' + numArrayToHexArray([byteList[i], byteList[i + 1]]));
                }
            }
        }

        /**
         * Parse Command.
         * @returns {Boolean} Tells if a command was found
         */

    }, {
        key: 'parseCmd',
        value: function parseCmd(a, b) {
            var chNr = null;

            var cond1 = (a === 0x14 || a === 0x1C) && 0x20 <= b && b <= 0x2F;
            var cond2 = (a === 0x17 || a === 0x1F) && 0x21 <= b && b <= 0x23;
            if (!(cond1 || cond2)) {
                return false;
            }

            if (a === this.lastCmdA && b === this.lastCmdB) {
                this.lastCmdA = null;
                this.lastCmdB = null; // Repeated commands are dropped (once)
                logger.log('DEBUG', 'Repeated command (' + numArrayToHexArray([a, b]) + ') is dropped');
                return true;
            }

            if (a === 0x14 || a === 0x17) {
                chNr = 1;
            } else {
                chNr = 2; // (a === 0x1C || a=== 0x1f)
            }

            var channel = this.channels[chNr - 1];

            if (a === 0x14 || a === 0x1C) {
                if (b === 0x20) {
                    channel.ccRCL();
                } else if (b === 0x21) {
                    channel.ccBS();
                } else if (b === 0x22) {
                    channel.ccAOF();
                } else if (b === 0x23) {
                    channel.ccAON();
                } else if (b === 0x24) {
                    channel.ccDER();
                } else if (b === 0x25) {
                    channel.ccRU(2);
                } else if (b === 0x26) {
                    channel.ccRU(3);
                } else if (b === 0x27) {
                    channel.ccRU(4);
                } else if (b === 0x28) {
                    channel.ccFON();
                } else if (b === 0x29) {
                    channel.ccRDC();
                } else if (b === 0x2A) {
                    channel.ccTR();
                } else if (b === 0x2B) {
                    channel.ccRTD();
                } else if (b === 0x2C) {
                    channel.ccEDM();
                } else if (b === 0x2D) {
                    channel.ccCR();
                } else if (b === 0x2E) {
                    channel.ccENM();
                } else if (b === 0x2F) {
                    channel.ccEOC();
                }
            } else {
                //a == 0x17 || a == 0x1F
                channel.ccTO(b - 0x20);
            }
            this.lastCmdA = a;
            this.lastCmdB = b;
            this.currChNr = chNr;
            return true;
        }

        /**
         * Parse midrow styling command
         * @returns {Boolean}
         */

    }, {
        key: 'parseMidrow',
        value: function parseMidrow(a, b) {
            var chNr = null;

            if ((a === 0x11 || a === 0x19) && 0x20 <= b && b <= 0x2f) {
                if (a === 0x11) {
                    chNr = 1;
                } else {
                    chNr = 2;
                }
                if (chNr !== this.currChNr) {
                    logger.log('ERROR', 'Mismatch channel in midrow parsing');
                    return false;
                }
                var channel = this.channels[chNr - 1];
                channel.ccMIDROW(b);
                logger.log('DEBUG', 'MIDROW (' + numArrayToHexArray([a, b]) + ')');
                return true;
            }
            return false;
        }
        /**
         * Parse Preable Access Codes (Table 53).
         * @returns {Boolean} Tells if PAC found
         */

    }, {
        key: 'parsePAC',
        value: function parsePAC(a, b) {

            var chNr = null;
            var row = null;

            var case1 = (0x11 <= a && a <= 0x17 || 0x19 <= a && a <= 0x1F) && 0x40 <= b && b <= 0x7F;
            var case2 = (a === 0x10 || a === 0x18) && 0x40 <= b && b <= 0x5F;
            if (!(case1 || case2)) {
                return false;
            }

            if (a === this.lastCmdA && b === this.lastCmdB) {
                this.lastCmdA = null;
                this.lastCmdB = null;
                return true; // Repeated commands are dropped (once)
            }

            chNr = a <= 0x17 ? 1 : 2;

            if (0x40 <= b && b <= 0x5F) {
                row = chNr === 1 ? rowsLowCh1[a] : rowsLowCh2[a];
            } else {
                // 0x60 <= b <= 0x7F
                row = chNr === 1 ? rowsHighCh1[a] : rowsHighCh2[a];
            }
            var pacData = this.interpretPAC(row, b);
            var channel = this.channels[chNr - 1];
            channel.setPAC(pacData);
            this.lastCmdA = a;
            this.lastCmdB = b;
            this.currChNr = chNr;
            return true;
        }

        /**
         * Interpret the second byte of the pac, and return the information.
         * @returns {Object} pacData with style parameters.
         */

    }, {
        key: 'interpretPAC',
        value: function interpretPAC(row, byte) {
            var pacIndex = byte;
            var pacData = { color: null, italics: false, indent: null, underline: false, row: row };

            if (byte > 0x5F) {
                pacIndex = byte - 0x60;
            } else {
                pacIndex = byte - 0x40;
            }
            pacData.underline = (pacIndex & 1) === 1;
            if (pacIndex <= 0xd) {
                pacData.color = ['white', 'green', 'blue', 'cyan', 'red', 'yellow', 'magenta', 'white'][Math.floor(pacIndex / 2)];
            } else if (pacIndex <= 0xf) {
                pacData.italics = true;
                pacData.color = 'white';
            } else {
                pacData.indent = Math.floor((pacIndex - 0x10) / 2) * 4;
            }
            return pacData; // Note that row has zero offset. The spec uses 1.
        }

        /**
         * Parse characters.
         * @returns An array with 1 to 2 codes corresponding to chars, if found. null otherwise.
         */

    }, {
        key: 'parseChars',
        value: function parseChars(a, b) {

            var channelNr = null,
                charCodes = null,
                charCode1 = null;

            if (a >= 0x19) {
                channelNr = 2;
                charCode1 = a - 8;
            } else {
                channelNr = 1;
                charCode1 = a;
            }
            if (0x11 <= charCode1 && charCode1 <= 0x13) {
                // Special character
                var oneCode = b;
                if (charCode1 === 0x11) {
                    oneCode = b + 0x50;
                } else if (charCode1 === 0x12) {
                    oneCode = b + 0x70;
                } else {
                    oneCode = b + 0x90;
                }
                logger.log('INFO', 'Special char \'' + getCharForByte(oneCode) + '\' in channel ' + channelNr);
                charCodes = [oneCode];
            } else if (0x20 <= a && a <= 0x7f) {
                charCodes = b === 0 ? [a] : [a, b];
            }
            if (charCodes) {
                var hexCodes = numArrayToHexArray(charCodes);
                logger.log('DEBUG', 'Char codes =  ' + hexCodes.join(','));
                this.lastCmdA = null;
                this.lastCmdB = null;
            }
            return charCodes;
        }

        /**
        * Parse extended background attributes as well as new foreground color black.
        * @returns{Boolean} Tells if background attributes are found
        */

    }, {
        key: 'parseBackgroundAttributes',
        value: function parseBackgroundAttributes(a, b) {
            var bkgData, index, chNr, channel;

            var case1 = (a === 0x10 || a === 0x18) && 0x20 <= b && b <= 0x2f;
            var case2 = (a === 0x17 || a === 0x1f) && 0x2d <= b && b <= 0x2f;
            if (!(case1 || case2)) {
                return false;
            }
            bkgData = {};
            if (a === 0x10 || a === 0x18) {
                index = Math.floor((b - 0x20) / 2);
                bkgData.background = backgroundColors[index];
                if (b % 2 === 1) {
                    bkgData.background = bkgData.background + '_semi';
                }
            } else if (b === 0x2d) {
                bkgData.background = 'transparent';
            } else {
                bkgData.foreground = 'black';
                if (b === 0x2f) {
                    bkgData.underline = true;
                }
            }
            chNr = a < 0x18 ? 1 : 2;
            channel = this.channels[chNr - 1];
            channel.setBkgData(bkgData);
            this.lastCmdA = null;
            this.lastCmdB = null;
            return true;
        }

        /**
         * Reset state of parser and its channels.
         */

    }, {
        key: 'reset',
        value: function reset() {
            for (var i = 0; i < this.channels.length; i++) {
                if (this.channels[i]) {
                    this.channels[i].reset();
                }
            }
            this.lastCmdA = null;
            this.lastCmdB = null;
        }

        /**
         * Trigger the generation of a cue, and the start of a new one if displayScreens are not empty.
         */

    }, {
        key: 'cueSplitAtTime',
        value: function cueSplitAtTime(t) {
            for (var i = 0; i < this.channels.length; i++) {
                if (this.channels[i]) {
                    this.channels[i].cueSplitAtTime(t);
                }
            }
        }
    }]);

    return Cea608Parser;
}();

exports.default = Cea608Parser;

},{}],43:[function(_dereq_,module,exports){
'use strict';

var Cues = {

  newCue: function newCue(track, startTime, endTime, captionScreen) {
    var row;
    var cue;
    var indenting;
    var indent;
    var text;
    var VTTCue = window.VTTCue || window.TextTrackCue;

    for (var r = 0; r < captionScreen.rows.length; r++) {
      row = captionScreen.rows[r];
      indenting = true;
      indent = 0;
      text = '';

      if (!row.isEmpty()) {
        for (var c = 0; c < row.chars.length; c++) {
          if (row.chars[c].uchar.match(/\s/) && indenting) {
            indent++;
          } else {
            text += row.chars[c].uchar;
            indenting = false;
          }
        }
        //To be used for cleaning-up orphaned roll-up captions
        row.cueStartTime = startTime;
        cue = new VTTCue(startTime, endTime, text.trim());

        if (indent >= 16) {
          indent--;
        } else {
          indent++;
        }

        // VTTCue.line get's flakey when using controls, so let's now include line 13&14
        // also, drop line 1 since it's to close to the top
        if (navigator.userAgent.match(/Firefox\//)) {
          cue.line = r + 1;
        } else {
          cue.line = r > 7 ? r - 2 : r + 1;
        }
        cue.align = 'left';
        // Clamp the position between 0 and 100 - if out of these bounds, Firefox throws an exception and captions break
        cue.position = Math.max(0, Math.min(100, 100 * (indent / 32) + (navigator.userAgent.match(/Firefox\//) ? 50 : 0)));
        track.addCue(cue);
      }
    }
  }

};

module.exports = Cues;

},{}],44:[function(_dereq_,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/*
 * compute an Exponential Weighted moving average
 * - https://en.wikipedia.org/wiki/Moving_average#Exponential_moving_average
 *  - heavily inspired from shaka-player
 */

var EWMA = function () {

  //  About half of the estimated value will be from the last |halfLife| samples by weight.
  function EWMA(halfLife) {
    _classCallCheck(this, EWMA);

    // Larger values of alpha expire historical data more slowly.
    this.alpha_ = halfLife ? Math.exp(Math.log(0.5) / halfLife) : 0;
    this.estimate_ = 0;
    this.totalWeight_ = 0;
  }

  _createClass(EWMA, [{
    key: "sample",
    value: function sample(weight, value) {
      var adjAlpha = Math.pow(this.alpha_, weight);
      this.estimate_ = value * (1 - adjAlpha) + adjAlpha * this.estimate_;
      this.totalWeight_ += weight;
    }
  }, {
    key: "getTotalWeight",
    value: function getTotalWeight() {
      return this.totalWeight_;
    }
  }, {
    key: "getEstimate",
    value: function getEstimate() {
      if (this.alpha_) {
        var zeroFactor = 1 - Math.pow(this.alpha_, this.totalWeight_);
        return this.estimate_ / zeroFactor;
      } else {
        return this.estimate_;
      }
    }
  }]);

  return EWMA;
}();

exports.default = EWMA;

},{}],45:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

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

/*globals self: false */

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
  var func = self.console[type];
  if (func) {
    return function () {
      for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      if (args[0]) {
        args[0] = formatMsg(type, args[0]);
      }
      func.apply(self.console, args);
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

},{}],46:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 *  TimeRanges to string helper
 */

var TimeRanges = function () {
  function TimeRanges() {
    _classCallCheck(this, TimeRanges);
  }

  _createClass(TimeRanges, null, [{
    key: 'toString',
    value: function toString(r) {
      var log = '',
          len = r.length;
      for (var i = 0; i < len; i++) {
        log += '[' + r.start(i).toFixed(3) + ',' + r.end(i).toFixed(3) + ']';
      }
      return log;
    }
  }]);

  return TimeRanges;
}();

exports.default = TimeRanges;

},{}],47:[function(_dereq_,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * XHR based logger
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     */

var _logger = _dereq_(45);

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
      var loader = this.loader;
      if (loader && loader.readyState !== 4) {
        this.stats.aborted = true;
        loader.abort();
      }

      window.clearTimeout(this.requestTimeout);
      this.requestTimeout = null;
      window.clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
  }, {
    key: 'load',
    value: function load(context, config, callbacks) {
      this.context = context;
      this.config = config;
      this.callbacks = callbacks;
      this.stats = { trequest: performance.now(), retry: 0 };
      this.retryDelay = config.retryDelay;
      this.loadInternal();
    }
  }, {
    key: 'loadInternal',
    value: function loadInternal() {
      var xhr,
          context = this.context;

      if (typeof XDomainRequest !== 'undefined') {
        xhr = this.loader = new XDomainRequest();
      } else {
        xhr = this.loader = new XMLHttpRequest();
      }

      xhr.onreadystatechange = this.readystatechange.bind(this);
      xhr.onprogress = this.loadprogress.bind(this);

      xhr.open('GET', context.url, true);

      if (context.rangeEnd) {
        xhr.setRequestHeader('Range', 'bytes=' + context.rangeStart + '-' + (context.rangeEnd - 1));
      }
      xhr.responseType = context.responseType;
      var stats = this.stats;
      stats.tfirst = 0;
      stats.loaded = 0;
      if (this.xhrSetup) {
        this.xhrSetup(xhr, context.url);
      }
      // setup timeout before we perform request
      this.requestTimeout = window.setTimeout(this.loadtimeout.bind(this), this.config.timeout);
      xhr.send();
    }
  }, {
    key: 'readystatechange',
    value: function readystatechange(event) {
      var xhr = event.currentTarget,
          readyState = xhr.readyState,
          stats = this.stats,
          context = this.context,
          config = this.config;

      // don't proceed if xhr has been aborted
      if (stats.aborted) {
        return;
      }

      // >= HEADERS_RECEIVED
      if (readyState >= 2) {
        // clear xhr timeout and rearm it if readyState less than 4
        window.clearTimeout(this.requestTimeout);
        if (stats.tfirst === 0) {
          stats.tfirst = Math.max(performance.now(), stats.trequest);
        }
        if (readyState === 4) {
          var status = xhr.status;
          // http status between 200 to 299 are all successful
          if (status >= 200 && status < 300) {
            stats.tload = Math.max(stats.tfirst, performance.now());
            var data = void 0,
                len = void 0;
            if (context.responseType === 'arraybuffer') {
              data = xhr.response;
              len = data.byteLength;
            } else {
              data = xhr.responseText;
              len = data.length;
            }
            stats.loaded = stats.total = len;
            var response = { url: xhr.responseURL, data: data };
            this.callbacks.onSuccess(response, stats, context);
          } else {
            // if max nb of retries reached or if http status between 400 and 499 (such error cannot be recovered, retrying is useless), return error
            if (stats.retry >= config.maxRetry || status >= 400 && status < 499) {
              _logger.logger.error(status + ' while loading ' + context.url);
              this.callbacks.onError({ code: status, text: xhr.statusText }, context);
            } else {
              // retry
              _logger.logger.warn(status + ' while loading ' + context.url + ', retrying in ' + this.retryDelay + '...');
              // aborts and resets internal state
              this.destroy();
              // schedule retry
              this.retryTimeout = window.setTimeout(this.loadInternal.bind(this), this.retryDelay);
              // set exponential backoff
              this.retryDelay = Math.min(2 * this.retryDelay, config.maxRetryDelay);
              stats.retry++;
            }
          }
        } else {
          // readyState >= 2 AND readyState !==4 (readyState = HEADERS_RECEIVED || LOADING) rearm timeout as xhr not finished yet
          this.requestTimeout = window.setTimeout(this.loadtimeout.bind(this), config.timeout);
        }
      }
    }
  }, {
    key: 'loadtimeout',
    value: function loadtimeout() {
      _logger.logger.warn('timeout while loading ' + this.context.url);
      this.callbacks.onTimeout(this.stats, this.context);
    }
  }, {
    key: 'loadprogress',
    value: function loadprogress(event) {
      var stats = this.stats;
      stats.loaded = event.loaded;
      if (event.lengthComputable) {
        stats.total = event.total;
      }
      var onProgress = this.callbacks.onProgress;
      if (onProgress) {
        // last args is to provide on progress data
        onProgress(stats, this.context, null);
      }
    }
  }]);

  return XhrLoader;
}();

exports.default = XhrLoader;

},{"45":45}]},{},[33])(33)
});
//# sourceMappingURL=hls.js.map
